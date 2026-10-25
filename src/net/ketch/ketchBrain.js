// @ts-check
// KETCH (bible/11-Multiplayer/Sky-Ketch.md sections 4-7): THE VOYAGE'S DIRECTOR - one crew's ship, as its room runs it
// (server/src/index.js `_kt*`): the crew it has taken, the stage it stands at, its constructs, its aether cells and its
// bridge's fight. Pure - the moment and a [0,1) source handed in, frames out - so a test runs a voyage whole.
//
//   THE BOARDING WATCH (the waist): three waves of constructs - spheres; spheres and sentries; the Watch-Captain and
//     spheres - each rising KT_WAVE_GAP_MS after the last is down, the first when a member steps into the waist (or
//     KT_WATCH_WAIT_MS after the first boarded). The last down: THE HATCH OPENS.
//   THE GALLERY OF HAMMERS (the gun deck): its hammers and steam lanes run on the shared clock (net/ketch/ketchDeck.js
//     hazardsBetween - the relay judges them on its trails, the screens draw and judge them); the two HAMMER WARDENS stand
//     at their posts until a member comes past KT_WARDEN_WAKE_Z or strikes one. Both down: THE HOLD OPENS.
//   THE STARVED ENGINE (the hold): THE NEW MECHANIC - the engine eats aether cells. A member takes a charged cell from one
//     of six cradles (`pick`), carries it - slowed, its weapon put up (the page's), its hands full - through the arc-coils
//     to the engine, and sets it in a socket (`bank`). A carrier struck by any blow (its own machine's verdict, `hurt`; the
//     relay's census; an arc-coil's on its trail), fallen, or who lets go (`drop`), DROPS the cell where it stands: it lies
//     KT_CELL_LIES_MS for any member to take up, then bleeds out. A cradle charges again KT_CRADLE_BACK_MS after its cell is
//     taken. Spiders pour from the vents, at carriers first. The engine fed (engineNeeds the crew): THE MAST-LIFT RUNS.
//   THE SAILWALK: the Hour's course over the open sky (the page's - nobody's but the walker's). The first member on the
//     gangway or the bridge UNBARS THE BRIDGE: the bosun's line runs from the main top for the rest.
//   THE TONAL WARDEN (the bridge): net/ketch/ketchWarden.js on the boss seam - its `in`, its blows, its Discord's
//     resonators (put right with the bridge's own two cradles' cells - the engine's law again), its forks, its sections.
//     Its fall: THE CABIN OPENS, and every member who earned it is owed a receipt (the room mints them - y1).
//
// ONE HAND AND ONE PURSE a member, for everything it strikes (net/gate/gateBrain.js spendBlow, spendPurse - the gate's
// own rule for its boss, crystals and host): the voyage's crew record. The census (net/bossBody.js) counts the same record.
//
// Not a DFU member. Ledger A (KETCH).
import { KT_CREW_MAX, KT_STAGE, KT_WATCH_WAVES, ketchRoomOf } from './ketchLaw.js';
import {
  KT_WATCH_SPOTS, KT_WARDEN_POSTS, KT_WARDEN_WAKE_Z, KT_CRADLES, KT_BRIDGE_CRADLES, KT_SOCKETS, KT_RESONATORS, KT_VENTS, KT_REACH,
  KT_HOLD, KT_BRIDGE, KT_LIFT, KT_COURSE_SPEC, KT_GANGWAY, engineNeeds, deckZoneAt,
} from './ketchDeck.js';
import { KT_KINDS, KT_FLOORS, newConstruct, constructHp, bodyWord, beatConstruct, hitConstruct, stepWalk, mvWord, clearOf } from './ketchConstructs.js';
import { KETCH_SEAM, KW_ID, KW_FORK_ID0, retune, applyForkHit } from './ketchWarden.js';
import { dpsRef, clampLv, BUCKET_DEPTH_X, GATE_HIT_HZ_MAX, HP_SEND_MS, STATE_SEND_MS, STEP_MAX_MS, THREAT_DECAY, spendBlow, spendPurse, hasPart, freeSeat } from '../gate/gateBrain.js';

// ── the numbers ────────────────────────────────────────────────────────
/** The Watch: the first wave this long after the first member boards if none has stepped into the waist; each wave this
 *  long after the last is down; how long a body takes to rise (it drops from the rigging, it climbs out of a vent). */
export const KT_WATCH_WAIT_MS = 12_000;
export const KT_WAVE_GAP_MS = 3000;
export const KT_RISE_MS = 1200;
/** A body down is taken off the ship this long after. */
export const KT_DOWN_KEEP_MS = 3000;
/** THE WAVES for a crew of `n` - KETCH-LONGER (2026-10-25, the owner, from players: "the raid is too short and too easy"):
 *  KT_WATCH_WAVES (ketchLaw.js) where there were three, each fuller: spheres; spheres and sentries; more of both; the
 *  sentries' wall; the Watch-Captain with spheres and a sentry. */
