// /usr/bin/env node
// ROAD JOURNEYS ON THE FREEWARE'S ROADS, PLANNED AND WALKED. The roads past the Bay laid as the roads' worker lays them
// (tools/tesaRoadsAtlas.mjs's inputs, every region with land), kept in a file so a second run skips the build; then
// journeys sampled from a seed - on the Bay, past it, the Bay to past it, and five named - planned on the host's own
// ground and walked by the real Travel Options through its own `update`, a body flown `step` units a frame. Per set: the
// pace kept, the frames stood and cut a km, the walk's turning against the road's, the heading's reversals a km, the worst
// frame's turn, the distance off the painted road.
//
//   ARENA2_PATH=/home/claude/dfdata/arena2 node tools/roadWalkProbe.mjs [--cache FILE] [--n 30] [--seed 7] [--step 433,1300]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { ImgFile } from '../src/formats/imgFile.js';
import { WoodsFile } from '../src/formats/woodsFile.js';
import { PakFile } from '../src/formats/pakFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { MapsFile, LOCATION_TYPES, worldCoordToMapPixel } from '../src/formats/mapsFile.js';
import { traceTamrielPicture, paletteReader } from '../src/ui/tamrielTrace.js';
import { fitBayToPicture, setTamrielTrace, tamrielTrace } from '../src/world/tamriel/tamrielLand.js';
import { loadRelief } from '../src/world/tamriel/tamrielRelief.js';
import { setTamrielFit, tamrielFit, tamrielFrameInBay, inBay, BAY_W } from '../src/world/tamriel/tamrielFrame.js';
import { isWaterPixel } from '../src/ui/overworldModel.js';
import { landAt } from '../src/ui/ink/inkMap.js';
import { groundWoods, groundClimateIndex } from '../src/world/tamriel/tamrielGround.js';
import { arenaPixels } from '../src/world/arenaPlaces.js';
import { arenaRoadTowns, arenaTemplates, arenaTemplateOf } from '../src/world/arenaLocations.js';
import {
  arenaJoins,
  joinLayer,
  joinRunPixels,
  mergeArenaRoads,
  unpackArenaRoads,
  packArenaRoads,
  setArenaRoads,
  arenaRoadsLayer,
  arenaRoadByte,
  beyondKey,
  beyondPixel,
} from '../src/world/arenaRoads.js';
import { cyrodiilTrunksFor } from '../src/scenes/tamrielRoadsHost.js';
import { CAPITALS, capitalOnPixel, capitalGates, capitalSpanPixels } from '../src/world/tamrielCapitals.js';
import { WATER_BYTE } from '../src/world/roadsProducer.js';
import { bayRoads } from '../test/bayRoads.mjs'; // The Bay's own network, off the same ARENA2
import { isMainStoryDungeon } from '../src/world/dungeon/dungeonTextures.js';
import { countryTemplates, countryCounts, bayLand as bayLandOf, countryRates } from '../src/world/tamrielCountry.js';
import { lairTemplates, lairPools, LAIR_TYPES } from '../src/world/tamrielDungeons.js';
import { regionLattice, regionsByNearness, regionHasLand, rollSpec } from '../src/world/tamrielRoads.js';
import { createRoadsWorkerState } from '../src/world/tamrielRoadsWorker.js';
import { planRoute, routeGround, routeLegs, joinPoint } from '../src/systems/travel/travelRoute.js';
import { createTravelOptions, readTravelOptionsSettings } from '../src/systems/travel/travelOptions.js';
import { TravelControlUI } from '../src/ui/travel/travelControlUI.js';
import { modSetting } from '../src/systems/modSettings.js';
import { mapPixelWorldOrigin } from '../src/systems/travel/travelPaths.js';
import { rectOf } from '../src/systems/travel/travelAutopilot.js';
import { MAP_W, MAP_H, DIR_DELTA } from '../src/world/road/roadNetwork.js';
import { curveDistance } from '../src/world/road/roadCurves.js';

