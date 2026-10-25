// TOWN-SHAPES TS3 (2026-10-25, the owner: "IC should be round, give other towns unique shapes. Its time to move away from
// perfect squares"; the mixed way: "#1 but players cant own a home yet outside the bay?"; bible/03-World/Town-Shapes.md TS3):
// a town past the Bay keeps a blob of its template's cells on its own seed - one piece, one of each kind of its buildings
// kept - and every other cell is open land; the buildings those cells drew leave its list, every kept one keeps its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { outlineCells, wholeOutline, townOutlineCells, classicKinds, outlineTownLocation, buildingKind, townOutlineBlockJson, installTownOutline, TOWN_OUTLINE, TOWN_OUTLINE_BLOCK, TOWN_OUTLINE_BLOCK_INDEX } from '../../src/world/townOutline.js';
import { drawNamedBuildings } from '../../src/systems/talk/talkTopics.js';
import { setLocationTiles, GROUND_RECORD_LIMIT } from '../../src/world/terrain/terrainTiles.js';
import { blockFromJson, getNewDFBlockIndex } from '../../src/formats/worldData/worldDataReplacement.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const count = (keep) => keep.reduce((n, v) => n + v, 0);

test('TS3 the blob: a seed\'s own (the same seed the same cells, two seeds two blobs), never a wall\'s cell, the corners of a wide grid out and its middle in; a grid of two by two every cell; a turn of the lobes another blob (mutants: the seed unread; a wall kept; the turn unread)', () => {
  const blobs = new Set();
  for (let s = 0; s < 24; s++) {
    const keep = outlineCells(7, 7, 1000 + s);
    assert.deepEqual(keep, outlineCells(7, 7, 1000 + s), 'the same seed, the same cells');
    assert.equal(keep[3 * 7 + 3], 1, 'the middle kept');
    blobs.add(keep.join(''));
  }
  assert.ok(blobs.size >= 12, `blobs of their own (${blobs.size} of 24)`);
  let corners = 0;
  for (let s = 0; s < 24; s++) { const k = outlineCells(7, 7, 2000 + s); corners += k[0] + k[6] + k[42] + k[48]; }
  assert.ok(corners < 24, `a wide grid's corners mostly out (${corners} of 96 kept)`);
  const ring = (bx, by) => bx === 0 || by === 0 || bx === 6 || by === 6;
  for (let s = 0; s < 8; s++) { const k = outlineCells(7, 7, s, ring); for (let i = 0; i < 49; i++) if (ring(i % 7, Math.floor(i / 7))) assert.equal(k[i], 0, 'a wall\'s cell'); }
  for (const s of [77, 3613, 3658]) assert.equal(count(outlineCells(2, 2, s)), 4, `two by two: every cell (seed ${s} - 3613 and 3658 rims that fall under its corners)`);
  assert.equal(count(outlineCells(4, 4, 77, (bx, by) => bx === 0 || by === 0 || bx === 3 || by === 3)), 4, 'a walled grid two by two inside: every cell inside');
  let turned = 0;
  for (let s = 0; s < 16; s++) if (outlineCells(6, 6, s).join('') !== outlineCells(6, 6, s, () => false, 3).join('')) turned++;
  assert.ok(turned > 0, 'a turn of the lobes moves the blob');
  assert.equal(TOWN_OUTLINE.min, 3);
});

test('TS3 the blob made whole: a kind no kept cell holds given back - its holder nearest the middle - and the pieces joined by a shortest way, never through a wall (mutants: no kind given back; the farther holder; a piece left apart)', () => {
  const w = 5, h = 5;
  const keep = new Uint8Array(w * h);
  keep[2 * w + 2] = 1;
  const kinds = new Map([[0, ['3']], [1 * w + 1, ['3']], [4 * w + 4, ['14:22']]]);
  wholeOutline(keep, w, h, (i) => kinds.get(i) ?? []);
  assert.equal(keep[1 * w + 1], 1, 'the bank nearest the middle');
  assert.equal(keep[0], 0, 'not the farther');
  assert.equal(keep[4 * w + 4], 1, 'the one temple');
  const seen = new Set([2 * w + 2]), stack = [2 * w + 2];
  while (stack.length) { const c = stack.pop(), x = c % w, y = (c - x) / w; for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) { const n = ny * w + nx; if (nx >= 0 && ny >= 0 && nx < w && ny < h && keep[n] && !seen.has(n)) { seen.add(n); stack.push(n); } } }
  assert.equal(seen.size, count(keep), 'one piece');
  assert.ok(count(keep) <= 3 + 4, 'by short ways: the bank\'s cell touches the middle\'s corner (one more), the temple\'s three more');
  // a wall between: the way goes round it
  const k2 = new Uint8Array(9); k2[0] = 1; k2[2] = 1;
  const wall = (bx, by) => bx === 1 && by === 0;
  wholeOutline(k2, 3, 3, () => [], wall);
  assert.equal(k2[1], 0, 'never the wall\'s cell');
  assert.deepEqual([k2[3], k2[4], k2[5]], [1, 1, 1], 'round by the row above');
});

