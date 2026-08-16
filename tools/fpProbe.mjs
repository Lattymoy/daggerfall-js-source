// FP viewmodel probe (standing tool, shipped with the 2026-08-16 audit):
// renders the REAL drawFirstPersonViewmodel path headless (no ARENA2 -
// the voxel rig is code-only, boot ramp synthetic) and measures where
// the viewmodel lands on screen. Zero coverage anywhere in the sweep is
// the failure this probe exists to catch (the P9 overshoot shipped an
// invisible viewmodel for six weeks). Usage: node tools/fpProbe.mjs
// (starts its own vite server; needs provisioned Chromium).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const server = await createServer({ server: { port: 5199, strictPort: true, cors: true } });
await server.listen();

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.setContent(`<!doctype html><body style="margin:0"><canvas id="c" width="1400" height="900" style="width:1400px;height:900px"></canvas>
<script type="module">
import { Renderer } from 'http://localhost:5199/src/render/renderer.js';
import { createCharacterRig } from 'http://localhost:5199/src/characters/engineRig.js';
import { buildRaceCharacter } from 'http://localhost:5199/src/characters/raceCharacter.js';
import { drawFirstPersonViewmodel } from 'http://localhost:5199/src/render/characterSprite.js';
import { PlayerWeapon } from 'http://localhost:5199/src/combat/playerWeapon.js';
import { EYE_HEIGHT } from 'http://localhost:5199/src/player/motor.js';

const canvas = document.getElementById('c');
const renderer = new Renderer(canvas);
const I = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
renderer.beginFrame(I, I, new Float32Array([0.3, -1, 0.2]));   // seeds _lightDir for the char program
renderer.setLighting(new Float32Array([1, 1, 1]), 0);
const boot = [[40, 30, 20], [60, 45, 30], [80, 60, 40], [100, 75, 50]];
const rig = createCharacterRig(renderer, buildRaceCharacter('Human', { boot }));
const weapon = new PlayerWeapon({});

window.__probeFrame = (state, frame) => {
  weapon.machine.state = state;
  weapon.machine.frame = frame;
  rig.setPose(weapon.pose());
  rig.update(0.016);
  const gl = renderer.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.5, 0.0, 0.5, 1.0);   // magenta clear: anything else is viewmodel
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawFirstPersonViewmodel(renderer, canvas, rig, [0, 0, 0], 0, EYE_HEIGHT);
  const W = canvas.width, H = canvas.height;
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let covered = 0, minX = W, maxX = -1, minY = H, maxY = -1;
  let centerHits = 0, centerTotal = 0;
  const cx0 = Math.floor(W * 0.40), cx1 = Math.floor(W * 0.60);
  const cy0 = Math.floor(H * 0.40), cy1 = Math.floor(H * 0.60);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const hit = !(px[i] === 128 && px[i + 1] === 0 && px[i + 2] === 128);
      const sy = H - 1 - y;   // gl reads bottom-up; report top-down screen coords
      if (sy >= cy0 && sy < cy1 && x >= cx0 && x < cx1) { centerTotal++; if (hit) centerHits++; }
      if (!hit) continue;
      covered++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (sy < minY) minY = sy; if (sy > maxY) maxY = sy;
    }
  }
  return {
    coveredFrac: covered / (W * H),
    bbox: covered ? { x0: minX / W, x1: (maxX + 1) / W, y0: minY / H, y1: (maxY + 1) / H } : null,
    centerFrac: centerHits / centerTotal,
    dataUrl: canvas.toDataURL('image/png'),
  };
};
window.__probeReady = true;
</script></body>`);

await page.waitForFunction('window.__probeReady === true', { timeout: 30000 });

// Full sweep: every FP state and frame must land pixels somewhere sane.
const sweep = await page.evaluate(() => {
  const out = [];
  const states = ['Idle', 'StrikeUp', 'StrikeDown', 'StrikeLeft', 'StrikeRight', 'StrikeDownLeft', 'StrikeDownRight'];
  for (const s of states) {
    for (let f = 0; f < 5; f++) {
      const r = window.__probeFrame(s, f);
      out.push([s, f, +r.coveredFrac.toFixed(5), +r.centerFrac.toFixed(4),
        r.bbox ? [+r.bbox.x0.toFixed(2), +r.bbox.x1.toFixed(2), +r.bbox.y0.toFixed(2), +r.bbox.y1.toFixed(2)] : null]);
      if (s === 'Idle') break;
    }
  }
  return out;
});
let fails = 0;
for (const [s, f, cov, center, bbox] of sweep) {
  console.log('sweep', JSON.stringify([s, f, cov, center, bbox]));
  if (cov === 0) { console.log(`FAIL: ${s} frame ${f} rendered zero viewmodel pixels`); fails++; }
}
if (sweep[0][2] > 0.25) { console.log('FAIL: idle viewmodel covers >25% of the screen (body-fill regression)'); fails++; }

const shots = [
  ['Idle', 0, 'fp-idle'],
  ['StrikeDown', 2, 'fp-strike-down-mid'],
  ['StrikeRight', 2, 'fp-strike-right-mid'],
];
for (const [state, frame, name] of shots) {
  const r = await page.evaluate(([s, f]) => window.__probeFrame(s, f), [state, frame]);
  writeFileSync(`/home/claude/${name}.png`, Buffer.from(r.dataUrl.split(',')[1], 'base64'));
  console.log('shot', name, 'covered', +r.coveredFrac.toFixed(4));
}

await browser.close();
await server.close();
process.exit(fails ? 1 : 0);
