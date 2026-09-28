// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SET3 (2026-09-26) — WHAT THE SETS DO.
//
// The law (systems/sigilSets.js) says which tiers are awake and every
// number in them; this file does what each tier says, through the seams
// SET2 opened - registered here at import, each a no-op for anyone but
// MY entity with the set worn and awake (online, my Renown known, no
// duel). Design and numbers: bible/11-Multiplayer/Sigil-Sets.md.
//
//   the 2-piece stat tiers     an entity FOLD (RF1): armour a part,
//                              attributes, skills, a resistance -
//                              liveStat, skillValue, the hit formula
//                              and the saving throw read them
//   Bloodfury, Rampage,        the BLOW modifier (my weapon's blow at
//   Nightfall, the Burning     a foe, under either core): per cents
//   Gate's sear, the Wrath's   summed and taken of the whole blow, the
//   fury                       fraction carried per weapon; a flat sear
//   Cleave                     a STRIKE listener (AUDIT SET M2: the
//                              blow that LANDED, the formula's final
//                              damage): the nearest other foe near the
//                              one struck takes its share through the
//                              door (systems/playerDoor.js)
//   Spite of the Spurned       a STRUCK listener: the foe that struck
//                              me takes its share back, through the door
//   Unbroken                   a DEATH SAVE and a DAMAGE modifier on my
//                              one damage door
//   Wrath of the Warden        a HURT listener: the Nova through the door
//   Rampage, Eventide          the player's KILL listener
//   Waters of Oblivion         a player's CAST COST modifier
//   Eye of Mora                an ABSORPTION chance
//
// THE CLOCK is real seconds (performance.now): an online session never
// pauses, and a recovery is a thing a player times with a watch. What a
// power remembers (a recovery, a halving window, the Rampage) lives here
// for the session - a reload starts every power ready, which is no
// exploit worth a save field (Unbroken recovers in at most five minutes).
// ═══════════════════════════════════════════════════════════════════

import { SKILLS, MAGIC_SKILLS } from './skills.js';
import { registerEntityFold, registerWeaponBlowMod, newMods, EMPTY_MODS, NUMBER_BODY_PARTS } from './entityMods.js';
import { registerPlayerStruckListener, registerPlayerStrikeListener } from '../combat/formulas.js';
import { registerPlayerDamageMod, registerPlayerDeathSave, registerPlayerHurtListener, registerPlayerDoorOpen } from '../characters/playerEntity.js';
import { registerPlayerKillListener } from './playerKills.js';
import { registerSpellCostMod } from './spellcost.js';
import { registerAbsorptionChance } from './absorption.js';
import { registerMagicRoundHook } from './worldTick.js';
import { playerDoor } from './playerDoor.js';
import { hudText } from './notify.js';
import { weaponSkillUsed } from '../characters/weapons.js';
import { friendlyProtected } from '../combat/playerWeapon.js';
import { careerTolerance, EFFECT_FLAGS } from './spellcast.js';
import { KNIGHT_CITY_WATCH } from '../characters/mobileTypes.js';
import {
  wornSets, setsAwake, RAMPAGE_SECONDS, RAMPAGE_STACKS, CLEAVE_METRES, WRATH_BELOW, NOVA_METRES, WRATH_SECONDS,
} from './sigilSets.js';

// ── the session's memory, and its voice ────────────────────────────
let _now = () => performance.now() / 1000;
const fresh = () => ({
  unbrokenReady: 0, halvedUntil: 0,   // Malacath (6)
  wrathReady: 0, wrathUntil: 0,       // Ruhn (6)
  eventideReady: 0,                   // Nocturnal (6)
  rampage: 0, rampageUntil: 0,        // Dagon (6)
  recovering: new Set(),              // the powers whose "ready again" is still to be said
});
let _s = fresh();
/** The host's voice (scenes/world.js): a line on the HUD, and a sound by the power's name ('unbroken', 'wrath',
 *  'eventide'). The line defaults to the HUD's own door; the sound to none. */
