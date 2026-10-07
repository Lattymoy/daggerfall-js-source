// AUDIT SEATS-2 (2026-10-02, Mac: "We need to do a comprehensive audit on everything and finish the not done") - THE
// SEATS' FORTIFICATIONS AND SEAT WRITS IN THE ACCOUNT SERVICE, THE AUDITED FINDINGS FIXED: a capture that ignored a
// project whose day had come (S1); a crown's Tithe past 15 a 500 (S2); a Season's wear a project under way erased, and the
// Siege Camps' Rams read before it (S4); a lapsed Charter's project building on for nobody (S5); a seat writ
// feeding a seat its guild no longer holds or is pledged to (S6). Driven through the real Worker over node:sqlite with
// every migration applied (test/accountDb.mjs), and the statements the batches carry where a Worker path cannot reach
// the state (a Season's wear over a delivered project). bible/11-Multiplayer/Seats-Arc.md 4.2, 7.2, 7.5, 7.7, 9.1, 16;
// server-account/src/seatForts.js, seatSiege.js, seatTurning.js, townSeats.js, writs.js; migration 0051.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from './accountDb.mjs';
import { seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, siegeStartMs, TITHE_CAP } from '../src/net/townSeatLaw.js';
import { marketHallTitheCap, fortMaxTier } from '../src/net/fortLaw.js';
import { _b64url } from '../src/net/identityToken.js';
import { SIEGE_RECEIPT_V, SIEGE_RECEIPT_TTL_S } from '../src/net/siegeReceipt.js';
import { fortsSeasonStatements, campsWorn } from '../server-account/src/seatForts.js';

const { subtle } = globalThis.crypto;
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const ASHFIELD = { key: 3022, name: 'Ashfield', region: 21, tier: 'palace', pixel: [470, 160] };
const ALCAIRE = { key: 3034, name: 'Alcaire Keep', region: 34, tier: 'palace', pixel: [520, 130] };
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const SEATS = [ANTICLERE, ASHFIELD, ALCAIRE, WAYREST];
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);   // T0 is a Friday morning: the Muster of week W
const turning = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000);
const AFTER = (w) => turning(w) + 3 * 3600;
const START = Math.floor(siegeStartMs(W + 1, 0, 20) / 1000);   // the default window, Wednesday 20:00 of W+1
const enc = new TextEncoder();
let _rid = 0;
const rid = () => `as2-${String(++_rid).padStart(6, '0')}`;

