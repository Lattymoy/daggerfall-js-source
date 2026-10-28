// IC-STAIRS (the owner's field report, 2026-10-27, item 4: "Minecraft looking staircases in Imperial city need to be
// completely redesigned"; bible/03-World/Arena-Provinces.md IC-STAIRS) - THE IMPERIAL CITY'S WAYS UP, BUILT STAIRS, pinned:
// a built stair's proportions (a riser and a tread, flights and landings), measured off the mesh the cell's model draws;
// every stair reaching the roof it climbs to (its head on the building's roof's edge, a flat roof's parapet open over it,
// a pitched roof's eave, never a gable's end) along a wall standing over it, from a street open before its foot; the real
// PlayerMotor walking them up, onto the roof and down again on a Collider of the cells' own models, no jump; the city's
// own two stones (the paving's course on every step); the ground they shut (across a cell's edge too), no door, lamp or
// bridge on one; and their triangles. Pure: no game data (the port's own shapes and pictures).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STAIR, STAIR_DEPTH, PAVEMENT, PARAPET, LEDGE_Y, GROUND, fabricCell, fabricGroundAt, fabricClosedOf, fabricPlotAt, outwardOf, inQuad, hoodAt, streetKind,
  stairPlan, stairRuns, stairSurface, inStair, stairGround, stairMiddle,
} from '../../src/world/imperialFabric.js';
import { fabricCellModel, buildStair, buildPlot, partyEdges, STAIR_COURSE, STAIR_WAIST } from '../../src/world/imperialFabricModels.js';
import { fabricCellBuildings, FABRIC_DOOR } from '../../src/world/imperialFabricBuildings.js';
import { fabricCellLamps } from '../../src/world/imperialFabricLights.js';
import { MeshBuilder } from '../../src/world/detStandIns.js';
import { IMPERIAL, IMPERIAL_SECTORS, IMPERIAL_CELLS, polar, imperialCell, tombAt } from '../../src/world/imperialCity.js';
import { buildEmperorsTombs, buildTempleOfTheOne, TOMB_FLIGHT, TEMPLE_FLIGHT } from '../../src/world/capitalImperial.js';
import { CAPITAL_ART, CAPITAL_ARCHIVE } from '../../src/world/capitalShapes.js';
import { capitalArt } from '../../src/world/capitalModels.js';
import { STEP_OFFSET, PlayerMotor } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { identity } from '../../src/world/mat4.js';
import { BLOCK_M } from '../../src/world/spawnedDungeons.js';
import { stairProblems, stairFaces, stairHead, solidGround, stairBudget, walkStair, walkProblems, cellsCollider, doorable, sameStair } from '../../tools/icStairsSweep.mjs';

const B = BLOCK_M, HALF = IMPERIAL_CELLS / 2;
const cellOfPoint = (x, z) => [Math.floor(z / B + HALF), Math.floor(x / B + HALF)];
/** A cell of the city's own near a point with at least `n` buildings - the nearest such, searched outward. */
function sampleCell(x, z, n = 8) {
  const [r0, c0] = cellOfPoint(x, z);
  for (let k = 0; k < 6; k++) for (let r = r0 - k; r <= r0 + k; r++) for (let c = c0 - k; c <= c0 + k; c++) {
    if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== k || !/^I/.test(imperialCell(r, c) ?? '')) continue;
    const L = fabricCell(r, c);
    if (L.plots.length >= n) return L;
  }
  return null;
}
/** Every district's sample cells (icgrand_fabric.test.js's: two rings out, each half's middle), and their stairs - each
 *  with its cell, its head's building (the roof it climbs to) and its neighbourhood. */
const DISTRICTS = [...IMPERIAL_SECTORS.map(([d, b]) => [d, b]), ['Waterfront District', 165]];
const CELLS = DISTRICTS.flatMap(([d, b]) => (d === 'Waterfront District' ? [[b, 7300], [b + 25, 7300]] : [[b + 7.5, 3000], [b + 52.5, 5300], [b + 22.5, 6300]]).map(([bb, r]) => [d, sampleCell(...polar(bb, r))])).filter(([, L]) => L)
  .concat([['Arboretum', fabricCell(125, 128)]]);   // the Arboretum's park neighbourhood's own stairs (its sample's stand off its cells) - 125,128 since the heads moved onto their roofs' fronts (125,129 holds a street's alone now)
/** A point of a stair's frame (metres along its wall from its foot, out from the wall) in the city's metres. */
const at = (s, x, o) => [s.at[0] + s.t[0] * x + s.n[0] * o, s.at[1] + s.t[1] * x + s.n[1] * o];
/** The stairs standing over the sample cells (their boxes on the cell), each once - with the layout of the cell that draws
 *  it (its middle's), its head's building and its neighbourhood. */
