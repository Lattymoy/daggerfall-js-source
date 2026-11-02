-- GUILD-SHOP (2026-10-30) - the guild shop, paid in silver (bible/11-Multiplayer/Guild-Shop.md).
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
-- An account's wares are bits on its row (src/net/guild/guildShopLaw.js GUILD_SHOP_WARES `bit`), as the shop's are
-- (shop_wares): a bit is a sale, never renumbered. A guild's furniture is a count a ware; its pieces stand in the hall's
-- decor (home_decor) and are counted against it there. Each purchase is a row the burn is written from, so a request
-- asked again is answered by its row (professions.js buyStock's law).
ALTER TABLE players ADD COLUMN guild_wares INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS guild_furniture (
  guild_id TEXT NOT NULL,
  ware     TEXT NOT NULL,
  owned    INTEGER NOT NULL CHECK (owned >= 0 AND owned <= 99),
  PRIMARY KEY (guild_id, ware),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS guild_shop_buys (
  actor    TEXT NOT NULL,
  rid      TEXT NOT NULL,
  ware     TEXT NOT NULL,
  payer    TEXT NOT NULL CHECK (payer IN ('account', 'guild')),
  guild_id TEXT NOT NULL,
  price    INTEGER NOT NULL CHECK (price > 0),
  at       INTEGER NOT NULL,
  n        TEXT NOT NULL,
  PRIMARY KEY (actor, rid)
);
CREATE INDEX IF NOT EXISTS idx_guild_shop_buys_guild ON guild_shop_buys (guild_id, at);

-- GUILD-LOGO: a guild's own picture, sent for the moderators' word on Discord. `state` pending, approved, denied or
-- withdrawn; the picture is kept in R2 (`obj`) under an id no one can guess, so the card can show it (`src`, its
-- address) before it is approved. `guilds.logo` names the approved one a guild wears in place of its device.
ALTER TABLE guilds ADD COLUMN logo TEXT;
CREATE TABLE IF NOT EXISTS guild_logos (
  id            TEXT PRIMARY KEY,
  guild_id      TEXT NOT NULL,
  state         TEXT NOT NULL CHECK (state IN ('pending', 'approved', 'denied', 'withdrawn')),
  obj           TEXT NOT NULL,
  src           TEXT NOT NULL,
  type          TEXT NOT NULL,
  bytes         INTEGER NOT NULL CHECK (bytes > 0),
  side          INTEGER NOT NULL CHECK (side > 0),
  fee           INTEGER NOT NULL CHECK (fee >= 0),
  by_player     TEXT NOT NULL,
  by_name       TEXT NOT NULL,
  rid           TEXT NOT NULL,
  at            INTEGER NOT NULL,
  decided_at    INTEGER,
  decided_by    TEXT,
  discord_state TEXT NOT NULL DEFAULT 'due' CHECK (discord_state IN ('due', 'off', 'posted', 'failed')),
  discord_msg   TEXT,
  UNIQUE (by_player, rid),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_guild_logos_guild ON guild_logos (guild_id, state);
CREATE INDEX IF NOT EXISTS idx_guild_logos_discord ON guild_logos (discord_state, at);
-- one review at a time a guild
CREATE UNIQUE INDEX IF NOT EXISTS idx_guild_logos_pending ON guild_logos (guild_id) WHERE state = 'pending';
