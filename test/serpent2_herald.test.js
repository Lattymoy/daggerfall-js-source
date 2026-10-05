// SERPENT2 (2026-10-04, the owner, on the sea serpent: "So this also shows in the pause menu timer?", then "This needs to
// happen, the discord integration needs to happen"): THE SERPENT'S HERALD AND ITS TIMERS, DRIVEN. The law
// (net/serpentHerald.js: the bells' post and the kill's, when each is owed, the site the accounts agree on and the kill
// AT it), the wire's `site` word (net/wire.js), the hub over the real Room with Discord stubbed (server/src/index.js: the
// alarm at the bells, the posts, a forged site's kill never posted, a refusal posted again, nothing without a webhook),
// the client's word (net/online.js sendSerpentSite, systems/serpentOmen.js ahead, scenes/world.js), and the Timers
// window's rows (systems/eventTimers.js, ui/enhancedTimers.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  serpentHeraldRole, serpentOmenPost, serpentFellPost, serpentHeraldOmenDue, serpentHeraldFellLive, serpentSiteDayOk, agreedSerpentSite, serpentHeraldKill,
} from '../src/net/serpentHerald.js';
import { foldGateSite, HERALD_RETRY_MS, HERALD_FELL_KEEP_MS, GATE_SITE_SKEW_MS } from '../src/net/gateHerald.js';
import { serpentTimes, serpentAt, serpentPhase, SERPENT_DIVE_MS, SERPENT_EVERY_DAYS, SERPENT_SURFACE_MS } from '../src/net/serpentLaw.js';
import {
  validSerpentIn, parseClient, relaySupportsSerpentSite, SERPENT_SITE_RELAY_MIN, SERPENT_KINDS, SERPENT_INTERNAL_FELL, SOCIAL_ROOM, RELAY_VERSION, POSE_BOUND, ACCOUNT_SWEEP_MS,
} from '../src/net/wire.js';
import { createSerpentOmen } from '../src/systems/serpentOmen.js';
import { eventTimerRows } from '../src/systems/eventTimers.js';
import { TIMER_KINDS } from '../src/ui/enhancedTimers.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { SERPENT_RING_MAP_CSS } from '../src/ui/serpentMapMark.js';
import { fakeRoom } from './fakeRoom.mjs';
import { OnlineSession } from '../src/net/online.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const HOOK = 'https://discord.com/api/webhooks/123456789012345678/abc_DEF-123';
const ROLE = '112233445566778899', OWN = '998877665544332211';
const DAY = 611;   // the owner's own serpent: its bells 15:02:30 UTC 2026-10-04, rising 15:17:30, storm 15:32:30, dive 15:42:30
const T = serpentTimes(DAY);
const s = (ms) => Math.floor(ms / 1000);
const SITE = { sx: 81_000, sz: -42_000, place: 'Sentinel' };
const FORGED = { sx: 81_400, sz: -42_000 };

// ═══ THE LAW ═════════════════════════════════════════════════════════════════════════════════════════════════════

test('SERPENT2 law: THE ROLE - the serpent\'s own when the operator names one, else the gate\'s, else none; a role is a Discord id or nothing (mutants: the gate\'s role first; the own role unread)', () => {
  assert.equal(serpentHeraldRole(OWN, ROLE), OWN);
  assert.equal(serpentHeraldRole('', ROLE), ROLE, 'none named: the gate\'s');
  assert.equal(serpentHeraldRole(undefined, ROLE), ROLE);
  assert.equal(serpentHeraldRole('not-an-id', ROLE), ROLE, 'a role that is no id is none');
  assert.equal(serpentHeraldRole('', ''), null, 'neither: nobody pinged');
  assert.equal(serpentHeraldRole(` ${OWN} `, null), OWN);
});

test('SERPENT2 law: THE BELLS\' POST - the role pinged first and the ONLY mention Discord may make; where it is sighted, when it rises (in each reader\'s own time, and how soon), when the storm closes its waters; no place: ringed on the map (mutants: a ping with no role named; every mention allowed; the storm\'s time the rising\'s)', () => {
  assert.equal(new Date(T.omenAt).toISOString(), '2026-10-04T15:02:30.000Z', 'the owner\'s own serpent, on the wall');
  const p = serpentOmenPost({ day: DAY, place: 'Sentinel', role: ROLE });
  assert.equal(p.content, `<@&${ROLE}> **Bells ring in the harbours: a great serpent is sighted off Sentinel.** Sethrakul, the Old Coil, rises <t:${s(T.riseAt)}:R> (<t:${s(T.riseAt)}:t>). A storm closes over its waters at <t:${s(T.sealAt)}:t> - no ship can join after. One ship alone cannot bring it down: sail out together.`);
  assert.deepEqual(p.allowed_mentions, { roles: [ROLE] }, 'the one role, and nothing else');
  const bare = serpentOmenPost({ day: DAY });
  assert.ok(bare.content.startsWith('**Bells ring in the harbours: a great serpent is sighted on the packet lanes.**'), 'no role: no ping; no place: the lanes');
  assert.ok(bare.content.endsWith(' Its waters are ringed on your map.'));
  assert.deepEqual(bare.allowed_mentions, { parse: [] }, 'nobody');
  assert.equal(serpentOmenPost({ day: DAY, place: 'Sentinel**<@&1>' }).content.includes('off Sentinel1.'), true, 'a place is held to letters and the like');
});

