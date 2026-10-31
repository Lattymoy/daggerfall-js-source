// AUDIT DRAGON-CELL III (2026-10-31, the owner: "Audit", of DRAGON-BUDGET and DRAGON-EACH;
// bible/01-Overview/audits/Audit-Dragon-Cell-III.md). Pinned: every cell a pose could be told of is charged (G4); a full
// budget kept in the room, one hub ask in flight, the room's grants its watch's and its account's (G5); an `in` judged by
// its site's cell (G6); a fight's words to a passer-by only once its account is granted the cell (G7); two dragons in one
// node room (G8); the hub's keep readable by world297 (G10); a fall from before told as minted (G11); a placed receipt
// refused where an older service counted its watch (G2); migration 0203 carries the old rows at -1 (G13); a guest's hoard
// a place; the hub hands no spent receipt. tools/mutants/dragoncellaudit3.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import * as Law from '../../../src/net/dragon/dragonLaw.js';
import { nodeAt } from '../../../src/net/cellTree.js';
import { mintDragonReceipt, readDragonReceipt } from '../../../src/net/dragon/dragonReceipt.js';
import { DRAGON_RC_PREFIX, DRAGON_INTERNAL_JUDGE, DRAGON_INTERNAL_FELL, SOCIAL_ROOM } from '../../../src/net/wire.js';
import { DRAGON_TICK_MS } from '../../../src/net/dragon/dragonBrain.js';
import { DRAGON_TELL_DWELL_MS, dragonFellInternal } from '../../../server/src/dragonFights.js';
import { claimDragon, dragonTameRoll } from '../../../server-account/src/dragons.js';
import { createGuest } from '../../../server-account/src/accounts.js';
import { importReceiptKey } from '../../../src/net/gate/gateReceipt.js';
import { importPublicKeyB64 } from '../../../src/net/identityToken.js';
import { d1 } from '../../accountDb.mjs';
import { fakeRooms } from '../../fakeRoom.mjs';
import { RELAY_KEY, dragonOmenFrom, watchOf, siteOf, aged } from '../../dragonOmen.mjs';

const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const OMEN = await dragonOmenFrom(500_000), W = OMEN.w, TT = Law.dragonTimes(OMEN), SITE = siteOf(OMEN), CELL = Law.dragonCellOf(OMEN);
const roomOf = (px, py) => `world:${Math.floor(px / 16)},${Math.floor(py / 16)}`;
const posed = (px, py) => { const c = Law.pixelCentreNative(px, py); return { x: c.sx, y: 0, z: c.sz, yaw: 0, pitch: 0 }; };
const near = (s, m = 40) => ({ x: s.sx + m * Law.DRAGON_NATIVE_PER_M, y: 0, z: s.sz, yaw: 0, pitch: 0 });
const dw = (ws, k) => ws.sent.filter((m) => m.t === 'dragon' && (!k || m.k === k));
const IN = (s, w = W) => ({ k: 'in', w, bv: Law.DRAGON_BRAIN_V, lv: 20, sx: s.sx, sz: s.sz });

async function withWorld(fn, start = TT.landAt + 60_000) {
  const realNow = Date.now; let clock = start;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const room = (key) => { const r = world.room(key); r.env.GATE_SIGNING_KEY = RELAY_KEY.pkcs8; return r; };
    const hub = room(SOCIAL_ROOM), calls = [];
    const fetch = hub.room.fetch.bind(hub.room);
    hub.room.fetch = async (req) => { const path = new URL(req.url).pathname; if (path === DRAGON_INTERNAL_JUDGE) calls.push((await req.clone().json()).cs); return fetch(req); };
    const judge = (body) => fetch(new Request(`https://relay.internal${DRAGON_INTERNAL_JUDGE}`, { method: 'POST', body: JSON.stringify(body) })).then(async (r) => (await r.json()).ok);
    const say = (r, ws, o) => r.raw(ws, JSON.stringify({ t: 'dragon', ...o }));
    const spent = (sub, w = W) => hub.room._dg?.budget?.get(w)?.get(sub)?.size ?? 0;
    await fn({ room, hub, calls, judge, say, spent, now: () => clock, set: (t) => { clock = t; } });
  } finally { Date.now = realNow; }
}

