// MW-D42 - THE RIDE, pinned: the gait law over the motor's own flags,
// the placement matrix (the fpArm drawThird law - feet, yaw+180, the
// metre scale with the handedness mirror, Z-up tipped), the sound
// registration's key-by-key degradation, and the host wiring - the 3D
// horse draws beside the body pass, the CFA sprite yields ONLY while
// it stands, pause hides both, and every mount path shares the one
// tryLoadPegas door.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  horseGaitClip, horseModelMatrix, registerHorseSounds, HORSE_CLIPS, HORSE_SOUNDS, PEGAS_SCALE,
} from '../src/systems/pegasHorse.js';
import { MW_UNITS_PER_METER } from '../src/formats/mwFirstPerson.js';
import { makeLooseArchive } from '../src/scenes/dataSource.js';

test('MW-D42: the gait law - still idles, half-speed walks, speed runs, airborne holds', () => {
  const at = (o) => horseGaitClip({ standingStill: false, grounded: true, movingLessThanHalfSpeed: true, ...o });
  assert.equal(at({ standingStill: true }), HORSE_CLIPS.still);
  assert.equal(at({}), HORSE_CLIPS.walk);
  assert.equal(at({ movingLessThanHalfSpeed: false }), HORSE_CLIPS.run);
  assert.equal(at({ grounded: false }), null, 'a jump freezes the stride instead of popping to a reset');
  assert.equal(at({ grounded: false, standingStill: true }), null, 'airborne wins over everything');
});

test('MW-D42: the placement matrix - feet, metre scale, and the handedness mirror', () => {
  const feet = [12.5, 3.25, -800];
  const m = horseModelMatrix(feet, 0);
  assert.deepEqual([m[12], m[13], m[14]], feet, 'the horse stands at the player\'s feet');
  const s = PEGAS_SCALE / MW_UNITS_PER_METER;
  // column lengths carry the uniform metre scale
  for (const c of [0, 1, 2]) {
    const l = Math.hypot(m[c * 4], m[c * 4 + 1], m[c * 4 + 2]);
    assert.ok(Math.abs(l - s) < 1e-6, `column ${c} is the metre scale`);
  }
  // the negative-X scale mirrors: the 3x3 determinant is NEGATIVE -
  // the same flip every MW pass takes under the mirrored projection
  const det = m[0] * (m[5] * m[10] - m[6] * m[9])
    - m[4] * (m[1] * m[10] - m[2] * m[9])
    + m[8] * (m[1] * m[6] - m[2] * m[5]);
  assert.ok(det < 0, 'the handedness mirror rides the matrix');
  // yaw turns the matrix: two yaws differ
  assert.notDeepEqual([...horseModelMatrix(feet, 1.2)].map((v) => v.toFixed(4)),
    [...m].map((v) => v.toFixed(4)));
});

test('MW-D42: sounds register key by key - a partial attach degrades sound by sound', async () => {
  const registered = [];
  const engine = { registerSound: async (key, bytes) => { registered.push([key, bytes.length]); return bytes.length > 0; } };
  const arc = makeLooseArchive(new Map([
    [HORSE_SOUNDS.trot, new Uint8Array(4)],
    [HORSE_SOUNDS.gallop, new Uint8Array(0)],   // present but the decoder rejects it
  ]));
  const got = await registerHorseSounds(engine, [arc]);
  assert.deepEqual([...got], ['pegas:trot'], 'only the clip that decoded is swappable');
  assert.equal(registered.length, 2, 'absent files are never sent to the decoder');
});

test('MW-D42: the host wiring - one door, the body-pass draw site, the yielding sprite, the paused hide', () => {
  const world = readFileSync('src/scenes/world.js', 'utf8');
  // the enhanced saddle hangs off the ONE mode door (tr5 pins the door
  // itself); the load is once-per-session and never throws
  assert.ok(world.includes('if (mode === TRANSPORT_MODES.Horse) tryLoadPegas();'));
  assert.ok(world.includes('if (pegasWanted || !isEnhanced()) return;'), 'once, enhanced only');
  assert.ok(world.includes('const archives = await loadMorrowindArchives();'), 'the player\'s own data, MW-D40 loose door included');
  // the draw: beside the body pass, gait from the motor's own flags,
  // paused hides (the sprite\'s F-E1 law), placement through the one law
  const drawAt = world.indexOf('renderer.drawCharacter(pegas.mesh, horseModelMatrix(player.pos, cam.yaw));');
  assert.ok(drawAt > 0, 'the horse draws through the character pass');
  const bodyAt = world.indexOf('mwViewDrawBody(canvas, { proj, view, eye: mwv.eye');
  assert.ok(bodyAt > 0 && drawAt > bodyAt && drawAt - bodyAt < 1600, 'beside the body pass');
  assert.ok(world.includes('if (clip && !pegas.setClip(clip)) pegas.setClip(HORSE_CLIPS.still);'),
    'a missing gait falls back, never a dead horse');
  assert.ok(world.includes('pegas.advance(clip ? dt : 0);'), 'airborne holds the stride');
  // the sprite yields ONLY while the horse stands - inside the tr3
  // pinned block, so the cart, the classic skin and a failed load all
  // keep the 1:1 sprite exactly as pinned
  const spriteBlock = world.slice(world.indexOf('if (ridingArt && isRiding(player.transportMode) && !ridePaused) {'));
  assert.ok(spriteBlock.indexOf('if (!pegasUp) {') > 0
    && spriteBlock.indexOf('if (!pegasUp) {') < spriteBlock.indexOf('drawScreenQuad'),
    'the sprite yields to the standing horse and to nothing else');
});