test('SERPENT2 law: THE KILL\'S POST - slain, where, by its top dealers and how many more; pings nobody; a name is letters, digits, spaces, apostrophes and hyphens; no more names than the wire carries (mutants: a ping on the kill; the others miscounted; a name taken raw)', () => {
  const p = serpentFellPost({ day: DAY, place: 'Sentinel', top: ['Ann', 'Bran', 'Cid'], n: 9 });
  assert.equal(p.content, '**Sethrakul is slain** off Sentinel by Ann, Bran, Cid and 6 others. Its hoard goes to the ships that fought it.');
  assert.deepEqual(p.allowed_mentions, { parse: [] });
  assert.equal(serpentFellPost({ day: DAY, place: 'Sentinel', top: ['Ann', 'Bran'], n: 3 }).content, '**Sethrakul is slain** off Sentinel by Ann, Bran and 1 other. Its hoard goes to the ships that fought it.');
  assert.equal(serpentFellPost({ day: DAY, top: ['Ann'], n: 1 }).content, '**Sethrakul is slain** by Ann. Its hoard goes to the ships that fought it.');
  assert.equal(serpentFellPost({ day: DAY, top: ['@everyone', '**Bo**', 'Cy', 'Dee'], n: 4 }).content, '**Sethrakul is slain** by everyone, Bo, Cy and 1 other. Its hoard goes to the ships that fought it.', 'three names at most; the rest counted');
  assert.equal(serpentFellPost({ day: DAY }).content, '**Sethrakul is slain**. Its hoard goes to the ships that fought it.');
  assert.equal(serpentFellPost({ day: DAY, top: 'Ann', n: 'x' }).content, '**Sethrakul is slain**. Its hoard goes to the ships that fought it.', 'a bad list is none');
});

test('SERPENT2 law: WHEN THE BELLS ARE OWED - at their own instant; late while it has not risen (a hub asleep through them, a deploy); never twice; never once it has risen; a serpent day alone (mutants: posted after the rising; posted again; the bells\' instant ignored; a quiet day owed)', () => {
  assert.deepEqual(serpentHeraldOmenDue(T.omenAt - 60_000, -1), { day: DAY, at: T.omenAt }, 'before them: at their instant');
  assert.deepEqual(serpentHeraldOmenDue(T.omenAt + 5000, -1), { day: DAY, at: T.omenAt + 5000 }, 'past their instant, unposted: now');
  assert.deepEqual(serpentHeraldOmenDue(T.riseAt - 1, -1), { day: DAY, at: T.riseAt - 1 }, 'until it rises');
  const N = serpentTimes(DAY + SERPENT_EVERY_DAYS);
  assert.deepEqual(serpentHeraldOmenDue(T.riseAt, -1), { day: DAY + SERPENT_EVERY_DAYS, at: N.omenAt }, 'risen: let go, the next owed');
  assert.deepEqual(serpentHeraldOmenDue(T.omenAt + 5000, DAY), { day: DAY + SERPENT_EVERY_DAYS, at: N.omenAt }, 'posted: the next');
  assert.deepEqual(serpentHeraldOmenDue(T.omenAt + 5000, DAY + 40), { day: DAY, at: T.omenAt + 5000 }, 'a day not yet come was no post made');
  assert.equal(serpentHeraldOmenDue(T.omenAt, -1).day % SERPENT_EVERY_DAYS, DAY % SERPENT_EVERY_DAYS);
  assert.equal(N.omenAt - T.omenAt, 4 * 3600_000, 'every four real hours');
  assert.ok(serpentHeraldFellLive(DAY, T.riseAt + 1000));
  assert.ok(serpentHeraldFellLive(DAY, T.soundAt + SERPENT_DIVE_MS + HERALD_FELL_KEEP_MS - 1), 'a hub told late, still news');
  assert.ok(!serpentHeraldFellLive(DAY, T.soundAt + SERPENT_DIVE_MS + HERALD_FELL_KEEP_MS), 'and then not');
  assert.ok(!serpentHeraldFellLive(DAY + 1, T.riseAt), 'no serpent that day');
});

