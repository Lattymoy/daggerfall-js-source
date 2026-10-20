// SHAM-TRAIL (FIELD BUGS 2026-10-17b, the Discord's #bug-reports, "The Possessed Child": "I complete the possessed child
// by giving the child the scarab to help exorcise the demon from her. The woman who gave me the scarab said the daedra
// would appear somewhere in the home to fight after, but no daedra spawned. This is from the arkay temple in Uplech" -
// "Quest is now unable to be completed").
//
// The trace, over the real parser and machine (test/fb1004dTowns.mjs's region): C0B00Y02 draws `_sham_` or `_real_` at
// its start. REAL: the relic held when the child is clicked runs `_exorcise_`, and its `place foe _daedra_ at _house_`
// hot-places the Daedroth in the house the player stands in - stood in a REAL foe pool (scenes/exteriorFoes.js, the
// interior host's `interiorFoes` is one, minted the same way), as worldModes.js's interior adapter stands it. SHAM: the
// child keeps the relic and runs, no Daedroth by the script's design, and DFU's script files nothing - the latest entry
// sends the player to the priest. The patch (systems/quest/questPatches.js) files 1027 at the reveal, naming the tavern
// where the prostitute now stands; the trail from there is the script's own.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { addQuestResourceObjects } from '../../../src/systems/quest/sceneMount.js';
import { SITE_TYPES } from '../../../src/systems/quest/place.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { createExteriorFoes } from '../../../src/scenes/exteriorFoes.js';
import { entryTarget } from '../../../src/ui/quest/questLens.js';
import { applyQuestPatches, applyTextPatches, entryLines, ENTRY_WIDTH, QUEST_PATCHES, SHAM_TRAIL_MESSAGE, SHAM_TRAIL_STEP } from '../../../src/systems/quest/questPatches.js';
import * as tm from '../../../src/systems/textManager.js';
import { applyForageFix } from '../../../src/systems/foraging/foragingLaw.js';
import { loadTables, questScript, mark, rmbBlock, town, worldOf, SPAWN, ITEM } from '../../fb1004dTowns.mjs';

loadTables();
const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const SOURCE = rd('vendor/dfu-quests/Quests/C0B00Y02.txt');
const patched = () => applyQuestPatches('C0B00Y02', SOURCE).split('\n');

/** MONSTER.BSA holding one career, ENEMY027.CFG - the Daedroth's (test/ai/nav/fb1016b_indoorwatch.test.js's rig). */
function monsterBsa() {
  const cfg = new Uint8Array(74); const cv = new DataView(cfg.buffer);
  cfg[10] = 0x08; cv.setUint16(52, 4, true);
  [40, 50, 50, 85, 50, 50, 90, 55].forEach((a, i) => cv.setUint16(58 + i * 2, a, true));
  const name = 'ENEMY027.CFG';
  const out = new Uint8Array(4 + cfg.length + 18); const v = new DataView(out.buffer);
  v.setInt16(0, 1, true); v.setUint16(2, 0x0100, true);
  out.set(cfg, 4);
  for (let i = 0; i < name.length; i++) out[4 + cfg.length + i] = name.charCodeAt(i);
  v.setInt32(4 + cfg.length + 14, cfg.length, true);
  return out;
}
const BSA = monsterBsa();
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const player = () => ({ level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50 }, crimeCommitted: 4 });
/** A building's foe pool with its host's deps (test/systems/quest/fb1004f_questfoe.test.js's rig, indoors). */
const pool = () => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, destroyBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return BSA; throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 0, currentPixelKey: () => null, playerInside: true,
  playerEntity: player(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
});

/** The quest taken at Uplech's temple, every draw at 0.55 but the start's `pick one of _sham_ _real_` (`pick`: 0.1 the
 *  sham, 0.55 the real). The town: a temple, a tavern, ten houses (each local person takes one for a home); the
 *  priest's `_house3_` is in the next town. A click is the resource's own (QuestResourceBehaviour.DoClick's
 *  setPlayerClicked) and two ticks; entering a building runs the layout mount, and the machine's hot-place the same
 *  walk - its foes stood in the building's pool through `standFoe`, as worldModes.js's interior adapter does. */
