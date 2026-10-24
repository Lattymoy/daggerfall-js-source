-- STAFF-PANEL5-FREEZE (2026-10-22, mob of the staff panel, 03:05Z: "the player can only look around"; design doc "DFO Staff
-- Panel: design", Freeze player, and its weak spots): A STAFF FREEZE AND THE STAFF CHAT - a sanction of its own beside the
-- mute and the ban, and the private thread between a player and staff that a freeze opens (server-account/src/staffFreeze.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- them.
--
-- players.frozen_until  until when the account may only look around (epoch seconds); NULL or past for not frozen. Every
--                       relay token minted while it stands carries it (`fz`), so a reload never sheds it.
-- players.frozen_reason the reason the Admin gave, one line.
-- players.frozen_by     the staff member's account who made the last freeze or unfreeze ("Store who set each sanction").
-- players.frozen_at     when that act was made.
-- players.freeze_rev    a count of freeze acts on the account - a push marks only its own act live, never a newer one's.
-- players.freeze_live   1 once the relay's door took the order for the last act, 0 while it has not ("saved, not live
--                       yet": the panel says so and the minute's clock pushes a fresh order - Weak spots: "A failed push
--                       leaves a freeze or unfreeze unapplied"), NULL for an account never frozen.
ALTER TABLE players ADD COLUMN frozen_until INTEGER;
ALTER TABLE players ADD COLUMN frozen_reason TEXT;
ALTER TABLE players ADD COLUMN frozen_by TEXT;
ALTER TABLE players ADD COLUMN frozen_at INTEGER;
ALTER TABLE players ADD COLUMN freeze_rev INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN freeze_live INTEGER;
CREATE INDEX IF NOT EXISTS players_frozen ON players (frozen_until) WHERE frozen_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS players_freeze_unlive ON players (frozen_at) WHERE freeze_live = 0;

-- staff_chat_threads  ONE THREAD A PLAYER, keyed on the account id (Weak spots: "Staff chat members and threads are
--                     undefined"). A freeze opens it with the player in it; Talk opens one outside a freeze, and the
--                     player joins (`player_in` 1) on the first staff line. Closed (`closed_at`) by the unfreeze, or by
--                     staff for a Talk thread; opened again by the next freeze or Talk. `last_at` its newest line's time,
--                     `last_staff` 1 when that line was staff's (an unanswered player line sorts first).
-- staff_chat_lines    each line, stored here FIRST (Weak spots: "Freeze chat and Message on screen have nowhere to be
--                     stored") - the relay carries only a nudge. `staff` 1 for a staff member's line (`author` their
--                     account), 0 for the player's. Kept STAFF_LINES_KEEP_S (90 days, the privacy policy's word on case
--                     messages), then deleted by the hourly clock (cron.js staff-chat); the audit log names a line by its
--                     id and length, never its words.
CREATE TABLE IF NOT EXISTS staff_chat_threads (
  player     TEXT PRIMARY KEY,
  why        TEXT NOT NULL CHECK (why IN ('freeze', 'talk')),
  opened_at  INTEGER NOT NULL,
  opened_by  TEXT,
  player_in  INTEGER NOT NULL DEFAULT 0,
  closed_at  INTEGER,
  last_at    INTEGER NOT NULL,
  last_staff INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS staff_chat_threads_open ON staff_chat_threads (last_at) WHERE closed_at IS NULL;

-- `id` is the rowid - no AUTOINCREMENT, whose sequence table the schema does not carry (0126's mod_actions' reason);
-- it is the nudge's `sl` and the player's read cursor.
CREATE TABLE IF NOT EXISTS staff_chat_lines (
  id      INTEGER PRIMARY KEY,
  player  TEXT NOT NULL,
  at      INTEGER NOT NULL,
  author  TEXT NOT NULL,
  staff   INTEGER NOT NULL CHECK (staff IN (0, 1)),
  text    TEXT NOT NULL,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS staff_chat_lines_thread ON staff_chat_lines (player, id);
CREATE INDEX IF NOT EXISTS staff_chat_lines_at ON staff_chat_lines (at);
