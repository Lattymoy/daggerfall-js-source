-- DRAGON4 (2026-10-29, the owner: "On death, the dragon falls ... Dropping loot and one super rare chance of taming";
-- bible/11-Multiplayer/Dwarven-Dragon.md section 8) - THE DRAGONS SLAIN, THEIR HOARDS AND THEIR TAMES.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that
-- serves /v1/dragon/claim.
--
-- ONE ROW A DRAGON AN ACCOUNT SLEW, keyed (watch, account): a watch holds one dragon, so a receipt counts once however
-- often it is claimed, and an account counts one dragon a watch however many sites a modified client fought one at.
-- `look` 0 the brass, 1 the Aetherbright; `earned` dealt or stood; `nonce` the claim that wrote it; `tame` whether its
-- draw tamed one.
CREATE TABLE IF NOT EXISTS dragon_kills (
  watch   INTEGER NOT NULL,
  account TEXT NOT NULL,
  look    INTEGER NOT NULL,
  char_id TEXT NOT NULL,
  earned  TEXT NOT NULL,
  level   INTEGER NOT NULL,
  nonce   TEXT NOT NULL,
  at      INTEGER NOT NULL,
  body    TEXT,
  tame    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (watch, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dragon_account ON dragon_kills (account);
-- A DRAGON'S HOARD, ONCE A WATCH AND ACCOUNT (the serpent's serpent_spoils): given to the claim whose device id wrote it.
CREATE TABLE IF NOT EXISTS dragon_spoils (
  watch   INTEGER NOT NULL,
  account TEXT NOT NULL,
  cid     TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (watch, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
-- A TAMED DRAGON: its id (the mount's item carries it - the judge's provenance), the character it is bound to, its look
-- and the watch that tamed it. One a character (UNIQUE): a kill that draws a tame for a character that holds one tames none.
CREATE TABLE IF NOT EXISTS dragon_mounts (
  id      TEXT PRIMARY KEY,
  account TEXT NOT NULL,
  char_id TEXT NOT NULL,
  look    INTEGER NOT NULL,
  watch   INTEGER NOT NULL,
  at      INTEGER NOT NULL,
  UNIQUE (account, char_id),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dragon_mount_watch ON dragon_mounts (account, watch);
