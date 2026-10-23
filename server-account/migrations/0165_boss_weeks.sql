-- PWR5 (2026-10-23) - THE WEEK'S FINEST: a boss's Legendary, set and Gilded pieces once an account an arena week
-- (bible/05-Combat/Power-Arc.md section 8; Mac: "Weekly per boss" - "each boss rolls Legendary-and-up, set and Gilded
-- pieces for an account once an arena week; repeat kills still pay gold, Marks and Embers"). The law is
-- src/net/bossWeek.js; the statements server-account/src/bossWeek.js, written in the claim's own batch (accounts.js
-- claimGate, sds.js claimSd, serpents.js claimSerpent).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- by it.
--
-- A ROW A BOSS AN ARENA WEEK: `boss` its kind and the receipt's boss ('gate:ruhn', 'sd:remnant', 'serpent:sethrakul'),
-- `wk` the arena week of the kill (the receipt's issue time), `ref` the kill that took it (the kind's own row: the gate's
-- day, the Hour's slot, the serpent's day), `cid` the device that claimed it, `nonce` the service's draw the week's finest
-- roll on. INSERT OR IGNORE: the first claim of the week writes it, and every claim reads it back. The account row goes,
-- and its weeks with it (CASCADE).
CREATE TABLE IF NOT EXISTS boss_weeks (
  account TEXT NOT NULL,
  boss    TEXT NOT NULL,
  wk      INTEGER NOT NULL,
  ref     TEXT NOT NULL,
  cid     TEXT,
  nonce   TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (account, boss, wk),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
