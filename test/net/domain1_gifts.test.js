// DOMAIN1 (2026-10-24, the owner: "Allowing guild mates to contribute to town material storage with gathered items/their
// store"): A GIFT TO THE TOWN - a member's fortification materials from its Stores into its guild's stockpile where it
// holds the seat, or its Siege Camp where it pledged it this week; bought units first, never gold's or loose; the works
// supplied; the influence a seat writ's delivery's (own at value, bought at Tribute's rate); one request one gift; every
// rank, the Guildmaster's too (bible/11-Multiplayer/Domains.md section 5; server-account/src/seatGifts.js,
// src/net/seatGiftLaw.js, src/ui/seatWorks.js drawSeatGifts). Driven through the real Worker over node:sqlite with every
// migration applied (test/accountDb.mjs), as seat2b_peace_service.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from '../chargenDom.mjs';
import { standService, T0 } from '../accountDb.mjs';
import { seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S } from '../../src/net/townSeatLaw.js';
import { giftChoices, giftMaterialOk, giftMaterials, giftUnitsOk, GIFT_UNITS_MAX } from '../../src/net/seatGiftLaw.js';
import { FORT_MATERIALS, RAM_KIT_KEY } from '../../src/net/fortLaw.js';
import { STORES_MAX } from '../../src/net/professionLaw.js';
import { createTownSeatBook } from '../../src/net/townSeatBook.js';
import { SEASON_ZERO_WIPED } from '../../server-account/src/seatTurning.js';

