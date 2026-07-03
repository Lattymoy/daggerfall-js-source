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
import { resolvePiece } from '../characters/pieceFromSprite.js';
import { reliefFromSprite, distanceField } from '../characters/spriteRelief.js';
import bodyBack from '../characters/backs/body00i0.json' with { type: 'json' };
import cuirassBack from '../characters/backs/cuirass-251-4.json' with { type: 'json' };
import { getTemplate } from '../characters/paperdoll.js';
import { resolvePaperdollRecord, armorArchive, armorVariant, MATERIAL_FAMILY } from '../characters/paperdollArt.js';
import { DYE_COLORS, DYE_TARGETS, applyDyeToIndex } from '../characters/dyes.js';
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
    // C6 REDESIGN: the body IS the classic paperdoll body - BODY00I0's
    // pixels as a front relief in canvas space, and the piece is the
    // SAME construction at ITS classic offset (+1.5px stand-off).
    // Seating is arithmetic on the art's own offsets; one uniform
    // matrix scales canvas pixels to world (1.8 over the body height).
    const bodyImg = new ImgFile();
    bodyImg.load(await fetchBytes('BODY00I0.IMG'), 'BODY00I0.IMG', palette);
    const bodyBmp = bodyImg.getDFBitmap();
    const bodyOff = bodyImg.imageOffset;
    const canvas = { canvasH: 200 };
    // Invented backs (C6h): generated grids ride the FRONT's mask +
    // field, so the silhouette is identical and the seam meets at
    // zero. Grids are authored in rear-view (mirrored) space - flip x
    // at load per the mirroredOfFront contract.
    const unmirror = (back, W, H) => {
      const out = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        out[y * W + x] = back.data[y * W + (W - 1 - x)];
      }
      return out;
    };
    const toRgb = (faces) => faces.map((f) => {
      const c = palette.get(f.idx);
      return { p: f.p, n: f.n, c: [c.r, c.g, c.b] };
    });
    const bodyField = distanceField(bodyBmp);
    const bodyOpts = { offsetX: bodyOff.x, offsetY: bodyOff.y, ...canvas, field: bodyField };
    const bodyFaces = reliefFromSprite(bodyBmp, bodyOpts);
    const bodyBackFaces = reliefFromSprite(bodyBmp, {
      ...bodyOpts, back: true,
      colorBmp: { data: unmirror(bodyBack, bodyBmp.width, bodyBmp.height) },
    });
    const drawsForPerson = [
      renderer.createCharacterMesh(packCharacterFaces(toRgb(bodyFaces))),
      renderer.createCharacterMesh(packCharacterFaces(toRgb(bodyBackFaces))),
    ];
    if (opts.piece) {
      const tpl = getTemplate(opts.piece);
      const t = await getTexture(armorArchive('male', 'Breton'));
      const rec = resolvePaperdollRecord(tpl, armorVariant(opts.piece, MATERIAL_FAMILY.Plate, 1));
      const pieceOff = t.getOffset(rec);
      const pieceBmp = t.getDFBitmap(rec, 0);
      const pieceField = distanceField(pieceBmp);
      const pieceOpts = { offsetX: pieceOff.x, offsetY: pieceOff.y, zBias: 1.5, ...canvas, field: pieceField };
      const pieceFaces = reliefFromSprite(pieceBmp, pieceOpts);
      const pieceBackFaces = reliefFromSprite(pieceBmp, {
        ...pieceOpts, back: true,
        colorBmp: { data: unmirror(cuirassBack, pieceBmp.width, pieceBmp.height) },
      });
      const dye = (faces) => resolvePiece(faces, DYE_COLORS.Steel, DYE_TARGETS.WeaponsAndArmor, palette, applyDyeToIndex);
      drawsForPerson.push(renderer.createCharacterMesh(packCharacterFaces(dye(pieceFaces))));
      drawsForPerson.push(renderer.createCharacterMesh(packCharacterFaces(dye(pieceBackFaces))));
    }
    // Canvas -> world: uniform scale, body feet on the billboard base,
    // body centre-x at the person.
    const CLASSIC_HEIGHT = 1.8;
    const sc = CLASSIC_HEIGHT / bodyBmp.height;
    const feetY = 200 - (bodyOff.y + bodyBmp.height);
    const centerX = bodyOff.x + bodyBmp.width / 2;
    for (const pn of people) {
      const matrix = trs(pn.x - centerX * sc, pn.y - feetY * sc, pn.z, 0, 0, 0, sc, sc, sc);
      for (const mesh of drawsForPerson) charDraws.push({ mesh, matrix });
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
