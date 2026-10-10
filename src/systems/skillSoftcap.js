// SOFTCAP1 (2026-09-29): SKILLS PAST 100 - the softcap, the hard cap, the
// milestones and the "real use" law. A LEAF (its one import, masterSkills.js, imports nothing), so
// skills.js (itself a leaf the whole tree reads), advancement.js, the
// combat formulas and the UI can all read it without closing a cycle.
//
// THE FOUR NUMBERS A PLAYER IS TOLD, AND WHERE EACH LIVES
//
//   1..100    exactly DFU's law (advancement.js, untouched below 100)
//   100..125  a point costs  4x the uses          SOFTCAP_TIERS (Mac, 2026-09-29: 4 / 8 / 16)
//   125..150  a point costs  8x the uses
//   150..200  a point costs 16x the uses          SKILL_HARD_CAP = 200
//
//   Past 100 a point is worth a QUARTER of a point below it
//   (OVERCAP_POINT_WEIGHT), plus the milestone bonuses at 125/150/175/200.
//   What a FORMULA reads is `effectiveSkill(v)` - so a 200 is not twice a
//   100 in any to-hit, damage, spell or lock roll; it is 140 (100 + 25 +
//   the 15 milestone points). What a SCREEN prints is the real number.
//
// THE REAL-USE LAW (tallies above 100)
//
//   A use of a skill that already sits at 100+ is WEIGHTED before it is
//   counted: `overcapTallyWeight`. Combat skills need a foe, and the
//   foe's tier is measured against the SKILL, not the character's level
//   (so mentor mode cannot launder it): tier(foe) = 5 * level + 30 - the
//   same line SetEnemyCareer draws every enemy's skills on
//   (enemyEntity.js skillsLevel), unclamped. r = tier / skill:
//
//     r < 0.75            nothing          (a weak foe teaches a master nothing)
//     0.75 <= r < 1       ((r - 0.75) / 0.25)^2   (a smooth ramp in)
//     r >= 1              1 + 0.5 * min(1, (r - 1) / 0.5)   (up to 1.5x)
//
//   So at 100 a foe of level 9 starts to teach and level 14 teaches in
//   full; at 150 it is level 17 / 24; at 200 level 24 / 34. Spam is
//   damped separately: each skill keeps a leaky counter of its recent
//   weighted uses (half-life SPAM_HALF_LIFE_MS) and a use past the
//   category's free burst is worth free/recent of itself.
//
//   MOVE-REAL: Running, Jumping, Swimming and Climbing take neither -
//   their motion tallies count the ground actually covered instead
//   (movementTallyWeight, below).

import { masterSkillsActive, masterCappedSkill } from './masterSkills.js';   // SOFTCAP3: a leaf

export const SKILL_SOFT_CAP = 100;
export const SKILL_HARD_CAP = 200;
/** A point above the soft cap is worth this much of a point below it. */
export const OVERCAP_POINT_WEIGHT = 0.25;

/** The cost ladder: the uses a raise needs, multiplied, by the value the
 *  skill is LEAVING (100 -> 101 is the first 4x point). */
export const SOFTCAP_TIERS = Object.freeze([
  Object.freeze({ from: 100, to: 125, mult: 4 }),
  Object.freeze({ from: 125, to: 150, mult: 8 }),
  Object.freeze({ from: 150, to: 200, mult: 16 }),
]);

/** The milestones: effective points granted ON TOP of the quarter-weight
 *  climb, each once reached, plus the title the notice prints. */
export const SKILL_MILESTONES = Object.freeze([
  Object.freeze({ at: 125, bonus: 2, title: 'Expert' }),
  Object.freeze({ at: 150, bonus: 3, title: 'Master' }),
  Object.freeze({ at: 175, bonus: 4, title: 'Grandmaster' }),
  Object.freeze({ at: 200, bonus: 6, title: 'Legend' }),
]);

