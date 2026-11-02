-- MARKS1 (2026-09-28) - MARKS, THE SERVER'S CURRENCY.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "New currency" (bible/06-Systems/Professions-Arc.md 10.5, PROF0).
-- A Mark is held here alone and struck only for an act a server
-- witnessed; the law both ends read is src/net/marksLaw.js.
--
-- ═══ THE LEDGER IS THE TRUTH, AND IT MOVES THE BALANCES ═══════════
--
-- One ledger for every movement (the record's), and the balances are its
-- running sums, moved by the triggers below ON THE LINE'S OWN INSERT. So
-- no Mark moves without a line, and no line is written for Marks that did
-- not move - GUILD1's law for its gold treasury (0013_guilds.sql), turned
-- the right way round for a currency: there the treasury's UPDATE writes
-- the line; here the line writes the balances, because a Mark moving from
-- an account to a guild is ONE line touching TWO balances, and one INSERT
-- is one statement.
--
-- ONE STATEMENT DECIDES (server-account/src/marks.js): every movement is
-- a single `INSERT ... SELECT ... WHERE` whose WHERE holds the payer's
-- balance, the payee's cap and the day's cap as they stand at that
-- statement - so two requests racing never overdraw a balance nor pass a
-- cap. The CHECKs below are the net under that floor, not the floor.
--
-- `src_kind` 'mint' is a faucet and `dst_kind` 'burn' a sink; every other
-- line moves Marks between an account and a guild. `day` is the UTC day
-- (at / 86400) the caps count by. `actor` and `rid` make a request asked
-- twice - its answer lost - one line: UNIQUE, and the service answers the
-- line it finds.
--
-- CASCADE: an account that is gone takes its balance with it ("An account
-- is deleted: its Marks go" - PROF0 18); its ledger lines stay, the
-- economy's audit ("the Marks ledger ... forever" - PROF0 20). A guild's
-- Marks treasury row goes with its guild - EMPTY: a guild that goes (a
-- disband, the last member's leave) first gives what it holds to its
-- guildmaster, one `guild-withdraw` line in the delete's own batch
-- (guilds.js endGuild, marks.js guildMarksSweep; AUDIT 28 - the leave's
-- delete never looked, and the cascade took the Marks with no line).
CREATE TABLE IF NOT EXISTS marks (
  account  TEXT PRIMARY KEY,
  balance  INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0 AND balance <= 10000000),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS guild_marks (
  guild_id TEXT PRIMARY KEY,
  balance  INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0 AND balance <= 10000000),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS marks_ledger (
  seq      INTEGER PRIMARY KEY,
  src_kind TEXT NOT NULL CHECK (src_kind IN ('mint', 'account', 'guild')),
  src_id   TEXT,
  dst_kind TEXT NOT NULL CHECK (dst_kind IN ('burn', 'account', 'guild')),
  dst_id   TEXT,
  kind     TEXT NOT NULL,
  amount   INTEGER NOT NULL CHECK (amount > 0),
  day      INTEGER NOT NULL,
  at       INTEGER NOT NULL,
  actor    TEXT NOT NULL,
  who      TEXT,
  rid      TEXT NOT NULL,
  UNIQUE (actor, rid)
);
-- the caps' counts (a faucet's lines TO an account today; the exchange's FROM it today) and a guild's view
CREATE INDEX IF NOT EXISTS idx_marks_dst ON marks_ledger (dst_id, kind, day);
CREATE INDEX IF NOT EXISTS idx_marks_src ON marks_ledger (src_id, kind, day);
-- the weekly report's walk
CREATE INDEX IF NOT EXISTS idx_marks_day ON marks_ledger (day);

-- the payer
CREATE TRIGGER IF NOT EXISTS marks_line_pays_account AFTER INSERT ON marks_ledger WHEN NEW.src_kind = 'account'
BEGIN
  UPDATE marks SET balance = balance - NEW.amount WHERE account = NEW.src_id;
END;
CREATE TRIGGER IF NOT EXISTS marks_line_pays_guild AFTER INSERT ON marks_ledger WHEN NEW.src_kind = 'guild'
BEGIN
  UPDATE guild_marks SET balance = balance - NEW.amount WHERE guild_id = NEW.src_id;
END;
-- the payee
CREATE TRIGGER IF NOT EXISTS marks_line_pays_to_account AFTER INSERT ON marks_ledger WHEN NEW.dst_kind = 'account'
BEGIN
  INSERT INTO marks (account, balance) VALUES (NEW.dst_id, NEW.amount)
    ON CONFLICT (account) DO UPDATE SET balance = balance + excluded.balance;
END;
CREATE TRIGGER IF NOT EXISTS marks_line_pays_to_guild AFTER INSERT ON marks_ledger WHEN NEW.dst_kind = 'guild'
BEGIN
  INSERT INTO guild_marks (guild_id, balance) VALUES (NEW.dst_id, NEW.amount)
    ON CONFLICT (guild_id) DO UPDATE SET balance = balance + excluded.balance;
END;
