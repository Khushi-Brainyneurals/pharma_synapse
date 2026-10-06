import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  const target = env.VITE_PROXY_TARGET || env.VITE_API_PROXY_TARGET || "http://backend:9999";
  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 4444,
      proxy: {
        "/api": { target, changeOrigin: true },
        "/health": { target, changeOrigin: true },
        "/me": { target, changeOrigin: true },
        "/password": { target, changeOrigin: true },
        "/logout": { target, changeOrigin: true },
        "/refresh": { target, changeOrigin: true },
        "/login": {
          target,
          changeOrigin: true,
          // Browser navigation opens React; a POST reaches the BFF's login endpoint.
          bypass: (req) => req.method === "GET" && req.headers.accept?.includes("text/html")
            ? "/index.html" : undefined,
        },
      },
      watch: {
        // Bind mounts need polling on macOS/Windows for hot reload.
        usePolling: true,
        interval: 300,
      },
    },
  };
});