test('AUDIT DRAGON-CELL III G4 the reach: a pixel is told of one, two or four cells - the cells whose omen dragonToldAt tells there - and an ask charges each, so a socket re-posed to its cell\'s corner has spent four (mutants: the pose\'s cell alone charged; the reach one-sided)', async () => {
  for (let dx = -2; dx < 18; dx++) for (let dy = -2; dy < 18; dy++) {
    const px = 16 * 30 + dx, py = 16 * 4 + dy, want = [];
    for (let cy = 3; cy <= 5; cy++) for (let cx = 29; cx <= 31; cx++) {
      const x0 = cx * 16 - Law.DRAGON_TELL_PX, y0 = cy * 16 - Law.DRAGON_TELL_PX, span = 16 + 2 * Law.DRAGON_TELL_PX;
      if (px >= x0 && py >= y0 && px < x0 + span && py < y0 + span) want.push(`${cx},${cy}`);
    }
    assert.deepEqual(Law.dragonReachCells(px, py).sort(), want.sort(), `${px},${py}`);
  }
  await withWorld(async ({ room, say, spent }) => {
    const r = aged(room('world:30,4')), a = r.connect();
    await r.hello(a, 'peer-0001', posed(16 * 30 + 8, 16 * 4 + 8));
    await say(r, a, { k: 'ask', w: W });
    assert.equal(spent('acct-peer-0001'), 1, 'its cell\'s middle: one');
    await r.pose(a, posed(16 * 30 + 1, 16 * 4 + 1));
    await say(r, a, { k: 'ask', w: W });
    assert.equal(spent('acct-peer-0001'), 4, 'its corner: four');
  });
});

test('AUDIT DRAGON-CELL III G5 the hub\'s load: a socket not yet stood asks nothing; a full budget is kept in the room, so its next asks reach no hub; two asks at once make one call; the room\'s grants are its watch\'s and its account\'s, and an old watch\'s let go (mutants: the refusal unkept; no ask in flight kept; the grant kept across watches; one grant for every account; the room\'s old watches kept)', async () => {
  await withWorld(async ({ room, calls, judge, say, set }) => {
    const r = room('world:30,4'), fresh = r.connect();
    await r.hello(fresh, 'peer-0009', posed(16 * 30 + 8, 16 * 4 + 8));
    await say(r, fresh, { k: 'ask', w: W });
    assert.equal(calls.length, 0, 'not yet stood: no hub');
    const ar = aged(r), a = ar.connect();
    await ar.hello(a, 'peer-0001', posed(16 * 30 + 8, 16 * 4 + 8));
    await Promise.all([say(r, a, { k: 'ask', w: W }), say(r, a, { k: 'ask', w: W })]);
    assert.equal(calls.length, 1, 'two asks at once: one call');
    const b = ar.connect();
    await ar.hello(b, 'peer-0002', posed(16 * 30 + 8, 16 * 4 + 8));
    await say(r, b, { k: 'ask', w: W });
    assert.equal(calls.length, 2, 'another account in the room: its own call');
    for (let i = 0; i < Law.DRAGON_JUDGED_CELLS_MAX; i++) await judge({ w: W, sub: 'acct-peer-0003', cs: [`${900 + i},0`] });
    const c = ar.connect();
    await ar.hello(c, 'peer-0003', posed(16 * 30 + 8, 16 * 4 + 8));
    for (let i = 0; i < 6; i++) await say(r, c, { k: 'ask', w: W });
    assert.equal(calls.length, 3, 'a full budget: asked once, then kept');
    set((W + 1) * Law.DRAGON_WATCH_MS + 1000);
    await say(r, a, { k: 'ask', w: W + 1 });
    assert.equal(calls.length, 4, 'the next watch: asked again');
    set((W + 2) * Law.DRAGON_WATCH_MS + 1000);
    await say(r, a, { k: 'ask', w: W + 2 });
    assert.deepEqual([...r.room._dg.judged.keys(), ...r.room._dg.refused.keys()].filter((k) => k.startsWith(`${W}|`)), [], 'an old watch let go');
  });
});