/** A siege receipt minted as the relay mints one (test/audit_seats_service.test.js's mint). */
async function mintSiege(claims, key, nowS) {
  const c = { ...claims, i: nowS, e: nowS + SIEGE_RECEIPT_TTL_S };
  const body = _b64url.encode(enc.encode(JSON.stringify(c)));
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, key, enc.encode(`${SIEGE_RECEIPT_V}.${body}`)));
  return `${SIEGE_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

async function stood(t, extra = {}) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Devra', ...extra });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of SEATS) for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const guild = async (handle, name, tag) => {
    const gm = await svc.registered(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
    return { gm, gid };
  };
  const member = async (g, handle, rank = 2, week = W) => {
    const m = await svc.registered(handle, { renown: 5 });
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(m.id, m.character, g.gid, rank, handle, T0 - 30 * DAY);
    raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, m.id, g.gid, m.character, T0);
    return m;
  };
  let seed = 0;
  const treasury = (gid, n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-g-${++seed}`);
  const earn = async (gid, seat, amount, week = W) => {
    while (amount > 0) {
      const a = await svc.guest();
      const n = Math.min(2000, amount);
      raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, a.id, gid, 'c', T0);
      raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
        VALUES (?, ?, ?, ?, 'c', 'watch', ?, ?, 1, ?, ?)`).run(week, seat.key, gid, a.id, n, seat.region, `t:${a.id}:${week}:${seat.key}`, now);
      amount -= n;
    }
  };
  const pledge = (gid, seat, week = W) => raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(week, gid, seat.region, seat.key, 'x', T0);
  const hold = (seat, gid, o = {}) => raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`).run(seat.key, gid, seat.region, seat.tier, o.since ?? W - 2, o.standing ?? 50, T0 - 14 * DAY, o.tithe ?? 6, o.owed ?? 0);
  const holdOf = (seat = ANTICLERE) => { const h = raw.prepare('SELECT guild_id FROM town_seat_holds WHERE key = ?').get(seat.key); return h ? h.guild_id : null; };
  /** A work's row put by hand: `[tier, building]`, a project's day, its starter's marks and guild, and what it holds. */
  const fort = (seat, work, tier, building = null, o = {}) => {
    raw.prepare('INSERT INTO town_seat_forts (key, work, tier, building, guild_id, builder, siegewright, stands_at, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(seat.key, work, tier, building, o.guild ?? null, o.builder ? 1 : 0, o.siegewright ? 1 : 0, o.standsAt ?? null, T0);
    for (const [m, q] of Object.entries(o.held ?? {})) raw.prepare('INSERT INTO town_seat_fort_held (key, work, material, qty) VALUES (?, ?, ?, ?)').run(seat.key, work, m, q);
  };
  const works = (seat = ANTICLERE) => Object.fromEntries(raw.prepare('SELECT work, tier, building FROM town_seat_forts WHERE key = ? ORDER BY work').all(seat.key).map((r) => [r.work, [r.tier, r.building]]));
  const rowOf = (seat, work) => ({ ...raw.prepare('SELECT tier, building, stands_at, builder, siegewright, guild_id FROM town_seat_forts WHERE key = ? AND work = ?').get(seat.key, work) });
  const heldOf = (seat = ANTICLERE) => raw.prepare('SELECT work, material, qty FROM town_seat_fort_held WHERE key = ? ORDER BY work, material').all(seat.key).map((r) => [r.work, r.material, r.qty]);
  const stock = (seat, material, qty) => raw.prepare(`INSERT INTO town_seat_stockpile (key, material, qty) VALUES (?, ?, ?)
    ON CONFLICT (key, material) DO UPDATE SET qty = town_seat_stockpile.qty + excluded.qty`).run(seat.key, material, qty);
  const stockOf = (seat = ANTICLERE) => Object.fromEntries(raw.prepare('SELECT material, qty FROM town_seat_stockpile WHERE key = ? AND qty > 0 ORDER BY material').all(seat.key).map((r) => [r.material, r.qty]));
  const history = (kind, seat = ANTICLERE) => raw.prepare('SELECT data FROM town_seat_history WHERE key = ? AND kind = ? ORDER BY seq').all(seat.key, kind).map((r) => JSON.parse(r.data));
  const kinds = (seat = ANTICLERE) => raw.prepare('SELECT kind FROM town_seat_history WHERE key = ? ORDER BY seq').all(seat.key).map((r) => r.kind);
  const call = (path, body, who) => svc.call(path, body, who.secret);
  const list = (who) => call('/v1/seats/list', {}, who);
  const battle = (seat = ANTICLERE, week = W + 1) => { const b = raw.prepare('SELECT * FROM town_seat_battles WHERE week = ? AND key = ?').get(week, seat.key); return b ? { ...b } : null; };
  const claim = async (who, o = {}) => call('/v1/seats/siege/claim', {
    receipt: await mintSiege({ s: who.id, sk: ANTICLERE.key, sw: W + 1, sd: 'attack', r: 'attack', a: 1, h: 1, th: 0, ...o }, svc.gateKey, now), character: who.character,
  }, who);
  return {
    svc, raw, guild, member, treasury, earn, pledge, hold, holdOf, fort, works, rowOf, heldOf, stock, stockOf, history, kinds, call, list, battle, claim,
    setNow: (n) => { now = n; }, getNow: () => now,
  };
}

/** THE SIEGE OF ANTICLERE (test/audit_seats_service.test.js's): the Silver Hand holds it, the Ebon Oath wins a Right at
 *  W's Turning, Wednesday 20:00 of W+1; an attacker and a defender signed. */
