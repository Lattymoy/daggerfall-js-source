// RENOWN-ACCOUNT (2026-09-28, Mac: "can you make sure renown is account based and not character based? Along with
// reducing the accumulation of renown from resources a bit. Want some more oomph to the grind"): ONE RENOWN AN
// ACCOUNT, AND A SLOWER GRIND - and RENOWN-CHAR (2026-09-29, Mac: "Can we make renown per character again") took the
// first half back the next day (test/server/renown_char.test.js holds a character's track again, and migration 0035). What
// stands here is RENOWN-ACCOUNT's own: the law (src/net/renown.js) - every source pays RENOWN_RATE_PCT, three quarters,
// of its full rate, floored once (renownRate), the hour's bound 15,000, the curve unmoved; migration 0021 as it ran -
// each account at its BEST character's total (MAX, never SUM), kept since as history 0035 reads its gains from; and
// the relay untouched, the law never in its bundle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { mintId } from '../../server-account/src/accounts.js';
import {
  RENOWN_RATE_PCT, renownRate, renownKillXp, renownQuestXp, renownRaidXp, renownPartyXp, renownXpFor, renownForXp,
  RENOWN_KILL_XP_PER_LEVEL, RENOWN_KILL_LEVEL_MAX, RENOWN_QUEST_XP_BASE, RENOWN_QUEST_XP_PER_LEVEL, RENOWN_QUEST_LEVEL_MAX,
  RENOWN_OVER_MAX, RENOWN_XP_HOUR_MAX, RENOWN_XP_REPORT_MAX, RENOWN_XP_MAX, RENOWN_MAX, RENOWN_RAID_QUESTS, RENOWN_TRACKS_MAX,
} from '../../src/net/renown.js';
import { graph } from '../importGraph.mjs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const rand = (b) => globalThis.crypto.getRandomValues(b);
const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
const ACCOUNT_MIGRATION = '0021_renown_account.sql';
const T0 = 1_800_000_000;
const migrate = (db, files) => { for (const f of files) db.exec(src(`server-account/migrations/${f}`)); };

// ═══ THE LAW ═════════════════════════════════════════════════════════════════════════════════════

