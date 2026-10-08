// QUEST-SHELF (2026-10-08, Mac: "All quests should be able to be abandoned and reclaimed"; bible/06-Systems/Quest-Arc.md
// QUEST-SHELF). Abandon SETS A QUEST ASIDE, KEPT WHOLE (quest/machine.js shelveQuest): it stops running, its clocks stop,
// its questor's door opens, its site links are set aside by Place, a named NPC it held is home, a shared copy leaves the
// party's step - and it is never tombstoned (its items, topics and journal stay its own). Reclaim brings it back as it
// was (reclaimQuest): its own clock's stamps moved on by the time it was away (TIME3's law), its links standing again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { isShelved } from '../src/systems/quest/quest.js';
import { QuestResourceBehaviour } from '../src/systems/quest/resourceBehaviour.js';
import { QUEST_OWN_SECOND_KEYS } from '../src/systems/quest/questStamps.js';
import { canReceiveSharedQuest } from '../src/systems/questShare.js';
import { questRail } from '../src/ui/questRail.js';
import { shelfRefusalText } from '../src/scenes/questBridge.js';
import { questEnded } from '../src/systems/questGuidance.js';
import { mapPixelToWorldCoord, mapPixelToLongitudeLatitude } from '../src/formats/mapsFile.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const HOME = { x: 100, y: 100 };
const lair = { position: 9000, rdbBlock: { objectRootList: [{ rdbObjects: [11, 18].map((record, i) => ({ type: 3, position: 100 + i * 8, xPos: 10, yPos: 4, zPos: 20, resources: { flatResource: { textureArchive: 199, textureRecord: record } } })) }] } };
function makeWorld() {
  const all = [{ kind: 'town', dx: 0 }, { kind: 'dungeon', dx: 3 }, { kind: 'dungeon', dx: 5 }];
  const locations = all.map((s, index) => {
    const pixel = { x: HOME.x + s.dx, y: HOME.y };
    const wc = mapPixelToWorldCoord(pixel.x, pixel.y);
    const ll = mapPixelToLongitudeLatitude(pixel.x, pixel.y);
    const dungeon = s.kind === 'dungeon';
    return {
      loaded: true, regionIndex: 0, regionName: 'Testshire', name: `${s.kind}${s.dx}`, locationIndex: index, hasDungeon: dungeon,
      mapTableData: { mapId: 5000 + index, locationType: dungeon ? 7 : 0, dungeonType: dungeon ? 2 : -1, longitude: ll.x, latitude: ll.y },
      exterior: { buildings: [], recordElement: { header: { x: wc.x, y: wc.y } }, exteriorData: { locationId: 0x500 + index, width: 0, height: 0, blockNames: [] } },
      dungeon: dungeon ? { blocks: [{ x: 0, z: 0, blockName: 'LAIRAA00.RDB' }] } : null,
    };
  });
  const region = { name: 'Testshire', locationCount: locations.length, mapTable: locations.map((l) => ({ ...l.mapTableData })) };
  return {
    maps: { regionCount: 1, getRegion: () => region, getLocation: (r, l) => locations[l] ?? null, getLocationByName: (rn, ln) => locations.find((l) => l.name === ln) ?? null, readLocationIdFast: (r, l) => locations[l].exterior.exteriorData.locationId, getClimateIndex: () => 231 },
    getBlock: (name) => (name === 'LAIRAA00.RDB' ? lair : null),
    currentLocation: () => locations[0], currentRegionIndex: () => 0, currentLocationIndex: () => 0, currentRegionName: () => 'Testshire',
    isPlayerInLocationRect: () => true, playerInside: () => null, isHouseOwned: () => false, playerPixel: () => ({ ...HOME }), buildingNameOpts: () => ({}),
    discoverLocation: () => {}, addNote: () => {},
  };
}
const DAY = 86400;
function rig() {
  let now = 0, topics = 0;
  const world = makeWorld();
  const m = new QuestMachine({ nowSeconds: () => now, world, playerLevel: () => 1, forceTopicListsUpdate: () => { topics++; } });
  const q = m.scheduleQuest(['Quest: __QS', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Place _lair_ remote dungeon', '', 'Clock _c_ 2.00:00', '', 'Foe _f_ is Giant_rat', '',
    ' start timer _c_', ' place foe _f_ at _lair_', ' log 1011 step 0'], 0, { rolls: () => 0.5 });
  m.tick(); m.tick();
  return { m, q, world, at: (t) => { now = t; }, topics: () => topics, clock: () => q.getResource({ name: 'c' }) };
}

