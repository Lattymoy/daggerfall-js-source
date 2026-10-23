-- STAFF-PANEL5-FEEDS (2026-10-22, design doc "DFO Staff Panel: design": Network bursts, Monster watch, Bot check, Server
-- load): THE RELAY'S STAFF FEEDS, KEPT - the players over a limit that the relay's rooms post once a window
-- (server-account/src/staffNet.js, server/src/staffFeeds.js), and each natural encounter's reaction
-- (server-account/src/staffReactions.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- them. No row is written until the relay's STAFF_NET_FEED_URL or REACTION_FEED_URL is set.

-- A room's window, once: a batch posted twice (a failed post sent again) is read once (its own id).
CREATE TABLE IF NOT EXISTS staff_net_batches (
  id TEXT PRIMARY KEY,         -- the batch's own, 16 hex
  at INTEGER NOT NULL,         -- when the service took it, s
  q TEXT NOT NULL,             -- the room
  span_s INTEGER NOT NULL,     -- the window's length, s (1 at least)
  ms INTEGER NOT NULL          -- 1: grantStrip was on, the monsters measured; 0: "not measured"
);
CREATE INDEX IF NOT EXISTS staff_net_batches_at ON staff_net_batches (at);

-- A player over a limit in one room's window (Network bursts): its frames and bytes, the busiest 10 s and minute, by kind
-- (server/src/staffFeedLaw.js NET_KINDS), what the meters refused, its junk, and its closes for "too many ...".
CREATE TABLE IF NOT EXISTS staff_net_rows (
  batch TEXT NOT NULL,
  at INTEGER NOT NULL,
  sub TEXT NOT NULL,
  frames INTEGER NOT NULL,
  bytes INTEGER NOT NULL,
  p10 INTEGER NOT NULL,
  pb10 INTEGER NOT NULL,
  p60 INTEGER NOT NULL,
  pb60 INTEGER NOT NULL,
  k_move INTEGER NOT NULL,
  k_act INTEGER NOT NULL,
  k_hit INTEGER NOT NULL,
  k_trade INTEGER NOT NULL,
  k_foe INTEGER NOT NULL,
  k_chat INTEGER NOT NULL,
  k_other INTEGER NOT NULL,
  refused INTEGER NOT NULL,
  junk INTEGER NOT NULL,
  closes INTEGER NOT NULL,
  close_why TEXT
);
CREATE INDEX IF NOT EXISTS staff_net_rows_at ON staff_net_rows (at);

-- A sender's monsters over a limit in one room's window (Monster watch): live ones it owns outdoors, split by kind, the
-- ones it hosts indoors ("host of N", never an owner), and the records the relay stripped.
CREATE TABLE IF NOT EXISTS staff_foe_rows (
  batch TEXT NOT NULL,
  at INTEGER NOT NULL,
  sub TEXT NOT NULL,
  owned INTEGER NOT NULL,
  hosted INTEGER NOT NULL,
  regular INTEGER NOT NULL,
  elite INTEGER NOT NULL,
  boss INTEGER NOT NULL,
  sea INTEGER NOT NULL,
  stripped INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS staff_foe_rows_at ON staff_foe_rows (at);

-- THE BOT CHECK: a natural encounter's reaction (mob, 04:47Z), kept REACT_KEEP_S (14 days) unless staff keep the account's
-- rows as evidence (`keep_until`). A row is one episode (`n` 1), or - once an hour's rows would pass what the hourly sweep
-- deletes - one player-hour's episodes together (id `h:<account>:<hour>`, `n` its episodes). Each time is a SUM over the
-- row's episodes beside how many had one (`*_n`), so an episode and a player-hour are read alike.
CREATE TABLE IF NOT EXISTS encounter_reactions (
  id TEXT PRIMARY KEY,         -- the batch's id and the episode's place in it, or h:<account>:<hour>
  sub TEXT NOT NULL,           -- the account
  at INTEGER NOT NULL,         -- the ask (the first's, for a player-hour), s
  kind TEXT NOT NULL,          -- enc or encr
  n INTEGER NOT NULL,          -- episodes
  members INTEGER NOT NULL,    -- the encounters' members, summed
  span_ms INTEGER NOT NULL,    -- the episodes' lengths, summed
  poses INTEGER NOT NULL,      -- poses heard
  p1 INTEGER NOT NULL DEFAULT 0, p1_n INTEGER NOT NULL DEFAULT 0,   -- ms to the first pose after the ask
  wd INTEGER NOT NULL DEFAULT 0, wd_n INTEGER NOT NULL DEFAULT 0,   -- ms to the weapon drawn
  ac INTEGER NOT NULL DEFAULT 0, ac_n INTEGER NOT NULL DEFAULT 0,   -- ms to the first swing, cast or arrow
  hk INTEGER NOT NULL DEFAULT 0, hk_n INTEGER NOT NULL DEFAULT 0,   -- ms to the first blow landed
  hu INTEGER NOT NULL DEFAULT 0, hu_n INTEGER NOT NULL DEFAULT 0,   -- ms to the first blow taken
  dd_n INTEGER NOT NULL DEFAULT 0,   -- deaths
  drawn INTEGER NOT NULL DEFAULT 0,  -- episodes begun with the weapon already drawn
  struck INTEGER NOT NULL DEFAULT 0, -- episodes struck before acting
  mv INTEGER NOT NULL DEFAULT 0,     -- decimetres moved in the first 3 s, summed
  tn INTEGER NOT NULL DEFAULT 0,     -- centiradians turned in the first 3 s, summed
  keep_until INTEGER                 -- staff keep it as evidence until then
);
CREATE INDEX IF NOT EXISTS encounter_reactions_sub ON encounter_reactions (sub, at);
CREATE INDEX IF NOT EXISTS encounter_reactions_at ON encounter_reactions (at);
-- A reaction batch, once: one sent again is read once - a player-hour's sums would count it twice.
CREATE TABLE IF NOT EXISTS reaction_batches (
  id TEXT PRIMARY KEY,         -- the batch's own, 16 hex
  at INTEGER NOT NULL          -- when the service took it, s
);
CREATE INDEX IF NOT EXISTS reaction_batches_at ON reaction_batches (at);
