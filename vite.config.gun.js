// THE GUN LAB, ON ITS OWN (Mac, 2026-09-19: "I want to test this as
// its own deploy").
//
// The house config builds the whole site - the game, the labs, the
// menus - and the gun lab is one entry point among many. This one
// builds THE LAB AND NOTHING ELSE, into `dist-gun/`, with a RELATIVE
// base so the output runs from any directory: the site's
// /preview/gun-lab/, a static host, a phone opening a folder, or a
// published page.
//
//     npx vite build --config vite.config.gun.js
//     npx vite preview --config vite.config.gun.js
//
// `public/` is NOT copied wholesale: the site's static root carries the
// icons, the skin tables and a 1.3MB parchment the lab never asks for.
// The two art files and the sounds it does ask for are copied by hand
// below, and the page's own index.html is written beside them so the
// directory serves itself.
import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'dist-gun';
const ART = ['gun-idle.png', 'gun-fire-sheet.webp'];
// every .wav in public/sfx, plus the provenance that must travel with
// them - a CC0 file owes nobody an attribution and a build that cannot
// say where its audio came from owes its next reader one anyway
const SFX_DIR = 'public/sfx';

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir: OUT,
    emptyOutDir: true,
    rollupOptions: { input: { gunProto: 'gun-proto.html' } },
  },
  plugins: [{
    name: 'gun-lab-assets',
    closeBundle() {
      mkdirSync(join(OUT, 'art'), { recursive: true });
      for (const f of ART) copyFileSync(join('public/art', f), join(OUT, 'art', f));
      mkdirSync(join(OUT, 'sfx'), { recursive: true });
      for (const f of readdirSync(SFX_DIR)) copyFileSync(join(SFX_DIR, f), join(OUT, 'sfx', f));
      // the directory's own front door, so /preview/gun-lab/ opens it
      writeFileSync(join(OUT, 'index.html'), readFileSync(join(OUT, 'gun-proto.html')));
    },
  }],
});
