// Classic first-person weapons - the TRUE Daggerfall method, 1:1
// (design pivot 2026-08-17, Mac-directed: the voxel FP viewmodel is
// ON ICE; see characters/characterSprite + anims ATTACKS_FP for the
// iced surface and Combat.md for the record).
//
// Sources, verbatim: FPSWeapon.cs (frame/record selection, the
// 320x200 screen-space alignment math), WeaponBasics.cs (the seven
// per-type animation tables, filenames incl. the WEAPO1xx enchanted
// variants), ItemHelper.ConvertItemToAPIWeaponType (template-index ->
// animation set, enchanted promotion), ImageProcessing.ChangeDye
// (metal dye over palette band 0x70-0x7F - dyes.js owns the tables).
//
// The swing STATE MACHINE is untouched: weaponStates.js already runs
// WeaponManager verbatim (frames 0..4 on the classic tick, bow
// draw/hold/loose). This module only maps (state, frame) to the CIF
// art and draws it the way DaggerfallUI does.
//
// Departures (documented):
//   - weaponOffsetHeight is 0: the large HUD does not exist here yet.
// FlipHorizontal (Controls/Handedness == 1, StartGameBehaviour :269 -
// "only supporting left-hand rendering for now") landed with AUDIT 28
// W13: the mirror and the AlignRight -> AlignLeft swap on the three
// symmetric states, as FPSWeapon :378-388 and :459-464 have them.

import { CifRciFile } from '../formats/cifRciFile.js';
import { getInt } from '../systems/settings.js';   // AUDIT 28 W13: Controls/Handedness
import { getPref } from '../systems/uiPrefs.js';   // MAC-I: the first-person lighting switch
import { isEnchanted } from '../systems/inventory.js';   // AUDIT 17e C2
import { WEAPONS, WEAPON_MATERIALS, weaponDyeColor } from '../characters/weapons.js';
import { THUNDERLOCK_TEMPLATE } from '../characters/thunderlockIds.js';   // the port's own weapon (a leaf - see the file)
import { applyDyeToIndex, DYE_TARGETS } from '../characters/dyes.js';

// WeaponTypes (DaggerfallUnityEnums), the animation-set ids.
export const WEAPON_TYPES = Object.freeze({
  None: -1,
  LongBlade: 0, LongBlade_Magic: 1,
  Staff: 2, Staff_Magic: 3,
  Dagger: 4, Dagger_Magic: 5,
  Mace: 6, Mace_Magic: 7,
  Flail: 8, Flail_Magic: 9,
  Warhammer: 10, Warhammer_Magic: 11,
  Battleaxe: 12, Battleaxe_Magic: 13,
  Bow: 14, Melee: 15, Werecreature: 16,
  // THE PORT'S OWN, past the end of DFU's enum so nothing classic
  // shifts: the Dwarven Thunderlock (systems/thunderlock.js). It has
  // no WEAPON*.CIF - its frames come off one sheet, which is why
  // WEAPON_FILE below has no row for it and combat/thunderlockArt.js
  // loads it instead.
  Thunderlock: 17, Thunderlock_Magic: 18,
});

// GetWeaponFilename, verbatim.
export const WEAPON_FILE = Object.freeze({
  [WEAPON_TYPES.LongBlade]: 'WEAPON04.CIF', [WEAPON_TYPES.LongBlade_Magic]: 'WEAPO104.CIF',
  [WEAPON_TYPES.Staff]: 'WEAPON01.CIF', [WEAPON_TYPES.Staff_Magic]: 'WEAPO101.CIF',
  [WEAPON_TYPES.Dagger]: 'WEAPON02.CIF', [WEAPON_TYPES.Dagger_Magic]: 'WEAPO102.CIF',
  [WEAPON_TYPES.Mace]: 'WEAPON05.CIF', [WEAPON_TYPES.Mace_Magic]: 'WEAPO105.CIF',
  [WEAPON_TYPES.Flail]: 'WEAPON06.CIF', [WEAPON_TYPES.Flail_Magic]: 'WEAPO106.CIF',
  [WEAPON_TYPES.Warhammer]: 'WEAPON07.CIF', [WEAPON_TYPES.Warhammer_Magic]: 'WEAPO107.CIF',
  [WEAPON_TYPES.Battleaxe]: 'WEAPON08.CIF', [WEAPON_TYPES.Battleaxe_Magic]: 'WEAPO108.CIF',
  [WEAPON_TYPES.Bow]: 'WEAPON09.CIF',
  [WEAPON_TYPES.Melee]: 'WEAPON10.CIF',
  [WEAPON_TYPES.Werecreature]: 'WEAPON11.CIF',
});

