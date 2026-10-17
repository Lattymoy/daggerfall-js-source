// AUDIT SERPENT (2026-10-04, Mac: "I definitely want to do a conprehensive audit on this and ensure its absolute
// perfection"): the pins of the audit's findings ON THE RELAY (bible/01-Overview/audits/Audit-Sea-Serpent.md) - each a law that
// failed before its fix, over the real Room in a real cell and the real hub. ONE FIGHT A SITE (S1: a forged site stands
// its own fight, unheard by an honest client, its kill said for its own site; at most SERPENT_SITES_MAX a day, one an
// account), the receipt of a fighter away from its cell at the kill (S5), the refused shooter not junked (S7), the slain
// refusal's words (B8), a wake's attack numbers (S9), the level never above the token's (E4), a share kept only from the
// fight's own waters (S8), the wreck's word (T2), the hub's late or stale kill (S12).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SERPENT_FIGHT_KEY, SERPENT_FIGHTS_KEY, SERPENT_SITES_MAX, SERPENT_FELLS_KEY, SERPENT_FELLS_MAX, SERPENT_RC_PREFIX, serpentFightId, SOCIAL_ROOM,
  cellRoomOfWire, PIXEL_UNITS,
} from '../../../src/net/wire.js';
import { serpentTimes, serpentSiteKey, sameSerpentSite, SERPENT_BRAIN_V, SERPENT_NATIVE_PER_M } from '../../../src/net/serpent/serpentLaw.js';
import { SERPENT_TICK_MS, SERPENT_OPENING_MS, FAN_R, ADMIT_R, ENGAGE_R, SERPENT_WAKE_SEQ, SERPENT_FIGHTERS_MAX, serpentWoke } from '../../../src/net/serpent/serpentBrain.js';
import { readSerpentReceipt, SERPENT_RECEIPT_TTL_S } from '../../../src/net/serpent/serpentReceipt.js';
import { fakeRooms } from '../../fakeRoom.mjs';

const subtle = globalThis.crypto.subtle;
const DAY = 363;
const TT = serpentTimes(DAY);
const PX = 205, PY = 214;
/** The day's site, and a FORGED one three map pixels west in the same cell (within FAN_R of it). */
const A = { sx: (PX + 0.5) * PIXEL_UNITS, sz: (499 - PY + 0.5) * PIXEL_UNITS };
const B = { sx: A.sx - 3 * PIXEL_UNITS, sz: A.sz };
const CELL = cellRoomOfWire(A.sx, A.sz);
/** A pose `mx` metres east and `mz` north of a site. */
const at = (s, mx, mz, extra = {}) => ({ x: s.sx + mx * SERPENT_NATIVE_PER_M, y: 0, z: s.sz + mz * SERPENT_NATIVE_PER_M, yaw: 0, pitch: 0, ...extra });
const words = (ws, k) => ws.sent.filter((m) => m.t === 'serpent' && (!k || m.k === k));
const IN = (s, o = {}) => ({ k: 'in', d: DAY, bv: SERPENT_BRAIN_V, lv: 20, hl: 4, sx: s.sx, sz: s.sz, ...o });
const idOf = (s) => serpentFightId(DAY, serpentSiteKey(s.sx, s.sz));
const fightAt = (r, s) => r.room._serpents?.get(idOf(s)) ?? null;
/** SERPENT4: a fight filled to SERPENT_FIGHTERS_MAX with wrecks that each had a part in it - the refusal left a newcomer
 *  while it swims, now that no storm closes its waters (they stood after the seal; `from` a fighter's record to copy). */