test('TS3 the turn: the first turn of the lobes that keeps every kind, else the one that keeps the most - then whole (mutant: the first turn always)', () => {
  const w = 6, h = 6;
  // a kind in each corner: a turn that keeps the most corners is chosen, the rest given back
  const kinds = (i) => ({ 0: ['2'], 5: ['5'], 30: ['6'], 35: ['8'] })[i] ?? [];
  let chose = 0;
  for (let s = 0; s < 12; s++) {
    const keep = townOutlineCells(w, h, s, kinds);
    for (const c of [0, 5, 30, 35]) assert.equal(keep[c], 1, `seed ${s}: the corner's kind kept`);
  }
  // one kind on a cell the first turn leaves out and a later one keeps: that later turn's blob, nothing given back
  for (let s = 0; s < 40; s++) {
    const at = 0, k = (i) => (i === at ? ['3'] : []);
    if (outlineCells(w, h, s)[at]) continue;
    let t = 1;
    while (t < TOWN_OUTLINE.turns && !outlineCells(w, h, s, () => false, t)[at]) t++;
    if (t === TOWN_OUTLINE.turns) continue;
    chose++;
    assert.deepEqual(townOutlineCells(w, h, s, k), wholeOutline(outlineCells(w, h, s, () => false, t), w, h, k), `seed ${s}: turn ${t}`);
  }
  assert.ok(chose > 0, 'some seed turns its lobes to keep the corner');
});

test('TS3 the kinds as the game\'s own files lay them: the pool drawn by type in the grid\'s order, a guild no hall of this game carries aside, the Raven\'s hall its own (mutants: by list order; the uncarried guild drawn)', () => {
  const blocks = {
    A: { rmbBlock: { fldHeader: { numBlockDataRecords: 2, buildingDataList: [{ buildingType: 11 }, { buildingType: 17 }] } } },
    B: { rmbBlock: { fldHeader: { numBlockDataRecords: 2, buildingDataList: [{ buildingType: 11 }, { buildingType: 14 }], otherNames: [null, null] } } },
    R: { rmbBlock: { fldHeader: { numBlockDataRecords: 1, buildingDataList: [{ buildingType: 15 }], otherNames: ['KRAVE01.HS2'] } } },
  };
  const list = [{ buildingType: 11, factionId: 1000 }, { buildingType: 11, factionId: 40 }, { buildingType: 14, factionId: 22 }, { buildingType: 11, factionId: 41 }, { buildingType: 15, factionId: 0 }];
  assert.deepEqual(classicKinds(list, ['TA', 'TB', 'TR'], (n) => blocks[n.slice(1)]), [['11:40'], ['11:41', '14:22'], ['11:414']]);
  assert.deepEqual([buildingKind({ buildingType: 9, factionId: 5 }), buildingKind({ buildingType: 14, factionId: 22 })], ['9', '14:22']);
});

/** A grid of synthetic blocks: cell i holds a general store, a house, and (`extra(i)`) more records. */
function synthTown(w, h, extra = () => []) {
  const blocks = new Map(), names = [], list = [];
  for (let i = 0; i < w * h; i++) {
    const recs = [{ buildingType: 9 }, { buildingType: 17 }, ...extra(i)];
    const name = `T${String(i).padStart(4, '0')}.RMB`;
    blocks.set(name, { name, index: 10 + i, rmbBlock: { fldHeader: { numBlockDataRecords: recs.length, buildingDataList: recs.map((r) => ({ ...r, nameSeed: 0 })), groundData: { groundTiles: Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => ({ textureRecord: 2, tileBitfield: 2 }))) }, autoMapData: new Uint8Array(4096) }, subRecords: [], misc3dObjectRecords: [], miscFlatObjectRecords: [] } });
    names.push(name);
    for (const r of recs) list.push({ buildingType: r.buildingType, factionId: r.factionId ?? 0, nameSeed: 100 + list.length, sector: 0, locationId: 0, quality: 1 });
  }
  const loc = { name: 'Synth', locationIndex: -1000123, mapTableData: { mapId: 0xa7a1234, locationType: 1 }, exterior: { buildingCount: list.length, buildings: list, exteriorData: { width: w, height: h, blockNames: names, mapId: 0xa7a1234 } } };
  const of = (n) => (n === TOWN_OUTLINE_BLOCK ? blockFromJson(townOutlineBlockJson(), TOWN_OUTLINE_BLOCK_INDEX) : blocks.get(n) ?? null);
  return { loc, of, blocks };
}
const drawnByCell = (loc, of) => {
  const ed = loc.exterior.exteriorData, grid = [];
  for (let y = 0; y < ed.height; y++) for (let x = 0; x < ed.width; x++) { const dfBlock = of(ed.blockNames[y * ed.width + x]); if (dfBlock) grid.push({ dfBlock, x, y }); }
  const { out, drawn } = drawNamedBuildings(loc.exterior.buildings, grid, { locationIndex: loc.locationIndex });
  return { grid, out, drawn };
};

