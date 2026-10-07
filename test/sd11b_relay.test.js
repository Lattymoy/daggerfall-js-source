// SD11b (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 16's AUDIT SD II): THE
// RELAY, AUDITED AGAIN - eight lenses over SD0-SD10b, each finding reproduced before it was fixed. Here the relay's: two
// `in`s that awaited the hub together made two fights; every frame asked the hub on its own, and a missed answer threw a
// good one away; a lost fight's fighters, and idle guests, held the realm's seats; a kill told after the hub said the fade
// was lost; a hello never woke a sleeping fight, nor handed a fallen one's receipt; two tells of one fall at once; a hub
// whose record would not read back numbered the next Hollow from one again; a held receipt never handed on; a stranger's
// junk hellos shut the realm's door; the `in`'s level a claim the token could have signed; a share parked anywhere in the
// realm; a cell telling the hub every frame; a blow judged at a stale instant; `spent` for slots that never rose; and one
// hand spending the Orrery's whole thread. With them, the relay's untested arms (the lens on the tests): the Echoes' and
// the Hearts' blows, the fall's tell retried, the dead in the arena, the director's retry and re-read, the `in` refused.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRooms } from './fakeRoom.mjs';
import {
  SD_KEY, SD_SLOT_KEY, SD_HELD_KEY, SD_FIGHT_KEY, SD_REALM_KEY, SD_HERE_HOLD_MS, SD_TELL_RETRY_MS, SD_INTERNAL_FELL,
  SD_INTERNAL_FOUND, SD_INTERNAL_LIVE, SD_NO_WORDS, SD_FIGHTERS_MAX, SOCIAL_ROOM, CLOSE_BUSY, PIXEL_UNITS, worldRoom,
  chatRegionRoom, sdReceiptKey, validSdOut, CHAT_SOCKETS_MAX,
} from '../src/net/wire.js';
import { sdRoomKey, sdFell, SD_NO_FULL, SD_FADE_GRACE_MS, SD_FIRST_RISE_MS } from '../src/net/sdLaw.js';
import {
  SD_ARENA, realmToDungeon, orreryOf, orreryFresh, orreryStep, orreryTurn, orreryShortest, orrerySolve, orreryRightsFresh,
  orreryTurnerOf, orreryMayTurn, orreryTurned, orreryLashed, SD_TURN_LONG_MAX, SD_TURN_COMPANY_MS, SD_TURN_WAIT_LINE,
  SD_STONE_POS, SD_STONE_SETTLE_MS, SD_FRAY_MAX, SD_STONES, sdHour, sdTurnsFor,
} from '../src/net/sdBrain.js';
import {
  newRemnantFight, joinRemnant, stepRemnant, remnantStateOf, SD_OPENING_MS, SD_LOST_MS, SD_ECHO_SPOTS, SD_TTK_S,
  SD_SHARE_X,
} from '../src/net/sdRemnant.js';
import { HIT_KINDS, dpsRef, ABSENT_RETIRE_MS } from '../src/net/gateBrain.js';
import { mintSdReceipt } from '../src/net/sdReceipt.js';
import { PIXEL_M } from '../src/net/gateLaw.js';
import { SD_FRAY_LASH, inOrreryHall, dungeonToRealm, SD_ORRERY } from '../src/net/sdBrain.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const RELAY = read('server/src/index.js');
const W = read('src/scenes/world.js');
/** A `function name(` of world.js's own, its text. */
const fnOf = (name) => { const at = W.indexOf(`\n  function ${name}(`); assert.ok(at > 0, name); return W.slice(at + 1, W.indexOf('\n  }\n', at) + 4); };
const T0 = 1_800_000_000_000;
const PX = 300, PY = 200;
const UNITS_PER_M = PIXEL_UNITS / PIXEL_M;
const doorPose = (east = 10) => ({ x: (PX + 0.5) * PIXEL_UNITS + east * UNITS_PER_M, y: 0, z: (500 - PY - 0.5) * PIXEL_UNITS, yaw: 0, pitch: 0 });
const inArenaAt = (x = 0, z = -10, extra = {}) => { const [dx, dy, dz] = realmToDungeon(SD_ARENA.x + x, 0, SD_ARENA.z + z); return { x: dx, y: dy, z: dz, yaw: 0, pitch: 0, ...extra }; };
const atStone = (i) => { const [x, y, z] = realmToDungeon(SD_STONE_POS[i].x, 0, SD_STONE_POS[i].z); return { x, y, z, yaw: 0, pitch: 0 }; };
const atThreshold = () => { const [x, y, z] = realmToDungeon(0, 0, 2); return { x, y, z, yaw: 0, pitch: 0 }; };
const fights = (ws) => ws.sent.filter((m) => m.t === 'sd' && m.k !== 'pz' && m.k !== 'ev');
const halls = (ws) => ws.sent.filter((m) => m.t === 'sd' && m.k === 'pz');
const say = (o) => JSON.stringify({ t: 'sd', ...o });
const tick = () => new Promise((r) => setImmediate(r));
const quiet = (fn) => { const warn = console.warn, info = console.info; console.warn = () => {}; console.info = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; console.info = info; }); };
const receipt = (d, s) => mintSdReceipt({ d, s, c: 77, x: 'dealt', l: 30 }, null, { subtle: globalThis.crypto.subtle, nowS: Math.floor(Date.now() / 1000) });

/**
 * The fake world driven to a FOUND Hollow (slot 1) and its realm standing - past the Orrery unless `concord` is false.
 * Every call a room makes to the hub passes a gate the test sets: `mode('ok' | 'down' | 'hold')` (hold queues each call
 * until `release()`); `asks(room, path)` counts a room's calls to the hub by path.
 */
