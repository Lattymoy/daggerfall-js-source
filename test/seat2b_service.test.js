// SEAT2b (2026-10-01, Mac: "Finish the seats"; "We need to do a comprehensive audit on everything and finish the not
// done"): A SEAT'S FORTIFICATIONS AS THE SERVICE KEEPS THEM - a project begun by the holder's Officer, its Marks burnt;
// supplied from the seat's stockpile; standing its tier's days after its last need is met; a Builder's stone; who may
// raise what; the drops (bible/11-Multiplayer/Seats-Arc.md 7.5; server-account/src/seatForts.js). Driven through the
// real Worker over node:sqlite with every migration applied (test/accountDb.mjs). `06-Systems/Online-Arc.md` SEAT2b.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from './accountDb.mjs';
import { seatReportText, seatWeekOf, SEAT_MEMBER_WAIT_S, chronicleLine } from '../src/net/townSeatLaw.js';
import { fortsCapturedStatements, fortsSeasonStatements, fortifierAt, campsSpent } from '../server-account/src/seatForts.js';
import { readFileSync } from 'node:fs';

const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
let _rid = 0;
const rid = () => `fort-${String(++_rid).padStart(6, '0')}`;

async function stood(t) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of [ANTICLERE, WAYREST]) for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const guild = async (handle, name, tag) => {
    const gm = await svc.registered(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
    return { gm, gid };
  };
  const member = async (g, handle, rank) => {
    const m = await svc.registered(handle);
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(m.id, m.character, g.gid, rank, handle, T0 - 30 * DAY);
    return m;
  };
  const treasury = (gid, n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-${gid}-${n}-${Math.random().toString(36).slice(2, 10)}`);
  const purse = (gid) => Number(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(gid)?.balance ?? 0);
  const hold = (seat, gid) => raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, 50, NULL, ?, 6, 0)`).run(seat.key, gid, seat.region, seat.tier, W - 1, T0 - 7 * DAY);
  const stock = (key, material, qty) => raw.prepare(`INSERT INTO town_seat_stockpile (key, material, qty) VALUES (?, ?, ?)
    ON CONFLICT (key, material) DO UPDATE SET qty = town_seat_stockpile.qty + excluded.qty`).run(key, material, qty);
  const stockOf = (key) => Object.fromEntries(raw.prepare('SELECT material, qty FROM town_seat_stockpile WHERE key = ? AND qty > 0').all(key).map((r) => [r.material, Number(r.qty)]));
  const fund = async (who, key, work, o = {}) => (await svc.call('/v1/seats/fort/fund', { character: who.character, key, work, rid: rid(), ...o }, who.secret));
  const forts = async (who, key) => (await svc.call('/v1/seats/forts', { key }, who.secret)).body;
  const chronicle = (key) => raw.prepare('SELECT kind, week, data FROM town_seat_history WHERE key = ? ORDER BY seq').all(key).map((r) => ({ kind: r.kind, week: r.week, data: JSON.parse(r.data) }));
  return { svc, raw, guild, member, treasury, purse, hold, stock, stockOf, fund, forts, chronicle, at: (s) => { now = s; } };
}

