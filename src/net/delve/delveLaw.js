// @ts-check
// DELVE II (bible/03-World/Delve-II.md; the owner, 2026-10-28: "a wave based encounter, or puzzle solving like you find in
// some of our world events (not the clock puzzle)"): THE ENCOUNTER'S LAW - the kinds, their numbers, the pieces' spots on a
// site's floor and the ledger one started site keeps. Pure: the moment, the words and the party handed in, events out, so
// the client runs it offline and the relay runs it online (DLV3) on the same state. Not a DFU member (Ledger A: DELVE II).
import { gateHash } from '../gate/gateLaw.js';
import { starClearFloorMs } from '../starfall/starfallLaw.js';

// ═══ THE KINDS ═══════════════════════════════════════════════════════════════════════════════════════════════════════
/** Each kind: its number on the wire and in the plan's hash, and its family. Its floor is the site's (delveSites.js). */
export const DELVE_KINDS = Object.freeze({
  hold: Object.freeze({ id: 1, family: 'wave' }),
  litany: Object.freeze({ id: 2, family: 'puzzle' }),
});
/** The kinds, in their numbers' order. */
export const DELVE_KIND_NAMES = Object.freeze(Object.keys(DELVE_KINDS).sort((a, b) => DELVE_KINDS[a].id - DELVE_KINDS[b].id));
/** The families a dungeon of two sites or more holds one of each. */
export const DELVE_FAMILIES = Object.freeze(['wave', 'puzzle']);
/** A kind by name, or null. */
export const delveKind = (name) => (typeof name === 'string' && Object.hasOwn(DELVE_KINDS, name) ? DELVE_KINDS[name] : null);

// ═══ THE PARTY AND THE PACE ══════════════════════════════════════════════════════════════════════════════════════════
export const DELVE_PARTY_MAX = 8;
/** A party's count held to one to eight (law 3). */
export const delveParty = (n) => Math.max(1, Math.min(DELVE_PARTY_MAX, Number.isFinite(n) ? Math.floor(n) : 1));
/** THE DELVE PACE (law 7): a weak character's run - player/motor.js runSpeed(30, 5), pinned equal by the test. */
export const DELVE_PACE_MPS = ((30 + 150) / 39.5) * (1.35 + 5 / 200);
/** THE ERRAND FLOOR at the delve pace: a route (m) walked at DELVE_PACE_MPS, and 1.5 s more, ceiled to 10 ms. */
export const delveErrandMs = (routeM) => Math.ceil(((Math.max(0, routeM) / DELVE_PACE_MPS + 1.5) * 1000) / 10) * 10;

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
/** The captain's fall is believed no sooner than this after it stands (encounter clock). */
export const HOLD_CAPTAIN_MIN_MS = 20_000;
/** The captain's boss traits: one, two in an Elite or Abyss dungeon (BOSS-TRAITS). */
export const holdCaptainTraits = (tier) => (tier === 'elite' || tier === 'super' ? 2 : 1);

// ═══ THE LITANY ══════════════════════════════════════════════════════════════════════════════════════════════════════
/** The plates: four, five in an Elite or Abyss dungeon. */
export const litanyCount = (tier) => (tier === 'elite' || tier === 'super' ? 5 : 4);
/** The plates' ring about the site's heart (m), and how near a member stands to stand on one (m). */
export const LITANY_RING_M = 2.5;
export const LITANY_STAND_M = 1.2;
/** Each plate of the order is shown this long, and the order's end held one step more. */
export const LITANY_SHOW_STEP_MS = 1_000;
/** The show's length for `k` plates (ms). */
export const litanyShowMs = (k) => (k + 1) * LITANY_SHOW_STEP_MS;
/** In an Elite or Abyss dungeon a wrong plate wakes this many foes of the table. */
export const LITANY_WAKE = 2;

