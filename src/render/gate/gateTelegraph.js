// @ts-check
// WB4 (2026-09-25, Mac: "an oversized enemy with telegraphed attacks (like wind ups, etc)"): THE TELEGRAPH - every
// attack's shape drawn on the court's floor where it will land. Design: bible/11-Multiplayer/World-Bosses.md section 5
// ("On the ground: every shape is drawn where it will land - a dim outline at once, filling toward the edge as the
// wind-up runs, bright at the landing").
//
// ONE QUAD over the floor's disc, a hair above it, and the shape is the FRAGMENT'S question: its point in the court's
// frame against the attack the uniforms describe - the same law net/gate/gateStrike.js inAttack answers for a struck
// player's feet (a cone about his facing that always holds his body, a disc about him or under each target, the lane
// his charge runs, the ring of the nova, the whole floor), so the ground shows exactly what lands. `telegraphField` is
// the shader's own reading in JS - the pins hold it to inAttack point for point, and the shader's text to it.
//
// The duel wall's law (render/duelWall.js): fixed geometry and uniforms, no depth written, tested against the depth the
// court wrote (a body standing on it hides it), fogged as the ground is. A polygon offset keeps it off the floor it
// lies on.
//
// WB13a (2026-10-01, Mac: "hone in telegraphs"): THE TELEGRAPH, HONED - read in Chromium at a fighter's eye and from
// above, at every moment of every wind-up (bible/11-Multiplayer/World-Bosses.md section 20):
//   - ONE LINE, whole from the first frame and the brightest thing in the shape, in ONE DANGER EDGE (Dagon's crimson for
//     his own blows); the element lives in the fill and its grain. Its width from the edge's own screen derivative, a
//     dark keyline outside it. No fuse burning it down, no false edge inside it.
//   - THE FILL eases in behind the line and reaches the far edge as it lands - the Nova's and the Spokes' at the floor's
//     rim when they reach past it. The last moments brighten the line alone; the landing is white-hot, then a scorch.
//   - The Nova's safe heart has a cool edge. Burning ground is terrain, darker, its rim broken; a path or a tether is
//     dashes flowing to him. Nothing flashes faster than three times a second.
//   - Premultiplied: the light ADDED, the floor under a fill DARKENED (ONE, ONE_MINUS_SRC_ALPHA). A quad per shape.
//
// FIELD BUGS 2026-10-13e AOE-PERF (HellRay: "massive FPS drops when the boss performs AoE attacks and circles appear"): a
// quad is laid over the ground its shape can draw on, and no more. A blow's reaches TELEGRAPH_REACH past it - its glow,
// keyline and wave reach as far as the pixel is large - but his mark (telegraphMarkReach) and a path or a tether
// (telegraphStrip) draw nothing past their own ground at any pixel's size, and theirs are that ground: an AoE frame at a
// fighter's eye rasterised 3.4 screens of this pass, 2.1 now (tools/fb1013ePerfProbe.mjs). The fragment stage is the one
// it was, byte for byte (bible/07-Rendering/Performance-Rig.md AOE-PERF).
//
// Not a DFU member. Ledger A (WB).
import { FOG_FACTOR_GLSL } from '../labGrass.js';
import { buildProgram } from '../glProgram.js';
import { ATTACK_BY_ID, ATTACKS, BOSS_R, COURT_CENTRE, COURT_R, COURTS, BASE_PROFILE, windupOf, nearestCourt, isDagons, WALKS, WALK_HALF_W, PLAN_PLAIN, CHAIN_HOLD_M } from '../../net/gate/gateBrain.js';
import { telegraphAt, wheelAngle } from '../../net/gate/gateStrike.js';
import { attackColor } from '../../world/gate/gateBoss.js';

/** The shapes, as the shader's `uKind` says them. WBX5: the Spokes of Dagon's lanes; WBX4: his mark. */
export const TELEGRAPH_KIND = Object.freeze({ cone: 0, disc: 1, discs: 2, lane: 3, ring: 4, all: 5, spokes: 6, mark: 7, wedges: 8 });   // WB14a: the Unmaking's wedges
/** The most lanes one spokes lays (the shader's loop bound). */
export const TELEGRAPH_SPOKES_MAX = 8;
/** WBX4 (2026-09-26, Swololo on Discord: "its hard to see where boss is and where he is facing, maybe he should have a
 *  circle under him"): HIS MARK on the floor, always - a ring about his feet a little wider than his body, and a chevron
 *  before it pointing where he faces: its ring's radius, the chevron's length and its half-width at the ring. */
export const BOSS_MARK_R = BOSS_R + 0.35;
export const BOSS_MARK_CHEVRON_LEN = 1.6;
export const BOSS_MARK_CHEVRON_HALF_W = 0.85;
/** The most discs one attack lays (Hellfire's two volleys of five in phase three - net/gate/gateBrain.js). */
export const TELEGRAPH_POINTS_MAX = 10;
/** How far over the floor it lies, metres; how far past the floor's rim a whole court's quad reaches, and (WB13a) how far
 *  past its own shape a shape's quad reaches - its glow, its keyline and its shockwave. */
export const TELEGRAPH_LIFT = 0.05;
export const TELEGRAPH_MARGIN = 0.5;
export const TELEGRAPH_REACH = 4;
/** FIELD BUGS 2026-10-13e AOE-PERF: how far past its ring his mark's ring is drawn (its smoothstep's outer edge - the
 *  shader reads it from here), and how far past the ground a shape draws its quad is laid where that ground is all it
 *  draws (his mark; a path or a tether) - a hair, for the rounding of the quad's corners. */
export const TELEGRAPH_MARK_RING = 0.2;
export const TELEGRAPH_TIGHT_PAD = 0.05;
/** AUDIT EG V (L6-2; Elite-Gates.md section 25.4): how far past its radius a Vestige aura's ring (TELEGRAPH_POOL_SPIRE.ring)
 *  draws - its line's two pixels are cut there at any pixel's size (whole within ~18 m at a grazing look on a 1080p screen;
 *  past that the ring is a few pixels across) - and how far across its line a pull-apart tether's break tick reaches past
 *  twice its half-width (the Spire's stage's own `2.0 * uHalfW + 0.1`). Each quad is laid over that ground and no more. */
export const TELEGRAPH_RING_REACH = 0.5;
export const TELEGRAPH_TICK_REACH = 0.1;
/** Burning ground comes up over this long as it lands; a landing's afterglow dies over this long after its span. */
export const TELEGRAPH_FADE_IN_MS = 150;
export const TELEGRAPH_FLASH_MS = 350;
/** WB13a: a shape's line stands whole from the word, popping (decaying over TELEGRAPH_POP_MS); its inside comes up over
 *  TELEGRAPH_FILL_IN_MS; the landing's white heat decays over TELEGRAPH_FLASH_TAU_MS into a scorch. */
export const TELEGRAPH_POP_MS = 70;
export const TELEGRAPH_FILL_IN_MS = 120;
export const TELEGRAPH_FLASH_TAU_MS = 90;
/** WB13a: THE DANGER EDGE - every pending shape's line, his and his host's, whatever it carries (an element's blue or green
 *  on the red floor read as safe), and Dagon's own crimson for the Wrath and the Reckoning; the Nova's safe heart's edge
 *  is cool. */
export const TELEGRAPH_EDGE = Object.freeze([1.0, 0.36, 0.05]);
export const TELEGRAPH_EDGE_DAGON = Object.freeze([1.0, 0.24, 0.28]);
export const TELEGRAPH_EDGE_SAFE = Object.freeze([0.72, 0.95, 1.0]);
/** WB13a: what a shape is (`pool`): a blow still to land, burning ground, or a path or tether (dashes flowing to him). */
export const TELEGRAPH_POOL = Object.freeze({ blow: 0, ground: 1, path: 2 });
/** WB13a: the line is two pixels wherever it is seen - wider on a screen shorter than TELEGRAPH_LINE_H, up to this. */
export const TELEGRAPH_LINE_H = 540;
export const TELEGRAPH_LINE_W_MAX = 1.6;
export const telegraphLineW = (h) => Math.max(1, Math.min(TELEGRAPH_LINE_W_MAX, TELEGRAPH_LINE_H / Math.max(1, h || TELEGRAPH_LINE_H)));
/** WB13a: the throb on the line: 1.5 beats a second at the word, 3 at the landing - never past WCAG 2.3.1's three flashes a
 *  second (the phase is hz * uSince and uT grows with uSince, so the beat is 1.5 + 3 (hz - 1.5): hz = 1.5 + 0.5 uT^2). */
export const TELEGRAPH_THROB_MAX_HZ = 3;
/**
 * WB9e (2026-09-30, Mac: "further improve his telegraphs"): EACH SHAPE WEARS ITS ELEMENT - the fill's grain by what
 * lands (`uStyle`): his weight's cracks (the blade, the slam, the charge, the leaps), fire's flicker, frost's facets,
 * the storm's crackle, venom's bubbles, and Dagon's own for the Wrath and the Reckoning.
 */
export const TELEGRAPH_STYLE = Object.freeze({ weight: 0, fire: 1, frost: 2, shock: 3, poison: 4, dagon: 5 });
/** WB9e: the shockwave a landing throws out past its edge - its speed (metres a second) and how long it runs; WB13a: and
 *  how far it runs at most - half its shape's size, 1 to TELEGRAPH_WAVE_MAX_M (a Bite's swept five times its size). */
export const TELEGRAPH_WAVE_MPS = 22;
export const TELEGRAPH_WAVE_MS = 280;
export const TELEGRAPH_WAVE_MAX_M = 3.5;
/** WB9e: the last stretch of a wind-up - "now"; WB13a: it brightens and widens the line alone (it flooded the shape at the
 *  landing's own brightness, so the landing never read). */
