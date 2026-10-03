// SEAT1b (2026-09-30, Mac: "Finish the seats"): INFLUENCE, THE LAW AND THE CLIENT'S HALF - the Watch's `k1` receipt and
// its rhythm, the relay's tick in a cell room (driven through the real Room over test/fakeRoom.mjs), the caps' arithmetic,
// the Seat tab's words, the seats' book (the standings, a pledge, Tribute's one request id, the Watch's receipts kept and
// claimed), the Renown report's region, and the hosts by source. bible/11-Multiplayer/Seats-Arc.md 4.1-4.2, 7.9;
// `06-Systems/Online-Arc.md` SEAT1b.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import {
  mintWatchReceipt, readWatchReceipt, verifyWatchReceipt, watchReceiptValid, watchDue, WATCH_RECEIPT_TTL_S, WATCH_TICK_MS, WATCH_MOVED_MS,
} from '../src/net/watchReceipt.js';
import { mintReceipt, verifyReceipt, importReceiptKey } from '../src/net/gateReceipt.js';
import { verifyRaidReceipt } from '../src/net/raidReceipt.js';
import {
  accountSeatInfluence, guildSeatInfluence, tributeRoom, homeDaysIn, seatWeekLine, seatStandingLine, seatNoStandingsLine,
  seatMineLines, seatTributeLine, seatSpanWords, seatMay, SEAT_POWERS, ACCOUNT_SEAT_WEEK_CAP, GATE_WEEK_CAP, RENOWN_WEEK_CAP,
  SEAT_WATCH_CLAIM_MAX, WATCH_DAY_CAP,
} from '../src/net/townSeatLaw.js';
import { createTownSeatBook, SEAT_WATCH_KEY, SEAT_WATCH_CLAIM_EVERY_MS, SEAT_STANDINGS_CACHE_MS } from '../src/net/townSeatBook.js';
import { createRenownTracker } from '../src/net/renownTracker.js';
import { cellRoomOfWire, PIXEL_UNITS } from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';
import { byClass } from './chargenDom.mjs';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';

const subtle = webcrypto.subtle;
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T = 1_800_000_000;
const pair = () => subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };

test('SEAT1b THE WATCH\'S RECEIPT: `k1` signed by the relay\'s one key, read by the client, verified by the service rung for rung; a gate\'s `r1` and a raid\'s `w1` never pass for it, nor it for them; another shape\'s fields are refused (mutants: the version; the TTL; the foreign fields; the pixel bounds; the signature)', async () => {
  const kp = await pair();
  const r = await mintWatchReceipt({ s: 'acct-0001', x: 402, y: 151, c: 7 }, kp.privateKey, { subtle, nowS: T });
  assert.match(r, /^k1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{86}$/);
  assert.deepEqual(readWatchReceipt(r), { s: 'acct-0001', x: 402, y: 151, c: 7, i: T, e: T + WATCH_RECEIPT_TTL_S, signed: true });
  assert.deepEqual(await verifyWatchReceipt(r, kp.publicKey, { subtle, nowS: T + 60 }), { ok: true, claims: { s: 'acct-0001', x: 402, y: 151, c: 7, i: T, e: T + WATCH_RECEIPT_TTL_S } });
  assert.equal((await verifyWatchReceipt(r, kp.publicKey, { subtle, nowS: T + WATCH_RECEIPT_TTL_S })).why, 'expired');
  assert.equal((await verifyWatchReceipt(r, kp.publicKey, { subtle, nowS: T - 3600 })).why, 'future');
  const other = await pair();
  assert.equal((await verifyWatchReceipt(r, other.publicKey, { subtle, nowS: T })).why, 'signature');
  const unsigned = await mintWatchReceipt({ s: 'acct-0001', x: 402, y: 151, c: 7 }, null, { subtle, nowS: T });
  assert.equal(readWatchReceipt(unsigned).signed, false);
  assert.equal((await verifyWatchReceipt(unsigned, kp.publicKey, { subtle, nowS: T })).why, 'unsigned');
  // one key, three things, never confused
  const gate = await mintReceipt({ d: 9, b: 'ruhn', s: 'acct-0001', c: 7, x: 'dealt' }, kp.privateKey, { subtle, nowS: T });
  assert.equal((await verifyWatchReceipt(gate, kp.publicKey, { subtle, nowS: T })).why, 'version');
  assert.equal((await verifyReceipt(r, kp.publicKey, { subtle, nowS: T })).ok, false, 'a watch is no gate kill');
  assert.equal((await verifyRaidReceipt(r, kp.publicKey, { subtle, nowS: T })).ok, false, 'nor a raid');
  // the claims' shape
  const ok = { s: 'acct-0001', x: 0, y: 0, c: 0, i: T, e: T + 60 };
  assert.equal(watchReceiptValid(ok), true);
  for (const f of ['n', 'k', 't', 'o', 'd', 'b', 'w']) assert.equal(watchReceiptValid({ ...ok, [f]: 1 }), false, `a foreign field ${f}`);
  assert.equal(watchReceiptValid({ ...ok, x: 1000 }), false);
  assert.equal(watchReceiptValid({ ...ok, y: 500 }), false);
  assert.equal(watchReceiptValid({ ...ok, y: -1 }), false);
  assert.equal(watchReceiptValid({ ...ok, e: T + WATCH_RECEIPT_TTL_S + 1 }), false, 'never longer than its life');
  assert.equal(watchReceiptValid({ ...ok, c: 2 ** 32 }), false);
  await assert.rejects(() => mintWatchReceipt({ s: 'acct-0001', x: 1000, y: 1, c: 1 }, null, { subtle, nowS: T }), TypeError, 'the relay never mints what it could not verify');
});

