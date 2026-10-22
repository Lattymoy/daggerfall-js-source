// DAY-TURN (2026-10-22, the owner: "The servers are on fire right now. We need to do something"; bible/01-Overview/bugs/
// Field-Bugs-2026-10-22.md DAY-TURN). Every page online asked the account service again at 00:00:00 UTC - the
// professions' state and pixels (net/profBook.js), the hall, the town and the seat witnessed once a day (npcHallBook.js,
// townEconBook.js, townSeatBook.js) - and the one database's queue went from some 3,000 s of waiting a minute to 230,000
// for two hours and more, every night: 503s, the sign-in's tokens refused, the relay's hellos with them. Now each page
// turns its day at its own moment in the ten minutes past midnight (net/dayTurn.js): a book keeps the day it holds until
// its page's turn, an answer read today is today's at once, and the host hands every book the page's one moment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { DAY_TURN_SPREAD_MS, dayTurnMs, turnedDayOf, _resetDayTurnForTests } from '../../src/net/dayTurn.js';
import { createProfBook } from '../../src/net/profBook.js';
import { createHallBook, HALL_REPORTED_KEY } from '../../src/net/npcHallBook.js';
import { createTownSeatBook } from '../../src/net/townSeatBook.js';
import { createTownEconBook } from '../../src/net/townEconBook.js';
import { mintWatchReceipt } from '../../src/net/watchReceipt.js';
import { xpForRank } from '../../src/net/professionLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';

const DAY_MS = 86_400_000;
const D = 20_834;   // a UTC day: its midnight 1,800,057,600 s
const MIDNIGHT = (D + 1) * DAY_MS;   // the turn into D + 1
const MIN = 60_000;
const TURN = 5 * MIN;   // a page whose moment is five minutes past midnight
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const memStorage = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const flush = () => new Promise((r) => setTimeout(r, 0));

test('DAY-TURN the law: a page\'s moment is chosen once, inside the ten minutes past midnight, whatever its dice say; the day a book holds is the UTC day turned at that moment, and with no moment the UTC day itself (mutants: the moment chosen again; the span unbounded; the turn read backwards)', () => {
  assert.equal(DAY_TURN_SPREAD_MS, 10 * MIN);
  _resetDayTurnForTests();
  assert.equal(dayTurnMs(() => 0.5), 5 * MIN);
  assert.equal(dayTurnMs(() => 0.1), 5 * MIN, 'chosen once a page: every book of the page turns together');
  for (const [r, ms] of [[0, 0], [0.999_999_9, DAY_TURN_SPREAD_MS - 1], [1, 0], [-3, 0], [7, 0], [NaN, 0], [() => 'x', 0]]) {
    _resetDayTurnForTests();
    const got = dayTurnMs(() => /** @type {any} */ (r));
    assert.ok(got >= 0 && got < DAY_TURN_SPREAD_MS, `${r}: ${got} inside the span`);
    assert.equal(got, ms, String(r));
  }
  _resetDayTurnForTests();
  assert.equal(turnedDayOf(MIDNIGHT - 1), D);
  assert.equal(turnedDayOf(MIDNIGHT), D + 1, 'no moment: the UTC day');
  assert.equal(turnedDayOf(MIDNIGHT + TURN - 1, TURN), D, 'before the page\'s moment: still the day before');
  assert.equal(turnedDayOf(MIDNIGHT + TURN, TURN), D + 1, 'at it: turned');
  assert.equal(turnedDayOf(MIDNIGHT + DAY_MS - 1, TURN), D + 1, 'and held the whole day');
});

