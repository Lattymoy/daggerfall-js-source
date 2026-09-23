// ═══════════════════════════════════════════════════════════════════
// DW1 - DIVERSE WEAPONS 1.7.3 (RealAKP; script by RealAKP & Kirk.O, MIT)
//
// Mac, 2026-09-23, with the mod's zip: "Its a mod integration".
//
// THE MOD IS ONE LINE OF CODE AND 12,624 SPRITES. The line is
//
//     FPSWeapon.moddedWeaponHUDAnimsEnabled = true;
//
// (DiverseWeaponsMain.cs:37, carried verbatim in vendor/diverse-weapons/)
// and everything it switches on is Daggerfall Unity's own - so this is
// a port of DFU, gated on a vendored mod's flag, and the sprites reach
// the game off the player's copy of the bundle (combat/
// diverseWeaponsAssets.js). Nothing here is the mod's code; every
// function names the DFU member it restates.
//
// WHAT THE FLAG DOES. The classic first-person art is one CIF per
// weapon CLASS - WEAPON04.CIF is every long blade, dagger to
// dai-katana - and FPSWeapon builds its atlas from that file
// (WeaponBasics.GetWeaponFilename, WeaponBasics.cs). With the flag on
// and a weapon in hand, FPSWeapon.GetWeaponTextureAtlas asks
// TextureReplacement for every record and frame by a name PER TEMPLATE
// instead (WeaponBasics.GetModdedWeaponFilename: LONGSWORD.CIF,
// KATANAMAGIC.CIF, WABBAJACK.CIF...), and any frame a mod carries under
// that name replaces the classic frame in the atlas (FPSWeapon.cs
// :635-657). A name nobody carries misses, and that frame stays
// classic - which is also what happens when the flag is on and no
// bundle is attached, so the flag is safe to leave on.
//
// The port draws the first-person weapon down two lanes - its own
// FPSWeapon (combat/fpsWeapon.js loadFpsWeaponArt) and the Weapon
// Widget clone that is the default renderer (combat/weaponWidget.js
// customTexture) - and both take this law through the same two doors
// below, because in DFU both read the same static and the same
// TextureReplacement folder.
// ═══════════════════════════════════════════════════════════════════

import { modSetting, flattenModPreset } from '../systems/modSettings.js';
import { WEAPONS } from '../characters/weapons.js';
import { isEnchanted } from '../systems/inventory.js';
import { hasArtifactEffect, hasArtifactSubtype, ARTIFACTS } from '../systems/artifactEffects.js';
import { ENCHANTMENT_TYPES } from '../systems/enchantments.js';

/** FPSWeapon.moddedWeaponHUDAnimsEnabled (FPSWeapon.cs:97) - a static
 *  false until a mod sets it; Diverse Weapons' Start sets it true. The
 *  port reads the mod's `Enabled` switch, which is the same thing said
 *  by the player. */
export const moddedWeaponHUDAnimsEnabled = () => modSetting('diverse-weapons', 'Enabled') === true;

/**
 * WeaponBasics.GetModdedWeaponFilename (WeaponBasics.cs), verbatim.
 *
 * Three tables by the weapon's state, and the artifact table first:
 * an artifact's own CIF by name (Mehrunes' Razor, the Wabbajack, the
 * Staff of Magnus, the Ebony Blade, Chrysamere, the Mace of Molag Bal,
 * Volendrung, Auriel's Bow), then an enchanted weapon's `<NAME>MAGIC
 * .CIF`, then the plain `<NAME>.CIF`. The DFU default arm answers ""
 * - "Just place-holder for now, may see about allowing custom weapon
 * types to use this in some way" - and the caller falls back to the
 * classic name for it (FPSWeapon.cs:642-643).
 *
 * THE STAFF ARM WALKS THE LEGACY ENCHANTMENTS IN ORDER, and the order
 * is the law: the first entry that is a SpecialArtifactEffect and the
 * Wabbajack answers WABBAJACK.CIF; the first entry that is NOT a
 * SpecialArtifactEffect answers STAFFOFMAGNUS.CIF; a list of other
 * artifact effects answers "". Restated with the same loop rather than
 * a lookup, so a staff enchanted first with something else stays what
 * DFU makes it.
 */
