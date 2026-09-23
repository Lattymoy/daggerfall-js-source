// SURV6 - HUNTING, FORAGING AND THE WATER SEARCH, PURE. Climates &
// Calories' Hunting class (read off the DLL - HuntingRound, HuntCheck,
// the five climate rolls, the Yes/No box, TimeSkip, the checks by bow
// or bare hands, GiveRawMeat / GiveApples / GiveOranges / RefillWater,
// InflictPoison, SpawnBeast) restated as three laws the host composes:
//
//   huntRoll     - the minute's chance of an EVENT: a cluster of green
//                  in the desert, tracks in the woods, birds in the
//                  grass, a ripple in the swamp. Outdoors, in the
//                  wilderness, by day, with no foe near, off a luck
//                  roll and a cooldown on the record.
//   huntOutcome  - what the search finds, by the event and the hunter:
//                  a bow asks Archery (and Stealth for the sneak), bare
//                  hands ask Stealth and Critical Strike, a tree asks
//                  Climbing - each against a d100 with the luck mod.
//                  Meat, fruit or water; a bite that may be poison,
//                  a foul pool that may be disease, a fall, a boar;
//                  or the roar - "You are not the hunter, but the
//                  hunted!" - and a beast by the climate.
//   applyHuntOutcome - the finds into the pack, the harm onto the
//                  entity through the handlers handed in (the leaf
//                  imports no poisons.js or diseases.js - the meal's
//                  law (food.js sickenFromMeal) is the same shape).
//
// THE OVERHAUL: the mod skipped the clock an hour behind a box; the
// port's event is REAL-TIME (Mac's brief) - a Yes/No prompt, then a
// busy page that runs its game minutes at HUNT_WAIT_PER_HOUR real
// seconds an hour (ui/huntWindow.js), then the outcome box. Offline
// the minutes then pass on the clock; online the clock is nobody's
// (WORLD5) and the wait alone is the cost. The beast stands when the
// box closes, not under it - a foe keeps its clock under a window
// (WINFOE1) and would have had the first blow free.
//
// SURV-TIERS (2026-09-23): THE HUNT IS THE WORLD'S, ITS HARMS ARE THE
// TIER'S. The events, their odds and the catch are the same in every
// tier. A tier without hunt harms (Casual - survival/difficulty.js
// `huntHarms`) takes each harmful outcome's SAFE TWIN below: the same
// search on the same rolls with the harm gone - the clean shot without
// the bite, the pool you smelled and left, the prey that got away
// instead of the thing that was hunting you.
//
// PURE: no scene, ui, combat or effect import (the leaf rule).
import { survivalOf } from './needs.js';
import { TEMPLATE, refillSkins, FOUL_MEAL_DISEASES } from './food.js';
import { HARD_RULES } from './difficulty.js';
import { createSurvivalItem, SURVIVAL_USE_TEXT } from './items.js';
import { MOBILE_TYPES } from '../../characters/mobileTypes.js';

/** The mod's HuntCheck switch: which climates hunt, and as what. */
export const HUNT_CLIMATE = Object.freeze({
  224: 'desert', 225: 'desert', 229: 'subtropical', 228: 'swamp', 227: 'swamp',
  231: 'woods', 232: 'woods', 226: 'mountain', 230: 'mountain',
});
/** Each climate's two events (the mod's Random(0, 11) halves). */
export const HUNT_EVENTS = Object.freeze({
  desert: Object.freeze(['water', 'rocks']), subtropical: Object.freeze(['water', 'fruit']),
  swamp: Object.freeze(['birds', 'lizard']), woods: Object.freeze(['birds', 'tracks']), mountain: Object.freeze(['birds', 'tracks']),
});
/** HuntingRound's odds: the luck mod (luck / 10, plus one) against
 *  Random(1, 200), or 300 in winter; then Dice100(70). */
export const HUNT_ODDS = Object.freeze({ summer: 200, winter: 300, event: 70 });
/** After an event the round sleeps Random(100, 500) game minutes. */
export const HUNT_COOLDOWN = Object.freeze([100, 500]);
/** A search takes Random(30, 60) game minutes (TimeSkip's band)... */
export const HUNT_MINUTES = Object.freeze([30, 60]);
/** ...at this many REAL seconds a game hour on the busy page - roughly
 *  ten times the rest window's REST_WAIT_PER_HOUR (0.75): a rest is a
 *  skip, a hunt is a happening. */
