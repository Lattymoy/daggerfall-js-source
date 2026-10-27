// AUDIT KETCH II (2026-10-26, the owner: "Can you audit the airship raid. Its a buggy mess"; bible/01-Overview/audits/
// Audit-Ketch-II.md): THE RELAY AND THE VOYAGE'S LAW - the pure director (net/ketch/ketchBrain.js, ketchConstructs.js,
// ketchWarden.js, ketchLaw.js), the wire (net/wire.js) and the real Room over its fake storage (test/fakeRoom.mjs).
// tools/mutants/ketch_audit2.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRooms } from '../../fakeRoom.mjs';
import { SOCIAL_ROOM, KT_VOYAGE_KEY, KT_VOYAGE_N_MAX, ketchReceiptKey, validKetchOut, validKetchIn, validKtRcTell } from '../../../src/net/wire.js';
import { instanceOwnerOf } from '../../../src/net/instanceRoom.js';
import { ketchRoomKey, ketchVoyageOf, KT_STAGE, KT_WATCH_WAVES, KT_LAST_MS } from '../../../src/net/ketch/ketchLaw.js';
import { deckToDungeon, KT_WATCH_SPOTS, ketchBowHalf, KT_ANCHOR, KT_CRADLES, KT_ARCS, KT_LIFT, KT_SOCKETS, KT_ENGINE, KT_VENTS, KT_HOLD } from '../../../src/net/ketch/ketchDeck.js';
import { KETCH_SEAM, KW_ENDS_MS, KW_OPENING_MS, KW_LOST_MS } from '../../../src/net/ketch/ketchWarden.js';
import { KT_RECEIPT_VOYAGE_MAX } from '../../../src/net/ketch/ketchReceipt.js';
import { newVoyage, joinVoyage, stepVoyage, voyageStateOf, watchWave, KT_POSE_FRESH_MS, KT_PLACE_KEEP_MS, KT_DOWN_MS } from '../../../src/net/ketch/ketchBrain.js';
import { newConstruct, beatConstruct, constructAt, keepOnFloor, clearOf, steer, KT_FLOORS, KT_OBSTACLES, KT_KINDS, KT_KEEP_BACK_MS } from '../../../src/net/ketch/ketchConstructs.js';
import { ship as simShip, seeded, T0, bodiesOf, toEngine, feed } from './ketchSim.mjs';


test('AUDIT KETCH II L2-2, L1-2 THE WHOLE SHIP\'S WORD CARRIES THE WATCH\'S FOURTH AND FIFTH WAVES: a `st` at every wave the Watch has comes through the wire as that wave - it stood at three after KETCH-LONGER made five, and every state word (every five seconds, and every hello) told the page "the Watch is waiting" (mutants: the `st` wave at three)', () => {
  const V = simShip(1);
  for (let w = 0; w <= KT_WATCH_WAVES; w++) assert.equal(validKetchOut({ ...voyageStateOf(V, T0), wv: w }).wv, w, `wave ${w}`);
  assert.equal(validKetchOut({ ...voyageStateOf(V, T0), wv: KT_WATCH_WAVES + 1 }).wv, 0, 'none past the last');
});

test('AUDIT KETCH II L3-3 THE SHIP\'S OWN SWEEP IS SAID SO: the engine fed takes every spider off the hold with `sw` on its `dn` - nobody felled it, and the page lays no Pellets for it (it was a kill to every screen, its name empty; mutants: the sweep unmarked)', () => {
  const V = simShip(2), fed = feed(V, toEngine(V));
  const dn = fed.frames.filter((f) => f.k === 'dn');
  assert.ok(dn.length > 0, 'spiders stood when the engine was fed');
  for (const f of dn) assert.equal(f.sw, 1, `body ${f.o}`);
});

test('AUDIT KETCH II L1-8 A VOYAGE\'S NUMBER ON THE WIRE IS A RECEIPT\'S: KT_VOYAGE_N_MAX is KT_RECEIPT_VOYAGE_MAX - 10,000 was two centuries of Saturdays, and a voyage every ten hours passed it in 2038, after which no receipt was kept at the hub and no share said spent (mutants: the old bound)', () => {
  assert.equal(KT_VOYAGE_N_MAX, KT_RECEIPT_VOYAGE_MAX);
  const n = 10_001;
  assert.ok(new Date(ketchVoyageOf(n).at).getUTCFullYear() < 2040, 'that voyage sails within the game\'s life');
  assert.deepEqual(validKetchIn({ k: 'spent', n }), { k: 'spent', n });
  assert.ok(validKtRcTell({ n, rc: [] }), 'its fall told to the hub');
});

