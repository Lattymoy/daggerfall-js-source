// @ts-check
// TWO-HANDS (2026-10-16, Mac: "Duel wielding and bare hand improvements" - "When bare handed, the fist should be
// mirrored on the other side of the screen (like 2 hands). Attacking should utilize both hands in a detailed way",
// "When bare handed, or with nothing equipped, sprinting should show the hands in a running motion", "Weapons should
// now be able to be duel wielded instead of using a hand swap. With 2 weapons equipped, both weapons can be seen and
// animated in view", "With duel wielding, we need to balance this to not be overpowered and make sense"). THE LAW OF THE
// TWO HANDS. Design and record: bible/05-Combat/Two-Hands.md.
//
// DFU is the reference and has none of this: WeaponManager fights with ONE hand at a time - `usingRightHand`, flipped by
// ToggleHand (WeaponManager.cs:702-729) - and FPSWeapon draws one sprite, mirrored only for a left-handed player
// (FlipHorizontal, FPSWeapon.cs:378). What this module departs from, and why, is Port-Ledger section A (TWO-HANDS).
//
// Pure: no renderer, no clock but the `dt` and the times it is handed, no read of the settings or the equip table - the
// callers hand it each hand's item already described (`{ item, type, hands, shield }`: the item, DFU's WeaponTypes for
// it, its ItemHands, whether it is a shield). Both lanes read it - the sprite's (combat/twoHands/twoHands.js) and the Morrowind
// arms' (combat/fpArm.js) - and the swing's (combat/playerWeapon.js), so one law says which hand strikes and what it
// costs, whichever picture is on the screen.

import { swingHeft, SWING_FRAME_MAX } from '../../characters/weaponStates.js';   // SWING-LAW's heft, the one home for a weapon's weight against a Strength, and its slowest frame

/** How the two hands are held. `single` is DFU's: one hand fights (the used hand, H switches it) and the other holds a
 *  shield, a bow's other end, nothing, or a weapon waiting for H. `fists` is both hands empty - both fists up. `dual` is
 *  two one-handed weapons, one in each hand - both up, both swinging. */
export const HANDS_MODE = Object.freeze({ Single: 'single', Fists: 'fists', Dual: 'dual' });

/** DFU's WeaponTypes (combat/fpsWeapon.js WEAPON_TYPES - pinned equal; this module is a leaf) a dual pair may hold: the
 *  one-handed melee kinds. Blades, daggers, maces, flails, hammers and axes, plain and magic - whatever of them takes one
 *  hand (`hands`, below, decides that: a flail or a warhammer is two-handed in DFU's table, a custom class may not be).
 *  Never a staff's (two-handed always), a bow's, the bare hand's, a beast's claws or the port's own gun. */
