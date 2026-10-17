// KG3 (2026-10-13, bible/11-Multiplayer/Kings-Gambit.md sections 5.3, 10.1, 14.8 and 16): THE KING'S GAMBIT ON THE CLOTH -
// the board's lay on the felt (world/gambitCloth.js: along the table's own axes, its foot at the host's edge, 7.08 cm cells
// from a long side and 6.13 cm from an end, a cell's centre and the cell under a point each other's inverse, column 0 on
// the host's left), each side's cards turned to read from its own chair, and the draw (render/gambitTableDraw.js: the
// atlas - every unit's picture, the four Kings, the back - the mat's quad wound as the renderer winds, the mat painted
// in the house's coat and painted again only when its look changes, the plates scaled to the cell, every allocation
// freed once).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gambitPlaces, gambitCardYaw, GAMBIT_FELT_LONG, GAMBIT_FELT_SHORT, GAMBIT_MAT_LIFT } from '../../../src/world/gambitCloth.js';
import {
  GAMBIT_ATLAS_KEYS, GAMBIT_ATLAS_COLS, GAMBIT_CELL_W, GAMBIT_CELL_H, GAMBIT_ATLAS_W, GAMBIT_ATLAS_H, GAMBIT_CARD_SHARE, GAMBIT_INKS,
  gambitAtlasCell, gambitCellUv, pieceAtlasKey, matModel, paintGambitMat, createGambitTableDraw, GAMBIT_ARCHIVE,
} from '../../../src/render/gambitTableDraw.js';
import { CARD_TABLE_W, CARD_TABLE_D, CARD_TABLE_RAIL } from '../../../src/world/card/cardTableProp.js';
import { KG_COLS, KG_ROWS, KG_ROSTER, KG_TILE, autoFill, KG_POINT_BUDGET } from '../../../src/net/kingsGambit.js';
import { GAMBIT_TIERS, dealRegular } from '../../../src/systems/gambit/gambitPatrons.js';
import { CARD_W } from '../../../src/world/card/cardMotion.js';
import { xorshift } from '../../../tools/kgMeasure.mjs';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const frame = (yaw = Math.PI / 2) => ({ centre: [2, 0.8, -3], axisYaw: yaw, halfLong: CARD_TABLE_W / 2, halfShort: CARD_TABLE_D / 2 });

test('KG3 the board on the felt: from a long side 7.08 cm cells, the columns along the table and the rows across it; from an end 6.13 cm cells, the columns across - the foot always at the host\'s edge, column 0 on the host\'s left (mutants: the cell; the side\'s test; the handedness)', () => {
  assert.ok(near(GAMBIT_FELT_LONG, CARD_TABLE_W - 2 * CARD_TABLE_RAIL) && near(GAMBIT_FELT_SHORT, CARD_TABLE_D - 2 * CARD_TABLE_RAIL));
  const f = frame();
  const long = gambitPlaces(f, [2, 0, -3.9]);   // a long side's chair, across the table's short axis
  assert.equal(long.end, false);
  assert.ok(near(long.cell, GAMBIT_FELT_SHORT / KG_ROWS), `${long.cell}`);
  assert.equal(Math.round(long.cell * 10000) / 100, 7.08, '7.08 cm');
  assert.ok(long.width <= GAMBIT_FELT_LONG + 1e-9 && near(long.depth, GAMBIT_FELT_SHORT), 'the board fits the felt');
  const end = gambitPlaces(f, [3.4, 0, -3]);   // an end's chair, along the long axis
  assert.equal(end.end, true);
  assert.equal(Math.round(end.cell * 10000) / 100, 6.13, '6.13 cm');
  assert.ok(near(end.width, GAMBIT_FELT_SHORT), 'the columns across the short side');
  for (const P of [long, end]) {
    // the foot - the host's king's row - nearest the host
    const foot = P.at(7, KG_ROWS - 1), head = P.at(7, 0);
    const host = P === long ? [2, -3.9] : [3.4, -3];
    assert.ok(Math.hypot(foot[0] - host[0], foot[2] - host[1]) < Math.hypot(head[0] - host[0], head[2] - host[1]), 'the foot at the host\'s edge');
    assert.ok(near(P.top, f.centre[1] + GAMBIT_MAT_LIFT), 'a few millimetres proud of the felt');
    // column 0 on the host's left: facing the board (-toHost), the left is -right; Unity's hand - x right, z forward
    const facing = [-P.toHost[0], -P.toHost[1]];
    assert.deepEqual(P.right.map((x) => Math.round(x * 1e9) / 1e9), [facing[1], -facing[0]].map((x) => Math.round(x * 1e9) / 1e9), 'right is (fz, -fx)');
    const c0 = P.at(0, 6), c14 = P.at(KG_COLS - 1, 6);
    assert.ok((c0[0] - c14[0]) * P.right[0] + (c0[2] - c14[2]) * P.right[1] < 0, 'column 0 to the left');
    // a cell's centre and the cell under a point, each other's inverse; off the board, none
    for (let r = 0; r < KG_ROWS; r++) for (let c = 0; c < KG_COLS; c++) assert.deepEqual(P.cellAt(P.at(c, r)), [c, r]);
    assert.equal(P.cellAt([f.centre[0] + 5, P.top, f.centre[2]]), null);
    assert.equal(P.cellAt(null), null);
    assert.equal(P.corners.length, 4);
  }
  // facing the table from the other long side: the board turns with the chair
  const other = gambitPlaces(f, [2, 0, -2.1]);
  assert.deepEqual(other.toHost.map(Math.round), [-long.toHost[0], -long.toHost[1]].map(Math.round));
});

