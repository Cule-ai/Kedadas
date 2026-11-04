import { admin } from './_auth.js';
import { verificarLogin, contextoDeRequest } from './_webauthn.js';
import { consumirReto, demasiadosFallos, registrarFallo, ipDeRequest } from './_retos.js';

const FALLO = 'No se pudo verificar la passkey';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  try {
    const { id, token, authenticatorData, clientDataJSON, signature } = req.body || {};
    const db = admin();
    const ip = ipDeRequest(req);
    if (await demasiadosFallos(db, ip)) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
    const { data: cred } = await db.from('passkey_credentials').select('*').eq('id', String(id || '')).maybeSingle();
    if (!cred) { await registrarFallo(db, ip); return res.status(401).json({ error: FALLO }); }

    const { rpId, origins } = contextoDeRequest(req);
    const { counter } = verificarLogin({
      credencial: cred,
      authenticatorData: Buffer.from(authenticatorData, 'base64url'),
      clientDataJSON: Buffer.from(clientDataJSON, 'base64url'),
      signature: Buffer.from(signature, 'base64url'),
      token, rpId, origins
    });
    await consumirReto(db, token);
    await db.from('passkey_credentials').update({ counter, last_used_at: new Date().toISOString() }).eq('id', cred.id);

    // La passkey ya prueba quién eres: se emite una sesión de Supabase para ese usuario
    const { data: u, error: eu } = await db.auth.admin.getUserById(cred.user_id);
    if (eu || !u?.user?.email) return res.status(401).json({ error: FALLO });
    const { data: link, error: el } = await db.auth.admin.generateLink({ type: 'magiclink', email: u.user.email });
    if (el || !link?.properties?.hashed_token) return res.status(500).json({ error: 'No se pudo crear la sesión' });
    return res.status(200).json({ token_hash: link.properties.hashed_token });
  } catch (e) {
    await registrarFallo(admin(), ipDeRequest(req));
    return res.status(401).json({ error: FALLO });
  }
}
