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
import { scanTheatreGate, findTheatreGateSite, theatreGateAreas } from '../../systems/gate/theatreGateSite.js';
import { gateLaneOf, GATE_LANES, gateLaneOpen } from '../../net/gate/gateLaw.js';
import { theatreAt, areaAt, BAY_THEATRE } from '../../world/worldWide/worldGrid.js';

/**
 * A theatre's gate scan, made once a registry generation (`places` - world/worldWide/worldPlaces.js; `wet(x, y)` the one
 * water law on the world's composed ground, the host's) and once a picture (`land()` - world/tamriel/tamrielLand.js
 * tamrielLandVersion: the trace lands after the boot, and a province's land and its theatre are the picture's).
 * `theatres()` the theatres past the Bay with ground for a gate.
 * @param {{ places: import('../../world/worldWide/worldPlaces.js').WorldPlaces, wet: (x: number, y: number) => boolean, spawnSalt?: number, land?: () => number }} o
 */
export function createTheatreGateScans({ places, wet, spawnSalt, land = () => 0 }) {
  let gen = -1, ver = -1;
  /** @type {Map<number, import('../../systems/gate/theatreGateSite.js').TheatreGateScan>} */ const scans = new Map();
  /** @type {number[]|null} */ let theatres = null;
  const fresh = () => { if (places.generation() !== gen || land() !== ver) { gen = places.generation(); ver = land(); scans.clear(); theatres = null; } };
  /** @param {number} t */
  const scanOf = (t) => {
    fresh();
    let s = scans.get(t);
    if (!s) {
      s = scanTheatreGate({ towns: places.inTheatre(t), placeAt: places.at, inTheatre: (x, y) => theatreAt(x, y) === t, areaAt: (x, y) => areaAt(x, y, () => -1), wet, theatre: t, spawnSalt });
      scans.set(t, s);
    }
    return s;
  };
  return {
    scanOf,
    /** The theatres past the Bay that hold ground for a gate, ascending - a lane each. */
    theatres() {
      fresh();
      return (theatres ??= places.theatres().filter((t) => t !== BAY_THEATRE && t < GATE_LANES && theatreGateAreas(scanOf(t)).length > 0));
    },
    /** A lane's gate's site by its number, or null. @param {number} n */
    siteOf: (n) => { const t = gateLaneOf(n); return t === BAY_THEATRE ? null : findTheatreGateSite(n, scanOf(t)); },
  };
}

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
  };
}
