// @ts-check
// TACT2 - THE TACTICS BRAIN (bible/12-Enhanced-AI/Tactics-Arc.md; Mac, 2026-10-02: "enemy tactics like backing off and
// knowing when to strike"; "have enemies aware of each other"; his calls: 2 melee + 2 ranged attack tokens; animals
// and the cowardly human classes break and run, undead, daedra, constructs and guards never).
//
// A thin decision layer over the classic motor, read with the Enhanced AI switch on (this module is the switch's
// reader for it), and only while a foe SEES its target inside the engage range - out of sight, the motor's own pursuit
// (and the navmesh's, in a dungeon) finds the way. The motor still does the walking: the brain only says which way to
// step (`ai._tacDir`, at `ai._tacSpeed` of a walk, facing the target) and whether a blow may be struck
// (`ai._tacStrike`, `ai._tacShoot`). With the switch off every one of those stays unset and the motor is DFU's.
//
//   - TOKENS. At most TACT_MELEE_TOKENS foes hold a melee token on one target, TACT_RANGED_TOKENS a ranged one. A
//     holder walks in and strikes on DFU's own clock. The rest hold the RING - just outside reach - each on its own
//     angle (a slot), circling slowly, never swinging.
//   - THE STRIKE WINDOW. After its blow a holder backs out to the ring for a beat (RECOVER) and hands its token on:
//     the next to go in is the foe that has waited longest. A foe that has waited past its PATIENCE goes in whatever
//     the tokens say - nobody waits forever. A target whose back is turned on a waiting foe within reach is open: it
//     strikes.
//   - BACKING OFF. A foe that loses a share of its health in a short window backs out of reach and circles before it
//     comes back. A coward (an animal, a thief's kind of class) at low health runs (DFU's flee).
//   - KITING. A shooter backs away from a target closing inside its stand-off band - one burst, then it fights.
//   - FEEDBACK (2026-10-02, lumin: "New monster AI is painful... a little too hard. The archers that just keep kiting you
//     in a circle"; maya: "They keep walking backwards"): nobody backpedals after a target that presses it. A waiting
//     foe the target walks up to fights; the step back after a blow is a hop; a hurt foe or a kiting archer turns and
//     WALKS away (a foe walks the way it faces), at most once a cooldown; a shooter without a token stands off, never
//     circles.
//
// One registry of tokens, by target: the local player is one key, every other target its own object.

import { getPref } from '../systems/uiPrefs.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { MOBILE_TYPES } from '../characters/mobileTypes.js';
import { throwsBlows, blowShapesOf, makeBlow, fitBlowToGround, inBlow, setLiveBlow, windupNear, offsetBlows, BLOW_CHANCE, BLOW_COOLDOWN_MIN, BLOW_COOLDOWN_MAX, BLOW_COLOR, setBlowTargetOf } from './foeBlows.js';   // TACT4
import { tacticsNow, setTacticsClock, tickTactics } from './tacticsClock.js';   // AUDIT TACT D10/A3

export const tacticsSwitchOn = () => getPref('enhancedAI') === true;

