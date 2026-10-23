-- STAFF-PANEL1 (2026-10-22, mob: "a staff admin panel", design doc "DFO Staff Panel: design", build step 1): THE STAFF PANEL'S
-- SIGN-IN - the password, a key only the staff member's own copy of the staff panel extension holds, and the role lists -
-- and a short staff session, beside the game's own sessions and never one of them (server-account/src/staff.js says why).
-- mob, 06:18Z: "lets get rid of asuthernticator for now", "and we will do just password and extension".
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- players.staff_mod  1 for a Moderator an Admin added from the panel (mob, 07:42Z: "add it so admins can add or remove
--                 moderatoers") - beside MODERATOR_HANDLES, which names the config's own. The account's, not its handle's.
-- staff_keys      an extension's Ed25519 public key, registered to one account with an owner's invite (an owner's
--                 first key is named in the config, OWNER_KEYS). Bound to the handle it was registered under - a rename
--                 (0134) leaves it behind, so a handle a role list names is never enough on its own. `last_ts` the newest
--                 signed second the key signed in with: a signature works once. `cfg` 1 for an owner's key the config
--                 names (OWNER_KEYS), good only while the config still names it. `revoked_at` when it was forgotten or
--                 cut: the row stays, so a revoked key - a config key too - never signs in again, and its spent seconds stay
--                 spent.
-- staff_invites   a one-time code an owner hands a staff member to register their extension (24 h), kept as its hash.
-- staff_sessions  the panel's session, kept as its hash: 30 minutes idle, 8 hours at most, and dead with its key.
-- staff_audit     every sign-in, refusal and staff act, and whether it was done (`outcome` ok), refused by a role's door
--                 (denied) or changed nothing (failed). APPEND-ONLY for 30 days (mob, 12:12Z: "only keep for one month"):
--                 the triggers below refuse an UPDATE, and a DELETE of a row newer, so no route, and no staff member
--                 through one, can edit what was done; past it the hourly job deletes it (cron.js staff-audit). No
--                 foreign keys - a row outlives the accounts it names.
CREATE TABLE IF NOT EXISTS staff_keys (
  id         TEXT PRIMARY KEY,
  player_id  TEXT NOT NULL,
  handle_lc  TEXT NOT NULL,
  pub        TEXT NOT NULL UNIQUE,
  label      TEXT,
  created_at INTEGER NOT NULL,
  last_ts    INTEGER NOT NULL DEFAULT 0,
  last_used  INTEGER,
  cfg        INTEGER NOT NULL DEFAULT 0,
  revoked_at INTEGER,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS staff_keys_player ON staff_keys (player_id);

CREATE TABLE IF NOT EXISTS staff_invites (
  code_hash  TEXT PRIMARY KEY,
  player_id  TEXT NOT NULL,
  by_id      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS staff_invites_player ON staff_invites (player_id);

CREATE TABLE IF NOT EXISTS staff_sessions (
  token_hash TEXT PRIMARY KEY,
  player_id  TEXT NOT NULL,
  key_id     TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_act   INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS staff_sessions_player ON staff_sessions (player_id);
CREATE INDEX IF NOT EXISTS staff_sessions_key ON staff_sessions (key_id);

-- `id` is the rowid - no AUTOINCREMENT (0126's mod_actions' reason); it orders two rows in one second.
CREATE TABLE IF NOT EXISTS staff_audit (
  id         INTEGER PRIMARY KEY,
  at         INTEGER NOT NULL,
  actor      TEXT,
  actor_name TEXT,
  role       TEXT,
  act        TEXT NOT NULL,
  target     TEXT,
  detail     TEXT,
  key_id     TEXT,
  outcome    TEXT NOT NULL DEFAULT 'ok' CHECK (outcome IN ('ok', 'denied', 'failed'))
);
CREATE INDEX IF NOT EXISTS staff_audit_at ON staff_audit (at);
CREATE INDEX IF NOT EXISTS staff_audit_actor ON staff_audit (actor, at);
CREATE INDEX IF NOT EXISTS staff_audit_target ON staff_audit (target, at);
CREATE TRIGGER IF NOT EXISTS staff_audit_no_update BEFORE UPDATE ON staff_audit
BEGIN SELECT RAISE(ABORT, 'staff_audit is append-only'); END;
-- 2588400: STAFF_AUDIT_KEEP_S (staff.js) less an hour, for the Worker's clock against the database's
-- (test/server/staffpanel1.test.js holds the two to each other)
CREATE TRIGGER IF NOT EXISTS staff_audit_no_delete BEFORE DELETE ON staff_audit
WHEN OLD.at > CAST(strftime('%s', 'now') AS INTEGER) - 2588400
BEGIN SELECT RAISE(ABORT, 'staff_audit is append-only for 30 days'); END;

ALTER TABLE players ADD COLUMN staff_mod INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS players_staff_mod ON players (staff_mod) WHERE staff_mod = 1;
