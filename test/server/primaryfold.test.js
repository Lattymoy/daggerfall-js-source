// PRIMARY-FOLD (2026-10-18; bible/11-Multiplayer/Scale-Arc.md THE PLAN PAST 1,000, PRIMARY-FOLD): THE DOOR'S READS IN ONE
// TRIP. A progression claim asked the account database's one primary four reads of its own - the tombstone of the body's
// `character`, the account's seat, its stream's bucket at the door, and the bucket again at its spend - each a round trip.
// The door asks the three as one statement (server-account/src/door.js doorReads), and the spend steps the bucket where it
// stands, reading nothing (AUDIT PLAN-1000 C1). These pins hold that it answers as the three did, and that the trips are gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { seatRealm } from '../realmSeat.mjs';
import { doorReads } from '../../server-account/src/door.js';
import { progressRefusal, seatRefusalOf, spendProgress, PROGRESS_LINE } from '../../server-account/src/progress.js';
import { stepBudget } from '../../server-account/src/budget.js';
import { isTombstone, TOMB_WHERE } from '../../server-account/src/legacy.js';
import { overAccountRate, ACCOUNT_MAX, ACCOUNT_WINDOW_S } from '../../server-account/src/accounts.js';
import { CHAPTER_TURNING_GRACE_S } from '../../server-account/src/npcChapters.js';
import { ROLL_CLAIMS_HOUR } from '../../src/net/npcChapterLaw.js';
import { SEAT_WEEK_MS, seatWeekOf } from '../../src/net/townSeatLaw.js';

/** The bucket's question as it was asked on its own (progress.js bucketOf before PRIMARY-FOLD) - the oracle. */
async function bucketAsked(db, playerId, stream) {
  const row = await db.prepare('SELECT p.played_s AS now, b.allowance, b.played_at FROM players p LEFT JOIN progress_play b ON b.player = p.id AND b.stream = ?2 WHERE p.id = ?1').bind(playerId, stream).first();
  if (!row) return null;
  return { now: Number(row.now) || 0, allowance: row.allowance == null ? null : Number(row.allowance), playedAt: row.played_at == null ? null : Number(row.played_at) };
}

/** A service on the test's clock, an account seated as a realm character. */
async function stand(extra = {}) {
  const realNow = Date.now;
  Date.now = () => T0 * 1000;
  const s = await standService(extra);
  return { s, raw: s.env.DB._raw, db: s.env.DB, eve: await s.seated('eve'), done: () => { Date.now = realNow; } };
}

