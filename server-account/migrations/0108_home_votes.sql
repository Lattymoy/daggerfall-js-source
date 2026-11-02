-- HOME-VOTE (2026-10-10, the owner: "I want to implement a house voting system within vicinity of player houses. If the
-- house votes run negative, the exterior decorations/interior decorations should not be shown to other players"):
-- A TOWN'S WORD ON A PLAYER'S HOUSE (src/net/homeVoteLaw.js, server-account/src/homeVotes.js).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- One row an account's vote on one online home (a guild's hall among them): `vote` -1 or +1, taken back by deleting
-- the row. The votes go with the home's row - sold, released, or moved by the arena (whose move writes the home under
-- its new key and deletes the old row, so a moved home starts again from none) - through the cascade, and with the
-- voting account. A line's heir taking up a fallen member's home keeps its row, and its votes.
CREATE TABLE IF NOT EXISTS home_votes (
  map_id       INTEGER NOT NULL,
  building_key INTEGER NOT NULL,
  player       TEXT NOT NULL,
  vote         INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  voted_at     INTEGER NOT NULL,
  PRIMARY KEY (map_id, building_key, player),
  FOREIGN KEY (map_id, building_key) REFERENCES homes(map_id, building_key) ON DELETE CASCADE,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);

-- AUDIT HOME-VOTE A2: A HOME'S SCORE IS KEPT ON ITS OWN ROW. Summed at every town read (homes.js homesInTown, every
-- client of a town once a minute and at every forced read), each home's votes were rows read - the shape YARD-SHED
-- measured at 131 million a day. The database keeps the sum as the votes move, as STORM-SHED 2 keeps `homes_gen`; a
-- town read is its rows again. An arena move writes its new row without it (homes.js HOME_MOVE_CARRIED) - the votes
-- went with the old row.
ALTER TABLE homes ADD COLUMN score INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER IF NOT EXISTS home_votes_cast AFTER INSERT ON home_votes
BEGIN
  UPDATE homes SET score = score + NEW.vote WHERE map_id = NEW.map_id AND building_key = NEW.building_key;
END;
CREATE TRIGGER IF NOT EXISTS home_votes_turned AFTER UPDATE OF vote ON home_votes
BEGIN
  UPDATE homes SET score = score - OLD.vote + NEW.vote WHERE map_id = NEW.map_id AND building_key = NEW.building_key;
END;
CREATE TRIGGER IF NOT EXISTS home_votes_gone AFTER DELETE ON home_votes
BEGIN
  UPDATE homes SET score = score - OLD.vote WHERE map_id = OLD.map_id AND building_key = OLD.building_key;
END;
