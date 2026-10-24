-- STAFF-PANEL3-DESK (2026-10-22, mob: the features picked at 04:13Z and 06:28Z; design doc "DFO Staff Panel: design"): THE
-- PANEL'S DESK - staff notes on a player, each staff member's own watchlist, and each staff member's own settings
-- (server-account/src/staffDesk.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- them.
--
-- staff_notes    A SHORT SHARED HISTORY ON ONE PLAYER (mob, 06:28Z: Moderators too): "warned in person 21 Oct", newest
--                first, written by any staff member and read by all. `author_name` the staff member's name as it stood
--                when they wrote it - no key on `author`, so a staff account gone keeps its notes. RETENTION: the newest
--                STAFF_NOTES_KEEP a player (the insert trims past it in the same batch), and the account's own go with it
--                (CASCADE). `id` is the rowid - no AUTOINCREMENT, whose sequence table the schema does not carry (0013's).
-- staff_watch    A STAFF MEMBER'S OWN WATCHLIST (mob, 04:13Z; 06:28Z: "their own"): at most STAFF_WATCH_MAX rows a
--                member, bounded inside the insert. Nothing writes here but the panel's own add and remove, and the
--                watch's events are read from what the service already records (logins, trades, sales, findings,
--                reports) - only from the open panel, never from a login, a trade or a checkpoint (design doc, Server
--                load). Either account gone takes the row.
-- staff_settings YOUR SETTINGS (mob, 03:24Z: "saved every time"): one JSON document a staff member, bounded and its keys
--                checked by staffDesk.js before it is written. Shared limits Admins set are kept elsewhere.
--
-- Two indexes for the panel's reads of mod_cases, which no route read this way before: a watched account's cases (its
-- reports, as events), and the cases staff decided (the AI check's scorecard, by when they were decided). Neither column
-- changes once written but `resolved_at`, once, so a case's hot updates (its counts, its reviewer's state) touch neither.
CREATE TABLE IF NOT EXISTS staff_notes (
  id          INTEGER PRIMARY KEY,
  target      TEXT NOT NULL,
  author      TEXT NOT NULL,
  author_name TEXT NOT NULL,
  text        TEXT NOT NULL,
  at          INTEGER NOT NULL,
  FOREIGN KEY (target) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS staff_notes_target ON staff_notes (target, id);

CREATE TABLE IF NOT EXISTS staff_watch (
  staff  TEXT NOT NULL,
  target TEXT NOT NULL,
  at     INTEGER NOT NULL,
  PRIMARY KEY (staff, target),
  FOREIGN KEY (staff) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (target) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS staff_settings (
  player TEXT PRIMARY KEY,
  doc    TEXT NOT NULL CHECK (json_valid(doc)),
  at     INTEGER NOT NULL,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS mod_cases_target ON mod_cases (target, opened_at);
CREATE INDEX IF NOT EXISTS mod_cases_decided ON mod_cases (resolved_at) WHERE resolved_at IS NOT NULL;