const STAIRS = [...new Map(CELLS.flatMap(([d, L]) => {
  const x0 = (L.c - HALF) * B, z0 = (L.r - HALF) * B, x1 = x0 + B, z1 = z0 + B;
  return L.nearStairs.filter((s) => s.box[0] < x1 && s.box[2] > x0 && s.box[1] < z1 && s.box[3] > z0).map((s) => [`${s.key}/${s.edge}`, { d, L: fabricCell(...cellOfPoint(...stairMiddle(s))), s, p: stairHead(s), hood: hoodAt(...s.at) }]);
})).values()];
test('IC-STAIRS A BUILT STAIR\'S PROPORTIONS - a riser of STAIR.rise at the most (a step under half the motor\'s STEP_OFFSET), a tread of STAIR.tread, 2R + G within Blondel\'s 0.60-0.66 m; every stair of every district\'s sample its risers alike, its climb its risers\' sum, its flights of STAIR.flight at the most with a landing between, its length its runs\'; and off the mesh its model draws: a riser a rise high at every tread\'s going, each tread one going deep, every flight but its last riser treaded (mutants: the risers rounded down; a riser of 0.4; a going of 0.2; a flight of 40; the head a landing\'s length; the flights unlanded)', () => {
  assert.deepEqual({ ...STAIR }, { rise: 0.18, tread: 0.3, width: 1.4, wall: 0.3, rail: PARAPET, flight: 16, landing: 1.2, head: 1.8, end: 0.6, into: 0.25, tol: 0.2, street: 5, margin: 0.9, roof: 3, pitch: 40, waist: 0.5, pier: 0.6, clear: 3 });
  assert.ok(STAIR.rise >= 0.15 && STAIR.rise <= 0.2 && 2 * STAIR.rise < STEP_OFFSET, 'a riser a step takes without a thought');
  assert.ok(2 * STAIR.rise + STAIR.tread >= 0.6 && 2 * STAIR.rise + STAIR.tread <= 0.66, 'Blondel\'s stride');
  assert.ok(STAIR.width >= 2 * 0.35 + 0.5, 'a body\'s width and room to pass');
  // the plan's law, on its own: 8 m (the Market's commonest climb) is 45 risers of 0.178 in three flights of 15
  assert.deepEqual(stairPlan(8), { risers: 45, rise: 8 / 45, flights: [15, 15, 15], len: 3 * 14 * 0.3 + 2 * 1.2 + 1.8 });
  assert.ok(STAIRS.length >= 40, `the sample's stairs (${STAIRS.length})`);
  const kinds = new Set(STAIRS.map((x) => x.hood.kind)), roofs = new Set(STAIRS.map((x) => x.p.roof));
  assert.deepEqual([...kinds].sort(), ['axial', 'docks', 'grid', 'organic', 'park', 'polar'], 'every frame of streets');
  assert.deepEqual([...roofs].sort(), ['flat', 'gableS', 'gableT'], 'every roof');
  for (const { d, s } of STAIRS) {
    assert.ok(s.rise <= STAIR.rise + 1e-9 && s.rise >= 0.15, `${d}: a riser of ${s.rise}`);
    assert.ok(Math.abs(s.risers * s.rise - (s.top - s.y0)) < 1e-9, `${d}: its climb its risers'`);
    assert.equal(s.flights.reduce((a, m) => a + m, 0), s.risers);
    assert.ok(s.flights.every((m) => m <= STAIR.flight && m >= 2) && Math.max(...s.flights) - Math.min(...s.flights) <= 1, `${d}: flights ${s.flights}`);
    assert.deepEqual(s.runs, stairRuns(s));
    assert.deepEqual(s.runs.map((g) => g.kind), [...s.flights.flatMap((m, k) => ['flight', k < s.flights.length - 1 ? 'landing' : 'head'])]);
    for (const g of s.runs) assert.ok(Math.abs(g.s1 - g.s0 - (g.kind === 'flight' ? (g.m - 1) * STAIR.tread : g.kind === 'head' ? STAIR.head : STAIR.landing)) < 1e-9, `${d}: a ${g.kind}'s run`);
    assert.ok(Math.abs(s.runs[s.runs.length - 1].s1 - s.len) < 1e-9 && s.runs[0].s0 === 0);
  }
  // off the mesh: a stair of every flight count, its risers and treads counted and measured
  for (const nf of [...new Set(STAIRS.map((x) => x.s.flights.length))]) {
    const { s } = STAIRS.find((x) => x.s.flights.length === nf);
    const faces = stairFaces(s), pave = (f) => f.archive === CAPITAL_ARCHIVE && f.record === CAPITAL_ART.bridgeStone;
    const inside = (f) => f.p.every((q) => q[1] <= s.top + 1e-6 && q[2 - 1] >= -STAIR.into - 1e-6 && q[1 - 1] >= -1e-6) && f.p.every((q) => q[1] <= STAIR.width + 1e-6);
    const risers = new Map(), treads = new Map();
    for (const f of faces) {
      if (!pave(f) || !f.p.every((q) => q[1] >= -STAIR.into - 1e-6 && q[1] <= STAIR.width + 1e-6 && q[2] <= s.top + 1e-6)) continue;
      const key = (v) => v.toFixed(3);
      if (f.n[0] < -0.99) { const x = key(f.p[0][0]); const r = risers.get(x) ?? [Infinity, -Infinity]; for (const q of f.p) { r[0] = Math.min(r[0], q[2]); r[1] = Math.max(r[1], q[2]); } risers.set(x, r); }
      if (f.n[2] > 0.99 && f.p.every((q) => q[2] < s.top - 1e-6)) { const y = key(f.p[0][2]); const r = treads.get(y) ?? [Infinity, -Infinity]; for (const q of f.p) { r[0] = Math.min(r[0], q[0]); r[1] = Math.max(r[1], q[0]); } treads.set(y, r); }
    }
    assert.ok(inside, 'measured');
    assert.equal(risers.size, s.risers, `${nf} flights: a riser a step`);
    for (const [x, [y0, y1]] of risers) assert.ok(Math.abs(y1 - y0 - s.rise) < 1e-4 && Math.abs(stairSurface(s, +x + 0.05) - y1) < 1e-4, `a riser at ${x}: ${y0}..${y1}`);
    const going = [...treads.values()].filter(([x0, x1]) => Math.abs(x1 - x0 - STAIR.tread) < 1e-4).length;
    assert.equal(going, s.risers - nf, `${nf} flights: a tread a going deep under every riser but each flight's last (its landing)`);
  }
});

