// FIELD BUGS 2026-10-11e - WAY-ROUND, the Discord's "Card Table blocking" again: "another one at Dancing Castle in
// Pilliweyn" (æther), a day after WALK-WHOLE shipped for the Gold Dungeon in Menakat.
//
// Read on the player's own taverns (ARENA2, both town packs - the last test), WALK-WHOLE moved no table it was written
// for. The Gold Dungeon (Beautiful Cities' GENRGL00 #7) holds the table's ring only in the one corridor its two halves
// meet by: every spot there cut the walk, so the fallback for "a room with no other spot" stood it at the first of
// them - the screenshot's table, and with it in, the player's capsule reached a third of the floor it had. And a spot in
// a doorway or the mouth of an opening passed WALK-WHOLE whenever the building went round another way: the Dancing
// Castle's (GEMSAM01 #1) gold table stood in its hall's way east, GENRAL03 #2's chips table square in the doorway
// between its two rooms. world/placedCardTable.js now passes a spot over as well when the walked cells round its table
// and lane, out to PLACE_ROUND_CELLS past them, fall apart with those cells taken out, and stands no table where no spot
// is left whole (test/world/fb1009c_walkwhole.test.js's second pin moved with it). `01-Overview/bugs/Field-Bugs-2026-10-11e.md`;
// `11-Multiplayer/Tavern-Cards.md` section 28.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { placedTableSpot, PLACE_ROUND_CELLS, PLACE_CELL, PLACE_LANE_CELLS } from '../../src/world/placedCardTable.js';
import { cardTablePropModel, CARD_TABLE_BOX } from '../../src/world/card/cardTableProp.js';
import { trs, transformPoint } from '../../src/world/mat4.js';
import { CAPSULE_RADIUS } from '../../src/player/motor.js';

// fb1009c_walkwhole.test.js's room: `floorAt(x, z)` its floor (null for none), `boxes` its solids
function room({ floorAt = () => 0, boxes = [] } = {}) {
  const near = (b, x, y, z) => Math.hypot(Math.max(b.min[0] - x, 0, x - b.max[0]), Math.max(b.min[1] - y, 0, y - b.max[1]), Math.max(b.min[2] - z, 0, z - b.max[2]));
  return {
    floor(x, y, z) {
      let best = floorAt(x, z);
      if (best != null && (best > y || best < y - 3)) best = null;
      for (const b of boxes) if (x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2] && b.max[1] <= y && (best == null || b.max[1] > best)) best = b.max[1];
      return best;
    },
    open(x, y, z, r) { return boxes.every((b) => near(b, x, y, z) >= r); },
  };
}
const wallX = (x, z0, z1) => ({ min: [x - 0.1, 0, z0], max: [x + 0.1, 3, z1] });
const wallZ = (z, x0, x1) => ({ min: [x0, 0, z - 0.1], max: [x1, 3, z + 0.1] });

/** The whole prop's box (the table and its stools) where the spot stands it. */
function propBox(spot) {
  const m = trs(spot.x, spot.y, spot.z, 0, spot.yawDeg, 0);
  const p = cardTablePropModel().positions;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    const v = transformPoint(m, p[i], p[i + 1], p[i + 2]);
    for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], v[a]); max[a] = Math.max(max[a], v[a]); }
  }
  return { min, max };
}
/** The tavern's two tables as the host stands them (scenes/interiorContext.js): the chips table, then the gold one with
 *  the first in the room and its ring an avoid box. */
function twoTables(boxes, start) {
  const s1 = placedTableSpot(CARD_TABLE_BOX, start, room({ boxes }));
  const s2 = s1 && placedTableSpot(CARD_TABLE_BOX, start, room({ boxes: [...boxes, propBox(s1)] }), [[s1.cx, s1.y, s1.cz, s1.hx, s1.hz]]);
  return [s1, s2];
}
/** Whether the player's capsule walks from `from` to `to` on a 5 cm grid, its knees clear, without leaving `bounds`
 *  ([x0, x1, z0, z1]) - the way straight through, not the way round the building. */
