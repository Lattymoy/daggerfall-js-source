// HARBOUR-BOOK (2026-10-04, from the field: the port towns' new docks "missing" for some players) - the harbours near
// the player kept by the world, not the sea fight (systems/naval/harbourBook.js): sounded whatever runs on the water,
// read by the quays and the naval host alike; and the quay's jetty a pier across Iliac Puddle's shore-fitted shelf to
// the land (systems/naval/quays.js JETTY_MAX). bible/03-World/Holdings.md section 7.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHarbourBook, HARBOUR_RETRY_S } from '../../../src/systems/naval/harbourBook.js';
import { findHarbour, draftOf } from '../../../src/systems/naval/shipLife.js';
import { planQuay, JETTY_MAX, JETTY_BEACH, DRY_M } from '../../../src/systems/naval/quays.js';
import { SHORE_TERRAIN_FIT_METERS } from '../../../src/world/deepWater/deepWaterFloor.js';
import { sampleDepthMeters } from '../../../src/world/deepWater/deepBathymetry.js';
import { sea } from '../../navalSea.mjs';
import { hostText } from '../../hostText.mjs';   // HOST-SPLIT 2 (AUDIT, the second read): its negatives read the host whole

const read = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');
/** The coast: land north of z = 200, and a headland x 300-400 reaching south to z = -300 (shiplife.test.js's). */
const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
const TOWN = { minX: -100, maxX: 100, minZ: 220, maxZ: 420 };
const PORT = { key: 'port:1', name: 'Sentinel', rect: TOWN };
const HARBOUR = findHarbour({ rect: TOWN, isWater: coast });
const all = (h) => [...h.host._sea.values()];
const moored = (h) => all(h).filter((e) => e.ship.errand?.kind === 'moored');

test('HARBOUR-BOOK THE BOOK: the port near the player sounded once its ground is built (findHarbour\'s own harbour), not again while it holds one; a port that gave none sounded again HARBOUR_RETRY_S later; its berths moved with the world; emptied at a transition; the quays\' list the harbours with berths alone', () => {
  let near = { ...PORT, ready: () => false }, water = coast;
  const book = createHarbourBook({ harbourNear: () => near, isWater: (x, z) => water(x, z) });
  book.step(0);
  assert.deepEqual(book.list(), [], 'not sounded while its shore streams (AUDIT HOLDINGS O1)');
  near = { ...PORT, ready: () => true };
  book.step(1);
  const list = book.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].key, 'port:1');
  assert.equal(list[0].name, 'Sentinel');
  assert.deepEqual(list[0].harbour, HARBOUR, 'findHarbour\'s harbour off its footprint');
  const first = list[0].harbour;
  book.step(1 + HARBOUR_RETRY_S * 3);
  assert.equal(book.get('port:1').harbour, first, 'a harbour found is never sounded again');
  // the world moves: the berths, their approaches and the mouth with it, in place
  const was = first.berths.map((b) => [...b.pos]), mouth = [...first.mouth];
  book.offsetAll([10, 5, -20]);
  first.berths.forEach((b, i) => assert.deepEqual(b.pos, [was[i][0] + 10, was[i][1] - 20]));
  assert.deepEqual(first.mouth, [mouth[0] + 10, mouth[1] - 20]);
  book.clear();
  assert.deepEqual(book.list(), [], 'forgotten at a transition');
  assert.equal(book.get('port:1'), undefined);
  // no shore to berth at: kept null (not in the quays' list), sounded again after HARBOUR_RETRY_S (AUDIT SHIP-LIFE B7)
  water = () => false;
  book.step(100);
  assert.equal(book.get('port:1').harbour, null);
  assert.deepEqual(book.list(), [], 'no berths, no quays');
  water = coast;
  book.step(100 + HARBOUR_RETRY_S - 0.1);
  assert.equal(book.get('port:1').harbour, null, 'not before HARBOUR_RETRY_S');
  book.step(100 + HARBOUR_RETRY_S);
  assert.deepEqual(book.get('port:1').harbour, HARBOUR, 'sounded again');
  // no port near: nothing sounded, nothing forgotten
  near = null;
  book.step(500);
  assert.equal(book.list().length, 1);
});

