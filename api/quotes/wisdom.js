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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000);
    const apiRes = await fetch('https://dummyjson.com/quotes/random', { signal: controller.signal });
    clearTimeout(id);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && data.quote) {
        return res.status(200).json({
          success: true,
          frase: data.quote,
          autor: data.author || 'Inspiración Diaria',
          fuente: 'DummyJSON Quotes API'
        });
      }
    }
  } catch {}

  const randomQuote = WISDOM_QUOTES[Math.floor(Math.random() * WISDOM_QUOTES.length)];
  return res.status(200).json({
    success: true,
    frase: randomQuote.frase,
    autor: randomQuote.autor,
    fuente: 'Bodeguita Wisdom Engine'
  });
}