test('TS3 a town past the Bay\'s outline: a new location (its template\'s untouched), every cell it leaves out the open block, its list stripped of exactly what those cells drew - every kept building keeps the entry it drew - one of each kind kept, and `outline` its count; a grid it keeps whole the location itself (mutants: the template\'s list filtered in place; a kept cell\'s entry stripped; a left cell\'s kept)', () => {
  // a 6 x 6 town: the only bank in a corner, the only temple on an edge
  const { loc, of } = synthTown(6, 6, (i) => (i === 0 ? [{ buildingType: 3 }] : i === 3 ? [{ buildingType: 14, factionId: 22 }] : []));
  const names0 = [...loc.exterior.exteriorData.blockNames], list0 = [...loc.exterior.buildings];
  const before = drawnByCell(loc, of);
  const out = outlineTownLocation(loc, { classicOf: of, servedOf: of });
  assert.notEqual(out, loc);
  assert.deepEqual(loc.exterior.exteriorData.blockNames, names0, 'the template\'s grid untouched');
  assert.deepEqual(loc.exterior.buildings, list0, 'and its list');
  const ed = out.exterior.exteriorData, left = ed.blockNames.filter((n) => n === TOWN_OUTLINE_BLOCK).length;
  assert.ok(left > 0 && left < 36, `cells left out (${left})`);
  assert.deepEqual(out.outline, { kept: 36 - left, left, walled: false });
  assert.notEqual(ed.blockNames[0], TOWN_OUTLINE_BLOCK, 'the one bank\'s cell kept');
  assert.notEqual(ed.blockNames[3], TOWN_OUTLINE_BLOCK, 'the one temple\'s cell kept');
  const after = drawnByCell(out, of);
  const strip = new Set();
  for (const b of before.grid) { const i = b.y * 6 + b.x; if (ed.blockNames[i] === TOWN_OUTLINE_BLOCK) for (const e of before.drawn.get(b) ?? []) strip.add(e); }
  assert.deepEqual(out.exterior.buildings, list0.filter((e) => !strip.has(e)), 'exactly the left cells\' draws');
  assert.equal(out.exterior.buildingCount, out.exterior.buildings.length);
  for (const b of before.grid) {
    const i = b.y * 6 + b.x;
    if (ed.blockNames[i] === TOWN_OUTLINE_BLOCK) continue;
    const a = after.grid.find((g) => g.x === b.x && g.y === b.y);
    assert.deepEqual(after.drawn.get(a) ?? [], before.drawn.get(b) ?? [], `cell ${i} draws what it drew`);
  }
  // a town of two by two: every cell, the location itself
  const small = synthTown(2, 2);
  assert.equal(outlineTownLocation(small.loc, { classicOf: small.of, servedOf: small.of }), small.loc);
  // no block read: the location itself
  assert.equal(outlineTownLocation(loc, { classicOf: of, servedOf: () => null }), loc);
});

