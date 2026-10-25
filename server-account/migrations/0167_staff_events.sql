-- STAFF-EVENT (2026-10-24, mob: "lets start making an event tool for staff to use"): THE STAFF EVENTS, stored before the
-- relay is told (server-account/src/staffEvents.js; bible/11-Multiplayer/Staff-Events.md).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- it.
--
-- staff_events  one row an event an Admin staged on the Staff Panel. `ev` the event as signed (net/staffEvent/
--               staffEventLaw.js validStaffEvent's shape: the place, the monsters, how many, the meter, the mini boss).
--               `state` 'starting' while the relay's door is asked, 'live' once the hub took it, 'failed' when it did not,
--               'ended' once staff ended it or the hub's book no longer named it. `ended_by` 'staff', 'game' (its boss fell,
--               its clock, its last monster) or the hub's refusal. `kills` and `boss` the last meter the service heard from
--               the hub ('none', 'due', 'up', 'fallen'). `top` the board at its boss's fall (JSON, [name, kills, killer]
--               rows, the top fighters), once the hub told it. Kept 30 days (STAFF_EVENT_KEEP_S, the hourly job: cron.js
--               staff-events). No foreign keys: a row outlives the account it names until its sweep.
CREATE TABLE IF NOT EXISTS staff_events (
  id         TEXT PRIMARY KEY,
  at         INTEGER NOT NULL,
  staff_id   TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  ev         TEXT NOT NULL,
  state      TEXT NOT NULL,
  ended_at   INTEGER,
  ended_by   TEXT,
  kills      INTEGER NOT NULL DEFAULT 0,
  boss       TEXT NOT NULL DEFAULT 'none',
  top        TEXT
);
CREATE INDEX IF NOT EXISTS staff_events_state ON staff_events (state);
CREATE INDEX IF NOT EXISTS staff_events_at ON staff_events (at);
