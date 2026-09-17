// @ts-check
// ONLINE1 (2026-09-12): THE OTHERS, DRAWN. Mac: "if using classic, you'd
// see the other user's paperdoll; if using enhanced, you would see the
// other person's Morrowind sprite" - and, of a client without the
// Morrowind data, "acceptable" that it sees the paperdoll instead. This
// iteration draws every peer as their PAPERDOLL: the same composite the
// inventory shows, minus its panel background, cropped to the figure and
// stood on the ground as a billboard at the peer's feet, the name over
// its head. With the Morrowind layer on, the
// body instead (MWBODY1, net/peerBodies.js: one rig instance per
// peer), the doll standing wherever a body does not. Recorded in
// Online-Arc.md.
//
// THE LOOK travels in the hello (net/online.js): race, gender, face,
// and the equipped items' doll fields (paperdollItemImage reads
// templateIndex, group, material, dye, variant, equipSlot). A stub
// entity with those and an equip table stands in for the peer at the
// compositor's PURE door (ui/paperDoll.js composePaperDollPixels, AUDIT
// ONLINE C1-C4): its own art set, its own buffer, nothing of the
// inventory's doll read or written - the first cut composed through
// the singleton and could hand the inventory a stranger's doll, or the
// stranger the player's, panel and all.
import { composePaperDollPixels } from '../ui/paperDoll.js';
import { equipTableOf } from '../systems/equip.js';
import { createEquipTable } from '../characters/equipTable.js';
import { CAPSULE_HEIGHT } from '../player/motor.js';
import { drawText, measureText } from '../ui/text.js';
import { projectToScreen } from '../player/tapRay.js';   // one home (audit24 onehome): the touch layer's own projection
import { LOOK_ITEM_FIELDS, LOOK_GROUPS } from './wire.js';   // the look's vocabulary: the wire's own

export { LOOK_ITEM_FIELDS, LOOK_GROUPS };

/** A synthetic archive for the peers' dolls - no TEXTURE.### is this high. */
export const PEER_ARCHIVE = 900000;
/** The figure's height on the ground: the player's own capsule. */
export const PEER_HEIGHT = CAPSULE_HEIGHT;
/** Names farther than this, in scene units, are not drawn. */
export const NAME_RANGE = 60;

// ── NAME1 (2026-09-16, Mac: "Player names clip and cut off the top of the sprite head and additionally grow in size
// the further away + are able to be seen through walls") ─────────────────────────────────────────────────────────
//
// THREE FAULTS, ONE ROOT: the label was drawn at a CONSTANT pixel size with its TOP-LEFT on the head point and no
// sight test at all. So it hung DOWN over the skull (the clip), it kept its pixel size while the sprite shrank with
// depth (which reads as "grows the further away"), and a wall was nothing to it. The three laws below are the
// answer, and they live HERE rather than in either drawing pass because there are two faces now - the enhanced
// skin's DOM layer (ui/nameLayer.js) and the classic bitmap pass (drawNames) - and a law kept in one of them would
// drift from the other by the end of the week.

/** The gap, in screen pixels, between the top of the head and the BOTTOM of the label. Screen-space and fixed: the
 *  anchor already rides the body (it is the head point, projected), so a second world-space lift would only make the
 *  clearance swing with depth - which is the thing that went wrong. Small, because the label hangs off the head and
 *  a large gap reads as a label floating over nobody. */
export const NAME_GAP_PX = 5;
/** The depth, in scene units, at which a name is drawn at scale 1. A fixed world height projects to `f * H / depth`
 *  pixels, so `REF / depth` IS the perspective law - the label shrinks exactly as the body under it does. */
export const NAME_SCALE_REF = 18;
/** Below this the name stops being a word. A peer past `NAME_SCALE_REF / NAME_SCALE_MIN` (32.7 units) holds it. */
export const NAME_SCALE_MIN = 0.55;
/** And above this a name in your face would be a banner. Held from `NAME_SCALE_REF / NAME_SCALE_MAX` (12) in. */
export const NAME_SCALE_MAX = 1.5;
/** The label's height in CSS pixels at scale 1 - the DOM face's font-size, and the number the bitmap face's own
 *  scale is measured against. */
