// WATER-DRAW2 (2026-10-07, Mac with a winter town's screenshot - a pond of WATER-NEXT's water and in it two flat blue
// squares round white islands: "Is there a reason these fucking patches still remain after our most recent water
// changes?"): THE DRAW'S TABLE KNOWS THE WATER ART. The islands (4, 19, 29), the corners (37, 38, 40, 41, 43, 44) and a
// saddle laid half turned are drawn as their art paints them - and every water law that asks the draw's table (PUDDLE-DRY,
// WATER-NEXT's bed, silt and sheet) follows; the law's table, the feet's, is not asked. The record:
// bible/07-Rendering/Water-Arc.md WATER-DRAW2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { WATER_MASK_TABLE, WATER_DRAW_MASK_TABLE, ISLAND_DRAWN, CORNER_DRAWN, buildWaterMaskTable } from '../src/world/waterCorners.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { dryPuddles, groundTileWet } from '../src/world/puddleDry.js';
import { waterBedDepths } from '../src/world/waterBed.js';
import { buildWaterIndices } from '../src/render/waterSurface.js';

const ARENA2 = process.env.ARENA2_PATH;
/** A table's four entries for a record, turn by turn. */
const byTurn = (table, r) => [0, 1, 2, 3].map((t) => table[(r << 2) | t]);
const FLIP = 0x80;   // the RMB byte's flip bit: convertTile's turn + 2, a half turn
/** A block's ground as BLOCKS.BSA stores it, read by the reader's own code (test/puddledry.test.js's fixture). */
function ground(paint) {
  const bytes = new Uint8Array(256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) bytes[y * 16 + x] = paint(x, y);
  return new BlocksFile()._readRmbGroundTilesData({ pos: 0 }, { bytes });
}

test('WATER-DRAW2 the draw\'s table: an island whole at every turn, a corner record 7\'s corner turn for turn, a saddle half turned its own diagonal (mutants: an island dropped; the islands undrawn; a corner dropped; the corner taken from record 6; the saddle left dry; its turns crossed)', () => {
  assert.deepEqual([...ISLAND_DRAWN], [4, 19, 29], 'water round dirt, grass and stone');
  assert.deepEqual([...CORNER_DRAWN], [37, 38, 40, 41, 43, 44]);
  for (const r of ISLAND_DRAWN) assert.deepEqual(byTurn(WATER_DRAW_MASK_TABLE, r), [0xF, 0xF, 0xF, 0xF], `island ${r}`);
  assert.deepEqual(byTurn(WATER_DRAW_MASK_TABLE, 7), [0b0010, 0b1000, 0b0100, 0b0001], 'record 7: one corner of water');
  for (const r of CORNER_DRAWN) assert.deepEqual(byTurn(WATER_DRAW_MASK_TABLE, r), [0b0010, 0b1000, 0b0100, 0b0001], `corner ${r}`);
  for (const r of [48, 49, 50]) assert.deepEqual(byTurn(WATER_DRAW_MASK_TABLE, r), [0b1001, 0b0110, 0b1001, 0b0110], `saddle ${r}: a half turn is the same diagonal`);
});

test('WATER-DRAW2 the law\'s table is not asked: DFU walks the player over every one of them dry (mutants: the three drawn into the law)', () => {
  for (const r of [...ISLAND_DRAWN, ...CORNER_DRAWN]) assert.deepEqual(byTurn(WATER_MASK_TABLE, r), [0, 0, 0, 0], `${r} is no water to the feet`);
  for (const r of [48, 49, 50]) assert.deepEqual(byTurn(WATER_MASK_TABLE, r), [0b1001, 0b0110, 0, 0], `saddle ${r}: the feet's as the marching table writes it`);
  assert.deepEqual([...WATER_MASK_TABLE], [...buildWaterMaskTable()], 'the feet\'s table is the default build');
});

test('WATER-DRAW2 PUDDLE-DRY follows the draw: a lone island and a lone corner dry, an island in its pond keeps the pond whole, and no puddle dries into water art (mutants: the islands undrawn; the corners undrawn)', () => {
  const GRASS = 2;
  const g = ground((x, y) => {
    if (x === 3 && y === 3) return 19;              // an island alone in the grass
    if (x === 12 && y === 3) return 37;             // a corner of water alone
    if (x === 3 && y === 12) return 48 | FLIP;      // a saddle laid half turned, alone
    if (y === 9 && (x === 8 || x === 9)) return [21, 4][x - 8];   // a shore edge against an island: FARMAA03's pond
    if (x === 12 && y === 12) return 23;            // a pool beside a corner of water...
    if (x === 13 && y === 12) return 38;            // ...is a pool meeting a shore
    return GRASS;
  });
  for (const [x, y] of [[3, 3], [12, 3], [3, 12], [8, 9], [9, 9], [12, 12], [13, 12]]) assert.equal(groundTileWet(g[x][y]), true, `${x},${y} is water to the draw`);
  dryPuddles(g);
  for (const [x, y] of [[3, 3], [12, 3], [3, 12]]) assert.equal(g[x][y].tileBitfield, GRASS, `${x},${y}: one tile of water - dried`);
  assert.deepEqual([g[8][9].textureRecord, g[9][9].textureRecord], [21, 4], 'the shore edge and its island: a pond, kept');
  assert.deepEqual([g[12][12].textureRecord, g[13][12].textureRecord], [23, 38], 'art meeting a shore: kept, as PUDDLE-DRY keeps it');
  // a pool with an island on each diagonal and grass square to it: four and four, and the walk meets an island first -
  // the island is water, so no ground to take (before WATER-DRAW2 the pool was made an island)
  const k = ground((x, y) => (x === 5 && y === 5 ? 23 : Math.abs(x - 5) === 1 && Math.abs(y - 5) === 1 ? 4 | 0x40 : GRASS));
  dryPuddles(k);
  assert.equal(k[5][5].tileBitfield, GRASS, 'the pool is grass, never an island');
});

