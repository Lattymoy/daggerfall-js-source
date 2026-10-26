// @ts-check
// WB1 (2026-09-25): THE OMEN - what the clock's gate says to one player: the chat's lines, the map's ring, the
// compass's mark. Design: bible/11-Multiplayer/World-Bosses.md sections 1-2.
//
// ONE CALL A FRAME from the online frame (scenes/world.js `gateFrame`, beside the chat's and the duel's - before the
// dead return, so the omen still speaks to a player on the death screen), and reads for the maps and the HUD.
// Everything here is a function of the RELAY'S clock (`now`), which the host reads through the welcome's offset
// (WORLD5); before the first welcome the offset is 0 and the machine's own clock stands in, as it does for the sky.
//
// EACH LINE IS SAID ONCE. The last moment announced is remembered by the gate's day and phase, so a frame that finds
// the same phase says nothing, and a player who arrives mid-gate hears the one line for where the gate stands now -
// "it opens in 2:30", not the omen, the rise and the countdown in a burst - with what goes beside it once a day (the
// rite's order, tonight's marks; AUDIT WB12d D21).
//
// THE SITE IS ASKED LAZILY: the scan over the map files (systems/gate/gateSite.js) runs the first time a gate is in the
// omen or later, not at boot, and a host with no map data (a probe, a test) hands `site` a null and the omen stays
// silent rather than naming nowhere.
//
// Not a DFU member. Ledger A (WB).
import { gateAt, gatePhase, gateCountdown, countdownText, countdownWords, gateMarked, gateStands, gateBossOf, gateModsOf, riseLine, wrathLine, marksLine, gatePortentsOf, portentsLine, GATE_OPEN_MINUTE, GATE_SEAL_MINUTE, GATE_WRATH_MINUTE, GATE_DAY_MINUTES, GATE_COLLAPSE_MS, PIXEL_M } from '../../net/gate/gateLaw.js';
import { gateModsWords, gatePortentsWords } from '../../net/gate/gateMods.js';   // WB8c: tonight's marks on the card
import { GATE_TOWN_MAX_PX } from './gateSite.js';
import { t } from '../textManager.js';   // GATE-COURTS: a court's kill in the player's language (L10N4)
import { RITE_OMEN_LINE, cageStands } from '../../net/gate/gateRite.js';   // BROKER-CAGE: the Broker's cage, omen to midnight

// TIME1 (bible/06-Systems/Online-Time-Arc.md section 7): THE GATE SAYS REAL TIMES ALONE. Its schedule is the EVENT
// clock's (net/gate/gateLaw.js, unchanged: a gate every two real hours, its phases the same real minutes), and the sky the
// player sees turns at its own rate, so the event clock's game time ("opens there at 20:00") would contradict the
// clock in front of them. The three lines that named a time say this machine's local time alone, in WB12's words
// (WB13b). gateLaw.js's own three, in the relay's bundle, retired with WB12's relay deploy (world151), the one that
// happened anyway; the rise, the wrath and the marks name no time and are still its.
/** The omen: where, and when it opens - local time. */
export const omenTimeLine = ({ place, at }) => `The sky burns near ${place}. Dagon's faithful open a breach at ${at} your time.`;
/** The opening: when the Covenant seals it - local time. */
export const openTimeLine = ({ near, at }) => `Dagon's Breach near ${near} is open. The Covenant seals it at ${at} your time.`;
/** The seal: when it collapses - local time (GATE-COLLAPSE). */
export const sealTimeLine = ({ near, at }) => `The Covenant has sealed Dagon's Breach near ${near}. It collapses at ${at} your time.`;

/** Is map pixel (px, py) within the omen's ring, give or take `slack` pixels? The compass carries the gate only here:
 *  inside the area the map drew, where the player has come looking. */
export const insideGateRing = (mark, px, py, slack = 1) => !!mark && Math.hypot(px + 0.5 - mark.cx, py + 0.5 - mark.cy) <= mark.r + slack;
/** The gate's spot in the SCENE's x/z: its pixel's translation (the streaming host's `pixelTranslation`, the pixel's
 *  south-west corner) plus the spot, [east, north] metres - spawned dungeons' own sum (scenes/world.js, the sight line). */
export const gateSceneXZ = (standing, t) => [t[0] + standing.spot[0], t[2] + standing.spot[1]];
/** WB12d: the faithful's rite, said right after the omen's line while it holds (scenes/riteHost.js stands its circle) -
 *  AUDIT WB12d (D3): the Discord post's own sentences (net/gate/gateRite.js RITE_OMEN_LINE). */
