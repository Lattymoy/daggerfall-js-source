// @ts-check
// UNQUIET (bible/06-Systems/Revenants.md section 46; the owner, 2026-10-17: "With revenants becoming a full fledge game
// loop. They need to become harder, rarer, revenants need more of a chance to flee instead of relying on player death, we
// need to go deeper on the experience and make it something insanely deep."): THE UNQUIET - revenants that live by
// getting away. systems/revenant/revenant.js keeps the record and its deeds (and the flight's own numbers - REVENANT_FLEE_*);
// this sibling keeps what UNQUIET adds to them, its numbers and every law pure but the flight's (it moves a live foe):
//
//  - RARER: only a special foe carrying THE MARK may rise (systems/revenant/unquietMark.js), and none rises while
//    REVENANT_MAX hunt the player (revenant.js - the Dread hunts no one, so it is not counted; DREAD.MAX of it at once).
//  - BORN OF FLIGHT, RANKED BY SURVIVING: a marked foe breaks and runs far oftener than a plain special foe ever did
//    (revenant.js's flee numbers), and a revenant climbs by getting away from the player - an escape, the will's
//    slip from the choice, the player's own flight - every time; the will's tear-away only every TEAR_RANK times, and a
//    kill (or a companion felled) only every BLOOD_RANK times (`deedRanks`).
//  - FLIGHT CRAFT: from CRAFT.RANK it breaks away in its own way (`fleeCraftOf`): a person throws down SMOKE (DFU's
//    Chameleon on it), a caster, a spirit or a daedra BLINKS out (a rift, gone - unless silenced, held or struck as it
//    fades), the dead SINK into the ground (a blow in the sinking breaks it: it rises, cornered, and runs no more), and
//    anything else BOLTS (a faster run). Each has its answer, and the page says which it is. Its clock is the pool's
//    (`dt`): a pool that stands still (a window over the game) holds the craft with it.
//  - WOUNDS: what the player left on it. Every escape keeps a wound by the blow that broke it (`woundOf` - the ledger's
//    last class): a blade's bleeds, a hammer's cracks, an axe's maims, an arrow lames, an element sears. A wound
//    stays (WOUND.MAX) and weakens it - its health, its blows, its poise, its Speed, its saving throw.
//  - AMBITION: what it does while it is away, by who it is (`ambitionOf`): VENGEANCE comes sooner and oftener, MASTERY
//    trains (it festers - grows - every two days, not three), PLUNDER raids the roads (its gold grows each day it is left
//    alone).
//  - THE TRAIL (UNQUIET II, section 47): an escape in the open that goes to ground in a den in reach leaves a warm trail
//    to it - its lair known at once (the map's red circle), and found there before the trail cools (HUNT.MINUTES) it
//    stands still wounded (HUNT.HEALTH).
//  - OMENS (section 47): the day it is due, the player is warned, in its ambition's words.
//  - UNQUIET III (section 48): a revenant of MASTERY trains against what the player has hurt it with most (`trainLesson`
//    - an adaptation, in a free lesson's room); a WOUND HEALS every WOUND.HEAL_DAYS days left alone, the oldest first;
//    and a revenant that gets away in the open goes to ground in the NEAREST DEN in reach (`nearestLair`).
//  - THE DREAD: a rank-5 revenant that gets away once more (never by a slip from the choice) ASCENDS - it goes to ground
//    in its lair for good, every town knows where, and it waits there: stronger, two last stands, never fleeing, its
//    trophy a Legendary and a hoard when it falls. One at a time (DREAD.MAX).
//
// HOST-SPLIT: nothing here is a host's - the flight runs inside revenant.js revenantFleeStep (both pools' one law), its
// look through the pools' own dissolve (`f.portalFx`, revenantFate.js fateDissolve) and the scene's door (systems/
// playerDoor.js `fx`, the magic engine's techniques).
import { MOBILE_TYPES as M } from '../../characters/mobile/mobileTypes.js';
import { assignModBundle, isSilencedEffect, entityIsParalyzed } from '../effects.js';
import { DISSOLVE_ARCANE } from '../dissolve.js';
import { playerDoor } from '../playerDoor.js';
import { t } from '../textManager.js';   // L10N4: UNQUIET's words through the text core
import { lessonOf, ADAPT_MAX, ADAPT } from './revenantFeud.js';   // UNQUIET III: what a revenant of mastery trains against
import { isClassEnemyId } from '../../characters/enemy/enemyBasics.js';   // DEX1: DFU's class test (DaggerfallEntity.IsClassEnemyId) - a mod's monster past 255 is no class

