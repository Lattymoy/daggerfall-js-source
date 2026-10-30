// @ts-check
// PEERFX1 (2026-09-26): WHAT A BLOW LOOKS AND SOUNDS LIKE, FOR THE PLAYERS WHO SEE IT.
//
// The player: "when you hit the enemy give the same feedback for players you see when they hit an enemy with melee
// and ranged (bows), not magic. Also give the other players you see a sound when they get hit, like you do when you
// get hit."
//
// Before: my blow on a foe splashed, rang and bled on MY screen, and the foe's owner drew one when the hit frame
// reached it - but a third player standing beside us saw a swing and a health bar move, nothing else. And a peer
// being hit by a foe was silent to everyone but them.
//
// HOW IT RIDES. Two counters on the POSE (net/wire.js validPose), the SPELLFX1 way the arrows loosed ride (`ar`):
//   hk  my weapon blows that landed (melee or arrow, damage > 0) - with hp, the struck point (the wire's world
//       frame, as the pose's own x/y/z), hb, the struck body's blood record, and hq, the blow's share of its health
//       (0-100, the splash's size ladder). Heard at hitEffects' one splash seam: a splash marked `fromPlayer` is a
//       blow of mine, and no spell site splashes, so magic never rides.
//   hu  the times I was struck - heard at the one sound every "blow lands on the player" site plays
//       (soundClips Hit1..Hit5 as a one-shot at PLAYER_HIT_VOLUME).
// Both OMITTED at 0 (the wire's omission law): a player who never fought sends the bytes it always did. An older
// client ignores the fields; an older relay drops them, and nothing plays - the feature needs the relay built from
// this wire.js to pass them.
//
// WHAT PLAYS. A count that moved on a peer I can see: for hk, the hit's ring at the struck point, and the blood
// splash there (skipped when a splash was already drawn within a metre in the last moment - the foe's owner draws
// one of its own when the hit frame lands); for hu, the same Hit1..5 ring at the peer's body, as I hear my own. A
// count seen for the first time (a late joiner, a peer walking into view) plays nothing - an old blow is not replayed.

import { effectWorn } from '../effectLaw.js';   // STOREFRONT: a peer's kill effect, by the kit its token signed
import { playerDoor } from '../../systems/playerDoor.js';   // STOREFRONT: played through the running host's magic engine
import { othersEffectShown } from './peerEffects.js';   // STOREFRONT: the "Others' effects" choice, a kill's and a mount look's
import { createMountFx } from '../../systems/horse/mountFx.js';   // STOREFRONT: a riding peer's mount look in the world
import { POSE_RIDE } from '../wire.js';
import { peerMoving } from './peerClimb.js';
import { KFX_FAR_M } from '../../render/killFx.js';   // the wire audit: a kill is told as far as my own screen draws one
import { ARROW_FLIGHT_SPEED, MISSILE_LIFESPAN_S } from '../../systems/spellcast.js';   // the wire audit: a blow's farthest shaft
import { TECHNIQUES } from '../../combat/technique/techniqueRoster.js';
import { GAP_MAX_MS } from '../online.js';   // the wire audit: how long a kill rides

export const HIT_CLIP_FIRST = 108;   // soundClips SOUND.Hit1
export const HIT_CLIP_LAST = 112;    // Hit5
const U16 = 65535;
/** A splash this near, this recently, is the same blow drawn already (the foe owner's own). */
const DEDUPE_M = 1.2, DEDUPE_S = 0.6;
/** A peer's blow waits this long before it plays, so the owner's own splash (the hit frame) can land first. */
const FX_DELAY_S = 0.18;
/** AUDIT MERGE-PLUS B6: the least time between two plays of one peer's blows, or of their hurts - no swing, shot or string
 *  of hits lands faster, and a modified client's pose may say a new one on every frame. */
export const FX_MIN_GAP_S = 0.25;
/** THE WIRE AUDIT (STOREFRONT): how far a peer's drawn feet may trail the pose that told its blow or kill - a peer's
 *  portal's own allowance (systems/portalStone.js PORTAL_PEER_REACH over PORTAL_SAY_REACH). */
export const PEER_POSE_EASE_M = 8;
/** My kill is told while it falls within my own screen's draw of my feet (render/killFx.js KFX_FAR_M), whatever that draw
 *  answered; a peer's is believed within that and the ease of its drawn feet. A modified client's pyre in a stranger's
 *  face, from anywhere else in the cell, is not. */
export const KILL_FX_SAY_M = KFX_FAR_M;
export const KILL_FX_PEER_M = KILL_FX_SAY_M + PEER_POSE_EASE_M;
/** A peer's blow is believed within its farthest shaft of its drawn feet: an arrow's flight for a missile's life
 *  (systems/spellcast.js), at the fastest a technique looses one (a Piercing Shot's `speed`), and the ease. */
