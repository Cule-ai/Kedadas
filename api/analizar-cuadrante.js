// Vercel Serverless Function: /api/analizar-cuadrante
// Reconoce cuadrantes laborales de fotos y capturas (mensual o anual) usando Gemini Vision AI

export const config = {
  maxDuration: 60,
};

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

    // Límite de seguridad de tamaño de carga útil (máx. 15MB)
    if (typeof imageBase64 === 'string' && imageBase64.length > 15 * 1024 * 1024) {
      return res.status(413).json({ error: 'La imagen excede el límite máximo de tamaño permitido (10MB).' });
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

    const mesNombreReferencia = (mes !== null && mes !== undefined)
      ? ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][mes] || 'Noviembre'
      : 'Noviembre';

    const promptInstrucciones = `
Eres un digitalizador experto en cuadrantes de turnos laborales (sanidad, policía, emergencias, fábricas, hostelería, etc.).
Tu misión es extraer con total exactitud todos los turnos del trabajador/cuadrante en la imagen.

CONTEXTO DE BÚSQUEDA Y MES OBLIGATORIO:
- Trabajador a extraer: "${usuario}" (busca también por "Culebras", "Miguel Ángel", o la fila correspondiente si hay una lista de personal).
- Año de referencia: ${anio}.
- Mes de referencia OBLIGATORIO: ${mes !== null && mes !== undefined ? mes + 1 : 11} (${mesNombreReferencia}).
- Debes extraer EXCLUSIVAMENTE los turnos del mes de ${mesNombreReferencia} ${anio}. NO extraigas meses posteriores como Diciembre.
- Modo solicitado: "${modoEscaneo}".

CONVENCIÓN DE TURNOS PERMITIDOS:
- "M": Turno de Mañana (ejemplos: M, M1, M2, 07:00-15:00, 08:00-15:00, Mañana).
- "T": Turno de Tarde (ejemplos: T, T1, T2, 15:00-23:00, 14:00-22:00, Tarde).
- "N": Turno de Noche (ejemplos: N, N1, 23:00-07:00, 22:00-06:00, Noche, Guardia noche).
- "L": Día Libre / Descanso / Saliente (ejemplos: L, D, S, Saliente, Libre, Descanso, Festivo libre).
- "V": Vacaciones / Permiso (ejemplos: V, VAC, AP, Asuntos propios, Permiso, Baja).
- "X": Vacío o sin turno asignado.

IMPORTANTE SOBRE PRECISIÓN:
- Revisa celda por celda cada día del mes (1 al 28/29/30/31).
- Distingue con extrema precisión entre "M" (Mañana) y "T" (Tarde). Si una celda indica mañana o turno matutino, asígnala a "M".

REGLAS DE FORMATO Y FECHAS:
1. El campo "nombreMes" DEBE ser "${mesNombreReferencia}".
2. El campo "mes" DEBE ser ${mes !== null && mes !== undefined ? mes + 1 : 11}.
3. El campo "dia" DEBE ser el número entero del día (1 al 31).
4. Asegúrate de incluir todos los días del mes presentes en la foto.

FORMATO DE RESPUESTA EXCLUSIVO (JSON VÁLIDO SIN TEXTO ADICIONAL):
{
  "modo": "mes",
  "anio": ${anio},
  "resumen": "Cuadrante detectado para ${usuario} en ${mesNombreReferencia} ${anio}...",
  "meses": [
    {
      "mes": ${mes !== null && mes !== undefined ? mes + 1 : 11},
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

    // Modelos oficiales vigentes para cuentas nuevas de Google AI Studio (Gemini 3.x)
    const modelos = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash'];
    let respuestaFinal = null;
    let ultimoError = null;

    for (const modelo of modelos) {
      // 1. Intentar con generateContent oficial (schema camelCase estándar)
      try {
        const urlGenContent = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
        const resGenContent = await fetch(urlGenContent, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey
          },
          signal: AbortSignal.timeout(8500),
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
              maxOutputTokens: 4096
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

      // 2. Fallback a Interactions API si generateContent no responde
      try {
        const urlInteractions = 'https://generativelanguage.googleapis.com/v1beta/interactions';
        const resInteractions = await fetch(urlInteractions, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey
          },
          signal: AbortSignal.timeout(8500),
          body: JSON.stringify({
            model: modelo,
            input: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: promptInstrucciones },
                  { type: 'image', mime_type: mimeType, data: cleanBase64 }
                ]
              }
            ],
            response_format: {
              type: 'text',
              mime_type: 'application/json'
            }
          })
        });

        const dataInteractions = await resInteractions.json();
        if (resInteractions.ok) {
          const texto = extraerTextoRespuesta(dataInteractions);
          const parsed = parsearRespuestaJSON(texto);
          if (parsed) {
            respuestaFinal = parsed;
            break;
          }
        } else {
          ultimoError = dataInteractions.error?.message || `Error HTTP ${resInteractions.status}`;
          console.warn(`Aviso interactions con ${modelo}:`, ultimoError);
        }
      } catch (errInteractions) {
        ultimoError = errInteractions.name === 'TimeoutError' ? 'Tiempo de espera agotado.' : errInteractions.message;
        console.warn(`Error de red interactions con ${modelo}:`, errInteractions);
      }

      if (respuestaFinal) break;
    }

    if (!respuestaFinal) {
      return res.status(500).json({
        error: 'ERROR_GEMINI',
        message: ultimoError || 'No se pudo interpretar el cuadrante con el modelo de IA.'
      });
    }

    return res.status(200).json(respuestaFinal);

  } catch (error) {
    console.error('Error general en /api/analizar-cuadrante:', error);
    return res.status(500).json({ error: error.message });
  }
}