function fillFight(f, from) {
  for (let i = 0; Object.keys(f.players).length < SERPENT_FIGHTERS_MAX; i++) f.players[`acct-fill-${i}`] = { ...from, name: `F${i}`, dealt: 1e6, wreck: true, retired: true };
}
/** A fight swum where a blow from its waters lands, its next attack held off. */
function surfaced(f, now) {
  f.legs = [{ k: 1, at: now - 30_000, x: -60, z: 0, yw: 0, v: 11, r: 60, sd: 1, j: 1 }];
  f.modes = [{ at: now - 30_000, m: 1 }];
  f.nextAt = Infinity;
  return f;
}
async function withSea(fn, { start = TT.riseAt + 20_000 } = {}) {
  // AUDIT SERPENT 2: Date.now patched INSIDE the try - a setup that throws never leaves every later pin on this clock
  const realNow = Date.now; let clock = start;
  try {
    Date.now = () => clock;
    const world = fakeRooms({ now: () => clock });
    const r = world.room(CELL);
    const tick = async (n = 1) => { for (let i = 0; i < n; i++) { clock += SERPENT_TICK_MS; if (r.alarm.at != null && clock >= r.alarm.at) await r.fire(); } };
    const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'serpent', ...o }));
    await fn({ world, r, tick, say, now: () => clock, set: (t) => { clock = t; } });
  } finally { Date.now = realNow; }
}
const signer = async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64');
};

test('AUDIT SERPENT S1: ONE FIGHT A SITE - a forged site in the same cell stands a fight of its own; a socket that said its `in` hears its own site\'s fight alone, one that said none hears both, each word naming its site (AUDIT SERPENT 2 F1); each kill reaches the hub naming its site, and the hub keeps and says each (mutants: one fight a cell; the fan by distance alone; the site left off the kill; the hub keeping one kill)', async () => {
  assert.equal(cellRoomOfWire(B.sx, B.sz), CELL, 'the forged site is in the same cell');
  assert.ok(Math.hypot(A.sx - B.sx, A.sz - B.sz) / SERPENT_NATIVE_PER_M < FAN_R, 'and about the true one\'s waters');
  assert.notEqual(serpentSiteKey(A.sx, A.sz), serpentSiteKey(B.sx, B.sz));
  assert.ok(sameSerpentSite(A, { sx: A.sx + 0.3, sz: A.sz - 0.2 }) && !sameSerpentSite(A, B) && !sameSerpentSite(A, null));
  await withSea(async ({ world, r, tick, say, now }) => {
    r.env.GATE_SIGNING_KEY = await signer();
    const hub = world.room(SOCIAL_ROOM);
    const h9 = hub.connect(); await hub.hello(h9, 'peer-0009');
    const fanned = new Map();
    const fan = r.room._serpentFan.bind(r.room);
    r.room._serpentFan = (fights, id, f, frames) => { fanned.set(id, [...(fanned.get(id) ?? []), ...frames]); return fan(fights, id, f, frames); };
    const a = r.connect(), x = r.connect(), mid = r.connect();
    await r.hello(a, 'peer-0001', at(A, 120, 0)); await r.hello(x, 'peer-0005', at(B, 120, 0));
    await r.hello(mid, 'peer-0006', at(A, -Math.hypot(A.sx - B.sx, 0) / SERPENT_NATIVE_PER_M / 2, 0));
    await say(x, IN(B));   // the forger first: once, it stood the cell's one fight wherever it said
    await say(a, IN(A));
    const fa = fightAt(r, A), fb = fightAt(r, B);
    assert.ok(fa && fb && fa !== fb, 'two fights');
    assert.ok(fa.players['acct-peer-0001'] && !fa.players['acct-peer-0005'] && fb.players['acct-peer-0005'] && !fb.players['acct-peer-0001']);
    assert.deepEqual([words(a, 'st')[0].sx, words(x, 'st')[0].sx], [A.sx, B.sx], 'each told its own site\'s state');
    assert.deepEqual(r.store.get(SERPENT_FIGHTS_KEY).sort(), [idOf(A), idOf(B)].sort(), 'both kept, each under its own key');
    assert.ok(r.store.has(`${SERPENT_FIGHT_KEY}:${idOf(A)}`) && r.store.has(`${SERPENT_FIGHT_KEY}:${idOf(B)}`));
    await tick(Math.ceil(SERPENT_OPENING_MS / SERPENT_TICK_MS) + 24);
    const heard = (ws) => words(ws).filter((m) => m.k !== 'st').map(({ t, ...w }) => w);
    assert.ok(heard(a).some((w) => w.k === 'atk'), 'the true fight struck');
    const said = (s) => fanned.get(idOf(s)).filter((w) => w.k !== 'st').map((w) => ({ ...w, sx: s.sx, sz: s.sz }));
    assert.deepEqual(heard(a), said(A), 'the true site\'s socket heard its own fight, every word naming its site, and nothing of the other');
    assert.deepEqual(heard(x), said(B));
    const both = heard(mid);
    assert.deepEqual(both.filter((w) => w.sx === A.sx), said(A), 'a socket that said no site, between two fights, hears both - each word naming its own');
    assert.deepEqual(both.filter((w) => w.sx === B.sx), said(B));
    assert.equal(both.length, said(A).length + said(B).length);
    // the forged kill: said for its own site
    surfaced(fb, now()); fb.hp = 5;
    await say(x, { k: 'hit', d: 40, z: 0 });
    assert.equal(words(x, 'fell').length, 1);
    assert.equal(words(a, 'fell').length, 0, 'the true fight\'s socket heard no kill');
    const hubFell = words(h9, 'fell');
    assert.equal(hubFell.length, 1);
    assert.deepEqual([hubFell[0].sx, hubFell[0].sz, hubFell[0].d], [B.sx, B.sz, DAY], 'the hub says the kill with the site it fell at');
    assert.ok(!fa.fell, 'the true serpent lives');
    surfaced(fa, now()); fa.hp = 5;
    await say(a, { k: 'hit', d: 40, z: 0 });
    assert.deepEqual(words(h9, 'fell').map((w) => w.sx), [B.sx, A.sx]);
    const late = hub.connect(); await hub.hello(late, 'peer-0010');
    assert.deepEqual(words(late, 'fell').map((w) => [w.sx, w.sz]), [[B.sx, B.sz], [A.sx, A.sz]], 'a hello hears each site\'s kill');
    assert.deepEqual(hub.store.get(SERPENT_FELLS_KEY).list.map((w) => w.sx), [B.sx, A.sx]);
  });
});

