// SWIM-EYE (FIELD BUGS 2026-10-02c, Discord: "Sinking in water causes clipping underground. I sunk into some water in
// the overworld and could see sky and mountains underground") - a sunk swimmer's eye stood 0.20 over his feet, the
// port's "0.1 under the 0.30 top" where DFU's DoSinking sets the camera at controller.height / 2 over the controller's
// centre - a sphere's, CAPSULE_RADIUS over the feet: 0.50. The swim bounce (headBobber.js, DFU's own, re-armed every
// cycle in the water) dips it BOUNCE_MAX, so it sank to 0.03: under the drawn ground and inside the world's 0.2 near
// plane, and the one-sided terrain vanished over the sky; at the sea's own height Deep Waters' 0.25 band read it as
// underwater. Pinned by the real bobber's own cycle against the world's own lens and the mod's own band, read from the
// source. Red on the record's code (42e50765).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SWIM_EYE_HEIGHT, SWIM_RIDE_EYE_HEIGHT, SWIM_HEIGHT, SWIM_HORSE_DISPLACEMENT, CAPSULE_RADIUS } from '../../src/player/motor.js';
import { HeadBobber, BOUNCE_MAX } from '../../src/player/headBobber.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('SWIM-EYE DFU\'s CAMERA: the sunk eye is half the swim controller over its centre, and the centre is the clamped sphere\'s, its radius over the feet - 0.50, and 0.65 in the saddle (mutant: the port\'s 0.20)', () => {
  assert.equal(SWIM_EYE_HEIGHT, CAPSULE_RADIUS + SWIM_HEIGHT / 2);
  assert.equal(SWIM_RIDE_EYE_HEIGHT, CAPSULE_RADIUS + (SWIM_HEIGHT + SWIM_HORSE_DISPLACEMENT) / 2);
  assert.ok(SWIM_HEIGHT < 2 * CAPSULE_RADIUS && SWIM_HEIGHT + SWIM_HORSE_DISPLACEMENT < 2 * CAPSULE_RADIUS, 'both under 2 * radius: Unity\'s sphere');
});

test('SWIM-EYE CLEAR OF THE GROUND THROUGH THE BOUNCE: the real bobber swimming dips the eye BOUNCE_MAX and no further, and at the bottom of the dip the world\'s near plane (its own 0.2, at the default field of view) stays over flat ground at any pitch, and the eye over Deep Waters\' 0.25 band - at 0.20 it went to 0.03 (mutant: the port\'s 0.20)', () => {
  const b = new HeadBobber();
  const cam = { yaw: 0, pitch: 0 };
  let low = 0;
  for (let i = 0; i < 600; i++) low = Math.min(low, b.update(1 / 60, cam, { enabled: true, swimming: true, grounded: true })[1]);
  assert.ok(Math.abs(low + BOUNCE_MAX) < 1e-9, `the swim bounce dips BOUNCE_MAX: ${low}`);
  const eyeLow = SWIM_EYE_HEIGHT + low;
  const w = read('src/scenes/world.js');
  const near = Number(/perspective\(fieldOfView\(\) \+ climbFeel\.fovRad\(\), worldAspect, ([\d.]+), 6000\)/.exec(w)?.[1]);
  const fov = Number(/"FieldOfView": "(\d+)"/.exec(read('src/systems/settings/settingsDefaults.js'))?.[1]) * Math.PI / 180;
  assert.ok(near > 0 && fov > 0, 'the lens read');
  const reach = Math.hypot(near, near * Math.tan(fov / 2));   // the near plane's lowest point under the eye, over every pitch (no roll)
  assert.ok(eyeLow - reach > 0.05, `the near plane over the ground at the dip's foot: ${(eyeLow - reach).toFixed(3)} m`);
  const band = Number(/f\.camera\[1\] <= oceanY \+ ([\d.]+)\) return \{ under: true/.exec(read('src/scenes/deepWater/deepWatersPlayer.js'))?.[1]);
  assert.ok(band > 0 && eyeLow > band, `over Deep Waters' underwater band (${band}): ${eyeLow.toFixed(3)}`);
});
