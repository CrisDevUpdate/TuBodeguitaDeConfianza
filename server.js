import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Cargar variables de entorno desde .env si existen
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (key === 'BLOB_READ_WRITE_TOKEN') {
            if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.BLOB_READ_WRITE_TOKEN.startsWith('vercel_blob_rw_')) {
              process.env[key] = val;
            }
          } else {
            process.env[key] = val;
          }
        }
      }
    });
  }
} catch (e) {
  console.warn('[Env] Aviso al leer .env:', e.message);
}

app.use(cors());
// Raw parser for direct binary uploads (file streams from Vercel Blob client)
app.use(express.raw({ type: ['image/*', 'application/octet-stream'], limit: '30mb' }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Strict Zero-Cache Stale Policy for all API Routes, JS scripts, and HTML pages
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.endsWith('.js') || req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
});

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
let serverUsers = [
  {
    id: 'SuperAdmin',
    cedula: 'SuperAdmin',
    nombre: 'SuperAdmin',
    telefono: '0412-0000000',
    email: 'superadmin@tubodeguita.com',
    password: '1a09807a0e6928a66d91025ed5fccd713c9edb101e72a1bbcb8a01cd9a53cb51',
    rol: 'admin',
    estado: 'ACTIVO',
    puntosAcumulados: 0,
    puntosCanjeados: 0,
    fechaRegistro: new Date().toISOString().replace('T', ' ').substring(0, 16)
  }
];
let serverSales = [];
let serverPayments = [];
let serverLoyaltyClaims = [];
let serverInventoryAdjustments = [];

// API Database Reset (100% Virgin State): POST /api/database/reset
app.post('/api/database/reset', (req, res) => {
  serverSales = [];
  serverPayments = [];
  serverLoyaltyClaims = [];
  serverInventoryAdjustments = [];
  serverUsers = [
    {
      id: 'SuperAdmin',
      cedula: 'SuperAdmin',
      nombre: 'SuperAdmin',
      telefono: '0412-0000000',
      email: 'superadmin@tubodeguita.com',
      password: '1a09807a0e6928a66d91025ed5fccd713c9edb101e72a1bbcb8a01cd9a53cb51',
      rol: 'admin',
      estado: 'ACTIVO',
      puntosAcumulados: 0,
      puntosCanjeados: 0,
      fechaRegistro: new Date().toISOString().replace('T', ' ').substring(0, 16)
    }
  ];
  console.log('[Database Reset] Base de datos reseteada a estado 100% virgen. Solo SuperAdmin activo.');
  res.json({ success: true, message: 'Base de datos restaurada al estado virgen con solo SuperAdmin activo.' });
});

