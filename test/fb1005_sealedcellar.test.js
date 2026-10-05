// FIELD BUGS 2026-10-05 SEALED-CELLAR (Discord, TheBard: "Can't access builing basement to continue quest" - "In
// tigonus" - "Can't do quest at all. Supposed to be stairs down"; a screenshot of a wooden stair rail standing over a
// rug with a red centre, The Possessed Child in the tracker).
//
// The Possessed Child (C0B00Y02) places its child at a `local house2`; a person takes the house's 199.11. Beautiful
// Cities lays Tigonus (Dak'fron, location 54) again, and in its GEMSAL00 #7 the house's one 199.11 stands 3.15 m down in a
// cellar whose stair (40018, its rail 6700 and posts 62319) the author shut with a floor tile laid over its head (1000,
// with its ceiling 2000 under it) and two rugs on top - and marked with the editor's 199.14 over the plug and 199.13 at
// the stair's foot, which no game reads. DFU lays the plug as the port does; the child stood where no player walks, on
// a sound floor, so QUEST-MARKERS' ray passed it. Fourteen designs of the packs (128 buildings) hold a quest marker past
// such a hatch; the curation stands each by the hatch's near side now (tools/townQuestMarkers.mjs SEALED-CELLAR,
// systems/quest/markerCuration.js). The pack's own records are read here with no game data, as fb1004d_questmarkers
// reads them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CURATED_QUEST_MARKERS, curatedMarkerSpot } from '../src/systems/quest/markerCuration.js';
import { registerWorldDataAsset, _resetWorldDataReplacement, installWorldDataReplacement } from '../src/formats/worldDataReplacement.js';
import { ROW_CODECS } from '../src/formats/worldDataPack.js';
import { patchJson } from '../src/formats/worldDataJson.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { hatchesOf, HATCH, HATCH_DOOR_CLEAR_M, walkFloor } from '../tools/townQuestMarkers.mjs';
import { rmbBlock, SPAWN } from './fb1004dTowns.mjs';
import { SKIP, BC, packJson, openTowns } from './fb1004dArena.mjs';

/** A pack value expanded as the door's reader expands it (fb1004d_questmarkers.test.js's packValue; a `$c` - the
 *  player's own BLOCKS.BSA - stays a marker, no game data is here). */
function packValue(P, v) {
  if (Array.isArray(v)) return v.map((x) => (x !== null && typeof x === 'object' ? packValue(P, x) : x));
  if (v === null || typeof v !== 'object') return v;
  const k = Object.keys(v).find((key) => key.startsWith('$') && key !== '$o');
  if (!k) return Object.fromEntries(Object.entries(v).map(([key, x]) => [key, x !== null && typeof x === 'object' ? packValue(P, x) : x]));
  if (k === '$c') return '$classic';
  let node;
  if (k === '$n') { const n = P.nodes[v.$n]; node = packValue(P, typeof n === 'string' ? JSON.parse(n) : n); }
  else if (k === '$r') { node = []; for (let i = 0; i < v.$r.length; i += 2) for (let n = 0; n < v.$r[i + 1]; n++) node.push(v.$r[i]); }
  else node = v[k].map((row) => (Array.isArray(row) || typeof row === 'number' ? ROW_CODECS[k](row) : packValue(P, row)));
  return v.$o ? patchJson(node, v.$o.map((op) => (op[0] === 's' || op[0] === 'i' ? [op[0], op[1], packValue(P, op[2])] : op))) : node;
}
const subRecordsOf = (P, file) => {
  const e = typeof P.files[file] === 'string' ? JSON.parse(P.files[file]) : P.files[file];
  return packValue(P, e[2].find((o) => o[0] === 's' && o[1].join('.') === 'RmbBlock.SubRecords')[2]);
};
const AT = [4, 126, 256];   // the child's marker, in GEMSAL00 #7's own units (y down: 3.15 m under the ground floor)

test('SEALED-CELLAR: the report\'s house - Beautiful Cities\' GEMSAL00 #7 shuts its cellar stair with a floor tile and marks the hatch 199.14 / 199.13, and its one person marker stands in the cellar', () => {
  const sub = subRecordsOf(packJson(BC), 'GEMSAL00.RMB.json')[7];
  const models = sub.Interior.Block3dObjectRecords, flats = sub.Interior.BlockFlatObjectRecords;
  const stair = models.find((m) => m.ModelIdNum === 40018), plug = models.find((m) => m.ModelIdNum === 1000);
  assert.ok(stair && plug, 'the stair and the floor tile');
  assert.ok(Math.abs(plug.XPos - stair.XPos) <= 1 && Math.abs(plug.ZPos - stair.ZPos) <= 1, 'the tile laid over the stair\'s head');
  const marks = (r) => flats.filter((f) => f.TextureArchive === 199 && f.TextureRecord === r);
  assert.equal(marks(14).length, 1, 'the hatch\'s near side');
  assert.equal(marks(13).length, 1, 'its far side');
  assert.deepEqual(marks(SPAWN).map((f) => [f.XPos, f.YPos, f.ZPos]), [AT], 'the house\'s one person marker, in the cellar');
  assert.ok(marks(13)[0].YPos > 100 && marks(14)[0].YPos < 10, 'the far side down at the cellar\'s floor, the near over the plug');
});