test('PRIMARY-FOLD the door answers as its three questions did, asked alone: the tombstone of the character named, the seat (none, held, another named, another of the account\'s held, a second account\'s), the stream\'s bucket (none yet, filled, a stream with no row, an account with no row); a request that claims nothing asks the tombstone alone (mutants: the seat always found; its hold another row\'s; the bucket of no account; the tombstone of nothing)', async () => {
  const t = await stand();
  try {
    const { db, raw, eve } = t;
    const claims = [{ named: true, character: eve.character }, { named: true, character: 'char-not-mine' }, { named: false }];
    const check = async (label, playerId, tomb, stream) => {
      const d = await doorReads(db, playerId, { tomb, stream });
      assert.equal(d.dead, tomb != null && (await isTombstone(db, playerId, tomb)), `${label}: the tombstone`);
      if (stream == null) { assert.equal(d.seat, undefined, `${label}: no seat asked`); assert.equal(d.bucket, undefined); return d; }
      for (const c of claims) assert.deepEqual(seatRefusalOf(d.seat, c), await progressRefusal(db, playerId, c), `${label}: the seat, ${JSON.stringify(c)}`);
      assert.deepEqual(d.bucket, await bucketAsked(db, playerId, stream), `${label}: the bucket`);
      assert.equal(d.stream, stream);
      return d;
    };
    await check('seated, no bucket yet', eve.id, eve.character, 'renown');
    raw.prepare("INSERT INTO progress_play (player, stream, allowance, played_at, at) VALUES (?, 'renown', 420, 90, ?)").run(eve.id, T0);
    raw.prepare('UPDATE players SET played_s = 600 WHERE id = ?').run(eve.id);
    const filled = await check('a bucket filled', eve.id, eve.character, 'renown');
    assert.deepEqual(filled.bucket, { now: 600, allowance: 420, playedAt: 90 });
    await check('another stream, no row', eve.id, eve.character, 'prof');
    await check('a claim naming nothing', eve.id, null, 'watch');
    raw.prepare("UPDATE realm_characters SET held = 'law' WHERE id = ?").run(eve.character);
    assert.deepEqual(seatRefusalOf((await check('held', eve.id, eve.character, 'renown')).seat, claims[0]), { error: 'trade-held', held: 'law' });
    raw.prepare('UPDATE realm_characters SET held = NULL, lease = NULL WHERE id = ?').run(eve.character);
    assert.equal((await check('no lease, no seat', eve.id, eve.character, 'renown')).seat, null);
    raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(T0, eve.character);
    assert.equal((await check('dead', eve.id, eve.character, 'renown')).dead, true);
    assert.equal((await check('dead, claiming nothing', eve.id, eve.character, null)).dead, true);
    // the account's other realm character held, the seat not: the hold is the SEAT's row's (its lease), never another's
    const zed = await t.s.seated('zed');
    const second = await seatRealm(t.s.env, zed.secret, 'Zed Again');   // taken up: the second holds the lease now
    raw.prepare("UPDATE realm_characters SET held = 'law' WHERE id = ?").run(zed.character);
    assert.equal(seatRefusalOf((await check('another character held, the seat not', zed.id, second.id, 'renown')).seat, { named: true, character: second.id }), null);
    const bran = await t.s.seated('bran');
    await check('a second account, naming the first\'s character', bran.id, eve.character, 'renown');
    const nobody = await check('an account with no row', 'no-such-player', 'char-x', 'renown');
    assert.equal(nobody.bucket, null);
    assert.equal(nobody.seat, null);
    assert.equal((await doorReads(db, eve.id, { tomb: null, stream: null })).dead, false, 'nothing asked: no tombstone');
  } finally { t.done(); }
});

/** Every statement the service asks of the database (prepare's SQL, a batch counted once), around one call. */
function counted(env) {
  const db = env.DB, prepare = db.prepare.bind(db), batch = db.batch.bind(db);
  /** @type {string[][]} */
  const trips = [];
  db.prepare = (sql) => { const st = prepare(sql); const one = (fn) => async (...a) => { trips.push([sql]); return fn(...a); }; return Object.assign(st, { first: one(st.first.bind(st)), all: one(st.all.bind(st)), run: one(st.run.bind(st)), _sql: sql }); };
  db.batch = async (list) => { trips.push(list.map((x) => x._sql)); return batch(list); };
  return { trips, off: () => { db.prepare = prepare; db.batch = batch; } };
}

test('PRIMARY-FOLD the trips: an enforced Renown claim asks the door\'s three questions in ONE statement and its bucket nowhere else - neither the enforced room nor the spend reads it (the spend steps it where it stands - AUDIT PLAN-1000 C1) - credited as before; a route that names a character and claims nothing asks the tombstone alone (mutants: the room asks again; the door asks no stream)', async () => {
  const t = await stand({ DEVELOPER_HANDLES: 'mac', PROFESSIONS_OPEN: 'on' });
  try {
    const mac = await t.s.registered('mac');
    const line = { enforce: true, streams: { ...PROGRESS_LINE.streams, renown: { rate: 3_600, cap: 1_000 } } };
    assert.equal((await t.s.call('/v1/mod/realm-progress', { set: line }, mac.secret)).status, 200);
    const c = counted(t.s.env);
    const r = await t.s.call('/v1/renown/xp', { character: t.eve.character, xp: 5_000, rid: '00000000000000f1' }, t.eve.secret);
    c.off();
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.credited, 1_000, 'the enforced bucket\'s thousand, as the door read it');
    const flat = c.trips.flat();
    assert.equal(flat.filter((q) => q.includes('AS seat_id')).length, 1, 'the door: one statement');
    assert.equal(flat.filter((q) => q.includes(TOMB_WHERE)).length, 1, 'the tombstone asked in it, and nowhere else');
    assert.equal(flat.filter((q) => /SELECT p\.played_s AS now/.test(q)).length, 0, 'the bucket asked by no one else');
    assert.equal(flat.filter((q) => /SELECT id, held FROM realm_characters WHERE player = \?1 AND lease IS NOT NULL/.test(q)).length, 0, 'the seat asked by no one else');
    const row = t.raw.prepare("SELECT allowance FROM progress_play WHERE player = ? AND stream = 'renown'").get(t.eve.id);
    assert.equal(row.allowance, 0, 'spent where it stands: the thousand gone');
    const g = counted(t.s.env);
    assert.equal((await t.s.call('/v1/prof/state', { character: t.eve.character }, t.eve.secret)).status, 200);
    g.off();
    assert.equal(g.trips.flat().filter((q) => q === `SELECT 1 FROM realm_characters WHERE ${TOMB_WHERE}`).length, 1, 'a read naming a character: the tombstone alone');
    assert.equal(g.trips.flat().filter((q) => q.includes('AS seat_id')).length, 0);
  } finally { t.done(); }
});

