// @ts-check
// EG-G1 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 27.1, 27.2, 27.3,
// 27.8 and 25.7): THE SPIRE'S HUD, BY FORM FACTOR - what a member reads inside a breach, laid out for the screen in hand:
//   THE LAYOUTS (`egFormFactor`, pinned at 1280x720, 390x844 and 844x390): a desk - the count's chip and the Reliquaries'
//     beside the compass, the decrees under them, the potion pip, the objective chip, the lord's bar only in a Court; a
//     phone held upright - one 18 px tabular chip (the count and the Reliquaries), the decrees folded to a tappable
//     *4 decrees*; a phone held sideways - the count's chip and a 44 px lord's bar, the decrees on each arrival card and
//     folded to the same press (AUDIT EG V, c, L7-22).
//     The company's state is the party rows' (ui/eliteGates/egParty.js), never a second row here; the hall and its band only on the
//     arrival card. Every part reads `--hud-scale` (the port's own HUD scale, copied off `.hud` as the arena's bar does).
//   THE COUNT CHIP (`egCountChip`, section 27.2): mm:ss in tabular figures at 18 px - gold above 10:00, white to 2:00,
//     red below, pulsing at 1 Hz in the last 30 s; *Held* with a pause glyph while the count holds, its reason shown on
//     the chip (the Redoubt, a respite, the door, the stair, a hold) and never said; the last word's figure with a seal
//     when it is nearer than the count. Gains fly in (`egGainText`): *+15:00*, *+10:00 - the Covenant's Press*, *+3:00 -
//     the last word*, *+1:00* for THE GOLD RUN, *Surplus +1* in blue. The warnings (`egChipWarnings`), each once a count
//     and never again after a Redoubt raises it: *The Covenant presses. Five minutes.* at 5:00, a toll at 1:00 and at
//     0:10, and *The count will not hold through the next Court.* when the count left is short of the reference time to
//     the Court's fall (section 18's model - `egCourtNeedMs`).
//   THE ARRIVAL CARD (`egArrivalCard`, section 27.3): *Hall 12 - the Broken Galleries*, the hall's name over it, the
//     objective beneath, the twist as a second line, the decrees in force; at a band's first hall (or the breach's own
//     first) its band's card; *Hall 15 - the Court* and the lord's card at a Court. It wears the gate's title card's
//     own sheet (ui/gate/gateTitleCard.js TITLE_CARD_CSS) on a node of its own - the gate's card is the fight's (a lord's
//     wake and fall, scenes/eliteGates/egFight.js), and the two never stand together.
//   THE OBJECTIVE, THE DOOR, THE LORD'S BAR: the objective chip with its progress (ui/eliteGates/egHud.js egProgressText); the
//     door's screen-edge marker (`egDoorMarker`: the way down's bearing off my facing, on the screen's edge while it is
//     not ahead, with its metres); the lord's name, health and phase in a Court (`egLordBar`).
//   TOUCH AND THE PAD (section 27.8): the witness's Q and E, forsaking and the way home as touch buttons
//     (`egTouchButtons`); the panel's cards and choices and the witness's eye on the pad's d-pad (`egPadAct` - left and
//     right choose, up takes, down says no; a witness's left and right change whom, a held down forsakes), told by the
//     prompt bar (`egPadPrompts`).
//   BOTH SKINS: the HUD is DOM in every skin, as the gate's bar, the arena's and the sea's are (a readout, not a
//     native window - the native-window rule binds DFU's windows); the classic skin dresses it in DFU's own text colour
//     and its shadow (DaggerfallUI.DefaultTextColor / DefaultShadowColor - ui/native/nativePanel.js DEFAULT_TEXT_COLOR and
//     DEFAULT_SHADOW_COLOR) over the gate's classic face, the enhanced skin in its pixel face on the kit's plates.
//   ACCESSIBILITY (section 25.7, ui/eliteGates/egAccess.js): the danger palette's red on the chip, reduced motion's stillness (no
//     pulse, no flight, no rise), and the beats' words in a polite live region.
//   EG-ZD (2026-10-12, Mac: "I said I want everything"; section 16.5): THE FALL, a fallen member's own screen in place of
//     the death screen (`egFallModel`, `drawEgFall`): the camera sinks for 1.2 s as the screen drains to a fifth of its
//     colour, then the gate's title card's sheet (ui/gate/gateTitleCard.js) reads *FALLEN* - *The next Redoubt can call you
//     back.* or *The Spire will not take you back.* - with *Reliquaries lost: N* in the palette's red where any were held,
//     and 2.5 s later the witness view dithers in (an ordered 2x2 dither through black, the eye handed over at its
//     darkest). Reduced motion: no sink, the colour cut, the card still, the witness view cut in.
//
// EG-ZG (2026-10-12, sections 13.2, 25.5 - world/eliteGates/egTelegraph.js the law): THE MARKS AS SIGILS - my own on the HUD (each
// its own shape, a soul-mark's gem with its seconds, a flame's and a snowflake's rim tinted - never a line of text), every
// companion's over their head (`drawEgSigils`, placed by the fight where the camera sees them); THE ECLIPSE'S CHIP, *The
// Eclipse - 5*, while it is told.
//
// AUDIT EG III (2026-10-13, sections 15 and 27.5): THE HOLDER'S CHIPS - in the Vestiges' blue beside the count's, a chip for each
// timed window on me with its seconds (Lifeline, Shield-Hymn), Spellweave's free spell while it stands and each Accord while its
// pair stands within 10 m (ui/eliteGates/egBeats.js egHolderWatch, handed in by the breach client as `held`).
//
// One node each, UPDATED, NOT REBUILT, hidden with the HUD. The models are pure.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { egHallOf, egCircleOfHall, egSlotOfHall, egCountText, EG_LAST_WORD_MS, EG_COUNT_START_MS, EG_REDOUBT_HOLD_MS, EG_BANDS, EG_DECREES, EG_DECREE_BY_KEY, EG_TWIST_LINES, EG_TEXT } from '../../net/eliteGates/egLaw.js';
import { egCountAt, egLivingCount, egMemberOf, egRunOfMember } from '../../net/eliteGates/egLink.js';
import { egGatherOf } from '../../net/eliteGates/egLink.js';   // AUDIT EG V (c, L3-10): the gather, as the room counts it
import { EG_ROLE, EG_FL } from '../../net/eliteGates/egBodies.js';
import { EG_BOSS_KEYS, egBossName, egTtkRef } from '../../net/eliteGates/egLords.js';
import { egMarkynazDecree } from '../../net/eliteGates/egLords.js';   // EG-ZS (section 8.5): the decree the Markynaz lays, named on his card
import { EG_CHAMPIONS } from '../../net/eliteGates/egLaw.js';   // EG-ZS: the champion's signature's title
import { egProgressText, EG_MARK_NAMES, EG_POTIONS_PER_HALL } from './egHud.js';
import { egNextCircleText } from './egHud.js';   // AUDIT EG V (L2-11): a rest's beacon - the next circle's decrees and lord
import { egObjectiveText } from './egHud.js';   // FIELD BUGS 2026-10-19f GAUNTLET-PLATES: the objective as the screen says it (the Gauntlet's in the player's language)
import { egTwistShown } from '../../net/eliteGates/egRun.js';   // AUDIT EG V (L2-4): no Bargain's line when no family is free
import { EG_PRES_TEXT, EG_BAND_LINES } from './egBeats.js';
import { EG_PARTY_CSS } from './egParty.js';
import { titleCardModel, TITLE_CARD_CSS, TITLE_CARD_STYLE_ID } from '../gate/gateTitleCard.js';
import { BOSS_BAR_TEXT } from '../gate/gateBossBar.js';   // FB1018D WARD-BAR: the gate bar's word for a warded lord
import { DEFAULT_TEXT_COLOR, DEFAULT_SHADOW_COLOR } from '../native/nativePanel.js';
import { PIXEL_FONT_CSS } from '../pixelifyFive.js';
import { injectEnhancedFonts } from '../enhanced/enhancedStyle.js';
import { egSigilsOf, egEclipseAt, egEclipseChip, egEclipseOfBlows } from '../../world/eliteGates/egTelegraph.js';   // EG-ZG: the marks' sigils, the Eclipse's chip
import { t } from '../../systems/textManager.js';   // AUDIT EG V (c): the words this audit adds, in the player's language
import { egStakeText } from './egHud.js';   // AUDIT EG V (c, NEW-1): the rest card's stake, on the Spire's own HUD
import { EG_TIDE_NAMES } from '../../net/eliteGates/egRun.js';   // AUDIT EG V (c, L2-9): the Hungering Dark, named on the rest card
import { spireOrreryOf, spireRiddleLines } from '../../systems/eliteGates/spireOrrery.js';   // FIELD BUGS 2026-10-17e (ORRERY-SIGHT): an Athenaeum's riddles

// ── the layouts (section 27.1) ────────────────────────────────────────────────────────────────────────────────
/** A phone is a screen whose short side is this or less (CSS px - the party panel's and the arena's own line). */
export const EG_PHONE_SHORT_PX = 560;
/** The three layouts. */
export const EG_FORM_FACTORS = Object.freeze(['desktop', 'upright', 'sideways']);
/** Which layout a screen of `w` x `h` CSS px wears (pure). */
export function egFormFactor({ w = 1280, h = 720 } = {}) {
  if (!(Math.min(w, h) <= EG_PHONE_SHORT_PX)) return 'desktop';
  return h >= w ? 'upright' : 'sideways';
}
/** What each layout shows (pinned): the decrees as a row, folded to a press, or kept for the cards; the lord's bar's
 *  height (px); the Reliquaries in the count's own chip; the potion pip and how many stand, a desk's alone. AUDIT EG V (c,
 *  L7-22; section 27.1): a phone held sideways folds its decrees to a press as an upright one does - the page's pause sheet
 *  is the port's menu, which no breach's readout stands in, and the fold is the same words one tap away without leaving
 *  the hall; each arrival card says them still. */
