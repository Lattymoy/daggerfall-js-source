// @ts-check
// ═══════════════════════════════════════════════════════════════════
// NODE-MARKS (2026-10-01, Mac: "Any profession node, like herbs, should
// appear on the compass. The node itself should also stand out with a
// detailed slight glow or something"): A PROFESSION'S NODES, IN ITS
// OWN COLOUR - every herb patch, vein, boulder, tree, school and body
// standing near the player on the compass (both skins: ui/hud.js
// drawNodeCompassMarks, ui/enhancedHud.js) and lit in the world by its
// glow (render/nodeGlow.js), one colour a profession in both, so a mark
// and the light it points at read as one thing. The nodes themselves
// are the gathering host's (scenes/gatherHost.js marks).
//
// The colours keep clear of the compass's other marks - the party's
// green, the Detect markers' blood red, the gate's ember and the ships'
// red, bone and grey - and of each other (AUDIT NODE-MARKS: Logging's
// pale heartwood was a ship's bone and Hunting's coral a hostile ship's
// red; test/nodemarks.test.js holds the distances). Mining keeps the
// copper PROF2's Prospector's veins were drawn in, near the quest's gold,
// the gate's ember and a hostile ship's red - told apart by shape alone:
// theirs are diamonds on the strip's middle and a ship's triangle points
// up, a node's points down. A leaf - it imports nothing, so the HUD and
// the glow take it without taking each other.
// ═══════════════════════════════════════════════════════════════════

/** A gathering profession's mark colour (CSS hex) - its compass mark and its node's glow. */
export const NODE_MARK_CSS = Object.freeze({
  herbalism: '#e586ec',   // a blossom's orchid
  mining: '#d9894a',      // PROF2's copper
  logging: '#d4e157',     // a new leaf's sap green
  hunting: '#ff6f91',     // the rose of a fresh hide
  fishing: '#5ec8ff',     // the shallows' blue
});
/** A profession no colour is named for is drawn in Mining's (the first the compass marked). */
const FALLBACK = 'mining';
/** REST3 (bible/06-Systems/Rest-Arc.md 4.4): a dungeon's campfire, in the flame's yellow - clear of every mark above by
 *  more than the 75 the nodes keep from each other (the quest's gold, the nearest, by 91). Not a profession: its own
 *  mark word, 'fire'. */
export const FIRE_MARK_CSS = '#ffd000';
/** How far a campfire stands on the strip. */
export const FIRE_MARK_REACH = 120;

/** The mark's CSS colour for a profession (or REST3's 'fire'). Pure. */
export const nodeMarkCss = (profession) => (profession === 'fire' ? FIRE_MARK_CSS : NODE_MARK_CSS[profession] ?? NODE_MARK_CSS[FALLBACK]);
/** The mark's colour as display-encoded floats [r, g, b], one frozen triple a profession. Pure. */
const RGB = Object.freeze(Object.fromEntries(Object.entries(NODE_MARK_CSS).map(([k, hex]) => {
  const n = parseInt(hex.slice(1), 16);
  return [k, Object.freeze([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255])];
})));
const FIRE_RGB = Object.freeze([0xff / 255, 0xd0 / 255, 0]);
export const nodeMarkRgb = (profession) => (profession === 'fire' ? FIRE_RGB : RGB[profession] ?? RGB[FALLBACK]);

/** How dim a mark at the edge of its reach stands beside one at the player's feet: nearer reads brighter. */
export const NODE_MARK_FAR_DIM = 0.45;
/** A mark's opacity at `d` metres of its `reach` - 1 at the feet, 1 - NODE_MARK_FAR_DIM at the reach. Pure. */
export const nodeMarkAlpha = (d, reach) => 1 - NODE_MARK_FAR_DIM * Math.min(1, Math.max(0, reach > 0 ? d / reach : 0));

/**
 * @typedef {{ xz: number[], mark: string, a: number }} NodeCompassPoint `xz` the place's scene XZ (compassMarkerLerp's
 *   target), `mark` the profession whose colour it is drawn in, `a` its opacity
 */
/** The compass's points: one list, refilled (AUDIT WB D10's law) - the HUD reads it in the frame it is made. */
const _points = /** @type {NodeCompassPoint[]} */ ([]);
const _pool = /** @type {NodeCompassPoint[]} */ ([]);
/**
 * THE COMPASS'S NODE POINTS: the gathering host's marks (`{ profession, at, d, reach }`, nearest first) and a Tracker's
 * living animals (`[x, z]` scene XZ, PROF7 - in Hunting's colour), as NodeCompassPoints - the nearest LAST, so each
 * skin draws it over the rest. Null with nothing to mark.
 * @param {ReadonlyArray<{ profession: string, at: number[], d: number, reach: number }>|null|undefined} marks
 * @param {ReadonlyArray<number[]>|null|undefined} [animals]
 * @returns {NodeCompassPoint[]|null}
 */
export function nodeCompassPoints(marks, animals = null) {
  _points.length = 0;
  let used = 0;
  const put = (x, z, mark, a) => {
    const p = _pool[used] ??= { xz: [0, 0], mark: '', a: 1 };
    used++;
    p.xz[0] = x; p.xz[1] = z; p.mark = mark; p.a = a;
    _points.push(p);
  };
  for (const v of animals ?? []) put(v[0], v[1], 'hunting', 1);
  if (marks) for (let i = marks.length - 1; i >= 0; i--) { const m = marks[i]; put(m.at[0], m.at[2], m.profession, nodeMarkAlpha(m.d, m.reach)); }
  return _points.length ? _points : null;
}

/** REST3: the fires' points, refilled as the nodes' are. */
const _fires = /** @type {NodeCompassPoint[]} */ ([]);
const _firePool = /** @type {NodeCompassPoint[]} */ ([]);
/**
 * THE DUNGEON'S CAMPFIRES ON THE STRIP (REST3; bible/06-Systems/Rest-Arc.md 4.4): every placed fire within
 * FIRE_MARK_REACH of `feet` as a 'fire' point, the nearer brighter, ahead of `points` (the nodes stay last, drawn over
 * them). `fires` are [x, y, z] in the scene's frame. `points` itself when no fire is in reach. Pure but for its pool.
 * @param {NodeCompassPoint[]|null} points
 * @param {ReadonlyArray<number[]>|null|undefined} fires
 * @param {number[]|null|undefined} feet
 * @returns {NodeCompassPoint[]|null}
 */
export function withFireMarks(points, fires, feet, reach = FIRE_MARK_REACH) {
  if (!fires?.length || !feet) return points;
  _fires.length = 0;
  let used = 0;
  for (const f of fires) {
    const d = Math.hypot(f[0] - feet[0], f[2] - feet[2]);
    if (!(d <= reach)) continue;
    const p = _firePool[used] ??= { xz: [0, 0], mark: 'fire', a: 1 };
    used++;
    p.xz[0] = f[0]; p.xz[1] = f[2]; p.mark = 'fire'; p.a = nodeMarkAlpha(d, reach);
    _fires.push(p);
  }
  if (!_fires.length) return points;
  if (points) for (const p of points) _fires.push(p);
  return _fires;
}
