// RESTORE C (2026-09-29, Mac: "I want people to get their stuff back"; of the homes a deleted customs character took
// with it: "To the offline character"). The houses, pieces, hidden lists, guild places and tracks the door's Delete took
// with a customs character - between CUSTOMS-CARRY and HOUSE-LOSS - exist only in D1's history. The operator's workflow
// (.github/workflows/realm-restore.yml) reads a snapshot from before the loss and the database as it stands, and
// tools/realmRestore.mjs plans them back. These pins build both over the REAL migrations, run the plan, apply its SQL to
// the present, and read what stands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { planRestore, planReport, loadDump, lit, handlesOf, THEN_TABLES, NOW_TABLES } from '../../tools/realmRestore.mjs';
import { GUILD_MEMBERS_MAX, GUILD_RANK_MASTER } from '../../src/net/guild/guildLaw.js';
import worker from '../../server-account/src/index.js';
import { accountRefusalText } from '../../src/net/accountClient.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';   // TERMS1 (at the merge with main): a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function db() {
  const d = new DatabaseSync(':memory:');
  d.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) d.exec(src(`server-account/migrations/${f}`));
  return d;
}
/** The Worker's view of a database: D1's face over node:sqlite, its batch one transaction (test/server/fb0929_customs.test.js). */
function d1face(d) {
  return {
    prepare(sql) {
      const stmt = d.prepare(sql);
      const writes = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
      let args = [];
      const st = {
        bind(...a) { args = a; return st; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(d.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return st;
    },
    async batch(list) {
      d.exec('BEGIN');
      try { const out = list.map((st) => st._result()); d.exec('COMMIT'); return out; } catch (e) { d.exec('ROLLBACK'); throw e; }
    },
  };
}
const run = (d, sql, ...a) => d.prepare(sql).run(...a);
const rows = (d, sql, ...a) => d.prepare(sql).all(...a).map((r) => ({ ...r }));
const R = (n) => `r${String(n).padStart(20, '0')}`;

/** The world as it stood BEFORE the loss, and as it stands NOW - one pair per scenario, over the real schema. */
function world() {
  const then = db(), now = db();
  for (const d of [then, now]) {
    for (const p of ['gary', 'taken', 'trader', 'intact', 'seller', 'rebuyer', 'nothing', 'thief', 'crowd', 'copy', 'orphan']) run(d, "INSERT INTO players (id, guest_name, created_at, last_seen) VALUES (?, 'A Guest', 1, 1)", p);
  }
  const home = (d, player, char, key, pieces = 3) => {
    run(d, "INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (4242, ?, ?, ?, 'Owner', 17, 'private', 40000, 1)", key, player, char);
    for (let i = 0; i < pieces; i++) run(d, "INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid) VALUES (4242, ?, ?, 41000, '{}', 1, 0)", key, `p${i}`);
    run(d, "INSERT INTO home_hidden (map_id, building_key, keys) VALUES (4242, ?, '[\"b1\"]')", key);
  };
  const guild = (d, id, name) => run(d, "INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES (?, ?, ?, ?, '[]', 0, 1)", id, name, name.toLowerCase(), id.slice(0, 4).toUpperCase());
  const member = (d, player, char, g, rank) => run(d, "INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, 'Owner', 1)", player, char, g, rank);
  // THEN: every pre-realm home under its offline id
  home(then, 'gary', 'gary-o', 1);
  guild(then, 'gorder', 'The Order'); member(then, 'gary', 'gary-o', 'gorder', GUILD_RANK_MASTER);
  run(then, "INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES ('gary', 'gary-o', 'Gary', 900, 1, 1)");
  home(then, 'taken', 'taken-o', 2);
  home(then, 'trader', 'trader-o', 3);
  home(then, 'intact', 'intact-o', 4);
  home(then, 'seller', 'seller-o', 5);
  home(then, 'rebuyer', 'rebuyer-o', 6);
  home(then, 'orphan', 'orphan-o', 8);   // brought in before CUSTOMS-CARRY, its realm character deleted: the home never moved
  guild(then, 'gfull', 'The Full'); member(then, 'crowd', 'crowd-o', 'gfull', 3);
  guild(then, 'gmast', 'The Mastered'); member(then, 'thief', 'thief-o', 'gmast', GUILD_RANK_MASTER);
  // NOW: the census, as customs spends it (every row of a character brought in)
  for (const [p, o] of [['gary', 'gary-o'], ['copy', 'gary-o'], ['taken', 'taken-o'], ['trader', 'trader-o'], ['seller', 'seller-o'], ['rebuyer', 'rebuyer-o'], ['nothing', 'nothing-o'], ['crowd', 'crowd-o'], ['thief', 'thief-o']]) {
    run(now, 'INSERT INTO realm_census (player, char_id, spent) VALUES (?, ?, 1)', p, o);
  }
  run(now, "INSERT INTO realm_census (player, char_id, spent) VALUES ('intact', 'intact-o', 0)");
  // gary, taken, trader, rebuyer, nothing, crowd, thief: brought in and deleted - their rows went with the realm id
  home(now, 'intact', 'intact-o', 4);   // never brought in: untouched
  home(now, 'orphan', 'orphan-o', 8);   // still under the offline id, intact - only the census keeps it from coming in
  run(now, "INSERT INTO realm_census (player, char_id, spent) VALUES ('orphan', 'orphan-o', 1)");
  run(now, "INSERT INTO realm_characters (id, player, name, seq, bytes, origin_id, created_at, updated_at) VALUES (?, 'seller', 'S', 3, 10, 'seller-o', 1, 1)", R(5));   // sold its home itself, and stands
  home(now, 'thief', R(9), 2);   // someone else bought taken's building since
  run(now, "INSERT INTO realm_characters (id, player, name, seq, bytes, created_at, updated_at) VALUES (?, 'rebuyer', 'N', 2, 10, 1, 1)", R(6));
  home(now, 'rebuyer', R(6), 6, 0);   // bought its own building again, bare, with a new character
  run(now, 'DELETE FROM home_hidden WHERE building_key = 6');
  run(now, "INSERT INTO realm_trades (sid, a_player, a_char, a_lease, a_seq, a_half, b_player, b_char, state, result, created_at) VALUES ('s1', 'trader', ?, 'l', 1, '{}', 'someone', ?, 'done', '{}', 1)", R(3), R(99));   // a deleted character of trader's traded
  guild(now, 'gorder', 'The Order');   // gary's guild stands, empty
  guild(now, 'gfull', 'The Full');
  for (let i = 0; i < GUILD_MEMBERS_MAX; i++) { run(now, "INSERT INTO players (id, guest_name, created_at, last_seen) VALUES (?, 'A Guest', 1, 1)", `m${i}`); member(now, `m${i}`, `c${i}`, 'gfull', 5); }
  guild(now, 'gmast', 'The Mastered'); run(now, "INSERT INTO players (id, guest_name, created_at, last_seen) VALUES ('newm', 'A Guest', 1, 1)"); member(now, 'newm', 'nc', 'gmast', GUILD_RANK_MASTER);
  return { then, now };
}

test('RESTORE C: the plan - every home, piece, hidden list, guild place and track a deleted customs character took comes back to its offline character, and the character may be brought in again; a trader\'s account is held; a building someone else holds is reported, never written; what was never lost is left be', () => {
  const { then, now } = world();
  const handles = new Map([['gary', 'GarySoup'], ['taken', 'Unlucky'], ['trader', 'Trader'], ['thief', 'Buyer'], ['crowd', 'Crowd'], ['rebuyer', 'Again']]);
  const plan = planRestore({ then, now, handles });
  assert.deepEqual(plan.restored.map((e) => [e.handle, e.origin, e.homes.map((h) => [h.building, h.rebought]), e.pieces, e.hidden, e.guild, e.track]), [
    ['GarySoup', 'gary-o', [['4242/1', false]], 3, 1, true, true],
    ['Again', 'rebuyer-o', [['4242/6', true]], 3, 1, false, false],
  ]);
  assert.deepEqual(plan.held.map((h) => [h.handle, h.origin]), [['Trader', 'trader-o']]);
  assert.deepEqual(plan.taken.map((t) => [t.handle, t.building, t.by]), [['Unlucky', '4242/2', 'Buyer']]);
  assert.deepEqual(plan.notes, ['Crowd: The Full is full - the place waits for you', 'Buyer: The Mastered has a master again - the place waits for you']);
  assert.deepEqual([...plan.reopened].sort(), ['crowd-o', 'gary-o', 'nothing-o', 'orphan-o', 'rebuyer-o', 'taken-o', 'thief-o'], 'every deleted customs character but the held one; the seller\'s still stands');
  assert.equal(plan.restored.some((e) => e.origin === 'orphan-o'), false, 'a home that never moved is not lost: the census alone kept it, and it is opened');
  // applied to the present
  now.exec(plan.sql);
  assert.deepEqual(rows(now, 'SELECT player, char_id FROM homes WHERE building_key = 1'), [{ player: 'gary', char_id: 'gary-o' }], 'back under the offline id');
  assert.deepEqual([rows(now, 'SELECT COUNT(*) AS n FROM home_decor WHERE building_key = 1')[0].n, rows(now, 'SELECT keys FROM home_hidden WHERE building_key = 1')], [3, [{ keys: '["b1"]' }]]);
  assert.deepEqual(rows(now, "SELECT guild_id, rank FROM guild_members WHERE player = 'gary'"), [{ guild_id: 'gorder', rank: GUILD_RANK_MASTER }]);
  assert.deepEqual(rows(now, "SELECT xp FROM renown_tracks WHERE player = 'gary'"), [{ xp: 900 }]);
  assert.deepEqual(rows(now, "SELECT player, spent FROM realm_census WHERE char_id = 'gary-o' ORDER BY player"), [{ player: 'copy', spent: 0 }, { player: 'gary', spent: 0 }], 'unspent on every account, as the census stood');
  assert.deepEqual(rows(now, "SELECT spent FROM realm_census WHERE char_id = 'trader-o'"), [{ spent: 1 }], 'held: nothing written');
  assert.deepEqual(rows(now, 'SELECT player, char_id FROM homes WHERE building_key = 2'), [{ player: 'thief', char_id: R(9) }], 'the buyer keeps it');
  assert.deepEqual([rows(now, 'SELECT player, char_id FROM homes WHERE building_key = 6'), rows(now, 'SELECT COUNT(*) AS n FROM home_decor WHERE building_key = 6')[0].n], [[{ player: 'rebuyer', char_id: R(6) }], 3], 'bought again: its pieces back into it');
  assert.deepEqual(rows(now, 'SELECT player FROM homes WHERE building_key = 5'), [], 'the seller sold it itself: nothing');
  assert.deepEqual(rows(now, "SELECT spent FROM realm_census WHERE char_id = 'seller-o'"), [{ spent: 1 }], 'its realm character stands');
  assert.deepEqual(rows(now, "SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = 'gfull'")[0].n, GUILD_MEMBERS_MAX, 'a full guild takes nobody');
  // run twice, nothing more: every statement is INSERT OR IGNORE, or the census's guarded UPDATE
  const before = rows(now, 'SELECT (SELECT COUNT(*) FROM homes) AS h, (SELECT COUNT(*) FROM home_decor) AS d, (SELECT COUNT(*) FROM guild_members) AS g');
  now.exec(plan.sql);
  assert.deepEqual(rows(now, 'SELECT (SELECT COUNT(*) FROM homes) AS h, (SELECT COUNT(*) FROM home_decor) AS d, (SELECT COUNT(*) FROM guild_members) AS g'), before);
  // and once the characters are brought in again, a second plan finds nothing to do
  const report = planReport(plan);
  assert.match(report, /- GarySoup: home 4242\/1, guild place, 3 pieces/);
  assert.match(report, /- HELD Trader: /);
  assert.match(report, /- TAKEN Unlucky: building 4242\/2 belongs to Buyer now/);
});

test('RESTORE C: the census\'s own law in the SQL - a character that stands in the realm again by the time it runs is never reopened; an empty plan writes nothing; a realm id is never an origin', () => {
  const { then, now } = world();
  const plan = planRestore({ then, now });
  // gary is brought in again by another route before the restore runs
  run(now, "INSERT INTO realm_characters (id, player, name, seq, bytes, origin_id, created_at, updated_at) VALUES (?, 'gary', 'G', 1, 10, 'gary-o', 1, 1)", R(77));
  now.exec(plan.sql);
  assert.deepEqual(rows(now, "SELECT spent FROM realm_census WHERE char_id = 'gary-o' AND player = 'gary'"), [{ spent: 1 }], 'a character standing is never reopened');
  const quiet = planRestore({ then: db(), now: db() });
  assert.deepEqual([quiet.sql, quiet.restored, quiet.reopened], ['', [], []]);
  const odd = db();
  run(odd, "INSERT INTO players (id, guest_name, created_at, last_seen) VALUES ('p', 'A Guest', 1, 1)");
  run(odd, 'INSERT INTO realm_census (player, char_id, spent) VALUES (?, ?, 1)', 'p', R(1));
  assert.deepEqual(planRestore({ then: db(), now: odd }).reopened, []);
});

test('RESTORE C: the dumps and the words - a wrangler export loads with its foreign keys off (a dump carries some tables, not the ones they point at); a literal is quoted, whole or NULL, and nothing else; handles come from `d1 execute --json`', () => {
  const dump = [
    'PRAGMA defer_foreign_keys=TRUE;',
    'CREATE TABLE homes (map_id INTEGER NOT NULL, building_key INTEGER NOT NULL, player TEXT NOT NULL, char_id TEXT NOT NULL, owner_name TEXT, region INTEGER, entry TEXT, price INTEGER, bought_at INTEGER, paid INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (map_id, building_key), FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE);',
    "INSERT INTO \"homes\" (\"map_id\",\"building_key\",\"player\",\"char_id\",\"owner_name\",\"region\",\"entry\",\"price\",\"bought_at\",\"paid\") VALUES(1,2,'p','o''brien','O''Brien',3,'private',100,5,0);",
  ].join('\n');
  const d = loadDump(dump);
  assert.deepEqual(rows(d, 'SELECT char_id, owner_name FROM homes'), [{ char_id: "o'brien", owner_name: "O'Brien" }]);
  assert.deepEqual([lit(null), lit(7), lit("it's")], ['NULL', '7', "'it''s'"]);
  assert.throws(() => lit(1.5));
  assert.throws(() => lit({}));
  assert.deepEqual([...handlesOf(JSON.stringify([{ results: [{ id: 'a', handle: 'GarySoup' }, { id: 'b', handle: null }], success: true }])).entries()], [['a', 'GarySoup']]);
  assert.equal(handlesOf('not json').size, 0);
  assert.deepEqual([...THEN_TABLES], ['homes', 'home_decor', 'home_hidden', 'guild_members', 'renown_tracks']);
  assert.ok(NOW_TABLES.includes('realm_trades') && NOW_TABLES.includes('realm_census') && NOW_TABLES.includes('realm_characters'));
});

test('RESTORE C: the operator\'s workflow - by hand only, never beside a deploy, a dry run unless asked; the service held for maintenance first; the present\'s bookmark kept, the rewind proven, and the present put back ALWAYS, proven by its counts; the switch lifted only once the present is back; inputs reach the scripts as environment, never pasted into them', () => {
  const wf = src('.github/workflows/realm-restore.yml');
  assert.match(wf, /^on:\n {2}workflow_dispatch:/m, 'run by hand from the Actions tab, and only so');
  assert.doesNotMatch(wf, /^\s+(push|schedule|pull_request):/m);
  assert.match(wf, /concurrency:\n {2}group: account-deploy\n {2}cancel-in-progress: false/);
  assert.match(wf, /apply:\n(?:.*\n)*? {8}default: false/, 'a dry run unless asked');
  assert.match(wf, /BEFORE: \$\{\{ inputs\.before \}\}/);
  assert.match(wf, /APPLY: \$\{\{ inputs\.apply \}\}/);
  assert.equal((wf.match(/\$\{\{ inputs\./g) ?? []).length, 2, 'the two inputs reach the job as environment, and nowhere else');
  const order = ['Hold the service for maintenance', 'Keep the present', 'Export the present', 'Rewind to before the loss', 'Export what stood then', 'Put the present back', 'Plan the restore', 'Write the restore', 'Lift the maintenance'];
  const at = order.map((name) => wf.indexOf(`- name: ${name}`));
  assert.ok(at.every((i) => i > 0), `every step named: ${order.filter((_, i) => at[i] < 0)}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in this order');
  const step = (name) => wf.slice(wf.indexOf(`- name: ${name}`), wf.indexOf('- name:', wf.indexOf(`- name: ${name}`) + 8) >>> 0 || undefined);
  assert.match(step('Put the present back'), /if: always\(\) && env\.REWOUND == '1'/);
  assert.match(step('Put the present back'), /time-travel restore "\$DB_NAME" --bookmark "\$NOW_BOOKMARK"/);
  assert.match(step('Put the present back'), /REWOUND=0/);
  assert.match(step('Rewind to before the loss'), /REWOUND=1/);
  assert.match(step('Rewind to before the loss'), /time-travel restore "\$DB_NAME" --timestamp "\$BEFORE"/);
  assert.match(step('Rewind to before the loss'), /NOW_BOOKMARK/, 'the rewind is proven by the bookmark moving');
  assert.match(step('Lift the maintenance'), /if: always\(\) && env\.REWOUND != '1'/, 'never over a rewound database');
  assert.match(step('Write the restore'), /if: env\.APPLY == 'true'/);
  assert.match(step('Plan the restore'), /node tools\/realmRestore\.mjs --then "\$RUNNER_TEMP\/then\.sql" --now "\$RUNNER_TEMP\/now\.sql"/);
  assert.match(step('Hold the service for maintenance'), /deploy --var MAINTENANCE:1/);
  assert.match(step('Hold the service for maintenance'), /-X POST "\$base\/v1\/realm\/customs" -H 'content-type: application\/json' -d '\{\}' /, 'the write proven refused is asked with no credential');
  assert.doesNotMatch(wf, /\/v1\/auth\//, 'never proven by asking for an account: an account route writes its rate row on an instance not yet held');
  for (const t of THEN_TABLES) assert.match(step('Export what stood then'), new RegExp(`--table ${t}\\b`));
  for (const t of NOW_TABLES) assert.match(step('Export the present'), new RegExp(`--table ${t}\\b`));
  assert.doesNotMatch(wf, /--table players/, 'no player row is ever exported - handles are asked for by name');
});

test('RESTORE C: the maintenance switch - held, the service answers its health (saying so) and its public key, and refuses every other call 503 `maintenance`, a word the client can say; unheld, nothing of it shows; and no config the repository deploys ever throws it', async () => {
  const ask = async (env, path, init = {}) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, init), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const raw = db();
  const held = { DB: d1face(raw), ACCOUNT_VERSION: 'test1', IDENTITY_PUBLIC_KEY: 'a-public-key', MAINTENANCE: '1' };
  assert.deepEqual(await ask(held, '/v1/health'), { status: 200, body: { ok: true, v: 'test1', maintenance: true } });
  assert.equal((await ask(held, '/v1/pubkey')).status, 200);
  for (const [path, init] of [['/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }], ['/v1/realm', { headers: { authorization: 'Bearer x'.padEnd(40, 'x') } }], ['/v1/realm/customs', { method: 'POST', body: '{}' }], ['/v1/nowhere', {}]]) {
    assert.deepEqual(await ask(held, path, init), { status: 503, body: { error: 'maintenance' } }, path);
  }
  const open = { ...held, MAINTENANCE: undefined };
  assert.deepEqual(await ask(open, '/v1/health'), { status: 200, body: { ok: true, v: 'test1' } });
  assert.equal((await ask(open, '/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) })).status, 200);
  // the workflow's own proof of the hold: a write route asked with no credential - 503 held, 401 not yet, and no row written either way
  const rows = () => raw.prepare('SELECT (SELECT COUNT(*) FROM players) + (SELECT COUNT(*) FROM sessions) + (SELECT COUNT(*) FROM rate_limits) AS n').get().n;
  const before = rows();
  const proof = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' };
  assert.deepEqual(await ask(held, '/v1/realm/customs', proof), { status: 503, body: { error: 'maintenance' } });
  assert.deepEqual(await ask(open, '/v1/realm/customs', proof), { status: 401, body: { error: 'auth' } });
  assert.equal(rows(), before, 'the proof writes nothing, held or not');
  assert.equal(accountRefusalText('maintenance'), 'The account service is under maintenance for a minute. Try again shortly.');
  assert.doesNotMatch(src('server-account/wrangler.toml'), /MAINTENANCE/, 'the switch is a deploy\'s alone, never the config\'s');
});
