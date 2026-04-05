import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = process.env.VITE_DEV_API_ORIGIN || "http://localhost:4000";

const proxy = {
  "/api": {
    target: backend,
    changeOrigin: true,
  },
  "/uploads": {
    target: backend,
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy,
  },
  /** `vite preview` does not inherit `server.proxy` — duplicate here so prod-like builds still reach the API */
  preview: {
    proxy,
  },
});