test('SEAT1b THE WATCH\'S RHYTHM AND THE RELAY\'S TICK: a verified account in a cell room, having moved in the last five minutes, is sent a `watch` frame every two minutes naming its map pixel; a standing one is not; a channel is no place (mutants: the moved window; the tick interval; the cell-room gate; the pixel; the nonce)', async (t) => {
  assert.equal(watchDue({ at: -Infinity, moved: 0 }, 0), true);
  assert.equal(watchDue({ at: 0, moved: 0 }, WATCH_TICK_MS - 1), false, 'two minutes between ticks');
  assert.equal(watchDue({ at: 0, moved: WATCH_TICK_MS }, WATCH_TICK_MS), true);
  assert.equal(watchDue({ at: -Infinity, moved: 0 }, WATCH_MOVED_MS), true, 'five minutes after the last move, still watching');
  assert.equal(watchDue({ at: -Infinity, moved: 0 }, WATCH_MOVED_MS + 1), false, 'a player who stopped moving stops ticking');
  let now = T * 1000;
  t.mock.method(Date, 'now', () => now);
  const at = (px, py, dx = 100) => ({ x: px * PIXEL_UNITS + dx, y: 60, z: (499 - py) * PIXEL_UNITS + 100, yaw: 0, pitch: 0 });
  const p0 = at(402, 151, 100);
  const r = fakeRoom(cellRoomOfWire(p0.x, p0.z), { now: () => now });
  const kp = await pair();
  r.env.GATE_SIGNING_KEY = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const ws = r.connect();
  await r.hello(ws, 'peer-0001', p0);
  const ticks = () => ws.sent.filter((m) => m.t === 'watch');
  await r.pose(ws, at(402, 151, 200));
  assert.equal(ticks().length, 1, 'the first move ticks');
  const c = readWatchReceipt(ticks()[0].r);
  assert.deepEqual([c.s, c.x, c.y, c.signed], ['acct-peer-0001', 402, 151, true], 'its account and the pixel its pose stands in, signed');
  assert.equal((await verifyWatchReceipt(ticks()[0].r, kp.publicKey, { subtle, nowS: Math.floor(now / 1000) })).ok, true, 'by the gate\'s key');
  now += 60_000; await r.pose(ws, at(402, 151, 300));
  assert.equal(ticks().length, 1, 'not inside two minutes');
  now += 61_000; await r.pose(ws, at(402, 151, 400));
  assert.equal(ticks().length, 2);
  assert.notEqual(ticks()[1].r, ticks()[0].r, 'each tick its own receipt');
  // standing still: the heartbeat's unmoved pose ticks while the last move is inside five minutes, then never
  const still = at(402, 151, 400);
  now += 121_000; await r.pose(ws, still);
  assert.equal(ticks().length, 3, 'a standing player two minutes after a move still ticks');
  now += 200_000; await r.pose(ws, still);
  assert.equal(ticks().length, 3, 'five minutes standing: no more');
  // a channel is no place
  const ch = fakeRoom('chat:world', { now: () => now });
  const cws = ch.connect();
  await ch.hello(cws, 'peer-0002', null);
  await ch.pose(cws, at(402, 151, 500));
  assert.equal(cws.sent.filter((m) => m.t === 'watch').length, 0);
});

