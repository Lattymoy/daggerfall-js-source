// @ts-check
// HARD3 - THE RENDERER'S CONTRACT, WRITTEN DOWN (2026-09-14).
//
// The third slice of `01-Overview/Hardening.md`, and the boundary it
// names first. The Weapon Widget crash was a SHAPE mismatch here, and
// this is the one boundary in the port where a wrong shape THROWS rather
// than misbehaves: the caller builds an object, the renderer hands its
// fields to WebGL, and WebGL is not forgiving about what it is given.
//
// So the shapes cross a documented contract now instead of a `{object}`.
// This module exports NO CODE - it is types only, and the bundle never
// sees it. That is deliberate: a contract that can be imported for its
// behaviour stops being a contract and becomes another dependency.
//
// WHAT IS AND IS NOT HERE. Only shapes that cross the boundary between a
// host and the renderer. The renderer's private scratch is not a contract
// and does not belong here; neither does anything a host passes only to
// itself.

/**
 * ONE BILLBOARD BATCH: every flat of one (archive, record), four verts
 * each, indexed quads. `Renderer.createBillboardBatch` mints it and
 * `destroyBillboardBatch` ends it - EVERY ALLOCATION HAS AN OWNER, and
 * for this one the owner is whichever context built it (HARD1).
 *
 * The first six fields are the renderer's own and are set at birth. The
 * last four are the CALLER'S - the fields a host writes between frames to
 * move, lean, conceal or animate its batch - which is why they are
 * optional and why they are written down: eight files outside `render/`
 * set them, and until now nothing said what they were.
 *
 * PERF-EXT10 (2026-09-25): and every field below is MINTED at birth, the
 * ones nobody has written yet as undefined, so a batch has one hidden
 * class for life (renderer.js createBillboardBatch says why) - all but
 * the shadow record's origin, `_shOx`/`_shOy`/`_shOz`, born NaN (the
 * review): a field born undefined is a tagged slot, and every fractional
 * origin stored into it every frame was a fresh heap number. The last
 * block is the renderer's own bookkeeping - the key's memory
 * (billboardKey.js) and the shadow pass's (shadowPass.js recordBillboards
 * and the static signature) - declared so the mint and this list stay one.
 *
 * @typedef {object} BillboardBatch
 * @property {WebGLVertexArrayObject|null} vao        the quad geometry (nulled by destroyBillboardBatch)
 * @property {number} indexCount                      6 per flat
 * @property {number} archive                         the texture archive
 * @property {number} record                          the record within it
 * @property {{w: number, h: number}} size            the flat's world size
 * @property {WebGLBuffer[]} buffers                  vertex + index, freed together
 * @property {number[]|null} [origin]                 a per-frame translation of the whole batch (missiles, peers, markers); null means the centers as uploaded
 * @property {number|null} [frame]                    FA1: null for a still flat, a frame INDEX for an animated one, folded into the texture key
 * @property {number} [sway]                          WIND3: this batch's share of the wind's lean - the flora have one, nothing else does
 * @property {object|null} [conceal]                  ECV1: the concealment visual, which moves the batch into the blended pass
 * @property {Float32Array} [bounds]                  EL5: the sphere [cx, cy, cz, r] about the origin the shadow and air replays cull by
 * @property {number} [_quads]                        BLOOD1b: how many quads the buffer holds, so `moveBillboardBatch` cannot write past it
 * @property {boolean} [_dyn]                         BLOOD1b: born DYNAMIC_DRAW, because its centres move every frame
 * @property {object|null} [_place]                  PERF-EXT1: a static batch's placements on a grid (bounds.js placementGrid) - the shadow pass asks its QUADS; null for one flat, one built dynamic, one moved; and its quads' half-diagonal, once a size (placedHalfDiagonal, the review)
 * @property {Float32Array} [_moveScratch]            BLOOD1b: the move's own vertex staging, kept rather than re-minted each frame
 * @property {number[]} [_box]                        EV3: the host's cull box [minX, minY, minZ, maxX, maxY, maxZ] (flatBatchAabb)
 * @property {boolean} [noShadow]                     F2: a thing lying on the ground casts nothing (a loot pile)
 * @property {boolean} [selfCard]                     DISC24-C: the player's own body card - it casts as drawn
 * @property {boolean} [_dead]                        EL2: freed - a shadow record from the last frame may still hold it
 * @property {string} [_bbKey]                        FA1/MAC4: the texture key, re-minted when a field it is made of moves (billboardKey.js)
 * @property {number|string} [_bbKeyRecord]           ...the record it was minted from
 * @property {number|null} [_bbKeyFrame]              ...the frame
 * @property {number} [_bbKeyArchive]                 ...the archive
 * @property {number} [_shGen]                        SC1: the floating origin's generation the pass last saw it in
 * @property {boolean} [_shSeen]                      SC1: recorded at least once
 * @property {number} [_shOx]                         SC1: the origin it was last recorded at, x (NaN until then - a double from birth, read only once `_shSeen`)
 * @property {number} [_shOy]                         ...y
 * @property {number} [_shOz]                         ...z
 * @property {number} [_shFrame]                      AUDIT SC1: the frame it was last recorded on (-1 for a still flat)
 * @property {number|string} [_shRec]                 AUDIT REACH: the record it was last recorded on
 * @property {boolean} [_shFlip]                      AUDIT REACH: the flip it was last recorded with (the sign of size.w)
 * @property {boolean} [_shDyn]                       SC1: a mover this frame - the dynamic replay's, not the cache's
 * @property {boolean} [_shSway]                      SHADOW-REACH: moving by the wind alone (the slow cadence)
 * @property {number} [_shMovedAt]                    SC1: the pass's frame number it last moved on
 * @property {number} [_shId]                         SC1: its identity in the static signature, minted on first sight
 */