test('AUDIT SERPENT S1: a ship refused a seat, between two fights, watches the one whose site her `in` named - every word of it, none of the other (mutants: the socket\'s site unset; the site not heard first)', async () => {
  await withSea(async ({ r, say, now, set }) => {
    const fanned = new Map();
    const fan = r.room._serpentFan.bind(r.room);
    r.room._serpentFan = (fights, id, f, frames) => { fanned.set(id, [...(fanned.get(id) ?? []), ...frames]); return fan(fights, id, f, frames); };
    const a = r.connect(), x = r.connect();
    await r.hello(a, 'peer-0001', at(A, 120, 0)); await r.hello(x, 'peer-0005', at(B, 120, 0));
    await say(a, IN(A)); await say(x, IN(B));
    fillFight(fightAt(r, A), fightAt(r, A).players['acct-peer-0001']);   // PIN MOVED: SERPENT4 - its waters full, never closed
    const late = r.connect();
    await r.hello(late, 'peer-0007', at(A, -1000, 0));   // 1000 m off the true site, toward the forged one
    assert.ok(1000 < ADMIT_R && Math.hypot(A.sx - B.sx, 0) / SERPENT_NATIVE_PER_M - 1000 < FAN_R, 'about both');
    await say(late, IN(A));
    assert.equal(words(late).at(-1).m, 'the waters are full');
    fanned.clear();
    const n = words(late).length;
    for (let i = 0; i < 40; i++) { set(now() + SERPENT_TICK_MS); if (r.alarm.at != null && now() >= r.alarm.at) await r.fire(); }
    const heard = words(late).slice(n).map(({ t, ...w }) => w);
    assert.ok(heard.length > 0, 'it hears');
    assert.deepEqual(heard, fanned.get(idOf(A)).map((w) => ({ ...w, sx: A.sx, sz: A.sz })), 'its own site\'s fight, word for word');
  });
});

