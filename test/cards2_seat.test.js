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
  CARD_TABLE_MODELS, isCardTableModel, SEAT_SPACING, SEAT_SIDE_MIN, SEAT_SURFACE_MAX, SEAT_TAKEN_RADIUS,
  seatSpots, cardTableSeats, nearestFreeSeat, takenSeats, seatFloorOk, leavesSeat, yawToward,
} from '../src/world/cardTables.js';
import { tavernFurniture } from '../tools/cardTableCensus.mjs';
import { SEATED_EYE_HEIGHT, SEAT_OUT } from '../src/player/seatPose.js';
import { trs } from '../src/world/mat4.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const box = (x1, z1, y0 = 0, top = 0.8) => ({ min: [0, y0, 0], max: [x1, top, z1] });
const round = (v) => Math.round(v * 1e6) / 1e6;
const at = (s) => [round(s.lx), round(s.lz), s.side, s.nx, s.nz];

test('CARDS2 the table\'s ids: 41130, the one table this tree can name', () => {
  assert.deepEqual([...CARD_TABLE_MODELS], [41130]);
  assert.deepEqual([41130, 41100, 41106, 41000].map(isCardTableModel), [true, false, false, false], 'a chair, a bench, a bed are no table');
  assert.deepEqual([SEAT_SPACING, SEAT_SIDE_MIN, SEAT_OUT, round(SEATED_EYE_HEIGHT), SEAT_SURFACE_MAX, SEAT_TAKEN_RADIUS], [0.75, 0.6, 0.35, 1.22, 0.55, 0.3], 'the seated eye the seated body\'s head, the sitter\'s distance its own (seatPose.js)');
});

test('CARDS2 the seats a table\'s own box holds: as many as fit along each side, out from its edge, each with its side\'s inward way, in a fixed order', () => {
  // Two metres by one: one seat at each end, two along each long side.
  assert.deepEqual(seatSpots(box(2, 1)).map(at), [
    [2.35, 0.5, '+x', -1, 0], [-0.35, 0.5, '-x', 1, 0], [0.5, 1.35, '+z', 0, -1], [1.5, 1.35, '+z', 0, -1], [0.5, -0.35, '-z', 0, 1], [1.5, -0.35, '-z', 0, 1],
  ]);
  // A side shorter than SEAT_SIDE_MIN seats nobody; one just long enough seats one.
  assert.deepEqual(seatSpots(box(2, 0.5)).map((s) => s.side), ['+z', '+z', '-z', '-z']);
  assert.deepEqual(seatSpots(box(0.6, 0.6)).map((s) => s.side), ['+x', '-x', '+z', '-z']);
  assert.deepEqual(seatSpots(box(0.5, 0.5)), []);
});

test('CARDS2 the seats kept: the probe\'s veto, each seat square to its side, the eye looking down at the top, two at least', () => {
  const t = { aabb: { min: [0, 0.2, 0], max: [2, 1, 1] } };
  const all = cardTableSeats(t, () => true);
  assert.equal(all.length, 6);
  const end = all[0];
  assert.deepEqual(end.eye.map(round), [2.35, 1.42, 0.5]);
  assert.deepEqual([end.feet.map(round), round(end.top), end.floorY], [[2.35, 0.2, 0.5], 0.8, 0.2], 'the body\'s feet on the floor, the top above them');
  assert.equal(round(end.pitch), round(Math.atan2(1 - 1.42, 1.35)), 'down at the table\'s top');
  // AUDIT CARDS D3: square to its side, never turned to the middle - the +x end faces -x, a +z seat -z, a -z seat +z.
  assert.deepEqual(all.map((s) => [s.side, round(Math.sin(s.yaw)), round(Math.cos(s.yaw))]), [
    ['+x', -1, 0], ['-x', 1, 0], ['+z', 0, -1], ['+z', 0, -1], ['-z', 0, 1], ['-z', 0, 1],
  ]);
  // The probe is asked from the table's middle at the eye's height to the eye.
  const asked = [];
  cardTableSeats(t, (from, to) => { asked.push([from.map(round), to.map(round)]); return true; });
  assert.deepEqual(asked[0], [[1, 1.42, 0.5], [2.35, 1.42, 0.5]]);
  // A wall along both ends: four left.
  assert.deepEqual(cardTableSeats(t, (f, to) => to[0] > 0 && to[0] < 2).map((s) => s.side), ['+z', '+z', '-z', '-z']);
  // One seat left is no card table.
  assert.deepEqual(cardTableSeats(t, (f, to) => to[0] > 2), []);
  assert.equal(cardTableSeats(t, (f, to) => to[0] > 2 || to[0] < 0).length, 2);
});

