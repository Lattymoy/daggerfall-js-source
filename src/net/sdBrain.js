// @ts-check
// SD5 (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 7): THE SHATTERED HOUR'S FRAME
// - where its stages stand, the one place both the client's made level (world/sdRealm.js) and the relay's judgements
// (the Orrery's reach, SD6; the Brass Remnant's arena, SD8) read them; and the Orrery's law (SD6a, below) - its stones,
// gearing, riddles and turns, drawn from the slot alike on the relay and every client. Pure, no imports: the relay's
// bundle may take it whole.
//
// Metres, the dungeon's own frame: the realm's one made block at the grid's origin, the Threshold's centre at its middle
// (SD_REALM_ORIGIN), every floor's top at y 0, the stages laid along +z:
//
//   | stage                  | where (the realm's frame)   | what                                                    |
//   | THE THRESHOLD          | a disc at z 0, radius 8     | the landing; the way back through the Rift at its back  |
//   | the walk               | z 7 to 25, 4 m wide         | from the Threshold to the Orrery                        |
//   | THE ORRERY OF ENDINGS  | a disc at z 42, radius 18   | the puzzle hall (SD6) - z 24 to 60                      |
//   | THE UNMOORED STEPS     | z 60 to 190                 | the platforming course (SD7) - the void until then      |
//   | THE LAST MOMENT        | a disc at z 220, radius 26  | the boss's arena, four brass pillars (SD8) - z 194-246  |
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).

/** The Threshold's centre in the dungeon's frame: the made block's middle (RDB_SIDE / 2 either way), the floor at y 0. */
export const SD_REALM_ORIGIN = Object.freeze([25.6, 0, 25.6]);
/** The stages, in the realm's frame (x, z from SD_REALM_ORIGIN). */
export const SD_THRESHOLD = Object.freeze({ x: 0, z: 0, r: 8 });
export const SD_WALK = Object.freeze({ x: 0, z0: 7, z1: 25, halfW: 2 });
export const SD_ORRERY = Object.freeze({ x: 0, z: 42, r: 18 });
export const SD_STEPS = Object.freeze({ z0: 60, z1: 190 });
export const SD_ARENA = Object.freeze({ x: 0, z: 220, r: 26 });
/** The arena's four brass pillars: on its diagonals, this far from its centre, this thick and this tall. */
export const SD_PILLAR_R = 16;
export const SD_PILLAR_W = 1.6;
export const SD_PILLAR_H = 14;

/** A point in the realm's frame, in the dungeon's. */
export const realmToDungeon = (x, y, z) => [SD_REALM_ORIGIN[0] + x, SD_REALM_ORIGIN[1] + y, SD_REALM_ORIGIN[2] + z];
/** A point in the dungeon's frame, in the realm's. */
export const dungeonToRealm = (x, y, z) => [x - SD_REALM_ORIGIN[0], y - SD_REALM_ORIGIN[1], z - SD_REALM_ORIGIN[2]];

// ───────────────────────────── SD6a: THE ORRERY OF ENDINGS (section 8) ─────────────────────────────
// Six Ending-stones on a ring in the hall, each showing an hour of twelve (0 is the twelfth). Turning one turns it one
// hour, forward or back, and its PARTNERS with it - the gearing, hidden, learned by turning. The Concord is every stone at
// its true hour; six plaques on the rim say the true hours in riddles; the dial lights how many stand true, not which;
// every turn frays the Hour, and at SD_FRAY_MAX it snaps back, the stones to where they began, the hall lashed.
//
// THE GEARING is one unit-triangular matrix in a hidden order (`M = P U P^T`): its determinant is 1, so EVERY set of
// hours is reachable; each stone turns itself exactly one hour; the stone at a place in the order turns only stones
// before it. A hall learns it by turning each stone once: the stone no other turn moves is set first, then the next,
// and the stone that turns alone last. THE RIDDLES come first and fix the truth: two stones said plainly, then each
// later stone tied to one known before it by a bijection of the hours (an offset, opposite, a mirror through twelve),
// so every clue is true by its making and the true hours are their one solution (pinned by brute force over all 12^6
// configurations). THE START is drawn until the way from it to the truth (`t = M^-1 (T - P0)`, one way mod twelve) is
// SD_TRUTH_TURNS_MIN to SD_TRUTH_TURNS_MAX turns at its shortest - room under the fray to learn the gearing and err.
// Everything is drawn from the slot, so no Hollow's answer is another's, and the relay and every client draw the same.

