-- PROF1 (2026-09-28) - THE PROFESSIONS: tracks, the Stores, the day's harvests, the witnessed pixels and the Court writs.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "Life skills will utilize things like tree chopping, picking up
-- ingredients, fishing, etc. Active player involvement and actual UI
-- integration for life skills" (bible/06-Systems/Professions-Arc.md,
-- PROF0 14 and 22). The numbers are src/net/professionLaw.js and
-- src/net/nodeLaw.js; this is where the service keeps what they bound,
-- and server-account/src/professions.js is who may do what with it.
--
-- EVERY MOVE IS DECIDED BY ONE STATEMENT: a harvest by its row's INSERT
-- (the day's cap and the Stores' room inside it), a withdrawal by its
-- row's, a delivery by the writ's UPDATE - each writing a fresh nonce (`n`)
-- that the batch's other statements key on, so they follow a decision
-- this request made and never one an earlier request made (a retry that
-- finds its row answers `repeat`, and moves nothing).
--
-- A CHARACTER'S TRACK (`prof_tracks`): its XP, the specialisations it
-- chose at 50 and 100, and a paid change of one that takes effect at
-- `respec_at` (PROF0 3.3). The rank is never stored - it is the XP's.
CREATE TABLE IF NOT EXISTS prof_tracks (
  player      TEXT NOT NULL,
  char_id     TEXT NOT NULL,
  profession  TEXT NOT NULL,
  xp          INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0 AND xp <= 100000),
  spec50      TEXT,
  spec100     TEXT,
  respec_rank INTEGER CHECK (respec_rank IS NULL OR respec_rank IN (50, 100)),
  respec_to   TEXT,
  respec_at   INTEGER,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (player, char_id, profession),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);

-- THE STORES (`prof_stores` - PROF0 7: the player reads "the Stores", the
-- code says profStores): a character's materials, each unit own or
-- bought. At most 5,000 of a material (own and bought together - the
-- deciding statements hold it; the CHECK is the floor under them).
-- Nothing in a pack ever comes in (law 3); a row at 0 is deleted.
CREATE TABLE IF NOT EXISTS prof_stores (
  player   TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  material TEXT NOT NULL,
  origin   TEXT NOT NULL CHECK (origin IN ('own', 'bought')),
  qty      INTEGER NOT NULL CHECK (qty >= 0 AND qty <= 5000),
  PRIMARY KEY (player, char_id, material, origin),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);

-- THE DAY'S HARVESTS: a node taken once a day a character and a kind (an
-- herb patch gives its herbs and the Basket's food - two kinds), what it
-- gave, and the request that took it - (player, rid) answers a request
-- asked twice. Pruned two days on (PROF0 20).
CREATE TABLE IF NOT EXISTS node_harvests (
  day        INTEGER NOT NULL,
  node       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('herbs', 'food')),
  player     TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  profession TEXT NOT NULL,
  material   TEXT NOT NULL,
  qty        INTEGER NOT NULL CHECK (qty >= 1),
  xp         INTEGER NOT NULL CHECK (xp >= 0),
  at         INTEGER NOT NULL,
  rid        TEXT NOT NULL,
  n          TEXT NOT NULL,
  PRIMARY KEY (day, node, kind, player, char_id),
  UNIQUE (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_node_harvests_today ON node_harvests (player, char_id, profession, day);

-- A WITHDRAWAL TO THE PACK: the Stores' units out, the items the client
-- mints from the answer (the service never sees a pack). The row is the
-- request's own, so an answer lost is answered again with what it took.
CREATE TABLE IF NOT EXISTS prof_withdrawals (
  player   TEXT NOT NULL,
  rid      TEXT NOT NULL,
  char_id  TEXT NOT NULL,
  material TEXT NOT NULL,
  qty      INTEGER NOT NULL CHECK (qty >= 1),
  at       INTEGER NOT NULL,
  n        TEXT NOT NULL,
  PRIMARY KEY (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);

-- THE WITNESSED WORLD (SEAT0 3.2), its first kind: a map pixel's climate
-- and region, as the clients that derived them report them - one report
-- an account a pixel, from an account a week registered. What they add up
-- to is nodeLaw.js witnessedFact. `region` is the report's, kept as a
-- column so a region's ground is one indexed read (its Court writs).
-- SEAT1a adds the location and the gate day, `world_facts` and a
-- moderator's settling.
CREATE TABLE IF NOT EXISTS world_witness (
  kind    TEXT NOT NULL CHECK (kind IN ('pixel')),
  key     TEXT NOT NULL,
  account TEXT NOT NULL,
  report  TEXT NOT NULL,
  region  INTEGER,
  at      INTEGER NOT NULL,
  PRIMARY KEY (kind, key, account),
  FOREIGN KEY (account) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_world_witness_region ON world_witness (kind, region);

-- COURT WRITS (PROF0 11): a region's writs for a UTC day, written down
-- when the region's day is first read - how many (`active` then), and
-- each writ's ask and pay - so the day's writs never change under the
-- players filling them. A writ is filled whole, once: `filled_by` is
-- written by the one UPDATE that decides, and keeps no foreign key - a
-- writ an account filled stays filled if that account goes.
CREATE TABLE IF NOT EXISTS writ_days (
  day    INTEGER NOT NULL,
  region INTEGER NOT NULL,
  active INTEGER NOT NULL,
  posted INTEGER NOT NULL,
  at     INTEGER NOT NULL,
  PRIMARY KEY (day, region)
);
CREATE TABLE IF NOT EXISTS writs (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('court')),
  day         INTEGER NOT NULL,
  region      INTEGER NOT NULL,
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
  UNIQUE (day, region, slot)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_writs_fill_rid ON writs (filled_by, rid) WHERE filled_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_writs_filled_day ON writs (filled_by, day);
