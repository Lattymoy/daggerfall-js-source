// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SCHOOLS3/4 (2026-10-13) — WHAT THE PATHS DO. bible/06-Systems/Arcane-Specialisations.md section 5.
//
// The law (systems/arcanePaths.js) says which path a mage chose and when it is AWAKE; this file does what each path's
// passive and its signature spell's RIDER say, through the seams the Sigil Sets and the loot opened - registered here at
// import, each a no-op for anyone but MY entity with its path awake and no refereed fight (sigil.js sigilDueling, the
// word every loot and set power sleeps on):
//
//   Spellsteel, Unseen Strike,   the SPELL POWER modifier (spellPower.js - MY damage spell at a foe): a percent onto
//   Sanguine Tide, Conflux,      its landing, beside the loot's own
//   Dawn's Ward
//   Sunder, the Seer's mark      the SPELL PIERCE modifier: points off the foe's saving throw
//   Attuned Wards                the CAST COST modifier (spellcost.js)
//   Between Moments              the CAST SPEED modifier (castSpeed.js)
//   Glamour                      the entity FOLD (entityMods.js): attributes and skills
//   Foresight                    the BLOW EVASION (playerEntity.js - asked before any modifier, a foe's BLOW alone, the
//                                door's own mark: sigilSetPowers.js pendingPlayerBlow)
//   the Warden's guard           the DAMAGE modifier (the same door; whole points, the fraction carried)
//   Slip Away, Absolution        the HURT listener (a hurt that crosses its line, with a recovery)
//   Steadfast                    the MAGIC ROUND
//   Death's Due, Soul Well       the KILL listener (playerKills.js)
//   the Wardwright's ward        the ABSORPTION chance (absorption.js - DFU's own two gates)
//   every signature RIDER        the LANDED listener (spellPower.js - the cast engine's word that MY spell landed:
//                                scenes/hostMagic.js applySpellToFoe and applySpellToPlayer), acting through the
//                                host's door (playerDoor.js): a blow on a foe through its own pool's door, a bundle on
//                                me as a potion lands, the heal and the magicka through playerHeal.js
//
// NEVER AT A PLAYER: a rider answers only a signature spell of MY awake path that landed on a FOE (or, a self-cast, on
// me); a duel's opponent and a party mate take the plain bundle. THE CLOCK is real seconds, as the set powers' (a
// recovery a player times with a watch); a reload starts every power ready.
// ═══════════════════════════════════════════════════════════════════

import { SKILLS } from './skills.js';
import { pathAwake, isSignatureSpell, PATH_NUMBERS, PATH_BY_ID } from './arcanePaths.js';
import { sigilDueling } from './sigil/sigil.js';
import { registerSpellPowerMod, registerSpellPierceMod, registerSpellLandedListener } from './spell/spellPower.js';
import { registerSpellCostMod, effectSchool } from './spellcost.js';
import { registerCastSpeedMod } from './castSpeed.js';
import { registerEntityFold, newMods, EMPTY_MODS } from './entityMods.js';
import { registerPlayerDamageMod, registerPlayerHurtListener, registerPlayerBlowEvasion, playerEntity } from '../characters/playerEntity.js';
import { registerPlayerKillListener } from './playerKills.js';
import { registerMagicRoundHook } from './worldTick.js';
import { registerAbsorptionChance } from './absorption.js';
import { pendingPlayerBlow } from './sigil/sigilSetPowers.js';   // the door's one law of what a foe's blow is
import { healMine, manaMine } from './playerHeal.js';
import { playerDoor } from './playerDoor.js';
import { isMagicallyConcealed } from './effects.js';
import { near, foeGroup, elementShare } from './loot/lootPowers.js';   // AUDIT SCHOOLS (L1 H1-H2, L3 F1): the one reach law, the one foe group, the one element share
import { KNIGHT_CITY_WATCH } from '../characters/mobile/mobileTypes.js';
import { healthShare } from '../combat/healthShare.js';   // FIELD BUGS 2026-10-18f RELAY-SHARE: a body's share of its health, the one law
import { hudText } from './notify.js';
import { t } from './textManager.js';
import { regenShare } from './courtRules.js';   // AUDIT WORLD-EVENTS L1-3: the Warden's Steadfast is a natural regeneration - a made level holds it

// ── the numbers: the law's own (arcanePaths.js PATH_NUMBERS - the one home the words print and this file does) ──
const N = PATH_NUMBERS;
/** The classic elements by index (DFU ElementTypes) as the loot's element share names them. */
const ELEMENT_NAMES = Object.freeze(['fire', 'frost', 'poison', 'shock', 'magic']);

