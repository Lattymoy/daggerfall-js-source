-- NOTICE1 (2026-09-28) - THE NOTICE BOARD: players' notes, their reports, and the server's notices.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- Mac: "The new notice board should be a physical object that houses
-- quests, the player auction house, etc" (bible/06-Systems/
-- Professions-Arc.md 10, PROF0). A note's words are MAIL1's letter law
-- and the board's bounds are src/net/boardLaw.js; this is where they are
-- kept.
--
-- A NOTE IS PINNED TO A TOWN, not to one board: `map_id` is the town's
-- location map id (unsigned), so every rumour board in it shows the same
-- notes. An account's live notes are bounded (NOTES_LIVE_MAX) by the one
-- INSERT that writes one (server-account/src/board.js) - two pins racing
-- for the last place cannot both land. (author, rid) holds a request
-- asked twice to one note.
--
-- `hidden`: 0 shown; 1 hidden, because NOTE_REPORTS_HIDE readers
-- reported it, until a moderator decides; 2 restored by a moderator, so
-- reports no longer hide it. A moderator's removal deletes the row.
--
-- A RECRUITMENT NOTE (button 'guild') names its guild and the author's
-- character (`char_id`): pinned only by a rank that may invite (GUILD1's
-- GUILD_POWERS.invite), and read with its button only while that
-- character is still in that guild at such a rank (AUDIT 28 N4 - an
-- officer removed or demoted went on recruiting). A guild that is gone
-- leaves the note standing without its button (SET NULL).
--
-- CASCADE: an account that is gone takes its notes and its reports; a
-- note that is gone takes its reports. A server notice names the
-- developer who posted it but outlives them - it is the server's word;
-- (author, rid) holds a notice posted twice to one (AUDIT 28 N7).
-- Rows are deleted as they expire, on the board's own reads.
CREATE TABLE IF NOT EXISTS board_notes (
  id          TEXT PRIMARY KEY,
  map_id      INTEGER NOT NULL CHECK (map_id >= 0 AND map_id <= 4294967295),
  author      TEXT NOT NULL,
  author_name TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  button      TEXT CHECK (button IS NULL OR button IN ('party', 'guild', 'duel')),
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
-- a town's notes, newest first; an author's live count; the expiry sweep
CREATE INDEX IF NOT EXISTS idx_board_notes_map ON board_notes (map_id, at);
CREATE INDEX IF NOT EXISTS idx_board_notes_author ON board_notes (author, expires_at);
CREATE INDEX IF NOT EXISTS idx_board_notes_expires ON board_notes (expires_at);

CREATE TABLE IF NOT EXISTS board_reports (
  note_id  TEXT NOT NULL,
  reporter TEXT NOT NULL,
  at       INTEGER NOT NULL,
  PRIMARY KEY (note_id, reporter),
  FOREIGN KEY (note_id) REFERENCES board_notes(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS board_notices (
  id          TEXT PRIMARY KEY,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  author      TEXT,
  author_name TEXT NOT NULL,
  at          INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  rid         TEXT NOT NULL,
  UNIQUE (author, rid)
);
CREATE INDEX IF NOT EXISTS idx_board_notices_expires ON board_notices (expires_at);