const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const ASHFIELD = { key: 3022, name: 'Ashfield', region: 21, tier: 'palace', pixel: [470, 160] };
const YKALON = { key: 3040, name: 'Ykalon', region: 40, tier: 'palace', pixel: [560, 100] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
let _rid = 0;
const rid = () => `gift-${String(++_rid).padStart(6, '0')}`;

async function stood(t, env = {}) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on', ...env });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of [ANTICLERE, ASHFIELD, YKALON]) for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const guild = async (handle, name, tag) => {
    const gm = await svc.seated(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
    return { gm, gid };
  };
  const member = async (g, handle, rank, joinedAt = T0 - 30 * DAY) => {
    const m = await svc.seated(handle);
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(m.id, m.character, g.gid, rank, handle, joinedAt);
    return m;
  };
  const treasury = (gid, n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-${gid}-${n}-${Math.random().toString(36).slice(2, 10)}`);
  const hold = (seat, gid) => raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, 50, NULL, ?, 0, 0)`).run(seat.key, gid, seat.region, seat.tier, W - 1, T0 - 7 * DAY);
  const pledge = (gid, seat, week = W) => raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(week, gid, seat.region, seat.key, 'x', T0);
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  const stores = (who, m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? AND qty > 0 ORDER BY origin').all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const stockpile = (key) => raw.prepare('SELECT material, qty FROM town_seat_stockpile WHERE key = ? AND qty > 0 ORDER BY material').all(key).map((r) => [r.material, Number(r.qty)]);
  const camp = (key, gid, week = W) => raw.prepare('SELECT material, qty FROM town_seat_camps WHERE week = ? AND key = ? AND guild_id = ? AND qty > 0 ORDER BY material').all(week, key, gid).map((r) => [r.material, Number(r.qty)]);
  const influence = (key, gid) => raw.prepare('SELECT source, amount, ref FROM town_seat_influence WHERE key = ? AND guild_id = ? ORDER BY source, ref').all(key, gid).map((r) => [r.source, Number(r.amount), r.ref]);
  const gift = async (who, body, r = rid()) => svc.call('/v1/seats/give', { character: who.character, rid: r, ...body }, who.secret);
  const gifts = async (who, region) => svc.call('/v1/seats/gifts', { character: who.character, region }, who.secret);
  return { svc, raw, guild, member, treasury, hold, pledge, give, stores, stockpile, camp, influence, gift, gifts, at: (s) => { now = s; } };
}

test('DOMAIN1 THE LAW: a gift is what a seat writ may ask - a fortification\'s material to either place, a Ram Kit to a Siege Camp alone, nothing else; 1 to a whole Stores\' units; the board offers each material the giver holds, its Stores and its bag, the most one gift moves (mutants: the Ram Kit; the bound; the order; the sum)', () => {
  for (const k of FORT_MATERIALS) assert.deepEqual([giftMaterialOk(k, 'stockpile'), giftMaterialOk(k, 'camp')], [true, true], k);
  assert.deepEqual([giftMaterialOk(RAM_KIT_KEY, 'stockpile'), giftMaterialOk(RAM_KIT_KEY, 'camp')], [false, true]);
  assert.deepEqual([giftMaterialOk('p1:19', 'stockpile'), giftMaterialOk('metal:iron', 'camp'), giftMaterialOk('', 'camp')], [false, false, false]);
  assert.deepEqual(giftMaterials('stockpile'), [...FORT_MATERIALS]);
  assert.deepEqual(giftMaterials('camp'), [...FORT_MATERIALS, RAM_KIT_KEY]);
  assert.equal(GIFT_UNITS_MAX, STORES_MAX);
  assert.deepEqual([giftUnitsOk(1), giftUnitsOk(STORES_MAX), giftUnitsOk(0), giftUnitsOk(STORES_MAX + 1), giftUnitsOk(1.5), giftUnitsOk('3')], [true, true, false, false, false, false]);
  const s = { 'stone:cut': 30, 'plank:oak': 4900, [RAM_KIT_KEY]: 1 }, b = { 'stone:cut': 5, 'ingot:iron': 7, 'plank:oak': 200 };
  assert.deepEqual(giftChoices('stockpile', (k) => s[k] ?? 0, (k) => b[k] ?? 0), [
    { key: 'ingot:iron', stores: 0, bag: 7, most: 7 },
    { key: 'plank:oak', stores: 4900, bag: 200, most: GIFT_UNITS_MAX },
    { key: 'stone:cut', stores: 30, bag: 5, most: 35 },
  ]);
  assert.deepEqual(giftChoices('camp', (k) => s[k] ?? 0, () => 0).map((c) => c.key), ['plank:oak', 'stone:cut', RAM_KIT_KEY]);
});

test('DOMAIN1 A GIFT TO THE STOCKPILE: any member of the holder - the Guildmaster and an Officer too, whom a writ\'s delivery bars - gives from its Stores; the units leave the Stores and stand in the seat\'s stockpile; the gift is named on the board; its influence is a seat writ\'s (2 a Cut Stone, own units at their value); asked again it is one gift (mutants: the rank; the place; the units; the stockpile; the influence\'s value; the request id)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid);
  const off = await s.member(sh, 'Ofelia', 1);
  const mem = await s.member(sh, 'Mira', 2);
  for (const who of [sh.gm, off, mem]) s.give(who, 'stone:cut', 'own', 100);
  const r1 = rid();
  const a = await s.gift(sh.gm, { region: ANTICLERE.region, material: 'stone:cut', units: 40 }, r1);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.deepEqual([a.body.place, a.body.key, a.body.gift], ['stockpile', ANTICLERE.key, { material: 'stone:cut', units: 40, own: 40, place: 'stockpile', key: ANTICLERE.key }]);
  assert.equal(a.body.counted, true);
  assert.deepEqual(s.stores(sh.gm, 'stone:cut'), [['own', 60]]);
  assert.deepEqual(s.stockpile(ANTICLERE.key), [['stone:cut', 40]]);
  assert.deepEqual(a.body.contents, [['stone:cut', 40]]);
  assert.deepEqual(a.body.recent.map((g) => [g.who, g.material, g.units]), [['Gamal', 'stone:cut', 40]]);
  assert.deepEqual(s.influence(ANTICLERE.key, sh.gid), [['writ', 80, `gift:${sh.gm.id}:${r1}:writ`]], 'two influence a Cut Stone: its value, never a pay');
  // asked again: the same gift, nothing moved twice
  const again = await s.gift(sh.gm, { region: ANTICLERE.region, material: 'stone:cut', units: 40 }, r1);
  assert.equal(again.status, 200);
  assert.equal(again.body.repeat, true);
  assert.deepEqual([s.stores(sh.gm, 'stone:cut'), s.stockpile(ANTICLERE.key)], [[['own', 60]], [['stone:cut', 40]]]);
  assert.equal(s.influence(ANTICLERE.key, sh.gid).length, 1);
  // an Officer and a Member give too
  assert.equal((await s.gift(off, { region: ANTICLERE.region, material: 'stone:cut', units: 10 })).status, 200);
  assert.equal((await s.gift(mem, { region: ANTICLERE.region, material: 'stone:cut', units: 5 })).status, 200);
  assert.deepEqual(s.stockpile(ANTICLERE.key), [['stone:cut', 55]]);
  const read = await s.gifts(mem, ANTICLERE.region);
  assert.equal(read.status, 200);
  assert.deepEqual(read.body.recent.map((g) => [g.who, g.units]), [['Mira', 5], ['Ofelia', 10], ['Gamal', 40]], 'newest first');
});

