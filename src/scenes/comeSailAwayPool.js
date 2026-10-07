// @ts-check
// CSA-B (2026-09-27): COME SAIL AWAY'S BOATS, DRAWN - what Unity draws of a
// built boat (systems/comeSailAwayBoat.js), drawn through the port's renderer:
//
// - every ACTIVE object's switched-on MeshRenderer over its MeshFilter's mesh,
//   each submesh in the Daggerfall texture its slot settled on
//   (systems/comeSailAwayModels.js), the textures out of the player's own
//   ARENA2 through the host's pipeline, as every model's are;
// - the classic models the helpers stand (the bed, a model helper's), through
//   the pipeline's own cache;
// - each sail's FixDeformations holder: its LateUpdate's timer, and on a bake
//   BakeMesh and RecalculateNormals (world/skinnedBake.js) written over the
//   holder's own mesh (renderer.updateMeshVertices), drawn at the holder -
//   nothing until the first bake, as the C#'s empty baked mesh is;
// - each billboard (the crew, the lanterns, the fire) as a flat facing the
//   camera, its centre on its object (a DaggerfallBillboard's quad is centred
//   on its GameObject; the port's batches stand on their base - rmbFlats
//   centredBase), sized by its record and its object's world scale, a lantern
//   whose SetLights made its _EmissionColor black drawn with no emission;
// - each lantern's light while it is on: SetLights switches the Light and DFU's
//   two behaviours on it, and those two decide it frame by frame as DFU's own
//   code does - DaggerfallLight sets it to IsCityLightsOn on the first frame it
//   runs and at each change of that flag after (Option_AutomateCityLights,
//   DFU's default true; the prefab's Animate and InteriorLight read false), and
//   DungeonLightHandler, every 0.4 s of game time it has run, sets it to
//   "within 51.5 m of the player on the ground plane" (2060 x GlobalScale).
//   The two Updates run in that order within a frame (Unity names no order
//   between them; the port declares this one).
//
// Not drawn here, and whose: the hull's WaterMask (never - CSA-F: it writes
// colour alone before any opaque thing and the sea or the hull always draws
// over it), the particle systems (render/comeSailAwayRender.js, CSA-F), the
// colliders the player stands on and the triggers the ray answers (CSA-C /
// CSA-D).
//
// deps = { renderer, pipeline: scenes/dataPipeline.js's { getTexture, uploadRecord, getGpuMesh, gpuMeshes, cpuModels,
//          textureFiles, markClassicArt, isClassicArt }, fetchFn (the vendored files' fetch), log }

import { loadComeSailAwayModels, rendererModel, rendererModelKey, bundleSlots } from '../systems/comeSailAwayModels.js';
import { spawnBoat, boatAssetNeeds, DUNGEON_LIGHT_HANDLER, HULL_NAMES, setBoatVariant, Boat, FIRST_HULL_MODEL_ID, meshLocalBounds, worldBounds } from '../systems/comeSailAwayBoat.js';
import { resolveNodePointer, instantiatePrefab, prefabShapeStamp } from '../world/prefabNode.js';
import { StaticBatchBuilder } from '../render/staticBatch.js';   // AUDIT NAV1 (#13): a boat's still parts merged as a town's statics are
import { instanceParticleSystems } from '../world/unityParticles.js';
import { bakeSkinnedMesh, recalculateNormals, fixDeformationsTick } from '../world/skinnedBake.js';
import { billboardSize } from '../world/rmbFlats.js';
import { GLOBAL_SCALE } from '../world/meshReader.js';
import { multiply, identity } from '../world/mat4.js';
import { spherePlanes, sphereInPlanes, transformSphere } from '../render/bounds.js';   // AUDIT NAV1 (#13): the boats culled as the world's meshes are
import { cullDisabled } from '../render/frustum.js';
import { mat4FromQuatPosScale, quatRotateInto } from '../world/quat.js';
import { colliderPoses, boxColliderTriangles, invertAffine, BUILTIN_COLLIDER_MESHES } from '../world/prefabColliders.js';   // DECK-WALK: a hull's colliders at rest
import { buildDeck } from '../systems/naval/navalDeck.js';   // DECK-WALK: her walkable deck
import { hullBuild, setGalleonStanding, setShipStanding } from '../systems/naval/navalShips.js';   // AUDIT GN-G4: and hull 2's build follows the hull that stands (SHIPS-2: hull 4's and hull 1's)
import { registerGalleonArt, GALLEON_ARCHIVE, galleonGlow, BANDS as GALLEON_BANDS } from '../world/galleonArt.js';   // GALLEON: the new galleon's own pictures, on the texture door before her meshes ask
import { registerCarrackArt, CARRACK_ARCHIVE, carrackGlow, BANDS as CARRACK_BANDS } from '../world/carrackArt.js';   // SHIPS-2: and the new carrack's,
import { registerLargeBoatArt, LARGE_BOAT_ARCHIVE } from '../world/largeBoatArt.js';   // and the new large boat's
import { toColor32 } from '../formats/color32Order.js';
import { addVendorTextures } from '../systems/textureReplacement.js';

/** DungeonLightHandler.CheckLight's reach: UnscaledBlockRange x MeshReader.GlobalScale. */
export const LANTERN_HANDLER_REACH = DUNGEON_LIGHT_HANDLER.unscaledBlockRange * GLOBAL_SCALE;
/** How many of the boats' lit lanterns reach the host's light list - the nearest, as camps.js hands its fires
 *  (the port's renderer holds sixteen lights, forty-eight on the lane; a galleon carries eighteen lanterns). */
export const CSA_LIGHTS_MAX = 8;
/** AUDIT NAV1 (the presentation): the hull whose FlagObject a flagless sea ship is given (the Small Ship - graftColours). */
export const FLAG_DONOR_HULL = 2;
/** SHIPS-2: THE PORT'S OWN SHIPS' PICTURES - each standing ship's archive, how it is put on the texture door, the
 *  records whose glass glows at night (cut while the world loads) and the glow itself (its emission mask), by the models'
 *  key for the ship (systems/comeSailAwayModels.js PORT_SHIPS). */
