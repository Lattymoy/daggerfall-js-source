-- SEAT2a (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue") - THE BATTLES' WEEK:
-- the holder's window, the Turning's schedule, the two sides' rosters and their Sellswords (bible/11-Multiplayer/
-- Seats-Arc.md 6.3-6.5; src/net/townSeatLaw.js, server-account/src/seatBattles.js, server-account/src/seatTurning.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- THE HOLDER'S WINDOW (6.3): a day Wednesday to Saturday (0-3) and a start hour (16-23, 0-2), set by the holder's
-- Guildmaster or an Officer (`set_by` the name they went by). The window in force at the Turning is the one its battle
-- keeps - the Turning freezes it into the battle's row; a holder with none gets Wednesday 20:00.
CREATE TABLE IF NOT EXISTS town_seat_windows (
  key        INTEGER PRIMARY KEY,
  guild_id   TEXT NOT NULL,
  day        INTEGER NOT NULL CHECK (day >= 0 AND day <= 3),
  hour       INTEGER NOT NULL CHECK ((hour >= 16 AND hour <= 23) OR (hour >= 0 AND hour <= 2)),
  set_by     TEXT NOT NULL,
  at         INTEGER NOT NULL,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- THE WEEK'S BATTLES (5.2 step 8): one a seat a week, written by the Turning that named it (`week` the week it is
-- fought), placed so no guild fights twice at once (`moved` when it is not at its own start). `starts_at`/`ends_at` in
-- epoch seconds. `state` 'scheduled' until SEAT2a's relay half reports it.
CREATE TABLE IF NOT EXISTS town_seat_battles (
  week       INTEGER NOT NULL,
  key        INTEGER NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('siege', 'tourney')),
  tier       TEXT NOT NULL CHECK (tier IN ('palace', 'crown')),
  attacker   TEXT NOT NULL,
  defender   TEXT NOT NULL,
  starts_at  INTEGER NOT NULL,
  ends_at    INTEGER NOT NULL,
  moved      INTEGER NOT NULL DEFAULT 0 CHECK (moved IN (0, 1)),
  state      TEXT NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled', 'fought', 'forfeit', 'void')),
  at         INTEGER NOT NULL,
  PRIMARY KEY (week, key)
);
CREATE INDEX IF NOT EXISTS idx_town_seat_battles_start ON town_seat_battles (starts_at);

-- THE ROSTERS (6.4): a side's signed fighters - one row an account a battle (`guild_id` the side's guild, `side`
-- 'attack' or 'defend', `char_id` the character that signed, `sellsword` 1 for a hired one and its `fee` in Marks).
CREATE TABLE IF NOT EXISTS town_seat_rosters (
  week       INTEGER NOT NULL,
  key        INTEGER NOT NULL,
  account    TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  guild_id   TEXT NOT NULL,
  side       TEXT NOT NULL CHECK (side IN ('attack', 'defend')),
  sellsword  INTEGER NOT NULL DEFAULT 0 CHECK (sellsword IN (0, 1)),
  fee        INTEGER NOT NULL DEFAULT 0 CHECK (fee >= 0),
  at         INTEGER NOT NULL,
  PRIMARY KEY (week, key, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_town_seat_rosters_guild ON town_seat_rosters (guild_id, week);

-- THE SELLSWORDS' CONTRACTS (6.4): a side's Guildmaster names an account (`account`) at a fee in Marks, escrowed from
-- the guild's treasury at the hire; the hired account signs under it (`state` 'signed') or the Guildmaster withdraws it
-- before then ('withdrawn' - the escrow goes home). The fee is paid at the battle's end (SEAT2a's relay half).
CREATE TABLE IF NOT EXISTS town_seat_hires (
  week       INTEGER NOT NULL,
  key        INTEGER NOT NULL,
  account    TEXT NOT NULL,
  guild_id   TEXT NOT NULL,
  fee        INTEGER NOT NULL DEFAULT 0 CHECK (fee >= 0 AND fee <= 5000),
  state      TEXT NOT NULL DEFAULT 'offered' CHECK (state IN ('offered', 'signed', 'withdrawn')),
  by_name    TEXT NOT NULL,
  at         INTEGER NOT NULL,
  PRIMARY KEY (week, key, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