export const TELEGRAPH_NOW_MS = 180;
/** An attack's grain under a profile: Dagon's own, else its element's (his weight's when it carries none). */
export const telegraphStyle = (A, P = BASE_PROFILE) => (isDagons(A) ? TELEGRAPH_STYLE.dagon : TELEGRAPH_STYLE[P.atk[A.key].el ?? 'weight'] ?? TELEGRAPH_STYLE.weight);
/** WB14a: THE NEW ARSENAL'S GROUND - a shape of the gate's own kinds for each but the Unmaking's (a kind of its own,
 *  TELEGRAPH_KIND.wedges): the Chains a path (TELEGRAPH_POOL.path - dashes flowing to him) from him to the chained,
 *  TELEGRAPH_CHAIN_HALF_W across, in his blow's colour while they stand inside its hold and the safe edge's past it; the
 *  Brand his element's rings and the Torment a gold one (TORMENT_COLOR - a ring to gather in, never one to leave), each
 *  where this screen sees its marked fighter; the Wheel the Spokes' lanes, turning; the Gaze none - it lands on a view,
 *  never on the ground. */
export const TELEGRAPH_CHAIN_HALF_W = 0.35;
export const TORMENT_COLOR = Object.freeze([1.0, 0.8, 0.28]);
export const TORMENT_EDGE = Object.freeze([1.0, 0.9, 0.5]);
/** WB14a: the shape each new attack's ground takes (TELEGRAPH_KIND by name - the gate's own shapes keep their own). */
const ARSENAL_KIND = Object.freeze({ tether: 'lane', brand: 'discs', torment: 'discs', wheel: 'spokes', wedges: 'wedges' });

/** WB13a: an attack's line - Dagon's crimson for his own, the danger edge for every other. */
export const telegraphEdge = (A) => (A && isDagons(A) ? TELEGRAPH_EDGE_DAGON : TELEGRAPH_EDGE);

const DEG = Math.PI / 180;

/**
 * What the pass draws for an attack at `now` - the uniforms, as plain numbers - or null when there is nothing (no
 * attack, or its landing's flash is over). `t` is the wind-up's share (the fill's reach), `flash` 1 from the landing
 * on, `alpha` its fade after its span (WB13a: none at the word - the line stands whole from the first frame, the shader
 * brings the inside up). WB8b: under the fight's profile `P` - the reach the attack has under his marks, his body his
 * own size, the colour his aspect gives it - so the ground still shows exactly what lands. WB13a: `edge` its line's
 * colour, `runS` the charge's run (its landing follows his head down the lane).
 * @param {{a: number, at: number, x: number, z: number, yw: number, tg: number[][]}|null} atk @param {number} phase @param {number} now
 * @param {ReturnType<typeof import('../../net/gate/gateBrain.js').fightProfile>} [P]
 */
export function telegraphShape(atk, phase, now, P = BASE_PROFILE, markAt = null) {
  /** @type {any} an attack of any shape - the fields its shape does not have read as none */
  const A = atk ? ATTACK_BY_ID[atk.a] : null;
  const tel = A ? telegraphAt(atk, phase, now) : null;
  if (!A || !tel || A.shape === 'gaze') return null;   // WB14a: the Gaze lands on a view, never on the ground
  const span = Math.max(A.active, 1);
  if (tel.since >= span + TELEGRAPH_FLASH_MS) return null;
  const start = atk.at - windupOf(A, phase);
  const fadeOut = tel.since > span ? 1 - (tel.since - span) / TELEGRAPH_FLASH_MS : 1;
  const kind = A.shape === 'disc' ? (A.aim === 'self' ? TELEGRAPH_KIND.disc : TELEGRAPH_KIND.discs) : TELEGRAPH_KIND[ARSENAL_KIND[A.shape] ?? A.shape];
  // WB14a: a marked fighter where this screen sees them now (`markAt(k)` - the court's: my feet, the online frame's place
  // of another), else where they stood at the word
  const placed = (k) => markAt?.(k) ?? atk.tg?.[k] ?? null;
  const tether = A.shape === 'tether', wheel = A.shape === 'wheel', wedges = A.shape === 'wedges';
  const end = (tether ? placed(0) : null) ?? atk.tg?.[0] ?? [atk.x, atk.z];
  // WBX5: a 'point' disc is one mark (the leap's landing, the meteor's fall); the spokes' lanes are `len` long
  const marks = A.aim === 'players' ? (atk.tg ?? []).slice(0, TELEGRAPH_POINTS_MAX).map((p, k) => placed(k) ?? p) : A.aim === 'point' ? (atk.tg ?? []).slice(0, 1) : [];
  // WB9b: the court it is drawn over - where it lands (the bound's landing is the next court's heart), else where he stood
  const at = A.aim === 'point' && marks.length ? marks[0] : A.aim === 'players' && marks.length ? marks[0] : [atk.x, atk.z];
  const held = tether && Math.hypot(end[0] - atk.x, end[1] - atk.z) <= CHAIN_HOLD_M;   // WB14a: the chain's colour says whether it holds
  const torment = A.shape === 'torment';
  return {
    kind, origin: wedges ? [at[0], at[1]] : [atk.x, atk.z], yaw: wheel ? wheelAngle(atk, now) : atk.yw,
    r: A.shape === 'spokes' || wheel ? A.len : P.atk[A.key].r ?? 0, halfArc: wedges ? Math.PI / A.n : ((A.arc ?? 0) / 2) * DEG, body: wedges ? 0 : P.bossR,
    end: [end[0], end[1]], halfW: tether ? TELEGRAPH_CHAIN_HALF_W : A.shape === 'lane' ? Math.max((A.width ?? 0) / 2, P.bossR) : (A.width ?? 0) / 2, r0: A.r0 ?? 0, r1: A.r1 ?? 0,   // AUDIT WBX F7: the charge strikes as wide as his body (net/gate/gateStrike.js chargeStrikes), and shows so
    points: marks.map((p) => [p[0], p[1]]), n: A.shape === 'spokes' || wheel ? Math.min(TELEGRAPH_SPOKES_MAX, A.n) : wedges ? A.n / 2 : 0,
    // WB14a: the Wheel's blades stand lit through their whole turn (its landing's flash at their end); the chain is a path
    t: tel.t, flash: tel.since >= 0 && !(wheel && tel.since < span) ? 1 : 0, alpha: Math.max(0, fadeOut),
    color: tether ? (held ? attackColor(A, P) : TELEGRAPH_EDGE_SAFE) : torment ? TORMENT_COLOR : attackColor(A, P), edge: torment ? TORMENT_EDGE : telegraphEdge(A),
    runS: A === ATTACKS.charge ? span / 1000 : 0, pool: tether ? TELEGRAPH_POOL.path : TELEGRAPH_POOL.blow,
    // WB9b: over which court (all three for the whole arena's - the Wrath's and the Reckoning's); WB9e: its grain, its own
    // clock (seconds since the word, the wind-up's length) and how long since it landed (the shockwave's)
    court: A.shape === 'all' ? -1 : nearestCourt(at[0], at[1]), style: telegraphStyle(A, P),
    since: Math.max(0, (now - start) / 1000), span: Math.max(0.001, windupOf(A, phase) / 1000), after: tel.since >= 0 && !(wheel && tel.since < span) ? (wheel ? tel.since - span : tel.since) / 1000 : -1,
  };
}

/** WBX4: HIS MARK as the pass draws it - where he stands (the court's frame), his facing, in `color` (the ward's gold while
 *  it stands, his ember otherwise), about a body of `body` metres (WB8b: his profile's - Colossal's is larger). Pure. */
export function markShape(at, yaw, color, body = BOSS_R) {
  return {
    kind: TELEGRAPH_KIND.mark, origin: [at[0], at[1]], yaw, r: body + (BOSS_MARK_R - BOSS_R), halfArc: 0, body, end: [at[0], at[1]],
    halfW: BOSS_MARK_CHEVRON_HALF_W, r0: 0, r1: BOSS_MARK_CHEVRON_LEN, points: [], n: 0, t: 1, flash: 0, alpha: 1, color, edge: TELEGRAPH_EDGE,
    court: 0, style: TELEGRAPH_STYLE.weight, since: 0, span: 1, after: -1, runS: 0, pool: TELEGRAPH_POOL.blow,   // WB9b: the court's driver sets `court` where he stands
  };
}

/** WBX5: THE BURNING GROUND as the pass draws it - live pools (net/gate/gateStrike.js landingPools) gathered by radius, each
 *  group one filled `discs` shape in `color`, coming up at its landing and dying down over its last second. WB13a: a
 *  full group (TELEGRAPH_POINTS_MAX) starts another - the newest pools were dropped, unseen and still biting (two
 *  phase-three Hellfires on five fighters). Pure. */
export function poolShapes(pools, now, color, style = TELEGRAPH_STYLE.fire) {
  const byR = new Map();
  const groups = [];
  for (const p of pools ?? []) {
    if (!(now >= p.from && now < p.until)) continue;
    const court = nearestCourt(p.x, p.z), key = `${court}:${p.r}`;   // WB9b: each court's pools on its own quad
    let g = byR.get(key);
    if (!g || g.pts.length >= TELEGRAPH_POINTS_MAX) { g = { r: p.r, court, pts: [], alpha: 0, from: p.from }; byR.set(key, g); groups.push(g); }
    g.pts.push([p.x, p.z]);
    g.alpha = Math.max(g.alpha, Math.min(1, (now - p.from) / TELEGRAPH_FADE_IN_MS, (p.until - now) / 1000));
    g.from = Math.min(g.from, p.from);
  }
  return groups.map((g) => ({
    kind: TELEGRAPH_KIND.discs, origin: [0, 0], yaw: 0, r: g.r, halfArc: 0, body: BOSS_R, end: [0, 0], halfW: 0, r0: 0, r1: 0,
    points: g.pts, n: 0, t: 1, flash: 0, alpha: g.alpha, color, edge: TELEGRAPH_EDGE,
    court: g.court, style, since: Math.max(0, (now - g.from) / 1000), span: 1, after: -1, runS: 0, pool: TELEGRAPH_POOL.ground,   // WB9d: burning ground - its own seething, never a wind-up's
  }));
}

