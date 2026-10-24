// EG-E3 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 20, "The herald"): THE
// SPIRE'S HERALD, DRIVEN. The law (net/eliteGates/egHerald.js: every post's words and that none pings, the hub's reckoning - every
// tenth Redoubt, First of the Spire once ever, the Lone Beacon, the Descent's top a bracket a season, a band's seal
// lifted, news folded once - and the tell's shape); the director's news (net/eliteGates/egBrain.js: a Valkynaz's Redoubt, a Court
// felled alone, the end as a Descent candidate - each from a breach played to it); and the relay over real Rooms with
// Discord stubbed (server/src/index.js: the breach's room telling the hub, the hub's queue and its beat on the alarm, a
// refusal posted again HERALD_RETRY_MS on, a hub that did not answer told again, nothing owed without a webhook).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  egRedoubtPost, egFirstPost, egLonePost, egTopPost, egSealPost, egHeraldPost, egHeraldTime, egHeraldLord, egDescentBracket, egHeraldFold, egHeraldNext,
  readEgHeraldState, validEgHeraldTell, EG_INTERNAL_HERALD, EG_HERALD_KEY, EG_HERALD_KEEP_MS, EG_HERALD_TELL_MS, EG_HERALD_OWE_MAX, EG_HERALD_TOP_HALL, EG_DESCENT_BRACKETS,
} from '../../../src/net/eliteGates/egHerald.js';
import { HERALD_RETRY_MS } from '../../../src/net/gate/gateHerald.js';
import { egBreachNew, egEnter, egStep, egBlow, egDown, egWord, egEnd } from '../../../src/net/eliteGates/egBrain.js';
import { egHallOf, egRoomKey, EG_SEALED_MS, EG_OPEN, EG_BANDS } from '../../../src/net/eliteGates/egLaw.js';
import { ARENA_SEASON_S } from '../../../src/net/arena/arenaLaw.js';
import { SOCIAL_ROOM, EG_KEY } from '../../../src/net/wire.js';
import { fakeRooms } from '../../fakeRoom.mjs';
import { cardOf, cardWords } from '../../heraldCards.mjs';   // HERALD-CARDS: a post read as its card
import { EG_VOID_MAX_S } from '../../../src/net/eliteGates/egDurable.js';   // EG-ZA: the tombstone's life

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const HOOK = 'https://discord.com/api/webhooks/123456789012345678/abc_DEF-123';
const T0 = 1_800_000_000_000;
const NONE = { parse: [] };
const fresh = () => readEgHeraldState(undefined);
const tell = (b, ev) => ({ b, ev });
const rdEv = (i, w, extra = {}) => ({ i, at: T0, k: 'rd', w, h: w * 5, t: 6680, o: 'Mac', by: ['Mac', 'Ann'], ...extra });
const dcEv = (i, h, td, n, extra = {}) => ({ i, at: T0, k: 'dc', h, td, n, o: 'Mac', by: ['Mac', 'Ann', 'Cid'].slice(0, Math.min(3, n)), ...extra });

// ═══ THE LAW ═════════════════════════════════════════════════════════════════════════════════════════════════════

