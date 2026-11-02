-- CROWN1 part two (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up") - THE ROYAL TOURNEY (bible/11-Multiplayer/
-- Seats-Arc.md 7.6; src/net/townSeatLaw.js, server-account/src/seatRoyal.js): the ring the contenders' games agree,
-- each bout a winner's receipt brings, and the titles kept for good.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- THE RING: its centre as each contender's game derived it (the pass's `sf`, one point, as JSON) - one row an account a
-- week a crown; settled when two accounts' agree (townSeatLaw.js settleRing).
CREATE TABLE IF NOT EXISTS town_seat_royal_fields (
  week       INTEGER NOT NULL,
  key        INTEGER NOT NULL,
  account    TEXT NOT NULL,
  field      TEXT NOT NULL,
  at         INTEGER NOT NULL,
  PRIMARY KEY (week, key, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
-- A ROYAL TOURNEY'S WEEK: its ring once settled, and the champion its Turning named (null until then, or none won).
CREATE TABLE IF NOT EXISTS town_seat_royal (
  week       INTEGER NOT NULL,
  key        INTEGER NOT NULL,
  field      TEXT,
  champion   TEXT,
  at         INTEGER NOT NULL,
  PRIMARY KEY (week, key)
);
-- EACH BOUT a winner's `t1` receipt brought - once a bout (the room numbers them); `counted` whether the ladder counts
-- it (the same two at most three a UTC day - asked in its own INSERT).
CREATE TABLE IF NOT EXISTS town_seat_bouts (
  week       INTEGER NOT NULL,
  key        INTEGER NOT NULL,
  n          INTEGER NOT NULL,
  winner     TEXT NOT NULL,
  loser      TEXT NOT NULL,
  day        INTEGER NOT NULL,
  counted    INTEGER NOT NULL CHECK (counted IN (0, 1)),
  at         INTEGER NOT NULL,
  PRIMARY KEY (week, key, n)
);
CREATE INDEX IF NOT EXISTS idx_town_seat_bouts_pair ON town_seat_bouts (week, key, day, winner, loser);
-- THE TITLES KEPT FOR GOOD (Seats-Arc 7.4, 7.6): a Royal Tourney's champion now; SEASON1's Crowned and Keeper will
-- join them. An account's, as the receipt that won it named.
CREATE TABLE IF NOT EXISTS town_seat_titles (
  account    TEXT NOT NULL,
  title      TEXT NOT NULL CHECK (title IN ('champion', 'crowned', 'keeper')),
  key        INTEGER NOT NULL,
  week       INTEGER NOT NULL,
  at         INTEGER NOT NULL,
  PRIMARY KEY (account, title, key, week),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