test('SEALED-CELLAR: the curation stands the child by the shut stair - GEMSAL00 #7 and #8 in the design\'s list, the marker moved only in the pack\'s own block', () => {
  const d = CURATED_QUEST_MARKERS.find((x) => x.where.some(([v, b, r]) => v === BC && b === 'GEMSAL00.RMB' && r === 7));
  assert.ok(d, 'listed');
  assert.ok(d.where.some(([v, b, r]) => v === BC && b === 'GEMSAL00.RMB' && r === 8), 'its twin too');
  assert.equal(d.buildingType, BUILDING_TYPES.House2, 'the quest\'s house2');
  const m = d.markers.find((x) => x.record === SPAWN && x.at.join() === AT.join());
  assert.ok(m, 'the child\'s marker');
  assert.equal(m.to[1], 0, 'on the ground floor');
  _resetWorldDataReplacement(); installWorldDataReplacement();
  try {
    const served = rmbBlock('GEMSAL00.RMB', Array.from({ length: 9 }, () => ({ type: BUILDING_TYPES.House2 })), { fromWorldData: true });
    registerWorldDataAsset('GEMSAL00.RMB.json', {}, null, { vendor: BC });
    assert.deepEqual(curatedMarkerSpot(served, 7, SPAWN, ...AT), m.to, 'served by the pack: stood by the hatch');
    assert.equal(curatedMarkerSpot(rmbBlock('GEMSAL00.RMB', [{ type: BUILDING_TYPES.House2 }]), 7, SPAWN, ...AT), null, 'Daggerfall\'s own GEMSAL00: as it is');
  } finally { _resetWorldDataReplacement(); }
});

test('SEALED-CELLAR: a hatch is a 199.14 or 199.13 the entrance\'s walk reaches, its partner the nearest marker of the other number, the walk not reaching it - down to a cellar or up to a loft', () => {
  assert.deepEqual([...HATCH], [14, 13]);
  const walk = { sees: (p) => p.y > -1 && p.y < 2 };   // the ground floor
  const cellar = [{ type: 14, x: 0, y: 0, z: 0 }, { type: 13, x: 1, y: -3, z: 0 }, { type: 13, x: 30, y: -3, z: 0 }];
  assert.deepEqual(hatchesOf(cellar, walk), [{ near: cellar[0], far: cellar[1] }], 'down: the nearest far side');
  const loft = [{ type: 13, x: 0, y: 0, z: 0 }, { type: 14, x: 0, y: 3.2, z: 1 }];
  assert.deepEqual(hatchesOf(loft, walk), [{ near: loft[0], far: loft[1] }], 'up: the numbers either way round');
  assert.deepEqual(hatchesOf([{ type: 14, x: 0, y: 0, z: 0 }, { type: 13, x: 1, y: 0.5, z: 0 }], walk), [], 'both sides walked to: no hatch');
  assert.deepEqual(hatchesOf([{ type: 14, x: 0, y: -3, z: 0 }, { type: 13, x: 1, y: -6, z: 0 }], walk), [], 'neither side reached: no hatch of the player\'s');
  assert.deepEqual(hatchesOf([{ type: 14, x: 0, y: 0, z: 0 }, { type: 8, x: 1, y: -3, z: 0 }], walk), [], 'no partner');
});

test('SEALED-CELLAR, gated on ARENA2_PATH: Tigonus as Beautiful Cities lays it - every quest marker of its houses past a hatch is curated where it stands, GEMSAL00 #7 among them', { skip: SKIP }, async () => {
  const say = console.log; console.log = () => {};
  let t;
  try { t = await openTowns({ mods: true }); } finally { console.log = say; }
  const sealed = new Map();   // `${block}#${record}` -> design
  for (const d of CURATED_QUEST_MARKERS) for (const [v, b, r] of d.where) if (v === BC) sealed.set(`${b}#${r}`, d);
  const tigonus = t.maps.getLocation(48, 54);
  assert.equal(tigonus.name, 'Tigonus');
  const ext = tigonus.exterior.exteriorData, found = [];
  for (let i = 0; i < ext.blockNames.length; i++) {
    const name = ext.blockNames[i];
    t.maps.getRmbBlockName(tigonus, i % ext.width, Math.floor(i / ext.width));
    const dfBlock = t.blocks.getBlockByName(name);
    if (!dfBlock?.fromWorldData) continue;
    for (let r = 0; r < dfBlock.rmbBlock.subRecords.length; r++) {
      const d = sealed.get(`${name}#${r}`);
      if (!d || dfBlock.rmbBlock.fldHeader.buildingDataList[r]?.buildingType !== d.buildingType) continue;
      for (const m of d.markers) assert.deepEqual(curatedMarkerSpot(dfBlock, r, m.record, ...m.at), m.to, `${name} #${r}`);
      found.push(`${name}#${r}`);
    }
  }
  assert.ok(found.includes('GEMSAL00.RMB#7'), 'the report\'s house');
  assert.equal(found.length, 21, 'Tigonus\'s listed houses (some blocks stand twice): the grid\'s 21, past a hatch or lost in geometry');
});

