// WW1 (2026-09-14, Mac: "This is our next mod I want to add 1:1 while
// also having it work with morrowind's first person view"): WEAPON
// WIDGET 1.6 by RedRoryOTheGlen - FPSWeaponClone, ported 1:1.
//
// The mod is one MonoBehaviour, FPSWeaponClone, that runs BESIDE DFU's
// FPSWeapon: it hides the original every frame (ScreenWeapon.ShowWeapon
// = false at the end of LateUpdate) and draws the classic weapon sprite
// itself, with nine modules - Swings, Ambidexterity, Offset, Bob,
// Inertia, Step, DoubleScaleTextures, TrueTextureSize, Recoil - each a
// switch in its modsettings. The original keeps running and the clone
// READS it: GetCurrentFrame / GetHitFrame / IsAttacking / WeaponState
// drive the clone's own timing, which is why the swings below wait on
// the port's machine (characters/weaponStates.js) exactly where the
// clone waits on FPSWeapon.
//
// The script ships only as a compiled DLL (42,496 bytes); the
// `FPSWeaponClone.cs` its manifest names is not in the bundle, so it
// was read off the IL method by method (the record, with every method
// against its home here, is bible/05-Combat/Weapon-Widget.md). IL
// offsets in the notes below cite that reading.
//
// THE SHAPE HERE. createWeaponWidget() is the component; the rig
// (combat/weaponRig.js) owns one per host and feeds it what Unity
// handed the clone - the frame's dt, the machine, the motor's answers,
// the frame's look - through lateUpdate(); draw() is OnGUI's repaint.
// The three animation coroutines are GENERATORS driven by the same
// clock Unity drives a coroutine on: `yield seconds` is WaitForSeconds,
// `yield FRAME` is WaitForEndOfFrame, and the driver resumes one on the
// frame its wait has elapsed (the remainder is not carried, as Unity's
// is not). The channels the mod publishes - Position, Scale, Offset -
// are read by the sprite draw AND by the Morrowind arms
// (fpArm.setScreenTransform), which is what makes it work with the
// Morrowind first-person view: the same numbers move the arms'
// composite the way they move the sprite.
//
// NOT CARRIED, recorded: the mod's cross-mod seams (Tome of Battle's
// reach and swing key, FPS Models' animator, the registerCustomWeapon
// message, Vanilla Combat Event Handler's onToggleOffset) - the port
// has none of those mods; and five DUPLICATES of laws the port already
// runs once, which the clone re-runs beside the original where here
// there is only the one - the bow's out-of-arrows sheathe, the
// unsheathe sound, the vanilla weapon's own hide, the combat-voice roll
// at the release (hostCombat.playerAttackGrunt is FPSWeapon's own, on
// the machine's hit) and the transformed lycanthrope's move-sound clock
// (LycanthropyEffect's, systems/lycanthropy.js LM1). The clone's swing
// sound at its release IS carried: it is the mod's moment, and the
// hosts' whiff on a miss is DFU's other one, as in DFU with the mod.

// WW-LAB: the settings and the three movement modules live in
// weaponWidgetMotion.js now - the arithmetic with no component around
// it, which the gun lab imports without dragging this file's world in.
// Re-exported here because this is still the mod's front door.
import {
  readWidgetSettings, moveTowards, moveTowards2, roundHalfEven, snap,
  offsetStep, bobStep, inertiaStep, widgetTransformRect,
} from './weaponWidgetMotion.js';
export {
  WEAPON_WIDGET_VENDOR, WINDUP, RECOVERY, BOB_SHAPE, STEP_CONDITION, RECOIL_CONDITION, MISS_VFX_AT,
  readWidgetSettings, moveTowards, moveTowards2, roundHalfEven, snap,
  offsetStep, bobStep, inertiaStep, widgetTransformRect,
} from './weaponWidgetMotion.js';
import { getBool, getInt } from '../systems/settings.js';
import { liveStat } from '../systems/statMods.js';
import {
  getMeleeWeaponAnimTime, getBowCooldownTime, CLASSIC_UPDATE_INTERVAL, HIT_FRAME_MELEE, HIT_FRAME_BOW, MELEE_NUM_FRAMES, BOW_NUM_FRAMES,
} from '../characters/weaponStates.js';
import { WEAPON_TYPES, STATE_INDEX, ALIGN, NATIVE_W, NATIVE_H, WEAPON_FILE, weaponTypeForItem } from './fpsWeapon.js';
import { weaponOffsetHeight } from '../ui/hudLarge.js';
import { unionDrawRect } from './gunSheet.js';   // FIELD-GUN11: the gun's box -> the drawn box
import { swingSoundFor, SOUND } from '../systems/soundClips.js';
import { isEnchanted } from '../systems/inventory.js';
import { getItemHands } from '../systems/equip.js';
import { ITEM_HANDS } from '../characters/equipTable.js';
import { widgetTextureName, weaponWidgetImage } from './weaponWidgetAssets.js';

import { WINDUP, RECOVERY, RECOIL_CONDITION, MISS_VFX_AT } from './weaponWidgetMotion.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const inverseLerp = (a, b, v) => (a === b ? 0 : clamp((v - a) / (b - a), 0, 1));
const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);

/** PlaySheatheSound (IL 0x31b0): SoundClips 417, the one clip the mod
 *  adds that DFU's own weapon never plays. */
export const SHEATHE_CLIP = 417;
/** DoClang / DoThud (IL 0xe0c, 0xf58): TEXTURE.380 record 2, one-shot
 *  at 20 frames a second, twice its size; the CLANG's material is made
 *  to glow. */
export const MISS_VFX = Object.freeze({ archive: 380, record: 2, fps: 20, scale: 2 });
/** The states the mirror applies to (FPSWeapon's own three, UpdateWeapon 0x2435-0x244d, AlignRight 0x2901-0x2919). */
const MIRROR_STATES = Object.freeze([STATE_INDEX.Idle, STATE_INDEX.StrikeDown, STATE_INDEX.StrikeUp]);
/** WeaponStates, by the index the mod switches on. */
const S = STATE_INDEX;
const T = WEAPON_TYPES;
const FRAME = 'frame';   // WaitForEndOfFrame

