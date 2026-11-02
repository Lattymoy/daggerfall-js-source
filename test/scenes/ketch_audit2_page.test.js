// AUDIT KETCH II (2026-10-26, the owner: "Can you audit the airship raid. Its a buggy mess"; bible/01-Overview/audits/
// Audit-Ketch-II.md): THE PAGE - the real scenes/ketch/ketchClient.js stood on fakes of its host's seams (no test stood it
// before, and its frame was pinned by its source's text alone: that is how a misplaced `else` stopped every boarding), fed
// the room's words through the wire (net/wire.js validKetchOut). tools/mutants/ketch_audit2.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installEnemyExpansion } from '../../src/systems/enemyExpansion/dexInstall.js';
import { createKetchClient, KT_FALL_WAKE } from '../../src/scenes/ketch/ketchClient.js';
import { KT_SKY } from '../../src/scenes/ketch/ketchSky.js';
import { KT_WORDS } from '../../src/systems/ketch/ketchWords.js';
import { ketchVoyageOf, ketchRoomKey, KT_WATCH_WAVES } from '../../src/net/ketch/ketchLaw.js';
import { deckToDungeon, dungeonToDeck, engineNeeds } from '../../src/net/ketch/ketchDeck.js';
import { newConstruct, bodyWord, mvWord } from '../../src/net/ketch/ketchConstructs.js';
import { voyageStateOf } from '../../src/net/ketch/ketchBrain.js';
import { validKetchOut } from '../../src/net/wire.js';
import { ketchPelletsDue, KT_CONSTRUCT_PELLETS_MAX, KT_PELLETS_OWN, KT_PELLETS_KEY } from '../../src/systems/ketch/ketchSpoils.js';
import { ketchLabWire } from '../../src/tools/ketchLabLink.js';
import { markHostStruck, foeTarget, foeTargetRef, clearFoeTarget } from '../../src/ui/hud/hudFoeTarget.js';
import { ketchKindName } from '../../src/systems/ketch/ketchWords.js';
import { ship as simShip, OWNER, T0 } from '../net/ketch/ketchSim.mjs';

installEnemyExpansion({ log: () => {} });   // the boot's own rows (scenes/shared.js) - a construct's stand-in reads them
const quiet = (f) => { const w = console.warn; console.warn = (...a) => { if (!String(a[0]).startsWith('[kt]')) w(...a); }; try { return f(); } finally { console.warn = w; } };

/** THE PAGE OFF THE SHIP AND ON IT: the real client over fakes of the world host's seams; `tick` the host's frame (a pending
 *  way down taken at the top of the next, as worldModes takes its exit). */
function page({ clock }) {
  const st = { clock, ship: null, mode: 'exterior', mids: [], sent: [], entered: 0, left: 0, pending: false, feetOut: null };
  const store = new Map();
  const online = { status: 'open', ktOk: true, terminal: false, error: null, peers: new Map(), _pose: { x: 1, y: 2, z: 3 }, sendKetch(k, b) { st.sent.push([k, b]); return true; } };
  const modes = {
    get mode() { return st.mode; },
    ktShip: () => st.ship,
    enterKetch: async (o) => { st.entered++; st.ship = { n: o.n, owner: o.owner, key: ketchRoomKey(o.n, o.owner) }; st.mode = 'dungeon'; return true; },
    ktLeave: () => { if (!st.ship) return false; st.left++; st.pending = true; return true; },
    ktPlace: () => {},
    dungeonCtx: { collider: null, weaponRig: () => null, strikePlayer() {} },
  };
  const entity = { health: 50, maxHealth: 100, level: 10, items: [] };
  const col = { buckets: new Map(), addMesh(b, p, i, m) { this.buckets.set(b, m); }, removeBucket(b) { this.buckets.delete(b); } };
  const kc = createKetchClient({
    online: () => online, modes: () => modes, social: () => null, account: { me: () => 'mem0', claim: async () => ({ ok: true }) },
    entity, player: { feetAt: () => [0, 0, 0], grounded: true }, cam: { pos: [0, 0, 0], yaw: 0 }, now: () => st.clock,
    renderer: { createMesh: (m) => ({ m }), drawMesh: () => {}, destroyMesh() {} }, collider: () => col,
    maps: { getLocation: () => ({ mapTableData: { longitude: 1000, latitude: 1000 }, exterior: { exteriorData: { width: 8, height: 8, blockNames: ['A'] } } }) },
    state: { pixelTranslation: (x, y, o) => { o[0] = 0; o[1] = 0; o[2] = 0; return o; } }, heightAt: () => 50, feetOutside: () => st.feetOut,
    say: () => {}, mid: (t) => st.mids.push(t), store: { get: (k) => store.get(k) ?? null, set: (k, v) => store.set(k, v) },
  });
  const tick = (ms = 16) => { if (st.pending) { st.pending = false; st.ship = null; st.mode = 'exterior'; } quiet(() => kc.frame()); st.clock += ms; };
  return { kc, st, entity, tick };
}
/** Stand in her lowered anchor-lift until the ride up: the frames it took, or Infinity. */
async function rideUp(P) {
  P.st.feetOut = [1e4, 0, 1e4];   // out of the cage first (one set down by the way down steps out of it - ketchSky.js)
  for (let k = 0; k < 4; k++) P.tick(16);
  P.st.feetOut = [...P.kc.sky.frame().lift];   // where her lift hangs now (the sky's own answer)
  const was = P.st.entered, until = Date.now() + 10_000;
  for (let k = 0; k < 400 || Date.now() < until; k++) {   // its boarding awaits the captain's digest - on a loaded machine, real time
    P.tick(16);
    await new Promise((r) => (k < 400 ? setImmediate(r) : setTimeout(r, 5)));
    if (P.st.entered > was) return k;
  }
  return Infinity;
}