export const clampSkill = (v) => Math.max(0, Math.min(SKILL_HARD_CAP, Number.isFinite(v) ? v : 0));

/** The uses multiplier for raising a skill that currently reads `v`. */
export function softcapCostMultiplier(v) {
  if (!(v >= SKILL_SOFT_CAP)) return 1;
  for (const t of SOFTCAP_TIERS) if (v < t.to) return t.mult;
  return Infinity;   // at the hard cap: nothing more to buy
}

/** The milestone that a skill reaching exactly `v` has just passed, or null. */
export const milestoneAt = (v) => SKILL_MILESTONES.find((m) => m.at === v) ?? null;

/** The sum of every milestone bonus at or below `v`. */
export function milestoneBonus(v) {
  let b = 0;
  for (const m of SKILL_MILESTONES) if (v >= m.at) b += m.bonus;
  return b;
}

/** THE ONE CONVERSION a formula sees: 1..100 verbatim; above it a
 *  quarter a point plus the milestones. Integer, because DFU's formulas
 *  are integer arithmetic and some shift. */
export function effectiveSkill(v) {
  if (!(v > SKILL_SOFT_CAP)) return v;
  const c = clampSkill(v);
  return Math.floor(SKILL_SOFT_CAP + (c - SKILL_SOFT_CAP) * OVERCAP_POINT_WEIGHT + milestoneBonus(c));
}

/** The highest effective value a skill can reach (a HUD bar's full width). */
export const EFFECTIVE_SKILL_MAX = effectiveSkill(SKILL_HARD_CAP);

// CLIMB-PAST (FIELD BUGS 2026-10-01 #7, "Running jumping climbing dint work passed 100"; Mac: "I dont care about DFU.
// We're our own thing now"). The run, the swim and the jump read the effective value in their own speed laws, so their
// points past 100 move the body. Climbing drives one thing in Daggerfall - CalculateClimbingChance, which clamps the
// skill to 5..95 and is certain at 95 (Luck 40 or more) - and GetClimbingSpeed reads no skill, so a Climbing mastered
// to 200 climbed exactly as a 95. Past 100 its points go to the climb's SPEED: each effective point over 100 climbs this
// much faster (x1.4 at 200, effective 140), from the same live value the check reads; to 100 the climb is base / 3.
export const CLIMB_OVERCAP_SPEED_PER_POINT = 0.01;
/** The climb speed's multiplier for a LIVE Climbing value (skills.js skillValue): 1 to 100, bounded at the effective cap. */
export function overcapClimbSpeed(liveClimbing) {
  const gain = Math.min(EFFECTIVE_SKILL_MAX, liveClimbing) - SKILL_SOFT_CAP;
  return gain > 0 ? 1 + gain * CLIMB_OVERCAP_SPEED_PER_POINT : 1;   // a missing value (NaN) climbs as DFU's
}

// ---- the real-use law -------------------------------------------------

/** Skill ids, kept numeric here so this leaf needs no import (skills.js SKILLS). */
const COMBAT_SKILL_IDS = new Set([19, 20, 28, 29, 30, 31, 32, 33, 34]);   // Backstabbing, Dodging, the five weapons + HandToHand, Archery, CriticalStrike
const MAGIC_SKILL_IDS = new Set([22, 23, 24, 25, 26, 27]);               // the six schools

export const SKILL_CATEGORY = Object.freeze({ combat: 'combat', magic: 'magic', utility: 'utility' });
export const skillCategory = (id) => (COMBAT_SKILL_IDS.has(id) ? SKILL_CATEGORY.combat
  : MAGIC_SKILL_IDS.has(id) ? SKILL_CATEGORY.magic : SKILL_CATEGORY.utility);