test('EG-E3 herald law: THE POSTS\' WORDS - every tenth Redoubt (the page\'s own sentence), First of the Spire, the Lone Beacon, a new top of the Descent and a seal lifted, each pinging nobody, every name held to letters (mutants: a post that may ping; a name taken raw; the time\'s hours dropped; a lord\'s "The" kept mid-sentence)', () => {
  const r = egRedoubtPost({ o: 'Mac', w: 10, h: 50, t: 6680 });
  // HERALD-CARDS: each a card of the Battlespire's - the deed its title, the facts its fields, the moment its footer
  assert.deepEqual(cardOf(r), { content: null, author: 'The Battlespire', colour: 0xffd56a, footer: 'Redoubt', title: 'Mac\'s company took Redoubt 10', text: null, fields: { Hall: 'Hall 50', Time: '1:51:20' } });
  assert.deepEqual(cardOf(egFirstPost({ o: 'Mac', by: ['Mac', 'Ann', 'Bran'], w: 10, h: 50, t: 6680 })), { content: null, author: 'The Battlespire', colour: 0xffd56a, footer: 'First of the Spire',
    title: 'Mac\'s company is the first ever to take Redoubt 10', text: null, fields: { Hall: 'Hall 50', Time: '1:51:20', Company: 'Mac, Ann and Bran' } });
  assert.deepEqual([cardOf(egLonePost({ n: 'Mara', lk: 'ilthys', c: 5 })).title, cardOf(egLonePost({ n: 'Mara', lk: 'ilthys', c: 5 })).text, cardOf(egLonePost({ n: 'Mara', lk: 'ilthys', c: 5 })).footer],
    ['Mara felled Valkynaz Ilthys alone', 'The last of a company of 5 still standing.', 'The Lone Beacon']);
  assert.equal(cardOf(egLonePost({ n: 'Mara', lk: 'spellmaster', c: 4 })).title, 'Mara felled the Last Spellmaster alone');
  assert.deepEqual(cardOf(egTopPost({ br: 1, by: ['Ann', 'Bran', 'Cid'], h: 47, td: 6252 })), { content: null, author: 'The Battlespire', colour: 0xffd56a, footer: 'Descent record',
    title: 'A new top of the Descent', text: null, fields: { Bracket: 'The Few', Company: 'Ann, Bran and Cid', 'Deepest hall': 'Hall 47', Time: '1:44:12' } });
  assert.deepEqual([cardOf(egSealPost({ band: 0, o: 'Mac' })).title, cardOf(egSealPost({ band: 0, o: 'Mac' })).text, cardOf(egSealPost({ band: 0, o: 'Mac' })).footer],
    ['The way below the Galleries is open', 'Mac\'s company is the first through.', 'Seal lifted']);
  for (const p of [r, egFirstPost({ w: 10, h: 50, t: 1 }), egLonePost({ c: 4 }), egTopPost({ br: 0, h: 10, td: 1 }), egSealPost({ band: 1 })]) assert.deepEqual(p.allowed_mentions, NONE, 'nobody pinged');
  // a player's name can carry no mention, link or markdown
  const evil = egRedoubtPost({ o: '**@everyone** <@&1>', w: 20, h: 100, t: 59 });
  assert.deepEqual([cardOf(evil).title, cardOf(evil).fields.Time], ['everyone 1\'s company took Redoubt 20', '0:59']);
  assert.ok(!/@|\*|<@&/.test(cardWords(evil)), 'no mention and no markdown rides a name');
  assert.ok(cardOf(egFirstPost({ o: '', by: [], w: 10, h: 50, t: 7200 })).title.startsWith('A company is the first ever'), 'no name: a company');
  assert.deepEqual(cardOf(egTopPost({ br: 2, by: ['@@'], o: 'Mac', h: 12, td: 61 })).fields, { Bracket: 'The Company', Company: 'Mac\'s company', 'Deepest hall': 'Hall 12', Time: '1:01' });
  assert.equal(cardOf(egLonePost({ n: '', lk: 'nobody', c: 4 })).title, 'Someone felled the Court\'s lord alone');
  assert.deepEqual([egHeraldTime(0), egHeraldTime(59), egHeraldTime(3599), egHeraldTime(3600), egHeraldTime(36_061)], ['0:00', '0:59', '59:59', '1:00:00', '10:01:01']);
  assert.equal(egHeraldLord('hound'), 'Grath');
  // the dispatcher reads the owed record's kind
  assert.deepEqual(egHeraldPost({ kind: 'rd', o: 'Mac', w: 10, h: 50, t: 6680 }), r);
  assert.equal(cardOf(egHeraldPost({ kind: 'seal', band: 2, o: 'Mac' })).title, 'The way below the Shade Perilous is open');
  assert.deepEqual(egHeraldPost({ kind: 'lb', n: 'Mara', lk: 'ilthys', c: 5 }), egLonePost({ n: 'Mara', lk: 'ilthys', c: 5 }));
  assert.deepEqual(egHeraldPost({ kind: 'top', br: 0, by: ['Mara'], h: 30, td: 100 }), egTopPost({ br: 0, by: ['Mara'], h: 30, td: 100 }));
  assert.deepEqual(egHeraldPost({ kind: 'first', o: 'Mac', by: ['Mac'], w: 10, h: 50, t: 1 }), egFirstPost({ o: 'Mac', by: ['Mac'], w: 10, h: 50, t: 1 }));
});

