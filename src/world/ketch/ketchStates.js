// @ts-check
// KETCH-LOOK KL3 (bible/11-Multiplayer/Sky-Ketch-Look.md "The shared kit", "Her three states", "The PVS"): ONE LAW UNDER
// EVERYTHING - pure. Every pass, board, sound, song and HUD line reads one kept record of her state (ketchStatesOf), each
// field from the link's state (net/ketch/ketchLink.js - the room's word, folded) or the shared clock, so the deck, the
// passes, the air and the score read the same number on every screen; it builds nothing a frame (AUDIT KETCH L3-16's
// law). And THE PVS (KT_PVS): the part groups each zone of her can see - the deck host writes the rest `culled`, the
// dungeon loop's own flag, which issues no draw and records no shadow.
//
// Not a DFU member. Ledger A (KETCH).
import {
  KT_CRADLES, KT_BRIDGE_CRADLES, KT_SOCKETS, KT_HAMMER, KT_STEAM, KT_ARCS, KT_SECTIONS, KT_LIFT, KT_LIFT_CYCLE, KT_HATCH, KT_HOLD_HATCH,
  KT_CABIN, KT_GANGWAY, liftYAt, deckZoneAt, hammerPhase,
} from '../../net/ketch/ketchDeck.js';
import { KT_STAGE, ketchVoyageOf } from '../../net/ketch/ketchLaw.js';
import { KT_CELL_LIES_MS, KT_CRADLE_BACK_MS, KT_BRIDGE_CRADLE_BACK_MS, KT_SPIDER_EVERY_MS, KT_WAVE_GAP_MS, spidersMaxFor } from '../../net/ketch/ketchBrain.js';
import { KW_SECTION_WARN_MS } from '../../net/ketch/ketchWarden.js';
import { KT_KIND_BY_K } from '../../net/ketch/ketchConstructs.js';
import { hazardState } from './ketchPose.js';

/** HER THREE STATES: ASLEEP from the hello until the engine is fed (`sg` before the Sailwalk); AWAKE from its waking
 *  until the Warden's fight opens, and again after its end; SINGING while the Warden's fight lives (`now >= ws.op`,
 *  neither fallen nor lost). */
export const KT_SHIP = Object.freeze({ asleep: 0, awake: 1, singing: 2 });
/** The lift's four parts of its round: at the foot, rising, at the top, falling (`liftYAt`'s law). */
export const KT_LIFT_PART = Object.freeze({ foot: 0, rising: 1, top: 2, falling: 3 });
/** How many loose cells the record holds (the deck draws as many - scenes/ketch/ketchDeckHost.js KT_LOOSE_MAX). */
export const KT_STATES_LOOSE = 16;

const clamp01 = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v);
const _hz = { live: false, warn: false, k: 0 };

/** The record's shape (ketchStatesOf's `out`), every array its own. */
export function ketchStatesRecord() {
  return {
    ship: /** @type {number} */ (KT_SHIP.asleep), sg: /** @type {number} */ (KT_STAGE.watch), sga: 0, n: -1,
    cradles: new Float32Array(KT_CRADLES.length), bcradles: new Float32Array(KT_BRIDGE_CRADLES.length),
    sockets: new Uint8Array(KT_SOCKETS.length), loose: new Float32Array(KT_STATES_LOOSE), looseN: 0, carried: 0,
    banked: 0, need: 0, appetite: 0, wakeAge: -1,
    lift: { y: /** @type {number} */ (KT_LIFT.y0), phase: 0, part: /** @type {number} */ (KT_LIFT_PART.foot), runs: false, gateHold: false, gateTop: false },
    hammers: new Float32Array(KT_HAMMER.rows.length * KT_HAMMER.lanes.length), steam: new Float32Array(KT_STEAM.z.length), arcs: new Float32Array(KT_ARCS.z.length),
    pourAt: 0, wave: 0, waveAt: 0, waveGap: 1,
    secWarn: new Float32Array(KT_SECTIONS), secGone: new Uint8Array(KT_SECTIONS), secBack: new Float32Array(KT_SECTIONS),
    resonators: new Int8Array(4), discordAt: 0, songAt: 0, forks: new Float32Array(8), forksN: 0,
    stunFrom: 0, stunUntil: 0, turnUntil: 0, ends: 0, fellAt: 0, lostAt: 0,
    voyage: null, crew: 0, chest: 0,
  };
}