/**
 * WB13a: THE GROUND A SHAPE'S QUAD COVERS - its bounds in the court's frame, [x0, z0, x1, z1], TELEGRAPH_REACH past the
 * shape (its glow, its keyline, its shockwave), or null for a shape over its whole court (the Nova's ring, the Spokes,
 * the whole floor's). Every pass drew the whole 49 m court: a Legion-Lord's frame on a phone shaded 1.65M fragments,
 * most of them to discard. AUDIT EG V (L6-4): into `out` when given (the Spire's floor plan keeps one), else a new array.
 * Pure but for `out`.
 * @param {any} sh @param {number[]|null} [out]
 * @returns {number[]|null}
 */
export function telegraphBounds(sh, out = null) {
  const M = TELEGRAPH_REACH;
  const b = out ?? [0, 0, 0, 0];
  switch (sh?.kind) {
    case TELEGRAPH_KIND.cone: case TELEGRAPH_KIND.disc: return boxInto(b, sh.origin[0], sh.origin[1], sh.origin[0], sh.origin[1], sh.r + (sh.kind === TELEGRAPH_KIND.disc && sh.pool === TELEGRAPH_POOL_SPIRE.ring ? TELEGRAPH_RING_REACH : M));   // AUDIT EG V (L6-2): a Vestige aura's ring draws no glow
    case TELEGRAPH_KIND.mark: return boxInto(b, sh.origin[0], sh.origin[1], sh.origin[0], sh.origin[1], telegraphMarkReach(sh));   // AOE-PERF: his mark draws no glow
    case TELEGRAPH_KIND.lane: return boxInto(b, Math.min(sh.origin[0], sh.end[0]), Math.min(sh.origin[1], sh.end[1]), Math.max(sh.origin[0], sh.end[0]), Math.max(sh.origin[1], sh.end[1]), stripW(sh) || sh.halfW + M);   // AUDIT EG V (L6-2): a path's or a tether's no wider than its strip
    case TELEGRAPH_KIND.discs: {
      if (!sh.points?.length) return null;
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const p of sh.points) { x0 = Math.min(x0, p[0]); z0 = Math.min(z0, p[1]); x1 = Math.max(x1, p[0]); z1 = Math.max(z1, p[1]); }
      return boxInto(b, x0, z0, x1, z1, sh.r + M);
    }
    default: return null;
  }
}

/** AUDIT EG V (L6-4): box `b` set to [x0, z0, x1, z1] `pad` out. */
function boxInto(b, x0, z0, x1, z1, pad) { b[0] = x0 - pad; b[1] = z0 - pad; b[2] = x1 + pad; b[3] = z1 + pad; return b; }

/**
 * FIELD BUGS 2026-10-13e AOE-PERF: HOW FAR FROM WHERE HE STANDS HIS MARK CAN DRAW ANYTHING - its pass draws its ring
 * (TELEGRAPH_MARK_RING about it), the floor inside it and the chevron before it (its base `halfW` either side at the ring,
 * its tip `r1` past it), and discards every fragment else whatever the pixel's size: no glow, no keyline, no wave. Its
 * quad was TELEGRAPH_REACH past the chevron's tip - three times the ground, a third of a fighter's screen, every frame
 * of the fight. Pure.
 */
export const telegraphMarkReach = (sh) => Math.max(sh.r + TELEGRAPH_MARK_RING, Math.hypot(sh.r, sh.halfW), sh.r + sh.r1) + TELEGRAPH_TIGHT_PAD;

/**
 * FIELD BUGS 2026-10-13e AOE-PERF: A PATH'S OR A TETHER'S OWN STRIP - { a, u, len, w }: its start (TELEGRAPH_TIGHT_PAD
 * past the capsule's end), its direction, its length and its half-width - or null for any other shape. A path's pass
 * (TELEGRAPH_POOL.path) writes its colour inside the lane alone (`fin`, the dashes flowing to him) and nothing past it at
 * any pixel's size - no line, no glow - so its quad is the strip, laid along it; it was the box about its whole run,
 * TELEGRAPH_REACH past it, and a Sapper walking in from the rim made that a fifth of the screen. AUDIT EG V (L6-2): the
 * Spire's two tethers are strips too (Elite-Gates.md section 25.5 - the Spire's stage, EG-ZG's pools): a stay-close chain
 * (TELEGRAPH_POOL_SPIRE.chain) draws its links inside the lane alone, and a pull-apart tether (TELEGRAPH_POOL_SPIRE.pull) its
 * line inside it and its break tick out to twice its half-width and TELEGRAPH_TICK_REACH - its strip that wide. AUDIT EG V
 * (L6-4): into `out` when given (its `a` and `u` pairs kept), else a new strip. Pure but for `out`.
 * @param {any} sh @param {{ a: number[], u: number[], len: number, w: number }|null} [out]
 */
export function telegraphStrip(sh, out = null) {
  const w = stripW(sh);
  if (!(w > 0)) return null;
  const dx = sh.end[0] - sh.origin[0], dz = sh.end[1] - sh.origin[1], l = Math.hypot(dx, dz);
  const ux = l > 1e-6 ? dx / l : 0, uz = l > 1e-6 ? dz / l : 1;
  if (!out) return { a: [sh.origin[0] - ux * w, sh.origin[1] - uz * w], u: [ux, uz], len: l + 2 * w, w };
  out.a[0] = sh.origin[0] - ux * w; out.a[1] = sh.origin[1] - uz * w; out.u[0] = ux; out.u[1] = uz; out.len = l + 2 * w; out.w = w;
  return out;
}
/** AUDIT EG V (L6-2): a path's or a tether's own strip's half-width (telegraphStrip's `w` - its lane's reach, a pull-apart's
 *  break tick, TELEGRAPH_TIGHT_PAD past it), or NaN for any other shape. Pure. */
function stripW(sh) {
  if (!sh || sh.kind !== TELEGRAPH_KIND.lane) return NaN;
  const across = sh.pool === TELEGRAPH_POOL.path || sh.pool === TELEGRAPH_POOL_SPIRE.chain ? sh.halfW : sh.pool === TELEGRAPH_POOL_SPIRE.pull ? 2 * sh.halfW + TELEGRAPH_TICK_REACH : NaN;
  return across + TELEGRAPH_TIGHT_PAD;
}

const wrap = (a) => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));
/** WB13a: how far from (ox, oz) along the unit (dx, dz) the rim of the floor of radius `R` about (cx, cz) stands - the
 *  shader's rimDist. */
export function rimDist(ox, oz, dx, dz, cx, cz, R = COURT_R) {
  const ocx = ox - cx, ocz = oz - cz, b = ocx * dx + ocz * dz, q = ocx * ocx + ocz * ocz - R * R;
  return -b + Math.sqrt(Math.max(b * b - q, 0));
}
/** WB13a: the cone's edge as one continuous distance - the sector's (folded about his facing) joined with his body's disc
 *  (AUDIT WB9 F1's jump gone: the line's width is read off this edge's own derivative). */
function coneEdge(rx, rz, yaw, r, halfArc, body) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const px = Math.abs(rx * fz - rz * fx), pz = rx * fx + rz * fz;
  const cx = Math.sin(halfArc), cz = Math.cos(halfArc);
  const k = Math.max(0, Math.min(r, px * cx + pz * cz));
  const sector = Math.max(Math.hypot(px, pz) - r, Math.hypot(px - cx * k, pz - cz * k) * Math.sign(cz * px - cx * pz));
  return Math.abs(Math.min(sector, Math.hypot(rx, rz) - body));
}
function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
  const h = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2)) : 0;
  return [Math.hypot(px - (ax + vx * h), pz - (az + vz * h)), h];
}

/**
 * THE SHADER'S OWN READING, in JS: for a point of the court (its frame), whether it lies inside the shape, how far it
 * is from the shape's edge (metres - the outline's measure), and the fill's coordinate (0 where the fill starts, 1 at
 * its far edge: out from him for a cone or disc, down the lane for the charge, out from the ring's inner edge for the
 * nova, out from the centre for the whole floor). WB13a: the Nova's and the Spokes' far edge is the floor's rim where
 * they reach past it - so the fill meets the edge a fighter can see as it lands.
 * @param {NonNullable<ReturnType<typeof telegraphShape>>} sh @param {number} px @param {number} pz
 */