test('SERPENT2 law: WHERE IT LIES AND WHICH KILL - a word taken for the serpent the clock is about (and the next a moment before the turn); the gate\'s vote law (one account names nothing, two agree); the kill posted is the one AT the agreed site, a forged site\'s waits for ever, once a day while it is news (mutants: any site\'s kill posted; one account enough; a posted day posted again; a stale kill posted)', () => {
  const quiet = T.omenAt - 3600_000;
  assert.equal(serpentAt(quiet).day, DAY);
  assert.ok(serpentSiteDayOk(DAY, quiet), 'the serpent the clock is about');
  assert.ok(!serpentSiteDayOk(DAY + 2, quiet) && !serpentSiteDayOk(DAY - 2, quiet));
  const turn = T.soundAt + SERPENT_DIVE_MS;   // the clock turns to the next serpent here
  assert.ok(serpentSiteDayOk(DAY + 2, turn - GATE_SITE_SKEW_MS + 1), 'the next, a moment before the turn');
  assert.ok(!serpentSiteDayOk(DAY + 2, turn - GATE_SITE_SKEW_MS - 1000));
  assert.ok(!serpentSiteDayOk(DAY, turn), 'a gone serpent\'s');
  assert.ok(!serpentSiteDayOk('611', quiet) && !serpentSiteDayOk(null, quiet));
  let rec = foldGateSite(null, DAY, 'a', SITE.sx, SITE.sz, SITE.place);
  assert.equal(agreedSerpentSite(rec, DAY), null, 'one account: nothing');
  rec = foldGateSite(rec, DAY, 'b', SITE.sx, SITE.sz, SITE.place);
  assert.deepEqual(agreedSerpentSite(rec, DAY), SITE, 'two agree: its native point and its port');
  assert.equal(agreedSerpentSite(rec, DAY + 2), null);
  const at = T.riseAt + 60_000;
  const real = { at, top: ['Ann'], n: 2, sx: SITE.sx, sz: SITE.sz, d: DAY, k: 'fell' };
  const forged = { ...real, top: ['Liar'], n: 1, ...FORGED };
  assert.equal(serpentHeraldKill(null, rec, -1, at), null, 'no kill kept');
  assert.deepEqual(serpentHeraldKill({ d: DAY, list: [forged] }, rec, -1, at), { wait: true }, 'a forged site\'s kill alone: nothing posted');
  assert.deepEqual(serpentHeraldKill({ d: DAY, list: [forged, real] }, rec, -1, at), { day: DAY, place: 'Sentinel', top: ['Ann'], n: 2 }, 'the agreed site\'s');
  assert.deepEqual(serpentHeraldKill({ d: DAY, list: [{ ...real, sx: SITE.sx + 0.4 }] }, rec, -1, at).place, 'Sentinel', 'its native point to the whole unit');
  assert.deepEqual(serpentHeraldKill({ d: DAY, list: [real] }, null, -1, at), { wait: true }, 'no site agreed yet: it waits');
  assert.equal(serpentHeraldKill({ d: DAY, list: [real] }, rec, DAY, at), null, 'posted already');
  assert.equal(serpentHeraldKill({ d: DAY, list: [real] }, rec, -1, T.soundAt + SERPENT_DIVE_MS + HERALD_FELL_KEEP_MS), null, 'no news');
  assert.equal(serpentHeraldKill({ d: 'x', list: [real] }, rec, -1, at), null);
  assert.deepEqual(serpentHeraldKill({ d: DAY, list: 'x' }, rec, -1, at), { wait: true }, 'a bad list holds no kill');
});

// ═══ THE WIRE ════════════════════════════════════════════════════════════════════════════════════════════════════

