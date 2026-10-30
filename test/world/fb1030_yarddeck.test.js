// FIELD BUGS 2026-10-30 WALL-TOUCH and YARD-DECK (bible/01-Overview/bugs/Field-Bugs-2026-10-30.md section 2).
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

const { modelFootRects, modelFootParts, footRectsAt, yardLot, yardWhyNot, yardJoinLots, YARD_IN_HOUSE, YARD_TOO_HIGH, YARD_MARGIN, YARD_WALL_PAD, YARD_FOOT_CELL } = homeYards;

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
/** A lot from a model stood at the origin, as pixelBuild.js frames a home. */
function lotOf(m) {
  const place = trs(0, 0, 0, 0, 0, 0), parts = modelFootParts(m.positions, m.indices);
  const box = transformedAabb(localAabb(m.positions), place);
  return yardLot([0, 0, 0], box, YARD_MARGIN, footRectsAt(parts.rects, place), { solid: footRectsAt(parts.solid, place), decks: footRectsAt(parts.decks, place) });
}

test('WALL-TOUCH a piece set against its own house\'s wall is the yard\'s - its ground may reach YARD_WALL_PAD into the house\'s measured ground (half a cell and the wall\'s clip), never further; a seam between two of the house\'s rects is still no gap (mutants: no touch allowed; the touch unbounded; the seam a gap)', () => {
  assert.equal(YARD_WALL_PAD, YARD_FOOT_CELL / 2 + DECOR_WALL_CLIP);
  const lot = { house: [0, -5, 6, 5], walls: [[0, -5, 6, 0], [0, 0, 6, 5]], lot: [-6, -11, 12, 11], y: 0 };
  assert.equal(yardWhyNot([-0.3, 0, 2], lot, [], CHAIR), null, 'a chair touching the wall');
  assert.equal(yardWhyNot([-0.1, 0, 2], lot, [], CHAIR), null, 'reaching 0.2 into the measured ground');
  assert.equal(yardWhyNot([0.05, 0, 2], lot, [], CHAIR), YARD_IN_HOUSE, 'reaching 0.35 into it');
  assert.equal(yardWhyNot([0.3, 0, 2], lot), YARD_IN_HOUSE, 'a point 0.3 in');
  assert.equal(yardWhyNot([3, 0, 0], lot, [], CHAIR), YARD_IN_HOUSE, 'astride the seam between the two rects, inside');
  assert.equal(yardWhyNot([3, 0, 0], lot), YARD_IN_HOUSE, 'a point on the seam');
  // the touch is the house's own: a neighbour's ground keeps the edge's 5 cm
  assert.equal(yardWhyNot([-0.2, 0, -8], lot, [[-0.4, -10, 0, -6]], [[-0.1, -0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, 0.1]]), homeYards.YARD_ON_OTHER, 'a neighbour\'s ground is not touched');
  // YARD-JOINED: a mate's walls are the owner's house too, touched the same
  const joined = yardJoinLots({ ...lot, solid: lot.walls, decks: [] }, [{ walls: [[-4, 6, -1, 9]] }]);
  assert.equal(yardWhyNot([-0.8, 0, 7], joined, [], CHAIR), null, 'touching the mate\'s wall');
  assert.equal(yardWhyNot([-2, 0, 7], joined, [], CHAIR), YARD_IN_HOUSE, 'inside the mate');
});

test('WALL-TOUCH a flat set on the outside wall by the placer stands in the yard - its ground is half its width round it, as the placer stands it off the wall, not half its picture\'s diagonal (mutants: the diagonal\'s foot; the touch unbounded)', () => {
  const lot = { house: [0, -5, 6, 5], walls: [[-0.2, -5, 6, 5]], lot: [-6, -11, 12, 11], y: 0 };   // the measure's cells stand 0.2 past the wall at x 0
  const lamp = { key: 'f210.27', model: null, flat: [210, 27], name: 'Lantern', kind: 'light', storage: false, light: null };
  const size = { w: 0.5, h: 1 };
  const p = createDecorPlacer(lamp, { radius: Math.hypot(size.w, size.h) / 2, flat: size }).pieceAt([0, 1.5, 2], [0, 0, 0], 'l', [-1, 0, 0], 0);
  assert.equal(yardWhyNot(p.pos, lot, [], square(size.w / 2)), null, 'hung on the wall: the yard');
  assert.equal(yardWhyNot(p.pos, lot, [], square(Math.hypot(size.w, size.h) / 2)), YARD_IN_HOUSE, 'the diagonal\'s ground put it in the house');
  const tool = readFileSync(new URL('../../src/scenes/decor/decorTool.js', import.meta.url), 'utf8');
  assert.match(tool, /const r = \(p\.flatSize\?\.w > 0 \? p\.flatSize\.w \/ 2 : p\.radius \?\? 0\) \* s;/, 'the tool\'s footprintOf: half a flat\'s width');
  assert.match(tool, /if \(why && why !== whyNotHere\(\{ piece: cur, radius \}\)\) \{ deps\.say\?\.\(why\); return false; \}/, 'a turn refused only for what it did not stand in already');
});