// ── born of flight, ranked by surviving ─────────────────────────────
/** A revenant's kill of the player (or a companion it fells) ranks it up only every this many times - an escape ranks
 *  it every time (the owner: "more of a chance to flee instead of relying on player death"). */
export const BLOOD_RANK = 2;
/** The deeds that rank a revenant up each time: it got away (an escape, the will's tear-away, a slip from the choice -
 *  the `fled` deed), or the player got away from it (`routed`). */
export const SURVIVING_DEEDS = Object.freeze(['fled', 'routed']);
/** The deeds that rank it up every BLOOD_RANK times: its kill of the player, a companion felled. */
export const BLOOD_DEEDS = Object.freeze(['slew', 'felled']);
/** AUDIT UNQUIET (section 49): the will's tear-away (an escape with its will unbroken at the killing blow - RVN3) ranks it
 *  only every this many times - a fight the player won is no getting away from them. */
export const TEAR_RANK = 2;
/** Does `deed` rank an existing revenant up, with `blood` its blood-deeds since its last rank and `tears` its tear-aways
 *  (this one counted in either), `unbroken` the escape a tear-away? */
export const deedRanks = (deed, blood, { unbroken = false, tears = 0 } = {}) => (deed === 'fled' && unbroken ? (tears | 0) >= TEAR_RANK
  : SURVIVING_DEEDS.includes(deed) || (BLOOD_DEEDS.includes(deed) && (blood | 0) >= BLOOD_RANK));
/** A record's blood count read back: a whole number under BLOOD_RANK. */
export const sanitizeBlood = (v) => (Number.isInteger(v) && v >= 0 ? Math.min(BLOOD_RANK - 1, v) : 0);
/** A record's tear-away count read back: a whole number under TEAR_RANK. */
export const sanitizeTears = (v) => (Number.isInteger(v) && v >= 0 ? Math.min(TEAR_RANK - 1, v) : 0);

// ── the flight craft ────────────────────────────────────────────────
/** CRAFT: from RANK a revenant breaks away in its own way. BOLT_PACE its run (a share of its walk; every other run is
 *  revenant.js REVENANT_FLEE_PACE's 2), BLINK_PACE a blinker's while it opens its rift (it stands to it - a blade can
 *  reach it), and SINK_PACE a sinking one's shuffle (the motor's flee takes no pace of none); SMOKE_ROUNDS its smoke's
 *  Chameleon (DFU's magic rounds); BLINK_DELAY (s) after it breaks it blinks, fading over BLINK_MS (ms); a SINK goes into
 *  the ground over SINK_MS after SINK_DELAY (ms) - every one of them on the pool's clock. */
export const CRAFT = Object.freeze({
  RANK: 2,
  BOLT_PACE: 2.5,
  BLINK_PACE: 0.5,
  SINK_PACE: 0.05,
  SMOKE_ROUNDS: 2,
  BLINK_DELAY: 0.8,
  BLINK_MS: 600,
  SINK_DELAY: 200,
  SINK_MS: 1400,
});
export const CRAFTS = Object.freeze(['smoke', 'blink', 'sink', 'bolt']);
/** The edge each craft burns its body away in (systems/dissolve.js): a blink's arcane violet, a sink's grave earth. */
export const CRAFT_TINT = Object.freeze({ blink: DISSOLVE_ARCANE, sink: Object.freeze([0.5, 0.36, 0.2]) });
/** Who blinks: a caster's class, a spirit, a lich, a nymph, a shaman, every daedra and atronach (never the imp - under
 *  revenant.js REVENANT_MIN_LEVEL, it never rises). */
const BLINKERS = new Set([M.Mage, M.Sorcerer, M.Healer, M.Battlemage, M.Ghost, M.Wraith, M.Lich, M.AncientLich, M.Nymph, M.OrcShaman,
  M.FireDaedra, M.FrostDaedra, M.Daedroth, M.DaedraSeducer, M.DaedraLord, M.FireAtronach, M.IceAtronach, M.IronAtronach, M.FleshAtronach]);
