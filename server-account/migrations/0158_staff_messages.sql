-- STAFF-PANEL5-MESSAGE (2026-10-22, mob, 04:14Z: a message in the middle of one player's screen; Moderators too, 06:28Z;
-- design doc "DFO Staff Panel: design", Message on screen): THE STAFF'S MESSAGES, stored before anything is sent
-- (server-account/src/staffMessage.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- it.
--
-- staff_messages  one row a message an Admin or Moderator sent one player (`target`, an account id - never a name), up to
--                 200 characters, one every 5 seconds a staff member. Stored FIRST (design doc, Weak spots: "Freeze chat
--                 and Message on screen have nowhere to be stored"): the relay hands the target's own sockets only a
--                 nudge naming `id`, and the game reads the words here with its own session. `staff_name` the name the
--                 player is shown, as it was when sent. `pushed` NULL while the relay's door is being asked, 1 when it
--                 took the order, 0 when it did not (no relay, refused, down). `sockets` how many of the target's sockets
--                 the hub handed the nudge (NULL: the door said no count), `old` how many it did not because their game
--                 cannot show it ("old game, not shown"). `ok_at` when the player's own game said they pressed OK - their
--                 game's word, never proof. Kept 30 days (STAFF_MESSAGE_KEEP_S, the hourly job: cron.js staff-messages) -
--                 the audit row names the message and never its words. No foreign keys: a row outlives the accounts
--                 it names until its sweep.
CREATE TABLE IF NOT EXISTS staff_messages (
  id         TEXT PRIMARY KEY,
  at         INTEGER NOT NULL,
  staff_id   TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  target     TEXT NOT NULL,
  text       TEXT NOT NULL,
  pushed     INTEGER,
  sockets    INTEGER,
  old        INTEGER,
  ok_at      INTEGER
);
-- each index ends in the rowid, so a staff member's newest, and a player's in the order they were sent, are one seek
CREATE INDEX IF NOT EXISTS staff_messages_staff ON staff_messages (staff_id);
CREATE INDEX IF NOT EXISTS staff_messages_target ON staff_messages (target);
CREATE INDEX IF NOT EXISTS staff_messages_at ON staff_messages (at);
