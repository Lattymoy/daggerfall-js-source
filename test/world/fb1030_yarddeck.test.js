// FIELD BUGS 2026-10-30b WALL-TOUCH and YARD-DECK (bible/01-Overview/bugs/Field-Bugs-2026-10-30b.md section 2).
// "Trying to place lighting and other objects on the outside of home ... Outside wall is considered in the house" and
// "This area is considered inside the house instead of yard ... Please mark it as yard area" (a flat roof, a balcony).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as homeYards from '../../src/scenes/homeYards.js';
import { createDecorPlacer, DECOR_WALL_CLIP } from '../../src/systems/decor/decorPlacer.js';
import { TextureFile } from '../../src/formats/textureFile.js';
import { billboardSize } from '../../src/world/rmbFlats.js';
import { localAabb, transformedAabb } from '../../src/render/frustum.js';
import { trs } from '../../src/world/mat4.js';
import { skipReal, game, ARENA2 } from '../lwRealTown.mjs';

const { modelFootRects, modelFootParts, footRectsAt, footGroundAt, yardLot, yardWhyNot, yardJoinLots, YARD_IN_HOUSE, YARD_TOO_HIGH, YARD_MARGIN, YARD_STOREY_RISE, YARD_DECK_MIN } = homeYards;

/** A model of upright quads `walls` ([x0, z0, x1, z1, y0, y1]) and flat quads `flats` ([x0, z0, x1, z1, y]), wound
 *  so a flat faces up (as Daggerfall's roofs are). */
function model(walls, flats) {
  const P = [], I = [];
  const quad = (a, b, c, d) => { const n = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  for (const [x0, z0, x1, z1, y0, y1] of walls) quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0]);
  for (const [x0, z0, x1, z1, y] of flats) quad([x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]);
  return { positions: new Float32Array(P), indices: new Uint32Array(I) };
}
/** The four sides of [x0, z0, x1, z1] between heights y0 and y1. */
const ring = ([x0, z0, x1, z1], y0, y1) => [[x0, z0, x1, z0, y0, y1], [x1, z0, x1, z1, y0, y1], [x1, z1, x0, z1, y0, y1], [x0, z1, x0, z0, y0, y1]];
const CHAIR = [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]];
const square = (r) => [[-r, -r], [r, -r], [r, r], [-r, r]];
const octagon = (r) => Array.from({ length: 8 }, (_, i) => [r * Math.cos((i * Math.PI) / 4), r * Math.sin((i * Math.PI) / 4)]);
/** A lot from models stood at the origin, as pixelBuild.js frames a home (`m` one model or several). */
function lotOf(m) {
  const ms = Array.isArray(m) ? m : [m], place = trs(0, 0, 0, 0, 0, 0);
  const boxes = ms.map((q) => transformedAabb(localAabb(q.positions), place));
  const box = [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b[i]))).concat([3, 4, 5].map((i) => Math.max(...boxes.map((b) => b[i]))));
  const parts = ms.map((q) => modelFootParts(q.positions, q.indices));
  return yardLot([0, 0, 0], box, YARD_MARGIN, parts.flatMap((p) => footRectsAt(p.rects, place)), { grounds: parts.map((p) => footGroundAt(p, place)) });
}
/** A 6 x 10 house from x 0 east, 3 m to its eaves, its roof hanging 0.55 past every wall (its cells reach 0.15 past x 0). */
const HOUSE = model(ring([0, -5, 6, 5], 0, 3), [[-0.55, -5.55, 6.55, 5.55, 3.5]]);

