// WS1 - THE FILES. Weapon Sheathing's seventy-one scabbard meshes and
// three skeleton addons reach the Morrowind layer through Vite's glob
// door, as Dynamic Skies' textures do: URLs emitted with the build,
// fetched the first time a rig asks for one. import.meta.glob is Vite's
// compile-time macro: in the browser the call below is a table of lazy
// loaders by the time it runs; in node it is undefined, and
// dataSource.js (which the node suite imports) must never evaluate it,
// so the glob is taken only where a window is - node sees an empty
// table and the pure archive (systems/weaponSheathing.js
// makeVendoredArchive) is fed paths by the tests.
//
// The archive ranks AFTER the player's own loose files and BEFORE every
// .bsa: a scabbard the player attached (a replacer, a newer version of
// the mod) wins, and retail carries none of these names.
import { makeVendoredArchive, vendoredDataPath } from './weaponSheathing.js';
import { fetchUrlBytes } from './urlArchive.js';

const IN_BROWSER = typeof window !== 'undefined';
// AUDIT-WS: EAGER. A lazy glob emitted one chunk per file (seventy-four
// chunks of one URL string each, a request apiece); eager, the table is
// the URLs themselves, in the module that owns it.
const FILES = IN_BROWSER ? import.meta.glob('../../vendor/weapon-sheathing/Data Files/**/*.nif', { eager: true, query: '?url', import: 'default' }) : {};

/** Canonical data-files path -> its URL, for the vendored tree. */
export const WEAPON_SHEATHING_URLS = Object.freeze(Object.fromEntries(Object.entries(FILES).map(([p, url]) => [vendoredDataPath(p), url])));

let _archive = null;
/** The vendored archive, one per page. Empty (has() false for all) in node. */
export function weaponSheathingArchive() {
  return (_archive ??= makeVendoredArchive(WEAPON_SHEATHING_URLS, fetchUrlBytes));
}
