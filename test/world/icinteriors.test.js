// IC-INTERIORS (2026-10-27, the owner's field report, item 5: "Interiors in the Imperial city need to match their exterior
// with varied layouts"; "No band aids or half assed work"; bible/03-World/Arena-Provinces.md IC-INTERIORS) - EVERY
// IMPERIAL CITY BUILDING'S INTERIOR ITS OWN, pinned: its grid its footprint's, its storeys the ones its walls show (each
// reached), its rooms its kind's and its key's (the same key the same rooms on every visit and client, another key other
// rooms), its street door where the building's door is, its windows where its walls show them, its furniture its kind's
// and walkable, its cast its donor's (their names and quest markers as a walk over the city reads them, none of it made),
// a quest's markers laid on its rooms at the mount, every ladder climbed to its own landing. Against the player's own
// ARCH3D and BLOCKS.BSA (every piece Daggerfall's own, measured, seen through nowhere): icinteriors_freeware.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fabricCell, inQuad, STOREY } from '../../src/world/imperialFabric.js';
import {
  fabricCellBuildings, fabricBuildingPlan, fabricBuildingInterior, withFabricBuildings, FABRIC_ENTRANCE, _resetFabricInteriors,
  _fabricInteriorsMade,
} from '../../src/world/imperialFabricBuildings.js';
import {
  fabricInteriorGrid, fabricInteriorPlan, fabricInteriorRecord, fabricSideOf, fabricPieceBox, fabricCellMiddle, fabricTurned,
  fabricArrival, FABRIC_SIDES, FABRIC_SIDE_TURN, FABRIC_INTERIOR_MAX, FABRIC_INTERIOR_STOREYS, FABRIC_DOOR_CELL_X,
} from '../../src/world/interior/fabricInterior.js';
import {
  KIT_PIECE, KIT_CELL, KIT_STOREY, KIT_MEASURE, KIT_SHIFT, KIT_LADDER, KIT_SET_ARCHIVES, FURNITURE, POOL_SHELVES, POOL_KIND,
} from '../../src/world/interior/fabricInteriorKit.js';
import { imperialBlockJson, imperialOwnName } from '../../src/world/imperialBlocks.js';
import { IMPERIAL_CELLS, IMPERIAL_SECTORS, polar, imperialCell } from '../../src/world/imperialCity.js';
import { portBlockJson, startMarkerAt, miscModelAt } from '../../src/world/tamrielCapitals.js';
import { climbLadder } from '../../src/player/enterExit.js';
import { GLOBAL_SCALE } from '../../src/world/meshReader.js';
import { INTERIOR_MARKER, hasInteriorModels, interiorCast } from '../../src/world/interior/interiorLayout.js';
import { collectInteriorPeople } from '../../src/characters/interiorPeople.js';
import { staticNpcData } from '../../src/characters/staticNpc.js';
import { buildingSummaries } from '../../src/world/buildingSummaries.js';
import { questorCandidateBuildings } from '../../src/systems/talk/talkTopics.js';
import { Place, buildingHasQuestMarker } from '../../src/systems/quest/place.js';
import { Symbol as QuestSymbol } from '../../src/systems/quest/symbol.js';
import { layCastMarkers, layMadeBuildingMarkers } from '../../src/systems/quest/castMarkers.js';
import { BLOCK_M } from '../../src/world/spawnedDungeons.js';

const B = BLOCK_M, HALF = IMPERIAL_CELLS / 2;
function sampleCell(x, z, n = 8) {
  const r0 = Math.floor(z / B + HALF), c0 = Math.floor(x / B + HALF);
  for (let k = 0; k < 6; k++) for (let r = r0 - k; r <= r0 + k; r++) for (let c = c0 - k; c <= c0 + k; c++) {
    if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== k || !/^I/.test(imperialCell(r, c) ?? '')) continue;
    if (fabricCell(r, c).plots.length >= n) return [r, c];
  }
  return null;
}
/** The BLD sample's cells (every sector, the inner and the outer ring, the palace's), and a spread of the city's. */
const CELLS = [...IMPERIAL_SECTORS.flatMap(([, b]) => [[b + 22.5, 3000], [b + 37.5, 5300]]), [170, 7300]].map(([b, r]) => sampleCell(...polar(b, r))).filter(Boolean);
const SPREAD = [];
for (let r = 5; r < IMPERIAL_CELLS; r += 29) for (let c = 7; c < IMPERIAL_CELLS; c += 29) if (/^I/.test(imperialCell(r, c) ?? '')) SPREAD.push([r, c]);
const buildingsOf = (cells, limit = Infinity) => { const out = []; for (const [r, c] of cells) for (const b of fabricCellBuildings(r, c)) if (out.length < limit) out.push(b); return out; };
const SAMPLE = buildingsOf([...CELLS, ...SPREAD]);
const wantStoreys = (b) => Math.max(1, Math.min(FABRIC_INTERIOR_STOREYS, Math.floor(b.plot.h / STOREY + 1e-6)));
const has = (cells, i, j) => cells.some((c) => c[0] === i && c[1] === j);
const S = FABRIC_SIDES;
/** A kit model's piece (its set-0 id: `piece + 100 * set`). */
const pieceOf = (id) => id - 100 * Math.floor((id % 1000) / 100);
const storeyOf = (o) => Math.round((o.objectType === 3 ? o.yPos : -o.yPos) / KIT_STOREY);
/** A plain grid of `w` columns from the door's (its door's column the first) and `d` rows. */
const gridOf = (w, d, i0 = 0) => { const out = []; for (let j = 0; j < d; j++) for (let i = i0; i < i0 + w; i++) out.push([i, j]); return out; };

