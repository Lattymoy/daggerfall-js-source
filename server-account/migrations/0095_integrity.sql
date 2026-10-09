-- INT2-INT6 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and do it
-- properly"): THE JUDGE'S RECORD - every realm checkpoint read, its verdict on the character, the ids of its valuable
-- pieces, its wealth over the time it played, and the dials staff set.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- ON THE CHARACTER'S ROW (realm_characters), read and written by server-account/src/realm.js:
--   judged_seq  the last checkpoint the judge read (server-account/src/judge.js); NULL - none since INT2 shipped, and a
--               route that hands this character's value to another player waits for one (realm.js holdRefusal)
--   held        NULL, or why every route that moves this character's value to another player refuses it: 'law' (a
--               checkpoint held something no honest client mints), 'dupe' (its pieces' ids stood in other records too
--               often), 'budget' (it gained past its budget, once staff turned the budget on), 'staff'
--   held_at     when it was held
--   strikes     the checkpoints that carried a law finding - STRIKES_FOR_REVIEW of them and only staff clear the hold
--   review      a word for staff that holds nothing ('outlier': its wealth at its first judgement stood far past its
--               level's - Mac's call at the cutover, "Items judged, wealth baselined")
--   wealth      what the last judgement measured (judge.js wealthOf), NULL before the first
--   witnessed   what the service's own writes moved since the last judgement (a market sale's gold, a vault's piece) -
--               gained in the open, never charged to the budget
--   allowance   INT5: the budget's bucket, in gold - it fills with time played and a gain no witness explains spends it
--   played_at   INT5: the account's played seconds (players.played_s) at the last judgement or join
--   clean_obj, clean_seq  INT6: the last checkpoint judged clean - its object kept past the two the row rotates, for a
--               staff rollback
ALTER TABLE realm_characters ADD COLUMN judged_seq INTEGER;
ALTER TABLE realm_characters ADD COLUMN held TEXT CHECK (held IS NULL OR held IN ('law', 'dupe', 'budget', 'staff'));
ALTER TABLE realm_characters ADD COLUMN held_at INTEGER;
ALTER TABLE realm_characters ADD COLUMN strikes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE realm_characters ADD COLUMN review TEXT;
ALTER TABLE realm_characters ADD COLUMN wealth INTEGER;
ALTER TABLE realm_characters ADD COLUMN witnessed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE realm_characters ADD COLUMN allowance INTEGER;
ALTER TABLE realm_characters ADD COLUMN played_at INTEGER;
ALTER TABLE realm_characters ADD COLUMN clean_obj TEXT;
ALTER TABLE realm_characters ADD COLUMN clean_seq INTEGER;
CREATE INDEX IF NOT EXISTS realm_characters_held ON realm_characters (held) WHERE held IS NOT NULL;
CREATE INDEX IF NOT EXISTS realm_characters_review ON realm_characters (review) WHERE review IS NOT NULL;

-- THE FINDINGS, kept for staff: one row a judgement that found something (a law finding, a duplicate, a gain past the
-- budget - in MEASURE, a gain that WOULD have been - or the cutover's outlier). `detail` is the judge's JSON, bounded
-- by judge.js FINDINGS_KEPT. The cron sweeps rows past REALM_FINDINGS_KEEP_S.
CREATE TABLE IF NOT EXISTS realm_findings (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  player    TEXT NOT NULL,
  char_id   TEXT NOT NULL,
  seq       INTEGER NOT NULL,
  at        INTEGER NOT NULL,
  law       INTEGER NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('law', 'dupe', 'budget', 'measure', 'outlier', 'staff')),
  detail    TEXT NOT NULL CHECK (json_valid(detail)),
  FOREIGN KEY (char_id) REFERENCES realm_characters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS realm_findings_char ON realm_findings (char_id, at);
CREATE INDEX IF NOT EXISTS realm_findings_at ON realm_findings (at);

-- INT5: THE WEALTH OVER TIME PLAYED - one row a character an hour of the clock: the gain no witness explains (its
-- positive part and its negative part apart, so a spending hour never hides an earning one), the seconds played, the
-- level it played at and the checkpoints. What staff read to set the budget's line (the measure, MEASURE first: Mac,
-- "Measure 7 days, then enforce"). The cron sweeps rows past REALM_WEALTH_KEEP_S.
CREATE TABLE IF NOT EXISTS realm_wealth_hours (
  char_id     TEXT NOT NULL,
  hour        INTEGER NOT NULL,
  player      TEXT NOT NULL,
  level       INTEGER NOT NULL,
  gain        INTEGER NOT NULL DEFAULT 0,
  loss        INTEGER NOT NULL DEFAULT 0,
  played_s    INTEGER NOT NULL DEFAULT 0,
  checkpoints INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (char_id, hour),
  FOREIGN KEY (char_id) REFERENCES realm_characters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS realm_wealth_hours_hour ON realm_wealth_hours (hour);

-- INT4: THE IDS OF THE VALUABLE PIECES - one row an id: whose record holds it, since which checkpoint, and its state.
--   held     in its owner's last judged record
--   gone     its owner's record let it go (a counter, a peer's hands, the ground) - the next record to hold it takes it
--   escrow   the service holds it (a market listing, a vault) - market.js, guildVault.js move it
--   contested  another record holds it while its owner's last still did: the owner's next checkpoint settles it - gone
--            from there, it moved; still there, a DUPE
--   dupe     two records held it at once: no route moves it again (realm.js holdRefusal's piece check)
CREATE TABLE IF NOT EXISTS item_uids (
  uid        TEXT PRIMARY KEY CHECK (length(uid) = 16),
  player     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  seen_seq   INTEGER NOT NULL,
  state      TEXT NOT NULL CHECK (state IN ('held', 'gone', 'escrow', 'contested', 'dupe')),
  other_char TEXT,
  at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS item_uids_char ON item_uids (char_id, state);

-- INT5/INT6: THE DIALS STAFF SET - the budget's line and whether it holds (`budget`: JSON, server-account/src/budget.js
-- budgetConfigOf), written by a developer through /v1/mod/realm-budget, every change kept by who and when.
CREATE TABLE IF NOT EXISTS realm_config (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL CHECK (json_valid(value)),
  at     INTEGER NOT NULL,
  by     TEXT
);
