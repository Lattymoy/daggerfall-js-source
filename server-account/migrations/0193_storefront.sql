-- STOREFRONT (2026-10-29, the owner: "an overhaul to the ingame shop menu ... Portal effects ... and kill effects";
-- bible/06-Systems/Storefront.md, Battle-Pass.md) - THE SHOP'S SECOND BUILD, THE EFFECTS WORN AND THE BATTLE PASS.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that serves
-- /v1/account/effect and /v1/pass/*. Deploy this service after the relay that knows the `fx` claim and its vocabulary.
-- SQLite has no ADD COLUMN IF NOT EXISTS, so a second run errors harmlessly.
--
--   shop_held  the wares held by id (src/net/shopLaw.js - every ware after the first nine, whose bits stay on
--              `shop_wares`), space-separated in sale order; set by a paid order and taken off by a refund (shop.js)
--   effects    the effects kit worn (src/net/effectLaw.js: a kill effect, a portal skin, a mount look), signed as `fx`;
--              NULL for none. Read against what is held at every ask (titles.js effectsWorn)
--   pass_s1    Season One's experience (src/net/battlePassLaw.js) - finds, challenges and the levels a ware gives at once;
--              what the track gives is read off it at every ask (titles.js passKeys)
ALTER TABLE players ADD COLUMN shop_held TEXT NOT NULL DEFAULT '';
ALTER TABLE players ADD COLUMN effects TEXT;
ALTER TABLE players ADD COLUMN pass_s1 INTEGER NOT NULL DEFAULT 0;

-- A SEASON'S DAY, an account a UTC day: the asks heard, the experience found before a booster's share (battlePassLaw.js
-- PASS_DAY_ASKS, PASS_DAY_XP), and the last find's base - the batch's next statement reads it, so the day's row decides.
CREATE TABLE IF NOT EXISTS pass_days (
  account TEXT NOT NULL,
  season  TEXT NOT NULL,
  day     INTEGER NOT NULL,
  asks    INTEGER NOT NULL DEFAULT 0,
  xp      INTEGER NOT NULL DEFAULT 0,
  last    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account, season, day),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);

-- A STAGE'S CHALLENGE, an account: its deeds counted while its stage is open, and when it paid (0 not yet) - once.
CREATE TABLE IF NOT EXISTS pass_counts (
  account   TEXT NOT NULL,
  season    TEXT NOT NULL,
  challenge TEXT NOT NULL,
  n         INTEGER NOT NULL DEFAULT 0,
  paid      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account, season, challenge),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);

-- THE DEMAND (Storefront.md section 3.2): the staff's sales by day read paid and opened orders by day and ware.
CREATE INDEX IF NOT EXISTS idx_shop_orders_created ON shop_orders (created_at, ware);
CREATE INDEX IF NOT EXISTS idx_shop_orders_paid ON shop_orders (paid_at, ware);

-- AUDIT LANE 5 (2026-10-29, the season in the world audited): THE RESONANT MAUL'S DAY (seasonClaim.js) - one row an
-- account a UTC day it took the Maul, its season's, with the ask that took it (`rid`): an answer lost and asked again with
-- the same id is a yes again, any other ask that day is refused. The page had kept the day in its own store.
CREATE TABLE IF NOT EXISTS season_mauls (
  account TEXT NOT NULL,
  day     INTEGER NOT NULL,
  season  TEXT NOT NULL,
  rid     TEXT NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (account, day),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