// ═══ THE PIECES' SPOTS ═══════════════════════════════════════════════════════════════════════════════════════════════
// Every bearing a literal (dungeonFires.js ringOf's rule: no sine, whose last bit is an engine's own), and every spot
// rounded to the centimetre, so every client and the relay stand the same pieces on the same floor.
const R2 = Math.SQRT1_2;
const BEARINGS4 = Object.freeze([[0, 1], [1, 0], [0, -1], [-1, 0]]);
const BEARINGS5 = Object.freeze([[0, 1], [0.951057, 0.309017], [0.587785, -0.809017], [-0.587785, -0.809017], [-0.951057, 0.309017]]);
const DIAGONALS = Object.freeze([[R2, R2], [R2, -R2], [-R2, -R2], [-R2, R2]]);
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
/** The Hold's four gates the waves come through, on the ward's rim (half a metre in), its diagonals. Pure. @param {DelveSite} site */
export function holdGates(site) {
  const g = site.r - 0.5;
  return DIAGONALS.map(([dx, dz]) => [cm(site.x + dx * g), site.y, cm(site.z + dz * g)]);
}
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

// ═══ THE PLAN'S HASH ═════════════════════════════════════════════════════════════════════════════════════════════════
/** One number for a whole plan - every site's index, kind, heart, radius and vault to the centimetre - so a room keeps
 *  the first plan heard and refuses a word under another (section 7). Pure. @param {DelveSite[]} sites */
export function delvePlanHash(sites) {
  let h = gateHash(0x44_4c_56, (sites ?? []).length);
  for (const s of sites ?? []) {
    const v = s.vault ?? [0, 0, 0];
    h = gateHash(h, s.i, delveKind(s.kind)?.id ?? 0, Math.round(s.x * 100), Math.round(s.y * 100), Math.round(s.z * 100), Math.round(s.r * 100),
      Math.round(v[0] * 100), Math.round(v[1] * 100), Math.round(v[2] * 100));
  }
  return h;
}

// ═══ THE LEDGER ══════════════════════════════════════════════════════════════════════════════════════════════════════
/** The phases: a wave's (gather, wave, breath, captain), a puzzle's (show, work), and both ends. */
export const DP = Object.freeze({ idle: 0, gather: 1, wave: 2, breath: 3, captain: 4, show: 5, work: 6, won: 7 });
/** An account: the verified name, the level its last word said, its last word and its last from inside the ward (ms).
 *  @typedef {{ nm: string, lv: number, last: number, inAt: number }} DelveAccount
 *  @typedef {{ s: number, kind: string, tier: string, seed: number, own: string, p: number, ec: number, stepAt: number,
 *   nearAt: number, inAt: number, n: number, w: number, wz: number, kn: number, gs: number, ws: number, bs: number,
 *   cs: number, fo: string, foAt: number, k: number, order: number[], next: number, sh: number, shows: number,
 *   wonAt: number, earned: string[], a: Record<string, DelveAccount> }} DelveLedger */

/** A started site's ledger: its owner the account whose word started it; nothing moved. Pure. @param {DelveSite} site */
export function newDelveLedger(site, own, seed, nowMs) {
  const k = site.kind === 'litany' ? litanyCount(site.tier) : 0;
  return {
    s: site.i, kind: site.kind, tier: site.tier, seed: seed >>> 0, own, p: DP.idle, ec: 0, stepAt: nowMs, nearAt: -Infinity, inAt: -Infinity,
    n: 1, w: 0, wz: 0, kn: 0, gs: 0, ws: 0, bs: 0, cs: 0, fo: '', foAt: 0,
    k, order: k ? litanyOrder(seed, site.i, k) : [], next: 0, sh: 0, shows: 0, wonAt: 0, earned: [], a: {},
  };
}
/** Whether the ledger is over. */
export const delveWon = (led) => led.p === DP.won;
/** The party standing in the ward now: the accounts heard from inside it within DELVE_PRESENT_MS. */
export const delveInWard = (led, nowMs) => Object.keys(led.a).filter((acct) => nowMs - led.a[acct].inAt <= DELVE_PRESENT_MS).sort();
/** The member standing a wave's foes, while heard. */
export const delveFoeOwner = (led, nowMs) => (led.fo && nowMs - led.foAt <= DELVE_ORPHAN_MS ? led.fo : '');

