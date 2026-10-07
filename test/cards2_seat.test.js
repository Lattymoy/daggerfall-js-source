// CARDS2 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 2; Mac: "needing to be in a tavern and being set up
// in a sort of table enviroment"): THE CARD TABLE AND ITS SEAT. Driven: the seats a table's box holds and their fixed
// order, the probe's veto, the seated eye's look at the table, the six kept round the sides, the nearest free seat,
// what counts as something to sit over, what stands a seated player up, the census's tally over fake blocks. Held by
// source: the interior context's table list behind the prop gate, and the interior host's seat - its target, its
// press, its stand, its held motor, its eye, its teardown - with the four hosts named.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CARD_TABLE_MODELS, isCardTableModel, SEAT_SPACING, SEAT_SIDE_MIN, SEAT_OUT, SEATED_EYE_HEIGHT, SEAT_SURFACE_MAX,
  seatSpots, cardTableSeats, nearestFreeSeat, seatFloorOk, leavesSeat, yawToward,
} from '../src/world/cardTables.js';
import { tavernFurniture } from '../tools/cardTableCensus.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const box = (x1, z1, y0 = 0, top = 0.8) => ({ min: [0, y0, 0], max: [x1, top, z1] });
const round = (v) => Math.round(v * 1e6) / 1e6;
const at = (s) => [round(s.x), round(s.z), s.side];

test('CARDS2 the table\'s ids: 41130, the one table this tree can name', () => {
  assert.deepEqual([...CARD_TABLE_MODELS], [41130]);
  assert.deepEqual([41130, 41100, 41106, 41000].map(isCardTableModel), [true, false, false, false], 'a chair, a bench, a bed are no table');
  assert.deepEqual([SEAT_SPACING, SEAT_SIDE_MIN, SEAT_OUT, SEATED_EYE_HEIGHT, SEAT_SURFACE_MAX], [0.75, 0.6, 0.45, 1.15, 0.55]);
});

test('CARDS2 the seats a table\'s box holds: as many as fit along each side, out from its edge, in a fixed order', () => {
  // Two metres by one: one seat at each end, two along each long side.
  assert.deepEqual(seatSpots(box(2, 1)).map(at), [
    [2.45, 0.5, '+x'], [-0.45, 0.5, '-x'], [0.5, 1.45, '+z'], [1.5, 1.45, '+z'], [0.5, -0.45, '-z'], [1.5, -0.45, '-z'],
  ]);
  assert.ok(seatSpots(box(2, 1)).every((s) => s.floorY === 0), 'on the floor the table stands on');
  // A side shorter than SEAT_SIDE_MIN seats nobody; one just long enough seats one.
  assert.deepEqual(seatSpots(box(2, 0.5)).map((s) => s.side), ['+z', '+z', '-z', '-z']);
  assert.deepEqual(seatSpots(box(0.6, 0.6)).map((s) => s.side), ['+x', '-x', '+z', '-z']);
  assert.deepEqual(seatSpots(box(0.5, 0.5)), []);
});

