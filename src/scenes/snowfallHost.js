// SNOWFALL1 (2026-10-08, Mac: "These should be on by default and integrate into our enhanced environments
// seamlessly") - SNOWFALL IN A HOST: the one runtime both exterior hosts (scenes/world.js, scenes/exterior.js) build -
// the mod's law (systems/snowfall.js), its controller (systems/snowfallRuntime.js), its surface on the GPU (render/
// snowfallSurface.js, drawn through the renderer's snow program), its save record and its console command
// (snow_status). A host hands it the ground it stands (`ground`, below) and calls `frame` once a frame, outdoors and in;
// it draws the snow with the opaque world, after the ground (`draw`), and carries it across the floating origin.
//
// THE FOUR HOSTS RULE (bible/Home.md): world.js and exterior.js build it; indoors (worldModes.js) and underground
// (dungeonContext.js) the host's own frame calls `frame` with `inside: true` (surfaces hidden, snowpack and refill kept).

import { modSettingsGeneration, modSetting } from '../systems/modSettings.js';
import { registerModSaveData } from '../systems/modSaveData.js';
import { registerCommand, gateConsoleCommand } from '../systems/consoleCommands.js';
import { pageParam } from '../systems/pageQuery.js';
import { SnowCoverage, BasicRoadsTerrain, roadCorners, snowfallSettings, winterArchiveOf, markAuthoredBlock, locationRect, isVanillaLocation, SNOWFALL_VENDOR, SNOW_MASK_ARCHIVES, ROAD_KIND } from '../systems/snowfall.js';
import { arenaRoadByte, arenaJoinByte } from '../world/arenaRoads.js';   // BAY-LEFT-GROUND: TESA's roads - past the Bay, and their crossings' joins on it (TESA5)
import { curveField, CURVE_DIM, TRACK_HALF } from '../world/road/roadCurves.js';   // BAY-LEFT-GROUND: a track's curve past the Bay (VOYAGER2)
import { WORLD_PIXEL_SPAN } from '../world/worldWide/worldGrid.js';   // BAY-LEFT-GROUND: the world's grid, the box's clamp
import { SnowfallRuntime } from '../systems/snowfallRuntime.js';
import { SnowBuildClient } from '../systems/snowfall/snowBuildClient.js';   // SNOW-THREAD: the ring's and the window's builds on a worker
import { SnowfallSurface } from '../render/snowfallSurface.js';
import { getWorldClimateSettings, worldCoordToMapPixel } from '../formats/mapsFile.js';
import { getLocationTerrainTileOrigin } from '../world/terrain/terrainTiles.js';
import { weatherFlags } from '../world/weather.js';   // WeatherManager.IsSnowing, from its one home
import { APP_ROOT } from '../systems/appRoot.js';
import { winterGroundSnowless, dfmodGeneration } from '../systems/dfmodTextures.js';   // SNOWLESS1

/** DynamicSnowMod's console command (ConsoleCommandsDatabase.RegisterCommand). */
export const SNOWFALL_COMMAND = Object.freeze({ name: 'snow_status', description: 'Print Dynamic Snow stamping and mask state.', usage: 'snow_status' });
/** The mod on: its switch (General.Enabled), `?snowfall=off` the kill door. */
export const snowfallOn = (search) => modSetting(SNOWFALL_VENDOR, 'Enabled') === true && pageParam('snowfall', search) !== 'off';
/** DynamicSnowSaveData's fields, as NewSaveData makes them. */
export const newSnowfallSaveData = () => ({ FormatVersion: 1, CellCount: 0, PackedCells: '', SnowpackFormatVersion: 0, SettlementDepth: 0, WildernessDepth: 0, PhaseProgressSeconds: 0, PhaseWasSnowing: false });

