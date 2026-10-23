// @ts-check
// WB4 (2026-09-25, Mac: "an oversized enemy with telegraphed attacks (like wind ups, etc)"): WHERE AN ATTACK LANDS -
// the shapes net/gate/gateBrain.js's ATTACKS name, tested against a point on the court, the telegraph's clock, and the
// verdict a struck player's machine reaches at the landing. Design: bible/11-Multiplayer/World-Bosses.md section 5
// ("Its attacks - every one telegraphed").
//
// CO-OP'S LAW, the struck player's own machine: the relay says an attack's word once (`atk` - which, when it lands on
// the relay's clock, where he stood, his facing, its targets) and every client draws its shape and, at the landing,
// tests ITS OWN FEET against it. A hit takes `pct` of the struck player's own maximum health, `el` its element (fire
// honours the game's own saving throw) - so a level-1 and a level-30 read the same fight. The relay never learns who
// was struck; it did not need to.
//
// PURE: an attack's word and a point in, a verdict out. The court's frame (net/gate/gateBrain.js): metres about the court's
// centre, a facing `atan2(dx, dz)`. WB8b: and the fight's profile (net/gate/gateBrain.js fightProfile - his marks: his body's
// size, each attack's reach, element, name, ground and weight), the Warden unmarked when none is given.
//
// Not a DFU member. Ledger A (WB).
import { ATTACK_BY_ID, ATTACKS, BASE_PROFILE, windupOf, isDagons, HOST_BLOWS, CHAIN_HOLD_M, CHAIN_PULL_TO_M, CHAIN_PULL_MAX_M, GAZE_HALF_DEG, GAZE_RANGE_M } from './gateBrain.js';
import { segmentDistance } from '../../world/segment.js';   // TAMRIEL2-WORKER: the one segment distance, from a module that imports nothing

/** A landing is decided at the first frame at or past it - and a frame that comes later than this past its span (a
 *  stalled or hidden screen) lets it pass: nobody is struck by what their screen never showed land. */
export const STRIKE_LATE_MS = 400;

const DEG = Math.PI / 180;
const wrap = (a) => { let x = (a + Math.PI) % (2 * Math.PI); if (x < 0) x += 2 * Math.PI; return x - Math.PI; };

/** The distance from (px, pz) to the segment (ax, az)-(bx, bz). */
export { segmentDistance };   // TAMRIEL2-WORKER: declared in world/segment.js, a module that imports nothing (the terrain worker's law)

/** WBX5: the Spokes of Dagon's lanes - `n` segments from where he stood, the first along his facing, each `len` long:
 *  [[ax, az, bx, bz], ...]. Pure. */
export function spokeLanes(atk) {
  const A = ATTACK_BY_ID[atk?.a];
  if (!A || A.shape !== 'spokes') return [];
  const out = [];
  for (let k = 0; k < A.n; k++) {
    const a = atk.yw + (k * 2 * Math.PI) / A.n;
    out.push([atk.x, atk.z, atk.x + Math.sin(a) * A.len, atk.z + Math.cos(a) * A.len]);
  }
  return out;
}

/** WB14a: THE SCYTHING WHEEL'S TURN - +1 or -1 by the attack's own number (`i`: every screen and the relay read the same
 *  way round, and nothing is sent for it). */
export const wheelSpin = (atk) => ((Math.abs(atk?.i | 0) % 2) === 1 ? 1 : -1);
/** WB14a: the Wheel's first blade's bearing at `now` - its facing at the word, turning `spin` radians a second over its
 *  span from the landing (still before it, still after it). Pure. */
export function wheelAngle(atk, now) {
  const A = ATTACKS.wheel;
  const k = Math.max(0, Math.min(A.active, now - atk.at));
  return atk.yw + (wheelSpin(atk) * A.spin * k) / 1000;
}
/** WB14a: the Wheel's blades at `now` - `n` segments from where he stood, the first at wheelAngle, `len` long:
 *  [[ax, az, bx, bz], ...]. Pure. */
