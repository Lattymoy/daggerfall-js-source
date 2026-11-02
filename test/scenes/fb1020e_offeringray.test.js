// FIELD BUGS 2026-10-20e OFFERING-RAY (bible/01-Overview/bugs/Field-Bugs-2026-10-20e.md; the Discord's #bug-reports,
// 2026-10-20 - Temegast: "crash on interact", twice, and Boar the same): A HEARTH OFFERING'S BOX IS THE RAY'S. A stood
// offering's target (src/scenes/witchesHost.js `targets`) handed the street's one ray its batch's culling box - the
// 6-array `flatBatchAabb` mints - where every ray in player/activate.js reads `{ min, max }`. The pick tests every
// entrant's box before it races them, so the first press anywhere in a street an offering stood in threw `Cannot read
// properties of undefined (reading '0')` out of rayAabb - the stack all three screenshots carry
// (exteriorActivationHit -> pickActivatableHit -> firmFirst -> nearestActivatableHit -> rayAabb) - whatever the press was
// at: a body, a door, a person. The plaque asks the same pick every frame inside its own containment (ui/worldPlaque.js
// worldHoverFrame), so it stood down in that street and named nothing. The WITCH1 suite read the 6-array back off the
// producer and never handed it to the ray (Home.md, TEST THE SHAPE THE PRODUCER MINTS): these pins hand the REAL
// producer's targets to the REAL pick, the one the stack names.
import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createWitchesHost, offeringKey } from '../../src/scenes/witchesHost.js';
import { _resetFestivalClientForTests } from '../../src/systems/festival/festivalClient.js';
import { FESTIVAL_ARCHIVE } from '../../src/world/festivalArt.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';
import { FESTIVALS } from '../../src/net/festivalLaw.js';
import { pickActivatableHit, RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE } from '../../src/player/activate.js';

const MAP = 1234, MINE = 77, THEIRS = 78;
/** The pixel's floating-origin translation - every axis moved, so a corner that skips one is seen. */
const TR = [100, 0.5, 200];
const store = new Map();
const mem = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
const settle = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
/** A collider with nothing in it: the pick's occlusion meets no wall. */
const OPEN = { raycast: () => Infinity };
const round = (v) => v.map((n) => Math.round(n * 100) / 100);

let H;
beforeEach(() => {
  globalThis.localStorage = mem;
  store.clear();
  store.set(SESSION_KEY, JSON.stringify({ secret: 'sekrit', id: 'acct-alice', name: 'Alice', kind: 'linked' }));
  mock.timers.enable({ apis: ['Date'], now: FESTIVALS[0].fromMs + 3600_000 });   // the festival live
  _resetFestivalClientForTests();
  const offerings = [{ buildingKey: MINE, stock: 3, owner: 'Alice', mine: true, taken: false }, { buildingKey: THEIRS, stock: 5, owner: 'Bobby', mine: false, taken: false }];
  const entry = { px: 5, py: 6, homeTown: MAP, witchHomes: new Map([[MINE, [1.15, 0.2, 0.55]], [THEIRS, [21.1, 0.2, 0.6]]]), witchFloor: 0.2, batches: [], lights: [], placeHold: null };
  H = createWitchesHost({
    built: new Map([['5,6', entry]]),
    renderer: { createBillboardBatch: (a, r, size, centers) => ({ a, r, size, centers }), destroyBatch: () => {} },
    // a 40x56 picture at no scale of its own: 1.0 m wide, 1.4 m tall
    pipeline: { getTexture: async () => ({ archive: FESTIVAL_ARCHIVE, recordCount: 9, getSize: () => ({ width: 40, height: 56 }), getScale: () => ({ width: 0, height: 0 }), getFrameCount: () => 1 }), uploadRecord: () => {} },
    onlineHomes: { homeAt: () => null, known: () => true, ensure: () => {} },
    townTalk: { say: () => {}, showOverlay: () => {} },
    state: { current: { x: 5, y: 6 }, pixelTranslation: (x, y, out = [0, 0, 0]) => { out[0] = TR[0]; out[1] = TR[1]; out[2] = TR[2]; return out; } },
    player: { feetAt: () => [101, 0.7, 201], riding: false },
    saveSoon: { changed: () => {} }, chatNotice: () => {}, mode: () => 'exterior',
    api: { mine: async () => ({ ok: true, data: { cakes: 2 } }), town: async () => ({ ok: true, data: { mapId: MAP, offerings } }) },
    get online() { return { status: 'open', id: 'me', glyphs: [], lv: 1 }; },
  });
});
afterEach(() => { mock.timers.reset(); _resetFestivalClientForTests(); delete globalThis.localStorage; });

