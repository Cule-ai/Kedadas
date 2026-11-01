// Vercel Serverless Function: /api/analizar-cuadrante
// Reconoce cuadrantes laborales de fotos y capturas (mensual o anual) usando Gemini Vision AI

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
      ? ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][mes] || ''
      : '';

    const promptInstrucciones = `
Eres un digitalizador experto en cuadrantes de turnos laborales (sanidad, policía, emergencias, fábricas, hostelería, etc.).
Tu misión es extraer con total exactitud todos los turnos del trabajador/cuadrante en la imagen.

CONTEXTO DE BÚSQUEDA:
- Trabajador a extraer: "${usuario}". Si hay múltiples filas con nombres de personas, busca EXCLUSIVAMENTE la fila correspondiente a "${usuario}". Si no encuentras ese nombre específico o la tabla es para un solo trabajador/puesto, extrae el cuadrante principal visible.
- Año de referencia: ${anio}.
- Mes de referencia: ${mes !== null && mes !== undefined ? `${mes + 1} (${mesNombreReferencia})` : 'Detectar de la imagen'}.
- Modo solicitado: "${modoEscaneo}" (si es 'auto', analiza si la imagen contiene solo 1 mes o el año completo/múltiples meses).

CONVENCIÓN DE TURNOS PERMITIDOS:
- "M": Turno de Mañana (ejemplos: M, M1, M2, 07:00-15:00, 08:00-15:00, Mañana).
- "T": Turno de Tarde (ejemplos: T, T1, T2, 15:00-23:00, 14:00-22:00, Tarde).
- "N": Turno de Noche (ejemplos: N, N1, 23:00-07:00, 22:00-06:00, Noche, Guardia noche).
- "L": Día Libre / Descanso / Saliente (ejemplos: L, D, S, Saliente, Libre, Descanso, Festivo libre).
- "V": Vacaciones / Permiso (ejemplos: V, VAC, AP, Asuntos propios, Permiso, Baja).
- "X": Vacío o sin turno asignado.

REGLAS DE FORMATO Y FECHAS:
1. El campo "mes" DEBE ser un número entero de 0 a 11 (donde 0 = Enero, 1 = Febrero, ..., 11 = Diciembre).
2. El campo "dia" DEBE ser el número del día (1 al 28/29/30/31 según el mes).
3. Asegúrate de incluir todos los días del mes o de los meses presentes en la foto.

FORMATO DE RESPUESTA EXCLUSIVO (JSON VÁLIDO SIN TEXTO ADICIONAL):
{
  "modo": "mes" o "ano",
  "anio": ${anio},
  "resumen": "Cuadrante detectado para ${usuario}...",
  "meses": [
    {
      "mes": 0,
      "nombreMes": "Enero",
      "dias": [
        { "dia": 1, "turno": "M" },
        { "dia": 2, "turno": "T" },
        { "dia": 3, "turno": "L" }
      ]
    }
  ]
}
`;

    // Intentar con gemini-2.0-flash, gemini-1.5-flash-latest y fallback a v1beta/v1
    const modelos = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash-002', 'gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-1.5-pro'];
    let respuestaFinal = null;
    let ultimoError = null;

    for (const modelo of modelos) {
      const versiones = ['v1beta', 'v1'];
      for (const vApi of versiones) {
        try {
          const url = `https://generativelanguage.googleapis.com/${vApi}/models/${modelo}:generateContent?key=${geminiKey}`;
          const geminiRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: promptInstrucciones },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: cleanBase64
                    }
                  }
                ]
              }],
              generationConfig: {
                response_mime_type: 'application/json',
                temperature: 0.1,
                max_output_tokens: 8192
              }
            })
          });

          const data = await geminiRes.json();
          if (geminiRes.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const rawJson = data.candidates[0].content.parts[0].text;
            const parsed = JSON.parse(rawJson);
            if (parsed && Array.isArray(parsed.meses) && parsed.meses.length > 0) {
              respuestaFinal = parsed;
              break;
            }
          } else {
            ultimoError = data.error?.message || 'Respuesta inválida de Gemini';
            if (geminiRes.status === 404) break; // Probar siguiente modelo
          }
        } catch (err) {
          ultimoError = err.message;
        }
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
    console.error('Error en /api/analizar-cuadrante:', error);
    return res.status(500).json({ error: error.message });
  }
}
