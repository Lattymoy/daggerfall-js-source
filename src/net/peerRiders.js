// @ts-check
// RIDE (2026-09-23, Mac: "Also need to ensure over people see others riding on horses"): ANOTHER PLAYER IN THE SADDLE.
//
// The pose never said how a player travelled, so a peer on a horse or a cart walked on foot on everyone else's
// screen - their doll or their body sliding over the road at a gallop's pace. The pose carries the mount now
// (net/wire.js validPose: `rd` 1 the horse, 2 the cart - DFU's TransportModes that ride - and `rv` which mounted
// sprite set the rider chose), and this draws a riding peer as the only art the port has of a person on a horse:
// Eye Of The Beholder's mounted player sprites (vendor/eye-of-the-beholder, archives 112382-112386), the same eight
// views, the same idle / walk / gallop tables and clip lengths, the same size and offsets its own billboard takes
// (player/eotbBillboard.js, player/eotbSprite.js) - so a rider looks the same to the others as to themselves in third
// person. A peer in the saddle stands no doll, sprite or Morrowind body (the host hands the other two layers the
// rider's height, MWBODY1's hand-off), and their name rides over the rider.
//
// The walk is the pose's move bit - 1 a walk, 2 the run, which on a horse is the gallop (EOTB's chooseTable reads
// the speed; the wire carries the bit) - and the view is the viewer's: the rider's yaw against the line from the
// rider to MY eye (orientationFor, EOTB-IL's order), as every sprite in the world turns for whoever looks at it.
import { orientationFor, frameCount, frameTime } from '../player/eotbBillboard.js';
import { spriteFor, eotbSpriteUrl, spriteSize, spriteOffset, flipRows, worldOrderColors } from '../player/eotbSprite.js';
import { decodePng } from '../systems/textureReplacement.js';
import { POSE_RIDE } from './wire.js';

/** The table a riding pose shows: standing, walking, galloping (EOTB's three mounted tables). */
export const rideTable = (mv) => (mv === 2 ? 'GallopHorse' : mv === 1 ? 'MoveHorse' : 'IdleHorse');
/** How tall a rider's name stands (metres over the feet): the saddle's sprite top, near enough for the tag. */
export const RIDER_NAME_HEIGHT = 2.6;

async function decodeUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return worldOrderColors(await decodePng(new Uint8Array(await res.arrayBuffer())));
}

/**
 * `renderer` the host's (uploadTexture, createBillboardBatch, destroyBillboardBatch); `urlFor` / `decode` the art's
 * doors (the pins drive fakes). `enabled()` is whether riders are drawn at all (the art is Eye Of The Beholder's).
 */
