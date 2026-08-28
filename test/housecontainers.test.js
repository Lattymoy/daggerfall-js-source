// HC1 - AddFurnitureAction's OWNED arm, the whole HouseContainers
// activation, and AddSpawnPoints. The split row's survivors: a
// shelf-set model in a player-OWNED house is MakeHouseContainer
// (DaggerfallInterior.cs:816-819), activation is PlayerActivate's
// :902-925 arm whole (owner storage / stock-once / empty-does-nothing
// / the TEXT.RSC 37 question), and the Section3 spawn points ride the
// context with GetRandomSpawnPoint's pick law (:915-921, :1298-1311 -
// no DFU core caller, a mod-facing surface, ported for parity).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { layoutInterior } from '../src/world/interiorLayout.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';
import { PRIVATE_PROPERTY_TEXT_ID } from '../src/systems/shopStock.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, 'src', p), 'utf8');

const approx = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

// ---------------------------------------------------------------
// 1. AddSpawnPoints - the data law
// ---------------------------------------------------------------

function fixtureBlock(section3) {
  const model = { positions: new Float32Array([0, 1, 0, 0, -0.5, 0]), doors: [] };
  return {
    model,
    dfBlock: {
      rmbBlock: {
        subRecords: [{
          interior: {
            header: { num3dObjectRecords: 1 },
            block3dObjectRecords: [
              { modelIdNum: 100, objectType: 0, xPos: 0, yPos: 0, zPos: 0, xRotation: 0, yRotation: 0, zRotation: 0 },
            ],
            blockFlatObjectRecords: [],
            blockDoorRecords: [],
            ...(section3 === undefined ? {} : { blockSection3Records: section3 }),
          },
        }],
      },
    },
  };
}

test('HC1: AddSpawnPoints (:915-921) - (x, -y, z) * GlobalScale, every Section3 record', () => {
  const { dfBlock, model } = fixtureBlock([
    { xPos: 40, yPos: 80, zPos: 120, unknown1: 0, unknown2: 0, unknown3: 0 },
    { xPos: -8, yPos: -16, zPos: 0, unknown1: 0, unknown2: 0, unknown3: 0 },
  ]);
  const it = layoutInterior(dfBlock, 0, 0, () => model);
  assert.equal(it.spawnPoints.length, 2, 'one point per record - none dropped, none invented');
  approx(it.spawnPoints[0][0], 40 * GLOBAL_SCALE);
  approx(it.spawnPoints[0][1], -80 * GLOBAL_SCALE, 1e-6);   // the Y FLIP - DFU's new Vector3(x, -y, z)
  approx(it.spawnPoints[0][2], 120 * GLOBAL_SCALE);
  approx(it.spawnPoints[1][1], 16 * GLOBAL_SCALE);
});

test('HC1: a record with no Section3 data answers an EMPTY list, never throws', () => {
  const { dfBlock, model } = fixtureBlock(undefined);
  assert.deepEqual(layoutInterior(dfBlock, 0, 0, () => model).spawnPoints, []);
});

// ---------------------------------------------------------------
// 2. GetRandomSpawnPoint + the context surface (source pins - the
//    member is minted inside buildInteriorContext's return)
// ---------------------------------------------------------------

test('HC1: GetRandomSpawnPoint (:1298-1311) - null is DFU\'s false, the pick is Range(0, count)', () => {
  const ic = src('scenes/interiorContext.js');
  assert.ok(ic.includes('const spawnPoints = interior.spawnPoints.map(([x, y, z]) => parentPt(x, y, z));'),
    'parented like every other coordinate the context returns');
  assert.ok(ic.includes('(spawnPoints.length === 0 ? null : spawnPoints[Math.floor(roll() * spawnPoints.length)])'),
    'the empty-list false arm and the int-exclusive uniform pick, one expression');
  assert.match(ic, /spawnPoints,\n\s+\/\*\*/, 'the SpawnPoints property rides the return too');
});

// ---------------------------------------------------------------
// 3. AddFurnitureAction's OWNED arm (:816-819)
// ---------------------------------------------------------------