/** Every number on one table. Metres, seconds, shares. */
export const TACT = Object.freeze({
  MELEE_TOKENS: 2,
  RANGED_TOKENS: 2,
  ENGAGE_RANGE: 14,          // a foe further than this from its target is pursuing, not fighting: the motor's own
  SHOOT_RANGE: 51.2,         // ...a shooter's, DFU's own ranged band's far edge (MAX_RANGED_DISTANCE)
  RING_GAP: 1.5,             // the ring stands this far outside the foe's own reach
  RING_SLACK: 0.6,           // the ring's band either side
  CIRCLE_SPEED: 0.4,         // a waiting foe circles at this share of its walk
  STEP_SPEED: 0.7,           // backing out, stepping to the ring
  SLOT_TURN: 0.15,           // how far round the ring a waiting foe's slot drifts a second (radians)
  SWING: 0.7,                // a blow plays out where it was struck before the foe backs out
  RECOVER_MIN: 0.8,          // the beat after a blow, out to the ring (seconds)
  RECOVER_MAX: 1.6,
  PATIENCE: 6,               // a foe waiting this long goes in, tokens or not
  HURT_SHARE: 0.25,          // of its health lost inside HURT_WINDOW: it backs off
  HURT_WINDOW: 3,
  BACKOFF: 2,                // ...for this long
  FLEE_SHARE: 0.2,           // a coward below this share of its health runs
  FLEE_SECONDS: 8,
  KITE_IN: 6,                // a shooter with a token backs off a target inside DFU's own bow band's near edge (MIN_RANGED_DISTANCE)...
  KITE_OUT: 7,               // ...until it stands this far off (AUDIT TACT A1: past the band's edge, never jittering on it)
  KITE_CORNERED: 3,          // a shooter whose step back meets a wall fights hand to hand this long (s)
  KITE_MAX: 2,               // FEEDBACK: one kiting burst lasts at most this long (s) - caught, it fights hand to hand...
  KITE_COOLDOWN: 8,          // ...and it kites again only this long after its last burst ended (s)
  RECOVER_HOP: 0.4,          // FEEDBACK: after its blow a holder backs out at most this long (s), then holds its ground
  BACKOFF_COOLDOWN: 10,      // FEEDBACK: a hurt foe backs off at most once in this long (s)
  WALK_FACE_DEG: 45,         // FEEDBACK: a foe walking away turns first, and steps only once it faces within this of its way
  FACE_BACK: 1,              // FEEDBACK: ...and at the walk's end has this long to turn back and face its target (s)
  RANGED_LEASE: 5,           // a ranged token held this long without a shot is handed on (s)
  BACKOFF_GAP: 2,            // a foe backing off stands this far past the ring
  BACK_TURNED_DEG: 110,      // the target's facing this far from the foe: its back is turned
  STALE: 1.5,                // a token holder unseen this long (despawned, unloaded) loses it
});

/** The cowardly human classes (Mac's call): the ones who live by not being hit. */
export const COWARD_CLASSES = Object.freeze(new Set(['Mage', 'Sorcerer', 'Healer', 'Bard', 'Burglar', 'Acrobat', 'Thief'].map((n) => MOBILE_TYPES[n])));
/** Does this kind break and run when badly hurt? Animals and the cowardly classes; undead, daedra, constructs and
 *  guards never (the watch is a Human-affinity class outside the list). */
export function isCoward(mobileId) {
  if (COWARD_CLASSES.has(mobileId)) return true;
  return ENEMY_BASICS[mobileId]?.affinity === 'Animal';
}

// AUDIT TACT (D10/A3): the foes' own time, ticked by the hosts (ai/tacticsClock.js) - never the wall's
const clock = tacticsNow;
export { tacticsNow, setTacticsClock, tickTactics };

/** @type {Map<any, { melee: Map<any, number>, ranged: Map<any, number>, waiting: Map<any, number> }>} */
const _boards = new Map();
/** The local player's facing, as its host last noted it (feet and a unit forward, xz) - for the back-turned test. */
let _me = null;
/** Each host, each frame: where the local player stands and faces. */
export function noteLocalPlayer(feet, fwd) {
  if (!feet || !fwd) { _me = null; return; }
  const l = Math.hypot(fwd[0], fwd[2]) || 1;
  _me = { feet: [feet[0], feet[1], feet[2]], fx: fwd[0] / l, fz: fwd[2] / l };
}
/** Tests: forget every board and the noted player. */
export function resetTactics() { _boards.clear(); _me = null; }
/** AUDIT TACT D3: a floating-origin recentre - the noted player and every live wind-up move with the world. */
export function offsetTactics(offset) {
  if (!offset) return;
  if (_me) { _me.feet[0] += offset[0]; _me.feet[1] += offset[1]; _me.feet[2] += offset[2]; }
  offsetBlows(offset);
}
/** AUDIT TACT A7: how many boards are held (tests, probes) - an emptied one is dropped. */
export const boardsHeld = () => _boards.size;

