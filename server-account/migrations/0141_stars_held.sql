-- STAR7 (2026-10-20) - THE FALLEN STARS HELD. (0140 on its branch, renumbered past WITCH1's 0140_festival when the festival was folded in.)
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy the relay (world235) first: it signs the
-- receipts this service counts.
--
-- The owner: "a lore accurate world encounter defense mission ... a boss
-- topping off the encounter at the end". During the Witches' Festival a
-- coven's rite pulls three stars a night down into its region's wilds,
-- and the players at one hold it against four waves and their master
-- (bible/11-Multiplayer/Starfall.md). The relay keeps the star's ledger
-- and, at the master's fall, signs a receipt for each account that struck
-- one of its foes and stood at it (src/net/starfall/starReceipt.js - `j1`,
-- under GATE_SIGNING_KEY). The account it names carries it here; this
-- service verifies it with the relay's public half and counts it
-- (server-account/src/stars.js claimStar), paying the character that
-- fought it its Renown and silver under the day's combat cap.
--
-- stars_held   ONE ROW A STAR A PLAYER HELD - the primary key is (star,
--              account), `star` its night and star (`N.k`): a receipt
--              counts once whatever happens to it. `day` is the UTC day
--              the star FELL (an account counts STAR_CLAIMS_DAY_MAX a
--              day). `char_id` and `xp` are what the claim paid and to
--              whom; `nonce` names the claim that wrote the row, so the
--              one transaction that writes it credits by its own row
--              alone (raid_cleanses' law, migration 0016). `cid` is the
--              device's claim id that claim carried (NULL for none): a
--              retry of an answer lost after the commit finds the row
--              its own and is told what it paid (AUDIT STARFALL B3).
-- star_spoils  A STAR'S SPOILS, GIVEN ONCE A (STAR, ACCOUNT): the device's
--              claim id (`cid`) the first claim carried - a second browser
--              is answered `spoils: false` (raid_spoils' law, 0017). A
--              guest's too.
--
-- CASCADE: an account that is gone takes its stars with it.
CREATE TABLE IF NOT EXISTS stars_held (
  star    TEXT NOT NULL,
  account TEXT NOT NULL,
  day     INTEGER NOT NULL,
  char_id TEXT NOT NULL,
  xp      INTEGER NOT NULL,
  nonce   TEXT NOT NULL,
  at      INTEGER NOT NULL,
  cid     TEXT,
  PRIMARY KEY (star, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
-- the day's bound and the card's count read an account's own rows
CREATE INDEX IF NOT EXISTS stars_held_account_day ON stars_held (account, day);

CREATE TABLE IF NOT EXISTS star_spoils (
  star    TEXT NOT NULL,
  account TEXT NOT NULL,
  cid     TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (star, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
