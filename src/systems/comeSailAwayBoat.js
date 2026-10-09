// @ts-check
// CSA-B (2026-09-27): COME SAIL AWAY'S BOAT, BUILT - `Boat` (Boat.cs), and
// ComeSailAway.cs's SpawnBoat (1120-1270), ApplyBoatVariant / ReinitializeBoat
// / SetBoatVariant (1270-1308), SetupBillboardHelper / AddBillboardLight /
// SetupModelHelper / SetLights (1344-1526) and GetBoatTransforms (1526-1811),
// over world/prefabNode.js's tree - the GameObjects and Transforms the C#
// makes and walks, by the names it walks them by.
//
// The DFU calls the C# makes are restated here, each as DFU's own code does
// it:
// - MeshReplacement.ImportCustomGameobject(id, parent, matrix)
//   (MeshReplacement.cs:99-120): the mod's prefab instanced, named
//   `DaggerfallMesh [ID=id] [Replacement]`, `transform.parent = parent`
//   (world position, rotation and scale kept), moved to the matrix's
//   position and rotation, its local scale times the matrix's lossy scale.
//   The matrix is always the PLAYER's (`PlayerObject.transform.
//   localToWorldMatrix`): the C# then zeroes the local position and (most
//   times) the rotation, so the player's pose survives in one place only -
//   the variant, status and position triggers keep the player's rotation
//   relative to the boat (their local rotation is never reset; kept bug for
//   bug). The player is never scaled, so the lossy scale is one.
// - GameObjectHelper.CreateDaggerfallBillboardGameObject(archive, record,
//   parent) (GameObjectHelper.cs:313-334): `DaggerfallBillboard
//   [TEXTURE.AAA, Index=R]` under the parent (world kept), its
//   DaggerfallBillboard's Summary.Size the record's scaled size
//   (DaggerfallBillboard.SetMaterial). The trigger box DFU adds only for a
//   flat with a custom activation is never added: every registration in the
//   sources the port carries is a MODEL's (Roleplay Realism's beds
//   41000-41002, Eye of the Beholder's cart 41239, this mod's 112400-112406),
//   so no flat of a boat's has one. (The boat's bed IS model 41000, so in DFU
//   Roleplay Realism's BedActivation answers it - CSA-G's.)
// - GameObjectHelper.CreateDaggerfallMeshGameObject(id, parent)
//   (GameObjectHelper.cs:147-207): `DaggerfallMesh [ID=id]` under the
//   parent (world kept), the classic model with a MeshCollider over it.
// - GameObjectHelper.InstantiatePrefab(DungeonLightPrefab, '', parent,
//   position) (:372-392): the light, under the lantern, at its position.
// The DFU data those need - a flat's scaled size, a classic model's box -
// come from the host (`ctx`, below), loaded before a boat is spawned
// (`boatAssetNeeds`), so SpawnBoat itself runs straight through as the C#
// does.
//
// What is found and kept for later slices: the audio sources, the cargo and
// the particle systems (CSA-G, CSA-H and CSA-F). CSA-E: every Animator of
// an instance gets its runtime as the prefab is instanced
// (world/unityAnimator.js), so the sails' CrossFade("Stowed", 2) and
// SetBool("Stowed", true) below are asked of it as the C# asks them.
//
//   ctx = {
//     models          systems/comeSailAwayModels.js's
//     player() -> { position: [x,y,z], rotation: [x,y,z,w] }   PlayerObject.transform, Unity space
//     billboardSize(archive, record) -> [w, h] | null          Summary.Size (world/rmbFlats.js billboardSize)
//     modelBounds(modelId) -> { min, max } | null              the classic model's Mesh.bounds (its vertex box)
//     sailAnimationSpeed                                        ComeSailAway.sailAnimationSpeed (2)
//     audioClips                                                ComeSailAway.audioClips (Start's five)
//   }

import { PrefabNode, instantiatePrefab } from '../world/prefabNode.js';
import { applyRuntimeMaterials, bundleSlots, dfMaterial, gameTextureFromName } from './comeSailAwayModels.js';
import { createAnimator } from '../world/unityAnimator.js';
import { instanceParticleSystems } from '../world/unityParticles.js';
import { HULL_NAMES, HULL_PRICES, HULL_WEIGHTS, VARIANT_NAMES } from './comeSailAwayHulls.js';   // INT1: the table's leaf - the item law reads it in a Worker

/** ComeSailAway.firstHullModelID - SpawnBoat asks for 112410 + hull. */
export const FIRST_HULL_MODEL_ID = 112410;
/** The seven trigger prefabs and what Start registers on them (PlayerActivate.RegisterCustomActivation, 3.2). */
export const TRIGGER_MODEL = Object.freeze({ drive: 112400, board: 112401, cargo: 112402, door: 112403, variant: 112404, status: 112405, position: 112406 });
export { HULL_NAMES, HULL_PRICES, HULL_WEIGHTS, VARIANT_NAMES };
/** SHIP-PACK (2026-10-01, the review before the merge: "Allow larger ships to be picked up, just like smaller vessels"):
 *  what a hull's parts weigh packed - the table's, and never more than the Large Boat's. The three ships' rows (2,400 to
 *  240,000 kg) were never an item's in the mod, whose ships were never packed: in the pack they would hold the bearer
 *  under the water, sink any boat she sailed ("You're going to need a bigger boat") and take nothing more aboard. */
