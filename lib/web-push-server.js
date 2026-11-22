import crypto from 'crypto';
import * as webpushMod from 'web-push';

const webpush = webpushMod.default || webpushMod;

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/tubodeguitadeconfianza/databases/(default)/documents';
const DEFAULT_VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:soporte@tubodeguitadeconfianza.com';

let cachedVapidKeys = null;

function hashEndpoint(endpoint) {
  return 'sub_' + crypto.createHash('sha256').update(String(endpoint || '')).digest('hex').slice(0, 32);
}

function isValidVapidKeyPair(publicKey, privateKey) {
  if (!publicKey || !privateKey || typeof publicKey !== 'string' || typeof privateKey !== 'string') {
    return false;
  }
  try {
    const pubClean = publicKey.trim().replace(/-/g, '+').replace(/_/g, '/');
    const privClean = privateKey.trim().replace(/-/g, '+').replace(/_/g, '/');
    const pubBuf = Buffer.from(pubClean, 'base64');
    const privBuf = Buffer.from(privClean, 'base64');
    // Uncompressed ECDSA P-256 public key = 65 bytes starting with 0x04; private key = 32 bytes
    return pubBuf.length === 65 && pubBuf[0] === 0x04 && privBuf.length === 32;
  } catch {
    return false;
  }
}

/**
 * Obtiene (o inicializa una única vez) el par de claves VAPID para Web Push.
 * Prioridad: variables de entorno válidas -> documento persistente en Firestore (config/web_push_vapid) -> generación automática.
 * De este modo Express local y Vercel Serverless comparten exactamente las mismas claves VAPID.
 */
export async function getVapidKeys() {
  if (isValidVapidKeyPair(process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)) {
    cachedVapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY.trim(),
      privateKey: process.env.VAPID_PRIVATE_KEY.trim(),
      subject: DEFAULT_VAPID_SUBJECT
    };
    return cachedVapidKeys;
  }

  if (cachedVapidKeys && isValidVapidKeyPair(cachedVapidKeys.publicKey, cachedVapidKeys.privateKey)) {
    return cachedVapidKeys;
  }

  // 1. Intentar leer desde Firestore config/web_push_vapid
  try {
    const res = await fetch(`${FIRESTORE_BASE}/config/web_push_vapid`);
    if (res.ok) {
      const doc = await res.json();
      const pub = doc?.fields?.publicKey?.stringValue || '';
      const priv = doc?.fields?.privateKey?.stringValue || '';
      const subj = doc?.fields?.subject?.stringValue || DEFAULT_VAPID_SUBJECT;
      if (pub && priv) {
        cachedVapidKeys = { publicKey: pub, privateKey: priv, subject: subj };
        return cachedVapidKeys;
      }
    }
  } catch (err) {
    console.warn('[WebPush] Aviso leyendo claves VAPID desde Firestore:', err.message);
  }

  // 2. Generar par VAPID real y persistirlo en Firestore para consistencia entre despliegues
  const generated = webpush.generateVAPIDKeys();
  const payload = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject: DEFAULT_VAPID_SUBJECT
  };

  try {
    await fetch(`${FIRESTORE_BASE}/config/web_push_vapid`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          publicKey: { stringValue: payload.publicKey },
          privateKey: { stringValue: payload.privateKey },
          subject: { stringValue: payload.subject },
          createdAt: { stringValue: new Date().toISOString() }
        }
      })
    });
  } catch (saveErr) {
    console.warn('[WebPush] Aviso guardando claves VAPID en Firestore:', saveErr.message);
  }

  cachedVapidKeys = payload;
  return cachedVapidKeys;
}

/**
 * Guarda o actualiza una suscripción Web Push en Firestore (`push_subscriptions/{subId}`).
 */
