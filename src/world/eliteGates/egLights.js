// @ts-check
// EG-ZE (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 7, 16.2, 16.4, 16.5,
// 27.3 and 27.5 - what EG-G1 and EG-G2 left the screen): THE STAIR, THE DOOR AND THE LIGHTS AS LAW - pure, every number
// the screen draws them by, so a test holds each one and a pass only draws it:
//   THE STAIR DRAWN (section 7) - each step's look on the veil (`egStairStep`: world/eliteGates/egLook.js egStairOf's fall, veil or
//     cut as the veil's theme, the band it steps into, the hall held centred, the band's chime) and the veil's own clock
//     (EG_STAIR_VEIL: the dither 0.8 s each way and the fall's least hold - never slower than the Hour's veil it replaces,
//     so the swap is never kept waiting on its picture);
//   THE DOOR (sections 7 and 27.3) - its gold beam over the END PLATE through the closing, seen hall-wide; the closing's
//     ring at the door's reach (EG_DOOR_REACH_M - where `down` is heard), its arc the closing's seconds left; the mark
//     the enhanced compass carries (`egDoorCompass`);
//   THE REDOUBT'S LIGHTS (sections 16.2 and 27.5) - the beacon climbing at the court's heart 1.5 s into the Redoubt's
//     sequence and standing through the rest, flaring as each recall lands; the recall's blue pillar where the called
//     back rise;
//   THE GATHER (section 7, AUDIT EG V c L3-10) - a gold ring over the ARRIVAL PLATE's rim while the hall gathers, its arc
//     the share of the company the hall waits for that has said `here` (the room's own count - net/eliteGates/egLink.js egGatherOf);
//   THE COMPANY'S WORD (sections 16.4 and 16.5) - the living's and the witnesses' pings: a blue pillar 6 m tall whose
//     glyph names its kind (here, danger, mine - a witness's cache);
//   THE WITNESS'S SIGHT (section 16.5) - what the living cannot see: each dormant Lurker's anchor, each alcove (on its
//     own floor), and the next hall's twist.
// Every light is the way's gold (the shelf's palette's `safety` - ui/eliteGates/egAccess.js, their one home: "it holds") or
// Battlemage blue ("yours" - section 25.2), never a warning's red or the place's white. Under reduced motion nothing
// climbs, rises or shimmers (the drain of the closing's ring is a fact, not a motion, and stays).
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { egHallOf, egCircleOfHall, egBandOfCircle, EG_DOOR_REACH_M, EG_TWIST_LINES } from '../../net/eliteGates/egLaw.js';
import { egBodyPlace, egGatherOf } from '../../net/eliteGates/egLink.js';   // AUDIT EG V (c, L3-10): and the gather, as the room counts it
import { EG_ROLE, EG_FL } from '../../net/eliteGates/egBodies.js';
import { EG_KIND } from '../../net/eliteGates/egLegion.js';
import { egTwistShown } from '../../net/eliteGates/egRun.js';   // AUDIT EG V (L2-4): no Bargain's line when no family is free
import { egToDungeon } from './egHall.js';
import { EG_STAIR, egStairOf } from './egLook.js';
import { EG_DANGER_PALETTES } from '../../ui/eliteGates/egAccess.js';
import { EG_SCORE_BAND_MOTIFS } from '../../systems/eliteGates/egScore.js';
import { midiNote } from '../../systems/gate/gateScore.js';

// ── THE STAIR DRAWN (section 7) ─────────────────────────────────────────────────────────────────────────────────
/** THE STAIR'S CLOCK on the veil (s): the dither closing and opening (EG_STAIR.dither each way), and the least the full
 *  fall stands shut so the Spire's underside is seen to fall away - its close, hold and open together still under the
 *  Hour's veil it replaces (render/gate/gateVeil.js VEIL_CLOSE_S + VEIL_OPEN_S, 2.9 s), and the swap's own work runs inside
 *  the hold, never after it. */