/** Who sinks: the walking dead, and the spriggan into its roots. */
const SINKERS = new Set([M.SkeletalWarrior, M.Zombie, M.Mummy, M.Vampire, M.VampireAncient, M.Spriggan]);
/** ITS CRAFT, by its kind: a blinker blinks, a sinker sinks, any other person throws down smoke, anything else bolts. */
export function fleeCraftOf(mobileType) {
  if (!Number.isInteger(mobileType)) return 'bolt';
  if (BLINKERS.has(mobileType)) return 'blink';
  if (SINKERS.has(mobileType)) return 'sink';
  if (isClassEnemyId(mobileType) && mobileType !== M.None) return 'smoke';
  return 'bolt';
}
/** A live revenant's craft as it breaks - its kind's, from CRAFT.RANK (`rank` its record's); null under it (it runs). */
export const revenantCraft = (mobileType, rank) => ((rank | 0) >= CRAFT.RANK ? fleeCraftOf(mobileType) : null);
/** The pace its run is at: a bolt's, a blinker's while it opens its rift, a sink's shuffle (it stands and goes into the
 *  ground), else `pace`. */
export const craftPace = (craft, pace) => (craft === 'bolt' ? CRAFT.BOLT_PACE : craft === 'blink' ? CRAFT.BLINK_PACE : craft === 'sink' ? CRAFT.SINK_PACE : pace);

/**
 * THE CRAFT BEGUN, as it breaks (revenant.js revenantFleeStep's 'start'): its body's `_craft` (what its flee card says),
 * and on the foe record `f` what its run must follow (`f._craft` - `t` the pool's ms since it broke): SMOKE - the
 * Chameleon on it now (DFU's Normal kind: its own blow would end it - systems/concealment.js - and a runner strikes none;
 * the Enhanced skin shows it a moment at a blow that lands, systems/combatVisuals.js, the classic draws it not at all)
 * and the door's puff; BLINK - its moment; SINK - its sinking begun (its dissolve, and the health a blow would take from
 * it). `now` ms (the wall's - the dissolve's look is drawn on it).
 */
export function beginCraft(f, craft, { now = Date.now() } = {}) {
  const e = f?.entity;
  if (!e || !craft) return;
  e._craft = craft;
  f._craft = { kind: craft, at: now, t: 0, hp: e.health, fired: 0, bundle: null };
  const at = f.ai?.feet ?? null;
  if (craft === 'smoke') {
    try { f._craft.bundle = assignModBundle(e, { name: t('rvn.unq.craft.smoke', 'Smoke'), kind: 'chameleonNormal', rounds: CRAFT.SMOKE_ROUNDS })?.bundleId ?? null; } catch { /* no effects: it runs plain */ }
    puff(at);
  } else if (craft === 'sink') {
    f.portalFx = { dir: 'out', at: now, delay: CRAFT.SINK_DELAY, ms: CRAFT.SINK_MS, tint: CRAFT_TINT.sink };
    puff(at);
  }
}
/** The door's leaving puff where it stands (the magic engine's 'vanish' technique), if the scene has one. */
function puff(at) {
  if (!at) return;
  try { playerDoor()?.fx?.('vanish', [at[0], at[1], at[2]]); } catch { /* a scene with no effects */ }
}
/**
 * ONE FRAME OF ITS CRAFT while it runs (revenant.js revenantFleeStep): 'gone' - through (a blink faded, a sink under):
 * the pool's escape; 'broken' - a sink struck: it rises, cornered, and runs no more; null - run on. A BLINK fires
 * CRAFT.BLINK_DELAY after it broke unless it is silenced or held (then it only runs, and never blinks this flight), and a
 * blow as it fades breaks it (it runs on). `now` ms (the wall's: its dissolve's look); `dt` s, the pool's frame - the
 * craft's own clock (AUDIT UNQUIET: on the wall's, a pool held by a window let a blink or a sink finish unseen). Without
 * `dt`, the wall's since it broke.
 */