/** GetAnimTickTime (IL 0x2a90): the melee tick is FormulaHelper's
 *  GetMeleeWeaponAnimTime (the port's, off the live speed); a bow's is
 *  the classic 0.0625. With Swings on the tick is REMAPPED, the bow's
 *  too (the IL's bow branch lands on the `swing` test): InverseLerp(0,
 *  2, t / 0.198979) into Lerp(0.045918, 0.352041) - the same 0.199s at
 *  SPD 50, 0.046 at SPD 115, 0.352 at SPD -15 and below (the remap's
 *  [0, 2] is the tick's [0, 0.398]; SPD 0 lands at 0.317, the bow's
 *  0.0625 at 0.094 - which only the field carries, the bow coroutine
 *  ticking the classic 0.0625 itself). */
export function widgetAnimTickTime(weaponType, liveSpeed, swing) {
  let t = CLASSIC_UPDATE_INTERVAL;
  if (weaponType !== T.Bow) t = getMeleeWeaponAnimTime(liveSpeed);
  if (!swing) return t;
  return lerp(0.045917998999357224, 0.35204100608825684, inverseLerp(0, 2, t / 0.19897900521755219));
}

/** WeaponBasics.GetWeaponFilename (the mod's LoadWeaponAtlas reads it
 *  for the texture name); the port's table. */
const weaponFileName = (weaponType) => WEAPON_FILE[weaponType] ?? null;
const numFrames = (isBow, stateName) => (isBow ? BOW_NUM_FRAMES : MELEE_NUM_FRAMES)[stateName] ?? 5;
const STATE_NAMES = Object.keys(STATE_INDEX);

/**
 * The component. `deps`:
 *   settings()      the fields (readWidgetSettings), re-read per frame
 *   audio           playOneShot(clip, volume, pitch) - the sheathe clip, the swing, the voice
 *   rolls           Random.value
 *   missEffect(kind, pos, opts)   DoClang / DoThud's billboard, or null (a host without effects)
 *   envHit(reach)   CheckForEnvDamage's sphere cast: the hit point within reach along the look, or null
 *   handedness()    Settings Controls/Handedness == 1 (Awake: leftHanded)
 *   bowDrawback()   Settings Controls/BowDrawback
 */
