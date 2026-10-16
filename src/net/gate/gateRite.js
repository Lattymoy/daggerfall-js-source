// @ts-check
// WB12d (2026-10-01, Mac: "faithful and a Summoner"; then "Btw I want to do all 4. We're going balls deep with this"):
// THE FAITHFUL'S RITE - the law every client and the relay share with no word sent: where a breach's faithful work
// their rite (off the gate's own spot and facing - net/gate/gateLaw.js), who stands there, when the rite holds, and how many
// may break it. Design: bible/11-Multiplayer/World-Bosses.md section 19 D.
//
// PURE and imported by the relay: an edit here is an edit to the relay's law (test/net/relayversion.test.js).
//
// Not a DFU member. Ledger A (WB).
import { GATE_SALT, gateHash, gateRoll, gateSpotLocal, gateYaw, gateTimes, isGateDay, PIXEL_M, GATE_COLLAPSE_MS } from './gateLaw.js';

/** The circle stands this far from the arch, metres (its banner's 60 never reached). */
export const RITE_MIN_M = 90;
export const RITE_MAX_M = 180;
/** ...and never within this many degrees of the gate's two ways in (its own ±z - the rim spires' rule, world/gate/gateModel.js). */
export const RITE_OFF_APPROACH_DEG = 50;
/** A word is believed from a pose this near the circle, metres - a fight with the faithful drifts. */
export const RITE_REACH_M = 60;
/** A native unit's metres: a map pixel is PIXEL_UNITS (32768, net/wire.js) over PIXEL_M (819.2) - pinned equal. */
export const RITE_UNITS_PER_M = 40;
/** The faithful at a circle beside the Summoner: the day's roll in [MIN, MAX]. */
export const RITE_FAITHFUL_MIN = 6;
export const RITE_FAITHFUL_MAX = 8;
/** Their robed careers (characters/mobile/mobileTypes.js): Mage, Battlemage, Healer, Nightblade. The Summoner is a Sorcerer -
 *  a caster none of them is, so every screen knows him by his kind alone (a copy of a peer's carries no name). */
export const RITE_CAREERS = Object.freeze([128, 130, 132, 133]);
export const RITE_SUMMONER_CAREER = 131;
/** The Summoner's health over a caster's. */
export const RITE_SUMMONER_HEALTH = 3;
/** The most accounts a rite counts among those who broke it (a raid's bound). */
export const RITE_HELPERS_MAX = 64;
/** A player at the circle says the rite's word this often while it holds. */
export const RITE_WORD_MS = 5000;
/** The rite at the omen, in the chat and the channel alike (AUDIT WB12d D3): said right after the omen's own line -
 *  "nearby" the breach it just named - and before tonight's marks. */
export const RITE_OMEN_LINE = 'The faithful work their rite nearby. Kill their Summoner before the breach opens.';

const unit = (v) => v / 4294967296;

/**
 * The circle's offset from the gate in the gate's own frame, metres: [x across the arch, z through the fire] -
 * RITE_MIN_M to RITE_MAX_M out and within 40 degrees of the arch's x axis (so 50 or more off either way in), by the
 * day's rolls. AUDIT WB12d (L6): on the side of the arch, and of its axis, toward the heart of the gate's pixel - its
 * ground the pixel's own, the land the gate's scan chose (net/gate/gateLaw.js GATE_SPOT_SPREAD_M 200 and the circle's 180
 * leave it 140 m or more inside the pixel's edge, where a neighbour's sea never reaches; a side by the day's roll stood
 * it 30 m from the edge, in the shallows of a coast). Pure.
 * @param {number} day
 */
export function riteOffset(day) {
  const a = unit(gateRoll(day, 16)) * (90 - RITE_OFF_APPROACH_DEG) * (Math.PI / 180);
  const d = RITE_MIN_M + unit(gateRoll(day, 10)) * (RITE_MAX_M - RITE_MIN_M);
  const [sx, sz] = gateSpotLocal(day), yaw = gateYaw(day), c = Math.cos(yaw), s = Math.sin(yaw);
  const ux = PIXEL_M / 2 - sx, uz = PIXEL_M / 2 - sz;   // the spot to its pixel's heart, east and north
  const across = c * ux - s * uz >= 0 ? 1 : -1, through = s * ux + c * uz >= 0 ? 1 : -1;   // its two halves, in the gate's frame
  return [across * d * Math.cos(a), through * d * Math.sin(a)];
}

/**
 * Where the faithful work their rite: [east, north] metres from the gate pixel's south-west corner (gateSpotLocal's
 * frame) - the offset carried out of the gate's frame as the Broker's spot is (scenes/sigilBrokerPool.js). Pure.
 * @param {number} day
 */
export function riteLocalOf(day) {
  const [sx, sz] = gateSpotLocal(day), [lx, lz] = riteOffset(day);
  const yaw = gateYaw(day), c = Math.cos(yaw), s = Math.sin(yaw);
  return [sx + c * lx + s * lz, sz - s * lx + c * lz];
}

