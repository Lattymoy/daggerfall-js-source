// Shared lazy data pipeline (P7): the streaming world's texture/mesh
// caches, lifted verbatim so any scene that hosts transitions (world,
// exterior) can lazy-load models and archives it never preloaded -
// interiors and dungeons reference meshes outside the host's own set.
// Caches are per-scene. FIELD BUGS 2026-10-04d PLACE-LRU: what a place
// asks for through its hold (`holdPlace`) is freed once no standing or
// kept place holds it (scenes/placeHolds.js); what is asked for outside
// any place is kept for good, as everything once was.

import { TextureFile } from '../formats/textureFile.js'; import { changeMask } from '../formats/baseImageFile.js';   // HM1: the item icons' removeMask (one line: the cites below stand)
import { FlatsFile } from '../formats/flatsFile.js';   // NPC1: captions + portrait indices
import { isExteriorWindow } from '../world/climateSwaps.js';
import { isEmissive, FIRE_WALLS_ARCHIVE } from '../world/emissiveTextures.js';   // TextureReader's auto-emissive table (lit lanterns, fireplaces, fire daedra)
import { dfMeshToModel } from '../world/meshReader.js'; import { patchSeams } from '../world/arch3dSeams.js';   // DUNGEON-SEAMS (one line: the cites below stand)
import { fetchBytes, texName } from './shared.js';
import { decodedTexture, preloadTextureArchive, isVendorArchive, vendorTextureStandIn, setTextureDeriveContext, textureTierEpoch } from '../systems/textureReplacement.js';   // M-TEX: user-supplied textures override the classic ones; AUDIT VE R1: the tiers' epoch
import { classicRecordRgba } from '../formats/derivedTexture.js';   // WD2: a mod sprite rebuilt from the player's own record
import { customModelBuilt, customAliasFor, aliasSubMeshes, customModelNeeds } from '../world/customModels.js';   // DS1: models no ARCH3D carries; WD3: a classic model with its pictures swapped
import { dyeToken, changeDyeBitmap } from '../characters/dyes.js';   // DW3: the per-dye UI variant; DYE-ICON: and the classic arm's ChangeDye
import { ROTOR, MACHINERY, MACHINERY_MODEL_ID, MACHINERY_CHILDREN, PLANK_GEAR, ROLLER } from '../world/windmillMesh.js';   // WM2b/WM2d/WM4b: the vendored mill and its machinery, uploaded like any other model
import { skinnedBody } from '../world/windmills.js';   // WM2e: its walls and roof follow the climate
import { flatFaceOverride } from '../characters/staticNpc.js';   // RR2: FLATS.CFG's dictionary, as a mod rewrites it
import { createPlaceHolds } from './placeHolds.js';   // FIELD BUGS 2026-10-04d PLACE-LRU

/** ROAD-H H4: `fetch` defaults to the one data seam every scene uses
 *  (shared.js's fetchBytes) and is a parameter for the same reason
 *  `loadMagicRegistries` and `ensureAudio` take one - so a pin can drive
 *  the upload arms over a texture it built itself, in a container with
 *  no ARENA2. No host passes it.
 *  @param deps {{renderer, arch: Arch3dFile, palette: DFPalette, fetch?: (name: string) => Promise<Uint8Array>}} */
/** DS1: TEXTURE.511 is the last archive Daggerfall ships; a higher number is a mod's own. */
export const LAST_CLASSIC_TEXTURE_ARCHIVE = 511;

