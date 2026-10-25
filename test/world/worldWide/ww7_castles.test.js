// WW7-4 (2026-10-25, the owner: "The tower in the middle needs an interior, ensure all castles have interiors";
// bible/03-World/World-Wide.md WW7-4): every capital's castle its halls - a Bay palace's blocks under the port's own
// names, the Bay's court stood down - entered by its palace's door; a province's castle a guild's to buy, the White-Gold
// Tower's open to all and never one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { BAY_CASTLE_HALLS, CAPITAL_CASTLE_HALLS, CASTLE_BLOCKS, CASTLE_BLOCK_INDEX, CASTLE_DUNGEON_TYPE, capitalCastleBlocks, capitalCastleDungeon, castleBlockName, castleKeeps, castleBlockOf } from '../../../src/world/capitalCastles.js';
import { CAPITALS, CAPITAL_MODELS, capitalPlaceId, synthesizeCapitalLocation, capitalSpan, capitalPortBlocks } from '../../../src/world/tamrielCapitals.js';
import { IMPERIAL_MODELS } from '../../../src/world/imperialCity.js';
import { buildImperialTower } from '../../../src/world/capitalImperial.js';
import { buildBluePalace } from '../../../src/world/capitalSolitude.js';
import { buildMournholdPalace } from '../../../src/world/capitalMournhold.js';
import { buildAlinorPalace } from '../../../src/world/capitalAlinor.js';
import { buildGrahtOak, trunkRadius } from '../../../src/world/capitalFalinesti.js';
import { buildManePalace } from '../../../src/world/capitalTorval.js';
import { buildXanmeer } from '../../../src/world/capitalHelstrom.js';
import { northward } from '../../../src/world/capitalModels.js';
import { CAPITAL_ART } from '../../../src/world/capitalShapes.js';
import { DOOR_TYPE } from '../../../src/world/meshReader.js';
import { RDB_RESOURCE_TYPES, BlocksFile } from '../../../src/formats/blocksFile.js';
import { registerPortBlockOf, getDFBlockReplacementData, getNewDFBlockIndex, bindWorldDataBlocks, _resetWorldDataReplacement, installWorldDataReplacement } from '../../../src/formats/worldData/worldDataReplacement.js';
import { CASTLE_MAP_IDS, BAY_CASTLE_MAP_IDS, PROVINCE_CASTLE_MAP_IDS, instanceRoomOf, instanceGuildOwnerOf, instanceAdmission } from '../../../src/net/instanceRoom.js';
import { castleKeyOk, castleOffers } from '../../../src/net/castleLaw.js';
import { dungeonSizeFor } from '../../../src/world/smallerDungeons.js';
import { layoutDungeon } from '../../../src/world/dungeon/dungeonLayout.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const SIDES = [[0, -1], [-1, 0], [1, 0], [0, 1]];

test('WW7-4 every capital\'s castle: its Bay palace\'s halls where the Bay lays them under the port\'s names, the first the start, every open side closed by a border block, its own dungeon id (mutants: a side left open; a hall under the Bay\'s name; the start moved)', () => {
  assert.equal(CAPITAL_CASTLE_HALLS.length, CAPITALS.length, 'every capital a castle');
  assert.deepEqual(CASTLE_BLOCKS.map((b) => [b.name, b.from, b.index - CASTLE_BLOCK_INDEX]), [['SC000160.RDB', 'S0000160.RDB', 0], ['SC000040.RDB', 'S0000040.RDB', 1], ['SC000041.RDB', 'S0000041.RDB', 2], ['SC000080.RDB', 'S0000080.RDB', 3], ['SC000081.RDB', 'S0000081.RDB', 4]]);
  assert.ok(CASTLE_BLOCK_INDEX > Math.max(...capitalPortBlocks({ footprint: () => () => false }).map((b) => b.index)), 'past every capital\'s own port block');
  for (let k = 0; k < CAPITALS.length; k++) {
    const blocks = capitalCastleBlocks(k), src = BAY_CASTLE_HALLS[CAPITAL_CASTLE_HALLS[k]];
    const halls = blocks.filter((b) => !/^B/.test(b.blockName)), at = new Map(blocks.map((b) => [`${b.x},${b.z}`, b]));
    assert.equal(at.size, blocks.length, `${CAPITALS[k].key}: no two blocks one place`);
    assert.deepEqual(halls.map((b) => [b.blockName, b.x, b.z]), src.halls.map(([n, x, z]) => [castleBlockName(n), x, z]));
    assert.deepEqual(blocks.filter((b) => b.isStartingBlock), [halls[0]]);
    for (const h of halls) for (const [dx, dz] of SIDES) assert.ok(at.has(`${h.x + dx},${h.z + dz}`), `${CAPITALS[k].key}: ${h.blockName}'s side ${dx},${dz} closed`);
    assert.ok(blocks.filter((b) => /^B/.test(b.blockName)).every((b) => src.borders.includes(b.blockName)));
    assert.deepEqual(capitalCastleDungeon(k, 77), { header: { blockCount: blocks.length }, recordElement: { header: { locationId: 77 } }, blocks });
  }
  assert.equal(capitalCastleBlocks(1).length, 8, 'Sentinel\'s two halls, six borders');
  assert.equal(capitalCastleBlocks(3).length, 5, 'Daggerfall\'s throne hall, four borders');
  assert.equal(capitalCastleBlocks(CAPITALS.length), null);
});