export function craftStep(f, now = Date.now(), dt = null) {
  const c = f?._craft, e = f?.entity;
  if (!c || !e) return null;
  c.t = Number.isFinite(dt) ? (c.t ?? 0) + Math.max(0, dt) * 1000 : now - c.at;
  if (c.kind === 'sink') {
    if (e.health < c.hp) { f.portalFx = null; c.kind = 'broken'; return 'broken'; }
    if (f.portalFx) f.portalFx.at = now - c.t;   // its look on the pool's clock
    return c.t >= CRAFT.SINK_DELAY + CRAFT.SINK_MS ? 'gone' : null;
  }
  if (c.kind !== 'blink') return null;
  if (!c.fired) {
    if (c.t < CRAFT.BLINK_DELAY * 1000) return null;
    let held = false;
    try { held = isSilencedEffect(e) || entityIsParalyzed(e); } catch { held = false; }
    if (held) { c.kind = 'run'; return null; }
    c.fired = c.t; c.hp = e.health;
    f.portalFx = { dir: 'out', at: now, delay: 0, ms: CRAFT.BLINK_MS, tint: CRAFT_TINT.blink };
    puff(f.ai?.feet ?? null);
    return null;
  }
  if (e.health < c.hp) { f.portalFx = null; c.kind = 'run'; return null; }
  if (f.portalFx) f.portalFx.at = now - (c.t - c.fired);
  return c.t - c.fired >= CRAFT.BLINK_MS ? 'gone' : null;
}

/** THE CRAFT PUT DOWN - a last stand, a kneel or a tear-away takes the foe mid-flight (revenantFate.js): its craft
 *  forgotten, its smoke lifted (AUDIT UNQUIET: on the classic skin a kneeling one in its smoke was never drawn) and its
 *  dissolve gone (a sink rising to its last stand stood half under the ground, going on fading). */
export function endCraft(f) {
  if (!f?._craft) return;
  const id = f._craft.bundle, e = f.entity;
  if (id != null && Array.isArray(e?.activeEffects)) e.activeEffects = e.activeEffects.filter((a) => a?.bundleId !== id);
  f._craft = null;
  if (f.portalFx?.dir === 'out') f.portalFx = null;
}

// ── wounds ──────────────────────────────────────────────────────────
/** WOUND: at most MAX kept (a fourth pushes the oldest out); an element's wound RESIST on its saving throw against that
 *  element; left alone, its oldest heals every HEAL_DAYS days (AUDIT UNQUIET: 5, it was 3 - a wound healed before most
 *  returns found it). */
export const WOUND = Object.freeze({ MAX: 3, RESIST: -15, HEAL_DAYS: 5 });
/** UNQUIET III (section 48): does `day` heal its oldest wound - a whole multiple of WOUND.HEAL_DAYS after `woundDay`, the
 *  day it took its last? (a new wound starts the count again) */
export const healsOn = (woundDay, day) => { const n = day - woundDay; return Number.isInteger(woundDay) && woundDay >= 0 && n > 0 && n % WOUND.HEAL_DAYS === 0; };
/** The whole days until its oldest wound heals on `day` (0: none to heal). */
export const daysToHeal = (woundDay, day, wounds) => (Array.isArray(wounds) && wounds.length && Number.isInteger(woundDay) && woundDay >= 0 ? WOUND.HEAL_DAYS - (Math.max(0, day - woundDay) % WOUND.HEAL_DAYS) : 0);
/** What each wound does (a share of its health or its blows, a share of its poise, its Speed, an element's saving
 *  throw) and the blow that leaves it (the ledger's class - systems/feudLedger.js FEUD_CLASSES). */