let _say = (line) => { hudText(line); };
let _sound = null;
export function setSetPowersVoice({ say = null, sound = null } = {}) {
  if (typeof say === 'function') _say = say;
  _sound = typeof sound === 'function' ? sound : null;
}
const sound = (name) => { try { _sound?.(name); } catch { /* a sound is not the power's problem */ } };
/** AUDIT SET L10: the voice, never the power's problem - Unbroken's save had spent its recovery before a voice that
 *  threw could say so, and a throw there turned the save into a death. */
const say = (line) => { try { _say(line); } catch { /* a line is not the power's problem */ } };

/** THE ONE READ: every set MY entity wears, as `id -> [tier 1's numbers | null, tier 2's, tier 3's]` - awake tiers only;
 *  null for anyone but me, or while sets sleep. */
export function awakeTiersOf(entity) {
  if (!entity?.isPlayer || entity.peer || !setsAwake()) return null;
  const out = new Map();
  for (const st of wornSets(entity, undefined, undefined, { text: false })) out.set(st.id, st.tiers.map((t) => (t.awake ? t.values : null)));   // AUDIT SET L5: the numbers alone - the HUD and every blow ask, and no reader here reads a tier's words
  return out;
}
const tierOf = (entity, id, i) => awakeTiersOf(entity)?.get(id)?.[i] ?? null;

// ── the 2-piece stat tiers: the fold ────────────────────────────────
const add = (rec, key, v) => { rec[key] = (rec[key] ?? 0) + v; };
/** The awake stat tiers as one mods record (RF1's channels) - EMPTY for anyone but me. */
export function setFold(entity) {
  const t = awakeTiersOf(entity);
  if (!t || !t.size) return EMPTY_MODS;
  let mods = null;
  const m = () => (mods ??= newMods());
  const mal = t.get('malacath')?.[0];
  if (mal) { for (let p = 0; p < NUMBER_BODY_PARTS; p++) m().armorParts[p] += mal.armor; add(m().stats, 'endurance', mal.endurance); }
  const dag = t.get('dagon')?.[0];
  if (dag) { add(m().stats, 'strength', dag.strength); add(m().skills, SKILLS.CriticalStrike, dag.critical); }
  const noc = t.get('nocturnal')?.[0];
  if (noc) { add(m().skills, SKILLS.Stealth, noc.stealth); add(m().stats, 'agility', noc.agility); }
  const mor = t.get('mora')?.[0];
  if (mor) { add(m().stats, 'intelligence', mor.intelligence); for (const s of MAGIC_SKILLS) add(m().skills, s, mor.schools); }
  const ruhn = t.get('ruhn')?.[0];
  if (ruhn) add(m().resist, 'fire', ruhn.fire);
  return mods ?? EMPTY_MODS;
}

// ── the blow ────────────────────────────────────────────────────────
/** The Rampage's standing stacks now - none once its window has run out. */
export const rampageStacks = (now = _now()) => (now < _s.rampageUntil ? _s.rampage : 0);
const belowHalf = (e) => Number.isFinite(e?.health) && e.maxHealth > 0 && e.health < e.maxHealth / 2;
const ranged = (w) => weaponSkillUsed(w?.templateIndex) === SKILLS.Archery;
/** @type {WeakMap<object, number>} */
let _carry = new WeakMap();
/**
 * MY weapon's blow at a foe: the per cents of Bloodfury (twice below half health), the Rampage's stacks, Nightfall at a
 * foe that had not noticed me (`info.unaware`) and the Wrath's fury, summed and taken of the whole blow with the
 * fraction carried on the weapon; then the Burning Gate's sear, flat. And from the same blow, Cleave: the nearest other
 * foe within CLEAVE_METRES of the one struck takes its share of the blow - a MELEE blow (never a bow's or the
 * Thunderlock's). Nothing for a miss, a blow at a player (a duel), a peer's blow resolved here, or a foe's.
 */