/** How long a struck/striking foe stays "the foe" for the tallies that follow the blow. */
export const CHALLENGE_TTL_MS = 6000;
/** A spell cast with no foe in the fight (a self-heal, a light) above 100 counts this much. */
export const UNCHALLENGED_MAGIC_WEIGHT = 0.25;
export const SPAM_HALF_LIFE_MS = 60000;
/** Weighted uses a skill may take inside roughly one half-life before each further use is damped. */
export const SPAM_FREE_BURST = Object.freeze({ combat: 40, magic: 10, utility: 6 });

/** A foe's tier on the skill scale - SetEnemyCareer's 5L+30, unclamped. */
export function challengeTier(foe) {
  const lv = Number(foe?.challengeLevel ?? foe?.level);   // SOFTCAP2: a scaled foe teaches at its challenge level
  return Number.isFinite(lv) && lv > 0 ? lv * 5 + 30 : 0;
}

/** r = tier / skill, mapped to a weight (see the header). */
export function challengeQuality(tier, skill) {
  if (!(tier > 0) || !(skill > 0)) return 0;
  const r = tier / skill;
  if (r < 0.75) return 0;
  if (r < 1) { const x = (r - 0.75) / 0.25; return x * x; }
  return 1 + 0.5 * Math.min(1, (r - 1) / 0.5);
}

/** Remember the foe this entity just traded a blow with (formulas.js calls it). */
export function noteSkillChallenge(entity, foe, now = Date.now()) {
  if (!entity || !foe || entity === foe) return;
  const tier = challengeTier(foe);
  if (tier > 0) entity._skillChallenge = { tier, at: now };
}

function liveChallenge(entity, now) {
  const c = entity?._skillChallenge;
  return c && now - c.at <= CHALLENGE_TTL_MS ? c : null;
}

/** The damped weight of ONE more use given the skill's leaky counter (mutates it). */
function spamWeight(entity, skillId, category, amount, now) {
  const all = (entity._skillSpam ??= {});
  const s = all[skillId] ?? { v: 0, at: now };
  const dt = Math.max(0, now - s.at);
  s.v = s.v * Math.pow(0.5, dt / SPAM_HALF_LIFE_MS) + amount;
  s.at = now;
  all[skillId] = s;
  const free = SPAM_FREE_BURST[category] ?? 6;
  return s.v <= free ? 1 : free / s.v;
}

/**
 * THE REAL-USE WEIGHT of `amount` uses of a skill whose REAL value is
 * `skill` (>= 100). 0 means the use taught nothing. Never above 1.5x.
 */
export function overcapTallyWeight(entity, skillId, amount, skill, now = Date.now()) {
  if (!(amount > 0) || skill >= SKILL_HARD_CAP) return 0;
  const cat = skillCategory(skillId);
  const ch = liveChallenge(entity, now);
  let q;
  if (cat === SKILL_CATEGORY.combat) q = ch ? challengeQuality(ch.tier, skill) : 0;
  else if (cat === SKILL_CATEGORY.magic) q = ch ? challengeQuality(ch.tier, skill) : UNCHALLENGED_MAGIC_WEIGHT;
  else q = 1;
  if (q <= 0) return 0;
  return amount * q * spamWeight(entity, skillId, cat, amount * q, now);
}

// ---- the movement skills (MOVE-REAL) --------------------------------------
//
// MOVE-REAL (Mac, 2026-09-30: "No spam protection, because running a lot is the normal way to use the skill. Instead,
// only real movement counts past 100"). The spam counter above would stop a runner cold - Running tallies four times
// a second against a utility burst of 6 a minute, about 2% of a run - so past 100 a MOTION tally (the run's, the
// jump's, the swim's, the climb's check; skills.js tallyMovementSkill) takes no spam weight. It takes the ground the
// body actually covered under its own power instead: the motor's odometer (player/motor.js), which counts its own
// steps only - a deck's carry, a helm pin, a teleport or a load is none of it. Each use needs `stride` metres of the
// skill's own axis since that skill's last use; one short of it counts the part it made, and what is left over rides
// to the next use, never more than MOVE_CREDIT_CAP uses of it (a walk banks no run). So the run key held standing
// still or against a wall, a hop in place, treading water and a climber pressed under a ledge teach a master nothing,
// and nothing can be trained AFK. A guild's or a quest's training is no motion and keeps the law above.
//
// The strides sit under an honest move's worst case, so real movement counts whole: a run is 5-10 m/s against the
// stride's 4, a swim at 100 about 3 m/s against 0.6, a climb about 1.5 m/s against 0.6. Running constantly (four
// whole uses a second, a career multiplier of 1, average Reflexes) then takes, from 100:
//
//   level     to 125      to 150      to 200
//     20      ~35 h       ~120 h      ~540 h
//     30      ~50 h       ~175 h      ~800 h