export const NAME_BASE_PX = 16;
// ── AUDIT NAME1 F3: THE SIZE IS THE FRAME'S, NOT THE SCREEN'S ─────────────────────────────────────────────────
// `REF / depth` alone is a law about the WORLD. What a player reads is PIXELS, and a pixel is a different slice of
// the view on a 400-px-tall phone than on a 900-px desktop, and a different slice again at FOV 120 than at FOV 60
// (ui/viewSettings.js - the player's own setting, read every frame). A fixed world height lands on
// `H / (2 * depth * tan(fov/2))` viewport pixels, so the two terms below are exactly what the pure depth law was
// missing: at FOV 120 the sprite is three times smaller and the name used to be the same size, and on a phone a
// 16-px label is two and a bit times the share of the screen it takes on a desktop.
//
// THEY ARE KEPT APART from `nameScaleFor` on purpose. The depth law is the one number BOTH faces read off the
// point; the terms below are measured in each face's OWN pixels - the DOM face in CSS px (so it takes the viewport
// term by value) and the classic bitmap face in drawing-buffer px, where the host's own `hudScale` (ui/hud.js: the
// 320x200 fit) is already that term. The LENS term belongs to neither face in particular - it is the lens both of
// them drew the sprite through - so it rides the point itself.
/** The viewport height, in a face's own pixels, the size law is normalised at. */
export const NAME_REF_H = 900;
/** And the lens: 60 degrees vertical - FOV_MIN, and the `Math.PI / 3` the port's five hosts drew with for nine
 *  milestones before Video/FieldOfView was wired. At the reference height and this lens every term below is 1, so
 *  `NAME_SCALE_REF / depth` still IS the whole law on the frame it was tuned on. */
export const NAME_REF_FOV = Math.PI / 3;
export const NAME_REF_FOCAL = 1 / Math.tan(NAME_REF_FOV / 2);
/** The band a DOM label's final size is held inside, in CSS px. A name is a thing to READ: the perspective terms
 *  may shrink it to a fifth of the base (a far peer on a phone at FOV 120) and that is smaller than a letter. The
 *  player's own HUD scale is applied OUTSIDE this band - it is a request, not an accident. */
export const NAME_PX_MIN = 9;
export const NAME_PX_MAX = 30;

/**
 * THE LENS TERM, off the projection the frame was drawn with: `proj[5]` is `1 / tan(fovY / 2)` for every
 * perspective this port builds (world/mat4.js perspective; mirrorProjectionX touches column 0 alone), so the name
 * is read out of the SAME matrix the sprite was projected by and cannot drift from a host's FOV wiring.
 * @param {ArrayLike<number>|null|undefined} proj
 */
export function nameLensScale(proj) {
  const f = Number(proj?.[5]);
  if (!Number.isFinite(f) || f <= 0) return 1;   // no lens to read is the reference lens
  return f / NAME_REF_FOCAL;
}

/** THE VIEWPORT TERM, for a face measured in CSS pixels: the world viewport's height against the reference. */
export function nameViewportScale(h) {
  if (!Number.isFinite(h) || h <= 0) return 1;
  return h / NAME_REF_H;
}

/**
 * THE DOM FACE'S FONT SIZE, in CSS px: the point's own scale (depth and lens), the viewport term, held inside the
 * legible band, and the player's HUD scale on top of that.
 */
export function namePixelSize(scale, viewport = 1, hudScale = 1) {
  const s = Number.isFinite(scale) ? scale : 1;
  const v = Number.isFinite(viewport) && viewport > 0 ? viewport : 1;
  const hud = Number.isFinite(hudScale) && hudScale > 0 ? hudScale : 1;
  return Math.max(NAME_PX_MIN, Math.min(NAME_PX_MAX, NAME_BASE_PX * s * v)) * hud;
}
/** How far short of the head the sight ray stops, in scene units. A peer's own body is not in the collider (peers
 *  are billboards and rigs, never triangles), but the floor, a doorframe or the lip of the arch they stand under can
 *  sit within a hand's breadth of the head point and would otherwise blind every name in a doorway. The same posture
 *  player/activate.js pickFoeAlong takes with its own 0.05 (`wall < d - 0.05`), at a head's scale. */
export const NAME_SIGHT_SKIN = 0.2;

/**
 * THE SIZE LAW, pure. `REF / depth`, clamped both ends - monotone non-increasing in depth, and inside the band a
 * peer twice as far away wears a name half the size.
 * @param {number} depth the view-space depth of the head point (player/tapRay.js projectToScreen's `depth`)
 */
export function nameScaleFor(depth) {
  if (!Number.isFinite(depth) || depth <= 0) return NAME_SCALE_MAX;   // a point on the lens is as near as a point can be
  return Math.min(NAME_SCALE_MAX, Math.max(NAME_SCALE_MIN, NAME_SCALE_REF / depth));
}

/**
 * THE SIGHT LAW: is solid world standing between the eye and this head point?
 *
 * WHY THE COLLIDER AND NOT A DEPTH TEXTURE. The port's frame is not rendered to a target in the shipping hosts - it
 * draws to the default framebuffer - so a depth read at the projected point would mean either a new render target
 * for every frame of every host or a `readPixels` stall in the middle of one, and it would answer for the pixel
 * rather than for the peer (a flat in front of the head, a raindrop, the player's own weapon). The collider's
 * `raycast` is the test this engine ALREADY uses for exactly this question - `pickActivatableHit` rejects an
 * activatable behind a wall with it, `pickFoeAlong` rejects a foe behind one - it is one ray a peer a frame against
 * a uniform grid, and it is the same triangles the player cannot walk through. So the name obeys the same wall the
 * body does.
 *
 * WHAT IT CANNOT SEE, said out loud: the collider holds TRIANGLE BUCKETS - buildings, models, city gates, windmill
 * towers, action doors, an interior's or a dungeon's mesh - and the exterior's TERRAIN is not one of them
 * (player/collider.js keeps the ground as a `heightAt` floor for the capsule, and `raycastHit` walks buckets alone).
 * So out in the open a HILL between two players hides the body and not the name. That is a known, named limit and
 * not a silent one: it is the exterior's own shape, the same one player/socialPick.js records for the F-menu's
 * cylinder, and closing it would mean a terrain ray this engine does not have.
 *
 * @param {{raycast?: (o: number[], d: number[], m: number) => number}|null|undefined} collider the LIVE one
 * @param {number[]} eye
 * @param {number[]} head
 * @param {number} [skin]
 * @returns {boolean} true when the name must not be drawn
 */
