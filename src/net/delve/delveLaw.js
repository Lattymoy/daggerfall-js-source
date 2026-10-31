// @ts-check
// DELVE II (bible/03-World/Delve-II.md; the owner, 2026-10-28: "a wave based encounter, or puzzle solving like you find in
// some of our world events (not the clock puzzle)"): THE ENCOUNTER'S LAW - the kinds, their numbers, the pieces' spots on a
// site's floor and the ledger one started site keeps. Pure: the moment, the words and the party handed in, events out, so
// the client runs it offline and the relay runs it online (DLV3) on the same state. Not a DFU member (Ledger A: DELVE II).
import { gateHash } from '../gate/gateLaw.js';
import { starClearFloorMs, STAR_KILL_MIN_MS, STAR_LIGHT, STAR_BLOW_LIGHT, STAR_BREATH_LIGHT, STAR_BLOWS_HZ, STAR_BLOWS_BURST } from '../starfall/starfallLaw.js';
import { dpsRef, crystalHpFor, spendBlow, spendPurse, BUCKET_DEPTH_X, GATE_HIT_HZ_MAX, HOST_HP_MIN, MELEE_REACH, POSE_SLACK, HIT_KINDS } from '../gate/gateBrain.js';
import { ktLeastMs, KT_CARRY_PACE } from '../ketch/ketchBrain.js';

// ═══ THE KINDS ═══════════════════════════════════════════════════════════════════════════════════════════════════════
/** Each kind: its number on the wire and in the plan's hash, and its family. Its floor is the site's (delveSites.js). */
export const DELVE_KINDS = Object.freeze({
  hold: Object.freeze({ id: 1, family: 'wave' }),
  litany: Object.freeze({ id: 2, family: 'puzzle' }),
  wellsprings: Object.freeze({ id: 3, family: 'wave' }),
  vigil: Object.freeze({ id: 4, family: 'wave' }),
  brazier: Object.freeze({ id: 5, family: 'puzzle' }),
  weighing: Object.freeze({ id: 6, family: 'puzzle' }),
  seals: Object.freeze({ id: 7, family: 'puzzle' }),
});
/** The kinds, in their numbers' order. */
export const DELVE_KIND_NAMES = Object.freeze(Object.keys(DELVE_KINDS).sort((a, b) => DELVE_KINDS[a].id - DELVE_KINDS[b].id));
/** The families a dungeon of two sites or more holds one of each. */
export const DELVE_FAMILIES = Object.freeze(['wave', 'puzzle']);
/** A kind by name, or null. */
export const delveKind = (name) => (typeof name === 'string' && Object.hasOwn(DELVE_KINDS, name) ? DELVE_KINDS[name] : null);
/** A kind's name by its number on the wire, or null. */
export const delveKindById = (id) => DELVE_KIND_NAMES.find((k) => DELVE_KINDS[k].id === id) ?? null;
/** Whether a kind is fought in waves: it fails when the party leaves it, and only stands where foes can. */
export const isWaveKind = (kind) => delveKind(kind)?.family === 'wave';
/** The kinds whose vault stands at the heart, inside their pieces' ring; every other kind's stands at a wall. */
export const DELVE_HEART_VAULTS = Object.freeze(['litany', 'seals']);

// ═══ THE PARTY AND THE PACE ══════════════════════════════════════════════════════════════════════════════════════════
export const DELVE_PARTY_MAX = 8;
/** A party's count held to one to eight (law 3). */
export const delveParty = (n) => Math.max(1, Math.min(DELVE_PARTY_MAX, Number.isFinite(n) ? Math.floor(n) : 1));
/** THE DELVE PACE (law 7): a weak character's run - player/motor.js runSpeed(30, 5), pinned equal by the test. */
export const DELVE_PACE_MPS = ((30 + 150) / 39.5) * (1.35 + 5 / 200);
/** THE ERRAND FLOOR at the delve pace: a route (m) walked at DELVE_PACE_MPS, and 1.5 s more, ceiled to 10 ms. */
export const delveErrandMs = (routeM) => Math.ceil(((Math.max(0, routeM) / DELVE_PACE_MPS + 1.5) * 1000) / 10) * 10;
/** A carried piece slows its carrier to this of their pace (THE BURDEN - the Ketch's carry, net/ketch/ketchBrain.js). */
export const DELVE_BURDEN = KT_CARRY_PACE;
/** How near a member walks to a piece to take it, set it down or light it (m, on its storey). */
export const DELVE_REACH_M = 1.2;
/** A weight's box, half its width (m): what the press's ray meets (scenes/delve/delveHost.js). */
export const DELVE_WEIGHT_HALF_M = 0.45;
/** A weight is taken by a press, so as far as a press reaches: DFU's treasure distance, 128 units (3.2 m from the eye to
 *  its box - player/activate.js TREASURE_ACTIVATION_DISTANCE), and the box's half, from the feet to its spot on the flat.
 *  At DELVE_REACH_M a press from 2 m took nothing, and said nothing (DLV4's probe). The law imports no player code: the
 *  two are pinned equal by test. */
export const DELVE_PRESS_M = 3.2 + DELVE_WEIGHT_HALF_M;

// ═══ THE LEDGER'S CLOCKS ═════════════════════════════════════════════════════════════════════════════════════════════
/** A member's word counts it present at the site this long. */
export const DELVE_PRESENT_MS = 15_000;
/** Every member of the party out of the ward this long ends a wave's attempt (law 2: nobody is held in). */
export const DELVE_LEAVE_MS = 30_000;
/** The owning party silent at the site this long, a puzzle's ledger is let go and the site is free. */
export const DELVE_LET_GO_MS = 60_000;
/** Stood at the site within this of the win: earned (section 7). */
export const DELVE_EARN_MS = 15_000;
/** The member standing the foes is believed while heard within this (the Starfall's orphan rule). */
export const DELVE_ORPHAN_MS = 10_000;

// ═══ THE HOLD ════════════════════════════════════════════════════════════════════════════════════════════════════════
export const HOLD_WAVES = 3;
/** The ward rises this long (encounter clock) before the first wave. */
export const HOLD_GATHER_MS = 4_000;
/** STAR-TUNE's lesson ("The time between waves is too long"): five seconds between waves. */
export const HOLD_BREATH_MS = 5_000;
/** A wave that runs this long gives way to the next, cleared or not. */
export const HOLD_WAVE_MAX_MS = 90_000;
/** The most a wave holds: one grant of its kind (section 7). */
export const HOLD_WAVE_MAX = 12;
/** A wave's size: three for one member and two for each beside it, one more each wave on - three to twelve. Pure. */
export const holdWaveSize = (w, n) => Math.min(HOLD_WAVE_MAX, 3 + 2 * (delveParty(n) - 1) + Math.max(0, (w | 0) - 1));
/** The captain's fall is believed no sooner than one kill's least time after it stands (the Starfall's STAR_KILL_MIN_MS,
 *  encounter clock): a fall a player saw is said at once, and a word faster than any blow is not believed. */
