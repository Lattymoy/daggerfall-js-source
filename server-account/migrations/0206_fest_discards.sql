-- BOUND-DESTROY (2026-10-31, FIELD FEEDBACK 2026-10-31: "Soulbound items need to be disposable, certain aetheric sets and
-- hearth offerings.") - an account's Soul Cakes or Hearth Offerings let go (server-account/src/festival.js discardFestival).
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
-- A LET-GO, by the request id the client minted: asked twice, it is one, and the count goes down once. `kind` is 'cakes'
-- or 'bowls', `n` how many. Additive: no column of 0140's moves.
CREATE TABLE IF NOT EXISTS fest_discards (
  account TEXT NOT NULL,
  rid     TEXT NOT NULL,
  kind    TEXT NOT NULL,
  n       INTEGER NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (account, rid),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