export const HUNT_WAIT_PER_HOUR = 8;
export const huntRealSeconds = (minutes) => Math.round((minutes / 60) * HUNT_WAIT_PER_HOUR * 100) / 100;
/** The snake's and the lizard's bite: any poison, the mod's Random(128, 140). */
export const BITE_POISON_RANGE = Object.freeze([128, 139]);
/** A foul pool's diseases: the same curable three a foul meal risks. */
export const FOUL_WATER_DISEASES = FOUL_MEAL_DISEASES;
/** A pool's water by its size, kg (a skin holds two). */
export const POOL_KG = Object.freeze({ pool: 5, smallPool: 2, foul: 1 });
/** The mountain fall's health, the boar's fatigue (in the stat's units). */
export const FALL_HURT = Object.freeze([1, 4]);
export const BOAR_FATIGUE = 10 * 64;

export const SKILL = Object.freeze({ Stealth: 16, Climbing: 18, Archery: 33, CriticalStrike: 34 });

const dice100 = (chance, roll01) => Math.floor(roll01 * 100) < chance;
const range = ([min, max], rolls) => min + Math.floor(rolls() * (max - min + 1));
const luckMod = (luck) => Math.trunc((luck ?? 50) / 10);

/** SpawnBeast's table: Random(0, 11) - under 2 three, under 4 two,
 *  under 9 one, else the alternate dragonling alone. */
export const BEAST_BY_CLIMATE = Object.freeze({
  desert: Object.freeze([MOBILE_TYPES.GiantScorpion, MOBILE_TYPES.GiantScorpion, MOBILE_TYPES.GiantScorpion]),
  subtropical: Object.freeze([MOBILE_TYPES.GiantScorpion, MOBILE_TYPES.GiantScorpion, MOBILE_TYPES.GiantScorpion]),
  swamp: Object.freeze([MOBILE_TYPES.GrizzlyBear, MOBILE_TYPES.Spider, MOBILE_TYPES.Spider]),
  woods: Object.freeze([MOBILE_TYPES.GrizzlyBear, MOBILE_TYPES.GrizzlyBear, MOBILE_TYPES.Spriggan]),
  mountain: Object.freeze([MOBILE_TYPES.SabertoothTiger, MOBILE_TYPES.SabertoothTiger, MOBILE_TYPES.SabertoothTiger]),
});
export function beastFor(climate, rolls = Math.random) {
  const r = Math.floor(rolls() * 11);
  const t = BEAST_BY_CLIMATE[climate] ?? BEAST_BY_CLIMATE.woods;
  if (r < 2) return { mobileType: t[0], count: 3 };
  if (r < 4) return { mobileType: t[1], count: 2 };
  if (r < 9) return { mobileType: t[2], count: 1 };
  return { mobileType: MOBILE_TYPES.Dragonling_Alternate, count: 1 };
}

/**
 * The minute's roll. `s` is the survival record (the cooldown rides it
 * as `huntAt`, saved with the rest). Returns the event { climate, kind }
 * or null. The host asks once a game minute.
 */
export function huntRoll(s, {
  minute = 0, luck = 50, winter = false, outdoors = true, inLocationRect = false, night = false, enemiesNear = false, resting = false, climateIndex = 232,
} = {}, rolls = Math.random) {
  const climate = HUNT_CLIMATE[climateIndex];
  if (!climate || !outdoors || inLocationRect || night || enemiesNear || resting) return null;
  if (minute < (s?.huntAt ?? 0)) return null;
  const chance = (1 + luckMod(luck)) / (winter ? HUNT_ODDS.winter : HUNT_ODDS.summer);
  if (rolls() >= chance) return null;
  if (!dice100(HUNT_ODDS.event, rolls())) return null;
  s.huntAt = minute + range(HUNT_COOLDOWN, rolls);
  const [a, b] = HUNT_EVENTS[climate];
  return { climate, kind: rolls() < 0.5 ? a : b };
}

