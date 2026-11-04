import { nuevoReto, contextoDeRequest } from './_webauthn.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const { rpId } = contextoDeRequest(req);
    const { challenge, token } = nuevoReto('login');
    return res.status(200).json({ challenge, token, rpId });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