test('AUDIT KETCH II L1-3 A CONSTRUCT\'S HEALTH IS THE CREW\'S, NOT WHO POSED LAST: seven of a crew stepped off 30 s before the Watch\'s last fall (well inside KT_PLACE_KEEP_MS) - the Hammer Wardens are born at the whole crew\'s health all the same; it was read off the crew seen in the last KT_POSE_FRESH_MS, and they came up at the one low hand\'s share, 76 times weaker (mutants: the crew a pose\'s fresh)', () => {
  assert.ok(KT_PLACE_KEEP_MS > KT_POSE_FRESH_MS);
  const run = (away) => {
    const V = newVoyage(ketchRoomKey(1, '0123456789abcdef'), T0), rng = seeded(4);
    for (let k = 0; k < 7; k++) joinVoyage(V, `hi${k}`, `H${k}`, 60, T0);
    joinVoyage(V, 'alt', 'Alt', 1, T0);
    let now = T0, lastAt = 0;
    const where = (who) => Object.fromEntries(who.map((s, k) => [s, [-6 + k * 1.5, 0, 30]]));
    while (V.sg === KT_STAGE.watch) {
      now += 250;
      const last = V.watch.wave === KT_WATCH_WAVES;
      if (last && !lastAt) lastAt = now;
      stepVoyage(V, now, bodiesOf(where(last && away ? ['alt'] : V.crew)), rng);
      const up = V.bodies.filter((B) => B.floor === 'waist' && B.h > 0 && now >= B.upAt);
      if (!last) for (const B of up) { B.h = 0; B.downAt = now; }
      else { for (const B of up.slice(1)) { B.h = 0; B.downAt = now; } if (up[0] && now - lastAt > KT_POSE_FRESH_MS + 5000) { up[0].h = 0; up[0].downAt = now; } }
      assert.ok(now - T0 < 30 * 60_000, 'the Watch breaks');
    }
    for (let k = 0; k < 8; k++) { now += 250; stepVoyage(V, now, bodiesOf(where(V.crew)), rng); }
    return V.bodies.filter((B) => B.kind === 'warden').map((B) => B.m);
  };
  const all = run(false), stepped = run(true);
  assert.equal(all.length, 2);
  assert.deepEqual(stepped, all, 'the same Wardens');
});

test('AUDIT KETCH II L1-7 THE WATCH\'S SENTRIES EACH HAVE A POST: every wave at every crew size asks no more Sentries than there are posts, every post its own and clear of what stands on the waist - the fourth wave at a crew of six to eight asked five or six of four, and two stood on one post, drawn as one and firing twice (mutants: four posts)', () => {
  const posts = KT_WATCH_SPOTS.sentry, r = KT_KINDS.sentry.r;
  for (let w = 1; w <= KT_WATCH_WAVES; w++) for (let n = 1; n <= 8; n++) assert.ok(watchWave(w, n).sentry <= posts.length, `wave ${w}, crew ${n}`);
  assert.equal(new Set(posts.map((p) => p.join())).size, posts.length, 'each its own');
  for (const [x, z] of posts) {
    assert.deepEqual(clearOf('waist', x, z, r), [x, z], `(${x}, ${z}) clear of the waist's cover`);
    assert.deepEqual(keepOnFloor(KT_FLOORS.waist, x, z, r + 0.3), [x, z], `(${x}, ${z}) on the waist`);
  }
});

test('AUDIT KETCH II L1-6 A SENTRY CHASED STILL SHOOTS: a member keeping inside half a Sentry\'s range - chasing it in the open, or pinning it in a corner - is shot within a few seconds (KT_KEEP_BACK_MS of backing off, then a bolt where it stands); it was never shot at all, and the fourth wave\'s wall of Sentries was harmless to melee (mutants: it backs off for ever)', () => {
  const rng = seeded(5);
  for (const [label, x0, z0] of [['the open waist', 0, 30], ['a corner', -12, 61]]) {
    const B = newConstruct(1000, 'sentry', 'waist', x0, z0, Math.PI, 500, 0, { wake: true, upAt: 0 });
    const S = { seq: 0 }, out = [], blows = [];
    let me = { sub: 'a', x: x0 + 3, z: z0 - 3 }, first = null;
    for (let now = 0; now <= 30_000; now += 250) {
      const [bx, bz] = constructAt(B, now), dx = bx - me.x, dz = bz - me.z, d = Math.hypot(dx, dz);
      if (d > 3) me = { ...me, x: me.x + (dx / d) * Math.min(d - 3, 1), z: me.z + (dz / d) * Math.min(d - 3, 1) };
      beatConstruct(B, now, [{ ...me, zone: 'waist' }], {}, rng, S, out, blows);
      if (blows.length && first == null) first = now;
    }
    assert.ok(first != null && first <= KT_KEEP_BACK_MS + 3000, `${label}: shot within the back-off and a wind-up (first at ${first} ms)`);
    assert.ok(blows.length >= 4, `${label}: and again (${blows.length} in 30 s)`);
  }
});

