// @ts-check
// FIXED-PVE (bible/05-Combat/Fixed-PvE.md): A MOB TEMPLATE IS ONE GAMEPLAY VARIANT - a species' body at a fixed level
// and category, with its roles, abilities, temper and kit. Many templates share one body: an Orc Grunt and an Orc
// Defender draw the same sprite and fight apart. Its numbers come from its level, category and roles alone, so two
// players meet the same foe. A group template is an encounter: members that fight as one. Ledger A (FIXED-PVE).

import { SPECIES_BY_KEY } from './pveSpecies.js';
import { PVE_CATEGORIES, LEVEL_MIN, LEVEL_MAX, categoryStats } from './pveCategories.js';
import { COMBAT_ROLES, NONCOMBAT_ROLES, roleProblem, roleShares } from './pveRoles.js';
import { abilityProblem } from './pveAbilities.js';
import { DISPOSITIONS, WILDLIFE, INTERACTIONS } from './pveDisposition.js';
import { PROVINCES } from '../../world/tamriel/tamrielGeography.js';

/** The metals a foe's kit may be made of (systems/armorMaterials.js names). */
export const KIT_METALS = Object.freeze(['iron', 'steel', 'silver', 'elven', 'dwarven', 'mithril', 'adamantium',
  'ebony', 'orcish', 'daedric', 'leather', 'chain']);

/** @typedef {{ key: string, name: string, species: string, level: number, category: string, roles: string[],
 *  noncombat?: string[], abilities?: string[], disposition: string, wildlife?: string, interact?: string[],
 *  faction?: string|null, protected?: boolean, kit?: string|null, pack?: { health: number, damage: number }, area?: string|null }} MobTemplate */

const T = (o) => Object.freeze({ noncombat: [], abilities: [], interact: [], faction: null, protected: false, kit: null, area: null, ...o });

