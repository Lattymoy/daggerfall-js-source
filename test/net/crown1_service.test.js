// CROWN1 part one (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE CROWN TIER, AS THE SERVICE KEEPS IT -
// a crown's reach in the standings and at the Turning, the Marches' share, the Free Lands' Watch; the Conscription Edict
// proclaimed at a crown alone, made law at the Turning and paid at the next out of the kingdom's palace holders' Tithe,
// each paying seat's Standing -5. Driven through the real Worker over node:sqlite with every migration applied
// (test/accountDb.mjs). bible/11-Multiplayer/Seats-Arc.md 4.3, 7.6; `06-Systems/Online-Arc.md` CROWN1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { utcDay } from '../../src/net/marksLaw.js';
import { seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S } from '../../src/net/townSeatLaw.js';

const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };   // a March: Daggerfall's and Wayrest's
const ALCAIRE = { key: 3034, name: 'Alcaire Keep', region: 34, tier: 'palace', pixel: [520, 130] };  // Wayrest's
const YKALON = { key: 3040, name: 'Ykalon', region: 40, tier: 'palace', pixel: [560, 100] };          // Wayrest's
const TULUNE = { key: 3058, name: 'Tulune', region: 58, tier: 'palace', pixel: [150, 120] };         // Daggerfall's
const ORSINIUM = { key: 3026, name: 'Orsinium', region: 26, tier: 'palace', pixel: [600, 40] };     // a Free Land
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
const turning = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000);
const AFTER = (w) => turning(w) + 3 * 3600;

