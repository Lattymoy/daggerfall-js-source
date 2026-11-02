-- GUILD1d (2026-09-30, Mac: "Lets do this") - THE GUILD HALL AND A GUILD'S HERALDRY
-- (bible/11-Multiplayer/Seats-Arc.md 8; src/net/guildLaw.js, src/net/heraldryLaw.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).

-- A HALL IS A HOME A GUILD OWNS (Seats-Arc 8.2: "the homes table gains a guild owner column"). Its row keeps the one
-- building one owner (the primary key, HOME1), names the guild here, and carries the guild's own mark where a home
-- names its character (`guild:<id>`, outside every character id's shape) - so no character's path reaches it. `player`
-- is the account of the guildmaster who bought it (the row's anchor; no route deletes an account). A guild holds ONE
-- hall - the partial unique index. A guild is never deleted while it holds one (guilds.js guildKeepsSql); the plain
-- reference is the net under that floor.
ALTER TABLE homes ADD COLUMN guild_id TEXT REFERENCES guilds(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_homes_guild ON homes (guild_id) WHERE guild_id IS NOT NULL;

-- A GUILD'S HERALDRY (Seats-Arc 8.1): `{ field, border, device }` as JSON (heraldryLaw.js heraldryOf), NULL until its
-- guildmaster first chooses one.
ALTER TABLE guilds ADD COLUMN heraldry TEXT;

-- THE LEDGER NAMES WHY THE GOLD MOVED. A treasury moved for the hall - bought (`hall`), sold (`hall-sale`), or half of
-- a hall piece's cost come back (`hall-piece`) - names its kind on the guild's row with the move, as it names its mover
-- and its moment; the line takes it, and the row forgets it in the same trigger, so the next plain deposit or
-- withdrawal is never written down as the hall's. A move that names no kind is a deposit or a withdrawal, as before.
ALTER TABLE guilds ADD COLUMN moved_kind TEXT;
DROP TRIGGER IF EXISTS guild_ledger_line;
CREATE TRIGGER IF NOT EXISTS guild_ledger_line AFTER UPDATE OF treasury ON guilds
  WHEN NEW.treasury <> OLD.treasury
BEGIN
  INSERT INTO guild_ledger (guild_id, at, who, kind, amount, balance)
  VALUES (NEW.id, NEW.moved_at, NEW.moved_by,
          COALESCE(NEW.moved_kind, CASE WHEN NEW.treasury > OLD.treasury THEN 'deposit' ELSE 'withdraw' END),
          abs(NEW.treasury - OLD.treasury), NEW.treasury);
  UPDATE guilds SET moved_kind = NULL WHERE id = NEW.id AND moved_kind IS NOT NULL;
END;
