// FIX-D (2026-09-22, Discord): "Fire detected behind a door" - and The
// Frog's read of it: "Issue seems to be the torch beside the door,
// moreso than one behind the door itself".
//
// Both halves were real. A world fire's eye box was GUESSED - 1.2 m
// square and 2.4 m tall hung off the flame - so a brazier torch a pace
// from a shop door reached across the door's edge and won the ray. And
// the ray pick pardons a wall hit that lands inside the winner's own box
// (a thin mesh's surface sits inside its AABB), which a flat - no
// collider at all - must never be granted: the hit is the door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hearthAabb, collectHearths } from '../src/systems/survival/hearth.js';
import { pickActivatableHit } from '../src/player/activate.js';
import { raceWinner } from '../src/player/activationRace.js';
import { collectCityLights } from '../src/world/cityLights.js';
import { collectInteriorLights } from '../src/world/interiorLights.js';
import { createCamps } from '../src/scenes/camps.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const open = { raycast: () => Infinity };
const aim = (eye, at) => { const d = at.map((v, i) => v - eye[i]); const n = Math.hypot(...d); return d.map((v) => v / n); };

test('FIX-D: a hearth’s box is its sprite - w square, h tall, standing on its foot', () => {
  assert.deepEqual(hearthAabb({ x: 2, y: 9, z: -1, foot: -1, w: 0.8, h: 1.6 }), { min: [1.6, -1, -1.4], max: [2.4, 0.6000000000000001, -0.6] });
  // the flame's own y plays no part - it is the light, not the picture
  assert.deepEqual(hearthAabb({ x: 0, y: 0, z: 0, foot: 0, w: 1, h: 2 }), hearthAabb({ x: 0, y: 50, z: 0, foot: 0, w: 1, h: 2 }));
  // a hearth nobody measured warms, but stands no box - never a guess
  for (const h of [{ x: 0, y: 0, z: 0 }, { x: 0, z: 0, foot: 0, w: 1 }, { x: 0, z: 0, foot: 0, w: 0, h: 1 }, { x: 0, z: 0, foot: NaN, w: 1, h: 1 }, null]) {
    assert.equal(hearthAabb(h), null, JSON.stringify(h));
  }
});

test('FIX-D: The Frog’s doorway - aiming at the door beside a brazier torch names the DOOR', () => {
  // The wall is z = 0 and the door is 1.2 m wide in it. The torch stands
  // 35 cm out from the wall, just past the door's right edge; the player
  // stands off to that side and aims at the door.
  const door = { key: 3, aabb: { min: [-0.6, 0, -0.05], max: [0.6, 2.2, 0.05] }, distance: 3.2 };
  const torch = { x: 1.1, y: 1.6, z: 0.35, foot: 0, w: 0.5, h: 1.6 };
  const eye = [1.6, 1.6, 2.5];
  const dir = aim(eye, [0.4, 1.2, 0]);
  const race = (hearthTarget, d = dir) => raceWinner({ camp: pickActivatableHit(eye, d, [hearthTarget], open), ground: pickActivatableHit(eye, d, [door], open) })?.key;
  // THE BUG, reconstructed: the old box, hung off the flame.
  const guessed = { key: 'hearth:0', aabb: { min: [torch.x - 0.6, torch.y - 1.8, torch.z - 0.6], max: [torch.x + 0.6, torch.y + 0.6, torch.z + 0.6] }, distance: 3.2 };
  assert.equal(race(guessed), 'hearth:0', 'the guessed box reached across the door - the plaque said "Fire"');
  // THE FIX: the pool's own target, off the sprite.
  const pool = createCamps({ hearths: () => [torch], entity: { items: [] } });
  const [real] = pool.targets();
  assert.deepEqual(real.aabb, hearthAabb(torch));
  assert.equal(real.noSurface, true, 'a flat has no collider of its own');
  assert.equal(race(real), 3, 'the door wins');
  // ...and the torch is still the torch when you aim at it
  assert.equal(race(real, aim(eye, [torch.x, 0.8, torch.z])), 'hearth:0', 'and aimed at the sprite, it is still a fire');
});