test('IC-STAIRS EVERY STAIR REACHES ITS TOP - its head landing at its building\'s roof (the block\'s lowest a stair reaches, never a tower), standing on that building\'s front: a flat roof\'s parapet open over the head and standing beside it, a pitched roof\'s eave (never a gable\'s end); every metre of it before a front of its block that stands a rail over its steps (but its head\'s own building); its foot on the street\'s own level with the street open before it (mutants: the parapet unopened; a stair onto a gable\'s end; the wall behind unheld; the head\'s building any)', () => {
  let flat = 0, pitched = 0, lowest = 0;
  for (const { d, L, s, p } of STAIRS) {
    assert.ok(p && p.key === s.key && !p.tower, `${d}: its head before its own building`);
    assert.equal(s.top, p.h, `${d}: its head at its roof's edge`);
    assert.equal(stairSurface(s, s.len - 0.1), p.h);
    assert.equal(s.y0, streetKind(p.sw[s.edge]) === 'main' ? PAVEMENT.h : 0, `${d}: its foot on the street's level (a main street's pavement)`);
    assert.equal(stairSurface(s, -0.01), s.y0);
    assert.ok(!solidGround(fabricGroundAt(...at(s, -STAIR.margin - 0.4, STAIR.width / 2))), `${d}: open ground before its foot`);
    // its head on the building's front e, in from its corners
    const a = p.q[s.edge], b = p.q[(s.edge + 1) & 3], n = outwardOf(p.q, s.edge), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (const x of [s.len - STAIR.head, s.len]) {
      const q = at(s, x, 0), u = ((q[0] - a[0]) * (b[0] - a[0]) + (q[1] - a[1]) * (b[1] - a[1])) / len;
      assert.ok(u > STAIR.end - 1e-6 && u < len - STAIR.end + 1e-6 && Math.abs((q[0] - a[0]) * n[0] + (q[1] - a[1]) * n[1]) < 1e-6, `${d}: its head on its building's front`);
    }
    // its roof STAIR.roof deep behind its head - a roof a body steps onto, never a building's sliver
    for (const x of [s.len - STAIR.head, s.len - STAIR.wall]) assert.ok(inQuad(p.q, ...at(s, x, -STAIR.roof)), `${d}: its roof ${STAIR.roof} m deep behind its head`);
    // the wall behind every metre: a front of its block, on its line, standing a rail over its steps (the head's own whole)
    let low = false;
    for (let x = 0; x <= s.len; x += 0.5) {
      const o = fabricPlotAt(...at(s, x, -0.3));
      assert.ok(o && (o.key === p.key || o.h >= stairSurface(s, x) + STAIR.rail), `${d}: a wall a rail over its step at ${x.toFixed(1)} (${o?.h})`);
      if (o.h < p.h) low = true;
    }
    if (!low) lowest++;
    // the roof's edge where the head meets it, off the building's own mesh (its cell's near stairs) on a Collider: over the
    // head nothing stands on the roof's edge - a flat roof's parapet open, a pitched roof's eave - and past the head's end
    // a flat roof's parapet stands again
    const [r, c] = cellOfPoint(...[0, 1].map((k) => p.q.reduce((sum, v) => sum + v[k], 0) / 4)), Lp = fabricCell(r, c);
    assert.ok(Lp.nearStairs.some((o) => sameStair(o, s)), `${d}: the head's cell knows its stair`);
    const edgeTop = (stairs, x) => {
      const mb = new MeshBuilder();
      buildPlot(mb, p, partyEdges(Lp, p), stairs);
      const m = mb.build(), col = new Collider();
      col.addMesh('p', m.positions, m.indices, identity());
      const q = at(s, x, -0.2);
      return p.h + 3 - col.raycast([q[0], p.h + 3, -q[1]], [0, -1, 0], 6);
    };
    const opening = [s.len - STAIR.head + 0.15, (2 * s.len - STAIR.head - STAIR.wall) / 2, s.len - STAIR.wall - 0.15];
    if (p.roof === 'flat') {
      flat++;
      for (const x of opening) assert.ok(Math.abs(edgeTop(Lp.nearStairs, x) - p.h) < 1e-3, `${d}: the parapet open over the head at ${x.toFixed(2)}`);
      assert.ok(Math.abs(edgeTop([], opening[1]) - p.h - PARAPET) < 1e-3, `${d}: the parapet stands there without its stair`);
      assert.ok(Math.abs(edgeTop(Lp.nearStairs, s.len + 0.3) - p.h - PARAPET) < 1e-3, `${d}: and stands past the head's end`);
    } else {
      pitched++;
      assert.equal(p.roof === 'gableS', s.edge % 2 === 0, `${d}: an eave, never a gable's end`);
      for (const x of opening) assert.ok(edgeTop(Lp.nearStairs, x) < p.h + 0.2, `${d}: the eave at the head at ${x.toFixed(2)}`);
    }
  }
  assert.ok(flat >= 20 && pitched >= 8, `${flat} flat roofs, ${pitched} pitched`);
  // its head the lowest roof its block's stair could reach (its buildings tried lowest first): a stair passes no lower
  // building than its head's but where that one's own front takes none (too short, a gable's end, a tower) - the highest
  // tried first, a stair ran before lower ones to a higher roof in 27 of 57
  assert.ok(lowest / STAIRS.length > 0.85, `${lowest} of ${STAIRS.length} stairs pass no building lower than their head's`);
  // where a block's lower building stands along a front a stair would run before, its wall short of a rail over the steps
  // there (cells 57,118, 75,121, 89,128 and 128,152: 0.6 to 0.9 m short, the law unheld), the stair runs elsewhere
  for (const [r, c] of [[57, 118], [75, 121], [89, 128], [128, 152]]) for (const s of fabricCell(r, c).stairs) {
    const p = stairHead(s);
    for (let x = 0.05; x <= s.len - 0.05; x += 0.5) {
      const o = fabricPlotAt(...at(s, x, -STAIR.into));
      assert.ok(o && (o.key === p.key || o.h >= stairSurface(s, x) + STAIR.rail), `cell ${r},${c}: stair ${s.key}'s wall a rail over its step at ${x.toFixed(1)}`);
    }
  }
});

