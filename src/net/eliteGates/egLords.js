// @ts-check
// EG-FULL (2026-10-11, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 8.5, 8.6, 13 and 18): THE
// LORDS AND THE CHAMPIONS - every boss of the Spire on ONE engine (net/eliteGates/egBodies.js's bodies, blows and words): the
// thirteen Court lords and Valkynaz and the three Proving champions, each its own kit, its phases, its signature and its
// errands; and the laws every one keeps -
//   HEALTH  `egTtkRef(c)` seconds of the company's reference damage per fighter (x1.07 a circle to circle 20, x1.03
//           past it), the champion's EG_PROVE_HP_S;
//   PHASES  at the gate's PHASE_AT (0.66, 0.33), each turn warded SHIELD_MS; each phase adds a mechanic, never a faster
//           one; a signature errand holds the next threshold until it resolves (`hpFloor`);
//   TARGETS the gate's: THREAT_PICK to the top of threat, the rest at a random living member, threat forgetting
//           THREAT_DECAY a second (Grudge-Bearer: 0.85, never forgetting);
//   FURY    at EG_FURY_RATIO x ttkRef seconds into the fight: every 30 s a wave of the band's legion, shares a tenth
//           more (within EG_SHARE_X_MAX), and from the second step its aimed blows chain a second shape - never a
//           shorter wind-up (NOTHING GETS FASTER);
//   THE WIND-UP FLOOR, THE WIDTH RULE and THE UNION FLOOR on every aimed blow (net/eliteGates/egShape.js, net/eliteGates/egBodies.js egAim);
//   THE CHECK CLASS for whole-floor, haven and errand-failure blows (fixed wind-up and damage; errand floors below);
//   THE COVENANT'S PATIENCE - a count spent while a Court's lord is awake: fury at once and the Covenant's Weight every
//           30 s (30% to all, a 3.0 s wind-up - a CHECK).
// The lords' decrees (section 14's lord family) fold into each lord as X-keyed laws: Colossal (radii x1.2, health
// x1.25), Unyielding (ward x2, blows on it x0.85), Vengeful (shares x1.25), Grudge-Bearer (threat 0.85, no decay) - EG5:
// the fight's profile folds them (net/eliteGates/egLaw.js egFightProfile), and egLordLaw reads it.
//
// EG-ZK (2026-10-12; sections 11.7 and 13.1): every lord and champion ON THE BOSS SEAM (EG_SEAM, below - one plug, which the
// breach's director calls inside its one beat), and WALKING THE HALL'S GRAPH as the legion does (net/eliteGates/egWalkGraph.js): straight
// within the piece of the fight ground it stands on, over the graph past it - through an arch's gap, up a stair, along
// Grath's bridges - never through a wall or over the void; a run (a Charge, a Lunge) cut at an arch's wall and never up a
// ledge's face, and never run at a member on another floor's height.
//
// EG-ZQ (2026-10-12; sections 13.2 and 14): THE SHARES - every lord's health is its fighters' shares (egLordsShare, moved by the
// seam's join: a member the hall did not wake with brings one - the gate's retireShare/restoreShare); the Markynaz's decree
// folded with the circle's (egMarkynazDecree); and Colossal's size on the lord's body and on the wire (`sz`).
// FIELD BUGS 2026-10-19e LORD-SHARES (section 13.2; a breach's company: "Felt like he wasnt being damaged ... It felt like the
// moment team died difficulty went down"): A LORD WAKES FOR THE COMPANY STANDING IN ITS HALL AND KEEPS WHAT THE FALLEN LEAVE -
// stood for the members on its hall's arrival plate (egLordsStand; a latecomer brings its share at the fraction), and from its
// wake no fall takes a share out of it: EG-ZQ retired a fallen member's share at the fall, so a death cost the company
// nothing against a lord and every blow of the living moved its bar the further.
//
// AUDIT EG III (2026-10-13; sections 13.2, 13.3 and 13.4): the Mother of Dusk dragged down once a grounding, by anchors broken;
// the Wyrm aloft again after a landing and its Burning Perches erupting; the Twin Lords' touch minted and said; fury's chain at
// THE CHAINED GAP (net/eliteGates/egShape.js egChainGapMs, Chained Blows' rule); a state's weight never a product; the Breakdown's half
// route; Grath's Gore twice as often alone; Morvayn's shared blow in the seam's judge (egChainShared); the aspects
// (egLordAspect); the gate's rows read from ATTACKS, the Meteor's burning ground with them.
//
// AUDIT EG IV (2026-10-13; sections 8.6, 13.2, 13.3, 13.4 and 18): a fight of two lords falls when BOTH have (Clan Feud's champion,
// the Twin Court, the Old Masters under the Twins' law - egLordsPair); an errand's held threshold strictly above its phase line
// (egHoldHp); a lord asleep takes no blow; a mirror turns no phase and runs no kit; an errand's failure blow lands on the member
// it names (`on`); the Last Lesson's last ring kept; Gore never along a bridge; the Haven Nova's route measured over the whole
// floor; Garoth's borrowed signature his own (its mirrors, no Eclipse, chains of two) and his Clan Muster called at the turn
// holding the next threshold; fury beside a champion; one phase card a fight; the Last Charge's third back as the next falls;
// the Crossing and Burning Perch thrown as lord blows.
//
// The errands' objects (runes, gems, anchors, banners, hearts, seals, braziers, pillars, standards, havens) are bodies
// of role 2: struck ones carry health, stood-on ones a state (`pg` says each errand's progress). Marks on members and
// tethers are the fight's (net/eliteGates/egBodies.js egMark, F.tethers).
//
// Pure: a fight and a beat in, frames out. In the relay bundle. Not a DFU member. Ledger A (ELITE-GATES).
import { PHASE_AT, SHIELD_MS, THREAT_PICK, THREAT_DECAY, HIT_KINDS, STUN_MS, STUN_HIT_X } from '../gate/gateBrain.js';
import { ATTACKS, POOLS } from '../gate/gateBrain.js';   // AUDIT EG III (section 13.4; ONE DFU MEMBER, ONE EXPORT): the gate's Cleave, Slam, Charge and Meteor read, never copied - the Meteor's burning ground with it
import { GATE_ASPECTS, gateAspectOf } from '../gate/gateMods.js';   // AUDIT EG III (sections 13.3 and 13.4): a lord's aspect - Garoth's in turn, an earlier band's lord re-aspected
import { dpsRef, retireShare, restoreShare } from '../gate/gateBrain.js';   // EG-ZQ (section 13.2): a lord's shares - the gate's level claim, its retirement and its return
import { EG_ROLE, EG_FL, EG_GONE, egBodyNew, egWalk, egStop, egPlace, egAim, egGone, egHas, egSetFl, egHpTeam, egBodiesOf, egBodyById, egMark, egUnmark, egMarkOf, egShareX, egCut, egSaid, egObSay, EG_TELL_LEAD_MS, EG_FEINT_AT } from './egBodies.js';   // EG-ZJ: egSaid, egObSay - a body's state kept as said
import { egHitBody, egFightState } from './egBodies.js';   // EG-ZK: the seam's blow (the gate's hand and purse) and the fight's state
import { egFace } from './egBodies.js';   // AUDIT EG V (lane1 #7): a lord's turn said
import { egUnionHeld } from './egBodies.js';   // EG-PERFECT (section 13.2): a lord never commits to a blow THE UNION FLOOR would drop
import { shDisc, shLane, shLaneAt, shCone, shRing, shAll, shOut, egErrandMs, egBlowFrom, egChainGapMs } from './egShape.js';
import { egBlowOf, egInBlow } from './egShape.js';   // EG-PERFECT: a blow weighed before it is chosen (THE AUDIT: and one over the caged)
import { EG_LORDS, EG_DECREES, EG_DECREE_BY_KEY, EG_LAW_UNIT, EG_BANDS, egKeepOnFight, egOnFight, egFightProfile, egBandOfCircle } from './egLaw.js';
import { EG_KIND, egLegionRaise, egWaveKinds, egWaveSize, egFromBehind, egFromFront } from './egLegion.js';
import { egLegionSummon } from './egLegion.js';   // AUDIT EG IV (lane1 #6): a lord's summons held to the room under the legion's cap
import { walkGraph, walkAir } from './egLegion.js';   // EG-ZK (section 11.7): the lords walk the graph and fly about the rock
import { egFightView, egWalkGraph, egRegionAt, egKeepInRegion, egArchCut, egWayOn, EG_LEVEL_M } from './egWalkGraph.js';   // EG-ZK: the fight ground's graph and its regions; a run cut at an arch's wall. EG-ZQ: the way on kept only while walked
import { egByHeight, egFeetY, egBears } from './egWalkGraph.js';   // THE ASCENT - HEIGHT: a lord keeps to its own storey
import { egSameStorey } from './egLegion.js';   // THE ASCENT - HEIGHT: a blow only at a member of its own storey
import { bossSeam } from '../bossSeam.js';   // EG-ZK (section 13.1): the Spire's lords written to the boss seam
import { judgeShapes } from '../bossRef.js';   // EG-ZK: the seam's judge - the Spire's one (EG-H1)
import { SD_ECHO_PAIR_MS } from '../superDungeon/sdRemnant.js';   // AUDIT EG IV (lane1 #32; section 13.3): the Twins' window is the Echoes' law, read

/** Every boss on the wire, by number (`k` of a lord body): the thirteen, then the three champions. */
export const EG_BOSS_KEYS = Object.freeze(['hound', 'spellmaster', 'armsmaster', 'ilthys', 'cairnkeeper', 'twins', 'morvayn', 'dusk', 'stalker', 'seyth', 'colossus', 'wyrm', 'garoth', 'kynreeve', 'kynmarcher', 'markynaz']);
export const egBossNo = (key) => EG_BOSS_KEYS.indexOf(key);
/** A boss's look (its mobile and scale - the client draws it; a champion is the Warden's look at 2.5). */
export function egBossLook(key, pt = 0) {
  if (key === 'kynreeve' || key === 'kynmarcher' || key === 'markynaz') return { mobile: 31, scale: 2.5 };
  if (key === 'twins') return { mobile: pt === 1 ? 25 : 26, scale: 2.6 };
  const L = EG_LORDS[key];
  return L ? { mobile: L.mobile, scale: L.scale } : { mobile: 31, scale: 3 };
}
/** A boss's name (a twin's own, a champion's rank). */
export function egBossName(key, pt = 0) {
  if (key === 'twins') return pt === 1 ? 'Isk of the Frost Clan' : 'Vael of the Fire Clan';
  if (key === 'kynreeve') return 'The Kynreeve';
  if (key === 'kynmarcher') return 'The Kynmarcher';
  if (key === 'markynaz') return 'The Markynaz';
  return EG_LORDS[key]?.name ?? 'The Lord';
}

/** THE LORDS' CLOCK (section 18): `ttkRef(c)` seconds of the company's reference damage per fighter. */
export const EG_TTK_S = 180;
export const EG_TTK_GROWTH = 1.07;
export const EG_TTK_GROWTH_DEEP = 1.03;
export function egTtkRef(c) {
  let t = EG_TTK_S;
  for (let k = 2; k <= c; k++) t *= k <= 20 ? EG_TTK_GROWTH : EG_TTK_GROWTH_DEEP;
  return t;
}
/** The champion's health (section 8.5), a twin's share of a lord's, a mirror's (section 13.4). */
export const EG_PROVE_HP_S = 40;
export const EG_TWIN_SHARE = 0.55;
/** AUDIT EG IV (lane1 #32; section 13.3) - THE TWINS' WINDOW: the Echoes' own (net/superDungeon/sdRemnant.js SD_ECHO_PAIR_MS, 15 s), and the
 *  one court's (*n* <= 2) longer one. */
export const EG_TWIN_ONE_MS = 20_000;
/** AUDIT EG IV (lane1 #2; section 13.2) - AN ERRAND'S HELD THRESHOLD: the least health a lord of max `max` keeps while an errand
 *  holds the threshold `at` (a fraction) - STRICTLY above its line, so a lord held there never reads as past it (`Math.round`
 *  rounding down left a lord under the line: the Spellmaster turned his third phase inside the Examination and stood at its
 *  floor for ever) - as the phase's own test reads it (health / max over the line), whatever the float. A fall's threshold (`at`
 *  0) holds one point. */
export function egHoldHp(max, at) {
  let h = Math.floor(max * at) + 1;
  while (h / max <= at) h++;
  return h;
}
/** AUDIT EG III - FIRE-TOUCHED AND FROST-TOUCHED (section 13.3, the Twin Lords): the marks a twin's blow leaves on a member
 *  (net/eliteGates/egBodies.js egMarksOut's 2 and 3 - Vael's, Isk's), how long from its landing, and the weight each lends (+25% dealt to
 *  the other twin here, egLordHitX; +25% taken from the marking twin on the struck screen). */
export const EG_MARK_FIRE = 2;
export const EG_MARK_FROST = 3;
export const EG_TOUCH_MS = 12_000;
export const EG_TOUCH_X = 1.25;
/** FURY (section 13.2): when it comes (x ttkRef), how often it steps, what each step adds to a share. */
export const EG_FURY_RATIO = 1.5;
export const EG_FURY_EVERY_MS = 30_000;
export const EG_FURY_STEP = 0.1;
/** THE COVENANT'S WEIGHT (section 18). */
export const EG_WEIGHT_EVERY_MS = 30_000;
export const EG_WEIGHT_WU_MS = 3000;
export const EG_WEIGHT_PCT = 0.3;
/** A lord's breath after a blow's recovery, and its first after it wakes (ms). */
export const EG_LORD_BREATH_MS = 700;
export const EG_LORD_WAKE_MS = 2500;
/** EG-PERFECT (section 13.2): how many blows a lord weighs before it walks instead, when THE UNION FLOOR would drop each it drew. */
export const EG_CHOOSE_TRIES = 3;
/** EG-PERFECT's audit: how long a lord lets be a member every blow it drew for would have held (ms - past a target's 4 s keep). */
export const EG_SHUN_MS = 6000;
/** EG-PERFECT: a run's time down its lane where its row names none (ms - the Lunges'), and the fastest a run is carried (m/s - the
 *  wire's walks stop at 30: net/wire.js `emv`). */
export const EG_RUN_MS = 400;
export const EG_RUN_V_MAX = 28;
/** EG-PERFECT (the lords' audit, the Spellmaster's "the Lattice is trivial: the 4 m gaps at 0 and +-8 m are never struck") - THE
 *  ARCANE LATTICE A SWEEP: its strips' width (m - THE WIDTH RULE's lane) side by side across his whole floor, each landing
 *  EG_LATTICE_STEP_MS after the last, from the side farthest from its mark across it: the strip safe is the one just burned, and
 *  it moves. THE FINAL EXAMINATION AGAIN: from his third phase the cage closes again EG_CAGE_AGAIN_MS after the last resolved
 *  (it closed once a fight). */
export const EG_LATTICE_W = 4;
export const EG_LATTICE_STEP_MS = 1400;
export const EG_CAGE_AGAIN_MS = 40_000;
/** EG-PERFECT (section 13.4, the Conquest): a banner planted every this long until the round's three stand (ms), each third
 *  told this long before it burns (ms - THE AUDIT: the longest way off a third where its neighbour already burns, the court's
 *  whole 24 m radius, at the escape build plus EG_REACT_S: 3.94 s; 3.5 s covered a lone third's 20.8 m alone). */
export const EG_CONQUEST_EVERY_MS = 8000;
export const EG_CONQUEST_TELL_MS = 4000;
/** EG-PERFECT: the next Conquest after a round's last banner falls (ms), and how long two banners hold her ward at most (ms). */
export const EG_CONQUEST_AGAIN_MS = 45_000;
export const EG_BANNER_WARD_MS = 25_000;
/** The gate's blows the Valkynaz and the champions keep (net/gate/gateBrain.js ATTACKS, at their phase-one wind-ups), as kit rows.
 *  AUDIT EG III (ONE DFU MEMBER, ONE EXPORT): read from the gate's own rows, never copied - its name, wind-up, recovery, share,
 *  base, reach, gap and weight; `ak` its key, which names it under an aspect (net/gate/gateMods.js GATE_ASPECTS `names` - the
 *  Meteor's), and `pool` the burning ground its landing leaves (net/gate/gateBrain.js POOLS - the Meteor's). */
const gateRow = (A) => Object.freeze({ nm: A.name, ak: A.key, wu: A.windup, rec: A.recover, p: A.pct, b: A.base, range: A.range, minGap: A.minGap, w: A.w, ...(A.pool ? { pool: A.pool } : {}) });
const CLEAVE = gateRow(ATTACKS.cleave), SLAM = gateRow(ATTACKS.slam), CHARGE = gateRow(ATTACKS.charge), METEOR = gateRow(ATTACKS.meteor);
const HELLFIRE = gateRow(ATTACKS.hellfire);   // AUDIT EG IV (lane1 #16): the Mother of Dusk's, read - its pool (POOLS.hellfire) the Meteor's way
/** A lord's body radius at its scale (the Warden's 1.8 at 3). */
const bodyR = (scale) => Math.max(0.8, (1.8 * scale) / 3);
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const r2 = (v) => Math.round(v * 100) / 100;

// ── the lords' decrees, as laws (section 14) ─────────────────────────────────────────────────────────────
/**
 * THE LORDS' LAW under the decrees in force (`D` the fight's ranks, `{ key: rank }` - net/eliteGates/egRun.js egDecreeRanks; a word
 * that is no decree, the Wellhead's `feud`, is none): EG5, the fight's profile (net/eliteGates/egLaw.js egFightProfile - the four
 * boss-general trials recast as X-keyed laws and folded), where the gate's own targeting stands for a threat no decree
 * names (THREAT_PICK, THREAT_DECAY). Fresh each call: the fight keeps its own (`F.mem.law`).
 */
export function egLordLaw(D = {}) {
  const dc = [];
  for (const [k, rank] of Object.entries(D ?? {})) { const d = EG_DECREE_BY_KEY[k]; if (d && rank > 0) dc.push([d.id, rank >= 2 ? 2 : 1]); }
  const L = egFightProfile(dc).law;
  return { ...L, threatPick: L.threatPick ?? THREAT_PICK, threatDecay: L.threatDecay ?? THREAT_DECAY };
}
/** The lord family's decrees in their order (section 14 - net/eliteGates/egLaw.js EG_DECREES, never a second list). */
const LORD_DECREES = Object.freeze(EG_DECREES.filter((d) => d.fam === 'lord').map((d) => d.key));
/**
 * EG-ZQ (sections 8.5 and 14) - THE GRAND DUKE'S DECREE: the lord-family decree a Markynaz lays on his own fight in hall `h`,
 * to fold with the decrees the fight already bears (`D`, its ranks): the family's four in their order from the hall's own,
 * the first the fight does not bear - one decree is never borne twice (net/eliteGates/egLaw.js validEgDecrees), and his card names one
 * the company does not already face. None when the fight bears all four.
 * @param {any} D @param {number} h
 * @returns {string|null}
 */
export function egMarkynazDecree(D, h) {
  for (let k = 0; k < LORD_DECREES.length; k++) { const key = LORD_DECREES[(h + k) % LORD_DECREES.length]; if (!(D?.[key] > 0)) return key; }
  return null;
}

// ── the aspects (sections 13.3 and 13.4) ─────────────────────────────────────────────────────────────────
/**
 * AUDIT EG III - A LORD'S ASPECT at circle `c` (net/gate/gateMods.js GATE_ASPECTS, "a lord's element" - section 6's words): a
 * Valkynaz's its band's (Ilthys Burning, Morvayn Venom-Blooded, Seyth Rime-Wrought) and Garoth's EACH OF THE FOUR IN TURN, from
 * one Garoth Redoubt to the next (Redoubt 20 Burning, 25 Rime-Wrought, 30 Storm-Crowned, 35 Venom-Blooded, 40 Burning...); a
 * Court lord drawn in a later band than its own RE-ASPECTED, to the band it is met in (section 13.3's pool). None for a lord met
 * in its own band, the Twin Lords (their elements are their clans', the Fire and the Frost) or a champion: null, the lord keeps
 * its own elements.
 * @param {string} key @param {number} c
 */
export function egLordAspect(key, c) {
  const L = EG_LORDS[key];
  if (!L || key === 'twins') return null;
  if (key === 'garoth') return GATE_ASPECTS[Math.max(0, Math.floor(c / 5) - 4) % GATE_ASPECTS.length];
  const band = L.valk ? L.band : egBandOfCircle(c);
  return L.valk || L.band < band ? gateAspectOf(EG_BANDS[band].aspect) : null;
}
/** AUDIT EG III: an element a lord's kit throws or lays, under its aspect: every element its aspect's - the gate's law ("his
 *  fire is his aspect's": net/gate/gateBrain.js fightProfile) for a lord whose kit holds more than fire. The place's own fire
 *  (Grath's burning bridges) is the place's, and keeps it. AUDIT EG V (lane1 #2; section 13.3): the aspect is the THROWING
 *  lord's own (`L.asp`, egLordsNew - its mirrors and images bear their lord's), never the fight's: a stratum's second lord
 *  re-aspected to the Wellhead leaves the Court's own lord its element, and the Twin Lords keep their clans' fire and frost. */
const elOf = (L, el) => (el != null && L?.asp ? gateAspectOf(L.asp)?.el ?? el : el);

// ── the shares (section 13.2) ────────────────────────────────────────────────────────────────────────────
/**
 * A LORD'S FIGHTERS: each member's share of its health (`{ share, retired }`, the gate's own record - net/gate/gateBrain.js
 * retireShare/restoreShare move it), kept on the lord (`fs`) from the first share it moves - the company the hall woke
 * with (`F.subs`, at `F.lvs`), each `per` x its reference damage (`dpsRef`), `per` the lord's health per unit of the
 * company's reference damage as it was stood (ttkRef, a champion's EG_PROVE_HP_S x the depth, Colossal, a twin's part,
 * a stratum's 0.6), so its shares sum to its health.
 */
function sharesOf(F, L) {
  if (L.fs) return L.fs;
  L.per = L.max / Math.max(1, F.team);
  L.fs = {};
  (F.subs ?? []).forEach((s, j) => { L.fs[s] = { share: L.per * dpsRef(F.lvs[j]), retired: false }; });
  return L.fs;
}
/**
 * EG-ZQ (2026-10-12; section 13.2, THE LAW EVERY LORD KEEPS; EG-ZK's departure 1) - A MEMBER'S SHARE OF THE LORDS, as the boss
 * seam's `join` moves it: while the director admits `sub` (living, in the breach and its hall) its share stands in every
 * lord's health. So -
 *   a member the hall did not wake with, or one its lords were stood without (egLordsStand), brings `per` x its reference
 *     damage to each lord, at the fraction the lord stands at (the gate's law for a newcomer: a late arrival never heals a
 *     lord) - a share brought as a retired one restored;
 *   FIELD BUGS 2026-10-19e LORD-SHARES: refused (fallen), its share STAYS in every lord awake - the living finish what the
 *     fallen left, so a death makes a fight harder for the company, never easier (the Remnant keeps a fallen body's share
 *     too: net/superDungeon/sdRemnant.js) - and leaves a lord still asleep in its ring (retireShare, at the fraction it
 *     stands at), which wakes for the company standing before it; a recall's share comes back with it (restoreShare);
 *   the last share in a lord is never retired: a lord sized for nobody would stand at nought (and fall as nought), and the
 *     company's wipe ends the breach first.
 * A mirror or an image carries no share (its health its own). A share moved keeps an errand's held threshold at its fraction
 * and says the whole fight at the beat's end (`F.stateAt`), so every bar's health and its max move together. Answers
 * whether any share moved.
 * @param {any} F @param {string} sub @param {number} lv @param {boolean} admits
 */