/**
 * HER STATE NOW, into `out` (ketchStatesRecord's shape - every array written in place): `V` the link's state (null, or a
 * voyage not begun: asleep and empty), `t` the shared clock's seconds, `now` its ms, `me` what is mine (`owed` - my chest,
 * scenes/ketch/ketchShares.js). Pure but for two kept moments, the record's own: when a stun began (the first frame `su`
 * stood past `now`) and when the Watch's wave last moved.
 * @param {any} V @param {number} t @param {number} now @param {{ owed?: number } | null} [me]
 */
export function ketchStatesOf(V, t, now, me = null, out = ketchStatesRecord()) {
  const sg = V?.n >= 0 ? V.sg : KT_STAGE.watch, ws = V?.n >= 0 ? V.ws : null, cl = V?.n >= 0 ? V.cl : null;
  out.n = V?.n ?? -1; out.sg = sg; out.sga = V?.sga ?? 0;
  const singing = !!ws && now >= (ws.op ?? Infinity) && !ws.fell && !ws.lost;
  out.ship = singing ? KT_SHIP.singing : sg >= KT_STAGE.sailwalk ? KT_SHIP.awake : KT_SHIP.asleep;
  // the cells: the cradles' fills (1, or its backAt's share of the wait), the sockets, each loose cell's time left
  const fill = (v, ms) => (v === 1 ? 1 : clamp01(1 - (v - now) / ms));
  for (let j = 0; j < out.cradles.length; j++) out.cradles[j] = cl?.cr ? fill(cl.cr[j], KT_CRADLE_BACK_MS) : 1;
  for (let j = 0; j < out.bcradles.length; j++) out.bcradles[j] = cl?.br ? fill(cl.br[j], KT_BRIDGE_CRADLE_BACK_MS) : 1;
  for (let j = 0; j < out.sockets.length; j++) out.sockets[j] = cl?.sk?.[j] ? 1 : 0;
  out.looseN = 0;
  for (const l of cl?.lo ?? []) { if (out.looseN >= KT_STATES_LOOSE) break; out.loose[out.looseN++] = clamp01((l[4] - now) / KT_CELL_LIES_MS); }
  for (let j = out.looseN; j < KT_STATES_LOOSE; j++) out.loose[j] = 0;
  out.carried = cl?.ca?.length ?? 0;
  out.banked = cl?.bk ?? 0; out.need = cl?.nd ?? 0; out.appetite = out.need > 0 ? clamp01(out.banked / out.need) : 0;
  out.wakeAge = sg >= KT_STAGE.sailwalk && out.sga > 0 ? Math.max(0, now - out.sga) : -1;
  // the lift: its height, its place in the round, its gates
  const runs = sg >= KT_STAGE.sailwalk, L = out.lift;
  L.runs = runs; L.y = liftYAt(t, runs);
  L.phase = runs ? ((t % KT_LIFT_CYCLE) + KT_LIFT_CYCLE) % KT_LIFT_CYCLE : 0;
  const W = KT_LIFT.wait, R = KT_LIFT.rise;
  L.part = !runs || L.phase < W ? KT_LIFT_PART.foot : L.phase < W + R ? KT_LIFT_PART.rising : L.phase < 2 * W + R ? KT_LIFT_PART.top : KT_LIFT_PART.falling;
  L.gateHold = runs && L.y <= KT_LIFT.y0 + 0.05; L.gateTop = runs && L.y >= KT_LIFT.y1 - 0.05;
  // the hazards' wind-ups: each hammer's share of its draw-up (0 at rest, 1 at its slam), the lanes' and the coils'
  const H = KT_HAMMER, c = H.cycle, wu = H.wu / 1000;
  for (let ri = 0; ri < H.rows.length; ri++) for (let li = 0; li < H.lanes.length; li++) {
    const u = (((t - hammerPhase(ri, li)) % c) + c) % c;
    out.hammers[ri * H.lanes.length + li] = u >= c - wu ? (u - (c - wu)) / wu : 0;
  }
  for (let j = 0; j < out.steam.length; j++) { const s = hazardState('steam', j, t, _hz); out.steam[j] = s.live ? 1 : s.warn ? s.k : 0; }
  for (let j = 0; j < out.arcs.length; j++) { const s = hazardState('arc', j, t, _hz); out.arcs[j] = s.live ? 1 : s.warn ? s.k : 0; }
  // the spiders' next pour, from the law the page holds (the first at the waking's half-step, then every step while the
  // census stands under the most: a rare false breath where the relay's census and the page's crew differ costs a glow)
  out.pourAt = 0;
  if (sg === KT_STAGE.engine && out.sga > 0) {
    let alive = 0;
    for (const B of V.bodies ?? []) if (B.h > 0 && KT_KIND_BY_K[B.k]?.key === 'spider') alive++;
    const first = out.sga + KT_SPIDER_EVERY_MS / 2;
    if (alive < spidersMaxFor(V.crew?.length ?? 1)) out.pourAt = now < first ? first : first + Math.ceil((now - first) / KT_SPIDER_EVERY_MS) * KT_SPIDER_EVERY_MS;
  }
  // the Watch: its wave, and how far through the gap before the next a broken wave stands (its word's moment the first
  // frame the wave moved - the record's own)
  const wave = V?.n >= 0 ? V.wv ?? 0 : 0;
  if (wave !== out.wave) { out.wave = wave; out.waveAt = now; }
  out.waveGap = out.waveAt > 0 ? clamp01((now - out.waveAt) / KT_WAVE_GAP_MS) : 1;
  // the bridge's ring: each section's warning share, gone, and its return's share
  for (let k = 0; k < KT_SECTIONS; k++) { out.secWarn[k] = 0; out.secGone[k] = 0; out.secBack[k] = 0; }
  for (const e of ws?.sec ?? []) {
    const k = e[0], at = e[1], back = e[2];
    if (!(k >= 0 && k < KT_SECTIONS) || now >= back) continue;
    if (now < at) out.secWarn[k] = clamp01(1 - (at - now) / KW_SECTION_WARN_MS);
    else { out.secGone[k] = 1; out.secBack[k] = clamp01((now - at) / Math.max(1, back - at)); }
  }
  // the Warden's song: the resonators, the Discord, the Keel-Song and its forks, the stun, the turn, the end
  for (let j = 0; j < out.resonators.length; j++) out.resonators[j] = ws?.rs?.[j] ? 1 : 0;
  out.discordAt = ws?.da ?? 0; out.songAt = ws?.fk?.at ?? 0;
  out.forksN = 0;
  for (const q of ws?.fk?.c ?? []) { if (out.forksN >= out.forks.length) break; out.forks[out.forksN++] = clamp01(q[2] / Math.max(1, ws.fk.m)); }
  for (let j = out.forksN; j < out.forks.length; j++) out.forks[j] = 0;
  const su = ws?.su ?? 0;
  if (su > now) { if (out.stunUntil !== su) { out.stunUntil = su; out.stunFrom = now; } } else { out.stunUntil = 0; out.stunFrom = 0; }
  out.turnUntil = ws?.ou ?? 0; out.ends = ws?.ends ?? 0; out.fellAt = ws?.fell?.at ?? V?.fell?.at ?? 0; out.lostAt = ws?.lost ?? 0;
  out.voyage = out.n >= 0 ? ketchVoyageOf(out.n) : null;
  out.crew = V?.n >= 0 ? V.crew?.length ?? 0 : 0;
  out.chest = me?.owed ?? 0;
  return out;
}

