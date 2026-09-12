import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";
import path from "node:path";
const repository = path.resolve(import.meta.dirname, "../../..");
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  resolve: { alias: {
    "@": path.join(repository, "src"),
    "next/link": path.join(import.meta.dirname, "navigation.tsx"),
    "next/navigation": path.join(import.meta.dirname, "navigation.tsx"),
  } },
  css: { postcss: { plugins: [tailwindcss()] } },
  server: { host: "127.0.0.1", port: 4175, strictPort: true, fs: { allow: [repository, path.resolve(repository, "../qcs-research/node_modules")] } },
});
