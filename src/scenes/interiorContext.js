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

import { FlatAnimator, armFlatAnim } from '../render/flatAnimation.js';   // FA1: the flats that move
import { layoutInterior, INTERIOR_MARKER } from '../world/interiorLayout.js';
import { multiply, transformPoint } from '../world/mat4.js';
import { collectInteriorLights } from '../world/interiorLights.js';
import { applyClimate } from '../world/climateSwaps.js';
import { remapSubMeshes } from '../world/texRemap.js';   // WM3: the one climate/dungeon remap seam
import { scaledBillboardSize } from '../world/rmbFlats.js';
import { Collider } from '../player/collider.js';
import { isHouseContainerModel, containerTextureRecord } from '../systems/containers.js';
import { isShopShelfModel } from '../systems/shopStock.js';   // E2
import { LADDER_MODEL_ID } from '../player/enterExit.js';
import { collectInteriorPeople } from '../characters/interiorPeople.js';
import { trs } from '../world/mat4.js';
import { buildRaceCharacter, raceOfArchive } from '../characters/raceCharacter.js';
import { createCharacterRig, deriveClassicRamps } from '../characters/engineRig.js';
import { IDLE, WALK, POSE_L } from '../characters/animate.js';
import { ImgFile } from '../formats/imgFile.js';
import { fetchBytes } from './shared.js';
import { ActionSystem } from '../world/actionSystem.js';
import { audio } from '../systems/audio.js';
import { SOUND } from '../systems/soundClips.js';

/**
 * The A1 door-audio seams for a BUILDING interior's ActionSystem.
 * Verbatim DaggerfallActionDoor: the class defaults (which
 * SetInteriorDoorSounds also sets) are NormalDoorOpen / NormalDoorClose
 * / PlayerDoorBash - NOT the DungeonDoorOpen/Close pair the RDB dungeon
 * prefab uses. Wired here, in the context BOTH interior hosts build
 * (worldModes' entered buildings and the standalone interior scene), so
 * neither can be left silent.
 * @param sfx - the audio engine (injectable for tests).
 */
export function attachInteriorDoorSounds(actions, sfx = audio) {
  actions.onDoorState = (o, opening) => {
    const m = o.matrix;
    sfx.play3d(opening ? SOUND.NormalDoorOpen : SOUND.NormalDoorClose, [m[12], m[13], m[14]]);
  };
  actions.onDoorBash = (o) => {
    const m = o.matrix;
    sfx.play3d(SOUND.PlayerDoorBash, [m[12], m[13], m[14]]);
  };
}

/**
 * @param deps {{
 *   renderer, getGpuMesh: async (id) => gpu, cpuModels: Map,
 *   getTexture: async (archive) => TextureFile, uploadRecord,
 * }}
 * @returns {{drawList, billboardBatches, lights, texRemap, markers,
 *   enterMarkers, doors, collider, destroy()}}
 */