export function egLordsShare(F, sub, lv, admits) {
  let moved = false;
  for (const L of F.bodies) {
    if (L.role !== EG_ROLE.lord || egHas(L, EG_FL.mirror)) continue;
    const fs = sharesOf(F, L), max0 = L.max;
    let p = fs[sub];
    if (admits && !p) p = fs[sub] = { share: L.per * dpsRef(lv), retired: true };
    if (admits) restoreShare(L, p);
    else if (p && !L.up2 && Object.values(fs).some((q) => q !== p && !q.retired)) retireShare(L, p);
    if (L.max === max0) continue;
    moved = true;
    if (L.hpFloor != null) L.hpFloor = egHoldHp(L.max, L.hold ?? L.hpFloor / max0);   // AUDIT EG IV (lane1 #2): the held line at the new max, still strictly above it
  }
  if (moved) F.stateAt = 0;
  return moved;
}
/**
 * FIELD BUGS 2026-10-19e LORD-SHARES (section 13.2) - THE LORDS STAND FOR THE COMPANY ON THEIR HALL'S PLATE: as a hall's fight
 * is stood (net/eliteGates/egBrain.js standFight, once every lord of it stands at its health), the share of every member not on
 * its arrival plate (`here`, the members' accounts - one still on the stair, its socket closed) leaves each lord whole, never its
 * last; each comes in at the fraction the lord stands at when the director first sees its member in the hall (egLordsShare).
 * The hall's fight is sized by its whole living company, so a lord stood for an absent member held its share until its absence
 * became a fall, 180 s on. Sized in the beat the hall wakes, whose whole fight (`efs`) every screen hears before any health
 * word, never shrunk later: a health word that fell would read as a blow (net/eliteGates/egLink.js foldFight - `ehp` carries no
 * whole). No lord stands with an errand's held line or a mirror yet: those come with its phases.
 * @param {any} F @param {string[]} here
 */
export function egLordsStand(F, here) {
  const on = new Set(here);
  for (const L of egLordsOf(F)) {
    const fs = sharesOf(F, L);
    for (const [s, p] of Object.entries(fs)) if (!p.retired && !on.has(s) && Object.values(fs).some((q) => q !== p && !q.retired)) retireShare(L, p);
  }
}

// ── the engine ───────────────────────────────────────────────────────────────────────────────────────────
/** A lord body stood (asleep until its hall wakes it). EG-ZQ (section 14, Colossal; EG5's departure 3): at the fight's law's
 *  size (`sizeX` - its mirrors and images with it), its body's radius and its size on the wire (`sz`, thousandths of its look's
 *  - 0 its look's own; net/eliteGates/egBodies.js egBodyWire), so every screen draws, aims at and strikes it there. */
function stand(F, spec, key, x, z, hp, now, out, o = {}) {
  const look = egBossLook(key, o.pt ?? 0), size = (F.mem.law ?? egLordLaw()).sizeX;
  return egBodyNew(F, EG_ROLE.lord, egBossNo(key), x, z, hp, { pt: o.pt ?? 0, r: bodyR(look.scale * size), sz: size === 1 ? 0 : Math.round(size * EG_LAW_UNIT), fl: o.fl ?? 0, now, out, key, ph: 1, up2: false, nextAt: Infinity, threat: {}, ward: 0, stunUntil: 0, yaw: Math.PI, lastBlow: '', run: 0, cds: {}, ...o.extra, ...(Number.isFinite(o.y) ? { y: o.y } : {}) });
}
/** The lord bodies of the fight (the living). */
export const egLordsOf = (F) => egBodiesOf(F, EG_ROLE.lord);
/** AUDIT EG V (lane1 #29; section 18, THE OLD MASTERS): the living mirrors and images of lord `L` - its own (`by`), never another
 *  lord's: Garoth's Mirrorcourt beside the Spellmaster's Mirror Images, each counts and tops up its own. */
const mirrorsOf = (F, L) => egLordsOf(F).filter((x) => egHas(x, EG_FL.mirror) && x.by === L.i);
/** The fight's errand objects (role 2) of a type. */
export const egObjsOf = (F, t) => egBodiesOf(F, EG_ROLE.obj).filter((o) => o.t === t);
/** An object stood: its type, place, health (0 a stood-on one - it carries 1 and is never struck), radius. THE ASCENT
 *  (Elite-Gates-Ascent.md section 2): at the floor's height `o.y` where the caller names it (a spot kept on a storey). */
function obj(F, t, x, z, hp, now, out, o = {}) {
  return egBodyNew(F, EG_ROLE.obj, EG_OBJ[t] ?? 0, x, z, hp > 0 ? hp : 1, { t, r: o.r ?? 1.2, fl: hp > 0 ? 0 : EG_FL.ward, pt: o.pt ?? 0, now, out, st: 0, ...o.extra, ...(Number.isFinite(o.y) ? { y: o.y } : {}) });
}
/** THE ASCENT (section 2): a law spot's floor height (its `y`, the law's centimetres) where hall `spec` judges by height; else
 *  not known (NaN - a body stood there stands on the fight ground under it, as before). */
const spotY = (spec, q) => (egByHeight(spec) && Number.isFinite(q?.y) ? q.y / 100 : NaN);
/** THE OBJECTS' TYPES on the wire (`k` of an object body). */
export const EG_OBJ = Object.freeze({ rift: 0, anchor: 1, rune: 2, gem: 3, haven: 4, brazier: 5, banner: 6, heart: 7, seal: 8, pillar: 9, standard: 10, chain: 11, relic: 12, isle: 13, spark: 14, plate: 15, cache: 16, niche: 17, shrine: 18, sutler: 19, engine: 20, image: 21, umbra: 22, memento: 23, vault: 24, stone: 25, fwall: 26 });   // LAYER THREE: `fwall` an alcove's false wall (one blow)

/** Whom a lord goes at: THREAT_PICK of the time its top of threat, else a living member at random. */
function pickTarget(L, here, rng, law) {
  if (!here.length) return null;
  let top = null, t = 0;
  for (const m of here) { const v = L.threat[m.sub] ?? 0; if (v > t) { t = v; top = m; } }
  if (top && rng() < law.threatPick) return top;
  return here[Math.floor(rng() * here.length)];
}
/** The region of the walk graph `G` a point stands in (net/eliteGates/egWalkGraph.js egRegionAt - `hint` the body's own when it holds it). */
const regionOf = (view, G, x, z, y = NaN, hint = -1) => /** @type {number} */ (egRegionAt(view, G, x, z, y, Number.isInteger(hint) ? hint : -1)[0]);
/**
 * EG-ZK (section 11.7; EG-ZB's departure 2 closed): A LORD'S WALK to (gx, gz), `stop` short, at `speed` (`gy` the goal's
 * height when known - a member's feet). Within the region of the fight ground it stands in (net/eliteGates/egWalkGraph.js - a disc, a
 * lane, an arch's half), straight as a lord always walked (net/eliteGates/egBodies.js egWalk: stopped short, then kept its body's
 * radius on the floor); to a goal past it - an island across a bridge, a floor up its stair, the far side of an arch's
 * wall - over the hall's walk graph as the legion walks it (net/eliteGates/egLegion.js walkGraph): through the arch's gap, up the stair,
 * along the bridge, never through a wall and never over the void. EG-ZJ (section 23): its feet as a legion walker's - a
 * straight walk ending on the ground there (egWalk), a graph walk climbing its stair (walkGraph), a node it reached its
 * region's floor (net/eliteGates/egWalkGraph.js egWayOn).
 */
function lordWalk(F, spec, L, gx, gz, stop, speed, now, gy = NaN) {
  const view = egFightView(spec);
  if (!view?.fl?.length) { egWalk(F, L, gx, gz, stop, speed, now, spec, L.r); return; }
  const G = egWalkGraph(view);
  // the node a graph walk headed to is a way on only while the lord still walks to it: a blow's stop, a run's end, a leap, a
  // blink or a straight walk since leaves none; one it stands at is reached - its region the lord's now (a stair's top, its
  // upper floor's), its feet on that floor. EG-ZQ: the graph's own rule (net/eliteGates/egWalkGraph.js egWayOn), the legion's too
  egWayOn(view, L, G);
  const from = regionOf(view, G, L.x, L.z, egFeetY(view, L.y), L.fr), to = regionOf(view, G, gx, gz, Number.isFinite(gy) ? gy : egFeetY(view, L.y));   // THE ASCENT: by its own feet
  if (from === to) { egWalk(F, L, gx, gz, stop, speed, now, spec, L.r); return; }
  walkGraph(F, view, L, gx, gz, stop, speed, now, gy);
}
/** EG-ZK (section 11.7): do lord `L` and member `m` (its feet's height `y` when known) stand on floors of one height? */
function oneLevel(view, L, m) {
  if (!view?.fl?.length) return true;
  const G = egWalkGraph(view), a = regionOf(view, G, L.x, L.z, egFeetY(view, L.y), L.fr), b = regionOf(view, G, m.x, m.z, m.y);
  return Math.abs((view.fl[G.rg[a].f].y ?? 0) - (view.fl[G.rg[b].f].y ?? 0)) <= EG_LEVEL_M;
}
/** EG-ZK (section 11.7): a lord's RUN (a row's `run` - the champions' Charge, the Armsmaster's Lunge, the Night-Stalker's) to
 *  `to`: one that meets an arch's wall ends at it, its body clear of the wall - the Breaker's law (net/eliteGates/egLegion.js,
 *  net/eliteGates/egWalkGraph.js egArchCut) - and none runs up or down a ledge's face: a run that would end on a floor of another height
 *  ends on the region it began in. A leap or a blink is no run. */
function runTo(view, L, to) {
  const cut = egArchCut(view, L.x, L.z, to[0], to[1], L.y);
  let end = cut ? [cut[0], cut[1] - Math.sign(to[1] - L.z) * (L.r + 0.4)] : to;
  if (!view?.fl?.length) return end;
  const H = egFeetY(view, L.y), G = egWalkGraph(view), from = regionOf(view, G, L.x, L.z, H, L.fr), at = regionOf(view, G, end[0], end[1], H, from);   // THE ASCENT: by its own feet
  if (Math.abs((view.fl[G.rg[at].f].y ?? 0) - (view.fl[G.rg[from].f].y ?? 0)) > EG_LEVEL_M) end = egKeepInRegion(view, G, from, end[0], end[1], L.r);
  return end;
}
const nearest = (x, z, here) => { let best = null, bd = Infinity; for (const m of here) { const d = dist(x, z, m.x, m.z); if (d < bd) { bd = d; best = m; } } return best; };

/**
 * A LORD'S BLOW: its stamps (made from the lord, its target and the hall), its wind-up (floored), its share by the depth,
 * fury and Vengeful (within EG_SHARE_X_MAX), Colossal's radii. `o.ch` a CHECK (fixed); `o.feint` cut at FEINT_AT. AUDIT EG
 * III: its element its aspect's (elOf) and a gate's blow named by the aspect (the Meteor's: GATE_ASPECTS `names`); a blow that
 * leaves burning ground (`B.pool` - the gate's Meteor, POOLS') has it laid as it lands (`F.mem.pools`, egLordsStep), at
 * Vengeful's weight as the gate's ground.
 */
/** Colossal's radii on a blow's stamps (never a CHECK's - fixed). */
const scaleStamps = (law, stamps, ch) => stamps.map((s) => (law.radiusX === 1 || ch ? s : s[0] === 'd' ? shDisc(s[1], s[2], s[3] * law.radiusX) : s[0] === 'c' ? shCone(s[1], s[2], s[3], s[4] * law.radiusX, s[5]) : s[0] === 'l' ? shLane(s[1], s[2], s[3], s[4], s[5] * law.radiusX) : s));
function lordBlow(F, spec, L, stamps, B, here, now, out, o = {}) {
  const law = F.mem.law ?? egLordLaw();
  const p = o.ch ? B.p : B.p * egShareX(F.c, (L.champ ? 1 : F.mem.furyX ?? 1) * law.dmgX * (L.shareX ?? 1));   // AUDIT EG IV (lane1 #20): a champion beside a lord in fury keeps its own shares
  const at = now + (o.delay ?? 0) + B.wu;
  const nm = (B.ak && L.asp && gateAspectOf(L.asp)?.names?.[B.ak]) || B.nm;   // AUDIT EG V (lane1 #2): named by its own lord's aspect
  // EG-H1 (section 15): every lord's chosen blow COMMITTED EG_TELL_LEAD_MS before its wind-up begins (net/eliteGates/egBodies.js egAim's
  // `lead` - told early to a Watchfire holder's company meanwhile); a CHECK keeps its fixed time
  // EG-PERFECT: a PLACE blow (`o.place` - the Wyrm's Burning Perch, its own pillar erupting under it) is thrown as the place's
  // fire is (a Burning Bridge): aimed at no one, said at once and never held - its wind-up the floor's of its shape, its ground
  // left by a stair the union floor's cells never hold (a perch's top is all of it)
  const flat = o.ch || o.place;
  const blow = egAim(F, spec, { o: L.i, s: scaleStamps(law, stamps, o.ch), at, wu: B.wu + (o.delay ?? 0), p, b: B.b, el: elOf(L, B.el === undefined ? null : B.el), nm, ch: o.ch ? 1 : 0, pu: B.pu ?? 0, sp: B.sp ?? 0 }, flat ? [] : here, now, out, flat ? 0 : EG_TELL_LEAD_MS);
  if (blow && o.feint) (F.mem.feints ??= []).push([blow.i]);   // EG-H1: cut at FEINT_AT of its OWN wind-up, however late its word went
  if (blow && B.pool) (F.mem.pools ??= {})[blow.i] = [B.pool.r, B.pool.ms, B.pool.pct * law.dmgX, B.pool.base * law.dmgX];
  return blow;
}
/**
 * EG-PERFECT (section 13.2; the audit's "small fight floors cancel big blows") - WOULD THE UNION FLOOR DROP IT: lord `L`'s blow of
 * `stamps` (row `B`, `delay` its extra wait), committed now, weighed as its word would be (net/eliteGates/egBodies.js egUnionHeld) -
 * so a lord never chooses a blow it would only be held from and dropped, spending its turn on nothing (Ilthys threw eight Meteors
 * at a member on a balcony and every one was dropped, 3.5 s each). Pure.
 */
function wouldHold(F, spec, L, stamps, B, here, now, delay = 0) {
  const law = F.mem.law ?? egLordLaw();
  const blow = egBlowOf({ i: 0, o: L.i, s: scaleStamps(law, stamps, false), at: 0, wu: B.wu + delay, p: 0, nm: B.nm, sp: B.sp ?? 0 });
  blow.at = now + EG_TELL_LEAD_MS + blow.wu;
  if (egByHeight(spec) && Number.isFinite(L.y)) blow.y = r2(L.y);
  // (THE AUDIT: and the ground its pool leaves burning, as the union floor will weigh it said - its number 0 for the weigh, which
  // no blow takes)
  const pools = (F.mem.pools ??= {}), had = pools[0];
  if (B.pool) pools[0] = [B.pool.r, B.pool.ms, 0, 0];
  try { return egUnionHeld(F, spec, blow, here, now); } finally { if (had === undefined) delete pools[0]; else pools[0] = had; }
}
/** EG-PERFECT (section 13.2's targeting; the audit: Moonshatter, Hellfire and the Wyrm's Meteor took `here`'s first, the company's
 *  join order, so its later members were never their marks): `k` members for a blow of several marks - the chosen target first
 *  (THREAT_PICK's own choice), the rest drawn at random. */
function pickSome(t, here, k, rng) {
  const rest = here.filter((m) => m.sub !== t?.sub);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return [...(t ? [t] : []), ...rest].slice(0, k);
}
/** EG-PERFECT (bug 7): a kit sets its lord down (a duel's ring, a rising, a grounding, a perch, the Crossing) - the run it was in
 *  the middle of never carries it off again afterwards (its `to` dropped). */
function kitPlace(F, L, x, z, now) { if (L.atk) L.atk.to = null; egPlace(F, L, x, z, now); }
/** EG-PERFECT (section 13.3, "a ring of fire rises around the two"): a place held inside a duel's ring (`ring` `{ x, z, r }`), a
 *  body of radius `r` clear of its fire. */
function inRing(p, ring, r) {
  const dx = p[0] - ring.x, dz = p[1] - ring.z, d = Math.hypot(dx, dz), R = Math.max(0, ring.r - r - 0.2);
  return d <= R || d < 1e-6 ? p : [r2(ring.x + (dx / d) * R), r2(ring.z + (dz / d) * R)];
}
/** A chained second shape under fury (from its second step): the same stamps, landing THE CHAINED GAP after the first -
 *  max(wind-up, floor + 0.3 s, 1 s) (AUDIT EG III: net/eliteGates/egShape.js egChainGapMs, Chained Blows' own rule). AUDIT EG V (lane1 #18;
 *  section 13.2): its dim outline from the first's word (`ol`), its FILL from the first's landing for the gap (`wu`) - the
 *  page's "its fill starts when the first lands", never a fill crawling from the first's word. */
function furyChain(F, spec, L, blow, here, now, out) {
  if (!blow || (F.mem.furySteps ?? 0) < 2 || blow.ch || L.champ) return;
  const gap = egChainGapMs(blow.wu, blow.s);
  // EG-H1: committed with the first and said with it (its landing the first's plus the gap - the lead already in it)
  const c = egAim(F, spec, { o: L.i, s: blow.s, at: blow.at + gap - EG_TELL_LEAD_MS, wu: gap, ol: blow.at - now - EG_TELL_LEAD_MS, p: blow.p, b: blow.b, el: blow.el, nm: `${blow.nm} (fury)`, pu: blow.pu, sp: blow.sp }, here, now, out, EG_TELL_LEAD_MS);
  if (c) c.after = blow.i;   // EG-PERFECT: said only with its first (net/eliteGates/egBodies.js egSay)
}
/** A lord's ward raised for `ms` (Unyielding's law - longer). */
function ward(F, L, ms, now, out) { const law = F.mem.law ?? egLordLaw(); L.ward = Math.max(L.ward, now + ms * law.shieldX); egSetFl(F, L, EG_FL.ward, true, out); }
/** A lord stunned (the crystals' law: STUN_MS on its knees, every blow STUN_HIT_X heavier). */
export function egStun(F, L, ms, now, out) { L.stunUntil = Math.max(L.stunUntil, now + ms); L.atk = null; egStop(F, L, now); egSetFl(F, L, EG_FL.stun, true, out); out.push({ k: 'esay', w: 'stunned', n: egBossName(L.key, L.pt) }); }
const say = (out, w, extra = {}) => out.push({ k: 'esay', w, ...extra });
/** AUDIT EG IV (lane1 #9): the grid THE HAVEN NOVA's route is measured on (m). */
export const EG_HAVEN_GRID_M = 0.5;
/**
 * AUDIT EG IV (lane1 #9; section 13.3, THE ERRAND FLOOR) - THE HAVEN NOVA'S ROUTE: the farthest any point of the court's disc
 * (`f` - its heart, `r`) stands from the nearest haven's edge (`havens` `[[x, z, r], ...]`), measured over the WHOLE disc - its
 * rim every 2 degrees and a grid of EG_HAVEN_GRID_M inside it, the heart among the grid's points - plus the grid's half diagonal: a route grows at most a
 * metre a metre, so no point between the samples lies farther, and the measure is never under the truth (the old sample of
 * twelve bearings at three radii missed the heart - 10 m from four havens - and gave it 2.42 s for its 2.94).
 * @param {number[][]} havens @param {{x: number, z: number, r: number}} f
 */
export function egHavenRouteM(havens, f) {
  const far = (x, z) => { let best = Infinity; for (const h of havens) best = Math.min(best, Math.max(0, dist(x, z, h[0], h[1]) - h[2])); return best; };
  let worst = 0;
  for (let a = 0; a < 360; a += 2) worst = Math.max(worst, far(f.x + Math.sin((a * Math.PI) / 180) * f.r, f.z + Math.cos((a * Math.PI) / 180) * f.r));
  const g = EG_HAVEN_GRID_M, k = Math.floor(f.r / g);
  for (let i = -k; i <= k; i++) for (let j = -k; j <= k; j++) if ((i * g) ** 2 + (j * g) ** 2 <= f.r * f.r) worst = Math.max(worst, far(f.x + i * g, f.z + j * g));
  return worst + g / Math.SQRT2;
}
/** A haven blow's wind-up: the errand floor over the longest route to the nearest haven (section 13.3). */
const havenWu = (havens, f) => egErrandMs(egHavenRouteM(havens, f));
/** AUDIT EG V (lane1 #26): the most havens one Haven Nova lays (its stamp's own bound - net/eliteGates/egShape.js egStampOk). */
export const EG_HAVENS_MAX = 8;
/**
 * AUDIT EG V (lane1 #26; sections 13.2, THE ERRAND FLOOR, and 18, THE OLD MASTERS) - THE HAVEN NOVA ON A FLOOR OF MANY PIECES:
 * the Last Spellmaster stood beside a lord on that lord's ground (Grath's islands and bridges, the Twins' courts and walkway,
 * the Colossus's forge, the Wyrm's cavern) lays his havens over the WHOLE fight floor and measures the CHECK's route over it,
 * never over its first disc alone. The route is WALKED: a grid of EG_HAVEN_GRID_M over every piece of the floor (`spec.fl`,
 * egOnFight), its distances spread from the havens' discs over floor cells alone (eight neighbours, a diagonal x√2 - never
 * under the straight walk, never across the magma), plus the grid's half diagonal. From the havens a single court would lay
 * (`base`), a haven is added at the floor's farthest cell (kept 3 m on its floor) while the route stands past the route those
 * havens give on one court of the main disc's size (`aim`) and fewer than EG_HAVENS_MAX stand - so a company spread over
 * another's ground meets the Nova as a company on the master's own court does, and the wind-up is the errand floor of the
 * route measured, whatever it is. Pure. `{ havens: [[x, z, r]...], routeM }`.
 * @param {any} spec @param {number[][]} base @param {number} aim
 */
export function egHavenFloor(spec, base, aim, y = NaN) {
  const havens = base.map((h) => [...h]), G = floorWalker(spec, y);
  if (!G) return { havens, routeM: 0 };
  const g = G.g;
  for (const [hx, hz, hr] of havens) G.spread(hx, hz, hr);
  let [far, worst] = G.farthest();
  while (worst + g / Math.SQRT2 > aim && havens.length < EG_HAVENS_MAX && far >= 0) {
    const [hx, hz] = egKeepOnFight(spec, G.x0 + (far % G.W) * g, G.z0 + Math.floor(far / G.W) * g, 3, y), h = [r2(hx), r2(hz), 3];
    havens.push(h); G.spread(h[0], h[1], h[2]);
    [far, worst] = G.farthest();
  }
  return { havens, routeM: worst + g / Math.SQRT2 };
}
/**
 * THE FLOOR WALKED (AUDIT EG V lane1 #26's grid - h: one walker for the Haven Nova and the Examination): a grid of
 * EG_HAVEN_GRID_M over every piece of hall `spec`'s fight floor (`spec.fl`, egOnFight), and each floor cell's walked distance
 * from the discs `spread` was given - lowered where a disc is nearer (Dijkstra over the floor cells, eight neighbours, a
 * diagonal x√2: never under the straight walk, never across the magma); `farthest()` the floor cell farthest from them
 * `[cell, m]`, `at(x, z)` a point's (its nearest floor cell's), `clear()` every distance forgotten. Null on a floor of no
 * pieces. Pure. THE ASCENT (Elite-Gates-Ascent.md section 2): `y` the storey's feet - in a hall that judges by height, the floor
 * that bears them alone (egOnFight's band: a haven never laid, nor a route walked, on a floor stacked over or under it).
 * @param {any} spec @param {number} [y]
 */