test('SERPENT2 wire: the `site` word - its day, its native point to the whole unit and a port its law leaves as it is (never rewritten at the relay); parseClient projects it and drops the rest; said only to a relay that hears it (mutants: a raw place taken; the point unbounded or fractional; the version floor off)', () => {
  assert.ok(SERPENT_KINDS.includes('site'));
  const ok = { k: 'site', d: DAY, sx: SITE.sx, sz: SITE.sz, pl: 'Sentinel' };
  assert.deepEqual(validSerpentIn(ok), ok);
  assert.equal(validSerpentIn({ ...ok, pl: 'Alik\'r Desert, Sentinel' }).pl, 'Alik\'r Desert, Sentinel');
  for (const bad of [{ pl: 'Sentinel**' }, { pl: '<@&1> Sentinel' }, { pl: 'Sen  tinel' }, { pl: ' Sentinel' }, { pl: ', Sentinel' }, { pl: '' }, { pl: 'x'.repeat(65) }, { pl: 5 },
    { sx: POSE_BOUND + 1 }, { sz: -POSE_BOUND - 1 }, { sx: 1.5 }, { sz: '1' }, { d: -1 }, { d: '611' }, { d: 1.5 }]) assert.equal(validSerpentIn({ ...ok, ...bad }), null, JSON.stringify(bad));
  assert.deepEqual(parseClient(JSON.stringify({ t: 'serpent', ...ok, extra: 1 }), { hasHello: true }), { t: 'serpent', ...ok });
  assert.equal(SERPENT_SITE_RELAY_MIN, 166);
  assert.equal(RELAY_VERSION, 'world169');   // SHADOW-CLOAK moved it on after (world167, the cloak's word - PIN MOVED), SERAPH-WINGS after that (world168, the wings word - PIN MOVED), AUDIT ARENA-LADDER after that (world169, the arena ladder audit - PIN MOVED); the site's floor stays world166
  assert.ok(relaySupportsSerpentSite('world166') && relaySupportsSerpentSite(RELAY_VERSION) && !relaySupportsSerpentSite('world165') && !relaySupportsSerpentSite(null), 'never said to a relay that would close the socket on it');
});

// ═══ THE RELAY ═══════════════════════════════════════════════════════════════════════════════════════════════════

const quiet = (fn) => { const warn = console.warn; console.warn = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; }); };
/** The hub over a driven clock with Discord stubbed - the serpent's herald alone (the gate's, on the same door, is
 *  discordgates.test.js's): `posts` is every body sent, `answer` what Discord says. */
async function withHerald(fn, { env = { GATE_DISCORD_WEBHOOK: HOOK, GATE_DISCORD_ROLE: ROLE }, start = T.omenAt - 10 * 60_000 } = {}) {
  const r = fakeRoom(SOCIAL_ROOM);
  Object.assign(r.env, env);
  r.room._heraldBeat = async () => {}; r.room._heraldNextAt = () => null;
  const realNow = Date.now, realFetch = globalThis.fetch;
  let clock = start;
  const posts = [];
  const discord = { answer: () => ({ ok: true, status: 204 }) };
  Date.now = () => clock;
  globalThis.fetch = async (url, init) => {
    posts.push({ url, body: JSON.parse(init.body), method: init.method, type: init.headers['content-type'] });
    const a = discord.answer();
    if (a instanceof Error) throw a;
    return a;
  };
  const join = async (n) => { const ws = r.connect(); await r.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}` }); clock += 10; return ws; };
  const site = (ws, d, sx, sz, pl) => r.raw(ws, JSON.stringify({ t: 'serpent', k: 'site', d, sx, sz, pl }));
  const fell = (d, top, n, at = Date.now(), where = SITE) => r.room.fetch(new Request(`https://relay.internal${SERPENT_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ d, at, top, n, sx: where.sx, sz: where.sz, rc: [], here: [] }) }));
  try { await quiet(() => fn({ r, join, site, fell, posts, discord, now: () => clock, set: (t) => { clock = t; } })); } finally { Date.now = realNow; globalThis.fetch = realFetch; }
}

