-- HANDLE-RENAME (2026-10-19, 0133 on its branch, renumbered past 0133_questlines at the merge; Mac: "Change the name PROSTITUTE_STRANGLER to SanguinePanguine. This is an account. Not sure
-- how the filter didnt catch this"). The name filter (src/net/nameFilter.js) lists neither word, so the handle was
-- issued; there is no route that renames a player, so the account is renamed here.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). No Worker moves with it.
--
-- The handle is how the player signs in (accounts.js login: `handle_lc`), so the account signs in as SanguinePanguine
-- from here, its password and recovery codes unchanged. The displayed name is derived from the handle (accounts.js
-- displayName), and every row that keeps it "as it was" - a letter's sender, a note's author, a guild's roster and
-- ledgers, a home's owner, a seat's orders, a document's author - is written the new name, matched on the old one
-- exactly (case aside): a handle is unique, so no other account wrote it, and a column holding an id never equals it.
-- The moderation record (mod_case_lines, mod_actions, mod_cases, private_reports, players.muted_by) keeps what was
-- said and done as it was. A character's name is the character's, in its save, and is not touched.
--
-- Where SanguinePanguine is already another account's handle, nothing is written (the unique handle_lc index would
-- refuse the rename, and a snapshot renamed without it would name the other account).
CREATE TABLE handle_rename (id TEXT PRIMARY KEY);
INSERT INTO handle_rename (id)
  SELECT id FROM players WHERE handle_lc = 'prostitute_strangler'
    AND NOT EXISTS (SELECT 1 FROM players WHERE handle_lc = 'sanguinepanguine');

UPDATE players SET handle = 'SanguinePanguine', handle_lc = 'sanguinepanguine' WHERE id IN (SELECT id FROM handle_rename);

UPDATE letters SET from_name = 'SanguinePanguine' WHERE lower(from_name) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE renown_tracks SET name = 'SanguinePanguine' WHERE lower(name) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE homes SET owner_name = 'SanguinePanguine' WHERE lower(owner_name) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE home_rooms SET tenant_name = 'SanguinePanguine' WHERE lower(tenant_name) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE board_notes SET author_name = 'SanguinePanguine' WHERE lower(author_name) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE board_notices SET author_name = 'SanguinePanguine' WHERE lower(author_name) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE guilds SET moved_by = 'SanguinePanguine' WHERE lower(moved_by) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE guild_members SET name = 'SanguinePanguine' WHERE lower(name) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE guild_invites SET by_name = 'SanguinePanguine' WHERE lower(by_name) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE guild_ledger SET who = 'SanguinePanguine' WHERE lower(who) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE guild_notes SET author_name = 'SanguinePanguine' WHERE lower(author_name) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE guild_renames SET who = 'SanguinePanguine' WHERE lower(who) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE guild_vault SET dep_name = 'SanguinePanguine' WHERE lower(dep_name) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE guild_vault_log SET who = 'SanguinePanguine' WHERE lower(who) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE guild_writs SET closed_by = 'SanguinePanguine' WHERE lower(closed_by) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE guild_writ_budgets SET set_by = 'SanguinePanguine' WHERE lower(set_by) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE guild_prof_stores SET moved_by = 'SanguinePanguine' WHERE lower(moved_by) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE guild_store_ledger SET who = 'SanguinePanguine' WHERE lower(who) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE guild_contracts SET closed_by = 'SanguinePanguine' WHERE lower(closed_by) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE guild_fealty SET offered_by = 'SanguinePanguine' WHERE lower(offered_by) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE guild_fealty SET broken_by = 'SanguinePanguine' WHERE lower(broken_by) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE guild_pacts SET offered_by = 'SanguinePanguine' WHERE lower(offered_by) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE marks_ledger SET who = 'SanguinePanguine' WHERE lower(who) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE town_seat_pledges SET set_by = 'SanguinePanguine' WHERE lower(set_by) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE town_seat_windows SET set_by = 'SanguinePanguine' WHERE lower(set_by) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE town_seat_hires SET by_name = 'SanguinePanguine' WHERE lower(by_name) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE town_seat_edicts SET set_by = 'SanguinePanguine' WHERE lower(set_by) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE poi_revs SET author_name = 'SanguinePanguine' WHERE lower(author_name) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE poi_revs SET reviewer_name = 'SanguinePanguine' WHERE lower(reviewer_name) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE poi_shelf SET by_name = 'SanguinePanguine' WHERE lower(by_name) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE poi_shelf SET updated_by = 'SanguinePanguine' WHERE lower(updated_by) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);
UPDATE poi_shelf SET gone_by = 'SanguinePanguine' WHERE lower(gone_by) = 'prostitute_strangler' AND EXISTS (SELECT 1 FROM handle_rename);

DROP TABLE handle_rename;