function reachesWithin(r, from, to, bounds) {
  const step = 0.05, key = (i, k) => `${i},${k}`;
  const seen = new Set([key(0, 0)]), q = [[0, 0]];
  const ti = Math.round((to[0] - from[0]) / step), tk = Math.round((to[2] - from[2]) / step);
  for (let h = 0; h < q.length; h++) {
    const [i, k] = q[h];
    if (i === ti && k === tk) return true;
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nk = k + dk, x = from[0] + ni * step, z = from[2] + nk * step;
      if (seen.has(key(ni, nk)) || x < bounds[0] || x > bounds[1] || z < bounds[2] || z > bounds[3]) continue;
      seen.add(key(ni, nk));
      if (r.open(x, 0.6, z, CAPSULE_RADIUS)) q.push([ni, nk]);
    }
  }
  return false;
}
const at = (s) => s && [Math.round(s.cx * 100) / 100, Math.round(s.cz * 100) / 100, s.yawDeg];

test('WAY-ROUND the law: the way round a table goes no further than a metre past its lane', () => {
  assert.equal(PLACE_ROUND_CELLS, 2);
  assert.equal(PLACE_ROUND_CELLS * PLACE_CELL, 1);
  assert.equal(PLACE_LANE_CELLS, 1, 'the lane WALK-WHOLE leaves, unchanged');
});

// THE DANCING CASTLE'S SHAPE: a hall 9 by 6 at the entrance (by its north wall), an opening 3 m wide in each of its east
// and west walls into a corridor that runs round a solid core - the building goes round, so a table in an opening cuts
// nothing WALK-WHOLE could count.
const DANCING = [
  wallZ(0, -3.1, 12.1), wallX(-3, 0, 14.1), wallX(12, 0, 14.1), wallZ(14, -3.1, 12.1),   // the outer walls
  wallX(0, 0, 1.5), wallX(0, 4.5, 6.1), wallX(9, 0, 1.5), wallX(9, 4.5, 6.1),           // the hall's, openings z 1.5..4.5
  wallZ(6, -0.1, 9.1), { min: [-0.1, 0, 6], max: [9.1, 3, 11] },                         // its south wall, and the core
];

test('WAY-ROUND, the Dancing Castle\'s shape: the chips table in the hall\'s middle, and no gold table in the mouth of its way west - the player walks from the hall through the opening, which WALK-WHOLE\'s gold table stood across (mutant: the way round the whole building counted)', () => {
  const [chips, gold] = twoTables(DANCING, [4, 0, 0.6]);
  assert.deepEqual(at(chips), [5, 2.6, 0], 'the chips table where it stood');
  assert.equal(gold, null, 'the hall holds one table out of the way, and the gold table is not stood in an opening');
  const hall = [-3, 4.5, 0, 6];   // the hall's west half and the corridor past its west opening
  assert.ok(reachesWithin(room({ boxes: DANCING }), [1.5, 0, 0.6], [-1.5, 0, 3], hall), 'the bare hall walks west (the probe is sound)');
  assert.ok(reachesWithin(room({ boxes: [...DANCING, propBox(chips)] }), [1.5, 0, 0.6], [-1.5, 0, 3], hall), 'and with its table stood');
  // the spot WALK-WHOLE stood the gold table at (its own walk's, the grid an eighth and a sixteenth of a unit off the
  // entrance; the table's box is centred, so the spot is its middle) - turned a quarter by the west opening: it cut
  // nothing the walk counted, the corridor going round, and it shuts the player's way west
  const walkWhole = { x: 2.003125, y: 0, z: 2.1015625, yawDeg: 90 };
  assert.equal(reachesWithin(room({ boxes: [...DANCING, propBox(chips), propBox(walkWhole)] }), [1.5, 0, 0.6], [-1.5, 0, 3], hall), false, 'WALK-WHOLE\'s gold table shut the way west');
});

