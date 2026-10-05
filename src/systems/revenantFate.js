// @ts-check
// REVENANT-FATE (2026-10-02, Mac: "Players should have the option to kill or spare. Killing should show a unique
// animation where you destroy your foe, which drops a unique weapon random rarity weapon specific to the enemy, with
// their name included in the weapon name. Spare should allow you to free the enemy, which then adds them as a
// companion"; "the choice popup should reuse the loot menu").
//
// BEATEN, A REVENANT YIELDS. The blow that would kill one of the player's revenants instead leaves it at the edge of
// death, on its knees - its fight done, untouchable, its plea said in its own voice (REVENANT-VOICE) - and its fate
// is the player's:
//  - THE CHOICE is the loot menu's (ui/enhancedInventory.js, the loot window's FATE side; the classic skin a keyed
//    box): activate the kneeling foe as a body is searched, and the window shows its name, its plea, and two rows -
//    KILL, with the very weapon it will drop (pre-rolled at the yield: revenantTrophy.js), and SPARE, with where it
//    will stand (at the player's side, or away when the companion slots are full).
//  - KILL: an EXECUTION plays where it knelt - its last words, the blow, a burst of blood and a flash, and the body
//    burning away from the feet up in embers (systems/dissolve.js) - and where it stood lies a pile: everything it
//    carried and its TROPHY. Its record closes for good (executed).
//  - SPARE: it rises, steps into a portal, and is SWORN (systems/revenantCompanions.js) - a companion from then on.
//  - HESITATE (REVENANT_YIELD_MS kneeling, or walk REVENANT_YIELD_REACH away) and it SLIPS AWAY - an escape, its rank
//    up, its words about your hesitation.
// Online the choice is its owner's (a revenant is its character's memory): a peer sees it kneel, and burn.
//
// PURE but for the clock and the records it is handed - the pools (scenes/exteriorFoes.js, scenes/dungeonContext.js)
// call in, and draw what it answers.
import { takenName, revenantHandBack, revenantById, revenantOn, revenantYielded, revenantExecuted, revenantSpared, revenantMomentEvent, revenantPortrait, revenantRankNumeral, revenantLastStand, revenantLastStandEvent } from './revenant.js';
import { revenantTrophy, trophyKindWords } from './revenantTrophy.js';
import { PERSONALITIES } from './revenantPersonality.js';
import { retinueHasRoom, swornPlace, REVENANT_RETINUE_MAX, setRetinuePlayer, holdSworn, swornWitness } from './revenantCompanions.js';
import { companionsWithYou, COMPANION_SLOTS } from './companionSlots.js';
import { enemyDisplayName } from '../characters/enemyBasics.js';
import { DISSOLVE_EMBER, DISSOLVE_ARCANE } from './dissolve.js';
import { clearPlayerHarm } from './harmMark.js';   // AUDIT (2026-10-02): a beaten one's harm is no one's death
import { willMatters, willBroken, LAST_STAND_RANK, LAST_STAND_ROAR, PHASE_TWO, lastStandHealth, phaseTwo } from './revenantFeud.js';   // RVN3: the will (bible/12-Enhanced-AI/Feud-Arc.md 14.2); RVN4: the last stand (15)

/** How long a beaten revenant kneels before it slips away (ms). */
export const REVENANT_YIELD_MS = 90000;
/** ...or how far the player may walk from it (metres, on the ground's plane). */
export const REVENANT_YIELD_REACH = 60;
/** The execution's beats (ms from the choice): the blow lands at once, the body bursts, and it has burnt away. */
export const EXECUTION_MS = Object.freeze({ burst: 480, end: 1500 });
/** The sworn one's step into its portal where it knelt (ms): it gathers light, then is gone. */
export const SPARING_MS = 900;

/** May this foe record yield rather than die? One of the player's own revenants (never a puppet, a companion, one
 *  already judged), the arc on. */