test('AUDIT PLAN-1000 C1 THE SPEND IS ONE STEP OVER THE ROW AS IT STANDS: its SQL steps the bucket exactly as budget.js stepBudget does, over every state (none yet, part full, full, a debt, measured or enforced, play since or none, a cap and rate each way), the hour\'s measure with it; two claims of one stream that overlap lose no debit (the second\'s spend between the first\'s reads and its write); the spend asks no read (mutants: the fill; the cap; a full bucket refilled; the debt kept measured; the play since; the over; the claim untaken)', async () => {
  const t = await stand();
  try {
    const { db, raw, eve } = t;
    // THE ORACLE: stepBudget, over a grid of states, against what the batch wrote
    let n = 0;
    for (const enforce of [true, false]) for (const band of [{ rate: 3_600, cap: 1_000 }, { rate: 2, cap: 2 }, { rate: 7, cap: 40 }]) {
      // a bucket is no row (never filled - a row always says when it moved) or a row of its allowance and play
      for (const allowance of [null, 0, 1, band.cap - 1, band.cap, -5]) for (const [playedAt, nowPlayed] of [[100, 100], [100, 1_900], [100, 99_999], [2_000, 1_000], [0, 3_600]]) for (const gain of [1, 3, 2_000]) {
        const stream = 'renown';
        raw.prepare('DELETE FROM progress_play WHERE player = ?').run(eve.id);
        raw.prepare('DELETE FROM progress_hours WHERE player = ?').run(eve.id);
        raw.prepare('UPDATE players SET played_s = ? WHERE id = ?').run(nowPlayed, eve.id);
        if (allowance !== null) raw.prepare('INSERT INTO progress_play (player, stream, allowance, played_at, at) VALUES (?, ?, ?, ?, 0)').run(eve.id, stream, allowance, playedAt);
        const played = allowance === null ? 0 : Math.max(0, nowPlayed - playedAt);
        const want = stepBudget({ allowance, played, gain, band, enforce });
        const r = await spendProgress(db, eve.id, stream, gain, T0, { enforce, streams: { [stream]: band } });
        const row = raw.prepare('SELECT allowance, played_at FROM progress_play WHERE player = ? AND stream = ?').get(eve.id, stream);
        const hour = raw.prepare('SELECT amount, played_s, over, claims FROM progress_hours WHERE player = ? AND stream = ?').get(eve.id, stream);
        const at = JSON.stringify({ enforce, band, allowance, playedAt, nowPlayed, gain });
        assert.equal(Number(row.allowance), want.allowance, `the bucket after: ${at}`);
        assert.equal(r.allowance, want.allowance, `its answer: ${at}`);
        assert.equal(Number(row.played_at), nowPlayed, `the play it moved at: ${at}`);
        assert.deepEqual([Number(hour.amount), Number(hour.played_s), Number(hour.over), Number(hour.claims)], [gain, played, want.over, 1], `the hour: ${at}`);
        n++;
      }
    }
    assert.equal(n, 2 * 3 * 6 * 5 * 3);
    assert.equal(await spendProgress(db, 'no-such-player', 'renown', 5, T0, { enforce: true, streams: { renown: { rate: 1, cap: 2 } } }), null, 'no account row: nothing spent');

    // AUDIT PLAN-1000 F3: TWO CLAIMS IN ONE HOUR - the hour's row sums them, every column of it
    for (const enforce of [true, false]) {
      raw.prepare('DELETE FROM progress_play WHERE player = ?').run(eve.id);
      raw.prepare('DELETE FROM progress_hours WHERE player = ?').run(eve.id);
      raw.prepare('UPDATE players SET played_s = 0 WHERE id = ?').run(eve.id);
      const band = { rate: 0, cap: 10 };
      const one = stepBudget({ allowance: null, played: 0, gain: 12, band, enforce });
      const two = stepBudget({ allowance: one.allowance, played: 0, gain: 7, band, enforce });
      await spendProgress(db, eve.id, 'renown', 12, T0, { enforce, streams: { renown: band } });
      await spendProgress(db, eve.id, 'renown', 7, T0 + 60, { enforce, streams: { renown: band } });
      const hour = raw.prepare("SELECT amount, played_s, over, claims FROM progress_hours WHERE player = ? AND stream = 'renown'").get(eve.id);
      assert.ok(one.over > 0 && two.over > 0, 'both past the bucket');
      assert.deepEqual([Number(hour.amount), Number(hour.played_s), Number(hour.over), Number(hour.claims)], [19, 0, one.over + two.over, 2], `the hour, both claims summed (enforce ${enforce})`);
    }

    // THE OVERLAP: the second claim's spend lands between the first's start and its write - both debits kept
    raw.prepare('DELETE FROM progress_play WHERE player = ?').run(eve.id);
    raw.prepare('UPDATE players SET played_s = 0 WHERE id = ?').run(eve.id);
    const line = { enforce: true, streams: { renown: { rate: 0, cap: 10_000 } } };
    await spendProgress(db, eve.id, 'renown', 100, T0, line);
    const base = db.batch.bind(db);
    let raced = false;
    db.batch = async (list) => { if (!raced) { raced = true; await spendProgress(Object.assign(Object.create(db), { batch: base }), eve.id, 'renown', 100, T0, line); } return base(list); };
    try { await spendProgress(db, eve.id, 'renown', 100, T0, line); } finally { db.batch = base; }
    assert.ok(raced);
    assert.equal(raw.prepare("SELECT allowance FROM progress_play WHERE player = ? AND stream = 'renown'").get(eve.id).allowance, 9_700, 'three claims, three debits');

    // NO READ: the spend is its one batch
    const c = counted(t.s.env);
    await spendProgress(db, eve.id, 'renown', 1, T0, line);
    c.off();
    assert.equal(c.trips.length, 1, 'one trip');
    assert.equal(c.trips[0].length, 2, 'its two writes');
  } finally { t.done(); }
});

