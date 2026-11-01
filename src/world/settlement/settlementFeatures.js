// @ts-check
// A DRESSED SETTLEMENT'S FEATURES AS ONE MODEL, in its style's own stone and timber: the well, fountain, market or statue at
// its heart, a fort's walls and towers, a river town's docks, a garden's fence and beds, a field's rows and a fence's rails.
// Its yard trees are not here: they are the pixel's nature (settlementStand.js settlementTreeFlats), the land's own trees in
// every season. Each stands on its pad's top; a run along the rim on the ground under each end, its foot sunk into the
// terrain. Models in the pixel's frame (x east, y up, z north, metres). Pure.
import { MeshBuilder } from '../detStandIns.js';
import { art, CAPITAL_ART, taper, cap, ring, wallRun, merlons, roundTower, gableRoof, robedFigure, translated } from '../capitalShapes.js';
import { hash32 } from '../blockHash.js';
import { padAt, edgeDistance, pointInRing } from './settlementGeometry.js';
import { SETTLEMENT_STYLES } from './settlementStyles.js';

const TIMBER = art(CAPITAL_ART.timber), CLOTH = art(CAPITAL_ART.cloth), WATER = art(CAPITAL_ART.water), LEAVES = art(CAPITAL_ART.leaves);
const MARBLE = art(CAPITAL_ART.marble), BRONZE = art(CAPITAL_ART.bronze), SOIL = art(CAPITAL_ART.dark);
/** A fort's wall: how high over its ground, how thick, how far its foot is sunk. */
export const FORT_WALL = Object.freeze({ h: 6, thick: 2, sink: 3 });
/** A garden's and a fence's rails: how high, and a post every so many metres. */
export const FENCE = Object.freeze({ h: 0.9, post: 2.4 });

/** A seeded draw for a feature: the same on every client. @param {string} id @param {number} salt */
const draw = (id, salt) => hash32(salt, ...[...id].map((char) => char.charCodeAt(0))) / 0x100000000;

/** The ground's height under a plan point: its pad's top, else the nearest pad's (a point on the rim). */
function groundAt(plan, datum, point) {
  const on = /** @type {any} */ (padAt(plan.pads, point));
  if (on) return datum + on.y;
  let nearest = null, best = Infinity;
  for (const pad of plan.pads) {
    const away = edgeDistance(point, pad.poly);
    if (away < best) { best = away; nearest = pad; }
  }
  return datum + (nearest?.y ?? 0);
}

/** An n-sided wall facing in, `radius` round, from `low` up to `high` (a basin's or a kerb's inside). */
function innerWall(mesh, tex, sides, radius, low, high) {
  for (let i = 0; i < sides; i++) {
    const from = (i / sides) * Math.PI * 2, to = ((i + 1) / sides) * Math.PI * 2, mid = (from + to) / 2;
    const at = (angle, height) => [Math.cos(angle) * radius, height, Math.sin(angle) * radius], width = (radius * Math.PI * 2) / sides / 2;
    mesh.quad(tex, at(to, low), at(from, low), at(from, high), at(to, high), [-Math.cos(mid), 0, -Math.sin(mid)], [[0, 0], [width, 0], [width, -(high - low) / 2], [0, -(high - low) / 2]]);
  }
}

/** A well: a stone kerb round dark water, two posts and a little roof over it. */
function well(mesh, stone, roofArt, east, floor, north) {
  translated(mesh, east, floor, north, () => {
    taper(mesh, stone, 12, 1.25, 0, 1.25, 0.95, { vRepeat: 2 });
    innerWall(mesh, stone, 12, 0.95, 0.45, 0.95);
    ring(mesh, stone, 12, 0.95, 1.25, 0.95);
    cap(mesh, WATER, 12, 0.95, 0.45);
  });
  for (const side of [-1, 1]) mesh.box(TIMBER, [east + side * 1.05, floor + 1.4, north], [0.18, 2.8, 0.18], 1);
  mesh.box(TIMBER, [east, floor + 2.35, north], [2.3, 0.16, 0.16], 1);
  gableRoof(mesh, roofArt, roofArt, east, north, 2.9, 1.9, floor + 2.7, 0.9);
}

/** A fountain: a round basin, its water, a pedestal and a bowl. */
function fountain(mesh, stone, east, floor, north) {
  translated(mesh, east, floor, north, () => {
    taper(mesh, stone, 16, 2.4, 0, 2.4, 0.7, { vRepeat: 2 });
    innerWall(mesh, stone, 16, 2.1, 0.5, 0.7);
    ring(mesh, stone, 16, 2.1, 2.4, 0.7);
    cap(mesh, WATER, 16, 2.1, 0.5);
    taper(mesh, stone, 10, 0.35, 0, 0.3, 1.8, { vRepeat: 2 });
    taper(mesh, stone, 12, 0.3, 1.8, 1.0, 2.2, { vRepeat: 1 });
    cap(mesh, WATER, 12, 0.95, 2.15);
  });
}

