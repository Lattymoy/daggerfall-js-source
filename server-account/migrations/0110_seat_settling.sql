-- SEAT-LEASE (2026-10-11, from play: the account service swamped an hour after seat week 2's Turning - "The server is
-- expericing a bad load right now").
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- THE TURNING'S ONE SETTLER. Every seat route settled the Turnings due before it answered, so while a week was due
-- every request ran the whole settle at once - hundreds of reads each. Under load a settle outlasted its client's wait,
-- the request was cancelled before its batch committed, and the next request began another: the week never settled
-- and the database drowned. One row now says who is settling and until when (seatTurning.js settleDueOnce): the request
-- or the clock's minute that takes it settles; every other answers at once from the state as it stands, and a lease
-- whose settler was cut off runs out on its own.
CREATE TABLE IF NOT EXISTS town_seat_settling (
  id      INTEGER PRIMARY KEY CHECK (id = 1),
  holder  TEXT NOT NULL,
  until   INTEGER NOT NULL
);
