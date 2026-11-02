-- SEAT2b part two (c) (2026-10-01, Mac: "Finish the seats"; "Let's pick up 482") - A REVOLT IS A BATTLE
-- (bible/11-Multiplayer/Seats-Arc.md 7.7): a seat at Standing 0 revolts at its holder's next siege window - the Turning
-- places it as it places a siege (server-account/src/seatTurning.js), the holder's members sign to defend it, the relay
-- fights the rising (net/siegeRef.js revoltRising) and its result comes back on a defender's receipt
-- (server-account/src/seatSiege.js applyResult). Its row's `kind` 'revolt', its `attacker` '' (no guild rises against the
-- holder: its town does). SQLite cannot widen a CHECK in place, so the table is rebuilt whole - every column the battles
-- have gathered since 0052 (0053's field, 0061's rams, 0063's works) carried over, its index made again.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
CREATE TABLE IF NOT EXISTS town_seat_battles_new (
  week       INTEGER NOT NULL,
  key        INTEGER NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('siege', 'tourney', 'revolt')),
  tier       TEXT NOT NULL CHECK (tier IN ('palace', 'crown')),
  attacker   TEXT NOT NULL,
  defender   TEXT NOT NULL,
  starts_at  INTEGER NOT NULL,
  ends_at    INTEGER NOT NULL,
  moved      INTEGER NOT NULL DEFAULT 0 CHECK (moved IN (0, 1)),
  state      TEXT NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled', 'fought', 'forfeit', 'void')),
  at         INTEGER NOT NULL,
  field      TEXT,
  rams       INTEGER NOT NULL DEFAULT 0 CHECK (rams >= 0),
  works      TEXT,
  PRIMARY KEY (week, key)
);
INSERT INTO town_seat_battles_new (week, key, kind, tier, attacker, defender, starts_at, ends_at, moved, state, at, field, rams, works)
  SELECT week, key, kind, tier, attacker, defender, starts_at, ends_at, moved, state, at, field, rams, works FROM town_seat_battles;
DROP TABLE town_seat_battles;
ALTER TABLE town_seat_battles_new RENAME TO town_seat_battles;
CREATE INDEX IF NOT EXISTS idx_town_seat_battles_start ON town_seat_battles (starts_at);