test('CARDS2 a table turned off the square seats round its own box, not its world box\'s bulge (AUDIT CARDS B6)', () => {
  // A 2 x 1 table turned 45 degrees about the vertical, at (10, 0, 20): its world box is a 2.12 m square.
  const m = trs(10, 0, 20, 0, 45, 0);
  const box2 = { min: [-1, 0, -0.5], max: [1, 0.8, 0.5] };
  const corners = [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]].map(([x, z]) => [m[0] * x + m[8] * z + m[12], m[2] * x + m[10] * z + m[14]]);
  const aabb = { min: [Math.min(...corners.map((c) => c[0])), 0, Math.min(...corners.map((c) => c[1]))], max: [Math.max(...corners.map((c) => c[0])), 0.8, Math.max(...corners.map((c) => c[1]))] };
  const seats = cardTableSeats({ aabb, box: box2, matrix: m }, () => true);
  assert.equal(seats.length, 6);
  // Each seat SEAT_OUT from its own side: the ends 1 + 0.35 from the middle, the long sides' seats 0.5 + 0.35 across.
  const d = (s) => round(Math.hypot(s.x - 10, s.z - 20));
  assert.deepEqual(seats.map(d), [1.35, 1.35, round(Math.hypot(0.5, 0.85)), round(Math.hypot(0.5, 0.85)), round(Math.hypot(0.5, 0.85)), round(Math.hypot(0.5, 0.85))]);
  // ...and each faces the table's middle square to its side - for an end seat, straight at the middle.
  const e = seats[0];
  assert.deepEqual([round(Math.sin(e.yaw)), round(Math.cos(e.yaw))], [round((10 - e.x) / 1.35), round((20 - e.z) / 1.35)]);
  // The world box alone would have stood them round the bulge, up to SEAT_OUT + 0.56 from the table.
  assert.ok(cardTableSeats({ aabb }, () => true).some((s) => Math.hypot(s.x - 10, s.z - 20) > 1.5));
});

test('CARDS2 a long table keeps six, taken round the sides in turn', () => {
  const long = cardTableSeats({ aabb: box(4, 1) }, () => true);
  assert.deepEqual(long.map((s) => s.side), ['+x', '-x', '+z', '+z', '-z', '-z']);
  assert.deepEqual(long.filter((s) => s.side === '+z').map((s) => round(s.x)), [0.4, 1.2], 'the first along each side, in its own order');
  assert.equal(seatSpots(box(4, 1)).length, 12);
});

test('CARDS2 another player\'s seat is taken (AUDIT CARDS B3)', () => {
  const seats = [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }];
  assert.deepEqual(takenSeats(seats, [[2.1, 5, 0.2], [9, 0, 9]]), [1], 'within 0.3 m on the ground, whatever the height');
  assert.deepEqual(takenSeats(seats, [[2, 0, 0.31]]), []);
  assert.deepEqual(takenSeats(seats, []), []);
  assert.equal(nearestFreeSeat(seats, 1.9, 0.2, takenSeats(seats, [[2, 0, 0]])), 2);
});

