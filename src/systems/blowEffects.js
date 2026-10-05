// @ts-check
// TELL6e (bible/12-Enhanced-AI/Feud-Arc.md section 8.2; Mac, 2026-10-04: "breath more depth into it", then "Go"):
// WHAT A LANDING DOES TO YOU. A telegraphed blow that lands on the local player (a dodged one does nothing; a peer's
// own client applies its own, TELL8) does more than its damage, by its shape:
//   PUSH      the lunge 3 m/s, the charge 5 m/s, decaying at 12 m/s/s along the collider - never over an edge of
//             more than 2 m (player/motor.js blowPush);
//   RATTLE    the slam, the ring, the leap: 0.6 s at 60% of the walk, and the camera dips (the host's shake);
//   BLEED     the sweep: 30% of the blow's damage again over 3 s, in three ticks through the host's hurt, the harm mark
//             naming its foe (REVENANT-HARM credits a death to it); shown with the debuffs (ui/hudActiveSpells.js);
//             any healing ends it - a spell, a potion, a bandage, a rest;
//   KNOCKDOWN an iron slam, ring or charge (OPEN 6): 0.9 s down - the eye drops 0.6 m and rises, no move, no swing, no
//             cast - and 5 s before another.
// The pools queue a landing where its damage lands (queueBlowEffect); each host's player frame applies them
// (drainBlowEffects) and ticks the bleed (tickBleed). On the foes' own clock (ai/tacticsClock.js).
import { tacticsNow } from '../ai/tacticsClock.js';
import { markPlayerHarm, HARM_MARK_STRUCK_MS } from './harmMark.js';

export const BLOW_EFFECT = Object.freeze({
  PUSH: Object.freeze({ lunge: 3, charge: 5 }),   // m/s (the decay and the edge: player/motor.js BLOW_PUSH_*)
  RATTLE: Object.freeze(['slam', 'ring', 'leap']),
  RATTLE_S: 0.6,
  RATTLE_WALK: 0.6,
  RATTLE_SHAKE: 0.5,   // the camera's dip, on the host's own shake (its player's maxShake)
  BLEED: Object.freeze(['sweep']),
  BLEED_SHARE: 0.3,
  BLEED_TICKS: 3,
  BLEED_EVERY: 1,      // s between ticks - three over 3 s
  KNOCKDOWN: Object.freeze(['slam', 'ring', 'charge']),   // iron's alone
  KNOCKDOWN_S: 0.9,
  KNOCKDOWN_GUARD: 5,
  KNOCKDOWN_DROP: 0.6,
});

/** What a blow of `kind` (iron or not) does when it lands. */
export function blowEffectOf(kind, iron = false) {
  return {
    push: BLOW_EFFECT.PUSH[kind] ?? 0,
    rattle: BLOW_EFFECT.RATTLE.includes(kind),
    bleed: BLOW_EFFECT.BLEED.includes(kind),
    knockdown: !!iron && BLOW_EFFECT.KNOCKDOWN.includes(kind),
  };
}

/** @type {{ fx: ReturnType<typeof blowEffectOf>, dmg: number, dir: number[] | null, foe: any }[]} */
const _queue = [];
/** A telegraphed blow's damage landed on the local player: `fx` what it does, `dmg` what it did, `dir` [x, z] from its
 *  foe toward the player, `foe` its entity. */
export function queueBlowEffect(fx, dmg, dir, foe) {
  if (fx) _queue.push({ fx, dmg, dir, foe });
}

let _downUntil = -Infinity, _guardUntil = -Infinity, _downMotor = null;
/** Is the local player knocked down now? The swing and the cast ask (the hosts' rig gate, scenes/hostMagic.js).
 *  AUDIT TELL L9: while the body the knockdown took is down too - a placement (motor.spawn: a load, a rise, a
 *  teleport) stands it up, and the swing and the cast with it; the clock alone bounds it, so a body a host left is
 *  never down for good. */
export const knockedDown = (now = tacticsNow()) => now < _downUntil && (_downMotor?.isDown?.() ?? true);

/**
 * The host's player frame: every queued landing applied - the motor's push, rattle and knockdown (`motor` the
 * player's PlayerMotor), the camera's dip (`shake(k)`), a bleed begun on `entity`.
 */
