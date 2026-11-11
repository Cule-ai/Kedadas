// Vercel Serverless Function: /api/send-push
// Envía notificaciones Web Push reales a los dispositivos suscritos (VAPID)

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@kedadas.app';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://idpgvtixeyytfgpkqjjm.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (VAPID_PRIVATE_KEY && VAPID_PUBLIC_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch(e) {
    console.error('Error inicializando VAPID:', e.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta (VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY requeridas en variables de entorno de Vercel).' });
  }

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Configuración del servidor incompleta (SUPABASE_SERVICE_ROLE_KEY requerida en variables de entorno de Vercel).' });
  }

  try {
    // 0. Verificación de Seguridad y Autorización
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const apiKey = req.headers['x-api-key'];

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Permitir si se proporciona la clave interna PUSH_API_SECRET o un token de sesión válido de Supabase
    const secretKey = process.env.PUSH_API_SECRET;
    const isApiKeyValid = secretKey && apiKey === secretKey;

    if (!isApiKeyValid) {
      if (!token) {
        return res.status(401).json({ error: 'No autorizado. Se requiere inicio de sesión para enviar notificaciones.' });
      }
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        return res.status(401).json({ error: 'Token de sesión no válido o expirado.' });
      }
    }
    const {
      title = 'Kedadas',
      body = '¡Nueva actividad o coincidencia en tu grupo!',
      icon = '/icono-192.png',
      url = '/',
      subscription = null,
      userId = null
    } = req.body || {};

    const payload = JSON.stringify({
      title,
      body,
      icon,
      data: { url }
    });

    // 1. Envío directo a una suscripción específica pasada en el body
    if (subscription && subscription.endpoint) {
      try {
        await webpush.sendNotification(subscription, payload);
        return res.status(200).json({ success: true, count: 1, message: 'Notificación enviada con éxito.' });
      } catch (err) {
        console.error('Error enviando notificación individual:', err);
        return res.status(500).json({ error: err.message });
      }
    }

    // 2. Envío a las suscripciones almacenadas en Supabase (filtradas por usuario si se especifica)
    if (!userId && !isApiKeyValid) {
      return res.status(400).json({ error: 'Debes especificar el destinatario (userId).' });
    }

    let query = supabase.from('push_subscriptions').select('*');
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: subs, error } = await query;
    if (error) {
      return res.status(500).json({ error: 'Error consultando push_subscriptions: ' + error.message });
    }

    if (!subs || subs.length === 0) {
      return res.status(200).json({ success: true, count: 0, message: 'No hay dispositivos suscritos.' });
    }

    let enviados = 0;
    const fallos = [];

    await Promise.all(
      subs.map(async (row) => {
        const pushSubscription = {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth
          }
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          enviados++;
        } catch (pushErr) {
          console.warn('Error al enviar a endpoint:', row.endpoint, pushErr.statusCode);
          // Si el endpoint ha caducado (410 Gone o 404 Not Found), eliminarlo de la base de datos
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', row.id);
          }
          fallos.push({ endpoint: row.endpoint, error: pushErr.message });
        }
      })
    );

    return res.status(200).json({
      success: true,
      count: enviados,
      total: subs.length,
      fallos: fallos.length
    });
  } catch (err) {
    console.error('Error general en send-push:', err);
    return res.status(500).json({ error: err.message });
  }
}