const LOCAL = Object.freeze({ local: true });
/** The board's key for an ai's target: the local player is one key; a peer by its owner; a foe by itself. */
export function targetKey(ai) {
  const t = ai._armedTargeting ? ai.target : null;
  if (!t || (t.isPlayer && !t.isPeer)) return LOCAL;
  return t.owner ?? t.peerId ?? t;
}
setBlowTargetOf(targetKey);   // AUDIT ARENA-LADDER 2: a landed verdict is its mark's alone (ai/foeBlows.js blowConnects)
function board(key) {
  let b = _boards.get(key);
  if (!b) _boards.set(key, b = { melee: new Map(), ranged: new Map(), waiting: new Map() });
  return b;
}
/**
 * AUDIT ARENA-LADDER (the owner, 2026-10-05: "Ensure AI enemies sometimes receive telegraphed attacks"): WHERE A BLOW IS
 * AIMED - the local player's feet (TACT4's law); and on the arena's sand, a BOUT-MATE's: a fighter of the same live bout
 * on another side (the pair characters/enemyTargets.js boutGate keeps, read off the two entities' own tags), so an
 * exhibition's fighters, a Grand Melee's and a two-against-one's wind up at each other as they wind up at the player.
 * Any other foe target is no mark (street infighting, a peer's foe - the TACT4 law kept): null.
 */
function blowAim(ai, key) {
  if (key === LOCAL) return _me?.feet ?? null;
  const t = ai.target;
  const sb = ai.vitals?.()?.bout, tb = t?.entity?.bout;
  if (!sb || !tb || t.dead || !t.ai?.feet) return null;
  if (String(sb.id) !== String(tb.id) || sb.out || tb.out || sb.hold || tb.hold || (sb.side | 0) === (tb.side | 0)) return null;
  return t.ai.feet;
}
/** Release every token and place `ai` holds (it died, despawned, lost its target, fled). */
export function releaseTactics(ai) {
  for (const [k, b] of _boards) {
    b.melee.delete(ai); b.ranged.delete(ai); b.waiting.delete(ai);
    if (k !== LOCAL && !b.melee.size && !b.ranged.size && !b.waiting.size) _boards.delete(k);   // AUDIT TACT A7: no dead target held
  }
  if (ai._tac) { ai._tac.key = null; if (ai._tac.state === 'windup') ai._tac.state = 'wait'; ai._tac.blow = null; }
  setLiveBlow(ai, null);   // TACT4: a wind-up dies with its foe's place
  clearBlowState(ai);
  ai._tacDir = null; ai._tacStrike = undefined; ai._tacShoot = undefined;
}
/** AUDIT TACT A4/D5/D6: a blow's landing state, spent - no verdict, weight or forced swing left for a later swing. */
function clearBlowState(ai) { ai._blowVerdict = null; ai._blowMult = undefined; ai._blowSwing = false; ai._blowFor = undefined; }
/** How many tokens of `kind` the target `key` has out (tests, probes). */
export function tokensOut(key, kind) { return _boards.get(key)?.[kind]?.size ?? 0; }
export const LOCAL_TARGET = LOCAL;

/** Is this foe a shooter (a bow, or a ranged spell it can cast)? */
const shooter = (ai) => !!ai.hasBowAttack || !!ai.canCastRangedSpell?.();

function prune(b, now) {
  for (const m of [b.melee, b.ranged, b.waiting]) for (const [a] of m) if (now - (a._tac?.seen ?? -Infinity) > TACT.STALE || a._tac?.seen == null) m.delete(a);
}

