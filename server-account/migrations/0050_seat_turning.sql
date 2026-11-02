-- SEAT1c (2026-09-30, Mac: "Finish the seats") - THE TURNING: THE CHARTERS, THE RIGHTS, THE LEGACY
-- (bible/11-Multiplayer/Seats-Arc.md 5.2; src/net/townSeatLaw.js turningPlan, server-account/src/seatTurning.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- THE SETTLE'S KEY (SEAT0 5.2: "one D1 transaction, idempotent on town_seat_weeks.week - a second reader finds it
-- settled"): the settle's batch BEGINS by inserting its week here, a plain INSERT, so a second reader racing the first
-- fails on the key and its whole batch rolls back.
CREATE TABLE IF NOT EXISTS town_seat_weeks (
  week        INTEGER PRIMARY KEY,
  settled_at  INTEGER NOT NULL
);

-- THE CHARTERS HELD: a seat's holder, its tier (the titles and glyphs it gives, 7.4), the week it took the Charter, its
-- Standing (SEAT0 7.3), and the week it is in truce (SEAT0 5.2 step 6: a seat that changed hands cannot be challenged
-- at the next Turning). `region` the seat's, so
-- the holder's influence counts there as a pledge's would (SEAT0 4.1: "pledged to it automatically"). A guild that goes
-- by a path the refusals do not cover takes its Charters with it (SEAT0 16) - the seat is unheld.
CREATE TABLE IF NOT EXISTS town_seat_holds (
  key         INTEGER PRIMARY KEY,
  guild_id    TEXT NOT NULL,
  region      INTEGER NOT NULL,
  tier        TEXT NOT NULL CHECK (tier IN ('palace', 'crown')),
  since_week  INTEGER NOT NULL,
  standing    INTEGER NOT NULL DEFAULT 50 CHECK (standing >= 0 AND standing <= 100),
  truce_week  INTEGER,
  at          INTEGER NOT NULL,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_town_seat_holds_guild ON town_seat_holds (guild_id, region);

-- LEGACY (SEAT0 4.2: "10% of a guild's influence at each seat it pledged carries into the next week"): what each guild
-- carried into `week` at a seat - added to its claim there, and the settle's first tiebreak.
CREATE TABLE IF NOT EXISTS town_seat_legacy (
  week      INTEGER NOT NULL,
  key       INTEGER NOT NULL,
  guild_id  TEXT NOT NULL,
  amount    INTEGER NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (week, key, guild_id)
);

-- THE WEEK'S BATTLES THE TURNING NAMED: a Right of Siege (`siege` - the challenger, `against` the holder, its total and
-- the defence it beat) or a Contested seat's Tourney (`tourney` - the two contenders). `week` the week they are fought
-- in (the one the Turning opened). SEAT2a schedules and fights them; until it does, a Right is the Chronicle's.
CREATE TABLE IF NOT EXISTS town_seat_rights (
  week      INTEGER NOT NULL,
  key       INTEGER NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('siege', 'tourney')),
  guild_id  TEXT NOT NULL,
  against   TEXT,
  total     INTEGER NOT NULL DEFAULT 0,
  defence   INTEGER NOT NULL DEFAULT 0,
  at        INTEGER NOT NULL,
  PRIMARY KEY (week, key),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_town_seat_rights_guild ON town_seat_rights (guild_id, week);
