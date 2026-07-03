// Shared dungeon build for scene transitions (P5): lay a location's
// dungeon out against a HOST scene's caches and return everything the
// host needs to render and crawl it. Semantics match the standalone
// dungeon scene (M6/R6/R7/R11/P2) with one mechanical difference: the
// per-dungeon texture table is applied as a DRAW-TIME texRemap instead
// of rewriting submesh archives at model build - the host's mesh cache
// serves exteriors too and must stay untouched. UVs therefore keep
// original-archive sizes while pixels come from the table archive,
// which is exactly the dungeon convention already on record.

import { layoutDungeon } from '../world/dungeonLayout.js';
import { applyTextureTable } from '../world/dungeonTextures.js';
import { collectDungeonLights, DUNGEON_AMBIENT } from '../world/dungeonLights.js';
import { CityLightAnimator } from '../world/worldClock.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { dfMeshToModel, GLOBAL_SCALE } from '../world/meshReader.js';
import { RDB_SIDE, MOVE_ACTION_FLAGS } from '../world/rdbLayout.js';
import { trs, multiply } from '../world/mat4.js';
import { Collider } from '../player/collider.js';
import { ActionSystem } from '../world/actionSystem.js';



/**
 * @param deps {{renderer, arch, getGpuMesh, cpuModels, getTexture, uploadRecord}}
 * @param dfLocation location with a dungeon
 * @param blocks BlocksFile
 * @param climateBaseType ClimateBases value for the table remap
 */
export async function buildDungeonContext(deps, dfLocation, blocks, climateBaseType) {
  const { renderer, arch, getGpuMesh, cpuModels, getTexture, uploadRecord } = deps;

  // Layout needs synchronous models (doors/exit extraction); a unit-size
  // pre-pass mirrors the standalone scene.
  const preModels = new Map();
  const getModelPre = (id) => {
    if (!preModels.has(id)) {
      const index = arch.getRecordIndex(id);
      if (index === -1) throw new Error(`model not found: ${id}`);
      preModels.set(id, dfMeshToModel(arch.getMesh(index), () => ({ width: 1, height: 1 })));
    }
    return preModels.get(id);
  };

  const dungeon = layoutDungeon(dfLocation, blocks, getModelPre);
  const remap = (archive) => applyTextureTable(archive, dungeon.textureTable, climateBaseType);

  const drawList = [];
  const dynamicDraws = [];
  const collider = new Collider(() => -Infinity);
  const actions = new ActionSystem(collider);
  const texRemap = new Map();
  const flatGroups = new Map();
  const lights = [];
  const waterQuads = [];
  const exitDoors = [];
  let colliderTris = 0;

  const ensureRemap = async (id) => {
    const cpu = cpuModels.get(id);
    for (const sm of cpu.subMeshes ?? []) {
      const swapped = remap(sm.textureArchive);
      if (swapped === sm.textureArchive) continue;
      const key = `${sm.textureArchive}_${sm.textureRecord}`;
      if (texRemap.has(key)) continue;
      const t = await getTexture(swapped);
      if (sm.textureRecord >= t.recordCount) continue;
      uploadRecord(swapped, sm.textureRecord);
      texRemap.set(key, `${swapped}_${sm.textureRecord}`);
    }
  };

  for (const b of dungeon.blocks) {
    const originMatrix = trs(b.originX, 0, b.originZ, 0, 0, 0);
    for (const p of b.layout.placements) {
      const matrix = multiply(originMatrix, p.matrix);
      const gpu = await getGpuMesh(p.modelIdNum);
      if (!gpu) continue;
      await ensureRemap(p.modelIdNum);
      const cpu = cpuModels.get(p.modelIdNum);
      if (p.action && MOVE_ACTION_FLAGS.has(p.action.actionFlag)) {
        const o = actions.addAction(p.position, cpu, matrix, p.action);
        dynamicDraws.push({ gpu, object: o });
        continue;
      }
      drawList.push({ mesh: gpu, matrix });
      collider.addMesh('dungeon', cpu.positions, cpu.indices, matrix);
      colliderTris += cpu.indices.length / 3;
    }
    for (const d of b.layout.actionDoors) {
      if (d.disabled) continue;
      const matrix = multiply(originMatrix, d.matrix);
      const gpu = await getGpuMesh(d.modelIdNum);
      await ensureRemap(d.modelIdNum);
      const o = actions.addDoor(cpuModels.get(d.modelIdNum), matrix);
      dynamicDraws.push({ gpu, object: o });
    }
    for (const f of b.layout.flats) {
      const key = `${f.archive}_${f.record}`;
      if (!flatGroups.has(key)) flatGroups.set(key, []);
      flatGroups.get(key).push([f.x + b.originX, f.y, f.z + b.originZ]);
    }
    for (const l of collectDungeonLights(b.dfBlock)) {
      lights.push({ x: l.x + b.originX, y: l.y, z: l.z + b.originZ, range: l.range });
    }
    if (b.layout.waterLevel !== 10000) {
      waterQuads.push({
        x: b.originX, z: b.originZ, size: RDB_SIDE,
        y: -b.layout.waterLevel * GLOBAL_SCALE,
      });
    }
    for (const door of b.layout.exitDoors) {
      // Exit-door matrices are model-local under the block origin.
      exitDoors.push({ ...door, matrix: multiply(originMatrix, door.matrix) });
    }
  }

  const billboardBatches = [];
  for (const [key, centers] of flatGroups) {
    const [archive, record] = key.split('_').map(Number);
    // Flats keep their original archives (the table remaps walls);
    // RDB AddFlat pivots at the raw position - shift to base-centered.
    const t = await getTexture(archive);
    if (!t || record >= t.recordCount) continue;
    uploadRecord(archive, record);
    const size = scaledBillboardSize(t.getSize(record), t.getScale(record));
    const based = centers.map(([x, y, z]) => [x, y - size.h / 2, z]);
    billboardBatches.push(renderer.createBillboardBatch(archive, record, size, based));
  }

  const flicker = new CityLightAnimator(lights.length, lights.map((l) => l.range));

  return {
    drawList,
    dynamicDraws,
    actions,
    collider,
    texRemap,
    billboardBatches,
    lights,
    flicker,
    waterQuads,
    startMarker: dungeon.startMarker,
    exitDoors,
    colliderTris,
    destroy() {
      for (const b of billboardBatches) renderer.destroyBatch(b);
    },
  };
}
