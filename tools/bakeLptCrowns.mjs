// THE LOW POLY TREES' CROWNS, baked from the vendored mod into a module the world reads.
//
//     node tools/bakeLptCrowns.mjs
//
// VERGE1 (2026-10-07, Mac: "Making sure objects, like trees, avoid pathways and roads. Currently they slightly
// overlap"). A wilderness flat keeps its whole footprint off the roads (world/road/roadVerge.js), and where Low Poly Trees
// stands a tree for it the footprint is that tree's crown - 5 to 11 metres about the trunk in the temperate woods,
// against a classic picture's few. Where the flats stand must not hang on the mod's switch (it is the player's own
// online: it draws the trees, it never moves them - systems/online/onlineLane.js), so the crowns are read here, off the
// vendored files, into a table every client has whether or not it draws the trees.
//
// A crown is the farthest any vertex of the prototype's mesh reaches from its root across the ground (x and z, under
// the prefab's own scale) - a disc, because DFU turns each tree at random (world/lowPolyTrees.js lptVariety). Rounded
// UP to the centimetre, so the table is never short of the mesh. test/world/road/verge1.test.js re-runs the bake and holds the
// module to it byte for byte.
import { readFileSync, writeFileSync } from 'node:fs';
import { isMain } from './lib/isMain.mjs';

export const SOURCE = 'vendor/low-poly-trees/Trees';
export const OUT = 'src/world/lptCrowns.js';
/** The floats a vertex of trees.bin (position, normal, uv) - world/lowPolyTrees.js renderImpostor's stride. */
const VERTEX_FLOATS = 8;

/**
 * Every prototype's crown (m), keyed `ARCHIVE_RECORD` as trees.json keys its prefabs.
 * @param {any} json trees.json @param {Uint8Array} bin trees.bin
 * @returns {Record<string, number>}
 */
export function lptCrowns(json, bin) {
  const f = new Float32Array(bin.buffer, bin.byteOffset, json.vertexBytes / 4);
  /** @type {Record<string, number>} */
  const out = {};
  for (const [key, p] of Object.entries(json.prefabs)) {
    const m = json.meshes[p.mesh];
    const [sx, , sz] = p.scale;
    let reach = 0;
    for (let v = 0; v < m.vertices; v++) {
      const o = (m.vertex + v) * VERTEX_FLOATS;
      reach = Math.max(reach, Math.hypot(f[o] * sx, f[o + 2] * sz));
    }
    out[key] = Math.ceil(reach * 100) / 100;
  }
  return out;
}

/**
 * FB1020c TRUNK-FIT: every prototype's TRUNK where it meets the ground (m), keyed as lptCrowns'. The trunk is the
 * prototype's SOLID part - the sub-meshes whose material the mod draws one-sided (`cull` 2: the bark and the limbs; its
 * two-sided cards, `cull` 0, are leaves and undergrowth, world/lowPolyTrees.js's own reading of a sub-mesh's material) -
 * cut by the ground plane (y = 0, the root's): the farthest point of the cut from the root across the ground, under the
 * prefab's own scale, rounded UP to the centimetre, so the table is never short of the mesh. 0 for a prototype of cards
 * alone (a bush, a flower, the swamp's card trees) or one whose solid part never meets the ground. world/road/roadVerge.js
 * lptTrunkCap draws a location's tree no wider than the room its root has to the town's own solid things by it.
 * @param {any} json trees.json @param {Uint8Array} bin trees.bin
 * @returns {Record<string, number>}
 */
export function lptTrunks(json, bin) {
  const f = new Float32Array(bin.buffer, bin.byteOffset, json.vertexBytes / 4);
  const ix = new Uint16Array(bin.buffer, bin.byteOffset + json.vertexBytes, (bin.byteLength - json.vertexBytes) >> 1);
  /** @type {Record<string, number>} */
  const out = {};
  for (const [key, p] of Object.entries(json.prefabs)) {
    const m = json.meshes[p.mesh];
    const [sx, sy, sz] = p.scale;
    const mats = p.materials ?? [];
    let reach = 0;
    m.subs.forEach(([at, count], i) => {
      if ((json.materials[mats[Math.min(i, mats.length - 1)]]?.cull ?? 0) === 0) return;   // a card: leaves, not a trunk
      for (let t = at; t + 2 < at + count; t += 3) {
        for (let e = 0; e < 3; e++) {
          const a = (m.vertex + ix[m.index + t + e]) * VERTEX_FLOATS, b = (m.vertex + ix[m.index + t + ((e + 1) % 3)]) * VERTEX_FLOATS;
          const ya = f[a + 1] * sy, yb = f[b + 1] * sy;
          if (ya * yb > 0 || ya === yb) continue;   // the edge does not cross the ground (one lying in it is its neighbours' ends)
          const k = ya / (ya - yb);
          reach = Math.max(reach, Math.hypot((f[a] + (f[b] - f[a]) * k) * sx, (f[a + 2] + (f[b + 2] - f[a + 2]) * k) * sz));
        }
      }
    });
    out[key] = Math.ceil(100 * reach) / 100;   // UP: a trunk the table holds is never short of the mesh
  }
  return out;
}

/** A table's rows, in trees.json's own key order (archive, then record), one prototype a line. */
const tableRows = (table) => Object.keys(table).sort((a, b) => {
  const [aa, ar] = a.split('_').map(Number), [ba, br] = b.split('_').map(Number);
  return aa - ba || ar - br;
}).map((k) => `  '${k}': ${table[k]},`);

/** The module's text: the table in trees.json's own key order, one prototype a line. */
export function bakeLptCrowns(json, bin) {
  const rows = tableRows(lptCrowns(json, bin));
  return [
    '// GENERATED by tools/bakeLptCrowns.mjs from vendor/low-poly-trees/Trees (SquidKamer\'s LowpolyTrees 5, LPT1) - do not edit.',
    '// VERGE1: each prototype\'s CROWN - the farthest its mesh reaches from the root across the ground, metres, under the',
    '// prefab\'s own scale and before the tree\'s own (lptVariety) - rounded up to the centimetre. world/road/roadVerge.js keeps a',
    '// wilderness flat\'s footprint off the roads by it, on every client, whether or not that client draws the trees.',
    '/** @type {Readonly<Record<string, number>>} */',
    'export const LPT_CROWNS = Object.freeze({',
    ...rows,
    '});',
    '',
    '// FB1020c TRUNK-FIT: each prototype\'s TRUNK where it meets the ground - its solid (one-sided, `cull` 2) sub-meshes cut by',
    '// the root\'s plane, the farthest point of the cut from the root, metres, under the prefab\'s own scale - rounded up to the',
    '// centimetre; 0 for cards alone. world/road/roadVerge.js lptTrunkCap keeps a town\'s tree\'s trunk off its own solid things.',
    '/** @type {Readonly<Record<string, number>>} */',
    'export const LPT_TRUNKS = Object.freeze({',
    ...tableRows(lptTrunks(json, bin)),
    '});',
    '',
  ].join('\n');
}

if (isMain(import.meta.url)) {
  const json = JSON.parse(readFileSync(`${SOURCE}/trees.json`, 'utf8'));
  const bin = readFileSync(`${SOURCE}/trees.bin`);
  const text = bakeLptCrowns(json, new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength));
  writeFileSync(OUT, text);
  console.log(`${OUT}: ${Object.keys(json.prefabs).length} crowns and trunks`);
}
