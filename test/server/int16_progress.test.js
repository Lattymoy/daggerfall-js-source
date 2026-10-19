// INT16-INT17 (2026-10-17, the INTEGRITY arc's lane 4 - bible/06-Systems/Integrity-Arc.md section 7; the owner: "Take care
// of the integrity arc", then, asked, "Measure first"): PROGRESSION CLAIMS - THE SEAT THEY ARE ASKED OF, AND THE PLAY THAT
// PAYS FOR THEM (server-account/src/progress.js).
//   - INT16: every claim (Renown, a raid's cleanse, a camp, the Watch, a silver find, a profession's XP) is the account's
//     SEATED realm character's - an offline id, another character of the account, a seat another device took and a held
//     character are refused before the route reads a word;
//   - INT17: each stream a bucket the account's play fills (budget.js stepBudget, one law) - measured first: a claim past
//     it recorded and nothing refused; enforced by staff: an empty stream refused until play refills it, a Renown report
//     credited only what the bucket holds; the review's measure and the line staff write;
//   - the clients: a refused seat ends a book's asking for the page (Renown), drops the day's finds and the Watch's ticks,
//     and an enforced line keeps a harvest to ask again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import {
  PROGRESS_LINE, PROGRESS_STREAMS, PROGRESS_ROUTES, progressConfigOf, progressSpentOf, spendProgress, progressRoom, progressConfig,
} from '../../server-account/src/progress.js';
import { MEASURE_PLAYED_MIN } from '../../server-account/src/review.js';
import { RAID_CLAIMS_DAY_MAX } from '../../server-account/src/raids.js';
import { GAME_DAY_REAL_HOURS } from '../../src/systems/raidingParties.js';
import { RENOWN_XP_HOUR_MAX } from '../../src/net/renown.js';
import { WATCH_DAY_CAP, BOUNTY_CAMPS_DAY } from '../../src/net/townSeatLaw.js';
import { WATCH_TICK_MS } from '../../src/net/watchReceipt.js';
import { MARKS_FAUCETS } from '../../src/net/marksLaw.js';
import { TIDE_EFFECTS } from '../../src/net/tideLaw.js';
import { writXp } from '../../src/net/professionLaw.js';
import { REFUSALS } from '../../src/net/accountClient.js';
import { FIND_DROPS } from '../../src/net/marksBook.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('INT17: the first line - each stream a clock cap of today read per hour of play (a raid\'s game day two real hours, a Watch tick each two minutes), the professions a guess; measuring, never enforced', () => {
  assert.equal(PROGRESS_LINE.enforce, false, 'MEASURE first (the owner, asked)');
  assert.deepEqual(PROGRESS_STREAMS, ['renown', 'raid', 'bounty', 'camp', 'watch', 'find', 'gather', 'prof']);
  assert.equal(GAME_DAY_REAL_HOURS, 2, 'the raid line reads a game day as two real hours');
  assert.deepEqual(PROGRESS_LINE.streams, {
    renown: { rate: RENOWN_XP_HOUR_MAX, cap: RENOWN_XP_HOUR_MAX },
    raid: { rate: RAID_CLAIMS_DAY_MAX / GAME_DAY_REAL_HOURS, cap: RAID_CLAIMS_DAY_MAX },
    bounty: { rate: BOUNTY_CAMPS_DAY, cap: BOUNTY_CAMPS_DAY },
    camp: { rate: TIDE_EFFECTS.orcsCampsDay, cap: TIDE_EFFECTS.orcsCampsDay },
    watch: { rate: 3_600_000 / WATCH_TICK_MS, cap: WATCH_DAY_CAP },
    find: { rate: MARKS_FAUCETS.find.perDay, cap: MARKS_FAUCETS.find.perDay },
    gather: { rate: MARKS_FAUCETS.gather.perDay, cap: MARKS_FAUCETS.gather.perDay },
    prof: { rate: 10_000, cap: 20_000 },
  });
  for (const [path, [stream]] of Object.entries(PROGRESS_ROUTES)) assert.ok(PROGRESS_STREAMS.includes(stream), path);
  assert.equal(PROGRESS_ROUTES['/v1/marks/find'][1], false, 'a find names no character: the account\'s seat is asked');
  const line = { enforce: true, streams: Object.fromEntries(PROGRESS_STREAMS.map((k) => [k, { rate: 1, cap: 2 }])) };
  assert.deepEqual(progressConfigOf(line), line);
  for (const bad of [null, [], { enforce: 'yes', streams: line.streams }, { enforce: true, streams: { renown: { rate: 1, cap: 2 } } },
    { enforce: true, streams: { ...line.streams, prof: { rate: -1, cap: 2 } } }, { enforce: true, streams: { ...line.streams, extra: { rate: 1, cap: 1 } } },
    { enforce: true, streams: { ...line.streams, raid: { rate: 1.5, cap: 2 } } }]) {
    assert.equal(progressConfigOf(bad), null, JSON.stringify(bad));
  }
});

