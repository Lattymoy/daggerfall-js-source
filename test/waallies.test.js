// WA-ALLIES (2026-09-26, SquidKamer - Kamer, Warm Ashes - Ships' author - on the Discord: "Just so you know if the wa
// ships allies aren't attacking then my other mods may have issues ... say we port some quests packs in"). His raid
// quest musters the ship's crew with `change foe _ally_ team 1` and `change foe _X_ infighting true` for every foe:
// the crew is the player's ally, and every quest foe may be fought by other AI. The team landed; the infighting
// flag never did - ChangeFoeInfighting wrote `inst.behaviour`, and a host's foe record keeps its behaviour as
// `questBehaviour` - so a quest foe stayed one "only the player may target, and nobody may target" (EnemySenses
// .GetTargets :806-807, :814-815). The crew stood idle and the raiders fought the player alone. Driven here: the
// REAL quest through the machine, over records of the host's shape, and then the REAL target machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestResourceBehaviour } from '../src/systems/quest/resourceBehaviour.js';
import { LeaveShip } from '../src/systems/warmAshesShips.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { MOBILE_TEAMS, isPlayerTarget, runTargetMachine, staticTeamOf } from '../src/characters/enemyTargets.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T = new URL('../vendor/dfu-quests/Tables/', import.meta.url);
loadQuestTables(Object.fromEntries(readdirSync(T).map((f) => [f.replace(/\.txt$/, ''), readFileSync(new URL(f, T), 'utf8')])));
const RAID = rd('vendor/warm-ashes-ships/Quests/WAQ_SHIP_SMALLRAID.txt').split(/\r?\n/);

const clearCollider = () => ({ raycast: () => Infinity, capsuleCast: () => ({ dist: Infinity, key: null }), move: () => ({ grounded: true }) });
/** A foe RECORD as the exterior pool stands one (exteriorFoes.js): the ai, the entity with both teams, the quest
 *  behaviour the binding hands it as `questBehaviour`, and the two getters the targeting reads. */
function record(machine, symbolName, mobileType, feet, yaw) {
  const qrb = new QuestResourceBehaviour(machine);
  qrb.targetSymbol = { name: symbolName };
  const team = staticTeamOf(mobileType);
  const ai = new EnemyAI(clearCollider(), feet, yaw);
  ai.isHostile = true;
  const f = { ai, entity: { team, mobileTeam: team, suppressInfighting: false, campId: null, health: 30, basics: { team } }, questBehaviour: qrb, dead: false };
  Object.defineProperties(f, {
    isQuestFoe: { get: () => !!f.questBehaviour, enumerable: false },
    questAttackable: { get: () => !!f.questBehaviour?.isAttackableByAI, enumerable: false },
  });
  return f;
}
/** The hosts' walk (world.js / exterior.js questFoeInstances), over the given records. */
const machineOver = (records) => {
  const m = new QuestMachine({
    nowSeconds: () => 12 * 3600,
    questFoeInstances: (symbol) => records.filter((f) => !f.dead && f.questBehaviour?.targetSymbol?.name === symbol?.name),
  });
  m.registerAction(new LeaveShip(null));
  return m;
};

test('WA-ALLIES: the raid quest makes its crew the player\'s ally and every quest foe fair game - the flag lands on the host\'s record', () => {
  const records = [];
  const m = machineOver(records);
  records.push(record(m, 'ally', MOBILE_TYPES.Warrior, [0, 0, 0], 0), record(m, 'warrior', MOBILE_TYPES.Rogue, [0, 0, 3], Math.PI));
  const [ally, pirate] = records;
  assert.equal(ally.entity.team, 'KnightsAndMages');
  assert.equal(pirate.entity.team, 'Criminals');
  const q = m.scheduleQuest(RAID, 0, { rolls: () => 0 });
  assert.ok(q, 'the author\'s quest parses');
  for (let i = 0; i < 5; i++) m.tick();
  assert.equal(ally.entity.team, MOBILE_TEAMS[1], '`change foe _ally_ team 1` - PlayerAlly');
  assert.equal(pirate.entity.team, MOBILE_TEAMS[21], '`change foe _warrior_ team 21`');
  assert.equal(ally.questBehaviour.isAttackableByAI, true, '`change foe _ally_ infighting true` - it never landed');
  assert.equal(pirate.questBehaviour.isAttackableByAI, true);
  assert.equal(ally.questAttackable, true, 'and the targeting reads it where it landed');
});

test('WA-ALLIES: and so the crew fights the raiders and the raiders fight the crew - they stood idle, and only the player was fought', () => {
  const records = [];
  const m = machineOver(records);
  records.push(record(m, 'ally', MOBILE_TYPES.Warrior, [0, 0, 0], 0), record(m, 'warrior', MOBILE_TYPES.Rogue, [0, 0, 3], Math.PI));
  const [ally, pirate] = records;
  m.scheduleQuest(RAID, 0, { rolls: () => 0 });
  for (let i = 0; i < 5; i++) m.tick();
  const playerFeet = [0, 0, 30];
  const targeting = (ai, feet, dt) => runTargetMachine(records.find((c) => c.ai === ai), records, feet, dt, { infighting: true, playerEntity: { health: 100 } });
  for (let t = 0; t < 1.3; t += 0.1) for (const f of records) f.ai.update(0.1, playerFeet, { gameMinutes: 0, playerStealth: 0, rolls: () => 0.5, targeting });
  assert.equal(ally.ai.target, pirate, 'the crew takes the raider');
  assert.equal(pirate.ai.target, ally, 'and the raider the crew');
  assert.ok(!isPlayerTarget(ally.ai.target), 'an ally never targets the player');
});

test('WA-ALLIES by source: the action writes the record\'s questBehaviour, the field the hosts bind and the targeting reads', () => {
  const act = rd('src/systems/quest/actions.js');
  assert.match(act, /const qrb = inst\?\.questBehaviour;\n\s*if \(qrb\) qrb\.isAttackableByAI = this\.isAttackableByAI;\n\s*this\.setComplete\(\);/);
  const code = act.split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
  assert.doesNotMatch(code, /inst\?\.behaviour|inst\.behaviour/, 'no record carries `behaviour` - that is a spawn handle\'s name');
  assert.match(rd('src/scenes/exteriorFoes.js'), /questAttackable: \{ get: \(\) => !!f\.questBehaviour\?\.isAttackableByAI, enumerable: false \}/, 'the record this test stands is the exterior pool\'s');
  assert.match(rd('src/scenes/questFoeHost.js'), /f\.questBehaviour = /, 'the binding\'s field');
});
