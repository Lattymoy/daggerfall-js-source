// QREPAIR (2026-09-24, Mac: "Add a quest refresh option to settings" - "Repair active quests"): the repair over a REAL
// quest machine, Place and scene mount (systems/quest/questRepair.js): what it puts back, what it never touches, the
// progress it leaves alone, the line it says; the by-name mount; and the door, by source, in every host and the menu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { Place, SITE_TYPES } from '../src/systems/quest/place.js';
import { QuestResourceBehaviour } from '../src/systems/quest/resourceBehaviour.js';
import { isAlreadyInjected } from '../src/systems/quest/sceneMount.js';
import { repairActiveQuests, questRepairText, targetedNames, goneOnPurpose, placementIntents } from '../src/systems/quest/questRepair.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const VENDOR = join(ROOT, 'vendor', 'dfu-quests');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(join(VENDOR, 'Tables', f), 'utf8').replace(/^﻿/, '');
  loadQuestTables(sources);
}
const BARE_SRC = ['Quest: __QRP', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'variable _done_'];
const sym = (name) => ({ name, original: `_${name}_`, clone() { return sym(name); } });

/** One running quest with a Place `pub` (a building, two spawn markers and an item marker), and whatever resources
 *  and completed actions a case adds. */
function world() {
  const m = new QuestMachine();
  const quest = m.parseQuestForLists(BARE_SRC, 0, { rolls: () => 0 });
  m.startQuestImmediate(quest);
  const pub = new Place(quest);
  pub.symbol = sym('pub');
  const marker = (id) => ({ dungeonX: 0, dungeonZ: 0, flatPosition: { x: id, y: 0, z: 0 }, markerID: id, targetResources: null });
  pub.siteDetails = { siteType: SITE_TYPES.Building, mapId: 4242, buildingKey: 77, magicNumberIndex: 0, regionName: 'Daggerfall', locationName: 'Daggerfall', selectedMarker: { targetResources: null }, questSpawnMarkers: [marker(1), marker(2)], questItemMarkers: [marker(3)] };
  pub.isPlayerHere = () => false;
  pub._range = () => 0;
  quest.resources.set('pub', pub);
  // a Place the quest holds nothing at: never linked
  const inn = new Place(quest);
  inn.symbol = sym('inn');
  inn.siteDetails = { ...pub.siteDetails, buildingKey: 99, selectedMarker: { targetResources: null }, questSpawnMarkers: [marker(5)], questItemMarkers: null };
  inn.isPlayerHere = () => false;
  quest.resources.set('inn', inn);
  const actions = [];
  quest.tasks.set('_fix_', { actions });
  const add = (name, over) => { const r = { symbol: sym(name), parentQuest: quest, questResourceBehaviour: null, ...over }; quest.resources.set(name, r); return r; };
  const act = (a) => { actions.push({ isComplete: true, ...a }); };
  return { m, quest, pub, add, act, actions };
}

test('QREPAIR the pass: a placement no marker holds is made again at the Place its completed action names; a (quest, Place) holding targets gets its own link; every reveal that ran is filed again; a quest with no topics gets them; the current site mounts by name; progress is untouched; and the line says what it did (mutants: the lost placement left; a link per site not per quest; the reveal skipped; the topics re-added over a quest that has them; the mount by identity)', () => {
  const w = world();
  const npc = w.add('npc', { isPerson: true, isHidden: false });
  w.act({ typeName: 'PlaceNpc', npcSymbol: sym('npc'), placeSymbol: sym('pub'), marker: -1 });
  w.act({ typeName: 'RevealLocation', placeSymbol: sym('pub') });
  const before = w.actions.map((a) => a.isComplete);
  assert.deepEqual([...targetedNames(w.quest)], [], 'a resync took the target: nothing holds the npc');
  const said = { reveal: [], topics: 0, mounts: [] };
  let has = false;
  const env = {
    discoverLocation: (region, location) => { said.reveal.push([region, location]); return said.reveal.length === 1; },
    hasQuestTopics: () => has,
    addQuestTopics: () => { said.topics++; has = true; },
    mountCurrentSite: () => { said.mounts.push(w.m.mountByName); },
  };
  const r = repairActiveQuests(w.m, env);
  assert.deepEqual(w.pub.siteDetails.selectedMarker.targetResources.map((s) => s.name), ['npc'], 'the npc stands at the pub again');
  assert.equal(r.people, 1);
  assert.equal(r.relinked, 1, 'the quest\'s own link to the pub - and none to the inn, which holds nothing');
  assert.ok(w.m.siteLinks.some((l) => l.questUID === w.quest.uid && l.placeSymbol.name === 'pub' && l.mapId === 4242 && l.buildingKey === 77));
  assert.deepEqual(said.reveal, [['Daggerfall', 'Daggerfall']], 'the reveal, filed again');
  assert.equal(r.revealed, 1, 'counted when it was new');
  assert.equal(said.topics, 1, 'a quest the talk never heard of gets its topics');
  assert.deepEqual(said.mounts, [true], 'the site mounted once, by name');
  assert.equal(w.m.mountByName, false, 'and the flag is down after');
  assert.deepEqual(w.actions.map((a) => a.isComplete), before, 'no action\'s progress moved');
  assert.equal(npc.isHidden, false, 'nothing unhidden that was not hidden');
  assert.equal(r.text, 'Quests repaired: put back 1 person; reconnected 1 place; marked 1 location on your map; restored what people know about 1 quest.');
  // a second pass finds nothing - nothing twice
  const again = repairActiveQuests(w.m, env);
  assert.deepEqual([again.people, again.items, again.foes, again.relinked, again.revealed, again.topics], [0, 0, 0, 0, 0, 0]);
  assert.equal(said.topics, 1, 'the topics are not re-added (that un-discovers residences)');
  assert.equal(w.m.siteLinks.filter((l) => l.questUID === w.quest.uid).length, 1, 'one link, not two');
  assert.equal(again.text, 'Nothing was missing from your active quest.');
});

