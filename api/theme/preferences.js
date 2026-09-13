/**
 * api/theme/preferences.js (Vercel Serverless Function & Standalone Handler)
 * MÓDULO 3: Motor de Temas y Personalización de Estilos (Admin Global vs. Cliente Individual)
 */

let globalThemeConfig = {
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
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  mode: 'light', // 'light' | 'dark'
  updatedAt: new Date().toISOString()
};

let userThemeOverrides = {};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const userId = req.query.userId || req.query.cedula;
    const userTheme = userId ? userThemeOverrides[userId] : null;

    return res.status(200).json({
      success: true,
      globalTheme: globalThemeConfig,
      userTheme: userTheme || null,
      effectiveTheme: userTheme || globalThemeConfig
    });
  }

  if (req.method === 'POST') {
    try {
      const { scope = 'user', userId, theme } = req.body || {};

      if (!theme || typeof theme !== 'object') {
        return res.status(400).json({ success: false, error: 'Objeto theme requerido.' });
      }

      if (scope === 'global') {
        // Admin modifica el tema global por defecto
        globalThemeConfig = {
          ...globalThemeConfig,
          ...theme,
          updatedAt: new Date().toISOString()
        };
        return res.status(200).json({
          success: true,
          scope: 'global',
          message: 'Tema global del sistema actualizado exitosamente.',
          globalTheme: globalThemeConfig
        });
      } else {
        // Cliente modifica su tema individual (aislado)
        if (!userId) {
          return res.status(400).json({ success: false, error: 'userId es requerido para guardar preferencia individual de cliente.' });
        }
        userThemeOverrides[userId] = {
          ...theme,
          userId,
          updatedAt: new Date().toISOString()
        };
        return res.status(200).json({
          success: true,
          scope: 'user',
          userId,
          message: 'Preferencia de tema individual guardada exitosamente.',
          userTheme: userThemeOverrides[userId]
        });
      }
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Método no permitido.' });
}
