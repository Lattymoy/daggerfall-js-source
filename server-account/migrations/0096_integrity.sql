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
--   strikes     the law holds it has come to (a checkpoint with a finding after one without) - STRIKES_FOR_REVIEW of
--               them and only staff clear the hold
--   review      a word for staff that holds nothing ('outlier': its wealth at its first judgement stood far past its
--               level's - Mac's call at the cutover, "Items judged, wealth baselined")
--   wealth      what the last judgement measured (judge.js wealthOf), NULL before the first
--   witnessed   what the service's own writes moved since the last judgement (a market sale's gold, a vault's piece) -
--               gained in the open, never charged to the budget
--   allowance   INT5: the budget's bucket, in gold - it fills with time played and a gain no witness explains spends it
--   played_at   INT5: the account's played seconds (players.played_s) at the last judgement or join
--   clean_obj, clean_seq  INT6: the last checkpoint judged clean - its object kept past the two the row rotates, for a
--               staff rollback
--   dupes       INT4: the copies this character has been found holding (server-account/src/ledger.js) - DUPES_FOR_HOLD of
--               them hold its trade for staff; a count on the row, never a count of findings the cron sweeps
--   judge_rev   INT6: one more with every write to the judge's columns from outside a checkpoint (a staff act, a copy
--               another's checkpoint proved) - a checkpoint writes its verdict only over the row it judged (verdict.js),
--               so a hold or a clear landing mid-checkpoint stands
--   svc_seq     INT6: the last sequence a service write moved the record to (a sale, a vault, a trade) - a rollback
--               past one would hand back what the service moved, so none is made
--   level_seen, level_at  INT5: the level the realm trusts - the save's, never past what the time played since it last
--               rose (`level_at`, the account's played seconds then) could reach (verdict.js LEVEL_RISE_S); the budget's
--               band and a win's spoils read it
--   law_sig     INT2: the last law finding's signature (verdict.js lawSigOf) - a held character's every checkpoint finds
--               the same thing: the finding is written once, when it changes, and a strike counted once, as it comes
--   law_excused INT6: a signature staff cleared (realm-clear) - the law's word on these pieces, judged by a person and
--               found wrong; the same signature holds nothing again, a new one does
--   wealth_v    INT5: the wealth measure's version `wealth` was read in (judge.js WEALTH_VERSION) - moved, the next
--               checkpoint measures the stored record again, and the measure's change is no gain
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
ALTER TABLE realm_characters ADD COLUMN dupes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE realm_characters ADD COLUMN judge_rev INTEGER NOT NULL DEFAULT 0;
ALTER TABLE realm_characters ADD COLUMN svc_seq INTEGER;
ALTER TABLE realm_characters ADD COLUMN level_seen INTEGER;
ALTER TABLE realm_characters ADD COLUMN level_at INTEGER;
ALTER TABLE realm_characters ADD COLUMN law_sig TEXT;
ALTER TABLE realm_characters ADD COLUMN law_excused TEXT;
ALTER TABLE realm_characters ADD COLUMN wealth_v INTEGER;
CREATE INDEX IF NOT EXISTS realm_characters_held ON realm_characters (held) WHERE held IS NOT NULL;
CREATE INDEX IF NOT EXISTS realm_characters_review ON realm_characters (review) WHERE review IS NOT NULL;

-- THE FINDINGS, kept for staff: one row a judgement that found something (a law finding, a duplicate, a gain past the
-- budget - in MEASURE, a gain that WOULD have been - or the cutover's outlier). `detail` is the judge's JSON, bounded
-- by judge.js FINDINGS_KEPT. The cron sweeps rows past REALM_FINDINGS_KEEP_S. `id` is the rowid - no AUTOINCREMENT,
-- whose sequence table the findings do not need (0013_guilds.sql's ledger the same).
CREATE TABLE IF NOT EXISTS realm_findings (
  id        INTEGER PRIMARY KEY,
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

-- INT4: THE LEDGER OF THE VALUABLE PIECES (server-account/src/ledger.js) - one row a piece: its id (a crafted piece's
-- provenance, the service's own; any other's the id its first checkpoint stamped), whose record HOLDS it, and what it is
-- (`fp`, its template and material - a piece's id on another piece is no claim to it). A piece let go is no row at all.
--   held     in its holder's record: the first to show it, or the one the service moved it to
--   escrow   in the service's hands (a market listing, a vault) - `char_id` empty; the service's move out takes it
--   gone     let go by its holder, kept only while a copy of it is known (item_dupes) - so the copy cannot take it up
-- A CLAIM (`claim_char`, `claim_at`): another record showing the piece while its holder does. The holder's checkpoint
-- without it moves it there (a drop picked up, a chest, a peer's hands); still with it past DUPE_GRACE_S, the claim was a
-- COPY - the claimant counts a duplicate and is written in item_dupes, and the holder's piece stays the holder's.
CREATE TABLE IF NOT EXISTS item_uids (
  uid        TEXT PRIMARY KEY CHECK (length(uid) = 16),
  player     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  seen_seq   INTEGER NOT NULL,
  state      TEXT NOT NULL CHECK (state IN ('held', 'escrow', 'gone')),
  fp         TEXT NOT NULL,
  claim_char TEXT,
  claim_at   INTEGER,
  at         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS item_uids_char ON item_uids (char_id);
CREATE INDEX IF NOT EXISTS item_uids_claim ON item_uids (claim_char) WHERE claim_char IS NOT NULL;
-- THE COPIES FOUND: a record that showed a piece another held - it moves that piece by no route, and is never charged for
-- it twice.
CREATE TABLE IF NOT EXISTS item_dupes (
  uid     TEXT NOT NULL,
  char_id TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (uid, char_id)
);
CREATE INDEX IF NOT EXISTS item_dupes_char ON item_dupes (char_id);

-- INT5 (its audit): A CRAFTED PIECE'S ARRIVAL, WITNESSED ONCE. The client mints a crafted piece at its own pack - from
-- the service's word at the craft, or at a market delivery's collection - so no service write moves the record, and the
-- budget read the piece as a find. `credited` 0: the service owes the account that owns the piece a witness for it -
-- made, or its owner moved (a sale, an auction won, a commission filled); the owner's next checkpoint that holds it
-- counts its worth witnessed and sets 1 (verdict.js, judge.js judgeProducts). Every piece made before the judge stands
-- in its owner's record already, which the first judgement's baseline reads: 1.
ALTER TABLE products ADD COLUMN credited INTEGER NOT NULL DEFAULT 0 CHECK (credited IN (0, 1));
UPDATE products SET credited = 1;

-- INT5/INT6: THE DIALS STAFF SET - the budget's line and whether it holds (`budget`: JSON, server-account/src/budget.js
-- budgetConfigOf), written by a developer through /v1/mod/realm-budget, every change kept by who and when.
CREATE TABLE IF NOT EXISTS realm_config (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL CHECK (json_valid(value)),
  at     INTEGER NOT NULL,
  by     TEXT
);
