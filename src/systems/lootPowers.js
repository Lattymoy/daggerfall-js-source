// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LOOT4 (2026-10-01) — THE KIT: WHAT A PIECE DOES.
//
// The Loot arc (bible/06-Systems/Loot-Arc.md section 6; Mac: "Do you
// wanna turn this into an arc and do all of the above?"). LR1's six
// affix kinds are numbers a wearer carries, folded onto the entity
// (systems/lootRarity.js affixFold). Five more DO something, and they do
// it here, through the seams the Sigil Sets opened (SET2) - registered at
// import, each a no-op for anyone but MY entity, offline and online:
//
//   elemental   the BLOW modifier: that much of its element on every
//               blow of the weapon in hand at a foe - none on a foe
//               IMMUNE to it, half on one that RESISTS (the career's
//               own word, spellcast.js careerTolerance)
//   slayer      the BLOW modifier: that much more (%) of the weapon in
//               hand's blow at its kind of foe (DFU's own four groups:
//               combat/formulas.js enemyEntityGroup)
//   leech       a STRIKE listener (the blow that LANDED, its final
//               damage): that share of it heals me, the fraction carried
//   thorns      a LANDED-BLOW listener (sigilSetPowers.js - the one law
//               of a foe's blow that took my health): the foe takes that
//               much back, all I wear summed under THORNS_CAP
//   focus       a CAST COST modifier: that share off my spells'
//               magicka, all I wear summed under FOCUS_CAP
//
// LOOT5 (section 7): EVERY LEGENDARY A POWER - the records' own (systems/
// lootRarity.js LEGENDARY_POWERS), done here through the same seams and a
// few more (my damage door's modifier, death save and hurt listener, my
// kills, the absorption roll, the magic round, the host door's finders).
// A power counts ONCE however many pieces carry it; a WEAPON's power rides
// that weapon's own blows (the rest of it while it is wielded); armour's
// and jewellery's ride every blow of mine. A power sleeps in a duel, as a
// set does (sigilSets.js setsDueling).
//
// NEVER ON A PLAYER (the arc's law 5): a blow at a player is a duel's,
// and the blow modifier refuses it; a duel's blow at me passes my damage
// door without asking the port (playerEntity.js hurtPlayer's `spare`),
// so no thorn answers it. The gate's Warden is out of every reach, as he
// is the sets' (his ward turns a blow whole; his strikes carry no mark).
// ═══════════════════════════════════════════════════════════════════

import { registerWeaponBlowMod, registerEntityFold, newMods, EMPTY_MODS } from './entityMods.js';
import { effectSchool } from './spellcost.js';   // LOOT15: Stendarr's Mercy reads a spell's school
import { hoodUp } from './survival/temperature.js';   // LOOT15: Unseen reads the hood (HOOD-SAID's one law)
import { registerPlayerStrikeListener, enemyEntityGroup, ENEMY_GROUPS } from '../combat/formulas.js';
import { registerSpellCostMod } from './spellcost.js';
import { registerCastSpeedMod } from './castSpeed.js';   // CAST-SPEED: the castSpeed lines' door onto a cast's rate
import { registerPlayerBlowLanded, pendingPlayerBlow, REACH_RISE_M } from './sigilSetPowers.js';
import { playerDoor } from './playerDoor.js';
import { careerTolerance, EFFECT_FLAGS } from './spellcast.js';
import { lootRarityOn, validAffix, powerOf, registerLegendaryFind, readLines } from './lootRarity.js';   // GEM1: readLines, law 6's reading
import { equipTableOf } from './equip.js';
import { registerPlayerDamageMod, registerPlayerDeathSave, registerPlayerHurtListener, playerEntity } from '../characters/playerEntity.js';
import { registerPlayerKillListener } from './playerKills.js';
import { registerAbsorptionChance } from './absorption.js';
import { registerMagicRoundHook, skyMinutes } from './worldTick.js';   // TIME1: a moon power answers to the sky's night
import { setsDueling } from './sigilSets.js';
import { addGoldPieces, addItem } from './inventory.js';
import { createPellets } from './thunderlock.js';   // GILDED1: the Hour Tolls gives a felling shot's pellet back
import { isNight } from '../world/worldClock.js';
import { hudText } from './notify.js';
import { healMine, _resetPlayerHealForTests } from './playerHeal.js';   // SERPENT-SET: the one heal a power gives, below this file and the sets'
import { weaponSkillUsed } from '../characters/weapons.js';
import { SKILLS } from './skills.js';
import { friendlyProtected } from '../combat/playerWeapon.js';
import { KNIGHT_CITY_WATCH } from '../characters/mobileTypes.js';