// GENRAL03 #2's SHAPE: an entry room 3 m wide (the entrance by its north wall), a doorway 2.8 m wide in its east wall
// into a hall 8 by 6; and a door in each one's south wall into a corridor under both - a second way between them.
const DOORWAY = [
  wallZ(0, -0.1, 11.1), wallX(0, 0, 8.1), wallX(11, 0, 8.1),
  wallX(3, 0, 1.6), wallX(3, 4.4, 6.1),
  wallZ(6, -0.1, 0.6), wallZ(6, 1.8, 9), wallZ(6, 10.2, 11.1),
  wallZ(8, -0.1, 11.1),
];

test('WAY-ROUND, a doorway between two rooms with a second way between them (GENRAL03 #2): the table stands in the hall, not square in the doorway, and the player walks through the doorway (mutant: the window\'s pieces unasked)', () => {
  const [chips, gold] = twoTables(DOORWAY, [1, 0, 0.6]);
  assert.ok(chips && chips.cx - chips.hx > 3, `the chips table past the doorway, its ring clear of the wall between (${JSON.stringify(at(chips))})`);
  assert.ok(gold && gold.cx - gold.hx > 3, `and the gold table (${JSON.stringify(at(gold))})`);
  const straight = [0, 11, 0, 6];   // the two rooms, not the corridor under them
  const furnished = room({ boxes: [...DOORWAY, propBox(chips), propBox(gold)] });
  for (const to of [[4.5, 0, 4.6], [10.4, 0, 0.6]]) {
    assert.ok(reachesWithin(room({ boxes: DOORWAY }), [1, 0, 3], to, straight), `the bare rooms walk through the doorway to (${to[0]}, ${to[2]})`);
    assert.ok(reachesWithin(furnished, [1, 0, 3], to, straight), `and with both tables stood (${to[0]}, ${to[2]})`);
  }
  // the spot WALK-WHOLE stood the chips table at: square in the doorway (its middle on the wall between), and the
  // player's way through it shut
  const walkWhole = { x: 3.003125, y: 0, z: 3.1015625, yawDeg: 0 };
  assert.equal(reachesWithin(room({ boxes: [...DOORWAY, propBox(walkWhole)] }), [1, 0, 3], [4.5, 0, 4.6], straight), false, 'WALK-WHOLE\'s table shut the doorway');
});

test('WAY-ROUND, two tables in a room 7 by 6: the way round the second goes round the pair - it stands beside the first, as it did (mutant: the window blind to the table already stood)', () => {
  const W = [wallZ(0, -0.1, 7.1), wallZ(6, -0.1, 7.1), wallX(0, 0, 6), wallX(7, 0, 6)];
  const [chips, gold] = twoTables(W, [3.5, 0, 0.6]);
  const ox = 3.5 + 1 / 320 - 3.5, oz = 0.6 + 1 / 640 - 0.6;   // the grid's offset off the entrance
  assert.deepEqual(at(chips), [Math.round((4.5 + ox) * 100) / 100, Math.round((2.6 + oz) * 100) / 100, 0]);
  assert.ok(gold, 'the gold table stands');
  assert.deepEqual(at(gold), [Math.round((1.5 + ox) * 100) / 100, Math.round((2.1 + oz) * 100) / 100, 90], 'turned a quarter beside the chips table');
  const furnished = room({ boxes: [...W, propBox(chips), propBox(gold)] });
  for (const to of [[6.5, 0, 5.5], [0.5, 0, 5.5], [6.5, 0, 0.5]]) assert.ok(reachesWithin(furnished, [3.5, 0, 0.6], to, [0, 7, 0, 6]), `the player reaches (${to[0]}, ${to[2]})`);
});

