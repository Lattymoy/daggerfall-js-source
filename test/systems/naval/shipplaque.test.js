// SHIP-PLAQUE (2026-10-17, the owner: "the ability to have a name plaque on the ship itself for those who want to show off
// their ship name"; bible/03-World/Naval-Refit.md SHIP-PLAQUE) - her name on her bows: the lettering (Daggerfall's FONT0003
// through its glyphs, the block letters where it is not to be had) and the board's picture; the board laid on every hull's
// planking where it is drawn - each port ship's and the mod's own - flush, under her rail, reading the right way from
// alongside; the boards made and let go; the ledger, the Fleet's act and page, the boats' word, a peer's board and the
// pool drawing hers in her hull's frame. tools/mutants/shipplaque.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAQUE_ARCHIVE, PLAQUE_STANDOFF, PLAQUE_SCALE, PLAQUE_PAD, PLAQUE_FRAME, PLAQUE_BREADTH, PLAQUE_AFT_SHARE, PLAQUE_IDLE_DRAWS,
  PLAQUE_LETTER_MIN, PLAQUE_LETTER_MAX, BLOCK_LETTERS, fntLetters, nameWidth, paintPlaque, plankingOf, railOf, bowStation, plaqueOnBow,
  letterOf, createShipPlaques,
} from '../../../src/scenes/comeSailAway/shipPlaque.js';
import { FntFile, FNT_GLYPH_COUNT } from '../../../src/formats/fntFile.js';
import { hullBuild } from '../../../src/systems/naval/navalShips.js';
import { Boat } from '../../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { createComeSailAwayPool } from '../../../src/scenes/comeSailAway/comeSailAwayPool.js';
import { createFleetHost } from '../../../src/scenes/fleetHost.js';
import { fleetBook, fleetShip, knowShip, titleDeed, titleOf, renameShip, setShipPlaque, fleetSaveData, restoreFleetSaveData, _resetFleetForTests } from '../../../src/systems/fleet.js';
import { mintDeed, mintBoatItem } from '../../../src/systems/comeSailAway/comeSailAwayItems.js';
import { csaWireRecord, validCsaRecord } from '../../../src/systems/comeSailAway/comeSailAwayWire.js';
import { drawFleetPage, resetFleetPage } from '../../../src/ui/fleetPage.js';
import { setHoldingsProvider, _setHoldingsIconForTests } from '../../../src/ui/holdingsPages.js';
import { freshPool, modShipsPool } from '../../navalSea.mjs';
import { scene, terrain } from '../../csaScene.mjs';
import { hostText } from '../../hostText.mjs';
import { quatEuler } from '../../../src/world/unityAnimator.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const tick = () => new Promise((r) => setTimeout(r, 0));
const at = (pic, x, y) => { const i = (y * pic.width + x) * 4; return [pic.data[i], pic.data[i + 1], pic.data[i + 2]]; };
const gilt = (c) => c[0] > 180 && c[1] > 130 && c[2] < 140;

/** A FONT0003-shaped file of `widths` (glyph i its width; its pixels a bar `w` wide on rows 1 to 5). */
function fntBytes(fixedWidth = 6, fixedHeight = 7) {
  const head = 4 + FNT_GLYPH_COUNT * 4, bytes = new Uint8Array(head + FNT_GLYPH_COUNT * 32);
  const v = new DataView(bytes.buffer);
  v.setUint16(0, fixedWidth, true); v.setUint16(2, fixedHeight, true);
  for (let i = 0; i < FNT_GLYPH_COUNT; i++) {
    const off = head + i * 32;
    v.setUint16(4 + i * 4, off, true); v.setUint16(4 + i * 4 + 2, 4, true);
    for (let y = 1; y <= 5; y++) bytes[off + y * 2 + 1] = 0xf0;   // the left four pixels lit (the odd byte is the left half)
  }
  return bytes;
}

