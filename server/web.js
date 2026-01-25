// server/web.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from "http-proxy-middleware";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const API_TARGET =
  process.env.API_TARGET || "https://frye-market-backend-1.onrender.com";

// 1) Proxy /api -> backend (kills CORS forever because browser calls same origin)
app.use(
  "/api",
  createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    secure: true,
    // keep the same path (/api/v1/...)
    logLevel: "warn",
  })
);

// (Optional) if you want /live to also proxy to backend:
// app.use(
//   "/live",
//   createProxyMiddleware({
//     target: API_TARGET,
//     changeOrigin: true,
//     secure: true,
//     logLevel: "warn",
//   })
// );

// 2) Serve CRA build output
const buildDir = path.resolve(__dirname, "../build");
app.use(express.static(buildDir));

// 3) SPA fallback (React Router)
app.get("*", (_req, res) => {
  res.sendFile(path.join(buildDir, "index.html"));
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[OK] Frye Dashboard Web wrapper listening on :${PORT}`);
  console.log(`- Serving: ${buildDir}`);
  console.log(`- Proxying /api -> ${API_TARGET}`);
});
