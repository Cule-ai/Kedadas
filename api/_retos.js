import crypto from 'node:crypto';

export function ipDeRequest(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const list = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return list.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

export async function demasiadosFallos(db, ip) {
  const haceDiezMin = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count, error } = await db
    .from('passkey_fallos')
    .select('*', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', haceDiezMin);
  if (error) return false;
  return (count || 0) >= 10;
}

export async function registrarFallo(db, ip) {
  try {
    await db.from('passkey_fallos').insert({ ip });
  } catch (e) {}
}

export async function consumirReto(db, token) {
  if (!token) throw new Error('Reto no válido');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const { error } = await db.from('passkey_retos_usados').insert({ hash });
  if (error) {
    throw new Error('El reto ya ha sido utilizado o ha caducado');
  }
}