/** A seated account on a service with the seats, the chapters and a Season counted, on a clock the test moves. */
async function standWeeks(extra = {}) {
  const realNow = Date.now;
  let now = T0;
  Date.now = () => now * 1000;
  const s = await standService({ SEATS_OPEN: 'on', CHAPTERS_OPEN: 'on', SEASON_ZERO_WEEK: String(seatWeekOf(T0 * 1000) - 2), ...extra });
  const eve = await s.seated('eve');
  return { s, eve, tick: (sec) => { now += sec; }, done: () => { Date.now = realNow; } };
}
const asks = (trips, re) => trips.flat().filter((q) => re.test(q)).length;

test('PRIMARY-FOLD a week read settled stays settled in its isolate: the seats\' list and the chapters\' sheet ask whether a Turning is due once a week, not on every read; past the week\'s boundary the next read asks again and the week\'s Turning lands; a stood service (a fresh isolate) keeps nothing; kept by the binding under the per-request Proxy METRICS wraps it in (AUDIT PLAN-1000 D2), the seats\' word and the chapters\' apart (D3), and a catch-up that settled part of its weeks keeps nothing (D4) (mutants: the keep never kept; kept past its week; the kept word unread; the seats\' keep; a settle\'s word unkept; kept by the Proxy; one name for both; a partial catch-up kept)', async () => {
  const w = await standWeeks({ METRICS: { writeDataPoint() {} } });   // D2: as production binds it - a new Proxy over the binding every request (metrics.js measured)
  try {
    const list = () => w.s.call('/v1/seats/list', {}, w.eve.secret);
    const sheet = () => w.s.call('/v1/chapters/list', { character: w.eve.character }, w.eve.secret);
    for (let i = 0; i < 2; i++) { assert.equal((await list()).status, 200); assert.equal((await sheet()).status, 200); }   // the Turning, then the read that keeps its word
    const c = counted(w.s.env);
    for (let i = 0; i < 3; i++) { assert.equal((await list()).status, 200); assert.equal((await sheet()).status, 200); }
    c.off();
    assert.equal(asks(c.trips, /SELECT MAX\(week\) AS w FROM town_seat_weeks/), 0, 'the seats\' week: kept');
    assert.equal(asks(c.trips, /SELECT MAX\(week\) AS w FROM npc_chapter_weeks/), 0, 'the chapters\' week: kept');
    const raw = w.s.env.DB._raw;
    const seatWeeks = () => raw.prepare('SELECT COUNT(*) AS n FROM town_seat_weeks').get().n;
    const chapterWeeks = () => raw.prepare('SELECT COUNT(*) AS n FROM npc_chapter_weeks').get().n;
    const before = [seatWeeks(), chapterWeeks()];
    w.tick(SEAT_WEEK_MS / 1000 + CHAPTER_TURNING_GRACE_S + 1);   // past the boundary, and the chapters' grace
    const d = counted(w.s.env);
    assert.equal((await list()).status, 200);
    assert.equal((await list()).status, 200);   // D3: the seats' read that keeps their week, before the chapters' first
    assert.equal((await sheet()).status, 200);
    d.off();
    assert.equal(asks(d.trips, /SELECT MAX\(week\) AS w FROM town_seat_weeks/) >= 1, true, 'a new week: asked again');
    assert.equal(asks(d.trips, /SELECT MAX\(week\) AS w FROM npc_chapter_weeks/) >= 1, true);
    assert.deepEqual([seatWeeks(), chapterWeeks()], [before[0] + 1, before[1] + 1], 'and each week\'s Turning landed');
    const e = counted(w.s.env);
    assert.equal((await sheet()).status, 200);
    e.off();
    assert.equal(asks(e.trips, /SELECT MAX\(week\) AS w FROM npc_chapter_weeks/), 0, 'the sheet that settled the week kept its word: the next asks nothing');
    // D4: three weeks due, the second's settle dropped - the one settled is not the week kept, and the next read settles the rest
    w.tick(3 * SEAT_WEEK_MS / 1000);
    const at = chapterWeeks();
    const f = counted(w.s.env), real = w.s.env.DB.batch;
    let settles = 0;
    w.s.env.DB.batch = async (list) => { if (/^INSERT INTO npc_chapter_weeks \(week, active/.test(list[0]?._sql ?? '') && ++settles === 2) throw new Error('D1_ERROR: dropped'); return real(list); };
    try { assert.equal((await sheet()).status, 200); } finally { w.s.env.DB.batch = real; f.off(); }
    assert.equal(settles, 2, 'the second week\'s settle was the one dropped');
    assert.equal(chapterWeeks(), at + 1, 'one of the three settled');
    const g = counted(w.s.env);
    assert.equal((await sheet()).status, 200);
    g.off();
    assert.equal(asks(g.trips, /SELECT MAX\(week\) AS w FROM npc_chapter_weeks/) >= 1, true, 'the partial catch-up kept nothing: asked again');
    assert.equal(chapterWeeks(), at + 3, 'and the rest landed');
  } finally { w.done(); }
});

test('PRIMARY-FOLD the chapters\' sheet reads its halls, its chapters, their seats\' holders and the Season\'s patrons in ONE batch - each read as it was asked alone - beside the session\'s and the tombstone\'s; the sheet is the sheet it was (mutants: the halls read again; the patrons never read)', async () => {
  const w = await standWeeks();
  try {
    for (let i = 0; i < 2; i++) assert.equal((await w.s.call('/v1/chapters/list', { character: w.eve.character }, w.eve.secret)).status, 200);
    const c = counted(w.s.env);
    const r = await w.s.call('/v1/chapters/list', { character: w.eve.character }, w.eve.secret);
    c.off();
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.chapters));
    const batch = c.trips.find((t) => t.length > 1);
    assert.ok(batch, 'one batch');
    assert.equal(batch.length, 4, 'four reads in it, the Season counted');
    assert.match(batch[0], /FROM npc_hall_regions ORDER BY region/);
    assert.match(batch[1], /FROM npc_chapters$/);
    assert.match(batch[2], /FROM npc_chapter_seats s/);
    assert.match(batch[3], /JOIN guilds g ON g\.id = c\.patron WHERE c\.patron_season = \?1/);
    assert.equal(c.trips.length, 3, 'the session, the tombstone and the batch');
  } finally { w.done(); }
});