export function wheelBlades(atk, now) {
  const A = ATTACKS.wheel, a0 = wheelAngle(atk, now), out = [];
  for (let k = 0; k < A.n; k++) { const a = a0 + (k * 2 * Math.PI) / A.n; out.push([atk.x, atk.z, atk.x + Math.sin(a) * A.len, atk.z + Math.cos(a) * A.len]); }
  return out;
}
const TAU = 2 * Math.PI;
const wrap0 = (a) => ((a % TAU) + TAU) % TAU;
/** WB14a: does the Wheel strike (px, pz) between the frame before (`prev`) and this one (`now`) - a blade swept over it in
 *  between (within half its width, as far as its length reaches)? At his feet, both blades always (his body's reach - the
 *  profile's). The charge's law (chargeStrikes): a slow frame still sweeps what it missed; ahead of a blade is safe until
 *  it gets there. Pure. */
export function wheelStrikes(atk, px, pz, now, prev = -Infinity, P = BASE_PROFILE) {
  const A = ATTACKS.wheel;
  if (ATTACK_BY_ID[atk?.a] !== A || now < atk.at || prev > atk.at + A.active || !Number.isFinite(px) || !Number.isFinite(pz)) return false;
  const dx = px - atk.x, dz = pz - atk.z, d = Math.hypot(dx, dz), half = A.width / 2;
  if (d > A.len + half) return false;
  if (d <= half) return true;   // AUDIT WB14 (SCREEN-6): the blades' roots - his body no wider than they are drawn
  const a0 = wheelAngle(atk, Math.max(prev, atk.at)), a1 = wheelAngle(atk, Math.min(now, atk.at + A.active));
  const slack = wheelSlack(d, A.len, half), phi = Math.atan2(dx, dz);
  for (let k = 0; k < A.n; k++) {
    const off = (k * TAU) / A.n, lo = Math.min(a0, a1) + off - slack, span = Math.abs(a1 - a0) + 2 * slack;
    if (wrap0(phi - lo) <= span) return true;
  }
  return false;
}
/** AUDIT WB14 (SCREEN-6): how far either side of a blade's line a point `d` from its root stands inside the blade drawn - a
 *  capsule `len` long and `half` wide each side: its side out to its length, its round tip past it (where the side's own
 *  slack overstated it - up to 0.68 m struck past the drawn edge). Radians. Pure. */
export function wheelSlack(d, len, half) {
  const side = d <= Math.hypot(len, half) ? Math.asin(Math.min(1, half / d)) : 0;   // its side (the point's foot on the blade)
  const tip = d > len ? Math.acos(Math.max(-1, Math.min(1, (d * d + len * len - half * half) / (2 * d * len)))) : 0;   // its tip's round end
  return Math.max(side, tip);
}
/** WB14a: is (px, pz) in a lit wedge of the Unmaking - every other one of `n` about its heart (tg[0]), the first centred on
 *  its facing, out to `r`? Pure. */
export function inWedges(atk, px, pz, r = ATTACKS.unmake.r) {
  const A = ATTACKS.unmake, c = atk?.tg?.[0];
  if (!c || !Number.isFinite(px) || !Number.isFinite(pz)) return false;
  const dx = px - c[0], dz = pz - c[1];
  if (Math.hypot(dx, dz) > r) return false;
  const per = (2 * TAU) / A.n, a = Math.atan2(dx, dz) - atk.yw;
  return Math.abs(a - per * Math.round(a / per)) <= TAU / (2 * A.n);
}

/**
 * Is the point (px, pz) inside the attack's shape? `atk` is the wire's atk word ({a, x, z, yw, tg}); `P` the fight's
 * profile (WB8b - the reach is the attack's under his marks, his body his own size).
 *   cone   - within `r` of where he stood and `arc` degrees about his facing (his own body's width always in it)
 *   disc   - within `r` of his feet (aim 'self'), of any of its targets (aim 'players') or of its one spot (aim 'point')
 *   lane   - within half its width of the line from where he stood to its end (tg[0]) - the ground his charge runs
 *   ring   - between `r0` and `r1` of where he stood
 *   spokes - WBX5: within half its width of any of its lanes (spokeLanes)
 *   wheel  - WB14a: within half its width of either blade where it stands at its landing (wheelBlades)
 *   wedges - WB14a: in a lit wedge (inWedges)
 *   all    - anywhere
 * WB14a: and nothing for the marked blows - the Chains, the Brand, the Torment - nor the Gaze: who they strike is a
 * question of who is marked, where the others stand and where a camera looks (markedOf, brandOn, tormentShare,
 * chainHolds, gazeHolds), never of the ground.
 * @param {{a: number, x: number, z: number, yw: number, tg: number[][], at?: number}} atk @param {number} px @param {number} pz
 * @param {ReturnType<typeof import('./gateBrain.js').fightProfile>} [P]
 */
