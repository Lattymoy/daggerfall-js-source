-- FIELD BUGS 2026-10-16b REZ-BLOODLINE, AUDIT R1 (bible/01-Overview/Field-Bugs-2026-10-16b.md) - A FALL HELD FOR A PARTY'S
-- RESURRECT IS THE REALM'S, NOT THE PAGE'S.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- REZ-BLOODLINE held an online Bloodline death in the dying page's memory alone, so a tab killed under its death screen
-- (no pagehide: a crash, the task manager, a phone discarding it) or a join from another device took the death with it.
-- The death door now stamps the tombstone at once (server-account/src/legacy.js realmDie `hold`): `dead_at` - nothing of
-- the character is joined, checkpointed or traded from there - and the playing tab's lease kept aside here, `rez_lease`,
-- for a party's Resurrect inside the window (legacy.js realmRaise, REZ_HOLD_S): the one lease that may take the death
-- back, once. What a tombstone takes with it (its union, its guild seat, its pieces - afterTomb) waits on the window's
-- end: the dying tab's own word that it went on, or the minute's clock (cron.js `rez-holds`, legacy.js settleHolds),
-- which this index lets it find without walking the table.
ALTER TABLE realm_characters ADD COLUMN rez_lease TEXT;
CREATE INDEX IF NOT EXISTS realm_characters_rez_hold ON realm_characters (dead_at) WHERE rez_lease IS NOT NULL;
