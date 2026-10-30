// Supabase Edge Function: analizar-cuadrante
// Lee una foto o captura de un cuadrante de turnos usando IA de Visión (Gemini o Claude)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType = "image/jpeg", mes, anio, usuario = "Cule" } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Falta la imagen en base64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Usar GEMINI_API_KEY o ANTHROPIC_API_KEY desde secretos de Supabase
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const claudeKey = Deno.env.get("ANTHROPIC_API_KEY");

    let turnosDetectados = [];

    const promptInstrucciones = `
Eres un asistente experto en digitalización de cuadrantes y calendarios laborales de turnos.
Analiza con máxima precisión la imagen adjunta correspondiente al mes ${mes !== undefined ? mes + 1 : 'actual'} del año ${anio || 'actual'}.
Busca la fila o sección correspondiente al usuario "${usuario}" o al cuadrante principal si solo hay uno.
Los turnos posibles son:
- "M": Mañana
- "T": Tarde
- "N": Noche
- "L": Libre / Descanso / Saliente
- "V": Vacaciones / Permiso
- "X": Vacio / Sin turno

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato exacto, sin explicaciones ni markdown:
{
  "dias": [
    { "dia": 1, "turno": "M" },
    { "dia": 2, "turno": "T" }
  ]
}
`;

    if (geminiKey) {
      // Llamada a Gemini 1.5 / Flash Vision
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptInstrucciones },
              { inline_data: { mime_type: mimeType, data: imageBase64.replace(/^data:image\/[a-z]+;base64,/, '') } }
            ]
          }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        turnosDetectados = parsed.dias || [];
      }
    } else if (claudeKey) {
      // Llamada a Claude 3.5 Sonnet / Haiku Vision
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": claudeKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: promptInstrucciones },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: imageBase64.replace(/^data:image\/[a-z]+;base64,/, '')
                }
              }
            ]
          }]
        })
      });

      const data = await res.json();
      const rawText = data.content?.[0]?.text;
      if (rawText) {
        const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        turnosDetectados = parsed.dias || [];
      }
    } else {
      // Si no hay API key configurada en los secretos de Supabase aún
      return new Response(JSON.stringify({
        aviso: "No se encontró GEMINI_API_KEY ni ANTHROPIC_API_KEY en Supabase Secrets.",
        turnos: []
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ turnos: turnosDetectados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