const A2 = process.env.ARENA2_PATH;
if (!A2 || !existsSync(join(A2, 'MAPS.BSA'))) {
  console.error('roadWalkProbe: ARENA2_PATH is not an ARENA2 folder (sh tools/fetch-data.sh)');
  process.exit(2);
}
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const CACHE = arg('--cache', join(tmpdir(), 'road-walk-layer'));
const N = Number(arg('--n', 30)),
  SEED = Number(arg('--seed', 7)),
  STEPS = arg('--step', '433,1300').split(',').map(Number);
const file = (name) => {
  for (const n of [name, name.toLowerCase()]) {
    const p = join(A2, n);
    if (existsSync(p)) return readFileSync(p);
  }
  throw new Error(`${name} not in ${A2}`);
};

// ── the land, as the host stands it ─────────────────────────────
const picture = new ImgFile();
picture.load(file('TMAP00I0.IMG'), 'TMAP00I0.IMG');
const picker = new ImgFile();
picker.load(file('TAMRIEL2.IMG'), 'TAMRIEL2.IMG');
const pal = new DFPalette();
pal.load(file(picture.paletteName || 'ART_PAL.COL'), picture.paletteName || 'ART_PAL.COL');
const trace = traceTamrielPicture(picker.getDFBitmap(), picture.getDFBitmap(), paletteReader(pal));
trace.relief = await loadRelief(trace);
const woods0 = new WoodsFile();
woods0.load(file('WOODS.WLD'));
const climatePak = new PakFile();
climatePak.load(file('CLIMATE.PAK'));
const fit = fitBayToPicture({
  bayLand: landAt({
    heightBytes: woods0.heightMapBuffer,
    width: BAY_W,
    climateAt: (x, y) => climatePak.getValue(x + 1, y),
  }),
  trace,
});
setTamrielTrace(trace);
setTamrielFit({ ox: fit.ox * fit.ppu, oy: fit.oy * fit.ppu, ppu: fit.ppu });
const woods = groundWoods(woods0),
  heightAt = (x, y) => woods.getHeightMapValue(x, y);
const maps = new MapsFile();
maps.load(file('MAPS.BSA'), file('CLIMATE.PAK'), file('POLITIC.PAK'));
const read = async (url) => {
  const p = fileURLToPath(url);
  return {
    ok: true,
    arrayBuffer: async () => {
      const b = readFileSync(p);
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    },
  };
};
const bay = { ...bayRoads(), source: 'basic-roads' };
const pixels = arenaPixels();