export function createPeerRiders({ renderer = null, urlFor = eotbSpriteUrl, decode = decodeUrl, enabled = () => true } = {}) {
  const riders = new Map();   // id -> { table, frame, clock, batch, batchKey, size, xml, mirror }
  const tex = new Map();      // `${archive}:${rec}` -> { w, h } | Promise | null
  const pixels = new Map();   // sprite key -> decode promise

  function ensure(s) {
    const k = `${s.archive}:${s.rec}`;
    const have = tex.get(k);
    if (have && !(have instanceof Promise)) return have;
    if (have !== undefined || !renderer?.uploadTexture) return null;
    const url = urlFor(s.key);
    if (!url) { tex.set(k, null); return null; }
    let img = pixels.get(s.key);
    if (!img) { img = decode(url); pixels.set(s.key, img); img.catch(() => pixels.delete(s.key)); }
    const p = img.then(({ width, height, colors }) => {
      renderer.uploadTexture(s.archive, s.rec, { width, height, colors: s.mirror ? flipRows(colors, width, height) : colors });
      return { w: width, h: height };
    });
    tex.set(k, p);
    p.then((r) => tex.set(k, r), () => tex.set(k, null));
    return null;
  }
  function drop(id) {
    const r = riders.get(id);
    if (r?.batch) renderer?.destroyBillboardBatch?.(r.batch);
    riders.delete(id);
  }

  /**
   * One frame. `peers` the host's drawable list ({ id, pose, shown }), `toScene` the pose's feet in scene units, `eye`
   * the viewer's eye, `right` the viewer's camera right (the sprite's x offset runs along it, as EOTB's does).
   */
  function sync(peers, toScene, { eye = null, right = [1, 0, 0], dt = 0 } = {}) {
    const on = enabled();
    const seen = new Set();
    for (const peer of on ? peers ?? [] : []) {
      const pose = peer?.pose;
      if (!peer?.shown || !pose || !(pose.rd === POSE_RIDE.Horse || pose.rd === POSE_RIDE.Cart)) continue;
      seen.add(peer.id);
      let r = riders.get(peer.id);
      if (!r) { r = { table: null, frame: 0, clock: 0, batch: null, batchKey: null, size: null, xml: null, mirror: false }; riders.set(peer.id, r); }
      const table = rideTable(pose.mv | 0);
      if (table !== r.table) { r.table = table; r.frame = 0; r.clock = 0; }
      const n = frameCount(table);
      if (n > 1) { r.clock += Math.max(0, dt); const ft = frameTime(true); while (r.clock >= ft) { r.clock -= ft; r.frame = (r.frame + 1) % n; } }
      const feet = toScene(pose);
      const facing = [Math.sin(pose.yaw), 0, Math.cos(pose.yaw)];
      const toCam = eye ? [eye[0] - feet[0], 0, eye[2] - feet[2]] : [0, 0, 0];
      const s = spriteFor(table, orientationFor(facing, toCam), r.frame, { onHorse: pose.rv | 0 });
      if (!s) continue;
      const up = ensure(s);
      if (up) {
        const xml = spriteOffset(s.archive, s.record);
        const size = spriteSize(up.w, up.h, { riding: true }, xml.scale);
        const key = `${s.archive}:${s.rec}`;
        if (!r.batch || r.batchKey !== key) {
          if (r.batch) renderer?.destroyBillboardBatch?.(r.batch);
          r.batch = renderer.createBillboardBatch(s.archive, s.rec, size, [[0, 0, 0]]);
          r.batch.origin = [0, 0, 0];
          r.batchKey = key;
        }
        r.size = size; r.xml = xml; r.mirror = s.mirror;
      }
      if (r.batch && r.xml) {
        // EOTB's placement (eotbBody place()): the offset in metres, x along the view's right (negated when mirrored),
        // y over the feet; the renderer's billboard is bottom-anchored (EOTB-FEET), so the base is the feet plus y
        const x = (r.xml.x / r.xml.scale) * (r.mirror ? -1 : 1);
        const y = r.xml.y / r.xml.scale;
        r.batch.origin[0] = feet[0] + right[0] * x; r.batch.origin[1] = feet[1] + y; r.batch.origin[2] = feet[2] + right[2] * x;
      }
    }
    for (const id of [...riders.keys()]) if (!seen.has(id)) drop(id);
  }

  return {
    sync,
    /** Whether a peer is drawn in the saddle this frame - the other two layers stand nothing for them. */
    isRiding: (id) => riders.has(id),
    /** The name tag's height over a rider's feet (0: not riding) - remotePlayers' `bodyHeight` hand-off. */
    heightOf: (id) => (riders.has(id) ? RIDER_NAME_HEIGHT : 0),
    batches: () => [...riders.values()].map((r) => r.batch).filter(Boolean),
    offsetAll(offset) { for (const r of riders.values()) if (r.batch?.origin) { r.batch.origin[0] += offset[0]; r.batch.origin[1] += offset[1]; r.batch.origin[2] += offset[2]; } },
    destroy() { for (const id of [...riders.keys()]) drop(id); },
    get riders() { return riders; },
  };
}
