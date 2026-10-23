-- QL12 (2026-10-19, the owner: "New questlines tying into and introduced the oblivion gates, abyss dungeons, elite
-- dungeons and elite breaches") - THE QUESTLINES, AS THE SERVICE KEEPS THEM.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). Deploy this service
-- (acct159) after the relay that knows the questlines' five titles (world224) - THE RELAY FIRST, as WIKIMAID's.
--
-- bible/06-Systems/Questlines-Arc.md sections 1 (decision 8) and 5.3. The law both ends share is
-- src/net/questlineClaims.js (QL_SERVICE_LINES - which steps are witnessed and by what, the title a line pays, the
-- Covens' Hoard's key); the service server-account/src/questlines.js claimQl, at `POST /v1/ql/claim`.
--
-- THE SERVICE PAYS ONLY WHAT IT WITNESSED. A step the service pays is claimed twice by the account's client: its `open`
-- writes its row here (`opened_at`, the service's clock), and its `end` finds the step's witness - the endgame place's
-- own receipt row (gate_kills, eg_redoubts, sd_kills, serpent_kills) claimed at or after the LINE's first `opened_at`,
-- newer than the receipt that witnessed an earlier step of the line (`seen_at`, that receipt's second: one receipt, one
-- step) - and marks it done (`done_at`, with the outcome's `choice` where the claim carries one). One row an (account,
-- line, step): an opening asked twice opens once.
--
-- CASCADE: an account that is gone takes its questlines with it.
CREATE TABLE IF NOT EXISTS ql_steps (
  account   TEXT NOT NULL,
  line      TEXT NOT NULL,
  step      INTEGER NOT NULL,
  opened_at INTEGER NOT NULL,
  done_at   INTEGER,
  seen_at   INTEGER,
  choice    TEXT,
  PRIMARY KEY (account, line, step),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
-- WHAT A QUESTLINE PAID THE ACCOUNT, held for good:
--   ql_titles  a bit a line's title (questlineClaims.js qlTitleBit - its place in QL_TITLES), OR'ed on the claim of the
--              line's `titleAt` step witnessed, every witnessed step before it done; read off the row by titles.js
--              titlesHeld as Hourbreaker is off `sd_honours`
--   ql_key     1 once the Covens' Hoard has paid its Weir Key (`eg_keys` + 1 in the same statement) - once an account
ALTER TABLE players ADD COLUMN ql_titles INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN ql_key INTEGER NOT NULL DEFAULT 0;