export const EG_STAIR_VEIL = Object.freeze({ close: EG_STAIR.dither, open: EG_STAIR.dither, fallHold: 1.2 });
/** The veil's theme for each of egStairOf's three (ui/gate/gateVeil.js VEIL_THEMES). */
export const EG_STAIR_THEME = Object.freeze({ fall: 'egFall', veil: 'egVeil', cut: 'egCut' });
/** THE BAND'S CHIME: the Concord's chime (clip 364, the Rare chime's record) struck on the first note of the band's
 *  motif (systems/eliteGates/egScore.js EG_SCORE_BAND_MOTIFS - the broken fanfare's E, the Cairn's soul-bell B, the Shade's high E,
 *  the Wellhead's hammered low E), pitched as the Hour's veil pitches its quarters (C5 at 0.7), never under 0.3. */
export function egStairChime(band) {
  const m = EG_SCORE_BAND_MOTIFS[Math.max(0, Math.min(EG_SCORE_BAND_MOTIFS.length - 1, band | 0))];
  return Math.max(0.3, 0.7 * 2 ** ((midiNote(m[0][0]) - midiNote('C5')) / 12));
}
/** The hall the stair holds centred while the upload lands. */
export const egStairLabel = (h) => `Hall ${h | 0}`;
/**
 * HOW A STEP DOWN TO HALL `h` IS SHOWN: `{ kind, look, opts }` - egStairOf's kind ('fall' at a band's first hall, 'veil'
 * elsewhere, 'cut' under reduced motion), the veil's theme for it, and what the veil draws it with (`band` the band the
 * step falls into, `label` the hall held centred, `chime` the band's chime's pitch). `again` - the circle standing built
 * again under the breach's own law (EG-H2's THE LAW PIN): never the fall, the company has not moved. Pure.
 */
export function egStairStep(h, reduced = false, again = false) {
  const kind = again ? (reduced ? 'cut' : 'veil') : egStairOf(h, reduced);
  const band = egBandOfCircle(egCircleOfHall(Math.max(1, h | 0)));
  return { kind, look: EG_STAIR_THEME[kind], opts: { band, label: egStairLabel(h), chime: egStairChime(band) } };
}

// ── THE LIGHTS ─────────────────────────────────────────────────────────────────────────────────────────────────
/** A light's kind (render/eliteGates/egLightPass.js): a beam (camera-facing, soft, fading up - the door's and the beacon's), a
 *  pillar (the same, firmer - the pings' and the recall's), a ring flat on the floor (its arc lit to `f`), a glyph (a
 *  camera-facing square over a pillar). */
export const EG_LIGHT_KIND = Object.freeze({ beam: 0, pillar: 1, ring: 2, glyph: 3 });
/** A glyph's shape: a ping's kind by its `w` (0 here - a ring, 1 danger - a triangle with its bar, 2 mine or a
 *  witness's cache - a diamond) and the witness's eye. */
export const EG_GLYPH = Object.freeze({ here: 0, danger: 1, mine: 2, eye: 3 });
/** BATTLEMAGE BLUE - "yours" (section 25.2): the HUD's own blue (ui/eliteGates/egSpireHud.js .eg-gain.blue, #6f9dff). */
export const EG_LIGHT_BLUE = Object.freeze([0.435, 0.616, 1.0]);
/** THE DOOR'S BEAM (m, s): its height and width over the END PLATE, how long it takes to climb at the door's opening,
 *  and the fog it always keeps however far across the hall (seen hall-wide - section 27.3). */
export const EG_DOOR_BEAM = Object.freeze({ h: 48, w: 1.4, rise: 0.6, fog: 0.6 });
/** THE CLOSING'S RING (m): at the door's reach, its band's width, how far over the plate it lies, how lit its spent arc
 *  stays. */
export const EG_CLOSING_RING = Object.freeze({ r: EG_DOOR_REACH_M, w: 0.22, lift: 0.04, spent: 0.25 });
/** THE REDOUBT'S BEACON (section 16.2): how long after the Redoubt's word it climbs (s), how long it climbs (s), its
 *  height and width (m), how long a recall's flare lasts (s) and how much brighter and wider it burns then. */
