// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW2 (2026-10-24, bible/03-World/World-Wide.md WW2): THE GATES OF EVERY THEATRE - the world host's omen, a lane at a
// time. The owner: "we can expand world events to happen more than once at a time since the world will be massive".
//
// Out of scenes/world.js (HOST-SPLIT: the host wires it). A LANE is a theatre's (world/worldWide/worldGrid.js - the Iliac
// Bay's 0, each province beyond it its own) and holds its own gate a game day (net/gate/gateLaw.js gateAt's `lane`). Lane
// 0 is the Bay's and always stands - its site the Bay's own scan's, the host's (`bayGateSite`); a lane past the Bay stands
// once the world's registry holds a theatre's towns with ground for a gate about them (world/worldWide/worldPlaces.js -
// TESA's places, when they are registered) and the relay keeps the lanes (`lanesOk`: an older one would refuse the
// rooms and close the socket on a site word past the Bay's map).
//
// ONE OMEN A LANE (systems/gate/gateOmen.js), each saying its own lines; and the world host reads them as it read one:
//  - `frame`, `current`, `mapMark` are the Bay's lane's - the gate it always knew, so every reader of those is unchanged;
//  - `standing`, `sky`, `cageSite` and `nearCurrent` are the NEAREST gate's to the player (`here`) - one gate's stone, its
//    sky, its Broker and its rite stand at a time, and a gate past the Bay is a province away from the Bay's;
//  - `mapMarks` and `currents` are every lane's, the map's rings and the timers' rows;
//  - `siteOf(n)` the site of the gate numbered `n`, whichever lane it is on (a fall's line names it).
// The theatres' scans (systems/gate/theatreGateSite.js) are made once a registry generation, a theatre at a time.
// ═══════════════════════════════════════════════════════════════════
import { createGateOmen } from '../../systems/gate/gateOmen.js';
import { theatreGateScanner, findTheatreGateSite, theatreGateAreas } from '../../systems/gate/theatreGateSite.js';
import { gateLaneOf, GATE_LANES, gateLaneOpen } from '../../net/gate/gateLaw.js';
import { theatreAt, areaAt, BAY_THEATRE } from '../../world/worldWide/worldGrid.js';
import { GATE_TOWN_MAX_PX } from '../../systems/gate/gateSite.js';   // DRAGON-CELL: how far about a square its towns are read
import { inBay } from '../../world/tamriel/tamrielFrame.js';   // DRAGON-CELL: a square's ground past the Bay; the Bay's is its own scan's

/**
 * WW-GATES-EVERYWHERE (A2c): the page's idle moments - the browser's idle callback, else (a page with none: Safari) a
 * timer's slice of a few milliseconds, else (no page: a probe, a test) none, and a scan is made whole when it is asked.
 * @returns {((fn: (deadline: { didTimeout: boolean, timeRemaining: () => number }) => void, o?: { timeout?: number }) => void) | null}
 */
export function pageIdle() {
  const g = /** @type {any} */ (globalThis);
  if (typeof g.requestIdleCallback === 'function') return (fn, o) => g.requestIdleCallback(fn, o);
  if (typeof g.document !== 'undefined' && typeof g.setTimeout === 'function') return (fn) => g.setTimeout(() => fn({ didTimeout: true, timeRemaining: () => 0 }), 16);
  return null;
}
/** A slice the idle callback's timeout forced takes this long (ms) - the Bay scan's warm's own (scenes/world.js warmGateScan). */
export const SCAN_FORCED_SLICE_MS = 4;

/**
 * A theatre's gate scan, made once a registry generation (`places` - world/worldWide/worldPlaces.js; `wet(x, y)` the one
 * water law on the world's composed ground, the host's) and once a picture (`land()` - world/tamriel/tamrielLand.js
 * tamrielLandVersion: the trace lands after the boot, and a province's land and its theatre are the picture's).
 * `theatres()` the theatres past the Bay with ground for a gate, on a lane that stands (`open`: net/wire.js
 * GATE_LANES_OPEN, the relay's and the client's one law) - AUDIT TESA II P7: a closed lane's theatre is never scanned.
 * WW-GATES-EVERYWHERE (A2c): with the eight provinces' lanes open, their scans cost 453 to 661 ms of the page's thread in
 * one task, the first `theatres()` of each registry generation; now each is made in the page's idle moments (`idle` -
 * pageIdle's), a lane at a time and a few ring pixels a slice (systems/gate/theatreGateSite.js theatreGateScanner), the
 * Bay scan's own warm (scenes/world.js warmGateScan): `theatres()` answers the lanes whose scans are whole and begins the
 * rest, so a province's lane stands once its scan is done. With no idle moments to slice into (`idle` null) a scan is
 * made whole when it is asked, as before.
 * @param {{ places: import('../../world/worldWide/worldPlaces.js').WorldPlaces, wet: (x: number, y: number) => boolean, spawnSalt?: number, land?: () => number, open?: (lane: number) => boolean,
 *   idle?: ReturnType<typeof pageIdle>, clock?: () => number }} o
 */