// ── the session's memory, its clock, its dice and its voice ─────────
let _now = () => performance.now() / 1000;
let _rand = Math.random;
const fresh = () => ({
  slipReady: 0, absolutionReady: 0,      // Trickster, Hierophant
  conflux: 0, confluxUntil: 0,           // Elementalist
  guardUntil: 0, guardOwed: 0,           // Warden's Living Aegis, and the fraction its lighter blows carry
  wardUntil: 0,                          // Wardwright's Prismatic Ward
  marks: new WeakMap(),                  // Seer: foe entity -> laid open until
  stacked: new WeakSet(),                // Elementalist: the casts Conflux has counted (one stack a cast)
});
let _s = fresh();
let _say = (line) => { hudText(line); };
/** The host's voice for the passives' lines (scenes/world.js); the HUD's own door by default. */
export function setArcanePowersVoice({ say = null } = {}) { if (typeof say === 'function') _say = say; }
const say = (line) => { try { _say(line); } catch { /* a line is not the power's problem */ } };

/** MY entity's awake path's id, or null - and none in a refereed fight. */
export function awakePathId(entity) {
  if (sigilDueling()) return null;
  return pathAwake(entity)?.id ?? null;
}
const me = () => playerDoor()?.player?.() ?? playerEntity;
const share = (e) => healthShare(e) ?? 1;   // FIELD BUGS 2026-10-18f RELAY-SHARE: the one law (combat/healthShare.js)
/** AUDIT SCHOOLS L1 H2: through the loot's one foe group (lootPowers.js foeGroup) - a class foe's careerIndex is its
 *  class's, and read as a monster's it named a Barbarian, a Knight and the City Watch undead. */
const undeadOrDaedra = (t) => { const g = foeGroup(t); return g === 'undead' || g === 'daedra'; };
const neverCounts = (e) => e?.mobileType === KNIGHT_CITY_WATCH || e?.team === 'PlayerAlly' || e?.mobileTeam === 'PlayerAlly';
const shieldHolds = (e) => (e?.activeEffects ?? []).some((a) => a.kind === 'shield' && !a.ended && (a.shieldRemaining ?? 0) > 0);

/** A bundle on me, cast as a potion lands (no save, no chance roll) - one round more than it says, as Eventide's, so it
 *  lasts what it says however the round falls. */
const selfBundle = (name, type, subType, rounds, { magnitude = 0, chance = 1 } = {}) => ({
  name, rangeType: 0, element: 4,
  effects: [{
    type, subType, durationBase: Math.max(1, rounds | 0) + 1, durationMod: 0, durationPerLevel: 1,
    chanceBase: chance, chanceMod: 0, chancePerLevel: 1,
    magnitudeBaseLow: magnitude, magnitudeBaseHigh: magnitude, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  }],
});
/** A rider's bundle is named for the signature spell that cast it (the record's own name). */
const spellName = (id) => PATH_BY_ID[id].spell.name;
/** A rider's bundle on me - a power's: merged with my own like-kind effect as DFU merges, the larger Shield pool or ward
 *  chance kept (AUDIT SCHOOLS L1 M1: effects.js powerCast). */
const castOnMe = (bundle) => { try { playerDoor()?.castOnPlayer?.(bundle, { power: true }); } catch { /* the door is the host's */ } };

/** The other live foes my harm may reach near the struck foe, nearest first - the loot's one reach law (lootPowers.js
 *  near: never an ally or a foe at peace, never one a storey away, never one behind a wall). */
function foesNear(struck, metres) {
  const door = playerDoor();
  const at = struck?.ai?.feet;
  if (!door || !Array.isArray(at)) return [];
  const flat = (f) => Math.hypot(f.ai.feet[0] - at[0], f.ai.feet[2] - at[2]);
  return near(door, at, metres, struck.entity).filter((f) => f !== struck).sort((a, b) => flat(a) - flat(b));
}
const hurt = (f, n) => { if (f && n >= 1) playerDoor()?.hurtFoe?.(f, n); };
/** An arc of `spell`'s element on another foe: none on one IMMUNE to it, half on one that RESISTS (lootPowers.js
 *  elementShare - the career's own word, as the loot's Chain Lightning arc). */
const arcOn = (f, amount, spell) => hurt(f, Math.floor(amount * elementShare(f.entity, ELEMENT_NAMES[spell?.element] ?? 'magic')));

// ── the passives ────────────────────────────────────────────────────

/** Sanguine Tide's whole percent - 1 for every `perMissing` percent of my health missing, in whole numbers (a share's
 *  float would read 20% missing as 19.99...). */
