-- REST-GUEST (FIELD BUGS 2026-10-29b): who besides its owner may rest in a home - the home's own row, kind 'rest', its
-- piece id the home's (src/net/decorLaw.js DECOR_REST_ID), friends and party stored as a chest's are. The kind's CHECK
-- widened; every row carried as it stood. A sale, a transfer and a move already clear the home's rows.
CREATE TABLE decor_access_next (
  map_id       INTEGER NOT NULL,
  building_key INTEGER NOT NULL,
  piece_id     TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('storage', 'station', 'rest')),
  mode         TEXT NOT NULL CHECK (mode IN ('private', 'guild', 'friends', 'party')),
  friends      TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (map_id, building_key, piece_id, kind)
);
INSERT INTO decor_access_next (map_id, building_key, piece_id, kind, mode, friends)
  SELECT map_id, building_key, piece_id, kind, mode, friends FROM decor_access;
DROP TABLE decor_access;
ALTER TABLE decor_access_next RENAME TO decor_access;
