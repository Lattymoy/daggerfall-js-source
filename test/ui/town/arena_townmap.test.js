// ARENA-MAP (2026-10-03, the owner, live: "Arena doesn't show on town map") - THE ARENA ON THE TOWN MAP
// (`world/arena/arenaCity.js` arenaAutoMap / arenaTownLandmark, `ui/exteriorAutomapWindow.js` buildPlates,
// `ui/town/townSheet.js` named, the two exterior hosts' `blocks`). Both town maps draw a cell off its block's own automap
// bytes, and Kamer's bowl is byte 117 - BuildingTypes.Special1 + 1, "never displayed on automap" - so cell (4,3) of
// Daggerfall read as empty street; and the colosseum is no building of the list, so no name stood on it. Each pin is red
// on the tree before the fix (the served block carried the vendored bytes, and no row carried a landmark).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  installArena, _resetArena, arenaAutoMap, arenaTownLandmark, arenaColosseumAt, ARENA_BLOCK, ARENA_BLOCK_INDEX,
  ARENA_MAP_BYTE, ARENA_MAP_NAME,
} from '../../../src/world/arena/arenaCity.js';
import { SAND_R } from '../../../src/world/arena/arenaFloor.js';
import { getDFBlockReplacementData } from '../../../src/formats/worldData/worldDataReplacement.js';
import { CityNavigation } from '../../../src/world/city/cityNavigation.js';
import { quarterOf, isShowAllByte } from '../../../src/ui/town/townQuarters.js';
import { townBytes, townReader, quarterChains, sheetY, BLOCK_PX } from '../../../src/ui/ink/inkTown.js';
import { boundarySegments, linkSegments } from '../../../src/ui/ink/inkMap.js';
import { createTownSheet } from '../../../src/ui/town/townSheet.js';
import { ExteriorAutomapWindow, buildExteriorLayout, toPanelScreen, _resetZoomForTests } from '../../../src/ui/exteriorAutomapWindow.js';
import { nameplateAnchor } from '../../../src/ui/nameplateLayout.js';
import { _resetForTests } from '../../../src/systems/settings/settings.js';
import VENDORED from '../../../vendor/daggerfall-arena/Arena/ARENADAG.RMB.json' with { type: 'json' };
import { hostText } from '../../hostText.mjs';

const read = (p) => hostText(p);   // HOST-SPLIT 2: a host read whole - the town map's door lives in scenes/exteriorAutomapToggle.js (STAR0)
const KAMER = VENDORED.RmbBlock.FldHeader.AutoMapData;
const COLOURS = { temple: 0xffc37d45, shop: 0xff1855be, tavern: 0xff307555, house: 0xff283c45 };
const FONT = { fnt: { fixedWidth: 6, fixedHeight: 6, glyphWidth: () => 5 } };
const counts = (bytes) => { const c = {}; for (const v of bytes) c[v] = (c[v] ?? 0) + 1; return c; };

/** The block as the hosts hold it: installArena's port block through the world-data door. */
async function servedBlock() {
  _resetArena();
  await installArena({ readBin: async () => { throw new Error('no binary in this test'); }, log: null });
  const b = getDFBlockReplacementData(ARENA_BLOCK_INDEX, ARENA_BLOCK);
  assert.equal(b?.name, ARENA_BLOCK);
  return b;
}
/** The pixel (column, data row) under a point of the cell, metres - the rows run against +z. */
const pixelAt = (x, z) => [Math.floor(x / 1.6), 63 - Math.floor(z / 1.6)];