test('IC-STAIRS WALKED - the real PlayerMotor on a Collider of the cells\' own models walks a way up from the street to its head (no jump), over its roof\'s edge onto the roof (a flat roof\'s through its parapet\'s opening, a pitched roof\'s up its eave), and back down to its foot; its feet never a riser off the stair\'s own walk on the way up (mutants: a riser of 0.4; the parapet unopened; the head under the roof)', () => {
  const pick = [
    STAIRS.find((x) => x.p.roof === 'flat' && x.s.flights.length === 3),
    STAIRS.find((x) => x.p.roof !== 'flat'),
    STAIRS.reduce((a, b) => (b.s.top > a.s.top ? b : a)),
    STAIRS.find((x) => x.hood.kind === 'polar' || x.hood.kind === 'organic'),
  ];
  for (const { d, L, s, p } of pick) {
    const w = walkStair(cellsCollider(L.r, L.c), s), tag = `${d} (${p.roof}, ${s.top} m, ${s.flights.length} flights)`;
    assert.deepEqual(walkProblems(s, w, p), [], tag);
    assert.ok(w.up < s.len / 1.5, `${tag}: walked up in ${w.up} s`);
    assert.ok(Math.abs(w.head[2] - s.top) < 0.05 && w.worst <= s.rise + 0.02, `${tag}: at its head (${w.head[2]}), its feet a riser off its walk at worst (${w.worst.toFixed(3)})`);
    if (p.roof === 'flat') assert.ok(Math.abs(w.roof[2] - p.h) < 0.05, `${tag}: on the flat roof (${w.roof[2]})`);
    else assert.ok(w.roof[2] > p.h + 0.5, `${tag}: up the pitched roof (${w.roof[2]})`);
  }
});

test('IC-STAIRS THE SWEEP\'S LAWS ON THE SAMPLE - every stair of every district\'s sample holds every law tools/icStairsSweep.mjs holds the whole city to (stairProblems: proportions, head, wall, foot, ground, doors, lamps, bridges, ledges, balconies, canals, its mesh) - the sweep\'s own checker, so the pin and the city-wide verification are one law', () => {
  for (const { d, L, s } of STAIRS) assert.deepEqual(stairProblems(s, L), [], `${d}: stair ${s.key}`);
});

test('IC-STAIRS THE CITY\'S OWN STONE - every face of a stair the city\'s two stones (CAPITAL_ART wallStone, bridgeStone - the walls\' and the paving\'s), so a cell\'s model gains no draw; every tread and riser laid on one course of the paving\'s picture (STAIR_COURSE: its joint at the nosing), and that course as painted - a joint row at its top and at its foot, none between; v rising up every wall of it (mutants: the treads of timber; the course a row off; the risers\' v flipped)', () => {
  assert.deepEqual({ ...STAIR_COURSE }, { top: 21, rows: 16 });
  const art = capitalArt().get(CAPITAL_ART.bridgeStone), rows = [];
  for (let y = 0; y < art.height; y++) { let sum = 0; for (let x = 0; x < art.width; x++) { const i = (y * art.width + x) * 4; sum += art.data[i] + art.data[i + 1] + art.data[i + 2]; } rows.push(sum / art.width / 3); }
  const joint = (y) => rows[y] < 70, top = STAIR_COURSE.top, foot = top + STAIR_COURSE.rows;
  assert.ok(joint(top) && joint(foot), `the course's joints (${rows[top].toFixed(0)}, ${rows[foot].toFixed(0)})`);
  for (let y = top + 1; y < foot; y++) assert.ok(!joint(y), `no joint inside the course (row ${y})`);
  const vN = -top / 64, vB = -foot / 64;
  for (const { s } of STAIRS.slice(0, 12)) {
    const faces = stairFaces(s);
    assert.deepEqual([...new Set(faces.map((f) => `${f.archive}:${f.record}`))].sort(), [`${CAPITAL_ARCHIVE}:${CAPITAL_ART.wallStone}`, `${CAPITAL_ARCHIVE}:${CAPITAL_ART.bridgeStone}`].sort());
    let steps = 0;
    for (const f of faces) {
      const step = f.record === CAPITAL_ART.bridgeStone && f.p.every((q) => q[1] <= STAIR.width + 1e-6 && q[2] <= s.top + 1e-6) && (f.n[0] < -0.99 || (f.n[2] > 0.99 && f.p.every((q) => q[2] < s.top - 1e-6) && Math.abs(Math.max(...f.p.map((q) => q[0])) - Math.min(...f.p.map((q) => q[0])) - STAIR.tread) < 1e-4));
      if (step) {
        steps++;
        for (const [, v] of f.uv) assert.ok(v >= vB - 1e-6 && v <= vN + 1e-6, `a step's v ${v} on its course`);
        if (f.n[0] < -0.99) { const lo = f.p.reduce((a, q, i) => (q[2] < f.p[a][2] ? i : a), 0), hi = f.p.reduce((a, q, i) => (q[2] > f.p[a][2] ? i : a), 0); assert.ok(f.uv[hi][1] > f.uv[lo][1], 'a riser\'s joint at its top (v rising up it)'); }
      }
      // every wall of it: v rising up the face, as the GL samples it (BLD's law)
      if (Math.abs(f.n[2]) < 1e-6 && !step) {
        const [i, j] = [[0, 1], [0, 2], [1, 2]].find(([u, w]) => Math.abs(f.p[u][2] - f.p[w][2]) > 0.05) ?? [];
        if (i !== undefined) assert.ok((f.uv[i][1] - f.uv[j][1]) / (f.p[i][2] - f.p[j][2]) > 0, 'a wall\'s picture upright');
      }
    }
    assert.equal(steps, 2 * (2 * s.risers - s.flights.length), 'every riser and tread found (two triangles each)');
  }
});