async function siegeWeek(s) {
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid);
  s.treasury(sh.gid, 10000);
  await s.earn(sh.gid, ANTICLERE, 500);
  s.pledge(eo.gid, ANTICLERE);
  await s.earn(eo.gid, ANTICLERE, 7000);
  const a1 = await s.member(eo, 'Arden'), d1 = await s.member(sh, 'Dorran');
  s.setNow(AFTER(W));
  await s.list(sh.gm);
  assert.equal(s.battle()?.state, 'scheduled', 'the siege placed');
  for (const who of [a1, d1]) assert.equal((await s.call('/v1/seats/siege/sign', { character: who.character, key: ANTICLERE.key }, who)).status, 200);
  return { sh, eo, a1, d1 };
}

// ─── S1 ──────────────────────────────────────────────────────────────

test('AUDIT SEATS-2 S1: A CAPTURE RAISES THE PROJECTS WHOSE DAY HAS COME BEFORE IT DROPS THE WORKS - Barracks at 1 raising 2, due before the siege\'s end, stand at 2 and go down to 1 (not 0), their materials spent (not handed to the new holder\'s stockpile); bare Walls whose first tier was due are Walls a defending Fortifier saves; a project still waiting falls, its units home; the Chronicle says what stood (mutants: the due before the drop; the Fortifier\'s read; the due rule; the held spent; the raised row)', async (t) => {
  const s = await stood(t);
  const { sh, eo, a1, d1 } = await siegeWeek(s);
  // the defender a Fortifier (Masonry 100), on the defending roster
  s.raw.prepare("INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, 'building', 100000, 'builder', 'fortifier', ?)").run(d1.id, d1.character, T0);   // PIN MOVED (CRAFT3): Masonry's choices are Building's track's
  // after the Turning (its own reads raise what is due by then): three projects, two due before the claim
  const due = START + 1000;
  s.fort(ANTICLERE, 'walls', 0, 1, { guild: sh.gid, standsAt: due, held: { 'stone:cut': 400, 'plank:oak': 100 } });
  s.fort(ANTICLERE, 'barracks', 1, 2, { guild: sh.gid, standsAt: due, held: { 'plank:oak': 600, 'ingot:steel': 200 } });
  s.fort(ANTICLERE, 'shrine', 0, 1, { guild: sh.gid, standsAt: START + 9 * DAY, held: { 'stone:cut': 100 } });
  s.setNow(START + 1500);
  const r = await s.claim(a1);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.result, r.body.applied], ['attack', true]);
  assert.equal(s.holdOf(), eo.gid, 'the seat taken');
  assert.deepEqual(s.works(), { barracks: [1, null], shrine: [0, null], walls: [1, null] },
    'the Barracks\' second tier stood and went down a tier; the Walls\' first stood and the Fortifier kept it; the waiting Shrine fell');
  assert.deepEqual(s.stockOf(), { 'stone:cut': 100 }, 'the Shrine\'s units home - the stood projects\' spent into their works');
  assert.deepEqual(s.heldOf(), []);
  assert.deepEqual(s.history('fort-raised'), [{ work: 'barracks', tier: 2 }, { work: 'walls', tier: 1 }]);
  assert.equal(s.history('walls-kept').length, 1, 'the Fortifier\'s save written');
  const k = s.kinds();
  assert.ok(k.indexOf('fort-raised') < k.indexOf('siege-taken'), 'raised, then taken');
  assert.equal(s.rowOf(ANTICLERE, 'barracks').guild_id, null);
});

// ─── S2 ──────────────────────────────────────────────────────────────

test('AUDIT SEATS-2 S2: A CROWN\'S TITHE PAST 15 - a crown with a tier-3 Market Hall sets 18, its board\'s cap, and the write stands (it was a 500: the column\'s CHECK said 15); 19 is refused in words; the CHECK\'s ceiling is the law\'s highest cap (mutants: the CHECK\'s 18)', async (t) => {
  assert.equal(marketHallTitheCap(TITHE_CAP.crown, fortMaxTier('market')), 18, 'a crown\'s 15 and a tier-3 Market Hall\'s 3');
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(WAYREST, sh.gid);
  s.fort(WAYREST, 'market', 3);
  const tithe = (pct) => s.call('/v1/seats/tithe', { character: sh.gm.character, key: WAYREST.key, pct }, sh.gm);
  assert.equal((await tithe(19)).body.error, 'bad-tithe');
  const r = await tithe(18);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, { ok: true, tithe: 18 });
  assert.equal(s.raw.prepare('SELECT tithe FROM town_seat_holds WHERE key = ?').get(WAYREST.key).tithe, 18);
});

