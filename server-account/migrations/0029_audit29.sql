-- AUDIT 29 (2026-09-28, Mac: "Lets audit everything so far before we continue") - THE PROFESSIONS' SERVICE, AS THE
-- AUDIT FOUND IT (bible/06-Systems/Online-Arc.md AUDIT 29; bible/06-Systems/Professions-Arc.md 22 and 23).

-- A DUNGEON NOBODY HAS VOUCHED FOR (A5): a dungeon's id is the client's word, and a dungeon not confirmed is worth its
-- least - Silver, tier 3, at any hour - which was more than any unconfirmed pixel gives. Such a harvest is marked, and
-- an account works DEEP_UNCONFIRMED_PER_DAY of them a UTC day (professionLaw.js), counted in the harvest's own INSERT.
-- A column added: SQLite adds one without building the table again, and every row before it was no such harvest.
ALTER TABLE node_harvests ADD COLUMN deep_unconfirmed INTEGER NOT NULL DEFAULT 0 CHECK (deep_unconfirmed IN (0, 1));
-- the account's day (A3) and the unconfirmed deep veins' count read by player and day
CREATE INDEX IF NOT EXISTS idx_node_harvests_account ON node_harvests (player, day, profession);

-- A FREE FIRST SPECIALISATION (A13) - a request like any other: its row, found by its id before the switch is asked,
-- so a choice made is answered as made; its nonce the track's change keys on (the house law, one statement decides).
-- A paid change keeps its line in the Marks ledger, as ever.
CREATE TABLE IF NOT EXISTS prof_choices (
  player     TEXT NOT NULL,
  rid        TEXT NOT NULL,
  char_id    TEXT NOT NULL,
  profession TEXT NOT NULL,
  rank       INTEGER NOT NULL CHECK (rank IN (50, 100)),
  spec       TEXT NOT NULL,
  at         INTEGER NOT NULL,
  n          TEXT NOT NULL,
  PRIMARY KEY (player, rid),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