test('KG3 each side\'s cards read from its own chair: the host\'s top toward the head, the guest\'s toward the foot (mutant: one yaw for both)', () => {
  const P = gambitPlaces(frame(), [2, 0, -3.9]);
  const host = gambitCardYaw(P, 0), guest = gambitCardYaw(P, 1);
  assert.ok(near(Math.abs(host - guest), Math.PI), 'turned to face one another');
  assert.ok(near(Math.sin(guest), P.toHost[0]) && near(Math.cos(guest), P.toHost[1]), 'the guest\'s top toward the host\'s foot');
});

test('KG3 the atlas: every unit\'s picture, the four Kings, the back - each a cell of the card\'s shape, half a texel in, v up; a piece by its key (mutants: a key; the inset)', () => {
  assert.equal(GAMBIT_ATLAS_KEYS.length, KG_ROSTER.length + 5);
  assert.equal(new Set(GAMBIT_ATLAS_KEYS).size, GAMBIT_ATLAS_KEYS.length, 'a cell a key - the Dragonling\'s two rows two keys, each its one card\'s picture');
  assert.ok(GAMBIT_ATLAS_KEYS.includes('u34') && GAMBIT_ATLAS_KEYS.includes('u40'));
  assert.ok(near(GAMBIT_CELL_W / GAMBIT_CELL_H, 64 / 90));
  assert.equal(GAMBIT_ATLAS_W, GAMBIT_CELL_W * GAMBIT_ATLAS_COLS);
  assert.equal(GAMBIT_ATLAS_H, GAMBIT_CELL_H * Math.ceil(GAMBIT_ATLAS_KEYS.length / GAMBIT_ATLAS_COLS));
  assert.deepEqual(gambitAtlasCell('back'), [(GAMBIT_ATLAS_KEYS.length - 1) % GAMBIT_ATLAS_COLS, Math.floor((GAMBIT_ATLAS_KEYS.length - 1) / GAMBIT_ATLAS_COLS)]);
  const [u0, v0, u1, v1] = gambitCellUv([0, 0]);
  assert.ok(near(u0, 0.5 / GAMBIT_ATLAS_W) && near(u1, (GAMBIT_CELL_W - 0.5) / GAMBIT_ATLAS_W) && near(v1, 1 - 0.5 / GAMBIT_ATLAS_H), 'half a texel in, v up');
  assert.equal(pieceAtlasKey({ king: true, side: 1, unit: 143 }, [3, 0]), 'k0', 'a king by its side\'s crown');
  assert.equal(pieceAtlasKey({ king: false, side: 0, unit: 41 }, [3, 0]), 'u41');
});

