// @ts-check
// A SETTLEMENT ALONG A BRANCHING STREET TREE. A green at its heart, a trunk street through it from gate to gate, lanes
// branching off the trunk and off the green's two sides, and narrower lanes off those: every street straight, a pad on it
// (its own paving and a row of plots either side), cut into terraces along its length. A lane leaves its street at an
// angle, its pad clear of the street's, a link across the gap. Stages A to C (the cells and their terraces) and D to F
// (the streets, plots and houses) of the generator's third layout; settlementLayout.js and settlementGen.js call it.
// Worker-safe: world/ alone.
import { hash32 } from '../blockHash.js';
import { dsin, dcos, dhypot } from './exactMath.js';
import { PITCH_MAX, STEP_MAX, TREE_CLEAR, FEATURE_CLEAR, MARKET_RING, featureReach } from './settlementLimits.js';
import { ringsOverlap, distanceToSegment, ringWithin, edgeDistance } from './settlementGeometry.js';
import { SETTLEMENT_STYLES, SETTLEMENT_ARCHETYPES } from './settlementStyles.js';
import { cm, splits, cellBarred, ringCentroid, compassBearing, clampWithin, settleTerraces, districtDraw, TAU, KEEP_HALF, SETTLEMENT_GENERATOR_VERSION } from './settlementLayout.js';

/** A street pad's longest and shortest terrace along it, metres. */
export const CHUNK_MAX = 36;
export const CHUNK_MIN = 12;
/** How far a link reaches onto the pad past the one it leaves, metres. */
const LANE_REACH = 2.5;
/** How far past its landing a lane's first plots begin, metres. */
const LANE_CLEAR = 4;

/** @typedef {readonly [number, number]} Pt */
const at = (/** @type {readonly number[]} */ point, /** @type {readonly number[]} */ way, /** @type {number} */ far) => /** @type {Pt} */ ([point[0] + way[0] * far, point[1] + way[1] * far]);
const dirOf = (/** @type {number} */ bearing) => [dsin(bearing), dcos(bearing)];
const rightOf = (/** @type {number} */ bearing) => [dcos(bearing), -dsin(bearing)];
const round = (/** @type {Pt} */ point) => /** @type {Pt} */ ([cm(point[0]), cm(point[1])]);
const degrees = (/** @type {number} */ angle) => cm((((angle * 180) / Math.PI) % 360 + 360) % 360);

/** A street's box from `from` to `to` along it, its half width either side. */
function box(street, from, to) {
  const way = dirOf(street.bearing), across = rightOf(street.bearing), near = at(street.start, way, from), far = at(street.start, way, to);
  return [at(near, across, -street.half), at(far, across, -street.half), at(far, across, street.half), at(near, across, street.half)].map(round);
}

/** Where a street's terraces break: about CHUNK_MAX apart, never inside a lane's window. */
function chunkCuts(length, windows) {
  const count = Math.max(1, Math.ceil(length / CHUNK_MAX)), inside = (cut) => windows.some(([from, to]) => cut > from - 3 && cut < to + 3);
  const cuts = [];
  for (let i = 1; i < count; i++) {
    let cut = (length * i) / count;
    const window = windows.find(([from, to]) => cut > from - 3 && cut < to + 3);
    if (window) cut = cut - (window[0] - 3) < window[1] + 3 - cut ? window[0] - 3 : window[1] + 3;
    if (cut > CHUNK_MIN && cut < length - CHUNK_MIN && !inside(cut) && (!cuts.length || cut - cuts[cuts.length - 1] >= CHUNK_MIN)) cuts.push(cut);
  }
  return [0, ...cuts, length];
}

/**
 * Stages A to C of a tree: the green, the trunk, its lanes and theirs; each street's pads, their links, the terraces.
 * @param {import('./settlementLayout.js').SettlementInput} input @param {import('./settlementLayout.js').SiteEnv} env
 * @param {{ grad: number[] }} ground the site's fall (settlementLayout.js readSite)
 */