export function setBlow(weapon, damage, attacker, target, info) {
  if (!(damage > 0) || !attacker?.isPlayer || attacker.peer || !target || target.isPlayer) return damage;
  const t = awakeTiersOf(attacker);
  if (!t || !t.size) return damage;
  const now = _now();
  let pct = 0, flat = 0;
  const dag = t.get('dagon');
  if (dag?.[1]) pct += dag[1].more * (belowHalf(attacker) ? 2 : 1);
  if (dag?.[2]) pct += dag[2].stack * rampageStacks(now);
  const noc = t.get('nocturnal');
  if (noc?.[1] && info?.unaware) pct += noc[1].more;
  const ruhn = t.get('ruhn');
  if (ruhn?.[0] && !fireProof(target)) flat += ruhn[0].sear;   // AUDIT SET L7: the gate's fire, never on a foe the fire cannot touch
  if (ruhn?.[2] && now < _s.wrathUntil) pct += ruhn[2].more;
  let out = damage;
  if (pct > 0) {
    const key = weapon ?? attacker;
    const exact = (damage * pct) / 100 + (_carry.get(key) ?? 0);
    const more = Math.floor(exact + 1e-9);
    _carry.set(key, Math.max(0, exact - more));
    out += more;
  }
  out += flat;
  return out;   // AUDIT SET M2: Cleave shares the blow that LANDED - setStrike, at the formula's tail
}
/** AUDIT SET M2: MY MELEE BLOW, LANDED (formulas.js registerPlayerStrikeListener - the attack's final damage, after
 *  either core's crits, materials and armour): Cleave's share of it. Taken here, at the blow modifiers, the share was
 *  of a number PCAAO then reduced for the struck foe's armour alone, so its neighbour could take more than it did. */
export function setStrike(attacker, target, damage, weapon) {
  if (!(damage > 0) || !weapon || ranged(weapon)) return;
  const v = tierOf(attacker, 'ruhn', 1);
  if (v) cleave(target, (damage * v.share) / 100, weapon);
}

const flat2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** AUDIT SET M4: a reach power's reach in height - a foe a storey above or below is on another floor, not beside me. */
export const REACH_RISE_M = 2.5;
const rise = (a, b) => Math.abs((a[1] ?? 0) - (b[1] ?? 0));
/** AUDIT SET H1: WHO A REACH POWER SPARES - my own allies (a summoned daedra, a quest's companion) and a foe at peace
 *  with me (Calmed, talked down, a quest's non-hostile): the melee swing's own rule, never the setting's to turn off
 *  (combat/playerWeapon.js friendlyProtected - a swing is aimed, Cleave and the Nova are not). A blow on either went
 *  through the pool's door as mine, turned the ally and woke the whole area. */
const spared = (f) => friendlyProtected(f, { protection: true });
/** AUDIT SET L7: a foe the gate's fire cannot touch (a fire daedra's IMMUNITY, the career's own word). */
const fireProof = (entity) => careerTolerance(entity?.career ?? {}, EFFECT_FLAGS.Fire) === 'Immune';
/** Cleave: the nearest other live foe within CLEAVE_METRES of the struck one takes `amount` (whole, at least 1) - never
 *  an ally or a foe at peace (H1), never one on another floor (M4), never one my weapon's metal cannot bite (M2: the
 *  formula's own `minMetalToHit` refusal, which the struck foe had to pass and its neighbour never was asked), and
 *  (AUDIT FINAL F11, the page's own word) never one behind a wall from the struck foe - the host's own ray, as the Nova
 *  asks it (`door.clear`), and only of a foe nearer than the best so far. */
function cleave(targetEntity, amount, weapon) {
  const door = playerDoor();
  if (!door || !(amount > 0)) return;
  const foes = door.foes();
  const struck = foes.find((f) => f.entity === targetEntity);
  if (!struck?.ai?.feet) return;
  let best = null, bestD = CLEAVE_METRES;
  for (const f of foes) {
    if (f === struck || f.dead || !f.ai?.feet || spared(f)) continue;
    if (rise(f.ai.feet, struck.ai.feet) > REACH_RISE_M) continue;
    if ((f.entity?.minMetalToHit ?? -1) > (weapon?.material ?? 0)) continue;
    const d = flat2(f.ai.feet, struck.ai.feet);
    if (d > bestD) continue;
    if (door.clear && !door.clear(struck.ai.feet, f.ai.feet)) continue;
    bestD = d; best = f;
  }
  if (best) door.hurtFoe(best, Math.max(1, Math.round(amount)));
}

