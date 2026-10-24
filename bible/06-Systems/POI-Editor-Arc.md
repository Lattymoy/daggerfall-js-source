# POI Editor Arc (POI-1 - POI-6, 2026-10-14)

Mac, 2026-10-14: *"First task of the day is developing a tool - POI Tool (General Map Editor) - Realtime editor - Visual
and Export - Allowing not just the creation of POI's using models, but also the ability to import models, texture, UV
map, and even placement onto our actual map. I want this to be a tool my developers can use without having to access the
codebase, and I want it to be the best it can be. No short cuts or band aids."*

Asked four things, Mac answered:

| Asked | Answer |
|---|---|
| How a published POI reaches players | *"I need to be able to approve changes"* - nothing reaches a player unapproved |
| Who uses the editor | *"Developers + Builders"* - developers, and a Builder role for map makers who are not |
| Which model formats import | *"glTF / GLB"* |
| What "UV map" covers | *"Full UV editor"* - select vertices, edges, faces and islands; move, rotate, scale; seams; unwrap; pack |

An original system, not a DFU member (DFU's World Data Editor edits the classic blocks; it imports no model and places
nothing on the map by hand). It stands on the port's own renderer (Port-Doctrine: hand-rolled WebGL2, no engine), so
the glTF reader is the port's own and every model draws through `Renderer.createMesh` like any other.

## The shape

- **THE EDITOR RUNS IN THE GAME** (`/play/?editor`, POI-3), signed in with a game account. Not a second world viewer: a
  POI is placed in the real streamed world - the real terrain, the towns, the collision, the travel map - so what the
  builder sees is what a player will. A viewer rebuilt beside the game would be the band-aid Mac ruled out.
- **A POI IS A DOCUMENT** (`src/poi/poiLaw.js`) naming its assets by sha256: meshes (`src/poi/poiMesh.js`, the
  renderer's own shape in the game's frame, one binary layout) and textures (PNG, JPEG or WebP as imported,
  `src/poi/poiImage.js` reading their headers). One law, three readers: the editor before a save, the account service at
  every write, the game before it stands one.
- **EVERY CHANGE IS A REVISION AND AN APPROVER DECIDES** (`server-account/src/poi.js`, migration 0116). Builders draft
  and submit; an approver (`APPROVER_HANDLES`, Lattymoy) approves, rejects with a word, approves a retirement, or rolls a
  POI back to an earlier approved revision. Only approved revisions are in the feed the game reads.
- **LIVE, NOT DEPLOYED.** The game reads the feed (`GET /v1/poi/live`) and streams the assets it names
  (`GET /v1/poi/asset/<sha>`, cached a day: a hash never changes, but an asset is public only while a live revision
  names it - AUDIT POI S4) - an approval reaches every player within a minute, no build and no relay restart (POI-2).

## The slices

| Slice | What | State |
|---|---|---|
| POI-1 | The format (document, mesh, texture header) and the store: roles, content-addressed uploads, drafts, submissions, the approver's word, retirement, rollback, the live feed | built |
| POI-2 | The game: the feed read and kept, POIs streamed with the pixels they stand on in the exterior hosts, drawn, collided, lit, marked on the map; a new approval picked up without a reload | built |
| POI-3 | The editor mode: the role gate, a free camera, the map to fly to, place / move / rotate / scale with gizmos and ground snap, an outliner and inspector, undo and redo, drafts saved and submitted | built (POI-3a the core, POI-3b the world and the panel) |
| POI-4 | The glTF 2.0 / GLB importer: accessors (sparse too), the node tree baked, materials, embedded and side-by-side images, samplers, KHR_texture_transform; the frame turned to the game's; the asset library | built - the reader (POI-4), the import and its upload (POI-3b), the library shared between builders (POI-4b) |
| POI-5 | The material editor and the full UV editor: selection by vertex, edge, face and island; move, rotate, scale; seams; LSCM unwrap; island packing; projections; texel density | built |
| POI-6 | The approver's queue in the editor (before and after, at the place, with the law's report), history and rollback; export and import of a POI pack; a GLB back out for a round trip | built |

## POI-1 - the format and the store (2026-10-14, acct135)

**THE MESH** (`src/poi/poiMesh.js`). `POIM` v1, little-endian: a header (vertex and index counts, a u32-index flag, the
submesh count, the bounds), the submesh runs (`{ start, count }`, contiguous, in order, whole triangles - one per
material), then positions, normals and UVs as f32 and the indices. Metres, the game's model frame (`dfMeshToModel`'s:
Unity's left-handed, +Y up), UVs as glTF writes them (origin top-left). `encodePoiMesh` refuses what `decodePoiMesh`
would, by the one check `poiMeshError`: lengths that agree, finite numbers, every index a vertex, the runs whole and in
order, and the limits (`POI_MESH_LIMITS`: 262,144 vertices, a million triangles, 64 submeshes, 2048 m from the origin,
24 MiB). A decode re-derives the bounds and refuses a header that lies about them - NaN ones too (AUDIT POI S5: the
check was written as the bounds differ, and NaN differs from nothing). The checks and the box run in steps of
`POI_MESH_STEP` numbers (`decodePoiMeshSteps`, the game's stand work's - AUDIT POI L12: a model at the bounds was one
task of tens of milliseconds); `poiMeshError` and `decodePoiMesh` drive the same steps whole.

**THE TEXTURE** (`src/poi/poiImage.js`). The image as imported, known by its header: PNG (IHDR), JPEG (the first true
start-of-frame past the tables) or WebP (VP8, VP8L or VP8X), at most 4096 a side and 16 MiB. The service never decodes
pixels; the browser that draws it does.