const artUrl = (name) => new URL(`art/snowfall/${name}`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;
/** The mod's three surface masks (snow_surface_masks_<archive>.bytes, 229,376 bytes each), served under art/snowfall/. */
async function defaultMasks() {
  return Promise.all(SNOW_MASK_ARCHIVES.map(async (a) => {
    const r = await fetch(artUrl(`snow_surface_masks_${a}.bytes`));
    if (!r.ok) throw new Error(`snow_surface_masks_${a}.bytes: ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  }));
}
/** The mod's albedo (snow_albedo.png), decoded bottom row first - a Unity texture's v = 0 is its picture's last row,
 *  and WebGL ignores UNPACK_FLIP_Y_WEBGL for an ImageBitmap, so the flip is the decode's (its bytes as authored). AUDIT
 *  ENVIRONS G3: it was drawn mirrored north to south. */
async function defaultAlbedo() {
  const r = await fetch(artUrl('snow_albedo.png'));
  if (!r.ok) throw new Error(`snow_albedo.png: ${r.status}`);
  return createImageBitmap(await r.blob(), { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
}

/**
 * @typedef {object} SnowGround - what a host stands the snow on
 * @property {(x: number, z: number) => any} pixelAt - its ground's tile (a map pixel's) under a scene point, or null
 * @property {(ring: number) => any[]} pixelsNear - the tiles within `ring` of the player's, nearest ring first (the player's own first)
 * @property {(x: number, y: number) => any} pixelOn - the tile standing on a map pixel, or null (StreamingWorld.GetTerrainFromPixel)
 * @property {(p: any, out: number[]) => number[]} translation - a tile's scene origin (its south-west corner) now
 * @property {(p: any, lx: number, lz: number) => number} height - the drawn ground's y there, in the tile's frame
 * @property {(p: any, lx: number, lz: number, out: number[]) => number[]} normal - its unit normal
 * @property {(p: any) => Uint8Array} tileMap - the tile's DaggerfallTerrain.TileMap bytes (128 x 128, row 0 south)
 * @property {(p: any) => number} climate - its map pixel's climate index
 * @property {(p: any) => { x: number, y: number }} mapPixel
 * @property {(p: any) => any} [stamp] - changes when the tile's ground was rebuilt (a new TileMap, a new stride)
 * @property {(p: any, lx: number, lz: number) => boolean} [bare] - no snow there whatever the tile says
 * @property {(p: any) => ({ roads: number, roadCorners: number, paths: number, pathCorners: number, authored: ArrayLike<boolean>, rect: any }|null)} [roads] - its Basic Roads network
 * @property {(x: number, z: number) => number[]} toGlobal - a scene point in global metres
 * @property {(minX: number, minZ: number, maxX: number, maxZ: number) => any[]} settlements - vanilla locations' rectangles (global metres)
 * @property {number} [size] - a tile's side, metres (819.2)
 * @property {number} [terrainDistance]
 * @property {(p: any) => any} [data] - SNOW-THREAD: what systems/snowfall/snowGroundLaw.js reads of the tile (snowGroundSnapshot) - present only where `height`, `normal` and `bare` are those laws over it
 * @property {() => number[]} [frame] - SNOW-THREAD: [map origin x, y, compensation x, z, pixel size] - pixelAt's and toGlobal's inputs (snowGroundLaw.js snowPixelX, snowGlobalOf)
 */

/** The host standing now. A boot claims the frame and kills the loop before it (scenes/shared.js claimFrame), and that
 *  loop's draw never runs again - so the next host built lets this one's GPU surfaces go (EVERY ALLOCATION HAS AN
 *  OWNER: the teardown is on the path that ends it; an unwind's navigation takes the page with it). */
let standing = null;

/**
 * The runtime. `gl` and `renderer` the host's (none: nothing drawn), `enhanced` the host's lane (the mod is the
 * enhanced outdoors' - off it nothing stands), `ground` the host's SnowGround, `loadMasks` / `loadAlbedo` the mod's
 * files (a test's stand-ins).
 */
export function createSnowfallHost({ gl = null, renderer = null, enhanced = false, ground = null, loadMasks = defaultMasks, loadAlbedo = defaultAlbedo } = {}) {
  standing?.dispose();
  let gen = -1, settings = snowfallSettings();
  let runtime = null, surface = null, pending = null, failed = false, asked = false, disposed = false;
  let builds = null;             // SNOW-THREAD: the build worker's client, where the ground can be copied to it
  let wasInside = null, lastFrame = null, gameSecondsNow = 0, frameNo = 0, nextPrune = 0;
  let roadStatus = 'not sampled';   // AUDIT ENVIRONS S6: BasicRoadsContextCache.Status - the last tile's classification's word
  let climateNow = -1, desertNow = false, doorNow = -1;   // the climate's base type, read when the climate index changes
  let broken = false;            // AUDIT ENVIRONS I5: a frame threw: the snow stops there (its save kept), the host's frame never with it
  let completePending = false;   // AUDIT ENVIRONS S2: a session begun (a load, a new game, the runtime's first frame): CompleteSession on the next frame's clock
  const promotions = [];         // AUDIT ENVIRONS S5: [tile, replaced, ...] - rebuilds found while the runtime asked for a tile, heard once its frame is done
  const tiles = new WeakMap();   // a host tile -> its SnowTerrain
  const byPixel = new Map();     // "x,y" -> the SnowTerrain last made on that map pixel: a rebuilt tile's new one replaces it
  const bodies = new Map();      // a body's key -> its impression's handle { id, x, z (global metres), alive() }
  let lying = new Set();         // the bodies' keys lying this frame - a handle is alive while its key is among them
  const size = ground?.size ?? 819.2;

  /** The settings, read again only when one was written (modSettingsGeneration) - LoadSettingsCallback. */
  function readSettings() {
    const g = modSettingsGeneration();
    if (g !== gen) { gen = g; settings = snowfallSettings(); runtime?.applySettings(settings); }
    return settings;
  }

  /** A host tile as the runtime reads it (systems/snowfallRuntime.js SnowTerrain), made once a tile and stamp - the
   *  stamp asked once a frame. A tile made again (its stamp moved: a new stride, a new TileMap) or a map pixel's new
   *  tile (its entry rebuilt) is DaggerfallTerrain.OnPromoteTerrainData's: the runtime hears it replace the old one. */
  function terrainOf(p) {
    if (!p) return null;
    const had = tiles.get(p);
    if (had && had.seen === frameNo) return had;
    const stamp = ground.stamp?.(p) ?? 0;
    if (had && had.stamp === stamp) { had.seen = frameNo; return had; }
    const px = ground.mapPixel(p);
    let roadsMade = false, roads = null;
    const cs = getWorldClimateSettings(ground.climate(p));
    const winterArchive = winterArchiveOf(cs);
    // SNOWLESS1: its winter set drawn without snow - no snow lies on it; nor on a desert's ground, which wears no winter set
    // (climateSwaps.js groundIsSnowy) - the mod's unmasked ground counts as snowed, and laid snow over the desert's edge
    const snowless = cs?.climateType === 0 || winterGroundSnowless(winterArchive);
    const t = {
      mapX: px.x, mapY: px.y, size, stamp, seen: frameNo, replaced: false,
      tileMap: ground.tileMap(p),
      winterArchive,
      origin: (out) => ground.translation(p, out),
      height: (lx, lz) => ground.height(p, lx, lz),
      normal: (lx, lz, out) => ground.normal(p, lx, lz, out),
      bare: snowless ? () => true : ground.bare ? (lx, lz) => ground.bare(p, lx, lz) : undefined,
      // SNOW-THREAD: the tile as the build worker reads it - `bare` as above, the ground snowGroundLaw.js's over its data
      snapshot: ground.data ? () => ({ mapX: t.mapX, mapY: t.mapY, size, tileMap: t.tileMap, winterArchive, bare: snowless ? 'all' : ground.bare ? 'ground' : null, ground: ground.data(p) }) : null,
      get roads() {   // BasicRoadsContextCache.Get: classified once a tile (TryCreate: a reason, and no roads, where it fails)
        if (!roadsMade) {
          roadsMade = true;
          try {
            const net = ground.roads?.(p) ?? null;
            if (!net) roadStatus = 'absent/disabled';   // BasicRoadsBridge.TryReadNetwork: no Basic Roads network
            else if (t.tileMap?.length === 16384) { roads = new BasicRoadsTerrain(t.mapX, t.mapY, t.tileMap, net.authored, net, net.rect ?? { xMin: 0, xMax: 0, yMin: 0, yMax: 0 }); roadStatus = 'ready'; }
            else roadStatus = 'promoted terrain unavailable';
          } catch (e) { roads = null; roadStatus = `classification unavailable: ${e?.message ?? e}`; }
        }
        return roads;
      },
    };
    tiles.set(p, t);
    const key = `${t.mapX},${t.mapY}`;
    const was = had ?? byPixel.get(key) ?? null;
    byPixel.set(key, t);
    // OnPromoteTerrainData: its ground was rebuilt. The event is never the runtime's own frame's (DFU raises it from the
    // streaming world's), so one found while a build asked for the tile is heard when that frame is done (flushPromotions)
    // SNOW-HOLD (FIELD BUGS 2026-10-21b): `replaced` says THAT it replaced one - the old tile goes to the runtime through
    // `promotions` alone; held here, each tile kept the one before it, and every rebuild of a pixel stood in one chain
    if (was && was !== t) { t.replaced = true; if (runtime) promotions.push(t, was); }
    return t;
  }
  /** The rebuilds found since the runtime last heard: each a tile replacing the one its map pixel stood before. */
  function flushPromotions(now) {
    for (let i = 0; i < promotions.length; i += 2) runtime?.terrainPromoted(promotions[i], now, promotions[i + 1]);
    promotions.length = 0;
  }
  const world = ground && {
    terrainAt: (x, z) => terrainOf(ground.pixelAt(x, z)),
    terrainsNear: (ring) => ground.pixelsNear(ring).map(terrainOf).filter(Boolean),
    terrainsIn: (minX, minZ, maxX, maxZ) => {   // AUDIT ENVIRONS S1: SnowContextData.Prepare's scan - the box's map pixels row by row, each its loaded tile
      const b = snowPixelBox(minX, minZ, maxX, maxZ), out = [];
      for (let y = b.y0; y <= b.y1; y++) {
        for (let x = b.x0; x <= b.x1; x++) { const t = terrainOf(ground.pixelOn?.(x, y) ?? null); if (t && t.mapX === x && t.mapY === y) out.push(t); }
      }
      return out;
    },
    toGlobal: (x, z) => ground.toGlobal(x, z),
    terrainOn: (px, py) => terrainOf(ground.pixelOn?.(px, py) ?? null),   // SNOW-THREAD: the tile terrainAt answers on a map pixel
    frame: ground.frame ? () => ground.frame() : undefined,
    settlements: (a, b, c, d) => ground.settlements(a, b, c, d),
    footprints: () => [],   // LocationLoaderBridge: Location Loader is not the port's - none stand
    get terrainDistance() { return ground.terrainDistance ?? 3; },   // StreamingWorld.TerrainDistance, read when asked (a host's view distance can move)
  };

  /** The bodies lying outdoors this frame (`list` [{ key, pos }] - scene, the marker's ground; the exterior's bodies,
   *  WorldContext.Exterior, whether the player is out or in): a body first seen is HandleEnemyDeath's, the list the
   *  scan's (FindObjectsOfType<DaggerfallLoot>); a body gone from the list is a destroyed loot container - its handle
   *  dead, its hollow refilling. */
  function bodiesOf(list) {
    lying = new Set();
    for (const c of list ?? []) {
      lying.add(c.key);
      if (bodies.has(c.key)) continue;
      const [gx, gz] = world.toGlobal(c.pos[0], c.pos[2]);
      const key = c.key;
      const h = { id: key, x: gx, z: gz, alive: () => lying.has(key) };
      bodies.set(key, h);
      runtime.enemyDied(h);
    }
    for (const k of bodies.keys()) if (!lying.has(k)) bodies.delete(k);
  }

  /** SHADER-STALL (render/glProgram.js startPrograms): the snow's surface, made the first time its program's compile is
   *  done (`snowReady`, started as the masks land) - the frame the masks landed in waited the whole compile, 0.3-5.6 s of
   *  the real game's first seconds here. Built where AUDIT ENVIRONS I5 built it: a driver that will not build the program
   *  costs the snow, never the frame. */
  let snowReady = null, albedoIn = null;
  function makeSurface() {
    snowReady = null;
    try {   // AUDIT ENVIRONS I5: the snow's program built now, beside its surface - a driver that will not build it costs the snow, never the frame
      renderer.prepareTerrainSnow?.();
      surface = new SnowfallSurface(gl, renderer);
      if (albedoIn) surface.setAlbedo(albedoIn);
    } catch (e) { surface?.dispose(); surface = null; console.warn('[snowfall] the snow surface would not build - the snow is kept, never drawn:', e?.message ?? e); }
  }

  function start() {
    if (asked || !enhanced || !world) return;
    asked = true;
    Promise.all([Promise.resolve().then(() => loadMasks()), gl ? Promise.resolve().then(() => loadAlbedo()) : null])
      .then(([masks, albedo]) => {
        if (disposed) return;   // a later boot's host stands now
        const settings0 = readSettings();
        if (ground.data && ground.frame) builds = new SnowBuildClient({ masks, settings: settings0 });
        runtime = new SnowfallRuntime({ world, coverage: new SnowCoverage(masks), settings: settings0, builds });
        if (gl && renderer) {
          albedoIn = albedo;
          snowReady = renderer.startTerrainSnow?.() ?? (() => true);   // SHADER-STALL: its program started now, the surface made once it is compiled
          if (snowReady()) makeSurface();
        }
        if (pending) { runtime.restoreSaveData(pending, 0); pending = null; }
        completePending = true;   // the mod's late Initialize: RestoreTrackData, then CompleteSession - on the frame's own clock
      })
      .catch((e) => { failed = true; console.warn('[snowfall] the surface masks would not load - the snow stands nowhere:', e?.message ?? e); });
  }

  registerModSaveData(SNOWFALL_VENDOR, {
    newSaveData: newSnowfallSaveData,
    getSaveData: () => (runtime ? runtime.writeSaveData(newSnowfallSaveData()) : (pending ?? newSnowfallSaveData())),
    // OnStartLoad's BeginSession and RestoreSaveData (CanSimulate false: the snowpack's clock at 0); OnLoad's CompleteSession
    // on the loaded game's clock - the next frame's, as a host restores the save's time after the mods' records
    restoreSaveData: (data) => {
      const d = data ?? newSnowfallSaveData();
      if (!runtime) { pending = d; return; }
      runtime.beginSession();
      if (!runtime.restoreSaveData(d, 0)) console.warn('[Dynamic Snow] ignored malformed or unsupported persistent track data.');
      completePending = true;
    },
    newGame: () => { pending = null; if (runtime) { runtime.beginSession(); completePending = true; } },   // OnNewGame's BeginSession; OnStartGame's CompleteSession
  });
  registerCommand(SNOWFALL_COMMAND.name, SNOWFALL_COMMAND.description, SNOWFALL_COMMAND.usage, () => (runtime
    ? runtime.status(lastFrame, { climate: lastFrame ? climateNow : null, ambient: renderer?.ambientLight ?? null, surface: !!surface, uploads: surface?.localUploads ?? 0, roads: roadStatus })
    : 'Dynamic Snow controller is not initialized.'));
  gateConsoleCommand(SNOWFALL_COMMAND.name, () => enhanced && snowfallOn());

  /** The frame's work (DynamicSnowController.Update's), once the runtime stands. */
  function tick(f) {
    frameNo++;
    const s = readSettings();
    const inside = !!f.inside;
    if (wasInside !== null && inside !== wasInside) runtime.worldReset();   // HandleTransitionInterior / Exterior
    wasInside = inside;
    const ci = f.climate ?? 0;
    if (ci !== climateNow || dfmodGeneration() !== doorNow) {   // SNOWLESS1: a snowless winter set stands no snow, as the desert
      climateNow = ci; doorNow = dfmodGeneration();
      const cs = getWorldClimateSettings(ci);
      desertNow = cs?.climateType === 0 || winterGroundSnowless(winterArchiveOf(cs));
    }
    const enabled = s.enabled && snowfallOn();
    bodiesOf(typeof f.corpses === 'function' ? f.corpses() : f.corpses);
    const npcs = f.npcs;
    // TV-SNOW (FIELD BUGS 2026-10-09, Shabalako: "after traveling for a while I get low framerates"): UNDER THE OVERWORLD
    // (`overworld`, world.js's travel view) no snow is drawn, so the controller is handed no player - its own law for a
    // frame with none, the switch's: the tiers stand down, and the snowpack and the refill keep the event clock frame by
    // frame - and the GPU's share waits for the first frame that draws (below). It sampled, committed and uploaded the
    // window and the ring round a traveller crossing the land at the journey's x60, for a picture nobody saw.
    const overworld = !!f.overworld;
    const frame = {
      now: f.now, inside, enabled, player: enabled && !overworld ? f.player ?? null : null,   // the switch off: the surfaces hidden, the snowpack still kept
      rawPlayer: f.player ?? null,   // the motor's, for snow_status
      winter: !!f.winter, desert: desertNow, snowing: weatherFlags(f.weather).snowing, gameSeconds: gameSecondsNow,
      get npcs() { return (typeof npcs === 'function' ? npcs() : npcs) ?? []; },   // asked at the NPC sample's pace (every 0.1 s)
      get corpses() { return [...bodies.values()]; },   // the scan's list
    };
    lastFrame = frame;
    if (completePending) { completePending = false; runtime.completeSession(gameSecondsNow, frame.snowing, f.now); }
    runtime.frame(frame);
    flushPromotions(f.now);
    // the GPU's share outdoors alone, where the hosts call this before their world frame opens (beginFrame forgets
    // every shadow of the renderer's an upload could move); indoors nothing is drawn, and the uploads wait for the door -
    // TV-SNOW: and under the Overworld, for the view to come down (what changed meanwhile stays marked, and goes up then)
    if (!inside && !overworld) surface?.sync(runtime, f.now);
    if (f.now >= nextPrune) {   // a map pixel left far behind can no longer be replaced: its last tile let go
      nextPrune = f.now + 5;
      const near = new Set(world.terrainsNear(Math.max(4, (world.terrainDistance ?? 3) + 1)).map((t) => `${t.mapX},${t.mapY}`));
      for (const k of byPixel.keys()) if (!near.has(k)) byPixel.delete(k);
      flushPromotions(f.now);
    }
  }

  const host = {
    get runtime() { return runtime; },
    get surface() { return surface; },
    get failed() { return failed; },
    /**
     * The frame. `f` { now (real seconds), inside, player { x, y, z, grounded, swimming, levitating } (scene, feet) or
     * null, weather (the port's word), seconds (the event clock's game seconds - the snow's pace, as the weather's),
     * winter (the sky's season), climate (the map's climate index at the player), overworld (TV-SNOW: the travel view
     * is up - no snow is drawn: the clocks alone, the GPU's share held), npcs, corpses }.
     */
    frame(f) {
      if (!enhanced || !world || disposed || broken) return;
      gameSecondsNow = Math.floor(f.seconds ?? 0);
      start();
      if (!runtime) return;
      if (snowReady?.()) makeSurface();   // SHADER-STALL: the surface the frame its program is compiled
      try { tick(f); } catch (e) {
        broken = true; surface?.dispose(); surface = null;
        console.warn('[snowfall] a snow frame threw - the snow stops here, its save kept:', e?.stack ?? e);
      }
    },
    /** DaggerfallTerrain.OnPromoteTerrainData: a host tile stood (its pixel built, or built again) - its blanket is to
     *  make, and the nearer tiers over it build again. A tile replacing an older one on its map pixel says so itself. */
    promoted(p) {
      if (!runtime || !p || broken) return;
      const fresh = !tiles.has(p);
      const t = terrainOf(p);
      if (t && fresh && !t.replaced) runtime.terrainPromoted(t, lastFrame?.now ?? 0, null);
      flushPromotions(lastFrame?.now ?? 0);
    },
    /** DynamicSnowController's HandleEnemyDeath: a foe fallen outdoors - `corpse` { id, x, z (global metres), alive() }. */
    enemyDied(corpse) { runtime?.enemyDied(corpse); },
    /** Draw the snow (with the opaque world, before the ground under it) - the renderer's own draws (drawSnow), no seam
     *  owed. `outside` the host's frustum test for a blanket tile's bounds (snowfallSurface.js draw), or none. Answers
     *  whether any surface was drawn. A draw that throws (a lane's program that will not build) lets the surface go, once. */
    draw(outside = null) {
      if (!surface || !runtime || broken) return false;
      try { return surface.draw(runtime, outside); } catch (e) {
        console.warn('[snowfall] the snow would not draw - its surface is let go:', e?.message ?? e);
        surface.dispose(); surface = null;
        return false;
      }
    },
    /** FloatingOrigin.OnPositionUpdate. */
    offsetOrigin(offset) { runtime?.offsetOrigin(offset); },
    /** The world under the snow was rebuilt (a fast travel, a load's arrival) - every tier stands again. */
    worldReset() { runtime?.worldReset(); },
    /** Its GPU surfaces let go - the next host built calls it (above); nothing it holds is drawn again. */
    dispose() { disposed = true; surface?.dispose(); surface = null; builds?.dispose(); builds = null; if (standing === host) standing = null; },
  };
  standing = host;
  return host;
}

/** The road network round a map pixel, as BasicRoadsBridge.TryReadNetwork answers it: the pixel's road and track
 *  bits, and its corners from its west and east neighbours'. `net` the Bay's network (world/roadsProducer.js:
 *  `roads`, `tracks`, 1000 x 500 bytes) - the mod asks the Basic Roads MOD, so with its switch off there is none
 *  (the rule World of Daggerfall's LocationLoader keeps, world.js wodPathsPoint). BAY-LEFT-GROUND: and a crossing's
 *  join on its road bits (`joinAt`, world/arenaRoads.js arenaJoinByte - TESA5's road carried out to the Bay's edge,
 *  straight, which the ground paints there: world/terrain/terrainGen.js), so the snow knows the road the ground draws;
 *  no join, the Bay's own byte for byte. */
export function snowfallNetwork(net, x, y, joinAt = arenaJoinByte) {
  if (!net) return null;
  const at = (a, px) => (px >= 0 && px < 1000 && y >= 0 && y < 500 ? a[px + y * 1000] : 0);
  return {
    roads: at(net.roads, x) | joinAt(x, y), paths: at(net.tracks, x),
    roadCorners: roadCorners(at(net.roads, x - 1), at(net.roads, x + 1)),
    pathCorners: roadCorners(at(net.tracks, x - 1), at(net.tracks, x + 1)),
  };
}

/** A tile the curve painter paves (world/road/roadCurves.js pavedTile: Basic Roads' road and its diagonal flanks). */
const PAVED_RECORDS = Object.freeze([46, 47, 55]);
/** How far a track's own tile's centre may lie off its curve: a corner within TRACK_HALF wears (paintCurvedPaths), and a
 *  tile two of whose corners wear has its centre within TRACK_HALF + half a tile's diagonal of it. */
const TRACK_TILE_REACH = TRACK_HALF + Math.SQRT1_2;

/**
 * BAY-LEFT-GROUND (the audit "no system left behind in the Bay", D3): THE ROADS PAST THE BAY, FOR THE SNOW - TESA's own
 * layer (world/arenaRoads.js arenaRoadByte, TESA14's roads at the Bay's own law and scale - the one reader the Travel
 * Options' paths read past the table too), as BasicRoadsBridge.TryReadNetwork would answer a network of them. Past the
 * Bay the roads are drawn as CURVES (VOYAGER2), whose tiles no Basic Roads arm predicts, so a tile is classified by the
 * painter's own word (`painted`, the build's GRASS-PATH1 record of the tiles it wrote): a paved tile a road's, a worn one
 * within a track's reach of its curve (curveField, the painter's own field) a track's; a road's worn shoulder neither
 * (the berm lies over it). Null where the pixel's build painted nothing. Departure: the mod reads Basic Roads' network,
 * which is the Bay's alone; past the Bay the land's own roads stand in its place.
 * @param {number} x @param {number} y @param {?ArrayLike<number>} painted
 * @param {(kind: 'roads'|'tracks', x: number, y: number) => number} [byteAt]
 */
export function snowfallNetworkBeyond(x, y, painted, byteAt = arenaRoadByte) {
  if (!painted) return null;
  const road = byteAt('roads', x, y), track = byteAt('tracks', x, y);
  const tracks = curveField(x, y, track, (a, b) => byteAt('tracks', a, b));
  const kindAt = (tx, tz, tile) => {
    const t = tz * CURVE_DIM + tx;
    if (!painted[t]) return ROAD_KIND.none;
    if (PAVED_RECORDS.includes(tile >> 2)) return ROAD_KIND.road;
    return tracks && tracks.tiles[t] <= TRACK_TILE_REACH ? ROAD_KIND.path : ROAD_KIND.none;
  };
  return { roads: road, paths: track, roadCorners: 0, pathCorners: 0, kindAt };
}

/** BasicRoadsTerrain.TryCreate's authored scan: every block of `location` marked from its tile origin
 *  (TerrainHelper.GetLocationTerrainTileOrigin). Throws where a block will not read ("Authored block unavailable") -
 *  the pixel is then not classified, and no road or track lies under its snow. The block's name is BlocksFile.CheckName's,
 *  as the ground stamped under it is (world/terrain/terrainTiles.js setLocationTiles). */
export function authoredTiles(location, mapsFile, blocksFile, authored = new Uint8Array(16384)) {
  const o = getLocationTerrainTileOrigin(location);
  const { width, height } = location.exterior.exteriorData;
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const name = blocksFile.checkName(mapsFile.getRmbBlockName(location, j, i));
      const index = blocksFile.getBlockIndex(name);
      if (index === -1) throw new Error(`Authored block unavailable: ${name}`);
      markAuthoredBlock(authored, blocksFile.getBlock(index).rmbBlock.fldHeader.groundData.groundTiles, o.x + j * 16, o.y + i * 16);
    }
  }
  return authored;
}

/** SnowContextData.Prepare's scan: the vanilla locations' rectangles (global metres) on the map pixels a global box
 *  touches. `at(x, y)` the location standing on a map pixel (ContentReader.HasLocation + GetLocation), or null. */
export function settlementsIn(at, minX, minZ, maxX, maxZ) {
  const { x0, x1, y0, y1 } = snowPixelBox(minX, minZ, maxX, maxZ);
  const out = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const loc = at(x, y);
      const d = loc?.exterior?.exteriorData;
      if (loc && isVanillaLocation(loc.mapTableData?.locationType ?? Infinity) && d?.width && d?.height) out.push(locationRect(x, y, getLocationTerrainTileOrigin(loc), d.width, d.height));
    }
  }
  return out;
}

/** The farthest pixel of the world's grid from the Bay's corner, either way (world/worldWide/worldGrid.js inWorldGrid). */
const GRID_EDGE = WORLD_PIXEL_SPAN - 1;
const onGrid = (v) => Math.max(-GRID_EDGE, Math.min(GRID_EDGE, v));

/** SnowContextData.Prepare's box on the map: the map pixels (clamped to the map) a global box in metres touches -
 *  MapsFile.WorldCoordToMapPixel of its corners in world units, its rows running north to south. BAY-LEFT-GROUND: the
 *  map is the world's grid (world/worldWide/worldGrid.js), not the Bay's 1000 x 500 - clamped to it, a box past the Bay
 *  answered nothing but the Bay's corner pixel, and no snow lay deep, kept a track or banked a road anywhere past it. */
export function snowPixelBox(minX, minZ, maxX, maxZ) {
  const a = worldCoordToMapPixel(Math.trunc(minX * 40), Math.trunc(minZ * 40)), b = worldCoordToMapPixel(Math.trunc(maxX * 40), Math.trunc(maxZ * 40));
  return {
    x0: onGrid(Math.min(a.x, b.x)), x1: onGrid(Math.max(a.x, b.x)),
    y0: onGrid(Math.min(a.y, b.y)), y1: onGrid(Math.max(a.y, b.y)),
  };
}
