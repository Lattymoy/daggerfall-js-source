// ONLINE1 (2026-09-12): THE OTHERS, DRAWN. Mac: "if using classic, you'd
// see the other user's paperdoll; if using enhanced, you would see the
// other person's Morrowind sprite" - and, of a client without the
// Morrowind data, "acceptable" that it sees the paperdoll instead. This
// iteration draws every peer as their PAPERDOLL: the same composite the
// inventory shows, minus its panel background, stood on the ground as a
// billboard at the peer's feet, the name over its head. The Morrowind
// body rides the player's own rig (combat/fpArm.js, one instance, built
// from the player's own race and gear), so a peer in it is the next
// iteration's work: the rig made instantiable per body. Recorded in
// Online-Arc.md.
//
// THE LOOK travels in the hello (net/online.js): race, gender, face,
// and the equipped items' doll fields (paperdollItemImage reads
// templateIndex, group, material, dye, variant, equipSlot). A stub
// entity with those and an equip table stands in for the peer at the
// compositor, which is a module singleton keyed by identity - so one
// peer composes at a time, its pixels are copied out, and the local
// player's own doll is composed back before the next.
import { preloadPaperDollArt, preloadPaperDollForEntity, refreshPaperDoll, paperDollPixels, PAPERDOLL_W, PAPERDOLL_H } from '../ui/paperDoll.js';
import { equipTableOf } from '../systems/equip.js';
import { createEquipTable } from '../characters/equipTable.js';
import { CAPSULE_HEIGHT } from '../player/motor.js';
import { drawText, measureText } from '../ui/text.js';
import { projectToScreen } from '../player/tapRay.js';   // one home (audit24 onehome): the touch layer's own projection

/** A synthetic archive for the peers' dolls - no TEXTURE.### is this high. */
export const PEER_ARCHIVE = 900000;
/** The doll's height on the ground: the player's own capsule. */
export const PEER_HEIGHT = CAPSULE_HEIGHT;
/** The doll's width from its height, the panel's own aspect. */
export const PEER_WIDTH = PEER_HEIGHT * (PAPERDOLL_W / PAPERDOLL_H);
/** The fields of an equipped item the doll art reads. */
export const LOOK_ITEM_FIELDS = Object.freeze(['templateIndex', 'group', 'material', 'dye', 'variant', 'equipSlot']);
/** Names farther than this, in world units, are not drawn. */
export const NAME_RANGE = 60;

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

/** A stand-in for the peer at the compositor: the identity fields and
 *  an equip table with the look's items in their slots. */
export function peerStubEntity(look) {
  const entity = { race: look?.race ?? 'Breton', gender: look?.gender ?? 'male', faceIndex: look?.faceIndex ?? 0, items: [], activeEffects: [], equip: createEquipTable() };
  for (const it of look?.items ?? []) {
    if (!it || typeof it !== 'object') continue;
    const item = { ...it };
    entity.items.push(item);
    const slot = Number(item.equipSlot);
    if (Number.isInteger(slot) && slot >= 0 && slot < entity.equip.slots.length) entity.equip.slots[slot] = item;
  }
  return entity;
}

/** The peers of a session, as billboards and names. */
export class RemotePlayers {
  /**
   * @param {object} p
   * @param {object} p.renderer
   * @param {object} p.deps        {renderer, fetchBytes, palette, getTexture} - the paperdoll's
   * @param {object} p.localEntity the player's own entity, whose doll is composed back after a peer's
   */
  constructor({ renderer, deps, localEntity }) {
    this.renderer = renderer;
    this.deps = deps;
    this.localEntity = localEntity;
    this._dolls = new Map();     // lookKey -> record key (the texture under PEER_ARCHIVE), or a promise
    this._batches = new Map();   // peer id -> { batch, key }
    this._queue = Promise.resolve();
  }

  /** The doll for a look: composed once per look, serialized. */
  dollFor(look) {
    const key = lookKey(look);
    const have = this._dolls.get(key);
    if (have) return have;
    const p = (this._queue = this._queue.then(() => this._compose(look, key)).catch(() => null));
    this._dolls.set(key, p);
    p.then((rec) => { if (rec) this._dolls.set(key, rec); else this._dolls.delete(key); });
    return p;
  }

  async _compose(look, key) {
    const { deps, renderer } = this;
    if (!deps || !renderer) return null;
    const stub = peerStubEntity(look);
    await preloadPaperDollArt(deps, { race: stub.race, gender: stub.gender, faceIndex: stub.faceIndex, context: 'town' });
    await refreshPaperDoll(stub, { background: false });
    const px = paperDollPixels();
    if (!px?.rgba) return null;
    const rec = `doll_${this._dolls.size}_${Date.now().toString(36)}`;
    renderer.uploadTexture(PEER_ARCHIVE, rec, { width: px.width, height: px.height, colors: new Uint32Array(px.rgba.slice().buffer) });
    // the local player's own doll back, so the inventory finds it whole
    if (this.localEntity) {
      try { await preloadPaperDollForEntity(deps, this.localEntity, 'town'); await refreshPaperDoll(this.localEntity); } catch { /* the inventory recomposes on open */ }
    }
    return rec;
  }

  /**
   * Once a frame: a batch per drawable peer whose doll is ready, at
   * the peer's feet in the SCENE frame (`toScene` maps a room pose to
   * it), the batches of peers gone released.
   */
  sync(peers, toScene = (p) => [p.x, p.y, p.z]) {
    const live = new Set();
    for (const peer of peers) {
      live.add(peer.id);
      let entry = this._batches.get(peer.id);
      if (!entry) {
        const rec = this._dolls.get(lookKey(peer.look));
        if (typeof rec !== 'string') { this.dollFor(peer.look); continue; }   // composing
        const batch = this.renderer.createBillboardBatch(PEER_ARCHIVE, rec, { w: PEER_WIDTH, h: PEER_HEIGHT }, [[0, 0, 0]]);
        batch.origin = [0, 0, 0];
        entry = { batch, rec, peer };
        this._batches.set(peer.id, entry);
      }
      const f = toScene(peer.shown);
      entry.batch.origin[0] = f[0]; entry.batch.origin[1] = f[1]; entry.batch.origin[2] = f[2];
      entry.peer = peer;
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

  /** The names over the heads, in the HUD's own pass (after the 3D). */
  drawNames(renderer, font, proj, view, w, h, eye, scale = 1, toScene = (p) => [p.x, p.y, p.z]) {
    if (!font) return 0;
    let drawn = 0;
    for (const e of this._batches.values()) {
      const f = toScene(e.peer.shown);
      if (eye) { const dx = f[0] - eye[0], dz = f[2] - eye[2]; if (dx * dx + dz * dz > NAME_RANGE * NAME_RANGE) continue; }
      const s = projectToScreen([f[0], f[1] + PEER_HEIGHT + 0.25, f[2]], w, h, proj, view);
      if (!s.front || s.x < -200 || s.x > w + 200 || s.y < -50 || s.y > h + 50) continue;
      const text = e.peer.name ?? '';
      const tw = measureText(font.fnt, text) * scale;
      drawText(renderer, font, text, Math.round(s.x - tw / 2), Math.round(s.y), scale, [1, 1, 1, 1]);
      drawn++;
    }
    return drawn;
  }

  destroy() {
    for (const e of this._batches.values()) this.renderer.destroyBillboardBatch?.(e.batch);
    this._batches.clear();
  }
}
