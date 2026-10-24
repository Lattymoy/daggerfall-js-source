-- LEAN-WITNESS (2026-10-19, the account database overloaded again - "D1 DB is overloaded. Requests queued for too
-- long." on the harvest and the pixels, 18:05-18:25 UTC; bible/11-Multiplayer/Scale-Arc.md LEAN-WITNESS): A WITNESSED
-- KEY'S ANSWERS READ AS FAR AS THEY CAN MATTER.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct161) with the site; no
-- relay change.
--
-- A hall's and a seat's facts are the first answer three accounts agree on (nodeLaw.js witnessedFact), and every
-- account's first answer is kept (INSERT OR IGNORE) - never trimmed. On the day 48,745 `npchall` rows stood for 2,425
-- towns and not one town had a second answer; one had 1,516 accounts saying the same thing. Every hall witness read
-- every report of its region's towns (npcHalls.js regionRows - 24,327 of them in the Daggerfall region, some 48,000
-- rows read a witness, 190 ms on the primary) to ask whether its account was to be ignored, and every counted report
-- moved the region's version so the next reader read them all again: 13.5% of the database's statement time of the day,
-- and 34% of it in the 02:30 overload. The seats' clock read all 32,775 `seat` rows each minute the same way.
--
-- An answer that agrees with a key's confirmation and was given after the second it confirmed changes nothing any law
-- reads: witnessedFact counts after its confirmation only the answers that differ, and seatIgnoredAccounts never counts
-- an agreeing answer. Such a row is LATE. A late row is kept - an account's first answer still stands, and the audit
-- lists count it - but the reads that judge (a witness's ignored, a region's chapters, the seats' kept facts) read the
-- key's rows that are not late, a handful a key, and ask a key's late rows only where an account they ignore answered
-- it (npcHalls.js, townSeats.js; Scale-Arc LEAN-WITNESS holds the proof).
--
--   witness_confirmed   each key's confirmation as the database keeps it: the answer, and the second its third agreeing
--                       account gave it (the confirming row, ordered by second and account as witnessedFact orders
--                       them) - NULL both, or no row at all, while the key's answers confirm nothing (the backfill
--                       makes no row for such a key; every reader takes the two alike). The rows of the key that agree
--                       with it and were given in a later second are late; no other row is.
--
-- THE DATABASE KEEPS IT, NOT THE CALLERS: an answer inserted and an answer deleted (a strike, an account gone with ON
-- DELETE CASCADE, a sweep - by any route, the old Worker's among them) settle their key in the same statement, and each
-- at the cost of the rows whose state it changes, never the key's whole (AUDIT LEAN-READS A2/A3, D1: a key's 1,516 rows
-- deleted in one statement each re-settled the key - 3.6 million rows rewritten, some 25 s on D1):
--
--   - an answer of a later second than its key's confirmation moves nothing but itself (late, where it agrees): its own
--     row and the key's confirmation, by their primary keys;
--   - an answer at or before the confirmation's second, or to a key that confirms nothing yet, can move it: the key is
--     settled (below);
--   - an answer deleted moves the confirmation only where it was one of its confirmers - its answer, at or before the
--     second: a dissent's going leaves every other answer's third account where it was, a late row's comes after it.
--     Such a deletion settles the key;
--   - TO SETTLE A KEY is to find its confirmation again from its rows that are not late and its earliest late ones:
--     the confirmation's answer had three accounts at or before its second, so with one of them gone its third is the
--     first late row at the latest (every late row agrees with it), and every other answer's rows are none of them
--     late. A new confirmation moves the late rows (witness_confirmed_moved, witness_confirmed_turned): those of the
--     answer before it go back if it turned, those of its own answer up to its second go back, and its own answer's of a
--     later second go late - each by its index range;
--   - EACH READ NAMES ITS INDEX (AUDIT LEAN-READS 2 A3): with ANALYZE's statistics (D1 keeps none today; its own guide
--     says to run PRAGMA optimize) the planner takes the table's key index over the two partial ones - pixels make the
--     average key three rows - and every settle walks its whole key again: a 10,000-row town's strike 0.2 s to 12 s.
--     INDEXED BY holds the plan whatever the statistics (an UPDATE in a trigger takes none, so it names its rows by a
--     rowid read that does).
--
-- A REBUILD OF world_witness (as 0028, 0032, 0048, 0099 and 0132 rebuilt it to admit a kind) DROPS THIS COLUMN, ITS
-- INDEXES AND ITS TRIGGERS: carry `late` into the new table and make all of them again in the same migration.
-- test/server/lean_witness.test.js fails a tree whose migrations end without them. NOR IS A ROW REPLACED (`INSERT OR
-- REPLACE`, `REPLACE INTO`): its implied delete fires no trigger. test/server/lean_witness.test.js fails a source that does.
ALTER TABLE world_witness ADD COLUMN late INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS witness_confirmed (
  kind   TEXT NOT NULL,
  key    TEXT NOT NULL,
  report TEXT,
  at     INTEGER,
  PRIMARY KEY (kind, key)
);