// ── a foe's blow at me: struck, then landed ─────────────────────────
// AUDIT SET L2/L3: THE BLOW, AND WHAT IT DID. The formula's struck tail names the foe whose blow reached me - before my
// damage door has decided what it does: the trial's veto withholds it, a Shield spell's pool swallows it, Unbroken
// halves it. Spite answered the tail, so a blow the Shield took whole was paid back; and the Wrath answered every
// hurt, a fall's and a poison's too. So the tail only MARKS the blow, and the door's word on it (the hurt, in the same
// call) is what both answer: Spite pays back its share of the health the blow took, the Wrath wakes only on a blow.
/** How long a marked blow waits for the door (the tail and the door run in one call; this only bounds a mark nobody
 *  took, so a later poison tick is never read as the blow). */
export const BLOW_WINDOW_S = 0.1;
let _blow = null;
export function setStruck(attacker, target, damage) {
  if (!target?.isPlayer || target.peer) return;
  _blow = damage > 0 && attacker ? { attacker, at: _now() } : null;
}
/** The mark, taken - or null for a hurt no foe's blow dealt (a mark older than the window is nobody's). */
function landedBlow() {
  const b = _blow;
  _blow = null;
  return b && _now() - b.at <= BLOW_WINDOW_S ? b : null;
}
/** Spite of the Spurned: the foe that struck me takes its share of what its blow took from me. */
function spite(entity, blow, took) {
  const v = tierOf(entity, 'malacath', 1);
  if (!v || !(took > 0)) return;
  const door = playerDoor();
  const f = door?.foes().find((x) => x.entity === blow.attacker);
  if (f) door.hurtFoe(f, Math.max(1, Math.round((took * v.back) / 100)));
}

// ── Unbroken: the save, and the halving it leaves ───────────────────
export function setDamageMod(entity, dmg) {
  return _now() < _s.halvedUntil && tierOf(entity, 'malacath', 2) ? Math.floor(dmg / 2) : dmg;   // AUDIT SET L1: whole points - a half point left health fractional, and a later blow of the rest spent Unbroken's save on a wound that was never lethal
}
export function setDeathSave(entity) {
  const v = tierOf(entity, 'malacath', 2);
  if (!v) return false;
  const now = _now();
  if (now < _s.unbrokenReady) return false;
  _s.unbrokenReady = now + v.recover;
  _s.halvedUntil = now + v.halved;
  _s.recovering.add('unbroken');
  say(`Unbroken! Malacath will not let you fall - all damage halved for ${v.halved} s.`);
  sound('unbroken');
  return true;
}

// AUDIT FINAL F10: THE DOOR TAKES THE MARK AS IT OPENS, not when a hurt lands. Only a landed hurt had taken it, so a
// blow the door swallowed (the veto, Unbroken halving 1 to 0, a Shield spell's pool) or a party weighed to nothing left
// it lying, and the next hurt inside the window - an orc's Fireball, a poison's round - was read as that blow: the
// Wrath's Nova on a spell, Spite paying a rat for a fall.
let _pending = null;
function setDoorOpen(entity) {
  if (!entity?.isPlayer || entity.peer) return;
  _pending = landedBlow();
}

// ── Wrath of the Warden: a blow that leaves me under the line ───────
export function setHurt(entity, { before, after }) {
  if (!entity?.isPlayer || entity.peer) return;
  const blow = _pending;
  _pending = null;
  if (!blow) return;   // L3: a fall, a poison's tick, a spell's burn - no foe's blow, no Spite and no Wrath
  spite(entity, blow, before - after);
  const v = tierOf(entity, 'ruhn', 2);
  const max = entity?.maxHealth;
  if (!v || !(max > 0) || !(after > 0)) return;
  const line = max * WRATH_BELOW;
  if (!(before >= line && after < line)) return;
  const now = _now();
  if (now < _s.wrathReady) return;
  _s.wrathReady = now + v.recover;
  _s.wrathUntil = now + WRATH_SECONDS;
  _s.recovering.add('wrath');
  const struck = nova(v.nova);
  say(struck ? `Wrath of the Warden! The gate's fire bursts from you (${struck} struck).` : 'Wrath of the Warden! The gate\'s fire bursts from you.');
  sound('wrath');
}
/** The Nova: every live foe within NOVA_METRES of my feet takes `n` - never an ally or a foe at peace (H1), one on
 *  another floor (M4), one behind a wall (M4: the host's own ray, where it has one - `door.clear`), or one the fire
 *  cannot touch (L7). Answers how many it struck. */
