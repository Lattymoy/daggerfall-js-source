-- STAFF-PANEL2-FIX (2026-10-22; design doc "DFO Staff Panel: design", Weak spots "Sanctions, cases and roles" and "Panel
-- Mute and Ban have no route"): THE CASES' AND SANCTIONS' GAPS, closed in the code every door shares - the staff panel
-- (staffCases.js), the game's moderators (index.js /v1/mod/*) and Discord's buttons (discord.js), all through safety.js
-- modAct.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that reads
-- them.
--
-- A CASE HAS A KIND (Weak spots: "Spawn cases share one case with chat reports"). `kind` 'chat' (reports, the reviewer's
-- feed) or 'spawn' (the spawn grants' count, grants.js) - ONE OPEN CASE AN ACCOUNT A KIND (mod_cases_open, rebuilt on
-- both). A case the spawn grants alone opened (no report, every line under the `grant` tab) is a spawn case. Moderators
-- see and act on chat cases only; Admins on both.
-- ONE CASE, ONE SANCTION (Weak spots: "One case can give two strikes"). `act_click` the one press that took the case for
-- its act and `act_at` when: taken in the statement that checks none took it first, so a second Mute or Ban on the
-- same case - from any door - is refused, and the same press sent again is answered as the first.
-- A CLAIM ENDS WITH ITS SESSION (Weak spots: "a claim ends with the claimer's session"). `claim_session` the staff
-- session (staff_sessions.token_hash) that took or last kept the claim; the claim stands only while that session lives.
--
-- mod_actions.click   the one-time id of the press that made the act - a press sent twice is one act: UNIQUE
--                     (mod_actions_click), so two sent at once with no case to take strike once, the second's record
--                     refused (the flaw review of PR 1: a plain index let both write a strike).
-- players.banned_by   who set the ban that stands (`muted_by`, MOD1's, says who set the mute).
-- players.mute_admin, players.ban_admin   1 when an Admin set the mute or ban that stands (Weak spots: "A Moderator
--                     can lift an Admin's ban") - lifting or shortening it then needs an Admin.
-- players.staff_suspended   1 for a staff member an owner cut off (Weak spots: "Cutting off a staff member misses most
--                     doors"): no role while it stands - not in the panel, not at the game's /v1/mod doors, not in
--                     Discord, no staff glyph on a token. An owner's new invite lifts it.
ALTER TABLE mod_cases ADD COLUMN kind TEXT NOT NULL DEFAULT 'chat' CHECK (kind IN ('chat', 'spawn'));
ALTER TABLE mod_cases ADD COLUMN act_click TEXT;
ALTER TABLE mod_cases ADD COLUMN act_at INTEGER;
ALTER TABLE mod_cases ADD COLUMN claim_session TEXT;
UPDATE mod_cases SET kind = 'spawn' WHERE source = 'review' AND reports = 0
  AND EXISTS (SELECT 1 FROM mod_case_lines l WHERE l.case_id = mod_cases.id AND l.tab = 'grant')
  AND NOT EXISTS (SELECT 1 FROM mod_case_lines l WHERE l.case_id = mod_cases.id AND l.tab != 'grant');
DROP INDEX IF EXISTS mod_cases_open;
CREATE UNIQUE INDEX IF NOT EXISTS mod_cases_open ON mod_cases (target, kind) WHERE status = 'open';

ALTER TABLE mod_actions ADD COLUMN click TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS mod_actions_click ON mod_actions (click) WHERE click IS NOT NULL;

ALTER TABLE players ADD COLUMN banned_by TEXT;
ALTER TABLE players ADD COLUMN mute_admin INTEGER;
ALTER TABLE players ADD COLUMN ban_admin INTEGER;
ALTER TABLE players ADD COLUMN staff_suspended INTEGER NOT NULL DEFAULT 0;