test('AUDIT KETCH II L2-1 OFF THE SHIP THE PAGE DRIVES HER SKY: standing in her lowered anchor-lift rides it up - she is drawn and boarded; a fall from her wakes the body in the fields at KT_FALL_WAKE of its health with the fall\'s word said, and the next death aboard falls again (an `else` hung on `!aboard` ran the sky aboard alone: she was never drawn, nobody boarded, a fall woke at 1 HP and the next death aboard never fell; mutants: the sky aboard alone; the fall never woken)', async () => {
  const v = ketchVoyageOf(2), P = page({ clock: v.at + KT_SKY.lower + 5000 });
  const k = await rideUp(P);
  assert.ok(Number.isFinite(k) && P.st.entered === 1, 'standing in the lift rode it up');
  assert.ok(P.st.mids.includes(KT_WORDS.boarding), 'the boarding said');
  P.entity.health = 1;
  P.kc.word({ k: 'bd' });   // the count's fall, nobody aboard to raise me
  assert.equal(P.st.left, 1, 'the fall walks me down');
  P.tick(); P.tick();
  assert.equal(P.entity.health, Math.round(P.entity.maxHealth * KT_FALL_WAKE), 'woken in the fields at a quarter of my health');
  assert.ok(P.st.mids.includes(KT_WORDS.died), 'and the fall said');
  assert.ok(Number.isFinite(await rideUp(P)) && P.st.entered === 2, 'up again');
  P.kc.word({ k: 'bd' });
  assert.equal(P.st.left, 2, 'the next death aboard falls too');
});

test('AUDIT KETCH II L2-3 MY BODY\'S WORD THE WHOLE VOYAGE: aboard in the Watch, never counted into the Warden\'s fight, the page says its health (`vt`) - the room counts every blow on me from the Watch on and heard my heals in the Warden\'s fight alone, so an honest crew fell by the count before the bridge (mutants: the body said in the fight alone)', async () => {
  const v = ketchVoyageOf(2), P = page({ clock: v.at + KT_SKY.lower + 5000 });
  assert.ok(Number.isFinite(await rideUp(P)), 'aboard');
  P.tick();   // the first frame aboard, then the room's hello
  P.kc.word(validKetchOut({ ...voyageStateOf(Object.assign(simShip(1), { n: 2 }), P.st.clock), wv: 3 }));
  for (let k = 0; k < 300; k++) { P.entity.health = 30 + (k % 70); P.tick(16); }
  assert.ok(P.st.sent.some(([w]) => w === 'vt'), 'my health said in the Watch');
});

