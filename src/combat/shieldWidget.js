// @ts-check
// SW1 (2026-09-19, Mac: "This is the next mod I want to integrate 1:1"):
// SHIELD WIDGET 1.6 by RedRoryOTheGlen - ported 1:1.
//
// The sibling of WW1 (combat/weaponWidget.js), by the same author and
// built against the same DFU: one MonoBehaviour, `ShieldWidget`, that
// draws the classic shield sprite in the first-person view when a
// shield is in the left hand. Where the weapon clone REPLACED DFU's
// FPSWeapon, this one adds a surface DFU does not have at all - classic
// Daggerfall draws no shield - so nothing is hidden and nothing is
// cloned: it reads the weapon manager and draws beside it.
//
// The script ships only as a compiled DLL (24,574 bytes); the
// `ShieldWidget.cs` its manifest names is not in the bundle, so it was
// read off the IL method by method with a disassembler written for it.
// The record, with every method against its home here, is
// bible/05-Combat/Shield-Widget.md. IL offsets in the notes below cite
// that reading.
//
// THE SPRITES. 600 of them - four archives (112360 Buckler, 112361
// Round, 112362 Kite, 112363 Tower) x 30 records x 5 frames. A record
// is a MATERIAL GROUP plus a CONDITION TIER, which is what makes the
// shield visibly batter as it wears: ten material groups (0..9) and
// three tiers (+0 pristine, +10 worn, +20 battered) stacked into the
// thirty. They are the mod's own art and are read at play time FROM THE
// PLAYER'S OWN COPY OF THE MOD, never from this repository
// (combat/shieldWidgetAssets.js) - the doctrine
// vendor/weapon-widget/README.md records for the sibling's repaints.
//
// THE SHAPE HERE. createShieldWidget() is the component; the host owns
// one and feeds it what Unity handed the MonoBehaviour - the frame's
// dt, the equipped shield, the motor's answers, the look - through
// lateUpdate(); draw() is OnGUI's repaint. The two coroutines are
// GENERATORS driven on the sibling's clock: `yield seconds` is
// WaitForSeconds, `yield FRAME` is WaitForEndOfFrame. The channels the
// mod publishes - Position, Offset, Scale - are read by the sprite draw
// AND by the Morrowind arms, the same way WW1's are, which is what
// makes the shield move with that view rather than against it.
//
// CARRIED, because the port has the mods: Eye of the Beholder's
// `onToggleOffset` (the third-person toggle - `isInThirdPerson` hides
// the sprite) and PCAAO's `onAttackDamageCalculated` (the Recoil
// module's whole trigger; the settings pane names it "Vanilla Combat
// Event Handler", which is the message's own mod).
//
// NOT CARRIED, recorded: the FPS-models seam (GUID
// 41284af0-81c7-4630-bbc5-a976efa162a0, the `getAnimator` message and
// the `ShieldHand_` / `ShieldArm_` / `Unarmed_` animator states it
// plays a "...Recoil" clip on). That mod is not in the port. The arm's
// condition becomes its own switch the day it is integrated, as
// Meaner Monsters' unleveled-mobs arm does.

import { modSettingsOf } from '../systems/modSettings.js';
import { getInt } from '../systems/settings.js';
import { liveStat } from '../systems/statMods.js';
import { moveTowards, moveTowards2, snap, STEP_CONDITION } from './weaponWidget.js';
export { STEP_CONDITION };   // the same enum, one home (the sibling's)
import { shieldProtectedBodyParts } from './enemyEquipment.js';
// the classic 320x200 the sprite's scale is measured against (SetGuard
// IL 0x0d / 0x3b) - one home, the weapon sprite's
import { NATIVE_W, NATIVE_H } from './fpsWeapon.js';

export const SHIELD_WIDGET_VENDOR = 'shield-widget';

/** The four "when X" poses, in the settings' own order. */
export const SHIELD_POSE = Object.freeze({ Hide: 0, OffScreen: 1, Corner: 2, Ready: 3 });
/** Animation.Direction. */
export const ANIM_DIRECTION = Object.freeze({ Both: 0, ForwardOnly: 1, ReverseOnly: 2 });
/** Recoil.Condition. NOT the sibling's `RECOIL_CONDITION`: Weapon
 *  Widget's six are about what the PLAYER'S swing met, these six about
 *  what met the player's shield, and neither list is the other's. */
export const SHIELD_RECOIL_CONDITION = Object.freeze({
  HitOnShield: 0, MissOnShield: 1, AttackOnShield: 2, AnyHit: 3, AnyMiss: 4, AnyAttack: 5,
});

/** The four shield templates, and the archive each one's sprites live in. */
export const SHIELD_TEMPLATES = Object.freeze({ Buckler: 109, Round: 110, Kite: 111, Tower: 112 });
export const SHIELD_ARCHIVE_FIRST = 112360;
export const SHIELD_FRAMES = 5;
export const SHIELD_RECORDS = 30;
export const SHIELD_TEXTURE_COUNT = 600;   // InitializeShieldTextures (IL 0x00): `new Texture2D[600]`

/** PlayImpactSound (IL 0x00): `SoundClips.Parry1 + Random.Range(0, 9)`. */
export const PARRY_CLIP_FIRST = 428;
export const PARRY_CLIP_COUNT = 9;


const FRAME = 'frame';   // WaitForEndOfFrame

