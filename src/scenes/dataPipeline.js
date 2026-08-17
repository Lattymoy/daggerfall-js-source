// Shared lazy data pipeline (P7): the streaming world's texture/mesh
// caches, lifted verbatim so any scene that hosts transitions (world,
// exterior) can lazy-load models and archives it never preloaded -
// interiors and dungeons reference meshes outside the host's own set.
// Caches are per-scene and never destroyed (the world's contract).

import { TextureFile } from '../formats/textureFile.js';
import { isExteriorWindow } from '../world/climateSwaps.js';
import { dfMeshToModel } from '../world/meshReader.js';
import { fetchBytes, texName } from './shared.js';

/** @param deps {{renderer, arch: Arch3dFile, palette: DFPalette}} */
export function createDataPipeline({ renderer, arch, palette }) {
  const textureFiles = new Map();
  const texturePromises = new Map();
  async function getTexture(archive) {
    if (textureFiles.has(archive)) return textureFiles.get(archive);
    if (!texturePromises.has(archive)) {
      texturePromises.set(archive, (async () => {
        const t = new TextureFile();
        t.load(await fetchBytes(texName(archive)), texName(archive), palette);
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
    renderer.uploadTexture(archive, record, t.getColor32(bitmap, 0));
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
    renderer.uploadTexture(archive, key, t.getColor32(bitmap, 0));
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
  return { textureFiles, getTexture, getTextureSize, uploadRecord, uploadRecordFrame, getGpuMesh, gpuMeshes, cpuModels, palette };
}