test('AUDIT SERPENT S1: AT MOST SERPENT_SITES_MAX SITES A DAY, ONE AN ACCOUNT - an account fighting at one site is refused another; a fourth site is refused while every fight is kept - a slain one too (AUDIT SERPENT 2 F6) - and stands in the place of one nobody keeps (mutants: no cap; a fight with a part let go; an account at two sites)', async () => {
  assert.equal(SERPENT_SITES_MAX, 3);
  await withSea(async ({ r, say, now, set }) => {
    const site = (k) => ({ sx: A.sx + k * 30 * SERPENT_NATIVE_PER_M, sz: A.sz });
    const socks = [];
    for (let k = 0; k < 4; k++) { const ws = r.connect(); await r.hello(ws, `peer-000${k + 1}`, at(site(k), 0, 40)); socks.push(ws); }
    for (let k = 0; k < 2; k++) await say(socks[k], IN(site(k)));
    await say(socks[0], IN(site(3)));   // room for a third site - but not hers
    assert.deepEqual(words(socks[0]).at(-1), { t: 'serpent', k: 'no', m: 'the waters are full' }, 'one site an account a day');
    assert.equal(fightAt(r, site(3)), null);
    await say(socks[2], IN(site(2)));
    assert.equal(r.room._serpents.size, 3);
    for (let k = 0; k < 3; k++) fightAt(r, site(k)).players[`acct-peer-000${k + 1}`].dealt = 1e6;   // each kept by a part in it
    await say(socks[3], IN(site(3)));
    assert.deepEqual(words(socks[3]).at(-1), { t: 'serpent', k: 'no', m: 'the waters are full' }, 'a fourth site, every fight kept');
    assert.equal(fightAt(r, site(3)), null);
    const f1 = fightAt(r, site(1));
    f1.fell = { at: now(), top: [], n: 1 }; f1.said = true; f1.told = true;
    await say(socks[3], IN(site(3)));
    assert.equal(words(socks[3]).at(-1).m, 'the waters are full', 'a slain fight kept while its waters stand open');
    assert.equal(fightAt(r, site(1)), f1);
    // a fight with a part in it is kept though nobody stands about its waters now...
    await r.drop(socks[2]);
    await say(socks[3], IN(site(3)));
    assert.equal(words(socks[3]).at(-1).m, 'the waters are full', 'a part keeps it');
    assert.ok(fightAt(r, site(2)));
    // ...and one nobody has a part in and nobody keeps gives way
    fightAt(r, site(2)).players['acct-peer-0003'].dealt = 0;
    await say(socks[3], IN(site(3)));
    assert.ok(fightAt(r, site(3))?.players['acct-peer-0004'], 'stood in the place of the idle fight');
    assert.equal(fightAt(r, site(2)), null);
    assert.equal(r.store.has(`${SERPENT_FIGHT_KEY}:${idOf(site(2))}`), false, 'and forgotten in storage');
    assert.deepEqual(r.store.get(SERPENT_FIGHTS_KEY).sort(), [0, 1, 3].map((k) => idOf(site(k))).sort());
    // a site after it has dived stands nothing (PIN MOVED: SERPENT4 - once the storm closed its waters; they are open
    // until it dives now)
    r.room._serpents.delete(idOf(site(0)));
    const g = r.connect(); await r.hello(g, 'peer-0008', at(site(5), 0, 40));
    set(TT.sealAt + 1);
    await say(g, IN(site(5)));
    assert.ok(fightAt(r, site(5))?.players['acct-peer-0008'], 'SERPENT4: a site after the storm stands - its waters open');
    r.room._serpents.delete(idOf(site(5)));
    set(TT.soundAt + 1);
    await say(g, IN(site(5)));
    assert.deepEqual(words(g).filter((w) => w.k === 'no').map((w) => w.m), ['the serpent is gone']);
    assert.equal(fightAt(r, site(5)), null, 'no fight born that nobody may join');
    assert.equal(fightAt(r, site(5)), null, 'no fight born that nobody may join');
  });
});

