// Shared interior build for scene transitions (P3): given a host
// scene's data caches, lay out one building interior and return
// everything the host needs to render and walk it. The pipeline is the
// standalone interior scene's (M4/R8/R12 semantics) expressed against
// host deps, so the world and exterior scenes enter buildings without
// their own copies:
//   - layoutInterior placements + action doors, parented through an
//     optional origin (P8: the entered building's WORLD matrix -
//     verbatim TransitionInterior's ownerPosition + buildingMatrix -
//     so hosts get world-frame coordinates; standalone omits it),
//   - climate swaps per submesh with the missing-record prune,
//   - flats batched per (archive, record), archive-210 interior point
//     lights (verbatim DaggerfallInterior.AddLight, range 15, no
//     flicker), verbatim interior ambient + fog handled by the host
//     per frame,
//   - a fresh Collider over every placement and action-door mesh,
//   - enter markers and interior static doors for the landing math.

import { layoutInterior, INTERIOR_MARKER } from '../world/interiorLayout.js';
import { multiply, transformPoint } from '../world/mat4.js';
import { collectInteriorLights } from '../world/interiorLights.js';
import { applyClimate } from '../world/climateSwaps.js';
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { Collider } from '../player/collider.js';
import { LADDER_MODEL_ID } from '../player/enterExit.js';
import { collectInteriorPeople } from '../characters/interiorPeople.js';
import { packCharacterFaces } from '../render/characterMesh.js';
import { trs } from '../world/mat4.js';
import { buildBody, BARE_PLUGS } from '../characters/rewrite/body.js';
import { facesBounds } from '../render/characterMesh.js';
import { DAGGER_SPEC } from '../characters/daggerBodySpec.js';
import { PAPERDOLL_POSE } from '../characters/paperdollPose.js';
import { ImgFile } from '../formats/imgFile.js';
import { fetchBytes } from './shared.js';
import { ActionSystem } from '../world/actionSystem.js';

/**
 * @param deps {{
 *   renderer, getGpuMesh: async (id) => gpu, cpuModels: Map,
 *   getTexture: async (archive) => TextureFile, uploadRecord,
 * }}
 * @returns {{drawList, billboardBatches, lights, texRemap, markers,
 *   enterMarkers, doors, collider, destroy()}}
 */
