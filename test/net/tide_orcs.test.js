// SEASON1 part two, the client's Tides (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE ORC RAIDS AND
// THE STORM SEASON'S SEA (bible/11-Multiplayer/Seats-Arc.md 9.3) - the law (an Orc Raid's camps in an account's week,
// 250 at most); through the real Worker, a camp cleared in the Marches' Orc Raids against a twin counting no Season, its
// caps (five camps a UTC day, 250 a week, a camp once a day) and the standings it lands in; the client's book (the Tide
// it reads, the camp it claims), the Edicts' camps (a raid's foes doubled, its influence said) and the travel clock's
// stormy sea. The rolls are the law's: the Marches roll Orc Raids in week W+3 of T0's, the Kingdom of Wayrest a Calm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';   // INT16: a guest seated, to reach the seats' own door
import { seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, WATCH_INFLUENCE, ACCOUNT_SEAT_WEEK_CAP, accountSeatInfluence } from '../../src/net/townSeatLaw.js';
import { tideOf, TIDE_EFFECTS } from '../../src/net/tideLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { createTownSeatBook } from '../../src/net/townSeatBook.js';
import { createSeatEdicts, ORC_CAMP_TEXT } from '../../src/systems/seatEdicts.js';
import { calculateTravelTime, travelPixelMinutes, setSeaTide } from '../../src/systems/travel/travel.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';

const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
const START = (w) => Math.floor(seatWeekStartMs(w) / 1000);

test('SEASON1 THE ORC RAIDS\' LAW: a camp\'s influence in the account\'s week beside the rest, 250 at most, none below nothing; the account\'s seat cap over all (mutants: the cap; the floor; the sum)', () => {
  assert.equal(accountSeatInfluence({ raid: 100 }), 100);
  assert.equal(accountSeatInfluence({ raid: 300 }), TIDE_EFFECTS.orcsInfluenceWeek);
  assert.equal(accountSeatInfluence({ raid: -50, watch: 2 }), 2 * WATCH_INFLUENCE);
  assert.equal(accountSeatInfluence({ raid: 150, watch: 2 }), 150 + 2 * WATCH_INFLUENCE);
  assert.equal(accountSeatInfluence({ raid: 250, watch: 1e6 }), ACCOUNT_SEAT_WEEK_CAP);
  assert.deepEqual([TIDE_EFFECTS.orcsCampInfluence, TIDE_EFFECTS.orcsCampsDay, TIDE_EFFECTS.orcsInfluenceWeek], [50, 5, 250]);
});

