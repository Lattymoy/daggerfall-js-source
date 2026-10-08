-- CHAP2a (2026-10-07) - THE CHAPTERS' HALLS AND THEIR WRITS.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). Deploy this service (acct94) BEFORE the site:
-- the new site reports a town's guild halls as it walks in.
--
-- Mac: "Do it" (bible/11-Multiplayer/Chapters-Arc.md section 4, CHAP2a).
-- The law is src/net/npcChapterLaw.js; the service src/npcHalls.js and
-- src/professions.js.
--
-- THE WITNESSED HALL. A town's guild halls are witnessed as a seat is
-- (Seats-Arc 3.2): the kind `npchall`, keyed by the hall law's version
-- and the location's map id (`1:<mapId>` - AUDIT CHAP2 E7: a later rule
-- is a new version, never a split with the old answers), its report the
-- canonical `[mapId, region, factions]` - the twenty-two guild factions
-- the town keeps a hall of. The table is rebuilt to admit the kind, as
-- 0028, 0032 and 0048 rebuilt it.
CREATE TABLE IF NOT EXISTS world_witness_new (
  kind    TEXT NOT NULL CHECK (kind IN ('pixel', 'dungeon', 'hub', 'seat', 'npchall')),
  key     TEXT NOT NULL,
  account TEXT NOT NULL,
  report  TEXT NOT NULL,
  region  INTEGER,
  at      INTEGER NOT NULL,
  PRIMARY KEY (kind, key, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
INSERT INTO world_witness_new (kind, key, account, report, region, at)
  SELECT kind, key, account, report, region, at FROM world_witness;
DROP TABLE world_witness;
ALTER TABLE world_witness_new RENAME TO world_witness;
CREATE INDEX IF NOT EXISTS idx_world_witness_region ON world_witness (kind, region);

-- THE HALL WRIT. A chapter's writs ride the Court's table (0027): the kind
-- `hall`, its guild's faction (`faction`, 0 for the Court's), its slot
-- counted within the chapter - so the day's key is (day, region, kind,
-- faction, slot). Every fill, the three a day and the rid's uniqueness
-- stay the table's own, so a hall writ and a Court writ share the one
-- allowance (Chapters-Arc CALL 8). Rebuilt to admit the kind and the key;
-- no trigger, view or foreign key in any migration names either table.
CREATE TABLE IF NOT EXISTS writs_new (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('court', 'hall')),
  day         INTEGER NOT NULL,
  region      INTEGER NOT NULL,
  faction     INTEGER NOT NULL DEFAULT 0,
  slot        INTEGER NOT NULL,
  material    TEXT NOT NULL,
  tier        INTEGER NOT NULL,
  qty         INTEGER NOT NULL CHECK (qty >= 1),
  pay         INTEGER NOT NULL CHECK (pay >= 1),
  renown      INTEGER NOT NULL CHECK (renown >= 0),
  expires_at  INTEGER NOT NULL,
  filled_by   TEXT,
  filled_char TEXT,
  filled_at   INTEGER,
  rid         TEXT,
  n           TEXT,
  UNIQUE (day, region, kind, faction, slot)
);
INSERT INTO writs_new (id, kind, day, region, faction, slot, material, tier, qty, pay, renown, expires_at, filled_by, filled_char, filled_at, rid, n)
  SELECT id, kind, day, region, 0, slot, material, tier, qty, pay, renown, expires_at, filled_by, filled_char, filled_at, rid, n FROM writs;
DROP TABLE writs;
ALTER TABLE writs_new RENAME TO writs;
CREATE UNIQUE INDEX IF NOT EXISTS idx_writs_fill_rid ON writs (filled_by, rid) WHERE filled_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_writs_filled_day ON writs (filled_by, day);

-- AUDIT CHAP2 E1/S4: A HALL STRUCK. A town a developer finds false (the
-- audit list, npcHalls.js listHalls) is struck: its `npchall` reports go,
-- and the town is never witnessed again (as town_seat_history's 'strike'
-- keeps a seat's key) - the seats' moderator's door, which the halls
-- lacked.
CREATE TABLE IF NOT EXISTS npc_hall_strikes (
  map_id  INTEGER PRIMARY KEY,
  by      TEXT,
  at      INTEGER NOT NULL
);

-- AUDIT CHAP2 C1: THE CLAIM SEQUENCE. The head's `seq` moves on every write
-- (the guard a write stands under - a claim, a read's drain, a hall writ's
-- credit); `kseq` moves only when a claim credits a line the client sent.
-- A tab's kept adoption names `kseq` (npcRollTracker.js), so the service's
-- own credits (owed paid, a hall writ's +2), being purely additive, never
-- make the next page drop what its save held unclaimed.
ALTER TABLE npc_roll_heads ADD COLUMN kseq INTEGER NOT NULL DEFAULT 0;

-- THE DAY'S HALL WRITS, posted once: a region's chapters' writs are written down on the day's first read that finds a
-- chapter, as its Court writs are (writ_days) - a chapter confirmed after that posts from the next day.
CREATE TABLE IF NOT EXISTS hall_writ_days (
  day     INTEGER NOT NULL,
  region  INTEGER NOT NULL,
  posted  INTEGER NOT NULL,
  at      INTEGER NOT NULL,
  PRIMARY KEY (day, region)
);