/** Take a token of `kind` for `ai` if one is free - or, past its patience, whatever the count. */
function take(b, kind, ai, now, cap) {
  const m = b[kind];
  if (m.has(ai)) return true;
  const waited = now - (b.waiting.get(ai) ?? now);
  if (m.size < cap) {
    // the longest waiter goes first: a free token is not taken over the head of one who has waited longer
    let longest = ai, best = waited;
    for (const [other, since] of b.waiting) {
      if (other === ai || m.has(other) || other._tac?.kind !== kind) continue;
      if (now - since > best + 1e-9) { best = now - since; longest = other; }
    }
    if (longest !== ai) return false;
  } else if (!(waited >= TACT.PATIENCE)) return false;
  m.set(ai, now);
  b.waiting.delete(ai);
  return true;
}

/**
 * The brain's turn, from the motor's classic tick (EnemyAI._classicTick, after the ranged stand-off). Answers true
 * when it took the step's decision (the motor returns), false to leave it to the classic ladder. `tx, tz` the
 * horizontal way to the target (the destination's).
 */
export function tacticsStep(ai, dx, dz) {
  ai._tacDir = null;
  ai._tacSpeed = 1;
  if (!tacticsSwitchOn()) { if (ai._tac) releaseTactics(ai); ai._tac = null; ai._tacStrike = undefined; ai._tacShoot = undefined; return false; }
  const now = clock();
  const s = ai._tac ?? (ai._tac = { key: null, kind: 'melee', state: 'wait', until: 0, slot: Math.random() * Math.PI * 2, hp: [], fled: false, seen: now, swung: 0, shot: 0, kiting: false, meleeUntil: 0, leased: 0, kiteUntil: 0, kiteReady: 0, backUntil: 0, backoffReady: 0, faceUntil: 0 });
  // AUDIT TACT D1/A3: a step it did not decide - knocked back, paralysed, held - is the MOTOR's word (`_tacSkipped`,
  // set when it could not act), never a gap on any clock: a slow frame is not a knock
  const skipped = !!ai._tacSkipped;
  ai._tacSkipped = false;
  s.seen = now;
  const dist = ai._dist;
  // FEEDBACK: a foe walking away has turned its back on its target, out of its own 180-degree sight - the walk is the
  // brain's, held to its end (a kite's burst, a back-off's beat), not handed to the classic motor to turn it round
  // (and through the turn back to face it after, a second at most)
  const away = s.key != null && (s.kiting || s.state === 'backoff' || now < (s.faceUntil ?? 0));
  const fighting = (ai.inSight || away) && ai.detected && Number.isFinite(dist) && dist <= (shooter(ai) ? TACT.SHOOT_RANGE : TACT.ENGAGE_RANGE) && !ai.follow;
  const key = fighting ? targetKey(ai) : null;
  ai._tacStrike = undefined; ai._tacShoot = undefined;
  // TACT4: a wind-up, once begun, is committed - it lands where it was aimed whether or not the target stays in sight
  if (s.state === 'windup' && s.blow) return windupTurn(ai, s, now, skipped);
  if (s.key !== key) { releaseTactics(ai); s.key = key; s.state = 'wait'; }
  if (!fighting) return false;
  const b = board(key);
  prune(b, now);
  // AUDIT TACT A1: a cornered shooter fights hand to hand a while. FEEDBACK: so does one inside its bow band's near edge
  // whose kite is spent - DFU's own fallback, a bow foe out of its band is a melee fighter - until the kite is back
  s.kind = shooter(ai) && now >= s.meleeUntil && (dist >= TACT.KITE_IN || s.kiting || now >= (s.kiteReady ?? 0)) ? 'ranged' : 'melee';
  if (s.kind === 'ranged') b.melee.delete(ai); else b.ranged.delete(ai);   // FEEDBACK: a token of the kind it no longer fights as is handed back
  if (!b.waiting.has(ai) && !b.melee.has(ai) && !b.ranged.has(ai)) b.waiting.set(ai, now);

  // health: the window's losses, and the coward's run
  const v = ai.vitals?.();
  if (v && v.maxHealth > 0) {
    s.hp.push([now, v.health]);
    while (s.hp.length && now - s.hp[0][0] > TACT.HURT_WINDOW) s.hp.shift();
    const share = v.health / v.maxHealth;
    if (!s.fled && share < TACT.FLEE_SHARE && isCoward(v.mobileType) && ai.predictedTargetPos) {
      s.fled = true;
      const from = ai.predictedTargetPos;
      releaseTactics(ai);
      ai._tac = s; s.key = null;
      ai.flee(from, TACT.FLEE_SECONDS);
      return true;
    }
    if (s.hp.length > 1 && (s.hp[0][1] - v.health) / v.maxHealth >= TACT.HURT_SHARE && s.state !== 'backoff' && now >= (s.backoffReady ?? 0)) {
      s.state = 'backoff'; s.until = now + TACT.BACKOFF; s.hp.length = 0;
      s.backUntil = s.until; s.backoffReady = now + TACT.BACKOFF_COOLDOWN;   // FEEDBACK: once a cooldown
      b.melee.delete(ai); b.ranged.delete(ai); b.waiting.set(ai, now);
    }
  }

  // its own blow landed: out to the ring, the token handed on
  const swung = ai._tacSwung ?? 0;
  if (swung !== s.swung) {
    s.swung = swung;
    if (s.state === 'engage') { s.state = 'swing'; s.until = now + TACT.SWING; }   // the blow plays out where it was struck
  }
  if (s.state === 'swing' && now >= s.until) {
    s.state = 'recover'; s.until = now + TACT.RECOVER_MIN + Math.random() * (TACT.RECOVER_MAX - TACT.RECOVER_MIN);
    s.backUntil = now + TACT.RECOVER_HOP;   // FEEDBACK: a hop out, not a retreat
    b.melee.delete(ai); b.waiting.set(ai, now);
  }
  if ((s.state === 'recover' || s.state === 'backoff') && now >= s.until) {
    if (s.state === 'backoff') s.faceUntil = now + TACT.FACE_BACK;   // FEEDBACK: it turns back to face the fight
    s.state = 'wait';
  }

  const reach = ai.stopDistance ?? 2.25;
  const ring = reach + TACT.RING_GAP;
  const l = Math.hypot(dx, dz) || 1;
  const ux = dx / l, uz = dz / l;   // to the target
  const face = () => { ai.yaw = turnToward(ai.yaw, dx, dz); };

  // a shooter: the token gates its shot; with one, it kites a closing target
  if (s.kind === 'ranged') {
    // AUDIT TACT A2: a shot spends the token (the longest waiter shoots next), and a token held without a shot is a lease
    const shot = ai._tacShot ?? 0;
    if (shot !== s.shot) { s.shot = shot; if (b.ranged.delete(ai)) b.waiting.set(ai, now); }
    if (b.ranged.has(ai) && now - s.leased > TACT.RANGED_LEASE) { b.ranged.delete(ai); b.waiting.set(ai, now); }
    const had = b.ranged.has(ai);
    const has = take(b, 'ranged', ai, now, TACT.RANGED_TOKENS);
    if (has && !had) s.leased = now;
    ai._tacShoot = has;
    // AUDIT TACT A1: inside the bow band's near edge it backs out, past the edge, and only then stands to shoot.
    // FEEDBACK: with or without a token (the token is the shot's, not the step's), it turns and walks out, one burst of
    // at most KITE_MAX - caught, or a wall at its back, and it fights hand to hand until its kite is back
    if (s.kiting ? dist < TACT.KITE_OUT : dist < TACT.KITE_IN) {
      if (!s.kiting) { s.kiting = true; s.kiteUntil = now + TACT.KITE_MAX; }
      if (ai._tacBlocked || now >= s.kiteUntil) {   // a wall behind it: cornered, it fights hand to hand
        ai._tacBlocked = false; s.kiting = false; s.meleeUntil = now + TACT.KITE_CORNERED; s.kiteReady = now + TACT.KITE_COOLDOWN; s.faceUntil = now + TACT.FACE_BACK;
        b.ranged.delete(ai); b.waiting.set(ai, now);
        return false;
      }
      return walkAway(ai, -ux, -uz, TACT.STEP_SPEED);
    }
    if (s.kiting) { s.kiting = false; s.kiteReady = now + TACT.KITE_COOLDOWN; s.faceUntil = now + TACT.FACE_BACK; }
    ai._tacBlocked = false;
    if (!ai.inSight && now < s.faceUntil) { face(); ai.moving = false; return true; }   // FEEDBACK: out past the edge, it turns back to shoot
    // FEEDBACK: no ring for a shooter - with a token the classic stand-off and shot, without one the stand-off alone
    // (it holds its fire), never circling the target
    return false;
  }
  ai._tacBlocked = false;

  // melee
  const backTurned = key === LOCAL && _me && backTurnedOn(ai);
  // FEEDBACK: a target inside the ring's near edge has walked up to a foe that keeps off it - pressed, it fights back
  // rather than backpedalling ahead of it; the tokens ration who comes IN, never who answers
  const open = (backTurned && dist <= ring + TACT.RING_SLACK) || dist < ring - TACT.RING_SLACK;
  if (s.state === 'wait' && (take(b, 'melee', ai, now, TACT.MELEE_TOKENS) || open)) {
    s.state = 'engage';
  }
  if (s.state === 'engage' && !b.melee.has(ai) && !open) s.state = 'wait';
  // TACT4: a telegraphed blow - a holder in reach of the tier, its cooldown spent, nobody else winding up near its mark
  // (AUDIT ARENA-LADDER: the mark me, or on the sand a bout-mate - blowAim)
  const aim = s.state === 'engage' && b.melee.has(ai) ? blowAim(ai, key) : null;
  if (aim && dist <= reach + 0.5 && ai.canAct !== false && now >= (s.blowReady ?? 0)) {   // AUDIT TACT: a token holder's, never an opportunist's
    const ent = ai.vitals?.();
    if (throwsBlows(ent) && !windupNear(aim, now, ai) && Math.random() < BLOW_CHANCE) {
      const shapes = blowShapesOf(ent.mobileType);
      s.blow = fitBlowToGround(makeBlow(shapes[Math.floor(Math.random() * shapes.length)], ai.feet, Math.atan2(dx, dz), now, BLOW_COLOR), ai.collider);   // AUDIT TACT D8: on the ground it marks
      s.blow.tg = key;   // AUDIT ARENA-LADDER: whom it was wound up at - it lands on that one alone
      if (key !== LOCAL) s.blow.sand = true;   // ...and one at a bout-mate is drawn for the stands (foeBlows.js SAND_DRAW_RANGE)
      setLiveBlow(ai, s.blow);
      s.state = 'windup';
    }
  }
  if (s.state === 'windup') return windupTurn(ai, s, now, skipped);
  if (s.state === 'engage') { ai._tacStrike = true; return false; }   // the classic walk in and swing
  if (s.state === 'swing') { ai._tacStrike = false; ai.moving = false; face(); return true; }   // stands its blow
  ai._tacStrike = false;
  // AUDIT TACT A5: a foe backing off holds its OWN farther ring - out of reach, circling - not the waiting ring it
  // would be walked back in to the moment it got there
  const hold = s.state === 'backoff' ? ring + TACT.BACKOFF_GAP : ring;
  return holdRing(ai, s, b, ux, uz, dist, hold, now, face);
}