/** All the thorns a wearer's pieces sum to, at most, a blow. */
export const THORNS_CAP = 25;
/** All the focus a wearer's pieces sum to, at most (%). */
export const FOCUS_CAP = 30;
/** LOOT5: all the loot takes off a spell's magicka, focus and powers together, at most (%). */
export const SPELL_CUT_MOST = 50;
/** CAST-SPEED: all the casting speed a wearer's pieces sum to, at most (%). */
export const CAST_SPEED_CAP = 30;

const mine = (e) => !!e?.isPlayer && !e.peer;
/** A piece's valid lines of one kind - none with the switch off (off is DFU exactly). */
export function linesOf(item, id) {
  if (!lootRarityOn() || !Array.isArray(item?.affixes)) return [];
  return readLines(item).filter((a) => a?.id === id && validAffix(a));   // GEM1: a piece's gems as law 6 holds them (bible/06-Systems/Gem-Sockets.md)
}
/** What MY entity wears - the equip table's pieces. */
export const wornPieces = (entity) => (entity ? equipTableOf(entity).filter(Boolean) : []);
/** A kind's lines summed over everything worn. */
export const wornSum = (entity, id) => wornPieces(entity).reduce((n, it) => n + linesOf(it, id).reduce((m, a) => m + a.value, 0), 0);

/** The kind of foe a slayer's edge reads - DFU's own four groups (FormulaHelper.GetEnemyGroup): a class foe (the Human
 *  affinity) a humanoid, a monster by its career (a vampire undead, a dragonling an animal, an orc a humanoid); an
 *  atronach, the horse and a player none. */
export function foeGroup(target) {
  if (!target || target.isPlayer) return null;
  if (target.affinity === 'Human') return 'humanoid';
  const g = enemyEntityGroup(target.careerIndex);
  return g === ENEMY_GROUPS.Undead ? 'undead' : g === ENEMY_GROUPS.Daedra ? 'daedra' : g === ENEMY_GROUPS.Humanoid ? 'humanoid'
    : g === ENEMY_GROUPS.Animals ? 'animal' : null;
}
const ELEMENT_FLAG = Object.freeze({ fire: EFFECT_FLAGS.Fire, frost: EFFECT_FLAGS.Frost, shock: EFFECT_FLAGS.Shock, poison: EFFECT_FLAGS.Poison });
/** How much of an element a foe takes: none IMMUNE, half when it RESISTS, else whole. */
export function elementShare(target, element) {
  const t = careerTolerance(target?.career ?? {}, ELEMENT_FLAG[element] ?? 0);
  return t === 'Immune' ? 0 : t === 'Resistant' ? 0.5 : 1;
}

// ── the session's memory ───────────────────────────────────────────
/** @type {WeakMap<object, number>} */
let _carry = new WeakMap();   // a weapon's (or my fists') per-cent fraction, carried to its next blow
// SERPENT-SET: the heal (and the leech's fraction it carries) is systems/playerHeal.js's - the serpent's Shed Skin heals
// through it too, and sigilSetPowers.js, which this file reads the blow's law out of, may not import this file
/** A per-cent share of a blow, the fraction carried on its weapon (the sets' own law, sigilSetPowers.js setBlow). */
function shareOf(key, damage, pct) {
  const exact = (damage * pct) / 100 + (_carry.get(key) ?? 0);
  const more = Math.floor(exact + 1e-9);
  _carry.set(key, Math.max(0, exact - more));
  return more;
}

// ── LOOT5: the powers' memory, clock, chance and voice ─────────────
let _now = () => performance.now() / 1000;
let _rand = Math.random;
const freshState = () => ({
  flow: 0, flowUntil: 0,                 // Way of the Sword
  bedrock: 0, bedrockUntil: 0,           // Bedrock
  charges: 0,                            // Dawnward
  vigilReady: 0, graceReady: 0, hasteReady: 0, graceHeal: 0,
  recovering: new Set(),                 // the recoveries whose "ready again" is still to be said
});
let _s = freshState();
/** @type {WeakMap<object, number>} */
let _hexed = new WeakMap();              // a foe's entity -> until when its blows are hexed
/** @type {WeakMap<object, number>} */
let _tolls = new WeakMap();              // GILDED1: a tolling weapon -> its landed shots since its last toll
/** @type {{ foe: object, at: number } | null} */
let _lastToll = null;                    // GILDED1: the last foe a tolling weapon's shot landed on, and when
/** @type {WeakSet<object>} */
let _struck = new WeakSet();             // the foes my blows have landed on (First Blood)
let _manaOwed = 0;
/** GILDED1: THE HOUR TOLLS - is this weapon's next landed shot its toll? Its landed shots are counted on the strike
 *  (lootStrike, after the blow), so the blow asks before the count moves: shots one and two ring nothing, the third tolls. */