// WeaponBasics' Alignment - a leaf now (combat/weaponAlign.js), so a
// reader that wants only the enum does not take this module's world
// with it. Re-exported here: this is still the enum's front door.
export { ALIGN } from './weaponAlign.js';
import { unionDrawRect } from './gunSheet.js';   // FIELD-GUN11: the gun's box -> the drawn box
import { ALIGN } from './weaponAlign.js';

// The classic 320x200 design surface every weapon image overlays.
// AUDIT 24 (wave 24): the classic 320x200 panel has one home in
// ui/nativePanel.js.
import { NATIVE_W, NATIVE_H } from '../ui/nativePanel.js';
import { weaponOffsetHeight } from '../ui/hudLarge.js';   // ROAD-D D10: LargeHUDUndockedOffsetWeapon / the docked force

export { NATIVE_W, NATIVE_H };

// WeaponStates order = the array index into every anim table (the
// enum's comment IS the record mapping for most sets; MagicBattleAxe
// shuffles records, which is why the tables carry Record explicitly).
export const STATE_INDEX = Object.freeze({
  Idle: 0, StrikeDown: 1, StrikeDownLeft: 2, StrikeLeft: 3,
  StrikeRight: 4, StrikeDownRight: 5, StrikeUp: 6,
});

// WeaponBasics animation speeds (frames per second).
const IDLE_FPS = 10, STRIKE_FPS = 10, WERE_FPS = 20, BOW_FPS = 10;

const A = (Record, NumFrames, FramePerSecond, Alignment, Offset) =>
  Object.freeze({ Record, NumFrames, FramePerSecond, Alignment, Offset });

// The seven tables, verbatim WeaponBasics (row order = STATE_INDEX).
export const MELEE_ANIMS = Object.freeze([
  A(0, 1, IDLE_FPS, ALIGN.Right, 0.15),
  A(1, 5, STRIKE_FPS, ALIGN.Center, 0),
  A(2, 5, STRIKE_FPS, ALIGN.Center, 0),
  A(3, 5, STRIKE_FPS, ALIGN.Center, 0),
  A(4, 5, STRIKE_FPS, ALIGN.Center, 0),
  A(5, 5, STRIKE_FPS, ALIGN.Center, 0),
  A(6, 5, STRIKE_FPS, ALIGN.Center, 0),
]);
export const GENERAL_ANIMS = Object.freeze([
  A(0, 1, IDLE_FPS, ALIGN.Right, 0),
  A(1, 5, STRIKE_FPS, ALIGN.Right, 0),
  A(2, 5, STRIKE_FPS, ALIGN.Right, 0),
  A(3, 5, STRIKE_FPS, ALIGN.Right, 0),
  A(4, 5, STRIKE_FPS, ALIGN.Left, 0),
  A(5, 5, STRIKE_FPS, ALIGN.Left, 0),
  A(6, 5, STRIKE_FPS, ALIGN.Right, 0),
]);
export const DAGGER_ANIMS = Object.freeze([
  A(0, 1, IDLE_FPS, ALIGN.Right, 0.04),
  A(1, 5, STRIKE_FPS, ALIGN.Right, 0),
  A(2, 5, STRIKE_FPS, ALIGN.Right, 0),
  A(3, 5, STRIKE_FPS, ALIGN.Right, 0),
  A(4, 5, STRIKE_FPS, ALIGN.Left, 0),
  A(5, 5, STRIKE_FPS, ALIGN.Left, 0),
  A(6, 5, STRIKE_FPS, ALIGN.Right, 0),
]);
export const STAFF_ANIMS = Object.freeze([
  A(0, 1, IDLE_FPS, ALIGN.Right, 0.02),
  A(1, 5, STRIKE_FPS, ALIGN.Right, 0),
  A(2, 5, STRIKE_FPS, ALIGN.Right, 0),
  A(3, 5, STRIKE_FPS, ALIGN.Center, 0),
  A(4, 5, STRIKE_FPS, ALIGN.Center, 0),
  A(5, 5, STRIKE_FPS, ALIGN.Left, 0),
  A(6, 5, STRIKE_FPS, ALIGN.Right, 0),
]);
export const MAGIC_BATTLEAXE_ANIMS = Object.freeze([
  A(0, 1, IDLE_FPS, ALIGN.Right, 0),
  A(1, 5, STRIKE_FPS, ALIGN.Right, 0),
  A(2, 5, STRIKE_FPS, ALIGN.Right, 0),
  A(4, 5, STRIKE_FPS, ALIGN.Right, 0),   // records shuffled, verbatim
  A(5, 5, STRIKE_FPS, ALIGN.Left, 0),
  A(3, 5, STRIKE_FPS, ALIGN.Left, 0),
  A(6, 5, STRIKE_FPS, ALIGN.Right, 0),
]);
export const BOW_ANIMS = Object.freeze([
  A(0, 1, BOW_FPS, ALIGN.Right, 0),
  A(0, 7, BOW_FPS, ALIGN.Right, 0),
  A(0, 7, BOW_FPS, ALIGN.Right, 0),
  A(0, 7, BOW_FPS, ALIGN.Right, 0),
  A(0, 7, BOW_FPS, ALIGN.Right, 0),
  A(0, 7, BOW_FPS, ALIGN.Right, 0),
  A(0, 4, BOW_FPS, ALIGN.Right, 0),
]);
export const WERECREATURE_ANIMS = Object.freeze([
  A(0, 1, IDLE_FPS, ALIGN.Center, 0.02),
  A(1, 5, WERE_FPS, ALIGN.Right, 0.2),
  A(2, 5, WERE_FPS, ALIGN.Right, 0),
  A(3, 5, WERE_FPS, ALIGN.Right, 0),
  A(4, 5, WERE_FPS, ALIGN.Right, 0),
  A(5, 5, WERE_FPS, ALIGN.Left, 0),
  A(6, 5, WERE_FPS, ALIGN.Left, 0.2),
]);