test('AUDIT DRAGON-CELL III G6 the `in`: told from the next cell with the last of its budget, a player walks to the site and is joined - the `in` judged by its site\'s cell alone, never the cells its pose could be told of (mutant: the `in` charged its pose\'s reach)', async () => {
  await withWorld(async ({ room, judge, say }) => {
    for (let i = 0; i < Law.DRAGON_JUDGED_CELLS_MAX - 2; i++) await judge({ w: W, sub: 'acct-peer-0001', cs: [`${900 + i},0`] });
    const ex = 16 * (CELL.cx + 1) + 2, ey = SITE.py;   // the next cell east, two pixels in: told of its own and the dragon's
    assert.deepEqual(Law.dragonReachCells(ex, ey).sort(), [`${CELL.cx},${CELL.cy}`, `${CELL.cx + 1},${CELL.cy}`].sort());
    const e = aged(room(roomOf(ex, ey))), a = e.connect();
    await e.hello(a, 'peer-0001', posed(ex, ey));
    await say(e, a, { k: 'ask', w: W });
    assert.deepEqual(dw(a, 'omen').map((m) => m.s), [OMEN.s], 'told, its budget spent');
    assert.deepEqual(Law.dragonReachCells(SITE.px, SITE.py).length, 2, 'the site\'s pose could be told of a cell more');
    const s = aged(room(roomOf(SITE.px, SITE.py))), b = s.connect();
    await s.hello(b, 'peer-0001', near(SITE));
    await say(s, b, IN(SITE));
    assert.equal(dw(b, 'st').length, 1, 'joined');
  });
});

test('AUDIT DRAGON-CELL III G7 the fan: a passer-by within DRAGON_FAN_R hears a fight\'s words once its account is granted the fight\'s cell - asked of the hub after its wait in the room; one not yet stood, or past its budget, hears none, and one not yet stood is not joined at a live fight (mutants: the fan unjudged; the wait unread; the `in` unwaited at a live fight)', async () => {
  await withWorld(async ({ room, judge, say, set, now }) => {
    for (let i = 0; i < Law.DRAGON_JUDGED_CELLS_MAX; i++) await judge({ w: W, sub: 'acct-peer-0004', cs: [`${900 + i},0`] });
    const r = aged(room(roomOf(SITE.px, SITE.py))), a = r.connect(), b = r.connect(), d = r.connect(), c = r.connect();
    c.att.at = now() + 60 * 60_000;   // not yet stood here
    await r.hello(a, 'peer-0001', near(SITE)); await r.hello(b, 'peer-0002', near(SITE, 2500)); await r.hello(c, 'peer-0003', near(SITE, 2500)); await r.hello(d, 'peer-0004', near(SITE, 2500));
    await say(r, a, IN(SITE));
    const f = r.room._dg.fights.get(Law.dragonFightId(W, SITE.sx, SITE.sz));
    const e = r.connect(); e.att.at = now() + 60 * 60_000;
    await r.hello(e, 'peer-0006', near(SITE, 60));
    await say(r, e, IN(SITE));
    assert.deepEqual([dw(e, 'st').length, !!f.players['acct-peer-0006']], [0, false], 'A10: one not yet stood, at a live fight\'s site, is not joined');
    set(now() + DRAGON_TICK_MS); if (r.alarm.at != null && now() >= r.alarm.at) await r.fire();
    f.hp = 5; f.players['acct-peer-0001'].dealt = 1000;
    await say(r, a, { k: 'hit', d: 40, r: 1 });
    assert.ok(dw(a, 'fell').length === 1, 'it fell');
    assert.deepEqual([dw(b, 'fell').length, dw(c, 'fell').length, dw(d, 'fell').length], [1, 0, 0], 'the granted passer-by heard; the new one and the spent one none');
  });
});