export const EG_BEACON = Object.freeze({ at: 1.5, climb: 1.2, h: 90, w: 2.4, flare: 0.8, flareK: 1.6 });
/** THE RECALL'S PILLAR (section 27.5): height, width (m), how long it stands, rises and fades (s). */
export const EG_RECALL_PILLAR = Object.freeze({ h: 6, w: 1.1, s: 3, rise: 0.4, fade: 0.6 });
/** A PING (sections 16.4 and 16.5): a blue pillar 6 m tall, its width (m), how long it stands, fades and rises (s), its
 *  glyph's size (m). */
export const EG_PING = Object.freeze({ h: 6, w: 0.5, s: 5, fade: 1, rise: 0.25, glyph: 0.9 });
/** THE WITNESS'S SIGHT: a mark's ring (m), its band's width, its glyph's size and how high it hangs. */
export const EG_SIGHT = Object.freeze({ r: 1.2, w: 0.14, glyph: 0.7, up: 2.2 });
/** The most lights a frame (render/eliteGates/egLightPass.js holds this many). */
export const EG_LIGHTS_MAX = 48;
/** How far over a pinger's own height a floor may stand and still be the one it pinged from (m). */
export const EG_FLOOR_NEAR_UP = 0.5;
/** The words the witness's sight says (the relay's EG_TEXT is its bundle's - a client's word there would move its law). */
export const EG_LIGHTS_TEXT = Object.freeze({ sight: (line) => `Beyond the door: ${line}` });

const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** No light stands (one frozen list - a frame with none makes nothing). */
const NO_LIGHTS = Object.freeze([]);
/** Distance from (x, z) to a lane's centre line. */
function laneDist(x, z, l) {
  const dx = l.bx - l.ax, dz = l.bz - l.az, L2 = dx * dx + dz * dz;
  const t = L2 > 0 ? clamp01(((x - l.ax) * dx + (z - l.az) * dz) / L2) : 0;
  return Math.hypot(x - (l.ax + dx * t), z - (l.az + dz * t));
}
/**
 * THE FLOOR UNDER (x, z) in a hall (its frame): the highest disc, band or lane standing there - or, with `near` (a
 * pinger's own height), the highest at most EG_FLOOR_NEAR_UP over it, so a ping on the Low Road is not drawn on the High
 * Road over it. A place over no floor stands on the hall's arrival plate's height. Pure.
 */
export function egFloorUnder(spec, x, z, near = null) {
  let top = -Infinity, best = -Infinity;
  const ok = near != null && Number.isFinite(near);
  const take = (y) => { if (y > top) top = y; if (ok && y <= near + EG_FLOOR_NEAR_UP && y > best) best = y; };
  for (const d of spec.discs ?? []) if (Math.hypot(x - d.x, z - d.z) <= d.r) take(d.y ?? 0);
  for (const b of spec.bands ?? []) if (Math.abs(x - b.x) <= b.halfW && z >= Math.min(b.z0, b.z1) && z <= Math.max(b.z0, b.z1)) take(b.y ?? 0);
  for (const l of spec.lanes ?? []) if (laneDist(x, z, l) <= l.hw) take(l.y ?? 0);
  if (best > -Infinity) return best;
  if (top > -Infinity) return top;
  return spec.arrive?.y ?? 0;
}

/** A light (the pass's input): its kind, its foot (or a glyph's or a ring's centre) in the scene, its height, width
 *  and radius (m), its colour, its strength, a ring's lit arc (0-1) or a glyph's shape. */
const light = (k, p, h, w, r, c, a, f) => ({ k, x: p[0], y: p[1], z: p[2], h, w, r, c, a, f });
/** A pillar with its glyph over it (a ping's), rising `up` of its height. */
function pillarWithGlyph(out, p, h, w, c, a, g, size) {
  out.push(light(EG_LIGHT_KIND.pillar, p, h, w, 0, c, a, 0));
  if (g >= 0) out.push(light(EG_LIGHT_KIND.glyph, [p[0], p[1] + h + size * 0.75, p[2]], 0, size, 0, c, a, g));
}

