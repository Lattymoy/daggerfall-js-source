// FB1020c HARBOUR-REACH (the field, 2026-10-20: "a lot of harbor towns dont have harbors dispite being along the coast") -
// ONE REACH FOR BOTH LAWS (systems/naval/harbourBook.js step, portRingReach; scenes/world.js navalHarbourNear's `ready`).
//
// A port town is one the open sea bears on within SEA_RING map pixels (world/portSites.js portTownOnSea): its shipyard,
// its lighthouse and its harbourmaster's board stand on that. Its harbour - the quays, the docks, the berths its ships
// moor at - was sounded on the ground the game builds within HARBOUR_REACH (420 m) of its footprint alone
// (systems/naval/shipLife.js findHarbour), and DFU's kernel lays the shore of 37 of the 106 port towns farther off than
// that: their harbourmasters kept a board and no quay. A Bay port whose own shore gives no berth is now sounded out to
// the ring its port law read, once that ground is built (never "no harbour" before), once a book's life.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHarbourBook, portRingReach, HARBOUR_RETRY_S } from '../../../src/systems/naval/harbourBook.js';
import { findHarbour, HARBOUR_REACH } from '../../../src/systems/naval/shipLife.js';
import { SEA_RING } from '../../../src/world/portSites.js';
import { TERRAIN_SIZE } from '../../../src/world/terrain/terrainSampler.js';
import { hostText } from '../../hostText.mjs';
import { portTerrain, HAS_ARENA2 } from '../../portTerrain.mjs';

/** A town on a high coast: its footprint z 220-420, the land running south of it to the shore at z = -800 (1,020 m off
 *  its footprint, past HARBOUR_REACH), a headland reaching on out to z = -1300 at x 300-400 (shiplife.test.js's shape). */
const farCoast = (x, z) => !(z > -800 || (x > 300 && x < 400 && z > -1300));
const TOWN = { minX: -100, maxX: 100, minZ: 220, maxZ: 420 };
const PORT = { key: 'port:7', name: 'Holwych', rect: TOWN };

test('FB1020c HARBOUR-REACH the ring\'s reach: the pixels within SEA_RING of the town\'s own, off its footprint at its pixel\'s middle - a city filling its pixel 1,638.4 m, a village of two blocks 1,945.6 m - past HARBOUR_REACH for every town (mutants: the ring a pixel short; the footprint not taken off)', () => {
  assert.equal(SEA_RING, 2);
  assert.equal(portRingReach({ minX: 0, maxX: 819.2, minZ: 0, maxZ: 819.2 }), 1638.4);
  assert.equal(portRingReach({ minX: 0, maxX: 204.8, minZ: 0, maxZ: 204.8 }), 1945.6);
  assert.equal(portRingReach({ minX: 0, maxX: 204.8, minZ: 0, maxZ: 409.6 }), (SEA_RING + 0.5) * TERRAIN_SIZE - 204.8, 'the larger side');
  assert.ok(portRingReach({ minX: 0, maxX: 819.2, minZ: 0, maxZ: 819.2 }) > HARBOUR_REACH);
});

test('FB1020c HARBOUR-REACH the book: a port whose own shore gives no berth is sounded out to the port law\'s ring - findHarbour\'s own harbour there, the nearest shore first; a shore within its own reach is never sounded farther (mutants: the far sounding never made; made whatever the near found; at the near reach)', () => {
  assert.equal(findHarbour({ rect: TOWN, isWater: farCoast }), null, 'its own reach: no shore');
  const far = findHarbour({ rect: TOWN, isWater: farCoast, reach: portRingReach(TOWN) });
  assert.ok(far?.berths?.length, 'the ring\'s reach: berths');
  const book = createHarbourBook({ harbourNear: () => ({ ...PORT, ready: () => true, reach: HARBOUR_REACH }), isWater: (x, z) => farCoast(x, z) });
  book.step(0);
  assert.deepEqual(book.get('port:7').harbour, far, 'sounded out to the ring at once, its ground built');
  assert.equal(book.list().length, 1, 'its quays stand');
  // a shore within the town's own reach keeps the harbour it always had
  const near = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
  const book2 = createHarbourBook({ harbourNear: () => ({ ...PORT, ready: () => true }), isWater: (x, z) => near(x, z) });
  book2.step(0);
  assert.deepEqual(book2.get('port:7').harbour, findHarbour({ rect: TOWN, isWater: near }), 'its own reach\'s harbour, unchanged');
  assert.equal(book2.get('port:7').far, undefined, 'never sounded farther');
});

