// @ts-check
// ECHO1 (the delve arc, 2026-10-05 - the player, on the dungeon blocks: "no logical interaction moments"): THE CHAIN'S
// ECHO, and its examine.
//
// A Daggerfall lever works something rooms away and says nothing about it: the chain (DaggerfallAction.Play's
// ActivateNext, world/actionSystem.js _play) moves a wall, a floor, a door the player cannot see, and the press reads as
// a lever that did nothing. The action system knows exactly what it set going - the objects its cascade reached
// (`onPlayed`, the ActionObject plays) - so:
//   - THE ECHO: when a press (a click, a plate stood on, a blow) sets a mover going OUT OF SIGHT and farther than
//     ECHO_NEAR_M, one popup line says what and which way ("Stone grinds somewhere below you, to the west."); the place
//     goes on the dungeon map as an echo mark (ui/automapSheet.js, kind 'echo') until it is found; and FOUND - in plain
//     sight within ECHO_FIND_M - it glows for a few seconds in the secrets' colour (systems/dungeonSense.js), so what
//     changed is seen when it is reached.
//   - THE EXAMINE: in Info mode - Daggerfall's examining stance - the plaque over a lever or a wheel adds the way its
//     work lies ("Works something to the north-east"), read off the same chain without playing it. Never when the
//     World Tooltips author's HideDefaultInteractTooltip asks for the puzzles to be kept.
// Not a DFU member. Pure but for the book's own list.

/** A mover set going nearer than this to the eye needs no word: the player heard it beside them (m). */
export const ECHO_NEAR_M = 3;
/** How far above or below the eye a place must be to be "above you" / "below you" (m) - a storey's worth. */
export const ECHO_VERT_M = 2.5;
/** Under this much level distance a place has no compass way of its own (m): it is straight above or below. */
export const ECHO_FLAT_M = 1.5;
/** An echo is FOUND when its mover stands in plain sight this near (m). */
export const ECHO_FIND_M = 12;
/** How many unfound echoes the map holds (the oldest goes first). */
export const ECHO_MAP_MAX = 8;
/** How often the book looks for its echoes being found (s). */
export const ECHO_LOOK_S = 0.25;
/** The longest chain the walk follows - the action system's own IsPlaying depth (world/actionSystem.js _isPlaying). */
export const ECHO_CHAIN_MAX = 32;
/** The prefs key (the `dungeon-echoes` Features row). */
export const ECHO_PREF = 'dungeonEchoes';

/** The eight ways, clockwise from north, in scene XZ (+x east, +z north - ui/hud.js compassMarkerLerp's frame). */
export const ECHO_WAYS = Object.freeze(['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']);

/** The compass way from one place to another across the level (+x east, +z north). Pure. */
export const echoWay = (dx, dz) => ECHO_WAYS[((Math.round(Math.atan2(dx, dz) * 180 / Math.PI / 45) % 8) + 8) % 8];

/**
 * Which way a place lies, said: "to the north-east", "above you", "below you, to the west", or "close by" when it is
 * none of those (under ECHO_FLAT_M across and within ECHO_VERT_M up or down). `dx, dy, dz` from the eye. Pure.
 */
export function wayWord(dx, dy, dz) {
  const up = dy > ECHO_VERT_M ? 'above you' : dy < -ECHO_VERT_M ? 'below you' : '';
  const way = Math.hypot(dx, dz) >= ECHO_FLAT_M ? `to the ${echoWay(dx, dz)}` : '';
  if (up && way) return `${up}, ${way}`;
  return up || way || 'close by';
}

/** What moves when a chain plays: a placed model's tween, an acting flat, a door (its swing or its record's move). */
export const isEchoMover = (o) => !!o && (o.kind === 'action' || o.kind === 'moveFlat' || o.kind === 'door');

/** What the mover is heard as. Pure. */
export function echoVerb(o) {
  if (o?.kind === 'door') return 'A door swings';
  if (o?.kind === 'moveFlat') return 'Something shifts';
  return 'Stone grinds';
}

/** The echo's line: what was heard and which way from the eye (`from`) to the mover's middle (`at`). Pure. */
export function echoLine(o, from, at) {
  const where = wayWord(at[0] - from[0], at[1] - from[1], at[2] - from[2]);
  return `${echoVerb(o)} somewhere ${where}.`;
}

/**
 * THE CHAIN'S MOVERS, walked without playing it: from `o` along `next` (the action system's `nextOf` - DFU's
 * ActivateNext link), each mover it reaches, in chain order, `o` itself excluded, a loop or ECHO_CHAIN_MAX steps ending
 * it. Pure but for what `next` reads.
 * @param {(o: any) => any} next @param {any} o
 */
export function chainMovers(next, o, max = ECHO_CHAIN_MAX) {
  const out = [];
  if (!o || typeof next !== 'function') return out;
  const seen = new Set([o]);
  let n = next(o);
  for (let i = 0; n && i < max && !seen.has(n); i++) {
    seen.add(n);
    if (isEchoMover(n)) out.push(n);
    n = next(n);
  }
  return out;
}

/** A box's middle. Pure. */
export const boxMiddle = (box) => [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];

/**
 * THE EXAMINE'S LINE for the object `o`: the way from it to the first mover its chain reaches ("Works something to the
 * north-east", "Works something close by"), or null when the chain moves nothing (or has no box to say it of).
 * `boxOf` is activate.js objectAabb - the box the press races. Pure but for what the readers read.
 * @param {any} o @param {(o: any) => any} next @param {(o: any) => any} boxOf
 */
export function examineLine(o, next, boxOf) {
  const from = o && boxOf(o);
  if (!from) return null;
  for (const m of chainMovers(next, o)) {
    const box = boxOf(m);
    if (!box) continue;
    const a = boxMiddle(from), b = boxMiddle(box);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    return d <= ECHO_NEAR_M ? 'Works something close by' : `Works something ${wayWord(b[0] - a[0], b[1] - a[1], b[2] - a[2])}`;
  }
  return null;
}

/**
 * THE ECHO BOOK: the movers heard and not yet found, by key, at most `max` (the oldest leaves first; one heard again
 * is moved to where it was heard last). `points()` is what the map draws ([x, y, z] each); `take(found)` removes and
 * answers every entry `found(entry)` says is found.
 */
export function createEchoBook({ max = ECHO_MAP_MAX } = {}) {
  /** @type {Array<{ key: string, at: number[] }>} */
  let list = [];
  return {
    /** @param {string} key @param {number[]} at */
    add(key, at) {
      list = list.filter((e) => e.key !== key);
      list.push({ key, at: [at[0], at[1], at[2]] });
      if (list.length > max) list = list.slice(list.length - max);
      return list.length;
    },
    has: (key) => list.some((e) => e.key === key),
    /** @param {(e: { key: string, at: number[] }) => boolean} found */
    take(found) {
      const out = [], keep = [];
      for (const e of list) (found(e) ? out : keep).push(e);
      list = keep;
      return out;
    },
    points: () => list.map((e) => e.at),
    get size() { return list.length; },
    clear() { list = []; },
  };
}