export const HOLD_CAPTAIN_MIN_MS = STAR_KILL_MIN_MS;
/** The captain not fallen this long after it stands, the attempt ends (every phase ends on the encounter clock). */
export const HOLD_CAPTAIN_MAX_MS = 300_000;
/** The captain's boss traits: one, two in an Elite dungeon (BOSS-TRAITS). An Abyss dungeon stands no site. */
export const holdCaptainTraits = (tier) => (tier === 'elite' ? 2 : 1);

// ═══ THE LITANY ══════════════════════════════════════════════════════════════════════════════════════════════════════
/** The plates: four, five in an Elite dungeon. */
export const litanyCount = (tier) => (tier === 'elite' ? 5 : 4);
/** The plates' ring about the site's heart (m), and how near a member stands to stand on one (m). */
export const LITANY_RING_M = 2.5;
export const LITANY_STAND_M = 1.2;
/** Each plate of the order is shown this long, and the order's end held one step more. */
export const LITANY_SHOW_STEP_MS = 1_000;
/** The show's length for `k` plates (ms). */
export const litanyShowMs = (k) => (k + 1) * LITANY_SHOW_STEP_MS;
/** In an Elite dungeon a wrong plate wakes this many foes of the table. */
export const LITANY_WAKE = 2;

// ═══ THE WELLSPRINGS ═════════════════════════════════════════════════════════════════════════════════════════════════
/** Two to four sources, drawn off the dungeon's seed and the site: the same for every visitor. */
export const SPRING_MIN = 2;
export const SPRING_MAX = 4;
const SPRING_SALT = 0x5357;
export const springCount = (seed, i) => SPRING_MIN + (gateHash(seed >>> 0, i, SPRING_SALT) % (SPRING_MAX - SPRING_MIN + 1));
/** Each source pours a foe this often (encounter clock, the first as the sources stand), three of its own alive at most. */
export const SPRING_POUR_MS = 12_000;
export const SPRING_ALIVE = 3;
/** A source's health: SPRING_TEAM_S seconds of the reference damage of the party in the ward as they stand (the Spire's
 *  egHpTeam rule, one body - net/eliteGates/egBodies.js), at least the gate's HOST_HP_MIN. Pure. */
export const SPRING_TEAM_S = 12;
export const springHp = (lvs) => Math.max(HOST_HP_MIN, Math.round(SPRING_TEAM_S * (lvs ?? []).reduce((s, lv) => s + dpsRef(lv), 0)));
/** The sources not broken this long after they stand, the attempt ends. */
export const SPRING_MAX_MS = 300_000;
/** A source's body (m): a blow's reach is measured to it. */
export const SPRING_R = 0.8;
export const SPRING_H = 1.6;

// ═══ THE VIGIL ═══════════════════════════════════════════════════════════════════════════════════════════════════════
/** The relic's light, a foe's landed blow's cost and a breath's return: the Starfall's star, a relic at the heart. */
export const VIGIL_LIGHT = STAR_LIGHT;
export const VIGIL_BLOW_LIGHT = STAR_BLOW_LIGHT;
export const VIGIL_BREATH_LIGHT = STAR_BREATH_LIGHT;
/** The light lost, the site rests this long before it wakes again (the respawn breath). */
export const VIGIL_REST_MS = 60_000;
/** The relic's height (m), its body for the foes that hunt it. */
export const VIGIL_RELIC_H = 1.4;

// ═══ THE BRAZIER RITE ════════════════════════════════════════════════════════════════════════════════════════════════
/** Three braziers, four for a party of four or more (counted as the rite wakes). Pure. */
export const braziersFor = (n) => (delveParty(n) >= 4 ? 4 : 3);
/** A flame lives this long off the heart (wall time from its take there: a fall and a taking up again do not renew it,
 *  and a carrier gone silent loses it); one let fall lies this long to be taken up again. */
export const FLAME_LIFE_MS = 20_000;
export const FLAME_LIES_MS = 10_000;
/** Where the flame is: at the heart, carried, or lying where its carrier let it fall. */
export const FLAME = Object.freeze({ heart: 0, carried: 1, lying: 2 });
/** Foes of the table drift in while the rite is worked: two alive at most, one more this often. */
export const DRIFT_MAX = 2;
export const DRIFT_EVERY_MS = 15_000;
/** A rite or the seals rise this long before they can be worked (the party counted at its end). */
export const PUZZLE_RISE_MS = 3_000;

// ═══ THE WEIGHING ════════════════════════════════════════════════════════════════════════════════════════════════════
/** Three plates on the axes the vault does not stand on, 3 m from the heart; three stone weights at the ward's gates. */
export const WEIGH_RING_M = 3;
export const WEIGHTS = 3;
/** All three held this long (encounter clock) opens the vault. */
export const WEIGH_HOLD_MS = 3_000;
/** A member stands on a plate while its last word from it is this fresh. */
export const WEIGH_FRESH_MS = 2_500;
/** Where a weight is: at its home, carried, on a plate, or set down on the floor. */
export const WEIGHT = Object.freeze({ home: 0, carried: 1, plate: 2, floor: 3 });

// ═══ THE SEALS ═══════════════════════════════════════════════════════════════════════════════════════════════════════
/** Three to six seals, `2 + ceil(n / 2)` for the party in the ward as they rise, 3 m about the heart. Pure. */
export const sealCount = (n) => Math.min(6, 2 + Math.ceil(delveParty(n) / 2));
export const SEAL_RING_M = 3;
/** Their health: Dagon's crystals' law (net/gate/gateBrain.js crystalHpFor) - the party's eight seconds between them. */
export const sealHp = (lvs, k) => crystalHpFor(lvs ?? [], k);
/** The window: this long to break them, and the route between them walked at the delve pace (law 7). MEASURED: a
 *  level-1 character's own blows land 2.5 a second (tools/delveProbe.mjs --dps), so a solo's three seals - the floor's
 *  20 each - take 24 s of swinging alone; at 24 s the real game never won them (DLV4's probe, Delve-II.md section 14). */
export const SEAL_WORK_MS = 40_000;
/** Failed, they sink, and rise again this long after. */
export const SEAL_SINK_MS = 10_000;
export const SEAL_R = 0.7;
export const SEAL_H = 1.8;

// ═══ THE PIECES' SPOTS ═══════════════════════════════════════════════════════════════════════════════════════════════
// Every bearing a literal (dungeonFires.js ringOf's rule: no sine, whose last bit is an engine's own), and every spot
// rounded to the centimetre, so every client and the relay stand the same pieces on the same floor.
const R2 = Math.SQRT1_2;
const BEARINGS4 = Object.freeze([[0, 1], [1, 0], [0, -1], [-1, 0]]);
const BEARINGS5 = Object.freeze([[0, 1], [0.951057, 0.309017], [0.587785, -0.809017], [-0.587785, -0.809017], [-0.951057, 0.309017]]);
const DIAGONALS = Object.freeze([[R2, R2], [R2, -R2], [-R2, -R2], [-R2, R2]]);
/** The eight bearings round from north, and the seals' places among them for each count. */
const RING8 = Object.freeze([[0, 1], [R2, R2], [1, 0], [R2, -R2], [0, -1], [-R2, -R2], [-1, 0], [-R2, R2]]);
const SEAL_SLOTS = Object.freeze({ 3: [0, 3, 5], 4: [0, 2, 4, 6], 5: [0, 2, 3, 5, 6], 6: [0, 1, 3, 4, 5, 7] });
const SPRING_GATES = Object.freeze({ 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] });
const cm = (v) => Math.round(v * 100) / 100;
/** A site as the site law plans it (world/dungeon/delveSites.js): its index, kind, heart, radius, tier and vault's spot.
 *  @typedef {{ i: number, kind: string, x: number, y: number, z: number, r: number, tier: string, vault: number[] }} DelveSite */

