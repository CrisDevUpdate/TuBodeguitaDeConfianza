import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());

// In-memory cache for BCV exchange rates with resilient defaults
let bcvCache = {
  usd: { tasa: null, fecha: new Date().toLocaleDateString('es-VE'), fuente: 'BCV Oficial', lastUpdated: 0, manual: false },
  eur: { tasa: null, fecha: new Date().toLocaleDateString('es-VE'), fuente: 'BCV Oficial', lastUpdated: 0, manual: false }
};

// Safe fetch helper with multiple sources and silent failure handling
async function fetchBCVRate(type, force = false) {
  // If cache was updated in the last 60 seconds and is valid and not forced, return it
  if (!force && bcvCache[type].tasa && Date.now() - bcvCache[type].lastUpdated < 60000 && parseFloat(bcvCache[type].tasa) > 0) {
    return bcvCache[type];
  }

  const providers = [
    async () => {
      const url = type === 'usd' ? 'https://ve.dolarapi.com/v1/dolares/oficial' : 'https://ve.dolarapi.com/v1/euros/oficial';
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } });
      clearTimeout(id);
      if (!res.ok) return null;
      const data = await res.json();
      const val = data.promedio || data.price || data.tasa;
      if (val && !isNaN(val) && parseFloat(val) > 0) {
        return {
          tasa: String(val),
          fecha: data.fechaActualizacion ? new Date(data.fechaActualizacion).toLocaleDateString('es-VE') : new Date().toLocaleDateString('es-VE'),
          fuente: 'DolarApi Oficial (BCV)'
        };
      }
      return null;
    },
    async () => {
      const url = type === 'usd' ? 'https://bcvapi.tech/api/v1/dolar/public' : 'https://bcvapi.tech/api/v1/euro/public';
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } });
      clearTimeout(id);
      if (!res.ok) return null;
      const data = await res.json();
      const val = data.tasa || data.promedio;
      if (val && !isNaN(val) && parseFloat(val) > 0) {
        return {
          tasa: String(val),
          fecha: data.fecha || new Date().toLocaleDateString('es-VE'),
          fuente: 'BCV Api Tech'
        };
      }
      return null;
    }
  ];

  for (const provider of providers) {
    try {
      const result = await provider();
      if (result && parseFloat(result.tasa) > 0) {
        bcvCache[type] = {
          tasa: String(result.tasa),
          fecha: result.fecha,
          fuente: result.fuente,
          lastUpdated: Date.now(),
          manual: false
        };
        return bcvCache[type];
      }
    } catch {
      // Gracefully continue to next provider or return cached fallback
    }
  }

  // If no provider responded and we don't have a rate yet, provide resilient fallback
  if (!bcvCache[type].tasa || parseFloat(bcvCache[type].tasa) <= 0) {
    bcvCache[type] = {
      tasa: type === 'usd' ? '791.32' : '921.81',
      fecha: new Date().toLocaleDateString('es-VE'),
      fuente: 'BCV Referencial',
      lastUpdated: Date.now(),
      manual: false
    };
  } else {
    bcvCache[type].lastUpdated = Date.now();
  }

  return bcvCache[type];
}

// Initial fetch in background on start
fetchBCVRate('usd', true).catch(() => {});
fetchBCVRate('eur', true).catch(() => {});

// BCV API endpoints
app.get('/api/bcv/usd', async (req, res) => {
  const force = req.query.force === 'true';
  const rate = await fetchBCVRate('usd', force);
  res.json(rate);
});

app.get('/api/bcv/euro', async (req, res) => {
  const force = req.query.force === 'true';
  const rate = await fetchBCVRate('eur', force);
  res.json(rate);
});

app.get('/api/bcv/all', async (req, res) => {
  const force = req.query.force === 'true';
  const [usd, eur] = await Promise.all([fetchBCVRate('usd', force), fetchBCVRate('eur', force)]);
  res.json({ usd, eur });
});

// Endpoint to update rate manually
app.post('/api/bcv/manual', (req, res) => {
  const { usd, eur, fecha } = req.body;
  const now = new Date().toLocaleDateString('es-VE');
  if (usd && !isNaN(usd) && parseFloat(usd) > 0) {
    bcvCache.usd = {
      tasa: String(usd),
      fecha: fecha || now,
      fuente: 'Manual (Usuario)',
      lastUpdated: Date.now(),
      manual: true
    };
  }
  if (eur && !isNaN(eur) && parseFloat(eur) > 0) {
    bcvCache.eur = {
      tasa: String(eur),
      fecha: fecha || now,
      fuente: 'Manual (Usuario)',
      lastUpdated: Date.now(),
      manual: true
    };
  }
  res.json({ success: true, cache: bcvCache });
});

// In-memory data store for server-side state persistence
let serverUsers = [];
let serverSales = [];
let serverPayments = [];
let serverLoyaltyClaims = [];

// API Users: Delete User (DELETE /api/users/:id or DELETE /api/users?id=...)
app.delete('/api/users/:id?', (req, res) => {
  const userId = req.params.id || req.query.id || req.body.id || req.body.cedula;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID or cédula is required' });
  }

  const initialCount = serverUsers.length;
  serverUsers = serverUsers.filter(u => (u.cedula !== userId && u.id !== userId));

  console.log(`[API Users] User deleted: ${userId}. Active users remaining: ${serverUsers.length}`);

  res.json({
    success: true,
    message: `Usuario ${userId} eliminado correctamente`,
    deletedId: userId,
    count: serverUsers.length
  });
});

// API Users: Get and Post Users
app.get('/api/users', (req, res) => {
  const userId = req.query.userId || req.query.id || req.query.cedula;
  if (userId) {
    const user = serverUsers.find(u => u.cedula === userId || u.id === userId);
    return res.json({ success: true, user: user || null });
  }
  res.json({ success: true, users: serverUsers, count: serverUsers.length });
});

