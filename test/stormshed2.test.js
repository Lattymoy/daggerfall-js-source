// STORM-SHED 2 (2026-10-06, the account database's follow-ups after the second overload; bible/06-Systems/Online-Arc.md
// STORM-SHED 2): what the overload's numbers showed costing the database every hour, made small at the root:
//   A. the season's #1 - the whole board (BOARD_SQL) counted by every Worker each minute for the token's laurel, 109
//      million of the database's 760 million rows a day - kept in `arena_champions`, counted when a rated bout lands and
//      when the kept word is ARENA_CHAMPION_STORED_S old;
//   B. an account's rating - `a = ? OR b = ?` walked the season's every bout on every registered token - read off its own
//      bouts (MY_BOUTS_SQL), answering exactly what the old read answered; a Grand Champion's row found by its index;
//   C. the towns' layouts - a scan of every home at every boot, and every 24 s while unheard - kept until the database's
//      own triggers say a town's homes moved (`homes_gen`);
//   D. a Project Legacy save that changed nothing - stamped, rev moved, stored and written to the realm at every
//      two-minute checkpoint, and the checkpoint never idle - leaves the line as it was.
// Each pin failed on the build before it. tools/mutants/stormshed2.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { d1, standService } from './accountDb.mjs';
import { arenaRatingOf, arenaHonoursOf, _resetArenaCache, ARENA_CHAMPION_STORED_S } from '../server-account/src/arena.js';
import { arenaSeasonOf, ARENA_ELO_START, arenaRatingOk, ARENA_CHAMPION_MIN_BOUTS } from '../src/net/arenaLaw.js';
import { mintArenaReceipt } from '../src/net/arenaReceipt.js';
import { homeLayoutsKept } from '../server-account/src/homes.js';
import { createLegacyHost } from '../src/scenes/legacyHost.js';
import { loadFamily, storeFamily } from '../src/systems/legacy/store.js';
import { createRealmLine } from '../src/systems/legacy/realmLine.js';
import { _resetModSaveData, modSaveRecords } from '../src/systems/modSaveData.js';
import { _resetModSettings, setModSetting } from '../src/systems/modSettings.js';
import { LEGACY_MOD, MODELS, familyRng } from '../src/systems/legacy/family.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';

const { subtle } = globalThis.crypto;
const BOARD_MARK = 'ROW_NUMBER() OVER (PARTITION BY p';
const LAYOUTS_MARK = 'WHERE NOT EXISTS (SELECT 1 FROM homes o';

/** `db` with each statement whose SQL holds `mark` counted, and every statement's SQL kept. */
function counting(db, marks) {
  const c = Object.fromEntries(Object.keys(marks).map((k) => [k, 0]));
  const sqls = [];
  const wrap = Object.create(db);
  wrap.prepare = (sql) => { sqls.push(sql); for (const [k, m] of Object.entries(marks)) if (sql.includes(m)) c[k]++; return db.prepare(sql); };
  return { db: wrap, c, sqls };
}
const plan = (raw, sql, n) => raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...Array.from({ length: n }, (_, i) => (i === 0 ? 1 : 'p1'))).map((r) => r.detail).join(' | ');

// ═══ B. AN ACCOUNT'S RATING, OFF ITS OWN BOUTS ═══════════════════════════════════════════════════════════════════════