test('SERPENT2 relay: THE BELLS - the hub\'s alarm armed for them at its first hello; the place two accounts agree on (one lying names nothing); posted once at their instant with the serpent\'s role pinged, the next armed; a refusal or a throw posted again HERALD_RETRY_MS on; a serpent that rose unposted let go (mutants: the alarm left at the sweep\'s; one account naming the place; posted twice; a refusal marked posted; the gate\'s role pinged over the serpent\'s own)', async () => {
  await withHerald(async ({ r, join, site, posts, discord, set }) => {
    const a = await join('a'), b = await join('b'), c = await join('c');
    assert.equal(r.alarm.at, T.omenAt, 'armed for the bells, hours before the sweep');
    await site(a, DAY, SITE.sx, SITE.sz, SITE.place);
    await site(c, DAY, FORGED.sx, FORGED.sz, 'Daggerfall');
    await site(a, DAY, FORGED.sx, FORGED.sz, 'Daggerfall');   // a's second word: nothing
    assert.equal(agreedSerpentSite(r.store.get('serpentsite'), DAY), null, 'one account each: nothing named yet');
    await site(b, DAY, SITE.sx, SITE.sz, SITE.place);
    assert.deepEqual(agreedSerpentSite(r.store.get('serpentsite'), DAY), SITE, 'two accounts agree');
    await site(b, DAY + 2, SITE.sx, SITE.sz, SITE.place);   // a day the clock is not about
    assert.equal(r.store.get('serpentsite').d, DAY, 'another day\'s word is not kept');
    assert.equal(r.store.has('gatesite'), false, 'the gate\'s record untouched');
    assert.equal(posts.length, 0, 'nothing said before the bells');
    set(T.omenAt); await r.fire();
    assert.equal(posts.length, 1, 'the bells, at their instant');
    assert.equal(posts[0].url, HOOK); assert.equal(posts[0].method, 'POST'); assert.equal(posts[0].type, 'application/json');
    assert.deepEqual(posts[0].body, serpentOmenPost({ day: DAY, place: 'Sentinel', role: OWN }));
    assert.ok(posts[0].body.content.startsWith(`<@&${OWN}> **Bells ring in the harbours: a great serpent is sighted off Sentinel.**`), 'the serpent\'s own role');
    assert.equal(r.store.get('sherald').omen, DAY);
    const N = serpentTimes(DAY + 2);
    assert.equal(r.alarm.at, N.omenAt, 'the next serpent\'s bells armed');
    await r.fire();
    assert.equal(posts.length, 1, 'never twice');
    // Discord refuses, then throws, then takes it
    discord.answer = () => ({ ok: false, status: 429 });
    set(N.omenAt); await r.fire();
    assert.equal(posts.length, 2); assert.equal(r.store.get('sherald').omen, DAY, 'a refusal is no post');
    assert.equal(r.alarm.at, N.omenAt + HERALD_RETRY_MS, 'posted again HERALD_RETRY_MS on');
    discord.answer = () => new Error('network');
    set(N.omenAt + HERALD_RETRY_MS); await r.fire();
    assert.equal(posts.length, 3); assert.equal(r.store.get('sherald').omen, DAY);
    discord.answer = () => ({ ok: true, status: 204 });
    set(N.omenAt + 2 * HERALD_RETRY_MS); await r.fire();
    assert.equal(posts.length, 4); assert.equal(r.store.get('sherald').omen, DAY + 2);
    assert.ok(posts[3].body.content.includes('sighted on the packet lanes'), 'nobody said where the next one lies');
    // a serpent that rose while nothing fired
    const T4 = serpentTimes(DAY + 4);
    set(T4.riseAt + 1000); await r.fire();
    assert.equal(posts.length, 4, 'let go - it has risen');
    assert.equal(r.alarm.at, serpentTimes(DAY + 6).omenAt);
  }, { env: { GATE_DISCORD_WEBHOOK: HOOK, GATE_DISCORD_ROLE: ROLE, SERPENT_DISCORD_ROLE: OWN } });
  // no role of its own: the gate's
  await withHerald(async ({ posts, set, join, r }) => {
    await join('a');
    set(T.omenAt); await r.fire();
    assert.ok(posts[0].body.content.startsWith(`<@&${ROLE}> **Bells ring`));
    assert.deepEqual(posts[0].body.allowed_mentions, { roles: [ROLE] });
  });
});