test('SHIP-PLAQUE the lettering and the picture: the block letters (a small letter its capital, a space three); FONT0003 through its glyphs - its height, its space the fixed width less one, each glyph its width and pixels; a name\'s run with a pixel between; the board dark planed wood in a raised frame, the name in gilt PLAQUE_SCALE texels a font pixel, its cut\'s shadow; none for a name with nothing to cut (mutants: the space, the spacing, the scale, the gilt, the frame)', () => {
  assert.equal(BLOCK_LETTERS.height, 7);
  assert.equal(BLOCK_LETTERS.widthOf(65), 5);
  assert.deepEqual([BLOCK_LETTERS.lit(97, 1, 0), BLOCK_LETTERS.lit(97, 0, 0)], [true, false], 'a small letter its capital');
  assert.deepEqual([BLOCK_LETTERS.lit(65, 1, 0), BLOCK_LETTERS.lit(65, 0, 0)], [true, false], 'A\'s apex');
  assert.equal(BLOCK_LETTERS.widthOf(126), 0, 'a mark it has none for');
  assert.equal(nameWidth('AB', BLOCK_LETTERS), 11, 'five, a pixel, five');
  assert.equal(nameWidth('A B', BLOCK_LETTERS), 5 + 1 + 3 + 1 + 5);
  const fnt = fntLetters(new FntFile().load(fntBytes()));
  assert.deepEqual([fnt.height, fnt.space, fnt.widthOf(65)], [7, 5, 4]);
  assert.deepEqual([fnt.lit(65, 0, 1), fnt.lit(65, 3, 3), fnt.lit(65, 4, 3), fnt.lit(65, 0, 0)], [true, true, false, false]);
  assert.deepEqual([fnt.widthOf(20), fnt.lit(20, 0, 1), fnt.widthOf(400)], [0, false, 0], 'below its first glyph, past its last');
  const pic = paintPlaque('AB', BLOCK_LETTERS);
  assert.deepEqual([pic.width, pic.height], [11 * PLAQUE_SCALE + 2 * PLAQUE_PAD, 7 * PLAQUE_SCALE + 2 * PLAQUE_PAD]);
  assert.equal(pic.data.length, pic.width * pic.height * 4);
  assert.ok(gilt(at(pic, PLAQUE_PAD + 1 * PLAQUE_SCALE + 1, PLAQUE_PAD + 1)), 'A\'s apex in gilt');
  assert.ok(!gilt(at(pic, PLAQUE_PAD + 1, PLAQUE_PAD + 1)), 'beside it the board');
  assert.ok(gilt(at(pic, PLAQUE_PAD + (5 + 1 + 3) * PLAQUE_SCALE + 1, PLAQUE_PAD + 1)), 'B\'s top bar to its fourth pixel, a pixel past A');
  assert.ok(!gilt(at(pic, PLAQUE_PAD + (5 + 1 + 4) * PLAQUE_SCALE + 1, PLAQUE_PAD + 1)), 'and not its fifth');
  assert.deepEqual([at(pic, 0, 0), at(pic, 1, PLAQUE_FRAME + 4), at(pic, pic.width - 2, PLAQUE_FRAME + 4)], [[28, 17, 9], [96, 64, 32], [28, 17, 9]], 'the frame: its outer edge dark, its face lit, its far side in shadow');
  const board = at(pic, PLAQUE_FRAME + 2, PLAQUE_FRAME + 2);
  assert.ok(board[0] < 90 && board[0] >= 40 && board[2] < 40, 'dark wood');
  for (let i = 3; i < pic.data.length; i += 4) assert.equal(pic.data[i], 255, 'opaque');
  assert.equal(paintPlaque('  ', BLOCK_LETTERS), null);
  assert.equal(paintPlaque(null, BLOCK_LETTERS), null);
  assert.deepEqual(paintPlaque('AB', BLOCK_LETTERS).data, pic.data, 'the same on every machine');
});

/** A ray's first hit on mesh `m` - its distance, or null. */
function hitDistance(m, o, d) {
  const p = m.positions, ix = m.indices;
  let best = null;
  for (let i = 0; i < ix.length; i += 3) {
    const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3;
    const e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], e2 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
    const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
    const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (Math.abs(det) < 1e-12) continue;
    const f = 1 / det, s = [o[0] - p[a], o[1] - p[a + 1], o[2] - p[a + 2]];
    const u = f * (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]); if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
    const v = f * (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]); if (v < 0 || u + v > 1) continue;
    const t = f * (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]);
    if (t > 1e-6 && (best == null || t < best)) best = t;
  }
  return best;
}
/** A board checked on her: flush (each vertex PLAQUE_STANDOFF off her planking, inward along its normal), under her rail,
 *  in her bows, its triangles facing out, reading the right way from her side. */
