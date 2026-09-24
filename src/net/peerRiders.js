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
import { orientationFor, frameCount, frameTime, chooseTable, meleeAnimTickTime, RANGED_TICK, SPELL_TICK } from '../player/eotbBillboard.js';
import { getMeleeWeaponAnimTime } from '../characters/weaponStates.js';
import { spriteFor, eotbSpriteUrl, spriteSize, spriteOffset, flipRows, worldOrderColors } from '../player/eotbSprite.js';
import { decodePng } from '../systems/textureReplacement.js';
import { POSE_RIDE } from './wire.js';

/** The table a riding pose shows: standing, walking, galloping (EOTB's three mounted tables). */
export const rideTable = (mv) => (mv === 2 ? 'GallopHorse' : mv === 1 ? 'MoveHorse' : 'IdleHorse');
/** AUDIT RIDE: a sprite whose fetch or decode failed is asked for again after this long (a long-open tab across a
 *  deploy that moved the art's hashes answers 404 until it reloads - not forever). */
export const RIDER_RETRY_MS = 30000;

async function decodeUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return worldOrderColors(await decodePng(new Uint8Array(await res.arrayBuffer())));
}

/**
 * DISC23-B: THE ART, ONE STORE. A rider and a walker draw from the same bundle (the on-foot and mounted archives are
 * one vendored folder) and the renderer caches a texture by archive and record, so the two layers share one store:
 * a sprite fetched, decoded and uploaded once, whoever asked first. `ensure(s)` answers `{ w, h }` once the sprite's
 * texture is up, else null (asked, loading, failed and cooling down, or no art at all).
 */
export function createEotbArt({ renderer = null, urlFor = eotbSpriteUrl, decode = decodeUrl, clock = () => Date.now() } = {}) {
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
  return { ensure, renderer };
}

/**
 * One layer of peer figures - a map of drawn sprites, their batches, and the placement EOTB's own billboard takes.
 * Shared by the riders and (DISC23-B) the walkers, so the two place a sprite by ONE law.
 */
function figureLayer(art) {
  const renderer = art.renderer;
  const figs = new Map();   // id -> { ..., batch, batchKey, size, xml, mirror }
  function drop(id) {
    const r = figs.get(id);
    if (r?.batch) renderer?.destroyBillboardBatch?.(r.batch);
    figs.delete(id);
  }
  /** Stand `s` at `feet` for figure `r`: its batch (re-made when the sprite changes), its size, its offset. */
  function place(r, s, feet, right, riding) {
    const up = art.ensure(s);
    if (up) {
      const xml = spriteOffset(s.archive, s.record);
      const size = spriteSize(up.w, up.h, { riding }, xml.scale);
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
  return {
    figs, drop, place,
    sweep(seen) { for (const id of [...figs.keys()]) if (!seen.has(id)) drop(id); },
    isDrawn: (id) => !!figs.get(id)?.batch,
    heightOf: (id) => { const r = figs.get(id); return r?.batch && r.size && r.xml ? r.size.h + r.xml.y / r.xml.scale : 0; },
    batches: () => [...figs.values()].map((r) => r.batch).filter(Boolean),
    offsetAll(offset) { for (const r of figs.values()) if (r.batch?.origin) { r.batch.origin[0] += offset[0]; r.batch.origin[1] += offset[1]; r.batch.origin[2] += offset[2]; } },
    destroy() { for (const id of [...figs.keys()]) drop(id); },
  };
}

/** The viewer's side of a sprite: its eight-way view of a figure facing `yaw` at `feet`, from `eye`. */
const viewOf = (yaw, feet, eye) => orientationFor([Math.sin(yaw), 0, Math.cos(yaw)], eye ? [eye[0] - feet[0], 0, eye[2] - feet[2]] : [0, 0, 0]);

/**
 * `renderer` the host's (uploadTexture, createBillboardBatch, destroyBillboardBatch); `urlFor` / `decode` the art's
 * doors (the pins drive fakes), or `art` a store another layer already holds (DISC23-B). `enabled()` is whether riders
 * are drawn at all (the art is Eye Of The Beholder's).
 */
export function createPeerRiders({ renderer = null, urlFor = eotbSpriteUrl, decode = decodeUrl, enabled = () => true, clock = () => Date.now(), art = null } = {}) {
  const layer = figureLayer(art ?? createEotbArt({ renderer, urlFor, decode, clock }));
  const riders = layer.figs;   // id -> { table, frame, clock, batch, batchKey, size, xml, mirror }

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
      if (!pose || !(pose.rd === POSE_RIDE.Horse || pose.rd === POSE_RIDE.Cart)) continue;
      seen.add(peer.id);
      let r = riders.get(peer.id);
      if (!r) { r = { table: null, frame: 0, clock: 0, batch: null, batchKey: null, size: null, xml: null, mirror: false }; riders.set(peer.id, r); }
      const table = rideTable(pose.mv | 0);
      if (table !== r.table) { r.table = table; r.frame = 0; r.clock = 0; }
      const n = frameCount(table);
      if (n > 1) { r.clock += Math.max(0, dt); const ft = frameTime(true); while (r.clock >= ft) { r.clock -= ft; r.frame = (r.frame + 1) % n; } }
      const feet = toScene(pose);
      const s = spriteFor(table, viewOf(pose.yaw, feet, eye), r.frame, { onHorse: pose.rv | 0 });
      if (!s) continue;
      layer.place(r, s, feet, right, true);
    }
    layer.sweep(seen);
  }

  return {
    sync,
    /** Whether a peer is DRAWN in the saddle this frame - the other two layers stand nothing for them. AUDIT RIDE: a
     *  rider whose art is not up yet (or failed) is not drawn, so it keeps its doll or body - never nothing at all. */
    isRiding: layer.isDrawn,
    /** The name tag's height over a rider's feet (0: not drawn) - remotePlayers' `bodyHeight` hand-off: the sprite's
     *  own top this frame (its size over the feet plus EOTB's y offset), as a body's head is its own. */
    heightOf: layer.heightOf,
    batches: layer.batches,
    offsetAll: layer.offsetAll,
    destroy: layer.destroy,
    get riders() { return riders; },
  };
}

