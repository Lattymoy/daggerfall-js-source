// QUEST-NAME (FIELD BUGS 2026-10-11g #5, the Discord's "Quest NPCs are inactive": "I am faced with the problem of not
// being able to interact with the quest NPCs", a screenshot of a quest's person standing in a house among the room's
// own). The click was never broken - a Talk press on a quest Person stamps LastNPCClicked and runs DoClick, and
// StaticNPCClick returns there for every quest Person in Daggerfall Unity too (clickQuestFlat) - but World Tooltips'
// plaque named every person in the room except him. The mod asks its StaticNPC arm (Modded_HUDTooltipWindow.cs:325-393,
// `ret = npc.DisplayName`) BEFORE its quest-resource arm, and AddQuestNPC gives a quest Person's billboard a StaticNPC
// (GameObjectHelper.cs:1060-1062): in DFU with the mod he is named. The port read the quest-resource arm's `is Item`
// gate alone. Both hosts' namers name him now (scenes/worldModes.js questStandPersonName), off the layout data the
// click and Info read. FIELD BUGS 2026-10-06c (4)'s "World Tooltips names a quest ITEM alone" is corrected by this.
// bible/01-Overview/bugs/Field-Bugs-2026-10-11g.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { npcHoverName, DAEDRA_ARCHIVE } from '../../src/systems/worldTooltips.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const WM = read('src/scenes/worldModes.js');
const grab = (re, what) => { const m = re.exec(WM); assert.ok(m, `${what} is no longer where this pin reads it`); return m[1]; };
/** The host's helper as it is written, run over the real plaque namer and recording seams. */
function helper({ bridge = true } = {}) {
  const src = grab(/\n {2}(const questStandPersonName = \(list, key, buildingKey\) => \{\n[\s\S]*?\n {2}\};)\n/, 'questStandPersonName');
  const built = [];
  const questStandNpcData = (st, res, buildingKey) => { const d = { st, res, buildingKey, hash: 77 }; built.push(d); return d; };
  const npcDisplayName = (d) => `Name of ${d.hash} in ${d.buildingKey}`;
  const fn = new Function('questBridge', 'questStandNpcData', 'npcDisplayName', 'npcHoverName', `${src}\nreturn questStandPersonName;`)(bridge ? {} : null, questStandNpcData, npcDisplayName, npcHoverName);   // eslint-disable-line no-new-func
  return { fn, built };
}
const stand = (res, o = {}) => ({ archive: 182, record: 1, behaviour: { targetResource: res }, ...o });

test('QUEST-NAME: a quest PERSON stand is named as the room\'s own people are - StaticNPC.DisplayName off the stand\'s own layout data, built with the click\'s building key; a FOE stand and an ITEM stand are not this arm\'s; no quest machine names no one (mutants: the person unnamed; the item named here; the click\'s key unread)', () => {
  const { fn, built } = helper();
  const person = { isPerson: true, gender: 1, factionId: 82, nameSeed: 5 };
  const list = [stand(person), stand({ isFoe: true }), stand({ isItem: true }), stand(null)];
  assert.deepEqual(fn(list, 'questflat:0', 7), { title: 'Name of 77 in 7' });
  assert.equal(built[0].st, list[0]);
  assert.equal(built[0].res, person);
  assert.equal(built[0].buildingKey, 7, 'the key the click builds its LastNPCClicked with');
  assert.equal(fn(list, 'questflat:1', 7), null, 'a quest foe: the mod\'s gate answers nothing');
  assert.equal(fn(list, 'questflat:2', 7), null, 'an item: the quest-resource arm\'s, its long name');
  assert.equal(fn(list, 'questflat:3', 7), null);
  assert.equal(fn(list, 'questflat:9', 7), null, 'a stand gone');
  assert.equal(helper({ bridge: false }).fn(list, 'questflat:0', 7), null, 'no quest machine, no quest person');
  // the mod's own daedra by archive 175, through the same plaque namer the room's people go through
  assert.deepEqual(fn([stand(person, { archive: DAEDRA_ARCHIVE, record: 0 })], 'questflat:0', 0), { title: npcHoverName('x', { archive: DAEDRA_ARCHIVE, record: 0 }) });
});

test('QUEST-NAME by source: both hosts\' plaques ask it BEFORE the item gate - the building\'s with its click\'s own building key, the dungeon\'s with 0 as its click does (mutants: the building unnamed; the dungeon unnamed; a key the click does not use)', () => {
  assert.match(WM, /if \(key\.startsWith\('questflat:'\)\) \{\n\s+const named = questStandPersonName\(questFlats, key, interiorBuilding\?\.buildingKey \?\? 0\); if \(named\) return named;\n\s+const st = questFlats\[/);
  assert.match(WM, /clickQuestFlat\(questFlats\[Number\(key\.split\(':'\)\[1\]\)\], interiorBuilding\?\.buildingKey \?\? 0\);/, 'the building\'s click, the same key');
  assert.match(WM, /const dungeonQuestFlatName = \(key\) => \{\n.*\n\s+const named = questStandPersonName\(dungeonQuestFlats, key, 0\); if \(named\) return named;/);
  assert.match(WM, /clickQuestFlat\(dungeonQuestFlats\[Number\(key\.split\(':'\)\[1\]\)\], 0\);/, 'the dungeon\'s click, the same 0');
  // and the item gate behind it stands for the rest
  assert.equal((WM.match(/if \(!res \|\| res\.isPerson === true \|\| res\.isFoe === true\) return null;/g) ?? []).length, 2);
});

test('QUEST-NAME: the mod\'s own order - its StaticNPC arm (`ret = npc.DisplayName`) is asked before its quest-resource arm, whose `is Item` gate names items alone; the reading this fix rests on (the vendored source)', () => {
  const cs = read('vendor/world-tooltips/Scripts/Modded_HUDTooltipWindow.cs');
  const npcArm = cs.indexOf('if (CheckComponent<StaticNPC>(hit, out comp))');
  const questArm = cs.indexOf('else if (CheckComponent<QuestResourceBehaviour>(hit, out comp))');
  assert.ok(npcArm > 0 && questArm > npcArm, 'the StaticNPC arm first');
  assert.ok(cs.indexOf('ret = npc.DisplayName;', npcArm) < questArm, 'and it names the person');
  assert.ok(cs.indexOf('if (qrb.TargetResource is Item)', questArm) > questArm, 'the quest arm names an item');
});
