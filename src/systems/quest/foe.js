// THE QUEST FOE (Q1) - Foe.cs, declaration half. "Foe _sym_ is
// [COUNT] aFoeName": the name resolves to a MobileTypes id through
// the Quests-Foes table (unknown names throw, as DFU), and the count
// clamps 1..maxSpawnCount(8) - ParseInt of a missing count is 0 and
// the clamp is what makes it 1. The spawn/injury/kill tracking and
// SetFoeName ship with the machine slices.

import { QuestResource, matchFirst } from './questResource.js';
import { Symbol as QuestSymbol } from './symbol.js';
import { parseInt as questParseInt } from './parser.js';
import { foesTable } from './tables.js';

const MAX_SPAWN_COUNT = 8;

const DECL = [
  /(Foe|foe) (?<symbol>[a-zA-Z0-9_.-]+) is (?<count>\d+) (?<aFoe>\w+)/,
  /(Foe|foe) (?<sym2>[a-zA-Z0-9_.-]+) is (?<aFoe2>\w+)/,
];

export class Foe extends QuestResource {
  constructor(parentQuest, line = null) {
    super(parentQuest);
    this.spawnCount = 0;
    this.foeName = '';
    this.foeType = -1;   // MobileTypes id from the Quests-Foes table
    if (line !== null) this.setResource(line);
  }

  setResource(line) {
    super.setResource(line);
    const match = matchFirst(line, DECL);
    if (!match) return;
    const g = match.groups;
    this.symbol = new QuestSymbol(g.symbol ?? g.sym2);
    this.foeName = g.aFoe ?? g.aFoe2;
    const count = g.count != null ? questParseInt(g.count) : 0;

    const table = foesTable();
    if (!table.hasValue(this.foeName)) {
      throw new Error(`Foes data table does not contain an entry for ${this.foeName}`);
    }
    this.foeType = questParseInt(table.getValue('id', this.foeName));

    this.spawnCount = Math.min(Math.max(count, 1), MAX_SPAWN_COUNT);   // Mathf.Clamp(count, 1, 8)
  }
}