test('AUDIT KETCH II L4-4 THE WATCH KEEPS INSIDE THE BOW: on the Anchor Deck a construct is kept inside the bow\'s drawn edge as it narrows forward of its box (KT_BOW, the model\'s own), and a Sentry backing off from a member pressing it toward the bow ends inside her nets - it ended 2.6 m out over them, where no blade reached it (mutants: the bow\'s box)', () => {
  const W = KT_FLOORS.waist;
  for (let z = 0; z < KT_ANCHOR.z1; z += 0.5) for (const s of [1, -1]) {   // the waist's own beam from its z0
    const [x] = keepOnFloor(W, s * 30, z, 1.1);
    assert.ok(Math.abs(x) <= ketchBowHalf(Math.max(1.1, z)) - 1.1 + 1e-9, `z ${z}: |x| ${Math.abs(x).toFixed(2)} inside the bow's ${ketchBowHalf(z).toFixed(2)}`);
  }
  assert.equal(ketchBowHalf(0), 4); assert.equal(ketchBowHalf(6), 8); assert.equal(ketchBowHalf(KT_ANCHOR.z1), KT_ANCHOR.x1);
  const rng = seeded(3);
  for (const s of [1, -1]) {
    const B = newConstruct(1000, 'sentry', 'waist', s * 3, 8, Math.PI, 500, 0, { wake: true, upAt: 0 });
    const S = { seq: 0 }, out = [], blows = [];
    for (let now = 0; now <= 20_000; now += 250) {
      const [bx, bz] = constructAt(B, now);
      beatConstruct(B, now, [{ sub: 'a', x: bx - s * 1.5, z: bz + 3, zone: 'waist' }], {}, rng, S, out, blows);
      const [x, z] = constructAt(B, now);
      assert.ok(Math.abs(x) <= ketchBowHalf(z) + 1e-6, `side ${s} at ${now} ms: (${x.toFixed(2)}, ${z.toFixed(2)}) inside the bow`);
    }
  }
});

test('AUDIT KETCH II L4-8 THE HOLD\'S CONSTRUCTS WALK ROUND WHAT STANDS IN IT: the engine and its ring of sockets, the mast-lift\'s tower, the six cradles and the arc-coils\' posts each an obstacle, and a spider\'s walk from every vent to a carrier at every cradle and socket passes through none of them - a quarter of them walked through a cradle, a post, a socket or the tower (mutants: the engine\'s drum alone)', () => {
  const O = KT_OBSTACLES.hold, has = (x, z, r) => O.some(([ox, oz, or]) => Math.abs(ox - x) < 1e-9 && Math.abs(oz - z) < 1e-9 && or >= r);
  assert.ok(has(KT_ENGINE.x, KT_ENGINE.z, Math.max(...KT_SOCKETS.map(([x, z]) => Math.hypot(x - KT_ENGINE.x, z - KT_ENGINE.z))) + 0.42), 'the engine with its sockets');
  assert.ok(has(KT_LIFT.x, KT_LIFT.z, KT_LIFT.half * Math.SQRT2), 'the tower');
  for (const [x, z] of KT_CRADLES) assert.ok(has(x, z, 0.6 * Math.SQRT2), `the cradle at (${x}, ${z})`);
  for (const z of KT_ARCS.z) for (const s of [-1, 1]) assert.ok(has(s * KT_ARCS.post, z, 0.42), `the post at (${s * KT_ARCS.post}, ${z})`);
  const pad = KT_KINDS.spider.r + 0.2, F = KT_FLOORS.hold;
  const solid = [...KT_CRADLES.map(([x, z]) => [x, z, 0.6 * Math.SQRT2]), ...KT_ARCS.z.flatMap((z) => [-1, 1].map((s) => [s * KT_ARCS.post, z, 0.42])), [KT_LIFT.x, KT_LIFT.z, KT_LIFT.half], [KT_ENGINE.x, KT_ENGINE.z, KT_ENGINE.r]];
  let through = 0, walks = 0;
  for (const [vx, vz] of KT_VENTS) for (const [tx, tz] of [...KT_CRADLES.map(([x, z]) => [x, z + 1.6]), ...KT_SOCKETS.map(([x, z]) => [x * 1.45, KT_ENGINE.z + (z - KT_ENGINE.z) * 1.45])]) {
    let x = vx - Math.sign(vx) * 1.2, z = vz;
    walks++;
    for (let k = 0; k < 40 && Math.hypot(tx - x, tz - z) > 1; k++) {
      let [gx, gz] = keepOnFloor(F, tx, tz, pad + 0.1);
      [gx, gz] = steer('hold', x, z, gx, gz, pad);
      [gx, gz] = clearOf('hold', gx, gz, pad);
      [gx, gz] = keepOnFloor(F, gx, gz, pad + 0.1);
      const L = Math.hypot(gx - x, gz - z);
      if (L < 0.05) break;
      for (let u = 0; u <= 1; u += 0.05) { const px = x + (gx - x) * u, pz = z + (gz - z) * u; if (solid.some(([ox, oz, or]) => Math.hypot(px - ox, pz - oz) < or)) { through++; u = 2; } }
      x = gx; z = gz;
    }
  }
  assert.ok(walks > 40 && through === 0, `${through} of ${walks} walks through something solid`);
  assert.ok(KT_HOLD.x1 > KT_ARCS.post, 'the posts stand inside the hold');
});