test('QUEST-SHELF abandon sets the quest aside, kept: no tick (its clock stops where it stands), no site link (each Place\'s name kept), no journal line on the active page, no share, out of the party\'s step, topics asked again - and never a tombstone; refused gone, ending, twice, protected or by the host\'s word (mutants: the tick, the links, the clock, the share, the refusals)', () => {
  const r = rig();
  r.at(3600); r.m.tick();
  const left = r.clock().remainingTimeInSeconds;
  assert.equal(left, 2 * DAY - 3600, 'the clock ran an hour');
  assert.ok(r.m.siteLinks.some((l) => l.questUID === r.q.uid), 'its link stood');
  r.m.sharedQuestNames.add(r.q.questName);
  assert.equal(r.m.getAllQuestLogMessages().includes(r.q.getMessage(1011)), true, 'running: on the journal\'s active page');
  const before = r.topics();
  const out = r.m.shelveQuest(r.q.uid);
  assert.equal(out.ok, true);
  assert.equal(isShelved(r.q), true);
  assert.equal(r.q.shelvedAt, 3600);
  assert.deepEqual(r.q.shelvedSites, ['lair'], 'the Place it held a link for, by name');
  assert.equal(r.m.siteLinks.some((l) => l.questUID === r.q.uid), false, 'its links set aside');
  assert.equal(r.m.sharedQuestNames.has(r.q.questName), false, 'out of the party\'s step');
  assert.ok(r.topics() > before, 'the topic lists asked again');
  assert.equal(r.q.questTombstoned, false, 'never a tombstone');
  assert.equal(r.m.getShareableQuestData(r.q.uid), null, 'not handed on');
  assert.equal(r.m.getAllQuestLogMessages().includes(r.q.getMessage(1011)), false, 'off the journal\'s active page');
  // five days pass: nothing of it runs
  r.at(3600 + 5 * DAY); r.m.tick(); r.m.tick();
  assert.equal(r.clock().remainingTimeInSeconds, left, 'its clock stood still');
  assert.equal(r.q.questComplete, false);
  // refusals
  assert.deepEqual(r.m.shelveQuest(r.q.uid), { ok: false, reason: 'shelved' });
  assert.deepEqual(r.m.shelveQuest(424242), { ok: false, reason: 'gone' });
  const r2 = rig();
  r2.q.ticksToEnd = 2;
  assert.deepEqual(r2.m.shelveQuest(r2.q.uid), { ok: false, reason: 'ending' });
  r2.q.ticksToEnd = 0;
  assert.deepEqual(r2.m.shelveQuest(r2.q.uid, { refuse: () => 'raid' }), { ok: false, reason: 'raid' });
  r2.q.questName = 'S0000977';
  assert.deepEqual(r2.m.shelveQuest(r2.q.uid), { ok: false, reason: 'protected' }, 'the world\'s own quest');
  r2.q.questName = 's0000999';
  assert.deepEqual(r2.m.shelveQuest(r2.q.uid), { ok: false, reason: 'protected' }, 'the main quest\'s backbone, its case its own');
  r2.q.questComplete = true;
  assert.deepEqual(r2.m.shelveQuest(r2.q.uid), { ok: false, reason: 'gone' });
});