const tollDue = (weapon, p) => !!weapon && (_tolls.get(weapon) ?? 0) === p.every - 1;
/** GILDED1: how long after its shot landed a foe's fall is the shot's - a kill is told the frame its health ran out,
 *  which is the strike's own frame or the next; a second is a generous bound that a later blow of anything else
 *  replaces (the record is the last landed shot's). */
export const TOLL_REFUND_S = 1;
let _say = (line) => { hudText(line); };
/** The host's voice for a power's line (the HUD's own door by default). */
export function setLootPowersVoice({ say = null } = {}) { if (typeof say === 'function') _say = say; }
const say = (line) => { try { _say(line); } catch { /* a line is not the power's problem */ } };

/** The power ids a piece carries: a Legendary's own record, (LOOT10) a Rare's imprint and (GILDED1) a Gilded record's -
 *  none on anything else. */
const powerIds = (it) => [it?.rarity === 'legendary' ? it.legendary : null, it?.rarity === 'rare' ? it.imprint : null, it?.rarity === 'gilded' ? it.gilded : null];
/** Every power MY entity's worn pieces carry - `[{ id, power, item }]`, ONE entry an id (a power counts once): a
 *  Legendary's own record, and (LOOT10) a Rare's imprint. None for anyone but me, with the switch off, or in a duel. */
export function wornPowers(entity) {
  if (!mine(entity) || !lootRarityOn() || setsDueling()) return [];
  const out = [];
  const seen = new Set();
  for (const it of wornPieces(entity)) {
    for (const id of powerIds(it)) {
      if (typeof id !== 'string' || seen.has(id)) continue;
      const power = powerOf(id);
      if (!power) continue;
      seen.add(id);
      out.push({ id, power, item: it });
    }
  }
  return out;
}
/** The first worn power of a kind, or null. */
export const powerKind = (entity, kind) => wornPowers(entity).find((p) => p.power.kind === kind)?.power ?? null;
const isWeapon = (it) => it?.group === 'Weapons';
/** The powers that ride THIS blow: a weapon's only when it is the one that struck - or the weapon that struck carries
 *  the same power (AUDIT LOOT F4: a Legendary in one hand and a Rare imprinted with its power in the other are one entry,
 *  its piece the first the table lists, and the other's blows rode nothing); armour's and jewellery's always. */
const blowPowers = (entity, weapon) => wornPowers(entity).filter((p) => !isWeapon(p.item) || p.item === weapon || (!!weapon && powerIds(weapon).includes(p.id)));
const share = (e) => (Number.isFinite(e?.health) && e.maxHealth > 0 ? e.health / e.maxHealth : 1);
const ranged = (w) => !!w && weaponSkillUsed(w.templateIndex) === SKILLS.Archery;
export const flowStacks = (now = _now()) => (now < _s.flowUntil ? _s.flow : 0);
export const bedrockStacks = (now = _now()) => (now < _s.bedrockUntil ? _s.bedrock : 0);
const hexed = (foe, now = _now()) => !!foe && now < (_hexed.get(foe) ?? 0);
/** Restore MY magicka, the fraction carried, never past its maximum. */
function gainMana(entity, amount) {
  if (!entity || !(amount > 0) || !Number.isFinite(entity.magicka)) return;
  const exact = amount + _manaOwed;
  const whole = Math.floor(exact + 1e-9);
  _manaOwed = exact - whole;
  if (whole > 0) entity.magicka = Math.min(Number.isFinite(entity.maxMagicka) ? entity.maxMagicka : entity.magicka + whole, entity.magicka + whole);
}

// ── the blow: elemental, slayer ─────────────────────────────────────
/**
 * MY weapon's blow at a foe: the slayer's per cents of its kind, taken of the whole blow with the fraction carried, and
 * the elemental's flat sear, each of the weapon IN HAND alone. Nothing for a miss, a blow at a player (a duel), a peer's
 * blow resolved here, a foe's, or the Warden's ward.
 */