/** The Litany's plates, `[x, y, z]`, in their ring's order - its bearings' table. Pure. @param {DelveSite} site */
export function litanyPlates(site) {
  const B = litanyCount(site.tier) === 5 ? BEARINGS5 : BEARINGS4;
  return B.map(([dx, dz]) => [cm(site.x + dx * LITANY_RING_M), site.y, cm(site.z + dz * LITANY_RING_M)]);
}
const LITANY_SALT = 0x4c54;
/** THE ORDER: the plates' indices in the order they light - a shuffle drawn off the dungeon's seed and the site. Pure. */
export function litanyOrder(seed, i, k) {
  const out = Array.from({ length: k }, (_, j) => j);
  for (let j = k - 1; j > 0; j--) {
    const pick = gateHash(seed >>> 0, i, j, LITANY_SALT) % (j + 1);
    [out[j], out[pick]] = [out[pick], out[j]];
  }
  return out;
}
/** The Hold's four gates the waves come through, on its diagonals half a metre inside its disc (2.5 m inside the ward).
 *  Pure. @param {DelveSite} site */
export function holdGates(site) {
  const g = site.r - 0.5;
  return DIAGONALS.map(([dx, dz]) => [cm(site.x + dx * g), site.y, cm(site.z + dz * g)]);
}
/** The heart, as a spot. Pure. @param {DelveSite} site */
export const siteHeart = (site) => [site.x, site.y, site.z];
/** The Wellsprings' `k` sources, on the gates (two of them face each other across the ward). Pure. @param {DelveSite} site */
export function springSpots(site, k) {
  const g = holdGates(site);
  return (SPRING_GATES[k] ?? SPRING_GATES[SPRING_MIN]).map((j) => g[j]);
}
/** The Brazier Rite's `k` braziers, on the gates; the flame's source stands at the heart. Pure. @param {DelveSite} site */
export const brazierSpots = (site, k) => holdGates(site).slice(0, Math.max(0, Math.min(4, k | 0)));
/** The axis the vault stands toward (0 north, 1 east, 2 south, 3 west), or -1 for a vault at the heart. Pure. */
export function vaultAxis(site) {
  const v = site.vault ?? [site.x, site.y, site.z], dx = v[0] - site.x, dz = v[2] - site.z;
  if (dx * dx + dz * dz < 0.01) return -1;
  let best = 0;
  for (let j = 1; j < 4; j++) if (BEARINGS4[j][0] * dx + BEARINGS4[j][1] * dz > BEARINGS4[best][0] * dx + BEARINGS4[best][1] * dz) best = j;
  return best;
}
/** The Weighing's three plates: the axes the vault does not stand on, in their order. Pure. @param {DelveSite} site */
export function weighPlates(site) {
  const v = vaultAxis(site);
  return BEARINGS4.filter((_, j) => j !== v).slice(0, 3).map(([dx, dz]) => [cm(site.x + dx * WEIGH_RING_M), site.y, cm(site.z + dz * WEIGH_RING_M)]);
}
/** Where the Brazier Rite's foes drift in: the rim half a metre in on the axes the vault does not take - the gates hold
 *  the braziers' pedestals (AUDIT DLV4 F10), and the site law asked the rim's floor at every bearing. Pure. @param {DelveSite} site */
export function driftSpots(site) {
  const v = vaultAxis(site), m = site.r - 0.5;
  return BEARINGS4.filter((_, j) => j !== v).map(([dx, dz]) => [cm(site.x + dx * m), site.y, cm(site.z + dz * m)]);
}
/** The Weighing's weights' homes: the first three gates. Pure. @param {DelveSite} site */
export const weightSpots = (site) => holdGates(site).slice(0, WEIGHTS);
/** The seals' places for `k` of them, round the ring from north. Pure. @param {DelveSite} site */
export function sealSpots(site, k) {
  return (SEAL_SLOTS[k] ?? SEAL_SLOTS[3]).map((j) => [cm(site.x + RING8[j][0] * SEAL_RING_M), site.y, cm(site.z + RING8[j][1] * SEAL_RING_M)]);
}
/** The seals' route (m): the heart to the first, then round the ring in order - the same for every site of `k` seals. */
export function sealRouteM(k) {
  const p = sealSpots({ i: 0, kind: 'seals', x: 0, y: 0, z: 0, r: 4, tier: 'regular', vault: [0, 0, 0] }, k);
  let d = SEAL_RING_M;
  for (let j = 1; j < p.length; j++) d += Math.hypot(p[j][0] - p[j - 1][0], p[j][2] - p[j - 1][2]);
  return d;
}
/** The seals' window for `k` of them (ms): SEAL_WORK_MS and the errand floor of their route. Pure. */
export const sealWindowMs = (k) => SEAL_WORK_MS + delveErrandMs(sealRouteM(k));
/** The ward reaches this past a site's disc (m): the room round the floor the law found clear. */
export const DELVE_WARD_PAD_M = 2;
/** Whether a point stands inside a site's ward (its disc and DELVE_WARD_PAD_M, on its storey - 3 m up or down). Pure. */
export function inWard(site, x, y, z) {
  const dx = x - site.x, dz = z - site.z, R = site.r + DELVE_WARD_PAD_M;
  return dx * dx + dz * dz <= R * R && Math.abs(y - site.y) <= 3;
}
/** The plate a point stands on (within LITANY_STAND_M, on its storey), or -1. Pure. @param {number[][]} plates */
export function plateAt(plates, x, y, z) {
  for (let j = 0; j < plates.length; j++) {
    const [px, py, pz] = plates[j], dx = x - px, dz = z - pz;
    if (dx * dx + dz * dz <= LITANY_STAND_M * LITANY_STAND_M && Math.abs(y - py) <= 3) return j;
  }
  return -1;
}
/** The plates a member stands on at a site of its kind: the Litany's, the Weighing's, else none. Pure. @param {DelveSite} site */
export const delvePlates = (site) => (site.kind === 'litany' ? litanyPlates(site) : site.kind === 'weighing' ? weighPlates(site) : []);
/** Whether `pose` stands within `m` of `spot`, on its storey. Pure. */
const within = (spot, pose, m) => !!spot && !!pose && Math.hypot(pose[0] - spot[0], pose[2] - spot[2]) <= m && Math.abs(pose[1] - spot[1]) <= 3;
/** The flat distance from a carry's start `[x, z]` to a spot `[x, y, z]`. Pure. */
const flatM = (from, spot) => Math.hypot(from[0] - spot[0], from[1] - spot[2]);