test('WALL-TOUCH a piece set against its own house\'s wall is the yard\'s - its ground may reach the wall\'s clip past the wall\'s own line, never further; a lot whose walls are not measured, a thin post, a mate\'s house are the house wherever met (mutants: no touch allowed; the touch unbounded; the measured ground judged as the wall; a lot unmeasured let through; AUDIT FB1030 Y1, Y2)', () => {
  const lot = lotOf(HOUSE);
  assert.ok(lot.walls.some((r) => r[0] < -0.1), 'the measured ground stands past the wall');   // a cell whose middle is inside
  assert.equal(yardWhyNot([-0.3, 0, 2], lot, [], CHAIR), null, 'a chair touching the wall');
  assert.equal(yardWhyNot([-0.25, 0, 2], lot, [], CHAIR), null, 'a chair sat into it by the clip');
  assert.equal(yardWhyNot([-0.15, 0, 2], lot, [], CHAIR), YARD_IN_HOUSE, 'reaching 0.15 past the wall');
  assert.equal(yardWhyNot([0.1, 0, 2], lot), YARD_IN_HOUSE, 'a point 0.1 in');
  assert.equal(yardWhyNot([-0.1, 0, 2], lot), null, 'a point under the eave');
  assert.equal(yardWhyNot([3, 0, 0], lot, [], CHAIR), YARD_IN_HOUSE, 'inside');
  // AUDIT FB1030 Y1: a lot with no measured walls (its box; an Imperial City house's door) - meeting it is in it
  const boxed = { house: [0, -5, 6, 5], walls: [[0, -5, 6, 5]], lot: [-6, -11, 12, 11], y: 0 };
  assert.equal(yardWhyNot([-0.2, 0, 2], boxed, [], CHAIR), YARD_IN_HOUSE, 'its box, met 0.1 past its edge');
  assert.equal(yardWhyNot([-0.36, 0, 2], boxed, [], CHAIR), null, 'touching it');
  // AUDIT FB1030 Y2: a step before the door, outside the walls - judged by its own ground, as HOME-FOOT had it
  const stepped = model(ring([0, -5, 6, 5], 0, 3), [[-0.55, -5.55, 6.55, 5.55, 3.5], [-1.2, -1, 0, 1, 0.3]]);
  const sl = lotOf(stepped);
  assert.equal(yardWhyNot([-0.6, 0.3, 0], sl, [], square(0.2)), YARD_IN_HOUSE, 'a crate on the step');
  assert.equal(yardWhyNot([-0.25, 0.3, 0], sl, [], square(0.2)), YARD_IN_HOUSE, 'and against the wall on it');
  assert.equal(yardWhyNot([-0.3, 0, 3], sl, [], CHAIR), null, 'a chair against the wall beside it');
  // AUDIT FB1030 Y2: a 0.4 m post beside it, a model of its own - a chair on it is in it, beside it is not
  const post = model(ring([-3, 1.8, -2.6, 2.2], 0, 2.5), [[-3, 1.8, -2.6, 2.2, 2.5]]);
  const withPost = lotOf([HOUSE, post]);
  assert.equal(yardWhyNot([-2.8, 0, 2], withPost, [], CHAIR), YARD_IN_HOUSE, 'astride the post');
  assert.equal(yardWhyNot([-3.3, 0, 2], withPost, [], CHAIR), null, 'touching the post');
  // the touch is the house's own: a neighbour's ground keeps the edge's 5 cm
  assert.equal(yardWhyNot([-0.2, 0, -8], lot, [[-0.4, -10, 0, -6]], [[-0.1, -0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, 0.1]]), homeYards.YARD_ON_OTHER, 'a neighbour\'s ground is not touched');
  // YARD-JOINED: a mate's ground is the owner's house too, met as a box's is
  const joined = yardJoinLots(lot, [{ walls: [[-4, 6, -1, 9]] }]);
  assert.equal(yardWhyNot([-0.65, 0, 7], joined, [], CHAIR), null, 'touching the mate');
  assert.equal(yardWhyNot([-0.8, 0, 7], joined, [], CHAIR), YARD_IN_HOUSE, 'into the mate');
});