test('QREPAIR never undoes the quest: a destroyed or at-home person, an item picked up, carried, dropped, the player\'s own or given to a foe, a foe all dead or removed, a hidden person placed but kept hidden, a resource two Places disagree about, a placement not yet run, a quest finished - none moved; a Person\'s last-assigned Place settles two (mutants: each skip dropped; the ambiguous placed; the unhide)', () => {
  const w = world();
  const bar = new Place(w.quest);
  bar.symbol = sym('bar');
  bar.siteDetails = { ...w.pub.siteDetails, buildingKey: 88, selectedMarker: { targetResources: null }, questSpawnMarkers: [{ dungeonX: 0, dungeonZ: 0, flatPosition: { x: 9, y: 0, z: 0 }, markerID: 9, targetResources: null }] };
  bar.isPlayerHere = () => false;
  bar._range = () => 0;
  w.quest.resources.set('bar', bar);
  const at = (name, type, field, place = 'pub') => w.act({ typeName: type, [field]: sym(name), placeSymbol: sym(place), marker: -1 });
  const P = (name, over = {}) => { w.add(name, { isPerson: true, ...over }); at(name, 'PlaceNpc', 'npcSymbol'); };
  const I = (name, over = {}) => { w.add(name, { isItem: true, ...over }); at(name, 'PlaceItem', 'itemSymbol'); };
  const F = (name, over = {}) => { w.add(name, { isFoe: true, spawnCount: 1, killCount: 0, ...over }); at(name, 'PlaceFoe', 'foeSymbol'); };
  P('dead', { isDestroyed: true });
  P('home', { isIndividualNPC: true, isIndividualAtHome: true });
  P('shy', { isHidden: true });
  I('taken', { isHidden: true });
  I('mine', { madePermanent: true });
  I('dropped', { playerDropped: true });
  I('carried');
  const gift = { id: 'df-gift' };
  I('gift', { daggerfallUnityItem: gift });
  w.add('keeper', { isFoe: true, spawnCount: 1, killCount: 1, itemQueue: [gift] });
  F('slain', { killCount: 1 });
  F('gone', { isHidden: true });
  // two Places for one item, nothing to settle it: left alone
  w.add('torn', { isItem: true });
  at('torn', 'PlaceItem', 'itemSymbol', 'pub'); at('torn', 'PlaceItem', 'itemSymbol', 'bar');
  // a person moved to the bar - the last-assigned Place settles it
  w.add('mover', { isPerson: true, assignedPlaceSymbol: sym('bar') });
  at('mover', 'PlaceNpc', 'npcSymbol', 'pub'); at('mover', 'PlaceNpc', 'npcSymbol', 'bar');
  // a placement not yet run
  w.add('later', { isPerson: true });
  w.actions.push({ typeName: 'PlaceNpc', npcSymbol: sym('later'), placeSymbol: sym('pub'), marker: -1, isComplete: false });
  const env = { carriesQuestItem: (it) => it.symbol.name === 'carried' };
  assert.equal(placementIntents(w.quest).get('torn').ambiguous, true);
  const r = repairActiveQuests(w.m, env);
  const at_ = (place) => [...(place.siteDetails.selectedMarker.targetResources ?? []), ...place.siteDetails.questSpawnMarkers.flatMap((m) => m.targetResources ?? [])].map((s) => s.name).sort();
  assert.deepEqual(at_(w.pub), ['shy'], 'only the hidden person goes back - placed, and still hidden');
  assert.equal(w.quest.getResource(sym('shy')).isHidden, true, 'the repair is not the action\'s unhide');
  assert.deepEqual(at_(bar), ['mover'], 'the mover stands where they were last assigned');
  assert.deepEqual([r.people, r.items, r.foes], [2, 0, 0]);
  for (const n of ['dead', 'home', 'taken', 'mine', 'dropped', 'carried', 'gift', 'slain', 'gone', 'torn', 'later']) {
    assert.equal(goneOnPurpose(w.quest.getResource(sym(n)), w.quest, env) || n === 'torn' || n === 'later', true, `${n} is left alone`);
  }
  // a finished quest is not repaired; no running quest says so
  w.quest.questComplete = true;
  const none = repairActiveQuests(w.m, env);
  assert.equal(none.quests, 0);
  assert.equal(none.text, 'You have no active quests to repair.');
  assert.equal(questRepairText({ quests: 2, people: 0, items: 3, foes: 1, relinked: 0, revealed: 0, topics: 0, failed: 1 }),
    'Quests repaired: put back 3 items, 1 foe. 1 part could not be checked.');
  assert.equal(questRepairText({ quests: 3, people: 0, items: 0, foes: 0, relinked: 0, revealed: 0, topics: 0, failed: 0 }), 'Nothing was missing from your 3 active quests.');
});