export function telegraphField(sh, px, pz) {
  const rx = px - sh.origin[0], rz = pz - sh.origin[1], d = Math.hypot(rx, rz);
  switch (sh.kind) {
    case TELEGRAPH_KIND.cone: {
      const ang = Math.abs(wrap(Math.atan2(rx, rz) - sh.yaw));
      const inside = d <= sh.r && (d <= sh.body || ang <= sh.halfArc);
      return { inside, edge: coneEdge(rx, rz, sh.yaw, sh.r, sh.halfArc, sh.body), s: d / sh.r };
    }
    case TELEGRAPH_KIND.disc: return { inside: d <= sh.r, edge: Math.abs(d - sh.r), s: d / sh.r };
    case TELEGRAPH_KIND.discs: {
      let m = Infinity;
      for (const p of sh.points) m = Math.min(m, Math.hypot(px - p[0], pz - p[1]));
      return { inside: m <= sh.r, edge: Math.abs(m - sh.r), s: m / sh.r };
    }
    case TELEGRAPH_KIND.lane: {
      const [ld, h] = segDist(px, pz, sh.origin[0], sh.origin[1], sh.end[0], sh.end[1]);
      return { inside: ld <= sh.halfW, edge: Math.abs(ld - sh.halfW), s: h };
    }
    case TELEGRAPH_KIND.ring: {
      const C = COURTS[sh.court] ?? COURTS[0], dd = Math.max(d, 1e-4);
      const far = Math.min(sh.r1, rimDist(sh.origin[0], sh.origin[1], rx / dd, rz / dd, C[0], C[1]));
      return { inside: d >= sh.r0 && d <= sh.r1, edge: Math.min(Math.abs(d - sh.r0), Math.abs(d - sh.r1)), s: Math.max(0, Math.min(1, (d - sh.r0) / Math.max(far - sh.r0, 1e-3))) };
    }
    case TELEGRAPH_KIND.all: { const cc = COURTS[nearestCourt(px, pz)], c = Math.hypot(px - cc[0], pz - cc[1]); return { inside: true, edge: Math.abs(COURT_R - c), s: c / COURT_R }; }   // WB9b: about the court the point stands in
    case TELEGRAPH_KIND.spokes: {
      const C = COURTS[sh.court] ?? COURTS[0];
      let best = Infinity, bh = 0;
      for (let i = 0; i < sh.n; i++) {
        const a = sh.yaw + (i * 2 * Math.PI) / sh.n, dx = Math.sin(a), dz = Math.cos(a);
        const h = Math.max(0, Math.min(sh.r, rx * dx + rz * dz)), ld = Math.hypot(rx - dx * h, rz - dz * h);
        if (ld < best) { best = ld; bh = Math.max(0, Math.min(1, h / Math.min(sh.r, rimDist(sh.origin[0], sh.origin[1], dx, dz, C[0], C[1])))); }
      }
      return { inside: best <= sh.halfW, edge: Math.abs(best - sh.halfW), s: bh };
    }
    case TELEGRAPH_KIND.wedges: {
      // WB14a: the Unmaking's lit wedges - `n` about its heart, the first centred on its facing, `halfArc` each side
      const per = (2 * Math.PI) / Math.max(1, sh.n), a = Math.atan2(rx, rz) - sh.yaw, C = COURTS[sh.court] ?? COURTS[0];
      const off = Math.abs(a - per * Math.floor(a / per + 0.5)) - sh.halfArc;
      const across = d * Math.sin(Math.min(Math.abs(off), Math.PI / 2));
      const inside = d <= sh.r && off <= 0;
      return { inside, edge: inside ? Math.min(across, sh.r - d) : Math.max(off > 0 ? across : 0, d - sh.r), s: d / Math.min(sh.r, rimDist(sh.origin[0], sh.origin[1], rx / (d || 1), rz / (d || 1), C[0], C[1])) };   // AUDIT WB14 (SCREEN-13): the fill meets the rim it is seen at (the Nova's and the Spokes' law)
    }
    case TELEGRAPH_KIND.mark: {
      const fx = Math.sin(sh.yaw), fz = Math.cos(sh.yaw), along = rx * fx + rz * fz, side = rx * fz - rz * fx;
      const k = (along - sh.r) / sh.r1;
      const chevron = k >= 0 && k <= 1 && Math.abs(side) <= sh.halfW * (1 - k);
      return { inside: chevron || d <= sh.r, edge: Math.abs(d - sh.r), s: chevron ? k : 0, chevron };
    }
    default: return { inside: false, edge: Infinity, s: 0 };
  }
}