// ── the roads past the Bay: laid once, kept in CACHE ─────────────
if (!existsSync(`${CACHE}.bin`)) {
  const climateBay = (x, y) => maps.getClimateIndex(x, y);
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) {
    if (!maps.getRegion(r)) continue;
    for (let l = 0; l < maps.baseLocationCount(r); l++) {
      const loc = maps.getLocation(r, l);
      if (loc) rows.push(loc);
    }
  }
  const land0 = bayLandOf(climateBay, (x, y, c) => isWaterPixel(c, woods0.getHeightMapValue(x, y)));
  const cT = countryTemplates(rows, isMainStoryDungeon),
    lT = lairTemplates(rows, isMainStoryDungeon);
  const spec = rollSpec({
    countryRates: countryRates(countryCounts(cT, climateBay), land0),
    countryTemplates: cT,
    lairRates: countryRates(countryCounts(lT, climateBay), land0, LAIR_TYPES),
    lairTemplates: lT,
    lairPools: lairPools(lT),
  });
  const joins = bay
    ? arenaJoins(bay, (x, y) =>
        inBay(x, y) ? !isWaterPixel(climateBay(x, y), woods0.getHeightMapValue(x, y)) : heightAt(x, y) > WATER_BYTE,
      )
    : [];
  const walkable = (x, y) => !inBay(x, y) && heightAt(x, y) > WATER_BYTE && !capitalOnPixel(x, y);
  const gates = [],
    obstacles = [];
  CAPITALS.forEach((_, k) => {
    obstacles.push(...capitalSpanPixels(k));
    gates.push(...capitalGates(k, { walkable }));
  });
  const templates = arenaTemplates(rows, isMainStoryDungeon);
  const towns = arenaRoadTowns({ stood: pixels.stood.filter((p) => !p.pinned && arenaTemplateOf(templates, p)) }) ?? [];
  const held = [
    ...pixels.stood.filter((p) => arenaTemplateOf(templates, p)).map((p) => ({ x: p.bx, y: p.by })),
    ...joinRunPixels(joins),
  ];
  const nodes = [
    ...towns,
    ...gates.map((g) => ({ x: g.x, y: g.y, type: LOCATION_TYPES.TownCity })),
    ...joins.map((j) => ({ x: j.gate[0], y: j.gate[1], type: LOCATION_TYPES.TownCity })),
  ];
  const lattice = regionLattice(tamrielFrameInBay());
  const regions = regionsByNearness(lattice, (r) => regionHasLand(r, heightAt), { x: 500, y: 250 });
  const worker = createRoadsWorkerState(),
    f = tamrielFit();
  worker.handle(
    {
      t: 'init',
      woodsBytes: file('WOODS.WLD'),
      trace: tamrielTrace(),
      fit: { ox: f.ox, oy: f.oy, ppu: f.ppu },
      spec,
      nodes,
      obstacles,
      gates,
      held,
      lattice,
      trunks: cyrodiilTrunksFor(pixels, walkable),
    },
    () => {},
  );
  const layer = joinLayer(joins),
    t0 = Date.now();
  for (const region of regions) {
    let got = null;
    worker.handle({ t: 'build', id: 1, i: region.i, j: region.j }, (m) => {
      got = m;
    });
    if (!got.error) mergeArenaRoads(layer, unpackArenaRoads(got.layer));
    console.log(
      `region (${region.i}, ${region.j}) ${got.error ?? `${got.ms} ms`}; ${((Date.now() - t0) / 1000).toFixed(0)} s`,
    );
  }
  const p = packArenaRoads(layer);
  writeFileSync(
    `${CACHE}.bin`,
    Buffer.concat([
      Buffer.from(new Uint32Array([p.keys.length, p.joinKeys.length]).buffer),
      ...[p.keys, p.roads, p.tracks, p.joinKeys, p.join].map((a) => Buffer.from(a.buffer)),
    ]),
  );
}
{
  const bin = readFileSync(`${CACHE}.bin`);
  let o = 8;
  const [nk, nj] = new Uint32Array(bin.buffer.slice(bin.byteOffset, bin.byteOffset + 8));
  const take = (T, n) => {
    const b = new T(bin.buffer.slice(bin.byteOffset + o, bin.byteOffset + o + n * T.BYTES_PER_ELEMENT));
    o += n * T.BYTES_PER_ELEMENT;
    return b;
  };
  const packed = {
    keys: take(Float64Array, nk),
    roads: take(Uint8Array, nk),
    tracks: take(Uint8Array, nk),
    joinKeys: take(Float64Array, nj),
    join: take(Uint8Array, nj),
  };
  setArenaRoads(unpackArenaRoads(packed));
}
const layer = arenaRoadsLayer();
console.log(`the roads past the Bay: ${layer.roads.size} road and ${layer.tracks.size} track pixels (${CACHE}.bin)`);
const climate = groundClimateIndex(maps.getClimateIndex.bind(maps));
const rg = routeGround(climate, heightAt, WATER_BYTE, MAP_W, MAP_H, (x, y) => heightAt(x, y) > WATER_BYTE);