export const PORT_ART = Object.freeze({
  galleon: Object.freeze({ archive: GALLEON_ARCHIVE, register: registerGalleonArt, glowRecs: GALLEON_BANDS.sternWindows.recs, glow: galleonGlow }),
  carrack: Object.freeze({ archive: CARRACK_ARCHIVE, register: registerCarrackArt, glowRecs: CARRACK_BANDS.transom.recs, glow: carrackGlow }),
  largeBoat: Object.freeze({ archive: LARGE_BOAT_ARCHIVE, register: registerLargeBoatArt, glowRecs: Object.freeze([]), glow: () => null }),
});
/** A picture's night glow, whichever port ship's archive it is in (null for any other). */
const glowOf = (archive, record) => Object.values(PORT_ART).find((a) => a.archive === archive)?.glow(record) ?? null;

/** Each active object under `root` with its world matrix, depth first - the parent's matrix carried down once. */
export function* activeObjects(root) {
  if (!root?.activeSelf) return;
  const stack = [[root, root.localMatrix()]];
  while (stack.length) {
    const [n, m] = stack.pop();
    yield [n, m];
    for (let i = n.children.length - 1; i >= 0; i--) {
      const c = n.children[i];
      if (c.activeSelf) stack.push([c, multiply(m, c.localMatrix(), new Float32Array(16))]);
    }
  }
}

/** The world box of a classic model's vertices (Mesh.bounds - DFU's MeshReader meshes bound themselves). */
export function vertexBox(positions) {
  if (!positions?.length) return null;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let d = 0; d < 3; d++) { const v = positions[i + d]; if (v < min[d]) min[d] = v; if (v > max[d]) max[d] = v; }
  return { min, max };
}

/**
 * DaggerfallLight.Update and DungeonLightHandler.Update for one lantern, one frame.
 * @param {any} light - the Light record (its `node` the light's object)
 * @param {{ dt:number, cityLightsOn:boolean, playerPosition:number[] }} f
 */
export function lanternLightUpdate(light, { dt, cityLightsOn, playerPosition }) {
  const n = light.node;
  if (!n.activeInHierarchy) return;
  const dl = n.getComponent('DaggerfallLight');
  if (dl?.enabled) {
    if (dl.lastCityLightsFlag == null) dl.lastCityLightsFlag = !cityLightsOn;   // ReadyCheck: "force first update to set lights"
    if (!dl.InteriorLight && dl.lastCityLightsFlag !== cityLightsOn) { light.enabled = cityLightsOn; dl.lastCityLightsFlag = cityLightsOn; }
  }
  const h = n.getComponent('DungeonLightHandler');
  if (h?.enabled) {
    h.timer = Math.fround(h.timer + Math.fround(dt));
    if (h.timer > Math.fround(h.UpdateInSeconds)) {
      const p = n.position;
      light.enabled = !(Math.hypot(p[0] - playerPosition[0], p[2] - playerPosition[2]) > LANTERN_HANDLER_REACH);
      h.timer = 0;
    }
  }
}

/** SHIP-FADE: under this share of a fading ship, her flats (her crew, her lanterns) stand down. */
export const FADE_FLATS = 0.5;
/** AUDIT NAV1 (the frame's cost, #13): a boat's mesh narrower on the screen than this (pixels, its sphere's width at the
 *  drawing buffer's height) is not drawn. */
export const CULL_DETAIL_PX = 1;
/** AUDIT NAV1 (#13): the fewest still parts a boat's batch is made of - one is its own draw already - and how many
 *  frames running a part's chain reads the same before it is merged. */
export const STILL_MIN = 2;
export const STILL_FRAMES = 20;
/** AUDIT GN2-RG1: how far (metres; a rotation column's unit) an every-frame holder's bone may stand from where it stood
 *  at its last bake and the bake still stand - a millimetre, under the float noise of a ship 2 km off and a twenty-eighth
 *  of her rope's radius. */
export const RIG_STILL_M = 0.001;

