// HT1 (2026-09-14, Mac: "Next mod to integrate 1:1 is this"): HANDHELD
// TORCHES 1.4.1 by RedRoryOTheGlen - the HandheldTorches MonoBehaviour,
// ported 1:1.
//
// The mod's own description: "Auto-extinguishes torches and candles
// when drawing weapons with no free hand." What it is: a HAND LAW over
// PlayerEntity.LightSource - every frame it works out which of the
// player's hands are free (UpdateFreeHand) and, with none free, stows
// the lit light (or drops it, by OnStow) and lights it again when a
// hand frees; three keys - ignite/douse, drop, throw (held to wind up);
// a first-person sprite of the hand holding the lit torch or lantern
// (the mod's own art, vendor/handheld-torches/Textures), placed by
// SetGuard / SetAttack / SetSheathe and moved by Weapon Widget's Bob,
// Inertia and Step laws (the author's other mod, WW1 - the same
// arithmetic, restated here where the IL restates it); and a burning
// loop while a torch is lit. The dropped and thrown torches, the foe
// set alight and the trajectory live in scenes/droppedTorches.js (the
// pool), which this component calls as the mod calls its own
// SpawnLightSource / SpawnLightSourceProjectile.
//
// The script ships only as a compiled DLL (43,520 bytes); the four .cs
// files its manifest names are not in the bundle, so it was read off
// the IL method by method (the record, with every method against its
// home here, is bible/06-Systems/Handheld-Torches.md). IL offsets in
// the notes below cite that reading.
//
// THE SHAPE HERE. createHandheldTorches() is the component; the weapon
// rig (combat/weaponRig.js) owns one per host beside the widget and
// feeds it the frame - update() is Update, lateUpdate() is LateUpdate
// (the mod runs both; the rig calls them in that order), draw() is
// OnGUI's repaint. The keys are read as KeyCode names the way the
// mod parses them (systems/keyCodes.js). The hand law has ONE other
// caller than Update - the equip change (HT6 below), because a window
// that is open has stopped the frames the law would otherwise run on.
//
// NOT CARRIED, recorded: the cross-mod seams (Vanilla Combat Event
// Handler's onToggleOffset - isInThirdPerson stays the rig's word;
// Bloodfall's GUID gating the foe light; Custom Tooltips'
// RegisterCustomTooltip naming the dropped torches - the port's own
// plaque names them); the mod's hasFreeHand/getFreeHand
// MessageReceiver (no mod asks); FPSWeapon.Tint (First-Person
// Lighting's; the port's sprite has no tint channel - white, as the
// mod draws without that mod).

import { modSettingsOf } from './modSettings.js';
import { getBool, getInt } from './settings.js';
import { liveStat } from './statMods.js';
import { TEMPLATES, isLightSource } from './useItem.js';
import { getItem, addItem } from './inventory.js';
import { conditionWord, itemLongName } from './itemInfo.js';
import { getItemHands, EQUIP_SLOTS, ITEM_HANDS, addEquipChangeListener } from './equip.js';   // HT6: the worn set's own door - the hand law runs at the equip moment too
import { weaponTypeForItem, WEAPON_TYPES, NATIVE_W, NATIVE_H } from '../combat/fpsWeapon.js';
import { weaponOffsetHeight } from '../ui/hudLarge.js';
import { SOUND } from './soundClips.js';
import { domCodeForKeyCode } from './keyCodes.js';
import { moveTowards, moveTowards2, snap, BOB_SHAPE, STEP_CONDITION } from '../combat/weaponWidget.js';   // WW1: Unity's pieces and the two choice tables, one home
import { setPlayerTorchOffsetOverride } from './playerTorch.js';
import { toScreenOrder } from '../formats/color32Order.js';   // HT3: a SCREEN sprite keeps its rows - see the note there   // TEX1: the SHAPE the upload path reads - `{ colors }`, never a decoded PNG's `{ data }`
import { decodePng } from './textureReplacement.js';
import { setLightSource, addLightSourceListener } from './lightSource.js';   // DISC7: the light in hand's one door

export const HANDHELD_TORCHES_VENDOR = 'handheld-torches';
export const HANDHELD_TORCHES_MOD = Object.freeze({
  guid: '5922796c-9fa0-4e2f-8aaa-7c9702015813', title: 'Handheld Torches', version: '1.4.1', author: 'RedRoryOTheGlen',
});

/** The shipped choices, by index. */
export const ON_STOW = Object.freeze({ Unequip: 0, Drop: 1 });
export const ON_PICK = Object.freeze({ Store: 0, Equip: 1, ForceEquip: 2 });
export { BOB_SHAPE, STEP_CONDITION };   // the widget's own tables - the same modsettings, one home
/** GetFreeHand (IL 0x266): 0 none, 1 left, 2 right. */
export const FREE_HAND = Object.freeze({ None: 0, Left: 1, Right: 2 });

/** The mod's own archives (Awake 0x7d1, InitializeTextures 0x103f). */
export const DROPPED_ARCHIVE = 112358;
export const SPRITE_ARCHIVE = 112359;
/** The dropped records: a torch, a candle, a holy candle; +10 doused. */
export const DROPPED_RECORD = Object.freeze({ Torch: 0, Candle: 1, HolyCandle: 2, DousedOffset: 10 });
/** The mod's clips (Awake 0x608; the actions 0x312b-0x36a9). */
export const CLIPS = Object.freeze({
  burning: SOUND.Burning,          // 420 - the loop, the player's and a dropped torch's
  drop: SOUND.EquipStaff,          // 380 - the drop, and a thrown torch's bounce and landing
  throwSwing: SOUND.SwingHighPitch,   // 106 - the throw
  douse: 381,                      // the douse (SoundClips 381)
  ignite: SOUND.Ignite,            // 16 - the ignite (at pitch 0.5) and a foe set alight
  stow: 417,                       // the pick-up's "You stow the" (SoundClips 417)
});
/** The mod's messages (.ctor 0x41c3-0x4236), verbatim. */
export const MESSAGES = Object.freeze({
  drop: 'You drop the ', dropTorchless: "You don't have a light source to drop",
  pickupEquip: 'You pick up the ', pickupStore: 'You stow the ',
  noFreeHand: "You can't hold a light source right now", examine: 'You see a ',
  throw: 'You throw the ', throwTorchless: "You don't have a torch to throw",
  ignite: 'You ignite the ', igniteTorchless: "You don't have a light source", douse: 'You douse the ',
});
/** The sprite's frame clock (.ctor 0x423c): a frame every 0.0625 s. */
export const ANIMATION_TIME = 0.0625;
/** DropLightSource's two casts (0x2fe8, 0x304d): forward 1.45, then 145 down. */
export const DROP_FORWARD_CAST = 1.45;
export const DROP_DOWN_CAST = 145;
/** The hand the throw leaves from, off the camera's right (0x1c43). */
export const THROW_HAND_OFFSET = 0.35;
/** The wind-up's clamp (0x19a6): a quarter to twice. */
export const THROW_STRENGTH_MIN = 0.25, THROW_STRENGTH_MAX = 2;
/** DrawTrajectory's own arithmetic (0x1cc1-0x1dcc): 300 steps of Unity's
 *  fixed 0.02, the same 25-and-Strength speed the throw leaves at, and
 *  gravity 9.8 - NOT the flight's 9.81 (Projectile .ctor 0x4be5). The
 *  mod's two numbers, both kept. */