test('IC-INTERIORS THE GRID IS THE FOOTPRINT - a building\'s cells are the kit\'s 3.2 m cells whose middles stand inside its footprint (its door\'s cell always, every one reached from it): every point of the footprint 2.3 m in from its walls is in a cell, every cell but the door\'s inside it, the interior as long and as deep as the building to a cell, a long building a long interior (mutants: a cell kept off its middle; the door\'s cell along the front from the door; the grid\'s axes swapped)', () => {
  let n = 0, long = 0;
  for (const b of SAMPLE) {
    const g = fabricInteriorGrid(b.plot.q, b.door.at, b.door.n, b.party);
    const xs = g.quad.map((p) => p[0]), zs = g.quad.map((p) => p[1]);
    const capped = Math.min(...xs) < FABRIC_DOOR_CELL_X - (FABRIC_INTERIOR_MAX.across + 0.5) * KIT_CELL || Math.max(...xs) > FABRIC_DOOR_CELL_X + (FABRIC_INTERIOR_MAX.across + 0.5) * KIT_CELL || Math.max(...zs) > FABRIC_INTERIOR_MAX.deep * KIT_CELL;
    assert.ok(has(g.cells, 0, 0), `${b.key}: the door's cell`);
    for (const [i, j] of g.cells) if (i || j) assert.ok(inQuad(g.quad, ...fabricCellMiddle(i, j)), `${b.key}: cell ${i},${j} inside`);
    // the door's cell's middle is in from the door, on the front's line through it
    assert.ok(Math.abs(fabricCellMiddle(0, 0)[0] - FABRIC_DOOR_CELL_X) < 1e-9 && fabricCellMiddle(0, 0)[1] === KIT_CELL / 2);
    if (capped) continue;
    n++;
    // every point 2.3 m (92 units) in from every wall in a cell (the footprint convex: a middle within half a cell's diagonal)
    const inset = 92;
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 24) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 24) {
      if (!inQuad(g.quad, x, z)) continue;
      let d = Infinity;
      for (let k = 0; k < 4; k++) { const a = g.quad[k], c = g.quad[(k + 1) & 3], dx = c[0] - a[0], dz = c[1] - a[1], l = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)); d = Math.min(d, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z)); }
      if (d < inset) continue;
      const i = Math.floor((x - FABRIC_DOOR_CELL_X + KIT_CELL / 2) / KIT_CELL), j = Math.floor(z / KIT_CELL);
      assert.ok(has(g.cells, i, j), `${b.key}: ${x.toFixed(0)},${z.toFixed(0)} in a cell`);
    }
    // as long and as deep as the building to a cell
    const across = Math.max(...xs) - Math.min(...xs), deep = Math.max(...zs) - Math.min(...zs);
    const cols = new Set(g.cells.map((c) => c[0])).size, rows = new Set(g.cells.map((c) => c[1])).size;
    assert.ok(Math.abs(cols * KIT_CELL - across) <= KIT_CELL * 1.25 && Math.abs(rows * KIT_CELL - deep) <= KIT_CELL * 1.25, `${b.key}: ${cols}x${rows} cells for ${across.toFixed(0)}x${deep.toFixed(0)}`);
    if (across > 1.8 * deep) { long++; assert.ok(cols > rows, `${b.key}: long along its front`); }
    if (deep > 1.8 * across) { long++; assert.ok(rows > cols, `${b.key}: long in from its front`); }
  }
  assert.ok(n > 800, `${n} buildings`);
  assert.ok(long > 40, `${long} long buildings`);
});

test('IC-INTERIORS THE STOREYS ITS WALLS SHOW, EVERY ONE REACHED - a building stands as many storeys inside as its walls show (its eave over a storey, to eight), each over the last at Daggerfall\'s own pitch, joined by Daggerfall\'s stair, else its ladder through a hole, else (a building of one cell) a hatch: every storey\'s rooms reached from where the way from below arrives, every floor laid but over a way from below (mutants: the storeys a storey short; a stair cutting the floor over it in two; the ladder never in the cell a climber arrives in; the hatch never stood; a ladder\'s room not carried up)', () => {
  const kinds = { stair: 0, ladder: 0, hatch: 0 };
  const check = (plan, want, label) => {
    assert.equal(plan.storeys.length, want, `${label}: ${plan.storeys.length} of ${want} storeys`);
    const rec = fabricInteriorRecord(plan, null), floors = new Map(), quarters = new Map();
    for (const o of rec.block3dObjectRecords) if (pieceOf(o.modelIdNum) === KIT_PIECE.floor) { const k = storeyOf(o); (o.xScale ? quarters : floors).set(k, ((o.xScale ? quarters : floors).get(k) ?? 0) + 1); }
    for (const st of plan.storeys) {
      if (st.up) kinds[st.up.kind]++;
      // its floor: every cell but a stair's well or a ladder's hole from below - three quarters of a hatch's cell
      const out = st.down && st.down.kind !== 'hatch' ? 1 : 0, hatch = st.down?.kind === 'hatch' ? 1 : 0;
      assert.equal(floors.get(st.k) ?? 0, plan.cells.length - out - hatch, `${label}: storey ${st.k}'s floor`);
      assert.equal(quarters.get(st.k) ?? 0, 3 * hatch, `${label}: storey ${st.k}'s hatch`);
      // every room reached through its doorways from the room a climber arrives in (the street door's on the ground)
      const from = st.k === 0 ? [0, 0] : fabricArrival(st.down), start = st.roomOf.get(`${from[0]},${from[1]}`);
      assert.ok(start >= 0, `${label}: storey ${st.k} arrives in a room`);
      const reached = new Set([start]), todo = [start];
      while (todo.length) { const r = todo.pop(); for (const w of st.doorways.values()) for (const [p, q] of [[w.from, w.to], [w.to, w.from]]) if (p === r && !reached.has(q)) { reached.add(q); todo.push(q); } }
      assert.equal(reached.size, st.rooms.length, `${label}: storey ${st.k}'s every room reached`);
      // a way up stands in this storey's floor and lands on the next one's
      if (st.up) {
        const next = plan.storeys[st.k + 1], land = fabricArrival(st.up);
        assert.ok(has(plan.cells, st.up.i, st.up.j) && next.roomOf.get(`${land[0]},${land[1]}`) >= 0, `${label}: storey ${st.k}'s way up lands in a room`);
      }
    }
  };
  const plans = SAMPLE.slice(0, 400).map((b) => [b, fabricBuildingPlan(b)]);
  for (const [b, plan] of plans) check(plan, wantStoreys(b), `${b.pool} ${b.key}`);
  // the slivers: one cell (its hatches), two (its ladders turn about, each in the cell the last arrived in)
  for (const key of [1, 2, 3, 4, 5, 6]) {
    const one = fabricInteriorPlan({ key, pool: 'tavern', cells: [[0, 0]], storeys: 4 });
    check(one, 4, `one cell #${key}`);
    assert.ok(one.storeys.slice(0, 3).every((st) => st.up.kind === 'hatch'), 'a hatch a storey');
    const two = fabricInteriorPlan({ key, pool: 'house3', cells: [[0, 0], [1, 0]], storeys: 4 });
    check(two, 4, `two cells #${key}`);
    assert.ok(two.storeys.slice(1, 3).every((st) => st.up.kind === 'ladder' && st.up.i === fabricArrival(st.down)[0] && st.up.j === fabricArrival(st.down)[1]), 'the ladder up in the cell the climber arrived in');
  }
  assert.ok(kinds.stair > 150 && kinds.ladder > 15 && kinds.hatch > 10, JSON.stringify(kinds));
  // a ladder's room carried up whole: the hole's walls the walls under it - no wall's thickness opens under a hole
  for (const [b, plan] of plans) {
    for (const st of plan.storeys) {
      if (st.down?.kind !== 'ladder') continue;
      const below = plan.storeys[st.k - 1], { i, j } = st.down;
      for (let s = 0; s < 4; s++) {
        const nb = [i + S[s][0], j + S[s][1]];
        if (!has(plan.cells, ...nb)) continue;
        assert.equal(fabricSideOf(plan, st, i, j, s) === null, fabricSideOf(plan, below, i, j, s) === null, `${b.key}: storey ${st.k}'s hole open on side ${s} as the storey under it`);
      }
    }
  }
});

