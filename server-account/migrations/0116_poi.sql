-- POI-1 (2026-10-14, Mac: "POI Tool (General Map Editor) - Realtime editor ... a tool my developers can use without
-- having to access the codebase"; asked who publishes: "I need to be able to approve changes").
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- THE POI STORE (server-account/src/poi.js; bible/06-Systems/POI-Editor-Arc.md). A POI is a document (src/poi/poiLaw.js)
-- and the assets it names by sha256 (meshes, src/poi/poiMesh.js; textures, src/poi/poiImage.js) - the documents here, the
-- assets' bytes in R2 under `poi/a/<sha>`, their facts here.
--
-- EVERY CHANGE IS A REVISION AND NONE REACHES A PLAYER UNAPPROVED. A builder saves drafts and submits one; an approver
-- (APPROVER_HANDLES) approves or rejects it; an approved revision becomes the POI's LIVE one, and only live revisions are
-- in the feed the game reads. Taking a POI out of the world is a revision too (`kind` 'retire'), approved the same way.
-- Nothing is deleted: the history is the record of who changed what, and a rollback points `live_rev` at an earlier
-- approved revision - a revision of its own beside it, its approver its author (AUDIT POI S14).

CREATE TABLE IF NOT EXISTS poi_docs (
  id          TEXT PRIMARY KEY,               -- poi-<12 hex> (poiLaw.js POI_ID_RE)
  created_by  TEXT NOT NULL,                  -- players.id
  created_at  INTEGER NOT NULL,
  live_rev    INTEGER,                        -- the approved revision in the world; NULL: none (never approved, or retired)
  live_at     INTEGER,
  live_by     TEXT                            -- the approver who set it
);

CREATE TABLE IF NOT EXISTS poi_revs (
  poi_id      TEXT NOT NULL REFERENCES poi_docs(id),
  rev         INTEGER NOT NULL,               -- 1, 2, ... per POI
  kind        TEXT NOT NULL DEFAULT 'doc',    -- 'doc' (stand this document), 'retire' (take the POI out of the world) or
                                              -- 'rollback' (AUDIT POI S14: an approver put `base_rev` back in the world - the record of it)
  doc         TEXT,                           -- the document as JSON (NULL for a retirement and a rollback)
  doc_sha     TEXT,                           -- AUDIT POI S1: sha256 hex of `doc` as stored, written with it - what an approver's word names
  name        TEXT,                           -- AUDIT POI S3: the document's name and map pixel, written with it, for the list
  px          INTEGER,
  py          INTEGER,
  base_rev    INTEGER,                        -- the revision it was made from (NULL for a first draft); a rollback's, the one put back
  author      TEXT NOT NULL,                  -- players.id
  author_name TEXT NOT NULL,                  -- the handle, as it was
  at          INTEGER NOT NULL,               -- last saved
  state       TEXT NOT NULL,                  -- 'draft' | 'submitted' | 'approved' | 'rejected' | 'withdrawn' (taken back by its author, AUDIT POI S14)
  submitted_at INTEGER,
  reviewer    TEXT,                           -- players.id of the approver who decided
  reviewer_name TEXT,
  reviewed_at INTEGER,
  note        TEXT,                           -- the reviewer's word
  decision    TEXT,                           -- AUDIT POI S1: the deciding request's own mark - its batch's later writes are that decision's alone
  PRIMARY KEY (poi_id, rev)
);
CREATE INDEX IF NOT EXISTS poi_revs_state ON poi_revs (state, submitted_at);
-- AUDIT POI S10: a builder's open revisions counted at every new one
CREATE INDEX IF NOT EXISTS poi_revs_author ON poi_revs (author, state);
-- AUDIT POI S8: ONE OPEN DRAFT PER AUTHOR PER POI and ONE RETIREMENT WAITING PER POI, held by the database - two saves or
-- two asks at once meet here, and the second is told so, never stored beside the first
CREATE UNIQUE INDEX IF NOT EXISTS poi_revs_one_draft ON poi_revs (poi_id, author) WHERE state = 'draft' AND kind = 'doc';
CREATE UNIQUE INDEX IF NOT EXISTS poi_revs_one_retire ON poi_revs (poi_id) WHERE state = 'submitted' AND kind = 'retire';

-- AUDIT POI S4: THE ASSETS EACH APPROVED REVISION NAMES, written as it is approved - so whether an asset is live (named by
-- a POI's live revision) is asked of the database at every approval, retirement and rollback, and an asset no live
-- revision names any more is a builder's again
CREATE TABLE IF NOT EXISTS poi_rev_assets (
  poi_id      TEXT NOT NULL,
  rev         INTEGER NOT NULL,
  sha         TEXT NOT NULL,
  PRIMARY KEY (poi_id, rev, sha)
);
CREATE INDEX IF NOT EXISTS poi_rev_assets_sha ON poi_rev_assets (sha);

CREATE TABLE IF NOT EXISTS poi_assets (
  sha         TEXT PRIMARY KEY,               -- sha256 of the bytes, hex
  kind        TEXT NOT NULL,                  -- 'mesh' | 'texture'
  bytes       INTEGER NOT NULL,
  meta        TEXT NOT NULL,                  -- JSON: a mesh's { submeshes, vertices, triangles, min, max }; a texture's { format, w, h }
  by          TEXT NOT NULL,                  -- players.id of the first uploader
  at          INTEGER NOT NULL,
  live        INTEGER NOT NULL DEFAULT 0      -- 1 while a live revision names it: readable by anyone, the game included (AUDIT POI S4)
);

-- AUDIT POI S9: THE BYTES EACH BUILDER HAS UPLOADED IN A UTC DAY - reserved in one statement before the bytes are stored,
-- so uploads at once cannot all pass a bound each counted alone (poi.js POI_UPLOAD_DAY_BYTES)
CREATE TABLE IF NOT EXISTS poi_upload_days (
  by          TEXT NOT NULL,                  -- players.id
  day         INTEGER NOT NULL,               -- floor(unix seconds / 86400)
  bytes       INTEGER NOT NULL,
  PRIMARY KEY (by, day)
);

-- THE FEED'S VERSION: one row, moved by every approval, rollback and retirement - the game's cheap "anything new?"
CREATE TABLE IF NOT EXISTS poi_feed (
  k           TEXT PRIMARY KEY,
  v           INTEGER NOT NULL,
  at          INTEGER NOT NULL
);
INSERT OR IGNORE INTO poi_feed (k, v, at) VALUES ('feed', 0, 0);

-- THE LIBRARY'S SHELF (POI-4b): the models builders keep to stand again - an entry is a POI's parts and lights without a
-- place (poiLaw.js poiShelfProblems), named and tagged, with a picture of it. Shared by every builder; changed only by its
-- author or an approver; taken off the shelf, never deleted (a POI may stand its assets still).
CREATE TABLE IF NOT EXISTS poi_shelf (
  id          TEXT PRIMARY KEY,               -- lib-<12 hex> (poiLaw.js POI_SHELF_ID_RE)
  item        TEXT NOT NULL,                  -- the entry as JSON
  name        TEXT NOT NULL,                  -- its name and tags, beside it for the list
  tags        TEXT NOT NULL,                  -- JSON array
  thumb       TEXT,                           -- its picture's sha256 (a texture asset), or NULL
  parts       INTEGER NOT NULL,
  triangles   INTEGER NOT NULL,
  by          TEXT NOT NULL,                  -- players.id of its author
  by_name     TEXT NOT NULL,                  -- the handle, as it was
  at          INTEGER NOT NULL,               -- first shelved
  updated_at  INTEGER NOT NULL,
  updated_by  TEXT NOT NULL,                  -- the handle of the last to change it (its author, or an approver)
  gone_at     INTEGER,                        -- taken off the shelf
  gone_by     TEXT
);
CREATE INDEX IF NOT EXISTS poi_shelf_by ON poi_shelf (by, gone_at);