// ═══ THE PLAN'S HASH ═════════════════════════════════════════════════════════════════════════════════════════════════
/** One number for a whole plan - every site's index, kind, heart, radius, vault to the centimetre and its tier (an Elite
 *  dungeon's Litany and captain differ) - so a room keeps the first plan heard and refuses a word under another
 *  (section 7). Pure. @param {DelveSite[]} sites */
export function delvePlanHash(sites) {
  let h = gateHash(0x44_4c_56, (sites ?? []).length);
  for (const s of sites ?? []) {
    const v = s.vault ?? [0, 0, 0];
    h = gateHash(h, s.i, delveKind(s.kind)?.id ?? 0, Math.round(s.x * 100), Math.round(s.y * 100), Math.round(s.z * 100), Math.round(s.r * 100),
      Math.round(v[0] * 100), Math.round(v[1] * 100), Math.round(v[2] * 100), s.tier === 'elite' ? 1 : 0);
  }
  return h;
}

// ═══ THE LEDGER ══════════════════════════════════════════════════════════════════════════════════════════════════════
/** The phases: a wave's (gather, wave, breath, captain), a puzzle's (show, work), the Wellsprings' pouring, the seals'
 *  sinking, and both ends. */
export const DP = Object.freeze({ idle: 0, gather: 1, wave: 2, breath: 3, captain: 4, show: 5, work: 6, won: 7, spring: 8, sunk: 9 });
/** An account: its verified name, the level and moment of its last word, its last from the ward, the plate it said and
 *  when (the Litany's: the plate judged), the Vigil's blows its machine has been credited, and the gate's hand and purse
 *  once it strikes a piece (spendBlow, spendPurse). Kept in a map with no prototype.
 *  @typedef {{ nm: string, lv: number, last: number, inAt: number, pl: number, plAt: number, hb: number, rate?: number, rateAt?: number, bucket?: number, bucketAt?: number, clipped?: number, dealt?: number, bq?: any, bqAt?: number, bqWho?: string[] }} DelveAccount
 *  @typedef {{ s: number, kind: string, tier: string, seed: number, own: string, p: number, ec: number, stepAt: number, nearAt: number, inAt: number, bornAt: number, n: number, w: number, wz: number, sw: number, kn: number, gs: number, ws: number, bs: number, cs: number, fo: string, foAt: number, k: number, order: number[], next: number, sh: number, shows: number, wonAt: number, earned: string[], a: Record<string, DelveAccount>,
 *   ss: number, hp: number[], hx: number, lt: number, hb: number, bt: number, btAt: number, lb: number, fl: number, fc: string, ft: number, fw: number, fp: number[], fx: number[], hs: number, su: number,
 *   wt: Array<{ s: number, by: string, p: number, x: number, y: number, z: number, ta: number, tp: number[] }> }} DelveLedger */

/** A weight at its home. */
const homeWeight = () => ({ s: WEIGHT.home, by: '', p: -1, x: 0, y: 0, z: 0, ta: 0, tp: [0, 0] });
/** A started site's ledger: its owner the account whose word started it; nothing moved. Pure. @param {DelveSite} site */
export function newDelveLedger(site, own, seed, nowMs) {
  const k = site.kind === 'litany' ? litanyCount(site.tier) : site.kind === 'wellsprings' ? springCount(seed, site.i) : 0;
  return {
    s: site.i, kind: site.kind, tier: site.tier, seed: seed >>> 0, own, p: DP.idle, ec: 0, stepAt: nowMs, nearAt: -Infinity, inAt: -Infinity,
    bornAt: nowMs, n: 1, w: 0, wz: 0, sw: 0, kn: 0, gs: 0, ws: 0, bs: 0, cs: 0, fo: '', foAt: 0,
    k, order: site.kind === 'litany' ? litanyOrder(seed, site.i, k) : [], next: 0, sh: 0, shows: 0, wonAt: 0, earned: [], a: Object.create(null),
    ss: 0, hp: [], hx: 0, lt: VIGIL_LIGHT, hb: 0, bt: STAR_BLOWS_BURST, btAt: nowMs, lb: 0, fl: FLAME.heart, fc: '', ft: 0, fw: 0, fp: [0, 0], fx: [0, 0, 0],
    wt: site.kind === 'weighing' ? Array.from({ length: WEIGHTS }, homeWeight) : [], hs: -1, su: 0,
  };
}
/** Whether the ledger is over. */
export const delveWon = (led) => led.p === DP.won;
/** The party standing in the ward now: the accounts heard from inside it within DELVE_PRESENT_MS. */
export const delveInWard = (led, nowMs) => Object.keys(led.a).filter((acct) => nowMs - led.a[acct].inAt <= DELVE_PRESENT_MS).sort();
/** The levels of the party in the ward at `nowMs`, in the accounts' order. */
const levelsInWard = (led, nowMs) => delveInWard(led, nowMs).map((acct) => led.a[acct].lv);
/** The member standing a wave's foes, while heard. */
export const delveFoeOwner = (led, nowMs) => (led.fo && nowMs - led.foAt <= DELVE_ORPHAN_MS ? led.fo : '');

/** The encounter clock runs while a member is present - up to DELVE_PRESENT_MS past the last word from the site. Answers
 *  the wall moment the clock now stands at, so a transition at encounter time `at` happened at `end - (ec - at)`. */