/** THE PART GROUPS the deck draws (scenes/ketch/ketchDeckHost.js gives each part draw one; a draw without a group is never
 *  culled - the static ship, the land, the sky): the open decks, the masts and rigging aloft, the Sailwalk's dress, the gun
 *  deck, the hold, the bridge, the cabin. */
export const KT_GROUP = Object.freeze({ decks: 'decks', aloft: 'aloft', sailwalk: 'sailwalk', gundeck: 'gundeck', hold: 'hold', bridge: 'bridge', cabin: 'cabin' });
/** THE PVS - the groups each zone of her sees: the decks (the anchor deck, the waist, the lift) the open decks, the masts
 *  and the Sailwalk's dress; aloft (the top, the Sailwalk, the gangway) those and the bridge; below (the gallery, the
 *  landing, the hold) the gun deck and the hold; the bridge the bridge, the open decks, aloft and the Sailwalk; the cabin
 *  the cabin and the bridge. */
export const KT_PVS = Object.freeze({
  decks: Object.freeze(['decks', 'aloft', 'sailwalk']),
  aloft: Object.freeze(['decks', 'aloft', 'sailwalk', 'bridge']),
  below: Object.freeze(['gundeck', 'hold']),
  bridge: Object.freeze(['bridge', 'decks', 'aloft', 'sailwalk']),
  cabin: Object.freeze(['cabin', 'bridge']),
});
/** Within this of an opening (a hatch, the lift's foot, a doorway) both sides' groups stand, so nothing pops through it
 *  (m); a zone is held this far past the edge the eye began at, so a step back and forth flips nothing. */