export const riteOmenLine = () => RITE_OMEN_LINE;

// ═══ WBX8: THE SKY BURNS ═════════════════════════════════════════════════════════════════════════════════════════
// Mac (2026-09-26): "Improve the sky effect to be more like the /event dread command" - "When I say sky effect, I mean
// daggerfall, not the inside". The omen has always SAID it - "The sky burns over the wilds near ..." - and the sky over
// the site never did: the gate's only mark on it was its beacon. Now the sky over a gate wears the live event's dread
// (world/dreadSky.js: the crimson grade on the sky, its fog and the light the land stands in, the storm's deck) with
// the event's red storm gathered round the gate - not round the eye - so its lightning shows where the gate stands.
// A function of the relay's clock and the eye's distance from the site, so every player near a gate sees the same sky
// at the same moment; nothing is sent. The court (the inside) keeps the Deadlands' own sky (render/deadlands.js).
//
// ITS LIFE: the omen's first line kindles it (GATE_SKY_KINDLE of it within GATE_SKY_KINDLE_MS, so the line is true at
// once) and it deepens to GATE_SKY_OMEN by the rise, to GATE_SKY_RISEN by the opening, and whole within
// GATE_SKY_KINDLE_MS of it; open, sealed and until its end (the kill or the wrath) it burns whole; it clears as the gate
// collapses (GATE_COLLAPSE_MS) - the dread lifting as the event's does. Never a step: every stage walks from the last. ITS REACH: whole within GATE_SKY_FULL_M of the gate - the town it is reached from stands under it
// (gateSite.js GATE_TOWN_MAX_PX) - thinning to nothing at GATE_SKY_EDGE_M.
export const GATE_SKY_KINDLE = 0.35;
export const GATE_SKY_KINDLE_MS = 30_000;
export const GATE_SKY_OMEN = 0.6;
export const GATE_SKY_RISEN = 0.85;
export const GATE_SKY_FULL_M = Math.ceil((GATE_TOWN_MAX_PX + 1) * PIXEL_M);
export const GATE_SKY_EDGE_M = 12_000;
/** The gate's storm: its own schedule (a salt on the event's) and its reach round the gate - near strikes at the gate
 *  itself, far ones over the land round it (world/dreadSky.js dreadStrikes' ring). */
export const GATE_STORM_RING = Object.freeze({ salt: 0x6a7e5b1d, near: 120, split: 1400, far: 4500, nearShare: 0.55 });

const smooth01 = (x) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };

/**
 * How much the sky burns over a gate at `nowMs`, 0..1, by its life alone (its times `t`, the relay's word of its fall).
 * The end is gatePhase's own: a fall after the opening, or the wrath. Pure.
 * @param {{omenAt:number, riseAt:number, openAt:number, sealAt:number, wrathAt:number}|null} t
 * @param {number} nowMs
 * @param {number|null} [fellAt]
 */
export function gateSkyPhaseWeight(t, nowMs, fellAt = null) {
  if (!t || !Number.isFinite(nowMs) || nowMs < t.omenAt) return 0;
  if (nowMs < t.riseAt) {
    return GATE_SKY_KINDLE * smooth01((nowMs - t.omenAt) / GATE_SKY_KINDLE_MS) + (GATE_SKY_OMEN - GATE_SKY_KINDLE) * smooth01((nowMs - t.omenAt) / (t.riseAt - t.omenAt));
  }
  if (nowMs < t.openAt) return GATE_SKY_OMEN + (GATE_SKY_RISEN - GATE_SKY_OMEN) * smooth01((nowMs - t.riseAt) / (t.openAt - t.riseAt));
  const end = Number.isFinite(fellAt) && /** @type {number} */ (fellAt) >= t.openAt ? Math.min(/** @type {number} */ (fellAt), t.wrathAt) : t.wrathAt;
  const whole = GATE_SKY_RISEN + (1 - GATE_SKY_RISEN) * smooth01((nowMs - t.openAt) / GATE_SKY_KINDLE_MS);   // the opening burns it whole
  if (nowMs < end) return whole;
  return whole * (1 - smooth01((nowMs - end) / GATE_COLLAPSE_MS));
}

/** How much of a gate's sky reaches an eye `distM` metres from it, 0..1: whole within GATE_SKY_FULL_M, nothing past
 *  GATE_SKY_EDGE_M. Pure. */
