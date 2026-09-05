// ROADS 26b (2026-09-05): THE REBUILD PLAN - one for the season re-skin
// (ROAD-Ar R0) and the roadless sweep (ROADS 26), which both tear
// standing pixels down and put them back. Pure: which pixels come back
// in what order, and what the motor hold has to wait for.
//
// Nearest-first is StreamingWorldState._loadList's own order (the
// Chebyshev ring, then Euclidean within it), so the pixel under the
// player comes back first and its ring right after. The hold is keyed
// on the pixel under the FEET: the streamer's `current` is derived from
// the interpolated eye plus the head-bob, and at a seam the two name
// different pixels - the release reads heightAt(feet), so the arm has
// to name what the release reads. The ring is every swept pixel within
// one of the feet's: with the player's own pixel back first, a motor
// released on it alone stood one step from a neighbour still a hole.

/** Chebyshev distance between two pixels {px, py}. */
export function chebyshev(a, b) { return Math.max(Math.abs(a.px - b.px), Math.abs(a.py - b.py)); }

/** 'px,py' -> {px, py}. */
export function parseKey(key) { const [px, py] = key.split(',').map(Number); return { px, py }; }

/** The load list's comparator around `current` ({x, y}): ring first,
 *  then the nearer within the ring. A stable sort keeps ties in order. */
export function nearestFirst(current) {
  return (p, q) => {
    const ca = Math.max(Math.abs(p.px - current.x), Math.abs(p.py - current.y));
    const cb = Math.max(Math.abs(q.px - current.x), Math.abs(q.py - current.y));
    if (ca !== cb) return ca - cb;
    return ((p.px - current.x) ** 2 + (p.py - current.y) ** 2) - ((q.px - current.x) ** 2 + (q.py - current.y) ** 2);
  };
}

/**
 * @param {{keys: string[], current: {x: number, y: number}, feetKey?: string|null}} p
 *   keys - the pixel keys to tear down; current - the streamer's pixel,
 *   the sort centre; feetKey - the pixel under the player's feet, or
 *   null when no player stands.
 * @returns {{rebuild: {px: number, py: number}[], holdKey: string|null, holdRing: string[]}}
 *   rebuild - the same pixels, nearest-first; holdKey - the feet's
 *   pixel when any swept pixel is within one of it (else null: nothing
 *   goes from under or beside the player); holdRing - those swept
 *   pixels, the ones the release waits for.
 */
export function planPixelRebuild({ keys, current, feetKey = null }) {
  const rebuild = keys.map(parseKey).sort(nearestFirst(current));
  if (feetKey === null || feetKey === undefined) return { rebuild, holdKey: null, holdRing: [] };
  const feet = parseKey(feetKey);
  const holdRing = keys.filter((k) => chebyshev(parseKey(k), feet) <= 1);
  return holdRing.length ? { rebuild, holdKey: feetKey, holdRing } : { rebuild, holdKey: null, holdRing: [] };
}
