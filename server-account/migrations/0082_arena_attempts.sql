-- AUDIT ARENA-LADDER (2026-10-05) - A LADDER ATTEMPT IS A TICKET, AND A LOSS BREAKS THE TIER'S RUN.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct82) BEFORE the relay
-- (world169) and the site: the new relay opens a ladder bout only for a
-- ticket this service mints.
--
-- The owner, asked what a lost ladder bout should cost: "Lose the tier's
-- run" - back to the tier's first bout, three to win again before its
-- champion. Online the climb is counted from arena_pve's won rows
-- (src/net/arenaLaw.js arenaLadderOf), and a loss was a receipt the
-- device carried - a device that never carried it kept every step. So:
--
--   arena_attempts  one row an attempt at a ladder bout, minted by
--                   /v1/arena/attempt for the account's next bout (its
--                   id the ticket, 16 hex). The relay opens a ladder bout
--                   only for one and signs it into the receipt (`z`),
--                   asked for ONE room (`room`, the receipt's bout id)
--                   and good for a receipt signed within ARENA_ATTEMPT_LIFE_S;
--                   arena_pve's row is keyed by it (a ladder bout's room
--                   id is no longer the row's key - another account could
--                   reopen that room and take the row, AUDIT ARENA-LADDER
--                   O3). A new attempt FORFEITS every one still open: its
--                   loss row is written then, carried or not.
--   arena_pve.voided  a won row a loss broke the run of: kept (the record
--                   counts it), out of the climb. One win a step stands
--                   among the rows not voided.
CREATE TABLE IF NOT EXISTS arena_attempts (
  id      TEXT PRIMARY KEY,                 -- the ticket (16 hex)
  player  TEXT NOT NULL,
  tier    INTEGER NOT NULL CHECK (tier BETWEEN 0 AND 9),
  step    INTEGER NOT NULL CHECK (step BETWEEN 0 AND 3),
  room    TEXT NOT NULL,                    -- the bout's room id (16 hex) it was asked for: the receipt's `j` must be it
  at      INTEGER NOT NULL,
  done    INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),   -- 1 once claimed or forfeited
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_arena_attempts_open ON arena_attempts (player, done);
-- one ticket a room: a second attempt asked for a room already ticketed is refused
CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_attempts_room ON arena_attempts (room);

ALTER TABLE arena_pve ADD COLUMN voided INTEGER NOT NULL DEFAULT 0 CHECK (voided IN (0, 1));
-- one WIN a step among the rows of the climb (a voided win is a run a loss broke)
DROP INDEX IF EXISTS idx_arena_pve_step;
CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_pve_step ON arena_pve (player, tier, step) WHERE won = 1 AND voided = 0;