test('IC-STAIRS ITS GROUND - a stair\'s footprint shut to the city\'s walkers (GROUND.stair) from every cell it reaches, STAIR.margin past its ends, but the street under its upper flights where they pass STAIR.clear over it (GROUND.under: open, a door\'s there with its surround and lintel under the soffit); no lamp and no bridge on it, no door on its shut ground, no ledge or balcony over it; never in the Elven Gardens\' canals; the Arboretum\'s ground under it the park\'s (no door there) (mutants: the ground unshut; its cell\'s own alone; a bridge over it; a ledge across it; the street under it shut; the under-street too low; the park under it a street)', () => {
  let cross = 0, points = 0, own = 0, under = 0, doorsUnder = 0, parkUnder = 0;
  for (const { d, L, s } of STAIRS) {
    for (let x = -STAIR.margin + 0.1; x < s.len + STAIR.margin - 0.1; x += 0.7) for (const o of [0.4, STAIR.width, STAIR_DEPTH]) {
      // shut - its own ground, or where a dead end's wall across an alley meets the block's corner the wall's - but the street
      // under its upper flights, open where they pass STAIR.clear over it (the soffit STAIR_WAIST under the nosings' line)
      // (the Arboretum's ground under it stays the park's: open, and no door's)
      const g = fabricGroundAt(...at(s, x, o)), soffit = stairSurface(s, x - 0.5) - s.rise - STAIR_WAIST, sg = stairGround(s, ...at(s, x, o));
      if (g === GROUND.under || sg === GROUND.under) {
        under++;
        assert.ok(soffit >= STAIR.clear && x > s.runs[1].s1 && x < s.len - STAIR.wall, `${d}: the street under it at ${x.toFixed(1)} under a soffit at ${soffit.toFixed(2)}`);
        if (hoodAt(...at(s, x, o))?.kind === 'park') { parkUnder++; assert.ok(g === GROUND.park || g === GROUND.path, `${d}: the park's own ground under it (${g})`); }
        else assert.equal(g, GROUND.under, `${d}: the street under it`);
      }
      else assert.ok(fabricClosedOf(g), `${d}: its ground shut at ${x.toFixed(1)}, ${o} (${g})`);
      points++; if (g === GROUND.stair || g === GROUND.under || sg === GROUND.under) own++;
    }
    const [ra, ca] = cellOfPoint(...at(s, -STAIR.margin, 0)), [rb, cb] = cellOfPoint(...at(s, s.len + STAIR.margin, STAIR_DEPTH));
    if (ra !== rb || ca !== cb) cross++;
    for (const q of L.canals) for (let x = 0; x < s.len; x += 1) assert.ok(!inQuad(q, ...at(s, x, STAIR.width / 2)), `${d}: a stair in a canal`);
  }
  assert.ok(cross >= 5, `stairs across a cell's edge (${cross})`);
  // the Arboretum's (cell 125,129, its park neighbourhood): the ground under a stair's upper flights its own - open to the
  // walkers, and no door's, as the park's streets are none
  const PK = fabricCell(125, 129);
  for (const s of PK.nearStairs.filter((o) => hoodAt(...o.at)?.kind === 'park')) for (let x = 0; x < s.len; x += 0.5) {
    if (stairGround(s, ...at(s, x, 0.85)) !== GROUND.under) continue;
    parkUnder++;
    const g = fabricGroundAt(...at(s, x, 0.85));
    assert.ok(g === GROUND.park || g === GROUND.path, `the Arboretum's own ground under its stair ${s.key} at ${x.toFixed(1)} (${g})`);
  }
  for (const bd of fabricCellBuildings(125, 129)) assert.ok(PK.nearStairs.every((s) => !inStair(s, ...bd.door.at, 0.5)), 'no door under a stair in the park');
  assert.ok(own / points > 0.95 && under / points > 0.15 && parkUnder > 0, `its own ground (${own} of ${points}, ${under} the street under it, ${parkUnder} the park's)`);
  for (const [d, L] of CELLS) {
    for (const bd of fabricCellBuildings(L.r, L.c)) for (const s of L.nearStairs) {
      const [x, z] = bd.door.at;
      const w = FABRIC_DOOR.w / 2 + FABRIC_DOOR.jamb, on = [-1, 0, 1].map((k) => stairGround(s, x + k * w * -bd.door.n[1] + bd.door.n[0] * 0.3, z + k * w * bd.door.n[0] + bd.door.n[1] * 0.3));
      assert.ok(!on.includes(GROUND.stair), `${d}: a door on a stair's shut ground`);
      if (on.includes(GROUND.under)) doorsUnder++;
    }
    for (const lamp of fabricCellLamps(L.r, L.c)) for (const s of L.nearStairs) assert.ok(!inStair(s, ...lamp.at, 0), `${d}: a lamp on a stair or under it`);
    for (const br of L.bridges) for (const s of L.nearStairs) for (const t of [0.5, br.len - 0.5]) assert.ok(!inStair(s, br.from[0] + br.n[0] * t, br.from[1] + br.n[1] * t, 1.2), `${d}: a bridge over a stair`);
    // no ledge or balcony over a stair: the stone ledge faces and the timber decks of the cell's plots off every stair's run
    for (const p of L.plots) {
      const mb = new MeshBuilder();
      buildPlot(mb, p, 0, L.nearStairs);
      const m = mb.build();
      for (const sm of m.subMeshes) {
        if (sm.textureRecord !== CAPITAL_ART.wallStone && sm.textureRecord !== CAPITAL_ART.timber) continue;
        for (let i = sm.startIndex; i < sm.startIndex + sm.primitiveCount * 3; i += 3) {
          const v = [0, 1, 2].map((k) => { const j = m.indices[i + k] * 3; return [m.positions[j], m.positions[j + 1], -m.positions[j + 2]]; });
          const y = (v[0][1] + v[1][1] + v[2][1]) / 3, mx = (v[0][0] + v[1][0] + v[2][0]) / 3, mz = (v[0][2] + v[1][2] + v[2][2]) / 3;
          if (y > p.h - 0.01) continue;   // its parapet
          if (sm.textureRecord === CAPITAL_ART.wallStone && !(y > LEDGE_Y - 0.31 && y < LEDGE_Y + 0.01)) continue;
          for (const s of L.nearStairs) assert.ok(!inStair(s, mx, mz, 0), `${d}: a ${sm.textureRecord === CAPITAL_ART.timber ? 'balcony' : 'ledge'} over a stair`);
        }
      }
    }
  }
  assert.ok(doorsUnder > 0, `doors under a stair's upper flights (${doorsUnder})`);
});