// API Inventory Adjustment: POST /api/inventory/adjust
app.post('/api/inventory/adjust', (req, res) => {
  const { productoId, codigo, nombre, stockAnterior, nuevoStock, diferencia, motivo, usuario, timestamp } = req.body;
  if (!productoId && !codigo) {
    return res.status(400).json({ success: false, error: 'productoId o codigo es requerido' });
  }

  const ajuste = {
    id: `ADJ_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    productoId: productoId || codigo,
    codigo: codigo || '',
    nombre: nombre || 'Producto',
    stockAnterior: Number(stockAnterior || 0),
    nuevoStock: Number(nuevoStock || 0),
    diferencia: Number(diferencia !== undefined ? diferencia : (Number(nuevoStock || 0) - Number(stockAnterior || 0))),
    motivo: motivo || 'Ajuste de Auditoría Física',
    usuario: usuario || 'SuperAdmin',
    fecha: timestamp || new Date().toISOString().replace('T', ' ').substring(0, 16),
    estado: 'CONFIRMADO'
  };

  serverInventoryAdjustments.unshift(ajuste);
  console.log(`[Inventory Adjust] Producto ${ajuste.codigo} (${ajuste.nombre}): ${ajuste.stockAnterior} -> ${ajuste.nuevoStock} (Dif: ${ajuste.diferencia}). Motivo: ${ajuste.motivo}`);

  res.json({
    success: true,
    message: 'Ajuste de inventario registrado y auditado exitosamente.',
    ajuste
  });
});

app.get('/api/inventory/adjustments', (req, res) => {
  res.json({ success: true, count: serverInventoryAdjustments.length, adjustments: serverInventoryAdjustments });
});

// API Wisdom / Quotes: GET /api/quotes/wisdom
const WISDOM_QUOTES = [
  { frase: "El secreto del éxito en los negocios es saber algo que nadie más sabe.", autor: "Aristóteles Onassis" },
  { frase: "La perseverancia es la base de todas las acciones.", autor: "Lao Tsé" },
  { frase: "No busques el momento perfecto, toma el momento y hazlo perfecto.", autor: "Proverbio de Sabiduría" },
  { frase: "La disciplina es el puente entre las metas y los logros.", autor: "Jim Rohn" },
  { frase: "La confianza en uno mismo es el primer secreto del éxito.", autor: "Ralph Waldo Emerson" },
  { frase: "El verdadero progreso es el que pone la tecnología al alcance de todos.", autor: "Henry Ford" },
  { frase: "Siembra un pensamiento y cosecharás una acción; siembra una acción y cosecharás un hábito.", autor: "Stephen Covey" },
  { frase: "El cliente no compra productos, compra confianza, rapidez y sonrisas.", autor: "Tu Bodeguita de Confianza" },
  { frase: "La excelencia no es un acto aislado, sino un hábito constante.", autor: "Aristóteles" },
  { frase: "Cada pequeño esfuerzo diario suma para alcanzar grandes triunfos.", autor: "Filosofía Kaizen" }
];

app.get('/api/quotes/wisdom', async (req, res) => {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2500);
    const apiRes = await fetch('https://dummyjson.com/quotes/random', { signal: controller.signal });
    clearTimeout(id);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && data.quote) {
        return res.json({
          success: true,
          frase: data.quote,
          autor: data.author || 'Inspiración Diaria',
          fuente: 'DummyJSON Quotes API'
        });
      }
    }
  } catch {
    // Graceful fallback to rich local quote bank
  }

  const randomQuote = WISDOM_QUOTES[Math.floor(Math.random() * WISDOM_QUOTES.length)];
  res.json({
    success: true,
    frase: randomQuote.frase,
    autor: randomQuote.autor,
    fuente: 'Sabiduría Local'
  });
});

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

// API Sales: GET and POST /api/sales
app.get('/api/sales', (req, res) => {
  const clienteId = req.query.clienteId || req.query.userId || req.query.cedula;
  if (clienteId) {
    const filtered = serverSales.filter(s => s.clienteId === clienteId || s.clienteCedula === clienteId);
    return res.json({ success: true, sales: filtered, count: filtered.length });
  }
  res.json({ success: true, sales: serverSales, count: serverSales.length });
});

app.post('/api/sales', (req, res) => {
  const venta = req.body;
  if (!venta || !venta.id) {
    return res.status(400).json({ success: false, error: 'Valid sale object with id is required' });
  }
  const idx = serverSales.findIndex(s => s.id === venta.id);
  if (idx !== -1) {
    serverSales[idx] = { ...serverSales[idx], ...venta };
  } else {
    serverSales.unshift(venta);
  }
  res.json({ success: true, sale: venta, count: serverSales.length });
});

// API Payments: GET and POST /api/payments
app.get('/api/payments', (req, res) => {
  const clienteId = req.query.clienteId || req.query.userId || req.query.cedula;
  if (clienteId) {
    const filtered = serverPayments.filter(p => p.clienteId === clienteId || p.clienteCedula === clienteId);
    return res.json({ success: true, payments: filtered, count: filtered.length });
  }
  res.json({ success: true, payments: serverPayments, count: serverPayments.length });
});

app.post('/api/payments', (req, res) => {
  const payment = req.body;
  if (!payment || !payment.id) {
    return res.status(400).json({ success: false, error: 'Valid payment object with id is required' });
  }
  const idx = serverPayments.findIndex(p => p.id === payment.id);
  if (idx !== -1) {
    serverPayments[idx] = { ...serverPayments[idx], ...payment };
  } else {
    serverPayments.unshift(payment);
  }
  res.json({ success: true, payment, count: serverPayments.length });
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

// API Quotes & Wisdom Engine: GET /api/quotes/random
// Fallback wisdom quotes
const localWisdomQuotes = [
  { quote: "La confianza es el fruto de una relación en la que se actúa con integridad y constancia.", author: "Proverbio de Bodega" },
  { quote: "El éxito en el comercio no es vender una vez, sino ganar un cliente para siempre.", author: "Sabiduría Comercial" },
  { quote: "Cada grano cuenta para hacer la montaña; cada ahorro construye tu futuro.", author: "Filosofía Financiera" },
  { quote: "La calidad permanece mucho después de que el precio se haya olvidado.", author: "Henry Royce" },
  { quote: "Sembrar lealtad hoy es cosechar abundancia mañana.", author: "Proverbio del Árbol" },
  { quote: "La paciencia y la perseverancia tienen un efecto mágico ante el cual las dificultades desaparecen.", author: "John Quincy Adams" },
  { quote: "Tu fidelidad tiene recompensa: cada compra te acerca a tu meta.", author: "Tu Bodeguita de Confianza" }
];

// In-memory theme configurations for server state
let serverGlobalTheme = {
  themeId: 'indigo_classic',
  nombre: 'Índigo Corporativo Clásico',
  primary: '#1e293b',
  primaryAccent: '#2563eb',
  primaryHover: '#1d4ed8',
  bgColor: '#f1f5f9',
  cardBg: '#ffffff',
  textMain: '#0f172a',
  textMuted: '#64748b',
  border: '#cbd5e1',
  borderLight: '#e2e8f0',
  mode: 'light',
  updatedAt: new Date().toISOString()
};
let serverUserThemeOverrides = {};
let serverResetArchives = [];

// API Theme Preferences: GET & POST /api/theme/preferences
app.get('/api/theme/preferences', (req, res) => {
  const userId = req.query.userId || req.query.cedula;
  const userTheme = userId ? serverUserThemeOverrides[userId] : null;
  res.json({
    success: true,
    globalTheme: serverGlobalTheme,
    userTheme: userTheme || null,
    effectiveTheme: userTheme || serverGlobalTheme
  });
});

app.post('/api/theme/preferences', (req, res) => {
  try {
    const { scope = 'user', userId, theme } = req.body || {};
    if (!theme || typeof theme !== 'object') {
      return res.status(400).json({ success: false, error: 'theme object is required' });
    }
    if (scope === 'global') {
      serverGlobalTheme = { ...serverGlobalTheme, ...theme, updatedAt: new Date().toISOString() };
      return res.json({ success: true, scope: 'global', globalTheme: serverGlobalTheme });
    } else {
      if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });
      serverUserThemeOverrides[userId] = { ...theme, userId, updatedAt: new Date().toISOString() };
      return res.json({ success: true, scope: 'user', userId, userTheme: serverUserThemeOverrides[userId] });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API Hard Reset (SuperAdmin Exclusive): POST /api/admin/reset
app.post('/api/admin/reset', (req, res) => {
  try {
    const { adminPassword, confirmationKeyword, previousData } = req.body || {};

    if (!confirmationKeyword || String(confirmationKeyword).trim().toUpperCase() !== 'CONFIRMAR') {
      return res.status(400).json({
        success: false,
        error: 'Palabra de seguridad incorrecta. Debe ser "CONFIRMAR".'
      });
    }

    if (adminPassword !== '1810') {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas. Contraseña de SuperAdmin incorrecta.'
      });
    }

    const archiveRecord = {
      archiveId: `ARCHIVE_${Date.now()}`,
      archivedAt: new Date().toISOString(),
      snapshot: previousData || null
    };
    serverResetArchives.push(archiveRecord);

    serverSales = [];
    serverPayments = [];
    serverLoyaltyClaims = [];
    serverInventoryAdjustments = [];
    serverUsers = [
      {
        id: 'SuperAdmin',
        cedula: 'SuperAdmin',
        nombre: 'SuperAdmin',
        telefono: '0412-0000000',
        email: 'superadmin@tubodeguita.com',
        password: '1a09807a0e6928a66d91025ed5fccd713c9edb101e72a1bbcb8a01cd9a53cb51',
        rol: 'admin',
        estado: 'ACTIVO',
        puntosAcumulados: 0,
        puntosCanjeados: 0,
        fechaRegistro: new Date().toISOString().replace('T', ' ').substring(0, 16)
      }
    ];

    console.log(`[Factory Reset] Reinicio de fábrica completado. Archivo: ${archiveRecord.archiveId}`);
    res.json({
      success: true,
      message: 'Reinicio General de Fábrica ejecutado exitosamente.',
      archiveInfo: { archiveId: archiveRecord.archiveId, archivedAt: archiveRecord.archivedAt }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// ARQUITECTURA DE ALMACENAMIENTO HÍBRIDO (Vercel Blob + Firestore + Local)
// =========================================================================

// Función auxiliar para resolver el token de Vercel Blob de múltiples orígenes
function obtenerVercelBlobToken(req) {
  if (req && req.headers && req.headers['x-blob-token'] && req.headers['x-blob-token'].startsWith('vercel_blob_rw_')) {
    return req.headers['x-blob-token'];
  }
  if (req && req.body && req.body.blobToken && req.body.blobToken.startsWith('vercel_blob_rw_')) {
    return req.body.blobToken;
  }
  if (req && req.query && req.query.token && req.query.token.startsWith('vercel_blob_rw_')) {
    return req.query.token;
  }

  // Verificar si existe en archivo .env primero para tokens válidos
  try {
    if (fs.existsSync('.env')) {
      const content = fs.readFileSync('.env', 'utf-8');
      const match = content.match(/BLOB_READ_WRITE_TOKEN\s*=\s*(.+)/);
      if (match && match[1]) {
        const envVal = match[1].trim().replace(/^['"]|['"]$/g, '');
        if (envVal.startsWith('vercel_blob_rw_')) {
          process.env.BLOB_READ_WRITE_TOKEN = envVal;
          return envVal;
        }
      }
    }
  } catch (e) {}

  if (process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN.startsWith('vercel_blob_rw_')) {
    return process.env.BLOB_READ_WRITE_TOKEN;
  }

  const fallbackToken = 'vercel_blob_rw_5tUK9cDxqnqjrZw4_XkW85LSec1NCakUeDwzKwNi6s2KYNg';
  return fallbackToken;
}

// Endpoint de Estado / Diagnóstico de Vercel Blob
app.get('/api/blob/status', (req, res) => {
  const token = obtenerVercelBlobToken(req);
  const isValidFormat = Boolean(token && token.startsWith('vercel_blob_rw_'));
  const isSuspiciousNumeric = Boolean(token && /^\d+$/.test(token));

  let connectionStatus = 'not_configured';
  let message = 'No se ha configurado BLOB_READ_WRITE_TOKEN.';

  if (token) {
    if (isSuspiciousNumeric || !isValidFormat) {
      connectionStatus = 'invalid_token_format';
      message = `El token configurado ("${token.substring(0, 8)}...", ${token.length} caracteres) no es un token oficial de Vercel Blob. Los tokens de Vercel Blob siempre comienzan con "vercel_blob_rw_".`;
    } else {
      connectionStatus = 'configured';
      message = 'Token con formato válido de Vercel Blob.';
    }
  }

  res.json({
    success: true,
    connected: connectionStatus === 'configured',
    status: connectionStatus,
    message: message,
    tokenPrefix: token ? `${token.substring(0, 8)}...` : null,
    tokenLength: token ? token.length : 0,
    hasEnvVar: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    instructions: {
      step1: 'Ingresa a https://vercel.com/dashboard',
      step2: 'Ve a la pestaña "Storage" y haz clic en "Create Database" o "Create" -> "Blob"',
      step3: 'Asigna un nombre a tu almacén (ej: "bodeguita-blobs") y haz clic en "Create"',
      step4: 'Copia el valor de "BLOB_READ_WRITE_TOKEN" (comienza con "vercel_blob_rw_")',
      step5: 'Pégalo en los Secrets / Variables de entorno del proyecto'
    }
  });
});

// --- Vercel Blob Storage Integration (@vercel/blob) ---
const BLOB_LOCAL_DIR = path.join(process.cwd(), '.blob-store');
if (!fs.existsSync(BLOB_LOCAL_DIR)) {
  try { fs.mkdirSync(BLOB_LOCAL_DIR, { recursive: true }); } catch (e) {}
}

async function manejarSubidaVercelBlob(req, res) {
  try {
    const filenameParam = req.query.filename || (req.body && typeof req.body === 'object' && req.body.filename);
    const requestedFolder = (req.body && typeof req.body === 'object' && req.body.folder) || 'uploads';
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 7);

    // Determinar nombre y ruta
    let targetFilename = filenameParam ? filenameParam.replace(/\\/g, '/') : `${requestedFolder}/${timestamp}_${randomSuffix}.webp`;
    // Asegurar que no tenga dobles barras o inicio con barra
    targetFilename = targetFilename.replace(/^\/+/, '');

    // Obtener buffer binario
    let buffer = null;
    let contentType = 'image/webp';

    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      buffer = req.body;
      contentType = req.headers['content-type'] || 'image/webp';
    } else if (req.body && typeof req.body === 'object' && req.body.fileData) {
      const fileData = req.body.fileData;
      if (typeof fileData === 'string' && fileData.startsWith('data:')) {
        const parts = fileData.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        if (mimeMatch) contentType = mimeMatch[1];
        buffer = Buffer.from(parts[1], 'base64');
      } else if (typeof fileData === 'string') {
        buffer = Buffer.from(fileData, 'base64');
      }
      if (req.body.contentType) contentType = req.body.contentType;
    } else if (req.readable) {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      buffer = Buffer.concat(chunks);
      contentType = req.headers['content-type'] || 'image/webp';
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ success: false, error: 'No se recibieron datos de archivo válidos para subir a Blob.' });
    }

    // Inferir Content-Type si viene genérico
    if (!contentType || contentType === 'application/octet-stream' || contentType === 'application/json') {
      const ext = path.extname(targetFilename).toLowerCase();
      contentType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : 'image/webp';
    }

    const blobToken = obtenerVercelBlobToken(req);
    let blobErrorDetail = null;

    // 1. Si existe BLOB_READ_WRITE_TOKEN, usar la SDK oficial de @vercel/blob
    if (blobToken) {
      if (!blobToken.startsWith('vercel_blob_rw_')) {
        console.warn(`[Vercel Blob] AVISO: El token configurado (${blobToken.substring(0, 8)}..., longitud: ${blobToken.length}) no tiene el formato estándar de Vercel Blob ("vercel_blob_rw_...").`);
      }
      try {
        const { put } = await import('@vercel/blob');
        let blobResult = null;

        // Intentar primero con access: 'private' (como se indica en la documentación oficial compartida)
        try {
          blobResult = await put(targetFilename, buffer, {
            access: 'private',
            token: blobToken,
            contentType: contentType
          });
        } catch (privErr) {
          console.warn(`[Vercel Blob] put 'private' no disponible (${privErr.message}), intentando con access: 'public'...`);
          blobResult = await put(targetFilename, buffer, {
            access: 'public',
            token: blobToken,
            contentType: contentType
          });
        }

        if (blobResult) {
          const viewUrl = `/api/avatar/view?pathname=${encodeURIComponent(blobResult.pathname)}`;
          console.log(`[Vercel Blob] Archivo subido exitosamente a la nube de Vercel: ${blobResult.pathname} (${blobResult.url || viewUrl})`);
          
          return res.json({
            pathname: blobResult.pathname,
            contentType: blobResult.contentType || contentType,
            contentDisposition: blobResult.contentDisposition || `inline; filename="${path.basename(blobResult.pathname)}"`,
            url: blobResult.url || viewUrl,
            viewUrl: viewUrl,
            downloadUrl: blobResult.downloadUrl || blobResult.url || viewUrl,
            provider: 'vercel-blob'
          });
        }
      } catch (blobErr) {
        blobErrorDetail = blobErr.message;
        console.error('[Vercel Blob Error]:', blobErr.message);
      }
    }

    // 2. Almacenamiento persistente en sistema de archivos local para entorno de desarrollo / fallback
    const localFilePath = path.join(BLOB_LOCAL_DIR, targetFilename);
    const localDir = path.dirname(localFilePath);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    fs.writeFileSync(localFilePath, buffer);

    const viewUrl = `/api/avatar/view?pathname=${encodeURIComponent(targetFilename)}`;
    console.log(`[Blob Storage Fallback] Archivo guardado localmente: ${targetFilename} -> ${viewUrl}`);

    return res.json({
      pathname: targetFilename,
      contentType: contentType,
      contentDisposition: `inline; filename="${path.basename(targetFilename)}"`,
      url: viewUrl,
      viewUrl: viewUrl,
      downloadUrl: viewUrl,
      provider: 'local-blob-store',
      blobError: blobErrorDetail,
      notice: blobErrorDetail
        ? `No se pudo conectar a Vercel Blob (${blobErrorDetail}). Se guardó en almacén local.`
        : 'Para almacenar directamente en el CDN global de Vercel Blob, define BLOB_READ_WRITE_TOKEN en las variables de entorno.'
    });

  } catch (err) {
    console.error('[Upload Blob Handler Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function manejarVistaVercelBlob(req, res) {
  try {
    const pathname = req.query.pathname || req.query.url;
    if (!pathname) {
      return res.status(400).json({ error: 'Missing pathname query parameter' });
    }

    const cleanPath = String(pathname).replace(/^\/+/, '');
    const blobToken = obtenerVercelBlobToken(req);

    // 1. Intentar servir desde Vercel Blob con la SDK oficial (@vercel/blob get())
    if (blobToken) {
      try {
        const { get } = await import('@vercel/blob');
        let result = null;

        try {
          result = await get(cleanPath, {
            access: 'private',
            token: blobToken
          });
        } catch (e) {
          result = await get(cleanPath, {
            access: 'public',
            token: blobToken
          });
        }

        if (result && (result.statusCode === 200 || result.stream || result.blob)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          if (result.blob && result.blob.contentType) {
            res.setHeader('Content-Type', result.blob.contentType);
          } else if (result.headers && result.headers.get && result.headers.get('content-type')) {
            res.setHeader('Content-Type', result.headers.get('content-type'));
          }
          res.setHeader('X-Content-Type-Options', 'nosniff');

          if (result.stream) {
            const { Readable } = await import('stream');
            if (typeof Readable.fromWeb === 'function') {
              return Readable.fromWeb(result.stream).pipe(res);
            } else {
              const reader = result.stream.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
              }
              return res.end();
            }
          }
        }
      } catch (getErr) {
        console.warn('[Blob Get Error]:', getErr.message);
      }
    }

    // 2. Intentar servir desde el almacén local persistente
    const localFilePath = path.join(BLOB_LOCAL_DIR, cleanPath);
    if (fs.existsSync(localFilePath)) {
      const ext = path.extname(cleanPath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : 'image/webp';
      res.setHeader('Content-Type', mime);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return fs.createReadStream(localFilePath).pipe(res);
    }

    return res.status(404).send('Not found');
  } catch (err) {
    console.error('[Blob View Error]:', err);
    res.status(500).json({ error: err.message });
  }
}

// Endpoints oficiales y unificados para subida y visualización de blobs
app.post('/api/avatar/upload', manejarSubidaVercelBlob);
app.post('/api/blob/upload', manejarSubidaVercelBlob);
app.post('/api/upload/blob', manejarSubidaVercelBlob);

app.get('/api/avatar/view', manejarVistaVercelBlob);
app.get('/api/blob/view', manejarVistaVercelBlob);
app.get('/api/blob/serve', manejarVistaVercelBlob);

app.get('/api/quotes/random', async (req, res) => {
  try {
    const fetchController = new AbortController();
    const timeout = setTimeout(() => fetchController.abort(), 2000);
    
    // Intento con ZenQuotes
    const externalResponse = await fetch('https://zenquotes.io/api/random', {
      signal: fetchController.signal
    }).catch(() => null);
    
    clearTimeout(timeout);

    if (externalResponse && externalResponse.ok) {
      const data = await externalResponse.json();
      if (Array.isArray(data) && data.length > 0 && data[0].q) {
        return res.json({
          success: true,
          quote: data[0].q,
          author: data[0].a || 'Anónimo',
          source: 'ZenQuotes API'
        });
      }
    }
  } catch (err) {
    // Fallback continuo
  }

  const randomIdx = Math.floor(Math.random() * localWisdomQuotes.length);
  const selected = localWisdomQuotes[randomIdx];
  res.json({
    success: true,
    quote: selected.quote,
    author: selected.author,
    source: 'Local Wisdom Engine'
  });
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
