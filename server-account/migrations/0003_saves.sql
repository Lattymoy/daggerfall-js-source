-- ACC2 (2026-09-22) - THE CARD. The blob lives in R2; this is the index
-- over it, and it is the only thing a listing reads.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Additive, and NOT idempotent beyond the IF NOT EXISTS above each
-- object - the deploy applies it exactly once through the
-- `d1_migrations` ledger, which is why ACC1-CI replaced the pair of
-- `d1 execute --file` lines.

-- ── THE SLOT CARD ──────────────────────────────────────────────────
-- A SLOT IS (character, save name), NEVER THE LOCAL INDEX. The browser
-- store keys a slot by an integer - SAV4's "a new pair takes the FIRST
-- FREE integer key" - and that integer is a fact about ONE store: two
-- devices that saved in a different order hold the same character's
-- QuickSave under different numbers. The slot's real identity is
-- already written down (DFU's FindSaveFolderByNames, corrected by
-- CHARID1 to use the character's ID rather than its name), so it is the
-- identity here too and the integer never leaves the device.
--
-- THIS TABLE IS THE SaveInfo. saveSlots.js keeps SAV4's law that "a
-- slot is only real WITH its SaveInfo - an orphaned data blob does not
-- enumerate", and the same law holds across the wire: the row is
-- written first, the blobs are refused without one, and a listing reads
-- rows. `bytes` is 0 until the data actually lands, so a half-finished
-- upload is visible as one rather than passing for a backup.
CREATE TABLE IF NOT EXISTS saves (
  player_id      TEXT NOT NULL,
  -- systems/characterId.js mints this; it is a UUID on any runtime that
  -- has one. Opaque here - the service never parses it, it only files
  -- by it.
  character_id   TEXT NOT NULL,
  -- The player's own words ("QuickSave", "before the lich"). Bounded by
  -- SAVE_NAME_MAX and encoded into the R2 key rather than pasted into
  -- it.
  save_name      TEXT NOT NULL,
  -- Display only, and deliberately so: CHARID1 exists BECAUSE a name is
  -- not an identity. A player who renames a character sees the new name
  -- on their next upload and keeps every slot.
  character_name TEXT,
  -- The port's one clock, in CLASSIC MINUTES (saveSlots.js SaveInfo
  -- dateAndTime.gameTime). A compare-and-display value, never an
  -- arithmetic one - and it is what SP1's import law reads to decide a
  -- slot is one the store already holds.
  game_time      INTEGER,
  -- Date.now() milliseconds, as the card carries it.
  real_time      INTEGER,
  -- The port's BUILD_TAG, so a slot written by an older client can be
  -- SAID to be older rather than guessed at.
  dfu_version    TEXT,
  save_version   INTEGER,
  -- What R2 actually holds. 0 means the card exists and the blob does
  -- not - see above.
  bytes          INTEGER NOT NULL DEFAULT 0,
  shot_bytes     INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  PRIMARY KEY (player_id, character_id, save_name),
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- The listing, newest first, and the count SAVES_MAX is enforced
-- against. Both are per player, which is the only way this table is
-- ever read.
CREATE INDEX IF NOT EXISTS idx_saves_player ON saves (player_id, updated_at DESC);