test('WATER-NEXT\'s readers follow the draw: an island tile is drawn and a pond of them has a bed (mutants: the islands undrawn)', () => {
  const dim = 16, bytes = new Uint8Array(dim * dim).fill(2 << 2);   // grass
  assert.equal(buildWaterIndices(bytes, 1, undefined, dim), null, 'grass: no water');
  for (let z = 5; z <= 9; z++) for (let x = 5; x <= 9; x++) bytes[z * dim + x] = (19 << 2) | ((x + z) & 3);   // a pond of islands, every turn
  assert.ok(buildWaterIndices(bytes, 1, undefined, dim), 'the sheet covers them');
  const bed = waterBedDepths(bytes, { tileDim: dim });
  assert.ok(bed, 'and carves under them');
  assert.equal(bed[5 * (dim + 1) + 5], 0, 'the bank');
  assert.ok(bed[7 * (dim + 1) + 7] > 0, 'the heart under water');
});

/** The classic art's water corners, a record and a turn: the colour rule's mask (WATER-PUDDLE's), the share of a
 *  quarter-tile square at each tilemap corner read through the pass's own turn, water where half of it is. */
async function artCorners(arch) {
  const { TextureFile } = await import('../src/formats/textureFile.js');
  const { DFPalette } = await import('../src/formats/dfPalette.js');
  const { waterColours, cleanMask, WATER_COLOUR_TOLERANCE, turnFraction } = await import('../src/world/puddleMask.js');
  const pal = new DFPalette(); pal.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))));
  const name = `TEXTURE.${String(arch).padStart(3, '0')}`;
  const t = new TextureFile(); t.load(new Uint8Array(readFileSync(join(ARENA2, name))), name, pal);
  const layers = []; for (let r = 0; r < t.recordCount; r++) layers.push(t.getColor32(t.getDFBitmap(r, 0), 0));
  const water = waterColours(layers[0]), t2 = WATER_COLOUR_TOLERANCE ** 2;
  const masks = layers.map((l) => {
    const b = new Uint8Array(l.colors.buffer, l.colors.byteOffset, l.width * l.height * 4), wet = new Uint8Array(l.width * l.height);
    for (let i = 0; i < wet.length; i++) wet[i] = water.some(([r, g, bb]) => (b[i * 4] - r) ** 2 + (b[i * 4 + 1] - g) ** 2 + (b[i * 4 + 2] - bb) ** 2 <= t2) ? 1 : 0;
    return { w: l.width, h: l.height, wet: cleanMask(wet, l.width, l.height) };
  });
  return (r, turn) => [[0, 0, 1], [1, 0, 2], [0, 1, 4], [1, 1, 8]].reduce((bits, [cx, cz, bit]) => {
    const m = masks[r];
    let n = 0;
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      const [u, v] = turnFraction(turn, cx ? 1 - (i + 0.5) / 64 : (i + 0.5) / 64, cz ? 1 - (j + 0.5) / 64 : (j + 0.5) / 64);
      n += m.wet[Math.min(m.h - 1, Math.floor(v * m.h)) * m.w + Math.min(m.w - 1, Math.floor(u * m.w))];
    }
    return n >= 128 ? bits | bit : bits;
  }, 0);
}

test('WATER-DRAW2 on the player\'s art and blocks: no record and turn the art paints water at a corner in every climate is dry to the draw; BLOCKS.BSA lays 1,071 islands, 76 corners and 138 half-turned saddles (needs ARENA2)', { skip: !(ARENA2 && existsSync(join(ARENA2, 'TEXTURE.302')) && existsSync(join(ARENA2, 'BLOCKS.BSA'))) && 'no ARENA2' }, async () => {
  // the climates the colour rule reads cleanly: the desert, the woods and the two winters (the mountain's and the
  // swamp's summer grounds sit inside the water's tolerance - WATER-PUDDLE's table)
  const climates = await Promise.all([2, 302, 303, 103].map(artCorners));
  const gaps = [], agree = [];
  for (let r = 0; r < 56; r++) for (let t = 0; t < 4; t++) {
    const art = climates.map((c) => c(r, t));
    if (art.every((b) => b) && !WATER_DRAW_MASK_TABLE[(r << 2) | t]) gaps.push(`${r}/${t}`);
    if ([...CORNER_DRAWN, 48, 49, 50].includes(r) && art.every((b) => b === WATER_DRAW_MASK_TABLE[(r << 2) | t])) agree.push(`${r}/${t}`);
  }
  assert.deepEqual(gaps, [], 'every water the art paints at a corner is drawn');
  assert.equal(agree.length, 36, 'the corners and the saddles exactly the art\'s, every turn in every climate');
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const laid = { island: 0, corner: 0, saddle: 0 };
  for (let i = 0; i < blocks.count; i++) {
    if (!/\.RMB$/i.test(blocks.getBlockName(i))) continue;
    for (const col of blocks.readClassicBlock(i).rmbBlock.fldHeader.groundData.groundTiles) for (const tile of col) {
      if (ISLAND_DRAWN.includes(tile.textureRecord)) laid.island++;
      else if (CORNER_DRAWN.includes(tile.textureRecord)) laid.corner++;
      else if ([48, 49, 50].includes(tile.textureRecord) && (tile.tileBitfield & FLIP)) laid.saddle++;
    }
  }
  assert.deepEqual(laid, { island: 1071, corner: 76, saddle: 138 });
});