test('PRIMARY-FOLD a chapter claim reads its head, its Roll\'s rows and the record\'s word of its id in ONE batch, each asked as it was alone - before the batch that writes; credited, a repeat a repeat, an unseeded Roll unseeded; the hour\'s rate asked first - a claim it refuses reads nothing, and a repeat counts toward it (AUDIT PLAN-1000 D5) (mutants: the rows unread; the head asked again; the record unread - audit_chap1.json ACHAP-S6-EVENTS-REPEAT; the rate after the reads; the rate after a repeat\'s answer)', async () => {
  const realNow = Date.now;
  Date.now = () => T0 * 1000;
  try {
    const s = await standService({ CHAPTERS_OPEN: 'on' });
    const who = await s.registered('Audra');
    const R = await seatRealm(s.env, who.secret, 'Audra');
    const body = (extra) => ({ character: R.id, lease: R.lease, ...extra });
    const fresh = await s.call('/v1/chapters/claim', body({ rid: 'fold-000000', deltas: { 40: 1 }, members: [] }), who.secret);
    assert.equal(fresh.body.error, 'roll-unseeded', 'no Roll yet: unseeded, as ever');
    await s.call('/v1/chapters/roll', body({ seed: { factions: { 40: 10 }, members: [] } }), who.secret);
    const c = counted(s.env);
    const r = await s.call('/v1/chapters/claim', body({ rid: 'fold-000001', deltas: { 40: 1 }, members: [] }), who.secret);
    c.off();
    assert.equal(r.status, 200);
    assert.equal(r.body.credited[40], 1, 'credited');
    assert.equal(r.body.roll.factions[40], 11);
    const reads = c.trips.find((t) => t.length === 3 && /FROM npc_roll_heads/.test(t[0]));
    assert.ok(reads, 'one batch of three reads');
    assert.match(reads[1], /FROM npc_roll WHERE char_id = \?$/);
    assert.match(reads[2], /FROM npc_rep_events WHERE char_id = \? AND rid = \? LIMIT 1/);
    assert.ok(c.trips.indexOf(reads) < c.trips.findIndex((t) => t.some((q) => /^UPDATE npc_roll_heads/.test(q.trim()))), 'before the batch that writes');
    assert.equal(c.trips.flat().filter((q) => /FROM npc_roll_heads WHERE char_id = \? AND player = \?/.test(q)).length, 1, 'the head asked once');
    // an older claim replayed after a newer one: the record's word, from the batch
    await s.call('/v1/chapters/claim', body({ rid: 'fold-000002', deltas: { 40: 1 }, members: [] }), who.secret);
    const again = await s.call('/v1/chapters/claim', body({ rid: 'fold-000001', deltas: { 40: 1 }, members: [] }), who.secret);
    assert.equal(again.body.repeat, true, 'a repeat, by the record the batch read');
    assert.equal(again.body.roll.factions[40], 12, 'and the Roll as the batch read it');
    // D5: one claim short of the hour's - a repeat takes the last, and the next claim is refused before it reads a word
    s.env.DB._raw.prepare('UPDATE rate_limits SET count = ? WHERE key = ?').run(ROLL_CLAIMS_HOUR - 1, `roll-claim:${R.id}`);
    assert.equal((await s.call('/v1/chapters/claim', body({ rid: 'fold-000001', deltas: { 40: 1 }, members: [] }), who.secret)).body.repeat, true, 'the hour\'s last: a repeat');
    const h = counted(s.env);
    const over = await s.call('/v1/chapters/claim', body({ rid: 'fold-000003', deltas: { 40: 1 }, members: [] }), who.secret);
    h.off();
    assert.equal(over.body.error, 'roll-rate', 'the repeat counted toward the hour');
    assert.equal(h.trips.flat().filter((q) => /npc_roll_heads/.test(q)).length, 0, 'a claim the rate refuses reads nothing');
  } finally { Date.now = realNow; }
});