export function watchWave(w, n) {
  const c = Math.max(1, Math.min(KT_CREW_MAX, n | 0));
  if (w === 1) return { sphere: 3 + c, sentry: 0, captain: 0 };
  if (w === 2) return { sphere: 2 + Math.ceil(c / 2), sentry: 1 + Math.floor(c / 3), captain: 0 };
  if (w === 3) return { sphere: 2 + c, sentry: 1 + Math.ceil(c / 3), captain: 0 };
  if (w === 4) return { sphere: 1 + Math.ceil(c / 2), sentry: 2 + Math.floor(c / 2), captain: 0 };
  return { sphere: 1 + Math.ceil(c / 2), sentry: 1, captain: 1 };
}
/** THE CELLS: a dropped one lies this long; a cradle charges again this long after its cell is taken; the bridge's this
 *  long. */
export const KT_CELL_LIES_MS = 15_000;
export const KT_CRADLE_BACK_MS = 28_000;   // KETCH-LONGER: 20 s before
export const KT_BRIDGE_CRADLE_BACK_MS = 12_000;
/** THE SPIDERS: two from the vents every this long while the engine starves, at most 3 + the crew alive at once. */
export const KT_SPIDER_EVERY_MS = 6000;   // KETCH-LONGER: 9 s before
export const KT_SPIDERS_AT_ONCE = 2;
export const spidersMaxFor = (n) => 5 + Math.max(1, Math.min(KT_CREW_MAX, n | 0));   // KETCH-LONGER: 3 + the crew before
/** The cradles' and the sockets' numbers on the wire: the hold's 0-5, the bridge's 10-11; the engine's sockets 0-6, the
 *  resonators 10-13. */
export const KT_BRIDGE_CRADLE0 = 10;
export const KT_RESONATOR0 = 10;
/** Constructs are numbered from here (the Warden is KW_ID, a fork KW_FORK_ID0 + its place), and their blows from here -
 *  apart from the Warden's own (its fight counts its own from 1). AUDIT KETCH L1-1: ABOVE THE FORKS' SIXTEEN - a hit on
 *  KW_FORK_ID0..+15 is the Warden's fight's (voyageWord), so a construct numbered there (from 100, the Engine's spiders
 *  reached 200 some six minutes in) took no blow at all; numbered up from 1000 none ever is (a voyage spawns some thirty
 *  thousand at the very most, well under the wire's KT_BODY_ID_MAX). */
export const KT_BODY_ID0 = 1000;
export const KT_BLOW_ID0 = 500_000;
/** How long the census keeps a member standing for whom no pose speaks (the Hour's SD_POSE_FRESH_MS). */
export const KT_POSE_FRESH_MS = 25_000;

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
/** THE STEP LAW (AUDIT KETCH L1-7 - the relay believed any pose: a cell banked a moment after its pick, the bridge unbarred
 *  from the hold): no member is believed faster than the fastest build runs (KT_FAST_RUN_MPS - net/eliteGates/egSpanLaw.js
 *  EG_FAST_RUN_MPS, pinned equal; a carrier at KT_CARRY_PACE of it), less KT_STEP_SLACK and a body's breadth. A time bound,
 *  the Elite Gates' crossing law's (egCrossMin): a legitimate crew is never refused, a warp waits what a run would take. */
export const KT_FAST_RUN_MPS = ((100 + 150) / 39.5) * (1.35 + 100 / 200) * 1.1;
export const KT_CARRY_PACE = 0.72;
export const KT_STEP_SLACK = 0.15;
const STEP_SPARE_M = 2;
/** The least time (ms) a body takes over `d` metres, carrying or not. */
export const ktLeastMs = (d, carrying = false) => (Math.max(0, d - STEP_SPARE_M) / (KT_FAST_RUN_MPS * (carrying ? KT_CARRY_PACE : 1))) * (1 - KT_STEP_SLACK) * 1000;
/** The Sailwalk's least crossing - the span's top to the gangway's head - and the least from the engine fed to the bridge
 *  (the mast-lift's rise first; nothing else climbs the 28 m faster). */
export const KT_CROSS_LEAST_MS = ktLeastMs(KT_GANGWAY.az - KT_COURSE_SPEC.start.z);
export const KT_SAILWALK_LEAST_MS = KT_LIFT.rise * 1000 * (1 - KT_STEP_SLACK) + KT_CROSS_LEAST_MS;
const r2 = (v) => Math.round(v * 100) / 100;

/**
 * A ship's voyage, new: its room's key, nobody aboard, the Watch standing ready.
 * @param {string} key @param {number} now
 */
