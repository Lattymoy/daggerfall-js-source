// THE PISTOL LAB, ON ITS OWN - vite.config.gun.js's shape for the
// second lab (bible/05-Combat/Pistol-Lab.md): the page, its module, its
// art and its sounds into `dist-pistol/`, with a RELATIVE base so the
// output runs from any directory - the site's /preview/pistol-lab/, a
// static host, a phone opening a folder.
//
//     npx vite build --config vite.config.pistol.js
//     npx vite preview --config vite.config.pistol.js
//
// `public/` is not copied wholesale (the site's static root carries
// what the lab never asks for): the strip and the sounds are copied by
// hand, and the page's own index.html is written beside them.
import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'dist-pistol';
const ART = ['pistol-frames.png'];
// the gun lab's clips - the lab offers the same lists - and their provenance
const SFX_DIR = 'public/sfx';

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir: OUT,
    emptyOutDir: true,
    rollupOptions: { input: { pistolProto: 'pistol-proto.html' } },
  },
  plugins: [{
    name: 'pistol-lab-assets',
    closeBundle() {
      mkdirSync(join(OUT, 'art'), { recursive: true });
      for (const f of ART) copyFileSync(join('public/art', f), join(OUT, 'art', f));
      mkdirSync(join(OUT, 'sfx'), { recursive: true });
      for (const f of readdirSync(SFX_DIR)) copyFileSync(join(SFX_DIR, f), join(OUT, 'sfx', f));
      // the directory's own front door, so /preview/pistol-lab/ opens it
      writeFileSync(join(OUT, 'index.html'), readFileSync(join(OUT, 'pistol-proto.html')));
    },
  }],
});