const HEAD = `#version 300 es
precision highp float;
`;
export const TELEGRAPH_VS = HEAD + `layout(location = 0) in vec2 aCourt;   // WB13a: 0..1 over the shape's own bounds - or, on a walkway, along and across its strip
uniform mat4 uVP;
uniform vec3 uCentre;    // the first court's centre in the scene - the court frame's origin
uniform vec2 uLo;        // WB13a: the ground the quad covers, in the court frame (telegraphBounds within its court)
uniform vec2 uHi;
uniform float uLift;
uniform highp int uOnWalk;   // AUDIT WB9 (court F4): 1 - the quad is a laid walkway's strip (aCourt: 0..1 along it, -1..1 across); highp both stages (a uniform's precision must match)
uniform vec2 uWalkA;     // its start, in the court frame
uniform vec2 uWalkU;     // its direction
uniform float uWalkLen;  // as far as it is laid
uniform highp int uStrip;   // AOE-PERF: 1 - the quad is a path's own strip over its court (uWalkA, uWalkU, uWalkLen; uStripW across)
uniform float uStripW;
out vec2 vCourt;
out vec3 vWorld;
void main() {
  vCourt = uOnWalk == 1 ? uWalkA + uWalkU * (aCourt.x * uWalkLen) + vec2(uWalkU.y, -uWalkU.x) * (aCourt.y * ${WALK_HALF_W.toFixed(3)}) : uStrip == 1 ? uWalkA + uWalkU * (aCourt.x * uWalkLen) + vec2(uWalkU.y, -uWalkU.x) * (aCourt.y * uStripW) : mix(uLo, uHi, aCourt);
  vWorld = uCentre + vec3(vCourt.x, uLift, vCourt.y);
  gl_Position = uVP * vec4(vWorld, 1.0);
}`;
const NOW_S = (TELEGRAPH_NOW_MS / 1000).toFixed(3), POP_S = (TELEGRAPH_POP_MS / 1000).toFixed(3), FILL_S = (TELEGRAPH_FILL_IN_MS / 1000).toFixed(3);
const TAU_S = (TELEGRAPH_FLASH_TAU_MS / 1000).toFixed(3), WAVE_S = (TELEGRAPH_WAVE_MS / 1000).toFixed(3);
const vec3Of = (c) => `vec3(${c.map((v) => v.toFixed(3)).join(', ')})`;
export const TELEGRAPH_FS = HEAD + `in vec2 vCourt;
in vec3 vWorld;
uniform int uKind;       // 0 cone, 1 disc, 2 discs, 3 lane, 4 ring, 5 all, 6 spokes, 7 his mark, 8 the Unmaking's wedges (TELEGRAPH_KIND)
uniform vec2 uOrigin;    // where he stood
uniform float uYaw;      // his facing, atan2(dx, dz)
uniform float uR;
uniform float uHalfArc;
uniform float uBody;     // his body's radius - a cone always holds it
uniform vec2 uEnd;       // the lane's end
uniform float uHalfW;
uniform float uR0;
uniform float uR1;
uniform vec2 uPts[${TELEGRAPH_POINTS_MAX}];
uniform int uCount;
uniform float uT;        // the wind-up's share: the fill's reach
uniform float uFlash;    // the landing
uniform float uAlpha;
uniform vec3 uColor;     // what lands - the fill and its grain (his element's colour)
uniform vec3 uEdgeCol;   // WB13a: the line - the danger edge, Dagon's crimson for his own (TELEGRAPH_EDGE)
uniform vec2 uCourt;     // WB9b: the court it lies over
uniform float uFloorR;
uniform highp int uOnWalk;   // AUDIT WB9 (court F4): drawn over a laid walkway's strip - the ground past the rim a blow still reaches
uniform vec2 uWalkC0;    // the courts it joins - their discs are their own passes'
uniform vec2 uWalkC1;
uniform int uStyle;      // WB9e: 0 his weight, 1 fire, 2 frost, 3 shock, 4 venom, 5 Dagon's (TELEGRAPH_STYLE)
uniform float uSince;    // WB9e: seconds since the word - its own clock (never a wrapped one)
uniform float uSpan;     // WB9e: the wind-up, seconds
uniform float uAfter;    // WB9e: seconds since the landing, < 0 before it
uniform int uPool;       // WB13a: 0 a blow to come, 1 burning ground (WB9d), 2 a path or a tether (TELEGRAPH_POOL)
uniform float uRunS;     // WB13a: the charge's run end to end, seconds - its landing follows his head
uniform float uLineW;    // WB13a: the line's width, times (a short screen's wider - telegraphLineW)
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
const float PI = 3.141592653589793;
float wrapAngle(float a) { return a - 2.0 * PI * floor((a + PI) / (2.0 * PI)); }
// WB13a: how far from o along dir the floor's rim stands (radius R about c) - the far edge a fighter can see
float rimDist(vec2 o, vec2 dir, vec2 c, float R) { vec2 oc = o - c; float b = dot(oc, dir); float q = dot(oc, oc) - R * R; return -b + sqrt(max(b * b - q, 0.0)); }
// WB9e: the grain's noise - a hashed value lattice, smooth between
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
}
// the grain of what lands, 0..1 over the fill (its own clock, uSince)
float grain(vec2 p, float t) {
  if (uStyle == 1) return vnoise(p * 0.7 + vec2(0.0, -t * 1.6)) * 0.6 + vnoise(p * 1.9 + vec2(t * 0.7, -t * 2.3)) * 0.4;   // fire: flicker rising
  if (uStyle == 2) { vec2 q = p * 0.9; float a = abs(fract(q.x + 0.5 * q.y) - 0.5) + abs(fract(q.y * 1.15) - 0.5); return 1.0 - smoothstep(0.0, 0.18, abs(a - 0.5)); }   // frost: facets
  if (uStyle == 3) { float n = vnoise(p * 1.3 + vec2(floor(t * 4.0) * 3.1)); return 1.0 - smoothstep(0.0, 0.07, abs(n - 0.5)); }   // storm: crackle, jumping four times a second (WB13a: twelve flashed)
  if (uStyle == 4) { vec2 cell = floor(p * 0.8), f = fract(p * 0.8) - 0.5; float r = 0.18 + 0.2 * hash2(cell); float ph = fract(t * (0.4 + hash2(cell + 7.0)) + hash2(cell + 3.0)); return (1.0 - smoothstep(r * ph - 0.04, r * ph, length(f))) * (1.0 - ph); }   // venom: bubbles swelling and bursting
  if (uStyle == 5) { vec2 d = p - uOrigin; float a = atan(d.x, d.y), r = length(d); return vnoise(vec2(a * 3.0 + r * 0.25 - t * 0.9, r * 0.35 - t * 0.5)); }   // Dagon's: a slow vortex
  return 1.0 - smoothstep(0.0, 0.05, abs(vnoise(p * 0.55) - 0.5));   // his weight: the floor's cracks, still
}
void main() {
  float c = length(vCourt - uCourt);
  // the court's own disc - a laid walkway's strip is its own (cut after the derivatives below: never before them)
  bool clipOut = uOnWalk == 0 ? c > uFloorR : (length(vCourt - uWalkC0) <= uFloorR || length(vCourt - uWalkC1) <= uFloorR);
  vec2 rel = vCourt - uOrigin;
  float d = length(rel);
  bool inside = false;
  float edge = 1e3;
  float s = 0.0;
  float course = 0.0;   // burning ground's rim, where along it a point stands (0..1) - its dashes
  if (uKind == 0) {
    float ang = abs(wrapAngle(atan(rel.x, rel.y) - uYaw));
    inside = d <= uR && (d <= uBody || ang <= uHalfArc);
    // WB13a: one continuous edge - the sector's, folded about his facing, joined with his body's disc (it jumped)
    vec2 fd = vec2(sin(uYaw), cos(uYaw));
    vec2 q = vec2(abs(rel.x * fd.y - rel.y * fd.x), dot(rel, fd));
    vec2 cs = vec2(sin(uHalfArc), cos(uHalfArc));
    float sector = max(length(q) - uR, length(q - cs * clamp(dot(q, cs), 0.0, uR)) * sign(cs.y * q.x - cs.x * q.y));
    edge = abs(min(sector, d - uBody));
    s = d / uR;
  } else if (uKind == 1) {
    inside = d <= uR; edge = abs(d - uR); s = d / uR;
  } else if (uKind == 2) {
    float m = 1e3; vec2 near = uOrigin;
    for (int i = 0; i < ${TELEGRAPH_POINTS_MAX}; i++) { if (i >= uCount) break; float di = length(vCourt - uPts[i]); if (di < m) { m = di; near = uPts[i]; } }
    inside = m <= uR; edge = abs(m - uR); s = m / uR;
    vec2 q = vCourt - near; course = (atan(q.x, q.y) + PI) / (2.0 * PI);
  } else if (uKind == 3) {
    vec2 v = uEnd - uOrigin;
    float l2 = dot(v, v);
    float h = l2 > 0.0 ? clamp(dot(rel, v) / l2, 0.0, 1.0) : 0.0;
    float ld = length(vCourt - (uOrigin + v * h));
    inside = ld <= uHalfW; edge = abs(ld - uHalfW); s = h;
  } else if (uKind == 4) {
    inside = d >= uR0 && d <= uR1; edge = min(abs(d - uR0), abs(d - uR1));
    float far = min(uR1, rimDist(uOrigin, rel / max(d, 1e-4), uCourt, uFloorR));   // WB13a: the fill meets the rim it is seen at
    s = clamp((d - uR0) / max(far - uR0, 1e-3), 0.0, 1.0);
  } else if (uKind == 6) {
    // WBX5: the spokes - the nearest of uCount lanes from him, the first along his facing, uR long
    float best = 1e3, bh = 0.0;
    for (int i = 0; i < ${TELEGRAPH_SPOKES_MAX}; i++) {
      if (i >= uCount) break;
      float a = uYaw + float(i) * 6.283185307179586 / float(uCount);
      vec2 dir = vec2(sin(a), cos(a));
      float h = clamp(dot(rel, dir), 0.0, uR);
      float ld = length(rel - dir * h);
      if (ld < best) { best = ld; bh = clamp(h / min(uR, rimDist(uOrigin, dir, uCourt, uFloorR)), 0.0, 1.0); }   // WB13a: to the rim
    }
    inside = best <= uHalfW; edge = abs(best - uHalfW); s = bh;
  } else if (uKind == 8) {
    // WB14a: the Unmaking - uCount lit wedges about the court's heart, the first centred on uYaw, uHalfArc each side, uR out
    float per = 6.283185307179586 / float(max(uCount, 1));
    float a = atan(rel.x, rel.y) - uYaw;
    float off = abs(a - per * floor(a / per + 0.5)) - uHalfArc;
    float across = d * sin(min(abs(off), 1.5707963));
    inside = d <= uR && off <= 0.0;
    edge = inside ? min(across, uR - d) : max(off > 0.0 ? across : 0.0, d - uR);
    s = d / min(uR, rimDist(uOrigin, rel / max(d, 1e-4), uCourt, uFloorR));   // AUDIT WB14 (SCREEN-13): to the rim it is seen at
  } else if (uKind == 7) {
    // WBX4: his mark - a ring about his feet (uR), a faint floor inside it, and a chevron before it where he faces (uR1
    // long, uHalfW wide at the ring), steady: it is where he is, not what he does. WB13a: dashed and dim - it was the
    // brightest thing on the floor, and inside a shape about him it read as a safe heart
    vec2 fdir = vec2(sin(uYaw), cos(uYaw));
    float along = dot(rel, fdir), side = rel.x * fdir.y - rel.y * fdir.x;
    float k = (along - uR) / uR1;
    float chev = (k >= 0.0 && k <= 1.0 && abs(side) <= uHalfW * (1.0 - k)) ? 1.0 : 0.0;
    float ring = 1.0 - smoothstep(0.04, ${TELEGRAPH_MARK_RING.toFixed(1)}, abs(d - uR));
    float dash = step(0.4, fract((atan(rel.x, rel.y) + PI) / (2.0 * PI) * 10.0));
    float floorIn = d <= uR ? 1.0 : 0.0;
    float mark = 0.4 * ring * dash + 0.65 * chev * (0.7 + 0.3 * (1.0 - k)) + 0.04 * floorIn;
    if (mark < 0.001 || clipOut) discard;
    o = vec4(uColor * mark * uAlpha * fogFactorAt(vWorld), 0.0);
    return;
  } else {
    inside = true; edge = abs(uFloorR - c); s = c / uFloorR;
  }
  float fin = inside ? 1.0 : 0.0;
  // WB13a: THE LINE - two pixels wide wherever it is seen (its width read off the edge's own derivative, uLineW wider on
  // a short screen), never thinner than a few centimetres near; a dark keyline just outside it, a soft glow past that
  float aa = max(fwidth(edge), 1e-4) * uLineW;
  float foot = max(length(fwidth(vCourt)), 1e-4);
  float fs = max(fwidth(s), 1e-4);
  if (clipOut) discard;
  float now = uPool == 0 ? smoothstep(uSpan - ${NOW_S}, uSpan, uSince) * (1.0 - uFlash) : 0.0;
  float wid = 1.0 + 0.6 * now;
  float core = max(1.0 - smoothstep(aa * wid, 2.2 * aa * wid, edge), 1.0 - smoothstep(0.05, 0.08, edge));
  float glow = (1.0 - fin) * exp(-edge / (4.0 * aa + 0.12));
  float keyl = (1.0 - fin) * (1.0 - core) * (1.0 - smoothstep(2.2 * aa, 7.0 * aa, edge));
  if (fin + core + glow + keyl < 0.002 && uAfter < 0.0) discard;
  float g = grain(vCourt, uSince) * (1.0 - smoothstep(0.08, 0.25, foot));   // WB13a: the grain gone where a pixel outgrows it (it shimmered)
  float f = uAlpha * fogFactorAt(vWorld);
  if (uPool == 1) {
    // WB13a: BURNING GROUND IS TERRAIN - the floor darkened under it, its element greyed and dim, a slow seethe, a broken
    // rim, no glow: a place to keep out of, never a blow still to come (it outshone them)
    float seethe = 0.85 + 0.15 * sin(uSince * 6.283185307179586 * 0.6);
    float dash = step(0.45, fract(course * 16.0));
    vec3 tint = mix(uColor, vec3(dot(uColor, vec3(0.3, 0.5, 0.2))), 0.35);
    vec3 lit = tint * (fin * (0.10 + 0.20 * g) * seethe + 0.32 * core * dash);
    o = vec4(lit * f, fin * 0.45 * f);
    return;
  }
  if (uPool == 2) {
    // WB13a: A PATH OR A TETHER - dashes flowing along it to him (an Atronach's march, a Ward-Bearer's hold), never fire
    float flow = step(0.5, fract(s * length(uEnd - uOrigin) / 1.5 - uSince * 1.25));
    o = vec4(uColor * fin * (0.1 + 0.9 * flow) * f, 0.0);
    return;
  }
  // THE FILL - eased in behind the line, dim at the word and deep at the landing, a soft lip on its front, the grain of
  // what lands through it; the inside comes up over ${TELEGRAPH_FILL_IN_MS} ms while the line stands whole from the first frame, popping
  float filled = fin * (1.0 - smoothstep(uT - fs, uT + fs, s));
  float lip = filled * exp(-(uT - s) * (uT - s) * 144.0) * (1.0 - step(0.999, uT));   // AUDIT SD II: squared - GLSL leaves pow of a negative undefined (NaN on D3D)
  float T2 = uT * uT;
  float pop = 1.0 + 0.8 * exp(-uSince / ${POP_S});
  float inFade = smoothstep(0.0, ${FILL_S}, uSince);
  float inner = (fin * 0.10 + filled * (0.20 + 0.55 * T2) + lip * 0.35 + fin * (0.05 + 0.07 * uT) * g) * inFade;
  // THE THROB, on the line alone, quickening to three beats a second at the landing (TELEGRAPH_THROB_MAX_HZ)
  float hz = 1.5 + 0.5 * T2;
  float throb = 0.85 + 0.15 * cos(6.283185307179586 * hz * uSince);
  float safe = (uKind == 4 && d < uR0 + 0.5 * (uR1 - uR0)) ? 1.0 : 0.0;   // the Nova's heart - its edge cool, never a blow's
  vec3 edgeCol = mix(uEdgeCol, vec3(1.0, 0.95, 0.85), 0.45 * now);
  vec3 lineCol = mix(edgeCol, ${vec3Of(TELEGRAPH_EDGE_SAFE)}, safe);
  float line = (core * (0.95 * throb * pop + 0.65 * now) + glow * 0.22) * (1.0 - 0.3 * safe);
  vec3 rgb = uColor * inner + lineCol * line;
  float a = fin * (0.22 + 0.18 * filled) * inFade + keyl * 0.55;
  if (uAfter >= 0.0) {
    // THE LANDING - white-hot at once, decaying into a dark scorch; the charge's lit ahead of his head and spent behind it
    float k = exp(-uAfter / ${TAU_S});
    if (uKind == 3 && uRunS > 0.0) { float passed = uAfter - s * uRunS; k = passed >= 0.0 ? exp(-passed / ${TAU_S}) : 0.75; }
    vec3 hot = mix(uColor, vec3(1.0, 0.96, 0.88), 0.6);
    rgb = hot * fin * (0.22 + 1.25 * k) + edgeCol * core * (0.35 + 0.8 * k);
    a = fin * (0.6 - 0.3 * k);
    // the shockwave out past its edge, sized to its shape - never into a safe heart, never from the whole floor's
    float size = (uKind == 3 || uKind == 6) ? 2.0 * uHalfW : uKind == 4 ? 4.0 : uR;
    float rw = min(uAfter * ${TELEGRAPH_WAVE_MPS}.0, clamp(0.5 * size, 1.0, ${TELEGRAPH_WAVE_MAX_M.toFixed(1)}));
    float wave = (1.0 - fin) * (1.0 - safe) * exp(-(edge - rw) * (edge - rw) * 4.0) * clamp(1.0 - uAfter / ${WAVE_S}, 0.0, 1.0);   // squared, as the lip
    if (uKind != 5) rgb += hot * wave * 0.9;
  }
  o = vec4(rgb * f, clamp(a, 0.0, 1.0) * f);
}`;