test('INT17: what an answer spent - Renown credited (never asked), a cleanse and its Renown, a camp, the Watch\'s ticks, a find, a harvest\'s XP and silver, a writ\'s XP and Renown; a refusal or a repeat spends nothing', () => {
  assert.deepEqual(progressSpentOf('/v1/renown/xp', { credited: 900, xp: 5000 }), [['renown', 900]]);
  assert.deepEqual(progressSpentOf('/v1/renown/xp', { credited: 900, repeat: true }), []);
  assert.deepEqual(progressSpentOf('/v1/renown/xp', { error: 'renown-xp' }), []);
  assert.deepEqual(progressSpentOf('/v1/raid/claim', { recorded: true, renown: { credited: 400 } }), [['raid', 1], ['renown', 400]]);
  assert.deepEqual(progressSpentOf('/v1/raid/claim', { recorded: false, why: 'day-full' }), []);
  assert.deepEqual(progressSpentOf('/v1/seats/bounty', { ok: true, paid: 20 }), [['bounty', 1]]);
  assert.deepEqual(progressSpentOf('/v1/seats/bounty', { ok: true, paid: 0, why: 'claimed' }), []);
  assert.deepEqual(progressSpentOf('/v1/seats/orc-camp', { ok: true, counted: true }), [['camp', 1]]);
  assert.deepEqual(progressSpentOf('/v1/seats/orc-camp', { ok: true, counted: false }), []);
  assert.deepEqual(progressSpentOf('/v1/seats/watch', { ok: true, counted: 7 }), [['watch', 7]]);
  assert.deepEqual(progressSpentOf('/v1/marks/find', { ok: true, struck: 3 }), [['find', 1]]);
  assert.deepEqual(progressSpentOf('/v1/marks/find', { ok: true, struck: 0, why: 'cap' }), []);
  assert.deepEqual(progressSpentOf('/v1/prof/harvest', { ok: true, xp: 45, marks: { struck: 4 } }), [['prof', 45], ['gather', 1]]);
  assert.deepEqual(progressSpentOf('/v1/prof/craft', { ok: true, xp: 120, marks: { struck: 4 } }), [['prof', 120]], 'a craft strikes no harvest silver');
  assert.deepEqual(progressSpentOf('/v1/writs/deliver', { ok: true, pay: 30, renown: { credited: 75 } }), [['prof', writXp(30)], ['renown', 75]]);
  assert.deepEqual(progressSpentOf('/v1/prof/state', { xp: 9 }), [], 'a read spends nothing');
});

/** A service with one registered account seated as a realm character, the play clock in hand. */
async function stand(extra = {}) {
  let now = T0;
  const realNow = Date.now;
  Date.now = () => now * 1000;
  const s = await standService({ DEVELOPER_HANDLES: 'mac', ...extra });
  const raw = s.env.DB._raw;
  const eve = await s.seated('eve');
  const play = (seconds) => { raw.prepare('UPDATE players SET played_s = played_s + ? WHERE id = ?').run(seconds, eve.id); now += seconds; };
  let n = 0;
  const report = (xp, who = eve, character = who.character) => s.call('/v1/renown/xp', { character, xp, rid: (++n).toString(16).padStart(16, '0') }, who.secret);
  const bucket = (stream, who = eve) => raw.prepare('SELECT allowance, played_at FROM progress_play WHERE player = ? AND stream = ?').get(who.id, stream);
  const hours = (stream, who = eve) => raw.prepare('SELECT amount, played_s, over, claims FROM progress_hours WHERE player = ? AND stream = ?').all(who.id, stream).map((r) => ({ ...r }));
  return { s, raw, eve, play, report, bucket, hours, now: () => now, done: () => { Date.now = realNow; } };
}