test('SEAT1b THE CAPS\' ARITHMETIC: each source at its own cap, then 2,000 an account a seat a week; Tribute at most a fifth of the guild\'s week (a quarter of the rest); a home\'s whole days this week; the powers (mutants: each cap; the order of the caps; the room; the days)', () => {
  assert.equal(accountSeatInfluence({ watch: 7 * WATCH_DAY_CAP }), 420);
  assert.equal(accountSeatInfluence({ gates: 5 }), GATE_WEEK_CAP, 'three gate receipts a week count');
  assert.equal(accountSeatInfluence({ gates: 2 }), 600);
  assert.equal(accountSeatInfluence({ renownXp: 60000 }), RENOWN_WEEK_CAP);
  assert.equal(accountSeatInfluence({ renownXp: 39 }), 1, '1 per 20 XP, rounded down');
  assert.equal(accountSeatInfluence({ homeDays: 7 }), 175);
  assert.equal(accountSeatInfluence({ writ: 900 }), 900);
  assert.equal(accountSeatInfluence({ watch: 420, gates: 3, renownXp: 8000, homeDays: 7, writ: 900 }), ACCOUNT_SEAT_WEEK_CAP);
  assert.equal(accountSeatInfluence({ watch: -5 }), 0);
  assert.equal(tributeRoom(400), 100, 'a quarter of the rest is a fifth of the whole');
  assert.equal(tributeRoom(400, 60), 40);
  assert.equal(tributeRoom(3), 0);
  assert.deepEqual(guildSeatInfluence([400, 0], 2000), { total: 500, others: 400, tribute: 100 }, 'Tribute past its room counts nothing more');
  assert.deepEqual(guildSeatInfluence([400], 500), { total: 450, others: 400, tribute: 50 });
  const wk = 1_000_000;
  assert.equal(homeDaysIn(wk - 9 * 86400, wk, wk + 3 * 86400 + 5), 3, 'a home bought before the week counts from its start');
  assert.equal(homeDaysIn(wk + 86400, wk, wk + 3 * 86400), 2);
  assert.equal(homeDaysIn(wk + 86400, wk, wk + 86400 + 86399), 0, 'whole days');
  assert.deepEqual(SEAT_POWERS, { pledge: [0, 1], tribute: [0] });
  assert.equal(seatMay(1, 'pledge'), true); assert.equal(seatMay(2, 'pledge'), false); assert.equal(seatMay(1, 'tribute'), false);
  assert.equal(SEAT_WATCH_CLAIM_MAX * 300 < 4096, true, 'a claim fits the service\'s one request');
});