test('EG-E3 herald law: THE RECKONING - every tenth Redoubt owed and no other; the first Redoubt 10 ever First of the Spire in its place, and never again; the Lone Beacon; news told twice folded once; a hub with no herald keeps the reckoning and owes nothing; the owed list bounded (mutants: every Valkynaz Redoubt posted; First of the Spire twice; the seen list ignored; posts owed with no herald)', () => {
  let st = egHeraldFold(fresh(), tell('0123456789abcdef', [rdEv(1, 5), rdEv(2, 10), rdEv(3, 15), { i: 4, at: T0, k: 'lb', n: 'Mara', lk: 'ilthys', c: 5 }]), { nowMs: T0 });
  assert.deepEqual(st.q.map((p) => [p.kind, p.w ?? null]), [['first', 10], ['lb', null]], 'Redoubts 5 and 15 are a Valkynaz\'s, not the channel\'s');
  assert.deepEqual(st.q.map((p) => p.i), [1, 2], 'numbered in order');
  assert.equal(st.first, 1);
  assert.equal(st.base, EG_OPEN, 'the bands open when the hub first heard of the Spire');
  const again = egHeraldFold(st, tell('0123456789abcdef', [rdEv(2, 10)]), { nowMs: T0 + 1 });
  assert.equal(again.q.length, 2, 'the same news told again (a lost answer) is folded once');
  st = egHeraldFold(st, tell('fedcba9876543210', [rdEv(1, 10), rdEv(2, 20)]), { nowMs: T0 + 2 });
  assert.deepEqual(st.q.slice(2).map((p) => [p.kind, p.w]), [['rd', 10], ['rd', 20]], 'another breach\'s Redoubt 10 is the channel\'s plain post: First of the Spire is once ever');
  // no herald: the first company ever is still the first - and nothing is owed
  const quiet = egHeraldFold(fresh(), tell('0123456789abcdef', [rdEv(1, 10)]), { nowMs: T0, post: false });
  assert.deepEqual([quiet.first, quiet.q.length, quiet.n], [1, 0, 0]);
  assert.equal(egHeraldFold(quiet, tell('fedcba9876543210', [rdEv(1, 10)]), { nowMs: T0 }).q[0].kind, 'rd', 'a webhook given later never calls the second company first');
  // bounded: the oldest let go
  let many = fresh();
  for (let k = 1; k <= EG_HERALD_OWE_MAX + 4; k++) many = egHeraldFold(many, tell('0123456789abcdef', [rdEv(k, 10 * k)]), { nowMs: T0 });
  assert.equal(many.q.length, EG_HERALD_OWE_MAX);
  assert.equal(many.q[0].w, 50, 'the oldest four let go');
  assert.equal(egHeraldFold(fresh(), tell('0123456789abcdef', Array.from({ length: 80 }, (_, k) => ({ i: k + 1, at: T0, k: 'lb', n: 'x', lk: '', c: 4 }))), { nowMs: T0 }).seen.length, 64, 'the seen list bounded');
});

test('EG-E3 herald law: A BAND\'S SEAL LIFTED - said by the first breach through a band a deploy opened (a Valkynaz\'s Redoubt closing the band above it), once; a band open since the hub first heard of the Spire is never news, nor one still sealed (mutants: the seal said every breach; said for a band open from the start; said for a band past EG_OPEN)', () => {
  assert.equal(EG_OPEN, EG_BANDS.length, 'EG-FULL laid every band: all open today');
  // the hub first heard of the Spire on a deploy that opened the Galleries alone
  let st = egHeraldFold(fresh(), tell('0123456789abcdef', [rdEv(1, 5)]), { nowMs: T0, open: 1 });
  assert.deepEqual([st.base, st.said, st.q.length], [1, -1, 0], 'the seal at Hall 25: nothing lifted');
  // a deploy opens the Soul Cairn: the first breach through says it, and only it
  st = egHeraldFold(st, tell('fedcba9876543210', [rdEv(1, 5, { o: 'Ann' })]), { nowMs: T0 + 1, open: 2 });
  assert.deepEqual(st.q.map((p) => [p.kind, p.band]), [['seal', 0]]);
  assert.deepEqual([cardOf(egHeraldPost(st.q[0])).title, cardOf(egHeraldPost(st.q[0])).text], ['The way below the Galleries is open', 'Ann\'s company is the first through.']);
  st = egHeraldFold(st, tell('aaaaaaaaaaaaaaaa', [rdEv(1, 5)]), { nowMs: T0 + 2, open: 2 });
  assert.equal(st.q.length, 1, 'once');
  // Hall 50 closes the Cairn - its band below still sealed: nothing
  st = egHeraldFold(st, tell('bbbbbbbbbbbbbbbb', [rdEv(1, 10)]), { nowMs: T0 + 3, open: 2 });
  assert.deepEqual(st.q.map((p) => p.kind), ['seal', 'first'], 'Redoubt 10 is First of the Spire, and no seal');
  st = egHeraldFold(st, tell('cccccccccccccccc', [rdEv(1, 10)]), { nowMs: T0 + 4, open: 4 });
  assert.deepEqual(st.q.slice(2).map((p) => [p.kind, p.band ?? p.w]), [['rd', 10], ['seal', 1]], 'every band opened: the way below the Soul Cairn');
  // a hub that first heard of the Spire with every band open says no seal ever
  const all = egHeraldFold(fresh(), tell('0123456789abcdef', [rdEv(1, 5), rdEv(2, 10), rdEv(3, 15), rdEv(4, 20)]), { nowMs: T0 });
  assert.ok(!all.q.some((p) => p.kind === 'seal'));
});