export function lootBlow(weapon, damage, attacker, target, info) {
  if (!(damage > 0) || !mine(attacker) || !target || target.isPlayer || target.warded) return damage;
  let out = damage;
  const group = foeGroup(target);
  let pct = 0, flat = 0;
  for (const a of linesOf(weapon, 'slayer')) if (a.param === group) pct += a.value;
  for (const a of linesOf(weapon, 'elemental')) flat += Math.floor(a.value * elementShare(target, a.param));
  // LOOT5: the powers that ride this blow
  const now = _now();
  for (const { power: p } of blowPowers(attacker, weapon)) {
    switch (p.kind) {
      case 'bane': if (target.affinity !== 'Human' && p.foes.includes(target.careerIndex)) pct += p.pct; break;   // a class foe's career index is its class's, never a monster's
      case 'unaware': if (info?.unaware) pct += p.pct; break;
      case 'sanctified': if (group === p.group) pct += p.pct; break;
      case 'flow': pct += p.pct * flowStacks(now); break;
      case 'venom': flat += Math.floor(p.flat * (share(target) < 0.5 ? 2 : 1) * elementShare(target, 'poison')); break;
      case 'moon': if (isNight(skyMinutes())) pct += p.pct + (group === 'animal' ? p.beast : 0); break;
      case 'rage': if (share(attacker) < p.below / 100) pct += p.pct; break;
      case 'execute': if (share(target) < p.below / 100) pct += p.pct; break;
      case 'firstblood': if (!_struck.has(target)) pct += p.pct; break;
      case 'toll': if (tollDue(weapon, p)) pct += p.pct; break;   // GILDED1: the third that lands
      default: break;
    }
  }
  if (pct > 0) out += shareOf(weapon ?? attacker, damage, pct);
  return out + flat;
}

// ── the strike: leech ───────────────────────────────────────────────
/** MY blow, LANDED (formulas.js registerPlayerStrikeListener - the final damage at a foe): the leech's share heals me. */
export function lootStrike(attacker, target, damage, weapon) {
  if (!mine(attacker) || !(damage > 0) || !target || target.isPlayer) return;
  let pct = 0;
  for (const a of linesOf(weapon, 'leech')) pct += a.value;
  if (pct > 0) healMine(attacker, (damage * pct) / 100);
  // LOOT5: the powers that answer a blow that landed
  const now = _now();
  for (const { power: p } of blowPowers(attacker, weapon)) {
    switch (p.kind) {
      case 'chain': if (ranged(weapon)) arc(target, (damage * p.share) / 100, p.metres); break;
      case 'quake': if (weapon && !ranged(weapon)) quake(target, (damage * p.share) / 100, p.metres); break;
      case 'echo': if (_rand() * 100 < p.chance) again(target, damage); break;
      case 'fists': if (!weapon) again(target, damage); break;
      case 'conduit': gainMana(attacker, p.mana); break;
      case 'flow': _s.flow = Math.min(p.max, flowStacks(now) + 1); _s.flowUntil = now + p.seconds; break;
      case 'toll': if (weapon) { _tolls.set(weapon, ((_tolls.get(weapon) ?? 0) + 1) % p.every); _lastToll = { foe: target, at: now }; } break;   // GILDED1
      default: break;
    }
  }
  _struck.add(target);   // First Blood: the foe's first landed blow was this one
}

// ── LOOT5: a blow's reach past the one it struck ────────────────────
const flat2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const rise = (a, b) => Math.abs((a[1] ?? 0) - (b[1] ?? 0));
/** The live foes my harm may reach near `feet`, but `except` - never an ally or a foe at peace (the sets' AUDIT SET H1),
 *  one a storey away (M4) or one behind a wall (the host's ray, where it has one). */
