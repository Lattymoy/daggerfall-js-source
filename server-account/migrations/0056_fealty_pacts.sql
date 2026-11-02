-- CROWN2 (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up") - FEALTY AND PACTS (bible/11-Multiplayer/
-- Seats-Arc.md 7.8; src/net/townSeatLaw.js, server-account/src/seatPolitics.js): crown politics.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- FEALTY: one liege a vassal. Offered by either side (`offered_by` the guild that offered), sworn when the other
-- accepts, `breaking` from a break asked until the Turning that ends it (`broken_by` the guild that broke it).
CREATE TABLE IF NOT EXISTS guild_fealty (
  vassal       TEXT PRIMARY KEY,
  liege        TEXT NOT NULL,
  state        TEXT NOT NULL CHECK (state IN ('offered', 'sworn', 'breaking')),
  offered_by   TEXT NOT NULL,
  broken_by    TEXT,
  since_week   INTEGER,
  at           INTEGER NOT NULL,
  FOREIGN KEY (vassal) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (liege) REFERENCES guilds(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_guild_fealty_liege ON guild_fealty (liege, state);
-- PACTS OF NON-AGGRESSION: a pair (`a` < `b`), offered by one, signed when the other accepts, standing until the week
-- `until_week` begins (the Season's end - townSeatLaw.js pactUntil). A Pact broken early is deleted, and announced.
CREATE TABLE IF NOT EXISTS guild_pacts (
  a            TEXT NOT NULL,
  b            TEXT NOT NULL,
  state        TEXT NOT NULL CHECK (state IN ('offered', 'signed')),
  offered_by   TEXT NOT NULL,
  until_week   INTEGER NOT NULL,
  at           INTEGER NOT NULL,
  PRIMARY KEY (a, b),
  CHECK (a < b),
  FOREIGN KEY (a) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (b) REFERENCES guilds(id) ON DELETE CASCADE
);
-- THE SEATS' RED ANNOUNCEMENTS - what the whole server reads in red (a Pact broken early, 7.8), carried on the seats'
-- list for a day (townSeatLaw.js SEAT_RED_S).
CREATE TABLE IF NOT EXISTS town_seat_red (
  seq          INTEGER PRIMARY KEY,
  text         TEXT NOT NULL,
  at           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_town_seat_red_at ON town_seat_red (at);
