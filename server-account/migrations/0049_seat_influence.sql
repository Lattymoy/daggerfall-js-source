-- SEAT1b (2026-09-30, Mac: "Finish the seats") - INFLUENCE: THE PLEDGE AND THE WEEK'S SOURCES
-- (bible/11-Multiplayer/Seats-Arc.md 4.1-4.2; src/net/townSeatLaw.js, server-account/src/seatInfluence.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- THE PLEDGE (SEAT0 4.1): a guild's one seat a region for a seat week, in at most five regions (the INSERT counts them).
-- `set_by` the name of whoever set it (an Officer or the guildmaster), as the board says it.
CREATE TABLE IF NOT EXISTS town_seat_pledges (
  week      INTEGER NOT NULL,
  guild_id  TEXT NOT NULL,
  region    INTEGER NOT NULL,
  key       INTEGER NOT NULL,
  set_by    TEXT NOT NULL,
  at        INTEGER NOT NULL,
  PRIMARY KEY (week, guild_id, region),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_town_seat_pledges_key ON town_seat_pledges (week, key);

-- PER-ACCOUNT WAR (SEAT0 4.2, Mac: "Yes"): the first guild an account's character contributes to in a week is that
-- account's guild for the week's seats. One row an account a week; its other characters earn nothing for any other
-- guild that week. Kept when the guild goes (the week's war stays fought).
CREATE TABLE IF NOT EXISTS town_seat_binds (
  week      INTEGER NOT NULL,
  account   TEXT NOT NULL,
  guild_id  TEXT NOT NULL,
  char_id   TEXT NOT NULL,
  at        INTEGER NOT NULL,
  PRIMARY KEY (week, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);

-- THE WEEK'S SOURCES, one row an event (SEAT0 12: "summed on read, capped on write"): a Watch tick (`watch`, its
-- receipt's account, nonce and issue the ref - never counted twice), a gate kill (`gate`, the game day and the account the
-- ref, the region its claim named - counted only where three of that day's claims agree), Tribute (`tribute`, the Marks
-- burnt, the request id the ref); and SEAT1c's deliveries to the stockpile (`writ`, the own units' value; `bought`, bought
-- units' value at Tribute's rate), admitted now so the table is never rebuilt for them. Each row names the seat, the
-- guild, the account and the character it counts for.
CREATE TABLE IF NOT EXISTS town_seat_influence (
  id        INTEGER PRIMARY KEY,
  week      INTEGER NOT NULL,
  key       INTEGER NOT NULL,
  guild_id  TEXT NOT NULL,
  account   TEXT NOT NULL,
  char_id   TEXT NOT NULL,
  source    TEXT NOT NULL CHECK (source IN ('watch', 'gate', 'writ', 'bought', 'tribute')),
  amount    INTEGER NOT NULL CHECK (amount >= 0),
  region    INTEGER,
  day       INTEGER,
  ref       TEXT NOT NULL,
  at        INTEGER NOT NULL,
  UNIQUE (source, ref)
);
CREATE INDEX IF NOT EXISTS idx_town_seat_influence_seat ON town_seat_influence (week, key, guild_id);
CREATE INDEX IF NOT EXISTS idx_town_seat_influence_account ON town_seat_influence (account, source, day);

-- RENOWN IN THE REGION (SEAT0 12: "the Renown report gains `region`; renown_region_week"): the XP an account's
-- character was credited in a region in a seat week - 1 influence per 20, at most 400 an account a week, read at its
-- guild's pledged seat in that region.
CREATE TABLE IF NOT EXISTS town_seat_renown (
  week      INTEGER NOT NULL,
  account   TEXT NOT NULL,
  char_id   TEXT NOT NULL,
  region    INTEGER NOT NULL,
  xp        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (week, account, char_id, region),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);

-- THE GATE'S REGION (SEAT0 4.2: "the service takes the day's region from the claims themselves: the region at least 3 of
-- that day's receipts agree on"): the region the claiming client derived for the kill's game day (src/systems/gateSite.js
-- findGateSite), null for a claim that named none (a client from before, or one whose scan had not finished).
ALTER TABLE gate_kills ADD COLUMN region INTEGER;
CREATE INDEX IF NOT EXISTS idx_gate_kills_region ON gate_kills (day, region);