test('HC1: a shelf-set model in an OWNED house is MakeHouseContainer, not a shop shelf', () => {
  const ic = src('scenes/interiorContext.js');
  const arm = ic.slice(ic.indexOf('if (isShopShelfModel(p.modelIdNum)) {'));
  const owned = arm.indexOf('if (opts.houseOwned) {');
  const asContainer = arm.indexOf('containers.push({ cpu, matrix, items: null, record: containerTextureRecord(p.modelIdNum) });');
  const asShelf = arm.indexOf('shelves.push({ cpu, matrix, items: null });');
  assert.ok(owned >= 0 && asContainer >= 0 && asShelf >= 0);
  assert.ok(owned < asContainer && asContainer < asShelf,
    'owned routes to containers FIRST; everyone else\'s shelf stays a shelf');
  // the container born here carries the MakeHouseContainer texture
  // record (ModelIdNum % 100) and the stock-once null latch - the
  // same birth as the generic house-container arm below it.
});

test('HC1: the host answers houseOwned at BUILD, off the bank registry (:816)', () => {
  const wm = src('scenes/worldModes.js');
  assert.ok(wm.includes('const houseOwned = !!interiorBuilding && isHouseOwned(playerEntity.houses ?? [], interiorBuilding.regionIndex ?? 0, interiorBuilding.buildingKey);'),
    'the host owns the registry and evaluates at BUILD');
  assert.ok(wm.includes('setupStaticNpc, houseOwned, peopleVisible })'),
    'the answer rides the opts into buildInteriorContext - the peopleVisible idiom');
});

// ---------------------------------------------------------------
// 4. The HouseContainers activation arm whole (:902-925)
// ---------------------------------------------------------------

test('HC1: PRIVATE_PROPERTY_TEXT_ID is PlayerActivate\'s PrivatePropertyId (:94)', () => {
  assert.equal(PRIVATE_PROPERTY_TEXT_ID, 37);
});

test('HC1: owner access - house OR ship - opens loot-target storage, never stocks', () => {
  const wm = src('scenes/worldModes.js');
  const arm = wm.slice(wm.indexOf("if (key.startsWith('container:')) {"));
  const guard = arm.indexOf("(b?.buildingType === BUILDING_TYPES.Ship && ownsShip(playerEntity))");
  const houseGuard = arm.indexOf('|| isHouseOwned(playerEntity.houses ?? []');
  assert.ok(guard >= 0 && houseGuard > guard, 'the ship arm (:905-906) rides the same OR as the house');
  const ownedLatch = arm.indexOf('c.items ??= [];');
  const stock = arm.indexOf('c.items ??= stockHouseContainer(');
  assert.ok(ownedLatch >= 0 && stock >= 0 && ownedLatch < stock,
    'owned latches empty (stockedDate = 1) BEFORE the stranger arm ever stocks');
  // the storage is the loot-target inventory - DFU's LootTarget tail -
  // and it opens in BOTH arms through the one openLoot
  assert.ok(arm.slice(0, ownedLatch + 200).includes('host.makeInventory?.({ loot: { items: () => c.items } })'),
    'the remote side IS the container collection - two-way, live');
  // the old stopgap is GONE: nothing in this arm dumps the container
  // into the player any more
  assert.equal(arm.slice(0, arm.indexOf('interiorCtx.actions.activate')).includes('transferAll('), false,
    'the F209 grab-all stopgap retired with the arm');
});

test('HC1: a stocked stranger\'s container - empty does NOTHING, full asks TEXT.RSC 37', () => {
  const wm = src('scenes/worldModes.js');
  const arm = wm.slice(wm.indexOf("if (key.startsWith('container:')) {"));
  assert.ok(arm.includes("if (c.items.length === 0) return true;"),
    '"If no contents, do nothing" (:917-918) - no box, no open');
  assert.ok(arm.includes('townTalk?.lines?.(PRIVATE_PROPERTY_TEXT_ID)'),
    'the question is record 37 through the host\'s TEXT.RSC');
  assert.ok(arm.includes('This looks like private property. Do you still want to look through it?'),
    'record 37\'s own two lines as the no-corpus fallback');
  const yes = arm.indexOf("code: 'KeyY'");
  const no = arm.indexOf("code: 'KeyN'");
  assert.ok(yes >= 0 && no > yes, 'Yes/No in DFU\'s button order');
  assert.ok(arm.slice(yes, no).includes('action: openLoot'),
    'Yes opens the same loot-target inventory (PrivateProperty_OnButtonClick :1090-1093)');
  assert.ok(arm.slice(no, no + 120).includes('action: () => {}'),
    'No claims nothing - DFU just clears the LootTarget');
});
