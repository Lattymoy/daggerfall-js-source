// DISCORD-GATES (2026-09-28, the field's player: "add a discord channel that tells the gates in real time itll create
// hype and make more join"; Mac: "Discord live gates?", then "Omen (15 min before), Boss slain", "Ping an opt-in role"
// and, for the place, "What do you need for discord"): THE GATE'S HERALD, DRIVEN. The law (net/gateHerald.js: the
// door, the words, when each is owed, where the gate stands as accounts said it), the wire's `site` word (net/wire.js),
// the hub over the real Room with Discord stubbed (server/src/index.js: the alarm at the omen, the posts, the kill,
// a refusal posted again, nothing at all without a webhook), and the client's word (net/online.js sendGateSite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  heraldWebhook, heraldRole, heraldName, omenPost, fellPost, heraldOmenDue, heraldFellLive, gateSiteDayOk, foldGateSite, agreedGateSite,
  HERALD_RETRY_MS, HERALD_FELL_KEEP_MS, GATE_SITE_AGREE, GATE_SITE_CANDIDATES_MAX, GATE_SITE_VOTES_MAX, GATE_SITE_SKEW_MS,
} from '../src/net/gateHerald.js';
import { gateTimes, gateBossOf, gateModsOf, GATE_COLLAPSE_MS } from '../src/net/gateLaw.js';
import {
  validGateIn, parseClient, gatePlaceWire, relaySupportsGateSite, GATE_SITE_RELAY_MIN, GATE_PLACE_MAX, GATE_INTERNAL_FELL, SOCIAL_ROOM, RELAY_VERSION, ACCOUNT_SWEEP_MS, SD_KEY,
} from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';
import { OnlineSession } from '../src/net/online.js';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const HOOK = 'https://discord.com/api/webhooks/123456789012345678/abc_DEF-123';
const ROLE = '112233445566778899';
const DAY = 538;   // the field's own day: its omen 14:17:30 UTC, open 14:32:30, sealed 14:42:30, wrath 14:52:30
const TT = gateTimes(DAY);
const s = (ms) => Math.floor(ms / 1000);
/** Every character Discord reads as markdown, a link or a mention. */
const LOUD = /[*_~|`<>@:/\\[\]()#.!?&=+%$^{}";]/;

// ═══ THE LAW ═════════════════════════════════════════════════════════════════════════════════════════════════════

test('DISCORD-GATES law: THE DOOR - a Discord webhook URL (discord.com, discordapp.com, ptb, canary; an API version) or nothing, never another host, a query or a lookalike; a role is a Discord id or nothing (mutants: any https URL taken; the role taken unread)', () => {
  assert.equal(heraldWebhook(HOOK), HOOK);
  assert.equal(heraldWebhook(`  ${HOOK}\n`), HOOK, 'a pasted secret\'s whitespace');
  for (const ok of ['https://discordapp.com/api/webhooks/1/x', 'https://ptb.discord.com/api/webhooks/1/x', 'https://canary.discord.com/api/v10/webhooks/1/x-y_z']) assert.equal(heraldWebhook(ok), ok);
  for (const bad of [undefined, null, '', 'http://discord.com/api/webhooks/1/x', 'https://discord.com.evil.io/api/webhooks/1/x', 'https://evil.io/discord.com/api/webhooks/1/x',
    `${HOOK}?wait=true`, 'https://discord.com/api/webhooks/1/', 'https://discord.com/api/webhooks/x/y', 'https://example.com/hook', `${HOOK}/extra`]) assert.equal(heraldWebhook(bad), null, String(bad));
  assert.equal(heraldRole(ROLE), ROLE);
  assert.equal(heraldRole(` ${ROLE} `), ROLE);
  for (const bad of [undefined, '', '@everyone', 'Gate Watchers', '<@&112233445566778899>', '1234', '1'.repeat(22)]) assert.equal(heraldRole(bad), null, String(bad));
});

test('DISCORD-GATES law: THE OMEN\'S POST - the role pinged first and the ONLY mention Discord may make; where, when it opens (in each reader\'s own time, and how soon), when it seals, and the marks he comes under (WB13b: the chat\'s own sentence); no place said as "over the wilds", the map named (mutants: the ping dropped; every mention allowed; the open said as the seal)', () => {
  const p = omenPost({ day: DAY, place: 'Copperham, Wrothgarian Mountains', role: ROLE });
  assert.ok(p.content.startsWith(`<@&${ROLE}> `), 'the role, first');
  assert.deepEqual(p.allowed_mentions, { roles: [ROLE] }, 'that role and nothing else - no @everyone, no user, whatever the text holds');
  assert.equal(p.content, `<@&${ROLE}> **The sky burns near Copperham, Wrothgarian Mountains.** Dagon's faithful open a breach <t:${s(TT.openAt)}:R> (<t:${s(TT.openAt)}:t>). The Covenant seals it at <t:${s(TT.sealAt)}:t>. The faithful work their rite nearby. Kill their Summoner before the breach opens. ${gateBossOf(DAY).name} comes **the Storm-Crowned** tonight, Unyielding and Soul-Hungry.`);   // WB12d: the rite - AUDIT WB12d (D3): the chat's sentences, after the times   // WB11a: the nine-trial rotation moved the day's marks (it was the Burning, Soul-Hungry and Echoing)
  assert.deepEqual(gateModsOf(DAY), ['storm', 'unyielding', 'soulhungry'], 'WB8c: the day\'s own marks, in the tables\' words - never a player\'s');
  assert.equal(TT.openAt - TT.omenAt, 15 * 60_000, 'Mac\'s "15 min before": the omen is the gate\'s own, fifteen real minutes before it opens');
  const q = omenPost({ day: DAY });
  assert.deepEqual(q.allowed_mentions, { parse: [] }, 'no role: nobody pinged');
  assert.ok(q.content.startsWith('**The sky burns over the wilds.** Dagon\'s faithful open a breach'), q.content);
  assert.ok(q.content.includes('. It is marked on your map. '), 'no place: the map');
  assert.ok(!p.content.includes('marked on your map'), 'a place: said');
  assert.ok(p.content.length < 2000 && q.content.length < 2000, 'a Discord message\'s bound');
});

