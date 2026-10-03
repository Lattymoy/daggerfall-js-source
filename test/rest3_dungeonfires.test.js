// REST3 (2026-10-03, bible/06-Systems/Rest-Arc.md section 4; Mac: "Dungeon layouts now recieve multiple strategic
// placements for campfires"): THE DUNGEON'S OWN FIRES - a pure law over the layout's markers, blocks, water and doors,
// the collider's answers handed in; every client the same fires, nothing on the wire. The entrance fire, the deep fire,
// the spread 80 m apart; N = clamp(round(blocks / 3), 2, 7), an elite half. Drawn as the layout's own 210/1, lit, a
// hearth (warmth, cooking, the camp rest kind, a rest point online), a 15 m ward, on the held map once seen and on the
// compass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DFIRE, DUNGEON_FIRE_FLAT, dungeonFireCount, fireCandidates, landCandidates, chooseFires, placeDungeonFires, dungeonStart,
  enemyMarks, isBorderBlock, inFireWard, colliderFireProbe,
} from '../src/world/dungeonFires.js';
import { Collider } from '../src/player/collider.js';
import { RDB_SIDE } from '../src/world/rdbLayout.js';
import { FIRE_FLAT } from '../src/systems/survival/camp.js';
import { FIRE_MARK_CSS, nodeMarkCss, withFireMarks } from '../src/ui/nodeMarks.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const mk = (record, x, z, y = 0.5, archive) => (archive == null ? { record, x, y, z } : { record, x, y, z, archive });
/** A row of `n` blocks along x, the first the starting block, one start marker and one treasure marker in each. */
function row(n, { water = 10000, enemiesAt = [] } = {}) {
  return Array.from({ length: n }, (_, i) => ({
    name: i === n - 1 ? 'B0000001.RDB' : `N00000${i}.RDB`, originX: i * RDB_SIDE, originZ: 0, isStartingBlock: i === 0,
    layout: {
      waterLevel: water,
      markers: [mk(i === 0 ? 10 : 19, 5, 5), mk(19, 30, 30), ...enemiesAt.filter((e) => e.block === i).map((e) => mk(15, e.x, e.z))],
      startMarkers: i === 0 ? [mk(10, 5, 5)] : [],
    },
  }));
}
const open = { floor: (p) => ({ y: 0, ny: 1 }), room: () => true };   // a flat open floor at y 0 everywhere

test('REST3 the count: clamp(round(blocks / 3), 2, 7) over the non-border blocks; an elite half, at least one; the flame is the camp\'s 210/1', () => {
  assert.deepEqual([0, 1, 4, 6, 9, 12, 21, 40].map((b) => dungeonFireCount(b)), [2, 2, 2, 2, 3, 4, 7, 7]);
  assert.deepEqual([3, 9, 21].map((b) => dungeonFireCount(b, true)), [1, 1, 3]);
  assert.deepEqual(DUNGEON_FIRE_FLAT, FIRE_FLAT);
  assert.equal(isBorderBlock('B0000004.RDB'), true); assert.equal(isBorderBlock('N0000004.RDB'), false);
  assert.deepEqual([DFIRE.spacingM, DFIRE.entranceM, DFIRE.doorM, DFIRE.enemyM, DFIRE.dryM, DFIRE.wardM], [80, 25, 3, 8, 0.5, 15]);
});

