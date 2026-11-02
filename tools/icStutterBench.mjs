// IC-STUTTER (2026-10-27, the owner: "Traveling in the Imperial City at x60 presents really bad stuttering"; bible/03-World/
// Arena-Provinces.md IC-STUTTER) - A NEAR SLICE OF THE IMPERIAL CITY AS THE PAGE'S THREAD MEETS IT, unit by unit, in node
// over the player's ARENA2 and the real city: the work its pixel's build does of the city's own on the page (the pieces it
// reads - its own blocks and its fabric's models - its town's places: the yards' measures, ground and search, the walkers'
// grid, the living town and the streets' pieces the traveller's pace asks), each unit timed in CPU milliseconds, and the
// build's frames as its breather cuts them (systems/buildBreather.js: a slice of BUILD_SLICE_MS, a unit never parted - a
// frame holds what ran between two yields). At x60 a slice is crossed every two or three seconds and three to five come
// near each crossing, so these are the frames a traveller waits through every second or so.
//
//   ARENA2_PATH=/home/claude/dfdata/arena2 node tools/icStutterBench.mjs              this tree
//   TREE=<another worktree> ...                                                    that tree's modules (a before)
//   SLICES=90:5200,30:3460    the slices, by a point of the city's metres (bearing degrees, metres out)
//   SLICE_MS=6                the breather's slice (BUILD_SLICE_MS; 20 is the Overworld's most)
//   OUT=<file>                the rows appended as JSON lines
//
// A tree with no stepped passes (before IC-STUTTER) runs each pass whole - one unit - and makes the city's pieces on the
// page, as its build did whenever its worker had not made them yet (at x60, most of a slice: the worker heard of a slice
// on the frame the stream queued it). A tree with them walks each pass a step at a time and takes the pieces from a worker
// that made them (IC-STUTTER's gate: the stream builds a slice of the city once they are made) - the worker's own time
// said beside it, off the page's thread. CPU time is the process's (its collector's threads with it); on a shared machine
// compare like with like, the arms run one after the other.
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = process.env.TREE || fileURLToPath(new URL('..', import.meta.url));
const A2 = process.env.ARENA2_PATH;
if (!A2 || !existsSync(join(A2, 'MAPS.BSA')))
  throw new Error('icStutterBench: ARENA2_PATH is not an ARENA2 folder (sh tools/fetch-data.sh)');
const SLICES = (process.env.SLICES ?? '90:6000,90:5200,90:4400,90:3600,30:3460,330:4600,210:4200')
  .split(',')
  .map((p) => p.split(':').map(Number));
const SLICE_MS = Number(process.env.SLICE_MS ?? 6);
const imp = (p) => import(pathToFileURL(join(ROOT, 'src', p)).href);
const bytes = (n) => new Uint8Array(readFileSync(join(A2, n)));
const cpu = () => {
  const u = process.cpuUsage();
  return (u.user + u.system) / 1000;
};

const { DFPalette } = await imp('formats/dfPalette.js');
const { preloadTamrielTrace } = await imp('ui/tamrielTrace.js');
const { setTamrielTrace } = await imp('world/tamriel/tamrielLand.js');
const { setTamrielFit } = await imp('world/tamriel/tamrielFrame.js');
const { MapsFile } = await imp('formats/mapsFile.js');
const { BlocksFile } = await imp('formats/blocksFile.js');
const { Arch3dFile } = await imp('formats/arch3dFile.js');
const { WoodsFile } = await imp('formats/woodsFile.js');
const { groundMaps, groundWoods } = await imp('world/tamriel/tamrielGround.js');
const wd = await imp('formats/worldData/worldDataReplacement.js');
const tc = await imp('world/tamrielCapitals.js');
const { installCapitals } = await imp('world/capitalModels.js');
const { isMainStoryDungeon } = await imp('world/dungeon/dungeonTextures.js');
const { layoutLocation } = await imp('world/locationLayout.js');
const ys = await imp('world/merchantYards/merchantYardSites.js');
const cm = await imp('world/customModels.js');
const { collectBlockFlats } = await imp('world/rmbFlats.js');
const { flatFieldFor } = await imp('world/flatFields.js');
const { ARENA_BLOCK } = await imp('world/arena/arenaCity.js');
const { CityNavigation } = await imp('world/city/cityNavigation.js');
const lt = await imp('systems/livingWorld/livingTown.js');
const { cityHomesOf } = await imp('world/imperialHomes.js');
const { CLASSIC_MINUTES_PER_SECOND } = await imp('systems/worldTick.js');
const tw = await imp('systems/travel/townWalk.js');
const ic = await imp('world/imperialCity.js');
const pre = await imp('world/imperialPrebuild.js');
const client = await imp('world/imperialPrebuildClient.js');
const wk = await imp('world/imperialPrebuildWorker.js');
const pl = await imp('systems/livingWorld/places.js');
const fab = await imp('world/imperialFabric.js');
const ll = await imp('world/locationLayout.js');
const STEPPED =
  typeof ys.yardMeasuresSteps === 'function' &&
  typeof lt.livingTownPlaces === 'function' &&
  typeof tw.componentsSteps === 'function';