test('HARBOUR-BOOK THE SEA READS THE WORLD\'S BOOK: a naval host handed one never sounds, moves nor empties it - the world does - and reads its harbours (its moored ships, its docking, the quays\' list); its own clear forgets which harbours it rolled, so their ships stand again; made without one, it keeps its own as before', async () => {
  const book = createHarbourBook({ harbourNear: () => PORT, isWater: coast });
  const w = await sea({ hull: null, water: coast, harbourBook: book, settings: { ShipsAtSea: 'few' } });
  w.view.feet = [0, 0, 300];
  w.deps.harbourNear = () => PORT;   // the host would sound it, were the book its own
  w.run(1);
  assert.deepEqual(book.list(), [], 'the host never sounds the world\'s book');
  assert.deepEqual(w.host.harbourList(), []);
  assert.equal(moored(w).length, 0, 'no harbour, no moored ships');
  book.step(0);
  assert.equal(w.host.harbourList()[0].harbour, book.list()[0].harbour, 'the book\'s own harbour');
  w.run(1);
  const n = moored(w).length;
  assert.ok(n > 0, 'its moored ships stood off the world\'s harbour');
  // the world moves its own book: the host's offset leaves it be
  const at = [...book.list()[0].harbour.berths[0].pos];
  w.host.offsetAll([7, 0, 7]);
  assert.deepEqual(book.list()[0].harbour.berths[0].pos, at, 'not moved twice');
  // the sea's clear: its ships gone, the world's harbours kept, and its roll forgotten - the ships stand again
  w.host.clear();
  assert.equal(book.list().length, 1, 'the world\'s harbours kept');
  assert.equal(moored(w).length, 0);
  w.run(1);
  assert.equal(moored(w).length, n, 'rolled anew after the clear');
  // made without a book: its own, sounded in its frame and emptied by its clear (the suites' sea)
  const o = await sea({ hull: null, water: coast });
  o.view.feet = [0, 0, 300]; o.deps.harbourNear = () => PORT;
  o.run(1);
  assert.equal(o.host.harbourList().length, 1, 'its own book sounded in its frame');
  o.host.clear();
  assert.deepEqual(o.host.harbourList(), [], 'and emptied by its clear');
});

/**
 * Iliac Puddle's floor along a straight coast (x = 0, the sea at x > 0): DeepWaterBathymetry's depth
 * (deepBathymetry.js sampleDepthMeters, the climate's 210 m base at Water Depth `wd`) under the floor's shore fit
 * (deepWaterFloor.js fitSeafloorToShoreTerrain: within SHORE_TERRAIN_FIT_METERS of the coast lerped by its smoothstep up
 * to the vanilla ground - in the sea the ocean's own elevation, terrainSampler.js - less FLOOR_SURFACE_CLEARANCE).
 */
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const shelfDepth = (x, z, wd) => {
  const fit = 1 - smooth(x / SHORE_TERRAIN_FIT_METERS);
  return sampleDepthMeters(x + 5000, z + 5000, 210, x, wd) * (1 - fit) + 0.05 * fit;
};

