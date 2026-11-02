-- PROF6 (2026-09-29, Mac: "continue") - GUILD WRITS, THE GUILD STORES AND COMMISSIONS
-- (bible/06-Systems/Professions-Arc.md 7, 11, 14, 28).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI). Every act below is
-- decided by ONE statement that writes its row with a fresh nonce `n`; everything that follows is keyed on it
-- (server-account/src/writs.js), as PROF1-5's acts are. The Court's writs stay `writs` (0027) - they mint; these move
-- Marks a guild or a player holds, on the ledger's `escrow` end (0032), their ids the writ's or the commission's.

-- A GUILD'S WRITS (11): posted by its Guildmaster, or an Officer within the week's budget (`officer` 1, `week` the
-- seat week it was posted in - writLaw seatWeek); the whole pay escrowed from the guild's Marks treasury, drawn down by
-- each delivery; closed filled, withdrawn or expired, and what is left returned once (`returned`). The poster's account
-- may go (SET NULL) - the writ is the guild's. A guild with a writ standing does not disband (guilds.js), so the
-- cascade meets only closed rows.
CREATE TABLE IF NOT EXISTS guild_writs (
  id          TEXT PRIMARY KEY,
  guild_id    TEXT NOT NULL,
  poster      TEXT,
  poster_char TEXT NOT NULL,
  officer     INTEGER NOT NULL CHECK (officer IN (0, 1)),
  week        INTEGER NOT NULL,
  region      INTEGER NOT NULL CHECK (region >= 0 AND region <= 61),
  material    TEXT NOT NULL,
  units       INTEGER NOT NULL CHECK (units >= 1 AND units <= 5000),
  left_units  INTEGER NOT NULL CHECK (left_units >= 0 AND left_units <= units),
  pay         INTEGER NOT NULL CHECK (pay >= 1),
  escrow      INTEGER NOT NULL CHECK (escrow >= 0),
  at          INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  state       TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'filled', 'withdrawn', 'expired')),
  closed_at   INTEGER,
  returned    INTEGER NOT NULL DEFAULT 0 CHECK (returned IN (0, 1)),
  closed_by   TEXT,
  rid         TEXT NOT NULL,
  n           TEXT NOT NULL,
  cn          TEXT,
  UNIQUE (poster, rid),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (poster) REFERENCES players(id) ON DELETE SET NULL
);
-- a region's open writs, soonest to end first; a guild's open count; the week's Officers' posts; the expired sweep
CREATE INDEX IF NOT EXISTS idx_guild_writs_region ON guild_writs (region, state, expires_at);
CREATE INDEX IF NOT EXISTS idx_guild_writs_guild ON guild_writs (guild_id, state);
CREATE INDEX IF NOT EXISTS idx_guild_writs_week ON guild_writs (guild_id, week, officer);
CREATE INDEX IF NOT EXISTS idx_guild_writs_due ON guild_writs (state, returned, expires_at);