export const BLOW_PEER_M = ARROW_FLIGHT_SPEED * MISSILE_LIFESPAN_S
  * Math.max(1, ...Object.values(TECHNIQUES).map((/** @type {any} */ t) => (t.mech === 'pierce' ? t.speed ?? 1 : 1))) + PEER_POSE_EASE_M;
/** A kill rides the poses said this long after it (s), then leaves them: the longest a listener waits for a moving peer's
 *  pose (net/online.js GAP_MAX_MS - the relay's far tier), so each hears it once. The receiver never replays one, and a
 *  pose at rest no longer carries a kill for the rest of the session. */
export const KILL_FX_RIDE_S = GAP_MAX_MS / 1000;
/** Is `a` within `m` metres of `b` (both the scene's) - no `b`, never. */
const within = (/** @type {ArrayLike<number>} */ a, /** @type {ArrayLike<number>|null|undefined} */ b, /** @type {number} */ m) => !!b && Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= m;

// ── EG-ZH: THE PEERS' SOUNDS, AS A PLACE HEARS THEM ─────────────────
// Elite-Gates.md section 26 (THE SPIRE MIX): in the Spire the peers' sounds play 4 dB down, so eight players' blows,
// steps and swings never mask the cues that matter. Every peer sound plays inside `peerHeard` - this file's blows and
// hurts, the walkers' steps, swings and cries (net/remotePlayers.js), their climbing (net/peer/peerClimb.js) - and a place
// that turns them down hands its scope in (systems/eliteGates/egMix.js createSpireMix's `peers`); with none, a sound is as it was.
/** @type {((run: () => any) => any) | null} */
let _peerScope = null;
/** The place's scope over every peer sound (`(run) => run()` with a gain about it), or null to let them be. */
export function setPeerSoundScope(fn) { _peerScope = typeof fn === 'function' ? fn : null; }
/** GATE-MIX: the scope set now (null: none) - a place that hands one in takes it back only while it is still its own. */
export function peerSoundScope() { return _peerScope; }
/** A peer's sound (`run` plays it), through the place's scope where one is set. Answers what `run` answers. */
export function peerHeard(run) {
  if (!_peerScope) return run();
  try { return _peerScope(run); } catch { return undefined; }
}

// ── the sender ──────────────────────────────────────────────────────
/** STOREFRONT: `xk` my kills with an effect played, `xs` the last one's place in the scene (sent in the wire's frame,
 *  `xp`, once the pose's own mapping is in hand), `xh` the body's height in decimetres and `xt` when it fell (s). */
const mine = { hk: 0, hp: null, hb: 0, hq: 0, hu: 0, uq: 0, xk: 0, xs: /** @type {number[]|null} */ (null), xp: /** @type {number[]|null} */ (null), xh: 18, xt: -Infinity };

/** A blow of mine landed at `pos` (scene frame) - the splash seam's word. `toWire` maps scene to the wire frame. */
export function noteMyBlow(pos, bloodIndex, hit, toWire) {
  if (!pos || typeof toWire !== 'function') return;
  const w = toWire(pos);
  if (!Array.isArray(w) || !w.every(Number.isFinite)) return;
  mine.hk = (mine.hk + 1) % (U16 + 1) || 1;
  mine.hp = [w[0], w[1], w[2]];
  mine.hb = Math.max(0, Math.min(63, bloodIndex | 0));
  const share = hit && hit.maxHealth > 0 ? hit.damage / hit.maxHealth : 0.25;
  mine.hq = Math.max(0, Math.min(100, Math.round(share * 100)));
}
/** I was struck - `share` the blow's part of my health (0-1) when the host knows it. */
export function noteMyHurt(share = null) {
  mine.hu = (mine.hu + 1) % (U16 + 1) || 1;
  mine.uq = Number.isFinite(share) ? Math.max(0, Math.min(100, Math.round(share * 100))) : 20;
}
/** STOREFRONT (bible/06-Systems/Storefront.md section 4): my kill, where a body fell (`at` the scene's, `h` its height in
 *  metres) - told while it fell within KILL_FX_SAY_M of my feet (`from`, the scene's), so the others play it there in the
 *  effect my token names. `now` in seconds. Answers whether it is told. */
export function noteMyKill(/** @type {number[]} */ at, /** @type {number} */ h, /** @type {ArrayLike<number>|null|undefined} */ from, now = performance.now() / 1000) {
  if (!at || !at.every?.(Number.isFinite) || !within(at, from, KILL_FX_SAY_M)) return false;
  mine.xk = (mine.xk + 1) % (U16 + 1) || 1;
  mine.xs = [at[0], at[1], at[2]];
  mine.xp = null;
  mine.xh = Math.max(1, Math.min(120, Math.round((Number.isFinite(h) ? h : 1.8) * 10)));
  mine.xt = now;
  return true;
}
/** Is this one-shot the "a blow landed on me" ring. */
export const isHurtClip = (clip, volume, playerHitVolume = 1) => clip >= HIT_CLIP_FIRST && clip <= HIT_CLIP_LAST && volume === playerHitVolume;