test('QUEST-SHELF reclaim brings it back as it was: its clock charged nothing for the days away and runs again from the reclaim, its link standing again on its own Place, in the save between (mutants: the shift, the link, the stamp key, the save)', () => {
  const r = rig();
  r.at(3600); r.m.tick();
  const left = r.clock().remainingTimeInSeconds;
  r.m.shelveQuest(r.q.uid);
  // a save between: the set-aside quest round-trips whole
  const saved = JSON.parse(JSON.stringify(r.m.getSaveData()));
  const m2 = new QuestMachine({ nowSeconds: () => 3600 + 6 * DAY, world: r.world, playerLevel: () => 1 });
  m2.restoreSaveData(saved);
  const q2 = m2.getQuest(r.q.uid);
  assert.equal(q2.shelvedAt, 3600);
  assert.deepEqual(q2.shelvedSites, ['lair']);
  assert.equal(m2.siteLinks.some((l) => l.questUID === q2.uid), false);
  m2.tick();
  assert.equal(q2.getResource({ name: 'c' }).remainingTimeInSeconds, left, 'loaded set aside: still standing');
  // reclaimed six days later
  const back = m2.reclaimQuest(q2.uid);
  assert.equal(back.ok, true);
  assert.equal(isShelved(q2), false);
  assert.equal(q2.shelvedSites, null);
  assert.ok(m2.siteLinks.some((l) => l.questUID === q2.uid && l.placeSymbol?.name === 'lair'), 'its link stands again');
  m2.tick();
  assert.equal(q2.getResource({ name: 'c' }).remainingTimeInSeconds, left, 'nothing charged for the days away');
  m2.deps.nowSeconds = () => 3600 + 6 * DAY + 600;
  m2.tick();
  assert.equal(q2.getResource({ name: 'c' }).remainingTimeInSeconds, left - 600, 'and it runs again from the reclaim');
  assert.deepEqual(m2.reclaimQuest(q2.uid), { ok: false, reason: 'running' });
  // the stamp moves with the character's own clock (TIME3's envelopes)
  assert.ok(QUEST_OWN_SECOND_KEYS.includes('shelvedAt'));
});

test('QUEST-SHELF in the world: its questor\'s door opens and a click on them is no quest\'s; a named NPC it held is home; its placed people and things are put out of sight each frame while its questor stands and its foes stand and still count; a partner\'s share or step is refused quietly; guidance marks nothing of it (mutants: the door, the faction persons, the click, the hide, the share refusal)', () => {
  const r = rig();
  const person = { isPerson: true, isQuestor: true, symbol: { name: 'qg' }, questorData: { nameSeed: 7, mapID: 1, buildingKey: 9, hash: 3 }, factionId: 500, setPlayerClicked() { this.clicked = true; } };
  r.q.resources.set('qg', person);
  r.q.questors.set('qg', { symbol: person.symbol, name: 'The Guildmaster' });
  r.m.setLastNPCClicked(person.questorData);
  assert.equal(r.m.isLastNPCClickedAnActiveQuestor(), true, 'running: the door is the quest\'s');
  assert.equal(r.m.activeQuestor(person.questorData), person, 'running: the questor is the quest\'s');
  assert.equal(r.m.activeFactionPersons(500).includes(person), true);
  r.m.shelveQuest(r.q.uid);
  person.clicked = false;
  r.m.setLastNPCClicked(person.questorData);
  assert.equal(person.clicked, false, 'set aside: no click heard');
  assert.equal(r.m.isLastNPCClickedAnActiveQuestor(), false, 'the door open - the guild offers work again');
  assert.equal(r.m.activeFactionPersons(500).includes(person), false, 'a named NPC home');
  assert.equal(r.m.activeQuestor(person.questorData), null);
  // the scene's behaviours
  const shown = [];
  const host = { setActive: (a) => shown.push(a) };
  const item = new QuestResourceBehaviour(r.m, host);
  item.targetQuest = r.q; item.targetResource = { isItem: true, symbol: { name: 'it' } }; item.questUID = r.q.uid; item.relinkToLiveQuest = () => false;
  item.update();
  assert.deepEqual(shown, [false], 'its thing out of sight');
  assert.equal(item.doClick(), false, 'a click falls through');
  shown.length = 0;
  const qgb = new QuestResourceBehaviour(r.m, host);
  qgb.targetQuest = r.q; qgb.targetResource = person; qgb.relinkToLiveQuest = () => false;
  qgb.update();
  assert.deepEqual(shown, [true], 'its questor stands');
  assert.equal(questEnded(item), true, 'guidance marks nothing of it');
  r.q.resources.delete('qg');   // the hand-made questor out before the envelopes below are taken
  r.q.questors.delete('qg');
  // a partner's share or step
  const lists = { findQuestMeta: () => null, hasAcceptedOneTime: () => false };
  assert.deepEqual(canReceiveSharedQuest(r.m, lists, r.q.questName, {}), { ok: false, reason: 'shelved' });
  const step = r.q.getSaveData();
  assert.equal(r.m.updateSharedQuest(r.q.questName, step), null, 'no step taken');
  assert.equal(isShelved(r.q), true, 'still set aside');
  assert.match(src('src/scenes/world.js'), /if \(result\.reason === 'shelved'\) return;/, 'said nothing');
  // reclaimed: running again, its share once more possible
  assert.equal(r.m.reclaimQuest(r.q.uid).ok, true);
  assert.ok(r.m.getShareableQuestData(r.q.uid), 'shareable again');
});

