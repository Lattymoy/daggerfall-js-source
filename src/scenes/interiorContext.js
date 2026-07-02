// Shared interior build for scene transitions (P3): given a host
// scene's data caches, lay out one building interior and return
// everything the host needs to render and walk it. The pipeline is the
// standalone interior scene's (M4/R8/R12 semantics) expressed against
// host deps, so the world and exterior scenes enter buildings without
// their own copies:
//   - layoutInterior placements + action doors at block-local origin
//     (the host renders them relative to a chosen interior origin),
//   - climate swaps per submesh with the missing-record prune,
//   - flats batched per (archive, record), archive-210 interior point
//     lights (verbatim DaggerfallInterior.AddLight, range 15, no
//     flicker), verbatim interior ambient + fog handled by the host
//     per frame,
//   - a fresh Collider over every placement and action-door mesh,
//   - enter markers and interior static doors for the landing math.

import { layoutInterior, INTERIOR_MARKER } from '../world/interiorLayout.js';
import { collectInteriorLights } from '../world/interiorLights.js';
import { applyClimate } from '../world/climateSwaps.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { Collider } from '../player/collider.js';

/**
 * @param deps {{
 *   renderer, getGpuMesh: async (id) => gpu, cpuModels: Map,
 *   getTexture: async (archive) => TextureFile, uploadRecord,
 * }}
 * @returns {{drawList, billboardBatches, lights, texRemap, markers,
 *   enterMarkers, doors, collider, destroy()}}
 */
export async function buildInteriorContext(deps, dfBlock, blockIndex, recordIndex, climateBase, season) {
  const { renderer, getGpuMesh, cpuModels, getTexture, uploadRecord } = deps;

  // Layout with real texture sizes: getGpuMesh warms the caches, then
  // the layout's getModel reads the CPU model back.
  const pending = new Map(); // id -> cpu model, resolved before layout
  const collect = async (id) => {
    if (!pending.has(id)) {
      await getGpuMesh(id);
      pending.set(id, cpuModels.get(id));
    }
    return pending.get(id);
  };
  // First pass: discover every model id the record references.
  const recordData = dfBlock.rmbBlock.subRecords[recordIndex];
  const ids = new Set();
  for (const obj of recordData.interior.block3dObjectRecords) ids.add(obj.modelIdNum);
  await Promise.all([...ids].map(collect));

  const interior = layoutInterior(dfBlock, blockIndex, recordIndex, (id) => pending.get(id));
  await Promise.all(interior.actionDoors.map((d) => collect(d.modelIdNum)));

  // Climate swap table over the interior's submeshes, pruned like the
  // standalone scene when the swapped archive lacks the record.
  const texRemap = new Map();
  for (const id of pending.keys()) {
    const cpu = cpuModels.get(id);
    for (const sm of cpu.subMeshes ?? []) {
      const swapped = applyClimate(sm.textureArchive, sm.textureRecord, climateBase, season);
      if (swapped === sm.textureArchive) continue;
      const key = `${sm.textureArchive}_${sm.textureRecord}`;
      if (texRemap.has(key)) continue;
      const t = await getTexture(swapped);
      if (sm.textureRecord >= t.recordCount) continue;
      uploadRecord(swapped, sm.textureRecord);
      texRemap.set(key, `${swapped}_${sm.textureRecord}`);
    }
  }

  const drawList = [];
  const collider = new Collider(() => -Infinity);
  for (const p of [...interior.placements, ...interior.actionDoors]) {
    drawList.push({ mesh: await getGpuMesh(p.modelIdNum), matrix: p.matrix });
    const cpu = cpuModels.get(p.modelIdNum);
    collider.addMesh('interior', cpu.positions, cpu.indices, p.matrix);
  }

  const billboardBatches = [];
  const flatGroups = new Map();
  for (const flat of interior.flats) {
    const key = `${flat.archive}_${flat.record}`;
    if (!flatGroups.has(key)) flatGroups.set(key, []);
    flatGroups.get(key).push([flat.x, flat.y, flat.z]);
  }
  for (const [key, centers] of flatGroups) {
    const [archive, record] = key.split('_').map(Number);
    const t = await getTexture(archive);
    if (!t || record >= t.recordCount) continue;
    uploadRecord(archive, record);
    const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
    billboardBatches.push(renderer.createBillboardBatch(archive, record, size, centers));
  }

  const t210 = await getTexture(210);
  const lights = t210 ? collectInteriorLights(interior.flats, (record) =>
    scaledBillboardSize(t210.getSize(record), t210.getScale(record))) : [];

  const enterMarkers = interior.markers
    .filter((m) => m.type === INTERIOR_MARKER.ENTER)
    .map((m) => [m.x, m.y, m.z]);

  return {
    drawList,
    billboardBatches,
    lights,
    texRemap,
    markers: interior.markers,
    enterMarkers,
    doors: interior.doors,
    collider,
    destroy() {
      for (const b of billboardBatches) renderer.destroyBatch(b);
    },
  };
}
