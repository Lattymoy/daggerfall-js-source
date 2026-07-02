import { defineConfig } from 'vite';

// base is set for GitHub Pages deploy at lattymoy.github.io/<repo>/
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
  },
});
