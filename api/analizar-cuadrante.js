// Vercel Serverless Function: /api/analizar-cuadrante
// Reconoce cuadrantes laborales de fotos y capturas (mensual o anual) usando Gemini Vision AI

import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60,
};

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://idpgvtixeyytfgpkqjjm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

function extraerTextoRespuesta(data) {
  if (!data) return null;
  // Formato 1: generateContent estándar (data.candidates[0].content.parts[0].text)
  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text;
  }
  // Formato 2: timeline/steps de la API Interactions
  if (Array.isArray(data.steps)) {
    for (const step of data.steps) {
      if (Array.isArray(step.content)) {
        for (const item of step.content) {
          if (item && typeof item.text === 'string' && item.text.trim()) {
            return item.text;
          }
        }
      }
    }
  }
  return null;
}

function parsearRespuestaJSON(textoCrudo) {
  if (!textoCrudo || typeof textoCrudo !== 'string') return null;
  let raw = textoCrudo.trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.meses) && parsed.meses.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.warn('Error parseando JSON de Gemini:', e.message);
  }
  return null;
}

export default async function handler(req, res) {
  // Configuración de cabeceras CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  try {
    const {
      imageBase64,
      mimeType = 'image/jpeg',
      mes = null,
      anio = new Date().getFullYear(),
      usuario = 'Cule',
      apiKey: clientApiKey,
      modoEscaneo = 'auto' // 'auto' | 'mes' | 'ano'
    } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: 'Falta la imagen en base64 en la petición.' });
    }

    // 0. Verificación de Seguridad y Autenticación
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!clientApiKey) {
      if (!token) {
        return res.status(401).json({ error: 'No autorizado. Se requiere inicio de sesión para usar el escáner con IA del servidor.' });
      }
      if (SUPABASE_SERVICE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData?.user) {
          return res.status(401).json({ error: 'Sesión no válida o expirada. Inicia sesión de nuevo.' });
        }
      }
    }

    // Límite de seguridad de tamaño de carga útil (máx. 4.5MB en Vercel Serverless)
    if (typeof imageBase64 === 'string' && imageBase64.length > 4.5 * 1024 * 1024) {
      return res.status(413).json({ error: 'La imagen excede el límite máximo permitido (4.5MB). Reduce la resolución antes de subirla.' });
    }

    // Tomar la clave de Gemini proporcionada por el cliente o la variable de entorno de Vercel
    const geminiKey = clientApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!geminiKey) {
      return res.status(400).json({
        error: 'NO_API_KEY',
        message: 'No se ha detectado una clave de Gemini. Configúrala en los ajustes o en las variables de entorno de Vercel (GEMINI_API_KEY).'
      });
    }

    // Limpiar base64 si contiene prefijo data URL (imágenes o PDF)
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

    const esModoAno = modoEscaneo === 'ano' || (modoEscaneo === 'auto' && (mes === null || mes === undefined));
    const listaMeses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    const mesIndex = (mes !== null && mes !== undefined && !isNaN(parseInt(mes)))
      ? parseInt(mes)
      : new Date().getMonth();
    const mesNombreReferencia = listaMeses[mesIndex] || 'Enero';
    const numeroMesHumano = mesIndex + 1;

    const promptInstrucciones = esModoAno
      ? `
Eres un digitalizador experto en cuadrantes de turnos laborales (sanidad, policía, emergencias, fábricas, hostelería, etc.).
Tu misión es extraer con total exactitud todos los turnos del trabajador/cuadrante en la imagen para el AÑO COMPLETO o todos los meses presentes.

CONTEXTO DE BÚSQUEDA:
- Trabajador a extraer: "${usuario}". Si hay múltiples filas con nombres de personas, busca la fila correspondiente a "${usuario}". Si es un cuadrante individual, extrae el cuadrante visible.
- Año de referencia: ${anio}.
- Modo: Año completo (extrae todos los meses presentes en el documento, del 0 al 11).

CONVENCIÓN DE TURNOS PERMITIDOS:
- "M": Turno de Mañana.
- "T": Turno de Tarde.
- "N": Turno de Noche.
- "L": Día Libre / Descanso / Saliente.
- "V": Vacaciones / Permiso.
- "X": Vacío o sin turno asignado.

IMPORTANTE: Asigna estrictamente el turno reflejado en cada celda del cuadrante con total fidelidad a la imagen original, sin forzar ni inventar turnos.

FORMATO DE RESPUESTA EXCLUSIVO (JSON VÁLIDO SIN MARKDOWN):
{
  "modo": "ano",
  "anio": ${anio},
  "resumen": "Cuadrante anual detectado para ${usuario} en ${anio}...",
  "meses": [
    {
      "mes": 0,
      "nombreMes": "Enero",
      "dias": [
        { "dia": 1, "turno": "M" },
        { "dia": 2, "turno": "T" }
      ]
    }
  ]
}
`
      : `
Eres un digitalizador experto en cuadrantes de turnos laborales (sanidad, policía, emergencias, fábricas, hostelería, etc.).
Tu misión es extraer con total exactitud todos los turnos del trabajador/cuadrante en la imagen.

CONTEXTO DE BÚSQUEDA Y MES OBLIGATORIO:
- Trabajador a extraer: "${usuario}". Si hay múltiples filas con nombres de personas, busca la fila correspondiente a "${usuario}". Si es un cuadrante individual, extrae el cuadrante principal visible.
- Año de referencia: ${anio}.
- Mes de referencia OBLIGATORIO: ${mesNombreReferencia} (Mes ${numeroMesHumano} del año).
- Debes extraer los turnos correspondientes al mes de ${mesNombreReferencia} ${anio}.
- Modo solicitado: "${modoEscaneo}".

CONVENCIÓN DE TURNOS PERMITIDOS:
- "M": Turno de Mañana.
- "T": Turno de Tarde.
- "N": Turno de Noche.
- "L": Día Libre / Descanso / Saliente.
- "V": Vacaciones / Permiso.
- "X": Vacío o sin turno asignado.

IMPORTANTE: Asigna estrictamente el turno reflejado en cada celda del cuadrante con total fidelidad a la imagen original, sin forzar ni inventar turnos.

REGLAS DE FORMATO Y FECHAS:
1. El campo "nombreMes" DEBE ser "${mesNombreReferencia}".
2. El campo "mes" DEBE ser exactamente ${mesIndex} (número 0 a 11, donde 0 es Enero).
3. El campo "dia" DEBE ser el número entero del día (1 al 31).

FORMATO DE RESPUESTA EXCLUSIVO (JSON VÁLIDO SIN TEXTO ADICIONAL):
{
  "modo": "mes",
  "anio": ${anio},
  "resumen": "Cuadrante detectado para ${usuario} en ${mesNombreReferencia} ${anio}...",
  "meses": [
    {
      "mes": ${mesIndex},
      "nombreMes": "${mesNombreReferencia}",
      "dias": [
        { "dia": 1, "turno": "M" },
        { "dia": 2, "turno": "T" },
        { "dia": 3, "turno": "L" }
      ]
    }
  ]
}
`;

    // Limpiar clave de comillas y espacios accidentales
    const cleanKey = String(geminiKey || '').trim().replace(/^['"]|['"]$/g, '');

    // Modelos oficiales vigentes para Google AI Studio (Gemini 3.x prioritario, fallback a 2.5 / 2.0)
    const modelos = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    let respuestaFinal = null;
    let ultimoError = null;

    const maxTokens = esModoAno ? 8192 : 4096;

    for (const modelo of modelos) {
      try {
        const urlGenContent = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
        const resGenContent = await fetch(urlGenContent, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey
          },
          signal: AbortSignal.timeout(22000),
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: promptInstrucciones },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: cleanBase64
                  }
                }
              ]
            }],
            generationConfig: {
              responseMimeType: 'application/json',
              maxOutputTokens: maxTokens
            }
          })
        });

        const dataGen = await resGenContent.json();
        if (resGenContent.ok) {
          const texto = extraerTextoRespuesta(dataGen);
          const parsed = parsearRespuestaJSON(texto);
          if (parsed) {
            respuestaFinal = parsed;
            break;
          }
        } else {
          ultimoError = dataGen.error?.message || `Error HTTP ${resGenContent.status}`;
          console.warn(`Aviso generateContent con ${modelo}:`, ultimoError);
        }
      } catch (errGen) {
        ultimoError = errGen.name === 'TimeoutError' ? 'Tiempo de espera agotado en Vercel.' : errGen.message;
        console.warn(`Error de red generateContent con ${modelo}:`, errGen);
      }

      if (respuestaFinal) break;
    }

    if (!respuestaFinal) {
      let mensajeAmigable = ultimoError || 'No se pudo interpretar el cuadrante con el modelo de IA.';
      const mLower = String(mensajeAmigable).toLowerCase();
      if (mLower.includes('is no longer available') || mLower.includes('update your code')) {
        mensajeAmigable = 'El modelo anterior de Google ha dejado de estar disponible. Se ha actualizado la app a Gemini 3.5 Flash.';
      } else if (mLower.includes('api_key_invalid') || mLower.includes('api key not valid')) {
        mensajeAmigable = 'La clave de Google Gemini no es válida. Revisa tu clave en Google AI Studio.';
      } else if (mLower.includes('quota') || mLower.includes('resource_exhausted')) {
        mensajeAmigable = 'Se ha superado temporalmente el límite gratuito de consultas por minuto. Espera un minuto y vuelve a intentarlo.';
      }

      return res.status(500).json({
        error: 'ERROR_GEMINI',
        message: mensajeAmigable
      });
    }

    return res.status(200).json(respuestaFinal);

  } catch (error) {
    console.error('Error general en /api/analizar-cuadrante:', error);
    return res.status(500).json({ error: error.message });
  }
}