// ---- LoadSettings (IL 0x00-0x409): the fields, with the mod's own multipliers ----
/** The widget's settings from the store, exactly as LoadSettings derives
 *  them (Shield.Speed x5000, Bob.Length /100, SizeX/Y x2, SpeedMove x4,
 *  SpeedState x500, Shape x0.5, Inertia.Scale/Speed x500,
 *  ForwardDepth/ForwardSpeed x0.2, Recoil.Scale x2, Recoil.Speed x0.5,
 *  Animation.Speed as `1 - v * 0.5`). */
export function readShieldWidgetSettings(read = () => modSettingsOf(SHIELD_WIDGET_VENDOR)) {
  const s = read();
  const num = (k, d = 0) => { const v = Number(s[k]); return Number.isFinite(v) ? v : d; };
  return {
    enabled: !!s.Enabled,
    // [Shield]
    offsetX: num('Shield.OffsetHorizontal', 0.5), offsetY: num('Shield.OffsetVertical', 0.5),
    scale: num('Shield.Scale', 1), offsetSpeed: num('Shield.Speed', 1) * 5000,
    whenSheathed: s['Shield.WhenSheathed'] | 0, whenAttacking: s['Shield.WhenAttacking'] | 0,
    whenCasting: s['Shield.WhenCasting'] | 0, lockAspectRatio: !!s['Shield.LockAspectRatio'],
    conditionThresholdUpper: s['Shield.ConditionThresholdUpper'] | 0,
    conditionThresholdLower: s['Shield.ConditionThresholdLower'] | 0,
    // [Modules]
    bob: !!s['Modules.Bob'], inertia: !!s['Modules.Inertia'], animated: !!s['Modules.Animation'],
    stepTransforms: !!s['Modules.Step'], recoil: !!s['Modules.Recoil'],
    // [Bob]
    bobLength: (s['Bob.Length'] | 0) / 100, bobOffset: num('Bob.Offset'),
    bobSizeXMod: num('Bob.SizeX', 1) * 2, bobSizeYMod: num('Bob.SizeY', 1) * 2,
    moveSmoothSpeed: num('Bob.SpeedMove', 1) * 4, bobSmoothSpeed: num('Bob.SpeedState', 1) * 500,
    bobShape: (s['Bob.Shape'] | 0) * 0.5, bobWhileIdle: !!s['Bob.BobWhileIdle'],
    // [Inertia]
    inertiaScale: num('Inertia.Scale', 1) * 500, inertiaSpeed: num('Inertia.Speed', 1) * 500,
    inertiaForwardScale: num('Inertia.ForwardDepth', 1) * 0.2, inertiaForwardSpeed: num('Inertia.ForwardSpeed', 1) * 0.2,
    // [Animation] - Speed is INVERTED here: a bigger number is a shorter animation
    animationTime: 1 - num('Animation.Speed', 1) * 0.5, animationDirection: s['Animation.Direction'] | 0,
    // [Step]
    stepLength: s['Step.Length'] | 0, stepCondition: s['Step.Condition'] | 0,
    // [Recoil]
    recoilScale: num('Recoil.Scale', 1) * 2, recoilOffset: !!s['Recoil.Offset'],
    recoilSpeed: num('Recoil.Speed', 1) * 0.5, recoilCondition: s['Recoil.Condition'] | 0,
    // [Compatibility]
    scaleTextureFactor: Math.max(1, s['Compatibility.TextureScaleFactor'] | 0),
  };
}

// ---- UpdateShieldTextures (IL 0x0e-0x117): which of the 600 ----
/** The base of a template's 150 (IL 0x15 `switch` on TemplateIndex-109).
 *  A template that is not one of the four answers 0, as the `switch`'s
 *  own default does - the Buckler's block, which is why a modded shield
 *  with a strange template draws a buckler rather than nothing. */
export function shieldArchiveBase(templateIndex) {
  switch (templateIndex) {
    case SHIELD_TEMPLATES.Buckler: return 0;
    case SHIELD_TEMPLATES.Round: return 150;
    case SHIELD_TEMPLATES.Kite: return 300;
    case SHIELD_TEMPLATES.Tower: return 450;
    default: return 0;
  }
}

/** The material's record group, five texture slots apart (IL 0x51's
 *  `switch` on NativeMaterialValue). LEATHER, CHAIN AND SILVER SHARE
 *  GROUP 0 - leather and chain because the art has no plate for them,
 *  silver because the author's switch sends 514 to the same 0. Kept:
 *  it is what the shipped table says and a silver shield really does
 *  draw the leather art in the mod. */
export function shieldMaterialOffset(nativeMaterialValue) {
  switch (nativeMaterialValue) {
    case 0: return 0;       // Leather
    case 256: return 0;     // Chain
    case 512: return 5;     // Iron
    case 513: return 10;    // Steel
    case 514: return 0;     // Silver - the author's own 0
    case 515: return 15;    // Elven
    case 516: return 20;    // Dwarven
    case 517: return 25;    // Mithril
    case 518: return 30;    // Adamantium
    case 519: return 35;    // Ebony
    case 520: return 40;    // Orcish
    case 521: return 45;    // Daedric
    default: return 0;      // the `switch`'s fall-through: group 0
  }
}

/** The condition tier, ten records (fifty slots) apart (IL 0xcf). At or
 *  below the LOWER threshold the battered art, at or below the UPPER the
 *  worn art, else the pristine. */
export function shieldConditionOffset(conditionPercentage, upper, lower) {
  if (conditionPercentage <= lower) return 100;
  if (conditionPercentage <= upper) return 50;
  return 0;
}

