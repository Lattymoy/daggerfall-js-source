-- WILD-INSURE (2026-10-26, the owner: "Overhauling the open PvP to be a bit more palatable, being able to insure gear on
-- death"; asked, "Kept, policy spent" at "20% of worth" - bible/11-Multiplayer/Wild-Zone.md section 4b) - A POLICY ON A
-- PIECE OF GEAR, AND REPEAT-SHIELD's READ OF THE FALLS.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- it (acct194). A policy is written by `/v1/wild/insure` (server-account/src/wildInsure.js) in the batch that pays its
-- premium off the record, and spent by a fall at another player's hand (wild.js wildFall) in the batch that keeps its
-- piece. ONE ROW A PIECE A CHARACTER: `key` the piece's ledger key (systems/item/itemIds.js ledgerKeyOf - its id, or a
-- crafted piece's provenance), `premium` the gold paid, `at` the write (in force WILD_INSURE_SETTLE_S after it), `state`
-- 'active' | 'spent' | 'lapsed', and the fall that spent it (`spent_r`, `spent_at` - a lapse's moment too). A spent or
-- lapsed policy is written afresh by the next. AUDIT PVP-EASE L1-2: a policy whose piece the record holds nowhere any more
-- (sold, traded, salvaged, dropped before it was in force) LAPSES at the character's next insure, and never counts
-- toward WILD_INSURE_MAX - before, it stood 'active' for good and 32 of them shut the door.
--
-- CASCADE: an account that is gone takes its policies with it.
CREATE TABLE IF NOT EXISTS wild_insurance (
  char_id  TEXT NOT NULL,
  key      TEXT NOT NULL,
  player   TEXT NOT NULL,
  premium  INTEGER NOT NULL,
  at       INTEGER NOT NULL,
  state    TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'spent', 'lapsed')),
  spent_r  TEXT,
  spent_at INTEGER,
  PRIMARY KEY (char_id, key),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wild_insurance_char ON wild_insurance (char_id, state);

-- REPEAT-SHIELD (2026-10-26, the owner chose "Repeat-kill shield"): a fall asks whether its killer felled the same
-- character inside half an hour of it - read by the character, the killer and the KILL's moment. AUDIT PVP-EASE L1-1:
-- `ki` the receipt's own signing (`i`), never `at` (when the fall was carried): a receipt is good for an hour, so a killer
-- who held a second kill until the first's row was half an hour old took it whole. A fall carried before this column
-- (and a foe's, which has no receipt) has none, and shields nothing.
ALTER TABLE wild_falls ADD COLUMN ki INTEGER;
CREATE INDEX IF NOT EXISTS idx_wild_falls_pair ON wild_falls (char_id, killer, ki);