/** A plan's signature: its set, its rooms (cells and parts), its ways and doorways, storey by storey, and its pieces. */
const signature = (plan, rec) => JSON.stringify([plan.set, plan.storeys.map((st) => [st.rooms.map((r) => [r.role, r.cells]), st.up, [...st.doorways.keys()].sort()]), rec.block3dObjectRecords.filter((o) => o.objectType === 3).map((o) => [o.modelIdNum, o.xPos, o.zPos, o.yRotation])]);

test('IC-INTERIORS THE SAME KEY THE SAME ROOMS, ANOTHER KEY OTHERS - a building\'s plan and record are its key\'s: the same on every call (every visit, every client), and twenty buildings of a kind on one footprint twenty layouts, eighteen of them at the least (mutants: the plan unseeded by the key; the rooms cut at their middles; the furniture\'s order unseeded)', () => {
  const cells = gridOf(3, 4, -1);
  for (const pool of ['house2', 'house1', 'general', 'alchemist', 'tavern', 'mages', 'bank', 'library']) {
    const seen = new Set();
    for (let key = 1; key <= 20; key++) {
      const plan = fabricInteriorPlan({ key: key * 7919, pool, cells, storeys: 2 }), rec = fabricInteriorRecord(plan, null);
      const again = fabricInteriorPlan({ key: key * 7919, pool, cells, storeys: 2 });
      assert.equal(signature(again, fabricInteriorRecord(again, null)), signature(plan, rec), `${pool} #${key}: the same`);
      assert.deepEqual(fabricInteriorRecord(again, null), rec);
      seen.add(signature(plan, rec));
    }
    assert.ok(seen.size >= 18, `${pool}: ${seen.size} layouts of 20`);
    // the plan itself - its storeys' rooms and ways, furniture aside - is the key's too
    const plans = new Set();
    for (let key = 1; key <= 20; key++) plans.add(JSON.stringify(fabricInteriorPlan({ key: key * 7919, pool, cells, storeys: 2 }).storeys.map((st) => [st.rooms, st.up, st.down])));
    assert.ok(plans.size >= 10, `${pool}: ${plans.size} plans of 20`);
  }
  // the same rooms (every outer wall blind: no window the key picks) under another key furnished otherwise - the record's
  // own seed, its key's
  const all = gridOf(3, 3, -1), blind = all.flatMap(([i, j]) => [0, 1, 2, 3].filter((s) => !has(all, i + S[s][0], j + S[s][1])).map((s) => `${i},${j},${s}`));
  const base = fabricInteriorPlan({ key: 4242, pool: 'house2', cells: all, blind, storeys: 1 });
  const props = (p) => JSON.stringify(fabricInteriorRecord(p, null).block3dObjectRecords.filter((o) => o.objectType === 3).map((o) => [o.modelIdNum, o.xPos, o.zPos, o.yRotation]));
  assert.equal(props({ ...base }), props(base));
  assert.notEqual(props({ ...base, key: 4243 }), props(base), 'furnished by its own key');
  // and the city's own: a building made twice is made the same
  _resetFabricInteriors();
  const b = SAMPLE[3], one = JSON.stringify(fabricBuildingInterior(b, null).block3dObjectRecords);
  _resetFabricInteriors();
  assert.equal(JSON.stringify(fabricBuildingInterior(b, null).block3dObjectRecords), one);
});

test('IC-INTERIORS THE STREET DOOR WHERE THE BUILDING\'S DOOR IS - every building\'s ground storey stands Daggerfall\'s street-door wall (3002) on its door cell\'s front, its door picture\'s middle at the interior\'s street door (FABRIC_ENTRANCE: its subrecord frame\'s, its door model\'s), facing the street, its Enter marker just in from it; no other storey a street door, no other wall of it (mutants: the door\'s cell a cell over; the exit wall turned; the Enter marker outside)', () => {
  for (const b of SAMPLE.slice(0, 300)) {
    const plan = fabricBuildingPlan(b), rec = fabricInteriorRecord(plan, null);
    const exits = rec.block3dObjectRecords.filter((o) => pieceOf(o.modelIdNum) === KIT_PIECE.exit);
    assert.equal(exits.length, 1, `${b.key}: one street door`);
    const e = exits[0], shift = KIT_SHIFT[e.modelIdNum] ?? [0, 0, 0];
    assert.equal(storeyOf(e), 0);
    assert.equal(e.yRotation, FABRIC_SIDE_TURN[0], `${b.key}: facing the street`);
    // its door picture's middle (local z exitDoorMid, at its face) where the entrance stands, a wall's inset in from it
    const [ox, oz] = fabricTurned(e.yRotation, shift[0], KIT_MEASURE.exitDoorMid + shift[2]);
    assert.ok(Math.abs(e.xPos + ox - FABRIC_ENTRANCE.door[0] / GLOBAL_SCALE) < 0.6 && Math.abs(e.zPos + oz - FABRIC_ENTRANCE.door[1] / GLOBAL_SCALE - (KIT_CELL / 2 - KIT_MEASURE.wallHalf)) < 0.6, `${b.key}: its picture's middle at the frame's origin, a wall's inset in (${e.xPos + ox}, ${e.zPos + oz})`);
    const enter = rec.blockFlatObjectRecords.filter((f) => f.textureArchive === 199 && f.textureRecord === INTERIOR_MARKER.ENTER);
    assert.equal(enter.length, 1);
    assert.deepEqual([enter[0].xPos, enter[0].zPos], fabricCellMiddle(0, 0), 'the landing in from the door');
  }
  assert.equal(FABRIC_ENTRANCE.out, -90, 'the way out toward -z');
});

