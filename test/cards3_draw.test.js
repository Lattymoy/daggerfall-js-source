// CARDS3 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 3): THE CARDS' BODIES ON THE GL. Driven: the atlas's
// cells (a card's rank and suit, the back for a card nobody may see) and their UVs; the plate - its face's corners on its
// cell the right way round for the port's mirrored world (the cell's left at -X, its top at +Z: AUDIT-by-eye, the
// first cut drew every face mirrored), every quad wound counter-clockwise about its normal (the renderer's front - the
// first cut wound them the other way and showed every card's back from above), its size the poker card's; the chip's
// drum likewise; the matrix's yaw and roll; and the draw's whole life on a fake renderer - the atlas uploaded once
// under the key drawMesh reads, 52 faces, a back and five chips made once, each card drawn with its own mesh, and every
// one of them freed, once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCard } from '../src/net/cardLaw.js';
import { CARD_W, CARD_L, CARD_T, CHIP_R, CHIP_T, CHIP_VALUES } from '../src/world/cardMotion.js';
import {
  CARD_ARCHIVE, CARD_RECORD, CARD_CELL_W, CARD_CELL_H, ATLAS_W, ATLAS_H, CELL_BACK, CELL_STOCK, CHIP_SIDES,
  atlasCell, chipCell, cellUv, cardModel, chipModel, cardMatrix, createCardTableDraw,
} from '../src/render/cardTableDraw.js';

const r6 = (v) => Math.round(v * 1e6) / 1e6;
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vert = (m, i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];

test('CARDS3 the atlas: a card\'s cell its rank and suit, the back for the unseen, the UVs inset and the right way up', () => {
  assert.deepEqual([CARD_CELL_W, CARD_CELL_H, ATLAS_W, ATLAS_H], [64, 90, 832, 450]);
  assert.deepEqual(atlasCell(parseCard('2c')), [0, 0]);
  assert.deepEqual(atlasCell(parseCard('As')), [12, 3]);
  assert.deepEqual(atlasCell(parseCard('Td')), [8, 1]);
  assert.deepEqual(atlasCell(-1), [0, 4], 'the back');
  assert.deepEqual([CELL_BACK, CELL_STOCK, chipCell(0), chipCell(4)], [[0, 4], [1, 4], [2, 4], [6, 4]]);
  // the top-left cell's UVs: its left edge near u 0, its TOP near v 1 (the upload's color32 order puts the top at v 1)
  const [u0, v0, u1, v1] = cellUv([0, 0]);
  assert.deepEqual([r6(u0), r6(u1), r6(v1), r6(v0)], [r6(0.5 / ATLAS_W), r6((CARD_CELL_W - 0.5) / ATLAS_W), r6(1 - 0.5 / ATLAS_H), r6(1 - (CARD_CELL_H - 0.5) / ATLAS_H)]);
  const [, bv0, , bv1] = cellUv([0, 4]);
  assert.ok(bv0 > 0 && bv1 < 1 - 4 * CARD_CELL_H / ATLAS_H + 1e-9, 'the fifth row is the atlas\'s bottom');
});

