-- PATREON-LINK (2026-10-01) - A PATRON'S TITLE FOLLOWS THEIR PLEDGE.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). SQLite has no ADD COLUMN IF NOT EXISTS, so a
-- second run errors harmlessly and the ledger is what stops it.
--
-- Mac: "With patron and having to manually hand out titles. Im running
-- into a workflow where its really hard to keep up with it." TITLE-N's
-- Patreon tiers were handle lists in wrangler.toml - a deploy per patron,
-- and another per lapse. A player now links their own Patreon from the
-- account card (server-account/src/patreon.js says how, and why it asks
-- before it links).
--
-- ═══ PATREON'S WORD IS STORED; THE TITLE IS STILL DERIVED ══════════
--
-- What a player HOLDS stays ACC3's: read at every ask, never a column
-- that grants. What is stored is the one thing this service cannot
-- derive - what Patreon last said about the player's membership:
--
--   patreon_user    the Patreon user this account linked (their id, a
--                   run of digits). UNIQUE below: one pledge dresses one
--                   account, and linking it elsewhere moves it.
--   patreon_tiers   the tier ids Patreon says the member is entitled to
--                   now, comma-joined ('' for none).
--   patreon_status  Patreon's `patron_status` - `active_patron` is the
--                   only one that holds anything.
--   patreon_at      when Patreon last said so (the link, or a webhook).
--
-- titles.js reads the tiers against PATREON_TIERS (the config's map of a
-- tier id to its title) at every ask, so a tier remapped in the config
-- moves every patron on their next token, and nothing is walked.
-- Null on every row until its player links: nobody holds a title by it.
ALTER TABLE players ADD COLUMN patreon_user TEXT;
ALTER TABLE players ADD COLUMN patreon_tiers TEXT;
ALTER TABLE players ADD COLUMN patreon_status TEXT;
ALTER TABLE players ADD COLUMN patreon_at INTEGER;

-- The webhook finds its account by the Patreon user, and a link refuses a
-- second holder by it - one index does both.
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_patreon_user
  ON players (patreon_user) WHERE patreon_user IS NOT NULL;