test('TS3 the open cell: no tile of its own (the land\'s - never stamped), no tree, no town-map byte, no building; on the door behind no switch at its own index; the host lays a clone\'s outline as it stands it, the game\'s own blocks choosing its cells (mutants: a tile stamped; the install unwired; the outline unread)', () => {
  const block = blockFromJson(townOutlineBlockJson(), TOWN_OUTLINE_BLOCK_INDEX);
  const fh = block.rmbBlock.fldHeader;
  assert.ok(fh.groundData.groundTiles.flat().every((t) => t.textureRecord >= GROUND_RECORD_LIMIT));
  assert.ok(fh.groundData.groundScenery.flat().every((t) => t.textureRecord < 1));
  assert.ok([...fh.autoMapData].every((v) => v === 0));
  assert.equal(block.rmbBlock.subRecords.length, 0);
  const loc = { name: 'Open', exterior: { exteriorData: { width: 1, height: 1, blockNames: [TOWN_OUTLINE_BLOCK] } }, mapTableData: { mapId: 1, locationType: 1 } };
  const tilemap = new Uint8Array(128 * 128);
  setLocationTiles(loc, { getRmbBlockName: () => TOWN_OUTLINE_BLOCK }, { checkName: (n) => n, getBlockIndex: () => 0, getBlock: () => block }, tilemap);
  assert.ok(tilemap.every((v) => v === 0), 'nothing stamped');
  installTownOutline();
  assert.equal(getNewDFBlockIndex(TOWN_OUTLINE_BLOCK), TOWN_OUTLINE_BLOCK_INDEX);
  assert.match(rd('src/scenes/modWorldData.js'), /installCapitals\(\);[^\n]*\n\s+installTownOutline\(\);/);
  const h = rd('src/scenes/tamrielPlacesHost.js');
  assert.match(h, /const blockOf = \{ classicOf: \(name\) => blocks\.readClassicBlock\(blocks\.getBlockIndex\(blocks\.checkName\(name\)\)\), servedOf: \(name\) => blocks\.getBlockByName\(name\) \};/);
  assert.match(h, /const loc = outlineTownLocation\(synthesizeArenaLocation\(/);
  assert.match(h, /const loc = outlineTownLocation\(made, blockOf\);/);
  assert.doesNotMatch(h, /outlineTownLocation\(synthesizeCapitalLocation/, 'a capital is its own plan\'s (TS5)');
});

test('TS3 with ARENA2: every city the places past the Bay clone keeps one of each kind of its buildings, its wall ring open, its kept buildings each the entry it drew; the cells the same from the game\'s own blocks and as served (mutant: the kinds unkept)', { skip: skipReal }, async () => {
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { arenaTemplates } = await import('../../src/world/arenaLocations.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
  const rows = [];
  for (let r = 0; r < 62; r++) { const reg = maps.getRegion(r); if (!reg) continue; for (let l = 0; l < reg.locationCount; l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
  const T = arenaTemplates(rows);
  const served = (n) => (n === TOWN_OUTLINE_BLOCK ? blockFromJson(townOutlineBlockJson(), TOWN_OUTLINE_BLOCK_INDEX) : blocks.getBlockByName(n));
  const io = { classicOf: (n) => blocks.readClassicBlock(blocks.getBlockIndex(blocks.checkName(n))), servedOf: served };
  const NAMED = new Set([0, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  const kinds = (list) => new Set(list.filter((b) => NAMED.has(b.buildingType) && !(b.buildingType === 11 && b.factionId === 1000)).map(buildingKind));
  let interiorLeft = 0;
  for (const [j, t] of T['city-state'].entries()) {
    const mapId = ((0xa7 << 20) | (500000 + j)) >>> 0;
    const loc = { ...t, mapTableData: { ...t.mapTableData, mapId } };
    const out = outlineTownLocation(loc, io);
    assert.notEqual(out, loc, t.name);
    const ed = out.exterior.exteriorData;
    assert.ok(t.exterior.exteriorData.blockNames.every((n, i) => !/^WALLAA/.test(n) || ed.blockNames[i] === TOWN_OUTLINE_BLOCK), `${t.name}: its wall ring open`);
    assert.deepEqual(kinds(out.exterior.buildings), kinds(t.exterior.buildings), `${t.name}: one of each kind`);
    interiorLeft += ed.blockNames.filter((n, i) => n === TOWN_OUTLINE_BLOCK && !/^WALLAA/.test(t.exterior.exteriorData.blockNames[i])).length;
    if (j % 37) continue;   // the draws on a sample (the whole run is the probe's)
    const before = drawnByCell(loc, served), after = drawnByCell(out, served);
    for (const b of before.grid) {
      if (ed.blockNames[b.y * ed.width + b.x] === TOWN_OUTLINE_BLOCK) continue;
      const a = after.grid.find((g) => g.x === b.x && g.y === b.y);
      assert.deepEqual(after.out.get(a), before.out.get(b), `${t.name} (${b.x},${b.y}): its buildings as they were`);
    }
    assert.deepEqual(outlineTownLocation(loc, { ...io, classicOf: (n) => blocks.getBlockByName(n) }).exterior.exteriorData.blockNames, ed.blockNames, 'the same cells either way (no mod here)');
  }
  assert.ok(interiorLeft > T['city-state'].length, `the cities leave out cells inside their walls too (${interiorLeft})`);
});