export function revenantMayYield(f) {
  const id = f?.entity?.revenant?.id;
  if (!id || f.puppet || f.companion != null || f.yielded || f.executing || f.sparing || !revenantOn()) return false;
  const r = revenantById(id);
  return !!r && !r.defeated && !r.sworn;
}

/** RVN4 (bible/12-Enhanced-AI/Feud-Arc.md 15.1): IS ITS LAST STAND DUE - one of my own revenants (never a puppet, a
 *  companion, one held by its fate) of rank LAST_STAND_RANK and up, not stood in this stand yet? */
export function revenantLastStandDue(f) {
  const id = f?.entity?.revenant?.id;
  if (!id || f._lastStood || f.puppet || f.companion != null || fateHeld(f) || !revenantOn()) return false;
  const r = revenantById(id);
  return !!r && !r.defeated && !r.sworn && (r.rank | 0) >= LAST_STAND_RANK;
}
/** RVN4 (15.2): ITS LAST STAND - the blow that would kneel or kill it brings it back to its rank's share of its health;
 *  its ROAR (`f.roaring`, LAST_STAND_ROAR): no blow reaches it - the pools hold its motor (`ai.roarUntil`, the brain's
 *  clock) unless `roar(seconds)` (the brain's iron ring, the Enhanced AI switch on) answers it wound one; then PHASE
 *  TWO for the rest of the stand (`entity.revenant.p2`, the brain's numbers; its blows and its Speed here). Its deed
 *  written; answers its card's event. */
export function beginLastStand(player, f, { now = Date.now(), clock = 0, roar = null, rolls = Math.random } = {}) {
  const e = f.entity;
  const r = revenantById(e?.revenant?.id);
  f._lastStood = true;
  f.fleeing = false;
  if (f.ai) f.ai.fleeLeft = 0;   // FEUD HARNESS: its run over too, as a kneel's - risen mid-flight it ran on untargeted, never cornered nor escaped
  e.health = Math.max(1, Math.round((e.maxHealth || 1) * lastStandHealth(r?.rank)));
  f.roaring = { at: now, until: now + LAST_STAND_ROAR * 1000 };
  // no brain to roar with (the switch off): its motor held and its swing raised for the roar (the pool lets it go)
  if (!(typeof roar === 'function' && roar(LAST_STAND_ROAR)) && f.ai) { f.ai.roarUntil = clock + LAST_STAND_ROAR; f.ai._blowHold = true; f._roarHeld = true; }
  e.revenant = { ...e.revenant, p2: phaseTwo() };
  e.damageScale = (Number.isFinite(e.damageScale) && e.damageScale > 0 ? e.damageScale : 1) * PHASE_TWO.BLOWS;
  if (e.stats) e.stats.speed = (e.stats.speed ?? 0) + PHASE_TWO.SPEED;
  const rr = revenantLastStand(player, e);
  return rr ? revenantLastStandEvent(rr, player?.name, { archive: f.archive ?? f.mobileArchive ?? null, rolls }) : null;
}
/** RVN4: the roar over - blows reach it again (the pools ask each frame). */
export function roarStep(f, now = Date.now()) {
  if (f?.roaring && now >= f.roaring.until) {
    f.roaring = null;
    if (f._roarHeld) { f._roarHeld = false; if (f.ai) f.ai._blowHold = 'cancel'; }   // its raised swing let go, striking nothing
  }
  return !!f?.roaring;
}
/** THE TEAR-AWAY's dissolve: its body ashes out on the ember lane over this long (ms) after a short beat, then it is gone
 *  - inside the leaving hold (`f.leaving`, 900 ms), whose hand-off is its escape. */
export const TEAR_MS = Object.freeze({ delay: 120, ms: 720 });
/** RVN3 (14.2): DOES ITS WILL HOLD at the killing blow - a revenant of rank WILL_RANK and up whose weakness this fight has
 *  not struck, nor staggered or dodged perfectly WILL_STAGGERS times (its ledger, systems/feudLedger.js)? Then it does not
 *  kneel. */
