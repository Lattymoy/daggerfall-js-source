// PWR7 (2026-10-23, bible/05-Combat/Power-Arc.md): THE FIGHT THE POWER MEASURE RUNS - a kit (tools/power/powerKit.mjs)
// against a chain of foes of DFU's own encounter band at its level, through the game's own code end to end:
//   - the player's blow: combat/formulas.js calculateAttackDamage with PCAAO installed as it ships (combat/pcaao.js
//     installPcaao), so every blow modifier, critical, the damage-scale tail, the Strikes payloads and the strike
//     listeners (a leech, a Cleave, a coil) are the game's;
//   - the foe's blow: the same core the other way - its struck tail marks the blow as the game's does (the sets' own
//     law, sigilSetPowers.js setStruck, the door's probe) - then the player's one door (characters/playerEntity.js
//     hurtPlayer): every evasion, guard, damage modifier, shield, FULL-GUARD and death save;
//   - the tempo: the player's swing by the port's swing law (characters/weaponStates.js getMeleeWeaponAnimTime, five
//     frames a strike, its pace modifiers and the weapon's heft read through combat/swingLaw.js), a foe's by DFU's melee
//     timer (characters/enemy/enemyAttack.js resetMeleeTimer, at the player's level);
//   - the magic round every five seconds (systems/worldTick.js runMagicRoundsFor: the regenerations, the round's heals);
//   - a kill told as the pools tell it (systems/playerKills.js reportPlayerKill: the kill heals, the stacks).
//
// THE MEASURE. A CHAIN: foes one after another, no rest, until the player falls or MAX_KILLS. What it reports per
// cell: `kills` (BAL7's own measure, "foes killed in a row before the player fell"), `cost` (the health the player spent
// per kill, net of every heal, as a share of their maximum - heroMeasure's "a kill's cost" with the sustain in it; a
// negative cost is a kit that heals faster than it is hurt, which is BAL7's "wins alone"), and the blow and the hurt
// as landed. Seeded: Math.random and performance.now are the measure's own while a chain runs (every power module reads
// one or the other), and put back after.
//
// Not a DFU member; tooling, never shipped.
import { mulberry, bandWeights } from '../heroMeasure.mjs';

const SRC = new URL('../../src/', import.meta.url);
const mod = (p) => import(new URL(p, SRC).href);
const [F, PC, PE, EN, EB, EQE, WT, PK, WS, SWL, FPS, EA, SKS, ENC] = await Promise.all([
  mod('combat/formulas.js'), mod('combat/pcaao.js'), mod('characters/playerEntity.js'), mod('characters/enemy/enemyEntity.js'),
  mod('characters/enemy/enemyBasics.js'), mod('combat/enemyEquipment.js'), mod('systems/worldTick.js'), mod('systems/playerKills.js'),
  mod('characters/weaponStates.js'), mod('combat/swingLaw.js'), mod('combat/fpsWeapon.js'), mod('characters/enemy/enemyAttack.js'),
  mod('systems/skillSoftcap.js'), mod('systems/encounters.js'),
]);
const { liveStat } = await mod('systems/statMods.js');
const { heroThreat } = await mod('systems/heroThreat.js');
const LRT = await mod('systems/loot/lootRarity.js');

/** The overhaul as it ships (heroMeasure's OVERHAUL): the redone hit and armour, the crits, the fixed strength term. */
export const OVERHAUL = Object.freeze({ Enabled: true, equipmentDamageEnhanced: false, fadingEnchantedItems: false, fixedStrengthDamageModifier: true,
  armorHitFormulaRedone: true, criticalStrikesIncreaseDamage: true, conditionBasedEffectiveness: true, softMaterialRequirements: true });
PC.installPcaao({ read: (k) => OVERHAUL[k], other: () => undefined });
SWL.installSwingLaw();