test('EG-E3 herald law: THE DESCENT\'S TOP - the hub\'s own reckoning a bracket (Alone 1, the Few 2-4, the Company 5-8): deeper, or as deep in fewer seconds, is a new top; a new season begins again; a top shallower than EG_HERALD_TOP_HALL kept and not said (mutants: a bracket off by one; the seconds\' tie-break inverted; the season never turning; the floor gone)', () => {
  assert.deepEqual([0, 1, 2, 4, 5, 8, 9].map(egDescentBracket), [-1, 0, 1, 1, 2, 2, -1]);
  assert.deepEqual([...EG_DESCENT_BRACKETS], ['Alone', 'the Few', 'the Company']);
  const B = '0123456789abcdef';
  let st = egHeraldFold(fresh(), tell(B, [dcEv(1, 30, 4000, 3)]), { nowMs: T0 });
  assert.deepEqual(st.q.map((p) => [p.kind, p.br, p.h, p.td]), [['top', 1, 30, 4000]]);
  assert.deepEqual(cardOf(egHeraldPost(st.q[0])).fields, { Bracket: 'The Few', Company: 'Mac, Ann and Cid', 'Deepest hall': 'Hall 30', Time: '1:06:40' });
  st = egHeraldFold(st, tell(B, [dcEv(2, 29, 100, 2), dcEv(3, 30, 4000, 4), dcEv(4, 30, 3999, 2), dcEv(5, 31, 9000, 4)]), { nowMs: T0 + 1 });
  assert.deepEqual(st.q.slice(1).map((p) => [p.h, p.td]), [[30, 3999], [31, 9000]], 'shallower and a tie are no news; fewer seconds and deeper are');
  assert.deepEqual(st.top.b[1], [31, 9000]);
  st = egHeraldFold(st, tell(B, [dcEv(6, 12, 500, 1), dcEv(7, 20, 900, 6), dcEv(8, 50, 1, 9)]), { nowMs: T0 + 2 });
  assert.deepEqual(st.q.slice(3).map((p) => [p.br, p.h]), [[0, 12], [2, 20]], 'each bracket its own; a company of nine none');
  // a new season: every bracket begins again
  const next = T0 + ARENA_SEASON_S * 1000;
  st = egHeraldFold(st, tell(B, [dcEv(9, 15, 800, 3)]), { nowMs: next });
  assert.deepEqual(st.q.at(-1).h, 15, 'the Few\'s best last season was Hall 31 - this season\'s first top is Hall 15');
  assert.equal(st.top.b[0], null, 'and Alone\'s is empty');
  // under the floor: kept, and not said
  let low = egHeraldFold(fresh(), tell(B, [dcEv(1, EG_HERALD_TOP_HALL - 1, 300, 1)]), { nowMs: T0 });
  assert.deepEqual([low.q.length, low.top.b[0]], [0, [EG_HERALD_TOP_HALL - 1, 300]]);
  low = egHeraldFold(low, tell(B, [dcEv(2, EG_HERALD_TOP_HALL - 1, 400, 1), dcEv(3, EG_HERALD_TOP_HALL, 2000, 1)]), { nowMs: T0 });
  assert.deepEqual(low.q.map((p) => p.h), [EG_HERALD_TOP_HALL]);
});

test('EG-E3 herald law: THE TELL\'S SHAPE - the hub reads a breach\'s tell through the law: a breach id, at most a breach\'s news, each piece projected (names cut, a company at most) and one out of shape dropped; the record read back through its shape; the next post past those done, one no longer news let go (mutants: a tell of another shape folded; a bad piece taken; a stale post posted)', () => {
  assert.equal(validEgHeraldTell(null), null);
  assert.equal(validEgHeraldTell({ b: 'nothex', ev: [] }), null);
  assert.equal(validEgHeraldTell({ b: '0123456789abcdef', ev: Array.from({ length: 17 }, (_, k) => rdEv(k + 1, 10)) }), null);
  const t = validEgHeraldTell({ b: '0123456789abcdef', ev: [rdEv(1, 10, { o: 'x'.repeat(99), by: Array(12).fill('Ann'), zz: 1 }), { i: 2, at: T0, k: 'rd', w: 0, h: 5, t: 1 }, { i: 3, at: T0, k: 'lb', n: 'M', lk: 'Ilthys!', c: 4 },
    { i: 4, at: T0, k: 'dc', h: 50, td: 10, n: 9 }, { i: 5, at: T0, k: 'lb', n: 'M', lk: '', c: 4 }, { i: 6, k: 'lb', n: 'M', lk: '', c: 4 }, { i: 7, at: T0, k: 'open' }] });
  assert.deepEqual(t.ev.map((e) => e.i), [1, 5], 'a Redoubt 0, a lord out of shape, a company of nine, no clock and an opening dropped');
  assert.equal(t.ev[0].o.length, 64);
  assert.equal(t.ev[0].by.length, 8);
  assert.equal(t.ev[0].zz, undefined);
  const st = readEgHeraldState({ q: [{ i: 1, at: T0, kind: 'rd' }, { i: 2, kind: 'rd' }, null], n: 'x', first: 2, top: { s: 3, b: [[10, 5], 'x'] } });
  assert.deepEqual([st.q.length, st.n, st.first, st.base, st.said, st.top.s, st.top.b], [1, 0, 0, -1, -1, 3, [[10, 5], null, null]]);
  const q = { ...fresh(), q: [{ i: 1, at: T0, kind: 'rd' }, { i: 2, at: T0 + EG_HERALD_KEEP_MS, kind: 'lb' }, { i: 3, at: T0 + EG_HERALD_KEEP_MS, kind: 'top' }] };
  assert.deepEqual(egHeraldNext(q, new Set(), T0 + EG_HERALD_KEEP_MS), { p: q.q[1], gone: [1] }, 'an hour old: no news, let go');
  assert.deepEqual(egHeraldNext(q, new Set([2]), T0 + EG_HERALD_KEEP_MS).p, q.q[2]);
  assert.deepEqual(egHeraldNext(q, new Set([2, 3]), T0 + EG_HERALD_KEEP_MS), { p: null, gone: [1] });
});