export function revenantWillHolds(f) {
  const r = revenantById(f?.entity?.revenant?.id);
  return !!r && willMatters(r.rank) && !willBroken(f.entity._feud);
}
/** RVN3 (14.2): UNBROKEN, IT TEARS AWAY - held at 1, its fight and its run over, its body ashing out on the ember lane;
 *  the pool's leaving hold (`f.leaving`, `done` the pool's escape - the `fled` deed: it ranks up and learns) takes it
 *  out. Held by its fate (`leaving`) meanwhile: no blow, no spell, nobody's target. */
export function beginTearAway(f, done, { now = Date.now() } = {}) {
  f.fleeing = false;
  f._fleeRolled = true;
  if (f.entity) f.entity.health = 1;
  if (f.ai) { f.ai.target = null; f.ai.fleeLeft = 0; f.ai.velX = 0; f.ai.velZ = 0; }
  f.portalFx = { dir: 'out', at: now, delay: TEAR_MS.delay, ms: TEAR_MS.ms, tint: DISSOLVE_EMBER };
  f.leaving = { at: now, done };
}
/** IT YIELDS: held at 1, its fight and its run over, its trophy rolled; answers the event its plea is said by. */
export function beginYield(player, f, { now = Date.now(), rolls = Math.random } = {}) {
  f.yielded = { at: now };
  f.fleeing = false;
  f._fleeRolled = true;
  if (f.entity) f.entity.health = 1;
  if (f.ai) { f.ai.target = null; f.ai.fleeLeft = 0; }
  clearPlayerHarm(f.entity);   // its poison still ticking in the player names no one when it kills now
  setRetinuePlayer(player);
  const r = revenantYielded(player, f.entity);
  if (!r) return null;
  f.trophy = revenantTrophy(r, { entity: f.entity, level: player?.level ?? 1, rolls });
  const ev = revenantMomentEvent('yield', r, player?.name, { body: 'Beaten - it awaits your judgement. Go to it: kill it, or spare it.', archive: f.archive, rolls });
  f.yieldEvent = ev;
  return ev;
}
/** A kneeling one this frame (`dtMs` the frame's - the world's own time: a window that pauses the game stops its wait):
 *  'slip' when it has waited too long or the player walked off, else null. */
export function yieldStep(f, feet, dtMs = 0) {
  if (!f?.yielded) return null;
  // AUDIT (2026-10-02): its choice open on the screen (the host's word: the window not yet done) - the foes' clock runs
  // under a window (WINFOE1), its wait does not; nor does the walk-away, the player stands at the window
  const j = f.yielded.judging;
  if (typeof j === 'function' ? j() : j) return null;
  f.yielded.held = (f.yielded.held ?? 0) + Math.max(0, Number(dtMs) || 0);
  if (f.yielded.held > REVENANT_YIELD_MS) return 'slip';
  if (feet && f.ai?.feet && Math.hypot(feet[0] - f.ai.feet[0], feet[2] - f.ai.feet[2]) > REVENANT_YIELD_REACH) return 'slip';
  return null;
}
/** Its words as it slips away (the escape the pool makes of it). */
export function slipEvent(player, r, { archive = null, rolls = Math.random } = {}) {
  return revenantMomentEvent('slip', r, player?.name, { body: `You hesitated. ${r.given} got away - and it will remember.`, archive, rolls });
}
/** THE KNEEL: its hurt's last frame held (a breath every so often - the frame before it), facing the eye as ever. */
export function kneelPose(f, eye, now = Date.now()) {
  if (!f?.mobile?.heldPose || !f.ai) return f?._mout ?? null;
  const breath = ((now - (f.yielded?.at ?? f.executing?.at ?? 0)) % 1700) < 320;
  return f.mobile.heldPose('hurt', breath ? -2 : -1, f.ai.yaw, f.ai.feet, eye ?? f.ai.feet);
}