// ── the painted road's distance, tiles: past the Bay its curves, on the Bay Basic Roads' straight arms ──
const EXIT = new Map(DIR_DELTA.map(([bit, dx, dy]) => [bit, [64 + 64 * dx, 64 - 64 * dy]]));
const seg = (x, y, ax, ay, bx, by) => {
  const ex = bx - ax,
    ey = by - ay,
    L = ex * ex + ey * ey,
    t = L > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / L)) : 0;
  return Math.hypot(x - ax - t * ex, y - ay - t * ey);
};
const bayByte = (kind, x, y) =>
  x < 0 || y < 0 || x >= MAP_W || y >= MAP_H
    ? 0
    : (bay?.[kind]?.[y * MAP_W + x] ?? 0) | (kind === 'roads' ? arenaRoadByte('join', x, y) : 0);
const arms = (bits, x, y) => {
  let d = Infinity;
  for (const [bit] of DIR_DELTA) if (bits & bit) d = Math.min(d, seg(x, y, 64, 64, ...EXIT.get(bit)));
  return d;
};
function offRoad(X, Z) {
  const p = worldCoordToMapPixel(X, Z),
    o = mapPixelWorldOrigin(p.x, p.y),
    tx = (X - o.x) / 256,
    ty = (Z - o.z) / 256;
  let d = Infinity;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      for (const kind of ['roads', 'tracks']) {
        const x = p.x + dx,
          y = p.y + dy,
          past = !inBay(x, y),
          bits = past ? arenaRoadByte(kind, x, y) : bayByte(kind, x, y);
        if (bits) d = Math.min(d, (past ? curveDistance : arms)(bits, tx - dx * 128, ty + dy * 128));
      }
  return d;
}

// ── a journey walked by the real Travel Options, through its own door ──
const mid = (p) => {
  const o = mapPixelWorldOrigin(p.x, p.y);
  return { x: o.x + 16384, z: o.z + 16384 };
};
const wrap = (a) => ((a + 540) % 360) - 180;
/** The turn at b of the runs a-b, b-c, degrees - the probe's own, so it measures a tree from before ROAD-SMOOTH too. */
const turnAt = (a, b, c) =>
  Math.abs(wrap(((Math.atan2(c[0] - b[0], c[1] - b[1]) - Math.atan2(b[0] - a[0], b[1] - a[1])) * 180) / Math.PI));
