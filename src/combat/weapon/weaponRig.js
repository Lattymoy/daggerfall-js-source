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

import { PlayerWeapon, WEAPON_REACH, setWeaponPoseProbe, weaponPoseOf, USING_RIGHT_HAND_TEXT, handDesc } from '../playerWeapon.js';   // RR1: the rig's drawn state and weapon type, for laws that ask off-rig
import { eotbBody } from '../../player/eyeOfTheBeholder/eotbBody.js';   // EOTB5: the sprite body, for a player with no Morrowind data
import { eotbCamera } from '../../player/eyeOfTheBeholder/eotbCamera.js';
import { racialFpsWeapon } from '../../systems/lycanthropy.js';   // V4: the transformed rig's claws
import { EQUIP_SLOTS, equipTableOf, fillEquipTable } from '../../systems/equip.js';   // AUDIT 17e F17; MW-D32 the worn read; MW-EARLY: a save's worn set
import { setItemFields } from '../../systems/item/itemTemplates.js';   // MW-EARLY: a save's items as the restore reads them
import { dfWornEquipment } from '../../formats/morrowind/mwItemMap.js';   // MW-D32
import { ownWerewolfSkin } from '../../systems/ownGlyphs.js';   // SHADOW-FANG: the skin my own werewolf wears
import { ARMOR_ENUM } from '../enemyEquipment.js';   // MW-D32
import { loadFpsWeaponArt, drawFpsWeapon, fpsWeaponQuad, weaponTypeForItem, WEAPON_TYPES, fpLightingOn, WEAPON_FILE, plainWeaponType, isGunType, isPistoletType } from '../fpsWeapon.js';
import { spriteGlow, meshGlow } from '../../systems/weaponGlow.js';   // WEAPON-GLOW1: the held weapon's element, as each hand shows it
import { loadThunderlockArt } from '../thunderlockArt.js';
import { THUNDERLOCK_NUM_FRAMES } from '../../characters/weaponStates.js';   // THUNDERLOCK-ART2's audit: the cycle's length, never a literal six
import { loadPistoletArt } from '../gun/pistoletArt.js';   // PISTOLET: the second gun's strip
import { createPistolLane } from '../gun/pistolLane.js';   // PISTOL-PORT: one Pistolet or a pair on the pistol lab's own frame, the module the rig wires (HOST-SPLIT)
import { createRecoil, GUN_FEEL, PISTOLET_FEEL, gunPitch, muzzleGlow, MUZZLE_CURVE, THUNDERLOCK_MUZZLE_CURVE, GUN_TICK_SECONDS, armGunPose, RELOAD_CLOSE_LEAD } from '../gun/gunFeel.js';   // AUDIT FIELD-GUN-MW F1: the flash's own clock under the arm; MW-GUN-FEEL: the arm's kick and reload
import { createGunRig, gunRigStep, gunWidgetSettings, gunMotion, gunFrameRect } from '../gun/gunViewmodel.js';   // FIELD-GUN12: the PROTOTYPE's frame, run rather than resembled
import { readWidgetSettings } from './weaponWidgetMotion.js';   // FIELD-GUN8: the mod's own reader, so the Thunderlock's Inertia rides its multipliers   // FIELD-GUN6: the lab's own feel, in the game at last
import { betterAmbience } from '../../systems/betterAmbience.js';   // FIELD-GUN6: the ONE camera shaker in the port, already wired through all four hosts
import { orbColour, MUZZLE_FORWARD, orbArchiveFor } from '../../characters/thunderlockIds.js';   // FIELD-GUN17: the flash wears the orb's own colour, sampled rather than named
import { worldRectPx } from '../../player/tapRay.js';   // FIELD-GUN19: the docked HUD's world strip, in canvas pixels - ROAD-E E5's one home for that flip
import { installPistoletSounds, PISTOLET_SFX as PL_SFX } from '../../systems/pistolet.js';   // PISTOLET: the second gun's clips, the same door
import { installThunderlockSounds, SFX as TL_SFX } from '../../systems/thunderlock.js';   // AUDIT-THUNDERLOCK F8: the weapon's own clips, through the mod-sound door   // the port's own weapon: its art is a sheet, not a CIF   // MAC-I: the tint's switch, with the sprite it tints
// ROAD-tail (FPSSpellCasting.cs): the classic spellcasting HANDS. A
// separate component in DFU and a separate module here, drawn by the
// same rig because this is the one surface every FPS-weapon host
// already mounts - so wiring it here wires all four at once.
import { fpsSpellCasting, loadSpellCastArt, drawSpellCastHands, magicAnimFilename, readiedHandsFrame } from '../fpsSpellCasting.js';   // RSH1: the readied hands
import { createClimbHands, climbLens } from '../climbHands.js';   // CLIMB-HANDS: the classic lane's hands on the wall; II: the lens they are pinned through
import { fieldOfView } from '../../ui/viewSettings.js';   // CLIMB-HANDS II: the world's own field of view, the hands' lens
// MW-D8: the classic sprite is still the DEFAULT and still the fallback,
// and runs untouched otherwise. The Morrowind arm below is an opt-in
// layer that either draws whole or does not draw at all - there is no
// state in which both reach the screen, and none in which neither does.
import { fpArm, hasAmmoFor } from '../fpArm.js';
import { ammoCountFor } from '../../systems/inventory.js';   // AUDIT 68 S27-ammoCount-dup: the quiver's count, from the spend law's own module
import { getPref } from '../../systems/uiPrefs.js';   // MWA1: the arms switch
import { morrowindDataCount, morrowindDataFingerprint, registerMorrowindData, morrowindDataCounted, countMorrowindArchives } from '../../scenes/dataSource.js';   // MWA1: are the archives attached; AUDIT 65 XL-6: and measured; MW-EARLY: and counted
import { mwRaceId } from '../../formats/morrowind/mwNpc.js';   // TR2: the one race-id spelling
import { TEMPLATES } from '../../systems/useItem.js';   // MW-D51: the Torch template - the lit light the Morrowind hand holds
import { morrowindDataGeneration } from '../../scenes/dataSource.js';
import { objectAabb, rayAabb, hasMeshCollider, RAY_DISTANCE } from '../../player/activate.js';   // AUDIT 63 F37: one live box for both rays
import { SOUND } from '../../systems/soundClips.js';
import { equipSoundFor } from '../../characters/weapons.js';   // F023: GetEquipSound
import { setMidScreenText } from '../../ui/midScreenText.js'; import { weaponOffsetHeight } from '../../ui/hud/hudLarge.js';   // AUDIT 64 F34: FPSWeapon.cs:365's mid-screen line; CLIMB4: OnGUI's own offset, the climb's drop under it
import { createWeaponWidget } from './weaponWidget.js';
import { createTwoHands } from '../twoHands/twoHands.js';   // TWO-HANDS: the sprite lane's second hand, its guard and the running hands
import { atlasFileName } from '../diverseWeapons/diverseWeapons.js';   // DW1: the art cache's third key
// SW1: SHIELD WIDGET. The sibling, beside the weapon's clone and driven
// on the same frame - the shield the game never drew, in the hand the
// weapon is not in.
import { createShieldWidget } from '../shieldWidget.js';
import { shieldWidgetTextures, shieldWidgetImage } from '../shieldWidgetAssets.js';
import { setAttackOnPlayerHook } from '../formulas.js';   // SW1: PCAAO's onAttackDamageCalculated, for the Recoil module
import { conditionPercentage } from '../../systems/item/itemInfo.js';   // SW1: the condition tier
import { isShieldTemplate } from '../../systems/armorMaterials.js';   // SW1: GetShieldProtectedBodyParts' own test
import { rriNativeMaterialValue } from '../../systems/roleplayRealismItems/rriItems.js';
import { riddenHorseLook } from '../../systems/horse/horseCoats.js';   // COATS1: the sprite body's mount wears the ridden horse's look   // AUDIT 68 S09-v-shield-material-ignored: the port's one NativeMaterialValue
import { createHandheldTorches, isHeldLight } from '../../systems/handheldTorches.js';   // HT1: Handheld Torches' component, one per rig beside the widget; TORCH-VIS: and its own light test
import { lanternAtWaist } from '../../systems/playerTorch.js';   // HT-WAIST: a lantern hung at the waist is in no hand - the ladder, the Morrowind body and the sprite ask the one question
import { liveVampirism } from '../../systems/racialLive.js';   // PORTRAIT3D: a vampire's body wears the race's vampire head
import { isTransformedLycanthrope, liveLycanthropy } from '../../systems/lycanthropy.js';   // WW1: Weapon Widget's FPSWeaponClone, beside the machine; AUDIT-EOTB2: the sprite's form
import { concealmentFlags } from '../../systems/effects.js';   // EOTB-IL: PlayerBillboard.UpdateMaterial reads the player's own IsInvisible / IsAShade / IsBlending
import { getBool, getInt } from '../../systems/settings/settings.js';   // EOTB-IL: PlayerBillboard.LateUpdate reads DaggerfallUnity.Settings.BowDrawback
import { modSetting } from '../../systems/modSettings.js';   // WW1: its Enabled
import { takeFrameLook } from '../../player/lookFilter.js';   // WW1: the frame's look for the widget's inertia
import { uiCanvas, onUiScreen, fromUiPoint } from '../../ui/uiScreen.js';   // RETRO-UI: the viewmodel in DFU's CustomScreenRect
import { dfuLookAxes } from '../../ui/lookSettings.js';   // WIDGET-LOOK: the mods' Inertia reads DFU's look axes, not the camera's radians
import { cursorActive } from '../../player/pointerLock.js';   // WW1: PlayerMouseLook.cursorActive
import { liveStat } from '../../systems/statMods.js';   // WW1: the widget's speed ratio
import { castRate } from '../../systems/castSpeed.js';   // CAST-SPEED: the rate both lanes' hands cast at
import '../swingLaw.js';   // AUDIT PRE-MERGE 0929 S5: SWING-LAW's reader of the weapon in the hand, registered as it loads - every rig's
import { walkSpeed } from '../../player/motor.js';   // WW1: GetBaseSpeed's walk arm
import { localizedText, t } from '../../systems/textManager.js';   // L10N3d: DFU's Internal_Strings, read in the player's language; TWO-HANDS: the lead's two lines, the port's own
import { HANDS_MODE, twoHanded, runHandsWanted, runHandsKept, runPhaseOfBob, MIRROR_UV, otherHand, guardStep } from '../twoHands/handsLaw.js';   // TWO-HANDS: how the hands are held, and when they run
import { spellHandOf, tellSpellHand, castPending, drawSpellHand, guardDrop } from '../twoHands/spellHand.js';   // SPELL-HAND: a spell in the free hand beside a one-handed weapon
import { stepTechnique, claimShot, techniqueFlying, TECHNIQUE_ACTION } from '../techniques.js';   // TECH1: the technique key - every host's rig steps the one runner
import '../../systems/martialPowers.js';   // MARTIAL3/4 (bible/05-Combat/Martial-Specialisations.md): what the martial paths and the weapons past 100 DO - registered at import, so every host's rig (exterior.js, world.js, worldModes.js' interiors, dungeonContext.js' dungeons) has them
import { techniqueHands } from '../technique/techniqueFx.js';   // TECH-FX: a technique's push of the first-person layer
import { playerHarmedWithin } from '../../systems/harmMark.js';   // RIFLE-STANCE: a foe's harm on the player - the fight a long gun's aim reads
import { RIFLE_EASE } from '../gun/rifleStance.js';

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
 * classicSave.js:"The transform curses"), so the card's old `female: !!playerEntity
 * .gender` was TRUE FOR EVERYONE - every build asked for the female
 * skeleton and the female body columns, and the male-record fallback
 * fills made it look almost right. The test is the string compare,
 * the same one every other consumer makes.
 */
/** WEREWOLF1: IS THIS ENTITY MORROWIND'S WEREWOLF RIGHT NOW - a transformed
 *  lycanthrope whose curse is the wolf's (LycanthropyTypes 1). The wereboar
 *  (2) has no Morrowind form: its person's body stands, as before. */
export function isMwWerewolf(entity) {
  return !!entity && isTransformedLycanthrope(entity) && ((liveLycanthropy(entity)?.infectionType | 0) === 1);
}

export function armBuildOptsOf(entity) {
  // the ammunition question is asked OF THE WEAPON, and the weapon this
  // function has is the worn one - there is no live rig here
  const worn = entity.equip?.slots?.[EQUIP_SLOTS.RightHand] ?? null;
  return {
    werewolf: isMwWerewolf(entity),   // WEREWOLF1: a save loaded mid-transformation builds the wolf at the door
    skin: isMwWerewolf(entity) ? ownWerewolfSkin() : null,   // SHADOW-FANG: and in its skin
    vampire: !!liveVampirism(entity),   // PORTRAIT3D (the owner: "Do this"): a vampire wears the race's vampire head (getVampireHead, MWNPC14), the body as its portrait
    race: mwRaceId(entity.race),
    female: entity.gender === 'female',
    faceIndex: entity.faceIndex | 0,
    armor: dfWornEquipment(equipTableOf(entity), EQUIP_SLOTS, ARMOR_ENUM),
    weapon: worn,
    hasAmmo: hasAmmoFor(entity.items, worn),
    ammoCount: ammoCountFor(entity.items, worn),   // WS1: the quiver
    torch: isLitTorch(entity.lightSource),   // MW-D51: the lit light, in the left hand
    hipLight: lanternAtWaist(entity.lightSource),   // HT-WAIST: the lit lantern, hung at the hip of the third-person body
    sheathing: getPref('mwSheathing'),   // WS1: the holster on the third-person body
    ownHeads: true,   // MW-HEADS2: the player's body wears the port's own heads (a Breton man's) - an NPC's never does
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
  return { race: mwRaceId(entity?.race), female: entity?.gender === 'female', faceIndex: entity?.faceIndex | 0, werewolf: isMwWerewolf(entity), vampire: !!liveVampirism(entity) };   // WEREWOLF1: and the form; PORTRAIT3D: and the curse's face
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

export function armsStandFor(entity, { ready = () => fpArm.ready(), builtFor = () => fpArm.builtFor(), buildingFor = () => fpArm.buildingFor() } = {}) {
  const want = armIdentityOf(entity);
  const same = (have) => !!have && have.race === want.race && !!have.female === want.female && (have.faceIndex | 0) === want.faceIndex
    && !!have.werewolf === want.werewolf && !!have.vampire === want.vampire;   // WEREWOLF1; PORTRAIT3D: and the curse's face
  // MW-EARLY: A BUILD UNDER WAY STANDS FOR WHOM IT IS BUILDING. The load
  // door starts the build off the save before the world is read
  // (prebuildArmsForSave), so the restore's own door arrives while it
  // runs - and a second build of the same body queued behind it doubled
  // the seconds the arms took. The build that will stand once the queue
  // drains is the answer while there is one; a different identity is
  // still a no, and its door queues the right body behind it.
  const coming = buildingFor();
  if (coming) return same(coming);
  if (!ready()) return false;
  return same(builtFor());
}

/**
 * MW-EARLY: THE ARMS' ENTITY, READ OFF A SAVE - the four things
 * armBuildOptsOf and autoBuildArms read of a character (race, sex and
 * face; the worn set and the hand; the light; chargenDone), taken from
 * the snapshot the load door is about to restore, before the world has
 * restored it. The items go through setItemFields as restorePlayer
 * sends them (save.js), the table is fillEquipTable's own fill of them
 * (rebuildEquipState's, without the armor values and the listeners -
 * this is no entity in the game, and nothing but the build ever reads
 * it), and the light is the record at the save's lightSourceIndex, the
 * index restorePlayer relinks. Null for a snapshot with no pack.
 */
export function saveArmsEntity(snap) {
  if (!snap || !Array.isArray(snap.items)) return null;
  const items = snap.items.map((it) => setItemFields(it));
  const li = snap.lightSourceIndex ?? -1;
  const e = { race: snap.race, gender: snap.gender, faceIndex: snap.faceIndex, chargenDone: snap.chargenDone, items, lightSource: li >= 0 ? (items[li] ?? null) : null };
  fillEquipTable(equipTableOf(e), items);
  return e;
}

/** AUDIT MW-EARLY F1: THE EARLY DOOR'S WORD, given before its first
 *  await. prebuildArmsForSave counts the store, and autoBuildArms then
 *  measures it, before fpArm has a build under way to say whom it is
 *  for (armsStandFor's first arm) - and a restore that landed in that
 *  gap passed every gate and queued the same body a second time behind
 *  the first. While the early door runs this holds its promise; every
 *  other door waits it out before asking its gates, and by then the
 *  early build stands, or never started, and the gates say which. */
let _armsIntent = null;

/**
 * MW-EARLY (Mac: "The player shouldnt load into the game and have to
 * wait for the morrowind models to load"): THE ARMS START WITH THE
 * LOAD, NOT AFTER IT. The world's load door knows which save it will
 * restore the moment it opens - and the build needs nothing of the
 * world, only the character and the attached files - but it was asked
 * for at the END of bootWorld, after every archive of the world had
 * been read and indexed and the save restored, so the player stood in
 * the world on the classic sprite while the body built. The host calls
 * this with that same snapshot as its boot begins; the build then runs
 * under the world's own loading, and the restore's autoBuildArms finds
 * it built or under way (armsStandFor, after _armsIntent) instead of
 * starting it. Never throws and never blocks: a refusal is
 * autoBuildArms's own warning.
 *
 * AUDIT MW-EARLY F3: `snapOf` is the snapshot or a function that reads
 * it, and it is read only once the store is known to carry files: the
 * most-recent pick parses every slot to find the newest, so a player
 * with no Morrowind data paid that parse at every load for nothing, and
 * the host shares the one parse with its load door (world.js bootSnap).
 */
export async function prebuildArmsForSave(snapOf, { build = autoBuildArms, counted = morrowindDataCounted, count = countMorrowindArchives, dataCount = morrowindDataCount } = {}) {
  let release;
  const intent = { done: new Promise((r) => { release = r; }) };
  _armsIntent = intent;
  try {
    // a boot that came in past the enhanced menu (a direct ?load, the classic start window) has not counted the
    // store, and autoBuildArms's gate reads the count - the cheap names-only door the menu itself takes
    if (!counted()) await count();
    if (!(dataCount() > 0)) return null;
    const e = saveArmsEntity(typeof snapOf === 'function' ? snapOf() : snapOf);
    if (!e) return null;
    return await build(e, { intent });
  } catch (err) {
    console.warn('[arms] the early build could not start -', err?.message ?? err);
    return null;
  } finally {
    if (_armsIntent === intent) _armsIntent = null;
    release();
  }
}

/** MWA1: THE ARMS AT BOOT. RookieG (2026-09-11): "morrowind arms did
 *  not work on first launch" - only the test room built them at boot;
 *  a normal game had the arms only after the Enhanced pane's Build
 *  button, and the module singleton dies with the tab, so every launch
 *  began bare. Each host that owns a rig calls this once the entity
 *  is a made character - at its rig's creation for a continuing
 *  session, after the wizard for a new one, after a restore for a
 *  load. A refusal is logged, never thrown: the arms are a departure
 *  the classic sprite stands in for. Returns the build's result, or
 *  null when nothing was asked for. */
export async function autoBuildArms(entity, { dataCount = morrowindDataCount, measure = registerMorrowindData, measured = morrowindDataFingerprint, standing = armsStandFor, intent = null } = {}) {
  // AUDIT MW-EARLY F1: the early door's word first - its build may not be under way yet (`intent` is that door's own)
  if (_armsIntent && _armsIntent !== intent) await _armsIntent.done;
  // MWA4: the attached files are the switch - MWA1's `mwArms` pref (and MWA2's On/Off row over it) is retired, and
  // Remove data is the off (ui/enhanced/enhancedMenu.js morrowindCard)
  if (!entity?.chargenDone || !(dataCount() > 0) || standing(entity)) return null;
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
 *                     (dungeonContext.js:"let _drawSprite ="), townTalk.say
 *                     (exterior.js:"actionDown: (action) => held".."say: (l) => townTalk.say(l),", world.js:"toggleSheathCalls:") and
 *                     worldModes' own interior sink (worldModes.js:"second argument is",
 *                     which warns to console only where a host mounts
 *                     no townTalk at all), so the empty default below
 *                     is unreached,
 *   spellArmed()    - optional: WeaponManager's HasReadySpell leg
 *   readiedSpell()  - optional (RSH1): PlayerEffectManager.ReadySpell - the readied record, or null - for the
 *                     Readied Spellcasting Hands mod's raised hands
 *                     (hosts without casting omit it),
 *   abortSpell()    - MAC-O1: EntityEffectManager.AbortReadySpell, the
 *                     other half of that leg. WeaponManager.Update
 *                     :251 calls it on the ReadyWeapon key, which is
 *                     the ONE place in DFU where the weapon key
 *                     touches the spell; a host that readies spells
 *                     must hand it over or Z cannot put one away,
 * }
 */
/**
 * FIELD-GUN17 - THE PIXEL, AS A RAY. The whole of thunderlockMuzzle's
 * arithmetic, pulled out of the rig so it can be driven without a
 * renderer, a canvas or a held weapon: it is four numbers and a
 * projection, and it is the part that can be silently wrong.
 *
 * `drawn` is the record drawThunderlock parks - the rect it drew at,
 * the canvas it drew on, the art's own muzzle point (fractions of the
 * drawn rect, y from the TOP - the flash's ball, combat/gun/gunFlash.js flashBodyPoint) and
 * whether the handedness mirror was on. Null for anything missing,
 * which is how a host that has not drawn the gun yet - or a bow -
 * keeps GetAimPosition's verbatim arm.
 */
export function muzzleRay(drawn, fovRad, forward = MUZZLE_FORWARD) {
  if (!drawn?.muzzle) return null;
  const { rect, canvasW, canvasH, muzzle, flip, viewport = null, aspect = null } = drawn;
  if (!(canvasW > 0) || !(canvasH > 0) || !(fovRad > 0)) return null;
  // the mirror flips the whole composite about the rect's own centre,
  // so the muzzle goes with it (gunFrameRect's own law)
  const fx = flip ? 1 - muzzle.x : muzzle.x;
  const px = rect.x + fx * rect.w;
  const py = rect.y + muzzle.y * rect.h;
  // FIELD-GUN19 (Mac: "the orb projectile that shoots doesnt line up
  // with the muzzle. It shoots out high on the screen").
  //
  // THE MUZZLE IS A CANVAS PIXEL AND THE ORB IS A WORLD OBJECT, and
  // ROAD-E E5 made those two different spaces: the docked large HUD
  // SHRINKS the world pass (`setWorldViewport`, ViewportChanger.cs
  // :52-67) while the 2D pass takes the whole canvas back, so the gun
  // is drawn over the full frame and the shot is projected into a
  // strip. This line used to divide by `canvasH` and say so in a
  // comment - "the viewmodel is drawn over the whole frame", which is
  // TRUE OF THE GUN and says nothing about where the orb lands.
  //
  // The strip is shorter than the canvas, so the same pixel divided by
  // the taller of the two gives a LARGER `up` - the shot came out
  // above the barrel, by about half the bar's height, exactly as
  // reported. E5 converted the crosshair (hudCrosshair.crosshairCentreY)
  // and the tap pick (player/tapRay.js) for this reason and the
  // viewmodel's muzzle was the third consumer nobody had counted.
  //
  // `worldRectPx` is that file's own arithmetic - the normalized
  // bottom-left rect into top-left canvas pixels, which is the part
  // with a flip in it and the part worth having one home for. What is
  // NOT taken from there is its bounds test: a tap outside the strip
  // is not a pick, but a muzzle below it is a real point below the
  // bottom of the view, and clamping it would move the shot.
  const r = worldRectPx(viewport, canvasW, canvasH);
  if (!(r.w > 0) || !(r.h > 0)) return null;
  const tanY = Math.tan(fovRad / 2);
  // the WORLD STRIP's aspect - the same one the host's own perspective() takes (hudLarge.largeHudWorldAspect). RETRO1:
  // unless the frame says otherwise - a retro world is projected at its texture's shape and stretched over the strip,
  // so the lens's own aspect (Renderer.worldProjAspect) is the one a strip pixel maps through
  const tanX = tanY * (aspect > 0 ? aspect : r.w / r.h);
  return {
    right: (((px - r.x) / r.w) * 2 - 1) * tanX * forward,
    up: (1 - ((py - r.y) / r.h) * 2) * tanY * forward,   // screen y counts DOWN, camera up counts UP
    forward,
  };
}

/** MW-MAP1 (2026-09-22, a player: "the morrowind map isnt showing"):
 *  THE HELD MAP'S HOLDER, IN ONE PLACE. MAP3 gave the enhanced held map
 *  a `holder` - the four doors it asks of the Morrowind arm (would it
 *  draw, take the sheet, let it go, where are the sheet's corners) - and
 *  wrote it inline in world.js's TRAVEL map builder. Then EM3/EM4 gave
 *  the SAME window its M-key doors (the town plan, the dungeon and
 *  building automaps) through ui/town/townMapDoor.js and ui/automap/automapDoor.js,
 *  and none of those doors passed a holder: every sheet opened with M
 *  fell to the painted gauntlets, and a player with Morrowind arms saw
 *  the Morrowind map only on V, outdoors. The holder is written once
 *  here, off the rig that owns the arm, and every host that has a rig
 *  hands it to every door it opens. `rig` is a FUNCTION so a host whose
 *  rig can be swapped answers live, and a host with no rig at all (the
 *  ?interior probe) passes nothing and keeps the sprite lane. */
export function sheetHolderOf(rig) {
  return {
    available: () => !!rig()?.armsAvailable?.(),   // MAP-FIELD: WOULD it draw - the arm is sheathed until it takes the sheet
    hold: (spec, opts) => !!rig()?.holdPaper?.(spec, opts),
    release: () => { rig()?.releasePaper?.(); },
    // AUDIT-MAP2: corners only from a frame the arm DREW - a paralysed,
    // hidden or third-person arm answers none, and the window hides the ink
    corners: () => { const r = rig(); return (r?.armsDrawn?.() ? r.paperCorners() : null) ?? null; },
  };
}

/** CLIMB4 (the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md, the feel): THE VIEWMODEL LOWERED FOR THE CLIMB.
 *  WeaponManager.Update's climbing return (:236-240) is ShowWeapons(false) - a cut; the port eases it, down quickly as
 *  the hands go to the stone (`down` s, the time constant) and back up a little slower as they come off it (`up`). */
export const CLIMB_LOWER_TAU = Object.freeze({ down: 0.07, up: 0.14 });
/** Lowered this far, the viewmodel is out of sight: no lane draws. */
export const CLIMB_LOWER_GONE = 0.98;
/** AUDIT CLIMB-HANDS: the classic lane's climbing hands (combat/climbHands.js) come up once the weapon is this far down -
 *  half the screen's height under its rect, three frames into the climb: the weapon and the hands never overlap. */
export const CLIMB_HANDS_AFTER = 0.5;
/** MIXED-PAIR: the machine a pair's gun-hand clone rests on - never attacking, so it swings, sounds and thuds nothing. */
const STILL_MACHINE = Object.freeze({ state: 'Idle', frame: 0, isBow: false, isUnarmed: false, now: 0 });
/** SPELL-HAND: the left hand holding a shield, as the hands' law reads it (playerWeapon.js's own SHIELD_HAND - UpdateHands
 *  blanks the left cache, so the law is told outright). */
const SHIELD_DESC = Object.freeze({ item: true, shield: true });
/** One frame of the lowering: toward 1 while `climbing`, back to 0 after; snapped home within half a percent. */
export function climbLowerStep(lower, climbing, dt) {
  const target = climbing ? 1 : 0;
  const tau = climbing ? CLIMB_LOWER_TAU.down : CLIMB_LOWER_TAU.up;
  const next = lower + (target - lower) * (1 - Math.exp(-Math.max(0, dt) / tau));
  return Math.abs(target - next) < 0.005 ? target : next;
}
/** The classic sprite's drop, in pixels of a `height`-tall screen: a smoothstep of the lowering over the whole height,
 *  so the hand sinks out of the bottom of the screen (0 lowers nothing - DFU's rect). */
export function climbDrop(lower, height) {
  const s = Math.min(1, Math.max(0, lower));
  return s > 0 ? Math.round(s * s * (3 - 2 * s) * height) : 0;
}
/** The Morrowind arms' screen rect, lowered the same way (fpArm.setScreenTransform's rect: x, y, w, h). */
export function climbLowerRect(rect, lower) {
  return { ...rect, y: rect.y + climbDrop(lower, rect.h) };
}
/** TECH-FX: the arms' rect dipped by a technique's `dip` (screen heights of a `screenH`-tall screen - drawInner). */
export function techniqueDipRect(rect, dip, screenH) {
  return { ...rect, y: rect.y + dip * screenH };
}

export function createWeaponRig({ renderer, canvas, fetchBytes, palette, audio, entity, camera = null, say = () => {}, spellArmed = () => false, readiedSpell = () => null, abortSpell = () => {}, bindWorn = true, activateHeld = () => false, envHit = null, missEffect = null, collider = null, actionDown = null, torches = () => null, sheetWindowUp = () => false, dropRefusal = () => null, actTool = () => null, technique = null }) {   // TECH1: `technique` the host's door for a weapon's technique (combat/techniques.js: motor, fireArrow, drainFatigue, face)   // HT1 (KB1): whether a registry action is held, and the hosts' dropped-torch pool   // MAP-WEAPON: whether the travel map window holds the screen   // AUDIT 28 W12: HasAction(ActivateCenterObject) - the drawn bow's un-draw; WW1: the widget's recoil doors
  const playerWeapon = new PlayerWeapon({ liveSpeed: () => (entity ? liveStat(entity, 'speed') : 50) });   // DISC28-D: the swing clock reads the live Speed (FPSWeapon.cs:431/549-556), as the body and the widget already did
  playerWeapon.gunReady = () => !pelletsOwed();   // MIXED-PAIR: a blade-and-gun pair's gun fires only with a Pellet for it - else its pull is the blade's
  playerWeapon.shotHeld = () => _heldHit;   // MIXED-PAIR: and its shot is in flight until the arm lets its held hit go (MW-D42) - the blade's turn waits for it
  playerWeapon.animCtx = () => playerWeapon.swingCtx(entity);   // TWO-HANDS: the hand in use (the striking one). AUDIT-RR F1: GetMeleeWeaponAnimTime(player, weaponType, weaponHands) - the swing clock's own ask, so RR's weaponSpeed and RRI's weaponBalance time the blow that lands, not only the widget's clone
  const poseProbe = () => ({ ...weaponPoseOf(playerWeapon), weaponType: weaponTypeForItem(playerWeapon.weapon) });   // RR1: WeaponManager.Sheathed (the pair through its one law, HARD2c) + ScreenWeapon.WeaponType
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
  /** FIELD-GUN8: declared ABOVE the widget, not beside `widgetOn`
   *  below it. `createWeaponWidget` calls `settings()` inside its own
   *  constructor, so a `const` arrow declared after it is still in
   *  the temporal dead zone when that call lands - every rig in the
   *  game threw on construction, which the rig's own suites caught at
   *  once. The same trap systems/effectBroker.js's header describes
   *  one import away. */
  /** FPSWeapon's handedness mirror, as the lab's `flip` switch. */
  const handedFlip = () => getInt('Controls', 'Handedness', 0, 3) === 1;
  /** PISTOLET: ANY of the port's own guns - the name is the first one's, and every reader of it asks of a gun. */
  const thunderlockHeld = () => isGunType(weaponTypeForItem(playerWeapon.weapon));
  /** PISTOLET: the held gun's own row, sounds and widget tuning - the Thunderlock's GUN_FEEL or the Pistolet's. */
  const pistoletHeld = () => isPistoletType(weaponTypeForItem(playerWeapon.weapon)) || !!playerWeapon.pistols;   // MIXED-PAIR: a blade-and-gun pair's Pistolet whichever hand strikes
  const heldFeel = () => (pistoletHeld() ? PISTOLET_FEEL : GUN_FEEL);
  const heldSfx = () => (pistoletHeld() ? PL_SFX : TL_SFX);
  const installGunSounds = () => { installThunderlockSounds(audio); installPistoletSounds(audio); };
  /** PISTOL-PORT: a Pistolet up - one, or a pair - firing on the pistol lab's own machines (combat/playerWeapon.js
   *  `pistols`), and each hand's frame on the page's own (combat/gun/pistolLane.js). The Thunderlock keeps its own path. */
  const pistolsUp = () => !!playerWeapon.pistols && (bindWorn || !playerWeapon.gunPair);
  /** MIXED-PAIR: a gun is up - the one in use, or a blade-and-gun pair's whichever hand strikes (its frame, its voice and
   *  its feel step every frame the pair is up, not only on the gun's turn). */
  const gunUp = () => thunderlockHeld() || pistolsUp();
  const pistols = createPistolLane();
  /** FIELD-GUN8 (Mac: "Yes, 1:1"). THE LAB'S ONE MODULE DEPARTURE,
   *  carried. Weapon Widget ships Inertia OFF - "requires
   *  double-scaled weapon textures" - and the lab turns it ON for
   *  this weapon because this art IS high resolution, which makes it
   *  precisely the case the mod's warning is about. The sway is part
   *  of how the gun reads, so a game without it is not the prototype.
   *
   *  It is forced for THIS WEAPON ONLY and only upward: every other
   *  weapon, and every other module, reads the player's own settings
   *  untouched. A mod's switch is the player's to throw; this is the
   *  port's own weapon asking for the one module it was designed
   *  around, not a mod being overridden behind their back. */
  const widgetSettings = () => {
    const s = readWidgetSettings();
    if (!s.inertia && thunderlockHeld() && !playerWeapon.mixedPair) return { ...s, inertia: true };   // MIXED-PAIR: a pair's blade keeps the player's own - its gun steps on its own rig
    return s;
  };
  const widget = createWeaponWidget({ audio, envHit: envCast, missEffect, settings: widgetSettings });
  // TWO-HANDS (bible/05-Combat/Two-Hands.md): both fists up and a pair of weapons - the left hand's clone beside the
  // right's (the widget above is the one hand's, and a pair's right hand), the guard, and the running hands. The one
  // component every host's rig owns, as the clone is.
  const twoHands = createTwoHands({ audio, envHit: envCast, missEffect, settings: widgetSettings });
  /** TWO-HANDS: a light carried in a hand - it takes the left hand (handsLaw.js handsModeOf), a lantern at the waist
   *  none (HT-WAIST). AUDIT: only where a lane paints it in that hand - Handheld Torches' sprite on the classic lane, the
   *  Morrowind arm's torch on the Shield Bone (a torch alone: the arm holds no lantern); a light no lane draws holds no
   *  hand, and the two fists (the pair, the running hands) stand. */
  const lightInHand = () => !!entity && isHeldLight(entity.lightSource) && !lanternAtWaist(entity.lightSource)
    && (fpArm.ready() ? isLitTorch(entity.lightSource) : handheldOn());
  /** TWO-HANDS: the pair's hands are drawn and swung - the rig is bound to an equip table (bindWorn), not the beast. */
  const pairUp = () => bindWorn && twoHanded(playerWeapon.handsMode);
  /** TWO-HANDS: nothing at all in either hand - both hand slots of the table empty (no weapon, no shield), no light, not
   *  the beast's claws, no readied or playing spell, no act's tool, no held sheet, no swap under way. The running hands'
   *  "nothing equipped". */
  const handsEmpty = () => {
    if (!bindWorn || !entity) return false;
    const slots = entity.equip?.slots;
    if (slots?.[EQUIP_SLOTS.RightHand] || slots?.[EQUIP_SLOTS.LeftHand]) return false;
    if (lightInHand() || racialFpsWeapon(entity)) return false;
    if (spellArmed() || fpsSpellCasting.isPlayingAnim || actTool() || sheetWindowUp()) return false;
    return (entity.equipCountdown ?? 0) <= 0;
  };
  /** SPELL-HAND (combat/twoHands/spellHand.js spellHandOf): the hands allow a spell beside the weapon - a one-handed weapon
   *  (a blade or a Pistolet) in the hand that fights, nothing in the other: the weapon hand and the spell hand, or null.
   *  The equip table's hands (bindWorn). Read whether or not a spell is readied - drawing the weapon with one readied keeps
   *  it (readyWeapon). */
  const spellHandHands = () => (bindWorn ? spellHandOf({
    lead: playerWeapon.leadHand, leftBusy: playerWeapon.leftBusy && !torchStowsForSpell(),
    right: handDesc(playerWeapon.handItem('R')), left: playerWeapon.holdingShield ? SHIELD_DESC : handDesc(playerWeapon.handItem('L')),
  }) : null);
  /** AUDIT SPELL-HAND L2-3: a light Handheld Torches puts away for the spell (Handling.StowWhenSpellcasting, its default)
   *  takes no hand from it - the hand is free for the spell the moment one is readied, not two frames after the mod's own
   *  stow (the light carried while no spell is, or with the switch off, still takes it: DFU's two-handed cast). */
  const torchStowsForSpell = () => handheldOn() && !!handheld.settings?.stowOnSpellcasting && (spellArmed() || fpsSpellCasting.isPlayingAnim);
  /** SPELL-HAND: the Morrowind arm's hands still in a cast (fpArm.castInFlight) - its spellcast section outlasts the
   *  classic frames, whose release waits on the arm's key (MW-CAST1) and clears the ready there. */
  const armCasting = () => (fpArm.active() || fpArm.thirdActive()) && !!fpArm.castInFlight();
  /** SPELL-HAND: a cast still plays - the classic frames, or the arm's own past them. */
  const castPlaying = () => fpsSpellCasting.isPlayingAnim || armCasting();
  /** SPELL-HAND: the hands would hold a spell beside the drawn weapon - drawn, no swap under way, not on a wall (AUDIT
   *  SPELL-HAND L4-5: DFU's climb hides the weapon - WeaponManager's Update - so a spell readied there is DFU's), and the
   *  hands allow it. Whether or not a spell is readied: the cast doors' word for a spell readied this moment (L2-2). */
  const spellHandFits = () => !playerWeapon.sheathed && (entity?.equipCountdown ?? 0) <= 0 && !_climbing && !!spellHandHands();
  /** AUDIT SPELL-HAND L2-4: A CAST'S HANDS ARE DECIDED AS IT STARTS (castSpellAnim) - one hand or DFU's two, to its end: a
   *  swap delay ending, H, or a spell readied mid-cast never changes the picture under it. */
  let _castOneHand = false;
  /** SPELL-HAND: the spell hand is UP this frame (`_spellHand`, read once a frame by frame()): the hands fit it, and a spell
   *  is readied - or a cast plays that began in the free hand. */
  const spellHandNow = () => spellHandFits() && (castPlaying() ? _castOneHand : spellArmed());
  let _spellHand = false;
  /** SPELL-HAND: a strike is in flight - the machine's, a shot's hit held for the arm (MW-D42), the arm's own blow or draw
   *  still playing (fpArm.shotBusy), or a technique's leap or dash (AUDIT SPELL-HAND L4-7: its landing blow is paid for at
   *  the launch) - so a cast pressed now waits for it: the hands take turns. */
  const handsBusy = () => playerWeapon.machine.state !== 'Idle' || _heldHit || ((fpArm.active() || fpArm.thirdActive()) && !!fpArm.shotBusy()) || techniqueFlying();
  /** SPELL-HAND: the two guards (handsLaw.js guardStep, a pair's law) - the weapon under the cast, the readied hand under a
   *  blow - each lowered by GUARD.LOWER of its own drawn height (spellHand.js guardDrop). */
  const _spellGuard = { weapon: 0, hand: 0 };
  /** SPELL-HAND: the side of the screen the spell hand is drawn on - the side the weapon is not: a Pistolet's own side
   *  (pistolLane.js flipOf), the Weapon Widget clone's flip (Handedness, and Ambidexterity's hand), else FPSWeapon's
   *  Handedness flip. */
  const spellHandSide = () => {
    const p = playerWeapon.pistols;
    const weaponLeft = pistolsUp() ? pistols.flipOf(p, p.lead, handedFlip()) : widgetOn() && widget.applies() ? !!widget.flipHorizontal : handedFlip();   // AUDIT SPELL-HAND L2-1: the clone's flip whenever it has the weapon - through a Hide frame too
    return weaponLeft ? 'right' : 'left';
  };
  /** WW1 / TWO-HANDS: a widget clone's frame for one hand's `item` - the frame's own inputs (`f`: the canvas, the motion,
   *  the look, the camera thunk) and the item's art, type and metal. With `hand` the clone is a hand of a pair: it sees
   *  its hand's view of the machine (twoHands.view), is drawn as a right hand (pairHand) and swings on the rig's own
   *  ctx (the striking hand). Without, the caller hands the one hand's machine and hand. */
  function cloneFrame(item, hand, f) {
    const c = f.c;
    return {
      renderer, canvas: c, entity, art: c ? artFor(item) : null, weapon: item,
      weaponType: heldType(item), material: item?.material ?? -1, glow: glowOf(item),   // WEAPON-GLOW1: the set the art is - the plain one while an element shows - and its outline: each hand's own item's
      equipCountdown: entity?.equipCountdown ?? 0, castPlaying: fpsSpellCasting.isPlayingAnim, spellArmed: spellArmed(),
      thirdPerson: fpArm.thirdActive() || eotbHidesWeapon(), reach: WEAPON_REACH,   // AUDIT-EOTB2: the widget's third-person gate asked the Morrowind arm alone
      motion: f.motion,
      look: f.look, swingHeld: _held, cursorActive: cursorActive(), camera: f.camera,
      activateStarted: () => _activateStarted,
      ...(hand ? { machine: twoHands.view(hand), pairHand: true, usingRightHand: true, animCtx: playerWeapon.animCtx, fromBelow: twoHands.fromBelow(hand) } : {}),   // AUDIT 2: a punch off the running arm winds up from below
    };
  }
  /** TWO-HANDS: the hands' frame, after the machine's step - which hand the strike in flight is, the guard, and the
   *  running hands: DFU's run on the feet, over the ground, with nothing at all in either hand (handsEmpty). The sprite
   *  lane's component steps its run only on that lane (`handsLane`); the Morrowind arms run their own pump off the same
   *  answer (fpArm.setRunHands). `mv` is the host's motion bag, `localVel` the body's own velocity this frame. */
  /** TWO-HANDS: THE MORROWIND ARM'S HANDS, ONE DOOR - with both hands up its right hand holds the RIGHT hand's item (the
   *  weapon in use is whichever hand strikes - the right hand's mesh does not swap for the left's blow) and its left
   *  hand its own, mirrored on the Weapon Bone Left (fpArm.setOffWeapon); with one hand in use, that hand's. The hands'
   *  mode and lead ride beside them. The frame asks it; so does the enhanced pack (AUDIT 2, L4: ui/enhanced/enhancedInventory.js
   *  `handArm`), whose window blocks the frame while the table changes under it - `sync` reads the hands off the table
   *  first, as the frame's syncWorn does. It had kept its own one-hand read: a left-led pair held the left weapon in
   *  both hands while the window was up, and a pair made in it showed only when it closed. */
  function handArm({ sync = false } = {}) {
    if (sync) syncWorn();
    const armItem = pairUp() ? playerWeapon.handItem('R') : playerWeapon.weapon;
    fpArm.setWeapon(armItem, { hasAmmo: hasAmmoFor(entity?.items, armItem), ammoCount: ammoCountFor(entity?.items, armItem) });   // WS1: the quiver's count rides the swap
    fpArm.setHands({ mode: pairUp() ? playerWeapon.handsMode : HANDS_MODE.Single, lead: playerWeapon.leadHand });
    const offItem = pairUp() && playerWeapon.handsMode === HANDS_MODE.Dual ? playerWeapon.handItem('L') : null;
    fpArm.setOffWeapon(offItem);
    return { armItem, offItem };
  }
  let _runAir = 0, _runWanted = false;   // AUDIT 2: seconds off the ground on a run, and last frame's answer (runHandsKept)
  function stepTwoHands(dt, mv, localVel, { climbing = false, handsLane = false } = {}) {
    const speed = Math.hypot(localVel[0], localVel[2]);
    const attacking = playerWeapon.machine.state !== 'Idle';
    const body = {
      running: !!mv.running, standing: !!mv.standing, grounded: mv.grounded !== false, crouching: !!mv.crouching, riding: !!mv.riding,
      swimming: !!mv.swimming, climbing, speed, emptyHands: handsEmpty(), attacking,
    };
    // AUDIT 2: the run kept through a hop (handsLaw.js runHandsKept) - one answer for both lanes
    const aloft = !body.grounded && runHandsWanted({ ...body, grounded: true });
    _runAir = aloft ? _runAir + dt : 0;
    const wanted = runHandsKept({ wanted: runHandsWanted(body), aloft, wasWanted: _runWanted, airSeconds: _runAir });
    _runWanted = wanted;
    twoHands.step(dt, {
      mode: pairUp() ? playerWeapon.handsMode : HANDS_MODE.Single, machine: playerWeapon.machine, strike: playerWeapon.strikeInFlight,
      leftHanded: handedFlip(), standing: !!mv.standing, run: { wanted: wanted && handsLane, punching: attacking, speed, bob: mv.bobTimer },
    });
    fpArm.setRunHands?.(wanted, { speed, phase: Number.isFinite(mv.bobTimer) ? runPhaseOfBob(mv.bobTimer) : null });   // AUDIT: the arms on the head bob's clock too
  }
  const widgetOn = () => modSetting('weapon-widget', 'Enabled');
  // SW1: the shield's own component. Its sprites come from the player's
  // own copy of the mod (combat/shieldWidgetAssets.js); with none
  // attached `size()` answers null and the widget draws nothing, which
  // is the mod without its textures - there is no classic shield art to
  // fall back to.
  const shield = createShieldWidget({ textures: shieldWidgetTextures, audio });
  const climbHands = createClimbHands({ renderer });   // CLIMB-HANDS: Mac's two paintings on the wall, the sprite lane's (combat/climbHands.js)
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
  const readiedHandsOn = () => modSetting('readied-spellcasting-hands', 'Enabled');   // RSH1: its switch, read on the frame
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
      // AUDIT 68 S09-v-shield-material-ignored: minted armor carries NativeMaterialValue in `material`, not `nativeMaterialValue`
      templateIndex: item.templateIndex, nativeMaterialValue: rriNativeMaterialValue(item),
      conditionPercentage: conditionPercentage(item), isShield: isShieldTemplate(item.templateIndex),
    };
  };
  // SW1: the Recoil module's whole trigger, at the tail of every
  // resolution of an enemy's attack on the player (formulas.js).
  const attackOnPlayer = (attacker, target, damage, struckBodyPart) => {
    if (!shieldOn()) return;
    shield.onAttackDamageCalculated({ targetIsPlayer: true, bodyPart: struckBodyPart, damage, item: shieldItem() });
  };
  // HT1: HANDHELD TORCHES. The mod's HandheldTorches runs beside DFU's
  // WeaponManager reading it every frame (Sheathed, UsingRightHand,
  // ScreenWeapon.IsAttacking, the spell anim); here it reads the same
  // machine, and its Update / LateUpdate run where the widget's do. The
  // pool it drops into is the host's (scenes/droppedTorches.js), which
  // hands a picked-up light back through receivePickedUp.
  const handheld = createHandheldTorches({ audio, say, torches, dropRefusal });   // HOUSE-DROP: the host's word against a light on its floor
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
  // TWO-HANDS: the recoil is the striking hand's - a pair's left hand's blow recoils the left hand's clone
  playerWeapon.onAttackResult = ({ foe, damage }) => (pairUp() && playerWeapon.activeHand === 'L' ? twoHands.offWidget : widget).onAttackDamageCalculated({ damage, parrySounds: !!foe?.basics?.parrySounds, pos: foe?.pos ?? foe?.ai?.pos ?? null, isEnemy: true });
  let _activatePrev = false, _activateStarted = false;
  let _lastEye = null;   // WW1: PlayerMotor.MoveDirection, read off the eye's motion between frames, in the body's own frame
  /** TWO-HANDS (AUDIT): the eye kept every frame, ahead of the mods' gate - kept inside it, the running hands (which read
   *  the ground speed off it) never ran with the Weapon Widget, Handheld Torches and Shield Widget off. One array, reused. */
  const keepEye = (pos) => {
    if (!pos) _lastEye = null;
    else if (_lastEye) { _lastEye[0] = pos[0]; _lastEye[1] = pos[1]; _lastEye[2] = pos[2]; } else _lastEye = [pos[0], pos[1], pos[2]];
  };
  let _climbLower = 0;   // CLIMB4: the viewmodel lowered for the climb, 0 (in the hand) .. 1 (gone) - climbLower()
  let _climbing = false;   // CLIMB4: the last frame's climb (the touch button's swing reads it)
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
  const bindArm = () => {
    fpArm.attach(renderer, camera);
    // BEAST-SELF: the Morrowind arm and body stand aside while they are not the form the curse holds (combat/fpArm.js
    // setStandIn). SHADOW-FANG (the merge): Bloodmoon's wolf IS a Morrowind beast (WEREWOLF1), so a werewolf whose wolf
    // stands keeps them; a wolf refused or still building, a wereboar (Morrowind has none), and the wolf still standing
    // while the person rebuilds after the turn back stand aside - never the person on a beast, nor the beast on a person
    const beast = !!entity && isTransformedLycanthrope(entity), wolf = !!fpArm.wolfStanding?.();
    fpArm.setStandIn?.(beast ? !(wolf && isMwWerewolf(entity)) : wolf);
  };
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
  // that seam already (see `player/eyeOfTheBeholder/eotbBody.js`, which explains why).
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
    sheathed: playerWeapon.sheathed,
    spellcasting: spellArmed(),
    usingBow: !!playerWeapon.machine.isBow,
    transformed: !!entity && isTransformedLycanthrope(entity),
    lycanthropyType: (entity && liveLycanthropy(entity)?.infectionType) || 0,
    horseLook: entity ? riddenHorseLook(entity.items ?? []) : 0,   // COATS1: its code
    died: !!entity && (entity.health ?? 1) <= 0,
    motion: camera?.()?.move ?? null,
    attacking: playerWeapon.machine.state !== 'Idle',
    swingN: swing.n,   // AUDIT PRE-MERGE 0929 S1: the blow the machine is in (MAC7 #1's count) - one sprite swing a blow
    castPlaying: !!fpsSpellCasting.isPlayingAnim,
    bowDrawback: getBool('Controls', 'BowDrawback'),
    swingHeld: _held,
    liveSpeed: entity ? liveStat(entity, 'speed') : 50,
    // AUDIT DISC28 AR-2: and the rest of what the swing clock is asked with. The body's GetMeleeAnimTickTime asks
    // FormulaHelper.GetMeleeWeaponAnimTime(PlayerEntity, ScreenWeapon.WeaponType, ScreenWeapon.WeaponHands) - the
    // same call, through the same TryGetOverride, as the weapon's own GetAnimTickTime - so a registered override
    // (Roleplay & Realism's weaponSpeed, Items' weaponBalance, both on by default) times the sprite's swing as it
    // times the blow. Handed only the Speed, the body took DFU's line while the blow took the override: one blow, two
    // swings on screen.
    animCtx: playerWeapon.animCtx(),
    concealment: entity ? concealmentFlags(entity) : null,
    hipLantern: !!entity && lanternAtWaist(entity.lightSource),   // HT-WAIST: the lit lantern hangs at the sprite's hip, and swings as it walks
  });
  const bindBody = () => eotbBody.attach(renderer, eotbState);
  bindBody();
  // AUDIT 68 S09-rig-globals-last-built: the pose probe, PCAAO's hook and
  // the popup sink are module singletons too - re-claimed each frame
  // beside bindArm/bindBody, so the stepping rig owns them (AUDIT 39's law).
  const bindGlobals = () => {
    setWeaponPoseProbe(poseProbe);
    setAttackOnPlayerHook(attackOnPlayer);
    eotbCamera.setPopup(say);   // EOTB-IL: DaggerfallUI.PopupMessage, for the two Debug.ShowMessages lines
  };
  bindGlobals();
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
    if (fpArm.ready()) playerWeapon.followHeldHand();   // MW-HAND: under the Morrowind arm, never an empty hand while the other holds a weapon
    playerWeapon.leftBusy = lightInHand();   // TWO-HANDS: a light in a hand takes it - one fist beside it
    playerWeapon.applyWeapon(claws);
  };
  // RETRO-UI (FIELD BUGS 2026-10-03): the rig lays out on the UI canvas - DFU's CustomScreenRect under retro mode's
  // pillarbox (FPSWeapon.cs :128-129, FPSSpellCasting.cs :88-89), the canvas otherwise; draw() puts it at its place
  const cv = () => uiCanvas(typeof canvas === 'function' ? canvas() : canvas);
  const cache = new Map();   // `${type}:${material}` -> art (null while loading)
  // WEAPON-GLOW1 (bible/05-Combat/Weapon-Glow.md): THE HELD WEAPON'S ELEMENT as the classic hand shows it - asked once
  // a frame (frame(), beside syncWorn) and read by the art's choice and the sprite's three drawers. While it answers,
  // the hand swings the PLAIN sheet (plainWeaponType) and the outline is drawn over it. The answer is the weapon's it
  // was asked of: a hand changed later in the frame is asked again, never handed the last weapon's glow (or its sheet).
  let heldGlow = null, heldFor = null;
  const askHeld = () => { heldFor = playerWeapon.weapon; heldGlow = spriteGlow(heldFor); };
  const glowOf = (item) => (item && item === heldFor ? heldGlow : spriteGlow(item));
  const heldGlowNow = () => { if (playerWeapon.weapon !== heldFor) askHeld(); return heldGlow; };
  const heldType = (item) => (glowOf(item) ? plainWeaponType(weaponTypeForItem(item)) : weaponTypeForItem(item));
  let _dx = 0, _dy = 0, _held = false;
  let wolfForm = false, wolfSkin = null;   // WEREWOLF1 / SHADOW-FANG (AUDIT D5): the form handed to the rig last, and the skin read at its change

  function artFor(item) {
    const plain = !!glowOf(item);   // WEAPON-GLOW1: an element shown swings the plain sheet
    const type = heldType(item);
    if (type === WEAPON_TYPES.None) return null;
    // THE PORT'S OWN WEAPON takes the OTHER loader. Its art is ours,
    // shipped with the build, and needs no palette - which is also why
    // this test sits ahead of the palette guard: a Thunderlock draws
    // in a host that has not loaded ARENA2's palette yet, and a
    // classic weapon still cannot.
    const thunderlock = isGunType(type);   // PISTOLET: either gun
    if (!thunderlock && !palette) return null;
    // DW1: the key carries the name the atlas is ASKED by. Under Diverse
    // Weapons a longsword and a broadsword are the same WEAPON_TYPE with
    // different sprite sets, and an enchanted one a third - and the flag
    // going off mid-game is a fourth answer for the same type and metal.
    // `${type}:${material}` alone handed the first weapon's frames to
    // every later one of its class - WHICH IS WHAT DFU DOES (AUDIT-DW
    // F4, a named departure): FPSWeapon reloads its atlas only when
    // WeaponType or MetalType change (FPSWeapon.cs:138) and caches the
    // custom frames by the CLASSIC file name and metal (:743-750), so a
    // steel broadsword drawn after a steel longsword wears the
    // longsword's set there until the metal or class changes. The port
    // keys by the name the atlas is asked by: the mod's per-template art
    // is what the mod is for, and its author's tables are honoured over
    // DFU's cache slot.
    const gilded = thunderlock && item?.rarity === 'gilded';   // GILDED1: the Hourlock's frames in gold leaf (thunderlockArt.js gildFrame)
    const key = `${type}:${item?.material ?? 0}:${thunderlock ? (gilded ? 'gilded' : '') : atlasFileName(item, WEAPON_FILE[type] ?? '', undefined, plain ? false : undefined)}`;
    if (!cache.has(key)) {
      cache.set(key, null);
      (isPistoletType(type)
        ? loadPistoletArt(renderer, { magic: type === WEAPON_TYPES.Pistolet_Magic, gilded })   // PISTOLET: its own strip
        : thunderlock
        ? loadThunderlockArt(renderer, { magic: type === WEAPON_TYPES.Thunderlock_Magic, gilded })
        : loadFpsWeaponArt(fetchBytes, palette, renderer, type, item?.material ?? 0, item, { plain }))
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
   *    ShowWeapon at its prior value. The latch below is that "prior
   *    value" for the WEAPON MANAGER's write; ARROW2: the SPRITE's prior
   *    value after a loose is FALSE - FPSWeapon hides the bow itself as
   *    its release runs off the last frame (FPSWeapon.cs:529-531), so
   *    spriteShown() carries that hide. An un-draw is no one-shot end
   *    and keeps the bow drawn through its cooldown, as in DFU.
   *  - a running EQUIP countdown shows EMPTY HANDS (:275-281) - the
   *    port drew the new weapon while silently refusing attacks,
   *    which was the block half without its cue. */
  // MW-D42: the bow's held 'hit', waiting on the arm's release key, and
  // the ceiling that keeps a silent arm from swallowing the shot. The
  // classic bow release is 7 frames at the machine's 0.0625 tick, so a
  // real release lands near 0.44s and always beats this.
  const HELD_HIT_MAX_S = 1.2;
  // BOW-CLOCK: the ceiling held while the arm is STILL DRAWING this shot (fpArm.shotBusy). A Morrowind bow's draw can
  // outlast 1.2s - the arrow left mid-draw and the draw's own release key was left over for the next shot, which then
  // loosed at its click. Every state shotBusy names ends by itself; this is only the never-traps floor under it.
  const HELD_HIT_CAP_S = 4;
  let _heldHit = false;
  // MW-D42d: the loose SOUND, held with the loose it belongs to.
  let _heldSound = false;
  let _heldHitAge = 0;
  let _lastShown = false;
  // ARROW2: FPSWeapon.AnimateWeapon's own hide (FPSWeapon.cs:527-531) -
  // a bow's one-shot that runs off its last frame goes Idle AND sets
  // `ShowWeapon = false`, "so its idle frame doesn't show before it is
  // hidden for its cooldown". WeaponManager's cooldown early return
  // (:229-233) then leaves that FALSE in place until the next
  // ShowWeapons, so the latch below freezes false, not the true of the
  // shot. Only the SPRITE's ShowWeapon: an un-draw (:355-357) is no
  // one-shot end and keeps the bow shown, as in DFU; the Morrowind arm
  // is not FPSWeapon and keeps shown().
  let _bowReleaseHidden = false;
  function shown() {
    const m = playerWeapon.machine;
    if (m.isBow && m.now < m.cooldownUntil) return _lastShown;   // F024: the early return freezes the state
    _bowReleaseHidden = false;   // ARROW2: the first Update past the cooldown writes ShowWeapons again
    let v = true;
    // WeaponManager.cs:247 is `HasReadySpell || PlayerSpellCasting
    // .IsPlayingAnim` - BOTH legs. The second half had nothing to
    // read until the classic spellcasting hands existed, and the
    // comment on this line has claimed it since C9: a weapon sprite
    // drawn over the casting hands is the state DFU's own note says
    // never happens ("never mixed with weapons directly on screen at
    // same time").
    if ((spellArmed() || fpsSpellCasting.isPlayingAnim) && !_spellHand) v = false;   // HasReadySpell / IsPlayingAnim (SPELL-HAND: not while the spell is in the free hand - the weapon stays up beside it)
    else if ((entity?.equipCountdown ?? 0) > 0) v = false;     // F025: empty hands while equipping
    else if (playerWeapon.sheathed) v = false;
    _lastShown = v;
    return v;
  }
  /** ARROW2: FPSWeapon.ShowWeapon - shown(), less the bow's own hide at the end of its release. */
  function spriteShown() { return shown() && !_bowReleaseHidden; }

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
   *  (IL_14a5, IL_17f6). KB1: they are the registry's ShoulderSwitch and
   *  AutoPerspective actions (systems/inputActions.js MOD_ACTIONS), read
   *  through the host's `actionDown` - so a rebind in Controls moves them,
   *  a combo resolves, and the mod switched off answers neither (the
   *  readers' actionLive gate). The edge is taken here, off the held
   *  state, as the mod takes GetKeyUp. */
  const _eotbHeldLast = new Set();
  function pollEotbKeys() {
    if (!actionDown) return;
    for (const [action, act] of [['ShoulderSwitch', () => eotbCamera.switchShoulder()], ['AutoPerspective', () => eotbCamera.toggleAuto()]]) {
      const down = !!actionDown(action);
      if (!down && _eotbHeldLast.has(action)) act();
      if (down) _eotbHeldLast.add(action); else _eotbHeldLast.delete(action);
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
  const swing = { n: 0, strike: 'StrikeDown', hand: null };   // AUDIT MIXED-PAIR L4-3: and a pair's striking hand, for the peers
  /** MAC7 #2: the wire's cast - { n, rangeType }, counted at castSpellAnim, the one door both lanes' hands come through. */
  const cast = { n: 0, rangeType: 2, element: 4 };   // SPELLFX1: and the element, so a peer can draw the missile
  const shot = { n: 0 };   // SPELLFX1: arrows loosed from a BOW, for the wire (a gun's orb is not counted - peers draw a shaft)
  function fpAttack(strike, dt = 0) {
    swing.n = (swing.n + 1) & 0xffff; swing.strike = strike; swing.hand = pairUp() ? playerWeapon.strike?.hand ?? null : null;
    tellSpellHand({ up: _spellHand, fits: spellHandFits(), busy: true });   // SPELL-HAND: a strike begun this frame is in flight for the cast door the hosts ask before the next
    // EOTB-IL: the sprite's one-shots are no longer started here - the
    // mod POLLS FPSWeapon.IsAttacking in its own LateUpdate (IL_3eee),
    // and the body reads the machine through the record above
    if (!fpArm.ready()) return;
    const m = playerWeapon.machine;
    // MW-D16: no `bow` flag. The arm derives "shoot" from its own
    // weapon CLASS, which is what the reference tests - and which also
    // catches MarksmanThrown, a type that shoots without being a bow.
    // MW-PACE1: and the blow's own clock - the machine just began this strike, so its schedule (when the hit lands,
    // when it is done, at this frame's dt) is the one the arm fits its wind-up, release and follow into.
    fpArm.attack(strike, { hold: m.isBow && m.state === 'StrikeUp', blow: playerWeapon.strikeSchedule(dt), hand: pairUp() ? playerWeapon.strike?.hand ?? null : null });   // TWO-HANDS: the hand the law gave the blow
  }

  /** SPELLFX1: one loose counted for the wire - the hosts' own (`noteShot`, below) and a technique's (TECH1). */
  const noteShotHere = (weapon) => { if (!orbArchiveFor(weapon)) shot.n = (shot.n + 1) & 0xffff; };
  /** TECH1: this rig's identity to the one technique runner (a door into another host's rig sets an aim aside), and the
   *  frame's context it was last stepped with (the loose's claim reads it at the frame's end). */
  const _techRig = {};
  let _techCtx = null;
  /** TECH-FX: the hands' dip this draw - the arm's (screen heights, through its transform) and the classic lane's (UI
   *  pixels, through the renderer's offset): drawInner sets them for the draw it wraps. */
  let _armDip = 0, _dipPx = 0;
  /** AUDIT TECH-FX: the technique's frame context and its camera, filled in place each frame (a fresh pair and a fresh
   *  startSwing closure were half a kilobyte a frame, for every player, whatever was in hand); the swing's dt rides here. */
  let _techDt = 0;
  const _techCam = { pos: null, yaw: 0, pitch: 0, feet: null };

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
      // FIELD-GUN13 (2026-09-19, Mac: "The sound for holstering is a
      // sword") - AND IT WAS, ALL THE WAY DOWN THE LADDER.
      //
      // `equipSoundFor` is GetEquipSound (:839-867), a switch over
      // DFU's nineteen weapon templates, and its default arm is
      // SoundClips.None - which is the CORRECT answer for a weapon
      // Daggerfall does not have. So this weapon fell through to the
      // `?? SOUND.DrawWeapon` beside it, and that fallback is DFU's
      // own declared default (FPSWeapon.DrawWeaponSound = 78, the one
      // SetWeapon :780 overwrites whenever GetEquipSound answers) -
      // which is a BLADE LEAVING A SCABBARD. A gun has no scabbard.
      //
      // THE DEPARTURE IS NAMED HERE, AHEAD OF THE VERBATIM CALL,
      // rather than inside `equipSoundFor`: that function's domain is
      // SoundClips, this weapon's clip is a registered STRING key
      // through the mod-sound door (MW-D40), and widening a 1:1 port's
      // return type to carry one departure is how a table stops being
      // a table. The clip is the lock-up clack the reload already
      // closes on - a breech coming home is what this weapon does
      // instead of a scabbard, going out and coming back alike.
      if (thunderlockHeld()) {
        if (!_tlSounds) { _tlSounds = true; installGunSounds(); }
        audio.playOneShot(heldSfx().close, heldFeel().sfxVolume * 0.95, gunPitch(undefined, heldFeel()));
      } else {
        audio.playOneShot(equipSoundFor(playerWeapon.weapon) ?? SOUND.DrawWeapon);
      }
    }
  }

  // ── THE THUNDERLOCK'S VOICE (AUDIT-THUNDERLOCK F8) ────────────────
  let _tlState = 'Idle', _tlOpened = false, _tlClosed = false, _tlSounds = false;
  // FIELD-GUN6 (Mac, from play: "This isn't 1 to 1 with the
  // prototype"). It was not. The lab drove a recoil spring, a trauma
  // shake and a reload lower, and NONE of the three was ever carried
  // across - the sprite arrived, the sounds arrived, and the weapon
  // sat dead still while it fired. The spring is the lab's own
  // machine, from the one home both read (combat/gun/gunFeel.js), on Mac's
  // own numbers; the shake is the room's (betterAmbience, below).
  const _tlRecoil = createRecoil();
  /** FIELD-GUN12: the prototype's own module state, carried between
   *  frames exactly as the lab's page carries it. */
  const _tlRig = createGunRig();
  let _tlKick = { x: 0, y: 0 };
  /** FIELD-GUN17: the last frame this weapon was drawn at, for the
   *  muzzle. Null until it has been drawn once, which is also the
   *  honest answer for "where is the barrel" before there is one. */
  let _tlDrawn = null;
  /** The close lands this long before the weapon is ready, so the
   *  lock-up is finishing as the sprite comes back up rather than
   *  after it.
   *
   *  It is the LAB's own lead - `gun.cooledMs >= state.cool - 420` in
   *  gun-proto.html's frame - and FIELD-GUN15 corrected what this
   *  comment used to claim, which was "the clip's own length". It
   *  never was: the clip it was written for (`close-ready`) is 98ms.
   *  The number is a judgement about where in the pump the mechanism
   *  should sound, and it is the prototype's, which is the only reason
   *  it is this number and not another. */
  const TL_CLOSE_LEAD = RELOAD_CLOSE_LEAD;   // AUDIT PISTOLET B6: the one number (gunFeel.js), the pistols' too
  /** PISTOL-PORT: what a Pistolet's flash rises toward - white, so the strip's painted flame keeps its own colours. */
  const PAINTED_FLASH = Object.freeze([1, 1, 1]);
  // AUDIT FIELD-GUN-MW F1 (2026-09-21): the flash's own clock under the arm - seconds since the arm's release,
  // -1 while dark. The classic lane reads the glow curve off the machine's frame, which counts from the CLICK;
  // under the arm the shot is the arm's release key, so the curve counts from that instead, on the same tick.
  let _tlFlashClock = -1;
  // MW-GUN-FEEL: the machine's clock at the last shot, -1 when no shot's reload is owed. The reload - its clacks and the
  // arm's pump - runs from the SHOT to the weapon's ready: under the arm the shot is the arm's release, which can come
  // after the machine's cooldown has begun (its seven frames end 0.5s after the click; a crossbow's wind-up is longer).
  let _tlShotAt = -1;
  /** MW-GUN-FEEL: when the breech opens after its shot - the machine's own frames after its hit (the smoke clearing,
   *  THUNDERLOCK_NUM_FRAMES on GUN_FEEL's tick), which is exactly when the classic lane's cooldown begins. Under the arm
   *  the cooldown began before the shot, so the open - and the arm's pump with it - waits for this instead. */
  const tlReloadFrom = (m) => _tlShotAt + Math.max(0, ((m.frames?.StrikeDown ?? THUNDERLOCK_NUM_FRAMES.StrikeDown) - (m.hitFrame ?? 1)) * (m.tick ?? GUN_TICK_SECONDS));
  const flashFromClock = (dt) => {
    if (_tlFlashClock < 0) return 0;
    const frame = Math.floor(_tlFlashClock / (playerWeapon.machine.tick ?? GUN_TICK_SECONDS));   // PISTOLET: the held gun's own tick
    const g = muzzleGlow(true, frame, pistolsUp() ? MUZZLE_CURVE : THUNDERLOCK_MUZZLE_CURVE);   // THUNDERLOCK-ART2: each gun's own curve
    _tlFlashClock += dt;
    if (frame > 0 && g === 0) _tlFlashClock = -1;   // past the curve's end (it opens dark on frame 0): dark until the next shot
    return g;
  };
  /** The weapon's own voice, and the flash it throws. `armShoots` is MW-D42's condition - the Morrowind arm is the
   *  thing on screen and the machine is a shooter - and `fired` is the frame its release let the held hit go. */
  function thunderlockVoice(dt, { armShoots = false, fired = false } = {}) {
    if (!gunUp()) {   // PISTOLET: any gun
      _tlState = 'Idle'; _tlOpened = false; _tlClosed = false; _tlFlashClock = -1; _tlShotAt = -1;
      if (entity) entity._thunderlockFlash = 0;   // FIELD-GUN13: put the lamp out with the weapon
      fpArm.setGunFeel(null);   // MW-GUN-FEEL: and the arm's kick and pump with it
      return;
    }
    if (!_tlSounds) { _tlSounds = true; installGunSounds(); }
    const m = playerWeapon.machine;
    const feel = heldFeel(), sfx = heldSfx();   // PISTOLET: the gun in hand's own row and clips
    // PISTOL-PORT: A PISTOLET'S VOICE IS THE PAGE'S - each pistol's own shot (its machine's count), its spring punched, the
    // clip, the room's kick and the flash; each pistol's reload, its two clacks; the room lit by the brightest drawn
    // pistol, from the side the last shot was drawn on. Under the Morrowind arm the voice rides the arm's release, as
    // below. The Thunderlock's own path follows.
    if (pistolsUp()) {
      const p = playerWeapon.pistols, shot = pistols.fired(p, feel);
      for (const _h of armShoots ? (fired ? [playerWeapon.strike?.hand ?? 'R'] : []) : shot) {
        audio.playOneShot(sfx.fire, feel.sfxVolume, gunPitch(undefined, feel));
        betterAmbience.weaponKick?.(feel.roomShake);
        _tlFlashClock = 0; _tlShotAt = m.now;
      }
      if (entity) {
        entity._thunderlockFlash = playerWeapon.sheathed ? 0 : (armShoots ? flashFromClock(dt) : pistols.glow(p));
        entity._thunderlockFlashSide = pistols.flipOf(p, pistols.brightest(p), handedFlip()) ? -1 : 1; entity._thunderlockFlashRange = feel.flashRange;
      }
      // AUDIT PISTOL-PORT: under the arm a shot's bang waits for the arm's release (MW-D42) - its breech never opens before
      // it (MW-GUN-FEEL's law for the Thunderlock): the clacks wait while a hit is held, and come when they are due
      if (!_heldHit) pistols.voice(p, feel, (k, gain) => audio.playOneShot(sfx[k], feel.sfxVolume * gain, gunPitch(undefined, feel)));
      _tlState = m.state;
      return;
    }
    // AUDIT FIELD-GUN-MW F1: THE TRIGGER IS THE ARM'S RELEASE, UNDER THE ARM. MW-D42 held the bow's hit for rule
    // 24's "shoot release" and MW-D42d held its sound with it; the gun's hit now rides the same hold, but its VOICE
    // fired here on the machine leaving Idle - the click - so under the borrowed crossbow animation the bang, the
    // kick and the flash came at the click and the orb left at the release, half a second apart: MW-D42d's own
    // defect one weapon along. The classic lane keeps the click, because its sprite IS the machine's frames.
    const trigger = armShoots ? fired : (m.state !== 'Idle' && _tlState === 'Idle');
    // the shot, on the trigger's own edge - and the kick and the
    // shake ride the SAME edge, which is what makes them read as one
    // event rather than three things that happened near each other.
    if (trigger) {
      // FIELD-GUN8: the lab's own volume and pitch jitter. The game
      // played all three clips at full gain with no variance, and a
      // gun fired six times in four seconds is exactly where an ear
      // hears a sample repeating.
      audio.playOneShot(sfx.fire, feel.sfxVolume, gunPitch(undefined, feel));
      _tlRecoil.kick = feel.kick; _tlRecoil.back = feel.back; _tlRecoil.punch();
      // THE SHAKE MOVES THE ROOM, NOT THE WEAPON, because the camera
      // carries the weapon - the lab's own finding, in its probe's
      // words. The port has exactly one camera shaker (Better
      // Ambience's, CameraShaker.cs), already wired through all four
      // hosts by `betterAmbience.view`, so the gun borrows it rather
      // than threading a second one through four scenes. AUDIT 68
      // S09-tl-dead-state: it is the ONLY shake - the weapon's own
      // movement is the recoil spring above.
      betterAmbience.weaponKick?.(feel.roomShake);
      _tlFlashClock = 0;
      _tlShotAt = m.now;   // MW-GUN-FEEL: the reload is owed from here
    }
    // FIELD-GUN13: THE FRAME'S GLOW, PARKED WHERE THE HOSTS CAN READ
    // IT - the torch's own arrangement (systems/playerTorch.js parks
    // `st.range` on the entity and `playerTorchLight` reads it after
    // the tick), so that all six host light arrays answer the same
    // frame's shot without any of them re-running the curve. It is
    // parked HERE, above the frame's mod gate, because a player with
    // every mod off still fires a gun. A sheathed weapon does not
    // flash - the machine cannot leave Idle while it is away, but the
    // read says so rather than relying on that.
    if (entity) entity._thunderlockFlash = playerWeapon.sheathed ? 0 : (armShoots ? flashFromClock(dt) : muzzleGlow(m.state !== 'Idle', m.frame, THUNDERLOCK_MUZZLE_CURVE));
    // PISTOLET: and which side of the body it flashes on (systems/thunderlock.js thunderlockMuzzleLight reads it)
    // AUDIT PISTOLET A9 B1 D14: the light thrown from the side the gun is DRAWN on - the Handedness setting's
    if (entity) { entity._thunderlockFlashSide = handedFlip() ? -1 : 1; entity._thunderlockFlashRange = feel.flashRange; }
    _tlState = m.state;
    // the reload, on the cooldown the shot left behind
    const cooling = m.now < m.cooldownUntil;
    if (!cooling) {
      if (_tlOpened) _tlShotAt = -1;   // MW-GUN-FEEL: that shot's reload is done
      _tlOpened = false; _tlClosed = false; return;
    }
    // MW-GUN-FEEL: THE PUMP FOLLOWS ITS SHOT. AUDIT FIELD-GUN-MW recorded it and left it: under the arm the cooldown
    // begins at the machine's last frame, before a crossbow's release - so the breech was heard opening before the bang.
    // The open waits for its shot's smoke now (tlReloadFrom); the classic lane, whose cooldown begins exactly there,
    // hears exactly what it did.
    if (_tlShotAt < 0 || m.now < tlReloadFrom(m) - 1e-9) return;
    if (!_tlOpened) { _tlOpened = true; audio.playOneShot(sfx.open, feel.sfxVolume * 0.9, gunPitch(undefined, feel)); }
    if (!_tlClosed && m.now >= m.cooldownUntil - TL_CLOSE_LEAD) { _tlClosed = true; audio.playOneShot(sfx.close, feel.sfxVolume * 0.95, gunPitch(undefined, feel)); }
  }

  /** FIELD-GUN12: the prototype's frame, drawn. `gunFrameRect` IS
   *  gun-proto.html's draw block, so what reaches the screen here and
   *  what reaches the lab's canvas are one function's answer rather
   *  than two that have been argued into agreement. */
  function drawThunderlock(art, canvas, tint, hand = pistolsUp() ? playerWeapon.pistols.lead : null) {
    const m = playerWeapon.machine;
    // PISTOL-PORT: `hand` draws one Pistolet - alone (its pistols' lead, the default), or a hand of a pair - from its own
    // state on the page's frame (combat/gun/pistolLane.js): its own machine's picture, its own rig, spring and guard, the
    // left in the mirror. With no Pistolet up, the Thunderlock, exactly as it was.
    const ph = hand ? pistols.hands[hand] : null;
    const shot = ph ? { record: ph.firing ? 1 : 0, frame: ph.frame } : { record: m.state === 'Idle' ? 0 : 1, frame: m.frame };
    const rec = art.records[shot.record];
    if (!rec) return;
    const tex = rec.frames[Math.min(Math.max(0, shot.frame), rec.frames.length - 1)];
    if (!tex) return;
    const flip = hand ? pistols.flipOf(playerWeapon.pistols, hand, handedFlip()) : handedFlip();
    const { rect } = hand ? pistols.rect(playerWeapon.pistols, hand, art, canvas, handedFlip()) : gunFrameRect({   // PISTOL-PORT: the page's own rect
      canvasW: canvas.width, canvasH: canvas.height,
      anchor: art.anchor, union: art.unionBox, rig: _tlRig, kick: _tlKick, flip,
      ...(art.pose ? { widthPct: art.pose.widthPct, raise: art.pose.raise, offset: art.pose.offset ?? 0 } : {}),
    });
    // FIELD-GUN17: the frame the muzzle is measured against, kept as
    // it is DRAWN - with the bob, the sway and the kick already in it.
    // A shot leaves the barrel where the barrel IS on that frame, and
    // the frame a gun fires on is the one the recoil has just moved.
    // FIELD-GUN19: ...and the STRIP THE WORLD WAS DRAWN INTO on this
    // frame, because the muzzle is a canvas pixel and the shot is a
    // world object. `worldViewportRect` outlives endWorldPass for
    // exactly this reader; null is the full canvas, which is what
    // every host without a docked large HUD hands back.
    // RETRO-UI: drawn on the UI canvas, measured on the real one - the muzzle is a canvas pixel the world ray reads
    const [rx, ry] = fromUiPoint(canvas, rect.x, rect.y), real = canvas.canvas ?? canvas;
    const drawn = { rect: { ...rect, x: rx, y: ry }, canvasW: real.width, canvasH: real.height, muzzle: art.muzzle ?? null, flip, viewport: renderer.worldViewportRect ?? null, aspect: renderer.worldProjAspect ?? null };   // RETRO1: and the lens's aspect
    if (_dipPx) drawn.rect.y += _dipPx;
    if (ph) ph.drawn = drawn; else _tlDrawn = drawn;   // PISTOLET: each pistol keeps its own muzzle record   // TECH-FX: where a technique's dip drew it (drawInner) - the UI layer's pixels are the canvas's (ui/uiScreen.js uiCanvas offsets, never scales)
    // FIELD-GUN13 (Mac: "The muzzle flash itself shouldn't be affected
    // by the darkening lighting").
    //
    // IT WAS, AND THE REASON IS THAT THE FLASH IS THE SAME TEXTURE AS
    // THE GUN. `fpTint` is MAC-I's flat light - the room's answer at
    // the camera - and it multiplies the whole quad, so a dungeon at
    // 0.15 drew a muzzle flash at 0.15, which is a grey smudge. There
    // is no second draw call to exempt: one quad carries the barrel
    // and the fire coming out of it.
    //
    // So the TINT rises on the curve instead, toward white rather than
    // by a multiplier. `gun-proto.html` multiplies (`state.room * (1 +
    // muzzleLight(...) * state.light * 1.9)`) and at its own room
    // level that saturates - the lab's flash frame IS drawn white -
    // but a multiply in a black room stays black, and that is the ask
    // dropped. A lerp keeps the lab's answer where the lab was and
    // gives the same answer everywhere else.
    //
    // AND IT IS PHYSICALLY THE RIGHT SHAPE ANYWAY: the thing lighting
    // the gun on those two frames is the gun. The barrel, the hand and
    // the flash all brighten together and fall away over the smoke,
    // which is one lamp switching on, not a sprite being special-cased.
    // FIELD-GUN17 (Mac: "can we can the color of the muzzle flash and
    // the light emitted to the same color as the orb?"). IT LERPED TO
    // WHITE, which is the right SHAPE and the wrong colour: a shock
    // orb leaves the barrel and the flash that threw it was a different
    // hue from the thing it threw. The target is the ORB'S OWN colour
    // now, sampled off its archive the first time one flies
    // (characters/thunderlockIds.js), so the two cannot disagree and
    // nobody typed a number. White until it has been seen, which is
    // exactly what this line was before.
    const glow = muzzleGlow(shot.record === 1, shot.frame, hand ? MUZZLE_CURVE : THUNDERLOCK_MUZZLE_CURVE);   // PISTOLET: a pair's resting pistol does not flash; THUNDERLOCK-ART2: each gun's own curve
    // PISTOL-PORT: a Pistolet's flash is drawn AS PAINTED, as the page draws it - the light rises toward white, which leaves
    // the strip's own flame its own colours. The orb's colour is the Thunderlock's sprite's (FIELD-GUN17, the owner's ask
    // for it). AUDIT PISTOL-PORT D3: the SPRITE's alone - the light a Pistolet throws on the room still takes the orb's
    // colour (systems/thunderlock.js thunderlockMuzzleLight, the Pellet's), the owner's call (Audit-Pistol-Port.md).
    const flash = ph ? PAINTED_FLASH : orbColour();
    const lit = (tint && glow > 0)
      ? tint.map((v, i) => v + (flash[i] - v) * Math.min(1, glow * heldFeel().flashLight * heldFeel().flashGain))
      : tint;
    // PISTOLET: THE PICTURE IN THE MIRROR, not only its place. gunFrameRect mirrors the rect (AlignRight to AlignLeft) and
    // the anchor inside the union, and the lab mirrors the whole sprite under the same switch (gun-proto.html,
    // pistol-proto.html: ctx.scale(-1, 1)) - but this drew the texture unflipped, so a left-handed player's Thunderlock sat
    // on the left as a RIGHT hand, its forearm cut mid-screen, and a pair's left pistol did the same. The source rect read
    // right to left, the melee pair's own door (handsLaw.js MIRROR_UV, FPSWeapon.cs:381-390).
    const uv = flip ? MIRROR_UV : undefined;
    renderer.drawScreenQuad(tex, rect, uv, lit ?? undefined);
    const elementGlow = hand ? glowOf(playerWeapon.handItem(hand)) : heldGlowNow();   // WEAPON-GLOW1: the element's outline over the frame, the held weapon's own (PISTOLET: each pistol's)
    if (elementGlow) renderer.drawScreenQuadGlow?.(tex, rect, uv, elementGlow, { art: art.native ? [art.native.w, art.native.h] : [art.unionBox.w, art.unionBox.h], view: [canvas.width, canvas.height] });   // the frame is the union box, in native pixels (AUDIT PISTOLET B4: the Pistolet's union is in design pixels, its texture native)
  }

  /**
   * FIELD-GUN13 (Mac: "The weapon should come up from the bottom
   * screen into frame when unholstering, not pop in").
   *
   * IT POPPED BECAUSE `shown()` IS A BOOLEAN AND A SLIDE IS NOT. The
   * draw ladder's `if (!shown()) return;` is FPSWeapon's own
   * ShowWeapon - DFU's sprite has no draw animation, it is simply
   * there or not - and the mod that DOES have one, Weapon Widget's
   * Offset module, was being handed `shown: !reloading` by the gun's
   * own step. So the module ran the reload dip beautifully and never
   * saw the sheathe at all, and the holster it could have eased was
   * decided one gate above it.
   *
   * This is the gun saying "not yet" to that gate: TRUE while the
   * module still has any part of the weapon on screen. The easing
   * itself is not new code - it is the same `offsetStep` the dip uses,
   * on `sheathTarget` instead of `hiddenTarget`.
   */
  function thunderlockSliding() {
    if (!playerWeapon.sheathed) return false;
    if (!gunWidgetSettings().offset) return false;   // AUDIT 68 S09-gun-sliding-offset-off: no Offset module, no slide - offsetCurrent never moves, so the gun pops as weaponWidget.draw's does
    if (pistolsUp()) return pistols.sliding(playerWeapon.pistols, heldFeel());   // PISTOL-PORT: any drawn pistol still on its way out
    return Math.abs(_tlRig.offsetCurrent[1]) < Math.abs(heldFeel().sheathTarget[1]) - 1e-3;
  }

  /** FIELD-GUN6: the frame's recoil kick, stepped once and read by
   *  drawThunderlock; nothing for every weapon that is not this one.
   *
   *  THE RELOAD LOWER is the other half. There is no reload ANIMATION
   *  to play - the art is seven fire frames and an idle - so the weapon
   *  drops out of frame while the pump runs and rides back up as it
   *  finishes, which reads as a reload because that is what a reload
   *  looks like from behind the gun. It eases rather than steps, on
   *  the cooldown's own clock, so it is finishing exactly as the
   *  weapon becomes ready. */
  function thunderlockFeel(dt, frame = null) {
    if (!gunUp()) return;   // PISTOLET: any gun
    const feel = heldFeel();   // PISTOLET: the held gun's own spring, dip and widget tuning
    // PISTOL-PORT: A PISTOLET - one or a pair - steps on the page's own frame (combat/gun/pistolLane.js): each hand's spring,
    // guard, picture and rig, on its own machine; the Morrowind arm takes the last-fired hand's kick, and one pistol's
    // reload its pump
    if (pistolsUp()) {
      const p = playerWeapon.pistols;
      pistols.step(dt, p, {
        feel, switches: readWidgetSettings(), frame, leftHanded: handedFlip(), sheathed: !!playerWeapon.sheathed,
        liveSpeed: entity ? liveStat(entity, 'speed') : 50, cursorActive: cursorActive(),
        lowered: (h) => (playerWeapon.mixedPair && playerWeapon.strikeInFlight?.hand === otherHand(h)) || (_spellHand && fpsSpellCasting.isPlayingAnim),   // MIXED-PAIR: the gun lowers under its blade's blow; SPELL-HAND: and under the free hand's cast
      });
      const h = p.hands().includes(p.last) ? p.last : p.lead, g = p[h];   // AUDIT PISTOL-PORT D12: a pistol still held - a pair broken leaves `last` in the pack
      const share = !playerWeapon.gunPair && !playerWeapon.mixedPair && g.state === 'Cooling' ? g.cooledMs / g.cooldownMs : null;   // MIXED-PAIR: a pair's gun pumps nothing over the whole viewmodel - its blade swings through the reload
      fpArm.setGunFeel(playerWeapon.sheathed ? null : armGunPose(-pistols.hands[h].kick.y, share));
      return;
    }
    _tlRecoil.stiff = feel.stiff; _tlRecoil.damp = feel.damp; _tlRecoil.back = feel.back;
    _tlKick = _tlRecoil.step(dt);
    // FIELD-GUN12: THE RELOAD LOWER IS THE MOD'S OFFSET MODULE, driven
    // the way the lab drives it - `shown: false` while the pump runs -
    // rather than a second easing curve of my own next to it. The lab
    // has always done it this way; the game had a hand-rolled
    // smoothstep that was a different shape from the module's.
    const m = playerWeapon.machine;
    const reloading = m.now < m.cooldownUntil;
    // FIELD-GUN13: AND THE SHEATHE IS THE MODULE'S TOO. The dip and
    // the holster are one easing at two distances - `hiddenTarget`
    // parks the weapon low enough to still read while the pump runs,
    // `sheathTarget` takes it off the bottom edge entirely - so the
    // draw is the same curve run backwards, for free. The holster wins
    // when both are true: a shot fired on the same frame the weapon is
    // put away leaves, it does not dip.
    const sheathed = !!playerWeapon.sheathed;
    // MW-GUN-FEEL (combat/gun/gunFeel.js): the Morrowind arm takes the SAME spring - stepped above, once - and the reload's
    // share of its clock, from the breech's open (tlReloadFrom) to the ready, as one pose over its viewmodel - the
    // classic lane's dip runs on the same span. Sheathed, it takes none.
    const from = _tlShotAt >= 0 ? tlReloadFrom(m) : Infinity;
    const share = reloading && m.now >= from && m.cooldownUntil > from ? (m.now - from) / (m.cooldownUntil - from) : null;
    fpArm.setGunFeel(sheathed ? null : armGunPose(-_tlKick.y, share));
    gunRigStep(_tlRig, gunWidgetSettings(null, feel.widget), dt, {
      screenRect: { width: frame?.width ?? 320, height: frame?.height ?? 200 },
      motion: frame?.motion ?? gunMotion({}),
      look: frame?.look ?? [0, 0],
      flip: handedFlip(),
      idle: m.state === 'Idle',
      shown: !reloading && !sheathed,
      hiddenTarget: sheathed ? feel.sheathTarget : feel.hiddenTarget,
      liveSpeed: entity ? liveStat(entity, 'speed') : 50,
      cursorActive: cursorActive(),
      swingHeld: _held,
    });
  }

  /** FPSWeapon.UpdateWeapon's bow guard: an UNsheathed bow with zero
   *  Arrows auto-sheathes with the classic line.
   *
   *  AUDIT-THUNDERLOCK F5: EVERY RANGED WEAPON, and the line names
   *  what it is out of. This gated on WeaponTypes.Bow, so the port's
   *  own weapon at zero pellets never sheathed and fired in silence -
   *  a trigger that does nothing and says nothing, which is the worst
   *  of both. The classic weapon's classic line is untouched. */
  let _dryGunSaid = false;   // AUDIT MIXED-PAIR L4-8: a dry mixed pair's gun, said once
  function bowArrowGuard() {
    if (playerWeapon.sheathed) return;
    if (playerWeapon.mixedPair) {   // MIXED-PAIR: a pair's blade still fights - its gun's pull falls to it (gunReady)
      // AUDIT MIXED-PAIR L4-8: and the gun's want is SAID, once as it runs dry (or is drawn dry), as a lone gun's is -
      // FPSWeapon's own line - with nothing put away: a gun that never fires and never says why is a gun that is broken
      const dry = !hasAmmoFor(entity.items, playerWeapon.handItem(playerWeapon.gunHand));
      if (dry && !_dryGunSaid) setMidScreenText(t('combat.noPellets', 'You have no pellets.'));
      _dryGunSaid = dry;
      return;
    }
    _dryGunSaid = false;
    const weapon = playerWeapon.weapon;
    const type = weaponTypeForItem(weapon);
    const ranged = type === WEAPON_TYPES.Bow || isGunType(type);   // PISTOLET: either gun
    if (!ranged) return;
    if (hasAmmoFor(entity.items, weapon)) return;
    playerWeapon.sheathed = true;
    // AUDIT 64 F34: FPSWeapon.cs:365 is SetMidScreenText, not the popup
    // queue - and `say` here is shared with the shield refusal below,
    // which really is a PopupMessage, so this line takes the label
    // directly rather than re-pointing the sink.
    setMidScreenText(type === WEAPON_TYPES.Bow ? localizedText('youHaveNoArrows', 'You have no arrows.') : 'You have no pellets.');
  }

  /**
   * BOW-CLOCK (FIELD BUGS 2026-10-09g, "Archery is weird ... and double shot bug"): ONE CLICK, ONE DRAW, ONE ARROW.
   * Under the Morrowind arm a shot's hit waits for the arm's release key (MW-D42), but the machine's cycle - the instant
   * shot's four ticks and a Speed-driven cooldown, ~1.2s at Speed 90 - can end while the arm is still drawing the last
   * one. The next click then started a shot the arm refused to draw (attack() takes only an idle or following-through
   * arm): its arrow rode the LAST draw's release, or the ceiling, so two arrows left one draw and the next draws loosed
   * nothing. No ranged shot STARTS while the arm cannot draw it - the drag's door and the touch button's alike. Only
   * the start waits: a drawn bow's release (StrikeUp -> StrikeDown) is not from Idle and is never held here.
   */
  function armCannotDraw() {
    const m = playerWeapon.machine;
    // AUDIT PISTOL-PORT A1: a Pistolet's shot starts with a pistol mid-shot too (its pair's second, on its own machine) -
    // so under the arm it waits for the arm as any other's does; the arm draws one shot, and holds one hit (MW-D42)
    // MIXED-PAIR: and a blade-and-gun pair's hands take turns on the arm - neither hand's strike starts while it still
    // draws, winds up or looses the last (the blade's blow as much as the gun's shot)
    if (playerWeapon.mixedPair && (fpArm.active() || fpArm.thirdActive()) && fpArm.shotBusy()) return true;
    return !!m.ranged && (m.state === 'Idle' || !!playerWeapon.pistols) && (fpArm.active() || fpArm.thirdActive()) && fpArm.shotBusy();
  }
  /** AUDIT PISTOL-PORT A5: no Pistolet pull without a Pellet for it - each Pellet the pack holds may already be owed to a
   *  pistol whose hit is still to land (a pair's second shot leaves inside its first, which one machine never allowed: the
   *  last Pellet fired twice, the second shot a bang and nothing). The pack's own guard (bowArrowGuard) still sheathes. */
  function pelletsOwed() {
    if (!entity || !playerWeapon.pistols) return false;
    const gun = playerWeapon.gunHand ? playerWeapon.handItem(playerWeapon.gunHand) : playerWeapon.weapon;   // MIXED-PAIR: the pair's gun, whichever hand strikes
    return ammoCountFor(entity.items, gun) <= playerWeapon.pistolShotsDue() + (_heldHit ? 1 : 0);
  }
  /** MW-D42's hold, as the function the frame decides first (it used to be the frame's own tail). AUDIT
   *  FIELD-GUN-MW F1 (2026-09-21): the gate is `machine.ranged`, not `isBow` - the Thunderlock is a shooter the arm
   *  animates as a crossbow, and its hit rode straight through the bow-only gate: the orb left at the machine's
   *  frame 1 (70 ms after the click at GUN_FEEL.fps 14) while the arm was still winding up to its release key -
   *  the exact defect MW-D42 paid for the bow, one weapon along. Answers the events to hand the host and whether a
   *  held hit went THIS frame, which is what the weapon's voice fires on under the arm. */
  function holdShotForArm(evs, dt, armShoots) {
    if (!armShoots) {
        // The classic sprite path is untouched, and so is every melee
        // weapon on every path.
        // AUDIT 68 S09-held-hit-dropped: a shot already held when the arm
        // stops driving (unloaded, a view with no body) is FLUSHED, as
        // NEVER-TRAPS below says - unless the hand no longer holds a
        // shooter, whose hit the hosts would resolve as a melee blow.
        if (_heldHit && playerWeapon.machine.ranged) {
          const out = [...evs];
          if (_heldSound) out.push('bowSound');
          out.push('hit');
          _heldHit = false; _heldSound = false;
          return { evs: out, fired: true };
        }
        _heldHit = false;
        _heldSound = false;
        return { evs, fired: false };
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
        if (fpArm.takeShootRelease() || (_heldHitAge >= HELD_HIT_MAX_S && !fpArm.shotBusy()) || _heldHitAge >= HELD_HIT_CAP_S) {
          _heldHit = false;
          // SOUND FIRST, then the hit - the machine's own order across
          // frames 4 and 5, preserved rather than reinvented.
          if (_heldSound) { _heldSound = false; out.push('bowSound'); }
          out.push('hit');
          return { evs: out, fired: true };
        }
      }
      return { evs: out, fired: false };
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
    /**
     * FIELD-GUN17 (Mac: "the orb doesnt allign with the barrel when
     * firing. Its above the barrel") - WHERE THE SHOT LEAVES, in the
     * camera's own axes, or null for every weapon that is not this one.
     *
     * The ranged lane looses from `playerArrowOrigin`, which is DFU's
     * GetAimPosition: 0.11 below the eye and 0.15 to the side, the nock
     * of a DRAWN BOW. This gun is drawn low and right with its barrel
     * lower still, so the orb came out well above it - FIELD-GUN14's
     * own sentence one field further along, the lane written for the
     * one ranged weapon Daggerfall has.
     *
     * THE ANSWER IS WHERE THE GUN IS DRAWN, not a number: the art
     * measures its own muzzle off the flash (combat/gun/gunFlash.js `flashBodyPoint`)
     * and this turns that point on the drawn rect into a direction in
     * camera space. So it follows the bob, the sway, the recoil, the
     * handedness mirror, the canvas and the player's own field of view
     * - a baked offset would be right at one aspect and one FOV and
     * wrong at every other.
     *
     * Proportional to `forward` on purpose: the offset IS the ray
     * through the muzzle's pixel, so the orb sits on the barrel at any
     * distance the caller picks, and `forward` only chooses how far
     * out it starts.
     */
    thunderlockMuzzle(fovRad, forward = MUZZLE_FORWARD) {
      if (!thunderlockHeld()) return null;
      // AUDIT FIELD-GUN-MW F2 (2026-09-21): THE MORROWIND ARM ANSWERS FOR ITSELF. `_tlDrawn` is the classic sprite's
      // record, written by drawThunderlock - which the arm's branch of the draw ladder returns BEFORE - so under the arm
      // it was null, or a stale rect from before the arm came up, and the orb left the eye rather than the barrel, in
      // first person and in third. The rig poses the weapon piece every frame and knows where it ends
      // (combat/rigMuzzle.js); the sprite's record stays the sprite's.
      if (fpArm.active() || fpArm.thirdActive()) return fpArm.weaponMuzzle(pairUp() ? playerWeapon.activeHand : 'R');   // AUDIT MIXED-PAIR L3-6: a pair's shot from the hand that fired it
      // PISTOL-PORT: a Pistolet's shot leaves the barrel of the pistol that fired it - a pair's striking hand, one pistol its lead
      if (pistolsUp()) return muzzleRay(pistols.hands[playerWeapon.gunPair ? playerWeapon.activeHand : playerWeapon.pistols.lead]?.drawn ?? null, fovRad, forward);
      return muzzleRay(_tlDrawn, fovRad, forward);
    },
    refreshWorn() { syncWorn(); },
    /** LH1: the hand door a swap needs - WeaponManager.UsingRightHand as it
     *  stands after this frame's UpdateHands (the shield rule applied), and
     *  ToggleHand through this rig's own SwitchHand leg. */
    handDoor() {
      syncWorn();
      return { usingRightHand: playerWeapon.usingRightHand, switchHand: () => this.switchHand() };
    },
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
      cast.n = (cast.n + 1) & 0xffff; cast.rangeType = rangeType | 0; cast.element = Number.isInteger(element) && element >= 0 && element <= 4 ? element : 4;   // MAC7 #2: the wire's cast, counted before either lane's own gate. EOTB-IL: the sprite's cast is polled off FPSSpellCasting.IsPlayingAnim (IL_3f57), not called from here
      // CAST-SPEED: ONE RATE FOR BOTH LANES, read once as the cast starts - the live Speed and the castSpeed loot line
      // (systems/castSpeed.js): the classic frames step at CAST_FRAME_PERIOD over it, the arm's spellcast group plays at it
      const rate = castRate(entity);
      const armCasts = fpArm.castSpell(rangeType, rate) && (fpArm.active() || fpArm.thirdActive());
      // MW-CAST1: the Morrowind hands on screen cast the spell - it leaves on their "<type> release", or when they stop
      // casting without one (fpsSpellCasting's hold, and its ceiling); the classic lane's frame 5 is untouched
      const oneHand = spellHandFits();   // AUDIT SPELL-HAND L2-4: the cast's hands, decided as it starts - and only by a cast that does
      const started = fpsSpellCasting.playOneShot(element, onRelease, armCasts ? { hold: () => fpArm.takeCastRelease() || !fpArm.castInFlight(), rate } : { rate });
      if (started) _castOneHand = oneHand;
      return started;
    },
    playerWeapon,
    swing,   // MAC7 #1: { n, strike } - the count and the kind of the last strike started, for the wire
    cast,    // MAC7 #2: { n, rangeType } - the count and the range of the last cast, for the wire
    shot,    // SPELLFX1: { n } - arrows loosed, for the wire
    /** SPELLFX1: every host's player loose calls this once, with the weapon it loosed from. */
    noteShot(weapon) { noteShotHere(weapon); },
    /** Host mouse events buffer here (sheathed = no attack processing).
     *  CH3 (characters-13): a running SWAP PAUSE blocks the attack
     *  the same way (WeaponManager.cs:276-278 returns before the
     *  swing while the used hand's countdown runs). */
    attackInput(dx, dy, held) {
      _held = held;   // AUDIT 68 S09-sheathed-swing: the latch mirrors the live button (HasAction) - a release while sheathed is still a release
      if (playerWeapon.sheathed || (entity?.equipCountdown ?? 0) > 0) return;
      _dx += dx; _dy += dy;
    },
    /** ClickToAttack - the probes' door (window.__attack, __combat). AUDIT SPELL-HAND L4-10: the touch layer's ATTACK button
     *  is not it - it reaches the swing through attackInput's latch (touch.js `hooks.attack`), the drag's door below. */
    clickAttack() {
      if (playerWeapon.sheathed || (entity?.equipCountdown ?? 0) > 0 || _climbing) return;   // CLIMB4: no swing with the hands on the wall
      if (armCannotDraw() || (pelletsOwed() && !playerWeapon.mixedPair)) return;   // BOW-CLOCK: nor a shot the Morrowind arm cannot draw yet; AUDIT PISTOL-PORT A5: nor one with no Pellet left for it (MIXED-PAIR: the pair's dry gun gives its pull to the blade - gunReady)
      if (castPlaying() || (_spellHand && castPending())) return;   // SPELL-HAND: nor a blow while a cast plays or one pressed waits - the hands take turns, as the latch's door (canAttack)
      if (techniqueFlying()) return;   // AUDIT TECH1: nor a touch swing while a technique's leap or dash is in the air - its strike is the landing's
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
     *             LIVE (handheldTorches.js:"x = snap(x, interval)"), so a flag flipped to
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
      if (m.state !== 'Idle' || _heldHit) return false;       // :268's `!isAttacking` (AUDIT 68 S09-held-hit-dropped: a shot held for the arm's release is one)
      // SPELL-HAND: with the hands able to hold the spell beside the weapon the spell is NOT aborted - Z draws or sheathes the
      // weapon and the spell stays readied (drawn: in the free hand; sheathed: DFU's two-handed stance); never mid-cast
      if (_spellHand && armCasting()) return false;   // SPELL-HAND: and never while the arm's hands finish the free hand's cast
      if ((spellArmed() || fpsSpellCasting.isPlayingAnim) && spellHandHands()) { if (fpsSpellCasting.isPlayingAnim) return false; }
      else if (spellArmed() || fpsSpellCasting.isPlayingAnim) {
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
      const m = playerWeapon.machine;
      if (m.isBow && m.now < m.cooldownUntil) return false;   // AUDIT 68 S09-held-hit-dropped: Update's cooldown return (:230-233) comes before ToggleHand, as readyWeapon has it
      if (m.state !== 'Idle' || _heldHit) return false;       // isAttacking - and a shot held for the arm's release is one
      if (castPlaying()) return false;   // AUDIT SPELL-HAND L2-4: DFU's Update returns before ToggleHand while IsPlayingAnim (a readied spell's leg is the port's departure - Two-Hands.md)
      syncWorn();
      // MW-HAND: under the Morrowind arm H moves only between two held weapons - never to an empty hand. TWO-HANDS: both
      // fists up are two hands too - H picks the one that leads
      if (bindWorn && fpArm.ready() && !(playerWeapon.currentRightHandWeapon && playerWeapon.currentLeftHandWeapon) && playerWeapon.handsMode !== HANDS_MODE.Fists) return false;
      // bindWorn:false rigs drive their own weapon (the dungeon's
      // scripted bow) - flip the hand, but do not let ApplyWeapon
      // overwrite a weapon no equip table ever supplied.
      const line = playerWeapon.toggleHand({ entity, apply: bindWorn });
      if (line === null) return false;   // :704-705, the shield refuses
      // TWO-HANDS (bible/05-Combat/Two-Hands.md): with both hands up both are in use, and H picks the LEAD - the hand an
      // exchange opens with, the pair's full blow - so it says so; one hand in use keeps DFU's two lines
      if (twoHanded(playerWeapon.handsMode)) say(line === USING_RIGHT_HAND_TEXT ? t('combat.leadRightHand', 'Leading with the right hand.') : t('combat.leadLeftHand', 'Leading with the left hand.'));
      else say(line === USING_RIGHT_HAND_TEXT ? localizedText('usingRightHand', 'Using weapon in right hand.') : localizedText('usingLeftHand', 'Using weapon in left hand.'));   // L10N3d: WeaponManager.cs:709/711, in the player's language
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
      bindGlobals();   // AUDIT 68 S09-rig-globals-last-built: and the pose probe, the shield hook, the popup
      syncWorn();   // AUDIT 17e F17: the rig owns the worn-weapon bind
      askHeld();   // WEAPON-GLOW1: the classic hand's element, once a frame
      // SPELL-HAND (combat/twoHands/spellHand.js): the spell in the free hand beside the weapon, read once a frame off the
      // hands just synced - and told to the cast's doors (scenes/hostMagic.js: the swing button is the weapon's, a cast
      // pressed mid-blow waits); its two guards eased on the same law as a pair's
      _spellHand = spellHandNow();
      tellSpellHand({ up: _spellHand, fits: spellHandFits(), busy: handsBusy() });
      _spellGuard.weapon = guardStep(_spellGuard.weapon, _spellHand && fpsSpellCasting.isPlayingAnim, dt);
      _spellGuard.hand = guardStep(_spellGuard.hand, _spellHand && playerWeapon.machine.state !== 'Idle', dt);
      // EOTB-IL: the mod's two keys are polled on their RELEASE edge
      // (GetKeyUp) - SwitchShoulder and AutoTogglePerspective's
      // ToggleInput, the registry's ShoulderSwitch and AutoPerspective. The drawn string's release is the body's own
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
      // strike the drag resolved to (playerWeapon.js:"not immune: :1057-1064's") and
      // clickAttack() with the one the click rolled - the Morrowind arm
      // needs exactly that to pick rule 11's attack type.
      // AUDIT 68 S09-sheathed-swing: and no attack STARTS where Update
      // returns first - a readied spell or its cast (:246-262), the equip
      // countdown (:276-281), the sheathe (:283-288). The input buffer's
      // refusal alone let a held button swing a hidden weapon.
      // CLIMB4 (the Enhanced Climbing arc - the feel): THE HANDS ARE ON THE WALL. WeaponManager.Update's "do nothing if
      // player paralyzed or is climbing" (:236-240) - ShowWeapons(false), no swing - read off the camera's climb (the
      // classic climb, a move in flight, a hold on the wall: the hosts' `climbing`). The picture EASES down and back up
      // rather than cutting (CLIMB_LOWER_TAU): the hands leave the hilt for the stone and come back to it.
      const camNow = camera?.() ?? null;
      const climbing = _climbing = !!camNow?.climbing;
      // AUDIT CLIMB-HANDS: THE WEAPON AND THE HANDS ARE NEVER ON THE SCREEN TOGETHER. The weapon stays down while a hand
      // shows (it comes back once they are off the screen) and the hands come up once it is half down
      // (CLIMB_HANDS_AFTER). The classic lane's alone: the Morrowind arms and the third-person body take the climb
      // themselves, so there the law is handed no climb and never holds the weapon down (AUDIT CLIMB-HANDS, second round:
      // the Morrowind body in third person too - `fpArm.active()` is first person's alone).
      const handsLane = !fpArm.active() && !fpArm.thirdActive() && !eotbHidesWeapon();
      _climbLower = climbLowerStep(_climbLower, climbing || (handsLane && climbHands.showing()), dt);
      // CLIMB-HANDS: the hold, the shimmy, the free climb, the moves and the look off the wall - CLIMB-HANDS II: seen
      // through the frame's own world lens (the setting's field of view on the strip the world was drawn into, the bar
      // the hands stand on), so the fists stay on the stone as the view turns; asked only while there are hands to lay out
      // SPELL-CLIMB (#bug-reports, "Spell+Climbing=4 arms"): A CAST TAKES THE HANDS OFF THE STONE. DFU casts on its climb
      // (EntityEffectManager.Update reads no climb) and its cast's hands play on the climb's empty screen; here the wall
      // holds two fists, so while the cast's hands play the law is handed no climb - they are not drawn under the cast
      // (drawLayer) and come back up onto the stone after it, eased, not popped back whole
      const castTakesHands = fpsSpellCasting.isPlayingAnim && !eotbHidesSpellHands();
      const handsClimb = handsLane && _climbLower >= CLIMB_HANDS_AFTER && !castTakesHands ? (camNow?.climb ?? null) : null;
      const handsLens = handsClimb || climbHands.law.present > 0 ? climbLens(cv(), { fov: fieldOfView(), viewport: renderer?.worldViewportRect ?? null, aspect: renderer?.worldProjAspect ?? null, offsetHeight: weaponOffsetHeight() }) : null;
      climbHands.update(dt, handsClimb, { yaw: camNow?.yaw, pitch: camNow?.pitch, lens: handsLens });
      const canAttack = !playerWeapon.sheathed && (entity?.equipCountdown ?? 0) <= 0 && (!spellArmed() || _spellHand) && !armCasting() && !(_spellHand && castPending()) && !fpsSpellCasting.isPlayingAnim && !climbing && !actTool() && (!pelletsOwed() || playerWeapon.mixedPair);   // AUDIT 29 D2: no swing behind a gathering act's tool; AUDIT PISTOL-PORT A5: nor a shot with no Pellet left for it (MIXED-PAIR: the pair's gun refuses its own pull - gunReady - and its blade takes it)
      // BOW-CLOCK: no shot starts the arm cannot draw (armLoosing, above) - gesture() is not asked, so its button
      // latch keeps the press made while waiting.
      const armLoosing = armCannotDraw();
      // TECH1 (bible/05-Combat/Weapon-Techniques.md): THE TECHNIQUE KEY, stepped by the rig that owns the frame - every
      // host's - AHEAD of the gesture: a technique's strike and a click's are one machine, and the first to start it holds
      // it. Its gate is the swing's own (drawn, no spell, no cast, no climb, no equip pause, no act's tool, no arm still
      // loosing) and the camera this rig rides.
      _techDt = dt;
      _techCtx ??= {
        rig: _techRig, entity, pw: playerWeapon, cam: null, collider: null, held: false, ready: false, cancel: false, paralyzed: false, blocked: false, holding: false,
        startSwing: (s) => { if (!playerWeapon.techniqueStrike(s)) return false; fpAttack(s, _techDt); return true; },
        door: technique, say, noteShot: noteShotHere,
      };
      const tc = _techCtx;
      if (camNow?.pos && camNow?.feet) { _techCam.pos = camNow.pos; _techCam.yaw = camNow.yaw ?? 0; _techCam.pitch = camNow.pitch ?? 0; _techCam.feet = camNow.feet; tc.cam = _techCam; } else tc.cam = null;
      tc.collider = collider?.() ?? null;
      tc.held = !!actionDown?.(TECHNIQUE_ACTION);
      tc.ready = !paralyzed && !!c && canAttack && !armLoosing && !_heldHit && !!camNow?.pos && !!camNow?.feet;   // AUDIT TECH1: and no plain shot's hit still held for the arm (MW-D42) - the click path's own gate
      tc.cancel = !!activateHeld();
      tc.paralyzed = !!paralyzed;   // AUDIT TECH1: a held body's machine is frozen - and so is its technique's clock
      tc.blocked = !!technique?.blocked?.();   // AUDIT TECH1: a window holds the world (the host's gamePaused) - and the key
      tc.holding = !!_heldHit;   // MW-D42: a shot's hit held for the Morrowind arm's release - the loose is still to come
      stepTechnique(dt, _techCtx);
      // AUDIT TECH1: no gesture while a technique's leap or dash is in the air - its strike is the landing's
      const strike = !paralyzed && c && canAttack && !armLoosing && !techniqueFlying()
        ? playerWeapon.gesture(_dx, _dy, _held, dt, Math.max(c.clientWidth, c.clientHeight), { cancelHeld: activateHeld() })   // AUDIT 28 W12
        : null;
      if (strike) fpAttack(strike, dt);
      _dx = 0; _dy = 0;
      // AUDIT 23 (C9): the strike-ENTRY whoosh is gone - DFU plays the
      // swing sound at the HIT FRAME of a swing that hit no enemy
      // (WeaponManager.cs:1059 else-arm) and at bow frame 4 (:376-380),
      // both of which ride the machine's events at the hosts now.
      fpRecheck();
      // WEREWOLF1: THE BODY FOLLOWS THE CURSE - the wolf the moment the player transforms, the person the moment they
      // turn back (Bloodmoon's werewolf, fpArm setWerewolf); the fast path is one boolean compare. AUDIT D1: AHEAD OF
      // THE ready() GATE below - a wolf refused (no Bloodmoon attached) leaves no arm standing, and while this sat
      // under the gate the turn back was never asked: the player stood in the classic sprite until the next load.
      // setWerewolf needs only the last build's opts, which a refusal keeps, and asks nothing of a rig never built.
      // Ahead of the hand, the worn table and the spell too, so their queue waits on the form's build rather than
      // swapping on the body it replaces (AUDIT D3). SHADOW-FANG (AUDIT D5): the skin is read at the CHANGE - a
      // storage read a frame is a file read in the desktop shell.
      if (entity && !paralyzed) {
        const wolf = isMwWerewolf(entity);
        if (wolf !== wolfForm) { wolfForm = wolf; wolfSkin = wolf ? ownWerewolfSkin() : null; }
        fpArm.setWerewolf(wolf, { skin: wolfSkin });
        fpArm.setVampire?.(!!liveVampirism(entity));   // PORTRAIT3D: and the vampire's head the moment the curse takes, the face at the cure
      }
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
        // SPELL-HAND: the spell in the free hand beside the weapon - the arm keeps the weapon's stance (combat/twoHands/spellHandArm.js).
        // AUDIT SPELL-HAND L3-3: told BEFORE the sheathe, so a weapon drawn with the spell kept comes up in its own stance
        fpArm.setSpellHand(_spellHand);
        fpArm.setSheathed(playerWeapon.sheathed);
        // RIFLE-STANCE (combat/gun/rifleStance.js): the fight a long gun's aim reads - a foe's harm on the player within
        // RIFLE_EASE.fight seconds; its own shots it reads itself
        fpArm.setCombatReady?.(playerHarmedWithin(RIFLE_EASE.fight * 1000));
        // MW-D19: THE WEAPON FOLLOWS THE HAND. syncWorn above already
        // reads the equip slot every frame for the classic sprite; the
        // Morrowind arm now rides the same read. setWeapon's fast path
        // is one key compare - the swap itself runs only when the item
        // in the hand actually changed.
        // TWO-HANDS: the arm's hands through their one door (handArm)
        const { armItem, offItem } = handArm();
        // MW-D51: THE LIGHT FOLLOWS THE HAND. The same per-frame read
        // Handheld Torches' hand law writes (PlayerEntity.LightSource -
        // lit by use, stowed when no hand is free) hands the Morrowind
        // arm its torch; setTorch's fast path is one boolean compare.
        fpArm.setTorch(isLitTorch(entity?.lightSource));
        // HT-WAIST: AND THE LANTERN AT THE WAIST, the same read beside it - hung at the third-person body's hip
        // (the first-person arms have no hip to hang it on), swinging as the body moves. The fast path is one
        // boolean compare, as setTorch's is.
        fpArm.setHipLight(lanternAtWaist(entity?.lightSource));
        // MW-D39: THE SPELL IS A STANCE. spellArmed() is already the
        // rig's own per-frame read (WeaponManager's HasReadySpell leg
        // above); the Morrowind arm rides the same one, and its fast
        // path is a boolean compare, so the stance re-composes only
        // when a spell is actually readied or let go.
        fpArm.readySpell(spellArmed());
        // WEAPON-GLOW1 (bible/05-Combat/Weapon-Glow.md): THE WEAPON IN THE HAND GLOWS AS ITS CARD SAYS - its element, or its
        // enchantment where none shows - on its own ranges; a value the next draw reads, so the fast path is an assignment
        // TWO-HANDS: the glow is the item the arm HOLDS (armItem - in a pair the right hand's, whichever hand strikes; the
        // weapon in use would change mid-blow and the arm's key guard drop the glow for every left blow), and a pair's
        // left blade its own
        fpArm.setWeaponGlow?.(meshGlow(armItem), armItem);
        fpArm.setOffWeaponGlow?.(offItem ? meshGlow(offItem) : null, offItem);
        // MW-D32: THE BODY FOLLOWS THE EQUIP TABLE. The same per-frame
        // read that swaps the weapon now hands the rig its worn list;
        // setWorn's fast path is one key compare, and a change - a
        // cloak equipped, a gauntlet dropped - rebuilds the body in
        // those clothes. D29-D31 dressed the BUILD; this dresses the
        // GAME.
        // WEREWOLF1: the form was handed over above, ahead of the gate; the wolf keeps this table for the way back.
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
      // AUDIT CLIMB-ARC F7: WeaponManager.Update's climbing return (:236-240) skips the hit frame too - a swing begun before
      // the hands took the wall steps on (the picture is lowered with it) but lands nothing and sounds nothing
      const evs = _climbing ? (playerWeapon.update(dt), []) : playerWeapon.update(dt);
      if (playerWeapon.machine.isBow && evs.includes('done')) _bowReleaseHidden = true;   // ARROW2: FPSWeapon.cs:529-531
      // AUDIT-THUNDERLOCK F8: THE WEAPON'S OWN VOICE, in the one place
      // all four hosts share. The machine emits `bowSound` for a bow
      // and nothing for anything else, so the port's own weapon fired
      // in silence everywhere - with three baked clips sitting in
      // public/sfx and a lab that played them.
      //
      // The trigger, not the hit frame: the flash is what the ear is
      // matching, and the hit lands a tick later. The reload's two
      // ends ride the machine's own cooldown clock, so a slower
      // character reloads slower and the lock-up still lands with the
      // weapon coming back up - the lab's law, off the numbers the
      // machine already keeps.
      //
      // MW-D42 / AUDIT FIELD-GUN-MW F1: the arm's hold is decided FIRST, so the shot's own voice can ride the same
      // instant its hit does. `armShoots` is the condition both share: the arm is the thing on screen (either view)
      // and the machine is a shooter - `ranged`, not `isBow`.
      const armShoots = (fpArm.active() || fpArm.thirdActive()) && !!playerWeapon.machine.ranged;
      const held = holdShotForArm(evs, dt, armShoots);
      thunderlockVoice(dt, { armShoots, fired: held.fired });
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
      // FIELD-GUN12: THE FRAME'S MOTOR, ASSEMBLED ONCE, ABOVE THE GATE.
      // It used to live inside `if (widgetOn() || _torchesOn ||
      // shieldOn())`, which was fine while the three mods were its
      // only readers - the Thunderlock's own viewmodel is a fourth,
      // and it must read the SAME numbers the mod's modules read
      // whether or not any mod is enabled. (`_lastEye` is the frame's
      // own bookkeeping and belongs out here for the same reason.)
      const cam = camNow;   // CLIMB4: read once, above the swing's gate
      const mv = cam?.move ?? {};
      const spd = entity ? liveStat(entity, 'speed') : 50;
      const base = Number.isFinite(mv.baseSpeed) ? mv.baseSpeed : walkSpeed(spd);
      const ratio = Number.isFinite(mv.speedRatio) ? mv.speedRatio : (Number.isFinite(mv.speedField) && base > 0 ? mv.speedField / base : 1);
      let localVel = [0, 0, 0];
      if (cam?.pos && _lastEye && dt > 0) {
        const v = [(cam.pos[0] - _lastEye[0]) / dt, (cam.pos[1] - _lastEye[1]) / dt, (cam.pos[2] - _lastEye[2]) / dt];
        const yaw = cam.yaw || 0, sy = Math.sin(yaw), cy = Math.cos(yaw);
        localVel = [v[0] * cy - v[2] * sy, v[1], v[0] * sy + v[2] * cy];   // InverseTransformVector: right, up, forward
      }
      keepEye(cam?.pos);
      const frameMotion = { grounded: mv.grounded !== false, crouching: !!mv.crouching, riding: !!mv.riding, standing: !!mv.standing, speedRatio: ratio, baseSpeed: base, localVel };
      stepTwoHands(dt, mv, localVel, { climbing, handsLane });   // TWO-HANDS: the strike's hand, the guard, the running hands
      // AUDIT 27h S3b: THE SWITCHED-OFF FRAME IS COUNTED AT THE GATE, NOT INSIDE IT. S3 counted it as the `else` of the
      // shield's own lateUpdate below, inside this block - and a profile with the Shield Widget alone (SW1-FEED's) shuts
      // the whole block when the switch goes off, so nothing counted and the widget switched back on showed the shield it
      // last read. Every frame that reaches this line is one the widget would have stepped with the switch on.
      if (!shieldOn()) shield.offFrame();
      if (widgetOn() || _torchesOn || shieldOn() || gunUp()) {
        const held = activateHeld();
        _activateStarted = held && !_activatePrev; _activatePrev = held;
        const look = takeFrameLook();   // WW1/HT1: the frame's look, read once, shared by both - in the camera's radians, the Thunderlock's own (its lab's)
        const lookAxes = dfuLookAxes(look);   // WIDGET-LOOK: the same look as InputManager.LookX/LookY, what the mods' Inertia reads
        // FIELD-GUN12: the gun's own rig steps on the same frame, from
        // the same motor and the same look the mod's modules take.
        thunderlockFeel(dt, { width: c?.width ?? 320, height: c?.height ?? 200, motion: frameMotion, look });
        const camThunk = () => (cam ? { ...cam, forward: [Math.sin(cam.yaw || 0) * Math.cos(cam.pitch || 0), Math.sin(cam.pitch || 0), Math.cos(cam.yaw || 0) * Math.cos(cam.pitch || 0)],
          right: [Math.cos(cam.yaw || 0), 0, -Math.sin(cam.yaw || 0)], up: [0, 1, 0] } : null);
        if (_torchesOn) {
          bindTorches();
          const tctx = {
            renderer, canvas: c, entity, machine: playerWeapon.machine, sheathed: playerWeapon.sheathed, usingRightHand: playerWeapon.usingRightHand,
            castPlaying: fpsSpellCasting.isPlayingAnim, spellArmed: spellArmed(), thirdPerson: fpArm.thirdActive() || eotbHidesWeapon(),   // AUDIT-EOTB2: either body on screen hides the FPV hand
            climbing: !!cam?.climbing, swimming: !!mv.swimming, transformedLycanthrope: !!entity && isTransformedLycanthrope(entity),
            motion: frameMotion,   // AUDIT 68 S09-frame-motion-triplicated: FIELD-GUN12's one bag, not a restatement of it
            look: lookAxes, swingHeld: _held, cursorActive: cursorActive(), camera: camThunk, collider: () => collider?.() ?? null,
            actionDown: (action) => !!actionDown?.(action), sheathWeapons: () => { if (!playerWeapon.sheathed) playerWeapon.toggleSheath(); },
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
            speed: ratio * base, baseSpeed: base,   // AUDIT 68 S09-frame-motion-triplicated: `ratio` is the filtered read - a raw NaN speedRatio no longer reaches the motor
            isGrounded: mv.grounded !== false, isCrouching: !!mv.crouching, isRiding: !!mv.riding,
            isStandingStill: !!mv.standing, moveDirectionLocal: localVel,
          },
          // SW1b-4 (audit): `takeFrameLook()` answers an ARRAY, [yaw, pitch]
          // - the clone below reads `look[0]`/`look[1]`. Asking it for `.x`
          // and `.y` got undefined every frame, so the shield's Inertia
          // module saw the movement and never the look. It is off by
          // default, which is the only reason nothing said so.
          look: { x: lookAxes[0], y: lookAxes[1], cursorActive: cursorActive(), swingAction: _held },
        });
        // TWO-HANDS: with both hands up the clone is the RIGHT hand (cloneFrame) and the left hand's steps beside it
        const pair = pairUp(), cf = { c, motion: frameMotion, look: lookAxes, camera: camThunk };
        // MIXED-PAIR: a blade-and-gun pair's gun hand is drawn on the gun's own frame, never its clone - that clone rests
        // out of sight on a still machine (no swing, no whoosh, no thud for a shot) and keeps only its clock
        const gunClone = (hand) => (pair && playerWeapon.gunHand === hand ? { machine: STILL_MACHINE, shown: false } : {});
        if (widgetOn()) widget.lateUpdate(dt, {
          ...cloneFrame(pair ? playerWeapon.handItem('R') : playerWeapon.weapon, pair ? 'R' : null, cf),
          ...(pair ? {} : { machine: playerWeapon.machine, usingRightHand: playerWeapon.usingRightHand }),
          sheathed: playerWeapon.sheathed, shown: spriteShown(), ...gunClone('R'),
        });
        // the left hand's clone: while a pair is up, and after one until its swing has ended and its slide settled out of
        // sight (AUDIT: single-hand play never pays for it) - it slides in from below when the hands become a pair again
        // (the Offset module) and never wakes on a stale swing; and never the sheathe's voice (the right's clone has it:
        // one sheathe, one clip)
        if (widgetOn() && (pair || !twoHands.offWidget.settledHidden)) twoHands.offWidget.lateUpdate(dt, { ...cloneFrame(playerWeapon.handItem('L'), 'L', cf), sheathed: false, shown: pair && spriteShown(), clockOf: widget, ...gunClone('L') });   // AUDIT: never while it rests hidden; AUDIT 2: on the right clone's clock
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
      // TECH1: a bow's technique takes its own hit frame - its loose is the Volley's or the Piercing Shot's, never a plain
      // arrow the host would loose on it (combat/techniques.js claimShot)
      return claimShot(held.evs, _techCtx);
    },
    /** The overlay draw, LAST in the host's frame (composites over the
     *  scene; any HUD draws over it). Runs the bow guard first. */
    /** MAP3: whether the Morrowind arm was the thing drawn on the last
     *  frame - the held map's holder opens the hands lane on it. */
    armsDrawn() { return _armDrewLast && fpArm.drewLast(); },
    /** CLIMB4: how far the viewmodel is lowered for the climb (0 in the hand .. 1 gone). */
    climbLower() { return _climbLower; },   // AUDIT-MAP2: the seam was reached AND the arm composed
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
      try { return onUiScreen(renderer, cv(), () => drawInner({ paralyzed })); } finally { widget.endOfFrame(); twoHands.offWidget.endOfFrame(); shield.endOfFrame(); }   // WW1: WaitForEndOfFrame resumes after the frame's draw (TWO-HANDS: the left hand's clone's too); RETRO-UI: in the pillarbox
    },
    widget,   // WW1: the clone, for the pins
    twoHands,   // TWO-HANDS: the second hand, the guard and the running hands, for the pins
    /** TWO-HANDS (AUDIT 2, L4): the Morrowind arm's hands re-read off the table and handed over - the pack's door while
     *  its window blocks the frame (ui/enhanced/enhancedInventory.js). */
    handArm: () => handArm({ sync: true }),
    shield,   // SW1: the shield's component, for the pins
    climbHands,   // CLIMB-HANDS: the classic lane's hands on the wall, for the pins
    handheld,   // HT1: Handheld Torches' component, for the pins and the pool
    /** AUDIT 66 F8: the host's teardown - every long-lived thing this
     *  rig owns is freed here, as the hosts free their pools. */
    dispose() { handheld.dispose(); _handheldWasOn = false; },
    /** DISC6: the rig's frame is handed to another mode's rig - its torch loop falls silent (handheldTorches silence). */
    silenceTorch() { handheld.silence(); },
  };
  /** TECH-FX (bible/05-Combat/Weapon-Techniques.md THE FEEL): THE HANDS' DIP - a technique's spring lowers the
   *  first-person layer (combat/technique/techniqueFx.js techniqueHands, screen heights - only ever down: every sprite sits on a
   *  screen edge). The CLASSIC lane (the weapon, the clone, the gun, the shield, the torch hand, the spell's hands) takes
   *  it through the renderer's screen offset, the seam retro mode's pillarbox places it with (ui/uiScreen.js
   *  onUiScreen), put back however the layer leaves; the Morrowind ARM takes it through its own screen transform (AUDIT
   *  TECH-FX: its frame window - fpArm.js fpFrameWindow - covers the screen exactly, so an offset laid on after it cut a
   *  bare band across the screen, and with the Weapon Widget off its overlay never read the offset at all). At rest the
   *  layer draws as it always has; the classic draws themselves are untouched (FIELD-GUN12). */
  function drawInner(o) {
    const dy = techniqueHands().y;
    if (!(dy > 0)) return drawLayer(o);
    if (fpArm.active()) { _armDip = dy; try { return drawLayer(o); } finally { _armDip = 0; } }
    if (typeof renderer?.setScreenOffset !== 'function') return drawLayer(o);
    const ox = renderer.screenOffset?.[0] ?? 0, oy = renderer.screenOffset?.[1] ?? 0;
    _dipPx = dy * (cv()?.height ?? 0);
    renderer.setScreenOffset(ox, oy + _dipPx);
    try { return drawLayer(o); } finally { renderer.setScreenOffset(ox, oy); _dipPx = 0; }
  }
  function drawLayer({ paralyzed = false } = {}) {
    {
      bindArm();    // AUDIT 39: the DRAWING rig owns it too - the arm renders through it
      bowArrowGuard();
      const c = cv();   // AUDIT 68 S09-eotb-canvas-null: the spell-hands hide is the HANDS' alone (below) - nulling the canvas took Don'tHideWeapon's weapon with it
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
      let spellHandsDrawn = false;   // TWO-HANDS (AUDIT 2): a spell's hands took the hands this frame (the run yields to them)
      if (c && !fpArm.active() && !eotbHidesSpellHands()) {
        // SPELL-HAND (combat/twoHands/spellHand.js): with the spell in the free hand beside the weapon, ONE of the two - the
        // free hand's, on the side the weapon is not, lowered under the weapon's blow - for the cast and the readied frame
        const side = _spellHand ? spellHandSide() : null;
        const castHands = (art, f) => (side ? drawSpellHand(renderer, c, art, f, { side, tint: fpTint, guard: fpsSpellCasting.isPlayingAnim ? 0 : _spellGuard.hand }) : drawSpellCastHands(renderer, c, art, f, { tint: fpTint }));
        castHands(spellArtFor(fpsSpellCasting.element), fpsSpellCasting.frameIndex);
        spellHandsDrawn = fpsSpellCasting.isPlayingAnim;
        // RSH1 (vendor/readied-spellcasting-hands, Modded_FPSSpellCasting_Ready.cs AnimateSpellCast): A READIED SPELL
        // RAISES THE HANDS. While a spell that is not CasterOnly waits for the click - and the cast itself is not
        // playing (readiedHandsFrame) - its element's frame 0 stands where the cast will start from: the same archive,
        // the same layout, the same light, under the same two lane gates the cast's hands stand under (the Morrowind arm
        // holds its own spell stance, MW-D39; the Beholder's third person hides both). The weapon is already down here:
        // shown()'s HasReadySpell leg hides it, which is what left the screen empty until the click.
        // SPELL-CLIMB (#bug-reports, "Spell+Climbing=4 arms"): AND THEY YIELD TO THE HANDS ON THE WALL. The mod reads no
        // climb - DFU's climb screen is empty, so nothing stood beside them - but the enhanced climb puts two fists on the
        // stone (CLIMB-HANDS), and both pairs stood at once. The spell stays readied (a click on the wall still casts it);
        // its hands stand down while the fists show and come back once they are off the screen.
        if (readiedHandsOn() && !fpsSpellCasting.isPlayingAnim && !climbHands.showing()) {
          const sp = readiedSpell();
          const f = readiedHandsFrame(sp, fpsSpellCasting.isPlayingAnim);
          if (f >= 0) { castHands(spellArtFor(sp.element), f); spellHandsDrawn = true; }
        }
      }
      // PROF1 (bible/06-Systems/Professions-Arc.md 5.1, 22; FORAGE0 14.2): AN ACT'S TOOL IN THE HAND. While a
      // profession's act plays with a tool DFU can draw, the hand holds that and nothing else - the Sickle as DFU's own
      // Tanto sprite, its idle frame (the steady hand does not swing), taken by the host as `actTool` (an item the art
      // is asked by). The shield, the torch hand and the weapon are down for the act's length, as the held map's
      // classic lane takes them (MAP-WEAPON). Above every sheathe gate: a sheathed player still holds the Sickle. The
      // Morrowind lane keeps its stance (its arm draws a modelled weapon, not a sprite - PROF0 22 names it).
      const tool = c && !paralyzed && !fpArm.active() && !eotbHidesWeapon() ? actTool() : null;
      if (tool) {
        const toolArt = artFor(tool);   // an act never plays under a window (the host's own gate), so no held map is up here
        // PROF2: the act says the frame - the Pick-Axe's StrikeDown on each swing (scenes/mineHost.js pickHandFrame), else
        // the idle frame (the steady hand does not swing)
        if (toolArt) drawFpsWeapon(renderer, c, toolArt, tool.state ?? 'Idle', tool.frame ?? 0, { tint: fpTint });
        return;
      }
      // CLIMB-HANDS (Mac, 2026-10-02: the two paintings "for the first person view (not morrowind)"): THE HANDS ON THE
      // WALL. The classic sprite is lowered out of the screen for the climb (CLIMB4, below); the sprite lane's two fists
      // (or a fist and the reaching arm, looked off the wall) come up in its place. Above every sheathe gate - the hands
      // hold the stone whatever is drawn - and under the same vetoes the spell's hands take, and the held map's.
      // SPELL-CLIMB: and never under a spell's hands - a cast in flight has them off the stone (frame(), castTakesHands),
      // and a readied spell's stand down while the fists show (above): one pair of arms on the screen.
      if (c && !paralyzed && !spellHandsDrawn && !fpArm.active() && !eotbHidesWeapon() && !sheetWindowUp()) climbHands.draw(c, { tint: fpTint });
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
        && (!fpArm.active() || fpArm.torchShown())
        && !lanternAtWaist(entity?.lightSource);   // HT-WAIST: the gate opens only where a hand paints - a lantern at the waist is in none
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
      // FIELD-GUN13 (Mac: "The weapon should come up from the bottom
      // screen into frame when unholstering, not pop in") - A WEAPON
      // ON ITS WAY OUT IS STILL A WEAPON.
      //
      // The fourth relaxation of this gate, and it follows AUDIT-FIELD
      // F1's rule exactly, for the reason that finding exists:
      // `shown()` is false for FOUR things and only ONE of them is the
      // sheathe. A readied spell, a cast animation and an equip
      // countdown all mean EMPTY HANDS by construction, and a gun
      // sliding out of frame across them would be the port inventing a
      // state DFU has never drawn. So the sheathe leg is named
      // POSITIVELY (`thunderlockSliding` tests `playerWeapon.sheathed`
      // itself) and the other three are re-stated here, the way
      // `torchOnly` and `sheetOnly` re-state theirs.
      //
      // The two LANE conditions come with them: the Morrowind arm's
      // branch returns above this and the EotB billboard's above that,
      // so a gun easing out from under a modelled arm would be two
      // weapons at once.
      const gunSliding = !!c && gunUp() && thunderlockSliding()
        && !spellArmed() && !fpsSpellCasting.isPlayingAnim && (entity?.equipCountdown ?? 0) <= 0
        && !eotbHidesWeapon() && !fpArm.active();
      // MW-CAST1: THE CASTING HANDS ARE THE ARM'S. A readied spell hides the weapon (shown()'s HasReadySpell leg), and
      // that hid the Morrowind arm with it - the hands in the spell stance and the whole cast were never on screen in
      // first person. The arm draws them; the classic hands above are the other lane's.
      const armCasts = fpArm.active() && (spellArmed() || fpsSpellCasting.isPlayingAnim || fpArm.castInFlight());
      // CLIMB-HANDS II (Mac, 2026-10-13: "the morrowind model should use climbing hands in first person"): THE HANDS ON
      // THE STONE ARE NOT A WEAPON EITHER - the sixth relaxation of this gate, on the rule the five above keep. CLIMB6
      // poses the Morrowind arms on the climb (the hands on the stone they hold, combat/climbRig.js) and they were drawn
      // only past `shown()`, the WEAPON's predicate: climbing sheathed - the everyday case - the arm never drew, and the
      // sprite lane's hands are the classic lane's (climbHands.draw above is `!fpArm.active()`), so the Morrowind lane
      // climbed on an empty screen. It opens exactly where the arm paints the climb - `climbPosed`: first person, the
      // pose's weight on the hands, no sheet in them - which is the same answer the lowering below reads, and the arm
      // hides the weapon, the arrow and the torch while it climbs (fpArm.js, WeaponManager's climbing return).
      const armsClimb = fpArm.active() && !!fpArm.climbPosed?.();
      // TWO-HANDS: THE RUNNING HANDS ARE NOT A WEAPON EITHER (an empty-handed run is often a sheathed one)
      const runHands = !!c && twoHands.running && !fpArm.active() && !eotbHidesWeapon() && !sheetWindowUp();
      const armsRun = fpArm.active() && !!fpArm.runPosed?.();
      if (paralyzed || (!shown() && !torchOnly && !sheetOnly && !shieldRect && !gunSliding && !armCasts && !armsClimb && !runHands && !armsRun)) return;
      // THE ONE SEAM. The arm draws whole and RETURNS, or it is inactive
      // and the classic sprite draws exactly as it always has. The return
      // is load-bearing: without it both composite and the player sees a
      // weapon sprite pasted over a pair of hands.
      // WW1: the widget's channels reach the Morrowind arms as a screen
      // transform over their composite (Bob, Inertia, Step); the Offset
      // module's slide is the sprite's own sheathe and stays with it.
      // CLIMB-HANDS II: not while the arms climb - the hands are on the stone where the eye sees it (Mac: "the hands
      // should stay on whatever your climbing and not rotate with the screen"), and Inertia's lag behind the look and
      // Bob's sway are the weapon's feel, not the wall's.
      fpArm.setScreenTransform(widgetOn() && !armsClimb ? (base) => widget.armsTransform(base) : null);
      // CLIMB4: and the climb's lowering over it - the arms leave the screen downward while the hands are on the wall.
      // CLIMB6: unless the Morrowind arms are posed on the climb - the hands reach the stone they hold (combat/climbRig.js),
      // and stay on the screen where the stone is.
      if (_climbLower > 0 && !armsClimb) { const armsBase = fpArm.screenTransform(); fpArm.setScreenTransform((base) => climbLowerRect(armsBase ? armsBase(base) : base, _climbLower)); }
      // TECH-FX: and a technique's dip over all of it - through the transform, so the frame window grows over the edge
      // the dip opens (drawInner)
      if (_armDip > 0) { const armsBase = fpArm.screenTransform(); fpArm.setScreenTransform((base) => techniqueDipRect(armsBase ? armsBase(base) : base, _armDip, base.h)); }
      // Lowered out of sight, no lane draws (the arm's record stays the top's false); the gun and the clone have no slide
      // of their own to lend, so halfway down they are gone - the arms and the classic sprite slide the whole way.
      if (!armsClimb && (_climbLower >= CLIMB_LOWER_GONE || (_climbLower >= 0.5 && !fpArm.active() && (widgetOn() || thunderlockHeld())))) return;
      // WW1: THE CLONE DRAWS IN THE SPRITE'S PLACE. DFU's clone hides the
      // original every frame and draws itself in OnGUI; here the one
      // draw seam picks the clone while its switch is on - after the arm
      // (which returns), before the sprite (which the clone stands in for).
      // AUDIT-EOTB2 [SETTINGS]: ToggleBillboard hides the FPV weapon while
      // the sprite body is on screen (Compatibility.Don'tHideWeapon keeps
      // it) - the classic sprite, the torch hand and the clone alike. The
      // machine still swings; only the picture goes.
      // TWO-HANDS (bible/05-Combat/Two-Hands.md): THE TWO-HANDS BRANCH - both hands up (the fists or the pair) and the
      // running hands. Like the arm's branch below it draws whole and returns, and it is taken only where the classic
      // body draws at all (not under the Beholder's sprite, not under the Morrowind arm, not behind the held map's window
      // - MAP-WEAPON). A pair holds no shield and no light (handsLaw.js handsModeOf), so the one-hand ladder below - the
      // shield behind the torch hand behind the gun, the clone, the sprite - is the single hand's, untouched. Each hand is
      // drawn as DFU draws a right hand, the one on the left of the screen mirrored whole (combat/twoHands/twoHands.js), the
      // striking hand over the other; the running fists over them while they run, or up from below the view with the
      // hands down (sheathed, nothing in either).
      // TWO-HANDS (AUDIT 2): once something takes the hands the run eases out, drawn only while no other picture is in them
      // this frame - a weapon, a light, a shield, the gun, a spell's hands - which it yields to at once (never held over
      // them; the held sheet and the Morrowind arm are runHands' own vetoes)
      const runDrawn = runHands && (handsEmpty() || !(shown() || torchOnly || !!shieldRect || gunSliding || spellHandsDrawn));
      // PISTOLET: A PAIR OF GUNS draws whole and returns, ahead of the melee pair's branch (whose clones are a sword's):
      // each pistol through the gun's own frame (drawThunderlock's `hand`), the striking one over the other. Taken where
      // the melee pair's is - the classic body's lane, no held sheet - and through the holster's slide.
      if (c && pistolsUp() && playerWeapon.gunPair && !eotbHidesWeapon() && !fpArm.active() && !sheetWindowUp() && (shown() || gunSliding)) {
        for (const h of pistols.order(playerWeapon.pistols)) {
          const art = artFor(playerWeapon.handItem(h));
          if (art?.anchor && art.unionBox) drawThunderlock(art, c, fpTint, h);
        }
        return;
      }
      // MIXED-PAIR: A BLADE AND A GUN draw whole and return, through two doors in the pair's own order (the striking hand
      // over the other): the Pistolet on the gun's frame (drawThunderlock's `hand` - its own side, its guard under the
      // blade's blow), the blade as the melee pair's hand (twoHands.drawPair's `only` - its clone or its classic sprite, its
      // mirror and its guard under the shot). Taken where both pairs' branches are; through the holster's slide too.
      if (c && pistolsUp() && playerWeapon.mixedPair && pairUp() && !eotbHidesWeapon() && !fpArm.active() && !sheetWindowUp() && (shown() || gunSliding)) {
        const gh = playerWeapon.gunHand;
        const o = { widget, widgetOn: widgetOn(), shown: spriteShown(), tint: fpTint, offsetHeight: weaponOffsetHeight() - climbDrop(_climbLower, c.height), running: false };
        for (const h of twoHands.drawOrder()) {
          if (h !== gh) { twoHands.drawPair(renderer, c, { ...o, only: h, artFor: (hand) => artFor(playerWeapon.handItem(hand)), glowFor: (hand) => glowOf(playerWeapon.handItem(hand)) }); continue; }
          const art = artFor(playerWeapon.handItem(gh));
          // CLIMB4: the gun has no slide to lend - halfway down the climb's lowering it is gone, as a lone gun is (the
          // early return's `thunderlockHeld` leg is the right hand's gun), while the blade slides the whole way
          if (art?.anchor && art.unionBox && _climbLower < 0.5) drawThunderlock(art, c, fpTint, gh);
        }
        return;
      }
      if (c && !eotbHidesWeapon() && !fpArm.active() && !sheetWindowUp() && (runDrawn || (pairUp() && shown()))) {
        const o = { widget, widgetOn: widgetOn(), shown: spriteShown(), tint: fpTint, offsetHeight: weaponOffsetHeight() - climbDrop(_climbLower, c.height) };   // CLIMB4: lowered for the climb, as the one sprite is
        // TWO-HANDS (AUDIT): the running fists first, then the pair over them - a punch thrown on the run is drawn from its
        // first frame, over the other fist easing from the pump to its guard (drawRun leaves the striking hand to drawPair)
        if (runDrawn) twoHands.drawRun(renderer, c, artFor(null), pairUp() && shown() ? o : { ...o, shown: false });
        if (pairUp() && shown()) twoHands.drawPair(renderer, c, { ...o, running: runDrawn, artFor: (hand) => artFor(playerWeapon.handItem(hand)), glowFor: (hand) => glowOf(playerWeapon.handItem(hand)) });   // WEAPON-GLOW1: each hand's own element
        return;
      }
      _armDrewLast = !eotbHidesWeapon() && fpArm.active();   // MAP3: the two lines below draw the arm exactly when this is true
      if (eotbHidesWeapon()) return;
      if (fpArm.active()) { fpArm.draw(c); return; }
      // MAP-WEAPON (2026-09-19, Mac: "when opening up the enhanced map,
      // your unsheathed weapon can still be seen") - THE SPRITE LANE HAS
      // NO ANSWER FOR A WINDOW THAT DOES NOT COVER THE SCREEN.
      //
      // MAP-FIELD gave the MORROWIND arm its held-sheet pose, and
      // fpArm.holdPaper hides the weapon, the arrow and the torch while
      // it holds - so the arm's own branch, one line up, was already
      // right. The classic body never had that: it has no pose to take,
      // so it just kept drawing. Under DFU's own travel map that is
      // invisible - TRAV0I00 is a full-screen window and the weapon is
      // behind it - but the enhanced map is the port's own sprite, two
      // hands holding a parchment with REAL ALPHA around them and
      // bottom-anchored by MAP-FIELD5, so the weapon shows through and
      // around it. Hands holding a map are not also holding a sword.
      //
      // It stands HERE, below the arm's branch and above the shield,
      // the torch hand, the clone and the sprite, so it takes exactly
      // the four the classic body would have painted and nothing the
      // arm draws. A sheathed frame already drew none of them, so on
      // that path this line changes nothing.
      if (sheetWindowUp()) return;
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
      if (torchOnly && !gunSliding) return;   // TORCH-VIS: the lit hand ALONE - a sheathed stance still draws no weapon, clone or sprite (FIELD-GUN13: unless the gun is still on its way out, which the hand is drawn behind)
      // SW1-GATE: and the shield ALONE is no more a weapon than the torch
      // is. A no-op for every path that predates it - `torchOnly` has
      // returned, `sheetOnly` needs `fpArm.active()` which returned at the
      // seam - so this line stops the shield-only frame and nothing else.
      if (!shown() && !gunSliding) return;   // FIELD-GUN13: ...and the gun's own sheathe leg, eased rather than cut
      // FIELD-GUN12 (Mac, the sixth time: "Port the god damn prototype
      // verbatim"). THE GUN TAKES THE PROTOTYPE'S OWN FRAME, not the
      // classic rect-builder and not the mod's clone.
      //
      // Both of those are 1:1 ports - of DFU, and of
      // RedRoryOTheGlen's mod - written for the weapons those two
      // things have, and this weapon is neither's. Five rounds were
      // spent making a rect built for a CIF record come back right
      // for a contact sheet. It still RUNS the mod's three modules,
      // on the mod's own settings (combat/gun/gunViewmodel.js imports
      // them; it does not imitate them) - what it no longer does is
      // compose the frame a second way and then be corrected.
      const tlArt = c && thunderlockHeld() ? artFor(playerWeapon.weapon) : null;
      if (tlArt?.anchor && tlArt.unionBox) { drawThunderlock(tlArt, c, fpTint); return; }
      // FIELD-GUN13: and nothing BELOW this line may draw on a sliding
      // frame. `gunSliding` relaxed three gates for the gun's own arm
      // alone; with no art loaded yet the weapon is sheathed as far as
      // the clone and the classic sprite are concerned, exactly as it
      // was before.
      if (gunSliding && !shown()) return;
      // SPELL-HAND: under the free hand's cast the weapon lowers by its guard (a share of its own drawn height)
      if (widgetOn() && c && widget.draw(renderer, c, fpTint, _spellGuard.weapon > 0 ? { transform: (r) => ({ ...r, y: r.y + guardDrop(_spellGuard.weapon, r.h) }) } : undefined)) return;
      const art = c && artFor(playerWeapon.weapon);
      const m = playerWeapon.machine, offsetHeight = c ? weaponOffsetHeight() - climbDrop(_climbLower, c.height) : 0;
      const spellDrop = art && _spellGuard.weapon > 0 ? guardDrop(_spellGuard.weapon, fpsWeaponQuad(c, art, m.state, m.frame, { offsetHeight })?.rect.h ?? 0) : 0;
      if (art && spriteShown()) drawFpsWeapon(renderer, c, art, m.state, m.frame, { tint: fpTint, offsetHeight: offsetHeight - spellDrop, glow: heldGlowNow() });   // CLIMB4: lowered for the climb (0: OnGUI's own offset); WEAPON-GLOW1: the element's outline, the held weapon's own
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
  let first;   // DISC19-E: the one surface the swing's ray meets, cast lazily
  for (const o of actions.objects.values()) {
    // AUDIT 63 F37: WeaponEnvDamage reads a LIVE Physics.Raycast hit
    // (WeaponManager.cs:459-464), so a mover is struck where it is,
    // not where it was placed - the same law as the activate ray.
    const box = objectAabb(o);
    if (!box) continue;
    const d = rayAabb(eye, lookDir, box);
    if (d === null || d > WEAPON_REACH || d >= bestD) continue;
    // DISC19-E: the activate ray's law - a mesh collider whose box is
    // entered while the first surface is ANOTHER action object's own bucket
    // was never struck (the door stands inside the corridor piece's box).
    // AUDIT DISC19: the cast runs as far as the press's, not the reach: a
    // door whose BOX is inside the reach may have its mesh just past it
    // (DFU's door is a BoxCollider, met at the box), and a cast cut at the
    // reach met nothing - the relay in front kept the swing (Orsinium's
    // door text, 12631 behind 12080: box 2.35 m, mesh 2.57 m).
    if (hasMeshCollider(o) && collider.raycastHit) {
      first ??= collider.raycastHit(eye, lookDir, RAY_DISTANCE);
      if (first.key != null && first.key !== o.key && actions.objects.has(first.key)) continue;
    }
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
