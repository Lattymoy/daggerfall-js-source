// DEX7 (2026-10-20, bible/04-Characters/Enemy-Expansion.md section 10; Mac, 2026-10-19: "We also need to ensure these
// get proper morrowind model replacements if applicable") - DAGGERFALL ENEMY EXPANSION'S FIFTY, MATCHED TO MORROWIND'S.
// The mod has no Morrowind half - DFU draws its sprites - so this is the port's own, by the law the classic table keeps
// (characters/creatureBodies.js CREATURE_MATCH, bible/04-Characters/Morrowind-NPCs.md section 14b):
//   - A MONSTER (256-290) is matched to the Morrowind creature that IS it and moves as it does - its CREA ids in order,
//     the first the attached masters carry building its body - or is a DECLARED MISS with its reason, and its sprite
//     stands. The ids are the records' own, read off the Elder Scrolls wiki's creature pages (2026-10-20), never
//     recalled: Morrowind.esm's, Tribunal's (goblin_grunt) and Bloodmoon's (the BM_ ids). Where a classic monster is the
//     same creature, the row is the classic row's (the Skeletal Soldier the Skeletal Warrior's, a golem the classic
//     atronach's, a ghoul the zombie's bonewalker, the wraith and the ghost the veiled ancestor ghost).
//   - A LIZARD MAN is a person - Morrowind's lizard folk are the Argonians - drawn as an orc is (MWNPC12): its own equip
//     table worn (DFU arms none), the Bay's clothes under it.
//   - A CLASS (384-398) is a person by the class law (foeBodies.js isPersonFoe) - but a RIDER keeps its sprite: its horse
//     is its sprite's, and no person's body rides.
// Registered whatever the switch, as the fifty's rows and pictures are (dexInstall.js, ALWAYS): a body is how a row is
// drawn, and the row is there either way.
import { registerCreatureMatches, _resetCreatureMatches } from '../../characters/creatureBodies.js';
import { registerPersonFoes, _resetPersonFoes } from '../../characters/foeBodies.js';

const NO_RIDE = 'a rider - its horse is its sprite\'s, and no person\'s body rides';

/** Every monster of the mod's, by its id (MonsterBase.mdb.csv): a match or a declared miss - the table is the census.
 *  @type {Readonly<Record<number, { creature?: string[], miss?: string, veil?: boolean }>>} */
export const DEX_CREATURE_MATCH = Object.freeze({
  256: { creature: ['goblin_grunt'] },                       // Goblin: Tribunal's goblin
  257: { miss: 'a flyer - no homunculus flies Morrowind' },  // Homunculus (Flying)
  258: { miss: 'a lizard man is a person - Morrowind\'s Argonian (DEX_PERSON_FOES), never a creature' },   // Lizard Man
  259: { miss: 'a lizard man is a person' },                 // Lizard Warrior
  260: { miss: 'no bat walks Morrowind' },                   // Bat (Flying) - the classic giant bat's
  261: { miss: 'no medusa' },                                // Medusa
  262: { creature: ['bm_wolf_grey'] },                       // Wolf: Bloodmoon's
  263: { creature: ['bm_wolf_snow_unique', 'bm_wolf_grey'] },   // Snow Wolf: Bloodmoon's white wolf, else its grey
  264: { miss: 'no hell hound' },                            // Hell Hound
  265: { miss: 'no grotesque' },                             // Grotesque - the classic gargoyle's
  266: { creature: ['skeleton warrior', 'skeleton'] },       // Skeletal Soldier: the classic Skeletal Warrior's row
  267: { miss: 'no dog' },                                   // Dog
  268: { miss: 'no nymph' },                                 // Nymph - the classic nymph's
  269: { miss: 'no minotaur' },                              // Minotaur
  270: { creature: ['atronach_storm'] },                     // Iron Golem: the classic Iron Atronach's stone atronach
  271: { miss: 'no giant spider (the centurion spider is a Dwemer machine)' },   // Blood Spider - the classic spider's
  272: { creature: ['bm_ice_troll'] },                       // Troll: Bloodmoon's grahl, Morrowind's only troll
  273: { creature: ['ancestor_ghost'], veil: true },         // Gloom Wraith (Spectral): the classic wraith's
  274: { creature: ['ancestor_ghost'], veil: true },         // Faded Ghost (Spectral): the classic ghost's
  275: { miss: 'a named spectral keeps his own sprite (MWNPC13) - the body is the stock ghost\'s, and he is no stock ghost' },   // Vengeful King Lysandus
  276: { miss: 'no fire daemon' },                           // Fire Daemon
  277: { creature: ['bonewalker'] },                         // Ghoul: the classic zombie's walking dead
  278: { creature: ['bm_frost_boar'] },                      // Boar: Bloodmoon's tusked bristleback
  279: { miss: 'Morrowind\'s dreugh swims, and this one walks' },   // Land Dreugh
  280: { miss: 'no great cat' },                             // Mountain Lion - the classic sabretooth's
  281: { creature: ['mudcrab'] },                            // Mudcrab
  282: { creature: ['ogrim'] },                              // Ogre: Morrowind's ogrim
  283: { miss: 'no will-o\'-wisp' },                         // Will-o'-wisp (Spectral)
  284: { creature: ['atronach_frost'] },                     // Ice Golem: the classic Ice Atronach's
  285: { creature: ['dremora'] },                            // Dremora Churl
  286: { creature: ['atronach_storm'] },                     // Stone Golem: Morrowind's stone atronach
  287: { creature: ['bonewalker_greater', 'bonewalker'] },   // Dire Ghoul: the greater bonewalker, else the lesser
  288: { creature: ['scamp'] },                              // Scamp
  289: { creature: ['centurion_sphere'] },                   // Centurion Sphere
  290: { creature: ['centurion_steam'] },                    // Steam Centurion
});

/** The mod's mobiles the person law reads otherwise than by default (foeBodies.js registerPersonFoes): the lizard men
 *  people, the riders their sprites.
 *  @type {Readonly<Record<number, { race?: string, sprite?: string }>>} */
export const DEX_PERSON_FOES = Object.freeze({
  258: { race: 'Argonian' },   // Lizard Man
  259: { race: 'Argonian' },   // Lizard Warrior
  386: { sprite: NO_RIDE },    // Knight Rider
  387: { sprite: NO_RIDE },    // Rogue Rider
  392: { sprite: NO_RIDE },    // Thief Rider
  397: { sprite: NO_RIDE },    // Spellsword Rider
  398: { sprite: NO_RIDE },    // Archer Rider
});

const rowsOf = (table) => Object.entries(table).map(([t, row]) => /** @type {[number, any]} */ ([Number(t), row]));

let _installed = false;
/** Once a page, at the install: both tables on their doors. Answers whether this call put them there. */
export function installDexBodies() {
  if (_installed) return false;
  _installed = true;
  registerCreatureMatches(rowsOf(DEX_CREATURE_MATCH));
  registerPersonFoes(rowsOf(DEX_PERSON_FOES));
  return true;
}
/** The test seam: both doors let go, and the next install registers again. */
export function _resetDexBodies() { _resetCreatureMatches(); _resetPersonFoes(); _installed = false; }
