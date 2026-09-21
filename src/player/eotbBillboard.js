// EOTB3: THE PLAYER BILLBOARD - the body you see in third person
// when you have no Morrowind data.
//
// RedRoryOTheGlen's `PlayerBillboard`, read off the shipped assembly's
// IL. This file is the LOGIC: which sprite, facing which way, on what
// clock. The drawing is `eotbBody.js`'s.
//
// ═══ EOTB-IL (2026-09-17): THE ASSEMBLY, READ ══════════════════════
//
// Mac handed the shipped archive over ("it needs to be 1:1 with the
// uploaded file. No exceptions") and the port's own UnityFS reader
// took `Eye Of The Beholder.dll` out of the `.dfmod`; `dnfile`/`dncil`
// read every method (`tools/eotbIl.mjs` + `tools/ilDump.py`; the dump
// is vendored beside the art). Every law below is now [IL] - the
// settings-only readings AUDIT-EOTB2 made in the assembly's absence are
// gone, and where one was wrong the IL offset that corrects it is
// cited. The two things Mac saw were both here:
//
//   "Frame chopping between animations" - the port ran EVERY table on a
//   five-frame clock (CLIP_FRAMES). The bundle's records are NOT five
//   frames: an idle is ONE, a walk FOUR, a death TWO, a swing SIX
//   (`TABLE_FRAMES` below, counted from the art, pinned against it).
//   Four frames in five of a standing player asked for a sprite that
//   does not exist, and the body drew nothing for them.
//
//   "Sprite turns in wrong direction on input" - `orientationFor`
//   measured the angle from the FACING to the CAMERA;
//   `UpdateOrientation` (IL_4779-IL_4786) measures it from the CAMERA
//   to the FACING. The wheel ran backwards: a player turning left was
//   drawn from the right.
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
 * The 21 tables, as (base record, frames). `frames` is the FOURTH
 * argument `InitializeStates` hands `PlayerBillboardState`'s
 * constructor - 0 everywhere but the two bow-ready loops, which say 3
 * - and the constructor IGNORES IT (IL_59f4-IL_5a60 stores the name and
 * the mirror flag and asks `InitializeTextures` to COUNT the files).
 * It is carried because `vendor/eye-of-the-beholder/states.json` is
 * the table as the IL builds it and the pin compares every field; the
 * clip length the mod actually runs is `TABLE_FRAMES` below.
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

/**
 * [IL] THE CLIP LENGTHS, as `PlayerBillboardState.InitializeTextures`
 * finds them (IL_5a70-IL_5ad4: `archive_record-i` for i = 0, 1, ...
 * while the bundle has one). Counted from the vendored art rather than
 * typed - the pin in test/eotb_playerbillboard.test.js walks all 23
 * archives and every record - and the same for every archive of a
 * kind, which is why the table is per TABLE and not per file:
 *
 *   on foot   idle 1, walk 4, death 2, ready 1, armed walk 2, swing 6,
 *             bow ready 1, bow walk 2, loose 4, spell ready 2, spell
 *             walk 2, cast 4
 *   mounted   idle 1, walk 8, gallop 8
 *   lycan     idle 1, walk 4, death 2, ready 1, armed walk 2, claw 3
 *
 * A one-frame table never advances (LoopIdleBillboard's whole clock is
 * behind `frames.Count > 1`, IL_41b7-IL_41cf), which is what stops an
 * idle asking for frames that are not there - the EOTB-IL finding.
 */
export const TABLE_FRAMES = Object.freeze({
  Idle: 1, Move: 4, Death: 2, IdleMelee: 1, MoveMelee: 2, AttackMelee: 6,
  IdleRanged: 1, MoveRanged: 2, AttackRanged: 4, IdleSpell: 2, MoveSpell: 2, AttackSpell: 4,
  IdleHorse: 1, MoveHorse: 8, GallopHorse: 8,
  IdleLycan: 1, MoveLycan: 4, IdleMeleeLycan: 1, MoveMeleeLycan: 2, AttackMeleeLycan: 3, DeathLycan: 2,
});
export const frameCount = (table) => TABLE_FRAMES[table] ?? 1;

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
 * `Vector3.SignedAngle(from, to, Vector3.up)` on two vectors flattened
 * to the ground: the angle FROM the first TO the second, positive
 * clockwise seen from above (Unity's left-handed y-up, which is the
 * port's own frame - every host's forward is `[sin yaw, 0, cos yaw]`).
 * A zero vector on either side answers 0, as Unity's `Angle` does when
 * its denominator vanishes - the first-person billboard stands ON the
 * camera's point and reads the front record through exactly this.
 *
 * Vectors are the port's y-up [x, y, z]; only x and z are read.
 */
