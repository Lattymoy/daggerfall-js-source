// @ts-check
// NAV-B (2026-09-28) - A BURNING SHIP'S FLAMES: Daggerfall's own fire flat (TEXTURE.210 record 1 - the camp's fire,
// systems/survival/camp.js FIRE_FLAT) stood on her deck and carried with her as she drifts, heels and settles. The
// naval host asks `flame(pos)` for each fire it lights (scenes/naval/navalHost.js igniteShip - one on a rowboat, three along
// a larger deck) and moves or retires the handle; the smoke and embers over them are the naval pass's own
// (systems/naval/navalEffects.js burn).
//
// A burning foe's flame's shape (scenes/droppedTorches.js tickFlames): ONE batch per flame placed by its `origin`
// (AUDIT 68 S18-torch-batch-churn: a moving flame is a moved origin, never a new batch a frame), the frames animated
// by FlatAnim on the frame's clock, drawn on the flats' axis with the foes. A ship's fire is a deck ablaze, not a
// campfire: FLAME_SCALE times the camp's size.
import { FIRE_FLAT } from '../../systems/survival/camp.js';
import { FlatAnim } from '../../render/flatAnimation.js';
import { GLOBAL_SCALE } from '../../player/activate.js';

/** A deck fire's size over the camp's. */
export const FLAME_SCALE = 1.8;

/**
 * @param {{ renderer: any, getTexture?: ((archive: number) => any) | null, uploadRecordFrame?: ((archive: number, record: number, frame: number) => void) | null }} deps
 */
export function createNavalFlames({ renderer, getTexture = null, uploadRecordFrame = null }) {
  /** @type {Set<{ pos: number[], batch: any, anim: any, dead: boolean, hidden?: boolean }>} */
  const live = new Set();
  /** @type {{ count: number, size: { w: number, h: number } } | null} */
  let art = null;
  /** @type {Promise<void> | null} */
  let loading = null;

  function ensureArt() {
    if (art || loading || !getTexture) return;
    loading = Promise.resolve(getTexture(FIRE_FLAT.archive)).then((t) => {
      if (!t) return;
      const count = t.getFrameCount?.(FIRE_FLAT.record) ?? 1;
      for (let i = 0; i < count; i++) uploadRecordFrame?.(FIRE_FLAT.archive, FIRE_FLAT.record, i);
      const size = t.getSize(FIRE_FLAT.record);
      art = { count, size: { w: size.width * GLOBAL_SCALE * FLAME_SCALE, h: size.height * GLOBAL_SCALE * FLAME_SCALE } };
      for (const f of live) mount(f);
    }).catch((e) => { console.warn('[naval] the deck fire would not load', e); });
  }
  function mount(f) {
    if (f.batch || f.dead || !art || !renderer?.createBillboardBatch) return;
    f.batch = renderer.createBillboardBatch(FIRE_FLAT.archive, FIRE_FLAT.record, art.size, [[0, 0, 0]]);
    f.batch.origin = f.pos;
    f.batch.frame = 0;
    f.anim = art.count > 1 ? new FlatAnim(FIRE_FLAT.archive, art.count, false) : null;
  }
  function unmount(f) {
    if (f.batch) renderer?.destroyBillboardBatch?.(f.batch);
    f.batch = null;
  }

  return {
    /** A flame at a place: `{ move(pos), show(on), retire() }` - AUDIT BAY A14: `show(false)` stands it down
     *  (her ship half faded out of the world: a flat, it goes with her flats), `show(true)` up again. */
    flame(pos) {
      const f = { pos: [pos[0], pos[1], pos[2]], batch: null, anim: null, dead: false, hidden: false };
      live.add(f);
      ensureArt();
      mount(f);
      return {
        move(p) { f.pos[0] = p[0]; f.pos[1] = p[1]; f.pos[2] = p[2]; },
        show(on) { f.hidden = !on; },
        retire() { f.dead = true; unmount(f); live.delete(f); },
      };
    },
    /** The frames, on the frame's clock. */
    tick(dt) { for (const f of live) if (f.batch && f.anim) f.batch.frame = f.anim.tick(dt); },
    /** The batches, for the flats' axis - a flame stood down none. */
    batches() { const out = []; for (const f of live) if (f.batch && !f.hidden) out.push(f.batch); return out; },
    /** The floating origin moved: every flame with it (the host re-places them next frame anyway). */
    offsetAll(o) { for (const f of live) { f.pos[0] += o[0]; f.pos[1] += o[1]; f.pos[2] += o[2]; } },
    /** Every flame out (the sea emptied). */
    clear() { for (const f of [...live]) { f.dead = true; unmount(f); } live.clear(); },
    get count() { return live.size; },
  };
}
