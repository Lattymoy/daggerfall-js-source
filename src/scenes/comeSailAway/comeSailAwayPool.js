// @ts-check
// CSA-B (2026-09-27): COME SAIL AWAY'S BOATS, DRAWN - what Unity draws of a
// built boat (systems/comeSailAway/comeSailAwayBoat.js), drawn through the port's renderer:
//
// - every ACTIVE object's switched-on MeshRenderer over its MeshFilter's mesh,
//   each submesh in the Daggerfall texture its slot settled on
//   (systems/comeSailAway/comeSailAwayModels.js), the textures out of the player's own
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

import { loadComeSailAwayModels, rendererModel, rendererModelKey, bundleSlots, PORT_SHIPS } from '../../systems/comeSailAway/comeSailAwayModels.js';
import { createLiveryPaint } from './shipLiveryPaint.js';   // SHIP-LIVERY: a boat's paint, painted once and drawn by a remap
import { warmLiveryArt } from '../../world/ships/shipLiveryArt.js';   // AUDIT 2: the painter's base pictures, while the world loads
import { fitBoats } from './deckFittingsHost.js';   // DECK-PROPS: her fittings, stood in her tree
import { liveryCode } from '../../systems/naval/shipLivery.js';
import { spawnBoat, boatAssetNeeds, DUNGEON_LIGHT_HANDLER, HULL_NAMES, setBoatVariant, Boat, FIRST_HULL_MODEL_ID, meshLocalBounds, worldBounds } from '../../systems/comeSailAway/comeSailAwayBoat.js';
import { resolveNodePointer, instantiatePrefab, prefabShapeStamp } from '../../world/prefabNode.js';
import { StaticBatchBuilder } from '../../render/staticBatch.js';   // AUDIT NAV1 (#13): a boat's still parts merged as a town's statics are
import { instanceParticleSystems } from '../../world/unityParticles.js';
import { bakeSkinnedMesh, recalculateNormals, fixDeformationsTick } from '../../world/skinnedBake.js';
import { billboardSize } from '../../world/rmbFlats.js';
import { isNpcFlat } from '../../world/npcFlatArchives.js';   // STAND-FLAT: a prefab's person - her crew, for the host's people lane
import { GLOBAL_SCALE } from '../../world/meshReader.js';
import { multiply, identity } from '../../world/mat4.js';
import { spherePlanes, sphereInPlanes, transformSphere } from '../../render/bounds.js';   // AUDIT NAV1 (#13): the boats culled as the world's meshes are
import { cullDisabled } from '../../render/frustum.js';
import { mat4FromQuatPosScale, quatRotateInto } from '../../world/quat.js';
import { colliderPoses, boxColliderTriangles, invertAffine, BUILTIN_COLLIDER_MESHES } from '../../world/prefabColliders.js';   // DECK-WALK: a hull's colliders at rest
import { farLife, farTreeStep } from './farLife.js';   // BOAT-FAR: a boat's life by her range, navalHost's law (BOAT-OWN: her tree's, the switches' rule one with her Animators')
import { buildDeck } from '../../systems/naval/navalDeck.js';   // DECK-WALK: her walkable deck
import { hullBuild, setGalleonStanding, setShipStanding } from '../../systems/naval/navalShips.js';   // AUDIT GN-G4: and hull 2's build follows the hull that stands (SHIPS-2: hull 4's and hull 1's)
import { registerGalleonArt, GALLEON_ARCHIVE, galleonCut, galleonGlow, GALLEON_NIGHT } from '../../world/ships/galleonArt.js';   // GALLEON: the new galleon's own pictures, on the texture door before her meshes ask
import { registerCarrackArt, CARRACK_ARCHIVE, carrackCut, carrackGlow, CARRACK_NIGHT } from '../../world/ships/carrackArt.js';   // SHIPS-2: and the new carrack's,
import { registerLargeBoatArt, LARGE_BOAT_ARCHIVE } from '../../world/ships/largeBoatArt.js';   // and the new large boat's
import { toColor32 } from '../../formats/color32Order.js';
import { createShipPlaques, BLOCK_LETTERS, fntLetters } from './shipPlaque.js';   // SHIP-PLAQUE: her name on her bows
import { FntFile } from '../../formats/fntFile.js';   // SHIP-PLAQUE: FONT0003, the boards' lettering
import { addVendorTextures, decodedTexture } from '../../systems/textureReplacement.js';
import { adoptLight } from '../../render/lightId.js';   // LIGHT-ID: a lantern's light named by its lantern

/** DungeonLightHandler.CheckLight's reach: UnscaledBlockRange x MeshReader.GlobalScale. */
export const LANTERN_HANDLER_REACH = DUNGEON_LIGHT_HANDLER.unscaledBlockRange * GLOBAL_SCALE;
/** How many of the boats' lit lanterns reach the host's light list - the nearest, as camps.js hands its fires
 *  (the port's renderer holds sixteen lights, forty-eight on the lane; a galleon carries eighteen lanterns). */
export const CSA_LIGHTS_MAX = 8;
/** AUDIT NAV1 (the presentation): the hull whose FlagObject a flagless sea ship is given (the Small Ship - graftColours). */
export const FLAG_DONOR_HULL = 2;
/** SHIPS-2: THE PORT'S OWN SHIPS' PICTURES - each standing ship's archive, how it is put on the texture door, which
 *  of its records hold glass to see through (DF-LOOK, DF-ART II kept - Mac: "windows should always be see through" -
 *  uploaded cut-outs), each of those records' NIGHT TWIN and the twin's glow (DF-ART III kept - Mac, of the stern
 *  windows: "See-through by day, lit at night" - world/ships/galleonArt.js NIGHT_RECORD_OFFSET; the glow cut while the world
 *  loads), by the models' key for the ship (systems/comeSailAway/comeSailAwayModels.js PORT_SHIPS). */
export const PORT_ART = Object.freeze({
  galleon: Object.freeze({ archive: GALLEON_ARCHIVE, register: registerGalleonArt, cut: galleonCut, night: GALLEON_NIGHT, glow: galleonGlow }),
  carrack: Object.freeze({ archive: CARRACK_ARCHIVE, register: registerCarrackArt, cut: carrackCut, night: CARRACK_NIGHT, glow: carrackGlow }),
  largeBoat: Object.freeze({ archive: LARGE_BOAT_ARCHIVE, register: registerLargeBoatArt, cut: () => false, night: Object.freeze({}), glow: () => null }),
});
const artOf = (archive) => Object.values(PORT_ART).find((a) => a.archive === archive);
/** Whether a picture holds glass to see through, whichever port ship's archive it is in (false for any other). */
const cutOf = (archive, record) => !!artOf(archive)?.cut(record);
/** A see-through picture's night twin (its record), whichever port ship's archive it is in (null for any other). */
const nightOf = (archive, record) => artOf(archive)?.night[record] ?? null;
/** THE STERN WINDOWS LIT: every see-through record of the port's ships drawn as its night twin - its glass whole, its
 *  panes glowing - while the lanterns are lit (`frame`'s cityLightsOn, the lanterns' own switch: lanternLightUpdate).
 *  By day her glass is a hole and the eye sees into her great cabin; a hole draws nothing, its glow included, so at
 *  night the glass is whole again and glows. One Map, so the renderer's per-sub-mesh lookups (drawMesh's `_evRemap`)
 *  stay cached night after night. */
