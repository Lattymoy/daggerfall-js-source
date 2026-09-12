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
/** The most distinct dolls kept on the GPU; past it the oldest is released (AUDIT ONLINE C7). */
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

/** One string per distinct look: the doll cache's key. */
export const lookKey = (look) => `${look?.race ?? 'Breton'}|${look?.gender ?? 'male'}|${look?.faceIndex ?? 0}|${JSON.stringify((look?.items ?? []).map((it) => LOOK_ITEM_FIELDS.map((k) => it[k] ?? null)))}`;

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
   * @param {object} p.renderer
   * @param {object} p.deps     {fetchBytes, palette, getTexture} - the compositor's
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
      if (this._dolls.get(key) !== p) return;   // released meanwhile
      if (doll) { this._dolls.set(key, doll); this._evict(); } else this._dolls.set(key, { failedUntil: this._now() + DOLL_RETRY_MS });
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

  /** Past DOLLS_MAX ready dolls, the oldest goes: its texture released, the batches wearing it dropped (they recompose). */
  _evict() {
    while (true) {
      let ready = 0, oldest = null;
      for (const [k, v] of this._dolls) if (v && typeof v.rec === 'string') { ready++; if (!oldest) oldest = k; }
      if (ready <= DOLLS_MAX || !oldest) return;
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
  sync(peers, toScene = (p) => [p.x, p.y, p.z], { bodyHeight = () => 0 } = {}) {
    const live = new Set();
    this._shown = [];   // every drawable peer, doll or body, for the name pass
    for (const peer of peers) {
      if (!peer?.shown) continue;
      // MWBODY1: a peer standing in a Morrowind body (net/peerBodies.js) draws no doll; its name still rides this pass, at the body's own head
      const bodyH = bodyHeight(peer.id);
      if (bodyH > 0) { this._shown.push({ peer, height: bodyH }); continue; }
      live.add(peer.id);
      const key = lookKey(peer.look);
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
  namePoints(proj, view, w, h, eye, toScene = (p) => [p.x, p.y, p.z], rect = null) {
    const out = [];
    for (const e of this._shown ?? []) {
      const f = toScene(e.peer.shown);
      if (eye) { const dx = f[0] - eye[0], dz = f[2] - eye[2]; if (dx * dx + dz * dz > NAME_RANGE * NAME_RANGE) continue; }
      const s = projectToScreen([f[0], f[1] + e.height + 0.25, f[2]], w, h, proj, view, rect);
      if (!s.front || s.x < -200 || s.x > w + 200 || s.y < -50 || s.y > h + 50) continue;
      out.push({ id: e.peer.id, name: e.peer.name ?? '', x: s.x, y: s.y });
    }
    return out;
  }

  drawNames(renderer, font, proj, view, w, h, eye, scale = 1, toScene = (p) => [p.x, p.y, p.z], rect = null) {
    if (!font) return 0;
    let drawn = 0;
    for (const n of this.namePoints(proj, view, w, h, eye, toScene, rect)) {
      const tw = measureText(font.fnt, n.name) * scale;
      drawText(renderer, font, n.name, Math.round(n.x - tw / 2), Math.round(n.y), scale, [1, 1, 1, 1]);
      drawn++;
    }
    return drawn;
  }

  /** Every batch and every doll texture released - the host's teardown. */
  destroy() {
    for (const e of this._batches.values()) this.renderer.destroyBillboardBatch?.(e.batch);
    this._batches.clear();
    for (const key of [...this._dolls.keys()]) this._release(key);
  }
}
