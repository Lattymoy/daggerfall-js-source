// NT2 - the parity-nit batch. Four AUDIT 26 findings on world and
// character behavior: the spawn tile flagged occupied where DFU flags
// none (F022, pinned where the walker tests live -
// townpopulation.test.js), the human-enemy gender roll off the wrong
// stream - and the dungeon LAYOUT path never rolling at all (F210),
// every lightning slot spending two frames with the next wait armed
// late (F186), and the nature-scatter exclusion tested on the
// pre-expansion rect (F188).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MobileUnit } from '../src/characters/mobileUnit.js';
import { srand, rand } from '../src/formats/dfRandom.js';
import { LightningPlayer } from '../src/world/weather.js';
import { layoutNature } from '../src/world/terrainNature.js';
import { HEIGHTMAP_DIMENSION } from '../src/world/terrainSampler.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, 'src', p), 'utf8');

const HUMAN = { affinity: 'Human', maleTexture: 486, femaleTexture: 485 };
const RAT = { affinity: 'Animal', maleTexture: 255, femaleTexture: 255 };

// ---------------------------------------------------------------
// 1. F210 - GetTextureArchive's gender arm on the classic stream
// ---------------------------------------------------------------

test('NT2 (F210): a human with unspecified gender rolls the SHARED DFRandom stream, == 0 male', () => {
  srand(12345);
  const draws = Array.from({ length: 6 }, () => rand());
  srand(12345);
  for (const d of draws) {
    const expected = d % 2 === 0 ? 'male' : 'female';
    assert.equal(MobileUnit.resolveGender('unspecified', HUMAN), expected,
      'the resolution IS rand() % 2 off the stream - seed-reproducible, DFU\'s random_range(0, 2)');
  }
});

test('NT2 (F210): a specified gender passes through and CONSUMES NO DRAW; a monster stays unspecified', () => {
  srand(777);
  const first = rand();
  srand(777);
  assert.equal(MobileUnit.resolveGender('female', HUMAN), 'female');
  assert.equal(MobileUnit.resolveGender('male', HUMAN), 'male');
  assert.equal(MobileUnit.resolveGender('unspecified', RAT), 'unspecified',
    'monsters never roll - Unspecified reads the male texture downstream');
  assert.equal(rand(), first, 'none of those moved the stream position');
});

test('NT2 (F210): the hosts ride the one resolver - no ad-hoc Math.random gender roll survives', () => {
  const dc = src('scenes/dungeonContext.js');
  assert.ok(dc.includes('e.gender = MobileUnit.resolveGender(e.gender, basics);'),
    'buildFoeAt resolves at the ONE entry every spawn record passes - the layout path rolls now too');
  assert.ok(src('scenes/exteriorFoes.js').includes("MobileUnit.resolveGender(forcedGender ?? 'unspecified', basics)"),
    'the exterior/interior builder rides it');
  for (const f of ['scenes/dungeonContext.js', 'scenes/exteriorFoes.js']) {
    assert.equal(/female' : 'male'/.test(src(f).replace(/=== 'female' \? /g, '')), false,
      `${f} carries no inline coin-flip`);
  }
});

// ---------------------------------------------------------------
// 2. F186 - the lightning coroutine's real frame budget
// ---------------------------------------------------------------

function runToStrike(lp) {
  // burn the wait in 1s ticks; the strike tick returns the FIRST flash frame
  for (let i = 0; i < 40; i++) {
    const v = lp.tick(1);
    if (lp._phase === 1) return v;
  }
  throw new Error('no strike inside 40s');
}

test('NT2 (F186): a lit slot spends two frames, a skipped slot ONE - the run is shorter than 2 x slots', () => {
  const lp = new LightningPlayer(7);
  let v = runToStrike(lp);
  const slots = lp._slots;
  let frames = 1;
  let onFrames = v === 2 ? 1 : 0;
  while (lp._phase === 1) {
    v = lp.tick(1 / 60);
    frames++;
    if (v === 2) onFrames++;
  }
  assert.equal(frames, slots + onFrames,
    'each slot costs one frame plus one more ONLY when it lit - the coroutine\'s yield-inside-the-branch');
  assert.ok(onFrames > 0 && onFrames < slots,
    `seed 7 must produce a mixed run to prove both arms (${onFrames}/${slots})`);
  assert.equal(lp.tick(1 / 60), 1, 'the run ends dark');
});

test('NT2 (F186): every ON frame is followed by exactly one OFF frame inside the run', () => {
  const lp = new LightningPlayer(11);
  let v = runToStrike(lp);
  let prevOn = v === 2;
  while (lp._phase === 1) {
    v = lp.tick(1 / 60);
    if (prevOn) assert.equal(v, 1, 'the lit slot\'s second half is its off frame');
    prevOn = v === 2;
  }
});

test('NT2 (F186): the NEXT wait re-arms AT STRIKE, so the flash run does not delay it', () => {
  const lp = new LightningPlayer(3);
  runToStrike(lp);
  assert.ok(lp._wait > 0, 'StartWaiting fired WITH the strike (:150-151), not at the run\'s end');
  const armed = lp._wait;
  lp.tick(1 / 60);
  assert.ok(lp._wait < armed, 'and the counter ticks THROUGH the flash frames, as Update does');
});

// ---------------------------------------------------------------
// 3. F188 - the exclusion is the EXPANDED rect's own test
// ---------------------------------------------------------------

const natureBase = () => ({
  mapPixelX: 10, mapPixelY: 10, rawWorldHeight: 128,
  climateType: 99, locationRect: null,
});
const natureLand = () => ({
  flat: new Float32Array(HEIGHTMAP_DIMENSION * HEIGHTMAP_DIMENSION).fill(0.1),
  grass: new Uint8Array(128 * 128).fill(2),
});

test('NT2 (F188): a min in (0, 4] disables the containment - nature scatters ACROSS the footprint', () => {
  const { flat, grass } = natureLand();
  // pre-clearance xMin 2: the -4 expansion pushes it to -2, and DFU's
  // re-evaluated `rect.x > 0` turns the containment test off outright
  const open = layoutNature(flat, grass, { ...natureBase(), locationRect: { xMin: 2, xMax: 40, yMin: 20, yMax: 40 } });
  assert.ok(open.some((f) => {
    const tx = f.x / 6.4, ty = f.z / 6.4;
    return tx >= 2 && tx < 40 && ty >= 20 && ty < 40;
  }), 'billboards stand inside the location rect, exactly as DFU draws them for eight-block places');
});

test('NT2 (F188): a rect clear of the edge still excludes its expanded footprint', () => {
  const { flat, grass } = natureLand();
  const rected = layoutNature(flat, grass, { ...natureBase(), locationRect: { xMin: 20, xMax: 40, yMin: 20, yMax: 40 } });
  assert.ok(rected.every((f) => {
    const tx = f.x / 6.4, ty = f.z / 6.4;
    return !(tx >= 16 && tx < 44 && ty >= 16 && ty < 44);
  }), 'the +4 clearance exclusion is unchanged where both expanded mins stay positive');
});