test('WW7-4 the court stood down: a person\'s flat goes but the castle\'s bards, prostitutes and children and a flat no faction claims; the quest markers go; the guards (199 markers), models, lights and the castle\'s things stay; an object an action chain names stays whatever it is; the copy under its port name and index, the Bay\'s block untouched (mutants: the royals kept; the guards taken; a chain broken)', () => {
  const flat = (archive, record, faction = 0, position = 0, next = 0) => ({ type: RDB_RESOURCE_TYPES.Flat, position, resources: { flatResource: { textureArchive: archive, textureRecord: record, factionOrMobileId: faction, nextObjectOffset: next } } });
  const model = (position, next = 0) => ({ type: RDB_RESOURCE_TYPES.Model, position, resources: { modelResource: { actionResource: { nextObjectOffset: next, previousObjectOffset: 0 } } } });
  const objects = [model(1, 90), flat(334, 19, 364, 2), flat(334, 11, 511, 3), flat(184, 15, 514, 4), flat(357, 0, 501, 5), flat(346, 20, 0, 6), flat(184, 1, 385, 7),
    flat(199, 16, 1425, 8), flat(199, 10, 1, 9), flat(199, 11, 0, 10), flat(199, 18, 70, 11), flat(210, 16, 0, 12), flat(334, 5, 500, 90), { type: RDB_RESOURCE_TYPES.Light, position: 13, resources: {} }];
  const kept = objects.filter((o) => castleKeeps(o)).map((o) => o.position);
  assert.deepEqual(kept, [1, 3, 4, 6, 8, 9, 12, 13], 'no Gothryd, no Lady Northbridge, no Charvek-si, no quest; the bard, the child, a nameless one, the guard, the start, a lamp');
  const bay = { name: 'S0000160.RDB', index: 4, position: 512, type: 1, rdbBlock: { modelReferenceList: [], objectRootList: [{ rdbObjects: objects }, { rdbObjects: null }] } };
  const snap = JSON.stringify(bay);
  const copy = castleBlockOf(bay, { name: 'SC000160.RDB', index: 900700 });
  assert.equal(JSON.stringify(bay), snap, 'the Bay\'s block untouched');
  assert.deepEqual([copy.name, copy.servedName, copy.index, copy.position], ['SC000160.RDB', 'SC000160.RDB', 900700, 512]);
  assert.deepEqual(copy.rdbBlock.objectRootList[0].rdbObjects.map((o) => o.position), [1, 3, 4, 6, 8, 9, 12, 90, 13], 'the flat at 90 a chain names stays');
  assert.equal(copy.rdbBlock.objectRootList[1].rdbObjects, null);
  assert.equal(castleBlockOf({ rdbBlock: null }, { name: 'x', index: 1 }), null);
});

test('WW7-4 the port\'s block made of another: registered at its own index, made once when first read with the bound BlocksFile (mutants: made unbound; made each read)', () => {
  _resetWorldDataReplacement();
  installWorldDataReplacement();
  const bound = { tag: 'blocks' };
  bindWorldDataBlocks(bound);
  let made = 0;
  assert.equal(registerPortBlockOf('SCTEST.RDB', (bf) => ({ made: ++made, bf }), 900799), true);
  assert.equal(registerPortBlockOf('SCBAD.RDB', null, 900798), false);
  assert.equal(getNewDFBlockIndex('SCTEST.RDB'), 900799);
  const a = getDFBlockReplacementData(900799, 'SCTEST.RDB'), b = getDFBlockReplacementData(900799, 'SCTEST.RDB');
  assert.equal(a, b);
  assert.deepEqual([a.made, a.bf], [1, bound]);
  _resetWorldDataReplacement();
});