test('QREPAIR THE SHARED SITE: a second quest placing where a first already had a link leaned on the first\'s (hasSiteLink asks the SITE, not the quest) - the repair gives it its own, so the first ending cannot strand it (mutants: the site\'s link counted as the quest\'s)', () => {
  const w = world();
  w.add('npc', { isPerson: true, isHidden: false });
  w.act({ typeName: 'PlaceNpc', npcSymbol: sym('npc'), placeSymbol: sym('pub'), marker: -1 });
  w.pub.siteDetails.selectedMarker = { ...w.pub.siteDetails.questSpawnMarkers[0], targetResources: [sym('npc')] };   // placed, and held
  // the FIRST quest's link to the same building
  w.m.addSiteLink({ questUID: 999999, placeSymbol: sym('hall'), siteType: SITE_TYPES.Building, mapId: 4242, buildingKey: 77, magicNumberIndex: 0 });
  assert.equal(w.m.hasSiteLink(w.quest, sym('pub')), true, 'DFU\'s own question answers yes - the site has a link');
  const r = repairActiveQuests(w.m, {});
  assert.equal(r.people, 0, 'the npc was held - nothing to put back');
  assert.equal(r.relinked, 1, 'but the quest gets its OWN link');
  assert.ok(w.m.siteLinks.some((l) => l.questUID === w.quest.uid && l.placeSymbol.name === 'pub'));
});

test('QREPAIR a Place that cannot take the placement (no markers at all) is counted, not fatal: the rest of the pass runs; an unresolvable reveal likewise (mutants: one throw ends the pass)', () => {
  const w = world();
  w.pub.siteDetails.questSpawnMarkers = null;
  w.pub.siteDetails.questItemMarkers = null;
  w.add('npc', { isPerson: true });
  w.act({ typeName: 'PlaceNpc', npcSymbol: sym('npc'), placeSymbol: sym('pub'), marker: -1 });
  w.act({ typeName: 'RevealLocation', placeSymbol: sym('pub') });
  let mounted = 0, topics = 0;
  const r = repairActiveQuests(w.m, { discoverLocation: () => { throw new Error('Error finding location'); }, mountCurrentSite: () => { mounted++; }, hasQuestTopics: () => false, addQuestTopics: () => { topics++; } });
  assert.equal(r.people, 0);
  assert.equal(r.failed, 2, 'the placement and the reveal, each counted');
  assert.equal(topics, 1, 'the quest\'s own later step still ran - a failed reveal is that reveal, not the quest');
  assert.equal(mounted, 1, 'and the pass went on to the mount');
  assert.match(r.text, /2 parts could not be checked\./);
});