test('SEALED-CELLAR: no curated spot stands at a room\'s entrance - every moved marker of every listed building is HATCH_DOOR_CLEAR_M or more from its enter and rest markers (AUDIT FB1005 S1: TEMPASF0 #7\'s foe stood 0.95 m from the door the player comes in by)', () => {
  const PACKS = { [BC]: packJson(BC), 'beautiful-villages': packJson('beautiful-villages') };
  const UNIT = 0.025;
  let checked = 0;
  for (const d of CURATED_QUEST_MARKERS) {
    for (const [vendor, block, record] of d.where) {
      const sub = subRecordsOf(PACKS[vendor], `${block}.json`)[record];
      const entries = sub.Interior.BlockFlatObjectRecords.filter((f) => f.TextureArchive === 199 && (f.TextureRecord === 8 || f.TextureRecord === 4));
      for (const m of d.markers) {
        for (const e of entries) {
          const dxz = Math.hypot(m.to[0] - e.XPos, m.to[2] - e.ZPos) * UNIT;
          assert.ok(dxz >= HATCH_DOOR_CLEAR_M || Math.abs(m.to[1] - e.YPos) * UNIT > 2, `${block} #${record}: 199.${m.record}'s spot ${m.to} is ${dxz.toFixed(2)} m from the entrance at ${[e.XPos, e.YPos, e.ZPos]}`);
        }
        checked++;
      }
    }
  }
  assert.equal(checked, 181, 'every listed building\'s markers (179 buildings, the two libraries two each)');
});

test('SEALED-CELLAR: the walk\'s clear spot takes a test - the nearest cell that passes it, the nearest at all without one (AUDIT FB1005 S5)', () => {
  // a flat floor, 6 m by 6 m, two triangles facing up
  const q = [[0, 0, 0], [6, 0, 0], [6, 0, 6], [0, 0, 6]];
  const tri = (a, b, c) => [...a, ...b, ...c, 0, 1, 0];
  const tris = Float64Array.from([...tri(q[0], q[2], q[1]), ...tri(q[0], q[3], q[2])]);
  const walk = walkFloor(tris, [{ x: 3, y: 0, z: 3 }]);
  const p = { x: 3, y: 0, z: 3 };
  const near = walk.clearSpot(p);
  assert.ok(near && Math.hypot(near.x - 3, near.z - 3) < 0.01, 'the nearest: under the point');
  const far = walk.clearSpot(p, (c) => Math.hypot(c.x - 3, c.z - 3) >= 1.5);
  assert.ok(far && Math.abs(Math.hypot(far.x - 3, far.z - 3) - 1.5) < 0.26, `the nearest that passes: ${JSON.stringify(far)}`);
  assert.equal(walk.clearSpot(p, () => false), null, 'none passes: none');
});

test('SEALED-CELLAR: every marker moved past a hatch stands BY it - within 2.5 m of one of its design\'s 199.14 / 199.13, read off the vendored pack (AUDIT FB1005 T6: the spots were pinned only on ARENA2_PATH)', () => {
  const PACKS = { [BC]: packJson(BC), 'beautiful-villages': packJson('beautiful-villages') };
  const UNIT = 0.025;
  let designs = 0;
  for (const d of CURATED_QUEST_MARKERS) {
    const [vendor, block, record] = d.where[0];
    const hatch = subRecordsOf(PACKS[vendor], `${block}.json`)[record].Interior.BlockFlatObjectRecords.filter((f) => f.TextureArchive === 199 && (f.TextureRecord === 13 || f.TextureRecord === 14));
    if (!hatch.length) continue;   // QUEST-MARKERS' own six: lost in geometry, no hatch
    designs++;
    for (const m of d.markers) {
      const near = Math.min(...hatch.map((f) => Math.hypot(m.to[0] - f.XPos, m.to[2] - f.ZPos) * UNIT));
      assert.ok(near <= 2.5, `${d.design}: 199.${m.record}'s spot ${m.to} is ${near.toFixed(2)} m from its hatch`);
    }
  }
  assert.equal(designs, 14, 'the fourteen sealed designs');
});