test('DOMAIN1 WHAT A GIFT MAY SPEND: bought units go first and count at Tribute\'s rate; gold\'s and loose units never go - stores-gold where only they would cover it, stores-short where nothing would; a writ\'s material alone, a Ram Kit never to a stockpile (mutants: the bought-first own; the bought row; gold\'s origin; the loose origin; the material\'s law)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid);
  const mem = await s.member(sh, 'Mira', 2);
  s.give(mem, 'plank:oak', 'own', 20);
  s.give(mem, 'plank:oak', 'bought', 4);
  const r = rid();
  const a = await s.gift(mem, { region: ANTICLERE.region, material: 'plank:oak', units: 10 }, r);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.gift.own, 6, 'the four bought go first');
  assert.deepEqual(s.stores(mem, 'plank:oak'), [['own', 14]]);
  assert.deepEqual(s.influence(ANTICLERE.key, sh.gid), [['bought', 8, `gift:${mem.id}:${r}:bought`], ['writ', 12, `gift:${mem.id}:${r}:writ`]]);
  // gold's units and loose units are never given
  s.give(mem, 'ingot:iron', 'gold', 50);
  s.give(mem, 'stone:cut', 'loose', 50);
  assert.deepEqual([(await s.gift(mem, { region: ANTICLERE.region, material: 'ingot:iron', units: 5 })).body.error, s.stores(mem, 'ingot:iron')], ['stores-gold', [['gold', 50]]]);
  assert.equal((await s.gift(mem, { region: ANTICLERE.region, material: 'stone:cut', units: 5 })).body.error, 'stores-short');
  assert.equal((await s.gift(mem, { region: ANTICLERE.region, material: 'plank:oak', units: 15 })).body.error, 'stores-short');
  // the material's law
  s.give(mem, RAM_KIT_KEY, 'own', 2);
  s.give(mem, 'p1:19', 'own', 9);
  assert.equal((await s.gift(mem, { region: ANTICLERE.region, material: RAM_KIT_KEY, units: 1 })).body.error, 'bad-material');
  assert.equal((await s.gift(mem, { region: ANTICLERE.region, material: 'p1:19', units: 1 })).body.error, 'bad-material');
  assert.equal((await s.gift(mem, { region: ANTICLERE.region, material: 'nothing', units: 1 })).body.error, 'bad-material');
  assert.equal((await s.gift(mem, { region: ANTICLERE.region, material: 'plank:oak', units: 0 })).body.error, 'bad-units');
  assert.equal((await s.gift(mem, { region: 71, material: 'plank:oak', units: 1 })).body.error, 'bad-region');   // PIN MOVED (WW7-3, bible/03-World/World-Wide.md WW7): 62-70 the provinces'
  assert.deepEqual(s.stockpile(ANTICLERE.key), [['plank:oak', 10]], 'no refusal moved a unit');
});