test('INT16 service: a Renown report is its SEAT\'s - an offline id refused, another of the account\'s characters refused, a seat another device took refused, a held character refused; the seated one credited', async () => {
  const t = await stand();
  try {
    assert.equal((await t.report(500)).status, 200, 'the seated realm character earns');
    const off = await t.report(500, t.eve, 'char-eve');
    assert.deepEqual([off.status, off.body.error], [403, 'progress-seat'], 'an offline id: a fresh set of nodes a day each, never a seat');
    const other = await seatRealm(t.s.env, t.eve.secret, 'Eve Again');   // taken up: the new one holds the lease now
    const old = await t.report(500);
    assert.deepEqual([old.status, old.body.error], [403, 'progress-seat'], 'the seat moved to another character - the old one earns nothing');
    assert.equal((await t.report(500, t.eve, other.id)).status, 200, 'the one holding it does');
    t.raw.prepare("UPDATE realm_characters SET held = 'law' WHERE id = ?").run(other.id);
    const held = await t.report(500, t.eve, other.id);
    assert.deepEqual([held.status, held.body.error, held.body.held], [403, 'trade-held', 'law'], 'the judge holds it: no claim lands');
    t.raw.prepare('UPDATE realm_characters SET held = NULL WHERE id = ?').run(other.id);
    t.raw.prepare('UPDATE realm_characters SET lease = NULL WHERE id = ?').run(other.id);
    assert.equal((await t.report(500, t.eve, other.id)).body.error, 'progress-seat', 'no lease, no seat (a leave gave it up)');
    t.raw.prepare('UPDATE realm_characters SET lease = ?, dead_at = ? WHERE id = ?').run('f'.repeat(32), T0, other.id);
    assert.equal((await t.report(500, t.eve, other.id)).status, 410, 'the dead act in nothing (the tombstone door, before the seat)');
    // an account with no realm character at all claims nothing, guest or registered
    const g = await t.s.guest();
    const r = await t.s.call('/v1/renown/xp', { character: 'char-gggg', xp: 100, rid: 'aaaaaaaaaaaaaaaa' }, g.secret);
    assert.deepEqual([r.status, r.body.error], [403, 'progress-seat']);
  } finally { t.done(); }
});