export function newVoyage(key, now) {
  const r = ketchRoomOf(key);
  return {
    v: 1, key, n: r?.n ?? -1, owner: r?.owner ?? '', at: now,
    /** @type {string[]} the accounts taken aboard, in order */
    crew: [],
    /** @type {Record<string, any>} each member's record: its name, level, hand and purse, census */
    players: {},
    sg: KT_STAGE.watch, sgAt: now,
    /** @type {any[]} */
    bodies: [], nid: KT_BODY_ID0, seq: KT_BLOW_ID0,
    /** @type {any[]} the constructs' blows in flight */
    blows: [],
    watch: { wave: 0, nextAt: 0, firstAt: 0 },
    cells: {
      cr: KT_CRADLES.map(() => ({ ready: 1, backAt: 0 })), br: KT_BRIDGE_CRADLES.map(() => ({ ready: 1, backAt: 0 })),
      /** @type {Array<{ id: number, x: number, y: number, z: number, until: number, on: 'hold'|'bridge' }>} */
      lo: [], carry: /** @type {Record<string, { id: number, on: 'hold'|'bridge' }>} */ ({}), nid: 1, banked: 0, need: 0, sk: KT_SOCKETS.map(() => 0), sent: '',
    },
    spidersAt: 0,
    /** @type {{ at: number, by: string } | null} */
    bridge: null,
    /** @type {any} the Tonal Warden's fight (net/ketch/ketchWarden.js), once a member has said `in` */
    wf: null, wfi: 0,
    /** @type {Record<string, number>} */
    threat: {}, hpSent: '', hpAt: 0,
    /** @type {{ at: number, top: string[], n: number } | null} */
    fell: null,
    /** @type {Record<string, string>} receipts minted at the fall, by account */
    rc: {}, said: false, told: false,
    lastStateAt: now, lastTickAt: now,
  };
}

/**
 * A MEMBER COMES ABOARD (the room's door already said yes - net/ketch/ketchLaw.js ketchAdmits): taken into the crew (once
 * a voyage), its record made with a full hand and purse at its level, its name kept. Answers whether it is new.
 * @param {any} V @param {string} sub @param {string} name @param {number} lv @param {number} now
 */
export function joinVoyage(V, sub, name, lv, now) {
  const known = V.players[sub];
  const level = clampLv(lv);
  if (known) { if (name) known.name = String(name).slice(0, 24); known.seenAt = now; return false; }
  V.crew.push(sub);
  V.players[sub] = {
    name: String(name ?? '').slice(0, 24), lv: level, dealt: 0, clipped: 0, bucket: BUCKET_DEPTH_X * dpsRef(level), bucketAt: now,
    rate: GATE_HIT_HZ_MAX, rateAt: now, stoodMs: 0, joinedAt: now, seenAt: now, banked: 0, felled: 0,
  };
  if (!V.watch.firstAt) V.watch.firstAt = now;
  return true;
}

/** An absent member's place is kept this long whatever else - a reload, a death and the anchor-lift again. */
export const KT_PLACE_KEEP_MS = 5 * 60_000;
/**
 * THE PLACES A FULL SHIP MAY FREE (AUDIT KETCH L1-5 - a member who quit kept its place for the whole voyage; the gate's
 * AUDIT WB A1 freeSeat): a member with no socket aboard (`present`), unseen KT_PLACE_KEEP_MS, and with no real part in
 * the Warden's fight (hasPart - a claim earned keeps its place). The room frees the first the hub says has left the
 * captain's party (server/src/index.js _ktFreePlace), never the captain.
 * @param {any} V @param {Set<string>} present @param {number} now @returns {string[]}
 */
export function idlePlaces(V, present, now) {
  return V.crew.filter((s) => !present.has(s) && now - (V.players[s]?.seenAt ?? 0) >= KT_PLACE_KEEP_MS && !(V.wf?.players?.[s] && hasPart(V.wf.players[s])));
}
/** A PLACE FREED: the member out of the crew and its record, its cell let fall, its seat in the fight with it. */
export function freePlace(V, sub, now) {
  const out = [];
  if (!V.players[sub]) return out;
  dropCell(V, sub, null, now, 'left', out);
  V.crew = V.crew.filter((s) => s !== sub);
  delete V.players[sub];
  if (V.wf?.players?.[sub]) freeSeat(V.wf, new Set(Object.keys(V.wf.players).filter((s) => s !== sub)));
  return out;
}