test('AUDIT DRAGON-CELL III G8 two dragons in one node room (the cell tree\'s coarse nodes): an account that fought one is joined at the other, the sites counted by place (three at one, the other still stood), and its blow lands on the fight its socket joined (mutants: full by watch; the sites counted by watch; the blow to the newest fight)', async () => {
  let found = null;
  for (let w = 500_035; w < 540_000 && !found; w++) {
    const ds = Law.dragonCandidates(await watchOf(w)).filter(Law.isDragonOmen);
    for (let i = 0; i < ds.length && !found; i++) for (let j = i + 1; j < ds.length && !found; j++) {
      const p = Law.dragonCellOf(ds[i]), q = Law.dragonCellOf(ds[j]);
      for (const L of [2, 3, 4]) if (!found && nodeAt(L, p.cx, p.cy) === nodeAt(L, q.cx, q.cy)) found = { w, A: ds[i], B: ds[j], node: nodeAt(L, p.cx, p.cy) };
    }
  }
  const { w, A, B, node } = found, SA = siteOf(A), SB = siteOf(B);
  await withWorld(async ({ room, say }) => {
    const r = room(node);
    const sock = (s) => { const ws = r.connect(); ws.att.key = roomOf(s.px, s.py); ws.att.nd = node; ws.att.at = Date.now() - DRAGON_TELL_DWELL_MS; return ws; };
    const a = sock(SA);
    await r.hello(a, 'peer-0001', near(SA), { cv: 1 });
    await say(r, a, IN(SA, w));
    for (const k of [1, 2]) {   // two forged sites more at A: its place's DRAGON_SITES_MAX
      const fs = { ...SA, ...Law.pixelCentreNative(SA.px + k, SA.py) }, x = sock(fs);
      await r.hello(x, `peer-002${k}`, near(fs), { cv: 1 });
      await say(r, x, IN(fs, w));
    }
    assert.equal(r.room._dg.fights.size, Law.DRAGON_SITES_MAX);
    const b = sock(SB);
    await r.hello(b, 'peer-0001', near(SB), { cv: 1 });
    await say(r, b, IN(SB, w));
    assert.deepEqual([dw(a, 'st').length, dw(b, 'st').length, dw(b, 'no').map((m) => m.m)], [1, 1, []], 'joined at both');
    const fa = r.room._dg.fights.get(Law.dragonFightId(w, SA.sx, SA.sz)), fb = r.room._dg.fights.get(Law.dragonFightId(w, SB.sx, SB.sz));
    for (const f of [fa, fb]) { f.hp = 5; f.players['acct-peer-0001'].dealt = 1000; }
    await say(r, b, { k: 'hit', d: 40, r: 1 });
    assert.deepEqual([!!fa.fell, !!fb.fell], [false, true], 'the blow on its own fight');
  }, Math.max(Law.dragonTimes(A).landAt, Law.dragonTimes(B).landAt) + 60_000);
});

