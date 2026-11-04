// Verificación WebAuthn (passkeys) sin dependencias: solo node:crypto.
// Soporta ES256 (P-256), que es lo que usan Face ID, Touch ID, Android y Windows Hello.
import crypto from 'node:crypto';

const secreto = () => process.env.PASSKEY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const hmac = (txt) => crypto.createHmac('sha256', secreto()).update(txt).digest('base64url');
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest();
const VIDA_RETO_MS = 5 * 60 * 1000;

// Reto firmado sin estado: no hace falta tabla para guardarlo
export function nuevoReto(proposito) {
  if (!secreto()) throw new Error('Falta PASSKEY_SECRET en el servidor');
  const challenge = crypto.randomBytes(32).toString('base64url');
  const cuerpo = `${proposito}.${challenge}.${Date.now()}`;
  return { challenge, token: `${cuerpo}.${hmac(cuerpo)}` };
}

export function challengeDeToken(token, proposito) {
  const partes = String(token || '').split('.');
  if (partes.length !== 4) throw new Error('Reto no válido');
  const [prop, challenge, ts, firma] = partes;
  const esperada = hmac(`${prop}.${challenge}.${ts}`);
  const a = Buffer.from(firma), b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Reto no válido');
  if (prop !== proposito) throw new Error('Reto no válido');
  if (Date.now() - Number(ts) > VIDA_RETO_MS) throw new Error('El reto ha caducado, inténtalo de nuevo');
  return challenge;
}

// --- CBOR mínimo (lo justo para attestationObject y la clave COSE) ---
function cbor(buf, o = { p: 0 }) {
  const ib = buf[o.p++];
  const mt = ib >> 5;
  const ai = ib & 31;
  let val;
  if (ai < 24) val = ai;
  else if (ai === 24) val = buf[o.p++];
  else if (ai === 25) { val = buf.readUInt16BE(o.p); o.p += 2; }
  else if (ai === 26) { val = buf.readUInt32BE(o.p); o.p += 4; }
  else throw new Error('CBOR no soportado');
  switch (mt) {
    case 0: return val;
    case 1: return -1 - val;
    case 2: { const b = buf.subarray(o.p, o.p + val); o.p += val; return b; }
    case 3: { const t = buf.subarray(o.p, o.p + val).toString('utf8'); o.p += val; return t; }
    case 4: { const arr = []; for (let i = 0; i < val; i++) arr.push(cbor(buf, o)); return arr; }
    case 5: { const m = new Map(); for (let i = 0; i < val; i++) { const k = cbor(buf, o); m.set(k, cbor(buf, o)); } return m; }
    case 7: return ai === 20 ? false : ai === 21 ? true : null;
    default: throw new Error('CBOR no soportado');
  }
}

function leerAuthData(ad) {
  if (ad.length < 37) throw new Error('authData demasiado corto');
  const r = { rpIdHash: ad.subarray(0, 32), flags: ad[32], counter: ad.readUInt32BE(33) };
  if (r.flags & 0x40) {
    const len = ad.readUInt16BE(53);
    r.credentialId = ad.subarray(55, 55 + len);
    r.coseKey = cbor(ad, { p: 55 + len });
  }
  return r;
}

function comprobarComunes({ clientDataJSON, tipo, token, proposito, rpId, origins }) {
  const cd = JSON.parse(Buffer.from(clientDataJSON).toString('utf8'));
  if (cd.type !== tipo) throw new Error('Tipo de operación no válido');
  if (cd.challenge !== challengeDeToken(token, proposito)) throw new Error('Reto no coincide');
  if (!origins.includes(cd.origin)) throw new Error('Origen no permitido');
  return cd;
}

function comprobarAuthData(ad, rpId) {
  if (!ad.rpIdHash.equals(sha256(Buffer.from(rpId)))) throw new Error('Dominio (rpId) no coincide');
  if (!(ad.flags & 0x01)) throw new Error('Falta presencia de usuario');
  if (!(ad.flags & 0x04)) throw new Error('Falta verificación biométrica (UV)');
}

export function verificarRegistro({ attestationObject, clientDataJSON, token, rpId, origins }) {
  comprobarComunes({ clientDataJSON, tipo: 'webauthn.create', token, proposito: 'reg', rpId, origins });
  const att = cbor(Buffer.from(attestationObject));
  const ad = leerAuthData(att.get('authData'));
  comprobarAuthData(ad, rpId);
  if (!ad.credentialId || !ad.coseKey) throw new Error('No se recibió la credencial');
  if (ad.coseKey.get(3) !== -7 || ad.coseKey.get(1) !== 2) throw new Error('Algoritmo no soportado (se requiere ES256)');
  const jwk = { kty: 'EC', crv: 'P-256', x: ad.coseKey.get(-2).toString('base64url'), y: ad.coseKey.get(-3).toString('base64url') };
  crypto.createPublicKey({ key: jwk, format: 'jwk' }); // valida que la clave es correcta
  return { credentialId: ad.credentialId.toString('base64url'), publicKeyJwk: jwk, counter: ad.counter };
}

export function verificarLogin({ credencial, authenticatorData, clientDataJSON, signature, token, rpId, origins }) {
  comprobarComunes({ clientDataJSON, tipo: 'webauthn.get', token, proposito: 'login', rpId, origins });
  const adBuf = Buffer.from(authenticatorData);
  const ad = leerAuthData(adBuf);
  comprobarAuthData(ad, rpId);
  const datos = Buffer.concat([adBuf, sha256(Buffer.from(clientDataJSON))]);
  const clave = crypto.createPublicKey({ key: credencial.public_key_jwk, format: 'jwk' });
  const ok = crypto.verify('sha256', datos, { key: clave, dsaEncoding: 'der' }, Buffer.from(signature));
  if (!ok) throw new Error('Firma no válida');
  const previo = Number(credencial.counter || 0);
  if ((ad.counter !== 0 || previo !== 0) && ad.counter <= previo) throw new Error('Contador de credencial no válido (posible clonación)');
  return { counter: ad.counter };
}

export function contextoDeRequest(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const rpId = host.split(':')[0];
  const local = rpId === 'localhost';
  return { rpId, origins: [local ? `http://${host}` : `https://${host}`] };
}