test('WALL-TOUCH a flat set on the outside wall by the placer stands in the yard - its ground is the circle of half its width, as the placer stands it off the wall, a diagonal wall too; not half its picture\'s diagonal (mutants: the diagonal\'s foot; a square\'s; the touch unbounded; AUDIT FB1030 Y8)', () => {
  const lot = lotOf(HOUSE);
  const lamp = { key: 'f210.27', model: null, flat: [210, 27], name: 'Lantern', kind: 'light', storage: false, light: null };
  const size = { w: 0.5, h: 1 };
  const placer = () => createDecorPlacer(lamp, { radius: Math.hypot(size.w, size.h) / 2, flat: size });
  const p = placer().pieceAt([0, 1.5, 2], [0, 0, 0], 'l', [-1, 0, 0], 0);
  assert.equal(yardWhyNot(p.pos, lot, [], octagon(size.w / 2)), null, 'hung on the wall: the yard');
  assert.equal(yardWhyNot(p.pos, lot, [], square(Math.hypot(size.w, size.h) / 2)), YARD_IN_HOUSE, 'the diagonal\'s ground put it in the house');
  // a wall turned 45 degrees: a square's corner reaches through it, the circle stands clear
  const diamond = model([[0, -4, 4, 0, 0, 3], [4, 0, 0, 4, 0, 3], [0, 4, -4, 0, 0, 3], [-4, 0, 0, -4, 0, 3]], []);
  const P = Array.from(diamond.positions), I = Array.from(diamond.indices), n = P.length / 3;
  P.push(0, 3.5, -4, -4, 3.5, 0, 0, 3.5, 4, 4, 3.5, 0); I.push(n, n + 1, n + 2, n, n + 2, n + 3);   // its roof, the diamond
  const dl = lotOf({ positions: new Float32Array(P), indices: new Uint32Array(I) });
  const h = Math.SQRT1_2, q = placer().pieceAt([2, 1.5, -2], [0, 0, 0], 'l', [h, 0, -h], 0);
  assert.equal(yardWhyNot(q.pos, dl, [], octagon(size.w / 2)), null, 'hung on the diagonal wall');
  assert.equal(yardWhyNot(q.pos, dl, [], square(size.w / 2)), YARD_IN_HOUSE, 'a square\'s corner through it');
  const tool = readFileSync(new URL('../../src/scenes/decor/decorTool.js', import.meta.url), 'utf8');
  assert.match(tool, /const r = \(p\.flatSize\?\.w > 0 \? p\.flatSize\.w \/ 2 : p\.radius \?\? 0\) \* s;\n\s*return r > 0 \? Array\.from\(\{ length: 8 \}, \(_, i\) => \[r \* Math\.cos\(\(i \* Math\.PI\) \/ 4\), r \* Math\.sin\(\(i \* Math\.PI\) \/ 4\)\]\) : \[\];/, 'the tool\'s footprintOf: the circle of half a flat\'s width');
  assert.match(tool, /return Object\.assign\(corners, \{ bottom: m\.box\[1\] \* s \}\);/, 'a model\'s foot under its origin (AUDIT FB1030 Y5)');
  assert.match(tool, /if \(why && \(next\.model != null \|\| why !== whyNotHere\(\{ piece: cur, radius \}\)\)\) \{ deps\.say\?\.\(why\); return false; \}/, 'a flat\'s turn refused only for what it did not stand in already, a model\'s whenever (AUDIT FB1030 M3)');
});

