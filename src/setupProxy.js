// src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://YOUR-BACKEND-BASE-URL', // <-- replace this with your backend URL
      changeOrigin: true,
    })
  );
};