test('FIX-D: a fire BEHIND a door is behind the door - a flat gets no pardon from its own box', () => {
  // A brazier just inside a closed door: its box starts 10 cm behind
  // the door plane, so the collider's hit on the door lands within the
  // pardon's 15 cm skin of that box. A mesh is pardoned there (its own
  // surface sits inside its AABB); a flat has no surface in the
  // collider, so the hit is the door.
  const door = { raycast: (eye, dir, max) => { const t = (0 - eye[2]) / dir[2]; return t > 0 && t <= max ? t : Infinity; } };
  const box = { min: [-0.3, 0, -0.7], max: [0.3, 1.6, -0.1] };   // the door plane is z = 0
  const eye = [0, 1.2, 2];
  const dir = aim(eye, [0, 0.8, -0.3]);
  assert.equal(pickActivatableHit(eye, dir, [{ key: 'hearth:0', aabb: box, distance: 3.2, noSurface: true }], door), null, 'the fire is not named, or lit, through the door');
  assert.equal(pickActivatableHit(eye, dir, [{ key: 'mesh', aabb: box, distance: 3.2 }], door)?.key, 'mesh', 'a mesh keeps the pardon it was written for');
  assert.equal(pickActivatableHit(eye, dir, [{ key: 'hearth:0', aabb: box, distance: 3.2, noSurface: true }], open)?.key, 'hearth:0', 'and with the door open, the fire is there');
});

test('FIX-D: every collector hands the sprite it placed, in its own frame', () => {
  // the exterior pair: the light is the TOP of the flat, which stands on -yPos
  const size = { w: 0.5, h: 1.6 };
  const flat = (x, y, z) => ({ textureArchive: 210, textureRecord: 20, xPos: x, yPos: y, zPos: z });
  const block = { rmbBlock: { miscFlatObjectRecords: [flat(0, -40, 0)], subRecords: [{ xPos: 0, zPos: 0, exterior: { blockFlatObjectRecords: [flat(0, -80, 0)] } }] } };
  const lights = collectCityLights(block, () => size);
  for (const l of lights) {
    assert.equal(l.w, size.w); assert.equal(l.h, size.h);
    assert.ok(Math.abs(l.y - (l.foot + size.h)) < 1e-9, 'the flame is the sprite’s top, the foot a height under it');
  }
  assert.ok(lights[0].foot > 0 && lights[1].foot > lights[0].foot, '-yPos, scaled: a raised flat stands higher');
  // the interior: the flat stands on its y, the light is centre + offset
  const [il] = collectInteriorLights([{ archive: 210, record: 20, x: 1, y: 2, z: 3 }], () => size);
  assert.equal(il.foot, 2); assert.equal(il.w, size.w); assert.equal(il.h, size.h);
  // collectHearths carries it through
  assert.deepEqual(collectHearths([il]), [{ x: 1, y: il.y, z: 3, foot: 2, w: size.w, h: size.h }]);
  // the hosts: each passes it on, in its own frame
  assert.match(read('src/scenes/exterior.js'), /cityHearths\.push\(\{ \.\.\.l, foot: light\.foot, w: light\.w, h: light\.h \}\)/);
  assert.match(read('src/scenes/world.js'), /pixelHearths\.push\(\[lp\[0\], lp\[1\], lp\[2\], locLocal\[1\] \+ light\.foot, light\.w, light\.h\]\)/, 'pixel-local, like the flame');
  assert.match(read('src/scenes/world.js'), /e\.foot = h\[3\] \+ t\[1\]; e\.w = h\[4\]; e\.h = h\[5\];/, 'and through the floating origin with it');
  assert.match(read('src/scenes/interiorContext.js'), /foot: parentPt\(l\.x, l\.foot, l\.z\)\[1\]/, 'the interior’s foot goes into the parent frame too');
  assert.match(read('src/scenes/dungeonContext.js'), /foot: size \? f\.y - size\.h \/ 2 : undefined, w: size\?\.w, h: size\?\.h/, 'a dungeon flat’s y is its centre');
});
