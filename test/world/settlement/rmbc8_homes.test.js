// RMB-CONTRACTS RMBC8 (bible/03-World/RMB-Contracts.md): A HOUSE IN A NEW SETTLEMENT IS A HOME. A generated house's door
// hands the game a record the home law reads as it reads a block's: a candidate, for sale, priced by its own ground and
// its town's size, its scene named by its place and minted key, every id the account service's claim checks accepted, its
// yard in a cell no RMB key reaches; the host files each house's yard frame on its pixel and takes it back. A Hammerfell
// settlement and a Bay village's outskirts (TAMRIEL-WIDE). Pins mutation-checked (tools/mutants/rmbc8.json).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homeCandidate, homePurchasable } from '../../../src/systems/online/onlineHomes.js';
import { homeOnlinePrice, homePriceOk, homeMapIdOk, homeBuildingKeyOk, homeRegionOk, homeInArenaCell } from '../../../src/net/homeLaw.js';
import { homeSceneName } from '../../../src/net/homeScene.js';
import { homeSceneOf } from '../../../src/systems/online/onlineHomes.js';
import { homeListingOf } from '../../../src/net/homeListingLaw.js';
import { yardCellOf, yardCellOk } from '../../../src/net/yardCellLaw.js';
import { isResidence } from '../../../src/world/buildingNames.js';
import { standSettlement, createSettlementHost, fileHomeFrames, GROWTH_SLOT_FIRST, HOUSE_HEIGHT } from '../../../src/scenes/settlementHost.js';
import { layoutSettlement } from '../../../src/world/settlement/settlementLayout.js';
import { SETTLEMENT_ROWS, settlementInput } from '../../../src/world/settlement/settlementPlaces.js';
import { townGrowthJob, standTownGrowth } from '../../../src/world/settlement/townGrowth.js';
import { settlementHomeTown, settlementHomeRegion } from '../../../src/world/settlement/townGrowthJob.js';
import { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE } from '../../../src/world/terrain/terrainSampler.js';
import { SYNTHETIC } from '../../../tools/settlementProbe.mjs';

const ROW = SETTLEMENT_ROWS.find((r) => r.province === 'Hammerfell');
const L = layoutSettlement({ ...settlementInput(ROW, 1084, 241), env: SYNTHETIC.oasis }, SYNTHETIC.oasis);
const SAHR = standSettlement({ px: 1084, py: 241, settlement: { ordinal: ROW.ordinal, layout: L } }, null);
const D = 129, M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
function grownVillage() {
  const rect = { xMin: 52, xMax: 76, yMin: 52, yMax: 76 }, s = new Float32Array(D * D);
  for (let x = 0; x < D; x++) for (let y = 0; y < D; y++) s[x * D + y] = (65 + 2 * Math.sin(x / 10)) / M;
  for (let x = rect.xMin; x <= rect.xMax; x++) for (let y = rect.yMin; y <= rect.yMax; y++) s[x * D + y] = s[64 * D + 64];
  const job = townGrowthJob({ mapTableData: { mapId: 14814319, locationType: 2 }, name: 'Arkbridge', exterior: { exteriorData: { width: 2, height: 2 } } }, 'IliacBay', 17);
  const g = standTownGrowth(255, 134, s, job, rect, {});
  return { job, made: standSettlement({ px: 255, py: 134, settlement: g }, null, GROWTH_SLOT_FIRST) };
}

test('RMBC8 a generated house is a home for sale: a candidate, purchasable, priced in the law\'s range by its ground and its town\'s size (mutants: the town\'s blocks, the footprint)', () => {
  const { job, made } = grownVillage();
  assert.equal(job.blocks, 4, 'Arkbridge is two blocks by two');
  for (const [where, town, blocks] of [[SAHR, ROW.name, 1], [made, 'Arkbridge', 4]]) {
    const houses = where.pieces.map((x) => x.record).filter((r) => isResidence(r.buildingType));
    assert.ok(houses.length > 0, `${town} has houses`);
    for (const r of houses) {
      assert.ok(homeCandidate(r) && homePurchasable(r), `${town} ${r.buildingKey}`);
      assert.equal(r.townBlocks, blocks);
      assert.ok(r.footprintM2 > 20, 'its own ground');
      assert.ok(homePriceOk(homeOnlinePrice(r.footprintM2, r.townBlocks)), 'a price the service takes');
    }
    const shop = where.pieces.map((x) => x.record).find((r) => !isResidence(r.buildingType));
    if (shop) assert.equal(homeCandidate(shop), false, 'a shop is never a home');
  }
  const [a] = made.pieces.map((x) => x.record).filter((r) => isResidence(r.buildingType));
  assert.ok(homeOnlinePrice(a.footprintM2, 4) >= homeOnlinePrice(a.footprintM2, 1), 'a bigger town, a dearer house');
});