test('IC-INTERIORS WINDOWS WHERE THE WALLS SHOW THEM - an outer wall\'s side is Daggerfall\'s window wall (3018) where the exterior shows windows, a plain wall where its edge is a party wall (blind outside, blind in), never a window between two rooms (mutants: a party wall windowed; no window at all; a window between rooms)', () => {
  let windows = 0, outer = 0, blindSeen = 0;
  for (const b of SAMPLE.slice(0, 400)) {
    const plan = fabricBuildingPlan(b);
    for (const st of plan.storeys) for (const [i, j] of plan.cells) for (let s = 0; s < 4; s++) {
      const side = fabricSideOf(plan, st, i, j, s), out = !has(plan.cells, i + S[s][0], j + S[s][1]);
      if (side === 'window') assert.ok(out, `${b.key}: a window only on an outer wall`);
      if (!out || side === 'exit' || side === null) continue;
      if (plan.blind.has(`${i},${j},${s}`)) { blindSeen++; assert.equal(side, 'wall', `${b.key}: blind side ${i},${j},${s}`); continue; }
      outer++;
      if (side === 'window') windows++;
    }
  }
  assert.ok(blindSeen > 200, `${blindSeen} party sides`);
  assert.ok(windows / outer > 0.65 && windows / outer < 0.85, `${windows} of ${outer} street sides windowed`);
  // the record lays them as the plan says: a party wall's side a plain wall
  const plan = fabricInteriorPlan({ key: 99, pool: 'house2', cells: gridOf(2, 2), blind: ['1,0,1', '1,1,1'], storeys: 1 });
  assert.equal(fabricSideOf(plan, plan.storeys[0], 1, 0, 1), 'wall');
  assert.equal(fabricSideOf(plan, plan.storeys[0], 1, 1, 1), 'wall');
});

/** A record's props by storey: [{ id, box, o }] (the ladder too). */
const propsOf = (rec) => { const by = new Map(); for (const o of rec.block3dObjectRecords) if (o.objectType === 3) { const k = storeyOf(o); if (!by.has(k)) by.set(k, []); by.get(k).push({ id: o.modelIdNum, o, box: fabricPieceBox(o.modelIdNum, o.yRotation, o.xPos, o.zPos) }); } return by; };
const cellAt = (x, z) => [Math.floor((x - FABRIC_DOOR_CELL_X + KIT_CELL / 2) / KIT_CELL), Math.floor(z / KIT_CELL)];

test('IC-INTERIORS EACH KIND FURNISHED AS ITS KIND - a shop its counter (its keeper behind it) and the shelves Daggerfall\'s own shops of its trade carry (stocked: DaggerfallInterior\'s shop-shelf group), a tavern its bar, its tables and seats and its rooms\' beds, a home its beds and its table or hearth, a guild hall its shelves and table, a bank its counter and its chests, a library its shelves; every piece Daggerfall\'s own (the kit, FURNITURE\'s) (mutants: a shop\'s shelves another trade\'s; the counter never stood; a home of one storey with no bedroom; the keeper elsewhere)', () => {
  const tally = new Map();
  const add = (k, v) => tally.set(k, (tally.get(k) ?? 0) + v);
  const fake = { getBlockByName: () => ({ rmbBlock: { subRecords: Array.from({ length: 40 }, () => ({ interior: { blockPeopleRecords: [{ xPos: 1, yPos: 0, zPos: 2, textureArchive: 182, textureRecord: 3, factionID: 0, flags: 0, position: 5 }], blockFlatObjectRecords: [] } })) } }) };
  for (const b of SAMPLE.slice(0, 600)) {
    const plan = fabricBuildingPlan(b), rec = fabricInteriorRecord(plan, interiorCast({ interior: fabricBuildingInterior(b, fake) }));
    const by = propsOf(rec), all = [...by.values()].flat(), ids = new Set(all.map((p) => p.id)), kind = POOL_KIND[b.pool];
    for (const o of rec.block3dObjectRecords) {
      const kit = Object.values(KIT_PIECE).includes(pieceOf(o.modelIdNum)) && Math.floor(o.modelIdNum / 100) % 10 < KIT_SET_ARCHIVES.length;
      assert.ok(kit || FURNITURE[o.modelIdNum], `${b.key}: ${o.modelIdNum} is Daggerfall's kit or furniture`);
    }
    add(`${kind}`, 1);
    const counters = all.filter((p) => p.id === 41126);
    if (kind === 'shop') {
      const shelves = all.filter((p) => POOL_SHELVES[b.pool].includes(p.id)).length;
      assert.ok(shelves > 0, `${b.key}: a ${b.pool}'s shelves`);
      add('shop shelves', shelves);
      if (counters.length) {
        add('shop counter', 1);
        // the keeper behind it: the first person on the counter's storey, the counter between them and the door
        const p = rec.blockPeopleRecords[0], c = counters[0].o;
        assert.ok(Math.abs(p.yPos + c.yPos - 2) < 1 && Math.hypot(p.xPos - c.xPos, p.zPos - c.zPos) < 34, `${b.key}: the keeper behind the counter`);
      }
    }
    if (kind === 'tavern') { add('tavern bar', counters.length ? 1 : 0); add('tavern tables', all.filter((p) => [41108, 41112, 41109, 41121].includes(p.id)).length); add('tavern beds', all.filter((p) => [41000, 41001].includes(p.id)).length && plan.storeys.length > 1 ? 1 : 0); add('tavern upstairs', plan.storeys.length > 1 ? 1 : 0); }
    if (kind === 'house') { assert.ok([41000, 41001, 41002].some((id) => ids.has(id)), `${b.key}: a home's bed`); add('house table or hearth', [41108, 41112, 41109, 41121, 41116, 41117].some((id) => ids.has(id)) ? 1 : 0); }
    if (kind === 'bank') { add('bank counter', counters.length ? 1 : 0); assert.ok(all.some((p) => [41811, 41812, 41813].includes(p.id)), `${b.key}: a bank's chests`); }
    if (kind === 'library') assert.ok(all.filter((p) => POOL_SHELVES.library.includes(p.id)).length >= 4, `${b.key}: a library's shelves`);
    if (kind === 'guild') assert.ok(all.some((p) => POOL_SHELVES[b.pool].includes(p.id)) && all.some((p) => [41108, 41112, 41109, 41121].includes(p.id)), `${b.key}: a hall's shelves and table`);
  }
  const t = Object.fromEntries(tally);
  assert.ok(t.shop > 60 && t["shop counter"] / t.shop > 0.97, `shops with a counter: ${t["shop counter"]} of ${t.shop}`);
  assert.ok(t['shop shelves'] / t.shop > 5, 'a shop\'s wall of stock');
  assert.ok(t.tavern > 5 && t['tavern bar'] / t.tavern > 0.95 && t['tavern tables'] / t.tavern > 2 && t['tavern beds'] === t['tavern upstairs'], JSON.stringify(t));
  assert.ok(t['house table or hearth'] / t.house > 0.97, JSON.stringify(t));
  // a home of one storey: its bedroom beside its living room
  for (let key = 1; key <= 12; key++) {
    const plan = fabricInteriorPlan({ key, pool: 'house3', cells: gridOf(3, 2, -1), storeys: 1 });
    assert.ok(plan.storeys[0].rooms.some((r) => r.role === 'bedroom' || r.role === 'cottage'), `#${key}: a bedroom`);
  }
});

/**
 * THE WALK, AS A BODY TAKES IT (this test's own reading of the law): a storey's floor in 8-unit squares - its floor cells
 * (none a hole's, a well's or a stair's foot's, none of a hatch's open quarter), a body's middle 14 (the capsule's radius)
 * in from every wall's face but across an open side or a doorway's opening, in no corner a post stands in, and 14 from
 * every piece. Whether every one of `points` is reached from the first.
 */