test('SEAT1b THE SEAT TAB\'S WORDS: the week\'s clock, a standing, the empty board, the reader\'s own guild (pledged here, elsewhere, nowhere; new; another war; its week), Tribute\'s room (mutants: the phase; the counts; the lines\' branches)', () => {
  assert.equal(seatSpanWords(2 * 86400 + 4 * 3600 + 59), '2d 4h');
  assert.equal(seatSpanWords(3 * 3600 + 20 * 60), '3h 20m');
  assert.equal(seatSpanWords(59), '0m');
  assert.equal(seatWeekLine({ phase: 'muster', reckoningAt: 1000 + 3600, turningAt: 0 }, 1000), 'The Muster: pledges close Friday 18:00 UTC, in 1h 0m.');
  assert.equal(seatWeekLine({ phase: 'reckoning', reckoningAt: 0, turningAt: 1000 + 86400 }, 1000), 'The Reckoning: pledges are locked. The Turning comes Sunday 18:00 UTC, in 1d 0h.');
  assert.equal(seatStandingLine({ guild: { name: 'The Silver Hand', tag: 'SH' }, influence: 8393 }, 0), '1. the Silver Hand <SH> - 8,393 influence');
  assert.equal(seatNoStandingsLine(ANTICLERE), 'No guild has pledged to Anticlere this week.');
  const mine = { guild: 'g1', rank: 1, seasoned: true, bound: 'g1', pledges: [{ region: 21, key: 3021 }], influence: 340 };
  assert.deepEqual(seatMineLines(ANTICLERE, mine), ['Your guild is pledged to Anticlere.', 'Your week here: 340 of 2,000.']);
  assert.deepEqual(seatMineLines(ANTICLERE, { ...mine, pledges: [{ region: 21, key: 3022 }] }, (k) => (k === 3022 ? 'Alcaire Keep' : null)), ['Your guild is pledged to Alcaire Keep in this region.']);
  assert.deepEqual(seatMineLines(ANTICLERE, { ...mine, pledges: [] }), ['Your guild has not pledged in this region this week.']);
  assert.deepEqual(seatMineLines(ANTICLERE, { ...mine, seasoned: false }), ['Your guild is pledged to Anticlere.', 'You count for your guild\'s seats after 7 days in it.']);
  assert.deepEqual(seatMineLines(ANTICLERE, { ...mine, bound: 'g2' }), ['Your guild is pledged to Anticlere.', 'Your account fights for another guild this week.']);
  assert.deepEqual(seatMineLines(ANTICLERE, null), ['Join a guild to fight for a seat.']);
  assert.match(seatTributeLine(100), /^Tribute: up to 100 silver more this week/);
  assert.match(seatTributeLine(0), /no room for more this week/);
});

/** A seats' book over a scripted door. */
function bookOver(door, { now = { ms: T * 1000 }, me = 'acct-0001', seatPixel = (x, y) => x === 402 && y === 151, store = new Map() } = {}) {
  const calls = [];
  const wrapped = {};
  for (const [k, f] of Object.entries(door)) wrapped[k] = (...a) => { calls.push([k, ...a]); return f(...a); };
  const book = createTownSeatBook({
    door: /** @type {any} */ (wrapped), storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    nowMs: () => now.ms, me: () => me, character: () => 'char-1', isSeatPixel: seatPixel, relayNowS: () => Math.floor(now.ms / 1000),
    rid: (() => { let n = 0; return () => `rid-tribute-${String(++n).padStart(4, '0')}`; })(),
  });
  return { book, calls, store, now };
}

