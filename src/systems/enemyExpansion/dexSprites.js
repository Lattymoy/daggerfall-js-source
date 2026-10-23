// DEX2 (2026-10-20; Mac, 2026-10-19: "I want to implement this as our next mod 1:1") - DAGGERFALL ENEMY EXPANSION 1.3.4 (Kamer &
// Kab), THE SPRITES ON THE TEXTURE DOOR.
//
// DFU draws a custom enemy from its archive's imported textures (TextureReplacement.GetMobileBillboardMaterial): every
// record from 0 until the first one missing, every frame of a record until the first one missing, an emission map
// beside a frame where the mod ships one, and the archive's xml scale on its size. The mod's pictures are in three
// places (vendor/daggerfall-enemy-expansion/README.md, Where the art is) and each registers here as the stand-in
// archive it is - no TEXTURE file carries 1500-1617:
//   - the authors' own renders, public/art/daggerfall-enemy-expansion/ (`own`);
//   - Daggerfall's sprites under the authors' paint, public/art/daggerfall-enemy-expansion-repainted/ (Port-Doctrine's
//     fourth exception, `repainted`);
//   - a picture that IS a classic record, rebuilt from the player's own files (vendor/.../derived.json, whatever its
//     archive's `from` says).
// Registered ALWAYS, as the rows are (dexInstall.js): a save with one of the fifty in it draws it whatever the switch.
// A stand-in's frames are the registry's (textureReplacement.js vendorFrameCount), its xml scale applies ungated
// (world/rmbFlats.js mobileBillboardSize), and a frame's emission map lights it (scenes/dataPipeline.js uploadRecordFrame).
// DFU's import is the index's (dexArt.js, tools/dexExtract.mjs): a record's frames from 0 to the first one missing (a
// picture past a gap ships and is never drawn), every archive's 0-0 there (a custom archive imports nothing without
// it), and a frame of an archive whose xml asks for emission lit by its own map, or by its albedo where it has none.

import { DEX_ART } from './dexArt.js';
import DERIVED from '../../../vendor/daggerfall-enemy-expansion/derived.json' with { type: 'json' };
import { addVendorTextures } from '../textureReplacement.js';
import { buildDerivedPicture } from '../../formats/derivedTexture.js';
import { registerBillboardXml } from '../../world/billboardXml.js';
import { APP_ROOT } from '../appRoot.js';

export const DEX_OWN_ART = 'art/daggerfall-enemy-expansion/';
export const DEX_REPAINTED_ART = 'art/daggerfall-enemy-expansion-repainted/';
const artUrl = (dir, name) => new URL(`${dir}${name}.png`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;
async function fetchPng(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`[DEX] ${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

/** Every picture the mod's tables draw, as texture-door entries: `{ archive, record, frame, map, standIn, readOnly, load | build }`.
 *  AUDIT DEX B5: `readOnly`, as DFU imports a mobile's pictures (GetMobileBillboardMaterial's LoadFromCacheOrImport(...,
 *  readOnly: true), TextureReplacement.cs:574, :609) - on the GPU alone once uploaded. The 5,500 shipped pictures are ~350 MB
 *  of RGBA, and every one an archive decoded stayed on the CPU for the session (the classic Barbarian's 1507 and 1508,
 *  86 MB, the first time one was met); the door lets each go as the upload takes it (systems/textureReplacement.js). */
export function dexSpriteEntries({ fetchBytes = fetchPng } = {}) {
  const out = [];
  for (const [a, art] of Object.entries(DEX_ART)) {
    const archive = Number(a), dir = art.from === 'repainted' ? DEX_REPAINTED_ART : DEX_OWN_ART;
    /** The picture `name` from its one place: rebuilt where derived.json names it, else the file. */
    const source = (name) => (DERIVED[name] ? { build: (ctx) => buildDerivedPicture(DERIVED[name], ctx.classicRgba) } : { load: () => fetchBytes(artUrl(dir, name)) });
    art.frames.forEach((n, record) => {   // as DFU imports them: frame 0 to the first one missing
      const maps = new Set(art.emissive?.[record] ?? []);
      for (let frame = 0; frame < n; frame++) {
        const name = `${archive}_${record}-${frame}`;
        out.push({ archive, record, frame, map: 'Albedo', standIn: true, readOnly: true, fileName: name, ...source(name) });
        // the emission: the frame's own map, or - the archive's xml asking for emission - its albedo, lit
        if (maps.has(frame)) out.push({ archive, record, frame, map: 'Emission', standIn: true, readOnly: true, fileName: `${name}_Emission`, ...source(`${name}_Emission`) });
        else if (art.emission) out.push({ archive, record, frame, map: 'Emission', standIn: true, readOnly: true, fileName: `${name}_Emission`, ...source(name) });
      }
    });
  }
  return out;
}

/** The archive xml's scale, by archive and record (TextureReplacement.SetBillboardScale). */
export function dexXmlScales() {
  const out = {};
  for (const [a, art] of Object.entries(DEX_ART)) if (art.scale) out[a] = art.scale;
  return out;
}

let _installed = false;
/** Once: the pictures on the texture door and the xml's scales in the billboard registry. Answers the entries added. */
export function installDexSprites(opts = {}) {
  if (_installed) return 0;
  _installed = true;
  registerBillboardXml('daggerfall-enemy-expansion', dexXmlScales());
  return addVendorTextures(dexSpriteEntries(opts));
}
/** The test seam: the next install registers again. */
export function _resetDexSprites() { _installed = false; }