test('AUDIT SERPENT S5: A FIGHTER AWAY FROM ITS CELL AT THE KILL has its receipt from the hub - at once on its newest hub socket, and at its next hello while it is good; one handed its receipt in the cell is not handed it twice; a newer day\'s is never overwritten, an expired one is forgotten by the hello and the sweep (mutants: the receipts left out of the tell; the hub handing none; handed to a fighter the cell handed; kept past expiry)', async () => {
  await withSea(async ({ world, r, say, now, set }) => {
    r.env.GATE_SIGNING_KEY = await signer();
    const hub = world.room(SOCIAL_ROOM);
    const ha = hub.connect(); await hub.hello(ha, 'peer-0001');
    const hb = hub.connect(); await hub.hello(hb, 'peer-0002');
    const a = r.connect(), b = r.connect();
    await r.hello(a, 'peer-0001', at(A, 120, 0)); await r.hello(b, 'peer-0002', at(A, 100, 0));
    await say(a, IN(A)); await say(b, IN(A));
    const f = surfaced(fightAt(r, A), now());
    for (const sub of ['acct-peer-0001', 'acct-peer-0002']) f.players[sub].dealt = f.players[sub].share;   // each her part dealt
    await r.drop(a);   // and her link to the cell gone before the kill
    f.hp = 5;
    await say(b, { k: 'hit', d: 40, z: 0 });
    assert.ok(f.rc['acct-peer-0001'] && f.rc['acct-peer-0002']);
    assert.deepEqual(f.here, ['acct-peer-0002'], 'the cell handed hers to the fighter about it');
    assert.deepEqual(words(ha, 'rcpt').map((w) => w.r), [f.rc['acct-peer-0001']], 'the hub handed hers');
    assert.equal(words(hb, 'rcpt').length, 0, 'never one the cell handed');
    assert.equal(words(b, 'rcpt').length, 1);
    const kept = hub.store.get(`${SERPENT_RC_PREFIX}acct-peer-0001`);
    assert.equal(kept.d, DAY); assert.equal(kept.r, f.rc['acct-peer-0001']); assert.equal(kept.e, readSerpentReceipt(kept.r).e);
    const back = hub.connect(); await hub.hello(back, 'peer-0001');
    assert.deepEqual(words(back, 'rcpt').map((w) => w.r), [f.rc['acct-peer-0001']], 'and to her next hello');
    // a newer day's is never overwritten by an older day's tell
    hub.store.set(`${SERPENT_RC_PREFIX}acct-peer-0002`, { d: DAY + 2, r: 'l1.newer.x', e: kept.e });
    const res = await hub.room._serpentFellInternal(new Request('https://relay.internal/', { method: 'POST', body: JSON.stringify({ d: DAY, at: f.fell.at, top: [], n: 2, sx: A.sx, sz: A.sz, rc: Object.entries(f.rc), here: [] }) }));
    assert.equal(res.status, 200);
    assert.equal(hub.store.get(`${SERPENT_RC_PREFIX}acct-peer-0002`).r, 'l1.newer.x');
    // a receipt not its account's, or not its day's, is kept for nobody
    const res2 = await hub.room._serpentFellInternal(new Request('https://relay.internal/', { method: 'POST', body: JSON.stringify({ d: DAY, at: f.fell.at, top: [], n: 2, sx: A.sx, sz: A.sz, rc: [['acct-peer-0007', f.rc['acct-peer-0001']]], here: [] }) }));
    assert.equal(res2.status, 200);
    assert.equal(hub.store.has(`${SERPENT_RC_PREFIX}acct-peer-0007`), false);
    // past its week: the hello forgets it, and the sweep forgets one whose account never came back
    set((kept.e + 1) * 1000);
    const after = hub.connect(); await hub.hello(after, 'peer-0001');
    assert.equal(words(after, 'rcpt').length, 0);
    assert.equal(hub.store.has(`${SERPENT_RC_PREFIX}acct-peer-0001`), false);
    hub.store.set(`${SERPENT_RC_PREFIX}acct-peer-0003`, { d: DAY, r: kept.r, e: kept.e });
    await hub.room._sweepHub(now());
    assert.equal(hub.store.has(`${SERPENT_RC_PREFIX}acct-peer-0003`), false);
    assert.ok(SERPENT_RECEIPT_TTL_S >= 24 * 3600);
  });
});