test('CARDS3 the plate: the poker card\'s size, its face on its cell the right way round, every quad facing out', () => {
  const m = cardModel(atlasCell(parseCard('Kh')));
  const xs = [], ys = [], zs = [];
  for (let i = 0; i < m.positions.length; i += 3) { xs.push(m.positions[i]); ys.push(m.positions[i + 1]); zs.push(m.positions[i + 2]); }
  assert.deepEqual([r6(Math.max(...xs) - Math.min(...xs)), r6(Math.max(...ys) - Math.min(...ys)), r6(Math.max(...zs) - Math.min(...zs))], [CARD_W, CARD_T, CARD_L]);
  assert.equal(m.indices.length, 36, 'six quads');
  assert.deepEqual(m.subMeshes, [{ textureArchive: CARD_ARCHIVE, textureRecord: CARD_RECORD, startIndex: 0, primitiveCount: 12 }]);
  // every triangle wound counter-clockwise about its stated normal (the right hand's - the renderer's front)
  for (let i = 0; i < m.indices.length; i += 3) {
    const [a, b, c] = [m.indices[i], m.indices[i + 1], m.indices[i + 2]];
    const n = [m.normals[a * 3], m.normals[a * 3 + 1], m.normals[a * 3 + 2]];
    assert.ok(dot(cross(sub(vert(m, b), vert(m, a)), sub(vert(m, c), vert(m, a))), n) > 0, `triangle ${i / 3} faces its normal`);
  }
  // the face (+Y): the cell's LEFT at -X and its TOP at +Z - the port's world is Unity's left-handed axes drawn through
  // a mirror, so from above with +Z away +X runs right and the face reads unmirrored
  const [fu0, fv0, fu1, fv1] = cellUv(atlasCell(parseCard('Kh')));
  for (let i = 0; i < 4; i++) {
    const [x, y, z] = vert(m, i);
    assert.equal(y > 0, true);
    assert.equal(r6(m.uvs[i * 2]), r6(x < 0 ? fu0 : fu1), `face corner ${i}: u by x`);
    assert.equal(r6(m.uvs[i * 2 + 1]), r6(z < 0 ? fv0 : fv1), `face corner ${i}: v by z`);
  }
  // the back (-Y) on the back's cell
  const [bu0, bv0, bu1, bv1] = cellUv(CELL_BACK);
  for (let i = 4; i < 8; i++) {
    assert.ok(vert(m, i)[1] < 0);
    assert.ok([r6(bu0), r6(bu1)].includes(r6(m.uvs[i * 2])) && [r6(bv0), r6(bv1)].includes(r6(m.uvs[i * 2 + 1])));
  }
});

test('CARDS3 the chip: a drum CHIP_R round and CHIP_T tall, every triangle facing out', () => {
  const m = chipModel(2);
  const ys = [];
  let rmax = 0;
  for (let i = 0; i < m.positions.length; i += 3) { ys.push(m.positions[i + 1]); rmax = Math.max(rmax, Math.hypot(m.positions[i], m.positions[i + 2])); }
  assert.deepEqual([r6(Math.max(...ys) - Math.min(...ys)), r6(rmax)], [CHIP_T, CHIP_R]);
  assert.equal(m.indices.length / 3, CHIP_SIDES * 4, 'two fans and a side of two triangles a step');
  for (let i = 0; i < m.indices.length; i += 3) {
    const [a, b, c] = [m.indices[i], m.indices[i + 1], m.indices[i + 2]];
    const mid = [0, 1, 2].map((k) => (vert(m, a)[k] + vert(m, b)[k] + vert(m, c)[k]) / 3);
    const out = Math.abs(mid[1]) > CHIP_T / 2 - 1e-9 && Math.hypot(mid[0], mid[2]) < CHIP_R * 0.99 ? [0, Math.sign(mid[1]), 0] : [mid[0], 0, mid[2]];
    assert.ok(dot(cross(sub(vert(m, b), vert(m, a)), sub(vert(m, c), vert(m, a))), out) > 0, `chip triangle ${i / 3} faces out`);
  }
});

test('CARDS3 a card\'s matrix: its place, its yaw about the vertical, its roll about its length', () => {
  const m = cardMatrix([1, 2, 3], Math.PI / 2, Math.PI);
  assert.deepEqual([m[12], m[13], m[14]], [1, 2, 3]);
  // the card's length (+Z) turned by the yaw: forward = [sin yaw, 0, cos yaw]
  assert.deepEqual([r6(m[8]), r6(m[9]), r6(m[10])].map((v) => v + 0), [1, 0, 0]);
  // rolled over: its face (+Y) points down
  assert.deepEqual([r6(m[4]), r6(m[5]), r6(m[6])].map((v) => v + 0), [0, -1, 0]);
});

