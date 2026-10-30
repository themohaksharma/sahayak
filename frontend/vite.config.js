import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative asset paths keep the Vite build working on GitHub Pages project URLs.
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
});