function walkReaches(plan, st, props, points) {
  const floorCell = (i, j) => has(plan.cells, i, j) && !(st.down && st.down.kind !== 'hatch' && st.down.i === i && st.down.j === j) && !(st.up?.kind === 'stair' && st.up.i === i && st.up.j === j);
  const L = KIT_MEASURE.wallHalf - 14, open = (i, j, s) => fabricSideOf(plan, st, i, j, s) === null && floorCell(i + S[s][0], j + S[s][1]);
  const ok = (x, z) => {
    const [i, j] = cellAt(x, z);
    if (!floorCell(i, j)) return false;
    const [cx, cz] = fabricCellMiddle(i, j), dx = x - cx, dz = z - cz;
    if (st.down?.kind === 'hatch' && st.down.i === i && st.down.j === j && Math.sign(dx) === st.down.q[0] && Math.sign(dz) === st.down.q[1]) return false;
    let outs = 0;
    for (let s = 0; s < 4; s++) {
      if (dx * S[s][0] + dz * S[s][1] <= L) continue;
      outs++;
      const along = dx * S[(s + 1) % 4][0] + dz * S[(s + 1) % 4][1], doorway = fabricSideOf(plan, st, i, j, s) === 'doorway' && Math.abs(along) <= 25 - 14;
      if (!open(i, j, s) && !doorway) return false;
    }
    if (outs === 2) { const ex = dx > 0 ? 1 : 3, ez = dz > 0 ? 2 : 0, di = i + S[ex][0], dj = j + S[ez][1]; if (!floorCell(di, dj) || !open(di, dj, (ex + 2) % 4) || !open(di, dj, (ez + 2) % 4)) return false; }
    return props.every((p) => !(x > p.box[0] - 14 && x < p.box[2] + 14 && z > p.box[1] - 14 && z < p.box[3] + 14));
  };
  const xs = plan.cells.map((c) => fabricCellMiddle(...c)[0]), zs = plan.cells.map((c) => fabricCellMiddle(...c)[1]);
  const x0 = Math.min(...xs) - 64, z0 = Math.min(...zs) - 64, nx = Math.round((Math.max(...xs) + 64 - x0) / 8), nz = Math.round((Math.max(...zs) + 64 - z0) / 8);
  const free = new Uint8Array(nx * nz);
  for (let pz = 0; pz < nz; pz++) for (let px = 0; px < nx; px++) free[pz * nx + px] = ok(x0 + (px + 0.5) * 8, z0 + (pz + 0.5) * 8) ? 1 : 0;
  const pix = ([x, z]) => { const cx = Math.floor((x - x0) / 8), cz = Math.floor((z - z0) / 8), out = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (cx + a >= 0 && cx + a < nx && cz + b >= 0 && cz + b < nz && free[(cz + b) * nx + cx + a]) out.push((cz + b) * nx + cx + a); return out; };
  const seen = new Uint8Array(nx * nz), todo = [...pix(points[0])];
  todo.forEach((p) => { seen[p] = 1; });
  while (todo.length) { const p = todo.pop(), px = p % nx; for (const q of [px > 0 ? p - 1 : -1, px < nx - 1 ? p + 1 : -1, p - nx, p + nx]) if (q >= 0 && q < seen.length && free[q] && !seen[q]) { seen[q] = 1; todo.push(q); } }
  return points.map((pt) => pix(pt).some((p) => seen[p]));
}