test('QREPAIR the by-name mount: a behaviour restored from a save holds a DIFFERENT symbol object - the identity match misses it and DFU\'s mount stands a duplicate; the repair\'s pass (machine.mountByName) matches the quest and the name; a different quest\'s same name is not a match (mutants: by name always; by name never; the quest unread)', () => {
  const w = world();
  const foe = w.add('rat', { isFoe: true });
  const b = new QuestResourceBehaviour(w.m, null);
  b.assignResource(foe);
  b.targetSymbol = { name: 'rat', original: '_rat_' };   // the restored, deserialized symbol
  assert.equal(isAlreadyInjected([b], foe), false, 'DFU\'s identity match: the kept load hole');
  assert.equal(isAlreadyInjected([b], foe, true), true, 'by name, the same foe');
  const other = world();
  const b2 = new QuestResourceBehaviour(other.m, null);
  b2.assignResource(other.add('rat', { isFoe: true }));
  b2.targetSymbol = { name: 'rat', original: '_rat_' };
  assert.equal(isAlreadyInjected([b2], foe, true), false, 'another quest\'s _rat_ is another foe');
  const sm = rd('src/systems/quest/sceneMount.js');
  assert.match(sm, /\{ enableNPCs = true, enableFoes = true, enableItems = true, byName = !!machine\?\.mountByName \} = \{\}/, 'the pass\'s flag reaches every mount it runs, the hot-place included');
});

test('QREPAIR the door, by source: every host\'s pause hands repairQuests off its own bridge (the world, the fixed city, the dungeon, and the interior pause through its host); the bridge runs the pass over the host\'s world seams; the world\'s talk says which quests have topics; a reveal answers whether it was new; the Settings row is the pause\'s, confirmed first, greyed on the front door with where it lives (mutants: a host without the hook; the row live at the door; no confirm)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /questLog: \(\) => questBridge\?\.questLog\(\) \?\? \{ active: \[\], finished: \[\] \},\n\s+repairQuests: \(\) => questBridge\?\.repair\?\.\(\) \?\? null,/, 'the world pause');
  assert.match(w, /pauseQuestLog: \(\) => questBridge\?\.questLog\(\) \?\? \{ active: \[\], finished: \[\] \},\n\s+repairQuests: \(\) => questBridge\?\.repair\?\.\(\) \?\? null,/, 'the world\'s host bag, for the interior pause');
  assert.match(w, /hasQuestTopics: \(quest\) => topicTree\.dictQuestInfo\.has\(quest\.uid\),/);
  assert.match(w, /return discoverLocation\(loc\.mapTableData\.mapId, \{ regionName: loc\.regionName, locationName: loc\.name \}\);/);
  const x = rd('src/scenes/exterior.js');
  assert.equal((x.match(/repairQuests: \(\) => questBridge\?\.repair\?\.\(\) \?\? null,/g) ?? []).length, 2, 'the fixed city: its pause and its host bag');
  assert.match(x, /return discoverLocation\(l\.mapTableData\.mapId, \{ regionName: l\.regionName, locationName: l\.name \}\);/);
  assert.match(rd('src/scenes/dungeonContext.js'), /repairQuests: \(\) => opts\.questBridge\?\.repair\?\.\(\) \?\? null,/, 'the dungeon');
  assert.match(rd('src/scenes/worldModes.js'), /repairQuests: \(\) => host\.repairQuests\?\.\(\) \?\? null,/, 'the interior pause');
  const qb = rd('src/scenes/questBridge.js');
  assert.match(qb, /repair\(\) \{\n\s+const world = ctx\.world \?\? null;\n\s+return repairActiveQuests\(machine, \{/);
  assert.match(qb, /mountCurrentSite: \(\) => world\?\.mountCurrentSiteQuestResources\?\.\(\),/);
  const menu = rd('src/ui/enhancedMenu.js');
  assert.match(menu, /if \(catId === 'game'\) return portRowsGame\(opts\);/);
  assert.match(menu, /const can = pause && typeof hooks\?\.repairQuests === 'function';/, 'live only in a game\'s pause');
  assert.match(menu, /ask\('Repair Active Quests', QUEST_REPAIR_ASK, 'Repair', \(\) => \{/, 'confirmed first');
  assert.match(menu, /main\.append\(el\('div', 'row-note', can \? \(questRepairSaid \?\? QUEST_REPAIR_NOTE\) : QUEST_REPAIR_AWAY\)\);/, 'the door\'s row says where it lives');
  assert.match(menu, /const liveCount = \(catId\) => portRows\(catId\)\.filter\(\(r\) => r\.dataset\?\.live !== '0'\)\.length/, 'and a greyed row is not counted as working');
});
