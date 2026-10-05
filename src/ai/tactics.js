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
//   - TELL1 (bible/12-Enhanced-AI/Feud-Arc.md section 3): POISE. A foe winding up holds through a blow - the doors write
//     no knockback - and the blow's weight fills its poise meter; at its poise the wind-up breaks and the foe is
//     STAGGERED (a held Hurt, nothing decided, a quarter more taken). Before it, any landed hit broke any wind-up.
//
// One registry of tokens, by target: the local player is one key, every other target its own object.

import { getPref } from '../systems/uiPrefs.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { MOBILE_TYPES } from '../characters/mobileTypes.js';
import { throwsBlows, blowShapesOf, blowFamily, makeBlow, fitBlowToGround, inBlow, setLiveBlow, shatterBlow, windupNear, offsetBlows, BLOW, BLOW_CHANCE, BLOW_COLOR, IRON_COLOR, BLOW_VERDICT_LIFE, BLOW_STALE, setBlowTargetOf } from './foeBlows.js';   // TACT4; TELL3: iron; TELL5: the family, the shapes' lengths
import { coverDistance } from './cover.js';   // TELL6: a charge's lane must be free of cover
import { GRAVITY } from '../player/motor.js';   // TELL6c: a leap's hop on the motor's own gravity
import { tacticsNow, setTacticsClock, tickTactics } from './tacticsClock.js';   // AUDIT TACT D10/A3
import { TELL, poiseOf, staggerSeconds, glintStrength, blowGuard, punishSeconds, windupSeconds, feints, chains, chainShape, trackYaw, blowCooldown, wholeSet, feintChance, trackShare, chainMax } from './tells.js';   // TELL1: poise and the stagger (bible/12-Enhanced-AI/Feud-Arc.md section 3); TELL3: a blow's guard; TELL4: the punish window; TELL5: patterns; TELL7: the cooldowns
import { registerBlowTakenMod } from '../systems/blowTaken.js';   // TELL1: a staggered foe takes more - the leaf the formulas read
import { noteFeud } from '../systems/feudLedger.js';   // RVN1: a blow of its I dodged, in its fight's ledger (a leaf - the brain brings no revenant system)

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
/** TELL8: a stagger or an overreach a puppet's owner says stands, on the puppet's entity until its owner says it ended -
 *  finite, as the fold reads `Number.isFinite` (staggeredNow); its home here, so a foe handed over (tacticsStep) can tell
 *  its owner's word from its own. ai/puppetBlows.js writes it. */
export const PUPPET_HELD_UNTIL = 1e9;
/**
 * THE MARK - the feet a telegraphed blow is aimed at: mine for the local player's key (TACT4's law); TELL8
 * (bible/12-Enhanced-AI/Feud-Arc.md 10.2, OPEN 9) a PEER's the foe hunts (its candidate's, refreshed each frame in this
 * frame's coordinates); and AUDIT ARENA-LADDER (the owner, 2026-10-05: "Ensure AI enemies sometimes receive telegraphed
 * attacks") on the arena's sand a BOUT-MATE's: a fighter of the same live bout on another side (the pair
 * characters/enemyTargets.js boutGate keeps, read off the two entities' own tags), so an exhibition's fighters, a Grand
 * Melee's and a two-against-one's wind up at each other as they wind up at the player. Null for any other target
 * (street infighting, a peer's foe, a peer with no pose). Each client judges its own feet at the landing (10.3) - and a
 * bout-mate's are judged here, where both fighters run (`judgedHere`); the owner's own view of a peer's decides only its
 * foe's window (6.3).
 */
function targetFeet(ai, key) {
  if (key === LOCAL) return _me?.feet ?? null;
  const t = ai?.target;
  if (t?.isPeer) return Array.isArray(t.feet) && t.feet.length === 3 ? t.feet : null;
  const sb = ai?.vitals?.()?.bout, tb = t?.entity?.bout;
  if (!sb || !tb || t.dead || !t.ai?.feet) return null;
  if (String(sb.id) !== String(tb.id) || sb.out || tb.out || sb.hold || tb.hold || (sb.side | 0) === (tb.side | 0)) return null;
  return t.ai.feet;
}
/** AUDIT ARENA-LADDER: is a landing at the mark `key` (one targetFeet found) judged on this client - mine, or a
 *  bout-mate's on the sand? A peer's is the peer's own (TELL8 10.3). */
const judgedHere = (ai, key) => (key === LOCAL ? !!_me : !ai?.target?.isPeer);
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
/** Release every token and place `ai` holds (it died, despawned, lost its target, fled). */
export function releaseTactics(ai) {
  for (const [k, b] of _boards) {
    b.melee.delete(ai); b.ranged.delete(ai); b.waiting.delete(ai);
    if (k !== LOCAL && !b.melee.size && !b.ranged.size && !b.waiting.size) _boards.delete(k);   // AUDIT TACT A7: no dead target held
  }
  if (ai._tac) { ai._tac.key = null; if (ai._tac.state === 'windup') { ai._tac.state = 'wait'; dropSwing(ai); } ai._tac.blow = null; }
  if (ai._tac?.state === 'overreach') { ai._tac.state = 'wait'; endOverreach(ai); }   // TELL4: its window goes with its place
  if (ai._tac?.state === 'chain') ai._tac.state = 'wait';   // TELL5: and a chain it had yet to wind up
  if (ai._tac?.state === 'dash') { ai._tac.state = 'wait'; ai._tac.dash = null; dropSwing(ai); }   // TELL6: and a charge mid-lane
  setLiveBlow(ai, null);   // TACT4: a wind-up dies with its foe's place
  clearBlowState(ai);
  ai._tacDir = null; ai._tacStrike = undefined; ai._tacShoot = undefined;
  ai._aimReady = false; ai._wantAimed = false; ai._blowShot = null;   // AUDIT TELL B4: an archer's aimed shot goes too (DFU's bow roll, whole again)
}
/** AUDIT TELL B1/B2 (bible/12-Enhanced-AI/Feud-Arc.md, the AUDIT TELL record): a wind-up, a charge's run or a chain's
 *  gap BROKEN where the brain was not asked - a paralysis or a Calm (the motor's CanAct), a flight, a pool not stepped
 *  (an interior visit, a held window): the mark gone, the held swing dropped, the cooldown begun, no verdict for any
 *  later swing. A blow is told or it is nothing. Answers whether there was one to break. */
