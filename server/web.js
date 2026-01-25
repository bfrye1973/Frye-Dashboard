// server/web.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const API_TARGET =
  (process.env.API_TARGET || "https://frye-market-backend-1.onrender.com").trim();

/**
 * ✅ Proxy /api/* → backend /api/*
 * Our backend expects /api/health and /api/v1/*,
 * but the browser calls /api/health and /api/v1/* through this service.
 *
 * http-proxy-middleware removes the mount prefix (/api) by default.
 * So we add it back with pathRewrite.
 */
app.use(
  "/api",
  createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    secure: true,
    ws: true,
    logLevel: "warn",
    pathRewrite: (pathReq) => `/api${pathReq}`, // ✅ keep
  })
);

/**
 * ✅ Proxy /live/* → backend /live/*
 * Backend mounts GitHub JSON proxies at /live.
 * NO rewrite needed — we want /live/hourly to remain /live/hourly.
 */
app.use(
  "/live",
  createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    secure: true,
    ws: true,
    logLevel: "warn",
    // no pathRewrite
  })
);

// Serve CRA build
const buildDir = path.resolve(__dirname, "../build");
app.use(express.static(buildDir));

// SPA fallback (React Router)
app.get("*", (_req, res) => {
  res.sendFile(path.join(buildDir, "index.html"));
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[OK] Frye Dashboard Web listening on :${PORT}`);
  console.log(`- buildDir: ${buildDir}`);
  console.log(`- proxy /api  -> ${API_TARGET} (rewritten to /api + path)`);
  console.log(`- proxy /live -> ${API_TARGET} (no rewrite)`);
});
