// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW5 (2026-10-26, bible/03-World/World-Wide.md WW5 - the owner's call taken: "Every single thing here needs to be
// addressed. No exceptions."): A HOLLOW IN EVERY THEATRE, ON THIS SCREEN - the world host's Abyss Dungeons, a lane at a
// time (net/superDungeon/sdLaw.js: the Bay's lane and each province's, Cyrodiil's open zone none).
//
// THE BAY'S LANE IS THE HOST IT ALWAYS WAS (scenes/superDungeon/sdHost.js, the world host's own seams, the Bay's scan, its
// rows). A PROVINCE'S LANE is a host of its own over its province's ground: its record the hub's `ln` word (net/online.js),
// its cities the registry's places of its theatre (systems/superDungeon/sdSite.js sdTheatreCities - TESA's, WW7-1), its
// site the gate's own suitable pixels of the theatre (findSdTheatreSite over scenes/eventTheatres.js's warmed scan), its
// map id the Hollows' world lane, its lines in its province. Each judges its own slots alone where I stand: a lane's end
// casts out of its own Hollow, never another's.
//
// The world host reads it as it read the one host - each reader of ONE Hollow reads the one in FOCUS: the lane whose
// Hollow or Hour I stand in, else the one whose Hollow stands nearest my map pixel (`here`), else the Bay's - one omen,
// one banner, one compass mark, one Rift at a time, a province away from the next. `mapMarks` and `timers` are every
// lane's (the held map's rings, the Timers' rows); `record(s)` and `hollow(s)` a slot's own lane's. Not a DFU member.
// Ledger A (WW5).
// ═══════════════════════════════════════════════════════════════════
import { createSdHost } from './sdHost.js';
import { createEventTheatres } from '../eventTheatres.js';
import { keptTheatreScans } from '../gate/gateLanes.js';
import { keptPlaces } from '../../net/staffPlaces.js';
import { tamrielLandVersion } from '../../world/tamriel/tamrielLand.js';
import { sdLaneOf, SD_LANES } from '../../net/superDungeon/sdLaw.js';
import { sdTheatreCities, findSdTheatreSite } from '../../systems/superDungeon/sdSite.js';
import { PROVINCE_REGION_NAMES } from '../../formats/mapsTables.js';
import { theatreAt } from '../../world/worldWide/worldGrid.js';

/** @typedef {ReturnType<typeof createSdHost>} SdHost */

/**
 * @param {Parameters<typeof createSdHost>[0] & {
 *   here?: () => ({ x: number, y: number } | null),
 *   theatreScans?: any, places?: any, landVersion?: () => number, idle?: ((fn: () => void) => void) | null,
 * }} o the Bay's host's seams (sdHost.js), and `here` my map pixel; `theatreScans`, `places`, `landVersion` and `idle` the
 *   tests' (the world host's own by default: scenes/gate/gateLanes.js keptTheatreScans, net/staffPlaces.js keptPlaces)
 */