test('IC-STAIRS JOINED TO THE GROUND AND ITS BUDGET - the first flight and its landing on a solid base down into the street, every landing above on a pier down into it, the head on its end wall down into it; a stair\'s triangles four a riser and a few a run, its share of its cells\' triangles small, its pictures no new draw (mutants: a pier off the ground; the base afloat)', () => {
  const tris = (s) => stairFaces(s).length;
  for (const { d, s } of STAIRS) {
    const faces = stairFaces(s), nf = s.flights.length;
    assert.ok(tris(s) <= stairBudget(s), `${d}: ${tris(s)} triangles for ${s.risers} risers`);
    const down = (x0, x1) => faces.some((f) => f.record === CAPITAL_ART.wallStone && Math.abs(f.n[2]) < 1e-6 && f.p.some((q) => q[2] <= -0.3 + 1e-6) && f.p.every((q) => q[0] >= x0 - 1e-6 && q[0] <= x1 + 1e-6));
    const land = s.runs.filter((g) => g.kind === 'landing');
    const base = (x) => faces.some((f) => f.record === CAPITAL_ART.wallStone && f.n[1] > 0.99 && f.p.every((q) => Math.abs(q[1] - STAIR_DEPTH) < 1e-3) && f.p.some((q) => q[2] <= -0.3 + 1e-6) && Math.min(...f.p.map((q) => q[0])) <= x && Math.max(...f.p.map((q) => q[0])) >= x);
    assert.ok(base(s.runs[0].s1 / 2) && base((s.runs[1].s0 + s.runs[1].s1) / 2), `${d}: its base's street face into the street under its first flight and landing`);
    for (const g of land.slice(1)) assert.ok(down(g.s0 - STAIR.tread, g.s1), `${d}: a landing's pier at ${g.s0.toFixed(1)}`);
    assert.ok(down(s.len - STAIR.wall - 1e-6, s.len), `${d}: its end wall into the street`);
    // the waist under every flight above the base: a soffit facing down, STAIR_WAIST under the nosings
    for (const g of s.runs.filter((r) => r.kind === 'flight').slice(1)) {
      const mid = (g.s0 + g.s1) / 2, soffit = faces.find((f) => f.n[2] < -0.5 && Math.min(...f.p.map((q) => q[0])) <= mid && Math.max(...f.p.map((q) => q[0])) >= mid);
      assert.ok(soffit, `${d}: a flight's soffit`);
    }
  }
  let all = 0, mine = 0;
  for (const [, L] of CELLS) { const m = fabricCellModel(L.r, L.c); all += m ? m.indices.length / 3 : 0; for (const s of L.stairs) mine += tris(s); }
  assert.ok(mine / all < 0.25, `the stairs' share of their cells' triangles ${(mine / all * 100).toFixed(1)}%`);
  assert.ok(STAIR_WAIST > 0 && STAIR_WAIST < 1);
});

/** The real motor on a Collider of one landmark's model (the map's frame, as it is built): from `from` toward `to` (x, z),
 *  walked - where its feet end. */