export const TRAJECTORY_STEPS = 300, TRAJECTORY_FIXED_DT = 0.02, TRAJECTORY_SPEED = 25, TRAJECTORY_GRAVITY = 9.8;
/** PlayerTorch's local position the mod writes on a flip (0x2f1c, 0x2f50), in the port's left/up/forward words. */
export const TORCH_LIGHT_AT = Object.freeze({ torch: { left: 0.34, up: 0.9, forward: 0.25 }, lantern: { left: 0.26, up: 0, forward: 0.25 } });
/** The item's burn-time law: currentCondition * 20 seconds (0x30a6), back as ceil(time / 20) (0x3db2). */
export const SECONDS_PER_CONDITION = 20;

const T = TEMPLATES;
const isTorch = (it) => it?.templateIndex === T.Torch;
const isLantern = (it) => it?.templateIndex === T.Lantern;
/** TORCH-VIS: the mod's own "is this a light you HOLD" - the two templates its hand law and its sprite both ask
 *  about. Exported because the weapon rig's draw ladder must ask the SAME question to know a lit hand from an
 *  empty one, and a second spelling of it there is how the sprite and the ladder drift apart. */
export const isHeldLight = (it) => isTorch(it) || isLantern(it);

// ---- LoadSettings (IL 0xa44-0x1024): the fields, with the mod's own multipliers ----
/** The clone's settings from the store, as LoadSettings derives them
 *  (Presentation.Speed x2000, Bob.Length /100, SizeX/Y x2, SpeedMove
 *  x4, SpeedState x500, Shape x0.5, Inertia.Scale/Speed x500,
 *  ForwardDepth/ForwardSpeed x0.2; the three keys parsed as KeyCodes). */
export function readTorchSettings(read = () => modSettingsOf(HANDHELD_TORCHES_VENDOR)) {
  const s = read();
  return {
    enabled: !!s.Enabled,
    toggleKey: domCodeForKeyCode(s['Handling.ToggleLightInput']), dropKey: domCodeForKeyCode(s['Handling.ManualDropInput']),
    throwKey: domCodeForKeyCode(s['Throwing.ThrowTorchInput']),
    lastLight: !!s['Handling.RememberLastLightSource'], onStow: s['Handling.OnStow'] | 0, onPick: s['Handling.OnPick'] | 0,
    stowOnSpellcasting: !!s['Handling.StowWhenSpellcasting'], stowOnClimbing: !!s['Handling.StowWhenClimbing'], stowOnSwimming: !!s['Handling.StowWhenSwimming'],
    twoHandedRelaxed: !!s['Handling.RelaxedTwoHandedWeapons'], lanternRelaxed: !!s['Handling.RelaxedLanterns'],
    throwStrength: Number(s['Throwing.ThrowStrength']), throwAngle: Number(s['Throwing.ThrowAngleOffset']), throwSpread: Number(s['Throwing.ThrowDispersion']),
    throwGravity: Number(s['Throwing.GravityStrength']), throwBounce: Number(s['Throwing.Bounciness']), throwScale: Number(s['Throwing.ThrowScaleSpeed']),
    throwDrawTrajectory: !!s['Throwing.ShowTrajectory'], fire: !!s['Throwing.Combustion'], fireAccuracy: s['Throwing.Accuracy'] | 0,
    fireDuration: s['Throwing.Duration'] | 0, fireChance: s['Throwing.Chance'] | 0, fireDamageRange: [s['Throwing.Magnitude'][0] | 0, s['Throwing.Magnitude'][1] | 0],
    fireLight: !!s['Throwing.Emission'], fireLightShadows: !!s['Throwing.EmissionShadows'],
    showSprite: !!s['Modules.Sprite'], bob: !!s['Modules.Bob'], inertia: !!s['Modules.Inertia'], stepTransforms: !!s['Modules.Step'],
    mirrorSprite: !!s['Presentation.Ambidexterity'], tintSprite: !!s['Presentation.Tint'], playAudio: !!s['Presentation.PlayerTorchAudio'],
    sfxVolume: Number(s['Presentation.AudioVolume']), offsetX: Number(s['Presentation.Offset'][0]), offsetY: Number(s['Presentation.Offset'][1]),
    scale: Number(s['Presentation.Scale']), offsetSpeed: Number(s['Presentation.Speed']) * 2000, lockAspectRatio: !!s['Presentation.LockAspectRatio'],
    bobLength: (s['Bob.Length'] | 0) / 100, bobOffset: Number(s['Bob.Offset']), bobSizeXMod: Number(s['Bob.SizeX']) * 2, bobSizeYMod: Number(s['Bob.SizeY']) * 2,
    moveSmoothSpeed: Number(s['Bob.SpeedMove']) * 4, bobSmoothSpeed: Number(s['Bob.SpeedState']) * 500, bobShape: (s['Bob.Shape'] | 0) * 0.5, bobWhileIdle: !!s['Bob.BobWhileIdle'],
    inertiaScale: Number(s['Inertia.Scale']) * 500, inertiaSpeed: Number(s['Inertia.Speed']) * 500,
    inertiaForwardScale: Number(s['Inertia.ForwardDepth']) * 0.2, inertiaForwardSpeed: Number(s['Inertia.ForwardSpeed']) * 0.2,
    stepLength: s['Step.Length'] | 0, stepCondition: s['Step.Condition'] | 0,
    scaleTextureFactor: Number(s['Compatibility.TextureScaleFactor']) || 1,   // the mod's own field is 1 by default; a 0 would divide the sprite by nothing
  };
}

/** The condition word and the long name, lower-cased, as every
 *  message spells its item (`Condition().ToLower() + " " + LongName.ToLower()`). */
export const torchItemWords = (item) => `${conditionWord(item).toLowerCase()} ${itemLongName(item).toLowerCase()}`;

/** The vendored sprite's URL (the mod's own PNG, Unity's import of it). */
export const spriteUrl = (record, frame) => new URL(`../../vendor/handheld-torches/Textures/${SPRITE_ARCHIVE}_${record}-${frame}.png`, import.meta.url).href;

/** HT6: THE LIVE COMPONENT - the one whose Update ran last, and the
 *  only one the equip change may reach. The hosts build a rig EACH
 *  (worldModes' interior rig, dungeonContext's), so a component that is
 *  not being given frames still holds its last `ctx` - stale `sheathed`
 *  and `usingRightHand` from whenever that host last had the player -
 *  and applying the law off that would stow a torch by a fact that is
 *  no longer true. `dispose` (the rig's teardown when the mod is
 *  switched off) clears the pointer. ONE listener for the module,
 *  registered once at import, so no number of rigs can leave a stack of
 *  them behind - the same shape systems/entityMods.js registers with. */
let _liveHandLaw = null;
addEquipChangeListener((entity) => _liveHandLaw?.(entity));

/**
 * The component. `deps`:
 *   settings()     the fields (readTorchSettings), re-read per frame
 *   audio          playOneShot(clip, volume, pitch), loop(clip, volume) -> { stop } (the burning loop)
 *   say(line)      the HUD's popup channel
 *   rolls          Random.value / Random.Range
 *   torches()      the host's dropped-torch pool (scenes/droppedTorches.js) or null
 *   handedness()   Settings Controls/Handedness == 1
 *   loadSprite(record, frame) -> Promise<{width, height, colors} | null>   the mod's texture, in the port's
 *                  color32 shape and order - what `renderer.uploadTexture` reads (TEX1)
 */
