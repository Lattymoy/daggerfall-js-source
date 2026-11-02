-- GUILD2 (2026-10-03) - THE GUILD PAGE'S OVERHAUL: A NEW NAME FOR A PRICE, THE VAULT AND WHO MAY USE IT
-- (bible/11-Multiplayer/Guild-Overhaul.md; the laws are src/net/guildLaw.js and src/net/guildVaultLaw.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- GUILD2a: WHEN A GUILD LAST TOOK A NEW NAME (epoch seconds, NULL for never) - the next may come a fortnight on
-- (guildLaw.js GUILD_RENAME_COOLDOWN_S); and every rename written down, the names it left and took and what it paid. The
-- treasury's own line is the ledger trigger's (0046's `moved_kind` 'rename').
ALTER TABLE guilds ADD COLUMN renamed_at INTEGER;
CREATE TABLE IF NOT EXISTS guild_renames (
  seq       INTEGER PRIMARY KEY,
  guild_id  TEXT NOT NULL,
  at        INTEGER NOT NULL,
  who       TEXT NOT NULL,
  old_name  TEXT NOT NULL,
  old_tag   TEXT NOT NULL,
  new_name  TEXT NOT NULL,
  new_tag   TEXT NOT NULL,
  cost      INTEGER NOT NULL CHECK (cost >= 0),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_guild_renames_guild ON guild_renames (guild_id, seq);
-- AUDIT2 GUILD2 G1: a Chronicle row's guild, as it was that day, found by the name and tag it bore (seatInfluence.js renamedSince)
CREATE INDEX IF NOT EXISTS idx_guild_renames_old ON guild_renames (old_tag, old_name, at);

-- GUILD2b: THE VAULT - a guild's shelf of items, a slot each (guildVaultLaw.js: 50, and 50 more with a hall). `rec` the
-- piece's record exactly as it left its depositor's realm record (net/realmTradeLaw.js takeTradeGoods - every field, the
-- count in `stackCount`), `count` its count beside it for the reads; the depositor's account, character and name. A slot
-- is taken by its primary key, so two deposits racing for one write one and refuse the other whole.
CREATE TABLE IF NOT EXISTS guild_vault (
  guild_id   TEXT NOT NULL,
  slot       INTEGER NOT NULL CHECK (slot >= 0 AND slot < 100),
  rec        TEXT NOT NULL,
  name       TEXT NOT NULL,
  count      INTEGER NOT NULL CHECK (count >= 1),
  dep_player TEXT NOT NULL,
  dep_char   TEXT NOT NULL,
  dep_name   TEXT NOT NULL,
  at         INTEGER NOT NULL,
  PRIMARY KEY (guild_id, slot),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
-- Every piece put in or taken out, as the members read it.
CREATE TABLE IF NOT EXISTS guild_vault_log (
  seq       INTEGER PRIMARY KEY,
  guild_id  TEXT NOT NULL,
  at        INTEGER NOT NULL,
  who       TEXT NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('put', 'take')),
  name      TEXT NOT NULL,
  count     INTEGER NOT NULL CHECK (count >= 1),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_guild_vault_log_guild ON guild_vault_log (guild_id, seq);

-- A MEMBER'S STANDING AT THE VAULT, the guildmaster's word: `vault_level` NULL - the rank's default (guildVaultLaw.js
-- VAULT_RANK_DEFAULTS) - or 'none', 'deposit', 'withdraw'; `vault_limit` a withdrawer's pieces a UTC day (0 none); and the
-- pieces taken out on `vault_day` (a UTC day), counted as each is taken.
ALTER TABLE guild_members ADD COLUMN vault_level TEXT CHECK (vault_level IS NULL OR vault_level IN ('none', 'deposit', 'withdraw'));
ALTER TABLE guild_members ADD COLUMN vault_limit INTEGER NOT NULL DEFAULT 0 CHECK (vault_limit >= 0 AND vault_limit <= 100);
ALTER TABLE guild_members ADD COLUMN vault_day INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guild_members ADD COLUMN vault_taken INTEGER NOT NULL DEFAULT 0 CHECK (vault_taken >= 0);