export function sightBlockedBy(collider, eye, head, skin = NAME_SIGHT_SKIN) {
  if (typeof collider?.raycast !== 'function' || !eye || !head) return false;   // no collider is no wall: a host without one draws every name, as it always did
  const dx = head[0] - eye[0], dy = head[1] - eye[1], dz = head[2] - eye[2];
  const d = Math.hypot(dx, dy, dz);
  const reach = d - skin;
  if (!(reach > 0)) return false;   // a head inside the skin is not behind anything
  const hit = collider.raycast([eye[0], eye[1], eye[2]], [dx / d, dy / d, dz / d], reach);
  return Number.isFinite(hit) && hit < reach;
}

/** AUDIT NAME1 F2: how often a peer's sight line is actually re-cast, in ms. A ray is the one per-frame cost that
 *  scales with the crowd, and nothing a player can see changes in a tenth of a second: at 60 fps this is one ray a
 *  peer every nine frames instead of nine. */
export const NAME_SIGHT_MS = 150;
/** AUDIT NAME1 F5: and how long the ray must keep saying "blocked" before the name goes, in ms. ONE un-hysteresised
 *  ray strobes: a railing, a lamppost or the edge of a doorframe crossing the line for a frame took the name away
 *  and the DOM face REBUILT the element when it came back (measured: 12 nodes built, 8 appends, 5 removes over 10
 *  flickering frames). A name that waits out a flicker costs a name shown a tenth of a second behind a post; a name
 *  that does not costs the element. */
export const NAME_SIGHT_HOLD_MS = 150;
/** How long an id nobody has asked about is kept in the cache, ms. */
export const NAME_SIGHT_TTL_MS = 5000;

/**
 * AUDIT NAME1 F2/F5: THE SIGHT, CACHED AND HYSTERESISED - one object, because the two findings are one mechanism.
 * The cache is what makes the ray affordable (it is cast at most every `every` ms a peer) and the STAMP it keeps is
 * what gives the answer its hysteresis: a name is taken away only once the ray has said "blocked" for `hold` ms,
 * and is given back the instant it says "seen".
 *
 * It is keyed by PEER ID, so it is the host's to own for the session and not a frame's - a frame builds the closure
 * over it, never the cache. `rays()` is the budget, readable by a pin or a probe.
 *
 * @param {{now?: () => number, every?: number, hold?: number, ttl?: number,
 *          cast?: (c: any, eye: number[], head: number[]) => boolean}} [opts]
 */
export function createSightCache({ now = () => Date.now(), every = NAME_SIGHT_MS, hold = NAME_SIGHT_HOLD_MS,
  ttl = NAME_SIGHT_TTL_MS, cast = sightBlockedBy } = {}) {
  /** id -> { at: when the ray was last cast, raw: its answer, since: when it first said blocked, touched } */
  const seen = new Map();
  let rays = 0;
  let sweptAt = -Infinity;
  const blocked = (collider, eye, id, head) => {
    const t = now();
    if (typeof id !== 'string' || !id) { rays++; return cast(collider, eye, head); }   // no identity is no cache: ask
    let e = seen.get(id);
    if (!e) { e = { at: -Infinity, raw: false, since: null, touched: t }; seen.set(id, e); }
    e.touched = t;
    if (!(t - e.at < every)) {
      e.at = t;
      rays++;
      const raw = !!cast(collider, eye, head);
      e.since = raw ? (e.raw ? e.since : t) : null;   // the stamp survives a run of blocked answers and dies on a seen one
      e.raw = raw;
    }
    if (t - sweptAt >= ttl) { sweptAt = t; for (const [k, v] of seen) if (t - v.touched >= ttl) seen.delete(k); }
    return e.raw && e.since !== null && t - e.since >= hold;
  };
  return {
    blocked,
    rays: () => rays,
    size: () => seen.size,
    drop: (id) => seen.delete(id),
    clear: () => { seen.clear(); sweptAt = -Infinity; },
  };
}