function near(door, feet, metres, except) {
  return door.foes().filter((f) => f.entity !== except && !f.dead && f.ai?.feet && !friendlyProtected(f, { protection: true })
    && rise(f.ai.feet, feet) <= REACH_RISE_M && flat2(f.ai.feet, feet) <= metres && (!door.clear || door.clear(feet, f.ai.feet)));
}
const recordOf = (door, entity) => door?.foes().find((f) => f.entity === entity) ?? null;
/** The struck foe takes the blow again (Many Endings, Open Hand) - through its own pool's door. */
function again(target, damage) {
  const door = playerDoor();
  const f = recordOf(door, target);
  if (f && !f.dead) door.hurtFoe(f, Math.max(1, Math.round(damage)));
}
/** Chain Lightning: the nearest other foe within `metres` of the struck one takes `amount` as shock. */
function arc(target, amount, metres) {
  const door = playerDoor();
  const struck = recordOf(door, target);
  if (!struck?.ai?.feet || !(amount > 0)) return;
  let best = null, bestD = metres;
  for (const f of near(door, struck.ai.feet, metres, target)) { const d = flat2(f.ai.feet, struck.ai.feet); if (d <= bestD) { best = f; bestD = d; } }
  const n = best ? Math.floor(amount * elementShare(best.entity, 'shock')) : 0;
  if (best && n > 0) door.hurtFoe(best, n);
}
/** Earthshaker: every other foe within `metres` of the struck one takes `amount`. */
function quake(target, amount, metres) {
  const door = playerDoor();
  const struck = recordOf(door, target);
  if (!struck?.ai?.feet || !(amount > 0)) return;
  for (const f of near(door, struck.ai.feet, metres, target)) door.hurtFoe(f, Math.max(1, Math.round(amount)));
}

// ── a foe's blow landed: thorns ────────────────────────────────────
/** A FOE'S BLOW TOOK MY HEALTH (sigilSetPowers.js registerPlayerBlowLanded): the thorns I wear, summed under the cap,
 *  back to the foe that struck - through its own pool's door (systems/playerDoor.js), a kill mine. */
export function lootLanded(entity, attacker, took) {
  if (!mine(entity) || !(took > 0) || !attacker || attacker.isPlayer) return;
  // LOOT5: the powers a landed blow arms - Dawnward's charge, Bedrock's stack, the Hex on the foe that struck
  const now = _now();
  for (const { power: p } of wornPowers(entity)) {
    if (p.kind === 'dawnward') _s.charges = Math.min(p.charges, _s.charges + 1);
    else if (p.kind === 'bedrock') { _s.bedrock = Math.min(p.max, bedrockStacks(now) + 1); _s.bedrockUntil = now + p.seconds; }
    else if (p.kind === 'hex') _hexed.set(attacker, now + p.seconds);
  }
  const n = Math.min(THORNS_CAP, wornSum(entity, 'thorns'));
  if (n <= 0) return;
  const door = playerDoor();
  const f = door?.foes().find((x) => x.entity === attacker);
  if (f && !f.dead) door.hurtFoe(f, n);
}

// ── LOOT5: the damage I take ────────────────────────────────────────
/** MY damage door's modifier (before a Shield spell's pool): a FOE'S BLOW turned aside whole - Dawnward's five charges,
 *  the Raven's evasion - then lessened by its Hex, by Bedrock's stacks, by Bulwark's points (never under 1); ANY hurt
 *  lessened by the Last Stand under its line, then no more than Unyielding's share of my health. A fall or a poison is
 *  no blow (`pendingPlayerBlow` - the sets' own law of one). */
export function lootDamageMod(entity, dmg) {
  if (!mine(entity) || !(dmg > 0)) return dmg;
  const powers = wornPowers(entity);
  if (!powers.length) return dmg;
  const blow = pendingPlayerBlow();
  const now = _now();
  const kind = (k) => powers.find((p) => p.power.kind === k)?.power ?? null;
  if (blow) {
    const dawn = kind('dawnward');
    if (dawn && _s.charges >= dawn.charges) { _s.charges = 0; say('Dawnward turns the blow aside.'); return 0; }
    const raven = kind('evade');
    if (raven && _rand() * 100 < raven.chance) { say('You evade the blow.'); return 0; }
  }
  let d = dmg;
  const hex = kind('hex');
  if (blow && hex && hexed(blow.attacker, now)) d *= 1 - hex.less / 100;
  const bed = kind('bedrock');
  if (blow && bed) d *= 1 - (bed.less * bedrockStacks(now)) / 100;
  const wall = kind('bulwark');
  if (blow && wall) d = Math.max(1, d - wall.less);
  const last = kind('laststand');
  if (last && share(entity) < last.below / 100) d *= 1 - last.less / 100;
  const titan = kind('unyielding');
  if (titan && entity.maxHealth > 0) d = Math.min(d, Math.max(1, Math.ceil((entity.maxHealth * titan.most) / 100)));
  return Math.max(dmg > 0 && d > 0 ? 1 : 0, Math.round(d));
}
/** DIVINE GRACE: damage that would kill me leaves me standing (the door sets me at 1), healed a share once the hurt is
 *  told; then it must recover. */