/** The whole index, frame 0 - `indexCurrent` (IL 0xf4). */
export function shieldTextureIndex(item, upper, lower) {
  return shieldArchiveBase(item?.templateIndex ?? -1)
    + shieldMaterialOffset(item?.nativeMaterialValue ?? 0)
    + shieldConditionOffset(item?.conditionPercentage ?? 100, upper, lower);
}

/** InitializeShieldTextures' own walk (IL 0x10-0x70), as a name: the
 *  archive climbs every 30 records, the record every 5 frames. */
export function shieldTextureName(index) {
  const archive = SHIELD_ARCHIVE_FIRST + Math.floor(index / (SHIELD_RECORDS * SHIELD_FRAMES));
  const within = index % (SHIELD_RECORDS * SHIELD_FRAMES);
  return { archive, record: Math.floor(within / SHIELD_FRAMES), frame: within % SHIELD_FRAMES };
}

/** IsPartShielded (IL 0x00): the part is one the shield covers.
 *  `GetShieldProtectedBodyParts` is already the port's
 *  (combat/enemyEquipment.js), so this is the mod's loop over it. */
export function isPartShielded(item, bodyPart) {
  const parts = shieldProtectedBodyParts(item?.templateIndex ?? -1);
  for (let i = 0; i < parts.length; i++) if (parts[i] === bodyPart) return true;
  return false;
}

/** GetShieldAnimationGroup (IL 0x00) - the FPS-models animator's state
 *  prefix. The port has no such mod, so nothing calls this; it is here
 *  because the record names it and because the day that mod lands this
 *  is the row it needs. The Buckler is a HAND shield and the other
 *  three are ARM shields, which is the author's own split. */
export function shieldAnimationGroup(item) {
  if (!item) return 'Unarmed_';
  const t = item.templateIndex;
  if (t === SHIELD_TEMPLATES.Buckler) return 'ShieldHand_';
  if (t - SHIELD_TEMPLATES.Round <= 2 && t >= SHIELD_TEMPLATES.Round) return 'ShieldArm_';
  return 'Unarmed_';
}

// ---- Unity's pieces the mod calls, in the shapes this file uses ----
const v2 = (x, y) => [x, y];
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul2 = (a, k) => [a[0] * k, a[1] * k];
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mag2 = (a) => Math.hypot(a[0], a[1]);
const nonZero2 = (a) => a[0] !== 0 || a[1] !== 0;
const clamp = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));
const rectEq = (a, b) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * The component. `deps`:
 *   settings()      the fields (readShieldWidgetSettings), re-read per frame
 *   textures        size(index) -> { width, height } | null - the sprite sheet
 *                   (combat/shieldWidgetAssets.js), or null before it loads
 *   audio           playOneShot(clip, volume, pitch) - PlayImpactSound
 *   rolls           Random.value, for Random.Range(0, 9)
 *   handedness()    Settings Controls/Handedness == 1 (Awake IL 0xda: flipped)
 */