export function gateSkyNear(distM) {
  if (!Number.isFinite(distM)) return 0;
  return 1 - smooth01((distM - GATE_SKY_FULL_M) / (GATE_SKY_EDGE_M - GATE_SKY_FULL_M));
}

/** The sky a gate burns over an eye `distM` metres off at `nowMs`: its life's weight by its reach. Pure. */
export const gateSkyWeight = (t, nowMs, fellAt, distM) => gateSkyPhaseWeight(t, nowMs, fellAt) * gateSkyNear(distM);

/** AUDIT GATE-COURTS C4: how long past the seal its line waits for the night's word (the first court's book says it at
 *  the seal where every court has won; a hub that missed it is told again GATE_TELL_RETRY_MS on, net/wire.js). */
export const SEAL_SAY_HOLD_MS = 6_000;
/** WB3b: the kill, said to everyone online (the hub's word): who stood where, and who struck hardest. */
export const fellLine = ({ near, boss, top }) => `${boss} has fallen at Dagon's Breach ${near ? `near ${near}` : 'in the wilds'}${top?.length ? `, struck down by ${top.length > 1 ? `${top.slice(0, -1).join(', ')} and ${top[top.length - 1]}` : top[0]}` : ''}. The breach collapses.`;   // WB13b: "in the wilds" where this screen never found the site, as Discord says it
/** GATE-COURTS (net/gate/gateCourts.js): a court's kill, said to everyone online (the hub's `cf`) - its court by its number
 *  (the first is 1), where, and who struck hardest; no collapse - the breach stands for the night's other courts until
 *  every one is done (the night's own `fell`). In the player's language. */
export const courtFellLine = ({ near, boss, top, c = 0 }) => {
  const args = { boss, court: c + 1, near: near ?? '', by: (top ?? []).join(', '), struck: top?.length ? 'yes' : 'no' };
  return near
    ? t('net.gate.courtFell', "{boss} has fallen in court {court} of Dagon's Breach near {near}{struck, select, yes {, struck down by {by}} other {}}.", args)
    : t('net.gate.courtFellWilds', "{boss} has fallen in court {court} of Dagon's Breach in the wilds{struck, select, yes {, struck down by {by}} other {}}.", args);
};

/**
 * EVENT-TIP (2026-09-28, Mac: "I also want to add a tooltip to the map for these type of events"): THE GATE'S CARD on
 * the held map (ui/eventMapMarks.js) - what it is, where, when it next moves (opens, seals, collapses: the countdown's
 * own words), and who holds it, or that he fell. WB8c: and while he stands, the marks he comes under tonight (net/gate/gateLaw.js
 * gateModsOf - "The Rime-Wrought - Colossal, Echoing"). Pure.
 * @param {{site: {place: string}, phase: string, t: {day: number}}} c the omen's current gate
 * @param {{to: string, ms: number}|null} cd its countdown now (gateCountdown)
 * @param {number|null} [fell] the relay's word of the kill
 */
export function gateTip(c, cd, fell = null, boss = gateBossOf(c.t.day)) {
  const when = cd
    ? (cd.to === 'open' ? `Opens in ${countdownText(cd.ms)}` : cd.to === 'seal' ? `Open. Seals in ${countdownText(cd.ms)}` : `Sealed. Collapses in ${countdownText(cd.ms)}`)
    : (c.phase === 'collapsing' ? 'Collapsing' : null);
  const pt = gatePortentsWords(gatePortentsOf(c.t.day));   // WB14b: the night's portents, named
  return { title: 'Dagon\'s Breach', lines: [`Near ${c.site.place}`, ...(when ? [when] : []), ...(Number.isFinite(fell) ? [`${boss.name} has fallen`] : [`${boss.name}, ${boss.title}`, marksLineOf(c.t.day), ...(pt ? [pt] : [])])] };
}
/** AUDIT PRE-MERGE 0929 W2-2: a day's marks as the card says them, worded once a day - the card is asked every frame a
 *  gate stands on the map, and the marks were read and joined anew each time. */
let _marksDay = null, _marksLine = '';
function marksLineOf(day) {
  if (day !== _marksDay) {
    const marks = gateModsWords(gateModsOf(day));
    _marksLine = `${marks.charAt(0).toUpperCase()}${marks.slice(1)}`;
    _marksDay = day;
  }
  return _marksLine;
}