test('SEAT1b THE BOOK KEEPS THE WATCH: a signed tick for the signed-in account in a seat\'s own pixel is kept on the device; an unsigned one, another account\'s, another pixel\'s, a dead one and a second copy are not; claimed a claim\'s worth or ten minutes at a time, let go on an answer, kept with none (mutants: each keep filter; the batch; the ten minutes; the settle)', async () => {
  const kp = await pair();
  let answer = { ok: true, data: { ok: true, counted: 12 } };
  const { book, calls, store, now } = bookOver({ list: async () => ({ ok: true, data: { seats: [], me: {} } }), watch: async () => answer });
  await book.read();
  const tick = (o = {}) => mintWatchReceipt({ s: 'acct-0001', x: 402, y: 151, c: Math.floor(Math.random() * 1e9), ...o }, kp.privateKey, { subtle, nowS: Math.floor(now.ms / 1000) });
  const one = await tick();
  assert.equal(book.keepWatch(one), true);
  assert.equal(book.keepWatch(one), false, 'a second copy');
  assert.equal(book.keepWatch(await mintWatchReceipt({ s: 'acct-0001', x: 402, y: 151, c: 1 }, null, { subtle, nowS: T })), false, 'unsigned');
  assert.equal(book.keepWatch(await tick({ s: 'acct-0002' })), false, 'another account\'s');
  assert.equal(book.keepWatch(await tick({ x: 403 })), false, 'not a seat\'s pixel');
  assert.equal(book.keepWatch('k1.junk.sig'), false);
  assert.equal(JSON.parse(store.get(SEAT_WATCH_KEY)).length, 1, 'on the device');
  assert.equal(await book.claimWatch(), null, 'one tick, a minute old: not yet');
  for (let i = 0; i < SEAT_WATCH_CLAIM_MAX - 1; i++) book.keepWatch(await tick());
  assert.equal(book.watchHeldCount(), SEAT_WATCH_CLAIM_MAX);
  assert.deepEqual(await book.claimWatch(), { ok: true, counted: 12 }, 'a claim\'s worth: claimed');
  assert.equal(calls.filter((c) => c[0] === 'watch')[0][2].length, SEAT_WATCH_CLAIM_MAX);
  assert.equal(book.watchHeldCount(), 0, 'an answer lets them go');
  // no answer keeps them; ten minutes claims what is held
  book.keepWatch(await tick());
  answer = { ok: false, error: 'offline' };
  now.ms += SEAT_WATCH_CLAIM_EVERY_MS;
  assert.equal(await book.claimWatch(), null);
  assert.equal(book.watchHeldCount(), 1, 'kept through a failed claim');
  answer = { ok: true, data: { ok: true, counted: 1 } };
  assert.deepEqual(await book.claimWatch(), { ok: true, counted: 1 }, 'the oldest ten minutes old: claimed');
  // a dead one is let go when the next comes, and never offered
  const dead = await tick();
  book.keepWatch(dead);
  now.ms += WATCH_RECEIPT_TTL_S * 1000;
  book.keepWatch(await tick());
  assert.equal(JSON.parse(store.get(SEAT_WATCH_KEY)).some((w) => w.r === dead), false);
});

test('SEAT1b THE BOOK\'S STANDINGS, PLEDGE AND TRIBUTE: the standings kept half a minute and read afresh after every act; Tribute keeps ONE request id until an answer comes, so a lost answer asked again is never burnt twice (mutants: the cache; the clear; the one id; the transient keep)', async () => {
  let tributeAnswer = { ok: false, error: 'offline' };
  const { book, calls, now } = bookOver({
    standings: async () => ({ ok: true, data: { standings: [] } }),
    pledge: async () => ({ ok: true, data: { pledges: [] } }),
    tribute: async () => tributeAnswer,
  });
  await book.standings(3021); await book.standings(3021);
  assert.equal(calls.filter((c) => c[0] === 'standings').length, 1, 'kept');
  now.ms += SEAT_STANDINGS_CACHE_MS;
  await book.standings(3021);
  assert.equal(calls.filter((c) => c[0] === 'standings').length, 2);
  assert.deepEqual(await book.pledge(ANTICLERE), { ok: true, text: 'Your guild is pledged to Anticlere this week.' });
  assert.deepEqual(calls.at(-1), ['pledge', 'char-1', 3021]);
  await book.standings(3021);
  assert.equal(calls.filter((c) => c[0] === 'standings').length, 3, 'an act reads the standings afresh');
  assert.deepEqual(await book.unpledge(21), { ok: true, text: 'The pledge is taken down.' });
  assert.deepEqual(calls.at(-1), ['pledge', 'char-1', null, 21]);
  await book.tribute(ANTICLERE, 100);
  await book.tribute(ANTICLERE, 100);
  const ids = calls.filter((c) => c[0] === 'tribute').map((c) => c[4]);
  assert.equal(ids[0], ids[1], 'the same payment, asked again, carries the same id');
  tributeAnswer = { ok: true, data: { ok: true, influence: 10, marks: 100 } };
  assert.deepEqual(await book.tribute(ANTICLERE, 100), { ok: true, text: 'Tribute paid to Anticlere: 100 silver burnt, 10 influence.' });
  await book.tribute(ANTICLERE, 100);
  const after = calls.filter((c) => c[0] === 'tribute').map((c) => c[4]);
  assert.notEqual(after[3], after[2], 'an answered payment lets its id go - the next is a new payment');
  tributeAnswer = { ok: false, error: 'seat-tribute-cap' };
  assert.match((await book.tribute(ANTICLERE, 50)).text, /at most a fifth/);
});

