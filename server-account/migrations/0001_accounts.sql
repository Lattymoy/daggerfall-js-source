-- ACC1b (2026-09-21) - THE ACCOUNT SERVICE'S FIRST TABLES: identity
-- alone. No saves, no provider links; those are ACC1c and ACC2, and
-- each arrives as its own migration rather than as a column somebody
-- added here later.
--
--   npx wrangler d1 execute daggerfall-accounts --remote \
--     --file=server-account/migrations/0001_accounts.sql
--
-- Applied by server-account/deploy, which runs every migration in
-- order and is idempotent (every statement is IF NOT EXISTS).

-- ── PLAYERS ────────────────────────────────────────────────────────
-- A row exists from a player's FIRST contact, guest or not. A guest is
-- not a lesser kind of account; it is an account with no provider
-- attached yet, which is the whole of ACC0's wall - and it is why
-- linking migrates nothing, the row was always theirs.
CREATE TABLE IF NOT EXISTS players (
  id          TEXT PRIMARY KEY,
  -- THE CHOSEN NAME, null until a player links and picks one. A guest
  -- never has one.
  handle      TEXT,
  -- ...and its case-folded key, which is what UNIQUE is actually on.
  -- `Nystul` and `NYSTUL` being two people is the same defect as
  -- forging one, only slower - and Fight Life's `handle` has no
  -- constraint at all, which is defensible for a name beside a ladder
  -- rating and is not defensible where the name IS the identity.
  handle_lc   TEXT,
  -- THE GENERATED NAME, minted once and KEPT. A name that changed every
  -- session would make "who was that?" unanswerable even inside one
  -- session, and a muted guest would be a stranger a minute later.
  -- Always exactly one space (server-account/src/guestName.js), which a
  -- chosen handle may never contain - so the two name spaces cannot
  -- overlap and no lookup is needed to keep them apart.
  guest_name  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL,
  -- ACC0's free mitigation: a guest is a real row, so a mute is a flag
  -- on it. Survives a refresh, not a storage clear - which is stated
  -- plainly in the arc rather than sold as moderation.
  muted_until INTEGER
);

-- The uniqueness that matters, and it is on the FOLDED column. Partial,
-- because every guest has a NULL handle_lc and SQLite would otherwise
-- have to hold them all as distinct NULLs in the index for nothing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_handle_lc
  ON players (handle_lc) WHERE handle_lc IS NOT NULL;

-- ── SESSIONS ───────────────────────────────────────────────────────
-- ONE CREDENTIAL PER DEVICE, MANY DEVICES PER PLAYER, which is the
-- lesson Fight Life paid for: one secret per player, rotated on
-- sign-in, made two devices mutually exclusive - signing in on a
-- desktop silently 401'd the phone on every write, and it was found by
-- playing rather than by reading.
--
-- Sign-out revokes THIS session. Every account system a player has
-- already used behaves that way; signing out of a laptop has never
-- dropped somebody's phone. "Everywhere" is a separate, explicit act.
CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL,
  -- The HASH. The raw secret is returned once, at mint, and is never
  -- stored - so a copy of this table is not a copy of anybody's
  -- credentials.
  secret_hash  TEXT NOT NULL,
  -- Free text, client-supplied, for the device list alone. NEVER
  -- trusted for anything: a device cannot be identified by what it
  -- calls itself, only by the secret it holds.
  device_label TEXT,
  created_at   INTEGER NOT NULL,
  last_seen    INTEGER NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- Every authed call resolves a session BY THE SECRET IT WAS HANDED, so
-- this is the hot path and it must be one indexed lookup. Fetching a
-- player's sessions and comparing hashes in code costs a compare per
-- device on every request, and needs the player id the caller has not
-- proved yet.
--
-- UNIQUE because two sessions sharing a hash would mean a collision in
-- 32 bytes of CSPRNG output; if it ever happened the write should fail
-- loudly rather than quietly hand one device another's session.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_secret ON sessions (secret_hash);

-- The device list, newest first.
CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions (player_id, last_seen DESC);
