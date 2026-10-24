-- STAFF-PANEL3-REALM (2026-10-22, design doc "DFO Staff Panel: design", build step 3 - "Remove items", "Trade freezes",
-- "Built on the save judge"; its weak spots "Freeze and trade holds" and "Items, census and economy"): THE STAFF'S
-- 30-DAY STORE of what an Admin took off the market or out of a player's save (server-account/src/staffRealm.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- it.
--
-- staff_evidence  one row a removal (mob, 04:10Z: "admins can take an item off the market or away from a player"): every
--                 removal asks a reason and a note, and the item is kept 30 days so it can be put back.
--   kind      'player' (taken out of a character's saved record), 'listing' or 'auction' (a Remove from market: the
--             listing ended and its goods kept here instead of going back to the seller)
--   player    the account it was taken from (the seller, the holder); `char_id` the character
--   source    the listing's or auction's id (a market removal); NULL for a player's
--   item      the piece as it stood (a save's piece, a listing's item, a crafted piece's record), JSON - NULL for a Stores
--             material, whose units `detail` names
--   key       its ledger key (item_uids) when the ledger follows it - that row is marked taken by staff (`char_id`
--             'seized', ledger.js SEIZED), so a later save that shows the piece again is charged as a copy
--   detail    what else the removal says, JSON: a market removal's kind, material, units, price and its nonce (`rn`); a
--             player's the list and place it lay in and the record's sequence before and after
--   reason    'duplicated' (a duplicated item), 'duped-gold' (bought with duped gold), 'bug-reward' (a bug's reward),
--             'other' - the design's four
--   note      the staff member's note, required; `by_id`/`by_name` who took it
--   until     `at` + 30 days: Put back closes then, and the hourly job deletes the row (cron.js staff-evidence)
--   state     'kept', or 'returned' once Put back gave it back (`returned_at`, `returned_by`)
-- No foreign keys - a row outlives the account and the character it names, as the audit log's do.
CREATE TABLE IF NOT EXISTS staff_evidence (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('player', 'listing', 'auction')),
  player      TEXT NOT NULL,
  char_id     TEXT,
  source      TEXT,
  item        TEXT CHECK (item IS NULL OR json_valid(item)),
  key         TEXT,
  detail      TEXT CHECK (detail IS NULL OR json_valid(detail)),
  reason      TEXT NOT NULL CHECK (reason IN ('duplicated', 'duped-gold', 'bug-reward', 'other')),
  note        TEXT NOT NULL,
  by_id       TEXT NOT NULL,
  by_name     TEXT,
  at          INTEGER NOT NULL,
  until       INTEGER NOT NULL,
  state       TEXT NOT NULL DEFAULT 'kept' CHECK (state IN ('kept', 'returned')),
  returned_at INTEGER,
  returned_by TEXT
);
CREATE INDEX IF NOT EXISTS staff_evidence_at ON staff_evidence (at);
CREATE INDEX IF NOT EXISTS staff_evidence_until ON staff_evidence (until);
CREATE INDEX IF NOT EXISTS staff_evidence_char ON staff_evidence (char_id, state) WHERE char_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS staff_evidence_player ON staff_evidence (player, at);