// ─── S4 ──────────────────────────────────────────────────────────────

test('AUDIT SEATS-2 S4: A SEASON\'S WEAR TAKES A PROJECT DOWN WITH ITS WORK - Walls at 2 raising 3 (delivered, waiting) wear to 1 raising 2, what they held home to the stockpile and their delivery reckoned again, and rise to 2 (they rose to 3 before - tier 2 skipped, the wear erased); a project at a work standing at nought keeps building and holding (mutants: the building lowered; the held home; the delivery reckoned again; the work at nought)', async (t) => {
  const s = await stood(t);
  const db = s.svc.env.DB;
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid);
  s.fort(ANTICLERE, 'walls', 2, 3, { guild: sh.gid, standsAt: T0 + 3 * DAY, held: { 'stone:cut': 1600, 'ingot:steel': 200 } });
  s.fort(ANTICLERE, 'market', 0, 1, { guild: sh.gid, held: { 'plank:oak': 120 } });
  s.fort(ANTICLERE, 'forge', 1);
  await db.batch(fortsSeasonStatements(db));
  assert.deepEqual(s.works(), { forge: [0, null], market: [0, 1], walls: [1, 2] });
  assert.equal(s.rowOf(ANTICLERE, 'walls').stands_at, null, 'its delivery reckoned again');
  assert.deepEqual(s.stockOf(), { 'ingot:steel': 200, 'stone:cut': 1600 }, 'the Walls\' third tier\'s units home');
  assert.deepEqual(s.heldOf(), [['market', 'plank:oak', 120]], 'the Market Hall\'s first tier still holding');
  // the lowered project re-supplied from the stockpile: tier 2's needs (stone and iron), its four days from there
  const forts = async () => (await s.call('/v1/seats/forts', { key: ANTICLERE.key }, sh.gm)).body.works;
  s.setNow(T0 + 3600);
  let w = (await forts()).walls;
  assert.deepEqual([w.tier, w.building, w.held, w.standsAt], [1, 2, [['stone:cut', 800], ['ingot:iron', 0]], null]);
  s.stock(ANTICLERE, 'ingot:iron', 200);
  w = (await forts()).walls;
  assert.equal(w.standsAt, T0 + 3600 + 4 * DAY);
  s.setNow(T0 + 3600 + 4 * DAY);
  w = (await forts()).walls;
  assert.deepEqual([w.tier, w.building], [2, null], 'it rises to 2 - never 1 to 3');
  assert.deepEqual(s.stockOf(), { 'ingot:steel': 200, 'stone:cut': 700 }, 'what tier 2 did not ask stays the seat\'s (the Market Hall took its 100 stone)');
});