function possessedChild({ pick, lines = patched() }) {
  const T = BUILDING_TYPES;
  const blk = rmbBlock('TEST.RMB', [T.Temple, T.Tavern, T.House2, T.House2, T.House2, T.House2, T.House2, T.House2, T.House1, T.House1, T.House1, T.House1, T.GeneralStore]
    .map((type) => ({ type, markers: [mark(SPAWN, 10, 0, 10), mark(ITEM, 5, 0, 5)] })));
  const here = town({ name: 'Uplech', locationIndex: 0, mapId: 777, grid: ['TEST.RMB'] });
  const there = town({ name: 'Elsewhere', locationIndex: 1, mapId: 778, grid: ['TEST.RMB'] });
  let inside = null, at = here;
  const world = worldOf({ locations: [here, there], blocks: new Map([['TEST.RMB', blk]]), current: here, inside: () => inside });
  world.currentLocation = () => at;
  // %god in a building no temple: the region's temple (MapsFile.RegionTemples), a temple faction its Divine parents
  // (Temple.GetDivine's second arm)
  const faction = world.getFactionData;
  world.getFactionData = (id) => ({ ...faction(id), parent: 35 });
  let foes = null;
  const behaviours = [], spawns = [];
  const adapter = {
    currentMapId: () => at.mapTableData.mapId, findBehaviours: () => behaviours,
    standNPC: ({ behaviour, person }) => { behaviours.push(behaviour); return { setActive() {}, destroy() {}, staticNpcFactionId: person.factionId ?? 0 }; },
    standItem: ({ behaviour }) => { behaviours.push(behaviour); return null; },
    standFoe: ({ foe, gender, position, behaviour }) => {
      behaviours.push(behaviour);
      spawns.push(foes.spawnFoe(foe.foeType, [position.x, position.y, position.z], { gender, questBehaviour: behaviour, feetGiven: true, questMarker: true }));
      return null;
    },
  };
  const carried = new Set();
  const popups = [], prompts = [];
  let gold = 1000, die = 0.55, now = 0;
  const machine = new QuestMachine({
    nowSeconds: () => now, world, getReputation: () => 0, changeReputation: () => {}, changeLegalRep: () => {}, playerGender: () => 'male', playerLevel: () => 5,
    showPopup: (_q, tokens) => popups.push(tokens.map((t) => t.text).join(' ').replace(/\s+/g, ' ').trim()),
    showPrompt: (_q, message, answer) => prompts.push({ id: message.id ?? null, answer }),
    giveItemToPlayer: (it) => carried.add(it), carriesQuestItem: (item) => carried.has(item.daggerfallUnityItem),
    releaseQuestItem: (_uid, item) => carried.delete(item.daggerfallUnityItem),
    getGoldPieces: () => gold, deductGoldPieces: (n) => { gold -= n; }, addGold: (n) => { gold += n; }, addHUDText() {},
    isPlayerInTown: () => true, offerReward() {},
  });
  world.mountCurrentSiteQuestResources = () => addQuestResourceObjects(machine, adapter, SITE_TYPES.Building, inside.building.buildingKey);
  const quest = machine.scheduleQuest(lines, 0, { rolls: () => die });
  die = pick;
  const tick = () => { for (let i = 0; i < 2; i++) { now += 1; machine.tick(); } };
  tick();
  die = 0.55;
  const site = (name) => quest.getPlace({ name }).siteDetails;
  const enter = (name, town = here) => {
    at = town;
    const s = site(name);
    inside = { building: { buildingKey: s.buildingKey, name: s.buildingName } };
    foes = pool();
    addQuestResourceObjects(machine, adapter, SITE_TYPES.Building, s.buildingKey);
  };
  const leave = () => { at = here; inside = null; };
  const click = (name) => { popups.length = 0; quest.getPerson({ name }).setPlayerClicked(); tick(); return [...popups]; };
  const triggered = (name) => [...quest.tasks.values()].find((t) => t.symbol?.name === name)?.triggered ?? false;
  const entries = () => quest.getLogMessages().map((e) => [e.stepID, e.messageID]);
  const latest = () => quest.getMessage(quest.getLogMessages().at(-1).messageID);
  const text = (id) => quest.getMessage(id).getTextTokens(-1, () => 0.55).map((t) => t.text).join(' ').replace(/\s+/g, ' ').trim();
  /** Guardian, child, priest (the relic), child with it: the player's road to the reveal, as the report took it. */
  const toTheChild = () => {
    enter('tavern'); click('guardian');
    enter('house'); click('child');
    enter('house3', there); click('priest');
    assert.equal(carried.size, 1, 'the priest hands over the relic (`get item _item_`)');
    enter('house');
    return click('child');
  };
  return { machine, quest, popups, prompts, carried, spawns, site, enter, leave, click, triggered, entries, latest, text, toTheChild, gold: () => gold };
}

