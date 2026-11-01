-- CLAUDE AS STAFF (src/claudeStaff.js, src/staffClaude.js, src/staffOrder.js). Claude only monitors and reports: nothing
-- here acts on a player.
--
-- claude_suggestions  what Claude found, one row each, for a member to accept or dismiss. `evidence` and `action` are JSON
--                     (the numbers and lines as stored; one existing staff act with its arguments). Accepting records the
--                     decision: the panel then runs the act under the deciding member's own session. A pending row for
--                     one kind and subject is never written twice.
-- claude_state        one row: when the sweep last ran.
-- staff_order_keys    a public key a member on CLAUDE_ORDER_HANDLES enrols from their own signed-in staff session, so an
--                     order signed outside the panel runs as that member. Bound to the account and the handle it was
--                     enrolled under, revoked and never deleted, at most two live per account.
--
-- The hourly job deletes suggestions older than 30 days. Claude's daily call count rides mod_ai_days under the key
-- '<day>:claude'.
CREATE TABLE IF NOT EXISTS claude_suggestions (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('report', 'bot-ring', 'net', 'monster', 'dupe', 'gains', 'hold', 'reactions')),
  subject     TEXT NOT NULL,
  case_id     TEXT,
  urgency     TEXT NOT NULL CHECK (urgency IN ('normal', 'urgent')),
  summary     TEXT NOT NULL,
  evidence    TEXT NOT NULL CHECK (json_valid(evidence)),
  action      TEXT CHECK (action IS NULL OR json_valid(action)),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  decided_by  TEXT,
  decided_at  INTEGER,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (subject) REFERENCES players(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS claude_suggestions_pending ON claude_suggestions (kind, subject) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS claude_suggestions_at ON claude_suggestions (created_at);

CREATE TABLE IF NOT EXISTS claude_state (
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  last_run  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_order_keys (
  id          TEXT PRIMARY KEY,
  player_id   TEXT NOT NULL,
  handle_lc   TEXT NOT NULL,
  pub         TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  last_ts     INTEGER NOT NULL DEFAULT 0,
  last_used   INTEGER,
  revoked_at  INTEGER,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS staff_order_keys_player ON staff_order_keys (player_id) WHERE revoked_at IS NULL;