export function moddedWeaponFilename(weapon) {
  if (!weapon) return '';
  const W = WEAPONS;
  if (isEnchanted(weapon)) {
    if (isArtifact(weapon)) {
      switch (weapon.templateIndex) {
        case W.Dagger: return 'MEHRUNESRAZOR.CIF';
        case W.Staff:
          for (const e of (Array.isArray(weapon.enchantments) ? weapon.enchantments : [])) {
            if (e?.type === ENCHANTMENT_TYPES.SpecialArtifactEffect) {
              if (e.param === ARTIFACTS.Wabbajack) return 'WABBAJACK.CIF';
            } else {
              return 'STAFFOFMAGNUS.CIF';
            }
          }
          return '';
        case W.Katana: return 'EBONYBLADE.CIF';
        case W.Claymore: return 'CHRYSAMERE.CIF';
        case W.Mace: return 'MACEOFMOLAGBAL.CIF';
        case W.Warhammer: return 'VOLENDRUNG.CIF';
        case W.Long_Bow: return 'AURIELSBOW.CIF';
        default: return '';
      }
    }
    switch (weapon.templateIndex) {
      case W.Dagger: return 'DAGGERMAGIC.CIF';
      case W.Tanto: return 'TANTOMAGIC.CIF';
      case W.Staff: return 'STAFFMAGIC.CIF';
      case W.Shortsword: return 'SHORTSWORDMAGIC.CIF';
      case W.Wakazashi: return 'WAKAZASHIMAGIC.CIF';
      case W.Broadsword: return 'BROADSWORDMAGIC.CIF';
      case W.Saber: return 'SABERMAGIC.CIF';
      case W.Longsword: return 'LONGSWORDMAGIC.CIF';
      case W.Katana: return 'KATANAMAGIC.CIF';
      case W.Claymore: return 'CLAYMOREMAGIC.CIF';
      case W.Dai_Katana: return 'DAIKATANAMAGIC.CIF';
      case W.Mace: return 'MACEMAGIC.CIF';
      case W.Flail: return 'FLAILMAGIC.CIF';
      case W.Warhammer: return 'WARHAMMERMAGIC.CIF';
      case W.Battle_Axe: return 'BATTLEAXEMAGIC.CIF';
      case W.War_Axe: return 'WARAXEMAGIC.CIF';
      case W.Short_Bow: return 'SHORTBOWMAGIC.CIF';
      case W.Long_Bow: return 'LONGBOWMAGIC.CIF';
      case W.Arrow: return 'ARROWMAGIC.CIF';
      default: return '';
    }
  }
  switch (weapon.templateIndex) {
    case W.Dagger: return 'DAGGER.CIF';
    case W.Tanto: return 'TANTO.CIF';
    case W.Staff: return 'STAFF.CIF';
    case W.Shortsword: return 'SHORTSWORD.CIF';
    case W.Wakazashi: return 'WAKAZASHI.CIF';
    case W.Broadsword: return 'BROADSWORD.CIF';
    case W.Saber: return 'SABER.CIF';
    case W.Longsword: return 'LONGSWORD.CIF';
    case W.Katana: return 'KATANA.CIF';
    case W.Claymore: return 'CLAYMORE.CIF';
    case W.Dai_Katana: return 'DAIKATANA.CIF';
    case W.Mace: return 'MACE.CIF';
    case W.Flail: return 'FLAIL.CIF';
    case W.Warhammer: return 'WARHAMMER.CIF';
    case W.Battle_Axe: return 'BATTLEAXE.CIF';
    case W.War_Axe: return 'WARAXE.CIF';
    case W.Short_Bow: return 'SHORTBOW.CIF';
    case W.Long_Bow: return 'LONGBOW.CIF';
    case W.Arrow: return 'ARROW.CIF';
    default: return '';
  }
}

/** DaggerfallUnityItem.IsArtifact - the port's reading, off the same
 *  enchantment list DFU reads (systems/artifactEffects.js, AUDIT WORLD4
 *  B1), with the loot mint's own flag beside it. */
const isArtifact = (item) => item?.artifact === true || hasArtifactEffect(item);

/**
 * FPSWeapon.GetWeaponTextureAtlas's name choice (FPSWeapon.cs:637-644):
 *
 *     string moddedFileName = filename;
 *     if (moddedWeaponHUDAnimsEnabled && SpecificWeapon != null)
 *     {
 *         moddedFileName = WeaponBasics.GetModdedWeaponFilename(SpecificWeapon);
 *         if (string.IsNullOrEmpty(moddedFileName))
 *             moddedFileName = WeaponBasics.GetWeaponFilename(WeaponType);
 *     }
 *
 * `classic` is GetWeaponFilename's answer, handed in by the caller so
 * this module does not import the table (combat/fpsWeapon.js owns it
 * and imports this). The flag off, or no weapon in hand - a spell, the
 * fists, a werebeast's claws - is the classic name, byte for byte.
 */
export function atlasFileName(item, classic, enabled = moddedWeaponHUDAnimsEnabled()) {
  if (!enabled || !item) return classic;
  return moddedWeaponFilename(item) || classic;
}

