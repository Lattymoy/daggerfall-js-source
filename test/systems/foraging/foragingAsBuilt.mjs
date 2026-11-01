// FORAGE-FIX's four quest mends, as the pins read them. Our quests (src/systems/foraging/quests/)
// carry the mends; Foraging 1.7's build did not. This table turns a mended line back into the build's, each the number of
// times it occurs (quest/questPatches.js applyTextPatches' exact-count law), so a pin can show the fault a mend cures.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTextPatches } from '../../../src/systems/quest/questPatches.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const FORAGING_QUESTS = join(ROOT, 'src/systems/foraging/quests');
/** Our quest (or the list) as the game reads it. */
export const ownQuest = (name) => readFileSync(join(FORAGING_QUESTS, `${name}.txt`), 'utf8');

const RICH_WHEN = 'when _desert_ or _desert2_ or _mountain_ or _mountainwoods_ or _atmine_';
const mining = () => Object.freeze([
  // The build had no `_rich_` task, and each yield task read the climates with `and` before `or`
  { old: `_mountainwoods_ task:\n\tclimate mountainwoods\n\n_rich_ task:\n\t${RICH_WHEN}\n`, new: '_mountainwoods_ task:\n\tclimate mountainwoods\n', count: 1 },
  { old: '\twhen _elements_ and _rich_\n', new: `\twhen _elements_ and ${RICH_WHEN.slice(5)}\n`, count: 1 },
  { old: '\twhen _gems_ and _rich_\n', new: `\twhen _gems_ and ${RICH_WHEN.slice(5)}\n`, count: 1 },
  { old: '\twhen _elements_ and not _rich_\n', new: `\twhen _elements_ and not ${RICH_WHEN.slice(5)}\n`, count: 1 },
  { old: '\twhen _gems_ and not _rich_\n', new: `\twhen _gems_ and not ${RICH_WHEN.slice(5)}\n`, count: 1 },
].map(Object.freeze));
// The build asked for class 20, where a Wood Bundle is group 9 (UselessItems2)
const fetch = (n) => Object.freeze([
  { old: `\tplayer possesses ${n} items class 9 subclass 1604`, new: `\tplayer possesses ${n} items class 20 subclass 1604`, count: 1 },
  { old: `\tplayer handsover ${n} items class 9 subclass 1604`, new: `\tplayer handsover ${n} items class 20 subclass 1604`, count: 1 },
].map(Object.freeze));
export const AS_BUILT = Object.freeze({
  // The build filed the errands under `Commoner` and `Noble`, which name no social group
  'QuestList-ForagingQuests': Object.freeze([
    { old: ', Commoners, ', new: ', Commoner, ', count: 2 },
    { old: ', Nobility, ', new: ', Noble, ', count: 2 },
  ].map(Object.freeze)),
  MiningQuest: mining(), MiningQuestWeak: mining(), MiningQuestWeaker: mining(), MiningQuestWeakest: mining(),
  FetchWood01: fetch(2), FetchWood02: fetch(4), FetchWood03: fetch(6), FetchWood04: fetch(8),
  // The build made the fourth plant permanent where the fifth and sixth were got
  ForageSummerPlantsQuest: Object.freeze([
    { old: '\tget item _plant5_\n\tmake _plant5_ permanent\n', new: '\tget item _plant5_\n\tmake _plant4_ permanent\n', count: 2 },
    { old: '\tget item _plant6_\n\tmake _plant6_ permanent\n', new: '\tget item _plant6_\n\tmake _plant4_ permanent\n', count: 1 },
  ].map(Object.freeze)),
});
/** Our text with its mends taken out again: the build's logic. Throws where a mend is not found as often as it should be. */
export const asBuilt = (name, text = ownQuest(name)) => (AS_BUILT[name] ? applyTextPatches('AS-BUILT', name, AS_BUILT[name], text) : text);