function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

/** AUDIT WB9 (court F4): a walkway's strip - 0..1 along it, -1..1 across (the vertex stage lays it where it is laid). */
export const TELEGRAPH_WALK_QUAD = Object.freeze([0, -1, 0, 1, 1, 1, 0, -1, 1, 1, 1, -1]);

/** WB13a: the quad, two triangles facing up over 0..1 - the vertex stage lays it over the shape's own ground (uLo..uHi).
 *  Pure. */
export function telegraphQuad() {
  return new Float32Array([0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0]);
}
/** WB13a: the ground the pass lays the quad over for `shape` in court `k`, [x0, z0, x1, z1] - its bounds within the
 *  court's own square (the floor and TELEGRAPH_MARGIN past it), the whole square for a shape over the whole court, or
 *  null where they do not meet. SD8d: over another floor's courts and radius (`courts`, `R` - the Brass Remnant's
 *  arena). Pure. */
export function telegraphQuadOver(shape, k, courts = COURTS, R = COURT_R) {
  const C = courts[k], half = R + TELEGRAPH_MARGIN;
  if (!C) return null;
  const B = telegraphBounds(shape);
  const x0 = Math.max(C[0] - half, B ? B[0] : -Infinity), z0 = Math.max(C[1] - half, B ? B[1] : -Infinity);
  const x1 = Math.min(C[0] + half, B ? B[2] : Infinity), z1 = Math.min(C[1] + half, B ? B[3] : Infinity);
  return x1 > x0 && z1 > z0 ? [x0, z0, x1, z1] : null;
}

const NO_FOG_RANGE = new Float32Array([0, 1]);

/**
 * EG-G2 (2026-10-12, bible/11-Multiplayer/Elite-Gates.md sections 25.6 and 25.7 - EG16): THE SPIRE'S TELEGRAPH, the gate's
 * own fragment stage with three things more, made from TELEGRAPH_FS's text (each needle asserted - the gate's program is
 * the same bytes it was, and every pin on it stands):
 *   READABLE IN THE FOG - `uFogFloor` (floor, within, ease): within `within` metres a shape keeps a fog visibility of at
 *     least `floor`, eased out past it (world/eliteGates/egLook.js egFogKept - the same numbers), so the Shade's fog and the Cairn's
 *     haze never fade a warning;
 *   `port:telegraphFill` - `uFillK`, the fill's opacity (0.5 to 1); the line is never thinned by it;
 *   `port:dangerPalette`'s style bit - `uLook`: 1 a second dark keyline outside the first, 2 a 45-degree hatch through the
 *     fill (world/eliteGates/egLook.js EG_LOOK_BIT). Its colours ride the pass's existing uEdgeCol and uColor;
 *   THE HAVEN GRAMMAR (section 25.5) - a pool of its own, TELEGRAPH_POOL_HAVEN: gold and lit (never the darkened floor
 *     burning ground is), its line bright, a dark keyline outside it and chevrons flowing inward to its heart - so a haven
 *     never relies on gold against red (a deuteranopia pair);
 *   EG-ZD (2026-10-12, section 13.2 - an EG-H1 departure retired): THE FEINT'S DASHED FADE - `uLook` 4 (world/eliteGates/egLook.js
 *     EG_LOOK_BIT.dash): a cut blow's whole mark broken into stripes as it fades, Feud-Arc section 7.3's own grammar
 *     (render/foeTelegraph.js TELL5 - `step(0.5, fract((across + along) * 2.5))`, here across the court's own axes the
 *     hatch's other way), so a feint reads dashed and never as a blow still to come.
 */
export function spireTelegraphFs(fs) {
  const swap = (src, needle, put) => { if (!src.includes(needle)) throw new Error(`spireTelegraphFs: the gate's shader lost ${needle}`); return src.replace(needle, put); };
  let out = swap(fs, 'uniform vec3 uCamPos;\n', 'uniform vec3 uCamPos;\nuniform vec3 uFogFloor;   // EG-G2: floor, within, ease (m)\nuniform float uFillK;     // EG-G2: the fill\'s opacity\nuniform int uLook;        // EG-G2: 1 the double keyline, 2 the hatch\n');
  out = swap(out, '  float f = uAlpha * fogFactorAt(vWorld);\n', '  float kept = uFogFloor.x * (1.0 - smoothstep(uFogFloor.y, uFogFloor.y + uFogFloor.z, distance(vWorld, uCamPos)));\n  float f = uAlpha * max(fogFactorAt(vWorld), kept);\n  float keyl2 = (uLook & 1) != 0 ? (1.0 - fin) * (1.0 - smoothstep(9.0 * aa, 13.0 * aa, edge)) * smoothstep(7.0 * aa, 9.0 * aa, edge) : 0.0;\n  float hatch = (uLook & 2) != 0 ? 0.55 + 0.45 * step(0.5, fract((vCourt.x + vCourt.y) * 1.1785)) : 1.0;\n');
  out = swap(out, '  // THE FILL - eased in behind the line', '  if (uPool == 3) {\n    // EG-G2 (section 25.5): A HAVEN - gold and lit, its line bright, a dark keyline outside it, chevrons flowing in to its heart\n    float a8 = atan(rel.x, rel.y) / 6.283185307179586 * 8.0;\n    float chev = step(0.5, fract(s * 3.0 - abs(fract(a8) - 0.5) * 1.4 + uSince * 0.8));\n    vec3 lit = uColor * (fin * (0.14 + 0.16 * chev) + core * 0.9 + glow * 0.15);\n    o = vec4(lit * f, (fin * 0.1 + keyl * 0.85) * f);\n    return;\n  }\n  // THE FILL - eased in behind the line');
  out = swap(out, '  float inner = (fin * 0.10 + filled * (0.20 + 0.55 * T2) + lip * 0.35 + fin * (0.05 + 0.07 * uT) * g) * inFade;\n', '  float inner = (fin * 0.10 + filled * (0.20 + 0.55 * T2) + lip * 0.35 + fin * (0.05 + 0.07 * uT) * g) * inFade * uFillK * hatch;\n');
  out = swap(out, '  float a = fin * (0.22 + 0.18 * filled) * inFade + keyl * 0.55;\n', '  float a = fin * (0.22 + 0.18 * filled) * inFade * uFillK + keyl * 0.55 + keyl2 * 0.75;\n');
  out = swap(out, '  o = vec4(rgb * f, clamp(a, 0.0, 1.0) * f);\n}', '  if ((uLook & 4) != 0) { float dsh = step(0.5, fract((vCourt.x - vCourt.y) * 2.5)); rgb *= dsh; a *= dsh; }   // EG-ZD: a feint cut - dashed as it fades\n  o = vec4(rgb * f, clamp(a, 0.0, 1.0) * f);\n}');
  out = swap(out, '  if (uPool == 1) {\n', EG_ZG_POOLS_GLSL + '  if (uPool == 1) {\n');   // EG-ZG: the grammars' pools, before the gate's own
  return out;
}
/** EG-G2: THE HAVEN GRAMMAR's pool - the Spire's stage alone draws it (the gate's own reads it as a blow, and is never
 *  handed one). */
export const TELEGRAPH_POOL_HAVEN = 3;
/**
 * EG-ZG (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 25.2, 25.4 and 25.5):
 * THE GRAMMARS' POOLS - each a shape the Spire's stage alone draws (the gate's own is never handed one), its line in the
 * palette's danger (`uEdgeCol`) where it warns:
 *   pool (4)  a Spire pool - the band's ramp darkened (`uColor`), the floor darkened under it, its element's grain, and a
 *             DASHED danger rim (never POOL_COLOR, the burning ground's orange);
 *   pull (5)  a pull-apart tether (the Wraith's Drain, the Blood Tether, a soul-wisp) - a red line `uR` each side of its
 *             middle, chevrons pointing OUT from the middle and flowing outward, a tick across it at the break (`uR1`
 *             each side); the caller thins it (`halfW`) as the pair nears the break;
 *   chain (6) a stay-close tether (Morvayn's Chaining) - chain links along it, every other link turned, slack and dim under
 *             6 m and taut and throbbing (`uT` 0..1, never past three beats a second) to 8 m: never the pull's pattern;
 *   ring (7)  a Vestige aura - one thin line at the holder's feet in Battlemage blue (`uColor`), steady: yours, never a
 *             danger, never a cloud over the floor the telegraphs live on;
 *   dark (8)  THE ECLIPSE'S DARK - the floor darkened by `uT` (its last 2 s), every moon-shaft (`uPts`, radius `uR`) kept.
 */
export const TELEGRAPH_POOL_SPIRE = Object.freeze({ haven: TELEGRAPH_POOL_HAVEN, pool: 4, pull: 5, chain: 6, ring: 7, dark: 8 });
/** EG-ZG: the pools' fragment text, laid into the Spire's stage before the gate's burning ground (the fill's `f`, `fin`,
 *  `core`, `keyl` and `g` stand by then). */
