// THE PORT'S OWN MORROWIND ASSETS, shipped with the build.
//
// FIELD-GUN-MW2 (2026-09-20). The Dwarven Thunderlock is the port's own
// weapon and Morrowind has no firearm, so its model cannot come out of
// a player's archives - it has to come from here. What ships is a real
// Morrowind 4.0.0.2 NIF and a real DDS, baked from Mac's Blender export
// by `tools/fbxMesh.mjs` -> `tools/meshUnwrap.mjs` ->
// `tools/meshTexture.mjs` / `tools/nifWrite.mjs`, so the Morrowind lane
// reads them through exactly the doors it reads everything else
// through: `parseNif`, `flattenNif`, `correctTexturePath`,
// `decodeTextureImage`. Nothing in `src/` knows these two files are
// special.
//
// ═══ THE MOUNT POINT IS THE WHOLE DESIGN ══════════════════════════
//
// `dataSource.js` builds the archive list in rank order: the player's
// LOOSE FILES first (MW-D40's data-files-over-BSA law), then WS1's
// vendored scabbards, then every .bsa. This sits in that same list, and
// its rank says two things on purpose:
//
//   AFTER the loose files, so a player who drops their own
//   `meshes/thunderlock.nif` into the store REPLACES ours, exactly as
//   they can replace a scabbard or a retail mesh. Mac painting a
//   texture is this case: his file wins without a rebuild.
//
//   BEFORE every .bsa, where retail carries none of these names anyway.
//
// ═══ VITE'S GLOB DOOR, AND WHY NODE SEES NOTHING ══════════════════
//
// `import.meta.glob` is a compile-time macro: in the browser the call
// below is already a table of URLs by the time it runs, and in node it
// is undefined. `dataSource.js` is imported by the node suite, so the
// glob is taken only where a window is - node gets an empty table and
// an archive whose `has` answers false for everything, which is the
// same shape `weaponSheathingAssets.js` has carried since WS1. The
// PURE half (`makeVendoredArchive`, `ownMwDataPath`) is what the suite
// drives, with paths it supplies itself.
import { makeVendoredArchive } from './urlArchive.js';

const IN_BROWSER = typeof window !== 'undefined';

// EAGER, for AUDIT-WS's reason: a lazy glob emits one chunk per file,
// each holding a single URL string, and a request apiece to fetch them.
const FILES = IN_BROWSER
  ? import.meta.glob('../assets/mw/**/*.{nif,dds}', { eager: true, query: '?url', import: 'default' })
  : {};

/**
 * `../assets/mw/meshes/thunderlock.nif` -> `meshes/thunderlock.nif`.
 *
 * The tree under `src/assets/mw/` IS a Data Files tree - `meshes/`,
 * `textures/` - so the canonical path is simply everything after it,
 * and a file added to the right folder needs no entry anywhere. A path
 * outside the tree keeps its basename rather than throwing, because a
 * glob that matched something unexpected should cost one file and not
 * the whole archive.
 */
export function ownMwDataPath(file) {
  const p = String(file).replace(/\\/g, '/').toLowerCase();
  const at = p.indexOf('assets/mw/');
  return at >= 0 ? p.slice(at + 'assets/mw/'.length) : p.slice(p.lastIndexOf('/') + 1);
}

/** Canonical data-files path -> its URL, for the port's own tree. */
export const OWN_MW_URLS = Object.freeze(
  Object.fromEntries(Object.entries(FILES).map(([p, url]) => [ownMwDataPath(p), url])),
);

const fetchBytes = async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer());

let _archive = null;
/** The port's own archive, one per page. Empty (has() false for all) in node. */
export function ownMwArchive() {
  return (_archive ??= makeVendoredArchive(OWN_MW_URLS, fetchBytes));
}