export const PACKED_WEIGHT_MAX = HULL_WEIGHTS[1];
export const packedHullWeight = (hull) => Math.min(HULL_WEIGHTS[hull], PACKED_WEIGHT_MAX);
/** AUDIT PRE-MERGE 0928 O1: the variant objects each hull's prefab carries under its `Variants` node (GetVariantCount) -
 *  the Large Boat's seven, and none on the rest, whose SpawnBoat never reads its variant. */
export const HULL_VARIANT_COUNTS = Object.freeze([0, 7, 0, 0, 0]);
export const SAIL_ANIMATION_SPEED = 2;
/** The five clips Start loads (audioClips[0..4]); SpawnBoat's loops are the first two. */
export const AUDIO_CLIPS = Object.freeze(['SmallShipAmbience', 'ShipExteriorAmbience2', 'Oars_In', 'Oars_Sweep', 'Oars_Out']);
/** The helper names' three separators (archiveStart, recordStart, alignmentStart). */
export const ARCHIVE_START = '-', RECORD_START = '_', ALIGNMENT_START = ':';
/** GetBoatTransforms' bed (CreateDaggerfallMeshGameObject(41000)) and fire (CreateDaggerfallBillboardGameObject(210, 1)). */
export const BED_MODEL_ID = 41000;
export const FIRE_OBJECT_FLAT = Object.freeze([210, 1]);
/** SetupBillboardHelper: a lantern is any archive-210 flat, and it gets a light. */
export const LIGHT_ARCHIVE = 210;
/** AddBillboardLight's settings over DFU's dungeon light prefab: Color32(255, 147, 41, 255), 1, 20, LightType 2 (Point),
 *  LightShadows 1 (Hard), 1, 140. */
export const LANTERN_LIGHT = Object.freeze({ color: Object.freeze([1, 147 / 255, 41 / 255, 1]), intensity: 1, range: 20, lightType: 'Point', shadows: 'Hard', shadowStrength: 1, spotAngle: 140 });
/** DungeonLightHandler's defaults: UnscaledBlockRange 2060 (x MeshReader.GlobalScale 0.025), every 0.4 s. */
export const DUNGEON_LIGHT_HANDLER = Object.freeze({ unscaledBlockRange: 2060, updateInSeconds: 0.4 });
/** Unity's name for `new GameObject()`. */
export const NEW_GAME_OBJECT = 'New Game Object';
/** InventoryContainerImages 6 - the boat's cargo is a Wagon container (DaggerfallLoot.ContainerImage). */
export const CARGO_CONTAINER_IMAGE = 6;

const V_UP = [0, 1, 0];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/** Boat.cs, field for field (the C# field names; `Nodes` five, `NodeTileMapIndices` five). */
export class Boat {
  constructor(hullTarget = 0, variantTarget = 0) {
    this.hull = hullTarget;
    this.variant = variantTarget;
    this.uid = 0;   // the deed's item UID (placeItem.UID) - set where CSA-C places the boat
    this.packable = false;
    this.crewed = false;
    this.itemValue = null;   // SHIP-PACK (the port's own): the worth of the item that placed her, deed or parts (comeSailAway.js takePlaceItem) - her parts are packed at it
    this.groundAsked = false;   // FIELD BUGS 29h (LOST-BOAT, the port's own): the ground under it asked once (comeSailAway.js recoverLostBoats)
    this.modifierMoveSpeedOar = 0; this.modifierMoveAccelerationOar = 0;
    this.modifierMoveSpeedSail = 0; this.modifierMoveAccelerationSail = 0;
    this.modifierTurnSpeedOar = 0; this.modifierTurnAccelerationOar = 0;
    this.modifierTurnSpeedSail = 0; this.modifierTurnAccelerationSail = 0;
    this.modifierAnimation = 0; this.modifierRudder = 0;
    this.modifierAudioVolume = 0; this.modifierAudioRange = 0; this.modifierAudioSpatialBlend = 0;
    this.modifierCargoThreshold = 0;
    /** @type {PrefabNode|null} */ this.GameObject = null;
    /** @type {PrefabNode|null} */ this.MeshObject = null;
    this.MeshObjectOffset = [0, 0, 0];
    /** @type {any} */ this.MeshCollider = null;
    /** @type {PrefabNode|null} */ this.FireObject = null;
    /** @type {PrefabNode|null} */ this.BedObject = null;
    /** @type {PrefabNode[]} */ this.BoardTriggers = [];
    /** @type {PrefabNode[]} */ this.DoorTriggers = [];
    /** @type {PrefabNode|null} */ this.DriveTrigger = null;
    /** @type {PrefabNode|null} */ this.DrivePosition = null;
    /** @type {PrefabNode|null} */ this.CargoTrigger = null;
    /** @type {PrefabNode|null} */ this.StatusTrigger = null;
    /** @type {PrefabNode|null} */ this.PositionTrigger = null;
    /** @type {PrefabNode|null} */ this.VariantTrigger = null;
    /** @type {PrefabNode|null} */ this.VariantObject = null;
    /** @type {PrefabNode|null} */ this.WakeObject = null;
    /** @type {any} */ this.WakeEmitter = null;
    /** @type {any} */ this.WakeEmitterMain = null;
    /** @type {PrefabNode|null} */ this.FlagObject = null;
    /** @type {any} */ this.FlagEmitter = null;
    /** @type {any} */ this.FlagEmitterMain = null;
    /** @type {PrefabNode|null} */ this.RudderObject = null;
    /** @type {any} */ this.RudderAnimator = null;
    /** @type {any[]} */ this.RudderEmitters = [];
    /** @type {PrefabNode|null} */ this.ActiveObject = null;
    /** @type {PrefabNode|null} */ this.IdleObject = null;
    /** @type {(PrefabNode|null)[]} */ this.Nodes = [null, null, null, null, null];
    this.NodeTileMapIndices = [0, 0, 0, 0, 0];
    /** @type {PrefabNode[]} */ this.Booms = [];
    /** @type {PrefabNode[]} */ this.Sails = [];
    /** @type {PrefabNode[]} */ this.SailsSquare = [];
    /** @type {PrefabNode[]} */ this.SailsLateen = [];
    /** @type {PrefabNode[]} */ this.SailsGaff = [];
    /** @type {PrefabNode[]} */ this.SailsStay = [];
    /** @type {PrefabNode[]} */ this.SailsSmall = [];
    /** @type {PrefabNode[]} */ this.SailsLarge = [];
    this.LightOn = false;
    /** @type {any[]} */ this.Lights = [];
    /** @type {{X:number, Y:number}|null} */ this.MapPixel = null;
    this.Position = [0, 0, 0];
    this.Direction = [0, 0, 0];
    this.inside = false;
    /** @type {any} */ this.Cargo = null;
    /** @type {any} */ this.DFAudioSource = null;
    /** @type {any} */ this.AudioSourceSlow = null;
    /** @type {any} */ this.AudioSourceFast = null;
    /** @type {any[]} */ this.OarParticles = [];
    /** CSA-F: every particle system of its tree, found at its first step (the port's; the C# never lists them). */
    /** @type {any[] | null} */ this.particleSystems = null;
  }
  /** Boat.GetVariantCount - VariantObject.transform.childCount (a boat without variants throws there in C#). */
  get GetVariantCount() { return this.VariantObject ? this.VariantObject.childCount : 0; }
}