export function breakWindup(ai) {
  const s = ai?._tac;
  if (!s || s.puppet || (s.state !== 'windup' && s.state !== 'dash' && s.state !== 'chain')) return false;
  const cooled = clock() + blowCooldown(ai.vitals?.());
  setLiveBlow(ai, null);
  s.blow = null; s.dash = null; s.state = 'engage'; s.blowReady = cooled;
  clearBlowState(ai); dropSwing(ai);
  ai._tacDir = null;
  return true;
}
/** AUDIT TELL B1: a brain state the brain has not seen this long (on the foes' own clock - capped a frame,
 *  ai/tacticsClock.js, so no slow frame reaches it) was not stepped: its wind-up tells nothing now. A puppet's is seen by
 *  its frames (ai/puppetBlows.js). */
const unseen = (s, now) => s?.seen != null && now - s.seen > BLOW_STALE;
/** AUDIT TACT A4/D5/D6: a blow's landing state, spent - no verdict, weight or forced swing left for a later swing. */
function clearBlowState(ai) { ai._blowVerdict = null; ai._blowMult = undefined; ai._blowSwing = false; ai._blowFor = undefined; }
/** TELL2: a wind-up's held swing dropped (its wind-up broke, a paralysis, its place gone) - the sprite and the attack
 *  component let it go and strike nothing (characters/mobileUnit.js, characters/enemyAttack.js). */
function dropSwing(ai) { ai._blowHold = 'cancel'; ai._blowWind = false; }

// ── TELL1: POISE AND THE STAGGER (bible/12-Enhanced-AI/Feud-Arc.md section 3; Mac: "player's can easily stun these
// enemies") ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Does a blow landing on this foe land on a wind-up? Then it HOLDS - the door writes no knockback and plays no Hurt -
 *  and its weight goes on the poise meter (`windupStruck`). The switch off, never. */
export function windupHolds(ai) {
  const s = ai?._tac;
  return !!s && s.state === 'windup' && !!s.blow && ai.canAct !== false && !unseen(s, clock()) && tacticsSwitchOn();   // AUDIT TELL B1: a foe that cannot act holds nothing
}
/**
 * TELL1: a blow of weight `v` (ai/tells.js blowWeight) landed on a foe winding up - `ent` its entity, `weight` DFU's
 * weight in classic units, kit and all (formulas.enemyWeightClassicUnits, as the door's knockback reads it). The meter
 * fills against the foe's poise (set at the first blow: its kind's health by its weight, by what it is); at the poise
 * the wind-up BREAKS - its mark gone, the blow's cooldown begun, its melee token handed on - and the foe is STAGGERED
 * for its weight's `STAGGER_S`: nothing it decides (the motor's CanAct), its Hurt held, every blow it takes
 * x`STAGGER_TAKEN`. Inside `STAGGER_IMMUNE` of its last stagger's end a broken wind-up only breaks. TELL3: an IRON
 * blow (its `guard`) takes no poise - every blow holds it, nothing fills.
 * Answers null (no wind-up here: DFU's knockback, as ever), 'hold', 'break' or 'stagger'.
 */
export function windupStruck(ai, ent, weight, v) {
  if (overreachOpen(ai)) return punishStruck(ai, ent, weight);   // TELL4: an overreached foe - the first blow staggers it
  if (!windupHolds(ai)) return null;
  const s = ai._tac, b = s.blow, now = clock();
  if (b.guard === 'iron') return 'hold';   // TELL3: iron takes no poise - it lands (a paralysis alone stops it, windupTurn)
  if (!Number.isFinite(b.poise)) b.poise = poiseOf(ent, weight);
  b.taken = (b.taken ?? 0) + (v > 0 ? v : 0);
  if (b.taken < b.poise) return 'hold';
  shatterBlow(ai, now); s.blow = null;   // AUDIT TELL (3.2): its mark shatters
  s.blowReady = now + blowCooldown(ent);   // TELL7: by its tier
  clearBlowState(ai);
  dropSwing(ai);
  handOn(ai, s, now);
  ai._tacStrike = false; ai._tacShoot = false; ai.moving = false;
  if (now < (s.staggerReady ?? -Infinity)) { s.state = 'wait'; return 'break'; }   // no stunlock: a stagger, then 3 s of none
  return stagger(ai, s, ent, weight, now);
}
/** Its melee token goes on to whoever waited longest. */
function handOn(ai, s, now) {
  const bd = s.key != null ? _boards.get(s.key) : null;
  if (bd) { bd.melee.delete(ai); bd.waiting.set(ai, now); }
}
/** TELL1 (3.2): STAGGERED for its weight's length - one law for a broken wind-up and an overreach answered (TELL4). */
function stagger(ai, s, ent, weight, now) {
  s.state = 'staggered'; s.until = now + staggerSeconds(weight); s.staggerReady = s.until + TELL.STAGGER_IMMUNE;
  ai.staggerUntil = s.until;   // the motor's hold (characters/enemyMotor.js _step)
  if (ent) ent.staggerUntil = s.until;   // ...and what every blow at it reads (the fold below)
  return 'stagger';
}
/** TELL2: the glint on a foe's body this frame - `[r, g, b, strength]` in its blow's colour, or null: no wind-up, or a
 *  feint (a feint never glints - the glint is the honest tell). `reduced` the viewer's reduced motion. */