test('STORM-SHED 2 B: an account\'s rating is read off its own bouts - one read, planned on idx_arena_pvp_a and idx_arena_pvp_b, never the season\'s every bout - and answers what the `a = ? OR b = ?` read answered: the last rated rating, the wins, losses, draws and bouts, a bout fought against oneself counted once (mutants: a side unread; the OR back; the self-bout counted twice; the first bout read as the last; of one second\'s two, the first)', async () => {
  const db = d1();
  const raw = db._raw;
  raw.exec('PRAGMA foreign_keys = OFF');
  const ins = raw.prepare("INSERT INTO arena_pvp (bout, season, a, b, result, how, ra0, rb0, ra1, rb1, rated, banner_a, banner_b, at) VALUES (?, ?, ?, ?, ?, 'fall', 1000, 1000, ?, ?, ?, NULL, NULL, ?)");
  const P = ['p1', 'p2', 'p3', 'p4'];
  const rng = familyRng(7);
  let at = 1000;
  for (let i = 0; i < 300; i++) {
    const a = P[Math.floor(rng() * 4)];
    const b = P[(P.indexOf(a) + 1 + Math.floor(rng() * 3)) % 4];
    ins.run(`b${String(i).padStart(15, '0')}`, 1 + Math.floor(rng() * 2), a, b, Math.floor(rng() * 3), 900 + Math.floor(rng() * 400), 900 + Math.floor(rng() * 400), rng() < 0.8 ? 1 : 0, at += 1 + Math.floor(rng() * 3));
  }
  ins.run('bself00000000000', 1, 'p1', 'p1', 2, 1111, 1111, 1, at += 5);   // the one row whose two sides are one account
  const tie = at += 5;   // two bouts of one second: the last written is the last
  ins.run('btie000000000000', 1, 'p2', 'p3', 0, 1201, 1001, 1, tie);
  ins.run('btie000000000001', 1, 'p3', 'p2', 1, 1002, 1202, 1, tie);
  const old = (season, p) => {
    const last = raw.prepare('SELECT CASE WHEN a = ?2 THEN ra1 ELSE rb1 END AS r FROM arena_pvp WHERE season = ?1 AND rated = 1 AND (a = ?2 OR b = ?2) ORDER BY at DESC, rowid DESC LIMIT 1').get(season, p);
    const t = raw.prepare(`SELECT SUM(CASE WHEN (a = ?2 AND result = 0) OR (b = ?2 AND result = 1) THEN 1 ELSE 0 END) AS w,
      SUM(CASE WHEN (a = ?2 AND result = 1) OR (b = ?2 AND result = 0) THEN 1 ELSE 0 END) AS l,
      SUM(CASE WHEN result = 2 THEN 1 ELSE 0 END) AS d, COUNT(*) AS n FROM arena_pvp WHERE season = ?1 AND rated = 1 AND (a = ?2 OR b = ?2)`).get(season, p);
    return { rating: last ? arenaRatingOk(Number(last.r)) : ARENA_ELO_START, wins: Number(t.w ?? 0), losses: Number(t.l ?? 0), draws: Number(t.d ?? 0), bouts: Number(t.n ?? 0) };
  };
  for (const s of [1, 2, 3]) for (const p of [...P, 'nobody']) assert.deepEqual(await arenaRatingOf({ db }, p, s), old(s, p), `season ${s}, ${p}`);
  const { db: cdb, sqls } = counting(db, {});
  await arenaRatingOf({ db: cdb }, 'p1', 1);
  assert.equal(sqls.length, 1, 'one read');
  const p = plan(raw, sqls[0], 2);
  assert.match(p, /idx_arena_pvp_a \(a=\? AND season=\?\)/);
  assert.match(p, /idx_arena_pvp_b \(b=\? AND season=\?\)/);
  assert.doesNotMatch(p, /idx_arena_pvp_season/, 'never the season\'s every bout');
});

test('STORM-SHED 2 B: a Grand Champion\'s row, asked on every registered account\'s token, is found by the account and the bout on idx_arena_pve_player_grand - never every ladder bout the account fought (mutant: migration 0086\'s index unwritten)', async () => {
  const db = d1();
  const { db: cdb, sqls } = counting(db, {});
  await arenaHonoursOf({ db: cdb }, { id: 'p1', handle: 'Somebody' }, 1_800_000_000).catch(() => null);
  const grand = sqls.find((s) => s.includes('FROM arena_pve WHERE player = ?1 AND tier ='));
  assert.ok(grand, 'the Grand Champion\'s ask');
  assert.match(plan(db._raw, grand, 1).replace(/^/, ''), /USING COVERING INDEX idx_arena_pve_player_grand \(player=\? AND tier=\? AND step=\? AND won=\?\)/);
});

// ═══ A. THE SEASON'S #1, KEPT ════════════════════════════════════════════════════════════════════════════════════════

