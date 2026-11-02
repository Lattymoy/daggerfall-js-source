-- PRIVATE-REPORT (2026-10-17, Mac: "Can we add a private disclosure method for exploits/bugs with the client"): A
-- PLAYER'S PRIVATE REPORT - an exploit, a bug, a hole in the accounts or the servers - read by the people
-- REPORT_READER_HANDLES names (wrangler.toml) and nobody else (server-account/src/reports.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). Deploy this service with
-- the site (the mailbox's report form sends to /v1/report/*).
--
-- NOT A LETTER (0007_letters.sql) and NOT THE SERVER'S POST (0093_server_post.sql): a letter is one player's to another,
-- a piece of the post the developers' to one player. A report is one player's to the readers, and only they list it.
--
--   id         the report's own id (accounts.js mintId's shape)
--   from_id    who sent it; CASCADE: an account that is gone takes its reports with it, as it takes its letters
--   rid        the send's own id, the client's - one report a send, so a lost answer asked again is answered the same
--              report (UNIQUE (from_id, rid) below)
--   kind       'exploit', 'bug' or 'security' (src/net/reportLaw.js REPORT_KINDS)
--   subject, body  its words (reportLaw.js bounds them, and so does the table)
--   context    the build it was sent from and where it ran (reportLaw.js reportContextOf), JSON, or NULL
--   sent_at    when it was sent
--   read_at, read_by     when a reader first opened it, and which (NULL: unread - the reader's count)
--   state      'open', or how a reader closed it: 'fixed', 'wontfix', 'duplicate' (reportLaw.js REPORT_STATES)
--   closed_at, closed_by when and by whom it was closed; NULL while open
CREATE TABLE IF NOT EXISTS private_reports (
  id        TEXT PRIMARY KEY,
  from_id   TEXT NOT NULL,
  rid       TEXT NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('exploit', 'bug', 'security')),
  subject   TEXT NOT NULL CHECK (length(subject) BETWEEN 3 AND 80),
  body      TEXT NOT NULL CHECK (length(body) BETWEEN 10 AND 3000),
  context   TEXT CHECK (context IS NULL OR (json_valid(context) AND length(context) <= 400)),
  sent_at   INTEGER NOT NULL,
  read_at   INTEGER,
  read_by   TEXT,
  state     TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'fixed', 'wontfix', 'duplicate')),
  closed_at INTEGER,
  closed_by TEXT,
  FOREIGN KEY (from_id) REFERENCES players(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_private_reports_rid ON private_reports (from_id, rid);
CREATE INDEX IF NOT EXISTS idx_private_reports_from ON private_reports (from_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_private_reports_state ON private_reports (state, sent_at DESC);