function sanguinePct(e) {
  if (!(e?.maxHealth > 0) || !Number.isFinite(e.health)) return 0;
  return Math.max(0, Math.floor((100 * (e.maxHealth - e.health)) / (e.maxHealth * N.sanguine.perMissing)));
}
/** MY damage spell's power at a foe: Spellsteel, Unseen Strike, Sanguine Tide, Conflux, Dawn's Ward. */
export function pathSpellPower(caster, target) {
  switch (awakePathId(caster)) {
    case 'battlemage': return shieldHolds(caster) ? N.spellsteel.pct : 0;
    case 'shadowcaster': return isMagicallyConcealed(caster) ? N.unseenStrike.pct : 0;
    case 'bloodmage': return Math.min(N.sanguine.most, sanguinePct(caster));
    case 'elementalist': return _now() < _s.confluxUntil ? N.conflux.pct * _s.conflux : 0;
    case 'lightbringer': return undeadOrDaedra(target) ? N.dawnsWard.pct : 0;
    default: return 0;
  }
}
/** The points off a foe's saving throw: Sunder's, and the Seer's mark on the foe Psychic Lance laid open. */
export function pathSpellPierce(caster, target) {
  switch (awakePathId(caster)) {
    case 'spellbreaker': return N.sunder.points;
    case 'seer': return target && _now() < (_s.marks.get(target) ?? 0) ? N.psychicLance.points : 0;
    default: return 0;
  }
}
/** Attuned Wards: a spell all of whose effects are Alteration's or Thaumaturgy's costs less. */
export function pathCastCost(entity, sp, spell = null) {
  if (awakePathId(entity) !== 'wardwright') return sp;
  const fx = (spell?.effects ?? []).filter((e) => e && e.type > -1);
  if (!fx.length || !fx.every((e) => effectSchool(e) === SKILLS.Alteration || effectSchool(e) === SKILLS.Thaumaturgy)) return sp;
  return (sp * (100 - N.attunedWards.pct)) / 100;
}
/** Between Moments: my casting hands' speed. */
export const pathCastSpeed = (entity) => (awakePathId(entity) === 'riftwalker' ? N.betweenMoments.pct : 0);
/** Glamour: the Enchanter's attributes and skills, folded onto my entity. */
export function pathFold(entity) {
  if (awakePathId(entity) !== 'enchanter') return EMPTY_MODS;
  const mods = newMods();
  mods.stats.personality = N.glamour.personality;
  mods.skills[SKILLS.Etiquette] = N.glamour.etiquette;
  mods.skills[SKILLS.Streetwise] = N.glamour.streetwise;
  return mods;
}
/** Foresight: a foe's blow, one in eight, evaded - asked by the door BEFORE any modifier (AUDIT SCHOOLS L1 M3: as a
 *  damage modifier it ran after the sets', which spent Iron Hide's ward and Gearward's winding on a blow that never came). */
export function pathEvade(entity) {
  if (awakePathId(entity) !== 'seer' || !pendingPlayerBlow()) return false;
  if (!(_rand() < 1 / N.foresight.oneIn)) return false;
  say(t('schools.say.foresight', 'Foresight: you saw the blow coming.'));
  return true;
}
/** The damage door: the Warden's guard - a foe's blow lighter, in whole points with the fraction carried (AUDIT SCHOOLS
 *  L1 M2: a raw share left health fractional - 183.2 after three 7-point blows - as Hold the Line's carry does not). */
export function pathDamageMod(entity, dmg) {
  if (awakePathId(entity) !== 'warden' || !pendingPlayerBlow() || !(_now() < _s.guardUntil)) return dmg;
  const owed = (dmg * N.livingAegis.lighter) / 100 + _s.guardOwed;
  const cut = Math.floor(owed + 1e-9);
  _s.guardOwed = owed - cut;
  return Math.max(0, dmg - cut);
}
/** The hurt listener: Slip Away and Absolution - a hurt that takes me across the line, while ready. Never one a death
 *  save turned aside (AUDIT SCHOOLS L1 M4: `saved` - the Vigil's and Shed Skin's own rule, AUDIT 625 P1: the death that
 *  never happened spent Absolution's heal and its three minutes).
 *  @param {any} entity @param {{ before?: number, after?: number, saved?: boolean }} [hurt] */