test('AUDIT SEATS-2 S4: THE TURNING THAT ENDS A SEASON - a project whose day came before it stands, then wears with its work; a project under way goes down with its work; the Siege Camp\'s Ram is burnt where the wear left a palace no Gatehouse (campsSpent read the gate before the wear, and a gate standing again before the battle let it through); a crown\'s battle and a palace whose gate still stands keep theirs (mutants: the Turning\'s camps worn; the crown\'s gate; the standing gate)', async (t) => {
  // the camps' Rams after the wear, read directly
  const d = await stood(t);
  const db = d.svc.env.DB;
  const battle = (seat, rams) => d.raw.prepare("INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, rams, at) VALUES (?, ?, 'siege', ?, 'ga', 'gx', ?, ?, ?, ?)")
    .run(W + 1, seat.key, seat.tier, T0 + 7 * DAY, T0 + 7 * DAY + 7200, rams, T0);
  battle(ANTICLERE, 1); battle(ASHFIELD, 1); battle(WAYREST, 2);
  d.fort(ANTICLERE, 'gatehouse', 0, 1); d.fort(ASHFIELD, 'gatehouse', 1);
  await db.batch([campsWorn(db, W + 1)]);
  assert.deepEqual(Object.fromEntries(d.raw.prepare('SELECT key, rams FROM town_seat_battles').all().map((r) => [r.key, r.rams])),
    { [ANTICLERE.key]: 0, [ASHFIELD.key]: 1, [WAYREST.key]: 2 }, 'no gate standing: burnt; a gate, or a crown\'s: kept');
  // the Turning that ends Season 1 (W-7..W): the Oath wins its Right at Anticlere, its camp holds a Ram Kit
  const s = await stood(t, { SEASON_ZERO_WEEK: String(W - 11) });
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid);
  s.treasury(sh.gid, 10000);
  await s.earn(sh.gid, ANTICLERE, 500);
  s.pledge(eo.gid, ANTICLERE);
  await s.earn(eo.gid, ANTICLERE, 7000);
  s.fort(ANTICLERE, 'walls', 3);
  s.fort(ANTICLERE, 'gatehouse', 1, 2, { guild: sh.gid, held: { 'stone:cut': 600 } });
  s.fort(ANTICLERE, 'shrine', 1, 2, { guild: sh.gid, standsAt: turning(W) - 60, held: { 'stone:cut': 200, 'gem:pearl': 10 } });
  s.raw.prepare("INSERT INTO town_seat_camps (week, key, guild_id, material, qty) VALUES (?, ?, ?, 'work:ram', 1)").run(W, ANTICLERE.key, eo.gid);
  s.setNow(AFTER(W));
  await s.list(sh.gm);
  const b = s.battle();
  assert.deepEqual([b?.kind, b?.attacker], ['siege', eo.gid], 'the Right won and its siege placed');
  assert.deepEqual(s.works(), { gatehouse: [0, 1], shrine: [1, null], walls: [2, null] }, 'the Season\'s wear: the Shrine stood at 2 and wore to 1, the Gatehouse\'s project down with it');
  assert.deepEqual(s.history('fort-raised'), [{ work: 'shrine', tier: 2 }]);
  assert.deepEqual(s.stockOf(), { 'stone:cut': 600 });
  assert.equal(b.rams, 0, 'no Ram for a gate the same Turning wore away');
});

// ─── S5 ──────────────────────────────────────────────────────────────

test('AUDIT SEATS-2 S5: A CHARTER RELINQUISHED - its building project falls, what it held home to the stockpile, its starter\'s marks and guild cleared, the standing tier kept; a project due by then stands instead; a relinquishing that moved nothing (another guild\'s Guildmaster) drops nothing (mutants: the relinquish\'s fall; the unheld guard; the due first)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid);
  s.fort(ANTICLERE, 'walls', 1, 2, { guild: sh.gid, builder: true, siegewright: true, held: { 'stone:cut': 500 } });
  s.fort(ANTICLERE, 'shrine', 0, 1, { guild: sh.gid, standsAt: T0 + 100, held: { 'stone:cut': 100, 'metal:silver': 20 } });
  const relinquish = (g) => s.call('/v1/seats/relinquish', { character: g.gm.character, key: ANTICLERE.key }, g.gm);
  assert.equal((await relinquish(eo)).body.error, 'seat-not-held');
  assert.deepEqual(s.works(), { shrine: [0, 1], walls: [1, 2] }, 'nothing fell - the Charter is still the Hand\'s');
  assert.equal(s.heldOf().length, 3);
  s.setNow(T0 + 200);   // the Shrine's day come
  assert.deepEqual((await relinquish(sh)).body, { ok: true });
  assert.equal(s.holdOf(), null);
  assert.deepEqual(s.rowOf(ANTICLERE, 'walls'), { tier: 1, building: null, stands_at: null, builder: 0, siegewright: 0, guild_id: null }, 'the project fell, the tier stays');
  assert.deepEqual(s.works().shrine, [1, null], 'the due Shrine stood');
  assert.deepEqual(s.stockOf(), { 'stone:cut': 500 }, 'the Walls\' units home, the Shrine\'s spent');
  assert.deepEqual(s.heldOf(), []);
  assert.deepEqual(s.history('fort-raised'), [{ work: 'shrine', tier: 1 }]);
});