test('SERPENT2 relay: THE KILL - posted the moment the hub hears it AT THE AGREED SITE, with its port, its top dealers and no ping, once a day however often a cell tells it; a FORGED site\'s kill is never posted (waited on, then let go once it is no news); a kill told long after is not posted; a refusal posted again (mutants: any site\'s kill posted; posted twice; a refusal marked posted; the wait never re-armed)', async () => {
  await withHerald(async ({ r, join, site, fell, posts, discord, now, set }) => {
    const a = await join('a'), b = await join('b');
    await site(a, DAY, SITE.sx, SITE.sz, SITE.place); await site(b, DAY, SITE.sx, SITE.sz, SITE.place);
    set(T.omenAt); await r.fire();
    assert.equal(posts.length, 1, 'the bells');
    // a liar's fight at a site of its own ends first
    set(T.riseAt + 4 * 60_000);
    assert.equal((await fell(DAY, ['Liar'], 1, now(), FORGED)).status, 200);
    assert.ok(r.alarm.at <= now(), 'the alarm armed now');
    await r.fire();
    assert.equal(posts.length, 1, 'a forged site\'s kill: nothing posted');
    assert.equal(r.alarm.at, now() + HERALD_RETRY_MS, 'and looked at again');
    assert.equal(r.store.get('sherald').fell, -1);
    // the honest fight's kill, Discord refusing it first
    set(now() + 60_000);
    discord.answer = () => ({ ok: false, status: 500 });
    await fell(DAY, ['Ann', 'Bran', 'Cid'], 15);
    await r.fire();
    assert.equal(posts.length, 2); assert.ok(posts[1].body.content.includes('is slain'));
    assert.equal(r.store.get('sherald').fell, -1, 'a refusal is no post');
    assert.equal(r.alarm.at, now() + HERALD_RETRY_MS);
    discord.answer = () => ({ ok: true, status: 204 });
    set(now() + HERALD_RETRY_MS); await r.fire();
    assert.equal(posts.length, 3);
    assert.deepEqual(posts[2].body, serpentFellPost({ day: DAY, place: 'Sentinel', top: ['Ann', 'Bran', 'Cid'], n: 15 }));
    assert.ok(!posts[2].body.content.includes('Liar'), 'never the liar\'s');
    assert.deepEqual(posts[2].body.allowed_mentions, { parse: [] }, 'no ping');
    assert.equal(r.store.get('sherald').fell, DAY);
    await fell(DAY, ['Ann', 'Bran', 'Cid'], 15);
    await r.fire();
    assert.equal(posts.length, 3, 'once a day');
    assert.equal(r.alarm.at, serpentTimes(DAY + 2).omenAt, 'nothing owed but the next bells');
  });
  // a forged site's kill alone: waited on while it is news, then let go
  await withHerald(async ({ r, join, site, fell, posts, set, now }) => {
    const a = await join('a'), b = await join('b');
    await site(a, DAY, SITE.sx, SITE.sz, SITE.place); await site(b, DAY, SITE.sx, SITE.sz, SITE.place);
    set(T.riseAt + 60_000);
    await fell(DAY, ['Liar'], 1, now(), FORGED);
    await r.fire();
    set(T.soundAt + SERPENT_DIVE_MS + HERALD_FELL_KEEP_MS); await r.fire();
    assert.equal(posts.length, 0, 'never posted');
    assert.equal(r.alarm.at, serpentTimes(DAY + 2).omenAt, 'no news: no longer looked at');
  }, { start: T.riseAt });
  // no site agreed: a kill waits, and is posted the moment a second account names its site
  await withHerald(async ({ r, join, site, fell, posts, set, now }) => {
    const a = await join('a'), b = await join('b');
    await site(a, DAY, SITE.sx, SITE.sz, SITE.place);
    set(T.riseAt + 60_000);
    await fell(DAY, ['Ann'], 2);
    await r.fire();
    assert.equal(posts.length, 0, 'one account: no site, no post');
    await site(b, DAY, SITE.sx, SITE.sz, SITE.place);
    set(now() + HERALD_RETRY_MS); await r.fire();
    assert.equal(posts.length, 1);
    assert.equal(posts[0].body.content, '**Sethrakul is slain** off Sentinel by Ann and 1 other. Its hoard goes to the ships that fought it.');
  }, { start: T.riseAt });
  // told long after: not news
  await withHerald(async ({ r, join, site, fell, posts, set }) => {
    const a = await join('a'), b = await join('b');
    await site(a, DAY, SITE.sx, SITE.sz, SITE.place); await site(b, DAY, SITE.sx, SITE.sz, SITE.place);
    set(T.soundAt + SERPENT_DIVE_MS + HERALD_FELL_KEEP_MS + 1);
    await fell(DAY, ['Late'], 1, T.riseAt + 60_000);
    await r.fire();
    assert.equal(posts.filter((p) => p.body.content.includes('slain')).length, 0);
  }, { start: T.riseAt });
});

test('SERPENT2 relay: NO WEBHOOK, NO HERALD - nothing posted, nothing kept of what was posted, the sweep armed as it always was; a webhook that is not Discord\'s is none; a `site` outside the hub is junk (mutants: the herald ignoring its door; a cell taking a site)', async () => {
  for (const env of [{}, { GATE_DISCORD_WEBHOOK: 'https://example.com/hook', SERPENT_DISCORD_ROLE: OWN }]) {
    await withHerald(async ({ r, join, site, fell, posts, now, set }) => {
      const a = await join('a');
      assert.equal(r.alarm.at, now() - 10 + ACCOUNT_SWEEP_MS, 'the sweep\'s, untouched');
      await site(a, DAY, SITE.sx, SITE.sz, SITE.place);
      set(T.omenAt); await r.fire();
      set(T.riseAt + 1000); await fell(DAY, ['Ann'], 1); await r.fire();
      assert.equal(r.store.has('sherald'), false);
      assert.equal(posts.length, 0);
    }, { env });
  }
  const cell = fakeRoom('world:6,9');
  const ws = cell.connect(); await cell.hello(ws, 'peer-x', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, { acct: 'acct-x', asecret: 'secret-of-acct-x' });
  await quiet(() => cell.raw(ws, JSON.stringify({ t: 'serpent', k: 'site', d: DAY, sx: 1, sz: 1, pl: 'Sentinel' })));
  assert.equal(ws.meters.junk, 1, 'a cell takes no site');
  assert.equal(cell.store.has('serpentsite'), false);
});

// ═══ THE CLIENT ══════════════════════════════════════════════════════════════════════════════════════════════════

