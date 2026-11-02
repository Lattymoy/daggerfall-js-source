-- FOUNDER5 (2026-10-07) - THE FOUNDER LINK, ASKED BY CHARACTER.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "I want to do this without my input". FOUNDER4's link (0078) was
-- written once; server-account/src/founderLink.js now writes it as a
-- character arrives on an account - a cloud save's new slot, a customs -
-- asking which OTHER rows hold that character. The census is already
-- asked by character (0043's idx_realm_census_char); these two let the
-- saves and the realm characters be asked the same way, rather than read
-- whole. Both tables are written rarely (a backup a player presses, a
-- customs), so the indexes cost nothing on a hot path. realm_passes is a
-- handful of rows a developer grants and needs none.

CREATE INDEX IF NOT EXISTS idx_saves_character ON saves (character_id);
CREATE INDEX IF NOT EXISTS idx_realm_characters_origin ON realm_characters (origin_id) WHERE origin_id IS NOT NULL;
