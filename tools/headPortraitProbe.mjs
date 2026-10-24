// PORTRAIT3D LIVE PROOF: the head portrait through the real renderer, in a real browser - the port's own Breton heads
// and steel and ebony helms (src/assets/mw, shipped with the page: no ARENA2 and no Morrowind data in hand) on the
// vendored retail skeleton with its part nodes (test/fixtures/mw/retailRig.mjs), read through combat/fpArm.js
// headPortrait's own door with a store that holds only those, rendered by renderCharacterSpriteImage and read back. It writes each picture as a PNG beside its numbers (the share of the frame the head covers, where its
// bounds stand, its mean colour) so the framing can be SEEN, not trusted: the head face-on, upright, filling the frame.
//
// Usage: node tools/headPortraitProbe.mjs [outDir]   (outDir defaults to the system's temporary directory - pictures
// are kept out of the tree)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { retailSkeleton } from '../test/fixtures/mw/retailRig.mjs';

const out = process.argv[2] || join(tmpdir(), 'head-portraits');
mkdirSync(out, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5231, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  page.on('pageerror', (e) => { console.error('page error:', e.message); failed = true; });
  await page.goto('http://localhost:5231/mw-viewer.html');
  const skeleton = Array.from(retailSkeleton());
  const shots = await page.evaluate(async (skeleton) => {
    const [{ Renderer }, { headPortrait }, { ownMwArchive }] = await Promise.all([
      import('/src/render/renderer.js'), import('/src/combat/fpArm.js'), import('/src/systems/ownMwAssets.js'),
    ]);
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    document.body.appendChild(canvas);
    const renderer = new Renderer(canvas);
    const own = ownMwArchive();
    const skel = new Uint8Array(skeleton);
    const rig = { has: (p) => p === 'meshes/base_anim.nif', loaded: () => true, get: () => skel, load: async () => skel };
    const deps = {
      morrowindDataGeneration: () => 1,
      loadMorrowindArchives: async () => [own, rig],
      storedMorrowindNames: async () => ['Morrowind.esm'],
      loadMorrowindArmRecords: async () => ({ parts: [] }),
    };
    const out = [];
    for (const [label, opts] of [
      ['portrait0', { faceIndex: 0 }], ['portrait6-eyepatch', { faceIndex: 6 }], ['portrait2', { faceIndex: 2 }],
      ['hud-33x30', { faceIndex: 0, px: 132, ph: 120 }], ['npc-walked', { npcFace: { head: 5, hair: 7 } }],
      ['steel-helm', { faceIndex: 0, armor: [{ kind: 'armor', templateIndex: 107, material: 513 }] }],
      ['ebony-helm', { faceIndex: 6, armor: [{ kind: 'armor', templateIndex: 107, material: 519 }] }],
      ['green-hood', { faceIndex: 2, armor: [{ kind: 'outfit', id: 'townsfolk_388' }] }],
    ]) {
      const img = await headPortrait({ renderer, race: 'breton', female: false, ownHeads: true, px: 128, deps, ...opts });   // MW-HEADS2: the port's own heads are a player's
      out.push({ label, img: img ? { width: img.width, height: img.height, data: Array.from(img.data) } : null });
    }
    return out;
  }, skeleton);
  for (const { label, img } of shots) {
    if (!img) { console.log(`${label}: NO PICTURE`); failed = true; continue; }
    const { width: w, height: h, data } = img;
    let n = 0, minX = w, minY = h, maxX = -1, maxY = -1, r = 0, g = 0, b = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 128) continue;
      n++; r += data[i]; g += data[i + 1]; b += data[i + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const png = new PNG({ width: w, height: h });
    png.data = Buffer.from(data);
    writeFileSync(join(out, `${label}.png`), PNG.sync.write(png));
    console.log(`${label}: ${w}x${h}, ${(100 * n / (w * h)).toFixed(1)}% covered, bounds x ${minX}..${maxX} y ${minY}..${maxY}, mean rgb ${n ? [r, g, b].map((v) => Math.round(v / n)).join(',') : '-'}`);
    if (n < w * h * 0.15) failed = true;
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
