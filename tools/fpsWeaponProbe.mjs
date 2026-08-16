// Classic FPS-weapon probe (standing tool, pivot 2026-08-17): renders
// the REAL combat/fpsWeapon.js path headless against REAL ARENA2 CIFs
// (vite dev serves /arena2/* from ARENA2_PATH) and measures where the
// weapon lands on screen. Zero coverage in any state is the failure
// class the iced voxel path shipped for six weeks - never again.
// Usage: ARENA2_PATH=... node tools/fpsWeaponProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const server = await createServer({ server: { port: 5199, strictPort: true, cors: true } });
await server.listen();

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.setContent(`<!doctype html><body style="margin:0"><canvas id="c" width="1280" height="800" style="width:1280px;height:800px"></canvas>
<script type="module">
import { Renderer } from 'http://localhost:5199/src/render/renderer.js';
import { DFPalette } from 'http://localhost:5199/src/formats/dfPalette.js';
import { loadFpsWeaponArt, drawFpsWeapon, WEAPON_TYPES } from 'http://localhost:5199/src/combat/fpsWeapon.js';
import { WEAPON_MATERIALS } from 'http://localhost:5199/src/characters/weapons.js';

const canvas = document.getElementById('c');
const renderer = new Renderer(canvas);
const getBytes = async (name) => new Uint8Array(await (await fetch('http://localhost:5199/arena2/' + name)).arrayBuffer());
const palette = new DFPalette();
palette.load(await getBytes('ART_PAL.COL'), 'ART_PAL.COL');

const arts = {
  dagger: await loadFpsWeaponArt(getBytes, palette, renderer, WEAPON_TYPES.Dagger, WEAPON_MATERIALS.Iron),
  longblade: await loadFpsWeaponArt(getBytes, palette, renderer, WEAPON_TYPES.LongBlade, WEAPON_MATERIALS.Elven),
  bow: await loadFpsWeaponArt(getBytes, palette, renderer, WEAPON_TYPES.Bow, WEAPON_MATERIALS.Iron),
  melee: await loadFpsWeaponArt(getBytes, palette, renderer, WEAPON_TYPES.Melee, WEAPON_MATERIALS.Iron),
  silverdagger: await loadFpsWeaponArt(getBytes, palette, renderer, WEAPON_TYPES.Dagger, WEAPON_MATERIALS.Silver),
  steelblade: await loadFpsWeaponArt(getBytes, palette, renderer, WEAPON_TYPES.LongBlade, WEAPON_MATERIALS.Steel),
};

window.__probe = (which, state, frame) => {
  const gl = renderer.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.5, 0.0, 0.5, 1.0);   // magenta clear: anything else is weapon
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawFpsWeapon(renderer, canvas, arts[which], state, frame);
  const W = canvas.width, H = canvas.height;
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let covered = 0, minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (px[i] === 128 && px[i + 1] === 0 && px[i + 2] === 128) continue;
      covered++;
      const sy = H - 1 - y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
    }
  }
  return {
    coveredFrac: covered / (W * H),
    bbox: covered ? { x0: minX / W, x1: (maxX + 1) / W, y0: minY / H, y1: (maxY + 1) / H } : null,
    dataUrl: canvas.toDataURL('image/png'),
  };
};
window.__probeReady = true;
</script></body>`);

await page.waitForFunction('window.__probeReady === true', { timeout: 60000 });

let fails = 0;
const check = (name, r, wants) => {
  console.log(name, JSON.stringify({ cov: +r.coveredFrac.toFixed(4), bbox: r.bbox && Object.fromEntries(Object.entries(r.bbox).map(([k, v]) => [k, +v.toFixed(2)])) }));
  if (r.coveredFrac === 0) { console.log(`FAIL: ${name} rendered zero pixels`); fails++; return; }
  for (const [msg, ok] of wants) if (!ok(r)) { console.log(`FAIL: ${name} - ${msg}`); fails++; }
};

// Idle sweeps: every set draws its ready frame; dagger sits right,
// bottom-anchored (Right align, offset 0.04); melee fists Right 0.15.
for (const [which, state, frame, name] of [
  ['dagger', 'Idle', 0, 'dagger-idle'],
  ['longblade', 'Idle', 0, 'longblade-idle'],
  ['bow', 'Idle', 0, 'bow-idle'],
  ['melee', 'Idle', 0, 'melee-idle'],
  ['dagger', 'StrikeDown', 2, 'dagger-strikedown-mid'],
  ['dagger', 'StrikeRight', 2, 'dagger-strikeright-mid'],
  ['longblade', 'StrikeLeft', 2, 'longblade-strikeleft-mid'],
  ['bow', 'StrikeDown', 4, 'bow-draw'],
  ['silverdagger', 'Idle', 0, 'silver-dagger-idle'],   // dye-parity evidence: 18 dyes SILVER (audit 2026-08-17)
  ['steelblade', 'Idle', 0, 'steel-blade-idle'],       // dye-parity evidence: Steel keeps the files' native colors
]) {
  const r = await page.evaluate(([w, s, f]) => window.__probe(w, s, f), [which, state, frame]);
  const wants = [['bottom-anchored', (x) => x.bbox.y1 > 0.98]];
  if (name === 'dagger-idle') wants.push(['right-anchored (offset 0.04)', (x) => x.bbox.x1 > 0.93]);
  if (name === 'dagger-strikeright-mid') wants.push(['Left-aligned record', (x) => x.bbox.x0 < 0.05]);
  check(name, r, wants);
  writeFileSync(`/home/claude/fpw-${name}.png`, Buffer.from(r.dataUrl.split(',')[1], 'base64'));
}

await browser.close();
await server.close();
process.exit(fails ? 1 : 0);