export function inAttack(atk, px, pz, P = BASE_PROFILE) {
  const A = ATTACK_BY_ID[atk?.a];
  if (!A || !Number.isFinite(px) || !Number.isFinite(pz)) return false;
  const r = P.atk[A.key].r;
  const dx = px - atk.x, dz = pz - atk.z, d = Math.hypot(dx, dz);
  switch (A.shape) {
    case 'cone': return d <= r && (d <= P.bossR || Math.abs(wrap(Math.atan2(dx, dz) - atk.yw)) <= (A.arc / 2) * DEG);
    case 'disc': return A.aim === 'self' ? d <= r : (A.aim === 'point' ? (atk.tg ?? []).slice(0, 1) : (atk.tg ?? [])).some((p) => Math.hypot(px - p[0], pz - p[1]) <= r);
    case 'lane': { const e = atk.tg?.[0]; return !!e && segmentDistance(px, pz, atk.x, atk.z, e[0], e[1]) <= Math.max(A.width / 2, P.bossR); }   // AUDIT WBX F7: as wide as his body - the charge's own sweep (chargeStrikes), and the telegraph's
    case 'ring': return d >= A.r0 && d <= A.r1;
    case 'spokes': return spokeLanes(atk).some((l) => segmentDistance(px, pz, l[0], l[1], l[2], l[3]) <= A.width / 2);
    case 'wheel': return d <= A.width / 2 || wheelBlades(atk, atk.at).some((l) => segmentDistance(px, pz, l[0], l[1], l[2], l[3]) <= A.width / 2);   // AUDIT WB14 (SCREEN-6): as drawn - no body disc
    case 'wedges': return inWedges(atk, px, pz, r);
    case 'all': return true;
    default: return false;
  }
}

/**
 * WBX5: THE BURNING GROUND an attack's landing leaves (net/gate/gateBrain.js POOLS): one pool under each of its marks
 * (Hellfire's) or at its one spot (the Meteor's), burning from the landing for the pool's span - `[{x, z, r, from, until,
 * pct, base, el}]`, the court's frame. Every screen that saw the landing knows where it burns; nothing is sent. Pure.
 * WB8b: the ground is the profile's - his aspect's element, Scarring's pools under his slam and his leap, its span and
 * its bite under Scarring and Vengeful.
 * @param {any} atk @param {ReturnType<typeof import('./gateBrain.js').fightProfile>} [P]
 */
export function landingPools(atk, P = BASE_PROFILE) {
  const A = ATTACK_BY_ID[atk?.a], G = A ? P.atk[A.key].pool : null;
  if (!G || !Number.isFinite(atk.at)) return [];
  const spots = A.aim === 'point' ? (atk.tg ?? []).slice(0, 1) : A.aim === 'self' ? [[atk.x, atk.z]] : (atk.tg ?? []);
  return spots.map((p) => ({ x: p[0], z: p[1], r: G.r, from: atk.at, until: atk.at + G.ms, pct: G.pct, base: G.base, el: P.el }));
}

/** WBX5: the burning ground under (px, pz) at `now` - the first live pool that holds the point, or null. Pure. */
export function poolUnder(pools, px, pz, now) {
  for (const p of pools ?? []) if (now >= p.from && now < p.until && Math.hypot(px - p.x, pz - p.z) <= p.r) return p;
  return null;
}

/** Where the charge's head stands at `now` - the brain's own run (net/gate/gateBrain.js stepBrain: from where he stood to
 *  the lane's end over the attack's `active` span) - or null outside the run. */
export function chargeHead(atk, now) {
  const A = ATTACK_BY_ID[atk?.a], e = atk?.tg?.[0];
  if (A !== ATTACKS.charge || !e || now < atk.at || now > atk.at + A.active) return null;
  const k = Math.min(1, (now - atk.at) / A.active);
  return [atk.x + (e[0] - atk.x) * k, atk.z + (e[1] - atk.z) * k];
}