function clockTo(led, nowMs) {
  const from = led.stepAt, to = Math.min(nowMs, led.nearAt + DELVE_PRESENT_MS);
  led.stepAt = Math.max(led.stepAt, nowMs);
  if (to > from) led.ec += to - from;
  return to;   // still, it stopped at `to`: DELVE_PRESENT_MS past the last word from the site
}
/** The wall moment encounter time `at` stood at (`end` the clock's, clockTo). */
const wallAt = (led, at, end) => end - (led.ec - at);
/** A wave stands at encounter time `at`, sized by the party in the ward at that moment (`end` the clock's, clockTo). */
function waveStarts(led, at, end, ev) {
  led.w++; led.p = DP.wave; led.ws = at; led.kn = 0;
  led.n = delveParty(delveInWard(led, end - (led.ec - at)).length);
  led.wz = holdWaveSize(led.w, led.n);
  ev.push({ k: 'wave', w: led.w, wz: led.wz });
}
/** A wave ends: a breath (the Vigil's light steadies), or past the Vigil's last wave, the win. */
function breathStarts(led, at, ev, nowMs = led.stepAt) {
  if (led.kind === 'vigil' && led.w >= HOLD_WAVES) { win(led, nowMs, ev); return; }
  led.p = DP.breath; led.bs = at; led.kn = 0; ev.push({ k: 'breath', w: led.w });
  if (led.kind === 'vigil') led.lt = Math.min(VIGIL_LIGHT, led.lt + VIGIL_BREATH_LIGHT);
}
/** The captain stands (the Hold's after its last breath, the Wellsprings' when its last source breaks). */
function captainStands(led, at, ev) { led.p = DP.captain; led.cs = at; led.kn = 0; ev.push({ k: 'captain', traits: holdCaptainTraits(led.tier) }); }
/** The Wellsprings' sources stand at encounter time `at`, sized by the party in the ward then. */
function springsStand(led, at, end, ev) {
  led.p = DP.spring; led.ss = at;
  led.hx = springHp(levelsInWard(led, wallAt(led, at, end)));
  led.hp = Array.from({ length: led.k }, () => led.hx);
  ev.push({ k: 'spring', n: led.k, h: led.hx });
}
/** A risen puzzle stands at encounter time `at`: the Brazier Rite's braziers counted, the seals sized - by the party then. */
function puzzleStands(led, at, end, ev) {
  const party = delveInWard(led, wallAt(led, at, end)).length;
  led.p = DP.work; led.ws = at;
  if (led.kind === 'brazier') { led.k = braziersFor(party); led.lb = 0; led.fl = FLAME.heart; led.fc = ''; ev.push({ k: 'work', n: led.k }); return; }
  led.k = sealCount(party);
  led.hx = sealHp(levelsInWard(led, wallAt(led, at, end)), led.k);
  led.hp = Array.from({ length: led.k }, () => led.hx);
  led.sw = sealWindowMs(led.k);   // the window its own field: `wz` is a wave's size, and the wire bounds it so (AUDIT DLV3 1)
  ev.push({ k: 'seals', n: led.k, h: led.hx, wl: led.sw });
}
/** The phase a kind's gathering ends in, and how long it lasts. */
export const gatherMs = (kind) => (kind === 'brazier' || kind === 'seals' ? PUZZLE_RISE_MS : HOLD_GATHER_MS);
function gatherEnds(led, at, end, ev) {
  if (led.kind === 'wellsprings') springsStand(led, at, end, ev);
  else if (led.kind === 'brazier' || led.kind === 'seals') puzzleStands(led, at, end, ev);
  else waveStarts(led, at, end, ev);
}
/** Back to nothing: a wave's attempt ended (`outlasted` - by its captain's time; `more` what else the end says), a puzzle
 *  let go. The caller drops the ledger, and the fold that ended it moves nothing more. */
function reset(led, why, ev, outlasted = false, more = null) {
  Object.assign(led, { p: DP.idle, ec: 0, w: 0, wz: 0, sw: 0, kn: 0, gs: 0, ws: 0, bs: 0, cs: 0, fo: '', foAt: 0, next: 0, sh: 0 });
  Object.assign(led, { ss: 0, hp: [], hx: 0, lt: VIGIL_LIGHT, hb: 0, lb: 0, fl: FLAME.heart, fc: '', hs: -1, su: 0 });
  if (led.wt.length) led.wt = led.wt.map(homeWeight);
  ev.push({ ...(outlasted ? { k: why, outlasted: true } : { k: why }), ...more });
}
const ENDS = Object.freeze(['failed', 'let']);
function win(led, nowMs, ev) {
  led.p = DP.won; led.wonAt = nowMs;
  led.earned = Object.keys(led.a).filter((acct) => nowMs - led.a[acct].inAt <= DELVE_EARN_MS).sort();
  ev.push({ k: 'won', earned: [...led.earned] });
}

/**
 * THE MACHINE, moved on to `nowMs`: a ledger never woken let go by its silence, a wave's attempt ended by the party's
 * leaving, a puzzle let go by its silence, then every transition its encounter clock has passed, each at its own moment
 * on it - the captain's time the last of them. A moment that is no number moves nothing. Answers the events, in order.
 * Pure but for the ledger it is handed. @param {DelveLedger} led @param {number} nowMs @returns {Array<any>}
 */
export function stepDelve(led, nowMs) {
  const ev = [];
  if (!Number.isFinite(nowMs) || led.p === DP.won) return ev;
  if (led.p === DP.idle) {
    if (nowMs - Math.max(led.nearAt, led.bornAt) >= DELVE_LET_GO_MS) reset(led, 'let', ev);
    led.stepAt = Math.max(led.stepAt, nowMs);
    return ev;
  }
  if (isWaveKind(led.kind) && nowMs - led.inAt >= DELVE_LEAVE_MS) { reset(led, 'failed', ev); return ev; }
  if (!isWaveKind(led.kind) && nowMs - led.nearAt >= DELVE_LET_GO_MS) { reset(led, 'let', ev); return ev; }
  const end = clockTo(led, nowMs);
  for (let i = 0; i < 2 * HOLD_WAVES + 6; i++) {
    if (led.p === DP.gather && led.ec >= led.gs + gatherMs(led.kind)) gatherEnds(led, led.gs + gatherMs(led.kind), end, ev);
    else if (led.p === DP.wave && led.ec >= led.ws + HOLD_WAVE_MAX_MS) breathStarts(led, led.ws + HOLD_WAVE_MAX_MS, ev, nowMs);
    else if (led.p === DP.breath && led.ec >= led.bs + HOLD_BREATH_MS) {
      if (led.w >= HOLD_WAVES) captainStands(led, led.bs + HOLD_BREATH_MS, ev);
      else waveStarts(led, led.bs + HOLD_BREATH_MS, end, ev);
    } else if (led.p === DP.captain && led.ec >= led.cs + HOLD_CAPTAIN_MAX_MS) { reset(led, 'failed', ev, true); break; }
    else if (led.p === DP.spring && led.ec >= led.ss + SPRING_MAX_MS) { reset(led, 'failed', ev, true, { springs: true }); break; }
    else if (led.p === DP.show && led.ec >= led.sh + litanyShowMs(led.k)) { led.p = DP.work; led.next = 0; ev.push({ k: 'work' }); }
    else if (led.kind === 'seals' && led.p === DP.work && led.ec >= led.ws + led.sw) { led.p = DP.sunk; led.su = led.ws + led.sw; led.hp = []; ev.push({ k: 'sink' }); }
    else if (led.p === DP.sunk && led.ec >= led.su + SEAL_SINK_MS) puzzleStands(led, led.su + SEAL_SINK_MS, end, ev);
    else break;
  }
  if (led.kind === 'brazier' && led.p === DP.work) flameStep(led, nowMs, ev);
  if (led.p === DP.work) carriersStep(led, nowMs, ev);
  if (led.kind === 'weighing' && led.p === DP.work) weighStep(led, nowMs, ev);
  return ev;
}

/** ONE WORD FOLDED IN, from a member of the owning party (`ctx.party` - the owner, or the hub's word that it is of the
 *  owner's party; any other speaker moves nothing). `ctx.inWard` whether its pose stands in the site's ward; `ctx.plate`
 *  the plate it stands on (the Litany's or the Weighing's - delvePlates), or -1 (the caller reads both off the pose and the
 *  plan). The word (`w`): `lv` its level; `o` 1 while its machine stands the site's foes; `kw`/`kn` the deaths of wave
 *  `kw`; `wc` wave `wc` cleared; `cf` 1 the captain fallen; `st` the Litany plate it says it stands on; `hb` the Vigil's
 *  foes' blows landed on the relic this attempt. Answers the events, in order. Pure but for the ledger.
 *  @param {DelveLedger} led @param {string} acct @param {string} name @param {any} w
 *  @param {{ party: boolean, inWard: boolean, plate?: number, nowMs: number }} ctx @returns {Array<any>} */
