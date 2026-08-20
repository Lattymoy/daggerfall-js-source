// THE QUEST FOE (Q1 declaration + Q2b tracking) - Foe.cs. Q1: "Foe
// _sym_ is [COUNT] aFoeName" - the name resolves to a MobileTypes id
// through the Quests-Foes table (unknown names throw, as DFU), and
// the count clamps 1..maxSpawnCount(8) - ParseInt of a missing count
// is 0 and the clamp is what makes it 1. Q2b: the injury/kill/
// restrain tracking the trigger actions read - the world half that
// CALLS SetInjured/IncrementKills (EnemyEntity damage/death) and
// READS IsRestrained (EnemyMotor) rides Q3's foe spawning; until
// then tests drive the setters directly, as QuestResourceBehaviour
// does in DFU. The spawn queues (itemQueue/spellQueue), deathTrigger
// and SetFoeName ride their consumers (GiveItem/CastSpellOnFoe/
// KillFoe at the item and world tranches).

import { QuestResource, matchFirst } from './questResource.js';
import { Symbol as QuestSymbol } from './symbol.js';
import { parseInt as questParseInt } from './parseUtils.js';
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
    // Q2b tracking state (Foe.cs:41-44)
    this.injuredTrigger = false;   // true once enemy injured, rearmed each wave
    this.isRestrained = false;     // true if enemy restrained by quest
    this.killCount = 0;            // kills of this spawn; does NOT rearm
    if (line !== null) this.setResource(line);
  }

  get isFoe() { return true; }

  /** SetInjured / RearmInjured (Foe.cs:186-196). */
  setInjured() { this.injuredTrigger = true; }
  rearmInjured() { this.injuredTrigger = false; }

  /** SetRestrained / ClearRestrained (Foe.cs:202-212). */
  setRestrained() { this.isRestrained = true; }
  clearRestrained() { this.isRestrained = false; }

  /** IncrementKills (Foe.cs:219-222). */
  incrementKills(amount = 1) { this.killCount += amount; }

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
