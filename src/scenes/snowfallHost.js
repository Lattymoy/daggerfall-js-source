// SNOWFALL1 (2026-10-08, Mac: "These should be on by default and integrate into our enhanced environments
// seamlessly") - SNOWFALL IN A HOST: the one runtime both exterior hosts (scenes/world.js, scenes/exterior.js) build -
// the mod's law (systems/snowfall.js), its controller (systems/snowfallRuntime.js), its surface on the GPU (render/
// snowfallSurface.js, drawn through the renderer's snow program), its save record and its console command
// (snow_status). A host hands it the ground it stands (`ground`, below) and calls `frame` once a frame, outdoors and in;
// it draws the snow with the opaque world, after the ground (`draw`), and carries it across the floating origin.
//
// THE FOUR HOSTS RULE (bible/Home.md): world.js and exterior.js build it; worldModes.js (the interiors) and
// dungeonContext.js (the dungeons) do not - indoors and underground the host's own frame calls `frame` with
// `inside: true`, which is all the mod does there (DynamicSnowController.Update: the surfaces hidden, the snowpack and
// the refill still kept by the clock).

import { modSettingsGeneration, modSetting } from '../systems/modSettings.js';
import { registerModSaveData } from '../systems/modSaveData.js';
import { registerCommand, gateConsoleCommand } from '../systems/consoleCommands.js';
import { pageParam } from '../systems/pageQuery.js';
import { SnowCoverage, BasicRoadsTerrain, roadCorners, snowfallSettings, winterArchiveOf, markAuthoredBlock, locationRect, isVanillaLocation, SNOWFALL_VENDOR, SNOW_MASK_ARCHIVES } from '../systems/snowfall.js';
import { SnowfallRuntime } from '../systems/snowfallRuntime.js';
import { SnowfallSurface } from '../render/snowfallSurface.js';
import { getWorldClimateSettings, worldCoordToMapPixel } from '../formats/mapsFile.js';
import { getLocationTerrainTileOrigin } from '../world/terrainTiles.js';
import { weatherFlags } from '../world/weather.js';   // WeatherManager.IsSnowing, from its one home
import { APP_ROOT } from '../systems/appRoot.js';

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
/** The mod's albedo (snow_albedo.png). */
async function defaultAlbedo() {
  const r = await fetch(artUrl('snow_albedo.png'));
  if (!r.ok) throw new Error(`snow_albedo.png: ${r.status}`);
  return createImageBitmap(await r.blob());
}