test('DISCORD-GATES law: THE KILL\'S POST - the boss fallen, where, by the court\'s top dealers and how many more; pings nobody; a name is letters, digits, spaces, apostrophes and hyphens (mutants: a ping on the kill; the others miscounted; a name posted raw)', () => {
  const boss = gateBossOf(DAY).name;
  const p = fellPost({ day: DAY, place: 'Copperham, Wrothgarian Mountains', top: ['Ann', 'Bran', 'Cid'], n: 15 });
  assert.equal(p.content, `**${boss} has fallen** at Dagon's Breach near Copperham, Wrothgarian Mountains, struck down by Ann, Bran, Cid and 12 others. The breach collapses.`);
  assert.deepEqual(p.allowed_mentions, { parse: [] }, 'the kill pings nobody (Mac: the role on the omen alone)');
  assert.ok(fellPost({ day: DAY, top: ['Ann', 'Bran'], n: 2 }).content.endsWith('in the wilds, struck down by Ann and Bran. The breach collapses.'));
  assert.ok(fellPost({ day: DAY, top: ['Ann'], n: 2 }).content.includes('struck down by Ann and 1 other.'));
  assert.ok(fellPost({ day: DAY, top: ['Ann'], n: 1 }).content.includes('struck down by Ann.'));
  assert.equal(fellPost({ day: DAY, top: [], n: 3 }).content, `**${boss} has fallen** at Dagon's Breach in the wilds. The breach collapses.`);
  const loud = fellPost({ day: DAY, top: ['@everyone', '**Mac**', 'https://evil.io/x', '<@&1>'], n: 4 }).content;
  assert.ok(loud.includes('struck down by everyone, Mac, httpsevilio'), loud);
  assert.ok(!/@|https:|<@&/.test(loud.replace(/^\*\*[^*]+\*\*/, '')), 'no mention and no link rides a name');
  assert.equal(heraldName('  Jo  Ann-Marie O\'Neil '), 'Jo Ann-Marie O\'Neil');
  assert.equal(heraldName('***'), '');
  for (let i = 0; i < 400; i++) {
    const raw = Array.from({ length: 1 + (i % 40) }, (_, j) => String.fromCharCode(32 + ((i * 37 + j * 101) % 95))).join('');
    const n = heraldName(raw), pl = gatePlaceWire(raw);
    assert.ok(!LOUD.test(n) && !LOUD.test(pl), JSON.stringify(raw));
    assert.equal(heraldName(n), n, 'a name is its own');
    assert.equal(gatePlaceWire(pl), pl, 'a place is its own');
    assert.ok(pl.length <= GATE_PLACE_MAX);
  }
});