export function createHandheldTorches({
  settings = readTorchSettings, audio = null, say = () => {}, rolls = Math.random, torches = () => null,
  handedness = () => getInt('Controls', 'Handedness', 0, 3) === 1,
  loadSprite = defaultLoadSprite,
} = {}) {
  // .ctor (IL 0x411c): the fields' resting values
  const w = {
    handLeft: true, handRight: true, attacking: false, attacked: false, spellcasting: false, climbing: false, swimming: false,
    sheathed: false, usingRightHand: true, hasLightSource: false, lightSourceTemplateIndexLast: -1, lastLightSource: null, lastLightTemplateIndex: 0,
    hasDroppedOrThrownLight: false, isInThirdPerson: false,
    flipped: false, flippedCurrent: false, flippedLast: false, curAnimRect: { u0: 0, v0: 0, u1: 1, v1: 1 },
    textures: [], currentTexture: null, animTorchLength: 0, animLanternLength: 0, offsetFrame: -1, currentFrame: 0, animationTimer: 0,
    screenRect: { x: 0, y: 0, width: NATIVE_W, height: NATIVE_H }, screenRectLast: null, weaponOffsetHeight: 0, weaponOffsetHeightLast: 0,
    weaponScaleX: 1, weaponScaleY: 1,
    positionCurrent: { x: 0, y: 0, w: 0, h: 0 }, positionTarget: { x: 0, y: 0, w: 0, h: 0 },
    position: [0, 0], offset: [0, 0], scale: [1, 1],   // the published channels; Scale is zeroed each LateUpdate (0x1e9a) so the rect grows by it
    moveSmooth: 0, bobSmooth: [0, 0], inertiaCurrent: [0, 0], inertiaTarget: [0, 0], inertiaSpeedMod: 1, inertiaForwardCurrent: [0, 0], inertiaForwardTarget: [0, 0],
    throwTimer: 0, throwTime: 1, keysLast: new Set(), loop: null, loopVolume: 0, time: 0, s: settings(),
  };
  let ctx = null;
  let lightOffsetSet = null;   // the PlayerTorch position the mod last wrote (its transform keeps it)
  // DISC7: THE LOOP ANSWERS THE TORCH, NOT THE RIG'S CLOCK. The update below still starts it (a lit torch in the rig
  // that ticks), but a light that goes out - doused, stowed, dropped or burnt out from inside an open window, where the
  // host holds this rig's frame - stops it on the change itself (systems/lightSource.js), not on the next tick.
  // AUDIT DISC7 C1: subscribed by the UPDATE, as HT6's hand law is re-armed there - the mod's switch off disposes the
  // component (weaponRig: "the switch off is a teardown") and the switch back on runs the same component again, so a
  // subscription made once at birth was gone for the rest of the page after one toggle.
  const onLight = (entity, now) => {
    if (!w.loop || !ctx?.entity || entity !== ctx.entity || (now && isTorch(now))) return;
    w.loop.stop?.(); w.loop = null;
  };
  let offLight = null;

  const light = () => ctx?.entity?.lightSource ?? null;
  const items = () => ctx?.entity?.items ?? [];
  const hasFreeHand = () => w.handLeft || w.handRight;                            // get_HasFreeHand (0x251)
  const getFreeHand = () => (!hasFreeHand() ? FREE_HAND.None : w.handLeft ? FREE_HAND.Left : FREE_HAND.Right);   // get_GetFreeHand (0x266)
  const liveSpeed = () => (ctx?.entity ? liveStat(ctx.entity, 'speed') : 50);
  const offsetSpeedLive = () => liveSpeed() / 100 * w.s.offsetSpeed;             // get_offsetSpeedLive (0x27d)
  const contains = (group, template) => items().some((it) => it.group === group && it.templateIndex === template);
  const firstOf = (group, template) => getItem(items(), group, template, { allowEnchantedItem: true, allowQuestItem: true, priorityToConjured: false });
  const removeFromPack = (item) => { const l = items(); const i = l.indexOf(item); if (i >= 0) l.splice(i, 1); };
  const oneShot = (clip, volume = 1, pitch = 1) => audio?.playOneShot?.(clip, volume, pitch);
  const setLight = (it) => { if (ctx?.entity) setLightSource(ctx.entity, it); };   // DISC7: the one door

  // ---- InitializeTextures (IL 0x1034): 112359 records 0 (torch) and 1 (lantern), frames until one is missing ----
  const loadTextures = (renderer) => {
    if (w.texturesLoading || !renderer) return;
    w.texturesLoading = (async () => {
      const list = [];
      let torchLen = 0, lanternLen = 0;
      for (let record = 0; record <= 1; record++) {
        let frame = 0;
        for (;;) {
          const img = await loadSprite(record, frame).catch(() => null);
          if (!img) break;
          const tex = renderer.uploadTexture('img', `ht:${SPRITE_ARCHIVE}_${record}-${frame}`, img);
          list.push({ tex, width: img.width, height: img.height });
          frame++;
          if (frame >= 99) break;
        }
        if (record === 1) lanternLen = frame; else torchLen = frame;
      }
      w.textures = list; w.animTorchLength = torchLen; w.animLanternLength = lanternLen;
      w.currentTexture = list[0] ?? null;
      refreshSprite();
    })().catch((e) => console.warn('[handheld torches] the sprites would not load', e));   // TEX1: nothing awaits this promise, so a throw inside it was an UNHANDLED REJECTION that took the page down (Mac's crash) - the load fails to a console line and the mod runs without its sprite, as it does when the files are missing
  };

  // ---- RefreshSprite (0x26b8) and the three placements ----
  function refreshSprite() {
    if (!w.currentTexture) return;
    const l = light();
    if (l) w.offsetFrame = isLantern(l) ? 4 : 0;   // the lantern frames sit at index 4 - the torch's four (0x26f4)
    w.currentTexture = w.textures[w.currentFrame + w.offsetFrame] ?? w.currentTexture;
    if (w.s.lanternRelaxed && l && isLantern(l) && !hasFreeHand()) { setGuard(); return; }
    if (w.attacking) setAttack(); else setGuard();
  }
  const screenScale = () => {
    w.weaponScaleX = w.screenRect.width / NATIVE_W;
    w.weaponScaleY = w.s.lockAspectRatio ? w.weaponScaleX : w.screenRect.height / NATIVE_H;
  };
  const spriteW = () => (w.currentTexture?.width ?? 0) * w.s.scale * w.weaponScaleX / w.s.scaleTextureFactor;
  const spriteH = () => (w.currentTexture?.height ?? 0) * w.s.scale * w.weaponScaleY / w.s.scaleTextureFactor;
  /** SetGuard (0x2794): the rest - in from the side by half the screen times Offset.x, up from the bottom by a quarter times Offset.y. */
  function setGuard() {
    screenScale();
    const r = w.screenRect;
    const x = w.flipped ? r.x + r.width - r.width * 0.5 * w.s.offsetX : r.x + r.width * 0.5 * w.s.offsetX;
    w.positionTarget = { x, y: r.y + r.height - w.weaponOffsetHeight - r.height * 0.25 * w.s.offsetY, w: spriteW(), h: spriteH() };
  }
  /** SetAttack (0x2950): the bottom corner - the sprite's centre on it, so half of it shows. */
  function setAttack() {
    screenScale();
    const r = w.screenRect;
    w.positionTarget = { x: w.flipped ? r.x + r.width : r.x, y: r.y + r.height - w.weaponOffsetHeight, w: spriteW(), h: spriteH() };
  }
  /** SetSheathe (0x2aa8): a full height below the corner - off the screen. */
  function setSheathe() {
    screenScale();
    const r = w.screenRect;
    const h = spriteH();
    w.positionTarget = { x: w.flipped ? r.x + r.width : r.x, y: r.y + r.height - w.weaponOffsetHeight + h, w: spriteW(), h };
  }
  /** GetSpriteRect (0x11e4): the centre is positionCurrent's x,y moved
   *  by Position; the size grows by Scale; the offset in the rect's
   *  own size; the large HUD's floor; the Step snap. */
  function getSpriteRect() {
    let x = w.positionCurrent.x + w.position[0], y = w.positionCurrent.y + w.position[1];
    const width = w.positionCurrent.w + w.positionCurrent.w * w.scale[0], height = w.positionCurrent.h + w.positionCurrent.h * w.scale[1];
    x -= width * 0.5; y -= height * 0.5;
    x += width * w.offset[0]; y += height * w.offset[1];
    const floor = w.weaponOffsetHeight;
    y = Math.max(w.screenRect.height - height - floor, Math.min(w.screenRect.height, y));
    if (w.s.stepTransforms) {
      const interval = w.s.stepLength * (w.screenRect.height / 64);
      x = snap(x, interval); y = snap(y, interval);
    }
    return { x, y, w: width, h: height };
  }

  // ---- UpdateFreeHand (IL 0x2c44) ----
  function updateFreeHand() {
    w.handRight = true; w.handLeft = true;
    const slots = ctx?.entity?.equip?.slots ?? {};   // the table as it stands - read, never minted here (the rig's worn-item sync reads the same slot and must not see one appear)
    const left = slots[EQUIP_SLOTS.LeftHand] ?? null, right = slots[EQUIP_SLOTS.RightHand] ?? null;   // slot 21, slot 19
    // HT7: `isShield` stood here for the mod's sheathed arm alone, and
    // that arm is gone - what is WORN takes a hand now, shield or not.
    const isBow = (it) => weaponTypeForItem(it) === WEAPON_TYPES.Bow;
    // WeaponManager.Sheathed (ldfld 0x2c8a) and UsingRightHand (0x2cfc,
    // 0x2d5d) are read LIVE here, not the mod's own latched copies -
    // those are the edge detectors below in Update, written after this
    const sheathedNow = !!ctx?.sheathed, usingRightNow = ctx?.usingRightHand !== false;
    // HT7 (2026-09-17, Mac: "Take care of both") - THE PORT'S ONE DEPARTURE
    // FROM UpdateFreeHand, and it is about DAGGERFALL rather than about
    // the mod.
    //
    // The mod's sheathed arm (0x2c91-0x2cb8) clears a hand only for a BOW
    // in the left slot, on the premise that a sheathed weapon is away and
    // takes no hand. HT6 recorded the consequence - a shield equipped
    // while sheathed left the torch lit in the arm the shield had just
    // gone onto - defended it ("a Daggerfall shield is ARMOUR, strapped
    // rather than gripped, so a torch in that hand with the sword on your
    // back is a true reading") and flagged it for Mac. He has decided.
    //
    // AND THE DEFENCE WAS WRONG ABOUT THIS GAME. Daggerfall has no back
    // sheath. "Sheathed" here is WeaponManager's stance - the weapon is
    // lowered, still held, still drawn on screen the moment you swing -
    // and the port draws it that way. There is no state in which the
    // sword is on your back, so there is no state in which that hand is
    // free to hold a torch. Mac's original report is exactly this case:
    // "When equipping a shield or other offhand item, the torch in the
    // inventory isnt shown unequipped and replaced" - and with the weapon
    // sheathed, which is how a player walks around, it still was not.
    //
    // So WHAT IS WORN takes a hand whether the stance is sheathed or not,
    // and the ONE clause that stays stance-bound is the mod's own bare
    // right hand "in use" (0x2d53): an empty hand you are not swinging
    // with is free, which is what lets a weaponless player carry a light.
    // 3ARMS (2026-09-22, a player on Discord: "Torch and a Two-Handed
    // weapon simultaneously" - three arms on screen): the IL's
    // `GetItemHands() == 2` was read as LeftOnly because the port's own
    // ITEM_HANDS numbering puts LeftOnly at 2. DFU's enum is declared
    // None, Either, Both, LeftOnly, RightOnly (DaggerfallUnityEnums.cs
    // :526-533), so 2 is BOTH - and the mod's source says it in words:
    // `GetItemHands(itemRightHand) == ItemHands.Both //if right hand
    // item is two-handed, occupy the other hand even if free`
    // (HandheldTorches.cs:1323). The arm fired on nothing for as long
    // as the port has had it, so a lit torch stood beside every staff,
    // claymore and warhammer, and never stowed for a swing. The left
    // slot's arm (:1311) is the same compare: a Both-handed item or a
    // bow in the left takes the right.
    if (left) {
      w.handLeft = false;
      if (getItemHands(left) === ITEM_HANDS.Both || isBow(left)) w.handRight = false;
    } else if (!sheathedNow && !usingRightNow) w.handLeft = false;   // bare left hand, in use for punching (:1315) - stance-bound like the right's below
    if (right) {
      w.handRight = false;
      if (getItemHands(right) === ITEM_HANDS.Both) {
        // RelaxedTwoHandedWeapons: the off hand is taken for a bow, or
        // while a swing is in flight; strict: always (:1325-1332)
        if (w.s.twoHandedRelaxed) { if (isBow(right) || w.attacking) w.handLeft = false; }
        else w.handLeft = false;
      }
    } else if (!sheathedNow && usingRightNow) w.handRight = false;   // bare right hand, in use (0x2d53) - and only with the weapon up
    if (w.s.stowOnSpellcasting && w.spellcasting) { w.handRight = false; w.handLeft = false; }
    if (w.s.stowOnClimbing && w.climbing) { w.handRight = false; w.handLeft = false; }
    if (w.s.stowOnSwimming && w.swimming) { w.handRight = false; w.handLeft = false; }
    if (ctx?.transformedLycanthrope) { w.handRight = false; w.handLeft = false; }
    if (w.s.mirrorSprite) {
      // Ambidexterity (0x2de4): the sprite in the free hand; both busy keeps the last
      w.flippedCurrent = !!handedness();
      if (!w.handLeft && w.handRight) w.flippedCurrent = !w.flippedCurrent;
      else if (!w.handLeft && !w.handRight) w.flippedCurrent = w.flippedLast;
      if (w.flippedCurrent !== w.flippedLast) {
        w.flipped = w.flippedCurrent; w.flippedLast = w.flippedCurrent;
        w.curAnimRect = w.flipped ? { u0: 1, v0: 0, u1: 0, v1: 1 } : { u0: 0, v0: 0, u1: 1, v1: 1 };
        refreshSprite();
        const l = light();
        if (l) {
          // the PlayerTorch light moves to the hand the sprite is in (0x2ef2-0x2f66) - written on the flip alone
          const sign = w.flipped ? -1 : 1;
          lightOffsetSet = isLantern(l) ? { ...TORCH_LIGHT_AT.lantern } : { left: TORCH_LIGHT_AT.torch.left * sign, up: TORCH_LIGHT_AT.torch.up, forward: TORCH_LIGHT_AT.torch.forward };
          setPlayerTorchOffsetOverride(lightOffsetSet);
          setSheathe();
          w.positionCurrent = { ...w.positionTarget };
        }
      }
    } else w.flipped = !!handedness();
  }

  // ---- the actions ----
  /** DropLightSource (0x2fa8): a cast 1.45 forward from the body's
   *  centre, then 145 down from there; the light lands there with its
   *  condition's seconds; the pack loses it; the drop clip at the spot. */
  function dropLightSource(item) {
    const cam = ctx?.camera?.();
    const col = ctx?.collider?.();
    const centre = cam?.feet ? [cam.feet[0], cam.feet[1] + 0.9, cam.feet[2]] : (cam?.pos ? [cam.pos[0], cam.pos[1] - 0.8, cam.pos[2]] : [0, 0, 0]);
    const yaw = cam?.yaw || 0;
    const fwd = [Math.sin(yaw), 0, Math.cos(yaw)];   // the player OBJECT's forward - yaw alone
    let d = col?.raycast?.(centre, fwd, DROP_FORWARD_CAST);
    let at = Number.isFinite(d) ? [centre[0] + fwd[0] * d, centre[1] + fwd[1] * d, centre[2] + fwd[2] * d] : [centre[0] + fwd[0], centre[1] + fwd[1], centre[2] + fwd[2]];
    d = col?.raycast?.(at, [0, -1, 0], DROP_DOWN_CAST);
    at = Number.isFinite(d) ? [at[0], at[1] - d, at[2]] : [at[0], at[1] - 1, at[2]];
    torches()?.spawnLightSource(item.templateIndex, at, (item.currentCondition ?? 0) * SECONDS_PER_CONDITION);
    if (item === light()) setLight(null);
    removeFromPack(item);
    say(MESSAGES.drop + torchItemWords(item));
    audio?.play3d?.(CLIPS.drop, at, 1);
    w.hasDroppedOrThrownLight = true;
  }
  /** ThrowLightSource (0x3150): the projectile from the body's centre along the camera's look. */
  function throwLightSource(item, strength) {
    const cam = ctx?.camera?.();
    const centre = cam?.feet ? [cam.feet[0], cam.feet[1] + 0.9, cam.feet[2]] : (cam?.pos ? [cam.pos[0], cam.pos[1] - 0.8, cam.pos[2]] : [0, 0, 0]);
    torches()?.spawnLightSourceProjectile(item.templateIndex, (item.currentCondition ?? 0) * SECONDS_PER_CONDITION, centre, cam?.forward ?? [0, 0, 1], strength, getFreeHand());
    if (item === light()) setLight(null);
    removeFromPack(item);
    oneShot(CLIPS.throwSwing, 1, 1);   // PlayOneShot(106, pitchVariance 0, volumeScale 1)
    say(MESSAGES.throw + torchItemWords(item));
    w.hasDroppedOrThrownLight = true;
  }
  /** ThrowLightSourceAction (0x3238): the lit torch, else the first torch in the pack. */
  function throwLightSourceAction(l, strength) {
    if (l && isTorch(l)) { throwLightSource(l, strength); return; }
    const torch = contains('UselessItems2', T.Torch) ? firstOf('UselessItems2', T.Torch) : null;
    if (torch) throwLightSource(torch, strength); else say(MESSAGES.throwTorchless);
  }
  /** DropLightSourceAction (0x32b8): the lit light unless a lantern, else a torch, a candle, a holy candle; lanterns are never dropped. */
  function dropLightSourceAction(l) {
    if (l && !isLantern(l)) { dropLightSource(l); return; }
    for (const [group, template] of [['UselessItems2', T.Torch], ['UselessItems2', T.Candle], ['ReligiousItems', T.Holy_candle]]) {
      if (contains(group, template)) { dropLightSource(firstOf(group, template)); return; }
    }
    say(MESSAGES.dropTorchless);
  }
  /** QS4 - THE TOGGLE KEY'S OWN ARM, AS A DOOR. The mod's key presses
   *  this (0x17e1's first branch) and so does the port's own
   *  `QuickOffHand` action, which is the quickslot diamond's off-hand
   *  cell - the free-hand guard and the relaxed-lantern carve-out are
   *  the mod's, and a second copy at the second caller is how the two
   *  would drift. Answers whether it acted; a refusal has already said
   *  why. */
  function toggleLightPress() {
    if (w.s.lanternRelaxed) {
      if (hasFreeHand() || contains('UselessItems2', T.Lantern)) { toggleLightSourceAction(); return true; }
    } else if (hasFreeHand()) { toggleLightSourceAction(); return true; }
    say(MESSAGES.noFreeHand);
    return false;
  }

  /** ToggleLightSourceAction (0x33b8): douse the lit light; else the last stowed one; else the remembered kind; else a lantern, a torch, a candle, a holy candle. */
  function toggleLightSourceAction() {
    const l = light();
    if (l) {
      w.lastLightTemplateIndex = l.templateIndex;
      say(MESSAGES.douse + torchItemWords(l));
      setLight(null);
      oneShot(CLIPS.douse, 1, 1);
      return;
    }
    if (w.lastLightSource) { setLight(w.lastLightSource); w.lastLightSource = null; return; }
    w.lastLightSource = null;
    if (w.s.lastLight && w.lastLightTemplateIndex) {
      if (contains('UselessItems2', w.lastLightTemplateIndex)) setLight(firstOf('UselessItems2', w.lastLightTemplateIndex));
      else if (contains('ReligiousItems', w.lastLightTemplateIndex)) setLight(firstOf('ReligiousItems', w.lastLightTemplateIndex));
    }
    if (!light()) {
      if (contains('UselessItems2', T.Lantern)) setLight(firstOf('UselessItems2', T.Lantern));
      else if (contains('UselessItems2', T.Torch)) setLight(firstOf('UselessItems2', T.Torch));
      else if (contains('UselessItems2', T.Candle)) setLight(firstOf('UselessItems2', T.Candle));
      else if (contains('ReligiousItems', T.Holy_candle)) setLight(firstOf('ReligiousItems', T.Holy_candle));
      else say(MESSAGES.igniteTorchless);
    }
    const lit = light();
    if (lit) {
      w.lastLightTemplateIndex = lit.templateIndex;
      oneShot(CLIPS.ignite, 0.5, 1);   // PlayOneShot(16, pitchVariance 0, volumeScale 0.5): at half volume
      say(MESSAGES.ignite + torchItemWords(lit));
      refreshSprite();
    }
  }
  /** PickupLightSource's pack half (0x3d8a-0x3f9a): the pool hands the
   *  minted item over; by OnPick it lights (a free hand, or Force
   *  Equip sheathing the weapons) or stows, and "stow" remembers it as
   *  the light to take up when a hand frees. */
  function receivePickedUp(item) {
    if (!ctx?.entity) return;
    addItem(items(), item, 'back');
    const inst = w;
    if (inst.s.onPick > ON_PICK.Store && !light()) {
      if (hasFreeHand()) { setLight(item); say(MESSAGES.pickupEquip + torchItemWords(item)); }
      else if (inst.s.onPick === ON_PICK.ForceEquip && !w.sheathed) {
        ctx.sheathWeapons?.();
        setLight(item); say(MESSAGES.pickupEquip + torchItemWords(item));
      } else {
        say(MESSAGES.pickupStore + torchItemWords(item));
        if (!inst.lastLightSource) inst.lastLightSource = item;
      }
    } else say(MESSAGES.pickupStore + torchItemWords(item));
    oneShot(CLIPS.stow, 1, 1);
  }

  const clampStrength = (v) => Math.max(THROW_STRENGTH_MIN, Math.min(THROW_STRENGTH_MAX, v));

  /** THE HAND LAW (Update 0x15c6-0x1689), the mod's own block, lifted
   *  out of Update as a function so the EQUIP MOMENT can run the SAME
   *  code (HT6 below) instead of a second copy of the rule. `l` is the
   *  light Update read at the top of the frame. */
  function handLaw(l) {
    if (!hasFreeHand() && l && !isLantern(l)) {
      if (w.s.onStow > ON_STOW.Unequip) dropLightSource(l);
      else { w.lastLightSource = l; setLight(null); }
    } else if (!hasFreeHand() && l && isLantern(l) && !w.s.lanternRelaxed) {
      if (!w.sheathed) say(MESSAGES.noFreeHand);
      w.lastLightSource = l; setLight(null);
    } else if (hasFreeHand() && w.lastLightSource) {
      setLight(w.lastLightSource); w.lastLightSource = null;
    }
  }

  /** HT6 (2026-09-17, Mac: "When equipping a shield or other offhand
   *  item, the torch in the inventory isnt shown unequipped and
   *  replaced"): THE HAND LAW AT THE EQUIP MOMENT.
   *
   *  The law above is Update's, and the rig only runs Update on a frame
   *  the host is not holding for an overlay (weaponRig's frame, gated
   *  by `overlayHeld` at every host) - so a shield equipped in an OPEN
   *  inventory window did not reach the law until the window closed,
   *  and the window went on painting a lit torch (`lit:` in
   *  ui/enhancedInventory.js reads entity.lightSource at render time)
   *  beside the shield the player had just put on the same hand. The
   *  equip table fires its listeners inside equipItem / unequipSlot
   *  (equip.js's fireEquipChange), so the SAME block runs the moment
   *  the table changes and the window's own refresh paints the truth -
   *  and the reverse too, the shield coming off freeing the hand that
   *  takes `lastLightSource` back up.
   *
   *  NOTHING of the rule is restated here: UpdateFreeHand then the hand
   *  law, in Update's own order, over the settings Update reads fresh.
   *  What the mod would NOT stow stays held - a shield in the left hand
   *  with the weapon SHEATHED leaves a hand free by UpdateFreeHand's
   *  own sheathed arm (0x2c91-0x2cb8), and the torch stays lit. */
  const applyHandLaw = (entity) => {
    if (ctx?.entity !== entity) return;   // no frame has run yet (no ctx to read sheathed from), or this is another host's wearer
    w.s = settings();
    updateFreeHand();
    handLaw(light());
  };

  // ---- Update (IL 0x13b0) ----
  /**
   * @param dt   the frame's seconds
   * @param c    the frame: { renderer, canvas, entity, machine, sheathed, usingRightHand, castPlaying, spellArmed, thirdPerson,
   *             climbing, swimming, transformedLycanthrope, motion: {...}, look, swingHeld, cursorActive, camera() -> { pos, feet, yaw, pitch, forward, right },
   *             collider(), keyDown(code), sheathWeapons() }
   */
  function update(dt, c) {
    ctx = c;
    offLight ??= addLightSourceListener(onLight);   // AUDIT DISC7 C1: (re)armed with the frame
    _liveHandLaw = applyHandLaw;   // HT6: this host has the player, so this component answers the equip change
    w.s = settings();
    w.time += dt;
    if (!w.textures.length) loadTextures(c.renderer);
    const l = light();
    updateFreeHand();
    // the burning loop (0x13d9-0x1487): a lit TORCH plays it, anything else stops it
    const wantLoop = w.s.playAudio && l && isTorch(l);
    if (wantLoop && (!w.loop || w.loopVolume !== w.s.sfxVolume)) { w.loop?.stop?.(); w.loop = audio?.loop?.(CLIPS.burning, w.s.sfxVolume) ?? null; w.loopVolume = w.s.sfxVolume; }
    else if (!wantLoop && w.loop) { w.loop.stop?.(); w.loop = null; }
    // the sheathe edges and the hand edges (0x1487-0x15c6): a relaxed lantern re-rests on either
    if (!c.sheathed) { if (w.sheathed) w.sheathed = false; }
    else if (!w.sheathed) { w.sheathed = true; if (w.s.lanternRelaxed && l && isLantern(l) && hasFreeHand()) setGuard(); }
    if (c.usingRightHand !== false) { if (!w.usingRightHand) { w.usingRightHand = true; if (w.s.lanternRelaxed && l && isLantern(l) && hasFreeHand()) setGuard(); } }
    else if (w.usingRightHand) { w.usingRightHand = false; if (w.s.lanternRelaxed && l && isLantern(l) && hasFreeHand()) setGuard(); }
    handLaw(l);
    // the sprite's frames (0x1689-0x175a): a torch's or a lantern's, a candle has none
    if (w.s.showSprite) {
      const cur = light();
      w.offsetFrame = cur ? (isLantern(cur) ? 4 : isTorch(cur) ? 0 : -1) : -1;
      if (w.offsetFrame !== -1) {
        if (w.animationTimer > ANIMATION_TIME) {
          w.animationTimer = 0;
          const len = w.offsetFrame === 4 ? w.animLanternLength : w.animTorchLength;
          w.currentFrame = w.currentFrame < len - 1 ? w.currentFrame + 1 : 0;
          w.currentTexture = w.textures[w.offsetFrame + w.currentFrame] ?? w.currentTexture;
        } else w.animationTimer += dt;
      }
    }
    // the light's edges (0x175a-0x17e1): a light taken up, or its kind changed, re-rests the sprite
    let refresh = false;
    const cur = light();
    if (cur) {
      if (!w.hasLightSource) { w.hasLightSource = true; if (isTorch(cur) || isLantern(cur)) refresh = true; }
      if (w.lightSourceTemplateIndexLast !== cur.templateIndex) { w.lightSourceTemplateIndexLast = cur.templateIndex; if (isTorch(cur) || isLantern(cur)) refresh = true; }
    } else if (w.hasLightSource) { w.hasLightSource = false; w.lightSourceTemplateIndexLast = -1; }
    if (refresh) refreshSprite();
    // the keys (0x17e1-0x19f4): GetKeyDown, GetKey, GetKeyUp of the three KeyCodes
    const down = (code) => !!code && !!c.keyDown?.(code);
    const pressed = (code) => down(code) && !w.keysLast.has(code);
    const released = (code) => !down(code) && !!code && w.keysLast.has(code);
    if (pressed(w.s.toggleKey)) toggleLightPress();
    if (pressed(w.s.dropKey)) { if (hasFreeHand()) dropLightSourceAction(light()); else say(MESSAGES.noFreeHand); }
    if (pressed(w.s.throwKey)) {
      if (contains('UselessItems2', T.Torch)) {
        if (!hasFreeHand()) say(MESSAGES.noFreeHand);
        else {
          const lit = light();
          // the wind-up douses the lit light - a relaxed lantern excepted (0x18d9-0x1904)
          if (lit && !(w.s.lanternRelaxed && isLantern(lit))) setLight(null);
        }
      } else say(MESSAGES.throwTorchless);
    }
    if (down(w.s.throwKey) && contains('UselessItems2', T.Torch) && hasFreeHand()) {
      w.throwTimer += dt * w.s.throwScale;
      // AUDIT 66 F9: DrawTrajectory is NOT run here. The mod feeds its
      // 300 integration steps to a LineRenderer (0x1e4a-0x1e60); this
      // renderer has no world-space line - `drawMeshWire` wants a
      // mesh's own edge buffer (render/renderer.js) and the only other
      // gl.LINES is the 2D world map's - so the arc had no consumer and
      // the port was spending 300 steps and up to 300 raycasts a frame
      // on points nothing could see. The LAW is kept whole and pinned
      // as `throwArcPoints` below, for the host that can draw it;
      // `Throwing.ShowTrajectory` is inert until then, and says so on
      // the pane, beside EmissionShadows.
    }
    if (released(w.s.throwKey)) {
      if (hasFreeHand()) throwLightSourceAction(light(), clampStrength(w.throwTimer / w.throwTime)); else say(MESSAGES.noFreeHand);
      w.throwTimer = 0;
    }
    w.keysLast = new Set([w.s.toggleKey, w.s.dropKey, w.s.throwKey].filter((k) => k && down(k)));
    // the dropped torches' burn (0x19f4-0x1bdc) is the pool's tick - the host runs it
  }

  // ---- LateUpdate (IL 0x1e74) ----
  function lateUpdate(dt, c) {
    ctx = c;
    const l = light();
    w.position = [0, 0]; w.offset = [0, 0]; w.scale = [0, 0];
    w.attacking = !!c.machine && c.machine.state !== 'Idle';
    if (c.castPlaying || c.spellArmed) { if (!w.spellcasting) w.spellcasting = true; } else if (w.spellcasting) w.spellcasting = false;
    w.climbing = !!c.climbing; w.swimming = !!c.swimming;
    const m = c.motion ?? {};
    if (!l || w.offsetFrame < 0) {
      // no sprite to place: it slides off (0x25d9-0x26a8), thrice as fast; a drop or throw jumps it off
      setSheathe();
      if (w.hasDroppedOrThrownLight) { w.positionCurrent = { ...w.positionTarget }; w.hasDroppedOrThrownLight = false; return; }
      if (w.s.lanternRelaxed && !hasFreeHand()) { w.positionCurrent = { ...w.positionTarget }; return; }
      const p = moveTowards2([w.positionCurrent.x, w.positionCurrent.y], [w.positionTarget.x, w.positionTarget.y], dt * offsetSpeedLive() * 3);
      w.positionCurrent = { x: p[0], y: p[1], w: w.positionTarget.w, h: w.positionTarget.h };
      return;
    }
    w.screenRect = { x: 0, y: 0, width: c.canvas?.width ?? NATIVE_W, height: c.canvas?.height ?? NATIVE_H };
    w.weaponOffsetHeight = weaponOffsetHeight();
    const rectChanged = !w.screenRectLast || w.screenRectLast.width !== w.screenRect.width || w.screenRectLast.height !== w.screenRect.height;
    if (rectChanged || w.weaponOffsetHeight !== w.weaponOffsetHeightLast) refreshSprite();
    w.screenRectLast = { ...w.screenRect }; w.weaponOffsetHeightLast = w.weaponOffsetHeight;
    if (w.s.lanternRelaxed && isLantern(l) && !hasFreeHand()) setSheathe();
    else if (w.attacking) { if (!w.attacked) { w.attacked = true; setAttack(); } }
    else if (w.attacked) { w.attacked = false; refreshSprite(); }
    const p = moveTowards2([w.positionCurrent.x, w.positionCurrent.y], [w.positionTarget.x, w.positionTarget.y], dt * offsetSpeedLive());
    w.positionCurrent = { x: p[0], y: p[1], w: w.positionTarget.w, h: w.positionTarget.h };
    const baseSpeed = Number.isFinite(m.baseSpeed) ? m.baseSpeed : 1;
    const speedRatio = Number.isFinite(m.speedRatio) ? m.speedRatio : 1;
    const atRest = w.positionCurrent.x === w.positionTarget.x && w.positionCurrent.y === w.positionTarget.y
      && w.positionCurrent.w === w.positionTarget.w && w.positionCurrent.h === w.positionTarget.h;
    // Bob (0x2198-0x236c): at rest and not attacking - the widget's law, the sideways term signed by the hand
    if (w.s.bob && !w.attacking && atRest) {
      const shape = w.s.bobShape;
      const moveMul = m.grounded === false ? 0 : 1;
      w.moveSmooth = moveTowards(w.moveSmooth, moveMul, dt * w.s.moveSmoothSpeed);
      let s = speedRatio;
      if (m.crouching) s *= 0.5;
      if (m.riding) s *= 0.5;
      if (m.standing) s = w.s.bobWhileIdle ? 0.1 : 0;
      const rate = baseSpeed * 1.25 * s * w.s.bobLength;
      const rate2 = rate * 2;
      const amp = 0.01;
      const size = [w.screenRect.width * amp * s * w.s.bobSizeXMod, w.screenRect.height * amp * s * w.s.bobSizeYMod];
      const xMin = w.flipped ? -1 : 1, yMax = 1;
      const target = [
        (xMin + Math.sin(w.s.bobOffset + w.time * rate)) * -size[0],
        (yMax - Math.sin(w.s.bobOffset + shape + w.time * rate2)) * size[1],
      ];
      const eased = moveTowards2(w.bobSmooth, target, dt * w.s.bobSmoothSpeed);
      w.bobSmooth = [eased[0] * w.moveSmooth, eased[1] * w.moveSmooth];
      w.position = [w.position[0] + w.bobSmooth[0], w.position[1] + w.bobSmooth[1]];
    }
    // Inertia (0x2371-0x25d8): attacking or sliding resets it; the look and the body's motion lag the sprite, forward motion grows it
    if (w.s.inertia) {
      if (w.attacking || !atRest) {
        w.inertiaCurrent = [0, 0]; w.inertiaTarget = [0, 0]; w.inertiaForwardCurrent = [0, 0]; w.inertiaForwardTarget = [0, 0];
        return;
      }
      const lv = m.localVel ?? [0, 0, 0];
      const clamp1 = (v) => Math.max(-1, Math.min(1, v));
      const mx = clamp1(lv[0] / 10);
      const my = m.grounded === false ? clamp1(lv[1] / 10) : 0;
      const mz = clamp1(lv[2] / 10);
      const look = c.look ?? [0, 0];
      if (!c.cursorActive && c.swingHeld) w.inertiaTarget = [-mx * 0.5 * w.s.inertiaScale, 0];
      else w.inertiaTarget = [-(look[0] + mx) * 0.5 * w.s.inertiaScale, (look[1] + my) * 0.5 * w.s.inertiaScale];
      w.inertiaSpeedMod = w.s.inertiaScale > 0 ? Math.hypot(w.inertiaCurrent[0] - w.inertiaTarget[0], w.inertiaCurrent[1] - w.inertiaTarget[1]) / w.s.inertiaScale : 0;
      let speedMul = (w.inertiaTarget[0] !== 0 || w.inertiaTarget[1] !== 0) ? 3 : 1;
      w.inertiaCurrent = moveTowards2(w.inertiaCurrent, w.inertiaTarget, dt * w.s.inertiaSpeed * w.inertiaSpeedMod * speedMul);
      w.position = [w.position[0] + w.inertiaCurrent[0], w.position[1] + w.inertiaCurrent[1]];
      speedMul = (w.inertiaForwardTarget[0] !== 0 || w.inertiaForwardTarget[1] !== 0) ? 3 : 1;
      w.inertiaForwardTarget = [mz * w.s.inertiaForwardScale, mz * w.s.inertiaForwardScale];
      w.inertiaForwardCurrent = moveTowards2(w.inertiaForwardCurrent, w.inertiaForwardTarget, dt * w.s.inertiaForwardSpeed * speedMul);
      w.scale = [w.scale[0] + w.inertiaForwardCurrent[0], w.scale[1] + w.inertiaForwardCurrent[1]];
    }
  }

  /** OnGUI (IL 0x114c): the sprite, while the module shows it and the
   *  view is first person.
   *
   *  MAC-H (2026-09-17, Mac: "On the classic sprite, when a torch is
   *  unequipped, a random sprite is shown on the left middle of the
   *  screen"). THE HAND HOLDS NOTHING, SO IT DRAWS NOTHING. The only
   *  gates here were the module's switch and "is there a texture at
   *  all" - and `w.currentTexture` is set ONCE, to `list[0]`, the
   *  moment InitializeTextures finishes (:234), and is never cleared
   *  again. So from the first frame after the sprites loaded, every
   *  host drew torch frame 0 at the guard position, with or without a
   *  torch in the player's hand: the left middle of the screen, which
   *  is exactly where SetGuard puts it, showing the one sprite the
   *  player never asked for.
   *
   *  The frame law above already knows the answer - `offsetFrame` is
   *  -1 for no light and for a CANDLE, which has no frames - but it
   *  is computed in Update and this is a draw, so the light is asked
   *  again here rather than trusting an ordering. A hand with a candle
   *  in it draws nothing, as it always should have: the mod ships
   *  frames for the torch (record 0) and the lantern (record 1), and
   *  for nothing else.
   *
   *  MAC-I: the tint is the room's now, not white. FPSWeapon.Tint is
   *  First-Person Lighting's own channel and DFU core never writes it
   *  (FPSWeapon.cs:108, :182) - the port writes it from the light the
   *  scene's flats take, so the hand goes dark with the room it is in.
   *  A host that hands no tint gets white, byte for byte. */
  function draw(renderer, canvas, tint = null) {
    if (!w.s.showSprite || !ctx || !renderer || !canvas) return false;
    if (ctx.thirdPerson || w.isInThirdPerson) return false;
    const held = light();
    if (!held || !(isTorch(held) || isLantern(held))) return false;   // MAC-H: nothing in the hand, nothing on the screen
    if (!w.currentTexture?.tex) return false;
    renderer.drawScreenQuad(w.currentTexture.tex, getSpriteRect(), w.curAnimRect, tint ?? undefined);
    return true;
  }

  /** DISC6 (Discord, 2026-09-23: "sometimes even when putting it away it still makes the torch sound"): THE LOOP GOES
   *  WITH THE RIG THAT LEAVES. Every host mode has its own rig (the street's, the building's, the dungeon's) and each
   *  rig's component starts and stops its own burning loop in its own update - so a torch lit in the street kept the
   *  street rig's loop sounding through a door (that rig no longer ticks), the building's rig started a second, and
   *  stowing the torch indoors stopped only that one. A host calls this for the rig it leaves; the rig that takes the
   *  frame starts the loop again on its next update if the torch still burns. Only the sound: the torch is the
   *  entity's, not the rig's. */
  function silence() { w.loop?.stop?.(); w.loop = null; }
  function dispose() { offLight?.(); offLight = null; w.loop?.stop?.(); w.loop = null; if (lightOffsetSet) { setPlayerTorchOffsetOverride(null); lightOffsetSet = null; } if (_liveHandLaw === applyHandLaw) _liveHandLaw = null; }   // HT6: a torn-down component stops answering the equip change

  return {
    update, lateUpdate, draw, dispose, silence, receivePickedUp,
    toggleLightSourceAction, dropLightSourceAction, throwLightSourceAction, toggleLightPress,
    get hasFreeHand() { return hasFreeHand(); },
    get freeHand() { return getFreeHand(); },
    get flipped() { return w.flipped; },
    get rect() { return getSpriteRect(); },
    get positionTarget() { return { ...w.positionTarget }; },
    get positionCurrent() { return { ...w.positionCurrent }; },
    get settings() { return w.s; },
    get lastLightSource() { return w.lastLightSource; },
    get throwStrength() { return clampStrength(w.throwTimer / w.throwTime); },   // AUDIT 66 F9: the wind-up a host would draw the arc at
    get burning() { return !!w.loop; },
    _w: w,
  };
}

