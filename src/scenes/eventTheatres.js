// @ts-check
// ═══════════════════════════════════════════════════════════════════
// WW5 (2026-10-26, bible/03-World/World-Wide.md WW5): THE THEATRES A STAR NIGHT AND A HOLLOW STAND IN - the ground past the
// Bay each of WW5's lanes reads (net/wire.js SITE_EVENT_LANES: the eight provinces; Cyrodiil's open zone none), off the
// gate's own theatre scans (scenes/gate/gateLanes.js keptTheatreScans - one walk of a theatre's rings a registry
// generation and a picture, whichever event asks first), WARMED A THEATRE AT A TIME in the browser's idle moments: with
// TESA's places registered a theatre's scan is some forty to sixty milliseconds of the page's thread (AUDIT TESA II P7:
// eight at once were 453 ms), so a frame never pays more than the one it asks of a theatre already scanned. A page with
// no idle queue (node's tests) scans where it asks.
//
// `scanOf(t)` is the theatre's scan once it is warm (null until then - asking warms it); `ready(t)` whether it is. Where the
// gate's scans slice a theatre's walk themselves (WW-GATES-EVERYWHERE A2c, `wholeScan`), an idle moment here asks whether it
// is whole and waits on it - the walk is the gate's slices', never one idle moment's here.
// Kept by the scans object, the registry's generation and the picture (`land()` - world/tamriel/tamrielLand.js
// tamrielLandVersion): a new one of any is a new scan to warm. Not a DFU member. Ledger A (WW5).
// ═══════════════════════════════════════════════════════════════════
import { SITE_EVENT_LANES } from '../net/wire.js';

/** WW5: the lanes past the Bay a site-bound world event stands on - SITE_EVENT_LANES less the Bay's. */
export const PROVINCE_EVENT_LANES = Object.freeze(SITE_EVENT_LANES.filter((l) => l > 0));

/**
 * @param {{ scans: () => (import('./gate/gateLanes.js').TheatreGateScans | null),
 *   generation?: () => number, land?: () => number, idle?: ((fn: () => void) => void) | null }} o `generation` the registry's
 *   (world/worldWide/worldPlaces.js), `idle(fn)` the browser's idle queue (requestIdleCallback's, by default; null: none)
 */
export function createEventTheatres({ scans, generation = () => 0, land = () => 0, idle = defaultIdle() }) {
  /** theatre -> the stamp its warm scan was made under */
  const warm = new Map();
  /** theatres asked and waiting their idle moment */
  const owed = new Set();
  let busy = false;
  const stampOf = (S) => `${generation()}:${land()}:${idOf(S)}`;
  /** One theatre's scan made in an idle moment, then the next one owed. */
  function drain() {
    busy = false;
    const S = scans();
    const t = owed.values().next().value;
    if (t === undefined || !S) {
      owed.clear();
      return;
    }
    try {
      // WW5 x WW-GATES-EVERYWHERE (A2c): the gate's scans slice a theatre's walk across the page's idle moments themselves -
      // a theatre is asked of them whole (wholeScan) and waited on, never made whole in this one
      const sc = S.wholeScan ? S.wholeScan(t) : S.scanOf(t);
      if (sc) {
        owed.delete(t);
        warm.set(t, stampOf(S));
      }
    } catch (e) {
      owed.delete(t);
      console.warn('[events] theatre scan', t, /** @type {any} */ (e)?.message ?? e);
    }
    if (owed.size && idle) {
      busy = true;
      idle(drain);
    }
  }
  /** @param {number} t */
  function scanOf(t) {
    const S = scans();
    if (!S || !PROVINCE_EVENT_LANES.includes(t)) return null;
    if (warm.get(t) === stampOf(S)) return S.scanOf(t);
    if (!idle) {
      const sc = S.scanOf(t);
      warm.set(t, stampOf(S));
      return sc;
    }
    owed.add(t);
    if (!busy) {
      busy = true;
      idle(drain);
    }
    return null;
  }
  return {
    scanOf,
    /** @param {number} t */
    ready: (t) => {
      const S = scans();
      return !!S && warm.get(t) === stampOf(S);
    },
    /** The lanes past the Bay, each with its scan once warm (`[lane, scan]`, warm ones only - asking warms the rest). */
    warmLanes: () => PROVINCE_EVENT_LANES.map((t) => [t, scanOf(t)]).filter(([, sc]) => !!sc),
  };
}

/** A scans object's identity as a number (a new one - a new world host - is a new stamp). */
const _ids = new WeakMap();
let _next = 1;
const idOf = (o) => {
  if (!o) return 0;
  let n = _ids.get(o);
  if (!n) _ids.set(o, (n = _next++));
  return n;
};

/** The browser's idle queue, or null where there is none. */
function defaultIdle() {
  const ric = /** @type {any} */ (globalThis).requestIdleCallback;
  return typeof ric === 'function' ? (fn) => ric(() => fn(), { timeout: 2000 }) : null;
}