export function pathHurt(entity, { before = 0, after = 0, saved = false } = {}) {
  const id = awakePathId(entity);
  if (!id || saved || !(after > 0) || !(entity.maxHealth > 0)) return;
  const crossed = (line) => after < entity.maxHealth * line && before >= entity.maxHealth * line;
  const now = _now();
  if (id === 'trickster' && crossed(N.slipAway.below) && now >= _s.slipReady) {
    _s.slipReady = now + N.slipAway.recover;
    castOnMe(selfBundle(PATH_BY_ID.trickster.passive.name, 13, 0, N.slipAway.rounds));
    say(t('schools.say.slipAway', 'Slip Away: you fade from sight.'));
  } else if (id === 'hierophant' && crossed(N.absolution.below) && now >= _s.absolutionReady) {
    _s.absolutionReady = now + N.absolution.recover;
    healMine(entity, (entity.maxHealth * N.absolution.heal) / 100);
    say(t('schools.say.absolution', 'Absolution: your wounds close.'));
  }
}
/** The magic round: Steadfast. */
export function pathRound(entity) {
  if (awakePathId(entity) !== 'warden' || !shieldHolds(entity)) return;
  if (entity.health > 0 && entity.health < entity.maxHealth) { const held = regenShare((entity.maxHealth * N.steadfast.pct) / 100, 'steadfast', entity); if (held > 0) healMine(entity, held); }   // AUDIT WORLD-EVENTS L1-3: held in a made level (systems/courtRules.js)
}
/** My kill: Death's Due and Soul Well. */
export function pathKill(foe) {
  if (!foe || neverCounts(foe)) return;
  const m = me();
  const id = awakePathId(m);
  if (id === 'necromancer') {
    healMine(m, (m.maxHealth * N.deathsDue.health) / 100);
    manaMine(m, (m.maxMagicka * N.deathsDue.magicka) / 100);
  } else if (id === 'soulbinder') {
    const trapped = (foe.activeEffects ?? []).some((a) => a.kind === 'soulTrap' && !a.ended && !a.by);   // mine: a peer's trap carries `by`
    manaMine(m, (m.maxMagicka * (trapped ? N.soulWell.trapped : N.soulWell.magicka)) / 100);
  }
}
/** The Wardwright's ward: the chance a Destruction spell that strikes me is absorbed, while Prismatic Ward's holds. */
export const pathAbsorbChance = (target) => (awakePathId(target) === 'wardwright' && _now() < _s.wardUntil ? N.prismaticWard.chance : 0);

// ── the riders ──────────────────────────────────────────────────────

/** MY spell LANDED (spellPower.js tellSpellLanded): Conflux's stack for a damage spell of mine at a foe, and the
 *  signature spell's rider when it is MY awake path's. `took` is what the foe could lose (AUDIT SCHOOLS L1 M6 - never
 *  the overkill of a bolt on a 3-point rat); `cast` the cast's token, its `cost` the magicka it really took (L1 L2).
 *  @param {{ caster?: any, target?: any, foe?: any, spell?: any, r?: any, self?: boolean, reflected?: boolean, took?: number, cast?: any }} [landing] */