const EG_ZG_POOLS_GLSL = `  if (uPool == 4) {
    // EG-ZG (section 25.2): A SPIRE POOL - the band's ramp darkened, the floor darkened under it, a dashed danger rim
    float run = uKind == 2 ? course : uKind == 3 ? s * length(uEnd - uOrigin) / 7.0 : (atan(rel.x, rel.y) + PI) / (2.0 * PI);
    float pdash = step(0.5, fract(run * 14.0));
    vec3 plit = uColor * fin * (0.3 + 0.3 * g) + uEdgeCol * core * pdash * 0.9;
    o = vec4(plit * f, (fin * 0.5 + keyl * 0.45 * pdash) * f);
    return;
  }
  if (uPool == 5 || uPool == 6) {
    // EG-ZG (section 25.5): A TETHER - along it (u, m) and off its line (ld, m)
    float tl = length(uEnd - uOrigin);
    float ld = fin > 0.5 ? uHalfW - edge : uHalfW + edge;
    if (uPool == 5) {
      // PULL-APART: the line its pair's length, chevrons pointing out from the middle, a tick at the break
      float u = abs(s - 0.5) * tl;
      float onLine = (u <= uR ? 1.0 : 0.0) * fin;
      float chev = step(0.5, fract((u + 1.6 * ld) / 1.2 - uSince * 1.2));
      float tick = (1.0 - smoothstep(0.06, 0.12, abs(u - uR1))) * (1.0 - smoothstep(2.0 * uHalfW, 2.0 * uHalfW + ${TELEGRAPH_TICK_REACH.toFixed(2)}, ld));   // AUDIT EG V (L6-2): its reach, its strip's (telegraphStrip)
      o = vec4(uEdgeCol * (onLine * (0.3 + 0.7 * chev) + tick) * f, 0.0);
      return;
    }
    // STAY-CLOSE: chain links, every other turned; slack and dim, then taut and throbbing
    float cu = s * tl;
    float k = fract(cu / 0.7), odd = mod(floor(cu / 0.7), 2.0);
    vec2 q = vec2((k - 0.5) * 2.0, ld / max(uHalfW, 1e-3));
    float lring = odd < 0.5 ? abs(length(q) - 0.7) : abs(length(vec2(q.x, q.y * 2.6)) - 0.75);
    float link = (1.0 - smoothstep(0.12, 0.22, lring)) * (ld <= uHalfW ? 1.0 : 0.0);
    float throb = uT > 0.0 ? 0.75 + 0.25 * cos(6.283185307179586 * (1.5 + 1.5 * uT) * uSince) : 1.0;
    o = vec4(uEdgeCol * link * (0.35 + 0.65 * uT) * throb * f, 0.0);
    return;
  }
  if (uPool == 7) {
    // EG-ZG (section 25.4): A VESTIGE AURA - one thin blue ring at its holder's feet; AUDIT EG V (L6-2): its line cut at
    // TELEGRAPH_RING_REACH from its ring at any pixel's size - the ground its quad covers (telegraphBounds)
    o = vec4(uColor * core * (edge <= ${TELEGRAPH_RING_REACH.toFixed(2)} ? 1.0 : 0.0) * f, 0.0);
    return;
  }
  if (uPool == 8) {
    // EG-ZG (section 25.5): THE ECLIPSE'S DARK - the floor darkened over its last 2 s, every moon-shaft kept
    float m = 1e3;
    for (int i = 0; i < ${TELEGRAPH_POINTS_MAX}; i++) { if (i >= uCount) break; m = min(m, length(vCourt - uPts[i]) - uR); }
    o = vec4(0.0, 0.0, 0.0, uT * smoothstep(-0.3, 0.3, m) * f);
    return;
  }
`;
/**
 * EG-ZG (2026-10-12; Elite-Gates.md section 11.7 - EG6b): THE SPIRE'S VERTEX STAGE, made from TELEGRAPH_VS's text by
 * asserted swaps (the gate's own is the same bytes it was): a fight floor's clipped triangle (`uOnFloor` 1 - its vertex
 * already in the court frame) or the gate's quad, at `uFloorY` (the floor's height, or a shape's own surface's) plus the
 * lift. With both nought it is the gate's.
 */
export function spireTelegraphVs(vs) {
  const swap = (src, needle, put) => { if (!src.includes(needle)) throw new Error(`spireTelegraphVs: the gate's shader lost ${needle}`); return src.replace(needle, put); };
  let out = swap(vs, 'uniform float uLift;\n', 'uniform float uLift;\nuniform float uFloorY;      // EG-ZG: the floor\'s height (a shape\'s own surface\'s for a quad)\nuniform highp int uOnFloor;   // EG-ZG: 1 - aCourt is a fight floor\'s clipped triangle, in the court frame\n');
  out = swap(out, '  vCourt = uOnWalk == 1 ?', '  vCourt = uOnFloor == 1 ? aCourt : uOnWalk == 1 ?');
  out = swap(out, 'vWorld = uCentre + vec3(vCourt.x, uLift, vCourt.y);', 'vWorld = uCentre + vec3(vCourt.x, uFloorY + uLift, vCourt.y);');
  return out;
}
/** EG-ZG: the Spire's vertex stage (spireTelegraphVs over the gate's). */
export const TELEGRAPH_VS_SPIRE = spireTelegraphVs(TELEGRAPH_VS);
/** EG-G2: the Spire's fragment stage (spireTelegraphFs over the gate's). */
export const TELEGRAPH_FS_SPIRE = spireTelegraphFs(TELEGRAPH_FS);
/** SHADER-STALL: the pass's one program, the gate's or (`spire`) the Spire's, as its constructor builds it - what a host
 *  starts ahead of the build (render/glProgram.js startPrograms).
 *  @param {boolean} spire @returns {ReadonlyArray<readonly [string, string]>} */
export const telegraphPrograms = (spire) => [spire ? [TELEGRAPH_VS_SPIRE, TELEGRAPH_FS_SPIRE] : [TELEGRAPH_VS, TELEGRAPH_FS]];
/** EG-G2: what the Spire's pass draws a shape with when the shape says nothing: no fog floor, the whole fill, no bits. */
const NO_FOG_FLOOR = Object.freeze([0, 0, 1]);

export class GateTelegraphRenderer {
  /** @param {WebGL2RenderingContext} gl @param {{ spire?: boolean }} [o] - EG-G2: `spire`, the Spire's stage (TELEGRAPH_FS_SPIRE; EG-ZG: and
   *  TELEGRAPH_VS_SPIRE - the fight floors' triangles at their own heights) */
  constructor(gl, { spire = false } = {}) {
    this.gl = gl;
    this.spire = !!spire;
    const [[vs, fs]] = telegraphPrograms(this.spire);
    const prog = buildProgram(gl, vs, fs);
    this.program = prog;
    this.u = {};
    for (const n of ['uVP', 'uCentre', 'uCourt', 'uLo', 'uHi', 'uLift', 'uKind', 'uOrigin', 'uYaw', 'uR', 'uHalfArc', 'uBody', 'uEnd', 'uHalfW', 'uR0', 'uR1', 'uPts', 'uCount',
      'uT', 'uFlash', 'uAlpha', 'uColor', 'uEdgeCol', 'uFloorR', 'uStyle', 'uSince', 'uSpan', 'uAfter', 'uPool', 'uRunS', 'uLineW', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos',
      'uOnWalk', 'uWalkA', 'uWalkU', 'uWalkLen', 'uWalkC0', 'uWalkC1', 'uStrip', 'uStripW', ...(this.spire ? ['uFogFloor', 'uFillK', 'uLook', 'uFloorY', 'uOnFloor'] : [])]) this.u[n] = gl.getUniformLocation(prog, n);
    /** EG-ZG: the fight floors' clipped triangles - one dynamic buffer a frame (the Spire's alone), and its size */
    this.floorVao = null; this.floorVbo = null; this.floorCap = 0;
    /** EG-ZG: how many shape-floor draws the last drawFloors made, and how many of them on a floor's own triangles */
    this.floorDraws = 0; this.floorTris = 0;
    const verts = telegraphQuad();
    this.count = verts.length / 2;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this.vao = vao;
    // AUDIT WB9 (court F4): the walkways' strip, one quad for all of them
    const walkVao = gl.createVertexArray();
    gl.bindVertexArray(walkVao);
    this.walkVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.walkVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(TELEGRAPH_WALK_QUAD), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this.walkVao = walkVao;
    /** how many walkway strips the last draw laid it over, for the tests */
    this.walked = 0;
    this._vp = new Float32Array(16);
    this._pts = new Float32Array(TELEGRAPH_POINTS_MAX * 2);
    /** whether the last draw put a shape down, for the stats and the tests */
    this.drawn = 0;
  }