test('WAY-ROUND, two tables a lane apart (a room 6 by 8, a pillar by the first): the window that meets the first takes it in whole, and the second stands in the far corner, its way round going round both (mutants: the window grown only for a ring it overlaps; the first\'s lane left out of it)', () => {
  const pillar = (x, z) => ({ min: [x - 0.2, 0, z - 0.2], max: [x + 0.2, 3, z + 0.2] });
  const corner = [wallZ(0, -0.1, 6.1), wallZ(8, -0.1, 6.1), wallX(0, 0, 8), wallX(6, 0, 8), pillar(2, 5)];
  const [c1, g1] = twoTables(corner, [3, 0, 0.6]);
  assert.deepEqual([at(c1), at(g1)], [[3.5, 3.1, 0], [2, 6.6, 0]]);
  const fc = room({ boxes: [...corner, propBox(c1), propBox(g1)] });
  for (const to of [[5.5, 0, 7.5], [5.5, 0, 2], [0.5, 0, 3]]) assert.ok(reachesWithin(fc, [3, 0, 0.6], to, [0, 6, 0, 8]), `the player reaches (${to[0]}, ${to[2]})`);
  // a room 7.5 by 5.5, a pillar by its east wall: the chips table turned, and the gold one turned beside it - the
  // first's lane is what the window must take in for the way round them to go round the pair
  const beside = [wallZ(0, -0.1, 7.6), wallZ(5.5, -0.1, 7.6), wallX(0, 0, 5.5), wallX(7.5, 0, 5.5), pillar(6, 3)];
  const [c2, g2] = twoTables(beside, [3.75, 0, 0.6]);
  assert.deepEqual([at(c2), at(g2)], [[4.25, 3.1, 90], [1.75, 2.1, 90]]);
  const fb = room({ boxes: [...beside, propBox(c2), propBox(g2)] });
  for (const to of [[7, 0, 5], [0.5, 0, 5]]) assert.ok(reachesWithin(fb, [3.75, 0, 0.6], to, [0, 7.5, 0, 5.5]), `the player reaches (${to[0]}, ${to[2]})`);
});