test('DISCORD-GATES law: WHEN THE OMEN IS OWED - at its own instant; late while its gate has not opened (a hub asleep through it, a deploy); never twice; never once the gate is open (mutants: posted after the open; posted again; the omen\'s instant ignored)', () => {
  assert.deepEqual(heraldOmenDue(TT.omenAt - 60_000, -1), { day: DAY, at: TT.omenAt }, 'before it: at its instant');
  assert.equal(new Date(TT.omenAt).toISOString(), '2026-09-28T14:17:30.000Z', 'the field\'s day, on the wall');
  assert.deepEqual(heraldOmenDue(TT.omenAt + 5000, -1), { day: DAY, at: TT.omenAt + 5000 }, 'past its instant and unposted: now');
  assert.deepEqual(heraldOmenDue(TT.openAt - 1, -1), { day: DAY, at: TT.openAt - 1 }, 'until the gate opens');
  assert.deepEqual(heraldOmenDue(TT.openAt, -1), { day: DAY + 1, at: gateTimes(DAY + 1).omenAt }, 'open: that one is let go, the next is owed');
  assert.deepEqual(heraldOmenDue(TT.omenAt + 5000, DAY), { day: DAY + 1, at: gateTimes(DAY + 1).omenAt }, 'posted: the next');
  assert.deepEqual(heraldOmenDue(TT.omenAt + 5000, DAY + 40), { day: DAY, at: TT.omenAt + 5000 }, 'a day not yet come was no post made');
  assert.ok(heraldFellLive(DAY, TT.openAt + 1000));
  assert.ok(heraldFellLive(DAY, TT.wrathAt + GATE_COLLAPSE_MS + HERALD_FELL_KEEP_MS - 1), 'a hub told late, still news');
  assert.ok(!heraldFellLive(DAY, TT.wrathAt + GATE_COLLAPSE_MS + HERALD_FELL_KEEP_MS), 'and then not');
  assert.ok(!heraldFellLive(-1, 0));
});

