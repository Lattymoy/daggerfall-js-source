// @ts-check
// PVP-GEAR (2026-10-30, the owner: gear powers were meant to count between players, "we have the cap", then "all
// imprint"): A PLAYER'S GEAR POWERS ON A BLOW BETWEEN PLAYERS. The blow is rolled against a neutral stand-in
// (duelCombat.js), so the loot ladder's own doors (lootPowers.js lootBlow, lootDamageMod) never see a player. Here the
// striker's lines and powers add a percent and a flat to its blow, and the struck player's guard powers take a share off
// what its armour lets through (refereeHealthMirror.js `guard`). Each side has its own top, inside PVP-HIT's cap. The
// heals and saves (Vigil, Divine Grace, Hist-Sap, Unyielding) are the relay's to count; a foe group's bonus never fits one.
import { readLines, powerOf } from '../systems/loot/lootRarity.js';
import { wornPieces } from '../systems/loot/lootPowers.js';
import { isHandWraps } from '../characters/handWrapsIds.js';
import { isNight } from '../world/worldClock.js';
import { skyMinutes } from '../systems/worldTick.js';

/** The tops, per cent: what all of a striker's gear adds to a blow, and what all of a fighter's guard powers take off. */
export const PVP_GEAR = Object.freeze({ attack: 40, guard: 30 });

/** A piece's power ids, as lootPowers.js reads them: a Legendary's record, a Rare's imprint, a Gilded's own. */
const powerIds = (it) => [it?.rarity === 'legendary' ? it.legendary : null, it?.rarity === 'rare' ? it.imprint : null, it?.rarity === 'gilded' ? it.gilded : null];
/** The worn powers, each once, with the piece that carries it - asleep in no duel (lootPowers.js wornPowers' setsDueling). */
export function pvpWornPowers(entity) {
  const out = [], seen = new Set();
  for (const it of wornPieces(entity)) {
    for (const id of powerIds(it)) {
      const power = typeof id === 'string' && !seen.has(id) ? powerOf(id) : null;
      if (!power) continue;
      seen.add(id);
      out.push({ id, power, item: it });
    }
  }
  return out;
}

/** Way of the Sword's stacks from blows on players: its own count, so a PvE fight's never rides into PvP. */
let _flow = 0, _flowUntil = 0;
let _now = () => performance.now() / 1000;
/** First Blood's and Silent Death's memory: a foe's id -> when my last blow on it landed. Bedrock's and Hex's: my hits taken. */
const _struckFoes = new Map();
let _bedrock = 0, _bedrockUntil = 0, _hexUntil = 0;
/** The host's sight of a foe (scenes/pvpFlagHost.js): `{ h, fighting }` - its bar, per cent (null unseen), and whether
 *  we traded blows inside the combat lock. */
let _foeSight = (/** @type {any} */ _id) => ({ h: null, fighting: false });
export function setPvpFoeSight(fn) { _foeSight = typeof fn === 'function' ? fn : () => ({ h: null, fighting: false }); }
const FOE_FRESH_S = 60;   // PVP_FLAG.lockMs: a foe struck longer ago is struck first again
const healthShare = (e) => (e?.maxHealth > 0 ? e.health / e.maxHealth : 1);
const flowNow = (now = _now()) => (now < _flowUntil ? _flow : 0);

/** The piece a blow is struck with: the weapon, or with bare fists the Hand Wraps worn (HAND-WRAPS). */
const strikingPiece = (entity, weapon) => weapon ?? wornPieces(entity).find(isHandWraps) ?? null;
/** A weapon's power rides only its own blows (lootPowers.js blowPowers); armour's and jewellery's every blow. */
const ridesBlow = (p, piece) => p.item?.group !== 'Weapons' || p.item === piece;

/** THE STRIKER'S GEAR, per cent on its blow at a player (`foe` its id, when known): the piece's damage lines and gems,
 *  Way of the Sword's stacks, Many Endings' chance as its mean, Open Hand on a bare fist, Hunter's Moon at night, Orc
 *  Rage when low, Sweet Mother's Kiss on a foe under its line, First Blood and Silent Death on a foe not struck lately.
 *  Never past PVP_GEAR.attack. A slayer or bane line stays PvE's: a player is no foe group (the owner). */