export function lootDeathSave(entity) {
  const p = powerKind(entity, 'grace');
  if (!p) return false;
  const now = _now();
  if (now < _s.graceReady) return false;
  _s.graceReady = now + p.recover;
  _s.graceHeal = p.heal;
  _s.recovering.add('grace');
  say('Divine Grace! The Nine will not let you fall.');
  return true;
}
/** A HURT LANDED on me (told after it): Divine Grace's heal, after the door left me at 1; the Ghost-King's Vigil when a
 *  hurt takes me under its line. */
export function lootHurt(entity, { before, after, saved = false }) {
  if (!mine(entity)) return;
  const max = entity.maxHealth;
  if (_s.graceHeal > 0) { healMine(entity, (max * _s.graceHeal) / 100); _s.graceHeal = 0; }
  const v = powerKind(entity, 'vigil');
  // AUDIT SD II (L5 F7): nor a killing blow a death save turned aside (`saved` - AUDIT 625 P1's law for Shed Skin): The
  // Hour Turns (and Unbroken, and Divine Grace) left 1 and healed, and the Vigil healed again on top and spent its
  // minute on a death that never happened. Divine Grace's own heal, above, stays
  if (!v || !(max > 0) || !(after > 0) || saved) return;
  const line = (max * v.below) / 100;
  if (!(before >= line && after < line)) return;
  const now = _now();
  if (now < _s.vigilReady) return;
  _s.vigilReady = now + v.recover;
  _s.recovering.add('vigil');
  healMine(entity, (max * v.heal) / 100);
  say("The Ghost-King's Vigil - you are not alone on the field.");
}

// ── LOOT5: a kill of mine ───────────────────────────────────────────
/** A kill that never pays (the sets' own AUDIT SET L8): the city watch, and my own ally. */
const neverCounts = (e) => e?.mobileType === KNIGHT_CITY_WATCH || e?.team === 'PlayerAlly' || e?.mobileTeam === 'PlayerAlly';
/** Courier's Haste: Fortify Speed (classic 9, subtype 6) for `rounds` magic rounds, a flat magnitude - one round more,
 *  as Eventide's, so it lasts what it says however the round falls. */
export const hasteBundle = (p) => ({
  name: "Courier's Haste", rangeType: 0, element: 4,
  effects: [{
    type: 9, subType: 6, durationBase: Math.max(1, p.rounds | 0) + 1, durationMod: 0, durationPerLevel: 1,
    chanceBase: 1, chanceMod: 1, chancePerLevel: 1,
    magnitudeBaseLow: p.speed, magnitudeBaseHigh: p.speed, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  }],
});
/** MY KILL (playerKills.js - every pool's word that my own blow killed a foe): Sanctified's and Orc Rage's heal, Soul
 *  Siphon's magicka, Tribute's gold, Courier's Haste. */
export function lootKill(foe) {
  if (!foe || neverCounts(foe)) return;
  const door = playerDoor();
  const me = door?.player?.() ?? playerEntity;
  const powers = wornPowers(me);
  if (!powers.length) return;
  const now = _now();
  for (const { power: p } of powers) {
    switch (p.kind) {
      case 'sanctified': if (foeGroup(foe) === p.group) healMine(me, (me.maxHealth * p.heal) / 100); break;
      case 'rage': healMine(me, (me.maxHealth * p.heal) / 100); break;
      case 'siphon': gainMana(me, (me.maxMagicka * p.pct) / 100); break;
      case 'tribute': { const g = p.gold * Math.max(1, foe.level | 0); addGoldPieces(me, g); say(`Tribute: ${g} gold.`); break; }
      case 'toll': if (p.refund && _lastToll?.foe === foe && now - _lastToll.at <= TOLL_REFUND_S && Array.isArray(me?.items)) { addItem(me.items, createPellets(1)); _lastToll = null; } break;   // GILDED1: the felling shot's pellet, back
      case 'haste':
        if (now >= _s.hasteReady && door?.castOnPlayer) { _s.hasteReady = now + p.recover; _s.recovering.add('haste'); door.castOnPlayer(hasteBundle(p)); }
        break;
      default: break;
    }
  }
}

