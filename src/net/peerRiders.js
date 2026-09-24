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
//
// PR-WW1 (2026-09-24, player report: "Werewolf morrowind sprite not showing online"): AND ANOTHER PLAYER IN BEAST
// FORM. A transformed player with no Morrowind body sees themselves as Eye Of The Beholder's lycanthrope (archives
// 112380 the werewolf, 112381 the wereboar - the Bloodmoon-style beast, eotbBody's lycan tables), and everyone else
// saw DISC12's classic enemy sprite (archives 264 / 269, remotePlayers' mobile), because this layer - the only one
// that draws another player in EOTB's art - took a peer only when `rd` said a mount. It takes a peer whose pose says
// `wb` now, and asks EOTB's own chooseTable for the table, so the transformed-first rule has one home: a beast is a
// beast in the saddle too (as the transformed player sees themselves), and the claws show on the swing's `an` edge
// ('AttackMeleeLycan' at LYCAN_TICK, the mob's strike DISC12 showed). The hand-off is unchanged: until the art is up
// (or when it failed, or the build has none) `isRiding` stays false and remotePlayers' DISC12 enemy sprite stands for
// them - a beast is never nothing.
import { orientationFor, frameCount, frameTime, chooseTable, speedMod, LYCAN_TICK } from '../player/eotbBillboard.js';
import { spriteFor, eotbSpriteUrl, spriteSize, spriteOffset, flipRows, worldOrderColors } from '../player/eotbSprite.js';
import { decodePng } from '../systems/textureReplacement.js';
import { POSE_RIDE } from './wire.js';

/** The table a riding pose shows: standing, walking, galloping (EOTB's three mounted tables). */
export const rideTable = (mv) => (mv === 2 ? 'GallopHorse' : mv === 1 ? 'MoveHorse' : 'IdleHorse');
/** PR-WW1: the loop table a pose in beast form shows - EOTB's own chooseTable, transformed first, off the pose's move
 *  bit and drawn flag (the claws up at a stand are IdleMeleeLycan; a beast that moves is MoveLycan either way). */
export const beastTable = (pose) => chooseTable({ transformed: true, riding: !!pose?.rd, stopped: !pose?.mv, sheathed: !pose?.wd });
/** PR-WW1: the claw a beast's swing plays (eotbBody playLycanAttack's clip: its frames forward at LYCAN_TICK). */
export const CLAW_TABLE = 'AttackMeleeLycan';
/** AUDIT RIDE: a sprite whose fetch or decode failed is asked for again after this long (a long-open tab across a
 *  deploy that moved the art's hashes answers 404 until it reloads - not forever). */
export const RIDER_RETRY_MS = 30000;

async function decodeUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return worldOrderColors(await decodePng(new Uint8Array(await res.arrayBuffer())));
}

/**
 * `renderer` the host's (uploadTexture, createBillboardBatch, destroyBillboardBatch); `urlFor` / `decode` the art's
 * doors (the pins drive fakes). `enabled()` is whether riders are drawn at all (the art is Eye Of The Beholder's).
 */