/** The encounter clock runs while a member is present - up to DELVE_PRESENT_MS past the last word from the site. */
function clockTo(led, nowMs) {
  const from = led.stepAt, to = Math.min(nowMs, led.nearAt + DELVE_PRESENT_MS);
  led.stepAt = Math.max(led.stepAt, nowMs);
  if (led.p === DP.idle || led.p === DP.won) return;
  if (to > from) led.ec += to - from;
}
function waveStarts(led, at, nowMs, ev) {
  led.w++; led.p = DP.wave; led.ws = at; led.kn = 0;
  led.n = delveParty(delveInWard(led, nowMs).length);
  led.wz = holdWaveSize(led.w, led.n);
  ev.push({ k: 'wave', w: led.w, wz: led.wz });
}
function breathStarts(led, at, ev) { led.p = DP.breath; led.bs = at; led.kn = 0; ev.push({ k: 'breath', w: led.w }); }
/** Back to nothing: a wave's attempt ended, a puzzle let go. The ledger stays the owner's until the caller drops it. */
function reset(led, why, ev) {
  Object.assign(led, { p: DP.idle, ec: 0, w: 0, wz: 0, kn: 0, gs: 0, ws: 0, bs: 0, cs: 0, fo: '', foAt: 0, next: 0, sh: 0 });
  ev.push({ k: why });
}
function win(led, nowMs, ev) {
  led.p = DP.won; led.wonAt = nowMs;
  led.earned = Object.keys(led.a).filter((acct) => nowMs - led.a[acct].inAt <= DELVE_EARN_MS).sort();
  ev.push({ k: 'won', earned: [...led.earned] });
}

/**
 * THE MACHINE, moved on to `nowMs`: a wave's attempt ended by the party's leaving, a puzzle let go by its silence, then
 * every transition its encounter clock has passed, each at its own moment on it. Answers the events, in order. Pure but
 * for the ledger it is handed. @param {DelveLedger} led @param {number} nowMs @returns {Array<any>}
 */
export function stepDelve(led, nowMs) {
  const ev = [];
  if (led.p === DP.won || led.p === DP.idle) { led.stepAt = Math.max(led.stepAt, nowMs); return ev; }
  if (led.kind === 'hold' && nowMs - led.inAt >= DELVE_LEAVE_MS) { reset(led, 'failed', ev); return ev; }
  if (led.kind === 'litany' && nowMs - led.nearAt >= DELVE_LET_GO_MS) { reset(led, 'let', ev); return ev; }
  clockTo(led, nowMs);
  for (let i = 0; i < 2 * HOLD_WAVES + 6; i++) {
    if (led.p === DP.gather && led.ec >= led.gs + HOLD_GATHER_MS) waveStarts(led, led.gs + HOLD_GATHER_MS, nowMs, ev);
    else if (led.p === DP.wave && led.ec >= led.ws + HOLD_WAVE_MAX_MS) breathStarts(led, led.ws + HOLD_WAVE_MAX_MS, ev);
    else if (led.p === DP.breath && led.ec >= led.bs + HOLD_BREATH_MS) {
      if (led.w >= HOLD_WAVES) { led.p = DP.captain; led.cs = led.bs + HOLD_BREATH_MS; led.kn = 0; ev.push({ k: 'captain', traits: holdCaptainTraits(led.tier) }); }
      else waveStarts(led, led.bs + HOLD_BREATH_MS, nowMs, ev);
    } else if (led.p === DP.show && led.ec >= led.sh + litanyShowMs(led.k)) { led.p = DP.work; led.next = 0; ev.push({ k: 'work' }); }
    else break;
  }
  return ev;
}

/** ONE WORD FOLDED IN, from a member of the owning party (`ctx.party` - the owner, or the hub's word that it is of the
 *  owner's party; any other speaker moves nothing). `ctx.inWard` whether its pose stands in the site's ward; `ctx.plate`
 *  the Litany plate it stands on, or -1 (the caller reads both off the pose and the plan). The word (`w`): `lv` its
 *  level; `o` 1 while its machine stands the wave's foes; `kw`/`kn` the deaths of wave `kw`; `wc` wave `wc` cleared;
 *  `cf` 1 the captain fallen; `st` the plate it says it stepped on. Answers the events, in order. Pure but for the
 *  ledger. @param {DelveLedger} led @param {string} acct @param {string} name @param {any} w
 *  @param {{ party: boolean, inWard: boolean, plate?: number, nowMs: number }} ctx @returns {Array<any>} */
