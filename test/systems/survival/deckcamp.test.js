// DECK-CAMP (2026-10-04, from the field: "Campfires placed on a boat dont attach to a boat") - a camp placed on a boat's
// deck carries her number and its point in her frame (systems/survival/camp.js), and the pool poses it off her every
// frame (scenes/camps.js ride): hidden with her, packed back into the pack once she is gone, saved and said on the wire
// by its place on her. bible/06-Systems/Rest-Arc.md, bible/03-World/Come-Sail-Away.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validDeck, deckYaw, campWire, validCampRecord, campFromWire, mergeOwnerCamps, CAMP_TEXT, CAMP_KIND, TENT_BEHIND, TENT_MODEL,
  DECK_LOCAL_BOUND,
} from '../../../src/systems/survival/camp.js';
import { createCamps, DECK_GONE_S } from '../../../src/scenes/camps.js';
import { createSurvivalItem } from '../../../src/systems/survival/items.js';
import { TEMPLATE } from '../../../src/systems/survival/food.js';
import { setWorldMinutes } from '../../../src/systems/worldTick.js';
import { outOfDeck } from '../../../src/systems/naval/navalDeck.js';
import { createRestItem, REST_ITEM } from '../../../src/systems/rest/restItems.js';

const read = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');
const close = (a, b, eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) <= eps);
/** A hull's node: at `t`, turned `yawDeg` (her bow +z), scaled `k` (a model's scale is hers) - column-major. */
function deckMatrix(t, yawDeg = 0, k = 1) {
  const a = (yawDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [c * k, 0, -s * k, 0, 0, k, 0, 0, s * k, 0, c * k, 0, t[0], t[1], t[2], 1];
}
const flat = () => (o, d, m) => (d[1] < 0 && m >= o[1] ? o[1] : null);   // a floor at y = 0 under every probe

/** The camp test host (test/systems/survival/surv3_camps.test.js's), with a boat under every spot whose state the test sets. */
function host() {
  const batches = [];
  const renderer = {
    createBillboardBatch: (archive, record, size, centers) => { const b = { archive, record, size, centers: centers.map((c) => [...c]), frame: null }; batches.push(b); return b; },
    destroyBillboardBatch: (b) => { b._dead = true; },
    drawMesh: (gpu, m) => { drawn.push([...m]); },
  };
  const drawn = [];
  const said = [];
  const entity = { items: [] };
  const boat = { ref: { mine: true, uid: 7 }, m: deckMatrix([0, 0, 0]), state: 'stand', under: true };
  const state = { feet: [0, 1, 0], yaw: 0, place: {}, self: null, changed: 0 };
  const camps = createCamps({
    renderer, getTexture: async () => ({ getFrameCount: () => 3, getSize: () => ({ width: 40, height: 40 }) }), uploadRecordFrame: () => {},
    meshes: { getGpuMesh: async () => ({ gpu: true }), cpuModels: new Map([[TENT_MODEL, { positions: [-1, 0, -1, 1, 2, 1] }]]) }, entity,
    camera: () => ({ feet: state.feet, yaw: state.yaw }), collider: () => ({ raycast: flat() }), place: () => state.place,
    pixelKeyAt: (p) => `px:${Math.floor(p[0] / 100)}`, say: (l) => said.push(l), selfId: () => state.self, onChanged: () => { state.changed++; },
    deck: {
      at: () => (boat.under ? { ref: { ...boat.ref }, m: boat.m } : null),
      resolve: (ref) => (ref.uid !== boat.ref.uid ? { gone: true } : boat.state === 'stand' ? { m: boat.m } : boat.state === 'hidden' ? { hidden: true } : { gone: true }),
    },
  });
  return { camps, batches, drawn, said, entity, boat, state };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

test('DECK-CAMP THE ADDRESS: a deck\'s point and heading by her number - mine, or another player\'s by their id - every field in its law or none; her heading off her node\'s matrix', () => {
  assert.deepEqual(validDeck({ mine: true, uid: 7, local: [1, 2, 3], yaw: 0.5 }), { mine: true, uid: 7, local: [1, 2, 3], yaw: 0.5 });
  assert.deepEqual(validDeck({ peer: 'p:2', uid: 9, local: [0, 0, 0], yaw: 7 }), { peer: 'p:2', uid: 9, local: [0, 0, 0], yaw: 7 - 2 * Math.PI }, 'the heading wrapped');
  for (const bad of [null, [], {}, { mine: true, uid: 0, local: [0, 0, 0], yaw: 0 }, { mine: true, uid: 1.5, local: [0, 0, 0], yaw: 0 },
    { peer: 'bad id!', uid: 3, local: [0, 0, 0], yaw: 0 }, { mine: true, uid: 3, local: [0, 0], yaw: 0 }, { mine: true, uid: 3, local: [DECK_LOCAL_BOUND + 1, 0, 0], yaw: 0 },
    { mine: true, uid: 3, local: [0, 0, 0], yaw: NaN }]) assert.equal(validDeck(bad), null, JSON.stringify(bad));
  assert.ok(Math.abs(deckYaw(deckMatrix([5, 0, 5], 90)) - Math.PI / 2) < 1e-9, 'her bow along +x: a quarter turn');
  assert.ok(Math.abs(deckYaw(deckMatrix([0, 0, 0], -30, 3)) + Math.PI / 6) < 1e-9, 'her scale is no part of her heading');
});

test('DECK-CAMP THE WIRE: `d` says her owner (\'\' the sender\'s own), her number and the point on her; a bad `d` refuses the record whole; read back from where each player stands - the sender\'s own boat is that peer\'s, one named by my id is mine, any other its owner\'s', () => {
  const camp = { id: 'p1:1', kind: CAMP_KIND.Fire, pos: [10, 2, 20], yaw: 0.3, litUntil: 99, wear: 2, deck: { mine: true, uid: 7, local: [0.5, 1.25, -2], yaw: 0.25 } };
  const w = campWire(camp);
  assert.deepEqual(w.d, ['', 7, 0.5, 1.25, -2, 0.25]);
  assert.equal(campWire({ ...camp, deck: { peer: 'p2', uid: 4, local: [0, 0, 0], yaw: 0 } }).d[0], 'p2', 'on another\'s boat: her owner by id');
  assert.equal(campWire({ ...camp, deck: undefined }).d, undefined, 'ashore: no `d`');
  assert.deepEqual(validCampRecord(w).d, ['', 7, 0.5, 1.25, -2, 0.25]);
  for (const d of [['', 7, 0, 0], ['', 0, 0, 0, 0, 0], ['', 7, 999, 0, 0, 0], ['bad id!', 7, 0, 0, 0, 0], [3, 7, 0, 0, 0, 0], 'x'])
    assert.equal(validCampRecord({ ...w, d }), null, `refused whole: ${JSON.stringify(d)}`);
  const r = validCampRecord(w);
  assert.deepEqual(campFromWire(r, 'p1', (p) => p, 'me').deck, { peer: 'p1', uid: 7, local: [0.5, 1.25, -2], yaw: 0.25 }, 'the sender\'s own boat: theirs');
  assert.deepEqual(campFromWire({ ...r, d: ['me', 7, 0, 0, 0, 0] }, 'p1', (p) => p, 'me').deck, { mine: true, uid: 7, local: [0, 0, 0], yaw: 0 }, 'my boat: mine');
  assert.deepEqual(campFromWire({ ...r, d: ['p3', 5, 0, 0, 0, 0] }, 'p1', (p) => p, 'me').deck, { peer: 'p3', uid: 5, local: [0, 0, 0], yaw: 0 }, 'a third player\'s: theirs');
  assert.equal(mergeOwnerCamps([], 'p1', [w], (p) => p, 'me')[0].deck.peer, 'p1', 'the owner\'s word merged with it');
});

test('DECK-CAMP THE RIDE: placed on her deck it is hers - its point and heading in her frame - and each frame it is posed off her: the fire\'s batch built about its foot and moved by its origin, its light, its box and its tent (her rotation, never her scale) where she is; out of sight it is out of sight with her (mutants: posed once; the tent on the world\'s yaw)', async () => {
  setWorldMinutes(1000);
  const h = host();
  const kit = createSurvivalItem(TEMPLATE.Campfire, { condition: 2 }), gear = createSurvivalItem(TEMPLATE.CampingEquipment);
  h.entity.items.push(kit, gear);
  assert.equal(h.camps.placeItem(kit, h.entity.items), true);
  await settle();
  const c = h.camps.camps[0];
  assert.deepEqual(c.rec.deck, { mine: true, uid: 7, local: [0, 0, 2.5], yaw: 0 }, 'her number, the point on her');
  assert.equal(c.pixelKey, null, 'a deck\'s camp is no pixel\'s');
  const b = c.batch;
  assert.deepEqual(b.centers, [[0, 0, 0]], 'built about its own foot');
  assert.deepEqual(b.origin, [0, 0, 2.5]);
  // she sails on and comes round a quarter
  h.boat.m = deckMatrix([10, 0.5, 20], 90);
  h.camps.ride(0.1);
  assert.ok(close(c.rec.pos, [12.5, 0.5, 20]), `posed off her: ${c.rec.pos}`);
  assert.ok(Math.abs(c.rec.yaw - Math.PI / 2) < 1e-9, 'turned with her');
  assert.equal(c.batch, b, 'never rebuilt');
  assert.ok(close(b.origin, [12.5, 0.5, 20]), 'the flame moved by its origin');
  h.state.feet = [12, 1, 20];
  assert.ok(close([h.camps.lights()[0].x, h.camps.lights()[0].z], [12.5, 20]), 'its light where she is');
  const box = h.camps.targets().find((t) => t.key === `camp:${c.rec.id}`);
  assert.ok(box && box.aabb.min[0] < 12.5 && box.aabb.max[0] > 12.5, 'its box where she is');
  h.boat.m = deckMatrix([10, 0.5, 20], 120);
  h.camps.ride(0.1);
  assert.ok(close(c.rec.pos, outOfDeck(h.boat.m, [0, 0, 2.5])), 'every frame, not once');
  // a tent on her, she scaled and turned: laid at its point on her by her rotation alone
  h.state.feet = [0, 1, 0]; h.boat.m = deckMatrix([0, 0, 0], 0);
  assert.equal(h.camps.placeItem(gear, h.entity.items), true);
  await settle();
  h.boat.m = deckMatrix([30, 1, -5], 45, 2);
  h.camps.ride(0.1);
  h.drawn.length = 0;
  h.camps.draw();
  assert.equal(h.drawn.length, 1, 'the tent drawn');
  const m = h.drawn[0];
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(Math.hypot(m[4 * k], m[4 * k + 1], m[4 * k + 2]) - 1) < 1e-6, 'no part of her scale');
  const tent = h.camps.camps[1].rec;
  const at = outOfDeck(h.boat.m, [tent.deck.local[0] - Math.sin(tent.deck.yaw) * TENT_BEHIND, tent.deck.local[1], tent.deck.local[2] - Math.cos(tent.deck.yaw) * TENT_BEHIND]);
  assert.ok(close([m[12], m[13], m[14]], at, 1e-4), 'at the tent\'s point on her deck');
  assert.ok(Math.abs(Math.atan2(m[8], m[10]) - Math.PI / 4) < 1e-6, 'facing as she faces');
  // out of sight: both out of sight with her, kept
  h.boat.state = 'hidden';
  h.camps.ride(0.1);
  assert.deepEqual(h.camps.lights(), [], 'no light');
  assert.equal(h.camps.batches().length, 0, 'no flame');
  assert.equal(h.camps.targets().filter((t) => t.key.startsWith('camp:')).length, 0, 'nothing to pick');
  h.drawn.length = 0; h.camps.draw();
  assert.equal(h.drawn.length, 0, 'no tent');
  assert.equal(h.camps.camps.length, 2, 'kept');
  h.boat.state = 'stand';
  h.camps.ride(0.1);
  assert.equal(h.camps.batches().length, 2, 'back with her - the fire and the tent\'s');
});

test('DECK-CAMP GONE WITH HER: a camp of mine whose boat is no more (packed, laid up, sailed off with her owner) for DECK_GONE_S is struck and its gear packed back with its charges - said once; a peer\'s waits on its owner\'s word; a boat not known yet holds it hidden (mutants: packed at once; a peer\'s packed; never packed)', async () => {
  setWorldMinutes(1000);
  const h = host();
  const kit = createSurvivalItem(TEMPLATE.Campfire, { condition: 2 });
  h.entity.items.push(kit);
  h.camps.placeItem(kit, h.entity.items);
  await settle();
  assert.equal(h.entity.items.length, 0, 'the kit stands');
  const changed = h.state.changed;
  h.boat.state = 'gone';
  h.camps.ride(DECK_GONE_S / 2);
  assert.equal(h.camps.camps.length, 1, 'not at once - a boat a frame away is not gone');
  h.boat.state = 'stand';
  h.camps.ride(0.1);
  h.boat.state = 'gone';
  h.camps.ride(DECK_GONE_S * 0.75);
  assert.equal(h.camps.camps.length, 1, 'the count starts again once she stood');
  h.camps.ride(DECK_GONE_S * 0.5);
  assert.equal(h.camps.camps.length, 0, 'struck');
  assert.equal(h.entity.items.length, 1, 'the Campfire back in the pack');
  assert.equal(h.entity.items[0].currentCondition, 2, 'with its charges');
  assert.deepEqual(h.said.filter((l) => l === CAMP_TEXT.packedWithBoat), [CAMP_TEXT.packedWithBoat], 'said once');
  assert.ok(h.state.changed > changed, 'the room told');
  // a peer's camp on a boat gone: hidden, never mine to strike
  const p = host();
  p.boat.state = 'gone';
  p.camps.applyOwner('p9', [{ i: 'p9:1', k: 1, p: [0, 0, 0], y: 0, u: 9999, w: 1, d: ['', 7, 0, 0, 1, 0] }], (x) => x);
  p.camps.ride(DECK_GONE_S * 3);
  assert.equal(p.camps.camps.length, 1, 'a peer\'s waits on its owner');
  assert.equal(p.camps.camps[0].hidden, true);
});

test('DECK-CAMP SAVED AND SAID: the save keeps her number and the point on her, and a restored camp stands hidden until she stands to pose it; a floating-origin move never rebuilds its flame; a peer\'s word moving her keeps its camp in place, a camp moved ON her stands again', async () => {
  setWorldMinutes(1000);
  const h = host();
  const kit = createSurvivalItem(TEMPLATE.Campfire, { condition: 3 });
  h.entity.items.push(kit);
  h.camps.placeItem(kit, h.entity.items);
  await settle();
  const snap = h.camps.snapshot();
  assert.deepEqual(snap[0].deck, { mine: true, uid: 7, local: [0, 0, 2.5], yaw: 0 });
  const r = host();
  r.boat.state = 'hidden';   // a load: her boats not stood yet
  r.camps.restore(JSON.parse(JSON.stringify(snap)));
  await settle();
  const c = r.camps.camps[0];
  assert.deepEqual(c.rec.deck, snap[0].deck, 'her number and her point kept');
  assert.equal(c.hidden, true, 'hidden until she stands');
  r.camps.ride(DECK_GONE_S * 3);
  assert.equal(r.camps.camps.length, 1, 'never struck while she is only not known');
  r.boat.state = 'stand'; r.boat.m = deckMatrix([100, 0, 100], 180);
  r.camps.ride(0.1);
  assert.ok(close(c.rec.pos, [100, 0, 97.5]), `posed off her: ${c.rec.pos}`);
  r.camps.restore([{ ...snap[0], id: 'me:9', deck: { mine: true, uid: 0, local: [0, 0, 0], yaw: 0 } }]);
  assert.equal(r.camps.camps.find((x) => x.rec.id === 'me:9')?.rec.deck, undefined, 'a deck out of its law is none: the camp stands where it was saved');
  // the floating origin
  const before = c.batch;
  r.camps.offsetAll([5, 0, 5]);
  assert.equal(c.batch, before, 'not rebuilt');
  assert.ok(close(c.batch.origin, c.rec.pos), 'moved with the world');
  // a peer's word: her moving moves nothing on her
  const p = host();
  p.camps.applyOwner('p9', [{ i: 'p9:1', k: 1, p: [0, 0, 0], y: 0, u: 9999, w: 1, d: ['', 7, 0, 0, 1, 0] }], (x) => x);
  await settle();
  const pc = p.camps.camps[0];
  p.camps.applyOwner('p9', [{ i: 'p9:1', k: 1, p: [50, 0, 50], y: 1, u: 9999, w: 1, d: ['', 7, 0, 0, 1, 0] }], (x) => x);
  assert.equal(p.camps.camps[0], pc, 'the same camp: she sailed, it stayed on her');
  p.camps.applyOwner('p9', [{ i: 'p9:1', k: 1, p: [50, 0, 50], y: 1, u: 9999, w: 1, d: ['', 7, 2, 0, 1, 0] }], (x) => x);
  assert.notEqual(p.camps.camps[0], pc, 'moved on her: stood again');
});

test('DECK-CAMP THE WORLD\'S WIRING by source: the pool handed the boats; the boat under a spot read off the collider\'s surface probe (her bucket), mine by her number, another\'s by theirs, a sea ship none; gone only once the boats are settled (no load, no restore pending) or her owner\'s word names her no more; the ride each exterior frame before the quays, the lights and the world pass - THE FOUR HOSTS: the street alone (a building and a dungeon stand no boat of the camps\', the standalone street no Come Sail Away)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /deck: \{ at: \(pos\) => campDeckAt\(pos\), resolve: \(ref\) => campDeckResolve\(ref\) \},/);
  assert.match(w, /const hit = collider\?\.surfaceHit\?\.\(\[pos\[0\], pos\[1\] \+ 0\.5, pos\[2\]\], \[0, -1, 0\], 1\.5\);\n\s+const boat = typeof hit\?\.key === 'string' && hit\.key\.startsWith\('csaBoat:'\) \? _csaBuckets\.get\(hit\.key\)\?\.boat \?\? null : null;/);
  assert.match(w, /if \(csaRuntime\?\.AllBoats\?\.includes\(boat\)\) return \{ ref: \{ mine: true, uid: boat\.uid \}/);
  assert.match(w, /return !csaRuntime \|\| \(!_loading && !csaRuntime\.pendingRestore\) \? \{ gone: true \} : \{ hidden: true \};/);
  assert.match(w, /return ref\?\.peer && csaPeers\.hasBoat\(ref\.peer, ref\.uid\) \? \{ hidden: true \} : \{ gone: true \};/);
  const rideAt = w.indexOf("if (_mode() === 'exterior') camps.ride(dt);"), quaysAt = w.indexOf('try { quays?.frame(); }');
  assert.ok(rideAt > 0 && rideAt < quaysAt && quaysAt < w.indexOf('quays?.draw(renderer);'), 'after she moved, before the lights and the world pass');
  assert.match(read('src/scenes/comeSailAway/comeSailAwayPeers.js'), /hasBoat: \(owner, uid\) => !!live\.get\(owner\)\?\.boats\?\.some\(\(b\) => b\.uid === uid\),/);
  for (const f of ['src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) assert.ok(!/campDeck|deck: \{ at:/.test(read(f)), `${f}: no deck`);
});

test('AUDIT C&C (lens I): A CAMP OUT OF SIGHT ANSWERS NO REACH - a deck camp hidden with her boat stands at its last posed point, and the rest\'s place (fireNear) still found its fire there: a night slept as a camp\'s beside a fire nobody could see; nor is a hidden fire fed, tended or a night spent at it from there - she stands again, and it answers again (mutants: the place reads every camp; the feed, the tending and the night read one out of sight)', async () => {
  setWorldMinutes(1000);
  const h = host();
  const kit = createSurvivalItem(TEMPLATE.Campfire, { condition: 2 });
  h.entity.items.push(kit);
  h.camps.placeItem(kit, h.entity.items);
  await settle();
  h.camps.ride(0.1);
  const fire = h.camps.camps[0];
  h.state.feet = [...fire.rec.pos];
  assert.equal(h.camps.fireNear(h.state.feet), true, 'standing with her: a fire to sleep by');
  h.boat.state = 'hidden';
  h.camps.ride(0.1);
  assert.equal(fire.hidden, true);
  assert.equal(h.camps.fireNear(h.state.feet), false, 'out of sight with her: no fire at the point she was last seen');
  // the feed: no fire of mine in reach to take the stick
  const wood = createRestItem(REST_ITEM.Firewood);
  h.entity.items.push(wood);
  assert.equal(h.camps.placeItem(wood, h.entity.items), false, 'the Firewood finds no fire');
  assert.equal(fire.rec.wear, 2, 'and feeds none');
  // the tending of a rest at a camp, and the night's charge
  h.entity.isResting = true; h.entity.restKind = 'camp';
  const lit = fire.rec.litUntil;
  setWorldMinutes(lit - 30);
  h.camps.tend();
  assert.equal(fire.rec.litUntil, lit, 'a hidden fire is not tended');
  h.entity.isResting = false; h.entity.restKind = null;
  assert.equal(h.camps.spendNightNear(h.state.feet), false, 'and no night is spent at it');
  assert.equal(fire.rec.wear, 2);
  // she stands again: the fire answers again, and is fed
  h.boat.state = 'stand';
  h.camps.ride(0.1);
  assert.equal(h.camps.fireNear(h.state.feet), true, 'back with her');
  assert.equal(h.camps.placeItem(wood, h.entity.items), true, 'fed');
});
