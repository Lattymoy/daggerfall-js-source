// BOUNTY-ROCK (FIELD BUGS 2026-10-03, Flylight on Discord: "Bounty packs can spawn inside rocks" - an Orc Warlord pack's
// mark on a World of Daggerfall rock face). The open-ground stand (_standCampEncounter: a bounty's pack, a camp, an
// Overworld band) put its anchor on the TERRAIN's floor and its members round it by the ring law; under a rock the
// terrain is still there, and from inside one the ring's ray meets its inner walls and its open-space test sees no face
// near - so the pack stood inside the rock. Now a spot inside static solid is refused: the collider's own point-in-solid
// (partsHolding's odd count of crossings straight up, ROCK-FREE's), the real collider, and the stand lifted from
// world.js's own source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Collider } from '../../../src/player/collider.js';
import { boxColliderTriangles } from '../../../src/world/prefabColliders.js';
import { partyGroupMembers } from '../../../src/systems/party/partyScale.js';
import { PACK_SPACING, PACK_ALERT_RADIUS } from '../../../src/systems/campEncounters.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** A rock as a box (prefabColliders' own closed skin); `open` - no bottom faces, as a model standing in the ground has. */
function rockMesh({ min, max, open = false }) {
  const m = boxColliderTriangles({ m_Center: { x: (min[0] + max[0]) / 2, y: (min[1] + max[1]) / 2, z: (min[2] + max[2]) / 2 }, m_Size: { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] } });
  if (!open) return m;
  const low = (v) => m.positions[v * 3 + 1] === min[1];
  const indices = [];
  for (let i = 0; i < m.indices.length; i += 3) if (!(low(m.indices[i]) && low(m.indices[i + 1]) && low(m.indices[i + 2]))) indices.push(m.indices[i], m.indices[i + 1], m.indices[i + 2]);
  return { positions: m.positions, indices };
}
const pixel = (rocks) => { const col = new Collider(); for (const r of rocks) { const m = rockMesh(r); col.addMesh('pixel', m.positions, m.indices, I); } return col; };