test('AUDIT SERPENT S12: the hub keeps the latest day\'s kills, one a site and SERPENT_FELLS_MAX the most - an older day\'s told late is neither kept nor said, and a kill whose day no longer holds is not said, its receipts kept all the same (mutants: an older day over the newer; a stale kill said to everyone)', async () => {
  await withSea(async ({ world, set }) => {
    const hub = world.room(SOCIAL_ROOM);
    const h = hub.connect(); await hub.hello(h, 'peer-0009');
    const tell = (o) => hub.room._serpentFellInternal(new Request('https://relay.internal/', { method: 'POST', body: JSON.stringify({ at: 5, top: [], n: 1, rc: [], here: [], ...o }) }));
    assert.equal((await tell({ d: DAY, sx: A.sx })).status, 400, 'a kill naming half a site');
    for (let k = 0; k < SERPENT_FELLS_MAX + 2; k++) assert.equal((await tell({ d: DAY, sx: A.sx + k * 1000, sz: A.sz })).status, 200);
    assert.equal(words(h, 'fell').length, SERPENT_FELLS_MAX + 2);
    const list = hub.store.get(SERPENT_FELLS_KEY).list;
    assert.equal(list.length, SERPENT_FELLS_MAX, 'the oldest first out');
    assert.equal(list[0].sx, A.sx + 2 * 1000);
    await tell({ d: DAY, sx: A.sx + 9 * 1000, sz: A.sz, n: 7 });
    assert.equal(hub.store.get(SERPENT_FELLS_KEY).list.filter((g) => g.sx === A.sx + 9 * 1000).length, 1, 'one a site - told again, kept once');
    const before = words(h, 'fell').length;
    assert.equal((await tell({ d: DAY - 2, sx: A.sx, sz: A.sz })).status, 200, 'answered, so its cell stops telling');
    assert.equal(words(h, 'fell').length, before, 'an older day\'s kill is not said');
    assert.equal(hub.store.get(SERPENT_FELLS_KEY).d, DAY, 'nor kept over the newer');
    set(TT.soundAt + 60 * 60 * 1000);
    await tell({ d: DAY, sx: A.sx + 20_000, sz: A.sz });
    assert.equal(words(h, 'fell').length, before, 'its day over, a late kill is not said');
  });
});