test('REST3 the candidates: start, enter, treasure and quest markers (199), fixed treasure (216), each non-border block\'s centre - never an enemy marker, never a 216 sharing a 199 record', () => {
  const blocks = [{
    name: 'N1.RDB', originX: 100, originZ: 0, isStartingBlock: true,
    layout: { waterLevel: 10000, markers: [mk(10, 1, 1), mk(8, 2, 2), mk(19, 3, 3), mk(11, 4, 4), mk(18, 5, 5), mk(15, 6, 6), mk(16, 7, 7), mk(15, 8, 8, 0.5, 216), mk(0, 9, 9)] },
  }, { name: 'B1.RDB', originX: 0, originZ: 0, isStartingBlock: false, layout: { waterLevel: 10000, markers: [mk(19, 1, 1)] } }];
  const c = fireCandidates(blocks);
  assert.deepEqual(c.map((x) => x.pos[0]), [101, 102, 103, 104, 105, 108, 100 + RDB_SIDE / 2, 1], 'five markers, the 216, the centre; the border block\'s marker but no centre');
  assert.equal(c[0].start, true); assert.equal(c.at(-1).start, false);
  assert.deepEqual(enemyMarks(blocks).map((p) => p[0]), [106, 107], 'the 216/15 is no enemy');
  assert.deepEqual(dungeonStart(blocks), null, 'no startMarkers list, no start');
});

test('REST3 the floor and the rules: a flat floor within 4 m, half a metre over the water, 3 m from a door, 8 m from an enemy on its storey, and room to sit', () => {
  const c = (k, water = -Infinity) => ({ pos: [k * 20, 1, 0], water });   // twenty metres apart: each rule its own candidate
  const probe = {
    // AUDIT REST-PARTY (PIN MOVED): the ramp's face under the marker alone - C3's ring asks eight points round it, two
    // of them on x = 40, and a ramp along that whole line was refused by the ring whatever the centre's own test said
    floor: (p) => (p[0] === 20 ? null : p[0] === 40 && p[2] === 0 ? { y: 0, ny: 0.8 } : { y: 0, ny: 1 }),
    room: (p) => p[0] !== 140,
  };
  const kept = landCandidates([c(1), c(2), c(3), c(4, 0), c(5), c(6), c(7), c(8)], { probe, doors: [[100, 0, 2]], enemies: [[120, 0, 7], [160, 20, 0]] });
  assert.deepEqual(kept.map((k) => k.pos[0] / 20), [3, 8], 'no floor; a ramp; dry; a door; an enemy; no room - and the enemy a storey up is not this floor\'s');
  assert.equal(kept[0].pos[1], 0, 'landed on its floor');
});

