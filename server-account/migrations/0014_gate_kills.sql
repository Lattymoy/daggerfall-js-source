-- WB5b (2026-09-25) - THE GATES CLOSED.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "a gate of oblivion which takes place in a large boss arena with
-- an oversized enemy" - and Option B: the relay's object is the
-- authority over the boss, stamps the kill and signs a receipt for each
-- account that earned it (src/net/gateReceipt.js, the relay's
-- GATE_SIGNING_KEY). The account the receipt names carries it here,
-- this service verifies it with the relay's public half
-- (GATE_PUBLIC_KEY), and it is counted.
--
-- ONE ROW A GATE A PLAYER CLOSED, and the primary key is (day, account):
-- a receipt counts once whatever happens to it - claimed twice, from two
-- devices, after a crash, a week later. There is no counter column, for
-- DUEL1's reason: the one INSERT a claim is, is the whole of it.
--
-- CASCADE: an account that is gone takes its gates with it.
CREATE TABLE IF NOT EXISTS gate_kills (
  day     INTEGER NOT NULL,
  account TEXT NOT NULL,
  boss    TEXT NOT NULL,
  earned  TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (day, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
-- An account's gates, for the count the cards say.
CREATE INDEX IF NOT EXISTS idx_gate_account ON gate_kills (account);