export function pvpGearBlowPct(entity, weapon = null, now = _now(), foe = null) {
  const piece = strikingPiece(entity, weapon);
  let pct = 0;
  for (const a of readLines(piece)) if (a?.id === 'damage') pct += a.value;
  const sight = foe != null ? _foeSight(foe) : null;
  const fresh = foe != null && !(now - (_struckFoes.get(foe) ?? -Infinity) < FOE_FRESH_S);
  for (const { power: p, ...w } of pvpWornPowers(entity)) {
    if (!ridesBlow(w, piece)) continue;
    switch (p.kind) {
      case 'flow': pct += p.pct * Math.min(p.max, flowNow(now)); break;
      case 'echo': pct += p.chance; break;
      case 'fists': if (!weapon || isHandWraps(weapon)) pct += p.share; break;
      case 'moon': if (isNight(skyMinutes())) pct += p.pct; break;
      case 'rage': if (healthShare(entity) < p.below / 100) pct += p.pct; break;
      case 'execute': if (sight?.h != null && sight.h < p.below) pct += p.pct; break;
      case 'firstblood': if (fresh) pct += p.pct; break;
      case 'unaware': if (fresh && !sight?.fighting) pct += p.pct; break;
    }
  }
  return Math.max(0, Math.min(PVP_GEAR.attack, Math.round(pct)));
}

/** Serpent's Kiss on a blow at a player: its flat poison, twice on a foe under half its health. */
export function pvpGearBlowFlat(entity, weapon = null, foe = null) {
  const p = pvpWornPowers(entity).find((w) => w.power.kind === 'venom' && ridesBlow(w, strikingPiece(entity, weapon)))?.power;
  if (!p) return 0;
  const h = foe != null ? _foeSight(foe)?.h : null;
  return p.flat * (h != null && h < 50 ? 2 : 1);
}

/** A blow of mine landed on a player (`foe` its id): Way of the Sword's stack, when it is worn, and First Blood's mark. */
export function pvpGearLanded(entity, now = _now(), foe = null) {
  if (foe != null) { _struckFoes.set(foe, now); if (_struckFoes.size > 64) _struckFoes.delete(_struckFoes.keys().next().value); }
  const p = pvpWornPowers(entity).find((w) => w.power.kind === 'flow')?.power;
  if (!p) return;
  _flow = Math.min(p.max, flowNow(now) + 1);
  _flowUntil = now + p.seconds;
}

/** A player's blow landed on me: Bedrock's stack and Hex's window, when worn. */
export function pvpGearStruck(entity, now = _now()) {
  for (const { power: p } of pvpWornPowers(entity)) {
    if (p.kind === 'bedrock') { _bedrock = Math.min(p.max, (now < _bedrockUntil ? _bedrock : 0) + 1); _bedrockUntil = now + p.seconds; }
    else if (p.kind === 'hex') _hexUntil = now + p.seconds;
  }
}

/** THE STRUCK FIGHTER'S GUARD POWERS, per cent of a player's blow they let through: Dawnward's every sixth blow as its
 *  mean, Last Stand under its line, Bedrock's stacks, Hex after a hit, Bulwark's flat as a share. Never under
 *  100 - PVP_GEAR.guard. The Raven is not here: PVP-EVADE rolls it as a real miss on the relay. */
export function pvpGearKept(entity, now = _now()) {
  let kept = 1;
  const low = healthShare(entity);
  for (const { power: p } of pvpWornPowers(entity)) {
    if (p.kind === 'dawnward') kept *= p.charges / (p.charges + 1);
    else if (p.kind === 'laststand' && low < p.below / 100) kept *= 1 - p.less / 100;
    else if (p.kind === 'bedrock' && now < _bedrockUntil) kept *= 1 - (p.less * _bedrock) / 100;
    else if (p.kind === 'hex' && now < _hexUntil) kept *= 1 - p.less / 100;
    else if (p.kind === 'bulwark') kept *= 1 - p.less / 100;
  }
  return Math.max(100 - PVP_GEAR.guard, Math.min(100, Math.round(kept * 100)));
}

/** The armour's shares (pvpGuard.js pvpArmorKept) with the guard powers' share taken off each. */
export const pvpGuardWithGear = (armour, entity) => armour.map((n) => Math.round((n * pvpGearKept(entity)) / 100));


export function _resetPvpGearForTests() { _flow = 0; _flowUntil = 0; _struckFoes.clear(); _bedrock = 0; _bedrockUntil = 0; _hexUntil = 0; }
export function _setPvpGearClockForTests(fn) { _now = typeof fn === 'function' ? fn : () => performance.now() / 1000; }