test('QUEST-SHELF the journal: the walk hands the quests set aside, their clocks frozen; the rail files them under Abandoned beside the running ones; the pause tab draws Abandon (twice) where the bridge allows it and Reclaim (once) - in every host that hands journalClean - and the classic logbook leaves them out (mutants: the list, the rail, the buttons, the words)', () => {
  const log = { active: [], finished: [], shelved: [{ id: '7', name: 'The Rat', questName: 'S0000123', clockSeconds: 1234, messages: [] }] };
  const rail = questRail(log);
  assert.deepEqual(rail.shelved.map((q) => [q.key, q.id, q.name, q.clockSeconds]), [['s:7', '7', 'The Rat', 1234]]);
  assert.deepEqual(questRail({ ...log, hidden: ['9'] }).shelved.map((q) => q.key), ['s:7'], 'with hidden quests too');
  assert.deepEqual(['gone', 'shelved', 'running', 'ending', 'protected', 'raid', 'x'].map(shelfRefusalText), [
    'That quest is over.', 'That quest is already abandoned.', 'That quest is not abandoned.', 'That quest is ending.',
    'That quest cannot be abandoned.', 'Not while the raid is on.', 'That cannot be done now.']);
  const bridge = src('src/scenes/questBridge.js');
  assert.match(bridge, /return \{ active, finished: notebook\?\.getFinishedQuests\(\) \?\? \[\], ended, hidden: notebook\?\.getHiddenQuests\?\.\(\) \?\? \[\], shelved \};/);
  assert.match(bridge, /const r = machine\.shelveQuest\(Number\(id\), \{ refuse: \(q\) => \(WA_RAID_QUESTS\.includes\(q\.questName\) \? 'raid' : null\) \}\);/);
  assert.match(bridge, /if \(!q \|\| q\.questComplete \|\| isShelved\(q\)\) questTracker\.pinned = null;/, 'the tracker lets it go');
  const menu = src('src/ui/enhancedMenu.js');
  assert.match(menu, /if \(shelved\.length\) section\('Abandoned', shelved, ' done'\);/);
  assert.match(menu, /const ab = el\('button', 'act', armed \? 'Click again to abandon' : 'Abandon quest'\);/);
  assert.match(menu, /} else if \(sel\.entries && sel\.id != null && clean\.abandon && clean\.canAbandon\?\.\(sel\.id\)\) \{/);
  assert.match(menu, /const rc = el\('button', 'act', 'Reclaim quest'\);/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js']) assert.match(src(f), /journalClean: \(\) => /, `${f} hands journalClean`);
  // the topic lists, the hosts' live quest ids
  assert.equal((src('src/systems/topicTree.js').match(/if \(shelvedQuestInfo\(questInfo\)\) continue;/g) ?? []).length, 3);
  assert.match(src('src/scenes/world.js'), /\.filter\(\(q\) => !q\.questTombstoned && q\.shelvedAt == null\)\.map\(\(q\) => q\.uid\);/);
});