/** A chain stops here: BAL7's own ceiling, "stopping at 50". */
export const MAX_KILLS = 50;
/** The magic round, in real seconds (a game minute at DFU's 12x clock - sigilSets.js ROUND_SECONDS). */
export const ROUND_S = 5;
/** A melee strike's frames (weaponStates.js MELEE_NUM_FRAMES' StrikeDown). */
export const STRIKE_FRAMES = 5;
/** A fresh foe steps up this long after the last fell (s) - the walk to the next one. */
export const NEXT_FOE_S = 2;
/** The tables a level's foes are drawn from: the nineteen dungeon kinds and the three temperate wilderness tables
 *  (heroMeasure's TABLES). */
export const TABLES = Object.freeze([...Array(19).keys(), 32, 33, 34]);

const CLASS_CAREER = Object.freeze({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, attackModifierFlags: 0 });

/** THE PLACE a table stands for, as the spawn doors read it: a dungeon kind its share (skillSoftcap.js DUNGEON_SHARE)
 *  and its tier's veteran (BAL3 - lootRarity.js DUNGEON_RARITY_TIER through placeVeteran); a wilderness table the
 *  day's (scenes/exteriorFoes.js: wildernessShare, wildernessThreat). The ladder stands on in every kit (powerKit.mjs
 *  wake), so the place's veteran stands as it does in play. */
export function placeOf(table) {
  if (table < 19) return { share: SKS.dungeonShare(table), place: SKS.placeVeteran(LRT.dungeonRarityTier(table)) };
  return { share: SKS.wildernessShare(false), place: SKS.placeVeteran(SKS.wildernessThreat(false)) };
}

/** One foe of DFU's band at level `L`, built as heroMeasure builds one (makeEnemyEntity, a class foe's gear), then
 *  scaled as the spawn doors scale one (scenes/dungeonContext.js applyProgressionScalingTo, scenes/exteriorFoes.js):
 *  its place's share and veteran (placeOf), `player`'s standing (skillSoftcap.js combatStanding - the climb past 100
 *  the foes answer), and the threat (`hero`, heroThreat's record, or null), through the real writer. */
export function foeAt(L, r, { hero = null, player = null } = {}) {
  const table = TABLES[Math.floor(r() * TABLES.length)];
  const w = bandWeights(L);
  let x = r(), slot = 0;
  for (; slot < 19; slot++) { x -= w[slot]; if (x < 0) break; }
  const id = ENC.ENCOUNTER_TABLES[table][slot];
  const e = EN.makeEnemyEntity(id, EB.ENEMY_BASICS[id], id >= 128 ? { ...CLASS_CAREER, hitPointsPerLevel: 12, name: 'foe' } : CLASS_CAREER, L, r);
  let weapon = null;
  if (id >= 128) {
    const eq = EQE.assignEnemyEquipment(e, 0, L, r);
    e.armorValues = eq.armorValues;
    weapon = eq.rightHand ? { ...eq.rightHand, maxCondition: 1e9, currentCondition: 1e9 } : null;
  }
  const { share, place } = placeOf(table);
  const scaling = SKS.progressionScaling(player ? SKS.combatStanding(player) : null, share, SKS.foeShare(EB.ENEMY_BASICS[id]?.level ?? e.level, id >= 128), place, hero);
  if (scaling) EN.applyProgressionScaling(e, scaling);
  e.health = e.maxHealth;
  return { e, weapon, id };
}

/** The seconds one swing of the player's takes (the swing law, at their live Speed, five frames). */
export function swingSeconds(player, weapon) {
  const ctx = { entity: player, weaponType: FPS.weaponTypeForItem(weapon), usingRightHand: true };
  return STRIKE_FRAMES * WS.getMeleeWeaponAnimTime(liveStat(player, 'speed'), ctx);
}

/**
 * ONE CHAIN: the dressed kit (`kit.player`, `kit.weapon`) against foe after foe at its level. `hero` true stands the
 * BAL11 threat on every foe (offline the level's, online the Renown's too). Returns
 * `{ kills, spent, healed, dealt, taken, swings, fell, seconds }`.
 */
