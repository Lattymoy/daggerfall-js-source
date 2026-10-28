// THE SPEAR LAB, ON ITS OWN - vite.config.pistol.js's shape for the third lab (bible/05-Combat/Spear-Lab.md): the page,
// its module, its art and its sounds into `dist-spear/`, with a RELATIVE base so the output runs from any directory -
// the site's /preview/spear-lab/, a static host, a phone opening a folder.
//
//     npx vite build --config vite.config.spear.js
//     npx vite preview --config vite.config.spear.js
import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'dist-spear';
const ART = ['spear/spear-frames.png'];
// the swing's two takes (src/tools/spearLab.js SPEAR_SWING_SFX) and their provenance
const SFX = ['gather-swing-1.wav', 'gather-swing-2.wav', 'SOURCES.md'];

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir: OUT,
    emptyOutDir: true,
    rollupOptions: { input: { spearProto: 'spear-proto.html' } },
  },
  plugins: [{
    name: 'spear-lab-assets',
    closeBundle() {
      mkdirSync(join(OUT, 'art', 'spear'), { recursive: true });
      for (const f of ART) copyFileSync(join('public/art', f), join(OUT, 'art', f));
      mkdirSync(join(OUT, 'sfx'), { recursive: true });
      for (const f of SFX) copyFileSync(join('public/sfx', f), join(OUT, 'sfx', f));
      // the directory's own front door, so /preview/spear-lab/ opens it
      writeFileSync(join(OUT, 'index.html'), readFileSync(join(OUT, 'spear-proto.html')));
    },
  }],
});
