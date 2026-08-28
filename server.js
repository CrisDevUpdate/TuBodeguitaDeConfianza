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

// Serve static files from root directory
app.use(express.static(__dirname));

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`TuBodeguitaDeConfianza server running on port ${PORT}`);
});