export function createTheatreGateScans({ places, wet, spawnSalt, land = () => 0, open = gateLaneOpen, idle = pageIdle(), clock = () => performance.now() }) {
  // WW5: kept as the world host makes them (keptTheatreScans) - Starfall's and the Hollows' lanes read the same scans, never
  // a second walk of a theatre's rings
  let gen = -1, ver = -1;
  /** @type {Map<number, import('../../systems/gate/theatreGateSite.js').TheatreGateScan>} */ const scans = new Map();
  /** @type {Map<number, ReturnType<typeof theatreGateScanner>>} */ const scanners = new Map();
  /** @type {Map<number, boolean>} */ const grounds = new Map();   // a whole scan's: whether it offers a gate ground
  /** @type {Map<string, import('../../systems/gate/theatreGateSite.js').TheatreGateScan>} */ const grounds8 = new Map();   // DRAGON-CELL: a square's (groundIn)
  /** @type {number[]|null} */ let theatres = null;
  let warming = false;
  const fresh = () => { if (places.generation() !== gen || land() !== ver) { gen = places.generation(); ver = land(); scans.clear(); scanners.clear(); grounds.clear(); grounds8.clear(); theatres = null; } };
  /** @param {number} t */
  const scannerOf = (t) => {
    let s = scanners.get(t);
    if (!s) scanners.set(t, s = theatreGateScanner({ towns: places.inTheatre(t), placeAt: places.at, inTheatre: (x, y) => theatreAt(x, y) === t, areaAt: (x, y) => areaAt(x, y, () => -1), wet, theatre: t, spawnSalt }));
    return s;
  };
  /** A theatre's scan made whole, kept for the generation. @param {number} t @param {import('../../systems/gate/theatreGateSite.js').TheatreGateScan} s */
  const keep = (t, s) => { scans.set(t, s); scanners.delete(t); grounds.set(t, theatreGateAreas(s).length > 0); theatres = null; return s; };
  /** A theatre's scan, whole - made now if it is not yet (a test's, a probe's, and every ask with no idle moments). @param {number} t */
  const scanOf = (t) => { fresh(); return scans.get(t) ?? keep(t, /** @type {any} */ (scannerOf(t).step())); };
  /** The theatres past the Bay a gate may stand in, on a lane that stands - AUDIT TESA II P7: a closed lane unscanned. */
  const wanted = () => places.theatres().filter((t) => t !== BAY_THEATRE && t < GATE_LANES && open(t));
  /** THE WARM: each wanted theatre's scan, a slice an idle moment, a lane at a time, until every one is whole. */
  const warm = () => {
    if (warming || !idle) return;
    warming = true;
    const go = /** @type {NonNullable<typeof idle>} */ (idle);
    go(function slice(deadline) {
      try {
        fresh();
        const until = clock() + (deadline.didTimeout ? SCAN_FORCED_SLICE_MS : 0);
        const more = () => deadline.timeRemaining() > 2 || clock() < until;
        for (const t of wanted()) {
          if (scans.has(t)) continue;
          const s = scannerOf(t).step(more);
          if (s) keep(t, s);
          if (!s || !more()) { go(slice, { timeout: 250 }); return; }
        }
      } catch (e) { console.warn('[gate] a province\'s scan', /** @type {any} */ (e)?.message ?? e); scanners.clear(); }
      warming = false;
    }, { timeout: 4000 });
  };
  return (_kept = {
    scanOf,
    /** The theatres past the Bay that hold ground for a gate, ascending - a lane each: those whose scans are whole (the
     *  rest begun in the page's idle moments - all of them made now where it has none). */
    theatres() {
      fresh();
      if (theatres) return theatres;
      const want = wanted();
      if (!idle) for (const t of want) scanOf(t);
      const whole = want.every((t) => grounds.has(t));
      if (!whole) warm();
      const out = want.filter((t) => grounds.get(t) === true);
      if (whole) theatres = out;
      return out;
    },
    /** A lane's gate's site by its number, or null. @param {number} n */
    siteOf: (n) => { const t = gateLaneOf(n); if (t === BAY_THEATRE) return null; fresh(); const s = idle ? scans.get(t) : scanOf(t); if (!s) { warm(); return null; } return findTheatreGateSite(n, s); },   // A2c: a scan not yet whole stands no site - the warm makes it
    /** WW5 x WW-GATES-EVERYWHERE (A2c): a theatre's scan if it is whole, else null with the warm begun - the event lanes' ask
     *  (scenes/eventTheatres.js), which never makes a scan whole in one task where the page has idle moments to slice it
     *  into; with none, or for a theatre the warm does not make (a lane no gate stands on), made where it is asked, as
     *  scanOf. @param {number} t */
    wholeScan: (t) => { fresh(); const s = scans.get(t); if (s || !idle) return s ?? scanOf(t); if (!wanted().includes(t)) return scanOf(t); warm(); return null; },
    /** DRAGON-CELL (bible/11-Multiplayer/Dwarven-Dragon.md section 2): the gate's ground in one square past the Bay, `side`
     *  pixels from (x0, y0) - each pixel on a lane that stands, its towns every place of a town's kind about it, the
     *  countryside's among them (a theatre's scan lists its listed towns alone). Kept for the generation, the last few.
     *  @param {number} x0 @param {number} y0 @param {number} side */
    groundIn(x0, y0, side) {
      fresh();
      const key = `${x0},${y0},${side}`;
      let g = grounds8.get(key);
      if (g) return g;
      const towns = [], R = GATE_TOWN_MAX_PX, laneOk = (/** @type {number} */ t) => t !== BAY_THEATRE && t < GATE_LANES && open(t);
      for (let y = y0 - R; y < y0 + side + R; y++) for (let x = x0 - R; x < x0 + side + R; x++) {
        const p = inBay(x, y) ? null : places.at(x, y);
        if (p && p.px === x && p.py === y) towns.push(p);
      }
      const inside = (/** @type {number} */ x, /** @type {number} */ y) => x >= x0 && y >= y0 && x < x0 + side && y < y0 + side && laneOk(theatreAt(x, y));
      g = theatreGateScanner({ towns, placeAt: places.at, inTheatre: inside, areaAt: (x, y) => areaAt(x, y, () => -1), wet, theatre: -1, spawnSalt }).step();
      grounds8.set(key, g);
      if (grounds8.size > 8) grounds8.delete(/** @type {string} */ (grounds8.keys().next().value));
      return g;
    },
  });
}
/** @typedef {{ scanOf: (t: number) => import('../../systems/gate/theatreGateSite.js').TheatreGateScan, theatres: () => number[], siteOf: (n: number) => any,
 *   wholeScan?: (t: number) => (import('../../systems/gate/theatreGateSite.js').TheatreGateScan | null),
 *   groundIn?: (x0: number, y0: number, side: number) => import('../../systems/gate/theatreGateSite.js').TheatreGateScan }} TheatreGateScans */
