-- CARDS6 (2026-10-08) - A CARD TABLE'S STAKES, ESCROWED BY THE SERVICE.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- bible/11-Multiplayer/Tavern-Cards.md section 23. A realm character's
-- buy-in at a relay's gold table leaves its record and is HELD here
-- (server-account/src/cards.js stakeCards); the relay's cash-out receipt
-- for it pays the record and turns it PAID, once (cashoutCards). `rid` is
-- the client's request id - a stake asked twice is one stake. `region` the
-- one it was staked from: its cash-out goes home there (AUDIT CARDS-4 A7).

CREATE TABLE IF NOT EXISTS card_stakes (
  id TEXT PRIMARY KEY,
  player TEXT NOT NULL,
  char_id TEXT NOT NULL,
  rid TEXT NOT NULL,
  room TEXT NOT NULL,
  tbl INTEGER NOT NULL,
  bb INTEGER NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('held', 'paid')),
  paid INTEGER,
  at INTEGER NOT NULL,
  paid_at INTEGER,
  region INTEGER NOT NULL DEFAULT 0,
  UNIQUE (player, rid)
);
CREATE INDEX IF NOT EXISTS idx_card_stakes_player ON card_stakes (player, status);