function walk(plan, to, step) {
  const from = plan.pixels[0],
    me = { x: mid(from).x + 2000, z: mid(from).z - 1500 }; // a traveller off the middle
  const raw = routeLegs(plan.pixels, plan.kinds);
  const legs =
    !raw.length || (plan.kinds[0] !== 'road' && plan.kinds[0] !== 'track')
      ? raw
      : [{ x: from.x, y: from.y, kind: 'open', at: joinPoint(me, mid(from), raw[0].at ?? mid(raw[0])) }, ...raw]; // OW-ROADSIDE's join, as the host's
  const state = { pos: { ...me }, pixel: from };
  const settings = readTravelOptionsSettings((vendor, key) =>
    vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key),
  );
  const T = createTravelOptions({
    settings,
    ui: new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60 }),
    roads: () => ({ roads: bay.roads, tracks: bay.tracks, source: 'basic-roads' }),
    worldPos: () => state.pos,
    mapPixel: () => state.pixel,
    yaw: () => 0,
    setFacing: () => {},
    currentLocation: () => null,
    hasCurrentLocation: () => false,
    localizedCurrentLocationName: () => '',
    localizedLocationName: (q) => q?.name ?? '',
    climateIndex: () => 231,
    entity: () => ({ health: 50, maxHealth: 50, fatigue: 3200, luck: 50, stealth: 50 }),
    enemiesNearby: () => false,
    diseaseCount: () => 0,
    say: () => {},
    messageBox: () => {},
    setTimeScale: () => {},
    now: () => 0,
    worldTimeNow: () => 0,
    roll100: () => 100,
    locationWorldRect: (q) => {
      const o = mapPixelWorldOrigin(q.pixel.x, q.pixel.y);
      return rectOf(o.x + 16000, o.z + 16000, 768, 768);
    },
    locationTileRect: () => null,
    pushWindow: (w) => {
      w.show();
    },
  });
  if (
    !T.beginTravelAlongRoute(
      { legs, summary: { pixel: to, name: 'There', mapId: 7, regionIndex: 1, locationIndex: 1 } },
      false,
      { quiet: true },
    )
  )
    return null;
  let moved = 0,
    want = 0,
    frames = 0,
    stood = 0,
    cut = 0,
    turn = 0,
    flips = 0,
    big = 0,
    lastD = 0,
    prevYaw = null;
  const off = [];
  for (; frames < 400000 && T.route; frames++) {
    state.pixel = worldCoordToMapPixel(state.pos.x, state.pos.z);
    const leg = T.route.i,
      d = T.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false }).drive;
    if (!d) break;
    want += step * (T.state.autopilot?.speedMultiplier ?? 1); // the pace: the frame's whole step at its leg's force
    if (d.arrived) {
      if (T.route) stood++;
      continue;
    }
    if (d.forward < T.state.autopilot.speedMultiplier - 1e-9) cut++;
    const r = (d.yaw * Math.PI) / 180,
      x = state.pos.x + Math.sin(r) * step * d.forward,
      z = state.pos.z + Math.cos(r) * step * d.forward;
    moved += step * d.forward;
    state.pos = { x, z };
    if (prevYaw != null) {
      const dy = wrap(d.yaw - prevYaw);
      turn += Math.abs(dy);
      big = Math.max(big, Math.abs(dy));
      if (Math.abs(dy) > 0.5) {
        if (lastD && Math.sign(dy) !== Math.sign(lastD)) flips++;
        lastD = dy;
      }
    }
    prevYaw = d.yaw;
    if (leg >= 1 && leg < legs.length - 1 && (legs[leg].kind === 'road' || legs[leg].kind === 'track'))
      off.push(offRoad(x, z));
  }
  const pts = legs.flatMap((l) => (l.at ? [[l.at.x, l.at.z]] : (l.line ?? [[mid(l).x, mid(l).z]])));
  let lane = 0,
    len = 0;
  for (let k = 1; k < pts.length; k++) {
    len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    if (k > 1) lane += turnAt(pts[k - 2], pts[k - 1], pts[k]) || 0;
  }
  const km = moved / 40000;
  off.sort((a, b) => a - b);
  return {
    arrived: !T.route,
    pace: moved / Math.max(1, want),
    stood: stood / km,
    cut: cut / km,
    turn: turn / km,
    lane: lane / (len / 40000),
    flips: flips / km,
    big,
    offMax: off.at(-1) ?? 0,
    on: off.filter((q) => q <= 1).length / Math.max(1, off.length),
  };
}

// ── the journeys ─────────────────────────────────────────────────
let s = SEED >>> 0;
const rnd = () => {
  s = (s * 1664525 + 1013904223) >>> 0;
  return s / 4294967296;
};
const past = [...layer.roads.keys()].map(beyondPixel).filter(([x, y]) => !inBay(x, y)),
  onBay = [];