/** The most distinct dolls kept on the GPU that NOBODY IS WEARING; past it the least recently drawn is released
 *  (AUDIT ONLINE C7).
 *  SLAM7 (2026-09-16, AUDIT SLAM): "that nobody is wearing" is the whole correction. This counted every ready doll,
 *  so once more than this many distinct looks stood in view the sweep released one that was ON SCREEN - whose batch
 *  it destroyed, which the next frame composed again, which released another. Measured over 40 frames with 199
 *  looks in view: 5,464 composes where 199 would do, 2,496 billboards destroyed, and only ever 64 peers drawn - a
 *  DIFFERENT 64 each frame, so the crowd flickered. A doll a billboard is wearing is not cache, it is the scene. */
export const DOLLS_MAX = 64;
/** A doll that failed to compose is not retried before this (AUDIT ONLINE C5). */
export const DOLL_RETRY_MS = 5000;

/** The player's look, as the hello carries it. */
export function composeLook(entity) {
  const items = [];
  const table = entity ? equipTableOf(entity) : [];
  for (let slot = 0; slot < table.length; slot++) {
    const it = table[slot];
    if (!it) continue;
    const o = {};
    for (const k of LOOK_ITEM_FIELDS) if (it[k] != null) o[k] = it[k];
    if (o.equipSlot == null) o.equipSlot = slot;
    items.push(o);
  }
  return { race: entity?.race ?? 'Breton', gender: entity?.gender ?? 'male', faceIndex: entity?.faceIndex ?? 0, items };
}

/** One string per distinct look: the doll cache's key.
 *  SLAM12 (AUDIT SLAM): MEMOISED ON THE LOOK OBJECT. This was recomputed for every peer every frame - `RemotePlayers.sync`
 *  once per doll peer and `PeerBodies.sync` once per peer - and at 199 dressed peers the `JSON.stringify` inside it
 *  was ~64% of the client's whole per-frame peer work (1.19 ms of 1.85 ms, measured). A look object is replaced,
 *  never mutated (`_peer`, `_refresh`), so its identity is exactly the key's lifetime: a WeakMap holds the string for
 *  as long as the look lives and no longer. A null look has no identity and is one constant (SLAM14 B6). */
const _keyOf = new WeakMap();
const _computeLookKey = (look) => `${look?.race ?? 'Breton'}|${look?.gender ?? 'male'}|${look?.faceIndex ?? 0}|${JSON.stringify((look?.items ?? []).map((it) => LOOK_ITEM_FIELDS.map((k) => it[k] ?? null)))}`;
const NULL_LOOK_KEY = _computeLookKey(null);   // SLAM14 (AUDIT SLAM FINAL B6): a look-less peer's key has no object to hang on - computed once, here
export const lookKey = (look) => {
  if (!look || typeof look !== 'object') return NULL_LOOK_KEY;
  let k = _keyOf.get(look);
  if (k === undefined) { k = _computeLookKey(look); _keyOf.set(look, k); }
  return k;
};

const uint = (v, max = 1e6) => (Number.isFinite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : null);

/**
 * A stand-in for the peer at the compositor: the identity fields and
 * an equip table with the look's items in their slots. The look is
 * RELAY DATA (AUDIT ONLINE C13): every field is clamped to what the
 * doll art indexes with, a group the art does not know is dropped,
 * and the table's 27 slots bound the items.
 */
export function peerStubEntity(look) {
  const entity = { race: typeof look?.race === 'string' ? look.race.slice(0, 16) : 'Breton', gender: look?.gender === 'female' ? 'female' : 'male', faceIndex: uint(look?.faceIndex, 9) ?? 0, items: [], activeEffects: [], equip: createEquipTable() };
  const slots = entity.equip.slots.length;
  for (const it of look?.items ?? []) {
    if (!it || typeof it !== 'object' || entity.items.length >= slots) continue;
    const templateIndex = uint(it.templateIndex, 65535);
    const slot = uint(it.equipSlot);
    if (templateIndex == null || slot == null || slot >= slots || !LOOK_GROUPS.includes(it.group)) continue;   // a slot past the table is dropped, not clamped onto another
    const item = { templateIndex, group: it.group, equipSlot: slot };
    for (const k of ['material', 'dye', 'variant']) { const v = uint(it[k], 4095); if (v != null) item[k] = v; }
    entity.items.push(item);
    if (!entity.equip.slots[slot]) entity.equip.slots[slot] = item;
  }
  return entity;
}

/**
 * The figure's bounds in an RGBA buffer - the rows and columns with any
 * alpha - or null when it is empty (AUDIT ONLINE C11: the panel's
 * headroom and floor margin are not the figure, and a billboard the
 * panel tall stood the doll short and floating).
 */