export const EG_LAYOUTS = Object.freeze({
  desktop: Object.freeze({ dec: 'row', lordH: 30, relInChip: false, potion: true, standing: true }),
  upright: Object.freeze({ dec: 'fold', lordH: 30, relInChip: true, potion: false, standing: false }),
  sideways: Object.freeze({ dec: 'fold', lordH: 44, relInChip: false, potion: false, standing: false }),   // AUDIT EG V (c, L7-22): the decrees folded to a press, as upright, besides each arrival card's
});

// ── THE COUNT CHIP (section 27.2) ─────────────────────────────────────────────────────────────────────────────
/** Above this the chip is gold, under this red, under this it pulses (ms). */
export const EG_CHIP_GOLD_MS = 10 * 60_000;
export const EG_CHIP_RED_MS = 2 * 60_000;
export const EG_CHIP_PULSE_MS = 30_000;
/** The chip's glyphs: the pause while it holds, the seal of the last word. */
export const EG_CHIP_GLYPHS = Object.freeze({ held: '❚❚', seal: '◈' });
/** A hold's reason as the chip shows it (section 6.2 - shown, never said). */
export const EG_HOLD_WORDS = Object.freeze({ rest: 'Redoubt', respite: 'Respite', closing: 'Door', stair: 'Stair', hold: 'Held' });

/** Why the count holds now, or '' while it runs (pure): a rest's, a respite's (the room's `respite` line still running),
 *  the closing's, the pull's to the wake, or a hold's. */
export function egHoldWhy(E, now) {
  if (E.ca > 0 || !(E.wk > 0) || E.end) return '';
  const resp = (E.fight?.says ?? []).filter((s) => s.w === 'respite').at(-1);
  if (resp && now < resp.at + (Number(resp.t) || 0) * 1000) return 'respite';
  if (E.sg === 'rest') return 'rest';
  if (E.sg === 'closing') return 'closing';
  if (E.sg === 'arrive' || E.sg === 'wait') return 'stair';
  return 'hold';
}
/**
 * THE COUNT CHIP (pure): `{ text, tone ('gold' | 'white' | 'red'), pulse, held, why, seal, glyph, label }` - the figure
 * shown (the last word's when it is nearer), its tone by what is left, the pulse in the last 30 s of a running count,
 * the pause glyph and the hold's reason, the seal. Null at the end.
 * @param {any} E @param {number} now
 */
export function egCountChip(E, now) {
  if (!E?.b || E.end) return null;
  const left = E.wk > 0 ? egCountAt(E, now) : EG_COUNT_START_MS;
  const lastWord = Math.max(0, E.op + EG_LAST_WORD_MS - now);
  const seal = lastWord < left;
  const shown = seal ? lastWord : left;
  const held = !(E.ca > 0);
  const why = held ? egHoldWhy(E, now) || 'stair' : '';
  const tone = shown > EG_CHIP_GOLD_MS ? 'gold' : shown >= EG_CHIP_RED_MS ? 'white' : 'red';
  const text = egCountText(shown);
  return { text, tone, pulse: !held && shown < EG_CHIP_PULSE_MS, held, why, seal, glyph: seal ? EG_CHIP_GLYPHS.seal : held ? EG_CHIP_GLYPHS.held : '',
    label: `${seal ? `${EG_PRES_TEXT.lastWhy}: ` : 'The count: '}${text}${held ? ` - ${EG_PRES_TEXT.held}` : ''}` };
}
/**
 * A Redoubt's gain as it flies in (pure), or null (the Covenant spoke: no time): `g` the count gained (ms), `press`
 * whether the Covenant's Press stood when it was taken, `leftAfter` the count after it and `lastWordLeft` the last
 * word's time then (ms). The full fifteen minutes alone; less, its reason.
 */
export function egGainText({ g = 0, cov = 0 } = {}, { press = false, leftAfter = 0, lastWordLeft = Infinity } = {}) {
  if (cov || !(g > 0)) return null;
  const t = egCountText(g);
  if (g >= EG_REDOUBT_HOLD_MS) return EG_PRES_TEXT.gain(t, '');
  if (press) return EG_PRES_TEXT.gain(t, EG_PRES_TEXT.pressWhy);
  if (leftAfter >= lastWordLeft - 1000) return EG_PRES_TEXT.gain(t, EG_PRES_TEXT.lastWhy);
  return EG_PRES_TEXT.gain(t, '');
}
/** Whether the Covenant's Press stands among the decrees in force. */
export const egPressInForce = (E) => (E?.dc ?? []).some(([id]) => id === EG_DECREE_BY_KEY.press.id);
/** A gain's flight (ms). */
export const EG_GAIN_MS = 2600;
/** THE COURT'S CLOCK at reference (section 18's model): a trial's fixed part, its damage part and its counted closing;
 *  a Court's approach before its lord's `ttkRef`. */
export const EG_HALL_REF_MS = (55 + 70 + 15) * 1000;
export const EG_COURT_APPROACH_MS = 26_000;
/** The reference time from hall `h`'s trial to its circle's Court's fall (pure): the trials left, this one counted
 *  whole, and the Court. 0 in a Court. */
export function egCourtNeedMs(h) {
  const slot = egSlotOfHall(h);
  if (slot === 5) return 0;
  return (5 - slot) * EG_HALL_REF_MS + EG_COURT_APPROACH_MS + Math.round(egTtkRef(egCircleOfHall(h)) * 1000);
}
/** The warnings (section 27.2): words at 5:00 and when the Court is out of reach, a toll at 1:00 and at 0:10. */
export const EG_CHIP_WARNINGS = Object.freeze({
  press5: Object.freeze({ at: 5 * 60_000, words: () => EG_PRES_TEXT.press5, toll: false }),
  toll1: Object.freeze({ at: 60_000, words: null, toll: true }),
  toll10: Object.freeze({ at: 10_000, words: null, toll: true }),
  court: Object.freeze({ at: 0, words: () => EG_PRES_TEXT.courtShort, toll: false }),
});
/**
 * The warnings due now (pure but for `said`, the set of those said this breach): each once a count - a Redoubt that
 * raises the count past its line never arms it again. Only while the count runs.
 * @param {Set<string>} said @param {any} E @param {number} now
 */
export function egChipWarnings(said, E, now) {
  const due = [];
  if (!E?.b || E.end || !(E.wk > 0) || !(E.ca > 0)) return due;
  const left = egCountAt(E, now);
  for (const k of ['press5', 'toll1', 'toll10']) if (!said.has(k) && left <= EG_CHIP_WARNINGS[k].at && left > 0) { said.add(k); due.push(k); }
  if (!said.has('court') && E.sg === 'trial' && E.h > 0 && egSlotOfHall(E.h) !== 5 && left < egCourtNeedMs(E.h)) { said.add('court'); due.push('court'); }
  return due;
}

// ── THE ARRIVAL CARD (section 27.3) ───────────────────────────────────────────────────────────────────────────
/** A card stands this long from the arrival (ms). */
export const EG_CARD_MS = 4800;
/** The first hall of each band (section 7). */
export const EG_BAND_FIRST_HALLS = Object.freeze([1, 26, 51, 76]);
const theOf = (name) => String(name ?? '').replace(/^The /, 'the ');
/**
 * What hall `E.h`'s arrival card says (pure): `{ kicker, main, sub, twist, dec, band }` - the hall's name (the band's at a
 * Court) over *Hall 12 - the Broken Galleries* (*Hall 15 - the Court*), the objective (the lord's card - its name and
 * epithet - at a Court) beneath, the twist's line, the decrees in force, and at a band's first hall (or `first`, the
 * breach's own first) the band's card: its name over, its line under.
 * @param {any} E @param {{ first?: boolean }} [o]
 */
export function egArrivalCard(E, { first = false } = {}) {
  if (!E?.b || !(E.h > 0)) return null;
  const spec = egHallOf(E.seed, E.h, E.geo ?? 0), band = EG_BANDS[spec.band];
  const court = spec.kind === 'court';
  const dec = (E.dc ?? []).map(([id, rank]) => `${EG_DECREES[id]?.name ?? ''}${rank >= 2 ? ' II' : ''}`).filter(Boolean);
  const bandCard = first || EG_BAND_FIRST_HALLS.includes(E.h);
  return {
    kicker: bandCard || court ? band?.name ?? '' : spec.name,
    main: court ? EG_PRES_TEXT.hallCourt(E.h) : EG_PRES_TEXT.hallBand(E.h, theOf(band?.name)),
    sub: court ? spec.name : egObjectiveText(spec),
    twist: egTwistShown(spec, E.dc) ? EG_TWIST_LINES[spec.twist] ?? '' : '',
    dec: dec.length ? dec.join(' - ') : '',
    band: bandCard ? EG_BAND_LINES[spec.band] ?? '' : '',
    lays: egMarkynazLine(E, spec),
  };
}
/**
 * EG-ZS (section 8.5: "he lays one lord-family decree (section 14) on his own fight, named on his card"; EG-ZQ's "Found, not
 * changed") - THE MARKYNAZ'S DECREE ON HIS CARD: in a hall the law stands him in (a Proving Walk, a Deepway's champion's
 * chamber - the spec's `champ`), *The Grand Duke's Decree: Colossal* - the one the relay lays as it stands him at the wake
 * (net/eliteGates/egLords.js egMarkynazDecree, pure), reckoned from the decrees the room says in force (`dc`, the ranks the fight takes at
 * its wake) and the hall's number, with no new word. '' anywhere else, and when his fight bears all four. Pure.
 * @param {any} E @param {any} spec
 */