export async function savePushSubscription({ subscription, role, userId, cedula, nombre, userAgent }) {
  if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    throw new Error('Suscripción push inválida (faltan endpoint o claves criptográficas).');
  }

  const subId = hashEndpoint(subscription.endpoint);
  const normalizedRole = String(role || 'cliente').trim().toLowerCase();
  const roleClean = (normalizedRole === 'admin' || normalizedRole === 'superadmin') ? 'admin' : 'cliente';

  const res = await fetch(`${FIRESTORE_BASE}/push_subscriptions/${encodeURIComponent(subId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        subId: { stringValue: subId },
        endpoint: { stringValue: String(subscription.endpoint) },
        p256dh: { stringValue: String(subscription.keys.p256dh) },
        auth: { stringValue: String(subscription.keys.auth) },
        role: { stringValue: roleClean },
        userId: { stringValue: String(userId || '').trim().toLowerCase() },
        cedula: { stringValue: String(cedula || '').trim().toLowerCase() },
        nombre: { stringValue: String(nombre || '').trim() },
        userAgent: { stringValue: String(userAgent || '').slice(0, 180) },
        updatedAt: { stringValue: new Date().toISOString() }
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`No se pudo registrar la suscripción en Firestore (${res.status}): ${errText}`);
  }

  return { subId, role: roleClean };
}

/**
 * Elimina una suscripción Web Push de Firestore.
 */
export async function deletePushSubscription(endpoint) {
  if (!endpoint) return false;
  const subId = hashEndpoint(endpoint);
  try {
    await fetch(`${FIRESTORE_BASE}/push_subscriptions/${encodeURIComponent(subId)}`, {
      method: 'DELETE'
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Lista todas las suscripciones activas almacenadas en Firestore.
 */
async function listPushSubscriptions() {
  const subs = [];
  let pageToken = '';
  do {
    const url = `${FIRESTORE_BASE}/push_subscriptions?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    if (Array.isArray(data.documents)) {
      for (const doc of data.documents) {
        const f = doc.fields || {};
        const endpoint = f.endpoint?.stringValue || '';
        const p256dh = f.p256dh?.stringValue || '';
        const auth = f.auth?.stringValue || '';
        if (endpoint && p256dh && auth) {
          subs.push({
            subId: doc.name.split('/').pop(),
            endpoint,
            keys: { p256dh, auth },
            role: f.role?.stringValue || 'cliente',
            userId: f.userId?.stringValue || '',
            cedula: f.cedula?.stringValue || '',
            nombre: f.nombre?.stringValue || ''
          });
        }
      }
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return subs;
}

/**
 * Envía una notificación Push real vía Web Push Protocol (VAPID).
 * Soporta envío de prueba (`test: true` + `endpoint`), a todos los admins (`targetRole: 'admin'`),
 * a un cliente específico (`targetRole: 'cliente'` + `targetUserId`), o difusión masiva (`broadcast: true`).
 */
export async function sendWebPushNotification({
  title,
  body,
  tab = 'notificaciones',
  tag = 'bodeguita-push',
  url = '/',
  requireInteraction = false,
  targetRole = 'admin',
  targetUserId = '',
  targetNombre = '',
  broadcast = false,
  test = false,
  endpoint = ''
}) {
  const keys = await getVapidKeys();
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);

  const allSubs = await listPushSubscriptions();
  let recipients = [];

  if (test && endpoint) {
    recipients = allSubs.filter((s) => s.endpoint === endpoint);
  } else if (targetRole === 'admin') {
    recipients = allSubs.filter((s) => s.role === 'admin');
  } else if (targetRole === 'cliente') {
    if (broadcast) {
      recipients = allSubs.filter((s) => s.role === 'cliente');
    } else {
      const targetNorm = String(targetUserId || '').trim().toLowerCase();
      const targetNomNorm = String(targetNombre || '').trim().toLowerCase();
      recipients = allSubs.filter((s) => {
        if (s.role !== 'cliente') return false;
        if (targetNorm && (s.userId === targetNorm || s.cedula === targetNorm)) return true;
        if (targetNomNorm && s.nombre && s.nombre.toLowerCase() === targetNomNorm) return true;
        return false;
      });
    }
  }

  const notificationPayload = JSON.stringify({
    title: String(title || 'Tu Bodeguita de Confianza').slice(0, 100),
    body: String(body || 'Tienes una nueva actualización.').slice(0, 260),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: String(tag || 'bodeguita-push').slice(0, 60),
    tab: String(tab || 'notificaciones'),
    url: String(url || (tab ? `/?tab=${encodeURIComponent(tab)}` : '/')),
    requireInteraction: Boolean(requireInteraction)
  });

  let sent = 0;
  let removed = 0;
  const errors = [];

  await Promise.all(
    recipients.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          notificationPayload,
          { TTL: 86400 }
        );
        sent++;
      } catch (err) {
        const statusCode = err && err.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          removed++;
          await deletePushSubscription(sub.endpoint);
        } else {
          errors.push({ statusCode: statusCode || 500, message: err.message });
        }
      }
    })
  );

  return {
    totalMatched: recipients.length,
    sent,
    removed,
    errorsCount: errors.length
  };
}