async function stood() {
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of [ANTICLERE, ALCAIRE, YKALON, TULUNE, ORSINIUM, WAYREST]) {
    for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  }
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const guild = async (handle, name, tag) => {
    const gm = await svc.registered(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
    return { gm, gid };
  };
  const credit = (gid, n, kind = 'test', at = 1) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, ?, ?, ?, ?, 'seed', NULL, ?)`).run(gid, kind, n, utcDay(at), at, `seed-${gid}-${n}-${Math.random().toString(36).slice(2, 10)}`);
  const hold = (seat, gid, o = {}) => raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, 0)`).run(seat.key, gid, seat.region, seat.tier, W - 1, o.standing ?? 50, T0 - 7 * DAY, o.tithe ?? 6);
  const held = (key) => raw.prepare('SELECT * FROM town_seat_holds WHERE key = ?').get(key) ?? null;
  const pledge = (seat, gid, week = W) => raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(week, gid, seat.region, seat.key, 'x', T0);
  /** `amount` of the Watch for `gid` at `seat` in `week`, from a fresh account bound to it */
  const watch = async (gid, seat, amount = 100, week = W) => {
    const a = await svc.guest();
    raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, a.id, gid, 'c', T0);
    raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
      VALUES (?, ?, ?, ?, 'c', 'watch', ?, ?, 1, ?, ?)`).run(week, seat.key, gid, a.id, amount, seat.region, `t:${a.id}:${week}`, T0);
  };
  const lines = (kind) => raw.prepare('SELECT src_kind, src_id, dst_kind, dst_id, amount FROM marks_ledger WHERE kind = ? ORDER BY seq').all(kind)
    .map((r) => [r.src_kind, r.src_id, r.dst_kind, r.dst_id, Number(r.amount)]);
  const chronicle = (key) => raw.prepare('SELECT kind FROM town_seat_history WHERE key = ? ORDER BY seq').all(key).map((r) => r.kind);
  const standings = async (who, seat) => (await svc.call('/v1/seats/standings', { key: seat.key, character: who.character }, who.secret)).body;
  const list = async (who) => (await svc.call('/v1/seats/list', {}, who.secret)).body;
  return { svc, raw, guild, credit, hold, held, pledge, watch, lines, chronicle, standings, list };
}

test('CROWN1 REACH IN THE STANDINGS (4.3): a crown\'s holder a quarter more at its kingdom\'s palace seat, an eighth at a March it claims, nothing at another kingdom\'s; a Free Land\'s Watch a tenth more for everyone (mutants: the crowns read; the seat\'s tier; the Free Land)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { guild, hold, pledge, watch, standings } = await stood();
  const oa = await guild('Orla', 'The Oath', 'OA');      // holds Wayrest's crown
  const pl = await guild('Pell', 'Plainfolk', 'PL');     // holds nothing
  hold(WAYREST, oa.gid);
  for (const seat of [ALCAIRE, ANTICLERE, TULUNE, ORSINIUM]) {
    for (const g of [oa, pl]) { pledge(seat, g.gid); await watch(g.gid, seat, 1000); }
  }
  const at = async (seat) => Object.fromEntries((await standings(pl.gm, seat)).standings.map((s) => [s.guild.tag, s.influence]));
  assert.deepEqual(await at(ALCAIRE), { OA: 1250, PL: 1000 }, 'Wayrest\'s own palace: a quarter more');
  assert.deepEqual(await at(ANTICLERE), { OA: 1125, PL: 1000 }, 'a March Wayrest claims: an eighth');
  assert.deepEqual(await at(TULUNE), { OA: 1000, PL: 1000 }, 'Daggerfall\'s: no reach');
  assert.deepEqual(await at(ORSINIUM), { OA: 1100, PL: 1100 }, 'a Free Land: no crown\'s reach, every guild\'s Watch a tenth more');
});

test('CROWN1 REACH AT THE TURNING (5.2 step 1): 4,900 of a crown\'s holder at its kingdom\'s palace is 6,125 - past the palace\'s 6,000, a Charter claimed; the same week without the crown claims nothing (mutants: the Turning\'s totals without reach)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { guild, credit, hold, held, pledge, watch, list } = await stood();
  const oa = await guild('Orla', 'The Oath', 'OA');
  const pl = await guild('Pell', 'Plainfolk', 'PL');
  hold(WAYREST, oa.gid);
  credit(oa.gid, 200000);
  credit(pl.gid, 200000);
  pledge(ALCAIRE, oa.gid);
  pledge(TULUNE, pl.gid);
  for (const n of [2000, 2000, 900]) { await watch(oa.gid, ALCAIRE, n); await watch(pl.gid, TULUNE, n); }
  await watch(oa.gid, WAYREST, 100);
  now = AFTER(W);
  await list(oa.gm);
  assert.equal(held(ALCAIRE.key)?.guild_id, oa.gid, 'claimed with its reach');
  assert.equal(held(TULUNE.key), null, '4,900 alone is short of 6,000');
});

test('CROWN1 CONSCRIPTION (7.6): proclaimed at a crown alone (a palace refused), made law at the Turning at no cost; at the next the kingdom\'s palace holders pay the crown their share of the week\'s Tithe - 2% at its own, 1% at a March it claims - each paying seat Standing -5, the Chronicle saying so at both ends; the crown\'s own palace pays nothing (mutants: the tier gate; the Tithe\'s week; the share; the transfer; the Standing; the rows)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { svc, raw, guild, credit, hold, held, watch, lines, chronicle, list } = await stood();
  const oa = await guild('Orla', 'The Oath', 'OA');
  const sh = await guild('Gamal', 'The Silver Hand', 'SH');
  const pl = await guild('Pell', 'Plainfolk', 'PL');   // holds Ykalon, Wayrest's, and takes no Tithe the week it rules
  hold(WAYREST, oa.gid);
  hold(ALCAIRE, sh.gid);
  hold(ANTICLERE, sh.gid);
  hold(YKALON, pl.gid);
  credit(oa.gid, 100000);
  credit(sh.gid, 100000);
  credit(pl.gid, 100000);
  const edict = (who, seat, e) => svc.call('/v1/seats/edict', { character: who.character, key: seat.key, edict: e }, who.secret);
  assert.equal((await edict(sh.gm, ALCAIRE, 'conscription')).body.error, 'edict-tier', 'a palace may not');
  assert.equal((await edict(sh.gm, ALCAIRE, 'conscription')).status, 409);
  assert.deepEqual((await edict(oa.gm, WAYREST, 'conscription')).body, { ok: true, next: 'conscription' });
  const own = (seat) => (seat === WAYREST ? oa.gid : seat === YKALON ? pl.gid : sh.gid);
  for (const w of [W, W + 1]) for (const seat of [WAYREST, ALCAIRE, ANTICLERE, YKALON]) await watch(own(seat), seat, 100, w);
  now = AFTER(W);
  await list(oa.gm);
  assert.equal(raw.prepare('SELECT state FROM town_seat_edicts WHERE key = ? AND week = ?').get(WAYREST.key, W + 1).state, 'law');
  assert.deepEqual(lines('conscription'), [], 'nothing paid at the Turning that makes it law');
  assert.deepEqual([held(ALCAIRE.key).standing, held(ANTICLERE.key).standing], [55, 55], 'held unchallenged');
  // the week it rules: 20,000 of Tithe reach the Silver Hand; a line the week before never counts
  credit(sh.gid, 20000, 'tithe', turning(W) + DAY);
  credit(sh.gid, 50000, 'tithe', turning(W) - DAY);
  now = AFTER(W + 1);
  await list(oa.gm);
  // 20,000 over its two Charters: Alcaire 2% of 10,000 and Anticlere 1% of it
  assert.deepEqual(lines('conscription'), [['guild', sh.gid, 'guild', oa.gid, 300]]);
  assert.deepEqual([held(ALCAIRE.key).standing, held(ANTICLERE.key).standing], [55, 55], 'unchallenged +5, conscripted -5');
  assert.equal(chronicle(ALCAIRE.key).filter((k) => k === 'conscripted').length, 1);
  assert.equal(chronicle(ANTICLERE.key).filter((k) => k === 'conscripted').length, 1);
  assert.ok(chronicle(WAYREST.key).includes('conscription'));
  assert.equal(held(YKALON.key).standing, 60, 'no Tithe taken, nothing paid: not conscripted (+5 unchallenged twice)');
  assert.ok(!chronicle(YKALON.key).includes('conscripted'));
  const row = JSON.parse(raw.prepare("SELECT data FROM town_seat_history WHERE key = ? AND kind = 'conscripted'").get(ALCAIRE.key).data);
  assert.deepEqual([row.guild.tag, row.crown.tag, row.marks], ['SH', 'OA', 300]);
  // the week after, no Conscription rules: nothing paid, the Standing back to its own rows
  credit(sh.gid, 20000, 'tithe', turning(W + 1) + DAY);
  for (const seat of [WAYREST, ALCAIRE, ANTICLERE, YKALON]) await watch(own(seat), seat, 100, W + 2);
  now = AFTER(W + 2);
  await list(oa.gm);
  assert.equal(lines('conscription').length, 1, 'once');
  assert.equal(held(ALCAIRE.key).standing, 60);
});

test('CROWN1 CONSCRIPTION FROM AN EMPTY TREASURY: what the Turning finds left after the upkeep, no more - and a treasury spent pays nothing and rolls nothing back (mutants: the MIN; the settle rolled back)', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { raw, guild, credit, hold, held, watch, lines, list } = await stood();
  const oa = await guild('Orla', 'The Oath', 'OA');
  const sh = await guild('Gamal', 'The Silver Hand', 'SH');
  hold(WAYREST, oa.gid);
  hold(ALCAIRE, sh.gid);
  credit(oa.gid, 100000);
  raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, state, at) VALUES (?, ?, 'conscription', ?, 'x', 'law', ?)").run(WAYREST.key, W, oa.gid, T0);
  // 2,520 of Tithe in the week, its treasury's all: 2% due (50), but the upkeep's 2,500 leaves 20
  credit(sh.gid, 2520, 'tithe', T0 + 60);
  for (const seat of [WAYREST, ALCAIRE]) await watch(seat === WAYREST ? oa.gid : sh.gid, seat, 100, W);
  now = AFTER(W);
  await list(oa.gm);
  assert.deepEqual(lines('seat-upkeep').filter((l) => l[1] === sh.gid).map((l) => l[4]), [2500], 'the upkeep first');
  assert.deepEqual(lines('conscription'), [['guild', sh.gid, 'guild', oa.gid, 20]], 'what was left, not the 50 due');
  assert.ok(raw.prepare('SELECT 1 FROM town_seat_weeks WHERE week = ?').get(W), 'settled');
  assert.equal(held(ALCAIRE.key).standing, 50, 'unchallenged +5, conscripted -5');
});
