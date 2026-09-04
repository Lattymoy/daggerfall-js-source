// GR3 - THE WIND THAT NEVER REACHED THE GRASS.
//
// Mac: "the wind still isn't working ingame" - after GR2 had rescaled
// it, documented it, and measured a million blades placed. Nobody
// measured a blade MOVING, and the value that reaches the shader was
// never pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { labWindSlider, placeLabGrassSteps } from '../src/render/labGrass.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('GR3: the sky CONTROLLER exposes the cloud-shadow deck the hosts read', () => {
  // EE5 publishes `cloudShadow` on the EnhancedSkyRenderer. world.js
  // reads `sky.cloudShadow` three times - and `sky` is the CONTROLLER
  // createSkyController returns, which never carried the key: the dome
  // sits one level down under `renderer`. Every reader got undefined.
  const shared = read('src/scenes/shared.js');
  const i = shared.indexOf('export function createSkyController');
  const ret = shared.slice(shared.indexOf('  return {', i), shared.indexOf('\n  };', shared.indexOf('  return {', i)));
  assert.match(ret, /get cloudShadow\(\) \{\s*\n\s*return enhancedSky\?\.cloudShadow \?\? null;/,
    'a LIVE getter off the dome - the deck is rebuilt every draw');
  assert.match(read('src/render/enhancedSky.js'), /this\.cloudShadow = \{\s*\n\s*cover:/, 'and the dome still publishes it');
  // The three readers, all on the controller, all now answered.
  const world = read('src/scenes/world.js');
  assert.match(world, /renderer\.setCloudShadow\(sky\?\.cloudShadow \?\? null\);/, 'the ground shadows');
  assert.match(world, /precip\.enhanced = !!sky\?\.cloudShadow;/, 'the enhanced rain');
  assert.match(world, /const w = sky\?\.cloudShadow\?\.wind \?\? \[0, 0\];/, 'the grass wind');
});

test('GR3: the VALUE that reaches the grass shader - sunny is the lab\'s 70, not 0', () => {
  // The controller's shape, as it now is, driven by the dome's own
  // sunny row (enhancedSky.js:79). This is the assertion GR2 lacked:
  // not "the mapping exists" but "the number the host computes from
  // what it can actually reach".
  const dome = { cloudShadow: { cover: 0.32, soft: 0.34, wind: [0.010, 0.004], time: 0, amount: 0.62 } };
  const controller = { renderer: dome, get cloudShadow() { return dome?.cloudShadow ?? null; } };
  const w = controller?.cloudShadow?.wind ?? [0, 0];
  const slider = labWindSlider(w);
  assert.ok(Math.abs(slider - 70) < 1, `sunny lands on the lab's own default: ${slider}`);
  const mag = Math.hypot(...w); const dir = [w[0] / mag, w[1] / mag];
  const windV = [dir[0] * slider * 0.16, dir[1] * slider * 0.16];
  assert.ok(Math.hypot(...windV) > 10, 'and uWindV is a real push, not a whisper');
  // A controller WITHOUT the deck - the classic sky - honestly reads 0.
  const classic = { renderer: {}, get cloudShadow() { return null; } };
  assert.equal(labWindSlider(classic?.cloudShadow?.wind ?? [0, 0]), 0);
});

test('GR3: a blade actually MOVES - the shader\'s lean on real placer output', () => {
  // The vertex law evaluated in JS on blades the real placer lands:
  // over half a gust the tip must travel a visible fraction of the
  // blade's height. GR2 measured a million blades placed; this
  // measures one moving.
  const gen = placeLabGrassSteps({ centre: [1000, 1000], keep: () => 0 });
  let r; do { r = gen.next(); } while (!r.done);
  const { inst, inst2 } = r.value;
  const w = [0.010, 0.004]; const slider = labWindSlider(w);
  const mag = Math.hypot(...w); const dir = [w[0] / mag, w[1] / mag];
  const windV = [dir[0] * slider * 0.16, dir[1] * slider * 0.16];
  const L = Math.hypot(...windV); const wdir = [windV[0] / L, windV[1] / L];
  const tip = (i, t) => {
    const x = inst[i * 4], z = inst[i * 4 + 1], h = inst[i * 4 + 2], ph = inst[i * 4 + 3];
    const along = x * wdir[0] + z * wdir[1];
    const gust = Math.sin(t * 1.7 - along * 0.35 + ph * 0.6) * 0.5 + 0.5;   // the shader's line
    const push = L * (0.55 + gust * 0.75);
    const lean = [inst2[i * 4] + wdir[0] * push * 0.055, inst2[i * 4 + 1] + wdir[1] * push * 0.055];
    return { x: x + lean[0] * h, z: z + lean[1] * h, h };
  };
  let sumH = 0, sumMove = 0; const N = 500;
  for (let i = 0; i < N; i++) { const a = tip(i, 0), b = tip(i, 1.85); sumH += a.h; sumMove += Math.hypot(b.x - a.x, b.z - a.z); }
  const frac = sumMove / sumH;
  assert.ok(frac > 0.15, `the tip travels ${(frac * 100).toFixed(0)}% of its height over half a gust - visible`);
  // ...and with wind [0,0], which is what the host was feeding, it does
  // not move at all - the exact silence Mac reported.
  const still = (i, t) => { const x = inst[i * 4], z = inst[i * 4 + 1], h = inst[i * 4 + 2]; return { x: x + inst2[i * 4] * h, z: z + inst2[i * 4 + 1] * h }; };
  const a = still(0, 0), b = still(0, 1.85);
  assert.equal(Math.hypot(b.x - a.x, b.z - a.z), 0, 'no wind, no motion - GR2 shipped this');
});