export const WOUNDS = Object.freeze({
  bled: Object.freeze({ from: Object.freeze(['blade']), health: 0.9 }),
  cracked: Object.freeze({ from: Object.freeze(['blunt', 'h2h']), poise: 0.7 }),
  maimed: Object.freeze({ from: Object.freeze(['axe']), blows: 0.9 }),
  lamed: Object.freeze({ from: Object.freeze(['arrow']), speed: -15 }),
  burned: Object.freeze({ from: Object.freeze(['fire']), resist: 'fire' }),
  frostbitten: Object.freeze({ from: Object.freeze(['frost']), resist: 'frost' }),
  stormstruck: Object.freeze({ from: Object.freeze(['shock']), resist: 'shock' }),
  blighted: Object.freeze({ from: Object.freeze(['poison']), resist: 'poison' }),
  hexed: Object.freeze({ from: Object.freeze(['magic']), resist: 'magic' }),
});
const WOUND_KEYS = Object.freeze(Object.keys(WOUNDS));
export const isWound = (v) => typeof v === 'string' && WOUND_KEYS.includes(v);
/** The wound the blow that broke it leaves - by its class (`cls`, the ledger's `last`); none for another. */
export const woundOf = (cls) => WOUND_KEYS.find((k) => WOUNDS[k].from.includes(cls)) ?? null;
/** `wounds` with `w` taken now - a wound it already bears opens again (the newest), WOUND.MAX kept. */
export const withWound = (wounds, w) => (isWound(w) ? [...(Array.isArray(wounds) ? wounds : []).filter((x) => x !== w), w].slice(-WOUND.MAX) : [...(Array.isArray(wounds) ? wounds : [])]);
/** A record's wounds read back: known ones, once each, WOUND.MAX at most. */
export const sanitizeWounds = (v) => (Array.isArray(v) ? [...new Set(v.filter(isWound))].slice(-WOUND.MAX) : []);
/** WHAT ITS WOUNDS DO, at its stand: `health` and `blows` multiples, `poise` a multiple, `speed` points, `resist` by
 *  element (WOUND.RESIST each). Frozen. */
export function woundEffects(wounds) {
  let health = 1, blows = 1, poise = 1, speed = 0;
  /** @type {Record<string, number>} */
  const resist = {};
  for (const w of sanitizeWounds(wounds)) {
    const d = WOUNDS[w];
    if (d.health) health *= d.health;
    if (d.blows) blows *= d.blows;
    if (d.poise) poise *= d.poise;
    if (d.speed) speed += d.speed;
    if (d.resist) resist[d.resist] = (resist[d.resist] ?? 0) + WOUND.RESIST;
  }
  return Object.freeze({ health, blows, poise, speed, resist: Object.freeze(resist) });
}
/** Its stand's edge (revenantFeud.js adaptEdge's) with its wounds folded in: its poise lighter, an element's saving
 *  throw lower (a learned resistance less by it, or a wound's own below none). Frozen. */
export function woundedEdge(edge, wounds) {
  const w = woundEffects(wounds);
  if (w.poise === 1 && !Object.keys(w.resist).length) return edge;
  /** @type {Record<string, number>} */
  const resist = { ...(edge?.resist ?? {}) };
  for (const [el, n] of Object.entries(w.resist)) resist[el] = (resist[el] ?? 0) + n;
  return Object.freeze({ ...(edge ?? {}), poise: (edge?.poise ?? 1) * w.poise, resist: Object.freeze(resist) });
}

// ── ambition ────────────────────────────────────────────────────────
export const AMBITIONS = Object.freeze(['vengeance', 'mastery', 'plunder']);
/** Who wants what (systems/revenant/revenantPersonality.js's ten): the savage, the zealous and the mad want you; the
 *  proud, the cold and the honourable want to be better than you; the rest want what is on the road. */
const AMBITION_OF = Object.freeze({
  brutal: 'vengeance', zealous: 'vengeance', unhinged: 'vengeance',
  honourable: 'mastery', arrogant: 'mastery', cold: 'mastery',
  witty: 'plunder', humorous: 'plunder', craven: 'plunder', weary: 'plunder',
});
/** Its ambition, by its personality - derived, never stored. */
export const ambitionOf = (personality) => AMBITION_OF[personality] ?? 'vengeance';
/** AMBITION: VENGEANCE's return - due DUE (character minutes, its least and most) and its share of the encounter rolls;
 *  MASTERY's festering - a wrath FESTER_DAYS past its due day and every FESTER_EVERY days more (revenantFeud.js FESTER's
 *  3 and 3); PLUNDER's gold - x(1 + PER_DAY a whole day past its due day), at most MOST. */
export const AMBITION = Object.freeze({
  VENGEANCE_DUE: Object.freeze([1440, 2880]),
  VENGEANCE_RETURN: 0.55,
  FESTER_DAYS: 2,
  FESTER_EVERY: 2,
  PLUNDER_PER_DAY: 0.25,
  PLUNDER_MOST: 3,
});
/** MASTERY's festering: does `day` give a record due on `dueDay` a wrath? */
export const masteryFestersOn = (dueDay, day) => { const past = day - dueDay - AMBITION.FESTER_DAYS; return past >= 0 && past % AMBITION.FESTER_EVERY === 0; };
/** PLUNDER's hoard at a stand: its gold's multiple for `daysPast` whole days past its due day. */
export const plunderGold = (daysPast) => Math.min(AMBITION.PLUNDER_MOST, 1 + AMBITION.PLUNDER_PER_DAY * Math.max(0, Math.floor(Number(daysPast) || 0)));