/** THE PAGE ABOARD voyage 1's ship (ketchSim's crew), its piles laid where the dungeon lays them; `store` the device's. */
function aboard(store = new Map(), owner = OWNER) {
  let T = T0;
  const piles = [], pushed = [];
  const entity = { health: 100, maxHealth: 100, level: 30, items: [], characterId: 'char-1', goldPieces: 0 };
  entity.items.push = function (...a) { pushed.push(...a); return Array.prototype.push.apply(this, a); };
  const shipRec = { n: 1, owner, key: ketchRoomKey(1, owner) };
  const modes = {
    mode: 'dungeon', ktShip: () => shipRec, ktLeave: () => true, ktPlace: () => {}, enterKetch: async () => true,
    dungeonCtx: { layRemains: (items, at) => { piles.push({ n: items[0].stackCount, deck: dungeonToDeck(at[0], at[1], at[2]) }); return { id: piles.length }; }, collider: null, strikePlayer: () => {}, weaponRig: () => null },
  };
  const online = { status: 'open', ktOk: true, sendKetch: () => true, peers: new Map(), _pose: null };
  const kc = createKetchClient({
    online: () => online, modes: () => modes, account: { me: () => 'mem0', claim: async () => ({ ok: false, error: 'offline' }) },
    entity, player: { feetAt: () => deckToDungeon(0, 0, 30), grounded: true }, cam: { pos: [0, 0, 0], yaw: 0 }, now: () => T,
    store: { get: (k) => store.get(k) ?? null, set: (k, v) => store.set(k, v) },
  });
  const V = simShip(1);
  let id = 1000;
  const word = (w) => { const p = validKetchOut(w); assert.ok(p, `the wire takes ${w.k}`); kc.word(p); };
  const frame = (ms = 250) => { quiet(() => kc.frame()); T += ms; };
  frame();   // the first frame aboard (the hello's whole state comes after it, as the room's does)
  word(voyageStateOf(V, T));
  /** a construct risen on her deck, its walk if it has one; answers its id */
  const rise = (kind, floor, x, z, mv = null) => {
    const B = newConstruct(++id, kind, floor, x, z, 0, 100, T, { upAt: T - 5000 });
    word({ k: 'nb', b: bodyWord(B), up: B.upAt, wk: 1 });
    if (mv) { B.mv = { x, z, tx: mv[0], tz: mv[1], v: mv[2], at: T }; word(mvWord(B, T)); }
    frame();
    return B.id;
  };
  const fall = (o, { sw = false, late = 0 } = {}) => { word({ k: 'dn', o, n: sw ? '' : 'Mem', at: T - late, ...(sw ? { sw: 1 } : {}) }); frame(); frame(); };
  return { kc, piles, pushed, rise, fall, frame, word, get T() { return T; } };
}

test('AUDIT KETCH II L3-3, L3-4, L3-5 A CONSTRUCT\'S PELLETS - WHO FELLED IT, AND WHERE: a body the ship took off (`dn` `sw` - the engine fed, a fight lost, the Warden\'s fall) drops none; a fall heard late still lies on the deck\'s floor, never sunk under it where no press reaches; a body felled mid-walk drops where it fell, its walk stepped - never at the walk\'s start, up to 23 m back (mutants: the sweep paid; the pile at its sinking; the walk unstepped)', () => {
  const A = aboard();
  A.fall(A.rise('sphere', 'waist', 4, 30), { sw: true });
  assert.equal(A.piles.length, 0, 'the ship\'s own sweep pays nothing');
  A.fall(A.rise('sphere', 'waist', -4, 30), { late: 900 });
  assert.equal(A.piles.length, 1, 'a felled body pays');
  assert.ok(Math.abs(A.piles[0].deck[1]) < 0.05, `on the deck's floor (y ${A.piles[0].deck[1].toFixed(2)})`);
  const c = A.rise('sphere', 'waist', 0, 20, [0, 40, 4]);
  for (let k = 0; k < 11; k++) A.frame();   // some three seconds on its walk
  A.fall(c);
  const at = A.piles.at(-1).deck;
  assert.equal(A.piles.length, 2);
  assert.ok(at[2] > 28 && at[2] < 36, `where it fell, its walk stepped (z ${at[2].toFixed(2)})`);
  assert.equal(validKetchOut({ k: 'dn', o: 1001, n: '', at: 5, sw: 1 }).sw, 1, 'the wire carries `sw` (its empty name reads "Traveller" - a name says nothing of who felled it)');
  assert.deepEqual(validKetchOut({ k: 'dn', o: 1001, n: 'Ann', at: 5 }), { k: 'dn', o: 1001, n: 'Ann', at: 5 }, 'and a kill without it');
});