/** KILL chosen: the execution begins - answers its last words' event. */
export function beginExecution(player, f, { now = Date.now(), rolls = Math.random } = {}) {
  const r = revenantById(f?.entity?.revenant?.id);
  f.yielded = null;
  f.executing = { at: now, burst: false, done: false };
  if (!r) return null;
  const drops = f.trophy ? `It drops ${f.trophy.name}.` : null;
  return revenantMomentEvent('executed', r, player?.name, { body: ['Executed.', drops].filter(Boolean).join(' '), archive: f.archive, rolls });
}
/** One frame of an execution: 'burst' once (the blood and the flash), 'done' once (burnt away - take it out, drop its
 *  pile), else null. */
export function executionStep(f, now = Date.now()) {
  const x = f?.executing;
  if (!x) return null;
  const t = now - x.at;
  if (!x.burst && t >= EXECUTION_MS.burst) { x.burst = true; return 'burst'; }
  if (!x.done && t >= EXECUTION_MS.end) { x.done = true; return 'done'; }
  return null;
}
/** The execution ended: its record closed (executed); answers what falls where it stood - all it carried, and its
 *  trophy. */
export function finishExecution(player, f) {
  revenantExecuted(player, f.entity);
  swornWitness(f.mobileType ?? f.entity?.mobileType);   // RVN11 (Feud-Arc.md 22.1): one of its own kind executed in a sworn one's sight, -15
  const items = [...(Array.isArray(f.entity?.items) ? f.entity.items : []), ...(f.trophy ? [f.trophy] : [])];
  f.trophy = null;
  if (f.entity) f.entity.items = [];   // AUDIT (2026-10-02): handed to the pile - never a save's dead record's to carry twice
  return items;
}
/** AUDIT (2026-10-02): HELD BY ITS FATE - kneeling, burning, gathering into its portal, or a companion stepping out
 *  through one: no swing's, no spell's, nobody's target (characters/enemyTargets.js reads the same four). */
export const fateHeld = (f) => !!(f && (f.yielded || f.executing || f.sparing || f.leaving));
/** The held taken out of a list in place (a swing's candidates) - answers the list. */
export function dropFateHeld(list) {
  for (let i = list.length - 1; i >= 0; i--) if (fateHeld(list[i])) list.splice(i, 1);
  return list;
}

/** SPARE chosen: sworn - at the player's side while a slot is free, else away. Answers { r, state, event }, or null
 *  when the retinue has no room (the window never offers it then). */
export function beginSpare(player, f, { now = Date.now(), rolls = Math.random } = {}) {
  if (!retinueHasRoom()) return null;
  setRetinuePlayer(player);
  const state = swornPlace();
  const r = revenantSpared(player, f.entity, { state });
  if (!r) return null;
  const back = revenantHandBack(player, r, f.entity);   // RVN8 (Feud-Arc.md 19): what it took of mine, handed back at the oath
  f.yielded = null;
  f.sparing = { at: now };
  if (state === 'with') holdSworn(r.id, SPARING_MS);   // AUDIT (2026-10-02): its companion steps out once the kneeling one is through
  const body = (state === 'with'
    ? `Sworn to you. ${r.given} walks at your side now.`
    : `Sworn to you. Your companions are full - ${r.given} waits until you call it.`)
    + (back.length ? ` It hands back your ${back.map((it) => takenName(it)).join(' and ')}: "It's yours. It always was."` : '');   // AUDIT FEUD 2: its article gone after "your"
  return { r, state, event: revenantMomentEvent('spared', r, player?.name, { body, archive: f.archive, rolls }) };
}
/** The sworn one has stepped through its portal - take its kneeling body out. */
export const spareDone = (f, now = Date.now()) => !!f?.sparing && now - f.sparing.at >= SPARING_MS;

