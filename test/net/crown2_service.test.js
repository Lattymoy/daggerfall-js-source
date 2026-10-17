// CROWN2 (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): FEALTY AND PACTS, AS THE SERVICE KEEPS THEM -
// fealty offered by either side and sworn when the other accepts (a palace of a crown's kingdom, or a March it claims,
// to that crown's holder); neither pledging against the other's seats; at the Turning the vassal's 5% tribute, the
// liege's half-reach on the vassal's defence, Conscription sparing the vassal, a break's -10 at every seat of the
// breaker, a pair that no longer fits lapsing; Pacts of non-aggression for the rest of the Season, broken early and
// announced in red on the seats' list. Driven through the real Worker over node:sqlite with every migration applied
// (test/accountDb.mjs). bible/11-Multiplayer/Seats-Arc.md 7.8; `06-Systems/Online-Arc.md` CROWN2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { acceptFealty } from '../../server-account/src/seatPolitics.js';
import { standService, T0 } from '../accountDb.mjs';
import { utcDay } from '../../src/net/marksLaw.js';
import { seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S, pactUntil, seatDefence, KINGDOM_REACH, overreachOf } from '../../src/net/townSeatLaw.js';

const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const ALCAIRE = { key: 3034, name: 'Alcaire Keep', region: 34, tier: 'palace', pixel: [520, 130] };
const TULUNE = { key: 3058, name: 'Tulune', region: 58, tier: 'palace', pixel: [150, 120] };   // Daggerfall's
const YKALON = { key: 3040, name: 'Ykalon', region: 40, tier: 'palace', pixel: [560, 100] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
const turning = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000);
const AFTER = (w) => turning(w) + 3 * 3600;