export function layoutTree(input, env, ground) {
  const { place, seed, site, roads = [], params = {} } = input;
  const kind = SETTLEMENT_ARCHETYPES[input.archetype], style = SETTLEMENT_STYLES[input.style];
  const rng = (/** @type {number[]} */ ...salt) => hash32(seed >>> 0, place >>> 0, 0x7472, ...salt) / 0x100000000;
  const pick = (range, ...salt) => range[0] + (range[1] - range[0]) * rng(...salt);
  const sizeK = clampWithin(params.size ?? 1, 0.5, 2), islands = kind.islands || style.deck > 0, deck = islands ? Math.max(style.deck, 1.4) : 0;
  const plotDepth = pick(style.depth, 1), halfOf = (width) => width / 2 + plotDepth + style.back;
  const trunkLength = pick(kind.size, 3) * sizeK, fix = input.fix ?? {};
  // the trunk's way: as published; else out along a road; else along the slope's contour, so the trunk stands level
  const fall = ground.grad, steep = dhypot(fall[0], fall[1]);
  const bearing = Number.isFinite(fix.bearing) ? (/** @type {number} */ (fix.bearing) * Math.PI) / 180 : roads.length ? (roads[0] * Math.PI) / 180
    : steep > 0.02 ? compassBearing(fall[1], -fall[0]) + (rng(4) < 0.5 ? 0 : TAU / 2) : rng(4) * TAU;
  const middle = /** @type {Pt} */ ([site.east, site.north]), greenHalf = Math.max(halfOf(style.street), kind.plaza * sizeK);
  const ahead = dirOf(bearing), aside = rightOf(bearing);
  const corner = (along, across) => at(at(middle, ahead, along * greenHalf), aside, across * greenHalf);
  const green = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)].map(round);

  // the streets, the trunk first: each its parent ('plaza' or a street's index), its place along it and its side
  const streets = [];
  const street = (role, start, way, length, width, parent, along, side, lean, depth, gap = 0.25) => {
    const made = { index: streets.length, role, start: round(start), bearing: way, length, width, half: halfOf(width), depth, parent, along, side, lean, gap, windows: [] };
    streets.push(made);
    return made;
  };
  const bend = (rng(30) - 0.5) * 0.7, backBearing = bearing + TAU / 2 + bend, backGap = halfOf(style.street) * Math.abs(dsin(bend) / dcos(bend)) + 0.25;
  street('trunk', at(middle, ahead, greenHalf + 0.25), bearing, trunkLength / 2 - greenHalf, style.street, 'plaza', 0, 0, 0, 1);
  street('trunk', at(at(middle, ahead, -greenHalf), dirOf(backBearing), backGap), backBearing, trunkLength / 2 - greenHalf, style.street, 'plaza', 0, 0, 0, 1, backGap);
  for (const side of [1, -1]) street('lane', at(middle, aside, side * (greenHalf + 0.25)), bearing + (side * TAU) / 4, pick([28, 52], 31, side + 1) * sizeK, style.street, 'plaza', 0, side, TAU / 4, 1);
  // a lane off a street: leaning forward off its side, started clear of the street's pad, its window kept on the street
  const branch = (parent, along, side, lean, length, width, role) => {
    const way = parent.bearing + side * lean, gap = halfOf(width) * Math.abs(dcos(lean) / dsin(lean)) + 0.25;
    const edge = at(at(parent.start, dirOf(parent.bearing), along), rightOf(parent.bearing), side * parent.half);
    const lane = street(role, at(edge, dirOf(way), gap), way, length, width, parent.index, along, side, lean, parent.depth + 1, gap);
    parent.windows.push({ side, from: along - width / 2 - 1.5, to: along + (gap + LANE_REACH) * dcos(lean) + width / 2 + 1.5, lane: lane.index });
    return lane;
  };
  for (const trunk of [streets[0], streets[1]]) {
    let along = 14 + rng(32, trunk.index) * 10, side = rng(33, trunk.index) < 0.5 ? 1 : -1, count = 0;
    while (along < trunk.length - 12) {
      const lean = TAU / 4 - rng(34, trunk.index, count) * 0.42;
      branch(trunk, along, side, lean, pick([28, 60], 35, trunk.index, count) * sizeK, style.street, 'lane');
      along += halfOf(style.street) / dsin(lean) + 1 + rng(36, trunk.index, count) * 12;
      side = -side;
      count++;
    }
  }
  if (kind.bands >= 2) for (const lane of streets.filter((one) => one.role === 'lane')) {
    if (lane.length < 40 || rng(37, lane.index) >= 0.65) continue;
    branch(lane, lane.length * (0.45 + rng(38, lane.index) * 0.3), rng(39, lane.index) < 0.5 ? 1 : -1, TAU / 4 - rng(40, lane.index) * 0.35, pick([20, 38], 41, lane.index) * sizeK, style.lane, 'twig');
  }

  // B - the cells: the green, then each street's terraces in turn, cut short where one would meet a pad, water or barred ground
  /** @type {Map<string, any>} */ const cells = new Map();
  const groundOf = (poly) => {
    const half = (from, to) => /** @type {Pt} */ ([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]);
    const points = [...poly, ...poly.map((point, i) => half(point, poly[(i + 1) % poly.length])), ringCentroid(poly)];
    const heights = points.map(([east, north]) => env.heightAt(east, north)), dry = heights.filter((_, i) => !env.waterAt?.(points[i][0], points[i][1]));
    const natural = (dry.length ? dry : heights).reduce((sum, height) => sum + height, 0) / (dry.length || heights.length);
    return { natural, top: Math.max(...heights), low: Math.min(...heights), wet: 1 - dry.length / points.length };
  };
  const cellOf = (id, k, j, poly, extra) => {
    const under = groundOf(poly);
    return { id, k, j, poly, ...under, raised: islands, h: islands ? under.top + deck : under.natural, ...extra };
  };
  cells.set('plaza', cellOf('plaza', 0, -1, green, {}));
  const lengthKept = new Map(), tried = { count: 1 }, links = [];
  const fits = (cell) => (islands || cell.wet <= 0.25) && !cellBarred(cell.poly, env, input.bounds) && [...cells.values()].every((other) => !ringsOverlap(cell.poly, other.poly));
  for (const one of streets) {
    const parent = one.parent === 'plaza' ? cells.get('plaza') : chunkAt(one.parent, one.along);
    if (!parent) continue;
    const cuts = chunkCuts(one.length, one.windows.map((window) => [window.from, window.to]));
    let last = null;
    for (let i = 0; i + 1 < cuts.length; i++) {
      tried.count++;
      const cell = cellOf(`t${one.index}.${i}`, parent.k + 1 + i, one.index, box(one, cuts[i], cuts[i + 1]), { alongFrom: cm(cuts[i]), alongTo: cm(cuts[i + 1]) });
      if (!fits(cell)) break;
      cells.set(cell.id, cell);
      if (last) {
        const way = dirOf(one.bearing);
        links.push(linkOf(last, cell, at(one.start, way, cuts[i] - LANE_REACH), at(one.start, way, cuts[i] + LANE_REACH), one.width, 'along'));
      } else {
        // off the green straight down the street's own line; off a street from its edge, across its window
        const from = one.parent === 'plaza' ? at(one.start, dirOf(one.bearing), -(one.gap + LANE_REACH))
          : at(at(streets[one.parent].start, dirOf(streets[one.parent].bearing), one.along), rightOf(streets[one.parent].bearing), one.side * (streets[one.parent].width / 2 + 0.5));
        links.push(linkOf(parent, cell, round(from), at(one.start, dirOf(one.bearing), LANE_REACH), one.width, one.parent === 'plaza' ? 'plaza' : 'lane'));
      }
      last = cell;
    }
    lengthKept.set(one.index, last ? last.alongTo : 0);
  }
  function chunkAt(index, along) {
    for (const cell of cells.values()) if (cell.j === index && cell.alongFrom < along && along < cell.alongTo) return cell;
    return null;
  }
  function linkOf(from, to, start, end, width, role) {
    const run = dhypot(end[0] - start[0], end[1] - start[1]), pitch = PITCH_MAX.stairs * run;
    return { from: from.id, to: to.id, kind: role, a: round(start), b: round(end), run, bridge: false, max: (from.raised || to.raised ? pitch : Math.min(style.terrace, pitch)) * 0.95 - 0.02, width };
  }

  // C - the terraces, then what the green no longer reaches dropped
  settleTerraces(cells, links);
  const reach = new Set(['plaza']);
  for (let grew = true; grew;) {
    grew = false;
    for (const link of links) if (cells.has(link.from) && cells.has(link.to) && reach.has(link.from) !== reach.has(link.to)) { reach.add(link.from); reach.add(link.to); grew = true; }
  }
  for (const id of [...cells.keys()]) if (!reach.has(id)) cells.delete(id);
  const live = links.filter((link) => cells.has(link.from) && cells.has(link.to));
  const built = [...cells.values()];
  const datum = cm(built.reduce((sum, cell) => sum + cell.natural, 0) / built.length);
  /** @type {import('./settlementContract.js').Pad[]} */
  const pads = built.map((cell) => ({ id: cell.id, poly: cell.poly, y: cm(cell.h - datum), rim: Math.abs(cell.h - cell.natural) > 1 ? 'wall' : 'grade', base: cell.raised ? 'raised' : 'cut' }));
  const padY = new Map(pads.map((pad) => [pad.id, pad.y]));
  const planLinks = live.map((link, i) => {
    const rise = Math.abs(padY.get(link.to) - padY.get(link.from));
    return { id: `l${i}`, kind: rise <= STEP_MAX ? 'grade' : rise <= PITCH_MAX.ramp * link.run ? 'ramp' : 'stairs', from: link.from, to: link.to, a: link.a, b: link.b, width: link.width };
  });
  const standing = streets.filter((one) => built.some((cell) => cell.j === one.index));
  return {
    version: SETTLEMENT_GENERATOR_VERSION, layout: 'tree', c: middle, bearing: degrees(bearing), shore: null, ring: false, inner: greenHalf, uStart: bearing, uSpan: 0, vOut: 0,
    edges: [], radii: [], reachOf: [], grids: [], gateSectors: [0, 1], gateBand: 1, islands, gap: 0, ws: style.street, wl: style.lane, plotDepth, bands: kind.bands, sectors: standing.length,
    size: trunkLength, keepHalf: KEEP_HALF, made: tried.count, keptCount: built.length - 1, datum, pads, links: planLinks, walls: [], towers: [], docks: [], core: null,
    cells: built.map((cell) => ({ id: cell.id, k: cell.k, j: cell.j, poly: cell.poly, natural: cell.natural, low: cell.low, h: cell.h, raised: cell.raised, alongFrom: cell.alongFrom, alongTo: cell.alongTo })),
    streets: standing.map((one) => ({ index: one.index, role: one.role, start: one.start, bearing: one.bearing, length: cm(/** @type {number} */ (lengthKept.get(one.index))), width: one.width, half: one.half,
      parent: one.parent, side: one.side, windows: one.windows.filter((window) => standing.some((other) => other.index === window.lane)).map((window) => ({ side: window.side, from: cm(window.from), to: cm(window.to) })) })),
  };
}

