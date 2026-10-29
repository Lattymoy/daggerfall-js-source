-- STAFF-SPEED-2 (2026-10-29, the staff panel slow on every page and refused under load; server-account/src/staffKept.js)
-- - THE PANEL'S HEAVY READS KEPT FOR EVERY ISOLATE.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- it. A Worker from before it never reads the table; this one, run before it, makes every answer as it did before.
--
-- `staff_kept`: one row a kept answer (Home's shared watches, the Status parts, the Economy) - its key, when it was
-- made, its JSON, and until when one request holds the claim to make it again. A handful of rows, rewritten in place.
CREATE TABLE IF NOT EXISTS staff_kept (
  key        TEXT PRIMARY KEY,
  at         INTEGER NOT NULL,
  body       TEXT NOT NULL,
  busy_until INTEGER NOT NULL DEFAULT 0
);