**THE DOCUMENT** (`src/poi/poiLaw.js`). `{ v: 1, id, name, about?, tags?, place, parts, lights?, marker? }`. `place` is
a map pixel (`px` 0-999, `py` 0-499), metres east and north inside it from its south-west corner (`x`, `z`, 0 to 819.2 -
`streamingWorld.js pixelTranslation`'s frame), a height `y` above the ground (`ground: 'snap'`) or absolute, a unit
quaternion and a size. Each part names a mesh, a transform from the place, `collide` ('mesh' or 'none'), `shadow`, and
one material per submesh: base texture and colour, emissive texture and colour, alpha (opaque, cutout with its cutoff,
blend), two-sided, wrap per axis, filter (linear or nearest), and a UV offset, scale and rotation. Up to 128 parts, 32
lights, a marker for the map, 96 KiB as JSON. `poiDocProblems` names every way a document falls short as
`{ path, code, ...args }` - WHERE, as the document spells it, and WHAT, a stable word (`quat`, `alpha`, `unknown`),
never a sentence: the editor says it in the builder's language and the service returns the same objects verbatim (the
port's own text law, L10N4: no new hard-coded English). A field the law does not know is a problem, not a passenger - at
every level: the place, a part, a light, the marker and a material's UVs as the top level and the materials (AUDIT POI
S2: they had carried anything, stored, approved and served to every player), so the deepest document the law takes is
seven levels. A name, tag, label or part name holds no control character (C0 or C1), no line or paragraph separator, no
bidi embedding, override or isolate and no half of a surrogate pair; the description its line breaks and none of the
rest (S13). `poiAssetProblems` checks a document against the stored assets: every mesh uploaded and a mesh, every
texture a texture, a part's materials exactly its mesh's submeshes - and the POI as a whole within `POI_BUDGET` (AUDIT
POI S6: nothing bounded the sum): 1,048,576 triangles and as many vertices as drawn (a model stood twice counted twice),
64 MiB of distinct assets, 33,554,432 pixels of distinct pictures (two 4096-square), a reach of 2048 m from the place's
origin at its size; a shelf entry held to the same.

**THE ROLES** (`poi.js poiRolesOf`, `wrangler.toml`). Derived at every call, as every grant here is (titles.js): an
approver is in `APPROVER_HANDLES` (Lattymoy); a builder is an approver, a developer (`DEVELOPER_HANDLES`) or in
`BUILDER_HANDLES` (empty at the start). A guest is neither. A handle taken off a list loses the door at its next request.