/**
 * @typedef {object} SnowGround - what a host stands the snow on
 * @property {(x: number, z: number) => any} pixelAt - its ground's tile (a map pixel's) under a scene point, or null
 * @property {(ring: number) => any[]} pixelsNear - the tiles within `ring` of the player's, nearest ring first (the player's own first)
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
  let wasInside = null, lastFrame = null, gameSecondsNow = 0, frameNo = 0, nextPrune = 0;
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
    const t = {
      mapX: px.x, mapY: px.y, size, stamp, seen: frameNo, replaced: null,
      tileMap: ground.tileMap(p),
      winterArchive: winterArchiveOf(getWorldClimateSettings(ground.climate(p))),
      origin: (out) => ground.translation(p, out),
      height: (lx, lz) => ground.height(p, lx, lz),
      normal: (lx, lz, out) => ground.normal(p, lx, lz, out),
      bare: ground.bare ? (lx, lz) => ground.bare(p, lx, lz) : undefined,
      get roads() {   // BasicRoadsContextCache.Get: classified once a tile (TryCreate: a reason, and no roads, where it fails)
        if (!roadsMade) {
          roadsMade = true;
          try {
            const net = ground.roads?.(p) ?? null;
            if (net && t.tileMap?.length === 16384) roads = new BasicRoadsTerrain(t.mapX, t.mapY, t.tileMap, net.authored, net, net.rect ?? { xMin: 0, xMax: 0, yMin: 0, yMax: 0 });
          } catch { roads = null; }
        }
        return roads;
      },
    };
    tiles.set(p, t);
    const key = `${t.mapX},${t.mapY}`;
    const was = had ?? byPixel.get(key) ?? null;
    byPixel.set(key, t);
    if (was && was !== t) { t.replaced = was; if (runtime) runtime.terrainPromoted(t, lastFrame?.now ?? 0, was); }   // OnPromoteTerrainData: its ground was rebuilt
    return t;
  }
  const world = ground && {
    terrainAt: (x, z) => terrainOf(ground.pixelAt(x, z)),
    terrainsNear: (ring) => ground.pixelsNear(ring).map(terrainOf).filter(Boolean),
    toGlobal: (x, z) => ground.toGlobal(x, z),
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

  function start() {
    if (asked || !enhanced || !world) return;
    asked = true;
    Promise.all([Promise.resolve().then(() => loadMasks()), gl ? Promise.resolve().then(() => loadAlbedo()) : null])
      .then(([masks, albedo]) => {
        if (disposed) return;   // a later boot's host stands now
        runtime = new SnowfallRuntime({ world, coverage: new SnowCoverage(masks), settings: readSettings() });
        if (gl && renderer) { surface = new SnowfallSurface(gl, renderer); if (albedo) surface.setAlbedo(albedo); }
        if (pending) { runtime.restoreSaveData(pending, gameSecondsNow); pending = null; }
        runtime.completeSession(gameSecondsNow, false);
      })
      .catch((e) => { failed = true; console.warn('[snowfall] the surface masks would not load - the snow stands nowhere:', e?.message ?? e); });
  }

  registerModSaveData(SNOWFALL_VENDOR, {
    newSaveData: newSnowfallSaveData,
    getSaveData: () => (runtime ? runtime.writeSaveData(newSnowfallSaveData()) : (pending ?? newSnowfallSaveData())),
    restoreSaveData: (data) => {   // OnStartLoad's BeginSession, RestoreSaveData, OnLoad's CompleteSession
      const d = data ?? newSnowfallSaveData();
      if (!runtime) { pending = d; return; }
      runtime.beginSession();
      if (!runtime.restoreSaveData(d, gameSecondsNow)) console.warn('[Dynamic Snow] ignored malformed or unsupported persistent track data.');
      runtime.completeSession(gameSecondsNow, false);
    },
    newGame: () => { pending = null; if (runtime) { runtime.beginSession(); runtime.completeSession(gameSecondsNow, false); } },
  });
  registerCommand(SNOWFALL_COMMAND.name, SNOWFALL_COMMAND.description, SNOWFALL_COMMAND.usage, () => (runtime ? runtime.status(lastFrame) : 'Dynamic Snow controller is not initialized.'));
  gateConsoleCommand(SNOWFALL_COMMAND.name, () => enhanced && snowfallOn());

  const host = {
    get runtime() { return runtime; },
    get surface() { return surface; },
    get failed() { return failed; },
    /**
     * The frame. `f` { now (real seconds), inside, player { x, y, z, grounded, swimming, levitating } (scene, feet) or
     * null, weather (the port's word), seconds (the event clock's game seconds - the snow's pace, as the weather's),
     * winter (the sky's season), climate (the map's climate index at the player), npcs, corpses }.
     */
    frame(f) {
      if (!enhanced || !world || disposed) return;
      gameSecondsNow = Math.floor(f.seconds ?? 0);
      start();
      if (!runtime) return;
      frameNo++;
      const s = readSettings();
      const inside = !!f.inside;
      if (wasInside !== null && inside !== wasInside) runtime.worldReset();   // HandleTransitionInterior / Exterior
      wasInside = inside;
      const climate = getWorldClimateSettings(f.climate ?? 0);
      const enabled = s.enabled && snowfallOn();
      bodiesOf(typeof f.corpses === 'function' ? f.corpses() : f.corpses);
      const npcs = f.npcs;
      const frame = {
        now: f.now, inside, enabled, player: enabled ? f.player ?? null : null,   // the switch off: the surfaces hidden, the snowpack still kept
        winter: !!f.winter, desert: climate?.climateType === 0, snowing: weatherFlags(f.weather).snowing, gameSeconds: gameSecondsNow,
        get npcs() { return (typeof npcs === 'function' ? npcs() : npcs) ?? []; },   // asked at the NPC sample's pace (every 0.1 s)
        get corpses() { return [...bodies.values()]; },   // the scan's list
      };
      lastFrame = frame;
      runtime.frame(frame);
      // the GPU's share outdoors alone, where the hosts call this before their world frame opens (beginFrame forgets
      // every shadow of the renderer's an upload could move); indoors nothing is drawn, and the uploads wait for the door
      if (!inside) surface?.sync(runtime, f.now);
      if (f.now >= nextPrune) {   // a map pixel left far behind can no longer be replaced: its last tile let go
        nextPrune = f.now + 5;
        const near = new Set(world.terrainsNear(Math.max(4, (world.terrainDistance ?? 3) + 1)).map((t) => `${t.mapX},${t.mapY}`));
        for (const k of byPixel.keys()) if (!near.has(k)) byPixel.delete(k);
      }
    },
    /** DaggerfallTerrain.OnPromoteTerrainData: a host tile stood (its pixel built, or built again) - its blanket is to
     *  make, and the nearer tiers over it build again. A tile replacing an older one on its map pixel says so itself. */
    promoted(p) {
      if (!runtime || !p) return;
      const fresh = !tiles.has(p);
      const t = terrainOf(p);
      if (t && fresh && !t.replaced) runtime.terrainPromoted(t, lastFrame?.now ?? 0, null);
    },
    /** DynamicSnowController's HandleEnemyDeath: a foe fallen outdoors - `corpse` { id, x, z (global metres), alive() }. */
    enemyDied(corpse) { runtime?.enemyDied(corpse); },
    /** Draw the snow (after the ground, with the opaque world) - the renderer's own draws (drawSnow), no seam owed.
     *  Answers whether any surface was drawn. */
    draw() { return !!(surface && runtime && surface.draw(runtime)); },
    /** FloatingOrigin.OnPositionUpdate. */
    offsetOrigin(offset) { runtime?.offsetOrigin(offset); },
    /** The world under the snow was rebuilt (a fast travel, a load's arrival) - every tier stands again. */
    worldReset() { runtime?.worldReset(); },
    /** Its GPU surfaces let go - the next host built calls it (above); nothing it holds is drawn again. */
    dispose() { disposed = true; surface?.dispose(); surface = null; if (standing === host) standing = null; },
  };
  standing = host;
  return host;
}