/** Does the charge he is running strike (px, pz) between the frame before (`prev`) and this one (`now`) - within the
 *  lane's half-width (his body's at least - WB8b: his profile's) of the ground he ran over in between? The lane ahead of
 *  him is safe until he gets there, and the ground behind him once he has passed; a slow frame still sweeps all it missed. */
export function chargeStrikes(atk, px, pz, now, prev = -Infinity, P = BASE_PROFILE) {
  const A = ATTACKS.charge;
  if (ATTACK_BY_ID[atk?.a] !== A || now < atk.at || prev > atk.at + A.active) return false;
  const a = chargeHead(atk, Math.max(prev, atk.at)), b = chargeHead(atk, Math.min(now, atk.at + A.active));
  if (!a || !b) return false;
  return segmentDistance(px, pz, a[0], a[1], b[0], b[1]) <= Math.max(A.width / 2, P.bossR);
}

/**
 * THE VERDICT on the struck player's machine, at the frame `now` (`prev` the frame before): 'hit', 'miss', or 'wait'
 * (not yet decided). The charge is 'hit' at the frame whose stretch of his run passes over the player, and 'miss' once
 * the run is over; every other attack is decided at the first frame at or past its landing - inside its shape or not.
 * Any landing met later than STRIKE_LATE_MS past its span is a 'miss'. WB8b: under the fight's profile `P`.
 * @param {{a: number, at: number, x: number, z: number, yw: number, tg: number[][]}} atk @param {number} px @param {number} pz
 * @param {number} now @param {number} [prev] @param {ReturnType<typeof import('./gateBrain.js').fightProfile>} [P]
 * @returns {'hit'|'miss'|'wait'}
 */
export function strikeVerdict(atk, px, pz, now, prev = -Infinity, P = BASE_PROFILE) {
  const A = ATTACK_BY_ID[atk?.a];
  if (!A || !Number.isFinite(atk.at) || isMarkedBlow(A)) return 'miss';   // WB14a: a marked blow's is markedVerdict's
  if (now < atk.at) return 'wait';
  if (now > atk.at + Math.max(A.active, 1) + STRIKE_LATE_MS) return 'miss';
  if (A === ATTACKS.charge) return chargeStrikes(atk, px, pz, now, prev, P) ? 'hit' : now >= atk.at + A.active ? 'miss' : 'wait';
  if (A === ATTACKS.wheel) return wheelStrikes(atk, px, pz, now, prev, P) ? 'hit' : now >= atk.at + A.active ? 'miss' : 'wait';   // WB14a: the charge's law, turning
  return inAttack(atk, px, pz, P) ? 'hit' : 'miss';
}

// ═══ WB14a: THE MARKED BLOWS ═════════════════════════════════════════════════════════════════════════════════════════
//
// The Chains, the Brand and the Torment strike by who they mark (the atk word's `pk`, peer ids - where each stood at the
// word, `tg`, beside them) and where the others stand on the struck screen (scenes/gate/gateCourt.js stepsIn: the online
// frame's own places); the Gaze by where the struck screen's camera looks. All the struck screen's, as every blow; none of
// them the relay's to count (net/bossRef.js judgeGate).

/** WB14a: an attack's marked fighters, by peer id (none for an attack that marks nobody, or a relay that never named them). */
export const markedOf = (atk) => (Array.isArray(atk?.pk) ? atk.pk : NO_PK);
const NO_PK = Object.freeze([]);
/** WB14a: where the `k`th marked fighter stands on this screen - `me` my own id at `mine` (my feet), else `placeOf(id)` (the
 *  online frame's place of another, the court's frame), else where they stood at the word (`tg[k]`). Pure. */
export function markedAt(atk, k, me, mine, placeOf) {
  const id = markedOf(atk)[k];
  if (id && id === me && mine) return mine;
  const p = id && id !== me ? placeOf?.(id) : null;
  return p ?? atk?.tg?.[k] ?? null;
}
/** WB14a: am I one the attack marks? */
export const markedMe = (atk, me) => !!me && markedOf(atk).includes(me);
/** WB14a: does the chain hold me as it lands - within CHAIN_HOLD_M of where he stood? */
export const chainHolds = (atk, px, pz) => Number.isFinite(px) && Number.isFinite(pz) && Math.hypot(px - atk.x, pz - atk.z) <= CHAIN_HOLD_M;
/** WB14a: THE CHAIN'S PULL on me - the push (metres a second, the court's frame) that carries me to CHAIN_PULL_TO_M of
 *  him (CHAIN_PULL_MAX_M at most) against the motor's own decay (`decay` - player/motor.js BLOW_PUSH_DECAY: a push of v
 *  runs v*v/(2*decay) metres); none when I stand that near already. Pure. */