export function foldDelveWord(led, acct, name, w, ctx) {
  const { nowMs } = ctx;
  if (led.p === DP.won || !ctx.party || !w || typeof w !== 'object' || !Number.isFinite(nowMs)) return [];
  const ev = stepDelve(led, nowMs);
  if (led.p === DP.won || ev.some((e) => ENDS.includes(e.k))) return ev;   // an ended ledger is dropped: the next word starts anew
  const rec = led.a[acct] ?? (Object.keys(led.a).length < DELVE_PARTY_MAX * 2 ? (led.a[acct] = { nm: '', lv: 0, last: 0, inAt: -Infinity, pl: -1, plAt: -Infinity, hb: 0 }) : null);
  if (!rec) return ev;
  const lv = Math.max(1, Math.min(99, w.lv | 0));
  rec.nm = typeof name === 'string' ? name : ''; rec.lv = rec.lv > 0 ? Math.min(rec.lv, lv) : lv; rec.last = Math.max(rec.last, nowMs);   // the level the record was made at, never raised while it stands (AUDIT DLV4 F4)
  if (!ctx.inWard) { if (led.p === DP.work) carriedOut(led, acct, ev); return ev; }   // heard, never counted: a word from outside the ward moves nothing but what its speaker carries
  rec.inAt = Math.max(rec.inAt, nowMs); led.inAt = Math.max(led.inAt, nowMs); led.nearAt = Math.max(led.nearAt, nowMs);   // a word heard late moves no time back
  if (led.p === DP.idle) {
    if (led.kind === 'litany') { led.p = DP.show; led.sh = led.ec; led.shows++; ev.push({ k: 'show', order: [...led.order] }); }
    else if (led.kind === 'weighing') { led.p = DP.work; ev.push({ k: 'work', n: WEIGHTS }); }
    else { led.p = DP.gather; led.gs = led.ec; ev.push({ k: 'gather' }); }
  }
  foeMachine(led, acct, w, nowMs);
  if (led.kind === 'hold' || led.kind === 'vigil' || led.kind === 'wellsprings') return holdWord(led, acct, w, nowMs, ev);
  if (led.kind === 'litany') return litanyWord(led, rec, w, ctx.plate ?? -1, nowMs, ev);
  if (led.kind === 'weighing') {
    const p = Number.isInteger(ctx.plate) ? ctx.plate : -1;
    if (p >= 0 || rec.pl >= 0) { rec.pl = p; rec.plAt = nowMs; }
    if (led.p === DP.work) weighStep(led, nowMs, ev);
  }
  return ev;
}
/** THE FOES' MACHINE: the first member to say it stands the site's foes keeps them while heard, then another may. */
function foeMachine(led, acct, w, nowMs) {
  if (w.o === 1 && (!delveFoeOwner(led, nowMs) || led.fo === acct)) { led.fo = acct; led.foAt = nowMs; }
  else if (w.o !== 1 && led.fo === acct) { led.fo = ''; led.foAt = 0; }
}
function holdWord(led, acct, w, nowMs, ev) {
  if (led.fo !== acct) return ev;
  const nd = delveInWard(led, nowMs).length;
  if (led.p === DP.wave && w.kw === led.w && w.kn > led.kn) led.kn = Math.min(w.kn | 0, led.wz);
  if (led.p === DP.wave && w.wc === led.w && led.ec - led.ws >= starClearFloorMs(led.wz, nd)) breathStarts(led, led.ec, ev, nowMs);
  if (led.p === DP.captain && w.cf === 1 && led.ec - led.cs >= HOLD_CAPTAIN_MIN_MS) win(led, nowMs, ev);
  if (led.kind === 'vigil') relicBlows(led, led.a[acct], w, nowMs, ev);
  return ev;
}
/** THE VIGIL'S LIGHT: the blows the foes' machine says landed on the relic this attempt, believed at the Starfall's rate
 *  (a bucket of STAR_BLOWS_BURST, STAR_BLOWS_HZ a second); the light gone, the vigil fails and the site rests. */
function relicBlows(led, rec, w, nowMs, ev) {
  if (led.p === DP.won || led.p === DP.idle || !(Number.isInteger(w.hb) && w.hb > rec.hb)) return;
  led.bt = Math.min(STAR_BLOWS_BURST, led.bt + ((nowMs - led.btAt) / 1000) * STAR_BLOWS_HZ);
  led.btAt = nowMs;
  const credit = Math.max(0, Math.min(w.hb - rec.hb, Math.floor(led.bt)));   // each machine's own count (AUDIT DLV4 F6: a new one of the foes starts its own from nothing)
  if (!credit) return;
  rec.hb += credit; led.hb += credit; led.bt -= credit;
  led.lt = Math.max(0, led.lt - credit * VIGIL_BLOW_LIGHT);
  if (led.lt <= 0) reset(led, 'failed', ev, false, { dark: true, rest: VIGIL_REST_MS });
}
/** LITANY-STAND (2026-10-31): `st` is the plate a member stands on, said in every word. A step onto it is judged; while
 *  they stay (`rec.pl`, kept through a showing) it is heard again only when it would light - so a wrong plate stood on
 *  wakes nothing twice, and the next plate lights under whoever stands there. A word the room's pose of them does not
 *  bear out yet counts on the next one: a step said once was lost online. */
function litanyWord(led, rec, w, plate, nowMs, ev) {
  const on = Number.isInteger(w.st) && w.st === plate && plate >= 0 && plate < led.k ? plate : -1;
  const stayed = on >= 0 && on === rec.pl;
  rec.pl = on;
  if (led.p !== DP.work || on < 0 || (stayed && on !== led.order[led.next])) return ev;
  if (plate === led.order[led.next]) {
    led.next++; ev.push({ k: 'lit', j: plate, next: led.next });
    if (led.next >= led.k) win(led, nowMs, ev);
    return ev;
  }
  if (led.order.slice(0, led.next).includes(plate)) return ev;   // a plate already lit is stood on freely
  led.p = DP.show; led.sh = led.ec; led.next = 0; led.shows++;
  ev.push({ k: 'wrong', j: plate });
  if (led.tier === 'elite') ev.push({ k: 'wake', n: LITANY_WAKE });
  ev.push({ k: 'show', order: [...led.order] });
  return ev;
}
/** The Brazier Rite's flame on the clock: a carried one gutters out at FLAME_LIFE_MS, one lying at FLAME_LIES_MS - back at
 *  the heart either way. */