test('CARDS2 the nearest free seat; something to sit over; what stands you up; the yaw\'s own law', () => {
  const seats = [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 2, z: 2 }];
  assert.equal(nearestFreeSeat(seats, 1.9, 0.2), 1);
  assert.equal(nearestFreeSeat(seats, 1.9, 0.2, [1]), 2);
  assert.equal(nearestFreeSeat(seats, 1.9, 0.2, [0, 1, 2]), -1);
  assert.equal(nearestFreeSeat([], 0, 0), -1);
  // The floor (1.22 down), a chair's seat (SEAT_SURFACE_MAX under the eye's drop - the boundary itself, AUDIT CARDS E7)
  // - not a table's top, not the air, not a drop.
  const edge = SEATED_EYE_HEIGHT - SEAT_SURFACE_MAX;
  assert.deepEqual([1.22, edge, edge - 1e-9, Infinity, 2, 2.01, NaN].map(seatFloorOk), [true, true, false, false, true, false, false]);
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
  const push = src.indexOf('    if (isCardTableModel(classicModelIdOf(p.modelIdNum))) { const b = localAabb(cpu.positions); tables.push({ aabb, box: { min: b.slice(0, 3), max: b.slice(3) }, matrix, modelIdNum: p.modelIdNum }); }');
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
  has('  function tryExit({ pressCast = false, interact = false, actClick = false } = {}) {\n    if (cardSeat) { standFromCardTable(); return true; }', 'first in the press, before the ray');   // PIN MOVED (the merge of main: CROUCH-SNEAK + MODE-WHEEL gave the press its interact and actClick arms)
  const leave = src.indexOf('    if (cardSeat && !overlayHeld && leavesSeat(mv, jumpHeld || !!player.toggleAutorun || swingKey)) standFromCardTable();');
  assert.ok(leave > 0 && leave < src.indexOf('      player.update(dt, paralyzed ? {'), 'whatever would move the body - or swing from it - stands it up first');
  const swing = src.indexOf("    if (cardSeat && isSwingButton(e.button) && !modalWindowUp()) { standFromCardTable(); return; }");
  assert.ok(swing > 0 && swing < src.indexOf("    if (isSwingButton(e.button) && !modalWindowUp()) modalAttackSink()?.(0, 0, true);"), 'AUDIT CARDS B5: the swing button stands you up, and swings nothing');
  // AUDIT CARDS B2: the seated eye after the body's and the decorator's - and never over a death's sink and tilt
  const over = src.indexOf("    if (mode === 'interior') decorTool.cameraOverride(cam);");
  const seat = src.indexOf("    if (mode === 'interior' && cardSeat && !(interiorOverlay instanceof DeathScreen)) cam.pos = cardSeat.eye.slice();");
  assert.ok(over > 0 && seat > over, 'the seated eye after the body\'s and the decorator\'s, held off while a death screen sinks the eye');
  // AUDIT CARDS E1: standing up does what it says - the slot empties and the eye goes home
  has("  function standFromCardTable({ cashOut = true } = {}) {\n    if (!cardSeat) return;\n    cardSeat = null;\n    cam.pos = player.eyeAt();", 'the stand empties the seat and gives the body its eye back');
  // AUDIT CARDS B1: every road out of a building empties the seat - the mode's change (a load, a teleport, a respawn), a new room
  has("        standFromCardTable({ cashOut: !load });   // CARDS2b (AUDIT CARDS B1): the forced road out - a load, a quest teleport, Recall, a respawn, a sail - empties the seat as the door does; CARDS4: and cashes the table out\n        interiorCtx = null; interiorBuilding = null; interiorCabin = null;", 'the forced road out empties the seat');
  has("      standFromCardTable();   // CARDS2b (AUDIT CARDS B1): a new room seats nobody yet - CARDS4: and an old table\'s chips come home\n      interiorBuilding = building;", 'a new room seats nobody');
  has("    seatPose: () => (mode === 'interior' && cardSeat ?", 'and the pose never says a seat outside a building');
  has("    const k = nearestFreeSeat(seats, player.pos[0], player.pos[2], takenSeats(seats, host.seatedPeers?.() ?? []));", 'AUDIT CARDS B3: another player\'s seat is taken');
  has("    return t ? (t.seats ??= cardTableSeats(t, seatProbe)) : [];", 'AUDIT CARDS B6: the whole table - its own box and its turn - to the seats');
  has("    if (cardSeat) mwv.eye = cam.pos;   // CARDS2: seated, the seat's own view - first person (Tavern-Cards.md section 2)\n    const view = betterAmbience.view(", 'the seat\'s own view, first person, the last word on the eye');
  has("    standFromCardTable();   // CARDS2: and nobody stays seated in a room they left - CARDS4: the table cashed out");
  has("(key) => (typeof key === 'string' && key.startsWith('cardtable:') ? { title: 'Card table' } : null)");
  has("    return seatFloorOk(c.raycast(to, [0, -1, 0], SEAT_FLOOR_PROBE));");
  has("    if (!(len > 0) || c.raycast(from, [d[0] / len, d[1] / len, d[2] / len], len) < len) return false;");
  has("    cam.yaw = seats[k].yaw;\n    cam.pitch = seats[k].pitch;");
  has('  // THE FOUR HOSTS: this host only. A tavern is an interior; exterior.js, world.js and dungeonContext.js stand no');
  for (const other of ['src/scenes/exterior.js', 'src/scenes/world.js', 'src/scenes/dungeonContext.js'])
    assert.doesNotMatch(read(other), /cardtable:|sitAtCardTable/, `${other} seats nobody`);
});