const pal = new DFPalette();
pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 }); // the freeware's fit
const maps = new MapsFile();
maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
maps.autoDiscard = false;
const rows = [];
for (let r = 0; r < maps.regionCount; r++) {
  if (!maps.getRegion(r)) continue;
  for (let l = 0; l < maps.baseLocationCount(r); l++) {
    const loc = maps.getLocation(r, l);
    if (loc) rows.push(loc);
  }
}
const blocks = new BlocksFile();
blocks.load(bytes('BLOCKS.BSA'));
const woods0 = new WoodsFile();
woods0.load(bytes('WOODS.WLD'));
const arch = new Arch3dFile();
arch.load(bytes('ARCH3D.BSA'));
groundMaps(maps);
groundWoods(woods0);
wd.installWorldDataReplacement();
wd.bindWorldDataBlocks(blocks);
installCapitals({ addTextures: () => 0 });
const base = tc.capitalBase(rows, isMainStoryDungeon),
  names = tc.cityBlockNames(rows),
  centre = tc.capitalCentrePixel(0);
const sizes = new Map();
const dfMeshSize = (id) => {
  if (!sizes.has(id)) {
    const i = arch.getRecordIndex(id);
    sizes.set(id, i === -1 ? null : (arch.getMesh(i)?.size ?? null));
  }
  return sizes.get(id);
};
const B = 102.4,
  HALF = ic.IMPERIAL_CELLS / 2,
  N = ic.IMPERIAL_SPAN;
const yardBoxes = new Map();
const measure = {
  boxOf: (id, m) =>
    ys.placedModelBox(id, m, {
      custom: (cid) =>
        cm.hasCustomModel(cid) && !cm.customModelNeeds(cid).length && !tc.isCapitalLandmark(cid)
          ? (cm.customModelFor(cid)?.positions ?? null)
          : null,
      classic: (cid) => dfMeshSize(cm.classicModelIdOf(cid)),
      cache: yardBoxes,
    }),
  fieldOf: (id) => flatFieldFor(id),
  flatsOf: (bb) => collectBlockFlats(bb.dfBlock, 0),
  closedBlock: (bb) =>
    bb.blockName === ARENA_BLOCK ||
    (bb.dfBlock?.rmbBlock?.fldHeader?.buildingDataList ?? []).some((q) => q?.buildingType === 16),
};

/** A pass run whole: one unit. */
function unit(units, name, fn) {
  const a = cpu();
  const v = fn();
  units.push([name, cpu() - a]);
  return v;
}
/** A pass a step at a time: each step a unit. */
function steps(units, name, gen) {
  for (;;) {
    const a = cpu();
    const r = gen.next();
    units.push([name, cpu() - a]);
    if (r.done) return r.value;
  }
}
/** The frames the breather cuts the units into: a frame takes units until its slice is spent, never parting one. */
function framesOf(units, sliceMs) {
  const out = [];
  let f = 0;
  for (const [, ms] of units) {
    f += ms;
    if (f >= sliceMs) {
      out.push(f);
      f = 0;
    }
  }
  if (f > 0) out.push(f);
  return out;
}

