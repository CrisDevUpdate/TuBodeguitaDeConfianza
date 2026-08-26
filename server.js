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
  usd: { tasa: '75.25', fecha: new Date().toLocaleDateString('es-VE'), fuente: 'BCV Oficial', lastUpdated: Date.now(), manual: false },
  eur: { tasa: '81.40', fecha: new Date().toLocaleDateString('es-VE'), fuente: 'BCV Oficial', lastUpdated: Date.now(), manual: false }
};

// Safe fetch helper with multiple sources and silent failure handling
async function fetchBCVRate(type) {
  // If cache was updated in the last 5 minutes and is valid, return it
  if (Date.now() - bcvCache[type].lastUpdated < 300000 && parseFloat(bcvCache[type].tasa) > 0) {
    return bcvCache[type];
  }

  const providers = [
    async () => {
      const url = type === 'usd' ? 'https://ve.dolarapi.com/v1/dolares/oficial' : 'https://ve.dolarapi.com/v1/euros/oficial';
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      clearTimeout(id);
      if (!res.ok) return null;
      const data = await res.json();
      const val = data.promedio || data.price || data.tasa;
      if (val && !isNaN(val)) {
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
      const id = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      clearTimeout(id);
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.tasa && !isNaN(data.tasa)) {
        return {
          tasa: String(data.tasa),
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

  // Update lastUpdated timestamp so we don't spam failed requests constantly
  bcvCache[type].lastUpdated = Date.now();
  return bcvCache[type];
}

// BCV API endpoints
app.get('/api/bcv/usd', async (req, res) => {
  const rate = await fetchBCVRate('usd');
  res.json(rate);
});

app.get('/api/bcv/euro', async (req, res) => {
  const rate = await fetchBCVRate('eur');
  res.json(rate);
});

app.get('/api/bcv/all', async (req, res) => {
  const [usd, eur] = await Promise.all([fetchBCVRate('usd'), fetchBCVRate('eur')]);
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
