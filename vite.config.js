import { defineConfig } from 'vite';

// Relative base ('./') so the built static site works on both
// GitHub Pages (served from a subpath) and itch.io (served inside an iframe).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
  },
  server: {
    port: 5173,
    open: false,
  },
});