/** A statue: a plinth and a robed figure of bronze facing its way in. */
function statue(mesh, stone, east, floor, north, face, pose) {
  mesh.box(stone, [east, floor + 0.9, north], [2.6, 1.8, 2.6], 0.5);
  mesh.box(stone, [east, floor + 1.9, north], [2.9, 0.2, 2.9], 0.5);
  robedFigure(mesh, BRONZE, east, north, floor + 2.0, 3.6, face, pose);
}

/** A market: stalls in a ring round the point, each four posts, a cloth awning, a counter and a crate. */
function market(mesh, east, floor, north, id) {
  const stalls = 5;
  for (let i = 0; i < stalls; i++) {
    const angle = (i / stalls) * Math.PI * 2 + draw(id, 1), stallEast = east + Math.cos(angle) * 5, stallNorth = north + Math.sin(angle) * 5;
    for (const [across, deep] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) mesh.box(TIMBER, [stallEast + across * 1.2, floor + 1.1, stallNorth + deep * 0.8], [0.14, 2.2, 0.14], 1);
    mesh.box(CLOTH, [stallEast, floor + 2.25, stallNorth], [2.8, 0.1, 2.0], 0.5);
    mesh.box(TIMBER, [stallEast, floor + 0.5, stallNorth + 0.3], [2.2, 1.0, 0.7], 1);
    mesh.box(TIMBER, [stallEast + 1.6, floor + 0.3, stallNorth - 0.4], [0.6, 0.6, 0.6], 1);
  }
}

/** Rails along a ring or a path, a post every FENCE.post metres, each post on the ground under it. */
function rails(mesh, plan, datum, points, closed) {
  const runs = closed ? points.length : points.length - 1;
  for (let i = 0; i < runs; i++) {
    const start = points[i], end = points[(i + 1) % points.length], length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const steps = Math.max(1, Math.round(length / FENCE.post));
    for (let step = 0; step <= steps; step++) {
      if (step === steps && (closed || i < runs - 1)) continue;   // the next run's first post
      const along = step / steps, post = [start[0] + (end[0] - start[0]) * along, start[1] + (end[1] - start[1]) * along];
      mesh.box(TIMBER, [post[0], groundAt(plan, datum, post) + FENCE.h / 2, post[1]], [0.12, FENCE.h, 0.12], 1);
    }
    const floorStart = groundAt(plan, datum, start), floorEnd = groundAt(plan, datum, end);
    const normalEast = -(end[1] - start[1]) / (length || 1), normalNorth = (end[0] - start[0]) / (length || 1);
    for (const share of [0.4, 0.85]) {
      const lowStart = floorStart + share * FENCE.h, lowEnd = floorEnd + share * FENCE.h;
      mesh.quad(TIMBER, [start[0], lowStart - 0.05, start[1]], [end[0], lowEnd - 0.05, end[1]], [end[0], lowEnd + 0.05, end[1]], [start[0], lowStart + 0.05, start[1]], [normalEast, 0, normalNorth],
        [[0, 0], [length / 2, 0], [length / 2, -0.05], [0, -0.05]]);
    }
  }
}

/** Planted rows inside a ring, each a low bed of soil under its greens, `inset` metres off the ring's edge. */
function beds(mesh, outline, floor, inset, id) {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const [pointEast, pointNorth] of outline) { west = Math.min(west, pointEast); east = Math.max(east, pointEast); south = Math.min(south, pointNorth); north = Math.max(north, pointNorth); }
  const rowsEast = draw(id, 2) < 0.5, first = rowsEast ? south : west, last = rowsEast ? north : east;
  const low = rowsEast ? west : south, high = rowsEast ? east : north, at = (along, across) => (rowsEast ? [along, across] : [across, along]);
  const inside = (point) => pointInRing(point, outline) && edgeDistance(point, outline) >= inset;
  for (let across = first + inset + 0.4; across < last - inset; across += 1.4) {
    let from = null, to = null;
    for (let along = low; along <= high; along += 0.5) if (inside(at(along, across))) { from ??= along; to = along; }
    if (from === null || to === null || to - from < 1) continue;
    const middle = at((from + to) / 2, across), length = to - from;
    mesh.box(SOIL, [middle[0], floor + 0.1, middle[1]], rowsEast ? [length, 0.2, 0.7] : [0.7, 0.2, length], 1);
    mesh.box(LEAVES, [middle[0], floor + 0.32, middle[1]], rowsEast ? [length - 0.2, 0.25, 0.4] : [0.4, 0.25, length - 0.2], 1);
  }
}

