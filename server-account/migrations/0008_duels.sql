-- DUEL1 (2026-09-24) - THE DUELLING RECORD.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "Add a dueling K/D to the profile menu and player inspect
-- profile", kept PER ACCOUNT. One row a finished duel that named a
-- loser, written by the LOSER's own signed-in client naming the winner
-- by the account the relay verified (net/wire.js DUEL1): nobody credits
-- themselves a win, and a client can only ever add a loss to its own
-- account.
--
-- THERE ARE NO COUNTER COLUMNS. A player's wins are the rows that name
-- them the winner and their losses the rows that name them the loser,
-- so the ONE write a result is - this INSERT - is the whole of it, and
-- no pair of counters can drift apart when a request dies between two
-- statements.
--
-- Both ends CASCADE: a result is about two accounts, and an account that
-- is gone takes its duels with it.
CREATE TABLE IF NOT EXISTS duel_results (
  loser  TEXT NOT NULL,
  winner TEXT NOT NULL,
  at     INTEGER NOT NULL,
  FOREIGN KEY (loser) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (winner) REFERENCES players(id) ON DELETE CASCADE
);
-- A loser's results, newest last - the gap and the pair bound read it
-- before every result lands, and the losses count it.
CREATE INDEX IF NOT EXISTS idx_duel_loser ON duel_results (loser, at);
-- The wins count.
CREATE INDEX IF NOT EXISTS idx_duel_winner ON duel_results (winner);
