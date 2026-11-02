-- RENOWN-ACCOUNT (2026-09-28) - ONE RENOWN AN ACCOUNT.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). It rides REALM's undeployed acct19, after
-- 0020's census.
--
-- Mac: "can you make sure renown is account based and not character
-- based?" Renown was one track a CHARACTER (0009's renown_tracks, keyed
-- (player, char_id)); now it is one track an ACCOUNT, and every read and
-- write of it - a report, a raid's claim, the token's level, a guild's
-- founding, the account card - is this table's (server-account/src/
-- renownTracks.js). A character the account plays, new or old, stands at
-- the account's Renown.
--
-- ═══ WHY A TABLE OF ITS OWN ════════════════════════════════════════
--
-- Not a reserved char_id in renown_tracks, for three reasons:
--   1. NO CHARACTER'S ACT CAN REACH IT. realm.js walks renown_tracks by
--      char_id as a character's online life (CHARACTER_TABLES): customs
--      re-keys a character's rows to its realm id, and a deleted realm
--      character's rows are deleted with it. A table with no char_id
--      column is outside every such statement by its SHAPE - a sentinel
--      row would be safe only for as long as no id ever matched it.
--   2. renown_tracks STAYS CHARACTERS ONLY, so everything that reads it
--      as characters still does: 0020's realm census ("the characters
--      that played online before the realm") and realm.js's walks.
--   3. THE KEY IS THE LAW. PRIMARY KEY (player) is "one Renown an
--      account" itself: a second track for an account cannot be written,
--      so no bound on tracks is needed (RENOWN_TRACKS_MAX is gone) and no
--      count of them can be wrong.
--
-- ═══ WHAT EACH ACCOUNT STARTS AT ═══════════════════════════════════
--
-- ITS BEST CHARACTER'S: the most XP any ONE of its tracks holds - MAX,
-- never SUM - so nobody loses progress and alts do not stack. An account
-- whose tracks hold nothing gets no row (DATA-7's law: a track only with
-- XP to hold). `last_rid` is the id of the report the account last took
-- (its most recently earned track's), so a report in flight across the
-- deploy, sent again because its answer was lost, is answered as a
-- repeat rather than credited again. The level is still never a column:
-- it is derived from `xp` by the one curve (src/net/renown.js).
--
-- ═══ renown_tracks IS HISTORY NOW ══════════════════════════════════
--
-- Its rows stay as they stand - what each character had earned when
-- Renown became the account's - and nothing writes them again. The
-- census 0020 took from them stands; realm.js still carries a
-- character's row to its realm id and deletes it with the character, and
-- neither can move this table.
--
-- The account row goes, and its Renown goes with it (CASCADE).
CREATE TABLE IF NOT EXISTS renown_accounts (
  player     TEXT PRIMARY KEY,
  xp         INTEGER NOT NULL DEFAULT 0,
  last_rid   TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
INSERT OR IGNORE INTO renown_accounts (player, xp, last_rid, created_at, updated_at)
  SELECT t.player, MAX(t.xp),
    (SELECT r.last_rid FROM renown_tracks r WHERE r.player = t.player ORDER BY r.updated_at DESC, r.char_id LIMIT 1),
    MIN(t.created_at), MAX(t.updated_at)
  FROM renown_tracks t
  GROUP BY t.player
  HAVING MAX(t.xp) > 0;