/** WHAT ITS SPRITE SHOWS NOW: [share gone, r, g, b] for systems/dissolve.js, or null whole - an execution burning it
 *  away after the burst in ember; a sworn one gathering into its portal in arcane light; a companion's arrival
 *  (`portalIn`) or leaving (`portalOut`). */
export function fateDissolve(f, now = Date.now()) {
  if (f?.executing) {
    const t = now - f.executing.at - EXECUTION_MS.burst;
    return t > 0 ? [Math.min(1, t / (EXECUTION_MS.end - EXECUTION_MS.burst)), ...DISSOLVE_EMBER] : null;
  }
  if (f?.sparing) {
    const t = (now - f.sparing.at - 200) / (SPARING_MS - 200);
    return t > 0 ? [Math.min(1, t), ...DISSOLVE_ARCANE] : null;
  }
  const p = f?.portalFx;
  if (p) {
    const t = (now - p.at - p.delay) / p.ms;
    const tint = p.tint ?? DISSOLVE_ARCANE;   // RVN3: a tear-away's ember; a portal's arcane
    if (p.dir === 'in') return t >= 1 ? null : [Math.max(0.001, 1 - Math.max(0, t)), ...tint];
    return t > 0 ? [Math.min(1, t), ...tint] : null;
  }
  return null;
}

/**
 * THE CHOICE, as the loot menu shows it: who it is, its plea, its trophy, where a sworn one would stand, and the two
 * rows. `choose(id)` the pool's ('kill' | 'spare').
 */
export function fateModel(player, f, { choose } = /** @type {any} */ ({})) {
  const r = revenantById(f?.entity?.revenant?.id);
  if (!r) return null;
  const kind = enemyDisplayName(r.mobileType) ?? '';
  const trait = typeof r.trait === 'string' && r.trait ? r.trait.charAt(0).toUpperCase() + r.trait.slice(1) : null;
  const P = PERSONALITIES[r.personality] ?? null;
  const used = companionsWithYou();
  const room = retinueHasRoom();
  const free = used < COMPANION_SLOTS;
  const trophy = f.trophy ?? null;
  const ev = f.yieldEvent ?? null;
  return {
    kind: 'fate',
    id: r.id,
    name: r.name,
    given: r.given,
    rank: r.rank,
    sub: [`Rank ${revenantRankNumeral(r.rank)}`, kind, trait, r.elite ? 'Elite' : null].filter(Boolean).join(' · '),
    mood: P?.label ?? null,
    blurb: P?.blurb ?? null,
    plea: { speech: ev?.speech ?? null, body: ev?.speech ? null : ev?.body ?? null },
    portrait: revenantPortrait(r),
    trophy,
    slots: { used, max: COMPANION_SLOTS, free, room, retinueMax: REVENANT_RETINUE_MAX },
    options: [
      {
        id: 'kill', key: 'K', label: 'Kill', verb: 'Execute', tone: 'warn',
        title: `Kill ${r.given}`,
        detail: trophy ? `It drops ${trophy.name} - ${trophyKindWords(trophy)}` : 'It drops what it carried',
        confirm: `Destroy ${r.name}? It is gone for good${trophy ? `, and ${trophy.name} is yours` : ''}.`,
        disabled: false,
      },
      {
        id: 'spare', key: 'S', label: 'Spare', verb: 'Spare', tone: 'primary',
        title: `Spare ${r.given}`,
        detail: !room ? `You keep ${REVENANT_RETINUE_MAX} sworn already - release one first`
          : free ? `It joins you as a companion (${used + 1} of ${COMPANION_SLOTS})`
            : `It is sworn to you, and waits until you call it (your ${COMPANION_SLOTS} companion slots are full)`,
        confirm: free ? `Spare ${r.name}? It will walk at your side.` : `Spare ${r.name}? It will wait, sent away, until you call it.`,
        disabled: !room,
      },
    ],
    choose: (id) => choose?.(id),
    live: () => !!f.yielded && !f.dead,
  };
}