/** The phases that say a line on arrival, and the line each says. */
const SAYS = Object.freeze({ omen: 'omen', rising: 'rise', sealed: 'rise', open: 'open', closed: 'seal', collapsing: 'wrath' });
/** AUDIT WB C4: the lines in the order a gate lives them - a line is said only past the last one said for its day, so a
 *  clock that steps back (the relay's offset arriving, a correction) never says one twice. */
const LINE_ORDER = Object.freeze(['omen', 'rise', 'open', 'seal', 'wrath']);
/** AUDIT WB C4: how long the omen holds its peace once its host is ready (the relay's clock read, the hub's welcome
 *  come) - the hub's word of a kill arrives just behind its welcome, and a gate said open before it would be wrong. */
export const OMEN_SETTLE_MS = 1500;

/**
 * `now` the relay-clock ms; `site` the day's site (gateSite.findGateSite), or null when there is no map data; `say` a
 * line said to every screen (the host's - the event board's news since EVENTS1, systems/eventNotices.js); `localTime` the real time a classic minute falls at on THIS machine
 * ("14:32"); `fellAt` the relay's word of the kill (WB3), null until it is said. AUDIT WB C4: `ready` whether the host
 * knows the relay's clock and has heard the hub (until then nothing is said and no gate stands - the machine's own
 * clock is not the world's), and `settleMs` how long past that the omen still holds (OMEN_SETTLE_MS in the game).
 * AUDIT WB12d (C8, L5): `riteBroken(day, site)` whether the hub said that breach's rite broken, and `riteReady()` whether
 * the relay keeps the rite at all - the rite's order is not said otherwise.
 * @param {{now: () => number, site: (day: number) => any, say: (text: string) => void, localTime?: (classicMinutes: number) => (string|null), fellAt?: (day: number) => (number|null), ready?: () => boolean, settleMs?: number, riteBroken?: (day: number, site: any) => boolean, riteReady?: () => boolean}} deps
 */