export function createSdLanes(o) {
  const placesOf = () => (o.places !== undefined ? o.places : keptPlaces());
  const theatres = createEventTheatres({
    scans: () => (o.theatreScans !== undefined ? o.theatreScans : keptTheatreScans()),
    generation: () => placesOf()?.generation?.() ?? 0,
    land: () => (o.landVersion ?? tamrielLandVersion)(),
    idle: o.idle,
  });
  const standing = o.standing ?? (() => null);
  /** The Bay's lane's host - the one it always was, judging the Bay's own slots alone where I stand (a province's Hollow I
   *  stand in is its own lane's to end). */
  const bay = createSdHost({
    ...o,
    standing: () => {
      const s = standing();
      return s != null && sdLaneOf(s) === 0 ? s : null;
    },
  });
  /** lane -> its host, made at its first record */
  /** @type {Map<number, SdHost>} */ const lanes = new Map();
  /** WHETHER A PROVINCE'S HOLLOW IS ASKED OF ITS GROUND NOW - its theatre's scan is a few hundred milliseconds of the
   *  page's idle time (scenes/eventTheatres.js), so it is made only where its Hollow can matter: it is news (found, or
   *  collapsing - its ring, its row and its line want its city), or I stand in its theatre (a find, its column, its
   *  taverns). A risen Hollow a province away is a find nobody here can make. */
  const wanted = (lane, h) => {
    const p = o.here?.() ?? null;
    if (p && theatreAt(p.x, p.y) === lane) return true;
    const ph = h?.phase?.();
    return ph === 'found' || ph === 'fell';
  };
  /** A province lane's host - its own ground, its own cities, its own slots judged where I stand. */
  const laneHost = (lane) => {
    let h = lanes.get(lane);
    if (!h) {
      const province = PROVINCE_REGION_NAMES[lane - 1] ?? '';
      h = createSdHost({
        ...o,
        // its theatre's scan once warm, and one with no town is none yet (TESA's places not landed: asked again when they do)
        scan: () => {
          const sc = wanted(lane, lanes.get(lane)) ? theatres.scanOf(lane) : null;
          return sc && sc.towns.length ? sc : null;
        },
        rescan: true,
        warmScan: () => {
          if (wanted(lane, lanes.get(lane))) theatres.scanOf(lane);
        },
        cities: (r) => sdTheatreCities(placesOf(), lane, r, { provinceName: province }),
        findSite: findSdTheatreSite,
        province,
        // its own slots alone: another lane's Hollow I stand in is that lane's to judge
        standing: () => {
          const s = standing();
          return s != null && sdLaneOf(s) === lane ? s : null;
        },
      });
      lanes.set(lane, h);
    }
    return h;
  };
  /** Every lane's host there is: the Bay's, then each province's that has heard its record. */
  const all = () => [bay, ...lanes.values()];
  const hostOf = (s) => {
    const lane = Number.isSafeInteger(s) ? sdLaneOf(s) : 0;
    return lane === 0 ? bay : (lanes.get(lane) ?? null);
  };
  /** THE FOCUS: the lane I stand in (its Hollow or its Hour), else the one whose Hollow stands nearest me, else the Bay's. */
  function focus() {
    const s = standing();
    if (s != null) return hostOf(s) ?? bay;
    const p = o.here?.() ?? null;
    let best = bay,
      bestD = Infinity;
    for (const h of all()) {
      const site = h.hollow()?.site;
      if (!site) continue;
      const d = p ? Math.hypot(site.px - p.x, site.py - p.y) : h === bay ? 0 : Infinity;
      if (d < bestD) {
        best = h;
        bestD = d;
      }
    }
    return best;
  }
  return {
    /** A record the hub said - the Bay's `ev`, a province lane's `ln` - to its own lane's host. */
    heard(w) {
      if (!w || !Number.isSafeInteger(w.s)) return;
      const lane = sdLaneOf(w.s);
      if (lane === 0) bay.heard(w);
      else if (SD_LANES.includes(lane)) laneHost(lane).heard(w);
    },
    /** ONE FRAME of every lane's host. */
    frame() {
      for (const h of all()) h.frame();
    },
    /** The record of slot `s`'s lane, else the focus's (null before its hub's first word). */
    record: (s) => (s != null ? (hostOf(s)?.record() ?? null) : focus().record()),
    /** The Hollow standing in the world for slot `s`'s lane, else the focus's - `{ s, site, loc, key }` - or null. */
    hollow: (s) => (s != null ? (hostOf(s)?.hollow() ?? null) : focus().hollow()),
    isHollow: (loc) => bay.isHollow(loc),
    /** The phase of slot `s`'s lane's record, else the focus's. */
    phase: (s) => (s != null ? (hostOf(s)?.phase() ?? 'gone') : focus().phase()),
    /** The focus's ring on the map (the notice boards' and the compass's one Hollow). */
    mapMark: () => focus().mapMark(),
    /** WW5: every lane's ring while its Hollow is news - the held map's (ui/heldMap.js `sd`). */
    mapMarks: () =>
      all()
        .map((h) => h.mapMark())
        .filter(Boolean),
    /** The focus's omen column. */
    omen: () => focus().omen(),
    /** "Any news?" - the focus's taverns' word. */
    rumor: (here, session, opts) => focus().rumor(here, session, opts),
    /** WW5: THE TIMERS' SOURCE (systems/eventTimers.js `sd`): the Bay's Hollow as it always was (`rec`, `name`, `site`),
     *  and each province lane's beside it (`lanes` - `{ rec, name, site, lane, province, mine }`, `mine` the theatre I stand
     *  in: its next rise is its own players' row). */
    timers() {
      const one = (h) => ({ rec: h.record(), name: h.hollow()?.loc?.name ?? null, site: h.hollow()?.site ?? null });
      const p = o.here?.() ?? null,
        at = p ? theatreAt(p.x, p.y) : -1;
      return {
        ...one(bay),
        lanes: [...lanes.entries()].map(([lane, h]) => ({
          ...one(h),
          lane,
          province: PROVINCE_REGION_NAMES[lane - 1] ?? '',
          mine: lane === at,
        })),
      };
    },
    /** The lanes' hosts, for the tests and the probes. */
    lanes: () => new Map([[0, bay], ...lanes]),
  };
}
