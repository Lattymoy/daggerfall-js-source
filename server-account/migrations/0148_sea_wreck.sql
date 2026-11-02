-- SHIP-PVP (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - broadsides
-- between captains in the open sea, a ship wrecked and boarded, her hold a prize; bible/03-World/Eltheric-Ocean.md SHIP-PVP).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that serves
-- /v1/sea/wreck and /v1/sea/prize (acct168).
--
-- A WRECK is the relay's signed word that a captain's ship was wrecked at another's guns (net/wild/wildReceipt.js `n1`),
-- taken once (its id - server-account/src/seaWreck.js): boarded, her hold's share (net/sea/seaPrizeLaw.js) off her
-- captain's record into the service's hands - a PRIZE, piece by piece, held for her killer's character to collect
-- (`collected`), or back to her captain's once SEA_PRIZE_HOLD_S has passed (`returned`). No piece is made here.
CREATE TABLE IF NOT EXISTS sea_wrecks (
  r           TEXT PRIMARY KEY,        -- the wreck's id (the relay's)
  victim      TEXT NOT NULL,           -- the wrecked captain's account...
  victim_char TEXT NOT NULL,           -- ...and character
  killer      TEXT NOT NULL,           -- her killer's account...
  killer_char TEXT NOT NULL,           -- ...and character
  boat        INTEGER NOT NULL,        -- her uid
  boarded     INTEGER NOT NULL CHECK (boarded IN (0, 1)),
  took        TEXT NOT NULL,           -- the pieces the prize took, as her game finds them again (JSON - their marks, never their places)
  seq         INTEGER,                 -- her record's sequence once they were taken (none taken: NULL) - a tab of hers past it holds none of them
  at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sea_prizes (
  r           TEXT NOT NULL,           -- the wreck (sea_wrecks.r)
  i           INTEGER NOT NULL,        -- the piece's place among its prize
  victim      TEXT NOT NULL,
  victim_char TEXT NOT NULL,
  killer      TEXT NOT NULL,
  killer_char TEXT NOT NULL,           -- the character it is held for
  rec         TEXT NOT NULL,           -- the piece, as her record held it
  at          INTEGER NOT NULL,
  until_s     INTEGER NOT NULL,        -- its killer's to collect until; its captain's to reclaim from
  state       TEXT NOT NULL CHECK (state IN ('held', 'collected', 'returned')),
  to_char     TEXT,                    -- the record it went into
  ended_at    INTEGER,
  PRIMARY KEY (r, i)
);
CREATE INDEX IF NOT EXISTS sea_prizes_killer ON sea_prizes (killer, killer_char, state, until_s);
CREATE INDEX IF NOT EXISTS sea_prizes_victim ON sea_prizes (victim, victim_char, state, until_s);
-- AUDIT SEA VENTURES B5: the hourly sweep's - a wreck past its receipt's hour, a prize ended past its keeping
CREATE INDEX IF NOT EXISTS sea_wrecks_at ON sea_wrecks (at);
CREATE INDEX IF NOT EXISTS sea_prizes_ended ON sea_prizes (ended_at) WHERE state != 'held';