export const KT_PVS_DOOR_M = 6;
export const KT_PVS_HOLD_M = 4;
/** AUDIT SHIP A3: the Watch's hatch reaches further - the gallery's hammers are seen down its stair from the waist (m). */
export const KT_PVS_HATCH_M = 14;
const HOLD_STEPS = Object.freeze([[KT_PVS_HOLD_M, 0], [-KT_PVS_HOLD_M, 0], [0, KT_PVS_HOLD_M], [0, -KT_PVS_HOLD_M]]);
/** The openings between the PVS's sides (deck [x, y, z]) and the views each joins. */
export const KT_PVS_DOORS = /** @type {ReadonlyArray<Readonly<{ at: ReadonlyArray<number>, join: ReadonlyArray<string>, r?: number }>>} */ (Object.freeze([
  Object.freeze({ at: Object.freeze([(KT_HATCH.x0 + KT_HATCH.x1) / 2, -3, (KT_HATCH.z0 + KT_HATCH.z1) / 2]), join: Object.freeze(['decks', 'below']), r: KT_PVS_HATCH_M }),
  Object.freeze({ at: Object.freeze([(KT_HOLD_HATCH.x0 + KT_HOLD_HATCH.x1) / 2, -9, (KT_HOLD_HATCH.z0 + KT_HOLD_HATCH.z1) / 2]), join: Object.freeze(['below']) }),
  Object.freeze({ at: Object.freeze([KT_LIFT.x, KT_LIFT.y0 + 1.6, KT_LIFT.z]), join: Object.freeze(['below', 'decks', 'aloft']) }),
  Object.freeze({ at: Object.freeze([(KT_CABIN.x0 + KT_CABIN.x1) / 2, 1.6, KT_CABIN.z0]), join: Object.freeze(['cabin', 'bridge']) }),
  Object.freeze({ at: Object.freeze([KT_GANGWAY.bx, 1.6, KT_GANGWAY.bz]), join: Object.freeze(['aloft', 'bridge']) }),
]));
/** The view a deck zone (net/ketch/ketchDeck.js deckZoneAt's word) belongs to, or null (off her floors: the last kept). */
export function pvsViewOf(zone) {
  switch (zone) {
    case 'anchor': case 'waist': return 'decks';
    case 'lift': return 'decks';
    case 'top': case 'sailwalk': case 'gangway': return 'aloft';
    case 'gallery': case 'landing': case 'hold': return 'below';
    case 'bridge': return 'bridge';
    case 'cabin': return 'cabin';
    default: return null;
  }
}
/**
 * THE GROUPS THE EYE SEES at deck point `p` (feet), into the Set `out`: its view's groups (the view held `KT_PVS_HOLD_M`
 * past its edge - `keep` the view it was in, null at first), and within `KT_PVS_DOOR_M` of an opening every view that
 * opening joins. Answers the view it holds (for the next frame's `keep`). Pure.
 * @param {ArrayLike<number>} p @param {string | null} keep @param {Set<string>} out
 */
export function pvsGroupsAt(p, keep, out) {
  out.clear();
  const here = pvsViewOf(deckZoneAt(p[0], p[1], p[2]));
  let view = here;
  if (keep && view !== keep) {
    // the view held while the eye stands within the hold of its old zone's floor
    for (const [dx, dz] of HOLD_STEPS) if (pvsViewOf(deckZoneAt(p[0] + dx, p[1], p[2] + dz)) === keep) { view = keep; break; }
  }
  view ??= keep ?? (p[1] < -1 ? 'below' : 'decks');
  for (const g of KT_PVS[view]) out.add(g);
  if (here && here !== view) for (const g of KT_PVS[here]) out.add(g);   // AUDIT SHIP A2: a view held, the zone the eye stands in seen with it
  for (const d of KT_PVS_DOORS) {
    if (Math.hypot(p[0] - d.at[0], p[1] - d.at[1], p[2] - d.at[2]) <= (d.r ?? KT_PVS_DOOR_M)) for (const v of d.join) for (const g of KT_PVS[v]) out.add(g);
  }
  return view;
}
