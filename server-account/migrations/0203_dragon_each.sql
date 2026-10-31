-- DRAGON-EACH (2026-10-31, the owner: "open up the rewards", of AUDIT DRAGON-CELL D4; bible/11-Multiplayer/Dwarven-Dragon.md
-- section 8) - EACH DRAGON OF A WATCH ITS OWN KILL. A watch holds up to four dragons (DRAGON-CELL), and a kill was keyed
-- (watch, account), so a second dragon slain in one watch paid nothing. A kill and its hoard are keyed (watch, place,
-- account) now: `place` the dragon's cell (src/net/dragon/dragonLaw.js dragonPlaceOf), which the receipt signs; -1 a
-- receipt from a relay before it, one a watch as before. A tame names its place, so the claim reads its own back.
-- Every row carried as it stood.
CREATE TABLE dragon_kills_next (
  watch   INTEGER NOT NULL,
  place   INTEGER NOT NULL DEFAULT -1,
  account TEXT NOT NULL,
  look    INTEGER NOT NULL,
  char_id TEXT NOT NULL,
  earned  TEXT NOT NULL,
  level   INTEGER NOT NULL,
  nonce   TEXT NOT NULL,
  at      INTEGER NOT NULL,
  body    TEXT,
  tame    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (watch, place, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO dragon_kills_next (watch, place, account, look, char_id, earned, level, nonce, at, body, tame)
  SELECT watch, -1, account, look, char_id, earned, level, nonce, at, body, tame FROM dragon_kills;
DROP INDEX IF EXISTS idx_dragon_account;
DROP TABLE dragon_kills;
ALTER TABLE dragon_kills_next RENAME TO dragon_kills;
CREATE INDEX IF NOT EXISTS idx_dragon_account ON dragon_kills (account);

CREATE TABLE dragon_spoils_next (
  watch   INTEGER NOT NULL,
  place   INTEGER NOT NULL DEFAULT -1,
  account TEXT NOT NULL,
  cid     TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (watch, place, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO dragon_spoils_next (watch, place, account, cid, at)
  SELECT watch, -1, account, cid, at FROM dragon_spoils;
DROP TABLE dragon_spoils;
ALTER TABLE dragon_spoils_next RENAME TO dragon_spoils;

ALTER TABLE dragon_mounts ADD COLUMN place INTEGER NOT NULL DEFAULT -1;
DROP INDEX IF EXISTS idx_dragon_mount_watch;
CREATE INDEX IF NOT EXISTS idx_dragon_mount_watch ON dragon_mounts (account, watch, place);