test('SERPENT2 client: the game says where it found the serpent to the hub - once a socket and day, a reconnect says it again; its point to the whole unit and its port as the wire\'s law leaves it; never without an account, to a relay that would close on it, or when the send fails (mutants: said every frame; said to world165; the place sent raw)', () => {
  const link = (v = RELAY_VERSION, acct = 'acct-me') => {
    const { FakeWS, sockets } = fakeSocketClass();
    const o = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'peer-me', secret: 'secret-of-peer-me', WebSocketImpl: FakeWS, now: () => 1e6, presence: false, acct, asecret: 'secret-of-acct-me' });
    o.join(SOCIAL_ROOM, null);
    const ws = sockets[0]; ws.open();
    ws.receive({ t: 'welcome', id: 'peer-me', peers: [], n: 1, v });
    const sites = () => ws.sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'serpent' && m.k === 'site');
    return { o, ws, sites, sockets };
  };
  const { o, sites, ws } = link();
  assert.equal(o.sendSerpentSite(DAY, 81_000.4, -42_000.6, 'St. Olms*'), true);
  assert.deepEqual(sites(), [{ t: 'serpent', k: 'site', d: DAY, sx: 81_000, sz: -42_001, pl: 'St Olms' }], 'its point to the whole unit, the port as the wire\'s law leaves it');
  assert.equal(o.sendSerpentSite(DAY, 81_000, -42_000, 'Sentinel'), true, 'said already');
  assert.equal(sites().length, 1, 'once a socket and day');
  assert.equal(o.sendSerpentSite(DAY + 2, 5, 6, 'Wayrest'), true); assert.equal(sites().length, 2, 'the next serpent');
  o._ws = { send: () => { throw new Error('gone'); } };
  assert.equal(o.sendSerpentSite(DAY + 4, 5, 6, 'Wayrest'), false, 'a send that fails is said again');
  o._ws = ws;
  assert.equal(link('world165').o.sendSerpentSite(DAY, 1, 1, 'Wayrest'), false, 'a relay that would close the socket on it');
  assert.equal(link('world165').sites().length, 0);
  assert.equal(link(RELAY_VERSION, null).o.sendSerpentSite(DAY, 1, 1, 'Wayrest'), false, 'no account, no word');
  const off = link();
  assert.equal(off.o.sendSerpentSite(DAY, POSE_BOUND * 2, 1, 'Wayrest'), false, 'off the world');
  assert.equal(off.o.sendSerpentSite(DAY, POSE_BOUND * 2, 1, 'Wayrest'), true, 'and asked no more that day');
  assert.equal(off.o.sendSerpentSite(DAY + 2, NaN, 1, 'Wayrest'), false, 'no point');
  assert.equal(off.sites().length, 0);
});