export function egMarkynazLine(E, spec) {
  if (spec?.champ !== 'markynaz') return '';
  const D = Object.fromEntries((E?.dc ?? []).map(([id, rank]) => [EG_DECREES[id]?.key, rank]).filter(([k]) => k));
  const key = egMarkynazDecree(D, E.h), C = EG_CHAMPIONS.find((c) => c.key === 'markynaz');
  return key && C ? EG_PRES_TEXT.champDecree(C.title, EG_DECREE_BY_KEY[key]?.name ?? '') : '';
}
/** The card's words for a screen reader (the card itself is aria-hidden): the hall and its objective - EG-ZS: and the decree
 *  the Markynaz lays, where his card names one. Pure. */
export const egArrivalLive = (card) => `${card.main}. ${card.sub}${card.lays ? ` ${card.lays}.` : ''}`;
/** The card's fade over its stand (the gate card's law - ui/gate/gateTitleCard.js titleCardModel), or null. */
export function egArrivalShown(card, at, now) {
  if (!card) return null;
  const m = titleCardModel({ kind: 'arrive', at, until: at + EG_CARD_MS, kicker: card.kicker, main: card.main, sub: card.sub }, now);
  return m ? { ...card, key: m.key, alpha: m.alpha, fresh: m.fresh } : null;
}

// ── THE DOOR (sections 7 and 27.3) ────────────────────────────────────────────────────────────────────────────
/** Within this of straight ahead the way down is on the screen (rad), and the marker rides the top. */
export const EG_DOOR_AHEAD_RAD = 0.6;
/**
 * The door's marker (pure): my place and the door's in the hall's frame (metres), my facing (`yaw`, 0 down +z - the
 * motor's forward (sin, cos)). `{ rel, ahead, x, y, dist }` - its bearing off my facing (rad, + to the right), whether it
 * is ahead, where the marker stands on the screen (0-1 of its width and height) and how far it is.
 */
export function egDoorMarker(me, door, yaw) {
  const dx = door.x - me.x, dz = door.z - me.z;
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const rel = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
  const ahead = Math.abs(rel) <= EG_DOOR_AHEAD_RAD;
  const x = ahead ? 0.5 + 0.4 * (rel / EG_DOOR_AHEAD_RAD) : 0.5 + 0.46 * Math.sin(rel);
  const y = ahead ? 0.14 : 0.5 - 0.42 * Math.cos(rel);
  return { rel, ahead, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, dist: Math.round(Math.hypot(dx, dz)) };
}

// ── THE LORD'S BAR ────────────────────────────────────────────────────────────────────────────────────────────
/** The lord's bar in a Court (pure): its name, its epithet, its health's share and its phase - the first true lord
 *  standing awake (never a mirror, a friend, one still asleep). AUDIT EG V (lane1 #22): never one FALLEN - in a Court of two
 *  lords (Clan Feud's champion, THE TWIN COURT's and THE OLD MASTERS' second) the bar is the lord still standing, never the first
 *  at nought (egLordBars). */
export function egLordBar(E) { return egLordBars(E)[0] ?? null; }
/** AUDIT EG V (lane1 #22): the bars of every true lord standing awake, in the fight's order (the Court's own first), at most
 *  EG_LORD_BARS_MAX - each `{ name, court, frac, phase, ward }`. FB1018D WARD-BAR (section 25.2, "the cage on the lord's bar
 *  is red-bronze and hatched"): `ward` while the room says the lord warded (EG_FL.ward - Ilthys's banners holding it, an
 *  errand's ward, Unyielding's), when no blow lands on it. Pure. */
export const EG_LORD_BARS_MAX = 2;
/** The model's lord bars: the first (`lord`) and a second lord standing (`lord2`), in a Court alone. Pure. */
const egLordBarsOf = (E) => { const bars = egLordBars(E); return bars[0]?.court ? { lord: bars[0], lord2: bars[1] ?? null } : { lord: null, lord2: null }; };
export function egLordBars(E) {
  if (!E?.b || !(E.h > 0) || E.fight?.h !== E.h) return [];
  const spec = egHallOf(E.seed, E.h, E.geo ?? 0);
  return (E.fight.bodies ?? []).filter((b) => b.role === EG_ROLE.lord && b.ph > 0 && (b.fl & (EG_FL.mirror | EG_FL.friend)) === 0 && b.hp > 0).slice(0, EG_LORD_BARS_MAX)   // standing: a fall says its nought (`efell`, `ehp`), a raise its health
    .map((L) => ({ name: egBossName(EG_BOSS_KEYS[L.k] ?? '', L.pt), court: spec.kind === 'court', frac: L.max > 0 ? Math.round(Math.max(0, Math.min(1, L.hp / L.max)) * 1000) / 1000 : 0, phase: ['', 'I', 'II', 'III'][L.ph] ?? '',
      ward: (L.fl & EG_FL.ward) !== 0 }));   // FB1018D WARD-BAR
}

/** A lord's bar's line: its name, its phase and - FB1018D WARD-BAR - the gate bar's own word while it stands warded
 *  (ui/gate/gateBossBar.js BOSS_BAR_TEXT), so a blow that lands on nothing is told why. Pure. */
export const egLordLine = (L) => `${L.name}${L.phase ? ` - ${L.phase}` : ''}${L.ward ? ` - ${BOSS_BAR_TEXT.warded}` : ''}`;
/** FB1018D WARD-BAR: a bar's track caged (`ward`) or not, its class written only when it changes. */
function wardOn(track, on) {
  const cls = on ? 'eg-lord-track ward' : 'eg-lord-track';
  if (track && track.className !== cls) track.className = cls;
}

// ── THE STAGE'S LINE ──────────────────────────────────────────────────────────────────────────────────────────
/** AUDIT EG V (c, L3-10; section 7): the gather's count on the stage's line, as the ring over the plate fills (world/
 *  egLights.js) - `k` of the `n` the hall waits for said `here`. */
export const egHereText = (k, n) => t('eg.gather.here', '{k} of {n} here.', { k, n });
function stageLine(E, now) {
  const left = E.su > 0 ? Math.max(0, E.su - now) : 0;
  switch (E.sg) {
    case 'arrive': { const G = egGatherOf(E), g = G.n > 1 ? ` ${egHereText(G.here, G.n)}` : ''; return left > 0 ? `${EG_TEXT.wakes.replace('.', '')} in ${egCountText(left)}.${g}` : `Gather on the arrival plate.${g}`; }   // AUDIT EG V (c, L3-10): *3 of 6 here*
    case 'closing': return `${EG_TEXT.door} Step through the door.`;
    case 'rest': return left > 0 ? `${EG_TEXT.descend.replace('.', '')} in ${egCountText(left)} - or take the way home.` : EG_TEXT.descend;
    default: return '';
  }
}

// ── AUDIT EG III: SPIREBRIDGE ON THE STAGE'S LINE (section 15) ───────────────────────────────────────────────────
/** The stage line's Spirebridge words (pure): each plank standing in this hall with its seconds (who raised it - the room's
 *  word), and the ask offered while mine may be asked (`ready`). '' none. */
export function egBridgeLine(E, now, ready = false) {
  const stand = (E?.fight?.bridges ?? []).filter((q) => q.h === E.h && now >= q.at && now < q.until).map((q) => EG_PRES_TEXT.bridgeStands(q.n || 'A companion', Math.ceil((q.until - now) / 1000)));
  return [...stand, ready ? EG_PRES_TEXT.bridgeReady : ''].filter(Boolean).join(' ');
}

// ── TOUCH AND THE PAD (section 27.8) ──────────────────────────────────────────────────────────────────────────
/** AUDIT EG V (c, L7-7): the ping's button and the pad's row - and its cooldown's seconds on the button while it cools. */
export const egPingLabel = (left = 0) => (left > 0 ? t('eg.touch.pingCool', 'Ping {s}s', { s: Math.ceil(left / 1000) }) : t('eg.touch.ping', 'Ping'));
/** The touch buttons a moment asks for (pure): a witness's eye before and after, its ping (AUDIT EG V, c, L7-7 - its cooldown
 *  on it, `ping` the ms left) and forsaking; a Redoubt's way home; AUDIT EG III (section 15): Spirebridge while its holder
 *  may ask it (a gap ahead, unspent this span). */