test('DISCORD-GATES law: WHERE THE GATE STANDS - one word an account a day; one account names nothing, GATE_SITE_AGREE agreeing name it, the most accounts win (the first said, a tie); a newer day starts again, an older day\'s word is nothing; the record\'s bounds; the same record back when nothing moved (mutants: one account enough; a second word counted; the last said winning; the bounds lifted)', () => {
  const A = [100, 200, 'Copperham, Wrothgarian Mountains'], B = [101, 200, 'Elsewhere'];
  let r = foldGateSite(null, DAY, 's1', ...A);
  assert.deepEqual(r, { d: DAY, c: [[...A, ['s1']]] });
  assert.equal(agreedGateSite(r, DAY), null, 'one account: nothing');
  assert.equal(foldGateSite(r, DAY, 's1', ...B), r, 'its second word: nothing, the same record');
  assert.equal(foldGateSite(r, DAY, 's1', ...A), r);
  r = foldGateSite(r, DAY, 's2', ...B);
  assert.equal(agreedGateSite(r, DAY), null, 'two accounts, two places: nothing');
  r = foldGateSite(r, DAY, 's3', ...A);
  assert.equal(GATE_SITE_AGREE, 2);
  assert.deepEqual(agreedGateSite(r, DAY), { px: 100, py: 200, pl: A[2] });
  r = foldGateSite(r, DAY, 's4', ...B);
  assert.deepEqual(agreedGateSite(r, DAY), { px: 100, py: 200, pl: A[2] }, 'a tie: the first said');
  r = foldGateSite(foldGateSite(r, DAY, 's5', ...B), DAY, 's6', ...B);
  assert.deepEqual(agreedGateSite(r, DAY), { px: 101, py: 200, pl: 'Elsewhere' }, 'the most accounts');
  assert.equal(agreedGateSite(r, DAY + 1), null, 'another day\'s record names nothing');
  assert.equal(foldGateSite(r, DAY - 1, 's9', ...A), r, 'an older day\'s word');
  assert.deepEqual(foldGateSite(r, DAY + 1, 's1', ...A), { d: DAY + 1, c: [[...A, ['s1']]] }, 'a newer day starts again');
  let full = null;
  for (let i = 0; i < GATE_SITE_CANDIDATES_MAX; i++) full = foldGateSite(full, DAY, `c${i}`, i, 0, `P${i}`);
  assert.equal(foldGateSite(full, DAY, 'late', 999, 0, 'Late'), full, 'no new place past the bound');
  let many = null;
  for (let i = 0; i < GATE_SITE_VOTES_MAX; i++) many = foldGateSite(many, DAY, `v${i}`, ...A);
  assert.equal(foldGateSite(many, DAY, 'late', ...A), many, 'no vote past the bound');
  assert.equal(many.c[0][3].length, GATE_SITE_VOTES_MAX);
  // the days the hub takes a word for
  const now = TT.omenAt - 60 * 60_000;
  assert.ok(gateSiteDayOk(DAY, now), 'the gate the clock is about');
  assert.ok(!gateSiteDayOk(DAY + 1, now) && !gateSiteDayOk(DAY - 1, now));
  const turn = TT.wrathAt + GATE_COLLAPSE_MS;   // the clock turns to the next gate here
  assert.ok(gateSiteDayOk(DAY + 1, turn - GATE_SITE_SKEW_MS + 1), 'the next, a moment before the turn');
  assert.ok(!gateSiteDayOk(DAY + 1, turn - GATE_SITE_SKEW_MS - 1000));
  assert.ok(!gateSiteDayOk(DAY, turn), 'a collapsed gate\'s');
  assert.ok(!gateSiteDayOk('538', now) && !gateSiteDayOk(null, now));
});

// ═══ THE WIRE ════════════════════════════════════════════════════════════════════════════════════════════════════

test('DISCORD-GATES wire: the `site` word - its day, a map pixel and a place its law leaves as it is (never rewritten at the relay); parseClient projects it and drops the rest; said only to a relay that hears it (mutants: a raw place taken; the pixel unbounded; the version floor off)', () => {
  const ok = { k: 'site', d: DAY, px: 100, py: 200, pl: 'Copperham, Wrothgarian Mountains' };
  assert.deepEqual(validGateIn(ok), ok);
  assert.deepEqual(validGateIn({ ...ok, pl: 'Alik\'r Desert' }).pl, 'Alik\'r Desert');
  for (const bad of [{ pl: 'Copperham**' }, { pl: '<@&1> Copperham' }, { pl: 'Copper  ham' }, { pl: ' Copperham' }, { pl: ', Copperham' }, { pl: '' }, { pl: 'x'.repeat(GATE_PLACE_MAX + 1) }, { pl: 5 },
    { px: 1000 }, { py: 500 }, { px: -1 }, { px: 1.5 }, { d: -1 }, { d: '538' }]) assert.equal(validGateIn({ ...ok, ...bad }), null, JSON.stringify(bad));
  assert.deepEqual(parseClient(JSON.stringify({ t: 'gate', ...ok, extra: 1 }), { hasHello: true }), { t: 'gate', ...ok });
  assert.equal(gatePlaceWire(' St. Olms  Keep:*  '), 'St Olms Keep');
  assert.equal(GATE_SITE_RELAY_MIN, 123, 'world126 on its branch - the merge made the batch one relay past main\'s TV3 (world122)');
  assert.ok(relaySupportsGateSite('world123') && relaySupportsGateSite(RELAY_VERSION) && !relaySupportsGateSite('world122'), 'never said to a relay that would close the socket on it');
});