/**
 * THE NAMES ONE FRAME IS ASKED BY, in order, for the widget clone.
 *
 * Weapon Widget's GetWeaponTextureAtlas arm (IL 0x2d72-0x2e12) asks
 * TryImportCifRci with the `w_` prefix under DoubleScaleTextures and
 * the plain name otherwise. Its own bundle carries `w_` idles only, so
 * under DoubleScaleTextures a strike frame's `w_` ask misses and the
 * classic frame draws - which is exactly what the mod does alone. Now
 * Diverse Weapons ships whole animation sets under the PLAIN names and
 * `w_` idles beside them, and its readme sends Weapon Widget users to
 * a preset that turns DoubleScaleTextures ON. Under an either/or that
 * preset would throw away every strike frame the mod paints; so the
 * `w_` ask falls through to the plain one, and the preset means what
 * the mod's author meant by it. The port's own reading, said here
 * rather than buried: Weapon Widget's IL record (bible/05-Combat/
 * Weapon-Widget.md) names GetWeaponFilename and TryImportCifRci among
 * the members the clone calls and does not name GetModdedWeaponFilename;
 * the clone's own atlas cache is keyed on the weapon's template
 * (LoadWeaponAtlas 0x29a8, `currentTemplateIndex`), which a per-class
 * atlas would have no reason to be.
 */
export function customTextureNames(file, record, frame, metalName, doubleScale) {
  const plain = `${file}_${record}-${frame}${metalName ? `_${metalName}` : ''}`;
  return doubleScale ? [`w_${plain}`, plain] : [plain];
}

// ---- the Weapon Widget preset the mod ships ---------------------------

/**
 * The bundle's "Diverse Weapons" TextAsset - a Weapon Widget settings
 * preset (vendor/diverse-weapons/weapon-widget-preset.json, verbatim
 * there; restated here as the store's own keys, the way every vendored
 * modsettings.json is). "Recommended settings for DW": the nine
 * modules on, TrueTextureSize at factor 1 so the mod's frames draw at
 * their painted size, DoubleScaleTextures for its `w_` idles, a bob of
 * 142, recoil on every condition. A pin holds this against the JSON.
 */
export const DIVERSE_WEAPONS_WIDGET_PRESET = Object.freeze({
  Modules: { Swings: 'True', Ambidexterity: 'True', Offset: 'True', Bob: 'True', Inertia: 'True', Step: 'True', DoubleScaleTextures: 'True', TrueTextureSize: 'True', Recoil: 'True' },
  Swings: { Speed: '1', Windup: '1', Recovery: '0', VanillaAlignmentOverride: 'True', VanillaRecoveryOverride: 'False', NoDaggerMirroredStrikes: 'True' },
  Offset: { Speed: '1' },
  Bob: { Length: '142', Offset: '0', SizeX: '1', SizeY: '1', SpeedMove: '1', SpeedState: '1', Shape: '0', BobWhileIdle: 'True' },
  Step: { Length: '1', Condition: '0' },
  Inertia: { Scale: '1', Speed: '1', ForwardDepth: '1', ForwardSpeed: '1' },
  TrueTextureSize: { TextureScaleFactor: '1' },
  Recoil: { Condition: '0', Chance: '100', PlayEntityMissEffects: 'True', DetectEnvironment: 'True', PlayEnvironmentMissEffects: 'True', MissEffectPlacement: '0' },
  Miscellaneous: { MirrorBows: 'False' },
});

/** The preset as the store speaks it - `Section.Key`, coerced by
 *  Weapon Widget's declared kinds. Computed once. */
let _flat = null;
export const diverseWeaponsWidgetPreset = () => (_flat ??= flattenModPreset('weapon-widget', DIVERSE_WEAPONS_WIDGET_PRESET));

/** True when the preset is laid over Weapon Widget's settings: the
 *  mod on, and its preset switch on. */
export const diverseWeaponsPresetOn = () =>
  moddedWeaponHUDAnimsEnabled() && modSetting('diverse-weapons', 'WeaponWidgetPreset') === true;

/**
 * Weapon Widget's settings with the mod's preset over them - what
 * `readWidgetSettings` reads. "Select Diverse Weapons settings preset
 * in Weapon Widget mod options" (the mod's readme) is, in DFU, a
 * picker that OVERWRITES the player's values with the preset's; the
 * port lays the preset over them while the switch is on and leaves
 * theirs underneath, so turning it off gives them back. `Enabled`,
 * Weapon Widget's own switch, is not in the preset and is never
 * touched by it.
 */
export function withDiverseWeaponsPreset(settings, on = diverseWeaponsPresetOn()) {
  if (!on) return settings;
  return { ...settings, ...diverseWeaponsWidgetPreset() };
}