test('AUDIT DRAGON-CELL III G10, G11 the hub\'s keep: it says its newest receipt as world297 reads a keep, and hands no spent one; a fall from before DRAGON-EACH, told after it, is kept as minted - with no place (mutants: the keep world297 cannot read; a spent receipt handed; a spent keep kept; the place worked out again at the tell)', async () => {
  await withWorld(async ({ room, hub, say, set, now }) => {
    const priv = await subtle.importKey('pkcs8', Buffer.from(RELAY_KEY.pkcs8, 'base64'), { name: 'Ed25519' }, false, ['sign']);
    const mint = (o) => mintDragonReceipt({ q: W, b: 0, s: 'acct-peer-0001', c: 7, x: 'dealt', l: 20, ...o }, priv, { subtle, nowS: Math.floor(now() / 1000) });
    const fell = (body) => dragonFellInternal(hub.room, new Request('https://relay.internal/', { method: 'POST', body: JSON.stringify(body) }));
    const [r1, r2] = [await mint({ p: 1, c: 1 }), await mint({ p: 2, c: 2 })];
    await fell({ w: W, p: 1, rc: [['acct-peer-0001', r1]] }); await fell({ w: W, p: 2, rc: [['acct-peer-0001', r2]] });
    const k = hub.store.get(`${DRAGON_RC_PREFIX}acct-peer-0001`);
    assert.deepEqual([k.r, k.e], [r2, readDragonReceipt(r2).e], 'its newest, as world297 reads one');
    hub.store.set(`${DRAGON_RC_PREFIX}acct-peer-0002`, { q: W, l: [{ p: 1, r: await mint({ s: 'acct-peer-0002', p: 1 }), e: Math.floor(now() / 1000) - 1 }, { p: 2, r: await mint({ s: 'acct-peer-0002', p: 2, c: 9 }), e: Math.floor(now() / 1000) + 600 }] });
    hub.store.set(`${DRAGON_RC_PREFIX}acct-peer-0003`, { q: W, l: [{ p: 1, r: await mint({ s: 'acct-peer-0003', p: 1 }), e: Math.floor(now() / 1000) - 1 }] });
    const h2 = hub.connect(); await hub.hello(h2, 'peer-0002');
    const h3 = hub.connect(); await hub.hello(h3, 'peer-0003');
    assert.deepEqual(dw(h2, 'rcpt').map((m) => readDragonReceipt(m.r).c), [9], 'the good one alone');
    assert.deepEqual([dw(h3, 'rcpt').length, hub.store.has(`${DRAGON_RC_PREFIX}acct-peer-0003`)], [0, false], 'a keep all spent: let go');
    // G11: a fall from before, its tell still owed
    const r = aged(room(roomOf(SITE.px, SITE.py))), a = r.connect();
    await r.hello(a, 'peer-0005', near(SITE));
    await say(r, a, IN(SITE));
    const f = r.room._dg.fights.get(Law.dragonFightId(W, SITE.sx, SITE.sz));
    const down = hub.room.fetch;
    hub.room.fetch = async (req) => (new URL(req.url).pathname === DRAGON_INTERNAL_FELL ? new Response('{}', { status: 503 }) : down(req));
    f.hp = 5; f.players['acct-peer-0005'].dealt = 1000;
    const warn = console.warn; console.warn = () => {};
    try { await say(r, a, { k: 'hit', d: 40, r: 1 }); } finally { console.warn = warn; }
    assert.equal(f.told, undefined, 'the hub was down');
    const old = await mint({ s: 'acct-peer-0005', c: 11 });
    delete f.p; f.rc = { 'acct-peer-0005': old };   // as a relay before DRAGON-EACH minted it
    hub.room.fetch = down;
    for (let i = 0; i < 40 && !f.told; i++) { set(now() + 1000); if (r.alarm.at != null && now() >= r.alarm.at) await r.fire(); }
    assert.equal(f.told, true);
    assert.equal(hub.store.get(`${DRAGON_RC_PREFIX}acct-peer-0005`)?.l?.[0]?.r, old, 'kept as minted');
  });
});

/** A service database with the migrations before 0203, then 0203 itself on call. */
function d1Before0203() {
  const all = readdirSync(new URL('../../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
  const sql = (f) => readFileSync(new URL(`../../../server-account/migrations/${f}`, import.meta.url), 'utf8');
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of all.filter((f) => f < '0203')) db.exec(sql(f));
  const api = (stmt, args = []) => ({ bind: (...a) => api(stmt, a), first: async () => stmt.get(...args) ?? null, all: async () => ({ results: stmt.all(...args) }), run: async () => stmt.run(...args), _result: () => ({ results: stmt.all(...args) }) });
  return {
    _raw: db,
    migrate: () => db.exec(sql(all.find((f) => f.startsWith('0203')))),
    prepare: (q) => api(db.prepare(q)),
    async batch(list) { db.exec('BEGIN'); try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } },
  };
}
async function keys() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const key = await importReceiptKey(Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64'), { subtle });
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  return { key, pub };
}
async function member(db, n, handle = true) {
  const id = (await createGuest({ db, subtle, rand, nowS: 1_800_000_000 }, { deviceLabel: null })).id;
  if (handle) db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(`Three${n}`, `three${n}`, id);
  return { id, handle: handle ? `Three${n}` : null };
}
const draws = (seed) => (b) => (b.length === 4 ? (b.set([(seed >>> 24) & 255, (seed >>> 16) & 255, (seed >>> 8) & 255, seed & 255]), b) : rand(b));
let PLAIN = 1; while (dragonTameRoll(PLAIN)) PLAIN++;