test('RMBC8 the claim: its scene named by place and minted key and read back; every id the service checks accepted; no row takes it off; no arena cell (mutants: none - the law is read as it stands)', () => {
  for (const r of [...SAHR.pieces, ...grownVillage().made.pieces].map((x) => x.record).filter((x) => isResidence(x.buildingType))) {
    assert.deepEqual(homeSceneOf(homeSceneName(r.townMapId, r.buildingKey)), { mapId: r.townMapId, buildingKey: r.buildingKey });
    assert.ok(homeMapIdOk(r.townMapId) && homeBuildingKeyOk(r.buildingKey) && homeRegionOk(r.regionIndex), `${r.townMapId}/${r.buildingKey}`);
    assert.equal(homeListingOf(r.townMapId, r.buildingKey), null);
    assert.equal(homeInArenaCell(r.townMapId, r.buildingKey), false);
  }
});

test('RMBC8 a minted key\'s yard cell is its own: in the law\'s range, past every RMB cell and BUILDING_KEY_0\'s', () => {
  for (const k of [0x800000, 0x9abcde, 0xffffff]) {
    const c = yardCellOf(k);
    assert.ok(yardCellOk(c) && c >= 0x8000 && c < 0x10000, `${k.toString(16)} -> ${c}`);
  }
  assert.ok(yardCellOf(0x07ff1f) < 0x8000, 'an RMB key\'s cell is under them');
});

test('RMBC8 the host files each house\'s yard frame on its pixel - its place, its box, its footprint - and takes it back with the town (mutants: the filing, the take-back, a shop filed)', async () => {
  const frames = new Map([[513, { at: [0, 0, 0] }]]);
  const s = { ...SAHR, homeKeys: [], homeFrames: null };
  fileHomeFrames(s, frames);
  const houses = SAHR.pieces.filter((x) => isResidence(x.record.buildingType));
  assert.equal(frames.size, 1 + houses.length, 'every house, no shop');
  const f = frames.get(houses[0].record.buildingKey), b = SAHR.plan.buildings[SAHR.pieces.indexOf(houses[0])];
  assert.deepEqual(f.at, [b.at[0], houses[0].piece.frame[13], b.at[1]]);
  assert.equal(f.box[4] - f.box[1], HOUSE_HEIGHT);
  for (const [e, n] of b.footprint) assert.ok(e >= f.rects[0][0] && e <= f.rects[0][2] && n >= f.rects[0][1] && n <= f.rects[0][3]);
  // through the host: stood with the pixel's frames, taken back when the pixel goes
  const entry = { px: 1084, py: 241, settlement: { ordinal: ROW.ordinal, layout: L }, homeFrames: new Map([[513, {}]]) };
  let entries = [entry];
  const host = createSettlementHost({ built: () => entries, translation: (px, py, out = [0, 0, 0]) => out, feet: () => null });
  host.frame();
  assert.equal(entry.homeFrames.size, 1 + houses.length);
  entries = [];
  host.frame();
  assert.deepEqual([...entry.homeFrames.keys()], [513], 'the block\'s own frame stays');
});

test('RMBC8 a settlement pixel\'s homes are its place\'s, in its province\'s region; the build names them (by source; mutants: the town, the region)', () => {
  assert.equal(settlementHomeTown({ mapId: 875036673, growth: false }), 875036673);
  assert.equal(settlementHomeTown({ mapId: 14814319, growth: true }), 0, 'a grown town\'s are its location\'s');
  assert.equal(settlementHomeTown(null), 0);
  assert.equal(settlementHomeRegion({ mapId: 1 }, 1150, 380), 63);
  assert.equal(settlementHomeRegion(null, 1150, 380), 0);
  const build = readFileSync(new URL('../../../src/scenes/pixelBuild.js', import.meta.url), 'utf8');
  assert.match(build, /homeTown: homeTown \|\| settlementHomeTown\(settlement\),/);
  assert.match(build, /homeRegion: dfLocation\?\.regionIndex \?\? settlementHomeRegion\(settlement, px, py\),/);
});
