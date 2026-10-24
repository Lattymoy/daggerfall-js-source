-- STAFF-HIDE-TOGGLE (2026-10-23, mob: "i cant talk in chat?", "i need to be bale to talk in chat", "need hide to be a
-- toggle"): HIDE ME OFF BY DEFAULT - for every staff member, the accounts that stand today included
-- (server-account/src/staffHidden.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads it.
--
-- 0159 gave every row `staff_hide` 1 by default, so a staff member who never pressed a thing was hidden from every player
-- (and the relay drops a hidden socket's chat). D1's SQLite cannot change a column's default in place, so the switch moves
-- to a column of its own whose default is off, and the Worker reads only it:
--
-- players.staff_hide_on  0 (the default: shown) or 1, once the staff member pressed Hide me. 0159's `staff_hide` stays
--                 where it is, unread by this Worker - an older one (the deploy's gap, a rollback) still reads it, as it
--                 always did.
--
-- A CHOICE MADE SINCE 0159 IS KEPT. Every press of Hide me or Show myself wrote a `hide` row to the audit log with its word
-- (`{"on":true}` or `{"on":false}`), and the log keeps 30 days (staff.js STAFF_AUDIT_KEEP_S) - 0159 is from 2026-10-22, so
-- every press since is still there. A staff member whose newest press was Hide me stays hidden; one whose newest was Show
-- myself, and one who never pressed (the default alone hid them), is shown: on only where the account's newest `hide` row
-- says on. No audit row is written for the move: it is no staff member's word, and staffHidden.js LAPSED_SQL reads the
-- switch beside the log for that reason.
ALTER TABLE players ADD COLUMN staff_hide_on INTEGER NOT NULL DEFAULT 0;
UPDATE players SET staff_hide_on = 1 WHERE id IN (SELECT a.actor FROM staff_audit a WHERE a.detail = '{"on":true}'
  AND a.id = (SELECT MAX(b.id) FROM staff_audit b WHERE b.actor = a.actor AND b.act = 'hide'));