// ── the DFU doors ────────────────────────────────────────────────────────────

/** GameObjectHelper.GetGoModelName / GetGoFlatName. */
export const goModelName = (modelId) => `DaggerfallMesh [ID=${modelId}]`;
export const goFlatName = (archive, record) => `DaggerfallBillboard [TEXTURE.${String(archive).padStart(3, '0')}, Index=${record}]`;

/**
 * MeshReplacement.ImportCustomGameobject(modelId, parent, player's matrix) -
 * null when the mod carries no such prefab (TryImportGameObject's false).
 * Each renderer's RuntimeMaterials is applied as it is instanced (its Awake).
 */
export function importCustomGameobject(ctx, modelId, parent) {
  const tree = ctx.models.prefab(modelId);
  if (!tree) return null;
  const go = instantiatePrefab(tree, ctx.models.components);
  for (const n of go.walk()) {
    applyRuntimeMaterials(n);
    // CSA-E: each Animator of the instance, its runtime (Unity's OnEnable at instancing - world/unityAnimator.js)
    for (const c of n.getComponents('Animator')) c.animator = createAnimator(n, c, ctx.models.animation ?? {});
  }
  // CSA-F: each ParticleSystem of the instance, its runtime (world/unityParticles.js), the instance's sub-emitters and
  // collision planes linked - playOnAwake ones playing from here
  instanceParticleSystems(go, { random: ctx.particleRandom });
  go.name = `${goModelName(modelId)} [Replacement]`;
  const player = ctx.player();
  go.setParentKeepWorld(parent);
  go.position = player.position;
  go.rotation = player.rotation;
  // localScale = Vector3.Scale(localScale, matrix.lossyScale): the player's scale is one
  return go;
}

/** `new GameObject(name)` under `parent` with `transform.parent = parent` (world kept). */
function newChild(name, parent) {
  const go = new PrefabNode(name);
  if (parent) go.setParentKeepWorld(parent);
  return go;
}

/** GameObjectHelper.CreateDaggerfallBillboardGameObject(archive, record, parent). */
export function createDaggerfallBillboardGameObject(ctx, archive, record, parent) {
  const go = newChild(goFlatName(archive, record), parent);
  const size = ctx.billboardSize?.(archive, record) ?? null;
  go.addComponent({ type: 'DaggerfallBillboard', Summary: { Archive: archive, Record: record, Size: size ? [size[0], size[1]] : [0, 0] } });
  // SetMaterial's MeshRenderer: the flat's material (alphaIndex 0, a billboard's cutout); SetLights writes its _EmissionColor
  go.addComponent({ type: 'MeshRenderer', m_Enabled: true, materials: [{ ...dfMaterial(archive, record), billboard: true }], emissionColor: null });
  return go;
}

/** GameObjectHelper.CreateDaggerfallMeshGameObject(modelId, parent) - the classic model, a MeshCollider over it. */
export function createDaggerfallMeshGameObject(ctx, modelId, parent) {
  const go = newChild(goModelName(modelId), parent);
  go.addComponent({ type: 'DaggerfallMesh', modelId });
  go.addComponent({ type: 'MeshRenderer', m_Enabled: true, classicModel: modelId });
  go.addComponent({ type: 'MeshCollider', m_Enabled: true, m_Convex: false, m_IsTrigger: false, classicModel: modelId });
  return go;
}

// ── bounds ───────────────────────────────────────────────────────────────────

/** Unity's own primitives' boxes (Mesh.bounds): the built-in Plane is 10 x 10 on XZ, the Cube and Sphere a unit. */
export const BUILTIN_BOUNDS = Object.freeze({
  Plane: Object.freeze({ center: [0, 0, 0], extent: [5, 0, 5] }),
  Cube: Object.freeze({ center: [0, 0, 0], extent: [0.5, 0.5, 0.5] }),
  Sphere: Object.freeze({ center: [0, 0, 0], extent: [0.5, 0.5, 0.5] }),
});