async function stood(t) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of [WAYREST, ALCAIRE, TULUNE, YKALON]) for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const guild = async (handle, name, tag) => {
    const gm = await svc.registered(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
    raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      VALUES ('mint', NULL, 'guild', ?, 'test', 100000, 1, 1, 'seed', NULL, ?)`).run(gid, `seed-${gid}`);
    return { gm, gid, tag };
  };
  const hold = (seat, g, standing = 50) => raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 6, 0)`).run(seat.key, g.gid, seat.region, seat.tier, W - 1, standing, T0 - 7 * DAY);
  const held = (key) => raw.prepare('SELECT * FROM town_seat_holds WHERE key = ?').get(key) ?? null;
  const watch = (g, seat, week, amount = 100) => {
    const id = `w-${g.gid}-${seat.key}-${week}-${amount}`;
    raw.prepare('INSERT OR IGNORE INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, g.gm.id, g.gid, g.gm.character, T0);
    raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
      VALUES (?, ?, ?, ?, ?, 'watch', ?, ?, 1, ?, ?)`).run(week, seat.key, g.gid, g.gm.id, g.gm.character, amount, seat.region, id, T0);
  };
  const tithe = (g, n, at) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'tithe', ?, ?, ?, 'seed', NULL, ?)`).run(g.gid, n, utcDay(at), at, `tithe-${g.gid}-${at}`);
  const lines = (kind) => raw.prepare('SELECT src_id, dst_kind, dst_id, amount FROM marks_ledger WHERE kind = ? ORDER BY seq').all(kind).map((r) => [r.src_id, r.dst_kind, r.dst_id, Number(r.amount)]);
  const chronicle = (key) => raw.prepare('SELECT kind FROM town_seat_history WHERE key = ? ORDER BY seq').all(key).map((r) => r.kind);
  const call = async (path, body, who) => svc.call(path, body, who.secret);
  const act = (path, g, body) => call(path, { character: g.gm.character, ...body }, g.gm);
  const list = async (g) => (await call('/v1/seats/list', {}, g.gm)).body;
  return { svc, raw, guild, hold, held, watch, tithe, lines, chronicle, call, act, list, getNow: () => now, setNow: (v) => { now = v; } };
}

test('CROWN2 FEALTY SWORN: offered by the vassal\'s side, accepted by the liege\'s (or the other way); only a palace of the crown\'s kingdom to that crown\'s holder; refused while either is pledged against the other; once; the Chronicle at both; the guild\'s view (mutants: the fit; the sides; the pledge; the once; the rows)', async (t) => {
  const s = await stood(t);
  const oa = await s.guild('Orla', 'The Oath', 'OA');      // Wayrest's crown
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');   // Alcaire, Wayrest's palace
  const dg = await s.guild('Doran', 'Daggers', 'DG');       // Tulune, Daggerfall's
  s.hold(WAYREST, oa); s.hold(ALCAIRE, sh); s.hold(TULUNE, dg);
  assert.equal((await s.act('/v1/seats/fealty', dg, { tag: 'OA', as: 'vassal' })).body.error, 'fealty-unfit', 'another kingdom\'s palace');
  assert.equal((await s.act('/v1/seats/fealty', oa, { tag: 'SH', as: 'vassal' })).body.error, 'fealty-unfit', 'a crown is no vassal');
  assert.equal((await s.act('/v1/seats/fealty', oa, { tag: 'SH', as: 'king' })).body.error, 'fealty-unfit', 'neither side named');
  assert.equal((await s.act('/v1/seats/fealty', sh, { tag: 'NOPE', as: 'vassal' })).status, 404);
  // pledged against: refused
  s.raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(W, oa.gid, 99, ALCAIRE.key, 'x', T0);
  assert.equal((await s.act('/v1/seats/fealty', sh, { tag: 'OA', as: 'vassal' })).body.error, 'fealty-pledged');
  s.raw.prepare('DELETE FROM town_seat_pledges').run();
  assert.deepEqual((await s.act('/v1/seats/fealty', sh, { tag: 'OA', as: 'vassal' })).body, { ok: true });
  assert.equal((await s.act('/v1/seats/fealty/accept', sh, { tag: 'OA' })).body.error, 'fealty-none', 'its own offer is not the other side\'s to accept');
  assert.deepEqual((await s.act('/v1/seats/fealty/accept', oa, { tag: 'SH' })).body, { ok: true });
  assert.equal((await s.act('/v1/seats/fealty/accept', oa, { tag: 'SH' })).body.error, 'fealty-none', 'once');
  assert.equal((await s.act('/v1/seats/fealty', sh, { tag: 'OA', as: 'vassal' })).body.error, 'fealty-sworn');
  const row = s.raw.prepare('SELECT * FROM guild_fealty').get();
  assert.deepEqual([row.vassal, row.liege, row.state, row.since_week], [sh.gid, oa.gid, 'sworn', W]);
  assert.ok(s.chronicle(WAYREST.key).includes('fealty-sworn'));
  assert.ok(s.chronicle(ALCAIRE.key).includes('fealty-sworn'));
  const view = (await s.call('/v1/seats/standings', { key: ALCAIRE.key, character: sh.gm.character }, sh.gm)).body.mine.politics;
  assert.deepEqual(view.fealty, [{ vassal: { tag: 'SH', name: 'The Silver Hand' }, liege: { tag: 'OA', name: 'The Oath' }, state: 'sworn', mine: true, asVassal: true }]);
  const liegeView = (await s.call('/v1/seats/standings', { key: WAYREST.key, character: oa.gm.character }, oa.gm)).body.mine.politics;
  assert.deepEqual(liegeView.fealty, [{ vassal: { tag: 'SH', name: 'The Silver Hand' }, liege: { tag: 'OA', name: 'The Oath' }, state: 'sworn', mine: false, asVassal: false }], 'the liege\'s view');
  // the liege offering instead: accepted by the vassal's side
  const s2 = await stood(t);
  const oa2 = await s2.guild('Orla', 'The Oath', 'OA'), sh2 = await s2.guild('Gamal', 'The Silver Hand', 'SH');
  s2.hold(WAYREST, oa2); s2.hold(ALCAIRE, sh2);
  assert.deepEqual((await s2.act('/v1/seats/fealty', oa2, { tag: 'SH', as: 'liege' })).body, { ok: true });
  // the pair no longer fitting by the accept (the liege lost its crown): refused
  s2.raw.prepare('DELETE FROM town_seat_holds WHERE key = ?').run(WAYREST.key);
  assert.equal((await s2.act('/v1/seats/fealty/accept', sh2, { tag: 'OA' })).body.error, 'fealty-unfit');
  s2.hold(WAYREST, oa2);
  // two accepts at once - the first read the offer, then the second swore it before the first's batch: the first writes
  // nothing, and the Chronicle says it once
  const db = s2.svc.env.DB;
  let release;
  const gate = new Promise((r) => { release = r; });
  const held = { prepare: (q) => db.prepare(q), batch: async (stmts) => { await gate; return db.batch(stmts); } };
  const player = s2.raw.prepare('SELECT * FROM players WHERE id = ?').get(sh2.gm.id);
  const first = acceptFealty({ db: held, nowS: s2.getNow() }, player, s2.svc.env, { character: sh2.gm.character, tag: 'OA' });
  assert.deepEqual(await acceptFealty({ db, nowS: s2.getNow() }, player, s2.svc.env, { character: sh2.gm.character, tag: 'OA' }), { ok: true });
  release();
  assert.deepEqual(await first, { error: 'fealty-none' });
  assert.equal(s2.chronicle(WAYREST.key).filter((k) => k === 'fealty-sworn').length, 1);
});

test('CROWN2 NEVER AGAINST EACH OTHER: a liege and its vassal, and two Pact partners, may not pledge at the other\'s seat; another seat stands open (mutants: the liege; the vassal; the Pact)', async (t) => {
  const s = await stood(t);
  const oa = await s.guild('Orla', 'The Oath', 'OA'), sh = await s.guild('Gamal', 'The Silver Hand', 'SH'), dg = await s.guild('Doran', 'Daggers', 'DG');
  s.hold(WAYREST, oa); s.hold(ALCAIRE, sh); s.hold(TULUNE, dg);
  await s.act('/v1/seats/fealty', sh, { tag: 'OA', as: 'vassal' });
  await s.act('/v1/seats/fealty/accept', oa, { tag: 'SH' });
  const pledge = (g, seat) => s.act('/v1/seats/pledge', g, { key: seat.key });
  assert.equal((await pledge(oa, ALCAIRE)).body.error, 'fealty-pledge', 'the liege at its vassal\'s');
  assert.equal((await pledge(sh, WAYREST)).body.error, 'fealty-pledge', 'the vassal at its liege\'s');
  assert.equal((await pledge(oa, YKALON)).status, 200, 'an unheld seat');
  assert.deepEqual((await s.act('/v1/seats/pact', dg, { tag: 'OA' })).body, { ok: true, signed: false });
  assert.equal((await pledge(dg, WAYREST)).status, 200, 'an offer binds nothing');
  await pledge(dg, YKALON);   // moved on before the signing (one pledge a region; Wayrest's region 23 kept)
  s.raw.prepare('DELETE FROM town_seat_pledges WHERE guild_id = ?').run(dg.gid);
  const signed = (await s.act('/v1/seats/pact', oa, { tag: 'DG' })).body;
  assert.deepEqual(signed, { ok: true, signed: true, until: pactUntil(W) });
  assert.equal((await pledge(dg, WAYREST)).body.error, 'pact-pledge');
  assert.equal((await pledge(oa, TULUNE)).body.error, 'pact-pledge');
  assert.equal((await s.act('/v1/seats/pact', oa, { tag: 'DG' })).body.error, 'pact-signed');
  assert.equal((await s.act('/v1/seats/pact', oa, { tag: 'OA' })).body.error, 'pact-self');
  // pledged against the other's seat: no Pact
  assert.equal((await pledge(sh, TULUNE)).status, 200);
  assert.equal((await s.act('/v1/seats/pact', sh, { tag: 'DG' })).body.error, 'pact-pledged');
});

test('CROWN2 A PACT BROKEN EARLY: allowed at once, announced to the whole server in red on the seats\' list for a day; an unsigned offer only withdrawn, unannounced; none, refused (mutants: the announcement; the withdrawal; the day)', async (t) => {
  const s = await stood(t);
  const oa = await s.guild('Orla', 'The Oath', 'OA'), dg = await s.guild('Doran', 'Daggers', 'DG'), sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  await s.act('/v1/seats/pact', oa, { tag: 'SH' });
  assert.deepEqual((await s.act('/v1/seats/pact/break', oa, { tag: 'SH' })).body, { ok: true, announced: false }, 'an offer withdrawn');
  await s.act('/v1/seats/pact', oa, { tag: 'DG' });
  assert.deepEqual((await s.act('/v1/seats/pact', oa, { tag: 'DG' })).body, { ok: true, signed: false }, 'offered again by the same side: still an offer');
  await s.act('/v1/seats/pact', dg, { tag: 'OA' });
  assert.deepEqual((await s.act('/v1/seats/pact/break', dg, { tag: 'OA' })).body, { ok: true, announced: true });
  assert.equal((await s.act('/v1/seats/pact/break', dg, { tag: 'OA' })).body.error, 'pact-none');
  const red = (await s.list(sh)).red;
  assert.deepEqual(red.map((r) => r.text), ['Daggers <DG> has broken its Pact of non-aggression with the Oath <OA>.']);
  s.setNow(s.getNow() + DAY);
  assert.deepEqual((await s.list(sh)).red, [], 'a day, then gone');
});

test('CROWN2 THE TURNING: the vassal\'s tribute - 5% of its week\'s Tithe - to its liege after its upkeep; the liege\'s half-reach on the vassal\'s defence; Conscription sparing it; a break\'s -10 at every seat of the breaker and the fealty ended; a pair that no longer fits lapsed without a cost (mutants: the tribute; the share; the reach; the conscription; the break; the lapse)', async (t) => {
  const s = await stood(t);
  const oa = await s.guild('Orla', 'The Oath', 'OA'), sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(WAYREST, oa); s.hold(ALCAIRE, sh); s.hold(YKALON, sh);
  await s.act('/v1/seats/fealty', sh, { tag: 'OA', as: 'vassal' });
  await s.act('/v1/seats/fealty/accept', oa, { tag: 'SH' });
  // the crown proclaims Conscription too: its vassal pays tribute, never Conscription
  s.raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, state, at) VALUES (?, ?, 'conscription', ?, 'x', 'law', ?)").run(WAYREST.key, W, oa.gid, T0);
  s.tithe(sh, 20000, T0 + 60);
  for (const [g, seat] of [[oa, WAYREST], [sh, ALCAIRE], [sh, YKALON]]) s.watch(g, seat, W, 2000);
  // a challenger at Alcaire this week, to read the vassal's defence
  const ch = await s.guild('Cade', 'Challengers', 'CH');
  s.raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(W, ch.gid, ALCAIRE.region, ALCAIRE.key, 'x', T0);
  s.setNow(AFTER(W));
  await s.list(oa);
  assert.deepEqual(s.lines('fealty-tribute'), [[sh.gid, 'guild', oa.gid, 1000]], '5% of 20,000');
  assert.deepEqual(s.lines('conscription'), [], 'never a vassal\'s');
  assert.ok(s.chronicle(WAYREST.key).includes('fealty-tribute'));
  assert.equal(s.raw.prepare('SELECT 1 FROM town_seat_rights WHERE key = ?').get(ALCAIRE.key), undefined, 'no Right: the challenger had nothing');
  // the defence the Seat tab shows is the Turning's own (seatDefence): 2,000 of its own, -5% Overreach (two palaces),
  // and its liege's half-reach on it - an eighth of 2,000 at Wayrest's own palace
  const defence = async () => (await s.call('/v1/seats/standings', { key: ALCAIRE.key }, sh.gm)).body.defence;
  for (const [g, seat] of [[oa, WAYREST], [sh, ALCAIRE], [sh, YKALON]]) s.watch(g, seat, W + 1, 2000);
  const own = { influence: 2000, legacy: 200 }, st = s.held(ALCAIRE.key).standing;
  assert.equal(await defence(), seatDefence(own, st, 1, false, KINGDOM_REACH));
  assert.equal(seatDefence(own, st, 1, false, KINGDOM_REACH) - seatDefence(own, st, 1, false), 250, 'half the liege\'s quarter on 2,000');
  // the break: asked by the liege this week, taken at the next Turning
  assert.deepEqual((await s.act('/v1/seats/fealty/break', oa, { tag: 'SH' })).body, { ok: true, breaking: true });
  assert.equal(await defence(), seatDefence(own, st, 1, false), 'a fealty breaking lends no reach on the Seat tab, as at the Turning');
  const before = [s.held(WAYREST.key).standing, s.held(ALCAIRE.key).standing];
  s.tithe(sh, 10000, turning(W) + 60);
  s.setNow(AFTER(W + 1));
  await s.list(oa);
  assert.deepEqual(s.lines('fealty-tribute').at(-1), [sh.gid, 'guild', oa.gid, 500], 'its last week\'s tribute, with no Conscription ruling');
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM guild_fealty').get().n, 0, 'ended');
  assert.equal(s.held(WAYREST.key).standing, before[0] + 5 - 10 + 2, 'the breaker: unchallenged +5, the Tithe +2 (a crown\'s 6 is under half its cap), broken -10');
  assert.equal(s.held(ALCAIRE.key).standing, before[1] + 5, 'the vassal: unchallenged +5 alone');
  assert.ok(s.chronicle(ALCAIRE.key).includes('fealty-broken'));
  s.watch(sh, ALCAIRE, W + 2, 2000);
  assert.equal(await defence(), seatDefence({ influence: 2000, legacy: 200 }, s.held(ALCAIRE.key).standing, 1, false), 'no liege, no reach');
  // a lapse: the liege loses its crown - the fealty ends at the Turning, no cost
  const s2 = await stood(t);
  const oa2 = await s2.guild('Orla', 'The Oath', 'OA'), sh2 = await s2.guild('Gamal', 'The Silver Hand', 'SH');
  s2.hold(WAYREST, oa2); s2.hold(ALCAIRE, sh2);
  await s2.act('/v1/seats/fealty', sh2, { tag: 'OA', as: 'vassal' });
  await s2.act('/v1/seats/fealty/accept', oa2, { tag: 'SH' });
  s2.watch(sh2, ALCAIRE, W, 100);
  // a vassal that comes to hold a crown no longer fits: its liege lends no reach on the Seat tab, as at the Turning
  const vassalDefence = async () => (await s2.call('/v1/seats/standings', { key: ALCAIRE.key }, sh2.gm)).body.defence;
  assert.equal(await vassalDefence(), seatDefence({ influence: 100, legacy: 0 }, 50, 0, false, KINGDOM_REACH), 'sworn and fitting: the reach');
  s2.raw.prepare("INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed) VALUES (5017, ?, 17, 'crown', ?, 50, NULL, ?, 6, 0)").run(sh2.gid, W - 1, T0);
  assert.equal(await vassalDefence(), seatDefence({ influence: 100, legacy: 0 }, 50, overreachOf(['palace', 'crown']), false), 'unfit: none');
  s2.raw.prepare('DELETE FROM town_seat_holds WHERE key = 5017').run();
  s2.raw.prepare('DELETE FROM town_seat_holds WHERE key = ?').run(WAYREST.key);
  s2.setNow(AFTER(W));
  await s2.list(sh2);
  assert.equal(s2.raw.prepare('SELECT COUNT(*) AS n FROM guild_fealty').get().n, 0);
  assert.ok(s2.chronicle(ALCAIRE.key).includes('fealty-lapsed'));
  assert.equal(s2.held(ALCAIRE.key).standing, 55, 'no cost: unchallenged +5');
});

test('CROWN2 THE TURNING\'S WIRING BY SOURCE: each holder handed its liege\'s reach and its break off the law\'s reckoning (mutants: the reach handed)', () => {
  const src = readFileSync(new URL('../../server-account/src/seatTurning.js', import.meta.url), 'utf8');
  assert.match(src, /const reckoned = fealtyReckoning\(fealtyRows, charters\);/);
  assert.match(src, /liegeReach: reckoned\.liegeReach\(h\.guild_id, registry\.get\(key\)\),/);
  assert.match(src, /brokeFealty: breakers\.has\(h\.guild_id\),/);
});
