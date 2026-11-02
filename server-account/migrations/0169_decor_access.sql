-- DECOR-ACCESS: who may use one container or one station, and the goods a shared container holds.
-- No row is private (the owner). Existing houses gain nothing and lose nothing.
CREATE TABLE IF NOT EXISTS decor_access (
  map_id       INTEGER NOT NULL,
  building_key INTEGER NOT NULL,
  piece_id     TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('storage', 'station')),
  mode         TEXT NOT NULL CHECK (mode IN ('private', 'guild', 'chosen_friends')),
  friends      TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (map_id, building_key, piece_id, kind)
);
CREATE TABLE IF NOT EXISTS decor_bin (
  map_id       INTEGER NOT NULL,
  building_key INTEGER NOT NULL,
  piece_id     TEXT NOT NULL,
  uid          TEXT NOT NULL,
  item         TEXT NOT NULL,
  PRIMARY KEY (map_id, building_key, piece_id, uid)
);