/**
 * WHAT THE SPIRE'S LIGHTS ARE NOW (pure), in the scene's frame, at most EG_LIGHTS_MAX - none outside a breach's halls:
 *   the door's beam and the closing's ring through the closing (the ring's arc the closing's seconds left);
 *   the Redoubt's beacon through the rest, from 1.5 s after its word, climbing (and flaring as a recall lands);
 *   each recall's blue pillar for its seconds;
 *   each ping's blue pillar and glyph for its seconds;
 *   for a witness, a blue ring and an eye at each dormant Lurker's anchor and a ring and a diamond at each alcove.
 * `E` the breach as the link holds it (net/eliteGates/egLink.js), `now` its shared clock (ms). `palette` the shelf's (its `safety`
 * the way's gold), `still` reduced motion, `ys` each pinger's own height in the hall's frame (a Map by account, for the
 * floor it pinged from), `witness` this screen a witness's.
 * @param {any} E @param {number} now
 * @param {{ witness?: boolean, still?: boolean, palette?: any, ys?: Map<string, number>|null }} [o]
 */
export function egSpireLights(E, now, { witness = false, still = false, palette = null, ys = null } = {}) {
  if (!E?.b || !(E.h > 0) || E.end) return NO_LIGHTS;
  // a trial with nothing said: nothing stands, and nothing is made for it (asked every frame)
  if (E.sg !== 'closing' && E.sg !== 'rest' && E.sg !== 'arrive' && !witness && !E.rises?.length && !E.pings?.length) return NO_LIGHTS;   // AUDIT EG V (c, L3-10): and the gather's ring
  const out = [];
  const spec = egHallOf(E.seed, E.h, E.geo ?? 0), gold = palette?.safety ?? EG_DANGER_PALETTES.standard.safety, blue = EG_LIGHT_BLUE;
  // THE DOOR: its beam climbing at the opening, and the closing's ring draining the closing's seconds
  if (E.sg === 'closing' && spec.end) {
    const p = egToDungeon(spec, spec.end.x, spec.end.y ?? 0, spec.end.z);
    const up = still ? 1 : clamp01((now - (E.sa || now)) / 1000 / EG_DOOR_BEAM.rise);
    out.push(light(EG_LIGHT_KIND.beam, p, EG_DOOR_BEAM.h * up, EG_DOOR_BEAM.w, 0, gold, 1, 0));
    const span = (E.su || 0) - (E.sa || 0);
    out.push(light(EG_LIGHT_KIND.ring, [p[0], p[1] + EG_CLOSING_RING.lift, p[2]], 0, EG_CLOSING_RING.w, EG_CLOSING_RING.r, gold, 1, span > 0 ? clamp01((E.su - now) / span) : 0));
  }
  // AUDIT EG V (c, L3-10; section 7 - "a ring fills over the plate, *3 of 6 here*"): THE GATHER's ring over the arrival
  // plate's rim, filling as the company says `here` - a company of one has nothing to gather
  if (E.sg === 'arrive' && spec.arrive) {
    const G = egGatherOf(E);
    if (G.n > 1) { const p = egToDungeon(spec, spec.arrive.x, spec.arrive.y ?? 0, spec.arrive.z); out.push(light(EG_LIGHT_KIND.ring, [p[0], p[1] + EG_CLOSING_RING.lift, p[2]], 0, EG_CLOSING_RING.w, spec.arrive.r, gold, 1, G.here / G.n)); }
  }
  // THE REDOUBT'S BEACON: at the court's heart (scenes/eliteGates/egClient.js beaconAt's own place), through the rest
  const R = E.redoubt;
  if (R && R.h === E.h && E.sg === 'rest' && spec.ring) {
    const s = (now - (R.at ?? now)) / 1000 - EG_BEACON.at;
    if (s >= 0) {
      const f = spec.fight ?? spec.end, p = egToDungeon(spec, spec.ring.x, f?.y ?? 0, spec.ring.z);
      const flare = (E.rises ?? []).some((q) => q.h === E.h && now >= q.at && now - q.at < EG_BEACON.flare * 1000);
      out.push(light(EG_LIGHT_KIND.beam, p, EG_BEACON.h * (still ? 1 : clamp01(s / EG_BEACON.climb)), EG_BEACON.w * (flare ? EG_BEACON.flareK : 1), 0, gold, flare ? EG_BEACON.flareK : 1, 0));
    }
  }
  // THE RECALL'S PILLARS: blue, where each called-back member rises (in the hall it was said for)
  for (const q of E.rises ?? []) {
    const s = (now - q.at) / 1000, P = EG_RECALL_PILLAR;
    if (!(s >= 0 && s < P.s) || !(q.h > 0)) continue;
    const hs = egHallOf(E.seed, q.h, E.geo ?? 0), p = egToDungeon(hs, q.x, egFloorUnder(hs, q.x, q.z), q.z);
    out.push(light(EG_LIGHT_KIND.pillar, p, P.h * (still ? 1 : clamp01(s / P.rise)), P.w, 0, blue, clamp01((P.s - s) / P.fade), 0));
  }
  // THE PINGS: a blue pillar and its glyph, from the floor the pinger stood on
  for (const q of E.pings ?? []) {
    const s = (now - q.at) / 1000, P = EG_PING;
    if (!(s >= 0 && s < P.s)) continue;
    const p = egToDungeon(spec, q.x, egFloorUnder(spec, q.x, q.z, ys?.get(q.s) ?? null), q.z);
    const g = q.w === 1 ? EG_GLYPH.danger : q.w === 2 ? EG_GLYPH.mine : EG_GLYPH.here;
    pillarWithGlyph(out, p, P.h * (still ? 1 : clamp01(s / P.rise)), P.w, blue, clamp01((P.s - s) / P.fade), g, P.glyph);
  }
  // THE WITNESS'S SIGHT: the dormant Lurkers' anchors and the alcoves
  if (witness) {
    const S = EG_SIGHT;
    const mark = (x, z, g, y = null) => {
      const p = egToDungeon(spec, x, Number.isFinite(y) ? y : egFloorUnder(spec, x, z), z);
      out.push(light(EG_LIGHT_KIND.ring, [p[0], p[1] + EG_CLOSING_RING.lift, p[2]], 0, S.w, S.r, blue, 1, 1));
      out.push(light(EG_LIGHT_KIND.glyph, [p[0], p[1] + S.up, p[2]], 0, S.glyph, 0, blue, 1, g));
    };
    if (E.fight?.h === E.h) for (const b of E.fight.bodies ?? []) if (b.role === EG_ROLE.add && b.k === EG_KIND.lurker && (b.fl & EG_FL.dormant) !== 0 && b.hp > 0) { const [x, z] = egBodyPlace(b, now); mark(x, z, EG_GLYPH.eye); }
    for (const q of spec.alcoves ?? []) mark(q.x, q.z, EG_GLYPH.mine, q.y);   // an alcove's own floor (it is cut beside or under the course)
  }
  return out.length > EG_LIGHTS_MAX ? out.slice(0, EG_LIGHTS_MAX) : out;
}