/** The crew aboard and alive by the census (`bodies`), each with its floor and whether it carries. */
function livingCrew(V, bodies) {
  return bodies.filter((b) => !b.dead && V.players[b.sub]).map((b) => ({ ...b, zone: deckZoneAt(b.x, b.y, b.z), carry: !!V.cells.carry[b.sub] }));
}
/** The crew this voyage counts as aboard - seen in the last KT_POSE_FRESH_MS - and their mean level. */
function aboard(V, now) {
  const list = V.crew.filter((s) => now - (V.players[s]?.seenAt ?? 0) <= KT_POSE_FRESH_MS);
  const n = Math.max(1, list.length), lv = list.length ? list.reduce((t, s) => t + V.players[s].lv, 0) / list.length : 1;
  return { n, lv };
}
/** A floor's living crew: its zone (or zones) on the deck plan. */
const FLOOR_ZONES = Object.freeze({ waist: ['waist', 'anchor'], landing: ['gallery', 'landing'], hold: ['hold'], bridge: ['bridge', 'gangway'] });

/** THE BRIDGE'S SPAWNS - the Discord's Sentries, by their resonators: six tenths of the way out to each, clear of the bridge's
 *  obstacles by the widest body's breadth (AUDIT KETCH L4-10: the one by resonator 2 rose inside a cradle). */
export const KT_BRIDGE_SPAWNS = Object.freeze(KT_RESONATORS.map(([x, z]) => Object.freeze(clearOf('bridge', KT_BRIDGE.x + (x - KT_BRIDGE.x) * 0.62, KT_BRIDGE.z + (z - KT_BRIDGE.z) * 0.62, 1.0))));
/** A body born: its record kept, its word fanned. */
function spawn(V, kind, floor, x, z, yw, now, out, { wake = true, rise = KT_RISE_MS } = {}) {
  const { n, lv } = aboard(V, now);
  const B = newConstruct(V.nid++, kind, floor, x, z, yw, constructHp(kind, lv, n), now, { wake, upAt: now + rise });
  V.bodies.push(B);
  out.push({ k: 'nb', b: bodyWord(B), up: B.upAt, wk: wake ? 1 : 0 });
  return B;
}
/** The stage moves on: said, its moment kept. */
function toStage(V, sg, now, out, extra = {}) {
  V.sg = sg; V.sgAt = now;
  out.push({ k: 'sg', sg, at: now, ...extra });
}
/** Spots for `count` of a kind out of `spots`, by the dice (each used once a wave while there are enough). */
function pickSpots(spots, count, rng) {
  const pool = spots.map((p) => p), out = [];
  for (let i = 0; i < count; i++) {
    if (!pool.length) pool.push(...spots);
    out.push(pool.splice(Math.floor(rng() * pool.length) % pool.length, 1)[0]);
  }
  return out;
}

// ── the cells ─────────────────────────────────────────────────────────
/** The cells as the wire says them: the hold's cradles and the bridge's (1 charged, else when it is again), the cells
 *  lying loose, who carries which, how many the engine holds of how many it needs, its sockets. */
export function cellsWord(V) {
  const C = V.cells;
  return {
    k: 'cl', cr: C.cr.map((c) => (c.ready ? 1 : c.backAt)), br: C.br.map((c) => (c.ready ? 1 : c.backAt)),
    lo: C.lo.map((l) => [l.id, r2(l.x), r2(l.y), r2(l.z), l.until]), ca: Object.entries(C.carry).map(([s, c]) => [s, c.id]),
    bk: C.banked, nd: C.need, sk: [...C.sk],
  };
}
function cellsFrame(V, out) {
  const w = cellsWord(V), key = JSON.stringify(w);
  if (key === V.cells.sent) return;
  V.cells.sent = key;
  out.push(w);
}
/** A carrier lets its cell go where it stands (its feet, the deck's frame) - `why` said with it. */
export function dropCell(V, sub, at, now, why, out) {
  const c = V.cells.carry[sub];
  if (!c) return false;
  delete V.cells.carry[sub];
  if (at && Number.isFinite(at.x) && Number.isFinite(at.z)) V.cells.lo.push({ id: c.id, x: at.x, y: Number.isFinite(at.y) ? at.y : 0, z: at.z, until: now + KT_CELL_LIES_MS, on: c.on, ox: c.x, oz: c.z, oa: c.at });   // AUDIT SHIP 3: where and when it was first taken up, lying with it
  out.push({ k: 'drop', s: sub, n: V.players[sub]?.name ?? '', why, at: now });
  cellsFrame(V, out);
  return true;
}

// ── the beat ──────────────────────────────────────────────────────────
/**
 * ONE BEAT of the voyage. `bodies` the crew on the ship now ({sub, x, y, z, dead}, the deck's frame); `rng` [0,1). Answers
 * the frames to fan, in order. Moves the state.
 */
