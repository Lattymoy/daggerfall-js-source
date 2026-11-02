-- HUNTERS-MARK (2026-10-27; a player, handed on by the owner: "Add more horizontal progression please!";
-- bible/06-Systems/Bounty-Boards.md section 12) - THE HUNT'S LEDGER.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that
-- serves /v1/hunt/state and /v1/hunt/clear.
--
-- A CLEAR is a paid bounty a character reported (server-account/src/hunts.js huntClear): a board's notice, or the
-- week's named mark. It is the client's word, bounded there (src/net/huntLaw.js) - one row a character a notice's slot
-- (`key`: day.px.py.slot) or a mark's week (`m.<week>`), the account's day under HUNT_CLEARS_DAY_MAX. The hunter's rank,
-- the hunt's titles and the board's tally are read off these rows; nothing else is kept.
CREATE TABLE IF NOT EXISTS hunt_clears (
  player   TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  kind     TEXT NOT NULL CHECK (kind IN ('board', 'mark')),
  key      TEXT NOT NULL,           -- a notice's slot, or a mark's week
  id       TEXT NOT NULL,           -- the bounty's id as it was taken (its level in it)
  tier     INTEGER NOT NULL,        -- its monster tier, 0..4
  region   INTEGER,                 -- the board's region, the client's word (a seat's influence is counted in it)
  day      INTEGER NOT NULL,        -- the UTC day it was recorded (the account's day bound)
  at       INTEGER NOT NULL,
  PRIMARY KEY (player, char_id, kind, key),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS hunt_clears_day ON hunt_clears (player, day);