export function foldDelveWord(led, acct, name, w, ctx) {
  const { nowMs } = ctx;
  if (led.p === DP.won || !ctx.party || !w || typeof w !== 'object') return [];
  const ev = stepDelve(led, nowMs);
  if (led.p === DP.won) return ev;
  const rec = led.a[acct] ?? (Object.keys(led.a).length < DELVE_PARTY_MAX * 2 ? (led.a[acct] = { nm: '', lv: 1, last: 0, inAt: -Infinity }) : null);
  if (!rec) return ev;
  rec.nm = typeof name === 'string' ? name : ''; rec.lv = Math.max(1, Math.min(99, w.lv | 0)); rec.last = nowMs;
  if (!ctx.inWard) return ev;   // heard, never counted: a word from outside the ward moves nothing
  rec.inAt = nowMs; led.inAt = nowMs; led.nearAt = nowMs;
  if (led.p === DP.idle) {
    if (led.kind === 'hold') { led.p = DP.gather; led.gs = led.ec; ev.push({ k: 'gather' }); }
    else { led.p = DP.show; led.sh = led.ec; led.shows++; ev.push({ k: 'show', order: [...led.order] }); }
  }
  return led.kind === 'hold' ? holdWord(led, acct, w, nowMs, ev) : litanyWord(led, w, ctx.plate ?? -1, nowMs, ev);
}
function holdWord(led, acct, w, nowMs, ev) {
  if (w.o === 1 && (!delveFoeOwner(led, nowMs) || led.fo === acct)) { led.fo = acct; led.foAt = nowMs; }
  else if (w.o !== 1 && led.fo === acct) { led.fo = ''; led.foAt = 0; }
  if (led.fo !== acct) return ev;
  const nd = delveInWard(led, nowMs).length;
  if (led.p === DP.wave && w.kw === led.w && w.kn > led.kn) led.kn = Math.min(w.kn | 0, led.wz);
  if (led.p === DP.wave && w.wc === led.w && led.ec - led.ws >= starClearFloorMs(led.wz, nd)) breathStarts(led, led.ec, ev);
  if (led.p === DP.captain && w.cf === 1 && led.ec - led.cs >= HOLD_CAPTAIN_MIN_MS) win(led, nowMs, ev);
  return ev;
}
function litanyWord(led, w, plate, nowMs, ev) {
  if (led.p !== DP.work || !Number.isInteger(w.st) || w.st !== plate || plate < 0 || plate >= led.k) return ev;
  if (plate === led.order[led.next]) {
    led.next++; ev.push({ k: 'lit', j: plate, next: led.next });
    if (led.next >= led.k) win(led, nowMs, ev);
    return ev;
  }
  if (led.order.slice(0, led.next).includes(plate)) return ev;   // a plate already lit is stood on freely
  led.p = DP.show; led.sh = led.ec; led.next = 0; led.shows++;
  ev.push({ k: 'wrong', j: plate });
  if (led.tier === 'elite' || led.tier === 'super') ev.push({ k: 'wake', n: LITANY_WAKE });
  ev.push({ k: 'show', order: [...led.order] });
  return ev;
}

/** The ms left in the phase on the encounter clock (the gathering, a wave, a breath, the show), or -1 where none runs. */
export function delvePhaseLeft(led) {
  if (led.p === DP.gather) return Math.max(0, led.gs + HOLD_GATHER_MS - led.ec);
  if (led.p === DP.wave) return Math.max(0, led.ws + HOLD_WAVE_MAX_MS - led.ec);
  if (led.p === DP.breath) return Math.max(0, led.bs + HOLD_BREATH_MS - led.ec);
  if (led.p === DP.show) return Math.max(0, led.sh + litanyShowMs(led.k) - led.ec);
  return -1;
}
/** The ledger as a screen reads it: the site, its phase, the wave and its size and deaths, the ms left in the phase, the
 *  party in the ward, whether a machine stands the foes and the Litany's next plate. No account is named in it. */
export const delveState = (led, nowMs) => ({
  k: 'dl', s: led.s, kd: delveKind(led.kind)?.id ?? 0, p: led.p, w: led.w, wz: led.wz, kn: led.kn, wl: delvePhaseLeft(led),
  nd: delveInWard(led, nowMs).length, fo: delveFoeOwner(led, nowMs) ? 1 : 0, nx: led.next,
});