/** Per movement skill (skills.js ids): the odometer axis its motion is read on and the metres one use needs.
 *  h = across the ground, v = up or down, hv = either (through water). */
export const MOVEMENT_SKILLS = Object.freeze({
  3: Object.freeze({ axis: 'h', stride: 1 }),     // Jumping: a jump that carried you somewhere (one in place goes nowhere)
  17: Object.freeze({ axis: 'hv', stride: 3 }),   // Swimming: a use a game minute (5 real seconds) through the water
  18: Object.freeze({ axis: 'v', stride: 0.5 }),  // Climbing: a check each ~0.8 s up or down the wall
  21: Object.freeze({ axis: 'h', stride: 1 }),    // Running: a use every quarter second (DFU's cadence)
});
/** The most a movement skill's unspent motion is worth, in uses. */
export const MOVE_CREDIT_CAP = 2;

export const isMovementSkill = (id) => Object.prototype.hasOwnProperty.call(MOVEMENT_SKILLS, id);

/**
 * THE MOVEMENT WEIGHT of `amount` motion uses of a movement skill at 100+ (0 = it went nowhere). Reads the
 * odometer the host handed the entity (`entity._odometer`, the motor's live { h, v }); none handed, nothing moved.
 * Each skill keeps its own mark on it (`entity._moveMark`), so the run and the jump never spend each other's ground.
 */
export function movementTallyWeight(entity, skillId, amount, skill) {
  const law = MOVEMENT_SKILLS[skillId];
  if (!law || !(amount > 0) || skill >= SKILL_HARD_CAP) return 0;
  const odo = entity?._odometer;
  const read = odo ? (law.axis === 'h' ? odo.h : law.axis === 'v' ? odo.v : odo.h + odo.v) : NaN;
  if (!Number.isFinite(read)) return 0;
  const marks = (entity._moveMark ??= {});
  const m = marks[skillId];
  // a first use, or another motor's odometer (a host swap), starts the mark with nothing banked
  if (!m || m.src !== odo || !(read >= m.at)) { marks[skillId] = { src: odo, at: read, credit: 0 }; return 0; }
  m.credit = Math.min(MOVE_CREDIT_CAP, m.credit + (read - m.at) / law.stride);
  m.at = read;
  const w = Math.min(amount, m.credit);
  m.credit -= w;
  return w;
}

