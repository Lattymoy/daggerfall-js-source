-- SHOP (2026-10-28, the owner: "A new glyph panel alongside the timer and mailbox that will be used for our monetization
-- shop"; bible/06-Systems/Shop.md) - THE SHOP'S ORDERS, AND THE WARES THEY BOUGHT.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that
-- serves /v1/shop/*. SQLite has no ADD COLUMN IF NOT EXISTS, so a second run errors harmlessly.
--
-- A SALE IS A FACT, SO IT IS STORED (0040's law): `shop_wares` holds a bit a ware bought (src/net/shopLaw.js
-- SHOP_WARES), set by the payment's own signed word (server-account/src/shop.js) and taken off by a refund or a
-- dispute. What the account HOLDS is still read off the row at every ask (titles.js).
ALTER TABLE players ADD COLUMN shop_wares INTEGER NOT NULL DEFAULT 0;

-- AN ORDER is one press of Buy that reached Stripe: its ware and price as charged, Stripe's checkout session (and the
-- page it opened, so a second press goes back to the same one), the payment it took, and its state. Kept when the
-- account goes (player NULL), for the accounts the privacy page says are kept.
--   status   open (the page is up), paid, refunded, disputed, expired
CREATE TABLE IF NOT EXISTS shop_orders (
  id              TEXT PRIMARY KEY CHECK (length(id) = 24),
  player          TEXT REFERENCES players(id) ON DELETE SET NULL,
  ware            TEXT NOT NULL,
  cents           INTEGER NOT NULL CHECK (cents > 0),
  currency        TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('open', 'paid', 'refunded', 'disputed', 'expired')),
  stripe_session  TEXT UNIQUE,
  stripe_url      TEXT,
  payment_intent  TEXT,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL,
  paid_at         INTEGER,
  ended_at        INTEGER
);
CREATE INDEX IF NOT EXISTS idx_shop_orders_player ON shop_orders (player, ware, status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_intent ON shop_orders (payment_intent);

-- THE RECEIPT names its ware (a SHOP_WARES id), so the mailbox can draw what it granted. NULL for every other piece.
ALTER TABLE server_post ADD COLUMN ware TEXT;