test('YARD-DECK every level roof facing up inside the ground floor\'s walls is a deck: a piece whose foot stands on it is the yard\'s, under it the house\'s; inside walls standing YARD_STOREY_RISE over it, whatever their foot, the house\'s; a roof over it is still a deck; a parapet is no storey; a stair\'s tread is no deck; the yard\'s height still holds (mutants: no decks; the storey unasked; a parapet a storey; the storey\'s foot asked; the deck\'s height unread; the foot read as the origin; a downward face a deck; a tread a deck)', () => {
  assert.equal(YARD_STOREY_RISE, 1);
  assert.equal(YARD_DECK_MIN, 4);
  // a 10 x 10 ground floor 3.22 high; on its east half an upper storey to 6.45 with a flat roof; the west half's roof a
  // deck with a parapet 0.8 high round it
  const house = model([...ring([-5, -5, 5, 5], 0, 3.22), ...ring([0, -5, 5, 5], 3.22, 6.45), [-5, -5, -5, 5, 3.22, 4.02]], [[-5, -5, 0, 5, 3.22], [0, -5, 5, 5, 6.45]]);
  const parts = modelFootParts(house.positions, house.indices);
  assert.deepEqual(parts.rects, modelFootRects(house.positions, house.indices), 'the whole ground, as HOME-FOOT measures it');
  const deckAt = (x, z) => parts.decks.find((r) => x >= r[0] && x < r[2] && z >= r[1] && z < r[3])?.[4] ?? null;
  assert.equal(deckAt(-2.5, 0), 3.22, 'the west roof, a deck at its height');
  assert.equal(deckAt(2.5, 0), 6.45, 'the storey\'s roof, a deck too (too high for a yard)');
  assert.equal(parts.solid.length, 0, 'nothing else');
  const lot = lotOf(house);
  assert.equal(yardWhyNot([-2.5, 3.22, 0], lot, [], CHAIR), null, 'a chair on the deck');
  assert.equal(yardWhyNot([-2.5, 0, 0], lot, [], CHAIR), YARD_IN_HOUSE, 'under it');
  assert.equal(yardWhyNot([-2.5, 1.2, 0], lot, [], CHAIR), YARD_IN_HOUSE, 'a lamp hung under it');
  assert.equal(yardWhyNot([-0.3, 3.22, 0], lot, [], CHAIR), null, 'against the storey\'s wall');
  assert.equal(yardWhyNot([-0.25, 3.22, 0], lot, [], CHAIR), null, 'sat into it by the clip');
  assert.equal(yardWhyNot([0.4, 3.22, 0], lot, [], CHAIR), YARD_IN_HOUSE, 'into the storey');
  assert.equal(yardWhyNot([2.5, 6.45, 0], lot, [], CHAIR), YARD_TOO_HIGH, 'the storey\'s roof stands past the yard\'s height');
  // AUDIT FB1030 Y5: a tall model's origin stands over the deck while its foot stands on the ground under it
  const tall = Object.assign(CHAIR.map(([x, z]) => [x, z]), { bottom: -4 });
  assert.equal(yardWhyNot([-2.5, 4, 0], lot, [], tall), YARD_IN_HOUSE, 'its foot under the deck');
  assert.equal(yardWhyNot([-2.5, 7.22, 0], lot, [], Object.assign(CHAIR.map(([x, z]) => [x, z]), { bottom: -4 })), YARD_TOO_HIGH, 'its foot on it, its origin past the height');
  // a deck face that runs on under the storey (its sloped roof no deck) is the house where the storey stands on it
  const under = model([...ring([-5, -5, 5, 5], 0, 3.22), ...ring([0, -5, 5, 5], 3.22, 6.45)], [[-5, -5, 5, 5, 3.22]]);
  const P = Array.from(under.positions), I = Array.from(under.indices), n = P.length / 3;
  P.push(0, 6.45, -5, 0, 6.45, 5, 5, 8, 5, 5, 8, -5); I.push(n, n + 1, n + 2, n, n + 2, n + 3);   // a pitched half, rising east
  const sloped = lotOf({ positions: new Float32Array(P), indices: new Uint32Array(I) });
  assert.deepEqual([yardWhyNot([-2.5, 3.22, 0], sloped, [], CHAIR), yardWhyNot([2.5, 3.22, 0], sloped, [], CHAIR)], [null, YARD_IN_HOUSE], 'the deck west, the storey east');
  // AUDIT FB1030 Y3: the storey's outer walls one face from the ground - still the walls standing over the deck
  const tower = model([[-5, -5, 0, -5, 0, 3.22], [0, 5, -5, 5, 0, 3.22], [-5, 5, -5, -5, 0, 3.22], [0, -5, 5, -5, 0, 6.45], [5, -5, 5, 5, 0, 6.45], [5, 5, 0, 5, 0, 6.45], [0, 5, 0, -5, 3.22, 6.45]], [[-5, -5, 0, 5, 3.22], [0, -5, 5, 5, 6.45]]);
  const tl = lotOf(tower);
  assert.deepEqual([yardWhyNot([-2.5, 3.22, 0], tl, [], CHAIR), yardWhyNot([-4.5, 3.22, 4.5], tl, [], CHAIR), yardWhyNot([0.6, 3.22, 0], tl, [], CHAIR)], [null, null, YARD_IN_HOUSE], 'the open deck, its corner, and the storey');
  // the storey's wall on a cell's side, a pitched roof over it: from the deck its wall is touched, and no more
  const gable = model([...ring([-5, -5, 5, 5], 0, 3.22), ...ring([0.2, -5, 5, 5], 3.22, 6.45)], [[-5, -5, 0.2, 5, 3.22]]);
  const G = Array.from(gable.positions), GI = Array.from(gable.indices), gn = G.length / 3;
  G.push(0.2, 6.45, -5, 0.2, 6.45, 5, 5, 8, 5, 5, 8, -5); GI.push(gn, gn + 1, gn + 2, gn, gn + 2, gn + 3);
  const gl = lotOf({ positions: new Float32Array(G), indices: new Uint32Array(GI) });
  assert.deepEqual([yardWhyNot([-0.05, 3.22, 0], gl, [], CHAIR), yardWhyNot([0, 3.22, 0], gl, [], CHAIR)], [null, YARD_IN_HOUSE], 'sat into its wall, and past it');
  // AUDIT FB1030 Y7: a loggia - a deck with a roof over it and open sides - is a deck
  const loggia = model([...ring([-5, -5, 5, 5], 0, 3.22), [-5, -5, -5, 5, 3.22, 6.45]], [[-5, -5, 5, 5, 3.22], [-5, -5, 5, 5, 6.45]]);
  assert.equal(yardWhyNot([0, 3.22, 0], lotOf(loggia), [], CHAIR), null, 'under its ceiling');
  // a one-storey flat roof with a parapet round it is a deck: a parapet is no storey
  const walled = model([...ring([-5, -5, 5, 5], 0, 3.22), ...ring([-5, -5, 5, 5], 3.22, 4.02)], [[-5, -5, 5, 5, 3.22]]);
  assert.equal(yardWhyNot([0, 3.22, 0], lotOf(walled), [], CHAIR), null, 'its roof inside its parapet');
  // AUDIT FB1030 Y6: an outside stair's treads and landing, walled in, are no decks - too small to stand a yard on
  const stair = model([...ring([-5, -5, 5, 5], 0, 6.45), ...ring([5, -1, 6.2, 1.4], 0, 4)], [[-5, -5, 5, 5, 6.45], [5, -1, 6.2, -0.6, 2.4], [5, -0.6, 6.2, -0.2, 2.8], [5, -0.2, 6.2, 1.4, 3.22]]);
  const sp = modelFootParts(stair.positions, stair.indices);
  assert.equal(sp.decks.filter((d) => d[4] < 4).length, 0, 'no deck on the stair');
  assert.equal(yardWhyNot([5.6, 3.22, 0.6], lotOf(stair), [], square(0.25)), YARD_IN_HOUSE, 'a crate on its landing');
  // a downward face (a jetty's underside) is no deck
  const jetty = model(ring([-5, -5, 5, 5], 0, 3.22), []);
  const J = Array.from(jetty.positions), JI = Array.from(jetty.indices), m = J.length / 3;
  J.push(-5, 3.22, -5, 5, 3.22, -5, 5, 3.22, 5, -5, 3.22, 5); JI.push(m, m + 1, m + 2, m, m + 2, m + 3);
  assert.equal(modelFootParts(new Float32Array(J), new Uint32Array(JI)).decks.length, 0, 'facing down');
  // a frame with no parts (a house measured before this) keeps HOME-FOOT's law
  assert.equal(yardWhyNot([-2.5, 3.22, 0], yardLot([0, 0, 0], [-5, 0, -5, 5, 6.45, 5], YARD_MARGIN, parts.rects), [], CHAIR), YARD_IN_HOUSE, 'no parts known: the house');
});