// ═══ THE DIRECTOR'S NEWS ═════════════════════════════════════════════════════════════════════════════════════════

/** A breach of `n` opened on `seed`, begun (as the page's start-deeper harness does) at Court hall `start`, played by an
 *  auto-player that stands where a player would (test/net/eliteGates/egfull_relay.test.js's) until `until`; `fall` the members who fall
 *  as the company gathers. */
function play({ n = 3, seed = 12345, start = 5, until = () => false, fall = [], wg = [], ew = 0, rh = 0, maxMs = 40 * 60_000 } = {}) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew, rh, seed, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg });
  let now = T0 + EG_SEALED_MS + 100;
  const pos = {};
  for (const [sub] of co) { assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null); pos[sub] = { sx: 0, z: 0 }; }
  B.h = start; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  for (const sub of fall) egWord(B, sub, { k: 'fell' }, null, now, rng);
  while (now < T0 + maxMs && !B.end && !until(B)) {
    now += 250;
    const spec = egHallOf(B.seed, B.h, 0), F = B.F;
    for (const [sub, m] of Object.entries(B.mem)) {
      if (!m.alive) continue;
      const p = pos[sub], x0 = spec.x0;
      const live = F ? F.bodies.filter((b) => b.hp > 0 && !(b.fl & (2 | 16 | 128))) : [];
      const tgt = live.filter((b) => b.role === 1)[0] ?? live.sort((a, b) => Math.hypot(a.x - (p.sx - x0), a.z - p.z) - Math.hypot(b.x - (p.sx - x0), b.z - p.z))[0];
      if (B.sg === 'arrive') { p.sx = x0 + spec.arrive.x + (m.n - 1) * 0.5; p.z = spec.arrive.z; }
      else if (B.sg === 'trial') {
        if (spec.kind === 'court' && F && !F.bodies.some((b) => b.role === 0 && b.up2)) { p.sx = x0 + spec.ring.x; p.z = spec.ring.z; }
        else if (tgt) { const yw = tgt.yaw ?? 0, sd = m.n % 2 ? 1 : -1; p.sx = x0 + tgt.x - Math.sin(yw) * 1.5 + sd * 0.3; p.z = tgt.z - Math.cos(yw) * 1.5; }
      } else if (B.sg === 'closing') { p.sx = x0 + spec.end.x; p.z = spec.end.z; }
    }
    egStep(B, now, Object.entries(B.mem).filter(([, m]) => m.alive).map(([sub]) => ({ sub, sx: pos[sub].sx, z: pos[sub].z, dead: false, at: now })), rng);
    for (const [sub, m] of Object.entries(B.mem)) {
      if (!m.alive || B.sg !== 'trial' || !B.F) { if (m.alive && B.sg === 'closing') egDown(B, sub, B.h, pos[sub], now); continue; }
      const p = pos[sub], sp = egHallOf(B.seed, B.h, 0);
      const live = B.F.bodies.filter((b) => b.hp > 0 && !(b.fl & (2 | 16 | 128)));
      const tgt = live.filter((b) => b.role === 1)[0] ?? live.sort((a, b) => Math.hypot(a.x - (p.sx - sp.x0), a.z - p.z) - Math.hypot(b.x - (p.sx - sp.x0), b.z - p.z))[0];
      if (tgt) egBlow(B, sub, { k: 'hit', i: tgt.i, q: Math.floor(now / 250), d: 200, r: 1 }, { sx: p.sx, z: p.z }, now);
    }
  }
  return { B, now: () => now };
}

