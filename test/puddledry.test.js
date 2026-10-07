// PUDDLE-DRY (2026-10-07, Mac: "removing the water puddles entirely from town layouts"; asked, "Puddles only" and
// "Both skins"): a town's puddles are dry ground (world/puddleDry.js), served so through the block's one door
// (formats/blocksFile.js getBlock). The fixtures are the producer's: a block's 256 ground bytes read by BlocksFile's own
// ground reader, so every tile is the shape every reader of the ground is handed. The record: bible/07-Rendering/
// Water-Arc.md PUDDLE-DRY.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { dryPuddles, groundTileWet } from '../src/world/puddleDry.js';
import { PUDDLE_RECORDS } from '../src/world/puddleMask.js';
import { SHALLOW_WHOLE, SHALLOW_DRAWN } from '../src/world/waterCorners.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const ARENA2 = process.env.ARENA2_PATH;

const SAND = 1, GRASS = 2, POOL = 23, ART = 8, TURNED_GRASS = 2 | 0x40;
/** A block's ground as BLOCKS.BSA stores it, read by the reader's own code: `paint(x, y)` answers each tile's byte. */
function ground(paint) {
  const bytes = new Uint8Array(256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) bytes[y * 16 + x] = paint(x, y);
  return new BlocksFile()._readRmbGroundTilesData({ pos: 0 }, { bytes });
}
const bits = (g, x, y) => g[x][y].tileBitfield;

test('PUDDLE-DRY the puddle records: DFU\'s shallow-water art (SHALLOW_WHOLE) and WATER-DRAW1\'s (SHALLOW_DRAWN), one list, WATER-PUDDLE\'s own (audit24: one home)', () => {
  assert.match(read('src/world/puddleDry.js'), /import \{ PUDDLE_RECORDS \} from '\.\/puddleMask\.js';/);
  assert.deepEqual(PUDDLE_RECORDS, [...SHALLOW_WHOLE, ...SHALLOW_DRAWN].sort((a, b) => a - b));
  assert.deepEqual(PUDDLE_RECORDS, [8, 9, 23, 33, 34, 35, 36]);
});

test('PUDDLE-DRY a lone pool in the sand is sand - the tile takes the ground most of its eight dry neighbours stand on, its byte whole (mutants: no tile dried; the least common; the neighbour\'s turn dropped; a wet neighbour taken)', () => {
  const g = ground((x, y) => (x === 5 && y === 5 ? POOL : (x === 4 && y >= 4 && y <= 6 ? TURNED_GRASS : SAND)));
  assert.equal(groundTileWet(g[5][5]), true, 'the pool is water to the draw');
  assert.equal(dryPuddles(g), 1);
  assert.equal(bits(g, 5, 5), SAND, 'five sand neighbours to three grass: sand');
  assert.equal(groundTileWet(g[5][5]), false);
  assert.deepEqual(g[5][5], { tileBitfield: SAND, textureRecord: SAND, isRotated: false, isFlipped: false }, 'the reader\'s shape');
  // water on three diagonals is no ground to take: sand three (two square, one diagonal) to grass two, and the water
  // (three, the first the walk meets) never in the running
  const k = ground((x, y) => {
    const d = `${x - 7},${y - 7}`;
    if (d === '0,0') return POOL;
    if (['-1,-1', '-1,1', '1,1'].includes(d)) return 0;
    if (['0,-1', '1,0', '1,-1'].includes(d)) return SAND;
    if (['-1,0', '0,1'].includes(d)) return GRASS;
    return 3;
  });
  dryPuddles(k);
  assert.equal(bits(k, 7, 7), SAND, 'the dry ground\'s, never the water\'s');
  const h = ground((x, y) => (x === 9 && y === 9 ? ART : TURNED_GRASS));
  dryPuddles(h);
  assert.deepEqual(h[9][9], { tileBitfield: TURNED_GRASS, textureRecord: GRASS, isRotated: true, isFlipped: false }, 'turned grass all round: turned grass');
});

test('PUDDLE-DRY a patch of puddle art alone is a puddle whatever its size; one tile of anything wet is too - a lone water tile, a lone shore sliver, the zero byte\'s pond (mutants: the size rule only; the art rule only)', () => {
  const g = ground((x, y) => {
    if (y === 2 && x >= 2 && x <= 4) return [ART, POOL, 9][x - 2];   // three tiles of art in a row
    if (x === 10 && y === 10) return 0;                                // the zero byte: DFU's one-tile pond
    if (x === 13 && y === 3) return 6;                                 // a lone shore edge
    return GRASS;
  });
  assert.equal(groundTileWet(g[10][10]), true, 'the zero byte is record 0: water');
  assert.equal(dryPuddles(g), 5);
  for (const [x, y] of [[2, 2], [3, 2], [4, 2], [10, 10], [13, 3]]) assert.equal(bits(g, x, y), GRASS, `${x},${y} dried`);
});