export const DUAL_TYPES = Object.freeze([0, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
/** PISTOLET (2026-10-21, the owner: "a dwarven flintlock style pistol" that "can also be duel wielded"): the one gun a
 *  pair may hold - the Dwarven Pistolet, plain and enchanted (WEAPON_TYPES Pistolet 19, Pistolet_Magic 20 - pinned equal).
 *  A pair is two of a KIND: two melee weapons, or two Pistolets - never one of each. A sword's strike and a pistol's shot
 *  are two machines' worth of difference (a swing and its frames against a trigger, a reload and a shot through the
 *  ranged lane), and the sprite lane draws them through two doors (the Weapon Widget's clone, the gun's frame). The mixed
 *  pair is a later slice's, named in bible/05-Combat/Dwarven-Pistolet.md. The Thunderlock is two-handed and never here. */
export const DUAL_GUN_TYPES = Object.freeze([19, 20]);
/** ItemHands.Both (characters/equipTable.js ITEM_HANDS - pinned equal). */
const HANDS_BOTH = 4;

/**
 * @typedef {{ item?: any, type?: number, hands?: number, shield?: boolean } | null | undefined} HandDesc
 *   One hand's item as the law reads it: the item (null for an empty hand), its WeaponTypes, its ItemHands, a shield.
 */

/** Can this hand's item be one of a dual pair: a weapon, not a shield, one-handed, of a dual kind (melee, or the gun). */
export function dualEligible(/** @type {HandDesc} */ h) {
  const t = /** @type {number} */ (h?.type);
  return !!h?.item && !h.shield && h.hands !== HANDS_BOTH && (DUAL_TYPES.includes(t) || DUAL_GUN_TYPES.includes(t));
}
/** PISTOLET: is this hand a gun of a pair. */
const dualGun = (/** @type {HandDesc} */ h) => DUAL_GUN_TYPES.includes(/** @type {number} */ (h?.type));

/**
 * The way the hands are held. A transformed lycanthrope (`claws`) is the beast's - DFU's racial override, one claw
 * sprite (ApplyWeapon's first arm) - and stays single. A light carried in a hand (`leftBusy`: a lit torch or lantern
 * not hung at the waist - Handheld Torches' hand, the Morrowind arm's Shield Bone) takes that hand: one fist beside it,
 * DFU's and the mod's (and a pair never meets one - the mod stows a light when no hand is free). Both hands empty is the
 * fists; a shield is not an empty hand (a fist and a shield, DFU's). Two one-handed weapons are the pair; anything else
 * is DFU's one used hand.
 * @param {{ right?: HandDesc, left?: HandDesc, claws?: boolean, leftBusy?: boolean }} hands
 */
export function handsModeOf({ right = null, left = null, claws = false, leftBusy = false } = {}) {
  if (claws || leftBusy) return HANDS_MODE.Single;
  if (!right?.item && !left?.item) return HANDS_MODE.Fists;
  if (dualEligible(right) && dualEligible(left) && dualGun(right) === dualGun(left)) return HANDS_MODE.Dual;   // PISTOLET: two of a kind
  return HANDS_MODE.Single;
}

/** Both hands up and both swinging - the two modes the second hand is drawn and struck in. */
export const twoHanded = (mode) => mode === HANDS_MODE.Fists || mode === HANDS_MODE.Dual;

/** 'R' or 'L'. */
export const otherHand = (hand) => (hand === 'L' ? 'R' : 'L');

// ---- WHICH HAND STRIKES ---------------------------------------------------------------------------------------------

/** THE FLURRY: a strike begun within this many seconds of the last one ending is the next blow of the same exchange -
 *  the other hand throws it. Past it the hands have settled, and the lead hand opens again. A beat at any Speed: nearly
 *  twice the swing law's longest frame (SWING_FRAME_MAX, 0.4 s), so a slow fighter's held button still alternates - a
 *  strike begins the moment the last one ends while it is held (WeaponSwingMode 2, the default). */
export const FLURRY_WINDOW = 0.75;

/**
 * The strike about to begin: which hand throws it, whether it is a flurry's (the other hand, straight after a blow), and
 * whether it is the OFF hand's - the hand that is not the lead, in a dual pair (the fists keep DFU's numbers: hand-to-hand
 * was always both fists, CalculateHandToHandAttackDamage reads the skill and not a hand).
 *
 * `lead` is the hand H leads with (`usingRightHand` - DFU's used hand, which ToggleHand still flips: in a pair it is the
 * hand that opens an exchange and carries no off-hand cost). `last` and `sinceLast` are the last strike's hand and the
 * seconds since it ended (Infinity before any).
 * @param {{ mode?: string, lead?: string, last?: string | null, sinceLast?: number }} [s]
 * @returns {{ hand: 'R'|'L', flurry: boolean, off: boolean }}
 */
export function strikeHandOf({ mode = HANDS_MODE.Single, lead = 'R', last = null, sinceLast = Infinity } = {}) {
  const lh = lead === 'L' ? 'L' : 'R';
  if (!twoHanded(mode)) return { hand: lh, flurry: false, off: false };
  const flurry = (last === 'R' || last === 'L') && sinceLast <= FLURRY_WINDOW;
  const hand = flurry ? otherHand(last) : lh;
  const dual = mode === HANDS_MODE.Dual;
  return { hand, flurry: dual && flurry, off: dual && hand !== lh };
}

// ---- THE MIRROR -----------------------------------------------------------------------------------------------------

/** A left hand is a right hand in the mirror. The strike a player asks for keeps its way across the screen: the left
 *  hand's sweep to the RIGHT is the right hand's sweep to the left, mirrored (its forehand), and its sweep to the left the
 *  right hand's backhand mirrored. The straight strikes (down, up) are their own mirror. */
const MIRROR_STRIKE = Object.freeze({
  StrikeLeft: 'StrikeRight', StrikeRight: 'StrikeLeft', StrikeDownLeft: 'StrikeDownRight', StrikeDownRight: 'StrikeDownLeft',
});
export const mirrorStrike = (state) => MIRROR_STRIKE[state] ?? state;

/** The source rect read right to left (FPSWeapon's own mirror, FPSWeapon.cs:381-390). */
export const MIRROR_UV = Object.freeze({ u0: 1, v0: 0, u1: 0, v1: 1 });

/** A screen rect `{ x, y, w, h }` mirrored about the middle of a screen `width` wide starting at `x0`. */
export function mirrorRect(r, width, x0 = 0) {
  return { ...r, x: x0 + (x0 + width) - (r.x + r.w) };
}

/** Is a hand drawn on the LEFT of the screen - and so as a right hand in the mirror: the left hand, unless the player is
 *  left-handed. Controls/Handedness mirrors the WHOLE picture (FPSWeapon.FlipHorizontal): a left-handed player's right
 *  hand is on the left of the screen and their left on the right. A hand of a pair is mirrored whole, every state - DFU's
 *  own flip of its one sprite mirrors three (FPSWeapon.cs:378) because a side strike's art crosses the screen, and a
 *  second hand would cross the first. */
export const handOnLeft = (hand, leftHanded) => (hand === 'L') !== !!leftHanded;

/**
 * THE PAINTED ARM. Which arm Daggerfall painted in each record of the bare hand's art, WEAPON10.CIF, as the screen shows
 * it unflipped: 'R' the arm that comes in from the right of the view, 'L' from the left. Classic Daggerfall threw its
 * hand-to-hand with BOTH fists, by direction - its idle (record 0) and its StrikeDownLeft, StrikeRight and StrikeDownRight
 * records paint the right arm (the light glove, the grey sleeve); its StrikeDown, StrikeLeft and StrikeUp records the left
 * (the dark glove, the brown sleeve with the stitched cuff). Read off the shipped file's frames, record by record (bible/
 * 05-Combat/Two-Hands.md, "The painted arm"); WeaponBasics carries nothing of it (every melee strike aligns Center).
 * Every weapon file paints the right arm alone. Indexed by record.
 */
export const MELEE_PAINTED_ARM = Object.freeze(['R', 'L', 'R', 'L', 'R', 'R', 'L']);

/**
 * THE STRIKE'S PICTURE for one hand of the two: which state's record to draw, and whether in the mirror, so the arm on
 * the screen is the hand that throws the blow, on that hand's own side - and goes the way across the screen the strike
 * asked, wherever the art has it. `painted(state)` answers the side the art paints that state's record from ('R'|'L').
 *   1. the state's own record as painted, when it paints this hand's side - DFU's own picture;
 *   2. else the mirror state's record in the mirror, when that paints the other side: its mirror is this hand, this way;
 *   3. else the art has this hand only the other way across: the mirror state's record as painted (it paints this side).
 * A weapon paints the right arm in every record, so a right hand is always 1 and a left hand always 2 (the mirror of the
 * mirrored strike); the bare hand's two arms take all three.
 * @param {'R'|'L'} hand
 * @param {string} state
 * @param {{ leftHanded?: boolean, painted?: (state: string) => string }} [o]
 * @returns {{ state: string, mirror: boolean }}
 */
export function strikePicture(hand, state, { leftHanded = false, painted = () => 'R' } = {}) {
  const side = handOnLeft(hand, leftHanded) ? 'L' : 'R';
  if (painted(state) === side) return { state, mirror: false };
  const ms = mirrorStrike(state);
  return painted(ms) === side ? { state: ms, mirror: false } : { state: ms, mirror: true };
}

// ---- THE BALANCE (dual wielding) ------------------------------------------------------------------------------------

/**
 * TWO WEAPONS ARE TEMPO, NOT TWICE THE DAMAGE. A pair gives up the shield (its armour - GetShieldArmorValue on the parts
 * it covers) and gets the exchange: the other hand is cocked while one strikes, so a flurry's blow is thrown from a raised
 * hand - and the off hand is the weaker and the less sure one. Every number here is a term on DFU's own: the lead hand's
 * blow is DFU's exactly (CalculateAttackDamage, the swing modifiers, the skill tallied by the weapon in that hand), the
 * off hand's blow is DFU's with the off-hand terms, and no tick comes quicker than SWING-LAW's floor (SWING_FRAME_MIN) -
 * a flurry's blow is four of them at the floor (AUDIT 2: "no swing quicker" read as five).
 *
 * THE QUICKNESS IS IN FRAMES, NOT SECONDS (AUDIT): the machine steps a swing's frames one tick at a time and drops each
 * tick's remainder at the frame it lands on (DFU's coroutine - weaponStates.js machineStep), so a factor on the tick's
 * time rounds away to a different answer at every frame rate. A flurry's blow instead STARTS FLURRY_FROM_FRAME frames
 * into its swing - four ticks of five, the hit a tick sooner - which is 0.8 of one weapon's time at ANY frame rate; and
 * (AUDIT 2) the off weapon's burden is whole ticks held at its blows' end (offHandHold), never a factor on the tick.
 *
 * Measured through the machine and the formula, not on paper (bible/05-Combat/Two-Hands.md "The balance"): a held button
 * swings 1.25 times as often as one light weapon; a matched pair lands about 9% more damage a second than one of its
 * weapons when they are light and about 4% when heavy (a longsword pair: the off arm's burden), at any frame rate and
 * Speed, for a quarter more fatigue a second (DFU's per-swing cost) and the shield. A lighter off weapon trades its
 * damage for quickness. And (AUDIT 2) the off hand's blow is OFF_DAMAGE of a blow in all it counts (OFF_HAND_BLOW).
 */
export const DUAL = Object.freeze({
  /** A flurry's blow starts this many frames into its swing - the hand already raised (either hand, once the exchange
   *  has begun): its swing is (5 - this) ticks of five. */
  FLURRY_FROM_FRAME: 1,
  /** The off hand's blow lands this share of the damage DFU rolls (a landed blow is never less than 1). */
  OFF_DAMAGE: 0.8,
  /** The off hand's to-hit term at Agility 50 - half a StrikeDown's own -10 (CalculateSwingModifiers) - eased by the
   *  hand's sureness: the rounded tenth of (Agility - 50) added, held in [-10, 0]. */
  OFF_TO_HIT: -5,
  OFF_TO_HIT_PER_AGILITY: 0.1,
  OFF_TO_HIT_MIN: -10,
  OFF_TO_HIT_MAX: 0,
  /** The off arm feels its weapon this much heavier - SWING-LAW's heft read at OFF_WEIGHT times the weight, over the
   *  heft at the weight itself: a dagger (0.5 kg) costs nothing, a longsword (4.5 kg) a tenth of the swing at Strength 50. */
  OFF_WEIGHT: 1.5,
});

/** The off hand's to-hit term at an Agility. */
export function offHandToHit(agility) {
  const a = Number.isFinite(agility) ? agility : 50;
  const t = DUAL.OFF_TO_HIT + Math.round((a - 50) * DUAL.OFF_TO_HIT_PER_AGILITY);
  return Math.max(DUAL.OFF_TO_HIT_MIN, Math.min(DUAL.OFF_TO_HIT_MAX, t));
}

/** The off hand's burden on the swing: SWING-LAW's heft at OFF_WEIGHT times the weapon's weight over its heft at the
 *  weight - 1 for anything light enough that neither arm feels it. */
export function offHandBurden(weightKg, strength) {
  return swingHeft((weightKg || 0) * DUAL.OFF_WEIGHT, strength) / swingHeft(weightKg || 0, strength);
}

/** THE BURDEN IS PAID IN WHOLE TICKS (AUDIT 2: a factor on a tick's time - the first audit's `ctx.tempo` - rounded to a
 *  different whole frame at every frame rate: a pair of battle axes swung x1.11 as often as one at 30 fps and x1.20 at
 *  1000). An off-hand blow of `ticks` ticks owes (burden - 1) x ticks more; it is held at the END of its swing - the
 *  heavier follow-through, after the hit - in whole ticks of the swing's own, and the fraction is carried to the hand's
 *  next blow, so over a fight the burden is paid exactly at any frame rate, as the flurry's quickness is (in ticks, not a
 *  tick's time). No blow averages a tick slower than SWING-LAW's slowest (SWING_FRAME_MAX, or its own tick when a mod
 *  answers slower). `tick` is the swing's tick in seconds.
 *  @returns {{ hold: number, carry: number }} the ticks to hold, and the fraction owed to the next blow */
export function offHandHold({ burden = 1, ticks = 0, tick = 0, carry = 0 } = {}) {
  const most = tick > 0 ? Math.max(1, SWING_FRAME_MAX / tick) : 1;
  const owed = Math.max(0, (Math.min(burden, most) - 1) * ticks) + Math.max(0, carry || 0);
  const hold = Math.floor(owed + 1e-9);
  return { hold, carry: Math.max(0, owed - hold) };
}

/** The off hand's damage: the rolled damage at OFF_DAMAGE, a miss (0) staying a miss and a landed blow at least 1. */
export function offHandDamage(damage) {
  if (!(damage > 0)) return damage;
  return Math.max(1, Math.round(damage * DUAL.OFF_DAMAGE));
}

/** THE OFF HAND'S BLOW as the formula takes it (formulas.js calculateAttackDamage), one home for the player's swing and a
 *  blow between players: its share of the damage, and (AUDIT 2) its WEIGHT as a blow - OFF_DAMAGE of one for what a blow
 *  sets off at its own rate rather than its damage's (the weapon's Strikes enchantments, a power's per-blow charge), so a
 *  pair sets those off as often a second as its damage edge allows, not its blow rate. */
export const OFF_HAND_BLOW = Object.freeze({ blowShare: offHandDamage, blowWeight: DUAL.OFF_DAMAGE });

// ---- THE GUARD (the hand that is not striking) ----------------------------------------------------------------------

/** While one hand strikes, the other draws in: toward the middle of the view and down, the shoulder turned behind the
 *  blow - eased in fast, back out slower (ClimbPose's limb law: no pop between states). IN and DOWN are design pixels on
 *  DFU's 320x200 surface - the fists' tuck. A pair's resting WEAPON lowers by LOWER of its own drawn height, and only
 *  lowers (Mac: "When attacking with a weapon, the other weapon in hand should lower slightly"; then, of the tuck, "The
 *  sprite on the right moves ... and exposes where it clips off"): a weapon's picture is several fists tall (a dagger's
 *  143 design pixels, a katana's 86), so the fists' nine pixels did not read on it - a share of its own height lowers
 *  every weapon alike; and every weapon a pair holds is painted with its hand leaving the frame through its OUTER side
 *  (WEAPON04's katana 32 rows cut on its right, a warhammer 53 - measured on every one-handed weapon's idle) and drawn
 *  flush to the view's side (WeaponBasics' idle: AlignRight, Offset 0; the dagger DFU's 0.04), so a tuck toward the
 *  middle drew the cut into the view. THE CUT STAYS OFF THE SCREEN (RUN_PUMP's rule too). The fists' guard is alive at
 *  rest: a slow bounce, the two hands out of step. */
export const GUARD = Object.freeze({
  IN: 10,
  DOWN: 9,
  LOWER: 0.12,
  IN_TAU: 0.05,
  OUT_TAU: 0.14,
  BOUNCE_PX: 1.6,
  BOUNCE_HZ: 1.15,
});

/** An exponential follower: `v` toward `target` with time constant `tau` over `dt` (ClimbPose's `ease`). */
export function easeTo(v, target, tau, dt) {
  if (!(tau > 0)) return target;
  return v + (target - v) * (1 - Math.exp(-Math.max(0, dt) / tau));
}

/** The guard's weight this frame, from the last: toward 1 while the OTHER hand strikes. */
export function guardStep(g, otherStriking, dt) {
  return easeTo(g, otherStriking ? 1 : 0, otherStriking ? GUARD.IN_TAU : GUARD.OUT_TAU, dt);
}

/** The guard's offset in design pixels for a hand at weight `g` drawn on `side` ('right'|'left'): x toward the middle,
 *  y down - a fist's IN and DOWN, or a weapon's LOWER of its drawn `height` (design pixels) when one is handed, straight
 *  down (its cut side stays on the view's edge). And the fists' bounce at `time` seconds, out of step between the hands,
 *  faded by `bounce` (0..1) - ONLY EVER DOWN (AUDIT 2: a sine about the rest lifted each fist's cut wrist off the view's
 *  bottom edge for half its beat - the floating hands again; RUN_PUMP's rule): from the rest to 2 x BOUNCE_PX below it
 *  and back, the same travel. */
export function guardOffset(g, side, { time = 0, bounce = 0, hand = 'R', height = null } = {}) {
  const toMid = side === 'left' ? 1 : -1;
  const phase = hand === 'L' ? Math.PI : 0;
  const b = bounce > 0 ? (1 - Math.cos(time * 2 * Math.PI * GUARD.BOUNCE_HZ + phase)) * GUARD.BOUNCE_PX * bounce : 0;
  const weapon = Number.isFinite(height);
  const down = weapon ? GUARD.LOWER * /** @type {number} */ (height) : GUARD.DOWN;
  return [weapon ? 0 : toMid * GUARD.IN * g, down * g + b];
}

// ---- THE SPREAD (a pair in the Morrowind arm's first person) --------------------------------------------------------

/** TWO-HANDS SPREAD (2026-10-17, Mac: "For the morrowind first person, when duel wielding can we spread out the arms a
 *  bit more sense it can make the weapons overlap"). The first-person pair holds its left arm as the right's mirror
 *  across the picture's middle (mirrorRig.js pictureMirrorArm), and Morrowind's one-handed stance holds its weapon
 *  leaning in toward that middle - so the glass alone crossed a long pair's blades there. Both arms are turned OUTWARD,
 *  each about the upright line through its own top joint (mirrorRig.js's `spread`: the left still the right's mirror,
 *  no joint off its parent): always by MIN, and further where the blades would stand closer than GAP to each other,
 *  never more than MAX. Shares of the picture's HEIGHT (the arms' lens is FP_FIELD_OF_VIEW high), as GUARD.LOWER is of
 *  a weapon's, each taken as the angle it spans at the picture's middle: no number about any skeleton or weapon - each
 *  blade's inner edge is read off the rig and the blade it holds (fpArm.js bladeInnerEdge). The angle is eased (TAU, in
 *  seconds), so a blade bound anew or a pair taken up or put away moves the arms, never pops them. The sprite lane draws
 *  each weapon flush to its own side of the view (WeaponBasics' AlignRight, and its mirror) and needs none. */
export const PAIR_SPREAD = Object.freeze({
  MIN: 0.04,
  GAP: 0.04,
  MAX: 0.2,
  TAU: 0.12,
});

/** The angle (radians) each arm of a pair is turned out: the least in [MIN, MAX] at which the blades stand GAP apart on
 *  the picture, found by halving (to well under a thousandth of a degree). `innerAt(angle)` answers each blade's inner
 *  edge with the arms turned out by `angle` - `{ L, R }`, the angle at the eye from the picture's middle to the blade's
 *  nearest point, positive on its own hand's side - or a blade's null where it is not on the picture, which asks nothing.
 *  A turn about a shoulder moves an edge a little less than the turn (the arm swings about a joint off the eye), so the
 *  edges are measured at each angle tried, never assumed; `fov` is the lens's vertical field of view. */
export function pairSpreadAngle(innerAt, fov) {
  const tan = Math.tan(fov / 2);
  const share = (k) => Math.atan(k * 2 * tan);   // a share of the picture's height, as the angle it spans at its middle
  const gap = 2 * Math.atan(PAIR_SPREAD.GAP * tan);
  const clear = (a) => { const e = innerAt(a); return !e || !Number.isFinite(e.L) || !Number.isFinite(e.R) || /** @type {number} */ (e.L) + /** @type {number} */ (e.R) >= gap; };
  let lo = share(PAIR_SPREAD.MIN), hi = share(PAIR_SPREAD.MAX);
  if (clear(lo)) return lo;
  if (!clear(hi)) return hi;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (clear(m)) hi = m; else lo = m; }
  return hi;
}

// ---- THE RUNNING HANDS ----------------------------------------------------------------------------------------------

/** One footfall every this many metres - PlayerFootsteps.WalkStepInterval (systems/footsteps.js WALK_STEP_INTERVAL,
 *  pinned equal), which DFU's HeadBobber walks its timer by (bobSpeed = WalkStepInterval / 2: PI of its timer a step).
 *  The arms swing one stroke a step, so the hands pump with the feet the camera bobs to. */
export const RUN_STEP_M = 2.5;

/**
 * The pump. THE RUNNING ARM IS THE ART'S OWN (Mac: "theres no arm portion of the sprite, so it looks like floating hands").
 * The bare hand's idle (WEAPON10.CIF record 0, 63x53) is a fist cut at the wrist, painted to stand on the view's bottom
 * edge - lifted, its cut floats. So a running hand is a frame of the bare hand's art that holds a fist on its own grey
 * forearm from the frame's foot, drawn as FPSWeapon draws a frame - its foot on the view's bottom edge (OnGUI's
 * `height - h`) at the top of the stroke: THE PUMP NEVER LIFTS A SPRITE. The stroke lowers it, on an even sine, down past
 * the view at the back of the stroke, so the arm always runs off the bottom of the screen.
 * THE FIST'S BACK, A THIRD OF THE VIEW HIGH - record 2 (StrikeDownLeft, the right arm's jab across), frame 1: a closed
 * fist seen from its back, knuckles leading, as the idle fist is seen, on its forearm reaching in from the frame's foot,
 * 67 of the view's 200 pixels. TWO-HANDS FIELD (Mac after the merge): the merged cut drew record 5 (StrikeDownRight,
 * the uppercut) - "Too high, like uppercuts": its frames 1, 2 and 3 by how far up the stroke was, 2 and 3 the punch's
 * peak, an upright forearm 98 pixels high, half the screen, held at the top by a snap; and then, its lowest frame alone,
 * "Why is the underhand showing when extended and not the fist": an uppercut shows the fist's INSIDE, curled fingers
 * toward the eye, in every frame. THE CUT STAYS OFF THE SCREEN: record 2's frame 1 leaves its frame through its FOOT
 * alone (measured on the shipped file: no row cut down either side; record 5's frame 0 had 15 down its right - Mac: "The
 * sprite on the right moves to the right and exposes where it clips off").
 *   ARM_STATE / ARM_FRAME - the record (by its state) and its frame: the fist's back, leaving only at the foot;
 *   DROP      - the back of the stroke, down, of the frame's height (past the view's edge: the hand passing the hip);
 *   IN/OUT    - toward the middle at the top (the arm across the chest) and out at the bottom, of the view's width;
 *   SWAP      - the run's weight at which a hand changes its art - the fists' rest for the running arm, or back - the
 *               rest lowered out of the view below it and the arm come up from under the view above it, so the art
 *               never changes in sight;
 *   IN_TAU/OUT_TAU - the hands up as the run begins and away as it ends (CLIMB-HANDS' presence, ClimbPose IN/OUT);
 *   PUNCH_TAU - away at once for a punch thrown on the run (the punch is the fist's own strike);
 *   MIN_SPEED - metres a second over the ground before a run is a run (a run key held standing is not);
 *   CATCH     - how far off its own walk the stride's tempo may run while it keeps step with the head bob (runPhaseFollow):
 *               half again as fast, or half as fast, never backward;
 *   AIR_GRACE - seconds a run stays a run through a hop off the ground (runHandsKept: AUDIT 2 - a jump on the run swapped
 *               the arms for the fists and back, four art changes in under a second; the head bob holds its own timer in
 *               the air).
 */
export const RUN_PUMP = Object.freeze({
  ARM_STATE: 'StrikeDownLeft',
  ARM_FRAME: 1,
  DROP: 1.05,
  IN: 0.06,
  OUT: 0.03,
  SWAP: 0.5,
  IN_TAU: 0.12,
  OUT_TAU: 0.16,
  PUNCH_TAU: 0.04,
  MIN_SPEED: 1.0,
  CATCH: 0.5,
  AIR_GRACE: 0.6,
});

/** THE STRIDE ON THE HEAD BOB'S CLOCK (AUDIT): the pump's phase from HeadBobber's own timer - which sways the eye over the
 *  planted foot (cos: the right at 0, the left at PI) - so the right arm is most forward (pumpOf's sin at its crest) as the
 *  left foot is planted: the phase a quarter turn behind the timer. */
export const runPhaseOfBob = (timer) => timer - Math.PI / 2;

/** The stride's own step: the phase `speed` m/s walks in `dt` - PI a RUN_STEP_M, never backward. */
const strideStep = (speed, dt) => Math.max(0, speed || 0) * Math.max(0, dt) * Math.PI / RUN_STEP_M;

/** The stride's phase after running `speed` m/s for `dt`: PI a step, as HeadBobber's timer - the fallback with head
 *  bobbing off, when there is no bob to keep step with. */
export function runPhaseStep(phase, speed, dt) {
  const p = phase + strideStep(speed, dt);
  return p % (2 * Math.PI);
}

/**
 * THE STRIDE KEEPS THE BOB'S STEP AND NEVER JUMPS (TWO-HANDS AUDIT 2, L2 F5 / L3 M3) - the pump's phase this frame, both
 * lanes' (twoHands.js, fpArm.js): `bob` the head bob's phase (runPhaseOfBob of its timer), null with head bobbing off -
 * then the speed's own walk (runPhaseStep). HeadBobber's clock is not continuous (player/headBobber.js, getNewPos as
 * DFU has it): a run resumed inside its 0.5 s end transition sets the timer to PI, a stop unwinds it, a settled stop
 * sets it to PI again, and it wraps at 2 PI - and a phase taken as it stands swapped the arms in one frame (a stop
 * of one frame mid-run: 227 px of the sprite's 600, 0.4 rad on the 3D picture). So a frame's step is the bob's own while
 * that is within CATCH of the stride's walk at `speed` - every frame of a steady run (the bob walks velocity x
 * WalkStepInterval / 2 a second, the stride PI a RUN_STEP_M: half a percent apart), so the hands stand ON the bob's
 * phase - and otherwise the walk sped up or slowed down by CATCH toward it, the shorter way round: a reset is caught up
 * over a few strokes, never in a frame and never backward. `fresh` - nothing of the pump is drawn (its weight 0): the
 * bob's phase at once.
 */
export function runPhaseFollow(phase, bob, speed, dt, fresh = false) {
  if (!Number.isFinite(bob)) return runPhaseStep(phase, speed, dt);
  if (fresh || !Number.isFinite(phase)) return bob;
  const walk = strideStep(speed, dt);
  const lo = walk * (1 - RUN_PUMP.CATCH), hi = walk * (1 + RUN_PUMP.CATCH);
  const turn = 2 * Math.PI;
  const off = bob - phase - turn * Math.round((bob - phase) / turn);   // the bob's lead, the shorter way round
  if (off >= lo && off <= hi) return bob;
  return (phase + Math.min(hi, Math.max(lo, off))) % turn;
}

/** The run KEPT through a hop (AUDIT 2): wanted on the ground (`wanted`, runHandsWanted's answer), or aloft for no longer
 *  than AIR_GRACE when it was wanted the frame before and would be on the ground (`aloft`: runHandsWanted's answer with
 *  the feet down). The rig keeps `airSeconds`, the time off the ground; one answer for both lanes. */
export function runHandsKept({ wanted = false, aloft = false, wasWanted = false, airSeconds = 0 } = {}) {
  return !!wanted || (!!aloft && !!wasWanted && airSeconds <= RUN_PUMP.AIR_GRACE);
}

/** The hands want to run: the body runs on its feet (DFU's run - PlayerMotor's isRunning; not standing, not crouched,
 *  not mounted, not swimming or in the air or on a wall) fast enough over the ground, and the hands hold nothing at all
 *  (`emptyHands`: no weapon and no shield in either hand, no light, no spell, no sheet, no tool) and throw nothing. */
export function runHandsWanted({ running = false, standing = false, grounded = true, crouching = false, riding = false,
  swimming = false, climbing = false, speed = 0, emptyHands = false, attacking = false } = {}) {
  return !!running && !standing && !!grounded && !crouching && !riding && !swimming && !climbing && !attacking
    && !!emptyHands && speed >= RUN_PUMP.MIN_SPEED;
}

/**
 * One hand's place in the pump at stride phase `phase`: `{ dx, dy, frame, s }` - dx a share of the view's width toward
 * the middle (+), dy a share of the frame's height DOWN (never up: 0 at the top of the stroke, its foot on the view's
 * edge; DROP at the back, past it), `frame` the arm's frame (RUN_PUMP.ARM_FRAME), `s` the stroke (-1 back .. 1 forward,
 * an even sine: fastest through the middle, easing at either end - TWO-HANDS FIELD, the snap that held the fist at the
 * top of its stroke is gone with the punch's peak). The right arm swings forward as the left foot falls - the hands out
 * of step by half a stride.
 */
export function pumpOf(phase, hand) {
  const s = Math.sin(phase + (hand === 'L' ? Math.PI : 0));
  const fwd = Math.max(0, s), back = Math.max(0, -s);
  return { dx: RUN_PUMP.IN * fwd - RUN_PUMP.OUT * back, dy: RUN_PUMP.DROP * (1 - s) / 2, frame: RUN_PUMP.ARM_FRAME, s };
}

/**
 * THE MORROWIND ARMS' PUMP - the same stroke on the 3D body (combat/fpArm.js): each hand's place as a point on the
 * picture of the arms' own lens - `x` across from its middle (+ toward the hand's own side), `y` up from it, in shares of
 * the half-frame - and `d` metres out from the eye along that line; the arm reaches it through the climb's solver
 * (combat/climbRig.js), its fist clenched (`CURL` radians, each finger's share), its palm turned in, its elbow out and
 * back. The top of the stroke is the bottom of the picture, before the hand's own shoulder; the bottom is under the
 * frame - the hand passing the hip. The same stride, the same stroke, the same weight as the sprite lane's (pumpOf,
 * runWeightStep). RUN-WIDE (2026-10-19, Mac: "The hands are way too close together when running both in third and first
 * person"): the top stood 0.36 of the half-frame out - 14 cm across at its 0.42 m, inside the shoulder joint's 15.5 (the
 * retail biped's) - so each fist came up toward the middle; 0.6 is 21 cm, before and just outside its own shoulder.
 */
export const RUN_3D = Object.freeze({
  TOP: Object.freeze({ x: 0.6, y: -0.62, d: 0.42 }),
  BOTTOM: Object.freeze({ x: 0.8, y: -1.7, d: 0.38 }),
  CURL: 1.5,
});
/** One hand's place in the 3D pump at stride phase `phase`: { x, y, d, s } (see RUN_3D; x toward the hand's own side). */
export function pumpTarget3D(phase, hand) {
  const { s } = pumpOf(phase, hand);
  const f = (s + 1) / 2;
  const lerp = (a, b) => a * (1 - f) + b * f;   // exact at both ends of the stroke
  return { x: lerp(RUN_3D.BOTTOM.x, RUN_3D.TOP.x), y: lerp(RUN_3D.BOTTOM.y, RUN_3D.TOP.y), d: lerp(RUN_3D.BOTTOM.d, RUN_3D.TOP.d), s };
}

/** The running weight this frame, from the last: up as a run starts, away as it ends, at once for a punch. */
export function runWeightStep(w, wanted, punching, dt) {
  if (punching) return easeTo(w, 0, RUN_PUMP.PUNCH_TAU, dt);
  return easeTo(w, wanted ? 1 : 0, wanted ? RUN_PUMP.IN_TAU : RUN_PUMP.OUT_TAU, dt);
}