// ---- tougher enemies (SOFTCAP2) -----------------------------------------
//
// WHEN IT STARTS. The moment ANY combat or magic skill passes 100 - it is
// not a switch at some threshold, it grows with you point by point. What
// is measured is your COMBAT EDGE: the mean of your three best combat or
// magic skills' EFFECTIVE gain over 100 (0..40), real values only (no
// potions, no worn Fortify, and 0 while mentoring). Three, because a fight
// is fought with a weapon, a defence and a school or a crit - one lone
// 200 in Archery is an edge of 13, three of them an edge of 40.
//
// WHERE. Only in dungeons, and only as much as the DUNGEON KIND says - a
// designed table (Mac, 2026-09-29), one share per kind of the nineteen
// (formats/mapsFile.js DUNGEON_TYPES), DUNGEON_SHARE below:
//   Mine, Natural Cave                                           11%
//   Human Stronghold, Ruined Castle, Spider Nest, Cemetery       22%
//   Harpy Nest, Prison, Scorpion Nest                            44%
//   Crypt, Orc Stronghold, Giant Stronghold                      88%
//   Laboratory, Barbarian Stronghold, Coven, Vampire Haunt,
//   Desecrated Temple, Dragon's Den, Volcanic Caves             100%
// A dungeon of no known kind (NoDungeon, a bad index) scales nothing.
// SOFTCAP5: the WILDERNESS scales the same way - 22% by day, 44% at night
// (WILDERNESS_SHARE); towns, cities and other locations' grounds never.
// And only as much as the FOE is a real one: a monster's own base level
// decides (a rat in a vampire haunt stays a rat); a class enemy (bandit,
// knight, sorcerer) is built at your level already and counts in full -
// but in a low-tier dungeon the dungeon's 0 keeps it as it was.
//     foeShare = class ? 1 : clamp((baseLevel - 4) / 8, 0, 1)
//
// HOW MUCH - TWO LAYERS (Mac, 2026-09-29: "players with lvl100 skills will
// decimate those ... we need to double those minimum"). Both need Master
// Skills in force (always online; offline the player's switch) and neither
// runs while mentoring. Every number lives in ENEMY_SCALING below.
// BAL3 (the place's threat, below progressionScaling's header): the VETERAN
// row also stands by the PLACE alone - without Master Skills, while
// mentoring, offline, in a dungeon by its ladder tier and in the wilds -
// and these player-read layers sit beside it, the more of the two.
//
//  1. VETERAN - the answer to Daggerfall's own endgame, where a foe's skills
//     stop at 100 by level 14 and a monster's health never grows. It ramps in
//     as your three best combat/magic skills climb from 75 and is whole at
//     100: `veteran` 0..1, the mean of clamp((min(skill, 100) - 75) / 25).
//  2. OVERCAP - the climb past 100: your combat edge (0..40, see above); the
//     foe's skills recover 65% of it, and its health and damage grow on.
//
// At full share (a full-tier foe in a 100% dungeon):
//   your best skills   foe hit/dodge   foe health   foe damage
//        80               +2              x1.2         x1.05
//        90               +6              x1.6         x1.15
//       100              +10              x2.0         x1.25
//       150              +21              x2.6         x1.40
//       200              +36              x3.4         x1.60
// Every bonus is multiplied by dungeonShare * foeShare - a mine's 11% makes
// the 200 row x1.26 health, a crypt's 88% x3.1. The foe's real level is left
// alone (its spells, loot and gear are not scaled a second time); what it
// TEACHES rises with its skills (challengeLevel = level + skill bonus / 2).

/** The skills a fight is fought with: the combat set and the six schools. */
export const EDGE_SKILL_IDS = Object.freeze([...COMBAT_SKILL_IDS, ...MAGIC_SKILL_IDS]);
export const EDGE_TOP_N = 3;
/** The share of the player's edge a fully scaled foe wins back. */
/** THE TUNING TABLE - every enemy-strength number in one place. Bonuses are at full share: `veteran` at veteran 1
 *  (best skills at 100), `overcap` added on top at edge 40 (best skills at 200), linear between. `skill` is effective
 *  skill points; `health` / `damage` are added to a x1 multiplier. */