async function stood(t, zero) {
  let now = START(W + 3) + 3600;   // Sunday 19:00 UTC: the Turning an hour gone, its UTC day begun in week W+2
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', ...(zero != null ? { SEASON_ZERO_WEEK: String(zero) } : {}) });
  const raw = svc.env.DB._raw;
  for (let i = 0; i < 3; i++) {
    const w = await svc.guest();
    raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(ANTICLERE.key), w.id, seatReportText(ANTICLERE), ANTICLERE.region, T0 - DAY);
  }
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W + 2, now - 3000);   // the Turning settled
  const gm = await svc.seated('Gamal', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
  raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
  raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(W + 3, gid, ANTICLERE.region, ANTICLERE.key, 'x', T0);
  const camp = async (site, region = ANTICLERE.region, who = gm) => (await svc.call('/v1/seats/orc-camp', { character: who.character, site, region }, who.secret)).body;
  const earlier = (n) => {   // n camps claimed before the Turning this UTC day - in the Sentinel's Orc Raids of week W+2
    for (let i = 0; i < n; i++) raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
      VALUES (?, 2020, ?, ?, ?, 'raid', 50, 20, ?, ?, ?)`).run(W + 2, gid, gm.id, gm.character, utcDay(now), `early-${i}`, now - 7200);
  };
  return { svc, raw, gm, gid, camp, earlier, setNow: (v) => { now = v; }, now: () => now };
}

test('SEASON1 THE ORC RAIDS IN THE SERVICE, AGAINST A TWIN COUNTING NONE: a camp in the Marches\' Orc Raids is 50 influence at the guild\'s seat there; a camp once a day, five camps a UTC day, 250 a week; another land\'s Calm none; the twin none; the standings carry it (mutants: the Tide gate; the amount; each cap; the ref\'s day; the source counted; the answers)', async (t) => {
  assert.deepEqual([tideOf(W + 3, 'marches'), tideOf(W + 3, 'wayrest'), tideOf(W + 3, 'free'), tideOf(W + 2, 'sentinel')], ['orcs', 'calm', 'revolt', 'orcs'], 'the rolls this test stands on');
  const twin = await stood(t, null);
  assert.deepEqual(await twin.camp('402,151:1'), { ok: true, counted: false, why: 'no-raid' });
  assert.equal(twin.raw.prepare("SELECT COUNT(*) AS n FROM town_seat_influence WHERE source = 'raid'").get().n, 0);
  const s = await stood(t, W - 2);
  s.raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
    VALUES (?, ?, ?, ?, ?, 'watch', 20, 21, 1, 'w', ?)`).run(W + 3, ANTICLERE.key, s.gid, s.gm.id, s.gm.character, s.now());   // the Watch beside: not the raids' 250
  assert.deepEqual(await s.camp('402,151:1'), { ok: true, counted: true, key: ANTICLERE.key });
  assert.deepEqual(await s.camp('402,151:1'), { ok: true, counted: false, why: 'claimed' }, 'a camp once a day');
  assert.deepEqual(await s.camp('590,166:1', 34), { ok: true, counted: false, why: 'no-raid' }, 'Wayrest\'s Calm');
  assert.deepEqual(await s.camp('850,100:1', 26), { ok: true, counted: false, why: 'no-raid' }, 'the Free Lands\' Tax Revolt');
  assert.equal((await s.camp('402,151:2')).counted, true);
  assert.equal((await s.camp('402,151:3')).counted, true);
  assert.deepEqual(s.raw.prepare("SELECT week, key, guild_id, account, char_id, amount, region, day, ref FROM town_seat_influence WHERE source = 'raid' ORDER BY id").all().map((r) => ({ ...r })).at(0),
    { week: W + 3, key: ANTICLERE.key, guild_id: s.gid, account: s.gm.id, char_id: s.gm.character, amount: 50, region: 21, day: utcDay(s.now()), ref: `${utcDay(s.now())}:402,151:1:${s.gm.id}` });
  // the next day: the same camp again, a fourth and fifth - then the week's 250
  s.setNow(s.now() + DAY);
  assert.equal((await s.camp('402,151:1')).counted, true, 'the same camp on another day');
  assert.equal((await s.camp('402,151:4')).counted, true);
  assert.deepEqual(await s.camp('402,151:5'), { ok: true, counted: false, why: 'capped' }, 'two camps today, 250 this week');
  const standings = (await s.svc.call('/v1/seats/standings', { key: ANTICLERE.key, character: s.gm.character }, s.gm.secret)).body;
  assert.equal(standings.standings[0].influence, TIDE_EFFECTS.orcsInfluenceWeek + 20 * WATCH_INFLUENCE);
  assert.deepEqual(standings.tides, { now: 'orcs', next: tideOf(W + 4, 'marches') });
});

test('SEASON1 THE ORC RAIDS\' DAY: five camps a UTC day across the weeks it spans - four before the Turning leave one, five none, though the week has its 250 to give; refusals in their own words (mutants: the day cap; the refusals)', async (t) => {
  const four = await stood(t, W - 2);
  four.earlier(4);
  assert.equal((await four.camp('402,151:1')).counted, true);
  assert.deepEqual(await four.camp('402,151:2'), { ok: true, counted: false, why: 'capped' });
  const five = await stood(t, W - 2);
  five.earlier(5);
  assert.deepEqual(await five.camp('402,151:1'), { ok: true, counted: false, why: 'capped' });
  assert.equal(five.raw.prepare("SELECT COUNT(*) AS n FROM town_seat_influence WHERE source = 'raid' AND week = ?").get(W + 3).n, 0);
  for (const site of ['nope', '402,151', '1000,10:1', '402,151:1;drop', 7]) assert.equal((await five.camp(site)).error, 'bad-orc-camp', String(site));
  assert.equal((await five.camp('402,151:1', 999)).error, 'bad-orc-camp');
  const guest = await five.svc.guest();
  // PIN MOVED (INT16, Integrity-Arc section 7): a camp is asked of the account's seated realm character first - a guest
  // naming a character it does not sit in is refused 'progress-seat' before the seats read it; seated, it reaches the
  // seats' own door
  assert.equal((await five.svc.call('/v1/seats/orc-camp', { character: 'c', site: '402,151:1', region: 21 }, guest.secret)).body.error, 'progress-seat');
  const guestSeat = await seatRealm(five.svc.env, guest.secret, 'Guestling');
  assert.equal((await five.svc.call('/v1/seats/orc-camp', { character: guestSeat.id, site: '402,151:1', region: 21 }, guest.secret)).body.error, 'seats-need-account');
  const loner = await five.svc.seated('Lone');
  assert.deepEqual(await five.camp('402,151:9', 21, loner), { ok: true, counted: false, why: 'no-guild' });
});

