// Metro de Expo + proxy de /api hacia el backend local.
// Algunas redes Wi-Fi bloquean el puerto 8080 entre el celular y la computadora, pero dejan
// pasar el de Metro (8081). Con este proxy la app llama a la API por el mismo puerto de Metro.
const http = require('http');
const { getDefaultConfig } = require('expo/metro-config');

const BACKEND_PORT = Number(process.env.BACKEND_PORT) || 8080;

const config = getDefaultConfig(__dirname);
const previousEnhance = config.server?.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const base = previousEnhance ? previousEnhance(middleware, server) : middleware;
    return (req, res, next) => {
      if (!req.url.startsWith('/api/')) return base(req, res, next);

      // Sin Origin/Referer: para el backend es una llamada directa (evita el rechazo por CORS en la web)
      const { origin, referer, ...headers } = req.headers;
      const proxyReq = http.request(
        {
          host: '127.0.0.1',
          port: BACKEND_PORT,
          path: req.url,
          method: req.method,
          headers: { ...headers, host: `localhost:${BACKEND_PORT}` },
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
          proxyRes.pipe(res);
        },
      );
      proxyReq.on('error', () => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'El backend no está corriendo en la computadora.' }));
      });
      req.pipe(proxyReq);
    };
  },
};

module.exports = config;