function walkLandmark(m, from, to, secs = 12) {
  const col = new Collider(() => 0);
  col.addMesh('l', m.positions, m.indices, identity());
  const mo = new PlayerMotor(col, { speed: 50, running: 50, swimming: 30 });
  const frame = (input, yaw) => mo.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false, ...input }, yaw, 0);
  mo.spawn(from[0], 0.05, from[1]);
  for (let k = 0; k < 30; k++) frame({}, 0);
  for (let k = 0; k < secs * 60 && Math.hypot(to[0] - mo.pos[0], to[1] - mo.pos[2]) > 0.2; k++) frame({ forward: 1 }, Math.atan2(to[0] - mo.pos[0], to[1] - mo.pos[2]));
  return [mo.pos[0], mo.pos[1], mo.pos[2]];
}
/** A landmark's risers: the faces turned out along `out` (x, z) across its front, by their height - [bottom, top] each. */
function landmarkRisers(m, out, near) {
  const by = new Map();
  for (let t = 0; t < m.indices.length; t += 3) {
    const ix = [m.indices[t], m.indices[t + 1], m.indices[t + 2]], n = [m.normals[ix[0] * 3], m.normals[ix[0] * 3 + 1], m.normals[ix[0] * 3 + 2]];
    if (n[0] * out[0] + n[2] * out[1] < 0.99) continue;
    const p = ix.map((i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]]);
    if (!p.every((q) => near(q[0], q[2])) || Math.max(...p.map((q) => q[1])) - Math.min(...p.map((q) => q[1])) > 0.25) continue;
    by.set(Math.min(...p.map((q) => q[1])).toFixed(3), Math.max(...p.map((q) => q[1])));
  }
  return [...by.entries()].map(([lo, hi]) => [+lo, hi]).sort((a, b) => a[0] - b[0]);
}

test('IC-STAIRS THE LANDMARKS\' FLIGHTS - every emperor\'s tomb climbs from its walk to its portico, and the Temple of the One from its street to its podium before its doors, by a built flight of the city\'s one law (STAIR: risers alike, STAIR.rise at the most, from the ground to the platform\'s top) between cheek blocks - walked by the real motor, no jump; a 0.6 m podium and a 0.6 m step no longer their way up (mutants: the tombs\' old step; the temple\'s flight unbuilt)', () => {
  const T = IMPERIAL.tombs, w = T.w / 2, tombs = buildEmperorsTombs();
  for (const i of [0, 7, 13]) {
    const [x, z] = tombAt(i), face = [x / Math.hypot(x, z), z / Math.hypot(x, z)], P = (f, s) => [x + face[0] * f - face[1] * s, z + face[1] * f + face[0] * s];
    const near = (qx, qz) => { const dx = qx - x, dz = qz - z, f = dx * face[0] + dz * face[1], s = -dx * face[1] + dz * face[0]; return f > w && f < w + T.podium + 0.1 && Math.abs(s) <= T.walk / 2 + 1e-3; };
    const risers = landmarkRisers(tombs, face, near), n = Math.ceil(TOMB_FLIGHT.climb / STAIR.rise - 1e-9);
    assert.equal(risers.length, n, `tomb ${i}: ${n} risers (${JSON.stringify(risers)})`);
    risers.forEach(([lo, hi], k) => assert.ok(Math.abs(lo - (k * TOMB_FLIGHT.climb) / n) < 1e-3 && Math.abs(hi - lo - TOMB_FLIGHT.climb / n) < 1e-3, `tomb ${i}: riser ${k} ${lo}..${hi}`));
    const to = P(w - 6 + 1, 0), end = walkLandmark(tombs, P(w + T.podium + 2.5, 0), to);
    assert.ok(Math.abs(end[1] - TOMB_FLIGHT.climb) < 0.05 && Math.hypot(to[0] - end[0], to[1] - end[2]) < 0.5, `tomb ${i}: walked up to its portico (${end.map((v) => v.toFixed(2))})`);
  }
  const temple = buildTempleOfTheOne(), [tx, tz] = polar(IMPERIAL.temple.b, IMPERIAL.temple.r), front = tz - IMPERIAL.temple.l / 2;
  const risers = landmarkRisers(temple, [0, -1], (qx, qz) => Math.abs(qx - tx) <= TEMPLE_FLIGHT.half + 1e-3 && qz < front - 2 + 0.1 && qz > front - 6);
  assert.equal(risers.length, Math.ceil(TEMPLE_FLIGHT.climb / STAIR.rise - 1e-9), `the temple's risers (${JSON.stringify(risers)})`);
  assert.ok(risers.every(([lo, hi]) => hi - lo <= STAIR.rise + 1e-6) && Math.abs(risers.at(-1)[1] - TEMPLE_FLIGHT.climb) < 1e-6);
  const end = walkLandmark(temple, [tx, front - 8], [tx, front - 0.8]);
  assert.ok(Math.abs(end[1] - TEMPLE_FLIGHT.climb) < 0.05 && Math.abs(end[2] - (front - 0.8)) < 0.5, `walked up onto the temple's podium (${end.map((v) => v.toFixed(2))})`);
});

