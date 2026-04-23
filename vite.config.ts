import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// For GitHub Pages project sites, set VITE_BASE_PATH=/your-repo-name/
const base = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  plugins: [react()],
  base,
});