export function egTouchButtons({ witness = false, rest = false, bridge = false, ping = 0 } = {}) {
  const T = EG_PRES_TEXT.touch;
  if (witness) return [{ id: 'prev', label: T.prev }, { id: 'next', label: T.next }, { id: 'ping', label: egPingLabel(ping) }, { id: 'forsake', label: T.forsake }];
  if (rest) return [{ id: 'home', label: T.home }];
  if (bridge) return [{ id: 'bridge', label: T.bridge }];
  return [];
}
/** The d-pad's codes (systems/inputActions.js DEFAULT_SECONDARY_BINDINGS' diamond; ui/plus/plusPad.js HELM_DPAD). */
export const EG_PAD_DIRS = Object.freeze({ JoystickAxis7Button0: 'up', JoystickAxis7Button1: 'down', JoystickAxis6Button1: 'left', JoystickAxis6Button0: 'right' });
const PAD_OF_DIR = Object.freeze(Object.fromEntries(Object.entries(EG_PAD_DIRS).map(([c, d]) => [d, c])));
/** Whether the d-pad is the Spire's now: a recap standing, the panel open, or a witness's eye - AUDIT EG III: or a Spirebridge
 *  its holder may ask (a gap ahead of it, unspent this span). */
export const egPadUp = ({ recap = false, panel = false, witness = false, bridge = false } = {}) => !!(recap || panel || witness || bridge);
/**
 * A d-pad press in the Spire (pure): `dir` up | down | left | right, `kind` tap | hold | release. The recap closes on any
 * tap; the panel's choices move left and right, up takes, down says no; a witness's left and right change whom, a held
 * down forsakes; AUDIT EG III: with neither, up asks a Spirebridge its holder may ask. Null: not the Spire's.
 */
export function egPadAct(dir, kind, { recap = false, panel = false, witness = false, bridge = false } = {}) {
  if (kind === 'release') return null;
  if (recap && kind === 'tap') return { k: 'close' };
  if (panel && kind === 'tap') return dir === 'left' ? { k: 'focus', d: -1 } : dir === 'right' ? { k: 'focus', d: 1 } : dir === 'up' ? { k: 'take' } : { k: 'no' };
  if (witness) {
    if (kind === 'tap' && (dir === 'left' || dir === 'right')) return { k: 'watch', d: dir === 'left' ? -1 : 1 };
    if (kind === 'tap' && dir === 'up') return { k: 'ping' };   // AUDIT EG V (c, L7-7): a witness's ping, the pad's up
    if (kind === 'hold' && dir === 'down') return { k: 'forsake' };
  }
  if (bridge && !panel && !witness && kind === 'tap' && dir === 'up') return { k: 'bridge' };
  return null;
}
/** The prompt bar's rows while the d-pad is the Spire's (the helm's shape - ui/enhanced/enhancedHelm.js helmPadPrompts). */
export function egPadPrompts({ recap = false, panel = false, witness = false, bridge = false } = {}) {
  const P = EG_PRES_TEXT.pad;
  if (recap) return [[[PAD_OF_DIR.up], P.close]];
  if (panel) return [[[PAD_OF_DIR.left, PAD_OF_DIR.right], P.choose], [[PAD_OF_DIR.up], P.take], [[PAD_OF_DIR.down], P.no]];
  if (witness) return [[[PAD_OF_DIR.left, PAD_OF_DIR.right], P.watch], [[PAD_OF_DIR.up], egPingLabel()], [[PAD_OF_DIR.down], P.forsake]];   // AUDIT EG V (c, L7-7): the ping
  if (bridge) return [[[PAD_OF_DIR.up], P.bridge]];   // AUDIT EG III
  return null;
}

// ── AUDIT EG V (c): THE WITNESS'S SEAT AND THE REST CARD ────────────────────────────────────────────────────────────
/** AUDIT EG V (c, L7-7; section 16.5): the member a witness watches, on its stage line - `{ numeral, name, pct }`, their
 *  health's share where the party's pose says it. '' for none. Pure. */
export function egWatchLine(watch) {
  if (!watch?.name) return '';
  const who = `${watch.numeral ?? ''} ${watch.name}`.trim();
  return Number.isFinite(watch.pct) ? t('eg.witness.watching', 'Watching {who} - health {pct}%.', { who, pct: Math.round(watch.pct) }) : t('eg.witness.watchingName', 'Watching {who}.', { who });
}
/** AUDIT EG V (c, L7-7; sections 16.4 and 16.5 - "its cooldown shown"): a ping asked or shown inside its cooldown (`s` its
 *  seconds left). */
export const egPingWait = (s) => t('eg.ping.wait', 'Your ping is ready in {s}s.', { s });
/**
 * AUDIT EG V (c): THE REST CARD's line (pure) - the stake (NEW-1: ui/eliteGates/egHud.js egStakeText, AUDIT EG III's rest line, drawn by
 * the tracker alone, which the Spire's own HUD replaces inside a breach) and, L2-9 (section 14 - "Ashen Vigil: the next rest
 * heals half; the rest card says so"), a heal of less than whole (`restP`, the room's `eheal` share) with what made it less:
 * Ashen Vigil (its rank), the Hungering Dark.
 * @param {any} E @param {any} run mine (net/eliteGates/egLink.js egRunOfMember) @param {number} restP
 */
export function egRestLine(E, run, restP = 1) {
  const stake = egStakeText(run?.rw ?? []);
  let less = '';
  if (restP > 0 && restP < 1) {
    const D = EG_DECREE_BY_KEY.ashen, ash = (E?.dc ?? []).find(([id]) => id === D.id)?.[1] ?? 0;
    const why = [ash ? `${D.name}${ash >= 2 ? ' II' : ''}` : '', E?.td === 'hungering' ? EG_TIDE_NAMES.hungering : ''].filter(Boolean).join(', ');
    const pct = Math.round(restP * 100);
    less = why ? t('eg.rest.less', 'The rest heals {pct}%: {why}.', { pct, why }) : t('eg.rest.lessBare', 'The rest heals {pct}%.', { pct });
  }
  return [stake ? `${stake}.` : '', less].filter(Boolean).join(' ');
}

