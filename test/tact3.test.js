// TACT3 - THE CROWD AND THE DOOR (bible/12-Enhanced-AI/Tactics-Arc.md; Mac, 2026-10-02: "Players can grief others with
// guards by bringing them into interiors and blocking doorways. We need to reduce enemy clumping and also have enemies
// aware of each other"; his calls: the fixes are ALWAYS ON, the classic lane too). Every version of the grief, each
// over the real collider:
//   a. foes of DIFFERENT pools (the watch and a street's encounters, a building's own foes and the watch called in)
//      keep apart as each pool keeps its own;
//   b. no foe holds a doorway - one with no business in the threshold is eased out to its own side, one walking
//      through walks through, one fighting someone on the sill fights from the threshold's edge (AUDIT TACT C2);
//   c. the indoor watch walks into the room past the threshold, each on its own lane, never a stack in the door;
//   d. a door click passes a PEACEFUL foe standing in front of the door - the press and the plaque alike.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  spaceAcross, clearDoorways, doorSpotsNear, spaceFoes, FOE_SPACING_GAP, FOE_SPACING_SPEED,
  DOORWAY_DEPTH, DOORWAY_HALF_WIDTH, DOORWAY_CLEAR_SPEED,
} from '../src/characters/foeSpacing.js';
import { Collider } from '../src/player/collider.js';
import { indoorWatchSpot, GUARD_INDOOR_INSET, GUARD_INDOOR_LANE, GUARD_INDOOR_DOOR_OFFSET } from '../src/scenes/cityGuards.js';
import { yieldsToDoor, tryMobileEnemyActivate } from '../src/player/mobileEnemyActivate.js';
import { liveFoeTargets, peacefulFoePass, pickActivatableHit, DOOR_ACTIVATION_DISTANCE } from '../src/player/activate.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const quad = (c, a, b, d, e) => c.addMesh('scene', new Float32Array([...a, ...b, ...d, ...e]), new Uint32Array([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]), I);
const body = (x, z, over = {}) => ({ ai: { feet: [x, 0, z], height: 1.8, ...over }, dead: false });
const gap = (a, b) => Math.hypot(a.ai.feet[0] - b.ai.feet[0], a.ai.feet[2] - b.ai.feet[2]);
const DT = 1 / 60;
/** A door at the origin facing +X: the threshold is |x| < DOORWAY_DEPTH, |z| < DOORWAY_HALF_WIDTH. */
const DOOR = { pos: [0, 0, 0], normal: [1, 0, 0] };

// ── a. ACROSS POOLS ─────────────────────────────────────────────────

test('TACT3a: a guard and a bandit in one spot part to a capsule\'s width, at the push speed - and a pool\'s own pair is left to its own spaceFoes', () => {
  const ground = new Collider(() => 0);
  const guard = body(0, 0), bandit = body(0, 0);
  assert.equal(spaceAcross([[guard], [bandit]], ground, DT), 2);
  assert.ok(Math.abs(gap(guard, bandit) - 2 * FOE_SPACING_SPEED * DT) < 1e-9, 'one frame: each at the push speed');
  for (let i = 0; i < 60; i++) spaceAcross([[guard], [bandit]], ground, DT);
  assert.ok(gap(guard, bandit) >= FOE_SPACING_GAP - 1e-6 && gap(guard, bandit) < FOE_SPACING_GAP + 1e-6, `touching, no further (${gap(guard, bandit)})`);
  // two of ONE pool: not this pass's pair (no double push)
  const a = body(5, 5), b = body(5, 5);
  assert.equal(spaceAcross([[a, b], []], ground, DT), 0);
  assert.equal(spaceAcross([[a, b]], ground, DT), 0, 'one pool alone is nothing to do');
  assert.equal(spaceAcross([[guard], [bandit]], ground, 0), 0, 'a held frame moves nothing');
});

test('TACT3a: a mixed heap of watch and encounters spreads until no two overlap, the pools\' own passes and this one together', () => {
  const ground = new Collider(() => 0);
  const watch = Array.from({ length: 4 }, () => body(2, 2)), band = Array.from({ length: 4 }, () => body(2, 2));
  for (let i = 0; i < 300; i++) { spaceFoes(watch, ground, DT); spaceFoes(band, ground, DT); spaceAcross([watch, band], ground, DT); }
  const all = [...watch, ...band];
  let worst = Infinity;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) worst = Math.min(worst, gap(all[i], all[j]));
  assert.ok(worst >= FOE_SPACING_GAP * 0.95, `the closest pair ${worst.toFixed(3)}`);
});

