-- ACCOUNT-HOMES (2026-10-06, asked: "Deleted characters should remove their houses from online", beside "House
-- ownership should be account bound, not character bound") - THE HOMES OF REALM CHARACTERS THAT ARE GONE, RELEASED.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct89) BEFORE the site;
-- no relay change. Rows only: no table changes shape.
--
-- A home is its ACCOUNT's now (server-account/src/homes.js), and `char_id`
-- the realm character that bought it - whose delete takes it in its own
-- batch (realm.js deleteRealm, AUDIT REALM L1-F7). A home whose buyer is a
-- realm id no realm character stands on any more is one a delete never
-- reached: a building held for nobody, its door shut on everyone, which
-- account ownership would otherwise hand back to its account. Asked, a
-- deleted character's houses go - so they go here, once: the building
-- stands free for anyone to buy, and its placed pieces, its hidden
-- furniture and its rooms go with it (the tables' own cascade, as a
-- delete's do).
--
-- What stays: a TOMBSTONE's homes (a Bloodline's fallen, an Enduring
-- elder retired - `dead_at` - is no delete: its row stands, and its homes
-- are its account's, its heir's among them); a guild's hall (its row
-- carries its guild's mark, `guild:<id>`, never a realm id); and a home
-- under an offline id from before the realm (its character stands offline
-- and may still come in through customs - Realm-Arc's Left open, which
-- its account now holds again).
DELETE FROM homes
  WHERE guild_id IS NULL
    AND length(char_id) = 21 AND substr(char_id, 1, 1) = 'r' AND substr(char_id, 2) NOT GLOB '*[^0-9a-f]*'
    AND NOT EXISTS (SELECT 1 FROM realm_characters r WHERE r.id = homes.char_id);