/** DISC23-B: the peers' on-foot swing is timed at this Speed - DFU's own GetMeleeWeaponAnimTime line at the middle of
 *  the stat's range, since a peer's Speed is not on the wire (the local body times its own swing by its own). */
export const PEER_SWING_SPEED = 50;
/** DISC23-B: the one-shot a pose edge starts - the arm's three counters (world.js `arm`), each the clip EOTB plays
 *  for that act (eotbBody.js's own doors: PlayMeleeAttackAnimation, the loose, the cast), with its own frame tick. */
export const WALK_ONE_SHOTS = Object.freeze([
  Object.freeze({ field: 'an', table: 'AttackMelee', tick: () => meleeAnimTickTime(getMeleeWeaponAnimTime(PEER_SWING_SPEED), frameCount('AttackMelee')) }),
  Object.freeze({ field: 'ar', table: 'AttackRanged', tick: () => RANGED_TICK }),
  Object.freeze({ field: 'cn', table: 'AttackSpell', tick: () => SPELL_TICK }),
]);

/**
 * DISC23-B (2026-09-24, Gryphoth on Discord: "a way to change our sprite in general instead of it defaulting depending
 * on the class") - ANOTHER PLAYER ON FOOT, AS THE SPRITE THEY CHOSE.
 *
 * A peer with no Morrowind body on my screen stood as their CLASS's enemy sprite (remotePlayers classMobileType) - a
 * Mage was the Mage monster whatever they had chosen, and the Eye Of The Beholder set the player picked for themselves
 * (Graphics.OnFoot, sixteen of them) was on nobody's screen but their own. The look carries it now (`eo`, wire.js
 * validLook - sent while the player's mod is on) and this draws it: the same eight views, the same tables and clip
 * lengths the player's own third-person body takes (player/eotbBillboard.js chooseTable, eotbBody.js's one-shots),
 * off the shown pose - the move bit walks it, the drawn weapon or readied spell stands it ready, and each new swing,
 * loosed arrow or cast plays its clip once.
 *
 * WHO IS DRAWN THIS WAY: a peer on foot whose look names a set, not in beast form (the beast is the beast's own
 * sprite), not dying (the fallen body is PCORPSE's), and not already standing in a Morrowind body on this screen
 * (`skip` - the viewer's own choice of bodies, which a Morrowind player made for everyone they meet). It takes the
 * place of the class sprite and the doll, and hands the name pass its height as the riders do.
 */
