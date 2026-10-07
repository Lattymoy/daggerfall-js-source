-- SD9b (2026-10-07, the Super Dungeons arc) - THE HOURS BROKEN.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct91) with the site and
-- the relay (world176 mints the receipts it counts).
--
-- Mac: "Super dungeons are random finds on the world map ... The Super
-- dungeon collapses when the feat is done." The relay runs the Brass
-- Remnant's fight in the Hollow's realm and, at its fall, signs a receipt
-- for each account that earned it (src/net/sdReceipt.js - `h1`, under the
-- relay's GATE_SIGNING_KEY). The account the receipt names carries it
-- here, this service verifies it with the relay's public half
-- (GATE_PUBLIC_KEY), and it is counted - an Hour broken.
--
-- ONE ROW A HOLLOW AN ACCOUNT BROKE, and the primary key is (slot,
-- account): a Hollow falls once, so a receipt counts once whatever
-- happens to it - claimed twice, from two devices, after a crash, a week
-- later. Its own table, never the gate's or the serpent's (theirs are keyed
-- by the game day). `boss` the Remnant, `earned` how ('dealt' | 'stood'),
-- `lv` the level the fight admitted; `title` and `aura` what its first
-- write granted (server-account/src/sds.js sdHonoursRoll); `nonce` names
-- the claim that wrote the row, so the one transaction that writes it
-- lays the grants by its own row alone.
--
-- CASCADE: an account that is gone takes its Hours with it.
CREATE TABLE IF NOT EXISTS sd_kills (
  slot    INTEGER NOT NULL,
  account TEXT NOT NULL,
  boss    TEXT NOT NULL,
  earned  TEXT NOT NULL,
  lv      INTEGER NOT NULL,
  title   INTEGER NOT NULL DEFAULT 0,
  aura    INTEGER NOT NULL DEFAULT 0,
  nonce   TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (slot, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sd_kills_account ON sd_kills (account);
-- THE HOUR'S GRANTS ON THE ROW - Hourbreaker (1) and The Turning Hour (2),
-- laid by a kill's first write and held for good (titles.js reads them as
-- it reads the Broker's sale off `insignia`). On the row and not read off
-- sd_kills at every badge: every door that mints a badge reads the row
-- whole already (a token, a letter's sender, a board's author), and a
-- grant once held is never taken back. 0 for every row before this.
ALTER TABLE players ADD COLUMN sd_honours INTEGER NOT NULL DEFAULT 0;
