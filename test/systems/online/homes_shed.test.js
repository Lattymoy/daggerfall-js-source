// HOMES-SHED (2026-10-13, from play: the account database overloaded from 14:11 UTC - "servers are under really heavy
// load. Fix whatever you can and quick"): the service's busiest route asks the database once where it asked twice, the
// siege blackout's question answers a throw as every other route does, and a client whose town went unanswered backs
// off instead of asking six times as often. bible/11-Multiplayer/Scale-Arc.md HOMES-SHED.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../../accountDb.mjs';
import { seatWeekOf } from '../../../src/net/townSeatLaw.js';
import { createOnlineHomes, HOME_TOWN_TTL_MS, HOME_RETRY_MS, HOME_RETRY_MAX_MS, homeRetryMs } from '../../../src/systems/online/onlineHomes.js';

/** The requests the database is asked, as D1 is asked them: a statement run alone is one request (its SQL), a batch is
 *  one request carrying its statements' SQL. */
function askedOf(db) {
  const asked = [];
  const prepare = db.prepare.bind(db), batch = db.batch.bind(db);
  db.prepare = (sql) => {
    const st = prepare(sql);
    st.sql = sql;
    for (const k of ['first', 'all', 'run']) {
      const run = st[k];
      st[k] = (...a) => { asked.push([sql]); return run(...a); };
    }
    return st;
  };
  db.batch = (list) => { asked.push(list.map((st) => st.sql)); return batch(list); };
  return asked;
}

const HOMES_SQL = /FROM homes h LEFT JOIN guilds g/;
const GATES_SQL = /edict = 'open-gates'/;

test('HOMES-SHED a town\'s homes and its Open Gates are ONE request: with the seats open the edict\'s read rides the homes read\'s batch - never a round trip of its own - and the answer is the one the two reads gave (the gates open, a private home public, its owner\'s own choice kept); with the seats closed the homes read goes alone and no edict is asked (mutants: the gates\' own trip; the gates unread)', async () => {
  const svc = await standService({ SEATS_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const owner = await svc.registered('Hanne');
  const visitor = await svc.registered('Vito');
  const T = 152;
  raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, 7, ?, ?, 'Hanne', 21, 'private', 1000, ?)").run(T, owner.id, owner.character, T0);
  const town = async (who) => (await svc.call('/v1/homes/town', { mapId: T, character: who.character }, who.secret)).body;
  const asked = askedOf(svc.env.DB);
  const homesAsked = () => asked.filter((a) => a.some((sql) => HOMES_SQL.test(sql)));

  // no edict: the gates shut, asked all the same - in the homes read's batch
  let seen = await town(visitor);
  assert.equal(seen.openGates, undefined);
  assert.equal(seen.homes[0].entry, 'private');
  assert.equal(homesAsked().length, 1, 'the homes read asked once');
  assert.equal(homesAsked()[0].length, 3, 'in a batch of three');   // PIN MOVED (TOMB-RIDES): the door's tombstone rides it too
  assert.ok(homesAsked()[0].some((sql) => GATES_SQL.test(sql)), 'the edict\'s read beside it');
  assert.ok(!asked.some((a) => a.length === 1 && GATES_SQL.test(a[0])), 'never a request of its own');

  // the town's holder proclaims Open Gates, and it rules this week (and the next, should the week turn mid-test)
  raw.prepare("INSERT INTO guilds (id, name, name_key, tag, ranks, founded_at) VALUES ('g-sh', 'The Silver Hand', 'the silver hand', 'SH', '[]', ?)").run(T0);
  const week = seatWeekOf(Date.now());
  for (const w of [week, week + 1]) raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, state, at) VALUES (?, ?, 'open-gates', 'g-sh', 'x', 'law', ?)").run(T, w, T0);
  asked.length = 0;
  seen = await town(visitor);
  assert.deepEqual([seen.openGates, seen.homes[0].entry], [true, 'public'], 'the edict read in the batch is the edict obeyed');
  assert.equal(homesAsked().length, 1);
  assert.equal(homesAsked()[0].length, 3);   // PIN MOVED (TOMB-RIDES)
  assert.equal(asked.filter((a) => a.some((sql) => GATES_SQL.test(sql))).length, 1, 'the edict asked once, in that batch');
  assert.equal((await town(owner)).homes[0].entry, 'private', 'its owner\'s own choice, kept');

  // the seats closed: the homes read alone, no edict asked
  svc.env.SEATS_OPEN = 'off';
  asked.length = 0;
  seen = await town(visitor);
  assert.equal(seen.openGates, undefined);
  assert.equal(seen.homes[0].entry, 'private');
  assert.deepEqual(homesAsked().map((a) => a.length), [2], 'the homes read, beside the tombstone alone');   // PIN MOVED (TOMB-RIDES): was [1]
  assert.ok(!asked.some((a) => a.some((sql) => GATES_SQL.test(sql))), 'no edict asked');
});

const TOMB_SQL = /FROM realm_characters WHERE id = \?2 AND player = \?1 AND dead_at IS NOT NULL/;