export function signedAngleY(from, to) {
  if ((!from[0] && !from[2]) || (!to[0] && !to[2])) return 0;
  const a = Math.atan2(from[0], from[2]);
  const b = Math.atan2(to[0], to[2]);
  let d = (b - a) * (180 / Math.PI);
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

/**
 * [IL] `UpdateOrientation`'s snap (IL_4779-IL_47a3):
 *
 *     currentAngle = SignedAngle(toCamera, facing, up)
 *     o = -RoundToInt(currentAngle / 45); o = (o + 8) % 8
 *
 * where `toCamera` is the player-to-camera vector flattened and
 * normalised (IL_455d-IL_45bb) and `facing` is what `facingFor` below
 * answers. THE ORDER OF THE TWO IS THE EOTB-IL FINDING: the port had
 * them the other way round, which negates the angle, which runs the
 * wheel backwards - a player turning left was drawn from the right.
 * Facing the camera is 0; the camera behind is 4; the camera off the
 * player's left is 6 (the record the mod names IdleRight, drawn
 * straight) and off their right 2 (IdleLeft, the mirrored one) - the
 * same wheel DFU's own MobileUnit.OrientEnemy turns for every foe,
 * which `characters/mobileUnit.js` already runs.
 */
export function orientationFor(facing, toCamera) {
  const angle = signedAngleY(toCamera, facing);
  const o = -roundToInt(angle / ANGLE_PER_ORIENTATION);
  return ((o % ORIENTATIONS) + ORIENTATIONS) % ORIENTATIONS;
}

/** Graphics.TurnToView's options, by index. */
export const TURN_TO_VIEW = Object.freeze(['Never', 'OnlyWhenAnimating', 'WhenWeaponReadied', 'Always']);

/**
 * [IL] `UpdateOrientation`'s FACING (IL_45bc-IL_4766), which way the
 * sprite is turned before the camera's angle to it is measured:
 *
 *   moveDir = PlayerMotor.MoveDirection, flattened;
 *             zero -> lastMoveDirection, or the camera's forward if
 *             that is zero too (IL_45d8-IL_4610)
 *   facing  = camera forward, then
 *     floating (levitating or swimming, LoopIdleBillboard IL_4088)
 *                                     -> the camera forward
 *     TurnToView > 2 (Always)         -> the camera forward
 *     TurnToView == 2 (WhenReadied)   -> animating: camera forward;
 *                                        else drawn or spell readied:
 *                                        camera forward; else moving:
 *                                        moveDir; else lastMoveDirection
 *     TurnToView == 1 (OnlyAnimating) -> animating: camera forward;
 *                                        else moving: moveDir; else
 *                                        lastMoveDirection
 *     TurnToView == 0 (Never)         -> moving: moveDir; else
 *                                        lastMoveDirection
 *   (Free Rein's ride vector and Come Sail Away's boat forward follow,
 *   neither in the port); facing.y = 0; lastMoveDirection = facing.
 *
 * Note `lastMoveDirection` is the last FACING, not the last move: a
 * player who sheathes while standing keeps looking where the camera
 * looked when the weapon was up. The port had tracked the last MOVE
 * and fallen back to the live camera.
 */
export function facingFor({ turnToView = 2, floating = false, animating = false, sheathed = true, spellcasting = false, stopped = true } = {},
  moveDir, lastMoveDirection, cameraForward) {
  const zero = (v) => !v || (!v[0] && !v[2]);
  let move = moveDir;
  if (zero(move)) move = zero(lastMoveDirection) ? cameraForward : lastMoveDirection;
  // stopped: the last facing - Vector3.zero before the first, which
  // SignedAngle reads as 0 (IL_4679, IL_46c5, IL_46ed)
  const moving = () => (stopped ? (lastMoveDirection ?? [0, 0, 0]) : move);
  let facing = cameraForward;
  if (!floating) {
    if (turnToView > 2) facing = cameraForward;
    else if (turnToView > 1) {
      if (animating) facing = cameraForward;
      else if (!sheathed || spellcasting) facing = cameraForward;
      else facing = moving();
    } else if (turnToView > 0) {
      facing = animating ? cameraForward : moving();
    } else facing = moving();
  }
  return [facing[0], 0, facing[2]];
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

/**
 * [IL] LoopIdleBillboard's speed modifier on the frame time
 * (IL_41d4-IL_422a): a run HALVES the frame (`* 0.5`), a crouch and a
 * sneak each DOUBLE it, and they multiply - a sneaking crouch walks at
 * a quarter speed. The port's clock had no such term: a running player
 * walked at 4 fps.
 */
export function speedMod({ running = false, crouching = false, sneaking = false } = {}) {
  let m = 1;
  if (running) m *= 0.5;
  if (crouching) m *= 2;
  if (sneaking) m *= 2;
  return m;
}

/**
 * [IL] Which frames of the walk land a foot (IL_4244-IL_4264):
 * `frameCurrent % 2 == 0` on foot, `% 4` in the saddle - so the
 * four-frame walk plays a step on 0 and 2, and the eight-frame ride on
 * 0 and 4. The port had read "2 and 4 of five" off the settings.
 */
export const isFootstepFrame = (frame, riding = false) => frame % (riding ? 4 : 2) === 0;

/**
 * [IL] `LoopIdleBillboard`'s table (IL_4328-IL_4499), and it is not the
 * ladder AUDIT-EOTB2 read off the settings. Transformed comes first
 * and answers with THREE tables only - a lycanthrope who moves is
 * MoveLycan whether or not the claws are up, and ReadyStance is never
 * consulted (IL_432c-IL_4360). Death is NOT here: it is a one-shot
 * LateUpdate starts (`PlayDeathAnimation`) and the loop never runs
 * again while `died` holds.
 *
 * On foot, `stopped` picks the idle column; `ReadyStance` gates the
 * readied tables with `> 0` when stopped and `> 1` when moving, so at
 * "When Idle" a player who draws a sword and walks is drawn walking
 * UNARMED - the setting doing its job. In the saddle the gallop is a
 * SPEED, not a run flag: `|MoveDirection.xz| > 10` (IL_43e9-IL_4429),
 * which every horse clears at a walk (DFU's ride base is 375 classic
 * units, 10.8 m/s at SPD 50) and a cart never does.
 */
export const GALLOP_SPEED = 10;
export function chooseTable(s = {}) {
  const {
    transformed = false, riding = false, stopped = true,
    sheathed = true, spellcasting = false, usingBow = false, moveSpeed = 0,
    readyStance = 2,
  } = s;
  if (transformed) {
    if (stopped) return sheathed ? 'IdleLycan' : 'IdleMeleeLycan';
    return 'MoveLycan';
  }
  if (stopped) {
    if (riding) return 'IdleHorse';
    if (readyStance > 0) {
      if (spellcasting) return 'IdleSpell';
      if (!sheathed) return usingBow ? 'IdleRanged' : 'IdleMelee';
    }
    return 'Idle';
  }
  if (riding) return moveSpeed > GALLOP_SPEED ? 'GallopHorse' : 'MoveHorse';
  if (readyStance > 1) {
    if (spellcasting) return 'MoveSpell';
    if (!sheathed) return usingBow ? 'MoveRanged' : 'MoveMelee';
  }
  return 'Move';
}

/** [IL] The two Death rows `InitializeStates` builds; `PlayDeathAnimation`
 *  (IL_5384-IL_53c2) picks by `IsTransformedLycanthrope`. */
export const deathTable = (s = {}) => (s.transformed ? 'DeathLycan' : 'Death');

/** The sprite the bundle ships for one state, in the vendored naming:
 *  `<archive>_<record>-<frame>`. */
export const spriteKey = (archive, record, frame) => `${archive}_${record}-${frame}`;

// ═══ [IL] THE ONE-SHOTS ═══════════════════════════════════════════════

/** Graphics.AttackStrings' options, by index (modsettings.json). */
export const ATTACK_STRINGS = Object.freeze(['None', 'Mirror', 'PingPong', 'Mixed']);
export const STRING = Object.freeze({ None: 0, Mirror: 1, PingPong: 2, Mixed: 3 });

/**
 * [IL] `GetMeleeAnimTickTime(frames)` (IL_545c-IL_549c): the FPS
 * weapon's own frame time (`FormulaHelper.GetMeleeWeaponAnimTime`, the
 * port's `characters/weaponStates.js`) times FIVE - the weapon's own
 * frame count - over the sprite clip's, so a six-frame swing lasts
 * exactly as long as the five-frame weapon animation it stands beside.
 */
export const meleeAnimTickTime = (animTime, frames) => (animTime * 5) / frames;

/** [IL] The fixed intervals the other doors use: the loose, the cast
 *  and the claw at 0.125 s a frame (IL_5190, IL_527c, IL_5308), the
 *  death at 0.5 (IL_539d, IL_53b7). */
export const RANGED_TICK = 0.125;
export const SPELL_TICK = 0.125;
export const LYCAN_TICK = 0.125;
export const DEATH_TICK = 0.5;

/**
 * [IL] `PlayMeleeAttackAnimation`'s choice of coroutine (IL_507c-IL_509f):
 * PingPong when the string is PingPong, or Mixed and `pingpongCount %
 * 4 == 0` - one swing in four, NOT a coin toss. Every ended clip under
 * Mixed bumps the count (IL_5dc7-IL_5dd9, IL_5f23-IL_5f35), so the
 * ping-pong lands on the first swing and every fourth after it.
 */
export const usesPingPong = (attackStrings, pingpongCount) =>
  attackStrings === STRING.PingPong || (attackStrings === STRING.Mixed && pingpongCount % 4 === 0);

/**
 * [IL] `PlayAnimationPingPongCoroutine`'s frame ORDER over `n` frames
 * (IL_5e45-IL_5f21): forward while `i < n / 2 + PingPongOffset`
 * (integer division), then `i - 1` back down while `i > 0` - so the
 * turn frame is shown TWICE and frame 0 is not returned to. Five
 * frames at the shipped offset of 1 are 0 1 2 2 1; the six-frame
 * swing is 0 1 2 3 3 2 1. An offset that empties the forward run
 * empties the clip.
 */
export function pingPongFrames(n, pingPongOffset = 1) {
  const out = [];
  const turn = Math.trunc(n / 2) + (pingPongOffset | 0);
  let i = 0;
  while (i < turn) { out.push(i); i++; }
  i--;
  while (i > 0) { out.push(i); i--; }
  return out;
}
export const forwardFrames = (n) => Array.from({ length: Math.max(0, n | 0) }, (_, i) => i);
/** [IL] `PlayAnimationHoldCoroutine`'s DRAW phase (IL_5fa5-IL_6020): from
 *  `n - 1` the frame is decremented BEFORE it is shown, so the string
 *  is drawn through n-2 ... 0 and held on 0; the release then plays
 *  0 ... n-1 forward (IL_60dc-IL_614b). */
export const holdDrawFrames = (n) => Array.from({ length: Math.max(0, (n | 0) - 1) }, (_, i) => n - 2 - i);
/** [IL] `PlayMeleeAttackAnimation`'s tick under PingPong (IL_50a3-IL_50c8):
 *  the melee tick over `(n / 2 + offset) * 2 - 1` frames - the length
 *  of the ping-pong itself - so the whole swing keeps its duration. */
export const pingPongTickFrames = (n, pingPongOffset = 1) => (Math.trunc(n / 2) + (pingPongOffset | 0)) * 2 - 1;

/**
 * [IL] The twelve tables `UpdateBillboard` mirrors under a Mirror or
 * Mixed string (IL_4938-IL_49a2), and the rule (IL_49a4-IL_49b9): only
 * the FRONT and BACK orientations (0 and 4), only while `mirrorCount`
 * is odd. The count climbs by one at the end of every AttackMelee or
 * AttackMeleeLycan clip (IL_5d89-IL_5db9) and resets on any other
 * (IL_5dc0), so the stance mirrors after a swing and the next swing
 * mirrors back - not "the whole clip flipped", which is what
 * AUDIT-EOTB2 read off the label.
 */
export const MIRROR_TABLES = Object.freeze(new Set([
  'Idle', 'IdleLycan', 'Move', 'MoveMelee', 'MoveSpell', 'MoveLycan', 'IdleMelee', 'IdleSpell', 'IdleMeleeLycan',
  'AttackMelee', 'AttackSpell', 'AttackMeleeLycan',
]));
export function mirrorFlips(attackStrings, table, orientation, mirrorCount) {
  if (attackStrings !== STRING.Mirror && attackStrings !== STRING.Mixed) return false;
  if (!MIRROR_TABLES.has(table)) return false;
  if (orientation !== 0 && orientation !== 4) return false;
  return mirrorCount % 2 === 1;
}

/** [IL] `Update`'s revert clock (IL_3cd1-IL_3d18): under Mirror or
 *  Mixed, once no clip is in flight, `mirrorCount` goes back to 0 after
 *  `MirrorTime` seconds - or a tenth of a second for the first-person
 *  billboard - and the sprite is repainted. A time of 0 never reverts. */
export const mirrorRevertTime = (mirrorTime, firstPerson) => (firstPerson ? 0.1 : mirrorTime);

/** [IL] `UpdateBillboardDelayed` waits THREE frames (`yield return null`
 *  three times, IL_5c6a-IL_5ca1) before the sprite changes. */
export const DELAYED_FRAMES = 3;
/** [IL] `orientationTime`, the .ctor's 0.1 (IL_5967): UpdateOrientation
 *  runs at most once a tenth of a second (IL_4534-IL_455c). */
export const ORIENTATION_TIME = 0.1;

/** AutoTogglePerspective's rows, in the settings' own order. */
export const AUTO_TOGGLE_ROWS = Object.freeze([
  'OnFoot', 'OnFootMelee', 'OnFootRanged', 'OnFootSpell', 'OnHorse', 'OnHorseReady', 'OnLycan',
]);
/** Its option labels: 0 leaves the view, 1 takes first person, 2 third. */
export const AUTO_TOGGLE = Object.freeze({ DontChange: 0, FirstPerson: 1, ThirdPerson: 2 });

/**
 * [IL] The camera's `LateUpdate` auto-toggle (IL_1847-IL_1c6e), which
 * is NOT one situation with a precedence - AUDIT-EOTB2's reading - but
 * three independent "just changed" blocks and one fan-out:
 *
 *   transformed and it changed  -> OnLycan;  untransformed and changed -> changed = true
 *   riding and it changed       -> OnHorse;  dismounted and changed    -> changed = true
 *   spell readied and changed   -> OnFootSpell; unreadied and changed  -> changed = true
 *   then, if changed: drawn ? (riding ? OnHorseReady : bow ? OnFootRanged : OnFootMelee)
 *                            : (riding ? OnHorse : OnFoot)
 *   else the same fan-out only when the sheathed flag changed, or
 *        stayed drawn while the bow flag changed
 *
 * So several rows can fire in one frame, a spellcasting rider takes
 * OnFootSpell, and OnHorseReady needs the WEAPON drawn - a readied
 * spell alone is not "ready". Returns the rows to apply, in the IL's
 * order; the caller applies each through ToggleOffset's `== 2 &&
 * !offset` / `== 1 && offset` pair. `prev` is the five `is*Previous`
 * fields; a null `prev` (the first frame) reads as all false, as the
 * mod's fields initialise.
 */
export function autoToggleRows(now, prev, { forced = false } = {}) {
  const p = prev ?? { transformed: false, riding: false, spellcasting: false, sheathed: false, ranged: false };
  const rows = [];
  let changed = forced;
  if (now.transformed) { if (p.transformed !== now.transformed) rows.push('OnLycan'); } else if (p.transformed !== now.transformed) changed = true;
  if (now.riding) { if (p.riding !== now.riding) rows.push('OnHorse'); } else if (p.riding !== now.riding) changed = true;
  if (now.spellcasting) { if (p.spellcasting !== now.spellcasting) rows.push('OnFootSpell'); } else if (p.spellcasting !== now.spellcasting) changed = true;
  const fan = () => (!now.sheathed
    ? (now.riding ? 'OnHorseReady' : now.ranged ? 'OnFootRanged' : 'OnFootMelee')
    : (now.riding ? 'OnHorse' : 'OnFoot'));
  if (changed) rows.push(fan());
  else if (!now.sheathed) {
    if (p.sheathed !== now.sheathed || p.ranged !== now.ranged) rows.push(fan());
  } else if (p.sheathed !== now.sheathed) rows.push(fan());
  return rows;
}
