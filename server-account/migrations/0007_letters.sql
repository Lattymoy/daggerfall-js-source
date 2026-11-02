-- MAIL1 (2026-09-23) - LETTERS.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Addison Knox: "An in-game mail system where players can send messages
-- to offline players (e.g. notes, contracts, invitations)." A letter is
-- words from one registered player to another, kept here until its
-- READER deletes it. The shape and the bounds are src/net/letterLaw.js,
-- which the service and the client both read.
--
-- `to_id` CASCADES: a reader's letters are theirs, and go with them.
-- `from_id` does NOT reference players, and `from_name` is written at
-- sending: a letter is what was sent, by whom, as they were called then.
-- A sender who is gone later does not take their letters out of anybody
-- else's box - a letter that vanished because its writer left would be
-- a letter its reader never chose to lose.
--
-- `read_at` is NULL until the reader opens it, which is the whole of
-- "unread". Nothing else about a letter ever changes.
CREATE TABLE IF NOT EXISTS letters (
  id        TEXT PRIMARY KEY,
  to_id     TEXT NOT NULL,
  from_id   TEXT NOT NULL,
  from_name TEXT NOT NULL,
  subject   TEXT NOT NULL,
  body      TEXT NOT NULL,
  sent_at   INTEGER NOT NULL,
  read_at   INTEGER,
  FOREIGN KEY (to_id) REFERENCES players(id) ON DELETE CASCADE
);
-- A reader's box, newest first - the one query the inbox asks, and the
-- count the bound asks before every letter lands.
CREATE INDEX IF NOT EXISTS idx_letters_to ON letters (to_id, sent_at DESC);