test('AUDIT SEATS-2 S5: A CHARTER LAPSED AT THE TURNING - Neglect\'s second short week, and a seat the registry no longer confirms: each seat\'s building project falls, its units home; a Charter that stands keeps its project building (mutants: the Neglect lapse\'s fall; the unregistered lapse\'s fall)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  const dg = await s.guild('Doran', 'Daggers', 'DG');
  s.hold(ANTICLERE, sh.gid, { owed: 2500 });   // a week in Neglect already, and a treasury of nothing: lapsed
  s.hold(ALCAIRE, eo.gid);
  s.treasury(eo.gid, 10000);
  s.hold(ASHFIELD, dg.gid);
  s.treasury(dg.gid, 10000);
  s.raw.prepare("DELETE FROM world_witness WHERE kind = 'seat' AND key = ? AND rowid IN (SELECT rowid FROM world_witness WHERE kind = 'seat' AND key = ? LIMIT 1)").run(String(ALCAIRE.key), String(ALCAIRE.key));
  for (const [seat, g] of [[ANTICLERE, sh], [ALCAIRE, eo], [ASHFIELD, dg]]) s.fort(seat, 'walls', 1, 2, { guild: g.gid, held: { 'stone:cut': 300 } });
  s.setNow(AFTER(W));
  await s.list(sh.gm);
  assert.deepEqual([s.holdOf(ANTICLERE), s.holdOf(ALCAIRE), s.holdOf(ASHFIELD)], [null, null, dg.gid], 'two lapsed, one stands');
  assert.equal(s.history('lapse').length, 1);
  assert.equal(s.history('unregistered', ALCAIRE).length, 1);
  for (const seat of [ANTICLERE, ALCAIRE]) {
    assert.deepEqual([s.works(seat).walls, s.stockOf(seat), s.heldOf(seat)], [[1, null], { 'stone:cut': 300 }, []], `${seat.name}'s project fell`);
  }
  assert.deepEqual([s.works(ASHFIELD).walls, s.heldOf(ASHFIELD)], [[1, 2], [['walls', 'stone:cut', 300]]], 'the held Charter\'s project builds on');
});