/** The pose's fields - absent while their counts are 0. `toWire` the pose's own mapping from the scene (STOREFRONT: a
 *  kill's place is put in the wire's frame the first time a pose carries it), `now` in seconds (a kill rides
 *  KILL_FX_RIDE_S of poses). */
export function poseFx(/** @type {((q: number[]) => number[])|null} */ toWire = null, now = performance.now() / 1000) {
  const out = {};
  if (mine.hk && mine.hp) { out.hk = mine.hk; out.hp = mine.hp.slice(); out.hb = mine.hb; out.hq = mine.hq; }
  if (mine.hu) { out.hu = mine.hu; out.uq = mine.uq; }
  if (!mine.xk || !(now - mine.xt <= KILL_FX_RIDE_S)) return out;
  if (!mine.xp && mine.xs && typeof toWire === 'function') { const w = toWire(mine.xs); if (Array.isArray(w) && w.every(Number.isFinite)) mine.xp = [w[0], w[1], w[2]]; }
  if (mine.xp) { out.xk = mine.xk; out.xp = mine.xp.slice(); out.xh = mine.xh; }
  return out;
}
export function _resetPeerFxForTests() { mine.hk = 0; mine.hp = null; mine.hb = 0; mine.hq = 0; mine.hu = 0; mine.uq = 0; mine.xk = 0; mine.xs = null; mine.xp = null; mine.xh = 18; mine.xt = -Infinity; }

// ── the receiver ────────────────────────────────────────────────────

/** STOREFRONT: a peer's kill effect, through the running host's magic engine - by the "Others' effects" choice. */
function playPeerKill(/** @type {{ at: number[], kill: string, h: number }} */ q) {
  if (!othersEffectShown(q.at)) return;
  playerDoor()?.killFx?.(q.kill, q.at, { h: q.h, w: q.h * 0.45 });
}

/**
 * `play.blow({ at, bloodIndex, share })` and `play.hurt({ at })`, at scene positions; `toScene(p)` maps the wire
 * frame ({x,y,z}) to the scene. `update(id, pose, feet, dt)` once a frame for each peer I can see; `frame(dt)` plays
 * what is due; `splashed(pos)` is told of every splash drawn here (the dedupe). An update's `veiled`: whether the draw
 * conceals that peer (hidden, or drawn translucent).
 * @param {{play?: {blow?: (fx: any) => void, hurt?: (fx: any) => void, flinch?: (id: string) => void},
 *   toScene?: (p: {x: number, y: number, z: number, fy?: number}) => any, now?: () => number}} [opts]
 */