test('KG3 the mat\'s quad over the board\'s corners, wound as the renderer winds - cross(b - a, c - a) up - from either side of the table (mutant: a triangle turned)', () => {
  // PIN MOVED (KG4, Kings-Gambit.md section 17): the mat is a slab now - its top a quad a cell over the board's corners,
  // every one facing up; its four edges stand down to the felt (test/world/kg4_board.test.js holds them, and the recess)
  for (const feet of [[2, 0, -3.9], [2, 0, -2.1], [3.4, 0, -3], [0.6, 0, -3]]) {
    const P = gambitPlaces(frame(), feet);
    const m = matModel(P);
    const pos = (i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
    let tops = 0;
    const xs = [], zs = [];
    for (let t = 0; t < m.indices.length; t += 3) {
      if (m.normals[m.indices[t] * 3 + 1] < 0.9) continue;   // a slab's edge
      const [a, b, c] = [pos(m.indices[t]), pos(m.indices[t + 1]), pos(m.indices[t + 2])];
      const ux = b[0] - a[0], uz = b[2] - a[2], vx = c[0] - a[0], vz = c[2] - a[2];
      assert.ok(uz * vx - ux * vz > 0, `${feet}: triangle ${t / 3} faces up`);
      for (const q of [a, b, c]) { xs.push(q[0]); zs.push(q[2]); }
      tops++;
    }
    assert.equal(tops, 2 * KG_COLS * KG_ROWS);
    const cx = P.corners.map((q) => q[0]), cz = P.corners.map((q) => q[2]);
    assert.ok(near(Math.min(...xs), Math.min(...cx), 1e-6) && near(Math.max(...xs), Math.max(...cx), 1e-6) && near(Math.min(...zs), Math.min(...cz), 1e-6) && near(Math.max(...zs), Math.max(...cz), 1e-6), 'over the board\'s corners');
    assert.equal(m.subMeshes[0].textureArchive, GAMBIT_ARCHIVE);
  }
});

test('KG3 the mat painted in the house\'s coat: every cell its layout\'s tone, the marks of 14.8 each edged in the kit\'s outline (mutants: the outline; the guest\'s notch)', () => {
  const rnd = xorshift(5);
  const st = dealRegular({ army: autoFill([], KG_POINT_BUDGET, rnd), tier: GAMBIT_TIERS[1], rand32: rnd });
  const calls = [];
  const ctx = new Proxy({}, { get: (_, k) => (k === 'setLineDash' ? (d) => calls.push(['dash', d.length]) : (...a) => calls.push([k, ...a])), set: (_, k, v) => { calls.push([`=${String(k)}`, v]); return true; } });
  paintGambitMat(ctx, { layout: st.layout, tiles: st.tiles, hazards: st.hazards, pieces: st.pieces, selected: st.pieces[0].id, lit: [[7, 9]], range: [[7, 8]], targets: [st.pieces.at(-1).id], cursor: [3, 3], staged: { col: 7, row: 9 } });
  const strokes = calls.filter((c) => c[0] === '=strokeStyle').map((c) => c[1]);
  assert.ok(strokes.filter((x) => x === GAMBIT_INKS.outline).length >= st.pieces.length, 'every side\'s mark edged in the kit\'s outline');
  assert.ok(strokes.includes(GAMBIT_INKS.brass) && strokes.includes(GAMBIT_INKS.blood) && strokes.includes(GAMBIT_INKS.stone) && strokes.includes(GAMBIT_INKS.bone));
  const fills = calls.filter((c) => c[0] === 'fillRect').length;
  assert.ok(fills >= KG_COLS * KG_ROWS, 'every cell painted');
  assert.ok(st.tiles.some((t) => t !== KG_TILE.floor) || st.layout === 'open-field');
  // a side by its shape (14.8): the host's mark a whole ring, the guest's its corners cut - outline and ink each
  const mark = (side) => {
    const seen = [];
    const c2 = new Proxy({}, { get: (_, k) => (...a) => seen.push(k), set: () => true });
    paintGambitMat(c2, { layout: 'open-field', tiles: new Array(KG_COLS * KG_ROWS).fill(KG_TILE.floor), hazards: [], pieces: [{ id: 1, side, col: 3, row: 3 }] });
    return (k) => seen.filter((x) => x === k).length;
  };
  const host = mark(0), guest = mark(1);
  assert.deepEqual([host('rect'), host('moveTo')], [2, 0], 'the host\'s ring whole');
  assert.deepEqual([guest('rect'), guest('moveTo')], [0, 8], 'the guest\'s notched: four sides a path');
});

test('KG3 the draw: nothing until a board; the atlas and the mat made once, the plates once a kind, scaled to their cell; the mat painted again only when its look changes - the old picture let go first (the cache keeps a key\'s first); all freed once (mutants: the release; the scale; a plate a draw)', () => {
  // PIN MOVED (KG4, section 17): the atlas comes with its hurt and healed tints and the effects' atlas beside it, and the
  // board is built - its stands, its stone and its bars are meshes of their own (test/world/kg4_board.test.js holds them)
  const made = [], freed = [], released = [], uploads = [], drawn = [];
  const own = { measureText: (t) => ({ width: String(t).length * 5 }), getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) };
  const ctx = new Proxy(own, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
  const doc = { createElement: () => ({ getContext: () => ctx }) };
  const renderer = { createMesh: (m) => { made.push(m); return { m }; }, drawMesh: (m, mat) => drawn.push([m, mat]), destroyMesh: (m) => freed.push(m), uploadTexture: (a, r) => uploads.push([a, r]), releaseTexture: (a, r) => released.push([a, r]) };
  const d = createGambitTableDraw(renderer, { doc });
  d.draw({ places: null, look: null, crowns: [3, 0] });
  assert.equal(made.length, 0);
  const rnd = xorshift(3);
  const st = dealRegular({ army: autoFill([], KG_POINT_BUDGET, rnd), tier: GAMBIT_TIERS[0], rand32: rnd });
  const places = gambitPlaces(frame(), [2, 0, -3.9]);
  const look = { layout: st.layout, tiles: st.tiles, hazards: st.hazards, pieces: st.pieces.map((p) => ({ id: p.id, side: p.side, col: p.col, row: p.row, king: p.king, unit: p.unit })), selected: null, lit: [], range: [], targets: [], cursor: null, staged: null };
  d.draw({ places, look, crowns: [3, 0] });
  const kinds = new Set(look.pieces.map((p) => pieceAtlasKey(p, [3, 0])));
  const onAtlas = (m) => m.subMeshes[0].textureRecord === 'atlas';
  assert.equal(made.filter(onAtlas).length, kinds.size, 'a plate a kind');
  assert.equal(made.filter((m) => m.subMeshes[0].textureRecord === 'mat').length, 1, 'the mat once');
  assert.deepEqual(uploads.map((u) => u[1]), ['atlas', 'atlas-hurt', 'atlas-glow', 'fx', 'mat']);
  const plates = drawn.filter((x) => onAtlas(x[0].m));
  assert.equal(plates.length, look.pieces.length, 'a card a piece');
  const plateMat = plates[0][1];
  const s = (GAMBIT_CARD_SHARE * places.cell) / CARD_W;
  assert.ok(near(Math.hypot(plateMat[0], plateMat[1], plateMat[2]), s, 1e-5), 'a plate scaled to its cell');
  const n = made.length;
  d.draw({ places, look, crowns: [3, 0] });
  assert.equal(uploads.length, 5, 'the same look: nothing painted again');
  d.draw({ places, look: { ...look, cursor: [1, 1] }, crowns: [3, 0] });
  assert.deepEqual(uploads.map((u) => u[1]).slice(5), ['mat'], 'a new look: the mat painted again');
  assert.deepEqual(released, [[GAMBIT_ARCHIVE, 'mat']], 'its old picture let go first');
  assert.equal(made.length, n, 'no mesh made again');
  d.destroy(); d.destroy();
  assert.equal(freed.length, made.length, 'every mesh, once');
  assert.deepEqual(released.slice(1).map((x) => x[1]).sort(), ['atlas', 'atlas-glow', 'atlas-hurt', 'fx', 'mat']);
  d.draw({ places, look, crowns: [3, 0] });
  assert.equal(made.length, n, 'nothing made after the end');
  const bare = createGambitTableDraw({}, { doc });
  assert.doesNotThrow(() => bare.draw({ places, look, crowns: [3, 0] }), 'a renderer without the path draws nothing');
});