test('EG-E3 the director\'s news: Redoubt 10 (Hall 50, a Valkynaz\'s) is told with its hall, its seconds, the opener and the earners; a Court felled by the one member standing of four is the Lone Beacon, once; the end is a Descent candidate with the deepest hall, its seconds from the first wake to its door and the entrants - and no candidate for a breach begun deeper, wagered or a Rehearsal; a common Redoubt is no news (mutants: no news at a Valkynaz\'s Redoubt; every Redoubt news; the lone Court unsaid; the candidate\'s seconds the end\'s)', () => {
  const { B, now } = play({ n: 4, seed: 4242, start: 50, fall: ['acct-1', 'acct-2', 'acct-3'], until: (b) => b.sg === 'rest' });
  assert.equal(B.rd, 10, `Redoubt 10 taken (stage ${B.sg}, hall ${B.h})`);
  const rdNews = B.hq.find((e) => e.k === 'rd');
  assert.deepEqual([rdNews.w, rdNews.h, rdNews.o, rdNews.by], [10, 50, 'M0', ['M0']]);
  assert.equal(rdNews.t, Math.floor((B.rdAt - B.wk) / 1000));
  const lb = B.hq.filter((e) => e.k === 'lb');
  assert.deepEqual(lb.map((e) => [e.n, e.lk, e.c]), [['M0', egHallOf(B.seed, 50, 0).lord, 4]]);
  assert.equal(B.td, rdNews.t, 'the Court cleared at its fall');
  const rdAt = B.rdAt;
  egEnd(B, 'home', now() + 60_000, []);
  const dc = B.hq.find((e) => e.k === 'dc');
  assert.deepEqual([dc.h, dc.td, dc.n, dc.o, dc.by], [50, Math.floor((rdAt - B.wk) / 1000), 4, 'M0', ['M0', 'M1', 'M2', 'M3']]);
  assert.deepEqual(B.hq.map((e) => e.i), [1, 2, 3], 'numbered for the hub');
  // a common Redoubt is no news; a breach begun deeper, wagered or rehearsed is no candidate
  const plain = play({ n: 2, seed: 77, start: 5, until: (b) => b.sg === 'rest' });
  assert.equal(plain.B.rd, 1);
  assert.equal(plain.B.hq, undefined, 'Redoubt 1 is no Valkynaz\'s');
  egEnd(plain.B, 'last', plain.now(), []);
  assert.deepEqual(plain.B.hq.map((e) => [e.k, e.h, e.n]), [['dc', 5, 2]]);
  for (const o of [{ ew: 2 }, { wg: [1] }]) {
    const x = play({ n: 1, seed: 77, start: 5, until: (b) => b.sg === 'rest', ...o });
    egEnd(x.B, 'last', x.now(), []);
    assert.equal((x.B.hq ?? []).length, 0, JSON.stringify(o));
  }
  const reh = play({ n: 1, seed: 77, start: 5, rh: 1 });
  assert.equal(reh.B.end, 'rehearsal');
  assert.equal((reh.B.hq ?? []).length, 0, 'a Rehearsal is no candidate');
});

// ═══ THE RELAY ═══════════════════════════════════════════════════════════════════════════════════════════════════

const quiet = (fn) => { const warn = console.warn; console.warn = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; }); };
/** A breach's record whose news is owed, ended, kept in its room (the director's shape, as the play leaves it). */
const ended = (b, hq) => ({ ...egBreachNew({ b, ez: 'z'.repeat(20), s: 'acct-0', o: 'Mac', ew: 0, rh: 0, seed: 1, op: T0, co: [['acct-0', 'Mac', 1]], site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] }), end: 'home', endAt: T0, sg: 'end', hq });
/** The hub and the world of rooms over a driven clock, Discord stubbed: `posts` every body sent, `discord.answer` what it
 *  says. The gate's, the serpent's and the Abyss Dungeon's heralds and director are theirs (discordgates.test.js,
 *  serpent2_herald.test.js, sdherald.test.js, and the Sky-Ketch's ketch_herald.test.js). */
async function withHub(fn, { env = { GATE_DISCORD_WEBHOOK: HOOK } } = {}) {
  const realNow = Date.now, realFetch = globalThis.fetch;
  let clock = T0;
  Date.now = () => clock;
  const world = fakeRooms({ now: () => clock });
  const hub = world.room(SOCIAL_ROOM);
  Object.assign(hub.env, env);
  hub.room._heraldBeat = async () => {}; hub.room._serpentHeraldBeat = async () => {}; hub.room._sdBeat = async () => {}; hub.room._sdHeraldBeat = async () => {}; hub.room._ktHeraldBeat = async () => {};   // KETCH-EVERY: the Sky-Ketch's too (ketch_herald.test.js) - every ten hours a voyage, its card would post among the Spire's
  hub.store.set('hub', 1);
  const posts = [];
  const discord = { answer: () => ({ ok: true, status: 204 }) };
  globalThis.fetch = async (url, init) => {
    posts.push({ url, body: JSON.parse(init.body) });
    const a = discord.answer();
    if (a instanceof Error) throw a;
    return a;
  };
  const breach = (b, hq) => { const eg = world.room(egRoomKey(b)); eg.store.set(EG_KEY, ended(b, hq)); return eg; };
  const told = (body) => hub.room.fetch(new Request(`https://relay.internal${EG_INTERNAL_HERALD}`, { method: 'POST', body: JSON.stringify(body) }));
  try { await quiet(() => fn({ world, hub, breach, told, posts, discord, now: () => clock, set: (t) => { clock = t; } })); } finally { Date.now = realNow; globalThis.fetch = realFetch; }
}