export const NIGHT_REMAP = new Map(Object.values(PORT_ART).flatMap((a) => Object.entries(a.night).map(([r, n]) => [`${a.archive}_${r}`, `${a.archive}_${n}`])));
const _nightRemaps = new WeakMap();   // a host's remap -> it with NIGHT_REMAP's twins, made once
/** The remap a night draw takes: NIGHT_REMAP, or a host's own remap with its twins added (the host's key wins). */
export function nightRemapOf(texRemap) {
  if (!texRemap?.size) return NIGHT_REMAP;
  let m = _nightRemaps.get(texRemap);
  if (!m) { m = new Map([...NIGHT_REMAP, ...texRemap]); _nightRemaps.set(texRemap, m); }
  return m;
}

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

/**
 * @param {{ renderer?: any, pipeline?: any, fetchFn?: any, log?: any, liveryOf?: ((boat: any) => any) | null, fittingsOf?: ((boat: any) => any[]) | null,
 *   plaqueOf?: ((boat: any) => string | null) | null, plaqueFont?: (() => Promise<Uint8Array>) | null }} [o]
 *   SHIP-LIVERY: `liveryOf(boat)` a boat of mine's livery (the Fleet's ledger, by her number); a peer's boat says its own
 *   (`boat.livery`, its owner's word), and a sea ship her own (SEA-COLOURS: the naval host's, systems/naval/seaColours.js). DECK-PROPS: `fittingsOf(boat)` a boat of mine's deck
 *   fittings, the same way (a peer's `boat.fittings`). SHIP-PLAQUE: `plaqueOf(boat)` the name a boat of mine shows on her
 *   bows (null: none; a peer's `boat.plaqueName`, a sea ship none); `plaqueFont()` FONT0003's bytes, the boards' lettering
 *   (none, or none to be had: the block letters)
 */