  /**
   * Draw one attack's shape (`telegraphShape`'s answer; null draws nothing and touches nothing) over the court it names
   * (WB9b: `shape.court`; -1 - the whole arena's - over each court in turn; WB13a: over its own ground there, not the
   * whole court), the first court's centre standing at `centre` in the scene, `seconds` any clock (the shapes run on
   * their own), `fog` the frame's fog as the renderer set it ({ mode,
   * density, range, color, camPos }; none draws unfogged). AUDIT WB9 (court F4): `walks` - how far each walkway is laid
   * (0..1, net/gate/gateBrain.js walkFormed; none, none drawn) - and the shape goes on over the laid stretch of each walkway
   * its court joins (the whole arena's, of every one): a blow at the rim reaches the walkway past it, and strikes there.
   */
  draw(shape, proj, view, eye, seconds, fog = null, centre = COURT_CENTRE, walks = null, floor = null) {
    // SD8d: another floor than the Burning Court's - `floor` { r, courts } (the Brass Remnant's arena: one floor, its
    // centre the frame's origin); the court's own by default. WB14b: `ks` the night's floors among them (net/gate/gateBrain.js
    // nightPlan) - the whole arena's shape is drawn over those alone (a portent's platform stands only on its night)
    const floorCourts = floor?.courts ?? COURTS, floorR = floor?.r ?? COURT_R, floorKs = floor ? floor.ks ?? null : PLAN_PLAIN.floors;
    this.drawn = 0;
    this.walked = 0;
    if (!shape || !(shape.alpha > 0.001) || !this.gl) return;   // AUDIT EG V (L6-5): a destroyed pass draws nothing
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform3f(U.uCentre, centre[0], centre[1], centre[2]);
    gl.uniform1i(U.uStyle, shape.style ?? 0);   // WB9e
    gl.uniform1f(U.uSince, shape.since ?? 0);
    gl.uniform1f(U.uSpan, shape.span ?? 1);
    gl.uniform1f(U.uAfter, shape.after ?? -1);
    gl.uniform1i(U.uPool, shape.pool === true ? TELEGRAPH_POOL.ground : (shape.pool | 0));   // WB9d; WB13a: a path's dashes
    gl.uniform1f(U.uRunS, shape.runS ?? 0);   // WB13a
    gl.uniform1f(U.uLineW, telegraphLineW(gl.drawingBufferHeight));
    gl.uniform1f(U.uLift, TELEGRAPH_LIFT);
    gl.uniform1i(U.uKind, shape.kind);
    gl.uniform2f(U.uOrigin, shape.origin[0], shape.origin[1]);
    gl.uniform1f(U.uYaw, shape.yaw);
    gl.uniform1f(U.uR, shape.r);
    gl.uniform1f(U.uHalfArc, shape.halfArc);
    gl.uniform1f(U.uBody, shape.body);
    gl.uniform2f(U.uEnd, shape.end[0], shape.end[1]);
    gl.uniform1f(U.uHalfW, shape.halfW);
    gl.uniform1f(U.uR0, shape.r0);
    gl.uniform1f(U.uR1, shape.r1);
    this._pts.fill(0);
    shape.points.forEach((p, i) => { this._pts[i * 2] = p[0]; this._pts[i * 2 + 1] = p[1]; });
    gl.uniform2fv(U.uPts, this._pts);
    gl.uniform1i(U.uCount, shape.kind === TELEGRAPH_KIND.spokes || shape.kind === TELEGRAPH_KIND.wedges ? (shape.n ?? 0) : shape.points.length);   // WBX5: the spokes' count rides the points' slot (WB14a: and the wedges')
    gl.uniform1f(U.uT, shape.t);
    gl.uniform1f(U.uFlash, shape.flash);
    gl.uniform1f(U.uAlpha, Math.min(1, shape.alpha));
    gl.uniform3fv(U.uColor, shape.color);
    gl.uniform3fv(U.uEdgeCol, shape.edge ?? TELEGRAPH_EDGE);   // WB13a
    gl.uniform1f(U.uFloorR, floorR);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye ?? centre);
    if (this.spire) { const ff = shape.fogFloor ?? NO_FOG_FLOOR; gl.uniform3f(U.uFogFloor, ff[0], ff[1], ff[2]); gl.uniform1f(U.uFillK, shape.fillK ?? 1); gl.uniform1i(U.uLook, shape.look ?? 0); }   // EG-G2
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);   // WB13a: light added, the floor under a fill darkened - the frame's alpha untouched
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
    // WB9b: over its court - or, the whole arena's, over each of them; WB13a: over its own ground there
    const one = Number.isInteger(shape.court) && shape.court >= 0, k0 = one ? (floorCourts[shape.court] ? shape.court : 0) : 0, k1 = one ? k0 + 1 : floorCourts.length;
    gl.uniform1i(U.uOnWalk, 0);
    // AOE-PERF: a path's or a tether's quad is its own strip (telegraphStrip) - the walkways' quad, laid along it. Never
    // over a fight floor's own triangles (EG-ZG's drawFloors lends them as this.vao): they are its ground already, and the
    // strip's quad read as one (uOnFloor) would lie at the court's origin
    const strip = this.floorVao && this.vao === this.floorVao ? null : telegraphStrip(shape);
    if (strip) {
      gl.bindVertexArray(this.walkVao);
      gl.uniform1i(U.uStrip, 1); gl.uniform1f(U.uStripW, strip.w);
      gl.uniform2f(U.uWalkA, strip.a[0], strip.a[1]); gl.uniform2f(U.uWalkU, strip.u[0], strip.u[1]); gl.uniform1f(U.uWalkLen, strip.len);
    }
    for (let k = k0; k < k1; k++) {
      if (!one && floorKs && !floorKs.includes(k)) continue;
      const q = telegraphQuadOver(shape, k, floorCourts, floorR);
      if (!q) continue;
      gl.uniform2f(U.uCourt, floorCourts[k][0], floorCourts[k][1]);
      gl.uniform2f(U.uLo, q[0], q[1]); gl.uniform2f(U.uHi, q[2], q[3]);
      gl.drawArrays(gl.TRIANGLES, 0, strip ? TELEGRAPH_WALK_QUAD.length / 2 : this.count);
      this.drawn++;
    }
    if (strip) { gl.uniform1i(U.uStrip, 0); gl.bindVertexArray(this.vao); }
    // AUDIT WB9 (court F4): on over the walkways its courts join, as far as each is laid - never his mark (he stands in his court)
    if (Array.isArray(walks) && shape.kind !== TELEGRAPH_KIND.mark) {
      let on = false;
      for (const w of WALKS) {
        const f = walks[w.k];
        if (!(f > 0) || (one && w.a !== k0 && w.b !== k0)) continue;   // WB14b: a walkway by its two floors
        if (!on) { on = true; gl.bindVertexArray(this.walkVao); gl.uniform1i(U.uOnWalk, 1); gl.uniform2f(U.uCourt, COURTS[k0][0], COURTS[k0][1]); }
        gl.uniform2f(U.uWalkA, w.ax, w.az);
        gl.uniform2f(U.uWalkU, w.ux, w.uz);
        gl.uniform1f(U.uWalkLen, w.len * Math.min(1, f));
        gl.uniform2f(U.uWalkC0, COURTS[w.a][0], COURTS[w.a][1]);
        gl.uniform2f(U.uWalkC1, COURTS[w.b][0], COURTS[w.b][1]);
        gl.drawArrays(gl.TRIANGLES, 0, TELEGRAPH_WALK_QUAD.length / 2);
        this.walked++;
      }
      if (on) gl.uniform1i(U.uOnWalk, 0);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(0, 0);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  /**
   * EG-ZG (2026-10-12; bible/11-Multiplayer/Elite-Gates.md section 11.7 - EG6b): THE TELEGRAPHS PER FIGHT FLOOR, the
   * Spire's stage alone. `plan` world/eliteGates/egTelegraph.js egFloorPlan's answer - `{ draws, buf, n }`: the frame's clipped floor
   * triangles in one buffer (uploaded once here) and each shape-floor draw in THE TELEGRAPH BUDGET's order, mine last.
   * A floor's draw is the gate's own `draw` over that floor's triangles at its height (this pass's vertex array and count
   * lent to the floor's for the call, the floor's circle its court - `f.over` - so its rim, the ring's and the spokes'
   * reach, are that floor's); a shape with its own surface (`sh.y`) is the gate's quad at that height over its own circle
   * (`over`), and in a hall with no fight floor over the hall's court (`plan.over`). Nothing else moves.
   */
  drawFloors(plan, proj, view, eye, seconds, fog = null, centre = COURT_CENTRE) {
    this.floorDraws = 0; this.floorTris = 0;
    if (!this.spire || !plan?.draws?.length || !this.gl) return;
    const gl = this.gl, U = this.u;
    if (plan.n > 0) {
      if (!this.floorVao) {
        this.floorVao = gl.createVertexArray();
        gl.bindVertexArray(this.floorVao);
        this.floorVbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.floorVbo);
        gl.enableVertexAttribArray(0);
        gl.bindVertexArray(null);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.floorVbo);
      if (plan.n > this.floorCap) { this.floorCap = plan.buf.length; gl.bufferData(gl.ARRAY_BUFFER, this.floorCap * 4, gl.DYNAMIC_DRAW); }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, plan.buf.subarray(0, plan.n));
    }
    const vao = this.vao, count = this.count;
    try {
      for (const d of plan.draws) {
        gl.useProgram(this.program);
        if (d.f) {
          gl.bindVertexArray(this.floorVao);
          gl.bindBuffer(gl.ARRAY_BUFFER, this.floorVbo);
          gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, d.first * 8);
          gl.bindVertexArray(null);
          gl.uniform1i(U.uOnFloor, 1); gl.uniform1f(U.uFloorY, d.f.y);
          this.vao = this.floorVao; this.count = d.count;
          this.draw(d.sh, proj, view, eye, seconds, fog, centre, null, d.f.over);
          this.floorTris += this.drawn;
        } else {
          gl.uniform1i(U.uOnFloor, 0); gl.uniform1f(U.uFloorY, Number.isFinite(d.sh.y) ? d.sh.y : 0);
          this.vao = vao; this.count = count;
          this.draw(d.sh, proj, view, eye, seconds, fog, centre, null, d.over ?? plan.over ?? null);
        }
        this.floorDraws += this.drawn > 0 ? 1 : 0;
      }
    } finally {
      this.vao = vao; this.count = count;
      gl.useProgram(this.program);
      gl.uniform1i(U.uOnFloor, 0); gl.uniform1f(U.uFloorY, 0);   // the gate's quad at the hall's floor again, for any plain draw after
    }
  }

  /**
   * AUDIT EG V (L6-5; Elite-Gates.md sections 11.9 and 29, EVERY ALLOCATION HAS AN OWNER): every GL object this pass made let
   * go - its program, its three vertex arrays and their buffers (the quad's, the walkways' strip, EG-ZG's fight floors' growing
   * DYNAMIC buffer) - once; a destroyed pass draws nothing. The breach's fight frees its own at every way out of the Spire
   * (scenes/eliteGates/egFight.js leave); the Burning Court's and the Hour's are a screen's, kept.
   */
  destroy() {
    const gl = this.gl;
    if (!gl) return;
    this.gl = null;
    for (const v of [this.vao, this.walkVao, this.floorVao]) if (v) gl.deleteVertexArray(v);
    for (const b of [this.vbo, this.walkVbo, this.floorVbo]) if (b) gl.deleteBuffer(b);
    if (this.program) gl.deleteProgram(this.program);
    this.vao = null; this.walkVao = null; this.floorVao = null; this.vbo = null; this.walkVbo = null; this.floorVbo = null; this.program = null; this.floorCap = 0;
  }
}
