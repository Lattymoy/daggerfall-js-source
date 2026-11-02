-- RAID4 (2026-09-28) - THE TOWNS DEFENDED.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac, on World Events - Raiding Parties online: "1. Server ... 3. We can
-- also add renown and it's own atheric + armor sets". The relay keeps a
-- town raid's ledger and signs a receipt for each account that struck a
-- raider and stood in the town at the cleanse (src/net/raidReceipt.js,
-- under the relay's GATE_SIGNING_KEY). The account the receipt names
-- carries it here, this service verifies it with the relay's public half
-- (GATE_PUBLIC_KEY), and it is counted - and pays the character that
-- fought it its Renown (src/net/renown.js renownRaidXp).
--
-- ONE ROW A RAID A PLAYER DEFENDED, and the primary key is (raid,
-- account): a receipt counts once whatever happens to it - claimed twice,
-- from two devices, after a crash, a week later. `day` is the raid's own
-- (its key's third field): an account counts at most RAID_CLAIMS_DAY_MAX
-- a game day (server-account/src/raids.js - the relay holds no copy of
-- the day's schedule, so this is the record's bound). `char_id` and `xp`
-- are what the claim paid and to whom; `nonce` names the claim that wrote
-- the row, so the one transaction that writes it credits the track by
-- its own row alone (a claim that finds the row already there credits
-- nothing).
--
-- CASCADE: an account that is gone takes its towns with it.
CREATE TABLE IF NOT EXISTS raid_cleanses (
  raid    TEXT NOT NULL,
  account TEXT NOT NULL,
  day     INTEGER NOT NULL,
  party   INTEGER NOT NULL,
  char_id TEXT NOT NULL,
  xp      INTEGER NOT NULL,
  nonce   TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (raid, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
-- An account's towns, for the count the cards say and the day's bound.
CREATE INDEX IF NOT EXISTS idx_raid_account_day ON raid_cleanses (account, day);
