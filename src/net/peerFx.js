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

export const HIT_CLIP_FIRST = 108;   // soundClips SOUND.Hit1
export const HIT_CLIP_LAST = 112;    // Hit5
const U16 = 65535;
/** A splash this near, this recently, is the same blow drawn already (the foe owner's own). */
const DEDUPE_M = 1.2, DEDUPE_S = 0.6;
/** A peer's blow waits this long before it plays, so the owner's own splash (the hit frame) can land first. */
const FX_DELAY_S = 0.18;

// ── the sender ──────────────────────────────────────────────────────
const mine = { hk: 0, hp: null, hb: 0, hq: 0, hu: 0, uq: 0 };

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
/** Is this one-shot the "a blow landed on me" ring. */
export const isHurtClip = (clip, volume, playerHitVolume = 1) => clip >= HIT_CLIP_FIRST && clip <= HIT_CLIP_LAST && volume === playerHitVolume;

/** The pose's fields - absent while their counts are 0. */
export function poseFx() {
  const out = {};
  if (mine.hk && mine.hp) { out.hk = mine.hk; out.hp = mine.hp.slice(); out.hb = mine.hb; out.hq = mine.hq; }
  if (mine.hu) { out.hu = mine.hu; out.uq = mine.uq; }
  return out;
}
export function _resetPeerFxForTests() { mine.hk = 0; mine.hp = null; mine.hb = 0; mine.hq = 0; mine.hu = 0; mine.uq = 0; }

// ── the receiver ────────────────────────────────────────────────────

/**
 * `play.blow({ at, bloodIndex, share })` and `play.hurt({ at })`, at scene positions; `toScene(p)` maps the wire
 * frame ({x,y,z}) to the scene. `update(id, pose, feet, dt)` once a frame for each peer I can see; `frame(dt)` plays
 * what is due; `splashed(pos)` is told of every splash drawn here (the dedupe).
 * @param {{play?: {blow?: (fx: any) => void, hurt?: (fx: any) => void, flinch?: (id: string) => void},
 *   toScene?: (p: {x: number, y: number, z: number}) => any, now?: () => number}} [opts]
 */
export function createPeerFxPlayer({ play, toScene, now = () => performance.now() / 1000 } = {}) {
  const seen = new Map();   // id -> { hk, hu }
  const queue = [];         // { due, at, bloodIndex, share }
  const recent = [];        // { t, pos }
  return {
    update(id, pose, feet, height = 0) {
      if (!pose || !id) return;
      const hk = pose.hk | 0, hu = pose.hu | 0;
      const s = seen.get(id);
      if (!s) { seen.set(id, { hk, hu }); return; }
      if (hk && hk !== s.hk) {
        s.hk = hk;
        const hp = Array.isArray(pose.hp) && pose.hp.length === 3 && pose.hp.every(Number.isFinite) ? pose.hp : null;
        const at = hp ? toScene?.({ x: hp[0], y: hp[1], z: hp[2] }) : null;
        if (at) queue.push({ due: now() + FX_DELAY_S, at, bloodIndex: pose.hb | 0, share: Math.max(0, Math.min(100, pose.hq | 0)) / 100 });
      }
      // PEERFX2 (the player: "when the other player gets hit make the same feedback as if he would've hit a mob"): a
      // peer struck gets a blow's whole feedback on their own body - the ring AND the blood splash, sized by what it
      // cost them - queued like a blow, so a splash the attacker's owner already drew there is not drawn twice
      if (hu && hu !== s.hu) {
        s.hu = hu;
        play?.flinch?.(id);   // PEERFX3: the red flash (and a class skin's hurt pose) at once, deduped or not
        if (feet) queue.push({ due: now() + FX_DELAY_S, at: [feet[0], feet[1] + (height > 0 ? height / 2 : 0.9), feet[2]], bloodIndex: 0, share: Math.max(0, Math.min(100, (pose.uq ?? 20) | 0)) / 100, hurt: true });
      }
    },
    forget(id) { seen.delete(id); },
    splashed(pos) {
      if (!pos) return;
      recent.push({ t: now(), pos: [pos[0], pos[1], pos[2]] });
      if (recent.length > 32) recent.shift();
    },
    frame() {
      if (!queue.length) return;
      const t = now();
      while (recent.length && t - recent[0].t > DEDUPE_S + FX_DELAY_S) recent.shift();
      for (let i = queue.length - 1; i >= 0; i--) {
        const q = queue[i];
        if (q.due > t) continue;
        queue.splice(i, 1);
        const dup = recent.some((r) => t - r.t <= DEDUPE_S + FX_DELAY_S && Math.hypot(r.pos[0] - q.at[0], r.pos[1] - q.at[1], r.pos[2] - q.at[2]) <= DEDUPE_M);
        if (!dup) (q.hurt ? play?.hurt : play?.blow)?.({ at: q.at, bloodIndex: q.bloodIndex, share: q.share });   // the owner drew and rang it already
      }
    },
  };
}