-- Every key of the two kinds confirmed as its rows stand: each answer's third account (ordered by second, then account),
-- and of those the first.
INSERT OR IGNORE INTO witness_confirmed (kind, key, report, at)
  SELECT kind, key, report, at FROM (
    SELECT kind, key, report, at, ROW_NUMBER() OVER (PARTITION BY kind, key ORDER BY at, account) AS first
    FROM (SELECT kind, key, report, account, at, ROW_NUMBER() OVER (PARTITION BY kind, key, report ORDER BY at, account) AS n
      FROM world_witness WHERE kind IN ('npchall', 'seat'))
    WHERE n = 3)
  WHERE first = 1;

-- And every agreeing answer of a later second late (each row asks its key's one confirmation, by its primary key) -
-- before the indexes below are made, so the update writes no index of them.
UPDATE world_witness SET late = 1
  WHERE kind IN ('npchall', 'seat') AND EXISTS (SELECT 1 FROM witness_confirmed c
    WHERE c.kind = world_witness.kind AND c.key = world_witness.key AND c.report = world_witness.report AND world_witness.at > c.at);

-- The reads that judge: a region's keys and a key's rows, of the two kinds alone and the late ones in neither index (a
-- pixel's, a dungeon's rows are never late - AUDIT LEAN-READS A4: they cost every harvest two index writes for nothing).
-- A read the planner may take them for repeats their condition whole: leanWitness.js LEAN_ROWS.
CREATE INDEX IF NOT EXISTS idx_world_witness_lean_region ON world_witness (kind, region, key) WHERE kind IN ('npchall', 'seat') AND late = 0;
CREATE INDEX IF NOT EXISTS idx_world_witness_lean_key ON world_witness (kind, key) WHERE kind IN ('npchall', 'seat') AND late = 0;
-- A key's late rows by their second: its earliest, and those up to a confirmation that moved later.
CREATE INDEX IF NOT EXISTS idx_world_witness_late ON world_witness (kind, key, at) WHERE late = 1;
-- An account's own answers: a witness's question whether it can be ignored at all, and the cascade when an account goes
-- (world_witness.account's foreign key had no index - every account deleted walked the whole table).
CREATE INDEX IF NOT EXISTS idx_world_witness_account ON world_witness (account, kind);

-- A NEW CONFIRMATION MOVES THE LATE ROWS: its own answer's rows up to its second are its confirmers, not late; of a
-- later second, late. Where the answer turned (or went), witness_confirmed_turned lets the old answer's go back - the
-- two touch no row in common, so their order is none.
CREATE TRIGGER IF NOT EXISTS witness_confirmed_moved AFTER UPDATE OF report, at ON witness_confirmed
BEGIN
  UPDATE world_witness SET late = 0 WHERE rowid IN (SELECT rowid FROM world_witness INDEXED BY idx_world_witness_late
    WHERE kind = NEW.kind AND key = NEW.key AND late = 1 AND report = NEW.report AND at <= NEW.at);
  UPDATE world_witness SET late = 1 WHERE rowid IN (SELECT rowid FROM world_witness INDEXED BY idx_world_witness_lean_key
    WHERE kind = NEW.kind AND key = NEW.key AND kind IN ('npchall', 'seat') AND late = 0 AND report = NEW.report AND at > NEW.at);
END;
CREATE TRIGGER IF NOT EXISTS witness_confirmed_turned AFTER UPDATE OF report ON witness_confirmed WHEN OLD.report IS NOT NEW.report
BEGIN
  UPDATE world_witness SET late = 0 WHERE rowid IN (SELECT rowid FROM world_witness INDEXED BY idx_world_witness_late
    WHERE kind = NEW.kind AND key = NEW.key AND late = 1 AND report IS NOT NEW.report);
END;

-- AN ANSWER INSERTED: its key's row made where it has none; the key settled where it confirms nothing yet or the answer
-- came at or before its confirmation's second; the answer itself late where it agrees with the confirmation, a later
-- second.
CREATE TRIGGER IF NOT EXISTS witness_lean_in AFTER INSERT ON world_witness WHEN NEW.kind IN ('npchall', 'seat')
BEGIN
  INSERT INTO witness_confirmed (kind, key) SELECT NEW.kind, NEW.key
    WHERE NOT EXISTS (SELECT 1 FROM witness_confirmed WHERE kind = NEW.kind AND key = NEW.key);
  UPDATE witness_confirmed SET (report, at) = (
    SELECT report, at FROM (
      SELECT report, account, at, ROW_NUMBER() OVER (PARTITION BY report ORDER BY at, account) AS n FROM (
        SELECT report, account, at FROM world_witness INDEXED BY idx_world_witness_lean_key
          WHERE kind = NEW.kind AND key = NEW.key AND kind IN ('npchall', 'seat') AND late = 0
        UNION ALL
        SELECT report, account, at FROM world_witness INDEXED BY idx_world_witness_late WHERE kind = NEW.kind AND key = NEW.key AND late = 1
          AND at = (SELECT MIN(at) FROM world_witness INDEXED BY idx_world_witness_late WHERE kind = NEW.kind AND key = NEW.key AND late = 1)))
    WHERE n = 3 ORDER BY at, account LIMIT 1)
    WHERE kind = NEW.kind AND key = NEW.key AND (report IS NULL OR NEW.at <= at);
  UPDATE world_witness SET late = 1 WHERE kind = NEW.kind AND key = NEW.key AND account = NEW.account AND late = 0
    AND EXISTS (SELECT 1 FROM witness_confirmed c WHERE c.kind = NEW.kind AND c.key = NEW.key AND c.report = NEW.report AND NEW.at > c.at);
END;

-- AN ANSWER DELETED that was one of its key's confirmers: the key settled. Its key's row goes with its last answer.
CREATE TRIGGER IF NOT EXISTS witness_lean_out AFTER DELETE ON world_witness WHEN OLD.kind IN ('npchall', 'seat') AND OLD.late = 0
BEGIN
  UPDATE witness_confirmed SET (report, at) = (
    SELECT report, at FROM (
      SELECT report, account, at, ROW_NUMBER() OVER (PARTITION BY report ORDER BY at, account) AS n FROM (
        SELECT report, account, at FROM world_witness INDEXED BY idx_world_witness_lean_key
          WHERE kind = OLD.kind AND key = OLD.key AND kind IN ('npchall', 'seat') AND late = 0
        UNION ALL
        SELECT report, account, at FROM world_witness INDEXED BY idx_world_witness_late WHERE kind = OLD.kind AND key = OLD.key AND late = 1
          AND at = (SELECT MIN(at) FROM world_witness INDEXED BY idx_world_witness_late WHERE kind = OLD.kind AND key = OLD.key AND late = 1)))
    WHERE n = 3 ORDER BY at, account LIMIT 1)
    WHERE kind = OLD.kind AND key = OLD.key AND report = OLD.report AND OLD.at <= at;
  DELETE FROM witness_confirmed WHERE kind = OLD.kind AND key = OLD.key AND report IS NULL
    AND NOT EXISTS (SELECT 1 FROM world_witness WHERE kind = OLD.kind AND key = OLD.key);
END;

-- AN ANSWER IS NEVER REWRITTEN (AUDIT LEAN-READS 2 A4): no trigger above hears an UPDATE of a hall's or a seat's answer -
-- its key, its account, what it says or its second - so the key's confirmation and its late rows would stand as they
-- were. No route writes one (an answer is given once, INSERT OR IGNORE, and goes by a delete); this refuses the write
-- that would, where it would otherwise pass in silence. The triggers' own writes set `late` alone.
CREATE TRIGGER IF NOT EXISTS witness_lean_fixed BEFORE UPDATE OF kind, key, account, report, at ON world_witness
  WHEN OLD.kind IN ('npchall', 'seat') OR NEW.kind IN ('npchall', 'seat')
BEGIN
  SELECT RAISE(ABORT, 'a hall''s or a seat''s answer is never rewritten: delete it and give it again (migration 0135)');
END;