test('SHAM-TRAIL, the report: the sham reveal stands no Daedroth - by the script, whose priest promised one in both branches - and DFU\'s script files nothing, its latest entry still sending the player to the priest', () => {
  const q = possessedChild({ pick: 0.1, lines: SOURCE.split(/\r?\n/) });
  assert.ok(q.triggered('sham') && !q.triggered('real'), 'the start\'s draw: the sham');
  const said = q.toTheChild();
  assert.match(said[0], /I'll keep this .+ for protection\. Goodbye!$/, 'say 1016: the child keeps the relic - "giving the child the scarab"');
  assert.ok(q.triggered('revealsham') && !q.triggered('exorcise'));
  assert.equal(q.spawns.length, 0, 'no Daedroth: only `_exorcise_` places the foe');
  assert.equal(q.carried.size, 0, '`take _item_ from pc`');
  // the priest's word, which the sham shares
  assert.match(q.text(1019), /When the exorcism is complete, it will leave .+ and appear elsewhere in .+\. Be ready for a battle/);
  // nothing filed: the journal's last word is the priest's house
  assert.deepEqual(q.entries(), [[0, 1010], [2, 1014], [3, 1020]], 'the reveal files no entry in DFU\'s script');
  assert.equal(entryTarget(q.latest()).symbol, 'house3', 'the guidance sends the player back to the priest');
  // ...where nothing answers, nor at the questor
  q.enter('house3'); assert.deepEqual(q.click('priest'), [], 'the priest says nothing');
  q.leave(); assert.deepEqual(q.click('qgiver'), [], 'nor the questor');
  assert.equal(q.triggered('victory'), false, '"Quest is now unable to be completed"');
});

test('SHAM-TRAIL, the fix: the reveal files 1027 at step 4 - what the player saw, and the tavern - and the trail it points down is the script\'s own: the prostitute there for fifty gold, the guardian at the house she names, the relic back, the questor\'s thanks', () => {
  const q = possessedChild({ pick: 0.1 });
  q.toTheChild();
  assert.deepEqual(q.entries(), [[0, 1010], [2, 1014], [3, 1020], [SHAM_TRAIL_STEP, SHAM_TRAIL_MESSAGE]], 'one entry more, filed by the reveal');
  assert.deepEqual([SHAM_TRAIL_MESSAGE, SHAM_TRAIL_STEP], [1027, 4], 'the script\'s ids end at 1026, its steps 0-3 and 6');
  const child = q.quest.getPerson({ name: 'child' }).displayName, guardian = q.quest.getPerson({ name: 'guardian' }).displayName;
  const item = q.quest.getItem({ name: 'item' }), tavern = q.site('tavern');
  assert.equal(q.text(SHAM_TRAIL_MESSAGE).replace(/^[^:]+: /, ''),
    `No daedra came out of ${child} when I brought the ${item.expandMacro(1)}. ${child} just thanked me and ran off with it. Something is not right here. ${guardian} was staying at ${tavern.buildingName}, and someone there may know more.`,
    'the macros expand: the child, the relic, the guardian, the tavern - no pronoun, no race');
  // the guidance follows the entry: the tavern, by its key (the Town tier's ring and compass)
  const target = entryTarget(q.latest());
  assert.equal(target.symbol, 'tavern');
  assert.deepEqual(target.building, { mapId: tavern.mapId, buildingKey: tavern.buildingKey });

  // the trail: the tavern's prostitute asks fifty gold (`_bribe_`), a Yes names the house (`_hookerconfess_`)
  q.enter('tavern');
  q.click('hooker');
  assert.equal(q.gold(), 950, 'fifty gold for the word');
  assert.equal(q.prompts.length, 1, 'prompt 1023');
  q.prompts[0].answer(true);
  q.click('hooker');
  assert.ok(q.triggered('hookerconfess'));
  assert.deepEqual(q.entries().at(-1), [6, 1026], 'and the script\'s own entry, 1026, after the patch\'s');
  q.enter('house2');
  assert.match(q.click('guardian')[0], /^"Don't hurt me!" .+ hands you the .+ and flees\.$/, 'say 1025: the relic back');
  assert.equal(q.carried.size, 1);
  q.leave();
  q.click('qgiver');
  assert.ok(q.triggered('victory'), '`when _qgclicked_ and _rescueitem_`: the quest closes');
});

test('SHAM-TRAIL, the real branch (not the report\'s - read and run): the exorcism hot-places the Daedroth in the house the player stands in, a quest foe of the building\'s pool on the house\'s marker, and the questor closes the quest; the patch\'s entry is never filed', async () => {
  const q = possessedChild({ pick: 0.55 });
  assert.ok(q.triggered('real') && !q.triggered('sham'), 'the start\'s draw: the real');
  const said = q.toTheChild();
  assert.match(said[0], /is out of me \.\.\. but \.\.\. it's still here\." .+ runs away\./, 'say 1015');
  assert.ok(q.triggered('exorcise'));
  assert.equal(q.spawns.length, 1, '`place foe _daedra_ at _house_`: one foe, hot-placed (Place.AssignQuestResource\'s isPlayerHere tail)');
  const [f] = await Promise.all(q.spawns);
  const daedra = q.quest.getResource({ name: 'daedra' });
  assert.ok(f, 'the pool stood it');
  assert.equal(f.mobileType, 27, 'a Daedroth (`Foe _daedra_ is Daedroth`, MobileTypes 27)');
  assert.equal(f.questBehaviour.targetResource, daedra, 'the quest\'s own foe');
  assert.equal(f.isQuestFoe, true);
  const house = q.site('house');
  assert.ok(house.selectedMarker.targetResources.some((s) => s.name === 'daedra'), 'on the house\'s marker');
  assert.ok(!q.entries().some(([, id]) => id === SHAM_TRAIL_MESSAGE), 'the sham\'s entry is the sham\'s alone');
  q.leave();
  q.click('qgiver');
  assert.ok(q.triggered('victory'), '`when _qgclicked_ and _exorcise_`: the Daedroth need not fall');
});

test('SHAM-TRAIL, the patch law: each patch finds its text in the vendored source exactly as often as it says, a CRLF checkout patches the same, a quest with none is untouched, a text that moved throws; FORAGE-FIX rides the same law', () => {
  for (const [name, patchesOf] of Object.entries(QUEST_PATCHES)) {
    const raw = rd(`vendor/dfu-quests/Quests/${name}.txt`);
    for (const p of patchesOf()) assert.equal(raw.replace(/\r\n?/g, '\n').split(p.old).length - 1, p.count, `${name}: ${p.old.trim().slice(0, 40)}`);
    assert.equal(applyQuestPatches(name, raw.replace(/\r?\n/g, '\r\n')), applyQuestPatches(name, raw), `${name}: CRLF`);
  }
  assert.deepEqual(Object.keys(QUEST_PATCHES), ['C0B00Y02']);
  const other = rd('vendor/dfu-quests/Quests/S0000021.txt');
  assert.equal(applyQuestPatches('S0000021', other), other, 'a quest the table does not name loads as shipped');
  assert.throws(() => applyQuestPatches('C0B00Y02', SOURCE.replace('\tplace npc _hooker_ at _tavern_ \n', '\tplace npc _hooker_ at _tavern_\n')),
    /^Error: QUEST-PATCH: C0B00Y02 holds "place npc _hooker_ at _tavern_ \n\tclear _talkguardian_" 0 times, not 1$/, 'a script that moved under the patch');
  assert.throws(() => applyTextPatches('X', 'y', [{ old: 'a', new: 'b', count: 1 }], 'aa'), /^Error: X: y holds "a" 2 times, not 1$/);
  assert.equal(applyTextPatches('X', 'y', [{ old: 'a', new: 'b', count: 2 }], 'a\r\na'), 'b\nb');
  // the patched quest parses whole: the reveal's actions and the entry beside the script's own
  const lines = patched();
  const reveal = lines.slice(lines.indexOf('_revealsham_ task:'), lines.indexOf('_revealsham_ task:') + 10);
  assert.deepEqual(reveal.slice(-3), ['\tclear _talkguardian_', `\tlog ${SHAM_TRAIL_MESSAGE} step ${SHAM_TRAIL_STEP}`, ''], 'filed after the reveal\'s own actions');
  // FORAGE-FIX's mismatch still names its table
  assert.throws(() => applyForageFix('FetchWood01', 'nothing'), /^Error: FORAGE-FIX: FetchWood01 holds /);
});

test('SHAM-TRAIL, the words: the entry is the text core\'s (quest.possessedChild.shamTrail), read as the quest is read - in French the French row, laid in journal lines, its four names expanded, and English again byte for byte; every whole language keeps the four names', () => {
  const english = applyQuestPatches('C0B00Y02', SOURCE);
  // the lines: never an empty one (it would end the message), each led by the script's space, none past the width but a lone word
  for (const text of ['', 'a', 'No daedra came out of _child_ when I brought the _item_.', 'x'.repeat(50) + ' y']) {
    const lines = entryLines(text);
    assert.ok(lines.every((l) => l.startsWith(' ') && l.trim() !== ''), JSON.stringify(lines));
    assert.ok(lines.every((l) => l.length - 1 <= ENTRY_WIDTH || !l.trim().includes(' ')), JSON.stringify(lines));
    assert.equal(lines.map((l) => l.trim()).join(' '), text.split(/\s+/).filter(Boolean).join(' '), 'every word, in order');
  }
  const rows = tm.loadStringTableCsv(rd('locales/fr/Port_Strings.csv'));
  const fr = new Map(rows).get('quest.possessedChild.shamTrail');
  assert.ok(fr && fr !== new Map(tm.loadStringTableCsv(rd('locales/en/Port_Strings.csv'))).get('quest.possessedChild.shamTrail'), 'French drafted');
  tm.patchLocaleTable('fr', 'Port_Strings', rows);
  try {
    tm.setLocale('fr');
    const q = possessedChild({ pick: 0.1 });
    q.toTheChild();
    const child = q.quest.getPerson({ name: 'child' }).displayName, guardian = q.quest.getPerson({ name: 'guardian' }).displayName;
    const expanded = fr.replaceAll('_child_', child).replaceAll('_item_', q.quest.getItem({ name: 'item' }).expandMacro(1))
      .replaceAll('_guardian_', guardian).replaceAll('_tavern_', q.site('tavern').buildingName);
    assert.equal(q.text(SHAM_TRAIL_MESSAGE).replace(/^[^:]+: /, ''), expanded, 'the French row, its names expanded');
    assert.equal(entryTarget(q.latest()).symbol, 'tavern', 'and it still points at the tavern');
  } finally {
    tm.setLocale('en');
  }
  assert.equal(applyQuestPatches('C0B00Y02', SOURCE), english, 'English again, byte for byte');
  // the whole languages (every row of the catalog drafted): each keeps the four names the quest expands
  const whole = ['bg', 'cs', 'da', 'de', 'es', 'fr', 'id', 'it', 'ko', 'nb', 'pt-BR', 'ro', 'ru'];
  for (const code of whole) {
    const row = new Map(tm.loadStringTableCsv(rd(`locales/${code}/Port_Strings.csv`))).get('quest.possessedChild.shamTrail');
    assert.ok(row, `${code} drafted`);
    for (const name of ['_child_', '_item_', '_guardian_', '_tavern_']) assert.ok(row.includes(name), `${code} keeps ${name}`);
  }
});

test('SHAM-TRAIL, the wiring: the browser\'s pack patches DFU\'s own quests as each is read (the entry in that moment\'s language), a mod\'s quest of the name stays the mod\'s, and a patch that no longer finds its text loads the quest as shipped', () => {
  const src = rd('src/scenes/quest/questData.js');
  assert.match(src, /import \{ applyQuestPatches, QUEST_PATCHES \} from '\.\.\/\.\.\/systems\/quest\/questPatches\.js';/);
  assert.match(src, /try \{ return applyQuestPatches\(name, text\)\.split\(\/\\r\?\\n\/\); \} catch \(e\) \{/);
  assert.match(src, /if \(QUEST_PATCHES\[name\]\) patchable\.set\(name, text\);/);
  assert.match(src, /quests\.set\(name, patched\.split\(\/\\r\?\\n\/\)\); patchable\.delete\(name\);/);
  // PIN MOVED (QL4): the read is the questlines' too - a flagship quest's branch patched over it while their switch is on
  // PIN MOVED (AUDIT QUESTLINES BRANCH-12): and a shared copy's shape read as its own stamp read it - the read's second argument
  assert.match(src, /getQuestSourceLines: \(name, questlines\) => questlineLines\(name, \(patchable\.has\(name\) \? patchedLines\(name, patchable\.get\(name\)\) : null\) \?\? quests\.get\(name\) \?\? null, questlines\),/);
});