/** The road network round a map pixel, as BasicRoadsBridge.TryReadNetwork answers it: the pixel's road and track
 *  bits, and its corners from its west and east neighbours'. `net` Basic Roads' own network (world/roadsProducer.js:
 *  `roads`, `tracks`, 1000 x 500 bytes) - the mod asks the Basic Roads MOD, so the port's generated fallback is not
 *  it (the rule World of Daggerfall's LocationLoader keeps, world.js wodPathsPoint). */
export function snowfallNetwork(net, x, y) {
  if (!net) return null;
  const at = (a, px) => (px >= 0 && px < 1000 && y >= 0 && y < 500 ? a[px + y * 1000] : 0);
  return {
    roads: at(net.roads, x), paths: at(net.tracks, x),
    roadCorners: roadCorners(at(net.roads, x - 1), at(net.roads, x + 1)),
    pathCorners: roadCorners(at(net.tracks, x - 1), at(net.tracks, x + 1)),
  };
}

/** BasicRoadsTerrain.TryCreate's authored scan: every block of `location` marked from its tile origin
 *  (TerrainHelper.GetLocationTerrainTileOrigin). Throws where a block will not read ("Authored block unavailable") -
 *  the pixel is then not classified, and no road or track lies under its snow. The block's name is BlocksFile.CheckName's,
 *  as the ground stamped under it is (world/terrainTiles.js setLocationTiles). */
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
  const a = worldCoordToMapPixel(Math.trunc(minX * 40), Math.trunc(minZ * 40)), b = worldCoordToMapPixel(Math.trunc(maxX * 40), Math.trunc(maxZ * 40));
  const x0 = Math.max(0, Math.min(999, Math.min(a.x, b.x))), x1 = Math.max(0, Math.min(999, Math.max(a.x, b.x)));
  const y0 = Math.max(0, Math.min(499, Math.min(a.y, b.y))), y1 = Math.max(0, Math.min(499, Math.max(a.y, b.y)));
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