/** @type {ReadonlyArray<MobTemplate>} */
export const MOB_TEMPLATES = Object.freeze([
  // an orc stronghold: seven ways to be an orc on three bodies
  T({ key: 'orc-grunt', name: 'Orc Grunt', species: 'orc', level: 24, category: 'normal', roles: ['fighter'], abilities: ['cleave'], disposition: 'hostile', faction: 'orc-clans', kit: 'orcish' }),
  T({ key: 'orc-defender', name: 'Orc Defender', species: 'orc', level: 26, category: 'normal', roles: ['tank'], abilities: ['shieldWall', 'guardAlly'], disposition: 'hostile', faction: 'orc-clans', kit: 'orcish' }),
  T({ key: 'orc-hunter', name: 'Orc Hunter', species: 'orc', level: 27, category: 'normal', roles: ['assassin'], noncombat: ['hunter'], abilities: ['charge', 'retreat'], disposition: 'neutral', faction: 'orc-clans', kit: 'leather' }),
  T({ key: 'orc-shaman', name: 'Orc Shaman', species: 'orc-shaman', level: 29, category: 'normal', roles: ['mage', 'healer'], abilities: ['shamanSpells', 'mendAlly'], disposition: 'neutral', faction: 'orc-clans' }),
  T({ key: 'orc-warlord', name: 'Orc Warlord', species: 'orc-warlord', level: 33, category: 'strong', roles: ['commander', 'fighter'], abilities: ['warCry', 'rally', 'callHelp'], disposition: 'hostile', faction: 'orc-clans', kit: 'orcish' }),
  T({ key: 'orc-merchant', name: 'Orc Merchant', species: 'orc', level: 25, category: 'normal', roles: ['fighter'], noncombat: ['merchant'], disposition: 'friendly', interact: ['talk', 'trade'], faction: 'orc-clans', protected: true }),
  T({ key: 'orc-stronghold-guard', name: 'Orc Stronghold Guard', species: 'orc-sergeant', level: 30, category: 'strong', roles: ['tank'], noncombat: ['guard'], abilities: ['shieldWall', 'callHelp'], disposition: 'neutral', faction: 'orc-clans', protected: true, kit: 'orcish' }),
  // a crypt
  T({ key: 'crypt-skeleton', name: 'Crypt Skeleton', species: 'skeletal-warrior', level: 12, category: 'normal', roles: ['fighter'], disposition: 'hostile', kit: 'iron' }),
  T({ key: 'crypt-guardian', name: 'Crypt Guardian', species: 'skeletal-warrior', level: 15, category: 'strong', roles: ['tank'], abilities: ['shieldWall', 'stoneskin'], disposition: 'hostile', kit: 'steel' }),
  T({ key: 'crypt-wraith', name: 'Crypt Wraith', species: 'wraith', level: 18, category: 'normal', roles: ['assassin'], abilities: ['interrupt'], disposition: 'hostile' }),
  T({ key: 'crypt-lich', name: 'Lich of the Deep Crypt', species: 'lich', level: 40, category: 'boss', roles: ['mage', 'summoner'], abilities: ['lichSpells', 'summonKin', 'warded', 'curbing'], disposition: 'hostile' }),
  // a bandit camp on class bodies (the ones with bows)
  T({ key: 'bandit-cutthroat', name: 'Bandit Cutthroat', species: 'rogue', level: 8, category: 'normal', roles: ['assassin'], abilities: ['charge'], disposition: 'hostile', faction: 'bandits', kit: 'leather' }),
  T({ key: 'bandit-archer', name: 'Bandit Archer', species: 'archer', level: 9, category: 'normal', roles: ['archer'], abilities: ['retreat'], disposition: 'hostile', faction: 'bandits', kit: 'leather' }),
  T({ key: 'bandit-hedge-healer', name: 'Bandit Hedge-Healer', species: 'healer', level: 10, category: 'normal', roles: ['healer'], abilities: ['mendAlly', 'mendSelf'], disposition: 'hostile', faction: 'bandits' }),
  T({ key: 'bandit-chief', name: 'Bandit Chief', species: 'knight', level: 12, category: 'strong', roles: ['commander', 'berserker'], abilities: ['warCry', 'rally', 'rage'], disposition: 'hostile', faction: 'bandits', kit: 'steel' }),
  // the wild
  T({ key: 'wild-rat', name: 'Rat', species: 'rat', level: 1, category: 'normal', roles: ['fighter'], noncombat: ['wildlife'], disposition: 'neutral', wildlife: 'passive' }),
  T({ key: 'grizzly', name: 'Grizzly Bear', species: 'grizzly-bear', level: 6, category: 'normal', roles: ['berserker'], noncombat: ['wildlife'], abilities: ['rage'], disposition: 'territorial', wildlife: 'territorial' }),
  T({ key: 'sabretooth', name: 'Sabretooth', species: 'sabretooth-tiger', level: 9, category: 'normal', roles: ['assassin'], noncombat: ['wildlife'], abilities: ['leap'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'grove-spriggan', name: 'Grove Spriggan', species: 'spriggan', level: 8, category: 'normal', roles: ['tank'], abilities: ['mendSelf'], disposition: 'territorial' }),
  // ROSTER (2026-10-30): every band has foes in every province - outlaws on each road and wild, beasts by their climates,
  // the dead and the conjured in their dungeons. Levels climb by band (pveZones.js ZONE_BANDS); a leader one step stronger.
  T({ key: 'bandit-footpad', name: 'Footpad', species: 'thief', level: 3, category: 'normal', roles: ['assassin'], disposition: 'hostile', faction: 'bandits', kit: 'leather' }),
  T({ key: 'bandit-poacher', name: 'Poacher', species: 'archer', level: 5, category: 'normal', roles: ['archer'], disposition: 'hostile', faction: 'bandits', kit: 'leather' }),
  T({ key: 'bandit-thug', name: 'Thug', species: 'warrior', level: 6, category: 'normal', roles: ['fighter'], disposition: 'hostile', faction: 'bandits', kit: 'iron' }),
  T({ key: 'highwayman', name: 'Highwayman', species: 'warrior', level: 15, category: 'normal', roles: ['fighter'], abilities: ['charge'], disposition: 'hostile', faction: 'bandits', kit: 'iron' }),
  T({ key: 'highway-archer', name: 'Highway Archer', species: 'ranger', level: 16, category: 'normal', roles: ['archer'], abilities: ['retreat'], disposition: 'hostile', faction: 'bandits', kit: 'leather' }),
  T({ key: 'highway-mender', name: 'Highway Mender', species: 'healer', level: 17, category: 'normal', roles: ['healer'], abilities: ['mendAlly'], disposition: 'hostile', faction: 'bandits' }),
  T({ key: 'highway-captain', name: 'Highway Captain', species: 'knight', level: 19, category: 'strong', roles: ['commander', 'fighter'], abilities: ['warCry', 'rally'], disposition: 'hostile', faction: 'bandits', kit: 'steel' }),
  T({ key: 'marauder', name: 'Marauder', species: 'warrior', level: 23, category: 'normal', roles: ['berserker'], abilities: ['rage'], disposition: 'hostile', faction: 'bandits', kit: 'steel' }),
  T({ key: 'marauder-bowman', name: 'Marauder Bowman', species: 'archer', level: 24, category: 'normal', roles: ['archer'], abilities: ['retreat'], disposition: 'hostile', faction: 'bandits', kit: 'steel' }),
  T({ key: 'marauder-knife', name: 'Marauder Knife', species: 'nightblade', level: 25, category: 'normal', roles: ['assassin'], abilities: ['charge'], disposition: 'hostile', faction: 'bandits', kit: 'leather' }),
  T({ key: 'marauder-warlord', name: 'Marauder Warlord', species: 'knight', level: 28, category: 'strong', roles: ['commander', 'berserker'], abilities: ['warCry', 'rally', 'rage'], disposition: 'hostile', faction: 'bandits', kit: 'silver' }),
  T({ key: 'reaver', name: 'Reaver', species: 'warrior', level: 31, category: 'normal', roles: ['tank'], abilities: ['shieldWall'], disposition: 'hostile', faction: 'bandits', kit: 'elven' }),
  T({ key: 'reaver-sniper', name: 'Reaver Sniper', species: 'ranger', level: 32, category: 'normal', roles: ['archer'], abilities: ['retreat'], disposition: 'hostile', faction: 'bandits', kit: 'elven' }),
  T({ key: 'reaver-cutthroat', name: 'Reaver Cutthroat', species: 'assassin', level: 33, category: 'normal', roles: ['assassin'], abilities: ['leap'], disposition: 'hostile', faction: 'bandits', kit: 'leather' }),
  T({ key: 'reaver-chief', name: 'Reaver Chief', species: 'knight', level: 36, category: 'strong', roles: ['commander', 'fighter'], abilities: ['warCry', 'rally', 'callHelp'], disposition: 'hostile', faction: 'bandits', kit: 'dwarven' }),
  T({ key: 'dread-raider', name: 'Dread Raider', species: 'knight', level: 39, category: 'normal', roles: ['fighter'], abilities: ['cleave'], disposition: 'hostile', faction: 'bandits', kit: 'mithril' }),
  T({ key: 'dread-archer', name: 'Dread Archer', species: 'archer', level: 40, category: 'normal', roles: ['archer'], abilities: ['retreat'], disposition: 'hostile', faction: 'bandits', kit: 'mithril' }),
  T({ key: 'dread-blade', name: 'Dread Blade', species: 'nightblade', level: 41, category: 'normal', roles: ['assassin'], abilities: ['leap', 'interrupt'], disposition: 'hostile', faction: 'bandits', kit: 'adamantium' }),
  T({ key: 'raider-king', name: 'Raider King', species: 'knight', level: 44, category: 'elite', roles: ['commander', 'berserker'], abilities: ['warCry', 'rally', 'rage', 'callHelp'], disposition: 'hostile', faction: 'bandits', kit: 'adamantium' }),
  // beasts, by the climates their bodies suit (pveBestiary.js)
  T({ key: 'cave-bat', name: 'Cave Bat', species: 'giant-bat', level: 2, category: 'normal', roles: ['assassin'], noncombat: ['wildlife'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'wood-spider', name: 'Wood Spider', species: 'spider', level: 5, category: 'normal', roles: ['assassin'], noncombat: ['wildlife'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'broodmother-spider', name: 'Broodmother Spider', species: 'spider', level: 21, category: 'strong', roles: ['berserker'], noncombat: ['wildlife'], abilities: ['rage'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'mountain-grizzly', name: 'Mountain Grizzly', species: 'grizzly-bear', level: 16, category: 'normal', roles: ['berserker'], noncombat: ['wildlife'], abilities: ['rage'], disposition: 'territorial', wildlife: 'territorial' }),
  T({ key: 'old-sabretooth', name: 'Old Sabretooth', species: 'sabretooth-tiger', level: 24, category: 'strong', roles: ['assassin'], noncombat: ['wildlife'], abilities: ['leap'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'dune-scorpion', name: 'Dune Scorpion', species: 'giant-scorpion', level: 13, category: 'normal', roles: ['fighter'], noncombat: ['wildlife'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'scorpion-matriarch', name: 'Scorpion Matriarch', species: 'giant-scorpion', level: 30, category: 'strong', roles: ['berserker'], noncombat: ['wildlife'], abilities: ['rage'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'crag-harpy', name: 'Crag Harpy', species: 'harpy', level: 11, category: 'normal', roles: ['assassin'], abilities: ['leap'], disposition: 'hostile' }),
  T({ key: 'harpy-matron', name: 'Harpy Matron', species: 'harpy', level: 27, category: 'strong', roles: ['assassin'], abilities: ['leap', 'callHelp'], disposition: 'hostile' }),
  T({ key: 'plains-centaur', name: 'Plains Centaur', species: 'centaur', level: 14, category: 'normal', roles: ['fighter'], abilities: ['charge'], disposition: 'territorial' }),
  T({ key: 'centaur-warden', name: 'Centaur Warden', species: 'centaur', level: 29, category: 'strong', roles: ['tank'], abilities: ['charge', 'shieldWall'], disposition: 'territorial' }),
  T({ key: 'elder-spriggan', name: 'Elder Spriggan', species: 'spriggan', level: 25, category: 'strong', roles: ['tank'], abilities: ['mendSelf'], disposition: 'territorial' }),
  T({ key: 'hill-giant', name: 'Hill Giant', species: 'giant', level: 32, category: 'strong', roles: ['berserker'], abilities: ['cleave'], disposition: 'territorial' }),
  T({ key: 'giant-chieftain', name: 'Giant Chieftain', species: 'giant', level: 43, category: 'elite', roles: ['berserker'], abilities: ['cleave', 'rage'], disposition: 'territorial' }),
  T({ key: 'grove-nymph', name: 'Grove Nymph', species: 'nymph', level: 12, category: 'normal', roles: ['assassin'], disposition: 'wary' }),
  T({ key: 'marsh-lamia', name: 'Marsh Lamia', species: 'lamia', level: 22, category: 'normal', roles: ['assassin'], disposition: 'hostile' }),
  T({ key: 'deep-dreugh', name: 'Deep Dreugh', species: 'dreugh', level: 20, category: 'normal', roles: ['fighter'], disposition: 'hostile' }),
  T({ key: 'reef-slaughterfish', name: 'Reef Slaughterfish', species: 'slaughterfish', level: 7, category: 'normal', roles: ['assassin'], noncombat: ['wildlife'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'night-werewolf', name: 'Werewolf', species: 'werewolf', level: 18, category: 'normal', roles: ['berserker'], abilities: ['leap', 'rage'], disposition: 'hostile' }),
  T({ key: 'night-wereboar', name: 'Wereboar', species: 'wereboar', level: 16, category: 'normal', roles: ['berserker'], abilities: ['charge', 'rage'], disposition: 'hostile' }),
  T({ key: 'den-dragonling', name: 'Dragonling', species: 'dragonling', level: 28, category: 'strong', roles: ['berserker'], abilities: ['leap'], disposition: 'hostile' }),
  // REGIONAL-PVE (2026-10-31): Daggerfall Enemy Expansion's creatures, which Latty's zone rosters set past the Bay
  T({ key: 'mudcrab', name: 'Mudcrab', species: 'mudcrab', level: 2, category: 'normal', roles: ['tank'], noncombat: ['wildlife'], disposition: 'territorial', wildlife: 'territorial' }),
  T({ key: 'old-mudcrab', name: 'Old Mudcrab', species: 'mudcrab', level: 14, category: 'strong', roles: ['tank'], noncombat: ['wildlife'], abilities: ['stoneskin'], disposition: 'territorial', wildlife: 'territorial' }),
  T({ key: 'feral-dog', name: 'Feral Dog', species: 'dog', level: 3, category: 'normal', roles: ['fighter'], noncombat: ['wildlife'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'goblin-skirmisher', name: 'Goblin Skirmisher', species: 'goblin', level: 4, category: 'normal', roles: ['fighter'], abilities: ['charge'], disposition: 'hostile' }),
  T({ key: 'goblin-warchief', name: 'Goblin Warchief', species: 'goblin', level: 18, category: 'strong', roles: ['commander', 'fighter'], abilities: ['warCry', 'rally'], disposition: 'hostile' }),
  T({ key: 'timber-wolf', name: 'Wolf', species: 'wolf', level: 5, category: 'normal', roles: ['assassin'], noncombat: ['wildlife'], abilities: ['leap'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'dire-wolf', name: 'Dire Wolf', species: 'wolf', level: 20, category: 'strong', roles: ['berserker'], noncombat: ['wildlife'], abilities: ['leap', 'rage'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'wild-boar', name: 'Boar', species: 'boar', level: 7, category: 'normal', roles: ['berserker'], noncombat: ['wildlife'], abilities: ['charge'], disposition: 'territorial', wildlife: 'territorial' }),
  T({ key: 'old-tusker', name: 'Old Tusker', species: 'boar', level: 19, category: 'strong', roles: ['berserker'], noncombat: ['wildlife'], abilities: ['charge', 'rage'], disposition: 'territorial', wildlife: 'territorial' }),
  T({ key: 'skeletal-soldier', name: 'Skeletal Soldier', species: 'skeletal-soldier', level: 8, category: 'normal', roles: ['fighter'], disposition: 'hostile' }),
  T({ key: 'scamp', name: 'Scamp', species: 'scamp', level: 9, category: 'normal', roles: ['assassin'], disposition: 'hostile' }),
  T({ key: 'lizard-man', name: 'Lizard Man', species: 'lizard-man', level: 10, category: 'normal', roles: ['fighter'], disposition: 'hostile' }),
  T({ key: 'lizard-warrior', name: 'Lizard Warrior', species: 'lizard-warrior', level: 18, category: 'normal', roles: ['berserker'], abilities: ['charge'], disposition: 'hostile' }),
  T({ key: 'lizard-warchief', name: 'Lizard Warchief', species: 'lizard-warrior', level: 31, category: 'strong', roles: ['commander', 'berserker'], abilities: ['warCry', 'rally', 'rage'], disposition: 'hostile' }),
  T({ key: 'mountain-lion', name: 'Mountain Lion', species: 'mountain-lion', level: 12, category: 'normal', roles: ['assassin'], noncombat: ['wildlife'], abilities: ['leap'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'lion-matriarch', name: 'Mountain Lion Matriarch', species: 'mountain-lion', level: 26, category: 'strong', roles: ['assassin'], noncombat: ['wildlife'], abilities: ['leap', 'rage'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'ghoul', name: 'Ghoul', species: 'ghoul', level: 12, category: 'normal', roles: ['berserker'], abilities: ['rage'], disposition: 'hostile' }),
  T({ key: 'blood-spider', name: 'Blood Spider', species: 'blood-spider', level: 13, category: 'normal', roles: ['assassin'], noncombat: ['wildlife'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'faded-ghost', name: 'Faded Ghost', species: 'faded-ghost', level: 14, category: 'normal', roles: ['assassin'], abilities: ['interrupt'], disposition: 'hostile' }),
  T({ key: 'snow-wolf', name: 'Snow Wolf', species: 'snow-wolf', level: 15, category: 'normal', roles: ['assassin'], noncombat: ['wildlife'], abilities: ['leap'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'frost-fang-alpha', name: 'Frost-Fang Alpha', species: 'snow-wolf', level: 30, category: 'strong', roles: ['commander', 'berserker'], noncombat: ['wildlife'], abilities: ['leap', 'rage', 'callHelp'], disposition: 'hostile', wildlife: 'predatory' }),
  T({ key: 'land-dreugh', name: 'Land Dreugh', species: 'land-dreugh', level: 18, category: 'normal', roles: ['tank'], abilities: ['stoneskin'], disposition: 'hostile' }),
  T({ key: 'dreugh-warlord', name: 'Dreugh Warlord', species: 'land-dreugh', level: 33, category: 'strong', roles: ['tank'], abilities: ['stoneskin', 'shieldWall'], disposition: 'hostile' }),
  T({ key: 'wisp', name: 'Will-o\'-wisp', species: 'will-o-wisp', level: 20, category: 'normal', roles: ['assassin'], abilities: ['interrupt'], disposition: 'hostile' }),
  T({ key: 'troll', name: 'Troll', species: 'troll', level: 24, category: 'normal', roles: ['berserker'], abilities: ['rage', 'mendSelf'], disposition: 'hostile' }),
  T({ key: 'troll-elder', name: 'Troll Elder', species: 'troll', level: 37, category: 'strong', roles: ['berserker'], abilities: ['rage', 'mendSelf', 'cleave'], disposition: 'hostile' }),
  T({ key: 'centurion-sphere', name: 'Centurion Sphere', species: 'centurion-sphere', level: 26, category: 'normal', roles: ['fighter'], abilities: ['stoneskin'], disposition: 'hostile' }),
  T({ key: 'steam-centurion', name: 'Steam Centurion', species: 'steam-centurion', level: 35, category: 'strong', roles: ['tank'], abilities: ['stoneskin', 'shieldWall'], disposition: 'hostile' }),
  T({ key: 'ogre', name: 'Ogre', species: 'ogre', level: 28, category: 'normal', roles: ['berserker'], abilities: ['cleave'], disposition: 'hostile' }),
  T({ key: 'ogre-brute', name: 'Ogre Brute', species: 'ogre', level: 39, category: 'strong', roles: ['berserker'], abilities: ['cleave', 'rage'], disposition: 'hostile' }),
  T({ key: 'minotaur', name: 'Minotaur', species: 'minotaur', level: 30, category: 'normal', roles: ['berserker'], abilities: ['charge', 'cleave'], disposition: 'hostile' }),
  T({ key: 'minotaur-lord', name: 'Minotaur Lord', species: 'minotaur', level: 43, category: 'elite', roles: ['commander', 'berserker'], abilities: ['charge', 'cleave', 'rage', 'warCry'], disposition: 'hostile' }),
  // the dead and the conjured, in their dungeons
  T({ key: 'crypt-rat', name: 'Crypt Rat', species: 'rat', level: 2, category: 'normal', roles: ['fighter'], disposition: 'hostile' }),
  T({ key: 'tomb-zombie', name: 'Tomb Zombie', species: 'zombie', level: 7, category: 'normal', roles: ['tank'], disposition: 'hostile' }),
  T({ key: 'barrow-ghost', name: 'Barrow Ghost', species: 'ghost', level: 14, category: 'normal', roles: ['mage'], abilities: ['interrupt'], disposition: 'hostile' }),
  T({ key: 'tomb-mummy', name: 'Tomb Mummy', species: 'mummy', level: 22, category: 'normal', roles: ['tank'], abilities: ['stoneskin'], disposition: 'hostile' }),
  T({ key: 'haunt-vampire', name: 'Vampire', species: 'vampire', level: 30, category: 'strong', roles: ['assassin'], abilities: ['leap', 'mendSelf'], disposition: 'hostile' }),
  T({ key: 'elder-vampire', name: 'Elder Vampire', species: 'ancient-vampire', level: 41, category: 'elite', roles: ['assassin'], abilities: ['leap', 'mendSelf', 'warded'], disposition: 'hostile' }),
  T({ key: 'lab-imp', name: 'Imp', species: 'imp', level: 4, category: 'normal', roles: ['mage'], disposition: 'hostile' }),
  T({ key: 'ruin-gargoyle', name: 'Gargoyle', species: 'gargoyle', level: 26, category: 'normal', roles: ['tank'], abilities: ['stoneskin'], disposition: 'hostile' }),
  T({ key: 'flame-atronach', name: 'Flame Atronach', species: 'fire-atronach', level: 24, category: 'normal', roles: ['berserker'], disposition: 'hostile' }),
  T({ key: 'frost-atronach', name: 'Frost Atronach', species: 'ice-atronach', level: 26, category: 'normal', roles: ['tank'], disposition: 'hostile' }),
  T({ key: 'bone-atronach', name: 'Flesh Atronach', species: 'flesh-atronach', level: 27, category: 'normal', roles: ['fighter'], disposition: 'hostile' }),
  T({ key: 'forge-atronach', name: 'Iron Atronach', species: 'iron-atronach', level: 34, category: 'strong', roles: ['tank'], abilities: ['shieldWall'], disposition: 'hostile' }),
  T({ key: 'necromancer', name: 'Necromancer', species: 'mage', level: 14, category: 'normal', roles: ['mage'], disposition: 'hostile' }),
  T({ key: 'conjurer', name: 'Conjurer', species: 'sorcerer', level: 22, category: 'normal', roles: ['fighter'], disposition: 'hostile', kit: 'steel' }),
  T({ key: 'war-spellsword', name: 'Spellsword', species: 'spellsword', level: 27, category: 'normal', roles: ['fighter'], abilities: ['charge'], disposition: 'hostile', kit: 'elven' }),
  T({ key: 'battlemage-adept', name: 'Battlemage', species: 'battlemage', level: 33, category: 'normal', roles: ['mage'], abilities: ['interrupt'], disposition: 'hostile' }),
  // an incursion's Daedra (pveBestiary.js: they need one)
  T({ key: 'frost-daedra', name: 'Frost Daedra', species: 'frost-daedra', level: 32, category: 'normal', roles: ['fighter'], abilities: ['daedraSpells'], disposition: 'hostile' }),
  T({ key: 'fire-daedra', name: 'Fire Daedra', species: 'fire-daedra', level: 33, category: 'normal', roles: ['mage'], abilities: ['daedraSpells'], disposition: 'hostile' }),
  T({ key: 'daedroth', name: 'Daedroth', species: 'daedroth', level: 35, category: 'strong', roles: ['berserker'], abilities: ['daedraSpells', 'rage'], disposition: 'hostile' }),
  T({ key: 'daedra-seducer', name: 'Daedra Seducer', species: 'daedra-seducer', level: 37, category: 'normal', roles: ['mage'], abilities: ['daedraSpells'], disposition: 'hostile' }),
  T({ key: 'daedra-lord', name: 'Daedra Lord', species: 'daedra-lord', level: 44, category: 'elite', roles: ['commander', 'mage'], abilities: ['daedraSpells', 'warded', 'callHelp'], disposition: 'hostile' }),
  // RAID-AREAS: one raid boss to each area, the Bay's in Wrothgar. A raid boss is warded or wrathful, never both: the two
  // together beat a party of ten nine times in ten (tools/pveBalance.mjs)
  T({ key: 'orc-warchief', name: 'Warchief of the Iron Clan', species: 'orc-warlord', level: 45, category: 'raidBoss', roles: ['commander', 'berserker'], abilities: ['warCry', 'rally', 'callHelp', 'rage', 'curbing', 'wrathful'], disposition: 'hostile', faction: 'orc-clans', kit: 'orcish', area: 'IliacBay' }),
  T({ key: 'night-court-ancient', name: 'Ancient of the Night Court', species: 'ancient-vampire', level: 45, category: 'raidBoss', roles: ['assassin', 'mage'], abilities: ['leap', 'summonKin', 'warded', 'curbing', 'venomproof', 'frostproof'], disposition: 'hostile', area: 'HighRock' }),
  T({ key: 'scorpion-queen', name: 'Scorpion Queen of the Sands', species: 'giant-scorpion', level: 45, category: 'raidBoss', roles: ['berserker'], abilities: ['charge', 'cleave', 'rage', 'summonKin', 'venomproof', 'wrathful'], disposition: 'hostile', area: 'Hammerfell' }),
  T({ key: 'frost-giant-king', name: 'Frost Giant King', species: 'giant', level: 45, category: 'raidBoss', roles: ['commander', 'berserker'], abilities: ['warCry', 'cleave', 'rage', 'callHelp', 'frostproof', 'wrathful'], disposition: 'hostile', area: 'Skyrim' }),
  T({ key: 'ash-tomb-lich', name: 'Lich of the Ash Tombs', species: 'ancient-lich', level: 45, category: 'raidBoss', roles: ['mage', 'summoner'], abilities: ['lichSpells', 'summonKin', 'curbing', 'flameproof', 'wrathful'], disposition: 'hostile', area: 'Morrowind' }),
  T({ key: 'crystal-archmage', name: 'Archmage of the Crystal Spire', species: 'mage', level: 45, category: 'raidBoss', roles: ['mage', 'summoner'], abilities: ['summonKin', 'curbing', 'stormproof', 'spellproof', 'wrathful'], disposition: 'hostile', kit: 'elven', area: 'Sumurset' }),
  T({ key: 'heartwood-spriggan', name: 'Heartwood Spriggan', species: 'spriggan', level: 45, category: 'raidBoss', roles: ['berserker'], abilities: ['summonKin', 'stoneskin', 'venomproof', 'curbing', 'wrathful'], disposition: 'hostile', area: 'Valenwood' }),
  T({ key: 'moon-mad-sabrecat', name: 'Moon-Mad Sabrecat', species: 'sabretooth-tiger', level: 45, category: 'raidBoss', roles: ['berserker'], abilities: ['leap', 'charge', 'cleave', 'rage', 'curbing', 'wrathful'], disposition: 'hostile', area: 'Elsweyr' }),
  T({ key: 'marsh-wyrm', name: 'Wyrm of the Black Marsh', species: 'dragonling', level: 45, category: 'raidBoss', roles: ['berserker'], abilities: ['charge', 'cleave', 'rage', 'venomproof', 'wrathful'], disposition: 'hostile', area: 'BlackMarsh' }),
  T({ key: 'oblivion-herald', name: 'Herald of Oblivion', species: 'daedra-lord', level: 45, category: 'raidBoss', roles: ['commander', 'mage'], abilities: ['daedraSpells', 'summonKin', 'callHelp', 'curbing', 'wrathful'], disposition: 'hostile', area: 'Imperial' }),
]);

/** @typedef {{ key: string, name: string, members: Array<[string, number]>, leader?: string, community?: boolean }} GroupTemplate */

/** @type {ReadonlyArray<GroupTemplate>} */
export const GROUP_TEMPLATES = Object.freeze(/** @type {GroupTemplate[]} */ ([
  Object.freeze({ key: 'orc-warband', name: 'Orc Warband', members: [['orc-grunt', 2], ['orc-defender', 1], ['orc-shaman', 1]] }),
  Object.freeze({ key: 'orc-war-party', name: 'Orc War Party', members: [['orc-grunt', 2], ['orc-defender', 1], ['orc-shaman', 1], ['orc-warlord', 1]], leader: 'orc-warlord' }),
  Object.freeze({ key: 'bandit-camp', name: 'Bandit Camp', members: [['bandit-cutthroat', 2], ['bandit-archer', 2], ['bandit-hedge-healer', 1], ['bandit-chief', 1]], leader: 'bandit-chief' }),
  Object.freeze({ key: 'crypt-patrol', name: 'Crypt Patrol', members: [['crypt-skeleton', 3], ['crypt-guardian', 1]] }),
  // ROSTER (2026-10-30): an outlaw band for each band of levels from 12 up - a road's patrol and a camp alike
  Object.freeze({ key: 'highway-band', name: 'Highway Band', members: [['highwayman', 2], ['highway-archer', 1], ['highway-mender', 1], ['highway-captain', 1]], leader: 'highway-captain' }),
  Object.freeze({ key: 'marauder-band', name: 'Marauder Band', members: [['marauder', 2], ['marauder-bowman', 1], ['marauder-knife', 1], ['marauder-warlord', 1]], leader: 'marauder-warlord' }),
  Object.freeze({ key: 'reaver-band', name: 'Reaver Band', members: [['reaver', 2], ['reaver-sniper', 1], ['reaver-cutthroat', 1], ['reaver-chief', 1]], leader: 'reaver-chief' }),
  Object.freeze({ key: 'dread-band', name: 'Dread Band', members: [['dread-raider', 2], ['dread-archer', 1], ['dread-blade', 1], ['raider-king', 1]], leader: 'raider-king' }),
  Object.freeze({ key: 'footpad-gang', name: 'Footpad Gang', members: [['bandit-footpad', 2], ['bandit-poacher', 1], ['bandit-thug', 1]] }),
  // STAGE 4: a peaceful community - its people meet a player by the clan's standing (pveStanding.js)
  Object.freeze({ key: 'orc-stronghold', name: 'Orc Stronghold', members: [['orc-merchant', 1], ['orc-stronghold-guard', 2], ['orc-hunter', 1], ['orc-shaman', 1]], leader: 'orc-stronghold-guard', community: true }),
]));

export const TEMPLATE_BY_KEY = new Map(MOB_TEMPLATES.map((t) => [t.key, t]));

/** RAID-AREAS (the owner, 2026-10-31: "need a raid boss for each region"): the Bay and the nine provinces, one boss each. */
export const RAID_AREAS = Object.freeze(['IliacBay', ...PROVINCES.map((p) => p.key)]);
/** The raid boss of `area`, or null. @param {string} area */
export const raidBossOf = (area) => MOB_TEMPLATES.find((t) => t.category === 'raidBoss' && t.area === area) ?? null;

/** Every reason `t` cannot stand (empty when it can). @param {MobTemplate} t */
export function templateProblems(t) {
  const out = [];
  const sp = SPECIES_BY_KEY.get(t?.species);
  if (!t?.key || !t?.name) out.push('no key or name');
  if (!sp) out.push(`unknown species ${t?.species}`);
  if (!Number.isInteger(t?.level) || t.level < LEVEL_MIN || t.level > LEVEL_MAX) out.push(`level ${t?.level} outside ${LEVEL_MIN}-${LEVEL_MAX}`);
  if (!PVE_CATEGORIES[t?.category]) out.push(`unknown category ${t?.category}`);
  const rp = roleProblem(t?.roles); if (rp) out.push(rp);
  for (const r of t?.roles ?? []) {
    const need = COMBAT_ROLES[r]?.needs;
    if (need && sp && !sp[need]) out.push(`${r} needs a body that ${need}; ${sp.name} does not`);
  }
  for (const n of t?.noncombat ?? []) if (!NONCOMBAT_ROLES.includes(n)) out.push(`unknown noncombat role ${n}`);
  for (const a of t?.abilities ?? []) { const p = abilityProblem(a); if (p) out.push(p); }
  if (!DISPOSITIONS.includes(t?.disposition)) out.push(`unknown disposition ${t?.disposition}`);
  if (t?.wildlife != null && !WILDLIFE[t.wildlife]) out.push(`unknown wildlife way ${t.wildlife}`);
  for (const i of t?.interact ?? []) if (!INTERACTIONS.includes(i)) out.push(`unknown interaction ${i}`);
  if ((t?.interact ?? []).length && t.disposition === 'hostile') out.push('a hostile creature offers no service');
  if (t?.kit != null && !KIT_METALS.includes(t.kit)) out.push(`unknown kit metal ${t.kit}`);
  if ((t?.category === 'raidBoss') !== RAID_AREAS.includes(t?.area ?? '')) out.push(`a raid boss and only one holds an area (${t?.area})`);
  return out;
}

/** Every reason `g` cannot stand. @param {GroupTemplate} g @param {Map<string, MobTemplate>} [byKey] */
export function groupProblems(g, byKey = TEMPLATE_BY_KEY) {
  const out = [];
  if (!g?.members?.length) out.push('no members');
  for (const [k, n] of g?.members ?? []) {
    if (!byKey.has(k)) out.push(`unknown member ${k}`);
    if (!(Number.isInteger(n) && n > 0)) out.push(`${k} count ${n}`);
  }
  if (g?.leader != null && !(g.members ?? []).some(([k]) => k === g.leader)) out.push(`leader ${g.leader} is not a member`);
  if (g?.community) for (const [k] of g.members ?? []) if (byKey.get(k)?.disposition === 'hostile') out.push(`a community's ${k} starts hostile`);
  return out;
}

/**
 * A template's own numbers: health and a blow's [min, max] from its level, category and roles - nothing else is read. Pure.
 * @param {MobTemplate} t
 */
export function templateStats(t, level = t.level) {
  const base = categoryStats(level, t.category);
  const s = roleShares(t.roles), h = s.health * (t.pack?.health ?? 1), d = s.damage * (t.pack?.damage ?? 1);   // GROUP-SOLO: a pack member's share
  return { level: base.level, category: base.category, health: Math.max(1, Math.round(base.health * h)),
    damage: /** @type {[number, number]} */ ([Math.max(1, Math.round(base.damage[0] * d)), Math.max(1, Math.round(base.damage[1] * d))]) };
}

/** How many reference players of the group's level a group weighs: each member's health times blow over a Normal foe's,
 *  the square root of it, summed - so N Normal foes weigh N. */
export function groupWeight(g, byKey = TEMPLATE_BY_KEY) {
  let w = 0;
  for (const [k, n] of g.members) {
    const t = byKey.get(k); if (!t) continue;
    const c = PVE_CATEGORIES[t.category], s = roleShares(t.roles);
    w += n * Math.sqrt(c.health * s.health * c.damage * s.damage);
  }
  return w;
}