test('AUDIT KETCH II L5-1 A CREW ABOARD AS SHE WEIGHS ANCHOR CAN STILL TAKE THE WARDEN\'S WHOLE FIGHT: her crews\' last minutes outlast the Warden\'s own clock (its opening and its turn west) - twenty minutes did not, after KETCH-LONGER made its fight twenty-two, and a crew that boarded at her last minute was shut out with the Warden standing and no receipt (mutants: twenty minutes)', () => {
  assert.ok(KT_LAST_MS > KW_OPENING_MS + KW_ENDS_MS, `${KT_LAST_MS / 60_000} minutes against the fight's ${(KW_OPENING_MS + KW_ENDS_MS) / 60_000}`);
  const v = ketchVoyageOf(5), next = ketchVoyageOf(6);
  assert.ok(v.endAt < next.sightAt, 'gone before she is sighted again');
});

test('AUDIT KETCH II L5-4, L5-5 A FIGHT EMPTIED WAITS FOR A RAISE AND A WAY BACK: the bridge empty KW_LOST_MS loses the fight - longer than a body lies down for a raise (KT_DOWN_MS), and longer than a fall\'s fastest way back up; at thirty seconds a raise inside its window stood a body on a fight already lost, and no solo who fell was back in time (mutants: thirty seconds)', () => {
  assert.ok(KW_LOST_MS > KT_DOWN_MS, 'the raise\'s window inside it');
  assert.ok(KW_LOST_MS >= 2 * KT_DOWN_MS, 'and a fall\'s way back with it');
  const f = KETCH_SEAM.new({ room: 'kt:1.x', fi: 1, now: 0 });
  KETCH_SEAM.join(f, 'acct-a', 'a', 30, 0);
  const rng = seeded(2), on = [{ sub: 'acct-a', x: 0, y: 0, z: 200, dead: false }];
  let now = 0;
  for (; now < 20_000; now += 250) KETCH_SEAM.step(f, now, on, rng);
  let lost = null;
  for (; now < 20_000 + KT_DOWN_MS + 30_000; now += 250) { const out = KETCH_SEAM.step(f, now, [], rng); if (out.some((w) => w.k === 'lost' || w.k === 'wl') || f.lost) { lost = now; break; } }
  assert.equal(lost, null, 'a minute and a half empty: still its fight');
});

/** A world on voyage 1's clock (`clock` from `t0`), its hub seating party p1, the captain alice's ship. */
async function withShip(t0, vars, fn) {
  const realNow = Date.now, warn = console.warn, info = console.info;
  const C = { t: t0 };
  Date.now = () => C.t; console.warn = () => {}; console.info = () => {};
  try {
    const world = fakeRooms({ now: () => C.t, vars });
    const hub = world.room(SOCIAL_ROOM), members = ['acct-alice', 'acct-bobby'];
    for (const m of members) hub.store.set(`acct:${m}`, { name: m.slice(5), party: 'p1' });
    hub.store.set('party:p1', { id: 'p1', leader: members[0], members, invites: [], away: {} });
    const ship = world.room(ketchRoomKey(1, await instanceOwnerOf('acct-alice')));
    await fn({ C, hub, ship });
  } finally { Date.now = realNow; console.warn = warn; console.info = info; }
}
const at = (x, y, z, dd) => { const [a, b, c] = deckToDungeon(x, y, z); return { x: a, y: b, z: c, yaw: 0, pitch: 0, mv: 0, ...(dd ? { dd: 1 } : {}) }; };

