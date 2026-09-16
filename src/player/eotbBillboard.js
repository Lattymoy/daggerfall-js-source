// EOTB3: THE PLAYER BILLBOARD - the body you see in third person
// when you have no Morrowind data.
//
// RedRoryOTheGlen's `PlayerBillboard`, read off the shipped assembly's
// IL alongside the camera (EOTB2). This file is the LOGIC: which
// sprite, facing which way, on what clock. The drawing is the host's.
//
// ═══ THE STATE TABLE IS ONE LAW, NOT 168 ROWS ═════════════════════
//
// `InitializeStates` builds 21 arrays of 8 states each - idle, move
// and death across melee, ranged and spell, plus the horse and the two
// lycanthrope forms. Written out, that is 168 entries, and it is
// exactly the kind of table a port copies by hand and gets subtly
// wrong.
//
// It does not need copying. Every one of the 168 follows the SAME
// wheel, and that was checked mechanically against the IL rather than
// by eye - 0 of 168 deviate:
//
//     index   0  1  2  3  4  5  6  7
//     record +0 +1 +2 +3 +4 +3 +2 +1
//     mirror  .  M  M  M  .  .  .  .
//
// which is classic Daggerfall's own 8-orientation layout: five drawn
// records from front to back, and the right-hand half is the left-hand
// half flipped. The port already speaks it - `characters/
// mobilePerson.js` calls it "the MoveAnims wheel (records 0-4
// mirrored - the monster layout)".
//
// So the table below is 21 BASE RECORDS and the wheel above. A rule
// enforced by an enumeration is a rule enforced by memory.

import { roundToInt } from '../systems/mathf.js';

/** The wheel: which record each of the eight orientations draws, and
 *  which of them are drawn flipped. */
export const RECORD_OFFSETS = Object.freeze([0, 1, 2, 3, 4, 3, 2, 1]);
export const MIRRORED = Object.freeze([false, true, true, true, false, false, false, false]);
export const ORIENTATIONS = 8;
export const ANGLE_PER_ORIENTATION = 360 / ORIENTATIONS;   // 45

/** The archives the bundle ships, and what indexes them.
 *  `Graphics.OnFoot` is 0..15, `Graphics.OnHorse` 0..4, and the
 *  lycanthrope pair is picked by FORM, not by a setting. */
export const ARCHIVE_FOOT = 112364;
export const ARCHIVE_HORSE = 112382;
export const ARCHIVE_LYCAN = 112380;
/** DFU's LycanthropyTypes: None 0, Werewolf 1, Wereboar 2. The mod
 *  tests `== 2` and adds 1, so the wereboar takes 112381 and every
 *  other value - werewolf included - takes 112380. */
export const lycanArchive = (lycanthropyType) => ARCHIVE_LYCAN + (lycanthropyType === 2 ? 1 : 0);

/**
 * The 21 tables, as (base record, frames). `frames` is 0 everywhere
 * except the two BOW-READY loops, which the mod pins at 3 - so the
 * zero is "whatever the sprite has" and the 3 is a real override.
 *
 * The on-foot twelve are `slot * 5` exactly; the horse and lycan sets
 * reuse the same numbering over their own archives, which is why they
 * are written with the same numbers rather than renumbered.
 */
export const STATE_TABLES = Object.freeze({
  Idle: { base: 0, frames: 0 },
  Move: { base: 5, frames: 0 },
  Death: { base: 10, frames: 0 },
  IdleMelee: { base: 15, frames: 0 },
  MoveMelee: { base: 20, frames: 0 },
  AttackMelee: { base: 25, frames: 0 },
  IdleRanged: { base: 30, frames: 3 },
  MoveRanged: { base: 35, frames: 3 },
  AttackRanged: { base: 40, frames: 0 },
  IdleSpell: { base: 45, frames: 0 },
  MoveSpell: { base: 50, frames: 0 },
  AttackSpell: { base: 55, frames: 0 },
  IdleHorse: { base: 0, frames: 0 },
  MoveHorse: { base: 5, frames: 0 },
  GallopHorse: { base: 10, frames: 0 },
  IdleLycan: { base: 0, frames: 0 },
  MoveLycan: { base: 5, frames: 0 },
  IdleMeleeLycan: { base: 15, frames: 0 },
  MoveMeleeLycan: { base: 20, frames: 0 },
  AttackMeleeLycan: { base: 25, frames: 0 },
  DeathLycan: { base: 10, frames: 0 },
});

/** Which archive a table draws from - foot, horse or lycanthrope. */
export const tableArchive = (name, { onFoot = 0, onHorse = 0, lycanthropyType = 0 } = {}) => {
  if (name.endsWith('Horse')) return ARCHIVE_HORSE + onHorse;
  if (name.endsWith('Lycan')) return lycanArchive(lycanthropyType);
  return ARCHIVE_FOOT + onFoot;
};

/** One state of one table: the record it draws and whether it is
 *  flipped. Generated from the wheel - never listed. */
