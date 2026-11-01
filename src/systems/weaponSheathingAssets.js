// WS1 - THE FILES. OWN-WORK4 (2026-10-31): Weapon Sheathing's seventy-one scabbard meshes and three skeleton addons
// are retired; what this door serves now is our own bone addon (systems/ownSheathing.js SHEATH_POINTS), written in
// code at the path a skeleton's addons are listed from, and our scabbards are built per weapon at the holster's
// resolve (weaponSheathing.js resolveHolsterParts' `ownScabbard`).
//
// The archive ranks AFTER the player's own loose files and BEFORE every .bsa: a bone addon or a scabbard the player
// attached (a replacer, the mod itself) wins, and retail carries none of these names.
import { makeVendoredArchive } from './urlArchive.js';
import { SHEATHING_ADDON_PATH, sheathingAddonBytes } from './ownSheathing.js';

const OWN_ADDON = 'own:sheathing-bones';

/** Canonical data-files path -> its source, for our own files. */
export const WEAPON_SHEATHING_URLS = Object.freeze({ [SHEATHING_ADDON_PATH]: OWN_ADDON });

const fetchBytes = async (url) =>
  url === OWN_ADDON ? sheathingAddonBytes() : new Uint8Array(await (await fetch(url)).arrayBuffer());

let _archive = null;
/** Our archive, one per page: the bone addon, built in code - in node as in the browser. */
export function weaponSheathingArchive() {
  return (_archive ??= makeVendoredArchive(WEAPON_SHEATHING_URLS, fetchBytes));
}