/** The prompts, the mod's own words (a winter variant where it had one). */
export const HUNT_PROMPT = Object.freeze({
  water: Object.freeze(['You spot a cluster of greener vegetation off in the distance.', 'There might be a source of water there where you could refill your waterskin.', '', 'Do you wish to spend some time searching for water?']),
  rocks: Object.freeze(['You spot a cluster of rocks in the distance.', 'There might be animals seeking shelter between them to avoid the harsh sun.', '', 'Do you wish to spend some time checking the rocks?']),
  fruit: Object.freeze(['You spot a gathering of trees in the distance.', 'There might be some ripe fruits to pick from them.', '', 'Do you wish to spend some time checking the trees?']),
  birds: Object.freeze(['You spot a flock of birds settling down in the tall grass.', '', 'Do you wish to spend some time attempting to hunt them?']),
  birdsWinter: Object.freeze(['You spot a flock of birds settling down in some snow-covered bushes.', '', 'Do you wish to spend some time attempting to hunt them?']),
  birdsMountain: Object.freeze(['You spot a flock of birds settling down between some rocks.', '', 'Do you wish to spend some time attempting to hunt them?']),
  lizard: Object.freeze(['You see something slither under the surface of the murky water.', '', 'Do you wish to spend some time attempting to hunt it?']),
  tracks: Object.freeze(['You spot a set of animal tracks. They seem fresh.', '', 'Do you wish to spend some time on a hunt?']),
});
export function huntPrompt({ climate, kind }, { winter = false } = {}) {
  if (kind === 'birds' && climate === 'mountain') return HUNT_PROMPT.birdsMountain;
  if (kind === 'birds' && winter) return HUNT_PROMPT.birdsWinter;
  return HUNT_PROMPT[kind] ?? HUNT_PROMPT.tracks;
}
/** The busy page's line while the real seconds run. */
export const HUNT_BUSY = Object.freeze({
  water: 'You search for water...', rocks: 'You search among the rocks...', fruit: 'You search the trees...',
  birds: 'You slowly and quietly sneak towards the birds...', lizard: 'You keep completely still at the water\'s edge...', tracks: 'You track your prey...',
});