export function createPeerRiders({ renderer = null, urlFor = eotbSpriteUrl, decode = decodeUrl, enabled = () => true, clock = () => Date.now() } = {}) {
  const riders = new Map();   // id -> { table, frame, clock, batch, batchKey, size, xml, mirror, an, claw }
  const tex = new Map();      // `${archive}:${rec}` -> { w, h } | Promise | null (no art at all) | { failedAt } (asked again after RIDER_RETRY_MS)
  const pixels = new Map();   // sprite key -> decode promise

  function ensure(s) {
    const k = `${s.archive}:${s.rec}`;
    const have = tex.get(k);
    if (have && !(have instanceof Promise) && !('failedAt' in have)) return have;
    if (have && 'failedAt' in have && clock() - have.failedAt >= RIDER_RETRY_MS) tex.delete(k);
    else if (have !== undefined || !renderer?.uploadTexture) return null;
    const url = urlFor(s.key);
    if (!url) { tex.set(k, null); return null; }
    let img = pixels.get(s.key);
    if (!img) { img = decode(url); pixels.set(s.key, img); img.catch(() => pixels.delete(s.key)); }
    const p = img.then(({ width, height, colors }) => {
      renderer.uploadTexture(s.archive, s.rec, { width, height, colors: s.mirror ? flipRows(colors, width, height) : colors });
      return { w: width, h: height };
    });
    tex.set(k, p);
    p.then((r) => tex.set(k, r), () => tex.set(k, { failedAt: clock() }));
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
      // AUDIT RIDE: the SHOWN pose - the one the session eases between words, which the bodies, the dolls, the names
      // and the casts all read; the latest word ran up to a whole interval ahead of the rider's own name
      const pose = peer?.shown;
      if (!pose) continue;
      // PR-WW1: a beast (`wb` 1 the werewolf, 2 the wereboar - LycanthropyTypes) is this layer's as a rider is
      const beast = pose.wb | 0;
      const riding = pose.rd === POSE_RIDE.Horse || pose.rd === POSE_RIDE.Cart;
      if (!beast && !riding) continue;
      seen.add(peer.id);
      let r = riders.get(peer.id);
      if (!r) { r = { table: null, frame: 0, clock: 0, batch: null, batchKey: null, size: null, xml: null, mirror: false, an: null, claw: null }; riders.set(peer.id, r); }
      // PR-WW1: THE CLAW - the swing count moving on a beast plays EOTB's lycan swing once, forward, a LYCAN_TICK a
      // frame; the count first seen is no swing (a peer met mid-fight does not claw at nothing). It is the local
      // body's own rule (eotbBody playLycanAttack, IL): never in the saddle, and a swing while the claw plays does not
      // restart it
      const an = pose.an | 0;
      if (r.claw) {
        r.claw.t += Math.max(0, dt);
        while (r.claw && r.claw.t >= LYCAN_TICK) { r.claw.t -= LYCAN_TICK; r.claw.i++; if (r.claw.i >= frameCount(CLAW_TABLE)) r.claw = null; }
      }
      if (!beast) r.claw = null;
      else if (r.an != null && an !== r.an && !riding && !r.claw) r.claw = { i: 0, t: 0 };
      r.an = an;
      const table = r.claw ? CLAW_TABLE : beast ? beastTable(pose) : rideTable(pose.mv | 0);
      if (table !== r.table) { r.table = table; r.frame = 0; r.clock = 0; }
      const n = frameCount(table);
      if (r.claw) r.frame = r.claw.i;
      // EOTB's frame time: the saddle's clock for a rider (a beast in the saddle too, as LoopIdleBillboard's
      // `riding` reads it), and PR-WW1: a beast running on foot at half the frame (speedMod, the local body's term)
      else if (n > 1) { r.clock += Math.max(0, dt); const ft = frameTime(riding) * (beast && !riding ? speedMod({ running: pose.mv === 2 }) : 1); while (r.clock >= ft) { r.clock -= ft; r.frame = (r.frame + 1) % n; } }
      const feet = toScene(pose);
      const facing = [Math.sin(pose.yaw), 0, Math.cos(pose.yaw)];
      const toCam = eye ? [eye[0] - feet[0], 0, eye[2] - feet[2]] : [0, 0, 0];
      // PR-WW1: the form picks the lycan archive (tableArchive: 112380, or 112381 for the wereboar); a mounted table
      // still reads the rider's own set
      const s = spriteFor(table, orientationFor(facing, toCam), r.frame, { onHorse: pose.rv | 0, lycanthropyType: beast });
      if (!s) continue;
      const up = ensure(s);
      if (up) {
        const xml = spriteOffset(s.archive, s.record);
        // PR-WW1: the transformed forms take the saddle's size (sizeMod - one constant serves both)
        const size = spriteSize(up.w, up.h, beast ? { transformed: true } : { riding: true }, xml.scale);
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
    /** Whether a peer is DRAWN by this layer this frame - in the saddle, or PR-WW1 in beast form - so the other two
     *  layers stand nothing for them. AUDIT RIDE: a rider whose art is not up yet (or failed) is not drawn, so it keeps
     *  its doll or body - never nothing at all; PR-WW1: a beast likewise keeps DISC12's enemy sprite (remotePlayers). */
    isRiding: (id) => !!riders.get(id)?.batch,
    /** The name tag's height over a rider's feet (0: not drawn) - remotePlayers' `bodyHeight` hand-off: the sprite's
     *  own top this frame (its size over the feet plus EOTB's y offset), as a body's head is its own. */
    heightOf: (id) => { const r = riders.get(id); return r?.batch && r.size && r.xml ? r.size.h + r.xml.y / r.xml.scale : 0; },
    batches: () => [...riders.values()].map((r) => r.batch).filter(Boolean),
    offsetAll(offset) { for (const r of riders.values()) if (r.batch?.origin) { r.batch.origin[0] += offset[0]; r.batch.origin[1] += offset[1]; r.batch.origin[2] += offset[2]; } },
    destroy() { for (const id of [...riders.keys()]) drop(id); },
    get riders() { return riders; },
  };
}
