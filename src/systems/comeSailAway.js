// @ts-check
// CSA-C (2026-09-27): COME SAIL AWAY'S BOATS PLACED, KEPT AND SAVED -
// ComeSailAway.cs's placement (StartPlacing, StopPlacing, the three
// PlaceBoats, the two RepositionBoats, both PlaceBoatAtRayHits, both
// SetBoatPositionAndDirections, GetMapPixelFromTerrain: 6112-6521), the nodes
// and the visibility (UpdateAllBoatsNodes, both UpdateBoatNodes, both
// UpdateBoatVisibility: 3624-3820), the events that keep a placed boat where
// it stands (OnLoad, OnTransition, OnPositionUpdate, OnPositionUpdateBoat:
// 1943-2072), GetTileMapIndexAtPosition (2101), the lookups
// (GetPlacedBoatWithUID 769, GetHitBoatIndex 1890), the placing click in
// Update (4957), four of the five console commands (56-204) and
// ComeSailAwaySaveData whole.
//
// CSA-D (2026-09-27): AND THE HELM - StartSailing, StopSailing and its delayed
// coroutine (5783-5964), Update's sailing arm and LateUpdate's move (4186-5051),
// FixedUpdate's enemies riding a hull (5053-5145), the collision (3479-3622), the
// cargo's weight (3820-3858), the beaching and the turns (723-767, 6031-6069),
// the seven activations (5429-5523) and the events that end a sail (OnStartLoad,
// OnPreFastTravel, OnPlayerDeath, OnNewMagicRound). The sails, the wind and the
// Animators are CSA-E's; the wake, the bob and the current CSA-F's; the time scale's
// keys and the sounds CSA-G's; PackBoat, the cargo window and the ports CSA-H's.
//
// CSA-H (2026-09-27): AND THE ITEMS - PackBoat (6130-6158), the cargo box and
// OpenCargo (5575-5587, 6521-6525), the variant box and its picker (5491-5506,
// 1310-1334), IsNearPort (1095-1117), the two item classes' UseItem
// (ItemBoatParts, ItemBoatDeed: `useBoatParts`, `useBoatDeed`) and GiveMeBoat
// (`giveboat`); the rows, the shelf's AssignVariantsToShopItems and the mint
// are systems/comeSailAwayItems.js's.
//
// CSA-I (2026-09-27): AND THE POSITION READING AND THE WATER WALK - the
// position box (CheckBoatPosition 5525-5541), StartShowBoatPosition and its
// coroutine (5589-5680: the two boxes, the weather's and the hour's
// restrictions, the pause, the keys), the markers (5681-5780) and OnGUI's map
// and debug values (4089-4182: the arithmetic is systems/comeSailAwayMap.js's),
// and LateUpdate's water walk (4963-4982, 5044-5051) with StartWaterwalking and
// EndWaterwalking (5966-6029).
//
// The C# is one MonoBehaviour; this is its placing half as one runtime over
// the host's seams (`deps`, below), in the C#'s order statement for
// statement. What a later slice owns is named where the C# calls it and not
// run here.
//
// THE SCENE A RAY MEETS. Physics.Raycast is the host's (`deps.raycast`):
// the port's world as its colliders stand, the boats' own among them
// (world/prefabColliders.js), each hit named as Unity names its collider's
// object - "DeepWaters_Surface" for Iliac Puddle No More's trigger slab over
// the sea, "DeepWaters_Seafloor" for its carved floor - and carrying the
// Terrain its collider sits on, or null.
//
// A TERRAIN is the host's record of one built map pixel (StreamingWorld's
// terrainArray entry and its DaggerfallTerrain): `mapPixelX`, `mapPixelY`,
// `position` (its transform's, the pixel's corner), `tileMap` (the TileMap's
// `.r` bytes, 128 x 128, row by row along z; null before it is built) and
// `sampleHeight(worldPosition)` (Terrain.SampleHeight: the height over the
// terrain's own y, at the precision Unity's 16-bit heightmap holds it - the
// node law's line is the sea's own height, which only that precision puts the
// flat sea under: FIELD-CSA2, world/terrainSurface.js terrainSampleHeightAt).
// The host hands the same object for the same pixel every time, so `==` on it
// is Unity's.
//
// deps = {
//   pool: { ready(), spawnNow(boat, player) -> boat|null (SpawnBoat), remove(boat) (Object.Destroy) },
//   player() -> { position, rotation }            PlayerObject.transform
//   camera() -> { position, forward }             MainCameraObject.transform
//   currentMapPixel() -> { X, Y }                 PlayerGPS.CurrentMapPixel (a new one each call)
//   isPlayerInside(), blockWaterLevel()           PlayerEnterExit
//   isPlayerInsideDungeon()                       AUDIT KEEP-BOATS D2: a kept dungeon boat stands in a dungeon alone
//   iliacPuddleNoMore() -> bool                   the mod's `IliacPuddleNoMore != null`
//   raycast(origin, direction, maxDistance, { triggers }) -> { distance, point, name, terrain, root, node?, collider? } | null
//   playerTerrain() -> terrain | null             StreamingWorld.PlayerTerrainTransform
//   terrainAt(x, y) -> terrain | null             StreamingWorld.GetTerrainTransform
//   terrains() -> terrain[]                       StreamingWorld.terrainArray (the reflection GetMapPixelFromTerrain reads)
//   worldCompensation() -> [x, y, z]              StreamingWorld.WorldCompensation
//   hudText(text, delay?), midScreenText(text, seconds), log(text)
//   random: { range(min, max) }                   UnityEngine.Random.Range(int, int)
//   time() -> number                              Time.time
//   persistentDungeonBoats() -> bool              the mod's Compatibility/PersistentDungeonBoats
//   packedItems: { serialize(items), deserialize(records) }   ItemCollection.SerializeItems / DeserializeItems
//   CSA-D, the helm:
//   dt() -> number                                Time.deltaTime (zero while paused)
//   setting(key) -> value                         the mod's settings, `Section.Name` (LoadSettings' fields, read live)
//   input: { has(action), started(action), horizontal(), vertical(), toggleAutorun (get/set) }
//                                                 InputManager: HasAction, ActionStarted (the mod's keys are registry
//                                                 actions - BOAT_ACTIONS - their GetKeyDown the same edge), the axes
//   helm: { setPlayerPosition(centre), setFacing(yawDeg, pitchDeg), turnPlayer(deg), freeze(seconds), frozen(),
//           stopRunning(), footsteps(on), alignToGround(distance) }
//                                                 the PlayerObject's transform, PlayerMouseLook.SetFacing (a world yaw),
//                                                 PlayerMotor.FreezeMotor, SpeedChanger.isRunning, PlayerFootsteps
//   transport: { isFoot(), setFoot(), hasHorse(), hasCart() }       TransportManager
//   ship: { owns(), assign('Small'|'None'), removePermanentScene(name) }   DaggerfallBankManager, the StateManager
//   entity: { isFemale(), carriedWeight(), wagonWeight(), decreaseFatigue(n) }   PlayerEntity
//   cargoWeight(items) -> kg                      ItemCollection.GetWeight
//   sphereCastAll(origin, radius, dir, maxDistance) -> [{ point, name, root, terrain, entity }]
//                                                 Physics.SphereCastAll, triggers ignored, the Player layer masked out
//   enemies() -> [{ key, hasController, height, position(), setPosition(centre), turn(deg), grounded() }]
//                                                 ActiveGameObjectDatabase.GetActiveEnemyObjects, each a handle
//   timeScale(), setTimeScale(scale)              Time.timeScale (and fixedDeltaTime, the host's one clock)
//   CSA-G: enemiesNearby() -> bool                GameManager.AreEnemiesNearby(false, false)
//   travelOptionsActive() -> bool | null          Travel Options' isTravelActive message (null: the mod is not loaded)
//   messageBox(text)                              DaggerfallUI.MessageBox
//   CSA-H, the items:
//   isPortTown(x, y) -> bool                      ContentReader.HasLocation(x, y) && GetLocation(...) and its
//                                                 Exterior.ExteriorData.PortTownAndUnknown != 0
//   items: { create(templateIndex) -> item, addToPlayer(item) }
//                                                 ItemBuilder.CreateItem(UselessItems2, index) (the item's UID the
//                                                 host's), PlayerEntity.Items.AddItem(item, AddPosition.Back)
//   closeInventory()                              the top window closed when it is the inventory
//   openCargo(cargo)                              InventoryWindow.LootTarget = cargo; "dfuiOpenInventoryWindow"
//   openListPicker(items, onPick(index))          a DaggerfallListPickerWindow pushed over the top window
//   popWindow()                                   DaggerfallUI.UIManager.PopWindow
//   pool.setVariant(boat, variant)                SetBoatVariant (systems/comeSailAwayBoat.js, the pool's context)
//   audio.uiOneShot(soundIndex)                   DaggerfallUI.Instance.PlayOneShot
//   CSA-E, the wind: weatherType(), hour()        PlayerWeather.WeatherType, WorldTime.Now.Hour
//   CSA-I, the position reading and the water walk:
//   topWindowIsMessageBox() -> bool              `DaggerfallUI.Instance.UserInterfaceManager.TopWindow is DaggerfallMessageBox`
//   gamePaused() -> bool                          GameManager.IsGamePaused
//   map: { open(), close() }                      GameManager.PauseGame(true, true) / PauseGame(false, false): the map's
//                                                 window in the mode's slot - the pause, the HUD hidden, the keys
//   input.keyDown(code), keyUp(code), key(code)   InputManager.GetKeyDown/GetKeyUp/GetKey(KeyCode, true): Unity's
//                                                 KeyCode names (Alpha1-8, Mouse0, Mouse1, Escape, LeftShift)
//   mousePosition() -> [x, y]                     InputManager.MousePosition: screen pixels, y from the bottom
//   screenRect() -> { x, y, width, height }      DaggerfallUI.Instance.CustomScreenRect, else the screen's
//   date() -> { day, month }                      WorldTime.Now (zero based), for a marker's label
//   effects: { isWaterWalking(), bundleNames(), assignBundle(spec), removeBundle(name) } | null
//                                                 GameManager.Instance.PlayerEffectManager (null: none) and
//                                                 PlayerEntity.IsWaterWalking
//   CSA-F, the waves:
//   heightMapValue(x, y) -> byte                  WoodsFileReader.GetHeightMapValue (the live map, clamped at its edges)
//   transport.isOnShip()                          TransportManager.IsOnShip
//   CSA-J, the message receiver:
//   logError(text)                                Debug.LogErrorFormat (a message no arm knows)
//   NAV-H x AUDIT NAV1 (the helm), the sea fight's seams (optional; the mod has no hurt):
//   wayScale(underSail) -> 0..1                   the share of her way her hurts leave (moveSpeed)
//   sailRefused() -> text | null                  why no sail will set (RaiseSails refuses with it)
//   brake() -> m/s^2 | 0                          a heave-to's brake: her way comes off at this, whatever her own rate
//   HELM-WAY (the port's; optional - none handed is the mod to the letter):
//   handling() -> 'responsive' | 'classic'        the Features row's Ship handling (systems/helmWay.js) - taken once a
//                                                 helm, at StartSailing (AUDIT NAV2 F14)
// }

import { Boat, setLights, HULL_NAMES, HULL_PRICES, packedHullWeight, CARGO_CONTAINER_IMAGE, TRIGGER_MODEL, goModelName, meshLocalBounds, colliderBounds, animatorOf, boatAnimators, boatParticleSystems, nodeOf, AUDIO_CLIPS, SAIL_ANIMATION_SPEED } from './comeSailAwayBoat.js';
import { constantCurve, twoConstantsCurve, SPACE } from '../world/unityParticles.js';
import { quatEuler } from '../world/unityAnimator.js';
import { quatLookRotation, quatRotate, quatAngleAxis, quatMultiply, quatSlerp } from '../world/quat.js';
import { transferAll } from './inventory.js';
import { BOAT_PARTS_TEMPLATE, BOAT_DEED_TEMPLATE, mintBoatItem, boatItemName, boatItemMessage, mintDeed } from './comeSailAwayItems.js';   // CSA-H: the two items; SHIP-PACK: a ship's deed given back
import { NO_WATER_LEVEL } from '../world/deepWaterSwim.js';
import { invertAffine } from '../world/prefabColliders.js';
import { buildWaveMesh, stepWaveFrame, waveFrameTimeOf, isDayHour, WAVE_FRAME_COUNT, WAVE_SCALE } from './comeSailAwayWaves.js';
import { monthNames } from './gameDate.js';   // CSA-I: WorldTime.Now.MonthName, a marker's label (L10N3d: in the player's language, as DFU's GetMonthName reads it)
import { HELM_WAY, CARGO_HOLD_MISSING, steerage, isResponsive } from './helmWay.js';   // HELM-WAY: the responsive helm
import { MAP_MARKER_MODE_COLORS, mapRect, guiMouse, mapPixelUnder, guiRectContains, vector2IntDistance, markerLabel, dayOfMonthWithSuffix, mapOverlayDraws, csFloatString, COLOR_RED, COLOR_GREEN, COLOR_BLUE, COLOR_BLACK, DAGGERFALL_DEFAULT_SHADOW_POS } from './comeSailAwayMap.js';   // CSA-I: the position reading

export const COME_SAIL_AWAY_VENDOR = 'come-sail-away';
/**
 * CSA-J: Start's lookups of the two mods the port does not carry (1007-1008) - World of Daggerfall's TERRAIN,
 * GetModFromGUID("a9091dd7-e07a-4171-b16d-d13d67a5f221") (not the port's World of Daggerfall, the locations mod,
 * 98f05888), and GetMod("Animated Water"). Both are null here, so every arm on them takes its null branch: the water
 * level 34 and a coast pixel no higher than 2 (comeSailAwayWaves.js), the mod's own waves, current, particles and
 * bob, Animated Water's getWaveHeights never sent, Compatibility/AnimatedWaterVertexWaves inert. Iliac Puddle No More
 * and Travel Options are in the port, asked of the host (deps.iliacPuddleNoMore, deps.travelOptionsActive).
 * @type {null | { Title: string }}
 */
export const WOD_TERRAIN = null;
/** @type {null | { Title: string }} */
export const ANIMATED_WATER = null;
/** ComeSailAway.WaterLevel (514-524): `WODTerrain != null ? 100 : 34`. */
export const WATER_LEVEL = WOD_TERRAIN != null ? 100 : 34;
/** ComeSailAway.terrainEdge. */
export const TERRAIN_EDGE = Math.fround(819.2);
/** FIELD BUGS 29h (LOST-BOAT): metres of ground over a hull's place, or of sea over it, before the port calls it lost -
 *  more than a keel on a shelving beach or a hull riding a swell. */
export const LOST_UNDER_M = 2;
/** The placement ray's reach, and the dungeon water plane's. */
export const PLACE_RAY_DISTANCE = 100;
/** Update's `Time.time - placeTime > 0.2f`: the click that asked to place is not the click that places. */
export const PLACE_CLICK_DELAY = Math.fround(0.2);
/** PlayerEnterExit.blockWaterLevel with no water (NoWaterSentinel: deepWaterSwim.js's one home). */
export { NO_WATER_LEVEL };
/** ItemBoatParts' and ItemBoatDeed's rows (CSA-H: systems/comeSailAwayItems.js is their one home). */
export { BOAT_PARTS_TEMPLATE, BOAT_DEED_TEMPLATE };
/** The console's words (ComeSailAway's nested command classes). */
export const CONSOLE = Object.freeze({
  giveboat: Object.freeze({ name: 'giveboat', description: "Add a boat deed to the player's inventory", usage: 'giveboat [hull] [variant]; No argument will result in random hull and variant.' }),   // CSA-H: GiveMeBoat, registered first (1081)
  placeboat: Object.freeze({ name: 'placeboat', description: 'place a boat where the player is looking', usage: 'placeboat [hull] [variant]; No argument will result in random hull and variant. WARNING: only hull 0 is available now and variants only go from 0-6' }),
  printboats: Object.freeze({ name: 'printboats', description: 'lists all placed boats', usage: '' }),
  identifyboat: Object.freeze({ name: 'identifyboat', description: 'Get the index of the boat under the crosshair', usage: 'use command while looking at a boat' }),
  purgeboat: Object.freeze({ name: 'purgeboat', description: 'Destroys the boat at the provided index', usage: 'purgeboat [index]' }),
});

const f = Math.fround;
const V_UP = [0, 1, 0];
const V_FORWARD = [0, 0, 1];
const V_BACK = [0, 0, -1];
const V_RIGHT = [1, 0, 0];

/** Convert.ToInt32(string): null is 0; whitespace and a sign allowed round the digits; anything else a FormatException. */
export function convertToInt32(s) {
  if (s == null) return 0;
  if (!/^\s*[+-]?\d+\s*$/.test(String(s))) throw new TypeError(`FormatException: Input string was not in a correct format. ("${s}")`);
  const v = Number.parseInt(String(s).trim(), 10);
  if (v > 2147483647 || v < -2147483648) throw new RangeError(`OverflowException: Value was either too large or too small for an Int32. ("${s}")`);
  return v;
}

/**
 * Plane.Raycast for the plane through (0, h, 0) facing up (`new Plane(Vector3.up, new Vector3(0, h, 0))`): the
 * distance along the ray, or null where Unity answers false (parallel - Mathf.Approximately(vdot, 0) - or behind).
 */
export function upPlaneRaycast(origin, direction, h) {
  const vdot = f(direction[1]);
  const ndot = f(f(-f(origin[1])) - f(-f(h)));   // -Dot(origin, up) - distance, distance = -Dot(up, point)
  if (Math.abs(vdot) < 8 * 1.401298e-45) return null;
  const enter = f(ndot / vdot);
  return enter > 0 ? enter : null;
}

/** `ray.origin + ray.direction * t`, in Unity's floats. */
const alongRay = (o, d, t) => [f(f(o[0]) + f(f(d[0]) * f(t))), f(f(o[1]) + f(f(d[1]) * f(t))), f(f(o[2]) + f(f(d[2]) * f(t)))];

/** GetHullFromMessage / GetVariantFromMessage: the item's `message` is hull * 10 + variant. */
export const hullFromMessage = (message) => Math.trunc(message / 10) % 10;
export const variantFromMessage = (message) => message % 10;

/**
 * GetTileMapIndexAtPosition (2101-2120): the tile under a world position on a terrain - its TileMap's `.r / 4`,
 * the position's offset from the terrain's corner in Unity's floats, each axis's 128th truncated and clamped.
 * -1 for a terrain with no DaggerfallTerrain or no TileMap.
 */
export function tileMapIndexAtPosition(position, terrain) {
  const map = terrain.tileMap;   // a null terrain throws, as `terrainTransform.GetComponent` does
  if (map == null || map.length === 0) return -1;
  const tp = terrain.position;
  const vx = f(f(position[0]) - f(tp[0])), vz = f(f(position[2]) - f(tp[2]));
  const num2 = f(vx / TERRAIN_EDGE), num3 = f(vz / TERRAIN_EDGE);
  const num4 = Math.min(127, Math.max(0, Math.trunc(f(128 * num2))));
  const num5 = Math.min(127, Math.max(0, Math.trunc(f(128 * num3))));
  return map[num5 * 128 + num4] >> 2;
}

// ── CSA-D: the helm's numbers and Unity's vector arithmetic ────────────────────

/** The seven activations Start registers (1015-1021), each at 3.2 (RegisterCustomActivation's distance). */
export const ACTIVATION_DISTANCE = f(3.2);
export const ACTIVATIONS = Object.freeze({
  [TRIGGER_MODEL.drive]: 'ActivateRudder', [TRIGGER_MODEL.board]: 'BoardBoat', [TRIGGER_MODEL.cargo]: 'OpenBoatCargo',
  [TRIGGER_MODEL.door]: 'TriggerDoor', [TRIGGER_MODEL.variant]: 'PickVariant', [TRIGGER_MODEL.status]: 'CheckBoatStatus',
  [TRIGGER_MODEL.position]: 'CheckBoatPosition',
});
/**
 * PlayerActivate's lookup (PlayerActivate.cs:428-435): the hit object's name cut after its first ']' (`GetGoModelName`'s
 * form), the one of `ids` registered under it, or null.
 */
export function customModelOf(name, ids) {
  let n = String(name ?? '');
  const pos = n.indexOf(']');
  if (pos > 0 && pos < n.length - 1) n = n.slice(0, pos + 1);
  for (const id of ids) if (goModelName(Number(id)) === n) return Number(id);
  return null;
}
/** The seven boxes' lookup: this mod's registrations. */
export const activationModelOf = (name) => customModelOf(name, Object.keys(ACTIVATIONS));
/** BoardBoat's place (5429-5448): the sibling before the board trigger - its world position and the heading of its
 *  forward, in degrees (SetHorizontalFacing(child.forward)). CSA-K: another player's boat is boarded at the same one. */
export function boardPlaceOf(triggerNode) {
  const parent = triggerNode.parent;
  const child = parent.getChild(parent.children.indexOf(triggerNode) - 1);
  return { position: child.position, yaw: yawOfForward(quatRotate(child.rotation, [0, 0, 1])) };
}
/** CheckBoatStatus's box (5508-5523) - CSA-K: another player's boat's status box says it too. */
export const NICE_BOAT_TEXT = 'Nice Boat!';
/** CSA-K (DECLARED): the pack's refusal while another player stands on the deck, in the driver's words' shape. */
export const PASSENGERS_ABOARD_TEXT = 'You cannot pack a boat with passengers aboard!';
/** SHIP-PACK (the port's own): the pack's refusal of a deed ship whose deed is not in the pack - her parts take its place,
 *  and a deed left elsewhere would call a second ship of hers to a port. */
export const DEED_NOT_HELD_TEXT = 'Her deed must be in your pack to pick her up.';
/** The mod's two helm keys this slice reads, as the port's registry actions (KB1: one key, one action). */
export const BOAT_ACTIONS = Object.freeze({
  disembark: 'BoatDisembark', toggleLight: 'BoatToggleLight',
  // CSA-E: the sails' and the trim's (Controls.ToggleSail, TrimRight, TrimLeft, TrimModifier)
  toggleSail: 'BoatToggleSail', trimRight: 'BoatTrimRight', trimLeft: 'BoatTrimLeft', trimModifier: 'BoatTrimModifier',
  // CSA-G: the time scale's three (Controls.IncreaseTimeScale, DecreaseTimeScale, ResetTimeScale)
  timeScaleUp: 'BoatTimeScaleUp', timeScaleDown: 'BoatTimeScaleDown', timeScaleReset: 'BoatTimeScaleReset',
  // HELM-KEYS (the port's, DECLARED): the arrows' more and less sail (MoreSail, LessSail)
  sailUp: 'BoatSailUp', sailDown: 'BoatSailDown',
});
/** FIELD BUGS 2026-10-02b PLACE-AFLOAT: the placing's word for a water tile that stands over the sea's line. */
export const PLACE_RAISED_TEXT = 'This water stands above the sea - place her on the open water.';
/** HELM-KEYS (the port's, DECLARED): a helm IN IRONS - her sails up, her bow within IRONS_TELL_DEG of the wind's eye and
 *  her way under IRONS_TELL_WAY m/s for IRONS_TELL_S running: the sails cannot draw and the mod's rudder cannot turn a
 *  hull that makes no way, so the helm is told once how she comes out (IRONS_TEXT) - and the panel says it while it lasts
 *  (helmPanelState). The dwell: a sail just raised, or a tack through the wind's eye, is not lying in irons. AUDIT NAV2
 *  F18: the responsive helm's rudder answers at rest (HELM-WAY's steerage) - a Small Ship's helm alone brings her
 *  IRONS_TELL_DEG off the eye in some ten seconds - so it is told to put the helm over first (IRONS_HELM_TEXT). */