// ── the cast: focus ─────────────────────────────────────────────────
/** LOOT15: a spell OF a school - every effect it carries that school's (a heal-and-burn is no Restoration spell). */
export const spellOfSchool = (spell, school) => {
  const fx = (spell?.effects ?? []).filter((e) => e && e.type > -1);
  return fx.length > 0 && fx.every((e) => effectSchool(e) === school);
};
/** MY spell's magicka: the focus I wear off it, summed under the cap. */
export function lootCastCost(entity, sp, spell = null) {
  if (!mine(entity)) return sp;
  let pct = Math.min(FOCUS_CAP, wornSum(entity, 'focus'));
  for (const { power: p } of wornPowers(entity)) {   // LOOT5: the Direnni Staff wielded, the Archmage's Loop
    if (p.kind === 'conduit') pct += p.less;
    else if (p.kind === 'mastery') pct += Number.isFinite(entity.magicka) && entity.maxMagicka > 0 && entity.magicka < entity.maxMagicka / 2 ? p.low : p.less;
    else if (p.kind === 'school' && spellOfSchool(spell, p.school)) pct += p.less;   // LOOT15: Stendarr's Mercy
  }
  pct = Math.min(SPELL_CUT_MOST, pct);
  return pct > 0 ? (sp * (100 - pct)) / 100 : sp;
}

/** CAST-SPEED: MY casting hands' speed - the castSpeed lines I wear, summed under the cap, a percent onto the cast's rate
 *  (systems/castSpeed.js castRate). */
export function lootCastSpeed(entity) {
  if (!mine(entity)) return 0;
  return Math.min(CAST_SPEED_CAP, wornSum(entity, 'castSpeed'));
}

// ── LOOT5: the absorption roll, the round, the find ─────────────────
/** Hagraven's Pact: the chance (%) a Destruction spell that strikes me is absorbed (absorption.js's own roll, under DFU's
 *  two gates). */
export const lootAbsorbChance = (target) => (mine(target) ? (powerKind(target, 'absorb')?.chance ?? 0) : 0);
const READY = Object.freeze({
  vigil: { at: () => _s.vigilReady, line: "The Ghost-King's Vigil is ready again.", kind: 'vigil' },
  grace: { at: () => _s.graceReady, line: 'Divine Grace is ready again.', kind: 'grace' },
  haste: { at: () => _s.hasteReady, line: null, kind: 'haste' },   // ten seconds: no word worth saying
});
/** THE MAGIC ROUND: Hist-Sap's regeneration, and "ready again" for a recovery that ran out with its power still worn. */
export function lootRound(entity) {
  if (!mine(entity)) return;
  const hist = powerKind(entity, 'regen');
  if (hist && entity.maxHealth > 0 && entity.health > 0 && entity.health < entity.maxHealth) {
    healMine(entity, (entity.maxHealth * (share(entity) < 0.5 ? hist.low : hist.pct)) / 100);
  }
  if (!_s.recovering.size) return;
  const now = _now();
  for (const k of [..._s.recovering]) {
    const r = READY[k];
    if (now < r.at()) continue;
    _s.recovering.delete(k);
    if (r.line && powerKind(entity, r.kind)) say(r.line);
  }
}
/** Fortune's Favour: the host door's finder (lootRarity.js registerLegendaryFind) - the Legendary threshold times the
 *  power's own, while MY entity wears it. */
export function lootFind() {
  const me = playerDoor()?.player?.() ?? playerEntity;
  return powerKind(me, 'fortune')?.mult ?? 1;
}

// ── LOOT15: the wardrobe's powers, folded ─────────────────────────
/** LOOT15 (the Loot arc II, bible/06-Systems/Loot-II-Arc.md section 7): THE ROAD'S AND THE COURT'S POWERS are FOLDED onto
 *  MY entity (systems/entityMods.js), so the leaves that read them stay import-free - survival's felt temperature (the
 *  degrees, survival/needs.js through wardrobeCtx), DRESS1's standing (clothingStanding.js), the shared fatigue and fall
 *  laws (scenes/shared.js), skillValue. A power counts once (wornPowers); nothing for anyone but me, with the switch off,
 *  or in a duel. Unseen answers the hood of the piece that carries it - the hood up, 25 Stealth; down, none. */