test('IC-STAIRS FOUND AT THE SWEEP: A BUILDING ACROSS A CELL\'S CORNER IS THAT CELL\'S GROUND - every building of the cells about a cell whose box meets the cell\'s (2 m out) is among its near ones, so the ground inside it reads a building from every cell it stands over (a stair\'s wall behind it read the street where a building crossed a cell\'s corner with no corner of its own near; mutant: the corners\' law back)', () => {
  let crossing = 0;
  for (const [d, L] of CELLS) {
    const x0 = (L.c - HALF) * B - 2, z0 = (L.r - HALF) * B - 2, x1 = x0 + B + 4, z1 = z0 + B + 4;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      for (const p of fabricCell(L.r + dr, L.c + dc).plots) {
        const xs = p.q.map((v) => v[0]), zs = p.q.map((v) => v[1]);
        if (!(Math.min(...xs) < x1 && Math.max(...xs) > x0 && Math.min(...zs) < z1 && Math.max(...zs) > z0)) continue;
        assert.ok(L.near.some((o) => o.key === p.key), `${d}: building ${p.key} over cell ${L.r},${L.c} among its near ones`);
        if (!p.q.some((v) => v[0] >= x0 && v[0] <= x1 && v[1] >= z0 && v[1] <= z1)) {
          crossing++;
          // the ground inside it, where it crosses the cell, a building
          const m = [Math.max(x0 + 2.5, Math.min(x1 - 2.5, (Math.min(...xs) + Math.max(...xs)) / 2)), Math.max(z0 + 2.5, Math.min(z1 - 2.5, (Math.min(...zs) + Math.max(...zs)) / 2))];
          if (inQuad(p.q, ...m)) assert.equal(fabricGroundAt(...m), GROUND.building, `${d}: inside building ${p.key}`);
        }
      }
    }
  }
  assert.ok(crossing > 0, `buildings over a cell with no corner near it (${crossing})`);
});

test('IC-STAIRS THE SWEEP\'S FINDINGS STAY FIXED - the cells where tools/icStairsSweep.mjs first found a stair breaking a law hold every law now: a building across a cell\'s corner read as street behind one (121,69); a polar frame\'s twisted wedge for a wall (114,66); a wedge\'s roof pitched past 60 degrees at a head (79,51; 88,73); a dead end\'s wall across the street before a foot (42,72; 93,47; 104,128; 123,160; 131,155); a polar frame\'s far court over another neighbourhood\'s street (120,146); a dead end\'s wall run on along a street front into a foot\'s first steps (60,66; 62,102; 63,152); a warped court of the Elven Gardens under a stair, which had hidden it from the sweep\'s door law (41,84; 49,92; 53,81; 56,75; 64,84) (mutants: the corners\' law back; a twisted wedge for a wall; a steep roof; no roof behind; the foot walled in; a foreign court; its footprint unasked)', () => {
  for (const [r, c] of [[121, 69], [114, 66], [79, 51], [88, 73], [42, 72], [93, 47], [104, 128], [123, 160], [131, 155], [60, 66], [62, 102], [63, 152], [41, 84], [49, 92], [53, 81], [56, 75], [64, 84],
    [33, 94], [36, 87]]) {   // the roof's depth behind a head (stairProblems' own law since): where a stair would stand on a sliver of a roof
    const L = fabricCell(r, c);
    assert.ok(L.nearStairs.length > 0, `cell ${r},${c} keeps its ways up`);
    for (const s of L.nearStairs) assert.deepEqual(stairProblems(s, fabricCell(...cellOfPoint(...stairMiddle(s)))), [], `cell ${r},${c}: stair ${s.key}`);
  }
  // a polar frame's far ring's court, 513 m long, lay over the Arena District's streets as `court` (cell 120,146): a court is
  // its own neighbourhood's now, and the street before that building's north front reads a street, its door's there
  const p = fabricCell(120, 146).plots.find((q) => q.key === 2290215854);
  assert.ok(p, 'the building of the finding');
  const a = p.q[2], b = p.q[3], n = outwardOf(p.q, 2), m = [(a[0] + b[0]) / 2 + n[0] * 0.8, (a[1] + b[1]) / 2 + n[1] * 0.8];
  assert.equal(fabricGroundAt(...m), GROUND.street, 'the street before it a street, not a far court');
  assert.ok(fabricCellBuildings(120, 146).some((bd) => bd.key === p.key), 'its door');
  // the court before building 3442306964's only front (cell 41,84) is another neighbourhood's warped court: no door's
  // ground, with a stair or without - and no stair stands on it now
  const q = fabricCell(41, 84).plots.find((o) => o.key === 3442306964);
  assert.ok(q && !doorable(q) && !fabricCellBuildings(41, 84).some((bd) => bd.key === q.key), 'no door before a court');
  assert.ok(!fabricCell(41, 84).ground.stairs.some((o) => o.key === q.key), 'no stair on the court');
});

test('IC-STAIRS EVERY BUILDING A STAIR CLIMBS BEFORE KEEPS ITS DOOR - each building along a stair of the sample (its head\'s and the ones its flights pass) is entered by a door of its own, on a bay the stair leaves open or under its upper flights (mutant: the door bays unasked)', () => {
  let along = 0;
  for (const { d, s } of STAIRS) {
    const seen = new Map();
    for (let x = 0.05; x <= s.len - 0.05; x += 0.5) { const o = fabricPlotAt(...at(s, x, -STAIR.into)); if (o) seen.set(o.key, o); }
    for (const o of seen.values()) {
      if (!doorable(o)) continue;   // the Arboretum's park, a court's own ground: no door's (world/imperialFabricBuildings.js doorOf)
      along++;
      const [r, c] = cellOfPoint(...[0, 1].map((k) => o.q.reduce((sum, v) => sum + v[k], 0) / 4));
      assert.ok(fabricCellBuildings(r, c).some((b) => b.key === o.key), `${d}: building ${o.key} along stair ${s.key} keeps its door`);
    }
  }
  assert.ok(along > STAIRS.length, `${along} buildings along the stairs`);
});