for (const [b, r] of SLICES) {
  const [x, z] = ic.polar(b, r);
  const sx = Math.floor((x + HALF * B) / (8 * B)),
    sy = Math.floor((z + HALF * B) / (8 * B)),
    s = sy * N + sx;
  const px = centre.px - (N - 1) / 2 + sx,
    py = centre.py - (N - 1) / 2 + sy;
  const loc = tc.synthesizeCapitalLocation(/** @type {any} */ (tc.capitalOnPixel(px, py)), {
    base,
    names,
    blockOf: (n) => blocks.getBlockByName(n),
    px,
    py,
    pinPort: false,
  });
  // the city's pieces: a worker's, made before the build (IC-STUTTER's gate), or none (the page makes them)
  let workerMs = 0;
  if (STEPPED) {
    const queued = [];
    const state = wk.createPrebuildWorkerState((m) => queued.push(m));
    const w = { onmessage: null, onerror: null, postMessage: (m) => state.on(m), terminate() {} };
    client.createImperialPrebuild({ makeWorker: () => w, workers: 1, log: { warn() {} } }).want([{ s, near: true }]);
    const a = cpu();
    while (state.step());
    workerMs = cpu() - a;
    for (const m of queued.splice(0)) w.onmessage({ data: m });
    fab._resetFabric(); // the worker's own thread in the game: none of its fabric is the page's
  } else pre.setImperialPrebuild(null);
  const units = [];
  for (const name of loc.exterior.exteriorData.blockNames) unit(units, 'block', () => blocks.getBlockByName(name));
  const yl =
    STEPPED && ll.layoutLocationSteps
      ? steps(units, 'layout', ll.layoutLocationSteps(loc, maps, blocks, { enhanced: true, windmills: true }))
      : unit(units, 'layout', () => layoutLocation(loc, maps, blocks, { enhanced: true, windmills: true }));
  // the town's places (scenes/world.js townPlacesFor): the yards' measures, ground, search and the professions' yards
  if (STEPPED) {
    const ms = { ...steps(units, 'yards', ys.yardMeasuresSteps(yl, measure)), keep: [] };
    const g = steps(units, 'yards', ys.townGroundSteps(yl, ms, null));
    steps(units, 'yards', ys.yardSitesSteps(g));
    steps(units, 'yards', ys.craftYardSitesSteps(g));
  } else
    unit(units, 'yards', () => {
      const ms = { ...ys.yardMeasuresOf(yl, measure), keep: [] };
      const g = ys.townGroundOf(yl, ms, null);
      ys.yardSitesOn(g);
      ys.craftYardSitesOn(g);
    });
  // the walkers' grid (a block a breath in a stepped tree's build)
  const lay = (n, bb) => {
    const t = bb.dfBlock.rmbBlock.fldHeader.groundData.groundTiles;
    n.setBlockData(bb.x, bb.y, bb.dfBlock.rmbBlock.fldHeader.autoMapData, (tx, ty) => t[tx][ty].textureRecord, {
      enhancedWater: true,
    });
  };
  const nav = STEPPED
    ? steps(
        units,
        'nav',
        (function* () {
          const n = new CityNavigation(yl.width, yl.height);
          for (const bb of yl.blocks) {
            lay(n, bb);
            yield;
          }
          return n;
        })(),
      )
    : unit(units, 'nav', () => {
        const n = new CityNavigation(yl.width, yl.height);
        for (const bb of yl.blocks) lay(n, bb);
        return n;
      });
  const homes = cityHomesOf(loc);
  const o = {
    town: { mapId: loc.mapTableData.mapId >>> 0, blocks: 64, region: loc.regionIndex, people: 3, port: false },
    buildings: homes.buildings,
    doors: homes.doors,
  };
  const more = {
    makePerson: () => null,
    clock: () => 300 * 1440 + 360,
    rate: () => CLASSIC_MINUTES_PER_SECOND,
    mpm: 1,
  };
  if (STEPPED) {
    const places = steps(units, 'places', pl.townPlacesSteps(nav, o.doors, o.buildings, lt.livingPlacesWay(o))); // livingTownPlaces' steps
    unit(units, 'living', () => new lt.LivingTown(nav, { ...o, ...more, places }));
    steps(units, 'pieces', tw.componentsSteps(nav));
  } else {
    unit(units, 'living', () => new lt.LivingTown(nav, { ...o, ...more }));
    unit(units, 'pieces', () => tw.edgePieces(nav)); // the traveller's pace's first ask (scenes/townWalkHost.js townPace)
  }
  const by = {};
  for (const [k, ms] of units) {
    const e = (by[k] ??= { n: 0, ms: 0, worst: 0 });
    e.n++;
    e.ms += ms;
    e.worst = Math.max(e.worst, ms);
  }
  for (const e of Object.values(by)) {
    e.ms = +e.ms.toFixed(1);
    e.worst = +e.worst.toFixed(1);
  }
  const frames = framesOf(units, SLICE_MS).sort((p, q) => q - p);
  const row = {
    tree: ROOT,
    stepped: STEPPED,
    slice: s,
    name: loc.name,
    sliceMs: SLICE_MS,
    workerMs: +workerMs.toFixed(0),
    pageMs: +units.reduce((t, [, ms]) => t + ms, 0).toFixed(0),
    worstUnitMs: +Math.max(...units.map((u) => u[1])).toFixed(1),
    frames: frames.length,
    worstFrameMs: +(frames[0] ?? 0).toFixed(1),
    over33: frames.filter((f) => f > 33).length,
    over50: frames.filter((f) => f > 50).length,
    over100: frames.filter((f) => f > 100).length,
    by,
  };
  console.log(JSON.stringify(row));
  if (process.env.OUT) appendFileSync(process.env.OUT, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n');
}
