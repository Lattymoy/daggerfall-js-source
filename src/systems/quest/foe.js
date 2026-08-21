// THE QUEST FOE (Q1 declaration + Q2b tracking + Q3-iii the name and
// queue halves) - Foe.cs. Q1: "Foe _sym_ is [COUNT] aFoeName" - the
// name resolves to a MobileTypes id through the Quests-Foes table
// (unknown names throw, as DFU), and the count clamps
// 1..maxSpawnCount(8) - ParseInt of a missing count is 0 and the
// clamp is what makes it 1. Q2b: the injury/kill/restrain tracking
// the trigger actions read - the world half that CALLS
// SetInjured/IncrementKills (EnemyEntity damage/death) and READS
// IsRestrained (EnemyMotor) rides Q4's behaviour mount; until then
// tests drive the setters directly, as QuestResourceBehaviour does
// in DFU. Q3-iii: SetFoeName (the world half - a HEADLESS parse
// leaves `namePending` true LOUDLY, the npcPending precedent),
// deathTrigger/kill, the spell queue (CastSpellOnFoe's consumer) and
// the cloned item queue. The scene halves that DRAIN the queues
// (QuestResourceBehaviour.CastSpellQueue/AddItemQueue per instance)
// ride Q4's behaviour mount, as does macro expansion reading
// typeName/displayName.

import { QuestResource, matchFirst } from './questResource.js';
import { Symbol as QuestSymbol } from './symbol.js';
import { parseInt as questParseInt } from './parseUtils.js';
import { foesTable } from './tables.js';
import { GENDERS, getNameBankOfRegion, fullName, monsterName } from '../../characters/nameHelper.js';
import { srand, randomRange } from '../../formats/dfRandom.js';
import { ENEMY_BASICS } from '../../characters/enemyBasics.js';

const MAX_SPAWN_COUNT = 8;

// TextManager.GetLocalizedEnemyName's en list (Internal_Strings en id
// 183, 62 entries): index = id for monsters 0..42, 43 + id - 128 for
// the class enemies.
export const ENEMY_NAMES = Object.freeze([
  'Rat', 'Imp', 'Spriggan', 'Giant Bat', 'Grizzly Bear',
  'Sabretooth Tiger', 'Spider', 'Orc', 'Centaur', 'Werewolf', 'Nymph',
  'Slaughterfish', 'Orc Sergeant', 'Harpy', 'Wereboar',
  'Skeletal Warrior', 'Giant', 'Zombie', 'Ghost', 'Mummy',
  'Giant Scorpion', 'Orc Shaman', 'Gargoyle', 'Wraith', 'Orc Warlord',
  'Frost Daedra', 'Fire Daedra', 'Daedroth', 'Vampire',
  'Daedra Seducer', 'Ancient Vampire', 'Daedra Lord', 'Lich',
  'Ancient Lich', 'Dragonling', 'Fire Atronach', 'Iron Atronach',
  'Flesh Atronach', 'Ice Atronach', 'Horse', 'Dragonling', 'Dreugh',
  'Lamia',
  'Mage', 'Spellsword', 'Battlemage', 'Sorcerer', 'Healer',
  'Nightblade', 'Bard', 'Burglar', 'Rogue', 'Acrobat', 'Thief',
  'Assassin', 'Monk', 'Archer', 'Ranger', 'Barbarian', 'Warrior',
  'Knight', 'City Watch',
]);

