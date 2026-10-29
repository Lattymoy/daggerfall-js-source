// THE SHIP REFIT (src/world/shipRefit.js): the two ships a player can own, furnished by the port over Daggerfall's own
// shells. Held here: a piece's record exactly as the interior builder reads it (its units, its turn, a flat's centre, a
// lamp under its ceiling, a deck model's origin over its foot); the building file - the classic record first and
// whole, the pieces after, the headers counted - and the door it is served from; the loader's wiring; no switch and no
// vendor (the same ships for every player, no part of a town's layout); and, with ARENA2_PATH, every piece held to the
// shells it furnishes (tools/shipRefitCheck.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHIP_REFIT, REFIT_FLAT_PX, REFIT_MODEL_FOOT, refitRecords, refitDeckRecords, shipRefitJson, installShipRefit } from '../../src/world/shipRefit.js';
import { getBuildingReplacementData, bindWorldDataBlocks, installWorldDataReplacement, _resetWorldDataReplacement, worldDataVendorCarries } from '../../src/formats/worldData/worldDataReplacement.js';
import { MOD_SETTINGS } from '../../src/systems/modSettings.js';
import { ONLINE_ROOM_MOD_KEYS, ONLINE_PLAYERS_OWN_MODS } from '../../src/systems/online/onlineLane.js';
import { isHouseContainerModel } from '../../src/systems/containers.js';
import { checkShipRefit } from '../../tools/shipRefitCheck.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['BLOCKS.BSA', 'ARCH3D.BSA'].every((f) => existsSync(join(ARENA2, f)));

/** A classic ship record as BlocksFile reads it: the shell and the two crates of the small ship's cabin. */
function fakeShipBlock(name) {
  const model = (id, x, y, z, type) => ({ modelId: String(id), modelIdNum: id, objectType: type, xPos: x, yPos: y, zPos: z, xRotation: 0, yRotation: 0, zRotation: 0 });
  const half = (models) => ({
    header: { num3dObjectRecords: models.length, numFlatObjectRecords: 0, numSection3Records: 0, numPeopleRecords: 0, numDoorRecords: 0 },
    block3dObjectRecords: models, blockFlatObjectRecords: [], blockSection3Records: [], blockPeopleRecords: [], blockDoorRecords: [],
  });
  return {
    position: 0, index: 0, name, type: 1,
    rmbBlock: {
      fldHeader: { buildingDataList: [{ nameSeed: 0, factionId: 0, sector: 0, locationId: 0, buildingType: 24, quality: 10 }] },
      subRecords: [{ xPos: 2496, zPos: 2624, yRotation: 0, exterior: half([model(910, 49, 48, -64, 4)]), interior: half([model(41508, -34, -141, -63, 13), model(41817, -312, 10, -208, 3)]) }],
    },
  };
}
const fakeBlocks = (names = { 390: 'SHIPAA00.RMB', 630: 'SHIPAA01.RMB' }) => ({
  getBlockName: (i) => names[i] ?? null,
  readClassicBlock: (i) => (names[i] ? fakeShipBlock(names[i]) : null),
});

test('SHIP REFIT a piece\'s record: classic units, the prop\'s foot on the floor, its turn as YRotation, a flat by its centre, a lamp under its ceiling (mutants: SHIP-REFIT-*)', () => {
  const { models, flats } = refitRecords({
    floor: 3.6,
    models: [{ id: 41000, x: -17.65, z: 2.4, face: 0, lift: 0 }, { id: 41003, x: -13.3, z: 2.4, face: -90, lift: 0 }, { id: 41818, x: 9.5, z: 1.85, face: 0, lift: 0.78 }],
    flats: [{ archive: 205, record: 0, x: 5.55, z: 3.55, on: 0 }, { archive: 210, record: 3, x: 2.6, z: 2.4, on: 0.82 }, { archive: 210, record: 27, x: -8, z: 2.5, hang: 6.8 }],
  });
  assert.deepEqual(models[0], { ModelId: '41000', ModelIdNum: 41000, ObjectType: 3, XPos: -706, YPos: 144, ZPos: 96, XRotation: 0, YRotation: 0, ZRotation: 0 });
  assert.equal(models[1].YRotation, 512, 'facing -x: interiorLayout turns it by -YRotation / ROTATION_DIVISOR = -90 degrees');
  assert.equal(models[2].YPos, 175, 'stacked 0.78 m up: (3.6 + 0.78) / 0.025');
  // a barrel 37 px high stands with its centre half its height over the floor; YPos is the flip of y
  assert.deepEqual([flats[0].XPos, flats[0].YPos, flats[0].ZPos, flats[0].TextureArchive, flats[0].TextureRecord], [222, -162, 142, 205, 0]);
  assert.equal(flats[1].YPos, -182, 'a half-size candle on a table 0.82 m high: -(3.6 + 0.82 + 0.119) / 0.025');
  assert.equal(flats[2].YPos, -253, 'a 0.95 m lantern under a 6.8 m ceiling: -(6.8 - 0.475) / 0.025');
  assert.throws(() => refitRecords({ floor: 0, models: [], flats: [{ archive: 205, record: 44, x: 0, z: 0, on: 0 }] }), /no size for flat 205_44/);
});