/** The default sprite loader: the vendored PNG, decoded in the browser
 *  into the port's color32 order. */
async function defaultLoadSprite(record, frame) {
  const res = await fetch(spriteUrl(record, frame));
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  return toScreenOrder(await decodePng(bytes));   // TEX1: `{ width, height, colors }` - the shape uploadTexture reads; HT3: and the rows as the PNG has them, because this one is drawn on a SCREEN quad (toColor32's flip put the flame under the hand)
}

/**
 * DrawTrajectory (IL 0x1bec), whole, as a pure law: the thrown torch's
 * arc from the free hand, integrated on Unity's fixed step until it
 * meets a wall or runs 300 steps out. The mod feeds these points to a
 * LineRenderer; this port has no world-space line to draw them with
 * (AUDIT 66 F9), so nothing calls this yet - it is kept because it IS
 * the mod's arithmetic and because the arc must match the flight the
 * pool integrates (scenes/droppedTorches.js): the two forms differ in
 * the IL - the flight scales its gravity by fixedDeltaTime and adds it
 * as a displacement (0x47c3-0x481f), the arc accumulates 9.8 x 0.05 x
 * GravityStrength as a VELOCITY and scales the sum (0x1d96-0x1dcc) -
 * and they come out the same curve. Both are kept as written.
 *
 * @param {object} p  { origin (the body's centre), forward, right, freeHand, strength (the wind-up, clamped),
 *                      throwAngle, throwGravity, throwStrength, bodyStrength (the caster's live STR), collider }
 * @returns {number[][]} the points, the first at the hand
 */