/**
 * Stages D to F of a tree: each pad's street down its middle, plots either side behind it (none in a lane's window, none
 * before a lane's landing), a house on each plot big enough with its door to the street; districts by street, the gates at
 * the trunk's two ends, the outline round every pad, and the green's feature.
 * @param {import('./settlementLayout.js').SettlementInput} input @param {any} layout @param {{ density: number, openShare: number, kind: string }} options
 */
export function dressTree(input, layout, { density, openShare, kind }) {
  const style = SETTLEMENT_STYLES[input.style], drawOf = districtDraw(input);
  const byIndex = new Map(layout.streets.map((one) => [one.index, one])), cells = layout.cells.filter((cell) => cell.j >= 0);
  const streets = [], plots = [], features = [], proposed = [], districts = [];
  const deepest = Math.max(1, ...cells.map((cell) => cell.k));
  for (const cell of cells) {
    const one = byIndex.get(cell.j), way = dirOf(one.bearing), across = rightOf(one.bearing), axis = (/** @type {number} */ along) => at(one.start, way, along);
    streets.push({ id: `s${cell.id}`, rank: one.role === 'trunk' ? 'main' : one.role === 'lane' ? 'side' : 'alley', width: one.width, pad: cell.id, path: [round(axis(cell.alongFrom + 0.5)), round(axis(cell.alongTo - 0.5))] });
    const depth = Math.min(layout.plotDepth, one.half - one.width / 2 - style.back), front = one.width / 2, draw = drawOf(cell.j);
    if (depth < style.depth[0] * 0.7) continue;
    const choose = (/** @type {readonly number[]} */ range, /** @type {number[]} */ ...salt) => range[0] + (range[1] - range[0]) * draw(...salt);
    for (const side of [1, -1]) {
      // the stretches of this side its windows leave, past a lane's landing at its start
      let spans = [[cell.alongFrom + (cell.alongFrom === 0 && one.parent !== 'plaza' ? LANE_CLEAR : 1), cell.alongTo - 1]];
      for (const window of one.windows) if (window.side === side) spans = spans.flatMap(([from, to]) => [[from, Math.min(to, window.from)], [Math.max(from, window.to), to]]).filter(([from, to]) => to - from > 1);
      spans.forEach(([spanFrom, spanTo], span) => {
        const count = Math.floor((spanTo - spanFrom) / (choose(style.frontage, 8, cell.k, cell.j, side, span) / density));
        if (count < 1) return;
        for (const [local, [splitFrom, splitTo]] of splits(draw, count, spanTo - spanFrom, 9 + cell.k * 31 + cell.j * 7 + (side > 0 ? 0 : 3) + span * 11).entries()) {
          const id = `${cell.id}.${side > 0 ? 'r' : 'l'}${span}.${local}`, from = spanFrom + splitFrom, to = spanFrom + splitTo;
          const poly = [at(axis(from), across, side * front), at(axis(to), across, side * front), at(axis(to), across, side * (front + depth)), at(axis(from), across, side * (front + depth))].map(round);
          plots.push({ id, pad: cell.id, poly, street: `s${cell.id}`, district: `d${cell.j}` });
          const set = 0.5 + draw(16, cell.k, cell.j, side, span, local) * 1.2, deep = Math.min(depth - set - 0.05, choose(style.depth, 10, cell.k, cell.j, side, span, local));
          const inset = style.gap / 2, wall = front + set, back = wall + deep;
          const footprint = [at(axis(from + inset), across, side * wall), at(axis(to - inset), across, side * wall), at(axis(to - inset), across, side * back), at(axis(from + inset), across, side * back)].map(round);
          const wide = to - from - 2 * inset;
          if (wide < 5 || deep < 5 || draw(17, cell.k, cell.j, side, span, local) < openShare || !ringWithin(footprint, poly)) {
            features.push({ id: `g${id}`, kind: 'garden', pad: cell.id, at: ringCentroid(poly) });
            continue;
          }
          const door = round([(footprint[0][0] + footprint[1][0]) / 2, (footprint[0][1] + footprint[1][1]) / 2]);
          const facing = degrees(compassBearing(-across[0] * side, -across[1] * side));   // toward its street
          const prestige = (1 - (cell.k - 1) / deepest) * 0.6 + (one.role === 'trunk' ? 0.3 : 0) + draw(11, cell.k, cell.j, side, span, local) * 0.1;
          proposed.push({ id, c: cell, fp: footprint, door, facing, prestige, area: wide * deep, tall: choose(style.storeys, 12, cell.k, cell.j, side, span, local) });
        }
      });
    }
  }
  for (const one of layout.streets) {
    const poly = hull(cells.filter((cell) => cell.j === one.index).flatMap((cell) => cell.poly));
    if (poly.length >= 3) districts.push({ id: `d${one.index}`, purpose: one.role === 'trunk' ? 'market' : 'residential', poly });
  }
  // a gate at each end of the trunk, on its street a metre in
  const gates = [0, 1].flatMap((index, i) => {
    const trunk = byIndex.get(index), end = cells.filter((cell) => cell.j === index).sort((one, other) => other.alongTo - one.alongTo)[0];
    return trunk && end ? [{ id: `gate${i}`, pad: end.id, at: round(at(trunk.start, dirOf(trunk.bearing), end.alongTo - 1)) }] : [];
  });
  return { streets, plots, features, proposed, districts, gates, footprint: hull(layout.pads.flatMap((pad) => pad.poly)), centre: greenSpot(kind, layout) };
}