/** EnemyBasics.IsClassEnemyId: the 128 bit. */
export const isClassEnemyId = (id) => (id & 128) !== 0;

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
    this.deathTrigger = false;     // true when the enemy should instantly die (Foe.cs:42); NOT save state
    this.isRestrained = false;     // true if enemy restrained by quest
    this.killCount = 0;            // kills of this spawn; does NOT rearm
    // Q3-iii name state (Foe.cs:45-46, SetFoeName)
    this.humanoidGender = GENDERS.Male;
    this.displayName = '';
    this.typeName = '';
    this.namePending = true;   // no world seam -> SetFoeName pends LOUDLY
    if (line !== null) this.setResource(line);
  }

  get isFoe() { return true; }

  _rolls() { return this.parentQuest?.rolls ?? Math.random; }
  _range(n) { return n > 0 ? Math.floor(this._rolls()() * n) : 0; }

  get gender() { return this.humanoidGender; }

  /** ExpandMacro (Foe.cs:153-177): _symbol_ answers the TYPE name,
   *  =symbol_ the display name - the inversion is C#'s own. Stores
   *  this foe as the quest's last resource for pronouns. */
  expandMacro(macroType) {
    this.parentQuest.lastResourceReferenced = this;
    if (macroType === 1) return this.typeName;      // NameMacro1
    if (macroType === 5) return this.displayName;   // DetailsMacro
    return false;
  }

  /** SetInjured / RearmInjured (Foe.cs:186-196). */
  setInjured() { this.injuredTrigger = true; }
  rearmInjured() { this.injuredTrigger = false; }

  /** SetRestrained / ClearRestrained (Foe.cs:202-212). */
  setRestrained() { this.isRestrained = true; }
  clearRestrained() { this.isRestrained = false; }

  /** IncrementKills (Foe.cs:219-222). */
  incrementKills(amount = 1) { this.killCount += amount; }

  /** Kill (Foe.cs:224-227): flags every live instance to die; the
   *  behaviour mount zeroes entity health per instance (Q4). */
  kill() { this.deathTrigger = true; }

  /** QueueSpell (Foe.cs:233-239): a plain lazy Add - no duplicate
   *  refusal, unlike the item queue. Delivery is per-instance
   *  (CastSpellQueue's foeSpellQueuePosition cursor, Q4); the queue
   *  itself is never cleared, so FUTURE instances of this 1-to-many
   *  Foe receive every spell queued so far. */
  queueSpell(spell) {
    if (!this.spellQueue) this.spellQueue = [];
    this.spellQueue.push(spell);
  }

  get spellQueueCount() { return this.spellQueue?.length ?? 0; }

  /** QueueItem (Foe.cs:246-252): items added to this Foe by the quest
   *  system; Q2b-ii - GiveItem's consumer. Q3's spawner clones the
   *  queue onto every instance (GetClonedItemQueue keeps the
   *  originals here, as C# does). The queue rides ItemCollection in
   *  C#, whose AddItem REFUSES a second add of the same item
   *  (ItemCollection.cs:233-237, keyed by UID; here by identity) -
   *  a rearmed "give item" cannot double-queue (Q2b-ii VERIFY). */
  queueItem(dfItem) {
    if (!this.itemQueue) this.itemQueue = [];
    if (this.itemQueue.includes(dfItem)) {
      console.warn('[quest] Duplicate item added to foe item queue.');
      return;
    }
    this.itemQueue.push(dfItem);
  }

  get itemQueueCount() { return this.itemQueue?.length ?? 0; }

  /** GetClonedItemQueue (Foe.cs:254-265): null when empty, else a
   *  clone per item - "Original item UIDs will remain on Foe in
   *  their item queue." */
  getClonedItemQueue() {
    if (!this.itemQueueCount) return null;
    return this.itemQueue.map((it) => ({ ...it }));
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

    const world = this.parentQuest?.hooks?.world;
    if (!world) return;   // namePending stays true - the headless charter
    this._setFoeName(world);
    this.namePending = false;
  }

  /** SetFoeName (Foe.cs:271-296). Monsters draw a random monster name
   *  ("Always treating monsters as male for now"); humanoids roll
   *  gender at 55% MALE and draw a full name from the REGION's bank.
   *  Both wall-clock DateTime.Now.Millisecond seeds ride the quest's
   *  injectable roll (0..999, the same surface) per Ledger A; the
   *  monster seed ADDS DFRandom.random_range(1, 1000000) drawn from
   *  DFRandom's own current state, verbatim. */
  _setFoeName(world) {
    // TextManager.GetLocalizedEnemyName; the enum-name fallback for a
    // type missing from EnemyBasics is unreachable through the
    // Quests-Foes table (every id is a real enemy)
    this.typeName = ENEMY_BASICS[this.foeType]
      ? ENEMY_NAMES[this.foeType < 128 ? this.foeType : 43 + this.foeType - 128]
      : String(this.foeType);
    if (!isClassEnemyId(this.foeType)) {
      srand(this._range(1000) + randomRange(1, 1000000));
      this.displayName = monsterName(GENDERS.Male, this._rolls());
      return;
    }
    this.humanoidGender = this._rolls()() < 0.55 ? GENDERS.Male : GENDERS.Female;
    srand(this._range(1000));
    this.displayName = fullName(getNameBankOfRegion(world.currentRegionIndex()), this.humanoidGender);
  }

  // ---- the save envelope (Q4-iv; Foe.cs SaveData_v2) ----

  /** GetSaveData: the v2 shape (foeId as int). The v1->v2 upgrade
   *  arm is legacy-save migration with no port-side v1 saves in the
   *  wild - recorded, not ported. */
  getSaveData() {
    return {
      spawnCount: this.spawnCount,
      foeId: this.foeType,
      humanoidGender: this.humanoidGender,
      injuredTrigger: this.injuredTrigger,
      restrained: this.isRestrained,
      killCount: this.killCount,
      displayName: this.displayName,
      typeName: this.typeName,
      spellQueue: this.spellQueue ? structuredClone(this.spellQueue) : null,
      itemQueue: this.itemQueue ? structuredClone(this.itemQueue) : null,
    };
  }

  restoreSaveData(dataIn) {
    if (dataIn == null) return;
    this.spawnCount = dataIn.spawnCount;
    this.foeType = dataIn.foeId;
    this.humanoidGender = dataIn.humanoidGender;
    this.injuredTrigger = dataIn.injuredTrigger;
    this.isRestrained = dataIn.restrained;
    this.killCount = dataIn.killCount;
    this.displayName = dataIn.displayName;
    this.typeName = dataIn.typeName;
    this.spellQueue = dataIn.spellQueue ? structuredClone(dataIn.spellQueue) : null;
    this.itemQueue = dataIn.itemQueue ? structuredClone(dataIn.itemQueue) : null;
  }
}