test('SEAT2b A PROJECT BEGUN: the holder\'s Officer begins the Walls\' first tier, its 1,000 burnt from the treasury; a Member, another guild, a short treasury, a second project of the same work and a work the seat may not raise refused; the same rid twice is one project (mutants: the rank; the holder; the Marks; one a work; the next tier)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid);
  const off = await s.member(sh, 'Ofelia', 1), mem = await s.member(sh, 'Menno', 2);
  assert.equal((await s.fund(off, ANTICLERE.key, 'walls')).body.error, 'seat-treasury');
  s.treasury(sh.gid, 2500);
  assert.equal((await s.fund(mem, ANTICLERE.key, 'walls')).body.error, 'guild-rank');
  assert.equal((await s.fund(eo.gm, ANTICLERE.key, 'walls')).body.error, 'seat-not-held');
  assert.equal((await s.fund(off, ANTICLERE.key, 'moat')).body.error, 'bad-work');
  assert.equal((await s.fund(off, ANTICLERE.key, 'gatehouse')).body.error, 'fort-not-here', 'a palace without tier-3 Walls has no gate');
  assert.equal((await s.fund(off, ANTICLERE.key, 'harbour')).body.error, 'fort-not-here', 'nor a harbour inland');
  const r = await s.fund(off, ANTICLERE.key, 'walls', { rid: 'fort-walls-01' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.tier, r.body.marks, r.body.needs, r.body.builder], [1, 1000, [['stone:cut', 400], ['plank:oak', 100]], false]);
  assert.equal(s.purse(sh.gid), 1500, 'burnt');
  assert.deepEqual(s.raw.prepare("SELECT src_kind, dst_kind, amount FROM marks_ledger WHERE kind = 'fort'").all().map((x) => [x.src_kind, x.dst_kind, x.amount]), [['guild', 'burn', 1000]]);
  assert.equal((await s.fund(off, ANTICLERE.key, 'walls', { rid: 'fort-walls-01' })).body.repeat, true, 'the same rid: no second project, no second burn');
  assert.equal(s.purse(sh.gid), 1500);
  assert.equal((await s.fund(off, ANTICLERE.key, 'walls')).body.error, 'fort-building');
  assert.equal((await s.fund(off, ANTICLERE.key, 'harbour', { port: true })).body.error, 'seat-treasury', 'a port\'s harbour may be begun - its 2,000 not held');
  assert.equal((await s.fund(off, ANTICLERE.key, 'shrine')).status, 200, 'another work beside it');
  assert.equal(s.purse(sh.gid), 500);
  const row = s.chronicle(ANTICLERE.key).find((c) => c.kind === 'fort-begun');
  assert.equal(chronicleLine(row, ANTICLERE), `In week ${W}, the Silver Hand <SH> began raising Anticlere's Walls to their first tier.`);
});

test('SEAT2b THE SUPPLY AND THE RISE: the stockpile\'s units move into the project, the works in the table\'s order; a met project stands 2 days on, and its tier is the Walls\' then - the Chronicle says so; a Builder\'s project asks nine tenths of the stone (mutants: the move; the order; the day; the rise; the Builder)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid);
  s.treasury(sh.gid, 10_000);
  s.stock(ANTICLERE.key, 'stone:cut', 450);
  s.stock(ANTICLERE.key, 'plank:oak', 40);
  assert.equal((await s.fund(sh.gm, ANTICLERE.key, 'walls')).status, 200);
  assert.equal((await s.fund(sh.gm, ANTICLERE.key, 'shrine')).status, 200);
  let f = await s.forts(sh.gm, ANTICLERE.key);
  assert.deepEqual(f.works.walls, { tier: 0, building: 1, standsAt: null, needs: [['stone:cut', 400], ['plank:oak', 100]], held: [['stone:cut', 400], ['plank:oak', 40]] });
  assert.deepEqual(f.works.shrine.held, [['stone:cut', 50], ['metal:silver', 0]], 'the Walls first, the Shrine the stone left');
  assert.deepEqual(s.stockOf(ANTICLERE.key), {}, 'every unit moved');
  s.stock(ANTICLERE.key, 'plank:oak', 70);
  s.at(T0 + 3600);
  f = await s.forts(sh.gm, ANTICLERE.key);
  assert.equal(f.works.walls.standsAt, T0 + 3600 + 2 * DAY, 'met: two days on');
  assert.deepEqual(s.stockOf(ANTICLERE.key), { 'plank:oak': 10 }, 'no more than it needs');
  s.at(T0 + 3600 + 2 * DAY - 1);
  assert.equal((await s.forts(sh.gm, ANTICLERE.key)).works.walls.tier, 0);
  s.at(T0 + 3600 + 2 * DAY);
  f = await s.forts(sh.gm, ANTICLERE.key);
  assert.deepEqual([f.works.walls.tier, f.works.walls.building, f.works.walls.held], [1, null, null]);
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM town_seat_fort_held WHERE work = 'walls'").get().n, 0, 'spent into the work');
  const raised = s.chronicle(ANTICLERE.key).find((c) => c.kind === 'fort-raised');
  assert.deepEqual(raised.data, { work: 'walls', tier: 1 });
  // the next tier: begun from tier 1; a Builder's asks 720 of 800 stone
  s.raw.prepare("INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, updated_at) VALUES (?, ?, 'building', 5000, 'builder', ?)").run(sh.gm.id, sh.gm.character, T0);  // PIN MOVED (CRAFT3): Carpentry's and Masonry's are Building's track
  const b = await s.fund(sh.gm, ANTICLERE.key, 'walls');
  assert.deepEqual([b.body.tier, b.body.builder, b.body.needs], [2, true, [['stone:cut', 720], ['ingot:iron', 200]]]);
});