test('INT16 service: every progression route asks the seat before its own words - a find (no character named: the account\'s seat), a camp, the Watch, a raid, a harvest, a craft, a writ', async () => {
  const t = await stand({ MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', SEATS_OPEN: 'on' });
  try {
    const bare = await t.s.registered('bare');   // registered, no realm character
    for (const path of Object.keys(PROGRESS_ROUTES)) {
      const r = await t.s.call(path, { character: 'char-bare', rid: 'p000000000000001', xp: 10 }, bare.secret);
      assert.deepEqual([path, r.status, r.body?.error], [path, 403, 'progress-seat'], 'refused before the route reads a word');
      const seatedR = await t.s.call(path, { character: t.eve.character, rid: 'p000000000000001', xp: 10 }, t.eve.secret);
      assert.notEqual(seatedR.body?.error, 'progress-seat', `${path}: the seat passes, to the route's own law`);
      const named = PROGRESS_ROUTES[path][1];
      const other = await t.s.call(path, { character: 'char-eve', rid: 'p000000000000002', xp: 10 }, t.eve.secret);
      if (named) assert.equal(other.body?.error, 'progress-seat', `${path}: a character that is not the seat`);
      else assert.notEqual(other.body?.error, 'progress-seat', `${path}: names no character - the account's seat alone is asked`);
    }
    assert.equal((await t.s.call('/v1/prof/state', { character: 'char-bare' }, bare.secret)).body?.error === 'progress-seat', false, 'a read is no claim');
    // a find names no character, so the tombstone door never asks: a seat whose character died is no seat
    t.raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(T0, t.eve.character);
    const dead = await t.s.call('/v1/marks/find', { kind: 'corpse', rid: 'm000000000000009' }, t.eve.secret);
    assert.deepEqual([dead.status, dead.body?.error], [403, 'progress-seat'], 'the dead hold no seat');
  } finally { t.done(); }
});

test('INT17 service: MEASURE - a claim spends its bucket and keeps the hour (the amount, the play it came in); past the bucket the over recorded, nothing refused and no debt kept; play refills it to its cap', async () => {
  const t = await stand();
  try {
    const cap = PROGRESS_LINE.streams.renown.cap;
    t.play(7_200);   // two hours played before the first claim: none of it this stream's measure
    assert.equal((await t.report(4_000)).body.credited, 4_000);
    assert.deepEqual({ ...t.bucket('renown') }, { allowance: cap - 4_000, played_at: 7_200 }, 'a first claim starts the bucket full, its play counted from here');
    t.play(1_800);
    assert.equal((await t.report(5_000)).body.credited, 5_000);
    assert.equal(t.bucket('renown').allowance, Math.min(cap, cap - 4_000 + RENOWN_XP_HOUR_MAX / 2) - 5_000, 'a half hour of play filled half an hour\'s rate, to the cap');
    // the clock's hour is spent at 15,000: the play's line is past it here only on what a day of no play would bank
    t.play(10);
    const before = t.bucket('renown').allowance;
    const r = await t.report(5_000);
    assert.equal(r.body.credited, 5_000, 'measuring refuses nothing');
    const h = t.hours('renown');
    assert.equal(h.reduce((n, x) => n + x.amount, 0), 14_000);
    assert.equal(h.reduce((n, x) => n + x.played_s, 0), 1_810, 'the play each claim came in - never the hours before the first');
    assert.equal(h.reduce((n, x) => n + x.over, 0), Math.max(0, 5_000 - before - Math.floor(RENOWN_XP_HOUR_MAX * 10 / 3600)), 'and what went past the bucket');
    assert.equal(t.bucket('renown').allowance >= 0, true, 'no debt kept while measuring');
    t.play(3_600 * 3);
    await t.report(1);
    assert.equal(t.bucket('renown').allowance, cap - 1, 'refilled by play - never past its cap');
  } finally { t.done(); }
});

test('INT17 service: ENFORCED (staff) - a Renown report credited only what the bucket holds; an empty bucket refused (\'progress-play\', 429) until play refills it; the review reads the measure and a developer alone writes the line', async () => {
  const t = await stand();
  try {
    const mac = await t.s.registered('mac');
    assert.equal((await t.s.call('/v1/mod/realm-progress', { days: 7 }, mac.secret)).body.isDefault, true, 'the first line read, and kept for the minute');
    const line = { enforce: true, streams: { ...PROGRESS_LINE.streams, renown: { rate: 3_600, cap: 1_000 } } };
    assert.equal((await t.s.call('/v1/mod/realm-progress', { set: line }, mac.secret)).status, 200);
    assert.equal((await t.s.call('/v1/mod/realm-progress', { set: { enforce: true } }, mac.secret)).status, 400);
    const rando = await t.s.registered('rando');
    assert.equal((await t.s.call('/v1/mod/realm-progress', { set: line }, rando.secret)).status, 403, 'a developer\'s alone');
    const a = await t.report(5_000);
    assert.equal(a.body.credited, 1_000, 'the bucket\'s thousand, never the clock hour\'s five - the line staff wrote is read at once where they wrote it');
    const b = await t.report(100);
    assert.deepEqual([b.status, b.body.error], [429, 'progress-play'], 'empty: refused until play refills it');
    t.play(60);
    assert.equal((await t.report(500)).body.credited, 60, 'a minute of play at 3,600 an hour: sixty');
    t.play(MEASURE_PLAYED_MIN);
    await t.report(1);
    const rep = (await t.s.call('/v1/mod/realm-progress', { days: 7 }, mac.secret)).body;
    assert.equal(rep.enforce, true);
    assert.equal(rep.isDefault, false);
    const renown = rep.streams.find((x) => x.stream === 'renown');
    assert.deepEqual([renown.rate, renown.cap], [3_600, 1_000]);
    assert.equal(renown.hours >= 1, true, 'an hour played enough to say a rate');
    assert.equal(renown.quantiles.length, 4);
    assert.equal(rep.streams.length, PROGRESS_STREAMS.length);
  } finally { t.done(); }
});

test('INT17 service: MEASURING under staff\'s own line - a claim past the bucket credited whole, the over recorded, the bucket at none (no debt for the day the line is enforced)', async () => {
  const t = await stand();
  try {
    const mac = await t.s.registered('mac');
    const line = { enforce: false, streams: { ...PROGRESS_LINE.streams, renown: { rate: 3_600, cap: 1_000 } } };
    assert.equal((await t.s.call('/v1/mod/realm-progress', { set: line }, mac.secret)).status, 200);
    assert.equal((await t.report(4_000)).body.credited, 4_000, 'measuring refuses nothing');
    assert.equal(t.bucket('renown').allowance, 0, 'no debt kept');
    assert.deepEqual(t.hours('renown').map((h) => h.over), [3_000], 'what the line would have refused');
    t.play(600);
    assert.equal(await progressRoom(t.s.env.DB, t.eve.id, 'renown', await progressConfig(t.s.env.DB)), 600, 'ten minutes refill six hundred from none, never from a debt');
  } finally { t.done(); }
});

test('INT17: the bucket in units - a count stream refused at less than one; the config kept a minute and read again after a staff write', async () => {
  const t = await stand();
  try {
    const db = t.s.env.DB;
    const line = { enforce: true, streams: { ...PROGRESS_LINE.streams, find: { rate: 2, cap: 2 } } };
    assert.equal(await progressRoom(db, t.eve.id, 'find', line), 2, 'a bucket never moved is full');
    await spendProgress(db, t.eve.id, 'find', 1, t.now(), line);
    await spendProgress(db, t.eve.id, 'find', 1, t.now(), line);
    assert.equal(await progressRoom(db, t.eve.id, 'find', line), 0);
    t.play(1_800);
    assert.equal(await progressRoom(db, t.eve.id, 'find', line), 1, 'half an hour at two an hour');
    assert.equal(await spendProgress(db, t.eve.id, 'find', 0, t.now(), line), null, 'nothing spent for nothing claimed');
    assert.equal(await progressConfig(db), PROGRESS_LINE, 'no staff line: the first one');
  } finally { t.done(); }
});

test('INT16-INT17 clients: a refused seat or hold ends the Renown tracker\'s asking for the page, drops the day\'s finds and the Watch\'s ticks; an enforced line keeps a harvest to ask again; the words are said', () => {
  assert.match(src('src/net/renownTracker.js'), /const PERMANENT = new Set\(\['renown-character', 'renown-xp', 'renown-full', 'progress-seat', 'trade-held'\]\);/);
  assert.deepEqual(FIND_DROPS, ['marks-young', 'progress-seat', 'trade-held']);
  assert.match(src('src/net/marksBook.js'), /\} else if \(error === 'marks-rate' \|\| error === 'progress-play'\) \{/);
  assert.match(src('src/net/townSeatBook.js'), /const WATCH_SETTLED = Object\.freeze\(\['bad-watch', 'seats-need-account', 'seats-closed', 'progress-seat', 'trade-held'\]\);/);
  assert.match(src('src/net/profBook.js'), /if \(keptAnswer\(r\) \|\| r\?\.error === 'prof-rate' \|\| r\?\.error === 'progress-play'\) \{/);
  for (const k of ['progress-seat', 'progress-play', 'trade-held']) assert.equal(typeof REFUSALS[k], 'string', k);
  // PIN MOVED (PRIMARY-FOLD, Scale-Arc.md THE PLAN PAST 1,000): the seat is the door's one statement's read (door.js doorReads), judged by progressRefusal's own law
  // PIN MOVED (AUDIT PLAN-1000 F1): the seat the door read - or, a window turned between the rate's peek and its count, read then
  assert.match(src('server-account/src/index.js'), /const read = door\.seat === undefined \? await doorReads\(db, who\.player\.id, \{ tomb: null, stream \}\) : door;\n\s+const seat = seatRefusalOf\(read\.seat, \{ named, character: body\.character \}\);[^\n]*\n\s+if \(seat\) return json\(seat, 403, origin\);/);
});