test('EG-E3 relay: THE ROOM TELLS THE HUB - an ended breach\'s room beats on until the hub has its news (EG_INTERNAL_HERALD), then beats no more; the hub folds it, owes First of the Spire, the Lone Beacon and the Descent\'s top, arms its alarm now and posts them in order on it, each once; a second breach\'s Redoubt 10 is the plain post (mutants: the tell never sent; the news dropped untold; the hub unarmed; the Spire\'s beat off the alarm; a post twice)', async () => {
  await withHub(async ({ hub, breach, posts, now }) => {
    const eg = breach('0123456789abcdef', [rdEv(1, 10, { at: now() }), { i: 2, at: now(), k: 'lb', n: 'Mara', lk: 'ilthys', c: 5 }, dcEv(3, 50, 6680, 5, { at: now() })]);
    await eg.fire();
    assert.equal(eg.store.get(EG_KEY).hq.length, 0, 'told, and taken off the breach');
    assert.equal(eg.alarm.at, now() + EG_VOID_MAX_S * 1000, 'the breach beats no more - PIN MOVED (EG-ZA, Elite-Gates.md section 23 "The tombstone"): its room\'s one alarm is its tombstone\'s end, a week on');
    const st = hub.store.get(EG_HERALD_KEY);
    assert.deepEqual(st.q.map((p) => p.kind), ['first', 'lb', 'top']);
    assert.equal(hub.alarm.at, now(), 'the hub\'s alarm armed now');
    assert.equal(posts.length, 0, 'posted off the alarm, never in the tell');
    await hub.fire();
    assert.deepEqual(posts.map((p) => p.url), [HOOK, HOOK, HOOK]);
    assert.deepEqual(posts.map((p) => p.body), [
      egFirstPost({ o: 'Mac', by: ['Mac', 'Ann'], w: 10, h: 50, t: 6680 }),
      egLonePost({ n: 'Mara', lk: 'ilthys', c: 5 }),
      egTopPost({ br: 2, by: ['Mac', 'Ann', 'Cid'], h: 50, td: 6680 }),
    ]);
    assert.equal(hub.store.get(EG_HERALD_KEY).q.length, 0);
    await hub.fire();
    assert.equal(posts.length, 3, 'each once');
    const eg2 = breach('fedcba9876543210', [rdEv(1, 10, { at: now(), o: 'Ann' })]);
    await eg2.fire();
    await hub.fire();
    assert.deepEqual(posts[3].body, egRedoubtPost({ o: 'Ann', w: 10, h: 50, t: 6680 }), 'First of the Spire is once ever');
    // FIELD BUGS 2026-10-20d LONE-HERALD (AUDIT FB1020d L2-3): a company of one's news, told by its room and folded by the hub, is posted alone
    const eg3 = breach('aaaaaaaaaaaaaaaa', [rdEv(1, 20, { at: now(), n: 1, o: 'Mara', by: ['Mara'] })]);
    await eg3.fire();
    await hub.fire();
    assert.deepEqual([cardOf(posts[4].body).title, cardOf(posts[4].body).fields], ['Mara took Redoubt 20 alone', { Hall: 'Hall 100', Time: '1:51:20' }]);
  });
});