export const IRONS_TELL_DEG = 40;
export const IRONS_TELL_WAY = 0.4;
export const IRONS_TELL_S = 2;
export const IRONS_TEXT = 'In irons - the wind is dead ahead. Strike sail and row her round.';
export const IRONS_HELM_TEXT = 'In irons - the wind is dead ahead. Put the helm over, or strike sail and row her round.';
/** The C#'s field initializers (262-276): the oars' and the sails' speeds, accelerations and turns. */
export const HANDLING = Object.freeze({
  moveSpeedOar: 2, moveSpeedSail: 2, moveAccelOar: 1, moveAccelSail: f(0.2),
  turnSpeedOar: 20, turnSpeedSail: 10, turnAccelOar: 10, turnAccelSail: 5,
});
/** `oarModeTime` and the fatigue a crewless boat's oars cost every time it runs out (4414-4424). */
export const OAR_MODE_TIME = 1;
export const OAR_FATIGUE = 11;
/** UpdateBoatCargoMod's weights (3825-3844): the player (Gender 1, female, 120; else 175), a horse 800, a cart 400. */
export const CARGO_WEIGHTS = Object.freeze({ female: 120, male: 175, horse: 800, cart: 400 });
/** StopSailing's two scene names: the LARGE ship's exterior (5, 5) and an interior keyed 16777216 - not the scenes
 *  AssignShipToPlayer(Small) made permanent (2, 2 and 1050578 / 0). Kept bug for bug. */
export const TEMPORARY_SHIP_SCENES = Object.freeze(['DaggerfallWorld [mapX=5, mapY=5]', 'DaggerfallInterior [MapID=2102157, BuildingKey=16777216]']);

const K_EPSILON = f(1e-5);
const K_EPSILON_SQ = f(K_EPSILON * K_EPSILON);
const vAdd = (a, b) => [f(f(a[0]) + f(b[0])), f(f(a[1]) + f(b[1])), f(f(a[2]) + f(b[2]))];
const vSub = (a, b) => [f(f(a[0]) - f(b[0])), f(f(a[1]) - f(b[1])), f(f(a[2]) - f(b[2]))];
const vScale = (a, s) => [f(f(a[0]) * f(s)), f(f(a[1]) * f(s)), f(f(a[2]) * f(s))];
const vDot = (a, b) => f(f(f(f(a[0]) * f(b[0])) + f(f(a[1]) * f(b[1]))) + f(f(a[2]) * f(b[2])));
const vSqrMagnitude = (a) => vDot(a, a);
const vMagnitude = (a) => f(Math.sqrt(vSqrMagnitude(a)));
/** Vector3.normalized: zero under kEpsilon. */
export function vNormalized(a) {
  const m = vMagnitude(a);
  return m > K_EPSILON ? [f(f(a[0]) / m), f(f(a[1]) / m), f(f(a[2]) / m)] : [0, 0, 0];
}
/** Vector3's `==`: the squared distance under kEpsilon squared (false with a NaN in it). */
export const vEquals = (a, b) => vSqrMagnitude(vSub(a, b)) < K_EPSILON_SQ;
/** Vector3.ProjectOnPlane (Unity 2019.4): the vector itself for a normal under Mathf.Epsilon. */
export function vProjectOnPlane(v, n) {
  const sqrMag = vDot(n, n);
  if (sqrMag < 1.401298e-45) return [f(v[0]), f(v[1]), f(v[2])];
  const d = vDot(v, n);
  return [0, 1, 2].map((i) => f(f(v[i]) - f(f(f(n[i]) * d) / sqrMag)));
}
/** Vector3.MoveTowards / Vector2.MoveTowards, any length. */
export function vMoveTowards(current, target, maxDistanceDelta) {
  const to = current.map((c, i) => f(f(target[i]) - f(c)));
  let sqdist = 0;
  for (const t of to) sqdist = f(sqdist + f(t * t));
  const md = f(maxDistanceDelta);
  if (sqdist === 0 || (md >= 0 && sqdist <= f(md * md))) return target.map((t) => f(t));
  const dist = f(Math.sqrt(sqdist));
  return current.map((c, i) => f(f(c) + f(f(to[i] / dist) * md)));
}
/** Mathf.MoveTowards. */
export function mathfMoveTowards(current, target, maxDelta) {
  const d = f(f(target) - f(current));
  if (Math.abs(d) <= f(maxDelta)) return f(target);
  return f(f(current) + f((d >= 0 ? 1 : -1) * f(maxDelta)));
}
/** Mathf.Clamp: a NaN passes through, as Unity's two comparisons let it. */
export function mathfClamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
/** Mathf.Lerp (t clamped to [0, 1]) and Mathf.LerpUnclamped. */
export const mathfLerp = (a, b, t) => f(f(a) + f(f(f(b) - f(a)) * mathfClamp(f(t), 0, 1)));
export const mathfLerpUnclamped = (a, b, t) => f(f(a) + f(f(f(b) - f(a)) * f(t)));
const vCross = (a, b) => [
  f(f(f(a[1]) * f(b[2])) - f(f(a[2]) * f(b[1]))), f(f(f(a[2]) * f(b[0])) - f(f(a[0]) * f(b[2]))), f(f(f(a[0]) * f(b[1])) - f(f(a[1]) * f(b[0]))),
];
const RAD2DEG = f(57.29578);
/** Vector3.Angle (2019.4): the degrees between two vectors, nought when the product of their squared lengths is
 *  under kEpsilonNormalSqrt (1e-15). */
export function vAngle(from, to) {
  const num = f(Math.sqrt(f(vSqrMagnitude(from) * vSqrMagnitude(to))));
  if (num < 1e-15) return 0;
  const num2 = mathfClamp(f(vDot(from, to) / num), -1, 1);
  return f(f(Math.acos(num2)) * RAD2DEG);
}
/** Vector3.SignedAngle: Angle, signed by which side of the axis from x to lies (Mathf.Sign: nought is +1). */
export function vSignedAngle(from, to, axis) {
  const num = vAngle(from, to);
  const c = vCross(from, to);
  const s = f(f(f(f(axis[0]) * c[0]) + f(f(axis[1]) * c[1])) + f(f(axis[2]) * c[2]));
  return f(num * (s >= 0 ? 1 : -1));
}
/** Vector3.RotateTowards (the engine's own): the direction turned by at most maxRadiansDelta and the length moved
 *  by at most maxMagnitudeDelta; a vector under kEpsilon (or one already along the other) MoveTowards instead, and
 *  two opposite ones turn about OrthoNormalVectorFast's axis. */
export function vRotateTowards(current, target, maxRadiansDelta, maxMagnitudeDelta) {
  const num = vMagnitude(current), num2 = vMagnitude(target);
  if (num > K_EPSILON && num2 > K_EPSILON) {
    const from = vScale(current, f(1 / num)), to = vScale(target, f(1 / num2));
    const num3 = vDot(from, to);
    if (num3 > f(1 - K_EPSILON)) return vMoveTowards(current, target, maxMagnitudeDelta);
    const turned = (axis, radians) => vScale(quatRotate(quatAngleAxis(f(f(radians) * RAD2DEG), axis), from).map(f), clampedMove(num, num2, maxMagnitudeDelta));
    if (num3 < f(-1 + K_EPSILON)) return turned(orthoNormalVectorFast(from), maxRadiansDelta);
    return turned(vNormalized(vCross(from, to)), Math.min(f(maxRadiansDelta), f(Math.acos(num3))));
  }
  return vMoveTowards(current, target, maxMagnitudeDelta);
}
/** The engine's ClampedMove: a length moved toward another by at most the delta. */
function clampedMove(lhs, rhs, clampedDelta) {
  const delta = f(rhs - lhs);
  return delta > 0 ? f(lhs + Math.min(delta, f(clampedDelta))) : f(lhs - Math.min(f(-delta), f(clampedDelta)));
}
/** The engine's OrthoNormalVectorFast: a unit normal of n, in the y-z plane when n leans on z, else in x-y. */
function orthoNormalVectorFast(n) {
  if (Math.abs(n[2]) > f(Math.SQRT1_2)) {
    const k = f(1 / f(Math.sqrt(f(f(n[1] * n[1]) + f(n[2] * n[2])))));
    return [0, f(-n[2] * k), f(n[1] * k)];
  }
  const k = f(1 / f(Math.sqrt(f(f(n[0] * n[0]) + f(n[1] * n[1])))));
  return [f(-n[1] * k), f(n[0] * k), 0];
}
/** Quaternion.Angle (2019.4): nought when the dot is past 1 - 1e-6, else twice the arc in degrees. */
export function quatAngleUnity(a, b) {
  const dot = f(f(f(f(a[0] * b[0]) + f(a[1] * b[1])) + f(a[2] * b[2])) + f(a[3] * b[3]));
  return dot > f(1 - 0.000001) ? 0 : f(f(f(Math.acos(Math.min(Math.abs(dot), 1))) * 2) * RAD2DEG);
}
/** Quaternion.RotateTowards: from turned toward to by at most maxDegreesDelta (SlerpUnclamped by the share). */
export function quatRotateTowards(from, to, maxDegreesDelta) {
  const num = quatAngleUnity(from, to);
  if (num === 0) return [...to];
  return quatSlerp(from, to, Math.min(1, f(maxDegreesDelta / num)));
}
const conj = (q) => [-q[0], -q[1], -q[2], q[3]];
/** Transform.InverseTransformDirection on a root (its rotation alone). */
const inverseTransformDirection = (node, v) => quatRotate(conj(node.rotation), v).map(f);
/** A Transform position write: Unity refuses a vector that is not finite, logging it. */
function setPositionChecked(node, p, log) {
  if (!p.every(Number.isFinite)) { log?.(`transform.position assign attempt for '${node.name}' is not valid. Input position is { ${p.join(', ')} }.`); return false; }
  node.position = p;
  return true;
}
/** A Transform rotation write, refused as Unity refuses it. */
function setLocalRotationChecked(node, q, log) {
  if (!q.every(Number.isFinite)) { log?.(`transform.localRotation assign attempt for '${node.name}' is not valid. Input rotation is { ${q.join(', ')} }.`); return false; }
  node.localRotation = q;
  return true;
}
/** Quaternion.LookRotation(forward).eulerAngles.y, the yaw SetHorizontalFacing keeps, in degrees [0, 360). */
export function yawOfForward(v) {
  const d = (Math.atan2(v[0], v[2]) * 180) / Math.PI;
  return d < 0 ? d + 360 : d;
}
/** The wind widget (338-354, 578-580): the interval ladder and the index the mod ships and never reads a setting
 *  for (7: fifteen degrees, so 24 frames - the 24 pictures 112395_1-0..23 it imports at Start, 1065-1076); a
 *  classic 320x200 for its two scaling modes. */
export const WIND_WIDGET = Object.freeze({ intervals: Object.freeze([1, 2, 3, 5, 6, 9, 10, 15, 18, 30, 45, 90]), intervalIndex: 7, nativeWidth: 320, nativeHeight: 200 });
export const windWidgetInterval = () => WIND_WIDGET.intervals[WIND_WIDGET.intervalIndex];
export const windWidgetFrameCount = () => 360 / windWidgetInterval();
/** DaggerfallWorkshop.Game.Weather.WeatherType - the numbers UpdateWind compares (3, 4 and 5). */
export const WEATHER_TYPE = Object.freeze({ Sunny: 0, Cloudy: 1, Overcast: 2, Fog: 3, Rain: 4, Thunder: 5, Snow: 6 });
/** currentTimeScale (382): the helm's five steps (CSA-G's keys walk them). */
export const TIME_SCALES = Object.freeze([1, 5, 10, 15, 30]);
/** A point through a column-major matrix, and back through its inverse. */
const applyMatrix = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];
const applyInverse = (m, p) => applyMatrix(invertAffine(m), p);
/** A child's point carried by its root's move: its local offset under `before` kept under `after` (SetParent's law -
 *  the helm's player and a rider here; CSA-K: a passenger on another player's deck, scenes/comeSailAwayAboard.js). */
export const carriedPoint = (before, after, p) => applyMatrix(after, applyInverse(before, p));
/** The turn about up between two poses of one root, in degrees (-180, 180]. */
export function yawDelta(before, after) {
  let d = (Math.atan2(after[8], after[10]) - Math.atan2(before[8], before[10])) * 180 / Math.PI;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}
const normalizeQ = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };

const v3 = (o) => (o ? { x: f(o[0]), y: f(o[1]), z: f(o[2]) } : { x: 0, y: 0, z: 0 });
const arr3 = (o) => [f(o?.x ?? 0), f(o?.y ?? 0), f(o?.z ?? 0)];

/**
 * AUDIT REALM2 C3: THE MOD OFF, ITS RECORD CARRIED - IHasModSaveData's three members over the record a load handed, so
 * every save writes it back whole: the boats, their holds and the packed cargoes wait for the mod to come on again, as
 * HCC's, Warm Ashes' and Raiding Parties' records ride whatever their switch says. Online the switch is the player's
 * (systems/onlineLane.js) and a realm character has ONE record: an off boot's first checkpoint dropped them for good.
 * M3: no helm stands with the mod off - a record taken at one lets it go, and the Small ship a crewed helm lent
 * (TemporaryShip) is taken back as it loads, ReturnTemporaryShip's own steps over the host's `ship`: kept, a bank bought
 * it for 85,000, and the helm lent it again at the next boot with the mod on.
 * @param {{ ship?: { assign?: (type: string) => void, removePermanentScene?: (name: string) => void } }} deps
 */
export function comeSailAwayCarrier(deps) {
  /** @type {any} */
  let carried;
  return {
    newSaveData: () => undefined,
    getSaveData: () => carried,
    restoreSaveData(/** @type {any} */ rec) {
      carried = rec ?? undefined;
      if (carried?.TemporaryShip) {
        for (const name of TEMPORARY_SHIP_SCENES) deps.ship?.removePermanentScene?.(name);
        deps.ship?.assign?.('None');
      }
      if (carried?.TemporaryShip || carried?.currentBoat >= 0) carried = { ...carried, currentBoat: -1, TemporaryShip: false };
    },
  };
}

/**
 * @param {any} deps - see the file's head
 */
