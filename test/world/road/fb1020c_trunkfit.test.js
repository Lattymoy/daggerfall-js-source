// FIELD BUGS 2026-10-20c TRUNK-FIT (a player on the Discord, 2026-10-20: "Fountain inside a tree in Crossleigh behind a
// house west of The Emperor's Gear Store" - a night screenshot of a fountain standing in a tree).
//
// Crossleigh (Anticlere, the map pixel 401,175) is two blocks, GENRAS01 and RESIAS02 - Beautiful Villages edits the town's
// location file and serves GENRAS01's misc records whole, but the scenery is Daggerfall's own. GENRAS01's ground scenery
// cell [6][14] is TEXTURE.504's tree 12, stood by RMBLayout.AddNatureFlats at (38.40, 12.80) in the block, and its misc
// flat #23 is TEXTURE.212's record 2 - a fountain, a water source of Climates & Calories - at (39.95, 12.50): 1.58 m apart,
// west of the house between them and The Emperor's Gear Store. AddNatureFlats reads no misc flat; DFU stands both, and so
// did the port. With Low Poly Trees on (the default) the tree is the mod's 504_12, whose trunk where it meets the ground
// reaches 3.42 m from its root (its bark cut by the root's plane) - the fountain stood inside it. Not the terrain's scatter:
// Real forests clears the location's whole rect.
//
// TRUNK-FIT (LPT-FIT's sibling, Port-Ledger A): a location's Low Poly tree is drawn no wider than the room its root has
// to the nearest solid flat of its pixel (PROP-BODIES' bodies) over its trunk (world/lptCrowns.js LPT_TRUNKS, baked by
// tools/bakeLptCrowns.mjs lptTrunks). A scale, never a move. Crossleigh's tree is drawn at 0.418 of its prefab, its trunk
// 1.43 m about the root at the ground - short of the fountain's foot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { lptTrunkCap, lptFitCap, LPT_FIT_FLOOR } from '../../../src/world/road/roadVerge.js';
import { LPT_TRUNKS, LPT_CROWNS } from '../../../src/world/lptCrowns.js';
import { lptTrunks } from '../../../tools/bakeLptCrowns.mjs';
import { buildTreeSet, LPT_SET_FLOATS } from '../../../src/world/lowPolyTrees.js';
import { hostText } from '../../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const vendored = () => {
  const json = JSON.parse(read('vendor/low-poly-trees/Trees/trees.json'));
  const bin = readFileSync(new URL('../../../vendor/low-poly-trees/Trees/trees.bin', import.meta.url));
  return { json, bin: new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength) };
};

test('TRUNK-FIT: a prototype\'s trunk is its SOLID part (the sub-meshes the mod culls one-sided, the bark) cut by the root\'s plane, its farthest point from the root under the prefab\'s scale, rounded up; cards alone stand no trunk; the bake is the module\'s (mutants: the cards cut too; the cut a metre up; rounded down; the prefab\'s scale unread)', () => {
  const { json, bin } = vendored();
  assert.deepEqual(lptTrunks(json, bin), { ...LPT_TRUNKS }, 'node tools/bakeLptCrowns.mjs');
  assert.equal(Object.keys(LPT_TRUNKS).length, Object.keys(LPT_CROWNS).length, 'every prototype the crowns know');
  // the temperate woods' trees: 504_12's flared trunk is the widest of them, 3.42 m about its root at the ground
  assert.deepEqual([11, 12, 13, 14, 15, 16, 17, 18, 25].map((r) => LPT_TRUNKS[`504_${r}`]), [1.86, 3.42, 1.58, 1.78, 1.97, 1.22, 1.2, 1.66, 1.18]);
  assert.equal(LPT_TRUNKS['505_12'], LPT_TRUNKS['504_12'], 'the winter tree has the summer\'s trunk');
  // a prototype of two-sided cards alone (a bush, a flower, the swamp's card trees) stands no trunk - its leaves reach the ground
  for (const k of ['500_1', '504_27', '504_28', '501_15']) {
    assert.equal(LPT_TRUNKS[k], 0, `${k}: cards alone`);
    assert.ok(json.prefabs[k].materials.every((m) => (json.materials[m]?.cull ?? 0) === 0), `${k}: every material two-sided`);
  }
  assert.ok(lptTrunks({ ...json, materials: Object.fromEntries(Object.entries(json.materials).map(([k, m]) => [k, { ...m, cull: 2 }])) }, bin)['500_1'] > 0, 'read as solid, its cards would stand one');
  // rounded UP: the cut reaches 3.4165 m
  assert.ok(LPT_TRUNKS['504_12'] >= 3.4165 && LPT_TRUNKS['504_12'] - 3.4165 < 0.01);
  assert.ok(LPT_TRUNKS['504_12'] < LPT_CROWNS['504_12'], 'a trunk is no crown');
});