test('CARDS3 the draw\'s life: the atlas once under drawMesh\'s key, the meshes once, each card its own, all freed once', () => {
  const made = [], drawn = [], destroyed = [], uploaded = [], released = [];
  const renderer = {
    createMesh: (model) => { const mesh = { id: made.length, model }; made.push(mesh); return mesh; },
    uploadTexture: (a, r, c32) => uploaded.push([a, r, c32.width, c32.height, c32.colors.length]),
    drawMesh: (mesh, matrix) => drawn.push([mesh.id, matrix[12]]),
    destroyMesh: (m) => destroyed.push(m.id),
    releaseTexture: (a, r) => released.push([a, r]),
  };
  const ctx = new Proxy({}, { get: (_, k) => (k === 'getImageData' ? (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
  const doc = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  const d = createCardTableDraw(renderer, { doc });
  assert.equal(made.length, 0, 'nothing made until the first draw');
  d.draw({ cards: [{ card: parseCard('As'), pos: [5, 0.8, 0], yaw: 0, roll: 0 }, { card: -1, pos: [6, 0.8, 0], yaw: 0, roll: Math.PI }], chips: [{ value: 25, pos: [7, 0.8, 0] }, { value: 3, pos: [8, 0, 0] }] });
  assert.deepEqual(uploaded, [[CARD_ARCHIVE, CARD_RECORD, ATLAS_W, ATLAS_H, ATLAS_W * ATLAS_H * 4]], 'the atlas once, keyed as drawMesh reads it (no #ui variant)');
  assert.equal(made.length, 52 + 1 + CHIP_VALUES.length);
  assert.deepEqual(drawn, [[parseCard('As'), 5], [52, 6], [53 + CHIP_VALUES.indexOf(25), 7]], 'the ace its own face, the unseen card the back, the 25 its chip; a value no chip has, nothing');
  d.draw({ cards: [], chips: [] });
  assert.equal(made.length, 58, 'made once');
  d.destroy();
  assert.equal(destroyed.length, 58, 'every mesh freed');
  assert.deepEqual(released, [[CARD_ARCHIVE, CARD_RECORD]]);
  d.destroy();
  d.draw({ cards: [{ card: 0, pos: [0, 0, 0], yaw: 0, roll: 0 }] });
  assert.equal(destroyed.length, 58, 'freed once; a destroyed draw draws nothing');
  assert.equal(drawn.length, 3);
  // a renderer without the path draws nothing and throws nothing
  createCardTableDraw({}, { doc }).draw({ cards: [{ card: 0, pos: [0, 0, 0], yaw: 0, roll: 0 }] });
});

test('CARDS3 the interior host: the cloth\'s picture made with the deal, fed every event, drawn in the room\'s pass, freed with the table', () => {
  const src = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const body = (name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n  }\n', src.indexOf(`function ${name}(`)));
  assert.match(body('openCardGame'), /draw: createCardTableDraw\(renderer\)/, 'the draw is the table\'s, made with it');
  assert.match(body('cardPress'), /game\.scene = cardSceneFor\(game\.session\);/, 'the picture is made with the deal\'s session');
  assert.match(body('cardGameFrame'), /g\.scene\?\.onEvent\(e, holeOf\);/, 'every event the session says reaches the picture');
  assert.match(body('closeCardGame'), /g\.draw\?\.destroy\(\);/, 'the atlas and the meshes go with the table');
  assert.ok(body('closeCardGame').indexOf('cardGame = null;') < body('closeCardGame').indexOf('g.draw?.destroy();'), 'the slot emptied first');
  // the player in the seat they took; the regulars round the rest in order
  assert.match(body('cardSceneFor'), /s\.kind === 'player' \? cardSeat\.seat : others\[i - 1\]/);
  assert.match(src, /const cardHoleOf = \(session\) => \(seat, r\) => \{\n\s+const v = session\.view\(\)/, 'the holes the player may see come from their own view');
  // drawn in the room's own pass, after the solid room's models and the decor's
  const draw = src.indexOf('if (cardGame?.scene) cardDrawGame(cardGame, proj, view, mwv.eye);');
  assert.ok(draw > src.indexOf('decorTool.drawMounts(renderer);') && draw < src.indexOf('interiorCtx.flatAnims.tick(dt);'));
});