/** The outcome lines by their key, the mod's own words where it had them. */
export const HUNT_TEXT = Object.freeze({
  hunted: ['You spend some time searching, when you suddenly hear a sound...', 'It seems you are about to become another hunter\'s meal!'],
  roar: ['You track your prey for some time. As you suspect you are getting near, you hear a sudden roar behind you.', 'You are not the hunter, but the hunted!'],
  birdsRoar: ['You slowly and quietly sneak towards the birds.', 'They all flee into the air as a deep roar is heard nearby!'],
  lizardHunted: ['You sneak up to the water\'s edge and keep completely still.', 'Suddenly you hear a sound behind you.', 'You are not the hunter, but the hunted!'],
  pool: ['After some searching you find a pool of water.', 'The water seems safe to drink.'],
  smallPool: ['After some searching you find a small pool of water.', 'The water seems safe to drink.'],
  unsafe: ['After some searching you find a small pool of water.', 'You smell the water and decide it is unsafe to drink.'],
  foul: ['After some searching you find a small pool of water.', 'The water tastes somewhat foul, but you fill your waterskin with what you can scoop up.', 'You are sure it is drinkable...'],
  dust: ['No matter how much you search, you find nothing but dusty rocks.'],
  snakeShot: ['You spot a snake among the rocks. You take careful aim and nail it with an arrow.', 'You poke the snake to make sure it is dead before picking it up.', 'You spend some time butchering the snake.'],
  snakeShotBite: ['You spot a snake among the rocks. You take careful aim and nail it with an arrow.', 'As you pick up the dead snake, it suddenly twitches and sinks its fangs into your hand.', 'You spend some time butchering the snake.', 'You hope the snake was not poisonous...'],
  snakeMiss: ['You spot a snake among the rocks and take aim with your bow.', 'You miss and the snake slithers away.', 'You spend some more time searching, but no luck.'],
  snakeMissBite: ['You miss the snake and it slithers away.', 'As you search among the rocks you suddenly feel a sharp pain on your leg.', 'You hope whatever bit you was not poisonous...'],
  snakeGrab: ['While searching the rocks, you come upon a sleeping snake.', 'Your hand shoots out, grabbing the snake\'s tail. You whip it around and smack it into a rock.', 'You spend some time butchering the snake.'],
  snakeGrabBite: ['While searching the rocks, you come upon a snake.', 'Its head shoots out, sinking its fangs into your hand. You whip it around and smack it into a rock.', 'You spend some time butchering the snake.', 'You hope the snake was not poisonous...'],
  snakeBite: ['While searching the rocks, you come upon a snake.', 'Its head shoots out, sinking its fangs into your hand.', 'You let out a yelp as the snake dislodges and slithers under a rock.', 'You hope the snake was not poisonous...'],
  snakeGone: ['While searching the rocks, you come upon a sleeping snake.', 'You attempt to get within striking distance, but the snake wakes and slithers underneath a large rock.', 'You spend some more time searching, but no luck.'],
  fruitEasy: ['You spot some fruits on a small tree and easily pick them.'],
  fruitClimb: ['You spot some fruits left on the highest branches of a tree.', 'You climb up between the branches and pick some fruit.'],
  fruitFall: ['You spot some fruits left on the highest branches of a tree.', 'You attempt to climb the tree but are unable to get up there.', 'Frustrated, you give up and continue your journey.'],
  fruitStrange: ['You pick a strange fruit from the tree and take a tentative bite.', 'It seems edible at first, but then you feel your stomach cramp.', 'You hope it was not poisonous and continue your journey.'],
  fruitNone: ['All edible fruits seem to have already been picked.', 'Disappointed, you continue your journey.'],
  birdsVolley: (n) => ['You slowly and quietly sneak towards the birds, readying your bow and arrow.', 'You loose the arrow, piercing one of the birds. The rest take flight but you manage to loose several more arrows before they are out of range.', `You pick up the ${n} dead birds and spend some time preparing them.`],
  birdsShot: ['You slowly and quietly sneak towards the birds, readying your bow and arrow.', 'You loose the arrow, piercing one of the birds. The rest take flight and your next shot goes wide of your prey. They are soon out of range.', 'You collect the dead bird and spend some time preparing it.'],
  birdsStrike: ['You slowly and quietly sneak towards the birds, preparing to strike.', 'You leap forward, attempting to reach your mark before it takes off.', 'Your strike connects with a satisfying sound, the rest of the flock quickly flies away.', 'You collect the dead bird and spend some time preparing it.'],
  birdsSpooked: ['You slowly and quietly sneak towards the birds.', 'Before you are in position, something spooks the birds and they suddenly take to the air.'],
  lizardShot: ['You sneak up to the water\'s edge and keep completely still.', 'Another ripple in the water appears and you release an arrow.', 'You pull your scaly prey out of the swamp and butcher it.'],
  lizardMiss: ['You sneak up to the water\'s edge and keep completely still.', 'Another ripple in the water appears and you release an arrow.', 'You miss the animal and the ripple does not reappear.'],
  lizardStrike: ['You sneak up to the water\'s edge and keep completely still.', 'Your strike connects with a satisfying sound, and you leverage the struggling lizard out of the water.', 'You spend some time butchering the animal.'],
  lizardGone: ['You sneak up to the water\'s edge and keep completely still.', 'Time goes by while you stare intently at the water.', 'The ripples never appear again. Finally, you give up.'],
  lizardBite: ['You sneak up to the water\'s edge and keep completely still.', 'You strike the water and some kind of fanged lizard explodes out of the water, sinking its teeth into your arm.', 'You manage to shake it off and it disappears back into the water.', 'You hope it was not poisonous...'],
  deerShot: ['You track a set of deer prints for some time.', 'As you get within range, you nock an arrow and wait for the right moment.', 'Your arrow flies true. The deer takes a few steps and collapses.'],
  deerMiss: ['You track a set of deer prints for some time.', 'As you get within range, you nock an arrow and wait for the right moment.', 'The deer suddenly leaps away and disappears, your arrow going wide of the mark.'],
  goatShot: ['You follow the trail of a mountain goat for some time.', 'As you get within range, you nock an arrow and wait for the right moment.', 'Your arrow flies true. The goat takes a few steps and collapses.'],
  goatMiss: ['You follow the trail of a mountain goat for some time.', 'As you get within range, you nock an arrow and wait for the right moment.', 'You miss, the arrow bouncing off the rocks. The goat escapes unscathed.'],
  rabbitShot: ['You find traces of rabbits in the area.', 'You spot movement in the underbrush and stay perfectly still.', 'After some time, you get a clear shot and your arrow pierces the animal.'],
  rabbitMiss: ['You find traces of rabbits in the area.', 'You spot movement in the underbrush and stay perfectly still.', 'Your arrow goes wide of the mark, the rabbit scampers off.'],
  rabbitStrike: ['You find traces of rabbits in the area.', 'You spot movement in the underbrush and attempt to get closer.', 'After some time, you have the animal within range and you lunge!', 'You kill the rabbit in a single strike.'],
  rabbitGone: ['You find traces of rabbits in the area.', 'You spot movement in the underbrush and attempt to get closer.', 'After some time, you have the animal within range and you lunge!', 'The rabbit is too quick and scampers away.'],
  // SURV-TIERS: the one line the port adds - the roar's safe twin, for a hunter with or without a bow (the mod's
  // own misses each name the weapon)
  trailCold: ['You track your prey for some time.', 'The trail goes cold, and you give up the hunt.'],
  boar: ['You find traces of rabbits in the area.', 'You spot movement in the underbrush and attempt to get closer.', 'Suddenly, a wild boar charges at you!', 'After a furious struggle you manage to chase it off.'],
  fall: ['You find traces of rabbits in the area.', 'You spot movement in the underbrush and attempt to get closer.', 'Suddenly the rocks beneath your foot give way and you take a hard fall.', 'The rabbit scampers off and you are left nursing your bruises.'],
  gained: (n, what) => `You gain ${n} ${what}.`,
  skinsFilled: 'You fill your waterskins.',
});