-- A DELIVERY to a guild writ: its units out of the deliverer's Stores (bought first), into the guild Stores; its pay
-- the units times the pay each, less the tax on the writ's running total (the order's law, 28).
CREATE TABLE IF NOT EXISTS guild_writ_fills (
  filler     TEXT NOT NULL,
  rid        TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  writ       TEXT NOT NULL,
  guild_id   TEXT NOT NULL,
  material   TEXT NOT NULL,
  units      INTEGER NOT NULL CHECK (units >= 1),
  pay        INTEGER NOT NULL CHECK (pay >= 0),
  tax        INTEGER NOT NULL CHECK (tax >= 0),
  at         INTEGER NOT NULL,
  day        INTEGER NOT NULL,
  n          TEXT NOT NULL,
  PRIMARY KEY (filler, rid),
  FOREIGN KEY (filler) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_guild_writ_fills_writ ON guild_writ_fills (writ, at);

-- AN OFFICERS' WRIT BUDGET a seat week (11), the Guildmaster's to set; none is 0.
CREATE TABLE IF NOT EXISTS guild_writ_budgets (
  guild_id TEXT PRIMARY KEY,
  budget   INTEGER NOT NULL CHECK (budget >= 0 AND budget <= 10000000),
  set_by   TEXT NOT NULL,
  set_at   INTEGER NOT NULL,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- THE GUILD STORES (7): a guild's warehouse, a row a material and a depositor - a member's own deposit kept under the
-- member (the character: `dep_player`, `dep_char`), own again when that member withdraws it; bought units and a writ's
-- units the guild's own (`dep_player` '', `dep_char` ''), bought to whoever withdraws them. A material's rows hold
-- 50,000 at most together (writLaw GUILD_STORES_MAX, asked by every decision). `moved_by`/`moved_at` name the last
-- move, which the ledger's trigger reads (GUILD1's pattern: 0013's `guild_ledger_line`).
CREATE TABLE IF NOT EXISTS guild_prof_stores (
  guild_id   TEXT NOT NULL,
  material   TEXT NOT NULL,
  dep_player TEXT NOT NULL DEFAULT '',
  dep_char   TEXT NOT NULL DEFAULT '',
  qty        INTEGER NOT NULL CHECK (qty >= 0 AND qty <= 50000),
  moved_by   TEXT NOT NULL,
  moved_at   INTEGER NOT NULL,
  PRIMARY KEY (guild_id, material, dep_player, dep_char),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Every movement of the guild Stores on a ledger (7), written by triggers - a row's first units and every change after.
CREATE TABLE IF NOT EXISTS guild_store_ledger (
  seq        INTEGER PRIMARY KEY,
  guild_id   TEXT NOT NULL,
  material   TEXT NOT NULL,
  dep_player TEXT NOT NULL,
  dep_char   TEXT NOT NULL,
  delta      INTEGER NOT NULL,
  qty        INTEGER NOT NULL,
  who        TEXT NOT NULL,
  at         INTEGER NOT NULL,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_guild_store_ledger_guild ON guild_store_ledger (guild_id, seq);
CREATE TRIGGER IF NOT EXISTS guild_store_in
AFTER INSERT ON guild_prof_stores
WHEN NEW.qty > 0
BEGIN
  INSERT INTO guild_store_ledger (guild_id, material, dep_player, dep_char, delta, qty, who, at)
  VALUES (NEW.guild_id, NEW.material, NEW.dep_player, NEW.dep_char, NEW.qty, NEW.qty, NEW.moved_by, NEW.moved_at);
END;
CREATE TRIGGER IF NOT EXISTS guild_store_moved
AFTER UPDATE OF qty ON guild_prof_stores
WHEN NEW.qty <> OLD.qty
BEGIN
  INSERT INTO guild_store_ledger (guild_id, material, dep_player, dep_char, delta, qty, who, at)
  VALUES (NEW.guild_id, NEW.material, NEW.dep_player, NEW.dep_char, NEW.qty - OLD.qty, NEW.qty, NEW.moved_by, NEW.moved_at);
END;

-- A DEPOSIT or a WITHDRAWAL of the guild Stores: its request's row (`(player, rid)`, the repeat's answer), the units
-- and how many of them were the mover's own (a deposit's own units kept under them; a withdrawal's own deposit back).
CREATE TABLE IF NOT EXISTS guild_store_moves (
  player    TEXT NOT NULL,
  rid       TEXT NOT NULL,
  char_id   TEXT NOT NULL,
  guild_id  TEXT NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('deposit', 'withdraw')),
  material  TEXT NOT NULL,
  units     INTEGER NOT NULL CHECK (units >= 1),
  own       INTEGER NOT NULL CHECK (own >= 0 AND own <= units),
  at        INTEGER NOT NULL,
  n         TEXT NOT NULL,
  PRIMARY KEY (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);

-- COMMISSIONS (11): a player's writ naming a crafter (by account; its handle read at each view) and a piece - a
-- recipe and its least quality (NULL for a recipe that takes none) - its pay escrowed from the poster. Filled once, by
-- the crafter, with a piece of their own make (`provenance`, `fill_rid`, `fn`); withdrawn, declined or expired, the
-- escrow returned once (`returned`). The poster's account gone takes it (its escrow burnt, as an order's); the
-- crafter's gone leaves it (SET NULL) to be returned on the poster's read.
CREATE TABLE IF NOT EXISTS commissions (
  id          TEXT PRIMARY KEY,
  poster      TEXT NOT NULL,
  poster_char TEXT NOT NULL,
  crafter     TEXT,
  region      INTEGER NOT NULL CHECK (region >= 0 AND region <= 61),
  recipe      TEXT NOT NULL,
  quality     INTEGER CHECK (quality IS NULL OR (quality >= 0 AND quality <= 4)),
  pay         INTEGER NOT NULL CHECK (pay >= 1 AND pay <= 1000000),
  at          INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  state       TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'filled', 'withdrawn', 'declined', 'expired')),
  closed_at   INTEGER,
  returned    INTEGER NOT NULL DEFAULT 0 CHECK (returned IN (0, 1)),
  provenance  TEXT CHECK (provenance IS NULL OR length(provenance) = 16),
  filled_char TEXT,
  tax         INTEGER NOT NULL DEFAULT 0 CHECK (tax >= 0),
  fill_rid    TEXT,
  rid         TEXT NOT NULL,
  n           TEXT NOT NULL,
  fn          TEXT,
  cn          TEXT,
  UNIQUE (poster, rid),
  FOREIGN KEY (poster) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (crafter) REFERENCES players(id) ON DELETE SET NULL
);
-- a region's open commissions; a poster's and a crafter's open counts; a fill's request id, one a crafter
CREATE INDEX IF NOT EXISTS idx_commissions_region ON commissions (region, state, expires_at);
CREATE INDEX IF NOT EXISTS idx_commissions_poster ON commissions (poster, state);
CREATE INDEX IF NOT EXISTS idx_commissions_crafter ON commissions (crafter, state);
CREATE UNIQUE INDEX IF NOT EXISTS idx_commissions_fill_rid ON commissions (crafter, fill_rid) WHERE fill_rid IS NOT NULL;

