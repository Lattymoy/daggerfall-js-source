-- FIELD BUGS 2026-09-29b (CUSTOMS-PASS) - A DEVELOPER'S PASS THROUGH
-- CUSTOMS, ONE ACCOUNT AND ONE CHARACTER AT A TIME.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). One table; nothing else changes shape.
--
-- From the Discord, through Mac: Gryphoth made a character and played it
-- online on a build from before the realm - which the relay admitted
-- until REALM-DOOR - after the census froze (0020, 0022). The realm never
-- saw it before it began, so customs refuses it: the census law that
-- keeps a Copy to offline from coming back in (L1-F5). Mac, asked what
-- becomes of characters stranded that way: "Staff customs pass".
--
-- ONE ROW A GRANT. `granted_by` is the developer's account, `granted_at`
-- when. The pass is OPEN while `spent_at` is null; customs spends it on
-- the character it lets in (server-account/src/realm.js customsRealm, in
-- its own guarded batch) and writes that character's offline id into
-- `origin_id` - so a spent row is the record of whom a grant let in, and
-- a revoke takes back an open pass only. One open pass an account (the
-- partial unique index): a second grant is the same pass.
--
-- The account row goes, and its passes go with it (CASCADE).
CREATE TABLE IF NOT EXISTS realm_passes (
  id          INTEGER PRIMARY KEY,
  player      TEXT NOT NULL,
  granted_by  TEXT NOT NULL,
  granted_at  INTEGER NOT NULL,
  origin_id   TEXT,
  spent_at    INTEGER,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS realm_passes_open ON realm_passes (player) WHERE spent_at IS NULL;