export function chain(kit, { seed = 1, hero = false, maxKills = MAX_KILLS, unawareOpen = false } = {}) {
  const r = mulberry(seed);
  const saved = { random: Math.random, now: performance.now };
  let clock = 1000;   // seconds; never 0 (a module's "never" reads 0 as unset)
  Math.random = r;
  performance.now = () => clock * 1000;
  try {
    const p = kit.player, w = kit.weapon, L = kit.level;
    p.health = p.maxHealth;
    const threat = hero ? heroThreat(L, kit.online ? kit.renown : null) : null;
    const dfRand = () => Math.floor(r() * 32768);
    let foe = foeAt(L, r, { hero: threat, player: p });
    let fresh = true;
    let kills = 0, spent = 0, healed = 0, dealt = 0, taken = 0, swings = 0, minutes = 0;
    let tP = clock + swingSeconds(p, w), tF = clock + NEXT_FOE_S + EA.resetMeleeTimer(L, 2, r()), tR = clock + ROUND_S;
    const before = () => p.health;
    while (kills < maxKills && p.health > 0) {
      clock = Math.min(tP, tF, tR);
      if (clock === tR) {
        const h = before();
        WT.runMagicRoundsFor(p, minutes, minutes + 1, { sinks: { hurt: (n) => PE.hurtPlayer(p, n, { bypassShield: false }), heal: () => {} }, rolls: r });
        minutes++;
        const d = p.health - h;
        if (d > 0) healed += d; else spent -= d;
        tR += ROUND_S;
        continue;
      }
      if (clock === tP) {
        const h = before();
        const n = F.calculateAttackDamage(p, foe.e, { weapon: w, rolls: r, dfRand, unaware: unawareOpen && fresh });
        fresh = false;
        swings++;
        if (n > 0) { dealt += n; foe.e.health -= n; }
        const d = p.health - h;   // a leech, a strike's heal
        if (d > 0) healed += d;
        if (foe.e.health <= 0) {
          const k = before();
          PK.reportPlayerKill(foe.e, { kind: 'melee' });
          const kd = p.health - k;
          if (kd > 0) healed += kd;
          kills++;
          foe = foeAt(L, r, { hero: threat, player: p });
          fresh = true;
          tF = clock + NEXT_FOE_S + EA.resetMeleeTimer(L, 2, r());
          tP = clock + NEXT_FOE_S + swingSeconds(p, w);
        } else tP = clock + swingSeconds(p, w);
        continue;
      }
      // the foe's blow
      const h = before();
      const n = F.calculateAttackDamage(foe.e, p, { weapon: foe.weapon, rolls: r, dfRand, playerReflexes: 2 });
      if (n > 0) { taken += n; PE.hurtPlayer(p, n); }
      const d = h - p.health;
      if (d > 0) spent += d; else if (d < 0) healed -= d;
      tF = clock + EA.resetMeleeTimer(L, 2, r());
    }
    return { kills, spent, healed, dealt, taken, swings, fell: p.health <= 0, seconds: clock - 1000 };
  } finally {
    Math.random = saved.random;
    performance.now = saved.now;
  }
}

/**
 * A CELL: `n` chains of a kit (rebuilt and dressed for each - `make()` answers a fresh dressed kit), summed. Per kill,
 * over the player's maximum health: `hurt` the health the foes took, `heal` what came back, `cost` the two's difference
 * (heroMeasure's "a kill's cost" with the sustain in it); `ttk` the seconds a kill took (the swings and the walk between
 * foes); `kills` the chains' mean (BAL7's measure, capped at maxKills); `blow` the mean landed blow.
 */
export function cell(make, { n = 8, seed = 1, hero = false, maxKills = MAX_KILLS } = {}) {
  let kills = 0, spent = 0, healed = 0, dealt = 0, swings = 0, max = 0, falls = 0, seconds = 0;
  for (let i = 0; i < n; i++) {
    const kit = make();
    const c = chain(kit, { seed: seed * 7919 + i, hero, maxKills });
    kills += c.kills; spent += c.spent; healed += c.healed; dealt += c.dealt; swings += c.swings; max = kit.player.maxHealth; falls += c.fell ? 1 : 0; seconds += c.seconds;
  }
  const k = Math.max(1, kills);
  return { kills: kills / n, hurt: spent / k / max, heal: healed / k / max, cost: (spent - healed) / k / max, ttk: seconds / k,
    blow: dealt / Math.max(1, swings), falls, maxHealth: max };
}