/** The Thunderlock's table. Not a WeaponBasics row - there is no such
 *  row - but the same five columns, so everything that reads an anim
 *  reads this one too. Record 0 is the idle pose, record 1 the six
 *  fire frames, and every strike direction plays the same six: a gun
 *  does not care which way you dragged. AlignRight, because that is
 *  where the lab settled it and where the classic weapons sit. */
export const THUNDERLOCK_ANIMS = Object.freeze([
  A(0, 1, IDLE_FPS, ALIGN.Right, 0),
  A(1, 6, STRIKE_FPS, ALIGN.Right, 0),
  A(1, 6, STRIKE_FPS, ALIGN.Right, 0),
  A(1, 6, STRIKE_FPS, ALIGN.Right, 0),
  A(1, 6, STRIKE_FPS, ALIGN.Right, 0),
  A(1, 6, STRIKE_FPS, ALIGN.Right, 0),
  A(1, 6, STRIKE_FPS, ALIGN.Right, 0),
]);

/** GetWeaponAnims, verbatim routing. */
export function getWeaponAnims(weaponType) {
  const T = WEAPON_TYPES;
  if (weaponType === T.Thunderlock || weaponType === T.Thunderlock_Magic) return THUNDERLOCK_ANIMS;   // the port's own, ahead of the verbatim routing
  if (weaponType === T.Melee) return MELEE_ANIMS;
  if (weaponType === T.Dagger || weaponType === T.Dagger_Magic) return DAGGER_ANIMS;
  if (weaponType === T.Staff || weaponType === T.Staff_Magic) return STAFF_ANIMS;
  if (weaponType === T.Battleaxe_Magic) return MAGIC_BATTLEAXE_ANIMS;
  if (weaponType === T.Bow) return BOW_ANIMS;
  if (weaponType === T.Werecreature) return WERECREATURE_ANIMS;
  return GENERAL_ANIMS;
}

/** ConvertItemToAPIWeaponType, verbatim: template index -> animation
 *  set, then the enchanted promotion. Bare hands (no item) = Melee. */
