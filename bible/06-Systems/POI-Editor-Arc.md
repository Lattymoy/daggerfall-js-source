# POI Editor

A realtime map editor inside the game for developers and builders: import glTF models, texture and UV-map them, and
place points of interest on the real streamed world, without touching the codebase. Every change is a revision that
an approver must approve before any player sees it. Players meet the result as approved POIs standing in the world and
marked on the maps; builders open the editor with `/play/?editor`. The port's own; DFU's World Data Editor edits the
classic blocks and places nothing by hand.

## How it works

**A POI is a document** (`src/poi/poiLaw.js`): `{ v: 1, id, name, about?, tags?, place, parts, lights?, marker? }`. The
place is any pixel of the world's grid (within `POI_WORLD_BOUND` of the Bay's corner), metres east and north inside it
(`POI_PIXEL_M` 819.2), a height above the ground (`snap`) or absolute, a unit quaternion and a size. Each part names a
mesh by sha256, a transform, a collider (`mesh` or `none`), a shadow, and one material per submesh: base and emissive
texture and colour, alpha (opaque, cutout, blend), two-sided, wrap per axis, filter, UV offset, scale and rotation.
`POI_LIMITS`: 128 parts, 32 lights, 96 KiB as JSON. `poiDocProblems` reports every fault as `{ path, code }`, never a
sentence; an unknown field is a fault at every level. `poiAssetProblems` checks the document against stored assets and
`POI_BUDGET` (triangles, asset bytes, pixels, reach).

**Assets** are content-addressed. A mesh is `POIM` v1 (`src/poi/poiMesh.js`: submesh runs, positions, normals, UVs,
indices; `POI_MESH_LIMITS`), checked by one function both ways. A texture is the PNG, JPEG or WebP as imported, known by
its header (`src/poi/poiImage.js`); the service never decodes pixels.

**The store** (`server-account/src/poi.js`, migration 0116). Roles are derived at every call: an approver is in
`APPROVER_HANDLES`, a builder is an approver, a developer or in `BUILDER_HANDLES` (`server-account/wrangler.toml`).
Uploads are named and checked by their sha256, 1 GiB a builder a UTC day. A draft is checked whole and saved over its
author's open draft of that POI (one open draft an author a POI). Builders submit, withdraw and request retirement. An
approver approves (naming the `docSha` of the document they saw, so a changed document is refused `poi-changed`),
rejects with a note, or rolls a POI back to an earlier approved revision. An asset is public only while a live
revision names it.

**Live, not deployed.** The game reads `GET /v1/poi/live` at start and every `POI_FEED_POLL_MS` (a minute) with its
version (`src/poi/poiFeed.js`), and streams assets from `GET /v1/poi/asset/<sha>`, hashing every byte. An approval
reaches every player within a minute, with no build. The last feed is kept and read back at the next start, so a game
without the network stands what it last saw. Every document is held to the law again before it stands.

**In the world** (`src/scenes/poiHost.js` `createPoiHost`). Every POI on a pixel the streamer has built is loaded,
stood, collided, lit, drawn and marked, as stand work within `POI_STAND_BUDGET_MS` (4 ms) a frame; taken down when its
pixel goes, its revision moves or it is retired. A part's collider waits while the player's feet are inside its box. A
revision that only moves the POI is placed again, not reloaded. Materials (`src/poi/poiRuntime.js`) bake tint and
alpha into one texture record each under `POI_TEXTURE_ARCHIVE`; translucent parts draw last, far first
(`src/render/meshAlpha.js`). POIs are violet circles on both maps (`src/ui/poi/poiMapMark.js`). A pixel's id is
`poiPixelKey`: the Bay's MapsFile id, and past the Bay the world key's law after the Bay's ids.

