-- One player at a chest. The row is theirs until they close it, or until it expires.
CREATE TABLE IF NOT EXISTS decor_hold (
  map_id       INTEGER NOT NULL,
  building_key INTEGER NOT NULL,
  piece_id     TEXT NOT NULL,
  player       TEXT NOT NULL,
  char_id      TEXT NOT NULL,
  until        INTEGER NOT NULL,
  PRIMARY KEY (map_id, building_key, piece_id)
);