export async function buildInteriorContext(deps, dfBlock, blockIndex, recordIndex, climateBase, season, origin = null, opts = {}) {
  const { renderer, getGpuMesh, cpuModels, getTexture, uploadRecord, uploadRecordFrame, palette } = deps;
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
      const cpu = cpuModels.get(id);
      // LOUDLY, ONCE, AT THE SEAM. A null from getGpuMesh used to
      // become a silent `undefined` here and surface three statements
      // later as a TypeError on someone else's line.
      if (!cpu) console.warn(`[interior] model ${id} is not in this ARCH3D - every placement of it is skipped`);
      pending.set(id, cpu);
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
  const climateArchive = (archive, record) => applyClimate(archive, record, climateBase, season);
  for (const id of pending.keys()) {
    // The undefined submesh list is the seam's to survive, not this
    // loop's: an id whose model is absent lands in `pending` as
    // undefined (collect writes cpuModels.get(id) and getGpuMesh only
    // fills cpuModels on success), so this threw before the placement
    // guard below could ever run.
    await remapSubMeshes(cpuModels.get(id)?.subMeshes, texRemap, climateArchive, deps);
  }

  const drawList = [];
  const ladders = []; // {cpu, matrix} - verbatim id 41409
  // S2b: house containers - the verbatim predicate lives in
  // systems/containers.js (pure, tested); private furniture starts
  // EMPTY, opened through the shared pickup.
  const containers = [];
  // E2: shop shelves. DFU's AddFurnitureAction chain checks the
  // SHELF set FIRST - a shelf-set model in a plain UNOWNED house is
  // NOTHING (the else-chain never reaches the house-container check).
  // That also fixes an S2b parity slip: 41035/41037 sit in BOTH sets
  // and had been house containers everywhere. Shelves stock lazily
  // (StockShopShelf on first activation) when the building IsShop;
  // Library/Guild/Temple bookshelves route at activation (BS1), and
  // the OWNED-house arm lands below (HC1).
  const shelves = [];
  const collider = new Collider(() => -Infinity);
  for (const p of interior.placements) {
    const matrix = parent(p.matrix);
    // NEVER TRAPS: getGpuMesh returns NULL for a model id this data set
    // does not carry (dataPipeline.js:82, and it CACHES the null), and
    // cpuModels is written only on its success path - so an absent
    // model used to push a {mesh: null} draw entry AND then read
    // `cpu.positions` off undefined one line later. Every other builder
    // in the port skips the placement; this one did not, and it is the
    // only interior arm, which is why a single missing model could take
    // the whole building. Skip the placement, loudly.
    const gpu = await getGpuMesh(p.modelIdNum);
    const cpu = cpuModels.get(p.modelIdNum);
    if (!gpu || !cpu) {
      console.warn(`[interior] model ${p.modelIdNum} is not in this ARCH3D - the placement is skipped`);
      continue;
    }
    drawList.push({ mesh: gpu, matrix });
    collider.addMesh('interior', cpu.positions, cpu.indices, matrix);
    if (p.modelIdNum === LADDER_MODEL_ID) ladders.push({ cpu, matrix });
    if (isShopShelfModel(p.modelIdNum)) {
      if (opts.houseOwned) {
        // HC1 - AddFurnitureAction's OWNED arm (:816-819): in a house
        // the player OWNS, the shelf-set model is MakeHouseContainer -
        // your furniture is storage, not merchandise. `opts.houseOwned`
        // is the host's already-evaluated IsHouseOwned(buildingKey)
        // answer, the peopleVisible idiom - the bank registry lives
        // with the host, as DFU's DaggerfallBankManager does. (An
        // owned residence is never a shop or a Library/GuildHall/
        // Temple, so the two arms ahead of this one in DFU's chain
        // cannot fire on it.)
        containers.push({ cpu, matrix, items: null, record: containerTextureRecord(p.modelIdNum) });
      } else {
        shelves.push({ cpu, matrix, items: null });
      }
    } else if (isHouseContainerModel(p.modelIdNum)) {
      // F209: `items: null` IS the stock-once latch, the shelf idiom
      // one line up - StockHouseContainer runs on first access
      // (PlayerActivate.cs:915-918), and the scene cache preserves
      // null so an unopened chest stays unstocked across visits. Born
      // `[]` it read as already-stocked-empty and no one ever filled it.
      containers.push({ cpu, matrix, items: null, record: containerTextureRecord(p.modelIdNum) });
    }
  }
  // Interior swing doors run on the ActionSystem (P4): the verbatim
  // -90 / 1.5 s toggle with trigger-at-open-start - inner rooms open,
  // and they are audible (DaggerfallInterior.AddActionDoors builds them
  // from Option_InteriorDoorPrefab, which carries the same
  // DaggerfallActionDoor component the dungeon doors have).
  const actions = new ActionSystem(collider);
  attachInteriorDoorSounds(actions);
  const dynamicDraws = [];
  for (const d of interior.actionDoors) {
    // The same seam as the placements above: addDoor reads
    // `cpu.positions`, and the push would otherwise hand the frame
    // loop a {gpu: null} entry. A door model this data set lacks costs
    // the door, not the building.
    const gpu = await getGpuMesh(d.modelIdNum);
    const cpu = cpuModels.get(d.modelIdNum);
    if (!gpu || !cpu) {
      console.warn(`[interior] action-door model ${d.modelIdNum} is not in this ARCH3D - the door is skipped`);
      continue;
    }
    dynamicDraws.push({ gpu, object: actions.addDoor(cpu, parent(d.matrix)) });
  }

  // People (C1): AddPeople's data layer - base positions batch through
  // the same billboard path as flats; the StaticNPC inputs ride on the
  // returned people list (parent-frame, like everything else here).
  //
  // P1: ...and AddPeople's VISIBILITY TAIL (:1206-1226), which C1
  // routed because it needed banking. `opts.peopleVisible` is the
  // host's already-evaluated answer - the host owns the clock, the
  // guild dictionary, the deed store and the entry latch, and DFU
  // likewise hands AddPeople a resolved `buildingData` rather than
  // making it look anything up. A host that does not pass it (the
  // standalone ?interior route) gets C1's behaviour: everyone stands.
  const visible = opts.peopleVisible ?? true;
  const people = collectInteriorPeople(recordData).map((pn) => {
    const [x, y, z] = parentPt(pn.x, pn.y, pn.z);
    return { ...pn, x, y, z, active: visible, questBehaviour: null };
  });
  // AUDIT 24 (wave 20): AddPeople's LAST act on every person it stands
  // is `QuestMachine.Instance.SetupIndividualStaticNPC(go, obj.FactionID)`
  // (DaggerfallInterior.cs:1224) - inline, at the GameObject, BEFORE
  // PlayerEnterExit reaches AddQuestResourceObjects (:800). The port
  // had the machine half written and NOBODY calling it, so no building
  // NPC ever carried a QuestResourceBehaviour: the follow-up-quest
  // bootstrap click had nothing to click, and an individual the quest
  // had moved somewhere else went on standing at home beside their own
  // copy. The hook runs HERE, at DFU's own moment, so the away arm's
  // SetActive(false) can still take the person out of the batch.
  for (const pn of people) {
    pn.host = {
      staticNpcFactionId: pn.factionID,   // DoClick's individual broadcast reads this
      setActive(active) { pn.active = !!active; },
      destroy() { pn.active = false; },
    };
    // P1: the quest hook is DFU's ELSE branch (:1224) - a person the
    // visibility gate took out is NOT handed to the quest machine.
    // Wiring a hidden individual would put a clickable quest NPC
    // inside a shuttered shop, and would let an away-arm SetActive
    // put back someone the building rules had removed.
    if (!visible) continue;
    const setup = opts.setupStaticNpc?.(pn, pn.host);
    if (setup && setup !== true) pn.questBehaviour = setup;
  }

  // C4c (?voxelfolk): people stand as the bare Rewrite humanoid - one
  // packed mesh, per-person matrices (uniform scale to CLASSIC_HEIGHT,
  // feet on the billboard base). Facing is static until the animation
  // slice. Flag off = the C1 classic billboards, untouched.
  const charDraws = [];
  let _raceMeshes = null;   // AUDIT 23 (hosts-16)
  let animateChars = null; // set when the voxel body builds
  const flatAnims = new FlatAnimator();   // FA1
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
    // NEUTRAL paperdoll (redesign): geometry + AO + snapped-ramp
    // palette shading, baked per face. Ramps come from the loaded
    // ART_PAL sprite (skin from the mid torso, boot from the feet) so
    // the palette matches the game.
    const ramps = deriveClassicRamps(palette, bodyBmp);
    // One rig per race, cached; people instanced onto their race's
    // mesh. The rig IS the engine rig (createCharacterRig over the
    // race face list) - the pre-animate.js inline loco copy this file
    // carried is deleted; idle sway is the canonical IDLE gait.
    const raceMeshes = new Map();
    _raceMeshes = raceMeshes;   // AUDIT 23 (hosts-16): destroy() frees these
    const rigFor = (race) => { let rg = raceMeshes.get(race); if (!rg) { rg = createCharacterRig(renderer, buildRaceCharacter(race, ramps)); raceMeshes.set(race, rg); } return rg; };
    for (const pn of people) {
      if (!pn.active) continue;   // SetActive(false): the away copy does not draw
      const rg = rigFor(raceOfArchive(pn.textureArchive));
      charDraws.push({ mesh: rg.mesh, matrix: trs(pn.x, pn.y - rg.footY * rg.scale, pn.z, 0, 0, 0, rg.scale, rg.scale, rg.scale) });
    }
    animateChars = (t, mode = 'idle') => {
      const L = mode === 'walk' ? WALK : IDLE;
      for (const rg of raceMeshes.values()) {
        if (mode === 'off') rg.drive(0, POSE_L, null, false);
        else rg.drive(t * L.cadence, L, null, true);
      }
    };
  } else {
    for (const pn of people) {
      if (!pn.active) continue;   // SetActive(false): the away copy does not draw
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
    const batch = renderer.createBillboardBatch(archive, record, size, centers);
    armFlatAnim(batch, t, archive, record, flatAnims, uploadRecordFrame);
    billboardBatches.push(batch);
  }

  // U23: the STATIC NPC's own billboard extent, which the activation
  // ray needs. DFU gives each StaticNPC a BoxCollider sized to its
  // billboard (DaggerfallBillboard/Billboard.cs SetMaterial ->
  // `collider.size = new Vector3(size.x, size.y, 0.1f)`), and the
  // billboard turns to face the player every frame, so the volume it
  // actually occupies over a turn is the SWEPT box - square in x/z.
  // That is what the AABB below is; a fixed 0.1 depth would miss from
  // the side. Ledger A, and only for the ray: nothing draws from it.
  //
  // The voxelfolk branch never fills flatGroups for people, so the
  // size is read here, off the archive, either way.
  for (const pn of people) {
    if (!pn.active) continue;   // SetActive(false) takes the BoxCollider with it
    const t = await getTexture(pn.textureArchive);
    if (!t || pn.textureRecord >= t.recordCount) continue;
    const size = scaledBillboardSize(t.getSize(pn.textureRecord), t.getScale(pn.textureRecord));
    pn.width = size.w;
    pn.height = size.h;
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

  // HC1 - the spawn points into the parent frame, like every other
  // coordinate here. NO DFU CORE CALLER consumes GetRandomSpawnPoint
  // or the SpawnPoints property (a 706-file sweep of the pinned
  // clone) - the surface is mod-facing, ported for parity and for
  // whatever the enemies arc grows into.
  const spawnPoints = interior.spawnPoints.map(([x, y, z]) => parentPt(x, y, z));

  return {
    drawList,
    actions,
    dynamicDraws,
    billboardBatches,
    flatAnims,   // FA1: the host ticks the flats it draws
    parentPt,   // Q4-v: the quest mount parents marker positions through the same transform
    lights,
    texRemap,
    markers,
    people,
    charDraws,
    animateChars,
    flatCount: interior.flats.length,
    ladders,
    containers,
    shelves,   // E2: shop shelf models (stocked lazily by the mode host)
    enterMarkers,
    spawnPoints,
    /** GetRandomSpawnPoint (DaggerfallInterior.cs:1298-1311): null is
     *  DFU's `return false` - the caller uses its own fallback. The
     *  pick is Random.Range(0, count), int-exclusive. */
    getRandomSpawnPoint: (roll = Math.random) =>
      (spawnPoints.length === 0 ? null : spawnPoints[Math.floor(roll() * spawnPoints.length)]),
    doors: interior.doors.map((d) => ({ ...d, matrix: parent(d.matrix) })),
    collider,
    destroy() {
      for (const b of billboardBatches) renderer.destroyBatch(b);
      // AUDIT 23 (hosts-16): the ?voxelfolk per-race rigs mint real GPU
      // meshes per context - every interior exit leaked them.
      for (const rg of _raceMeshes?.values?.() ?? []) renderer.destroyMesh(rg.mesh);
      _raceMeshes?.clear?.();
    },
  };
}