test('WW7-4 the castle is the capital\'s centre\'s dungeon: its blocks, its map id its dungeon\'s id, a crown castle\'s type; no other slice one; never shrunk online (mutants: every slice a castle; the castle shrunk)', () => {
  // tesa10_capitals.test.js's fixture: a town row, every plan's classic kinds two blocks each, each block one named house
  const base = { name: 'Base', regionIndex: 1, mapTableData: { mapId: 5, locationType: 0, dungeonType: 0 }, exterior: { exteriorData: { blockNames: ['X'], width: 1, height: 1 }, buildings: [] }, climate: { worldClimate: 230 }, hasDungeon: false, dungeon: null };
  const kinds = [...new Set(CAPITALS.flatMap((cap) => cap.plan.flat().filter((c) => c !== 'L' && c !== 'G' && !Object.hasOwn(cap.blocks, c))))];
  const names = new Map(kinds.map((c) => [c, [`${c}AA00.RMB`, `${c}AA01.RMB`]]));
  const fh = { rmbBlock: { fldHeader: { numBlockDataRecords: 1, buildingDataList: [{ buildingType: 9, factionId: 0, quality: 5 }] } } };
  const ctx = (px) => ({ base, names, blockOf: (nm) => (nm.startsWith('TES') ? null : fh), px, py: 50 });
  for (let k = 1; k < CAPITALS.length; k++) {
    const loc = synthesizeCapitalLocation({ cap: CAPITALS[k], k }, ctx(100 + k));
    assert.ok(loc, CAPITALS[k].key);
    const id = capitalPlaceId(k);
    assert.deepEqual([loc.hasDungeon, loc.dungeon, loc.mapTableData.dungeonType], [true, capitalCastleDungeon(k, id), CASTLE_DUNGEON_TYPE], CAPITALS[k].key);
    assert.equal(dungeonSizeFor(loc, { online: true }), 'full');
  }
  const ic = CAPITALS[0], n = capitalSpan(ic);
  const centre = synthesizeCapitalLocation({ cap: ic, k: 0 }, ctx(171)), corner = synthesizeCapitalLocation({ cap: ic, k: 0, s: 0 }, ctx(170));
  assert.deepEqual([centre.hasDungeon, centre.dungeon.recordElement.header.locationId], [true, capitalPlaceId(0)], 'the White-Gold Tower\'s halls');
  assert.deepEqual([corner.hasDungeon, corner.dungeon, n > 1], [false, null, true], 'a slice no castle');
  assert.equal(dungeonSizeFor({ hasDungeon: true, mapTableData: { mapId: 9 }, dungeon: { blocks: [] } }, { online: true, world: true }) === 'full', false, 'a plain dungeon still the world\'s size');
});

test('WW7-4 every castle\'s door: one dungeon entrance on its palace\'s dark door - the White-Gold Tower\'s east, the Blue Palace\'s, Mournhold\'s to the plaza, Alinor\'s on its top, the Graht-Oak\'s porch, the Mane\'s, the Xanmeer\'s shrine - its normal out, turned north with the model (mutants: no door; the door\'s z left map-wise)', () => {
  const builds = [[IMPERIAL_MODELS.whiteGoldTower, buildImperialTower], [CAPITAL_MODELS.bluePalace, buildBluePalace], [CAPITAL_MODELS.mournholdPalace, buildMournholdPalace], [CAPITAL_MODELS.alinorPalace, buildAlinorPalace],
    [CAPITAL_MODELS.grahtOak, buildGrahtOak], [CAPITAL_MODELS.manePalace, buildManePalace], [CAPITAL_MODELS.xanmeer, buildXanmeer]];
  builds.forEach(([id, build], k) => {
    assert.ok(CAPITALS[k].models.includes(id), `${CAPITALS[k].key} stands the model`);
    const m = build();
    assert.equal(m.doors.length, 1, CAPITALS[k].key);
    const [d] = m.doors, c = { x: (d.vert0.x + d.vert2.x) / 2, y: (d.vert0.y + d.vert2.y) / 2, z: (d.vert0.z + d.vert2.z) / 2 };
    assert.equal(d.type, DOOR_TYPE.DUNGEON_ENTRANCE);
    assert.ok(Math.abs(Math.hypot(d.normal.x, d.normal.y, d.normal.z) - 1) < 1e-9 && d.normal.y === 0, 'out, level');
    // the dark face it stands on: a dark quad's corners the door's own
    const dark = m.subMeshes.find((s) => s.textureRecord === CAPITAL_ART.dark), corners = [];
    for (let i = dark.startIndex; i < dark.startIndex + dark.primitiveCount * 3; i++) { const v = m.indices[i] * 3; corners.push([m.positions[v], m.positions[v + 1], m.positions[v + 2]]); }
    const near = (p) => corners.some((q) => Math.hypot(q[0] - p.x, q[1] - p.y, q[2] - p.z) < 1e-3);
    assert.ok(near(d.vert0) && near(d.vert1) && near(d.vert2), `${CAPITALS[k].key}: the door on a dark door's face`);
    const turned = northward(m).doors[0];
    assert.deepEqual([turned.vert0.z, turned.vert2.z, turned.normal.z, turned.vert0.x], [-d.vert0.z, -d.vert2.z, -d.normal.z, d.vert0.x]);
    assert.ok(Number.isFinite(c.x + c.y + c.z));
  });
  const oak = buildGrahtOak().doors[0];
  assert.ok(-oak.vert0.z > trunkRadius(0) + 2.5, 'the porch\'s door clear of the roughest bark');
});