/** The green's feature: at its middle, else the nearest point that keeps its body on the green and clear of every way
 *  onto it; a market's ring drawn in on a small green. Null where none fits. @param {string} kind @param {any} layout */
export function greenSpot(kind, layout) {
  const green = layout.pads.find((pad) => pad.id === 'plaza');
  if (!green || kind === 'none') return null;
  const ways = layout.links.filter((link) => link.from === 'plaza' || link.to === 'plaza');
  for (const size of kind === 'market' ? [MARKET_RING, MARKET_RING * 0.85, MARKET_RING * 0.7] : [undefined]) {
    const reach = featureReach({ kind, size });
    for (let away = 0; away <= layout.inner; away += 1) {
      for (let k = 0; k < (away > 0 ? 24 : 1); k++) {
        const spot = round(at(layout.c, dirOf(layout.uStart + (k * TAU) / 24), away));
        if (edgeDistance(spot, green.poly) < reach + FEATURE_CLEAR) continue;
        if (ways.every((link) => distanceToSegment(spot, link.a, link.b) >= reach + link.width / 2 + FEATURE_CLEAR)) return { at: spot, size, pad: 'plaza' };
      }
    }
  }
  return null;
}

/** A tree's yard trees: up to three along each side's yard behind its plots, by its district's draw, clear of a lane's
 *  window and every way between pads. None on a deck. @param {import('./settlementLayout.js').SettlementInput} input @param {any} layout */