/** The local box (Mesh.bounds, center and extent) a mesh pointer names, or null. */
export function meshLocalBounds(ctx, meshRef) {
  if (!meshRef) return null;
  if (meshRef.builtin) return BUILTIN_BOUNDS[meshRef.builtin] ?? null;
  if (meshRef.mesh) return ctx.models.meshes[meshRef.mesh]?.aabb ?? null;
  return null;
}
/** A classic model's local box as center and extent, off `ctx.modelBounds`. */
function classicLocalBounds(ctx, modelId) {
  const b = ctx.modelBounds?.(modelId);
  if (!b) return null;
  return { center: scale3(add3(b.min, b.max), 0.5), extent: scale3(sub3(b.max, b.min), 0.5) };
}

/**
 * A local box under a node's matrix, as Unity bounds a renderer or a mesh
 * collider: the box's eight corners transformed, their axis-aligned box
 * (the port's reading of Collider.bounds, world/staticBuildings.js's).
 * @returns {{ center:number[], extents:number[], size:number[], min:number[], max:number[] }}
 */
export function worldBounds(node, local) {
  const m = node.worldMatrix();
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < 8; i++) {
    const l = [0, 1, 2].map((d) => local.center[d] + ((i >> d) & 1 ? local.extent[d] : -local.extent[d]));
    const w = [0, 1, 2].map((d) => m[d] * l[0] + m[4 + d] * l[1] + m[8 + d] * l[2] + m[12 + d]);
    for (let d = 0; d < 3; d++) { if (w[d] < min[d]) min[d] = w[d]; if (w[d] > max[d]) max[d] = w[d]; }
  }
  const center = scale3(add3(min, max), 0.5), size = sub3(max, min);
  return { center, extents: scale3(size, 0.5), size, min, max };
}

/** Collider.bounds of a MeshCollider on `node` (its mesh, or the classic model under it). */
export function colliderBounds(ctx, node, collider) {
  const local = collider.classicModel != null ? classicLocalBounds(ctx, collider.classicModel) : meshLocalBounds(ctx, collider.m_Mesh);
  return local ? worldBounds(node, local) : null;
}
/**
 * CSA-J: GetComponentInChildren<Collider>().bounds, which Eye of the Beholder asks of the boat's mesh object: the
 * first collider depth first from `node` - the node itself first, in component order, on active objects only - and
 * its Collider.bounds; a box collider's own box under its node. The bundle's colliders are boxes and meshes alone.
 * @returns {{ center:number[], extents:number[], size:number[], min:number[], max:number[] } | null} null: none
 */
export function colliderBoundsInChildren(ctx, node) {
  if (!node?.activeInHierarchy) return null;
  const first = (n) => {
    const c = n.components.find((k) => k.type === 'BoxCollider' || k.type === 'MeshCollider');
    if (c) return { n, c };
    for (const ch of n.children) {
      if (!ch.activeSelf) continue;
      const found = first(ch);
      if (found) return found;
    }
    return null;
  };
  const hit = first(node);
  if (!hit) return null;
  if (hit.c.type === 'MeshCollider') return colliderBounds(ctx, hit.n, hit.c);
  const { m_Center: c = { x: 0, y: 0, z: 0 }, m_Size: s = { x: 1, y: 1, z: 1 } } = hit.c;
  return worldBounds(hit.n, { center: [c.x, c.y, c.z], extent: [s.x / 2, s.y / 2, s.z / 2] });
}
/** Renderer.bounds of a classic model's MeshRenderer on `node`. */
export function classicRendererBounds(ctx, node, modelId) {
  const local = classicLocalBounds(ctx, modelId);
  return local ? worldBounds(node, local) : null;
}

// ── SpawnBoat ────────────────────────────────────────────────────────────────

/**
 * SpawnBoat (1120-1270): the boat's root at the world's origin, the hull's
 * prefab under it, the five nodes off the hull collider's bounds, the walk,
 * the sails stowed, the idle object shown, the lights set, the three audio
 * sources and the cargo.
 * @param {Boat} newBoat
 */