test('YARD-DECK a level roof facing up inside the ground floor\'s walls is a deck: a piece standing on it is the yard\'s, under it the house\'s; a storey standing on it, or a roof over it, is no deck; a parapet is no storey; the yard\'s height still holds (mutants: no decks; a deck under a storey; a parapet a storey; the deck\'s height unread; a downward face a deck)', () => {
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
  assert.equal(yardWhyNot([0.4, 3.22, 0], lot, [], CHAIR), YARD_IN_HOUSE, 'into the storey');
  assert.equal(yardWhyNot([2.5, 6.45, 0], lot, [], CHAIR), YARD_TOO_HIGH, 'the storey\'s roof stands past the yard\'s height');
  // a deck face that runs on under the storey (its sloped roof no deck) is cut where the storey stands on it
  const under = model([...ring([-5, -5, 5, 5], 0, 3.22), ...ring([0, -5, 5, 5], 3.22, 6.45)], [[-5, -5, 5, 5, 3.22]]);
  const P = Array.from(under.positions), I = Array.from(under.indices), n = P.length / 3;
  P.push(0, 6.45, -5, 0, 6.45, 5, 5, 8, 5, 5, 8, -5); I.push(n, n + 1, n + 2, n, n + 2, n + 3);   // a pitched half, rising east
  const sloped = modelFootParts(new Float32Array(P), new Uint32Array(I));
  const covers = (rs, x, z) => rs.some((r) => x >= r[0] && x < r[2] && z >= r[1] && z < r[3]);
  assert.deepEqual([covers(sloped.decks, -2.5, 0), covers(sloped.decks, 2.5, 0), covers(sloped.solid, 2.5, 0)], [true, false, true], 'the deck west, the storey east');
  // a one-storey flat roof with a parapet round it is a deck: a parapet is no storey
  const walled = model([...ring([-5, -5, 5, 5], 0, 3.22), ...ring([-5, -5, 5, 5], 3.22, 4.02)], [[-5, -5, 5, 5, 3.22]]);
  assert.ok(covers(modelFootParts(walled.positions, walled.indices).decks, 0, 0), 'its roof inside its parapet');
  // a downward face (a jetty's underside) is no deck
  const jetty = model(ring([-5, -5, 5, 5], 0, 3.22), []);
  const J = Array.from(jetty.positions), JI = Array.from(jetty.indices), m = J.length / 3;
  J.push(-5, 3.22, -5, 5, 3.22, -5, 5, 3.22, 5, -5, 3.22, 5); JI.push(m, m + 1, m + 2, m, m + 2, m + 3);
  assert.equal(modelFootParts(new Float32Array(J), new Uint32Array(JI)).decks.length, 0, 'facing down');
  // a frame with no parts (a house measured before this) keeps HOME-FOOT's law
  assert.equal(yardWhyNot([-2.5, 3.22, 0], yardLot([0, 0, 0], [-5, 0, -5, 5, 6.45, 5], YARD_MARGIN, parts.rects), [], CHAIR), YARD_IN_HOUSE, 'no decks known: the house');
});

test('YARD-DECK and WALL-TOUCH on the game\'s own houses: a Hammerfell house\'s wing roof (ARCH3D 541) is a deck at 3.22 m beside its storey, a lantern hung on a half-timbered house\'s wall (125) stands in its yard', { skip: skipReal }, () => {
  const g = game();
  const wing = g.modelOf(541);
  const lot = lotOf(wing);
  const deck = lot.decks.find((d) => Math.abs(d[4] - 3.22) < 0.01);
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
  assert.equal(yardWhyNot(p.pos, hl, [], square(size.w / 2)), null, `the lantern (${size.w.toFixed(2)} m wide) on the west wall`);
  assert.equal(yardWhyNot([west + 0.6, 0, z], hl, [], CHAIR), YARD_IN_HOUSE, 'a chair 0.6 m inside the wall');
});