// ── THE MODEL ─────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * WHAT THE SPIRE'S HUD SAYS NOW (pure), or null outside a breach's halls: the layout, the count chip, the Reliquaries, how
 * many stand, the potion pip, the recall in hand, the decrees, the objective and its progress, the stage's line, a
 * witness's line, my marks, the lord's bar, the touch buttons - and what the client hands in: a gain in flight, a
 * teaching line, the door's marker, a live line for a screen reader.
 * @param {any} E @param {string|null} me @param {number} now
 * AUDIT EG III: `held` the holder's chips (`{ k, text }` - ui/eliteGates/egBeats.js egHolderWatch), none for a witness.
 * AUDIT EG III (section 15): `bridge` - whether my Spirebridge may be asked now (the stage's line offers it, the touch layer its
 * button); the company's planks standing in this hall told on the stage's line with their seconds.
 * AUDIT EG V (c, L7-7; section 16.5 - "the HUD: the count, the watched member's name and vitals"): `watch` the member a witness
 * watches (`{ numeral, name, pct }` - their health's share, null unknown) and `ping` what is left of my ping's cooldown (ms),
 * both on a witness's stage line, the ping's on its button too. AUDIT EG V (c, L2-9, NEW-1): `restP` the rest's heal share
 * (the room's `eheal`), its line and the stake's on the rest card.
 * @param {{ ff?: string, witness?: boolean, potions?: number, gain?: { text: string, blue?: boolean }|null, first?: string, door?: any, live?: string, touch?: boolean, foldOpen?: boolean, held?: { k: string, text: string }[], bridge?: boolean, watch?: { numeral: string, name: string, pct: number|null }|null, ping?: number, restP?: number }} [o]
 */
export function egSpireHudModel(E, me, now, { ff = 'desktop', witness = false, potions = EG_POTIONS_PER_HALL, gain = null, first = '', door = null, live = '', touch = false, foldOpen = false, held = [], bridge = false, watch = null, ping = 0, restP = 1 } = {}) {
  if (!E?.b || !(E.h > 0) || E.end) return null;
  const L = EG_LAYOUTS[ff] ?? EG_LAYOUTS.desktop;
  const spec = egHallOf(E.seed, E.h, E.geo ?? 0);
  const run = me ? egRunOfMember(E, me) : null, mine = me ? egMemberOf(E, me) : null;
  const dec = (E.dc ?? []).map(([id, rank]) => `${EG_DECREES[id]?.name ?? ''}${rank >= 2 ? ' II' : ''}`).filter(Boolean);
  const watching = witness || !!mine?.wit;
  const memento = me ? (E.mm ?? []).find((q) => q[0] === me) : null;
  const witLine = watching ? [egWatchLine(watch), ping > 0 ? egPingWait(Math.ceil(ping / 1000)) : '', mine?.recall ? (memento ? `Your Memento lies in Hall ${memento[1]}. You will be called back at Redoubt ${egCircleOfHall(E.h)}.` : `You will be called back at Redoubt ${egCircleOfHall(E.h)}.`) : `${EG_TEXT.fallen} Forsaking leaves for good.`].filter(Boolean).join(' ') : '';   // AUDIT EG V (c, L7-20): in no one input's words
  const marks = me ? egSigilsOf(E.fight?.mk ?? [], me, now) : [];   // EG-ZG: sigils, never a line of text
  const n = E.co.length;
  return {
    ff, chip: egCountChip(E, now), rel: run ? EG_PRES_TEXT.reliquaries(run.rel) : '', relInChip: L.relInChip,
    standing: L.standing && n > 1 ? EG_PRES_TEXT.standing(egLivingCount(E), n) : '',
    potion: L.potion ? `${potions}/${EG_POTIONS_PER_HALL}` : '',
    recall: mine && mine.alive && !mine.home && !mine.recall ? EG_PRES_TEXT.recallSpent : '',   // my last life (PARTY8-B's law: a fact when it is actionable)
    dec, decFold: L.dec === 'fold' && dec.length > 0 ? EG_PRES_TEXT.decrees(dec.length) : '', foldOpen,
    objective: E.sg === 'trial' && !watching ? egObjectiveText(spec) : '', progress: E.sg === 'trial' && !watching ? egProgressText(spec, E.fight?.pg) : '',
    riddles: E.sg === 'trial' && !watching ? spireRiddleLines(spireOrreryOf(E.seed, spec)).join('\n') : '',   // FIELD BUGS 2026-10-17e (ORRERY-SIGHT): an Athenaeum's six, a line each - the truth the stones are turned to
    stage: watching ? witLine : [stageLine(E, now), E.sg === 'rest' ? egRestLine(E, run, restP) : '', egNextCircleText(E), egBridgeLine(E, now, bridge && !watching)].filter(Boolean).join(' '),   // AUDIT EG V (c, L2-9, NEW-1): the rest card's stake and its heal; (a1, L2-11): the next circle named
    marks, marksSaid: marks.map((m) => `${EG_MARK_NAMES[m.k] ?? ''} ${m.secs}s`).join(' - '),
    eclipse: E.sg === 'trial' || E.sg === 'closing' ? egEclipseChip(egEclipseAt(spec, now / 1000) ?? egEclipseOfBlows(E.fight?.blows, now)) : '',   // EG-PERFECT: and a lord's own (Seyth's)   // EG-ZG (section 25.5): *The Eclipse - 5*, while the place's hazards run (the fight's own stages)
    ...egLordBarsOf(E), lordH: L.lordH,   // only in a Court (a Proving Walk's champion has none); AUDIT EG V (lane1 #22): a second lord standing its own bar
    gain, first, door, live, touch: touch ? egTouchButtons({ witness: watching, rest: E.sg === 'rest', bridge: bridge && !watching, ping }) : [],
    held: watching ? [] : held,   // AUDIT EG III: the holder's chips
  };
}

// ── THE DRAWING ───────────────────────────────────────────────────────────────────────────────────────────────
export const EG_SPIRE_STYLE_ID = 'dagger-eg-spire-style';
const rgbCss = (c) => `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;
/** The classic skin's text and shadow - DFU's own (ui/native/nativePanel.js). */
export const EG_CLASSIC_TEXT_CSS = rgbCss(DEFAULT_TEXT_COLOR);
export const EG_CLASSIC_SHADOW_CSS = rgbCss(DEFAULT_SHADOW_COLOR);
export const EG_SPIRE_CSS = `
.eg-spire { position: fixed; inset: 0; pointer-events: none; z-index: 30; --s: var(--hud-scale, 1); --eg-danger: #ff5a3a; }
.eg-spire.enhanced { ${PIXEL_FONT_CSS} color: #efe8d6; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.eg-spire.classic { font: 600 15px 'Cormorant', Georgia, serif; color: ${EG_CLASSIC_TEXT_CSS}; text-shadow: 1px 1px 0 ${EG_CLASSIC_SHADOW_CSS}; }
.eg-col { position: absolute; top: 18px; left: calc(50% + min(260px, 30vw) * var(--s) + 14px); transform: scale(var(--s)); transform-origin: top left;
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px; max-width: 300px; }
.eg-chips { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.eg-chip { padding: 2px 7px; font-size: 13px; line-height: 20px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.eg-spire.enhanced .eg-chip { border-width: 2px; border-style: solid; }   /* EG-PLUS: the kit's chip paints it (ui/enhanced/enhancedFrame.js FRAME_ROLES) */
.eg-spire.classic .eg-chip { background: rgba(0,0,0,0.55); border: 1px solid ${EG_CLASSIC_SHADOW_CSS}; }
.eg-chip:empty { display: none; }
.eg-count { font-size: 18px; letter-spacing: 0.04em; }
.eg-count .eg-glyph:empty, .eg-count .eg-why:empty { display: none; }
.eg-count .eg-glyph { margin-right: 5px; font-size: 13px; }
.eg-count .eg-why { margin-left: 6px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.85; }
.eg-count.gold .eg-time { color: #e8c473; }
.eg-count.white .eg-time { color: #f4efe4; }
.eg-count.red .eg-time { color: var(--eg-danger); }
.eg-count.pulse .eg-time { animation: eg-chip-pulse 1s steps(2, jump-none) infinite; }
@keyframes eg-chip-pulse { 50% { opacity: 0.45; } }
.eg-gain { font-size: 15px; color: #e8c473; min-height: 0; }
.eg-gain.blue { color: #6f9dff; }
.eg-gain:empty { display: none; }
.eg-gain.fly { animation: eg-gain-in 600ms cubic-bezier(.2,.7,.3,1); }
@keyframes eg-gain-in { from { opacity: 0; transform: translateY(-10px); } }
.eg-dec, .eg-obj, .eg-stage, .eg-marks, .eg-first { font-size: 13px; line-height: 1.3; }
.eg-dec:empty, .eg-obj:empty, .eg-stage:empty, .eg-marks:empty, .eg-first:empty, .eg-prog:empty { display: none; }
.eg-card-lays:empty { display: none; }
.eg-obj { font-size: 15px; }
.eg-prog { display: block; font-size: 12px; opacity: 0.85; }
.eg-riddles { font-size: 12px; line-height: 1.3; white-space: pre-line; color: #e8c473; }
.eg-riddles:empty { display: none; }
.eg-marks { color: var(--eg-danger); display: flex; gap: 5px; align-items: center; }
.eg-sig { display: inline-flex; align-items: center; gap: 2px; }
.eg-sig svg { width: 18px; height: 18px; filter: drop-shadow(0 0 1px #000) drop-shadow(0 0 3px rgba(0,0,0,0.8)); }
.eg-sig b { font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
.eg-eclipse { color: var(--eg-danger); }
.eg-heldrow { display: contents; }
.eg-chip.eg-held { color: #6f9dff; }
.eg-spire.enhanced .eg-chip.eg-held, .eg-spire.classic .eg-chip.eg-held { border-color: #6f9dff; }
.eg-sigils { position: fixed; inset: 0; pointer-events: none; z-index: 29; color: var(--eg-danger, #ff3d47); text-shadow: 1px 1px 0 #000; }
.eg-sigrow { position: absolute; transform: translate(-50%, -100%); display: flex; gap: 3px; white-space: nowrap; }
.eg-sigrow .eg-sig svg { width: 22px; height: 22px; }
.eg-sigrow .eg-sig-given { color: #6f9dff; }
.eg-sigrow .eg-sig-stone { color: #e8c473; }
.eg-sigrow .eg-sig-stone b { font-size: 14px; }
.eg-first { color: #b9d0ff; font-style: italic; }
.eg-fold { pointer-events: auto; font: inherit; color: inherit; padding: 2px 8px; cursor: pointer; }
.eg-spire.classic .eg-fold { background: rgba(12,14,18,0.78); border: 1px solid #5a5446; }
.eg-spire.enhanced .eg-fold { border-width: 2px; border-style: solid; }   /* EG-PLUS: the kit's button */
.eg-fold:empty { display: none; }
.eg-lord { position: absolute; left: 50%; top: calc(18px + 28px * var(--s) + 12px); transform: translateX(-50%) scale(var(--s)); transform-origin: top center; width: 460px; max-width: 88vw; display: none; }
.eg-lord.on { display: block; }
.eg-lord-name { text-align: center; font-size: 15px; letter-spacing: 0.08em; }
.eg-lord-track { position: relative; height: calc(var(--eg-lord-h, 30px) - 20px); margin-top: 3px; background: rgba(8,6,6,0.8); border: 1px solid #5a2a20; box-sizing: border-box; }
.eg-lord-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: linear-gradient(180deg, #d9463c, #7d1b15); }
/* FB1018D WARD-BAR (section 25.2): a warded lord's cage over its bar, red-bronze and hatched, its health dimmed under it */
.eg-lord-track.ward { border-color: #c4643a; }
.eg-lord-track.ward .eg-lord-fill { filter: saturate(0.45) brightness(0.7); }
.eg-lord-track.ward::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(135deg, rgba(196,100,58,0.8) 0 2px, transparent 2px 7px); }
.eg-lord-two { display: none; margin-top: 6px; }
.eg-lord.two .eg-lord-two { display: block; }
.eg-door { position: absolute; transform: translate(-50%, -50%); display: none; text-align: center; font-size: 12px; color: #e8c473; }
.eg-door.on { display: block; }
.eg-door-arrow { display: block; font-size: 22px; line-height: 22px; }
.eg-touch { position: absolute; left: 50%; bottom: calc(96px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); display: flex; gap: 10px; }
.eg-touch:empty { display: none; }
.eg-touch button { pointer-events: auto; min-width: 88px; min-height: 44px; font: inherit; color: inherit; border: 2px solid #5a5446; }
.eg-spire.classic .eg-touch button { background: rgba(12,14,18,0.82); }   /* EG-PLUS: on Enhanced Plus the kit's button paints it */
.eg-live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.eg-spire.upright .eg-col { left: 50%; top: calc(10px + 28px * var(--s) + 8px); transform: translateX(-50%) scale(var(--s)); transform-origin: top center; align-items: center; max-width: 92vw; }
.eg-spire.upright .eg-count { font-size: 18px; }
.eg-spire.sideways .eg-col { top: 10px; }
.eg-spire.sideways .eg-lord { width: 380px; }
.eg-spire.still .eg-count.pulse .eg-time, .eg-spire.still .eg-gain.fly { animation: none; }
${EG_PARTY_CSS}`;

let root = null, P = null;
let card = null, cardP = null;
const SHOWN = () => ({ cls: '', vals: {}, chipCls: '', lordW: '', lordW2: '', lordH: '', doorL: '', doorT: '', doorR: '', touchKey: null, decKey: null, gainKey: null, danger: '', scale: '', heldKey: '' });
let shown = SHOWN(), cardShown = { key: '', alpha: -1, vis: '', cls: '' };

function ensureStyle(doc) {
  if (doc.getElementById && !doc.getElementById(EG_SPIRE_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = EG_SPIRE_STYLE_ID;
    st.textContent = EG_SPIRE_CSS + EG_FALL_CSS;   // EG-ZD: and THE FALL's
    (doc.head ?? doc.body)?.append(st);
    if (doc.head) injectEnhancedFonts(doc);
  }
}
function build(doc) {
  ensureStyle(doc);
  const el = (tag, cls) => { const n = doc.createElement(tag); n.className = cls; return n; };
  root = el('div', 'eg-spire');
  root.setAttribute?.('aria-hidden', 'false');
  const col = el('div', 'eg-col'), chips = el('div', 'eg-chips');
  const count = el('div', 'eg-chip eg-count'), glyph = el('span', 'eg-glyph'), time = el('span', 'eg-time'), why = el('span', 'eg-why');
  count.append(glyph, time, why);
  const rel = el('div', 'eg-chip eg-rel'), standing = el('div', 'eg-chip eg-standing'), potion = el('div', 'eg-chip eg-potion'), recall = el('div', 'eg-chip eg-recall');
  const eclipse = el('div', 'eg-chip eg-eclipse');   // EG-ZG: *The Eclipse - 5*
  const held = el('span', 'eg-heldrow');   // AUDIT EG III: the holder's chips
  chips.append(count, rel, standing, potion, recall, eclipse, held);
  const gain = el('div', 'eg-gain'), dec = el('div', 'eg-dec'), fold = el('button', 'eg-fold');
  const obj = el('div', 'eg-obj'), objLine = el('span', 'eg-objline'), prog = el('span', 'eg-prog');
  obj.append(objLine, prog);
  const riddles = el('div', 'eg-riddles');   // FIELD BUGS 2026-10-17e (ORRERY-SIGHT)
  const stage = el('div', 'eg-stage'), marks = el('div', 'eg-marks'), first = el('div', 'eg-first');
  col.append(chips, gain, dec, fold, obj, riddles, stage, marks, first);
  const lord = el('div', 'eg-lord'), lordName = el('div', 'eg-lord-name'), track = el('div', 'eg-lord-track'), fill = el('div', 'eg-lord-fill');
  track.append(fill);
  const two = el('div', 'eg-lord-two'), lordName2 = el('div', 'eg-lord-name'), track2 = el('div', 'eg-lord-track'), fill2 = el('div', 'eg-lord-fill');   // AUDIT EG V (lane1 #22): the second lord's
  track2.append(fill2); two.append(lordName2, track2); lord.append(lordName, track, two);
  const door = el('div', 'eg-door'), arrow = el('span', 'eg-door-arrow'), doorText = el('span', 'eg-door-text');
  arrow.textContent = '▲';
  door.append(arrow, doorText);
  const touch = el('div', 'eg-touch'), live = el('div', 'eg-live');
  live.setAttribute?.('aria-live', 'polite');
  root.append(col, lord, door, touch, live);
  (doc.body ?? doc.documentElement)?.append(root);
  P = { col, chips, count, glyph, time, why, rel, standing, potion, recall, eclipse, held, gain, dec, fold, obj, objLine, prog, riddles, stage, marks, first, lord, lordName, track, fill, lordName2, track2, fill2, door, arrow, doorText, touch, live };   // FB1018D WARD-BAR: the tracks, for the cage
}

/**
 * Draw the Spire's HUD for a model (null hides it). `skin` 'classic' | 'enhanced', `still` reduced motion, `danger` the
 * palette's danger colour (CSS), `scale` the HUD's scale; `onTouch(id)` a touch button's press, `onFold()` the folded
 * decrees' press.
 * @param {any} model
 * @param {{ hidden?: boolean, doc?: any, skin?: string, still?: boolean, danger?: string, scale?: string|number, onTouch?: (id: string) => void, onFold?: () => void }} [o]
 */
export function drawEgSpireHud(model, { hidden = false, doc = globalThis.document, skin = 'enhanced', still = false, danger = '', scale = '', onTouch = () => {}, onFold = () => {} } = {}) {
  const want = !hidden && !!model;
  if (!root) { if (!want || !doc?.createElement) return; build(doc); }
  if (!want) { if (root.style.display !== 'none') root.style.display = 'none'; return; }
  if (root.style.display === 'none') root.style.display = '';
  const cls = `eg-spire ${model.ff} ${skin === 'classic' ? 'classic' : 'enhanced'}${still ? ' still' : ''}`;
  if (cls !== shown.cls) { shown.cls = cls; root.className = cls; }
  if (danger && danger !== shown.danger) { shown.danger = danger; root.style.setProperty?.('--eg-danger', danger); }
  const sc = String(scale || '');
  if (sc && sc !== shown.scale) { shown.scale = sc; root.style.setProperty?.('--hud-scale', sc); }
  const put = (k, node, v) => { const s = v ?? ''; if (shown.vals[k] !== s) { shown.vals[k] = s; node.textContent = s; } };
  const c = model.chip;
  put('glyph', P.glyph, c?.glyph); put('time', P.time, c ? (model.relInChip && model.rel ? `${c.text} - ${model.rel.replace('Reliquaries ', 'R')}` : c.text) : '');
  put('why', P.why, c?.held ? EG_HOLD_WORDS[c.why] ?? EG_PRES_TEXT.held : '');
  const chipCls = `eg-chip eg-count${c ? ` ${c.tone}` : ''}${c?.pulse ? ' pulse' : ''}${c?.held ? ' held' : ''}${c?.seal ? ' seal' : ''}`;
  if (chipCls !== shown.chipCls) { shown.chipCls = chipCls; P.count.className = chipCls; P.count.setAttribute?.('aria-label', c?.label ?? ''); }
  put('rel', P.rel, model.relInChip ? '' : model.rel); put('standing', P.standing, model.standing); put('potion', P.potion, model.potion); put('recall', P.recall, model.recall);
  put('eclipse', P.eclipse, model.eclipse);   // EG-ZG
  // AUDIT EG III: the holder's chips, rebuilt only when what they say changes
  const hk = (model.held ?? []).map((c) => `${c.k}=${c.text}`).join('|');
  if (hk !== shown.heldKey) {
    shown.heldKey = hk;
    P.held.replaceChildren?.();
    for (const c of model.held ?? []) { const n = doc.createElement('div'); n.className = `eg-chip eg-held eg-held-${c.k.replace(/[^a-zA-Z0-9-]/g, '-')}`; n.textContent = c.text; P.held.append(n); }
  }
  const gk = model.gain ? `${model.gain.text}@${model.gain.at ?? 0}` : '';
  if (gk !== shown.gainKey) { shown.gainKey = gk; P.gain.textContent = model.gain?.text ?? ''; P.gain.className = `eg-gain${model.gain?.blue ? ' blue' : ''}${model.gain ? ' fly' : ''}`; }
  put('dec', P.dec, model.decFold && !model.foldOpen ? '' : model.dec.join(' - '));
  if (model.decFold !== shown.decKey) { shown.decKey = model.decFold; P.fold.textContent = model.decFold; if (!P.fold.egWired) { P.fold.egWired = true; P.fold.addEventListener?.('click', () => onFold()); } }
  put('obj', P.objLine, model.objective); put('prog', P.prog, model.progress); put('riddles', P.riddles, model.riddles);
  put('stage', P.stage, model.stage); put('first', P.first, model.first); put('live', P.live, model.live);
  // EG-ZG: my marks as their sigils (each its own shape), their names said to a screen reader
  const mh = (model.marks ?? []).map(egSigilHtml).join('');
  if (shown.vals.marks !== mh) { shown.vals.marks = mh; P.marks.innerHTML = mh; P.marks.setAttribute?.('aria-label', model.marksSaid ?? ''); }
  // the lord's bar
  const L = model.lord, L2 = model.lord2 ?? null;
  const lordCls = `eg-lord${L ? ' on' : ''}${L && L2 ? ' two' : ''}`;
  if (P.lord.className !== lordCls) P.lord.className = lordCls;
  put('lord', P.lordName, L ? egLordLine(L) : '');
  wardOn(P.track, !!L?.ward); wardOn(P.track2, !!L2?.ward);   // FB1018D WARD-BAR: the cage while the room says the ward
  const lw = L ? `${(L.frac * 100).toFixed(1)}%` : '0%';
  if (lw !== shown.lordW) { shown.lordW = lw; P.fill.style.width = lw; }
  // AUDIT EG V (c, L7-18; section 27.1 - a desk's bar, and "a 44 px lord's bar" on a phone held sideways): the bar's height
  // the layout's own (EG_LAYOUTS lordH - the name over it, the track the rest), never a sheet's literal
  const lh = `${Number(model.lordH) || EG_LAYOUTS.desktop.lordH}px`;
  if (lh !== shown.lordH) { shown.lordH = lh; P.lord.style.setProperty?.('--eg-lord-h', lh); }
  put('lord2', P.lordName2, L2 ? egLordLine(L2) : '');   // AUDIT EG V (lane1 #22): the second lord standing
  const lw2 = L2 ? `${(L2.frac * 100).toFixed(1)}%` : '0%';
  if (lw2 !== shown.lordW2) { shown.lordW2 = lw2; P.fill2.style.width = lw2; }
  // the door's marker
  const D = model.door;
  const doorCls = `eg-door${D ? ' on' : ''}`;
  if (P.door.className !== doorCls) P.door.className = doorCls;
  if (D) {
    const l = `${(D.x * 100).toFixed(1)}%`, t = `${(D.y * 100).toFixed(1)}%`, r = `rotate(${Math.round((D.rel * 180) / Math.PI)}deg)`;
    if (l !== shown.doorL) { shown.doorL = l; P.door.style.left = l; }
    if (t !== shown.doorT) { shown.doorT = t; P.door.style.top = t; }
    if (r !== shown.doorR) { shown.doorR = r; P.arrow.style.transform = r; }
    put('door', P.doorText, EG_PRES_TEXT.wayDown(D.dist));
  }
  // the touch buttons
  const tk = model.touch.map((b) => `${b.id}=${b.label}`).join(',');   // AUDIT EG V (c, L7-7): a label moves too (the ping's seconds)
  if (tk !== shown.touchKey) {
    shown.touchKey = tk;
    P.touch.replaceChildren?.();
    for (const b of model.touch) { const n = doc.createElement('button'); n.className = `eg-touch-${b.id}`; n.textContent = b.label; n.addEventListener?.('click', () => onTouch(b.id)); P.touch.append(n); }
  }
}

// ── EG-ZG: THE MARKS AS SIGILS (sections 13.2 and 25.5) ─────────────────────────────────────────────────────────
/** Each sigil's drawing (world/eliteGates/egTelegraph.js EG_SIGILS): a 24-unit box, filled even-odd in the palette's danger
 *  (`currentColor`), its keyline dark - or its rim's tint for Fire- and Frost-touched. Each its own shape. */
export const EG_SIGIL_PATHS = Object.freeze({
  tooth: 'M3 3h7v4h4v4h4v4h3v6h-7v-4h-4v-4H6V9H3z',
  gem: 'M7 3h10l4 6-9 12L3 9z',
  flame: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6.5 0 2.5 1 4 2.5 4.5C10.5 9 11 5 12 2z',
  flake: 'M11 2h2v20h-2zM2 11h20v2H2zM4.9 6.3l1.4-1.4 12.8 12.8-1.4 1.4zM17.7 4.9l1.4 1.4L6.3 19.1l-1.4-1.4z',
  chain: 'M2 12a5 5 0 0 1 5-5h4v3H7a2 2 0 0 0 0 4h4v3H7a5 5 0 0 1-5-5zM13 7h4a5 5 0 0 1 0 10h-4v-3h4a2 2 0 0 0 0-4h-4zM8 11h8v2H8z',
  cage: 'M4 3h16v2H4zM4 19h16v2H4zM5 5h2v14H5zM9 5h2v14H9zM13 5h2v14h-2zM17 5h2v14h-2z',
  ring: 'M12 2a10 10 0 1 1 0 20a10 10 0 1 1 0-20zM12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12z',
  eye: 'M1 12C4 6 8 4 12 4s8 2 11 8c-3 6-7 8-11 8S4 18 1 12zM12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
  knot: 'M5 4l15 15-2 2L3 6zM19 4l2 2L6 21l-2-2z',
});
/** One sigil's markup (world/eliteGates/egTelegraph.js egSigilsOf's `{ sigil, secs, rim }`): its shape, and a soul-mark's seconds
 *  beside its gem. Pure. */
export function egSigilHtml(s) {
  if (s?.sigil === 'given' || s?.sigil === 'stone') return `<span class="eg-sig eg-sig-${s.sigil}"><b>${String(s.text ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}</b></span>`;   // AUDIT EG IV (lane1 #15): an errand's members by numeral (scenes/eliteGates/egFight.js egGivenWords), in Battlemage blue
  const d = EG_SIGIL_PATHS[s?.sigil];
  if (!d) return '';
  return `<span class="eg-sig eg-sig-${s.sigil}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="currentColor" fill-rule="evenodd" stroke="${s.rim ? rgbCss(s.rim) : '#140606'}" stroke-width="${s.rim ? 1.8 : 1.2}"/></svg>${s.sigil === 'gem' ? `<b>${s.secs | 0}</b>` : ''}</span>`;
}
let sigRoot = null, sigDoc = null;
const sigRows = new Map();
/**
 * THE MARKS OVER HEADS: each marked companion's sigils where the camera sees their head (`list` - scenes/eliteGates/egFight.js's
 * `[{ key, x, y, marks }]`, x and y the screen's 0..1), in the palette's `danger` ([r, g, b]); null or empty hides them.
 * One row a member, moved and rewritten only when it changes, hidden with the HUD.
 * @param {Array<{ key: string, x: number, y: number, marks: any[] }>|null} list
 * @param {{ hidden?: boolean, doc?: any, danger?: ReadonlyArray<number>|null }} [o]
 */
export function drawEgSigils(list, { hidden = false, doc = globalThis.document, danger = null } = {}) {
  const want = !hidden && !!list?.length;
  if (!sigRoot) {
    if (!want || !doc?.createElement) return;
    ensureStyle(doc);
    sigDoc = doc;   // the rows are made in the document the layer was
    sigRoot = doc.createElement('div');
    sigRoot.className = 'eg-sigils';
    (doc.body ?? doc.documentElement)?.append(sigRoot);
  }
  if (!want || !list) { if (sigRoot.style.display !== 'none') sigRoot.style.display = 'none'; return; }
  if (sigRoot.style.display === 'none') sigRoot.style.display = '';
  const c = danger ? rgbCss(danger) : '';
  if (c && sigRoot.egDanger !== c) { sigRoot.egDanger = c; sigRoot.style.setProperty?.('--eg-danger', c); }
  const seen = new Set();
  for (const it of list) {
    seen.add(it.key);
    let row = sigRows.get(it.key);
    if (!row) { row = sigDoc.createElement('div'); row.className = 'eg-sigrow'; row.egHtml = ''; sigRoot.append(row); sigRows.set(it.key, row); }
    const html = it.marks.map(egSigilHtml).join('');
    if (row.egHtml !== html) { row.egHtml = html; row.innerHTML = html; }
    const l = `${(it.x * 100).toFixed(2)}%`, t = `${(it.y * 100).toFixed(2)}%`;
    if (row.style.left !== l) row.style.left = l;
    if (row.style.top !== t) row.style.top = t;
  }
  for (const [k, row] of sigRows) if (!seen.has(k)) { row.remove?.(); sigRows.delete(k); }
}

/** Draw the arrival card for a shown card (egArrivalShown; null hides it). */
export function drawEgArrivalCard(m, { hidden = false, doc = globalThis.document, still = false } = {}) {
  const want = !hidden && !!m;
  if (!card) {
    if (!want || !doc?.createElement) return;
    if (doc.getElementById && !doc.getElementById(TITLE_CARD_STYLE_ID)) { const st = doc.createElement('style'); st.id = TITLE_CARD_STYLE_ID; st.textContent = TITLE_CARD_CSS; (doc.head ?? doc.body)?.append(st); }
    ensureStyle(doc);
    const el = (cls) => { const n = doc.createElement('div'); n.className = cls; return n; };
    card = el('wb-title-card eg-card');
    card.setAttribute?.('aria-hidden', 'true');   // the live line says it in words
    cardP = { kicker: el('wb-title-kicker'), main: el('wb-title-main'), rule: el('wb-title-rule'), sub: el('wb-title-sub'), twist: el('wb-title-sub eg-card-twist'), dec: el('wb-title-sub eg-card-dec'), band: el('wb-title-sub eg-card-band'), lays: el('wb-title-sub eg-card-lays') };   // EG-ZS: the Markynaz's decree
    card.append(cardP.kicker, cardP.main, cardP.rule, cardP.sub, cardP.lays, cardP.twist, cardP.dec, cardP.band);
    (doc.body ?? doc.documentElement)?.append(card);
  }
  const vis = want ? 'on' : 'off';
  if (vis !== cardShown.vis) { cardShown.vis = vis; card.style.display = want ? '' : 'none'; }
  if (!want || !m) return;
  if (m.key !== cardShown.key) {
    cardShown.key = m.key;
    for (const k of ['kicker', 'main', 'sub', 'lays', 'twist', 'dec', 'band']) cardP[k].textContent = m[k] ?? '';
  }
  const cls = `wb-title-card eg-card on${m.fresh && !still ? ' in' : ''}${still ? ' still' : ''}`;   // AUDIT EG V (c, L7-17): the rule never sweeps under reduced motion
  if (cls !== cardShown.cls) { cardShown.cls = cls; card.className = cls; }
  if (m.alpha !== cardShown.alpha) { cardShown.alpha = m.alpha; card.style.opacity = String(m.alpha); }
}

// ── EG-ZD: THE FALL (section 16.5) ─────────────────────────────────────────────────────────────────────────────
/** THE FALL's beats (ms): the camera sinks as the colour drains, the card stands, the witness view dithers in; the whole. */
export const EG_FALL_SINK_MS = 1200;
export const EG_FALL_CARD_MS = 2500;
export const EG_FALL_DITHER_MS = 600;
export const EG_FALL_MS = EG_FALL_SINK_MS + EG_FALL_CARD_MS + EG_FALL_DITHER_MS;
/** How far the camera sinks (m, from the eye toward the floor), and the colour the screen drains to (a fifth of it). */
export const EG_FALL_SINK_M = 1.2;
export const EG_FALL_SAT = 0.2;
/** The dither's levels past none: an ordered 2x2 dither's quarters (its cells darkened in Bayer's order). */
export const EG_FALL_DITHER_STEPS = 4;
const BAYER2 = Object.freeze([[0, 0], [1, 1], [1, 0], [0, 1]]);
/** THE FALL's words (the client's alone - net/eliteGates/egLaw.js EG_TEXT is the relay's bundle's; its final line is the law's). */
export const EG_FALL_TEXT = Object.freeze({ main: 'Fallen', first: 'The next Redoubt can call you back.', final: EG_TEXT.fallen, lost: (n) => `Reliquaries lost: ${n}` });
/**
 * THE FALL at `now` (pure), or null before it and once the witness view stands: `fall` is `{ at, final, lost }` - when it
 * began, whether it was the last (no recall left), the Reliquaries it cost. Answers `{ phase, sink, sat, eye, veil, card }`:
 * the phase ('sink' | 'card' | 'dither'); how far the camera has sunk (m); the screen's colour (1 whole, EG_FALL_SAT at its
 * least); whose eye the screen is ('fall' - the fallen's own, sinking - or 'witness'); the dither's darkness (0-1, in
 * quarters); the card (`{ key, main, sub, lost, alpha, fresh }`, ui/gate/gateTitleCard.js titleCardModel's fade) or null.
 * `still` (reduced motion): no sink, the colour cut at once, the card never rising, the witness view cut in, no dither.
 * @param {{ at: number, final?: boolean, lost?: number, down?: boolean }|null} fall @param {number} now @param {{ still?: boolean }} [o]
 */
export function egFallModel(fall, now, { still = false } = {}) {
  if (!fall || !Number.isFinite(fall.at)) return null;
  const u = now - fall.at;
  if (!(u >= 0) || u >= EG_FALL_MS) return null;
  const S = EG_FALL_SINK_MS, C = S + EG_FALL_CARD_MS, k = Math.min(1, u / S);
  const phase = u < S ? 'sink' : u < C ? 'card' : 'dither';
  let sat = still ? EG_FALL_SAT : 1 - (1 - EG_FALL_SAT) * k, eye = 'fall', veil = 0;
  if (phase === 'dither') {
    const d = (u - C) / EG_FALL_DITHER_MS;
    if (still || d >= 0.5) { eye = 'witness'; sat = 1; }
    if (!still) veil = Math.round((d < 0.5 ? d * 2 : (1 - d) * 2) * EG_FALL_DITHER_STEPS) / EG_FALL_DITHER_STEPS;
  }
  const m = titleCardModel({ kind: 'fall', at: fall.at + S, until: fall.at + C + EG_FALL_DITHER_MS / 2, main: fall.down ? t('eg.fall.down', 'Down') : EG_FALL_TEXT.main, sub: fall.down ? t('eg.fall.raise', 'A party member can raise you. Enter: give up.') : fall.final ? EG_FALL_TEXT.final : EG_FALL_TEXT.first }, now);   // AUDIT WORLD-EVENTS L1-4: lying down, a raise to come
  return {
    phase, sink: still ? 0 : Math.round(EG_FALL_SINK_M * (1 - (1 - k) ** 3) * 1000) / 1000, sat: Math.round(sat * 1000) / 1000, eye, veil,
    card: m ? { key: m.key, main: m.main, sub: m.sub, lost: (fall.lost ?? 0) > 0 ? EG_FALL_TEXT.lost(fall.lost) : '', alpha: m.alpha, fresh: m.fresh && !still, still: !!still } : null,   // AUDIT EG V (c, L7-17): `still` - its rule never sweeps
  };
}
/** The cells of an ordered 2x2 dither darkened at `level` (0-1, in quarters), in Bayer's order (pure). */
export const egDitherCells = (level) => BAYER2.slice(0, Math.max(0, Math.min(4, Math.round(level * EG_FALL_DITHER_STEPS))));
/** The dither's veil as a CSS background (pure): none, the whole screen black, or a 2x2 cell pattern at 4 px a cell. */
export function egDitherCss(level) {
  const cells = egDitherCells(level);
  if (!cells.length) return 'none';
  if (cells.length >= 4) return '#000';
  const rects = cells.map(([x, y]) => `<rect x='${x}' y='${y}' width='1' height='1'/>`).join('');
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='2' height='2' shape-rendering='crispEdges'>${rects}</svg>`)}") 0 0 / 8px 8px repeat`;
}
export const EG_FALL_CSS = `
.eg-fall { position: fixed; inset: 0; pointer-events: none; z-index: 29; }
.eg-fall-drain, .eg-fall-veil { position: absolute; inset: 0; }
.eg-fall-veil { image-rendering: pixelated; }
.eg-fall-lost { font-size: 18px; letter-spacing: 0.06em; min-height: 22px; color: #ff5a3a; }
.eg-fall-lost:empty { display: none; }`;
let fall = null, fallP = null, fallCard = null;
const FALL_SHOWN = () => ({ vis: '', sat: -1, veil: -1, main: null, sub: null, lost: null, alpha: -1, cls: '', cardVis: '', danger: '' });
let fallShown = FALL_SHOWN();
/**
 * Draw THE FALL for a model (egFallModel; null takes it down): the screen's colour drained behind everything (a
 * backdrop's saturation - the HUD above it keeps its own), the dither's veil, and the card on a node of its own wearing
 * the gate's title card's sheet (the gate's card is the fight's), hidden with the HUD. `danger` the palette's red (CSS).
 * @param {any} m @param {{ hidden?: boolean, doc?: any, danger?: string }} [o]
 */
export function drawEgFall(m, { hidden = false, doc = globalThis.document, danger = '' } = {}) {
  if (!fall) {
    if (!m || !doc?.createElement) return;
    if (doc.getElementById && !doc.getElementById(TITLE_CARD_STYLE_ID)) { const st = doc.createElement('style'); st.id = TITLE_CARD_STYLE_ID; st.textContent = TITLE_CARD_CSS; (doc.head ?? doc.body)?.append(st); }
    ensureStyle(doc);
    const el = (cls) => { const n = doc.createElement('div'); n.className = cls; return n; };
    fall = el('eg-fall');
    fall.setAttribute?.('aria-hidden', 'true');   // the HUD's live line says it in words
    fallP = { drain: el('eg-fall-drain'), veil: el('eg-fall-veil') };
    fall.append(fallP.drain, fallP.veil);
    fallCard = el('wb-title-card eg-fall-card');
    fallCard.setAttribute?.('aria-hidden', 'true');
    Object.assign(fallP, { kicker: el('wb-title-kicker'), main: el('wb-title-main'), rule: el('wb-title-rule'), sub: el('wb-title-sub'), lost: el('eg-fall-lost') });
    fallCard.append(fallP.kicker, fallP.main, fallP.rule, fallP.sub, fallP.lost);
    (doc.body ?? doc.documentElement)?.append(fall, fallCard);
  }
  const vis = m ? 'on' : 'off';
  if (vis !== fallShown.vis) { fallShown.vis = vis; fall.style.display = m ? '' : 'none'; }
  const C = m && !hidden ? m.card : null, cardVis = C ? 'on' : 'off';
  if (cardVis !== fallShown.cardVis) { fallShown.cardVis = cardVis; fallCard.style.display = C ? '' : 'none'; }
  if (!m) return;
  if (m.sat !== fallShown.sat) { fallShown.sat = m.sat; const f = m.sat < 1 ? `saturate(${m.sat})` : ''; fallP.drain.style.backdropFilter = f; fallP.drain.style.webkitBackdropFilter = f; }
  if (m.veil !== fallShown.veil) { fallShown.veil = m.veil; fallP.veil.style.background = egDitherCss(m.veil); }
  if (danger && danger !== fallShown.danger) { fallShown.danger = danger; fallP.lost.style.color = danger; }
  if (!C) return;
  for (const k of ['main', 'sub', 'lost']) if (C[k] !== fallShown[k]) { fallShown[k] = C[k]; fallP[k].textContent = C[k]; }   // the room's word can make it the last while it stands
  const cls = `wb-title-card eg-fall-card on${C.fresh ? ' in' : ''}${C.still ? ' still' : ''}`;   // AUDIT EG V (c, L7-17)
  if (cls !== fallShown.cls) { fallShown.cls = cls; fallCard.className = cls; }
  if (C.alpha !== fallShown.alpha) { fallShown.alpha = C.alpha; fallCard.style.opacity = String(C.alpha); }
}

/** The page is going (a test's reset): the nodes leave with it. */
export function destroyEgSpireHud() {
  root?.remove?.(); card?.remove?.(); fall?.remove?.(); fallCard?.remove?.();   // EG-ZD: and THE FALL's
  root = null; P = null; card = null; cardP = null; fall = null; fallP = null; fallCard = null;
  shown = SHOWN(); cardShown = { key: '', alpha: -1, vis: '', cls: '' }; fallShown = FALL_SHOWN();
}