export function createWeaponWidget({
  settings = readWidgetSettings, audio = null, rolls = Math.random, missEffect = null, envHit = null,
  handedness = () => getInt('Controls', 'Handedness', 0, 3) === 1, bowDrawback = () => getBool('Controls', 'BowDrawback'),
} = {}) {
  // .ctor (IL 0x361c): the fields' resting values
  const w = {
    showWeapon: true,
    position: [0, 0], scale: [1, 1], offset: [0, 0],     // Position / Scale / Offset - the published channels
    weaponState: S.Idle, currentFrame: 0, currentWeaponType: T.None, currentMetalType: -1, currentTemplateIndex: -1,
    weaponPosition: { x: 0, y: 0, w: 0, h: 0 }, curAnimRect: { u0: 0, v0: 0, u1: 1, v1: 1 },
    weaponOffsetHeight: 0, screenRect: { x: 0, y: 0, width: NATIVE_W, height: NATIVE_H },
    weaponScaleX: 1, weaponScaleY: 1, animTickTime: 0,
    lastSheathed: null, lastDoubleScale: false, lastEnchanted: false,
    curCustomTexture: null, curCustomSize: null,
    animating: null, animatingCancel: false, hasCurrentAttackHit: false,
    offsetCurrent: [0, 0], offsetTarget: [0, 0],
    moveSmooth: 0, bobSmooth: [0, 0], inertiaCurrent: [0, 0], inertiaTarget: [0, 0], inertiaSpeedMod: 1,
    inertiaForwardCurrent: [0, 0], inertiaForwardTarget: [0, 0],
    leftHanded: false, flipHorizontal: false, isInThirdPerson: false, time: 0,
    specificWeapon: null, art: null, s: settings(),
  };
  let ctx = null;   // the frame's inputs (lateUpdate's argument), read by the coroutines
  const machineStateIndex = () => STATE_INDEX[ctx?.machine?.state ?? 'Idle'] ?? 0;
  const machineIsAttacking = () => !!ctx?.machine && ctx.machine.state !== 'Idle';
  const machineFrame = () => ctx?.machine?.frame ?? 0;
  const hitFrame = () => (ctx?.machine?.isBow ? HIT_FRAME_BOW : HIT_FRAME_MELEE);
  const liveSpeed = () => (ctx?.entity ? liveStat(ctx.entity, 'speed') : 50);
  const anims = () => w.art?.anims ?? null;
  const usingRightHand = () => ctx?.usingRightHand !== false;
  const sheathed = () => !!ctx?.sheathed;

  // get_offsetSpeedLive (IL 0x284): LiveSpeed / 100 * offsetSpeed
  const offsetSpeedLive = () => liveSpeed() / 100 * w.s.offsetSpeed;

  // ---- the overrides (IL 0x3440-0x360f) ----
  /** OverrideAlignment: with the setting on, a StrikeDown or StrikeUp
   *  of every weapon but a bow, bare hands, a dagger or a warhammer is
   *  drawn CENTRED (AlignCenter's edge-at-the-middle arm). */
  function overrideAlignment() {
    if (!w.s.swingAlignmentOverride || !w.specificWeapon) return false;
    if (w.weaponState !== S.StrikeDown && w.weaponState !== S.StrikeUp) return false;
    const t = w.currentWeaponType;
    return !(t === T.Bow || t === T.Melee || t === T.Dagger || t === T.Dagger_Magic || t === T.Warhammer || t === T.Warhammer_Magic);
  }
  /** CheckForMirrorOverride: a two-handed weapon mirrored by its family's Miscellaneous switch. */
  function mirrorOverride() {
    if (!w.specificWeapon) return false;
    // IL 0x3528: `GetItemHands() == 2`, which is ItemHands.LeftOnly - a
    // two-handed weapon answers Both (4), so the three mirrors below
    // fire on nothing a hand can hold; kept exactly as the mod has it.
    if (getItemHands(w.specificWeapon) !== ITEM_HANDS.LeftOnly) return false;
    const t = w.currentWeaponType;
    if (w.s.mirrorTwoHandedSwords && (t === T.LongBlade || t === T.LongBlade_Magic)) return true;
    if (w.s.mirrorTwoHandedAxes && (t === T.Battleaxe || t === T.Battleaxe_Magic)) return true;
    if (w.s.mirrorTwoHandedBlunts && (t === T.Staff || t === T.Staff_Magic || t === T.Warhammer || t === T.Warhammer_Magic || t === T.Flail || t === T.Flail_Magic)) return true;
    return false;
  }
  /** CheckForOffsetOverride: everything but bare hands and the werecreature leans into its swing. */
  const offsetOverride = () => !(w.currentWeaponType === T.Melee || w.currentWeaponType === T.Werecreature);
  /** CheckForRecoveryOverride: a StrikeUp of anything but a dagger recovers in reverse. */
  const recoveryOverride = () => w.weaponState === S.StrikeUp && !(w.currentWeaponType === T.Dagger || w.currentWeaponType === T.Dagger_Magic);

  // ---- the sounds (IL 0x3144-0x33ab) ----
  function playSheatheSound() { audio?.playOneShot?.(SHEATHE_CLIP, 1, 1); }
  /** PlaySwingSound: the weapon's swing clip at volume 1.1 (pitch 1 x AttackSpeedScale, which nothing here scales). */
  function playSwingSound() { audio?.playOneShot?.(swingSoundFor(w.specificWeapon), 1.1, 1); }

  // ---- ChangeWeaponState (IL 0x107c) ----
  function changeWeaponState(state) {
    w.weaponState = state;
    if (ctx?.weaponType === T.Bow && state === S.Idle) w.currentFrame = 0;
    // WW4b (Mac's curated fix, 2026-09-16): THE PORT'S OWN re-entry. The
    // IL resets only a bow's Idle; with Recovery = Hide (the default) the
    // Swings coroutine leaves a melee frame at -1 and finishSwing's
    // slide-in from below (offsetCurrent = [x, 1]) needs a DRAWABLE frame.
    // The mod's clone gets its idle frame back from the original it
    // shadows; this clone shadows a machine that publishes no frame for
    // Idle, so the idle stayed at -1 - invisible once WW4 stopped the
    // classic sprite standing in for frame -1. Only the stuck case is
    // touched: an Idle already holding a real frame (Recovery = LastFrame,
    // the other changeWeaponState(S.Idle) callers) is left as it was.
    else if (state === S.Idle && w.currentFrame < 0) w.currentFrame = 0;
    if (state !== S.Idle) { w.offsetCurrent = [0, 0]; w.offsetTarget = [0, 0]; }
    updateWeapon();
  }

  // ---- LoadWeaponAtlas (IL 0x29a8): the art is the rig's; the clone's own state ----
  function loadWeaponAtlas() {
    w.currentWeaponType = ctx.weaponType;
    w.currentMetalType = ctx.material;
    w.currentTemplateIndex = w.specificWeapon?.templateIndex ?? -1;
    w.animTickTime = widgetAnimTickTime(w.currentWeaponType, liveSpeed(), w.s.swing);
    w.customCache = new Map();
  }
  /** GetWeaponTextureAtlas's custom arm (IL 0x2d72-0x2e12): with
   *  DoubleScaleTextures the `w_` set, else the plain name - the
   *  player's own textures by TryImportCifRci's spelling. Asked once per
   *  name; null until it lands, null for good when nothing carries it. */
  function customTexture(record, frame) {
    const file = weaponFileName(w.currentWeaponType);
    if (!file || !ctx?.renderer) return null;
    const name = widgetTextureName(file, record, frame, w.currentMetalType, w.s.doubleScale ? 'w_' : '');
    const cache = (w.customCache ??= new Map());
    if (!cache.has(name)) {
      cache.set(name, null);
      weaponWidgetImage(name).then((img) => {
        if (!img) return;
        const tex = ctx.renderer.uploadTexture('img', `ww:${name}`, img);
        cache.set(name, { tex, width: img.width, height: img.height });
      }).catch((e) => console.warn('[weapon widget] texture load failed', name, e));   // WW3: the rig's neighbours say so too (weaponRig.js art/spell loads) - a bare `catch (() => {})` here is how a shape fault reaches a player instead of a console line
    }
    return cache.get(name);
  }

  // ---- UpdateWeapon (IL 0x2328) and the three alignments ----
  function updateWeapon() {
    const art = w.art, a = anims();
    if (!art || !a || !ctx) return;
    if (ctx.weaponType === T.None) { w.weaponState = S.Idle; w.currentFrame = 0; }
    const isBow = ctx.weaponType === T.Bow;
    const record = isBow ? 0 : a[w.weaponState].Record;
    const rec = art.records[record];
    if (!rec) return;
    const custom = customTexture(record, Math.max(0, w.currentFrame));
    w.curCustomTexture = custom;
    // the mirror: FPSWeapon's three states (0x2435-0x244d), the source rect read right to left
    const mirrored = w.flipHorizontal && MIRROR_STATES.includes(w.weaponState);
    w.curAnimRect = mirrored ? { u0: 1, v0: 0, u1: 0, v1: 1 } : { u0: 0, v0: 0, u1: 1, v1: 1 };
    const anim = { ...a[w.weaponState] };
    if (overrideAlignment()) anim.Alignment = ALIGN.Center;
    let width = rec.width, height = rec.height;
    if (custom) {
      if (w.s.trueSize) { width = custom.width / w.s.textureScaleFactor; height = custom.height / w.s.textureScaleFactor; }
      else if (w.s.doubleScale) {
        if (w.currentWeaponType === T.Bow) { if (w.currentFrame === 0) { width *= 2; height *= 2; } }
        else if (w.weaponState === S.Idle) { width *= 2; height *= 2; }
      }
    }
    w.weaponScaleX = w.screenRect.width / NATIVE_W;
    w.weaponScaleY = w.screenRect.height / NATIVE_H;
    // MainFilterMode's 1.01 fudge (0x2633-0x2663) is CORRECTLY ABSENT, the
    // answer the port's own FPSWeapon and spellcasting hands reached:
    // every image texture here binds NEAREST, so there is no filter
    // shrink to compensate for (combat/fpsSpellCasting.js's note).
    switch (anim.Alignment) {
      case ALIGN.Left: alignLeft(anim, width, height); break;
      case ALIGN.Center: alignCenter(anim, width, height); break;
      case ALIGN.Right: alignRight(anim, width, height); break;
      default: break;
    }
    w.animTickTime = widgetAnimTickTime(w.currentWeaponType, liveSpeed(), w.s.swing);
  }
  const bottomY = (height) => w.screenRect.y + w.screenRect.height - height * w.weaponScaleY - w.weaponOffsetHeight;
  function alignLeft(anim, width, height) {
    w.weaponPosition = { x: w.screenRect.x + w.screenRect.width * anim.Offset, y: bottomY(height), w: width * w.weaponScaleX, h: height * w.weaponScaleY };
  }
  /** AlignCenter (IL 0x278c): under the alignment override the sprite's
   *  INNER edge sits on the screen's middle - the flipped sprite ends
   *  there, the unflipped one starts there; otherwise FPSWeapon's own
   *  centring. */
  function alignCenter(anim, width, height) {
    const mid = w.screenRect.x + w.screenRect.width / 2;
    let x;
    if (overrideAlignment()) x = w.flipHorizontal ? mid - width * w.weaponScaleX : mid;
    else x = mid - width * w.weaponScaleX / 2;
    w.weaponPosition = { x, y: bottomY(height), w: width * w.weaponScaleX, h: height * w.weaponScaleY };
  }
  /** AlignRight (IL 0x28f4): flipped, the three mirror states take AlignLeft. */
  function alignRight(anim, width, height) {
    if (w.flipHorizontal && MIRROR_STATES.includes(w.weaponState)) return alignLeft(anim, width, height);
    w.weaponPosition = { x: w.screenRect.x + w.screenRect.width * (1 - anim.Offset) - width * w.weaponScaleX, y: bottomY(height), w: width * w.weaponScaleX, h: height * w.weaponScaleY };
  }

  /** GetWeaponRect (IL 0x1590) over any base rect, with the clone's own
   *  channels and defaults - the arithmetic is widgetTransformRect's. */
  function transformRect(base, { flip = w.flipHorizontal, scaleIt = w.currentWeaponType !== T.Werecreature, withOffset = true } = {}) {
    return widgetTransformRect(base, {
      position: w.position, scale: w.scale, offset: w.offset, flip, scaleIt, withOffset,
      stepInterval: w.s.stepTransforms ? w.s.stepLength * (w.screenRect.height / 64) : 0,
      screenHeight: w.screenRect.height, weaponOffsetHeight: w.weaponOffsetHeight,
    });
  }
  const getWeaponRect = () => transformRect(w.weaponPosition);

  // ---- Recoil: OnAttackDamageCalculated (IL 0xc5c) and CheckForEnvDamage (0x1730) ----
  /** The host's word on one struck target: `damage` is the calc's
   *  answer, `parrySounds` the foe's MobileEnemy flag, `pos` where it
   *  stands. Only the player's own attack reaches here (the rig's seam). */
  function onAttackDamageCalculated({ damage = 0, parrySounds = false, pos = null, isEnemy = true } = {}) {
    if (!w.s.recoil) return;
    const r = rolls();
    const c = w.s.recoilCondition, R = RECOIL_CONDITION;
    if (damage > 0) {
      if (r < w.s.recoilChance && (c === R.HitsOnly || c === R.HitsAndParries || c === R.AllAttacks)) w.hasCurrentAttackHit = true;
      return;
    }
    if (!isEnemy) return;
    if (parrySounds) {
      if (r < w.s.recoilChance && (c === R.HitsAndParries || c === R.ParriesOnly || c === R.ParriesAndMisses || c === R.AllAttacks)) w.hasCurrentAttackHit = true;
      if (w.s.playMissVFXEntity && pos) doClang(pos);
    } else {
      if (r < w.s.recoilChance && (c === R.ParriesAndMisses || c === R.MissesOnly || c === R.AllAttacks)) w.hasCurrentAttackHit = true;
      if (w.s.playMissVFXEntity && pos) doThud(pos);
    }
  }
  /** DoClang / DoThud: the billboard 0.75 back toward the camera from
   *  the point, or - placed at the crosshair - 0.75 of the way along the
   *  look to the point's distance. */
  function vfxAt(pos) {
    const cam = ctx?.camera?.();
    if (!cam?.pos) return pos;
    const d = [cam.pos[0] - pos[0], cam.pos[1] - pos[1], cam.pos[2] - pos[2]];
    const len = Math.hypot(d[0], d[1], d[2]) || 1;
    if (w.s.playMissVFXPos === MISS_VFX_AT.Crosshair && cam.forward) {
      const k = len * 0.75;
      return [cam.pos[0] + cam.forward[0] * k, cam.pos[1] + cam.forward[1] * k, cam.pos[2] + cam.forward[2] * k];
    }
    return [pos[0] + d[0] / len * 0.75, pos[1] + d[1] / len * 0.75, pos[2] + d[2] / len * 0.75];
  }
  const doClang = (pos) => missEffect?.('CLANG', vfxAt(pos), { ...MISS_VFX, emissive: true });
  const doThud = (pos) => missEffect?.('THUD', vfxAt(pos), { ...MISS_VFX, emissive: false });
  /** CheckForEnvDamage: a sphere cast from the player's centre along
   *  the look, the weapon's reach (x1.25 for a StrikeUp); a wall or an
   *  action object within it is a hit, with a thud. */
  function checkForEnvDamage() {
    if (!envHit) return false;
    let reach = ctx?.reach ?? 2.5;
    if (w.weaponState === S.StrikeUp) reach *= 1.25;
    const point = envHit(reach);
    if (!point) return false;
    if (w.s.playMissVFXEnvironment) doThud(point);
    return true;
  }

  // ---- the three coroutines (IL <PlayWeaponAnimation>d__135, d__136, d__137) ----
  function* playWeaponAnimation(state) {
    w.hasCurrentAttackHit = false;
    w.animatingCancel = false;
    let tickTime = widgetAnimTickTime(w.currentWeaponType, liveSpeed(), w.s.swing) / 5 / (w.s.swingSpeed || 1e-6);
    if (w.s.swingWindup === WINDUP.FirstFrame) changeWeaponState(state); else changeWeaponState(S.Idle);
    if (w.s.swingRecoveryOverride && recoveryOverride()) tickTime *= 0.5;
    // the wind-up: the pose the setting names, held until the ORIGINAL reaches its hit frame
    while (machineFrame() < hitFrame()) {
      if (w.s.swingWindup === WINDUP.FirstFrame) w.currentFrame = 0;
      else if (w.s.swingWindup === WINDUP.Idle) {
        if (offsetOverride()) w.offsetTarget = leanFor(state, w.flipHorizontal);
        else w.offsetTarget = [0, 1];
      } else w.currentFrame = -1;
      yield FRAME;
    }
    changeWeaponState(state);
    playSwingSound();
    if (w.s.recoil && w.s.recoilEnvironment && checkForEnvDamage()) w.hasCurrentAttackHit = true;
    yield FRAME;
    if (w.hasCurrentAttackHit) {
      // a hit: forward to the hit frame, hold three ticks there, then recover
      const hf = hitFrame();
      while (w.currentFrame < hf) { w.offsetTarget = [0, 0]; w.offsetCurrent = [0, 0]; w.currentFrame += 1; updateWeapon(); yield tickTime; }
      yield tickTime * 3;
    } else {
      // a miss: the whole strike forward
      while (w.currentFrame < numFrames(ctx?.machine?.isBow, STATE_NAMES[w.weaponState]) - 1) { w.offsetTarget = [0, 0]; w.offsetCurrent = [0, 0]; w.currentFrame += 1; updateWeapon(); yield tickTime; }
    }
    w.animatingCancel = true;
    const recover = w.s.swingRecoveryOverride && recoveryOverride();
    // the recovery, while the ORIGINAL is still attacking: in reverse on a hit or the override, else the setting's pose.
    // F1 (2026-09-17, Mac: "when thrusting with a weapon, it can be glitchy"): the reverse runs ONCE. It sat inside the
    // attacking loop unlatched, and with Recovery = Last Frame the frame it left at 0 was set back to the last frame and
    // reversed again, every lap, until the original's swing ended - a thrust (the one strike that recovers in reverse
    // under the shipped VanillaRecoveryOverride) flickering backwards over and over.
    let reversed = false;
    while (machineIsAttacking()) {
      if (!reversed && (recover || w.hasCurrentAttackHit)) {
        reversed = true;
        while (w.currentFrame > 0) { w.offsetCurrent = [0, 0]; w.offsetTarget = [0, 0]; w.currentFrame -= 1; updateWeapon(); yield tickTime; }
        continue;
      }
      w.currentFrame = w.s.swingRecovery === RECOVERY.LastFrame ? numFrames(ctx?.machine?.isBow, STATE_NAMES[w.weaponState]) - 1 : -1;
      yield FRAME;
    }
    finishSwing(state);
  }
  /** The wind-up lean (IL 0x3a68-0x3bac): which way the idle sprite is
   *  pushed while the original winds up, by strike and by hand. */
  function leanFor(state, flip) {
    if (flip) {
      if (state === S.StrikeUp) return [-1, 1];
      if (state === S.StrikeDownLeft || state === S.StrikeLeft) return [-1, 1];
      if (state === S.StrikeDown || state === S.StrikeDownRight) return [1, -1];
      if (state === S.StrikeRight) return [1, 0];
      return [0, 1];
    }
    if (state === S.StrikeUp) return [-1, 1];
    if (state === S.StrikeRight || state === S.StrikeDownRight) return [-1, 1];
    if (state === S.StrikeDown || state === S.StrikeDownLeft) return [1, -1];
    if (state === S.StrikeLeft) return [1, 0];
    return [0, 1];
  }
  /** The coroutines' exit (IL 0x3fcb-0x40ec, 0x4354-0x43ca): idle, and
   *  the idle sprite re-enters from below - from the side the strike
   *  left toward, or straight up for a down or up strike. */
  function finishSwing(state) {
    changeWeaponState(S.Idle);
    let x = 1;
    if (!offsetOverride()) x = 0;
    else if (state === S.StrikeDown || state === S.StrikeUp) x = 0;
    else if (state === S.StrikeLeft || state === S.StrikeDownLeft) x = -1;
    w.offsetCurrent = [x, 1];
    w.hasCurrentAttackHit = false;
    w.animating = null;
  }
  function* playVanillaWeaponAnimation(state) {
    w.hasCurrentAttackHit = false;
    w.animatingCancel = false;
    const tickTime = widgetAnimTickTime(w.currentWeaponType, liveSpeed(), w.s.swing);
    changeWeaponState(state);
    const last = () => numFrames(ctx?.machine?.isBow, STATE_NAMES[w.weaponState]) - 1;
    while (w.currentFrame < last() && !w.hasCurrentAttackHit) {
      w.offsetTarget = [0, 0]; w.offsetCurrent = [0, 0];
      w.currentFrame += 1; updateWeapon();
      if (w.currentFrame === hitFrame()) {
        playSwingSound();
        if (w.s.recoil && w.s.recoilEnvironment && checkForEnvDamage()) w.hasCurrentAttackHit = true;
      }
      yield tickTime;
    }
    // a hit plays the strike back to its start; at the hit frame on the way back the swing may be replaced
    while (w.currentFrame > 0 && w.hasCurrentAttackHit) {
      w.offsetTarget = [0, 0]; w.offsetCurrent = [0, 0];
      w.currentFrame -= 1; updateWeapon();
      if (w.currentFrame === hitFrame()) w.animatingCancel = true;
      yield tickTime;
    }
    while (machineIsAttacking()) {
      w.currentFrame = w.s.swingRecovery === RECOVERY.LastFrame ? last() : -1;
      yield FRAME;
    }
    finishSwing(state);
    w.animatingCancel = true;
  }
  function* playBowAnimation() {
    let cooldownTime = 0;
    const tick = CLASSIC_UPDATE_INTERVAL;
    if (bowDrawback()) {
      // the draw (IL 0x4477-0x45ab): frames 0..3 on the classic tick while the ORIGINAL draws, then held as long as it holds
      w.currentFrame = 0; changeWeaponState(S.StrikeUp); updateWeapon();
      const drawTime = 12; let drawTimer = 0;
      while (machineStateIndex() === S.StrikeUp) {
        let hold = drawTimer > drawTime || !!ctx?.activateStarted?.();
        if (!hold) {
          w.offsetTarget = [0, 0]; w.offsetCurrent = [0, 0];
          if (w.currentFrame < 3) { w.currentFrame += 1; updateWeapon(); drawTimer += tick; yield tick; continue; }
          hold = true;
        }
        drawTimer += ctx?.dt ?? 0;
        yield FRAME;
      }
      if (machineStateIndex() === S.StrikeDown) {
        // the release (0x45c1-0x4734): to the last frame, the cooldown clocked at the hit frame
        changeWeaponState(S.StrikeDown); updateWeapon();
        playSwingSound();
        yield tick;
        while (machineStateIndex() === S.StrikeDown && w.currentFrame < BOW_NUM_FRAMES.StrikeDown - 1) {
          w.offsetTarget = [0, 0]; w.offsetCurrent = [0, 0];
          if (w.currentFrame === hitFrame()) cooldownTime = w.time + getBowCooldownTime(liveSpeed());
          w.currentFrame += 1; updateWeapon();
          yield tick;
        }
      } else {
        // a draw let go without a shot (0x4780-0x4779): back down the draw frames
        while (w.currentFrame > 0) { w.offsetTarget = [0, 0]; w.offsetCurrent = [0, 0]; w.currentFrame -= 1; updateWeapon(); yield tick; }
      }
      // dipped out of sight until the cooldown ends (0x478b-0x47c1), then idle
      do { w.offsetTarget = [0, 1]; yield FRAME; } while (w.time < cooldownTime);
      changeWeaponState(S.Idle); w.currentFrame = 0; updateWeapon();
    } else {
      // BowDrawback off (0x481e-0x49fd): the instant shot from the drawn frame
      w.currentFrame = 3; changeWeaponState(S.StrikeDown); updateWeapon();
      yield tick;
      playSwingSound();
      cooldownTime = w.time + getBowCooldownTime(liveSpeed());
      yield tick;
      while (w.currentFrame < BOW_NUM_FRAMES.StrikeDown - 1) { w.offsetTarget = [0, 0]; w.offsetCurrent = [0, 0]; w.currentFrame += 1; updateWeapon(); yield tick; }
      do { w.offsetTarget = [0, 1]; yield FRAME; } while (w.time < cooldownTime);
      w.currentFrame = 3; changeWeaponState(S.StrikeDown); updateWeapon();
    }
    w.offsetCurrent = [0, 1];
    w.animating = null;
  }
  /** PlayAttackAnimation (IL 0xfc0): a running swing yields only once
   *  it has passed its cancel point. StartCoroutine runs the body to its
   *  first yield at once. */
  function playAttackAnimation(state) {
    if (w.animating && !w.animatingCancel) return;
    w.animating = null;
    let gen;
    if (w.currentWeaponType === T.Bow) gen = playBowAnimation();
    else if (w.s.swing) gen = playWeaponAnimation(state);
    else gen = playVanillaWeaponAnimation(state);
    const a = { gen, wait: 0 };
    w.animating = a;
    w.hasCurrentAttackHit = false;
    resume(a);
  }
  function resume(a) {
    let r;
    try { r = a.gen.next(); } catch (e) { console.warn('[weapon widget] a swing threw', e); if (w.animating === a) w.animating = null; return; }
    if (r.done) { if (w.animating === a) w.animating = null; return; }
    a.wait = r.value === FRAME ? FRAME : Math.max(0, Number(r.value) || 0);
  }
  /** Unity's clock for the coroutines: a `yield seconds` resumes ahead
   *  of the frame's LateUpdate once its wait has run out (the remainder
   *  is not carried); a `yield FRAME` (WaitForEndOfFrame) resumes after
   *  the frame's draw. */
  function stepSecondsWaits(dt) {
    const a = w.animating;
    if (!a || a.wait === FRAME) return;
    a.wait -= dt;
    if (a.wait > 0) return;
    a.wait = 0;
    resume(a);
  }
  function endOfFrame() {
    const a = w.animating;
    if (!a || a.wait !== FRAME) return;
    a.wait = 0;
    resume(a);
  }

  // ---- LateUpdate (IL 0x189c): the frame ----
  /**
   * @param dt      the frame's seconds
   * @param c       the frame's inputs: {
   *   renderer, canvas, entity, art, weapon (the hand's item), weaponType, material, machine, sheathed, usingRightHand,
   *   equipCountdown, shown (the rig's ShowWeapon), castPlaying, spellArmed, thirdPerson, reach,
   *   motion: { grounded, crouching, riding, standing, speedRatio, localVel: [x, y, z] },
   *   look: [lookX, lookY], swingHeld, cursorActive, camera() -> { pos, forward }, attackVoice() -> clip, activateStarted() -> bool }
   */
  function lateUpdate(dt, c) {
    ctx = c;
    c.dt = dt;
    w.s = settings();
    w.time += dt;
    stepSecondsWaits(dt);
    w.screenRect = { x: 0, y: 0, width: c.canvas?.width ?? NATIVE_W, height: c.canvas?.height ?? NATIVE_H };
    w.leftHanded = !!handedness();
    w.art = c.art ?? null;
    w.position = [0, 0]; w.scale = [1, 1]; w.offset = [0, 0];
    // the weapon in hand changed (SpecificWeapon)
    if (c.weapon !== w.specificWeapon) {
      if (c.weapon) {
        w.specificWeapon = c.weapon;
        if (!bowDrawback() && weaponTypeForItem(c.weapon) === T.Bow) { w.currentFrame = 3; changeWeaponState(S.StrikeDown); }
        else changeWeaponState(S.Idle);
      } else { w.specificWeapon = null; changeWeaponState(S.Idle); }
    }
    // the atlas follows the type, the metal, the template, the enchantment and the double-scale switch (OnGUI 0x113b-0x11ab)
    const enchanted = !!(w.specificWeapon && isEnchanted(w.specificWeapon));
    if (c.weaponType !== w.currentWeaponType || c.material !== w.currentMetalType
      || (w.specificWeapon?.templateIndex ?? -1) !== w.currentTemplateIndex || enchanted !== w.lastEnchanted || w.s.doubleScale !== w.lastDoubleScale) {
      loadWeaponAtlas();
      w.lastEnchanted = enchanted; w.lastDoubleScale = w.s.doubleScale;
    }
    w.weaponOffsetHeight = weaponOffsetHeight();
    // the sheathe edge (OnGUI 0x12db-0x1416): the mod's own sheathe clip; the draw's clip is the rig's already
    // (the mod's field starts false, so DFU hears the clip once at every load - a boot artefact, not carried)
    if (w.lastSheathed === null) w.lastSheathed = c.sheathed;
    if (c.sheathed !== w.lastSheathed) { if (c.sheathed) playSheatheSound(); w.lastSheathed = c.sheathed; }
    // Ambidexterity (0x19c2-0x1b97): the sprite's hand
    if (w.s.ambidexterity && !c.sheathed) {
      let want;
      if (c.weaponType === T.Bow) want = w.s.mirrorBows ? !w.leftHanded : w.leftHanded;
      else if (!usingRightHand()) want = !w.leftHanded;
      else want = mirrorOverride() ? !w.leftHanded : w.leftHanded;
      if (w.flipHorizontal !== want) { w.flipHorizontal = want; changeWeaponState(S.Idle); }
    } else if (!w.s.ambidexterity && w.flipHorizontal !== w.leftHanded) {
      w.flipHorizontal = w.leftHanded;   // the module off: FPSWeapon's own Handedness flip
      changeWeaponState(S.Idle);
    }
    // the attack (0x1b97-0x1c88): the original started a strike the clone is not playing
    if (machineIsAttacking() && !w.animating) {
      const st = machineStateIndex();
      let play = st;
      if (w.s.swingNoDaggerRight && (w.currentWeaponType === T.Dagger || w.currentWeaponType === T.Dagger_Magic)) {
        if (w.flipHorizontal) { if (st === S.StrikeLeft) play = S.StrikeRight; else if (st === S.StrikeDownLeft) play = S.StrikeDownRight; }
        else if (st === S.StrikeRight) play = S.StrikeLeft; else if (st === S.StrikeDownRight) play = S.StrikeDownLeft;
      }
      playAttackAnimation(play);
    }
    const m = c.motion ?? {};
    const speedRatio = Number.isFinite(m.speedRatio) ? m.speedRatio : 1;
    const animating = !!w.animating;
    const flip = w.flipHorizontal;
    // Offset (0x1cd9-0x1dc5): off screen while hidden or equipping, back when shown, eased by the live speed
    if (w.s.offset) {
      const o = offsetStep({
        offsetCurrent: w.offsetCurrent, offsetTarget: w.offsetTarget,
        animating, shown: c.shown, equipCountdown: c.equipCountdown ?? 0,
      }, dt, offsetSpeedLive());
      w.offsetCurrent = o.offsetCurrent; w.offsetTarget = o.offsetTarget;
      w.offset = [w.offset[0] + o.delta[0], w.offset[1] + o.delta[1]];
    }
    // Bob (0x1dca-0x1fbb): while the original idles, or a bow draws or looses
    let bobbing = machineStateIndex() === S.Idle;
    if (!bobbing && w.currentWeaponType === T.Bow && (w.weaponState === S.StrikeUp || w.weaponState === S.StrikeDown)) bobbing = true;
    if (w.s.bob && bobbing) {
      const b = bobStep({
        moveSmooth: w.moveSmooth, bobSmooth: w.bobSmooth, time: w.time, screenRect: w.screenRect,
        doubleScaleIdle: w.s.doubleScale && w.weaponState === S.Idle,
      }, w.s, { ...m, speedRatio }, dt);
      w.moveSmooth = b.moveSmooth; w.bobSmooth = b.bobSmooth;
      w.position = [w.position[0] + b.delta[0], w.position[1] + b.delta[1]];
    }
    // Inertia (0x1fc0-0x2243): the look and the body's motion lag the sprite, and forward motion scales it
    if (w.s.inertia && w.weaponState === S.Idle) {
      const i = inertiaStep({
        inertiaCurrent: w.inertiaCurrent, inertiaTarget: w.inertiaTarget,
        inertiaForwardCurrent: w.inertiaForwardCurrent, inertiaForwardTarget: w.inertiaForwardTarget,
        screenRect: w.screenRect, flip, look: c.look ?? [0, 0], cursorActive: c.cursorActive, swingHeld: c.swingHeld,
      }, w.s, m, dt);
      w.inertiaTarget = i.inertiaTarget; w.inertiaSpeedMod = i.inertiaSpeedMod;
      w.inertiaCurrent = i.inertiaCurrent;
      w.inertiaForwardTarget = i.inertiaForwardTarget; w.inertiaForwardCurrent = i.inertiaForwardCurrent;
      w.scale = [w.scale[0] + i.scale[0], w.scale[1] + i.scale[1]];
      w.position = [w.position[0] + i.delta[0], w.position[1] + i.delta[1]];
    }
    // DoubleScaleTextures (0x2248-0x22b1): the doubled idle sits half its size in, so its corner stays where the classic one was
    if (w.s.doubleScale && (w.weaponState === S.Idle || (w.currentWeaponType === T.Bow && w.currentFrame === 0))) {
      w.offset = w.currentWeaponType === T.Werecreature ? [w.offset[0], w.offset[1] + 0.5] : [w.offset[0] + 0.5, w.offset[1] + 0.5];
    }
    // the frame's placement (OnGUI's UpdateWeapon)
    updateWeapon();
  }

  /** OnGUI's repaint (IL 0x1424-0x1582): with the Offset module the
   *  sprite draws whatever the show clocks say (the slide takes it off
   *  screen); without it, only while the rig would show it. */
  /** FIELD-GUN6: `adjust` is the ONE thing the mod has no module for -
   *  a weapon that moves without the swing moving it. The clone's
   *  Recoil replays a STRIKE in reverse when a blow lands, which a gun
   *  has no strike to replay; the Dwarven Thunderlock's kick is a
   *  spring the rig owns (combat/gunFeel.js). It arrives here as a
   *  rect delta in native (320x200) units, applied AFTER the mod's own
   *  transform for the reason the lab wrote down: the transform ends
   *  in a floor, so the rect never rises above its resting place, and
   *  a gun's kick rises. Null for every weapon but that one, which is
   *  every caller that predates this. */
  function draw(renderer, canvas, tint = null, adjust = null) {   // MAC-I: the room's light, as the sprite this clone stands in for takes it
    if (!ctx || !w.art || !renderer || !canvas) return false;
    if (ctx.weaponType === T.None) return false;
    // WW4 (Mac's curated fix, 2026-09-16): an applicable clone that
    // chooses SILENCE still owns the seam. Frame -1 (a Hide wind-up or
    // recovery - "frame -1 draws nothing", OnGUI 0x10c8), a hideWeapon
    // message, third person, or the rig not showing the weapon are the
    // mod drawing nothing - not the mod being absent. `false` here reads
    // to the rig (`if (widgetOn() && c && widget.draw(renderer, c)) return;`)
    // as "not mine" and the classic sprite falls in behind it: the
    // vanilla weapon flashing back mid-swing on every Hide wind-up and
    // recovery (both default). In DFU the mod hides the original outright
    // (`ScreenWeapon.ShowWeapon = false` - "the vanilla weapon's own hide",
    // the page's deliberately-not-carried list) and this return IS that
    // hide. Only genuine NOT-APPLICABLE - no ctx or art, no anim, record
    // or texture data - may fall through to the classic sprite.
    if (w.currentFrame === -1 || !w.showWeapon || ctx.thirdPerson) return true;
    if (!w.s.offset && !ctx.shown) return true;
    const a = anims();
    if (!a) return false;
    const record = ctx.weaponType === T.Bow ? 0 : a[w.weaponState].Record;
    const rec = w.art.records[record];
    if (!rec) return false;
    const tex = w.curCustomTexture?.tex ?? rec.frames[Math.min(Math.max(0, w.currentFrame), rec.frames.length - 1)];
    if (!tex) return false;
    const rect = getWeaponRect();
    if (adjust) {
      const sx = canvas.width / 320, sy = canvas.height / 200;
      rect.x += (adjust.x ?? 0) * sx;
      rect.y += (adjust.y ?? 0) * sy;
    }
    // FIELD-GUN11: as drawFpsWeapon does - the clone transforms the
    // WEAPON's own box and the full image is expanded around it at
    // the draw. Absent on every CIF record, so no classic weapon
    // notices.
    const q = w.art.unionBox && w.art.anchor ? unionDrawRect(rect, w.art.anchor, w.art.unionBox) : rect;
    renderer.drawScreenQuad(tex, q, w.curAnimRect, tint ?? undefined);
    return true;
  }

  /** The channels for the Morrowind arms: the frame's Position and
   *  Scale (Bob, Inertia, Step) over the arms' own composite - the
   *  Offset module's slide is the sprite's sheathe and is not applied,
   *  the arms sheathe with their own clips. */
  function armsTransform(base) {
    return transformRect(base, { flip: false, scaleIt: true, withOffset: false });
  }

  return {
    lateUpdate, draw, endOfFrame, onAttackDamageCalculated, armsTransform, transformRect,
    /** The mod's `showWeapon` / `hideWeapon` messages. */
    setShowWeapon(v) { w.showWeapon = !!v; },
    setThirdPerson(v) { w.isInThirdPerson = !!v; },
    /** The published channels and the clone's own state, read by the pins. */
    get position() { return [w.position[0], w.position[1]]; },
    get scale() { return [w.scale[0], w.scale[1]]; },
    get offset() { return [w.offset[0], w.offset[1]]; },
    get state() { return w.weaponState; },
    get frame() { return w.currentFrame; },
    get flipHorizontal() { return w.flipHorizontal; },
    get animating() { return !!w.animating; },
    get hasCurrentAttackHit() { return w.hasCurrentAttackHit; },
    get rect() { return getWeaponRect(); },
    get weaponPosition() { return { ...w.weaponPosition }; },
    get settings() { return w.s; },
    _w: w,
  };
}