function boardOn(name, m, b, side, g) {
  assert.ok(g, `${name} ${side}: a board`);
  const P = g.positions, N = g.normals, UV = g.uvs, n = P.length / 3;
  const L = b.bowZ - b.aftZ;
  for (let k = 0; k < n; k++) {
    const p = [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]], nn = [N[k * 3], N[k * 3 + 1], N[k * 3 + 2]];
    assert.ok(nn[0] * side > 0, `${name}: her side's normal faces out`);
    const d = hitDistance(m, p, nn.map((v) => -v));
    assert.ok(d != null && Math.abs(d - PLAQUE_STANDOFF) < 0.005, `${name} ${side}: flush, ${d}`);
    assert.ok(p[2] >= b.aftZ + PLAQUE_AFT_SHARE * L - 1e-6 && p[2] <= b.bowZ, `${name}: in her bows (${p[2]})`);
    assert.ok(p[1] > 0.15, 'above her waterline');
  }
  const ix = g.indices;
  for (let i = 0; i < ix.length; i += 3) {
    const a = ix[i] * 3, bb = ix[i + 1] * 3, c = ix[i + 2] * 3;
    const u = [P[bb] - P[a], P[bb + 1] - P[a + 1], P[bb + 2] - P[a + 2]], v = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    assert.ok((u[1] * v[2] - u[2] * v[1]) * side > 0, `${name}: each triangle counter-clockwise about her outward side`);
  }
  // the fore end's u: 1 to starboard (seen from there her bow is to the right - the board reads aft to bow), 0 to port
  let fore = 0;
  for (let k = 1; k < n; k++) if (P[k * 3 + 2] > P[fore * 3 + 2]) fore = k;
  assert.equal(UV[fore * 2], side > 0 ? 1 : 0, `${name} ${side}: read from alongside`);
  // v 1 along her top edge: toColor32 lays her picture bottom row first (formats/color32Order.js), so v 1 is its top row
  let high = 0, low = 0;
  for (let k = 1; k < n; k++) { if (P[k * 3 + 1] > P[high * 3 + 1]) high = k; if (P[k * 3 + 1] < P[low * 3 + 1]) low = k; }
  assert.deepEqual([UV[high * 2 + 1], UV[low * 2 + 1]], [1, 0], `${name} ${side}: right way up`);
  const top = Math.max(...Array.from({ length: n }, (_, k) => P[k * 3 + 1]));
  for (let z = Math.min(...Array.from({ length: n }, (_, k) => P[k * 3 + 2])); z <= Math.max(...Array.from({ length: n }, (_, k) => P[k * 3 + 2])); z += 0.3) {
    assert.ok(top <= railOf(m, b, side, z, 0.05) + 0.06, `${name}: under her rail at ${z.toFixed(1)}`);
  }
}