export function createComeSailAwayPool({ renderer = null, pipeline = null, fetchFn = null, log = console } = {}) {
  /** @type {any} */ let models = null;
  let modelsLoading = null, modelsFailed = false;
  /** @type {any[]} */ const boats = [];
  /** CSA-J: the peers' boats (scenes/comeSailAwayPeers.js) - drawn, baked and lit as mine, but never in `boats`, so
   *  the host's rays and activations (which read `boats`) meet them only where CSA-K asks by name - another's boat's own
   *  ray (scenes/comeSailAwayAboard.js); its collider stands every one (FIELD BUGS 2026-10-01b: world.js csaSyncColliders). */
  /** @type {any[]} */ const peerBoats = [];
  /** NAV-C: the sea's ships (scenes/navalHost.js) - the Iliac Bay's pirates, merchantmen and navies, built on these same
   *  hulls: drawn, baked and lit as mine, never in `boats` (no helm is taken on one, no deed places one); the naval host
   *  poses them, and stands the near ones in the world's collider itself. */
  /** @type {any[]} */ const seaBoats = [];
  const drawn = () => (peerBoats.length || seaBoats.length ? boats.concat(peerBoats, seaBoats) : boats);
  const _cullOn = !cullDisabled();   // AUDIT NAV1 (#13): ?cull=off, read once, as the world reads it
  const _cullPv = new Float32Array(16), _cullPlanes = new Float32Array(24), _cullSphere = new Float32Array(4), _cullBox = new Float32Array(6);
  const meshes = new Map();      // rendererModelKey -> gpu mesh | null
  const meshLoads = new Map();   // in flight
  const bakes = new Map();       // FixDeformations script -> { gpu, positions, normals, loading, rig? (AUDIT GN2-RG1) }
  const _rigV = [0, 0, 0];
  const flats = new Map();       // billboard object -> batch
  const warned = new Set();
  const warnOnce = (k, ...a) => { if (warned.has(k)) return; warned.add(k); log?.warn?.(...a); };
  // AUDIT PRE-MERGE 0928 R5: ONE WALK A FRAME. Each drawn boat's active objects and their world matrices, walked once by
  // `frame` into storage kept per node and reused frame to frame (activeObjects' order and arithmetic, none of its
  // allocations) - the holders, the flats and the draw read it. A walk made outside a frame (a draw with no frame
  // before it) is made where it is read and never kept; a boat re-dressed or moved by the origin is walked again.
  /** boat -> { stamp, nodes, mats } */
  const walks = new Map();
  /** node -> its world matrix, kept */
  const nodeMats = new WeakMap();
  const _walkStack = [];
  const _local = new Float32Array(16);
  let walkStamp = 0;
  const matOf = (n) => { let m = nodeMats.get(n); if (!m) { m = new Float32Array(16); nodeMats.set(n, m); } return m; };
  function walkBoat(boat, stamp) {
    let w = walks.get(boat);
    if (!w) { w = { stamp: -1, nodes: [], mats: [] }; walks.set(boat, w); }
    w.stamp = stamp; w.nodes.length = 0; w.mats.length = 0;
    const root = boat.GameObject;
    if (!root?.activeSelf) return w;
    mat4FromQuatPosScale(root.localRotation, root.localPosition, root.localScale, matOf(root));
    const stack = _walkStack;
    stack.length = 0;
    stack.push(root);
    while (stack.length) {
      const n = stack.pop(), m = nodeMats.get(n);
      w.nodes.push(n); w.mats.push(m);
      for (let i = n.children.length - 1; i >= 0; i--) {
        const c = n.children[i];
        if (!c.activeSelf) continue;
        multiply(m, mat4FromQuatPosScale(c.localRotation, c.localPosition, c.localScale, _local), matOf(c));
        stack.push(c);
      }
    }
    return w;
  }
  /** This frame's walk of a boat - the frame's own, or one made now and kept for nobody. */
  const walkOf = (boat) => { const w = walks.get(boat); return w && w.stamp === walkStamp && walkStamp > 0 ? w : walkBoat(boat, -1); };

  async function ensureModels() {
    if (models || modelsFailed) return models;
    modelsLoading ??= loadComeSailAwayModels(fetchFn ?? globalThis.fetch, undefined, log).then((m) => {
      // GALLEON: her pictures are the port's own - registered as GALLEON_ARCHIVE's stand-ins as her model loads, before
      // anything asks the pipeline for that archive, so they upload as every hull's do (AUDIT GN2-PF3: painted when the
      // preload asks for it, below; this said "made at boot", and they were made at her first draw). AUDIT GN2-PF5: and
      // they are her CLASSIC art, as ARENA2's is every other hull's - Retro Mode's no-mip cap reaches them
      // SHIPS-2: and the new carrack's and the new large boat's, each as hers are, when their own models stand
      for (const [key, art] of Object.entries(PORT_ART)) {
        if (!m?.[key]) continue;
        art.register(addVendorTextures);
        pipeline?.markClassicArt?.(art.archive);
      }
      if (m) { setGalleonStanding(m.galleon); setShipStanding(4, m.carrack); setShipStanding(1, m.largeBoat); }   // AUDIT GN-G4: each hull's numbers are the hull that stands
      models = m; modelsFailed = !m; return m;
    });
    return modelsLoading;
  }

  const billboardSizeOf = (archive, record) => {
    const t = pipeline?.textureFiles?.get(archive);
    if (!t || t.vendor || !(t.recordCount > record)) return null;
    const s = billboardSize(t, record);
    return [s.w, s.h];
  };
  const modelBoundsOf = (id) => vertexBox(pipeline?.cpuModels?.get(id)?.positions);

  /** The ARENA2 a hull reads before it is built: its flats' archives and records, its classic models. */
  async function prepare(hull) {
    const need = boatAssetNeeds({ models }, hull);
    for (const [a, r] of need.flats) {
      try { const t = await pipeline.getTexture(a); if (t?.recordCount > r) pipeline.uploadRecord(a, r); }
      catch (e) { warnOnce(`flat:${a}`, `[come-sail-away] TEXTURE.${a} will not load - the boats' flats of it stand invisible`, e); }
    }
    for (const id of need.models) {
      try { await pipeline.getGpuMesh(id); } catch (e) { warnOnce(`model:${id}`, `[come-sail-away] model ${id} will not load`, e); }
    }
  }

  /**
   * SpawnBoat, with what it reads loaded first. `player` is the PlayerObject's pose at the moment (Unity space).
   * @returns {Promise<any>} the boat, or null when the mod's models are not there
   */
  async function spawn(boat, player) {
    if (!(await ensureModels())) return null;
    await prepare(boat.hull);
    return spawnNow(boat, player);
  }
  /** CSA-C: every hull's needs loaded once, so SpawnBoat can run straight through when the C# calls it. */
  let preloaded = false, preloading = null;
  function preload() {
    preloading ??= (async () => {
      if (!(await ensureModels())) return false;
      for (let hull = 0; hull < HULL_NAMES.length; hull++) await prepare(hull);
      // AUDIT GN2-PF3: her pictures painted (her archive's first ask builds all twenty-three on the vendor door) and her
      // glass's glow cut while the world loads - they were her first mesh's ask (meshFor) or a sail bake's, at the first
      // draw of a hull 2: a 50-120 ms stall the first time she came into view
      // SHIPS-2: every standing port ship's so
      for (const [key, art] of Object.entries(PORT_ART)) {
        if (!models[key]) continue;
        try { await pipeline.getTexture(art.archive); for (const r of art.glowRecs) art.glow(r); }
        catch (e) { warnOnce(`tex:${art.archive}`, `[come-sail-away] TEXTURE.${art.archive} will not load - the boats' faces in it draw nothing`, e); }
      }
      for (let hull = 0; hull < HULL_NAMES.length; hull++) deckOf(hull, 0);   // DECK-WALK: baked while the world loads (10-50 ms a hull), never mid-voyage (AUDIT NAV2 F57: every rig's deck, one a hull)
      preloaded = true;
      return true;
    })();
    return preloading;
  }
  /** CSA-C: SpawnBoat as the C# runs it - at once, on what `preload` brought in; null before that. */
  function spawnNow(boat, player) {
    if (!models) return null;
    boats.push(boat);   // CSA-J (the audit): in the scene before it is built - a SpawnBoat that throws half way (a variant past the hull's) leaves its half-built hull standing, as the C#'s GameObject does
    spawnBoat(boat, { models, player: () => player, billboardSize: billboardSizeOf, modelBounds: modelBoundsOf });
    return boat;
  }
  /** CSA-H: SetBoatVariant (1304-1308) on the pool's own context - a reinitialize instances nothing, so the player's
   *  pose (ImportCustomGameobject's matrix) is never read. The variants stand in the same instance, so every mesh,
   *  bake and flat already made is the same one. */
  function setVariant(boat, variant) {
    setBoatVariant(boat, variant, { models, player: () => ({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }), billboardSize: billboardSizeOf, modelBounds: modelBoundsOf });
    walks.delete(boat);   // AUDIT PRE-MERGE 0928 R5: other objects active now - walked again
  }
  /** CSA-J: a peer's boat, built as SpawnBoat builds one (at the origin - its owner's word poses it) and drawn. */
  function spawnPeerNow(boat) {
    if (!models) return null;
    spawnBoat(boat, { models, player: () => ({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }), billboardSize: billboardSizeOf, modelBounds: modelBoundsOf });
    peerBoats.push(boat);
    return boat;
  }
  /** NAV-C: a sea ship, built as SpawnBoat builds one (at the origin - the naval host poses it) and drawn - with her
   *  colours whatever her hull (graftColours). */
  function spawnSeaNow(boat) {
    if (!models) return null;
    spawnBoat(boat, { models, player: () => ({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }), billboardSize: billboardSizeOf, modelBounds: modelBoundsOf });
    graftColours(boat);
    seaBoats.push(boat);
    return boat;
  }
  /**
   * AUDIT NAV1 (the presentation): A SEA SHIP FLIES HER COLOURS. The Carrack's prefab carries no FlagObject, so the
   * pirate flagship and the merchant carrack flew none; she is given FLAG_DONOR_HULL's own, instanced from that hull's
   * prefab (its particle flag and its inactive helper cube) and stood on the truck of her tallest mast, under that
   * mast so it heels and settles with her. A player's boats keep the mod's rigs as they are (spawnNow grafts nothing).
   */
  function graftColours(boat) {
    if (boat.FlagObject || !boat.MeshObject) return;
    const find = (t) => (!t ? null : t.name === 'FlagObject' ? t : t.children.reduce((f, c) => f ?? find(c), null));
    const donor = find(models.prefab(FIRST_HULL_MODEL_ID + FLAG_DONOR_HULL));
    if (!donor) return;
    let truck = null;
    for (const node of boat.MeshObject.walk()) {
      const local = node.activeInHierarchy ? meshLocalBounds({ models }, node.getComponent('MeshFilter')?.m_Mesh) : null;
      if (!local) continue;
      const wb = worldBounds(node, local);
      if (!truck || wb.max[1] > truck.at[1]) truck = { node, at: [wb.center[0], wb.max[1], wb.center[2]] };
    }
    if (!truck) return;
    const flag = instantiatePrefab(donor, models.components);
    instanceParticleSystems(flag, {});
    flag.setParent(truck.node);
    flag.position = truck.at;
    boat.FlagObject = flag;
    boat.FlagEmitter = flag.getComponentInChildren('ParticleSystem')?.particleSystem ?? null;
    boat.FlagEmitterMain = boat.FlagEmitter?.main ?? null;
  }
  /** OWS2: A HULL'S RIG, read off a boat SpawnBoat builds once a hull on the pool's context and never places or draws -
   *  its five nodes in its own frame (Center, Fore, Aft and the beams off its hull collider's bounds: the Overworld's
   *  launch asks where each would stand before it puts a boat on the water), its sails, its crew, its packing and its
   *  Cargo modifier (whether it crosses a sea at all). Null before the models are in, or for a hull the mod has none of. */
  const hullRigCache = new Map();
  function hullRig(hull) {
    if (!models || !(hull >= 0 && hull < HULL_NAMES.length)) return null;
    let rig = hullRigCache.get(hull);
    if (!rig) {
      const b = new Boat(hull, 0);
      spawnBoat(b, { models, player: () => ({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }), billboardSize: billboardSizeOf, modelBounds: modelBoundsOf });
      rig = Object.freeze({ nodes: b.Nodes.map((n) => [...n.localPosition]), sails: b.Sails.length, crewed: !!b.crewed, packable: !!b.packable, cargo: b.modifierCargoThreshold });
      hullRigCache.set(hull, rig);
    }
    return rig;
  }
  /** Object.Destroy(boat.GameObject): its meshes, bakes and flats go with it. */
  function remove(boat) {
    const list = boats.includes(boat) ? boats : peerBoats.includes(boat) ? peerBoats : seaBoats;
    const i = list.indexOf(boat);
    if (i < 0) return;
    list.splice(i, 1);
    walks.delete(boat);   // AUDIT PRE-MERGE 0928 R5
    const st = stills.get(boat);   // AUDIT NAV1 (#13): her still parts' batch with her
    if (st?.mesh) renderer?.destroyMesh?.(st.mesh);
    stills.delete(boat);
    for (const n of boat.GameObject.walk()) {
      const b = flats.get(n); if (b) { renderer?.destroyBillboardBatch?.(b); flats.delete(n); }
      for (const c of n.components) if (c.type === 'FixDeformations') { const k = bakes.get(c); if (k?.gpu) renderer?.destroyMesh?.(k.gpu); bakes.delete(c); }
    }
  }

  /** A renderer's drawn model, uploaded once with its textures; null this frame while it loads. */
  function meshFor(key, build) {
    if (meshes.has(key)) return meshes.get(key);
    if (!meshLoads.has(key) && renderer?.createMesh) {
      meshLoads.set(key, (async () => {
        const model = build();
        if (!model) { meshes.set(key, null); return; }
        for (const sm of model.subMeshes) {
          try { await pipeline.getTexture(sm.textureArchive); pipeline.uploadRecord(sm.textureArchive, sm.textureRecord, { opaque: true }); }
          catch (e) { warnOnce(`tex:${sm.textureArchive}`, `[come-sail-away] TEXTURE.${sm.textureArchive} will not load - the boats' faces in it draw nothing`, e); }
          // GALLEON: her stern gallery's glass, lit at night as a town's windows are (the window style the host sets -
          // its emission mask is the glass alone, galleonArt.js galleonGlow). AUDIT GN-R15: a pack's own picture over
          // her stern windows (a loose 38131_6 or _21) glows by HER glass, as a pack's over a town's window glows by
          // the classic picture's (scenes/dataPipeline.js's window arm cuts the mask from the classic bitmap). AUDIT
          // GN2-PF5: flagged as her picture is - her classic art's, under Retro Mode's cap with it
          // SHIPS-2: the new carrack's transom gallery's glass the same
          { const glow = glowOf(sm.textureArchive, sm.textureRecord); if (glow) renderer.uploadEmissionTexture?.(sm.textureArchive, sm.textureRecord, toColor32(glow), { replacement: !pipeline.isClassicArt?.(sm.textureArchive) }); }
        }
        meshes.set(key, renderer.createMesh(model));
      })().catch((e) => { meshes.set(key, null); warnOnce(`mesh:${key}`, '[come-sail-away] a boat mesh failed to build', e); }).finally(() => meshLoads.delete(key)));
    }
    return null;
  }

  /** FixDeformations.LateUpdate over one holder: the timer, and on its frame the bake written to the GPU. AUDIT GN2-RG1:
   *  a holder `everyFrame` (the new galleon's running rope - world/galleonRig.js BAKE, read on by systems/
   *  comeSailAwayBoat.js) bakes on every frame the game runs, never paused (the timer never counts then) - on the tenth
   *  of a second a rope from a swinging spar to her deck was drawn where both stood at its last bake, its end 1.2-1.7 m
   *  off its spar at the auto-trim's 100 degrees a second - and not again while its bones stand where they did at its
   *  last bake (`rigStill`: a moored boat's rope, a sea ship's, her booms home - the same mesh, no upload). */
  function lateUpdateHolder(script, holder, dt) {
    if (script.everyFrame ? !(dt > 0) : !fixDeformationsTick(script, dt)) return;
    const skinnedNode = holder.parent;
    const smr = script.skinnedMeshRenderer;
    const g = models.geometry(smr.m_Mesh?.mesh);
    if (!g?.bindPoses) return;
    const bones = smr.m_Bones.map((b) => resolveNodePointer(skinnedNode, b));
    const boneWorld = bones.map((b) => (b ? b.worldMatrix() : null));
    let k = bakes.get(script);
    if (!k) { k = { gpu: null, positions: new Float32Array(g.vertexCount * 3), normals: new Float32Array(g.vertexCount * 3), loading: false }; bakes.set(script, k); }
    const pose = { position: skinnedNode.position, rotation: skinnedNode.rotation };
    if (script.everyFrame && rigStill(k, boneWorld, pose)) return;
    bakeSkinnedMesh(g, boneWorld, g.bindPoses, pose, k.positions);
    recalculateNormals(k.positions, g.indices, g.subMeshes, k.normals);
    script.bakedMesh = k;
    if (k.gpu) { renderer.updateMeshVertices(k.gpu, k.positions, k.normals); return; }
    if (k.loading || !renderer?.createMesh) return;
    k.loading = true;
    const model = rendererModel({ ...g, positions: k.positions, normals: k.normals }, script.meshRenderer.materials);
    if (!model) return;
    (async () => {
      for (const sm of model.subMeshes) {
        try { await pipeline.getTexture(sm.textureArchive); pipeline.uploadRecord(sm.textureArchive, sm.textureRecord, { opaque: true }); } catch { /* the face draws nothing */ }
      }
      if (!bakes.has(script)) return;   // the boat went while the textures loaded
      k.gpu = renderer.createMesh({ ...model, positions: k.positions.slice(), normals: k.normals.slice() });
      renderer.updateMeshVertices(k.gpu, k.positions, k.normals);   // the newest bake, if one ran while it loaded
    })().catch((e) => warnOnce('bake', '[come-sail-away] a sail bake failed to upload', e));
  }

  /** AUDIT GN2-RG1: does an every-frame holder's every bone stand against its renderer (its matrix with the renderer's
   *  position and rotation undone, the bake's own frame) within RIG_STILL_M of where it stood at the holder's last bake?
   *  Not: this frame's is kept, for the bake it asks. */
  function rigStill(k, boneWorld, pose) {
    const n = boneWorld.length * 12;
    if (!k.rig || k.rig.length !== n) { k.rig = new Float64Array(n); k.rigNow = new Float64Array(n); k.rigBaked = false; }
    const q = pose.rotation, p = pose.position, back = [-q[0], -q[1], -q[2], q[3]], v = _rigV, now = k.rigNow;
    let still = k.rigBaked;
    for (let b = 0; b < boneWorld.length; b++) {
      const m = boneWorld[b];
      if (!m) { k.rigBaked = false; return false; }
      for (let c = 0; c < 4; c++) {
        if (c < 3) quatRotateInto(back, m[c * 4], m[c * 4 + 1], m[c * 4 + 2], v);
        else quatRotateInto(back, m[12] - p[0], m[13] - p[1], m[14] - p[2], v);
        for (let j = 0; j < 3; j++) { const o = b * 12 + c * 3 + j; now[o] = v[j]; if (Math.abs(v[j] - k.rig[o]) > RIG_STILL_M) still = false; }
      }
    }
    if (still) return true;
    k.rig.set(now); k.rigBaked = true;
    return false;
  }

  /**
   * One frame, after the boats moved: the holders' LateUpdate, the lanterns' two behaviours, the flats' batches.
   * @param {number} gameDt - Time.deltaTime (zero while paused, scaled with the world)
   * @param {{ minuteOfDay?:number, cityLightsOn?:boolean, playerPosition?:number[] }} [world]
   */
  function frame(gameDt, world = {}) {
    const playerPosition = world.playerPosition ?? [0, 0, 0];
    walkStamp++;   // AUDIT PRE-MERGE 0928 R5: this frame's one walk, read below and by the draw
    for (const boat of drawn()) {
      const { nodes } = walkBoat(boat, walkStamp);
      for (const n of nodes) {
        for (const c of n.components) {
          if (c.type === 'FixDeformations') lateUpdateHolder(c, n, gameDt);
        }
      }
      for (const l of boat.Lights) lanternLightUpdate(l, { dt: gameDt, cityLightsOn: !!world.cityLightsOn, playerPosition });
    }
    syncFlats();
  }

  /** The billboards: a batch per active, drawn flat, its centre on its object. */
  function syncFlats() {
    const seen = new Set();
    for (const boat of drawn()) {
      if ((boat.fade ?? 1) < FADE_FLATS) continue;   // SHIP-FADE: a ship half faded stands no flat - her crew and lanterns go first
      const { nodes, mats } = walkOf(boat);   // AUDIT PRE-MERGE 0928 R5
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i], m = mats[i];
        const bb = n.getComponent('DaggerfallBillboard');
        if (!bb) continue;
        const r = n.getComponent('MeshRenderer');
        if (!r || r.m_Enabled === false) continue;
        const [w, h] = bb.Summary.Size;
        if (!(w > 0 && h > 0)) continue;
        let b = flats.get(n);
        if (!b) {
          if (!renderer?.createBillboardBatch) continue;
          b = renderer.createBillboardBatch(bb.Summary.Archive, bb.Summary.Record, { w, h }, [[0, 0, 0]]);   // AUDIT PRE-MERGE 0928 R6: its centre stands still - the origin moves it, which SC1's origin test sees; a batch built dynamic is replayed by every lantern near it every frame
          b.origin = [0, 0, 0];
          flats.set(n, b);
        }
        const s = n.lossyScaleOf(m);
        b.size = { w: w * Math.abs(s[0]), h: h * Math.abs(s[1]) };
        b.origin[0] = m[12]; b.origin[1] = m[13] - b.size.h / 2; b.origin[2] = m[14];
        b.emissionOff = !!(r.emissionColor && r.emissionColor[0] === 0 && r.emissionColor[1] === 0 && r.emissionColor[2] === 0);
        b.conceal = boat.conceal ?? null;   // AUDIT PRE-MERGE 0928 O4: a concealed owner's crew and lanterns wear the owner's look (the cart pool's horse)
        seen.add(n);
      }
    }
    for (const [n, b] of flats) if (!seen.has(n)) { renderer?.destroyBillboardBatch?.(b); flats.delete(n); }
  }
  const batches = () => [...flats.values()];

  /**
   * The boats' meshes, in the host's world pass.
   *
   * AUDIT NAV1 (the frame's cost, #13): CULLED AS THE WORLD'S MESHES ARE. Every mesh of every boat was drawn, wherever
   * she was - the sea's ships out to 1.9 km all round, 10 to 140 meshes each, half and more behind the eye. Each mesh's
   * sphere (its bundle's, through its matrix) is asked of the frame's planes (the renderer's own matrices, EV3/GHOST1's
   * normalised test): one off screen is not drawn, and is recorded for the shadow maps alone when it would cast into
   * them (SHADOW-REACH: the world's law - no shadow lost with its caster off screen). And a mesh whose sphere stands
   * under a pixel across (CULL_DETAIL_PX, at the drawing buffer's height) - a far ship's crates and lanterns, never
   * her hull at any range she sails - is not drawn: there is nothing of it to see. `?cull=off` draws everything.
   */
  function draw(r = renderer, texRemap = null) {
    if (!models || !r?.drawMesh) return 0;
    const cull = _cullOn && !!r._proj && !!r._view;
    if (cull) spherePlanes(multiply(r._proj, r._view, _cullPv), _cullPlanes);
    const eye = r._camPos ?? null;
    const pxPerM = cull && eye ? r._proj[5] * (r.gl?.drawingBufferHeight ?? 0) / 2 : 0;   // a metre's pixels a metre off
    let n = 0;
    const one = (gpu, m) => {
      if (cull && gpu.bounds && gpu.bounds[3] > 0) {
        const sp = transformSphere(m, gpu.bounds, _cullSphere);
        if (pxPerM > 0 && 2 * sp[3] * pxPerM < CULL_DETAIL_PX * Math.hypot(sp[0] - eye[0], sp[1] - eye[1], sp[2] - eye[2])) return;   // under a pixel
        if (!sphereInPlanes(_cullPlanes, sp[0], sp[1], sp[2], sp[3])) {
          const box = _cullBox;
          box[0] = sp[0] - sp[3]; box[1] = sp[1] - sp[3]; box[2] = sp[2] - sp[3]; box[3] = sp[0] + sp[3]; box[4] = sp[1] + sp[3]; box[5] = sp[2] + sp[3];
          if (r.shadowReach?.(box)) r.recordShadowMesh?.(gpu, m, texRemap);
          return;
        }
      }
      r.drawMesh(gpu, m, texRemap); n++;
    };
    for (const boat of drawn()) {
      // SHIP-FADE (2026-10-02): a ship fading in or out of the world draws her share of her fragments (the renderer's
      // dissolve), put back whole after her; one faded away draws nothing
      const fade = Math.max(0, Math.min(1, boat.fade ?? 1));
      if (fade <= 0) continue;
      if (fade < 1) r.setDissolve?.(fade);
      const { nodes, mats } = walkOf(boat);   // AUDIT PRE-MERGE 0928 R5
      const still = [];   // AUDIT NAV1 (#13): this frame's parts that hang in her hull's frame
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i], m = mats[i];
        const mr = node.getComponent('MeshRenderer');
        if (!mr || mr.m_Enabled === false || mr.materials?.[0]?.billboard) continue;
        let gpu = null, key = null, slots = null, mesh = null;
        if (mr.classicModel != null) gpu = pipeline?.gpuMeshes?.get(mr.classicModel) ?? null;
        else {
          const mf = node.getComponent('MeshFilter');
          if (mf?.baked) { const fix = node.getComponent('FixDeformations'); gpu = bakes.get(fix)?.gpu ?? null; }
          else if (mf?.m_Mesh?.mesh) {
            mesh = mf.m_Mesh.mesh;
            slots = mr.materials ?? bundleSlots(mr);
            key = rendererModelKey(mesh, slots);
            gpu = meshFor(key, () => rendererModel(models.geometry(mesh), slots));
          }
        }
        if (!gpu) continue;
        const chain = key && boat.MeshObject ? stillChain(boat, node) : null;
        if (chain) { still.push({ node, key, mesh, slots, chain, gpu, m }); continue; }
        one(gpu, m);
      }
      const batch = stillBatch(boat, still);
      const frame = batch ? nodeMats.get(boat.MeshObject) : null;
      if (batch && frame) one(batch.mesh, frame);
      for (const c of still) if (!batch || !frame || !batch.nodes.has(c.node)) one(c.gpu, c.m);
      if (fade < 1) r.setDissolve?.(1);
    }
    return n;
  }

  // AUDIT NAV1 (the frame's cost, #13): A BOAT'S STILL PARTS, ONE MESH. A war galley is 136 meshes, 107 of them her
  // oars, and every one was a draw of its own every frame she stood in view. The bundle meshes that hang still in her
  // hull's frame - under her MeshObject, each part's chain down from it reading the same (its local position, rotation
  // and scale) for STILL_FRAMES frames running - are merged into one mesh a texture (render/staticBatch.js, PERF4's
  // builder: the town's own), laid in the MeshObject's frame as they read and drawn with its matrix: the same triangles,
  // the same textures, the same light (the shader lights by world position and normal, both of which the merge carries).
  // Read each frame, never by a tolerance: a part that moves in her frame (a flag turned to the wind, a boom trimmed, a
  // door opened) leaves the batch that frame and is drawn on its own until it has been still STILL_FRAMES again; a part
  // switched on or off, or another mesh, and the batch is made again. Fewer than STILL_MIN parts are not worth one.
  /** boat -> { parts: Map(node -> { snap, calm }), members: [{ node, key }], nodes: Set, mesh } */
  const stills = new Map();
  const _stillChains = new WeakMap();   // node -> { stamp, frame, chain }
  /** The nodes from `node`'s boat's MeshObject's child down to it (none: it is the MeshObject), or null when it does
   *  not hang in that frame - kept per tree shape. */
  function stillChain(boat, node) {
    const stamp = prefabShapeStamp(), frame = boat.MeshObject;
    const had = _stillChains.get(node);
    if (had && had.stamp === stamp && had.frame === frame) return had.chain;
    let chain = [];
    let at = node;
    for (; at && at !== frame; at = at.parent) chain.push(at);
    if (!at) chain = null;
    chain?.reverse();
    _stillChains.set(node, { stamp, frame, chain });
    return chain;
  }
  /** A chain's local values as they read now (position, rotation, scale a node), into `out`. */
  function chainSnap(chain, out = new Float64Array(chain.length * 10)) {
    chain.forEach((c, k) => { const q = c.localRotation, t = c.localPosition, sc = c.localScale, o = k * 10; out[o] = q[0]; out[o + 1] = q[1]; out[o + 2] = q[2]; out[o + 3] = q[3]; out[o + 4] = t[0]; out[o + 5] = t[1]; out[o + 6] = t[2]; out[o + 7] = sc[0]; out[o + 8] = sc[1]; out[o + 9] = sc[2]; });
    return out;
  }
  /** Does a chain still read `snap`? */
  function chainReads(chain, snap) {
    if (snap.length !== chain.length * 10) return false;
    for (let k = 0; k < chain.length; k++) {
      const c = chain[k], q = c.localRotation, t = c.localPosition, sc = c.localScale, o = k * 10;
      if (snap[o] !== q[0] || snap[o + 1] !== q[1] || snap[o + 2] !== q[2] || snap[o + 3] !== q[3] || snap[o + 4] !== t[0] || snap[o + 5] !== t[1]
        || snap[o + 6] !== t[2] || snap[o + 7] !== sc[0] || snap[o + 8] !== sc[1] || snap[o + 9] !== sc[2]) return false;
    }
    return true;
  }
  /** Each of this frame's parts (`still`, in the walk's order) read, and the boat's batch of those still long enough -
   *  the one made while its members are the same parts, else made again. Null: no batch (fewer than STILL_MIN). */
  function stillBatch(boat, still) {
    let st = stills.get(boat);
    if (!st) { st = { parts: new Map(), members: [], nodes: new Set(), mesh: null }; stills.set(boat, st); }
    const calm = [];
    for (const c of still) {
      let rec = st.parts.get(c.node);
      if (!rec) { rec = { snap: chainSnap(c.chain), calm: 0 }; st.parts.set(c.node, rec); }
      else if (chainReads(c.chain, rec.snap)) rec.calm++;
      else { rec.snap = chainSnap(c.chain); rec.calm = 0; }
      if (rec.calm >= STILL_FRAMES) calm.push(c);
    }
    let same = !!st.mesh && calm.length === st.members.length;
    for (let k = 0; same && k < calm.length; k++) same = calm[k].node === st.members[k].node && calm[k].key === st.members[k].key;
    if (same) return st;
    if (st.mesh) { renderer?.destroyMesh?.(st.mesh); st.mesh = null; }
    st.members = []; st.nodes = new Set();
    if (calm.length < STILL_MIN || !renderer?.createMesh) return null;
    const builder = new StaticBatchBuilder();
    for (const c of calm) {
      const model = rendererModel(models.geometry(c.mesh), c.slots);
      if (!model) continue;
      let rel = identity();
      for (const node of c.chain) rel = multiply(rel, mat4FromQuatPosScale(node.localRotation, node.localPosition, node.localScale, _local));
      builder.add(model, rel, (a, rec) => `${a}_${rec}`);
      st.members.push({ node: c.node, key: c.key });
      st.nodes.add(c.node);
    }
    const merged = st.members.length >= STILL_MIN ? builder.finish() : null;
    if (!merged) { st.members = []; st.nodes = new Set(); return null; }
    st.mesh = renderer.createMesh(merged);
    return st;
  }

  /** The lit lanterns for the host's light list: the nearest CSA_LIGHTS_MAX to the eye. */
  function lights(eye = null) {
    const out = [];
    for (const boat of drawn()) {
      if ((boat.fade ?? 1) < FADE_FLATS) continue;   // AUDIT BAY A13: her lanterns' light goes with her lantern flats (syncFlats)
      for (const l of boat.Lights) {
        if (!l.enabled || !l.node.activeInHierarchy) continue;
        const p = l.node.position;
        out.push({ x: p[0], y: p[1], z: p[2], range: l.range, color: [l.color[0] * l.intensity, l.color[1] * l.intensity, l.color[2] * l.intensity], _d: eye ? Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]) : 0 });
      }
    }
    out.sort((a, b) => a._d - b._d);
    return out.slice(0, CSA_LIGHTS_MAX).map(({ _d, ...l }) => l);
  }

  /** FloatingOrigin moved the world: every boat's root follows (CSA-C restates OnPositionUpdate's boat arm whole). */
  function offsetAll(offset) {
    for (const boat of boats) {
      const p = boat.GameObject.localPosition;
      boat.GameObject.localPosition = [p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]];
      walks.delete(boat);   // AUDIT PRE-MERGE 0928 R5: moved - walked again
    }
  }
  function destroyAll() { for (const b of [...boats, ...peerBoats, ...seaBoats]) remove(b); }

  /** DECK-WALK (systems/naval/navalDeck.js): a hull's walkable deck, baked once per hull and variant off one stood at
   *  rest in her mesh node's frame (Boat.MeshObject, which the swell rolls and pitches - the deck's frame) - her
   *  switched-on, non-trigger colliders' triangles: a mesh's, a box's six faces, a built-in's - and kept. Null before
   *  the models are in. AUDIT NAV2 F57: ONE DECK A HULL, whatever her rig - a rig carries no collider of its own (the
   *  Large Boat's seven stand her rig 0's own, pinned rig by rig - test/auditnav2_deck.test.js), so every rig's deck is
   *  the one the preload bakes, never a throwaway boat spawned and a deck baked mid-voyage (a Coasting Trader's rig 3
   *  first seen cost an 8.6-9.3 ms crew frame, the bake 4.9-16.9 ms); `variant` is a caller's word, never the key.
   *  AUDIT NAV2 F39: and a classic model's collider (a ModelHelper's - the Large Galley's helm - the bed) as the world's
   *  collider stands it (world.js csaColliderMesh): the pipeline's cpu model, loaded by the preload's `prepare`.
   *  AUDIT GN-D7: a part of hers that opens and shuts - one the mod's own walk hung a door's trigger under
   *  (comeSailAwayBoat.js: a `DoorTrigger` child, the node whose Animator TriggerDoor turns) - is baked `moves`: her
   *  deck keeps the walls it stands shut, never a floor of it (the new galleon's two hatch covers and the Carrack's two
   *  cargo doors are holes when open; every door's leaf is a wall across its doorway shut, as before). */
  const decks = new Map();
  /** AUDIT GN-D7: whether a collider's node is a part that opens - a door, a hatch's cover (a DoorTrigger under it). */
  const opens = (node) => !!node?.children?.some((k) => k.name === 'DoorTrigger');
  function deckOf(hull, variant = 0) {
    if (!models) return null;
    if (decks.has(hull)) return decks.get(hull);
    const probe = new Boat(hull, 0);
    spawnBoat(probe, { models, player: () => ({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }), billboardSize: billboardSizeOf, modelBounds: modelBoundsOf });
    const meshes = [];
    const frame = invertAffine(probe.MeshObject.worldMatrix());
    for (const { node, collider: c, world } of colliderPoses(probe.GameObject)) {
      if (c.m_IsTrigger || c.m_Enabled === false) continue;
      const m = frame ? multiply(frame, world, new Float32Array(16)) : world;
      const cpu = c.classicModel != null ? pipeline?.cpuModels?.get(c.classicModel) : null;   // AUDIT NAV2 F39: its triangles, once the pipeline holds them
      const g = c.type === 'BoxCollider' ? boxColliderTriangles(c) : c.classicModel != null ? (cpu?.positions && cpu.indices ? cpu : null)
        : c.m_Mesh?.mesh ? models.geometry(c.m_Mesh.mesh) : c.m_Mesh?.builtin ? BUILTIN_COLLIDER_MESHES[c.m_Mesh.builtin] : null;
      if (!g) continue;
      const p = g.positions, out = new Float64Array(p.length);
      for (let i = 0; i < p.length; i += 3) {
        const x = p[i], y = p[i + 1], z = p[i + 2];
        out[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
        out[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        out[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      }
      meshes.push({ positions: out, indices: g.indices, moves: opens(node) });
    }
    const b = hullBuild(hull);
    const deck = buildDeck(meshes, { minX: -b.halfWidth - 1, maxX: b.halfWidth + 1, minZ: b.aftZ - 1, maxZ: b.bowZ + 1 });
    decks.set(hull, deck);
    return deck;
  }

  return {
    ensureModels, spawn, spawnNow, preload, ready: () => preloaded, remove, setVariant, frame, batches, draw, lights, offsetAll, destroyAll,
    deckOf,   // DECK-WALK
    hullRig,   // OWS2
    spawnPeerNow, spawnSeaNow,
    /** AUDIT PRE-MERGE 0928 R5: a boat's walk as this frame made it (its nodes and world matrices) - a probe's reading. */
    walkOf,
    /** AUDIT NAV1 (#13): a boat's batch of still parts as the last draw left it ({ nodes, mesh }), or null - a probe's reading. */
    stillOf: (boat) => { const st = stills.get(boat); return st?.mesh ? { nodes: st.nodes, mesh: st.mesh } : null; },
    get boats() { return boats; },
    get peerBoats() { return peerBoats; },
    get seaBoats() { return seaBoats; },
    get models() { return models; },
    /** A probe's reading: what stands, and how much of it is drawn. */
    stat: () => boats.map((b) => ({ hull: b.hull, variant: b.variant, position: b.GameObject.position.map((v) => +v.toFixed(2)), meshes: [...meshes.values()].filter(Boolean).length, bakes: [...bakes.values()].filter((k) => k.gpu).length, flats: flats.size, lights: b.Lights.filter((l) => l.enabled).length })),
  };
}

/** A boat's root pose as SetBoatPositionAndDirection leaves it (CSA-C): position and a heading about Y. */
export function boatRootMatrix(position, yawRadians) {
  return mat4FromQuatPosScale([0, Math.sin(yawRadians / 2), 0, Math.cos(yawRadians / 2)], position, [1, 1, 1]);
}