test('EG-E3 relay: A POST DISCORD DID NOT TAKE, A HUB THAT DID NOT ANSWER - a refusal or a throw posted again HERALD_RETRY_MS on, in its order; news told twice folded once; a breach whose hub did not answer keeps its news and tells it again EG_HERALD_TELL_MS on; a post past EG_HERALD_KEEP_MS let go unposted (mutants: a refusal marked posted; the retry unarmed; a retry pulled forward by news already folded; the tell retried every beat; a lost tell dropped; a stale post posted)', async () => {
  await withHub(async ({ hub, breach, told, posts, discord, now, set }) => {
    discord.answer = () => ({ ok: false, status: 500 });
    const body = { b: '0123456789abcdef', ev: [rdEv(1, 20, { at: now() }), rdEv(2, 30, { at: now() })] };
    assert.equal((await told(body)).status, 200);
    assert.equal((await told(body)).status, 200);
    assert.equal(hub.store.get(EG_HERALD_KEY).q.length, 2, 'told twice, folded once');
    assert.equal((await told({ b: 'nope', ev: [] })).status, 400);
    await hub.fire();
    assert.equal(posts.length, 1, 'the first refused, the second waits its turn');
    assert.equal(hub.store.get(EG_HERALD_KEY).q.length, 2);
    assert.equal(hub.alarm.at, now() + HERALD_RETRY_MS);
    assert.equal((await told(body)).status, 200);
    assert.equal(hub.alarm.at, now() + HERALD_RETRY_MS, 'news already folded pulls no retry forward');
    discord.answer = () => new Error('network');
    set(now() + HERALD_RETRY_MS); await hub.fire();
    assert.equal(posts.length, 2); assert.equal(hub.alarm.at, now() + HERALD_RETRY_MS, 'a throw is no post');
    discord.answer = () => ({ ok: true, status: 204 });
    set(now() + HERALD_RETRY_MS); await hub.fire();
    assert.deepEqual(posts.slice(2).map((p) => p.body), [egRedoubtPost({ o: 'Mac', w: 20, h: 100, t: 6680 }), egRedoubtPost({ o: 'Mac', w: 30, h: 150, t: 6680 })]);
    assert.equal(hub.store.get(EG_HERALD_KEY).q.length, 0);
    // a hub that does not answer: the breach keeps its news, and tells again EG_HERALD_TELL_MS on - never every beat
    const eg = breach('aaaaaaaaaaaaaaaa', [rdEv(1, 40, { at: now() })]);
    const rooms = eg.env.ROOMS;
    let asked = 0;
    eg.env.ROOMS = { idFromName: (n) => n, get: () => ({ fetch: async () => { asked++; throw new Error('down'); } }) };
    await eg.fire();
    assert.equal(asked, 1);
    assert.equal(eg.store.get(EG_KEY).hq.length, 1, 'kept');
    assert.equal(eg.alarm.at, now() + EG_HERALD_TELL_MS, 'told again EG_HERALD_TELL_MS on');
    set(now() + 1000); await eg.fire();
    assert.equal(asked, 1, 'not every beat');
    eg.env.ROOMS = rooms;
    set(now() + EG_HERALD_TELL_MS); await eg.fire();
    assert.equal(eg.store.get(EG_KEY).hq.length, 0);
    assert.equal(hub.store.get(EG_HERALD_KEY).q[0].w, 40);
    // Discord down an hour: no news, let go
    discord.answer = () => ({ ok: false, status: 503 });
    await hub.fire();
    set(now() + EG_HERALD_KEEP_MS); discord.answer = () => ({ ok: true, status: 204 });
    const before = posts.length;
    await hub.fire();
    assert.equal(posts.length, before, 'let go unposted');
    assert.equal(hub.store.get(EG_HERALD_KEY).q.length, 0);
    // a breach's own news an hour old is let go before it is told
    const old = breach('bbbbbbbbbbbbbbbb', [rdEv(1, 50, { at: now() - EG_HERALD_KEEP_MS })]);
    await old.fire();
    assert.equal(old.store.get(EG_KEY).hq.length, 0);
    assert.equal(hub.store.get(EG_HERALD_KEY).q.length, 0);
  });
});

test('EG-E3 relay: NO WEBHOOK, NO POSTS - the reckoning is kept (the first company ever is still the first) and nothing is owed or armed; a webhook that is not Discord\'s is none; the door and the order by source (mutants: posts owed with no herald; the reckoning skipped without one)', async () => {
  for (const env of [{}, { GATE_DISCORD_WEBHOOK: 'https://example.com/hook' }]) {
    await withHub(async ({ hub, breach, posts }) => {
      const eg = breach('0123456789abcdef', [rdEv(1, 10, { at: T0 })]);
      await eg.fire();
      const st = hub.store.get(EG_HERALD_KEY);
      assert.deepEqual([st.first, st.q.length], [1, 0]);
      assert.equal(hub.alarm.at, null, 'nothing armed');
      await hub.fire();
      assert.equal(posts.length, 0);
    }, { env });
  }
  const relay = rd('server/src/index.js');
  assert.match(relay, /await this\._heraldBeat\(Date\.now\(\)\); await this\._egHeraldBeat\(Date\.now\(\)\); await this\._serpentHeraldBeat\(Date\.now\(\)\);/, 'on the hub\'s one alarm, after the gate\'s');
  assert.match(relay, /if \(path === EG_INTERNAL_HERALD\) return this\._egHeraldInternal\(request\);/);
  assert.ok(!/egHerald[\s\S]{0,200}roles: \[/.test(rd('src/net/eliteGates/egHerald.js')), 'no Spire post names a role');
});