test('SEAT2b WHAT MAY STAND: a palace\'s Gatehouse once its Walls stand at tier 3; a crown\'s at once; a work at its last tier refused (mutants: the gate\'s rule; the last tier)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid); s.hold(WAYREST, eo.gid);
  s.treasury(sh.gid, 50_000); s.treasury(eo.gid, 50_000);
  assert.equal((await s.fund(eo.gm, WAYREST.key, 'gatehouse')).status, 200, 'a crown\'s gate');
  s.raw.prepare("INSERT INTO town_seat_forts (key, work, tier, at) VALUES (?, 'walls', 3, ?)").run(ANTICLERE.key, T0);
  assert.equal((await s.fund(sh.gm, ANTICLERE.key, 'walls')).body.error, 'fort-max');
  assert.equal((await s.fund(sh.gm, ANTICLERE.key, 'gatehouse')).status, 200, 'tier 3 Walls gain a gate of their own');
  s.raw.prepare("INSERT INTO town_seat_forts (key, work, tier, at) VALUES (?, 'shrine', 2, ?)").run(ANTICLERE.key, T0);
  assert.equal((await s.fund(sh.gm, ANTICLERE.key, 'shrine')).body.error, 'fort-max', 'a Shrine has two');
});

test('SEAT2b THE DROPS: a capture takes every work a tier down and a building project falls, its units back to the stockpile; a Fortifier\'s save keeps the Walls; a Season\'s end every work a tier down, a project still building (mutants: the drop; the units home; the Fortifier; the Season)', async (t) => {
  const s = await stood(t);
  const db = s.svc.env.DB;
  const put = (work, tier, building = null) => s.raw.prepare('INSERT INTO town_seat_forts (key, work, tier, building, at) VALUES (?, ?, ?, ?, ?)').run(ANTICLERE.key, work, tier, building, T0);
  put('walls', 2); put('shrine', 1); put('market', 0, 1);
  s.raw.prepare("INSERT INTO town_seat_fort_held (key, work, material, qty) VALUES (?, 'market', 'plank:oak', 120)").run(ANTICLERE.key);
  const tiers = () => Object.fromEntries(s.raw.prepare('SELECT work, tier, building FROM town_seat_forts WHERE key = ?').all(ANTICLERE.key).map((r) => [r.work, [r.tier, r.building]]));
  await db.batch(fortsCapturedStatements(db, ANTICLERE.key));
  assert.deepEqual(tiers(), { walls: [1, null], shrine: [0, null], market: [0, null] });
  assert.deepEqual(s.stockOf(ANTICLERE.key), { 'plank:oak': 120 }, 'the seat\'s units back in its stockpile');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_fort_held').get().n, 0, 'and none left in the fallen project');
  await db.batch(fortsCapturedStatements(db, ANTICLERE.key, { fortifier: true }));
  assert.deepEqual(tiers().walls, [1, null], 'the Fortifier\'s Walls kept');
  s.raw.prepare("UPDATE town_seat_forts SET tier = 3, building = NULL WHERE work = 'walls'").run();
  s.raw.prepare("UPDATE town_seat_forts SET building = 1 WHERE work = 'market'").run();
  await db.batch(fortsSeasonStatements(db));
  assert.deepEqual(tiers(), { walls: [2, null], shrine: [0, null], market: [0, 1] }, 'a Season\'s wear, the project kept');
});

