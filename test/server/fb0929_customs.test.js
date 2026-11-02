// FIELD BUGS 2026-09-29 - CUSTOMS-CARRY (bible/01-Overview/bugs/Field-Bugs-2026-09-29.md). From the Discord, through Mac:
// "Bring Online" answered "Only a character that has already played online can be brought into the realm" for characters
// that had (EnragedBard, Tony H.) - the census (migration 0020) counted Renown tracks alone, and a track needs a first
// online kill; and a vampire who came in found their guild gone and their gold taken by loans they were never warned of
// (Dracula/Valentin). Mac, asked: the census is "Any pre-realm trace", homes and guild places "Carry them", loans "Call in
// all loans" - told first. These pins drive the REAL Worker over the REAL migrations (node:sqlite behind a D1-shaped face
// whose batch is one transaction), as test/systems/auditrealm2_service.test.js does, and run migration 0022 against the tables as
// a deploy finds them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { REALM_ID_RE } from '../../server-account/src/realm.js';
import { r2, freshSave, realmAt } from '../realmSeat.mjs';
import { applyCustoms, customsLines, CUSTOMS_PROMISE } from '../../src/systems/realmCustoms.js';
import { createBankAccounts } from '../../src/systems/banking.js';
import { accountRefusalText } from '../../src/net/accountClient.js';
import { GUILD_RANK_MASTER } from '../../src/net/guild/guildLaw.js';
import { ACCEPTED } from '../../src/net/legalLaw.js';   // TERMS1 (at the merge with PR 418): a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
const CARRY = 'server-account/migrations/0022_customs_carry.sql';
/** The realm's start, as 0022 reads it: the commit that brought 0020's census to main (f4dc60ce). */
const REALM_START_S = 1790638734;

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      const writes = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
      let args = [];
      const st = {
        bind(...a) { args = a; return st; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return st;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

async function stand() {
  _resetKeyForTests();
  const kp = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await webcrypto.subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (path, body, secret) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` }, body: JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const put = async (id, text, secret, { lease, seq }) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${secret}`, 'x-realm-lease': lease, 'x-realm-seq': String(seq) }, body: text,
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const load = async (id, secret) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${id}/data`, { headers: { authorization: `Bearer ${secret}` } }), env);
    return JSON.parse(await res.text());
  };
  let n = 0;
  /** A registered account (homes and guilds are a registered account's). */
  const account = async () => {
    const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
    assert.equal((await call('/v1/auth/register', { secret: g.secret, handle: `carrier${++n}x`, password: 'a good long one', ...ACCEPTED }, g.secret)).status, 200);
    return { id: g.id, secret: g.secret };
  };
  const rows = (sql, ...a) => env.DB._raw.prepare(sql).all(...a).map((r) => ({ ...r }));
  const exec = (sql, ...a) => env.DB._raw.prepare(sql).run(...a);
  /** Customs, and its first save landed - a realm character brought in. */
  const bringIn = async (who, origin, name = 'Carried') => {
    const came = await call('/v1/realm/customs', { origin, name, summary: { level: 5 } }, who.secret);
    assert.equal(came.status, 200, `${origin} comes in`);
    assert.equal((await put(came.body.id, JSON.stringify(freshSave({ name, level: 5 })), who.secret, { lease: came.body.lease, seq: 1 })).status, 200);
    return came.body.id;
  };
  /** The deploy: migration 0022 run against the tables as they stand. */
  const deploy = () => env.DB._raw.exec(src(CARRY));
  // the rows each trace is, as its own slice writes them
  const home = (who, charId, at, key) => exec("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at) VALUES (?, ?, ?, ?, 'Owner', 17, 'private', 40000, ?)", 4242, key, who.id, charId, at);
  const guild = (id, treasury = 0) => exec("INSERT INTO guilds (id, name, name_key, tag, ranks, treasury, founded_at) VALUES (?, ?, ?, ?, '[]', ?, 1)", id, `The ${id}`, `the ${id}`, id.slice(0, 4).toUpperCase(), treasury);
  const member = (who, charId, guildId, at, rank = GUILD_RANK_MASTER) => exec("INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, 'Owner', ?)", who.id, charId, guildId, rank, at);
  const raid = (who, charId, at) => exec("INSERT INTO raid_cleanses (raid, account, day, party, char_id, xp, nonce, at) VALUES (?, ?, 1, 0, ?, 100, 'n', ?)", `raid-${charId}`, who.id, charId, at);
  const backup = (who, charId, at) => exec('INSERT INTO saves (player_id, character_id, save_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', who.id, charId, 'QuickSave', at, at);
  return { env, call, load, account, rows, exec, bringIn, deploy, home, guild, member, raid, backup };
}

test('CUSTOMS-CARRY 0022: the census counts every trace the realm has of a character from BEFORE the realm - an online home, a guild place, a raid fought, a cloud backup - and none stamped after it; once stays once on every account', async () => {
  const s = await stand();
  const A = await s.account(), B = await s.account();
  const before = REALM_START_S - 1;
  s.home(A, 'homeOnly01', before, 1);
  s.guild('gpre');
  s.member(A, 'guildOnly01', 'gpre', before);
  s.raid(A, 'raidOnly01', before);
  s.backup(A, 'backupOnly01', before);
  // stamped at or after the realm's start: no proof (L1-F5 - a Copy to offline's new id gathers backups and raids too)
  s.backup(A, 'lateBackup01', REALM_START_S);
  s.home(A, 'lateHome001', REALM_START_S + 60, 2);
  // shapes customs never takes: too short, and a realm id
  s.backup(A, 'ab', before);
  s.backup(A, `r${'0a'.repeat(10)}`, before);
  // a character already brought in from another account (a copy of it stood on both before the realm)
  s.exec('INSERT INTO realm_census (player, char_id, spent) VALUES (?, ?, 1)', B.id, 'crossed01');
  s.backup(A, 'crossed01', before);
  assert.deepEqual(s.rows('SELECT char_id FROM realm_census WHERE player = ?', A.id), [], 'the Renown census never saw them');
  assert.deepEqual((await s.call('/v1/realm/customs', { origin: 'backupOnly01', name: 'Sirocco' }, A.secret)).body, { error: 'customs-never-online' }, 'the field\'s refusal, reproduced');
  s.deploy();
  assert.deepEqual(s.rows('SELECT char_id, spent FROM realm_census WHERE player = ? ORDER BY char_id', A.id), [
    { char_id: 'backupOnly01', spent: 0 },
    { char_id: 'crossed01', spent: 1 },
    { char_id: 'guildOnly01', spent: 0 },
    { char_id: 'homeOnly01', spent: 0 },
    { char_id: 'raidOnly01', spent: 0 },
  ]);
  for (const origin of ['backupOnly01', 'homeOnly01', 'guildOnly01', 'raidOnly01']) assert.match(await s.bringIn(A, origin), REALM_ID_RE, origin);
  for (const late of ['lateBackup01', 'lateHome001']) {
    assert.deepEqual((await s.call('/v1/realm/customs', { origin: late, name: 'Late' }, A.secret)).body, { error: 'customs-never-online' }, late);
  }
  assert.deepEqual((await s.call('/v1/realm/customs', { origin: 'crossed01', name: 'Twice' }, A.secret)).body, { error: 'customs-already' }, 'in once, on every account');
  s.deploy();   // a second run changes nothing (INSERT OR IGNORE): a spent census row is never reset
  assert.deepEqual(s.rows('SELECT COUNT(*) AS n FROM realm_census WHERE player = ? AND spent = 0', A.id), [{ n: 0 }], 'the four brought in stay spent');
});

test('CUSTOMS-CARRY 0022: every character customs already made takes its origin\'s home and guild place (Dracula\'s "deleted" guild), a realm character already in a guild keeps its own, and nothing carried pays out gold from before the realm', async () => {
  const s = await stand();
  const A = await s.account(), B = await s.account();
  for (const [who, origin] of [[A, 'vampire01'], [B, 'joiner001']]) s.exec('INSERT INTO realm_census (player, char_id) VALUES (?, ?)', who.id, origin);
  const vamp = await s.bringIn(A, 'vampire01', 'Valentin');
  const joiner = await s.bringIn(B, 'joiner001', 'Joiner');
  // what AUDIT REALM2 S2 left under the offline ids: A's house and A's guild (its master, a pre-realm treasury); B's place
  // in it - B's realm character has founded a guild of its own since
  const before = REALM_START_S - 86_400;
  s.home(A, 'vampire01', before, 7);
  s.guild('gold', 5_000);
  s.member(A, 'vampire01', 'gold', before);
  s.member(B, 'joiner001', 'gold', before, 3);
  s.guild('gnew');
  s.member(B, joiner, 'gnew', REALM_START_S + 600);
  s.deploy();
  assert.deepEqual(s.rows('SELECT char_id FROM homes'), [{ char_id: vamp }], 'the house is the realm character\'s');
  assert.deepEqual(s.rows('SELECT char_id, guild_id, rank FROM guild_members ORDER BY guild_id, rank'), [
    { char_id: joiner, guild_id: 'gnew', rank: GUILD_RANK_MASTER },
    { char_id: vamp, guild_id: 'gold', rank: GUILD_RANK_MASTER },
    { char_id: 'joiner001', guild_id: 'gold', rank: 3 },
  ], 'the master\'s place is carried; one guild a character, so the joiner keeps the one it founded');
  // a house from before the realm comes back as a house, never as gold (0020 `paid`, L1-F3) - and HOME-CROSSED (FIELD
  // BUGS 2026-09-30, PIN MOVED): it is not sold at all, where it was sold for nothing and taken
  const sold = await s.call('/v1/homes/release', { mapId: 4242, buildingKey: 7, realm: realmAt(s.env, vamp) }, A.secret);
  assert.deepEqual([sold.status, sold.body?.error], [409, 'home-crossed']);
  assert.ok(s.env.DB._raw.prepare('SELECT 1 FROM homes WHERE map_id = 4242 AND building_key = 7').get(), 'the house stands');
  assert.equal((await s.load(vamp, A.secret)).goldPieces, freshSave().goldPieces, 'the record gained nothing');
  // and the treasury's gold from before the realm is not the realm's (0020 `realm_gold`, L1-F3)
  const took = await s.call('/v1/guilds/withdraw', { character: vamp, gold: 1_000, realm: realmAt(s.env, vamp) }, A.secret);
  assert.deepEqual(took.body, { error: 'guild-treasury-old' });
});

test('CUSTOMS-CARRY: customs itself carries the home and the guild place from here on (realm.js CHARACTER_TABLES), in the census\'s own batch', async () => {
  const s = await stand();
  const A = await s.account();
  s.exec('INSERT INTO realm_census (player, char_id) VALUES (?, ?)', A.id, 'offline-77');
  s.home(A, 'offline-77', REALM_START_S - 10, 9);
  s.guild('gcar');
  s.member(A, 'offline-77', 'gcar', REALM_START_S - 10);
  const id = await s.bringIn(A, 'offline-77');
  assert.deepEqual([s.rows('SELECT char_id FROM homes'), s.rows('SELECT char_id FROM guild_members')], [[{ char_id: id }], [{ char_id: id }]]);
});

test('CUSTOMS-CARRY: the door says what customs will do BEFORE it runs - the loans it calls in, what the allowance leaves behind, what crosses and what stays - off the same report customs makes, on a copy', () => {
  const bank = createBankAccounts();
  Object.assign(bank[3], { loanTotal: 11_000, accountGold: 1_000, loanDueDate: 5_000 });
  Object.assign(bank[9], { accountGold: 500_000 });
  const snap = { name: 'Valentin', level: 1, classicMinutes: 100, goldPieces: 5_000, items: [], wagonItems: [], bankAccounts: bank };
  const kept = JSON.stringify(snap);
  const preview = customsLines(applyCustoms(JSON.parse(JSON.stringify(snap))), { before: true });
  assert.equal(JSON.stringify(snap), kept, 'the save itself is untouched - a copy is what customs runs on');
  assert.deepEqual(preview, [
    'Customs will call in 11000 gold of loans and pay them from your bank and purse.',
    'You carry 495000 gold; the realm lets a character of this level bring 30000. 465000 will stay behind.',
    ...CUSTOMS_PROMISE,
  ]);
  assert.deepEqual(CUSTOMS_PROMISE, [
    'Your online homes and your guild place come with you.',
    'Your offline character stays exactly as it is, loans and gold included, and keeps playing offline.',
    'A character comes into the realm once.',
  ]);
  // what it said after stays what it said (the pins of realm3 and auditrealm2_customs read these)
  const after = customsLines(applyCustoms(JSON.parse(kept)));
  assert.deepEqual(after, [
    'Customs called in 11000 gold of loans, and they are paid.',
    'You carried 495000 gold; the realm lets a character of this level bring 30000. 465000 stays behind.',
  ]);
  const owing = { level: 1, classicMinutes: 7, goldPieces: 100, items: [], wagonItems: [], bankAccounts: createBankAccounts() };
  Object.assign(owing.bankAccounts[5], { loanTotal: 5_000, loanDueDate: 900_000 });
  assert.equal(customsLines(applyCustoms(owing), { before: true })[0], 'Customs will call in 5000 gold of loans; 4900 cannot be paid and falls due.');
  // RESTORE (Mac: "Keep all, can't sell"): no deed stays behind now - the door says it comes, and that it never sells back
  assert.equal(customsLines({ called: 0, owed: 0, taken: 0, crossed: ['house'] }, { before: true })[0], 'Your house will come with you, every piece in it; the realm\'s bank does not buy back what comes through customs.');
  assert.deepEqual(customsLines({ called: 0, owed: 0, taken: 0 }, { before: true }), ['Customs finds nothing to settle.', ...CUSTOMS_PROMISE]);
});

test('CUSTOMS-CARRY: "Bring online" asks first - the preview off a copy, and customs runs only on the answer; a press customs refuses before the service still says why at once', () => {
  const menu = src('src/ui/enhanced/enhancedMenu.js');
  const bring = menu.slice(menu.indexOf('function bringOnline(save) {'), menu.indexOf('function customsNow(save) {'));
  assert.ok(bring.length > 0 && menu.indexOf('function customsNow(save) {') > 0);
  assert.match(bring, /const trial = JSON\.parse\(JSON\.stringify\(snap\)\);\n\s+const leveling = crossLeveling\(trial\);[^\n]*\n\s+const preview = \[\.\.\.\(leveling \? \[LEVELING_CROSS_LINE\.before\] : \[\]\), \.\.\.customsLines\(applyCustoms\(trial\), \{ before: true \}\)\];/);
  assert.match(bring, /return ask\(t\('menu\.online\.bringAsk', 'Bring \{name\} online\?', \{ name: save\.name \}\), preview\.join\(' '\), t\('menu\.online\.bring', 'Bring online'\), \(\) => \{ customsNow\(save\); \}\);/);
  assert.doesNotMatch(bring, /realmCustoms\(|realmPut\(/, 'nothing is sent before the answer');
  assert.match(bring, /if \(!snap \|\| typeof snap\.characterId !== 'string' \|\| !snap\.characterId \|\| snap\.testRoom === true\) return customsNow\(save\);/);
  // the refusal says what counts, not "played online" - which read false to a player who had
  const said = accountRefusalText('customs-never-online');
  for (const w of ['before it opened', 'Renown', 'online home', 'guild place', 'raid', 'cloud backup']) assert.ok(said.includes(w), w);
  assert.doesNotMatch(said, /already played online/);
});