/**
 * The features' model: every feature but a tree, in its style's stone, on its ground.
 * @param {import('./settlementContract.js').SettlementPlan} plan @param {number} datum @param {string} [styleKey]
 */
export function featuresModel(plan, datum, styleKey = 'IliacBay') {
  const style = SETTLEMENT_STYLES[styleKey] ?? SETTLEMENT_STYLES.IliacBay;
  const stone = art(CAPITAL_ART[style.ground] ?? CAPITAL_ART.wallStone), roofArt = art(CAPITAL_ART[style.roofArt] ?? CAPITAL_ART.roof);
  const mesh = new MeshBuilder(), plots = new Map((plan.plots ?? []).map((plot) => [plot.id, plot]));
  const gate = plan.gates?.[0]?.at ?? null;
  for (const feature of plan.features ?? []) {
    const at = feature.at, floor = at ? groundAt(plan, datum, at) : 0;
    if (feature.kind === 'well') well(mesh, stone, roofArt, at[0], floor, at[1]);
    else if (feature.kind === 'fountain') fountain(mesh, style.ground === 'marble' ? MARBLE : stone, at[0], floor, at[1]);
    else if (feature.kind === 'statue') {
      const toward = gate ? [gate[0] - at[0], gate[1] - at[1]] : [0, -1], length = Math.hypot(toward[0], toward[1]) || 1;
      statue(mesh, stone, at[0], floor, at[1], [toward[0] / length, toward[1] / length], Math.floor(draw(feature.id, 3) * 4));
    } else if (feature.kind === 'market') market(mesh, at[0], floor, at[1], feature.id);
    else if (feature.kind === 'tower') roundTower(mesh, at[0], at[1], 3, FORT_WALL.h + 3, { y: floor, wall: stone, roof: roofArt });
    else if (feature.kind === 'wall' && feature.path) {
      for (let i = 0; i + 1 < feature.path.length; i++) {
        const start = feature.path[i], end = feature.path[i + 1], base = Math.min(groundAt(plan, datum, start), groundAt(plan, datum, end));
        translated(mesh, 0, base, 0, () => {
          wallRun(mesh, stone, start, end, FORT_WALL.thick, FORT_WALL.h, FORT_WALL.sink);
          merlons(mesh, stone, start, end, FORT_WALL.thick, FORT_WALL.h);
        });
      }
    } else if (feature.kind === 'dock' && feature.path) dock(mesh, plan, datum, feature.path);
    else if (feature.kind === 'garden') {
      const plot = plots.get(feature.id.slice(1));
      if (!plot) continue;
      rails(mesh, plan, datum, plot.poly, true);
      beds(mesh, plot.poly, floor, 0.8, feature.id);
    } else if (feature.kind === 'field' && at) {
      const half = 6, square = [[at[0] - half, at[1] - half], [at[0] + half, at[1] - half], [at[0] + half, at[1] + half], [at[0] - half, at[1] + half]];
      beds(mesh, square, floor, 0.4, feature.id);
    } else if (feature.kind === 'fence' && feature.path) rails(mesh, plan, datum, feature.path, false);
  }
  return mesh.build();
}

/** A dock: a deck of planks out from its quay over the water, its posts down into it. */
function dock(mesh, plan, datum, path) {
  const [start, end] = path;
  const deck = groundAt(plan, datum, start) + 0.1, length = Math.hypot(end[0] - start[0], end[1] - start[1]) || 1;
  const dirEast = (end[0] - start[0]) / length, dirNorth = (end[1] - start[1]) / length, sideEast = -dirNorth * 1.5, sideNorth = dirEast * 1.5;
  mesh.quad(TIMBER, [start[0] - sideEast, deck, start[1] - sideNorth], [start[0] + sideEast, deck, start[1] + sideNorth], [end[0] + sideEast, deck, end[1] + sideNorth], [end[0] - sideEast, deck, end[1] - sideNorth],
    [0, 1, 0], [[0, 0], [1, 0], [1, -length / 2], [0, -length / 2]]);
  for (let along = 0; along <= length; along += 3) for (const side of [-1, 1]) mesh.box(TIMBER, [start[0] + dirEast * along + sideEast * side, deck - 1.6, start[1] + dirNorth * along + sideNorth * side], [0.25, 3.2, 0.25], 1);
}