/** The stones, in the order the wire counts them. */
export const SD_STONES = Object.freeze([
  Object.freeze({ key: 'daggerfall', name: 'Daggerfall', sign: 'the lion' }),
  Object.freeze({ key: 'sentinel', name: 'Sentinel', sign: 'the sun' }),
  Object.freeze({ key: 'wayrest', name: 'Wayrest', sign: 'the ship' }),
  Object.freeze({ key: 'orsinium', name: 'Orsinium', sign: 'the tusk' }),
  Object.freeze({ key: 'underking', name: 'the Underking', sign: 'the crown of bone' }),
  Object.freeze({ key: 'blades', name: 'the Blades', sign: 'the dragon' }),
]);
export const SD_HOURS = 12;
/** The stones' ring in the hall (radius, metres from its centre), each at its own bearing from +z - none on the walk in
 *  (-z) or the way on (+z). */
export const SD_STONE_RING_R = 11;
export const SD_STONE_BEARINGS = Object.freeze([30, 90, 150, 210, 270, 330].map((d) => (d * Math.PI) / 180));
/** Where each stone stands, in the realm's frame. */
export const SD_STONE_POS = Object.freeze(SD_STONE_BEARINGS.map((b) => Object.freeze({ x: SD_ORRERY.x + SD_STONE_RING_R * Math.sin(b), z: SD_ORRERY.z + SD_STONE_RING_R * Math.cos(b) })));
/** A player within this of a stone (metres, on the floor) turns it; the relay allows a pose's lag over it. */
export const SD_STONE_REACH = 3;
export const SD_STONE_REACH_SLACK = 1;
/** The fray: every turn frays the Hour, and at this many it snaps back - and lashes everyone in the hall this share of
 *  their health, no save. */
export const SD_FRAY_MAX = 48;
export const SD_FRAY_LASH = 0.25;
/** One turn a stone in this long (the gear settling), and at most this many turns a second from an account. */
export const SD_STONE_SETTLE_MS = 700;
export const SD_TURN_HZ = 3;
/** The true hours' shortest way from the start, turns. */
export const SD_TRUTH_TURNS_MIN = 12;
export const SD_TRUTH_TURNS_MAX = 24;

/** An hour, 0 to 11. */
export const sdHour = (h) => ((h % SD_HOURS) + SD_HOURS) % SD_HOURS;
/** The hour a stone shows: 1 to 12. */
export const sdHourShown = (h) => sdHour(h) || SD_HOURS;
/** The fewest turns that move a stone `t` hours (forward or back). */
export const sdTurnsFor = (t) => Math.min(sdHour(t), SD_HOURS - sdHour(t));