export function foeGlint(ai, now = clock(), reduced = false) {
  const s = ai?._tac, b = s?.state === 'windup' ? s.blow : null;
  if (!b || b.feint || unseen(s, now)) return null;   // AUDIT TELL B1: a wind-up nobody is stepping tells nothing
  const k = glintStrength(now - b.start, b.land - now, reduced);
  if (!(k > 0)) return null;
  const c = b.color ?? BLOW_COLOR;
  _glint[0] = c[0]; _glint[1] = c[1]; _glint[2] = c[2]; _glint[3] = k;   // AUDIT TELL U9: the one array, refilled - its reader copies it (systems/hitFlash.js setBatchGlint)
  return _glint;
}
const _glint = [0, 0, 0, 0];
/**
 * TELL9 (section 11.1): what the target bar's POISE TRACK shows for `ai` - null for a foe with no brain or with the
 * switch off (no track at all: the classic motor's fight), else `{ state, fill, word }`: 'empty' outside a wind-up;
 * 'windup' amber, `fill` the meter's share of its poise (0 before the first blow sets it); 'iron' red and full, "Iron";
 * 'staggered' white and full, "Staggered"; 'open' through an overreach, "Open". A feint reads as any wind-up (the bar
 * tells no more than the ground) and a cut one is gone; a charge's run is its landing, empty (AUDIT TELL: it holds no
 * poise - the doors' law; it was read as its wind-up).
 */
export function poiseTrack(ai) {
  const s = ai?._tac;
  if (!s || !tacticsSwitchOn()) return null;
  if (unseen(s, clock())) return { state: 'empty', fill: 0, word: '' };   // AUDIT TELL B1: a state nobody is stepping
  if (s.state === 'staggered') return { state: 'staggered', fill: 1, word: 'Staggered' };
  if (s.state === 'overreach') return { state: 'open', fill: 0, word: 'Open' };
  const b = s.state === 'windup' ? s.blow : null;   // AUDIT TELL: a charge's run is its landing - its poise is spent (a blow on it is DFU's)
  if (!b) return { state: 'empty', fill: 0, word: '' };
  if (b.guard === 'iron') return { state: 'iron', fill: 1, word: 'Iron' };
  return { state: 'windup', fill: b.poise > 0 ? Math.min(1, (b.taken ?? 0) / b.poise) : 0, word: '' };
}
/** TELL1: is this entity staggered now (on the brain's clock)? */
export const staggeredNow = (ent, now = clock()) => Number.isFinite(ent?.staggerUntil) && now < ent.staggerUntil;
// TELL1: a staggered foe takes a quarter more from every blow - the formulas' tail and a spell's landing read this
registerBlowTakenMod('tell-stagger', (attacker, target) => (staggeredNow(target) ? TELL.STAGGER_TAKEN : 1));

// ── TELL4: THE PUNISH WINDOW (bible/12-Enhanced-AI/Feud-Arc.md section 6) ──────────────────────────────────────────
/** Is this foe OVERREACHED now - its telegraphed blow landed on no feet, and it stands spent, open to an answer? */
export function overreachOpen(ai) {
  const s = ai?._tac;
  return !!s && s.state === 'overreach' && clock() < s.until && tacticsSwitchOn();
}
/** TELL4: is this entity overreached now (on the brain's clock)? */
export const overreachedNow = (ent, now = clock()) => Number.isFinite(ent?.overreachUntil) && now < ent.overreachUntil;
// TELL4: an overreached foe takes 30% more from every blow - the same registry the stagger's quarter rides
registerBlowTakenMod('tell-overreach', (attacker, target) => (overreachedNow(target) ? TELL.PUNISH_TAKEN : 1));
/** TELL4: its blow missed me (`perfect`: my feet were inside it TELL_LATE before the landing) - OVERREACHED for
 *  `punishSeconds`: locked as a stagger locks (the motor's CanAct), its swing's follow-through standing (the sprite's
 *  `'spent'`), every blow it takes x`PUNISH_TAKEN`, the first that lands staggering it. It keeps its melee token. */
function beginOverreach(ai, s, b, now, perfect, atMe = true) {
  s.state = 'overreach'; s.until = now + punishSeconds(b.kind, b.guard, perfect);
  ai.overreachUntil = s.until;
  const ent = ai.vitals?.();
  if (ent) ent.overreachUntil = s.until;
  ai._blowHold = 'spent';   // the strike goes out; then its follow-through stands (characters/mobileUnit.js)
  if (perfect && atMe) ai._perfectAt = now;   // the tag's and the bright ring's (scenes/hostCombat.js tellCues) - mine alone (AUDIT TELL O5)
  if (atMe && ent) { noteFeud(ent, 'dodged'); if (perfect) noteFeud(ent, 'perfect'); }   // RVN1 (Feud-Arc.md 12): my dodge - a peer's is its own fight
  ai._tacStrike = false; ai._tacShoot = false; ai.moving = false;
}
/** TELL4: the window shut - by its time, a stagger, or its place gone. The swing goes with it: let go after its strike,
 *  dropped before one (a stagger in the frame step between the landing and the strike - no strike, and never the list's
 *  later one under the stagger's Hurt). */
function endOverreach(ai) {
  ai.overreachUntil = 0;
  const ent = ai.vitals?.();
  if (ent) ent.overreachUntil = 0;
  if (ai._blowHold === 'spent') dropSwing(ai);
}
/** TELL4: a blow landed on an overreached foe - it staggers (3.2's law: its weight's length, its token handed on), unless
 *  inside STAGGER_IMMUNE of its last stagger, where the blow is a plain one (null: DFU's knockback). */
