-- SEAT2b (2026-10-01, Mac: "Finish the seats"; "We need to do a comprehensive audit on everything and finish the not
-- done") - A SEAT'S FORTIFICATIONS (bible/11-Multiplayer/Seats-Arc.md 7.5): each work's standing tier, the SEAT's and not
-- its holder's, and the one tier a project is raising - begun by the holder's Guildmaster or an Officer (its Marks paid
-- from the treasury then), supplied from the seat's stockpile (town_seat_stockpile), standing 2, 4 or 7 days after its
-- last need was met (server-account/src/seatForts.js; src/net/fortLaw.js the law). A capture and a Season's end take
-- each a tier down; Season 0's end wipes them (seatTurning.js SEASON_ZERO_WIPED).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
CREATE TABLE IF NOT EXISTS town_seat_forts (
  key        INTEGER NOT NULL,
  work       TEXT NOT NULL,
  tier       INTEGER NOT NULL DEFAULT 0 CHECK (tier >= 0 AND tier <= 3),
  building   INTEGER CHECK (building IS NULL OR (building >= 1 AND building <= 3)),
  guild_id   TEXT,
  builder    INTEGER NOT NULL DEFAULT 0 CHECK (builder IN (0, 1)),
  stands_at  INTEGER,
  at         INTEGER NOT NULL,
  PRIMARY KEY (key, work)
);
-- what a building project holds of its needs, moved in from the stockpile (and back to it where the project falls)
CREATE TABLE IF NOT EXISTS town_seat_fort_held (
  key       INTEGER NOT NULL,
  work      TEXT NOT NULL,
  material  TEXT NOT NULL,
  qty       INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  PRIMARY KEY (key, work, material)
);
-- a Fortifier's save (Masonry 100: "once a Season a seat's Walls skip their drop on capture"), one a seat a Season
CREATE TABLE IF NOT EXISTS town_seat_fortifier (
  season  INTEGER NOT NULL,
  key     INTEGER NOT NULL,
  account TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (season, key)
);
-- a challenger's Siege Camp (4.2): what its seat writs delivered at a seat it pledged, a week - spent at that week's
-- Turning (its Ram Kits to the siege it won, the rest burnt) and never withdrawn
CREATE TABLE IF NOT EXISTS town_seat_camps (
  week      INTEGER NOT NULL,
  key       INTEGER NOT NULL,
  guild_id  TEXT NOT NULL,
  material  TEXT NOT NULL,
  qty       INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  PRIMARY KEY (week, key, guild_id, material)
);
-- A SEAT WRIT (Professions-Arc 11; Seats-Arc 4.2): a guild writ posted for a seat - the holder's to its stockpile
-- (`camp` 0), a pledged challenger's to its Siege Camp (`camp` 1); its deliveries go there, not to the guild Stores
ALTER TABLE guild_writs ADD COLUMN seat INTEGER;
ALTER TABLE guild_writs ADD COLUMN camp INTEGER NOT NULL DEFAULT 0 CHECK (camp IN (0, 1));
-- A battle's Rams (6.2): the Ram Kits its attacker's Siege Camp sent it at the Turning that placed it - a side fields one
-- at a time, a destroyed one is gone (the relay counts them down)
ALTER TABLE town_seat_battles ADD COLUMN rams INTEGER NOT NULL DEFAULT 0 CHECK (rams >= 0);
