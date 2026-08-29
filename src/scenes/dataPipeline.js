// Shared lazy data pipeline (P7): the streaming world's texture/mesh
// caches, lifted verbatim so any scene that hosts transitions (world,
// exterior) can lazy-load models and archives it never preloaded -
// interiors and dungeons reference meshes outside the host's own set.
// Caches are per-scene and never destroyed (the world's contract).

import { TextureFile } from '../formats/textureFile.js';
import { FlatsFile } from '../formats/flatsFile.js';   // NPC1: captions + portrait indices
import { isExteriorWindow } from '../world/climateSwaps.js';
import { dfMeshToModel } from '../world/meshReader.js';
import { fetchBytes, texName } from './shared.js';
import { decodedTexture, preloadTextureArchive } from '../systems/textureReplacement.js';   // M-TEX: user-supplied textures override the classic ones
import { ROTOR } from '../world/windmillMesh.js';   // WM2b: the vendored rotor, uploaded like any other model

/** @param deps {{renderer, arch: Arch3dFile, palette: DFPalette}} */
export function createDataPipeline({ renderer, arch, palette }) {
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
      flats = new FlatsFile().load(await fetchBytes('FLATS.CFG'), 'FLATS.CFG');
    } catch (e) {
      console.warn('[flats] FLATS.CFG unavailable; flats keep no caption and people no portrait', e);
      flats = new FlatsFile();
    }
    return flats;
  })());
  const flatCaption = (archive, record) => flats?.caption(archive, record) ?? null;
  const flatFaceIndex = (archive, record) => flats?.faceIndex(archive, record) ?? -1;
  async function getTexture(archive) {
    if (textureFiles.has(archive)) return textureFiles.get(archive);
    if (!texturePromises.has(archive)) {
      texturePromises.set(archive, (async () => {
        const t = new TextureFile();
        t.load(await fetchBytes(texName(archive)), texName(archive), palette);
        // M-TEX: the replacement PNGs for this archive decode HERE,
        // where there is already an await and the result is already
        // cached per archive. uploadRecord is synchronous and runs off
        // the draw path, so a texture that arrived late would be a
        // visible pop or a missing wall - by the time anything uploads
        // a record its replacement is decoded and waiting, or genuinely
        // absent. Never throws: one bad PNG costs that texture.
        await preloadTextureArchive(archive).catch(() => {});
        textureFiles.set(archive, t);
        return t;
      })());
    }
    return texturePromises.get(archive);
  }
  const getTextureSize = (archive, record) => {
    const t = textureFiles.get(archive);
    return { width: t.getWidth(record), height: t.getHeight(record) };
  };
  const uploadRecord = (archive, record) => {
    const t = textureFiles.get(archive);
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
    const swap = decodedTexture(archive, record, 0);
    renderer.uploadTexture(archive, record, swap ?? t.getColor32(bitmap, 0));
    // Exterior windows also get their emission mask (R2, MaterialReader
    // semantics: glass texels glow with the active window style).
    if (isExteriorWindow(archive, record)) {
      renderer.uploadEmissionTexture(archive, record, t.getWindowColors32(bitmap));
    }
  };
  // C11 mobile monsters: per-FRAME uploads under a composite record
  // key (`${record}#${frame}` - the renderer keys textures by
  // template string, so a batch whose .record is the composite draws
  // the frame). Spectral archives (ghost/wraith) keep their verbatim
  // TextureReader treatment per frame.
  const uploadRecordFrame = (archive, record, frame) => {
    const key = `${record}#${frame}`;
    const t = textureFiles.get(archive);
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
    renderer.uploadTexture(archive, key, swapFrame ?? t.getColor32(bitmap, 0));
  };
  const gpuMeshes = new Map(); // shared across pixels, never destroyed
  const cpuModels = new Map(); // id -> {positions, indices} for the collider
  async function getGpuMesh(modelIdNum) {
    if (gpuMeshes.has(modelIdNum)) return gpuMeshes.get(modelIdNum);
    const index = arch.getRecordIndex(modelIdNum);
    if (index === -1) {
      gpuMeshes.set(modelIdNum, null);
      return null;
    }
    const dfMesh = arch.getMesh(index);
    for (const sm of dfMesh.subMeshes) await getTexture(sm.textureArchive);
    const model = dfMeshToModel(dfMesh, getTextureSize);
    for (const sm of model.subMeshes) uploadRecord(sm.textureArchive, sm.textureRecord);
    const gpu = renderer.createMesh(model);
    cpuModels.set(modelIdNum, { positions: model.positions, indices: model.indices, subMeshes: model.subMeshes, doors: model.doors });
    gpuMeshes.set(modelIdNum, gpu);
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
  const ROTOR_KEY = -41600;
  async function getRotorMesh() {
    if (gpuMeshes.has(ROTOR_KEY)) return gpuMeshes.get(ROTOR_KEY);
    for (const sm of ROTOR.subMeshes) {
      await getTexture(sm.textureArchive);
      uploadRecord(sm.textureArchive, sm.textureRecord);
    }
    const gpu = renderer.createMesh(ROTOR);
    gpuMeshes.set(ROTOR_KEY, gpu);
    return gpu;
  }

  loadFlats();   // warm it with the scene; the getters answer null until it lands
  return { textureFiles, getTexture, getTextureSize, uploadRecord, uploadRecordFrame, getGpuMesh, getRotorMesh, gpuMeshes, cpuModels, palette,
    loadFlats, flatCaption, flatFaceIndex, flatsFile: () => flats };
}