test('PUDDLE-DRY a pond stays: a water heart in its shore ring, a hard-edged basin of open water, a moat; and a patch where art meets a pond (mutants: every patch dried; the shore ring not part of its pond)', () => {
  const pond = new Map([['5,5', 0], ['6,5', 0], ['4,5', 6], ['7,5', 6], ['5,4', 6], ['6,4', 6], ['5,6', 6], ['6,6', 6]]);
  const g = ground((x, y) => {
    if (pond.has(`${x},${y}`)) return pond.get(`${x},${y}`);
    if ((x === 11 || x === 12) && (y === 11 || y === 12)) return 0;   // a 2x2 basin, no shore
    if (y === 14 && x >= 2 && x <= 3) return [7, ART][x - 2];       // a shore corner beside the art
    return SAND;
  });
  const before = g.map((col) => col.map((t) => t.tileBitfield));
  assert.equal(dryPuddles(g), 0);
  assert.deepEqual(g.map((col) => col.map((t) => t.tileBitfield)), before, 'nothing moved');
});

test('PUDDLE-DRY once a ground, and never from nothing: a second call dries nothing, a puddle with no dry neighbour stays, a random marker is no water and no ground to take (mutants: the once unkept; a marker read as ground)', () => {
  const g = ground((x, y) => (x === 3 && y === 3 ? POOL : SAND));
  assert.equal(dryPuddles(g), 1);
  g[3][3] = ground(() => POOL)[3][3];
  assert.equal(dryPuddles(g), 0, 'a dried ground is not walked again');
  const sea = ground(() => 0);
  assert.equal(dryPuddles(sea), 0, 'all water: a patch, not a puddle');
  const marked = ground((x, y) => (x === 6 && y === 6 ? POOL : 60));   // MeshReader.cs:487's marker all round
  assert.equal(groundTileWet(marked[0][0]), false, 'a marker is no water');
  assert.equal(dryPuddles(marked), 0, 'and no ground to take: the pool stays');
  assert.equal(dryPuddles(null), 0);
});

test('PUDDLE-DRY one door: getBlock serves BLOCKS.BSA\'s block and a world-data mod\'s dried, readClassicBlock keeps the bytes (mutants: either arm undried)', () => {
  const src = read('src/formats/blocksFile.js');
  assert.match(src, /^import \{ dryPuddles \} from '\.\.\/world\/puddleDry\.js';/m);
  assert.match(src, /const dryBlock = \(dfBlock\) => \{ dryPuddles\(dfBlock\?\.rmbBlock\?\.fldHeader\?\.groundData\?\.groundTiles\); return dfBlock; \};/);
  assert.match(src, /return dryBlock\(replacement\);/, 'a mod\'s block');
  assert.match(src, /return dryBlock\(this\._blocks\[block\]\.dfBlock\);/, 'BLOCKS.BSA\'s');
  const classic = src.slice(src.indexOf('  readClassicBlock(block) {'), src.indexOf('  /** Discard a block from memory. */'));
  assert.doesNotMatch(classic, /dry/, 'the diff base is the file\'s');
  // no reader of the ground keeps a puddle law of its own
  for (const f of ['src/world/terrainTiles.js', 'src/scenes/exterior.js', 'src/world/rmbLayout.js', 'src/world/cityNavigation.js']) {
    assert.doesNotMatch(read(f), /dryPuddles|PUDDLE_RECORDS/, `${f} reads the served ground`);
  }
});

test('PUDDLE-DRY on BLOCKS.BSA: every town block served with no lone water tile and no patch of puddle art; the moats and ponds whole; the file\'s own bytes kept (needs ARENA2_PATH)', { skip: !(ARENA2 && existsSync(join(ARENA2, 'BLOCKS.BSA'))) && 'no ARENA2' }, () => {
  const blocks = new BlocksFile();
  blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const PUDDLE = new Set(PUDDLE_RECORDS);
  let rmb = 0, puddles = 0, dried = 0, kept = 0;
  const patchesOf = (g) => {
    const out = [], seen = new Set();
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
      if (seen.has(x * 16 + y) || !groundTileWet(g[x][y])) continue;
      const patch = [], stack = [[x, y]];
      seen.add(x * 16 + y);
      while (stack.length) {
        const [cx, cy] = stack.pop();
        patch.push(g[cx][cy]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && ny >= 0 && nx < 16 && ny < 16 && !seen.has(nx * 16 + ny) && groundTileWet(g[nx][ny])) { seen.add(nx * 16 + ny); stack.push([nx, ny]); }
        }
      }
      out.push(patch);
    }
    return out;
  };
  for (let i = 0; i < blocks.count; i++) {
    if (!/\.RMB$/i.test(blocks.getBlockName(i))) continue;
    rmb++;
    const served = patchesOf(blocks.getBlock(i).rmbBlock.fldHeader.groundData.groundTiles);
    const classic = patchesOf(blocks.readClassicBlock(i).rmbBlock.fldHeader.groundData.groundTiles);
    puddles += served.filter((p) => p.length === 1 || p.every((t) => PUDDLE.has(t.textureRecord))).length;
    dried += classic.length - served.length;
    kept += served.length;
  }
  assert.equal(rmb, 920);
  assert.equal(puddles, 0, 'no puddle served');
  assert.equal(dried, 700, 'the census: 700 puddles dried');
  assert.equal(kept, 611, 'and 611 ponds, basins and moats kept');
  const castle = blocks.getBlockIndex('CASTAA25.RMB');
  const largest = (g) => Math.max(...patchesOf(g).map((p) => p.length));
  assert.equal(largest(blocks.getBlock(castle).rmbBlock.fldHeader.groundData.groundTiles), 202, 'a castle\'s moat, its shore ring with it');
  assert.equal(largest(blocks.readClassicBlock(castle).rmbBlock.fldHeader.groundData.groundTiles), 202, 'whole, as the file lays it');
});