function flameStep(led, nowMs, ev) {
  if (led.fl === FLAME.heart) return;
  if (nowMs - led.fw >= FLAME_LIFE_MS || (led.fl === FLAME.lying && nowMs - led.ft >= FLAME_LIES_MS)) flameHome(led, ev);
}
/** The flame back at the heart - guttered, or carried out of the ward. */
function flameHome(led, ev) { led.fl = FLAME.heart; led.fc = ''; ev.push({ k: 'gutter' }); }
/** A carried weight home again - its carrier out of the ward, or silent past DELVE_PRESENT_MS. */
function weightHome(led, j, ev) { led.wt[j] = homeWeight(); ev.push({ k: 'back', j }); }
/** THE CARRIER'S WARD: a piece carried out of the ward goes home (a let-go needs no reach, and nobody stays burdened
 *  outside it); a carrier silent DELVE_PRESENT_MS loses it so. */
function carriersStep(led, nowMs, ev) {
  if (led.kind === 'brazier' && led.fl === FLAME.carried && !(nowMs - (led.a[led.fc]?.last ?? -Infinity) <= DELVE_PRESENT_MS)) flameHome(led, ev);
  if (led.kind === 'weighing') led.wt.forEach((t, j) => { if (t.s === WEIGHT.carried && !(nowMs - (led.a[t.by]?.last ?? -Infinity) <= DELVE_PRESENT_MS)) weightHome(led, j, ev); });
}
/** A word from outside the ward: what its speaker carries goes home. */
function carriedOut(led, acct, ev) {
  if (led.kind === 'brazier' && led.fl === FLAME.carried && led.fc === acct) flameHome(led, ev);
  if (led.kind === 'weighing') led.wt.forEach((t, j) => { if (t.s === WEIGHT.carried && t.by === acct) weightHome(led, j, ev); });
}
/** The Weighing judged: a plate held by a weight on it or a member of the party standing on it (its word fresh); all
 *  three held WEIGH_HOLD_MS on the encounter clock wins, any let go starts the count again. */
function weighStep(led, nowMs, ev) {
  const held = [0, 1, 2].every((p) => led.wt.some((t) => t.s === WEIGHT.plate && t.p === p)
    || Object.keys(led.a).some((acct) => led.a[acct].pl === p && nowMs - led.a[acct].plAt <= WEIGH_FRESH_MS && nowMs - led.a[acct].inAt <= WEIGH_FRESH_MS));
  if (!held) { if (led.hs >= 0) { led.hs = -1; ev.push({ k: 'unheld' }); } return; }
  if (led.hs < 0) { led.hs = led.ec; ev.push({ k: 'held' }); return; }
  if (led.ec - led.hs >= WEIGH_HOLD_MS) win(led, nowMs, ev);
}

/** A pose the law reads: three finite numbers, in any array a caller holds them in - the game's feet are a motor's
 *  Float32Array (player/motor.js), and a NaN would walk past every reach (a comparison with it is false). */
const posed = (p) => p != null && p.length >= 3 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]);
/** The pieces a blow can break: the Wellsprings' sources while they pour, the seals while they stand. Pure. */
export function breakSpots(site, led) {
  if (site.kind === 'wellsprings') return springSpots(site, led.k);
  if (site.kind === 'seals') return sealSpots(site, led.k);
  return [];
}
/**
 * ONE BLOW ON A PIECE, from a member of the party (`ctx.party`) standing at `ctx.pose` in the ward: `hit.j` the piece,
 * `hit.d` the damage its screen counted, `hit.r` the blow's kind (net/gate/gateBrain.js HIT_KINDS), `hit.q` its sequence.
 * Dagon's crystals' caps (applyCrystalHit): the member's hand and purse (spendBlow, spendPurse), a swing within reach of
 * the piece's body. The last source broken stands the captain; the last seal, the win. Answers the events; pure but the ledger.
 * @param {DelveLedger} led @param {DelveSite} site @param {string} acct
 * @param {{ j: number, d: number, r: number, q?: any }} hit @param {{ party: boolean, inWard: boolean, pose: number[]|null, nowMs: number }} ctx
 */
export function foldDelveHit(led, site, acct, hit, ctx) {
  const { nowMs, pose } = ctx;
  if (led.p === DP.won || !ctx.party || !hit || typeof hit !== 'object' || !Number.isFinite(nowMs)) return [];
  const ev = stepDelve(led, nowMs);
  if (led.p === DP.won || ev.some((e) => ENDS.includes(e.k))) return ev;
  const rec = led.a[acct];
  if (!rec || !ctx.inWard || !posed(pose)) return ev;   // its word made its record: a blow from a stranger to the site is nothing
  if (!((led.kind === 'wellsprings' && led.p === DP.spring) || (led.kind === 'seals' && led.p === DP.work))) return ev;
  const j = hit.j, q = Number.isInteger(j) ? breakSpots(site, led)[j] : null;
  if (!q || !(led.hp[j] > 0) || !Number.isFinite(hit.d) || !(hit.d > 0)) return ev;
  const body = led.kind === 'seals' ? SEAL_R : SPRING_R;
  if (hit.r === HIT_KINDS.Melee && Math.hypot(pose[0] - q[0], pose[2] - q[2]) - body > MELEE_REACH + POSE_SLACK) return ev;
  if (!(rec.bucketAt >= 0)) Object.assign(rec, { rate: GATE_HIT_HZ_MAX, rateAt: nowMs, bucket: BUCKET_DEPTH_X * dpsRef(rec.lv), bucketAt: nowMs, clipped: 0, dealt: 0, bq: null, bqAt: -Infinity, bqWho: [] });
  if (!spendBlow(rec, nowMs, hit.q ?? null, `x${j}`)) return ev;
  led.hp[j] -= spendPurse(rec, hit.d, led.hp[j], nowMs);
  if (led.hp[j] > 1e-6) return ev;
  led.hp[j] = 0;
  ev.push({ k: 'broke', j });
  if (led.hp.every((h) => h <= 0)) {
    if (led.kind === 'wellsprings') captainStands(led, led.ec, ev);
    else win(led, nowMs, ev);
  }
  return ev;
}

/**
 * ONE ACT ON A CARRIED PIECE, from a member of the party standing at `ctx.pose`: the Brazier Rite's flame (`take` it at
 * the heart or where it lies, `light` brazier `j`, `drop` it - struck or let go) and the Weighing's weights (`take` weight
 * `j`, `set` the one carried - on a free plate it stands on, else on the floor). A piece is never set down sooner than its
 * carrier could walk it there (the Ketch's step law, ktLeastMs, at the fastest build carrying, so no player is refused).
 * @param {DelveLedger} led @param {DelveSite} site @param {string} acct @param {{ a: string, j?: number }} act
 * @param {{ party: boolean, inWard: boolean, pose: number[]|null, nowMs: number }} ctx
 */