test('SEAT1b THE RENOWN REPORT\'S REGION: XP is kept by the region it was earned in, and each report names one region - never XP earned elsewhere (mutants: the region captured at earning; the split; the leave)', async () => {
  let region = 21;
  const sent = [];
  const tr = createRenownTracker({ report: async (...a) => { sent.push(a); return { ok: true, data: {} }; }, leave: (...a) => sent.push(['leave', ...a]), character: () => 'char-1', rid: (() => { let n = 0; return () => `r${++n}`; })(), region: () => region, now: () => 0 });
  tr.earn(100);
  region = 22; tr.earn(50);
  region = 99; tr.earn(5);
  assert.equal(tr.pending(), 155);
  await tr.flush(0);
  assert.deepEqual(sent[0], ['char-1', 100, null, 'r1', 21], 'the first region\'s XP alone');
  await tr.flush(60_000);
  assert.deepEqual(sent[1], ['char-1', 50, null, 'r2', 22]);
  assert.equal(tr.leave(), true);
  assert.deepEqual(sent[2], ['leave', 'char-1', 5, null, 'r3', null], 'a region past the map\'s is none');
});

test('SEAT1b THE SEAT TAB: beside the board\'s tabs while the seats are open, never at a guild\'s hall; the Charter, the week, every pledged guild under its banner (the reader\'s marked), the reader\'s lines, an Officer\'s pledge and the guildmaster\'s Tribute through the book (mutants: the tab\'s shown gate; the standings; the levers\' ranks; the phase)', async () => {
  const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }), readGuild: async () => ({ data: null, error: 'no-guild' }) };
  const acts = [];
  const data = (rank, phase = 'muster', pledged = true) => ({
    seat: ANTICLERE, week: 16, phase, reckoningAt: T + 3600, turningAt: T + 3 * 86400,
    standings: [
      { guild: { id: 'g2', name: 'Ebon Oath', tag: 'EO', heraldry: { field: 'crimson', border: 'gold', device: 'tower' } }, influence: 900, tribute: 0, accounts: 3 },
      { guild: { id: 'g1', name: 'The Silver Hand', tag: 'SH', heraldry: null }, influence: 340, tribute: 0, accounts: 1 },
    ],
    mine: { guild: 'g1', rank, seasoned: true, bound: 'g1', pledges: pledged ? [{ region: 21, key: 3021 }] : [], influence: 340, tributeRoom: 80 },
  });
  const seatBookOf = (d, open = true) => ({
    open, standings: async () => ({ data: d, error: null }),
    pledge: async (seat) => { acts.push(['pledge', seat.key]); return { ok: true, text: 'pledged' }; },
    unpledge: async (region) => { acts.push(['unpledge', region]); return { ok: true, text: 'down' }; },
    tribute: async (seat, marks) => { acts.push(['tribute', seat.key, marks]); return { ok: true, text: 'paid' }; },
  });
  const mount = (d, extra = {}) => {
    const host = document.createElement('div');
    const v = mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 3021 }, book: noticeBook, nowS: () => T, seat: { seat: ANTICLERE, book: seatBookOf(d, extra.open ?? true) }, ...extra.deps });
    return { host, v };
  };
  // the guildmaster: pledged here, Tribute's room
  const { host, v } = mount(data(0));
  const tabs = byClass(host, 'notice-tab');
  assert.deepEqual(tabs.map((x) => x.textContent), ['Notices', 'Seat']);
  tabs[1].onclick();
  await tick();
  const text = host.textContent;
  assert.match(text, /The Charter of Anticlere: unheld/);
  assert.match(text, /The Muster: pledges close Friday 18:00 UTC, in 1h 0m\./);
  const rows = byClass(host, 'notice-standing');
  assert.deepEqual(rows.map((r) => r.textContent), ['1. Ebon Oath <EO> - 900 influence', '2. the Silver Hand <SH> - 340 influence']);
  assert.equal(rows[1].className.includes('mine'), true, 'the reader\'s own guild marked');
  assert.equal(rows[0].querySelectorAll('.notice-banner').length, 1, 'a guild under its banner');
  assert.match(text, /Your guild is pledged to Anticlere\.Your week here: 340 of 2,000\./);
  assert.match(text, /Tribute: up to 80 silver more this week/);
  byClass(host, 'notice-seat-drop')[0].click();
  await tick();
  assert.deepEqual(acts.at(-1), ['unpledge', 21]);
  byClass(host, 'notice-seat-tribute')[0].click();
  await tick();
  assert.deepEqual(acts.at(-1), ['tribute', 3021, 80], 'the room, in tens');
  v.unmount();
  // an Officer, not pledged here: Pledge, and no Tribute
  const o = mount(data(1, 'muster', false));
  byClass(o.host, 'notice-tab')[1].onclick();
  await tick();
  assert.equal(byClass(o.host, 'notice-seat-tribute').length, 0, 'Tribute is the guildmaster\'s');
  byClass(o.host, 'notice-seat-pledge')[0].click();
  await tick();
  assert.deepEqual(acts.at(-1), ['pledge', 3021]);
  o.v.unmount();
  // a Member: no levers; the Reckoning: no pledge buttons
  const m = mount(data(2));
  byClass(m.host, 'notice-tab')[1].onclick();
  await tick();
  assert.equal(byClass(m.host, 'notice-seat-pledge').length + byClass(m.host, 'notice-seat-drop').length, 0);
  m.v.unmount();
  const r = mount(data(1, 'reckoning'));
  byClass(r.host, 'notice-tab')[1].onclick();
  await tick();
  assert.equal(byClass(r.host, 'notice-seat-drop').length, 0, 'pledges locked in the Reckoning');
  r.v.unmount();
  // the seats shut to this account: no tab; a guild's hall: no tab
  const shut = mount(data(0), { open: false });
  assert.deepEqual(byClass(shut.host, 'notice-tab').map((x) => x.textContent), ['Notices']);
  shut.v.unmount();
  const hall = mount(data(0), { deps: { guildOnly: { name: 'The Silver Hand' } } });
  assert.equal(byClass(hall.host, 'notice-tab').some((x) => x.textContent === 'Seat'), false);
  hall.v.unmount();
});