test('HARBOUR-BOOK THE PIER ACROSS THE SHELF: on Deep Waters\' shore-fitted shelf the deepest keel floats only some 80 m off the land, and every berth sounded there takes a jetty to the shore - JETTY_MAX the shelf\'s whole shore fit and JETTY_BEACH (mutants: the old 40 m stood every quay alone out on the water)', () => {
  assert.equal(JETTY_MAX, SHORE_TERRAIN_FIT_METERS + JETTY_BEACH);
  assert.equal(SHORE_TERRAIN_FIT_METERS, 180, 'deepWaterFloor.js SHORE_TERRAIN_FIT_METERS');
  const SEA = 34, rect = { minX: -400, maxX: -10, minZ: -300, maxZ: 300 };
  let piers = 0;
  for (const wd of [5, 12, 50, 250]) {
    const isWater = (x, z, h) => x > 0 && shelfDepth(x, z, wd) > (h < 0 ? 0.05 : draftOf(h));
    const groundAt = (x, z) => (x <= 0 ? SEA + 2 : SEA - shelfDepth(x, z, wd));
    const h = findHarbour({ rect, isWater });
    assert.ok(h && h.berths.length > 0, `Water Depth ${wd}: a harbour`);
    for (const [i, b] of h.berths.entries()) {
      const p = planQuay({ berth: b, hull: h.hull, key: 'port:1', index: i, seaY: SEA, groundAt });
      assert.ok(b.pos[0] > 60, `Water Depth ${wd}, berth ${i}: out where the keel floats (${b.pos[0].toFixed(1)} m)`);
      assert.ok(p.jetty, `Water Depth ${wd}, berth ${i}: a pier to the land - never a quay alone ${b.pos[0].toFixed(1)} m out`);
      // its landward end on the land: the frame's +x is the berth's landward, here -x in the scene
      const end = b.pos[0] - p.jetty.x1;
      assert.ok(end <= 0, `onto the land (${end.toFixed(1)} m)`);
      assert.ok(groundAt(end, b.pos[1]) - SEA >= DRY_M, 'its end dry');
      piers++;
    }
  }
  assert.ok(piers >= 12, `${piers} piers`);
});

test('HARBOUR-BOOK THE WORLD\'S WIRING: one book made off the port near the player and the sea\'s water law; the naval host handed it; sounded each exterior frame before the quays stand; moved with the floating origin before the sea and the quays; emptied with the sea at a transition, a jump and a load; the quays stand off it whatever runs on the water - THE FOUR HOSTS: the street alone (a building\'s and a dungeon\'s frames have no sea, the standalone street no harbour)', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const harbourBook = createHarbourBook\(\{\n    harbourNear: navalHarbourNear,\n    isWater: navalIsWater,\n  \}\);/);
  assert.equal((w.match(/createHarbourBook\(/g) ?? []).length, 1, 'one book');
  assert.match(w, /\n    harbourBook,   \/\/ SHIP-LIFE, HARBOUR-BOOK/);
  assert.ok(!/harbourNear: navalHarbourNear,   \/\/ SHIP-LIFE/.test(w), 'the host sounds none of its own');
  assert.match(w, /harbours: \(\) => harbourBook\.list\(\),/);
  assert.ok(!/naval\?\.harbourList/.test(w), 'the quays never ask the sea fight');
  const stepAt = w.indexOf("try { if (_mode() === 'exterior' && !_loading) harbourBook.step(now / 1000); }"), frameAt = w.indexOf('try { quays?.frame(); }');
  assert.ok(stepAt > 0 && stepAt < frameAt, 'sounded before the quays stand');
  const offAt = w.indexOf('harbourBook.offsetAll(r.offset);'), navalOffAt = w.indexOf('naval?.offsetAll(r.offset);'), quaysOffAt = w.indexOf('quays?.offsetAll();');
  assert.ok(offAt > 0 && offAt < navalOffAt && navalOffAt < quaysOffAt, 'moved before the sea and the quays read it');
  assert.match(w, /const navalTransition = \(\) => \{ harbourBook\.clear\(\); navalClear\(\); withdrawCrossing\(\); \};/);   // PIN MOVED (AUDIT CAPTAIN'S SEA X2): and the crossing's question taken back
  for (const host of ['src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) assert.ok(!read(host).includes('createHarbourBook'), `${host}: no harbours`);
  const n = read('src/scenes/naval/navalHost.js');
  assert.match(n, /const ownBook = !deps\.harbourBook;\n  const harbours = deps\.harbourBook \?\? createHarbourBook\(/);
  assert.match(n, /if \(ownBook\) harbours\.step\(clock\);/);
  assert.match(n, /if \(ownBook\) harbours\.offsetAll\(o\);/);
  assert.match(n, /if \(ownBook\) harbours\.clear\(\);/);
});