export function spawnBoat(newBoat, ctx) {
  newBoat.GameObject = new PrefabNode('Boat');
  newBoat.GameObject.position = [0, 0, 0];
  const val = importCustomGameobject(ctx, FIRST_HULL_MODEL_ID + newBoat.hull, newBoat.GameObject);
  if (!val) throw new Error(`Come Sail Away: no hull prefab ${FIRST_HULL_MODEL_ID + newBoat.hull}`);   // the C#'s NullReferenceException at val.transform
  val.localPosition = [0, 0, 0];
  val.localRotation = [0, 0, 0, 1];
  newBoat.MeshCollider = val.getComponentInChildren('MeshCollider');
  newBoat.MeshObject = nodeOf(val, newBoat.MeshCollider);
  newBoat.MeshObjectOffset = [...newBoat.MeshObject.localPosition];
  const bounds = colliderBounds(ctx, newBoat.MeshObject, newBoat.MeshCollider);
  const { center: c, extents: e } = bounds;
  const node = (i, name, p) => {
    const n = newChild(name, newBoat.GameObject);
    newBoat.Nodes[i] = n;
    newBoat.NodeTileMapIndices[i] = -1;
    n.localPosition = p;
  };
  node(0, 'Center', [c[0], c[1], c[2]]);
  node(1, 'Fore', [c[0], c[1], c[2] + e[2]]);
  node(2, 'Aft', [c[0], c[1], c[2] - e[2]]);
  node(3, 'Starboard', [c[0] + e[0], c[1], c[2]]);
  node(4, 'Port', [c[0] - e[0], c[1], c[2]]);
  getBoatTransforms(newBoat, newBoat.GameObject, ctx);
  if (newBoat.Sails.length > 0) {
    for (const sail of newBoat.Sails) {
      const component = animatorOf(sail);
      if (component != null) {
        component.CrossFade('Stowed', ctx.sailAnimationSpeed ?? SAIL_ANIMATION_SPEED);
        component.SetBool('Stowed', true);
      }
    }
  }
  newBoat.IdleObject.setActive(true);
  newBoat.ActiveObject.setActive(false);
  setLights(newBoat, newBoat.LightOn);
  const clips = ctx.audioClips ?? AUDIO_CLIPS;
  const meshBounds = meshLocalBounds(ctx, newBoat.MeshCollider.m_Mesh);   // MeshCollider.sharedMesh.bounds
  const loop = (name, clip) => {
    const go = newChild(name, newBoat.GameObject);
    go.localPosition = [0, 0, 0];
    const src = go.addComponent({ type: 'AudioSource', clip, loop: true, spatialBlend: 1, minDistance: 0, maxDistance: 0, volume: 1, isPlaying: false });   // CSA-F: AudioSource.volume and isPlaying - the wake reads them
    src.minDistance = Math.fround(meshBounds.extent[2] * 0.5);
    src.maxDistance = Math.fround(src.minDistance * 2);
    return src;
  };
  newBoat.AudioSourceSlow = loop('BoatSFXSlow', clips[0]);
  newBoat.AudioSourceFast = loop('BoatSFXFast', clips[1]);
  const val9 = newChild('BoatSFXOneShot', newBoat.GameObject);
  val9.localPosition = [0, 0, 0];
  val9.addComponent({ type: 'AudioSource' });
  newBoat.DFAudioSource = val9.addComponent({ type: 'DaggerfallAudioSource' });
  const val10 = newChild('BoatCargo', newBoat.GameObject);
  val10.localPosition = [0, 0, 0];
  newBoat.Cargo = val10.addComponent({ type: 'DaggerfallLoot', ContainerImage: CARGO_CONTAINER_IMAGE, playerOwned: true, Items: [] });   // DaggerfallLoot.Items: an empty ItemCollection (CSA-C's save reads and writes it)
  return newBoat;
}

/** The node a component record sits on, under `root`. */
export function nodeOf(root, component) {
  if (!component) return null;
  for (const n of root.walk()) if (n.components.includes(component)) return n;
  return null;
}

// ── variants ─────────────────────────────────────────────────────────────────

/** ApplyBoatVariant (1270-1288). */
export function applyBoatVariant(boat, ctx) {
  if (boat.VariantObject == null) return;
  for (let i = 0; i < boat.GetVariantCount; i++) boat.VariantObject.getChild(i).setActive(i === boat.variant);
  reinitializeBoat(boat, ctx);
}
/** ReinitializeBoat (1290-1302). */
export function reinitializeBoat(boat, ctx) {
  boat.Sails.length = 0; boat.SailsGaff.length = 0; boat.SailsLarge.length = 0; boat.SailsLateen.length = 0;
  boat.SailsSmall.length = 0; boat.SailsSquare.length = 0; boat.SailsStay.length = 0;
  boat.Booms.length = 0;
  boat.FlagObject = null;
  getBoatTransforms(boat, boat.GameObject, ctx, true);
}
/** SetBoatVariant (1304-1308). */
export function setBoatVariant(boat, variant, ctx) {
  boat.variant = variant;
  applyBoatVariant(boat, ctx);
}

// ── the helpers ──────────────────────────────────────────────────────────────

/**
 * The helper name's numbers: `Convert.ToInt32(name.Substring(name.IndexOf(c) + 1, n))`. The C# throws out of
 * GetBoatTransforms - and so out of SpawnBoat - on a name that is too short or not a number, and so does this.
 */
export function helperField(name, sep, length) {
  const i = name.indexOf(sep) + 1;
  if (i + length > name.length) throw new RangeError(`ArgumentOutOfRangeException: "${name}".Substring(${i}, ${length})`);
  const s = name.substring(i, i + length);
  if (!/^\s*[+-]?\d+\s*$/.test(s)) throw new TypeError(`FormatException: Convert.ToInt32("${s}")`);
  return Number.parseInt(s.trim(), 10);
}
/** SetupBillboardHelper's parse: `BillboardHelper-AAA_RRR:L`. */
export const billboardHelperFields = (name) => ({ archive: helperField(name, ARCHIVE_START, 3), record: helperField(name, RECORD_START, 3), alignment: helperField(name, ALIGNMENT_START, 1) });
/** SetupModelHelper's parse: `ModelHelper-NNNNN:L`. */
export const modelHelperFields = (name) => ({ modelId: helperField(name, ARCHIVE_START, 5), alignment: helperField(name, ALIGNMENT_START, 1) });

/** SetupBillboardHelper (1344-1377). */
export function setupBillboardHelper(boat, parent, ctx) {
  const { archive: num, record: num2, alignment: num3 } = billboardHelperFields(parent.name);
  const val = createDaggerfallBillboardGameObject(ctx, num, num2, parent);
  val.localPosition = [0, 0, 0];
  val.localScale = [1, 1, 1];
  const component = val.getComponent('DaggerfallBillboard');
  if (num3 === 1) val.localPosition = add3(val.localPosition, scale3(V_UP, Math.fround(component.Summary.Size[1] / 2)));
  else if (num3 === 2) val.localPosition = sub3(val.localPosition, scale3(V_UP, Math.fround(component.Summary.Size[1] / 2)));
  if (num === LIGHT_ARCHIVE) boat.Lights.push(addBillboardLight(component, val, ctx));
}