export function chainPull(atk, px, pz, decay) {
  const dx = atk.x - px, dz = atk.z - pz, d = Math.hypot(dx, dz);
  const run = Math.min(CHAIN_PULL_MAX_M, d - CHAIN_PULL_TO_M);
  if (!(run > 0) || !(decay > 0)) return null;
  const v = Math.sqrt(2 * decay * run);
  return [(dx / d) * v, (dz / d) * v];
}
/** WB14a: DAGON'S BRAND on me (px, pz) as it lands: `self` I am branded (its own share, `selfPct`); `burst` I stand within its
 *  reach of a branded fighter who is not me (its burst) - each other branded one where this screen sees them (markedAt).
 *  Pure. */
export function brandOn(atk, me, px, pz, placeOf, P = BASE_PROFILE) {
  const r = P.atk.brand.r, pk = markedOf(atk), self = markedMe(atk, me);
  let burst = false;
  const n = Math.max(pk.length, atk?.tg?.length ?? 0);
  for (let k = 0; k < n && !burst; k++) {
    if (pk[k] && pk[k] === me) continue;
    if (!pk[k] && self) continue;   // a relay that named nobody: the ring I stand on is mine
    const p = markedAt(atk, k, me, null, placeOf);
    if (p && Math.hypot(px - p[0], pz - p[1]) <= r) burst = true;
  }
  return { self, burst };
}
/** WB14a: SHARED TORMENT's share on me (px, pz) as it lands: 0 outside its ring, else how many it is shared among - me
 *  and every other this screen sees inside it (`others`, the court's frame), the marked among them. Pure. */
export function tormentShare(atk, me, px, pz, placeOf, others, P = BASE_PROFILE) {
  const c = markedAt(atk, 0, me, [px, pz], placeOf);
  if (!c) return 0;
  const r = P.atk.torment.r;
  if (Math.hypot(px - c[0], pz - c[1]) > r) return 0;
  let k = 1;
  for (const o of others ?? NO_PK) if (o && Math.hypot(o[0] - c[0], o[1] - c[1]) <= r) k++;
  return k;
}
/** WB14a: THE BURNING GAZE on me: within GAZE_RANGE_M of him (bx, bz) and he stands within GAZE_HALF_DEG of my view's
 *  heading - `yaw` the camera's (scenes/world.js cam.yaw: ahead [sin, cos]). No camera, no gaze. Pure. */
export function gazeHolds(bx, bz, px, pz, yaw) {
  if (!Number.isFinite(yaw) || !Number.isFinite(px) || !Number.isFinite(pz)) return false;
  const dx = bx - px, dz = bz - pz, d = Math.hypot(dx, dz);
  if (d > GAZE_RANGE_M) return false;
  if (d < 1e-6) return true;
  const off = Math.atan2(dx, dz) - yaw;
  return Math.abs(wrap(off)) <= (GAZE_HALF_DEG * Math.PI) / 180;
}
/** WB14a: the verdict of a marked blow or the Gaze at the frame `now`: 'wait' before it lands, 'judge' at the first frame
 *  at or past it (the caller weighs it - brandOn, tormentShare, chainHolds, gazeHolds), 'miss' met later than
 *  STRIKE_LATE_MS past its span. Pure. */
export function markedVerdict(atk, now) {
  const A = ATTACK_BY_ID[atk?.a];
  if (!A || !Number.isFinite(atk.at)) return 'miss';
  if (atk.at > now) return 'wait';   // (spelled apart from strikeVerdict's and hostVerdict's - a mutant record aims at each alone)
  return now > atk.at + Math.max(A.active, 1) + STRIKE_LATE_MS ? 'miss' : 'judge';
}
/** WB14a: the attacks whose verdict is markedVerdict's (and never strikeVerdict's ground). */
export const MARKED_SHAPES = Object.freeze(['tether', 'brand', 'torment', 'gaze']);
export const isMarkedBlow = (A) => !!A && MARKED_SHAPES.includes(A.shape);