test('ARENA-MAP: the served block\'s automap draws the colosseum as a ring of a guild hall\'s byte round the open sand; nothing else moves, and the navgrid is the same', async () => {
  assert.equal(isShowAllByte(117), true, 'the cause: Kamer\'s byte is show-all furniture, never a building');
  assert.equal(quarterOf(117), null);
  assert.equal(ARENA_MAP_BYTE, 12, 'GuildHall + 1');
  assert.equal(quarterOf(ARENA_MAP_BYTE), 'temple', 'drawn as the guilds and temples are');
  const served = (await servedBlock()).rmbBlock.fldHeader.autoMapData;
  assert.deepEqual(counts(KAMER), { 0: 1583, 117: 2513 }, 'the vendored bowl is Kamer\'s, untouched');
  assert.deepEqual(counts(served), { 0: 1583, 12: 2051, 117: 462 }, 'the ring, and the sand and Kamer\'s stray left 117');
  for (let i = 0; i < 4096; i++) {
    if (served[i] !== KAMER[i]) assert.ok(KAMER[i] === 117 && served[i] === ARENA_MAP_BYTE, `pixel ${i}: only the bowl is recoloured`);
  }
  // the sand: the colosseum's own place, and every pixel round it nearer than SAND_R, keep 117; past it, the ring
  const [cx, , cz] = arenaColosseumAt();
  const [sc, sr] = pixelAt(cx, cz);
  assert.equal(served[sr * 64 + sc], 117, 'the sand under the colosseum\'s middle stays open');
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const [c, r] = pixelAt(cx + dx * (SAND_R + 4), cz + dz * (SAND_R + 4));
    assert.equal(served[r * 64 + c], ARENA_MAP_BYTE, `the stands ${dx},${dz} of the sand`);
    const [c2, r2] = pixelAt(cx + dx * (SAND_R - 3), cz + dz * (SAND_R - 3));
    assert.equal(served[r2 * 64 + c2], 117, `the sand's edge ${dx},${dz}`);
  }
  assert.deepEqual([...served.slice(0, 8)], [117, 117, 117, 117, 117, 117, 117, 0], 'Kamer\'s stray in his row 0 is past the colosseum\'s box: undrawn, as it was');
  assert.equal(served[5 * 64 + 30], ARENA_MAP_BYTE, 'the north gate (his row 5) is the colosseum\'s');
  assert.equal(served[62 * 64 + 9], ARENA_MAP_BYTE, 'a south tower (his row 62) is the colosseum\'s');
  // the navgrid asks nonzero alone: carved from either, the city's streets are the same
  const nav = (bytes) => { const n = new CityNavigation(1, 1); n.setBlockData(0, 0, bytes, () => 46); return [...n.grid]; };
  assert.deepEqual(nav(served), nav(KAMER), 'nothing walks differently');
  assert.deepEqual([...arenaAutoMap(KAMER)], [...served], 'the served block is arenaAutoMap of Kamer\'s');
});

test('ARENA-MAP: both maps draw it - the classic window\'s default view in the temple colour, the enhanced sheet\'s plan as a ring', async () => {
  const served = (await servedBlock()).rmbBlock.fldHeader.autoMapData;
  const classic = (bytes) => buildExteriorLayout(1, 1, [{ x: 0, y: 0, autoMap: bytes }], 'original', COLOURS);
  const drawn = (bmp) => bmp.colors.filter((c) => c !== 0).length;
  assert.equal(drawn(classic(KAMER)), 0, 'red before the fix: the default view drew none of Kamer\'s bowl');
  const bmp = classic(served);
  assert.equal(drawn(bmp), 2051);
  assert.ok(bmp.colors.every((c) => c === 0 || c === COLOURS.temple), 'every drawn pixel is the temple colour');
  const [cx, , cz] = arenaColosseumAt();
  const [sc, sr] = pixelAt(cx, cz);
  assert.equal(bmp.colors[sr * 64 + sc], 0, 'the sand is the map\'s own ground');
  assert.equal(bmp.colors[sr * 64 + sc + 16], COLOURS.temple, 'the stands east of it are drawn');
  // the enhanced sheet: built pixels, and the temple quarter's own island
  const built = (bytes) => { const f = townBytes(1, 1, [{ x: 0, y: 0, autoMap: bytes }]); const r = townReader(f); let n = 0; for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (r(x, y)) n++; return { f, r, n }; };
  assert.equal(built(KAMER).n, 0, 'red before the fix: the sheet drew nothing in the cell');
  const { f, r, n } = built(served);
  assert.equal(n, 2051);
  assert.ok(quarterChains(f, { segments: boundarySegments, link: linkSegments }).temple.length >= 2, 'the ring: an outer wall and the sand\'s inner one');
  assert.equal(r(sc, sr), false, 'the sand on the sheet is open');
  assert.equal(r(sc + 16, sr) && r(sc - 16, sr) && r(sc, sr + 16) && r(sc, sr - 16), true, 'and ringed on every side');
});