const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('SEASON1 THE CLIENT\'S TIDES: the book reads a land\'s Tide off the week and the seats\' Season 0 (Calm with none, or the seats shut) and claims a camp down its own path, quiet; the Edicts double a raid\'s camps and claim each cleared where the Tide is Orc Raids, its influence said; a Storm Season\'s sea half again slower on the ocean alone, offline untouched (mutants: the zero; the open gate; the path; the answer; the doubling; the claim\'s gate; the line; the sea\'s factor; its pixels)', async () => {
  const nowMs = START(W + 3) * 1000 + 3600_000;
  let listed = { seats: [], red: [], zero: W - 2 };
  const calls = [];
  const door = {
    list: async () => ({ ok: true, data: listed }),
    orcCamp: async (...a) => { calls.push(a); return { ok: true, data: { counted: a[1] !== '402,151:9' } }; },
    standings: async () => { stands++; return shut ? { ok: false, error: 'seats-closed' } : { ok: true, data: {} }; },
  };
  let stands = 0, shut = false;
  const book = createTownSeatBook({ door, character: () => 'c1', storage: memStore(), nowMs: () => nowMs });
  assert.deepEqual([book.zero, book.tideAt(21)], [null, 'calm'], 'unread: the seats not known open');
  assert.deepEqual(await book.orcCamp('402,151:1', 21), { counted: false });
  assert.equal(calls.length, 0);
  await book.read();
  assert.deepEqual([book.zero, book.tideAt(21), book.tideAt(34), book.tideAt(31)], [W - 2, 'orcs', 'calm', 'calm']);
  assert.deepEqual(await book.orcCamp('402,151:1', 21), { counted: true });
  assert.deepEqual(await book.orcCamp('402,151:9', 21), { counted: false });
  assert.deepEqual(calls, [['c1', '402,151:1', 21], ['c1', '402,151:9', 21]]);
  await book.standings(3021); await book.standings(3021);
  assert.equal(stands, 1);
  await book.orcCamp('402,151:2', 21);
  await book.standings(3021);
  assert.equal(stands, 2, 'a camp claimed reads the standings afresh');
  shut = true;
  await book.standings(3021, { force: true });
  assert.deepEqual([book.zero, book.tideAt(21), await book.orcCamp('402,151:3', 21), calls.length], [W - 2, 'calm', { counted: false }, 3], 'the seats shut: Calm, nothing claimed');
  shut = false;
  listed = { seats: [], red: [] };
  await book.read({ force: true });
  assert.deepEqual([book.zero, book.tideAt(21)], [null, 'calm'], 'no Season counted');
  listed = { seats: [], red: [], zero: 'x' };
  await book.read({ force: true });
  assert.equal(book.zero, null, 'a zero not whole');
  // the door's own path and body
  const posted = [];
  const { accountSeats } = await import('../../src/net/accountClient.js');
  const seats = accountSeats({ fetch: async (u, i) => { posted.push([new URL(u).pathname, JSON.parse(i.body)]); return new Response('{"ok":true}', { status: 200 }); }, storage: { getItem: () => JSON.stringify({ id: 'p1', secret: 's' }), setItem() {}, removeItem() {} } });
  await seats.orcCamp('c1', '402,151:1', 21);
  assert.deepEqual(posted, [['/v1/seats/orc-camp', { character: 'c1', site: '402,151:1', region: 21 }]]);
  // the Edicts: a raid's camps and the claim
  const said = [], claimed = [];
  const tides = { 21: 'orcs', 34: 'calm', 26: 'revolt' };
  const e = createSeatEdicts({
    seatAt: () => null, here: () => null, seats: () => [], guildId: () => 'g1', minutes: () => 0, say: (l) => said.push(l),
    regionAt: (px) => (px < 500 ? 21 : px < 800 ? 34 : 26), claim: async () => ({ paid: 0 }), tideAt: (r) => tides[r] ?? 'calm',
    orcCamp: async (site, region) => { claimed.push([site, region]); return { counted: site !== '402,151:9' }; },
  });
  assert.deepEqual([e.orcsAt(402, 151), e.orcsAt(590, 166), e.orcsAt(850, 100)], [true, false, false]);
  await e.campCleared('402,151:1');
  await e.campCleared('590,166:1');
  await e.campCleared('402,151:9');
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(claimed, [['402,151:1', 21], ['402,151:9', 21]]);
  assert.deepEqual(said, [ORC_CAMP_TEXT], 'said once, for the camp that counted');
  assert.equal(ORC_CAMP_TEXT, 'The Orc Raids: your guild gains 50 influence at its seat in the region.');
  const offline = createSeatEdicts({ seatAt: () => null, here: () => null, seats: () => [], guildId: () => null, minutes: () => 0, regionAt: () => 21 });
  assert.equal(offline.orcsAt(402, 151), false, 'no host Tide: Calm');
  // the sea: nine ocean pixels walked (the start left) and ten plains, bound east
  const climate = (x) => (x < 110 ? CLIMATES.Ocean : 230);
  const trip = (opts) => calculateTravelTime({ x: 100, y: 50 }, { x: 119, y: 50 }, { travelShip: true, speedCautious: true, ...opts }, climate);
  const calm = trip({});
  const ocean = trip({ seaMult: 1.5 });
  const land = calculateTravelTime({ x: 110, y: 50 }, { x: 119, y: 50 }, { travelShip: true, speedCautious: true, seaMult: 1.5 }, climate);
  assert.equal(land.minutes, calculateTravelTime({ x: 110, y: 50 }, { x: 119, y: 50 }, { travelShip: true, speedCautious: true }, climate).minutes, 'the land untouched');
  assert.ok(ocean.minutes > calm.minutes);
  const sea = travelPixelMinutes(CLIMATES.Ocean, 256, { travelShip: true });
  assert.equal(ocean.minutes - calm.minutes, calm.oceanPixels * (Math.floor(sea * 1.5) - sea), 'each ocean pixel half again, rounded down');
  assert.equal(calm.oceanPixels, 9, 'the walk leaves its start');
  setSeaTide((end) => (end.x === 119 ? 1.5 : 1));
  try {
    assert.equal(trip({}).minutes, ocean.minutes, 'the host\'s Tide where the voyage is bound');
    assert.equal(calculateTravelTime({ x: 100, y: 50 }, { x: 118, y: 50 }, { travelShip: true, speedCautious: true }, climate).minutes < ocean.minutes, true);
  } finally { setSeaTide(null); }
  assert.equal(trip({}).minutes, calm.minutes, 'offline: DFU\'s own');
  // the wiring
  const world = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /setSeaTide\(seatBook \? \(end\) => \(seatBook\.tideAt\(maps\.getRegionIndexAt\(end\.x, end\.y\)\) === 'storms' \? TIDE_EFFECTS\.stormsSea : 1\) : null\);/);
  assert.match(world, /if \(act\.hostile && seatEdicts\.orcsAt\(p\.px, p\.py\)\) \{\n\s+exteriorFoes\.spawnFoe\(act\.mobileType, \[x \+ ORC_RAID_PACE, y, z \+ ORC_RAID_PACE\]/);
  assert.match(world, /tideAt: \(region\) => seatBook\?\.tideAt\(region\) \?\? 'calm',\n\s+orcCamp: \(site, region\) => seatBook\?\.orcCamp\(site, region\) \?\? Promise\.resolve\(\{ counted: false \}\),/);
});