export function weaponTypeForItem(item) {
  const W = WEAPONS, T = WEAPON_TYPES;
  if (!item) return T.Melee;
  // V4: SetFPSWeapon's claws (LycanthropyEffect.cs:332-345) - the
  // transformed rig binds the WERECLAWS_ITEM marker, which is not a
  // template at all
  if (item.werecreatureClaws) return T.Werecreature;
  // THE PORT'S OWN WEAPON, ahead of the verbatim switch so the switch
  // stays exactly ConvertItemToAPIWeaponType. It takes the enchanted
  // promotion the classic weapons take - there is no WEAPO1xx sheet
  // for it, so the magic art is the same sheet through a shimmer
  // (combat/thunderlockArt.js) rather than a second set of frames.
  if (item.templateIndex === THUNDERLOCK_TEMPLATE) {
    return isEnchanted(item) ? T.Thunderlock_Magic : T.Thunderlock;
  }
  let result;
  switch (item.templateIndex) {
    case W.Dagger: result = T.Dagger; break;
    case W.Staff: result = T.Staff; break;
    case W.Tanto: case W.Shortsword: case W.Wakazashi: case W.Broadsword:
    case W.Saber: case W.Longsword: case W.Katana: case W.Claymore:
    case W.Dai_Katana: result = T.LongBlade; break;
    case W.Mace: result = T.Mace; break;
    case W.Flail: result = T.Flail; break;
    case W.Warhammer: result = T.Warhammer; break;
    case W.Battle_Axe: case W.War_Axe: result = T.Battleaxe; break;
    case W.Short_Bow: case W.Long_Bow: result = T.Bow; break;
    default: return T.None;
  }
  if (isEnchanted(item)) {   // AUDIT 17e C2: the enchanted WEAPO1xx set was unreachable
    switch (result) {
      case T.Dagger: result = T.Dagger_Magic; break;
      case T.Staff: result = T.Staff_Magic; break;
      case T.LongBlade: result = T.LongBlade_Magic; break;
      case T.Mace: result = T.Mace_Magic; break;
      case T.Flail: result = T.Flail_Magic; break;
      case T.Warhammer: result = T.Warhammer_Magic; break;
      case T.Battleaxe: result = T.Battleaxe_Magic; break;
      default: break;
    }
  }
  return result;
}

/** ChangeDye(WeaponsAndArmor) + palette expansion for one frame:
 *  indexed bitmap -> RGBA color32 with the metal dye applied over the
 *  0x70-0x7F band. Index 0 is transparent (the CIF convention). */
export function frameToColor32(bmp, palette, dye) {
  const colors = new Uint32Array(bmp.width * bmp.height);
  const u8 = new Uint8Array(colors.buffer);
  for (let i = 0; i < bmp.data.length; i++) {
    let idx = bmp.data[i];
    if (idx === 0) continue;   // classic CIF index 0 = transparent
    // No Unchanged short-circuit here (parity audit 2026-08-17): DFU's
    // DyeColors aliases Silver = SilverOrElven = Chain = Unchanged =
    // 18, and ChangeDye's switch routes 18 into the SILVER metal
    // table - the guard this bake used to carry skipped the dye for
    // every silver weapon. The CALLER guards Steel/None the way
    // FPSWeapon.GetWeaponTexture2D does; anything that reaches here
    // dyes.
    if (dye != null) idx = applyDyeToIndex(idx, dye, DYE_TARGETS.WeaponsAndArmor);
    const c = palette.get(idx);
    const o = i * 4;
    u8[o] = c.r; u8[o + 1] = c.g; u8[o + 2] = c.b; u8[o + 3] = 255;
  }
  return { width: bmp.width, height: bmp.height, colors };
}

/**
 * Load one weapon's full FP art: every record's frames baked with the
 * material's metal dye and uploaded. Returns
 *   { weaponType, anims, records: [{ width, height, frames: [tex] }] }
 * Cache by `${weaponType}:${material}` at the call site.
 */
export async function loadFpsWeaponArt(getBytes, palette, renderer, weaponType, material = WEAPON_MATERIALS.Iron) {
  const fileName = WEAPON_FILE[weaponType];
  if (!fileName) return null;
  const cif = new CifRciFile();
  cif.load(await getBytes(fileName), fileName, palette);
  // FPSWeapon.GetWeaponTexture2D verbatim: "not for steel as that is
  // default colour in files" (None has no material here). Everything
  // else dyes - including Silver through the aliased 18 (see
  // frameToColor32).
  const dye = material === WEAPON_MATERIALS.Steel ? null : weaponDyeColor(material);
  const records = [];
  for (let r = 0; r < cif.recordCount; r++) {
    const size = cif.getSize(r);
    const frames = [];
    for (let f = 0; f < cif.getFrameCount(r); f++) {
      const c32 = frameToColor32(cif.getDFBitmap(r, f), palette, dye);
      frames.push(renderer.uploadTexture('img', `fpw:${fileName}:${material}:${r}:${f}`, c32));
    }
    records.push({ width: size.width, height: size.height, frames });
  }
  return { weaponType, anims: getWeaponAnims(weaponType), records };
}

