-- ACC1c (2026-09-21, Mac: "I want email completely optional. Username
-- and Password will be the main thing for the account") - THE ACCOUNT
-- GROWS A CREDENTIAL.
--
-- Additive only. Registering is an UPGRADE IN PLACE of the guest row a
-- player already has, not a new account - which is why there is no new
-- table for "registered players" and why linking migrates nothing.
--
--   npx wrangler d1 execute daggerfall-accounts --remote \
--     --file=server-account/migrations/0002_passwords.sql

-- The credential. `pbkdf2-sha256$<iters>$<salt>$<hash>` - self-
-- describing, so the iteration count can be raised later and every
-- existing row still verifies under the count it was written with,
-- then gets rewritten on its owner's next correct login. A bare hash
-- column cannot be upgraded without logging everybody out.
ALTER TABLE players ADD COLUMN password TEXT;

-- THE ONE WAY BACK IN. Email is optional (Mac), so there is no address
-- to send a reset link to - a forgotten password would be a lost
-- account, and with it the cloud saves that are the only reason the
-- account exists. A code is minted at registration, SHOWN ONCE, and
-- stored here hashed exactly as the password is, because it is a
-- credential and not a hint.
--
-- Using it sets a new password AND MINTS A NEW CODE: a player who
-- spends their only way in and is left with none has simply had the
-- same cliff moved one step away.
ALTER TABLE players ADD COLUMN recovery_hash TEXT;

-- When the guest became a player. NULL for a guest, which is also how
-- `accountKind` could be derived - it is not, because the handle is
-- what the wall and the token actually read, and two answers to "is
-- this account registered" is one too many.
ALTER TABLE players ADD COLUMN registered_at INTEGER;

-- COMPLETELY OPTIONAL, and it means it: an account works forever
-- without one. It is here for the player who wants a second way back
-- in, and for nothing else - no newsletter, no verification wall, no
-- feature gated behind it.
ALTER TABLE players ADD COLUMN email TEXT;

-- ── THE THROTTLE ───────────────────────────────────────────────────
-- Passwords bring online guessing, which tokens did not. One row per
-- key ("login:<handle_lc>", "ip:<addr>"), reused each window by UPSERT,
-- so the table is bounded by the number of distinct ACTIVE keys rather
-- than by traffic. The table is `Lattymoy/fight-life-source`'s
-- `server/migrations/0006_rate_limits.sql` column for column - that
-- shape has been carrying a live service, and there is nothing to
-- improve on in three columns.
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0
);

-- A sweep can take anything whose window closed long ago.
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits (window_start);