test('ARENA-MAP: the name - "Arena" at the colosseum\'s place on both maps, always, and never renamed', async () => {
  const dfBlock = await servedBlock();
  const landmark = arenaTownLandmark(dfBlock);
  assert.deepEqual(landmark, { name: 'Arena', position: [2025 * 0.025, 0, (-2377 + 4096) * 0.025], buildingType: 11 });
  assert.equal(ARENA_MAP_NAME, 'Arena');
  assert.equal(arenaTownLandmark({ name: 'GEMSAL03.RMB' }), null, 'any other block names nothing');
  assert.equal(arenaTownLandmark(null), null);
  const blocks = [{ x: 4, y: 3, autoMap: dfBlock.rmbBlock.fldHeader.autoMapData, landmark }, { x: 4, y: 4, autoMap: new Uint8Array(4096), landmark: null }];
  const anchor = nameplateAnchor(4, 3, landmark.position);
  assert.deepEqual(anchor, [4 * BLOCK_PX + 31, 3 * BLOCK_PX + 26]);
  // the classic window: one plate, with nothing discovered, where a building at that Position would stand
  _resetForTests(); _resetZoomForTests();
  const renames = [];
  const w = new ExteriorAutomapWindow({
    locationName: 'Daggerfall', locationId: 'r:arena', gridW: 8, gridH: 8, blocks,
    playerPos: () => [0, 0, 0], playerYaw: () => 0, locOrigin: [0, 0, 0], isCustomLocation: false,
    arrowMesh: () => null, compassArt: null, buildings: () => [], directory: () => [], discovered: () => [],
    rename: (k, t) => renames.push([k, t]),
  });
  const m = { s: 3, ox: 0, oy: 0 };
  const plates = w.buildPlates(FONT, m);
  assert.equal(plates.length, 1);
  assert.equal(plates[0].text, 'Arena');
  assert.equal(plates[0].name, 'Arena', 'the tooltip says it too');
  const [sx, sy] = toPanelScreen(w.cam, w.panelRect(m), anchor[0] - 8 * BLOCK_PX / 2, anchor[1] - 8 * BLOCK_PX / 2);
  assert.deepEqual([plates[0].x, plates[0].y], [sx, sy]);
  w._hoverPlate = plates[0];
  w._renameAt(0, 0);
  assert.deepEqual(renames, [], 'no record renames a landmark');
  // the enhanced sheet: named, in the temple quarter's ink, on the sand in the middle of its ring
  const sheet = createTownSheet({ gridW: 8, gridH: 8, blocks, buildings: () => [], discovered: () => [] });
  const H = 8 * BLOCK_PX;
  assert.deepEqual(sheet.names(), [{ text: 'Arena', quest: false, x: anchor[0], y: sheetY(H, anchor[1]), key: null, quarter: 'temple' }]);
  assert.equal(sheet.field.bytes[sheetY(H, anchor[1]) * sheet.field.w + anchor[0]], 117, 'the name stands on the sand');
});

test('ARENA-MAP: both exterior hosts hand the landmark on the town map\'s block rows; the interior and dungeon hosts open no town map', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = read(host);
    assert.match(s, /import \{[^}]*\barenaTownLandmark\b[^}]*\} from '\.\.\/world\/arena\/arenaCity\.js';/, `${host} imports it`);
    assert.match(s, /blocks: (?:b\.locBlocks|loc\.blocks)\.map\(\(bl\) => \(\{ x: bl\.x, y: bl\.y, autoMap: bl\.dfBlock\?\.rmbBlock\?\.fldHeader\?\.autoMapData, landmark: arenaTownLandmark\(bl\.dfBlock\) \}\)\),/, `${host}'s town map rows`);
  }
  for (const host of ['src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.doesNotMatch(read(host), /createTownMapWindow/, `${host} opens no town map`);
  assert.match(read('src/ui/town/townMapDoor.js'), /blocks: deps\.blocks \?\? \[\],/, 'the held map\'s town sheet takes the same rows');
});