/** AddBillboardLight (1379-1411): DFU's dungeon light under the lantern, the mod's settings on it. */
export function addBillboardLight(billboard, billboardNode, ctx, alignment = 0) {
  const val = newChild('DungeonLight(Clone)', billboardNode);
  val.position = billboardNode.position;
  const component = val.addComponent({ type: 'Light', enabled: true, ...LANTERN_LIGHT, color: [...LANTERN_LIGHT.color] });
  val.addComponent({ type: 'DaggerfallLight', enabled: true, Animate: false, InteriorLight: false, lastCityLightsFlag: null });
  val.addComponent({ type: 'DungeonLightHandler', enabled: true, UnscaledBlockRange: DUNGEON_LIGHT_HANDLER.unscaledBlockRange, UpdateInSeconds: DUNGEON_LIGHT_HANDLER.updateInSeconds, timer: 0 });
  if (alignment === 1) val.localPosition = add3(val.localPosition, scale3(V_UP, billboard.Summary.Size[1] / 2));
  else if (alignment === 2) val.localPosition = sub3(val.localPosition, scale3(V_UP, billboard.Summary.Size[1] / 2));
  component.node = val;
  return component;
}

/** SetupModelHelper (1413-1450): the classic model centred on the helper by its renderer's bounds, then aligned. */
export function setupModelHelper(boat, parent, ctx) {
  const { modelId: num, alignment: num2 } = modelHelperFields(parent.name);
  const val = createDaggerfallMeshGameObject(ctx, num, parent);
  val.localPosition = [0, 0, 0];
  val.localScale = [1, 1, 1];
  const position = val.position;
  let bounds = classicRendererBounds(ctx, val, num);
  if (!bounds) return;   // the player's ARCH3D has no such model: DFU's renderer has no mesh, its bounds sit at the object
  const val2 = sub3(position, bounds.center);
  val.localPosition = add3(val.localPosition, val2);
  if (num2 === 1) { bounds = classicRendererBounds(ctx, val, num); val.localPosition = add3(val.localPosition, scale3(V_UP, bounds.extents[1])); }
  else if (num2 === 2) { bounds = classicRendererBounds(ctx, val, num); val.localPosition = sub3(val.localPosition, scale3(V_UP, bounds.extents[1])); }
}

/** SetLights (1452-1476): each lantern's light and its two DFU behaviours on or off, and its flat's emission white or black. */
export function setLights(boat, value) {
  if (boat.Lights.length < 1) return;
  boat.LightOn = value;
  for (const light of boat.Lights) {
    light.enabled = value;
    light.node.getComponent('DaggerfallLight').enabled = value;
    light.node.getComponent('DungeonLightHandler').enabled = value;
    const component = light.node.parent.getComponent('MeshRenderer');
    component.emissionColor = value ? [1, 1, 1, 1] : [0, 0, 0, 1];
  }
}

// ── the Animators (CSA-E) ────────────────────────────────────────────────────

/** `GetComponent<Animator>()` on a node: its runtime (world/unityAnimator.js), or null. */
export const animatorOf = (node) => node?.getComponent('Animator')?.animator ?? null;
/** Every Animator a boat carries, for the frame's step (Unity updates each after the scripts' Update). */
export const boatAnimators = (boat) => [...boat.GameObject.walk()].flatMap((n) => n.getComponents('Animator').map((c) => c.animator).filter(Boolean));
/** CSA-F: every particle system of a boat's tree, as Unity's ParticleSystem update finds them. */
export const boatParticleSystems = (boat) => [...boat.GameObject.walk()].flatMap((n) => n.getComponents('ParticleSystem').map((c) => c.particleSystem).filter(Boolean));

// ── GetBoatTransforms ────────────────────────────────────────────────────────

/**
 * GetBoatTransforms (1526-1811): every ACTIVE child, in order, by name - and
 * then into it. The loop reads `parent.childCount` afresh each step, so a
 * child the walk adds to `parent` itself (the door trigger, imported under
 * the door's own node) is visited too, as are the objects it adds under a
 * child before it steps into that child (a billboard, a light, a model, a
 * trigger, the baked sail's holder).
 * @param {Boat} boat
 * @param {PrefabNode} parent
 */