export function stepVoyage(V, now, bodies, rng) {
  const out = [];
  const dt = Math.min(STEP_MAX_MS, Math.max(0, now - V.lastTickAt));
  V.lastTickAt = now;
  for (const b of bodies) { const p = V.players[b.sub]; if (p) { p.seenAt = now; if (!b.dead) p.stoodMs += dt; } }
  const live = livingCrew(V, bodies);
  // a carrier fallen, or out of the floor its cell is of, lets it go
  for (const b of bodies) {
    const c = V.cells.carry[b.sub];
    if (!c) continue;
    const zone = deckZoneAt(b.x, b.y, b.z);
    if (b.dead) dropCell(V, b.sub, b, now, 'fell', out);
    else if (c.on === 'hold' ? zone !== 'hold' : zone !== 'bridge') dropCell(V, b.sub, null, now, 'left', out);
  }
  for (const sub of Object.keys(V.cells.carry)) if (!bodies.some((b) => b.sub === sub)) dropCell(V, sub, null, now, 'left', out);
  // the bodies down a while are taken off; the blows landed are let go
  V.bodies = V.bodies.filter((B) => B.h > 0 || now - B.downAt < KT_DOWN_KEEP_MS);
  V.blows = V.blows.filter((b) => now < b.at + Math.max(1, b.sp ?? 0) + 1500);
  const keep = Math.pow(1 - THREAT_DECAY, dt / 1000);
  for (const k of Object.keys(V.threat)) { V.threat[k] *= keep; if (V.threat[k] < 0.5) delete V.threat[k]; }
  stageBeat(V, now, live, rng, out);
  // the constructs' beats, each at the living crew on its own floor
  const S = { seq: V.seq };
  for (const B of V.bodies) {
    if (!(B.h > 0) || now < B.upAt) continue;
    const zones = FLOOR_ZONES[B.floor] ?? [];
    const here = live.filter((q) => zones.includes(q.zone));
    if (!B.wake) continue;
    beatConstruct(B, now, here, V.threat, rng, S, out, V.blows);
  }
  V.seq = S.seq;
  cellsBeat(V, now, out);
  hpFrame(V, now, out);
  if (now - V.lastStateAt >= STATE_SEND_MS) { V.lastStateAt = now; out.push(voyageStateOf(V, now)); }
  return out;
}