test('SHIP-PLAQUE on every port ship\'s bows: her planking found (never a gunport, a shroud, an oar station or her rudder), a board each side - flush on her flare, under her rail, in her bows aft of the stem\'s turn, facing out and reading the right way from alongside, the two sides a mirror; her letters PLAQUE_LETTER of her length, bounded; a long name cut smaller to her bow\'s room (mutants: the planking, the standoff, the rail, the breadth, the bows\' share, the winding, the reading)', async () => {
  const pool = await freshPool();
  const pic = paintPlaque("Sea Wolf's Fang", BLOCK_LETTERS);
  const aspect = pic.width / pic.height, share = (7 * PLAQUE_SCALE) / pic.height;
  const PLANKING = { 0: 'Dingy', 1: 'NewLargeBoat', 2: 'NewGalleon', 3: 'Trireme', 4: 'NewCarrack' };
  for (const hull of [0, 1, 2, 3, 4]) {
    const s = pool.hullSurface(hull), b = hullBuild(hull);
    const i = plankingOf(s, b);
    assert.equal(s[i].name, PLANKING[hull], `hull ${hull}'s planking`);
    const letter = letterOf(b);
    assert.ok(letter >= PLAQUE_LETTER_MIN && letter <= PLAQUE_LETTER_MAX);
    const boards = [];
    for (const side of [1, -1]) {
      const st = bowStation(s[i], b, side);
      assert.ok(st && st.zFore < b.bowZ, `hull ${hull}: aft of her stem`);
      const g = plaqueOnBow(s[i], b, side, aspect, share, st);
      boardOn(`hull ${hull}`, s[i], b, side, g);
      const foreX = Math.max(...Array.from({ length: g.positions.length / 3 }, (_, k) => (g.positions[k * 3 + 2] >= st.zFore - 1e-6 ? Math.abs(g.positions[k * 3]) : 0)));
      assert.ok(foreX >= PLAQUE_BREADTH * b.halfWidth * 0.9, `hull ${hull}: aft of the stem's turn, where her bow is broad (${foreX.toFixed(2)} of ${b.halfWidth})`);
      assert.ok(Math.abs(g.height * share - letter) < 1e-9 || g.length < g.height * aspect + 1e-9, 'her letters, or cut to her bow');
      boards.push(g);
    }
    for (let k = 0; k < boards[0].positions.length; k += 3) assert.ok(Math.abs(boards[0].positions[k] + boards[1].positions[k]) < 0.15, `hull ${hull}: a mirror`);
  }
  // a long name: cut smaller to her bow's room, never aft of her bows
  const s = pool.hullSurface(1), b = hullBuild(1), m = s[plankingOf(s, b)];
  const long = paintPlaque('The Very Long Name Of Her', BLOCK_LETTERS);
  const g = plaqueOnBow(m, b, 1, long.width / long.height, (7 * PLAQUE_SCALE) / long.height);
  boardOn('a long name', m, b, 1, g);
  assert.ok(g.height < letterOf(b) / ((7 * PLAQUE_SCALE) / long.height) - 1e-6, 'cut smaller');
  // her rail found to within its step, halved past the coarse steps (a wall 1.5 m high: the steps last meet it at 1.35)
  const wall = { positions: new Float64Array([1, 0, -5, 1, 1.5, -5, 1, 1.5, 5, 1, 0, 5]), indices: new Uint16Array([0, 1, 2, 0, 2, 3]) };
  const rail = railOf(wall, { halfWidth: 1, deck: 1, bowZ: 5, aftZ: -5 }, 1, 0, 0.05);
  assert.ok(rail > 1.45 && rail <= 1.5, `her rail ${rail}`);
  assert.equal(railOf(wall, { halfWidth: 1, deck: 1, bowZ: 5, aftZ: -5 }, 1, 9, 0.05), -Infinity, 'no side there');
  // a side wound either way (a classic model's are not all one way): her normals out, the board the same
  const wallB = { halfWidth: 1, deck: 1, bowZ: 5, aftZ: -5 }, station = { zFore: 4, letter: 0.3, dy: 0.05 };
  const outer = plaqueOnBow(wall, wallB, 1, aspect, share, station);
  const inward = plaqueOnBow({ ...wall, indices: new Uint16Array([0, 2, 1, 0, 3, 2]) }, wallB, 1, aspect, share, station);
  assert.ok(outer && Array.from(outer.normals).every((v, k) => (k % 3 === 0 ? v === 1 : v === 0)), 'out from her side');
  const plain = (xs) => Array.from(xs, (v) => v + 0);   // a flipped zero is a zero
  assert.deepEqual([plain(inward.normals), plain(inward.positions)], [plain(outer.normals), plain(outer.positions)], 'wound inward, the same');
  // her planking the nearest of her meshes, never a bulkhead behind it that comes first in her list
  const bulkhead = { positions: wall.positions.map((v, k) => (k % 3 === 0 ? 0.5 : v)), indices: wall.indices };
  assert.equal(plankingOf([bulkhead, wall], wallB), 1);
  // no room: none
  assert.equal(plaqueOnBow(m, b, 1, aspect, share, null), null);
  assert.equal(plaqueOnBow(null, b, 1, aspect, share), null);
  assert.equal(plaqueOnBow(m, b, 1, 0, share), null);
  assert.equal(bowStation({ positions: new Float64Array(9), indices: new Uint16Array([0, 1, 2]) }, b, 1), null, 'no side to lay it on');
  assert.ok(PLAQUE_BREADTH > 0 && PLAQUE_BREADTH < 1);
});

