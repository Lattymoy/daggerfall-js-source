// The FP-weapon HOST RIG (C9): one bundle of the classic-weapon
// surface for hosts that own a motor but had NO weapon - the interior
// mode and both exterior walk hosts (the weapon-audit follow-up: "the
// voxel path was dungeon-only too"). Every law here mirrors the
// AUDITED dungeon implementation (dungeonContext.js) verbatim:
// WeaponManager's sheathe/ShowWeapons legs, FPSWeapon's bow guards,
// the drag-to-swing gesture seam, the swing-sound edge, and the
// WeaponEnvDamage swing ray. dungeonContext keeps its own inline copy
// FOR NOW - that file is the parallel FP lane's active surface and
// has conflicted on every merge today; folding it onto this rig is a
// recorded residual (Combat.md), not an accident.
//
// a12: and the HAND. The rig is where WeaponManager's per-frame
// UpdateHands/ApplyWeapon pair lands (syncWorn) and where SwitchHand's
// release edge arrives (switchHand); the state and the laws themselves
// are playerWeapon's.
//
// Hosts without foes still get the full classic feel: ready/sheathe
// on Z (DrawWeapon 78 on unsheathing a real weapon), H to switch the
// swinging hand, RMB drag or
// click to swing with the pitch-matched swing sound, bows consuming
// an Arrow per loose with the zero-arrow auto-sheathe, and the
// optional environment-attack ray (interiors: bash/Receive on action
// objects; open exteriors have nothing in reach).

import { PlayerWeapon, WEAPON_REACH } from './playerWeapon.js';
import { eotbBody } from '../player/eotbBody.js';   // EOTB5: the sprite body, for a player with no Morrowind data
import { eotbCamera } from '../player/eotbCamera.js';
import { racialFpsWeapon } from '../systems/lycanthropy.js';   // V4: the transformed rig's claws
import { EQUIP_SLOTS, equipTableOf } from '../systems/equip.js';   // AUDIT 17e F17; MW-D32 the worn read
import { dfWornEquipment } from '../formats/mwItemMap.js';   // MW-D32
import { ARMOR_ENUM } from './enemyEquipment.js';   // MW-D32
import { loadFpsWeaponArt, drawFpsWeapon, weaponTypeForItem, WEAPON_TYPES, fpLightingOn } from './fpsWeapon.js';   // MAC-I: the tint's switch, with the sprite it tints
// ROAD-tail (FPSSpellCasting.cs): the classic spellcasting HANDS. A
// separate component in DFU and a separate module here, drawn by the
// same rig because this is the one surface every FPS-weapon host
// already mounts - so wiring it here wires all four at once.
import { fpsSpellCasting, loadSpellCastArt, drawSpellCastHands, magicAnimFilename } from './fpsSpellCasting.js';
// MW-D8: the classic sprite is still the DEFAULT and still the fallback,
// and runs untouched otherwise. The Morrowind arm below is an opt-in
// layer that either draws whole or does not draw at all - there is no
// state in which both reach the screen, and none in which neither does.
import { fpArm, hasDaggerfallArrows, daggerfallArrowCount } from './fpArm.js';
import { getPref } from '../systems/uiPrefs.js';   // MWA1: the arms switch
import { morrowindDataCount, morrowindDataFingerprint, registerMorrowindData } from '../scenes/dataSource.js';   // MWA1: are the archives attached; AUDIT 65 XL-6: and measured
import { mwRaceId } from '../formats/mwNpc.js';   // TR2: the one race-id spelling
import { TEMPLATES } from '../systems/useItem.js';   // MW-D51: the Torch template - the lit light the Morrowind hand holds
import { morrowindDataGeneration } from '../scenes/dataSource.js';
import { objectAabb, rayAabb } from '../player/activate.js';   // AUDIT 63 F37: one live box for both rays
import { SOUND } from '../systems/soundClips.js';
import { equipSoundFor } from '../characters/weapons.js';   // F023: GetEquipSound
import { setMidScreenText } from '../ui/midScreenText.js';   // AUDIT 64 F34: FPSWeapon.cs:365's mid-screen line
import { createWeaponWidget } from './weaponWidget.js';
// SW1: SHIELD WIDGET. The sibling, beside the weapon's clone and driven
// on the same frame - the shield the game never drew, in the hand the
// weapon is not in.
import { createShieldWidget } from './shieldWidget.js';
import { shieldWidgetTextures, shieldWidgetImage } from './shieldWidgetAssets.js';
import { setAttackOnPlayerHook } from './formulas.js';   // SW1: PCAAO's onAttackDamageCalculated, for the Recoil module
import { conditionPercentage } from '../systems/itemInfo.js';   // SW1: the condition tier
import { isShieldTemplate } from '../systems/armorMaterials.js';   // SW1: GetShieldProtectedBodyParts' own test
import { createHandheldTorches, isHeldLight } from '../systems/handheldTorches.js';   // HT1: Handheld Torches' component, one per rig beside the widget; TORCH-VIS: and its own light test
import { isTransformedLycanthrope, liveLycanthropy } from '../systems/lycanthropy.js';   // WW1: Weapon Widget's FPSWeaponClone, beside the machine; AUDIT-EOTB2: the sprite's form
import { concealmentFlags } from '../systems/effects.js';   // EOTB-IL: PlayerBillboard.UpdateMaterial reads the player's own IsInvisible / IsAShade / IsBlending
import { getBool } from '../systems/settings.js';   // EOTB-IL: PlayerBillboard.LateUpdate reads DaggerfallUnity.Settings.BowDrawback
import { domCodeForKeyCode } from '../systems/keyCodes.js';   // AUDIT-EOTB2: the mod's two keys, polled off the hosts' raw set as the torch mod's are
import { modSetting } from '../systems/modSettings.js';   // WW1: its Enabled
import { takeFrameLook } from '../player/lookFilter.js';   // WW1: the frame's look for the widget's inertia
import { cursorActive } from '../player/pointerLock.js';   // WW1: PlayerMouseLook.cursorActive
import { liveStat } from '../systems/statMods.js';   // WW1: the widget's speed ratio
import { walkSpeed } from '../player/motor.js';   // WW1: GetBaseSpeed's walk arm

/**
 * TR2: THE ARMS-BUILD OPTS, ONE HOME. The pause card and the Test
 * Room boot both translate the LIVE ENTITY into fpArm.build's
 * options; two copies of that translation is how the card built one
 * character while the frame followed another. It lives here because
 * this module already owns the per-frame half of the same seam
 * (setWeapon/setWorn below read the same table).
 *
 * AND THE GENDER FIX: `gender` is the STRING 'male'/'female'
 * everywhere in this port (chargen.js applyCharacter,
 * classicSave.js:691), so the card's old `female: !!playerEntity
 * .gender` was TRUE FOR EVERYONE - every build asked for the female
 * skeleton and the female body columns, and the male-record fallback
 * fills made it look almost right. The test is the string compare,
 * the same one every other consumer makes.
 */
export function armBuildOptsOf(entity) {
  return {
    race: mwRaceId(entity.race),
    female: entity.gender === 'female',
    faceIndex: entity.faceIndex | 0,
    armor: dfWornEquipment(equipTableOf(entity), EQUIP_SLOTS, ARMOR_ENUM),
    weapon: entity.equip?.slots?.[EQUIP_SLOTS.RightHand] ?? null,
    hasAmmo: hasDaggerfallArrows(entity.items),
    ammoCount: daggerfallArrowCount(entity.items),   // WS1: the quiver
    torch: isLitTorch(entity.lightSource),   // MW-D51: the lit light, in the left hand
    sheathing: getPref('mwSheathing'),   // WS1: the holster on the third-person body
  };
}

/** MW-D51: IS A TORCH LIT - PlayerEntity.LightSource holding the Torch
 *  item (TEMPLATES.Torch, 247). A lantern or a candle is a light too,
 *  but Morrowind's held-light art is the torch, and the classic lane's
 *  hand sprite covers the rest as it always has. */
export const isLitTorch = (item) => !!item && item.templateIndex === TEMPLATES.Torch;

/** The build itself, from the live entity - seconds long and
 *  synchronous (the BSA index, the ESM walk, every mesh parse), so
 *  callers run it at a pause or a boot, never per frame. */
export function buildArmsFor(entity) {
  return fpArm.build(armBuildOptsOf(entity));
}

/** MWA3: the IDENTITY third of armBuildOptsOf - the three inputs that
 *  pick the skeleton (sex, and the race's beast bit), the body rows
 *  (race and sex) and the head (face). The worn set and the hand are
 *  the other two thirds, and setWorn/setWeapon already follow those
 *  per frame; nothing followed these. */
export function armIdentityOf(entity) {
  return { race: mwRaceId(entity?.race), female: entity?.gender === 'female', faceIndex: entity?.faceIndex | 0 };
}

/** MWA3 (Mac, 2026-09-16: "my character who is an argonian uses a human
 *  morrowind model"): DOES THE STANDING ARM BELONG TO THIS ENTITY?
 *  autoBuildArms's last gate used to be `fpArm.ready()` alone - "a
 *  second door does not rebuild a built arm" - and fpArm is ONE module
 *  singleton for the whole session. So the first identity to reach a
 *  door owned the arm for good: a save loaded in-session over a
 *  standing arm (the wizard's character, an earlier save, a ?test
 *  preset) kept that arm's race, sex and face, and every equip-follow
 *  rebuild after it (fpArm.setWorn spreads lastBuildOpts) carried the
 *  stale identity forward, so nothing short of the pack's Off/On ever
 *  asked for the Argonian's beast skeleton, tail and hide. A standing
 *  arm is "built" only when it stands FOR the entity at the door. */