test('TACT3a: the dead, a puppet and another player\'s foe (the hosts\' skip) are neither pushed nor push; the edge rule holds', () => {
  const ground = new Collider(() => 0);
  const live = body(0, 0), corpse = { ...body(0, 0), dead: true }, theirs = { ...body(0, 0), _ownFrom: 'peer-1' };
  const own = (f) => !!f.dead || !!f.puppet || f._ownFrom != null;
  assert.equal(spaceAcross([[live], [corpse, theirs]], ground, DT, own), 0);
  assert.deepEqual(live.ai.feet, [0, 0, 0]);
  // a ledge: floor only for x < 0.1 - a push off it is refused
  const ledge = new Collider();
  quad(ledge, [-10, 0, -10], [0.1, 0, -10], [0.1, 0, 10], [-10, 0, 10]);
  const edge = body(0.05, 0), inner = body(0.0, 0);
  for (let i = 0; i < 60; i++) spaceAcross([[inner], [edge]], ledge, DT);
  assert.ok(inner.ai.feet[0] < -0.5, 'the inner one gave the ground instead');
  assert.ok(edge.ai.feet[0] <= 0.1 + 1e-6, `never off the edge (${edge.ai.feet[0]})`);
});

// ── b. THE DOORWAY ──────────────────────────────────────────────────

test('TACT3b: a peaceful guard idling in a doorway is eased out to its own side\'s edge of the threshold, at the clear speed', () => {
  const ground = new Collider(() => 0);
  const inside = body(0.3, 0.2, { isHostile: false, destination: [0.3, 0, 0.2] });
  const outside = body(-0.5, -0.4, { isHostile: false, destination: [-0.5, 0, -0.4] });
  assert.equal(clearDoorways([inside, outside], [DOOR], ground, DT), 2);
  assert.ok(Math.abs(inside.ai.feet[0] - (0.3 + DOORWAY_CLEAR_SPEED * DT)) < 1e-9, 'one frame, the clear speed, outward on its side');
  assert.ok(Math.abs(outside.ai.feet[0] - (-0.5 - DOORWAY_CLEAR_SPEED * DT)) < 1e-9, '...and the other side\'s the other way');
  for (let i = 0; i < 120; i++) clearDoorways([inside, outside], [DOOR], ground, DT);
  assert.ok(Math.abs(inside.ai.feet[0] - DOORWAY_DEPTH) < 1e-6, `stands at the sill's edge (${inside.ai.feet[0]})`);
  assert.ok(Math.abs(outside.ai.feet[0] + DOORWAY_DEPTH) < 1e-6);
  assert.equal(inside.ai.feet[2], 0.2, 'along the normal only');
  assert.equal(clearDoorways([inside, outside], [DOOR], ground, DT), 0, 'out of the threshold: nothing more');
});

test('TACT3b: within a second a whole guard wall stacked in the door is out of it (the griefer\'s wall)', () => {
  const ground = new Collider(() => 0);
  const wall = Array.from({ length: 5 }, (_, i) => body(0.45, (i - 2) * 0.3, { isHostile: false }));
  for (let i = 0; i < 60; i++) { spaceFoes(wall, ground, DT); clearDoorways(wall, [DOOR], ground, DT); }
  for (const g of wall) {
    const f = g.ai.feet;
    assert.ok(!(Math.abs(f[0]) < DOORWAY_DEPTH - 1e-6 && Math.abs(f[2]) < DOORWAY_HALF_WIDTH), `out of the doorway: ${f.map((v) => v.toFixed(2))}`);
  }
});