/** The d100 checks: the skill (plus the luck mod, less five) against Random(1, 100). */
const check = (skill, luck, rolls) => (skill ?? 0) + luckMod(luck) - 5 >= 1 + Math.floor(rolls() * 100);
const outcome = (key, extra = {}) => ({
  key, lines: typeof HUNT_TEXT[key] === 'function' ? HUNT_TEXT[key](extra.meat) : HUNT_TEXT[key],
  meat: 0, fruit: 0, waterKg: 0, poison: false, disease: false, beast: null, hurt: 0, tired: false, skills: [], ...extra,
});

// MOD: the foraged catch (meat, fruit) is halved the same way
// survival/loot.js halves a corpse's meat - stochastic rounding, so a
// single-unit catch (a rabbit, a bird) still averages 50% over many
// hunts instead of always rounding back up to 1 every time. Applied
// once, over whatever huntOutcome's switch settled on, so every branch
// above is cut without having to touch each one. Unconditional ("all
// modes"): the catch is the world's, the same in every tier - the tiers
// (SURV-TIERS) differ only in the HARMS, through HUNT_SAFE_TWIN below.
export const HUNT_LOOT_SCALE = 0.5;

/** SURV-TIERS: each harmful outcome's safe twin - every key whose outcome
 *  can carry a poison, a disease, a wound, the boar's fatigue or a beast.
 *  The twin keeps what the search FOUND (its meat, fruit and the skills it
 *  used) and nothing that harms; a foul pool's water is its harm's vehicle
 *  and goes with it. test/survtiers.test.js walks every event and weapon at
 *  three skill levels on 200 seeded rolls (12,000 hunts) to hold that no harm survives a Casual hunt. */