test('SEAT1b THE HOSTS BY SOURCE: the relay ticks in its pose arm and nowhere else; the client hands a `watch` frame of its own cell to the book; the world host keeps it, claims on the frame, passes the board its seat, the gate claim its region and the Renown report the region it stands in; the service routes, statuses and deploy filter (mutants: each seam)', () => {
  const relay = rd('server/src/index.js');
  assert.match(relay, /if \(isCellRoom\(a\.key\) && cellRoomOfWire\(m\.p\.x, m\.p\.z\) === a\.key && typeof met\.sub === 'string' && met\.sub\) await this\._watchTick\(ws, met\.sub, m\.p, !unmoved, now\);/);   // PIN MOVED (AUDIT-SEATS): R7 - the pose's own cell alone, never a halo's
  assert.equal((relay.match(/_watchTick\(/g) ?? []).length, 2, 'one call, one definition');
  assert.match(relay, /if \(!\(x >= 0 && x < 1000 && y >= 0 && y < 500\)\) return;/);
  assert.match(relay, /mintWatchReceipt\(\{ s: sub, x, y, c: rand32\(\) \}, await this\._receiptKeyOf\(\)/);
  assert.match(relay, /this\._send\(ws, JSON\.stringify\(\{ t: 'watch', r \}\)\);/);
  const online = rd('src/net/online.js');
  assert.match(online, /const w = primary && isCellRoom\(room\) \? readWatchReceipt\(m\.r\) : null;\n\s*if \(w\) this\._deliver\('watch', \(\) => this\.onWatch\?\.\(m\.r, w\)\);/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /online\.onWatch = \(r\) => \{ seatBook\?\.keepWatch\(r\); motherlodeBook\?\.watch\(r\); \};/);   // PIN MOVED (PROF2b): and the Motherlodes' book keeps it too
  assert.match(w, /if \(seatBook\?\.claimWatchDue\(\)\) seatBook\.claimWatch\(\);/);   // PIN MOVED (AUDIT-SEATS C12): asked in sync first - a frame with nothing due makes no Promise
  assert.match(w, /isSeatPixel: \(x, y\) => seatPixels\.has\(`\$\{x\},\$\{y\}`\),/);
  assert.match(w, /const seatPixels = new Set\(townSeats\.list\.map\(\(s\) => `\$\{s\.pixel\[0\]\},\$\{s\.pixel\[1\]\}`\)\);/);
  assert.match(w, /seat: seatAt \? \{ seat: seatAt, book: seatBook, nameOf: \(k\) => seatAtMapId\(townSeats, k\)\?\.name \?\? null, port: coastalAt\(town\.px, town\.py, seaPixel, csaIsPortTown\(town\.px, town\.py\)\), countName: materialCountLabel \} : null,/);   // SEAT2b: and whether DFU names the town a port, the works' material words
  assert.match(w, /const seatAt = seatHere\(town\.mapId\);/);
  // PIN MOVED (SILVER-WAYS): the claiming character rides every claim (its guild's deed asks it), the region where the scan found it
  assert.match(w, /const character = characterIdOf\(playerEntity\);\n[^\n]*\n\s*return site \? \{ region: site\.region, character \} : character \? \{ character \} : null;/);
  assert.match(w, /region: \(\) => \{ const px = playerTravelPixel\(\); const r = maps\.getRegionIndexAt\(px\.x, px\.y\); return Number\.isSafeInteger\(r\) \? r : null; \},/);
  const nw = rd('src/ui/noticeWindow.js');
  assert.match(nw, /\.\.\.\(seatShown\(\) \? \[\['seat', 'Seat'\]\] : \[\]\)\];/);
  assert.match(nw, /const seatHost = guildOnly \? null : \(deps\.seat \?\? null\);/);
  assert.match(nw, /else if \(tab === 'seat' && seatTab && seatShown\(\)\) win\.append\(seatTab\.body\(\)\);/);
  const idx = rd('server-account/src/index.js');
  assert.match(idx, /if \(r\.recorded && !r\.rite && body\.region != null\) answer\.seat = await creditGate\(ctx, who\.player, env, \{ character: body\.character \?\? null, day: r\.day, region: body\.region \}\);/);
  assert.match(idx, /if \(body\.region != null && r\.credited > 0 && !r\.repeat\) await creditRenown\(/);
  for (const r of ['pledge', 'standings', 'watch', 'tribute']) assert.ok(rd('server-account/src/service.js').includes(`'/v1/seats/${r}'`), `${r} routed`);
  assert.match(rd('.github/workflows/account-deploy.yml'), /- "src\/net\/watchReceipt\.js"/);
});
