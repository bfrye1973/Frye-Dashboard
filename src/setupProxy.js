// src/setupProxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: "https://frye-market-backend-1.onrender.com",
      changeOrigin: true,
      // DO NOT rewrite. We want /api/... -> /api/... on the backend
      // pathRewrite: { "^/api": "" },
      logLevel: "warn",
    })
  );
};