export function createPeerWalkers({ renderer = null, urlFor = eotbSpriteUrl, decode = decodeUrl, enabled = () => true, clock = () => Date.now(), art = null } = {}) {
  const layer = figureLayer(art ?? createEotbArt({ renderer, urlFor, decode, clock }));
  const walkers = layer.figs;   // id -> { table, frame, clock, shot, last, batch, ... }

  /** The pose's own standing table (EOTB chooseTable, the mod's default ReadyStance - the sender's is not on the wire). */
  const standing = (pose) => chooseTable({ stopped: !pose.mv, sheathed: !pose.wd, spellcasting: !!pose.sr, usingBow: pose.wd === 2 });

  /**
   * One frame: `peers`, `toScene`, `eye`, `right` and `dt` as the riders' sync; `skip(id)` a peer another layer
   * already stands (the viewer's Morrowind body).
   * @param {Array<any>} peers @param {(p: any) => number[]} toScene
   * @param {{eye?: number[]|Float32Array|null, right?: number[], dt?: number, skip?: (id: string) => boolean}} [opts]
   */
  function sync(peers, toScene, { eye = null, right = [1, 0, 0], dt = 0, skip = () => false } = {}) {
    const on = enabled();
    const seen = new Set();
    for (const peer of on ? peers ?? [] : []) {
      const pose = peer?.shown;
      const set = peer?.look?.eo;
      if (!pose || !Number.isInteger(set) || pose.rd || pose.wb || pose.dd || skip(peer.id)) continue;
      seen.add(peer.id);
      let r = walkers.get(peer.id);
      if (!r) { r = { table: null, frame: 0, clock: 0, shot: null, last: null, batch: null, batchKey: null, size: null, xml: null, mirror: false }; walkers.set(peer.id, r); }
      // a new swing, shaft or cast plays its clip once - the FIRST sight of a peer is not an edge (their counters are
      // whatever a session of swinging left them at)
      if (r.last) {
        for (const o of WALK_ONE_SHOTS) {
          if ((pose[o.field] | 0) !== r.last[o.field]) { r.shot = { table: o.table, tick: o.tick() }; r.table = o.table; r.frame = 0; r.clock = 0; }
        }
      }
      r.last = { an: pose.an | 0, ar: pose.ar | 0, cn: pose.cn | 0 };
      const step = Math.max(0, dt);
      if (r.shot) {
        r.clock += step;
        while (r.shot && r.clock >= r.shot.tick) {
          r.clock -= r.shot.tick;
          if (++r.frame >= frameCount(r.shot.table)) { r.shot = null; r.table = null; r.frame = 0; r.clock = 0; }
        }
      }
      if (!r.shot) {
        const table = standing(pose);
        if (table !== r.table) { r.table = table; r.frame = 0; r.clock = 0; }
        const n = frameCount(table);
        // [IL] LoopIdleBillboard's clock: a one-frame table never advances; a run halves the frame (IL_41d4-IL_422a)
        if (n > 1) { r.clock += step; const ft = frameTime(false) * (pose.mv === 2 ? 0.5 : 1); while (r.clock >= ft) { r.clock -= ft; r.frame = (r.frame + 1) % n; } }
      }
      const feet = toScene(pose);
      const s = spriteFor(r.table, viewOf(pose.yaw, feet, eye), r.frame, { onFoot: set });
      if (!s) continue;
      layer.place(r, s, feet, right, false);
    }
    layer.sweep(seen);
  }

  return {
    sync,
    /** Whether a peer stands as their chosen sprite this frame - the class sprite and the doll stand nothing for them.
     *  Not until the art is up: a walker still loading keeps what stood before. */
    isWalking: layer.isDrawn,
    heightOf: layer.heightOf,
    batches: layer.batches,
    offsetAll: layer.offsetAll,
    destroy: layer.destroy,
    get walkers() { return walkers; },
  };
}