test('TACT3b: one walking through walks through; one fighting someone on the sill steps to the edge, still in reach (AUDIT TACT C2: no exemption); a foe outside it, on another storey or a door with no normal is left alone', () => {
  const ground = new Collider(() => 0);
  const through = body(0.4, 0, { isHostile: true, destination: [-4, 0, 0] });
  const outside = body(DOORWAY_DEPTH + 0.01, 0, { isHostile: false });
  const wide = body(0, DOORWAY_HALF_WIDTH + 0.01, { isHostile: false });
  const upstairs = body(0.2, 0, { isHostile: false, flies: true }); upstairs.ai.feet[1] = 3;   // a flyer: free to move, so only the storey rule holds it
  assert.equal(clearDoorways([through, outside, wide, upstairs], [DOOR], ground, DT), 0);
  // AUDIT TACT C2: a hostile foe whose quarry stands on the sill is NOT exempt - it is eased to the edge, which is in its reach
  const fighting = body(0.9, 0, { isHostile: true, destination: [0.1, 0, 0.3] });
  for (let i = 0; i < 120; i++) clearDoorways([fighting], [DOOR], ground, DT);
  assert.ok(Math.abs(fighting.ai.feet[0] - DOORWAY_DEPTH) < 1e-6, 'out to the edge');
  assert.ok(Math.hypot(fighting.ai.feet[0] - 0.1, fighting.ai.feet[2] - 0.3) < 2.25, 'and still within DFU\'s reach of the one on the sill');
  assert.equal(clearDoorways([body(0.2, 0)], [{ pos: [0, 0, 0], normal: [0, 1, 0] }], ground, DT), 0, 'a door with no level normal');
  // the same sill-fighter at PEACE has no quarry: it steps out
  const idle = body(0.9, 0, { isHostile: false, destination: [0.1, 0, 0.3] });
  assert.equal(clearDoorways([idle], [DOOR], ground, DT), 1);
  // a hostile foe whose stale destination is on its own side, outside the threshold, steps out too
  const stale = body(0.5, 0, { isHostile: true, destination: [4, 0, 0] });
  assert.equal(clearDoorways([stale], [DOOR], ground, DT), 1);
});

test('TACT3b: a wall beyond the sill stops the step - through the collider, never through a wall', () => {
  const room = new Collider(() => 0);
  quad(room, [0.6, 0, -3], [0.6, 3, -3], [0.6, 3, 3], [0.6, 0, 3]);   // a wall 0.6 m in
  const g = body(0.1, 0, { isHostile: false });
  for (let i = 0; i < 120; i++) clearDoorways([g], [DOOR], room, DT);
  assert.ok(g.ai.feet[0] < 0.6, `held by the wall (${g.ai.feet[0]})`);
});

test('TACT3b: doorSpotsNear maps a pool\'s doors (matrix, centre, normal) to world spots within range, normal flattened', () => {
  const m = new Float32Array([0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 10, 2, 5, 1]);   // a quarter turn, then (10,2,5)
  const near = { matrix: m, centre: { x: 1, y: 0, z: 0 }, normal: { x: 1, y: 0.2, z: 0 } };
  const far = { matrix: I, centre: { x: 200, y: 0, z: 0 }, normal: { x: 1, y: 0, z: 0 } };
  const spots = doorSpotsNear([{ d: near }, { d: far }, { d: null }], [10, 0, 5], 40, (e) => e.d);
  assert.equal(spots.length, 1);
  assert.deepEqual(spots[0].pos.map((v) => +v.toFixed(6)), [10, 2, 4]);
  assert.deepEqual(spots[0].normal.map((v) => +v.toFixed(6) + 0), [0, 0, -1]);
  assert.equal(doorSpotsNear(null, [0, 0, 0]).length, 0);
});

// ── c. THE INDOOR WATCH ─────────────────────────────────────────────

test('TACT3c: the watch called indoors stands past the threshold, each on its own lane - never two at one point, never one in the doorway', () => {
  const room = new Collider(() => 0);
  const door = [0, 0, 0], normal = [0, 0, 1];
  const at = [0, 0, GUARD_INDOOR_DOOR_OFFSET];
  const spots = [0, 1, 2, 3, 4].map((i) => indoorWatchSpot(at, normal, i, room));
  for (const s of spots) {
    assert.ok(Math.abs(s[2] - GUARD_INDOOR_INSET) < 1e-6, `past the sill: ${s[2]}`);
    assert.ok(s[2] - door[2] >= DOORWAY_DEPTH, 'beyond the threshold');
  }
  assert.deepEqual(spots.map((s) => +(s[0] / GUARD_INDOOR_LANE).toFixed(6) + 0), [0, -1, 1, -2, 2], 'centre, then a lane each side, alternating');
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) assert.ok(Math.hypot(spots[i][0] - spots[j][0], spots[i][2] - spots[j][2]) >= GUARD_INDOOR_LANE - 1e-6);
  assert.deepEqual(at, [0, 0, GUARD_INDOOR_DOOR_OFFSET], 'the classic point itself is not moved');
  // no collider: straight there
  assert.deepEqual(indoorWatchSpot(at, normal, 0).map((v) => +v.toFixed(6)), [0, 0, GUARD_INDOOR_INSET]);
});

