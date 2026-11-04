import { admin, usuarioDesdeRequest } from './_auth.js';
import { verificarRegistro, contextoDeRequest } from './_webauthn.js';
import { consumirReto } from './_retos.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const user = await usuarioDesdeRequest(req);
  if (!user) return res.status(401).json({ error: 'Sesión no válida' });
  try {
    const { token, attestationObject, clientDataJSON } = req.body || {};
    const { rpId, origins } = contextoDeRequest(req);
    const r = verificarRegistro({
      attestationObject: Buffer.from(attestationObject, 'base64url'),
      clientDataJSON: Buffer.from(clientDataJSON, 'base64url'),
      token, rpId, origins
    });
    await consumirReto(admin(), token);
    const { error } = await admin().from('passkey_credentials').insert({
      id: r.credentialId, user_id: user.id, public_key_jwk: r.publicKeyJwk, counter: r.counter
    });
    if (error) throw new Error(error.message);
    return res.status(200).json({ ok: true });
  } catch (e) { return res.status(400).json({ error: e.message }); }
}