test('AUDIT PLAN-1000 C4 a claim the account\'s rate will refuse asks the tombstone alone - never the seat or the bucket - and is refused 429, the window\'s very next request the first refused (F2); the window after a full one asks the door once and lands; a claim the peek found full and its count let through - the window turned between them - asks its seat and lands (F1); a tombstone over its rate still hears 410 first, as it always did (mutants: the claim\'s reads asked of a refused claim; the count taken twice; the peek one late; the peek of any window; the seat unasked after the turn)', async () => {
  const t = await stand();
  try {
    // a fresh window (the stand's own requests counted in the last): every count below is this test's
    const nowS = (Math.floor(T0 / ACCOUNT_WINDOW_S) + 1) * ACCOUNT_WINDOW_S;
    Date.now = () => nowS * 1000;
    // one under the rate: the claim lands - the door's look at the rate counts nothing (the count is the door's own, once)
    for (let i = 0; i < ACCOUNT_MAX - 1; i++) overAccountRate(t.eve.id, nowS, ACCOUNT_MAX, ACCOUNT_WINDOW_S);
    assert.equal((await t.s.call('/v1/renown/xp', { character: t.eve.character, xp: 10, rid: '00000000000000c3' }, t.eve.secret)).status, 200, 'the last request the window holds');
    const c = counted(t.s.env);   // F2: the window holds ACCOUNT_MAX - the very next is the first refused
    const r = await t.s.call('/v1/renown/xp', { character: t.eve.character, xp: 10, rid: '00000000000000c4' }, t.eve.secret);
    c.off();
    assert.equal(r.status, 429);
    assert.equal(c.trips.flat().filter((q) => q.includes('AS seat_id')).length, 0, 'no claim reads');
    assert.equal(c.trips.flat().filter((q) => q === `SELECT 1 FROM realm_characters WHERE ${TOMB_WHERE}`).length, 1, 'the tombstone alone');
    // F2: the next window, after a full one - the door asked once, the claim landing
    const next = nowS + ACCOUNT_WINDOW_S;
    Date.now = () => next * 1000;
    const n = counted(t.s.env);
    assert.equal((await t.s.call('/v1/renown/xp', { character: t.eve.character, xp: 10, rid: '00000000000000c6' }, t.eve.secret)).status, 200, 'a new window: served');
    n.off();
    assert.equal(n.trips.flat().filter((q) => q.includes(TOMB_WHERE)).length, 1, 'the door asked once - the full window before it is no window of this one\'s');
    // F1: the window full in its last second, the claim held in its tombstone read while another request opens the next
    const last = next + 2 * ACCOUNT_WINDOW_S - 1;
    Date.now = () => last * 1000;
    for (let i = 0; i < ACCOUNT_MAX; i++) overAccountRate(t.eve.id, last, ACCOUNT_MAX, ACCOUNT_WINDOW_S);
    const db = t.s.env.DB, prepare = db.prepare.bind(db);
    let release, entered, held = false;
    const gate = new Promise((r) => { release = r; }), inDoor = new Promise((r) => { entered = r; });
    db.prepare = (sql) => {
      const st = prepare(sql);
      if (!held && sql === `SELECT 1 FROM realm_characters WHERE ${TOMB_WHERE}`) {
        held = true;
        const first = st.first.bind(st);
        st.first = async (...a) => { entered(); await gate; return first(...a); };
      }
      return st;
    };
    try {
      const A = t.s.call('/v1/renown/xp', { character: t.eve.character, xp: 10, rid: '00000000000000c7' }, t.eve.secret);
      await inDoor;
      Date.now = () => (last + 1) * 1000;   // the next window's first second
      assert.notEqual((await t.s.call('/v1/prof/state', {}, t.eve.secret)).status, 429, 'another request, counted in the next window, opens it');
      release();
      const a = await A;
      assert.deepEqual([a.status, a.body?.error], [200, undefined], 'the claim its count let through is asked its seat, and lands - never `progress-seat`');
    } finally { db.prepare = prepare; }
    t.raw.prepare('UPDATE realm_characters SET dead_at = ? WHERE id = ?').run(nowS, t.eve.character);
    const dead = await t.s.call('/v1/renown/xp', { character: t.eve.character, xp: 10, rid: '00000000000000c5' }, t.eve.secret);
    assert.deepEqual([dead.status, dead.body.error], [410, 'dead'], 'dead before over');
  } finally { t.done(); }
});