export function createGateOmen({ now, site, say, localTime = () => null, fellAt = () => null, ready = () => true, settleMs = 0, riteBroken = () => false, riteReady = () => true }) {
  let saidDay = null, saidRank = -1;   // the day the last line was said for, and how far through its lines
  let marksDay = null;   // WB8c: the day whose marks were said (once, beside the first of its omen, rise or open)
  let riteDay = null;   // WB12d: the day whose rite was said (once, beside its omen or its rise)
  let readyAt = null, settled = false; // when the host was first ready (the relay's clock), and whether its settle is over
  let cache = { day: null, site: null };
  let cage = null;   // BROKER-CAGE: the last site the cage was asked for - made once a site
  const siteOf = (day) => {
    if (cache.day !== day) cache = { day, site: site(day) ?? null };
    return cache.site;
  };
  const at = (day, minute) => localTime(day * GATE_DAY_MINUTES + minute) ?? '?';
  let current = null;

  return {
    /** One frame: the gate's state now, and its line if a new one is due. */
    frame() {
      if (!ready()) { readyAt = null; settled = false; current = null; return null; }
      if (!settled) {
        // a clock that steps back while the omen settles counts the wait from where it stands now; once settled, a
        // step never silences the gate again - only the host's losing the relay does
        if (readyAt == null || now() < readyAt) readyAt = now();
        if (now() - readyAt < settleMs) { current = null; return null; }
        settled = true;
      }
      const t = gateAt(now());
      const fell = fellAt(t.day);
      const phase = gatePhase(t, now(), fell);
      if (phase === 'quiet' || phase === 'gone') { current = { t, phase, site: null }; return current; }
      const s = siteOf(t.day);
      current = { t, phase, site: s };
      if (!s) return current;
      const line = SAYS[phase];
      // AUDIT GATE-COURTS C4: the seal's line waits SEAL_SAY_HOLD_MS - on a night whose every court has won, the night's
      // word comes at the seal, and "it collapses at midnight" was said a moment before it collapsed
      if (line === 'seal' && now() - t.sealAt < SEAL_SAY_HOLD_MS) return current;
      // a gate collapsing because its boss FELL says no wrath: the relay's own line (WB3) said the fall
      const rank = LINE_ORDER.indexOf(line);
      if (line && (t.day !== saidDay || rank > saidRank) && !(line === 'wrath' && Number.isFinite(fell))) {
        saidDay = t.day; saidRank = rank;
        const words = { place: s.place, near: s.near, boss: gateBossOf(t.day).name };
        if (line === 'omen') say(omenTimeLine({ ...words, at: at(t.day, GATE_OPEN_MINUTE) }));   // TIME1: local time alone
        else if (line === 'rise') say(riseLine({ ...words, left: countdownText(t.openAt - now()) }));
        else if (line === 'open') say(openTimeLine({ ...words, at: at(t.day, GATE_SEAL_MINUTE) }));
        // WB12d: the faithful's rite, while it holds - right after the omen's or the rise's line (AUDIT WB12d D3: its
        // "nearby" is the breach just named), once a day; AUDIT WB12d (C8, L5): never once the hub says it broken, nor
        // where the relay cannot keep it
        if ((line === 'omen' || line === 'rise') && riteDay !== t.day) { riteDay = t.day; if (riteReady() && !riteBroken(t.day, s)) say(riteOmenLine()); }
        // WB8c: tonight's marks, beside the first line of a gate still to be fought (never after it has sealed)
        if ((line === 'omen' || line === 'rise' || line === 'open') && marksDay !== t.day) {
          marksDay = t.day;
          say(marksLine({ boss: words.boss, md: gateModsOf(t.day) }));
          const pt = portentsLine(gatePortentsOf(t.day));   // WB14b: and the night's portents, after them - announced, always
          if (pt) say(pt);
        }
        else if (line === 'seal') say(sealTimeLine({ ...words, at: at(t.day, GATE_WRATH_MINUTE) }));   // GATE-COLLAPSE: and when it goes
        else if (line === 'wrath') say(wrathLine(words));
      }
      return current;
    },
    /** The gate as the last frame saw it: {t, phase, site}, or null before the first frame. */
    current: () => current,
    /** The map's mark while the omen stands: the ring (map pixels), the gate's name and its countdown's words. */
    mapMark() {
      const c = current;
      if (!c?.site || !gateMarked(c.phase)) return null;
      const cd = gateCountdown(c.t, now(), c.phase);
      const label = cd ? `Dagon's Breach - ${cd.to === 'collapse' ? 'sealed, ' : ''}${countdownWords(cd)}` : 'Dagon\'s Breach';   // GATE-COLLAPSE: the sealed hours count down too
      return { day: c.t.day, cx: c.site.ring.cx, cy: c.site.ring.cy, r: c.site.ring.r, label, phase: c.phase, tip: gateTip(c, cd, fellAt(c.t.day)) };   // EVENT-TIP: and its card
    },
    /** WBX8: THE SKY THE GATE BURNS over an eye at `eye` (scene metres): its weight (gateSkyWeight - its life by its
     *  reach) and where the site stands in the scene (`x`, `z` - the storm gathers there), or null when no gate burns
     *  over it. From the omen on: the site is known before the gate stands. */
    sky(eye, pixelTranslation) {
      const c = current;
      if (!c?.site || !eye) return null;
      const [x, z] = gateSceneXZ(c.site, pixelTranslation(c.site.px, c.site.py));
      const weight = gateSkyWeight(c.t, now(), fellAt(c.t.day), Math.hypot(eye[0] - x, eye[2] - z));
      return weight > 0 ? { weight, x, z } : null;
    },
    /** BROKER-CAGE: THE BROKER'S SITE - the breach the clock is about, `{day, px, py}`, from its omen to the Wrath's
     *  midnight (net/gate/gateRite.js cageStands): a Warden fallen early takes the gate (its phase `gone`, no site in
     *  `current`), never her - so the site is read off the day. Null outside it, or before the first frame. */
    cageSite() {
      const c = current;
      if (!c?.t || !cageStands(c.t.day, now())) return null;
      const s = c.site ?? siteOf(c.t.day);
      if (!s) return null;
      if (cage?.day !== c.t.day || cage.px !== s.px || cage.py !== s.py) cage = Object.freeze({ day: c.t.day, px: s.px, py: s.py });
      return cage;
    },
    /** Where the gate stands, for the compass and the gate's own pool (WB2): its pixel and its spot in it, its phase,
     *  its times and the relay's word of its fall (the pool times the rise and the collapse by them), while it stands. */
    standing() {
      const c = current;
      return c?.site && gateStands(c.phase) ? { day: c.t.day, px: c.site.px, py: c.site.py, spot: c.site.spot, phase: c.phase, t: c.t, fellAt: fellAt(c.t.day), near: c.site.near } : null;
    },
  };
}