test('AUDIT DRAGON-CELL III G13 migration 0203 on rows already there: a kill, its hoard and its tame carried at place -1, so the old receipt offered after it is `claimed`, its hoard its own device\'s and its tame told again (mutants: the kills not carried; the hoards at 0; the old tames at 0)', async () => {
  const db = d1Before0203(), T = 1_800_000_000, { key, pub } = await keys(), a = await member(db, 1);
  const r = await mintDragonReceipt({ q: W, b: 0, s: a.id, c: 7, x: 'dealt', l: 20 }, key, { subtle, nowS: T });
  db._raw.prepare(`INSERT INTO dragon_kills (watch, account, look, char_id, earned, level, nonce, at, body, tame) VALUES (?, ?, 0, 'char-0001', 'dealt', 20, 'n0', ?, NULL, 1)`).run(W, a.id, T + 30);
  db._raw.prepare('INSERT INTO dragon_spoils (watch, account, cid, at) VALUES (?, ?, ?, ?)').run(W, a.id, 'a1b2c3d4e5f60718', T + 30);
  db._raw.prepare(`INSERT INTO dragon_mounts (id, account, char_id, look, watch, at) VALUES ('dg0123456789abcdef', ?, 'char-0001', 0, ?, ?)`).run(a.id, W, T + 30);
  db.migrate();
  const again = (cid) => claimDragon({ db, nowS: T + 60, subtle, rand: draws(PLAIN) }, a, { receipt: r, character: 'char-0001', cid }, pub);
  const other = await again('0f0e0d0c0b0a0908'), own = await again('a1b2c3d4e5f60718');
  assert.deepEqual([other.recorded, other.why, other.slain, other.spoils, other.tamed?.id], [false, 'claimed', 1, false, 'dg0123456789abcdef'], 'another device: claimed, no hoard, its tame told');
  assert.equal(own.spoils, true, 'the device that wrote it: its hoard');
});

test('AUDIT DRAGON-CELL III G2 the deploy\'s window: a placed receipt is refused where an older service counted its watch at -1 after it was minted - it may be that very receipt - and counts where that row is older than it; a guest\'s hoard is one a place (mutants: the guard dropped; the guard on any -1 row; the guard\'s hoard dropped; a guest\'s hoard one a watch)', async () => {
  const db = d1(), T = 1_800_000_000, { key, pub } = await keys(), a = await member(db, 2);
  const r = (o) => mintDragonReceipt({ q: W, b: 0, s: a.id, c: 7, x: 'dealt', l: 20, ...o }, key, { subtle, nowS: o.i ?? T });
  const claim = (rc, cid, who = a) => claimDragon({ db, nowS: T + 300, subtle, rand: draws(PLAIN) }, who, { receipt: rc, character: 'char-0001', cid }, pub);
  // an older service counted a placed receipt, minted at T, at T + 30: its row at -1
  db._raw.prepare(`INSERT INTO dragon_kills (watch, place, account, look, char_id, earned, level, nonce, at, tame) VALUES (?, -1, ?, 0, 'char-0001', 'dealt', 20, 'old', ?, 0)`).run(W, a.id, T + 30);
  db._raw.prepare('INSERT INTO dragon_spoils (watch, place, account, cid, at) VALUES (?, -1, ?, ?, ?)').run(W, a.id, 'a1b2c3d4e5f60718', T + 30);
  const same = await claim(await r({ p: 10 }), '0f0e0d0c0b0a0908');
  assert.deepEqual([same.recorded, same.why, same.slain, same.spoils], [false, 'claimed', 1, false], 'minted before that row: refused, no hoard');
  const later = await claim(await r({ p: 20, i: T + 100 }), '1111111111111111');
  assert.deepEqual([later.recorded, later.slain, later.spoils], [true, 2, true], 'minted after it: another dragon');
  const g = await member(db, 3, false);
  const gr = (p) => mintDragonReceipt({ q: W, p, b: 0, s: g.id, c: 7, x: 'dealt', l: 20 }, key, { subtle, nowS: T });
  assert.deepEqual([(await claim(await gr(10), '2222222222222222', g)).spoils, (await claim(await gr(20), '3333333333333333', g)).spoils], [true, true], 'a guest: a hoard a place');
});