test('TRUNK-FIT: the cap - a tree drawn no wider than its root\'s room to the nearest solid body (its distance less the body\'s foot) over its trunk, its variety under it; never under LPT-FIT\'s floor; no cap where it fits, with no trunk or no solid thing (mutants: the foot added; the room over the widest; the boundary taken; the floor dropped)', () => {
  const at = (x, z, r) => ({ c: [x, 0, z], r });
  assert.equal(lptTrunkCap([at(10, 0, 0.5)], 0, 0, 2, 1), Infinity, '9.5 m of room for a 2 m trunk');
  assert.equal(lptTrunkCap([at(2.5, 0, 0.5)], 0, 0, 2, 1), Infinity, 'exactly its trunk\'s room: it fits');
  assert.ok(Math.abs(lptTrunkCap([at(2.5, 0, 0.5)], 0, 0, 2, 1.4) - 1) < 1e-12, '...but not at its widest: drawn no wider than 1');
  assert.ok(Math.abs(lptTrunkCap([at(1.5, 0, 0.5), at(0, 9, 0.5)], 0, 0, 2, 1) - 0.5) < 1e-12, 'the nearest body\'s room, 1 m over 2');
  assert.ok(Math.abs(lptTrunkCap([at(0, 1.5, 0.5)], 0, 0, 2, 1) - 0.5) < 1e-12, 'measured across the ground (x and z), whichever way');
  assert.equal(lptTrunkCap([at(0.2, 0, 0.5)], 0, 0, 2, 1), LPT_FIT_FLOOR, 'a root inside a body is a sapling, never nothing');
  assert.equal(lptTrunkCap([at(1, 0, 0.5)], 0, 0, 0, 1), Infinity, 'cards alone: no trunk, no cap');
  assert.equal(lptTrunkCap([at(0.2, 0, 0.5)], 0, 0, 0, 1), Infinity, '...even with its root inside a body');
  assert.equal(lptTrunkCap([], 0, 0, 2, 1), Infinity, 'no solid thing in the pixel');
  assert.equal(lptTrunkCap(null, 0, 0, 2, 1), Infinity);
  // the near set draws the lesser of its variety and its fit, as LPT-FIT's (a location's tree: variety 1)
  const set = buildTreeSet(401, 175, [{ h: 0, centers: [[396.8, 0, 320]], wild: new Uint8Array(1), fit: new Float32Array([lptTrunkCap([at(398.35, 319.7, 0.15)], 396.8, 320, LPT_TRUNKS['504_12'], 1)]) }]);
  assert.ok(Math.abs(set.trees[4] - 0.4182) < 1e-3, `drawn at ${set.trees[4]}`);
  assert.equal(set.trees.length, LPT_SET_FLOATS);
});