/** What an attack does to a player it strikes: the share of their own maximum health and the points beside it (WBX4),
 *  its element (null plain), its name, and whether a saving throw answers it (Dagon's Wrath is answered by nothing).
 *  WB8b: all as his profile has them - his aspect's element and names, Vengeful's weight; and ANY element's saving
 *  throw answers it (frost, shock and poison as fire always was). */
export const blowOf = (atk, P = BASE_PROFILE) => {
  const A = ATTACK_BY_ID[atk?.a];
  if (!A) return null;
  const L = P.atk[A.key];
  return { pct: L.pct, base: L.base, el: L.el, name: L.name, saved: L.el != null && !isDagons(A) };   // WB9c: Dagon's Reckoning, as his Wrath, is answered by nothing
};

/** The damage a struck player takes: `pct` of their maximum health and WBX4's `base` points beside it, whole points, at
 *  least one (Dagon's Wrath is more than any health - 999%). */
export const strikeDamage = (pct, maxHealth, base = 0) => Math.max(1, Math.round(pct * Math.max(1, maxHealth) + Math.max(0, base)));

/** An elemental strike's share after the game's own saving throw against its element (combat/spellcast.js savingThrow
 *  answers the percent of an effect that lands, 0..100). WB8b: fire's alone before his aspects - `fireShare` then. */
export const savedShare = (dmg, savePct) => Math.trunc((dmg * Math.max(0, Math.min(100, savePct))) / 100);

/**
 * The telegraph's clock: how far through its wind-up the attack stands at `now` (0 at the word, 1 at the landing),
 * whether it is landing now (the landing's own span, `active`), and whether it is over. The wind-up is its phase's
 * (net/gate/gateBrain.js windupOf - phase three's are shorter).
 * @param {{a: number, at: number}} atk @param {number} phase @param {number} now the relay's clock
 */
export function telegraphAt(atk, phase, now) {
  const A = ATTACK_BY_ID[atk?.a];
  if (!A || !Number.isFinite(atk.at)) return null;
  const w = windupOf(A, phase), span = Math.max(A.active, 1);
  const t = w > 0 ? Math.max(0, Math.min(1, (now - (atk.at - w)) / w)) : 1;
  return { t, landing: now >= atk.at && now < atk.at + span, over: now >= atk.at + span, key: A.key, since: now - atk.at };
}

/**
 * WB11b: A BLOW OF HIS HOST'S, judged on the struck player's machine at the frame `now` - co-op's law, as his own blows
 * are: its disc (net/gate/gateBrain.js HOST_BLOWS - a Harrier's Bite, a Ward-Bearer's Pulse, by the kind `k` that strikes it)
 * about where it was laid (`atk` - the wire's `aatk`: when it lands, the disc's centre), decided at the first frame at or
 * past its landing - 'hit', 'miss', or 'wait'; met later than STRIKE_LATE_MS past its span, a 'miss'. Pure.
 * @param {{at: number, x: number, z: number}|null} atk @param {number} k @param {number} px @param {number} pz @param {number} now
 * @returns {'hit'|'miss'|'wait'}
 */
export function hostVerdict(atk, k, px, pz, now) {
  const B = HOST_BLOWS[k];
  if (!B || !atk || !Number.isFinite(atk.at)) return 'miss';
  if (!(now >= atk.at)) return 'wait';   // (spelled apart from strikeVerdict's - a mutant record aims at that one alone)
  if (now > atk.at + Math.max(B.active, 1) + STRIKE_LATE_MS) return 'miss';
  return Number.isFinite(px) && Number.isFinite(pz) && Math.hypot(px - atk.x, pz - atk.z) <= B.r ? 'hit' : 'miss';
}
/** WB11b: a host blow's clock at `now` (the relay's): its wind-up's share (0 at its word, 1 at its landing), whether it is
 *  landing, whether it is over, and how long since it landed - the telegraph's and the body's. Null for no blow. Pure. */
export function hostTelegraphAt(atk, k, now) {
  const B = HOST_BLOWS[k];
  if (!B || !atk || !Number.isFinite(atk.at)) return null;
  const span = Math.max(B.active, 1);
  return { t: Math.max(0, Math.min(1, (now - (atk.at - B.windup)) / B.windup)), landing: now >= atk.at && now < atk.at + span, over: now >= atk.at + span, since: now - atk.at, key: B.key };
}