test('BOUNTY-ROCK insideSolid: a point in a rock - closed, or open beneath as one standing in the ground - is inside; beside it, over it, or under an arch it is not; a moving bucket (a boat\'s) holds nothing (mutants: the line\'s parity; movers counted)', () => {
  const ROCK = { min: [100, -5, 100], max: [400, 180, 400] };   // a field's rock, 300 m across, its foot in the ground
  for (const open of [false, true]) {
    const col = pixel([{ ...ROCK, open }]);
    assert.equal(col.insideSolid([250, 0.5, 250]), true, `${open ? 'open beneath' : 'closed'}: the middle of it, at the ground`);
    assert.equal(col.insideSolid([101, 0.5, 399]), true, 'by its edge, still in it');
    assert.equal(col.insideSolid([99, 0.5, 250]), false, 'a metre off its face');
    assert.equal(col.insideSolid([250, 181, 250]), false, 'on top of it');
  }
  // an arch: a slab overhead, open ground beneath it - two skins crossed, an even count
  const arch = pixel([{ min: [0, 20, 0], max: [50, 30, 50] }]);
  assert.equal(arch.insideSolid([25, 0.5, 25]), false, 'under an arch is open ground');
  // a mover's bucket (a ship) never holds a spawn point out
  const boats = new Collider();
  const hull = rockMesh({ min: [-10, -5, -10], max: [10, 10, 10] });
  boats.addMesh('boat', hull.positions, hull.indices, I, () => [0, 0, 0], () => [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.equal(boats.insideSolid([0, 0, 0]), false);
  assert.equal(new Collider().insideSolid([0, 0, 0]), false, 'no geometry, nothing inside');
});

// ---- the stand, lifted from world.js (the auditbounty1 / auditpscale1 mount) ----
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const mount = (src, scope, tail) => { const k = Object.keys(scope); return new Function(...k, `${src}\n${tail}`)(...k.map((x) => scope[x])); };
function balanced(text, from, open = '(', close = ')') {
  let depth = 0;
  for (let i = text.indexOf(open, from); i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close && --depth === 0) return text.slice(from, i + 1);
  }
  throw new Error('unbalanced');
}
const WORLD = strip(read('src/scenes/world.js'));
/** world.js's own `_inRock` over a collider, as the host binds it. */
function inRockOver(collider) {
  const at = WORLD.indexOf('const _inRock = ');
  assert.ok(at > 0, 'the host\'s rock test is found');
  return mount('', { collider }, `return ${WORLD.slice(at + 'const _inRock = '.length, WORLD.indexOf(';', at))};`);
}
function campStand(scope) {
  const at = WORLD.indexOf('const _standCampEncounter = (hit, feet) => {');
  assert.ok(at > 0, 'the camp stand is found');
  const fn = balanced(WORLD, at + 'const _standCampEncounter = '.length, '{', '}');
  return mount('', scope, `return (hit, feet) => ${fn.slice(fn.indexOf('{'))};`);
}

test('BOUNTY-ROCK the stand: a pack\'s anchor rolled inside a rock is refused for the next roll out of it, and a member placed inside one for the next spot - the whole pack stands on open ground; every anchor in rock stands nobody (mutants: the anchor\'s guard dropped; the members\')', async () => {
  const col = pixel([{ min: [100, -5, -50], max: [400, 180, 250], open: true }]);
  const _inRock = inRockOver(col);
  const run = (anchors, spots) => {
    const stood = [];
    let a = 0, s = 0;
    const stand = campStand({
      placeFoeEnv: () => ({}), collider: col, cam: { yaw: 0 }, fieldOfView: () => 1, entityOccupancy: () => () => false, _placingPool: () => [],
      campAnchorSpot: () => anchors[Math.min(a++, anchors.length - 1)], LOOSE_FOE_PLACE_ATTEMPTS: 12,
      placeFoeFreely: () => spots[(s++) % spots.length],
      _inAnyLocationRect: () => false, _nearRoad: () => false, _overDeepWater: () => false, _inRock, CAMP_ROAD_CLEAR_M: 4,
      campMembers: (types) => partyGroupMembers(types, 1), ENEMY_BASICS: {}, CAMP_SIGHT_RADIUS: 60, MAX_ACTIVE_ENCOUNTER_FOES: 8,
      exteriorFoes: { newCampId: () => 1, spawnFoe: (mobileType, at) => { stood.push(at); return Promise.resolve({ ai: {}, entity: {} }); } },
    });
    const r = stand({ mobileTypes: [4, 4, 4], fixed: true, spacing: PACK_SPACING, alertRadius: PACK_ALERT_RADIUS, minDistance: 60, maxDistance: 110, bearingDegrees: 90, spawnOpts: { loose: true, transient: true } }, [0, 0, 0]);
    return { r, stood };
  };
  // the first roll lands 150 m out, in the rock; the next on the open ground short of it
  const { r, stood } = run([{ x: 150, y: 0, z: 0 }, { x: 70, y: 0, z: 0 }], [{ x: 120, y: 0, z: 0 }, { x: 72, y: 0, z: 3 }, { x: 68, y: 0, z: -2 }]);
  assert.ok(r, 'the pack stood');
  assert.deepEqual(r.anchorFeet, [70, 0, 0], 'its anchor the open-ground roll');
  assert.equal(stood.length, 3, 'all three members stood');
  for (const p of stood) assert.equal(col.insideSolid([p[0], p[1] + 0.5, p[2]]), false, `no member inside the rock (${p})`);
  // every anchor in rock: nobody stands - the host's retry rolls again on a new bearing
  assert.equal(run([{ x: 200, y: 0, z: 100 }], [{ x: 72, y: 0, z: 3 }]).r, null);
});

test('BOUNTY-ROCK every open-ground spot asks it: the stand\'s anchor and members, the split hunt\'s trail spot, the farm\'s ground - beside the deep-water guards, which stand as they were (the mutant lists quote them)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const _inRock = \(x, y, z\) => !!collider\?\.insideSolid\?\.\(\[x, y \+ 0\.5, z\]\);/);
  assert.match(w, /if \(anchor && _overDeepWater\(anchor\.x, anchor\.z\)\) anchor = null;[^\n]*\n[^\n]*\n\s*if \(anchor && _inRock\(anchor\.x, anchor\.y, anchor\.z\)\) anchor = null;/);
  assert.match(w, /if \(spot && _overDeepWater\(spot\.x, spot\.z\)\) spot = null;[^\n]*\n[^\n]*\n\s*if \(spot && _inRock\(spot\.x, spot\.y, spot\.z\)\) spot = null;/);
  const trail = w.slice(w.indexOf('const _bountyTrailSpot = ('), w.indexOf('const _standBountyPack = ('));
  assert.match(trail, /if \(_inRock\(x, y, z\)\) continue;/, 'the trail spot: a spot in rock stood nobody, on every retry');
  assert.match(w, /!_overDeepWater\(x, z\)\n\s*&& !_inRock\(x, y, z\);/, 'the farm\'s ground');
});