export function stateFor(table, orientation) {
  const t = STATE_TABLES[table];
  if (!t) return null;
  const i = ((orientation % ORIENTATIONS) + ORIENTATIONS) % ORIENTATIONS;
  return { record: t.base + RECORD_OFFSETS[i], mirror: MIRRORED[i], frames: t.frames };
}

/** `Mathf.RoundToInt` - ONE HOME in `systems/mathf.js` since this
 *  slice. Re-exported because this module's pins name it, and because
 *  the orientation snap below is why the port needs Unity's tie rule
 *  rather than JavaScript's: dividing the angle by 45 puts a player
 *  standing exactly side-on to the camera on a tie, and JS rounds a
 *  half toward +infinity - so the sprite would flip one orientation
 *  early on one side and not the other. Nobody would find that by
 *  looking. */
export { roundToInt };

/**
 * `UpdateOrientation`: the signed angle between the way the sprite
 * faces and the way the camera lies, about world up, snapped to the
 * eight and negated - so turning the camera to the player's right
 * walks the orientation the other way round the wheel.
 *
 * Vectors are the port's y-up [x, y, z]; only x and z are read, as the
 * mod flattens both before it measures.
 */
export function signedAngleY(from, to) {
  const a = Math.atan2(from[0], from[2]);
  const b = Math.atan2(to[0], to[2]);
  let d = (b - a) * (180 / Math.PI);
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}
export function orientationFor(facing, toCamera) {
  const angle = signedAngleY(facing, toCamera);
  const o = -roundToInt(angle / ANGLE_PER_ORIENTATION);
  return ((o % ORIENTATIONS) + ORIENTATIONS) % ORIENTATIONS;
}

/**
 * `get_frameTime`: seconds a frame.
 *
 *     riding ? 0.0625 * (2 - walkAnimSpeedMod)
 *            : 0.25   * (2 - walkAnimSpeedMod)
 *
 * At the shipped WalkCycleSpeed of 1 that is 0.25s on foot - FOUR
 * frames a second, classic Daggerfall's own mobile rate, the same one
 * `characters/mobilePerson.js` runs the townspeople at - and 0.0625s
 * (sixteen a second) in the saddle.
 *
 * Note the subtraction: a HIGHER WalkCycleSpeed setting means a
 * SHORTER frame time, so the dial reads the way a player expects even
 * though the number it scales is a duration.
 */
export const FRAME_TIME_ON_FOOT = 0.25;
export const FRAME_TIME_RIDING = 0.0625;
export const frameTime = (riding, walkAnimSpeedMod = 1) =>
  (riding ? FRAME_TIME_RIDING : FRAME_TIME_ON_FOOT) * (2 - walkAnimSpeedMod);

/** The two frames of the five-frame walk cycle that land a foot -
 *  `SyncFootsteps` fires the step sound on these and on no others. */
export const FOOTSTEP_FRAMES = Object.freeze([2, 4]);

/**
 * Which table the player is in, as `LoopIdleBillboard` chooses it.
 * The order is the mod's: dead first, then transformed, then mounted,
 * then what is readied, and `stopped` picks idle over move inside each.
 *
 * `ReadyStance` (Graphics) decides whether a readied weapon changes the
 * sprite at all: 0 never, 1 when idle, 2 when idle or moving - so at 1
 * a player who draws a sword and walks is drawn walking UNARMED, which
 * looks like a bug and is the setting doing its job.
 */
export function chooseTable(s = {}) {
  const {
    died = false, transformed = false, riding = false, stopped = true,
    sheathed = true, spellcasting = false, usingBow = false, galloping = false,
    readyStance = 2,
  } = s;
  if (transformed) {
    if (died) return 'DeathLycan';
    const ready = !sheathed && readyStance !== 0 && (stopped || readyStance === 2);
    if (ready) return stopped ? 'IdleMeleeLycan' : 'MoveMeleeLycan';
    return stopped ? 'IdleLycan' : 'MoveLycan';
  }
  if (died) return 'Death';
  if (riding) {
    if (stopped) return 'IdleHorse';
    return galloping ? 'GallopHorse' : 'MoveHorse';
  }
  // the readied stance, gated by the setting
  const showReady = readyStance !== 0 && (stopped || readyStance === 2);
  if (showReady && spellcasting) return stopped ? 'IdleSpell' : 'MoveSpell';
  if (showReady && !sheathed) {
    if (usingBow) return stopped ? 'IdleRanged' : 'MoveRanged';
    return stopped ? 'IdleMelee' : 'MoveMelee';
  }
  return stopped ? 'Idle' : 'Move';
}

/** The attack table that answers a given readied stance - what the
 *  swing, the loose and the cast play. */
export function attackTable(s = {}) {
  if (s.transformed) return 'AttackMeleeLycan';
  if (s.spellcasting) return 'AttackSpell';
  if (s.usingBow) return 'AttackRanged';
  return 'AttackMelee';
}

/** The sprite the bundle ships for one state, in the vendored naming:
 *  `<archive>_<record>-<frame>`. */
export const spriteKey = (archive, record, frame) => `${archive}_${record}-${frame}`;