function nova(n) {
  const door = playerDoor();
  const feet = door?.feet();
  if (!door || !feet) return 0;
  let struck = 0;
  for (const f of door.foes()) {
    if (f.dead || !f.ai?.feet || flat2(f.ai.feet, feet) > NOVA_METRES || spared(f)) continue;
    if (rise(f.ai.feet, feet) > REACH_RISE_M || fireProof(f.entity)) continue;
    if (door.clear && !door.clear(feet, f.ai.feet)) continue;
    door.hurtFoe(f, n);
    struck++;
  }
  return struck;
}

// ── a kill of mine: the Rampage, Eventide ───────────────────────────
/** Eventide's shadow: Chameleon (classic 23,0 - it breaks when I strike) for `rounds` magic rounds, no save, no roll.
 *  AUDIT SET M5: one round MORE than it names - an effect ends at its Nth round's tick, and online the ticks fall every
 *  five seconds wherever the shared clock says, so N rounds lasted between N-1 and N of them (a Faint shadow could end
 *  at once); N+1 lasts N rounds at the least, as the card says. */
export const eventideBundle = (rounds) => ({
  name: 'Eventide', rangeType: 0, element: 4,
  effects: [{
    type: 23, subType: 0, durationBase: Math.max(1, rounds | 0) + 1, durationMod: 0, durationPerLevel: 1,
    chanceBase: 1, chanceMod: 1, chancePerLevel: 1,
    magnitudeBaseLow: 1, magnitudeBaseHigh: 1, magnitudeLevelBase: 1, magnitudeLevelHigh: 1, magnitudePerLevel: 1,
  }],
});
/** AUDIT SET L8: a kill that never counts - the city watch, and my own ally (Renown's own rule, net/renownTracker.js
 *  neverPays): a summoned daedra of mine fed the Rampage. */
const neverCounts = (entity) => entity?.mobileType === KNIGHT_CITY_WATCH || entity?.team === 'PlayerAlly' || entity?.mobileTeam === 'PlayerAlly';
export function setKill(entity = null) {
  if (neverCounts(entity)) return;
  const door = playerDoor();
  const me = door?.player?.();
  const t = awakeTiersOf(me);
  if (!t) return;
  const now = _now();
  if (t.get('dagon')?.[2]) {
    const had = rampageStacks(now);
    _s.rampage = Math.min(RAMPAGE_STACKS, had + 1);
    _s.rampageUntil = now + RAMPAGE_SECONDS;   // a kill refreshes them all
    if (_s.rampage > had) say(`Rampage ${'I'.repeat(_s.rampage)}`);
  }
  const noc = t.get('nocturnal')?.[2];
  if (noc && now >= _s.eventideReady) {
    _s.eventideReady = now + noc.recover;
    _s.recovering.add('eventide');
    door.castOnPlayer(eventideBundle(noc.rounds));
    say('Eventide - Nocturnal\'s shadows take you.');
    sound('eventide');
  }
}

// ── Mora's Mantle: the cost and the Eye ─────────────────────────────
export function setCastCost(entity, sp) {
  const v = tierOf(entity, 'mora', 1);
  return v ? (sp * (100 - v.less)) / 100 : sp;
}
export const setAbsorbChance = (target) => tierOf(target, 'mora', 2)?.absorb ?? 0;

// ── the round: "ready again" ────────────────────────────────────────
const READY = Object.freeze({
  unbroken: { at: () => _s.unbrokenReady, line: 'Unbroken is ready again.' },
  wrath: { at: () => _s.wrathReady, line: 'Wrath of the Warden is ready again.' },
  eventide: { at: () => _s.eventideReady, line: 'Eventide is ready again.' },
});
export function setRound(entity) {
  if (!entity?.isPlayer || entity.peer || !_s.recovering.size) return;
  const now = _now();
  for (const k of [..._s.recovering]) {
    if (now < READY[k].at()) continue;
    _s.recovering.delete(k);
    if (setsAwake()) say(READY[k].line);
  }
}