// ── the Dread ───────────────────────────────────────────────────────
/** THE DREAD: its health over its rank's (HEALTH), its second last stand's share (SECOND_STAND - the first is its rank's),
 *  its hoard's gold (GOLD - a plunderer's own days' hoard instead, where that is more; never the two multiplied), at most
 *  MAX of them at once; its trophy is a Legendary (revenantTrophy.js), its drop its rank's. */
export const DREAD = Object.freeze({ HEALTH: 1.5, STANDS: 2, SECOND_STAND: 0.25, GOLD: 3, MAX: 1 });
/** May a record ASCEND - a living revenant of rank `max`, not the Dread already, with a lair to go to ground in, while
 *  fewer than DREAD.MAX (`dreads`, the living Dread) wait? */
export const mayAscend = (r, max, dreads = 0) => !!r && !r.dread && (r.rank | 0) >= max && !!r.lair && (dreads | 0) < DREAD.MAX;
/** Its hoard's multiple at a stand: the Dread's GOLD or a plunderer's days (`plunder`, plunderGold's), the more of them. */
export const hoardOf = (dread, plunder = 1) => Math.max(dread ? DREAD.GOLD : 1, Number.isFinite(plunder) && plunder > 0 ? plunder : 1);
/** Its last stand's share at its `n`th stand (1-based) - its rank's first (`first`), the Dread's second SECOND_STAND. */
export const dreadStandHealth = (n, first) => (n >= 2 ? DREAD.SECOND_STAND : first);

// ── training (UNQUIET III, section 48) ──────────────────────────────
/** WHAT IT TRAINS AGAINST - a revenant of mastery's lesson at a day it trains (a wrath's day): the adaptation (RVN2's,
 *  revenantFeud.js lessonOf) answering the habit its scars name most (the latest first among equals), while it holds
 *  fewer than its rank's lessons (ADAPT_MAX at most) - training fills a lesson's room, never trades one away. Never an
 *  element's resistance (ADAPT.RESIST_OF - AUDIT UNQUIET: the record keeps no career, and RVN2 never stacks a learned
 *  resistance on one its career has; a fight teaches those, training drills its body against weapons and habits).
 *  Null for none. */
export function trainLesson(r) {
  if (!r || ambitionOf(r.personality) !== 'mastery') return null;
  const learned = Array.isArray(r.learned) ? r.learned : [];
  if (learned.length >= Math.min(r.rank | 0, ADAPT_MAX)) return null;
  const count = new Map(), last = new Map();
  (Array.isArray(r.scars) ? r.scars : []).forEach((s, i) => { if (s?.k) { count.set(s.k, (count.get(s.k) ?? 0) + 1); last.set(s.k, i); } });
  const kinds = [...count.keys()].sort((a, b) => count.get(b) - count.get(a) || last.get(b) - last.get(a));
  return lessonOf(kinds.filter((k) => k !== 'routed' && k !== 'night'), [...learned, ...Object.keys(ADAPT.RESIST_OF)], r.mobileType, null);
}
/** The habit of the player's a lesson answers - RVN12a's words (revenantFeud.js `ADAPT_HOW` - "blade", "arrows"), through the text core
 *  (each its own key: a word put into a sentence of another language takes that language's own). Null for none. */
export function trainedHow(a) {
  switch (a) {
    case 'mailed': return t('rvn.unq.how.mailed', 'blade');
    case 'braced': return t('rvn.unq.how.braced', 'hammer');
    case 'hewnHard': return t('rvn.unq.how.hewnHard', 'axe');
    case 'unflinching': return t('rvn.unq.how.unflinching', 'fists');
    case 'arrowWise': return t('rvn.unq.how.arrowWise', 'arrows');
    case 'fireproof': return t('rvn.unq.how.fireproof', 'fire');
    case 'rimebound': return t('rvn.unq.how.rimebound', 'frost');
    case 'grounded': return t('rvn.unq.how.grounded', 'lightning');
    case 'venomBlooded': return t('rvn.unq.how.venomBlooded', 'poison');
    case 'spellScarred': return t('rvn.unq.how.spellScarred', 'magic');
    case 'silverScarred': return t('rvn.unq.how.silverScarred', 'silver');
    case 'steadfast': return t('rvn.unq.how.steadfast', 'heavy blows');
    case 'patient': return t('rvn.unq.how.patient', 'footwork');
    case 'watchful': return t('rvn.unq.how.watchful', 'tricks from behind');
    case 'relentless': return t('rvn.unq.how.relentless', 'running');
    case 'nightStalker': return t('rvn.unq.how.nightStalker', 'night raids');
    default: return null;
  }
}