test('SHIP REFIT a deck model\'s record: its origin stood over its foot (rmbLayout reads -YPos as the origin), every deck model\'s foot known', () => {
  const [r] = refitDeckRecords({ floor: 5.8, models: [{ id: 41822, x: -9.5, z: 3.4, face: 0, lift: 0 }] });
  assert.deepEqual([r.XPos, r.YPos, r.ZPos], [-380, -248, 136], 'origin at 5.8 + 0.3887 m');
  for (const ship of Object.values(SHIP_REFIT)) for (const p of ship.deck.models) assert.ok(REFIT_MODEL_FOOT[p.id] > 0, `${p.id} has a foot`);
  assert.throws(() => refitDeckRecords({ floor: 0, models: [{ id: 41000, x: 0, z: 0, face: 0, lift: 0 }] }), /no foot for deck model 41000/);
});

test('SHIP REFIT the building file: the player\'s classic record first and whole, the pieces after it, both halves\' headers counted', () => {
  const blocks = fakeBlocks();
  const json = shipRefitJson(blocks, SHIP_REFIT.small);
  const int = json.RmbSubRecord.Interior, ext = json.RmbSubRecord.Exterior;
  const ship = SHIP_REFIT.small;
  const pieces = Object.values(ship.storeys).reduce((n, s) => n + s.models.length, 0);
  const flatCount = Object.values(ship.storeys).reduce((n, s) => n + s.flats.length, 0);
  assert.deepEqual(int.Block3dObjectRecords.slice(0, 2).map((o) => o.ModelIdNum), [41508, 41817], 'the shell and its crate stay, in place');
  assert.equal(int.Block3dObjectRecords.length, 2 + pieces);
  assert.equal(int.Header.Num3dObjectRecords, 2 + pieces);
  assert.equal(int.Header.NumFlatObjectRecords, flatCount);
  assert.equal(ext.Block3dObjectRecords[0].ModelIdNum, 910, 'the hull first');
  assert.equal(ext.Header.Num3dObjectRecords, 1 + ship.deck.models.length);
  assert.equal(json.BuildingType, 24);
  assert.throws(() => shipRefitJson(fakeBlocks({ 390: 'TAVRAA00.RMB' }), SHIP_REFIT.small), /wants SHIPAA00\.RMB at block 390, BLOCKS\.BSA has TAVRAA00\.RMB/);
});

test('SHIP REFIT on the door: both building files under DFU\'s names, served through the door, no vendor; a BLOCKS.BSA without the ship stands it classic and says so', () => {
  _resetWorldDataReplacement(); installWorldDataReplacement();
  const err = console.error; const said = [];
  console.error = (...a) => said.push(a.join(' '));
  try {
    const blocks = fakeBlocks();
    bindWorldDataBlocks(blocks);
    assert.equal(installShipRefit(null), 0);
    assert.equal(installShipRefit(blocks), 2);
    const served = getBuildingReplacementData('SHIPAA00.RMB', 390, 0);
    assert.ok(served, 'the small ship\'s building file is served');
    assert.equal(served.rmbSubRecord.interior.block3dObjectRecords.length, shipRefitJson(blocks, SHIP_REFIT.small).RmbSubRecord.Interior.Block3dObjectRecords.length);
    assert.ok(getBuildingReplacementData('SHIPAA01.RMB', 630, 0), 'and the large\'s');
    assert.equal(worldDataVendorCarries('ship-refit', 'SHIPAA00.RMB-390-building0.json'), false, 'no vendor: no part of a town\'s layout');
    _resetWorldDataReplacement(); installWorldDataReplacement();
    assert.equal(installShipRefit(fakeBlocks({ 390: 'SHIPAA00.RMB' })), 1, 'one ship found, one served');
    assert.match(said.join(' | '), /wants SHIPAA01\.RMB at block 630, BLOCKS\.BSA has null - that ship stands as Daggerfall built it/);
  } finally {
    console.error = err;
    _resetWorldDataReplacement();
  }
});

test('SHIP REFIT the port\'s own: no switch, no lane, wired into the loader before the patches - every piece a classic model or flat, each container a house container', () => {
  for (const k of Object.keys(MOD_SETTINGS)) assert.doesNotMatch(k, /refit/i, 'no mod switch');
  assert.ok(!Object.keys(ONLINE_ROOM_MOD_KEYS).some((k) => /refit/.test(k)) && !ONLINE_PLAYERS_OWN_MODS.some((k) => /refit/.test(k)));
  const loader = readFileSync(join(ROOT, 'src/scenes/modWorldData.js'), 'utf8');
  assert.match(loader, /installUrbanArt\(\);[^\n]*\n {4}installShipRefit\(boundWorldDataBlocks\(\)\);/);
  for (const ship of Object.values(SHIP_REFIT)) {
    for (const s of Object.values(ship.storeys)) {
      for (const p of s.models) assert.ok(p.id >= 41000 && p.id < 42000, `${p.id}: one of Daggerfall's own furnishings`);
      for (const fl of s.flats) assert.ok(fl.archive >= 200 && fl.archive <= 218 && (fl.hang != null || REFIT_FLAT_PX[`${fl.archive}_${fl.record}`] != null || fl.record === 3), `${fl.archive}_${fl.record}`);
    }
    const chests = Object.values(ship.storeys).flatMap((s) => s.models).filter((p) => isHouseContainerModel(p.id));
    assert.ok(chests.length >= 10, `${ship.block}: ${chests.length} chests, crates and wardrobes to keep things in`);
  }
});

test('SHIP REFIT with ARENA2: every piece clears the shell, stands on its floor or its stack, overlaps nothing, shuts no passage; every container reachable; every flat on a floor or a table, every lamp under its ceiling; the decks the same', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, () => {
  assert.deepEqual(checkShipRefit(ARENA2), []);
});