function stageBeat(V, now, live, rng, out) {
  const { n } = aboard(V, now);
  if (V.sg === KT_STAGE.watch) {
    const W = V.watch, standing = V.bodies.some((B) => B.floor === 'waist' && B.h > 0);
    if (W.wave === 0) {
      const inWaist = live.some((q) => q.zone === 'waist');
      if (V.crew.length && (inWaist || (W.firstAt && now - W.firstAt >= KT_WATCH_WAIT_MS))) startWave(V, 1, n, now, rng, out);
    } else if (!standing) {
      if (!W.nextAt) W.nextAt = now + KT_WAVE_GAP_MS;
      else if (now >= W.nextAt) {
        W.nextAt = 0;
        if (W.wave >= KT_WATCH_WAVES) { toStage(V, KT_STAGE.gallery, now, out); wardensUp(V, now, out); } else startWave(V, W.wave + 1, n, now, rng, out);
      }
    }
  } else if (V.sg === KT_STAGE.gallery) {
    const W = V.bodies.filter((B) => B.kind === 'warden');
    if (W.some((B) => !B.wake) && live.some((q) => (q.zone === 'gallery' || q.zone === 'landing') && q.z >= KT_WARDEN_WAKE_Z)) for (const B of W) if (!B.wake) { B.wake = true; out.push({ k: 'wk', o: B.id, at: now }); }
    // AUDIT SHIP 5: the wardens down or taken off (KT_DOWN_KEEP_MS) - a beat late past the last one's fall wedges nothing
    if (!W.some((B) => B.h > 0)) { toStage(V, KT_STAGE.engine, now, out); V.cells.need = engineNeeds(n); V.spidersAt = now + KT_SPIDER_EVERY_MS / 2; cellsFrame(V, out); }
  } else if (V.sg === KT_STAGE.engine) {
    if (V.cells.banked >= V.cells.need) {
      for (const B of V.bodies) if (B.floor === 'hold' && B.h > 0) { B.h = 0; B.downAt = now; out.push({ k: 'dn', o: B.id, n: '', at: now }); }
      toStage(V, KT_STAGE.sailwalk, now, out);
    } else if (now >= V.spidersAt) {
      V.spidersAt = now + KT_SPIDER_EVERY_MS;
      const alive = V.bodies.filter((B) => B.kind === 'spider' && B.h > 0).length, room = Math.max(0, spidersMaxFor(n) - alive);
      for (const [vx, vz] of pickSpots(KT_VENTS, Math.min(KT_SPIDERS_AT_ONCE, room), rng)) spawn(V, 'spider', 'hold', vx - Math.sign(vx) * 1.2, vz, vx > 0 ? -Math.PI / 2 : Math.PI / 2, now, out, { rise: 600 });
    }
  } else if (V.sg === KT_STAGE.sailwalk) {
    // the step law: a member seen at the main top crosses no faster than the fastest run; nobody before the lift's rise and that
    for (const q of live) if (q.zone === 'top' && V.players[q.sub]) V.players[q.sub].topAt = now;
    const first = now - V.sgAt >= KT_SAILWALK_LEAST_MS ? live.find((q) => (q.zone === 'gangway' || q.zone === 'bridge') && now - (V.players[q.sub]?.topAt ?? V.sgAt) >= KT_CROSS_LEAST_MS) : null;
    if (first) { V.bridge = { at: now, by: V.players[first.sub]?.name ?? '' }; toStage(V, KT_STAGE.bridge, now, out, { by: V.bridge.by }); }
  } else if (V.sg === KT_STAGE.bridge && V.wf) {
    const f = V.wf;
    const frames = KETCH_SEAM.step(f, now, live.map((q) => ({ sub: q.sub, x: q.x, y: q.y, z: q.z, dead: false })), rng);
    out.push(...frames);
    while (f.want.length) {
      const kind = f.want.shift(), k = V.nid % KT_RESONATORS.length, spot = KT_RESONATORS[k], at = KT_BRIDGE_SPAWNS[k];
      spawn(V, kind, 'bridge', at[0], at[1], Math.atan2(KT_BRIDGE.x - spot[0], KT_BRIDGE.z - spot[1]), now, out);
    }
    if (f.lost) {
      // A FIGHT LOST: the bridge's constructs go, the Warden stands at its helm again, the next `in` is fresh
      for (const B of V.bodies) if (B.floor === 'bridge' && B.h > 0) { B.h = 0; B.downAt = now; out.push({ k: 'dn', o: B.id, n: '', at: now }); }
      for (const sub of Object.keys(V.cells.carry)) if (V.cells.carry[sub].on === 'bridge') dropCell(V, sub, null, now, 'lost', out);
      V.cells.lo = V.cells.lo.filter((l) => l.on !== 'bridge');
      V.wf = null;
      out.push({ k: 'wl', at: now });
    } else if (f.fell && !V.fell) {
      V.fell = { at: f.fell.at, top: f.fell.top, n: f.fell.n };
      for (const B of V.bodies) if (B.h > 0) { B.h = 0; B.downAt = now; out.push({ k: 'dn', o: B.id, n: '', at: now }); }
      V.cells.carry = {}; V.cells.lo = [];
      cellsFrame(V, out);   // AUDIT SHIP 6: the hands emptied said
      toStage(V, KT_STAGE.vault, now, out);
      out.push({ k: 'fell', ...f.fell });
    }
  }
}
function startWave(V, w, n, now, rng, out) {
  V.watch.wave = w;
  const plan = watchWave(w, n);
  for (const [x, z] of pickSpots(KT_WATCH_SPOTS.sphere, plan.sphere, rng)) spawn(V, 'sphere', 'waist', x, z, x > 0 ? -Math.PI / 2 : x < 0 ? Math.PI / 2 : Math.PI, now, out);
  for (const [x, z] of pickSpots(KT_WATCH_SPOTS.sentry, plan.sentry, rng)) spawn(V, 'sentry', 'waist', x, z, Math.PI, now, out);
  if (plan.captain) spawn(V, 'captain', 'waist', KT_WATCH_SPOTS.captain[0], KT_WATCH_SPOTS.captain[1], Math.PI, now, out, { rise: 2200 });
  out.push({ k: 'wave', w, at: now });
}
function wardensUp(V, now, out) {
  for (const [x, z] of KT_WARDEN_POSTS) spawn(V, 'warden', 'landing', x, z, Math.PI, now, out, { wake: false, rise: 0 });
}
function cellsBeat(V, now, out) {
  const C = V.cells;
  let moved = false;
  for (const c of [...C.cr, ...C.br]) if (!c.ready && now >= c.backAt) { c.ready = 1; c.backAt = 0; moved = true; }
  const before = C.lo.length;
  C.lo = C.lo.filter((l) => now < l.until);
  if (moved || C.lo.length !== before) cellsFrame(V, out);
}
function hpFrame(V, now, out) {
  if (now - V.hpAt < HP_SEND_MS) return;
  const h = V.bodies.filter((B) => B.h > 0 || now - B.downAt < 100).map((B) => [B.id, Math.ceil(Math.max(0, B.h))]), key = JSON.stringify(h);
  if (key === V.hpSent) return;
  V.hpSent = key; V.hpAt = now;
  out.push({ k: 'hp', h });
}