// ── the nearest den (UNQUIET III, section 48) ────────────────────────
/** WHERE IT GOES TO GROUND - the dungeon in reach nearest the place it got away (`px`, `py` - the door's map pixel; its
 *  longer side, as the boards measure; the earlier listed among equals). Null with none. */
export function nearestLair(px, py, dungeons) {
  if (!Number.isInteger(px) || !Number.isInteger(py)) return null;
  let best = null, bestD = Infinity;
  for (const d of Array.isArray(dungeons) ? dungeons : []) {
    if (!d || !Number.isInteger(d.px) || !Number.isInteger(d.py) || typeof d.name !== 'string' || !d.name) continue;
    const dist = Math.max(Math.abs(d.px - px), Math.abs(d.py - py));
    if (dist < bestD) { best = d; bestD = dist; }
  }
  return best ? { px: best.px, py: best.py, name: best.name.slice(0, 80), region: Number.isInteger(best.region) ? best.region : -1 } : null;   // revenantFeud.js sanitizeLair's shape
}

// ── the trail (UNQUIET II, section 47) ──────────────────────────────
/** THE TRAIL: an escape in the open that goes to ground in a den in reach (`nearestLair`) leaves it warm for MINUTES
 *  (character minutes) - its lair known at once - and found there before it cools, it stands at HEALTH of its health:
 *  it went to ground to heal, and has not. */
export const HUNT = Object.freeze({ MINUTES: 720, HEALTH: 0.6 });
/** Is `r`'s trail warm at `now` (character minutes)? Never the Dread's - it is at home for good. */
export const trailWarm = (r, now) => !!r && !r.dread && Number.isFinite(r.trail) && r.trail > 0 && r.trail > now;
/** The whole hours left on a warm trail (rounded up; HUNT.MINUTES' at most), 0 when it is cold. */
export const trailHours = (r, now) => (trailWarm(r, now) ? Math.ceil(Math.min(HUNT.MINUTES, r.trail - now) / 60) : 0);
/** A record's trail read back: the character minute it cools at, or 0. */
export const sanitizeTrail = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

