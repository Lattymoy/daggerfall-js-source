// HOST-SPLIT: moved verbatim out of src/scenes/world.js's bootWorld (bible/01-Overview/Host-Split.md) by tools/hostMove.mjs.
// The host constructs it where the code stood. What it reads of the host's scope comes through `host`: the
// settled names by value at construction, every live one (a `let` someone writes, a `const` made below) read at its
// use as `host.<name>` - as the code read them where it was.
import { applyClimate } from '../world/climateSwaps.js';
import { dungeonEntranceModel, dungeonModelSet, grownModelMatrix, modelFoot, owDungeonDrawn, owDungeonGrow, startDungeonLoads } from '../systems/travel/travelDungeonModels.js';
import { getLocationTerrainTileOrigin } from '../world/terrain/terrainTiles.js';
import { getWorldClimateSettings } from '../formats/mapsFile.js';
import { isClimateFreeModel, NO_CLIMATE_REMAP } from '../world/customModels.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { layoutLocation } from '../world/locationLayout.js';
import { nearDungeons, spawnedPixels } from '../systems/travel/travelDungeons.js';
import { remapSubMeshes } from '../world/texRemap.js';
import { transformedAabb } from '../render/frustum.js';

/** @param {any} host */
export function createTravelViewDungeonModels(host) {
  const {
    _tvDngModel, arch, archAabb, blocks, built, cpuModels, locationIndex, maps, pipeline, playerTravelPixel,
    renderer, state, tileSide, tvDungeonAt, tvDungeonRowsAt, tvFiledSpawns, tvGroundAt, tvGroundGenNow, tvKnownGen,
    tvPlaceSummary, tvSpawnFound, tvSpawnGone, tvSpawnKnown
  } = host;
  /** OW-DUNGEONS (2026-10-08, Mac: "with dungeons on the overworld it doesnt show a dungeon model"; "Its own model,
   *  enlarged"; systems/travel/travelDungeonModels.js, bible/06-Systems/Travel-View.md OW-DUNGEONS): THE DUNGEONS STANDING AS
   *  MODELS - TV6's own law (nearDungeons) with none left to TV2's grid (a found one there is a speck from the eye too)
   *  and a standing Abyss Dungeon among the spawns (its own host stands and takes it - it is known from its rise), the
   *  nearest TV_DUNGEON_MODELS_MAX; read again as TV6's is, when the pixel, the finds or the index move. */
  function tvDungeonModelList() {
    if (typeof host._tvListsReady !== 'undefined' && !host._tvListsReady) return [];   // BOOT-TDZ II (typeof: a slice lifted without the flag reads as standing)
    const at = playerTravelPixel(), dg = tvKnownGen(), n = host._locIndexGen;   // AUDIT ETHER-OW C2-2: the finds and the charts
    if (host.tvDngModels.list.some((g) => g.spawn && !g.loc?.superTier && tvSpawnGone(g.px, g.py))) host.tvDngModels.at = null;   // AUDIT OW4 D2's law: a spawn whose time ran out goes
    if (host.tvDngModels.at && host.tvDngModels.at.x === at.x && host.tvDngModels.at.y === at.y && host.tvDngModels.dg === dg && host.tvDngModels.n === n) return host.tvDngModels.list;
    const near = nearDungeons({ at, dungeons: tvDungeonRowsAt(at), locAt: tvDungeonAt, isFound: (x, y) => !!tvPlaceSummary(x, y),
      spawns: [...spawnedPixels(locationIndex), ...tvFiledSpawns(at)], spawnKnown: (s) => !!s.loc?.superTier || tvSpawnKnown(s), spawnFound: tvSpawnFound,
      spawnGone: (s) => !s.loc?.superTier && tvSpawnGone(s.x, s.y), max: Infinity });
    const list = dungeonModelSet(near).map((g) => ({ key: g.key, px: g.x, py: g.y, loc: g.loc, spawn: g.spawn }));
    host.tvDngModels = { at, dg, n, list };
    return list;
  }
  /** OW-DUNGEONS: a dungeon's model, loaded for the view - its blocks laid as its pixel's build lays them, its entrance
   *  model picked (dungeonEntranceModel), held by its own place (PLACE-LRU `owdungeon`) and dressed in its climate and
   *  the season as its pixel would (the bounty farm's way, BOUNTY-FARM); ready once its box is known. */
  function tvDungeonModelLoad(g) {
    const e = { key: g.key, px: g.px, py: g.py, ready: false, gpu: null, local: null, box: null, h: 0, texRemap: null, matrix: new Float32Array(16), hold: pipeline.holdPlace('owdungeon', g.key) };
    _tvDngModel.set(g.key, e);
    (async () => {
      const lay = layoutLocation(g.loc, maps, blocks, { enhanced: isEnhanced(), windmills: false });
      const tile = getLocationTerrainTileOrigin(g.loc);
      const meshOf = (id) => { const i = arch.getRecordIndex(id); return i === -1 ? null : arch.getMesh(i); };
      const pick = dungeonEntranceModel(lay.blocks, tile.x * tileSide, tile.y * tileSide, meshOf, isEnhanced());
      if (!pick) return;
      const gpu = await e.hold.getGpuMesh(pick.modelIdNum);
      const cpu = cpuModels.get(pick.modelIdNum);
      if (!gpu || !cpu || _tvDngModel.get(g.key) !== e) return;
      const free = isClimateFreeModel(pick.modelIdNum);   // ARENA1's law, as the build's
      const texRemap = free ? NO_CLIMATE_REMAP : new Map();
      const climate = g.loc.climate?.climateType ?? getWorldClimateSettings(maps.getClimateIndex(g.px, g.py)).climateType;
      // TV-PIN (FIELD BUGS 2026-10-09): the climate's pictures through the place's OWN door - held by its hold, and let go
      // with it. The host's `pipeline` is the pinned door (dataPipeline.js pinnedUpload), and every climate and season
      // picture of every dungeon the view ever stood stayed on the GPU for the session
      if (!free) await remapSubMeshes(gpu.subMeshes, texRemap, (a, r) => applyClimate(a, r, climate, host.season), { getTexture: pipeline.getTexture, uploadRecord: e.hold.uploadRecord });
      if (_tvDngModel.get(g.key) !== e) return;
      const box = transformedAabb(archAabb(pick.modelIdNum, cpu.positions), pick.local);
      Object.assign(e, { ready: true, gpu, local: pick.local, box, h: Math.max(0.5, box[4] - Math.max(0, box[1])), texRemap });
    })().catch((err) => console.warn('[overworld] a dungeon\'s model', g.key, err?.message ?? err));
  }
  /** OW-DUNGEONS: the set kept in step - a new one's model asked for, one gone released - and each drawn grown to its
   *  one height in the world as the view rises (owDungeonGrow, OW-DUNGEON-SIZE: `blend` the view's) about its foot, where its real one stands: over a built pixel on the real model's
   *  own level, past the grid on the far ring's ground. No giant's shadow (the view's law, WAGON-HITCH B2). Under the
   *  view alone: in play the world's own entrance is the model. TV-BURST (FIELD BUGS 2026-10-09): `up` the view fully up
   *  (the frame's `fullyUp`) - the loads start one a frame from then, the nearest first (startDungeonLoads); they all
   *  started on the view's first frame, a whole set's layouts, meshes and pictures inside one draw. */
  const _tvDngAt = [0, 0, 0];
  function drawTvDungeonModels(eye, up, blend) {
    if (!eye) return;
    const list = tvDungeonModelList();
    const keep = new Set();
    for (const g of list) keep.add(g.key);
    startDungeonLoads(list, _tvDngModel, up, tvDungeonModelLoad);
    for (const [k, e] of _tvDngModel) if (!keep.has(k)) { e.hold.release(); _tvDngModel.delete(k); }
    for (const e of _tvDngModel.values()) {
      if (!e.ready) continue;
      const t = state.pixelTranslation(e.px, e.py, e.t ??= [0, 0, 0]);
      const foot = (e.foot ??= modelFoot(e.box));
      const level = built.get(`${e.px},${e.py}`)?.locOrigin ?? null;   // the real model's own level, where its pixel stands
      _tvDngAt[0] = t[0] + foot[0]; _tvDngAt[2] = t[2] + foot[2];
      if (level) _tvDngAt[1] = t[1] + level[1];
      else {   // past the grid: the far ring's ground, asked again only as the ground moves (TV3's tvSceneKept's way)
        const gen = tvGroundGenNow();
        if (e.groundGen !== gen) { e.groundY = tvGroundAt(_tvDngAt[0], _tvDngAt[2]); e.groundGen = gen; }
        _tvDngAt[1] = e.groundY;
      }
      const g = owDungeonGrow(e.h, blend);
      if (!owDungeonDrawn(g, !!level)) continue;
      renderer.drawMesh(e.gpu, grownModelMatrix(e.local, e.box, _tvDngAt, g, e.matrix), e.texRemap, { noShadow: true });
    }
  }
  /** TV-BURST (FIELD BUGS 2026-10-09): THE VIEW DOWN, ITS MODELS LET GO - every place released to its kind's shelf
   *  (PLACE-LRU keeps TV_DUNGEON_MODELS_MAX of them warm, so a view raised again where it was builds nothing again) and the
   *  map emptied, so the next view starts its own one a frame; a load still in flight finds itself gone and stops
   *  (tvDungeonModelLoad's own guards). They were held, undrawn, until a load. */
  function dropTvDungeonModels() {
    for (const e of _tvDngModel.values()) e.hold.release();
    _tvDngModel.clear();
  }
  return { drawTvDungeonModels, dropTvDungeonModels };
}