export function createComeSailAwayPool({ renderer = null, pipeline = null, fetchFn = null, log = console, liveryOf = null, fittingsOf = null, plaqueOf = null, plaqueFont = null } = {}) {
  /** @type {any} */ let models = null;
  let modelsLoading = null, modelsFailed = false;
  /** @type {any[]} */ const boats = [];
  /** CSA-J: the peers' boats (scenes/comeSailAway/comeSailAwayPeers.js) - drawn, baked and lit as mine, but never in `boats`, so
   *  the host's rays and activations (which read `boats`) meet them only where CSA-K asks by name - another's boat's own
   *  ray (scenes/comeSailAway/comeSailAwayAboard.js); its collider stands every one (FIELD BUGS 2026-10-01b: world.js csaSyncColliders). */
  /** @type {any[]} */ const peerBoats = [];
  /** NAV-C: the sea's ships (scenes/naval/navalHost.js) - the Iliac Bay's pirates, merchantmen and navies, built on these same
   *  hulls: drawn, baked and lit as mine, never in `boats` (no helm is taken on one, no deed places one); the naval host
   *  poses them, and stands the near ones in the world's collider itself. */
  /** @type {any[]} */ const seaBoats = [];
  const drawn = () => (peerBoats.length || seaBoats.length ? boats.concat(peerBoats, seaBoats) : boats);
  // SHIP-LIVERY (scenes/comeSailAway/shipLiveryPaint.js): the paint shop, and which boats are mine (my ledger says their paint)
  const mineBoats = new WeakSet();
  const paints = createLiveryPaint({ renderer, pipeline, log, portArchiveOf: (hull) => { const s = PORT_SHIPS.find((x) => x.hull === hull); return s && models?.[s.key] ? PORT_ART[s.key].archive : null; } });
  /** A boat's paint as the word's number (0 as built): mine by my ledger, a peer's by its owner's word, a sea ship's her own -
   *  mine read again only when her ledger's record is another (fleet.js setShipLivery sets a new one), not every draw. */
  const liveryCodeOf = (boat) => {
    if (!mineBoats.has(boat)) return boat.livery | 0;
    const rec = liveryOf?.(boat) ?? null;
    if (boat._liveryRec !== rec || boat._liveryCode == null) { boat._liveryRec = rec; boat._liveryCode = liveryCode(rec); }
    return boat._liveryCode;
  };
  // SHIP-PLAQUE (scenes/comeSailAway/shipPlaque.js): her name on her bows - laid on her planking (hullSurface, below),
  // lettered in FONT0003 once its bytes are in (the block letters where they are not to be had)
  /** @type {any} */ let plaqueLetters = plaqueFont ? null : BLOCK_LETTERS;
  /** @type {Promise<void> | null} */ let plaqueLoad = null;
  const lettersNow = () => {
    if (!plaqueLetters && !plaqueLoad) {
      plaqueLoad = Promise.resolve().then(() => plaqueFont()).then((b) => { plaqueLetters = fntLetters(new FntFile().load(b)); },
        (e) => { log?.warn?.('[plaque] FONT0003.FNT will not load - her name is cut in block letters', e); plaqueLetters = BLOCK_LETTERS; });
    }
    return plaqueLetters;
  };
  const plaques = createShipPlaques({ renderer, surfaceOf: (hull) => hullSurface(hull), buildOf: (hull) => hullBuild(hull), letters: lettersNow });
  /** The name a boat shows on her bows: mine by my ledger, a peer's by her owner's word, a sea ship none. */
  const plaqueNameOf = (boat) => (mineBoats.has(boat) ? plaqueOf?.(boat) ?? null : peerBoats.includes(boat) ? boat.plaqueName || null : null);
  const _cullOn = !cullDisabled();   // AUDIT NAV1 (#13): ?cull=off, read once, as the world reads it
  const _cullPv = new Float32Array(16), _cullPlanes = new Float32Array(24), _cullSphere = new Float32Array(4), _cullBox = new Float32Array(6);
  const meshes = new Map();      // rendererModelKey -> gpu mesh | null
  const meshLoads = new Map();   // in flight
  const bakes = new Map();       // FixDeformations script -> { gpu, positions, normals, loading, rig? (AUDIT GN2-RG1) }
  const _rigV = [0, 0, 0], _rigBack = [0, 0, 0, 1];
  const flats = new Map();       // billboard object -> batch
  const crew = new Map();        // STAND-FLAT: billboard object -> its person ({ piece }), for a flat of a person's archive
  const warned = new Set();
  const warnOnce = (k, ...a) => { if (warned.has(k)) return; warned.add(k); log?.warn?.(...a); };
  // AUDIT PRE-MERGE 0928 R5: ONE WALK A FRAME. Each drawn boat's active objects and their world matrices, walked once by
  // `frame` into storage kept per node and reused frame to frame (activeObjects' order and arithmetic, none of its
  // allocations) - the holders, the flats and the draw read it. A walk made outside a frame (a draw with no frame
  // before it) is made where it is read and never kept; a boat re-dressed or moved by the origin is walked again.
  /** boat -> { stamp, nodes, mats } */
  const walks = new Map();
  /** A node's world matrix, kept - and (PERF-SAILS1) what it was made from: `l` the node's local rotation, position
   *  and scale as they read when it was made, and `pver` the `ver` of the parent's matrix it was made under (ROOT_MADE
   *  for a boat's root). `ver` names this making: every making of every matrix takes the next of one count, so no two
   *  makings share one - a part hung under another parent reads another parent's `ver`, whatever either was made. */
  // PERF-SAILS2: the record rides the node (`_walkRec`, as PrefabNode keeps its own worldMatrix's `_w`) - a WeakMap's ask
  // a node a frame was a sixth of the walk
  const _walkStack = [], _walkRecs = [];
  const _local = new Float32Array(16);
  let walkStamp = 0, _makings = 0;
  let cityLights = false;   // THE STERN WINDOWS LIT: the lanterns lit at the last frame (frame), the draw's night twins
  const ROOT_MADE = -2;
  const recOf = (n) => {
    let r = n._walkRec;
    if (!r) {
      const l = new Float64Array(10).fill(NaN);
      r = { m: new Float32Array(16), ver: 0, pver: -1, pend: false, under: null, l, lq: l.subarray(0, 4), lt: l.subarray(4, 7), ls: l.subarray(7, 10), at: null };   // BOAT-FAR: `at` the matrix a held boat's draw stands it at (placed)
      n._walkRec = r;
    }
    return r;
  };
  /** PERF-SAILS1: does the node read the local values its matrix was last made from? (And, when not, they are taken.) */
  function localSame(r, n) {
    const q = n.localRotation, t = n.localPosition, sc = n.localScale, l = r.l;
    if (l[0] === q[0] && l[1] === q[1] && l[2] === q[2] && l[3] === q[3] && l[4] === t[0] && l[5] === t[1] && l[6] === t[2]
      && l[7] === sc[0] && l[8] === sc[1] && l[9] === sc[2]) return true;
    l[0] = q[0]; l[1] = q[1]; l[2] = q[2]; l[3] = q[3]; l[4] = t[0]; l[5] = t[1]; l[6] = t[2]; l[7] = sc[0]; l[8] = sc[1]; l[9] = sc[2];
    return false;
  }
  // PERF-SAILS1 (2026-10-10, Dudey's readout in a port at night: the boats' frame 5-7.6 ms - `sails`, ?perf=cpu): THE
  // WALK MAKES A MATRIX ONLY WHERE ONE MOVED. A ship is hundreds of objects (twelve hulls: 7,384), and every one's world
  // matrix was made again every frame - a quaternion's matrix and a product a node - where all but her sails, booms,
  // flags and oars stand as they stood. A node's matrix is made again when its own local values read otherwise than
  // they did at its last making, or the parent's matrix it stands under is not the making it was made under (made again,
  // or another parent's); else it is the one already made from those same values - the same floats.
  // PERF-SAILS2 (Dudey: "iam not near water btw" - "lets say water is there like 2 pixel away"): AND MADE WHEN READ. A
  // harbour's moored ships stand within HARBOUR_STAND of its mouth, ashore too, and navalHost's poseShip rocks each in
  // the wind every frame - her MeshObject turned, so every object under it moved and PERF-SAILS1 made them all again.
  // Most are read by nobody: her still parts draw as her one batch at the MeshObject's matrix (AUDIT NAV1 #13). The walk
  // marks a node due (`pend`, `under` the record it hangs under) and `made` makes it - its parent first - when a reader
  // asks: the draw for what it draws one by one, the flats for theirs, a probe's walkOf for all. A due matrix is made
  // from the local values the walk read (`lq`/`lt`/`ls`, the same numbers) under the parent's as made then - the eager
  // walk's floats. tools/csaBench.mjs, twelve ships, the frame and the draw: 9.6 -> 4.6 ms standing, 9.5 -> 5.4 rocking.
  // PERF-SAILS3 (2026-10-14, a live capture in a port, online: the boats' frame 1.8 ms of a 10 ms frame, and 1.5 MB a
  // frame of its garbage): THE WALK IS WRITTEN WHERE IT STOOD. Its three lists were emptied and pushed again every frame
  // (an emptied array gives its storage back, so every frame grew them anew); now each slot is written over and `ver`
  // counts the walks whose nodes were other than the last's - a boat's plan (planOf) stands while it does.
  function walkBoat(boat, stamp) {
    let w = walks.get(boat);
    if (!w) { w = { stamp: -1, nodes: [], mats: [], recs: [], ver: 0, plan: null, heldAt: -1, draws: { at: -1, alone: [], still: [] } }; walks.set(boat, w); }   // BOAT-FAR: `heldAt` the frame that held her; BOAT-OWN: `draws` what the draw found of this walk (draw)
    w.stamp = stamp;
    const nodes = w.nodes, mats = w.mats, wrecs = w.recs;
    let at = 0, moved = false;
    const root = boat.GameObject;
    const seen = root?.parent === null ? stamp : -1;   // PERF-SAILS4: a root hung under something walks a frame of its own - never read for her nodes' worldMatrix
    if (root?.activeSelf) {
      const rr = recOf(root);
      if (!localSame(rr, root) || rr.pend || rr.pver !== ROOT_MADE) { rr.pend = true; rr.under = null; }
      const stack = _walkStack, recs = _walkRecs;
      stack.length = 0; recs.length = 0;
      stack.push(root); recs.push(rr);
      while (stack.length) {
        const n = stack.pop(), pr = recs.pop();
        if (nodes[at] !== n) { nodes[at] = n; moved = true; }
        mats[at] = pr.m; wrecs[at] = pr; pr.seen = seen; at++;   // PERF-SAILS4: walked by this frame's walk (worldOf)
        for (let i = n.children.length - 1; i >= 0; i--) {
          const c = n.children[i];
          if (!c.activeSelf) continue;
          const r = recOf(c);
          if (!localSame(r, c) || r.pend || pr.pend || r.pver !== pr.ver) { r.pend = true; r.under = pr; }
          stack.push(c); recs.push(r);
        }
      }
    }
    if (nodes.length !== at) { nodes.length = at; mats.length = at; wrecs.length = at; moved = true; }
    if (moved) w.ver++;
    return w;
  }
  /** PERF-SAILS3: A BOAT'S PLAN - what of her walk the frame, the flats and the draw read, found once: each holder (a
   *  FixDeformations, with its node), each billboard's node and its components, each MeshRenderer's node and its
   *  filter, its holder and (made as it is first asked) its model key and still chain. Made again when her walk's
   *  nodes are others (`ver`), her tree's shape changed (a part hung elsewhere, a component added - BOAT-STAMP: her own
   *  tree's stamp, never another boat's build) or her MeshObject is another; what can change frame to frame (a
   *  renderer switched off, a material, a mesh) is still read every frame. */
  function planOf(boat, w) {
    const stamp = prefabShapeStamp(boat.GameObject);   // BOAT-STAMP: her own tree's
    let p = w.plan;
    if (p && p.ver === w.ver && p.stamp === stamp && p.frame === boat.MeshObject) return p;
    p = { ver: w.ver, stamp, frame: boat.MeshObject, holders: [], flats: [], parts: [] };
    for (let i = 0; i < w.nodes.length; i++) {
      const n = w.nodes[i];
      for (const c of n.components) if (c.type === 'FixDeformations') p.holders.push(c, n);
      const mr = n.getComponent('MeshRenderer');
      const bb = n.getComponent('DaggerfallBillboard');
      if (bb) p.flats.push({ i, node: n, bb, r: mr, at: -1, sx: 0, sy: 0 });   // BOAT-OWN: `sx`/`sy` its scale as the frame that walked her (`at`) found it (syncFlats)
      if (mr) p.parts.push({ i, node: n, mr, mf: n.getComponent('MeshFilter'), fix: n.getComponent('FixDeformations'), mesh: null, mats: null, bundle: null, bundleN: -1, slots: null, key: null, gpu: null, chain: undefined, rec: null });
    }
    w.plan = p;
    return p;
  }
  /** PERF-SAILS3: a part's model key (rendererModelKey) and slots - made again only when its mesh, its materials or its
   *  bundle's materials are other arrays (every writer assigns a new one - comeSailAwayModels.js applyMaterials,
   *  comeSailAwayBoat.js applyGameTextures), so the string is the one the frame before made of the same slots. */
  function partKey(e, mesh) {
    const mr = e.mr, mats = mr.materials ?? null, bundle = mats ? null : (mr.m_Materials ?? null), bn = bundle ? bundle.length : -1;
    if (e.key === null || e.mesh !== mesh || e.mats !== mats || e.bundle !== bundle || e.bundleN !== bn) {
      e.mesh = mesh; e.mats = mats; e.bundle = bundle; e.bundleN = bn;
      e.slots = mats ?? bundleSlots(mr);
      e.key = rendererModelKey(mesh, e.slots);
    }
    return e.key;
  }
  /** PERF-SAILS4: a node's matrix in its boat's frame - the one this frame's walk keeps (made as it is read) when the
   *  walk went through it, else the node's own (PrefabNode.worldMatrix). The two are one product of the same values
   *  (a boat's root hangs under nothing: the walk's root matrix is her worldMatrix), to the bit; the walk's makes each
   *  matrix once a frame for every reader and into its own storage, where the node's asks its whole chain each time. */
  const worldOf = (n) => {
    const r = n._walkRec;
    return r !== undefined && walkStamp > 0 && r.seen === walkStamp ? made(r) : n.worldMatrix();
  };
  /** PERF-SAILS2: a walked node's matrix, made now if it is due - its parent's first. */
  function made(r) {
    if (!r.pend) return r.m;
    const p = r.under;
    if (p === null) { mat4FromQuatPosScale(r.lq, r.lt, r.ls, r.m); r.pver = ROOT_MADE; }
    else { multiply(made(p), mat4FromQuatPosScale(r.lq, r.lt, r.ls, _local), r.m); r.pver = p.ver; }
    r.ver = ++_makings; r.pend = false;
    return r.m;
  }
  /** This frame's walk of a boat - the frame's own (BOAT-FAR: or, for a boat the frame held, her last frame's - held, so
   *  the flats and the draw never walk her again), or one made now and kept for nobody. */
  const walkOf = (boat) => { const w = walks.get(boat); return w && walkStamp > 0 && (w.stamp === walkStamp || w.heldAt === walkStamp) ? w : walkBoat(boat, -1); };
  /** PERF-SAILS2: the same walk with every matrix made - a probe's reading (the pool's own readers make what they read). */
  const walkMade = (boat) => { const w = walkOf(boat); for (const r of w.recs) made(r); return w; };

  // BOAT-FAR (2026-10-21, a player's profile online: the boats' pool frame 11% of the frame, 6% with the peers' boats
  // not loaded - walkBoat, lateUpdateHolder and syncFlats over every boat drawn, wherever she sailed): A FAR BOAT LIVES BY
  // NAVALHOST'S LAW (scenes/comeSailAway/farLife.js). Past NEAR_LIFE_M of the eye she is walked, her holders baked and
  // her lanterns decided one frame in FAR_LIFE_EVERY - each boat on her own frame of the stride - on the time she
  // missed. On the frames between, her last walk is HELD: the flats and the draw read it (walkOf), never walking her
  // again, carried to where she stands now by her hull's move since it (heldShift) - her still batch drawn at her hull's
  // matrix as it stands, every other part of hers by the same move, so no part of hers falls behind her hull.
  /** boat -> her place in the law (farLife), the shape and the switches her walk was made of, and her held shift (made
   *  once a frame) */
  const lives = new WeakMap();
  let _lifeSeq = 0;
  /** @type {ArrayLike<number> | null} */ let _lifeEye = null;
  /** @type {Float32Array | null} */ let _shift = null;   // the boat being read's held shift (heldShift), or null
  /** BOAT-FAR: a boat's frame of the law - the time her walk, bakes and lanterns step by, or null: held. One with no
   *  frame's walk to hold - none yet, or one dropped (a re-dress, the origin's move: walks.delete) - or whose tree was
   *  reshaped since it (a fitting stood, a part hung) is walked whatever her range. AUDIT (2026-10-21, a far Carrack
   *  switched off drew her 18 meshes up to three frames more, and switched on drew nothing for as many): and so is one
   *  with a node of her tree switched on or off since (prefabSwitchStamp: her root - a peer's look 'hidden',
   *  UpdateBoatVisibility - her helm's IdleObject and ActiveObject, a sea ship's sails set), whose walk reaches other
   *  nodes now. BOAT-OWN: the shape and the switches read by farTreeStep (scenes/comeSailAway/farLife.js), the rule her
   *  Animators live by too. */
  function lifeOf(boat, dt) {
    let life = lives.get(boat);
    if (!life) { life = { ...farLife(_lifeSeq++), shiftAt: 0, shiftNow: null, shift: null, m: null }; lives.set(boat, life); }
    const w = walks.get(boat), root = boat.GameObject;
    const kept = w !== undefined && w.stamp > 0;
    const lived = farTreeStep(life, dt, root, kept ? (root.parent ? root.position : root.localPosition) : null, _lifeEye);
    if (lived === null) w.heldAt = walkStamp;
    return lived;
  }
  /** BOAT-FAR: a held boat's move since her held walk - her hull's matrix now times the inverse of the one her walk made
   *  (her root's, where the walk did not reach her hull), which stands every matrix of that walk where she is now; null
   *  for a boat walked this frame, or one that stands where her walk left her (its own matrices are where she is). */
  function heldShift(boat, w) {
    if (w.stamp === walkStamp || w.heldAt !== walkStamp) return null;
    const life = lives.get(boat);
    const hull = boat.MeshObject, hr = hull?._walkRec;
    const node = hr !== undefined && hr.seen === w.stamp ? hull : boat.GameObject, r = node?._walkRec;
    if (!r) return null;
    const was = made(r), now = node.worldMatrix();   // the node's own, kept while it reads the same (PrefabNode.worldMatrix)
    if (life.shiftAt === walkStamp && life.shiftNow === now) return life.shift;   // the flats' and the draw's, while she stands as she did
    life.shiftAt = walkStamp; life.shiftNow = now; life.shift = null;
    let same = true;
    for (let i = 0; i < 16 && same; i++) same = was[i] === now[i];
    const inv = same ? null : invertAffine(was);
    if (inv) life.shift = multiply(now, inv, (life.m ??= new Float32Array(16)));
    return life.shift;
  }
  /** BOAT-FAR: a walked node's matrix where it is read - its walk's (made), carried by the boat's held shift into the
   *  node's own second matrix (`at`) while she is held. */
  const placed = (r) => (_shift === null ? made(r) : multiply(_shift, made(r), (r.at ??= new Float32Array(16))));
  /** BOAT-OWN: placed(r)'s place alone - its translation, the very floats placed() makes (mat4.js multiply's column 3:
   *  the same products summed in the same order, rounded to a float as its scratch rounds them), into a scratch's
   *  [12..14]; the rest of the product is not made. A held flat's stand (syncFlats). */
  const _placedAt = new Float32Array(16);
  function placedAt(r) {
    const m = made(r), a = _shift;
    if (a === null) return m;
    for (let row = 0; row < 3; row++) _placedAt[12 + row] = 0 + a[row] * m[12] + a[4 + row] * m[13] + a[8 + row] * m[14] + a[12 + row] * m[15];
    return _placedAt;
  }

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
  /** A classic model the pipeline will not load, said once (a hull's ModelHelper, DECK-PROPS a fitting). */
  const modelWontLoad = (id, e) => warnOnce(`model:${id}`, `[come-sail-away] model ${id} will not load`, e);
  /** DECK-PROPS: what the fitting-out reads - the spawn's context, her hull's deck, and a fitting's model asked once. One
   *  for the pool (AUDIT 2026-10-17: made again every frame), its context's models the pool's as they stand. */
  const _fitLoads = new Set();
  const _fitDeps = {
    ctx: { get models() { return models; }, player: () => ({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }), billboardSize: billboardSizeOf, modelBounds: modelBoundsOf },
    deckOf: (hull) => deckOf(hull),
    load: (m) => { if (_fitLoads.has(m) || !pipeline?.getGpuMesh) return; _fitLoads.add(m); Promise.resolve(pipeline.getGpuMesh(m)).catch((e) => modelWontLoad(m, e)); },
  };

  /** The ARENA2 a hull reads before it is built: its flats' archives and records, its classic models. */
  async function prepare(hull) {
    const need = boatAssetNeeds({ models }, hull);
    for (const [a, r] of need.flats) {
      try { const t = await pipeline.getTexture(a); if (t?.recordCount > r) pipeline.uploadRecord(a, r); }
      catch (e) { warnOnce(`flat:${a}`, `[come-sail-away] TEXTURE.${a} will not load - the boats' flats of it stand invisible`, e); }
    }
    for (const id of need.models) {
      try { await pipeline.getGpuMesh(id); } catch (e) { modelWontLoad(id, e); }
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
      // AUDIT GN2-PF3: her pictures painted (her archive's first ask builds all twenty-five on the vendor door - DF-LOOK:
      // her stern gallery's two night twins with them) and her glass's glow cut while the world loads - they were her
      // first mesh's ask (meshFor) or a sail bake's, at the first draw of a hull 2: a 50-120 ms stall the first time she
      // came into view
      // SHIPS-2: every standing port ship's so
      for (const [key, art] of Object.entries(PORT_ART)) {
        if (!models[key]) continue;
        try { await pipeline.getTexture(art.archive); for (const n of Object.values(art.night)) art.glow(n); }
        catch (e) { warnOnce(`tex:${art.archive}`, `[come-sail-away] TEXTURE.${art.archive} will not load - the boats' faces in it draw nothing`, e); }
      }
      for (let hull = 0; hull < HULL_NAMES.length; hull++) deckOf(hull, 0);   // DECK-WALK: baked while the world loads (10-50 ms a hull), never mid-voyage (AUDIT NAV2 F57: every rig's deck, one a hull)
      // AUDIT 2: and, the same way, each hull's planking and bows read for her name boards (SHIP-PLAQUE: 10-50 ms a hull, the
      // pool's draw's the first time a named ship of it was seen) and the livery painter's base pictures
      for (let hull = 0; hull < HULL_NAMES.length; hull++) plaques.prime(hull);
      try { warmLiveryArt(); } catch { /* painted as she is first seen painted - the paint shop's own ask says what failed */ }
      preloaded = true;
      return true;
    })();
    return preloading;
  }
  /** CSA-C: SpawnBoat as the C# runs it - at once, on what `preload` brought in; null before that. */
  function spawnNow(boat, player) {
    if (!models) return null;
    boats.push(boat); mineBoats.add(boat);   // CSA-J (the audit): in the scene before it is built - a SpawnBoat that throws half way (a variant past the hull's) leaves its half-built hull standing, as the C#'s GameObject does
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
  /** MENU-ORDER (bible/10-UI/Menu-Order.md): A HULL'S PORTRAIT - the shipmaster's card's picture of her (scenes/
   *  shipPortraits.js). A boat of the hull built once as hullRig's is (at the origin, standing), never placed and never
   *  in the drawn lists; her sails baked once as they stand. Her parts - each drawn mesh and its matrix, as the draw
   *  finds them - and her box (the parts' boxes, joined), once every part has come; null until then (asked again a
   *  frame later: her meshes load as the draw's do) and before the models are in. Her billboards (the crew, the
   *  lanterns' flames) are not in it. */
  const portraitBoats = new Map();
  const _portraitSphere = new Float32Array(4);
  const holderAsks = new WeakMap();   // a sail's holder -> how often a portrait asked it to bake
  function portrait(hull) {
    if (!models || !(hull >= 0 && hull < HULL_NAMES.length)) return null;
    let b = portraitBoats.get(hull);
    if (!b) {
      b = new Boat(hull, 0);
      spawnBoat(b, { models, player: () => ({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }), billboardSize: billboardSizeOf, modelBounds: modelBoundsOf });
      portraitBoats.set(hull, b);
    }
    const w = walkMade(b);
    const parts = [];
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    let waiting = false;
    for (let i = 0; i < w.nodes.length; i++) {
      const node = w.nodes[i];
      for (const c of node.components) {   // her sails, baked as they stand (the holder's timer is spent on the first ask)
        if (c.type !== 'FixDeformations' || bakes.has(c)) continue;
        holderAsks.set(c, (holderAsks.get(c) ?? 0) + 1);
        lateUpdateHolder(c, node, 1);
      }
      const mr = node.getComponent('MeshRenderer');
      if (!mr || mr.m_Enabled === false || mr.materials?.[0]?.billboard) continue;
      let gpu = null;
      if (mr.classicModel != null) { gpu = pipeline?.gpuMeshes?.get(mr.classicModel) ?? null; if (!gpu) continue; }   // a classic model the world has not loaded: left out, as the draw leaves it
      else {
        const mf = node.getComponent('MeshFilter');
        if (mf?.baked) {
          const fix = node.getComponent('FixDeformations');
          if (!bakes.has(fix) && (holderAsks.get(fix) ?? 0) > 2) continue;   // one that will not bake (no bones to bake from) is left out, as the draw leaves it
          gpu = bakes.get(fix)?.gpu ?? null;
        } else if (mf?.m_Mesh?.mesh) {
          const slots = mr.materials ?? bundleSlots(mr);
          const key = rendererModelKey(mf.m_Mesh.mesh, slots);
          if (meshes.has(key) && !meshes.get(key)) continue;   // one that would not build: left out, as the draw leaves it
          gpu = meshFor(key, () => rendererModel(models.geometry(mf.m_Mesh.mesh), slots));
        } else continue;
      }
      if (!gpu) { waiting = true; continue; }
      const m = w.mats[i];
      parts.push([gpu, m]);
      const local = meshLocalBounds({ models }, node.getComponent('MeshFilter')?.m_Mesh);   // her box off each part's own (graftColours' reading); a sphere's where it has none
      if (local) {
        const wb = worldBounds(node, local);
        for (let k = 0; k < 3; k++) { box[k] = Math.min(box[k], wb.min[k]); box[k + 3] = Math.max(box[k + 3], wb.max[k]); }
      } else if (gpu.bounds && gpu.bounds[3] > 0) {
        const sp = transformSphere(m, gpu.bounds, _portraitSphere);
        for (let k = 0; k < 3; k++) { box[k] = Math.min(box[k], sp[k] - sp[3]); box[k + 3] = Math.max(box[k + 3], sp[k] + sp[3]); }
      }
    }
    return waiting || !parts.length || !(box[3] > box[0]) ? null : { parts, box };
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
      const b = flats.get(n); if (b) { renderer?.destroyBillboardBatch?.(b); flats.delete(n); crew.delete(n); }
      for (const c of n.components) if (c.type === 'FixDeformations') { const k = bakes.get(c); if (k?.gpu) renderer?.destroyMesh?.(k.gpu); bakes.delete(c); }
    }
  }

  /** A boat's sub-mesh's picture up through the pipeline's own door (after its archive's getTexture): a model's face,
   *  a cut-out where its glass is seen through - and that record's night twin with it, whole, its glow its emission
   *  (renderer.uploadEmissionTexture: lit by the window style, as every lit window is; AUDIT GN2-PF5: capped by Retro
   *  Mode as her classic art is, a pack's picture never). AUDIT GN-R15: a pack's own picture over her stern windows (a
   *  loose 38131_6, or its night twin's 38131_106) glows by HER glass. */
  function uploadFace(archive, record) {
    pipeline.uploadRecord(archive, record, { opaque: true, cutout: cutOf(archive, record) });
    const night = nightOf(archive, record);
    if (night == null) return;
    pipeline.uploadRecord(archive, night, { opaque: true });
    const glow = artOf(archive).glow(night);
    // STUDIO1: a night picture's own light - an emission picture of the twin (`38131_106-0_Emission.png`, the studio's
    // or a pack's) - lights it where its artist put the glass; without one, the painted glass's glow does
    const lit = decodedTexture(archive, night, 0, 'Emission');
    if (lit || glow) renderer?.uploadEmissionTexture?.(archive, night, lit ?? toColor32(glow), { replacement: !pipeline.isClassicArt?.(archive) });
  }

  /** A renderer's drawn model, uploaded once with its textures; null this frame while it loads. */
  function meshFor(key, build) {
    if (meshes.has(key)) return meshes.get(key);
    if (!meshLoads.has(key) && renderer?.createMesh) {
      meshLoads.set(key, (async () => {
        const model = build();
        if (!model) { meshes.set(key, null); return; }
        for (const sm of model.subMeshes) {
          // GALLEON: her stern gallery's glass, lit at night as a town's windows are (the window style the host sets -
          // its emission mask is the glass alone, galleonArt.js galleonGlow) - DF-LOOK: on its night twin, the glass
          // seen through by day (`uploadFace`). SHIPS-2: the new carrack's transom gallery's glass the same
          try { await pipeline.getTexture(sm.textureArchive); uploadFace(sm.textureArchive, sm.textureRecord); }
          catch (e) { warnOnce(`tex:${sm.textureArchive}`, `[come-sail-away] TEXTURE.${sm.textureArchive} will not load - the boats' faces in it draw nothing`, e); }
        }
        meshes.set(key, renderer.createMesh(model));
      })().catch((e) => { meshes.set(key, null); warnOnce(`mesh:${key}`, '[come-sail-away] a boat mesh failed to build', e); }).finally(() => meshLoads.delete(key)));
    }
    return null;
  }

  /** FixDeformations.LateUpdate over one holder: the timer, and on its frame the bake written to the GPU. AUDIT GN2-RG1:
   *  a holder `everyFrame` (the new galleon's running rope - world/ships/galleonRig.js BAKE, read on by systems/
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
    let k = bakes.get(script);
    if (!k) { k = { gpu: null, positions: new Float32Array(g.vertexCount * 3), normals: new Float32Array(g.vertexCount * 3), loading: false }; bakes.set(script, k); }
    // PERF-SAILS3: an every-frame holder (a galleon's running rope) asked its bones, their matrices and its pose every
    // frame, each a new array - the bones are found once a tree's shape (resolveNodePointer reads the instance's own
    // paths), the matrices and the pose written into the holder's own record; the same nodes, the same numbers
    const shape = prefabShapeStamp(skinnedNode);   // BOAT-STAMP: its own tree's
    if (k.bonesOf !== skinnedNode || k.bonesList !== smr.m_Bones || k.bonesStamp !== shape) {
      k.bones = smr.m_Bones.map((b) => resolveNodePointer(skinnedNode, b));
      k.bonesOf = skinnedNode; k.bonesList = smr.m_Bones; k.bonesStamp = shape;
      k.boneWorld = new Array(k.bones.length);
      k.pose = { position: [0, 0, 0], rotation: [0, 0, 0, 1] };
    }
    const bones = k.bones, boneWorld = k.boneWorld;
    for (let b = 0; b < bones.length; b++) boneWorld[b] = bones[b] ? worldOf(bones[b]) : null;   // PERF-SAILS4: the walk's, where it went
    const pose = k.pose, sw = worldOf(skinnedNode), sq = skinnedNode._rotationKept();
    pose.position[0] = sw[12]; pose.position[1] = sw[13]; pose.position[2] = sw[14];
    pose.rotation[0] = sq[0]; pose.rotation[1] = sq[1]; pose.rotation[2] = sq[2]; pose.rotation[3] = sq[3];
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
        try { await pipeline.getTexture(sm.textureArchive); uploadFace(sm.textureArchive, sm.textureRecord); } catch { /* the face draws nothing */ }
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
    const q = pose.rotation, p = pose.position, back = _rigBack, v = _rigV, now = k.rigNow;
    back[0] = -q[0]; back[1] = -q[1]; back[2] = -q[2]; back[3] = q[3];   // PERF-SAILS3: the undoing turn, in one kept array
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
    cityLights = !!world.cityLightsOn;   // THE STERN WINDOWS LIT: the draw's night twins (NIGHT_REMAP)
    walkStamp++;   // AUDIT PRE-MERGE 0928 R5: this frame's one walk, read below and by the draw
    const lit = _lanternFrame;
    lit.dt = gameDt; lit.cityLightsOn = !!world.cityLightsOn; lit.playerPosition = playerPosition;
    // DECK-PROPS (scenes/comeSailAway/deckFittingsHost.js): mine by my ledger, a peer's by its owner's word - before her walk
    if (models) { fitBoats(boats, (b) => fittingsOf?.(b), _fitDeps); fitBoats(peerBoats, (b) => b.fittings, _fitDeps); }
    _lifeEye = world.playerPosition ?? null;   // BOAT-FAR: the eye a boat's range is read from (none: every boat near)
    for (const boat of drawn()) {
      const dt = lifeOf(boat, gameDt);   // BOAT-FAR: the time she lives by this frame - null: held, her last walk kept
      if (dt === null) continue;
      const holders = planOf(boat, walkBoat(boat, walkStamp)).holders;   // PERF-SAILS3: her holders, in the walk's order
      for (let k = 0; k < holders.length; k += 2) lateUpdateHolder(holders[k], holders[k + 1], dt);
      lit.dt = dt;
      for (const l of boat.Lights) lanternLightUpdate(l, lit);
    }
    syncFlats();
  }
  /** PERF-SAILS3: the lanterns' frame, one record a frame rather than one a lantern (lanternLightUpdate reads it). */
  const _lanternFrame = { dt: 0, cityLightsOn: false, playerPosition: [0, 0, 0] };

  /** The billboards: a batch per active, drawn flat, its centre on its object. */
  // PERF-SAILS3: a frame's flats marked with its sweep (a batch not marked is gone), and a flat's size written into the
  // one record the pool gave it - a Set, a size and a scale a flat a frame were the flats' garbage
  let _flatSweep = 0;
  const _flatScale = [0, 0, 0];
  function syncFlats() {
    const sweep = ++_flatSweep;
    for (const boat of drawn()) {
      if ((boat.fade ?? 1) < FADE_FLATS) continue;   // SHIP-FADE: a ship half faded stands no flat - her crew and lanterns go first
      const walk = walkOf(boat);   // AUDIT PRE-MERGE 0928 R5
      _shift = heldShift(boat, walk);   // BOAT-FAR: a held boat's flats where she stands now
      const recs = walk.recs, list = planOf(boat, walk).flats;   // PERF-SAILS3: her billboards, found once
      for (let f = 0; f < list.length; f++) {
        const e = list[f], { i, node: n, bb, r } = e;
        if (!r || r.m_Enabled === false) continue;
        const size = bb.Summary.Size, w = size[0], h = size[1];
        if (!(w > 0 && h > 0)) continue;
        // BOAT-OWN (bible/07-Rendering/Performance-Priority.md): held, a flat she stood when she was walked keeps the scale
        // that frame found and only its place is made (placedAt: placed()'s own translation, to the bit) - neither the
        // whole product nor its world rotation's climb, a flat a frame. Its place and its size are both her held walk's:
        // an Animator of hers may step on a frame that holds her (mine on createBoatLives' stride, a peer's on
        // comeSailAwayPeers.js's, neither this walk's) and move or scale a node, and her flat takes neither until her next
        // life - as its place never did
        const kept = e.at === walk.stamp;
        const m = kept ? placedAt(recs[i]) : placed(recs[i]);   // PERF-SAILS2: a flat's matrix made as it is read
        let b = flats.get(n);
        if (!b) {
          if (!renderer?.createBillboardBatch) continue;
          b = renderer.createBillboardBatch(bb.Summary.Archive, bb.Summary.Record, { w, h }, [[0, 0, 0]]);   // AUDIT PRE-MERGE 0928 R6: its centre stands still - the origin moves it, which SC1's origin test sees; a batch built dynamic is replayed by every lantern near it every frame
          b.origin = [0, 0, 0];
          b._csaSweep = 0; b._csaSize = null;
          flats.set(n, b);
          // STAND-FLAT (bible/04-Characters/Morrowind-NPCs.md section 28): one of her crew - a person's flat - is a person
          // the host's people lane can stand a body for, read as a placed figure is; her deed's uid (or her hull) and the
          // flat's place in her walk name them, so a boat's crew is the same people on every machine
          if (isNpcFlat(bb.Summary.Archive)) crew.set(n, { piece: { id: `csa:${boat.uid || `h${boat.hull}`}:${i}`, flat: [bb.Summary.Archive, bb.Summary.Record] } });
        }
        if (!kept) { const s = n.lossyScaleOf(m, _flatScale); e.sx = Math.abs(s[0]); e.sy = Math.abs(s[1]); e.at = walk.stamp; }
        const sw = w * e.sx, sh = h * e.sy;
        if (b._csaSize !== null && b.size === b._csaSize) { b.size.w = sw; b.size.h = sh; }
        else b.size = b._csaSize = { w: sw, h: sh };
        b.origin[0] = m[12]; b.origin[1] = m[13] - b.size.h / 2; b.origin[2] = m[14];
        b.emissionOff = !!(r.emissionColor && r.emissionColor[0] === 0 && r.emissionColor[1] === 0 && r.emissionColor[2] === 0);
        b.conceal = boat.conceal ?? null;   // AUDIT PRE-MERGE 0928 O4: a concealed owner's crew and lanterns wear the owner's look (the cart pool's horse)
        b._csaSweep = sweep;
      }
    }
    _shift = null;
    for (const [n, b] of flats) if (b._csaSweep !== sweep) { renderer?.destroyBillboardBatch?.(b); flats.delete(n); crew.delete(n); }
  }
  const batches = () => [...flats.values()];
  /** STAND-FLAT: each of the crews standing this frame - `fn(person, batch)`, the batch's origin their feet (its base),
   *  its `conceal` their owner's look. */
  function people(fn) {
    for (const [n, f] of crew) { const b = flats.get(n); if (b) fn(f, b); }
  }

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
    if (cityLights) texRemap = nightRemapOf(texRemap);   // THE STERN WINDOWS LIT: her glass whole and glowing
    const drawRemap = texRemap;
    const cull = _cullOn && !!r._proj && !!r._view;
    if (cull) spherePlanes(multiply(r._proj, r._view, _cullPv), _cullPlanes);
    const eye = r._camPos ?? null;
    const pxPerM = cull && eye ? r._proj[5] * (r.gl?.drawingBufferHeight ?? 0) / 2 : 0;   // a metre's pixels a metre off
    let n = 0;
    const one = (gpu, m, texRemap = drawRemap) => {
      if (texRemap !== drawRemap) texRemap = paints.remapFor(gpu, texRemap, drawRemap);   // AUDIT 2: her paint only on a mesh it repaints - the renderer's picture cache keys on the remap
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
      const paint = paints.remapOf(boat.hull, liveryCodeOf(boat), cityLights, drawRemap);   // SHIP-LIVERY: her paint over the host's remap
      const walk = walkOf(boat);   // AUDIT PRE-MERGE 0928 R5
      _shift = heldShift(boat, walk);   // BOAT-FAR: a held boat's walk, carried to where she stands now
      const recs = walk.recs, parts = planOf(boat, walk).parts;   // PERF-SAILS3: her renderers, found once
      // BOAT-OWN (bible/07-Rendering/Performance-Priority.md): A HELD BOAT'S PARTS ARE THE ONES HER WALK'S DRAW FOUND.
      // Between her lives nothing a part is read for here moves - her switches and her shape end a hold (lifeOf), her
      // bakes step as she lives, a part's meshes and materials are her build's - so which of her parts draw, with which
      // mesh, alone or in her hull's frame, are what the draw over this walk found (`walk.draws`), and only where each
      // stands is made again (placed); her still batch is asked every frame, as before. A mesh still loading when she
      // was walked is drawn from her next life, up to FAR_LIFE_EVERY - 1 frames later.
      const list = walk.draws;
      const still = list.still;   // AUDIT NAV1 (#13): this frame's parts that hang in her hull's frame
      if (walk.heldAt === walkStamp && list.at === walk.stamp) {
        for (const e of list.alone) one(e.gpu, placed(recs[e.i]), paint);   // BOAT-OWN: held - her parts drawn on their own, as that draw found them
      } else {
        list.alone.length = 0; still.length = 0;
        for (let p = 0; p < parts.length; p++) {
          const e = parts[p], node = e.node, rec = recs[e.i], mr = e.mr;   // PERF-SAILS2: its matrix made where it is drawn on its own
          if (mr.m_Enabled === false || mr.materials?.[0]?.billboard) continue;
          let gpu = null, key = null;
          if (mr.classicModel != null) gpu = pipeline?.gpuMeshes?.get(mr.classicModel) ?? null;
          else {
            const mf = e.mf;
            if (mf?.baked) gpu = bakes.get(e.fix)?.gpu ?? null;
            else if (mf?.m_Mesh?.mesh) {
              key = partKey(e, mf.m_Mesh.mesh);
              gpu = meshes.has(key) ? meshes.get(key) : meshFor(key, () => rendererModel(models.geometry(e.mesh), e.slots));   // PERF-SAILS3: no builder made for a mesh already in
            }
          }
          if (!gpu) continue;
          e.gpu = gpu;   // what it is drawn with this frame - the still list's, and (BOAT-FAR's audit) how a probe tells which part a draw is
          if (key && boat.MeshObject && e.chain === undefined) e.chain = stillChain(boat, node);   // PERF-SAILS3: asked once a plan (its own cache keys on the shape and the frame, as the plan does)
          const chain = key && boat.MeshObject ? e.chain : null;
          if (chain) { e.rec = rec; still.push(e); continue; }   // PERF-SAILS3: the part's own record is the still list's entry
          list.alone.push(e);
          one(gpu, placed(rec), paint);
        }
        list.at = walk.stamp;
      }
      const batch = stillBatch(boat, still);
      const hullRec = batch ? boat.MeshObject?._walkRec ?? null : null;   // PERF-SAILS1: the record's matrix
      const frame = hullRec ? (_shift !== null ? boat.MeshObject.worldMatrix() : made(hullRec)) : null;   // PERF-SAILS2: made as it is read - BOAT-FAR: held, her batch at her hull's matrix as it stands now
      if (batch && frame) one(batch.mesh, frame, paint);
      for (const c of still) if (!batch || !frame || !batch.nodes.has(c.node)) one(c.gpu, placed(c.rec), paint);
      const shown = boat.GameObject?.activeSelf && boat.MeshObject?.activeSelf ? plaqueNameOf(boat) : null;   // SHIP-PLAQUE: her name boards, in her hull's frame - AUDIT 2: only where she is drawn (a hidden peer's boat - her look 'hidden' - sailed two boards with her name across the water; mine, off while I am indoors, hung them in the room)
      if (shown) for (const mesh of plaques.meshesFor(boat, shown)) one(mesh, frame ?? worldOf(boat.MeshObject), paint);
      if (fade < 1) r.setDissolve?.(1);
    }
    _shift = null;
    plaques.sweep();
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
    const stamp = prefabShapeStamp(node), frame = boat.MeshObject;   // BOAT-STAMP: its own tree's
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
        out.push({ x: p[0], y: p[1], z: p[2], range: l.range, color: [l.color[0] * l.intensity, l.color[1] * l.intensity, l.color[2] * l.intensity], _d: eye ? Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]) : 0, _src: l });
      }
    }
    out.sort((a, b) => a._d - b._d);
    return out.slice(0, CSA_LIGHTS_MAX).map(({ _d, _src, ...l }) => adoptLight(l, _src));   // LIGHT-ID: each lantern her own, as she sails
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
   *  Large Boat's seven stand her rig 0's own, pinned rig by rig - test/systems/naval/auditnav2_deck.test.js), so every rig's deck is
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

  /** SHIP-PLAQUE: a hull's drawn surface at rest in her MeshObject's frame - each still mesh she wears (her planking, her
   *  transom, her rails: a MeshFilter's mesh, a classic model's once the pipeline holds it; a sail baked as it fills, a
   *  flag, and a billboard are none) - `[{ positions, indices, name }]`, or null with no models. Her colliders are the
   *  deck's (deckOf) and stand a hull's walls coarsely; her name board is laid on what is seen. */
  function hullSurface(hull) {
    if (!models) return null;
    const probe = new Boat(hull, 0);
    spawnBoat(probe, { models, player: () => ({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }), billboardSize: billboardSizeOf, modelBounds: modelBoundsOf });
    const frame = invertAffine(probe.MeshObject.worldMatrix());
    const out = [];
    const stack = [probe.MeshObject];
    while (stack.length) {
      const n = stack.pop();
      if (n === probe.FlagObject || n.activeSelf === false) continue;
      for (const c of n.children) stack.push(c);
      const mr = n.getComponent?.('MeshRenderer'), mf = n.getComponent?.('MeshFilter');
      if (!mr || mr.m_Enabled === false || mr.materials?.[0]?.billboard || mf?.baked) continue;
      const cpu = mr.classicModel != null ? pipeline?.cpuModels?.get(mr.classicModel) : null;
      const g = mr.classicModel != null ? (cpu?.positions && cpu.indices ? cpu : null) : mf?.m_Mesh?.mesh ? models.geometry(mf.m_Mesh.mesh) : null;
      if (!g?.positions || !g.indices) continue;
      const m = frame ? multiply(frame, n.worldMatrix(), new Float32Array(16)) : n.worldMatrix();
      const p = g.positions, pos = new Float64Array(p.length);
      for (let i = 0; i < p.length; i += 3) {
        const x = p[i], y = p[i + 1], z = p[i + 2];
        pos[i] = m[0] * x + m[4] * y + m[8] * z + m[12];
        pos[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        pos[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      }
      out.push({ positions: pos, indices: g.indices, name: n.name ?? '' });
    }
    return out;
  }

  return {
    hullSurface,   // SHIP-PLAQUE
    ensureModels, spawn, spawnNow, preload, ready: () => preloaded, remove, setVariant, frame, batches, people, draw, lights, offsetAll, destroyAll,
    deckOf,   // DECK-WALK
    hullRig,   // OWS2
    portrait,   // MENU-ORDER: a hull's picture for the shipmaster's card
    spawnPeerNow, spawnSeaNow,
    /** BOAT-FAR: the eye the last frame read the boats' range from (its playerPosition), or null - the peers' boats' law. */
    lifeEye: () => _lifeEye,
    /** AUDIT PRE-MERGE 0928 R5: a boat's walk as this frame made it (its nodes and world matrices) - a probe's reading. */
    walkOf: walkMade,
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
