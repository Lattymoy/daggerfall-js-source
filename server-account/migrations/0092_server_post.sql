-- SERVER-POST (2026-10-08, Mac: "Let's develop an ingame server mailbox that goes next to the hourglass in the pause
-- menu. It should show notifications whenever players have a message. First use is to utilize it for players being
-- granted items."): THE SERVER'S POST - a message from the developers to one account, with at most one item in it.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). Deploy this service with
-- the site (the pause menu's mailbox reads /v1/post/*).
--
-- NOT A LETTER (0007_letters.sql): a letter is a player's, written to a player, and carries words alone. A piece of the
-- server's post is the developers', written by the operator's workflow (.github/workflows/server-post.yml - nothing a
-- player can send writes here), and it may carry ONE ITEM, which its reader claims into the online character they are
-- playing (server-account/src/post.js claimPost, the guild vault's take: the record written by the service, the row's
-- claim in the same batch).
--
--   id          the piece's own id (accounts.js mintId's shape)
--   to_id       the account it is for; CASCADE: an account that is gone takes its post with it
--   batch       the operator's name for the send ('hours-first-hourlock') - ONE piece a batch an account, so the
--               workflow run twice sends once (INSERT OR IGNORE over the unique index below)
--   sender      who it is from, as the box shows it ('The Developers')
--   subject, body  its words (src/net/postLaw.js bounds them)
--   item        an item record as the game keeps one (JSON), or NULL for a message alone
--   sent_at, read_at   when it was sent, and first opened (NULL: unread - the mailbox's count)
--   claimed_at, claimed_by  when its item was taken, and into which realm character; NULL: not yet
CREATE TABLE IF NOT EXISTS server_post (
  id         TEXT PRIMARY KEY,
  to_id      TEXT NOT NULL,
  batch      TEXT NOT NULL,
  sender     TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  item       TEXT,
  sent_at    INTEGER NOT NULL,
  read_at    INTEGER,
  claimed_at INTEGER,
  claimed_by TEXT,
  FOREIGN KEY (to_id) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_server_post_to ON server_post (to_id, sent_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_server_post_batch ON server_post (to_id, batch);
