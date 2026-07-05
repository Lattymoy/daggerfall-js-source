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
import { buildRaceCharacter, raceOfArchive } from '../characters/raceCharacter.js';
import { facesBounds } from '../render/characterMesh.js';
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
  let animateChars = null; // set when the voxel body builds
  const billboardBatches = [];
  const flatGroups = new Map();
  if (opts.voxelfolk && people.length) {
    // Neutral paperdoll (C8): a redesigned standing figure from
    // buildNeutralBody() - NOT sprite-constrained (arms at the sides,
    // forward legs/feet, designed anatomy). Colour is baked per face
    // (AO + snapped-ARM_PAL-ramp shading, the blocky look), ramps
    // taken from the loaded sprite so the palette matches. The old
    // old sprite-trace rig + 1:1 silhouette pin are retired/removed.
    // Pieces will re-seat on this rig later - &piece is inert here.
    const bodyImg = new ImgFile();
    bodyImg.load(await fetchBytes('BODY00I0.IMG'), 'BODY00I0.IMG', palette);
    const bodyBmp = bodyImg.getDFBitmap();
    const W = bodyBmp.width, H = bodyBmp.height;
    // NEUTRAL paperdoll (redesign): geometry + AO + snapped-ramp
    // palette shading, baked per face. Ramps come from the loaded
    // ART_PAL sprite (skin from the mid torso, boot from the feet) so
    // the palette matches the game.
    const lumOf = (i) => { const c = palette.get(i); return 0.299*c.r + 0.587*c.g + 0.114*c.b; };
    const rampOf = (r0, r1, keep) => { const m = new Map(); for (let y=r0;y<=r1;y++) for (let x=0;x<W;x++){ const i=bodyBmp.data[y*W+x]; if(i&&(!keep||keep(x,y))) m.set(i,lumOf(i)); } return [...m.entries()].sort((a,b)=>a[1]-b[1]).map(e=>{const c=palette.get(e[0]);return [c.r,c.g,c.b];}); };
    const ramps = { skin: rampOf(40, 60, (x)=>Math.abs(x-((W-1)/2))<14), boot: rampOf(132, 144) };
    const GI = { body: 0, head: 1, armL: 2, armR: 3, legL: 4, legR: 5 };
    const CLASSIC_HEIGHT = 1.8;
    const rotX = (y, z, pY, a) => { const c=Math.cos(a), sn=Math.sin(a), dy=y-pY; return [pY + c*dy - sn*z, sn*dy + c*z]; };
    // Build a full race character into one animated mesh (body + head +
    // tail + body detail, race-coloured). Returns the mesh, an animate
    // fn, and the model->world scale/offset.
    const buildCharMesh = (faces) => {
      const b = facesBounds(faces);
      const basePacked = packCharacterFaces(faces.map((f) => ({ p: f.p, n: f.n, c: f.c })));
      const mesh = renderer.createCharacterMesh(basePacked);
      const vGroup = [];
      for (const f of faces) { const g = GI[f.g] ?? 0; const np = f.p.length / 3; for (let i = 1; i < np - 1; i++) vGroup.push(g, g, g); }
      const gr = {}; for (const f of faces) { const k = f.g; for (let i = 0; i < 4; i++) { const y = f.p[i*3+1]; (gr[k] ??= [1e9,-1e9]); if (y<gr[k][0]) gr[k][0]=y; if (y>gr[k][1]) gr[k][1]=y; } }
      const hipY = gr.legL[1], ankY = gr.legL[0], shY = gr.armL[1], wrY = gr.armL[0];
      const kneeY = hipY - 0.52*(hipY-ankY), elbowY = shY - 0.50*(shY-wrY);
      const anim = new Float32Array(basePacked.length);
      const sc = CLASSIC_HEIGHT / (b.maxY - b.minY);
      const animate = (t, mode = 'idle') => {
        if (mode === 'off') { renderer.updateCharacterMesh(mesh, basePacked); return; }
        anim.set(basePacked);
        const Wp = mode === 'walk'
          ? { stride: 0.44, cad: 6, bob: 0.024, counter: 1.1, knee: 0.9, elbow: 0.35 }
          : { stride: 0.05, cad: 1.7, bob: 0.006, counter: 1.0, knee: 0.12, elbow: 0.12 };
        const wt = t * Wp.cad, bob = Wp.bob * Math.sin(wt * 2);
        const limb = (gid, phase, jointY, kneeAmp, isLeg) => {
          const hip = -Wp.stride * (isLeg ? 1 : Wp.counter) * Math.sin(wt + phase);
          const bend = kneeAmp * (isLeg ? Math.max(0, Math.sin(wt + phase + 1.2)) : -(0.5 + 0.5*Math.sin(wt + phase - 0.6)));
          for (let v = 0; v < vGroup.length; v++) if (vGroup[v] === gid) {
            const o = v*9; let y = basePacked[o+1], z = basePacked[o+2];
            if (y < jointY) [y, z] = rotX(y, z, jointY, bend);
            [y, z] = rotX(y, z, (isLeg ? hipY : shY), hip);
            anim[o+1] = y + bob; anim[o+2] = z;
          }
        };
        limb(4, 0, kneeY, Wp.knee, true);  limb(5, Math.PI, kneeY, Wp.knee, true);
        limb(2, Math.PI, elbowY, Wp.elbow, false); limb(3, 0, elbowY, Wp.elbow, false);
        for (let v = 0; v < vGroup.length; v++) if (vGroup[v] === 0 || vGroup[v] === 1) anim[v*9+1] = basePacked[v*9+1] + bob;
        renderer.updateCharacterMesh(mesh, anim);
      };
      return { mesh, animate, minY: b.minY, sc };
    };
    // One mesh per race, cached; people instanced onto their race's mesh.
    const raceMeshes = new Map();
    const meshFor = (race) => { let cm = raceMeshes.get(race); if (!cm) { cm = buildCharMesh(buildRaceCharacter(race, ramps)); raceMeshes.set(race, cm); } return cm; };
    for (const pn of people) {
      const cm = meshFor(raceOfArchive(pn.textureArchive));
      charDraws.push({ mesh: cm.mesh, matrix: trs(pn.x, pn.y - cm.minY * cm.sc, pn.z, 0, 0, 0, cm.sc, cm.sc, cm.sc) });
    }
    animateChars = (t, mode = 'idle') => { for (const cm of raceMeshes.values()) cm.animate(t, mode); };
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
    animateChars,
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