export function createComeSailAwayRuntime(deps) {
  const random = deps.random ?? { range: (min, max) => min + Math.floor(Math.random() * (max - min)) };
  /** Random.Range(float, float): both ends inclusive. */
  const rangeFloat = (min, max) => (random.rangeFloat ? random.rangeFloat(min, max) : min + Math.random() * (max - min));
  const log = (s) => deps.log?.(s);

  const state = {
    /** @type {Boat[]} */ AllBoats: [],
    /** @type {Boat|null} */ CurrentBoat: null,   // CSA-D's
    disembarking: null,
    placing: false,
    placeTime: 0,
    /** @type {any} */ placeItem: null,
    /** @type {any[]|(() => any[])|null} */ placeItemCollection: null,   // AUDIT PRE-MERGE 0928 S2: the host's live list, or a container's own (removeItem)
    /** @type {Map<any, any[]>} */ PackedCargoes: new Map(),
    /** @type {{ position:number[], label:string, color:any }[]} */ mapMarkers: [],
    TemporaryShip: false,
    sailPosition: 0,
    MoveVectorCurrent: [0, 0, 0],
    MoveVectorTarget: [0, 0, 0],
    windVectorTarget: [0, 0, 1],
    windVectorCurrent: [0, 0, 1],
    currentVectorPrevious: [0, 0, 0],
    wasPaused: false,
    // CSA-D: the helm (the C#'s fields, 300-316, 378, 388, 446, 452 and their initializers)
    TurnTarget: 0,
    TurnCurrent: 0,
    velocityTarget: [0, 0, 0],
    velocityCurrent: [0, 0, 0],
    CollisionVector: [0, 0, 0],
    /** @type {number[][]} */ collisionDirections: [],
    lastBoatPosition: [0, 0, 0],
    lastBoatDirection: [0, 0, 0],
    inputCurrent: [0, 0],
    oarModeTimer: 0,
    boatCargoMod: 1,
    lastWeight: 0,
    /** FixedUpdate's current (CSA-F): written only while the waves are on. */
    currentVector: [0, 0, 0],
    // CSA-F: the waves (230-258) - the object UpdateWaveMesh moves and the mesh it carries (null once cleared), the
    // frame the material wears and its timer, and the neighbours the current reads (null until a mesh is first laid)
    waveObject: { position: [f(409.6), f(34.1), f(409.6)], scale: WAVE_SCALE, /** @type {any} */ mesh: null },
    waveFrameIndex: 0,
    waveFrameTimer: 0,
    /** @type {boolean[][] | null} */ currentNeighbors: null,
    /** variantBoatTarget (216): the boat whose variant picker is open (CSA-H). */
    /** @type {Boat|null} */ variantBoatTarget: null,
    /** timeScaleIndex (380): the step of currentTimeScale the helm's time keys stand at (CSA-G). */
    timeScaleIndex: 0,
    // CSA-G: Travel Options' answer to isTravelActive, asked every LateUpdate (438-442), and its latch (read nowhere)
    isTravelling: false,
    wasTravelling: false,
    // CSA-E: the manual trim's two angles (318-320)
    trimAngle: 0,
    trimAngleSquare: 0,
    // HELM-KEYS (the port's): the seconds she has lain in irons, and the word said for this spell of them
    ironsFor: 0,
    ironsTold: false,
    /** windDirectionWidgetTextureCurrent (1076): the frame the widget draws, its textures' index. */
    windWidgetFrame: 0,
    /** @type {Map<any, { enemy:any, boat:Boat }>} FixedUpdate's parentedObjects: each enemy riding a hull, by the host's key. */
    parentedObjects: new Map(),
    // CSA-I: the position reading (468-480) - the map up, a reading got, the coroutine running, the marker colour
    mapShowing: false,
    mapShowingPosition: false,
    /** @type {any} */ showingBoatPosition: null,
    mapMarkerMode: 0,
  };
  /** The player's transform parent: the boat StartSailing parented them to, until the un-parenting. */
  let playerParent = null;
  /** The C#'s events another mod listens on through MessageReceiver (CSA-J) - Eye of the Beholder's OnUpdateSailing. */
  const events = { OnUpdateSailing: [], OnUpdateWind: [], OnUpdateCurrent: [] };
  const raise = (name, v) => { for (const fn of events[name]) fn(Array.isArray(v) ? [...v] : v); };   // a Vector3 is each delegate's own copy
  /** Coroutines waiting on WaitForEndOfFrame, resumed by endOfFrame(): each a step that answers true to wait again. */
  /** @type {(() => boolean)[]} */
  let endOfFrameQueue = [];
  /** CSA-F: coroutines waiting on WaitForSeconds - each resumes the first Update whose Time.time reaches its hour. */
  /** @type {{ at:number, step:() => void }[]} */
  let delayedCalls = [];
  /** A save's record held while the mod's models load (declared: SpawnBoat is synchronous in the C#). */
  let pendingRestore = null;

  // Start (1087-1090): the first wind, 15 x Random.Range(-12, 12) degrees about up off forward
  {
    const num = 15 * random.range(-12, 12);
    const v = quatRotate(quatAngleAxis(num, V_UP), V_FORWARD);
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    state.windVectorTarget = [v[0] / l, v[1] / l, v[2] / l];
    state.windVectorCurrent = [...state.windVectorTarget];
  }

  const isSailing = () => state.CurrentBoat != null && state.disembarking == null;
  /** Boat.RudderAnimator's runtime (the component the walk found), or null. */
  const rudderOf = (boat) => boat?.RudderAnimator?.animator ?? null;
  const playerRight = () => quatRotate(deps.player().rotation, [1, 0, 0]);
  const sameTerrain = (a, b) => a === b;
  /** FIELD-CSA1 (the port's own): the sea's top in the scene - the mod's WaterLevel (Deep Waters' sea, 34 m over its
   *  pixel) under the world's vertical compensation, which the port's floating origin keeps as DFU's does (a recentre
   *  past 500 m). The C# reads WaterLevel bare: the sea only while the compensation is nought. */
  const seaTop = () => f(WATER_LEVEL + f(deps.worldCompensation?.()?.[1] ?? 0));
  /**
   * FIELD-CSA1 (the port's own - Julian: "first attempt just didn't spawn in the boat and the deed disappeared. i could
   * hear ocean boat sounds"): WHERE A "DeepWaters" HIT FLOATS THE BOAT. The arm takes any collider of the carved sea,
   * and its floor is one (the host's "DeepWaters_Seafloor"): an eye at or under the surface - a swimmer's - starts inside
   * the surface's box, which a ray never meets from inside, and with Spawn Water Surfaces off there is none to meet, so
   * the ray went on to the seabed and the boat was stood there, the deed spent, its loop heard at half volume (the
   * rolloff stops at its max distance). A hit under the sea's top floats the boat on the water over it: where the look
   * crosses the sea, else straight above the floor it met. The surface's own hit stands as the C# places it.
   */
  function afloatAt(hit, origin, direction) {
    const top = seaTop();
    if (!(hit.point[1] < top)) return [...hit.point];
    const t = upPlaneRaycast(origin, direction, top);
    return t != null && t <= hit.distance ? alongRay(origin, direction, t) : [hit.point[0], top, hit.point[2]];
  }

  // ── CSA-D: sailing (515-769, 3479-3624, 3820-3860, 4186-5202, 5429-5590, 5783-6071) ──────────────────────
  //
  // THE SETTINGS are read where the C# reads its fields, live: LoadSettings copies them on a change, so a read
  // at the use is the same number (`deps.setting(key)`, the mod's own `Section.Name`).
  const setting = (key, fallback) => { const v = deps.setting?.(key); return v === undefined || v === null ? fallback : v; };
  const handlingMod = (key) => f(Number(setting(`Handling.${key}`, 1)));
  const has = (action) => !!deps.input?.has(action);   // InputManager.HasAction
  const dt = () => f(deps.dt?.() ?? 0);                 // Time.deltaTime
  const cur = () => state.CurrentBoat;

  /** moveSpeed (525-536). NAV-H x AUDIT NAV1 (the helm): times the sea fight's share of her way (`deps.wayScale`, the
   *  port's seam - the mod has no hurt): the canvas a shot-up rig still sets under sail, a wreck's oars under oars. */
  function moveSpeed() {
    const b = cur();
    const hurt = f(Math.max(0, Math.min(1, Number(deps.wayScale?.(state.sailPosition !== 0) ?? 1))));
    if (state.sailPosition === 0) return f(f(f(f(HANDLING.moveSpeedOar * handlingMod('OarMoveSpeed')) * state.boatCargoMod) * f(b.modifierMoveSpeedOar)) * hurt);
    return f(f(f(f(HANDLING.moveSpeedSail * handlingMod('SailMoveSpeed')) * state.boatCargoMod) * f(b.modifierMoveSpeedSail)) * hurt);
  }
  /** HELM-WAY: the responsive helm is the host's to hand (`deps.handling`); none handed is the mod to the letter. */
  const handed = () => !!deps.handling && isResponsive(deps.handling());
  // AUDIT NAV2 F14: the hand is taken ONCE A HELM SESSION - at StartSailing, let go when she stops sailing (off a helm it
  // is read as it stands) - so a change takes the next helm. Read live, a Carrack under way when it turned Classic
  // weighed the mod's hold of 0 at the next magic round (UpdateBoatCargoMod), every rate times it: her way and her swing
  // kept for good, no sail, oar or rudder to take them off.
  let helmHanded = null;
  const responsive = () => helmHanded ?? handed();
  /** moveAccel: the rate below - or, while the sea fight brakes her (AUDIT NAV1, the helm: a heave-to), its own
   *  `brake` (m/s^2, the port's seam; the mod has none), whatever her own rate: a heave-to's brake is the sea fight's
   *  number, not a multiple of a rate the Ship handling choice moves. */
  function moveAccel() {
    const brake = Number(deps.brake?.() ?? 0);
    return brake > 0 ? f(Math.min(20, brake)) : moveAccelOwn();
  }
  /** moveAccel (538-551): the oars' only while a key pulls them; with none held the sails' - a coast (kept). HELM-WAY:
   *  under the responsive helm the sails' way comes on at HELM_WAY.sailAccel of it and a coast at HELM_WAY.coast. */
  function moveAccelOwn() {
    const b = cur();
    if (state.sailPosition === 0 && (has('MoveForwards') || has('MoveBackwards') || (has('Run') && (has('MoveRight') || has('MoveLeft'))))) {
      return f(f(f(HANDLING.moveAccelOar * handlingMod('OarMoveAcceleration')) * state.boatCargoMod) * f(b.modifierMoveAccelerationOar));
    }
    if (state.sailPosition === 1) {
      return f(f(f(f(f(HANDLING.moveAccelSail * handlingMod('SailMoveAcceleration')) * vMagnitude(state.windVectorCurrent)) * state.boatCargoMod) * f(b.modifierMoveAccelerationSail)) * (responsive() ? HELM_WAY.sailAccel : 1));
    }
    return f(f(f(f(HANDLING.moveAccelSail * handlingMod('SailMoveAcceleration')) * state.boatCargoMod) * f(b.modifierMoveAccelerationSail)) * (responsive() ? HELM_WAY.coast : 1));
  }
  /** turnSpeed (553-564). */
  function turnSpeed() {
    const b = cur();
    if (state.sailPosition === 0) return f(f(f(HANDLING.turnSpeedOar * handlingMod('OarTurnSpeed')) * state.boatCargoMod) * f(b.modifierTurnSpeedOar));
    return f(f(f(HANDLING.turnSpeedSail * handlingMod('SailTurnSpeed')) * state.boatCargoMod) * f(b.modifierTurnSpeedSail));
  }
  /** turnAccel (566-576). HELM-WAY: under the responsive helm a sail's helm comes over HELM_WAY.turnAccelSail times it. */
  function turnAccel() {
    const b = cur();
    if (state.sailPosition === 0 && (has('MoveRight') || has('MoveLeft'))) {
      return f(f(f(HANDLING.turnAccelOar * handlingMod('OarTurnAcceleration')) * state.boatCargoMod) * f(b.modifierTurnAccelerationOar));
    }
    return f(f(f(f(HANDLING.turnAccelSail * handlingMod('SailTurnAcceleration')) * state.boatCargoMod) * f(b.modifierTurnAccelerationSail)) * (responsive() ? HELM_WAY.turnAccelSail : 1));
  }
  /** wakeThreshold (504): moveSpeedSail * 0.25. */
  const wakeThreshold = () => f(HANDLING.moveSpeedSail * f(0.25));
  /** HasInput and inputTarget (582-613). */
  const hasInput = () => f(deps.input?.vertical?.() ?? 0) !== 0 || f(deps.input?.horizontal?.() ?? 0) !== 0 || !!deps.input?.toggleAutorun;
  function inputTarget() {
    if (!hasInput()) return [0, 0];
    const h = f(deps.input?.horizontal?.() ?? 0);
    return deps.input?.toggleAutorun ? [h, 1] : [h, f(deps.input?.vertical?.() ?? 0)];
  }
  /** combinedCollisionDirection (650-667). */
  function combinedCollisionDirection() {
    let v = [0, 0, 0];
    for (const d of state.collisionDirections) v = vAdd(v, d);
    return v;
  }
  /** CanTurnLeft / CanTurnRight (723-767): a collision on the side the stern would swing into refuses the turn. */
  function CanTurnLeft(boat) {
    const fwd = quatRotate(boat.GameObject.rotation, [0, 0, 1]), right = quatRotate(boat.GameObject.rotation, [1, 0, 0]);
    for (const c of state.collisionDirections) {
      const num = vDot(fwd, c), num2 = vDot(right, c);
      if ((num >= 0 && num2 < 0) || (num < 0 && num2 >= 0)) return false;
    }
    return true;
  }
  function CanTurnRight(boat) {
    const fwd = quatRotate(boat.GameObject.rotation, [0, 0, 1]), right = quatRotate(boat.GameObject.rotation, [1, 0, 0]);
    for (const c of state.collisionDirections) {
      const num = vDot(fwd, c), num2 = vDot(right, c);
      if ((num >= 0 && num2 >= 0) || (num < 0 && num2 < 0)) return false;
    }
    return true;
  }
  /** CanSail (6031-6042): every node on water. */
  const CanSail = (boat) => boat.NodeTileMapIndices.every((v) => v === 0);
  /** IsBeached (6044-6060): more than three of the five off water. */
  function IsBeached(boat) {
    let num = 0;
    for (const v of boat.NodeTileMapIndices) {
      if (v !== 0) num++;
      if (num > 3) return true;
    }
    return false;
  }
  /** IsNodeOnWater (6062-6069). */
  const IsNodeOnWater = (boat, index) => boat.NodeTileMapIndices[index] === 0;

  /** UpdateCurrentBoatNodes (3479-3486). */
  function UpdateCurrentBoatNodes() {
    if (isSailing()) {
      UpdateBoatNodes(state.CurrentBoat);
      CheckCollision(state.CurrentBoat);
    }
  }
  /**
   * CheckCollision (3488-3622): two SphereCastAll sweeps along the hull, the collider's own box's half beam for the
   * radius, forward then back, every non-trigger collider but the boat's own, a terrain's and an entity's. The first
   * sweep takes a collider the sphere already overlaps at its start, whose point Unity answers as zero - so its
   * direction is the one from the scene's origin to the boat (kept bug for bug); the second refuses a zero point.
   */
  function CheckCollision(boat) {
    state.collisionDirections.length = 0;
    const ctx = { models: deps.pool.models };
    const local = meshLocalBounds(ctx, boat.MeshCollider.m_Mesh);   // MeshCollider.sharedMesh.bounds
    const world = colliderBounds(ctx, boat.MeshObject, boat.MeshCollider);   // Collider.bounds
    const center = world.center.map(f);
    const x = f(local.extent[0]);
    const val = vScale(quatRotate(boat.MeshObject.rotation, [0, 0, 1]), f(f(local.extent[2]) - x));
    const val2 = vAdd(center, val), val3 = vSub(center, val);
    const val4 = vSub(val2, val3);
    // FIELD BUGS 2026-10-02b ROCK-REACH (a departure): each sweep reaches her own end - its sphere's centre from hers to
    // her end's, `val` - where the C#'s reached val4, the whole length again past it: a rock half a hull clear of her
    // bow or her stern pushed her and refused her helm, and the push answers the SUM of all she met - two clear astern
    // and one clear ahead summed astern-to-fore, she kept her way, and sailed onto the one ahead and on through it.
    const reach = vMagnitude(val);
    // FIELD BUGS 2026-10-02b ROCK-FREE's audit (departures): the host is handed her keel line - her collider's box's
    // foot under its centre, as she floats however the swell pitches her (a shelf under it is no rock) - and herself
    // (her own colliders are not asked). A start overlap - the host answers it where it touches, `start`, where Unity
    // answers the zero point - is the second sweep's refusal as the zero point is (a rock overlapping her side counted
    // twice outweighed the rock ahead, and she slid 15.9 m into it), and it pushes her off it from her sweep's centre,
    // where it overlaps her: one straight under that centre has no side to push her from, and is none.
    const m = boat.MeshObject.worldMatrix();
    const footY = f(local.center[1] - local.extent[1]);
    const opts = { keelY: f(f(f(f(m[1] * local.center[0]) + f(m[5] * footY)) + f(m[9] * local.center[2])) + m[13]), boat };
    const sweep = (dir, zeroPointOk) => {
      for (const hit of deps.sphereCastAll?.(center, x, vNormalized(dir), reach, opts) ?? []) {
        if (hit.root === boat.GameObject || hit.terrain || hit.entity) continue;
        if (!zeroPointOk && (hit.start || vEquals(hit.point, [0, 0, 0]))) continue;
        const off = vNormalized(vProjectOnPlane(vSub(hit.start ? center : boat.GameObject.position, hit.point), V_UP));
        if (hit.start && vEquals(off, [0, 0, 0])) continue;
        log(`COME SAIL AWAY - BOAT COLLIDED WITH ${hit.name}`);
        state.collisionDirections.push(off);
      }
    };
    sweep(vSub(val2, val3), true);
    sweep(vSub(val3, val2), false);
    if (state.collisionDirections.length > 0) {
      if (state.timeScaleIndex > 0) ResetTimeScale();
      state.CollisionVector = vNormalized(inverseTransformDirection(boat.GameObject, combinedCollisionDirection()));
    } else state.CollisionVector = [0, 0, 0];
  }
  /** IncreaseTimeScale (6071-6082): refused with enemies near, else one step up (to the fifth, 30). */
  function IncreaseTimeScale() {
    if (deps.enemiesNearby?.()) deps.midScreenText('There are enemies nearby...', f(1.5));
    else if (state.timeScaleIndex < TIME_SCALES.length - 1) {
      state.timeScaleIndex++;
      SetTimeScale(TIME_SCALES[state.timeScaleIndex]);
    }
  }
  /** DecreaseTimeScale (6084-6091): one step down, never below the first. */
  function DecreaseTimeScale() {
    if (state.timeScaleIndex > 0) {
      state.timeScaleIndex--;
      SetTimeScale(TIME_SCALES[state.timeScaleIndex]);
    }
  }
  /** ResetTimeScale (6093-6100): the helm's step, or Unity's scale another mod set, back to one. */
  function ResetTimeScale(message = true) {
    if (state.timeScaleIndex !== 0 || f(deps.timeScale?.() ?? 1) !== 1) {
      state.timeScaleIndex = 0;
      SetTimeScale(TIME_SCALES[state.timeScaleIndex], message);
    }
  }
  /** SetTimeScale (6102-6110): Time.timeScale (and fixedDeltaTime with it - the host's one clock), said for three
   *  seconds of game time (`3f * scale` of them, the message's clock running at the new scale). */
  function SetTimeScale(scale, message = true) {
    deps.setTimeScale?.(scale);
    if (message) deps.midScreenText(`Time scale set to ${scale}.`, f(3 * scale));
  }

  /**
   * MessageReceiver (1833-1890, registered in Awake 918): the ten messages another mod sends this one. The wind and
   * the current are answered as Vector3s are passed - a copy; the three events take `data as Action<...>`, which is
   * null for anything but a function, and `+= null` subscribes nothing; ResetTimeScale says its scale, as the helm's
   * does; StopSailing is the Disembark key's delayed stop. The two boat objects are CurrentBoat's, read only when a
   * callback was given - with no boat, the C#'s NullReferenceException (kept). Any other message is logged as an error.
   * @param {string} message @param {any} data @param {((message:string, data:any) => void) | null} [callBack]
   */
  function MessageReceiver(message, data, callBack = null) {
    switch (message) {
      case 'GetWind': callBack?.('GetWind', [...state.windVectorCurrent]); break;
      case 'GetCurrent': callBack?.('GetCurrent', [...state.currentVector]); break;
      case 'OnUpdateWind': if (typeof data === 'function') events.OnUpdateWind.push(data); break;
      case 'OnUpdateCurrent': if (typeof data === 'function') events.OnUpdateCurrent.push(data); break;
      case 'OnUpdateSailing': if (typeof data === 'function') events.OnUpdateSailing.push(data); break;
      case 'ResetTimeScale': ResetTimeScale(); break;
      case 'StopSailing': StopSailingDelayed(); break;
      case 'IsPlayerSailing': callBack?.('IsPlayerSailing', isSailing()); break;
      case 'GetBoatGameObject': callBack?.('GetBoatGameObject', state.CurrentBoat.GameObject); break;
      case 'GetBoatMeshObject': callBack?.('GetBoatMeshObject', state.CurrentBoat.MeshObject); break;
      default: (deps.logError ?? deps.log)?.(`${MOD_OBJECT_NAME}: unknown message received (${message}).`); break;
    }
  }

  /** UpdateBoatCargoMod (3820-3858): the cargo's weight against the threshold; a mod past half or at all, said. */
  function UpdateBoatCargoMod(boat) {
    let num = f(deps.cargoWeight?.(boat.Cargo.Items) ?? 0);
    if (setting('Cargo.PlayerWeight', true)) num = f(num + (deps.entity?.isFemale?.() ? CARGO_WEIGHTS.female : CARGO_WEIGHTS.male));
    if (setting('Cargo.PlayerCarriedWeight', true)) num = f(num + f(deps.entity?.carriedWeight?.() ?? 0));
    if (setting('Cargo.CartCarriedWeight', true)) num = f(num + f(deps.entity?.wagonWeight?.() ?? 0));
    if (setting('Cargo.HorseItem', false) && deps.transport?.hasHorse?.()) num = f(num + CARGO_WEIGHTS.horse);
    if (setting('Cargo.CartItem', false) && deps.transport?.hasCart?.()) num = f(num + CARGO_WEIGHTS.cart);
    // a hull with no Cargo modifier (the Carrack) divides by zero: 0 at any weight, NaN at none - kept by the mod's own
    // handling; HELM-WAY: the responsive helm gives it the largest hold the mod gave any hull (CARGO_HOLD_MISSING)
    const hold = !(boat.modifierCargoThreshold > 0) && responsive() ? CARGO_HOLD_MISSING : boat.modifierCargoThreshold;
    state.boatCargoMod = mathfClamp(f(2 - f(num / f(f(Number(setting('Cargo.CargoThreshold', 500))) * f(hold)))), 0, 1);
    if (state.lastWeight !== num) {
      state.lastWeight = num;
      if (state.boatCargoMod < 0.5) deps.midScreenText("You're going to need a bigger boat", 3);
      else if (state.boatCargoMod < 1) deps.midScreenText('The boat draws a little lower than usual', 3);
    }
  }

  // ── the player's transform under the boat (SetParent) ──
  /** The player's centre moved with the boat by the boat's own move: its local offset kept, as a child's is. */
  function carryChildren(boat, before) {
    const after = boat.GameObject.worldMatrix();
    if (playerParent === boat) {
      deps.helm.setPlayerPosition(carriedPoint(before, after, deps.player().position));
      deps.helm.turnPlayer(yawDelta(before, after));
    }
    for (const { enemy, boat: b } of state.parentedObjects.values()) {
      if (b !== boat) continue;
      enemy.setPosition(carriedPoint(before, after, enemy.position()));
      enemy.turn?.(yawDelta(before, after));
    }
  }

  /** StartSailing (5783-5828). */
  function StartSailing(boat) {
    deps.hudText('You control the boat!');
    state.CurrentBoat = boat;
    if (!deps.transport?.isFoot?.()) deps.transport?.setFoot?.();
    if (boat.crewed && !deps.ship?.owns?.()) {
      state.TemporaryShip = true;
      deps.ship?.assign?.('Small');   // DaggerfallBankManager.AssignShipToPlayer(ShipType.Small)
    }
    boat.WakeEmitter.stop();
    playerParent = boat;   // playerObject.transform.SetParent(boat.GameObject.transform): the world pose kept
    deps.helm.setFacing(yawOfForward(quatRotate(boat.GameObject.rotation, [0, 0, 1])), 0);   // SetFacing(0, 0) - in the boat's frame
    deps.helm.setPlayerPosition(boat.DrivePosition.position);
    // smoothFollowerLerpSpeed = 250 - the port's eye rides the body (declared)
    boat.MapPixel = deps.currentMapPixel();
    helmHanded = handed();   // AUDIT NAV2 F14: this helm's Ship handling, kept until she stops sailing
    UpdateBoatCargoMod(boat);
    UpdateCurrentBoatNodes();
    boat.IdleObject?.setActive(false);
    boat.ActiveObject?.setActive(true);
    deps.helm.footsteps?.(false);
    if (state.CurrentBoat.RudderEmitters.length > 0 && !DisableParticles()) for (const rudderEmitter of state.CurrentBoat.RudderEmitters) rudderEmitter.play();
    // the rendering path (the port has one)
    rudderOf(state.CurrentBoat)?.CrossFade('Rowing', 1);
    raise('OnUpdateSailing', true);
  }
  /** The disembark both StopSailings share, to the coroutine's yield (5832-5875 / 5906-5942). */
  function stopSailingHead() {
    if (deps.input?.toggleAutorun) deps.input.toggleAutorun = false;
    if (state.TemporaryShip) ReturnTemporaryShip();
    const boat = state.CurrentBoat;
    deps.hudText('You stop controlling the boat!');
    if (state.sailPosition > 0) LowerSails();
    boat.WakeEmitter.stop();
    state.sailPosition = 0;
    state.MoveVectorTarget = [0, 0, 0];
    state.MoveVectorCurrent = [0, 0, 0];
    state.TurnCurrent = 0;
    state.TurnTarget = 0;
    state.lastWeight = 0;
    helmHanded = null;   // AUDIT NAV2 F14: the next helm takes the Ship handling as it stands then
    boat.MapPixel = deps.currentMapPixel();
    ResetTimeScale();
    boat.ActiveObject?.setActive(false);
    boat.IdleObject?.setActive(true);
    deps.helm.footsteps?.(true);
    rudderOf(boat)?.CrossFade('Disembarked', 1);
    if (boat.RudderEmitters.length > 0) for (const rudderEmitter of boat.RudderEmitters) rudderEmitter.stop();
    return boat;
  }
  /** The head's lent-ship arm (IL_b0e7-IL_b121): the borrowed ship's two permanent scenes removed (the LARGE ship's -
   *  kept), the ship taken back, the flag down. AUDIT PRE-MERGE 0928 C1: the host runs it for a helm a load that landed
   *  elsewhere let go (world.js csaHelmLeft) - RestoreSaveData reads TemporaryShip only for a helm it takes. */
  function ReturnTemporaryShip() {
    for (const scene of TEMPORARY_SHIP_SCENES) deps.ship?.removePermanentScene?.(scene);
    deps.ship?.assign?.('None');
    state.TemporaryShip = false;
  }
  /** The un-parenting both share: SetParent(null, true), the facing levelled along the world forward. */
  function unparentPlayer() {
    const forward = deps.player().forward ?? quatRotate(deps.player().rotation, [0, 0, 1]);
    playerParent = null;
    deps.helm.setFacing(yawOfForward(forward), 0);   // SetHorizontalFacing(forward)
    // smoothFollowerLerpSpeed = 25; the rendering path - as StartSailing's
  }
  /** StopSailing (5830-5893): at once - a load, a death, fast travel. */
  function StopSailing() {
    stopSailingTail(stopSailingHead());
  }
  /** StopSailing past its head: the player set down at the helm, the freeze lifted, OnUpdateSailing(false). */
  function stopSailingTail(currentBoat) {
    state.CurrentBoat = null;
    unparentPlayer();
    deps.helm.setPlayerPosition(currentBoat.DrivePosition.position);
    deps.helm.freeze(0);
    raise('OnUpdateSailing', false);
  }
  /** StopSailingDelayed (5895-5902) and StopSailingCoroutine (5904-5964): the head now; at the frame's end the
   *  un-parenting; then the player held at the helm each frame's end until the motor's freeze runs out. */
  function StopSailingDelayed() {
    if (state.disembarking != null) return;
    const co = { boatlast: null, phase: 'head' };
    state.disembarking = co;
    co.boatlast = stopSailingHead();
    co.phase = 'unparent';
    endOfFrameQueue.push(() => resumeStopSailing(co));
  }
  function resumeStopSailing(co) {
    if (state.disembarking !== co) return false;   // AUDIT PRE-MERGE 0928 S1: ended already - a load's start ended it (EndDisembark)
    if (co.phase === 'unparent') {
      state.CurrentBoat = null;
      unparentPlayer();
      co.phase = 'hold';
    }
    if (co.phase === 'hold') {
      if (deps.helm.frozen()) {
        if (!state.AllBoats.includes(co.boatlast)) { state.disembarking = null; return false; }   // AUDIT PRE-MERGE 0928 S1: its boat destroyed under it (packed at its rudder, a door's UpdateBoatVisibility, purgeboat) - Unity's coroutine dies at the destroyed transform, raising nothing
        deps.helm.setPlayerPosition(co.boatlast.DrivePosition.position);
        return true;   // yield return new WaitForEndOfFrame()
      }
      raise('OnUpdateSailing', false);
      if (state.disembarking === co) state.disembarking = null;
    }
    return false;
  }
  /** WaitForEndOfFrame: each coroutine waiting on it resumes once, in the order it yielded. */
  function endOfFrame() {
    const q = endOfFrameQueue;
    endOfFrameQueue = [];
    for (const step of q) if (step()) endOfFrameQueue.push(step);
  }

  // ── CSA-E: the wind widget (4331-4345, 4166-4176) ──
  const windDirectionWidget = () => !!setting('WindDirectionWidget.Enable', true);
  const playerForward = () => (deps.player().forward ?? quatRotate(deps.player().rotation, V_FORWARD)).map(f);
  /** Update's frame (4331-4345): the wind's signed angle off the player's forward, in the interval's steps - a
   *  positive one read from 360 down, a negative one up from nought (the C#'s two arms: each bin the interval wide,
   *  its far edge in), held to the frames, nought the last - counted back from the end of the pictures. */
  function windWidgetFrameOf(num2) {
    const interval = windWidgetInterval(), count = windWidgetFrameCount();
    let num = Math.trunc(f(f(360 - f(f(num2 / interval) * interval)) / interval));
    if (num2 < 0) num = Math.trunc(f(f(f(f(0 - num2) / interval) * interval) / interval));
    num = mathfClamp(num, 0, count);
    if (num === 0) num = count;
    return count - num;
  }
  /** OnGUI's wind widget (4089-4105, 4164-4176): at the helm, unpaused and not loading, the frame's picture centred
   *  at the widget's offset of the screen rect (lifted by the large HUD's height when it rides above the horse),
   *  its size the picture's times the screen's scale (none, the height's, or both of a 320x200) and the widget's,
   *  tinted the setting's colour. The debug values OnGUI prints beside it are CSA-I's, with the rest of OnGUI.
   *  @param {{ screenRect: { x?: number, y?: number, width: number, height: number }, textureSize?: number[],
   *            largeHudHeight?: number, paused?: boolean, loading?: boolean }} opts */
  function windWidget({ screenRect, textureSize = [128, 128], largeHudHeight = 0, paused = false, loading = false }) {
    if (paused || loading || !isSailing() || !windDirectionWidget()) return null;
    const [screenScaleX, screenScaleY] = screenScaleOf(screenRect);
    const offset = setting('WindDirectionWidget.Position', [0.5, 0.5]);
    const scale = f(Number(setting('WindDirectionWidget.Scale', 1)));
    const at = [f(f(screenRect.x ?? 0) + f(screenRect.width * f(offset[0]))), f(f(f(screenRect.y ?? 0) + f(screenRect.height * f(offset[1]))) - largeHudHeight)];
    const size = [f(f(f(textureSize[0]) * screenScaleX) * scale), f(f(f(textureSize[1]) * screenScaleY) * scale)];
    return { frame: state.windWidgetFrame, rect: { x: f(at[0] - f(size[0] * f(0.5))), y: f(at[1] - f(size[1] * f(0.5))), w: size[0], h: size[1] }, color: setting('WindDirectionWidget.Color', '#ffffffff') };
  }

  /** OnGUI's screen scale (4093-4108), the widget's ScalingMode: 2 both of the native 320x200, 1 the height's for
   *  both, else none. OnGUI keeps it in two fields every draw; the map's clicks read the same. */
  function screenScaleOf(screenRect) {
    const mode = Number(setting('WindDirectionWidget.ScalingMode', 0));
    let screenScaleX = 1, screenScaleY = 1;
    if (mode === 2) { screenScaleY = f(screenRect.height / WIND_WIDGET.nativeHeight); screenScaleX = f(screenRect.width / WIND_WIDGET.nativeWidth); }
    else if (mode === 1) { screenScaleY = f(screenRect.height / WIND_WIDGET.nativeHeight); screenScaleX = screenScaleY; }
    return [screenScaleX, screenScaleY];
  }

  // ── CSA-E: the sails (5216-5429) and Update's sail arm (4353-4410, 4481-4732) ──
  const trimAuto = () => !!setting('SailingAssist.AutoTrimming', true);
  const trimAutoSquareUpwind = () => !!setting('SailingAssist.AutoStowSquareSails', true);
  /** Vector3.ProjectOnPlane(v, Vector3.up), and a Transform's forward. */
  const flat = (v) => vProjectOnPlane(v, V_UP);
  const forwardOf = (node) => quatRotate(node.rotation, V_FORWARD).map(f);
  /** GetSailPower (5216-5294): each sail up, by its kind and its angle to the wind - a lateen best off the wind and
   *  15% less (x0.85) on its bad tack, a gaff and a staysail on to 150 degrees and a square sail running before it -
   *  scaled for a small or a large one. The hull's own angle to the sail is taken and dropped (kept). */
  function GetSailPower() {
    let num = 0;
    const b = state.CurrentBoat;
    if (b.Sails.length < 1) return num;
    for (const sail of b.Sails) {
      if (animatorOf(sail).GetBool('Stowed')) continue;   // a sail without an Animator throws, as the C#'s does
      let num2 = 0;
      vAngle(flat(forwardOf(b.GameObject)), flat(forwardOf(sail)));
      const num3 = vAngle(flat(state.windVectorCurrent), flat(forwardOf(sail)));
      if (b.SailsLateen.includes(sail)) {
        num2 = num3 <= 135 ? f(mathfLerp(50, 100, f(num3 / 135)) / 100) : !(num3 <= 165) ? 0 : f(mathfLerp(100, 50, f(f(num3 - 135) / 30)) / 100);
        if (vSignedAngle(forwardOf(sail), state.windVectorCurrent, V_UP) > 0) num2 = f(num2 * f(0.85));
        if (num2 < 0) num2 = f(num2 * f(0.5));
      } else if (b.SailsGaff.includes(sail)) {
        num2 = !(num3 <= 135) ? f(mathfLerpUnclamped(100, 0, f(f(num3 - 135) / 15)) / 100) : f(mathfLerpUnclamped(50, 100, f(num3 / 135)) / 100);
        if (num2 < 0) num2 = f(num2 * f(0.25));
      } else if (b.SailsStay.includes(sail)) {
        num2 = !(num3 <= 135) ? f(mathfLerpUnclamped(80, 0, f(f(num3 - 135) / 15)) / 100) : f(mathfLerpUnclamped(20, 80, f(num3 / 135)) / 100);
        if (num2 < 0) num2 = f(num2 * f(0.25));
      } else {
        num2 = f(mathfLerpUnclamped(100, 0, f(num3 / 90)) / 100);
        if (num2 < 0) num2 = f(num2 * 2);
      }
      if (b.SailsSmall.includes(sail)) num2 = b.SailsGaff.includes(sail) ? f(num2 * f(0.5)) : !b.SailsStay.includes(sail) ? f(num2 * f(0.4)) : f(num2 * f(0.3));
      else if (b.SailsLarge.includes(sail)) num2 = f(num2 * f(1.5));
      num = f(num + num2);
    }
    return num;
  }
  /** ToggleSails (5296-5310). */
  function ToggleSails() {
    if (state.CurrentBoat.Sails.length < 1) deps.hudText('Boat does not have any sail.');
    else if (state.sailPosition === 0) RaiseSails();
    else LowerSails();
  }
  /** RaiseSails (5312-5349): refused while a node is off water; with the square sails' assist on, those stay
   *  stowed when the wind is more than 90 degrees off the bow. */
  function RaiseSails() {
    const b = state.CurrentBoat;
    // NAV-H x AUDIT NAV1 (the helm): the sea fight's refusal first (`deps.sailRefused`: a wreck, a rig shot away) - once,
    // where the host had lowered them again every frame they went up, a line a press
    const refused = deps.sailRefused?.() ?? null;
    if (refused) {
      deps.hudText(refused);
      return;
    }
    if (!CanSail(b)) {
      deps.hudText('Unable to raise sail. Boat is obstructed.');
      return;
    }
    deps.hudText('Sail raised!');
    const flag = Math.abs(vSignedAngle(flat(forwardOf(b.GameObject)), flat(state.windVectorCurrent), V_UP)) > 90;
    if (b.Sails.length > 0) {
      for (const sail of b.Sails) {
        if (!b.SailsSquare.includes(sail) || !trimAutoSquareUpwind() || !flag) {
          const component = animatorOf(sail);
          if (component != null) stow(component, false);
        }
      }
    }
    state.sailPosition = 1;
    deps.audio?.dfOneShot?.(nodeOf(b.GameObject, b.DFAudioSource), 380, 1, loopVolume());   // DFAudioSource.PlayOneShot((SoundClips)380, 1f, SoundVolume * sfxVolume)
    rudderOf(b)?.SetBool('Sailing', true);
  }
  /** LowerSails (5351-5372). */
  function LowerSails() {
    const b = state.CurrentBoat;
    deps.hudText('Sail lowered!');
    if (b.Sails.length > 0) {
      for (const sail of b.Sails) {
        const component = animatorOf(sail);
        if (component != null) stow(component, true);
      }
    }
    state.sailPosition = 0;
    deps.audio?.dfOneShot?.(nodeOf(b.GameObject, b.DFAudioSource), 381, 1, loopVolume());   // (SoundClips)381
    rudderOf(b)?.SetBool('Sailing', false);
  }
  /** HasLargeSquareSailWithGaff (5374-5393). */
  function HasLargeSquareSailWithGaff(boat) {
    let flag = false;
    if (boat.SailsSquare.length > 0) {
      for (const item of boat.SailsSquare) {
        if (!boat.SailsSmall.includes(item)) { flag = true; break; }
      }
    }
    if (flag) return boat.SailsGaff.length > 0;
    return false;
  }
  /** ToggleSquareSails (5395-5428): the square sails alone, by the first one's Stowed. */
  function ToggleSquareSails() {
    const b = state.CurrentBoat;
    if (b.SailsSquare.length <= 0) return;
    if (animatorOf(b.SailsSquare[0]).GetBool('Stowed')) {
      deps.hudText('Square sails raised!');
      for (const item of b.SailsSquare) { const component = animatorOf(item); if (component != null) stow(component, false); }
      return;
    }
    deps.hudText('Square sails lowered!');
    for (const item2 of b.SailsSquare) { const component2 = animatorOf(item2); if (component2 != null) stow(component2, true); }
  }
  /**
   * HELM-KEYS (2026-09-29, the player: "Arrow keys should not only control your ship, but also setting and raising
   * your sails. I also want to find a way to make the ship controls more intuitive") - MORE SAIL and LESS SAIL, the
   * port's own two steps through the mod's own sail states (DECLARED, the Port-Ledger's Come Sail Away row): the
   * sails stowed, a hull's fore-and-aft canvas alone (its square sails stowed by hand - the assist's AutoStow off), all
   * her canvas. More sail raises what is stowed - RaiseSails, then ToggleSquareSails - and less sail takes in the
   * square sails first where the fore-and-aft stand without them, then LowerSails. With the assist's square sails
   * (the default) the steps are the two ToggleSails makes. A step with nowhere to go says so.
   */
  const squareHandled = (b) => b.SailsSquare.length > 0 && (b.SailsLateen.length > 0 || b.SailsGaff.length > 0) && !trimAutoSquareUpwind();
  const squareStowed = (b) => animatorOf(b.SailsSquare[0])?.GetBool('Stowed') !== false;
  function MoreSail(b) {
    if (b.Sails.length < 1) { deps.hudText('Boat does not have any sail.'); return; }
    if (state.sailPosition === 0) { RaiseSails(); return; }
    if (squareHandled(b) && squareStowed(b)) { ToggleSquareSails(); return; }
    deps.hudText('All sail is set.');
  }
  function LessSail(b) {
    if (b.Sails.length < 1) { deps.hudText('Boat does not have any sail.'); return; }
    if (state.sailPosition === 0) { deps.hudText('The sails are stowed.'); return; }
    if (squareHandled(b) && !squareStowed(b)) { ToggleSquareSails(); return; }
    LowerSails();
  }
  /** HELM-KEYS: whether her helm is in irons (IRONS_TELL_DEG, IRONS_TELL_WAY) - her sails up and the wind's eye dead ahead. */
  function inIrons(b) {
    if (state.sailPosition === 0 || b.Sails.length < 1) return false;
    const toWind = Math.abs(vSignedAngle(flat(forwardOf(b.GameObject)), flat(state.windVectorCurrent), V_UP));   // the wind blows TO: 180 is dead into it
    // AUDIT NAV2 F15: her way THROUGH THE WATER - velocityCurrent carries the sea's current too (half the wind with the
    // waves on, the mod's default), which held a hull lying head to wind over IRONS_TELL_WAY: never told
    return toWind >= 180 - IRONS_TELL_DEG && vMagnitude(state.MoveVectorCurrent) < IRONS_TELL_WAY;
  }
  /** Update's manual trim (4370-4410): the brackets turn the fore-and-aft booms to 90 each way, or the square ones
   *  to 45 (with the modifier, or on a boat with neither lateen nor gaff), at 15 degrees a second; every boom set. */
  function manualTrim(boat) {
    const squareOnly = boat.SailsLateen.length < 1 && boat.SailsGaff.length < 1;
    if (has(BOAT_ACTIONS.trimRight)) {
      if (has(BOAT_ACTIONS.trimModifier) || squareOnly) {
        if (state.trimAngleSquare < 45) state.trimAngleSquare = f(state.trimAngleSquare + f(15 * dt()));
      } else if (state.trimAngle < 90) state.trimAngle = f(state.trimAngle + f(15 * dt()));
    }
    if (has(BOAT_ACTIONS.trimLeft)) {
      if (has(BOAT_ACTIONS.trimModifier) || squareOnly) {
        if (state.trimAngleSquare > -45) state.trimAngleSquare = f(state.trimAngleSquare - f(15 * dt()));
      } else if (state.trimAngle > -90) state.trimAngle = f(state.trimAngle - f(15 * dt()));
    }
    for (const boom of boat.Booms) boom.localRotation = quatAngleAxis(boom.name.includes('Square') ? state.trimAngleSquare : state.trimAngle, V_UP);
  }
  /** A sail's pull on its Animator's Wind (4497-4574): by its kind and its signed angle to the wind. */
  function sailWind(boat, sail, num9) {
    const between = (a, b, t) => mathfLerp(a, b, t);
    if (boat.SailsSquare.includes(sail)) {
      if (num9 > 0 && num9 <= 90) return between(1, 0, f(num9 / 90));
      if (num9 > 90 && num9 <= 180) return between(0, -1, f(f(num9 - 90) / 90));
      if (num9 <= 0 && num9 > -90) return between(1, 0, f(num9 / -90));
      if (num9 <= -90 && num9 > -180) return between(0, -1, f(f(num9 + 90) / -90));
    } else if (boat.SailsLateen.includes(sail)) {
      if (num9 > 0 && num9 <= 90) return between(0, -1, f(num9 / 90));
      if (num9 > 90 && num9 <= 180) return between(-1, 0, f(f(num9 - 90) / 90));
      if (num9 <= 0 && num9 > -90) return between(0, 1, f(num9 / -90));
      if (num9 <= -90 && num9 > -180) return between(1, 0, f(f(num9 + 90) / -90));
    } else if (boat.SailsGaff.includes(sail)) {
      if (num9 > 0 && num9 <= 90) return between(0, 1, f(num9 / 90));
      if (num9 > 90 && num9 <= 180) return between(1, 0, f(f(num9 - 90) / 90));
      if (num9 <= 0 && num9 > -90) return between(0, -1, f(num9 / -90));
      if (num9 <= -90 && num9 > -180) return between(-1, 0, f(f(num9 + 90) / -90));
    } else if (boat.SailsStay.includes(sail)) {
      if (num9 > 0 && num9 <= 90) return between(1, f(0.25), f(num9 / 90));
      if (num9 > 90 && num9 <= 180) return between(f(0.25), 0, f(f(num9 - 90) / 90));
      if (num9 <= 0 && num9 > -90) return between(-1, f(-0.25), f(num9 / -90));
      if (num9 <= -90 && num9 > -180) return between(f(-0.25), 0, f(f(num9 + 90) / -90));
    }
    return 0;
  }
  /** Update's sail arm (4481-4732): obstructed, the sails come down and the boat stops; each sail's Wind walks toward
   *  its pull (a sail luffing head to wind flaps on a sine of the clock), the square sails stow themselves upwind, the
   *  booms trim themselves; the sails' power drives the boat and the rudder turns it by the speed it is making. */
  function updateSails(boat) {
    if (!CanSail(boat)) {
      LowerSails();
      state.MoveVectorCurrent = [0, 0, 0];
      state.MoveVectorTarget = [0, 0, 0];
      ResetTimeScale();
    }
    if (boat.Sails.length > 0) {
      const num6 = vSignedAngle(flat(forwardOf(boat.GameObject)), flat(state.windVectorCurrent), V_UP);
      const flag = Math.abs(num6) > 90;
      let num7 = 0;
      for (const sail of boat.Sails) {
        const num9 = vSignedAngle(flat(forwardOf(sail)), flat(state.windVectorCurrent), V_UP);
        const num8 = sailWind(boat, sail, num9);
        const component = animatorOf(sail);
        if (component != null) {
          let wind = component.GetFloat('Wind');
          const lateen = boat.SailsLateen.includes(sail);
          if (!boat.SailsSquare.includes(sail) && ((!lateen && (num9 > 150 || num9 < -150)) || (lateen && (num9 > 165 || num9 < -165)))) {
            const num10 = f(f(Math.sin(f(f(f(deps.time()) + num7) * 2))) * f(0.25));
            wind = mathfMoveTowards(wind, num10, dt());
          } else {
            const num11 = f((num8 >= 0 ? 1 : -1) * vMagnitude(state.windVectorCurrent));   // Mathf.Sign(num8) * magnitude
            wind = !boat.SailsStay.includes(sail) ? mathfMoveTowards(wind, num11, dt()) : mathfMoveTowards(wind, num8, dt());
          }
          component.SetFloat('Wind', wind);
        }
        if (trimAutoSquareUpwind() && boat.SailsSquare.includes(sail) && component != null) {
          const bool = component.GetBool('Stowed');
          if (flag && !bool) stow(component, true);
          else if (!flag && bool) stow(component, false);
        }
        num7++;
      }
      if (trimAuto()) autoTrim(boat, num6);
    }
    const num17 = f(GetSailPower() * vMagnitude(state.windVectorCurrent));
    let num18 = 0;
    if (has('MoveRight')) num18 = 1;
    else if (has('MoveLeft')) num18 = -1;
    // HELM-WAY: the responsive rudder answers her STEERAGE (helmWay.js) - at rest too, hardest at half her way - where
    // the mod's answers her way itself
    const way = vMagnitude(state.MoveVectorCurrent);
    state.TurnTarget = f(num18 * f(f(f(responsive() ? steerage(way) : way) * f(boat.modifierRudder)) / 10));
    state.MoveVectorTarget = vScale(V_FORWARD, num17);
    if ((state.TurnTarget > 0 && !CanTurnRight(boat)) || (state.TurnTarget < 0 && !CanTurnLeft(boat))) {
      state.TurnTarget = 0 - num18;
      state.TurnCurrent = state.TurnTarget;
    }
    rudderOf(boat)?.SetFloat('TurnAngle', state.inputCurrent[0]);
  }
  /** The auto trim (4607-4710): the square booms toward the wind's angle off the bow held to 45, the lateen and gaff
   *  booms to the side it blows from; a stowed sail's boom home; 100 degrees a second (a gaff swinging out 300). */
  function autoTrim(boat, num6) {
    let num12 = mathfClamp(num6, -45, 45);
    let num13 = 0, num14 = 0;
    if (num6 > 0 && num6 <= 90) { num14 = mathfLerp(-90, -45, f(num6 / 90)); num13 = num14; }
    else if (num6 > 90 && num6 <= 180) { num14 = mathfLerp(-45, 0, f(f(num6 - 90) / 60)); num13 = mathfLerp(-45, 0, f(f(num6 - 90) / 75)); }
    else if (num6 <= 0 && num6 > -90) { num14 = mathfLerp(90, 45, f(num6 / -90)); num13 = num14; }
    else if (num6 <= -90 && num6 > -180) { num14 = mathfLerp(45, 0, f(f(num6 + 90) / -60)); num13 = mathfLerp(45, 0, f(f(num6 + 90) / -75)); }
    if (HasLargeSquareSailWithGaff(boat)) {
      if (num14 > 30) num14 = 30;
      if (num14 < -30) num14 = -30;
      if (num12 > 30) num12 = 30;
      if (num12 < -30) num12 = -30;
    }
    const step = f(100 * dt());
    for (const boom2 of boat.Booms) {
      let flag2 = true;
      let val = null;
      for (let i = 0; i < boom2.childCount; i++) {
        const child = boom2.getChild(i);
        if (child.activeSelf) { val = animatorOf(child); break; }
      }
      if (val != null) flag2 = val.GetBool('Stowed');
      if (boom2.name.includes('Square')) {
        boom2.localRotation = quatRotateTowards(boom2.localRotation, quatAngleAxis(flag2 ? 0 : num12, V_UP), step);
      } else if (boom2.name.includes('Lateen')) {
        boom2.localRotation = quatRotateTowards(boom2.localRotation, quatAngleAxis(flag2 ? 0 : num13, V_UP), step);
      } else {
        if (!boom2.name.includes('Gaff')) continue;
        if (flag2) {
          boom2.localRotation = quatRotateTowards(boom2.localRotation, quatAngleAxis(0, V_UP), step);
          continue;
        }
        let num15 = 100;
        const num16 = vSignedAngle(forwardOf(boom2), forwardOf(boat.GameObject), quatRotate(boat.GameObject.rotation, V_UP).map(f));
        if ((num16 < 0 && num16 < num14) || (num16 > 0 && num16 > num14)) num15 = 300;
        boom2.localRotation = quatRotateTowards(boom2.localRotation, quatAngleAxis(num14, V_UP), f(num15 * dt()));
      }
    }
  }

  /** Update's sailing arm (4301-4768) - what this slice owns of it; the rest is named where the C# runs it. */
  function updateSailing() {
    const boat = state.CurrentBoat;
    deps.helm.stopRunning?.();   // SpeedChanger.isRunning = false
    if (!deps.transport?.isFoot?.()) deps.transport?.setFoot?.();
    if (IsBeached(boat) && vSqrMagnitude(state.MoveVectorCurrent) > 0) {
      state.MoveVectorCurrent = [0, 0, 0];
      state.MoveVectorTarget = [0, 0, 0];
      ResetTimeScale();
    }
    if (state.timeScaleIndex !== 0 && deps.enemiesNearby?.()) {   // GameManager.AreEnemiesNearby(false, false)
      deps.midScreenText('There are enemies nearby...', f(1.5));
      ResetTimeScale(false);
    }
    state.inputCurrent = vMoveTowards(state.inputCurrent, inputTarget(), f(f(boat.modifierAnimation) * f(1 * dt())));
    if (windDirectionWidget()) state.windWidgetFrame = windWidgetFrameOf(vSignedAngle(playerForward(), state.windVectorCurrent, V_UP));
    const drive = boat.DrivePosition.position;
    if (!vEquals(deps.player().position, drive)) deps.helm.setPlayerPosition(drive);
    deps.helm.freeze(1);
    if (deps.input?.started?.(BOAT_ACTIONS.toggleSail)) {
      if (state.sailPosition > 0 && boat.SailsSquare.length > 0 && !trimAutoSquareUpwind() && has(BOAT_ACTIONS.trimModifier) && (boat.SailsLateen.length > 0 || boat.SailsGaff.length > 0)) ToggleSquareSails();
      else ToggleSails();
    }
    // HELM-KEYS (the port's, DECLARED): the arrows' more and less sail
    if (deps.input?.started?.(BOAT_ACTIONS.sailUp)) MoreSail(boat);
    if (deps.input?.started?.(BOAT_ACTIONS.sailDown)) LessSail(boat);
    // HELM-KEYS: in irons IRONS_TELL_S running, the helm told once how she comes out (again once she has been out of them)
    const irons = inIrons(boat);
    state.ironsFor = irons ? f(state.ironsFor + dt()) : 0;
    if (state.ironsFor >= IRONS_TELL_S && !state.ironsTold) { state.ironsTold = true; deps.hudText(responsive() ? IRONS_HELM_TEXT : IRONS_TEXT); }   // AUDIT NAV2 F18: the responsive rudder answers at rest
    else if (!irons) state.ironsTold = false;
    if (deps.input?.started?.(BOAT_ACTIONS.disembark) || deps.input?.started?.('Transport')) StopSailingDelayed();
    if (deps.input?.started?.(BOAT_ACTIONS.toggleLight)) setLights(boat, !boat.LightOn);
    if (!trimAuto()) manualTrim(boat);
    if (state.sailPosition === 0) {
      if (!boat.crewed && (vSqrMagnitude(state.MoveVectorTarget) > 0 || state.TurnTarget > 0)) {
        if (state.oarModeTimer >= OAR_MODE_TIME) {
          state.oarModeTimer = 0;
          deps.entity?.decreaseFatigue?.(OAR_FATIGUE);
        } else state.oarModeTimer = f(state.oarModeTimer + dt());
      }
      let num3 = 0, num4 = 0, num5 = 0;
      // the nodes the C# asks: forward the CENTRE's, back the bow's, right the stern's, left the starboard's (kept, but
      // for one). FIELD BUGS 2026-10-02 ASTERN (a departure): back asks the STERN's, the water she backs into - asking the
      // bow's, a bow run onto a shoal or a rock's foot refused the one way off it, and the centre's water let her row on in
      if ((has('MoveForwards') || deps.input?.toggleAutorun) && IsNodeOnWater(boat, 0)) num3 = 1;
      else if (has('MoveBackwards') && IsNodeOnWater(boat, 2)) num3 = -1;
      if (has('Run')) {
        if (has('MoveRight') && IsNodeOnWater(boat, 2)) num4 = 0.5;
        else if (has('MoveLeft') && IsNodeOnWater(boat, 3)) num4 = -0.5;
      } else if (has('MoveBackwards')) {
        if (has('MoveRight')) num5 = -1;
        else if (has('MoveLeft')) num5 = 1;
      } else if (has('MoveRight')) num5 = 1;
      else if (has('MoveLeft')) num5 = -1;
      state.TurnTarget = num5;
      state.MoveVectorTarget = vAdd(vScale([0, 0, 1], num3), vScale([1, 0, 0], num4));
      if ((state.TurnTarget > 0 && !CanTurnRight(boat)) || (state.TurnTarget < 0 && !CanTurnLeft(boat))) {
        state.TurnTarget = 0 - num5;
        state.TurnCurrent = state.TurnTarget;
      }
      const rudder = rudderOf(boat);
      if (rudder != null) {
        rudder.SetFloat('RowZ', state.inputCurrent[1]);
        rudder.SetFloat('RowX', state.inputCurrent[0]);
        rudder.SetFloat('RowSpeed', mathfClamp(f(vMagnitude(state.MoveVectorCurrent) / 20), f(0.2), 2));
      }
    } else {
      updateSails(boat);
    }
    state.TurnCurrent = mathfMoveTowards(state.TurnCurrent, f(state.TurnTarget * turnSpeed()), f(turnAccel() * dt()));
    state.velocityTarget = vScale(state.MoveVectorTarget, moveSpeed());
    state.MoveVectorCurrent = vMoveTowards(state.MoveVectorCurrent, state.velocityTarget, f(moveAccel() * dt()));
    // CSA-F: the wake (4737-4755) - played and the loops crossfaded to the fast one over the threshold, stopped and back
    // to the slow one under it, each while the loop it asks for is silent; its particles' life, size and drift
    const speed = vMagnitude(state.MoveVectorCurrent);
    if (speed >= wakeThreshold() && !boat.AudioSourceFast.isPlaying) {
      if (!DisableParticles()) boat.WakeEmitter.play();
      PlayFast(boat, true);
    } else if (speed < wakeThreshold() && !boat.AudioSourceSlow.isPlaying) {
      boat.WakeEmitter.stop();
      PlaySlow(boat, true);
    }
    const wakeScale = f(boat.WakeObject.localScale[0]);
    boat.WakeEmitterMain.startLifetimeMultiplier = mathfClamp(f(f(f(speed * f(0.2)) / HANDLING.moveSpeedSail) * wakeScale), 1, 10);
    boat.WakeEmitterMain.startSize = constantCurve(f(f(speed * f(0.2)) / HANDLING.moveSpeedSail));
    const forceOverLifetime = boat.WakeEmitter.forceOverLifetime;
    forceOverLifetime.space = SPACE.World;
    forceOverLifetime.x = constantCurve(f(f(f(state.currentVector[0]) * f(0.1)) / wakeScale));
    forceOverLifetime.z = constantCurve(f(f(f(state.currentVector[2]) * f(0.1)) / wakeScale));
    // CSA-G: the time keys (4757-4767), GetKeyDown each
    if (deps.input.started(BOAT_ACTIONS.timeScaleUp)) IncreaseTimeScale();
    if (deps.input.started(BOAT_ACTIONS.timeScaleDown)) DecreaseTimeScale();
    if (deps.input.started(BOAT_ACTIONS.timeScaleReset)) ResetTimeScale();
  }

  /** LateUpdate's sailing arm (4936-4956): the nodes and the collision when the boat moved, then the move.
   *  FIELD BUGS 2026-10-02 BEACH-READ (a departure): a beached boat's nodes are read again every frame she lies still, and
   *  the collision with them once she comes off. The C# reads them only when she moved, and a beached boat never moves -
   *  so a reading the ground has since put right (a pixel's carve come after it, a terrain built again) held her for good. */
  function lateUpdateSailing() {
    const boat = state.CurrentBoat;
    const t = boat.GameObject;
    const fwd = quatRotate(t.rotation, [0, 0, 1]);
    if (!vEquals(state.lastBoatPosition, t.position) || !vEquals(state.lastBoatDirection, fwd)) {
      state.lastBoatPosition = t.position.map(f);
      state.lastBoatDirection = fwd.map(f);
      UpdateCurrentBoatNodes();
    } else if (IsBeached(boat) && deps.playerTerrain() != null) {   // never the C#'s throw on a terrain not built, each frame
      UpdateBoatNodes(boat);
      if (!IsBeached(boat)) CheckCollision(boat);
    }
    if (!IsBeached(boat)) {
      let val = inverseTransformDirection(t, state.currentVector);
      if (!vEquals(state.CollisionVector, [0, 0, 0])) {
        // FIELD BUGS 2026-10-02 ROCK-AWAY (a departure): the response takes the way INTO what she met, as the C# does
        // - and her way off it, and the current's, the C# took too: a rock astern of a ship sailing away (or ahead of
        // one backing off) held her to the push's one metre a second for as long as it lay in her sweep's reach, a
        // hull's length and more. Under way away from it, she keeps her way; at rest, or into it, the C#'s push.
        if (vDot(state.MoveVectorCurrent, state.CollisionVector) <= 0) state.MoveVectorCurrent = vAdd(vProjectOnPlane(state.MoveVectorCurrent, state.CollisionVector), state.CollisionVector);
        if (vDot(val, state.CollisionVector) < 0) val = vProjectOnPlane(val, state.CollisionVector);
      }
      state.velocityCurrent = vAdd(state.MoveVectorCurrent, val);
      const before = t.worldMatrix();
      // Transform.Translate(velocityCurrent * dt) in the boat's own space, then Rotate(up * TurnCurrent * dt)
      const step = vScale(state.velocityCurrent, dt());
      setPositionChecked(t, vAdd(t.position, quatRotate(t.rotation, step).map(f)), log);
      setLocalRotationChecked(t, normalizeQ(quatMultiply(t.localRotation, quatAngleAxis(f(f(state.TurnCurrent) * dt()), V_UP))), log);
      carryChildren(boat, before);
    }
  }

  /** CSA-E: every boat's Animators, one step on Time.deltaTime (zero while paused - Unity's scale is nought then). */
  function animate() {
    const d = dt();
    for (const boat of state.AllBoats) for (const a of boatAnimators(boat)) a.update(d);
  }
  /** Update (4186-4800): the pause gate, then the helm, then the waves' frame; the coroutines' WaitForSeconds after
   *  it, as Unity resumes them once every Update has run. */
  function update({ paused = false } = {}) {
    updateBody(paused);
    runDelayedCalls();
  }
  function updateBody(paused) {
    if (paused) { state.wasPaused = true; return; }
    // TRAVEL-X1 (Satranath: "the menu says 10x ... but it's moving at 1x"): the latch is LateUpdate's, and LateUpdate
    // returns while paused - a journey BEGUN in the pause (the travel map's Begin, its resume) has had none to latch it,
    // so the first frame after read "not travelling" and put its x10 back to one. In Unity the click frame's own
    // LateUpdate latches it before this Update runs; the port's click lands between frames, so it is asked here
    if (state.wasPaused) latchTravelling();
    if (state.wasPaused && f(deps.timeScale?.() ?? 1) !== 1 && !state.isTravelling) ResetTimeScale();
    state.wasPaused = false;
    recoverLostBoats();   // FIELD BUGS 29h (LOST-BOAT): the port's own
    if (isSailing() && state.CurrentBoat != null) updateSailing();
    if (!waveOn() || animatedWaterWaves()) return;   // (4769) `!wave || waveObject == null || (AnimatedWater != null && AWVertexWaves)`
    const step = stepWaveFrame(state.waveFrameIndex, state.waveFrameTimer, waveFrameTimeOf(setting('Waves.Speed', 100)), dt(), WAVE_FRAME_COUNT, isDayHour(deps.hour?.() ?? 12));
    state.waveFrameIndex = step.index;   // material.SetTexture("_MainTex", waveFrames[waveFrameIndex]) - the host draws the index
    state.waveFrameTimer = step.timer;
  }
  /**
   * FIELD BUGS 29h (LOST-BOAT, the port's own; Julian: "my previous attempts at spawning in large boat deeds (before
   * today's patch) may have left the large boats floating underneath the town. When i travel to the town i can hear very
   * loud boat noises but no boats to be seen"): A BOAT THE PORT LOST IS GIVEN BACK. Before FIELD-CSA1 a placed boat could
   * be stood on the seabed, or left in an old frame's numbers by a respawn or a recentre - under the ground by the temple
   * its owner woke at - and the save keeps the place it stood, which the load restores as it was. Its loops play from
   * there whenever its pixel is near. So once the ground under a boat is built, it is asked ONCE: a hull whose place is
   * LOST_UNDER_M under the ground or under the sea's top is lost, and an uncrewed one (its deed spent on placing) is packed
   * into its parts - the mod's own PackBoat, the cargo with it - for the player to place again; a crewed hull's deed
   * still calls it to a port. Never a boat indoors (a dungeon's water is its own), nor the one being sailed.
   */
  function recoverLostBoats() {
    if (state.AllBoats.length < 1 || deps.isPlayerInside()) return;
    const t0 = deps.playerTerrain?.();
    if (t0 == null) return;
    for (const boat of [...state.AllBoats]) {
      if (boat.groundAsked || boat.inside || boat === state.CurrentBoat || !boat.GameObject?.activeSelf) continue;
      const p = boat.GameObject.position, o = t0.position;
      // the pixel under the boat, off the player's own: map x grows with the scene's x, map y against its z
      const t = deps.terrainAt(t0.mapPixelX + Math.floor((p[0] - o[0]) / TERRAIN_EDGE), t0.mapPixelY - Math.floor((p[2] - o[2]) / TERRAIN_EDGE));
      if (t == null) continue;   // its ground not built yet: asked when it is
      boat.groundAsked = true;
      const ground = f(f(t.position[1]) + f(t.sampleHeight(p)));
      if (!(ground > p[1] + LOST_UNDER_M || p[1] < seaTop() - LOST_UNDER_M) || boat.crewed) continue;
      deps.hudText('A boat of yours was lost where no one could reach it');
      PackBoat(boat, true);
    }
  }
  /** CSA-G: `if (TravelOptions != null)` its isTravelActive message (4921-4934), which Update's unpause reset reads;
   *  wasTravelling follows it and is read nowhere (kept). */
  function latchTravelling() {
    const travelling = deps.travelOptionsActive?.();
    if (travelling != null) {
      state.isTravelling = !!travelling;
      if (state.isTravelling && !state.wasTravelling) state.wasTravelling = state.isTravelling;
      if (!state.isTravelling && state.wasTravelling) state.wasTravelling = state.isTravelling;
    }
  }
  function runDelayedCalls() {
    if (!delayedCalls.length) return;
    const now = f(deps.time());
    const due = delayedCalls.filter((c) => now >= c.at);
    if (!due.length) return;
    delayedCalls = delayedCalls.filter((c) => now < c.at);
    for (const c of due) c.step();
  }
  /** LateUpdate (4802-5051): the pause gate; the helm's move; else the placing click (ActivateCenterObject's
   *  release, a fifth of a second after StartPlacing). Travel Options' message (CSA-G), the boats' bob and flag
   *  (CSA-F) and the water walk (CSA-I) are named where the C# runs them. */
  function lateUpdate({ paused = false, activateComplete = false } = {}) {
    animate();   // the Animators, after every Update and before every LateUpdate, as Unity steps them
    simulateParticles();   // CSA-F: then the particle systems (PreLateUpdate's ParticleSystemBeginUpdateAll)
    if (paused) return;
    latchTravelling();
    if (isSailing()) lateUpdateSailing();
    else if (state.placing && activateComplete && f(f(deps.time()) - f(state.placeTime)) > PLACE_CLICK_DELAY) {
      const hullFromMessage_ = hullFromMessage(state.placeItem.message);
      const variantFromMessage_ = variantFromMessage(state.placeItem.message);
      log(`COME SAIL AWAY - ITEM HULL IS ${hullFromMessage_}`);
      log(`COME SAIL AWAY - ITEM VARIANT IS ${variantFromMessage_}`);
      PlaceBoatAtRayHit(hullFromMessage_, variantFromMessage_);
    }
    lateUpdateBoats();
  }
  /** CSA-F: every boat's particle systems, one step on Time.deltaTime (an inactive one stands still, as Unity's). */
  function simulateParticles() {
    const d = dt();
    for (const boat of state.AllBoats) for (const system of (boat.particleSystems ??= boatParticleSystems(boat))) system.step(d);
  }
  /** LateUpdate's boats (4958-5042): each active one's bob - rolled into its turn at the helm, rocked by the wind, the
   *  roll not scaled by modifierAnimation (the C#'s precedence, kept) - and its flag streaming down the wind less the
   *  boat's way. CSA-I: first, whether the player stands in the hull's collider box - its mesh's own bounds, the
   *  player taken into the hull's space before this frame's bob, its height the box's centre's without Iliac Puddle
   *  No More (the box a column) - and after the boats the water walk started or ended on the answer. CSA-J: Animated
   *  Water's arm (4991-5026, its getWaveHeights on the five nodes) is never taken - ANIMATED_WATER is null. */
  function lateUpdateBoats() {
    let flag = false;
    const ctx = { models: deps.pool.models };
    for (let i = 0; i < state.AllBoats.length; i++) {
      const boat = state.AllBoats[i];
      if (!boat.GameObject.activeSelf) continue;
      const bounds = meshLocalBounds(ctx, boat.MeshCollider.m_Mesh);   // MeshCollider.sharedMesh.bounds
      const val2 = boat.MeshObject.inverseTransformPoint(deps.player().position).map(f);
      if (!deps.iliacPuddleNoMore()) val2[1] = f(bounds.center[1]);
      if (boundsContains(bounds, val2)) flag = true;
      if (!IsBeached(boat)) {
        const magnitude = vMagnitude(state.windVectorCurrent);
        let num = 0;
        if (boat === state.CurrentBoat) {
          const m = vMagnitude(state.MoveVectorCurrent);
          num = m < wakeThreshold() ? 0 : f(f(state.TurnCurrent / HANDLING.turnSpeedSail) * f(f(m * f(0.1)) / HANDLING.moveSpeedSail));
        }
        // `if (AnimatedWater != null && AWVertexWaves && timeScaleIndex == 0)` - never here (ANIMATED_WATER); its else:
        let num2 = f(f(deps.time()) + i);
        num2 = f(num2 / TIME_SCALES[state.timeScaleIndex]);
        const roll = f(mathfClamp(f(f(0 - num) * 5), -30, 30) + f(f(Math.sin(f(f(num2 * f(0.5)) * magnitude))) * magnitude));
        const pitch = f(f(f(Math.sin(f(num2 * magnitude))) * magnitude) * f(boat.modifierAnimation));
        boat.MeshObject.localRotation = quatEuler(pitch, 0, roll);   // localEulerAngles = forward * roll + right * pitch
      }
      if (boat.FlagObject != null) {
        const val6 = vAdd(state.windVectorCurrent, vScale(quatRotate(boat.GameObject.rotation, vScale(state.MoveVectorCurrent, -1)).map(f), f(0.1)));
        boat.FlagObject.rotation = quatLookRotation(vNormalized(val6));   // transform.forward = val6.normalized
        boat.FlagEmitterMain.startSpeed = constantCurve(f(vMagnitude(val6) * f(0.5)));
      }
    }
    const walking = !!deps.effects?.isWaterWalking();
    if (flag && !walking) StartWaterwalking();
    else if (!flag && walking) EndWaterwalking();
  }
  /**
   * FixedUpdate (5053-5198): every active enemy with a controller, a ray down its own height from its transform; one
   * grounded on a boat's hull collider rides that hull (SetParent(MeshObject)), any other back to the scene's parent.
   * Then, only with the waves, the current (CSA-F): along the wind at half its strength, or - once any pixel in range
   * was found water, a mesh laid or not - toward whichever land neighbour the player's quarter of their pixel faces (the
   * last water pixel's, kept),
   * reversed where that pixel's own middle is land and again by night; OnUpdateCurrent when it changed.
   */
  function fixedUpdate({ paused = false } = {}) {
    if (paused) return;
    if (state.AllBoats.length > 0) {
      const enemies = deps.enemies?.() ?? [];
      // a destroyed enemy is no child of anything: the port's foes are handles, dropped when the host stops naming them
      const live = new Set(enemies.map((e) => e.key));
      for (const k of [...state.parentedObjects.keys()]) if (!live.has(k)) state.parentedObjects.delete(k);
      for (const enemy of enemies) {
        if (!enemy.hasController) continue;
        const hit = deps.raycast(enemy.position(), [0, -1, 0], f(enemy.height), { triggers: true });
        const parent = state.parentedObjects.get(enemy.key)?.boat ?? null;
        if (hit) {
          let boat = null;
          for (const allBoat of state.AllBoats) {
            if (hit.node != null && hit.node === allBoat.MeshObject && hit.collider === allBoat.MeshCollider) { boat = allBoat; break; }
          }
          if (boat != null && enemy.grounded()) {
            if (parent !== boat) state.parentedObjects.set(enemy.key, { enemy, boat });   // SetParent(boat.MeshObject.transform)
          } else if (parent != null) state.parentedObjects.delete(enemy.key);   // SetParent(bestParent)
        } else if (parent != null) state.parentedObjects.delete(enemy.key);
        if (state.parentedObjects.has(enemy.key)) state.parentedObjects.get(enemy.key).enemy = enemy;
      }
    }
    // CSA-F: the current (5147-5198) - only with the waves
    if (!waveOn() || animatedWaterWaves()) return;   // (5147) the same gate as Update's
    const night = !isDayHour(deps.hour?.() ?? 12);   // WorldTime.Now.IsNight
    const N = state.currentNeighbors;
    if (N != null) {
      const position = deps.player().position;
      let num = f(state.windVectorCurrent[0]);
      if (position[0] > f(614.4) && N[2][1]) num = 1;
      else if (position[0] < f(204.8) && N[0][1]) num = -1;
      let num2 = f(state.windVectorCurrent[2]);
      if (position[2] > f(614.4) && N[1][0]) num2 = 1;
      else if (position[2] < f(204.8) && N[1][2]) num2 = -1;
      state.currentVector = vScale(vScale(vNormalized([num, 0, num2]), vMagnitude(state.windVectorCurrent)), f(0.5));
      if (N[1][1]) state.currentVector = vScale(state.currentVector, -1);
      if (night) state.currentVector = vScale(state.currentVector, -1);
    } else if (deps.blockWaterLevel() !== NO_WATER_LEVEL) state.currentVector = [0, 0, 0];
    else state.currentVector = vScale(state.windVectorCurrent, f(0.5));
    if (!vEquals(state.currentVector, state.currentVectorPrevious)) {
      raise('OnUpdateCurrent', [...state.currentVector]);
      state.currentVectorPrevious = [...state.currentVector];
    }
  }

  // ── the seven activations (5429-5590) ──
  /** The boat a hit's root is (the C#'s GetInstanceID walk). */
  const boatOfHit = (hit) => state.AllBoats.find((b) => hit?.root != null && hit.root === b.GameObject) ?? null;
  /** ActivateRudder (5450-5489): Steal mode packs the boat (PackBoat); otherwise the helm taken or left. */
  function ActivateRudder(hit, mode) {
    const boat = boatOfHit(hit);
    if (boat == null) return;
    if (mode === 'steal') {   // PlayerActivateModes.Steal (0)
      if (boat.packable) {
        if (state.CurrentBoat != null && state.CurrentBoat === boat) deps.midScreenText('You cannot pack a boat you are driving!', 1.5);
        else if ((deps.passengersAboard?.(boat) ?? 0) > 0) deps.midScreenText(PASSENGERS_ABOARD_TEXT, 1.5);   // CSA-K (DECLARED): the driver's refusal, for a deck another player stands on - a pack would drop them in the sea
        else if (deedMissing(boat)) deps.midScreenText(DEED_NOT_HELD_TEXT, 1.5);   // SHIP-PACK: a deed ship goes with her deed
        else PackBoat(boat, true);   // PackBoat(boat, item: true)
      }
    } else if (isSailing() && boat === state.CurrentBoat) StopSailingDelayed();
    else StartSailing(boat);
  }
  /** BoardBoat (5429-5448): stood at the sibling before the trigger, facing its forward, set on the ground below. */
  function BoardBoat(hit) {
    const boat = boatOfHit(hit);
    if (boat == null) return;
    const at = boardPlaceOf(hit.node);
    deps.helm.setPlayerPosition(at.position);
    deps.helm.setFacing(at.yaw, 0);   // SetHorizontalFacing(child.forward)
    deps.helm.alignToGround?.(3);   // GameObjectHelper.AlignControllerToGround(controller, 3f)
  }
  /** TriggerDoor (5542-5572): the door the trigger hangs under, its Animator's Opened turned over. */
  function TriggerDoor(hit) {
    const boat = boatOfHit(hit);
    if (boat == null) return;
    turnDoor(hit.node);
  }
  /** TriggerDoor's arm past the boat's lookup: the Animator over the trigger turned over, and its sound. CSA-K: a door on
   *  another player's boat turns over through the same statements (for the one who pressed it - DECLARED). */
  function turnDoor(triggerNode) {
    const component = animatorOf(triggerNode.parent);
    if (component != null) {
      const bool = component.GetBool('Opened');
      component.SetBool('Opened', !bool);
      deps.audio?.dfClipAtPoint?.(bool ? 93 : 94, [...triggerNode.position], 1);   // boat.DFAudioSource.PlayClipAtPoint(bool ? 93 : 94, hit.transform.position, 1f)
    }
  }
  /** CheckBoatStatus (5508-5523). */
  function CheckBoatStatus(hit) {
    if (boatOfHit(hit) != null) deps.messageBox?.(NICE_BOAT_TEXT);
  }
  /** PlayerActivate's custom activation for one of the seven: within 3.2 of the ray it runs, farther it does not. */
  function activate(modelId, hit, mode) {
    if (!(hit.distance <= ACTIVATION_DISTANCE)) return false;
    switch (ACTIVATIONS[modelId]) {
      case 'ActivateRudder': ActivateRudder(hit, mode); break;
      case 'BoardBoat': BoardBoat(hit); break;
      case 'CheckBoatStatus': CheckBoatStatus(hit); break;
      case 'TriggerDoor': TriggerDoor(hit); break;
      case 'OpenBoatCargo': OpenBoatCargo(hit); break;   // CSA-H
      case 'PickVariant': PickVariant(hit); break;   // CSA-H
      case 'CheckBoatPosition': CheckBoatPosition(hit); break;   // CSA-I
      default: break;
    }
    return true;
  }

  // ── CSA-H: the items, the cargo, the variants and the ports ──
  /** portSearchRange (276): LoadSettings' Controls/PortLocationSearchRange (823), read live. */
  const portSearchRange = () => Number(setting('Controls.PortLocationSearchRange', 3)) | 0;
  /**
   * IsNearPort (1095-1117): a location with a port within the square round the player's pixel. FIELD BUGS 29h
   * (DEED-PORT, the port's own; Swordsman: "I have been ALL over the coast trying to drop my boat at a port ... it
   * tells me I'm not near a port"; Mac: "Dont worry abour DFU"): the square is CENTRED on the player now, `range`
   * pixels every way. The C#'s loops ran from X - range while `< X + range - 1` - range pixels west and north, range - 2
   * east and south - so a port two pixels east or south was never near, and a range of 1 never asked the player's own.
   */
  function IsNearPort(range = 3) {
    const currentMapPixel = deps.currentMapPixel();
    for (let i = currentMapPixel.X - range; i <= currentMapPixel.X + range; i++) {
      for (let j = currentMapPixel.Y - range; j <= currentMapPixel.Y + range; j++) {
        if (deps.isPortTown?.(i, j)) return true;
      }
    }
    return false;
  }
  /** DEED-PORT: a refusal for want of a port says where one is - the host's nearest (`deps.nearestPort`: its name and
   *  the way to it), the mod's own line alone where the host names none; long enough on screen to be read. */
  function sayNoPort(text) {
    const near = deps.nearestPort?.() ?? null;
    if (near) deps.midScreenText(`${text}. The nearest port is ${near.name}, to the ${near.way}`, f(4));
    else deps.midScreenText(text, f(1.5));
  }
  /**
   * PackBoat (6130-6158): as an item, the boat's parts - `hull * 10 + variant`, the hull's price and weight, its name
   * - and a cargo aboard moved whole into PackedCargoes under the parts' UID, its weight on the parts; the parts to
   * the back of the pack. Then the boat is gone: its pixel nulled, its object destroyed, its record off the list.
   * SHIP-PACK (2026-10-01, the review before the merge: "Allow larger ships to be picked up, just like smaller vessels" -
   * the port's own): EVERY HULL PACKS, AND HER PARTS ARE HER.
   * - A DEED SHIP (crewed, her deed's number on her) is packed only with that deed in the pack, and the deed goes with
   *   her - her parts stand for her now, and give it back when she is placed (takePlaceItem). Without it nothing is done
   *   and false answers (`deedMissing`): a deed kept elsewhere would call a second ship of hers to a port.
   * - HER NUMBER: the parts keep her UID, where the C# minted a new one - her naval state (navalHost.js myBoatState), her
   *   crew's names and her hands ashore (crewCompanions.js) are hers again when she stands; under a new number every
   *   ship stood anew, mended and fully crewed. The spent PackedCargoes entry takePlaceItem leaves under it is refilled,
   *   where any other key already held throws, as the C#'s Dictionary.Add does - and now before the hold has moved.
   * - HER WORTH: what placed her (`itemValue` - her deed's or her parts'; a claimed prize's papers, a quarter of her
   *   hull's price), the hull's price only for a boat no item placed; her weight packedHullWeight's (a ship's no more
   *   than the Large Boat's).
   * Answers whether she was packed.
   */
  function PackBoat(boat, item = false) {
    if (item) {
      const deed = boat.crewed && boat.uid ? deedInPack(boat.uid) : null;
      if (boat.crewed && boat.uid && deed == null) return false;
      deps.hudText('You store the boat in your inventory');
      const val = deps.items.create(BOAT_PARTS_TEMPLATE);
      if (boat.uid) val.UID = boat.uid;   // SHIP-PACK: her number
      val.message = boatItemMessage(boat.hull, boat.variant);
      val.value = Number.isFinite(boat.itemValue) ? boat.itemValue : HULL_PRICES[boat.hull];   // SHIP-PACK: her worth
      val.weightInKg = packedHullWeight(boat.hull);
      val.name = boatItemName(val.name, boat.hull, boat.variant);
      if (boat.Cargo.Items.length > 0) {
        const weight = f(deps.cargoWeight(boat.Cargo.Items));   // ItemCollection.GetWeight
        const key = cargoKey(val.UID);
        // Dictionary.Add's throw - SHIP-PACK: asked before the hold moves, and the spent entry takePlaceItem leaves under
        // her own number (emptied and kept) hers to fill again
        if (state.PackedCargoes.has(key) && !(boat.uid && state.PackedCargoes.get(key).length === 0)) throw new Error(`ArgumentException: An item with the same key has already been added. (${key})`);
        const val3 = [];
        transferAll(boat.Cargo.Items, val3);   // val3.TransferAll(boat.Cargo.Items): from the hold into the packed collection
        val.weightInKg = f(val.weightInKg + weight);
        state.PackedCargoes.set(key, val3);
      }
      if (deed) removeItem(deps.items.player(), deed);   // SHIP-PACK: her deed goes with her
      deps.items.addToPlayer(val);   // AddItem(val, AddPosition.Back)
    }
    boat.MapPixel = null;
    deps.pool.remove(boat);   // Object.Destroy(boat.GameObject)
    const i = state.AllBoats.indexOf(boat);
    if (i >= 0) state.AllBoats.splice(i, 1);
    return true;
  }
  /** SHIP-PACK: a deed in the player's pack by its number (the host's pack, `deps.items.player`), or null. */
  const deedInPack = (uid) => (deps.items?.player?.() ?? []).find((it) => it?.templateIndex === BOAT_DEED_TEMPLATE && it.UID === uid) ?? null;
  /** SHIP-PACK: whether a ship waits on her deed to be picked up - crewed, placed by a deed (her number on her), and that
   *  deed not in the pack. A boat no item placed (number 0) packs without one. */
  const deedMissing = (boat) => !!boat?.crewed && !!boat.uid && deedInPack(boat.uid) == null;
  /** OpenCargo (6521-6525): the inventory over the boat's cargo, as a loot target. */
  function OpenCargo(boat) { deps.openCargo?.(boat.Cargo); }
  /** OpenBoatCargo (5575-5587): the boat the box hangs under, its cargo opened - OpenCargo(null) throws there when
   *  none is (kept: the box is always a boat's). */
  function OpenBoatCargo(hit) { OpenCargo(boatOfHit(hit)); }
  /** PickVariant (5491-5506): the boat's variant picker, never at the helm. */
  function PickVariant(hit) {
    const boat = boatOfHit(hit);
    if (boat != null && !isSailing()) OpenBoatVariantPicker(boat);
  }
  /** OpenBoatVariantPicker (1310-1334): refused without variants or a port nearby; else one row per variant, by its
   *  number, over the top window. */
  function OpenBoatVariantPicker(boat) {
    if (boat.VariantObject == null || boat.GetVariantCount < 1) { deps.midScreenText('This boat has no variants', f(1.5)); return; }
    if (!IsNearPort(portSearchRange())) { sayNoPort('There is no port nearby'); return; }
    state.variantBoatTarget = boat;
    const rows = [];
    for (let i = 0; i < boat.GetVariantCount; i++) rows.push(String(i));
    deps.openListPicker?.(rows, (index) => OpenBoatVariantPicker_OnItemPicked(index));
  }
  /** OpenBoatVariantPicker_OnItemPicked (1336-1342): the click sound, the picker popped, the variant set. */
  function OpenBoatVariantPicker_OnItemPicked(index) {
    deps.audio?.uiOneShot?.(360);   // DaggerfallUI.Instance.PlayOneShot((SoundClips)360)
    deps.popWindow?.();
    deps.pool.setVariant(state.variantBoatTarget, index);   // SetBoatVariant(variantBoatTarget, index)
    state.variantBoatTarget = null;
  }
  /** ItemBoatParts.UseItem (ItemBoatParts.cs:31-46): refused in a dry interior; else the inventory closed and the
   *  boat placed from these parts. */
  function useBoatParts(item, collection) {
    deps.log('COME SAIL AWAY - USING BOAT PARTS!');
    if (deps.isPlayerInside() && deps.blockWaterLevel() === NO_WATER_LEVEL) return false;
    deps.closeInventory?.();
    StartPlacing(item, collection);
    return true;
  }
  /**
   * ItemBoatDeed.UseItem (ItemBoatDeed.cs:31-60): refused indoors; the inventory closed; the boat this deed placed,
   * if it stands on another pixel, answers only with a port nearby, and a deed with no boat placed wants a port too;
   * else the deed places (or repositions) its boat. The log line is the parts' (kept).
   */
  function useBoatDeed(item, collection) {
    deps.log('COME SAIL AWAY - USING BOAT PARTS!');
    if (deps.isPlayerInside()) return false;
    deps.closeInventory?.();
    const placedBoatWithUID = GetPlacedBoatWithUID(item.UID);
    if (placedBoatWithUID != null) {
      const here = deps.currentMapPixel();
      if ((placedBoatWithUID.MapPixel?.X !== here.X || placedBoatWithUID.MapPixel?.Y !== here.Y) && !IsNearPort(portSearchRange())) {
        sayNoPort('There is no port nearby or ship is in another location');
        return false;
      }
    } else if (!IsNearPort(portSearchRange())) {
      sayNoPort('There is no port nearby');
      return false;
    }
    StartPlacing(item, collection);
    return true;
  }
  // ── CSA-I: the position reading (5525-5541, 5589-5780) and OnGUI's map and values (4089-4182) ──
  const mapRestrictTime = () => setting('Map.RestrictPositionReadingTime', true) !== false;
  const mapRestrictWeather = () => setting('Map.RestrictPositionReadingWeather', true) !== false;
  const mapMarkerClickRange = () => Number(setting('Map.ClickRangeThreshold', 5));
  const mapLineThickness = () => Number(setting('Map.PositionLineThickness', 2));
  const mapMarkerThickness = () => Number(setting('Map.MarkerThickness', 2));
  const mapMarkerOutlineThickness = () => Number(setting('Map.MarkerOutlineThickness', 2));
  const mapBackdropOpacity = () => f(Number(setting('Map.BackdropOpacity', 50)) * f(0.01));
  const debugShow = () => !!setting('Debug.ShowValues', false);
  /** mapLineThicknessFinal, mapMarkerThicknessFinal, mapMarkerOutlineThicknessFinal (670-705): nought while Left
   *  Shift is held (GetKey(LeftShift, true)), else the setting. */
  const thicknessFinal = (v) => (deps.input?.key?.('LeftShift') ? 0 : v);
  /** CheckBoatPosition (5525-5541): the boat the box hangs under, its position read. */
  function CheckBoatPosition(hit) {
    const boat = boatOfHit(hit);
    if (boat != null) StartShowBoatPosition(boat);
  }
  /** StartShowBoatPosition (5589-5596): one reading at a time - another waits for the running one to end. */
  function StartShowBoatPosition(boat) {
    if (state.showingBoatPosition == null) {
      state.showingBoatPosition = ShowBoatPositionCoroutine(boat);
      startCoroutine(state.showingBoatPosition);
    }
  }
  /**
   * ShowBoatPositionCoroutine (5598-5679), a frame's end at a time: the instruments' box, and a wait while a message
   * box is the top window; then, the weather Sunny or Cloudy and the hour 11, 12, 23 or 0 (each only on its
   * restriction's setting), a reading got - else the no-good box and its wait; the map up; then every frame until it
   * is put away the game paused under it when it is not, the number row's 1 to 8 picking the marker colour, the left
   * button placing a marker and the right removing one, Escape's release unpausing and putting the map away; and a
   * second of game time more before another reading may start (kept). The boat is not read (kept).
   */
  function ShowBoatPositionCoroutine(boat) {
    let phase = 'start';
    return () => {
      for (;;) {
        switch (phase) {
          case 'start':
            deps.messageBox('According to my instruments...');
            phase = 'box';
            return true;   // yield return new WaitForEndOfFrame()
          case 'box':
            if (deps.topWindowIsMessageBox()) return true;
            phase = 'read';
            return true;   // the yield after the wait
          case 'read': {
            const weather = deps.weatherType?.() ?? WEATHER_TYPE.Sunny;
            const hour = deps.hour?.() ?? 12;
            if ((!mapRestrictWeather() || weather < WEATHER_TYPE.Overcast) && (!mapRestrictTime() || (hour > 10 && hour < 13) || hour > 22 || hour < 1)) {
              state.mapShowingPosition = true;
              phase = 'show';
              return true;
            }
            state.mapShowingPosition = false;
            deps.messageBox("...no good. I can't get a reading at this time.");
            phase = 'noGood';
            return true;
          }
          case 'noGood':
            if (deps.topWindowIsMessageBox()) return true;
            phase = 'show';
            continue;
          case 'show':
            state.mapShowing = true;
            phase = 'loop';
            return true;
          case 'loop':
            if (!state.mapShowing) {
              delayedCalls.push({ at: f(f(deps.time()) + 1), step: () => { state.showingBoatPosition = null; } });   // yield return new WaitForSeconds(1f)
              return false;
            }
            mapShowingFrame();
            return true;
          default:
            return false;
        }
      }
    };
  }
  /** The coroutine's loop body (5626-5673). */
  function mapShowingFrame() {
    if (!deps.gamePaused()) deps.map.open();   // if (!GameManager.IsGamePaused) PauseGame(true, true)
    for (let k = 0; k < 8; k++) if (deps.input.keyDown(`Alpha${k + 1}`)) state.mapMarkerMode = k;
    if (deps.input.keyDown('Mouse0')) LeftClickOnMap();
    if (deps.input.keyDown('Mouse1')) RightClickOnMap();
    if (deps.input.keyUp('Escape')) {
      deps.map.close();   // PauseGame(false, false)
      StopShowBoatPosition();
    }
  }
  /** IsPositionMarked (5681-5693): a marker on the pixel already. */
  const IsPositionMarked = (pos) => state.mapMarkers.some((m) => m.position[0] === pos[0] && m.position[1] === pos[1]);
  /** The map's rect and the mouse over it, as LeftClickOnMap and RightClickOnMap both take them (5708-5714, 5740-5746). */
  function mapUnderMouse() {
    const sr = deps.screenRect();
    const r = mapRect(sr, screenScaleOf(sr));
    const val2 = guiMouse(sr, deps.mousePosition());
    return guiRectContains(r, val2) ? mapPixelUnder(r, val2) : null;
  }
  /** LeftClickOnMap (5706-5736): over the map, a marker on the pixel under the mouse unless one is there - labelled
   *  with it and the day ("(x, y) - 5th of Morning Star"), in the marker colour picked. */
  function LeftClickOnMap() {
    const val3 = mapUnderMouse();
    if (!val3) return;
    log(`COME SAIL AWAY - MOUSE IS OVER MAP PIXEL (${val3[0]}, ${val3[1]})`);
    if (!IsPositionMarked(val3)) {
      const d = deps.date();
      const newLabel = markerLabel(val3, dayOfMonthWithSuffix(d.day), monthNames()[d.month]);
      state.mapMarkers.push({ position: val3, label: newLabel, color: { ...MAP_MARKER_MODE_COLORS[state.mapMarkerMode] } });
    }
  }
  /** RightClickOnMap (5738-5776): over the map, the nearest marker within the click range removed - walked from the
   *  last, so of two as near the later stays first found (kept). */
  function RightClickOnMap() {
    const val3 = mapUnderMouse();
    if (!val3) return;
    log(`COME SAIL AWAY - MOUSE IS OVER MAP PIXEL (${val3[0]}, ${val3[1]})`);
    let num4 = Infinity;
    let num5 = -1;
    for (let num6 = state.mapMarkers.length - 1; num6 > -1; num6--) {
      const num3 = vector2IntDistance(state.mapMarkers[num6].position, val3);
      if (num3 <= mapMarkerClickRange() && num3 < num4) { num4 = num3; num5 = num6; }
    }
    if (num5 !== -1) state.mapMarkers.splice(num5, 1);
  }
  /** StopShowBoatPosition (5778-5781). */
  function StopShowBoatPosition() { state.mapShowing = false; }
  /** OnGUI's map (4113-4163) while it is up - systems/comeSailAwayMap.js mapOverlayDraws over this frame's state.
   *  @param {{ screenRect: { x?: number, y?: number, width: number, height: number }, screen: number[], unscaledTime: number }} o */
  function mapOverlay({ screenRect, screen, unscaledTime }) {
    if (!state.mapShowing) return null;
    const here = deps.currentMapPixel();
    return mapOverlayDraws({
      screenRect, screen, scale: screenScaleOf(screenRect), mouse: guiMouse(screenRect, deps.mousePosition()), unscaledTime,
      showingPosition: state.mapShowingPosition, pixel: [here.X, here.Y], markers: state.mapMarkers, markerMode: state.mapMarkerMode,
      opacity: mapBackdropOpacity(), lineThickness: thicknessFinal(mapLineThickness()), markerThickness: thicknessFinal(mapMarkerThickness()),
      outlineThickness: thicknessFinal(mapMarkerOutlineThickness()), markerThicknessRaw: mapMarkerThickness(), clickRange: mapMarkerClickRange(),
    });
  }
  /** OnGUI's debug values (4177-4182): at the helm, unpaused and not loading, with Debug/ShowValues on - the boat's
   *  speed, the speed it makes for and the wind's strength (Single.ToString()), at scale 5 in red, green and blue from
   *  the screen's corner, their shadows two pixels off. */
  function debugValues({ paused = false, loading = false } = {}) {
    if (paused || loading || !isSailing() || !debugShow()) return null;
    const shadowPos = [DAGGERFALL_DEFAULT_SHADOW_POS[0] * 2, DAGGERFALL_DEFAULT_SHADOW_POS[1] * 2];
    const text = (v, x, y, color) => ({ kind: 'text', text: csFloatString(vMagnitude(v)), x, y, scale: 5, color, shadow: COLOR_BLACK, shadowPos });
    return [text(state.velocityCurrent, 0, 0, COLOR_RED), text(state.velocityTarget, 500, 0, COLOR_GREEN), text(state.windVectorCurrent, 0, 50, COLOR_BLUE)];
  }
  /** StartWaterwalking (5966-6011): with an effect manager and no live bundle of the name, a Spell of one
   *  WaterWalkingSilent effect on the caster alone - DurationBase 90000, DurationPlus 0, DurationPerLevel 1 - assigned
   *  past the saving throws (AssignBundleFlags 2). */
  function StartWaterwalking() {
    const fx = deps.effects;
    if (!fx) return;
    if (fx.bundleNames().includes(BOAT_EFFECT_BUNDLE)) return;
    fx.assignBundle({ name: BOAT_EFFECT_BUNDLE, bundleType: 'Spell', targetType: 'CasterOnly', effectKey: WATER_WALKING_SILENT,
      durationBase: 90000, durationPlus: 0, durationPerLevel: 1, bypassSavingThrows: true });
  }
  /** EndWaterwalking (6013-6029): the first live bundle named "I'm On A Boat" or "Jesus Mode" removed. A water walk
   *  any other bundle gives is left, and the removal asked for again every frame it lasts off a boat (kept). */
  function EndWaterwalking() {
    const fx = deps.effects;
    if (!fx) return;
    const name = fx.bundleNames().find((n) => n === BOAT_EFFECT_BUNDLE || n === JESUS_MODE_BUNDLE);
    if (name != null) fx.removeBundle(name);
  }
  /** GiveMeBoat.Execute (48-89): a deed - a random hull of the first four with none (the Large Boat a random
   *  variant of seven), the hull given, or both - named and to the back of the pack. */
  function consoleGiveBoat(args) {
    const text = "Boat deed added to player's inventory";
    let num = 0;
    let num2 = 0;
    if (args.length === 0) {
      num = random.range(0, 4);
      if (num === 1) num2 = random.range(0, 7);
    } else if (args.length === 1) {
      num = convertToInt32(args[0]);
      if (num === 1) num2 = random.range(0, 7);
    } else if (args.length === 2) {
      num = convertToInt32(args[0]);
      num2 = convertToInt32(args[1]);
    }
    const val = deps.items.create(BOAT_DEED_TEMPLATE);
    val.message = boatItemMessage(num, num2);
    val.name = boatItemName(val.name, num, num2);
    deps.items.addToPlayer(val);
    return text;
  }

  // ── the events that end a sail (1921-1976, 2089-2096, 2126-2132) ──
  /** OnStartLoad (1921-1939): the parented enemies go (the port's load rebuilds its foes), the helm is left. */
  function OnStartLoad() {
    state.parentedObjects.clear();
    if (isSailing()) StopSailing();
    else if (state.disembarking != null) EndDisembark();   // AUDIT PRE-MERGE 0928 S1: a disembark in flight ends with the load's start, as a sail under way does
    else ResetTimeScale(false);
  }
  /** AUDIT PRE-MERGE 0928 S1: the Disembark key's coroutine, ended by a load's start - StopSailing past its head (the
   *  key ran the head): the helm let go, the freeze lifted, OnUpdateSailing(false). Left running, it held the loaded
   *  player at the helm of the boat the save's restore destroyed, and its `disembarking` shut the helm a save made at
   *  the helm restored until the freeze ran out. The C#'s OnStartLoad stops only a sail its IsSailing sees. */
  function EndDisembark() {
    const co = state.disembarking;
    state.disembarking = null;   // its queued step ends at its next turn (resumeStopSailing)
    stopSailingTail(co.boatlast);
  }
  /** OnPreFastTravel (1952-1971): placing stops; a packable boat sailed is packed (PackBoat) - SHIP-PACK: a ship too,
   *  her deed in the pack (without it PackBoat packs nothing, and she stays where she lies, as a ship always did). */
  function OnPreFastTravel() {
    if (state.placing) StopPlacing();
    if (isSailing()) {
      const currentBoat = state.CurrentBoat;
      StopSailing();
      if (currentBoat.packable) PackBoat(currentBoat, true);
    } else ResetTimeScale(false);
  }
  /** OnPostFastTravel (1973-1976, CSA-J's audit): the arrival puts the scale back to one, saying nothing. */
  function OnPostFastTravel() {
    ResetTimeScale(false);
  }
  /** OnPlayerDeath (2089-2099) - the entity's OnDeath and OnExhausted alike. */
  function OnPlayerDeath() {
    if (isSailing()) StopSailing();
    else ResetTimeScale(false);
  }
  /** OnNewMagicRound (2126-2132). */
  function OnNewMagicRound() {
    if (isSailing()) UpdateBoatCargoMod(state.CurrentBoat);
  }

  function StartPlacing(item, itemCollection) {
    if (!state.placing) {
      state.placing = true;
      state.placeTime = deps.time();
      state.placeItem = item;
      state.placeItemCollection = itemCollection;
      deps.midScreenText('Place the boat in water', 3);
    }
  }
  function StopPlacing() {
    state.placing = false;
    state.placeItem = null;
  }

  /** SpawnBoat, through the pool; CSA-G: the RudderAnimationEventListener GetBoatTransforms put on the rudder (1748)
   *  answers the oars' three animation events as the C#'s does - into ComeSailAway.Instance. */
  function SpawnBoat(boat) {
    const p = deps.player();
    const spawned = deps.pool.spawnNow(boat, { position: [...p.position], rotation: [...p.rotation] });
    const listener = boat.RudderObject?.getComponent?.('RudderAnimationEventListener');
    if (listener) {
      listener.OarEvent_In = () => OarEvent_In();
      listener.OarEvent_Sweep = () => OarEvent_Sweep();
      listener.OarEvent_Out = () => OarEvent_Out();
    }
    return spawned;
  }
  /** GameObject.SetActive on a boat's root, with what Unity does to the two loops on it (CSA-G): an AudioSource stops as
   *  its object goes inactive, and one left at AddComponent's playOnAwake (true - SpawnBoat never clears it) plays again
   *  as the object comes back, at the volume it last had (kept: the fast loop's may be its first, 1). */
  function setBoatActive(boat, on) {
    boat.GameObject.setActive(on);
    for (const src of [boat.AudioSourceSlow, boat.AudioSourceFast]) {
      if (!src) continue;
      if (on) { if (src.playOnAwake !== false && src.clip != null) audioPlay(src); }
      else if (src.isPlaying) audioStop(src);
    }
  }

  /** PlaceBoat(Vector3, Vector3, int hull, int variant, Terrain) (6159-6169). */
  function PlaceBoat(position, direction, hull = 0, variant = 0, terrain = null) {
    const boat = new Boat(hull, variant);
    SpawnBoat(boat);
    state.AllBoats.push(boat);
    SetBoatPositionAndDirection(boat, position, direction, terrain);
    PlaySlow(boat);
    return boat;
  }
  /**
   * OWS2 (the port's own - bible/06-Systems/Travel-View.md "OWS - the sea"; the player's ask: "You should transition to
   * your boat if traveling across water"): A JOURNEY'S LAUNCH. The placing click's terrain arm (a Terrain whose tile
   * under the point is water: "Boat placed!", PlaceBoat, the item's half - its UID, its packed cargo aboard, the parts
   * spent) aimed by the Overworld's journey where the camera's ray would land - `position` on the water, the bow along
   * `direction` - for a packable boat's PARTS alone (a deed's boat stands where a port put it). What the click would
   * have been placing is let go first. Returns the boat, or null for an item that is not parts.
   */
  function LaunchFromParts(item, itemCollection, position, direction, terrain = null) {
    if (item?.templateIndex !== BOAT_PARTS_TEMPLATE) return null;
    if (state.placing) StopPlacing();
    state.placeItem = item;
    state.placeItemCollection = itemCollection;
    deps.hudText('Boat placed!');
    const boat = PlaceBoat([...position], [...direction], hullFromMessage(item.message), variantFromMessage(item.message), terrain);
    takePlaceItem(boat);
    StopPlacing();
    return boat;
  }
  /**
   * SHIP-CLAIM (2026-10-01, the port's own - bible/03-World/Naval-Combat.md SHIP-CLAIM): A DEED'S BOAT STOOD WHERE A
   * PRIZE LIES. LaunchFromParts' sibling for a DEED: the placing click's own two halves - PlaceBoat, then the item's
   * (takePlaceItem: the deed's UID on her, so the deed answers her - GetPlacedBoatWithUID - and the deed spent unless she
   * is crewed, as the mod spends every small boat's on placing) - at `position` on the water, her bow along `direction`:
   * a ship taken by boarding and claimed (scenes/navalHost.js claimPrize), heading as she lies. The port's rule for a
   * deed is untouched (useBoatDeed: a bought deed's boat stands where a port puts it) - a deed whose boat already stands
   * is the port's to move, and is refused here. It says nothing: the claim's words are its caller's. What the click
   * would have been placing is let go with it (the closing StopPlacing). Returns the boat, or null.
   */
  function LaunchFromDeed(deed, itemCollection, position, direction, terrain = null) {
    if (deed?.templateIndex !== BOAT_DEED_TEMPLATE || GetPlacedBoatWithUID(deed.UID) != null) return null;
    state.placeItem = deed;
    state.placeItemCollection = itemCollection;
    const placed = PlaceBoat([...position], [...direction], hullFromMessage(deed.message), variantFromMessage(deed.message), terrain);
    takePlaceItem(placed);
    StopPlacing();
    return placed;
  }
  /** PlaceBoat(Boat, Vector3, Vector3, Terrain) (6171-6178). */
  function PlaceBoatOnTerrain(newBoat, position, direction, terrain = null) {
    SpawnBoat(newBoat);
    SetBoatPositionAndDirection(newBoat, position, direction, terrain);
    PlaySlow(newBoat);
  }
  /** PlaceBoat(Boat, Vector3, Vector3, DFPosition) (6180-6187). */
  function PlaceBoatAtMapPixel(newBoat, position, direction, mapPixel = null) {
    SpawnBoat(newBoat);
    SetBoatPositionAndDirectionAtMapPixel(newBoat, position, direction, mapPixel);
    PlaySlow(newBoat);
  }
  /** RepositionBoat(Boat, Vector3, Vector3, Terrain) (6189-6196). */
  function RepositionBoat(boat, position, direction, terrain = null) {
    SetBoatPositionAndDirection(boat, position, direction, terrain);
    UpdateBoatVisibilityOf(boat);
    PlaySlow(boat);
  }
  /** RepositionBoat(Boat, Vector3, Vector3, DFPosition) (6198-6205). */
  function RepositionBoatAtMapPixel(boat, position, direction, mapPixel = null) {
    SetBoatPositionAndDirectionAtMapPixel(boat, position, direction, mapPixel);
    UpdateBoatVisibilityOf(boat);
    PlaySlow(boat);
  }

  /** The item's half of each arm that places (6328-6341): the deed's UID on the boat, its packed cargo aboard, the item
   *  spent unless the boat is crewed. SHIP-PACK: and the item's worth on her (`itemValue`, what her parts are packed at);
   *  a crewed ship's PARTS are spent too, her deed given back in their place in the pack - her number, their worth - so
   *  she stands by her deed as a bought ship does (her port, her lost-boat rule, her pick-up). */
  function takePlaceItem(boat) {
    if (state.placeItem != null) {
      boat.uid = state.placeItem.UID;
      if (Number.isFinite(state.placeItem.value)) boat.itemValue = state.placeItem.value;   // SHIP-PACK: her worth
      if (state.PackedCargoes.has(cargoKey(state.placeItem.UID))) {
        const value = state.PackedCargoes.get(cargoKey(state.placeItem.UID));
        transferAll(value, boat.Cargo.Items);   // ItemCollection.TransferAll: stacked as AddItem stacks, the packed collection emptied and kept
      }
      if (!boat.crewed) removeItem(state.placeItemCollection, state.placeItem);
      else if (state.placeItem.templateIndex === BOAT_PARTS_TEMPLATE) swapItem(state.placeItemCollection, state.placeItem, mintDeed(boat.hull, boat.variant, state.placeItem.UID, state.placeItem.value));   // SHIP-PACK: her deed back
    }
  }

  /** PlaceBoatAtRayHit(string[] args) (6207-6228): the console's arguments read as the C# reads them. */
  function PlaceBoatAtRayHitArgs(args) {
    let num = 0;
    let variant = 0;
    if (args.length === 0) variant = random.range(0, 7);
    else if (args.length === 1) {
      num = convertToInt32(args[0]);
      if (num === 0) variant = random.range(0, 7);
    } else if (args.length === 2) {
      num = convertToInt32(args[0]);
      variant = convertToInt32(args[1]);
    }
    PlaceBoatAtRayHit(num, variant);
  }

  /** PlaceBoatAtRayHit(int hull, int variant) (6230-6473). */
  function PlaceBoatAtRayHit(hull = 0, variant = 0) {
    if (!deps.pool.ready()) {   // DECLARED: DFU loads a mod's bundle before a game starts; the port's models may still be arriving
      log('[come-sail-away] the boats\' models have not loaded yet - placement aborted');
      StopPlacing();
      return;
    }
    const cam = deps.camera();
    const origin = [...cam.position];
    const l = Math.hypot(cam.forward[0], cam.forward[1], cam.forward[2]) || 1;
    const direction = [cam.forward[0] / l, cam.forward[1] / l, cam.forward[2] / l];   // new Ray normalises
    const val2 = deps.raycast(origin, direction, PLACE_RAY_DISTANCE, { triggers: true });
    const ipnm = !!deps.iliacPuddleNoMore();
    if (val2) {
      if (ipnm && String(val2.name).includes('DeepWaters')) {
        deps.hudText('Boat placed!');
        const at = afloatAt(val2, origin, direction);   // FIELD-CSA1: on the water, never the seabed under it
        let boat = null;
        let terrain = null;
        const val5 = deps.raycast(at, [0, -1, 0], PLACE_RAY_DISTANCE, { triggers: false });
        if (val5) terrain = val5.terrain ?? null;
        if (state.placeItem != null && state.placeItem.templateIndex === BOAT_DEED_TEMPLATE) boat = GetPlacedBoatWithUID(state.placeItem.UID);
        if (boat == null) boat = PlaceBoat(at, playerRight(), hull, variant, terrain);
        else RepositionBoat(boat, at, playerRight(), terrain);
        takePlaceItem(boat);
        StopPlacing();
        return;
      }
      if (deps.blockWaterLevel() !== NO_WATER_LEVEL) {
        const num = f(f(f(deps.blockWaterLevel()) * -1) * f(0.025));
        log(`COME SAIL AWAY - PLACING BOAT IN DUNGEON WITH WATER LEVEL AT ${num}`);
        const num2 = upPlaneRaycast(origin, direction, num);
        if (num2 == null) {
          log('COME SAIL AWAY - PLACEMENT DOES NOT INTERSECT WITH PLANE');
          StopPlacing();
          return;
        }
        if (num2 > PLACE_RAY_DISTANCE) {
          log(`COME SAIL AWAY - INTERSECTION WITH WATER PLANE IS TOO FAR AT ${num2}`);
          StopPlacing();
          return;
        }
        if (val2.distance > num2) {
          deps.hudText('Boat placed!');
          const boat2 = PlaceBoat(alongRay(origin, direction, num2), playerRight(), hull, variant);
          boat2.inside = true;
          takePlaceItem(boat2);
          StopPlacing();
          return;
        }
      }
      if (val2.terrain != null && tileMapIndexAtPosition(val2.point, val2.terrain) === 0) {
        // FIELD BUGS 2026-10-02b PLACE-AFLOAT (a departure): with Iliac Puddle No More on, a water tile that stands over
        // the sea's line - a town's harbour basin at its ground's height - is no water her nodes can read: placed there
        // she lay beached, her sails refused ("Boat is obstructed"), from the first frame. Refused with a word instead.
        if (ipnm && nodeReadingAt(val2.point, val2.terrain) !== 0) {
          deps.midScreenText(PLACE_RAISED_TEXT, 3);
          StopPlacing();
          return;
        }
        deps.hudText('Boat placed!');
        let boat3 = null;
        if (state.placeItem != null && state.placeItem.templateIndex === BOAT_DEED_TEMPLATE) boat3 = GetPlacedBoatWithUID(state.placeItem.UID);
        if (boat3 == null) boat3 = PlaceBoat([...val2.point], playerRight(), hull, variant, val2.terrain);
        else RepositionBoat(boat3, [...val2.point], playerRight(), val2.terrain);
        takePlaceItem(boat3);
        StopPlacing();
      } else {
        deps.midScreenText('Boat can only be placed on water!', 3);
        StopPlacing();
      }
    } else if (ipnm) {
      const num3 = upPlaneRaycast(origin, direction, seaTop());
      // FIELD-CSA1: the plane is met within the placing ray's own reach, as the dungeon's plane arm above holds it - the
      // C# took any crossing, so a look out to sea put the boat hundreds of metres off, out of sight, the deed spent
      if (num3 != null && num3 > PLACE_RAY_DISTANCE) {
        log(`COME SAIL AWAY - INTERSECTION WITH WATER PLANE IS TOO FAR AT ${num3}`);
        deps.hudText('Placement aborted!', 3);
        StopPlacing();
      } else if (num3 != null) {
        deps.hudText('Boat placed!');
        let boat4 = null;
        if (state.placeItem != null && state.placeItem.templateIndex === BOAT_DEED_TEMPLATE) boat4 = GetPlacedBoatWithUID(state.placeItem.UID);
        if (boat4 == null) boat4 = PlaceBoat(alongRay(origin, direction, num3), playerRight(), hull, variant);
        else RepositionBoat(boat4, alongRay(origin, direction, num3), playerRight(), null);
        takePlaceItem(boat4);
        StopPlacing();
      } else {
        log('COME SAIL AWAY - PLACEMENT DOES NOT INTERSECT WITH PLANE');
        StopPlacing();
      }
    } else {
      deps.hudText('Placement aborted!', 3);
      StopPlacing();
    }
  }

  /** SetBoatPositionAndDirection(Boat, Vector3, Vector3, Terrain) (6475-6487). */
  function SetBoatPositionAndDirection(boat, position, direction, terrain = null) {
    boat.WakeEmitter.stop();
    boat.GameObject.position = [...position];
    boat.GameObject.rotation = quatLookRotation(direction);   // transform.forward = direction
    boat.MapPixel = deps.currentMapPixel();
    if (terrain != null && !sameTerrain(terrain, deps.playerTerrain())) boat.MapPixel = GetMapPixelFromTerrain(terrain);
    UpdateBoatNodes(boat, terrain);
  }
  /** GetMapPixelFromTerrain (6489-6500): the terrain's pixel off the streaming world's own array, or null. */
  function GetMapPixelFromTerrain(terrain) {
    for (const val of deps.terrains()) {
      if (val === terrain) return { X: val.mapPixelX, Y: val.mapPixelY };
    }
    return null;
  }
  /** SetBoatPositionAndDirection(Boat, Vector3, Vector3, DFPosition) (6502-6510). */
  function SetBoatPositionAndDirectionAtMapPixel(boat, position, direction, mapPixel = null) {
    boat.WakeEmitter.stop();
    boat.GameObject.position = [...position];
    boat.GameObject.rotation = quatLookRotation(direction);
    boat.MapPixel = mapPixel;
    UpdateBoatNodesAtMapPixel(boat, mapPixel);
  }

  /** A node's reading at a point on one terrain (0 is water): Iliac Puddle No More's height test, else the tile map's -
   *  readNodes' law, and OWS2's (the port's own journey asks where a boat would float before it puts one there). */
  const nodeReadingAt = (point, terrain) => (deps.iliacPuddleNoMore() ? (terrain.sampleHeight(point) < WATER_LEVEL ? 0 : 1) : tileMapIndexAtPosition(point, terrain));
  /** Each node's reading on one terrain: Iliac Puddle No More's height test, else the tile map's water. */
  function readNodes(boat, terrain) {
    for (let j = 0; j < boat.NodeTileMapIndices.length; j++) boat.NodeTileMapIndices[j] = nodeReadingAt(boat.Nodes[j].position, terrain);
  }
  /** Inside, a dungeon with water reads every node as water (3641-3651 / 3685-3695). True when the caller returns. */
  function nodesInside(boat) {
    if (!deps.isPlayerInside()) return false;
    if (deps.blockWaterLevel() !== NO_WATER_LEVEL) boat.NodeTileMapIndices.fill(0);
    return true;
  }
  /** UpdateBoatNodes(Boat, Terrain) (3639-3680): the player's terrain unless one is given. */
  function UpdateBoatNodes(boat, terrain = null) {
    if (nodesInside(boat)) return;
    let val = deps.playerTerrain();
    if (terrain != null) val = terrain;
    readNodes(boat, val);   // a null terrain throws here, as the C#'s NullReferenceException does
  }
  /** UpdateBoatNodes(Boat, DFPosition) (3682-3725): the terrain of the boat's own pixel, none built - nothing read. */
  function UpdateBoatNodesAtMapPixel(boat, mapPixel) {
    if (nodesInside(boat)) return;
    const terrainTransform = deps.terrainAt(mapPixel.X, mapPixel.Y);
    if (terrainTransform == null) return;
    readNodes(boat, terrainTransform);
  }
  /** UpdateAllBoatsNodes (3624-3637). KEPT AS THE C# HAS IT: nothing calls it, and its `MapPixel ==
   *  CurrentMapPixel` compares two DFPosition references, the second a new one each read - never equal. */
  function UpdateAllBoatsNodes() {
    if (state.AllBoats.length < 1 || deps.isPlayerInside()) return;
    for (const allBoat of state.AllBoats) {
      if (allBoat.MapPixel === deps.currentMapPixel()) UpdateBoatNodes(allBoat);
    }
  }

  const pixelsApart = (a, b) => Math.max(Math.abs(a.X - b.X), Math.abs(a.Y - b.Y));
  /** UpdateBoatVisibility() (3727-3782): inside, only a boat placed inside this pixel stands; outside, a boat more
   *  than a pixel off (or placed inside) goes - destroyed when it was placed inside, unless the setting keeps it. */
  /** AUDIT KEEP-BOATS D2 (DECLARED): a boat placed underground (`inside` - placed only where a block has water, a
   *  dungeon's) stands only in a dungeon. The mod shows it in any interior on its pixel - a building's too - which its
   *  own PersistentDungeonBoats off never met (the boat was gone once outside); the port ships that key on. */
  const inDungeon = () => deps.isPlayerInsideDungeon?.() ?? true;
  function UpdateBoatVisibility() {
    if (state.AllBoats.length < 1) return;
    if (deps.isPlayerInside()) {
      for (const allBoat of state.AllBoats) {
        const cur = deps.currentMapPixel();
        if (allBoat.inside && inDungeon() && allBoat.MapPixel.X === cur.X && allBoat.MapPixel.Y === cur.Y) {
          if (!allBoat.GameObject.activeSelf) setBoatActive(allBoat, true);
        } else if (allBoat.GameObject.activeSelf) setBoatActive(allBoat, false);
      }
      return;
    }
    const list = [];
    for (const allBoat2 of state.AllBoats) {
      if (allBoat2.inside || (allBoat2.MapPixel != null && pixelsApart(deps.currentMapPixel(), allBoat2.MapPixel) > 1)) {
        if (allBoat2.inside && !deps.persistentDungeonBoats()) list.push(allBoat2);
        if (allBoat2.GameObject.activeSelf) setBoatActive(allBoat2, false);
      } else {
        if (!allBoat2.GameObject.activeSelf) setBoatActive(allBoat2, true);
        UpdateBoatNodesAtMapPixel(allBoat2, allBoat2.MapPixel);
      }
    }
    if (list.length <= 0) return;
    for (const item of list) {
      state.AllBoats.splice(state.AllBoats.indexOf(item), 1);
      deps.pool.remove(item);
    }
  }
  /** UpdateBoatVisibility(Boat) (3784-3818): the one boat, never destroyed; its nodes read whatever it decided. */
  function UpdateBoatVisibilityOf(boat) {
    if (boat == null) return;
    if (deps.isPlayerInside()) {
      const cur = deps.currentMapPixel();
      if (boat.inside && inDungeon() && boat.MapPixel.X === cur.X && boat.MapPixel.Y === cur.Y) {
        if (!boat.GameObject.activeSelf) setBoatActive(boat, true);
      } else if (boat.GameObject.activeSelf) setBoatActive(boat, false);
      return;
    }
    if (boat.inside || (boat.MapPixel != null && pixelsApart(deps.currentMapPixel(), boat.MapPixel) > 1)) {
      if (boat.GameObject.activeSelf) setBoatActive(boat, false);
    } else if (!boat.GameObject.activeSelf) setBoatActive(boat, true);
    UpdateBoatNodesAtMapPixel(boat, boat.MapPixel);
  }

  /** OnPositionUpdate (1987-2010): FloatingOrigin moved the world. FIELD-CSA1 (the port's own): EVERY boat rides it, in
   *  sight or not. The C# moved a boat only when it was active before or after its visibility was asked, so one out of
   *  sight kept the old origin's numbers through every shift made while it was - and the port recentres at every map
   *  pixel crossed, so a player who came back to it by another pixel than the one they left by found it hundreds of
   *  metres off. Moved first, then shown or hidden: a boat that comes into sight reads its nodes where it stands. A
   *  dungeon's boat out of sight (Persistent Dungeon Boats) is the one left where it stands, as the C# leaves it: it is
   *  in its dungeon's own frame, which no recentre moves. */
  function OnPositionUpdate(offset) {
    UpdateWaveMesh();
    if (state.AllBoats.length < 1) return;
    for (const allBoat of state.AllBoats) {
      if (ridesTheWorld(allBoat)) OnPositionUpdateBoat(allBoat, offset);
      UpdateBoatVisibilityOf(allBoat);
    }
  }
  /** FIELD-CSA1: a boat in the streaming world's frame - any but a dungeon's boat out of sight, which stands in its
   *  dungeon's own (dungeonContext's origin, which neither a recentre nor a teleport moves). */
  const ridesTheWorld = (boat) => !boat.inside || boat.GameObject.activeSelf;
  /**
   * FIELD-CSA1 (the port's own - Julian: "i got killed by an ocean mob before i could climb onto it. also lost that boat
   * forever after respawning"): THE WORLD RE-ANCHORED. A teleport - the respawn at a temple, a fast travel, a load's
   * landing - starts a new scene frame with no recentre offset to ride (world.js _teleportToPixel, StreamingWorld's
   * InitWorld), and every boat kept the old frame's numbers: the one just placed at sea stood by the temple, under its
   * ground, and was never where it was left again. The frame's own move carries every boat, then each is shown or hidden
   * for the new pixel. The helm is not asked: a teleported player goes where the teleport sends them. A dungeon's boat
   * out of sight stays in its dungeon's frame (`ridesTheWorld`).
   */
  function OnWorldReanchored(offset) {
    if (state.AllBoats.length < 1) return;
    for (const boat of state.AllBoats) {
      if (ridesTheWorld(boat)) shiftBoat(boat, offset);
      UpdateBoatVisibilityOf(boat);
    }
  }
  /** OnPositionUpdateBoat (2012-2064): the boat's root moved by the offset, the wake stopped and its living particles
   *  moved with it, and each oar's splashes (its first sub-emitter's) - the rudder's splashes are not (kept); at the
   *  helm the player set back at the drive and the wake played again if the boat is under way. */
  function OnPositionUpdateBoat(boat, offset) {
    shiftBoat(boat, offset);
    if (boat === state.CurrentBoat) {
      deps.helm.setPlayerPosition(boat.DrivePosition.position);
      boat.MapPixel = deps.currentMapPixel();
      if (vMagnitude(state.MoveVectorCurrent) >= wakeThreshold() && !DisableParticles()) boat.WakeEmitter.play();
    }
  }
  /** OnPositionUpdateBoat's move: the root by the offset, the wake stopped, its living particles and each oar's splashes
   *  (its first sub-emitter's) with it - the rudder's splashes are not (kept). */
  function shiftBoat(boat, offset) {
    boat.WakeEmitter.stop();
    const p = boat.GameObject.position;
    boat.GameObject.position = [f(f(p[0]) + f(offset[0])), f(f(p[1]) + f(offset[1])), f(f(p[2]) + f(offset[2]))];
    const shift = (system) => { if (system.particleCount > 0) system.setParticles(system.getParticles().map((q) => ({ ...q, position: vAdd(q.position, offset) }))); };
    shift(boat.WakeEmitter);
    if (boat.OarParticles.length > 0) for (const oarParticle of boat.OarParticles) shift(oarParticle.subEmitters[0].system);   // GetSubEmitterSystem(0)
  }

  /** OnLoad (1943-1950). */
  function OnLoad() {
    UpdateBoatVisibility();
    UpdateWaveMesh();   // `if (waveObject != null)` - Start built it
  }
  /** OnTransition (1978-1985): into or out of a building or a dungeon. */
  function OnTransition() {
    ResetTimeScale(false);
    UpdateBoatVisibility();
    UpdateWind(deps.weatherType?.() ?? WEATHER_TYPE.Sunny);
    UpdateWaveMesh();
  }
  /** OnTeleportToCoordinates (2072-2075): the waves a tenth of a second later. */
  function OnTeleportToCoordinates() { UpdateWaveMeshDelayed(); }

  // ── CSA-F: the waves (2134-2143, 2145-3477; comeSailAwayWaves.js) ──
  const waveOn = () => !!setting('Waves.Enable', true);
  /** CSA-J: `AnimatedWater != null && AWVertexWaves` - false here, the setting never read (ANIMATED_WATER is null). */
  const animatedWaterWaves = () => ANIMATED_WATER != null && !!setting('Compatibility.AnimatedWaterVertexWaves', false);
  /** UpdateWaveMesh (2145-3477): the mesh cleared; with the waves off, indoors or on the player's ship nothing more;
   *  else the object stood over the player's pixel and the coast's pieces laid. */
  function UpdateWaveMesh() {
    state.waveObject.mesh = null;   // waveMeshFilter.mesh.Clear()
    if (!waveOn() || animatedWaterWaves() || deps.isPlayerInside() || deps.transport?.isOnShip?.()) return;   // (2798)
    const r = buildWaveMesh({
      heightMapValue: deps.heightMapValue,
      raycast: (origin, direction, maxDistance) => deps.raycast(origin, direction, maxDistance, { triggers: true }),
      mapPixel: deps.currentMapPixel(),
      worldCompensation: deps.worldCompensation(),
      waveDistance: Math.trunc(Number(setting('Waves.Distance', 2))),
      waterLevel: WATER_LEVEL,
    });
    state.waveObject.position = r.position;
    if (r.neighbors !== undefined) state.currentNeighbors = r.neighbors;
    state.waveObject.mesh = r.mesh;
  }
  // ── CSA-F: the boats' two loops, their play state (6527-6600) - the wake's Play and Stop ride it; the sound is CSA-G's ──
  /** The MonoBehaviour's one `fading` coroutine, every boat's (kept). */
  let fading = null;
  /** DisableParticles (617-627): `AnimatedWater != null && AWVertexWaves` - never here (ANIMATED_WATER). */
  const DisableParticles = () => animatedWaterWaves();
  /** DaggerfallUnity.Settings.SoundVolume * sfxVolume. */
  const loopVolume = () => f(f(deps.soundVolume?.() ?? 1) * f(setting('Audio.SoundVolume', 1)));
  /** AudioSource.Play - from the clip's start (`plays` counts them for the host) - and Stop. HELM-HUSH (FIELD BUGS
   *  2026-10-02, "audio cutting when taking helm of a ship"): a source already playing goes on where it is, where
   *  Unity's Play restarts it - every crossfade plays the loop it fades out (CrossfadeAudioSourceCoroutine), so the
   *  first stroke of the oars past the wake's threshold, and every slowing under it, cut the boat's loop back to its
   *  first sample at full volume. */
  const audioPlay = (src) => { if (!src.isPlaying) src.plays = (src.plays ?? 0) + 1; src.isPlaying = true; deps.audio?.play?.(src); };
  const audioStop = (src) => { src.isPlaying = false; deps.audio?.stop?.(src); };
  /** UpdateAudioSource (1904-1920): the mod's own volume changed (LoadSettings' Audio section) - each loop still heard
   *  takes SoundVolume x the new one; a loop faded to nothing stays there. */
  function UpdateAudioSource() {
    if (state.AllBoats.length < 1) return;
    for (const allBoat of state.AllBoats) {
      if (allBoat.AudioSourceSlow.volume > 0) allBoat.AudioSourceSlow.volume = loopVolume();
      if (allBoat.AudioSourceFast.volume > 0) allBoat.AudioSourceFast.volume = loopVolume();
    }
  }
  /** The Audio section as Start's LoadSettings read it - the runtime is made at Start, before any boat. */
  let lastAudioSetting = setting('Audio.SoundVolume', 1);
  /** LoadSettings' Audio arm (846-850): the mod's settings are read live, so the host asks every frame whether the
   *  section changed - `HasChanged("Audio")` - and UpdateAudioSource runs when it did. */
  function checkSettings() {
    const v = setting('Audio.SoundVolume', 1);
    if (v === lastAudioSetting) return;
    lastAudioSetting = v;
    UpdateAudioSource();
  }
  /** The oars' three animation events (6603-6685), each through the rudder's listener: at the helm only; every oar's
   *  splash played after its start delay; and at the first time scale the rudder's own AudioSource - the Trireme's
   *  alone carries one - plays the stroke's clip. */
  function OarEvent_In() { oarEvent(f(0.4), 2); }
  function OarEvent_Sweep() { oarEvent(0, 3); }
  function OarEvent_Out() { oarEvent(f(0.1), 4); }
  function oarEvent(startDelay, clip) {
    if (!isSailing()) return;
    const boat = state.CurrentBoat;
    if (boat.OarParticles.length > 0 && !DisableParticles()) {
      for (const oarParticle of boat.OarParticles) {
        oarParticle.main.startDelay = constantCurve(startDelay);   // MainModule.startDelay = (MinMaxCurve)startDelay
        oarParticle.play();
      }
    }
    if (state.timeScaleIndex === 0) {
      const component = boat.RudderObject?.getComponent?.('AudioSource');
      if (component != null) deps.audio?.oneShot?.(component, nodeOf(boat.GameObject, component), AUDIO_CLIPS[clip], 1);   // component.PlayOneShot(audioClips[clip])
    }
  }
  /** PlaySlow (6527-6536). */
  function PlaySlow(boat, crossfade = false) {
    if (crossfade) { CrossfadeAudioSource(boat.AudioSourceFast, boat.AudioSourceSlow); return; }
    audioStop(boat.AudioSourceFast);
    FadeAudioSource(boat.AudioSourceSlow, 0, loopVolume());
  }
  /** PlayFast (6538-6547). */
  function PlayFast(boat, crossfade = false) {
    if (crossfade) { CrossfadeAudioSource(boat.AudioSourceSlow, boat.AudioSourceFast); return; }
    audioStop(boat.AudioSourceSlow);
    FadeAudioSource(boat.AudioSourceFast, 0, loopVolume());
  }
  /** A coroutine StopCoroutine can end: `fading` is set to it before it starts, as the C# sets the field first.
   *  `settle` lands a fade where it was going (HELM-HUSH). */
  function startFading(body, settle = null) {
    const h = { stopped: false, settle };
    fading = h;
    startCoroutine(() => !h.stopped && body(h));
    return h;
  }
  /** FadeAudioSource (6549-6557): the running fade stopped, a new one. HELM-HUSH: the one handle is every boat's, so a
   *  boat placed (a load, a launch, a reposition) stopped another's fade where it stood - a loop faded in from nothing
   *  was left playing, silent, until a crossfade jumped it back to full; the stopped fade lands where it was going. */
  function FadeAudioSource(target, from, to, duration = 1) {
    if (fading != null) { fading.stopped = true; fading.settle?.(); }   // StopCoroutine(fading)
    startFading(FadeAudioSourceCoroutine(target, from, to, duration), () => {
      if (to === 0) audioStop(target);
      else { audioPlay(target); target.volume = to; }
    });
  }
  /** CrossfadeAudioSource (6559-6566): only when none is running. */
  function CrossfadeAudioSource(from, to, duration = 2) {
    // AUDIT HELM-HUSH: a crossfade stopped by a fade lands too - `to` heard whole, `from` stopped - where it was left
    // with both loops part-way and the wake's check (it asks only for a silent loop) never asked again
    if (fading == null) startFading(CrossfadeAudioSourceCoroutine(from, to, duration), () => { audioStop(from); audioPlay(to); to.volume = loopVolume(); });
  }
  /** FadeAudioSourceCoroutine (6568-6584): played, its volume lerped over the duration a frame's end at a time, stopped
   *  at the end if faded to nothing. */
  function FadeAudioSourceCoroutine(target, from, to, duration) {
    let time = 0, begun = false;
    return (h) => {
      if (!begun) { begun = true; audioPlay(target); }
      if (time < duration) {
        target.volume = mathfLerp(from, to, f(time / duration));
        time = f(time + dt());
        return true;   // WaitForEndOfFrame
      }
      if (to === 0) audioStop(target);
      if (fading === h) fading = null;
      return false;
    };
  }
  /** CrossfadeAudioSourceCoroutine (6586-6601): both played, one down and the other up over two seconds, the first
   *  stopped. */
  function CrossfadeAudioSourceCoroutine(from, to, duration) {
    let time = 0, begun = false;
    return (h) => {
      if (!begun) { begun = true; audioPlay(from); audioPlay(to); }
      if (time < duration) {
        const num = f(time / duration);
        from.volume = mathfLerp(loopVolume(), 0, num);
        to.volume = mathfLerp(0, loopVolume(), num);
        time = f(time + dt());
        return true;
      }
      audioStop(from);
      if (fading === h) fading = null;
      return false;
    };
  }

  /** UpdateWaveMeshDelayed (2134-2143): StartCoroutine - WaitForSeconds(delay), then UpdateWaveMesh. */
  function UpdateWaveMeshDelayed(delay = 0.1) {
    delayedCalls.push({ at: f(f(deps.time()) + f(delay)), step: UpdateWaveMesh });
  }

  // ── CSA-E: the wind (3860-3941, 2078-2087) ──
  /** UpdateWind (3860-3922): indoors none at all; outdoors a strength of Random.Range(1f, 2f) - a tenth of it in fog,
   *  half again in rain, twice in a storm - along right, turned toward the back by day and toward the front from 18:00
   *  to 07:00, flipped south of the map's row 250, then turned 15 x Random.Range(-4, 4) degrees; and one more
   *  RotateWind started (each call starts one: two running turn the wind twice as fast - kept). */
  function UpdateWind(weather) {
    if (deps.isPlayerInside()) {
      state.windVectorTarget = [0, 0, 0];
      state.windVectorCurrent = [0, 0, 0];
      return;
    }
    let num = f(rangeFloat(1, 2));
    if (weather === WEATHER_TYPE.Fog) num = f(num * f(0.1));
    else if (weather === WEATHER_TYPE.Rain) num = f(num * f(1.5));
    else if (weather === WEATHER_TYPE.Thunder) num = f(num * 2);
    const hour = deps.hour?.() ?? 12;
    let right = hour <= 6 || hour >= 18 ? vAdd(V_RIGHT, V_FORWARD) : vAdd(V_RIGHT, V_BACK);
    if (deps.currentMapPixel().Y > 250) right = vScale(right, -1);
    const num2 = f(15 * random.range(-4, 4));
    const val = quatRotate(quatAngleAxis(num2, V_UP), right).map(f);
    state.windVectorTarget = vScale(vNormalized(val), num);
    startCoroutine(RotateWind);
  }
  /** RotateWind (3924-3940): each frame's end the current turned toward the target by a tenth of a radian a second,
   *  its length moved by up to one, until the two are equal (Vector3's ==); then OnUpdateWind. Each step sets the
   *  rain's and the snow's ForceOverLifetime off the wind (CSA-F: the host's precipitation hears it). */
  function RotateWind() {
    if (!vEquals(state.windVectorCurrent, state.windVectorTarget)) {
      state.windVectorCurrent = vRotateTowards(state.windVectorCurrent, state.windVectorTarget, f(f(0.1) * dt()), 1);
      // CSA-F: the rain's and the snow's ForceOverLifetime, a random between two constants each way (3929-3932)
      const [wx, , wz] = state.windVectorCurrent;
      deps.precipitationForce?.({
        rain: { x: twoConstantsCurve(f(wx * 10), f(wx * 50)), z: twoConstantsCurve(f(wz * 10), f(wz * 50)) },
        snow: { x: twoConstantsCurve(f(wx * 5), f(wx * 25)), z: twoConstantsCurve(f(wz * 5), f(wz * 25)) },
      });
      return true;   // yield return new WaitForEndOfFrame()
    }
    raise('OnUpdateWind', [...state.windVectorCurrent]);
    return false;
  }
  /** StartCoroutine: the body runs at once to its first yield, then at each frame's end. */
  function startCoroutine(step) {
    if (step()) endOfFrameQueue.push(step);
  }
  /** OnNewHour (2078-2081) and OnWeatherChange (2083-2086): a new wind for the player's weather, or the one coming. */
  function OnNewHour() { UpdateWind(deps.weatherType?.() ?? WEATHER_TYPE.Sunny); }
  function OnWeatherChange(next) { UpdateWind(next); }

  /** GetPlacedBoatWithUID (769-786). */
  function GetPlacedBoatWithUID(UID) {
    if (state.AllBoats.length < 1) return null;
    let result = null;
    for (const allBoat of state.AllBoats) {
      if (allBoat.uid === UID) { result = allBoat; break; }
    }
    return result;
  }
  /** GetHitBoatIndex (1890-1902): the boat whose root the hit's object sits under, by index. */
  function GetHitBoatIndex(hit) {
    let result = -1;
    for (let i = 0; i < state.AllBoats.length; i++) {
      if (hit?.root != null && hit.root === state.AllBoats[i].GameObject) { result = i; break; }
    }
    return result;
  }

  // ── the console (56-204) ────────────────────────────────────────────────────
  /** PlaceBoatAtMe.Execute. */
  function consolePlaceBoat(args) {
    if (args.length > 2) return 'Error - Too many arguments, check the usage notes.';
    PlaceBoatAtRayHitArgs(args);
    return 'Attempting to place boat';
  }
  /** PrintBoats.Execute: DFPosition.ToString is "X, Y". */
  function consolePrintBoats() {
    if (state.AllBoats.length < 1) return 'No placed boats!';
    let text = '';
    for (let i = 0; i < state.AllBoats.length; i++) {
      const boat = state.AllBoats[i];
      text = `${text}${i} - ${HULL_NAMES[boat.hull]} at ${boat.MapPixel.X}, ${boat.MapPixel.Y}\n`;
    }
    return text;
  }
  /** IdentifyBoat.Execute. */
  function consoleIdentifyBoat() {
    const cam = deps.camera();
    const l = Math.hypot(cam.forward[0], cam.forward[1], cam.forward[2]) || 1;
    const hit = deps.raycast([...cam.position], [cam.forward[0] / l, cam.forward[1] / l, cam.forward[2] / l], PLACE_RAY_DISTANCE, { triggers: true });
    if (hit) {
      const num = GetHitBoatIndex(hit);
      if (num === -1) return 'Hit object is not a boat!';
      return `Hit object is a boat with index ${num}`;
    }
    return 'Nothing was hit!';
  }
  /** PurgeBoat.Execute. */
  function consolePurgeBoat(args) {
    if (args.length < 1) return 'Error - No arguments provided, check the usage notes.';
    if (args.length > 1) return 'Error - Too many arguments, check the usage notes.';
    const num = convertToInt32(args[0]);
    if (num >= state.AllBoats.length) return 'Error - Index is out of range';
    const boat = state.AllBoats[num];   // a negative index: List's ArgumentOutOfRangeException
    if (boat === undefined) throw new RangeError(`ArgumentOutOfRangeException: Index was out of range. (${num})`);
    state.AllBoats.splice(num, 1);
    deps.pool.remove(boat);
    return `Boat at index ${num} was purged.`;
  }

  // ── ComeSailAwaySaveData ────────────────────────────────────────────────────
  function newSaveData() {
    return {
      worldCompensation: { x: 0, y: 0, z: 0 },
      placedBoats: [],
      placedMapMarkers: [],
      currentBoat: -1,
      TemporaryShip: false,
      sailPosition: 0,
      moveVectorCurrent: { x: 0, y: 0, z: 0 },
      moveVectorTarget: { x: 0, y: 0, z: 0 },
      windVector: { x: 0, y: 0, z: 1 },
      packedCargoes: {},
    };
  }
  function getSaveData() {
    if (pendingRestore) return JSON.parse(JSON.stringify(pendingRestore));   // the record the load handed, until its boats stand
    const data = newSaveData();
    data.worldCompensation = v3(deps.worldCompensation());
    let num = -1;
    if (state.AllBoats.length > 0) {
      for (let i = 0; i < state.AllBoats.length; i++) {
        const b = state.AllBoats[i];
        data.placedBoats.push({
          UID: b.uid,
          Hull: b.hull,
          Variant: b.variant,
          MapPixel: b.MapPixel ? { X: b.MapPixel.X, Y: b.MapPixel.Y } : null,
          Position: v3(b.GameObject.position),
          Direction: v3(quatRotate(b.GameObject.rotation, V_FORWARD)),
          Items: deps.packedItems.serialize(b.Cargo.Items),
          lights: b.LightOn,
          inside: b.inside,
          ...(Number.isFinite(b.itemValue) ? { Value: b.itemValue } : {}),   // SHIP-PACK (the port's own): her worth, kept
        });
        if (state.CurrentBoat === b) num = i;
      }
    }
    if (state.mapMarkers.length > 0) {
      log('COME SAIL AWAY - SAVING MAP MARKERS!');
      for (const m of state.mapMarkers) data.placedMapMarkers.push({ position: { x: m.position[0], y: m.position[1] }, label: m.label, color: m.color });
    }
    data.currentBoat = num;
    data.TemporaryShip = state.TemporaryShip;
    data.sailPosition = state.sailPosition;
    data.moveVectorCurrent = v3(state.MoveVectorCurrent);
    data.moveVectorTarget = v3(state.MoveVectorTarget);
    data.windVector = v3(state.windVectorCurrent);
    if (state.PackedCargoes.size > 0) {
      data.packedCargoes = {};
      for (const [uid, items] of state.PackedCargoes) data.packedCargoes[uid] = deps.packedItems.serialize(items);
    }
    return data;
  }
  /** RestoreSaveData - held until the models are in (DECLARED), then run whole and followed by OnLoad's visibility. */
  function restoreSaveData(dataIn) {
    if (!deps.pool.ready()) { pendingRestore = dataIn; return; }
    pendingRestore = null;
    applySaveData(dataIn);
  }
  function applySaveData(dataIn) {
    if (isSailing()) StopSailing();
    if (state.AllBoats.length > 0) {
      for (const allBoat of state.AllBoats) deps.pool.remove(allBoat);
      state.AllBoats.length = 0;
    }
    state.mapMarkers.length = 0;
    const data = { ...newSaveData(), ...dataIn };   // FullSerializer fills a new ComeSailAwaySaveData: a field the record lacks keeps its initializer
    const num = f(f(deps.worldCompensation()[1]) - f(data.worldCompensation?.y ?? 0));
    if (data.placedBoats != null && data.placedBoats.length > 0) {
      for (const placedBoat of data.placedBoats) {
        const boat = new Boat(placedBoat.Hull, placedBoat.Variant);
        boat.uid = placedBoat.UID;
        const p = arr3(placedBoat.Position);
        boat.Position = [p[0], f(p[1] + num), p[2]];
        boat.Direction = arr3(placedBoat.Direction);
        boat.MapPixel = placedBoat.MapPixel ? { X: placedBoat.MapPixel.X, Y: placedBoat.MapPixel.Y } : null;
        boat.inside = !!placedBoat.inside;
        if (Number.isFinite(placedBoat.Value)) boat.itemValue = placedBoat.Value;   // SHIP-PACK: her worth
        state.AllBoats.push(boat);
        PlaceBoatAtMapPixel(boat, boat.Position, boat.Direction, boat.MapPixel);
        boat.Cargo.Items = deps.packedItems.deserialize(placedBoat.Items ?? []);
        boat.Cargo.ContainerImage = CARGO_CONTAINER_IMAGE;
        setLights(boat, !!placedBoat.lights);
      }
    }
    if (data.placedMapMarkers.length > 0) {
      log('COME SAIL AWAY - LOADED SAVE HAS MAP MARKERS!');
      for (const m of data.placedMapMarkers) {
        AddMapMarker([roundToInt(m.position.x), roundToInt(m.position.y)], m.color, m.label);
      }
    }
    if (state.AllBoats.length > 0 && data.currentBoat !== -1) {
      state.TemporaryShip = !!data.TemporaryShip;
      const boat = state.AllBoats[data.currentBoat];   // an index past the list: the C#'s ArgumentOutOfRangeException
      if (boat === undefined) throw new RangeError(`ArgumentOutOfRangeException: Index was out of range. (${data.currentBoat})`);
      StartSailing(boat);
      if (data.sailPosition > 0) RaiseSails();   // before the wind below is restored - the pre-load wind stows or not (kept)
      state.MoveVectorCurrent = arr3(data.moveVectorCurrent);
      state.MoveVectorTarget = arr3(data.moveVectorTarget);
    }
    state.windVectorCurrent = arr3(data.windVector);
    state.PackedCargoes = new Map();
    for (const [uid, items] of Object.entries(data.packedCargoes ?? {})) state.PackedCargoes.set(cargoKey(uid), deps.packedItems.deserialize(items));
    RunOnUpdateEvents();
  }
  /** RunOnUpdateEvents (1821-1831, the save's restore calls it): OnUpdateWind with the wind as it stands - CSA-J's
   *  receiver lets another mod listen - and the current's memory cleared. */
  function RunOnUpdateEvents() {
    raise('OnUpdateWind', [...state.windVectorCurrent]);
    state.currentVectorPrevious = [0, 0, 0];
  }
  /** AddMapMarker (5695-5701): a marker, once per pixel. */
  function AddMapMarker(mapPixel, color, label = '') {
    if (!state.mapMarkers.some((m) => m.position[0] === mapPixel[0] && m.position[1] === mapPixel[1])) state.mapMarkers.push({ position: mapPixel, label, color });
  }

  /** A frame: a held restore lands the first frame the models are in, then OnLoad's visibility runs for it. */
  function tick() {
    if (pendingRestore && deps.pool.ready()) {
      const data = pendingRestore;
      pendingRestore = null;
      applySaveData(data);
      OnLoad();
    }
  }

  return {
    state,
    get AllBoats() { return state.AllBoats; },
    get placing() { return state.placing; },
    get pendingRestore() { return pendingRestore; },
    isSailing,
    /** CSA-K: the boat at the helm's way this frame - the world velocity LateUpdate translates it by and the degrees
     *  it turns it by, each per second of Time.deltaTime (the host scales them to the real clock) - or null: no helm,
     *  or a beached boat, which does not move. */
    helmMotion() {
      const boat = state.CurrentBoat;
      if (!isSailing() || boat == null || IsBeached(boat)) return null;
      return { boat, velocity: quatRotate(boat.GameObject.rotation, state.velocityCurrent), turn: state.TurnCurrent };
    },
    /** CSA-L: what the helm panel shows (ui/enhancedHelm.js) - read, never written: the sails raised, the square
     *  sails a hull with fore-and-aft ones too can raise alone and whether they stand, the lanterns, the time scale's
     *  step and value, and whether the trim is the player's (SailingAssist.AutoTrimming off) and on which sails. */
    helmPanelState() {
      const boat = state.CurrentBoat;
      if (!isSailing() || boat == null) return null;
      const foreAft = boat.SailsLateen.length > 0 || boat.SailsGaff.length > 0;
      const squareRaised = boat.SailsSquare.length > 0 && boat.SailsSquare.some((sq) => animatorOf(sq)?.GetBool('Stowed') === false);
      return {
        hull: boat.hull, hasSails: boat.Sails.length > 0, sailsUp: state.sailPosition !== 0,
        hasSquare: boat.SailsSquare.length > 0,
        squareToggle: state.sailPosition !== 0 && boat.SailsSquare.length > 0 && foreAft && !trimAutoSquareUpwind(), squareUp: squareRaised,
        light: !!boat.LightOn, timeScaleIndex: state.timeScaleIndex, timeScale: TIME_SCALES[state.timeScaleIndex], timeScaleMax: TIME_SCALES.length - 1,
        manualTrim: !trimAuto(), squareOnly: !foreAft,
        // HELM-KEYS: whether more sail can be made (a sail stowed that the arrows' step raises), and whether she lies in irons
        moreSail: boat.Sails.length > 0 && (state.sailPosition === 0 || (squareHandled(boat) && squareStowed(boat))), inIrons: inIrons(boat) && state.ironsFor >= IRONS_TELL_S,
        responsive: responsive(),   // AUDIT NAV2 F18: whose rudder she answers - the in-irons line's advice
      };
    },
    /** AUDIT NAV2 F14 x F16: whether the helm is the responsive one (HELM-WAY) - this helm's word while one is taken,
     *  else the hand's as it stands: the Overworld's crossing asks it of a boat (scenes/world.js tvSeaCrosses). */
    helmResponsive: () => responsive(),
    StartPlacing, StopPlacing,
    PlaceBoat, PlaceBoatOnTerrain, PlaceBoatAtMapPixel, RepositionBoat, RepositionBoatAtMapPixel,
    PlaceBoatAtRayHit, PlaceBoatAtRayHitArgs,
    SetBoatPositionAndDirection, SetBoatPositionAndDirectionAtMapPixel, GetMapPixelFromTerrain,
    UpdateBoatNodes, UpdateBoatNodesAtMapPixel, UpdateAllBoatsNodes, UpdateBoatVisibility, UpdateBoatVisibilityOf,
    OnPositionUpdate, OnPositionUpdateBoat, OnWorldReanchored, OnLoad, OnTransition, OnTeleportToCoordinates,
    IncreaseTimeScale, DecreaseTimeScale, SetTimeScale, UpdateAudioSource, checkSettings, OarEvent_In, OarEvent_Sweep, OarEvent_Out,
    UpdateWaveMesh, UpdateWaveMeshDelayed,
    /** CSA-F: what the wave object draws - its position and scale, its mesh (null when cleared) and its frame. */
    waves: () => ({ position: state.waveObject.position, scale: state.waveObject.scale, mesh: state.waveObject.mesh, frame: state.waveFrameIndex }),
    GetPlacedBoatWithUID, GetHitBoatIndex, AddMapMarker,
    update, lateUpdate, fixedUpdate, endOfFrame, tick,
    StartSailing, StopSailing, StopSailingDelayed, ReturnTemporaryShip, UpdateCurrentBoatNodes, CheckCollision, UpdateBoatCargoMod,
    turnDoor,   // CSA-K: TriggerDoor's arm, for a door on another player's boat
    CanSail, IsBeached, IsNodeOnWater, CanTurnLeft, CanTurnRight, ResetTimeScale,
    LaunchFromParts, nodeReadingAt,   // OWS2: the Overworld's crossing - a launch aimed by the journey, and the node's law it probes with
    LaunchFromDeed,   // SHIP-CLAIM: a claimed prize's deed, her boat stood where she lies
    activate, OnStartLoad, OnPreFastTravel, OnPostFastTravel, OnPlayerDeath, OnNewMagicRound,
    UpdateWind, OnNewHour, OnWeatherChange,
    GetSailPower, ToggleSails, RaiseSails, LowerSails, ToggleSquareSails, HasLargeSquareSailWithGaff,
    windWidget, windWidgetFrameOf,
    get playerParent() { return playerParent; },
    /** The C#'s `event`s: `on('OnUpdateSailing', fn)` is `OnUpdateSailing += fn`. */
    on: (name, fn) => { events[name]?.push(fn); },
    properties: { moveSpeed, moveAccel, turnSpeed, turnAccel, wakeThreshold, hasInput, inputTarget },
    console: { giveboat: consoleGiveBoat, placeboat: consolePlaceBoat, printboats: consolePrintBoats, identifyboat: consoleIdentifyBoat, purgeboat: consolePurgeBoat },
    // CSA-H: the items, the cargo, the variants and the ports
    IsNearPort, PackBoat, deedMissing, OpenCargo, OpenBoatVariantPicker, OpenBoatVariantPicker_OnItemPicked, useBoatParts, useBoatDeed,
    // CSA-I: the position reading, OnGUI's map and values, the water walk
    CheckBoatPosition, StartShowBoatPosition, StopShowBoatPosition, IsPositionMarked, LeftClickOnMap, RightClickOnMap,
    mapOverlay, debugValues, StartWaterwalking, EndWaterwalking,
    // CSA-J: the message receiver
    MessageReceiver,
    newSaveData, getSaveData, restoreSaveData,
    /** CSA-J (the audit): a new game. DFU calls nothing on a mod's save interface (the NewSaveData restore is the
     *  port's, modSaveData.js), and this runtime is the game's own - the host is built per game - so Start's state
     *  stands: its rolled wind, where NewSaveData's Vector3.forward would have turned every new game's wind due north. */
    newGame() {},
  };
}