test('AUDIT KETCH II L3-1, L3-2 THE CONSTRUCTS\' PELLETS\' CAP IS A VOYAGE\'S, AND THE BOSSES PAY THEIR OWN: the Watch\'s and the vents\' stop at KT_CONSTRUCT_PELLETS_MAX for her voyage on the device - a page stood again (a reload) or on a second crew\'s ship that voyage pays none more; a Hammer Warden, the Watch-Captain and the Tonal Warden pay theirs past it (the cap was a page\'s and a room\'s - three reloads farmed 281 at the vents - and spent before the bosses, who paid nothing; mutants: the cap a room\'s in memory; the bosses capped)', () => {
  assert.deepEqual([...KT_PELLETS_OWN], ['warden', 'captain', 'tonal']);
  assert.deepEqual(ketchPelletsDue('sphere', 4, KT_CONSTRUCT_PELLETS_MAX - 2), { n: 2, given: KT_CONSTRUCT_PELLETS_MAX });
  assert.deepEqual(ketchPelletsDue('spider', 1, KT_CONSTRUCT_PELLETS_MAX), { n: 0, given: KT_CONSTRUCT_PELLETS_MAX });
  for (const k of ['warden', 'captain', 'tonal']) assert.deepEqual(ketchPelletsDue(k, 12, KT_CONSTRUCT_PELLETS_MAX), { n: 12, given: KT_CONSTRUCT_PELLETS_MAX }, k);
  const store = new Map(), A = aboard(store);
  for (let k = 0; k < 40; k++) A.fall(A.rise('sphere', 'waist', (k % 8) - 4, 20 + k));
  const capped = A.piles.reduce((s, p) => s + p.n, 0);
  assert.equal(capped, KT_CONSTRUCT_PELLETS_MAX, 'the Watch\'s stop at the cap');
  assert.deepEqual(store.get(KT_PELLETS_KEY), { n: 1, given: KT_CONSTRUCT_PELLETS_MAX }, 'kept on the device for her voyage');
  A.fall(A.rise('warden', 'landing', 0, 118));
  assert.ok(A.piles.length > 0 && A.piles.at(-1).n >= 8, 'a Hammer Warden pays past it');
  for (const owner of [OWNER, 'fedcba9876543210']) {
    const B = aboard(store, owner);
    for (let k = 0; k < 6; k++) B.fall(B.rise('sphere', 'waist', k - 3, 30));
    assert.equal(B.piles.length, 0, owner === OWNER ? 'the page stood again: none more' : 'a second crew\'s ship that voyage: none more');
  }
});

test('AUDIT KETCH II L3-6 THE KETCHMASTER\'S HOLD\'S OWED WORD IS SAID AGAIN: the world host resends every pool\'s owed spent words - the Ketch\'s with the Hour\'s and the gate\'s (its own stood owed for ever; mutants: the Ketch\'s pool left out)', () => {
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /for \(const pool of \[spoilsPool, sdSpoilsPool, ketch\?\.spoils\]\) pool\?\.resendSpent\?\.\(\);/);
});

test('AUDIT KETCH II L5-6 THE LAB SAYS THE WATCH\'S FIVE AND THE ENGINE\'S APPETITE: `?wv=4` and `?wv=5` are the waves they name, and the engine\'s need is its crew\'s (it stood at three waves and the old appetite; mutants: the waves at three; the old need)', () => {
  for (let w = 0; w <= KT_WATCH_WAVES; w++) assert.equal(ketchLabWire(`?wv=${w}`, 1000).wv, w, `wave ${w}`);
  assert.equal(ketchLabWire('?stage=2', 1000).cl.nd, engineNeeds(4), 'the lab\'s crew of four');
});

test('AUDIT KETCH II STAND-IN-BAR THE CONSTRUCTS HAVE A HEALTH BAR: a blow of mine that went on one of her constructs (the dungeon host\'s landOnHost - every event\'s host: the gate\'s legion, the Spire\'s, the Hour\'s Echoes, her constructs) marks it for the target bar, named, its health the relay\'s word of it - never its stand-in\'s count nothing empties; it goes at its fall; a blow that did not go marks nothing (the owner: "the additional enemies dont have health bars" - landOnHost never marked one; mutants: never marked; the stand-in\'s count read; the host\'s return unwrapped)', () => {
  clearFoeTarget();
  const A = aboard(), o = A.rise('sphere', 'waist', 2, 30);
  const T = A.kc.hostTargets().find((q) => q.i === o);
  assert.ok(T?.entity, 'the construct stands as a host body');
  assert.equal(markHostStruck({ host: o, entity: T.entity, dead: false }, false), false);
  assert.equal(foeTarget(), null, 'a blow that did not go: no bar');
  assert.equal(markHostStruck({ host: o, entity: T.entity, dead: false }, true), true);
  let bar = foeTarget();
  assert.ok(bar && bar.name.includes(ketchKindName('sphere')), `named (${bar?.name})`);
  assert.equal(bar.health / bar.maxHealth, 1, 'whole');
  A.word({ k: 'hp', h: [[o, 40]] }); A.frame();
  bar = foeTarget();
  assert.ok(Math.abs(bar.health / bar.maxHealth - 0.4) < 1e-9, `the relay's word of it (${(bar.health / bar.maxHealth).toFixed(3)})`);
  assert.equal(foeTargetRef(), T.entity);
  A.fall(o);
  assert.equal(foeTarget(), null, 'gone at its fall');
  assert.equal(foeTargetRef(), null);
  clearFoeTarget();
  const dc = readFileSync(new URL('../../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(dc, /return markHostStruck\(hb, sdRemnant \? sdRemnant\.echoHit\(\{ i: hb\.host, d: damage, r \}\) : !!opts\.onHostHit\?\.\(\{ i: hb\.host, d: damage, r, tick \}\)\); \};/, 'every host body\'s blow goes through it');
});
