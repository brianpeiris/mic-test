import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: "./src",
  base: "./",
  publicDir: "../public",
  build: {
    // outDir is relative to root
    outDir: "../",
    rollupOptions: {
      input: {
        main: "./src/index.html",
      },
    },
  }
});
