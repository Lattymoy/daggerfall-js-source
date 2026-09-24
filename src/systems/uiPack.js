// OVH2 (2026-09-24, Mac: "Our first overhaul option will be the file attached") - THE UI PACKS: art that re-dresses
// the classic screens, the way Daggerfall Unity's loose-file injection does (TextureReplacement.cs).
//
// GrimoireUI 1.2 (LordSquacquerone, Nexus Daggerfall Unity mod 1222) is a LOOSE-FILE pack: no .dfmod, just the
// StreamingAssets folders DFU reads beside the game -
//   Textures/Img/<NAME>.IMG.png          a whole IMG screen (TryImportImage, :280-283)
//   Textures/CifRci/<FILE>_<r>-<f>.png   one CIF/RCI record (GetNameCifRci, :783-801) - here BUTTONS.RCI's buttons
//   Textures/<name>backgroundcolor.png   the save window's panels and buttons (DaggerfallUnitySaveGameWindow :455-473)
//   Fonts/FONT000N-SDF.ttf               a classic font's SDF face (DaggerfallFont.ReplaceTMPFontFromFile :661-705)
// It ships under public/art/grimoire-ui/ byte for byte, and vendor/grimoire-ui/grimoire-ui.files.json - the
// archive's own listing - is the ONE authority on what it holds: this module reads it, and the doctrine gate reads
// it, so the port cannot answer for a file the pack did not ship.
//
// THE SIZE LAW (ImageReader.cs:306/321, GetSubTexture :103-111): a replacement keeps the CLASSIC size as its logical
// size - the 320x200 layout, every hit rect and every sub-rect stay classic - and only the texture behind it is the
// pack's. Every draw in ui/nativePanel.js turns a sub-rect into UVs by dividing by the logical w/h, so a 3x PNG lines
// up under the same numbers with nothing else changed.
//
// WHEN A PACK IS WORN: the classic screens only (a pack re-dresses classic art; the enhanced screens draw none), and
// never under a URL skin override - `?skin=classic` is the probes' door (uiSkin.js), and a probe must keep pinning
// classic art whatever a player last chose. `?uipack=grimoire` wears it for one page load, for a probe that wants it.
import manifest from '../../vendor/grimoire-ui/grimoire-ui.files.json' with { type: 'json' };
import { getPref, setPref } from './uiPrefs.js';
import { uiSkin, skinOverride } from './uiSkin.js';
import { APP_ROOT } from './appRoot.js';

export const UI_PACK_NONE = 'none';
/** The packs, by the pref's token. One today; a second is one row and its listing. */
export const UI_PACKS = Object.freeze({
  grimoire: Object.freeze({
    id: 'grimoire', title: 'GrimoireUI', version: manifest.ModVersion, author: manifest.ModAuthor, source: manifest.Source,
    dir: 'art/grimoire-ui', vendor: 'grimoire-ui', files: Object.freeze([...manifest.Files]),   // vendor: its vendor/ folder (README, listing, credit)
  }),
});
const clean = (v) => (v === UI_PACK_NONE || Object.hasOwn(UI_PACKS, v) ? v : null);

/** The URL's answer for this page load only, or null (uiSkin's override law). */
export function uiPackOverride(search = globalThis.location?.search ?? '') {
  return clean(new URLSearchParams(search).get('uipack'));
}

/** The pack being worn, or null: the URL's `uipack`, else - with no URL skin override - the stored choice; and only
 *  ever over the classic skin. */
export function activeUiPack(search) {
  if (uiSkin(search) !== 'classic') return null;
  const url = uiPackOverride(search);
  const id = url ?? (skinOverride(search) ? UI_PACK_NONE : clean(getPref('uiPack')) ?? UI_PACK_NONE);
  return id === UI_PACK_NONE ? null : UI_PACKS[id];
}
/** Store a pack choice ('none' or a pack id); a bad value is a typo and changes nothing. */
export function setUiPack(id) { return clean(id) ? setPref('uiPack', id) : false; }

// ---- the pack's files, by the name the port asks for ---------------------------------------------------------------
/** Where a shipped file stands: `Textures/...` and `Fonts/...` keep their folders under the pack's directory. */
const servedPath = (file) => file.replace(/^StreamingAssets\/Textures\//, '').replace(/^StreamingAssets\//, '');
/** The pack's index, built once from its listing: Img by IMG name, CifRci by `FILE_r-f` (case folded, as DFU's
 *  Windows file lookup is - the pack ships `Buttons.rci_0-0` beside `BUTTONS.RCI_21-0`), the save window's colour
 *  textures and the fonts by their bare names. */
const _indexes = new WeakMap();   // pack -> its index (the pack rows are frozen)
export function packIndex(pack) {
  if (_indexes.has(pack)) return _indexes.get(pack);
  const img = new Map(), cifRci = new Map(), colours = new Map(), fonts = new Map();
  for (const f of pack.files) {
    const served = servedPath(f);
    let m;
    if ((m = /^Img\/(.+)\.png$/i.exec(served))) img.set(m[1].toUpperCase(), served);
    else if ((m = /^CifRci\/(.+)\.png$/i.exec(served))) cifRci.set(m[1].toUpperCase(), served);
    else if ((m = /^Fonts\/(FONT\d{4})-SDF\.(ttf|otf)$/i.exec(served))) fonts.set(`${m[1].toUpperCase()}.FNT`, served);
    else if ((m = /^([^/]+)\.png$/i.exec(served))) colours.set(m[1].toLowerCase(), served);
  }
  const index = Object.freeze({ img, cifRci, colours, fonts });
  _indexes.set(pack, index);
  return index;
}
/** The served URL of one of a pack's files. */
export const packUrl = (pack, served, root = APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/') =>
  new URL(`${pack.dir}/${served.split('/').map(encodeURIComponent).join('/')}`, root).href;

/** The worn pack's file for an IMG (`INVE00I0.IMG`), a CIF/RCI record (`BUTTONS.RCI`, record, frame), a save window
 *  colour texture (DFU's camelCase name) or a font (`FONT0003.FNT`) - its URL, or null when no pack is worn or the
 *  pack does not carry it (the classic art stands). */
export function packImgUrl(name, search) {
  const p = activeUiPack(search); if (!p) return null;
  const s = packIndex(p).img.get(String(name).toUpperCase());
  return s ? packUrl(p, s) : null;
}
export function packCifRciUrl(file, record, frame = 0, search) {
  const p = activeUiPack(search); if (!p) return null;
  const s = packIndex(p).cifRci.get(`${String(file).toUpperCase()}_${record}-${frame}`);
  return s ? packUrl(p, s) : null;
}
export function packColourUrl(name, search) {
  const p = activeUiPack(search); if (!p) return null;
  const s = packIndex(p).colours.get(String(name).toLowerCase());
  return s ? packUrl(p, s) : null;
}
export function packFontUrl(fnt, search) {
  const p = activeUiPack(search); if (!p) return null;
  const s = packIndex(p).fonts.get(`${String(fnt).toUpperCase().replace(/\.FNT$/, '')}.FNT`);   // 'FONT0003' or 'FONT0003.FNT'
  return s ? packUrl(p, s) : null;
}

/** The bytes of a URL (the fetch seam a test replaces). */
let _fetchBytes = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
};
export const packBytes = (url) => _fetchBytes(url);
export function _setPackFetchForTests(fn) { _fetchBytes = fn ?? (async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); }); }