test('SEAT2b SEAT WRITS: the holder posts a writ for its seat - delivered, its units go to the seat\'s stockpile and into its project, never the guild Stores; a pledged challenger\'s fills its Siege Camp for the week; a guild neither holding nor pledged, a material no work asks and another region refused (mutants: the destination; the camp; the pledge; the material)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  const dg = await s.guild('Doran', 'Daggers', 'DG');
  s.hold(ANTICLERE, sh.gid);
  s.treasury(sh.gid, 20_000); s.treasury(eo.gid, 20_000); s.treasury(dg.gid, 20_000);
  s.raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(W, eo.gid, ANTICLERE.region, ANTICLERE.key, 'x', T0);
  const env = s.svc.env;
  env.PROFESSIONS_OPEN = 'on';
  const post = async (g, o) => (await s.svc.call('/v1/writs/post', { character: g.gm.character, region: 21, material: 'stone:cut', units: 100, pay: 3, rid: rid(), ...o }, g.gm.secret)).body;
  assert.equal((await post(dg, { seat: ANTICLERE.key })).error, 'seat-not-pledged');
  assert.equal((await post(sh, { seat: ANTICLERE.key, material: 'ore:mithril', pay: 1 })).error, 'bad-material', 'no work asks it');
  assert.equal((await post(sh, { seat: ANTICLERE.key, region: 22 })).error, 'writ-elsewhere');
  const held = await post(sh, { seat: ANTICLERE.key });
  assert.equal(held.ok, true, JSON.stringify(held));
  assert.deepEqual([held.writ.seat, held.writ.camp, held.writ.room], [ANTICLERE.key, false, null]);
  const camp = await post(eo, { seat: ANTICLERE.key, material: 'plank:oak', pay: 1 });
  assert.deepEqual([camp.writ.seat, camp.writ.camp], [ANTICLERE.key, true]);
  // the holder's project, waiting on stone
  assert.equal((await s.fund(sh.gm, ANTICLERE.key, 'shrine')).status, 200);
  const carter = await s.svc.registered('Carter');
  s.raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'stone:cut', 'own', 500), (?, ?, 'plank:oak', 'own', 500)`).run(carter.id, carter.character, carter.id, carter.character);
  const supply = async (w, units) => (await s.svc.call('/v1/writs/supply', { character: carter.character, region: 21, writ: w.writ.id, units, rid: rid() }, carter.secret)).body;
  const a = await supply(held, 100);
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.equal(s.raw.prepare("SELECT qty FROM town_seat_fort_held WHERE key = ? AND work = 'shrine' AND material = 'stone:cut'").get(ANTICLERE.key)?.qty, 100,
    'moved in by the delivery itself, before any reader');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM guild_prof_stores WHERE guild_id = ?').get(sh.gid).n, 0, 'never the guild Stores');
  const f = await s.forts(sh.gm, ANTICLERE.key);
  assert.deepEqual(f.works.shrine.held, [['stone:cut', 100], ['metal:silver', 0]], 'into the Shrine at once');
  assert.deepEqual(s.stockOf(ANTICLERE.key), {}, 'the Shrine took all it asked');
  const b = await supply(camp, 60);
  assert.equal(b.ok, true, JSON.stringify(b));
  assert.deepEqual(s.raw.prepare('SELECT week, key, guild_id, material, qty FROM town_seat_camps').all().map((r) => [r.week, r.key, r.guild_id, r.material, r.qty]),
    [[W, ANTICLERE.key, eo.gid, 'plank:oak', 60]], 'the Oath\'s camp this week');
});

test('SEAT2b THE MARKET HALL: the holder\'s Tithe may stand a point higher a tier; an account listing at a board in its town may hold a quarter more listings a tier - not at another town\'s board (mutants: the cap\'s point; the town\'s board; the quarter)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid);
  const tithe = (pct) => s.svc.call('/v1/seats/tithe', { character: sh.gm.character, key: ANTICLERE.key, pct }, sh.gm.secret);
  assert.equal((await tithe(11)).body.error, 'bad-tithe', 'a palace\'s ten');
  s.raw.prepare("INSERT INTO town_seat_forts (key, work, tier, at) VALUES (?, 'market', 1, ?)").run(ANTICLERE.key, T0);
  assert.equal((await tithe(12)).body.error, 'bad-tithe');
  assert.deepEqual((await tithe(11)).body, { ok: true, tithe: 11 });
  const seller = await s.svc.registered('Selma');
  s.raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'ore:mithril', 'own', 4000)`).run(seller.id, seller.character);
  s.raw.prepare('INSERT INTO marks (account, balance) VALUES (?, 100000)').run(seller.id);
  const list = async (board) => (await s.svc.call('/v1/market/list', { character: seller.character, kind: 'material', material: 'ore:mithril', region: 21, units: 1, price: 5, hubs: { 21: [402, 151] }, rid: rid(), ...(board ? { board } : {}) }, seller.secret)).body;
  for (let i = 0; i < 30; i++) assert.equal((await list([470, 160])).ok, true, `listing ${i}`);
  // the market's own window: posts an hour - so the clock moves on between batches
  s.at(T0 + 3 * 3600);
  assert.equal((await list([470, 160])).error, 'market-listings-max', 'another town\'s board: thirty');
  assert.equal((await list([402, 160])).error, 'market-listings-max', 'a board in Anticlere\'s column, another row: thirty');
  for (let i = 0; i < 7; i++) assert.equal((await list([402, 151])).ok, true, `Anticlere's board, listing ${31 + i}`);
  assert.equal((await list([402, 151])).error, 'market-listings-max', 'thirty-seven at a tier-1 Market Hall');
});