test('SHIP-PLAQUE on the mod\'s own Carrack and Large Boat (the port ships\' models fallen back): her planking found and a board laid each side as on a port ship (mutants: the planking)', async () => {
  const { pool, restore } = await modShipsPool();
  try {
    const pic = paintPlaque('Gull', BLOCK_LETTERS);
    for (const hull of [1, 4]) {
      const s = pool.hullSurface(hull), b = hullBuild(hull);
      const m = s[plankingOf(s, b)];
      for (const side of [1, -1]) boardOn(`the mod's hull ${hull}`, m, b, side, plaqueOnBow(m, b, side, pic.width / pic.height, (7 * PLAQUE_SCALE) / pic.height));
    }
  } finally { restore(); }
});

/** A renderer that keeps what it is handed. */
function recordingRenderer() {
  const r = { up: new Map(), released: [], made: [], destroyed: [], draws: [] };
  return Object.assign(r, {
    uploadTexture: (a, rec, c, opts) => r.up.set(`${a}_${rec}`, { c, opts }), releaseTexture: (a, rec) => r.released.push(`${a}_${rec}`), uploadEmissionTexture() {},
    createMesh: (model) => { const m = { model, buffers: [{}, {}], bounds: [0, 0, 0, 0], subMeshes: model.subMeshes.map((s) => ({ ...s })) }; r.made.push(m); return m; },
    drawMesh: (gpu, m, remap) => r.draws.push({ gpu, m, remap }), updateMeshVertices() {}, createBillboardBatch: (archive, record, size, centers, opts) => ({ archive, record, size, centers, opts }),
    destroyBillboardBatch() {}, destroyMesh: (m) => r.destroyed.push(m),
  });
}

test('SHIP-PLAQUE the boards made and let go: her two meshes once a hull and a name, the name\'s picture once under PLAQUE_ARCHIVE (opaque) for every hull that shows it; none while the lettering is still coming, none for a renderer without meshes; a board not drawn for PLAQUE_IDLE_DRAWS lets go of its meshes and a name none shows of its picture (mutants: the cache, the picture once, the wait, the sweep)', async () => {
  const pool = await freshPool();
  const r = recordingRenderer();
  let letters = null;
  const plaques = createShipPlaques({ renderer: r, surfaceOf: (h) => pool.hullSurface(h), buildOf: (h) => hullBuild(h), letters: () => letters });
  const boat = { hull: 2 };
  assert.deepEqual(plaques.meshesFor(boat, 'Gull'), [], 'the lettering still coming');
  letters = BLOCK_LETTERS;
  const two = plaques.meshesFor(boat, 'Gull');
  assert.equal(two.length, 2, 'a board each bow');
  assert.equal(two[0].subMeshes[0].textureArchive, PLAQUE_ARCHIVE);
  assert.equal(r.up.size, 1);
  assert.equal([...r.up.values()][0].opts.opaque, true);
  assert.equal(plaques.meshesFor(boat, 'Gull'), two, 'made once');
  assert.equal(plaques.meshesFor({ hull: 4 }, 'Gull').length, 2);
  assert.equal(r.up.size, 1, 'her name\'s picture once, whatever her hull');
  assert.deepEqual(plaques.meshesFor(boat, ''), []);
  assert.deepEqual(createShipPlaques({ renderer: {}, surfaceOf: () => null, buildOf: () => null, letters: () => BLOCK_LETTERS }).meshesFor(boat, 'Gull'), [], 'no meshes to make');
  for (let i = 0; i <= PLAQUE_IDLE_DRAWS; i++) { plaques.sweep(); if (i % 100 === 0) plaques.meshesFor(boat, 'Gull'); }
  assert.equal(r.destroyed.length, 2, 'the Carrack\'s board let go; the Galleon\'s, drawn, kept');
  for (let i = 0; i < PLAQUE_IDLE_DRAWS + 240; i++) plaques.sweep();
  assert.equal(r.destroyed.length, 4, 'and hers, once undrawn');
  assert.deepEqual(r.released, [`${PLAQUE_ARCHIVE}_0`], 'her name\'s picture given back');
});