-- THE NOTE'S FOURTH BUTTON (10.6: "a commission"). SQLite widens no CHECK in place: `board_notes` is rebuilt, every
-- note carried, its indexes made again. Its reports ride a copy across the drop - dropping a table with foreign keys
-- on deletes its rows first, and `board_reports` cascades from them.
CREATE TABLE board_reports_keep AS SELECT * FROM board_reports;
CREATE TABLE board_notes_new (
  id          TEXT PRIMARY KEY,
  map_id      INTEGER NOT NULL CHECK (map_id >= 0 AND map_id <= 4294967295),
  author      TEXT NOT NULL,
  author_name TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  button      TEXT CHECK (button IS NULL OR button IN ('party', 'guild', 'duel', 'commission')),
  guild_id    TEXT,
  char_id     TEXT,
  at          INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  hidden      INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1, 2)),
  rid         TEXT NOT NULL,
  UNIQUE (author, rid),
  FOREIGN KEY (author) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE SET NULL
);
INSERT INTO board_notes_new (id, map_id, author, author_name, subject, body, button, guild_id, char_id, at, expires_at, hidden, rid)
  SELECT id, map_id, author, author_name, subject, body, button, guild_id, char_id, at, expires_at, hidden, rid FROM board_notes;
DROP TABLE board_notes;
ALTER TABLE board_notes_new RENAME TO board_notes;
CREATE INDEX IF NOT EXISTS idx_board_notes_map ON board_notes (map_id, at);
CREATE INDEX IF NOT EXISTS idx_board_notes_author ON board_notes (author, expires_at);
CREATE INDEX IF NOT EXISTS idx_board_notes_expires ON board_notes (expires_at);
INSERT OR IGNORE INTO board_reports (note_id, reporter, at) SELECT note_id, reporter, at FROM board_reports_keep
  WHERE note_id IN (SELECT id FROM board_notes);
DROP TABLE board_reports_keep;