export const HUNT_SAFE_TWIN = Object.freeze({
  snakeShotBite: 'snakeShot', snakeMissBite: 'snakeMiss', snakeGrabBite: 'snakeGrab', snakeBite: 'snakeGone',
  lizardBite: 'lizardGone', fruitStrange: 'fruitNone', foul: 'unsafe',
  fall: 'rabbitGone', boar: 'rabbitGone',
  hunted: 'dust', birdsRoar: 'birdsSpooked', lizardHunted: 'lizardGone', roar: 'trailCold',
});
function scaledYield(n, rolls) {
  if (n <= 0) return n;
  const scaled = n * HUNT_LOOT_SCALE;
  const whole = Math.floor(scaled);
  const frac = scaled - whole;
  return frac > 0 && rolls() < frac ? whole + 1 : whole;
}

/**
 * What the search finds. `skills` is the hunter's live four (Archery,
 * Stealth, Critical Strike, Climbing); `hasBow` the weapon in hand.
 * Returns { key, lines, meat, fruit, waterKg, poison, disease, beast,
 * hurt, tired, skills } - `skills` the ids the search used, for the
 * host's tally. `rules` is the hunter's tier (Hard's when none).
 */
export function huntOutcome({ climate, kind }, { hasBow = false, skills = {}, luck = 50, rolls = Math.random, rules = HARD_RULES } = {}) {
  let result = huntOutcomeRaw({ climate, kind }, { hasBow, skills, luck, rolls });
  // SURV-TIERS: the twin is taken BEFORE the scale below, so both tiers scale the same catch on the same rolls
  const twin = !(rules ?? HARD_RULES).huntHarms ? HUNT_SAFE_TWIN[result.key] : null;
  if (twin) result = outcome(twin, { meat: result.meat, fruit: result.fruit, skills: result.skills });
  // MOD: the one scale point every branch above shares - see HUNT_LOOT_SCALE.
  result.meat = scaledYield(result.meat, rolls);
  result.fruit = scaledYield(result.fruit, rolls);
  return result;
}

function huntOutcomeRaw({ climate, kind }, { hasBow = false, skills = {}, luck = 50, rolls = Math.random } = {}) {
  const d = 1 + Math.floor(rolls() * 100);   // Random(1, 101)
  const shot = () => check(skills.archery, luck, rolls);
  const sneak = () => check(skills.stealth, luck, rolls);
  const strike = () => check(skills.criticalStrike, luck, rolls);
  const climb = () => check(skills.climbing, luck, rolls);
  const bow = [SKILL.Archery, SKILL.Stealth], hands = [SKILL.Stealth, SKILL.CriticalStrike];
  const beast = (key) => outcome(key, { beast: beastFor(climate, rolls) });
  switch (kind) {
    case 'water':
      if (d <= 40) return outcome('pool', { waterKg: POOL_KG.pool });
      if (d <= 65) return outcome('smallPool', { waterKg: POOL_KG.smallPool });
      if (d <= 80) return outcome('unsafe');
      if (d <= 92) return outcome('foul', { waterKg: POOL_KG.foul, disease: true });
      return outcome('dust');
    case 'rocks':
      if (d > 95) return beast('hunted');
      if (hasBow) {
        if (shot()) return dice100(15, rolls()) ? outcome('snakeShotBite', { meat: 1, poison: true, skills: bow }) : outcome('snakeShot', { meat: 1, skills: bow });
        return dice100(30, rolls()) ? outcome('snakeMissBite', { poison: true, skills: bow }) : outcome('snakeMiss', { skills: bow });
      }
      if (strike()) return dice100(30, rolls()) ? outcome('snakeGrabBite', { meat: 1, poison: true, skills: hands }) : outcome('snakeGrab', { meat: 1, skills: hands });
      return dice100(50, rolls()) ? outcome('snakeBite', { poison: true, skills: hands }) : outcome('snakeGone', { skills: hands });
    case 'fruit':
      if (d <= 50) return outcome('fruitEasy', { fruit: range([1, 3], rolls) });
      if (d <= 75) return climb() ? outcome('fruitClimb', { fruit: range([2, 4], rolls), skills: [SKILL.Climbing] }) : outcome('fruitFall', { skills: [SKILL.Climbing] });
      if (d <= 88) return outcome('fruitStrange', { poison: true });
      return outcome('fruitNone');
    case 'birds':
      if (d > 90) return beast('birdsRoar');
      if (hasBow) {
        if (sneak() && shot()) return shot() ? outcome('birdsVolley', { meat: range([2, 3], rolls), skills: bow }) : outcome('birdsShot', { meat: 1, skills: bow });
        return outcome('birdsSpooked', { skills: bow });
      }
      return sneak() && strike() ? outcome('birdsStrike', { meat: 1, skills: hands }) : outcome('birdsSpooked', { skills: hands });
    case 'lizard':
      if (d > 90) return beast('lizardHunted');
      if (hasBow) return shot() ? outcome('lizardShot', { meat: 2, skills: bow }) : outcome('lizardMiss', { skills: bow });
      if (strike()) return outcome('lizardStrike', { meat: 2, skills: hands });
      return dice100(50, rolls()) ? outcome('lizardBite', { poison: true, skills: hands }) : outcome('lizardGone', { skills: hands });
    case 'tracks':
    default: {
      if (d > 90) return beast('roar');
      const big = climate === 'mountain' ? 'goat' : 'deer';
      if (hasBow) {
        if (dice100(50, rolls())) return shot() ? outcome(`${big}Shot`, { meat: range([4, 6], rolls), skills: bow }) : outcome(`${big}Miss`, { skills: bow });
        return shot() ? outcome('rabbitShot', { meat: 1, skills: bow }) : outcome('rabbitMiss', { skills: bow });
      }
      if (strike()) return outcome('rabbitStrike', { meat: 1, skills: hands });
      if (dice100(10, rolls())) return climate === 'mountain' ? outcome('fall', { hurt: range(FALL_HURT, rolls), skills: hands }) : outcome('boar', { tired: true, skills: hands });
      return outcome('rabbitGone', { skills: hands });
    }
  }
}