test('TRUNK-FIT with ARENA2: the report - Crossleigh\'s GENRAS01 stands TEXTURE.504\'s tree 12 1.58 m from its fountain (212, 2), the fountain\'s body 0.15 m; the tree is drawn at 0.418, its trunk 1.43 m about the root; of the block\'s trees only it and a tree by a crate (205, 27) are fitted, RESIAS02\'s none (mutants: the foot added; the nature archives taken for solid things)', { skip: skipReal }, async () => {
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { TextureFile } = await import('../../../src/formats/textureFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { collectBlockFlats, isNatureArchive, billboardSize } = await import('../../../src/world/rmbFlats.js');
  const { flatBodies } = await import('../../../src/world/propBodies.js');
  const { isWaterSourceFlat } = await import('../../../src/systems/survival/items.js');
  const bytes = (f) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), f)));
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const town = maps.getLocation(21, 659);
  assert.equal(town.name, 'Crossleigh');
  assert.deepEqual(town.exterior.exteriorData.blockNames, ['GENRAS01.RMB', 'RESIAS02.RMB']);
  const tex = new Map();
  const texOf = (a) => {
    if (!tex.has(a)) { const n = `TEXTURE.${String(a).padStart(3, '0')}`; const t = new TextureFile(); t.load(bytes(n), n); tex.set(a, t); }
    return tex.get(a);
  };
  /** A block as standFlatGroups meets it: its flats by group, its solid things' bodies (the pre-pass), each tree's cap. */
  const fitted = (name) => {
    const block = blocks.getBlock(blocks.getBlockIndex(name));
    const groups = new Map();
    for (const f of collectBlockFlats(block, 504)) {
      if (f.editor) continue;
      const k = `${f.archive}_${f.record}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push([f.x, f.y, f.z]);
    }
    const solids = [];
    for (const [k, centers] of groups) {
      const [archive, record] = k.split('_').map(Number);
      if (isNatureArchive(archive)) continue;
      const t = texOf(archive);
      if (record < t.recordCount) solids.push(...flatBodies(t, archive, record, billboardSize(t, record), centers));
    }
    const out = [];
    for (const [k, centers] of groups) {
      if (!k.startsWith('504_')) continue;
      for (const c of centers) {
        const cap = lptTrunkCap(solids, c[0], c[2], LPT_TRUNKS[k] ?? 0, 1);
        if (cap < Infinity) out.push({ k, x: c[0], z: c[2], cap });
      }
    }
    return { block, solids, out };
  };
  const g = fitted('GENRAS01.RMB');
  // the two flats, where AddNatureFlats and AddMiscBlockFlats stand them
  assert.equal(g.block.rmbBlock.fldHeader.groundData.groundScenery[6][14].textureRecord, 12, 'scenery cell (x 6, y 1): the tree');
  const fountain = g.block.rmbBlock.miscFlatObjectRecords[23];
  assert.deepEqual([fountain.textureArchive, fountain.textureRecord, fountain.xPos, fountain.zPos], [212, 2, 1598, -3596]);
  assert.ok(isWaterSourceFlat(212, 2), 'a fountain');
  const d = Math.hypot(1598 * 0.025 - 38.4, (-3596 + 4096) * 0.025 - 12.8);
  assert.ok(Math.abs(d - 1.5788) < 1e-3, `1.58 m from the tree's root (${d})`);
  const body = g.solids.find((s) => Math.abs(s.c[0] - 39.95) < 1e-6 && Math.abs(s.c[2] - 12.5) < 1e-6);
  assert.ok(body && Math.abs(body.r - 0.15) < 1e-3, 'its body: its own measured foot');
  assert.ok(LPT_TRUNKS['504_12'] > d, 'Low Poly Trees\' trunk reaches past the fountain - the report');
  // TRUNK-FIT: drawn at 0.418 - the trunk 1.43 m about the root at the ground, short of the fountain's foot
  assert.deepEqual(g.out.map((t) => [t.k, t.x.toFixed(1), t.z.toFixed(1), t.cap.toFixed(4)]), [['504_18', '70.4', '96.0', '0.6755'], ['504_12', '38.4', '12.8', '0.4178']]);
  assert.ok(LPT_TRUNKS['504_12'] * g.out[1].cap <= d - body.r + 1e-9);
  // LPT-FIT asked nothing of it: no street tile in reach of its crown in the probe's ground (the trunk is the whole cap)
  assert.equal(lptFitCap(null, null, 401, 175, 396.8, 320, LPT_CROWNS['504_12'], 1), Infinity);
  assert.deepEqual(fitted('RESIAS02.RMB').out, [], 'the block beside it stands its trees clear of its things');
});

test('TRUNK-FIT by source: the world host measures the pixel\'s solid things first (PROP-BODIES\' bodies of every flat of no nature archive, at its record\'s size), and draws a location\'s Low Poly tree no wider than its trunk\'s room as well as its crown\'s - its far picture and its near set alike; the wild\'s untouched; LPT-FIT\'s lines as they were (mutants: the pre-pass dropped; the nature archives taken; the wild fitted; the trunk\'s cap the greater)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /if \(isNatureArchive\(archive\)\) continue;\n\s+const t = await getTexture\(archive\);\n\s+if \(record < t\.recordCount\) solids\.push\(\.\.\.flatBodies\(t, archive, record, billboardSize\(t, record\), centers\)\);/, 'the solid things, before any group is stood');
  assert.ok(w.indexOf('const solids = [];') < w.indexOf('const { sib, proto: lpt, far, plain, key: rkey } = await naturePicture('), 'measured before the first tree');
  assert.match(w, /const trunk = LPT_TRUNKS\[lpt\.key\] \?\? 0;/);
  assert.match(w, /const fit = crown > 0 \|\| \(trunk > 0 && solids\.length\) \? new Float32Array\(centers\.length\) : null;/);
  assert.match(w, /if \(fit\) fit\[i\] = lptFitCap\(lptPathMask, g\.vergeNet, g\.px, g\.py, c\[0\], c\[2\], crown, v\);\n(?:\s*\/\/.*\n)*\s*if \(fit && !wild\[i\]\) fit\[i\] = Math\.min\(fit\[i\], lptTrunkCap\(solids, c\[0\], c\[2\], trunk, v\)\);/, 'the lesser of the two fits, a location\'s tree alone');
  assert.match(w, /scales\[i\] = \(fit \? Math\.min\(v, fit\[i\]\) : v\) \/ LPT_SCALE_MAX;/, 'the far picture');
  assert.match(w, /lptGroups\.push\(\{ h: lptHandles\.length - 1, centers, wild, fit \}\);/, 'the near set');
});