for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (bay.roads[y * MAP_W + x]) onBay.push([x, y]);
const pairs = [];
const named = (n) => pixels.stood.find((p) => p.name === n);
for (const [a, b] of [
  ['Imperial City', 'Bruma'],
  ['Kvatch', 'Leyawiin'],
  ['Whiterun', 'Riften'],
  ['Skingrad', 'Bravil'],
  ['Mournhold', 'Tear'],
]) {
  const A = named(a),
    B = named(b);
  if (A && B) pairs.push({ set: 'named', from: { x: A.bx, y: A.by }, to: { x: B.bx, y: B.by } });
}
for (const [set, as, bs, hi] of [
  ['beyond', past, past, 250],
  ['bay', onBay, onBay, 250],
  ['cross', onBay, past, 350],
]) {
  for (let made = 0, tries = 0; made < N && tries < 50 * N; tries++) {
    const [ax, ay] = as[Math.floor(rnd() * as.length)],
      [bx, by] = bs[Math.floor(rnd() * bs.length)],
      d = Math.max(Math.abs(ax - bx), Math.abs(ay - by));
    if (d >= 20 && d <= hi) {
      pairs.push({ set, from: { x: ax, y: ay }, to: { x: bx, y: by } });
      made++;
    }
  }
}
const rows = pairs.map((p) => ({
  ...p,
  plan: planRoute(p.from, p.to, { roads: bay.roads, tracks: bay.tracks, ...rg }),
}));
/** The roads' cheapest way past the Bay (Dijkstra over the layer's roads and tracks at the plan's prices) - the plan's yardstick. */
function cheapest(from, to) {
  const g = new Map([[beyondKey(from.x, from.y), 0]]),
    goal = beyondKey(to.x, to.y),
    heap = [[0, beyondKey(from.x, from.y)]];
  const push = (e) => {
    heap.push(e);
    for (let i = heap.length - 1; i > 0;) {
      const j = (i - 1) >> 1;
      if (heap[j][0] <= e[0]) break;
      [heap[i], heap[j]] = [heap[j], heap[i]];
      i = j;
    }
  };
  const pop = () => {
    const top = heap[0],
      last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1,
          r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[i], heap[m]] = [heap[m], heap[i]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, k] = pop();
    if (d !== g.get(k)) continue;
    if (k === goal) return d;
    const [x, y] = beyondPixel(k);
    for (const [bit, dx, dy] of DIR_DELTA) {
      const back = DIR_DELTA[(DIR_DELTA.findIndex((q) => q[0] === bit) + 4) % 8][0];
      const price =
        arenaRoadByte('roads', x, y) & bit && arenaRoadByte('roads', x + dx, y + dy) & back
          ? 1
          : arenaRoadByte('tracks', x, y) & bit && arenaRoadByte('tracks', x + dx, y + dy) & back
            ? 1.6
            : 0;
      const nd = d + price * (dx && dy ? Math.SQRT2 : 1),
        nk = beyondKey(x + dx, y + dy);
      if (price && nd < (g.get(nk) ?? Infinity)) {
        g.set(nk, nd);
        push([nd, nk]);
      }
    }
  }
  return null;
}
const ratios = rows
  .filter((r) => r.set === 'beyond' && r.plan)
  .map((r) => r.plan.cost / cheapest(r.from, r.to))
  .filter(Number.isFinite);
console.log(
  `the plans past the Bay against the roads' cheapest: ${ratios.length}, ${(100 * (ratios.reduce((t, q) => t + q, 0) / ratios.length - 1)).toFixed(2)}% dearer on average, ${(100 * (Math.max(...ratios) - 1)).toFixed(2)}% at the worst; open steps ${rows.filter((r) => r.plan).reduce((t, r) => t + r.plan.kinds.filter((k) => k === 'open').length, 0)}, no way ${rows.filter((r) => !r.plan).length}`,
);
for (const step of STEPS) {
  console.log(
    `\nstep ${step} world units a frame (40 a metre; 433 a hundred times walking pace at 60 frames a second)`,
  );
  for (const set of ['named', 'beyond', 'bay', 'cross']) {
    const ws = rows
      .filter((r) => r.set === set && r.plan)
      .map((r) => walk(r.plan, r.to, step))
      .filter(Boolean);
    const mean = (k) =>
      (ws.reduce((t, w) => t + w[k], 0) / Math.max(1, ws.length)).toFixed(k === 'pace' || k === 'on' ? 3 : 2);
    console.log(
      `  ${set}: ${ws.length} journeys, ${ws.filter((w) => w.arrived).length} arrived; pace ${mean('pace')}; stood ${mean('stood')} and cut ${mean('cut')} frames a km; turning ${mean('turn')} degrees a km, the road ${mean('lane')}; reversals ${mean('flips')} a km; the worst frame's turn ${Math.max(...ws.map((w) => w.big)).toFixed(0)}; off the road ${Math.max(...ws.map((w) => w.offMax)).toFixed(1)} tiles at the worst, ${(100 * Number(mean('on'))).toFixed(1)}% within a tile`,
    );
  }
}