// ── its words (L10N4: every one through the text core) ───────────────
/** A craft's name and what it does, as the page says them. */
export function craftWords(craft) {
  switch (craft) {
    case 'smoke': return { name: t('rvn.unq.craft.smoke', 'Smoke'), effect: t('rvn.unq.craft.smokeDo', 'it throws down smoke and vanishes as it runs, but a blow can still find it') };
    case 'blink': return { name: t('rvn.unq.craft.blink', 'Blink'), effect: t('rvn.unq.craft.blinkDo', 'it tears open a rift and is gone. Silence it, hold it, or strike it as it fades') };
    case 'sink': return { name: t('rvn.unq.craft.sink', 'Sink'), effect: t('rvn.unq.craft.sinkDo', 'it sinks into the earth. Strike it before it is under, and it rises, cornered, and runs no more') };
    case 'bolt': return { name: t('rvn.unq.craft.bolt', 'Bolt'), effect: t('rvn.unq.craft.boltDo', 'it runs faster than anything you have chased. Bring it down from range, and break its will before the killing blow') };
    default: return null;
  }
}
/** The narrator's line as it breaks away in its craft (its flee card). */
export function craftFleeWords(craft, given) {
  switch (craft) {
    case 'smoke': return t('rvn.unq.flee.smoke', '{given} throws down smoke and is lost to sight!', { given });
    case 'blink': return t('rvn.unq.flee.blink', '{given} tears open a rift. Strike it before it is through!', { given });
    case 'sink': return t('rvn.unq.flee.sink', '{given} sinks into the earth. Strike it before it is under!', { given });
    case 'bolt': return t('rvn.unq.flee.bolt', '{given} bolts!', { given });
    default: return null;
  }
}
/** A wound's name and what it does to it. */
export function woundWords(w) {
  switch (w) {
    case 'bled': return { name: t('rvn.unq.wound.bled', 'Bled'), effect: t('rvn.unq.wound.bledDo', 'a wound that will not close, so it has less health') };
    case 'cracked': return { name: t('rvn.unq.wound.cracked', 'Cracked'), effect: t('rvn.unq.wound.crackedDo', 'cracked bones, so it staggers more easily') };
    case 'maimed': return { name: t('rvn.unq.wound.maimed', 'Maimed'), effect: t('rvn.unq.wound.maimedDo', 'a maimed hand, so its blows are lighter') };
    case 'lamed': return { name: t('rvn.unq.wound.lamed', 'Lamed'), effect: t('rvn.unq.wound.lamedDo', 'a lamed leg, so it runs slower') };
    case 'burned': return { name: t('rvn.unq.wound.burned', 'Burned'), effect: t('rvn.unq.wound.burnedDo', 'fire bites it deeper') };
    case 'frostbitten': return { name: t('rvn.unq.wound.frostbitten', 'Frostbitten'), effect: t('rvn.unq.wound.frostbittenDo', 'frost bites it deeper') };
    case 'stormstruck': return { name: t('rvn.unq.wound.stormstruck', 'Stormstruck'), effect: t('rvn.unq.wound.stormstruckDo', 'shock bites it deeper') };
    case 'blighted': return { name: t('rvn.unq.wound.blighted', 'Blighted'), effect: t('rvn.unq.wound.blightedDo', 'poison bites it deeper') };
    case 'hexed': return { name: t('rvn.unq.wound.hexed', 'Hexed'), effect: t('rvn.unq.wound.hexedDo', 'magic bites it deeper') };
    default: return null;
  }
}
/** An ambition's name and what it does while it waits. */
export function ambitionWords(a) {
  switch (a) {
    case 'vengeance': return { name: t('rvn.unq.amb.vengeance', 'Vengeance'), effect: t('rvn.unq.amb.vengeanceDo', 'it comes for you sooner, and more often') };
    case 'mastery': return { name: t('rvn.unq.amb.mastery', 'Mastery'), effect: t('rvn.unq.amb.masteryDo', 'it trains while it waits, and grows bolder every 2 days instead of 3') };
    case 'plunder': return { name: t('rvn.unq.amb.plunder', 'Plunder'), effect: t('rvn.unq.amb.plunderDo', 'it raids the roads while it waits, and grows richer the longer you leave it') };
    default: return null;
  }
}
/** UNQUIET III (section 48): a revenant of mastery's training, told - its card's body. */
export const trainedWords = (given, how) => t('rvn.unq.trained', '{given} has been training. It has learned to answer your {how}.', { given, how });
/** UNQUIET III: when its oldest wound heals, as the page says it. */
export const healWords = (days) => t('rvn.unq.page.heals', 'The oldest heals in {days, plural, one {# day} other {# days}} unless you find it first.', { days });
/** THE TRAIL, as its escape's card ends: where it went to ground. */
export const trailWords = (lair) => t('rvn.unq.trail', 'Its trail leads to {lair}, where it has gone to ground to recover. Catch it before it is whole again.', { lair });
/** AN OMEN - the day it is due, in its ambition's words (its card's body). */
export function omenWords(a, given) {
  switch (a) {
    case 'mastery': return t('rvn.unq.omen.mastery', 'Word reaches you that {given} is ready to face you again.', { given });
    case 'plunder': return t('rvn.unq.omen.plunder', 'Travelers speak of {given} on the roads again. It is coming for you.', { given });
    default: return t('rvn.unq.omen.vengeance', 'You feel eyes on your back. {given} is hunting you again.', { given });
  }
}
/** What the towns say of what it does while it waits - a rumour's last sentence. */
export function ambitionRumor(a) {
  switch (a) {
    case 'vengeance': return t('rvn.unq.rumor.vengeance', 'Word is it asks after you by name.');
    case 'mastery': return t('rvn.unq.rumor.mastery', 'Word is it trains day and night for the day it meets you again.');
    case 'plunder': return t('rvn.unq.rumor.plunder', 'Word is it has been raiding the roads.');
    default: return '';
  }
}
