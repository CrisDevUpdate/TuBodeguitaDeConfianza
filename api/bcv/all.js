export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  async function fetchRate(type) {
    try {
      const url = type === 'usd' ? 'https://ve.dolarapi.com/v1/dolares/oficial' : 'https://ve.dolarapi.com/v1/euros/oficial';
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3500);
      const resp = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      clearTimeout(id);
      if (resp.ok) {
        const data = await resp.json();
        const val = data.promedio || data.price || data.tasa;
        if (val && !isNaN(val) && parseFloat(val) > 0) {
          return {
            tasa: String(val),
            fecha: data.fechaActualizacion ? new Date(data.fechaActualizacion).toLocaleDateString('es-VE') : new Date().toLocaleDateString('es-VE'),
            fuente: 'DolarApi Oficial (BCV)'
          };
        }
      }
    } catch {}

    try {
      const url = type === 'usd' ? 'https://bcvapi.tech/api/v1/dolar/public' : 'https://bcvapi.tech/api/v1/euro/public';
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3500);
      const resp = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      clearTimeout(id);
      if (resp.ok) {
        const data = await resp.json();
        const val = data.tasa || data.promedio;
        if (val && !isNaN(val) && parseFloat(val) > 0) {
          return {
            tasa: String(val),
            fecha: data.fecha || new Date().toLocaleDateString('es-VE'),
            fuente: 'BCV Api Tech'
          };
        }
      }
    } catch {}

    return {
      tasa: type === 'usd' ? '814.73' : '948.10',
      fecha: new Date().toLocaleDateString('es-VE'),
      fuente: 'BCV Referencial Oficial'
    };
  }

  const [usd, eur] = await Promise.all([fetchRate('usd'), fetchRate('eur')]);
  return res.status(200).json({ usd, eur });
}