function floorWalker(spec, y = NaN) {
  const g = EG_HAVEN_GRID_M, fl = spec?.fl ?? [];
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  const box = (x, z, r) => { x0 = Math.min(x0, x - r); z0 = Math.min(z0, z - r); x1 = Math.max(x1, x + r); z1 = Math.max(z1, z + r); };
  for (const f of fl) { if (f.t === 'd') box(f.x, f.z, f.r); else if (f.t === 'l') { box(f.ax, f.az, f.hw); box(f.bx, f.bz, f.hw); } else for (const [px, pz] of f.poly ?? []) box(px, pz, 0); }
  if (!Number.isFinite(x0)) return null;
  const W = Math.floor((x1 - x0) / g) + 1, H = Math.floor((z1 - z0) / g) + 1, N = W * H;
  const floor = new Uint8Array(N), D = new Float64Array(N).fill(Infinity);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (egOnFight(spec, x0 + i * g, z0 + j * g, 0, y)) floor[j * W + i] = 1;
  // the walked distances from one disc, lowered where it is nearer (Dijkstra over the floor cells; a binary heap)
  const spread = (hx, hz, hr) => {
    const heap = [], push = (d, c) => { heap.push([d, c]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length && last) { heap[0] = last; let k = 0; for (;;) { const a = 2 * k + 1, b = a + 1; let m = k; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    for (let c = 0; c < N; c++) if (floor[c] && dist(x0 + (c % W) * g, z0 + Math.floor(c / W) * g, hx, hz) <= hr && D[c] > 0) { D[c] = 0; push(0, c); }
    while (heap.length) {
      const [d, c] = pop();
      if (d > D[c]) continue;
      const ci = c % W, cj = Math.floor(c / W);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const i = ci + di, j = cj + dj;
        if ((!di && !dj) || i < 0 || j < 0 || i >= W || j >= H) continue;
        const q = j * W + i, nd = d + (di && dj ? g * Math.SQRT2 : g);
        if (floor[q] && nd < D[q]) { D[q] = nd; push(nd, q); }
      }
    }
  };
  const farthest = () => { let best = -1, bd = -1; for (let c = 0; c < N; c++) if (floor[c] && Number.isFinite(D[c]) && D[c] > bd) { bd = D[c]; best = c; } return [best, Math.max(0, bd)]; };
  // a point's walked distance: its nearest floor cell's, the step to it added (a ring of cells about it, a metre out at most)
  const at = (x, z) => {
    const ci = Math.round((x - x0) / g), cj = Math.round((z - z0) / g);
    let best = Infinity;
    for (let r = 0; r <= 2 && !Number.isFinite(best); r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = ci + di, j = cj + dj;
      if (i >= 0 && j >= 0 && i < W && j < H && floor[j * W + i]) best = Math.min(best, D[j * W + i] + Math.hypot(di, dj) * g);
    }
    return best;
  };
  return { g, W, x0, z0, spread, farthest, at, clear: () => { D.fill(Infinity); } };
}
/** THE EXAMINATION: a member stands a rune within this of its heart (m). */
export const EG_RUNE_STAND_M = 1.8;
/**
 * AUDIT EG V (h; B NEW-3 - sections 13.2, THE ERRAND FLOOR, and 18, THE OLD MASTERS): THE EXAMINATION'S ROUTE, WALKED over the
 * whole fight floor (floorWalker) for a company of `n`: with a member a rune (`n` at least the runes), the longest walk from any
 * point of the floor to any rune of `runes` - each rune's member may stand anywhere; with fewer, a lone runner's - from the
 * floor's farthest point to the first rune (in their order, `[x, z]`), then rune to rune. A rune is stood within
 * EG_RUNE_STAND_M; the grid's half diagonal is added a leg (never under the truth). Its errand floor is the Examination's least
 * window: on a court of its own it is under the 10 s the window keeps, and on another lord's ground of many pieces a company
 * spread over Grath's islands or the Twins' far court meets the runes about the master's own floor in time. Pure; m.
 * @param {any} spec @param {number[][]} runes @param {number} n
 */
export function egRuneRouteM(spec, runes, n, y = NaN) {
  const G = runes.length ? floorWalker(spec, y) : null;
  if (!G) return 0;
  const half = G.g / Math.SQRT2;
  if (n >= runes.length) {
    let worst = 0;
    for (const [x, z] of runes) { G.clear(); G.spread(x, z, EG_RUNE_STAND_M); worst = Math.max(worst, G.farthest()[1]); }
    return worst + half;
  }
  G.spread(runes[0][0], runes[0][1], EG_RUNE_STAND_M);
  let route = G.farthest()[1] + half;
  for (let j = 1; j < runes.length; j++) { G.clear(); G.spread(runes[j][0], runes[j][1], EG_RUNE_STAND_M); route += G.at(runes[j - 1][0], runes[j - 1][1]) + half; }
  return route;
}
/** The fight floor's main disc (its first) - or one about the lord where a lord fights on another's ground (a Twin Court's
 *  second, an Old Master, a Kyn champion beside a Court's lord): AUDIT EG V (h; B NEW-3, section 18) the disc it stands on (the
 *  nearest by its edge - the deepest inside, where two hold it), so its errands (the Examination's runes, the Last Lesson's ring, the
 *  Cairn-Keeper's gems, the Mother of Dusk's anchors) and its court's blows (the Lattice, the Blink, the havens' first) stand
 *  about its own floor - never about the ground's first island or court, where it may not be; a ground of no disc, one about
 *  the lord. A Court's own lord, a ground of one disc and every hall but a Court keep the first. */
function mainDisc(spec, L) {
  // THE ASCENT (Elite-Gates-Ascent.md section 2): of the storey its feet stand in (the discs that bear them), where any does
  const H = egFeetY(spec, L.y), all = (spec.fl ?? []).filter((f) => f.t === 'd'), own = Number.isFinite(H) ? all.filter((f) => egBears(f.y ?? 0, H)) : all;
  const discs = own.length ? own : all;
  if (!discs.length) return Number.isFinite(H) ? { x: L.x, z: L.z, r: 18, y: H } : { x: L.x, z: L.z, r: 18 };
  if (discs.length === 1 || spec.kind !== 'court' || L.key === spec.lord) return discs[0];
  let best = discs[0], bd = Infinity;
  for (const f of discs) { const d = dist(L.x, L.z, f.x, f.z) - f.r; if (d < bd) { bd = d; best = f; } }
  return best;
}
/** A ground's spots of a role, or `k` laid on a ring `rr` out from the main disc's heart (a lord on another's ground). */
function spotsOr(spec, L, role, k, rr, own = true) {
  const have = spec.spots?.[role];
  if (own && have?.length) return have.map((q) => (Number.isFinite(spotY(spec, q)) ? [q.x, q.z, spotY(spec, q)] : [q.x, q.z]));   // AUDIT EG IV: `own` false - the ring, whatever the ground lays; THE ASCENT: a spot's floor with it
  const f = mainDisc(spec, L), R = Math.min(rr, Math.max(2, f.r - 1.5));
  return Array.from({ length: k }, (_, j) => egKeepOnFight(spec, f.x + Math.sin((j / k) * 2 * Math.PI + Math.PI / 4) * R, f.z + Math.cos((j / k) * 2 * Math.PI + Math.PI / 4) * R, 1, f.y));
}

/**
 * THE LORDS STOOD for a hall: a Court's lord (or the Twins, both), a Proving Walk's champion, a Kyn's Vigil's champion on
 * an arrival plate - each asleep until the hall wakes it, with its health, its look, its errands' objects.
 * @param {any} F @param {any} spec @param {string} key @param {number} now @param {any[]} out @param {{ decrees?: any, n: number, at?: number[] }} ctx
 */
export function egLordsNew(F, spec, key, now, out, ctx) {
  // EG-ZQ (sections 8.5 and 14; EG5's departure 6): the Markynaz's own decree FOLDS with the circle's lord decrees through the
  // fight's profile (net/eliteGates/egLaw.js egFightProfile) - never in their place - and he is stood under it. AUDIT EG V (lane1 #3): the
  // fight's law folds every decree a lord of it has laid (`F.mem.lawD`, the ranks it was folded from) with the circle's, so a
  // lord stood after him (a Twin Court's second, a Kyn champion's Court) keeps his decree in the one law, never erases it
  const D0 = { ...(ctx.decrees ?? {}), ...(F.mem.lawD ?? {}) };
  const decree = key === 'markynaz' ? egMarkynazDecree(D0, F.h) : null;
  const D = decree ? { ...D0, [decree]: 1 } : D0;
  const law = egLordLaw(D);
  F.mem.lawD = D; F.mem.law = law;
  const asp = egLordAspect(key, F.c);   // AUDIT EG III (sections 13.3 and 13.4): its aspect, its kit's every element - AUDIT EG V (lane1 #2): the lord's own (`L.asp`)
  const champ = key === 'kynreeve' || key === 'kynmarcher' || key === 'markynaz';
  const hp = (champ ? EG_PROVE_HP_S : egTtkRef(F.c)) * F.team * (champ ? F.X : 1) * law.hpX;
  const [x, z] = ctx.at ?? [spec.foe?.x ?? 0, spec.foe?.z ?? 0];
  if (key === 'twins') {
    const courts = spec.spots.court ?? [{ x, z }, { x, z: z + 20 }], one = ctx.n <= 2;
    const a = stand(F, spec, 'twins', courts[0].x, courts[0].z, hp * EG_TWIN_SHARE, now, out, { pt: 0, y: spotY(spec, courts[0]) });
    const b = stand(F, spec, 'twins', one ? courts[0].x + 6 : courts[1].x, one ? courts[0].z + 4 : courts[1].z, hp * EG_TWIN_SHARE, now, out, { pt: 1, y: spotY(spec, one ? courts[0] : courts[1]) });
    F.mem.twins = { a: a.i, b: b.i, crossAt: 0, one };
    egLordsPair(F, a, b, one ? EG_TWIN_ONE_MS : SD_ECHO_PAIR_MS);
    return [a, b];
  }
  // THE ASCENT (section 2): on its foe's floor where the law says its height (`foe.y`, metres; `ctx.at`'s third)
  const fy = egFeetY(spec, ctx.at?.[2] ?? spec.foe?.y);
  const L = stand(F, spec, key, x, z, hp, now, out, { ...(champ ? { extra: { champ: 1 } } : {}), y: fy });
  if (decree) L.decree = decree;
  if (asp) L.asp = asp.id;
  if (EG_LORDS[key]?.fly) egSetFl(F, L, EG_FL.fly, true, out);
  return [L];
}
/**
 * AUDIT EG IV (lane1 #1; sections 13.3 and 18) - A PAIR UNDER THE TWINS' LAW: lords `a` and `b` must fall within `ms` of each
 * other, or the survivor raises the other at half (the Echoes' law) - the Twin Lords (egLordsNew: 15 s, 20 s in one court), and the
 * Old Masters' Spellmaster and Armsmaster (the director pairs them, net/eliteGates/egBrain.js standFight). Any other lords of one fight fall
 * plainly: the fight is won when every one has.
 * @param {any} F @param {any} a @param {any} b @param {number} [ms]
 */
export function egLordsPair(F, a, b, ms = SD_ECHO_PAIR_MS) { F.mem.pair = { a: a.i, b: b.i, ms }; }
/**
 * The fight's pair under the Twins' law, or null: the one paired (egLordsPair - the Twins, the Old Masters the director pairs), or
 * a fight that bears the Old Masters (`F.mem.oldMasters`, the director's word for the stratum's Court) - its Spellmaster and
 * Armsmaster, else its first two lords that are neither a champion nor a mirror - at SD_ECHO_PAIR_MS (kept once found).
 * @param {any} F
 */
export function egLordsPairOf(F) {
  if (F.mem.pair || !F.mem.oldMasters) return F.mem.pair ?? null;
  const lords = F.bodies.filter((b) => b.role === EG_ROLE.lord && !b.champ && !egHas(b, EG_FL.mirror));
  const sm = lords.find((b) => b.key === 'spellmaster'), am = lords.find((b) => b.key === 'armsmaster'), [a, b] = sm && am ? [sm, am] : lords;
  if (a && b) egLordsPair(F, a, b);
  return F.mem.pair ?? null;
}
/** The lords woken (the Court's wake ring, a champion's hall): each chooses its first blow EG_LORD_WAKE_MS later. */
export function egLordsWake(F, spec, now, out, ctx) {
  let woke = 0;
  for (const L of egLordsOf(F)) {
    if (L.up2) continue;
    woke++;
    L.up2 = true; L.nextAt = now + EG_LORD_WAKE_MS; L.wokeAt = now; egSaid(L, L.ph, now);   // EG-ZJ: awake - its phase on the wire (0 asleep)
    // AUDIT FB1018f L3-1: and said at once (`eph`, its first) - a screen holds a lord asleep until it hears a phase
    // (net/eliteGates/egBodies.js egLordAsleep), and the whole fight's word that carried it came up to EG_STATE_EVERY_MS
    // later: every blow the relay lands meanwhile, the screen turned
    out.push({ k: 'eph', i: L.i, ph: L.ph });
    KITS[L.key]?.wake?.(F, spec, L, now, out, ctx);
  }
  if (!woke) return;
  F.mem.lordWokeAt ??= now;
  say(out, 'wake');
}
/** Is any lord of the fight awake and standing? */
export const egLordsAwake = (F) => egLordsOf(F).some((L) => L.up2);
/** Have all of the fight's lords fallen (the Twins' fifteen seconds kept)? */
export const egLordsFell = (F) => !!F.mem.lordsFell;

/**
 * ONE BEAT of the fight's lords: each awake one carried, its phase turned at its threshold (its ward, its errand), its
 * stun run out, its signature's timers run, its next blow chosen at its breath's end at its target by weight (or a walk
 * at it); fury and THE COVENANT'S WEIGHT; the feints cut at FEINT_AT.
 * @param {any} F @param {any} spec @param {number} now @param {{sub: string, x: number, z: number}[]} here @param {() => number} rng
 * @param {any[]} out @param {any} ctx `{ decrees, covenant (the count spent in a Court), n, all (every living sub) }`
 */
export function egLordsStep(F, spec, now, here, rng, out, ctx) {
  const law = F.mem.law ?? egLordLaw();
  // EG-H1: a feint cut at EG_FEINT_AT of its own wind-up once its word is out (`ecut` - the page's `cut`); one committed,
  // pending or held waits for its word, and one dropped is forgotten
  for (const [i] of F.mem.feints ?? []) { const b = F.blows.find((x) => x.i === i), cutAt = b ? egBlowFrom(b) + Math.round(b.wu * EG_FEINT_AT) : 0; if (b && now >= cutAt) egCut(F, i, out, cutAt); }   // EG-PERFECT: its cut's own instant said
  F.mem.feints = (F.mem.feints ?? []).filter(([i]) => F.blows.some((b) => b.i === i) || (F.pend ?? []).some((q) => q.b.i === i) || F.held.some((h) => h.b?.i === i));
  const lords = egLordsOf(F);
  if (!lords.some((L) => L.up2)) return;
  // AUDIT EG III: A LORD'S BLOW LANDED, each once, at the first beat past its landing - the burning ground it leaves laid
  // (`F.mem.pools`, the gate's Meteor's - from its landing; one held past its union floor's ticks and dropped leaves none).
  // AUDIT EG V (lane1 #25): whom it struck is the census's own reckoning, told its kit at the seam's judge (egLordsJudged)
  for (const bl of F.blows) {
    if (bl.ld || now < bl.at) continue;
    bl.ld = 1;
    const pl = F.mem.pools?.[bl.i];
    if (pl) { delete F.mem.pools[bl.i]; for (const st of bl.s) zoneOut(F, 'burn', shDisc(st[1], st[2], pl[0]), bl.at, bl.at + pl[1], out, { p: pl[2], b: pl[3], el: bl.el, y: bl.y }); }   // AUDIT EG IV (lane1 #16): one under each of its marks, as the gate's Hellfire lays it (net/gate/gateStrike.js landingPools)
  }
  if (F.mem.pools) for (const k of Object.keys(F.mem.pools)) { const i = Number(k); if (!F.blows.some((b) => b.i === i) && !(F.pend ?? []).some((q) => q.b.i === i) && !F.held.some((h) => h.b?.i === i)) delete F.mem.pools[k]; }
  const view = egFightView(spec);   // EG-ZK (section 11.7): the fight ground a lord's run is cut on
  // FURY (section 13.2) and THE COVENANT'S WEIGHT (section 18)
  const ttk = egTtkRef(F.c);
  // AUDIT EG IV (lane1 #20): fury is the fight's LORDS' - a champion beside them (Clan Feud's) neither turns to it nor holds it
  // back, and a fight of champions alone (a Proving Walk's, a Vigil's) has none
  const furious = lords.filter((L) => !L.champ);
  if (!F.mem.furyAt && furious.length && (ctx.covenant || now - (F.mem.lordWokeAt ?? now) >= EG_FURY_RATIO * ttk * 1000)) {
    F.mem.furyAt = now; F.mem.furySteps = 0;
    for (const L of furious) egSetFl(F, L, EG_FL.fury, true, out);
    say(out, 'fury', { n: egBossName(furious[0].key, 0) });
  }
  if (F.mem.furyAt && furious.length && now >= (F.mem.furyNext ?? F.mem.furyAt + EG_FURY_EVERY_MS)) {
    F.mem.furyNext = now + EG_FURY_EVERY_MS;
    F.mem.furySteps = (F.mem.furySteps ?? 0) + 1;
    F.mem.furyX = Math.min(1.5, (F.mem.furyX ?? 1) + EG_FURY_STEP);
    const L0 = furious[0], spots = [];
    for (let k = 0; k < egWaveSize(ctx.n); k++) { const a = rng() * Math.PI * 2; spots.push(egKeepOnFight(spec, L0.x + Math.sin(a) * 9, L0.z + Math.cos(a) * 9, 1, L0.y)); }
    egLegionRaise(F, egWaveKinds(F, rng, spots.length, { waveNo: (F.mem.waves = (F.mem.waves ?? 0) + 1) }), spots, now, out, { wave: 1000 + F.mem.waves });
  }
  if (ctx.covenant) {
    if (!F.mem.weightAt) { F.mem.weightAt = now; say(out, 'covenant'); }
    if (now >= (F.mem.weightNext ?? 0)) {
      F.mem.weightNext = now + EG_WEIGHT_EVERY_MS;
      lordBlow(F, spec, lords[0], [shAll()], { nm: "The Covenant's Weight", wu: EG_WEIGHT_WU_MS, p: EG_WEIGHT_PCT, b: 0, el: null }, here, now, out, { ch: true });
    }
  }
  for (const L of lords) {
    if (!L.up2 || !(L.hp > 0)) continue;
    if (L.mv) { const m = L.mv, len = Math.hypot(m.tx - m.x, m.tz - m.z), along = len < 1e-6 ? 0 : Math.min(len, (Math.max(0, now - m.at) / 1000) * m.v); L.x = len < 1e-6 ? m.tx : m.x + ((m.tx - m.x) / len) * along; L.z = len < 1e-6 ? m.tz : m.z + ((m.tz - m.z) / len) * along; }
    // threat forgets
    if (law.threatDecay > 0) { const k = Math.max(0, 1 - law.threatDecay * ((now - (L.thAt ?? now)) / 1000)); for (const s of Object.keys(L.threat)) L.threat[s] *= k; }
    L.thAt = now;
    if (L.ward && now >= L.ward) { L.ward = 0; egSetFl(F, L, EG_FL.ward, !!F.mem.wardHeld?.[L.i], out); }
    if (L.stunUntil && now >= L.stunUntil) { L.stunUntil = 0; egSetFl(F, L, EG_FL.stun, false, out); }
    // a phase's turn - AUDIT EG IV (lane1 #4): never a mirror's (Seyth's, an image): a mirror is no lord's phase, so it lays no
    // Long Night and wards itself at no threshold; nor does it run its kit's signature (the true lord runs it)
    const mirror = egHas(L, EG_FL.mirror);
    const frac = L.hp / L.max;
    const want = frac <= PHASE_AT[1] ? 3 : frac <= PHASE_AT[0] ? 2 : 1;
    // EG-PERFECT (section 13.2, "Each phase adds a mechanic"): EVERY TURN TAKEN - a burst past two lines turns the second phase and
    // then the third in one beat, each with its card and its own mechanic (a Valkynaz's signature, the Bridges Burn), never the
    // second skipped; a signature's hold is set only over a health still above its line (sigHolds)
    if (want > L.ph && !L.champ && !mirror) {
      ward(F, L, SHIELD_MS, now, out);
      for (let ph = L.ph + 1; ph <= want; ph++) {
        L.ph = ph; egSaid(L, ph, now);
        out.push({ k: 'eph', i: L.i, ph });
        phaseSay(F, L, out);   // AUDIT EG V (lane1 #14): every lord's turn by its name (the card's order on every screen)
        KITS[L.key]?.phase?.(F, spec, L, ph, now, here, rng, out, ctx);
      }
    }
    if (!mirror) KITS[L.key]?.tick?.(F, spec, L, now, here, rng, out, ctx);
    pairTick(F, L, now, out);
    if (!(L.hp > 0)) continue;
    if (L.stunUntil > now || egHas(L, EG_FL.hidden)) continue;
    if (L.atk) {
      const A = L.atk;
      // EG-PERFECT (bug 8): a run's body goes down its lane FROM ITS LANDING over its run's time (`run` ms - its row's `sp`, else a
      // quarter second), so the body is where the lane strikes; a leap or a blink lands where its blow does, as it lands - never a
      // recovery later (the champions' Charge stood still through its run and jumped 1.2 s after it)
      if (A.to && !A.moved && now >= A.at) { A.moved = 1; if (A.run > 0) egWalk(F, L, A.to[0], A.to[1], 0, Math.min(EG_RUN_V_MAX, Math.max(1, dist(L.x, L.z, A.to[0], A.to[1]) / (A.run / 1000))), now, spec, L.r, true); else egPlace(F, L, A.to[0], A.to[1], now); }
      if (now < A.until) continue;
      if (A.to) egPlace(F, L, A.to[0], A.to[1], now);
      L.atk = null; L.nextAt = Math.max(L.nextAt, now + EG_LORD_BREATH_MS);
    }
    if (L.busyUntil > now) continue;
    // EG-PERFECT (section 13.3, the duel: "a ring of fire rises around the two"): while its own duel's ring stands a lord goes at
    // its duelists alone, its runs held inside the ring, its blows that would fill the ring (EG_DUEL_NO - the gate's Slam and
    // Meteor, the Kyn's Due) set aside: the audit found the Armsmaster outside his own ring 44% of a duel, and a Meteor on a
    // duelist at its heart that left no cell
    const duel = F.mem.challenge?.by === L.i && F.mem.challenge.r > 0 ? F.mem.challenge : null, inDuel = duel ? here.filter((m) => duel.subs.includes(m.sub)) : [];
    // (EG-PERFECT's audit: a member every blow it drew would leave no ground - on a balcony - is let be EG_SHUN_MS while the
    // company has another: the lord kept it, walking at it, and the Kyn Reeve, always at the top of its threat, never struck again)
    const shun = L.shun && now < L.shun[1] ? L.shun[0] : null, open = (q) => (shun && q.length > 1 ? q.filter((m) => m.sub !== shun) : q);
    const foes = open(inDuel.length ? inDuel : here), all = open(here);
    const target = L.key === 'kynreeve' ? (all.reduce((b, m) => ((L.threat[m.sub] ?? 0) > (L.threat[b?.sub] ?? -1) ? m : b), null) ?? nearest(L.x, L.z, all)) : (L.tg && now - (L.tgAt ?? 0) < 4000 ? foes.find((m) => m.sub === L.tg) : null) ?? pickTarget(L, foes, rng, law);
    if (!target) { egStop(F, L, now); continue; }
    if (L.tg !== target.sub) { L.tg = target.sub; L.tgAt = now; }
    if (now < L.nextAt) { if (!egHas(L, EG_FL.fly) && L.key !== 'colossus' && dist(L.x, L.z, target.x, target.z) > L.r + 4) lordWalk(F, spec, L, target.x, target.z, L.r + 1, L.speed ?? 3.4, now, target.y); continue; }
    const kit = KITS[L.key];
    // AUDIT EG V (NEW-1): a member inside the lord's body stands at no gap - never a negative one that every blow's `minGap` refuses (the lord frozen)
    const blows = (kit?.blows ?? []).filter((b) => (b.ph ?? 1) <= L.ph && (!b.when || b.when(F, L, target, here, ctx)) && now >= (L.cds[b.nm] ?? 0) && dist(L.x, L.z, target.x, target.z) - L.r <= (b.range ?? 40) && Math.max(0, dist(L.x, L.z, target.x, target.z) - L.r) >= (ctx.n === 1 && b.minGap1 != null ? b.minGap1 : b.minGap ?? 0)
      && (!b.run || oneLevel(view, L, target)) && (b.ch || egSameStorey(view, L, target)) && !(duel && b.duelNo));   // EG-ZK: a run reaches no member on another floor's height - the lord walks the graph to them; THE ASCENT: nor a blow one a storey over or under; EG-PERFECT: a company of one's own gap (`minGap1` - Grath's Gore at melee), and a duel's ring kept
    const fresh = blows.filter((b) => b.nm !== L.lastBlow || L.run < 2);
    const can = fresh.length ? fresh : blows;
    if (!can.length) { if (!egHas(L, EG_FL.fly) && L.key !== 'colossus') lordWalk(F, spec, L, target.x, target.z, L.r + 1, L.speed ?? 3.4, now, target.y); continue; }
    const wOf = (b) => (ctx.n === 1 && b.w1 != null ? b.w1 : b.w ?? 1);   // AUDIT EG III: a blow's weight in a company of one (`w1` - Grath's Gore, twice)
    // EG-PERFECT: drawn by weight, and weighed before it is thrown - a blow whose stamps THE UNION FLOOR would hold and drop is set
    // aside and another drawn (EG_CHOOSE_TRIES); a blow whose making moves the hall (`fx` - Grath's Leap cracks his island) is
    // thrown as drawn, and its word judged as every word is
    let B = null, made = null;
    const tried = new Set();
    for (let k = 0; k < EG_CHOOSE_TRIES && !B; k++) {
      const pool = can.filter((b) => !tried.has(b.nm));
      if (!pool.length) break;
      let x = rng() * pool.reduce((s, b) => s + wOf(b), 0), C = pool[pool.length - 1];
      for (const c of pool) { x -= wOf(c); if (x < 0) { C = c; break; } }
      if (C.fx || C.ch) { B = C; break; }
      const m2 = C.make(F, spec, L, target, here, rng, now, out, ctx);
      if (m2?.stamps && wouldHold(F, spec, L, m2.stamps, { ...C, ...(m2.B ?? {}) }, here, now, m2.delay ?? 0)) { tried.add(C.nm); continue; }
      B = C; made = m2 ?? { none: 1 };
    }
    if (!B) { if (!egHas(L, EG_FL.fly) && L.key !== 'colossus') lordWalk(F, spec, L, target.x, target.z, L.r + 1, L.speed ?? 3.4, now, target.y); L.nextAt = now + EG_LORD_BREATH_MS; if (tried.size) L.shun = [target.sub, now + EG_SHUN_MS]; continue; }
    egStop(F, L, now);
    egFace(F, L, Math.atan2(target.x - L.x, target.z - L.z), now);   // AUDIT EG V (lane1 #7): turned to its target - said, so every screen draws the facing its Shield-Wall is judged by
    if (!made) made = B.make(F, spec, L, target, here, rng, now, out, ctx);
    if (made?.none) made = null;
    const blow = made?.stamps ? lordBlow(F, spec, L, made.stamps, { ...B, ...(made.B ?? {}) }, here, now, out, { feint: made.feint, ch: B.ch, delay: made.delay }) : null;
    if (blow) furyChain(F, spec, L, blow, here, now, out);
    if (made?.extra) for (const e of made.extra) { const b2 = lordBlow(F, spec, L, e.stamps, { ...B, ...e.B }, here, now, out, { delay: e.delay ?? 0 }); if (b2 && e.feint) (F.mem.feints ??= []).push([b2.i]); }
    L.cds[B.nm] = now + Math.max(B.cd ?? 0, made?.cd ?? 0);   // (THE AUDIT: a blow that runs long - the Lattice's sweep - holds its own cooldown past its end)
    L.run = B.nm === L.lastBlow ? L.run + 1 : 1; L.lastBlow = B.nm;
    const wu = (blow?.wu ?? B.wu) + (made?.delay ?? 0), landAt = blow ? blow.at : now + wu;   // EG-H1: the committed blow's own landing (its lead in it)
    let to = made?.to && B.run ? runTo(view, L, made.to) : made?.to ?? null;
    if (duel && to) to = inRing(to, duel, L.r);   // EG-PERFECT: a run inside its duel's ring
    L.atk = { at: landAt, until: landAt + (B.sp ?? 0) + (B.rec ?? 900), to, run: B.run ? B.sp || EG_RUN_MS : 0 };
  }
  errandsGive(F, here, ctx);   // AUDIT EG IV (lane1 #15): every errand standing given its member
}

/** AUDIT EG IV (lane1 #15; section 13.2): the errands given by numeral - the objects a member stands on or breaks, each to one
 *  member - and the most a fight says (`pg.as`). */
export const EG_ERRANDS_GIVEN = Object.freeze(['rune', 'seal', 'anchor', 'banner', 'brazier', 'heart', 'pillar', 'standard']);
export const EG_GIVEN_MAX = 12;
/**
 * AUDIT EG IV (lane1 #15; section 13.2) - ERRANDS BY NUMERAL: "the relay gives every errand to the nearest unassigned living
 * member and draws it with their numeral". Each beat, over the members in the hall (`here`, numbered by the company's numerals -
 * `ctx.nums`, the director's; a fight without them numbers its company in order):
 *   - each errand object (EG_ERRANDS_GIVEN - runes in their order, the rest as they rose) keeps the member it was given while
 *     both stand; one ungiven goes to the nearest member holding none yet - once every member holds one, the round begins
 *     again (one member stands several runes in turn);
 *   - an errand for two groups splits the numerals at ceil(n/2): the Soul Tithe's gems (the first half of the gems standing to
 *     the first group, each member its group's nearest) and the Twin Lords, from n = 3 (the first group to Vael, the second to
 *     Isk);
 * said on the fight's progress (`pg.as`, `[[body, numeral], ...]`, at most EG_GIVEN_MAX, the whole fight said at once when it
 * moves), which each screen draws over the body as *III - Mira* (scenes/eliteGates/egFight.js). Pure; draws no die.
 */
function errandsGive(F, here, ctx) {
  const nums = ctx.nums ?? Object.fromEntries((F.subs ?? []).map((s, j) => [s, j + 1]));
  const live = here.filter((m) => nums[m.sub] > 0).sort((a, b) => nums[a.sub] - nums[b.sub]);
  const old = F.mem.given ?? {}, given = {}, held = {};
  const half = Math.ceil(live.length / 2), group = (m) => (nums[m.sub] <= nums[live[half - 1]?.sub] ? 0 : 1);
  const nearest = (o, pool) => { let best = null, bd = Infinity; for (const m of pool) { const d = dist(o.x, o.z, m.x, m.z); if (d < bd - 1e-9) { bd = d; best = m; } } return best; };
  const objs = F.bodies.filter((b) => b.role === EG_ROLE.obj && b.hp > 0 && EG_ERRANDS_GIVEN.includes(b.t)).sort((a, b) => (a.t === 'rune' && b.t === 'rune' ? a.pt - b.pt : a.i - b.i));
  for (const o of objs) { const m = live.find((x) => x.sub === old[o.i]); if (m) { given[o.i] = m.sub; held[m.sub] = (held[m.sub] ?? 0) + 1; } }
  for (const o of objs) {
    if (given[o.i] || !live.length) continue;
    const least = Math.min(...live.map((m) => held[m.sub] ?? 0)), m = nearest(o, live.filter((x) => (held[x.sub] ?? 0) === least));
    given[o.i] = m.sub; held[m.sub] = (held[m.sub] ?? 0) + 1;
  }
  // the two groups' errands: each member to its group's nearest gem; the Twins' company split between them
  const gems = egObjsOf(F, 'gem'), gh = Math.ceil(gems.length / 2), T = F.mem.twins;
  const pairs = Object.entries(given).map(([i, sub]) => [Number(i), nums[sub]]), gemOf = {};
  if (gems.length) for (const m of live) {
    const mine = gems.filter((g, j) => (j < gh ? 0 : 1) === group(m)), keep = (mine.length ? mine : gems).find((g) => g.i === F.mem.gemOf?.[m.sub]);
    const g = keep ?? nearest(m, mine.length ? mine : gems);   // kept while it stands, so a member's gem never flickers as it walks
    if (g) { gemOf[m.sub] = g.i; pairs.push([g.i, nums[m.sub]]); }
  }
  if (T && !T.one && live.length >= 3) for (const m of live) pairs.push([group(m) ? T.b : T.a, nums[m.sub]]);
  F.mem.given = given; F.mem.gemOf = gemOf;
  const as = pairs.slice(0, EG_GIVEN_MAX), key = JSON.stringify(as);
  if (key !== JSON.stringify(F.pg.as ?? [])) { F.pg.as = as; F.stateAt = 0; }
}

/** AUDIT EG IV (lane1 #1; section 13.3, the Echoes' law) - THE PAIR'S WINDOW (egLordsPair): a lord of the pair standing while its
 *  mate has lain fallen past the window raises it at half - the Twins' raise, the Old Masters' alike. */
function pairTick(F, L, now, out) {
  const P = egLordsPairOf(F);
  if (!P || !F.mem.twinFellAt || !(L.hp > 0) || (L.i !== P.a && L.i !== P.b) || now - F.mem.twinFellAt <= P.ms) return;
  const dead = egBodyById(F, L.i === P.a ? P.b : P.a);
  if (dead && !(dead.hp > 0)) { dead.hp = Math.round(dead.max / 2); egSetFl(F, dead, EG_FL.fell, false, out); F.mem.twinFellAt = 0; say(out, 'twinraised', { n: egBossName(dead.key, dead.pt) }); }
}

/** A grounding's weight (the Mother of Dusk dragged down, the Wyrm landed), a Scorch's (Grath stunned on a burning bridge or a
 *  cracking island) and a kneel's (the Colossus's Breakdown) - section 13.3. */
export const EG_GROUNDED_HIT_X = 1.3;
export const EG_SCORCH_HIT_X = 1.3;
export const EG_KNEEL_HIT_X = 1.5;
/**
 * A BLOW ON A LORD's weight before the caps (the bucket still decides what lands): its state's - AUDIT EG III: the GREATEST of
 * a stun's STUN_HIT_X (a Scorch's stun weighs its own x1.3), a grounding's x1.3 and a kneel's x1.5, never their product (the
 * Breakdown's kneel is a stun's stillness at the kneel's x1.5, Grath Scorched x1.3 - section 13.3's numbers); the Kynreeve's
 * Shield-Wall (front 75% less, behind 30% more), the Kynmarcher's standards (20% off each standing), a twin's Touched (+25% on
 * the other), Unyielding's x0.85; a ward refuses it (0), and a flyer is out of a blade's reach. AUDIT EG IV (lane1 #3; section
 * 8.6): a lord ASLEEP refuses it too - it wakes with its ring (the fastest member never meets it alone), so no blow from beyond
 * its ring, nor a burst before it wakes, lands on it.
 */
export function egLordHitX(F, L, sub, pose, r, now) {
  if (!L.up2 || L.ward > now || egHas(L, EG_FL.ward)) return 0;
  if (egHas(L, EG_FL.fly) && !egHas(L, EG_FL.grounded) && r === HIT_KINDS.Melee) return 0;
  const law = F.mem.law ?? egLordLaw();
  let x = law.hitX, st = 1;
  if (L.stunUntil > now) st = (L.scorchUntil ?? 0) > now ? EG_SCORCH_HIT_X : STUN_HIT_X;
  if ((L.groundedUntil ?? 0) > now) st = Math.max(st, EG_GROUNDED_HIT_X);
  if ((L.kneelUntil ?? 0) > now) st = Math.max(st, EG_KNEEL_HIT_X);
  x *= st;
  if (L.key === 'kynreeve' && pose) x *= egFromFront(L, pose.x, pose.z) ? 0.25 : egFromBehind(L, pose.x, pose.z) ? 1.3 : 1;
  if (L.key === 'kynmarcher') x *= Math.max(0.2, 1 - 0.2 * egObjsOf(F, 'standard').length);
  if (L.key === 'twins') { const fire = egMarkOf(F, sub, EG_MARK_FIRE), frost = egMarkOf(F, sub, EG_MARK_FROST); if ((L.pt === 1 && fire && fire[2] > now) || (L.pt === 0 && frost && frost[2] > now)) x *= EG_TOUCH_X; }
  return x;
}
/**
 * A BLOW ON A LORD LANDED (`got` what the purse let through): its threat, an errand's hold on the next threshold, the
 * Armsmaster's Riposte, the Spellmaster's images, a mirror's crack, a fall (the Twins' fifteen seconds, the survivor's
 * raise). Its frames into `out`; answers what the lord LOST - FIELD BUGS 2026-10-20f LANDED-WORD: an errand's held line takes
 * back what fell past it, and the seam answered the purse's whole, so the recap, a Court's chart and the earned share counted
 * blows the lord never felt while it was held.
 */
export function egLordHit(F, spec, L, sub, name, got, pose, now, here, out, ctx = {}) {
  if (L.hpFloor != null && L.hp < L.hpFloor) { got -= L.hpFloor - L.hp; L.hp = L.hpFloor; }
  L.threat[sub] = (L.threat[sub] ?? 0) + got * (ctx.threatX ?? 1);
  if (!egHas(L, EG_FL.mirror)) KITS[L.key]?.hit?.(F, spec, L, sub, got, pose, now, here, out, ctx);   // AUDIT EG IV (lane1 #10): a mirror's blow is no duel's
  if (L.hp > 1e-6) return got;
  L.hp = 0;
  if (egHas(L, EG_FL.mirror)) { egGone(F, [L], EG_GONE.slain, name, now, out); KITS[L.key]?.mirrorDown?.(F, L, now, out); return got; }
  L.fellAt = now; egSaid(L, L.ph, now);   // EG-ZJ: its fall's instant on the wire (AUDIT EG V, lane1 #6: and the Twins' "Together" reads it)
  endChallenge(F, L, now, out, false, true);   // AUDIT EG V (lane1 #1): a fallen lord's duel ends with it - its ring never stands ownerless
  egSetFl(F, L, EG_FL.fell, true, out);
  // AUDIT EG IV (lane1 #1; sections 13.3 and 18): the fight falls when EVERY lord of it has - Clan Feud's champion beside the Court's
  // lord, the Twin Court's two, the Old Masters - and a pair under the Twins' law (egLordsPair) opens its window at the first fall
  const left = egLordsOf(F).filter((x) => !egHas(x, EG_FL.mirror) && x.hp > 0);
  if (left.length) {
    const P = egLordsPairOf(F), mate = P && (L.i === P.a || L.i === P.b) ? egBodyById(F, L.i === P.a ? P.b : P.a) : null;
    if (mate && mate.hp > 0) { F.mem.twinFellAt = now; say(out, 'twinfell', { n: egBossName(L.key, L.pt) }); }
    return got;
  }
  F.mem.lordsFell = 1;
  for (const m of egLordsOf(F).filter((x) => egHas(x, EG_FL.mirror))) egGone(F, [m], EG_GONE.crumbled, '', now, out);
  out.push({ k: 'efell', i: L.i, at: now, n: name });
  return got;
}

// ── the kits ─────────────────────────────────────────────────────────────────────────────────────────────
const at = (m) => [m.x, m.z];
/** A blow toward the target: a lane from the lord. */
const laneTo = (L, t, len, w) => shLaneAt(L.x, L.z, Math.atan2(t.x - L.x, t.z - L.z), len, w);
/** The gate's three (and the Meteor) as kit rows. */
/** AUDIT EG III: the Meteor's element the gate's (fire), which the lord's aspect makes its own (lordBlow - the gate's law, "his
 *  fire is his aspect's"), its burning ground with it; the Valkynaz throw it from the first phase. */
const gateKit = () => [
  { ...CLEAVE, make: (F, spec, L, t) => ({ stamps: [shCone(L.x, L.z, Math.atan2(t.x - L.x, t.z - L.z), ATTACKS.cleave.r, ATTACKS.cleave.arc)] }) },
  { ...SLAM, duelNo: 1, make: (F, spec, L) => ({ stamps: [shDisc(L.x, L.z, ATTACKS.slam.r)] }) },   // EG-PERFECT: r 7 fills a duel's r 6 ring - set aside in one
  { ...METEOR, el: ATTACKS.meteor.el, ph: 1, cd: 9000, duelNo: 1, make: (F, spec, L, t) => ({ stamps: [shDisc(t.x, t.z, ATTACKS.meteor.r)] }) },
];
/** The champions' three: the Charge's run its `active`, widened to 4 m (THE WIDTH RULE). */
const champKit = () => [
  { ...CLEAVE, make: (F, spec, L, t) => ({ stamps: [shCone(L.x, L.z, Math.atan2(t.x - L.x, t.z - L.z), ATTACKS.cleave.r, ATTACKS.cleave.arc)] }) },
  { ...SLAM, make: (F, spec, L) => ({ stamps: [shDisc(L.x, L.z, ATTACKS.slam.r)] }) },
  { ...CHARGE, sp: ATTACKS.charge.active, run: 1, make: (F, spec, L, t) => { const yaw = Math.atan2(t.x - L.x, t.z - L.z), [ex, ez] = egKeepOnFight(spec, L.x + Math.sin(yaw) * ATTACKS.charge.len, L.z + Math.cos(yaw) * ATTACKS.charge.len, L.r, L.y); return { stamps: [shLane(L.x, L.z, ex, ez, 4)], to: [ex, ez] }; } },
];

/** AUDIT EG IV (lane9 #16; section 13.4): Garoth's third phase card - the older signature he borrows, by its own name. */
export const EG_GAROTH_SIG_CARDS = Object.freeze({ ilthys: 'The Conquest.', morvayn: 'The Chaining.', seyth: 'The Mirrorcourt.' });
/** The older signature Garoth borrows at circle `c` (section 13.4: by turns, one Garoth Redoubt to the next). */
export const egGarothSig = (c) => ['ilthys', 'morvayn', 'seyth'][Math.floor(c / 5) % 3];
/**
 * AUDIT EG V (lane1 #14; sections 13.2 and 27.5) - THE PHASE CARDS: every lord's second and third phase, its name and its one
 * order (`[name, order]`, the second phase's first) - the gate's phase card (scenes/gate/gateCourt.js courtPhaseCard: the numeral,
 * the phase's name, one order), drawn on every screen at the lord's turn (`eph` - scenes/eliteGates/egFight.js) and its name said
 * (`esay` 'phase', egLordsStep). Garoth's third is the signature he borrows (EG_GAROTH_SIG_CARDS, by EG_GAROTH_SIG_ORDERS).
 */
export const EG_LORD_PHASES = Object.freeze({
  hound: Object.freeze([['The Bridges Burn', 'Get off a bridge before it burns.'], ['The Pack', 'Run apart when hunted.']]),
  spellmaster: Object.freeze([['The Examination', 'Stand on the runes in order.'], ['The Final Examination', 'Break the seals.']]),
  armsmaster: Object.freeze([['The Second Challenge', 'Answer the challenge.'], ['The Last Lesson', 'Stay inside the closing ring of fire.']]),
  ilthys: Object.freeze([['The Conquest', 'Break her banners.'], ['The Last Charge', 'Get off the third of the floor that falls.']]),
  cairnkeeper: Object.freeze([['The Cracked Gem', 'Lay your souls in the three gems left.'], ['The Double Tithe', 'Lay two souls each.']]),
  twins: Object.freeze([['Rivalry', 'Strike the stronger twin.'], ['Both Courts Burn', 'Stay off the ground by the walkway.']]),
  morvayn: Object.freeze([['The Chaining', 'Stay close to your chain.'], ['The Last Rites', 'Chains of three. Stay together.']]),
  dusk: Object.freeze([['Wingbeat', 'Brace against the gusts.'], ['Moonfall', 'Break the anchors again.']]),
  stalker: Object.freeze([['Three Shadows', 'Find the shadow that glints.'], ['Blood Moon', 'Three are tethered. Stand apart.']]),
  seyth: Object.freeze([['The Mirrorcourt', 'Strike the true lord.'], ['The Long Night', 'Keep to the moon-shafts.']]),
  colossus: Object.freeze([['Paired Hearts', 'Break each pair together.'], ['Breakdown', 'It kneels. Strike now.']]),
  wyrm: Object.freeze([['Burning Perches', 'Clear the perch it leaves.'], ['Grounded', 'Beware its sweeping breath.']]),
  garoth: Object.freeze([['The Clan Muster', 'Answer the honor duel.']]),
});
/** Garoth's borrowed signature's order, by the signature (its name EG_GAROTH_SIG_CARDS'). */
export const EG_GAROTH_SIG_ORDERS = Object.freeze({ ilthys: 'Break his banners.', morvayn: 'Stay close to your chain.', seyth: 'Strike the true lord.' });
/** A lord's phase `ph` (2 or 3) at circle `c`: `{ name, order }`, or null (a first phase, a champion). Pure. */
export function egLordPhase(key, ph, c) {
  if (key === 'garoth' && ph === 3) { const g = egGarothSig(c); return { name: EG_GAROTH_SIG_CARDS[g].replace(/\.$/, ''), order: EG_GAROTH_SIG_ORDERS[g] }; }
  const P = EG_LORD_PHASES[key]?.[ph - 2];
  return P ? { name: P[0], order: P[1] } : null;
}
/** A lord's turn said by its name (`esay` 'phase', `t` - the beat line; the card is drawn from EG_LORD_PHASES) - once a fight
 *  for a lord's key and phase (the Twins turn each their own, one card). */
function phaseSay(F, L, out) {
  const P = egLordPhase(L.key, L.ph, F.c), k = `${L.key}:${L.ph}`;
  if (!P || (F.mem.phSaid ??= {})[k]) return;
  F.mem.phSaid[k] = 1;
  say(out, 'phase', { t: `${P.name}.` });
}
/** THE KITS: each lord's blows (`make` its stamps), and its signature's hooks - `wake`, `phase`, `tick`, `hit`. */
const KITS = {
  // ── the Proving champions (section 8.5) ──
  kynreeve: { blows: champKit() },
  // AUDIT EG V (lane1 #11; sections 8.5 and 8.6): the Citadel's three standards PLANTED AS HE WAKES - a champion asleep takes no
  // blow, and nothing of his errand stands to be broken before his ring wakes him
  kynmarcher: { blows: champKit(), wake(F, spec, L, now, out) { for (const [sx, sz, y] of spotsOr(spec, L, 'standard', 3, 9).slice(0, 3)) obj(F, 'standard', sx, sz, egHpTeam(F, 4), now, out, { r: 0.8, y }); } },
  markynaz: { blows: champKit() },

  // ── GRATH, THE HOUND: a fight about ground ──
  hound: {
    blows: [
      // AUDIT EG IV (lane1 #8; section 13.3: "No lane is ever laid along a bridge"): on his own ground Grath gores only a member on
      // the island he stands on - never down a bridge at one on it, nor across the magma along one to the next island
      { nm: 'Gore', wu: 1300, rec: 1000, p: 0.4, b: 12, pu: 6, range: 18, minGap: 4, minGap1: 0, w: 3, w1: 6, when: (F, L, t) => !egObjsOf(F, 'isle').length || (islandOf(F, L) != null && islandOf(F, L) === islandOf(F, t)), make: (F, spec, L, t) => ({ stamps: [laneTo(L, t, 18, 4)] }) },
      { nm: 'Savage', wu: 1200, rec: 900, p: 0.45, b: 12, range: 6, w: 3, make: (F, spec, L, t) => ({ stamps: [shCone(L.x, L.z, Math.atan2(t.x - L.x, t.z - L.z), 7, 110)] }) },
      { nm: 'Leap', wu: 1500, rec: 1500, p: 0.45, b: 12, range: 60, minGap: 14, w: 2, cd: 8000, fx: 1, when: (F, L, t) => islandOf(F, t) != null && islandOf(F, t) !== islandOf(F, L), make: (F, spec, L, t, here, rng, now, out) => {
        const from = islandOf(F, L), to = egObjsOf(F, 'isle').find((o) => o.i === islandOf(F, t));
        if (!to) return null;
        if (from) crack(F, from, now, out);
        return { stamps: [shDisc(to.x, to.z, 6)], to: [to.x, to.z] };
      } },
    ],
    wake(F, spec, L, now, out) {
      for (const s of spec.spots.isle ?? []) obj(F, 'isle', s.x, s.z, 0, now, out, { r: 11, y: spotY(spec, s) });
      F.mem.scentAt = now + 12_000; F.mem.burnAt = 0;
    },
    phase(F, spec, L, ph, now) { if (ph === 2) F.mem.burnAt = now + 4000; },
    tick(F, spec, L, now, here, rng, out, ctx) {
      // the islands crack and fall, and rise again
      for (const o of egObjsOf(F, 'isle')) {
        if (o.st === 1 && now >= o.stAt) { o.st = 2; o.stAt = now + 15_000; egObSay(o, 2, now, out); }   // EG-PERFECT: its fall zoned as it cracked (crack)
        else if (o.st === 2 && now >= o.stAt) { o.st = 0; egObSay(o, 0, now, out); }
      }
      // THE SCENT: a member hunted for 8 s at 5.2 m/s; a catch is a Maul (n = 1: no Scent - it gores twice as often, Gore's `w1`)
      if (ctx.n >= 2 && now >= (F.mem.scentAt ?? Infinity) && !F.mem.scent) {
        const k = L.ph >= 3 && ctx.n >= 3 ? 2 : 1, picks = [...here].sort(() => rng() - 0.5).slice(0, k);
        F.mem.scent = picks.map((m) => ({ sub: m.sub, until: now + 8000 }));
        for (const p of picks) egMark(F, p.sub, 0, now + 8000);
        F.mem.mkDirty = 1;
        say(out, 'scent', { s: picks.map((p) => p.sub) });
        L.busyUntil = now + 8000; L.speed = 5.2;
      }
      if (F.mem.scent) {
        const hunt = F.mem.scent.find((s) => s.until > now);
        const m = hunt ? here.find((x) => x.sub === hunt.sub) : null;
        if (!hunt || !m) { F.mem.scent = null; F.mem.scentAt = now + 20_000; L.busyUntil = 0; L.speed = 3.4; for (const m2 of here) egUnmark(F, m2.sub, 0); F.mem.mkDirty = 1; }
        else if (!L.atk) {
          // led onto a burning bridge or a cracking island, he is Scorched
          const burning = (F.mem.burning ?? []).some((z) => (z.from ?? 0) <= now && z.until > now && z.s && z.s[0] === 'l' && segHit(z.s, L.x, L.z));
          const cracking = egObjsOf(F, 'isle').some((o) => o.st === 1 && dist(o.x, o.z, L.x, L.z) <= 11);
          // EG-PERFECT (bug 9): the hunt over, its pace and its marks with it - Grath kept the Scent's 5.2 m/s after every Scorch
          if (burning || cracking) { egStun(F, L, 4000, now, out); L.scorchUntil = now + 4000; for (const q of F.mem.scent) egUnmark(F, q.sub, 0); F.mem.mkDirty = 1; F.mem.scent = null; F.mem.scentAt = now + 20_000; L.busyUntil = 0; L.speed = 3.4; say(out, 'scorched'); }
          else if (dist(L.x, L.z, m.x, m.z) <= L.r + 1.5) {
            L.atk = { at: now + 1200, until: now + 2400 };
            lordBlow(F, spec, L, [shDisc(m.x, m.z, 3)], { nm: 'Maul', wu: 1200, p: 0.35, b: 10, el: null }, here, now, out);
            hunt.until = now;
          } else lordWalk(F, spec, L, m.x, m.z, 0.5, 5.2, now, m.y);   // EG-ZK: hunted over the bridges, never the magma
        }
      }
      // phase 2: the bridges burn by turns - each told 3 s, burning 12 s
      if (F.mem.burnAt && now >= F.mem.burnAt) {
        const bridges = spec.spots.bridge ?? [];
        if (bridges.length) {
          const b = bridges[(F.mem.burnI = ((F.mem.burnI ?? -1) + 1) % bridges.length)];
          const s = shLane(b.x, b.z, b.bx, b.bz, 6);
          // AUDIT EG V (lane1 #10; section 13.2): the place's own fire - no CHECK (it has an edge to run to), so THE UNION FLOOR
          // sets it beside every blow pending on a member; aimed at no one, it is never itself held
          egAim(F, spec, { o: L.i, s: [s], at: now + 3000, wu: 3000, p: 0.2 * egShareX(F.c), b: 4, el: 'fire', nm: 'Burning Bridge', sp: 12_000, y: spotY(spec, b) }, [], now, out);
          (F.mem.burning ??= []).push({ s, from: now + 3000, until: now + 15_000 });   // AUDIT EG V (lane1 #30): burning from its landing, told before
        }
        F.mem.burnAt = now + 14_000;
      }
    },
  },

  // ── THE LAST SPELLMASTER: a fight about reading ──
  spellmaster: {
    blows: [
      { nm: 'Haven Nova', wu: 4000, rec: 1000, p: 0.6, b: 0, el: 'shock', ch: true, range: 99, w: 1, cd: 22_000, make: (F, spec, L, t, here, rng, now) => {
        const all = spotsOr(spec, L, 'haven', 4, 13).map(([x, z]) => [x, z, 3]), k = Math.max(2, Math.min(4, Math.ceil(here.length / 2) + 1)), havens = all.slice(0, k);
        const f = mainDisc(spec, L), fl = spec.fl ?? [];
        if (fl.length <= 1 && (fl[0]?.t ?? 'd') === 'd') return { stamps: [shOut(havens)], B: { wu: havenWu(havens, f) } };
        // AUDIT EG V (lane1 #26): another lord's ground of many pieces - the havens over the whole floor, its walked route measured
        const H = egHavenFloor(spec, havens, egHavenRouteM(havens, f), f.y);   // THE ASCENT: over the master's own storey
        return { stamps: [shOut(H.havens)], B: { wu: egErrandMs(H.routeM) } };
      } },
      { nm: 'Arcane Lattice', wu: 1400, rec: 800, p: 0.35, b: 10, el: 'shock', range: 99, w: 2, cd: 12_000, make: (F, spec, L, t) => {
        const f = mainDisc(spec, L), yaw = Math.atan2(t.x - L.x, t.z - L.z) + Math.PI / 2, ux = Math.sin(yaw), uz = Math.cos(yaw), vx = Math.cos(yaw), vz = -Math.sin(yaw);
        // EG-PERFECT: A SWEEP - strips side by side over the whole floor, from the side farthest from its mark across it, each
        // EG_LATTICE_STEP_MS after the last (four strips with fixed gaps before: the gaps were never struck)
        // (THE AUDIT: strips enough to cover the floor rim to rim - a floor's count left its edges' metre unstruck - and the next
        // sweep only once this one's last strip has landed, 2 s on: a 12 s cooldown overlapped a sweep of ten strips or more)
        const W = EG_LATTICE_W, n = Math.max(3, Math.ceil((2 * f.r) / W)), side = (t.x - f.x) * vx + (t.z - f.z) * vz >= 0 ? -1 : 1, o0 = side * ((n * W) / 2 - W / 2);
        const lanes = Array.from({ length: n }, (_, j) => o0 - side * j * W).map((o) => shLane(f.x + vx * o - ux * f.r, f.z + vz * o - uz * f.r, f.x + vx * o + ux * f.r, f.z + vz * o + uz * f.r, W));
        return { stamps: [lanes[0]], extra: lanes.slice(1).map((s, j) => ({ stamps: [s], delay: EG_LATTICE_STEP_MS * (j + 1), B: {} })), cd: EG_LATTICE_STEP_MS * (n - 1) + 1400 + 2000 };
      } },
      { nm: 'Arcane Bolt', wu: 1600, rec: 700, p: 0.3, b: 8, el: 'shock', range: 30, w: 3, make: (F, spec, L, t) => ({ stamps: [shDisc(t.x, t.z, 3)] }) },
      { nm: 'Mirror Images', wu: 600, rec: 400, p: 0, b: 0, range: 99, w: 1, cd: 30_000, when: (F, L) => !egHas(L, EG_FL.mirror) && mirrorsOf(F, L).length === 0, make: (F, spec, L, t, here, rng, now, out) => {
        for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + rng(); const [x, z, y] = egKeepOnFight(spec, L.x + Math.sin(a) * 8, L.z + Math.cos(a) * 8, 1, L.y); const im = stand(F, spec, 'spellmaster', x, z, 1, now, out, { pt: 1 + k, fl: EG_FL.mirror, y }); if (im) { im.up2 = true; im.nextAt = now + 1500 + k * 700; im.image = 1; im.by = L.i; im.asp = L.asp; } }
        say(out, 'images');
        return null;
      } },
      { nm: 'Blink', wu: 500, rec: 300, p: 0, b: 0, range: 99, minGap: 0, w: 1, cd: 15_000, make: (F, spec, L, t, here, rng, now) => { const f = mainDisc(spec, L), a = Math.atan2(L.x - f.x, L.z - f.z) + Math.PI; return { stamps: null, to: egKeepOnFight(spec, f.x + Math.sin(a) * f.r * 0.7, f.z + Math.cos(a) * f.r * 0.7, 2, L.y) }; } },
    ],
    phase(F, spec, L, ph, now, here, rng, out, ctx) {
      if (ph === 2 && L.hp / L.max > PHASE_AT[1]) examination(F, spec, L, now, here, rng, out, ctx);   // (THE AUDIT: a burst past both lines takes the third's cage alone - no runes it could not hold)
      if (ph === 3) finalExam(F, spec, L, now, here, rng, out, ctx);
    },
    tick(F, spec, L, now, here, rng, out, ctx) {
      // the images' blows are feints (cut at FEINT_AT, no glint, no WIND)
      for (const im of mirrorsOf(F, L).filter((x) => x.image)) {
        if (now < im.nextAt || im.atk) continue;
        const t = pickTarget(im, here, rng, F.mem.law ?? egLordLaw());
        if (!t) continue;
        lordBlow(F, spec, im, [shCone(im.x, im.z, Math.atan2(t.x - im.x, t.z - im.z), 8, 100)], { nm: 'Arcane Cleave', wu: 1500, p: 0.4, b: 10, el: 'shock' }, here, now, out, { feint: true });
        im.atk = { at: now + 1500, until: now + 2600 }; im.nextAt = now + 4000;
      }
      for (const im of mirrorsOf(F, L).filter((x) => x.image && x.atk && now >= x.atk.until)) im.atk = null;
      errandTick(F, spec, L, now, here, rng, out);
      // EG-PERFECT: THE FINAL EXAMINATION AGAIN - the cage closes EG_CAGE_AGAIN_MS after the last resolved
      if (L.ph >= 3 && !F.mem.exam && here.length && now >= (F.mem.cageAt ?? Infinity)) { F.mem.cageAt = Infinity; finalExam(F, spec, L, now, here, rng, out, ctx); }
    },
  },

  // ── THE LAST ARMSMASTER: a fight about the duel ──
  armsmaster: {
    blows: [
      { nm: 'Lunge', wu: 1000, rec: 900, p: 0.4, b: 12, range: 10, minGap: 3, w: 3, run: 1, make: (F, spec, L, t) => { const yaw = Math.atan2(t.x - L.x, t.z - L.z); return { stamps: [shLaneAt(L.x, L.z, yaw, 10, 4)], to: egKeepOnFight(spec, L.x + Math.sin(yaw) * 8, L.z + Math.cos(yaw) * 8, L.r, L.y) }; } },
      { nm: 'Whirl', wu: 1300, rec: 1100, p: 0.45, b: 12, range: 3, w: 2, make: (F, spec, L) => ({ stamps: [shDisc(L.x, L.z, 4)] }) },
      { nm: 'Guard', wu: 600, rec: 200, p: 0, b: 0, range: 8, w: 1, cd: 9000, make: (F, spec, L, t, here, rng, now, out) => { L.guardUntil = now + 600; egSetFl(F, L, EG_FL.lit, true, out); return null; } },
    ],
    wake(F, spec, L, now) { L.duelAt = now + 15_000; },
    phase(F, spec, L, ph, now) { if (ph === 3) { const f = mainDisc(spec, L); F.mem.lessonF = { x: f.x, z: f.z, r: f.r }; F.mem.lessonR = f.r; F.mem.lessonAt = now + 6000; } },   // AUDIT EG V (h): its court the one it turned on, kept
    hit(F, spec, L, sub, got, pose, now, here, out) {
      // THE RIPOSTE: a blow landed in the 0.6 s after his guard rises is answered - a cone at the striker
      if ((L.guardUntil ?? 0) > now && pose) {
        L.guardUntil = 0; egSetFl(F, L, EG_FL.lit, false, out);
        lordBlow(F, spec, L, [shCone(L.x, L.z, Math.atan2(pose.x - L.x, pose.z - L.z), 5, 90)], { nm: 'Riposte', wu: 900, p: 0.5, b: 14, el: null }, here, now, out);
      }
      duelHit(F, L, sub, got, now, out);
    },
    tick(F, spec, L, now, here, rng, out, ctx) {
      if ((L.guardUntil ?? 0) && now >= L.guardUntil) { L.guardUntil = 0; egSetFl(F, L, EG_FL.lit, false, out); }
      challengeTick(F, spec, L, now, here, rng, out, ctx, 15_000);
      const last = F.mem.lessonMin ?? EG_LESSON_LAST_R;
      if (L.ph >= 3 && F.mem.lessonR > last && now >= F.mem.lessonAt) {   // AUDIT EG IV (section 18): THE MASTERS' GROUND stops it at EG_MASTERS_LESSON_R
        F.mem.lessonR -= 1; F.mem.lessonAt = now + 6000;
        const f = F.mem.lessonF ?? mainDisc(spec, L);   // AUDIT EG V (h; B NEW-3): about the master's own court, the one he turned on
        // AUDIT EG IV (lane1 #7): each ring burns until the next closes it; the last stands to the fight's end - AUDIT EG V (h): the
        // last its own (r 17 on THE MASTERS' GROUND burned 6 s and went out), kept whole (F NEW-3: egZonesKeep)
        const end = F.mem.lessonR <= last;
        // EG-PERFECT (section 13.2, "a ground burning told and not yet down"): each ring told EG_LESSON_TELL_MS before it burns, and the
        // last stands until the next takes it - the step came untold before
        zoneOut(F, 'burn', shRing(f.x, f.z, F.mem.lessonR, f.r + 4), now + EG_LESSON_TELL_MS, now + EG_LESSON_TELL_MS + (end ? EG_ZONE_FIGHT_MS : 6000), out, { p: 0.08, b: 3, el: elOf(L, 'fire'), whole: end, y: f.y });
      }
    },
  },

  // ── VALKYNAZ ILTHYS OF THE GALLERIES: the Conquest ──
  ilthys: {
    blows: [
      ...gateKit(),
      { nm: 'Spear of the Conquest', wu: 1300, rec: 1000, p: 0.4, b: 12, el: 'fire', range: 22, w: 2, make: (F, spec, L, t) => ({ stamps: [laneTo(L, t, 22, 4)] }) },
      { nm: 'The Muster-Call', wu: 800, rec: 600, p: 0, b: 0, range: 99, w: 1, cd: 30_000, make: (F, spec, L, t, here, rng, now, out, ctx) => { const spots = spotsOr(spec, L, 'balcony', 3, 18); if (spots.length) egLegionRaise(F, egWaveKinds(F, rng, egWaveSize(ctx.n)), spots, now, out, { wave: 2000 + now % 1000 }); say(out, 'muster'); return null; } },
    ],
    // EG-PERFECT (section 13.2, "A signature errand starts at its phase's turn"): the Conquest is her SECOND phase's, called at the
    // turn and holding the third phase's line until its first round is broken - it ran from her wake, so her second phase's card
    // named a mechanic three minutes old and held nothing
    phase(F, spec, L, ph, now, here, rng, out, ctx) { if (ph === 2) KITS.ilthys.sig(F, spec, L, now, out, ctx, true); if (ph === 3) F.mem.chargeAt = now + 5000; },
    /** The Conquest called: its round begun - a banner planted at once and one every EG_CONQUEST_EVERY_MS until three stand; `hold`
     *  her own (never Garoth's borrowed one): the next threshold held until the round's last banner falls. */
    sig(F, spec, L, now, out, ctx, hold) {
      F.mem.conquest = { next: 0, at: now, hold: sigHolds(L, hold), wardUntil: 0 };
      if (F.mem.conquest.hold) { L.hold = PHASE_AT[1]; L.hpFloor = egHoldHp(L.max, L.hold); }
      say(out, 'conquest');
    },
    tick(F, spec, L, now, here, rng, out, ctx) {
      // THE CONQUEST: a banner on each balcony claims a third of the floor - it burns until its banner is broken; while
      // two stand they hold his ward (25 s at most). EG-PERFECT (section 13.4): planted IN TURN, a third at a time - all three at
      // once burned the whole floor in one stroke (Garoth's on the Clan Pit, 100% of it) - and each burns until its banner is broken
      // (it went out at 60 s, and a banner left standing then held off every later Conquest)
      const f = mainDisc(spec, L);
      if (!F.mem.conquest && now >= (F.mem.conquestAt ?? Infinity) && !egObjsOf(F, 'banner').length) { F.mem.conquestAt = Infinity; KITS.ilthys.sig(F, spec, L, now, out, ctx, false); }
      const C = F.mem.conquest;
      if (C && C.next < 3 && now >= C.at) {
        const spots = spotsOr(spec, L, 'balcony', 3, f.r - 2), [bx, bz, by] = spots[C.next % spots.length];
        const ban = obj(F, 'banner', bx, bz, egHpTeam(F, 4), now, out, { r: 0.8, extra: { third: C.next }, y: by });
        if (ban) { const yaw = Math.atan2(bx - f.x, bz - f.z); ban.zone = zoneOut(F, 'burn', shCone(f.x, f.z, yaw, f.r, 120), now + EG_CONQUEST_TELL_MS, now + EG_ZONE_FIGHT_MS, out, { p: 0.08, b: 3, el: elOf(L, 'fire'), y: f.y, whole: true }); }
        C.next++; C.at = now + EG_CONQUEST_EVERY_MS;
      }
      const banners = egObjsOf(F, 'banner');
      if (C && banners.length >= 2 && !C.wardUntil) C.wardUntil = now + EG_BANNER_WARD_MS;
      // the round over - its three planted and none standing: her held line freed, the next Conquest due
      if (C && C.next >= 3 && !banners.length) { if (C.hold) { L.hpFloor = null; L.hold = undefined; } F.mem.conquest = null; F.mem.conquestAt = now + EG_CONQUEST_AGAIN_MS; }
      const held = !!C && banners.length >= 2 && now < C.wardUntil;
      (F.mem.wardHeld ??= {})[L.i] = held;
      if (held !== egHas(L, EG_FL.ward) && !(L.ward > now)) egSetFl(F, L, EG_FL.ward, held, out);
      // THE LAST CHARGE: a third of the floor falls every 20 s, told 5 s ahead, and rises when the next falls
      if (L.ph >= 3 && now >= (F.mem.chargeAt ?? Infinity)) {
        F.mem.chargeAt = now + 20_000;
        const third = (F.mem.third = ((F.mem.third ?? -1) + 1) % 3), yaw = (third * 2 * Math.PI) / 3;
        egAim(F, spec, { o: L.i, s: [shCone(f.x, f.z, yaw, f.r + 1, 120)], at: now + 5000, wu: 5000, p: 0.1, b: 0, el: null, nm: 'The Floor Falls', y: f.y }, [], now, out);   // AUDIT EG V (lane1 #10): the place's, in THE UNION FLOOR's set
        zoneOut(F, 'void', shCone(f.x, f.z, yaw, f.r + 1, 118), now + 5000, now + 25_000, out, { y: f.y });   // AUDIT EG IV (lane1 #24): it rises as the next third FALLS (25 s on), never at its telling
      }
    },
  },

  // ── THE CAIRN-KEEPER: a fight about eight people's errands ──
  cairnkeeper: {
    blows: [
      { nm: 'Soul Bolt', wu: 1600, rec: 700, p: 0.3, b: 8, el: 'poison', range: 30, w: 3, make: (F, spec, L, t) => ({ stamps: [shDisc(t.x, t.z, 3)] }) },
      { nm: 'Tomb Slam', wu: 1500, rec: 1300, p: 0.4, b: 12, range: 5, w: 2, make: (F, spec, L) => ({ stamps: [shDisc(L.x, L.z, 6)] }) },
      { nm: 'Bone Lance', wu: 1300, rec: 900, p: 0.35, b: 10, el: 'poison', range: 14, w: 2, make: (F, spec, L, t) => ({ stamps: [laneTo(L, t, 14, 4)] }) },
    ],
    wake(F, spec, L, now, out, ctx) {
      for (const [gx, gz, y] of spotsOr(spec, L, 'gem', 4, 12.5)) obj(F, 'gem', gx, gz, 0, now, out, { r: 1.5, extra: { souls: 0, cap: ctx.n }, y });
      F.mem.titheAt = now + 15_000;
    },
    phase(F, spec, L, ph, now, here, rng, out, ctx) {
      if (ph === 2) { const gems = egObjsOf(F, 'gem'); const g = gems[Math.floor(rng() * gems.length)]; if (g) { egGone(F, [g], EG_GONE.crumbled, '', now, out); const rest = egObjsOf(F, 'gem'); const total = 4 * ctx.n; rest.forEach((o, j) => { o.cap = Math.floor(total / rest.length) + (j < total % rest.length ? 1 : 0); o.souls = 0; }); } }
    },
    tick(F, spec, L, now, here, rng, out, ctx) {
      // THE SOUL TITHE: every 25 s each member takes a soul-mark, to be laid in a gem (stand 1.5 s) within 9 s
      if (now >= (F.mem.titheAt ?? Infinity)) {
        F.mem.titheAt = now + 25_000;
        const k = L.ph >= 3 && ctx.n >= 2 ? 2 : 1;
        F.mem.tithe = here.map((m) => ({ sub: m.sub, left: k, until: now + 9000, stood: 0, gem: 0 }));
        for (const m of here) egMark(F, m.sub, 1, now + 9000, k);
        F.mem.mkDirty = 1;
        say(out, 'tithe');
      }
      const T = F.mem.tithe;
      if (T) {
        const gems = egObjsOf(F, 'gem');
        for (const t of T) {
          if (t.left <= 0) continue;
          const m = here.find((x) => x.sub === t.sub);
          const g = m ? gems.find((o) => o.souls < o.cap && dist(o.x, o.z, m.x, m.z) <= 1.5) : null;
          if (g) { if (t.gem !== g.i) { t.gem = g.i; t.stood = now; } if (now - t.stood >= 1500) { g.souls++; t.left--; t.stood = now; egObSay(g, g.souls, now, out); if (t.left <= 0) { egUnmark(F, t.sub, 1); F.mem.mkDirty = 1; } else egMark(F, t.sub, 1, t.until, t.left); } }
          else t.gem = 0;
          if (now >= t.until && t.left > 0) {
            t.left = 0; egUnmark(F, t.sub, 1); F.mem.mkDirty = 1;
            // AUDIT EG IV (lane1 #5): it bursts on the member whose soul it was, wherever they stand
            if (m) { egAim(F, spec, { o: L.i, s: [shDisc(m.x, m.z, 2)], at: now + 600, wu: 600, p: 0.3, b: 0, el: elOf(L, 'poison'), nm: 'Soul Burst', ch: 1, on: [m.sub] }, [], now, out); egLegionSummon(F, L.ph >= 3 ? [EG_KIND.wraith, EG_KIND.wraith] : [EG_KIND.wraith], [[m.x + 2, m.z]], now, out); }
          }
        }
        if (T.every((t) => t.left <= 0)) F.mem.tithe = null;
        if (gems.length && gems.every((o) => o.souls >= o.cap)) { egStun(F, L, 8000, now, out); for (const o of gems) { o.souls = 0; egObSay(o, 0, now, out); } say(out, 'bare'); }
      }
    },
  },

  // ── THE TWIN LORDS, VAEL AND ISK: a fight about splitting the company ──
  twins: {
    blows: [
      { nm: 'Clan Cleave', wu: 1300, rec: 900, p: 0.4, b: 12, range: 7, w: 3, make: (F, spec, L, t) => ({ stamps: [shCone(L.x, L.z, Math.atan2(t.x - L.x, t.z - L.z), 8, 100)], B: { el: L.pt === 1 ? 'frost' : 'fire' } }) },
      { nm: 'Clan Bolt', wu: 1600, rec: 700, p: 0.3, b: 8, range: 30, w: 2, make: (F, spec, L, t) => ({ stamps: [shDisc(t.x, t.z, 3)], B: { el: L.pt === 1 ? 'frost' : 'fire' } }) },
    ],
    wake(F, spec, L, now) { F.mem.twins.crossAt = now + 60_000; },
    // AUDIT EG III - FIRE-TOUCHED AND FROST-TOUCHED: a member a twin's blow landed on is touched for EG_TOUCH_MS from its landing
    // (Vael's mark 2, Isk's 3 - said, `emk`, for every screen's sigil and the struck screen's +25% from that twin), and deals
    // +25% to the other (egLordHitX)
    landed(F, L, bl, struck) { for (const m of struck) egMark(F, m.sub, L.pt === 1 ? EG_MARK_FROST : EG_MARK_FIRE, bl.at + EG_TOUCH_MS); if (struck.length) F.mem.mkDirty = 1; },
    phase(F, spec, L, ph, now, here, rng, out) {
      // AUDIT EG IV (lane1 #23): each twin turns its own phase, the card is said once a fight (AUDIT EG V: egLordsStep's phaseSay)
      if (ph === 3 && !F.mem.twinsBurn) {
        F.mem.twinsBurn = 1;
        const courts = spec.lord === 'twins' ? spec.spots.court ?? [] : [];
        // AUDIT EG V (lane1 #17): "for the rest of the fight" - the module's own fight's end (EG_ZONE_FIGHT_MS), never ten minutes
        if (courts.length === 2) for (const [k, c] of courts.entries()) { const toward = k === 0 ? 0 : Math.PI; zoneOut(F, 'burn', shCone(c.x, c.z, toward, 14.2, 120), now + 3000, now + EG_ZONE_FIGHT_MS, out, { p: 0.08, b: 3, el: k === 0 ? 'frost' : 'fire', whole: true, y: spotY(spec, c) }); }
      }
    },
    tick(F, spec, L, now, here, rng, out) {
      const T = F.mem.twins, a = egBodyById(F, T.a), b = egBodyById(F, T.b);
      // Rivalry: the healthier's shares a tenth up while they stand more than a tenth apart
      if (a && b && L.ph >= 2) { const fa = a.hp / a.max, fb = b.hp / b.max; a.shareX = fa > fb + 0.1 ? 1.1 : 1; b.shareX = fb > fa + 0.1 ? 1.1 : 1; }
      // THE CROSSING: every 60 s they change courts - the walkway struck along its length
      if (L === a && !T.one && now >= T.crossAt && a && b && a.hp > 0 && b.hp > 0) {
        T.crossAt = now + 60_000;
        const w = spec.fl?.find((f) => f.t === 'l');
        // AUDIT EG IV (lane1 #26; section 13.2): a lord's blow like any other - its share by the depth, fury and Vengeful, its word
        // committed with the lead, the union floor over it - and they change courts as it lands
        const cross = w ? lordBlow(F, spec, a, [shLane(w.ax, w.az, w.bx, w.bz, 6)], { nm: 'The Crossing', wu: 3000, p: 0.35, b: 10, el: 'fire' }, here, now, out) : null;
        T.swapAt = cross ? cross.at : now + 3000; T.cross = cross?.i ?? 0;
        say(out, 'crossing');
      }
      // EG-PERFECT (bug 16): they change courts as THE CROSSING LANDS - a Crossing held waits with it, one dropped by THE UNION FLOOR
      // changes nothing and is tried again soon (they swapped untold, struck nothing, in 1 of 4 fights)
      if (L === a && T.swapAt && now >= T.swapAt && a && b) {
        const said = !T.cross || F.blows.some((x) => x.i === T.cross), waits = [...(F.pend ?? []).map((q) => q.b), ...F.held.map((h) => h.b)].find((x) => x?.i === T.cross);
        if (!said && waits) T.swapAt = waits.at;
        else { T.swapAt = 0; if (said) { const ax = a.x, az = a.z; kitPlace(F, a, b.x, b.z, now); kitPlace(F, b, ax, az, now); } else T.crossAt = now + EG_CROSS_AGAIN_MS; }
      }
      // the Echoes' law (fallen apart by more than the window, the survivor raises the other at half): AUDIT EG IV, the pair's
      // own (egLordsPair, pairTick - SD_ECHO_PAIR_MS, EG_TWIN_ONE_MS in one court), the Old Masters' with it
    },
  },

  // ── VALKYNAZ MORVAYN OF THE CAIRN: the Chaining ──
  morvayn: {
    blows: [
      ...gateKit(),
      { nm: 'Venom Lash', wu: 1300, rec: 900, p: 0.4, b: 12, el: 'poison', range: 8, w: 2, make: (F, spec, L, t) => ({ stamps: [shCone(L.x, L.z, Math.atan2(t.x - L.x, t.z - L.z), 8, 90)] }) },
      // EG-PERFECT: on a chain drawn at random - a member's to its mate, or the odd member's to its Wraith (it took the first chain alone)
      { nm: 'Soul Rend', wu: 1500, rec: 900, p: 0.45, b: 12, el: 'poison', range: 99, w: 2, when: (F) => chainLinks(F).length > 0, make: (F, spec, L, t, here, rng) => {
        const links = chainLinks(F), c = links[Math.floor(rng() * links.length)];
        const a = typeof c[0] === 'string' ? here.find((m) => m.sub === c[0]) : egBodyById(F, c[0]), b = here.find((m) => m.sub === c[1]);
        return a && b ? { stamps: [shDisc((a.x + b.x) / 2, (a.z + b.z) / 2, 4)] } : null;
      } },
    ],
    // EG-PERFECT (section 13.2): the Chaining her SECOND phase's, called at the turn, the third phase's line held while its first
    // chains stand (it ran from her wake, and her second phase added nothing)
    phase(F, spec, L, ph, now, here, rng, out, ctx) { if (ph === 2) KITS.morvayn.sig(F, spec, L, now, out, ctx, true); if (ph === 3) F.mem.ritesAt = now + 5000; },
    sig(F, spec, L, now, out, ctx, hold) { F.mem.chainAt = now; if (sigHolds(L, hold)) { F.mem.chainHold = 1; L.hold = PHASE_AT[1]; L.hpFloor = egHoldHp(L.max, L.hold); } },
    tick(F, spec, L, now, here, rng, out, ctx) {
      // THE CHAINING: pairs bound for 20 s - stretched past 8 m, both take 30% (a CHECK); an odd member to a Wraith. AUDIT EG IV
      // (lane1 #10): chains of three are the Last Rites' - Morvayn's own third phase, never Garoth's borrowed Chaining
      if (now >= (F.mem.chainAt ?? Infinity)) {
        F.mem.chainAt = now + 35_000; F.mem.chainUntil = now + 20_000;
        const size = L.key === 'morvayn' && L.ph >= 3 ? 3 : 2, order = [...here].sort(() => rng() - 0.5), chains = [];
        while (order.length >= size) chains.push(order.splice(0, size).map((m) => m.sub));
        F.tethers = F.tethers.filter((t) => t[2] !== 2);
        for (const c of chains) for (let j = 1; j < c.length; j++) F.tethers.push([c[0], c[j], 2, 800]);
        for (const odd of order) { const [w] = egLegionSummon(F, [EG_KIND.wraith], [[odd.x + 3, odd.z]], now, out, { need: 1 }); if (w) F.tethers.push([w.i, odd.sub, 2, 800]); }
        F.mem.chains = chains; F.mem.snaps = {};
        for (const c of chains) for (const s of c) egMark(F, s, 4, now + 20_000);
        F.mem.txDirty = 1; F.mem.mkDirty = 1;
        say(out, 'chaining');
      }
      if (F.mem.chainUntil && now >= F.mem.chainUntil) {
        F.tethers = F.tethers.filter((t) => t[2] !== 2); F.mem.chains = []; F.mem.chainUntil = 0; F.mem.txDirty = 1; for (const m of here) egUnmark(F, m.sub, 4); F.mem.mkDirty = 1;
        if (F.mem.chainHold) { F.mem.chainHold = 0; L.hpFloor = null; L.hold = undefined; }   // EG-PERFECT: the first chains done, her held line freed
      }
      // AUDIT EG V (lane1 #15; section 13.4, "A pair stretched past 8 m both take 30%"): each link of a chain keeps ITS OWN clock
      // (`F.mem.snaps`, by the link's pair) - one pair held stretched never keeps another from its CHECK
      for (const c of F.mem.chains ?? []) {
        const ms = c.map((s) => here.find((m) => m.sub === s)).filter(Boolean);
        for (let j = 1; j < ms.length; j++) if (dist(ms[0].x, ms[0].z, ms[j].x, ms[j].z) > 8 && now >= ((F.mem.snaps ??= {})[`${ms[0].sub}|${ms[j].sub}`] ?? 0)) {
          F.mem.snaps[`${ms[0].sub}|${ms[j].sub}`] = now + 3000;
          // AUDIT EG IV (lane1 #5): the snap lands on the PAIR it names (`on`), wherever they run - its discs only mark them
          egAim(F, spec, { o: L.i, s: [shDisc(ms[0].x, ms[0].z, 2), shDisc(ms[j].x, ms[j].z, 2)], at: now + 400, wu: 400, p: 0.3, b: 0, el: elOf(L, 'poison'), nm: EG_SNAP_NM, ch: 1, on: [ms[0].sub, ms[j].sub] }, [], now, out);
        }
      }
      // EG-PERFECT (section 13.4, "An odd member, or a member alone, is chained to a Wraith; kill it to break the chain"): a Wraith's
      // chain is a chain - stretched past 8 m, it snaps on its member as a pair's does (it bound nothing before: a company of one's
      // Chaining was a Wraith and no more)
      for (const t of F.tethers.filter((x) => x[2] === 2 && typeof x[0] !== 'string')) {
        const w = egBodyById(F, t[0]), m = here.find((x) => x.sub === t[1]), key = `w${t[0]}|${t[1]}`;
        if (!w || !(w.hp > 0) || !m || dist(w.x, w.z, m.x, m.z) <= 8 || now < ((F.mem.snaps ??= {})[key] ?? 0)) continue;
        F.mem.snaps[key] = now + 3000;
        egAim(F, spec, { o: L.i, s: [shDisc(m.x, m.z, 2)], at: now + 400, wu: 400, p: 0.3, b: 0, el: elOf(L, 'poison'), nm: EG_SNAP_NM, ch: 1, on: [m.sub] }, [], now, out);
      }
      if (L.ph >= 3 && now >= (F.mem.ritesAt ?? Infinity)) { F.mem.ritesAt = now + 20_000; egLegionSummon(F, [EG_KIND.wraith, EG_KIND.wraith], (spec.spots.court ?? []).map((c) => [c.x, c.z]), now, out); }
    },
  },

  // ── THE MOTHER OF DUSK: a fight about the air ──
  dusk: {
    blows: [
      { nm: 'Dusk Dive', wu: 1300, rec: 1400, p: 0.4, b: 12, el: 'frost', range: 99, w: 3, when: (F, L, t, here, ctx) => true, make: (F, spec, L, t) => ({ stamps: [laneTo(L, t, 16, 4)] }) },
      { ...HELLFIRE, el: ATTACKS.hellfire.el, range: 99, make: (F, spec, L, t, here, rng) => ({ stamps: pickSome(t, here, ATTACKS.hellfire.max, rng).map((m) => shDisc(m.x, m.z, ATTACKS.hellfire.r)) }) },   // EG-PERFECT: its marks drawn (pickSome)   // AUDIT EG IV (lane1 #16): the gate's row, its burning ground with it
    ],
    wake(F, spec, L, now, out) { for (const [ax, az, y] of spotsOr(spec, L, 'anchor', 3, 20)) obj(F, 'anchor', ax, az, egHpTeam(F, 6), now, out, { r: 0.9, y }); F.mem.gutterAt = now + 30_000; },
    phase(F, spec, L, ph, now) { if (ph === 2) F.mem.gustAt = now + 4000; },
    tick(F, spec, L, now, here, rng, out) {
      const f = mainDisc(spec, L);
      // she circles over the glade, out of a blade's reach, until her anchors are broken
      if (egHas(L, EG_FL.fly) && !egHas(L, EG_FL.grounded) && !L.atk) { const t = now / 4000; walkAir(F, egFightView(spec), L, f.x + Math.sin(t) * (f.r - 4), f.z + Math.cos(t) * (f.r - 4), 0.5, 6, now); }
      // AUDIT EG III: dragged down only by her anchors BROKEN - once a grounding: its end arms the anchors' rising (20 s on, 40 s
      // in the Moonfall) and she keeps the air until they stand again and are broken again
      if (!egObjsOf(F, 'anchor').length && !egHas(L, EG_FL.grounded) && !F.mem.groundedUntil && !F.mem.anchorsBackAt) {
        F.mem.groundedUntil = now + 30_000; L.groundedUntil = now + 30_000;
        egSetFl(F, L, EG_FL.grounded, true, out);
        kitPlace(F, L, f.x, f.z, now);
        say(out, 'grounded');
      }
      if (F.mem.groundedUntil && now >= F.mem.groundedUntil) {
        F.mem.groundedUntil = 0; egSetFl(F, L, EG_FL.grounded, false, out);
        F.mem.anchorsBackAt = now + (L.ph >= 3 ? 40_000 : 20_000);
      }
      if (F.mem.anchorsBackAt && now >= F.mem.anchorsBackAt) {
        F.mem.anchorsBackAt = 0;
        for (const [ax, az, y] of spotsOr(spec, L, 'anchor', 3, 20)) { obj(F, 'anchor', ax, az, egHpTeam(F, 6), now, out, { r: 0.9, y }); if (L.ph >= 3) egLegionSummon(F, [EG_KIND.diver, EG_KIND.diver], [Number.isFinite(y) ? [ax, az, y] : [ax, az]], now, out); }
        say(out, 'anchors');
      }
      // Wingbeat: a glade-wide gust every 8 s, told 1 s - 3 m/s for 1 s
      if (L.ph >= 2 && now >= (F.mem.gustAt ?? Infinity)) { F.mem.gustAt = now + 8000; const a = rng() * Math.PI * 2; out.push({ k: 'egust', at: now + 1000, dx: r2(Math.sin(a)), dz: r2(Math.cos(a)), v: 3, ms: 1000 }); }
      // Gutterdark: the braziers gutter in turn
      if (now >= (F.mem.gutterAt ?? Infinity)) { F.mem.gutterAt = now + 30_000; out.push({ k: 'edark', until: now + 10_000 }); }
    },
  },

  // ── THE NIGHT-STALKER: a fight about distance ──
  stalker: {
    blows: [
      { nm: 'Shadow Strike', wu: 1300, rec: 900, p: 0.4, b: 12, range: 6, w: 3, make: (F, spec, L, t) => ({ stamps: [shCone(L.x, L.z, Math.atan2(t.x - L.x, t.z - L.z), 6, 110)] }) },
      { nm: 'Night Lunge', wu: 1200, rec: 1000, p: 0.4, b: 12, range: 12, minGap: 3, w: 2, run: 1, make: (F, spec, L, t) => { const yaw = Math.atan2(t.x - L.x, t.z - L.z); return { stamps: [shLaneAt(L.x, L.z, yaw, 12, 4)], to: egKeepOnFight(spec, L.x + Math.sin(yaw) * 10, L.z + Math.cos(yaw) * 10, L.r, L.y) }; } },
    ],
    wake(F, spec, L, now) { F.mem.vanishAt = now + 12_000; F.mem.tetherAt = now + 20_000; },
    tick(F, spec, L, now, here, rng, out, ctx) {
      const f = mainDisc(spec, L);
      // he vanishes: where he stands is an umbral disc on the floor (three in phase 2 - the true one glints). AUDIT EG V (lane1
      // #12; section 13.2, "Tells only the engine can give"): nothing on the wire tells the true disc before its glint - every
      // umbra alike (no `pt`; `real` the relay's own), and his row stays where he vanished until he rises at the true one; its
      // glint said EG_UMBRA_GLINT_MS before he rises (`eob` 1 on the true disc, its WIND on every screen)
      if (now >= (F.mem.vanishAt ?? Infinity)) {
        F.mem.vanishAt = now + 25_000; F.mem.reappearAt = now + EG_UMBRA_MS; F.mem.glintAt = now + EG_UMBRA_MS - EG_UMBRA_GLINT_MS;
        egSetFl(F, L, EG_FL.hidden, true, out);
        egStop(F, L, now); L.atk = null;   // EG-PERFECT (bug 7): no run carries him off after he rises at the true umbra
        const spots = [egKeepOnFight(spec, f.x + (rng() - 0.5) * f.r, f.z + (rng() - 0.5) * f.r, 3, f.y)];
        if (L.ph >= 2) for (let k = 0; k < 2; k++) spots.push(egKeepOnFight(spec, f.x + (rng() - 0.5) * f.r, f.z + (rng() - 0.5) * f.r, 3, f.y));
        const trueAt = Math.floor(rng() * spots.length);
        spots.forEach((p, j) => obj(F, 'umbra', p[0], p[1], 0, now, out, { r: 2, extra: { real: j === trueAt ? 1 : 0 }, y: p[2] }));
        F.mem.riseAt = spots[trueAt];
        say(out, 'vanish');
      }
      if (F.mem.glintAt && now >= F.mem.glintAt) { F.mem.glintAt = 0; const u = egObjsOf(F, 'umbra').find((o) => o.real); if (u) egObSay(u, 1, now, out); }
      if (F.mem.reappearAt && now >= F.mem.reappearAt) {
        F.mem.reappearAt = 0;
        if (F.mem.riseAt) { kitPlace(F, L, F.mem.riseAt[0], F.mem.riseAt[1], now); F.mem.riseAt = null; }
        egSetFl(F, L, EG_FL.hidden, false, out);
        egGone(F, egObjsOf(F, 'umbra'), EG_GONE.crumbled, '', now, out);
        lordBlow(F, spec, L, [shDisc(L.x, L.z, 5)], { nm: 'Umbral Rising', wu: 1100, p: 0.4, b: 10, el: null }, here, now, out);
      }
      // BLOOD TETHER: two members (three in the Blood Moon), broken by standing 14 m apart (16) for 2 s; it heals him
      if (now >= (F.mem.tetherAt ?? Infinity)) {
        F.mem.tetherAt = now + 30_000;
        F.tethers = F.tethers.filter((t) => t[2] !== 1);
        const brk = L.ph >= 3 ? 16 : 14;
        if (ctx.n >= 2) { const picks = [...here].sort(() => rng() - 0.5).slice(0, L.ph >= 3 ? 3 : 2); for (let j = 1; j < picks.length; j++) F.tethers.push([picks[0].sub, picks[j].sub, 1, brk * 100]); }
        else if (here[0]) { const [th] = egLegionSummon(F, [EG_KIND.thrall], [[here[0].x + 4, here[0].z]], now, out, { need: 1 }); if (th) F.tethers.push([th.i, here[0].sub, 1, brk * 100]); }
        F.mem.txDirty = 1; F.mem.apart = {}; F.mem.tetherUntil = now + 20_000;
        say(out, 'tether');
      }
      if (F.mem.tetherUntil && now >= F.mem.tetherUntil) { F.mem.tetherUntil = 0; F.tethers = F.tethers.filter((x) => x[2] !== 1); F.mem.txDirty = 1; }
      for (const t of F.tethers.filter((x) => x[2] === 1)) {
        const a = typeof t[0] === 'string' ? here.find((m) => m.sub === t[0]) : egBodyById(F, t[0]), b = here.find((m) => m.sub === t[1]);
        if (!a || !b) { F.tethers = F.tethers.filter((x) => x !== t); F.mem.txDirty = 1; continue; }
        const key = `${t[0]}|${t[1]}`;
        if (dist(a.x, a.z, b.x, b.z) >= t[3] / 100) { F.mem.apart ??= {}; F.mem.apart[key] ??= now; if (now - F.mem.apart[key] >= 2000) { F.tethers = F.tethers.filter((x) => x !== t); F.mem.txDirty = 1; say(out, 'tetherbroken'); } }
        else { if (F.mem.apart) delete F.mem.apart[key]; L.hp = Math.min(L.max, L.hp + L.max * 0.000375); }   // 0.15% of his health a second, a tether
      }
    },
  },

  // ── VALKYNAZ SEYTH OF THE SHADE: the Mirrorcourt ──
  seyth: {
    blows: [
      ...gateKit(),
      { nm: 'Frost Lance', wu: 1200, rec: 900, p: 0.4, b: 12, el: 'frost', range: 18, w: 2, make: (F, spec, L, t) => ({ stamps: [laneTo(L, t, 18, 4)] }) },
      { nm: 'Moonshatter', wu: 1400, rec: 900, p: 0.35, b: 10, el: 'frost', range: 99, w: 2, make: (F, spec, L, t, here, rng) => ({ stamps: pickSome(t, here, 3, rng).map((m) => shDisc(m.x, m.z, 2.5)) }) },   // EG-PERFECT: its marks drawn (pickSome)
    ],
    // the Eclipse is the Vault's own - from her wake. EG-PERFECT (section 13.2): the Mirrorcourt her SECOND phase's, called at the
    // turn, the third phase's line held until its first two mirrors are shattered
    wake(F, spec, L, now, out) { F.mem.eclipseAt = now + 20_000; },
    phase(F, spec, L, ph, now, here, rng, out, ctx) { if (ph === 2) KITS.seyth.sig(F, spec, L, now, out, ctx, true); if (ph === 3) out.push({ k: 'edark', until: now + EG_ZONE_FIGHT_MS }); },   // AUDIT EG V (lane1 #17): the Long Night to the fight's end
    sig(F, spec, L, now, out, ctx, hold) { F.mem.mirrorsAt = now; if (sigHolds(L, hold)) { F.mem.mirrorHold = 2; L.hold = PHASE_AT[1]; L.hpFloor = egHoldHp(L.max, L.hold); } },
    /** A mirror shattered (`L` the mirror): the next returns 20 s on; the first round's two shattered free its lord's held line. */
    mirrorDown(F, L, now) {
      F.mem.mirrorsAt = now + 20_000;
      if (F.mem.mirrorHold > 0 && --F.mem.mirrorHold === 0) { const lord = egBodyById(F, L.by); if (lord) { lord.hpFloor = null; lord.hold = undefined; } }
    },
    tick(F, spec, L, now, here, rng, out) {
      // AUDIT EG IV (lane1 #10): THE ECLIPSE is the Eclipse Vault's - Seyth's own ground's; Garoth borrows the Mirrorcourt alone
      const f = mainDisc(spec, L), S = L.key === 'seyth' ? spec.spots.shafts?.[0] ?? { x: f.x, z: f.z, r: Math.min(12, f.r - 4) } : null;
      if (S) F.pg.shafts = moonShafts(S, now);
      // THE ECLIPSE: every 40 s everyone outside the moon-shafts takes 30% (a CHECK; havens from 6 s out)
      if (S && now >= (F.mem.eclipseAt ?? Infinity)) {
        F.mem.eclipseAt = now + 40_000;
        const landAt = now + 6000, havens = moonShafts(S, landAt).map(([x, z]) => [x, z, 3]);
        egAim(F, spec, { o: L.i, s: [shOut(havens)], at: landAt, wu: 6000, p: 0.3, b: 0, el: elOf(L, 'frost'), nm: EG_ECLIPSE_NM, ch: 1 }, [], now, out);
        say(out, 'eclipse');
      }
      // THE MIRRORCOURT: two mirror lords beside him throw real blows at half share; each shatters after 8 s of the
      // company's reference damage and returns 20 s later
      if (now >= (F.mem.mirrorsAt ?? Infinity) && mirrorsOf(F, L).length < 2) {
        F.mem.mirrorsAt = Infinity;
        for (let k = mirrorsOf(F, L).length; k < 2; k++) {
          const a = rng() * Math.PI * 2, [x, z, y] = egKeepOnFight(spec, f.x + Math.sin(a) * 10, f.z + Math.cos(a) * 10, 2, f.y);
          const mi = stand(F, spec, L.key, x, z, egHpTeam(F, 8), now, out, { pt: 1 + k, fl: EG_FL.mirror, y });   // AUDIT EG IV (lane1 #10): the true lord's mirrors - his look, his name, his kit (Garoth's under Garoth)
          if (mi) { mi.up2 = true; mi.nextAt = now + 2000; mi.shareX = 0.5; mi.by = L.i; mi.asp = L.asp; }
        }
        say(out, 'mirrors');
      }
    },
  },

  // ── THE BOUND COLOSSUS: a fight you climb ──
  colossus: {
    blows: [
      { nm: 'Stamp', wu: 1400, rec: 900, p: 0.45, b: 12, range: 99, w: 3, make: (F, spec, L) => ({ stamps: [shLaneAt(L.x, L.z, L.dir ?? 0, 12, 4)] }) },
      { nm: 'Chain Lightning', wu: 1200, rec: 900, p: 0.35, b: 10, el: 'shock', range: 99, w: 2, make: (F, spec, L, t, here) => {
        const next = here.filter((m) => m !== t && dist(m.x, m.z, t.x, t.z) <= 6).sort((a, b) => dist(a.x, a.z, t.x, t.z) - dist(b.x, b.z, t.x, t.z))[0];
        return { stamps: [shDisc(t.x, t.z, 2.5)], extra: next ? [{ stamps: [shDisc(next.x, next.z, 2.5)], delay: 600, B: {} }] : [] };
      } },
    ],
    wake(F, spec, L, now, out, ctx) {
      const R = spec.spots.route?.[0];
      F.mem.route = R ? [R.z, R.z1] : [L.z, L.z + 30]; L.dir = 0;
      const k = 4 + 2 * Math.floor(ctx.n / 3);
      for (let j = 0; j < k; j++) obj(F, 'heart', L.x, L.z, egHpTeam(F, 3), now, out, { r: 0.7, pt: Math.floor(j / 2) + 1, extra: { off: [((j % 2) ? 1 : -1) * 2.5, (Math.floor(j / 2) - (k / 4)) * 1.5], pair: Math.floor(j / 2) }, y: egFeetY(spec, L.y) });
      F.mem.overloadAt = now + 75_000; F.mem.railAt = now + 15_000;
    },
    phase(F, spec, L, ph, now, here, rng, out) { if (ph === 3) { L.kneelUntil = now + 20_000; egStun(F, L, 20_000, now, out); } },
    tick(F, spec, L, now, here, rng, out, ctx) {
      // AUDIT EG III - THE BREAKDOWN'S END: its kneel done, it walks HALF ITS ROUTE - the half it knelt in, from that end to the
      // forge's middle
      if (L.kneelUntil && now >= L.kneelUntil && !F.mem.halfRoute) {
        const [a, b] = F.mem.route, mid = r2((a + b) / 2);
        F.mem.route = Math.abs(L.z - a) <= Math.abs(L.z - b) ? [a, mid] : [mid, b]; F.mem.halfRoute = 1;
      }
      // it walks its fixed route down the forge, its hearts riding its back
      const [z0, z1] = F.mem.route;
      if (!(L.stunUntil > now) && !L.atk) { const goal = (L.dir ?? 0) === 0 ? z1 : z0; if (Math.abs(L.z - goal) < 1) L.dir = (L.dir ?? 0) === 0 ? Math.PI : 0; lordWalk(F, spec, L, L.x, (L.dir ?? 0) === 0 ? z1 : z0, 0.5, 1.6, now); }
      for (const h of egObjsOf(F, 'heart')) { h.x = r2(L.x + h.off[0]); h.z = r2(L.z + h.off[1]); }
      // the Rails rise along its flank every 15 s (8 s up) - the hearts are struck only from them
      if (now >= F.mem.railAt) { F.mem.railAt = now + 15_000; F.mem.railUntil = now + 8000; out.push({ k: 'erail', until: now + 8000 }); }
      for (const h of egObjsOf(F, 'heart')) egSetFl(F, h, EG_FL.ward, !(now < (F.mem.railUntil ?? 0)), out);
      // Paired Hearts: a pair broken more than 5 s apart relights
      if (L.ph >= 2) for (const [pair, at] of Object.entries(F.mem.pairBroke ?? {})) if (now - at > 5000) { const mate = egObjsOf(F, 'heart').find((h) => h.pair === Number(pair)); if (mate) { obj(F, 'heart', L.x, L.z, egHpTeam(F, 3), now, out, { r: 0.7, pt: mate.pt, extra: { off: [-mate.off[0], mate.off[1]], pair: mate.pair }, y: egFeetY(spec, L.y) }); say(out, 'relit'); } delete F.mem.pairBroke[pair]; }
      // THE OVERLOAD: every 75 s, 70% to all (a CHECK) - unless every heart is broken first, which stuns it
      if (now >= F.mem.overloadAt) {
        F.mem.overloadAt = now + 75_000;
        if (!egObjsOf(F, 'heart').length) { egStun(F, L, 8000, now, out); const k = 4 + 2 * Math.floor(ctx.n / 3); for (let j = 0; j < k; j++) obj(F, 'heart', L.x, L.z, egHpTeam(F, 3), now + 8000, out, { r: 0.7, pt: Math.floor(j / 2) + 1, extra: { off: [((j % 2) ? 1 : -1) * 2.5, (Math.floor(j / 2) - (k / 4)) * 1.5], pair: Math.floor(j / 2) }, y: egFeetY(spec, L.y) }); }
        else egAim(F, spec, { o: L.i, s: [shAll()], at: now + 4000, wu: 4000, p: 0.7, b: 0, el: elOf(L, 'shock'), nm: 'Overload', ch: 1 }, [], now, out);
      }
    },
  },

  // ── THE WELLHEAD WYRM: a fight for every build ──
  wyrm: {
    blows: [
      // EG-PERFECT (the audit: perched 30 m out, its 16 m lane reached its mark in 37 Breaths of 108): from a perch it breathes as
      // far as its mark and 6 m past, up to EG_WYRM_REACH_M - its width, so its floor, unchanged
      { nm: 'Breath', wu: 1400, rec: 900, p: 0.45, b: 12, el: 'fire', range: 99, w: 3, make: (F, spec, L, t) => ({ stamps: [laneTo(L, t, egHas(L, EG_FL.fly) && !egHas(L, EG_FL.grounded) ? Math.min(EG_WYRM_REACH_M, Math.max(16, dist(L.x, L.z, t.x, t.z) + 6)) : 16, 4)] }) },
      { nm: 'Searing Breath', wu: 1500, rec: 1000, p: 0.45, b: 12, el: 'fire', range: 12, w: 2, make: (F, spec, L, t) => (L.ph >= 3 ? { stamps: [shCone(L.x, L.z, Math.atan2(t.x - L.x, t.z - L.z), 12, 180)], B: { wu: 1600 } } : { stamps: [shCone(L.x, L.z, Math.atan2(t.x - L.x, t.z - L.z), 10, 90)] }) },
      { nm: 'Meteor', wu: 1800, rec: 700, p: 0.5, b: 12, el: 'fire', range: 99, w: 2, when: (F, L) => egHas(L, EG_FL.fly), make: (F, spec, L, t, here, rng) => ({ stamps: pickSome(t, here, 3, rng).map((m) => shDisc(m.x, m.z, 4)) }) },   // EG-PERFECT: its marks drawn (pickSome)
    ],
    wake(F, spec, L, now, out) { for (const [px, pz, y] of spotsOr(spec, L, 'pillar', 3, 18)) obj(F, 'pillar', px, pz, egHpTeam(F, 6), now, out, { r: 1.5, y }); perch(F, spec, L, now, out); },
    phase(F, spec, L, ph, now, here, rng, out) {
      // EG-PERFECT (section 13.3, Burning Perches): the perches broken before its second phase RISE AGAIN, molten, at its turn - so
      // the phase has perches to burn (a company that broke all three in the first had no Burning Perches, no flight and no Meteor)
      // (THE AUDIT: a burst past both lines turns its third at once - grounded for good, it raises none; and grounded for good
      // in its first, it takes flight again from the perches risen - its landing's run out at once)
      if (ph === 2 && L.hp / L.max > PHASE_AT[1]) {
        const have = egObjsOf(F, 'pillar');
        let k = 0;
        for (const [px, pz, y] of spotsOr(spec, L, 'pillar', 3, 18)) if (!have.some((p) => dist(p.x, p.z, px, pz) < 1)) { obj(F, 'pillar', px, pz, egHpTeam(F, 6), now, out, { r: 1.5, y }); k++; }
        if (k) say(out, 'perches');
        if (k && egHas(L, EG_FL.grounded) && !L.groundedUntil) L.groundedUntil = now;
      }
      if (ph === 3) { egSetFl(F, L, EG_FL.fly, false, out); egSetFl(F, L, EG_FL.grounded, true, out); const f = mainDisc(spec, L); kitPlace(F, L, f.x, f.z, now); }
    },
    tick(F, spec, L, now, here, rng, out) {
      if (L.ph >= 3) return;
      // AUDIT EG III: a landing's 25 s run out FIRST - it takes flight to a standing pillar, or, none left standing, stays down
      // (one landing, said once)
      if (L.groundedUntil && now >= L.groundedUntil) { L.groundedUntil = 0; if (egObjsOf(F, 'pillar').length) { egSetFl(F, L, EG_FL.grounded, false, out); perch(F, spec, L, now, out); } }
      // its perch broken (the pillar it leaves erupting in Burning Perches - egObjBroken), it lands, x1.3, for 25 s
      if (!egHas(L, EG_FL.grounded) && !egObjsOf(F, 'pillar').some((p) => p.i === L.perch)) {
        L.groundedUntil = now + 25_000; egSetFl(F, L, EG_FL.grounded, true, out); egSetFl(F, L, EG_FL.fly, false, out);
        const f = mainDisc(spec, L); kitPlace(F, L, f.x, f.z, now);
        say(out, 'landed');
      }
    },
  },

  // ── VALKYNAZ GAROTH OF THE WELLHEAD: the Clan Muster ──
  garoth: {
    blows: [
      ...gateKit(),
      // EG-PERFECT (the lords' audit: "aim Wellfire at the target rather than along the axes"): its cross laid over its mark, one arm
      // along his bearing to it - the axes' cross about himself struck a member who had only to stand off them
      { nm: 'Wellfire', wu: 1400, rec: 1000, p: 0.4, b: 12, el: 'fire', range: 99, w: 2, make: (F, spec, L, t) => { const a = Math.atan2(t.x - L.x, t.z - L.z), b = a + Math.PI / 2; return { stamps: [shLaneAt(t.x - 12 * Math.sin(a), t.z - 12 * Math.cos(a), a, 24, 4), shLaneAt(t.x - 12 * Math.sin(b), t.z - 12 * Math.cos(b), b, 24, 4)] }; } },
      { nm: "The Kyn's Due", wu: 1600, rec: 900, p: 0.5, b: 14, range: 99, w: 2, duelNo: 1, make: (F, spec, L, t, here) => { let top = t, v = -1; for (const m of here) if ((L.threat[m.sub] ?? 0) > v) { v = L.threat[m.sub] ?? 0; top = m; } return { stamps: [shDisc(top.x, top.z, 5)] }; } },
    ],
    wake(F, spec, L, now) { L.duelAt = Infinity; F.mem.garothSig = egGarothSig(F.c); },
    phase(F, spec, L, ph, now, here, rng, out, ctx) {
      // THE CLAN MUSTER: each phase turn calls an honour duel (the Armsmaster's ring law; none at n = 1). AUDIT EG IV (lane1 #21;
      // section 13.2's signature errand): called AT the turn, inside its ward, and the next threshold held until the duel ends -
      // the third phase's next is his fall
      if (ctx.n >= 2) { L.duelAt = now; L.hold = ph >= 3 ? 0 : PHASE_AT[1]; if (L.hp / L.max > L.hold) L.hpFloor = egHoldHp(L.max, L.hold); }   // EG-PERFECT: never a floor over the health it has
      // AUDIT EG IV (lane9 #16): the third phase's card names the older signature it borrows
      if (ph === 3) KITS[F.mem.garothSig]?.sig?.(F, spec, L, now, out, ctx, false);   // its card the borrowed signature's (egLordPhase) - EG-PERFECT: called as the Valkynaz call theirs (`sig`), his duel the hold
    },
    // AUDIT EG IV (lane1 #10): his borrowed Mirrorcourt's mirrors are his, and return as Seyth's do
    mirrorDown(F, L, now, out) { KITS[F.mem.garothSig]?.mirrorDown?.(F, L, now, out); },
    hit(F, spec, L, sub, got, pose, now, here, out) { duelHit(F, L, sub, got, now, out); },
    tick(F, spec, L, now, here, rng, out, ctx) {
      challengeTick(F, spec, L, now, here, rng, out, ctx, 15_000, true);
      if (L.ph >= 3) KITS[F.mem.garothSig]?.tick?.(F, spec, L, now, here, rng, out, ctx);
    },
  },
};

// ── the signatures' helpers ──────────────────────────────────────────────────────────────────────────────
/** AUDIT EG IV (lane1 #7): a zone that stands "to the fight's end" (the Last Lesson's last ring) - an hour, past any Court the
 *  count and the last word allow. */
export const EG_ZONE_FIGHT_MS = 3_600_000;
/** THE LAST LESSON's last ring on a court of its own (section 13.3: "to r 12") - a court no wider has nothing to close (m). */
export const EG_LESSON_LAST_R = 12;
/** EG-PERFECT: how long each step of the Last Lesson's ring is told before it burns (ms - a metre at the escape build is 0.14 s). */
export const EG_LESSON_TELL_MS = 1500;
/** A zone on the floor (`ez`): 'burn' (a pool - its share a tick), 'void' (the floor gone - a cast-back), 'soul' (a
 *  Soul-Pool), 'haven' - over `s` from `from` to `until`. The fight keeps its last few; AUDIT EG V (h): one standing to the
 *  fight's end (`o.whole`) is kept by egZonesKeep. */
export function zoneOut(F, kind, s, from, until, out, o = {}) {
  const z = { i: ++F.bl, kind, s, from, until, p: o.p ?? 0, b: o.b ?? 0, el: o.el ?? null };
  if (Number.isFinite(o.y) && egByHeight(F.view)) z.y = r2(o.y);   // THE ASCENT (Elite-Gates-Ascent.md section 2): the floor it lies on
  (F.zones ??= []).push(z);
  F.zones = F.zones.filter((q) => q.until > from - 1000).slice(-24);
  if (o.whole) (F.keep ??= []).push({ i: z.i, src: z.i, kind, s, from, until, p: z.p, b: z.b, el: z.el, ...(z.y != null ? { y: z.y } : {}) });   // EG-PERFECT: `src` the zone it keeps, whatever number it is zoned again under
  out.push({ k: 'ez', ...z });
  return z;
}
/** EG-PERFECT: a zone ended now (a banner broken under its claimed third) - its keep's too, under whatever number egZonesKeep zoned
 *  it again (`src`), said to every screen. */
function zoneEnd(F, z, now, out) {
  const src = (F.keep ?? []).find((q) => q.src === z.i || q.i === z.i)?.src ?? z.i;
  for (const q of F.keep ?? []) if (q.src === src) { const live = (F.zones ?? []).find((x) => x.i === q.i); q.until = now; if (live && live !== z) { live.until = now; out.push({ k: 'ez', ...live }); } }
  z.until = now; out.push({ k: 'ez', ...z });
}
/**
 * AUDIT EG V (h; F's NEW-1 and NEW-3 - sections 13.3 and 18) - THE ZONES THAT STAND THE WHOLE FIGHT, KEPT: each zone laid to the
 * fight's end (zoneOut's `whole` - the Molten Rim's magma and causeways, the Last Lesson's last ring, Both Courts Burn's thirds)
 * zoned again, from `now` to its own end, whenever the fight's newest zones have pushed it out of the few zoneOut keeps - so
 * it stands on the relay's union floor and is said again to every screen (whose list keeps a few more) before theirs lets it
 * go. One keep for every such zone, stepped each beat of a Court (net/eliteGates/egBrain.js); the Molten Rim's alone was kept before, and
 * a long third phase pushed the Lesson's last ring out.
 * @param {any} F @param {number} now @param {any[]} out
 */
export function egZonesKeep(F, now, out) {
  for (const q of F.keep ?? []) if (q.until > now && !(F.zones ?? []).some((z) => z.i === q.i)) q.i = zoneOut(F, q.kind, q.s, Math.max(now, q.from), q.until, out, q).i;
}
const segHit = (s, x, z) => { const dx = s[3] - s[1], dz = s[4] - s[2], L = dx * dx + dz * dz, t = L > 0 ? Math.max(0, Math.min(1, ((x - s[1]) * dx + (z - s[2]) * dz) / L)) : 0; return Math.hypot(x - (s[1] + dx * t), z - (s[2] + dz * t)) <= s[5] / 2; };
/** EG-PERFECT (section 13.2): does a Valkynaz's signature called at its turn HOLD the next line - its own (`hold`), and only while
 *  its health still stands above that line (a burst already past it is never healed back up to it). */
const sigHolds = (L, hold) => !!hold && L.hp / L.max > PHASE_AT[1];
/** EG-PERFECT: the soul-chains standing as links `[a, sub]` - each chain's first member and a mate, and each odd member's Wraith
 *  (`a` its body's number) - for Soul Rend's midpoint. */
const chainLinks = (F) => [...(F.mem.chains ?? []).flatMap((c) => c.slice(1).map((s) => [c[0], s])), ...(F.tethers ?? []).filter((t) => t[2] === 2 && typeof t[0] !== 'string').map((t) => [t[0], t[1]])];
/** EG-PERFECT: the Wyrm's breath from a perch reaches this far at most (m). THE AUDIT: a law 10 Wyrm's perch stands 30 m off its
 *  court's heart, its far rim 52 m off (seed 1's hall 85) - at 40 m a quarter of its court lay past every Breath. */
export const EG_WYRM_REACH_M = 64;
/** EG-PERFECT: a Crossing the union floor dropped is tried again this long on (ms). */
export const EG_CROSS_AGAIN_MS = 10_000;
/** Grath's island under a body (its object's number), or null. */
function islandOf(F, m) { const o = egObjsOf(F, 'isle').find((q) => q.st !== 2 && dist(q.x, q.z, m.x, m.z) <= 11.5); return o ? o.i : null; }
/** An island cracks: told 3.7 s (the wind-up floor's class), then falls for 15 s. */
function crack(F, isle, now, out) {
  const o = egBodyById(F, isle);
  if (!o || o.st) return;
  o.st = 1; o.stAt = now + 3700;
  egObSay(o, 1, now, out);
  // EG-PERFECT (section 13.2): its fall told AS IT CRACKS - a void from its fall, so THE UNION FLOOR sees the island go (a landing
  // at its onset, no ground after) from the crack's first word, never only once it has fallen
  zoneOut(F, 'void', shDisc(o.x, o.z, 11), o.stAt, o.stAt + 15_000, out, { y: o.y });
}
/** The Chaining's failure blow's name (a pair's snap, and EG-PERFECT's Wraith's). */
export const EG_SNAP_NM = 'The Chain Snaps';
/** EG-PERFECT: Seyth's Eclipse's name on the wire - the screens read her blow by it as the Vault's place hazard (world/eliteGates/
 *  egTelegraph.js egEclipseOfBlows). */
export const EG_ECLIPSE_NM = 'The Eclipse';
/** THE NIGHT-STALKER'S VANISHING (section 13.3): how long he stays hidden, and how long before he rises the true umbra glints
 *  (AUDIT EG V, lane1 #12 - its WIND, the tell only the engine gives). */
export const EG_UMBRA_MS = 6000;
export const EG_UMBRA_GLINT_MS = 2000;
/** The moon-shafts' places at `t` (section 11.2: r 3, walking a ring at a fixed 1.5 m/s). */
export function moonShafts(S, t) {
  const R = S.r ?? 12, w = 1.5 / R;
  return [0, 1, 2].map((k) => [r2(S.x + Math.sin((t / 1000) * w + (k * 2 * Math.PI) / 3) * R), r2(S.z + Math.cos((t / 1000) * w + (k * 2 * Math.PI) / 3) * R)]);
}
/** The Wyrm perches on a standing pillar. */
function perch(F, spec, L, now, out) {
  const pillars = egObjsOf(F, 'pillar');
  if (!pillars.length) return;
  const p = pillars[Math.floor((now / 1000) % pillars.length)];
  L.perch = p.i; egSetFl(F, L, EG_FL.fly, true, out); kitPlace(F, L, p.x, p.z, now);
}
/** THE EXAMINATION (the Spellmaster's phase 2): runes lit in an order, each stood on in turn within the window. */
function examination(F, spec, L, now, here, rng, out, ctx) {
  const n = Math.max(1, ctx.n), k = Math.min(4, Math.max(2, n));
  const f = mainDisc(spec, L);
  const spots = (n < k ? [45, 135, 225, 315].map((d) => egKeepOnFight(spec, f.x + Math.sin((d * Math.PI) / 180) * 8, f.z + Math.cos((d * Math.PI) / 180) * 8, 1, f.y)) : spotsOr(spec, L, 'rune', 4, Math.min(F.mem.runeR ?? Infinity, f.r - 1.5), !F.mem.runeR)).slice(0, k);   // AUDIT EG IV (section 18): THE MASTERS' GROUND's ring (net/eliteGates/egBrain.js EG_MASTERS_RUNE_R)
  const order = spots.map((_, j) => j).sort(() => rng() - 0.5);
  spots.forEach((p, j) => obj(F, 'rune', p[0], p[1], 0, now, out, { r: 1.6, pt: order.indexOf(j) + 1, y: p[2] }));
  // AUDIT EG V (h; B NEW-3 - THE ERRAND FLOOR): the window never under the errand floor of its route walked over the whole floor
  // (egRuneRouteM) - the 10 s keep it on a court of its own; on another lord's ground of many pieces it may need more
  const wMs = Math.max((10 + 4 * Math.max(0, k - n)) * 1000, egErrandMs(egRuneRouteM(spec, order.map((j) => spots[j]), n)));
  F.mem.exam = { kind: 'runes', next: 1, k, until: now + wMs };
  if (L.hp / L.max > PHASE_AT[1]) { L.hold = PHASE_AT[1]; L.hpFloor = egHoldHp(L.max, L.hold); }   // AUDIT EG IV (lane1 #2): strictly above the third phase's line, never at it - EG-PERFECT: and only while above it (a burst past both lines turns one a beat)
  say(out, 'examination');
}
/** THE FINAL EXAMINATION (phase 3): a member caged 8 s; the company breaks clamp(n-1, 1, 3) seals (n = 1: three within 6 m). */
function finalExam(F, spec, L, now, here, rng, out, ctx) {
  const n = Math.max(1, ctx.n);
  const bound = n >= 2 ? here[Math.floor(rng() * here.length)] : null;
  const seals = n >= 2 ? Math.max(1, Math.min(3, n - 1)) : 3;
  const c = bound ?? here[0] ?? { x: L.x, z: L.z };
  for (let j = 0; j < seals; j++) { const a = (j / seals) * Math.PI * 2; const [x, z, y] = egKeepOnFight(spec, c.x + Math.sin(a) * (n >= 2 ? 9 : 6), c.z + Math.cos(a) * (n >= 2 ? 9 : 6), 1, c.y ?? L.y); obj(F, 'seal', x, z, egHpTeam(F, 2.5, seals), now, out, { r: 0.8, y }); }
  if (bound) {
    egMark(F, bound.sub, 5, now + 8000); F.mem.mkDirty = 1;
    // (THE AUDIT: a blow already said over the bound - aimed before the cage held its feet - is cut as the cage closes; one not
    // yet said is held by THE UNION FLOOR, the cage its only ground - net/eliteGates/egBodies.js egUnionHeld)
    for (const b of [...F.blows]) if (!b.ch && b.at > now && egInBlow(b, bound.x, bound.z)) egCut(F, b.i, out, now);
  }
  F.mem.exam = { kind: 'seals', bound: bound?.sub ?? null, until: now + 8000 };
  say(out, 'cage');
}
/** The errands' beat: the runes stood in order, the seals broken - passed (a stun) or failed (a CHECK). */
function errandTick(F, spec, L, now, here, rng, out) {
  const E = F.mem.exam;
  if (!E) return;
  if (E.kind === 'runes') {
    const runes = egObjsOf(F, 'rune'), cur = runes.find((r) => r.pt === E.next);
    if (cur && !(cur.st & 1)) { cur.st = 1; egObSay(cur, 1, now, out); }
    if (cur && here.some((m) => dist(m.x, m.z, cur.x, cur.z) <= EG_RUNE_STAND_M)) { cur.st = 2; egObSay(cur, 2, now, out); E.next++; }
    if (E.next > E.k) { F.mem.exam = null; L.hpFloor = null; egGone(F, runes, EG_GONE.crumbled, '', now, out); egStun(F, L, STUN_MS, now, out); say(out, 'passed'); return; }
    if (now >= E.until) { F.mem.exam = null; L.hpFloor = null; egGone(F, runes, EG_GONE.crumbled, '', now, out); egAim(F, spec, { o: L.i, s: [shAll()], at: now + 2000, wu: 2000, p: 0.6, b: 0, el: elOf(L, 'shock'), nm: 'The Failed Examination', ch: 1 }, [], now, out); say(out, 'failed'); }
  } else {
    const seals = egObjsOf(F, 'seal');
    if (!seals.length) { F.mem.exam = null; F.mem.cageAt = now + EG_CAGE_AGAIN_MS; if (E.bound) egUnmark(F, E.bound, 5); F.mem.mkDirty = 1; say(out, 'passed'); return; }   // EG-PERFECT: and again
    if (now >= E.until) {
      F.mem.exam = null; F.mem.cageAt = now + EG_CAGE_AGAIN_MS; egGone(F, seals, EG_GONE.crumbled, '', now, out);
      const m = E.bound ? here.find((x) => x.sub === E.bound) : here[0];
      if (E.bound) egUnmark(F, E.bound, 5); F.mem.mkDirty = 1;
      if (m) egAim(F, spec, { o: L.i, s: [shDisc(m.x, m.z, 2)], at: now + 800, wu: 800, p: 0.7, b: 0, el: elOf(L, 'shock'), nm: 'The Cage Closes', ch: 1, on: [m.sub] }, [], now, out);   // AUDIT EG IV (lane1 #5): on the bound, freed from the cage or not
      say(out, 'failed');
    }
  }
}
/** FB1018D DUEL-RING (section 13.3, "n = 1: no ring and no braziers"): the word a Challenge met in the open adds to its
 *  `challenge` and its `challengeend` (`t`) - every screen says that duel, never a ring of fire that does not rise or fall
 *  (scenes/eliteGates/egFight.js EG_SAY). */
export const EG_DUEL_OPEN = 'open';
/** THE CHALLENGE (the Armsmaster's, Garoth's honour duel): a member marked, a ring of fire about the two; lasted 15 s or a
 *  tenth of his health dealt inside, or the company's braziers broken, and it ends.
 *  AUDIT EG V (lane1 #1; sections 13.2, 13.3 and 18) - A DUEL IS ITS LORD'S: each lord keeps its own clock (`L.duelAt`), and the
 *  ring standing (`F.mem.challenge`) is owned by the lord that called it (`by`) - only that lord's kit ends it, its tally counts
 *  only blows on that lord, and a duel's end frees only its own lord's held threshold. One ring stands at a time (the ring law
 *  is one rim): a lord whose duel falls due while another's ring stands calls it as that one falls, and Garoth's Clan Muster,
 *  a signature errand, keeps his ward up until it is called (section 13.2: "the shield holds until the errand is called").
 *  A duel whose lord has fallen ends at the fall (egLordHit). So THE OLD MASTERS' Armsmaster beside Garoth never ends Garoth's
 *  duel nor holds his fall for ever.
 *  AUDIT EG V (lane1 #16; section 13.3, "n = 1: no ring; he duels in the open with his whole kit"): at n = 1 the Armsmaster's
 *  Challenge is that open duel - the member marked, no ring and no braziers, met by a tenth of his health dealt within its 15 s
 *  (so his signature, "two Challenges met", is earnable by a company of one). Garoth calls no duel at n = 1. */
function challengeTick(F, spec, L, now, here, rng, out, ctx, ms, garoth = false) {
  const ch0 = F.mem.challenge;
  if (!ch0 && now >= (L.duelAt ?? Infinity)) {
    const open = !garoth && ctx.n < 2, two = !garoth && L.ph >= 2 && ctx.n >= 4;
    const picks = [...here].sort(() => rng() - 0.5).slice(0, two ? 2 : 1);
    if (!picks.length) return;
    const p = picks[0], cx = r2((L.x + p.x) / 2), cz = r2((L.z + p.z) / 2);
    const need = garoth || open ? 0 : Math.max(1, Math.min(3, ctx.n - picks.length));
    F.mem.challenge = { by: L.i, subs: picks.map((m) => m.sub), until: now + ms, dealt: 0, x: cx, z: cz, r: open ? 0 : 6, need };
    for (const m of picks) egMark(F, m.sub, 6, now + ms);
    for (let j = 0; j < need; j++) { const a = (j / need) * Math.PI * 2; const [x, z, y] = egKeepOnFight(spec, cx + Math.sin(a) * 9, cz + Math.cos(a) * 9, 1, L.y); obj(F, 'brazier', x, z, egHpTeam(F, 4), now, out, { r: 0.8, y }); }
    if (!open) { kitPlace(F, L, cx + 2, cz, now); F.pg.ring = [cx, cz, 6]; }
    F.mem.mkDirty = 1;
    say(out, 'challenge', { s: picks.map((m) => m.sub), ...(open ? { t: EG_DUEL_OPEN } : {}) });   // FB1018D DUEL-RING: the open duel said as one - no ring rises
    return;
  }
  // another lord's ring stands: Garoth's due duel waits for it under his ward (the errand not yet called)
  if (ch0 && ch0.by !== L.i) { if (garoth && now >= (L.duelAt ?? Infinity)) ward(F, L, 500, now, out); return; }
  const ch = ch0;
  if (!ch) return;
  if (now >= ch.until || (ch.need > 0 && !egObjsOf(F, 'brazier').length)) endChallenge(F, L, now, out, now < ch.until);
}
/** A duel ended - only by the lord that called it (AUDIT EG V, lane1 #1): its marks off, its ring and braziers gone, its lord's
 *  next one due (the Armsmaster's 30 s on; Garoth's at his next turn) and its held threshold freed. */
function endChallenge(F, L, now, out, early, fell = false) {
  const ch = F.mem.challenge;
  if (!ch || ch.by !== L.i) return;
  for (const s of ch.subs) egUnmark(F, s, 6);
  F.mem.challenge = null; F.mem.mkDirty = 1; F.pg.ring = null;
  L.duelAt = L.key === 'garoth' ? Infinity : now + 30_000;
  if (L.key === 'garoth') L.hpFloor = null;   // AUDIT EG IV (lane1 #21): the duel over, the threshold it held is free
  egGone(F, egObjsOf(F, 'brazier'), EG_GONE.crumbled, '', now, out);
  if (fell && !(ch.r > 0)) return;   // FB1018D DUEL-RING (AUDIT FB1018D L3-1): an open duel the lord's fall ends says nothing of its own - the fall is told, and 'unmet' was false at the killing blow
  out.push({ k: 'esay', w: early ? 'challengewon' : 'challengeend', ...(ch.r > 0 ? {} : { t: EG_DUEL_OPEN }) });   // FB1018D DUEL-RING: an open duel's end, no ring to fall
}
/** A blow on lord `L` by a member its own duel challenged (`sub`), `got` landed: counted toward the tenth that meets it. */
function duelHit(F, L, sub, got, now, out) {
  const ch = F.mem.challenge;
  if (ch && ch.by === L.i && ch.subs.includes(sub)) { ch.dealt += got; if (ch.dealt >= L.max / 10) endChallenge(F, L, now, out, true); }
}

/**
 * AN OBJECT BROKEN (a banner, an anchor, a heart, a seal, a brazier, a standard, a pillar, a chain): its errand's words
 * and its consequence (Paired Hearts' five seconds kept). Answers nothing - the frames go into `out`.
 */
export function egObjBroken(F, spec, o, name, now, out) {
  egGone(F, [o], EG_GONE.slain, name, now, out);
  if (o.t === 'banner' && o.zone) zoneEnd(F, o.zone, now, out);   // EG-PERFECT: and its keep (a claimed third stands until its banner falls)
  // AUDIT EG III - BURNING PERCHES (section 13.3, the Wyrm's phase 2): the pillar it leaves erupts - the one broken under it,
  // where it stood, as it leaves it (a disc of r 6, 2.0 s)
  const W = o.t === 'pillar' ? egLordsOf(F).find((L) => L.key === 'wyrm' && L.perch === o.i && L.ph === 2) : null;
  // AUDIT EG IV (lane1 #26): the Wyrm's own blow (lordBlow - its depth, fury and Vengeful; committed with the lead, so THE UNION
  // FLOOR judges it when its word is due, over the beat's members - net/eliteGates/egBodies.js egBlowsStep)
  // EG-PERFECT (bug 4): thrown as the place's (`place`) - its r 6 covers the perch's whole top, so its only way off is the stair, which
  // is no fight floor: THE UNION FLOOR held it and dropped it whenever anyone stood on the perch, the one place it could ever catch
  if (W) lordBlow(F, spec, W, [shDisc(o.x, o.z, 6)], { nm: 'Burning Perch', wu: 2000, p: 0.45, b: 12, el: 'fire' }, [], now, out, { place: true });
  // AUDIT EG V (lane1 #23): PAIRED HEARTS in the Colossus's OWN second phase - the hearts' lord's, never the fight's first lord's
  // (THE TWIN COURT stands the Colossus second)
  if (o.t === 'heart' && egLordsOf(F).find((L) => L.key === 'colossus')?.ph >= 2) {
    const mate = egObjsOf(F, 'heart').find((h) => h.pair === o.pair);
    (F.mem.pairBroke ??= {});
    if (mate) F.mem.pairBroke[o.pair] = now; else delete F.mem.pairBroke[o.pair];
  }
  (F.mem.broke ??= {})[o.t] = (F.mem.broke[o.t] ?? 0) + 1;   // AUDIT EG V (lane1 #5): each kind's breaks counted - Ilthys's feat reads her banners'
  out.push({ k: 'esay', w: 'broken', t: o.t, n: name });
}
/**
 * AUDIT EG III - THE CHAINING'S SHARED BLOW, the census's half (section 13.4, Morvayn: "a blow on one is shared with the
 * other" - the page's "share", divided between, as the Cracked Gem's souls are): a counted blow (the seam's judge's hits, each a
 * blow's - a share past nought) on a member a soul-chain binds (`F.mem.chains` - a pair, a three in the Last Rites) is divided
 * evenly over the chain - the struck member keeps its part and each chained mate takes an equal one, which caught no one (`nm`
 * ''). A member chained to a Wraith shares with no body; an element's blow is seen, never counted (section 21), so it divides
 * nothing. Pure: answers the hits, divided.
 * AUDIT EG V (lane1 #8): ONE RULE WITH THE STRUCK SCREEN (scenes/eliteGates/egFight.js egChainMates, over the chain's tethers) - the blow is
 * divided over the chain as its tethers say it, a member fallen or gone home unchained at once (egUnchain, at the seam's join),
 * so the census and the screen count the same parts; a mate the census does not hold in the hall (`live`) is counted none of
 * its part, as no screen of its own lands it.
 * @param {any} F @param {any[]} hits @param {Array<{sub: string}>} live
 */
export function egChainShared(F, hits, live) {
  const chains = F?.mem?.chains ?? [];
  if (!chains.length) return hits;
  const out = [];
  for (const h of hits) {
    const c = h.share > 0 ? chains.find((q) => q.includes(h.sub)) : null;
    const mates = c ? c.filter((s) => s !== h.sub) : [];
    if (!mates.length) { out.push(h); continue; }
    const part = h.share / (mates.length + 1);
    out.push({ ...h, share: part }, ...mates.filter((s) => live.some((b) => b.sub === s)).map((s) => ({ ...h, sub: s, share: part, nm: '' })));
  }
  return out;
}
/**
 * AUDIT EG V (lane1 #8; section 13.4) - A MEMBER UNCHAINED as the fight loses it (its fall, its way home - the seam's join that
 * no longer admits it): out of every soul-chain (`F.mem.chains`; a chain left one member long is no chain, its last member's
 * mark lifted), and every chain tether naming it gone - a chain of three that loses its first member re-linked between the two
 * left, a Wraith's link to it cut - said at the beat's end (`etx`, `emk`). So the census (egChainShared) and the struck screen
 * (its tethers) divide a blow over the same living chain. Answers whether anything moved.
 * @param {any} F @param {string} sub
 */
export function egUnchain(F, sub) {
  const chains = F?.mem?.chains ?? [];
  const linked = (F?.tethers ?? []).some((t) => t[2] === 2 && (t[0] === sub || t[1] === sub));
  if (!linked && !chains.some((c) => c.includes(sub))) return false;
  const kept = chains.map((c) => c.filter((q) => q !== sub)).filter((c) => c.length >= 2);
  for (const c of chains) if (c.includes(sub)) for (const q of c) if (!kept.some((k) => k.includes(q))) egUnmark(F, q, 4);
  F.mem.chains = kept;
  F.tethers = F.tethers.filter((t) => t[2] !== 2 || (typeof t[0] !== 'string' && t[1] !== sub));
  for (const c of kept) for (let j = 1; j < c.length; j++) F.tethers.push([c[0], c[j], 2, 800]);
  F.mem.txDirty = 1; F.mem.mkDirty = 1;
  return true;
}
/**
 * AUDIT EG V (lane1 #25; section 13.3, the Twin Lords: "A blow struck them when the relay's reckoning of the poses finds them in
 * it as it lands (the census's)") - A LORD'S BLOW'S CATCH TOLD ITS KIT: each of the seam's judge's hits (net/bossRef.js
 * judgeShapes - the census's own, on the members' shared-time trails at the landing, an element's blow seen) on a blow a lord
 * threw is told that lord's kit (`landed` - the Twin Lords' touch), with the member it caught. Answers nothing.
 * @param {any} F @param {Array<{sub: string, i: number, o?: number}>} hits
 */
export function egLordsJudged(F, hits) {
  for (const h of hits) {
    const by = h.o ? egBodyById(F, h.o) : null;
    if (by?.role !== EG_ROLE.lord || !KITS[by.key]?.landed) continue;
    const bl = F.blows.find((b) => b.i === h.i);
    if (bl) KITS[by.key].landed(F, by, bl, [{ sub: h.sub }]);
  }
}
/** May an object be struck (a ward on it - a heart off its Rails, a stood-on errand)? */
export const egObjStruck = (o) => !egHas(o, EG_FL.ward) && o.role === EG_ROLE.obj;

// ── the boss seam (section 13.1) ─────────────────────────────────────────────────────────────────────────
/** EG-ZK: THE LORDS' VIEW of a hall's one fight, as the seam holds it - the fight's record `F` (net/eliteGates/egBodies.js: the lords are
 *  its bodies of role 0, beside its legion and its errands' objects), the hall's spec, the beat's context (the lords'
 *  `{ decrees, n, covenant }`; a Redoubt's living company `co`) and its clock. The director makes one for each call: the
 *  fight is one record, the view no second. */
export const egLordsFight = (F, spec, ctx = {}, now = 0) => ({ F, spec, ctx, now });
/** A Redoubt's receipt is earned by a share of the circle's damage at least this part of an even one, or a part in this many of
 *  its halls (section 19). */
export const EG_EARN_SHARE = 0.5;
export const EG_EARN_HALLS = 3;
/**
 * EG-ZK (2026-10-12, Mac: "I said I want everything"; section 13.1, "The Spire's lords are written to it"): THE SPIRE'S LORDS
 * ON THE BOSS SEAM (net/bossSeam.js) - the seven members the gate's Warden, the Brass Remnant and the Sea Serpent keep, kept
 * by every lord and champion of the Spire through ONE plug, never a seam a lord: the breach's director (net/eliteGates/egBrain.js)
 * still steps them in its one beat with the legion and the place's hazards, and calls the seam there - the seam is the
 * contract it calls, not a second host. Its fight `f` is the lords' view of the hall's fight (egLordsFight).
 *   new({ F, spec, key, now, out, decrees, n, at })  a Court's lord (the Twins, both), a champion: stood asleep in the
 *                                                     hall's fight (egLordsNew), its words in `out` - answers the view, the
 *                                                     bodies stood its `stood`
 *   join(f, sub, name, lv, now, present, o)           whether `sub` fights the lords: the director's admission (`o.admits` -
 *                                                     living, in the breach and its hall; a witness never fights) while a
 *                                                     lord stands. EG-ZQ (section 13.2): and its share of every lord's
 *                                                     health with it (egLordsShare) - a member the hall or its lords did
 *                                                     not stand for brings its share; a fallen one's (the director joins
 *                                                     it unadmitted at its fall) stays in a lord awake (LORD-SHARES) and
 *                                                     leaves one asleep, and is restored when it is admitted again
 *   hit(f, sub, d, r, pose, now, seq, o)              a member's blow on lord `o.i`: the gate's hand and purse (egHitBody - the
 *                                                     member's purse `o.p`, the Vestiges' weight `o.x`, the bucket's `o.bx`)
 *                                                     times the lord's own (egLordHitX), and what lands told the lord
 *                                                     (egLordHit - `o.name`, `o.here`, `o.threatX`, its words in `o.out`) -
 *                                                     answers egHitBody's `{ got, b }`, `got` what the lord lost (an
 *                                                     errand's held line takes back what fell past it - LANDED-WORD)
 *   step(f, now, bodies, rng) -> frames[]             the lords' beat over the census (egLordsStep, `f.ctx` its context)
 *   stateOf(f)                                        the whole fight at the view's clock (`efs`), as a joiner is told it
 *   judge(f, bodies, now) -> [{sub, share, ...}]      the fight's blows on the relay's shared-time trails (net/bossRef.js
 *                                                     judgeShapes, `f.spec` its fight ground) - the lords' and their
 *                                                     legion's, one floor, as the gate's judge takes its host's;
 *                                                     AUDIT EG III: a soul-chained member's share divided with
 *                                                     its chain (egChainShared - the Chaining's census half)
 *   earned(f, sub)                                    a Redoubt's receipt owed at the lords' fall: a share of the circle's
 *                                                     damage at least EG_EARN_SHARE of an even one, or a part in
 *                                                     EG_EARN_HALLS of its halls, among the living company `f.ctx.co`
 * Every member is the lords' own law handed exactly the arguments the director handed it before, so every lord's frames are
 * the frames it said before the seam (test/net/eliteGates/egz_lords.test.js).
 */
export const EG_SEAM = bossSeam('eg', {
  new: ({ F, spec, key, now, out, decrees = {}, n = F.n, at = undefined }) => ({ ...egLordsFight(F, spec, { decrees, n }, now), stood: egLordsNew(F, spec, key, now, out, { decrees, n, at }) }),
  join: (f, sub, name, lv, now, present = null, o = {}) => { const up = egLordsOf(f.F).length > 0; if (up) { egLordsShare(f.F, sub, lv, !!o.admits); if (!o.admits) egUnchain(f.F, sub); } return !!o.admits && up; },   // EG-ZQ: its share in while admitted - LORD-SHARES: kept at its fall by a lord awake; AUDIT EG V (lane1 #8): unchained as it goes
  hit: (f, sub, d, r, pose, now, seq = null, o = {}) => {
    const L = egBodyById(f.F, o.i);
    if (!L || L.role !== EG_ROLE.lord) return { got: 0, b: null };
    const res = egHitBody(f.F, f.spec, o.p, o.i, d, r, pose, now, seq, (o.x ?? 1) * egLordHitX(f.F, L, sub, pose, r, now), o.bx ?? 1);
    if (res.got && res.b) return { ...res, got: egLordHit(f.F, f.spec, res.b, sub, o.name ?? '', res.got, pose, now, o.here ?? [], o.out ?? [], { threatX: o.threatX ?? 1 }) };   // FIELD BUGS 2026-10-20f LANDED-WORD: what the lord lost, a held line's part taken back
    return res;
  },
  step: (f, now, bodies, rng) => { const out = []; egLordsStep(f.F, f.spec, now, bodies, rng, out, f.ctx); return out; },
  stateOf: (f) => egFightState(f.F, f.now),
  judge: (f, bodies, now) => { const hits = judgeShapes(f.F, bodies, now, f.spec); egLordsJudged(f.F, hits); return egChainShared(f.F, hits, bodies); },   // AUDIT EG III: a chained member's blow divided with its chain; AUDIT EG V (lane1 #25): its catch told its lord's kit
  earned: (f, sub) => {
    if (!f.F || !egLordsFell(f.F)) return false;
    const co = f.ctx?.co ?? [], total = co.reduce((s, [, m]) => s + m.dc, 0), n = Math.max(1, co.length), m = co.find(([s]) => s === sub)?.[1];
    return !!m && (m.dc >= (total * EG_EARN_SHARE) / n || m.act >= EG_EARN_HALLS);
  },
});