test('IC-INTERIORS WALKABLE AND TIDY - every piece stands inside its room\'s walls (none in a wall or past one), none on another, none in a door\'s swing, a stair\'s mouth or before a ladder; the cast (its people, its quest, rest and treasure markers) on the floor a body stands on, off every piece; the street door\'s landing clear (mutants: a piece\'s box turned the wrong way; the walk unchecked; the cast stood on the pieces)', () => {
  const fake = { getBlockByName: () => ({ rmbBlock: { subRecords: Array.from({ length: 40 }, () => ({ interior: { blockPeopleRecords: [0, 1, 2].map((n) => ({ xPos: n, yPos: 0, zPos: 0, textureArchive: 182, textureRecord: n, factionID: 0, flags: 0, position: n })), blockFlatObjectRecords: [[11, 1], [18, 2], [4, 3], [19, 4], [4, 5]].map(([r, x]) => ({ xPos: x, yPos: 0, zPos: 0, textureArchive: 199, textureRecord: r })) } })) } }) };
  let pieces = 0, cast = 0, walks = 0;
  for (const b of SAMPLE.slice(0, 350)) {
    const plan = fabricBuildingPlan(b), rec = fabricInteriorRecord(plan, interiorCast({ interior: fabricBuildingInterior(b, fake) })), by = propsOf(rec);
    for (const [k, list] of by) {
      const st = plan.storeys[k];
      for (const p of list) {
        pieces++;
        if (p.id === KIT_LADDER) continue;
        // inside its room's walls: each corner in a cell of the building, and in a wall's band only where that side is open
        for (const [x, z] of [[p.box[0] + 1, p.box[1] + 1], [p.box[2] - 1, p.box[1] + 1], [p.box[0] + 1, p.box[3] - 1], [p.box[2] - 1, p.box[3] - 1]]) {
          const [i, j] = cellAt(x, z), [cx, cz] = fabricCellMiddle(i, j);
          assert.ok(has(plan.cells, i, j), `${b.key}: ${p.id} inside the building`);
          for (let s = 0; s < 4; s++) if ((x - cx) * S[s][0] + (z - cz) * S[s][1] > KIT_MEASURE.wallHalf) assert.equal(fabricSideOf(plan, st, i, j, s), null, `${b.key}: ${p.id} through a wall`);
        }
      }
      for (let a = 0; a < list.length; a++) for (let c = a + 1; c < list.length; c++) {
        const A = list[a].box, C = list[c].box;
        assert.ok(!(A[0] < C[2] && C[0] < A[2] && A[1] < C[3] && C[1] < A[3]), `${b.key}: ${list[a].id} on ${list[c].id}`);
      }
    }
    // the cast on a floor, off the pieces
    for (const f of [...rec.blockPeopleRecords, ...rec.blockFlatObjectRecords.filter((m) => m.textureArchive === 199 && [4, 11, 18, 19].includes(m.textureRecord))]) {
      cast++;
      const k = Math.round(-f.yPos / KIT_STOREY), st = plan.storeys[k], [i, j] = cellAt(f.xPos, f.zPos);
      assert.ok(st && has(plan.cells, i, j), `${b.key}: cast on the building's floor`);
      assert.ok(!(st.down && st.down.kind !== 'hatch' && st.down.i === i && st.down.j === j) && !(st.up?.kind === 'stair' && st.up.i === i && st.up.j === j), `${b.key}: cast over no hole or stair`);
      if (st.down?.kind === 'hatch' && st.down.i === i && st.down.j === j) { const [cx, cz] = fabricCellMiddle(i, j); assert.ok(!(Math.sign(f.xPos - cx) === st.down.q[0] && Math.sign(f.zPos - cz) === st.down.q[1]), `${b.key}: cast over no hatch`); }
      for (const p of by.get(k) ?? []) assert.ok(!(f.xPos > p.box[0] - 6 && f.xPos < p.box[2] + 6 && f.zPos > p.box[1] - 6 && f.zPos < p.box[3] + 6), `${b.key}: cast at ${f.xPos},${f.zPos} off ${p.id}`);
    }
    // every way of every storey reached from every other: its doorways' thresholds (both sides), its street door's and its
    // landing, a stair's mouths, a ladder's foot and its landing
    for (const st of plan.storeys) {
      const pts = [];
      for (const w of st.doorways.values()) for (const [c, n] of [[w.a, w.b], [w.b, w.a]]) { const s = S.findIndex(([dx, dz]) => c[0] + dx === n[0] && c[1] + dz === n[1]), m = fabricCellMiddle(...c); pts.push([m[0] + S[s][0] * 34, m[1] + S[s][1] * 34]); }
      if (st.k === 0) pts.unshift(fabricCellMiddle(0, 0), [fabricCellMiddle(0, 0)[0], fabricCellMiddle(0, 0)[1] - 34]);
      for (const w of [st.up, st.down]) if (w?.kind === 'stair') { const q = w === st.up ? [w.i + S[w.e][0], w.j + S[w.e][1]] : fabricArrival(w), m = fabricCellMiddle(...q), s = S.findIndex(([dx, dz]) => q[0] + dx === w.i && q[1] + dz === w.j); pts.push([m[0] + S[s][0] * 34, m[1] + S[s][1] * 34]); }
      for (const f of rec.blockFlatObjectRecords) if (f.textureArchive === 199 && (f.textureRecord === INTERIOR_MARKER.LADDER_BOTTOM || f.textureRecord === INTERIOR_MARKER.LADDER_TOP) && Math.round(-f.yPos / KIT_STOREY) === st.k) pts.push([f.xPos, f.zPos]);
      if (pts.length < 2) continue;
      const got = walkReaches(plan, st, by.get(st.k) ?? [], pts);
      walks++;
      assert.ok(got.every(Boolean), `${b.key}: storey ${st.k}'s ways all reached (${JSON.stringify(pts.filter((_, n) => !got[n]))})`);
    }
    // every door's swing clear, either side of its doorway (its leaf 48 wide turning about its hinge)
    for (const st of plan.storeys) for (const w of st.doorways.values()) for (const [c, n] of [[w.a, w.b], [w.b, w.a]]) {
      const s = S.findIndex(([dx, dz]) => c[0] + dx === n[0] && c[1] + dz === n[1]), [mx, mz] = fabricCellMiddle(...c), d = S[s];
      const a = [mx + d[0] * 64, mz + d[1] * 64], e = [mx + d[0] * 10, mz + d[1] * 10];
      const swing = d[0] ? [Math.min(a[0], e[0]), mz - 30, Math.max(a[0], e[0]), mz + 30] : [mx - 30, Math.min(a[1], e[1]), mx + 30, Math.max(a[1], e[1])];
      for (const p of by.get(st.k) ?? []) assert.ok(!(p.box[0] < swing[2] && swing[0] < p.box[2] && p.box[1] < swing[3] && swing[1] < p.box[3]), `${b.key}: ${p.id} in a door's swing`);
    }
    // a rest marker (a rented room's bed - MoveToBed) by a bed, while the beds last
    const beds = [...by.values()].flat().filter((p) => [41000, 41001, 41002].includes(p.id));
    const rests = rec.blockFlatObjectRecords.filter((f) => f.textureArchive === 199 && f.textureRecord === INTERIOR_MARKER.REST).slice(0, beds.length);
    for (const f of rests) assert.ok(beds.some((p) => storeyOf(p.o) === Math.round(-f.yPos / KIT_STOREY) && Math.hypot(p.o.xPos - f.xPos, p.o.zPos - f.zPos) < 100), `${b.key}: a rest marker by a bed`);
    // the street door's landing clear
    for (const p of by.get(0) ?? []) assert.ok(!(p.box[0] < FABRIC_DOOR_CELL_X + 24 && p.box[2] > FABRIC_DOOR_CELL_X - 24 && p.box[1] < KIT_CELL / 2 + 24), `${b.key}: ${p.id} on the landing`);
  }
  assert.ok(pieces > 10000 && cast > 1700 && walks > 400, `${pieces} pieces, ${cast} of the cast, ${walks} storeys walked`);
});

