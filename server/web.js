// server/web.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Must match your Render env var key
const API_TARGET =
  (process.env.API_TARGET || "https://frye-market-backend-1.onrender.com").trim();

// ✅ 1) PROXY FIRST (before static)
app.use(
  "/api",
  createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    secure: true,
    ws: true,
    logLevel: "debug",

    // IMPORTANT: keep path as-is
    // /api/v1/confluence-score stays /api/v1/confluence-score
  })
);

// ✅ 2) Serve CRA build
const buildDir = path.resolve(__dirname, "../build");
app.use(express.static(buildDir));

// ✅ 3) SPA fallback (React Router)
app.get("*", (_req, res) => {
  res.sendFile(path.join(buildDir, "index.html"));
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[OK] Frye Dashboard Web on :${PORT}`);
  console.log(`- buildDir: ${buildDir}`);
  console.log(`- proxy /api -> ${API_TARGET}`);
});