test('DOMAIN1 THE SIEGE CAMP AND NOWHERE: a guild pledged to a seat this week gives to its own Siege Camp there - a Ram Kit too - never to the holder\'s stockpile; a guild that holds and pledged nothing in the region is told seat-none-here, and the read says no place; a stranger to every guild no-guild (mutants: the place\'s order; the week; the camp\'s guild; the Ram Kit; the refusal)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid);
  s.pledge(eo.gid, ANTICLERE);
  s.give(eo.gm, 'stone:cut', 'own', 50);
  s.give(eo.gm, RAM_KIT_KEY, 'own', 1);
  const a = await s.gift(eo.gm, { region: ANTICLERE.region, material: 'stone:cut', units: 30 });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.deepEqual([a.body.place, a.body.key], ['camp', ANTICLERE.key]);
  assert.equal((await s.gift(eo.gm, { region: ANTICLERE.region, material: RAM_KIT_KEY, units: 1 })).status, 200);
  assert.deepEqual(s.camp(ANTICLERE.key, eo.gid), [['stone:cut', 30], [RAM_KIT_KEY, 1]]);
  assert.deepEqual(s.stockpile(ANTICLERE.key), [], 'never the holder\'s');
  const read = await s.gifts(eo.gm, ANTICLERE.region);
  assert.deepEqual([read.body.place, read.body.contents], ['camp', [['stone:cut', 30], [RAM_KIT_KEY, 1]]]);
  // last week's pledge is no place this week
  const lt = await s.guild('Lorna', 'Low Tide', 'LT');
  s.pledge(lt.gid, ASHFIELD, W - 1);
  s.give(lt.gm, 'stone:cut', 'own', 5);
  assert.equal((await s.gift(lt.gm, { region: ASHFIELD.region, material: 'stone:cut', units: 1 })).body.error, 'seat-none-here');
  assert.equal((await s.gifts(lt.gm, ASHFIELD.region)).body.place, null);
  // another region: nothing there
  assert.equal((await s.gift(sh.gm, { region: YKALON.region, material: 'stone:cut', units: 1 })).body.error, 'seat-none-here');
  const loner = await s.svc.seated('Lone');
  s.give(loner, 'stone:cut', 'own', 5);
  assert.equal((await s.gift(loner, { region: ANTICLERE.region, material: 'stone:cut', units: 1 })).body.error, 'no-guild');
});

test('DOMAIN1 THE WORKS AND THE COUNT: a gift to the stockpile is taken by a building project at once, as a writ\'s delivery is; a member seven days short gives and is told it counted nothing; the gifts are wiped with the stockpiles at Season 0\'s end (mutants: the supply; the member\'s wait; the wipe)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid);
  s.treasury(sh.gid, 20_000);
  const fund = await s.svc.call('/v1/seats/fort/fund', { character: sh.gm.character, key: ANTICLERE.key, work: 'walls', rid: rid() }, sh.gm.secret);
  assert.equal(fund.status, 200, JSON.stringify(fund.body));
  const fresh = await s.member(sh, 'Newt', 2, T0 - DAY);
  s.give(fresh, 'stone:cut', 'own', 300);
  const a = await s.gift(fresh, { region: ANTICLERE.region, material: 'stone:cut', units: 300 });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.counted, false, 'a member a day in the guild counts nothing yet');
  assert.ok(a.body.why);
  assert.equal(s.raw.prepare("SELECT qty FROM town_seat_fort_held WHERE key = ? AND work = 'walls' AND material = 'stone:cut'").get(ANTICLERE.key)?.qty, 300, 'the Walls took it');
  assert.deepEqual(s.stockpile(ANTICLERE.key), []);
  assert.ok(SEASON_ZERO_WIPED.includes('town_seat_gifts'));
});

test('DOMAIN1 THE SWITCHES: a gift is the seats\' and the Stores\' - shut where either is, before anything is read (mutants: the seats\' switch; the professions\')', async (t) => {
  for (const [env, word] of [[{ SEATS_OPEN: 'off' }, 'seats-closed'], [{ PROFESSIONS_OPEN: 'off' }, 'prof-closed']]) {
    const s = await stood(t, env);
    const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
    s.hold(ANTICLERE, sh.gid);
    s.give(sh.gm, 'stone:cut', 'own', 5);
    assert.equal((await s.gift(sh.gm, { region: ANTICLERE.region, material: 'stone:cut', units: 1 })).body.error, word);
    assert.equal((await s.gifts(sh.gm, ANTICLERE.region)).body.error, word);
  }
});