// ═══ THE RELAY ═══════════════════════════════════════════════════════════════════════════════════════════════════

const quiet = (fn) => { const warn = console.warn; console.warn = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; }); };
/** The hub over a driven clock with Discord stubbed: `posts` is every body the herald sent, `answer` what Discord says. */
async function withHerald(fn, { env = { GATE_DISCORD_WEBHOOK: HOOK, GATE_DISCORD_ROLE: ROLE }, start = TT.omenAt - 10 * 60_000 } = {}) {
  const r = fakeRoom(SOCIAL_ROOM);
  Object.assign(r.env, env);
  // SERPENT2: the gate's herald alone - the serpent's posts and alarms on the same door are serpent2_herald.test.js's
  r.room._serpentHeraldBeat = async () => {}; r.room._serpentHeraldArm = async () => {};
  const realNow = Date.now, realFetch = globalThis.fetch;
  let clock = start;
  // SD3: the Super dungeon's director beats on the hub's one alarm too (server/src/index.js _sdBeat) - its record seeded
  // with a rise ten years off, so this harness's alarms are the sweep's and the heralds' alone (the director's own are
  // sd3_relay.test.js's)
  r.store.set(SD_KEY, { s: 0, ph: 'gone', r: -1, at: clock, until: clock, next: clock + 10 * 365 * 86_400_000 });
  const posts = [];
  const discord = { answer: () => ({ ok: true, status: 204 }), during: null };
  Date.now = () => clock;
  globalThis.fetch = async (url, init) => {
    posts.push({ url, body: JSON.parse(init.body), method: init.method, type: init.headers['content-type'] });
    if (discord.during) { const d = discord.during; discord.during = null; await d(); }   // something the hub hears while Discord answers
    const a = discord.answer();
    if (a instanceof Error) throw a;
    return a;
  };
  const join = async (n) => { const ws = r.connect(); await r.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}` }); clock += 10; return ws; };
  const site = (ws, d, px, py, pl) => r.raw(ws, JSON.stringify({ t: 'gate', k: 'site', d, px, py, pl }));
  const fell = (d, top, n) => r.room.fetch(new Request(`https://relay.internal${GATE_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ d, at: Date.now(), top, n, rc: [], here: [] }) }));
  try { await quiet(() => fn({ r, join, site, fell, posts, discord, now: () => clock, set: (t) => { clock = t; } })); } finally { Date.now = realNow; globalThis.fetch = realFetch; }
}

