import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    proxy: {
      "/api": "http://localhost:8380",
      "/auth": "http://localhost:8380",
    },
  },
  build: {
    target: "esnext",
    outDir: "dist",
  },
});