test('DOMAIN1 THE BOOK: a gift asked again after an answer that never came carries its one request id; the Stores\' count it answers goes to the professions\' book; the read keeps the shape the tab draws (mutants: the request id kept; the Stores told; the view)', async () => {
  const asked = [];
  let fail = true;
  const told = [];
  const door = {
    list: async () => ({ ok: true, data: { seats: [] } }),
    give: async (character, region, material, units, rid) => {
      asked.push(rid);
      if (fail) { fail = false; return { ok: false, error: 'offline' }; }
      return { ok: true, data: { place: 'stockpile', key: 9, contents: [['stone:cut', 4]], recent: [], gift: { material, units, own: units, place: 'stockpile', key: 9 }, counted: true, store: { material, own: 1, bought: 0 } } };
    },
    gifts: async () => ({ ok: true, data: { place: 'camp', key: 7, contents: 'junk', recent: [{ who: 'A', material: 'stone:cut', units: 2, at: 1 }] } }),
  };
  let n = 0;
  const book = createTownSeatBook({ door, character: () => 'c1', rid: () => `rid-${++n}`, stores: (st) => told.push(st) });
  const r1 = await book.give(21, 'stone:cut', 4);
  const r2 = await book.give(21, 'stone:cut', 4);
  assert.deepEqual([r1.ok, r1.error, r2.ok], [false, 'offline', true]);
  assert.deepEqual(asked, ['rid-1', 'rid-1'], 'the same gift asked again carries the same id');
  assert.deepEqual(told, [{ material: 'stone:cut', own: 1, bought: 0 }]);
  assert.deepEqual([r2.data.place, r2.data.key, r2.data.counted, r2.data.gift.units], ['stockpile', 9, true, 4]);
  await book.give(21, 'stone:cut', 4);
  assert.equal(asked[2], 'rid-2', 'a gift answered is done: the next is a new one');
});

test('DOMAIN1 THE BOARD: the Seat tab draws the gift panel for the guild\'s own place alone, each material held with its Stores and bag and a count, Give asks the bag\'s units into the Stores first and then the gift, and a Siege Camp says what it holds (mutants: the place\'s key; the bag first; the camp\'s line; the count\'s bound)', async () => {
  const src = readFileSync(new URL('../../src/ui/seatTab.js', import.meta.url), 'utf8');
  assert.match(src, /if \(host\.giving && gifts\?\.place && gifts\.key === seat\.key\) \{/, 'only where the guild gives AT THIS seat');
  assert.match(src, /if \(giving\.bag\(key\) > 0\) \{\n\s+const ready = await giving\.putIn\(key, n\);/, 'the bag\'s units into the Stores first');
  const { drawSeatGifts } = await import('../../src/ui/seatWorks.js');
  const host = document.createElement('div');
  const gave = [];
  const counts = {};
  const buttons = drawSeatGifts(host, {
    gifts: { place: 'camp', contents: [['stone:cut', 30]], recent: [{ who: 'Alda', material: 'stone:cut', units: 30, at: 1 }] },
    stores: (k) => ({ 'stone:cut': 12 }[k] ?? 0), bag: (k) => ({ 'stone:cut': 3, [RAM_KIT_KEY]: 1 }[k] ?? 0),
    counts, nameOf: (k) => k, onGive: (k, n) => gave.push([k, n]),
  });
  assert.deepEqual(Object.keys(buttons), ['stone:cut', RAM_KIT_KEY]);
  const input = byClass(host, 'notice-seat-gift-n')[0];
  assert.equal(input.max, '15');
  input.value = '99';
  buttons['stone:cut'].onclick({ stopPropagation() {} });
  assert.deepEqual(gave, [['stone:cut', 15]], 'never past what the giver holds');
  assert.match(host.textContent, /Give to the Siege Camp/);
  assert.match(host.textContent, /The Siege Camp holds: 30 stone:cut\./);
  assert.match(host.textContent, /Alda gave 30 stone:cut\./);
});