/** The slot's own seed for a draw (a slot is public; the draw is the law's, the same everywhere). */
function sdSeed(s, salt) {
  let h = (Math.imul(s >>> 0, 0x9e3779b1) ^ salt) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
/** mulberry32 - the port's seeded die, kept here so the relay's bundle takes this file whole. */
function sdRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sdPick = (r, n) => Math.floor(r() * n);
const sdShuffle = (r, xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = sdPick(r, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const SD_ORRERY_SALT = 0x0e4ae7;
const SD_HOUR_WORDS = Object.freeze(['twelfth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh']);
const SD_COUNT_WORDS = Object.freeze(['', 'one', 'two', 'three', 'four', 'five']);
const sdCap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** A riddle's words. Kinds: `plain` (a keeps hour h), `offset` (a keeps b's hour and k more - k -5 to 5), `opposite`
 *  (a stands six hours from b), `mirror` (a read from twelve backwards is b). */
export function sdRiddleText(c) {
  const A = SD_STONES[c.a].name, B = c.b != null ? SD_STONES[c.b].name : '';
  if (c.kind === 'plain') return `${sdCap(A)} keeps the ${SD_HOUR_WORDS[sdHour(c.h)]} hour.`;
  if (c.kind === 'opposite') return `${sdCap(A)} stands opposite ${B}.`;
  if (c.kind === 'mirror') return `Read ${A} from twelve backwards and you read ${B}.`;
  if (c.k === 0) return `${sdCap(A)} keeps the hour ${B} keeps.`;
  return `${sdCap(A)} keeps the hour ${B} keeps, and ${SD_COUNT_WORDS[Math.abs(c.k)]} ${c.k > 0 ? 'more' : 'fewer'}.`;
}
/** Whether a set of hours answers a riddle. */
export function sdRiddleHolds(c, hours) {
  const a = sdHour(hours[c.a]), b = c.b != null ? sdHour(hours[c.b]) : 0;
  if (c.kind === 'plain') return a === sdHour(c.h);
  if (c.kind === 'opposite') return a === sdHour(b + 6);
  if (c.kind === 'mirror') return sdHour(a + b) === 0;
  return a === sdHour(b + c.k);
}

const orreryCache = new Map();
/** The turns that take the hours `st` to `truth` under a gearing - each stone's 0 to 11 forward - back-substituted in its
 *  hidden order (the stone no other turn moves first). */
function solveGear(order, gear, st, truth) {
  const t = Array(order.length).fill(0);
  for (let p = order.length - 1; p >= 0; p--) {
    const j = order[p];
    let have = st[j];
    for (let q = p + 1; q < order.length; q++) have += t[order[q]] * gear[order[q]][j];
    t[j] = sdHour(truth[j] - have);
  }
  return t;
}
const sdWayTurns = (way) => way.reduce((m, t) => m + sdTurnsFor(t), 0);
/**
 * THE ORRERY OF A SLOT - the same for the relay and every client: `{ s, order, gear, start, way, truth, riddles }`.
 * `gear[i][j]` is how many hours turning stone i forward turns stone j (`gear[i][i]` 1); `order` the hidden order (a
 * stone's turn moves only stones before it); `truth` the true hours, which the riddles fix and only they; `start` the
 * hours the stones begin at (and snap back to); `way` the turns from the start to the truth, each stone's 0 to 11
 * forward; `riddles` the six plaques' clues in the plaques' order, each `{ kind, a, b?, h?, k?, text }`. Null for a slot
 * the law does not know.
 */
export function orreryOf(s) {
  if (!Number.isSafeInteger(s) || s < 1) return null;
  const had = orreryCache.get(s);
  if (had) return had;
  const r = sdRng(sdSeed(s, SD_ORRERY_SALT));
  const n = SD_STONES.length;
  // THE GEARING: a hidden order; each stone after the first turns one or two stones before it, one or two hours either way
  const order = sdShuffle(r, [...Array(n).keys()]);
  /** @type {number[][]} */
  const gear = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let p = 1; p < n; p++) {
    const partners = sdShuffle(r, order.slice(0, p)).slice(0, p === 1 ? 1 : 1 + sdPick(r, 2));
    for (const j of partners) gear[order[p]][j] = [-2, -1, 1, 2][sdPick(r, 4)];
  }
  // THE RIDDLES, and the truth they fix: two stones plainly, then each later stone tied to one known before it by a
  // bijection of the hours - so each clue is true by its making, and together they fix every hour, one way
  const chain = sdShuffle(r, [...Array(n).keys()]);
  const truth = Array(n).fill(0);
  const clues = [];
  for (let q = 0; q < n; q++) {
    const a = chain[q];
    if (q < 2) { truth[a] = sdPick(r, SD_HOURS); clues.push({ kind: 'plain', a, h: truth[a] }); continue; }
    const b = chain[sdPick(r, q)], roll = r();
    if (roll < 0.2) { truth[a] = sdHour(truth[b] + 6); clues.push({ kind: 'opposite', a, b }); }
    else if (roll < 0.5) { truth[a] = sdHour(-truth[b]); clues.push(r() < 0.5 ? { kind: 'mirror', a, b } : { kind: 'mirror', a: b, b: a }); }
    else { const k = sdPick(r, 11) - 5; truth[a] = sdHour(truth[b] + k); clues.push({ kind: 'offset', a, b, k }); }
  }
  // THE START: drawn until the way from it to the truth is SD_TRUTH_TURNS_MIN to SD_TRUTH_TURNS_MAX turns at its shortest
  let start, way;
  do { start = Array.from({ length: n }, () => sdPick(r, SD_HOURS)); way = solveGear(order, gear, start, truth); }
  while (sdWayTurns(way) < SD_TRUTH_TURNS_MIN || sdWayTurns(way) > SD_TRUTH_TURNS_MAX);
  const riddles = sdShuffle(r, clues).map((c) => Object.freeze({ ...c, text: sdRiddleText(c) }));
  const o = Object.freeze({ s, order: Object.freeze(order), gear: Object.freeze(gear.map((g) => Object.freeze(g))), start: Object.freeze(start), way: Object.freeze(way), truth: Object.freeze(truth), riddles: Object.freeze(riddles) });
  if (orreryCache.size >= 64) orreryCache.delete(orreryCache.keys().next().value);
  orreryCache.set(s, o);
  return o;
}

/** The stones after turning stone `i` one hour (`a` 1 forward, -1 back). */
export const orreryTurn = (o, st, i, a) => st.map((h, j) => sdHour(h + a * o.gear[i][j]));
/** How many stones stand at their true hours (what the dial lights - how many, not which). */
export const orreryLit = (o, st) => st.reduce((m, h, j) => m + (sdHour(h) === o.truth[j] ? 1 : 0), 0);
/** The Concord: every stone at its true hour. */
export const orreryConcord = (o, st) => orreryLit(o, st) === SD_STONES.length;
/** The turns that take `st` to the truth, each stone's 0 to 11 forward - the one way, mod twelve, there is. */
export const orrerySolve = (o, st) => solveGear(o.order, o.gear, st, o.truth);
/** The fewest turns from `st` to the Concord. */
export const orreryShortest = (o, st) => sdWayTurns(orrerySolve(o, st));
/** A hall's state fresh: the stones at the start, no fray, no Concord. */
export const orreryFresh = (o) => ({ st: [...o.start], f: 0, ok: false });
/**
 * ONE TURN JUDGED - the relay's: the stones after it, the fray, how many stand true, the Concord, and whether the Hour
 * snapped back (`x`: the stones to the start, the fray to nothing, the hall lashed). Null once the Concord holds.
 */
export function orreryStep(o, state, i, a) {
  if (state.ok) return null;
  let st = orreryTurn(o, state.st, i, a), f = state.f + 1, x = false;
  const ok = orreryConcord(o, st);
  if (!ok && f >= SD_FRAY_MAX) { st = [...o.start]; f = 0; x = true; }
  return { st, f, ok, x, lit: orreryLit(o, st) };
}
/** Whether a pose (the realm's frame) reaches stone `i` - the relay allowing `slack` for a pose's lag. A pose that is no
 *  number reaches nothing (NaN compares false). */
export const stoneInReach = (i, x, z, slack = 0) => Math.hypot(x - SD_STONE_POS[i].x, z - SD_STONE_POS[i].z) <= SD_STONE_REACH + slack;
/** Whether a pose (the realm's frame) stands in the Orrery's hall - where the snap's lash reaches. */
export const inOrreryHall = (x, z) => Math.hypot(x - SD_ORRERY.x, z - SD_ORRERY.z) <= SD_ORRERY.r;