/**
 * FPSWeapon.UpdateWeapon + OnGUI placement, verbatim (right-hand,
 * point filtering): the weapon image overlays a 320x200 design
 * surface stretched to the canvas, bottom-anchored above the large
 * HUD's offset, aligned per the state's table row.
 */
/** FPSWeapon :378, :459: FlipHorizontal mirrors only the states whose
 *  art is hand-symmetric - Idle, StrikeDown, StrikeUp. A left or right
 *  strike keeps its side. */
export const FLIP_STATES = Object.freeze(['Idle', 'StrikeDown', 'StrikeUp']);

/**
 * MAC-I: the first-person sprites' tint switch - the `firstPersonLighting`
 * pref (Features -> First-person lighting) with `?fplight=off` as the kill
 * door, which is the shape every other port switch here has (wispsOn,
 * floraSwayOn). It is NOT gated on the enhanced skin: the classic sprite is
 * what takes the tint, and the classic skin is where it is always drawn.
 */
export function fpLightingOn(search = globalThis.location?.search ?? '') {
  return !!getPref('firstPersonLighting') && new URLSearchParams(search).get('fplight') !== 'off';
}

export function drawFpsWeapon(renderer, canvas, art, state, frame, {
  flipHorizontal = getInt('Controls', 'Handedness', 0, 3) === 1,
  // ROAD-D D10: weaponOffsetHeight (FPSWeapon.cs:146-155). Read
  // through the ONE home for the large HUD's laws rather than
  // recomputed - and DEFAULTED here, so the single caller
  // (combat/weaponRig.js) does not have to know the bar exists.
  offsetHeight = weaponOffsetHeight(),
  // MAC-I: FPSWeapon.Tint (FPSWeapon.cs:108), which DFU passes to its
  // own draw (:182) and never writes - the port writes it from the
  // light the room's flats take (render/renderer.js flatLightAt). null
  // is Color.white, byte for byte, which is every caller before this.
  tint = null,
  // FIELD-GUN6: a rect delta in native (320x200) units, for a weapon
  // that moves without its animation moving it - the Thunderlock's
  // recoil spring and its reload lower. Null is every classic weapon,
  // which is every caller that predates it.
  adjust = null,
} = {}) {
  if (!art) return;
  const flip = flipHorizontal && FLIP_STATES.includes(state);
  const stateIdx = STATE_INDEX[state] ?? 0;
  const anim = art.anims[stateIdx];
  const recordIdx = art.weaponType === WEAPON_TYPES.Bow ? 0 : anim.Record;
  const rec = art.records[recordIdx];
  if (!rec) return;
  const f = Math.min(frame, rec.frames.length - 1);
  const tex = rec.frames[f];
  const scaleX = canvas.width / NATIVE_W;
  const scaleY = canvas.height / NATIVE_H;
  const w = rec.width * scaleX;
  const h = rec.height * scaleY;
  let x;
  // AlignRight's flip arm (:459-464) is AlignLeft; AlignLeft itself is
  // not swapped (:439-446).
  const alignment = (flip && anim.Alignment === ALIGN.Right) ? ALIGN.Left : anim.Alignment;
  if (alignment === ALIGN.Left) x = canvas.width * anim.Offset;
  else if (alignment === ALIGN.Center) x = canvas.width / 2 - w / 2;
  else x = canvas.width * (1 - anim.Offset) - w;
  // OnGUI's rect (:388): `screenRect.height - height - weaponOffsetHeight`.
  let y = canvas.height - h - offsetHeight;
  if (adjust) { x += (adjust.x ?? 0) * scaleX; y += (adjust.y ?? 0) * scaleY; }
  // The mirror: rect.xMax .. -width (:388), i.e. u from 1 to 0.
  const src = flip ? { u0: 1, v0: 0, u1: 0, v1: 1 } : undefined;
  // FIELD-GUN11: the rect above is the WEAPON's own box for art that
  // declares one (the Thunderlock's sheet - its flash and smoke live
  // outside it). Everything that lays out or transforms the weapon
  // works on that box, and the full image is expanded back around it
  // HERE, at the moment of drawing. `unionBox` is absent on every CIF
  // record, which is every weapon that predates this.
  const q = art.unionBox && art.anchor ? unionDrawRect({ x, y, w, h }, art.anchor, art.unionBox) : { x, y, w, h };
  renderer.drawScreenQuad(tex, q, src, tint ?? undefined);   // MAC-I: Tint
}