export function createPeerFxPlayer({ play, toScene, now = () => performance.now() / 1000 } = {}) {
  const seen = new Map();   // id -> { hk, hu, xk, tick, bt, ut, kt }
  const queue = [];         // { due, at, bloodIndex, share }
  const recent = [];        // { t, pos }
  let tick = 0;             // AUDIT MERGE-PLUS B3: frames drawn - an entry not refreshed on the last one is a peer gone
  const mounts = createMountFx();   // STOREFRONT: a riding peer's mount look, its beat (systems/horse/mountFx.js)
  return {
    update(id, pose, feet, height = 0, kit = null, veiled = false) {
      if (!pose || !id) return;
      const hk = pose.hk | 0, hu = pose.hu | 0, xk = pose.xk | 0;
      const s = seen.get(id);
      // AUDIT MERGE-PLUS B3: A PEER WHO WENT AWAY AND CAME BACK IS SEEN FOR THE FIRST TIME AGAIN. Only a peer still in the
      // room was forgotten when it fell from view; one that left kept its entry, and on its return (a party mate out of
      // a dungeon) its last blow and hurt played again, at a point long stale - the replay this file refuses.
      if (!s || s.tick < tick - 1) { seen.set(id, { hk, hu, xk, tick }); return; }
      s.tick = tick;
      const t = now();
      // STOREFRONT: on a horse (never the cart), the mount look their token names throws its beat under them - by the
      // player's own "Others' effects" choice, as its dye is (systems/horse/mountLook.js peerMountLook)
      const ridden = pose.rd === POSE_RIDE.Horse && !pose.wb && othersEffectShown(feet) ? effectWorn(kit, 'mount') : null;
      // AUDIT-STOREFRONT II (lane C 1): never under a rider the draw conceals - a beat thrown at an empty saddle, or lit
      // over a translucent one, is the rider found (its lantern's law, net/peer/peerRiders.js)
      mounts.step(id, veiled ? null : ridden, feet, pose.yaw, peerMoving(pose) ? (pose.mv === 2 ? 2 : 1) : 0, t - (s.ft ?? t));
      s.ft = t;
      // STOREFRONT: a kill of theirs with an effect played - the effect their token names (`kit`, net/effectLaw.js), where
      // their pose says the body fell; no faster than a blow lands, only near their own feet (KILL_FX_PEER_M), and only
      // by the player's own "Others'" choice
      if (xk && xk !== s.xk) {
        s.xk = xk;
        const look = effectWorn(kit, 'kill');
        const xp = Array.isArray(pose.xp) && pose.xp.length === 3 && pose.xp.every(Number.isFinite) ? pose.xp : null;
        const at = look && xp ? toScene?.({ x: xp[0], y: xp[1], z: xp[2] }) : null;
        if (at && within(at, feet, KILL_FX_PEER_M) && !(t - (s.kt ?? -Infinity) < FX_MIN_GAP_S)) { s.kt = t; queue.push({ due: t + FX_DELAY_S, at, kill: look, h: Math.max(1, pose.xh | 0) / 10 }); }
      }
      if (hk && hk !== s.hk) {
        s.hk = hk;
        const hp = Array.isArray(pose.hp) && pose.hp.length === 3 && pose.hp.every(Number.isFinite) ? pose.hp : null;
        const at = hp ? toScene?.({ x: hp[0], y: hp[1], z: hp[2], fy: pose.fy }) : null;   // AUDIT FB1030 N2: over the sender's room floor, as its body
        // AUDIT MERGE-PLUS B6: no faster than a blow can land (FX_MIN_GAP_S) - a modified client's pose said a new blow
        // on every one of its twenty frames a second, blood and a ring at any point it liked; the wire audit: and none
        // past its farthest shaft from its own feet (BLOW_PEER_M)
        if (at && within(at, feet, BLOW_PEER_M) && !(t - (s.bt ?? -Infinity) < FX_MIN_GAP_S)) {
          s.bt = t;
          queue.push({ due: t + FX_DELAY_S, at, bloodIndex: pose.hb | 0, share: Math.max(0, Math.min(100, pose.hq | 0)) / 100 });
        }
      }
      // PEERFX2 (the player: "when the other player gets hit make the same feedback as if he would've hit a mob"): a
      // peer struck gets a blow's whole feedback on their own body - the ring AND the blood splash, sized by what it
      // cost them - queued like a blow, so a splash the attacker's owner already drew there is not drawn twice
      if (hu && hu !== s.hu && !(t - (s.ut ?? -Infinity) < FX_MIN_GAP_S)) {   // AUDIT MERGE-PLUS B6: and a hurt the same
        s.hu = hu;
        s.ut = t;
        play?.flinch?.(id);   // PEERFX3: the red flash (and a class skin's hurt pose) at once, deduped or not
        if (feet) queue.push({ due: t + FX_DELAY_S, at: [feet[0], feet[1] + (height > 0 ? height / 2 : 0.9), feet[2]], bloodIndex: 0, share: Math.max(0, Math.min(100, (pose.uq ?? 20) | 0)) / 100, hurt: true });
      }
    },
    forget(id) { seen.delete(id); },
    splashed(pos) {
      if (!pos) return;
      recent.push({ t: now(), pos: [pos[0], pos[1], pos[2]] });
      if (recent.length > 32) recent.shift();
    },
    frame() {
      tick++;
      mounts.sweep();   // STOREFRONT: a rider not seen this frame lets its beat go
      if (seen.size > 64) for (const [id, s] of seen) if (s.tick < tick - 1) seen.delete(id);   // AUDIT MERGE-PLUS B3: bounded
      if (!queue.length) return;
      const t = now();
      while (recent.length && t - recent[0].t > DEDUPE_S + FX_DELAY_S) recent.shift();
      for (let i = queue.length - 1; i >= 0; i--) {
        const q = queue[i];
        if (q.due > t) continue;
        queue.splice(i, 1);
        if (q.kill) { playPeerKill(q); continue; }   // STOREFRONT: a kill effect is never a splash's duplicate
        const dup = recent.some((r) => t - r.t <= DEDUPE_S + FX_DELAY_S && Math.hypot(r.pos[0] - q.at[0], r.pos[1] - q.at[1], r.pos[2] - q.at[2]) <= DEDUPE_M);
        if (!dup) peerHeard(() => (q.hurt ? play?.hurt : play?.blow)?.({ at: q.at, bloodIndex: q.bloodIndex, share: q.share }));   // the owner drew and rang it already; EG-ZH: a peer's ring, as the place hears it
      }
    },
  };
}