/**
 * ONE MESH BUNDLE, as `Renderer.createMesh` returns it and `destroyMesh`
 * ends it. `_wire` is the automap's lazily-built wireframe cache and dies
 * with the mesh (ROAD-C c2/S6).
 *
 * @typedef {object} MeshBundle
 * @property {WebGLVertexArrayObject|null} vao
 * @property {WebGLBuffer[]} buffers
 * @property {Array<object>} subMeshes
 * @property {string} [name]
 * @property {number} [modelId]
 * @property {{vao: WebGLVertexArrayObject, ebo: WebGLBuffer}|null} [_wire]
 * @property {Float32Array} [bounds]                  EL5: the local sphere [cx, cy, cz, r]; each sub-mesh carries its own as `_bounds`
 */

/**
 * A DECODED IMAGE, in the one shape every upload path takes - the port's
 * color32 shape, `{ width, height, colors }`. Row 0 of `colors` is the
 * picture's BOTTOM row (`formats/color32Order.js` has the whole
 * convention and why a PNG-shaped door must convert on the way in).
 *
 * `colors` is a typed-array VIEW of RGBA8, which is why `color32Bytes`
 * exists and why AUDIT 19 F7 was a bug: handing the underlying buffer
 * instead of the view uploads the wrong bytes when the view is offset
 * into a larger allocation.
 *
 * HARD3, writing this down, found that the view is not always 8-bit.
 * `net/remotePlayers.js` composes its paper doll as a `Uint32Array` over
 * the same bytes and `asBytes` reinterprets it, which works and is
 * deliberate - but it means the WIDTH of the view is not part of the
 * contract, only its bytes are. Anything that reads `colors` as elements
 * rather than handing it to `asBytes` is reading a shape this door does
 * not promise (and would be reading it little-endian, at that).
 *
 * @typedef {object} Color32
 * @property {number} width
 * @property {number} height
 * @property {ArrayBufferView} colors  RGBA8 BYTES, through a view of any element width
 */

/**
 * WHAT A MODULE NEEDS FROM THE RENDERER. Not the whole class - the
 * handful of methods a system or a net module actually calls. A module
 * that declares this instead of `{object}` gets its calls checked, and
 * the headless tests get a shape they can honestly fake.
 *
 * The (archive, record) pair is `number|string` on purpose and not by
 * accident: the texture cache is keyed by the PAIR, and the port uses a
 * string pair for art that has no DFU archive - the first-person weapon
 * uploads as ('img', 'fpw:<file>:<material>:<record>:<frame>'). One key
 * space, two kinds of name.
 *
 * @typedef {object} RendererLike
 * @property {(archive: number|string, record: number|string, color32: Color32, opts?: object) => any} uploadTexture
 * @property {(archive: number|string, record: number|string) => void} [releaseTexture]
 * @property {(archive: number|string, record: number|string, size: {w: number, h: number}, centers: number[][], opts?: {dynamic?: boolean}) => BillboardBatch} createBillboardBatch
 * @property {(batch: BillboardBatch|null) => void} [destroyBillboardBatch]
 * @property {(batch: BillboardBatch|null, centers: number[][]) => boolean} [moveBillboardBatch] BLOOD1b: rewrite a dynamic batch's centres in place - the one thing in this tree that flies
 * @property {Map<string, any>} [textures] the live texture cache, keyed `archive_record` - read to skip a re-upload
 */

export {};