test('TACT3c: a narrow hall - the collider stops a lane at its wall, the watchman still inside the room', () => {
  const hall = new Collider(() => 0);
  quad(hall, [1, 0, -1], [1, 3, -1], [1, 3, 9], [1, 0, 9]);
  quad(hall, [-1, 0, -1], [-1, 3, -1], [-1, 3, 9], [-1, 0, 9]);
  const at = [0, 0, GUARD_INDOOR_DOOR_OFFSET];
  for (let i = 0; i < 5; i++) {
    const s = indoorWatchSpot(at, [0, 0, 1], i, hall);
    assert.ok(s[0] > -1 && s[0] < 1, `lane ${i} held inside the hall (${s[0]})`);
  }
});

test('TACT3c: the arm uses it, five in a row at most, the classic point and count kept', () => {
  const g = rd('src/scenes/cityGuards.js');
  const fn = g.slice(g.indexOf('async function spawnCityGuardsNow('));   // WATCH-FIX: PIN MOVED - the member's body, behind the crime response's turn
  const arm = fn.slice(fn.indexOf('if (interior?.eligible) {'), fn.indexOf('if (immediate) {'));
  assert.match(arm, /door\.pos\[0\] \+ door\.normal\[0\] \* GUARD_INDOOR_DOOR_OFFSET/);
  assert.match(arm, /const guardCount = 2 \+ Math\.floor\(rand\(\) \* 4\);/);
  assert.match(arm, /spawnGuardAt\(indoorWatchSpot\(at, door\.normal, i, collider\), 0, playerFeet \?\? null\)/);
});

// ── d. THE DOOR CLICK ───────────────────────────────────────────────

const foeAt = (x, hostile) => ({ ai: { feet: [x, 0, 0], height: 1.8, isHostile: hostile }, entity: {}, dead: false, mobileType: 0 });

test('TACT3d: yieldsToDoor - a peaceful foe yields to a door within the door\'s reach; a hostile one, or a door out of reach, does not', () => {
  assert.equal(yieldsToDoor(foeAt(1, false), 2), true);
  assert.equal(yieldsToDoor(foeAt(1, false), DOOR_ACTIVATION_DISTANCE), true, 'the reach itself is in reach');
  assert.equal(yieldsToDoor(foeAt(1, false), DOOR_ACTIVATION_DISTANCE + 0.01), false);
  assert.equal(yieldsToDoor(foeAt(1, false), Infinity), false, 'no door behind it');
  assert.equal(yieldsToDoor(foeAt(1, false), undefined), false);
  assert.equal(yieldsToDoor(foeAt(1, true), 2), false, 'a hostile foe still takes the click (DFU\'s one ray)');
  assert.equal(yieldsToDoor(null, 2), false);
});

test('TACT3d: the press - a peaceful guard in front of a door in reach falls through to the door; hostile, it is still the hit', () => {
  const open = new Collider(() => -100);
  const eye = [0, 1.2, 0], dir = [1, 0, 0];
  const calls = [];
  const deps = (doorBehind) => ({ nearerThan: doorBehind, doorBehind, hud: (t) => calls.push(t), modal: (t) => calls.push(t), playerFeet: [0, 0, 0] });
  assert.equal(tryMobileEnemyActivate(eye, dir, [foeAt(1.5, false)], open, 76.8, 'info', {}, deps(2.5)), false, 'the door takes it');
  assert.equal(calls.length, 0, 'and the guard says nothing');
  assert.equal(tryMobileEnemyActivate(eye, dir, [foeAt(1.5, true)], open, 76.8, 'info', {}, deps(2.5)), true, 'hostile: the foe is the hit');
  assert.equal(tryMobileEnemyActivate(eye, dir, [foeAt(1.5, false)], open, 76.8, 'info', {}, deps(Infinity)), true, 'no door behind: the guard is the hit');
});

