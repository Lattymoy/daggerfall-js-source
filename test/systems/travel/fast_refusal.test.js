// FAST-REFUSAL (2026-10-26, the owner: "Take care of exclusions and gaps"; bible/06-Systems/Travel-View.md FAST-REFUSAL) -
// A PLAN PAST THE BAY WITH NO WAY BY LAND SAID AT ONCE. ROAD-BEYOND bounded a plan past the Bay by a count of cells, and a
// refusal spent all of it (300,000 cells, one to four seconds) before it said so. The land past the Bay is the trace's
// smooth law, land only in a square of the picture's centres with a land centre at a corner; the land centres joined to
// every one within two are pieces no way on land crosses between (systems/travel/landPieces.js), made once a land.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { apartPastBay, BAY_PAD, PIECE_REACH } from '../../../src/systems/travel/landPieces.js';
import { planRoute, routeGround } from '../../../src/systems/travel/travelRoute.js';
import { setTamrielTrace } from '../../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { MAP_W, MAP_H } from '../../../src/world/road/roadNetwork.js';

afterEach(() => { setTamrielTrace(null); setTamrielFit(null); });
const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
/** A trace W x H (picture units, a hundred Bay pixels each at the fit below - the Bay the picture's [0, 10] x [0, 5]) with
 *  land where `at(cx, cy)`. */
const W = 60, H = 30;
function trace(at) {
  const land = new Uint8Array(W * H), province = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y)) { land[y * W + x] = 1; province[y * W + x] = 1; }
  setTamrielTrace({ w: W, h: H, land, province });
  setTamrielFit({ ox: 0, oy: 0, ppu: 100 });
}
/** A Bay pixel in the middle of centre (cx, cy). */
const px = (cx, cy) => ({ x: cx * 100 + 50, y: cy * 100 + 50 });
const box = (x0, x1, y0, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

test('FAST-REFUSAL the dials: the Bay\'s own piece reaches three centres past its rectangle, two land centres within two are one piece', () => {
  assert.equal(BAY_PAD, 3);
  assert.equal(PIECE_REACH, 2);
});

test('FAST-REFUSAL the pieces: two isles two centres of sea apart are apart; one of sea apart (a step\'s two squares can join them) are not; an end in no land centre\'s square is never refused; the Bay\'s own ground is one piece with the land about it (mutants: the reach, the unknown end, the Bay\'s piece)', () => {
  const west = box(20, 24, 10, 14), east = box(27, 31, 10, 14), near = box(26, 30, 10, 14);
  trace((x, y) => west(x, y) || east(x, y));
  assert.equal(apartPastBay(px(22, 12), px(29, 12), MAP_W, MAP_H), true, 'two centres of sea between');
  assert.equal(apartPastBay(px(22, 12), px(23, 13), MAP_W, MAP_H), false, 'one isle');
  assert.equal(apartPastBay(px(22, 12), px(45, 25), MAP_W, MAP_H), false, 'an end at sea: the search answers');
  trace((x, y) => west(x, y) || near(x, y));
  assert.equal(apartPastBay(px(22, 12), px(28, 12), MAP_W, MAP_H), false, 'one centre of sea: perhaps one land');
  // the Bay: the table's own pixels one piece with every centre within BAY_PAD of its rectangle (the picture's [0, 10] x [0, 5])
  const coast = box(11, 16, 2, 4), isle = box(40, 44, 20, 24);
  trace((x, y) => coast(x, y) || isle(x, y));
  assert.equal(apartPastBay({ x: 500, y: 250 }, px(15, 3), MAP_W, MAP_H), false, 'the Bay to the land beside it');
  assert.equal(apartPastBay({ x: 500, y: 250 }, px(42, 22), MAP_W, MAP_H), true, 'the Bay to an isle far out');
  assert.equal(apartPastBay(px(42, 22), { x: 10, y: 10 }, MAP_W, MAP_H), true, 'and back');
  setTamrielTrace(null);
  assert.equal(apartPastBay({ x: 500, y: 250 }, px(42, 22), MAP_W, MAP_H), false, 'no trace landed: nothing known');
});

test('FAST-REFUSAL a plan past the Bay with no way by land is refused before a cell is expanded - the host\'s ground hands the pieces (`apart`), a boat\'s crossing is none of theirs (mutants: the refusal, the boat\'s)', () => {
  const west = box(20, 24, 10, 14), east = box(28, 32, 10, 14);
  trace((x, y) => west(x, y) || east(x, y));
  const dry = (x, y) => { const cx = Math.floor(x / 100), cy = Math.floor(y / 100); return west(cx, cy) || east(cx, cy); };
  const rg = routeGround(() => 0, () => 20, 3, MAP_W, MAP_H, dry);
  const tally = { n: 0 };
  assert.equal(planRoute(px(22, 12), px(30, 12), { ...rg, tally }), null);
  assert.equal(tally.n, 0, 'not a cell');
  // one isle: walked
  assert.ok(planRoute(px(21, 11), px(23, 13), { ...rg }), 'a way on one isle');
  // a boat to hand: the land's pieces say nothing (THE MERGE)
  const src = read('src/systems/travel/travelRoute.js');
  assert.match(src, /if \(past && !sea && apart && apartPastBay\(from, to, width, height\)\) return null;/);
});

// ── WITH ARENA2: the freeware's own Tamriel ─────────────────────
const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));
test('FAST-REFUSAL on the freeware\'s Tamriel: the Summerset Isles apart from Cyrodiil, Skyrim from Black Marsh not; Alinor to the Imperial City refused at once', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // the freeware's fit (test/ui/tamriel4.test.js)
  const ALINOR = { x: 8, y: 1533 }, IC = { x: 2069, y: 658 }, WHITERUN = { x: 1891, y: -202 }, GIDEON = { x: 2809, y: 1275 }, DAGGERFALL = { x: 207, y: 213 };
  assert.equal(apartPastBay(ALINOR, IC, MAP_W, MAP_H), true, 'Summerset to Cyrodiil');
  assert.equal(apartPastBay(ALINOR, DAGGERFALL, MAP_W, MAP_H), true, 'Summerset to the Bay');
  assert.equal(apartPastBay(WHITERUN, GIDEON, MAP_W, MAP_H), false, 'Skyrim to Black Marsh: the mainland');
  assert.equal(apartPastBay(DAGGERFALL, IC, MAP_W, MAP_H), false, 'the Bay to Cyrodiil');
  const t0 = performance.now();
  for (let i = 0; i < 1000; i++) apartPastBay(ALINOR, IC, MAP_W, MAP_H);
  assert.ok(performance.now() - t0 < 1000, 'a thousand asks well under a second once made');
});