const fileFetch = async (url) => {
  const bytes = readFileSync(fileURLToPath(url));
  return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
};
const standIn = () => {
  const texture = () => ({ recordCount: 100, getSize: () => ({ width: 40, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  return { getTexture: async () => texture(), uploadRecord() {}, getGpuMesh: async (id) => ({ classic: id }) };
};

test('SHIP-PLAQUE over the real pool: a boat of mine shows the name her ledger says, a peer\'s her owner\'s word\'s, a sea ship none - each board drawn in her hull\'s frame with her paint; lettered in FONT0003 once its bytes are in, in block letters where they will not load (mutants: mine, the peer\'s, the frame, the font, its fallback)', async () => {
  const r = recordingRenderer();
  let mine = 'Gull', bytes = fntBytes();
  const pool = createComeSailAwayPool({ renderer: r, pipeline: standIn(), fetchFn: fileFetch, log: { warn() {} }, plaqueOf: () => mine, plaqueFont: async () => bytes });
  assert.equal(await pool.preload(), true);
  const boat = pool.spawnNow(Object.assign(new Boat(2, 0), { uid: 7 }), { position: [5, 0, 9], rotation: [0, 0, 0, 1] });
  const boards = () => r.draws.filter((d) => d.gpu.subMeshes?.[0]?.textureArchive === PLAQUE_ARCHIVE);
  pool.draw(r);
  assert.equal(boards().length, 0, 'the lettering still coming');
  await tick(); await tick();
  boat.GameObject.position = [5, 0, 9];
  boat.MeshObject.localRotation = quatEuler(3, 0, -8);   // her heel and pitch: her boards ride her MeshObject
  r.draws.length = 0;
  pool.draw(r);
  assert.equal(boards().length, 2, 'her two boards');
  const m = boards()[0].m;
  const her = Array.from(boat.MeshObject.worldMatrix());
  assert.deepEqual(Array.from(m).map((v) => Math.round(v * 1e6) / 1e6), her.map((v) => Math.round(v * 1e6) / 1e6), 'in her hull\'s frame');
  assert.ok(Math.abs(her[12] - 5) < 1e-6 && Math.abs(her[14] - 9) < 1e-6, 'where she lies');
  assert.ok(Math.abs(her[1]) > 0.05 || Math.abs(her[6]) > 0.05, 'heeled, as her hull is');
  const up = [...r.up.entries()].filter(([k]) => k.startsWith(`${PLAQUE_ARCHIVE}_`));
  assert.equal(up.length, 1);
  assert.equal(up[0][1].c.width, (4 * 4 + 3) * PLAQUE_SCALE + 2 * PLAQUE_PAD, 'FONT0003\'s widths: Gull is four glyphs four pixels wide, a pixel between');
  mine = null;
  r.draws.length = 0;
  pool.draw(r);
  assert.equal(boards().length, 0, 'taken down');
  for (let i = 0; i <= PLAQUE_IDLE_DRAWS; i++) pool.draw(r);
  assert.equal(r.destroyed.filter((x) => x.subMeshes?.[0]?.textureArchive === PLAQUE_ARCHIVE).length, 2, 'and let go, undrawn (the pool sweeps them)');
  const peer = pool.spawnPeerNow(Object.assign(new Boat(4, 0), { uid: 9, plaqueName: 'Tern' }));
  const sea = pool.spawnSeaNow(Object.assign(new Boat(2, 0), { plaqueName: 'Nobody' }));
  r.draws.length = 0;
  pool.draw(r);
  assert.equal(boards().length, 2, 'the peer\'s by her word; a sea ship none');
  pool.remove(peer); pool.remove(sea);
  // a font that will not load: block letters
  const r2 = recordingRenderer();
  const pool2 = createComeSailAwayPool({ renderer: r2, pipeline: standIn(), fetchFn: fileFetch, log: { warn() {} }, plaqueOf: () => 'Gull', plaqueFont: async () => { throw new Error('no ARENA2'); } });
  assert.equal(await pool2.preload(), true);
  pool2.spawnNow(Object.assign(new Boat(1, 0), { uid: 8 }), { position: [0, 0, 0], rotation: [0, 0, 0, 1] });
  pool2.draw(r2);
  await tick(); await tick();
  pool2.draw(r2);
  const up2 = [...r2.up.entries()].filter(([k]) => k.startsWith(`${PLAQUE_ARCHIVE}_`));
  assert.equal(up2.length, 1);
  assert.equal(up2[0][1].c.width, (5 * 4 + 3) * PLAQUE_SCALE + 2 * PLAQUE_PAD, 'block letters');
});

test('SHIP-PLAQUE the ledger, the Fleet and the word: a named ship\'s alone, a name taken off taking her board, kept in the save (a refused name\'s never); the Fleet\'s act shows and takes it down (an unnamed ship told to name her first) and her word said again; the page\'s button; the boats\' word `p` while one shows hers, read back to her name, never a reason to drop the word; a peer\'s board her name (mutants: the name\'s gate, the save, the act, the button, the word, its reader)', () => {
  _resetFleetForTests();
  _setHoldingsIconForTests(() => ({ src: 'data:x', w: 30, h: 30 }));
  globalThis.document = undefined;
  knowShip(41, 2, 0, 100); knowShip(42, 1, 0, 100);
  assert.equal(setShipPlaque(41, true), false, 'unnamed: none to show');
  renameShip(41, 'Gull');
  assert.equal(setShipPlaque(41, 'yes'), false);
  assert.equal(setShipPlaque(41, true), true);
  assert.equal(fleetShip(41).plaque, true);
  assert.equal(fleetSaveData().ships.find((s) => s.uid === 41).plaque, true);
  assert.equal('plaque' in fleetSaveData().ships.find((s) => s.uid === 42), false, 'none: nothing said');
  renameShip(41, '');
  assert.equal(fleetShip(41).plaque, false, 'her name taken off, her board with it');
  renameShip(41, 'Gull'); setShipPlaque(41, true);
  const save = fleetSaveData();
  restoreFleetSaveData({ ...save, ships: save.ships.map((s) => (s.uid === 42 ? { ...s, plaque: true } : s)) });
  assert.deepEqual([fleetShip(41).plaque, fleetShip(42).plaque], [true, false], 'kept; an unnamed ship\'s never');
  // the Fleet's act and page
  const s = scene({ terrains: [terrain(10, 20)] });
  let uid = 7000, changed = 0;
  s.deps.items = { create: (t) => mintBoatItem(t, ++uid), addToPlayer: () => {}, player: () => [], titles: () => fleetBook(), retitle: (boat) => !!boat };
  s.deps.isPortTown = () => true;
  titleDeed(mintDeed(2, 0, 41, 1000)); titleDeed(mintDeed(1, 0, 42, 1000));
  s.rt.SummonBoat(41, titleOf(41), fleetBook(), [100, 34, 200], [0, 0, 1], s.terrains[0]);
  const host = createFleetHost({
    csa: () => s.rt, naval: () => null, pack: () => [], gold: () => 0, pay: () => {}, accounts: () => [], regionName: () => '',
    where: () => ({ inside: false, pixel: { X: 10, Y: 20 }, feet: [100, 34, 200] }), nearPort: () => true, nearestPort: () => null, terrainAt: () => s.terrains[0],
    changed: () => { changed++; }, openHold: () => true,
  });
  const row = (u) => host.model().ships.find((x) => x.uid === u);
  assert.deepEqual([row(41).plaque, row(41).named, row(42).named], [true, true, false]);
  assert.deepEqual([host.act(42, 'plaque', true).ok, host.act(42, 'plaque', true).text], [false, 'Give the ship a name first.']);
  const off = host.act(41, 'plaque', false);
  assert.deepEqual([off.ok, off.text, fleetShip(41).plaque, changed], [true, 'Ship name hidden.', false, 1]);
  const on = host.act(41, 'plaque', true);
  assert.deepEqual([on.ok, on.text, fleetShip(41).plaque], [true, 'Ship name shown on the bow.', true]);
  assert.equal(host.act(41, 'plaque', 'x').ok, false, 'no choice');
  const el = (tag, cls, text) => {
    const n = { tag, children: [], attrs: {}, title: '', className: cls ?? '', innerHTML: '', style: { setProperty() {} }, _t: text == null ? '' : String(text), setAttribute(k, v) { n.attrs[k] = v; }, append(...c) { n.children.push(...c); } };
    Object.defineProperty(n, 'textContent', { get: () => n._t + n.children.map((c) => c.textContent ?? '').join(''), set: (v) => { n._t = String(v); } });
    return n;
  };
  const all = (root, pred) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (pred(c)) out.push(c); walk(c); } }; walk(root); return out; };
  setHoldingsProvider({ fleet: { model: () => host.model(), offer: (u) => host.offer(u), act: (u, v, a) => host.act(u, v, a) } });
  resetFleetPage();
  const draw = () => { const d = el('div', 'px-qdetail'); drawFleetPage(d, () => {}, { el, divider: (t) => el('h4', null, t), meter: () => el('div') }); return d; };
  let d = draw();
  const hide = all(d, (c) => c.tag === 'button' && c.textContent === 'Hide name');
  assert.equal(hide.length, 1, 'shown: take it down');
  const show = all(d, (c) => c.tag === 'button' && c.textContent === 'Show name');
  assert.equal(show.length, 1, 'the unnamed ship\'s');
  assert.equal(show[0].attrs['aria-disabled'], 'true');
  assert.equal(show[0].title, 'Give the ship a name first.');
  hide[0].onclick();
  assert.equal(fleetShip(41).plaque, false, 'through the act');
  d = draw();
  assert.equal(all(d, (c) => c.tag === 'button' && c.textContent === 'Show name').length, 2);
  setHoldingsProvider(null);
  // the word
  const v = (o) => ({ hull: 2, variant: 0, position: [0, 0, 0], rotation: [0, 0, 0, 1], sails: 0, helm: false, light: false, name: 'Gull', ...o });
  const rec = csaWireRecord([v({ plaque: true }), v({ name: '', plaque: true }), v({ plaque: false })]);
  assert.deepEqual(rec.p, [1, 0, 0], 'a named boat\'s alone');
  assert.equal('p' in csaWireRecord([v({ plaque: false })]), false, 'none shown: none said');
  const back = validCsaRecord(rec);
  assert.deepEqual(back.boats.map((b) => !!b.plaque), [true, false, false]);
  assert.equal(validCsaRecord({ ...rec, p: [1] }).boats.some((b) => b.plaque), false, 'a list not one a boat: none');
  assert.deepEqual(validCsaRecord({ ...rec, p: [1, 1, 1] }).boats.map((b) => !!b.plaque), [true, false, true], 'an unnamed boat\'s never');
  assert.equal(validCsaRecord({ ...rec, p: 'x' }).boats.length, 3, 'never dropped for it');
  // a peer's board, the world's wiring
  const peers = readFileSync(new URL('../../../src/scenes/comeSailAway/comeSailAwayPeers.js', import.meta.url), 'utf8');
  assert.equal((peers.match(/plaqueName = w\.plaque \? w\.name \?\? '' : ''/g) ?? []).length, 2, 'a peer\'s board her name - built and said again');
  const world = hostText('src/scenes/world.js');
  assert.match(world, /plaqueOf: \(boat\) => \{ const r = boat\.uid \? fleetShip\(boat\.uid\) : null; return r\?\.plaque && r\.name \? r\.name : null; \}, plaqueFont: \(\) => fetchBytes\('FONT0003\.FNT'\) \}\);/);
  assert.match(world, /plaque: !!\(b\.uid && fleetShip\(b\.uid\)\?\.plaque\),   \/\/ SHIP-PLAQUE: her name on her bows/);
});