export function treeYardTrees(input, layout) {
  const style = SETTLEMENT_STYLES[input.style], drawOf = districtDraw(input), byIndex = new Map(layout.streets.map((one) => [one.index, one])), out = [];
  for (const cell of layout.cells) {
    if (cell.j < 0 || cell.raised) continue;
    const one = byIndex.get(cell.j), lateral = one.half - style.back / 2;
    for (const side of [1, -1]) for (let slot = 0; slot < 3; slot++) {
      if (drawOf(cell.j)(13, cell.k, cell.j, side, slot) >= 0.5) continue;
      const along = cell.alongFrom + (cell.alongTo - cell.alongFrom) * (0.25 + slot * 0.25), spot = round(at(at(one.start, dirOf(one.bearing), along), rightOf(one.bearing), side * lateral));
      if (one.windows.some((window) => window.side === side && along > window.from - TREE_CLEAR && along < window.to + TREE_CLEAR)) continue;
      if (!layout.links.some((link) => distanceToSegment(spot, link.a, link.b) < link.width / 2 + TREE_CLEAR)) out.push({ id: `t${cell.id}.${side > 0 ? 'r' : 'l'}${slot}`, pad: cell.id, at: spot });
    }
  }
  return out;
}

/** The convex hull of points, counter-clockwise, rounded. @param {readonly Pt[]} points @returns {Pt[]} */
export function hull(points) {
  const sorted = [...new Map(points.map((point) => [`${point[0]},${point[1]}`, point])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const turn = (origin, a, b) => (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);
  const lower = [], upper = [];
  for (const point of sorted) { while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop(); lower.push(point); }
  for (const point of [...sorted].reverse()) { while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop(); upper.push(point); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