**The editor** (`src/scenes/world.js` `startPoiEditor`, panel `src/ui/poi/poiEditorPanel.js`). Offline, outdoors and on
foot. The store is asked the account's role first; the store checks it again at every write. While open the motor is
held, the camera is the editor's, and the body takes no damage. Builders' drafts are laid over the feed on their own
screen.
- *Edits* (`src/poi/poiEdit.js`): one undo stack across the working set (`POI_UNDO_DEPTH` 200); a drag is one step.
- *Gizmo* (`src/poi/poiGizmo.js`): move, turn and size handles, constant on-screen size, snapped steps, ground snap.
- *Import* (`src/poi/gltfImport.js` `readGltf`, pure, to the Khronos spec): GLB or glTF with side files and data URIs,
  sparse accessors, the node tree baked, triangles, strips and fans, morph defaults, PBR base and emissive materials
  (linear colours turned to sRGB), KHR_texture_transform and KHR_materials_emissive_strength.
- *Library* (`src/poi/poiShelf.js`, `src/ui/poi/poiLibraryPanel.js`): a model imported once is every builder's to
  stand again; read by no player.
- *Materials and UVs* (`src/ui/poi/poiUvPanel.js`, `src/poi/uv/uvMesh.js`, `src/poi/uv/uvEdit.js`): select by vertex,
  edge, face and island; move, rotate, scale, flip; seams; planar, box, cylindrical and spherical projections; an LSCM
  unwrap factored directly (`src/poi/sparseCholesky.js`) on a worker (`src/poi/uv/uvUnwrapClient.js`); island packing;
  texel density.
- *Approvals* (`src/ui/poi/poiReviewPanel.js`, approvers only): the oldest submissions, what each changes against the
  live one (`src/poi/poiDiff.js`), the law's report, stale marks, history and rollback.
- *Out and back in*: a POI pack (`src/poi/poiPack.js`, one stored .zip of documents, library entries and assets) and a
  GLB export (`src/poi/gltfExport.js`) for a round trip.
- *Words* (`src/poi/poiText.js`): every code said as a sentence through the text core.

## Rules

- A tool developers can use without the codebase; no short cuts or band-aids (Mac).
- Nothing reaches a player unapproved (Mac). Only approved revisions are in the feed.
- Developers and a Builder role use the editor (Mac).
- glTF and GLB are the import formats (Mac).
- A full UV editor (Mac).
- The editor runs in the game, on the real world, not a second viewer.
- The editor is refused online (`src/systems/online/onlineLane.js` `ONLINE_REFUSED_FLAGS`).
- TAMRIEL-WIDE: a POI may stand on any pixel of the world's grid.

## Code and tests

- `src/poi/poiLaw.js`, `src/poi/poiMesh.js`, `src/poi/poiImage.js` - the format, one law for editor, service and game
- `server-account/src/poi.js` - roles, uploads, drafts, review, rollback, feed, shelf
- `src/poi/poiFeed.js`, `src/scenes/poiHost.js`, `src/poi/poiRuntime.js` - the game stands them
- `src/poi/poiEdit.js`, `src/poi/poiGizmo.js`, `src/poi/gltfImport.js`, `src/poi/uv/` - the editor
- `test/poi/poi1_store.test.js`, `test/poi/auditpoi_store.test.js` - the store on the real Worker
- `test/poi/poi2_runtime.test.js`, `test/poi/auditpoi_runtime.test.js` - feed, assets, host, materials, renderer
- `test/poi/poi3_edit.test.js`, `test/poi/poi3b_panel.test.js`, `test/poi/auditpoi_panels.test.js` - the editor
- `test/poi/poi4_gltf.test.js`, `test/poi/auditpoi_gltf.test.js` - the glTF reader
- `test/poi/poi4b_library.test.js` - the library
- `test/poi/poi5_uv.test.js`, `test/poi/auditpoi_uv.test.js` - materials and UVs
- `test/poi/poi6_review.test.js`, `test/poi/auditpoi_packs.test.js` - approvals, packs, GLB out

## Open

- FLAGGED: the fixed-city bench (`scenes/exterior.js`) has no feed and stands no POIs.
