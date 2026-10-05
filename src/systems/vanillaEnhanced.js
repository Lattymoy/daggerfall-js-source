// VE3 (2026-10-05) - VANILLA ENHANCED, THE TEXTURE OVERHAUL'S FIRST PACK.
//
// carademono's Vanilla Enhanced (Nexus Mods, Daggerfall Unity mod 273; its sources at
// github.com/drcarademono/vanilla-enhanced) is Daggerfall's own textures remastered - the terrain's tile sets, the
// nature flats, the city walls, the dungeons. VE3 had the player attach it (Port-Doctrine: A RENDER OF GAME DATA IS
// GAME DATA); VE4 (Mac, 2026-10-05: "Put it in the codebase") ships it, under the exception Port-Doctrine records:
// systems/vanillaEnhancedPack.js registers the Base, Masked Roads and Snowless Swamps and Jungles in the texture-mod
// door (systems/dfmodTextures.js) - the Base on by default (AUDIT VE), its add-ons off. A copy the player attaches under the same name - a newer version
// from Nexus - shadows the shipped one. This module names which registered mods are Vanilla Enhanced and wears them as
// one look on the Texture Overhaul card (systems/overhauls.js).
//
// THE FAMILY is the Base and every mod built on it: Masked Roads, Snowless Swamps and Jungles and Winter Tracks each
// declare `vanilla enhanced - base` a dependency in their manifests - the same declaration that loads them after the
// Base, so that where they and the Base carry one name the add-on's picture is drawn (VE1, DFU's load order). The look
// is the Base; an add-on is the player's choice on the card (VE4), and the choice is kept across a turn to Classic.
//
// Nothing here touches the DOM.
import { attachedDfmods, setDfmodEnabled } from './dfmodTextures.js';
import { installVanillaEnhancedPack } from './vanillaEnhancedPack.js';   // VE4
import { textureReplacementCount, textureReplacementEnabled } from './textureReplacement.js';
import { isIilMod } from './improvedInteriorLighting.js';   // the lighting mod rides the same store and is no texture mod
import { setValue, saveSettings } from './settings.js';
import { getPref, setPref } from './uiPrefs.js';

/** The Base's Mod.FileName - the name its add-ons depend on. */
export const VE_BASE = 'vanilla enhanced - base';
/** The Base's GUID (`Vanilla Enhanced - Base.dfmod.json`), for a copy stored under another file name. */
export const VE_BASE_GUID = '1f124f8c-dd01-48ad-a5b9-0b4a0e4702d2';
/** Where the mod is published - a newer version than the one the port ships is attached from there. */
export const VE_LINK = 'https://www.nexusmods.com/daggerfallunity/mods/273';
/** VE4: the add-ons Vanilla Enhanced was last worn with (their keys), for the next time it is - Classic switches every
 *  texture mod off, and this is how the card's choice outlives it. */
export const VE_ADDONS_PREF = 'veAddons';

export const isVeBase = (m) => !!m && (m.fileName === VE_BASE || m.guid === VE_BASE_GUID);
/** The Base, or a mod that depends on it. */
export const isVeFamily = (m) => isVeBase(m) || (m?.deps ?? []).includes(VE_BASE);
/** The door's mods, the shipped pack in it (VE4: put there on the first ask - a card opened before any host has
 *  booted reads it too). */
const doorMods = () => { installVanillaEnhancedPack(); return attachedDfmods(); };
/** Every registered texture mod - the packs card's list: every .dfmod, attached or shipped, but the lighting mod. */
export const textureMods = () => doorMods().filter((m) => !isIilMod(m));
/** The registered Base - the shipped one, or the player's own copy over it - or null. */
export const veBase = () => doorMods().find(isVeBase) ?? null;
/** VE4: the registered add-ons, in load order - the card's rows. */
export const veAddons = () => textureMods().filter((m) => isVeFamily(m) && !isVeBase(m));

/** Vanilla Enhanced is worn: the Base is switched on, and DFU's Replace Game Artwork is on. */
export const veWorn = () => textureReplacementEnabled() && veBase()?.enabled === true;
/** Daggerfall's own textures are what is drawn: Replace Game Artwork is off, or no texture mod is on and no loose
 *  texture pack is attached (that one has no switch - the packs card removes it). */
export const classicTexturesWorn = () => !textureReplacementEnabled() || (!textureMods().some((m) => m.enabled) && textureReplacementCount() === 0);

const keptAddons = () => { const v = getPref(VE_ADDONS_PREF); return Array.isArray(v) ? v.filter((k) => typeof k === 'string') : []; };
/** AUDIT VE R10: a loose texture pack - a folder of pictures, not a mod - is drawn: behind Replace Game Artwork, with no
 *  switch of its own (the packs card removes it). Classic switches mods off and could not wear Classic past it: the
 *  card stood on Custom saying "a mix of texture mods is switched on" with every mod off, its Use doing nothing seen. */
export const looseTexturesWorn = () => textureReplacementEnabled() && textureReplacementCount() > 0;
/** AUDIT VE R10: why Classic cannot be worn by a switch now - a loose texture pack is attached - or null. */
export const classicBlocked = () => (looseTexturesWorn()
  ? 'A loose texture pack is attached (a folder of pictures, not a mod). Remove it on the Replacement packs card at the foot of Features to wear Classic.'
  : null);
/** AUDIT VE R10: the Custom note's words - a loose pack alone is not a mix of texture mods. */
export const customTextureNote = () => (looseTexturesWorn() && !textureMods().some((m) => m.enabled)
  ? 'Custom: a loose texture pack is attached (a folder of pictures, not a mod). The Replacement packs card at the foot of Features removes it.'
  : 'Custom: a mix of texture mods is switched on. The Replacement packs card at the foot of Features lists them.');

/** Wear Vanilla Enhanced: the Base switched on with the add-ons it was last worn with, and Replace Game Artwork with
 *  them (the switch every texture pack stands behind - DFU's Enhancements/AssetInjection). Other texture mods are left
 *  as they are. */
export function wearVanillaEnhanced() {
  if (!textureReplacementEnabled()) { setValue('Enhancements', 'AssetInjection', 'True'); saveSettings(); }
  const keep = new Set(keptAddons());
  const base = veBase();
  setDfmodEnabled([...(base ? [base.key] : []), ...veAddons().filter((m) => keep.has(m.key)).map((m) => m.key)], true);
}
/** VE4: an add-on switched on or off from the card - and kept as the choice Vanilla Enhanced is worn with. */
export function setVeAddon(key, on) {
  const keep = new Set(keptAddons());
  if (on) keep.add(key); else keep.delete(key);
  setPref(VE_ADDONS_PREF, [...keep].sort());
  return setDfmodEnabled(key, on);
}
/** Wear Daggerfall's own textures: every texture mod switched off, kept registered. Vanilla Enhanced's add-ons that
 *  were on are remembered for the next time it is worn (VE4). */
export function wearClassicTextures() {
  if (veWorn()) setPref(VE_ADDONS_PREF, veAddons().filter((m) => m.enabled).map((m) => m.key).sort());
  setDfmodEnabled(textureMods().map((m) => m.key), false);
}
