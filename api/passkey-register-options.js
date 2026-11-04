import { admin, usuarioDesdeRequest } from './_auth.js';
import { nuevoReto, contextoDeRequest } from './_webauthn.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const user = await usuarioDesdeRequest(req);
  if (!user) return res.status(401).json({ error: 'Sesión no válida' });
  try {
    const { rpId } = contextoDeRequest(req);
    const { challenge, token } = nuevoReto('reg');
    const { data: previas } = await admin().from('passkey_credentials').select('id').eq('user_id', user.id);
    const { data: perfil } = await admin().from('perfiles').select('nombre').eq('user_id', user.id).maybeSingle();
    return res.status(200).json({
      challenge, token, rp: { id: rpId },
      user: { id: Buffer.from(user.id).toString('base64url'), name: user.email, displayName: perfil?.nombre || user.email },
      excludeCredentials: (previas || []).map(p => p.id)
    });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