/** A 20 m square room, 4 m high, centred on the origin: floor, ceiling, four walls - one mesh, the 'dungeon' bucket. */
function room({ ceiling = true } = {}) {
  const c = new Collider(() => -Infinity);
  const v = [], idx = [];
  const quad = (a, b, cc, d) => { const n = v.length / 3; v.push(...a, ...b, ...cc, ...d); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  const H = 10, T = 4;
  quad([-H, 0, -H], [H, 0, -H], [H, 0, H], [-H, 0, H]);   // floor
  if (ceiling) quad([-H, T, -H], [H, T, -H], [H, T, H], [-H, T, H]);
  quad([-H, 0, -H], [H, 0, -H], [H, T, -H], [-H, T, -H]); quad([-H, 0, H], [H, 0, H], [H, T, H], [-H, T, H]);
  quad([-H, 0, -H], [-H, 0, H], [-H, T, H], [-H, T, -H]); quad([H, 0, -H], [H, 0, H], [H, T, H], [H, T, -H]);
  c.addMesh('dungeon', v, idx, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return c;
}

test('REST3 the rays (colliderFireProbe, the host\'s and the probe tool\'s): the floor under a marker and its normal; room in the middle of a room; a wall at arm\'s length, the roof over it and the void beside it refuse', () => {
  const pr = colliderFireProbe(room());
  const f = pr.floor([0, 0.5, 0]);
  assert.ok(Math.abs(f.y) < 1e-6 && f.ny > 0.99, 'the floor, facing up');
  assert.equal(pr.floor([0, 9, 0]), null, '9 m up: the ceiling 5 m under it, past the reach');
  assert.equal(pr.room([0, 0, 0]), true, 'the middle of the room');
  assert.equal(pr.room([9.5, 0, 0]), false, 'a wall within a metre and a half');
  assert.equal(pr.room([0, 4, 0]), false, 'on the room\'s roof: no ceiling over it');
  assert.equal(pr.room([0, 0, 40]), false, 'the void beside it: nothing over it');
  assert.equal(pr.room([0, -2, 0]), false, 'under the room: a ceiling (its floor) but no walls round it');
  assert.equal(colliderFireProbe(room({ ceiling: false })).room([0, 0, 0]), false, 'walls round it, open over it: a roof, not a room');
});

test('REST3 the choice: the entrance fire by the start, the deep fire at the far reach, the spread 80 m apart - none near a fire the layout already stands; the same every call', () => {
  const blocks = row(12);   // 11 inner blocks -> round(11 / 3) = 4
  const fires = placeDungeonFires({ blocks, probe: open, seed: 1234 });
  assert.equal(fires.length, 4);
  assert.deepEqual(fires[0], [5, 0, 5], 'the entrance fire on the start marker');
  const far = Math.max(...fireCandidates(blocks).map((c) => c.pos[0]));
  assert.equal(fires[1][0], far, 'the deep fire at the far end');
  for (let i = 0; i < fires.length; i++) for (let j = i + 1; j < fires.length; j++) assert.ok(Math.hypot(fires[i][0] - fires[j][0], fires[i][2] - fires[j][2]) >= DFIRE.spacingM);
  assert.deepEqual(placeDungeonFires({ blocks, probe: open, seed: 1234 }), fires, 'deterministic');
  // a brazier by the door: no entrance fire is added - the layout's own is it
  const withBrazier = placeDungeonFires({ blocks, probe: open, seed: 1234, existing: [[8, 0, 8]] });
  assert.ok(withBrazier.every((p) => Math.hypot(p[0] - 8, p[2] - 8) >= DFIRE.spacingM), 'none within 80 m of the brazier');
  // an elite: half
  assert.equal(placeDungeonFires({ blocks, probe: open, seed: 1234, elite: true }).length, 2);
  // nothing valid, nothing placed
  assert.deepEqual(placeDungeonFires({ blocks, probe: { floor: () => null, room: () => true }, seed: 1 }), []);
});

test('REST3 a dungeon too small for its count stands what fits 80 m apart - never two fires closer', () => {
  const valid = Array.from({ length: 16 }, (_, i) => ({ pos: [i * 10, 0, 0], start: i === 0, water: -Infinity }));
  assert.deepEqual(chooseFires(valid, { seed: 7, start: [0, 0, 0], count: 4 }).map((p) => p[0]), [0, 150], 'the entrance and the deep fire; nothing 80 m from both');
  const long = Array.from({ length: 31 }, (_, i) => ({ pos: [i * 10, 0, 0], start: i === 0, water: -Infinity }));
  assert.deepEqual(chooseFires(long, { seed: 7, start: [0, 0, 0], count: 2, existing: [[300, 0, 0]] }).map((p) => p[0]), [0, 220], 'the deep fire keeps 80 m from a brazier at the far end');
});

test('REST3 the height band: a storey with candidates and no fire takes the next pick before a farther spot on a lit one', () => {
  const at = (x, y, start = false) => ({ pos: [x, y, 0], start, water: -Infinity });
  const valid = [at(0, 0, true), at(400, 0), at(200, 0), at(100, -30)];
  const fires = chooseFires(valid, { seed: 1, start: [0, 0, 0], count: 3 });
  assert.deepEqual(fires.map((p) => p[0]), [0, 400, 100], 'the deep fire, then the lower storey before the far middle');
});

test('REST3 the name: a placed fire is a Campfire on the plaque, a layout brazier a Fire - both rest and cook', async () => {
  const { createCamps } = await import('../src/scenes/camps.js');
  const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
  _resetForTests(); setPref('survival', true);
  const p = createCamps({ hearths: () => [{ x: 0, y: 1, z: 0, foot: 0, w: 1, h: 2 }, { x: 9, y: 1, z: 0, foot: 0, w: 1, h: 2, placed: true }], entity: { items: [] }, say: () => {} });
  assert.deepEqual([p.hoverName('hearth:0').title, p.hoverName('hearth:1').title], ['Fire', 'Campfire']);
  assert.deepEqual(p.hoverName('hearth:1').actions.map((a) => a.id), ['rest', 'cook']);
  _resetForTests();
});

test('REST3 the ward: no wandering spawn stands within 15 m of a dungeon fire', () => {
  const fires = [[0, 0, 0]];
  assert.equal(inFireWard(fires, { x: 10, y: 0, z: 10 }), true);
  assert.equal(inFireWard(fires, { x: 12, y: 0, z: 10 }), false);
  assert.equal(inFireWard([], { x: 0, y: 0, z: 0 }), false);
});

test('REST3 the compass: a fire within reach in the flame\'s yellow, under the nodes (the nodes stay last), dimmer the farther; none, the nodes alone', () => {
  assert.equal(nodeMarkCss('fire'), FIRE_MARK_CSS);
  const nodes = [{ xz: [9, 9], mark: 'mining', a: 1 }];
  const pts = withFireMarks(nodes, [[0, 0, 10], [0, 0, 500]], [0, 0, 0]);
  assert.deepEqual(pts.map((p) => p.mark), ['fire', 'mining']);
  assert.deepEqual(pts[0].xz, [0, 10]);
  assert.ok(pts[0].a < 1 && pts[0].a > 0.5);
  assert.equal(withFireMarks(nodes, [], [0, 0, 0]), nodes);
  assert.equal(withFireMarks(null, [[0, 0, 900]], [0, 0, 0]), null);
});

test('REST3 by source: the dungeon places them after its geometry and before its batches and lights, as 210/1 flats, torches, lights and hearths; never in the Burning Court; the ward in the spawn; the map and the compass', () => {
  const dc = rd('src/scenes/dungeonContext.js');
  const at = (re) => { const m = dc.search(re); assert.ok(m >= 0, String(re)); return m; };
  const place = at(/const dungeonFires = isGateArena\(dfLocation\) \? \[\] : placeDungeonFires\(\{/);
  assert.ok(at(/collider\.addMesh\('dungeon', cpu\.positions, cpu\.indices, matrix\);/) < place);
  assert.ok(place < at(/for \(const \[key, centers\] of flatGroups\) \{/));
  assert.ok(place < at(/const flicker = new CityLightAnimator\(lights\.length/));
  assert.match(dc, /dungeonHearths\.push\(\{ x: p\[0\], y: cy, z: p\[2\], foot: p\[1\], w: size\.w, h: size\.h, placed: true \}\);/);
  assert.match(dc, /lights\.push\(\{ x: p\[0\], y: p\[1\] \+ FIRE_LIGHT_UP, z: p\[2\], range: FIRE_LIGHT_RANGE \}\);/);
  assert.match(dc, /torches\.push\(\{ pos: \[p\[0\], cy, p\[2\]\], handle: null \}\);/);
  assert.match(dc, /if \(spot && [^\n]*inFireWard\(dungeonFires, spot\)\) spot = null;/);   // AUDIT REST-PARTY (PIN MOVED): the spawn asks the ward - C1's online gate before it is C1's own pin
  assert.match(dc, /fires: dungeonFires,/);
  assert.match(dc, /withFireMarks\(opts\.nodeMarks\?\.\(playerFeet\) \?\? null, dungeonFires, playerFeet\)/);
  assert.match(rd('src/ui/automapDoor.js'), /fires: deps\.fires \?\? null,/);
  assert.match(rd('src/ui/automapSheet.js'), /out\.push\(\{ x, z, y: p\[1\], kind: 'fire', name: 'Campfire' \}\);/);
  assert.match(rd('src/ui/inkAutomap.js'), /if \(m\.kind === 'fire'\) \{/);
  assert.match(rd('src/scenes/camps.js'), /hearths\?\.\(\)\?\.\[Number\(key\.slice\(7\)\)\]\?\.placed \? 'Campfire' : 'Fire'/);
});