const standUp = async () => { H.frame(); await settle(); H.frame(); await settle(); };

test('FB1020e OFFERING-RAY THE BOX IS THE RAY\'S: each stood offering\'s target carries its picture\'s box as { min, max }, in the scene (the pixel\'s translation on every corner)', async () => {
  await standUp();
  const targets = H.targets();
  assert.deepEqual(targets.map((t) => t.key), [offeringKey(MAP, MINE), offeringKey(MAP, THEIRS)], 'both offerings stood');
  for (const t of targets) assert.deepEqual(Object.keys(t.aabb).sort(), ['max', 'min'], 'the corners rayAabb and boxContains read - not the culling box\'s 6-array');
  // the kept spot [1.15, 0.2, 0.55]: half the picture's width about it, its height above its foot - and TR on every axis
  assert.deepEqual({ min: round(targets[0].aabb.min), max: round(targets[0].aabb.max) }, { min: [100.65, 0.7, 200.05], max: [101.65, 2.1, 201.05] });
  assert.deepEqual({ min: round(targets[1].aabb.min), max: round(targets[1].aabb.max) }, { min: [120.6, 0.7, 200.1], max: [121.6, 2.1, 201.1] });
  assert.deepEqual([targets[0].distance, targets[0].reach], [RAY_DISTANCE, DEFAULT_ACTIVATION_DISTANCE], 'the ray\'s distance to win, a door\'s reach to answer');
});

test('FB1020e OFFERING-RAY THE PRESS THAT THREW: the street\'s one pick, an offering in its list, takes what is under the crosshair - a door, the offering, or nothing - and never throws', async () => {
  await standUp();
  // the street's one list (scenes/worldModes.js exteriorActivationTargets): the doors' boxes first, the offerings' last
  const door = { key: 0, aabb: { min: [109, 0.5, 199.5], max: [111, 3, 200.5] }, distance: RAY_DISTANCE, reach: 3.2 };
  const street = () => [door, ...H.targets()];
  // a press at the door, nowhere near a bowl: the door - every press in the street threw here, whatever it was at
  assert.deepEqual(pickActivatableHit([110, 1.5, 202], [0, 0, -1], street(), OPEN), { key: 0, distance: 1.5, reach: 3.2 });
  // at my own bowl: the offering, at the distance to its near face, a door's reach beside it
  const hit = pickActivatableHit([101.15, 1.2, 203], [0, 0, -1], street(), OPEN);
  assert.equal(hit.key, offeringKey(MAP, MINE));
  assert.ok(Math.abs(hit.distance - 1.95) < 1e-9, `its near face, 1.95 m off - got ${hit.distance}`);
  assert.equal(hit.reach, DEFAULT_ACTIVATION_DISTANCE);
  // at another's, from the street's side
  assert.equal(pickActivatableHit([121.1, 1.2, 202.5], [0, 0, -1], street(), OPEN)?.key, offeringKey(MAP, THEIRS));
  // a look at the sky over the bowl: nothing
  assert.equal(pickActivatableHit([101.15, 1.2, 203], [0, 1, 0], street(), OPEN), null);
});