test('RENOWN-ACCOUNT the rate: every source pays RENOWN_RATE_PCT (75) of its full rate, floored ONCE (renownRate) - a kill 7.5 a foe level (7, 15, 22 ... 225), a quest 75 + 30 a level, a raid three such quests (585 at Renown 1, 1,395 at 10, 2,925 from 27), the party\'s bonus on the rated kill (383 for eight at level 30); every result whole; the curve unmoved; the hour 15,000 (mutants: the rate unread for a kill; for a quest; rounded rather than floored; the full rate kept; the hour at 20,000)', () => {
  assert.equal(RENOWN_RATE_PCT, 75);
  assert.deepEqual([0, 1, 10, 15, 30, 100, 140, 4000].map(renownRate), [0, 0, 7, 11, 22, 75, 105, 3000]);
  assert.deepEqual([renownRate(-5), renownRate(Number.NaN), renownRate(undefined), renownRate(10.9)], [0, 0, 0, 7], 'whole XP in, whole XP out');
  // THE KILL - at the cap's Renown nothing is read lower (RENOWN3's ceiling is test/net/renown3.test.js's)
  const kills = Array.from({ length: RENOWN_KILL_LEVEL_MAX }, (_, i) => renownKillXp(i + 1, RENOWN_MAX));
  assert.deepEqual(kills.slice(0, 10), [7, 15, 22, 30, 37, 45, 52, 60, 67, 75], 'a rat is 7 - it was 10');
  assert.deepEqual([renownKillXp(20, RENOWN_MAX), renownKillXp(30, RENOWN_MAX), renownKillXp(99, RENOWN_MAX), renownKillXp(0, RENOWN_MAX)], [150, 225, 225, 7], 'a lich 150, a level-30 foe 225 - they were 200 and 300');
  kills.forEach((k, i) => assert.equal(k, Math.floor((RENOWN_KILL_XP_PER_LEVEL * (i + 1) * 3) / 4), `a level-${i + 1} kill is three quarters of ${RENOWN_KILL_XP_PER_LEVEL * (i + 1)}, floored`));
  // THE QUEST - 75 and 30 a level, whole already
  for (let L = 1; L <= RENOWN_QUEST_LEVEL_MAX; L++) assert.equal(renownQuestXp(L, RENOWN_MAX), 75 + 30 * L, `a quest at character level ${L}`);
  assert.deepEqual([RENOWN_KILL_XP_PER_LEVEL, RENOWN_QUEST_XP_BASE, RENOWN_QUEST_XP_PER_LEVEL], [10, 100, 40], 'the full rates stand: the rate is taken after them, in one place');
  // EVERY SOURCE, at every Renown: at most three quarters of its full rate, and short of it by less than one XP
  for (let r = 1; r <= RENOWN_MAX; r++) {
    for (let L = 1; L <= RENOWN_KILL_LEVEL_MAX; L++) {
      const read = Math.min(L, r + RENOWN_OVER_MAX);
      const k = renownKillXp(L, r), q = renownQuestXp(L, r);
      assert.ok(Number.isSafeInteger(k) && k * 4 <= RENOWN_KILL_XP_PER_LEVEL * read * 3 && (k + 1) * 4 > RENOWN_KILL_XP_PER_LEVEL * read * 3, `a level-${L} kill at Renown ${r}: ${k}`);
      assert.equal(q * 4, (RENOWN_QUEST_XP_BASE + RENOWN_QUEST_XP_PER_LEVEL * read) * 3, `a level-${L} quest at Renown ${r}: ${q}`);
    }
  }
  // THE RAID follows the quests: three at the top quest level
  assert.equal(RENOWN_RAID_QUESTS, 3);
  assert.deepEqual([renownRaidXp(null), renownRaidXp(1), renownRaidXp(10), renownRaidXp(27), renownRaidXp(RENOWN_MAX)], [585, 585, 1395, 2925, 2925], 'they were 780, 1,860 and 3,900');
  // THE PARTY: the bonus rides on the rated kill, so its base is a quarter less too
  assert.equal(renownPartyXp(renownKillXp(30, RENOWN_MAX), 8), 383, 'eight at level 30 - it was 510');
  assert.equal(renownPartyXp(renownKillXp(20, RENOWN_MAX), 4), 195);
  // THE CURVE did not move: the grind is slower because every source pays less, never because a level costs more
  assert.deepEqual([2, 10, 20, 50].map(renownXpFor), [100, 5510, 68200, 2318660]);
  assert.equal(RENOWN_XP_MAX, 2318660);
  assert.equal(renownForXp(5510), 10);
  // THE HOUR: a quarter off, as every source
  assert.equal(RENOWN_XP_HOUR_MAX, 15_000);
  assert.equal(RENOWN_XP_REPORT_MAX, 5_000, 'one report\'s bound stands');
  assert.equal(Math.ceil(RENOWN_XP_MAX / RENOWN_XP_HOUR_MAX), 155, 'a client that lies every hour takes 155 hours to the cap - it was 116');
  assert.equal(RENOWN_TRACKS_MAX, 60, 'RENOWN-CHAR: the tracks\' bound came back with the tracks (RENOWN-ACCOUNT had taken it)');
  // the law's own worked examples say the new numbers
  const words = src('src/net/renown.js').replace(/\s*\n \*\s*/g, ' ').replace(/\s*\n\/\/\s*/g, ' ');
  assert.match(words, /at Daggerfall level 30, Renown 10 is 79 kills and Renown 20 is 531/);
  assert.match(words, /383 XP a kill at level 30 with the whole party's bonus/);
  assert.match(words, /takes 155 hours \(2,318,660 \/ 15,000\)/);
  assert.match(words, /Renown 1 takes 585, Renown 10 1,395, Renown 27 and up 2,925/);
});

// ═══ THE MIGRATION ═══════════════════════════════════════════════════════════════════════════════

test('RENOWN-ACCOUNT the migration (0021), as it ran: each account started at its BEST character\'s XP - the most any one track held, never the sum - with the last report its most recently earned track took; an account whose tracks held nothing got no row; the tracks stayed, and the census 0020 took of them; RENOWN-CHAR\'s 0035, after it, leaves every row as it stood - history its gains are read from (mutants: SUM for MAX; the empty account given a row; the oldest report\'s id kept)', () => {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  const i20 = MIGRATIONS.findIndex((f) => f.startsWith('0020_'));
  assert.equal(MIGRATIONS[i20 + 1], ACCOUNT_MIGRATION, '0021 follows 0020: the census is taken first');
  migrate(raw, MIGRATIONS.slice(0, i20));
  // accounts made before 0020 were written by the service as it was then - TERMS1's columns (migration 0023, after
  // these) did not exist yet, so the guest row is the one it wrote before them
  const before = () => { const id = mintId(rand); raw.prepare('INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen) VALUES (?, NULL, NULL, ?, ?, ?)').run(id, 'Guest', T0, T0); return { id }; };
  const A = before(), B = before(), C = before(), D = before();
  const track = raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, last_rid, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  track.run(A.id, 'char-main', 'Main', 6000, 'aaaaaaaaaaaaaaaa', 100, 500);
  track.run(A.id, 'char-alt1', 'Alt', 500, 'bbbbbbbbbbbbbbbb', 200, 900);   // the most recently earned
  track.run(A.id, 'char-alt2', null, 300, null, 50, 400);
  track.run(B.id, 'char-zero', null, 0, null, 10, 10);
  track.run(C.id, 'char-capp', 'Old', RENOWN_XP_MAX, null, 10, 20);
  track.run(C.id, 'char-newb', 'New', 10, 'cccccccccccccccc', 30, 40);
  migrate(raw, MIGRATIONS.slice(i20, i20 + 2));   // 0020's census and 0021, as they ran
  const accounts = () => raw.prepare('SELECT player, xp, last_rid, created_at, updated_at FROM renown_accounts ORDER BY xp').all().map((x) => ({ ...x }));
  const ran = [
    { player: A.id, xp: 6000, last_rid: 'bbbbbbbbbbbbbbbb', created_at: 50, updated_at: 900 },
    { player: C.id, xp: RENOWN_XP_MAX, last_rid: 'cccccccccccccccc', created_at: 10, updated_at: 40 },
  ];
  assert.deepEqual(accounts(), ran, 'the best character\'s total (6,000, never 6,800); nothing for an account that earned nothing, or had no track');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM renown_tracks').get().n, 6, 'the characters\' tracks stayed');
  assert.deepEqual(raw.prepare('SELECT char_id FROM realm_census WHERE player = ? ORDER BY char_id').all(A.id).map((x) => x.char_id), ['char-alt1', 'char-alt2', 'char-main'], 'the census, as 0020 took it');
  assert.equal(accounts().some((x) => x.player === B.id || x.player === D.id), false, 'B\'s track held nothing, D had none: no row');
  // every migration after it - RENOWN-CHAR's 0035 among them: the account's rows stand, history
  migrate(raw, MIGRATIONS.slice(i20 + 2));
  assert.deepEqual(accounts(), ran, 'RENOWN-CHAR leaves renown_accounts as it stood');
  assert.deepEqual(raw.prepare('SELECT char_id, xp FROM renown_tracks WHERE player = ? ORDER BY char_id').all(A.id).map((x) => [x.char_id, x.xp]), [['char-alt1', 500], ['char-alt2', 300], ['char-main', 6000]], 'nothing earned while it was the account\'s: each track its own');
  const sql = src(`server-account/migrations/${ACCOUNT_MIGRATION}`);
  assert.match(sql, /player {5}TEXT PRIMARY KEY,/, 'one row an account, by its key');
  assert.match(sql, /FOREIGN KEY \(player\) REFERENCES players\(id\) ON DELETE CASCADE/);
  assert.match(sql, /WHY A TABLE OF ITS OWN/, 'the schema\'s choice, justified where it is made');
});

test('RENOWN-ACCOUNT the relay is untouched: the law is the account Worker\'s and the page\'s, never in the relay\'s bundle (test/net/relayversion.test.js holds that bundle\'s hash); the Worker bundles it and its deploy filter names it', () => {
  assert.equal(graph('server/src/index.js').includes('src/net/renown.js'), false, 'not the relay\'s');
  assert.ok(graph('server-account/src/index.js').includes('src/net/renown.js'), 'the account Worker\'s');
  assert.match(src('.github/workflows/account-deploy.yml'), /- "src\/net\/renown\.js"/);
});