export function foldDelveAct(led, site, acct, act, ctx) {
  const { nowMs, pose } = ctx;
  if (led.p === DP.won || !ctx.party || !act || typeof act !== 'object' || !Number.isFinite(nowMs)) return [];
  const ev = stepDelve(led, nowMs);
  if (led.p === DP.won || ev.some((e) => ENDS.includes(e.k))) return ev;
  if (!led.a[acct] || !posed(pose) || led.p !== DP.work) return ev;
  if (!ctx.inWard) { if (act.a === 'drop' || act.a === 'set') carriedOut(led, acct, ev); return ev; }   // a let-go needs no reach: out of the ward, the piece goes home (AUDIT DLV4 F2)
  if (led.kind === 'brazier') flameAct(led, site, acct, act, pose, nowMs, ev);
  else if (led.kind === 'weighing') weightAct(led, site, acct, act, pose, nowMs, ev);
  return ev;
}
function flameAct(led, site, acct, act, pose, nowMs, ev) {
  if (act.a === 'take' && led.fl !== FLAME.carried) {
    const lying = led.fl === FLAME.lying, at = lying ? led.fx : siteHeart(site);
    if (!within(at, pose, DELVE_REACH_M)) return;
    led.fl = FLAME.carried; led.fc = acct;
    if (!lying) { led.fw = nowMs; led.fp = [at[0], at[2]]; }   // taken up where it fell: its life and its walk still the heart's (AUDIT DLV4 F1, F3)
    ev.push({ k: 'take' });
  } else if (act.a === 'light' && led.fl === FLAME.carried && led.fc === acct) {
    const j = act.j, b = Number.isInteger(j) && j >= 0 && j < led.k ? brazierSpots(site, led.k)[j] : null;
    if (!b || led.lb & (1 << j) || !within(b, pose, DELVE_REACH_M) || nowMs - led.fw < ktLeastMs(flatM(led.fp, b), true)) return;
    led.lb |= 1 << j; led.fl = FLAME.heart; led.fc = '';
    ev.push({ k: 'light', j });
    if (led.lb === (1 << led.k) - 1) win(led, nowMs, ev);
  } else if (act.a === 'drop' && led.fl === FLAME.carried && led.fc === acct) {
    led.fl = FLAME.lying; led.fc = ''; led.ft = nowMs; led.fx = [cm(pose[0]), cm(pose[1]), cm(pose[2])];
    ev.push({ k: 'drop' });
  }
}
/** Where weight `t` lies now (its home, a plate, the floor), or null while carried. */
function weightAt(site, t, j) {
  if (t.s === WEIGHT.home) return weightSpots(site)[j];
  if (t.s === WEIGHT.plate) return weighPlates(site)[t.p];
  if (t.s === WEIGHT.floor) return [t.x, t.y, t.z];
  return null;
}
function weightAct(led, site, acct, act, pose, nowMs, ev) {
  const mine = led.wt.findIndex((t) => t.s === WEIGHT.carried && t.by === acct);
  if (act.a === 'take' && mine < 0) {
    const j = act.j, t = Number.isInteger(j) ? led.wt[j] : null, at = t ? weightAt(site, t, j) : null;
    if (!at || !within(at, pose, DELVE_PRESS_M)) return;
    Object.assign(t, { s: WEIGHT.carried, by: acct, p: -1, ta: nowMs, tp: [at[0], at[2]] });
    ev.push({ k: 'take', j });
    weighStep(led, nowMs, ev);
  } else if (act.a === 'set' && mine >= 0) {
    const t = led.wt[mine], plates = weighPlates(site), p = plateAt(plates, pose[0], pose[1], pose[2]);
    const free = p >= 0 && !led.wt.some((o) => o.s === WEIGHT.plate && o.p === p);
    const at = free ? plates[p] : [cm(pose[0]), cm(pose[1]), cm(pose[2])];
    if (nowMs - t.ta < ktLeastMs(flatM(t.tp, at), true)) return;
    Object.assign(t, free ? { s: WEIGHT.plate, by: '', p } : { s: WEIGHT.floor, by: '', p: -1, x: at[0], y: at[1], z: at[2] });
    ev.push({ k: 'set', j: mine, p: free ? p : -1 });
    weighStep(led, nowMs, ev);
  }
}

/** The ms left in the phase on the encounter clock (the gathering, a wave, a breath, the captain's time, the show, the
 *  pouring, the seals' window and their sinking), or -1 where none runs. */
export function delvePhaseLeft(led) {
  if (led.p === DP.gather) return Math.max(0, led.gs + gatherMs(led.kind) - led.ec);
  if (led.p === DP.wave) return Math.max(0, led.ws + HOLD_WAVE_MAX_MS - led.ec);
  if (led.p === DP.breath) return Math.max(0, led.bs + HOLD_BREATH_MS - led.ec);
  if (led.p === DP.captain) return Math.max(0, led.cs + HOLD_CAPTAIN_MAX_MS - led.ec);
  if (led.p === DP.show) return Math.max(0, led.sh + litanyShowMs(led.k) - led.ec);
  if (led.p === DP.spring) return Math.max(0, led.ss + SPRING_MAX_MS - led.ec);
  if (led.p === DP.work && led.kind === 'seals') return Math.max(0, led.ws + led.sw - led.ec);
  if (led.p === DP.sunk) return Math.max(0, led.su + SEAL_SINK_MS - led.ec);
  return -1;
}
/** The ledger as a screen reads it: the site, its phase, the wave and its size and deaths, the ms left in the phase, the
 *  party in the ward, whether a machine stands the foes and the Litany's next plate - and each kind's own pieces: the
 *  sources' or seals' health (`h`, whole, of `hx`), the relic's light (`lt`), the braziers lit (`lb` of `n`) and the flame
 *  (`fl`, where it lies `fx`), the weights (`wt`: where each is, its plate, where it lies) and how long all three plates
 *  have been held (`hd`). No account is named in it: the room says the flame's or a weight's carrier by its own word. */
export const delveState = (led, nowMs) => ({
  k: 'dl', s: led.s, kd: delveKind(led.kind)?.id ?? 0, p: led.p, w: led.w, wz: led.wz, kn: led.kn, wl: delvePhaseLeft(led),
  nd: delveInWard(led, nowMs).length, fo: delveFoeOwner(led, nowMs) ? 1 : 0, nx: led.next,
  ...(led.kind === 'wellsprings' || led.kind === 'seals' ? { n: led.k, h: led.hp.map((x) => Math.ceil(x)), hx: Math.ceil(led.hx) } : {}),
  ...(led.kind === 'vigil' ? { lt: Math.ceil(led.lt) } : {}),
  ...(led.kind === 'brazier' ? { n: led.k, lb: led.lb, fl: led.fl, fx: led.fl === FLAME.lying ? [...led.fx] : [] } : {}),
  ...(led.kind === 'weighing' ? { wt: led.wt.map((t) => [t.s, t.p, t.x, t.z]), hd: led.hs >= 0 ? led.ec - led.hs : -1 } : {}),
});
/** The account carrying the Brazier Rite's flame or Weighing's weight `j` (-1 the flame), or '' - the room says it by peer. */
export const delveCarrier = (led, j = -1) => (j < 0 ? (led.fl === FLAME.carried ? led.fc : '') : led.wt[j]?.s === WEIGHT.carried ? led.wt[j].by : '');