test('DISCORD-GATES relay: THE OMEN - the hub\'s alarm armed for the omen at its first hello; the place two accounts agree on (one lying names nothing); posted once at its instant with the role pinged, the next armed; a refusal or a throw posted again HERALD_RETRY_MS on; a gate that opened unposted let go (mutants: the alarm left at the sweep\'s; one account naming the place; posted twice; a refusal marked posted)', async () => {
  await withHerald(async ({ r, join, site, posts, discord, set }) => {
    const a = await join('a'), b = await join('b'), c = await join('c');
    assert.equal(r.alarm.at, TT.omenAt, 'armed for the omen, hours before the sweep');
    const A = [100, 200, 'Copperham, Wrothgarian Mountains'];
    await site(a, DAY, ...A);
    await site(c, DAY, 101, 200, 'Liars Rest');
    await site(a, DAY, 101, 200, 'Liars Rest');   // a's second word: nothing
    assert.equal(agreedGateSite(r.store.get('gatesite'), DAY), null, 'one account each: nothing named yet');
    await site(b, DAY, ...A);
    assert.deepEqual(agreedGateSite(r.store.get('gatesite'), DAY), { px: 100, py: 200, pl: A[2] }, 'two accounts agree');
    await site(b, DAY + 3, ...A);   // a day the clock is not about
    assert.equal(r.store.get('gatesite').d, DAY, 'another day\'s word is not kept');
    assert.equal(posts.length, 0, 'nothing said before the omen');
    set(TT.omenAt); await r.fire();
    assert.equal(posts.length, 1, 'the omen, at its instant');
    assert.equal(posts[0].url, HOOK); assert.equal(posts[0].method, 'POST'); assert.equal(posts[0].type, 'application/json');
    assert.deepEqual(posts[0].body, omenPost({ day: DAY, place: A[2], role: ROLE }));
    assert.ok(posts[0].body.content.startsWith(`<@&${ROLE}> **The sky burns near Copperham, Wrothgarian Mountains.**`));
    assert.equal(r.store.get('herald').omen, DAY);
    assert.equal(r.alarm.at, gateTimes(DAY + 1).omenAt, 'the next gate\'s omen armed');
    await r.fire();
    assert.equal(posts.length, 1, 'never twice');
    // Discord refuses, then throws, then takes it
    const T1 = gateTimes(DAY + 1);
    discord.answer = () => ({ ok: false, status: 429 });
    set(T1.omenAt); await r.fire();
    assert.equal(posts.length, 2); assert.equal(r.store.get('herald').omen, DAY, 'a refusal is no post');
    assert.equal(r.alarm.at, T1.omenAt + HERALD_RETRY_MS, 'posted again HERALD_RETRY_MS on');
    discord.answer = () => new Error('network');
    set(T1.omenAt + HERALD_RETRY_MS); await r.fire();
    assert.equal(posts.length, 3); assert.equal(r.store.get('herald').omen, DAY);
    discord.answer = () => ({ ok: true, status: 204 });
    set(T1.omenAt + 2 * HERALD_RETRY_MS); await r.fire();
    assert.equal(posts.length, 4); assert.equal(r.store.get('herald').omen, DAY + 1);
    assert.ok(posts[3].body.content.startsWith(`<@&${ROLE}> **The sky burns over the wilds.**`), 'nobody said where the next one stands');
    // a gate that opened while nothing fired
    const T2 = gateTimes(DAY + 2);
    set(T2.openAt + 1000); await r.fire();
    assert.equal(posts.length, 4, 'let go - it is open already');
    assert.equal(r.alarm.at, gateTimes(DAY + 3).omenAt);
    // a webhook Discord refuses for good (deleted): not posted again every HERALD_RETRY_MS
    const T3 = gateTimes(DAY + 3);
    discord.answer = () => ({ ok: false, status: 404 });
    set(T3.omenAt); await r.fire();
    assert.equal(posts.length, 5); assert.equal(r.store.get('herald').omen, DAY + 3, 'refused for good: given up');
    assert.equal(r.alarm.at, gateTimes(DAY + 4).omenAt, 'no retry');
    // A KILL OWED WHILE DISCORD ANSWERS THE OMEN is kept - the beat writes over what storage holds then, not its own read
    const T4 = gateTimes(DAY + 4);
    discord.answer = () => ({ ok: true, status: 204 });
    discord.during = async () => { await r.room.fetch(new Request(`https://relay.internal${GATE_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify({ d: DAY + 4, at: T4.omenAt, top: ['Mac'], n: 1, rc: [], here: [] }) })); };
    set(T4.omenAt); await r.fire();
    assert.equal(r.store.get('herald').omen, DAY + 4, 'the omen posted');
    assert.deepEqual(r.store.get('herald').owe, { d: DAY + 4, top: ['Mac'], n: 1 }, 'and the kill owed meanwhile, kept');
    await r.fire();
    assert.ok(posts.at(-1).body.content.includes('has fallen'), 'and posted on the next beat');
    assert.equal(r.store.get('herald').fell, DAY + 4);
  });
});

test('DISCORD-GATES relay: THE KILL - owed the moment the hub hears it (kept first, the alarm armed now), posted with the agreed place and the court\'s names and no ping, once a day however often the court tells it; a kill told long after is not posted (mutants: posted twice; the owe lost on a refusal; a stale kill posted)', async () => {
  await withHerald(async ({ r, join, site, fell, posts, discord, now, set }) => {
    const a = await join('a'), b = await join('b');
    await site(a, DAY, 100, 200, 'Copperham, Wrothgarian Mountains'); await site(b, DAY, 100, 200, 'Copperham, Wrothgarian Mountains');
    set(TT.openAt + 5 * 60_000);
    discord.answer = () => ({ ok: false, status: 500 });
    const res = await fell(DAY, ['Ann', 'Bran', 'Cid'], 15);
    assert.equal(res.status, 200);
    assert.deepEqual(r.store.get('herald').owe, { d: DAY, top: ['Ann', 'Bran', 'Cid'], n: 15 }, 'kept first');
    assert.ok(r.alarm.at <= now(), 'the alarm armed now (or left sooner - an alarm past due fires at once)');
    await r.fire();
    assert.equal(posts.length, 1, 'the kill (the omen was let go: the gate is open) - Discord refused');
    assert.ok(posts[0].body.content.includes('has fallen'));
    assert.equal(r.store.get('herald').fell, -1); assert.ok(r.store.get('herald').owe, 'still owed');
    assert.equal(r.alarm.at, now() + HERALD_RETRY_MS);
    discord.answer = () => ({ ok: true, status: 204 });
    set(now() + HERALD_RETRY_MS); await r.fire();
    const kills = posts.filter((p) => p.body.content.includes('has fallen'));
    assert.deepEqual(kills.at(-1).body, fellPost({ day: DAY, place: 'Copperham, Wrothgarian Mountains', top: ['Ann', 'Bran', 'Cid'], n: 15 }));
    assert.deepEqual(kills.at(-1).body.allowed_mentions, { parse: [] }, 'no ping');
    assert.equal(r.store.get('herald').fell, DAY); assert.equal(r.store.get('herald').owe, null);
    const had = posts.length;
    await fell(DAY, ['Ann', 'Bran', 'Cid'], 15);
    assert.equal(r.store.get('herald').owe, null, 'the court told it again: nothing owed');
    await r.fire();
    assert.equal(posts.length, had, 'once a day');
    set(gateTimes(DAY + 1).wrathAt + GATE_COLLAPSE_MS + HERALD_FELL_KEEP_MS + 1);
    await fell(DAY + 1, ['Late'], 1);
    assert.equal(r.store.get('herald').owe, null, 'long collapsed: no news');
  });
});

test('DISCORD-GATES relay: NO WEBHOOK, NO HERALD - nothing posted, no owe, the sweep armed as it always was; a webhook that is not Discord\'s is none; a `site` outside the hub is junk. AUDIT WB12d (R1): the site record is kept all the same - the faithful\'s rite stands by the gate\'s agreed site, herald or none (mutants: the herald ignoring its door; the record kept only with a herald)', async () => {
  for (const env of [{}, { GATE_DISCORD_WEBHOOK: 'https://example.com/hook', GATE_DISCORD_ROLE: ROLE }]) {
    await withHerald(async ({ r, join, site, fell, posts, now, set }) => {
      const a = await join('a');
      assert.equal(r.alarm.at, now() - 10 + ACCOUNT_SWEEP_MS, 'the sweep\'s, untouched');
      await site(a, DAY, 100, 200, 'Copperham');
      assert.deepEqual(r.store.get('gatesite'), { d: DAY, c: [[100, 200, 'Copperham', ['acct-a']]] }, 'kept for the rite');   // PIN MOVED (the merge with main's FRIENDS-SYNC): the hub's account is the signed-in player's, never the browser profile's
      set(TT.omenAt); await r.fire();
      set(TT.openAt + 1000); await fell(DAY, ['Ann'], 1); await r.fire();
      assert.equal(r.store.has('herald'), false);
      assert.equal(posts.length, 0);
    }, { env });
  }
  // a site word in a place room is junk, as a `spent` is
  const cell = fakeRoom('world:6,9');
  const ws = cell.connect(); await cell.hello(ws, 'peer-x', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  await cell.raw(ws, JSON.stringify({ t: 'gate', k: 'site', d: DAY, px: 1, py: 1, pl: 'Copperham' }));
  assert.equal(ws.meters.junk, 1);
});

test('DISCORD-GATES client: the game says where it found the gate to the hub - once a socket and day, a reconnect says it again; never without an account, to a relay that would close on it, or when the send fails; the frame is the wire\'s; the scene says it off the clearing\'s own site (mutants: said every frame; said to world122; the place sent raw)', () => {
  const link = (v = RELAY_VERSION, acct = 'acct-me') => {
    const { FakeWS, sockets } = fakeSocketClass();
    const o = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'peer-me', secret: 'secret-of-peer-me', WebSocketImpl: FakeWS, now: () => 1e6, presence: false, acct, asecret: 'secret-of-acct-me' });
    o.join(SOCIAL_ROOM, null);
    const ws = sockets[0]; ws.open();
    ws.receive({ t: 'welcome', id: 'peer-me', peers: [], n: 1, v });
    const sites = () => ws.sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'gate' && m.k === 'site');
    return { o, ws, sites, sockets };
  };
  const { o, sites, ws } = link();
  assert.equal(o.sendGateSite(DAY, 100, 200, 'St. Olms, Daggerfall'), true);
  assert.deepEqual(sites(), [{ t: 'gate', k: 'site', d: DAY, px: 100, py: 200, pl: 'St Olms, Daggerfall' }], 'the place as the wire\'s law leaves it');
  assert.equal(o.sendGateSite(DAY, 100, 200, 'St. Olms, Daggerfall'), true, 'said already');
  assert.equal(sites().length, 1, 'once a socket and day');
  assert.equal(o.sendGateSite(DAY + 1, 5, 6, 'Wayrest'), true); assert.equal(sites().length, 2, 'the next day');
  o._ws = { send: () => { throw new Error('gone'); } };
  assert.equal(o.sendGateSite(DAY + 2, 5, 6, 'Wayrest'), false, 'a send that fails is said again');
  o._ws = ws;
  assert.equal(link('world122').o.sendGateSite(DAY, 1, 1, 'Wayrest'), false, 'a relay that would close the socket on it');
  assert.equal(link('world122').sites().length, 0);
  assert.equal(link(RELAY_VERSION, null).o.sendGateSite(DAY, 1, 1, 'Wayrest'), false, 'no account, no word');
  const off = link();
  assert.equal(off.o.sendGateSite(DAY, 1000, 1, 'Wayrest'), false, 'off the map');
  assert.equal(off.o.sendGateSite(DAY, 1000, 1, 'Wayrest'), true, 'and asked no more that day');
  assert.equal(off.sites().length, 0);
  // the scene: the clearing's own site, off the gate's frame
  const w = rd('src/scenes/world.js');
  assert.match(w, /const reportGateSite = \(\) => \{\n\s*const s = _gateClearNow\(\) \? _gateClearOf\.site : null;\n\s*if \(s\) socialLink\(\)\?\.sendGateSite\?\.\(s\.day, s\.px, s\.py, s\.place\);\n\s*\};/);
  assert.match(w, /gateClaims\?\.tick\(\);[^\n]*\n\s*if \(gateOmen\) reportGateSite\(\);/, 'on the gate\'s frame, online');
});

test('DISCORD-GATES config: the webhook is a Worker SECRET the repository never holds, the role a var beside the raids\' pin; the relay reads both by the names the bible gives', () => {
  const toml = rd('server/wrangler.toml');
  assert.match(toml, /^GATE_DISCORD_ROLE = "\d*"$/m, 'the role: a var, empty or an id');
  assert.ok(!/^GATE_DISCORD_WEBHOOK\s*=/m.test(toml), 'the webhook is never a var');
  assert.ok(!/discord(?:app)?\.com\/api\/webhooks\/\d/.test(toml), 'and no webhook URL is written down');
  const idx = rd('server/src/index.js');
  assert.match(idx, /heraldWebhook\(this\.env\?\.GATE_DISCORD_WEBHOOK\)/);
  assert.match(idx, /heraldRole\(this\.env\?\.GATE_DISCORD_ROLE\)/);
});