test('SEAT2b A SEAT WRIT\'S INFLUENCE (4.2): a 7-day member of the posting guild delivering its own units raises its guild\'s week at the seat by their value (never the pay); its bought units count at Tribute\'s rate; an outsider earns the pay alone and binds no war; the same delivery once (mutants: the value; the source; the guild; the bought)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid);
  s.treasury(sh.gid, 20_000);
  const post = async (o) => (await s.svc.call('/v1/writs/post', { character: sh.gm.character, region: 21, material: 'stone:cut', units: 100, pay: 3, rid: rid(), seat: ANTICLERE.key, ...o }, sh.gm.secret)).body;
  const w = await post({});
  assert.equal(w.ok, true, JSON.stringify(w));
  const mason = await s.member(sh, 'Masoner', 2);   // a Member (Officers deliver to none of their guild's writs - AUDIT 31 S6)
  s.raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'stone:cut', 'own', 30), (?, ?, 'stone:cut', 'bought', 10)`).run(mason.id, mason.character, mason.id, mason.character);
  const supply = async (who, units, r = rid()) => (await s.svc.call('/v1/writs/supply', { character: who.character, region: 21, writ: w.writ.id, units, rid: r }, who.secret)).body;
  const r1 = await supply(mason, 40, 'fill-masoner-01');
  assert.equal(r1.ok, true, JSON.stringify(r1));
  const rows = () => s.raw.prepare("SELECT account, source, amount FROM town_seat_influence WHERE key = ? ORDER BY source").all(ANTICLERE.key).map((x) => [x.account, x.source, x.amount]);
  assert.deepEqual(rows(), [[mason.id, 'bought', 10 * 2], [mason.id, 'writ', 30 * 2]], 'Cut Stone at 2 a unit: its own 30, its bought 10 (spent first)');
  assert.equal((await supply(mason, 40, 'fill-masoner-01')).repeat, true);
  assert.equal(rows().length, 2, 'the same delivery once');
  // an outsider: the pay, no influence
  const carter = await s.svc.registered('Carter');
  s.raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'stone:cut', 'own', 20)`).run(carter.id, carter.character);
  assert.equal((await supply(carter, 20)).ok, true);
  assert.equal(rows().length, 2, 'an outsider\'s delivery raises nobody\'s war');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_binds WHERE account = ?').get(carter.id).n, 0);
  // another guild's member: the pay, and nothing to the posting guild's war
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  const rival = await s.member(eo, 'Rivalmason', 2);
  s.raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'stone:cut', 'own', 20)`).run(rival.id, rival.character);
  assert.equal((await supply(rival, 10)).ok, true);
  assert.equal(rows().length, 2, 'a rival guild\'s member raises the Silver Hand nothing');
  // the standings: the member's 60 own, the bought 20 Marks at Tribute's rate (1 a 10, inside its cap)
  const st = (await s.svc.call('/v1/seats/standings', { key: ANTICLERE.key, character: sh.gm.character }, sh.gm.secret)).body;
  const mine = st.standings.find((x) => x.guild.id === sh.gid);
  assert.equal(mine.influence, 60 + 2, JSON.stringify(mine));
});

test('SEAT2b ASKED AGAIN: a work already building is refused before the hour\'s rate is asked - five refusals spend none of it, and another work begins after them (mutants: the building check)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid);
  s.treasury(sh.gid, 20_000);
  assert.equal((await s.fund(sh.gm, ANTICLERE.key, 'walls')).status, 200);
  for (let i = 0; i < 5; i++) assert.equal((await s.fund(sh.gm, ANTICLERE.key, 'walls')).body.error, 'fort-building', `ask ${i + 2}`);
  assert.equal((await s.fund(sh.gm, ANTICLERE.key, 'shrine')).status, 200, 'the rate untouched by the refusals');
});

test('SEAT2b THE FORTIFIER\'S SAVE: a Fortifier on the defending roster saves standing Walls, once a Season a seat - not one on the attackers\' roster, not Walls at nought, not twice in a Season; the capture\'s hook asks it, and the Turning spends the camps and wears the works (mutants: the side; the Season; the bare Walls; the hooks)', async (t) => {
  const s = await stood(t);
  const db = s.svc.env.DB;
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  const roster = (who, gid, side) => s.raw.prepare('INSERT INTO town_seat_rosters (week, key, account, char_id, guild_id, side, at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(W, ANTICLERE.key, who.id, who.character, gid, side, T0);
  const fortifier = (who) => s.raw.prepare("INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, 'building', 100000, 'builder', 'fortifier', ?)").run(who.id, who.character, T0);  // PIN MOVED (CRAFT3): Carpentry's and Masonry's are Building's track
  fortifier(eo.gm);
  roster(eo.gm, eo.gid, 'attack');
  s.raw.prepare("INSERT INTO town_seat_forts (key, work, tier, at) VALUES (?, 'walls', 2, ?)").run(ANTICLERE.key, T0);
  assert.equal(await fortifierAt(db, W, ANTICLERE.key, T0, W), null, 'an attacker\'s Fortifier saves nothing');
  fortifier(sh.gm);
  roster(sh.gm, sh.gid, 'defend');
  assert.equal(await fortifierAt(db, W, ANTICLERE.key, T0, W), sh.gm.id, 'the defenders\' Fortifier');
  s.raw.prepare('INSERT INTO town_seat_fortifier (season, key, account, at) VALUES (?, ?, ?, ?)').run(W, ANTICLERE.key, sh.gm.id, T0);
  assert.equal(await fortifierAt(db, W, ANTICLERE.key, T0, W), null, 'once a Season');
  assert.equal(await fortifierAt(db, W, ANTICLERE.key, T0, W + 13), sh.gm.id, 'the next Season\'s own');
  s.raw.prepare("UPDATE town_seat_forts SET tier = 0 WHERE work = 'walls'").run();
  assert.equal(await fortifierAt(db, W, ANTICLERE.key, T0, W + 13), null, 'no Walls standing, nothing to save');
  const src = (f) => readFileSync(new URL(`../server-account/src/${f}`, import.meta.url), 'utf8');
  assert.match(src('seatSiege.js'), /const fortifier = await fortifierAt\(db, W, K, nowS, seasonWeek\);\n\s*stmts\.push\(\.\.\.fortsCaptureWithSave\(db, K, \{ week: W, nowS, seasonWeek, fortifier, history \}\)\);/, 'the capture asks it');
  assert.match(src('seatTurning.js'), /stmts\.push\(\.\.\.\(await campsSpent\(db, week, next, plan\.rights, \(k\) => registry\.get\(k\)\?\.tier \?\? 'palace'\)\)\);/, 'the Turning spends the camps');
  assert.match(src('seatTurning.js'), /if \(!wipe\) stmts\.push\(\.\.\.fortsSeasonStatements\(db\)\);/, 'a Season\'s end wears the works');
});

test('SEAT2b THE CAMPS SPENT: a camp whose guild won the Right sends its Ram Kits to next week\'s battle where a Gatehouse stands (a crown\'s own, or one raised); a palace with none, and a camp that won nothing, send none; every camp of the week emptied (mutants: the gate; the Right; the emptying)', async (t) => {
  const s = await stood(t);
  const db = s.svc.env.DB;
  const camp = (key, g, material, qty) => s.raw.prepare('INSERT INTO town_seat_camps (week, key, guild_id, material, qty) VALUES (?, ?, ?, ?, ?)').run(W, key, g, material, qty);
  const battle = (key, attacker) => s.raw.prepare("INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, at) VALUES (?, ?, 'siege', ?, ?, 'gx', ?, ?, ?)")
    .run(W + 1, key, key === WAYREST.key ? 'crown' : 'palace', attacker, T0 + 7 * DAY, T0 + 7 * DAY + 7200, T0);
  camp(WAYREST.key, 'ga', 'work:ram', 2); camp(WAYREST.key, 'ga', 'plank:oak', 50);
  camp(ANTICLERE.key, 'gb', 'work:ram', 1);
  camp(WAYREST.key, 'gc', 'work:ram', 3);
  battle(WAYREST.key, 'ga'); battle(ANTICLERE.key, 'gb');
  const tierOf = (k) => (k === WAYREST.key ? 'crown' : 'palace');
  const rights = [{ key: WAYREST.key, guild: 'ga' }, { key: ANTICLERE.key, guild: 'gb' }];
  const rams = () => Object.fromEntries(s.raw.prepare('SELECT key, rams FROM town_seat_battles WHERE week = ?').all(W + 1).map((r) => [r.key, r.rams]));
  await db.batch(await campsSpent(db, W, W + 1, rights, tierOf));
  assert.deepEqual(rams(), { [WAYREST.key]: 2, [ANTICLERE.key]: 0 }, 'the crown\'s gate takes the winner\'s two; a palace without a gate none; the loser\'s three burnt');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_camps WHERE week = ?').get(W).n, 0, 'every camp emptied');
  camp(ANTICLERE.key, 'gb', 'work:ram', 1);
  s.raw.prepare("INSERT INTO town_seat_forts (key, work, tier, at) VALUES (?, 'gatehouse', 1, ?)").run(ANTICLERE.key, T0);
  await db.batch(await campsSpent(db, W, W + 1, rights, tierOf));
  assert.equal(rams()[ANTICLERE.key], 1, 'a palace\'s raised Gatehouse takes its Ram');
});

test('SEAT2b A SEAT WRIT TAKES NO GUILD ROOM: a seat writ\'s open units are not reserved against the guild Stores - a guild writ for the last room still posts beside it (mutants: the reservation)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid);
  s.treasury(sh.gid, 20_000);
  s.raw.prepare("INSERT INTO guild_prof_stores (guild_id, material, dep_player, dep_char, qty, moved_by, moved_at) VALUES (?, 'stone:cut', ?, ?, 49950, 'x', ?)").run(sh.gid, sh.gm.id, sh.gm.character, T0);
  const post = async (o) => (await s.svc.call('/v1/writs/post', { character: sh.gm.character, region: 21, material: 'stone:cut', units: 100, pay: 1, rid: rid(), ...o }, sh.gm.secret)).body;
  const seat = await post({ seat: ANTICLERE.key });
  assert.equal(seat.ok, true, JSON.stringify(seat));
  const guild = await post({ units: 50 });
  assert.equal(guild.ok, true, `the Stores' last fifty: ${JSON.stringify(guild)}`);
});