/** FEEDBACK: walk the way it faces - turn toward `wx, wz` first (in place, as the classic motor turns), then step. */
function walkAway(ai, wx, wz, speed) {
  ai.yaw = turnToward(ai.yaw, wx, wz);
  let d = Math.atan2(wx, wz) - ai.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  if (Math.abs(d) > TACT.WALK_FACE_DEG * Math.PI / 180) { ai.moving = false; return true; }
  ai._tacDir = [wx, wz]; ai._tacSpeed = speed; ai.moving = true;
  return true;
}

/** TACT4: the wind-up's turn - broken by a knock or a paralysis (a step the motor did not let the brain decide), else
 *  stood, its aim locked, until the landing: where my feet stand decides it, and the swing comes now. */
function windupTurn(ai, s, now, skipped) {
  const cooled = now + BLOW_COOLDOWN_MIN + Math.random() * (BLOW_COOLDOWN_MAX - BLOW_COOLDOWN_MIN);
  if (skipped || ai.canAct === false || ai.hurtKnock || ai.knockbackSpeed > 0) {
    setLiveBlow(ai, null); s.blow = null; s.state = 'engage'; s.blowReady = cooled;
    clearBlowState(ai);
    return false;
  }
  if (now >= s.blow.land) {
    // AUDIT TACT A4/D6: only ever at the one it was wound up at - me, or (AUDIT ARENA-LADDER) a bout-mate on the sand; a
    // wind-up whose foe has turned on another lands on no one
    const key = targetKey(ai);
    const at = key === (s.blow.tg ?? LOCAL) ? blowAim(ai, key) : null;   // a blow wound up before its mark was kept is mine
    if (at) {
      ai._blowVerdict = inBlow(s.blow, at[0], at[2]);
      ai._blowMult = s.blow.mult; ai._blowAt = now; ai._blowSwing = true; ai._blowFor = key;   // AUDIT ARENA-LADDER 2: whose verdict it is
    } else clearBlowState(ai);
    s.blowReady = cooled; s.state = 'engage'; s.blow = null;
    ai._tacStrike = true;
    return false;
  }
  ai._tacStrike = false; ai._tacShoot = false; ai.moving = false;   // AUDIT TACT A4: no shot, no spell, mid-wind-up
  return true;
}

