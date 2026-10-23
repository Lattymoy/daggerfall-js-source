-- STAFF-PANEL2 (2026-10-22, mob: "do all 6"; design doc "DFO Staff Panel: design", build step 2): THE PANEL'S CASES -
-- the open chat cases read most urgent first, and taken by one staff member at a time (server-account/src/staffCases.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- them (acct171).
--
-- A CLAIM (mob, 04:13Z: "admin can alwasy take a case", "mods can only take one"). `claimed_by` the staff member holding
-- the case, `claim_until` when the claim lets go by itself (30 minutes after the holder's last look or act on it), and
-- `claim_from` the member it was taken from, so a Moderator an Admin took a case from is told. `claimed_at` (0126) stays
-- what it was: the 60-second lock one Discord press takes; a press now also leaves a case another member holds in the
-- panel alone (discord.js onPress). A Moderator holds one open case at a time - checked in the statement that takes it.
ALTER TABLE mod_cases ADD COLUMN claimed_by TEXT;
ALTER TABLE mod_cases ADD COLUMN claim_until INTEGER;
ALTER TABLE mod_cases ADD COLUMN claim_from TEXT;
CREATE INDEX IF NOT EXISTS mod_cases_claimed ON mod_cases (claimed_by, claim_until) WHERE status = 'open' AND claimed_by IS NOT NULL;