test('CARDS2 the seats kept: the probe\'s veto, the seated eye looking at the table\'s middle, two at least', () => {
  const t = { min: [0, 0.2, 0], max: [2, 1, 1] };
  const all = cardTableSeats(t, () => true);
  assert.equal(all.length, 6);
  const end = all[0];
  assert.deepEqual(end.eye.map(round), [2.45, 1.35, 0.5]);
  assert.equal(round(end.yaw), round(-Math.PI / 2), 'the +x end looks down -x, at the middle');
  assert.equal(round(end.pitch), round(Math.atan2(1 - 1.35, 1.45)), 'down at the table\'s top');
  for (const s of all) {
    const l = Math.hypot(1 - s.eye[0], 0.5 - s.eye[2]);
    assert.deepEqual([round(Math.sin(s.yaw)), round(Math.cos(s.yaw))], [round((1 - s.eye[0]) / l), round((0.5 - s.eye[2]) / l)], `${s.side} looks at the middle`);
  }
  // The probe is asked from the table's middle at the eye's height to the eye.
  const asked = [];
  cardTableSeats(t, (from, to) => { asked.push([from.map(round), to.map(round)]); return true; });
  assert.deepEqual(asked[0], [[1, 1.35, 0.5], [2.45, 1.35, 0.5]]);
  // A wall along both ends: four left.
  assert.deepEqual(cardTableSeats(t, (f, to) => to[0] > 0 && to[0] < 2).map((s) => s.side), ['+z', '+z', '-z', '-z']);
  // One seat left is no card table.
  assert.deepEqual(cardTableSeats(t, (f, to) => to[0] > 2), []);
  assert.equal(cardTableSeats(t, (f, to) => to[0] > 2 || to[0] < 0).length, 2);
});

test('CARDS2 a long table keeps six, taken round the sides in turn', () => {
  const long = cardTableSeats(box(4, 1), () => true);
  assert.deepEqual(long.map((s) => s.side), ['+x', '-x', '+z', '+z', '-z', '-z']);
  assert.deepEqual(long.filter((s) => s.side === '+z').map((s) => round(s.x)), [0.4, 1.2], 'the first along each side, in its own order');
  assert.equal(seatSpots(box(4, 1)).length, 12);
});

test('CARDS2 the nearest free seat; something to sit over; what stands you up; the yaw\'s own law', () => {
  const seats = [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }];
  assert.equal(nearestFreeSeat(seats, 1.9, 0.2), 1);
  assert.equal(nearestFreeSeat(seats, 1.9, 0.2, [1]), 2);
  assert.equal(nearestFreeSeat(seats, 1.9, 0.2, [0, 1, 2]), -1);
  assert.equal(nearestFreeSeat([], 0, 0), -1);
  // The floor (1.15 down), a chair's seat (0.6 down) - not a table's top, not the air, not a drop.
  assert.deepEqual([1.15, 0.6, 0.59, Infinity, 2.01, NaN].map(seatFloorOk), [true, true, false, false, false, false]);
  assert.deepEqual([
    [{}, false], [{ forwards: true }, false], [{ backwards: true }, false], [{ left: true }, false], [{ right: true }, false],
    [{}, true], [{ analog: { x: 0.1, y: 0.1 } }, false], [{ analog: { x: 0, y: 0.5 } }, false], [null, false],
  ].map(([mv, j]) => leavesSeat(mv, j)), [false, true, true, true, true, true, false, true, false]);
  // The camera's forward is [sin(yaw), 0, cos(yaw)] (worldModes.js frame's `fwd`).
  for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1], [3, 4]]) {
    const y = yawToward(0, 0, dx, dz);
    const l = Math.hypot(dx, dz);
    assert.deepEqual([round(Math.sin(y)), round(Math.cos(y))], [round(dx / l), round(dz / l)]);
  }
});

test('CARDS2 the census: the tavern\'s props in the furniture range, counted, sized, the table marked', () => {
  const rmbs = [
    { name: 'TVRNAS01.RMB', buildingTypes: [15, 2], interiors: [
      [{ modelIdNum: 41130, objectType: 3 }, { modelIdNum: 41100, objectType: 3 }, { modelIdNum: 41100, objectType: 3 }, { modelIdNum: 41100, objectType: 2 }, { modelIdNum: 1234, objectType: 3 }],
      [{ modelIdNum: 41130, objectType: 3 }],   // not a tavern
    ] },
    { name: 'TVRNAS02.RMB', buildingTypes: [15], interiors: [[{ modelIdNum: 41100, objectType: 3 }, { modelIdNum: 43999, objectType: 3 }, { modelIdNum: 44000, objectType: 3 }]] },
  ];
  const sizes = { 41100: [0.5, 1, 0.5], 41130: [2, 0.8, 1] };
  assert.deepEqual(tavernFurniture(rmbs, (id) => sizes[id] ?? null), [
    { model: 41100, count: 3, blocks: 2, size: [0.5, 1, 0.5], table: false },
    { model: 41130, count: 1, blocks: 1, size: [2, 0.8, 1], table: true },
    { model: 43999, count: 1, blocks: 1, size: null, table: false },
  ]);
});

