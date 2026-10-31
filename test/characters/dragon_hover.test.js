// DRAGON-HOVER (2026-10-29, as the owner asked): at rest in the air the Dwarven Dragon
// hovers - records 20-24 - and the ground's still idle stays the ground's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dragonHoverFrame, DRAGON_HOVER_FPS } from '../../src/characters/dwarvenDragonId.js';
import { DWARVEN_DRAGON_FRAMES, DWARVEN_DRAGON_ART } from '../../src/characters/dwarvenDragon.js';
import { dragonAct } from '../../src/scenes/dragonHost.js';
import { DRAGON_MODE } from '../../src/net/dragon/dragonBrain.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('DRAGON-HOVER records 20-24 hold eight frames a facing, every picture shipped (mutants: the records left out; a frame missing)', () => {
  assert.deepEqual(DWARVEN_DRAGON_FRAMES.slice(20), [8, 8, 8, 8, 8]);
  for (let r = 20; r <= 24; r++) for (let f = 0; f < 8; f++) assert.ok(existsSync(join(root, 'public', DWARVEN_DRAGON_ART, `1800_${r}-${f}.png`)), `${r}-${f}`);
});

test('DRAGON-HOVER the loop\'s frame is the clock\'s, the same on every screen, eight to a beat (mutants: no wrap; a negative clock past the table)', () => {
  assert.equal(dragonHoverFrame(0), 0);
  assert.equal(dragonHoverFrame(1000 / DRAGON_HOVER_FPS), 1);
  assert.equal(dragonHoverFrame((8 * 1000) / DRAGON_HOVER_FPS), 0);
  assert.equal(dragonHoverFrame(-5), 0);
});

test('DRAGON-HOVER the world\'s dragon at rest aloft hovers on records 20-24; grounded it stands on its idle; moving it walks (mutants: the idle aloft; the hover on the ground)', () => {
  const air = dragonAct({ md: DRAGON_MODE.air, ma: 0 }, 5000, null, false, -1e9);
  assert.equal(air.act, 'fly');
  assert.deepEqual([...new Set(air.anims.map((a) => a.record))].sort(), [20, 21, 22, 23, 24]);
  const ground = dragonAct({ md: DRAGON_MODE.ground, ma: 0 }, 5000, null, false, -1e9);
  assert.ok(ground.anims.every((a) => a.record >= 15 && a.record <= 19), 'grounded: the idle');
  const landing = dragonAct({ md: DRAGON_MODE.ground, ma: 9000 }, 5000, null, false, -1e9);
  assert.ok(landing.anims.some((a) => a.record === 20), 'still coming down: hovering');
  assert.ok(dragonAct({ md: DRAGON_MODE.air, ma: 0 }, 5000, null, true, -1e9).anims.every((a) => a.record <= 4), 'moving: the walk');
});

test('DRAGON-HOVER another screen draws a dragon\'s rider at rest hovering, from the same clock (mutants: the rider\'s ground idle; the hover while it moves)', () => {
  const s = readFileSync(join(root, 'src/net/remotePlayers.js'), 'utf8');
  assert.ok(s.includes("const hover = shown.rd === POSE_RIDE.Dragon && !moving && bundle.mobileUnit.state === 'idle' && !bundle.mobileUnit.isPlayingOneShot();"));
  assert.ok(s.includes("const out = hover ? bundle.mobileUnit.heldPose('ranged', dragonHoverFrame(performance.now()), yaw, f, viewer) :"));
});