/** Hold the ring: step in or out to it, else circle round toward the foe's own slot. FEEDBACK: out only while its
 *  back-step lasts (a hop after a blow, facing; a hurt foe's retreat, walked facing its way) - then it holds its ground. */
function holdRing(ai, s, b, ux, uz, dist, ring, now, face) {
  if (dist < ring - TACT.RING_SLACK && now < (s.backUntil ?? 0)) {
    if (s.state === 'backoff') return walkAway(ai, -ux, -uz, TACT.STEP_SPEED);
    face(); ai._tacDir = [-ux, -uz]; ai._tacSpeed = TACT.STEP_SPEED; ai.moving = true; return true;
  }
  face();
  if (dist > ring + TACT.RING_SLACK) return false;   // the classic advance brings it to the ring
  if (dist < ring - TACT.RING_SLACK) { ai.moving = false; return true; }   // FEEDBACK: its back-step spent, it stands
  // round the ring toward the slot: the angle of this foe about the target against its slot
  s.slot += TACT.SLOT_TURN * 0.0625;
  const here = Math.atan2(-ux, -uz);
  let d = s.slot - here;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  if (Math.abs(d) < 0.2) { ai.moving = false; return true; }
  const side = d > 0 ? 1 : -1;   // tangent: (-uz, ux) turns the bearing positive
  ai._tacDir = [side * -uz, side * ux];   // d(sin t, cos t)/dt = (cos t, -sin t) = (-uz, ux) at t = here
  ai._tacSpeed = TACT.CIRCLE_SPEED;
  ai.moving = true;
  return true;
}

function backTurnedOn(ai) {
  const vx = ai.feet[0] - _me.feet[0], vz = ai.feet[2] - _me.feet[2];
  const l = Math.hypot(vx, vz) || 1;
  const dot = (vx / l) * _me.fx + (vz / l) * _me.fz;
  return dot < Math.cos(TACT.BACK_TURNED_DEG * Math.PI / 180);
}

function turnToward(yaw, dx, dz) {
  const want = Math.atan2(dx, dz);
  let d = want - yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const step = 0.35;   // radians a classic tick - quicker than the walk's turn, a fighter squaring up
  return yaw + Math.max(-step, Math.min(step, d));
}