test('AUDIT SERPENT S7/B8/S9/E4/S8/T2: the relay\'s smaller laws - a refused shooter\'s volley is not junk; a ship come after the kill is told it is already slain; a fight read back after a wake numbers its attacks past any it said; the level never above the token\'s own; an `in` from past ENGAGE_R keeps no share at the fight; the wreck\'s word takes its share out and back (mutants: each)', async () => {
  await withSea(async ({ r, say, now, set }) => {
    r.env.GATE_SIGNING_KEY = await signer();
    const a = r.connect(); await r.hello(a, 'peer-0001', at(A, 120, 0), { charLevel: 12 });
    await say(a, IN(A, { lv: 40 }));
    const f = fightAt(r, A);
    assert.equal(f.players['acct-peer-0001'].lv, 12, 'E4: the token\'s character level caps the claim');
    const free = r.connect(); await r.hello(free, 'peer-0002', at(A, 100, 0));
    await say(free, IN(A, { lv: 40 }));
    assert.equal(f.players['acct-peer-0002'].lv, 40, 'a token naming no character level leaves the claim');
    // S8: a known fighter's `in` from past ENGAGE_R is not being at the fight
    const seen = f.players['acct-peer-0001'].seenAt;
    set(now() + 5000);
    await r.pose(a, at(A, ENGAGE_R + 200, 0));
    assert.ok(ENGAGE_R + 200 < ADMIT_R);
    await say(a, IN(A));
    assert.equal(f.players['acct-peer-0001'].seenAt, seen);
    await r.pose(a, at(A, 120, 0));
    await say(a, IN(A));
    assert.equal(f.players['acct-peer-0001'].seenAt, now());
    // T2: her wreck's word
    const max = f.max, share = f.players['acct-peer-0002'].share;
    await say(free, { k: 'wr', w: 1 });
    assert.equal(f.players['acct-peer-0002'].wreck, true);
    assert.ok(Math.abs(f.max - (max - share)) < 1e-6, 'her share out');
    await say(free, { k: 'wr', w: 0 });
    assert.ok(Math.abs(f.max - max) < 1e-6, 'and back');
    // S7: a ship refused a seat goes on firing - not heard, never junk (PIN MOVED: SERPENT4 - refused a full fight's seat;
    // after the seal she joins)
    set(TT.sealAt + 1);
    const late = r.connect(); await r.hello(late, 'peer-0003', at(A, 150, 0));
    fillFight(f, f.players['acct-peer-0001']);
    await say(late, IN(A));
    assert.equal(words(late).at(-1).m, 'the waters are full');
    for (let i = 0; i < 40; i++) await say(late, { k: 'hit', d: 10, z: 0 });
    assert.equal(late.closed, null, 'never closed for it');
    assert.equal(r.room._meterOf(late).junk ?? 0, 0, 'never counted junk');
    assert.ok(!f.players['acct-peer-0003']);
    // ...and still sees the fight it was refused (its `in` named the site)
    const n = words(late).length;
    f.nextAt = 0; f.openUntil = 0;
    for (let i = 0; i < 12; i++) { set(now() + SERPENT_TICK_MS); await r.fire(); }
    assert.ok(words(late).length > n, 'the refused ship hears its site\'s fight');
    // B8: the kill, then a ship come after it
    surfaced(f, now());
    await say(free, { k: 'hit', d: 1, z: 0 });   // back at it after the wait - her share back in its health
    f.hp = 5;
    await say(free, { k: 'hit', d: 40, z: 0 });
    assert.ok(f.fell);
    const after = r.connect(); await r.hello(after, 'peer-0004', at(A, 150, 0));
    await say(after, IN(A));
    assert.deepEqual(words(after).map((w) => w.k), ['st', 'no']);
    assert.equal(words(after)[1].m, 'it is already slain');
  });
  // S9: a wake reads each fight back with its attack numbers carried past any it said
  assert.equal(SERPENT_WAKE_SEQ, 50);
  assert.equal(serpentWoke({ seq: 7 }).seq, 57);
  assert.equal(serpentWoke({}).seq, 50);
  await withSea(async ({ r, say, now }) => {
    const a = r.connect(); await r.hello(a, 'peer-0001', at(A, 120, 0));
    await say(a, IN(A));
    const f = fightAt(r, A);
    f.seq = 7;
    await r.room._serpentSave(idOf(A), f, now(), true);
    r.wake();
    const woke = await r.room._serpentFights();
    assert.equal(woke.get(idOf(A)).seq, 7 + SERPENT_WAKE_SEQ);
    assert.ok(woke.get(idOf(A)).players['acct-peer-0001']);
  });
});