export function getBoatTransforms(boat, parent, ctx, reinitialize = false) {
  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.getChild(i);
    if (!child.activeSelf) continue;
    const name = child.name;
    if (boat.VariantObject == null && name === 'Variants') {
      boat.VariantObject = child;
      const v = boat.VariantObject.getChild(boat.variant);
      if (!v) throw new Error(`Come Sail Away: Transform child out of bounds (variant ${boat.variant} of ${boat.VariantObject.childCount})`);
      v.setActive(true);
    }
    if (name.includes('BillboardHelper') && !reinitialize) setupBillboardHelper(boat, child, ctx);
    if (name.includes('ModelHelper') && !reinitialize) setupModelHelper(boat, child, ctx);
    if (name === 'Crewed') boat.crewed = boat.packable = true;   // SHIP-PACK: a crewed ship is picked up as the small boats are (comeSailAway.js PackBoat - her deed goes with her)
    if (name === 'Packable') boat.packable = true;
    if (name.includes('Handling')) {
      if (name.includes('Oar')) {
        boat.modifierMoveSpeedOar = child.localPosition[0];
        boat.modifierMoveAccelerationOar = child.localPosition[1];
        boat.modifierTurnSpeedOar = child.localScale[0];
        boat.modifierTurnAccelerationOar = child.localScale[1];
      }
      if (name.includes('Sail')) {
        boat.modifierMoveSpeedSail = child.localPosition[0];
        boat.modifierMoveAccelerationSail = child.localPosition[1];
        boat.modifierTurnSpeedSail = child.localScale[0];
        boat.modifierTurnAccelerationSail = child.localScale[1];
      }
      if (name.includes('Rudder')) boat.modifierRudder = child.localPosition[0];
      if (name.includes('Animation')) boat.modifierAnimation = child.localPosition[0];
    }
    if (name === 'Cargo') boat.modifierCargoThreshold = child.localPosition[0];
    if (name.includes('Audio')) {
      boat.modifierAudioVolume = 1;
      boat.modifierAudioRange = child.localPosition[1];
      boat.modifierAudioSpatialBlend = child.localPosition[2];
    }
    if (boat.FlagObject == null && name === 'FlagObject') {
      boat.FlagObject = child;
      boat.FlagEmitter = boat.FlagObject.getComponentInChildren('ParticleSystem').particleSystem;   // CSA-F: the component's runtime
      boat.FlagEmitterMain = boat.FlagEmitter.main;
    }
    if (boat.WakeObject == null && name === 'WakeObject') {
      boat.WakeObject = child;
      boat.WakeEmitter = boat.WakeObject.getComponent('ParticleSystem').particleSystem;
      boat.WakeEmitterMain = boat.WakeEmitter.main;
    }
    if (boat.DriveTrigger == null && name === 'DriveTrigger') {
      boat.DriveTrigger = importCustomGameobject(ctx, TRIGGER_MODEL.drive, child);
      boat.DriveTrigger.localPosition = [0, 0, 0];
      boat.DriveTrigger.localRotation = [0, 0, 0, 1];
    }
    if (boat.CargoTrigger == null && name === 'CargoTrigger') {
      boat.CargoTrigger = importCustomGameobject(ctx, TRIGGER_MODEL.cargo, child);
      boat.CargoTrigger.localPosition = [0, 0, 0];
      boat.CargoTrigger.localRotation = [0, 0, 0, 1];
    }
    if (name === 'BoardTrigger' && !reinitialize) {
      const val = importCustomGameobject(ctx, TRIGGER_MODEL.board, child);
      val.localPosition = [0, 0, 0];
      val.localRotation = [0, 0, 0, 1];
      val.localScale = [1, 1, 1];
      boat.BoardTriggers.push(val);
    }
    if (name === 'DoorTrigger' && !reinitialize) {
      const val2 = importCustomGameobject(ctx, TRIGGER_MODEL.door, child.parent);
      val2.localPosition = [0, 0, 0];
      val2.localRotation = [0, 0, 0, 1];
      const component = child.parent.getComponent('MeshCollider');
      const component2 = val2.getComponent('BoxCollider');
      const b = colliderBounds(ctx, child.parent, component);
      const c = val2.inverseTransformPoint(b.center);
      component2.m_Center = { x: c[0], y: c[1], z: c[2] };
      component2.m_Size = { x: Math.fround(b.size[0] + 0.01), y: Math.fround(b.size[1] + 0.01), z: Math.fround(b.size[2] + 0.01) };
      boat.BoardTriggers.push(val2);   // the C# adds the door's trigger to BoardTriggers; DoorTriggers stays empty (kept)
    }
    if (boat.BedObject == null && name.includes('BedObject')) {
      boat.BedObject = createDaggerfallMeshGameObject(ctx, BED_MODEL_ID, child);
      boat.BedObject.localPosition = [0, 0, 0];
      boat.BedObject.localRotation = [0, 0, 0, 1];
      if (name.includes('0')) {
        boat.BedObject.getComponent('MeshRenderer').m_Enabled = false;
        const component3 = boat.BedObject.getComponent('MeshCollider');
        component3.m_Convex = true;
        component3.m_IsTrigger = true;
      }
    }
    if (boat.FireObject == null && name === 'FireObject') {
      boat.FireObject = createDaggerfallBillboardGameObject(ctx, FIRE_OBJECT_FLAT[0], FIRE_OBJECT_FLAT[1], child);
      boat.FireObject.localScale = [0.5, 0.5, 0.5];
      boat.FireObject.localPosition = add3([0, 0, 0], scale3(V_UP, Math.fround(boat.FireObject.getComponent('DaggerfallBillboard').Summary.Size[1] / 4)));
      boat.FireObject.getComponent('MeshRenderer').m_Enabled = false;
    }
    if (boat.VariantTrigger == null && name === 'VariantTrigger') {
      boat.VariantTrigger = importCustomGameobject(ctx, TRIGGER_MODEL.variant, child);
      boat.VariantTrigger.localPosition = [0, 0, 0];
      boat.VariantTrigger.localScale = [1, 1, 1];
    }
    if (boat.StatusTrigger == null && name === 'StatusTrigger') {
      boat.StatusTrigger = importCustomGameobject(ctx, TRIGGER_MODEL.status, child);
      boat.StatusTrigger.localPosition = [0, 0, 0];
      boat.StatusTrigger.localScale = [1, 1, 1];
    }
    if (boat.PositionTrigger == null && name === 'PositionTrigger') {
      boat.PositionTrigger = importCustomGameobject(ctx, TRIGGER_MODEL.position, child);
      boat.PositionTrigger.localPosition = [0, 0, 0];
      boat.PositionTrigger.localScale = [1, 1, 1];
    }
    if (boat.DrivePosition == null && name === 'DrivePosition') boat.DrivePosition = child;
    if (boat.RudderObject == null && name === 'RudderObject') {
      boat.RudderObject = child;
      boat.RudderAnimator = child.getComponent('Animator');
      boat.RudderObject.addComponent({ type: 'RudderAnimationEventListener' });
    }
    if (name === 'RudderEffect' && !reinitialize) boat.RudderEmitters.push(child.getComponent('ParticleSystem')?.particleSystem ?? null);
    if (name === 'OarEffect' && !reinitialize) boat.OarParticles.push(child.getComponent('ParticleSystem')?.particleSystem ?? null);
    if (boat.IdleObject == null && name === 'IdleObject') boat.IdleObject = child;
    if (boat.ActiveObject == null && name === 'ActiveObject') boat.ActiveObject = child;
    if (name.includes('Boom')) boat.Booms.push(child);
    if (name.includes('Sail') && !name.includes('Skelly') && !name.includes('Mesh') && !name.includes('Bones') && !name.includes('Handling')) {
      boat.Sails.push(child);
      if (name.includes('Small')) boat.SailsSmall.push(child);
      else if (name.includes('Large')) boat.SailsLarge.push(child);
      if (name.includes('Square')) boat.SailsSquare.push(child);
      else if (name.includes('Lateen')) boat.SailsLateen.push(child);
      else if (name.includes('Gaff')) boat.SailsGaff.push(child);
      else if (name.includes('Stay')) boat.SailsStay.push(child);
    }
    if (child.getComponent('SkinnedMeshRenderer') && child.getComponent('ApplyGameTextures') == null) {
      applyGameTextures(child.addComponent({ type: 'ApplyGameTextures', hasAppliedMaterials: false }), child);
      const val3 = new PrefabNode(NEW_GAME_OBJECT);
      val3.setParentKeepWorld(child);
      val3.localPosition = [0, 0, 0];
      val3.localRotation = [0, 0, 0, 1];
      // AUDIT GN2-RG1/RG9: the renderer's own cadence where its prefab names one (a BakeCadence: the new galleon's,
      // world/galleonRig.js BAKE - her rope every frame, each canvas from its own timer); the mod's carry none: verbatim
      const cadence = child.getComponent('BakeCadence');
      fixDeformationsAwake(val3.addComponent({ type: 'FixDeformations', interval: 0.1, timer: cadence?.timer ?? 0, ...(cadence?.everyFrame ? { everyFrame: true } : {}) }), val3);
    }
    getBoatTransforms(boat, child, ctx, reinitialize);
  }
}

