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

// ✅ Proxy MUST be registered BEFORE static + SPA fallback
app.use(
  "/api",
  createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    secure: true,
    ws: true,
    logLevel: "debug"
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