test('TACT3d: the plaque agrees - liveFoeTargets marks the peaceful, peacefulFoePass drops their hit with a door in reach behind', () => {
  const open = new Collider(() => -100);
  const eye = [0, 1.2, 0], dir = [1, 0, 0];
  const peace = liveFoeTargets([foeAt(1.5, false)], 'mobileGuard'), war = liveFoeTargets([foeAt(1.5, true)], 'mobileGuard');
  assert.equal(peace[0].peaceful, true);
  assert.equal('peaceful' in war[0], false, 'a hostile target carries no mark');
  const hp = pickActivatableHit(eye, dir, peace, open), hw = pickActivatableHit(eye, dir, war, open);
  assert.ok(hp && hw);
  assert.equal(peacefulFoePass(hp, peace, 2.5), null);
  assert.equal(peacefulFoePass(hw, war, 2.5), hw);
  assert.equal(peacefulFoePass(hp, peace, Infinity), hp);
  assert.equal(peacefulFoePass(hp, peace, DOOR_ACTIVATION_DISTANCE + 0.01), hp);
  assert.equal(peacefulFoePass(null, peace, 2.5), null);
});

test('TACT3: the hosts wire it - the street and the building each frame, the press and the plaque', () => {
  const w = rd('src/scenes/world.js'), m = rd('src/scenes/worldModes.js');
  assert.match(w, /exteriorFoes\.update\(foeDt[^\n]*\n\s*if \(_deckBodies\.size\) navalLeash\(\);[^\n]*\n(?:[^\n]*\n){0,3}\s*spaceAcross\(\[cityGuards\.guards, exteriorFoes\.foes\], collider, foeFrameDt\(foeDt\), _ownTact\);\n\s*if \(cityGuards\.guards\.length \|\| exteriorFoes\.foes\.length\) clearDoorways\(\[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\], _tactDoorSpots\(_pf\), collider, foeFrameDt\(foeDt\), _ownTact\);/);
  assert.match(w, /const _ownTact = \(f\) => spacingSkips\(f\) \|\| f\._ownFrom != null \|\| _deckBodies\.has\(f\);/);
  assert.match(m, /if \(interiorCtx && !overlayHeld\) \{\n[^\n]*\n\s*spaceAcross\(\[interiorFoes\?\.foes \?\? \[\], interiorGuards\?\.guards \?\? \[\]\], interiorCtx\.collider, foeFrameDt\(foeDt\), own\);\n\s*clearDoorways\(interiorFoePool\(\), \[\.\.\.doorSpotsNear\(interiorCtx\.doors, player\.pos, 30\), \.\.\.actionDoorSpots\(interiorCtx\.actions\?\.objects, player\.pos, 30\)\], interiorCtx\.collider, foeFrameDt\(foeDt\), own\);/);
  assert.match(w, /\[\.\.\.exteriorFoes\.foes, \.\.\.cityGuards\.guards\], collider, reach,\n\s*getInteractionMode\(\), playerEntity, \{\n\s*nearerThan,\n\s*doorBehind: _race\.doorDistance,/);
  assert.match(m, /tryMobileEnemyActivate\(eye, dir, interiorFoePool\(\), interiorCtx\.collider,\n\s*reach, getInteractionMode\(\), playerEntity, \{\n\s*nearerThan,\n\s*doorBehind: doorDistanceOf\(eye, dir, targets, interiorCtx\.collider\),/);
  assert.match(w, /foe: \(\(ft\) => peacefulFoePass\(pickActivatableHit\(cam\.pos, _hd, ft, collider\), ft, modes\.exteriorActivationDistance\(cam\.pos, _hd\), getInteractionMode\(\)\)\)\(\[\.\.\.exteriorFoes\.liveTargets\(\), \.\.\.cityGuards\.liveTargets\(\)\]\),/);
  assert.match(m, /foe: peacefulFoePass\(pickActivatableHit\(mwv\.eye, d, liveFoes, interiorCtx\.collider\), liveFoes, doorDistanceOf\(mwv\.eye, d, interiorActivationTargets\(\), interiorCtx\.collider\), getInteractionMode\(\)\),/);
});
