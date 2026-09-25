// DS1 (2026-09-25, Mac: "All mods attached are to be compatible and
// implemented 1:1") - DETAILED SHIPS 1.0.0 (Cliffworms), the art half.
//
// The mod is world data and pictures, no code (its manifest lists no
// script). The world data - the two ships' building records, rebuilt from
// the player's own blocks - rides the world-data door
// (scenes/modWorldData.js, vendor/detailed-ships/WorldDataPatches). This
// module is the pictures: the thirteen sprites of the mod's two archives,
// 1210 and 1230, and the six xml files that scale five of them.
//
// DFU loads a mod's `Textures/<archive>_<record>-<frame>.png` for any
// billboard that asks for the record (TextureReplacement
// .GetStaticBillboardMaterial) and its `.xml` beside it for the scale; a
// record of an archive Daggerfall does not have exists only as the mod's
// picture. So here: every record registers as a stand-in of its archive,
// gated on the mod's switch. Nine of the thirteen are classic records (or
// classic records with the author's paint on them) and are rebuilt from
// the player's own TEXTURE files (formats/derivedTexture.js,
// `Textures/derived.json`); four are the author's own drawings and ship as
// PNGs.

import DERIVED from '../../vendor/detailed-ships/Textures/derived.json' with { type: 'json' };
import { addVendorTextures } from './textureReplacement.js';
import { registerBillboardXml } from '../world/billboardXml.js';
import { buildDerivedPicture } from '../formats/derivedTexture.js';
import { modSetting } from './modSettings.js';
import { installDetStandIns } from '../world/detStandIns.js';

export const DETAILED_SHIPS_VENDOR = 'detailed-ships';
export const detailedShipsOn = () => modSetting(DETAILED_SHIPS_VENDOR, 'Enabled') === true;

/** The pictures that are the author's own (no classic record is them), shipped as PNG. */
export const DETAILED_SHIPS_OWN_ART = Object.freeze(['1210_10-0', '1210_11-0', '1210_12-0', '1230_30-0']);
/** The pictures rebuilt from classic records, by name (the tool's own measurement). */
export const DETAILED_SHIPS_DERIVED = DERIVED;

/** The six xml files, `<info><scaleX>..</scaleX><scaleY>..</scaleY></info>`
 *  as vendor/detailed-ships/Textures carries them (test/ds1_detailedShips.test.js
 *  reads the files against this table). */
export const DETAILED_SHIPS_XML = Object.freeze({
  1210: Object.freeze({ 1: Object.freeze([0.5, 0.5]), 3: Object.freeze([0.75, 0.75]), 4: Object.freeze([0.5, 0.5]), 17: Object.freeze([0.5, 0.5]), 18: Object.freeze([0.75, 0.75]) }),
  1230: Object.freeze({ 30: Object.freeze([0.2, 0.2]) }),
});

export const detailedShipsArtUrl = (name) => new URL(`../../vendor/detailed-ships/Textures/${name}.png`, import.meta.url).href;
const parseName = (name) => { const m = /^(\d+)_(\d+)-(\d+)$/.exec(name); return { archive: Number(m[1]), record: Number(m[2]), frame: Number(m[3]) }; };

let _installed = false;
/** Once: the xml scales under the mod's switch, and all thirteen pictures on the texture door as stand-ins of
 *  archives 1210 and 1230 - the four drawings by fetch, the nine classic ones built from the player's records.
 *  `fetchBytes(name)` is the test seam. Returns the pictures registered. */
export function installDetailedShipsArt({ fetchBytes = null } = {}) {
  if (_installed) return 0;
  _installed = true;
  registerBillboardXml(DETAILED_SHIPS_VENDOR, DETAILED_SHIPS_XML, detailedShipsOn);
  const load = fetchBytes ?? (async (name) => { const r = await fetch(detailedShipsArtUrl(name)); if (!r.ok) throw new Error(`${name}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); });
  const own = DETAILED_SHIPS_OWN_ART.map((name) => ({ ...parseName(name), fileName: name, standIn: true, gate: detailedShipsOn, load }));
  const derived = Object.entries(DERIVED).map(([name, spec]) => ({
    ...parseName(name), fileName: name, standIn: true, gate: detailedShipsOn,
    build: (ctx) => buildDerivedPicture(spec, ctx.classicRgba),
  }));
  installDetStandIns(detailedShipsOn);   // the ten models and the flats it borrows from DET - the port's own stand-ins
  return addVendorTextures([...own, ...derived]);
}
/** Test seam. */
export function _resetDetailedShipsArt() { _installed = false; }