/** @type {TheatreGateScans|null} */
let _kept = null;
/** WW5 (bible/03-World/World-Wide.md WW5): the world host's theatre scans as it made them (scenes/world.js - online alone),
 *  or null - read by Starfall's and the Hollows' lanes (scenes/eventTheatres.js) as net/staffPlaces.js keptPlaces is: a
 *  theatre's suitable ground is the gate's, scanned once a registry generation and a picture for every event that stands
 *  on it, with no wiring of its own in the host. */
export const keptTheatreScans = () => _kept;

/**
 * The world host's gates, a lane each.
 * @param {{ omen: Omit<Parameters<typeof createGateOmen>[0], 'site'|'lane'>, bayGateSite: (n: number) => any,
 *   scans: ReturnType<typeof createTheatreGateScans> | null, lanesOk: () => boolean, here: () => ({ x: number, y: number } | null),
 *   open?: (lane: number) => boolean }} o `open` the lanes that stand (AUDIT WW F2: net/wire.js GATE_LANES_OPEN - the relay
 *   admits no other, so a theatre with ground on a lane that does not stand shows no gate nobody could enter)
 */
export function createGateLanes({ omen, bayGateSite, scans, lanesOk, here, open = gateLaneOpen }) {
  /** @type {Map<number, ReturnType<typeof createGateOmen>>} */ const omens = new Map();
  /** @param {number} lane */
  const omenOf = (lane) => {
    let o = omens.get(lane);
    if (!o) {
      const site = lane === BAY_THEATRE ? bayGateSite : (/** @type {number} */ n) => scans?.siteOf(n) ?? null;
      omens.set(lane, o = createGateOmen({ ...omen, site, lane }));
    }
    return o;
  };
  const bay = omenOf(BAY_THEATRE);
  /** The lanes standing now: the Bay's, and each theatre's with ground on a lane that stands while the relay keeps the lanes. */
  const lanes = () => (scans && lanesOk() ? [BAY_THEATRE, ...scans.theatres().filter(open)] : [BAY_THEATRE]);
  /** The nearest to the player of every lane's `pick(omen)` that names a pixel (`px`, `py`). */
  const nearest = (/** @type {(o: ReturnType<typeof createGateOmen>) => any} */ pick) => {
    const p = here();
    let best = null, bestD = Infinity;
    for (const lane of lanes()) {
      const v = pick(omenOf(lane));
      if (!v) continue;
      const s = v.site ?? v;
      const d = p && Number.isFinite(s?.px) ? Math.hypot(s.px - p.x, s.py - p.y) : lane === BAY_THEATRE ? 0 : Infinity;
      if (d < bestD || !best) { best = v; bestD = d; }
    }
    return best;
  };
  return {
    /** One frame of every lane's omen; the Bay's state answered (its readers', as before). */
    frame() {
      let out = null;
      for (const lane of lanes()) { const c = omenOf(lane).frame(); if (lane === BAY_THEATRE) out = c; }
      return out;
    },
    /** The Bay's gate as the last frame saw it. */
    current: () => bay.current(),
    /** The Bay's gate's ring on the map. */
    mapMark: () => bay.mapMark(),
    /** The ring of every lane's gate past the Bay that is marked now - the Bay's is `mapMark`. */
    mapMarks: () => lanes().filter((l) => l !== BAY_THEATRE).map((l) => omenOf(l).mapMark()).filter(Boolean),
    /** Every lane's gate as the last frame saw it, with its lane. */
    currents: () => lanes().map((lane) => ({ lane, c: omenOf(lane).current() })).filter((x) => x.c),
    /** The site of the gate numbered `n`, as its lane's last frame found it - or null. @param {number} n */
    siteOf: (n) => { const c = omens.get(gateLaneOf(n))?.current(); return c?.t?.day === n ? c.site : null; },
    /** The ring of the gate numbered `n` while it is marked - or null. @param {number} n */
    markOf: (n) => { const m = omens.get(gateLaneOf(n))?.mapMark(); return m?.day === n ? m : null; },
    /** The nearest gate's state (`{t, phase, site}`) - the rite's circle stands at it. */
    nearCurrent: () => nearest((o) => { const c = o.current(); return c?.site ? c : null; }) ?? bay.current(),
    /** The nearest standing gate - its stone, its plaque, the compass's mark. */
    standing: () => nearest((o) => o.standing()),
    /** The sky the nearest burning gate burns over an eye (gateOmen.js sky). */
    sky(/** @type {any} */ eye, /** @type {any} */ pixelTranslation) {
      let best = null;
      for (const lane of lanes()) { const s = omenOf(lane).sky(eye, pixelTranslation); if (s && (!best || s.weight > best.weight)) best = s; }
      return best;
    },
    /** BROKER-CAGE: the nearest breach's site from its omen to the Wrath's midnight. */
    cageSite: () => nearest((o) => o.cageSite()),
    /** The lanes standing now. */
    lanes,
    /** AUDIT FRONTS B12: whether the relay keeps the lanes past the Bay - the provinces' events, and so their turns, stand. */
    lanesOk: () => !!lanesOk(),
  };
}