export function pathLanded({ caster = null, target = null, foe = null, spell = null, r = null, self = false, reflected = false, took = null, cast = null } = {}) {
  const id = awakePathId(caster);
  // AUDIT FB1018f L3-2: a spell on a stand-in its referee turns whole (`warded` - the Warden's ward, the Remnant shut, the
  // Spire's turned blows: scenes/eliteGates/egFight.js turnStandIn) landed nothing - no Siphon Life, no Conflux, no rider
  // answers it, as the leech refuses a warded blow (systems/loot/lootPowers.js lootStrike)
  if (!id || !r || reflected || target?.warded) return;
  const landed = Number.isFinite(took) ? took : Number.isFinite(r.damage) ? r.damage : 0;
  const paid = Number.isFinite(cast?.cost) ? cast.cost : 0;
  const now = _now();
  // Conflux: ONE stack a cast (AUDIT SCHOOLS L1 L1, L2 F6: an area spell over five foes built five) - a landing with no
  // cast token (a Cast When Strikes proc, BAL9's "my spell") is its own cast
  if (id === 'elementalist' && !self && landed > 0 && target && !target.isPlayer && !(cast && _s.stacked.has(cast))) {
    if (cast) _s.stacked.add(cast);
    _s.conflux = Math.min(N.conflux.stacks, (now < _s.confluxUntil ? _s.conflux : 0) + 1);
    _s.confluxUntil = now + N.conflux.seconds;
  }
  if (!isSignatureSpell(spell) || spell.path !== id) return;
  if (self) { if (spell.rangeType === 0) selfRider(id, caster, r, now); return; }
  if (!target || target.isPlayer) return;
  switch (id) {
    case 'battlemage':
      if (landed > 0) castOnMe(selfBundle(spellName('battlemage'), 35, 255, N.aegisBolt.rounds, { magnitude: Math.max(1, Math.min(landed * N.aegisBolt.times, Math.round((caster.maxHealth * N.aegisBolt.most) / 100))) }));
      break;
    case 'trickster':
      if (r.paralyzed > 0) castOnMe(selfBundle(spellName('trickster'), 23, 0, N.fleetingHold.rounds));
      break;
    case 'riftwalker':
      if (landed > 0) for (const f of foesNear(foe, N.riftLance.metres)) arcOn(f, landed * N.riftLance.share, spell);
      break;
    case 'shadowcaster':
      if (landed > 0) castOnMe(selfBundle(spellName('shadowcaster'), 24, 0, N.shadowBolt.rounds));
      break;
    case 'spellbreaker':
      if (landed > 0) manaMine(caster, paid * N.unravel.back);   // AUDIT SCHOOLS L1 L2, L2 F7: of what the cast took
      break;
    case 'bloodmage':
      if (landed > 0 && target.health > 0 && share(target) < N.bloodBoil.below) hurt(foe, landed);
      break;
    case 'elementalist':
      if (landed > 0) for (const f of foesNear(foe, N.chainLightning.metres).slice(0, N.chainLightning.foes)) arcOn(f, landed * N.chainLightning.share, spell);
      break;
    case 'seer':
      if (landed > 0) _s.marks.set(target, now + N.psychicLance.seconds);
      break;
    case 'lightbringer':
      if (landed > 0) {
        healMine(caster, landed * N.dawnbolt.heal);
        if (undeadOrDaedra(target) && target.health > 0) hurt(foe, Math.round(landed * N.dawnbolt.burn));
      }
      break;
    case 'enchanter':
      // AUDIT SCHOOLS L1 M5: only a foe this cast CALMED - hostile before it (the host clears the flag after this word) and
      // one with a mind here to calm (the host calms `foe.ai` alone); a foe already at peace, or one with no ai, gave a
      // free cast. One no Pacify sways (`pacifyImmune`, the gate's Warden) never reports `pacify` (effects.js refuses it)
      if (r.pacify && foe?.ai && foe.ai.isHostile !== false) manaMine(caster, paid);
      break;
    case 'necromancer':
      if (landed > 0) healMine(caster, landed * N.siphonLife.share);
      break;
    case 'soulbinder':
      if (landed > 0) manaMine(caster, landed * N.soulLance.share);
      break;
    default: break;
  }
}
/** A signature self-cast's rider: the Warden's guard, the Wardwright's ward, the Hierophant's Spell Resistance. */
function selfRider(id, caster, r, now) {
  if (r.chanceFailed) return;
  if (id === 'warden') _s.guardUntil = now + N.livingAegis.seconds;
  else if (id === 'wardwright') _s.wardUntil = now + N.prismaticWard.seconds;
  else if (id === 'hierophant') castOnMe(selfBundle(spellName('hierophant'), 22, 255, N.sanctify.rounds, { chance: N.sanctify.chance }));
}

// ── registered at import ───────────────────────────────────────────
export const ARCANE_POWERS = 'arcanePowers';
registerSpellPowerMod(ARCANE_POWERS, pathSpellPower);
registerSpellPierceMod(ARCANE_POWERS, pathSpellPierce);
registerSpellCostMod(ARCANE_POWERS, pathCastCost);
registerCastSpeedMod(ARCANE_POWERS, pathCastSpeed);
registerEntityFold(ARCANE_POWERS, pathFold);
registerPlayerDamageMod(ARCANE_POWERS, pathDamageMod);
registerPlayerBlowEvasion(ARCANE_POWERS, pathEvade);   // AUDIT SCHOOLS L1 M3: Foresight, before any modifier
registerPlayerHurtListener(ARCANE_POWERS, pathHurt);
registerMagicRoundHook(ARCANE_POWERS, pathRound);
registerPlayerKillListener(ARCANE_POWERS, pathKill);
registerAbsorptionChance(ARCANE_POWERS, pathAbsorbChance);
registerSpellLandedListener(ARCANE_POWERS, pathLanded);

/** Tests only: every recovery and window fresh, a clock and dice of their own (seconds; [0, 1)). */
export function _resetArcanePowersForTests() { _s = fresh(); _say = (line) => { hudText(line); }; }
export function _setArcanePowersClockForTests(fn) { _now = typeof fn === 'function' ? fn : () => performance.now() / 1000; }
export function _setArcanePowersRandForTests(fn) { _rand = typeof fn === 'function' ? fn : Math.random; }
