-- STAFF-PANEL4-CENSUS (2026-10-22, mob picked it, 04:13Z; design doc "DFO Staff Panel: design", "Item and gold census",
-- "Built on the save judge", "Server load" and the weak spots "Copies found misses modded dupes..." and "Census rows ride
-- every save..."): THE ITEM AND GOLD CENSUS, AND THE CONTESTED PIECES (server-account/src/staffCensus.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- them: the checkpoint's own read asks `item_census` (realm.js checkpointRealm).
--
-- THE TALLY (staffCensus.js censusTally): a character's gold (purse and banks, `g`) and how many of each item template it
-- holds (`t<index>`, stacks counted by their units), as one small JSON object of at most CENSUS_KINDS_MAX kinds. The
-- design's load plan, not the first idea (one row per item kind per checkpoint, some 17 times today's checkpoint writes):
--   - the hourly wealth row the checkpoint already writes carries it, ONLY when it changed - one bounded column, no row
--     of its own (`tally` NULL: the hour changed nothing). It goes with the hour, at REALM_WEALTH_KEEP_S;
--   - one latest-tally row per character (`item_census`), written in the checkpoint's own batch only when the tally
--     changed, and never swept - so an idle character still counts. A character made before this is filled once, off
--     peak, by the census's backfill (cron.js census-backfill, behind CENSUS_BACKFILL). It goes with its character.
-- No CHECK on either: a census write must never be the statement that fails a checkpoint's batch.
ALTER TABLE realm_wealth_hours ADD COLUMN tally TEXT;

CREATE TABLE IF NOT EXISTS item_census (
  char_id TEXT PRIMARY KEY,
  player  TEXT NOT NULL,
  tally   TEXT NOT NULL,
  seq     INTEGER NOT NULL,
  at      INTEGER NOT NULL,
  FOREIGN KEY (char_id) REFERENCES realm_characters(id) ON DELETE CASCADE
);

-- THE DAILY TREND: each kind's server-wide count once a UTC day, off peak (cron.js census-day) - carried (the living
-- characters' latest tallies), in the Stores (a character's and a guild's), in guild vaults (for gold, realm gold only),
-- and at the market (what the service holds: listings and auctions, deliveries uncollected, goods on the road; for Marks,
-- the ledger's escrow). `stores` NULL where the kind has no such place. Kept CENSUS_DAYS_KEEP.
CREATE TABLE IF NOT EXISTS item_census_days (
  kind    TEXT NOT NULL,
  day     INTEGER NOT NULL,
  carried INTEGER NOT NULL DEFAULT 0,
  stores  INTEGER,
  vaults  INTEGER,
  market  INTEGER,
  holders INTEGER NOT NULL DEFAULT 0,
  at      INTEGER NOT NULL,
  PRIMARY KEY (kind, day)
);

-- CONTESTED PIECES (the weak spot: "Copies found misses modded dupes and can blame an innocent player... call it
-- 'contested pieces', show the first holder and the claimant with times, require a trail check before Remove"). A copy
-- found (item_dupes, ledger.js) keeps which piece it is and both records it stood in, not only the lock:
--   first_char, first_at  the record the ledger had holding the piece, and since when (NULL: the service held it - a
--                         market escrow - or a row from before this)
--   claimant, claim_at    the record that showed it while the first held it, and since when
--   fp                    what the piece is: its template and material, as the ledger prints it (judge.js ledgerPrintOf)
--   kind                  how it was found: 'twice' (one record showed it twice), 'claim' (a claim its holder's checkpoint
--                         outlasted - the claimant's copy), 'craft' (the craft's record named the claimant - the first
--                         holder's copy), 'escrow' (a claim on a piece the service sold on), 'drop' (a death's dropped
--                         piece, the fallen's own - bookkeeping, never listed as contested); NULL before this
--   trail_at, trail_by, trail_found, trail_note  the trail check a staff member made: when, who (players.id), what they
--                         found ('copier', 'innocent' or 'unclear') and why. A staff Remove of a contested piece needs
--                         one (the realm builder's take-item path reads trail_at).
-- The rows from before this keep NULL holders - only their print is filled, from the ledger's row where it stands.
ALTER TABLE item_dupes ADD COLUMN first_char TEXT;
ALTER TABLE item_dupes ADD COLUMN first_at INTEGER;
ALTER TABLE item_dupes ADD COLUMN claimant TEXT;
ALTER TABLE item_dupes ADD COLUMN claim_at INTEGER;
ALTER TABLE item_dupes ADD COLUMN fp TEXT;
ALTER TABLE item_dupes ADD COLUMN kind TEXT;
ALTER TABLE item_dupes ADD COLUMN trail_at INTEGER;
ALTER TABLE item_dupes ADD COLUMN trail_by TEXT;
ALTER TABLE item_dupes ADD COLUMN trail_found TEXT CHECK (trail_found IS NULL OR trail_found IN ('copier', 'innocent', 'unclear'));
ALTER TABLE item_dupes ADD COLUMN trail_note TEXT;
UPDATE item_dupes SET fp = (SELECT u.fp FROM item_uids u WHERE u.uid = item_dupes.uid) WHERE fp IS NULL;
-- THE PANEL'S LIST AND HOME'S COUNTS STAND ON THE LISTED ROWS ALONE: a death's dropped piece ('drop' - a row for every
-- id-bearing piece in every wild death, never swept) is never listed, so it is in none of these and pays for none of
-- them. Every listed row newest first (the newest list, the checked ones); the unchecked ones by their character (the
-- count that makes a row high, Home's counts - trail_at and kind ride along so a count reads the index alone) and newest
-- first (the urgent list's walk). A list's order and its page's place (staffCensus.js contestedPage) are the key's own.
CREATE INDEX IF NOT EXISTS item_dupes_at ON item_dupes (at, uid, char_id) WHERE kind IS NULL OR kind != 'drop';
CREATE INDEX IF NOT EXISTS item_dupes_open ON item_dupes (char_id, trail_at, kind) WHERE trail_at IS NULL AND (kind IS NULL OR kind != 'drop');
CREATE INDEX IF NOT EXISTS item_dupes_open_at ON item_dupes (at, uid, char_id) WHERE trail_at IS NULL AND (kind IS NULL OR kind != 'drop');

-- THE GOODS ON THE ROAD (the census's market place): a couriered material sale not yet in its buyer's Stores, by material
-- - only those rows, so the census never walks the sales' history.
CREATE INDEX IF NOT EXISTS idx_market_sales_on_road ON market_sales (material, units) WHERE kind = 'material' AND delivered = 0;