// ── the words ─────────────────────────────────────────────────────────
/**
 * A MEMBER'S WORD (`m`, the wire's - net/wire.js validKetchIn) from `sub`, its socket's own pose `pose` ({x, y, z, dead},
 * the deck's frame, or null). Answers the frames to fan (a `no` frame is the member's alone - `to`). Moves the state.
 *   in {lv}                - joins the bridge's fight (a member alive on the bridge, the bridge reached)
 *   hit {o, d, r, q}       - a blow: on construct `o`, the Warden (KW_ID) or a fork (KW_FORK_ID0 + its place)
 *   pick {c} | pick {l}    - a cell taken from cradle `c` or up from where cell `l` lies
 *   bank {s}               - the cell carried set in socket `s` (the engine's) or resonator `s` (KT_RESONATOR0 + k)
 *   drop {} | hurt {}      - the cell let go, or knocked out of the hands by a blow the member's machine saw land
 * @param {any} V @param {string} sub @param {any} m @param {any} pose @param {number} now @param {() => number} rng
 */
export function voyageWord(V, sub, m, pose, now, rng) {
  const out = [];
  const p = V.players[sub];
  if (!p || !m) return out;
  const alive = !!pose && !pose.dead;
  const at = alive ? pose : null;
  if (m.k === 'in') {
    if (V.sg !== KT_STAGE.bridge || !at || deckZoneAt(at.x, at.y, at.z) !== 'bridge') return out;
    if (!V.wf || V.wf.lost) { V.wf = KETCH_SEAM.new({ room: V.key, fi: ++V.wfi, now }); out.push({ k: 'wf', fi: V.wfi, at: now }); }
    const present = new Set(V.crew.filter((s) => now - (V.players[s]?.seenAt ?? 0) <= KT_POSE_FRESH_MS));
    if (KETCH_SEAM.join(V.wf, sub, p.name, Number.isFinite(m.lv) ? m.lv : p.lv, now, present)) out.push({ ...KETCH_SEAM.stateOf(V.wf), to: sub, me: 1 });
    const q = V.wf.players[sub];
    if (q && !q.bf && p.bd?.fs != null) q.bf = { s: 0, d: 0 };   // fallen before it joined: the fight saw it stand at nothing
    return out;
  }
  if (m.k === 'hit') {
    if (!at) return out;
    if (m.o === KW_ID || (m.o >= KW_FORK_ID0 && m.o < KW_FORK_ID0 + 16)) {
      const f = V.wf;
      if (!f || !spendBlow(p, now, m.q ?? null, `w${m.o}`)) return out;
      const spend = (d, left) => spendPurse(p, d, left, now);
      if (m.o === KW_ID) KETCH_SEAM.hit(f, sub, m.d, m.r, at, now, m.q, { spend });
      else out.push(...applyForkHit(f, sub, m.o - KW_FORK_ID0, m.d, m.r, at, now, spend));
      return out;
    }
    const B = V.bodies.find((q) => q.id === m.o);
    if (!B) return out;
    const wasAwake = B.wake;
    const got = hitConstruct(B, p, m.d, m.r, at, now, m.q ?? null);
    if (got > 0) V.threat[sub] = (V.threat[sub] ?? 0) + got;
    if (!wasAwake && B.wake) out.push({ k: 'wk', o: B.id, at: now });
    if (got > 0 && B.h <= 1e-6) { B.h = 0; B.downAt = now; stepWalk(B, now); B.mv = null; B.atk = null; p.felled += 1; out.push({ k: 'dn', o: B.id, n: p.name, at: now }); }
    return out;
  }
  const C = V.cells;
  if (m.k === 'pick') {
    if (!at || C.carry[sub]) return out;
    const zone = deckZoneAt(at.x, at.y, at.z);
    const engine = V.sg === KT_STAGE.engine && zone === 'hold', discord = V.sg === KT_STAGE.bridge && zone === 'bridge' && !!V.wf?.ward;
    if (!engine && !discord) return out;
    if (Number.isInteger(m.c)) {
      const list = engine ? C.cr : C.br, spots = engine ? KT_CRADLES : KT_BRIDGE_CRADLES, j = engine ? m.c : m.c - KT_BRIDGE_CRADLE0;
      const cr = list[j], spot = spots[j];
      if (!cr || !cr.ready || dist(at.x, at.z, spot[0], spot[1]) > KT_REACH + 0.6) return out;
      cr.ready = 0; cr.backAt = now + (engine ? KT_CRADLE_BACK_MS : KT_BRIDGE_CRADLE_BACK_MS);
      C.carry[sub] = { id: C.nid++, on: engine ? 'hold' : 'bridge', x: at.x, z: at.z, at: now };
    } else if (Number.isInteger(m.l)) {
      const li = C.lo.findIndex((l) => l.id === m.l && l.on === (engine ? 'hold' : 'bridge'));
      const l = C.lo[li];
      if (!l || dist(at.x, at.z, l.x, l.z) > KT_REACH + 0.6 || Math.abs((at.y ?? 0) - l.y) > 2.5) return out;
      C.lo.splice(li, 1);
      C.carry[sub] = { id: l.id, on: l.on, x: l.ox ?? at.x, z: l.oz ?? at.z, at: l.oa ?? now };   // AUDIT SHIP 3: the step law's start kept - a cell let go where its carrier claimed and taken up again banks no sooner
    } else return out;
    out.push({ k: 'pick', s: sub, n: p.name, at: now });
    cellsFrame(V, out);
    return out;
  }
  if (m.k === 'bank') {
    const c = C.carry[sub];
    if (!at || !c || !Number.isInteger(m.s)) return out;
    const far = (spot) => now - c.at < ktLeastMs(dist(c.x, c.z, spot[0], spot[1]), true);   // the step law: carried there no faster than the fastest run
    if (c.on === 'hold') {
      const spot = KT_SOCKETS[m.s];
      if (V.sg !== KT_STAGE.engine || !spot || C.sk[m.s] || dist(at.x, at.z, spot[0], spot[1]) > KT_REACH + 0.6 || Math.abs((at.y ?? 0) - KT_HOLD.y) > 2.5 || far(spot)) return out;
      C.sk[m.s] = 1; C.banked += 1;
    } else {
      const k = m.s - KT_RESONATOR0, spot = KT_RESONATORS[k];
      if (!V.wf || !spot || V.wf.rs[k] !== 0 || dist(at.x, at.z, spot[0], spot[1]) > KT_REACH + 0.6 || far(spot)) return out;
      out.push(...retune(V.wf, k, now));
    }
    delete C.carry[sub];
    p.banked += 1;
    out.push({ k: 'bank', s: sub, n: p.name, at: now, sk: m.s });
    cellsFrame(V, out);
    return out;
  }
  if (m.k === 'drop' || m.k === 'hurt') { dropCell(V, sub, at, now, m.k === 'hurt' ? 'struck' : 'let', out); return out; }
  return out;
}

