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
--              `shop_wares`), space-separated in sale order; set by a paid order and taken off by a refund (shop.js).
--              `-<id>` marks a ware a giver held no longer gives: its own payment went back, and the giver was sold
--              with credit for it (shopLaw.js shopLostOf)
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

-- AUDIT-STOREFRONT II (lane B 2): A FIND'S OWN ID, an account's (battlePass.js findPass) - written in the find's own batch,
-- so a find asked again by it (its answer lost) is answered as it was and counts once; `answer` that answer, `day` its UTC
-- day. An account's ids past PASS_ASK_KEEP_DAYS go with its first find of a day, read by the account's own key.
CREATE TABLE IF NOT EXISTS pass_asks (
  account TEXT NOT NULL,
  rid     TEXT NOT NULL,
  day     INTEGER NOT NULL,
  answer  TEXT,
  PRIMARY KEY (account, rid),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);

-- AN ORDER'S CREDIT AND ITS OWN REFUND (AUDIT-STOREFRONT S1, S3):
--   credit       what of the ware the account held at its checkout - its price took it off, so a payment taken back
--                never takes it (shopLaw.js shopCreditOf), space-separated ids
--   refund       why the service returned the payment itself: 'held' (two pages paid at once), 'spent' (a stronger
--                booster held), 'late' (a season's ware paid after it); NULL for a payment it kept
--   refund_owed  1 while Stripe has not yet taken that refund - asked again at Stripe's next word on the order
ALTER TABLE shop_orders ADD COLUMN credit TEXT NOT NULL DEFAULT '';
ALTER TABLE shop_orders ADD COLUMN refund TEXT;
ALTER TABLE shop_orders ADD COLUMN refund_owed INTEGER NOT NULL DEFAULT 0;

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

-- AURUM (2026-10-29, the owner: "a currency that can be earned ingame and through the past + purchased to be used to
-- purchase a selection of rotating items daily"; bible/06-Systems/Aurum.md). An account's Aurum is counted at every ask:
-- its paid packs (`shop_orders.aurum`), its pass tracks' rewards (src/net/aurumLaw.js aurumTrackOf) and this ledger's
-- lines. A refund or a dispute takes a pack's Aurum back by its order's status alone.
--   shop_orders.aurum  the Aurum a pack's order gives, set at its checkout (0 for every other ware)
ALTER TABLE shop_orders ADD COLUMN aurum INTEGER NOT NULL DEFAULT 0;

-- THE LEDGER: a line a deed struck or a ware bought, once each (the key): `deed` the week's first of a witnessed kind
-- (ref `<kind>:<week>`, the week from Monday, UTC), `buy` a daily ware (ref its id, spent as a negative amount).
CREATE TABLE IF NOT EXISTS aurum_ledger (
  account TEXT NOT NULL,
  kind    TEXT NOT NULL,
  ref     TEXT NOT NULL,
  amount  INTEGER NOT NULL,
  day     INTEGER NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (account, kind, ref),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_aurum_ledger_day ON aurum_ledger (kind, day);

-- THE WEEK'S DEEDS (aurumLaw.js AURUM_DEEDS - a pin holds these amounts to it): a witnessed receipt's own row strikes its
-- kind's Aurum once a week, in the claim's batch, so a claim rolled back strikes nothing. A gate closed by a rite is no
-- fight; a Redoubt counts where the week paid it.
CREATE TRIGGER IF NOT EXISTS aurum_deed_gate AFTER INSERT ON gate_kills WHEN NEW.earned != 'rite'
BEGIN
  INSERT OR IGNORE INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (NEW.account, 'deed', 'gate:' || ((NEW.at / 86400 + 3) / 7), 30, NEW.at / 86400, NEW.at);
END;
CREATE TRIGGER IF NOT EXISTS aurum_deed_eg AFTER INSERT ON eg_redoubts WHEN NEW.paid = 1
BEGIN
  INSERT OR IGNORE INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (NEW.account, 'deed', 'eg:' || ((NEW.at / 86400 + 3) / 7), 30, NEW.at / 86400, NEW.at);
END;
CREATE TRIGGER IF NOT EXISTS aurum_deed_serpent AFTER INSERT ON serpent_kills
BEGIN
  INSERT OR IGNORE INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (NEW.account, 'deed', 'serpent:' || ((NEW.at / 86400 + 3) / 7), 25, NEW.at / 86400, NEW.at);
END;
CREATE TRIGGER IF NOT EXISTS aurum_deed_star AFTER INSERT ON stars_held
BEGIN
  INSERT OR IGNORE INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (NEW.account, 'deed', 'star:' || ((NEW.at / 86400 + 3) / 7), 20, NEW.at / 86400, NEW.at);
END;
CREATE TRIGGER IF NOT EXISTS aurum_deed_raid AFTER INSERT ON raid_cleanses
BEGIN
  INSERT OR IGNORE INTO aurum_ledger (account, kind, ref, amount, day, at) VALUES (NEW.account, 'deed', 'raid:' || ((NEW.at / 86400 + 3) / 7), 15, NEW.at / 86400, NEW.at);
END;

-- AUDIT-STOREFRONT II (A1, A3 - Stripe promises its events in no order, and retries a refused one for days): EVERY WORD
-- ON A PAYMENT, kept by its payment_intent whether or not its order is paid yet - a full refund (`refund`, ref ''), a
-- dispute (`dispute`, ref its id, open until it closes). A paid word that lands after reads them before it grants, and a
-- dispute's close gives the ware back only with no refund and no other dispute open.
CREATE TABLE IF NOT EXISTS shop_charge_words (
  intent TEXT NOT NULL,
  kind   TEXT NOT NULL,
  ref    TEXT NOT NULL,
  open   INTEGER NOT NULL DEFAULT 1,
  at     INTEGER NOT NULL,
  PRIMARY KEY (intent, kind, ref)
);