// ── registered at import ───────────────────────────────────────────
export const SIGIL_SETS_POWER = 'sigilSets';
registerEntityFold(SIGIL_SETS_POWER, setFold);
registerWeaponBlowMod(SIGIL_SETS_POWER, setBlow);
registerPlayerStruckListener(SIGIL_SETS_POWER, setStruck);
registerPlayerStrikeListener(SIGIL_SETS_POWER, setStrike);   // AUDIT SET M2
registerPlayerDamageMod(SIGIL_SETS_POWER, setDamageMod);
registerPlayerDeathSave(SIGIL_SETS_POWER, setDeathSave);
registerPlayerHurtListener(SIGIL_SETS_POWER, setHurt);
registerPlayerDoorOpen(SIGIL_SETS_POWER, setDoorOpen);   // AUDIT FINAL F10
registerPlayerKillListener(SIGIL_SETS_POWER, setKill);
registerSpellCostMod(SIGIL_SETS_POWER, setCastCost);
registerAbsorptionChance(SIGIL_SETS_POWER, setAbsorbChance);
registerMagicRoundHook(SIGIL_SETS_POWER, setRound);

/** What the HUD may show of the powers now (SET5): the Rampage's stacks and the time left on each window and each
 *  recovery, in whole seconds - 0 for one not running. */
export function setPowerStates(now = _now()) {
  const left = (t) => Math.max(0, Math.ceil(t - now));
  return {
    rampage: rampageStacks(now), rampageLeft: rampageStacks(now) ? left(_s.rampageUntil) : 0,
    halvedLeft: left(_s.halvedUntil), unbrokenLeft: left(_s.unbrokenReady),
    wrathLeft: left(_s.wrathUntil), wrathRecoverLeft: left(_s.wrathReady),
    eventideLeft: left(_s.eventideReady),
  };
}

/** SET5: THE HUD'S CHIPS for the set powers now - each `{ key, set, name, text, state }`: a window running
 *  (`state` 'active' - the Rampage's stacks and seconds, Unbroken's halving, the Wrath's fury) or, while I wear the
 *  power awake, its recovery ('recovering'). Only a power whose 6-piece tier is awake on me shows (a stack or a window
 *  left over from a set taken off does nothing, and says nothing); [] for anyone but me, and while the sets sleep. */
export function setHudChips(entity, now = _now()) {
  const t = awakeTiersOf(entity);
  if (!t) return [];
  const st = setPowerStates(now);
  const time = (n) => (n >= 60 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : `${n}s`);
  const out = [];
  if (t.get('dagon')?.[2] && st.rampage) out.push({ key: 'rampage', set: 'dagon', name: `Rampage ${'I'.repeat(st.rampage)}`, text: time(st.rampageLeft), state: 'active' });
  if (t.get('malacath')?.[2]) {
    if (st.halvedLeft) out.push({ key: 'unbroken', set: 'malacath', name: 'Unbroken', text: time(st.halvedLeft), state: 'active' });
    else if (st.unbrokenLeft) out.push({ key: 'unbroken', set: 'malacath', name: 'Unbroken', text: time(st.unbrokenLeft), state: 'recovering' });
  }
  if (t.get('ruhn')?.[2]) {
    if (st.wrathLeft) out.push({ key: 'wrath', set: 'ruhn', name: 'Wrath', text: time(st.wrathLeft), state: 'active' });
    else if (st.wrathRecoverLeft) out.push({ key: 'wrath', set: 'ruhn', name: 'Wrath', text: time(st.wrathRecoverLeft), state: 'recovering' });
  }
  if (t.get('nocturnal')?.[2] && st.eventideLeft) out.push({ key: 'eventide', set: 'nocturnal', name: 'Eventide', text: time(st.eventideLeft), state: 'recovering' });
  return out;
}

/** Tests only: a clock of their own (seconds), and every power fresh. */
export function _setSetPowersClockForTests(fn) { _now = typeof fn === 'function' ? fn : () => performance.now() / 1000; }
export function _resetSetPowersForTests() { _s = fresh(); _carry = new WeakMap(); _blow = null; _say = (line) => { hudText(line); }; _sound = null; }
