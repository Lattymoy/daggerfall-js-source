-- LEGACY7 (2026-10-06; 0083 on its branch, renumbered past SERPENT-SET's 0083_serpent_embers at its merge of main) - PROJECT LEGACY ONLINE: THE SERVICE HOLDS THE LINE.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct85) BEFORE the site:
-- the new site founds an online house at the service and tombstones a
-- Bloodline's fallen there.
--
-- Mac: "online integration with permadeath (Bloodline) or non-permadeath
-- (Enduring)". bible/06-Systems/Legacy-Arc.md section 9. Online a
-- device's storage is no authority - a second device, a cleared browser
-- or an older save would play past a death. So:
--
--   lineages        one row a family an account founded online: its id
--                   (the family's own, `fam-...`), the surname and model
--                   as the founder chose them, the family's record (the
--                   client's JSON, bounded - legacy.js LINEAGE_MAX_BYTES)
--                   and its `rev`. A write lands only past the stored rev;
--                   a stale one is answered with the stored record, which
--                   the client merges its facts into and writes again.
--   realm_characters.lineage_id, person_id
--                   the family and the person a realm character plays -
--                   named at its birth (/v1/realm/create), never after,
--                   and never a person another realm character already
--                   played.
--   realm_characters.dead_at
--                   THE TOMBSTONE (/v1/realm/die): a Bloodline death, or
--                   an Enduring line's last. From then the character is
--                   never joined, checkpointed or traded again - an older
--                   save cannot be reloaded past a death, which is the
--                   whole of permadeath's authority - and it holds no
--                   roster slot (REALM_CHARACTERS_MAX counts the living).
CREATE TABLE IF NOT EXISTS lineages (
  player     TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  surname    TEXT    NOT NULL,
  model      TEXT    NOT NULL,
  record     TEXT    NOT NULL,
  rev        INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (player, id)
);

ALTER TABLE realm_characters ADD COLUMN lineage_id TEXT;
ALTER TABLE realm_characters ADD COLUMN person_id INTEGER;
ALTER TABLE realm_characters ADD COLUMN dead_at INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS realm_characters_person ON realm_characters (player, lineage_id, person_id) WHERE lineage_id IS NOT NULL;

-- LEGACY7 part three: TWO PLAYERS WED. A union is made only when both
-- halves of one wedding (`sid`, the two clients' handshake) are here -
-- each a realm character of a line, alive, under its playing lease, wed
-- to nobody - and it ends with either's death or delete (`ended_why`
-- 'died' or 'gone', `ended_by` whose); an elder's retirement keeps it
-- (they live on, wed).
-- Each side's CARD (`a_card`, `b_card`: the realm name, the house, the
-- person's sex, race and face off their own line) is kept as it stood at
-- the wedding - what the other's house records of them, even after a
-- delete. A half older than legacy.js WED_HALF_LIFE_S is nobody's word
-- any more.
CREATE TABLE IF NOT EXISTS realm_wed_halves (
  sid     TEXT    NOT NULL,
  player  TEXT    NOT NULL,
  char_id TEXT    NOT NULL,
  partner TEXT    NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (sid, player)
);
CREATE TABLE IF NOT EXISTS realm_unions (
  sid       TEXT    PRIMARY KEY,
  a_player  TEXT    NOT NULL,
  a_char    TEXT    NOT NULL,
  b_player  TEXT    NOT NULL,
  b_char    TEXT    NOT NULL,
  a_card    TEXT    NOT NULL,
  b_card    TEXT    NOT NULL,
  wed_at    INTEGER NOT NULL,
  ended_at  INTEGER,
  ended_why TEXT,
  ended_by  TEXT
);
CREATE INDEX IF NOT EXISTS realm_unions_a ON realm_unions (a_char);
CREATE INDEX IF NOT EXISTS realm_unions_b ON realm_unions (b_char);