test('SERPENT2 client: the omen finds the site AHEAD of the bells (from its quiet on, once it is settled) - the one the omen will name, asked once a day; the scene says it to the hub on the serpent\'s frame (mutants: ahead before the omen settles; another day\'s site; said only from the bells)', () => {
  let clock = T.omenAt - 3600_000, ready = false, asked = 0;
  const site = (day) => { asked++; return { day, sx: SITE.sx, sz: SITE.sz, near: 'Sentinel', place: 'Sentinel, Alik\'r Desert', ring: { cx: 0, cy: 0, r: 3 } }; };
  const omen = createSerpentOmen({ now: () => clock, site, say: () => {}, ready: () => ready, settleMs: 1000 });
  omen.frame();
  assert.equal(omen.ahead(), null, 'not ready: nothing');
  ready = true; omen.frame();
  assert.equal(omen.ahead(), null, 'settling');
  clock += 1000; omen.frame();
  assert.equal(omen.current().phase, 'quiet');
  const a = omen.ahead();
  assert.equal(a.day, DAY); assert.equal(a.site.near, 'Sentinel');
  omen.ahead(); clock = T.omenAt; omen.frame();
  assert.equal(asked, 1, 'the omen\'s own site, found once');
  clock = T.soundAt + SERPENT_DIVE_MS; omen.frame();
  assert.equal(omen.ahead().day, DAY + 2, 'the next serpent once this one is gone');
  const none = createSerpentOmen({ now: () => clock, site: () => null, say: () => {} });
  none.frame();
  assert.equal(none.ahead(), null, 'no site found: nothing said');
  const w = rd('src/scenes/world.js');
  assert.match(w, /const serpentFrame = \(\) => \{\n\s*try \{ serpentOmen\?\.frame\(\); \}[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*try \{ const a = serpentOmen\?\.ahead\?\.\(\); if \(a\) socialLink\(\)\?\.sendSerpentSite\?\.\(a\.day, a\.site\.sx, a\.site\.sz, a\.site\.near\); \}/, 'on the serpent\'s frame, after its omen');
});

test('SERPENT2 config: the role is a var beside the gate\'s, empty by default (the gate\'s pinged); the webhook is the gate\'s secret; the relay reads the serpent\'s role by the name the bible gives', () => {
  const toml = rd('server/wrangler.toml');
  assert.match(toml, /^SERPENT_DISCORD_ROLE = "\d*"$/m);
  assert.ok(!/^SERPENT_DISCORD_WEBHOOK\s*=/m.test(toml) && !/discord(?:app)?\.com\/api\/webhooks\/\d/.test(toml), 'no webhook written down');
  assert.match(rd('server/src/index.js'), /serpentHeraldRole\(this\.env\?\.SERPENT_DISCORD_ROLE, this\.env\?\.GATE_DISCORD_ROLE\)/);
});

// ═══ THE TIMERS WINDOW ═══════════════════════════════════════════════════════════════════════════════════════════

test('SERPENT2 timers: the serpent\'s row through its day - its rising counted down (the port named from its bells on), its hunt to the storm, its closed waters to its dive, and the next serpent beside it once this one is under way; a kill ends it early (mutants: the place named before the bells; the hunt counting to the dive; no next row)', () => {
  const rowsAt = (now, serpent = null) => eventTimerRows({ now, serpent }).filter((r) => r.kind === 'serpent');
  const src = { place: 'Sentinel', fellAt: () => null };
  const q = rowsAt(T.omenAt - 60_000, src);
  assert.deepEqual(q, [{ id: `serpent:${DAY}`, kind: 'serpent', title: 'Sethrakul rises', where: null, detail: 'The harbour bells ring 15 minutes before', live: false, at: T.riseAt, until: null }], 'quiet: the rising alone, nowhere named');
  const o = rowsAt(T.omenAt + 1000, src);
  assert.deepEqual(o[0], { id: `serpent:${DAY}`, kind: 'serpent', title: 'Sethrakul rises', where: 'Off Sentinel', detail: 'The harbour bells are ringing - its waters are ringed on your map', live: false, at: T.riseAt, until: null });
  const N = serpentTimes(DAY + 2);
  assert.deepEqual(o[1], { id: `serpent:${DAY + 2}`, kind: 'serpent', title: 'Next sea serpent rises', where: null, detail: null, live: false, at: N.riseAt, until: null });
  for (const at of [T.riseAt + 1, T.riseAt + SERPENT_SURFACE_MS + 1]) {
    const h = rowsAt(at, src);
    assert.equal(h[0].live, true); assert.equal(h[0].title, 'Sethrakul hunts'); assert.equal(h[0].until, T.sealAt); assert.equal(h[0].where, 'Off Sentinel');
  }
  const l = rowsAt(T.sealAt + 1, src);
  assert.equal(l[0].title, 'Sethrakul\'s waters are closed'); assert.equal(l[0].until, T.soundAt); assert.equal(l[0].detail, 'It dives when this runs out');
  assert.deepEqual(rowsAt(T.soundAt + 1, src).map((r) => r.title), ['Next sea serpent rises'], 'sounding: the next alone');
  const fellAt = T.riseAt + 5 * 60_000;
  assert.equal(serpentPhase(T, fellAt + 1, fellAt), 'slain');
  assert.deepEqual(rowsAt(fellAt + 1, { place: 'Sentinel', fellAt: (d) => (d === DAY ? fellAt : null) }).map((r) => r.title), ['Next sea serpent rises'], 'slain: its row ends');
  assert.equal(rowsAt(T.omenAt + 1000)[0].where, null, 'no host: nowhere named');
  assert.deepEqual(rowsAt(T.soundAt + SERPENT_DIVE_MS).map((r) => [r.id, r.title, r.at]), [[`serpent:${DAY + 2}`, 'Sethrakul rises', N.riseAt]], 'gone: the clock is about the next');
  // its kind in the window: after the gate's, in its waters' own colour, named in the button
  assert.deepEqual(TIMER_KINDS.slice(0, 2), ['gate', 'serpent']);
  assert.ok(ENHANCED_CSS.includes(`.px-timerswin .tm-serpent { --tm-kind: ${SERPENT_RING_MAP_CSS}; }`));
  assert.match(rd('src/ui/enhancedTimers.js'), /'Timers: gates, the sea serpent, raids, battles and resets'/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /serpent: \{ place: serpentOmen\?\.current\?\.\(\)\?\.site\?\.near \?\? null, fellAt: \(day\) => \{ const site = serpentOmen\?\.current\?\.\(\)\?\.site; return site && site\.day === day \? serpentLink\?\.fellAt\?\.\(day, site\) \?\? null : null; \} \},/, 'the host hands the omen\'s port and its own site\'s kill');
});