/** The circle in the relay's frame - native world units - for the gate's pixel. Pure.
 * @param {number} day @param {number} px @param {number} py */
export function riteNativeOf(day, px, py) {
  const [e, n] = riteLocalOf(day);
  return [px * PIXEL_M * RITE_UNITS_PER_M + e * RITE_UNITS_PER_M, (499 - py) * PIXEL_M * RITE_UNITS_PER_M + n * RITE_UNITS_PER_M];
}

/** Whether a native pose stands within RITE_REACH_M of the day's circle in the gate's pixel. Pure. */
export function riteNear(day, px, py, x, z) {
  const [cx, cz] = riteNativeOf(day, px, py);
  return Math.hypot(x - cx, z - cz) <= RITE_REACH_M * RITE_UNITS_PER_M;
}

/** The rite holds from the omen until the breach opens (relay ms). */
export const riteWindow = (day) => { const t = gateTimes(day); return { from: t.omenAt, to: t.openAt }; };
export const riteHolds = (day, now) => { const w = riteWindow(day); return now >= w.from && now < w.to; };
/** AUDIT WB12d (R8): a word said in the rite's last moment reaches the relay a moment after it - believed this long past
 *  the opening (a fall seen at the last second still breaks the rite). */
export const RITE_GRACE_MS = 2000;
export const riteHeard = (day, now) => { const w = riteWindow(day); return now >= w.from && now < w.to + RITE_GRACE_MS; };
/** The circle stands - its fires, its chest and the word of a broken rite - from the omen until its breach collapses:
 *  the Wrath's, or (AUDIT WB12d R7) an early kill's, `fellAt` (ms) when the Warden fell first. */
export const riteStands = (day, now, fellAt = null) => {
  const t = gateTimes(day);
  const end = Math.min(t.wrathAt, Number.isFinite(fellAt) ? fellAt : Infinity) + GATE_COLLAPSE_MS;
  return isGateDay(day) && now >= t.omenAt && now < end;
};

/**
 * The day's faithful, the Summoner first (a Sorcerer): `{ career, summoner }` - RITE_FAITHFUL_MIN to RITE_FAITHFUL_MAX of
 * Dagon's Faithful beside him, each one of the four robed careers by the day's roll. Pure.
 * @param {number} day
 */
export function riteFaithfulOf(day) {
  const n = RITE_FAITHFUL_MIN + (gateRoll(day, 17) % (RITE_FAITHFUL_MAX - RITE_FAITHFUL_MIN + 1));
  const out = [{ career: RITE_SUMMONER_CAREER, summoner: true }];
  for (let i = 0; i < n; i++) out.push({ career: RITE_CAREERS[gateHash(GATE_SALT, day, 18, i) % RITE_CAREERS.length], summoner: false });
  return out;
}

// ── BROKER-CAGE (2026-10-02, Mac: "she should be present at the site in a jailed gate, and the gate opens after all the
// enemies are cleared") ── the Sigil Broker is the faithful's prisoner, caged at their circle (scenes/sigilBrokerPool.js).
// The cage opens when EVERY ONE of the day's faithful has fallen - the Summoner and each of Dagon's Faithful - inside the
// rite's window: a player who saw them all fall says so in the rite's word (`c`), the relay's cell keeps it beside the
// broken rite, and the hub says it to everyone (net/wire.js validRiteOut `cl`). Not cleared by the opening, she stays
// caged that night (the faithful pass into the breach). Caged or free, she stands from the omen until the Wrath's midnight
// - a Warden fallen early takes the breach and its circle, never her.

/** The last day's faithful by career, `[[career, n], ...]` (riteRosterFell's, made once a day). */
let _rosterDay = null, _roster = [];
/** Has every one of the day's faithful fallen: the Summoner (`fell`), and each of Dagon's Faithful by its career
 *  (`slain` - career to deaths seen, systems/riteChest.js riteMemory)? Pure. */
export function riteRosterFell(day, slain, fell) {
  if (!fell || !slain || typeof slain !== 'object') return false;
  if (_rosterDay !== day) {   // the day's faithful by career, made once a day - the rite's word asks every frame
    const want = new Map();
    for (const m of riteFaithfulOf(day)) if (!m.summoner) want.set(m.career, (want.get(m.career) ?? 0) + 1);
    _roster = [...want]; _rosterDay = day;
  }
  for (const [career, n] of _roster) if (!(Number.isSafeInteger(slain[career]) && slain[career] >= n)) return false;
  return true;
}

/** She stands at the circle, caged or free, from the omen until the Wrath's midnight (relay ms) - the hub says her cage
 *  open to a hello for as long. */
export const cageStands = (day, now) => { const t = gateTimes(day); return isGateDay(day) && now >= t.omenAt && now < t.wrathAt; };