/**
 * ApplyGameTextures.Awake -> ApplyMaterials: slot i of the skinned renderer
 * wears the texture child i's name spells. A name that will not parse, or a
 * child that is not there, is the C#'s exception out of Awake: the slots
 * stay as they were and the component never marks itself applied.
 */
export function applyGameTextures(script, node) {
  const component = node.getComponent('SkinnedMeshRenderer');
  if (!component) return false;
  const shared = component.materials ? [...component.materials] : bundleSlots(component);
  for (let i = 0; i < shared.length; i++) {
    if (node.childCount >= 1) {
      const ch = node.getChild(i);
      const m = ch ? gameTextureFromName(ch.name) : null;
      if (!m) return false;
      shared[i] = m;
    }
  }
  component.materials = shared;
  script.hasAppliedMaterials = true;
  return true;
}

/**
 * FixDeformations.Awake: the parent's skinned renderer switched off, a
 * MeshFilter and a MeshRenderer on this object wearing the skinned
 * renderer's materials, and an empty baked mesh (the first bake is the
 * first LateUpdate after `interval` - CSA-B's skinning, scenes/comeSailAwayPool.js).
 */
export function fixDeformationsAwake(script, node) {
  const skinned = node.parent.getComponent('SkinnedMeshRenderer');
  script.skinnedMeshRenderer = skinned;
  skinned.m_Enabled = false;
  script.meshFilter = node.addComponent({ type: 'MeshFilter', m_Mesh: null, baked: true });
  script.meshRenderer = node.addComponent({ type: 'MeshRenderer', m_Enabled: true, materials: (skinned.materials ?? bundleSlots(skinned)).map((s) => (s ? { ...s } : null)) });
  script.bakedMesh = null;
}

/**
 * What a boat's spawn reads out of the player's ARENA2 - each helper's flat
 * and model, the bed, the fire - so a host can load them first and let
 * SpawnBoat run straight through.
 */
export function boatAssetNeeds(ctx, hull) {
  const flats = new Set(), models = new Set();
  const tree = ctx.models.prefab(FIRST_HULL_MODEL_ID + hull);
  const visit = (n) => {
    try {
      if (n.name.includes('BillboardHelper')) { const f = billboardHelperFields(n.name); flats.add(`${f.archive}_${f.record}`); }
      if (n.name.includes('ModelHelper')) models.add(modelHelperFields(n.name).modelId);
    } catch { /* a name SpawnBoat will throw on needs nothing loaded */ }
    if (n.name.includes('BedObject')) models.add(BED_MODEL_ID);
    if (n.name === 'FireObject') flats.add(`${FIRE_OBJECT_FLAT[0]}_${FIRE_OBJECT_FLAT[1]}`);
    for (const c of n.children) visit(c);
  };
  if (tree) visit(tree);
  return { flats: [...flats].map((k) => k.split('_').map(Number)), models: [...models] };
}
