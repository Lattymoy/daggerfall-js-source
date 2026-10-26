// DEX2 (2026-10-20; Mac, 2026-10-19: "I want to implement this as our next mod 1:1") - DAGGERFALL ENEMY EXPANSION 1.3.4 (Kamer &
// Kab), THE SPRITES ON THE TEXTURE DOOR.
//
// DFU draws a custom enemy from its archive's imported textures (TextureReplacement.GetMobileBillboardMaterial): every
// record from 0 until the first one missing, every frame of a record until the first one missing, an emission map
// beside a frame where the mod ships one, and the archive's xml scale on its size. Each archive registers here as the
// stand-in it is - no TEXTURE file carries 1500-1708 - in the mod's own layout (dexArt.js frames) and from Bethesda's
// art alone, built from the player's own files and never carried:
//   - a picture that IS a classic record (vendor/.../derived.json: the five rider sets, the Will-o'-wisp);
//   - ARN3 (2026-10-26): where the authors' art was - their renders and their repaints, removed at their request -
//     a classic archive's copy (dexStandIns.js), and once the player's TES: Arena is read, Arena's own sprite for the
//     creatures it has (dexArena.js), in place of the copy.
// Registered ALWAYS, as the rows are (dexInstall.js): a save with one of the fifty in it draws it whatever the switch.
// A stand-in's frames are the registry's (textureReplacement.js vendorFrameCount), its xml scale applies ungated
// (world/rmbFlats.js mobileBillboardSize), and a frame's emission map lights it (scenes/dataPipeline.js uploadRecordFrame).
// DFU's import is the index's (dexArt.js, tools/dexExtract.mjs): a record's frames from 0 to the first one missing,
// every archive's 0-0 there (a custom archive imports nothing without it), and an emissive frame lit by its own map.

import { DEX_ART } from './dexArt.js';
import DERIVED from '../../../vendor/daggerfall-enemy-expansion/derived.json' with { type: 'json' };
import { addVendorTextures, removeVendorTextures, holdTextureTiers } from '../textureReplacement.js';
import { buildDerivedPicture } from '../../formats/derivedTexture.js';
import { registerBillboardXml } from '../../world/billboardXml.js';
import { DEX_STAND_INS, classicStandInEntries } from './dexStandIns.js';
import { registerDexArenaArt } from './dexArena.js';

/** ARN3: how long an archive's first load waits for the player's Arena to be read - a slow store costs Arena's
 *  sprites (the classic copies stand), never the world. */
export const ARENA_HOLD_MS = 5000;

/** Every picture the mod's tables draw, as texture-door entries: `{ archive, record, frame, map, standIn, readOnly, build }`.
 *  AUDIT DEX B5: `readOnly`, as DFU imports a mobile's pictures (GetMobileBillboardMaterial's LoadFromCacheOrImport(...,
 *  readOnly: true), TextureReplacement.cs:574, :609) - on the GPU alone once uploaded, its CPU copy let go as the
 *  upload takes it (systems/textureReplacement.js). */
export function dexSpriteEntries() {
  const out = [];
  for (const [a, art] of Object.entries(DEX_ART)) {
    const archive = Number(a), standIn = DEX_STAND_INS[archive];
    const copies = standIn ? classicStandInEntries(archive, art.frames) : [];
    const copied = new Set(copies.map((e) => `${e.record}-${e.frame}`));
    const replaced = new Set(copies.map((e) => e.record));
    out.push(...copies);
    art.frames.forEach((n, record) => {   // as DFU imports them: frame 0 to the first one missing
      if (replaced.has(record)) return;
      const maps = new Set(art.emissive?.[record] ?? []);
      for (let frame = 0; frame < n; frame++) {
        const name = `${archive}_${record}-${frame}`;
        if (copied.has(`${record}-${frame}`) || !DERIVED[name]) continue;
        const build = (from) => (ctx) => buildDerivedPicture(DERIVED[from], ctx.classicRgba);
        out.push({ archive, record, frame, map: 'Albedo', standIn: true, readOnly: true, fileName: name, build: build(name) });
        if (standIn) continue;   // ARN3: a stand-in's art carries no emission of the authors'
        // the emission: the frame's own map - the Will-o'-wisp's, TEXTURE.379's frames again. DFU's other arm, an
        // emissive archive's albedo lit where a frame has no map (1614.xml), was the Hell Hound's alone, and its art
        // was the authors' (ARN3)
        if (maps.has(frame) && DERIVED[`${name}_Emission`]) out.push({ archive, record, frame, map: 'Emission', standIn: true, readOnly: true, fileName: `${name}_Emission`, build: build(`${name}_Emission`) });
      }
    });
  }
  return out;
}

/** The archive xml's scale, by archive and record (TextureReplacement.SetBillboardScale) - ARN3: for the pictures it was
 *  written for: the derived ones, and the copies of the very sprites a repaint was painted over (`xml`). A copy of
 *  another creature stands at its own record's scale, and Arena's at its own (dexArena.js). */
export function dexXmlScales() {
  const out = {};
  for (const [a, art] of Object.entries(DEX_ART)) {
    const s = DEX_STAND_INS[a];
    if (art.scale && (!s || s.xml)) out[a] = art.scale;
  }
  return out;
}

/** The mod's record layouts, by archive - what the Arena half draws into. */
const dexLayouts = () => Object.fromEntries(Object.entries(DEX_ART).map(([a, art]) => [a, art.frames]));

let _installed = false;
/** Once: the pictures on the texture door and the xml's scales in the billboard registry; then (ARN3) the player's TES:
 *  Arena read and its sprites put in place of the classic copies, an archive's first load waiting for that a bounded
 *  while. Answers the entries added at once. */
export function installDexSprites({ arena = registerDexArenaArt } = {}) {
  if (_installed) return 0;
  _installed = true;
  registerBillboardXml('daggerfall-enemy-expansion', dexXmlScales());
  const n = addVendorTextures(dexSpriteEntries());
  const read = Promise.resolve()
    .then(() => arena({ layouts: dexLayouts(), add: addVendorTextures, remove: removeVendorTextures, xml: registerBillboardXml }))
    .catch((e) => { console.warn('[DEX] TES: Arena would not read - Daggerfall\'s sprites stand:', e?.message ?? e); return 0; });
  holdTextureTiers(read, ARENA_HOLD_MS);
  return n;
}
/** The test seam: the next install registers again. */
export function _resetDexSprites() { _installed = false; }