test('AUDIT KETCH II L1-4 HER FALL\'S RECEIPTS ARE TOLD TO THE HUB BEFORE HER RECORD GOES: a fall in her last half-minute whose first tell fails (the hub restarting) is told at her end and kept there - her record kept and told again until it is; it was deleted at her end, and an earner off the ship was never paid (mutants: her record deleted untold)', async () => {
  const V1 = ketchVoyageOf(1);
  await withShip(V1.endAt - 20_000, {}, async ({ C, hub, ship }) => {
    const alice = ship.connect(); await ship.hello(alice, 'alice', at(0, 0, 200), { charLevel: 30 });
    const bob = ship.connect(); await ship.hello(bob, 'bobby', at(0, 0, 200), { charLevel: 30 });
    const V = ship.room._kt;
    V.sg = KT_STAGE.bridge; V.bridge = { at: C.t, by: 'alice' };
    V.wf = KETCH_SEAM.new({ room: V.key, fi: 1, now: C.t });
    KETCH_SEAM.join(V.wf, 'acct-bobby', 'bobby', 30, C.t);
    V.wf.players['acct-bobby'].dealt = V.wf.players['acct-bobby'].share; V.wf.liveMs = 60_000;
    V.wf.fell = { at: C.t, top: ['bobby'], n: 1 };
    await ship.drop(bob);   // the earner off the ship at the fall
    const real = hub.room.fetch.bind(hub.room);
    let down = true;
    hub.room.fetch = async (req) => { if (down) throw new Error('hub restarting'); return real(req); };
    await ship.pose(alice, at(0, 0, 200)); C.t += 250; await ship.fire();
    assert.ok(V.said && !V.told, 'said, its first tell failed');
    C.t = V1.endAt + 1000; await ship.fire();
    assert.ok(ship.store.get(KT_VOYAGE_KEY), 'at her end, the hub still down: her record kept');
    down = false;
    C.t = ship.alarm.at; await ship.fire();
    assert.ok(hub.store.get(ketchReceiptKey('acct-bobby')), 'the hub keeps the earner\'s receipt');
    assert.equal(ship.store.get(KT_VOYAGE_KEY), undefined, 'and her record goes, told');
  });
});

test('AUDIT KETCH II L1-5 A RAISED MEMBER IS ALIVE AT ONCE: under the count\'s enforcement, the beat between the room\'s `rez` and the raised page\'s next pose reads its dying pose as old - the member\'s blows land from the raise on; it read it dead again, and the count held it out for BODY_RISE_MS (mutants: the dying pose after the raise believed)', async () => {
  const V1 = ketchVoyageOf(1);
  await withShip(V1.at + 60_000, { BOSS_BODY: '{"enforce":true}' }, async ({ C, ship }) => {
    const alice = ship.connect(); await ship.hello(alice, 'alice', at(0, 0, 30), { charLevel: 30 });
    const bob = ship.connect(); await ship.hello(bob, 'bobby', at(1, 0, 30), { charLevel: 30 });
    const beat = async () => { C.t += 250; await ship.fire(); };
    const V = ship.room._kt;
    await ship.pose(alice, at(0, 0, 30)); await ship.pose(bob, at(1, 0, 30)); await beat();
    for (let k = 0; k < 4; k++) { await ship.pose(bob, at(1, 0, 30, true)); await beat(); }
    assert.ok(V.players['acct-bobby'].lay, 'bob lies where he fell');
    await ship.raw(alice, JSON.stringify({ t: 'kt', k: 'rz', to: 'acct-bobby' }));
    assert.equal(alice.sent.filter((m) => m.t === 'kt' && m.k === 'rez').length, 1, 'raised');
    await beat();   // his last pose, from before the raise, still says he is dying
    let landed = 0;
    for (let k = 0; k < 24; k++) {
      await ship.pose(bob, at(1, 0, 30)); await beat();
      const B = V.bodies.find((q) => q.floor === 'waist' && q.h > 0 && C.t >= q.upAt);
      if (B && k % 4 === 0) { const h0 = B.h; await ship.raw(bob, JSON.stringify({ t: 'kt', k: 'hit', o: B.id, q: 1000 + k, d: 5, r: 1 })); landed += h0 > B.h ? 1 : 0; }
    }
    assert.ok(!V.players['acct-bobby'].lay, 'he lies no more');
    assert.ok(landed >= 5, `his blows land in the six seconds after (${landed} of 6)`);
  });
});
