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
 * Debug route (safe): confirms what the web service is proxying to.
 * Visit: /__proxyinfo
 */
app.get("/__proxyinfo", (_req, res) => {
  res.json({
    ok: true,
    service: "frye-dashboard-web",
    apiTarget: API_TARGET,
    ts: new Date().toISOString(),
  });
});

/**
 * ✅ Proxy /api/* -> API_TARGET/api/*
 * IMPORTANT:
 * - Because we mount at "/api", the incoming req url is already "/api/..."
 * - We do NOT rewrite the path. We forward it as-is.
 */
app.use(
  "/api",
  createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    secure: true,
    ws: true,
    logLevel: "info",
  })
);

// Serve CRA build
const buildDir = path.resolve(__dirname, "../build");
app.use(express.static(buildDir));

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(buildDir, "index.html"));
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[OK] Frye Dashboard Web listening on :${PORT}`);
  console.log(`- buildDir: ${buildDir}`);
  console.log(`- proxy /api -> ${API_TARGET}`);
});