test('CARDS2 the interior context lists its card tables, a prop like the furniture after it', () => {
  const src = read('src/scenes/interiorContext.js');
  const gate = src.indexOf('    if (p.objectType !== PROP_MODEL_TYPE) continue;');
  const push = src.indexOf('    if (isCardTableModel(classicModelIdOf(p.modelIdNum))) tables.push({ aabb, matrix, modelIdNum: p.modelIdNum });');
  assert.ok(gate > 0 && push > gate, 'behind the prop gate - a non-prop table model is scenery, as a non-prop shelf is');
  assert.match(src, /^ {4}tables, {4}\/\/ CARDS2: the card tables$/m);
});

test('CARDS2 the interior host\'s seat: the target, the press, the stand, the held motor, the eye, the teardown, the four hosts', () => {
  const src = read('src/scenes/worldModes.js');
  const has = (s, why) => assert.ok(src.includes(s), why ?? s);
  has("    if (!cardSeat && inTavern()) interiorCtx.tables?.forEach((t, i) => {", 'a tavern\'s tables only, and none while seated');
  has("      if (cardSeatsOf(i).length) targets.push({ key: `cardtable:${i}`, aabb: t.aabb, distance: RAY_DISTANCE, reach: DEFAULT_ACTIVATION_DISTANCE, surface: true });", 'a table that seats two');
  has("        sitAtCardTable(Number(key.split(':')[1]));   // CARDS2");
  has("    if (cardSeat) { standFromCardTable(); return true; }", 'the press stands you up first');
  has('  function tryExit({ pressCast = false } = {}) {\n    if (cardSeat) { standFromCardTable(); return true; }', 'first in the press, before the ray');
  const leave = src.indexOf('    if (cardSeat && !overlayHeld && leavesSeat(mv, jumpHeld || !!player.toggleAutorun)) standFromCardTable();');
  assert.ok(leave > 0 && leave < src.indexOf('      player.update(dt, paralyzed ? {'), 'whatever would move the body stands it up first');
  const over = src.indexOf("    if (mode === 'interior') decorTool.cameraOverride(cam);");
  const seat = src.indexOf("    if (mode === 'interior' && cardSeat) cam.pos = cardSeat.eye.slice();");
  assert.ok(over > 0 && seat > over, 'the seated eye after the body\'s and the decorator\'s');
  has('    if (cardSeat) mwv.eye = cam.pos;   // CARDS2: seated, first person at the seat\n    const view = betterAmbience.view(', 'first person at the seat');
  has("    cardSeat = null;   // CARDS2: and nobody stays seated in a room they left");
  has("(key) => (typeof key === 'string' && key.startsWith('cardtable:') ? { title: 'Card table' } : null)");
  has("    return seatFloorOk(c.raycast(to, [0, -1, 0], SEAT_FLOOR_PROBE));");
  has("    if (!(len > 0) || c.raycast(from, [d[0] / len, d[1] / len, d[2] / len], len) < len) return false;");
  has("    cam.yaw = seats[k].yaw;\n    cam.pitch = seats[k].pitch;");
  has('  // THE FOUR HOSTS: this host only. A tavern is an interior; exterior.js, world.js and dungeonContext.js stand no');
  for (const other of ['src/scenes/exterior.js', 'src/scenes/world.js', 'src/scenes/dungeonContext.js'])
    assert.doesNotMatch(read(other), /cardtable:|sitAtCardTable/, `${other} seats nobody`);
});