export function createShieldWidget({
  settings = readShieldWidgetSettings, textures = null, audio = null, rolls = Math.random,
  handedness = () => getInt('Controls', 'Handedness', 0, 3) === 1,
} = {}) {
  // .ctor (IL 0x00): the fields' resting values. The settings overwrite
  // most on the first LoadSettings; the ones that survive are the state.
  const w = {
    // Awake (IL 0x72): InitializeShieldTextures ends on
    // `shieldTexture = shieldTextures[0]`, so the sprite is never null
    // after it - the first LateUpdate repoints it at the real shield.
    shieldTexture: 0, indexCurrent: 0, frameCurrent: 0,
    shieldPositionCurrent: { x: 0, y: 0, width: 0, height: 0 },
    shieldPositionTarget: { x: 0, y: 0, width: 0, height: 0 },
    curAnimRect: { u0: 0, v0: 0, u1: 1, v1: 1 },
    screenRect: { x: 0, y: 0, width: NATIVE_W, height: NATIVE_H },
    screenRectLast: { x: 0, y: 0, width: NATIVE_W, height: NATIVE_H },
    weaponScaleX: 1, weaponScaleY: 1, weaponOffsetHeight: 0, weaponOffsetHeightLast: 0,
    // the published channels
    position: [0, 0], offset: [0, 0], scale: [1, 1],
    moveSmooth: 0, bobSmooth: [0, 0],
    inertiaCurrent: [0, 0], inertiaTarget: [0, 0], inertiaSpeedMod: 1,
    inertiaForwardCurrent: [0, 0], inertiaForwardTarget: [0, 0],
    recoilCurrent: [0, 0], recoiling: null, animating: null,
    attacked: false, sheathed: false, spelled: false,
    lastTemplate: -1, flipped: false, conditionPrevious: 0,
    attackDelayTimer: 0, attackDelayTime: 0.1, isInThirdPerson: false,
    started: false, awoke: false, s: settings(),
  };
  let ctx = null;

  const texSize = (i) => (textures?.size ? textures.size(i) : null);
  const texW = () => texSize(w.shieldTexture)?.width ?? 0;
  const texH = () => texSize(w.shieldTexture)?.height ?? 0;
  const haveTexture = () => w.shieldTexture >= 0 && !!texSize(w.shieldTexture);
  const liveSpeed = () => (ctx?.entity ? liveStat(ctx.entity, 'speed') : 50);

  // get_offsetSpeedLive (IL 0x00): LiveSpeed / 100 * offsetSpeed
  const offsetSpeedLive = () => liveSpeed() / 100 * w.s.offsetSpeed;
  // get_animationTimeLive (IL 0x00): animationTime / (LiveSpeed / 50)
  const animationTimeLive = () => w.s.animationTime / (liveSpeed() / 50);

  // ---- the sprite's width and height, the four setters share them ----
  const spriteW = () => texW() * w.s.scale * w.weaponScaleX / w.s.scaleTextureFactor;
  const spriteH = () => texH() * w.s.scale * w.weaponScaleY / w.s.scaleTextureFactor;
  /** SetGuard/SetAttack/SetBlock all open on this (IL 0x00-0x46). */
  function measure() {
    w.weaponScaleX = w.screenRect.width / NATIVE_W;
    w.weaponScaleY = w.s.lockAspectRatio ? w.weaponScaleX : w.screenRect.height / NATIVE_H;
  }

  // ---- PlayImpactSound (IL 0x00) ----
  function playImpactSound() {
    const clip = PARRY_CLIP_FIRST + Math.floor(rolls() * PARRY_CLIP_COUNT);
    audio?.playOneShot?.(clip, 0, 1.1);
  }

  // ---- the two coroutines ----
  /** AnimateShield (<AnimateShield>d__111 MoveNext): step frameCurrent
   *  from `start` to `end`, a fifth of `time` a frame, repointing the
   *  sprite each step. The DLL reads Time.unscaledTime here and DROPS
   *  it - a leftover with no effect, recorded and not carried. */
  function* animateShield(start, end, time) {
    const interval = time / 5;
    w.frameCurrent = start;
    while (w.frameCurrent !== end) {
      if (start > end) w.frameCurrent--; else w.frameCurrent++;
      w.shieldTexture = w.indexCurrent + w.frameCurrent;
      yield interval;
    }
    w.animating = null;
  }
  /** BlockCoroutine (<BlockCoroutine>d__110 MoveNext): the Recoil
   *  module's OFFSET arm - raise the shield into the block pose, wait
   *  for it to arrive, THEN take the kick and ring, hold half a second,
   *  and fall back to whatever stance the frame is in. */
  function* blockCoroutine(magnitude) {
    setBlock();
    while (!rectEq(w.shieldPositionCurrent, w.shieldPositionTarget)) yield FRAME;
    w.recoilCurrent = add2(w.recoilCurrent, [magnitude, magnitude]);
    playImpactSound();
    yield 0.5;
    if (w.attacked || ctx?.sheathed) setAttack(); else setGuard();
  }

  // the coroutine clock, WW1's (weaponWidget.js resume/stepSecondsWaits)
  function startAnimating(gen) { w.animating = { gen, wait: 0 }; resume(w.animating); }
  function startRecoiling(gen) { w.recoiling = { gen, wait: 0 }; resume(w.recoiling); }
  function resume(a) {
    let r;
    try { r = a.gen.next(); } catch (e) {
      console.warn('[shield widget] a coroutine threw', e);
      if (w.animating === a) w.animating = null;
      if (w.recoiling === a) w.recoiling = null;
      return;
    }
    if (r.done) {
      if (w.animating === a) w.animating = null;
      if (w.recoiling === a) w.recoiling = null;
      return;
    }
    a.wait = r.value === FRAME ? FRAME : Math.max(0, Number(r.value) || 0);
  }
  function stepSecondsWaits(dt) {
    for (const a of [w.animating, w.recoiling]) {
      if (!a || a.wait === FRAME) continue;
      a.wait -= dt;
      if (a.wait > 0) continue;
      a.wait = 0;
      resume(a);
    }
  }
  /** WaitForEndOfFrame: the host calls this after the frame's draw. */
  function endOfFrame() {
    for (const a of [w.animating, w.recoiling]) {
      if (!a || a.wait !== FRAME) continue;
      a.wait = 0;
      resume(a);
    }
  }

  // ---- the three stance setters ----
  /** SetGuard (IL 0x00-0x3b4): the resting pose - the shield held at
   *  the settings' own offsets. The DLL writes the rect FOUR times
   *  (animated/not x flipped/not) and all four are the same expression;
   *  only the frame reset and the x term differ, so it is written once
   *  here. */
  function setGuard() {
    measure();
    if (w.s.animated) {
      if (w.frameCurrent !== 0) {
        if (w.s.animationDirection === ANIM_DIRECTION.ForwardOnly) {
          w.frameCurrent = 0;
          w.shieldTexture = w.indexCurrent + w.frameCurrent;
        } else {
          startAnimating(animateShield(4, 0, animationTimeLive()));
        }
      }
    } else if (w.frameCurrent !== 0) {
      w.frameCurrent = 0;
      w.shieldTexture = w.indexCurrent + w.frameCurrent;
    }
    const r = w.screenRect;
    w.shieldPositionTarget = {
      x: w.flipped ? r.x + r.width - r.width * 0.5 * w.s.offsetX : r.x + r.width * 0.5 * w.s.offsetX,
      y: r.y + r.height - w.weaponOffsetHeight - r.height * 0.25 * w.s.offsetY,
      width: spriteW(), height: spriteH(),
    };
  }

  /** SetAttack (IL 0x00-0x560): where the shield goes when it is OUT of
   *  the way - sheathed, attacking or casting. Under the Animation
   *  module it plays the sprite out to frame 4 and holds the READY pose
   *  (the same rect SetGuard builds); without it, it slides to the
   *  Corner or Off-screen pose the active reason's setting names. Mode
   *  0 (Hide) sets no rect at all - OnGUI's gate is what hides it. */
  function setAttack() {
    measure();
    const r = w.screenRect;
    if (w.s.animated) {
      if (w.frameCurrent !== 4) {
        if (w.s.animationDirection === ANIM_DIRECTION.ReverseOnly) {
          w.frameCurrent = 4;
          w.shieldTexture = w.indexCurrent + w.frameCurrent;
        } else {
          startAnimating(animateShield(0, 4, animationTimeLive()));
        }
      }
      w.shieldPositionTarget = {
        x: w.flipped ? r.x + r.width - r.width * 0.5 * w.s.offsetX : r.x + r.width * 0.5 * w.s.offsetX,
        y: r.y + r.height - w.weaponOffsetHeight - r.height * 0.25 * w.s.offsetY,
        width: spriteW(), height: spriteH(),
      };
      return;
    }
    if (w.frameCurrent !== 0) {
      w.frameCurrent = 0;
      w.shieldTexture = w.indexCurrent + w.frameCurrent;
    }
    // the pose belongs to whichever reason is active, in the DLL's own
    // order: sheathed (neither casting nor attacking), then casting,
    // then attacking (IL 0x24e, 0x394)
    const poseFor = (mode) => (!w.spelled && !w.attacked && w.s.whenSheathed === mode)
      || (w.spelled && w.s.whenCasting === mode)
      || (w.attacked && w.s.whenAttacking === mode);
    const width = spriteW(), height = spriteH();
    if (poseFor(SHIELD_POSE.Corner)) {
      w.shieldPositionTarget = {
        x: w.flipped ? r.x + r.width : r.x,
        y: r.y + r.height - w.weaponOffsetHeight,
        width, height,
      };
      return;
    }
    if (poseFor(SHIELD_POSE.OffScreen)) {
      w.shieldPositionTarget = {
        x: w.flipped ? r.x + r.width + width : r.x - width,
        y: r.y + r.height - w.weaponOffsetHeight + height,
        width, height,
      };
    }
    // SHIELD_POSE.Hide and Ready leave the target where it stood
  }

  /** SetBlock (IL 0x00-0x3ac): the Recoil module's raised pose - the
   *  guard rect with offsetX forced to 1 and offsetY to 0.8, so the
   *  shield comes up in front of the eyes whatever the player's own
   *  offsets are.
   *
   *  KEPT BUG FOR BUG: the animated + LEFT-HANDED branch writes
   *  `shieldPositionCurrent`, where the other three write
   *  `shieldPositionTarget` (IL 0x172 against 0x219, 0x300, 0x3a7). A
   *  left-handed player with the Animation module on gets a block that
   *  SNAPS instead of easing - and BlockCoroutine, which waits for
   *  current to reach target, therefore falls straight through its
   *  wait. That is the mod's behaviour and it is what ships here. */
  function setBlock() {
    measure();
    if (w.s.animated) {
      if (w.frameCurrent !== 0) {
        if (w.s.animationDirection === ANIM_DIRECTION.ForwardOnly) {
          w.frameCurrent = 0;
          w.shieldTexture = w.indexCurrent + w.frameCurrent;
        } else {
          startAnimating(animateShield(4, 0, animationTimeLive()));
        }
      }
    } else if (w.frameCurrent !== 0) {
      w.frameCurrent = 0;
      w.shieldTexture = w.indexCurrent + w.frameCurrent;
    }
    const r = w.screenRect;
    const rect = {
      x: w.flipped ? r.x + r.width - r.width * 0.5 * 1.0 : r.x + r.width * 0.5 * 1.0,
      y: r.y + r.height - w.weaponOffsetHeight - r.height * 0.25 * 0.8,
      width: spriteW(), height: spriteH(),
    };
    if (w.s.animated && w.flipped) w.shieldPositionCurrent = rect;   // the author's slip, kept
    else w.shieldPositionTarget = rect;
  }

  /** RefreshShield (IL 0x00): sheathed or mid-swing is the away pose,
   *  anything else is the guard. */
  function refreshShield() {
    if (ctx?.sheathed || ctx?.attacking) setAttack(); else setGuard();
  }

  /** UpdateShieldTextures (IL 0x00-0x117): repoint the sheet at this
   *  shield's template, material and condition tier. */
  function updateShieldTextures(item) {
    w.conditionPrevious = item?.conditionPercentage ?? 0;
    w.indexCurrent = shieldTextureIndex(item, w.s.conditionThresholdUpper, w.s.conditionThresholdLower);
    w.shieldTexture = w.indexCurrent + w.frameCurrent;
  }

  // ---- HitShield (IL 0x00-0x293) ----
  /** The Recoil module's kick, and the condition watch that rides with
   *  it. The condition arm fires on a DOWNWARD crossing of either
   *  threshold and repoints the sheet - which is how a shield visibly
   *  batters mid-fight rather than only when it is re-equipped. */
  function hitShield(damage, item) {
    if (!w.s.recoil) return;
    const c = w.s.recoilCondition;
    let kick;
    if (c === SHIELD_RECOIL_CONDITION.HitOnShield || c === SHIELD_RECOIL_CONDITION.AnyHit) kick = damage > 0;
    else if (c === SHIELD_RECOIL_CONDITION.MissOnShield || c === SHIELD_RECOIL_CONDITION.AnyMiss) kick = damage < 1;
    else kick = true;   // AttackOnShield / AnyAttack: hit or miss, it rang
    if (kick) {
      const magnitude = 0.1 + damage * 0.01;
      if (w.s.recoilOffset && !w.attacked) {
        // the block arm rings inside the coroutine, once the shield is up
        startRecoiling(blockCoroutine(magnitude));
      } else {
        w.recoilCurrent = add2(w.recoilCurrent, [magnitude, magnitude]);
        playImpactSound();
      }
      // fpsModelsAnimator.Play(GetShieldAnimationGroup(item) + "Recoil", 1)
      // is the FPS-models seam, and the port has no such mod.
    }
    const cond = item?.conditionPercentage ?? 0;
    const upper = w.s.conditionThresholdUpper, lower = w.s.conditionThresholdLower;
    if ((cond <= upper && w.conditionPrevious > upper) || (cond <= lower && w.conditionPrevious > lower)) {
      updateShieldTextures(item);
      return;
    }
    w.conditionPrevious = cond;
  }

  /** OnAttackDamageCalculated (IL 0x00-0x68) - PCAAO's message. The
   *  first three Recoil conditions ask whether the shield covers the
   *  part that was struck; the last three do not. */
  function onAttackDamageCalculated({ targetIsPlayer = false, bodyPart = -1, damage = 0, item = null } = {}) {
    if (!targetIsPlayer || !w.s.recoil) return;
    if (!item || !item.isShield) return;
    if (w.s.recoilCondition > SHIELD_RECOIL_CONDITION.AttackOnShield) { hitShield(damage, item); return; }
    if (isPartShielded(item, bodyPart)) hitShield(damage, item);
  }

  // ---- GetShieldRect (IL 0x00-0x239) ----
  /** The rect the sprite draws into: the eased position, then the
   *  frame's three channels, then the clamps that keep it on screen and
   *  the Step module's snap. */
  function getShieldRect() {
    const r = { ...w.shieldPositionCurrent };
    r.x += w.position[0];
    r.y += w.position[1];
    r.width += r.width * w.scale[0];
    r.height += r.height * w.scale[1];
    r.x -= r.width * 0.5;
    r.y -= r.height * 0.5;
    r.x += r.width * w.offset[0];
    r.y += r.height * w.offset[1];
    // the large HUD's own height, when it is docked or offsets the weapon
    const hud = w.weaponOffsetHeight;
    const sr = w.screenRect;
    r.y = clamp(r.y, sr.height - r.height - hud, sr.height);
    if (w.s.animated) {
      // the animated sprite slides in from the screen's edge, so its x
      // is clamped to that edge rather than to the whole width
      r.x = w.flipped
        ? clamp(r.x, sr.x + sr.width - r.width, sr.x + sr.width)
        : clamp(r.x, -r.width, 0);
    }
    if (w.s.stepTransforms) {
      const step = w.s.stepLength * (sr.height / 64);
      r.x = snap(r.x, step);
      r.y = snap(r.y, step);
    }
    return r;
  }

  // ---- LateUpdate (IL 0x00-0x95d) ----
  /** The frame. `ctx`:
   *    dt, time                the frame's delta and Unity's Time.time
   *    screenRect              DaggerfallUI.CustomScreenRect, or the canvas
   *    largeHudHeight          HUDLarge.ScreenHeight when it is docked or
   *                            offsets the weapon, else 0
   *    item                    the LEFT-HAND item, or null
   *    attacking, sheathed     the weapon manager's two answers
   *    castingAnim, hasReadySpell
   *    equipCountdownLeftHand, isClimbing, isPaused, loadInProgress
   *    entity                  for LiveSpeed
   *    motor { speed, baseSpeed, isGrounded, isCrouching, isRiding,
   *            isStandingStill, moveDirectionLocal: [x, y, z] }
   *    look  { x, y, cursorActive, swingAction } */
  function lateUpdate(next) {
    ctx = next || null;
    w.s = settings();
    const dt = Math.max(0, Number(ctx?.dt) || 0);
    stepSecondsWaits(dt);
    if (!w.started) { w.flipped = !!handedness(); w.curAnimRect = w.flipped ? { u0: 1, v0: 0, u1: 0, v1: 1 } : { u0: 0, v0: 0, u1: 1, v1: 1 }; w.started = true; }

    // the three channels are a FRAME's and open at nothing (IL 0x01)
    w.position = [0, 0]; w.offset = [0, 0]; w.scale = [0, 0];
    if (!haveTexture() || !ctx?.entity) return;

    const attacking = !!ctx.attacking;
    const item = ctx.item ?? null;
    // no shield in the hand: forget the template so the next one re-reads
    if (!item || !item.isShield) { w.lastTemplate = -1; return; }
    if ((Number(ctx.equipCountdownLeftHand) || 0) > 0 || ctx.isClimbing || ctx.isPaused || ctx.loadInProgress) return;

    const sr = ctx.screenRect ?? { x: 0, y: 0, width: NATIVE_W, height: NATIVE_H };
    w.screenRect = { x: sr.x ?? 0, y: sr.y ?? 0, width: sr.width ?? NATIVE_W, height: sr.height ?? NATIVE_H };
    w.weaponOffsetHeight = Math.trunc(Number(ctx.largeHudHeight) || 0);
    if (!rectEq(w.screenRect, w.screenRectLast) || w.weaponOffsetHeight !== w.weaponOffsetHeightLast) refreshShield();
    w.screenRectLast = { ...w.screenRect };
    w.weaponOffsetHeightLast = w.weaponOffsetHeight;

    // the template KEY is template + material added together (IL 0x1a0) -
    // the author's own shorthand, so two shields that happen to sum the
    // same never re-read. Kept: nothing in the four templates and the
    // twelve materials collides.
    const template = (item.templateIndex | 0) + (item.nativeMaterialValue | 0);
    if (w.lastTemplate !== template) {
      updateShieldTextures(item);
      refreshShield();
      w.lastTemplate = template;
      w.attacked = false; w.sheathed = false; w.spelled = false;
    }
    // Awake's tail (IL 0xb9): the shield OPENS in its stance rather than
    // sliding into it from the screen's origin. Awake ran before any
    // LateUpdate in the mod; here it is the first frame that knows both
    // a screen rect and a shield.
    if (!w.awoke) { w.awoke = true; w.shieldPositionCurrent = { ...w.shieldPositionTarget }; }

    // ---- the three states, each with its own pose (IL 0x1e0-0x35f) ----
    const away = (mode) => mode === SHIELD_POSE.OffScreen || mode === SHIELD_POSE.Corner;
    if (attacking) {
      if (!w.attacked) {
        w.attacked = true;
        if (away(w.s.whenAttacking)) setAttack(); else setGuard();
        w.attackDelayTimer = 0;
      }
    } else if (w.attacked) {
      // the swing's tail: the shield waits a tenth of a second before it
      // comes back, so a combo does not flap it
      if (w.attackDelayTimer > w.attackDelayTime) { w.attacked = false; refreshShield(); }
      else w.attackDelayTimer += dt;
    }

    const casting = !!ctx.castingAnim || !!ctx.hasReadySpell;
    if (casting && !attacking) {
      if (!w.spelled) {
        w.spelled = true;
        if (away(w.s.whenCasting)) setAttack(); else setGuard();
      }
    } else if (!attacking && w.spelled) { w.spelled = false; refreshShield(); }

    if (ctx.sheathed && !casting) {
      if (!w.sheathed) {
        w.sheathed = true;
        if (away(w.s.whenSheathed)) setAttack(); else setGuard();
      }
    } else if (!casting && w.sheathed) { w.sheathed = false; refreshShield(); }

    // ---- the ease (IL 0x35f) ----
    const eased = moveTowards2(
      [w.shieldPositionCurrent.x, w.shieldPositionCurrent.y],
      [w.shieldPositionTarget.x, w.shieldPositionTarget.y],
      dt * offsetSpeedLive());
    w.shieldPositionCurrent = {
      x: eased[0], y: eased[1],
      width: w.shieldPositionTarget.width, height: w.shieldPositionTarget.height,
    };

    const motor = ctx.motor ?? {};
    const baseSpeed = Number(motor.baseSpeed) || 1;
    const speedRatio = (Number(motor.speed) || 0) / baseSpeed;
    const settled = !attacking && rectEq(w.shieldPositionCurrent, w.shieldPositionTarget) && !w.animating;

    // ---- BOB (IL 0x401-0x5ff) ----
    if (w.s.bob) {
      let bobTarget = [0, 0];
      if (settled) {
        const grounded = motor.isGrounded ? 1 : 0;
        w.moveSmooth = moveTowards(w.moveSmooth, grounded, dt * w.s.moveSmoothSpeed);
        let s = speedRatio;
        if (motor.isCrouching) s *= 0.5;
        if (motor.isRiding) s *= 0.5;
        if (motor.isStandingStill) s = w.s.bobWhileIdle ? 0.1 : 0;
        const freq = baseSpeed * 1.25 * s * w.s.bobLength;
        const freq2 = freq * 2;
        const amp = 0.01;
        const size = [w.screenRect.width * amp * s * w.s.bobSizeXMod, w.screenRect.height * amp * s * w.s.bobSizeYMod];
        let sx = 1; const sy = 1;
        if (w.flipped) sx *= -1;
        // with Inertia on and Animation off the horizontal swing is the
        // inertia's to give, so the bob drops its own
        if (w.s.inertia && !w.s.animated) sx = 0;
        const time = Number(ctx.time) || 0;
        bobTarget = [
          (sx + Math.sin(w.s.bobOffset + time * freq)) * -size[0],
          (sy - Math.sin(w.s.bobOffset + w.s.bobShape + time * freq2)) * size[1],
        ];
      }
      w.bobSmooth = mul2(moveTowards2(w.bobSmooth, bobTarget, dt * w.s.bobSmoothSpeed), w.moveSmooth);
      w.position = add2(w.position, w.bobSmooth);
    }

    // ---- INERTIA (IL 0x600-0x875) ----
    if (w.s.inertia) {
      if (!settled || w.frameCurrent !== 0) {
        w.inertiaCurrent = [0, 0]; w.inertiaTarget = [0, 0];
        w.inertiaForwardCurrent = [0, 0]; w.inertiaForwardTarget = [0, 0];
      } else {
        const md = motor.moveDirectionLocal ?? [0, 0, 0];
        const mx = clamp((md[0] ?? 0) / 10, -1, 1);
        const my = motor.isGrounded ? 0 : clamp((md[1] ?? 0) / 10, -1, 1);
        const mz = clamp((md[2] ?? 0) / 10, -1, 1);
        const look = ctx.look ?? {};
        // while the mouse is DRAWING A SWING its motion is the swing and
        // not the view, so the look is left out of the lean
        if (look.cursorActive || look.swingAction) {
          w.inertiaTarget = [-mx * 0.5 * w.s.inertiaScale, 0];
        } else {
          w.inertiaTarget = [
            ((Number(look.x) || 0) + mx) * -0.5 * w.s.inertiaScale,
            ((Number(look.y) || 0) + my) * 0.5 * w.s.inertiaScale,
          ];
        }
        w.inertiaSpeedMod = dist2(w.inertiaCurrent, w.inertiaTarget) / (w.s.inertiaScale || 1e-6);
        const mult = nonZero2(w.inertiaTarget) ? 3 : 1;
        w.inertiaCurrent = moveTowards2(w.inertiaCurrent, w.inertiaTarget, dt * w.s.inertiaSpeed * w.inertiaSpeedMod * mult);
        w.position = add2(w.position, w.inertiaCurrent);

        // the forward lean reads the OLD target for its multiplier and
        // then overwrites it - the author's order, kept
        const fmult = nonZero2(w.inertiaForwardTarget) ? 3 : 1;
        w.inertiaForwardTarget = [mz * w.s.inertiaForwardScale, mz * w.s.inertiaForwardScale];
        w.inertiaForwardCurrent = moveTowards2(w.inertiaForwardCurrent, w.inertiaForwardTarget, dt * w.s.inertiaForwardSpeed * fmult);
        w.scale = add2(w.scale, w.inertiaForwardCurrent);
      }
    }

    // ---- RECOIL (IL 0x876-0x955) ----
    if (w.s.recoil) {
      if (!settled || w.frameCurrent !== 0) { w.recoilCurrent = [0, 0]; return; }
      if (nonZero2(w.recoilCurrent)) {
        const mag = mag2(w.recoilCurrent) / 0.5;
        w.recoilCurrent = moveTowards2(w.recoilCurrent, [0, 0], dt * w.s.recoilSpeed * mag);
      }
      const v = mul2(w.recoilCurrent, w.s.recoilScale);
      w.scale = add2(w.scale, [clamp(v[0], 0, 0.5), clamp(v[1], 0, 0.5)]);
    }
  }

  // ---- OnGUI (IL 0x00-0x1c2) ----
  /** Should the sprite draw this frame, and into what? Answers null
   *  when the mod would draw nothing.
   *
   *  THE GATE LADDER, in the DLL's own order. Each of the three
   *  reasons - sheathed, attacking, casting - hides the sprite two
   *  ways: WITHOUT the Animation module when its pose is Hide, and WITH
   *  it when the pose is Hide or Off-screen AND the slide has already
   *  finished (`animating` is what keeps it on screen while it leaves).
   *  The sheathed rung also yields to the other two, because a sheathed
   *  player who is casting is casting. */
  function drawRect() {
    if (!haveTexture() || !ctx?.entity || w.isInThirdPerson) return null;
    const item = ctx.item ?? null;
    if (!item || !item.isShield) return null;
    if ((Number(ctx.equipCountdownLeftHand) || 0) > 0) return null;
    if (ctx.isClimbing || ctx.isPaused || ctx.loadInProgress) return null;

    const a = w.s.animated, animating = !!w.animating;
    const hidden = (mode) => (a ? (mode === SHIELD_POSE.Hide || mode === SHIELD_POSE.OffScreen) && !animating
      : mode === SHIELD_POSE.Hide);
    if (w.sheathed && !w.attacked && !w.spelled && hidden(w.s.whenSheathed)) return null;
    if (w.attacked && hidden(w.s.whenAttacking)) return null;
    if (w.spelled && hidden(w.s.whenCasting)) return null;
    // `if (fpsModels) return;` - that mod draws the shield on its own
    // models instead, and the port has none.
    return getShieldRect();
  }

  /** The repaint. `paint(textureIndex, rect, uv)` is the host's blit -
   *  DaggerfallUI.DrawTextureWithTexCoords, at the weapon's own tint. */
  function draw(paint) {
    const r = drawRect();
    if (!r || typeof paint !== 'function') return false;
    paint(w.shieldTexture, r, w.curAnimRect);
    return true;
  }

  /** The channels for the Morrowind arms, as WW1 publishes its own: the
   *  frame's Position and Scale ride the arms' composite so the shield
   *  bobs, leans and recoils WITH that view instead of against it. */
  function armsTransform(base) {
    if (!base) return base;
    const out = { ...base };
    out.x += w.position[0];
    out.y += w.position[1];
    out.width += out.width * w.scale[0];
    out.height += out.height * w.scale[1];
    return out;
  }

  return {
    lateUpdate, draw, drawRect, endOfFrame, onAttackDamageCalculated, armsTransform,
    /** Eye of the Beholder's `onToggleOffset` (ModCompatibilityChecking IL 0x00). */
    setThirdPerson(v) { w.isInThirdPerson = !!v; },
    /** Awake (IL 0xb3): the stance the shield opens on. */
    refresh: refreshShield,
    get position() { return [w.position[0], w.position[1]]; },
    get scale() { return [w.scale[0], w.scale[1]]; },
    get offset() { return [w.offset[0], w.offset[1]]; },
    get textureIndex() { return w.shieldTexture; },
    get frame() { return w.frameCurrent; },
    get indexCurrent() { return w.indexCurrent; },
    get flipped() { return w.flipped; },
    get animating() { return !!w.animating; },
    get recoiling() { return !!w.recoiling; },
    get rect() { return { ...w.shieldPositionCurrent }; },
    get target() { return { ...w.shieldPositionTarget }; },
    get settings() { return w.s; },
    _w: w,
  };
}