export function wardrobeFold(entity) {
  const powers = wornPowers(entity);
  if (!powers.length) return EMPTY_MODS;
  let mods = null;
  const m = () => (mods ??= newMods());
  for (const { power: p, item } of powers) {
    switch (p.kind) {
      case 'climate': m().heatDegrees += p.heat ?? 0; m().coldDegrees += p.cold ?? 0; break;
      case 'longroad': m().fatigueLess += p.fatigue ?? 0; m().fallLess += p.fall ?? 0; break;
      case 'bearing': { const s = m().standing; for (let g = 0; g < s.length; g++) s[g] += p.standing ?? 0; break; }
      case 'hood': if (hoodUp(item)) m().skills[p.skill] = (m().skills[p.skill] ?? 0) + (p.more ?? 0); break;
      default: break;
    }
  }
  return mods ?? EMPTY_MODS;
}

// ── registered at import ───────────────────────────────────────────
export const LOOT_POWERS = 'lootPowers';
registerWeaponBlowMod(LOOT_POWERS, lootBlow);
registerPlayerStrikeListener(LOOT_POWERS, lootStrike);
registerPlayerBlowLanded(LOOT_POWERS, lootLanded);
registerSpellCostMod(LOOT_POWERS, lootCastCost);
registerCastSpeedMod(LOOT_POWERS, lootCastSpeed);   // CAST-SPEED
registerPlayerDamageMod(LOOT_POWERS, lootDamageMod);   // LOOT5
registerPlayerDeathSave(LOOT_POWERS, lootDeathSave);
registerPlayerHurtListener(LOOT_POWERS, lootHurt);
registerPlayerKillListener(LOOT_POWERS, lootKill);
registerAbsorptionChance(LOOT_POWERS, lootAbsorbChance);
registerMagicRoundHook(LOOT_POWERS, lootRound);
registerLegendaryFind(LOOT_POWERS, lootFind);
registerEntityFold(LOOT_POWERS, wardrobeFold);   // LOOT15

/** LOOT5: THE HUD'S CHIPS for the powers now, beside the sets' (scenes/world.js hands both to the HUD) - each
 *  `{ key, set: 'legendary', name, text, state }`: Flow's and Bedrock's stacks and seconds, Dawnward's charges, a
 *  recovery running. [] for anyone but me, and while the powers sleep. */
export function lootHudChips(entity, now = _now()) {
  const powers = wornPowers(entity);
  if (!powers.length) return [];
  const has = (k) => powers.some((p) => p.power.kind === k);
  const left = (t) => Math.max(0, Math.ceil(t - now));
  const time = (n) => (n >= 60 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : `${n}s`);
  const out = [];
  if (has('flow') && flowStacks(now)) out.push({ key: 'flow', set: 'legendary', name: `Flow ${flowStacks(now)}`, text: time(left(_s.flowUntil)), state: 'active' });
  if (has('bedrock') && bedrockStacks(now)) out.push({ key: 'bedrock', set: 'legendary', name: `Bedrock ${bedrockStacks(now)}`, text: time(left(_s.bedrockUntil)), state: 'active' });
  if (has('dawnward') && _s.charges) out.push({ key: 'dawnward', set: 'legendary', name: 'Dawnward', text: `${_s.charges}/${powerKind(entity, 'dawnward').charges}`, state: 'active' });
  if (has('vigil') && left(_s.vigilReady)) out.push({ key: 'vigil', set: 'legendary', name: 'Vigil', text: time(left(_s.vigilReady)), state: 'recovering' });
  if (has('grace') && left(_s.graceReady)) out.push({ key: 'grace', set: 'legendary', name: 'Divine Grace', text: time(left(_s.graceReady)), state: 'recovering' });
  if (has('haste') && left(_s.hasteReady)) out.push({ key: 'haste', set: 'legendary', name: 'Haste', text: time(left(_s.hasteReady)), state: 'recovering' });
  return out;
}

/** Tests only: every carry and power fresh, a clock and a chance of their own (seconds, [0, 1)). */
export function _resetLootPowersForTests() {
  _carry = new WeakMap(); _resetPlayerHealForTests(); _manaOwed = 0; _s = freshState(); _hexed = new WeakMap(); _struck = new WeakSet(); _tolls = new WeakMap(); _lastToll = null;
  _say = (line) => { hudText(line); };
}
export function _setLootPowersClockForTests(fn) { _now = typeof fn === 'function' ? fn : () => performance.now() / 1000; }
export function _setLootPowersRandForTests(fn) { _rand = typeof fn === 'function' ? fn : Math.random; }