/** THE WHOLE SHIP as the wire says it (`st`): its voyage, its stage, its crew (account, name), its bodies and their walks,
 *  the blows in flight, its cells, its bridge, the Warden's fight, its fall. */
export function voyageStateOf(V, now) {
  return {
    k: 'st', n: V.n, sg: V.sg, sga: V.sgAt, cr: V.crew.map((s) => [s, V.players[s]?.name ?? '']),
    bd: V.bodies.map((B) => [...bodyWord(B), B.wake ? 1 : 0, B.upAt]), mv: V.bodies.filter((B) => B.mv && B.h > 0).map((B) => mvWord(B, now)),
    bl: V.blows.map((b) => ({ ...b })), wv: V.watch.wave, cl: cellsWord(V),
    br: V.bridge ? { at: V.bridge.at, by: V.bridge.by } : null, ws: V.wf ? KETCH_SEAM.stateOf(V.wf) : null,
    fell: V.fell ? { ...V.fell } : null,
  };
}
/** The members who earned a receipt at the fall (the gate's law, on the Warden's fight). */
export const voyageEarners = (V) => (V.wf?.fell ? Object.keys(V.wf.players).filter((s) => KETCH_SEAM.earned(V.wf, s)) : []);
/**
 * THE FIGHT'S OWN FIRST FALL (AUDIT KETCH L1-12 - a receipt's measure asked the fight's law of the voyage's figures, so a
 * member felled in the Gallery read as one whose receipt would have stood): the count keeps a member's body on its
 * voyage record (`bd`, its first fall's `fs`/`fd` the voyage's stood and dealt); the fight keeps the figures it stood at
 * then (`bf`) - nothing for a fall before it joined (voyageWord's `in`), its own at the beat the count felled it after
 * (the relay calls this after each count). fightBodyOf is the body a receipt's measure reads.
 */
export function stampFightFall(V) {
  for (const [s, q] of Object.entries(V.wf?.players ?? {})) if (!q.bf && V.players[s]?.bd?.fs != null) q.bf = { s: q.stoodMs ?? 0, d: q.dealt ?? 0 };
}
export function fightBodyOf(V, sub) {
  const b = V.players[sub]?.bd, q = V.wf?.players?.[sub];
  return b && b.fs != null ? { ...b, fs: q?.bf?.s ?? 0, fd: q?.bf?.d ?? 0 } : b;
}
/** Does the voyage's room hold its fight's floors live now (the relay arms its beat while a member stands aboard)? */
export const voyageLive = (V) => !!V && !V.said;
/** The floors' names for a body's floor (the page's). */
export { KT_FLOORS, KT_KINDS };
