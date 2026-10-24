-- SEAT-FACTS (2026-10-13, the account database overloaded from 14:11 UTC; bible/11-Multiplayer/Scale-Arc.md SEAT-FACTS).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- THE SEATS' FACTS, KEPT ONCE FOR THE WHOLE SERVICE. Every isolate read every `seat` row of world_witness (15,899 on
-- the day) once a minute and counted the facts over them on every ask. The minute's clock (cron.js `seat-facts`) now
-- reads the rows once and keeps what they say here - the seats that stand, by key, state and report, and the accounts
-- ignored (townSeats.js seatFactsText) - and the isolates read this one row. One row, always id 1; `at` the clock's
-- second, so a reader knows how old it is (townSeats.js SEAT_FACTS_FRESH_S).
CREATE TABLE IF NOT EXISTS seat_facts_kept (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  at INTEGER NOT NULL,
  facts TEXT NOT NULL
);