export function throwArcPoints({
  origin, forward = [0, 0, 1], right = [1, 0, 0], freeHand = FREE_HAND.Right, strength = 1,
  throwAngle = 0, throwGravity = 1, throwStrength = 1, bodyStrength = 50, collider = null,
} = {}) {
  const side = freeHand === FREE_HAND.Right ? THROW_HAND_OFFSET : -THROW_HAND_OFFSET;
  let pos = [origin[0] + right[0] * side, origin[1] + right[1] * side, origin[2] + right[2] * side];
  const points = [pos];
  const dir = rotateAboutAxis(forward, right, -throwAngle);
  const speed = TRAJECTORY_SPEED * (bodyStrength / 100) * throwStrength * strength;
  const vel = [dir[0] * speed, dir[1] * speed, dir[2] * speed];
  let gravity = [0, 0, 0];
  for (let i = 0; i < TRAJECTORY_STEPS; i++) {
    gravity = [gravity[0], gravity[1] - TRAJECTORY_GRAVITY * (throwGravity * 0.05), gravity[2]];
    const step = [(vel[0] + gravity[0]) * TRAJECTORY_FIXED_DT, (vel[1] + gravity[1]) * TRAJECTORY_FIXED_DT, (vel[2] + gravity[2]) * TRAJECTORY_FIXED_DT];
    const len = Math.hypot(step[0], step[1], step[2]) || 1;
    const d = collider?.raycast?.(pos, [step[0] / len, step[1] / len, step[2] / len], len);
    if (Number.isFinite(d)) { points.push([pos[0] + step[0] / len * d, pos[1] + step[1] / len * d, pos[2] + step[2] / len * d]); break; }
    pos = [pos[0] + step[0], pos[1] + step[1], pos[2] + step[2]];
    points.push(pos);
  }
  return points;
}

/** Quaternion.AngleAxis(deg, axis) * v: Rodrigues' rotation. */
export function rotateAboutAxis(v, axis, deg) {
  const len = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const k = [axis[0] / len, axis[1] / len, axis[2] / len];
  const t = deg * Math.PI / 180, ct = Math.cos(t), st = Math.sin(t);
  const dot = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const cross = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return [
    v[0] * ct + cross[0] * st + k[0] * dot * (1 - ct),
    v[1] * ct + cross[1] * st + k[1] * dot * (1 - ct),
    v[2] * ct + cross[2] * st + k[2] * dot * (1 - ct),
  ];
}

export { isLightSource };
