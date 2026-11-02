-- DECOR-ACCESS: the door's words. A typed list (chosen_friends) is Friends.
-- party is the owner's party, stored the same way the list was.
CREATE TABLE decor_access_next (
  map_id       INTEGER NOT NULL,
  building_key INTEGER NOT NULL,
  piece_id     TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('storage', 'station')),
  mode         TEXT NOT NULL CHECK (mode IN ('private', 'guild', 'friends', 'party')),
  friends      TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (map_id, building_key, piece_id, kind)
);
INSERT INTO decor_access_next (map_id, building_key, piece_id, kind, mode, friends)
  SELECT map_id, building_key, piece_id, kind,
    CASE mode WHEN 'chosen_friends' THEN 'friends' ELSE mode END,
    friends
  FROM decor_access;
DROP TABLE decor_access;
ALTER TABLE decor_access_next RENAME TO decor_access;