/** MWA3: the standing arm's identity, for a host's debug read (world.js's
 *  window.__weaponDebug) - null before any build. */
export function armBuiltFor() { return fpArm.builtFor(); }
/** MWA3: is an arm standing at all - the same read autoBuildArms's old gate made. */
export function armsReady() { return fpArm.ready(); }

export function armsStandFor(entity, { ready = () => fpArm.ready(), builtFor = () => fpArm.builtFor() } = {}) {
  if (!ready()) return false;
  const have = builtFor();
  if (!have) return false;
  const want = armIdentityOf(entity);
  return have.race === want.race && !!have.female === want.female && (have.faceIndex | 0) === want.faceIndex;
}

/** MWA1: THE ARMS AT BOOT. RookieG (2026-09-11): "morrowind arms did
 *  not work on first launch" - only the test room built them at boot;
 *  a normal game had the arms only after the Enhanced pane's Build
 *  button, and the module singleton dies with the tab, so every launch
 *  began bare. The pane's Build now sets the `mwArms` pref and Unload
 *  clears it, and each host that owns a rig calls this once the entity
 *  is a made character - at its rig's creation for a continuing
 *  session, after the wizard for a new one, after a restore for a
 *  load. A refusal is logged, never thrown: the arms are a departure
 *  the classic sprite stands in for. Returns the build's result, or
 *  null when nothing was asked for. */
export async function autoBuildArms(entity, { wanted = () => getPref('mwArms'), dataCount = morrowindDataCount, measure = registerMorrowindData, measured = morrowindDataFingerprint, standing = armsStandFor } = {}) {
  if (!entity?.chargenDone || !wanted() || !(dataCount() > 0) || standing(entity)) return null;
  // AUDIT 65 XL-6: the boot menu only COUNTS the store now (names, no
  // sizes), so this can run before the host bootstrap's fingerprint
  // lands - and fpArm keys its kept face verdict on that print. Measure
  // first, as the pane's Build button does, so the verdict is a lookup
  // and not a dozen mesh parses on every launch.
  if (measured() == null) await measure().catch(() => 0);
  const res = await buildArmsFor(entity);
  if (!res?.ok && !res?.queued) console.warn(`[arms] boot build refused - ${res?.stage}: ${res?.error}`);   // AUDIT MW-TORCH F6: a build queued behind one in flight is not a refusal
  return res;
}

/**
 * @param deps {
 *   renderer, canvas, fetchBytes, palette, audio,
 *     (canvas may be the element OR a () => element - the dungeon
 *      context only holds a canvas per frame, C10),
 *   entity          - the player entity (arrow stock reads it),
 *   say(line)       - the classic-message sink ('You have no arrows.').
 *                     The note that hosts without a HUD text layer
 *                     pass console is retired: every call site hands
 *                     over a real one - hudText.add
 *                     (dungeonContext.js:2670), townTalk.say
 *                     (exterior.js:1827, world.js:3091) and
 *                     worldModes' own interior sink (worldModes.js:393,
 *                     which warns to console only where a host mounts
 *                     no townTalk at all), so the empty default below
 *                     is unreached,
 *   spellArmed()    - optional: WeaponManager's HasReadySpell leg
 *                     (hosts without casting omit it),
 *   abortSpell()    - MAC-O1: EntityEffectManager.AbortReadySpell, the
 *                     other half of that leg. WeaponManager.Update
 *                     :251 calls it on the ReadyWeapon key, which is
 *                     the ONE place in DFU where the weapon key
 *                     touches the spell; a host that readies spells
 *                     must hand it over or Z cannot put one away,
 * }
 */