test('IC-INTERIORS THE CAST IS THE DONOR\'S, AND A WALK OVER THE CITY MAKES NONE - a building\'s people are its donor\'s, each named as its donor\'s record stands them (castPos: the questor pool, which reads the donor\'s, and the scene, which reads the room\'s, draw the same person), its quest markers the donor\'s; the summaries, the questor pool and a quest\'s marker search read the cast (interiorCast) and make no interior, the scene\'s first read makes one (mutants: a person named where the room stands them; the questor pool reading the made room; hasInteriorModels making it; the site search making it)', () => {
  const donor = { blockPeopleRecords: [0, 1, 2, 3].map((n) => ({ xPos: 100 + n * 37, yPos: -2, zPos: -300 + n * 11, textureArchive: 182, textureRecord: n, factionID: 0, flags: n & 1 ? 32 : 0, position: 4000 + n })), blockFlatObjectRecords: [[11, 10], [18, 20], [11, 30], [4, 40], [210, 50]].map(([r, x]) => ({ xPos: x, yPos: 0, zPos: -x, textureArchive: r === 210 ? 210 : 199, textureRecord: r === 210 ? 13 : r })) };
  const fake = { getBlockByName: () => ({ rmbBlock: { subRecords: Array.from({ length: 40 }, () => ({ interior: donor })) } }) };
  const [r, c] = CELLS[0], name = imperialOwnName(r, c);
  const DEPS = { portBlockJson, miscModelAt, startMarkerAt, footprintOf: () => null, anchorMarkers: [], noGround: 255, rim: () => false };
  _resetFabricInteriors();
  const block = withFabricBuildings(imperialBlockJson(name, DEPS), name, fake), recs = fabricCellBuildings(r, c), blocks = [{ x: 0, y: 0, dfBlock: block }];
  const rows = buildingSummaries([], blocks, {});
  const pool = questorCandidateBuildings([], blocks, { locationIndex: 3 });
  const marked = recs.map((_, i) => buildingHasQuestMarker(block, i));
  const place = new Place({ uid: 1, rolls: () => 0, resources: new Map(), hooks: {} });
  place.symbol = new QuestSymbol('_site_');
  const sites = recs.map((_, i) => place._enumerateBuildingQuestMarkers(block, i));
  assert.equal(_fabricInteriorsMade(), 0, 'none made by the walks');
  assert.ok(rows.length === recs.length && rows.every((x) => x.hasInterior) && block.rmbBlock.subRecords.every((s) => hasInteriorModels(s)));
  assert.ok(marked.every(Boolean));
  assert.deepEqual(sites[0].questSpawnMarkers.map((m) => m.flatPosition), [10, 30].map((x) => ({ x: x * GLOBAL_SCALE, y: -0, z: -x * GLOBAL_SCALE })), 'in the cast\'s frame');
  // the scene's read makes it, once; its people are the donor's, in order, named as the questor pool names them
  const sub = block.rmbBlock.subRecords[0], made = sub.interior.blockPeopleRecords;
  assert.equal(_fabricInteriorsMade(), 1);
  void sub.interior.block3dObjectRecords;
  assert.equal(_fabricInteriorsMade(), 1, 'made once');
  assert.deepEqual(made.map((p) => [p.textureRecord, p.position, p.castPos]), donor.blockPeopleRecords.map((p) => [p.textureRecord, p.position, [p.xPos, p.yPos, p.zPos]]));
  assert.ok(made.some((p, n) => p.xPos !== donor.blockPeopleRecords[n].xPos), 'stood in its own rooms');
  const scene = collectInteriorPeople(sub).map((p) => staticNpcData(p, { locationIndex: 3, buildingKey: pool[0].buildingKey }));
  assert.deepEqual(scene.map((d) => [d.hash, d.nameSeed]), pool[0].npcs.map((d) => [d.hash, d.nameSeed]), 'the same people');
  // its markers the donor's: the two spawns and the item in the cast's order, the rest marker; its light's picture
  const flats = sub.interior.blockFlatObjectRecords;
  assert.deepEqual(flats.filter((f) => f.textureArchive === 199 && [4, 11, 18].includes(f.textureRecord)).map((f) => [f.textureRecord, f.castPos[0]]), [[11, 10], [18, 20], [11, 30], [4, 40]]);
  assert.ok(flats.some((f) => f.textureArchive === 210 && f.textureRecord === 13));
  _resetFabricInteriors();
});

test('IC-INTERIORS A QUEST\'S MARKERS LAID ON THE ROOMS AT THE MOUNT - a site enumerated off a made building\'s cast (or a save from before) has its markers laid on the building\'s own when it is entered: its n-th spawn marker on the room\'s n-th, its item markers likewise, its selected marker on the one it copied, the old spot kept (a foe a save stood there follows it); laid once, a site of another count left alone (mutants: the spawn markers laid in reverse; the selected marker left; laid every mount)', () => {
  const donor = { blockPeopleRecords: [], blockFlatObjectRecords: [[11, 10], [18, 20], [11, 30]].map(([r, x]) => ({ xPos: x, yPos: 0, zPos: -x, textureArchive: 199, textureRecord: r })) };
  const fake = { getBlockByName: () => ({ rmbBlock: { subRecords: Array.from({ length: 40 }, () => ({ interior: donor })) } }) };
  const [r, c] = CELLS[1], name = imperialOwnName(r, c);
  const DEPS = { portBlockJson, miscModelAt, startMarkerAt, footprintOf: () => null, anchorMarkers: [], noGround: 255, rim: () => false };
  _resetFabricInteriors();
  const block = withFabricBuildings(imperialBlockJson(name, DEPS), name, fake);
  const place = new Place({ uid: 1, rolls: () => 0, resources: new Map(), hooks: {} });
  place.symbol = new QuestSymbol('_site_');
  const site = { siteType: 3, buildingKey: (1 << 16) | (2 << 8) | 0, ...place._enumerateBuildingQuestMarkers(block, 0) };
  site.selectedMarker = { ...site.questSpawnMarkers[1], targetResources: [{ name: '_foe_' }] };
  const interior = block.rmbBlock.subRecords[0].interior;
  const own = (rec) => interior.blockFlatObjectRecords.filter((f) => f.textureArchive === 199 && f.textureRecord === rec).map((f) => ({ x: f.xPos * GLOBAL_SCALE, y: -f.yPos * GLOBAL_SCALE, z: f.zPos * GLOBAL_SCALE }));
  const near = (a, b2) => Math.hypot(a.x - b2.x, a.y - b2.y, a.z - b2.z) < 1e-6;
  assert.equal(layCastMarkers(site, interior), 4);
  own(11).forEach((p, n) => assert.ok(near(site.questSpawnMarkers[n].flatPosition, p), `spawn ${n}`));
  own(18).forEach((p, n) => assert.ok(near(site.questItemMarkers[n].flatPosition, p), `item ${n}`));
  assert.ok(near(site.selectedMarker.flatPosition, own(11)[1]) && near(site.selectedMarker.curatedFrom, { x: 30 * GLOBAL_SCALE, y: 0, z: -30 * GLOBAL_SCALE }), 'the selected one follows its copy, its old spot kept');
  assert.equal(layCastMarkers(site, interior), 0, 'once');
  assert.equal(layCastMarkers({ questSpawnMarkers: [site.questSpawnMarkers[0]], questItemMarkers: null }, interior), 0, 'another count: not this cast\'s');
  // through the machine's links and the world's block, as the mount runs it
  const fresh = { siteType: 3, buildingKey: (1 << 16) | (2 << 8) | 0, ...place._enumerateBuildingQuestMarkers(block, 0) };
  const quest = { getPlace: () => ({ siteDetails: fresh, siteTown: () => ({ name: 'IC' }) }) };
  const machine = { getSiteLinks: (type, mapId, key) => (type === 3 && mapId === 77 && key === fresh.buildingKey ? [{ questUID: 1, placeSymbol: place.symbol }] : []), getQuest: () => quest };
  const world = { maps: { getRmbBlockName: (loc, x, y) => (x === 1 && y === 2 ? name : null) }, questBlock: (n) => (n === name ? block : null) };
  assert.equal(layMadeBuildingMarkers(machine, world, 77, fresh.buildingKey), 3);
  own(11).forEach((p, n) => assert.ok(near(fresh.questSpawnMarkers[n].flatPosition, p)));
  _resetFabricInteriors();
});