test('YARD-DECK and WALL-TOUCH on the game\'s own houses: a Hammerfell house\'s wing roof (ARCH3D 541) is a deck at 3.22 m beside its storey, a lantern hung on a half-timbered house\'s wall (125) stands in its yard; a terrace beside a tall storey (606) is a deck, an outside stair\'s landing (709) and a post (41902) are not', { skip: skipReal }, () => {
  const g = game();
  const wing = g.modelOf(541);
  const lot = lotOf(wing);
  const deck = lot.grounds[0].decks.find((d) => Math.abs(d[4] - 3.22) < 0.01);
  assert.ok(deck, 'a deck at 3.22 m');
  const mid = [(deck[0] + deck[2]) / 2, (deck[1] + deck[3]) / 2];
  assert.equal(yardWhyNot([mid[0], 3.22, mid[1]], lot, [], CHAIR), null, 'a chair on the wing\'s roof');
  assert.equal(yardWhyNot([mid[0], 0, mid[1]], lot, [], CHAIR), YARD_IN_HOUSE, 'the wing\'s ground floor');
  assert.equal(yardWhyNot([mid[0], 3.6, (lot.house[1] + lot.house[3]) / 2], lot, [], CHAIR), YARD_IN_HOUSE, 'the storey beside it');
  // 125: its west wall's foot, the lantern TEXTURE.210 record 27 set on it at the eye's height
  const h = g.modelOf(125), P = h.positions, I = h.indices;
  let west = Infinity;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    if (Math.abs((P[b] - P[a]) * (P[c + 2] - P[a + 2]) - (P[c] - P[a]) * (P[b + 2] - P[a + 2])) >= 2e-3) continue;
    if (Math.min(P[a + 1], P[b + 1], P[c + 1]) < 2) west = Math.min(west, P[a], P[b], P[c]);
  }
  const hl = lotOf(h);
  const tex = new TextureFile();
  tex.load(new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), TextureFile.indexToFileName(210)))), TextureFile.indexToFileName(210));
  const size = billboardSize(tex, 27);
  const lamp = { key: 'f210.27', model: null, flat: [210, 27], name: 'Lantern', kind: 'light', storage: false, light: null };
  const z = (hl.house[1] + hl.house[3]) / 2;
  const p = createDecorPlacer(lamp, { radius: Math.hypot(size.w, size.h) / 2, flat: size }).pieceAt([west, 1.5, z], [0, 0, 0], 'l', [-1, 0, 0], 0);
  assert.equal(yardWhyNot(p.pos, hl, [], octagon(size.w / 2)), null, `the lantern (${size.w.toFixed(2)} m wide) on the west wall`);
  assert.equal(yardWhyNot([west + 0.6, 0, z], hl, [], CHAIR), YARD_IN_HOUSE, 'a chair 0.6 m inside the wall');
  // AUDIT FB1030 Y3: 606's terrace under open sky, beside a storey whose walls stand from the ground
  assert.equal(yardWhyNot([0, 3.22, 3], lotOf(g.modelOf(606)), [], CHAIR), null, 'a chair on 606\'s terrace');
  // AUDIT FB1030 Y6: 709's outside stair - its landing before the upper door
  assert.equal(yardWhyNot([4.2, 3.22, -3.45], lotOf(g.modelOf(709)), [], square(0.25)), YARD_IN_HOUSE, 'a crate on 709\'s landing');
  // AUDIT FB1030 Y2: a 0.4 m post (41902) - a chair astride it
  const post = lotOf(g.modelOf(41902)), mx = (post.house[0] + post.house[2]) / 2, mz = (post.house[1] + post.house[3]) / 2;
  assert.ok(post.house[2] - post.house[0] < 0.5, 'a thin post');
  assert.equal(yardWhyNot([mx, 0, mz], post, [], CHAIR), YARD_IN_HOUSE, 'astride the post');
});