export function createWeaponRig({ renderer, canvas, fetchBytes, palette, audio, entity, camera = null, say = () => {}, spellArmed = () => false, abortSpell = () => {}, bindWorn = true, activateHeld = () => false, envHit = null, missEffect = null, collider = null, keyDown = null, torches = () => null }) {   // HT1: the hosts' raw key set and their dropped-torch pool   // AUDIT 28 W12: HasAction(ActivateCenterObject) - the drawn bow's un-draw; WW1: the widget's recoil doors
  const playerWeapon = new PlayerWeapon({});
  // WW1: WEAPON WIDGET. One clone per rig, as DFU has one FPSWeaponClone
  // beside its one FPSWeapon; it reads the machine every frame and draws
  // in the sprite's place while its Enabled is on. The recoil's word on
  // each struck foe arrives through playerWeapon.onAttackResult - the
  // OnAttackDamageCalculated seam the port had no consumer for until now.
  // CheckForEnvDamage (FPSWeaponClone IL 0x1730): a cast along the look
  // within the weapon's reach; here the host's collider from the eye
  // (the mod's starts at the body's centre - the same ray, a head's
  // height higher).
  const envCast = envHit ?? ((reach) => {
    const col = collider?.();
    const cam = camera?.();
    if (!col?.raycast || !cam?.pos) return null;
    const yaw = cam.yaw || 0, pitch = cam.pitch || 0;
    const fwd = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    const d = col.raycast(cam.pos, fwd, reach);
    if (!Number.isFinite(d)) return null;
    return [cam.pos[0] + fwd[0] * d, cam.pos[1] + fwd[1] * d, cam.pos[2] + fwd[2] * d];
  });
  const widget = createWeaponWidget({ audio, envHit: envCast, missEffect });
  const widgetOn = () => modSetting('weapon-widget', 'Enabled');
  // SW1: the shield's own component. Its sprites come from the player's
  // own copy of the mod (combat/shieldWidgetAssets.js); with none
  // attached `size()` answers null and the widget draws nothing, which
  // is the mod without its textures - there is no classic shield art to
  // fall back to.
  const shield = createShieldWidget({ textures: shieldWidgetTextures, audio });
  let _shieldTime = 0;   // SW1: Unity's Time.time, for the bob's phase
  // SW1: the sprite, uploaded once per index and kept. The door answers
  // a promise, so the first frame that wants a sprite asks for it and
  // draws nothing; the next one that has it draws. Same shape as the
  // sibling's custom-texture cache.
  const _shieldTex = new Map();
  function shieldTextureFor(index) {
    if (!renderer || !(index >= 0)) return null;
    if (!_shieldTex.has(index)) {
      _shieldTex.set(index, null);
      shieldWidgetImage(index).then((img) => {
        if (!img) return;
        _shieldTex.set(index, renderer.uploadTexture('img', `sw:${index}`, img));
      }).catch((e) => console.warn('[shield widget] texture load failed', index, e));
    }
    return _shieldTex.get(index);
  }
  /** The widget's blit: DaggerfallUI.DrawTextureWithTexCoords, at the
   *  weapon's own tint. */
  function drawShieldSprite(index, rect, uv, tint) {
    const tex = shieldTextureFor(index);
    if (!tex) return;
    renderer.drawScreenQuad(tex, { x: rect.x, y: rect.y, w: rect.width, h: rect.height }, uv, tint ?? undefined);
  }
  const shieldOn = () => modSetting('shield-widget', 'Enabled');
  /** The left hand's item in the four fields the widget reads.
   *
   *  Read WITHOUT materialising: `equipTableOf` is
   *  `entity.equip ??= createEquipTable()`, so asking it every frame
   *  GROWS an empty table on an entity that had none - and `syncWorn`
   *  two functions up then reads that empty table and nulls the
   *  player's weapon. (It did, and the unsheathe went silent.) The
   *  optional chain below is the shape syncWorn itself uses for the
   *  right hand, and it asks without writing. */
  const shieldItem = () => {
    const item = entity?.equip?.slots?.[EQUIP_SLOTS.LeftHand] ?? null;
    if (!item) return null;
    return {
      templateIndex: item.templateIndex, nativeMaterialValue: item.nativeMaterialValue ?? 0,
      conditionPercentage: conditionPercentage(item), isShield: isShieldTemplate(item.templateIndex),
    };
  };
  // SW1: the Recoil module's whole trigger, at the tail of every
  // resolution of an enemy's attack on the player (formulas.js).
  setAttackOnPlayerHook((attacker, target, damage, struckBodyPart) => {
    if (!shieldOn()) return;
    shield.onAttackDamageCalculated({ targetIsPlayer: true, bodyPart: struckBodyPart, damage, item: shieldItem() });
  });
  // HT1: HANDHELD TORCHES. The mod's HandheldTorches runs beside DFU's
  // WeaponManager reading it every frame (Sheathed, UsingRightHand,
  // ScreenWeapon.IsAttacking, the spell anim); here it reads the same
  // machine, and its Update / LateUpdate run where the widget's do. The
  // pool it drops into is the host's (scenes/droppedTorches.js), which
  // hands a picked-up light back through receivePickedUp.
  const handheld = createHandheldTorches({ audio, say, torches });
  const handheldOn = () => modSetting('handheld-torches', 'Enabled');
  let _handheldBound = null;
  // AUDIT 66 F8: THE COMPONENT'S OWN TEARDOWN HAD NO CALLER. It holds
  // two things that outlive a frame - the burning AudioSource
  // (systems/audio.js loops until it is stopped) and PlayerTorch's
  // position override, a process global (playerTorch.js) - and both
  // are freed by dispose(), which nothing called: not this rig, not a
  // host. So a torch lit at a scene teardown roared on into the next
  // scene, and one Ambidexterity flip welded the player's light to the
  // torch hand for the life of the page, across a load and a new
  // character. Worse, the switch: update() runs only while the mod is
  // ON (the frame block below), so turning it OFF with a torch lit
  // stranded the loop where even its own "stop" arm could not reach.
  // The rig owns the component, so the rig owns its end: on the
  // switch's falling edge, and at the host's own teardown (dispose).
  let _handheldWasOn = false;
  const bindTorches = () => { const pool = torches?.(); if (pool && pool !== _handheldBound) { pool.setOnPickedUp?.((item) => handheld.receivePickedUp(item)); _handheldBound = pool; } };
  playerWeapon.onAttackResult = ({ foe, damage }) => widget.onAttackDamageCalculated({ damage, parrySounds: !!foe?.basics?.parrySounds, pos: foe?.pos ?? foe?.ai?.pos ?? null, isEnemy: true });
  let _activatePrev = false, _activateStarted = false;
  let _lastEye = null;   // WW1: PlayerMotor.MoveDirection, read off the eye's motion between frames, in the body's own frame
  // MW-D8. `camera` is REQUIRED for the Morrowind arm and there is no
  // fallback: a host that does not pass one gets the classic sprite and
  // a named reason, never a plausible arm in the wrong place. An arm
  // drawn at the world origin while the player stands elsewhere is the
  // shape of failure this arc keeps shipping.
  //
  // AUDIT 39: AND THE BINDING FOLLOWS THE FRAME, not the constructor.
  // fpArm is a module SINGLETON and attach() is its only writer, so the
  // LAST rig built owned it: one dungeon visit rebound the arm to that
  // context's per-frame eye latch, and leaving never restored it - the
  // latch's closure keeps its last value, so afterwards the exterior
  // rig drove the arm off a frozen pose and the walk/run/sneak/jump
  // selection ran forever on whatever the player was doing on the last
  // dungeon frame. The reference re-derives the state from the live
  // actor every frame (character.cpp:2296-2330); here that is two field
  // writes, so the rig that is stepping the arm re-claims it first.
  const bindArm = () => fpArm.attach(renderer, camera);
  bindArm();
  // EOTB5: THE OTHER BODY, attached in the same breath as the arm it
  // stands in for. THE FOUR HOSTS named: exterior.js, world.js,
  // worldModes.js and dungeonContext.js - none of them carries a call,
  // because all four build a weapon rig and this is the one place
  // `fpArm.attach` is called. Four call sites would be four chances to
  // forget one, which is the failure MW-D15 recorded for the camera
  // dep before it had one home.
  //
  // AUDIT-EOTB F2/F4: the settings the camera reads, and the state only
  // this rig can answer. Both were missing: `loadSettings` had NO
  // caller, so the camera ran on the vendored defaults and every dial
  // on the pane was inert; and no host passed `weaponReady`, so all
  // three CameraOverride arms were unreachable code.
  //
  // The state goes THROUGH the body, not straight to the view layer.
  // MWFIX's pin says this file must never so much as NAME that layer -
  // the classic sprite path is the only path it knows - and F2's first
  // cut broke it by importing the layer's setter here. The body owns
  // that seam already (see `player/eotbBody.js`, which explains why).
  // AUDIT-EOTB2: THE WHOLE STATE, ONE HOME. The body's table, facing,
  // clips and size all read this record (`eotbBody.bodyState`), and it
  // used to carry the first two fields alone - so the sprite stood in
  // the Idle table for ever. The motion bag is the hosts' own
  // (`motionBagOf`), already handed to this rig through the camera
  // thunk for the widget's sake; nothing here asks a host for more.
  // EOTB-IL: and the rest of what PlayerBillboard.LateUpdate polls off
  // DFU each frame (IL_3eee-IL_3f66): FPSWeapon.IsAttacking (the machine
  // out of Idle), the bow, BowDrawback, FPSSpellCasting.IsPlayingAnim,
  // the swing held (the hold coroutine's trigger, IL_602e), the live
  // SPD GetMeleeAnimTickTime derives its tick from, and the three
  // concealment flags UpdateMaterial tints by. The doors are POLLED
  // here, as the mod polls them - the rig no longer calls the body.
  // MAC-O3: and RE-CLAIMED every frame beside the arm (`bindBody` in
  // frame()). This attach ran at construction only, so the LAST rig
  // built owned the body's state thunk - after a building visit the
  // sprite read the interior rig's machine and `sheathed` for ever,
  // AUDIT 39's fpArm failure repeated on the other body.
  const eotbState = () => ({
    weaponReady: !playerWeapon.sheathed || spellArmed(),   // posOffset's weapon arm, as the IL tests it
    sailing: false,                                        // Come Sail Away: the port has no twin
    sheathed: playerWeapon.sheathed,
    spellcasting: spellArmed(),
    usingBow: !!playerWeapon.machine.isBow,
    transformed: !!entity && isTransformedLycanthrope(entity),
    lycanthropyType: (entity && liveLycanthropy(entity)?.infectionType) || 0,
    died: !!entity && (entity.health ?? 1) <= 0,
    motion: camera?.()?.move ?? null,
    attacking: playerWeapon.machine.state !== 'Idle',
    castPlaying: !!fpsSpellCasting.isPlayingAnim,
    bowDrawback: getBool('Controls', 'BowDrawback'),
    swingHeld: _held,
    liveSpeed: entity ? liveStat(entity, 'speed') : 50,
    concealment: entity ? concealmentFlags(entity) : null,
  });
  const bindBody = () => eotbBody.attach(renderer, eotbState);
  bindBody();
  eotbCamera.setPopup(say);   // EOTB-IL: DaggerfallUI.PopupMessage, for the two Debug.ShowMessages lines
  eotbCamera.loadSettings(modSetting);
  // [IL] `Start` (IL_0668-IL_067b): the settings, then
  // ToggleOffset(StartInThirdPerson). The mod's OnNewGame and OnLoad
  // follow at the world host's two doors, through the view seam's
  // new-game and load-pose calls. The seam still routes by which body
  // answers, so a Morrowind player is untouched. MAC-O3: the camera
  // runs it ONCE per boot, as Unity does - a second rig (a building, a
  // dungeon) is not a second Start, and must not re-force the POV.
  eotbCamera.start();
  // MWFIX 3, RESTORED. The reverted rig read hasStoredMorrowind() ONCE at
  // construction, so attaching data to a running game changed nothing
  // until a reload - which is what "after uploading does not work at
  // all" actually was. A monotonic generation is the cheapest honest
  // signal a live consumer can poll. The rig does not rebuild by itself
  // (the parse is seconds long and belongs behind a button); it drops a
  // stale arm, so what is on screen never outlives the data it was
  // built from.
  let _mwGen = morrowindDataGeneration();
  const fpRecheck = () => {
    const g = morrowindDataGeneration();
    if (g === _mwGen) return;
    _mwGen = g;
    fpArm.unload();
  };
  // AUDIT 17e F17 / THE FOUR HOSTS RULE: U8h bound the worn weapon in
  // the two EXTERIOR hosts by hand, so the interior host (which owns
  // its own rig) kept swinging the interim dagger inside every
  // building, and the dungeon host was flagged but unwired. The bind
  // belongs to the rig: every host that passes an entity inherits it.
  // bindWorn:false is for rigs that manage their own weapon (the
  // dungeon's scripted bow demo).
  //
  // a12: AND IT READS BOTH HANDS. This was the port's whole left-hand
  // gap: one line bound the RightHand slot, so a weapon in the left
  // hand could never be swung and a shield changed nothing. The body
  // is UpdateHands + ApplyWeapon (WeaponManager.cs:646-676, :731-757),
  // which playerWeapon owns; the rig's job is the per-frame read that
  // DFU's Update does, and the order is DFU's - the hands are cached
  // first (so the shield rule and both caches are current), then the
  // used hand is applied.
  const syncWorn = () => {
    if (!bindWorn || !entity) return;
    // V4: SetFPSWeapon (LycanthropyEffect.cs:332-345) - while
    // transformed the rig IS the wereclaws, whatever the hand holds;
    // the per-frame sync makes the swap live the moment of the morph.
    // It is ApplyWeapon's FIRST arm (:735-739), so it wins over both
    // hands without disturbing either cache.
    const claws = racialFpsWeapon(entity);
    const slots = entity.equip?.slots;
    if (!slots) { if (claws) playerWeapon.weapon = claws; return; }
    playerWeapon.updateHands(slots[EQUIP_SLOTS.RightHand] ?? null, slots[EQUIP_SLOTS.LeftHand] ?? null);
    playerWeapon.applyWeapon(claws);
  };
  const cv = typeof canvas === 'function' ? canvas : () => canvas;
  const cache = new Map();   // `${type}:${material}` -> art (null while loading)
  let _dx = 0, _dy = 0, _held = false;

  function artFor(item) {
    if (!palette) return null;
    const type = weaponTypeForItem(item);
    if (type === WEAPON_TYPES.None) return null;
    const key = `${type}:${item?.material ?? 0}`;
    if (!cache.has(key)) {
      cache.set(key, null);
      loadFpsWeaponArt(fetchBytes, palette, renderer, type, item?.material ?? 0)
        .then((art) => cache.set(key, art))
        .catch((e) => console.warn('[weaponRig] art load failed', key, e));
    }
    return cache.get(key);
  }

  /**
   * SetCurrentAnims' cache (FPSSpellCasting.cs:145-149): "This happens
   * the first time a spell is cast and stored for re-casting. It's
   * likely player will use a wide variety of spell types in normal
   * play." Same shape as artFor above - the first ask starts the load
   * and draws nothing, every later one hits the map. The textures
   * themselves are keyed globally by renderer.uploadTexture, so four
   * rigs holding four maps still upload each archive once.
   */
  const spellCache = new Map();   // element -> art (null while loading)

  function spellArtFor(element) {
    if (!palette || !magicAnimFilename(element)) return null;
    if (!spellCache.has(element)) {
      spellCache.set(element, null);
      loadSpellCastArt(fetchBytes, palette, renderer, element)
        .then((art) => spellCache.set(element, art))
        .catch((e) => console.warn('[weaponRig] spell anim load failed', element, e));
    }
    return spellCache.get(element);
  }

  /** WeaponManager.Update's ShowWeapons legs, verbatim order.
   *  FX1 (F024/F025) rebuilt both clocks:
   *  - the bow COOLDOWN is an EARLY RETURN (:230-233), leaving
   *    ShowWeapon at its prior value - the bow stays DRAWN through
   *    the ~1.3s cooldown instead of blinking out and popping back.
   *    The latch below is that "prior value".
   *  - a running EQUIP countdown shows EMPTY HANDS (:275-281) - the
   *    port drew the new weapon while silently refusing attacks,
   *    which was the block half without its cue. */
  // MW-D42: the bow's held 'hit', waiting on the arm's release key, and
  // the ceiling that keeps a silent arm from swallowing the shot. The
  // classic bow release is 7 frames at the machine's 0.0625 tick, so a
  // real release lands near 0.44s and always beats this.
  const HELD_HIT_MAX_S = 1.2;
  let _heldHit = false;
  // MW-D42d: the loose SOUND, held with the loose it belongs to.
  let _heldSound = false;
  let _heldHitAge = 0;
  let _lastShown = false;
  function shown() {
    const m = playerWeapon.machine;
    if (m.isBow && m.now < m.cooldownUntil) return _lastShown;   // F024: the early return freezes the state
    let v = true;
    // WeaponManager.cs:247 is `HasReadySpell || PlayerSpellCasting
    // .IsPlayingAnim` - BOTH legs. The second half had nothing to
    // read until the classic spellcasting hands existed, and the
    // comment on this line has claimed it since C9: a weapon sprite
    // drawn over the casting hands is the state DFU's own note says
    // never happens ("never mixed with weapons directly on screen at
    // same time").
    if (spellArmed() || fpsSpellCasting.isPlayingAnim) v = false;   // HasReadySpell / IsPlayingAnim
    else if ((entity?.equipCountdown ?? 0) > 0) v = false;     // F025: empty hands while equipping
    else if (playerWeapon.sheathed) v = false;
    _lastShown = v;
    return v;
  }

  /**
   * MW-D12: the swing reaches the Morrowind arm.
   *
   * The strike is Daggerfall's, the attack type is Morrowind's, and the
   * mapping between them is rule 11's recorded DIVERGENCE - by the shape
   * of the motion, because Daggerfall chooses by gesture where Morrowind
   * chooses from the weapon record's damage spread.
   *
   * `hold` is read off the machine rather than assumed from the weapon:
   * a bow that is drawn AND HOLDING is state StrikeUp, which is DFU's
   * BowDrawback-on arm. The in-game bow path fires StrikeDown instantly
   * (playerWeapon.gesture:105-111), so today this is always false and the
   * arm runs wind-up straight into release - which is what an uncharged
   * Daggerfall swing is. It becomes live the moment the drawback path
   * does, with nothing here to change.
   */
  /** [IL] The mod's two keys, `InputManager.GetKeyUp` - the RELEASE edge
   *  (IL_14a5, IL_17f6) - off the same raw set the torch mod polls (HT1's
   *  `keyDown`). The names are the mod's own KeyCode text, resolved
   *  through the one converter the pane uses. */
  const _eotbKeysLast = new Set();
  function pollEotbKeys() {
    if (!keyDown) return;
    const s = eotbCamera.settings();
    const shoulder = domCodeForKeyCode(s.switchShoulderKey);
    const arm = domCodeForKeyCode(s.autoToggleKey);
    for (const [code, act] of [[shoulder, () => eotbCamera.switchShoulder()], [arm, () => eotbCamera.toggleAuto()]]) {
      if (!code) continue;
      const down = !!keyDown(code);
      if (!down && _eotbKeysLast.has(code)) act();
      if (down) _eotbKeysLast.add(code); else _eotbKeysLast.delete(code);
    }
  }
  /** [IL] The camera's weapon hide (LateUpdate, IL_1c98-IL_1cb0) and the
   *  spell hands' disable (ToggleOffset, IL_22f9), for the surfaces this
   *  rig draws: the sprite body is on screen and the Morrowind arm is
   *  not the one answering. */
  const eotbHidesWeapon = () => !fpArm.canThirdPerson() && eotbBody.hides().weapon;
  const eotbHidesSpellHands = () => !fpArm.canThirdPerson() && eotbBody.hides().spellHands;

  /** MAC7 #1: the wire's swing - counted at every strike the machine starts, before the Morrowind arm's own gate
   *  (a classic-skin player swings too, and the peers in Morrowind bodies must see it); the host reads it into the pose. */
  const swing = { n: 0, strike: 'StrikeDown' };
  /** MAC7 #2: the wire's cast - { n, rangeType }, counted at castSpellAnim, the one door both lanes' hands come through. */
  const cast = { n: 0, rangeType: 2 };
  function fpAttack(strike) {
    swing.n = (swing.n + 1) & 0xffff; swing.strike = strike;
    // EOTB-IL: the sprite's one-shots are no longer started here - the
    // mod POLLS FPSWeapon.IsAttacking in its own LateUpdate (IL_3eee),
    // and the body reads the machine through the record above
    if (!fpArm.ready()) return;
    const m = playerWeapon.machine;
    // MW-D16: no `bow` flag. The arm derives "shoot" from its own
    // weapon CLASS, which is what the reference tests - and which also
    // catches MarksmanThrown, a type that shoots without being a bow.
    fpArm.attack(strike, { hold: m.isBow && m.state === 'StrikeUp' });
  }

  // WEAPON-VIS1: a live call count, not a guess - see window.__weaponDebug
  // (scenes/world.js). Counts every path that flips the sheath through
  // rawToggleSheath below - the HUD panel's door and the key's MAC-O1
  // door both end in it, which is exactly the pair WEAPON-VIS2 caught
  // double-firing.
  let _toggleSheathCalls = 0;
  let _armDrewLast = false;   // MAP3: the draw seam's own record of whether the arm drew

  /** WeaponManager.ToggleSheath (:1115-1128), the flip both doors below
   *  end in - the panel's raw one and the key's arm. It is ONE function
   *  because DFU has one member: the draw clip is FPSWeapon's, played
   *  only on the UNsheathe of a real weapon. */
  function rawToggleSheath() {
    syncWorn();
    _toggleSheathCalls += 1;
    // V4: the claws draw silently (DrawWeaponSound = None, :338)
    if (playerWeapon.toggleSheath() && !playerWeapon.weapon?.werecreatureClaws) {
      audio.playOneShot(equipSoundFor(playerWeapon.weapon) ?? SOUND.DrawWeapon);
    }
  }

  /** FPSWeapon.UpdateWeapon's bow guard: an UNsheathed bow with zero
   *  Arrows auto-sheathes with the classic line. */
  function bowArrowGuard() {
    if (playerWeapon.sheathed) return;
    if (weaponTypeForItem(playerWeapon.weapon) !== WEAPON_TYPES.Bow) return;
    if (hasDaggerfallArrows(entity.items)) return;
    playerWeapon.sheathed = true;
    // AUDIT 64 F34: FPSWeapon.cs:365 is SetMidScreenText, not the popup
    // queue - and `say` here is shared with the shield refusal below,
    // which really is a PopupMessage, so this line takes the label
    // directly rather than re-pointing the sink.
    setMidScreenText('You have no arrows.');
  }

  return {
    /** QS2 - RE-READ THE HANDS NOW, not on the next frame.
     *
     *  `syncWorn` is DFU's UpdateHands + ApplyWeapon and the rig already runs
     *  it every frame (`frame` above), which is how an equip made in the
     *  inventory window reaches the hand: the window changes the equip table,
     *  the next frame reads it. A quickslot SWAP is the same equip made from
     *  the key ladder, with no window open - and the ladder answers BEFORE the
     *  frame, so anything that reads the rig in the same press (the HUD's
     *  diamond, a pin) would see the weapon that just left the hand. This is
     *  the same read, on demand; it is idempotent, so calling it costs the
     *  frame's own call nothing. */
    refreshWorn() { syncWorn(); },
    /** QS4 - THE OFF-HAND KEY'S LIGHT ARM. The quickslot diamond's
     *  off-hand cell presses the same thing Handheld Torches' own toggle
     *  key presses (its `toggleLightPress`, the free-hand guard and all),
     *  because it is the same act on the same hand - and the mod being
     *  OFF is an answer too: no light system, nothing toggled, false. */
    toggleLight() { return handheldOn() ? handheld.toggleLightPress() === true : false; },
    /** MW-D39: the host's cast moment runs the arm's spellcast release.
     *  One door, like setWeapon - the host never reaches into fpArm.
     *
     *  ROAD-tail: and the CLASSIC lane's hands come through the same
     *  door, because it is the same moment - EntityEffectManager
     *  .CastReadySpell (:434) calls PlayerSpellCasting.PlayOneShot with
     *  the readied spell's ElementType, and this port's hosts raise
     *  their cast moment there. The range picks the Morrowind arm's
     *  attack type; the element picks the classic archive. Exactly one
     *  of the two ever reaches the screen (see draw()).
     *
     *  ROAD-E6: the moment moved. This is now CastReadySpell's
     *  PlayOneShot (:430-435) rather than the release - the host calls
     *  it as the magicka is spent, hands the animation the engine's
     *  release handler, and gets back FPSSpellCasting's own answer:
     *  true when the hands actually started (and therefore when the
     *  spell's resolution is parked on frame 5), false when PlayOneShot
     *  refused - already playing, or an element with no CIF archive -
     *  in which case the engine resolves on the spot. */
    castSpellAnim: (rangeType, element, onRelease = null) => {
      cast.n = (cast.n + 1) & 0xffff; cast.rangeType = rangeType | 0;   // MAC7 #2: the wire's cast, counted before either lane's own gate. EOTB-IL: the sprite's cast is polled off FPSSpellCasting.IsPlayingAnim (IL_3f57), not called from here
      fpArm.castSpell(rangeType);
      return fpsSpellCasting.playOneShot(element, onRelease);
    },
    playerWeapon,
    swing,   // MAC7 #1: { n, strike } - the count and the kind of the last strike started, for the wire
    cast,    // MAC7 #2: { n, rangeType } - the count and the range of the last cast, for the wire
    /** Host mouse events buffer here (sheathed = no attack processing).
     *  CH3 (characters-13): a running SWAP PAUSE blocks the attack
     *  the same way (WeaponManager.cs:276-278 returns before the
     *  swing while the used hand's countdown runs). */
    attackInput(dx, dy, held) {
      if (playerWeapon.sheathed || (entity?.equipCountdown ?? 0) > 0) return;
      _dx += dx; _dy += dy; _held = held;
    },
    /** ClickToAttack for the touch button. */
    clickAttack() {
      if (playerWeapon.sheathed || (entity?.equipCountdown ?? 0) > 0) return;
      const strike = playerWeapon.clickAttack();
      if (strike) fpAttack(strike);
    },
    /** WeaponManager.ToggleSheath (:1115-1128) RAW, which is what the
     *  LARGE HUD's sheath panel calls - HUDLarge.cs:477-483 reaches the
     *  singleton directly and takes none of Update's refusals, so this
     *  door must not grow them either (the KEY's door is readyWeapon
     *  below).
     *  AUDIT 26 F023: the clip is the WEAPON's own GetEquipSound
     *  (WeaponManager.SetWeapon :780 overwrites DrawWeaponSound with
     *  it on every applied weapon, and FPSWeapon.ToggleSheath :295
     *  plays that field) - eight clips by weapon type, not the 78
     *  default, which no applied weapon ever reaches. A weapon with
     *  no equip clip of its own falls back to 78. */
    toggleSheath() { rawToggleSheath(); },
    get toggleSheathCalls() { return _toggleSheathCalls; },   // WEAPON-VIS1: for window.__weaponDebug
    /**
     * MAC-O1 - THE READYWEAPON KEY'S OWN DOOR. WeaponManager.Update
     * :229-269, the arm the four hosts' Z poll is a translation of.
     * Every host called `toggleSheath` for it, which is HUDLarge's
     * door, so three of Update's refusals and its ONE action were
     * missing from the key entirely:
     *
     *   :230-233  `if (Time.time < cooldownTime) return;` - the bow's
     *             cooldown returns before the sheath block, so Z is
     *             dead until the shot's recovery is over.
     *   :245-265  A READIED SPELL OWNS THE KEY. With HasReadySpell or
     *             PlayerSpellCasting.IsPlayingAnim up, Z does NOT
     *             toggle: it AbortReadySpell()s, sheathes if drawn,
     *             and sets doToggleSheath, so :268-269 draws - the
     *             spell goes away and the weapon comes out, with the
     *             draw clip, in one press. The port flipped the flag
     *             instead, while `shown()`'s own HasReadySpell leg
     *             (:247, above) kept the sprite hidden - so the player
     *             saw NOTHING happen, pressed again, and the weapon
     *             ended sheathed or drawn by the parity of their
     *             presses with no picture either way. That is Mac's
     *             "does not toggle / toggles twice / gets stuck", and
     *             it is why Handheld Torches misbehaved with it: the
     *             mod's UpdateFreeHand reads WeaponManager.Sheathed
     *             LIVE (handheldTorches.js:290), so a flag flipped to
     *             "drawn" with no weapon on screen stows the torch.
     *   :268      `!isAttacking` - the hand already had this gate
     *             (switchHand below); the sheath did not, so Z
     *             mid-swing put the weapon away under the blow.
     *
     * DFU's paralysis/climbing return (:236-240) is NOT here: this
     * door is called from the hosts' key poll, which they already run
     * inside their own motor state, and neither is a thing this rig is
     * told. Its own `frame(dt, { paralyzed })` is where that word
     * arrives, one rung down.
     *
     * @returns true when the sheath state actually changed.
     */
    readyWeapon() {
      syncWorn();   // UpdateHands (:212-213) runs first, as it does for switchHand
      const m = playerWeapon.machine;
      if (m.isBow && m.now < m.cooldownUntil) return false;   // :230-233, the bow's cooldown
      if (m.state !== 'Idle') return false;                   // :268's `!isAttacking`
      if (spellArmed() || fpsSpellCasting.isPlayingAnim) {
        abortSpell();                                          // :251 AbortReadySpell
        if (!playerWeapon.sheathed) playerWeapon.toggleSheath();   // :254-255, silently - sheathing plays nothing
      }
      rawToggleSheath();   // :268-269
      return true;
    },
    /**
     * a12 - SwitchHand (H). WeaponManager.Update's own leg, :271-273:
     *
     *   if (!isAttacking && InputManager.Instance.ActionComplete(
     *       InputManager.Actions.SwitchHand))
     *       ToggleHand();
     *
     * TWO THINGS ARE LAW HERE and neither is decoration. The gate is
     * `!isAttacking` - the hand never changes mid-swing, or the strike
     * would finish with a different weapon than it started with. And
     * the edge is ActionComplete, the key's RELEASE (:634-637), not
     * ActionStarted like ReadyWeapon (:284) - so the hosts poll this
     * one on the falling edge, which is why every call site's latch
     * reads `!now && prev` where Z's reads `now && !prev`.
     *
     * syncWorn runs first because DFU's UpdateHands runs every frame
     * ahead of this: holdingShield has to be THIS frame's answer or
     * the shield refusal below is stale by one press.
     *
     * @returns true when the hand actually changed.
     */
    switchHand() {
      if (playerWeapon.machine.state !== 'Idle') return false;   // isAttacking
      syncWorn();
      // bindWorn:false rigs drive their own weapon (the dungeon's
      // scripted bow) - flip the hand, but do not let ApplyWeapon
      // overwrite a weapon no equip table ever supplied.
      const line = playerWeapon.toggleHand({ entity, apply: bindWorn });
      if (line === null) return false;   // :704-705, the shield refuses
      say(line);
      return true;
    },
    /**
     * Per-frame: gesture consume, the swing-sound edge, machine step.
     * @returns the machine's events ('hit' on the strike frame) - the
     *   host resolves them (or ignores them where nothing is in reach).
     */
    frame(dt, { paralyzed = false } = {}) {
      bindArm();    // AUDIT 39: the stepping rig owns the singleton (see above)
      bindBody();   // MAC-O3: and the sprite body, the same law
      syncWorn();   // AUDIT 17e F17: the rig owns the worn-weapon bind
      // EOTB-IL: the mod's two keys are polled off the hosts' raw set on
      // their RELEASE edge (GetKeyUp) - SwitchShoulder (the port binds
      // B; the mod's Tab is spent) and AutoTogglePerspective's
      // ToggleInput. The drawn string's release is the body's own
      // (PlayAnimationHoldCoroutine reads the swing held, IL_602e).
      pollEotbKeys();
      // FPSSpellCasting's AnimateSpellCast coroutine (:265-286). It is
      // a Start() coroutine, so it runs for the life of the component
      // - before the gesture, before the machine, and NOT under the
      // paralysis gate below: FPSSpellCasting is its own component and
      // WeaponManager.ShowWeapons(false) never touched it, so a cast
      // already in flight when paralysis lands finishes its motion.
      // Only the rig that owns the frame steps it (the hosts return
      // early on a modal mode), which is why one accumulator is safe
      // across four rigs.
      fpsSpellCasting.tick(dt);
      // CH3 (characters-13): the swap pause drains at the classic
      // approximation - dt x 980 units/second, clamped at 0
      // (WeaponManager.cs:677-693).
      if (entity && (entity.equipCountdown ?? 0) > 0) {
        entity.equipCountdown = Math.max(0, entity.equipCountdown - dt * 980);
      }
      const c = cv();
      // MW-D12: THE RETURN VALUE WAS BEING THROWN AWAY, and it is the
      // only signal that a blow has started. gesture() answers with the
      // strike the drag resolved to (playerWeapon.js:225-228) and
      // clickAttack() with the one the click rolled - the Morrowind arm
      // needs exactly that to pick rule 11's attack type.
      const strike = !paralyzed && c
        ? playerWeapon.gesture(_dx, _dy, _held, dt, Math.max(c.clientWidth, c.clientHeight), { cancelHeld: activateHeld() })   // AUDIT 28 W12
        : null;
      if (strike) fpAttack(strike);
      _dx = 0; _dy = 0;
      // AUDIT 23 (C9): the strike-ENTRY whoosh is gone - DFU plays the
      // swing sound at the HIT FRAME of a swing that hit no enemy
      // (WeaponManager.cs:1059 else-arm) and at bow frame 4 (:376-380),
      // both of which ride the machine's events at the hosts now.
      fpRecheck();
      // Paralysis freezes the arm as it freezes the swing - a clip that
      // keeps idling while the player cannot move is the animation
      // saying something the game does not mean.
      // MW-D9f: ready(), NOT active(). active() requires the GPU mesh
      // that update() is the only thing that creates, so gating the
      // update on it meant a built arm never ran a frame and never drew.
      if (!paralyzed && fpArm.ready()) {
        // MW-D12: THE STANCE IS SYNCED EVERY FRAME, not at the toggle.
        //
        // That is the reference's own shape - updateWeaponState compares
        // the live `weaptype` against `mWeaponType` on every call
        // (character.cpp:1382-1385) - and here it is also the only
        // correct one: playerWeapon.sheathed is written from THREE
        // places, and the bow's out-of-arrows auto-sheathe
        // (bowArrowGuard, in draw()) is not one of them that could ever
        // call a toggle hook. setSheathed is a no-op when nothing
        // changed, so this costs a comparison.
        //
        // Sheathed is rule 8's weapon type None: the bare "idle" group,
        // rule 10's endless loop, and no weapon in shot. Drawn plays the
        // equip section of the weapon's long group and raises "idle1h".
        fpArm.setSheathed(playerWeapon.sheathed);
        // MW-D19: THE WEAPON FOLLOWS THE HAND. syncWorn above already
        // reads the equip slot every frame for the classic sprite; the
        // Morrowind arm now rides the same read. setWeapon's fast path
        // is one key compare - the swap itself runs only when the item
        // in the hand actually changed.
        fpArm.setWeapon(playerWeapon.weapon, { hasAmmo: hasDaggerfallArrows(entity?.items), ammoCount: daggerfallArrowCount(entity?.items) });   // WS1: the quiver's count rides the swap
        // MW-D51: THE LIGHT FOLLOWS THE HAND. The same per-frame read
        // Handheld Torches' hand law writes (PlayerEntity.LightSource -
        // lit by use, stowed when no hand is free) hands the Morrowind
        // arm its torch; setTorch's fast path is one boolean compare.
        fpArm.setTorch(isLitTorch(entity?.lightSource));
        // MW-D39: THE SPELL IS A STANCE. spellArmed() is already the
        // rig's own per-frame read (WeaponManager's HasReadySpell leg
        // above); the Morrowind arm rides the same one, and its fast
        // path is a boolean compare, so the stance re-composes only
        // when a spell is actually readied or let go.
        fpArm.readySpell(spellArmed());
        // MW-D32: THE BODY FOLLOWS THE EQUIP TABLE. The same per-frame
        // read that swaps the weapon now hands the rig its worn list;
        // setWorn's fast path is one key compare, and a change - a
        // cloak equipped, a gauntlet dropped - rebuilds the body in
        // those clothes. D29-D31 dressed the BUILD; this dresses the
        // GAME.
        if (entity) fpArm.setWorn(dfWornEquipment(equipTableOf(entity), EQUIP_SLOTS, ARMOR_ENUM));
        // The held draw comes up when the machine leaves StrikeUp - the
        // arrow is loosed, so the arm's wind-up must stop holding at max
        // attack and run to its release key.
        const m = playerWeapon.machine;
        if (!(m.isBow && m.state === 'StrikeUp')) fpArm.release();
        fpArm.update(dt);
      }
      if (paralyzed) return [];
      // MW-D42 (Mac: the bow "damages on click instead of following the
      // bow animation"): THE LOOSE WAITS FOR THE ARM. The machine's
      // 'hit' for a bow is frame 5 of the classic 7-frame release, and
      // when the Morrowind arm is the thing on screen that frame has
      // nothing to do with what the player is watching - the arrow left
      // while the bow was still being drawn.
      //
      // Morrowind-Rules.md:246-255 refused this and was half right: two
      // clocks must not disagree about when a blow lands. They still do
      // not. Daggerfall's machine remains the ONLY thing that decides a
      // hit happens, its damage, its skills, its cooldown; all that
      // moves is the moment it is allowed to announce one, and only for
      // a bow, and only while the arm is actually animating the shot.
      // The rule's own reason was the hit frame - it never argued the
      // arrow should leave before the string does.
      const evs = playerWeapon.update(dt);
      // WW1: the clone's LateUpdate, after the original's frame advance -
      // the same order DFU's LateUpdate has against FPSWeapon's Update.
      const _torchesOn = handheldOn();
      if (!_torchesOn && _handheldWasOn) handheld.dispose();   // AUDIT 66 F8: the switch off is a teardown
      _handheldWasOn = _torchesOn;
      // SW1-FEED (audit, 2026-09-19): AND THE SHIELD OPENS IT TOO. This
      // block assembles the frame the three mods share - the camera, the
      // motor's local velocity, the look delta - and it used to be opened
      // by the weapon's clone or the torch alone, so the Shield Widget
      // got no frame at all unless an UNRELATED mod happened to be on:
      // `ctx` stayed null, `drawRect()` answered null forever, and the
      // mod was dead on a profile that enabled only it. Each consumer
      // inside is already gated on its own switch, so this costs the
      // assembly and nothing else.
      if (widgetOn() || _torchesOn || shieldOn()) {
        const cam = camera?.() ?? null;
        const mv = cam?.move ?? {};
        const held = activateHeld();
        _activateStarted = held && !_activatePrev; _activatePrev = held;
        const spd = entity ? liveStat(entity, 'speed') : 50;
        const base = Number.isFinite(mv.baseSpeed) ? mv.baseSpeed : walkSpeed(spd);
        const ratio = Number.isFinite(mv.speedRatio) ? mv.speedRatio : (Number.isFinite(mv.speedField) && base > 0 ? mv.speedField / base : 1);
        let localVel = [0, 0, 0];
        if (cam?.pos && _lastEye && dt > 0) {
          const v = [(cam.pos[0] - _lastEye[0]) / dt, (cam.pos[1] - _lastEye[1]) / dt, (cam.pos[2] - _lastEye[2]) / dt];
          const yaw = cam.yaw || 0, sy = Math.sin(yaw), cy = Math.cos(yaw);
          localVel = [v[0] * cy - v[2] * sy, v[1], v[0] * sy + v[2] * cy];   // InverseTransformVector: right, up, forward
        }
        _lastEye = cam?.pos ? [cam.pos[0], cam.pos[1], cam.pos[2]] : null;
        const look = takeFrameLook();   // WW1/HT1: the frame's look, read once, shared by both
        const camThunk = () => (cam ? { ...cam, forward: [Math.sin(cam.yaw || 0) * Math.cos(cam.pitch || 0), Math.sin(cam.pitch || 0), Math.cos(cam.yaw || 0) * Math.cos(cam.pitch || 0)],
          right: [Math.cos(cam.yaw || 0), 0, -Math.sin(cam.yaw || 0)], up: [0, 1, 0] } : null);
        if (_torchesOn) {
          bindTorches();
          const tctx = {
            renderer, canvas: c, entity, machine: playerWeapon.machine, sheathed: playerWeapon.sheathed, usingRightHand: playerWeapon.usingRightHand,
            castPlaying: fpsSpellCasting.isPlayingAnim, spellArmed: spellArmed(), thirdPerson: fpArm.thirdActive() || eotbHidesWeapon(),   // AUDIT-EOTB2: either body on screen hides the FPV hand
            climbing: !!cam?.climbing, swimming: !!mv.swimming, transformedLycanthrope: !!entity && isTransformedLycanthrope(entity),
            motion: { grounded: mv.grounded !== false, crouching: !!mv.crouching, riding: !!mv.riding, standing: !!mv.standing, speedRatio: ratio, baseSpeed: base, localVel },
            look, swingHeld: _held, cursorActive: cursorActive(), camera: camThunk, collider: () => collider?.() ?? null,
            keyDown: (code) => !!keyDown?.(code), sheathWeapons: () => { if (!playerWeapon.sheathed) playerWeapon.toggleSheath(); },
          };
          handheld.update(dt, tctx);
          handheld.lateUpdate(dt, tctx);
        }
        // SW1: the shield's frame. The same assembled answers the
        // weapon's clone takes - Unity handed the MonoBehaviour the
        // motor, the look and the weapon manager, and so does this.
        if (shieldOn()) shield.lateUpdate({
          dt, time: _shieldTime += dt,
          // SW1-RECT (audit, 2026-09-19): `c` IS THE CANVAS, not a 2D
          // context - every host passes the element (`drawFpsWeapon`
          // beside this reads `canvas.width` off the same object). So
          // `c.canvas` was undefined and the whole mod ran on the 320x200
          // fallback: weaponScaleX came out 1, the sprite drew at its
          // native ~134px whatever the window was, and the rect's clamp
          // put it at y=200 - up by the top-left corner of an 800-tall
          // canvas instead of down in the hand. DFU reads
          // `DaggerfallUI.CustomScreenRect ?? new Rect(0, 0, Screen.width,
          // Screen.height)`; the drawing buffer is this port's Screen.
          screenRect: { x: 0, y: 0, width: c?.width ?? 320, height: c?.height ?? 200 },
          item: shieldItem(), entity,
          attacking: playerWeapon.machine.state !== 'Idle', sheathed: playerWeapon.sheathed,
          castingAnim: fpsSpellCasting.isPlayingAnim, hasReadySpell: spellArmed(),
          equipCountdownLeftHand: entity?.equipCountdown ?? 0,
          isClimbing: !!cam?.climbing, isPaused: false, loadInProgress: false,
          motor: {
            speed: (mv.speedRatio ?? ratio) * base, baseSpeed: base,
            isGrounded: mv.grounded !== false, isCrouching: !!mv.crouching, isRiding: !!mv.riding,
            isStandingStill: !!mv.standing, moveDirectionLocal: localVel,
          },
          // SW1b-4 (audit): `takeFrameLook()` answers an ARRAY, [yaw, pitch]
          // - the clone below reads `look[0]`/`look[1]`. Asking it for `.x`
          // and `.y` got undefined every frame, so the shield's Inertia
          // module saw the movement and never the look. It is off by
          // default, which is the only reason nothing said so.
          look: { x: look?.[0] ?? 0, y: look?.[1] ?? 0, cursorActive: cursorActive(), swingAction: _held },
        });
        if (widgetOn()) widget.lateUpdate(dt, {
          renderer, canvas: c, entity, art: c ? artFor(playerWeapon.weapon) : null, weapon: playerWeapon.weapon,
          weaponType: weaponTypeForItem(playerWeapon.weapon), material: playerWeapon.weapon?.material ?? -1,
          machine: playerWeapon.machine, sheathed: playerWeapon.sheathed, usingRightHand: playerWeapon.usingRightHand,
          equipCountdown: entity?.equipCountdown ?? 0, shown: shown(), castPlaying: fpsSpellCasting.isPlayingAnim, spellArmed: spellArmed(),
          thirdPerson: fpArm.thirdActive() || eotbHidesWeapon(), reach: WEAPON_REACH,   // AUDIT-EOTB2: the widget's third-person gate asked the Morrowind arm alone
          motion: { grounded: mv.grounded !== false, crouching: !!mv.crouching, riding: !!mv.riding, standing: !!mv.standing,
            speedRatio: ratio, baseSpeed: base, localVel },
          look, swingHeld: _held, cursorActive: cursorActive(), camera: camThunk,
          activateStarted: () => _activateStarted,
        });
      }
      // MW-D42c (Mac: "in third person, clicking instantly triggers the
      // attack, unlike the changes we made to first person. Ensure
      // parity"): THE ARM IS ANIMATING IN EITHER VIEW. active() is the
      // FIRST-person predicate by construction - it ends in
      // `viewMode === 'first'` - so MW-D42's hold silently did nothing
      // the moment the wheel turned, and the classic frame-5 hit fired
      // straight through on the click exactly as it always had. The
      // question this asks is not "which view" but "is the arm the
      // thing on screen", and in third person that is thirdActive().
      // Same animation, same release key, same clock; only the pass
      // that draws it differs, and the pass is none of the loose's
      // business.
      if (!(fpArm.active() || fpArm.thirdActive()) || !playerWeapon.machine.isBow) {
        // The classic sprite path is untouched, and so is every melee
        // weapon on every path.
        if (_heldHit) _heldHit = false;
        _heldSound = false;
        return evs;
      }
      const out = [];
      for (const ev of evs) {
        if (ev === 'hit') { _heldHit = true; _heldHitAge = 0; continue; }
        // MW-D42d (Mac: "the sound affect plays before the arrow is
        // fired"): THE LOOSE SOUND RIDES WITH THE LOOSE. The machine
        // puts bowSound on frame 4 and the hit on frame 5 - one 0.0625
        // tick apart, which is the same instant to an ear. MW-D42 moved
        // the HIT to the arm's release key and let the sound through
        // untouched, so the two came apart by the whole length of the
        // draw and the string was heard before the arrow left. Holding
        // the arrow and not its sound is not half a fix, it is a new
        // defect, and it was mine.
        if (ev === 'bowSound') { _heldSound = true; continue; }
        out.push(ev);
      }
      if (_heldHit) {
        _heldHitAge += dt;
        // NEVER-TRAPS. If the arm's "shoot release" key never comes -
        // a .kf that does not carry it, an arm that loses its build
        // mid-shot - the shot is not swallowed. It lands late rather
        // than never, and HELD_HIT_MAX_S is generous enough that a real
        // release always wins the race: the whole classic bow release
        // is seven frames at a 0.0625 tick, about 0.44s.
        if (fpArm.takeShootRelease() || _heldHitAge >= HELD_HIT_MAX_S) {
          _heldHit = false;
          // SOUND FIRST, then the hit - the machine's own order across
          // frames 4 and 5, preserved rather than reinvented.
          if (_heldSound) { _heldSound = false; out.push('bowSound'); }
          out.push('hit');
        }
      }
      return out;
    },
    /** The overlay draw, LAST in the host's frame (composites over the
     *  scene; any HUD draws over it). Runs the bow guard first. */
    /** MAP3: whether the Morrowind arm was the thing drawn on the last
     *  frame - the held map's holder opens the hands lane on it. */
    armsDrawn() { return _armDrewLast && fpArm.drewLast(); },   // AUDIT-MAP2: the seam was reached AND the arm composed
    /** MAP-FIELD: whether the Morrowind arm WOULD draw if it were handed
     *  a sheet - which is what the held map has to ask, because until it
     *  holds one the arm is sheathed and does not draw at all. The EOTB
     *  body takes everything, as it does below. */
    armsAvailable() { return !eotbHidesWeapon() && fpArm.active(); },
    holdPaper(spec, opts) { return fpArm.holdPaper(spec, opts); },
    releasePaper() { return fpArm.releasePaper(); },
    paperCorners() { return fpArm.paperCorners(); },
    heldPose() { return fpArm.heldPose(); },
    setHeldPose(spec) { return fpArm.setHeldPose(spec); },
    draw({ paralyzed = false } = {}) {
      _armDrewLast = false;
      try { return drawInner({ paralyzed }); } finally { widget.endOfFrame(); shield.endOfFrame(); }   // WW1: WaitForEndOfFrame resumes after the frame's draw
    },
    widget,   // WW1: the clone, for the pins
    shield,   // SW1: the shield's component, for the pins
    handheld,   // HT1: Handheld Torches' component, for the pins and the pool
    /** AUDIT 66 F8: the host's teardown - every long-lived thing this
     *  rig owns is freed here, as the hosts free their pools. */
    dispose() { handheld.dispose(); _handheldWasOn = false; },
  };
  function drawInner({ paralyzed = false } = {}) {
    {
      bindArm();    // AUDIT 39: the DRAWING rig owns it too - the arm renders through it
      bowArrowGuard();
      const c = eotbHidesSpellHands() ? null : (cv());
      // MW-D24: in THIRD PERSON nothing first-person draws at all - not
      // the arm (its predicate is view-gated) and not the classic
      // sprite either, or the player would wear a floating weapon
      // overlay while watching their own back. Morrowind's third person
      // has no viewmodel; the body carries the weapon. ROAD-tail HOISTED
      // it above the spellcasting hands below, which are first-person
      // art by exactly the same argument.
      if (fpArm.thirdActive()) return;
      // ROAD-tail: THE CLASSIC SPELLCASTING HANDS (FPSSpellCasting
      // .OnGUI :97-119). Three things about where this sits:
      //   - BEFORE the weapon, "Draw spell cast texture behind other
      //     HUD elements" (:113) and GUI.depth = 1 (:99);
      //   - NOT under shown() - the weapon is the thing shown() hides
      //     while these play (see the IsPlayingAnim leg there), and
      //     hiding the hands with it would leave a cast with nothing
      //     on screen at all;
      //   - NOT under paralyzed, for the reason frame()'s tick is not:
      //     DFU's spellcasting component is nobody's viewmodel.
      // The Morrowind lane draws its OWN cast through fpArm's casting
      // stance (MW-D39), so the two never composite - the same one
      // seam the weapon sprite has.
      // EOTB-IL: `spellCasting.enabled = false` while the sprite camera is
      // out (ToggleOffset, IL_22f9) - the hands' picture goes, the cast
      // still resolves (a disabled MonoBehaviour's coroutine runs on)
      // MAC-I (Mac: "The classic sprite should react to lighting (first
      // person)"): THE ROOM'S LIGHT, once a frame, for every sprite this
      // seam draws. `FPSWeapon.Tint` is the channel DFU declares and
      // never writes (FPSWeapon.cs:108, :182); `flatLightAt` answers it
      // with the same four terms a FLAT in the room takes, sampled at
      // the camera - which is where a first-person sprite is. The
      // Morrowind arms are a lit MESH and take the world's light
      // already, so this is the classic lane's alone; the switch is the
      // player's (Features -> First-person lighting).
      const fpTint = fpLightingOn() ? (renderer?.flatLightAt?.() ?? null) : null;
      if (c && !fpArm.active()) {
        drawSpellCastHands(renderer, c, spellArtFor(fpsSpellCasting.element), fpsSpellCasting.frameIndex, { tint: fpTint });
      }
      // TORCH-VIS (2026-09-18, Mac: "if you only have the torch equipped and no weapon, it doesn't show you
      // holding it in first person (morrowind)"): THE TORCH IS NOT THE WEAPON'S TO HIDE, and a SHEATHED STANCE IS
      // NOT A STOWED LIGHT. `shown()` is the WEAPON's visibility - this file says so itself a few lines up, where
      // the classic spellcasting hands were hoisted above it ("NOT under shown() - the weapon is the thing shown()
      // hides") - and its `sheathed` leg was taking the carried light down with the weapon. A player walking around
      // with a torch and nothing drawn is sheathed by definition, so the one state the light exists for was the one
      // state it never drew in.
      //
      // BOTH references say it should. Handheld Torches' own hand law leaves "an empty hand you are not swinging
      // with" free precisely so a weaponless player can carry a light (HT7's note, and its `hasFreeHand`); and the
      // Morrowind rig answers it outright - `carriedLeftVisible(animWeaponType(type, sheathed, spellReady))` is
      // NpcAnimation::updateCarriedLeftVisible verbatim, and a sheathed stance maps to None, which is not
      // two-handed, so the carried left is VISIBLE. The same law answers FALSE for a readied spell, which is why
      // that leg of shown() must keep hiding it.
      //
      // So: the lit hand alone draws while merely sheathed. The other two legs stand - a readied spell is the
      // reference's own hidden case, an equip countdown is empty hands by construction - and paralysis, third
      // person and the EOTB body still take everything, above.
      //
      // AND THE LANE THAT WILL DRAW IT HAS A VETO. The entity knowing a light is equipped is not the same
      // question as "will anything actually appear". On the Morrowind lane the arm paints the light itself, and
      // its held-light art is the TORCH alone (`isLitTorch` above - the classic lane's hand sprite covers the
      // lantern, as it always has), and a rig can resolve no light at all (no LIGH record, no attached mesh, no
      // Shield Bone). Opening the gate on those would paint a sheathed idle holding NOTHING where the screen used
      // to be blank - a state nobody has ever seen, offered as a fix. So on that lane the arm answers:
      // `fpArm.torchShown()` is its own `torchVisible()`, the reference's three conditions at once. The classic
      // lane needs no veto - `handheld.draw` asks the same question itself and returns false.
      //
      // WHAT DOES COME BACK WITH THE TORCH, said accurately: on the CLASSIC lane, nothing - `torchOnly` returns
      // below, before the widget's clone and before the sprite. On the MORROWIND lane the arm returns above that
      // line and paints its own stance, which hides the weapon in the settled sheathed state - but NOT during the
      // unequip transient, where the rig deliberately keeps the blade in hand until the detach key. So sheathing
      // with a torch lit now plays the sheathe out instead of cutting to nothing, which is the reference's own
      // behaviour and is why this note does not claim otherwise.
      const torchOnly = !shown() && !spellArmed() && !fpsSpellCasting.isPlayingAnim
        && (entity?.equipCountdown ?? 0) <= 0 && isHeldLight(entity?.lightSource)
        && (!fpArm.active() || fpArm.torchShown());
      // MAP-FIELD (2026-09-18, Mac: "the morrowind doesn't even hold the
      // map"): A HELD SHEET IS NOT A WEAPON EITHER. `shown()` is the
      // WEAPON's predicate - TORCH-VIS above says so for the light, and
      // the same sentence answers the map: a player opening the travel
      // map is walking about SHEATHED by definition, so the one state
      // the held pose exists for was the one state the arm never drew
      // in, and the window fell back to the painted sprite every time.
      // The hands are holding a map; the weapon, the arrow and the torch
      // are already hidden while they do (combat/heldPose.js).
      //
      // AUDIT-FIELD F1: and it relaxes THE SHEATHE LEG ALONE, which is
      // why `torchOnly` above re-states its own three. `shown()`
      // (:430-446) is false for FOUR reasons - a readied spell, a cast
      // animation playing, an equip countdown, and the sheathe - and the
      // first cut tested only `!shown()`, so it reopened the gate for all
      // four. `openTravelMap` (scenes/world.js) guards an overlay, the
      // art, nearby foes, a give-offer, sun damage and the racial
      // override, and NOTHING about a spell: ready one and press M and
      // the arm drew its cast stance blended with the held-map delta,
      // holding a parchment. An equip countdown is the same shape -
      // "empty hands by construction", now a pair of them holding a map.
      // Said POSITIVELY (`playerWeapon.sheathed`), so a leg added to
      // `shown()` later cannot be relaxed here by accident.
      const sheetOnly = playerWeapon.sheathed && !spellArmed() && !fpsSpellCasting.isPlayingAnim
        && (entity?.equipCountdown ?? 0) <= 0 && fpArm.active() && fpArm.holdingPaper();
      // SW1-GATE (audit, 2026-09-19): A SHIELD IS NOT A WEAPON EITHER.
      // `shown()` is the WEAPON's predicate - TORCH-VIS says so for the
      // light and MAP-FIELD for the sheet, and the off hand is the third
      // to ask. The mod exists for the poses it keeps OUTSIDE the swing:
      // `Shield.WhenSheathed` (Off-screen by default, Corner and Ready the
      // two people actually pick) and `Shield.WhenCasting` both describe
      // frames in which `shown()` is FALSE, so gating the shield behind it
      // left `WhenAttacking` the only setting in the mod that did
      // anything. The shield's own verdict is `drawRect()` - the DLL's
      // gate ladder itself (SW1 bible, "the gate ladder"), which already
      // answers null for the equip countdown, the climb, the pause, the
      // load, third person and every Hide/Off-screen pose - so it relaxes
      // the early return exactly as far as the mod would draw and no
      // further. It is a pure read of the frame `lateUpdate` already
      // settled, so asking twice (here and in `shield.draw`) costs a
      // clamp and changes nothing.
      //
      // AUDIT-FIELD F1 applies here as it did to the sheet: this must
      // relax the gate ONLY where the shield genuinely paints, or a
      // sheathed frame that used to draw nothing starts drawing the
      // Morrowind arm instead. So the verdict carries the draw step's own
      // two conditions (`!eotbHidesWeapon()`, `!fpArm.active()`) - the
      // arm's branch returns above the shield and the EotB branch above
      // that - and `if (!shown()) return;` below stops the shield-only
      // frame before the weapon's clone and sprite.
      if (shieldOn()) shield.setThirdPerson(eotbHidesWeapon());
      const shieldRect = (shieldOn() && c && !eotbHidesWeapon() && !fpArm.active())
        ? shield.drawRect() : null;
      if (paralyzed || (!shown() && !torchOnly && !sheetOnly && !shieldRect)) return;
      // THE ONE SEAM. The arm draws whole and RETURNS, or it is inactive
      // and the classic sprite draws exactly as it always has. The return
      // is load-bearing: without it both composite and the player sees a
      // weapon sprite pasted over a pair of hands.
      // WW1: the widget's channels reach the Morrowind arms as a screen
      // transform over their composite (Bob, Inertia, Step); the Offset
      // module's slide is the sprite's own sheathe and stays with it.
      fpArm.setScreenTransform(widgetOn() ? (base) => widget.armsTransform(base) : null);
      // WW1: THE CLONE DRAWS IN THE SPRITE'S PLACE. DFU's clone hides the
      // original every frame and draws itself in OnGUI; here the one
      // draw seam picks the clone while its switch is on - after the arm
      // (which returns), before the sprite (which the clone stands in for).
      // AUDIT-EOTB2 [SETTINGS]: ToggleBillboard hides the FPV weapon while
      // the sprite body is on screen (Compatibility.Don'tHideWeapon keeps
      // it) - the classic sprite, the torch hand and the clone alike. The
      // machine still swings; only the picture goes.
      _armDrewLast = !eotbHidesWeapon() && fpArm.active();   // MAP3: the two lines below draw the arm exactly when this is true
      if (eotbHidesWeapon()) return;
      if (fpArm.active()) { fpArm.draw(c); return; }
      // HT1: the torch hand draws FIRST, the weapon over it - two OnGUIs
      // with no order between them in DFU; the port picks the one that
      // keeps the weapon whole. Under the Morrowind arms it is not drawn
      // (a classic hand beside a modelled arm is neither mod nor lane).
      // SW1: THE SHIELD DRAWS FIRST. It is the OFF hand, so it sits
      // behind the torch hand and behind the weapon - two OnGUIs with no
      // order between them in DFU, and this is the one that keeps both
      // whole. Under the Morrowind arms it is not drawn, for the reason
      // the torch hand is not: a classic sprite beside a modelled arm is
      // neither mod nor lane (the arm's own branch has already returned).
      if (shieldRect) shield.draw((index, rect, uv) => drawShieldSprite(index, rect, uv, fpTint));
      if (handheldOn() && c) handheld.draw(renderer, c, fpTint);
      if (torchOnly) return;   // TORCH-VIS: the lit hand ALONE - a sheathed stance still draws no weapon, clone or sprite
      // SW1-GATE: and the shield ALONE is no more a weapon than the torch
      // is. A no-op for every path that predates it - `torchOnly` has
      // returned, `sheetOnly` needs `fpArm.active()` which returned at the
      // seam - so this line stops the shield-only frame and nothing else.
      if (!shown()) return;
      if (widgetOn() && c && widget.draw(renderer, c, fpTint)) return;
      const art = c && artFor(playerWeapon.weapon);
      if (art) drawFpsWeapon(renderer, c, art, playerWeapon.machine.state, playerWeapon.machine.frame, { tint: fpTint });
    }
  }
}