/** PackedCargoes' key: the item's UID as the save writes it (a JSON object's key is a string). */
const cargoKey = (uid) => String(uid);
/** CSA-I: the bundle StartWaterwalking assigns (5983) - Iliac Puddle No More's swim knows it by name
 *  (world/deepWaterSwim.js isBoatEffectBundle) - its one effect's key (WaterWalkingSilent.EffectKey), and the other
 *  bundle EndWaterwalking takes off (6021). */
export const BOAT_EFFECT_BUNDLE = "I'm On A Boat";
/** CSA-J: the component as Unity's Object.ToString() names it in the receiver's error - Init's GameObject, named for
 *  the mod's title (719), and the type's full name in brackets. */
export const MOD_OBJECT_NAME = 'Come Sail Away (ComeSailAwayMod.ComeSailAway)';
export const WATER_WALKING_SILENT = 'WaterWalkingSilent';
const JESUS_MODE_BUNDLE = 'Jesus Mode';
/** A sail's Animator stowed or raised: CrossFade over sailAnimationSpeed and the Stowed bool with it (CSA-J: a peer's
 *  boat's sails too, scenes/comeSailAwayPeers.js). */
function stow(component, stowed) {
  component.CrossFade(stowed ? 'Stowed' : 'Unstowed', SAIL_ANIMATION_SPEED);
  component.SetBool('Stowed', stowed);
}
export { stow as stowSail };
/** Bounds.Contains: inside the box or on its faces. */
export function boundsContains(b, p) {
  for (let k = 0; k < 3; k++) if (p[k] < f(b.center[k] - b.extent[k]) || p[k] > f(b.center[k] + b.extent[k])) return false;
  return true;
}
/** Mathf.RoundToInt: the .5 tie to the even integer (System.Math.Round's default). */
function roundToInt(v) {
  const fl = Math.floor(v);
  const r = v - fl;
  return r > 0.5 ? fl + 1 : r < 0.5 ? fl : (fl % 2 === 0 ? fl : fl + 1);
}
/** ItemCollection.RemoveItem: by the item's UID, the collection's key, else the item itself. AUDIT PRE-MERGE 0928 S2:
 *  `list` may be a getter - the host's live list (world.js csaLiveList) - read at the spend, so a load between the use
 *  and the click spends the loaded pack's copy, as DFU's one ItemCollection does. */
/** SHIP-PACK: `item` replaced where it lies in the list (a list, or a function answering one) by `by`; nothing where it
 *  is not there. */
function swapItem(list, item, by) {
  const l = typeof list === 'function' ? list() : list;
  if (!l) return;
  let i = l.indexOf(item);
  if (i < 0 && item?.UID != null) i = l.findIndex((it) => it?.UID === item.UID && it?.templateIndex === item.templateIndex);
  if (i >= 0) l.splice(i, 1, by);
}
function removeItem(list, item) {
  const l = typeof list === 'function' ? list() : list;
  if (!l) return;
  let i = item?.UID != null ? l.findIndex((it) => it?.UID === item.UID) : -1;
  if (i < 0) i = l.indexOf(item);
  if (i >= 0) l.splice(i, 1);
}