// ── THE PLAYER'S OWN TAVERNS ─────────────────────────────────────────────────────────────────────────────────────
const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['MAPS.BSA', 'BLOCKS.BSA', 'ARCH3D.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));

test('WAY-ROUND with ARENA2: every tavern the towns lay, with the town packs and without, its tables stood, leaves the player\'s capsule every floor it had from the entrance - the Gold Dungeon (Menakat) stands none, the Dancing Castle (Pilliweyn) its chips table where it stood and no gold table in its hall\'s way east', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set', timeout: 900000 }, async () => {
  const { openTowns, everyLocation } = await import('../fb1004dArena.mjs');
  const { Arch3dFile } = await import('../../src/formats/arch3dFile.js');
  const { dfMeshToModel } = await import('../../src/world/meshReader.js');
  const { patchSeams } = await import('../../src/world/arch3dSeams.js');
  const { installTownStandIns } = await import('../../src/world/townStandIns.js');
  const { customModelBuilt, customAliasFor } = await import('../../src/world/customModels.js');
  const { buildInteriorContext } = await import('../../src/scenes/interiorContext.js');
  const { buildingSummaries } = await import('../../src/world/buildingSummaries.js');
  const { isTavern } = await import('../../src/world/buildingNames.js');
  const { INTERIOR_MARKER } = await import('../../src/world/interior/interiorLayout.js');
  const { worldAabb } = await import('../../src/player/activate.js');
  const saved = [console.warn, console.log];
  console.warn = console.log = () => {};
  try {
    const arch = new Arch3dFile(); assert.ok(arch.load(new Uint8Array(readFileSync(join(ARENA2, 'ARCH3D.BSA')))));
    installTownStandIns(() => true);
    const size = () => ({ width: 64, height: 64 });   // a picture's size moves a UV, never a vertex
    const classicModel = (id) => { const i = arch.getRecordIndex(id); return i === -1 ? null : dfMeshToModel(arch.getMesh(i), size); };
    const cpuModels = new Map(), built = new Map();
    const getGpuMesh = async (id) => {
      if (built.has(id)) return built.get(id);
      let m = await customModelBuilt(id, { classicModel });
      if (!m) { const al = customAliasFor(id), mid = al ? al.model : id, i = arch.getRecordIndex(mid); m = i === -1 ? null : dfMeshToModel(patchSeams(mid, arch.getMesh(i)), size); }
      if (m) cpuModels.set(id, { modelIdNum: id, ...m, doors: m.doors ?? [] });
      built.set(id, m ? { id } : null);
      return built.get(id);
    };
    const noop = () => {};
    const renderer = { createBillboardBatch: () => ({}), destroyBatch: noop, createMesh: (m) => ({ m }), destroyMesh: noop, uploadTexture: noop };
    const deps = { renderer, getGpuMesh, cpuModels, getTexture: async (a) => (a === 210 ? null : { recordCount: 0 }), uploadRecord: noop, uploadRecordFrame: noop, palette: null, getMachineryParts: null };
    // the player's capsule from the room's entrance on a 10 cm grid, knees and head clear, on the entrance's storey
    const STEP = 0.1, N = 180, SIDE = 2 * N + 1;
    const flood = (collider, s) => {
      const ok = (x, z) => {
        const d = collider.raycast([x, s[1] + 1.9, z], [0, -1, 0], 2.5);
        if (!Number.isFinite(d) || Math.abs(1.9 - d) > 0.3) return false;
        const fy = s[1] + 1.9 - d;
        return !collider.sphereOverlaps([x, fy + 0.6, z], CAPSULE_RADIUS) && !collider.sphereOverlaps([x, fy + 1.5, z], CAPSULE_RADIUS);
      };
      const st = new Uint8Array(SIDE * SIDE);
      let first = -1;
      for (let r = 0; r <= 5 && first < 0; r++) for (let dk = -r; dk <= r && first < 0; dk++) for (let di = -r; di <= r && first < 0; di++) {
        if (Math.max(Math.abs(di), Math.abs(dk)) === r && ok(s[0] + di * STEP, s[2] + dk * STEP)) first = (N + dk) * SIDE + N + di;
      }
      if (first < 0) return st;
      st[first] = 1;
      const q = [first];
      for (let h = 0; h < q.length; h++) {
        const c = q[h], i = c % SIDE, k = (c - i) / SIDE;
        for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = i + di, nk = k + dk, nc = nk * SIDE + ni;
          if (ni < 0 || nk < 0 || ni >= SIDE || nk >= SIDE || st[nc]) continue;
          st[nc] = 2;
          if (ok(s[0] + (ni - N) * STEP, s[2] + (nk - N) * STEP)) { st[nc] = 1; q.push(nc); }
        }
      }
      return st;
    };
    const prop = cardTablePropModel().positions;
    /** Every tavern the towns lay with `mods`, by its layout (block and record - the walk reads the room alone): its
     *  tables, and the floor they cut off the player's capsule, in 10 cm cells. */
    const sweep = async (mods) => {
      const towns = await openTowns({ mods });
      const layouts = new Map();
      for (const { l, loc } of everyLocation(towns.maps)) {
        const ed = loc?.exterior?.exteriorData;
        if (!ed?.blockNames?.length) continue;
        const cells = ed.blockNames.map((nm, i) => ({ x: i % ed.width, y: Math.floor(i / ed.width), dfBlock: towns.blocks.getBlockByName(nm) }));
        if (cells.some((b) => !b.dfBlock)) continue;
        for (const s of buildingSummaries(loc.exterior.buildings, cells, { locationIndex: l })) {
          if (!isTavern(s.buildingType)) continue;
          const block = cells.find((b) => b.x === s.blockX && b.y === s.blockY).dfBlock;
          const key = `${block.name}#${s.recordIndex}`;
          if (!layouts.has(key)) layouts.set(key, { block, ri: s.recordIndex, names: [] });
          layouts.get(key).names.push(`${loc.name}/${s.name}`);
        }
      }
      const tablesBy = new Map(), cuts = [], count = [0, 0, 0];
      let taverns = 0;
      for (const [key, t] of layouts) {
        const bare = await buildInteriorContext(deps, t.block, t.block.index, t.ri, 300, 0, null, {});
        const laid = await buildInteriorContext(deps, t.block, t.block.index, t.ri, 300, 0, null, { placeCardTable: true });
        tablesBy.set(key, laid.tables);
        taverns += t.names.length;
        count[laid.tables.length] += t.names.length;
        const m = laid.markers.find((mk) => mk.type === INTERIOR_MARKER.ENTER) ?? laid.markers.find((mk) => mk.type === INTERIOR_MARKER.REST);
        if (m && laid.tables.length) {
          const s = [m.x, m.y, m.z], a = flood(bare.collider, s), b = flood(laid.collider, s);
          // the floor under a table's own prop, and a body's width round it, is the table's: anything else lost is cut off
          const boxes = laid.tables.map((tb) => worldAabb(prop, tb.matrix));
          let cut = 0;
          for (let c = 0; c < a.length; c++) {
            if (a[c] !== 1 || b[c] === 1) continue;
            const i = c % SIDE, k = (c - i) / SIDE, x = s[0] + (i - N) * STEP, z = s[2] + (k - N) * STEP, g = CAPSULE_RADIUS + STEP;
            if (!boxes.some((p) => x > p.min[0] - g && x < p.max[0] + g && z > p.min[2] - g && z < p.max[2] + g)) cut++;
          }
          if (cut) cuts.push([key, cut]);
        }
        bare.destroy(); laid.destroy();
      }
      return { layouts, tablesBy, cuts, count, taverns };
    };
    // a quarter of a square metre at most - a sliver between a stool and a wall behind the table (eight classic layouts
    // of one hall keep one of 22 cells); WALK-WHOLE's tables cut off up to 72 square metres (DARKAB00 #1: 7,228 of
    // 10,934 cells), and 82 layouts with the packs and 65 without lost more than a fifth of a square metre
    const sliver = ({ cuts }) => cuts.every(([, cut]) => cut <= 25) || cuts.filter(([, c]) => c > 25).map(([k, c]) => `${k} ${c}`).join(', ');
    const on = await sweep(true);
    assert.equal(sliver(on), true, 'with the packs: no floor cut off');
    assert.equal(on.layouts.size, 254, 'every tavern layout the towns lay');
    assert.equal(on.taverns, 18164);
    // the Discord's two: the Gold Dungeon's floor holds the table only in its corridor - it stands none; the Dancing
    // Castle's hall keeps its chips table where it stood, and the gold table that stood in its way east is gone
    const named = (n) => [...on.layouts.entries()].find(([, t]) => t.names.includes(n))?.[0];
    assert.equal(named('Menakat/The Gold Dungeon'), 'GENRGL00.RMB#7');
    assert.equal(named('Pilliweyn/The Dancing Castle'), 'GEMSAM01.RMB#1');
    assert.equal(on.tablesBy.get('GENRGL00.RMB#7').length, 0);
    const dancing = on.tablesBy.get('GEMSAM01.RMB#1');
    assert.equal(dancing.length, 1);
    assert.deepEqual(dancing[0].aabb.min.map((v) => Math.round(v * 100) / 100), [-3.95, 0.02, -7.05], 'the chips table where it stood');
    // how many tables the taverns stand now, by tavern: none where no floor is out of the way, one where the hall holds
    // one (WALK-WHOLE stood two in 15,246 and one in 2,891 - the 27 with none have no floor at all)
    assert.deepEqual(on.count, [1935, 2931, 13298]);
    const off = await sweep(false);
    assert.equal(sliver(off), true, 'without the packs: no floor cut off');
    assert.equal(off.layouts.size, 199);
    assert.equal(off.taverns, 18469);
    assert.deepEqual(off.count, [5165, 5749, 7555], 'Daggerfall\'s own taverns (WALK-WHOLE: none with none, 8,975 one, 9,494 two)');
  } finally { [console.warn, console.log] = saved; }
});