// ═══ AUDIT-EOTB2: THE ONE-SHOTS, THE FACING AND THE AUTO-TOGGLE ══════
//
// EVIDENCE, stated per law because the assembly is NOT in the tree.
// The camera and the table above were read off the IL on a machine
// that had the bundle; this container has the bundle's manifest, its
// settings (every key with the author's own description and option
// labels) and its art, and NOT `Eye Of The Beholder.dll`. So each law
// below says what it was read from:
//
//   [IL]        read off the assembly (the laws above this banner)
//   [SETTINGS]  the setting's name, description and option labels,
//               plus the state table the IL gave us
//   [DFU]       Daggerfall Unity's own member the mod hangs off
//
// A [SETTINGS] law is the mod's shape as its author described it to
// the player, not its body as the compiler saw it. When the assembly
// is read, each becomes [IL] or is corrected - `bible/06-Systems/
// Eye-Of-The-Beholder.md` carries the list.

/** Graphics.AttackStrings' options, by index (modsettings.json). */
export const ATTACK_STRINGS = Object.freeze(['None', 'Mirror', 'PingPong', 'Mixed']);

/**
 * [SETTINGS] Which string ONE attack plays. `None` plays the clip
 * forward; `Mirror` alternates the clip's horizontal flip swing by
 * swing (`MirrorTime` reverts it); `PingPong` plays forward then back
 * (`PingPongOffset` moves the turn); `Mixed` rolls one of the two per
 * attack - the only reading under which a "Mixed" option means
 * anything beside the other three.
 */
export function attackString(setting, rolls = Math.random) {
  const label = ATTACK_STRINGS[setting] ?? 'None';
  if (label === 'Mixed') return rolls() < 0.5 ? 'Mirror' : 'PingPong';
  return label;
}

/**
 * [SETTINGS] The frame ORDER of a one-shot clip over `n` records.
 * Forward is 0..n-1. PingPong turns at `n - 1 - offset` - "Adjusts the
 * point in the animation where it starts playing backwards", shipped
 * at 1 and ranged -3..3 - and walks back to 0 without repeating the
 * turn frame. The turn is clamped into the clip, so an offset past
 * either end is the nearest frame rather than an empty clip.
 */
export function clipFrames(n, { pingPong = false, pingPongOffset = 1 } = {}) {
  const count = Math.max(1, n | 0);
  const forward = Array.from({ length: count }, (_, i) => i);
  if (!pingPong) return forward;
  const turn = Math.max(0, Math.min(count - 1, count - 1 - (pingPongOffset | 0)));
  const out = forward.slice(0, turn + 1);
  for (let i = turn - 1; i >= 0; i--) out.push(i);
  return out;
}

/** [IL] The death table by form - the two Death rows InitializeStates
 *  builds; PlayDeathAnimation is the one thing that reaches them. */
export const deathTable = (s = {}) => (s.transformed ? 'DeathLycan' : 'Death');

/** Graphics.TurnToView's options, by index. */
export const TURN_TO_VIEW = Object.freeze(['Never', 'OnlyWhenAnimating', 'WhenWeaponReadied', 'Always']);

/**
 * [SETTINGS] "Configure when the sprite turns to face the view." The
 * sprite faces the VIEW (the camera's yaw - DFU's player has no body
 * yaw of its own) when the option says so, and the way it is MOVING
 * otherwise, so an unarmed player backing away from the camera is
 * drawn walking toward it. `animating` is a one-shot in flight;
 * `readied` is a weapon or spell up.
 */
export function turnsToView(setting, { animating = false, readied = false } = {}) {
  const label = TURN_TO_VIEW[setting] ?? 'Never';
  if (label === 'Always') return true;
  if (label === 'WhenWeaponReadied') return readied || animating;
  if (label === 'OnlyWhenAnimating') return animating;
  return false;
}

/** AutoTogglePerspective's rows, in the settings' own order. */
export const AUTO_TOGGLE_ROWS = Object.freeze([
  'OnFoot', 'OnFootMelee', 'OnFootRanged', 'OnFootSpell', 'OnHorse', 'OnHorseReady', 'OnLycan',
]);
/** Its option labels: 0 leaves the view, 1 takes first person, 2 third. */
export const AUTO_TOGGLE = Object.freeze({ DontChange: 0, FirstPerson: 1, ThirdPerson: 2 });

/**
 * [SETTINGS] Which AutoTogglePerspective row the player is in, one row
 * a frame, in the same precedence chooseTable walks (dead is not a
 * row: the table has none). A row is applied when the situation
 * CHANGES, never every frame - a `FirstPerson` row re-applied each
 * frame would fight the wheel, and the mod ships a wheel.
 */
export function autoToggleSituation(s = {}) {
  const readied = !s.sheathed || !!s.spellcasting;
  if (s.transformed) return 'OnLycan';
  if (s.riding) return readied ? 'OnHorseReady' : 'OnHorse';
  if (s.spellcasting) return 'OnFootSpell';
  if (!s.sheathed) return s.usingBow ? 'OnFootRanged' : 'OnFootMelee';
  return 'OnFoot';
}
