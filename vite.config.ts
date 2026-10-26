import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  // The standalone build is copied below the GeoHub Pages subpath.
  base: command === "build" ? "./" : "/",
  plugins: [react()],
  build: {
    emptyOutDir: true,
  },
}));