/**
 * WeaponEnvDamage's swing ray, verbatim shape (mirrors the audited
 * dungeon site): the nearest action object along the look within
 * weapon reach, world geometry occluding; a DOOR hit is BASHED and
 * consumes the swing, any other action object gets Receive(Attack)
 * (the gate table filters) and the swing continues in DFU - with no
 * foes in these hosts there is nothing further to resolve.
 */
export function envAttack(actions, collider, eye, lookDir, rolls = Math.random) {
  let best = null, bestD = Infinity;
  for (const o of actions.objects.values()) {
    // AUDIT 63 F37: WeaponEnvDamage reads a LIVE Physics.Raycast hit
    // (WeaponManager.cs:459-464), so a mover is struck where it is,
    // not where it was placed - the same law as the activate ray.
    const box = objectAabb(o);
    if (!box) continue;
    const d = rayAabb(eye, lookDir, box);
    if (d === null || d > WEAPON_REACH || d >= bestD) continue;
    const wall = collider.raycast(eye, lookDir, d - 0.05);
    if (Number.isFinite(wall) && wall < d - 0.05) continue;   // occluded
    best = o; bestD = d;
  }
  if (!best) return false;
  // FX1 (F182): Receive(player, Attack) fires on ANY struck object
  // carrying an action FIRST - an action door is one GameObject with
  // both components in DFU (WeaponManager.cs:458-465) - and only THEN
  // a door bashes (:467-472). The old door-only branch meant an
  // Attack- or MultiTrigger-flagged door record (Castle Wayrest's
  // doors are MultiTrigger) never fired on a weapon hit, because the
  // bash path passes the Door trigger alone, which those records
  // reject.
  actions.receive(best, 'Attack');
  if (best.kind === 'door') { actions.attemptBash(best, rolls()); return true; }
  return false;
}
