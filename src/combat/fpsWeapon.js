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
//   - FlipHorizontal (the left-handed option) is not implemented;
//     classic right-hand is the only mode until a settings surface
//     exists. The alignment math keeps the non-flipped branches only.
//   - weaponOffsetHeight is 0: the large HUD does not exist here yet.

import { CifRciFile } from '../formats/cifRciFile.js';
import { isEnchanted } from '../systems/inventory.js';   // AUDIT 17e C2
import { WEAPONS, WEAPON_MATERIALS, weaponDyeColor } from '../characters/weapons.js';
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

export const ALIGN = Object.freeze({ Left: 0, Center: 1, Right: 2 });

// The classic 320x200 design surface every weapon image overlays.
// AUDIT 24 (wave 24): the classic 320x200 panel has one home in
// ui/nativePanel.js.
import { NATIVE_W, NATIVE_H } from '../ui/nativePanel.js';

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

/** GetWeaponAnims, verbatim routing. */
export function getWeaponAnims(weaponType) {
  const T = WEAPON_TYPES;
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
 * point filtering, no large-HUD offset): the weapon image overlays a
 * 320x200 design surface stretched to the canvas, bottom-anchored,
 * aligned per the state's table row.
 */
export function drawFpsWeapon(renderer, canvas, art, state, frame) {
  if (!art) return;
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
  if (anim.Alignment === ALIGN.Left) x = canvas.width * anim.Offset;
  else if (anim.Alignment === ALIGN.Center) x = canvas.width / 2 - w / 2;
  else x = canvas.width * (1 - anim.Offset) - w;
  const y = canvas.height - h;   // weaponOffsetHeight 0 (no large HUD)
  renderer.drawScreenQuad(tex, { x, y, w, h });
}