export function drainBlowEffects({ motor = null, entity = null, shake = null, now = tacticsNow() } = {}) {
  if (entity && !(entity.health > 0)) { _queue.length = 0; return; }   // AUDIT TELL L1: a dead body takes nothing
  while (_queue.length) {
    const { fx, dmg, dir, foe } = /** @type {any} */ (_queue.shift());
    // AUDIT TELL L4: the body says whether it can go down (a climb, a hold, a mantle, a swim, a levitation cannot) -
    // refused, the guard stands unspent and the blow pushes as any other
    if (fx.knockdown && now >= _guardUntil && motor?.blowKnockDown?.(BLOW_EFFECT.KNOCKDOWN_S, BLOW_EFFECT.KNOCKDOWN_DROP) !== false) {   // it takes any push with it
      _downUntil = now + BLOW_EFFECT.KNOCKDOWN_S; _guardUntil = _downUntil + BLOW_EFFECT.KNOCKDOWN_GUARD; _downMotor = motor;
    } else if (fx.push > 0 && dir) {
      const l = Math.hypot(dir[0], dir[1]);
      if (l > 0) motor?.blowPush?.((dir[0] / l) * fx.push, (dir[1] / l) * fx.push);
    }
    if (fx.rattle) { motor?.blowRattle?.(BLOW_EFFECT.RATTLE_S, BLOW_EFFECT.RATTLE_WALK); shake?.(BLOW_EFFECT.RATTLE_SHAKE); }
    if (fx.bleed && entity && dmg > 0) startBleed(entity, dmg * BLOW_EFFECT.BLEED_SHARE, foe, now);
  }
}

/** BLEED: `total` more over BLEED_TICKS ticks; a second bleed adds what the first had left. */
export function startBleed(entity, total, foe, now = tacticsNow()) {
  if (!(entity?.health > 0)) return;   // AUDIT TELL L1: a dead body never bleeds - its tick would hurt a corpse into a second death
  const b = entity.bleed;
  const left = b ? b.per * b.left : 0;
  entity.bleed = { per: (left + total) / BLOW_EFFECT.BLEED_TICKS, left: BLOW_EFFECT.BLEED_TICKS, next: now + BLOW_EFFECT.BLEED_EVERY, health: entity.health, foe };
}
/** The bleed's turn, each host frame: any healing since its last word ends it; a tick due hurts (`hurt(n)`, the host's
 *  own door - its flash and its voice) with its foe's mark standing. Answers the damage dealt this call. */
export function tickBleed(entity, hurt, now = tacticsNow()) {
  const b = entity?.bleed;
  if (!b) return 0;
  if (entity.health > b.health || !(entity.health > 0)) { entity.bleed = null; return 0; }   // healed: a spell, a potion, a bandage, a rest; AUDIT TELL L1: or dead
  let dealt = 0;
  while (entity.bleed && now >= b.next && b.left > 0) {
    // AUDIT TELL L5: the whole is dealt and no more - each tick its share of what is left, rounded, the rest carried
    // (a bleed of 1 was three ticks of 1)
    const rem = b.per * b.left;
    const n = Math.round(rem / b.left);
    if (n > 0) {
      if (b.foe) markPlayerHarm(b.foe, { ms: HARM_MARK_STRUCK_MS });   // REVENANT-HARM: its blow's, still
      hurt(n);
      dealt += n;
    }
    b.left--; b.next += BLOW_EFFECT.BLEED_EVERY;
    b.per = b.left > 0 ? (rem - n) / b.left : 0;
    b.health = entity.health;
    if (b.left <= 0 || !(entity.health > 0)) entity.bleed = null;
  }
  return dealt;
}

/** AUDIT TELL L2: a load - the queue, the knockdown and its guard forgotten, and `entity`'s bleed ended (the last
 *  game's landings are nobody's in this one; save.js restorePlayer). The motor's own are its placement's (spawn). */
export function resetBlowEffects(entity = null) {
  _queue.length = 0; _downUntil = -Infinity; _guardUntil = -Infinity; _downMotor = null;
  if (entity) entity.bleed = null;
}
/** Tests: the queue and the knockdown forgotten. */
export function _resetBlowEffectsForTests() { resetBlowEffects(); }
