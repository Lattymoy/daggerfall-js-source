-- PROF2b (2026-10-03, Mac: "plus we need to build motherloads") - THE MOTHERLODES
-- (bible/06-Systems/Professions-Arc.md 6, 35; the law is src/net/motherlodeLaw.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- A UTC DAY'S MOTHERLODES, picked once - on the day's first read - from the pixels the witnesses had confirmed before it
-- began (server-account/src/motherlodes.js motherlodesOf): its place in the day (`k`, 0-2), its pixel and its ground as
-- the witnesses confirmed it, its ore, and when it rises and goes (epoch seconds). The pick is a pure function of
-- ground the day can no longer change, so two first reads racing keep the same three (INSERT OR IGNORE).
CREATE TABLE IF NOT EXISTS motherlodes (
  day       INTEGER NOT NULL,
  k         INTEGER NOT NULL CHECK (k >= 0 AND k <= 2),
  x         INTEGER NOT NULL,
  y         INTEGER NOT NULL,
  climate   INTEGER NOT NULL,
  region    INTEGER NOT NULL,
  material  TEXT NOT NULL,
  opens_at  INTEGER NOT NULL,
  closes_at INTEGER NOT NULL,
  PRIMARY KEY (day, k)
);

-- A MOTHERLODE STRUCK: one an account a UTC day (the key - PROF0 6: "an account takes at most one Motherlode a day"),
-- at most twenty a Motherlode (the deciding INSERT's count), written with the request's own nonce `n` so the Stores,
-- the XP and the silver after it move for this strike alone. `watch` the relay's Watch receipt it stood on (its
-- account, nonce and issue - `s:c:i`), the audit's.
-- AUDIT SILVER-WAYS C3: THE DAY PICKED - its mark, kept with its picks (`picked` how many: none on a realm nobody has
-- walked, fewer than three where the ground is scarce), so the day's confirmed ground is read once, not at every read
-- and every strike of a day that picked fewer than three; `n` the read that picked it (its picks are written only
-- under its own mark - two first reads racing the day's turn keep one pick, never a mix).
CREATE TABLE IF NOT EXISTS motherlode_days (
  day    INTEGER PRIMARY KEY,
  picked INTEGER NOT NULL CHECK (picked >= 0 AND picked <= 3),
  n      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS motherlode_strikes (
  day      INTEGER NOT NULL,
  k        INTEGER NOT NULL,
  player   TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  material TEXT NOT NULL,
  qty      INTEGER NOT NULL CHECK (qty >= 1),
  xp       INTEGER NOT NULL CHECK (xp >= 0),
  watch    TEXT NOT NULL,
  at       INTEGER NOT NULL,
  rid      TEXT NOT NULL,
  n        TEXT NOT NULL,
  PRIMARY KEY (day, player),
  UNIQUE (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_motherlode_strikes_lode ON motherlode_strikes (day, k);