test('FB1020c HARBOUR-REACH never "no harbour" before the ground is built: the ring\'s ground streaming, the port is sounded at its own reach and waits - asked again each step, sounded the frame its ground is built; sounded once a book\'s life - a ring with no shore is not sounded again at HARBOUR_RETRY_S, its own reach is (mutants: ready asked at the near reach; the far sounding made unbuilt; sounded every step)', () => {
  let built = HARBOUR_REACH, water = farCoast, asks = 0;
  const book = createHarbourBook({
    harbourNear: () => ({ ...PORT, reach: HARBOUR_REACH, ready: (r = HARBOUR_REACH) => r <= built }),
    isWater: (x, z) => { asks++; return water(x, z); },
  });
  book.step(0);
  assert.equal(book.get('port:7').harbour, null, 'its own reach sounded: none');
  assert.notEqual(book.get('port:7').far, true, 'the ring not sounded while its ground streams');
  book.step(1); book.step(2);
  assert.equal(book.get('port:7').harbour, null);
  built = portRingReach(TOWN);
  book.step(3);
  assert.ok(book.get('port:7').harbour?.berths?.length, 'its ground built: sounded, and its harbour found');
  // a ring with no shore at all: sounded once; the B7 retry asks its own reach again, never the ring
  book.clear();
  water = () => false;
  book.step(10);
  assert.equal(book.get('port:7').far, true);
  assert.equal(book.get('port:7').harbour, null);
  asks = 0;
  book.step(10 + HARBOUR_RETRY_S);
  const retried = asks;
  assert.ok(retried > 0, 'the retry sounded its own reach');
  asks = 0;
  findHarbour({ rect: TOWN, isWater: (x, z) => { asks++; return water(x, z); } });
  assert.equal(retried, asks, 'and only its own reach');
  // an isle past the Veil sounds its own reach alone (AUDIT CAPTAIN'S SEA H1)
  const isle = createHarbourBook({ harbourNear: () => ({ ...PORT, reach: 700, ready: () => true }), isWater: (x, z) => farCoast(x, z) });
  isle.step(0);
  assert.equal(isle.get('port:7').harbour, null, 'no farther than its own shore');
});

test('FB1020c HARBOUR-REACH by source: the world hands its harbour\'s readiness at any reach - the scan\'s every pixel built - and its own reach beside it', () => {
  const W = hostText('src/scenes/world.js');
  assert.match(W, /const ready = \(r = reach\) => \{[^\n]*\n {6}const x0 = rect\.minX - r, z0 = rect\.minZ - r, sx = rect\.maxX - rect\.minX \+ 2 \* r, sz = rect\.maxZ - rect\.minZ \+ 2 \* r;/);
  assert.match(W, /return \{ key: `port:\$\{t\.id\}`, name: t\.name, rect, ready, reach \};/);
});

/** The 37 port towns whose own reach sounds no harbour on the ground DFU's kernel builds - the field's report. */
const OWN_NONE = Object.freeze([
  'Aldbrugh', 'Aldingshire', 'Aldpath Hall', 'Antelajda', 'Arkbeth Garden', 'Blackcart Hollow', 'Bubissidata', 'Cathborne',
  'Cathwold Heath', 'Chardale', 'Chesterbrugh', 'Crossleigh', 'Daggerfall', 'Eastwold', 'Fontbridge', 'Gallocart', 'Holwych',
  'Isfakabi', 'Lambrugh', 'Longmore Field', 'Longwich End', 'Mesiton', 'Midbrugh', 'Pencart', 'Ripmore', 'Sentinel',
  'Stokbrone', 'Syrallao', 'Vanhope Hall', 'Wartale', 'Wartry Moor', 'Wayrest', 'Wilderbury Rock', 'Wilderham', 'Wilderleigh',
  'Zagoparia', 'Zagumba-Kom',
]);

test('FB1020c HARBOUR-REACH (ARENA2): every one of the 106 port towns but Aldbrugh sounds a harbour with berths through the book on the ground the game builds - 69 at their own reach, 36 more out to the ring; 37 sounded none before, the three crowns\' capitals among them (Aldbrugh: open, its port kept)', { skip: !HAS_ARENA2 && 'ARENA2_PATH not set' }, () => {
  const t = portTerrain();
  assert.equal(t.towns.length, 106);
  const own = [], none = [];
  for (const town of t.towns) {
    if (!findHarbour({ rect: town.rect, isWater: t.isWater })?.berths?.length) own.push(town.name);
    const book = createHarbourBook({ harbourNear: () => ({ key: town.name, name: town.name, rect: town.rect, reach: HARBOUR_REACH, ready: () => true }), isWater: t.isWater });
    book.step(0);
    if (!book.get(town.name).harbour?.berths?.length) none.push(town.name);
  }
  assert.deepEqual(own.sort(), [...OWN_NONE], 'the field\'s report: 37 harbour towns with no harbour');
  assert.deepEqual(none, ['Aldbrugh'], 'out to the ring, all but one');
});
