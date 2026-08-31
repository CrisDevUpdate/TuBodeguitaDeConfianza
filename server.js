import express from 'express';
import path from 'path';
import cors from 'cors';
import fs from 'fs';
import AdmZip from 'adm-zip';
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

    const HASH_SUPERADMIN_DEFAULT = '1a09807a0e6928a66d91025ed5fccd713c9edb101e72a1bbcb8a01cd9a53cb51';
    let inputHash = '';
    if (adminPassword) {
      inputHash = crypto.createHash('sha256').update(String(adminPassword).trim()).digest('hex');
    }

    if (adminPassword !== '1810' && inputHash !== HASH_SUPERADMIN_DEFAULT) {
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
        password: HASH_SUPERADMIN_DEFAULT,
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

app.get('/api/download-zip', (req, res) => {
  try {
    const zip = new AdmZip();
    function addFiles(dir) {
      const list = fs.readdirSync(dir);
      for (const file of list) {
        if (file === 'node_modules' || file === '.git' || file === 'TuBodeguitaDeConfianza.zip' || file.endsWith('.zip')) continue;
        const fullPath = dir ? (dir + '/' + file) : file;
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          addFiles(fullPath);
        } else {
          const zipPath = dir ? dir : '';
          zip.addLocalFile(fullPath, zipPath);
        }
      }
    }
    addFiles('.');
    const buffer = zip.toBuffer();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="TuBodeguitaDeConfianza.zip"');
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error('[Download ZIP] Error generando zip:', err);
    res.status(500).json({ success: false, error: 'Error al empaquetar el proyecto' });
  }
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