/** A professions book over a stand-in door that counts its asks: the service's own day by the UTC clock. */
function profRig({ turnMs = TURN, at = MIDNIGHT - MIN } = {}) {
  const clock = { ms: at };
  const asks = { state: 0, pixels: 0 };
  const door = {
    account: () => 'acct-1',
    state: async () => { asks.state++; return { ok: true, data: { day: utcDay(clock.ms / 1000), character: 'c1', tracks: [{ profession: 'mining', xp: xpForRank(10), rank: 10, specs: { 50: null, 100: null } }], today: {}, taken: [], stores: [], caps: { stores: 5000, withdraw: 200, highHides: 3 } } }; },
    pixels: async (_c, list = [], ids = []) => { asks.pixels++; return { ok: true, data: { pixels: list.map(([x, y]) => ({ x, y, state: 'confirmed', climate: 231, region: 21 })), dungeons: ids.map((id) => ({ id, state: 'none' })) } }; },
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c1', now: () => clock.ms, sleep: () => Promise.resolve(), turnMs });
  return { book, clock, asks };
}

test('DAY-TURN the professions\' state: read before midnight, it is not stale past midnight until the page\'s moment, and stale at it; read fresh inside the turn (a page come online at 00:02), it is today\'s and stays read - no ask again at the moment; with no moment it turns at midnight as before (mutants: the held day unturned; the held day compared by `!==`)', async () => {
  const r = profRig();
  assert.equal((await r.book.refresh()).ok, true);
  assert.equal(r.book.state.day, D);
  r.clock.ms = MIDNIGHT + MIN;
  assert.equal(r.book.stale(), false, 'yesterday\'s state holds until this page\'s moment');
  r.clock.ms = MIDNIGHT + TURN - 1;
  assert.equal(r.book.stale(), false);
  r.clock.ms = MIDNIGHT + TURN;
  assert.equal(r.book.stale(), true, 'turned: read again');
  await r.book.refresh();
  assert.equal(r.book.state.day, D + 1);
  assert.equal(r.book.stale(), false);

  const late = profRig({ at: MIDNIGHT + 2 * MIN });
  await late.book.refresh();
  assert.equal(late.book.state.day, D + 1, 'the service answers its UTC day');
  for (const ms of [MIDNIGHT + 3 * MIN, MIDNIGHT + TURN, MIDNIGHT + TURN + MIN, MIDNIGHT + DAY_MS - 1]) {
    late.clock.ms = ms;
    assert.equal(late.book.stale(), false, `today's answer read inside the turn is today's at ${ms - MIDNIGHT} ms`);
  }
  assert.equal(late.asks.state, 1);

  const old = profRig({ turnMs: 0 });
  await old.book.refresh();
  old.clock.ms = MIDNIGHT + MIN;
  assert.equal(old.book.stale(), true, 'no moment: midnight');
});

test('DAY-TURN the ground: a pixel and a dungeon read yesterday are held until the page\'s moment and not asked again before it; at it they are asked again (and stand again); one first read inside the turn is today\'s and is not asked twice (mutants: the pixel\'s day unturned; the dungeon\'s day unturned; the ask\'s filter unturned; the turn read by `===`)', async () => {
  const r = profRig();
  await r.book.refresh();
  assert.deepEqual((await r.book.askPixels([[400, 200]])).map((p) => [p.x, p.y]), [[400, 200]]);
  assert.equal(await r.book.askDungeon(4000), true);
  assert.equal(r.asks.pixels, 2);

  r.clock.ms = MIDNIGHT + MIN;
  assert.equal(r.book.pixel(400, 200)?.state, 'confirmed', 'yesterday\'s witnessed ground until this page\'s moment');
  assert.equal(r.book.pixelWanted(400, 200), false);
  assert.deepEqual(await r.book.askPixels([[400, 200]]), [], 'not asked: no burst at midnight');
  assert.equal(r.book.dungeon(4000)?.state, 'none');
  assert.equal(r.book.dungeonWanted(4000), false);
  assert.equal(await r.book.askDungeon(4000), false);
  assert.equal(r.asks.pixels, 2);

  // a pixel first walked onto inside the turn: read now, stamped today, and held through the page's moment
  assert.deepEqual((await r.book.askPixels([[401, 200]])).map((p) => p.x), [401]);
  assert.equal(r.asks.pixels, 3);
  assert.equal(r.book.pixel(401, 200)?.state, 'confirmed', 'today\'s answer stands before the page\'s moment too');
  assert.equal(r.book.pixelWanted(401, 200), false);

  r.clock.ms = MIDNIGHT + TURN;
  assert.equal(r.book.pixel(400, 200), null, 'turned: yesterday\'s word is no word');
  assert.equal(r.book.pixelWanted(400, 200), true);
  assert.equal(r.book.pixel(401, 200)?.state, 'confirmed', 'today\'s answer stands');
  assert.equal(r.book.pixelWanted(401, 200), false);
  assert.deepEqual((await r.book.askPixels([[400, 200], [401, 200]])).map((p) => [p.x, p.y]), [[400, 200]], 'only yesterday\'s is asked, and it stands again (GROUND-MIDNIGHT)');
  assert.equal(r.book.dungeonWanted(4000), true);
  assert.equal(await r.book.askDungeon(4000), true, 'the dungeon too');
  assert.equal(r.asks.pixels, 5);
  r.clock.ms = MIDNIGHT + DAY_MS - 1;
  assert.deepEqual(await r.book.askPixels([[400, 200], [401, 200]]), []);
  assert.equal(await r.book.askDungeon(4000), false);
  assert.equal(r.asks.pixels, 5, 'held the whole day');
});

test('DAY-TURN the burst: two hundred pages that read their state before midnight ask again spread over the ten minutes past it, at most a tenth of them in any minute and none past the span; with no moment every one asks in the first minute (mutants: the host\'s moment unread)', async () => {
  const PAGES = 200;
  const perMinute = async (turnOf) => {
    const rigs = Array.from({ length: PAGES }, (_, i) => profRig({ turnMs: turnOf(i) }));
    for (const r of rigs) await r.book.refresh();
    const minutes = new Map();
    for (let ms = MIDNIGHT - MIN; ms < MIDNIGHT + 2 * DAY_TURN_SPREAD_MS; ms += 1000) {
      for (const r of rigs) {
        r.clock.ms = ms;
        if (!r.book.stale()) continue;
        await r.book.refresh();
        const m = Math.floor((ms - MIDNIGHT) / MIN);
        minutes.set(m, (minutes.get(m) ?? 0) + 1);
      }
    }
    assert.equal(rigs.reduce((n, r) => n + r.asks.state, 0), 2 * PAGES, 'each page read once before and once after');
    return minutes;
  };
  const spread = await perMinute((i) => Math.floor((i / PAGES) * DAY_TURN_SPREAD_MS));
  assert.ok(Math.max(...spread.values()) <= PAGES / 10, `${JSON.stringify([...spread])}`);
  assert.ok([...spread.keys()].every((m) => m >= 0 && m < DAY_TURN_SPREAD_MS / MIN), 'inside the span');
  assert.deepEqual([...await perMinute(() => 0)], [[0, PAGES]], 'the old turn: all at once');
});

test('DAY-TURN the hall and the seat: witnessed before midnight, not again until the page\'s moment, then again (mutants: the hall\'s day unturned; the seat\'s day unturned)', async () => {
  let ms = MIDNIGHT - MIN;
  const halls = [];
  const hallDoor = { async witness(h) { halls.push(h.key); return { ok: false, error: 'halls-rate' }; } };
  const hallStore = memStorage();
  const hall = createHallBook({ door: hallDoor, storage: hallStore, nowMs: () => ms, turnMs: TURN });
  const town = { key: 77, region: 21, factions: [41, 40] };
  assert.equal(await hall.witness(town), true);
  assert.deepEqual(JSON.parse(hallStore.getItem(HALL_REPORTED_KEY)), { 77: D });
  ms = MIDNIGHT + MIN;
  assert.equal(await hall.witness(town), false, 'the day before, until this page\'s moment');
  ms = MIDNIGHT + TURN;
  assert.equal(await hall.witness(town), true, 'turned');
  assert.deepEqual(halls, [77, 77]);

  ms = MIDNIGHT - MIN;
  const seats = [];
  const seatDoor = {
    list: async () => ({ ok: true, data: { seats: [], me: { witness: true } } }),
    witness: async (s) => { seats.push(s.key); return { ok: true, data: { counted: true } }; },
  };
  const seatBook = createTownSeatBook({ door: seatDoor, storage: memStorage(), nowMs: () => ms, turnMs: TURN });
  await seatBook.read();
  const seat = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
  assert.equal(await seatBook.witness(seat), true);
  ms = MIDNIGHT + TURN - 1;
  assert.equal(await seatBook.witness(seat), false, 'the day before, until this page\'s moment');
  ms = MIDNIGHT + TURN;
  assert.equal(await seatBook.witness(seat), true, 'turned');
  assert.deepEqual(seats, [3021, 3021]);
});

test('DAY-TURN the town: witnessed with its tick before midnight, not again until the page\'s moment, then again (mutants: the town\'s day unturned)', async () => {
  const { subtle } = globalThis.crypto;
  const key = (await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])).privateKey;
  const RIP = ((3 << 20) | (151 * 1000 + 212)) >>> 0;
  const TOWN = { map: RIP, px: 212, py: 151, region: 17, location: 5 };
  const clock = { ms: MIDNIGHT - MIN };
  const witnessed = [];
  const door = {
    econ: async () => ({ ok: true, data: { towns: [] } }),
    witness: async (t) => { witnessed.push(t.map); return { ok: true, data: { counted: false, why: 'ignored' } }; },
    watch: async (rs) => ({ ok: true, data: { counted: rs.length, why: {} } }),
  };
  const book = createTownEconBook({ door, storage: memStorage(), nowMs: () => clock.ms, me: () => 'acct-me', isTownPixel: (x, y) => x === 212 && y === 151,
    relayNowS: () => Math.floor(clock.ms / 1000), turnMs: TURN });
  book.keepWatch(await mintWatchReceipt({ s: 'acct-me', x: 212, y: 151, c: 1 }, key, { subtle, nowS: Math.floor(clock.ms / 1000) }));
  await flush();
  assert.equal(await book.witness(TOWN), true);
  clock.ms = MIDNIGHT + TURN - 1;
  assert.equal(await book.witness(TOWN), false, 'the day before, until this page\'s moment');
  clock.ms = MIDNIGHT + TURN;
  assert.equal(await book.witness(TOWN), true, 'turned');
  assert.deepEqual(witnessed, [RIP, RIP]);
});

/** The text of a call `name(...)` in `src`, its parentheses balanced. */
function callOf(src, name) {
  const at = src.indexOf(`${name}(`);
  assert.ok(at >= 0, `${name} is called`);
  let depth = 0;
  for (let i = at + name.length; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return src.slice(at, i + 1);
  }
  throw new Error(`${name}'s call never closes`);
}

test('DAY-TURN the hosts hand every day-keyed book the page\'s one moment: the world host\'s seats, halls and professions, and the town economy\'s host (mutants: each book built without it)', () => {
  const world = rd('src/scenes/world.js');
  for (const name of ['createTownSeatBook', 'createHallBook', 'createProfBook']) assert.match(callOf(world, name), /\bturnMs: dayTurnMs\(\)/, name);
  assert.match(callOf(rd('src/scenes/townEconHost.js'), 'createTownEconBook'), /\bturnMs: dayTurnMs\(\)/);
});
