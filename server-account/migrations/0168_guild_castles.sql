-- DOMAIN2 (2026-10-24, the owner: "Allowing the purchase of the actual castle in major cities (cyrodil excluded), using the
-- instancing system"; asked, "One owner per castle", "Silver", "Region holder buys it"): A GUILD'S CASTLE
-- (bible/11-Multiplayer/Domains.md section 6; server-account/src/castles.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads it.
--
-- ONE ROW A CASTLE, KEYED BY ITS REGION: a crown's region keeps one castle, so a second buyer finds the key taken in the
-- very statement that would write it. `key` the castle's map id - its crown seat's key (a crown city's castle is its own
-- location's dungeon); `epoch` the instance room's own, minted at the purchase (net/instanceRoom.js - the room is
-- `dungeon:m<key>.i<the guild's digest>.<epoch>`); `paid` what the purchase burnt, the base of both refunds; `buyer`,
-- `rid` and `n` the purchase's request and the nonce of the batch that made it (PROF1's law). A guild that goes takes
-- its castles with it.
CREATE TABLE IF NOT EXISTS guild_castles (
  region     INTEGER PRIMARY KEY CHECK (region >= 0 AND region <= 70),   -- WW7-3, before its deploy: the provinces' regions too (62-70)
  key        INTEGER NOT NULL,
  guild_id   TEXT NOT NULL,
  paid       INTEGER NOT NULL CHECK (paid >= 0),
  epoch      TEXT NOT NULL,
  bought_at  INTEGER NOT NULL,
  buyer      TEXT NOT NULL,
  rid        TEXT NOT NULL,
  n          TEXT NOT NULL,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
-- a guild's castles, read with every look at the guild
CREATE INDEX IF NOT EXISTS idx_guild_castles_guild ON guild_castles (guild_id);
