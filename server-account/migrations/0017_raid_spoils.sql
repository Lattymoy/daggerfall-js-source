-- AUDIT RAID (2026-09-28) - A TOWN'S THANKS, ONCE A RAID AND ACCOUNT.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "1. Audit this properly 2. Ensure online functionality is
-- perfect". A raid's thanks (the gold and the pieces its receipt's seed
-- rolls - src/systems/raidSpoils.js) were given once a receipt AND
-- DEVICE: the relay hands an account's receipt to every socket of it, so
-- a second browser or a phone rolled them again. They are given now when
-- THIS row says so: the first claim of a (raid, account) - a registered
-- account's or a guest's - writes it with that device's claim id (`cid`),
-- and a claim is answered `spoils: true` only when the row carries its own
-- cid (the same device asking again after an answer it lost is answered
-- the same). No count reads it: a guest's row is no town defended.
--
-- CASCADE: an account that is gone takes its thanks with it.
CREATE TABLE IF NOT EXISTS raid_spoils (
  raid    TEXT NOT NULL,
  account TEXT NOT NULL,
  cid     TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (raid, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