test('STORM-SHED 2 A: the season\'s #1 is counted when a rated bout lands and kept for every Worker - a token read off the kept word counts no board; a word ARENA_CHAMPION_STORED_S old is counted again (mutants: the claim\'s count dropped; the kept word unread; never counted again; the count\'s failure the claim\'s)', async (t) => {
  let now = 1_800_000_000;
  t.mock.method(Date, 'now', () => now * 1000);
  _resetArenaCache();
  const S = await standService();
  const season = arenaSeasonOf(now);
  const A = await S.registered('Alva');
  const foes = [await S.registered('Brann'), await S.registered('Ceryn'), await S.registered('Doran'), await S.registered('Eldis'), await S.registered('Fenn')];
  let j = 0;
  const bout = () => (++j).toString(16).padStart(16, '0');
  for (let i = 0; i < ARENA_CHAMPION_MIN_BOUTS; i++) {
    const foe = foes[i % foes.length];
    const receipt = await mintArenaReceipt({ a: 'p', j: bout(), f: [A.id, foe.id], r: 0, h: 'fall' }, S.gatePriv, { subtle, nowS: now });
    const r = await S.call('/v1/arena/claim', { receipt }, A.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    now += 60;
  }
  const row = () => S.env.DB._raw.prepare('SELECT player, at FROM arena_champions WHERE season = ?').get(season);
  assert.equal(row()?.player, A.id, 'the claims counted the #1 and kept it');
  const { db, c } = counting(S.env.DB, { board: BOARD_MARK });
  S.env.DB = db;
  _resetArenaCache();   // another Worker
  assert.equal((await S.call('/v1/auth/token', {}, foes[0].secret)).status, 200);
  assert.equal(c.board, 0, 'a token read off the kept word: no board counted');
  assert.equal((await arenaHonoursOf({ db }, { id: A.id, handle: 'Alva' }, now)).champion, true, 'the kept word names the #1');
  now += ARENA_CHAMPION_STORED_S;
  _resetArenaCache();
  assert.equal((await S.call('/v1/auth/token', {}, foes[1].secret)).status, 200);
  assert.equal(c.board, 1, 'the kept word ARENA_CHAMPION_STORED_S old: counted again');
  assert.equal(row()?.at, now, 'and kept again');
  assert.equal(ARENA_CHAMPION_STORED_S, 600);
  // the count is the claim's afterword: one that fails leaves the bout recorded, and the kept word to its age
  const G = await S.registered('Gwyn');
  const failing = Object.create(db);
  failing.prepare = (sql) => { if (sql.includes(BOARD_MARK)) throw new Error('D1 DB is overloaded. Requests queued for too long.'); return db.prepare(sql); };
  S.env.DB = failing;
  const receipt = await mintArenaReceipt({ a: 'p', j: bout(), f: [A.id, G.id], r: 0, h: 'fall' }, S.gatePriv, { subtle, nowS: now });
  const r = await S.call('/v1/arena/claim', { receipt }, A.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.recorded, true, 'the board\'s count failed: the bout recorded all the same');
});

// ═══ C. THE TOWNS' LAYOUTS ═══════════════════════════════════════════════════════════════════════════════════════════

test('STORM-SHED 2 C: the towns\' layouts are read again only once the database says a town\'s homes moved - a home made, gone, or moved to another layout reads afresh; a home\'s door opened or its rent moved does not; asks of one moment share the read (mutants: the generation unasked; each trigger dropped; a trigger on every column; the shared ask; an older read shared; the route unkept; kept per request)', async () => {
  const S = await standService();
  const raw = S.env.DB._raw;
  raw.exec('PRAGMA foreign_keys = OFF');
  const { db, c } = counting(S.env.DB, { scan: LAYOUTS_MARK });
  const layouts = async () => (await homeLayoutsKept({ db })).towns;
  assert.deepEqual(await layouts(), []);
  assert.deepEqual(await layouts(), []);
  assert.equal(c.scan, 1, 'nothing moved: the kept answer');
  const home = (mapId, key, layout = null, at = 100) => raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, price, bought_at, layout) VALUES (?, ?, 'p1', 'c1', 'Owner', 17, 5000, ?, ?)").run(mapId, key, at, layout);
  const BV = 'beautiful-villages@1.0', BC = 'beautiful-cities@2.1';   // homeLaw.js homeLayoutOk: a stamp the read answers
  home(5001, 1, BV);
  assert.deepEqual(await layouts(), [[5001, BV]], 'a home made: read afresh');
  assert.equal(c.scan, 2);
  raw.prepare("UPDATE homes SET entry = 'open', rent_due = 5 WHERE map_id = 5001").run();
  await layouts();
  assert.equal(c.scan, 2, 'a door opened, rent moved: kept');
  raw.prepare('UPDATE homes SET layout = ? WHERE map_id = 5001').run(BC);
  assert.deepEqual(await layouts(), [[5001, BC]], 'a layout moved: read afresh');
  raw.prepare('DELETE FROM homes WHERE map_id = 5001').run();
  assert.deepEqual(await layouts(), [], 'the town\'s last home gone: read afresh');
  home(6001, 2);
  const n = c.scan;
  await Promise.all([layouts(), layouts(), layouts()]);
  assert.equal(c.scan, n + 1, 'three asks of one moment: one read');
  // an ask made while an older generation's read is out reads for itself - the gate opened before either is awaited,
  // so a mutant that hands it the older read answers the older towns rather than hanging
  let open, heard, holding = true;
  const gate = new Promise((r) => { open = r; }), out = new Promise((r) => { heard = r; });
  const held = Object.create(db);
  held.prepare = (sql) => {
    const st = db.prepare(sql);
    if (!holding || !sql.includes(LAYOUTS_MARK)) return st;
    holding = false;   // the first scan only: read now, answered once the gate opens
    return { bind: (...a) => ({ all: async () => { const r = await st.bind(...a).all(); heard(); await gate; return r; } }) };
  };
  home(6001, 3);   // a new generation for the held read
  const older = homeLayoutsKept({ db: held });
  await out;
  home(7001, 4, BV);   // and another while that read is out
  const newer = homeLayoutsKept({ db: held });
  open();
  assert.deepEqual((await newer).towns, [[6001, null], [7001, BV]], 'the newer generation read for itself, never handed the older read');
  assert.deepEqual((await older).towns, [[6001, null]], 'the older ask answered by its own read');
  // the route answers this Worker's kept read - per database binding, never per request (metrics.js DB_ROOT)
  const guest = (await S.guest()).secret;
  S.env.DB = db;
  S.env.METRICS = { writeDataPoint: () => {} };   // every request's database wrapped, as the deployed service's is
  await S.call('/v1/homes/layouts', {}, guest);   // this Worker's read of the newest generation, kept
  const m = c.scan;
  assert.deepEqual((await S.call('/v1/homes/layouts', {}, guest)).body.towns, [[6001, null], [7001, BV]]);
  await S.call('/v1/homes/layouts', {}, guest);
  assert.equal(c.scan, m, 'two more boots\' asks through the route: the kept read');
});