export function createDataPipeline({ renderer, arch, palette, fetch = fetchBytes }) {
  const textureFiles = new Map();
  const texturePromises = new Map();

  // NPC1: FLATS.CFG, warmed once and shared. It answers two questions
  // about any billboard in the world - what the flat is CALLED (the
  // quest macro =symbol_ resolves through `flatCaption`, a seam the
  // quest machine declared with no production provider until now) and
  // which TFAC00I0.RCI face belongs to it, which is the portrait the
  // talk window draws. NEVER TRAPS: a missing or malformed CFG costs
  // captions and portraits, not the scene.
  let flats = null;
  let flatsPromise = null;
  const loadFlats = () => (flatsPromise ??= (async () => {
    try {
      flats = new FlatsFile().load(await fetch('FLATS.CFG'), 'FLATS.CFG');
    } catch (e) {
      console.warn('[flats] FLATS.CFG unavailable; flats keep no caption and people no portrait', e);
      flats = new FlatsFile();
    }
    return flats;
  })());
  const flatCaption = (archive, record) => flats?.caption(archive, record) ?? null;
  const flatFaceIndex = (archive, record) => flatFaceOverride(archive, record) ?? flats?.faceIndex(archive, record) ?? -1;   // RR2: a mod's flatsDict write first
  // AUDIT VE R1: AN ARCHIVE'S PICTURES ARE CURRENT WITH THE TEXTURE TIERS IT WAS PRELOADED UNDER. The scene caches an
  // archive once, and its replacements were decoded once with it - so a texture mod switched on mid-game never reached
  // an archive the scene already held, and every picture drawn from it after the switch stood classic for the page. The
  // archive's epoch is kept beside it (systems/textureReplacement.js textureTierEpoch); the next ask after a change
  // decodes what answers now - only the pictures that changed - before it answers.
  const preloadedAt = new Map();   // archive -> the texture tiers' epoch its pictures were decoded at
  const refreshing = new Map();    // archive -> its pictures being decoded again, after a change
  const refresh = (archive) => {
    if (!refreshing.has(archive)) {
      const epoch = textureTierEpoch();   // read before the decode: a change while it runs is asked again
      refreshing.set(archive, preloadTextureArchive(archive).catch(() => {})
        .then(() => { preloadedAt.set(archive, epoch); refreshing.delete(archive); }));
    }
    return refreshing.get(archive);
  };
  /** AUDIT VE R1: a synchronous upload of an archive behind the tiers starts its pictures' refresh - the records it
   *  uploads after that find them (what it uploads now stands as it is, as anything already drawn does). */
  const freshen = (archive) => { if (preloadedAt.get(archive) !== textureTierEpoch()) refresh(archive); };
  async function getTexture(archive) {
    if (textureFiles.has(archive)) {
      if (preloadedAt.get(archive) !== textureTierEpoch()) await refresh(archive);   // AUDIT VE R1
      return textureFiles.get(archive);
    }
    if (!texturePromises.has(archive)) {
      texturePromises.set(archive, (async () => {
        // SURV2: an archive that exists only as the port's vendored art
        // (a mod's item icons, 532-539) has no TEXTURE file to fetch -
        // decode the PNGs and stand a sized shell in for the file, and
        // the swap arm below draws them.
        if (isVendorArchive(archive)) {
          const epoch = textureTierEpoch();   // AUDIT VE R1
          await preloadTextureArchive(archive).catch(() => {});
          preloadedAt.set(archive, epoch);
          const v = vendorTextureStandIn(archive);
          textureFiles.set(archive, v);
          return v;
        }
        // DS1: an archive past Daggerfall's last TEXTURE file (TEXTURE.511)
        // is a MOD's - a world-data block may name one whose pictures no
        // loaded mod supplies. DFU's MaterialReader then answers no material
        // and the billboard stands invisible (a logged miss, never a thrown
        // scene); the port stands an empty shell in (recordCount 0, which
        // every upload door already gates on) and says so once. A classic
        // archive that will not load is still the player's missing data and
        // still throws.
        let bytes;
        try {
          bytes = await fetch(texName(archive));
        } catch (e) {
          if (archive <= LAST_CLASSIC_TEXTURE_ARCHIVE) throw e;
          console.warn(`[texture] ${texName(archive)}: no such archive and no mod picture for it - its billboards stand invisible, as in DFU`);
          const v = vendorTextureStandIn(archive);
          textureFiles.set(archive, v);
          return v;
        }
        const t = new TextureFile();
        t.load(bytes, texName(archive), palette);
        // M-TEX: the replacement PNGs for this archive decode HERE,
        // where there is already an await and the result is already
        // cached per archive. uploadRecord is synchronous and runs off
        // the draw path, so a texture that arrived late would be a
        // visible pop or a missing wall - by the time anything uploads
        // a record its replacement is decoded and waiting, or genuinely
        // absent. Never throws: one bad PNG costs that texture.
        const epoch = textureTierEpoch();   // AUDIT VE R1
        await preloadTextureArchive(archive).catch(() => {});
        preloadedAt.set(archive, epoch);
        textureFiles.set(archive, t);
        return t;
      })());
    }
    return texturePromises.get(archive);
  }
  // WD2: a vendored sprite that IS a classic record (or one with the author's
  // paint on it) is built from THIS pipeline's own archives - the player's
  // ARENA2, the palette the host loaded - never shipped (formats/derivedTexture.js).
  setTextureDeriveContext({
    classicRgba: async (archive, record, frame = 0) => {
      const t = await getTexture(archive);
      if (!t || t.vendor) return null;
      const bm = t.getDFBitmap(record, frame);
      return bm?.width ? classicRecordRgba(bm, palette) : null;
    },
    /** DS1: the record's own scale (TextureFile.getScale) - what a stand-in for a classic sprite is sized by. */
    classicScale: async (archive, record) => {
      const t = await getTexture(archive);
      return !t || t.vendor ? null : t.getScale(record);
    },
  });
  // AUDIT GN2-PF5: THE ARCHIVES WHOSE STAND-INS ARE CLASSIC ART - the port's own pictures standing where a TEXTURE file
  // would (the new galleon's 38131: a hull's planking, as ARENA2's is every other hull's), uploaded as a classic record
  // is, so Retro Mode's no-mip cap reaches them. Every other stand-in is a mod's picture, TryImportTexture's, never
  // capped. Marked by whoever registers them (scenes/comeSailAwayPool.js); a pack's picture over one is taken as its own.
  const classicArt = new Set();
  const markClassicArt = (archive) => { classicArt.add(Number(archive)); };
  const isClassicArt = (archive) => classicArt.has(Number(archive));
  const getTextureSize = (archive, record) => {
    const t = textureFiles.get(archive);
    return { width: t.getWidth(record), height: t.getHeight(record) };
  };
  const _standInMisses = new Set();   // WD3: the stand-in records said once each
  const uploadRecord = (archive, record, { opaque = false, mips, removeMask = false, dye = null, dyeTarget = null } = {}) => {   // DYE-ICON: `dyeTarget` - the swatch the classic arm dyes (itemDye.js itemDyeTarget)   // DW3: `dye` - GetItemImage asks the replacement by the item's dye (ItemHelper.cs:458); the icon uploads under a per-dye variant and answers which   // REVIEW 2026-09-05: `mips: false` for item icons (ImageReader.cs:59 builds UI art with no chain); HM1: `removeMask` = ItemHelper's GetItemImage(removeMask: true), the item icons' door - 0xFF becomes the cutout before the upload
    const t = textureFiles.get(archive); freshen(archive);   // AUDIT VE R1
    const bitmap = t.getDFBitmap(record, 0);
    // Spectral archives (ghost/wraith/Lysandus) take the verbatim
    // TextureReader path: SetSpectral gray remap + eye patch, albedo
    // at 180 alpha (~70% visible), and the V^1.9 emission map with
    // red eyes. Classic-visuals direction (Mac): the billboards ARE
    // the spectral enemies - this closes Rendering's last queue row.
    if (TextureFile.isSpectralArchive(archive)) {
      const spec = { ...bitmap, data: bitmap.data.slice() };   // never mutate the cached bitmap
      t.setSpectral(spec);
      const albedo = t.getColor32(spec, 0, 0, TextureFile.SPECTRAL_EYES_PATCHED, TextureFile.SPECTRAL_ALPHA);
      renderer.uploadTexture(archive, record, albedo);
      renderer.uploadEmissionTexture(archive, record,
        t.getSpectralEmissionColors32(spec, albedo, 0, TextureFile.SPECTRAL_EYES_PATCHED, [255, 0, 0], [0, 0, 0]));
      return;
    }
    // M-TEX: a user-supplied texture overrides the classic one, the
    // same override-or-fall-back shape the music path uses. Deliberately
    // BELOW the spectral arm: that path builds its albedo AND an
    // emission mask together from one remap, and replacing half of it
    // would leave a ghost lit by a texture it no longer wears.
    // DW3: with a dye, the ask is the DYED name and that alone - DFU's
    // TryImportTexture(archive, record, 0, item.dyeColor) has no bare
    // fallback (GetName :729-730 appends the dye; a bare file answers a
    // bare ask, which is a dye of Unchanged). A dyed swap is uploaded
    // under its own UI variant, so an Iron dagger and a Daedric one are
    // two textures; an undyed classic upload keeps the shared `#ui` key.
    const token = dyeToken(dye);
    const swap = decodedTexture(archive, record, 0, 'Albedo', dye);
    // DYE-ICON: GetItemImage's CLASSIC arm (ItemHelper.cs:466-477) - no
    // replacement answered, so the picture is the archive's own, its
    // mask stripped and then CHANGEDYE'D: a weapon's or a piece of
    // armour's metal swatch, a garment's cloth one, by the item's dye.
    // The port drew the base swatch whatever the metal, so a Daedric
    // dagger in the pack and hung on a wall was the plain one (Mac, the
    // house: "others are daedric but show steel"). 18 is dyed too - it is
    // Silver's table on a metal (dyes.js changeDyeBitmap), though its
    // name is never printed. A dyed picture keys apart under its own UI
    // variant, by dye and swatch, never a replacement's `#ui_<Dye>`: the
    // first upload of a key is every later asker's (renderer.js), and a
    // replacement decoded after a classic dyed upload must still land.
    const dyed = mips === false && !swap && dyeTarget != null && dye != null && dye !== '';
    const variant = mips === false ? (swap && token ? `#ui_${token}` : dyed ? `#ui_dye${dye}_${dyeTarget}` : '#ui') : undefined;
    // INCIDENT (2026-09-04, the see-through lines in dungeon walls): a
    // MODEL texture is opaque. DaggerfallMesh.cs:141/:169 fetch a mesh's
    // material through MaterialReader.GetMaterial(archive, record) whose
    // alphaIndex defaults to -1 (MaterialReader.cs:352) - no cutout
    // index at all - and DaggerfallDefault.shader never clips. Only the
    // billboard path (GetMaterialAtlas / GetMaterial(..., 0)) makes
    // palette index 0 transparent. This one door served both, so every
    // index-0 mortar run in a wall texture became a slit the model
    // shader discarded, and the room behind it showed through.
    // WD3: A RECORD ITS STAND-IN ARCHIVE HAS NO PICTURE FOR. A mod-only archive answers every record under its highest
    // (`recordCount`), and the town mods place records between the ones a mod supplies (1230_2, 1210_13 - none of their
    // peers' pictures is carried): the stand-in's getColor32 has nothing, and a null upload threw the whole interior. DFU
    // finds no material and the billboard draws nothing (MaterialReader answers null); here a clear pixel stands for it
    // - its batch draws nothing - and the miss is said once, by name.
    if (!swap && t.vendor) {
      if (!_standInMisses.has(`${archive}_${record}`)) { _standInMisses.add(`${archive}_${record}`); console.warn(`[texture] ${archive}_${record}: no mod picture and no stand-in - nothing drawn, as in DFU`); }
      renderer.uploadTexture(archive, record, { width: 1, height: 1, colors: new Uint8ClampedArray(4) }, variant !== undefined ? { opaque, mips, variant, replacement: true, placeholder: true } : { opaque, mips, replacement: true, placeholder: true });   // AUDIT WD3 T3: a picture that lands later takes its place
      return variant;
    }
    const masked = swap ? null : removeMask ? changeMask(bitmap) : bitmap;   // HM1: a clone - the cached record keeps its mask for the doll
    const color32 = swap ?? t.getColor32(dyed ? changeDyeBitmap(masked, dye, dyeTarget) : masked, opaque ? -1 : 0);   // DYE-ICON: the mask first, then the dye (:467-474)
    // AUDIT RETRO1 A4: a replacement is flagged - TextureReader's retro arm (no mip chain) never reaches TryImportTexture's.
    // AUDIT GN2-PF5: a stand-in the port paints as a hull's classic art (markClassicArt) is no replacement
    const replacement = !!swap && !classicArt.has(Number(archive));
    renderer.uploadTexture(archive, record, color32, variant !== undefined ? { opaque, mips, variant, replacement } : { opaque, mips, replacement });
    // Exterior windows also get their emission mask (R2, MaterialReader
    // semantics: glass texels glow with the active window style).
    // DS1: a stand-in (a mod-only archive) has no classic bitmap to cut a
    // window mask from - and IsExteriorWindow's `archive % 100` reads 1210's
    // record 3 as a window. A mod picture's billboard material carries no
    // window emission in DFU (GetStaticBillboardMaterial), so it gets none.
    if (isExteriorWindow(archive, record) && !t.vendor) {
      renderer.uploadEmissionTexture(archive, record, t.getWindowColors32(bitmap), { replacement });
    } else if (isEmissive(archive, record) && archive !== FIRE_WALLS_ARCHIVE) {
      // AUDIT 39 F49: THE AUTO-EMISSIVE ARM (MaterialReader.cs:419-423
      // -> TextureReader.cs:301-308 "Just reuse albedo map for basic
      // colour emission" -> :448-453 EmissionColor = Color.white). The
      // `!isWindow` is the C#'s own; the white flag keeps the window
      // style off it, so a lit lantern draws its own texels instead of
      // sitting at scene ambient beside the light it casts.
      renderer.uploadEmissionTexture(archive, record, color32, { white: true, replacement });
    }
    return variant;   // DW3: the icon drawers read the GL texture by `${archive}_${record}${variant}`
  };
  // C11 mobile monsters: per-FRAME uploads under a composite record
  // key (`${record}#${frame}` - the renderer keys textures by
  // template string, so a batch whose .record is the composite draws
  // the frame). Spectral archives (ghost/wraith) keep their verbatim
  // TextureReader treatment per frame.
  const uploadRecordFrame = (archive, record, frame) => {
    const key = `${record}#${frame}`;
    const t = textureFiles.get(archive); freshen(archive);   // AUDIT VE R1
    if (!t) return;
    const bitmap = t.getDFBitmap(record, frame);
    if (TextureFile.isSpectralArchive(archive)) {
      const spec = { ...bitmap, data: bitmap.data.slice() };
      t.setSpectral(spec);
      const albedo = t.getColor32(spec, 0, 0, TextureFile.SPECTRAL_EYES_PATCHED, TextureFile.SPECTRAL_ALPHA);
      renderer.uploadTexture(archive, key, albedo);
      renderer.uploadEmissionTexture(archive, key,
        t.getSpectralEmissionColors32(spec, albedo, 0, TextureFile.SPECTRAL_EYES_PATCHED, [255, 0, 0], [0, 0, 0]));
      return;
    }
    // M-TEX: the per-FRAME override. DFU imports animated flats frame
    // by frame too, so the frame is part of the lookup key rather than
    // a whole-record swap - replacing frame 0 of a torch and nothing
    // else leaves the remaining frames classic, which is what a
    // partial pack should do.
    const swapFrame = decodedTexture(archive, record, frame);
    const color32 = swapFrame ?? t.getColor32(bitmap, 0);
    const replacement = !!swapFrame;   // AUDIT RETRO1 A4 (second pass F2): a pack's frame is TryImportTexture's too
    renderer.uploadTexture(archive, key, color32, { replacement });
    // F49: the auto-emissive arm follows the FRAME - DFU builds a
    // material per frame, and a torch's every frame is self-lit. The
    // billboard path looks the mask up under this same composite key.
    if (isEmissive(archive, record) && archive !== FIRE_WALLS_ARCHIVE) {
      renderer.uploadEmissionTexture(archive, key, color32, { white: true, replacement });
    }
  };
  const gpuMeshes = new Map(); // shared across pixels and places; freed when no place holds one (PLACE-LRU, below)
  const meshPromises = new Map(); // IN-FLIGHT builds, getTexture's shape
  const cpuModels = new Map(); // id -> {positions, indices} for the collider
  // FIELD BUGS 2026-10-04d PLACE-LRU: THE PLACES' HOLD ON THESE CACHES (scenes/placeHolds.js). `gpuMeshes`, the
  // renderer's pictures and its tile arrays kept every model, picture and ground a session had met - a town's
  // buildings, a climate's walls, a dungeon's blocks and its foes' frames - on the GPU for good. A place now holds what
  // it asks for through its hold (`holdPlace`), a model holds the pictures its build uploaded, and what nobody holds and
  // nothing pinned is freed here: the model's VAO and buffers with its CPU copy, a picture, an emission map, a tile
  // array. An evicted model is made INERT - its VAO handle gone - so a holder that outlived its place draws nothing
  // rather than binding a deleted VAO over another's buffers.
  const holds = createPlaceHolds({
    free: {
      mesh: (key) => {
        const gpu = gpuMeshes.get(key);
        if (!gpu) return false;   // still building (it comes loose again as it lands), or a model this data set lacks
        gpuMeshes.delete(key);
        cpuModels.delete(key);
        renderer.destroyMesh?.(gpu);
        gpu.vao = null;
        return true;
      },
      tex: (k) => (k[0] === 'e' ? renderer.evictEmissionTexture?.(k.slice(2)) : renderer.evictTexture?.(k.slice(2))),
      tile: (archive) => renderer.releaseTileArray?.(archive),
    },
  });
  /** PLACE-LRU: run `fn` (an upload door - synchronous) and hear every key the renderer's two upload doors named in
   *  it, hit or miss: `t:` a picture, `e:` an emission map. */
  function uploadsOf(fn) {
    const keys = [], outer = renderer._uploadSink;
    renderer._uploadSink = (emission, key) => { keys.push(`${emission ? 'e' : 't'}:${key}`); outer?.(emission, key); };
    try { return { value: fn(), keys }; } finally { renderer._uploadSink = outer; }
  }
  /** PLACE-LRU: how a picture a place held is made again - its door's own arguments - for the draw's miss door
   *  (renderer._textureMissed): a foe outdoors drawing a frame a dungeon uploaded, after the dungeon was dropped. One
   *  remake a key; the remade picture is pinned (whoever drew it holds it through no place). */
  const remakes = new Map();   // 't:' key -> [archive, record, opts, frame]
  const learnRemake = (keys, recipe) => { for (const k of keys) if (k[0] === 't') remakes.set(k, recipe); };
  const missedBefore = renderer.textureMiss;
  renderer.textureMiss = (key) => {
    const r = remakes.get(`t:${key}`);
    if (r) {
      remakes.delete(`t:${key}`);
      try {
        const { keys } = uploadsOf(() => (r[3] === undefined ? uploadRecord(r[0], r[1], r[2]) : uploadRecordFrame(r[0], r[1], r[3])));
        for (const k of keys) holds.pin('tex', k);
      } catch (e) { console.warn(`[place-lru] ${key} could not be made again:`, e?.message ?? e); }
      const tex = renderer.textures?.get?.(key);
      if (tex) return tex;
    }
    return missedBefore ? missedBefore(key) : null;
  };
  /** PLACE-LRU: a model's own picture for one sub-mesh - its material, uploaded by `upload` - heard as it goes up,
   *  into `pictures`, which the model holds (holds.meshBuilt) for as long as it stands. */
  const meshPicture = (pictures, sm, upload) => {
    const heard = uploadsOf(upload).keys;
    learnRemake(heard, [sm.textureArchive, sm.textureRecord, { opaque: true }]);
    pictures.push(...heard);
  };
  /** AUDIT 39: the COMPLETED cache is not enough on its own. A build
   *  awaits its texture archives, and two cold callers for one model id
   *  - a teleport's buildPixel racing the pump's, two adjacent pixels
   *  sharing a building - each ran createMesh and the second `set`
   *  overwrote the first, leaking a VAO and its buffers for the
   *  session (an entry is destroyed only once no place holds it - PLACE-LRU). The in-flight map is
   *  the law getTexture above and buildPixel already carry.
   *  AUDIT 68 S18-uploadpart-no-inflight: ONE door for every mesh key -
   *  the mill's body, sail and machinery parts (uploadPart) kept a
   *  completed-only copy of this cache, and two cold mill builds each
   *  minted the mesh. */
  async function cachedMesh(key, build) {
    if (gpuMeshes.has(key)) return gpuMeshes.get(key);
    if (!meshPromises.has(key)) {
      meshPromises.set(key, build().finally(() => meshPromises.delete(key)));
    }
    return meshPromises.get(key);
  }
  // AUDIT PRE-MERGE 1003 W6: `breathe` - the caller's breather (scenes/world.js, a streamed pixel's), handed to a custom
  // model whose build can breathe (world/customModels.js customModelBuilt: the colosseum's seal); the first caller's, as
  // the in-flight build is
  const getGpuMesh = (modelIdNum, breathe = null) => cachedMesh(modelIdNum, () => buildGpuMesh(modelIdNum, breathe));
  async function buildGpuMesh(modelIdNum, breathe = null) {
    // WM4b: MESH REPLACEMENT, the way DFU's MeshReplacement.TryImport-
    // GameObject runs BEFORE the classic mesh is read (MeshAssetImporter
    // is asked first; ARCH3D only when it has nothing). Model 41601 is
    // Kamer's machinery, the centrepiece of the room his mill adds, and
    // no ARCH3D carries it - so it answers from the vendored bake and
    // then is an ordinary model: cached on the same map under its own
    // id, textures out of the player's ARENA2, a CPU copy for the
    // collider, no doors of its own.
    if (modelIdNum === MACHINERY_MODEL_ID) {
      const gpu = await uploadModel(modelIdNum, MACHINERY);   // already inside getGpuMesh's in-flight entry
      cpuModels.set(modelIdNum, { modelIdNum, positions: MACHINERY.positions, indices: MACHINERY.indices, subMeshes: MACHINERY.subMeshes, doors: [] });
      return gpu;
    }
    // DS1: the registry's models (world/customModels.js) - asked before ARCH3D, as MeshReplacement is
    // ARENA1: a model built over classic pieces (the colosseum's undercroft) reads them out of the player's ARCH3D -
    // their pictures loaded first, so dfMeshToModel sizes their uvs as the pieces' own build would
    for (const id of customModelNeeds(modelIdNum)) {
      const i = arch.getRecordIndex(id);
      if (i !== -1) for (const sm of arch.getMesh(i).subMeshes) await getTexture(sm.textureArchive);
    }
    const custom = await customModelBuilt(modelIdNum, { classicModel: classicModelOf }, breathe);   // AUDIT PRE-MERGE 1003 W6: a breath at a time where it can
    if (custom) {
      const gpu = await uploadModel(modelIdNum, custom);
      cpuModels.set(modelIdNum, { modelIdNum, positions: custom.positions, indices: custom.indices, subMeshes: custom.subMeshes, doors: custom.doors ?? [], normals: custom.normals, uvs: custom.uvs });
      return gpu;
    }
    // WD3: an ALIAS - a classic model read out of the player's ARCH3D with some of its pictures swapped
    // (world/customModels.js registerModelAlias; the town mods' coloured beds)
    const alias = customAliasFor(modelIdNum);
    if (alias) return buildAliasMesh(modelIdNum, alias);
    const index = arch.getRecordIndex(modelIdNum);
    if (index === -1) {
      gpuMeshes.set(modelIdNum, null);
      return null;
    }
    const dfMesh = patchSeams(modelIdNum, arch.getMesh(index));   // DUNGEON-SEAMS: the holes in Daggerfall's own stairs and ceilings closed - on a copy, the archive's mesh is shared
    for (const sm of dfMesh.subMeshes) await getTexture(sm.textureArchive);
    const model = dfMeshToModel(dfMesh, getTextureSize);
    const pictures = [];   // PLACE-LRU: what this model's build put up, the model's to hold
    for (const sm of model.subMeshes) meshPicture(pictures, sm, () => uploadRecord(sm.textureArchive, sm.textureRecord, { opaque: true }));   // a mesh material: alphaIndex -1
    const gpu = renderer.createMesh(model);
    // WORLD-HOVER: the record carries its OWN id. The map was keyed by it
    // and the value did not know it, so anything handed a cpu record - the
    // action system's five constructors among them - could not say WHICH
    // model it held, and a namer had to be handed the id a second time from
    // whichever caller happened to still have it. The model knows.
    cpuModels.set(modelIdNum, { modelIdNum, positions: model.positions, indices: model.indices, subMeshes: model.subMeshes, doors: model.doors, normals: model.normals, uvs: model.uvs });   // PERF4: the static batch merges the whole vertex
    gpuMeshes.set(modelIdNum, gpu);
    holds.meshBuilt(modelIdNum, pictures);   // PLACE-LRU
    return gpu;
  }
  /** ARENA1: a classic model as dfMeshToModel mints it (no seam patched - a copy of it in a custom model is the
   *  ARCH3D record's own), or null; its pictures must be loaded (customModelNeeds). */
  function classicModelOf(id) {
    const i = arch.getRecordIndex(id);
    return i === -1 ? null : dfMeshToModel(arch.getMesh(i), getTextureSize);
  }
  /** WD3: an alias's mesh - its classic model's geometry and UVs (sized by the classic pictures, which a swapped
   *  picture keeps), the swap laid on, then an ordinary model under the alias's own id. No classic model, no mesh. */
  async function buildAliasMesh(modelIdNum, alias) {
    const index = arch.getRecordIndex(alias.model);
    if (index === -1) { gpuMeshes.set(modelIdNum, null); return null; }
    const dfMesh = patchSeams(alias.model, arch.getMesh(index));
    for (const sm of dfMesh.subMeshes) await getTexture(sm.textureArchive);
    const classic = dfMeshToModel(dfMesh, getTextureSize);
    const model = { ...classic, subMeshes: aliasSubMeshes(classic.subMeshes, alias.remap) };
    const gpu = await uploadModel(modelIdNum, model);
    cpuModels.set(modelIdNum, { modelIdNum, positions: model.positions, indices: model.indices, subMeshes: model.subMeshes, doors: model.doors, normals: model.normals, uvs: model.uvs });
    return gpu;
  }
  /** WM2b: THE WINDMILL ROTOR, uploaded once per scene.
   *
   *  Not an ARCH3D record, so it cannot come through getGpuMesh - the
   *  geometry is Kamer's, vendored with permission and baked by
   *  scripts/bakeWindmill.mjs (see vendor/windmills-kamer/README.md).
   *  Everything else about it is ordinary: its submeshes name CLASSIC
   *  (archive, record) pairs, so its textures load and upload through
   *  exactly the same two calls every other model's do, out of the
   *  player's own ARENA2.
   *
   *  Cached on the same map as the rest under a key no ARCH3D record can
   *  collide with (ids are positive), so a host may ask per block
   *  without paying twice, and teardown frees it with everything else.
   */
  // Negative keys: no ARCH3D record id can collide with them. The body
  // is cached PER CLIMATE AND SEASON, because WM2e skins its walls and
  // roof from Kamer's own variant prefabs and a streamed world crosses
  // climates - one mesh per skin, however many mills wear it.
  const ROTOR_KEY = -41600;
  const bodyKey = (climateBase, isWinter) => -(50000 + climateBase * 2 + (isWinter ? 1 : 0));
  // PLACE-LRU: a mill's parts are the host's for the scene (world.js keeps the first mill's for every sail) - pinned
  const uploadPart = (key, model) => { holds.pin('mesh', key); return cachedMesh(key, () => uploadModel(key, model)); };
  async function uploadModel(key, model) {
    for (const sm of model.subMeshes) await getTexture(sm.textureArchive);
    // PLACE-LRU: the uploads, the mesh and its holds in ONE synchronous run, as buildGpuMesh's - a sweep between two
    // of them could free a picture the model was about to hold
    const pictures = [];
    for (const sm of model.subMeshes) meshPicture(pictures, sm, () => uploadRecord(sm.textureArchive, sm.textureRecord, { opaque: true }));
    const gpu = renderer.createMesh(model);
    gpuMeshes.set(key, gpu);
    holds.meshBuilt(key, pictures);   // PLACE-LRU
    return gpu;
  }

  /** WM2d: the whole mill - the tower Daggerfall never stands, and the
   *  sail that turns on it. Both parts, one call, so a host cannot wire
   *  a rotor to a tower that was never uploaded.
   *
   *  WM2e: the tower is skinned for the climate and season it stands in,
   *  from Kamer's own seventeen variant prefabs. The SAIL is not - it is
   *  067_1 in every one of them. */
  async function getWindmillMeshes(climateBase = 300, isWinter = false) {
    return {
      body: await uploadPart(bodyKey(climateBase, isWinter), skinnedBody(climateBase, isWinter)),
      rotor: await uploadPart(ROTOR_KEY, ROTOR),
    };
  }

  /** WM4b: THE MACHINERY'S MOVING PARTS - Plank_Gear and Roller, the
   *  two children of Kamer's 41601 prefab, each its own mesh under its
   *  own transform (windmillMesh.MACHINERY_CHILDREN). Uploaded once per
   *  scene under negative keys like the sail, with a CPU copy alongside
   *  for the part the prefab gives a collider. */
  const CHILD_MESHES = { PLANK_GEAR, ROLLER };
  async function getMachineryParts() {
    const parts = [];
    for (let i = 0; i < MACHINERY_CHILDREN.length; i++) {
      const child = MACHINERY_CHILDREN[i];
      const model = CHILD_MESHES[child.mesh];
      if (!model) throw new Error(`machinery child ${child.name} names mesh ${child.mesh}, which the bake did not emit`);
      parts.push({
        child,
        gpu: await uploadPart(-(MACHINERY_MODEL_ID * 10 + i + 1), model),
        cpu: { positions: model.positions, indices: model.indices, subMeshes: model.subMeshes, doors: [] },
      });
    }
    return parts;
  }

  // FIELD BUGS 2026-10-04d PLACE-LRU: THE TWO KINDS OF ASKER. The doors every host was handed stay the doors it was
  // handed, and what they get is PINNED - kept for good, as everything was: the UI's pictures, the foes' frames
  // outdoors, the arrows and the wagon, a fixed city's models. A place's build asks through its HOLD instead
  // (`holdPlace`), and what it gets is held while it stands and while it is kept, and freed after.
  const pinnedUpload = (archive, record, opts) => {
    const { value, keys } = uploadsOf(() => uploadRecord(archive, record, opts));
    for (const k of keys) holds.pin('tex', k);
    return value;   // DW3: the icon's variant, as uploadRecord answers it
  };
  const pinnedUploadFrame = (archive, record, frame) => {
    const { keys } = uploadsOf(() => uploadRecordFrame(archive, record, frame));
    for (const k of keys) holds.pin('tex', k);
  };
  const pinnedGpuMesh = (modelIdNum, breathe = null) => { holds.pin('mesh', modelIdNum); return getGpuMesh(modelIdNum, breathe); };
  /** PLACE-LRU: A PLACE'S HOLD - a streamed pixel's (scenes/world.js buildPixelNow), a building's or a dungeon's
   *  (scenes/worldModes.js). The three doors a build asks through, each holding what it gets for the place - a model
   *  before its build is awaited, a picture as it goes up - and the place's two moments: `release()` as it goes (kept
   *  a while, then dropped) and `settle()` once it stands again (its last visit's keep dropped). `tileArray(archive)`
   *  holds a ground archive's tile array, which the world host uploads itself. */
  function holdPlace(kind, key) {
    const h = holds.place(kind, key);
    return {
      getGpuMesh: (modelIdNum, breathe = null) => { h.hold('mesh', modelIdNum); return getGpuMesh(modelIdNum, breathe); },
      uploadRecord: (archive, record, opts) => {
        const { value, keys } = uploadsOf(() => uploadRecord(archive, record, opts));
        for (const k of keys) h.hold('tex', k);
        learnRemake(keys, [archive, record, opts]);
        return value;
      },
      uploadRecordFrame: (archive, record, frame) => {
        const { keys } = uploadsOf(() => uploadRecordFrame(archive, record, frame));
        for (const k of keys) h.hold('tex', k);
        learnRemake(keys, [archive, record, undefined, frame]);
      },
      tileArray: (archive) => h.hold('tile', archive),
      release: () => h.release(),
      settle: () => h.settle(),
    };
  }

  loadFlats();   // warm it with the scene; the getters answer null until it lands
  // DISC22-D: the icon doors' per-record decode is the drawer's own (ui/itemScroller.js preloadIconRecord) - the
  // handout this bag once carried was taken by no scene, which is how the Steel Light Flail drew nothing.
  return { textureFiles, getTexture, getTextureSize, uploadRecord: pinnedUpload, uploadRecordFrame: pinnedUploadFrame, getGpuMesh: pinnedGpuMesh, getWindmillMeshes, getMachineryParts, gpuMeshes, cpuModels, palette,
    markClassicArt, isClassicArt,   // AUDIT GN2-PF5
    holdPlace, keepPlaces: (kind, n) => holds.keep(kind, n), placeStats: () => holds.stats(),   // FIELD BUGS 2026-10-04d PLACE-LRU
    loadFlats, flatCaption, flatFaceIndex, flatsFile: () => flats };
}
