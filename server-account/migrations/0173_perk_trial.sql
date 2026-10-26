-- PERK-TRIAL (2026-10-24) - A SPECIALISATION IS TRIED, AND A CHANGE LANDS AT ONCE.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI).
--
-- The Discord's feature-feedback, "The time limit of a profession's
-- perks changing" (marbletoff): "1k silver + week wait is too
-- punishing ... the effects of some of the perks can be properly
-- understood only after trying" - asking for a free change for a day
-- after a pick, and the week as a lock after a change rather than a
-- wait for it. The owner picked both (bible/06-Systems/Professions-Arc.md
-- PERK-TRIAL; src/net/professionLaw.js SPEC_TRIAL_S, RESPEC):
--
--   - `spec50_at`, `spec100_at`: when the rank's choice standing was
--     made (its first, or a paid change) - its trial runs a day from it,
--     a change inside it free and at once. A choice made before this
--     takes its time from its own row (below); one with none stays
--     empty - its day is long out.
--   - `respec_at` is the lock's end now - the track's next paid change
--     waits until it - and `respec_to` stays empty: a change is written
--     to its rank at once.
--
-- A CHANGE ON ITS WAY, LANDED NOW: a change bought before this, still
-- waiting its week, takes its rank's place at once; the week it was
-- waiting stands as the lock, and its trial starts now - its buyer paid
-- to try it and has not yet. One already in effect is folded with no
-- trial and no lock (specsAt read it as standing already).

ALTER TABLE prof_tracks ADD COLUMN spec50_at INTEGER;
ALTER TABLE prof_tracks ADD COLUMN spec100_at INTEGER;

-- AUDIT PERK-TRIAL P7: A CHOICE MADE BEFORE THIS, its time from its own row - a first choice (and the merge's free
-- change) keeps one in `prof_choices`, so one made in the day before the migration has the rest of its day of trial,
-- as one made a minute after it has; an older one's day is out already.
UPDATE prof_tracks SET
    spec50_at = (SELECT MAX(c.at) FROM prof_choices c WHERE c.player = prof_tracks.player AND c.char_id = prof_tracks.char_id
      AND c.profession = prof_tracks.profession AND c.rank = 50 AND c.spec = prof_tracks.spec50),
    spec100_at = (SELECT MAX(c.at) FROM prof_choices c WHERE c.player = prof_tracks.player AND c.char_id = prof_tracks.char_id
      AND c.profession = prof_tracks.profession AND c.rank = 100 AND c.spec = prof_tracks.spec100);

UPDATE prof_tracks SET
    spec50 = CASE WHEN respec_rank = 50 THEN respec_to ELSE spec50 END,
    spec100 = CASE WHEN respec_rank = 100 THEN respec_to ELSE spec100 END,
    spec50_at = CASE WHEN respec_rank = 50 AND respec_at > CAST(strftime('%s', 'now') AS INTEGER) THEN CAST(strftime('%s', 'now') AS INTEGER) ELSE spec50_at END,
    spec100_at = CASE WHEN respec_rank = 100 AND respec_at > CAST(strftime('%s', 'now') AS INTEGER) THEN CAST(strftime('%s', 'now') AS INTEGER) ELSE spec100_at END,
    respec_rank = CASE WHEN respec_at > CAST(strftime('%s', 'now') AS INTEGER) THEN respec_rank ELSE NULL END,
    respec_at = CASE WHEN respec_at > CAST(strftime('%s', 'now') AS INTEGER) THEN respec_at ELSE NULL END,
    respec_to = NULL
  WHERE respec_to IS NOT NULL;