/** THE DOOR ON THE COMPASS (section 27.3): the way down's place in the scene ([x, z] - the enhanced compass's strip
 *  reads it, ui/enhanced/enhancedHud.js) while the door stands open, or null - never a witness's (they take no door). Pure. */
export function egDoorCompass(E, witness = false) {
  if (witness || !E?.b || E.end || E.sg !== 'closing' || !(E.h > 0)) return null;
  const spec = egHallOf(E.seed, E.h, E.geo ?? 0);
  if (!spec.end) return null;
  const p = egToDungeon(spec, spec.end.x, spec.end.y ?? 0, spec.end.z);
  return [p[0], p[2]];
}

/** THE WITNESS'S SIGHT, said: the next hall's twist line (net/eliteGates/egLaw.js EG_TWIST_LINES), or '' - none past this circle's
 *  Court (the next circle's decrees are not chosen yet) and none for a hall with no twist. Pure. */
export function egWitnessTwist(E) {
  if (!E?.b || !(E.h > 0) || E.end || egCircleOfHall(E.h + 1) !== egCircleOfHall(E.h)) return '';
  const next = egHallOf(E.seed, E.h + 1, E.geo ?? 0);
  return egTwistShown(next, E.dc) ? EG_TWIST_LINES[next.twist] ?? '' : '';   // AUDIT EG V (L2-4): no Bargain's line when no family is free
}
