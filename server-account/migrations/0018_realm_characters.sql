-- REALM P1 (2026-09-28) - THE REALM'S CHARACTERS: AN ONLINE CHARACTER'S TRUTH IS THE SERVICE'S.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "A true separation while allowing people to still play offline",
-- and asked where an online character's save lives: "Account service".
-- The plan is bible/06-Systems/Realm-Arc.md, sections 1 and 2.
--
-- ONE ROW A REALM CHARACTER. Its `id` is MINTED HERE, never by a client
-- (an offline character's CHARID1 id is the client's, so it proves
-- nothing); the save itself is in R2 under the row's key
-- (src/realm.js realmKey), two objects that alternate by `seq`, so the
-- one before the last checkpoint is always kept.
--
-- THE LEASE. `lease` is the secret a playing tab holds; a join mints a
-- new one and so takes the character from any tab that held it. A
-- checkpoint lands only under the lease that is current and only at
-- `seq + 1`, so an old tab, a second device, a restored backup or an
-- edited copy can never write the character again. `lease_at` is when
-- it was taken or last renewed - for the list's "playing now", never a
-- gate.
--
-- `summary` is what the Online door's tile shows (JSON, bounded by
-- src/realm.js): the name, level, class, race - the character's own
-- client says it at each checkpoint, and nobody else reads it.
--
-- CUSTOMS. A character brought in from offline names the offline id it
-- came from (`origin_id`), once an account (the unique index): the one
-- migration decision 3 allows. Eligibility - it played online before the
-- realm, so it has a Renown track - is src/realm.js's.
--
-- The account row goes, and its characters go with it (CASCADE); their
-- objects are the prefix walk src/realm.js realmPrefix names.
CREATE TABLE IF NOT EXISTS realm_characters (
  id          TEXT PRIMARY KEY,
  player      TEXT NOT NULL,
  name        TEXT NOT NULL,
  summary     TEXT,
  seq         INTEGER NOT NULL DEFAULT 0,
  bytes       INTEGER NOT NULL DEFAULT 0,
  lease       TEXT,
  lease_at    INTEGER NOT NULL DEFAULT 0,
  origin_id   TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS realm_characters_player ON realm_characters (player, updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS realm_characters_origin ON realm_characters (player, origin_id) WHERE origin_id IS NOT NULL;
