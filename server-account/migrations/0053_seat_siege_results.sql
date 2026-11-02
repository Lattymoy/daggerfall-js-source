-- SEAT2a part three (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue") - WHAT A
-- BATTLE GAVE: the field its fighters' games agreed, its result off the relay's receipt, the Turning's memory of it, and
-- each fighter's Honours (bible/11-Multiplayer/Seats-Arc.md 6.2, 6.5-6.8; src/net/townSeatLaw.js,
-- server-account/src/seatSiege.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- THE FIELD (6.2): the banners' points, the Throne's and the camps', as each signed fighter's game derived them from the
-- town (`field` the pass's `sf` as JSON) - one row an account a battle - and the one settled for the battle (on its row:
-- the first an attacker and a defender agree, else once it is joined the most submitted). Every pass carries it.
CREATE TABLE IF NOT EXISTS town_seat_fields (
  week       INTEGER NOT NULL,
  key        INTEGER NOT NULL,
  account    TEXT NOT NULL,
  side       TEXT NOT NULL CHECK (side IN ('attack', 'defend')),
  field      TEXT NOT NULL,
  at         INTEGER NOT NULL,
  PRIMARY KEY (week, key, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
ALTER TABLE town_seat_battles ADD COLUMN field TEXT;

-- THE RESULT (6.5-6.8): off the first fighter's `s1` receipt to reach the service - once a battle. `rid` the request that
-- wrote it, which every effect of it asks for (one statement decides). `raised` 1 when the attackers raised a banner.
CREATE TABLE IF NOT EXISTS town_seat_results (
  week       INTEGER NOT NULL,
  key        INTEGER NOT NULL,
  result     TEXT NOT NULL CHECK (result IN ('attack', 'defend', 'tie', 'forfeit', 'absent')),
  raised     INTEGER NOT NULL DEFAULT 0 CHECK (raised IN (0, 1)),
  winner     TEXT,
  rid        TEXT NOT NULL,
  at         INTEGER NOT NULL,
  PRIMARY KEY (week, key)
);

-- THE TURNING'S MEMORY (6.5, 6.8): what the Turning settling `week` (the week the battle was fought) reads - the holder
-- defends at x1.2 (`bonus`), and the challenger may not challenge the seat (`barred`).
CREATE TABLE IF NOT EXISTS town_seat_aftermath (
  week       INTEGER NOT NULL,
  key        INTEGER NOT NULL,
  guild_id   TEXT NOT NULL,
  what       TEXT NOT NULL CHECK (what IN ('bonus', 'barred')),
  PRIMARY KEY (week, key, guild_id, what)
);

-- HONOURS (6.8): a fighter's claim, once a battle an account - its side, the character whose Renown took the XP, what it
-- was given (0 where the pair's Honours were spent this Season), and its roll on the Spoils.
CREATE TABLE IF NOT EXISTS town_seat_honours (
  week       INTEGER NOT NULL,
  key        INTEGER NOT NULL,
  account    TEXT NOT NULL,
  side       TEXT NOT NULL CHECK (side IN ('attack', 'defend')),
  char_id    TEXT NOT NULL,
  marks      INTEGER NOT NULL DEFAULT 0 CHECK (marks >= 0),
  xp         INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  spoil      TEXT,
  rid        TEXT NOT NULL,
  at         INTEGER NOT NULL,
  PRIMARY KEY (week, key, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