// ═══ D. A SAVE THAT CHANGED NOTHING ══════════════════════════════════════════════════════════════════════════════════

test('STORM-SHED 2 D: a Project Legacy save that changed nothing leaves the line as it was - no stamp, no rev, nothing stored, nothing written to the realm - while the store still holds this page\'s last write: a change stores it, one made outside the save included; another tab\'s write since is merged in; a write the storage refused, or the realm dropped, is made again (mutants: every save stored; the stamps kept; the store\'s rev unasked; a refused write counted as written; the realm not asked again)', async () => {
  _resetModSettings();
  _resetModSaveData();
  const mem = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
  const storage = mem();
  let wall = 1_000_000, own = 0, refuse = false, drop = false;
  const real = storage.setItem;
  storage.setItem = (k, v) => { if (refuse) throw new Error('QuotaExceededError'); real(k, v); };
  /** The realm's writes, as realmLine.js makes them (world.js `stored`): one record each - and the pushes a save made,
   *  waited on (never a flush: a page flushes only as it goes, and a flush would make the dropped write itself). */
  const puts = [], pushing = [];
  const line = createRealmLine({ io: () => ({}), storage: () => storage,
    put: async (_io, _id, record) => { puts.push(record.rev); return drop ? { ok: false, error: 'network' } : { ok: true, data: { rev: record.rev } }; } });
  const entity = { name: 'Ysolde Hlaalu', gender: 'female', race: 'DarkElf', raceId: 4, faceIndex: 3, careerIndex: 5,
    career: { name: 'Nightblade', primarySkills: [28, 22, 16], majorSkills: [19, 24, 13], minorSkills: [1, 2, 3, 4, 5, 6] },
    level: 7, characterId: 'c-ysolde', chargenDone: true, levelingSystem: 'virtue',
    stats: { strength: 60, intelligence: 72, willpower: 55, agility: 80, endurance: 50, personality: 40, speed: 70, luck: 50 },
    skills: Array.from({ length: 35 }, (_, i) => 10 + i) };
  const host = createLegacyHost({
    entity, storage: () => storage, tab: () => mem(), on: () => true, online: () => true, now: () => 100, own: () => own, wall: () => wall,
    here: () => ({ pixel: { x: 10, y: 20 }, region: 'Daggerfall', mode: 'exterior', loc: 'Gothway Garden', locationType: LOCATION_TYPES.TownCity, mapId: 5001 }),
    town: (h) => ({ region: h.region, loc: h.loc, mapId: h.mapId }), nearestTown: () => ({ region: 'Daggerfall', loc: 'Gothway Garden' }),
    gold: () => 100, say: () => {}, boot: () => {}, search: () => '?world', loadCharacter: () => true, saveNow: () => true, inFight: () => false,
    rng: familyRng(9), heldHouses: () => [], houseHere: () => null, stored: (f) => { pushing.push(line.push(f)); },
  });
  setModSetting(LEGACY_MOD, 'Family.Siblings Probability', 0);
  host.found(MODELS.enduring);
  const id = host.family.id;
  /** A checkpoint two minutes on: the line it carries, once the realm writes it asked for settle. */
  const save = async () => { wall += 120_000; own += 120; const text = JSON.stringify(modSaveRecords().ProjectLegacy); await Promise.all(pushing.splice(0)); return text; };
  const first = await save();
  const n = puts.length;
  assert.equal(await save(), first, 'nothing done: the line byte for byte - no stamp, no rev');
  assert.equal(await save(), first);
  assert.equal(puts.length, n, 'nothing written to the realm');
  assert.equal(loadFamily(storage, id).rev, JSON.parse(first).rev, 'nor stored');

  entity.level = 8;   // something happened
  const changed = await save();
  assert.equal(JSON.parse(changed).rev, JSON.parse(first).rev + 1, 'a change: the rev moved once');
  assert.equal(puts.length, n + 1, 'stored, and written to the realm');
  host.family.people[0].note = 'outside';   // a change made outside the save, left for it to store (as a death is)
  assert.equal(JSON.parse(await save()).people[0].note, 'outside');
  assert.equal(loadFamily(storage, id).people[0].note, 'outside', 'measured against the last write, never the save\'s own start');

  // another tab's write since: taken in by this save, as every save took it before
  const other = loadFamily(storage, id);
  const base = other.rev;
  other.people[0].toll = 7;
  other.rev = base + 1;
  assert.ok(storeFamily(storage, other, base));
  assert.equal(JSON.parse(await save()).people[0].toll, 7, 'another tab\'s fact merged in');
  assert.equal(loadFamily(storage, id).people[0].toll, 7);
  const settled = await save();
  assert.equal(await save(), settled, 'and idle again');

  // the realm dropped a write: the next save, a change or none, asks it again, and once it lands, never
  drop = true;
  entity.level = 9;
  await save();
  const tries = puts.length;
  drop = false;
  const idle = await save();
  assert.equal(puts.length, tries + 1, 'the dropped write made again');
  assert.equal(await save(), idle);
  assert.equal(puts.length, tries + 1, 'and once landed, never again');

  // the storage refused a write: the next save makes it, though nothing changed since
  refuse = true;
  entity.level = 10;
  await save();
  refuse = false;
  assert.notEqual(loadFamily(storage, id).people[0].level, 10);
  await save();
  assert.equal(loadFamily(storage, id).people[0].level, 10, 'a refused write made again by the next save');
});