export const ENEMY_SCALING = Object.freeze({
  veteranFrom: 75,
  veteran: Object.freeze({ skill: 10, health: 1.0, damage: 0.25 }),
  overcap: Object.freeze({ skill: 26, health: 1.4, damage: 0.35 }),
});
/** The share of the scaling each dungeon kind carries, by DFRegion.DungeonTypes index (formats/mapsFile.js). */
export const DUNGEON_SHARE = Object.freeze([
  0.88,   //  0 Crypt
  0.88,   //  1 Orc Stronghold
  0.22,   //  2 Human Stronghold
  0.44,   //  3 Prison
  1.00,   //  4 Desecrated Temple
  0.11,   //  5 Mine
  0.11,   //  6 Natural Cave
  1.00,   //  7 Coven
  1.00,   //  8 Vampire Haunt
  1.00,   //  9 Laboratory
  0.44,   // 10 Harpy Nest
  0.22,   // 11 Ruined Castle
  0.22,   // 12 Spider Nest
  0.88,   // 13 Giant Stronghold
  1.00,   // 14 Dragon's Den
  1.00,   // 15 Barbarian Stronghold
  1.00,   // 16 Volcanic Caves
  0.44,   // 17 Scorpion Nest
  0.22,   // 18 Cemetery
]);
export const FOE_SHARE_FLOOR = 4;
export const FOE_SHARE_SPAN = 8;
export const CHALLENGE_LEVELS_PER_SKILL = 0.5;

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** The combat edge, 0..EFFECTIVE_SKILL_MAX-100: the mean effective gain over
 *  100 of the three best combat/magic skills (REAL permanent values). */
export function combatEdge(entity) {
  // SOFTCAP3: no edge while mentoring, and none while Master Skills is off (or offline) - the climb is opt-in
  if (!Array.isArray(entity?.skills) || entity._mentor || !masterSkillsActive(entity)) return 0;
  const gains = EDGE_SKILL_IDS.map((id) => Math.max(0, effectiveSkill(masterCappedSkill(entity, entity.skills[id] ?? 0, id)) - SKILL_SOFT_CAP))   // SOFTCAP4: mastered skills only
    .sort((a, b) => b - a).slice(0, EDGE_TOP_N);
  return gains.reduce((a, g) => a + g, 0) / EDGE_TOP_N;
}

/** SOFTCAP5 (Mac, 2026-09-29: "do it the same way as dungeons"): THE WILDERNESS is an area too - by day like a
 *  cemetery or a ruined castle (22%), at night like a prison or a harpy nest (44%), when night's worse things walk.
 *  Towns, cities and every other location's own ground stay unscaled (the host says where the player stands). */
export const WILDERNESS_SHARE = Object.freeze({ day: 0.22, night: 0.44 });
export const wildernessShare = (night) => (night ? WILDERNESS_SHARE.night : WILDERNESS_SHARE.day);

/** 0..1 for a dungeon kind (its DungeonTypes index); 0 for none or an unknown one. */
export const dungeonShare = (dungeonType) => (Number.isInteger(dungeonType) ? DUNGEON_SHARE[dungeonType] ?? 0 : 0);
/** 0..1 from the foe itself. */
export const foeShare = (baseLevel, isClass) => (isClass ? 1 : clamp01(((baseLevel ?? 0) - FOE_SHARE_FLOOR) / FOE_SHARE_SPAN));

/** The inverse of effectiveSkill: the smallest raw value that reads `target`. */
export function rawSkillForEffective(target) {
  if (!(target > SKILL_SOFT_CAP)) return Math.max(0, Math.round(target));
  for (let v = SKILL_SOFT_CAP; v <= SKILL_HARD_CAP; v++) if (effectiveSkill(v) >= target) return v;
  return SKILL_HARD_CAP;
}

/** VETERAN, 0..1: how far the three best combat/magic skills stand from 75 toward 100 (real values, capped at 100;
 *  0 while mentoring or while Master Skills is not in force). */
export function veteranProgress(entity) {
  if (!Array.isArray(entity?.skills) || entity._mentor || !masterSkillsActive(entity)) return 0;
  const from = ENEMY_SCALING.veteranFrom, span = SKILL_SOFT_CAP - from;
  const parts = EDGE_SKILL_IDS.map((id) => clamp01((Math.min(SKILL_SOFT_CAP, entity.skills[id] ?? 0) - from) / span))
    .sort((a, b) => b - a).slice(0, EDGE_TOP_N);
  return parts.reduce((a, g) => a + g, 0) / EDGE_TOP_N;
}