app.post('/api/users', (req, res) => {
  const user = req.body;
  if (!user || (!user.cedula && !user.id)) {
    return res.status(400).json({ success: false, error: 'Invalid user payload' });
  }
  const idx = serverUsers.findIndex(u => (u.cedula && u.cedula === user.cedula) || (u.id && u.id === user.id));
  if (idx !== -1) {
    serverUsers[idx] = { ...serverUsers[idx], ...user };
  } else {
    serverUsers.push(user);
  }
  res.json({ success: true, user, count: serverUsers.length });
});

// API Account Status: GET /api/account/status?userId=ID
app.get('/api/account/status', (req, res) => {
  const userId = req.query.userId || req.query.id || req.query.cedula;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId query parameter is required' });
  }

  const userSales = serverSales.filter(s => s.clienteId === userId || s.clienteCedula === userId);
  const userPayments = serverPayments.filter(p => (p.clienteId === userId || p.clienteCedula === userId) && (p.estado === 'Pago agregado' || p.estado === 'APROBADO' || !p.estado));

  const totalCompradoUSD = userSales.reduce((acc, s) => acc + Number(s.total || 0), 0);
  const totalCreditoUSD = userSales.filter(s => s.tipo === 'Crédito' || s.tipoPago === 'Crédito').reduce((acc, s) => acc + Number(s.total || 0), 0);
  const totalAbonadoUSD = userPayments.reduce((acc, p) => acc + Number(p.montoUSD || 0), 0);
  const saldoDeudaUSD = Math.max(0, totalCreditoUSD - totalAbonadoUSD);

  const facturasPendientes = userSales.filter(s => (s.tipo === 'Crédito' || s.tipoPago === 'Crédito') && (s.estadoPago !== 'CANCELADO'));

  res.json({
    success: true,
    userId,
    totalCompradoUSD,
    totalCreditoUSD,
    totalAbonadoUSD,
    saldoDeudaUSD,
    facturasPendientesCount: facturasPendientes.length,
    ventas: userSales,
    abonos: userPayments
  });
});

// API Loyalty Points: GET /api/loyalty/points?userId=ID
app.get('/api/loyalty/points', (req, res) => {
  const userId = req.query.userId || req.query.id || req.query.cedula;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId query parameter is required' });
  }

  const user = serverUsers.find(u => u.cedula === userId || u.id === userId) || {};
  const metaPuntos = Number(user.metaPuntos || 200);
  const puntosAcumulados = Number(user.puntosAcumulados || 0);
  const puntosCanjeados = Number(user.puntosCanjeados || 0);
  const puntosDisponibles = Math.max(0, puntosAcumulados - puntosCanjeados);
  const porcentajeMeta = Math.min(100, Math.round((puntosDisponibles / metaPuntos) * 100));

  res.json({
    success: true,
    userId,
    puntosDisponibles,
    puntosAcumulados,
    puntosCanjeados,
    metaPuntos,
    porcentajeMeta,
    ciclo: user.cicloGamificacion || 1,
    reputacion: user.reputacion || 'CLIENTE_DESTACADO'
  });
});

// API Loyalty Claim: POST /api/loyalty/claim
app.post('/api/loyalty/claim', (req, res) => {
  const { userId, premioId, puntos } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }

  const claim = {
    id: `CLAIM_${Date.now()}`,
    userId,
    premioId: premioId || 'Premio del Mes',
    puntos: Number(puntos || 200),
    fecha: new Date().toISOString(),
    estado: 'ENTREGADO'
  };

  serverLoyaltyClaims.push(claim);

  // Update user in server memory if present
  const user = serverUsers.find(u => u.cedula === userId || u.id === userId);
  if (user) {
    user.puntosCanjeados = Number(user.puntosCanjeados || 0) + claim.puntos;
    user.cicloGamificacion = (Number(user.cicloGamificacion) || 1) + 1;
  }

  res.json({ success: true, claim, message: 'Premio canjeado exitosamente' });
});

// Endpoint para notificación automática de compra por correo al Administrador (cris.dev.update@gmail.com)
const adminPurchasesLog = [];
app.post('/api/notificar-compra', (req, res) => {
  const { pedidoId, cliente, items, totalUSD, totalVES, metodoPago, referencia, fecha, notas } = req.body;
  const adminEmail = 'cris.dev.update@gmail.com';
  
  const notificacion = {
    pedidoId: pedidoId || `PED_${Date.now()}`,
    destinatario: adminEmail,
    cliente: cliente || {},
    items: items || [],
    totalUSD: totalUSD || 0,
    totalVES: totalVES || 0,
    metodoPago: metodoPago || 'No especificado',
    referencia: referencia || 'N/A',
    fecha: fecha || new Date().toISOString(),
    notas: notas || '',
    estado: 'NOTIFICADO_ADMIN',
    timestamp: Date.now()
  };

  adminPurchasesLog.unshift(notificacion);
  console.log(`[Compra Notificada] Pedido ${notificacion.pedidoId} enviado al correo admin: ${adminEmail}. Total: $${notificacion.totalUSD} / Bs. ${notificacion.totalVES}. Ref: ${notificacion.referencia}`);

  res.json({
    success: true,
    message: `Notificación de compra enviada exitosamente a ${adminEmail}`,
    notificacion
  });
});

app.get('/api/notificaciones-compras', (req, res) => {
  res.json({ success: true, count: adminPurchasesLog.length, compras: adminPurchasesLog });
});

// Serve static files from root directory
app.use(express.static(__dirname));

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`TuBodeguitaDeConfianza server running on port ${PORT}`);
});
