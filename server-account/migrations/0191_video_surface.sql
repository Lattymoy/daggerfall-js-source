-- VIDEO1: synchronized video surfaces on home paintings (bible/11-Multiplayer/Video-Surfaces.md).
-- Config lives apart from decor geometry. Rows die with the piece (app cascade on remove).
CREATE TABLE IF NOT EXISTS home_video_surface (
  map_id                INTEGER NOT NULL,
  building_key          INTEGER NOT NULL,
  piece_id              TEXT    NOT NULL,
  provider              TEXT    NOT NULL,
  source_id             TEXT    NOT NULL,
  status                TEXT    NOT NULL,
  base_position_seconds REAL    NOT NULL DEFAULT 0,
  server_started_at     INTEGER,
  updated_at            INTEGER NOT NULL,
  revision              INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (map_id, building_key, piece_id)
);
CREATE INDEX IF NOT EXISTS idx_home_video_home ON home_video_surface (map_id, building_key);