export async function buildInteriorContext(deps, dfBlock, blockIndex, recordIndex, climateBase, season, origin = null, opts = {}) {
  const { renderer, getGpuMesh, cpuModels, getTexture, uploadRecord, palette } = deps;
  // P8: verbatim PlayerEnterExit.TransitionInterior parenting - the
  // interior sits at ownerPosition + buildingMatrix (the entered
  // building model's WORLD matrix), so every coordinate the context
  // returns is world-frame and the closest-marker/door landing math
  // runs in ONE frame. Standalone callers omit origin (identity).
  const parent = (m) => origin ? multiply(origin, m) : m;
  const parentPt = (x, y, z) => origin ? transformPoint(origin, x, y, z) : [x, y, z];

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
  const ladders = []; // {cpu, matrix} - verbatim id 41409
  const collider = new Collider(() => -Infinity);
  for (const p of interior.placements) {
    const matrix = parent(p.matrix);
    drawList.push({ mesh: await getGpuMesh(p.modelIdNum), matrix });
    const cpu = cpuModels.get(p.modelIdNum);
    collider.addMesh('interior', cpu.positions, cpu.indices, matrix);
    if (p.modelIdNum === LADDER_MODEL_ID) ladders.push({ cpu, matrix });
  }
  // Interior swing doors run on the ActionSystem (P4): the verbatim
  // -90 / 1.5 s toggle with trigger-at-open-start - inner rooms open.
  const actions = new ActionSystem(collider);
  const dynamicDraws = [];
  for (const d of interior.actionDoors) {
    const cpu = cpuModels.get(d.modelIdNum);
    const o = actions.addDoor(cpu, parent(d.matrix));
    dynamicDraws.push({ gpu: await getGpuMesh(d.modelIdNum), object: o });
  }

  // People (C1): AddPeople's data layer - base positions batch through
  // the same billboard path as flats; the StaticNPC inputs ride on the
  // returned people list (parent-frame, like everything else here).
  const people = collectInteriorPeople(recordData).map((pn) => {
    const [x, y, z] = parentPt(pn.x, pn.y, pn.z);
    return { ...pn, x, y, z };
  });

  // C4c (?voxelfolk): people stand as the bare Rewrite humanoid - one
  // packed mesh, per-person matrices (uniform scale to CLASSIC_HEIGHT,
  // feet on the billboard base). Facing is static until the animation
  // slice. Flag off = the C1 classic billboards, untouched.
  const charDraws = [];
  const billboardBatches = [];
  const flatGroups = new Map();
  if (opts.voxelfolk && people.length) {
    // C6j (Mac's architecture): the OLD VOXEL RIG is the geometry -
    // real 3D body, real back and sides, paperdoll stance on
    // DAGGER_SPEC - and the classic sprite is the SHADING: every rig
    // face samples BODY00I0 by front projection (face centroid ->
    // sprite pixel; feet-anchored, centreline-aligned), so the front
    // reads 1:1 with the sprite. Faces the sprite cannot see take the
    // projected-through sample for now; developing OUR OWN textures
    // from the classic data (ramp machinery from C6i) is the next
    // step. Pieces re-seat on the rig with that step - &piece is
    // inert here until then.
    const bodyImg = new ImgFile();
    bodyImg.load(await fetchBytes('BODY00I0.IMG'), 'BODY00I0.IMG', palette);
    const bodyBmp = bodyImg.getDFBitmap();
    const W = bodyBmp.width, H = bodyBmp.height;
    const faces = buildBody(
      { loco: 'stand', hold: 'idle', phase: 0, weapon: 'none', paperdoll: PAPERDOLL_POSE },
      BARE_PLUGS, DAGGER_SPEC);
    const b = facesBounds(faces);
    const u = (b.maxY - b.minY) / H; // rig units per sprite pixel
    const sample = (x, y) => {
      let col = Math.round((W - 1) / 2 + x / u);
      let row = Math.round((b.maxY - y) / u);
      col = Math.max(0, Math.min(W - 1, col));
      row = Math.max(0, Math.min(H - 1, row));
      let idx = bodyBmp.data[row * W + col];
      if (!idx) {
        // Rig wider than the sprite here: clamp to the row's nearest
        // opaque pixel so ramps stay continuous.
        for (let d = 1; d < W && !idx; d++) {
          if (col - d >= 0 && bodyBmp.data[row * W + col - d]) idx = bodyBmp.data[row * W + col - d];
          else if (col + d < W && bodyBmp.data[row * W + col + d]) idx = bodyBmp.data[row * W + col + d];
        }
      }
      return idx;
    };
    const rgb = faces.map((f) => {
      let cx = 0, cy = 0; const np = f.p.length / 3;
      for (let i = 0; i < np; i++) { cx += f.p[i * 3]; cy += f.p[i * 3 + 1]; }
      const idx = sample(cx / np, cy / np);
      const c = idx ? palette.get(idx) : { r: 40, g: 36, b: 34 };
      return { p: f.p, n: f.n, c: [c.r, c.g, c.b] };
    });
    const mesh = renderer.createCharacterMesh(packCharacterFaces(rgb));
    const CLASSIC_HEIGHT = 1.8;
    const sc = CLASSIC_HEIGHT / (b.maxY - b.minY);
    for (const pn of people) {
      charDraws.push({ mesh, matrix: trs(pn.x, pn.y - b.minY * sc, pn.z, 0, 0, 0, sc, sc, sc) });
    }
  } else {
    for (const pn of people) {
      const key = `${pn.textureArchive}_${pn.textureRecord}`;
      if (!flatGroups.has(key)) flatGroups.set(key, []);
      flatGroups.get(key).push([pn.x, pn.y, pn.z]);
    }
  }
  for (const flat of interior.flats) {
    const key = `${flat.archive}_${flat.record}`;
    if (!flatGroups.has(key)) flatGroups.set(key, []);
    flatGroups.get(key).push(parentPt(flat.x, flat.y, flat.z));
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
  const lights = (t210 ? collectInteriorLights(interior.flats, (record) =>
    scaledBillboardSize(t210.getSize(record), t210.getScale(record))) : [])
    .map((l) => {
      const [x, y, z] = parentPt(l.x, l.y, l.z);
      return { ...l, x, y, z };
    });

  // Markers (all types - ladders climb against these too) into the
  // parent frame; enterMarkers derive from the transformed set.
  const markers = interior.markers.map((m) => {
    const [x, y, z] = parentPt(m.x, m.y, m.z);
    return { ...m, x, y, z };
  });
  const enterMarkers = markers
    .filter((m) => m.type === INTERIOR_MARKER.ENTER)
    .map((m) => [m.x, m.y, m.z]);

  return {
    drawList,
    actions,
    dynamicDraws,
    billboardBatches,
    lights,
    texRemap,
    markers,
    people,
    charDraws,
    flatCount: interior.flats.length,
    ladders,
    enterMarkers,
    doors: interior.doors.map((d) => ({ ...d, matrix: parent(d.matrix) })),
    collider,
    destroy() {
      for (const b of billboardBatches) renderer.destroyBatch(b);
    },
  };
}