**THE STORE** (migration 0116: `poi_docs`, `poi_revs`, `poi_rev_assets`, `poi_assets`, `poi_upload_days`, `poi_feed`; R2
`poi/a/<sha>`).
- An upload (`PUT /v1/poi/asset/<sha>?kind=mesh|texture`, a raw body to its kind's bound) is named by its own sha256 -
  checked against the bytes - and read whole as the kind it claims (a mesh decoded, a texture by its header). Stored
  once; its facts (a mesh's submeshes, vertices, triangles and bounds; a texture's format and size) kept beside it for
  the document checks. A builder may upload 1 GiB a UTC day, the bytes reserved in the statement that counts them before
  they are stored and given back if they never are (`poi_upload_days` - AUDIT POI S9: eight uploads at once had all
  stored past the bound).
- A draft (`PUT /v1/poi/draft { doc, base }`) is checked whole - the law and the assets - and saved over its author's
  open draft of that POI in the one statement that finds it - one open draft an author a POI, held by the database
  (`poi_revs_one_draft`), a draft gone to the queue meanwhile making the save the next draft (AUDIT POI S7, S8) - else a
  new revision (its number taken in the write itself, so two builders never collide; at most `POI_OPEN_REVS` (200) open
  a builder, `poi-drafts-full` - S10). A new id founds the POI. Any builder may draft a revision of any POI; `base` says
  which revision it was made from.
- `POST /v1/poi/submit` (the author's draft, checked again, and sent only as checked - AUDIT POI S1), `/withdraw` (back
  to a draft; 'withdrawn' where its author already has another open draft of the POI, and for a retirement, with no note
  - S8, S14; one an approval beat told so - S7), `/retire` (a submitted 'retire' revision, one at a time -
  `poi_revs_one_retire`, S8 - of a live POI).
- `POST /v1/poi/review { id, rev, verdict: 'approve' | 'reject', note, docSha }` (an approver; the note up to 500
  characters). An approval names the document the approver saw - `docSha`, the sha256 of its stored text as the queue
  gave it: one whose document has changed since is refused `poi-changed` and nothing is decided, and an approval naming
  none is refused (AUDIT POI S1: withdrawn, saved over and sent again under the same rev, an unseen document had stood).
  Approved, the revision is the POI's live one (a retirement: none), the feed's version moved, and every asset of the
  POI public exactly while a live revision names it (`poi_rev_assets` - S4: a model a newer revision replaced, or a
  retired POI's, is a builder's again) - one batch, its first write held to the document read and every later one to the
  request's own mark, so a decision raced is made once. A document is checked once more as it goes live.
- `POST /v1/poi/rollback { id, rev }` (an approver): an earlier approved revision live again - a retired POI too -
  recorded as a revision of its own, kind 'rollback' (no document, the revision put back its base, the approver its
  author and reviewer, approved - AUDIT POI S14: its actor had been kept nowhere but `live_by`), the assets' `live`
  recomputed with it (S4).
- Reads: `GET /v1/poi/me` (the caller's roles), `/list` (every POI and its newest `POI_LIST_REVS` (20) revisions'
  states, its name and pixel from their own columns, never out of a document - AUDIT POI S3, S10: one deep draft had
  broken it for every builder), `/doc/<id>` (its history, documents and all), `/queue` (an approver's: the oldest
  `POI_QUEUE_MAX` (50) submissions and `more` when others wait (S10), each with its document's `docSha` (S1), the live
  document it would replace, and whether it is STALE - made from a revision that is not the live one now, none included,
  a retirement too (S12)).
- The library's shelf (POI-4b, below): `GET /v1/poi/shelf` (every entry, without its parts),
  `GET /v1/poi/shelf/<lib-id>` (one, whole), `PUT /v1/poi/shelf { item }` (put new, or over one's own - an approver's,
  any; at most `POI_SHELF_EVER` (10,000) a builder ever, `poi-shelf-spent` - AUDIT POI S10),
  `POST /v1/poi/unshelve { id }` (its maker or an approver); an entry taken off answers `poi-gone` (410) and a full
  shelf `poi-shelf-full`, each in its own words (U13: they had been a request the service does not know, and a full
  day's uploads).
- The open reads, no session: `GET /v1/poi/live` (`{ v, pois: [{ id, rev, doc }] }`, an ETag of its version, 304 to a
  game that holds it, its tag read strong or weak - the preflight lets `if-none-match` through) and
  `GET /v1/poi/asset/<sha>` for an asset a live POI names (`public, max-age=86400` - a day: AUDIT POI S4, an asset can
  stop being public). A draft's asset is a builder's alone (`private, no-store`). Bounded per address (600 a minute, the
  isolate's memory). The feed is kept in the isolate: inside `POI_FEED_KEEP_MS` (15 s) no statement; past it, the
  version's one row, and the documents only when it moved; a game holding a version newer than the kept one is answered
  the version read now (S11: a stale isolate had handed it the older feed).

Pinned by `test/poi/poi1_store.test.js` (10) on the real Worker over the real migrations; `tools/mutants/poi1.json` 16, all
dead. AUDIT POI: `test/poi/auditpoi_store.test.js` (21) on the same Worker, `tools/mutants/auditpoi_store.json` 52, all dead
(`01-Overview/audits/Audit-POI.md`). The account deploy's path filter carries the three shared law files. acct135 (acct133, then acct134, on
the branch, renumbered past LAMP-KEEPER II's and KG6's at the merges).

## POI-2 - the game stands them (2026-10-14)

- **THE FEED** (`src/poi/poiFeed.js` createPoiFeed): `GET /v1/poi/live` at start and every `POI_FEED_POLL_MS` (a minute)
  with the version held (`If-None-Match`; a 304 reads nothing), so an approval reaches a playing game within a minute
  with no deploy and no reload; a failed ask backs off from `POI_FEED_RETRY_MS` (5 s), doubling to the minute;
  `refresh()` asks now - the editor's after a verdict and a put-back - and one asked while an ask is out is asked again
  the moment it answers (AUDIT POI R13); an answer older than one already taken from the network is not taken (S11: a
  stale isolate's had taken a new approval down). Every document is held to the law again (`poiDocProblems`) - one the
  law refuses is not stood, whatever the wire says. The last feed is KEPT (the Cache API, `browserPoiCache`) and read
  back at the next start: a game without the network stands the POIs it last saw. The version, the tag and the kept copy
  are one service's - another service is asked afresh, and a copy kept is read back under its own service alone (AUDIT
  POI R15). `setOverlay` stands a builder's open drafts over the live set on that screen alone (POI-3).
- **THE ASSETS**: by their sha256 - memory (64 MiB, the oldest asked let go), the kept copy, then
  `GET /v1/poi/asset/<sha>` - and HASHED wherever they came from: bytes that are not the ones their name says are
  refused (the content address is the integrity check). One ask per asset at a time.
- **THE HOST** (`src/scenes/poiHost.js` createPoiHost; the pools' shape - `lefayMonumentHost.js`,
  `merchantYardsHost.js`): every POI on a pixel the streamer has BUILT is loaded, stood, collided, lit, drawn and
  marked; taken down when its pixel goes, its revision moves or it is retired. Nothing is baked into a pixel's batch - a
  POI comes and goes while its pixel stands. Its loading - its meshes decoded, its pictures decoded, baked and uploaded,
  its models made, its colliders first filed - is stand work, `POI_STAND_BUDGET_MS` (4 ms) a frame and at least one
  step, never one task (AUDIT POI R8: hundreds of milliseconds at a door); leaving the street (`standDown`) takes its
  colliders down and keeps its models and pictures, so coming back places the POIs again. Its matrices are its pixel's
  frame (metres east and north of the south-west corner), its collider rides the pixel's translation (`collider.js`
  onFloatingFrame), so a floating-origin recentre restands nothing. A `snap` POI stands its `y` above the drawn ground
  (`world.js` surfaceAt), read again when the pixel moves and every `POI_GROUND_EVERY` (30) frames; until the ground
  answers, it waits unseen and uncollided. A part's collider is HELD while the player's feet are inside its box (never
  walled in - an approval may land on a player) and stood once they leave; one standing round the body when its part
  must move is CARRIED - filed again in that frame where the part now stands (AUDIT POI R1: it was taken down, and a
  body inside lost its floor). A revision that moves nothing (`sameStand` - the feed read again after an approval
  anywhere hands every POI a new document) only takes its document and revision, its colliders standing; a height within
  `POI_Y_EPS` (1e-4 m) is the same height, so a recentre's ulp moves nothing (R1). A revision that only MOVES the POI,
  or a part's own scale (`sameBuild`: the same parts' meshes, materials, colliders and shadows), is placed again, not
  reloaded - a part whose scale moved modelled again as stand work, never drawn through a mirror its faces are not wound
  for (R5, R6); any other is reloaded. A POI whose assets would not load is tried again after `POI_RETRY_MS` (a minute),
  everything a load made freed on every way out that does not stand (AUDIT POI R2) and a picture that failed let go at
  once, so a POI sharing it tries again (R3). Its lights join the scene's selection (`flicker` stepped at 12 Hz); its
  marks go to both world maps (`src/ui/poi/poiMapMark.js`, a violet circle on the bounty's reader and painter, under a cap
  of their own, `POI_MARKS_MAX` (256) - AUDIT POI R7: the bounty's eight). Wired in `world.js` only; the bench
  (`exterior.js`) has no feed - FLAGGED.
- **THE MATERIALS** (`src/poi/poiRuntime.js`, pure): a material's LOOK (picture, tint, alpha, sampler, emission) is one
  texture record under `POI_TEXTURE_ARCHIVE` (600000, owned alone - `test/world/superDungeon/sd26_render.test.js` ONE ARCHIVE, ONE OWNER);
  two materials alike share it. The tint is baked into the picture (the mesh shader has none), a cutout's alpha
  thresholded at ITS cutoff to all or nothing (the shader cuts at a half), a blend's alpha kept times the tint's, and a
  cut-out's or a blend's clear texels coloured from their nearest, their alpha untouched (AUDIT POI R9: a filter or a
  mip read them dark; the picture is read back through WebGL2, unpremultiplied, the 2D canvas a fallback); the emission
  is its picture times its colour, clamped (low dynamic range). Rows turned to color32 order; UVs through the material's
  transform and to the renderer's `v' = 1 - v`. A two-sided material's faces doubled back on their own vertices, normals
  turned - a blended one's back faces first (R14); a part's own scale baked into its model, normals through its inverse
  (R5); a mirroring part (negative determinant) wound back, by its baked scale's sign (R6). Blended submeshes are a
  model of their own.
- **THE RENDERER** (`src/render/meshAlpha.js`): `MESH_ALPHA_GLSL` in both mesh programs (classic and Enhanced Lighting)
  - `uMeshAlpha` 0 for every opaque draw (alpha 1 written, as ever), the texel's alpha times it in a translucent one.
  `drawMesh(..., { translucent })` blends straight alpha over (`SRC_ALPHA, ONE_MINUS_SRC_ALPHA`; the destination's alpha
  kept), tests depth and writes none, casts no shadow and puts every bit of state back; the host draws them after the
  grass, the banners, Windfall and the haze - every pass that writes depth the glass does not (AUDIT POI R4: grass and
  banners had drawn over it) - far first from the view's own eye, a part culled to its shadow not drawn (R14). A
  texture's own SAMPLER (`samplerParams`: wrap per axis - repeat, clamp, mirror - and the filter) is keyed apart
  (`samplerKey`), the emission map with it.

Pinned by `test/poi/poi2_runtime.test.js` (11) - the renderer on a recording GL, the shaders' text, the pictures, models and
matrices, the feed and assets on a fake service, the host on a fake streamer, collider and renderer;
`tools/mutants/poi2.json` 27, all dead. AUDIT POI: `test/poi/auditpoi_runtime.test.js` (17),
`tools/mutants/auditpoi_runtime.json` 39, all dead.

## POI-3a - the editor's core (2026-10-14)

Pure where it can be, so the editor and the tests read it the same way:

- **THE DOCUMENTS AND THEIR UNDO** (`src/poi/poiEdit.js` createPoiEdit): the working set - each POI being edited, beside
  the document as last SAVED (unsaved is a comparison, never a flag). Every change is ONE step on one stack across the
  set (the document before and after, and the selection each left); a change that changes nothing is no step. A drag
  (`begin` / `preview` / `commit`) is one step however many frames it moved, each preview applied to the document as the
  drag found it (absolute: no error gathered); `cancel` puts it back; an edit mid-drag ends it first; an undo or a redo
  mid-drag only lets it go (AUDIT POI E9: it undid the step before too). A create undone is gone, and redone as it was
  when undone - saved, its revision, its state (E8); a remove undone is back as it was saved; a new POI and the model
  placed to found it are one step (E11); a POI shown as another document (showAs) takes no edit and no drag (E17);
  closing a POI takes its steps; `POI_UNDO_DEPTH` 200. `overlay()` is the working set as the feed's overlay.
- **THE TRANSFORMS**: a move in map metres, the place renormalised over a pixel's edge into the next pixel's frame (east
  `px + 1`, north `py - 1`), the map's edge held; a turn about a world axis; a size held to the law's 0.01 - 100. A
  part's move, turn and size carried into its POI's frame (under the place's turn and size). Unity's Euler angles both
  ways (`eulerOfQuat`, `quatOfEuler`: Z, then X, then Y - Transform.eulerAngles, in [0, 360)) - the matrix read without
  assuming a unit quaternion, the pole where the pitch's cosine is under `POLE_COS` (1e-5), its yaw from the matrix's
  top row, Unity's way (AUDIT POI E4: a tidied quaternion at a true 90 fell short of the old test, and a roll typed over
  it turned the POI 45 degrees). Numbers tidied (a tenth of a millimetre; a quaternion to a millionth, `w >= 0`) so the
  inspector's numbers read as typed. A quaternion so tidied is up to a millionth off unit length, and every reader
  allows it: the diff reads a turn from one quaternion times the other's inverse, never from a dot product that assumes
  unit length (AUDIT POI P1: an untouched POI had read "Turned 0.2°"), the Euler angles from the rotation's matrix (E4).
  A part's key the law's spelling, unique in its document (`uniqueKey`).
- **THE GIZMO** (`src/poi/poiGizmo.js`): move (an arrow an axis, a square a plane, the centre the screen's plane), turn
  (a ring an axis, the outer ring the eye's), size (a box an axis, the centre all three), the same size on screen at any
  distance (`gizmoSize`). An axis drag is read on the plane through the axis that faces the eye best; a turn is the
  angle swept round the centre on the ring's plane (the grab point follows the cursor), and a ring within 0.08 of edge
  on by the cursor's travel along the tangent at its near side, the arc over the radius (AUDIT POI E5: its sweep had
  lain on one line, turning nothing or half a turn); an axis's size the grab point's distance now over at the grab, all
  three's the cursor's travel across the screen - right and up growing it, an arm's length doubling it (E10: grabbed
  beside the centre, 10 px had been x5.75). Snapped to a step (a quarter metre, fifteen degrees, a tenth). A handle that
  cannot be dragged from the view - an arrow pointing at the eye, a square seen edge on - is `hidden`: neither drawn nor
  picked.
- **THE WORDS** (`src/poi/poiText.js`): every code the law, the glTF reader, the mesh and the picture header say, as a
  sentence through the text core, a problem's place said by its part's name; a code no table knows still said. In the
  catalog's thirteen in-session languages.
- **THE DOOR** (`src/poi/poiService.js`): the reads and acts through the account client's one door (`call`); the draft
  and the asset as PUTs of their own (a body no JSON ladder takes), answered in the door's shape; an asset hashed and
  put under its name.
- **THE HOST'S PICK** (`src/scenes/poiHost.js` pick): the nearest part a ray meets, by its own triangles through the
  inverse of its drawn matrix, its box asked first and each later part's reach the nearest so far. A draft's colliders
  wait while the editor drags it (`collideDrafts`) - a draft moved every frame would file its collider every frame.
- **THE LINES** (`src/render/poiGizmoPass.js`): the gizmo, a selection's boxes and the placing mark as screen-width
  quads, feathered, a batch on top (untested) or in the world (tested), never writing depth, the state put back; sized
  in the pixels of the rect the world pass draws into (`renderer.worldViewportPx` - AUDIT POI E18: the whole drawing
  buffer's had drawn them thin and unequal).
- **THE EDITOR IN THE WORLD** (`src/scenes/poiEditorHost.js`): its own eye (the right button held: look, the builder's
  own movement bindings along the look - the registry's actions, never a raw key, so a rebind reaches it - Jump or Float
  Up up, Crouch or Float Down down, Run faster, the wheel the speed; the middle button pans; Alt orbits the selection; F
  frames it); a free cursor whose click is a pick - a handle first, then the part under the ray (the first click on a
  POI takes the POI, the next its part), then nothing - a live POI not being edited opened for editing (AUDIT POI E15),
  a POI shown as another document neither picked nor given a handle (E17); Q W E R the tools, X the space, Ctrl+Z /
  Ctrl+Y; placing a new POI or a library part where the click meets the ground, measured from the POI's own origin
  whatever of it is held (E6); a drag read in the frame it began in, so a floating-origin recentre mid-drag moves
  nothing (E7). Wired by POI-3b.

Pinned by `test/poi/poi3_edit.test.js` (13) and `test/poi/poi2_runtime.test.js`'s host pick; `tools/mutants/poi3.json` 34, all
dead. AUDIT POI: `test/scenes/auditpoi_editor.test.js` (15), `tools/mutants/auditpoi_editor.json` 42, all dead. A LIGHT HELD
(POI-3b): its pivot where it shines from, the move handle alone, dragged in its POI's frame, every light of the POI
marked as a small star.

## POI-3b - the editor in the world, and its panel (2026-10-14)

**HOW A BUILDER USES IT.** Sign in to the game with an account the store calls a builder (developers, every handle in
`BUILDER_HANDLES`, and the approvers in `APPROVER_HANDLES` - `server-account/wrangler.toml`), load a game, and open
`/play/?editor` (offline: the flag is refused online with the other powers, `systems/online/onlineLane.js`). Outdoors and on
foot - not on a horse, a cart's bench or a ship's helm (AUDIT POI E12) - the editor opens over the world; its corner
button opens it again after an exit.

- **THE DOOR** (`src/scenes/world.js` startPoiEditor / mountPoiEditor): the store asked who this account is
  (`/v1/poi/me`) before anything is made - not a builder, the store's own sentence and nothing more (the store asks the
  role again at every write: the door is a courtesy, not the lock). While it is open the motor is held and the frame's
  eye is the editor's (`cam` itself - the streamer and the floating origin follow it), no hand is drawn, and no blow
  lands on the body left standing (`registerPlayerDamageMod('poi-editor')`). Its drafts are laid over the feed before
  the POI host reads it; a draft's assets are asked with the builder's bearer; its lines are drawn after the translucent
  pass and the pass marked. Its presses are taken in the window's capture phase - the world hears none of them: the
  boot's cursor and walk toggles stand down and the hotbar is held while it is open (AUDIT POI E1: Ctrl+Y had taken the
  cursor, the digits the body's items), a key at the panel's own controls is the editor's and a typed field's the
  field's, neither reaching the world (E2: Escape after New POI had opened the pause menu), and the keys held are let go
  on the way in and out (E3); the browser keeps every key the editor does not act on - find, reload, zoom, Tab, back,
  every Alt chord (E16: it had kept only F5 and F12). Leaving: **back** (the eye given back to the body; a body whose
  pixel went while the eye was away fetched by `_teleportToPixel`, the one door that rebuilds a place,
  `ohTeleportToWorld`'s way) or **here** (stood on what is under the eye - `floorLanding` - refused, the editor still
  open, while that ground is not built, and moved out of rock by `openGroundNear`, the teleport's check: E13). It leaves
  by itself when the world goes from under it - a change of mode or a load 'away', the eye and the body where that
  change put them; a death 'back' - and a release it never heard (over a window, a capture lost, the window's blur) lets
  go of what it holds (E14). The **map** jumps: the body taken to the square picked by the same door, the eye above it.
- **THE PANEL** (`src/ui/poi/poiEditorPanel.js`): the bar (the tools Q W E R, world or own axes X, snap and its three steps,
  undo and redo saying what they undo, the eye's speed, New POI, Import model, Map, the two exits); the outliner (each
  POI being edited with its state - new, draft, sent for approval, live, sent back, changed - its parts and lights;
  every POI the store holds, searched, to open: my own open draft of it when I have one, with the base it was made from
  (AUDIT POI P6: it had taken the live one's, and the queue no longer saw it stale), my own revision sent back as sent
  back, sent again as a new draft (U4), its live revision otherwise - and, with none, another builder's newest as a
  change to save as my own (U4)); the inspector (a POI's name, description, tags, spot, how it stands - on the ground or
  at a fixed height - its height, its turn as Unity's three angles, its size, its mark and label, its lights; a part's
  name, offset, turn, scale, solidity, shadow and materials - colour and its alpha, edges (opaque, cutout, see-through)
  and the cut, both sides, repeat per axis, smooth or pixelated); every field one step of the undo. Then **what is
  wrong**, in words and said where, the asset check waiting until every asset is known (an asset the store has not got
  is said; one not yet heard of - offline - is not); and the store's acts - Save draft (held while anything is wrong or
  unknown, and on a submitted POI: take it back to draft first - AUDIT POI U3, a save had made a draft beside the
  submission; Ctrl+S the same button, never for an unchanged draft, one still being checked, or twice at once - U5),
  Send for approval and Take back to draft (each marking saved what the store holds, never the changes made meanwhile -
  U2), Ask to retire it, Put back as saved, Close (asking again over unsaved work), Throw it away (a new POI) - each
  bound to what its button showed when drawn (U1). A refusal is the store's own sentence (`accountRefusalText`). A field
  being typed in keeps its text: the panel is drawn again once it lets go of the keyboard - a field typed in, not a
  pressed button or a ticked box (U1: a pressed Close had held the dock, and its second press threw the work away) - and
  never under a press, from its pointerdown to just after its release, `PRESS_HOLD_MS` (1.5 s) at most (L1).
- **THE IMPORT** (`src/poi/poiImport.js`, the panel's dialog): a .glb, or a .gltf with its .bin and pictures; one part,
  or a part for each object (refused in words past a POI's 128 parts - AUDIT POI L6); its parts listed (vertices,
  triangles, materials) and its lights, placed and kept with it (L7), what was left out and why, what is past a limit
  (refused by its code, never uploaded - a part past the mesh law never built: G3); each picture read by its header (one
  the store would refuse set aside, its materials plain), each picture and mesh uploaded once by its name (`existed` for
  bytes the store has; Make and the files held while they go up - U10), the materials' images their pictures' names, and
  the model placed - every part at once, one step, each where it stands from the model's origin in its POI's frame -
  where the next click meets the ground (or a model on it); no POI held, a new one stands round it in the same step
  (E11). Cancel stops it: nothing more uploaded, nothing placed (U9).

Pinned by `test/poi/poi3b_panel.test.js` (6) - the panel headless over the shared fake document (test/chargenDom.mjs), the
import, and the world's wiring by source; `tools/mutants/poi3b.json` 12, all dead. AUDIT POI:
`test/poi/auditpoi_panels.test.js` (18) and the lead's `test/poi/auditpoi_lead.test.js` (L1, L6, L7),
`tools/mutants/auditpoi_panels.json` 72 and `auditpoi_lead.json`, all dead.

## POI-4 - the glTF 2.0 reader (2026-10-14)

`src/poi/gltfImport.js`, pure (no DOM, no fetch), written to the Khronos specification.

- **`readGltf(bytes, { files })`** - a .glb (its JSON and BIN chunks) or a .gltf with the files its URIs name (by path,
  decoded path or bare name) and data URIs in place. Buffers and views (strided too), every component type, normalized
  or not, SPARSE accessors (over a view or over none). The default scene's node tree from its roots (TRS or a matrix; a
  cycle refused, and a node of two parents - AUDIT POI G3: a DAG had been walked once a path), walked by a stack of its
  own, its parents found once; every count held to `GLTF_READ_LIMITS` - an accessor at most `POI_MESH_LIMITS.indices`
  numbers, a file eight times that - and every past-end, stride and sparse check made before anything is allocated (G3).
  Primitives in TRIANGLES, STRIP and FAN; morph targets at the node's or mesh's default weights. Materials: base colour
  factor and texture, emissive with KHR_materials_emissive_strength - the factors glTF's LINEAR colours, turned to the
  game's sRGB (AUDIT POI R10: a Blender 0.5 had baked as 128 where a viewer shows 188) - alpha mode and cutoff,
  double-sidedness; textures and samplers (wrap per axis, magnification filter); images embedded, in a view or beside
  the file - PNG, JPEG, and WebP through EXT_texture_webp; KHR_texture_transform on a texture reference. Point lights
  (KHR_lights_punctual) read as the game's (`poiLightOf`: from the light's `extras.poi` while the light still agrees
  with them, else converted back - G7). `extensionsUsed` read (G8).
- **`bakeGltf(model, { split })`** - into POI parts in the game's frame: `whole` bakes every instance's world matrix
  into ONE mesh (a submesh per material, in first use), each primitive emitting only the vertices its indices use (AUDIT
  POI G2: the editor's own export had come back multiplied by its submeshes) into arrays sized once (G1: a spread past
  V8's limit had refused 50,000 vertices); `nodes` a part per instance (at most a POI's 128 parts - L6), its turn, scale
  and any shear baked, its translation the part's position (exact for any tree). X is mirrored (glTF is right-handed and
  faces +Z; the game is Unity's left-handed frame, +Z forward - glTFast's conversion, the model keeps facing forward)
  and every triangle wound back to stay front-facing under the renderer's `gl.frontFace(CW)`; a mirroring node (negative
  determinant) is already wound back by the specification's rule, so it keeps its order. Normals by the
  inverse-transpose; a primitive with none gets FLAT normals, the specification's requirement, from the emitted order
  (`(E1 - E0) x (E2 - E0)`). The base texture's KHR_texture_transform - the glow picture's, for a material with no base
  - is baked into the one UV set the renderer draws (`T * R * S`, the extension's order); the UV set and the sampler the
  base texture names, or the glow's, are the ones read (AUDIT POI G5: a glow-only sign had come back 1 x 1). A skinned
  mesh is baked in its saved pose - each joint's world matrix times its inverse bind matrix, weighted by JOINTS_n and
  WEIGHTS_n (G6: the identity had stood a skin at the origin). A part past the mesh law's limits is never built: refused
  by the law's own code (G3).
- **REFUSED, BY CODE** (`GltfError { code, args }`): not glTF 2.0, not glTF at all, a GLB short of its chunks,
  `compressed` (Draco or meshopt - export with compression off), an `extension` required and not implemented, a missing
  file, buffer, view, accessor, image, texture or node, a read `past-end`, a `node-cycle`, a node of two parents
  (`node-parents`), an accessor type no mesh attribute is, `too-large` (past the reader's limits), `too-many-parts` (a
  part for each of more objects than a POI holds - L6), `malformed` (anything else a damaged file meets, said as one -
  AUDIT POI G3). **SET ASIDE, BY CODE** (`warnings`): `points-lines`, `no-positions`, `vertex-colours` (the game's
  renderer has none - bake them into a texture), `maps` (normal, occlusion, metal/roughness are not drawn), `skin`
  (imported in its saved pose - true now, AUDIT POI G6), `animation`, `camera-light` (a camera, a spot or a sun: a point
  light comes in - G7), `no-uvs` (a textured material whose mesh has none - the UV editor unwraps it),
  `emission-uv-set`, `emission-transform` (a glow placed or sampled unlike its picture - G5), `instancing`
  (EXT_mesh_gpu_instancing's copies come in as one - G8), `extension-ignored` (any other extension used and not read -
  G8), `image-format`. The editor says each in the builder's language.

Pinned by `test/poi/poi4_gltf.test.js` (6); `tools/mutants/poi4.json` 11, all dead. AUDIT POI: `test/poi/auditpoi_gltf.test.js`
(12), `tools/mutants/auditpoi_gltf.json` 45, all dead. The asset library, the upload and the editor's import dialog come
with POI-3.

## POI-4b - the library (2026-10-14)

Mac: "Allowing not just the creation of POI's using models, but also the ability to import models ... a tool my
developers can use without having to access the codebase". A model imported once is every builder's to stand again,
without its file.

- **THE ENTRY** (`src/poi/poiLaw.js` `poiShelfProblems`): a POI's parts and lights without a place - each part the law's
  own (its mesh and materials by their hashes, its offset, turn and size from the model's origin, its solidity and
  shadow) - a `lib-` id, a name, tags, words, and its picture (`thumb`, a texture by its hash, or none). The same law a
  POI is read by, `place` and `marker` left out; the picture checked as a stored texture with the rest of its assets.
- **THE SHELF** (`server-account/src/poi.js` listShelf / shelfEntry / shelve / unshelve; migration 0116's `poi_shelf`):
  shared by every builder and read by no player. An entry put new, or over the builder's own (an approver's, any); taken
  off the shelf by its maker or an approver - kept, as every record here is, but listed, read and put over no more, and
  said so (`poi-gone` - AUDIT POI U13). Its triangles counted from its meshes' stored facts. A builder keeps at most
  `POI_SHELF_MAX` (2,000) entries at once (a full shelf said in its own words - U13) and puts at most `POI_SHELF_EVER`
  (10,000) ever, those taken off counted (S10: put and take off had kept rows without end). Its assets stay a builder's
  until a live POI names them, and are a builder's again once none does (S4).
- **ITS PICTURE** (`src/poi/poiThumb.js`): drawn in software as the entry is kept - no GL context borrowed, the same
  numbers the same picture everywhere. Orthographic, from the model's front a little to its right and above (Unity's
  frame: the model's right on the viewer's left), framed on what is drawn; a depth buffer; a face turned away culled
  (its winding against the eye, a mirroring size turning it), a two-sided material lit from its own side; each pixel its
  colour times its picture (wrapped, its UV transform applied - poiRuntime.js's order) under a key from above the eye's
  left shoulder, a fill low on its right (set in the eye's own frame - AUDIT POI M8: they had stood mirrored against
  their words) and an ambient light, a pixel centre on an edge two triangles share drawn by one of them, the top-left
  rule (M12); a cutout's clear texels dropped, a see-through material laid over what is behind. Drawn at twice the size
  and averaged down. Written as a PNG (RGBA, filter None, zlib by `formats/rawDeflate.js` with its Adler-32, each
  chunk's CRC by `systems/save/saveTransfer.js` crc32), uploaded as a texture by its name.
- **KEEPING** (`src/poi/poiShelf.js`): the law asked first (nothing is uploaded for an entry it refuses), the picture
  drawn and uploaded, then the entry put wearing it; a picture that will not draw leaves the entry without one - still
  kept, and shown by its initial. The store's refusal brings the law's problems back to the dialog.
- **THE LIBRARY** (`src/ui/poi/poiLibraryPanel.js`; the bar's **Library**): every entry, newest change first - its picture,
  name, tags, maker, parts and triangles - searched by any words of its name, tags or maker, or mine alone; **Place**
  stands it where the next click meets the ground (or a model on it); **Change...** (its name, tags and words) and
  **Take off the shelf** (asked twice) on mine, or on any for an approver. **Keep it in the library...** in a POI's
  inspector (its parts and lights) and **Keep this part in the library...** in a part's (the part alone, at the entry's
  origin); the import keeps what it places unless its box is cleared - its meshes as the import holds them, none fetched
  back, and its lights (AUDIT POI L7: they had been left behind).
- **PLACING AN ENTRY** (`src/scenes/poiEditorHost.js`): its parts keep their own turn, size, solidity and shadow, each
  where it stands from the entry's origin, and its lights come with it - all one step of the undo, the POI founded round
  it when none is held included (AUDIT POI E11: two steps); measured from the POI's own origin whatever of it is held
  (E6: a held light had offset every part).

It rides acct135 with POI-1's store - neither deployed before it - its table in migration 0116 (acct133, then acct134, and 0113, then
0114, on the branch, renumbered past LAMP-KEEPER II's and KG6's at the merges).

Pinned by `test/poi/poi4b_library.test.js` (7); `tools/mutants/poi4b.json` 23, all dead. AUDIT POI: the shelf in
`test/poi/auditpoi_store.test.js` (S8, S10, U13), placing in `test/scenes/auditpoi_editor.test.js` (E6, E11), the picture in
`test/poi/auditpoi_uv.test.js` (M8, M12), the entry in `test/poi/auditpoi_packs.test.js` (T3).

## POI-5 - the material editor and the UV editor (2026-10-14)

Mac, asked what "UV map" covers: **"Full UV editor"**.

- **THE MATERIAL EDITOR** (`src/ui/poi/poiEditorPanel.js`, a part's materials in the inspector): its picture and its glow
  picture - **Choose...** a file, read by its header (`decodeImage`, the import's reader: one the store would refuse is
  said in words and nothing is uploaded), uploaded once by its name and worn as one step; **Take off**. The glow's colour
  and its strength (the colour times the strength, up to 16 - KHR_materials_emissive_strength's meaning). Where the
  picture lies: its offset, its repeats, its turn (in degrees on the panel, radians in the document). **Edit UVs...**
  opens the UV editor over that material.
- **THE UV EDITOR'S GEOMETRY** (`src/poi/uv/uvMesh.js`, pure): a mesh as its triangles' corners, each with a UV, its
  vertices WELDED by position (within `weldEps` on every axis, wherever they fall on its grid - AUDIT POI M10: a
  rounding had opened edges); an edge is a SEAM where its faces disagree on its UVs (the model's own seams found, never
  invented; the builder marks or clears more); an ISLAND, for the unwrap, the faces reached across edges that are not
  seams, and for the tools - pick, box, pack, density - the faces the UVs hold together, joined across an edge only
  where it is no seam and both faces agree on its UVs (M3: a projection had parted the UVs and left the seams, and pack
  laid islands over each other); a UV VERTEX every corner of an island at one point. UVs in glTF's order (v down from
  the picture's top) - the game turns them at the draw. The tools: move, turn and size about a point, flip; PROJECTIONS
  (planar along X, Y or Z, box, cylindrical, spherical) in metres, a unit of UV a metre, the picture never mirrored as
  the face is seen from its front, a corner on a curved projection's axis taking its face's others' mean angle (AUDIT
  POI M7: a sphere's polar triangles had run up to 15 segments wide); the UNWRAP by least-squares conformal maps (Levy
  et al. 2002) - per island, split into the pieces its real faces hold together across edges (a face not on three welds,
  or of no area, left out and its corners given their weld-mates' UVs - AUDIT POI M1, M2: one had sent a whole island to
  the fallback, or hung two parts on a hinge), each piece's two farthest vertices pinned, the normal equations assembled
  triangle by triangle and factored DIRECTLY (`src/poi/sparseCholesky.js`: CSparse's up-looking Cholesky in its
  Hermitian form, the conformal map's own complex system - the elimination tree, each row's reach, a symbolic count
  before the numeric pass - in a geometric NESTED DISSECTION's order, its median by selection, which keeps the factor
  near-linear on a surface; an 80,000-triangle sheet in 0.8 s - M13: it had measured 4.0 s against the three this said),
  conjugate gradients only where the factor is refused, and each piece sized to its surface's area (M4: the pins' chord
  had shrunk a curved one); off the page's thread, on a worker of its own (`uvUnwrapClient.js`, `uvUnwrapWorker.js`: the
  same unwrap on this thread the fallback, `?uvthread=off`, an idle worker let go after 30 s - M13); PACKING (each
  island turned to its smallest box by the hull's edges - lying down on a tie, a tie read against the box's own size -
  shelved tallest first, the scale the largest that fits, by halving; an empty island left out, and when the islands
  cannot fit nothing moves and no step is taken, and the panel says so - AUDIT POI M9); TEXEL DENSITY read and set in
  the picture's pixels a metre. Back to a mesh (`meshFromSession`): a vertex for each distinct position and UV, split
  exactly where the UVs part, the submeshes' order kept.
- **THE UV EDITOR'S HANDS** (`src/poi/uv/uvEdit.js`, pure): one material's faces at a time; four ways to select (vertex,
  edge, face, island), a click the nearest within reach, Shift adding and taking away, a box everything inside; every
  tool over the selection (the whole material when none), turned and sized about the middle of its UV bounds (AUDIT POI
  M11), and one step of its own undo (100 steps, each holding only the corners and seams it changed, under
  `UV_UNDO_BYTES` (128 MB), the latest always kept - M6: a hundred nudges of a big part had held a gigabyte), a drag one
  step however long; a selection's corners read from a table of the UV vertices kept for each change of the UVs (M5:
  seconds a frame at 12,800 faces).
- **THE PANEL** (`src/ui/poi/poiUvPanel.js`): a dialog over the editor, a canvas - the material's picture, the square's
  grid, the faces, the seams red, the selection lit (in vertex mode the vertices selected, none when none is - AUDIT POI
  L3). 1 2 3 4 the modes, M T S the drag's tool, Ctrl+Z / Ctrl+Y, Ctrl+A, Escape - none of them taken from its fields
  (U6: "256" had left "56"); the wheel zooms at the pointer, the middle button (or Alt) pans. **Unwrap** says it is
  working and goes off the page's thread, Apply held until it answers (L2). **Apply to the part** makes the mesh again,
  uploads it by its new name and the part wears it - one step of the POI's undo, and "the part is gone" said where it is
  (U7); closing lets it all go - an Apply still going up, an unwrap still out (U7, L2) - and leaving the editor closes
  it (U8).

Pinned by `test/poi/poi5_uv.test.js` (7) and `test/ui/poi5_panel.test.js` (2); `tools/mutants/poi5.json` 19, all dead. AUDIT
POI: `test/poi/auditpoi_uv.test.js` (14), `tools/mutants/auditpoi_uv.json` 40, all dead; the panel's halves in
`test/poi/auditpoi_panels.test.js` (U6, U7, U8) and `test/poi/auditpoi_lead.test.js` (L2, L3).

## POI-6 - approvals, history, and out and back in (2026-10-14)

Mac: **"I need to be able to approve changes"**; "the ability to import models ... a tool my developers can use without
having to access the codebase".

- **APPROVALS** (`src/ui/poi/poiReviewPanel.js`; the bar's **Approvals**, an approver's alone): the oldest submissions,
  fifty to an answer and a line saying when more wait (AUDIT POI S10, C3) - its name, who sent it and how long ago, new,
  a change or a retirement, and whether it was made from a revision no longer live (approving it puts back over what
  went live since). **What it changes** against the live one (`src/poi/poiDiff.js`: renamed, moved so many metres,
  turned so many degrees - read from one quaternion times the other's inverse, so neither its other sign nor a tidied
  length is a turn (AUDIT POI P1) - resized, its ground; a part added, taken away or changed and how, matched by its
  key, its move measured in the world (P12); its lights, its mark, its words), in the approver's language (`poiText.js`
  diffText, its lists as the language lists them - U13). **The law**'s report: its problems, its assets' once every one
  is known (drawn again as each is learnt, never while a word is being typed). **Look at it** opens the submission in
  the editor and takes the eye there (`world.js` goTo: the map's own door, the eye south of the place and above it);
  **Show the live one** / **Show the submission** in turn where it stands (`poiEdit.js` showAs - this screen's alone, no
  step, no save; nothing there for a new POI's before or a retirement's after). **Approve**, or **Send back** with a
  word (a word is asked: the builder is told why) - one word a submission (AUDIT POI U12), naming the document seen
  (`docSha`): a submission changed since is refused, said, and the queue asked again (S1, C1). The look closes with the
  verdict, and the feed is asked at once (R13, C7).
- **HISTORY** (a POI's inspector, once the store has it): every revision, newest first - its state, author, how long
  ago, the reviewer's word, which is in the world now. **Open this one**: that revision as the working document, saved
  as the live one is - so a revision that is not the live one opens as a change to save and send. An approver **puts
  back** an earlier approved revision as the live one, asked twice - offered only on a revision with a document,
  recorded as a revision of its own and drawn as one, a taken-back retirement said in words (AUDIT POI S14, C2), the
  history drawn again in place (U12, P8: a reload had reopened it over what was opened since).
- **A MODEL BACK OUT** (`src/poi/gltfExport.js`; **Export model (.glb)** in a POI's inspector, **Save as .glb** on a
  library entry): one .glb a builder opens in their own tool. The importer's conversion turned back - X mirrored
  (positions, normals, translations; a rotation (x, -y, -z, w)), every winding reversed - one node a part with its
  offset, turn and size, one mesh a part and a primitive a submesh; materials as the importer reads them (base colour
  and picture, the colours written LINEAR - AUDIT POI R10 - the glow normalised with KHR_materials_emissive_strength
  past one and written as computed, none at strength 0 (G4: it had come back glowing), cut, both sides, metallic 0 and
  roughness 1, the picture's offset, repeats and turn as KHR_texture_transform), pictures embedded as stored (WebP by
  EXT_texture_webp, required), lights as KHR_lights_punctual in its own units - candela (the intensity times pi), a
  linear colour, the radius its range - with the game's numbers in the light's `extras.poi` (G7). Read back by the
  editor's own importer, every corner where it stood (to 1e-5 m), in the same winding, with the same normals, as many
  vertices (G2) and the same lights.
- **A PACK** (`src/poi/poiPack.js`, `src/poi/poiTransfer.js`; **Export pack** and **Import pack...**): the POIs open in
  the editor as one .zip - `pack.json` (`{ v: 1, kind: 'poi-pack', pois, shelf }`) and every asset they name under
  `assets/<sha>.mesh|png|jpg|webp` - written STORED (`saveTransfer.js` zipStore), never one the reader would refuse -
  each document held to the law and the pack's bounds before a byte is fetched (AUDIT POI P2: a new POI with no part had
  made a pack that would not open) - and read by the port's own zip reader (`dataSource.js` readZipEntries: stored or
  deflated) through `readPackBytes`: only `pack.json` and the assets it names inflated, each to its declared size and
  its kind's bound, the whole to the pack's (P5, L4: a 255 KiB pack had inflated 256 MiB), one shared top folder and
  `__MACOSX/` passed by (P10). Read, nothing is trusted: each asset hashed against its name and read as its kind, each
  document and entry held to the law and to what it wears against the pack's own assets (AUDIT POI P3: the store had
  refused an entry halfway), each id once (P7), each name used present - refused whole by code otherwise (`poiText.js`
  packErrorText); a file nothing names not kept (P11). Imported: what it holds shown first; then every asset uploaded by
  its name, every library entry put - the store asked first: one it holds alike left as it is, one that differs never
  written over but put under a copy's id of its own, the same at every import, an entry taken off passed by (AUDIT POI
  P4: an approver's import had written over another builder's entry) - and every POI opened - as a change to the live
  one where the store knows it, a draft where it has no live one (T1), else as new; a POI the builder has open with
  unsaved changes is left as it is, and said. Cancel stops it - nothing more uploaded, nothing opened (U9); a refusal
  says the store's word, where, and the law's problems (C5, L5).

Pinned by `test/poi/poi6_review.test.js` (8); `tools/mutants/poi6.json` 21, all dead. AUDIT POI:
`test/poi/auditpoi_packs.test.js` (10), the queue, history and pack dialogs in `test/poi/auditpoi_panels.test.js`, the round
trip in `test/poi/auditpoi_gltf.test.js`, `test/poi/auditpoi_lead.test.js` (L4, L5); `tools/mutants/auditpoi_packs.json` 57, all
dead.