async function withRealm(fn, { concord = true } = {}) {
  const realNow = Date.now;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  try {
    await quiet(async () => {
      const hws = hub.connect(); await hub.hello(hws, 'peer-h1', null, { name: 'H1', acct: 'acct-h1', asecret: 'secret-of-acct-h1' });
      const fire = async (room) => { if (room.alarm.at != null && Date.now() >= room.alarm.at) await room.fire(); };
      await fire(hub);
      clock = hub.room._sdRec.next;
      for (const [id, sub] of [['peer-r1', 'acct-r1'], ['peer-r2', 'acct-r2']]) { const r = world.room(chatRegionRoom(17)); const ws = r.connect(); await r.hello(ws, id, null, { kind: 'linked', tokenSub: sub }); }
      await fire(hub);
      const rec = hub.store.get(SD_KEY);
      const cell = world.room(worldRoom(PX, PY));
      let mode = 'ok';
      const held = [], counts = new Map();
      const gated = (room) => {
        const ROOMS = room.room.env.ROOMS;
        room.room.env.ROOMS = { idFromName: ROOMS.idFromName, get: (id) => ({ fetch: (q) => {
          if (id !== SOCIAL_ROOM) return ROOMS.get(id).fetch(q);
          const key = `${room === cell ? 'cell' : 'realm'}${new URL(q.url).pathname}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
          if (mode === 'down') return Promise.resolve(new Response('', { status: 503 }));
          if (mode === 'hold') return new Promise((res) => held.push(() => res(ROOMS.get(id).fetch(q))));
          return ROOMS.get(id).fetch(q);
        } }) };
      };
      gated(cell);
      const mara = cell.connect(); await cell.hello(mara, 'peer-mara', doorPose(10), { name: 'Mara' });
      await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY }));
      assert.equal(hub.store.get(SD_KEY).ph, 'found');
      const realm = world.room(sdRoomKey(rec.s));
      gated(realm);
      if (concord) { const h = await realm.room._sdHallOf(rec.s); h.ok = true; await realm.room.state.storage.put('sdorrery', h); }
      const beat = async (ms) => { const end = clock + ms; while (realm.alarm.at != null && realm.alarm.at <= end) { clock = Math.max(clock, realm.alarm.at); await realm.fire(); } clock = end; };
      const hello = async (id, pose, over = {}) => { const ws = realm.connect(); await realm.hello(ws, id, pose, { name: id.replace('peer-', ''), ...over }); return ws; };
      await fn({
        world, hub, hws, cell, mara, realm, rec, beat, hello, fire,
        step: (ms) => { clock += ms; }, set: (t) => { clock = t; }, now: () => clock,
        mode: (m) => { mode = m; }, release: () => { const n = held.length; for (const r of held.splice(0)) r(); return n; }, held,
        asks: (room, path) => counts.get(`${room}${path}`) ?? 0,
      });
    });
  } finally { Date.now = realNow; }
}
/** A fight joined by `ws` and woken past its opening. */
async function fightWith(realm, beat, ws, lv = 30) {
  await realm.raw(ws, say({ k: 'in', lv, bv: 1 }));
  await beat(SD_OPENING_MS + 1000);
  return realm.room._sdFight;
}

// ── L3 F1, L3 F2 / L7 M5: two `in`s, one ask ─────────────────────────────

test('SD11b TWO `in`s, ONE FIGHT, ONE ASK (L3 F1, L3 F2/L7 M5): two fighters\' `in`s that await the hub together are answered from ONE ask, and join ONE fight - the fight read again after the last await, decided with none between (it was two fresh fights numbered alike, the last replacing the first\'s fighter); a frame storm while the hub is slow asks it once (mutants: the fight not read again; every frame its own ask)', async () => {
  await withRealm(async ({ realm, hello, step, mode, release, held, asks }) => {
    const ann = await hello('peer-ann', inArenaAt(0, -12)), bo = await hello('peer-bo', inArenaAt(4, -12));
    step(11_000);   // the realm's answer from the hub is stale
    mode('hold');
    const before = asks('realm', SD_INTERNAL_LIVE);
    const pa = realm.raw(ann, say({ k: 'in', lv: 30, bv: 1 }));
    await tick();
    const pb = realm.raw(bo, say({ k: 'in', lv: 30, bv: 1 }));
    await tick();
    assert.equal(held.length, 1, 'one ask in flight for both');
    assert.equal(asks('realm', SD_INTERNAL_LIVE), before + 1);
    mode('ok'); release();
    await pa; await pb;
    const f = realm.room._sdFight;
    assert.deepEqual(Object.keys(f.players).sort(), ['acct-peer-ann', 'acct-peer-bo'], 'one fight, both fighters');
    const stA = fights(ann).filter((m) => m.k === 'st').at(-1), stB = fights(bo).filter((m) => m.k === 'st').at(-1);
    assert.equal(stA.me, 1); assert.equal(stB.me, 1);
    assert.equal(stA.fi, f.fi); assert.equal(stB.fi, f.fi);
    assert.equal(realm.store.get(SD_FIGHT_KEY).fi, f.fi);
    assert.deepEqual(Object.keys(realm.store.get(SD_FIGHT_KEY).players).sort(), ['acct-peer-ann', 'acct-peer-bo'], 'kept as one');
  });
});

test('SD11b A BLOW WHOSE FIGHT WAS REPLACED IS DROPPED (L3 F1): a blow that awaited the hub while its fight was replaced lands nowhere - not on the old fight (a fall on it was kept over the new one), and not as junk (it was fair when said); judged at the instant it lands (L7 L1: an answer out of order moved the purse\'s clock backwards) (mutants: the blow on the old fight; the arrival\'s instant)', async () => {
  await withRealm(async ({ realm, hello, beat, step, mode, release, now }) => {
    const ann = await hello('peer-ann', inArenaAt(0, -12));
    const f = await fightWith(realm, beat, ann);
    step(11_000);
    mode('hold');
    const h0 = f.hp;
    const p = realm.raw(ann, say({ k: 'hit', q: 1, d: 40, r: HIT_KINDS.Spell }));
    await tick();
    realm.room._sdFight = newRemnantFight(f.s, f.fi + 1, now());   // another socket's `in` made a fresh one meanwhile
    const junk = ann.meters.junk ?? 0;
    mode('ok'); release(); await p;
    assert.equal(f.hp, h0, 'not on the old fight');
    assert.equal(ann.meters.junk ?? 0, junk, 'not junk');
    // the purse judged at the landing: a blow held three seconds is spent at its resolving
    realm.room._sdFight = f;
    step(11_000);
    mode('hold');
    const sent = now();
    const p2 = realm.raw(ann, say({ k: 'hit', q: 2, d: 40, r: HIT_KINDS.Spell }));
    await tick();
    step(3000);
    mode('ok'); release(); await p2;
    assert.equal(f.hp < h0, true, 'it landed');
    assert.equal(f.players['acct-peer-ann'].bucketAt, sent + 3000, 'at the instant it was judged');
  });
});

// ── L3 F2: a missed answer ──────────────────────────────────────────────

test('SD11b A MISSED ANSWER (L3 F2): a hub that misses an answer is not asked again for 2 s (every hello and frame asked again while it struggled) - and the last answer the realm had stands through it, 5 minutes at most (a fighter was refused busy for a good record thrown away); a realm that never had one says busy (mutants: no back-off; the last answer thrown away; kept for ever)', async () => {
  await withRealm(async ({ realm, hello, step, mode, asks }) => {
    const ann = await hello('peer-ann', inArenaAt(0, -12));
    assert.equal(ann.closed, null, 'answered: in');
    step(11_000);
    mode('down');
    const n0 = asks('realm', SD_INTERNAL_LIVE);
    const bo = await hello('peer-bo', inArenaAt(3, -12));
    assert.equal(bo.closed, null, 'a miss: the last answer stands');
    assert.equal(asks('realm', SD_INTERNAL_LIVE), n0 + 1, 'asked once');
    const cy = await hello('peer-cy', inArenaAt(-3, -12));
    assert.equal(cy.closed, null);
    assert.equal(asks('realm', SD_INTERNAL_LIVE), n0 + 1, 'inside the back-off: not asked again');
    step(2000);
    const dee = await hello('peer-dee', inArenaAt(-3, -14));
    assert.equal(dee.closed, null);
    assert.equal(asks('realm', SD_INTERNAL_LIVE), n0 + 2, 'past it: asked again');
    step(5 * 60_000);
    const eve = await hello('peer-eve', inArenaAt(-5, -12));
    assert.deepEqual(eve.closed, { code: CLOSE_BUSY, reason: 'busy' }, 'five minutes on: the last answer is too old to stand - busy');
  });
});

// ── L3 F3, L7 M3: the seats ─────────────────────────────────────────────

test('SD11b A LOST FIGHT SEATS NOBODY (L3 F3): a full realm frees the seat of a fighter in a fight that is lost, or one no beat has moved for SD_LOST_MS - only a LIVING fight\'s fighters keep theirs (mutants: any fight\'s players keep their seats)', async () => {
  for (const how of ['lost', 'stale']) {
    await withRealm(async ({ realm, rec, hello, beat, step }) => {
      const ann = await hello('peer-ann', inArenaAt(0, -12));
      const f = await fightWith(realm, beat, ann);
      const r = await realm.room._sdRealmOf(rec.s);
      const fighters = Array.from({ length: SD_FIGHTERS_MAX - 1 }, (_, k) => `acct-f${k}`);
      for (const x of fighters) f.players[x] = { ...f.players['acct-peer-ann'], name: x };
      r.in.push(...fighters);
      const bo = await hello('peer-bo', inArenaAt(3, -12));
      assert.deepEqual(bo.closed?.reason, SD_NO_FULL, 'a living fight: full');
      if (how === 'lost') f.lost = { at: Date.now() }; else step(SD_LOST_MS + 1);
      const cy = await hello('peer-cy', inArenaAt(3, -12));
      assert.equal(cy.closed, null, `a ${how} fight: a seat freed`);
      assert.equal(r.in.length, SD_FIGHTERS_MAX);
      assert.ok(r.in.includes('acct-peer-cy') && r.in.includes('acct-peer-ann'), 'the one standing here keeps hers');
    });
  }
});

test('SD11b GUESTS HOLD AT MOST 64 SEATS (L7 M3): guests - a click each - hold at most SD_GUEST_SEATS of a realm\'s seats, however long their sockets idle (256 of them held the Hour full); a registered newcomer is admitted past them, a guest when one of theirs is free (mutants: guests uncounted; a registered account counted a guest)', async () => {
  await withRealm(async ({ realm, rec, hello, step }) => {
    const guests = [];
    for (let k = 0; k < 64; k++) { step(200); guests.push(await hello(`peer-g${k}`, atThreshold())); }
    assert.ok(guests.every((g) => g.closed === null), 'sixty-four guests in');
    const r = await realm.room._sdRealmOf(rec.s);
    assert.equal(r.gu.length, 64);
    step(200);
    const late = await hello('peer-g99', atThreshold());
    assert.deepEqual(late.closed?.reason, SD_NO_FULL, 'the sixty-fifth guest: full');
    step(200);
    const reg = await hello('peer-reg', atThreshold(), { kind: 'linked' });
    assert.equal(reg.closed, null, 'a registered newcomer: in');
    assert.ok(!r.gu.includes('acct-peer-reg'));
    await realm.drop(guests[0]);
    step(200);
    const next = await hello('peer-g98', atThreshold());
    assert.equal(next.closed, null, 'a guest\'s seat free: a guest in');
    assert.equal(r.gu.length, 64);
    assert.ok(!r.gu.includes('acct-peer-g0') && !r.in.includes('acct-peer-g0'));
    assert.deepEqual(realm.store.get(SD_REALM_KEY).gu, r.gu, 'kept');
  });
});

// ── L3 F4: the fade and the fall ────────────────────────────────────────

test('SD11b A KILL TOLD LATE IS THE KILL IT WAS (L3 F4): the hub says a found Hollow\'s fade SD_FADE_GRACE_MS past its `until` (a kill in its last seconds is still being told), and a kill landed inside the Hour and told after the fade was said is taken over it - the record falls at the kill\'s instant (mutants: no grace; the fade kept over the kill)', async () => {
  await withRealm(async ({ hub, hws, rec, set, fire }) => {
    const live = hub.store.get(SD_KEY);
    set(live.until);
    await fire(hub);
    assert.equal(hub.store.get(SD_KEY).ph, 'found', 'not said at `until`');
    assert.equal(hub.alarm.at, live.until + SD_FADE_GRACE_MS);
    set(live.until + SD_FADE_GRACE_MS);
    await fire(hub);
    assert.equal(hub.store.get(SD_KEY).ph, 'gone', 'said at the grace\'s end');
    const at = live.until - 2000;
    const res = await hub.room.fetch(new Request(`https://relay.internal${SD_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ s: rec.s, at, top: 'Ann', n: 2, rc: [], here: [] }) }));
    assert.equal(res.status, 200);
    const fell = hub.store.get(SD_KEY);
    assert.deepEqual([fell.ph, fell.fellAt, fell.top, fell.n], ['fell', at, 'Ann', 2], 'the kill, at its own instant');
    assert.deepEqual(hws.sent.filter((m) => m.t === 'sd' && m.k === 'ev').at(-1).ph, 'fell', 'said');
    // a kill after the Hour's time is none
    const late = await hub.room.fetch(new Request(`https://relay.internal${SD_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ s: rec.s, at: live.until + 1, top: 'Bo', n: 1, rc: [], here: [] }) }));
    assert.equal(late.status, 200);
    assert.equal(hub.store.get(SD_KEY).top, 'Ann');
  });
  // an unfound Hollow has no realm: its fade is said at once
  await withRealm(async ({ hub, set, fire }) => {
    const live = hub.store.get(SD_KEY);
    await hub.room._sdSave({ ...live, ph: 'risen', foundAt: undefined, fb: undefined });
    delete hub.room._sdRec.foundAt; delete hub.room._sdRec.fb;
    set(live.until);
    await fire(hub);
    assert.equal(hub.store.get(SD_KEY).ph, 'gone');
  });
});

// ── L3 F5, F8: the hello ────────────────────────────────────────────────

test('SD11b A HELLO WAKES ITS FIGHT (L3 F5, F8): a hello into a realm whose fight lives arms its beat (a realm that had emptied slept, its fight frozen until a blow); one whose fight no beat has moved for SD_LOST_MS finds it lost (the next `in` the fresh one); a fallen fight\'s earner is handed its receipt again at its hello (its page reloaded inside the hub\'s hold) (mutants: the beat unarmed; the stale fight said; the receipt unhanded)', async () => {
  await withRealm(async ({ realm, hello, beat, step, now }) => {
    const ann = await hello('peer-ann', inArenaAt(0, -12));
    const f = await fightWith(realm, beat, ann);
    await realm.drop(ann);
    realm.alarm.at = null;   // the realm slept
    step(5000);
    const bo = await hello('peer-bo', inArenaAt(3, -12));
    assert.ok(realm.alarm.at != null && realm.alarm.at <= now() + 1000, 'the beat armed by the hello');
    assert.equal(fights(bo).filter((m) => m.k === 'st').at(-1).fi, f.fi, 'told the fight');
    await realm.drop(bo);
    realm.alarm.at = null;
    step(SD_LOST_MS + 1);
    const cy = await hello('peer-cy', inArenaAt(3, -12));
    assert.ok(f.lost, 'stale: lost at the hello');
    assert.ok(realm.store.get(SD_FIGHT_KEY).lost, 'kept');
    assert.deepEqual(fights(cy), [], 'nothing said of it');
    await realm.raw(cy, say({ k: 'in', lv: 30, bv: 1 }));
    assert.equal(realm.room._sdFight.fi, f.fi + 1, 'the next `in`: the fresh one');
  });
  await withRealm(async ({ realm, hello, beat }) => {
    const ann = await hello('peer-ann', inArenaAt(0, -12));
    const f = await fightWith(realm, beat, ann);
    f.phase = 3; f.hp = 10; f.outUntil = 0;
    await realm.raw(ann, say({ k: 'hit', q: 1, d: 40, r: HIT_KINDS.Spell }));
    assert.ok(f.fell && f.rc['acct-peer-ann'], 'fallen, her receipt minted');
    await realm.drop(ann);
    const back = await hello('peer-ann', inArenaAt(0, -12));
    const said = fights(back);
    assert.equal(said.find((m) => m.k === 'st')?.fell?.at, f.fell.at, 'the fall told');
    assert.equal(said.find((m) => m.k === 'rcpt')?.r, f.rc['acct-peer-ann'], 'and her receipt');
    const bo = await hello('peer-bo', inArenaAt(3, -12));
    assert.ok(!fights(bo).some((m) => m.k === 'rcpt'), 'nobody else\'s');
  });
});

// ── L3 F6, L8 G4: the fall's tell ───────────────────────────────────────

test('SD11b THE FALL TOLD ONCE AT A TIME, AND UNTIL HEARD (L3 F6, L8 G4): the fall\'s own tell and the beat\'s retry never both go (the hub was told twice); a hub that does not answer the tell is told again SD_TELL_RETRY_MS on, by the beat, until it answers - then its record falls (mutants: two tells in flight; the retry unarmed; the retry never told)', async () => {
  await withRealm(async ({ realm, hub, hello, beat, mode, release, asks, step, now }) => {
    const ann = await hello('peer-ann', inArenaAt(0, -12));
    const f = await fightWith(realm, beat, ann);
    f.phase = 3; f.hp = 10; f.outUntil = 0;
    mode('hold');
    realm.room._sdLive = { s: f.s, at: now(), rec: hub.store.get(SD_KEY) };   // the blow's own ask answered: the tell alone is held
    const hit = realm.raw(ann, say({ k: 'hit', q: 1, d: 40, r: HIT_KINDS.Spell }));
    for (let k = 0; k < 20 && asks('realm', SD_INTERNAL_FELL) < 1; k++) await tick();
    assert.equal(asks('realm', SD_INTERNAL_FELL), 1, 'the fall\'s tell went');
    realm.alarm.at = now();
    const beatP = realm.fire();
    for (let k = 0; k < 10; k++) await tick();
    assert.equal(asks('realm', SD_INTERNAL_FELL), 1, 'the beat waits on it - one tell in flight');
    mode('ok'); release(); await hit; await beatP;
    assert.equal(f.told, true);
    assert.equal(hub.store.get(SD_KEY).ph, 'fell');
  });
  await withRealm(async ({ realm, hub, hello, beat, mode, asks, set, now }) => {
    const ann = await hello('peer-ann', inArenaAt(0, -12));
    const f = await fightWith(realm, beat, ann);
    f.phase = 3; f.hp = 10; f.outUntil = 0;
    realm.room._sdLive = { s: f.s, at: now(), rec: hub.store.get(SD_KEY) };
    mode('down');
    await realm.raw(ann, say({ k: 'hit', q: 1, d: 40, r: HIT_KINDS.Spell }));
    assert.ok(f.said && !f.told, 'said in the realm, the hub unheard');
    assert.equal(hub.store.get(SD_KEY).ph, 'found');
    const t = now();
    set(t + 1);
    await realm.fire();
    assert.equal(realm.alarm.at, t + 1 + SD_TELL_RETRY_MS, 'told again SD_TELL_RETRY_MS on');
    mode('ok');
    set(realm.alarm.at);
    await realm.fire();
    assert.equal(f.told, true, 'heard');
    assert.equal(hub.store.get(SD_KEY).ph, 'fell');
    assert.ok(asks('realm', SD_INTERNAL_FELL) >= 3);
  });
});

// ── L3 F7 / L5 F2: the slot's high-water mark ───────────────────────────

test('SD11b A HOLLOW\'S NUMBER IS NEVER USED TWICE (L3 F7, L5 F2): the hub keeps the highest slot it ever raised with its record, in one write; a record that will not read back (a law\'s bound moved) starts the director again FROM it - the next Hollow is the one past it, never slot 1 again (its realm\'s old fall, "claimed", no spoils) (mutants: the mark unkept; the first beat from zero)', async () => {
  await withRealm(async ({ hub, rec, set, now, fire }) => {
    assert.equal(hub.store.get(SD_SLOT_KEY), rec.s, 'kept with the record');
    hub.store.set(SD_KEY, { ...hub.store.get(SD_KEY), r: 999 });   // unreadable now: a region past the count
    hub.room._sdRec = undefined; hub.room._sdHw = undefined;
    hub.alarm.at = now();
    await fire(hub);
    const first = hub.store.get(SD_KEY);
    assert.deepEqual([first.s, first.ph], [rec.s, 'gone'], 'the director starts again from the mark');
    set(first.next);
    await fire(hub);
    assert.equal(hub.store.get(SD_KEY).s, rec.s + 1, 'the next Hollow is the one past it');
    assert.equal(hub.store.get(SD_SLOT_KEY), rec.s + 1);
    assert.equal(first.next - first.at, SD_FIRST_RISE_MS);
  });
});

// ── L5 F3: the held receipts ────────────────────────────────────────────

test('SD11b A HELD RECEIPT IS HANDED ON (L5 F3): an earner who stood in the realm at the kill is held from the hub\'s hand SD_HERE_HOLD_MS (the realm\'s floor spends it) - and handed it when the hold lapses, by the hub\'s own alarm, to its newest socket there, unless spent meanwhile (a page that crashed at the kill and came back inside the hold heard nothing until some later hello) (mutants: never handed on; handed though spent; the alarm unarmed)', async () => {
  await withRealm(async ({ hub, rec, set, now, fire }) => {
    const annH = hub.connect(); await hub.hello(annH, 'peer-annh', null, { name: 'Ann', acct: 'acct-ann', asecret: 'secret-of-acct-ann', tokenSub: 'acct-ann' });
    const boH = hub.connect(); await hub.hello(boH, 'peer-boh', null, { name: 'Bo', acct: 'acct-bo', asecret: 'secret-of-acct-bo', tokenSub: 'acct-bo' });
    const rA = await receipt(rec.s, 'acct-ann'), rB = await receipt(rec.s, 'acct-bo');
    const t = now();
    await hub.room.fetch(new Request(`https://relay.internal${SD_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ s: rec.s, at: t, top: 'Ann', n: 2, rc: [['acct-ann', rA], ['acct-bo', rB]], here: ['acct-ann', 'acct-bo'] }) }));
    const rcpts = (ws) => ws.sent.filter((m) => m.t === 'sd' && m.k === 'rcpt');
    assert.deepEqual([rcpts(annH).length, rcpts(boH).length], [0, 0], 'held');
    assert.deepEqual(hub.store.get(SD_HELD_KEY), [['acct-ann', t + SD_HERE_HOLD_MS], ['acct-bo', t + SD_HERE_HOLD_MS]]);
    assert.ok(hub.alarm.at <= t + SD_HERE_HOLD_MS, 'the hub armed for it');
    await hub.room._sdSpent('acct-bo', rec.s, now());   // Bo's floor spent his
    set(t + SD_HERE_HOLD_MS);
    hub.alarm.at = now();
    await fire(hub);
    assert.deepEqual(rcpts(annH).map((m) => m.r), [rA], 'Ann\'s handed on');
    assert.deepEqual(rcpts(boH), [], 'Bo\'s spent: nothing');
    assert.equal(hub.store.get(SD_HELD_KEY), undefined, 'none held now');
  });
});

// ── L7 M1: the realm's door ─────────────────────────────────────────────

test('SD11b A STRANGER CANNOT SHUT THE REALM\'S DOOR (L7 M1): the realm spends its hello gate after the token, by account (a battle\'s law) - forty junk tokens leave a fighter whose socket blinked, and a newcomer, admitted at once (0 of 60 tries before) (mutants: the room\'s gate before the token)', async () => {
  await withRealm(async ({ realm, hello }) => {
    const ann = await hello('peer-ann', inArenaAt(0, -12));
    assert.equal(ann.closed, null);
    await realm.drop(ann);
    for (let k = 0; k < 40; k++) { const j = realm.connect(); await realm.hello(j, `peer-junk${k}`, null, { tok: 'a1.AAAAAAAA.BBBBBBBB' }); assert.notEqual(j.closed, null, 'junk refused'); }
    const back = await hello('peer-ann', inArenaAt(0, -12));
    assert.equal(back.closed, null, 'the fighter back in');
    const bo = await hello('peer-bo', inArenaAt(3, -12));
    assert.equal(bo.closed, null, 'a newcomer in');
  });
});

// ── L7 M2: the level and the share ──────────────────────────────────────

test('SD11b THE LEVEL IS THE TOKEN\'S, THE SHARE THE ARENA\'S (L7 M2): an `in` joins at the token\'s signed character level, whatever it claims (a claim of 60 from level 5 parked a 34,125 share; a claim of 1 from level 60 bought the feat\'s roll for 63 points) - a claim stands only from a service that signs none; and a fighter is seen while it stands in the arena: one gone back to the Threshold takes its share out ABSENT_RETIRE_MS on, and brings it back when it returns (mutants: the claim believed; seen anywhere in the realm)', async () => {
  await withRealm(async ({ realm, hello, beat }) => {
    const ann = await hello('peer-ann', inArenaAt(0, -12), { charLevel: 5 });
    await realm.raw(ann, say({ k: 'in', lv: 60, bv: 1 }));
    const f = realm.room._sdFight, p = f.players['acct-peer-ann'];
    assert.equal(p.lv, 5);
    assert.equal(p.share, SD_TTK_S * dpsRef(5) * SD_SHARE_X);
    const bo = await hello('peer-bo', inArenaAt(3, -12), { charLevel: 60 });
    await realm.raw(bo, say({ k: 'in', lv: 1, bv: 1 }));
    assert.equal(f.players['acct-peer-bo'].lv, 60, 'a claim below: the token\'s');
    const cy = await hello('peer-cy', inArenaAt(-3, -12));
    await realm.raw(cy, say({ k: 'in', lv: 44, bv: 1 }));
    assert.equal(f.players['acct-peer-cy'].lv, 44, 'no signed level: the claim');
    // Bo walks back to the Threshold: away
    await beat(SD_OPENING_MS);
    const max0 = f.max;
    await realm.pose(bo, atThreshold());
    await beat(ABSENT_RETIRE_MS + 2000);
    assert.equal(f.players['acct-peer-bo'].retired, true, 'his share out');
    assert.ok(f.max < max0);
    await realm.pose(bo, inArenaAt(3, -12));
    await beat(1000);
    assert.equal(f.players['acct-peer-bo'].retired, false, 'back in the arena: back in');
  });
});

test('SD11b THE LAW: SEEN IN THE ARENA ALONE, AND COUNTED BY ITS SHARES (L7 M2, L6 F24): a fighter\'s body anywhere but the arena is away; the state\'s `n` is the fighters whose share stands in it now - the bar\'s "N in the arena" counted every seat the fight ever took (mutants: seen anywhere; every seat counted)', () => {
  const f = newRemnantFight(4, 1, T0);
  joinRemnant(f, 'a', 'A', 30, T0); joinRemnant(f, 'b', 'B', 30, T0);
  const rng = () => 0.5;
  let t = T0;
  for (; t <= T0 + ABSENT_RETIRE_MS + 2000; t += 500) stepRemnant(f, t, [{ sub: 'a', x: 0, z: -10, dead: false }, { sub: 'b', x: 0, z: -60, dead: false }], rng);
  assert.equal(f.players.a.retired, false, 'in the arena: seen');
  assert.equal(f.players.b.retired, true, 'off it: away');
  assert.equal(remnantStateOf(f).n, 1);
  stepRemnant(f, t, [{ sub: 'a', x: 0, z: -10, dead: false }, { sub: 'b', x: 2, z: -10, dead: true }], rng);
  assert.equal(f.players.b.retired, false, 'fallen in the arena: still seen');
  assert.equal(remnantStateOf(f).n, 2);
});

// ── L7 M4: the find's tell ──────────────────────────────────────────────

test('SD11b A FIND TOLD ONCE (L7 M4): a cell tells the hub each slot once - another finder\'s word, or the same again, moves nothing and tells nothing (the rite\'s law); the hub answers with its slot, and a find for any other slot is not told while that answer is fresh (one account in forty cells made forty hub requests a second) (mutants: told every frame; the hub\'s slot unread)', async () => {
  await withRealm(async ({ world, cell, mara, rec, asks, step }) => {
    const n0 = asks('cell', SD_INTERNAL_FOUND);
    assert.equal(n0, 1, 'the find told');
    const tom = cell.connect(); await cell.hello(tom, 'peer-tom', doorPose(-10), { name: 'Tom' });
    for (let k = 0; k < 5; k++) { step(1100); await cell.raw(tom, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY })); await cell.raw(mara, JSON.stringify({ t: 'sd', k: 'found', s: rec.s, px: PX, py: PY })); }
    assert.equal(asks('cell', SD_INTERNAL_FOUND), 1, 'the slot told: nothing more');
    for (let k = 0; k < 5; k++) { step(1100); await cell.raw(tom, JSON.stringify({ t: 'sd', k: 'found', s: rec.s + 1 + k, px: PX, py: PY })); }
    assert.equal(asks('cell', SD_INTERNAL_FOUND), 1, 'another slot while the hub\'s word is fresh: nothing');
    step(10 * 60_000);
    await cell.raw(tom, JSON.stringify({ t: 'sd', k: 'found', s: rec.s + 9, px: PX, py: PY }));
    assert.equal(asks('cell', SD_INTERNAL_FOUND), 2, 'its word grown old: told, and answered again');
    assert.equal(world.room(SOCIAL_ROOM).store.get(SD_KEY).s, rec.s, 'and nothing moved');
  });
});

// ── L7 L2: spent ────────────────────────────────────────────────────────

test('SD11b NO SPENT PAST THE HUB\'S SLOT (L7 L2): an account\'s `spent` for a slot the hub has not raised writes nothing (a rising slot each frame was a storage write each frame); its own slot\'s is kept (mutants: any slot written)', async () => {
  await withRealm(async ({ hub, rec, now }) => {
    await hub.room._sdSpent('acct-x', rec.s + 1, now());
    assert.equal(hub.store.get(sdReceiptKey('acct-x')), undefined, 'a slot past the hub\'s: nothing');
    await hub.room._sdSpent('acct-x', rec.s, now());
    assert.equal(hub.store.get(sdReceiptKey('acct-x')).spent, true);
  });
});

// ── L7 H2: the stones' rights ───────────────────────────────────────────

test('SD11b THE STONES\' RIGHTS, THE LAW (L7 H2): every turn moves the road by one; a turner that has lengthened it SD_TURN_LONG_MAX times this thread waits while another has turned within SD_TURN_COMPANY_MS - never alone; guests turn as one; the snap lashes those who turned and brought it no nearer (mutants: the cap alone too; company forgotten; a guest its own; the menders lashed)', () => {
  for (let s = 1; s <= 120; s++) {
    const o = orreryOf(s);
    let st = [...o.start];
    for (let k = 0; k < 40; k++) { const i = k % 6, a = k % 3 ? 1 : -1, after = orreryTurn(o, st, i, a); assert.equal(Math.abs(orreryShortest(o, after) - orreryShortest(o, st)), 1, `slot ${s}`); st = after; }
  }
  const R = orreryRightsFresh(), g = orreryTurnerOf('x', false), t0 = 1000;
  for (let k = 0; k < SD_TURN_LONG_MAX + 4; k++) { assert.ok(orreryMayTurn(R, g, t0 + k), 'alone, never held'); orreryTurned(R, g, 'peer-g', 5, 6, t0 + k); }
  const h = orreryTurnerOf('y', false);
  assert.ok(orreryMayTurn(R, h, t0 + 20));
  orreryTurned(R, h, 'peer-h', 6, 5, t0 + 20);
  assert.ok(!orreryMayTurn(R, g, t0 + 21), 'with company: held');
  assert.ok(orreryMayTurn(R, h, t0 + 21), 'the mender is not');
  assert.ok(orreryMayTurn(R, g, t0 + 20 + SD_TURN_COMPANY_MS), 'the company gone quiet: free again');
  assert.equal(orreryTurnerOf('a', true), orreryTurnerOf('b', true), 'guests as one');
  assert.notEqual(orreryTurnerOf('a', false), orreryTurnerOf('a', true));
  assert.deepEqual(orreryLashed(R), ['peer-g'], 'the one who lengthened it, not the mender');
  const R2 = orreryRightsFresh();
  orreryTurned(R2, g, 'peer-g', 5, 6, 1); orreryTurned(R2, g, 'peer-g', 6, 5, 2);
  assert.deepEqual(orreryLashed(R2), ['peer-g'], 'net no nearer: lashed');
  // ONE GRIEFER AGAINST A TEAM THAT KNOWS THE WAY: each turn of the team's the next of the way, the griefer the stone that
  // lengthens it most, turn for turn (the stones settled for both) - the Concord in every slot
  for (let s = 1; s <= 200; s++) {
    const o = orreryOf(s);
    let hall = orreryFresh(o), Rs = orreryRightsFresh(), now = 0, snaps = 0;
    const team = ['a:t1', 'a:t2', 'a:t3'];
    for (let n = 0; n < 400 && !hall.ok; n++) {
      now += 350;
      const who = n % 2 ? team[(n >> 1) % 3] : 'a:grief';
      let i, a;
      if (who === 'a:grief') { i = n % 6; a = orreryShortest(o, orreryTurn(o, hall.st, i, 1)) > orreryShortest(o, hall.st) ? 1 : -1; }
      else { const way = orrerySolve(o, hall.st); i = SD_STONES.findIndex((_, j) => way[j] !== 0); if (i < 0) break; a = sdHour(way[i]) <= 6 ? 1 : -1; }
      if (!orreryMayTurn(Rs, who, now)) continue;
      const road = orreryShortest(o, hall.st), res = orreryStep(o, hall, i, a);
      orreryTurned(Rs, who, who, road, orreryShortest(o, orreryTurn(o, hall.st, i, a)), now);
      if (res.x) { snaps++; Rs = orreryRightsFresh(); }
      hall = { st: res.st, f: res.f, ok: res.ok };
    }
    assert.ok(hall.ok, `slot ${s}: the Concord (${snaps} snaps)`);
    assert.equal(snaps, 0, `slot ${s}: never snapped back`);
  }
  assert.equal(SD_TURN_LONG_MAX * 2 <= SD_FRAY_MAX - 24 - 2 * SD_TURN_LONG_MAX, true, 'a griefer\'s dozen leaves the longest way its thread');
  void sdTurnsFor;
});

test('SD11b THE STONES\' RIGHTS, THE REALM (L7 H2): a lone turner turning every stone the long way is never refused; once another turns, a turner that has lengthened the road its six times this thread turns nothing - no fray, no word to the hall - and is told so, once in four seconds (`w`); every guest is one turner; the snap names whom its lash falls on (`ls`) (mutants: the rights unasked; the refusal unsaid; said every press; the guest its own; the snap unnamed)', async () => {
  await withRealm(async ({ realm, rec, hello, step }) => {
    const o = orreryOf(rec.s);
    const ann = await hello('peer-ann', atStone(0), { kind: 'linked' });
    const q = { ann: 0, bo: 0, g1: 0, g2: 0 };
    const turn = async (ws, who, i, a) => { step(SD_STONE_SETTLE_MS); await realm.raw(ws, say({ k: 'pz', i, a, q: ++q[who] })); };
    const longWay = (i) => (orreryShortest(o, orreryTurn(o, realm.room._sdHall.st, i, 1)) > orreryShortest(o, realm.room._sdHall.st) ? 1 : -1);
    for (let k = 0; k < 10; k++) await turn(ann, 'ann', 0, longWay(0));
    assert.equal(realm.room._sdHall.f, 10, 'alone: every turn taken');
    // Bo comes and turns: now Ann has lengthened it ten times - she waits
    const bo = await hello('peer-bo', atStone(1), { kind: 'linked' });
    const way = orrerySolve(o, realm.room._sdHall.st);
    await turn(bo, 'bo', 1, way[1] !== 0 && sdHour(way[1]) <= 6 ? 1 : -1);
    const f0 = realm.room._sdHall.f, heard = halls(bo).length;
    await turn(ann, 'ann', 0, longWay(0));
    assert.equal(realm.room._sdHall.f, f0, 'held: no fray');
    assert.equal(halls(bo).length, heard, 'no word to the hall');
    const told = halls(ann).filter((m) => m.w === 1);
    assert.equal(told.length, 1, 'told');
    assert.equal(validSdOut(told[0]).w, 1);
    await turn(ann, 'ann', 0, 1);
    assert.equal(halls(ann).filter((m) => m.w === 1).length, 1, 'not again inside four seconds');
    step(4000);
    await turn(ann, 'ann', 0, 1);
    assert.equal(halls(ann).filter((m) => m.w === 1).length, 2, 'past it: again');
    assert.equal(SD_TURN_WAIT_LINE, 'The stones will not answer you while others turn them.');
    // the snap begins a fresh thread: Ann quiet past the company's minute, Bo spends the rest of it alone - then Ann turns
    step(SD_TURN_COMPANY_MS);
    for (let k = 0; k < 60 && realm.room._sdHall.f > 0; k++) await turn(bo, 'bo', 1, 1);
    assert.equal(realm.room._sdHall.f, 0, 'snapped back');
    await turn(ann, 'ann', 0, 1);
    assert.equal(realm.room._sdHall.f, 1, 'a fresh thread: Ann turns again beside him');
  }, { concord: false });
  // the guests: one turner
  await withRealm(async ({ realm, rec, hello, step }) => {
    const o = orreryOf(rec.s);
    const reg = await hello('peer-reg', atStone(2), { kind: 'linked' });
    const g1 = await hello('peer-g1', atStone(0)), g2 = await hello('peer-g2', atStone(1));
    let n = 0;
    const turn = async (ws, i, a) => { step(SD_STONE_SETTLE_MS); await realm.raw(ws, say({ k: 'pz', i, a, q: ++n })); };
    const longWay = (i) => (orreryShortest(o, orreryTurn(o, realm.room._sdHall.st, i, 1)) > orreryShortest(o, realm.room._sdHall.st) ? 1 : -1);
    await turn(reg, 2, 1);
    for (let k = 0; k < 3; k++) { await turn(g1, 0, longWay(0)); await turn(g2, 1, longWay(1)); }
    const f0 = realm.room._sdHall.f;
    await turn(g2, 1, longWay(1));
    assert.equal(realm.room._sdHall.f, f0, 'six between them: both wait');
    await turn(g1, 0, longWay(0));
    assert.equal(realm.room._sdHall.f, f0);
  }, { concord: false });
  // the snap: whom it names
  await withRealm(async ({ realm, rec, hello, step }) => {
    const o = orreryOf(rec.s);
    const ann = await hello('peer-ann', atStone(0));
    let n = 0;
    for (let k = 0; k < SD_FRAY_MAX; k++) { step(SD_STONE_SETTLE_MS); await realm.raw(ann, say({ k: 'pz', i: 0, a: 1, q: ++n })); }
    const snap = halls(ann).at(-1);
    assert.equal(snap.x, 1);
    assert.deepEqual(snap.ls, ['peer-ann'], 'her forty-eight turns brought it no nearer');
    assert.deepEqual(realm.room._sdHall.st, [...o.start]);
  }, { concord: false });
});

// ── L8 G1, G5: the Echoes' and the Hearts' blows through the relay ──────

test('SD11b THE ECHOES\' AND THE HEARTS\' BLOWS, THROUGH THE REALM (L8 G1): in the Dragon Break a blow on an Echo (`ehit`) lands on it and the fall is fanned with its breaker\'s name; in a Reset a blow on each Heart (`xhit`) breaks it, fanned (`cxb`), and the last breaks the Reset - the Remnant stunned (mutants: `ehit` routed to the Hearts; the Echo\'s fall unfanned; `xhit` dropped)', async () => {
  await withRealm(async ({ realm, hello, beat, step }) => {
    const ann = await hello('peer-ann', inArenaAt(0, -12));
    const bo = await hello('peer-bo', inArenaAt(3, -12));
    const f = await fightWith(realm, beat, ann);
    await realm.raw(bo, say({ k: 'in', lv: 30, bv: 1 }));
    f.hp = 0.7 * f.max - 1;
    await beat(1000);
    assert.equal(f.phase, 2, 'the Dragon Break');
    await beat(3000);
    f.ec[0].h = 10;
    const before = fights(bo).length;
    await realm.raw(ann, say({ k: 'ehit', e: 0, q: 1, d: 40, r: HIT_KINDS.Spell }));
    const ec = fights(bo).slice(before).find((m) => m.k === 'ec');
    assert.ok(ec, 'fanned');
    assert.deepEqual([ec.d, ec.n], [0, 'ann'], 'the Gold Echo, by Ann');
    assert.equal(f.ec[0].h, 0);
    // the Last Moment, and a Reset
    f.ec[1].h = 0; f.ec[1].downAt = Date.now();
    await beat(500);
    assert.equal(f.phase, 3);
    f.outUntil = 0; f.resetAt = Date.now(); f.rem.nextAt = 0; f.rem.atk = null;
    await beat(300);
    assert.ok(f.cx, 'the Hearts rise');
    for (const q of f.cx.c) q.h = 10;
    const hearts = f.cx.c.length, b0 = fights(bo).length;
    for (let c = 0; c < hearts; c++) { step(300); await realm.raw(ann, say({ k: 'xhit', c, q: 10 + c, d: 40, r: HIT_KINDS.Spell })); }
    const said = fights(bo).slice(b0);
    assert.equal(said.filter((m) => m.k === 'cxb').length, hearts, 'each Heart broken, fanned');
    assert.ok(said.some((m) => m.k === 'stun'), 'the last: stunned');
    assert.ok(f.stunUntil > Date.now());
  });
});

// ── L8 G8, G11: the dead, and the `in` refused ──────────────────────────

test('SD11b THE DEAD STAND IN NO FIGHT, AND THE `in` IS REFUSED IN WORDS (L8 G8, G11): a fight whose only fighter lies dead in the arena is lost SD_LOST_MS on (a corpse held it); an `in` into a fight past its Hour is told "the fight is over", into a full one "the arena is full" (mutants: the dead flag unread; the refusals unsaid)', async () => {
  await withRealm(async ({ realm, hello, beat }) => {
    const ann = await hello('peer-ann', inArenaAt(0, -12));
    const f = await fightWith(realm, beat, ann);
    await realm.drop(ann);
    await hello('peer-ann', inArenaAt(0, -12, { dd: 1 }));   // back, and dead where she lies
    await beat(SD_LOST_MS + 2000);
    assert.ok(f.lost, 'lost');
  });
  await withRealm(async ({ realm, hello, beat }) => {
    const ann = await hello('peer-ann', inArenaAt(0, -12));
    const f = await fightWith(realm, beat, ann);
    f.ended = { at: Date.now() };
    const bo = await hello('peer-bo', inArenaAt(3, -12));
    await realm.raw(bo, say({ k: 'in', lv: 30, bv: 1 }));
    assert.deepEqual(fights(bo).filter((m) => m.k === 'no').map((m) => m.m), [SD_NO_WORDS[1]], 'the fight is over');
    f.ended = null;
    for (let k = 0; k < SD_FIGHTERS_MAX; k++) f.players[`acct-f${k}`] = { ...f.players['acct-peer-ann'], name: `f${k}`, dealt: 1000 };   // each with a part: no seat frees itself
    const cy = await hello('peer-cy', inArenaAt(-3, -12));
    await realm.raw(cy, say({ k: 'in', lv: 30, bv: 1 }));
    assert.deepEqual(fights(cy).filter((m) => m.k === 'no').map((m) => m.m), [SD_NO_WORDS[2]], 'the arena is full');
  });
});

// ── L8 G9: the director's retry and its re-read ─────────────────────────

test('SD11b THE DIRECTOR TRIES AGAIN, AND READS AGAIN (L8 G9): a beat that throws arms the hub a minute on; a rise reads the record again after the census (a slot raised while it asked raises no second) (mutants: the retry unarmed; the record not read again)', async () => {
  await withRealm(async ({ hub, set, now, fire }) => {
    const live = hub.store.get(SD_KEY);
    set(live.until + SD_FADE_GRACE_MS);
    const put = hub.room.state.storage.put.bind(hub.room.state.storage);
    let once = true;
    hub.room.state.storage.put = (k, v) => { if (once && typeof k === 'object' && k[SD_KEY]) { once = false; return Promise.reject(new Error('storage away')); } return put(k, v); };
    hub.alarm.at = now();
    await fire(hub);
    assert.equal(hub.alarm.at, now() + 60_000, 'a minute on');
    hub.room.state.storage.put = put;
  });
  await withRealm(async ({ world, hub, set, now, fire }) => {
    const live = hub.store.get(SD_KEY);
    await hub.room._sdSave({ ...live, ph: 'gone' });
    set(live.next);
    // the census's first channel answers - and meanwhile a later slot has risen (another beat, a restore)
    const region = world.room(chatRegionRoom(0)).room;
    const census = region._sdCensusInternal.bind(region);
    region._sdCensusInternal = async () => { await hub.room._sdSave({ ...live, s: live.s + 5, ph: 'risen', at: now(), until: now() + 1e9, next: now() + 2e9 }); return census(); };
    hub.alarm.at = now();
    await fire(hub);
    assert.equal(hub.store.get(SD_KEY).s, live.s + 5, 'no second rise over it');
  });
});

// ── the relay by source ─────────────────────────────────────────────────

test('SD11b THE RELAY BY SOURCE: the seams these fixes stand on - the realm\'s attachment marks a registered account and carries its signed level; the hub\'s beat hands the held receipts; the fall told through one flight; the hub\'s record and its mark written together (mutants: each seam removed)', () => {
  const r = strip(RELAY);
  assert.match(r, /const linked = \(isRegionRoom\(a\.key\) \|\| realmRoom\) && who\.kind === 'linked' \? \{ lk: 1 \} : \{\};/);
  assert.match(r, /const charLv = \(isCellRoom\(a\.key\) \|\| realmRoom\) && Number\.isSafeInteger\(who\.cl\) && who\.cl >= 1 \? \{ cl: who\.cl \} : \{\};/);
  assert.match(r, /try \{ await this\._sdHeldBeat\(now\); \}/);
  assert.match(r, /if \(this\._sdFellTelling\) return this\._sdFellTelling;/);
  assert.match(r, /await this\.state\.storage\.put\(\{ \[SD_KEY\]: rec, \[SD_SLOT_KEY\]: hw \}\);/);
  assert.match(r, /if \(isSdRoom\(a\.key\)\) \{ try \{ if \(!\(await this\._sdHelloFight\(ws, who\.subject, sdSlotOfRoom\(a\.key\), now\)\)\) return; \}/);
});

// ── the page: the snap's lash, and the stones' refusal ──────────────────

test('SD11b THE PAGE LASHES WHOM THE REALM NAMES (L7 H2): a snap\'s word lashes me, standing in the hall, only if it names my id - a mender of a griefer\'s turns, or one who never touched a stone, stands unhurt; the line said to all of them; a word to me alone that the stones refused my turn says why, and lashes nothing (mutants: the whole hall lashed; the refusal unsaid)', () => {
  const said = [], hurt = [];
  const [hx, , hz] = realmToDungeon(SD_ORRERY.x, 0, SD_ORRERY.z - 5);
  const env = {
    modes: { sdRealmSlot: () => 4 }, setMidScreenText: (t) => said.push(t), sdDungeonToRealm: dungeonToRealm,
    player: { pos: [hx, 0, hz] }, playerEntity: { health: 100, maxHealth: 100 }, inOrreryHall, SD_FRAY_LASH,
    hurtPlayer: (e, d) => hurt.push(d), flashPlayerDamage: () => {}, online: { id: 'peer-me' },
    SD_HALL_TEXT: { snap: 'The Hour snaps back.' }, SD_TURN_WAIT_LINE,
  };
  const heard = new Function(...Object.keys(env), `let _sdHall = null;\n${fnOf('sdHallHeard')}\nreturn sdHallHeard;`)(...Object.values(env));
  const hall = { k: 'pz', s: 4, st: [0, 0, 0, 0, 0, 0], f: 0, lit: 0, ok: false, i: 0, a: 1, id: 'peer-x', q: 48, x: 1 };
  heard({ ...hall, ls: ['peer-x'] });
  assert.deepEqual(hurt, [], 'not named: unhurt');
  assert.deepEqual(said, ['The Hour snaps back.'], 'the line, to all');
  heard({ ...hall, ls: ['peer-x', 'peer-me'] });
  assert.deepEqual(hurt, [Math.round(100 * SD_FRAY_LASH)], 'named: lashed');
  heard({ ...hall, ls: undefined });
  assert.equal(hurt.length, 1, 'a snap that names nobody lashes nobody');
  heard({ k: 'pz', s: 4, st: [0, 0, 0, 0, 0, 0], f: 3, lit: 0, ok: false, w: 1 });
  assert.equal(said.at(-1), SD_TURN_WAIT_LINE, 'the refusal said');
  assert.equal(hurt.length, 1);
  heard({ ...hall, s: 5, ls: ['peer-me'] });
  assert.equal(hurt.length, 1, 'another Hour\'s word: nothing');
});

// ── L8 G13: the relay's smaller arms (added at SD11c) ───────────────────

test('SD11b THE RELAY\'S SMALLER ARMS (L8 G13, added at SD11c): a fighter\'s NEWEST socket speaks for its body (the gate\'s law - an older tab\'s pose is not where it stands); a stored fight of another slot is no fight here, and the next `in` makes this Hollow\'s own; a realm\'s admitted list of another slot admits nobody here; a hub that THROWS is no answer - with no answer kept, a newcomer is refused busy, never "closed"; a region channel\'s census answer is bounded by its sockets (mutants: the oldest socket; another slot\'s fight or list kept; a throw read as no record; the census unbounded)', async () => {
  await withRealm(async ({ realm, hub, rec, hello, beat, step }) => {
    const ann = await hello('peer-ann', inArenaAt(-10, 4));
    const f = await fightWith(realm, beat, ann);
    const annAt = { ...realm.room._all().get(ann) };
    step(100);
    const ann2 = await hello('peer-ann2', inArenaAt(8, -6), { tokenSub: 'acct-peer-ann' });
    assert.equal(ann2.closed, null);
    // the window a realm's one-fighter-an-account law leaves: the older tab refused but not yet gone from the runtime's
    // list - it stands first in the index, and still says where it was
    const idx = realm.room._all();
    realm.room._idx = new Map([[ann, annAt], ...[...idx].filter(([ws]) => ws !== ann)]);
    realm.room._idxAt = Date.now();
    const bodies = realm.room._sdFightBodies(f).filter((b) => b.sub === 'acct-peer-ann');
    assert.equal(bodies.length, 1, 'one body an account');
    assert.ok(Math.abs(bodies[0].x - 8) < 1e-6 && Math.abs(bodies[0].z + 6) < 1e-6, `the newest socket's pose: ${JSON.stringify(bodies[0])}`);
    realm.room._idx = null;
    // another slot's fight, stored (ann's account a fighter in it): no fight here - a blow lands on nothing, and the next
    // `in` makes this Hollow's own
    realm.room._sdFight = undefined;
    const other = newRemnantFight(rec.s + 40, 9, Date.now() - SD_OPENING_MS - 1000);
    joinRemnant(other, 'acct-peer-ann', 'ann', 30, Date.now() - SD_OPENING_MS - 1000);
    other.lastTickAt = Date.now();
    await realm.room.state.storage.put(SD_FIGHT_KEY, other);
    await realm.raw(ann2, say({ k: 'hit', q: 7, d: 40, r: HIT_KINDS.Spell }));
    assert.equal(realm.room._sdFight, null, 'another slot\'s fight is no fight here');
    await realm.raw(ann2, say({ k: 'in', lv: 30, bv: 1 }));
    assert.equal(realm.room._sdFight?.s, rec.s, 'the next `in`: this Hollow\'s own fight');
    // another slot's admitted list: nobody admitted here by it
    realm.room._sdRealm = undefined;
    await realm.room.state.storage.put(SD_REALM_KEY, { s: rec.s + 40, in: ['acct-x', 'acct-y'], gu: [] });
    const list = await realm.room._sdRealmOf(rec.s);
    assert.deepEqual([list.s, list.in, list.gu], [rec.s, [], []]);
    // a hub that throws, with no answer kept: busy, never closed
    step(10 * 60_000);
    const ROOMS = realm.room.env.ROOMS;
    realm.room.env.ROOMS = { idFromName: ROOMS.idFromName, get: (id) => (id === SOCIAL_ROOM ? { fetch: () => { throw new Error('the hub is gone'); } } : ROOMS.get(id)) };
    const cy = await hello('peer-cy', inArenaAt(-3, -12));
    assert.deepEqual(cy.closed, { code: CLOSE_BUSY, reason: 'busy' }, 'a throw is no answer: busy');
    realm.room.env.ROOMS = ROOMS;
    // the census: a channel's answer past its sockets is bounded
    const HR = hub.room.env.ROOMS;
    hub.room.env.ROOMS = { idFromName: HR.idFromName, get: () => ({ fetch: async () => new Response(JSON.stringify({ n: 1e9 }), { status: 200 }) }) };
    const counts = await hub.room._sdCensus();
    hub.room.env.ROOMS = HR;
    assert.ok(counts.length > 0 && counts.every((n) => n === CHAT_SOCKETS_MAX), 'bounded by a channel\'s sockets');
  });
});