function punishStruck(ai, ent, weight) {
  const s = ai._tac, now = clock();
  if (now < (s.staggerReady ?? -Infinity)) return null;
  endOverreach(ai);
  handOn(ai, s, now);
  ai._tacStrike = false; ai._tacShoot = false; ai.moving = false;
  return stagger(ai, s, ent, weight, now);
}
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
  if (!tacticsSwitchOn()) { if (ai._tac) releaseTactics(ai); ai._tac = null; ai._tacStrike = undefined; ai._tacShoot = undefined; ai._aimReady = false; ai._wantAimed = false; ai._blowShot = null; return false; }   // AUDIT TELL B4: DFU's bow roll whole again
  const now = clock();
  if (ai._tac?.puppet) {   // TELL8: a puppet's synthetic state (ai/puppetBlows.js) is no brain's - a foe handed to me thinks afresh
    setLiveBlow(ai, null); ai._tac = null;
    // AUDIT TELL B5: and its owner's words with it - the held swing (every later swing would stand at its raised arm), the
    // landing's verdict and effect, and the stagger or overreach its owner said stood (x1.25, x1.3 for good)
    clearBlowState(ai); ai._blowHold = false; ai._blowWind = false; ai._blowFx = null; ai._perfectAt = null; ai._blowLandedAt = null;
    const pe = ai.vitals?.();
    if (pe) { if (pe.staggerUntil === PUPPET_HELD_UNTIL) pe.staggerUntil = 0; if (pe.overreachUntil === PUPPET_HELD_UNTIL) pe.overreachUntil = 0; }
  }
  const s = ai._tac ?? (ai._tac = { key: null, kind: 'melee', state: 'wait', until: 0, slot: Math.random() * Math.PI * 2, hp: [], fled: false, seen: now, swung: 0, shot: 0, kiting: false, meleeUntil: 0, leased: 0, kiteUntil: 0, kiteReady: 0, backUntil: 0, backoffReady: 0, faceUntil: 0 });
  // AUDIT TACT D1/A3: a step it did not decide - knocked back, paralysed, held - is the MOTOR's word (`_tacSkipped`,
  // set when it could not act), never a gap on any clock: a slow frame is not a knock
  // AUDIT TELL B1: ...and a gap on the foes' own clock past BLOW_STALE is the same word - the brain was not asked (a
  // flight, a pool not stepped, a held window): its wind-up, run or chain breaks rather than land untold
  const skipped = !!ai._tacSkipped || unseen(s, now);
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
  ai._aimReady = false;   // TELL6d: asked afresh each turn (the ranged branch)
  if (ai._blowShot && now - ai._blowShot.at > BLOW_VERDICT_LIFE) ai._blowShot = null;   // a shot never loosed goes stale, as a verdict does
  // TELL1: staggered - the motor holds it (it cannot act, so the brain is rarely asked); spent, the beat after a blow
  if (s.state === 'staggered') {
    if (now < s.until) { ai._tacStrike = false; ai._tacShoot = false; ai.moving = false; return true; }
    s.state = 'recover'; s.until = now + TACT.RECOVER_MIN + Math.random() * (TACT.RECOVER_MAX - TACT.RECOVER_MIN);
    s.backUntil = now + TACT.RECOVER_HOP;
  }
  // TELL4: overreached - locked as a stagger is; spent, the beat after a blow, its token handed on (TACT2's RECOVER)
  if (s.state === 'overreach') {
    if (now < s.until) { ai._tacStrike = false; ai._tacShoot = false; ai.moving = false; return true; }
    endOverreach(ai);
    s.state = 'recover'; s.until = now + TACT.RECOVER_MIN + Math.random() * (TACT.RECOVER_MAX - TACT.RECOVER_MIN);
    s.backUntil = now + TACT.RECOVER_HOP;
    handOn(ai, s, now);
  }
  // TELL5 (7.4): a chain - its landing's strike drawn, the next blow winds up from the new facing (it keeps its token)
  if (s.state === 'chain') {
    // AUDIT TELL B9: and the first blow's verdict spent first - a speed-drained sprite steps slower than the gap, and the
    // chain's held swing would re-hold the first blow's strike (CHAIN_SPEND_MAX the cap: a verdict nothing spends)
    if (now < s.chainAt || (ai._blowVerdict != null && now < s.chainAt + CHAIN_SPEND_MAX)) { ai._tacStrike = false; ai._tacShoot = false; ai.moving = false; return true; }
    const ck = targetKey(ai), ent = ai.vitals?.(), tf = ck === s.chainKey ? targetFeet(ai, ck) : null;   // TELL8: at me, or at the peer it hunts; AUDIT TELL B8: the same one
    if (ent && tf && ai.canAct !== false && !skipped) beginWindup(ai, s, ent, s.chainShape, tf[0] - ai.feet[0], tf[2] - ai.feet[2], now, s.chainN);
    else { s.state = 'engage'; clearBlowState(ai); }   // knocked, paralysed or turned away in the gap: the chain is spent
  }
  // TELL6 (8.1): a charge running its lane - committed; the verdict swept between its turns
  if (s.state === 'dash') return dashTurn(ai, s, now, skipped);
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
    // TELL6d (8.1): an archer of the whole set aims one shot in three - the attack component asks as its shot comes
    // (`_wantAimed`), and the brain winds it up instead: its line on the ground, locked; its landing looses it
    const ent = ai.vitals?.();
    // RVN5 (16.1): a caster's signature, the pyre - with its token, as its shot or its spell would go: the casters' first tell
    const sig = ent?.revenant?.sigBlow;
    if (has && sig?.kind === 'pyre' && _me && ai.canAct !== false && now >= (s.blowReady ?? 0) && now >= (s.sigReady ?? 0) && !windupNear(_me.feet, now, ai) && signatureReaches(ai, ent, 'pyre', dist, false, 0, 0) && Math.random() < BLOW_CHANCE) {
      beginWindup(ai, s, ent, 'pyre', _me.feet[0] - ai.feet[0], _me.feet[2] - ai.feet[2], now, 0, sig);
      return windupTurn(ai, s, now, skipped);
    }
    ai._aimReady = has && key === LOCAL && !!_me && ai.canAct !== false && now >= (s.blowReady ?? 0) && aimsShots(ai, ent) && !windupNear(_me.feet, now, ai);
    if (ai._wantAimed) {
      ai._wantAimed = false;
      if (ai._aimReady) { beginWindup(ai, s, ent, 'aimed', dx, dz, now); return windupTurn(ai, s, now, skipped); }
    }
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
  // TELL6: in reach, a blow of reach; out of it, a gap-closer whose lane is free (the charge, 5-12 m)
  // TELL8 (10.2): at a peer it hunts as at me - one wind-up near each target, the peer's own feet its judge; AUDIT
  // ARENA-LADDER: on the sand at a bout-mate (targetFeet)
  const tf = s.state === 'engage' ? targetFeet(ai, key) : null;
  if (s.state === 'engage' && b.melee.has(ai) && tf && ai.canAct !== false && now >= (s.blowReady ?? 0)) {   // AUDIT TACT: a token holder's, never an opportunist's
    const ent = ai.vitals?.();
    // AUDIT TELL B7: aimed at its TARGET's feet - the motor's (dx, dz) is its destination, a detour's point or a search's
    const tdx = tf[0] - ai.feet[0], tdz = tf[2] - ai.feet[2];
    const near = dist <= reach + 0.5;
    // RVN5 (bible/12-Enhanced-AI/Feud-Arc.md 16.1): ITS SIGNATURE - a revenant's own blow, ahead of any other whenever its
    // own cooldown is spent and its shape reaches (its stand's `revenant.sigBlow`)
    const sig = ent?.revenant?.sigBlow;
    if (sig && now >= (s.sigReady ?? 0) && !windupNear(tf, now, ai) && signatureReaches(ai, ent, sig.kind, dist, near, tdx, tdz) && Math.random() < BLOW_CHANCE) {
      beginWindup(ai, s, ent, sig.kind, tdx, tdz, now, 0, sig);
      return windupTurn(ai, s, now, skipped);
    }
    const shapes = blowPool(ai, ent, dist, near, tdx, tdz);
    // RVN2: an Arrow-wise revenant out of reach closes with its charge or its leap whenever its lane is free (no roll)
    if (shapes.length && !windupNear(tf, now, ai) && ((!near && ent?.revenant?.edge?.closes === true) || Math.random() < BLOW_CHANCE)) {
      beginWindup(ai, s, ent, shapes[Math.floor(Math.random() * shapes.length)], tdx, tdz, now);
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

/** TACT4: a telegraphed blow wound up - `shape` aimed along (dx, dz). TELL3: its guard; TELL5: its drawn length (a
 *  chain's quick and undrawn), a feint one wind-up in FEINT_CHANCE for a blade of the higher tier (never two within
 *  FEINT_GAP; never a chain's). `chain` its place in a chain (0 the first). */
function beginWindup(ai, s, ent, shape, dx, dz, now, chain = 0, sig = null) {
  const guard = sig?.iron ? 'iron' : blowGuard(shape, ENEMY_BASICS[ent.mobileType]?.weight ?? 0, ent);   // TELL3: iron or poise (the kind's own weight - no class throws an iron shape); RVN5: a signature iron from rank 3
  const windup = chain > 0
    ? windupSeconds(TELL.CHAIN_WINDUP, ent, { guard, roll: null, floor: TELL.CHAIN_FLOOR })
    : windupSeconds(BLOW[shape].windup, ent, { guard });
  const b = fitBlowToGround(makeBlow(shape, ai.feet, Math.atan2(dx, dz), now, sig ? sig.color : guard === 'iron' ? IRON_COLOR : BLOW_COLOR, guard, windup), ai.collider);   // AUDIT TACT D8: on the ground it marks; RVN5: a signature in its ember
  b.chain = chain; b.trackedAt = now;
  b.n = ai._blowN = ((ai._blowN ?? 0) + 1) & 255;   // AUDIT TELL O2: its serial on the wire (ai/puppetBlows.js `wn`)
  b.key = targetKey(ai);   // AUDIT TELL B8: whom it is aimed at - a foe that turns on another breaks it (the owner and the struck peer agree)
  if (b.key !== LOCAL && !ai.target?.isPeer) b.sand = true;   // AUDIT ARENA-LADDER: one at a bout-mate (no other mark is begun at) is drawn for the stands (foeBlows.js SAND_DRAW_RANGE)
  if (shape === 'leap') { b.ahead = Math.min(BLOW.leap.range, Math.hypot(dx, dz)); b.jumpAt = b.land - BLOW.leap.arc; fitBlowToGround(b, ai.collider); }   // TELL6c: its point - my feet now, locked
  if (shape === 'aimed') b.ahead = Math.hypot(dx, dz);   // TELL6d: its line to me, locked
  if (shape === 'pyre') b.ahead = Math.min(BLOW.pyre.range, Math.hypot(dx, dz));   // RVN5: its disc at my feet, locked
  if (sig) {   // RVN5: its signature - x2.0, its own cooldown, a deeper WIND, called out (the pools say it once a stand)
    b.sig = true; b.mult = sig.mult; b.windPitch = sig.windPitch;
    const [lo, hi] = sig.cooldown;
    s.sigReady = now + lo + (hi - lo) * Math.random();
    ai._sigCall = now;
  }
  const n = (s.windups ?? 0) + 1;
  s.windups = n;
  if (chain === 0 && !sig && shape !== 'aimed' && shape !== 'pyre' && !GAP_CLOSERS.includes(shape) && feints(blowFamily(ent.mobileType), ent, n - (s.lastFeint ?? -Infinity)) && Math.random() < feintChance(ent)) {   // RVN2: a Patient one's one in three
    b.feint = true; b.cutAt = b.start + TELL.FEINT_AT * (b.land - b.start); s.lastFeint = n;
  }
  s.blow = b;
  setLiveBlow(ai, b);
  s.state = 'windup';
  const swings = shape !== 'aimed' && shape !== 'pyre';   // TELL6d: a shot draws no held swing - its landing looses it (ai._blowShot); RVN5: nor a pyre - its landing is a spell
  ai._blowHold = swings; ai._blowWind = swings;   // TELL2: the swing begins now and stands at its raised arm until the landing
}
/** RVN4 (bible/12-Enhanced-AI/Feud-Arc.md 15.2): ITS LAST STAND'S ROAR - an iron ring about its feet wound up for
 *  `seconds` and landing as the roar ends (TELL6a's shape; TELL6e's rattle and, iron, its knockdown), whatever its kind's shapes. Its
 *  wind-up before is dropped. The switch off, a puppet, or no brain yet: nothing (the pool holds the motor - the roar
 *  alone). Answers whether it was wound. */
export function beginRoar(ai, ent, seconds, now = clock()) {
  const s = ai?._tac;
  if (!s || s.puppet || !ent || !tacticsSwitchOn()) return false;
  if (s.blow) { setLiveBlow(ai, null); s.blow = null; }
  s.dash = null;
  const b = fitBlowToGround(makeBlow('ring', ai.feet, ai.yaw, now, IRON_COLOR, 'iron', seconds), ai.collider);
  b.chain = 0; b.trackedAt = now; b.roar = true;
  b.n = ai._blowN = ((ai._blowN ?? 0) + 1) & 255;   // its serial on the wire, as any wind-up's
  b.key = targetKey(ai);
  s.blow = b;
  setLiveBlow(ai, b);
  s.state = 'windup';
  ai._blowHold = true; ai._blowWind = true;
  return true;
}
/** TACT4: the wind-up's turn - broken by a knock or a paralysis (a step the motor did not let the brain decide), else
 *  stood, its aim locked, until the landing: where my feet stand decides it, and the swing comes now. */
function windupTurn(ai, s, now, skipped) {
  const cooled = now + blowCooldown(ai.vitals?.());   // TELL7: by its tier
  if (skipped || ai.canAct === false || ai.hurtKnock || ai.knockbackSpeed > 0) {
    setLiveBlow(ai, null); s.blow = null; s.state = 'engage'; s.blowReady = cooled;
    clearBlowState(ai);
    dropSwing(ai);
    return false;
  }
  const key = targetKey(ai);
  const b0 = s.blow;
  // AUDIT TELL B8: a foe turned on another than the one its blow is aimed at breaks it - its mark goes, nobody is judged
  // (the owner's landing at its new target and the struck peer's at its old one judged two players by one blow)
  if (b0.key !== undefined && key !== b0.key) { breakWindup(ai); return false; }
  const atMe = !!_me && key === LOCAL;
  const tf = targetFeet(ai, key);   // TELL8: my feet, or the peer's it is aimed at (the owner's view - 6.3)
  // TELL5 (7.3): a feint - cut at FEINT_AT, and a plain DFU blow at once: DFU's damage and reach, no verdict, no weight
  if (b0.feint && now >= b0.cutAt) {
    b0.cut = now;   // its mark fades out dashed (ai/foeBlows.js blowPhase)
    s.blow = null; s.state = 'engage'; s.blowReady = cooled;
    clearBlowState(ai);
    ai._blowSwing = true; ai._blowAt = now; ai._blowHold = false;   // the held swing goes - the attack component releases it
    ai._tacStrike = true;
    return false;
  }
  // TELL5 (7.2): a lunge (and TELL6's charge) turns after my feet through the first TRACK_SHARE of its wind-up, then locks
  if (tf && TELL.TRACKERS.includes(b0.kind) && now < b0.start + trackShare(ai.vitals?.()) * (b0.land - b0.start)) {   // RVN2: a Patient one tracks longer
    const y = trackYaw(b0.yaw, Math.atan2(tf[0] - b0.origin[0], tf[2] - b0.origin[2]), now - (b0.trackedAt ?? b0.start));
    b0.trackedAt = now;
    if (y !== b0.yaw) { b0.yaw = y; ai.yaw = y; fitBlowToGround(b0, ai.collider); }   // the foe turns with its mark
  }
  // TELL4 (6.2): my feet, sampled once - the first turn inside TELL_LATE of the landing
  if (tf && s.blow.lateIn == null && now >= s.blow.land - TELL.TELL_LATE && now < s.blow.land) s.blow.lateIn = inBlow(s.blow, tf[0], tf[2]);
  if (b0.kind === 'leap' && now >= b0.jumpAt && now < b0.land) return leapStep(ai, b0);   // TELL6c: the jump
  if (now >= s.blow.land && b0.kind === 'aimed') {   // TELL6d: loosed along its line - the arrow's flight decides; no verdict, no window
    ai._blowLandedAt = now; s.landed = { blow: b0, at: now };   // AUDIT TELL O2: its landing, for the wire
    if (atMe) ai._blowShot = { yaw: b0.yaw, at: now, fired: false };   // the attack component draws, the sprite looses
    s.blowReady = cooled; s.state = 'wait'; s.blow = null;
    return false;
  }
  if (now >= s.blow.land && b0.kind === 'pyre') {   // RVN5: its blast - a spell at my feet (the pool casts it), never a swing
    ai._blowLandedAt = now; s.landed = { blow: b0, at: now };
    const hit = !!tf && inBlow(b0, tf[0], tf[2]);
    s.blow = null; s.blowReady = cooled;
    if (atMe && hit) ai._blowPyre = { at: now, mult: b0.mult };
    if (tf && !hit) { beginOverreach(ai, s, b0, now, b0.lateIn === true, atMe); return true; }   // TELL4: missed - it stands spent
    s.state = 'wait';   // the aimed shot's law: its landing was its blow - no swing, no spell on top
    return false;
  }
  if (now >= s.blow.land) {
    if (b0.kind === 'leap') { ai._tacDir = null; ai.moving = false; }   // TELL6c: landed at its point
    // AUDIT TACT A4/D6: only ever at its target - a wind-up whose foe has turned on another lands on no one here.
    // TELL8: at a peer as at me - the owner's view of the peer's feet decides its window; the peer's own, the blow.
    // AUDIT ARENA-LADDER: at a bout-mate on the sand as at me - both fighters run here, so the verdict is the blow's
    if (tf && s.blow.kind === 'charge') { beginDash(ai, s, s.blow, now, cooled); return true; }   // TELL6: its landing is its run
    ai._blowLandedAt = now;   // TELL2: the landing, for the LAND cue (scenes/hostCombat.js tellCues)
    // AUDIT TELL B3: a leap lands on its disc only where its foe got to - a ledge or a wall that stopped the jump whiffs
    const arrived = b0.kind !== 'leap' || Math.hypot(ai.feet[0] - (b0.origin[0] + Math.sin(b0.yaw) * b0.ahead), ai.feet[2] - (b0.origin[2] + Math.cos(b0.yaw) * b0.ahead)) <= BLOW.leap.r;
    if (tf) return resolveLanding(ai, s, s.blow, arrived && inBlow(s.blow, tf[0], tf[2]), now, cooled, atMe, judgedHere(ai, key));
    clearBlowState(ai); dropSwing(ai);
    s.blowReady = cooled; s.state = 'engage'; s.blow = null;
    ai._tacStrike = true;
    return false;
  }
  ai._tacStrike = false; ai._tacShoot = false; ai.moving = false;   // AUDIT TACT A4: no shot, no spell, mid-wind-up
  return true;
}

/** TACT4: a landing at me decided - `verdict` (my feet in its shape; TELL6: a charge's run over them). The swing is
 *  released; TELL5 a chain may follow, hit or miss; TELL4 a miss overreaches. TELL8 (6.3, 10.3): at a peer (`judged`
 *  false) the verdict is the owner's view of the peer's feet - it opens or withholds the window and the chain, never the
 *  damage (the struck peer's own judgement, through its puppet): no verdict, weight or effect is left to land here.
 *  AUDIT ARENA-LADDER: at a bout-mate on the sand (`judged`, `atMe` false) the verdict and its weight land as mine do,
 *  on that one alone (`_blowFor`); what a landing does to ME (TELL6e) is mine alone. */
function resolveLanding(ai, s, b, verdict, now, cooled, atMe = true, judged = atMe) {
  ai._blowLandedAt = now;
  s.landed = { blow: b, at: now };   // AUDIT TELL O2: its landing, said to the peers for WIRE_LANDED_S (ai/puppetBlows.js)
  ai._blowVerdict = judged ? verdict : null;
  ai._blowMult = judged ? b.mult : undefined; ai._blowAt = now; ai._blowSwing = true;
  ai._blowFor = judged ? (b.key ?? targetKey(ai)) : undefined;   // AUDIT ARENA-LADDER 2: whose verdict it is
  ai._blowFx = atMe && verdict ? { kind: b.kind, iron: b.guard === 'iron', at: now } : null;   // TELL6e: what it does where its damage lands (scenes/hostCombat.js landBlowEffect)
  ai._blowHold = false;   // TELL2: the held swing strikes on its next frame
  s.blowReady = cooled; s.blow = null;
  // TELL5 (7.4): a chain - hit or miss, a second blow at once; the punish window waits for its last. TELL6: never after a
  // charge - its foe ends its lane past its target
  const ent = ai.vitals?.();
  const shapes = ent ? blowShapesOf(ent.mobileType, ent).filter((k) => !GAP_CLOSERS.includes(k)) : [];
  if (!GAP_CLOSERS.includes(b.kind) && (b.chain ?? 0) < chainMax(ent) && chains(blowFamily(ent?.mobileType), ent, shapes) && Math.random() < TELL.CHAIN_CHANCE) {   // RVN4: phase two chains to three
    const next = chainShape(b.kind, shapes);
    if (next) {
      s.state = 'chain'; s.chainAt = now + TELL.CHAIN_GAP; s.chainShape = next; s.chainN = (b.chain ?? 0) + 1; s.chainKey = b.key ?? targetKey(ai);   // AUDIT TELL B8: at the same target
      b.chainUntil = s.chainAt + 0.2;   // still its foe's one wind-up near me through the gap (foeBlows.windupNear)
      ai._tacStrike = false; ai._tacShoot = false; ai.moving = false;
      return true;
    }
  }
  // TELL4 (6.1): it missed - OVERREACHED; inside at the late sample and out at the landing, a perfect dodge. AUDIT FEUD 2:
  // OUT, judged here - a leap a ledge stopped short, a charge a wall stopped, misses a target that never left its shape:
  // no dodge of its, and (FEUD BALANCE) no will broken by it
  if (!verdict) { const tfo = targetFeet(ai, b.key !== undefined ? b.key : targetKey(ai)); beginOverreach(ai, s, b, now, b.lateIn === true && !(tfo && inBlow(b, tfo[0], tfo[2])), atMe); return true; }   // AUDIT TELL O5: a peer's perfect dodge is the peer's to see
  s.state = 'engage';
  ai._tacStrike = true;
  return false;
}

// ── TELL6: THE GAP-CLOSERS (bible/12-Enhanced-AI/Feud-Arc.md section 8.1) ────────────────────────────────────────────
/** TELL6: the shapes this foe may wind up from here - `near` (in reach) its blows of reach; out of reach the
 *  gap-closers whose lanes are free. TELL7: from its whole set. */
export function blowPool(ai, ent, dist, near, dx, dz) {
  const all = throwsBlows(ent) ? blowShapesOf(ent.mobileType, ent) : [];
  return near ? all.filter((k) => !GAP_CLOSERS.includes(k)) : all.filter((k) => gapCloses(ai, k, dist, dx, dz, ent));
}
/** TELL6d: does this foe aim its shots - a class archer (a bow) of the whole set (section 9: an ordinary archer of the
 *  tier keeps DFU's plain shot, as TACT4 left it)? */
export function aimsShots(ai, ent) {
  return !!ent && wholeSet(ent) && !!ai?.hasBowAttack && ent.mobileType >= 128;
}
// TELL6d: an aimed shot that strikes weighs x BLOW.aimed.mult - the arrow says so at contact (formulas' blowInfo)
registerBlowTakenMod('tell-aimed', (attacker, target, weapon, info) => (info?.aimed ? BLOW.aimed.mult : 1));
/** The shapes begun out of reach. */
export const GAP_CLOSERS = Object.freeze(['charge', 'leap']);
/** RVN5 (16.1): does its signature's shape reach its target now - a gap-closer out of reach with its lane free, the pyre
 *  in its range and in sight at me (its blast is cast at the local player alone), any other in reach? */
export function signatureReaches(ai, ent, kind, dist, near, dx, dz) {
  if (GAP_CLOSERS.includes(kind)) return !near && gapCloses(ai, kind, dist, dx, dz, ent);
  if (kind === 'pyre') return dist <= BLOW.pyre.range && !!ai.inSight && targetKey(ai) === LOCAL;   // its blast is mine alone: a peer's or a foe's is RVN13's (off the wire)
  return near;
}
/** May `kind` be begun from `dist` out along (dx, dz)? The charge: 5-12 m, its lane free of the collider and of cover
 *  (ai/cover.js) to the target and a metre past. TELL6c the leap: 3-9 m, a clear line to the target, ground under its
 *  point, never a flyer. A shape of reach: never out of it. */
export function gapCloses(ai, kind, dist, dx, dz, ent = null) {
  if (kind !== 'charge' && kind !== 'leap') return false;
  const P = BLOW[kind];
  if (!(dist >= P.from && dist <= (kind === 'charge' ? P.to : P.range))) return false;
  if (kind === 'leap' && ENEMY_BASICS[ent?.mobileType]?.behaviour === 'Flying') return false;
  const l = Math.hypot(dx, dz) || 1, dir = [dx / l, 0, dz / l];
  const from = [ai.feet[0], ai.feet[1] + 0.9, ai.feet[2]], len = kind === 'charge' ? Math.min(P.len, dist + 1) : dist;
  const wall = ai.collider?.raycast?.(from, dir, len);
  if (Number.isFinite(wall) && wall < len) return false;
  if (coverDistance(ai.collider, from, dir, len) < len) return false;
  if (kind === 'leap' && ai.collider) {   // ground under its point - the terrain too, outdoors (Collider.surfaceHit)
    const o = [ai.feet[0] + dx, ai.feet[1] + 2.5, ai.feet[2] + dz];
    const g = ai.collider.surfaceHit ? ai.collider.surfaceHit(o, DOWN, 5)?.dist : ai.collider.raycast?.(o, DOWN, 5);
    if (!Number.isFinite(g)) return false;
  }
  return true;
}
const DOWN = Object.freeze([0, -1, 0]);
/** AUDIT TELL B9: how long a chain waits past its gap for the first blow's verdict to be spent (s). */
const CHAIN_SPEND_MAX = 0.6;
/** TELL6c: the leap's jump - its last BLOW.leap.arc seconds, from where it crouched to its point, a hop on the motor's
 *  own gravity; the verdict at its landing, at the point. */
function leapStep(ai, b) {
  const tx = b.origin[0] + Math.sin(b.yaw) * b.ahead, tz = b.origin[2] + Math.cos(b.yaw) * b.ahead;
  const dx = tx - ai.feet[0], dz = tz - ai.feet[2], d = Math.hypot(dx, dz), left = Math.max(1 / 16, b.land - clock());
  if (!b.jumping) { b.jumping = true; ai.velY = (GRAVITY * BLOW.leap.arc) / 2; }   // up, and down again at its landing
  if (d < 0.05) { ai._tacDir = null; ai.moving = false; return true; }
  ai._tacDir = [dx / d, dz / d];
  ai._tacSpeed = Math.min(d / left, 40) / Math.max(0.1, ai.speed ?? 1);
  ai.moving = true; ai._tacStrike = false; ai._tacShoot = false;
  return true;
}
/** TELL6: the charge's landing - its foe runs its lane, `cross` seconds end to end, along the collider (a wall ends it
 *  in a skid); the verdict is swept between its turns (the world boss's chargeStrikes law), once. Its held swing stands
 *  until the verdict. */
function beginDash(ai, s, b, now, cooled) {
  s.state = 'dash';
  s.landed = { blow: b, at: now };   // AUDIT TELL O2: the run is its landing
  s.dash = { blow: b, until: now + BLOW.charge.cross, head: [ai.feet[0], ai.feet[2]], cooled };
  b.dashUntil = s.dash.until + 0.1;   // its foe's one wind-up near me while it runs (foeBlows.windupNear)
  return dashStep(ai, b);
}
function dashStep(ai, b) {
  ai._tacDir = [Math.sin(b.yaw), Math.cos(b.yaw)];
  ai._tacSpeed = (BLOW.charge.len / BLOW.charge.cross) / Math.max(0.1, ai.speed ?? 1);
  ai.moving = true; ai._tacStrike = false; ai._tacShoot = false;
  return true;
}
/** The charge's turn: my feet within its half-width of the stretch it ran since the last - a hit, and it stops; its time
 *  out, or a wall - a miss. */
function dashTurn(ai, s, now, skipped = false) {
  const d = s.dash, b = d?.blow;
  if (!b) { s.state = 'engage'; return false; }
  // AUDIT TELL B2/B8: a run the motor did not let it decide (a paralysis, a knock), or one whose foe turned on another,
  // ends with no verdict - never judged where it froze
  if (skipped || ai.canAct === false || ai.hurtKnock || ai.knockbackSpeed > 0 || (b.key !== undefined && targetKey(ai) !== b.key)) { breakWindup(ai); return false; }
  const h = [ai.feet[0], ai.feet[2]];
  const key = targetKey(ai), tf = targetFeet(ai, key);   // TELL8: my feet, or the peer's it runs at (the owner's view)
  const hit = !!tf && segDist(tf[0], tf[2], d.head[0], d.head[1], h[0], h[1]) <= BLOW.charge.halfW;
  d.head = h;
  if (hit || now >= d.until || ai._tacBlocked) {
    ai._tacBlocked = false; ai._tacDir = null; ai.moving = false; s.dash = null;
    if (!tf) { clearBlowState(ai); dropSwing(ai); s.blowReady = d.cooled; s.state = 'engage'; ai._blowLandedAt = now; return false; }
    return resolveLanding(ai, s, b, hit, now, d.cooled, !!_me && key === LOCAL, judgedHere(ai, key));
  }
  return dashStep(ai, b);
}
/** The distance from (px, pz) to the segment a-b. */
function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2)) : 0;
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
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