test('IC-INTERIORS THE LADDER CLIMBED IS THE LADDER\'S OWN - a house of three storeys stands a ladder a storey, one over another\'s landing: DaggerfallLadder.ClimbLadder\'s nearest markers climb nowhere there, the ladder\'s own (its head\'s nearest top, its foot\'s nearest bottom) climb it up to its landing and down to its foot, every ladder of the city\'s made interiors (mutants: the player\'s nearest top; the head and the foot swapped)', () => {
  const lift = (k) => (k * KIT_STOREY + 2) * GLOBAL_SCALE + 63 * GLOBAL_SCALE;   // a ladder's origin: its foot on its floor, 126 tall
  let climbs = 0;
  for (const b of SAMPLE.slice(0, 500)) {
    const plan = fabricBuildingPlan(b);
    if (!plan.storeys.some((st) => st.up && st.up.kind !== 'stair')) continue;
    const rec = fabricInteriorRecord(plan, null);
    const markers = rec.blockFlatObjectRecords.filter((f) => f.textureArchive === 199).map((f) => ({ type: f.textureRecord, x: f.xPos * GLOBAL_SCALE, y: -f.yPos * GLOBAL_SCALE, z: f.zPos * GLOBAL_SCALE }));
    for (const o of rec.block3dObjectRecords.filter((x) => x.modelIdNum === KIT_LADDER)) {
      const k = storeyOf(o), M = new Float32Array(16);
      M[12] = o.xPos * GLOBAL_SCALE; M[13] = lift(k); M[14] = o.zPos * GLOBAL_SCALE;
      const feet = markers.filter((m) => m.type === INTERIOR_MARKER.LADDER_BOTTOM && Math.abs(m.y - k * KIT_STOREY * GLOBAL_SCALE) < 0.01);
      const foot = feet.reduce((a, m) => (!a || Math.hypot(m.x - M[12], m.z - M[14]) < Math.hypot(a.x - M[12], a.z - M[14]) ? m : a), null);
      const up = climbLadder([foot.x, foot.y + 1.17, foot.z], markers, INTERIOR_MARKER, M);
      assert.ok(up && Math.abs(up[1] - (k + 1) * KIT_STOREY * GLOBAL_SCALE) < 0.01 && Math.hypot(up[0] - M[12], up[2] - M[14]) < 3.8, `${b.key}: storey ${k}'s ladder up to the next`);
      const down = climbLadder([up[0], up[1] + 1.17, up[2]], markers, INTERIOR_MARKER, M);
      assert.deepEqual(down, [foot.x, foot.y, foot.z], `${b.key}: and down to its foot`);
      climbs++;
    }
  }
  assert.ok(climbs > 40, `${climbs} ladders climbed`);
  // a hatch's landing (its LADDER_TOP) in a quarter of its cell other than the hatch's own: the climber steps off onto floor
  let hatches = 0;
  for (let key = 1; key <= 40; key++) {   // a building of one cell, two to four storeys: a hatch a storey
    const plan = fabricInteriorPlan({ key: key * 104729, pool: key % 2 ? 'house2' : 'house1', cells: [[0, 0]], storeys: 2 + (key % 3) }), rec = fabricInteriorRecord(plan, null), b = { key };
    for (const st of plan.storeys) {
      if (st.down?.kind !== 'hatch') continue;
      const [cx, cz] = fabricCellMiddle(st.down.i, st.down.j);
      const tops = rec.blockFlatObjectRecords.filter((f) => f.textureArchive === 199 && f.textureRecord === INTERIOR_MARKER.LADDER_TOP && Math.abs(-f.yPos - st.k * KIT_STOREY) < 1 && Math.abs(f.xPos - cx) < 48 && Math.abs(f.zPos - cz) < 48);
      assert.equal(tops.length, 1, `${b.key}: storey ${st.k}'s hatch its one landing`);
      const q = [Math.sign(tops[0].xPos - cx), Math.sign(tops[0].zPos - cz)];
      assert.ok(q[0] !== st.down.q[0] || q[1] !== st.down.q[1], `${b.key}: storey ${st.k}'s landing off its hatch`);
      hatches++;
    }
  }
  assert.ok(hatches >= 40, `${hatches} hatches landed`);
  // two ladders, one over the other's landing: the nearest markers are the landing the player stands on
  const markers = [
    { type: INTERIOR_MARKER.LADDER_BOTTOM, x: 0, y: 0, z: 0 }, { type: INTERIOR_MARKER.LADDER_TOP, x: 2, y: 3.225, z: 0 },
    { type: INTERIOR_MARKER.LADDER_BOTTOM, x: 2.4, y: 3.225, z: 0 }, { type: INTERIOR_MARKER.LADDER_TOP, x: 0, y: 6.45, z: 0 },
  ];
  const second = new Float32Array(16); second[12] = 2.4; second[13] = lift(1); second[14] = 1.3;
  assert.deepEqual(climbLadder([2.4, 3.225 + 1.17, 0], markers, INTERIOR_MARKER), [2.4, 3.225, 0], 'DFU\'s law: the nearest top the one under the player - down to the foot they stand at, nowhere');
  assert.deepEqual(climbLadder([2.4, 3.225 + 1.17, 0], markers, INTERIOR_MARKER, second), [0, 6.45, 0], 'the ladder\'s own');
});

test('IC-PROPS x IC-INTERIORS A TEMPLE ITS NAVE, THE THIEVES GUILD\'S HOUSE A HOME - the temples of the Eight IC-PROPS brought into the fabric are laid out as a temple: Daggerfall\'s temple set (Interior_TempleInt, TEXTURE.163), its nave the front room (its altar stands, the pedestals, and its pews), the priests\' rooms behind; the Thieves Guild\'s houses a home (THIE blocks\' House2) in a home\'s sets (mutants: the temple a house; its set; its nave unfurnished)', () => {
  assert.equal(POOL_KIND.temple, 'temple');
  assert.equal(POOL_KIND.thieves, 'house');
  for (let key = 1; key <= 12; key++) {
    const plan = fabricInteriorPlan({ key: key * 6151, pool: 'temple', cells: gridOf(4, 5, -1), storeys: 1 }), rec = fabricInteriorRecord(plan, null);
    assert.equal(KIT_SET_ARCHIVES[plan.set], 163, `temple #${key}: the temple set`);
    assert.equal(plan.storeys[0].rooms[0].role, 'nave', `temple #${key}: its nave first`);
    const ids = rec.block3dObjectRecords.filter((o) => o.objectType === 3).map((o) => o.modelIdNum);
    assert.ok(ids.includes(41020), `temple #${key}: its altar's pedestal`);
    assert.ok(ids.filter((id) => id === 41105 || id === 41106).length >= 2, `temple #${key}: its pews`);
    const house = fabricInteriorPlan({ key: key * 6151, pool: 'thieves', cells: gridOf(3, 4, -1), storeys: 2 });
    assert.ok([0, 4, 7].includes(house.set), `thieves #${key}: a home's set`);
    assert.equal(house.storeys[0].rooms[0].role, 'living', `thieves #${key}: a home's rooms`);
  }
});