test('TOMB-RIDES a town\'s homes ask the named character\'s tombstone in their own batch - one request, never the door\'s trip before it, seats open or closed - and a tombstone is answered 410 `dead` as the door answered it; a read naming no character asks none (mutants: the tombstone unread; the door asks it too; a tombstone answered 400)', async () => {
  const svc = await standService({ SEATS_OPEN: 'on' });
  const raw = svc.env.DB._raw;
  const who = await svc.registered('Wayfarer');
  const T = 152;
  const FALLEN = 'r22222222222222222222';
  raw.prepare("INSERT INTO realm_characters (id, player, name, created_at, updated_at, dead_at) VALUES (?, ?, 'Fallen', 1, 1, 5)").run(FALLEN, who.id);
  const asked = askedOf(svc.env.DB);
  const tombAsked = () => asked.filter((a) => a.some((sql) => TOMB_SQL.test(sql)));
  const town = (body) => svc.call('/v1/homes/town', { mapId: T, ...body }, who.secret);
  for (const seats of ['on', 'off']) {
    svc.env.SEATS_OPEN = seats;
    asked.length = 0;
    const dead = await town({ character: FALLEN });
    assert.deepEqual([dead.status, dead.body], [410, { error: 'dead' }], `seats ${seats}: the door's own answer`);
    assert.equal(tombAsked().length, 1, `seats ${seats}: the tombstone asked once`);
    assert.ok(tombAsked()[0].some((sql) => HOMES_SQL.test(sql)), `seats ${seats}: in the homes read's batch`);
    asked.length = 0;
    const live = await town({ character: who.character });
    assert.equal(live.status, 200, `seats ${seats}: a live character reads its town`);
    assert.deepEqual(tombAsked().map((a) => a.length), [seats === 'on' ? 3 : 2], `seats ${seats}: one request carries it`);
  }
  asked.length = 0;
  assert.equal((await town({})).status, 200);
  assert.deepEqual(tombAsked(), [], 'no character named, no tombstone asked');
});

test('HOMES-SHED the siege blackout\'s question answers a throw as every route does: an overloaded D1 a 503 `server` and any other throw a 500 `server`, each logged with its path and counted on the request\'s metrics point - it was the one route above the service\'s try that asks the database, and its throw left the Worker as a bare 500 with no body, no log line and no point (mutants: the try taken away)', async () => {
  const points = [];
  const svc = await standService({ METRICS: { writeDataPoint: (p) => points.push(p) } });
  const live = () => svc.fetch('https://accounts.invalid/v1/seats/sieges/live', { method: 'GET' });
  let res = await live();
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { live: false, until: null }, 'answered: no siege');
  const said = [];
  const error = console.error;
  const prepare = svc.env.DB.prepare;
  console.error = (...a) => said.push(a.map(String).join(' '));
  try {
    for (const [message, status] of [['D1_ERROR: D1 DB is overloaded. Requests queued for too long. [code: 7429]', 503], ['D1_ERROR: no such table: town_seat_battles', 500]]) {
      svc.env.DB.prepare = (sql) => {
        const st = prepare.call(svc.env.DB, sql);
        // refused however it is run: the metrics point's own wrapper runs a bare first() as all() (SCALE4h)
        if (/FROM town_seat_battles/.test(sql)) for (const k of ['first', 'all', 'run']) st[k] = async () => { throw new Error(message); };
        return st;
      };
      res = await live();
      assert.equal(res.status, status, message);
      assert.match(res.headers.get('content-type') ?? '', /json/);
      assert.deepEqual(await res.json(), { error: 'server' });
      assert.ok(said.some((l) => l.includes('[account]') && l.includes('/v1/seats/sieges/live') && l.includes(message)), `logged with its path: ${message}`);
      assert.deepEqual([points.at(-1).blobs[2], points.at(-1).blobs[3]], [String(status), 'server'], 'counted on the metrics point');
    }
  } finally {
    console.error = error;
    svc.env.DB.prepare = prepare;
  }
});

test('HOMES-SHED a town unanswered backs off as a yard does (YARD-SHED\'s law): each failure in a row doubles the wait from HOME_RETRY_MS to HOME_RETRY_MAX_MS - 10 s, 20, 40, 80, 160, then 300 s however many more; an answer starts the count again; a forced ask (a write of mine to read back) is never held - it was HOME_RETRY_MS every time, a database too slow to answer asked six times as often as one that answered (mutants: flat; uncapped; the count never kept; the count never reset)', async () => {
  assert.deepEqual([HOME_RETRY_MS, HOME_RETRY_MAX_MS], [10_000, 300_000]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 40].map(homeRetryMs), [10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000, 300_000]);
  let now = 1_000_000;
  const calls = [];
  const api = { fail: true, async town(mapId) { calls.push(mapId); return api.fail ? { ok: false, error: 'server' } : { ok: true, data: { homes: [] } }; } };
  const homes = createOnlineHomes({ api, now: () => now });
  const T = 152;
  /** The town's next ask is held `w` ms after the last unanswered one: not a millisecond before, and asked at its end. */
  const heldFor = async (w) => {
    const n = calls.length;
    now += w - 1;
    await homes.ensure(T);
    assert.equal(calls.length, n, `not asked again before ${w} ms`);
    now += 1;
    await homes.ensure(T);
    assert.equal(calls.length, n + 1, `asked again at ${w} ms`);
  };
  await homes.ensure(T);
  assert.equal(calls.length, 1, 'asked, unanswered');
  for (const w of [10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000]) await heldFor(w);
  const n = calls.length;
  await homes.ensure(T, { force: true });
  assert.equal(calls.length, n + 1, 'a forced ask goes at once, whatever the wait');
  // an answer starts the count again: the next failure waits the first wait, not the tenth's
  api.fail = false;
  now += HOME_RETRY_MAX_MS;
  assert.equal(await homes.ensure(T), true, 'answered');
  api.fail = true;
  now += HOME_TOWN_TTL_MS;
  await homes.ensure(T);
  await heldFor(HOME_RETRY_MS);
  await heldFor(2 * HOME_RETRY_MS);
});