test('AUDIT SEATS-2 S5: A CHARTER STRUCK, AND ONE A REVOLT TOOK BY ITS RECEIPT - each building project falls with it, its units home (mutants: the strike\'s fall; the revolt\'s fall)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const dev = await s.svc.registered('Devra');
  s.hold(WAYREST, sh.gid);
  s.fort(WAYREST, 'gatehouse', 1, 2, { guild: sh.gid, held: { 'ingot:steel': 50 } });
  assert.equal((await s.call('/v1/seats/strike', { key: WAYREST.key }, dev)).status, 200);
  assert.deepEqual([s.holdOf(WAYREST), s.works(WAYREST).gatehouse, s.stockOf(WAYREST), s.heldOf(WAYREST)], [null, [1, null], { 'ingot:steel': 50 }, []]);
  // a revolt (seat2b_revolt_service.test.js's week): Standing nought, the upkeep unpaid - the town rises at W+1
  s.hold(ANTICLERE, sh.gid, { standing: 0, tithe: 0 });
  const d1 = await s.member(sh, 'Dorran');
  s.setNow(AFTER(W));
  await s.list(sh.gm);
  assert.equal(s.battle()?.kind, 'revolt');
  s.fort(ANTICLERE, 'shrine', 0, 1, { guild: sh.gid, held: { 'stone:cut': 80 } });
  s.setNow(START + 3600);
  const r = await s.claim(d1, { sd: 'defend', r: 'attack', a: 0, h: 0 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(s.holdOf(), null, 'the revolt stood: the Charter lapsed');
  assert.deepEqual([s.works().shrine, s.stockOf(), s.heldOf()], [[0, null], { 'stone:cut': 80 }, []]);
});

// ─── S6 ──────────────────────────────────────────────────────────────

test('AUDIT SEATS-2 S6: A SEAT WRIT FEEDS ONLY A SEAT ITS GUILD STILL HAS A CLAIM ON - the Hand\'s stockpile writ refused once the Charter is another\'s (\'seat-not-held\'), the Oath\'s Siege Camp writ refused in a week it has not pledged the seat (\'seat-not-pledged\') and delivered once it has; a refusal moves, mints and burns nothing; a seat lost between the read and the write refused the same (mutants: the holder\'s check; the pledge\'s check; the write\'s holder; the write\'s pledge; the word after a failed write)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid);
  s.treasury(sh.gid, 20_000); s.treasury(eo.gid, 20_000);
  s.pledge(eo.gid, ANTICLERE);
  const post = async (g, o) => (await s.call('/v1/writs/post', { character: g.gm.character, region: 21, material: 'stone:cut', units: 100, pay: 3, rid: rid(), seat: ANTICLERE.key, ...o }, g.gm)).body;
  const held = await post(sh);
  const camp = await post(eo, { material: 'plank:oak', pay: 1 });
  assert.deepEqual([held.writ?.camp, camp.writ?.camp], [false, true], JSON.stringify([held, camp]));
  const carter = await s.svc.registered('Carter');
  s.raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, 'stone:cut', 'own', 500), (?, ?, 'plank:oak', 'own', 500)`).run(carter.id, carter.character, carter.id, carter.character);
  const supply = async (w, units) => (await s.call('/v1/writs/supply', { character: carter.character, region: 21, writ: w.writ.id, units, rid: rid() }, carter)).body;
  const stores = () => s.raw.prepare('SELECT material, qty FROM prof_stores WHERE player = ? ORDER BY material').all(carter.id).map((r) => [r.material, r.qty]);
  const lines = () => s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind IN ('writ-pay', 'market-tax')").get().n;
  const left = (w) => s.raw.prepare('SELECT left_units FROM guild_writs WHERE id = ?').get(w.writ.id).left_units;
  // the Charter the Oath's now (a capture): the Hand's stockpile writ feeds a seat it no longer holds
  s.raw.prepare('UPDATE town_seat_holds SET guild_id = ? WHERE key = ?').run(eo.gid, ANTICLERE.key);
  assert.equal((await supply(held, 50)).error, 'seat-not-held');
  assert.deepEqual([stores(), lines(), left(held), s.stockOf()], [[['plank:oak', 500], ['stone:cut', 500]], 0, 100, {}], 'nothing moved, minted or burnt');
  s.raw.prepare('UPDATE town_seat_holds SET guild_id = ? WHERE key = ?').run(sh.gid, ANTICLERE.key);
  // the Oath's camp writ in the next week, its pledge last week's
  s.setNow(AFTER(W));
  assert.equal(seatWeekOf(s.getNow() * 1000), W + 1);
  assert.equal((await supply(camp, 20)).error, 'seat-not-pledged');
  assert.deepEqual([stores(), lines(), left(camp), s.raw.prepare('SELECT COUNT(*) AS n FROM town_seat_camps').get().n], [[['plank:oak', 500], ['stone:cut', 500]], 0, 100, 0]);
  s.pledge(eo.gid, ANTICLERE, W + 1);
  const ok = await supply(camp, 20);
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.deepEqual(s.raw.prepare('SELECT week, guild_id, qty FROM town_seat_camps').all().map((r) => [r.week, r.guild_id, r.qty]), [[W + 1, eo.gid, 20]]);
  // A RACE: the seat lost between the delivery's read and its write - the write's own decision refuses it
  const db = s.svc.env.DB;
  const prepare = db.prepare.bind(db), batch = db.batch.bind(db);
  let race = null;
  db.prepare = (sql) => Object.assign(prepare(sql), { _sql: sql });
  db.batch = async (list) => {
    if (race && list.some((st) => st._sql?.includes('INTO guild_writ_fills'))) { race(); race = null; }
    return batch(list);
  };
  const lines0 = lines();
  race = () => s.raw.prepare('UPDATE town_seat_holds SET guild_id = ? WHERE key = ?').run(eo.gid, ANTICLERE.key);
  assert.equal((await supply(held, 50)).error, 'seat-not-held', 'the Charter taken between');
  s.raw.prepare('UPDATE town_seat_holds SET guild_id = ? WHERE key = ?').run(sh.gid, ANTICLERE.key);
  race = () => s.raw.prepare('DELETE FROM town_seat_pledges WHERE week = ? AND guild_id = ?').run(W + 1, eo.gid);
  assert.equal((await supply(camp, 20)).error, 'seat-not-pledged', 'the pledge gone between');
  assert.deepEqual([stores(), lines(), left(held), left(camp), s.stockOf()], [[['plank:oak', 480], ['stone:cut', 500]], lines0, 100, 80, {}], 'neither race moved anything');
});