export function alphaBounds(rgba, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** A sub-rectangle of an RGBA buffer, copied out. `bottomUp` writes
 *  the rows in reverse (OD1, 2026-09-12, Mac: "Paperdoll is upside down
 *  when viewing other players in multiplayer"): the compositor's
 *  buffer is a UI image, row 0 at the top, while the billboard shader
 *  samples GL's bottom-up texel order (render/renderer.js's header and
 *  its vUV note - "the quad top samples v = 1"). Every other billboard
 *  arrives from TextureFile.getColor32 already bottom-up; this one was
 *  the only top-down buffer ever handed to createBillboardBatch, so
 *  the peers stood on their heads. */
export function cropRgba(rgba, w, r, { bottomUp = false } = {}) {
  const out = new Uint8Array(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) {
    const dst = bottomUp ? r.h - 1 - y : y;
    out.set(rgba.subarray(((r.y + y) * w + r.x) * 4, ((r.y + y) * w + r.x + r.w) * 4), dst * r.w * 4);
  }
  return out;
}

let _dollSeq = 0;   // the record keys, monotonic (AUDIT ONLINE C10: a size-and-millisecond key could repeat)

/** The peers of a session, as billboards and names. */
export class RemotePlayers {
  /**
   * @param {object} p
   * @param {import('../render/contract.js').RendererLike} p.renderer
   * @param {{fetchBytes: Function, palette: object, getTexture?: Function}|null} p.deps  the compositor's
   * @param {Function} [p.compose] the compositor's door (composePaperDollPixels); a test hands in its own
   * @param {Function} [p.now]
   */
  constructor({ renderer, deps, compose = composePaperDollPixels, now = () => Date.now() }) {
    this.renderer = renderer;
    this.deps = deps;
    this._compose = compose;
    this._now = now;
    this._dolls = new Map();     // lookKey -> { rec, w, h } ready | Promise composing | { failedUntil } (insertion-ordered: the oldest first)
    this._batches = new Map();   // peer id -> { batch, key, doll, peer }
    this._shown = [];            // the last sync's drawable peers with their head heights - the name pass reads it
    this._wanted = new Set();    // SLAM7: the look keys the last sync ASKED FOR - composed or composing, drawn or not
    this._queue = Promise.resolve();
  }

  /** The doll for a look: composed once per look, serialized; a failure waits DOLL_RETRY_MS before another try. */
  dollFor(look) {
    const key = lookKey(look);
    const have = this._dolls.get(key);
    if (have && have.failedUntil != null) {
      if (this._now() < have.failedUntil) return null;
      this._dolls.delete(key);
    } else if (have) return have;
    const p = (this._queue = this._queue.then(() => this._composeDoll(look)).catch(() => null));
    this._dolls.set(key, p);
    p.then((doll) => {
      // SLAM12 (AUDIT SLAM): a doll that lands after its key was released - by `_evict`, or by `destroy()` at the
      // page's hide - has a texture on the GPU that nothing references. It used to be orphaned here. Measured: sync
      // fifty peers, destroy, fifty textures uploaded, none released.
      if (this._dolls.get(key) !== p) { if (doll && typeof doll.rec === 'string') this.renderer.releaseTexture?.(PEER_ARCHIVE, doll.rec); return; }
      if (doll) { this._dolls.set(key, doll); } else this._dolls.set(key, { failedUntil: this._now() + DOLL_RETRY_MS });
      this._evict();   // SLAM4: a FAILURE sweeps too - it was the one outcome that never reached the eviction
    });
    return p;
  }

  async _composeDoll(look) {
    const { deps, renderer } = this;
    if (!deps || !renderer) return null;
    const px = await this._compose(deps, peerStubEntity(look), { context: 'town', background: false });
    if (!px?.rgba) return null;
    const r = alphaBounds(px.rgba, px.width, px.height);
    if (!r) return null;
    const crop = cropRgba(px.rgba, px.width, r, { bottomUp: true });   // OD1: the billboard samples bottom-up
    const rec = `doll_${++_dollSeq}`;
    renderer.uploadTexture(PEER_ARCHIVE, rec, { width: r.w, height: r.h, colors: new Uint32Array(crop.buffer) });
    return { rec, w: PEER_HEIGHT * (r.w / r.h), h: PEER_HEIGHT };
  }

  /** The looks the scene needs right now: the ones the last sync ASKED FOR - drawn, or composing and not yet handed
   *  over. Neither is cache.
   *  SLAM7: the composing half is not a nicety. A doll composes between one frame and the next, so for that gap no
   *  batch is wearing it - and a sweep run by another compose finishing in the same gap released it unworn, before
   *  it was ever drawn once. That alone cost 213 of the 412 composes the first cut of this fix still paid at 199
   *  looks; with it the count is exactly the 199 the room actually has.
   *  SLAM15 (AUDIT SLAM FINAL B4): this used to union the WORN keys in as well, and that half was redundant by
   *  construction - `sync` adds every drawn peer's key to `_wanted` before it touches the peer's batch and destroys
   *  the batch of every peer it did not draw, and `destroy()` empties both - so after any sync every batch's key is
   *  already in `_wanted`. The invariant is pinned (slam15); the set is the wanted set. */
  _needed() { return this._wanted; }

  /** SLAM7: this map is its own LRU list - a key used this frame is moved to the END, so `_evict` walking from the
   *  front releases the least recently DRAWN. Before this the order was first-ever-composed and never changed
   *  again, however long a look had been on screen: not FIFO by use, FIFO by birth. */
  _touch(key) {
    const v = this._dolls.get(key);
    if (v === undefined) return;
    this._dolls.delete(key);
    this._dolls.set(key, v);   // the same value, so dollFor's `this._dolls.get(key) !== p` identity check still holds
  }

  /** Past DOLLS_MAX ready dolls THE SCENE DOES NOT NEED, the least recently drawn goes: its texture released, the
   *  batches wearing it dropped (SLAM7: there are none, by construction - that is the point). */
  /** SLAM4: AND THE FAILURES AGE OUT. `_evict` counts only the READY dolls, so the `{ failedUntil }` records left by
   *  a look that would not compose were never counted and never swept - only re-asking for that exact look cleared
   *  one, and a look nobody wears again is never asked for. Every distinct broken look a session sees stayed in this
   *  map for its whole life. Small each; unbounded in a crowd, which is what an event is. */
  _evict() {
    const now = this._now();
    for (const [k, v] of [...this._dolls]) if (v && v.failedUntil != null && now >= v.failedUntil) this._dolls.delete(k);
    const needed = this._needed();
    while (true) {
      let spare = 0, oldest = null;
      for (const [k, v] of this._dolls) if (v && typeof v.rec === 'string' && !needed.has(k)) { spare++; if (!oldest) oldest = k; }
      if (spare <= DOLLS_MAX || !oldest) return;
      this._release(oldest);
    }
  }

  _release(key) {
    const doll = this._dolls.get(key);
    this._dolls.delete(key);
    if (!doll || typeof doll.rec !== 'string') return;
    for (const [id, e] of this._batches) {
      if (e.key !== key) continue;
      this.renderer.destroyBillboardBatch?.(e.batch);
      this._batches.delete(id);
    }
    this.renderer.releaseTexture?.(PEER_ARCHIVE, doll.rec);
  }

  /**
   * Once a frame: a batch per drawable peer whose doll is ready, at
   * the peer's feet in the SCENE frame (`toScene` maps a room pose to
   * it); a peer whose look changed gets a new batch (AUDIT ONLINE
   * C12); the batches of peers gone are released.
   */
  /**
   * HARD3: `bodyHeight` is called with a peer id, and its default took
   * none - so the DEFAULT was the documented signature and the real one
   * went unwritten. The annotation is the contract; the default still
   * answers 0 for every peer.
   * @param {Iterable<any>} peers
   * @param {(p: any) => number[]} [toScene]
   * @param {{bodyHeight?: (id: any) => number}} [opts]
   */
  sync(peers, toScene = (p) => [p.x, p.y, p.z], { bodyHeight = () => 0 } = {}) {
    const live = new Set();
    this._shown = [];   // every drawable peer, doll or body, for the name pass
    this._wanted = new Set();   // SLAM7: rebuilt every frame - a look nobody is standing in any more stops being needed at once
    for (const peer of peers) {
      if (!peer?.shown) continue;
      // MWBODY1: a peer standing in a Morrowind body (net/peerBodies.js) draws no doll; its name still rides this pass, at the body's own head
      const bodyH = bodyHeight(peer.id);
      if (bodyH > 0) { this._shown.push({ peer, height: bodyH }); continue; }
      live.add(peer.id);
      const key = lookKey(peer.look);
      this._wanted.add(key); this._touch(key);   // SLAM7: asked for this frame, so it is needed and it is the newest thing in the cache
      let entry = this._batches.get(peer.id);
      if (entry && entry.key !== key) { this.renderer.destroyBillboardBatch?.(entry.batch); this._batches.delete(peer.id); entry = null; }
      if (!entry) {
        const doll = this._dolls.get(key);
        if (!doll || typeof doll.rec !== 'string') { this.dollFor(peer.look); continue; }   // composing, or waiting out a failure
        const batch = this.renderer.createBillboardBatch(PEER_ARCHIVE, doll.rec, { w: doll.w, h: doll.h }, [[0, 0, 0]]);
        batch.origin = [0, 0, 0];
        entry = { batch, key, doll, peer };
        this._batches.set(peer.id, entry);
      }
      const f = toScene(peer.shown);
      entry.batch.origin[0] = f[0]; entry.batch.origin[1] = f[1]; entry.batch.origin[2] = f[2];
      entry.peer = peer;
      this._shown.push({ peer, height: entry.doll.h });
    }
    for (const [id, entry] of this._batches) {
      if (live.has(id)) continue;
      this.renderer.destroyBillboardBatch?.(entry.batch);
      this._batches.delete(id);
    }
  }

  /** The batches for the hosts' billboard pass. */
  batches() {
    const out = [];
    for (const e of this._batches.values()) out.push(e.batch);
    return out;
  }

  /**
   * The names over the heads, in the HUD's own pass (after the 3D).
   * `rect` is the world viewport when the docked HUD shrinks it (E5,
   * AUDIT ONLINE C6): the projection lands where the peer is drawn.
   */
  /**
   * NAME1: the point is THE TOP OF THE HEAD - `feet + height`, the body's own capsule height for a Morrowind body
   * and the doll's `h` for a billboard, both already in `_shown`. It used to carry a `+ 0.25` world lift, which was
   * the clip's other half: a quarter of a unit is many pixels at arm's length and barely one at forty, so the
   * clearance it bought swung with depth in the wrong direction. The lift is gone; the gap is NAME_GAP_PX, in
   * screen pixels, and it belongs to the drawing pass because it is measured in the same units the label is.
   *
   * Each point carries `scale` (nameScaleFor of its own depth) and the `depth` it came from, so both faces size the
   * label from ONE number and a test can read the law off the point.
   *
   * THE FOUR CULLS, cheapest first: out of NAME_RANGE, behind the lens, off the strip, and then - last, because it
   * is the only one that costs a ray - BLOCKED. `blocked(head)` is the host's sight test (sightBlockedBy over the
   * live collider); nothing is passed on the probe hosts and every name is drawn, as it always was.
   *
   * THE ORDER IS THE BUDGET, and PERF-ON is why it is written down. The name pass is the one per-frame cost that
   * scales with how many people are online (Mac: "the more people that are online, the worse fps becomes"), so the
   * ray is paid ONLY for a peer who is in range, in front and on the strip - the peers a player can actually read -
   * and never for the room. One ray each, against a uniform grid, after three comparisons that cost nothing.
   * @param {((head: number[], id: string) => boolean)|null} [blocked]
   */
  namePoints(proj, view, w, h, eye, toScene = (p) => [p.x, p.y, p.z], rect = null, blocked = null) {
    const out = [];
    // AUDIT NAME1 F3: the frame's lens, once - it is the same for every point and it is read off the matrix the
    // sprites were projected by (nameLensScale), so a wide FOV shrinks the name exactly as it shrank the body.
    const lens = nameLensScale(proj);
    for (const e of this._shown ?? []) {
      const f = toScene(e.peer.shown);
      if (eye) { const dx = f[0] - eye[0], dz = f[2] - eye[2]; if (dx * dx + dz * dz > NAME_RANGE * NAME_RANGE) continue; }
      const head = [f[0], f[1] + e.height, f[2]];
      const s = projectToScreen(head, w, h, proj, view, rect);
      if (!s.front || s.x < -200 || s.x > w + 200 || s.y < -50 || s.y > h + 50) continue;
      // AUDIT NAME1 F2/F5: the peer's ID rides the sight test, because the answer is CACHED per peer and
      // hysteresised (createSightCache) - a head point alone has no identity to remember an answer under. Purely
      // additive: a host that passes the raw `sightBlockedBy` closure ignores the second argument.
      if (blocked && blocked(head, e.peer.id)) continue;
      out.push({ id: e.peer.id, name: e.peer.name ?? '', x: s.x, y: s.y,
        scale: nameScaleFor(s.depth) * lens, depth: s.depth, lens });
    }
    return out;
  }

  /**
   * SOC4 (2026-09-16, Mac: "Upon joining a party, the players name who are in a party together should turn green"):
   * `colorOf` is an APPENDED optional parameter (it was the last one until NAME1 appended `blocked` behind it - the
   * rule is the same, nothing ahead of it moved), because a name's colour is not this module's business to know. A peer is a tab in a room; whether that tab belongs to somebody in my four-seat party is the social
   * picture's question (net/social.js colorOf -> PARTY_GREEN or null), and the host asks it. Nothing is passed on
   * the probe hosts and on every caller written before the party existed, so the default path stays exactly what it
   * was: white, byte for byte (test/online.test.js pins it).
   * @param {((id: string) => number[]|null)|null} colorOf peer id -> an RGBA array, or null for the plain name
   */
  /**
   * NAME1: THE CLASSIC FACE, KEPT - and it is not dead code. The enhanced skin's DOM layer (ui/nameLayer.js) is what
   * a player sees, because online forces the enhanced lane (OL1); this pass is what a host with no `document` draws,
   * which is every Node probe and every suite in test/. It is kept rather than retired because the two faces share
   * ONE law - `namePoints` answers the anchor, the size and the sight for both - so the fallback cannot drift from
   * the thing it stands in for, and retiring it would cost the suite its only way to read a name's position without
   * a browser. `scale` is the HOST's (hudScale); the point's own perspective scale multiplies it.
   *
   * THE ANCHOR IS THE LABEL'S BOTTOM. `drawText` takes a TOP-LEFT, and handing it the head point is exactly how the
   * label came to sit over the skull: the text is placed a full line UP from the gap, so its bottom edge lands
   * NAME_GAP_PX above the head at every distance.
   *
   * @param {((id: string) => number[]|null)|null} colorOf peer id -> an RGBA array, or null for the plain name
   * @param {((head: number[], id: string) => boolean)|null} [blocked] the sight test: a name behind a wall is not drawn
   */
  drawNames(renderer, font, proj, view, w, h, eye, scale = 1, toScene = (p) => [p.x, p.y, p.z], rect = null, colorOf = null, blocked = null) {
    return this.drawNamePoints(renderer, font, this.namePoints(proj, view, w, h, eye, toScene, rect, blocked), scale, colorOf);
  }

  /** The bitmap face over points ALREADY answered - so a host that has the points (nameFrame) draws them without
   *  projecting the room, and every ray, a second time. */
  drawNamePoints(renderer, font, points, scale = 1, colorOf = null) {
    if (!font) return 0;
    let drawn = 0;
    for (const n of points) {
      const s = scale * n.scale;
      const tw = measureText(font.fnt, n.name) * s;
      // AUDIT NAME1 F13: the gap takes the HOST's scale, and only that one. NAME_GAP_PX is a clearance in SCREEN
      // pixels and this face draws in the drawing buffer's, where `scale` (ui/hud.js hudScale, the 320x200 fit) is
      // what carries one into the other - the same number the glyph box takes before the point's own perspective
      // term multiplies it. Unscaled, the classic face put a 5-buffer-pixel gap under a label drawn five times
      // over, which is a fifth of the clearance the DOM face leaves at the same size: the two faces disagreeing
      // about the one number they exist to share. It is NOT multiplied by `n.scale`, because a clearance that
      // swings with depth is the world-space lift NAME1 took out.
      const top = n.y - NAME_GAP_PX * scale - font.fnt.fixedHeight * s;
      drawText(renderer, font, n.name, Math.round(n.x - tw / 2), Math.round(top), s, colorOf?.(n.id) ?? [1, 1, 1, 1]);
      drawn++;
    }
    return drawn;
  }

  /**
   * AUDIT NAME1 F1/F14: THE WHOLE NAME PASS, IN ONE CALL A TEST CAN DRIVE.
   *
   * It was four statements in scenes/world.js - the cull word, the points, the layer, the fallback - and four
   * statements inside a 10,000-line host is a thing only a REGEX can check, which is exactly what the suite was
   * doing. Here a pin builds the host's own composition (a real RemotePlayers, a real nameLayer over a fake
   * document, a real Collider with a real wall in it, real matrices) and drives the pass end to end.
   *
   * THE COVERED FRAME IS STILL A FRAME. A window over the HUD projects nothing and casts no ray - but the layer is
   * still rendered, because a DOM surface has to be TOLD to hide and because the bubble pump rides this call. The
   * dungeon's overlay arm used to skip the pass altogether (scenes/worldModes.js): the names stayed on the glass at
   * the positions of the frame the window opened on, painted over the overlay, until it closed.
   *
   * ONE FACE A FRAME: the layer where there is one, the bitmap pass where there is not. `w`/`h` are the face's own
   * pixels - CSS for the layer, the drawing buffer's for the bitmap pass - and the caller passes the pair that
   * belongs to the face it gave.
   * @param {{proj?: any, view?: any, w?: number, h?: number, eye?: number[]|null,
   *          toScene?: (p: any) => number[], rect?: any, covered?: boolean,
   *          layer?: any, log?: any, colorOf?: ((id: string) => number[]|null)|null,
   *          blocked?: ((head: number[], id: string) => boolean)|null,
   *          renderer?: any, font?: any, scale?: number, hudScale?: number}} [opts]
   * @returns {number} how many names the frame drew
   */
  nameFrame({
    proj, view, w, h, eye, toScene = (p) => [p.x, p.y, p.z], rect = null, covered = false,
    layer = null, log = null, colorOf = null, blocked = null,
    renderer = null, font = null, scale = 1, hudScale = 1,
  } = {}) {
    const points = covered ? [] : this.namePoints(proj, view, w, h, eye, toScene, rect, blocked);
    if (layer) {
      // the world viewport's own height where the docked HUD shrinks it (E5) - the name is sized by the frame it
      // is drawn into, not by the page (AUDIT NAME1 F3). The rect is NORMALISED (ui/hudLarge.js
      // largeHudViewportRect: `{ x: 0, y: hudHeight, w: 1, h: 1 - hudHeight }`), so its height is a SHARE of the
      // canvas and the pixels are that share of it.
      layer.render({ points, log, covered, colorOf, viewport: (Number.isFinite(rect?.h) ? rect.h : 1) * h, hudScale });
      return points.length;   // the NAMES the frame drew; the layer's own return is its bubbles (bubbleCount)
    }
    if (covered) return 0;
    return this.drawNamePoints(renderer, font, points, scale, colorOf);
  }

  /** Every batch and every doll texture released - the host's teardown. */
  destroy() {
    for (const e of this._batches.values()) this.renderer.destroyBillboardBatch?.(e.batch);
    this._batches.clear();
    this._wanted.clear();   // SLAM7: nothing is needed by a host that is gone
    for (const key of [...this._dolls.keys()]) this._release(key);
  }
}