/** Both layers of one player, for the spawn door. */
export const combatStanding = (entity) => ({ veteran: veteranProgress(entity), edge: combatEdge(entity) });

// ---- the place's threat (BAL3) ---------------------------------------
//
// BAL3 (bible/05-Combat/Balance-Arc.md section 5; Mac, 2026-10-10: "Do everything and be extremely detailed", of "let
// the place set the threat, the way the source already sets loot"): THE PLACE SETS THE THREAT, NEVER THE PLAYER. The
// loot ladder grades every place a foe stands in (lootRarity.js DUNGEON_RARITY_TIER: a Cemetery 3, a mine or a cave 4,
// a Crypt 9, a Vampire Haunt 14, a Dragon's Den 18), and a corpse's or a pile's odds are that place's. The veteran
// layer above answered the PLAYER instead - their own best skills, and only with Master Skills in force (offline:
// never by default) - so the deepest dungeon in the game fielded DFU's own foes to every player who had not opted in.
// Now the veteran layer reads the PLACE: from PLACE_THREAT.from (a town's 4 - DFU's own foes) to PLACE_THREAT.full (a
// Dragon's Den's 18 - the whole veteran row, +10 skill, x2 health, x1.25 damage), linear between, times the foe's own
// share (a rat stays a rat). The wilderness stands as the dungeons it reads like (SOFTCAP5's own equivalence: by day
// between a cemetery's 3 and a ruined castle's 6, so 5; at night a harpy nest's 7). Master Skills' veteran is kept as
// a floor beside it (the player's veteran in this kind of place, whichever is more), and the overcap stays the climb's
// alone. Pure numbers: the host hands the place's veteran in, and hands 0 with the loot ladder off - the grading is
// the ladder's, so with it off the place is DFU's again, as the ladder's champions and elites are.
export const PLACE_THREAT = Object.freeze({ from: 4, full: 18, wilderness: Object.freeze({ day: 5, night: 7 }) });
/** The place's veteran, 0..1, from its tier (0..21): none at a town's 4 or under, whole at a Dragon's Den's 18. */
export const placeVeteran = (tier) => (Number.isFinite(tier) ? clamp01((tier - PLACE_THREAT.from) / (PLACE_THREAT.full - PLACE_THREAT.from)) : 0);
/** The wilderness's tier by the hour. */
export const wildernessThreat = (night) => (night ? PLACE_THREAT.wilderness.night : PLACE_THREAT.wilderness.day);

/** The whole scaling for one foe (pure). `standing` is combatStanding's { veteran, edge }; `place` the place's veteran
 *  (placeVeteran, 0..1 - BAL3). The veteran layer is the place's, or the player's veteran in this kind of place
 *  (dShare), whichever is more; the overcap is the player's climb, in this kind of place. null = none. */
export function progressionScaling(standing, dShare, fShare, place = 0) {
  const share = clamp01(dShare) * clamp01(fShare);
  const v = clamp01(standing?.veteran ?? 0);
  const p = clamp01(place);
  const o = clamp01((standing?.edge ?? 0) / (EFFECTIVE_SKILL_MAX - SKILL_SOFT_CAP));
  const vet = Math.max(clamp01(fShare) * p, share * v);   // BAL3: the place's veteran, the foe's share of it - Master Skills' a floor beside it
  const over = share * o;
  if (!(vet > 0 || over > 0)) return null;
  const { veteran: V, overcap: O } = ENEMY_SCALING;
  const skillGain = V.skill * vet + O.skill * over;
  return {
    share, veteran: v, place: p, edge: standing?.edge ?? 0,
    skillGain,
    healthMult: 1 + V.health * vet + O.health * over,
    damageMult: 1 + V.damage * vet + O.damage * over,
    challengeLevels: Math.round(skillGain * CHALLENGE_LEVELS_PER_SKILL),
  };
}