test('WW7-4 the castle keys: each province\'s capital\'s centre a castle the relay admits a guild to - never the Imperial City\'s (Domains.md section 6); offered to its Charter\'s holder; the guild\'s instance of it admits its members (mutants: the Imperial City a castle; a province\'s none)', async () => {
  assert.deepEqual(BAY_CASTLE_MAP_IDS, [6634853, 630439035, 1291010263]);
  assert.deepEqual(PROVINCE_CASTLE_MAP_IDS, [1, 2, 3, 4, 5, 6].map((k) => capitalPlaceId(k)));
  assert.deepEqual(CASTLE_MAP_IDS, [...BAY_CASTLE_MAP_IDS, ...PROVINCE_CASTLE_MAP_IDS]);
  assert.equal(castleKeyOk(capitalPlaceId(0)), false, 'the White-Gold Tower no guild\'s');
  assert.ok(PROVINCE_CASTLE_MAP_IDS.every(castleKeyOk));
  assert.deepEqual(castleOffers([{ key: capitalPlaceId(1), region: 64, tier: 'crown' }, { key: capitalPlaceId(0), region: 70, tier: 'crown' }, { key: capitalPlaceId(6), region: 69, tier: 'crown' }], [69]),
    [{ region: 64, key: capitalPlaceId(1) }]);
  const G = 'gabcdefghij';
  const key = instanceRoomOf(`dungeon:m${capitalPlaceId(1)}`, { owner: await instanceGuildOwnerOf(G), epoch: '89abcdef' });
  assert.equal(await instanceAdmission(key, 'acct-ofelia', { guild: G }), 'guild');
  const tower = instanceRoomOf(`dungeon:m${capitalPlaceId(0)}`, { owner: await instanceGuildOwnerOf(G), epoch: '89abcdef' });
  assert.equal(await instanceAdmission(tower, 'acct-ofelia', { guild: G }), null);
});

test('WW7-4 the open zone: a capital\'s castle is no ruin - the White-Gold Tower\'s door opens inside the zone (mutant: the tower sealed)', () => {
  assert.match(rd('src/scenes/world.js'), /if \(\(!wildInside\(mask, p\.x, p\.y\) && !seaVentures\.vaultHere\(\)\) \|\| hit\?\.dfLocation\?\.capital\) return true;/);
});

test('WW7-4 on the freeware: every capital\'s castle lays - its halls the port\'s copies (a castle block, its start marker), no court person left, its borders the Bay\'s (real data)', { skip: skipReal }, () => {
  _resetWorldDataReplacement();
  installWorldDataReplacement();
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  bindWorldDataBlocks(blocks);
  for (const c of CASTLE_BLOCKS) registerPortBlockOf(c.name, (bf) => castleBlockOf(bf?.getBlockByName(c.from), c), c.index);
  const court = new Set([334, 346, 357]);
  for (let k = 0; k < CAPITALS.length; k++) {
    const id = capitalPlaceId(k);
    const d = layoutDungeon({ name: CAPITALS[k].name, hasDungeon: true, dungeon: capitalCastleDungeon(k, id), mapTableData: { mapId: id }, climate: { worldClimate: 230 } }, blocks, () => ({ positions: new Float32Array(0), indices: new Uint32Array(0), subMeshes: [], doors: [] }));
    assert.ok(d.startMarker, `${CAPITALS[k].key}: its start`);
    assert.ok(d.blocks[0].layout.castleBlock, `${CAPITALS[k].key}: a castle's halls`);
    for (const b of d.blocks.filter((x) => /^SC/.test(x.name))) {
      for (const g of b.dfBlock.rdbBlock.objectRootList) for (const o of g.rdbObjects ?? []) {
        const f = o.type === RDB_RESOURCE_TYPES.Flat ? o.resources.flatResource : null;
        if (!f) continue;
        assert.ok(!(court.has(f.textureArchive) && ![0, 511, 512, 514].includes(f.factionOrMobileId)), `${b.name}: ${f.textureArchive}.${f.textureRecord}:${f.factionOrMobileId} stood down`);
        assert.ok(!(f.textureArchive === 199 && (f.textureRecord === 11 || f.textureRecord === 18)), `${b.name}: no quest marker`);
      }
    }
  }
  _resetWorldDataReplacement();
});