/**
 * The finds into `items`, the harm onto `entity`: raw meat and fruit
 * minted (apples or oranges by the coin), the skins filled, a bite's
 * poison and a foul pool's disease through the handlers (poisons.js
 * inflictPoison's and diseases.js inflictDisease's shapes), the fall's
 * health, the boar's fatigue. Returns the box's rows: the outcome's
 * lines and what was gained.
 */
export function applyHuntOutcome(entity, items, o, { now = 0, currentDay = 0, rolls = Math.random, inflictPoison = null, inflictDisease = null, onContract = null } = {}) {
  const rows = [...(o?.lines ?? [])];
  if (!o) return rows;
  const list = Array.isArray(items) ? items : [];
  if (o.meat > 0) {
    for (let i = 0; i < o.meat; i++) { const it = createSurvivalItem(TEMPLATE.RawMeat); if (it) list.push(it); }
    rows.push('', HUNT_TEXT.gained(o.meat, 'Raw Meat'));
  }
  if (o.fruit > 0) {
    const t = rolls() < 0.5 ? TEMPLATE.Apple : TEMPLATE.Orange;
    for (let i = 0; i < o.fruit; i++) { const it = createSurvivalItem(t); if (it) list.push(it); }
    rows.push('', HUNT_TEXT.gained(o.fruit, t === TEMPLATE.Apple ? (o.fruit === 1 ? 'Apple' : 'Apples') : (o.fruit === 1 ? 'Orange' : 'Oranges')));
  }
  if (o.waterKg > 0) {
    const r = refillSkins(list, o.waterKg);
    rows.push('', r.skins === 0 ? SURVIVAL_USE_TEXT.noSkins : r.poured > 0 ? HUNT_TEXT.skinsFilled : SURVIVAL_USE_TEXT.fullSkin);
  }
  if (o.poison && entity && typeof inflictPoison === 'function') {
    inflictPoison(entity, range(BITE_POISON_RANGE, rolls), false, { rolls, currentMinute: now });
  }
  if (o.disease && entity && typeof inflictDisease === 'function') {
    inflictDisease(entity, FOUL_WATER_DISEASES, { rolls, currentDay, onContract });
  }
  if (o.hurt > 0 && entity) entity.health = Math.max(1, (entity.health ?? 1) - o.hurt);
  if (o.tired && entity) entity.fatigue = Math.max(0, (entity.fatigue ?? 0) - BOAR_FATIGUE);
  if (entity) survivalOf(entity, now);   // the record exists for the cooldown to ride
  return rows;
}
