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
import { canReceiveSharedQuest, shareRefusalText } from '../src/systems/questShare.js';
import { shelvedRail } from '../src/ui/questRail.js';
import { QuestLens } from '../src/ui/questLens.js';
import { RumorMill, RUMOR_TYPE } from '../src/systems/rumorMill.js';
import { repairActiveQuests } from '../src/systems/quest/questRepair.js';
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
const QS_LINES = ['Quest: __QS', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Place _lair_ remote dungeon', '', 'Clock _c_ 2.00:00', '', 'Foe _f_ is Giant_rat', '',
  ' start timer _c_', ' place foe _f_ at _lair_', ' log 1011 step 0'];
function rig() {
  let now = 0, topics = 0;
  const world = makeWorld();
  const m = new QuestMachine({ nowSeconds: () => now, world, playerLevel: () => 1, forceTopicListsUpdate: () => { topics++; } });
  const q = m.scheduleQuest(QS_LINES, 0, { rolls: () => 0.5 });
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
  assert.match(src('src/scenes/world.js'), /if \(result\.reason === 'shelved' && quest\.data\?\.sync === 1\) return;/, 'a sync said nothing');
  assert.equal(shareRefusalText({ reason: 'shelved' }), 'have abandoned it - reclaim it from your journal to take it up again.', 'a deliberate share is answered');
  // reclaimed: running again, its share once more possible
  assert.equal(r.m.reclaimQuest(r.q.uid).ok, true);
  assert.ok(r.m.getShareableQuestData(r.q.uid), 'shareable again');
});

test('QUEST-SHELF the journal: the walk hands the quests set aside, their clocks frozen; the rail files them under Abandoned beside the running ones; the pause tab draws Abandon (twice) where the bridge allows it and Reclaim (once) - in every host that hands journalClean - and the classic logbook leaves them out (mutants: the list, the rail, the buttons, the words)', () => {
  const log = { active: [], finished: [], shelved: [{ id: '7', name: 'The Rat', questName: 'S0000123', clockSeconds: 1234, messages: [] }] };
  assert.deepEqual(shelvedRail(log).map((q) => [q.key, q.id, q.name, q.clockSeconds]), [['s:7', '7', 'The Rat', 1234]]);
  // its audit: its entries in the order they were WRITTEN (GUIDE1's law) - a step re-logged after a later one is the latest
  const said = (t) => [{ formatting: 'text', text: t }];
  const relogged = { ...log.shelved[0], messages: [said('first'), said('second')], steps: [{ time: 30 }, { time: 20 }] };
  assert.deepEqual(shelvedRail({ shelved: [relogged] })[0].entries.map((e) => e.join(' ')), ['second', 'first']);
  assert.deepEqual(['gone', 'shelved', 'running', 'ending', 'protected', 'raid', 'twin', 'x'].map(shelfRefusalText), [
    'That quest is over.', 'That quest is already abandoned.', 'That quest is not abandoned.', 'That quest is ending.',
    'That quest cannot be abandoned.', 'Not while the raid is on.', 'You have taken that quest up again - finish or abandon it first.', 'That cannot be done now.']);
  const bridge = src('src/scenes/questBridge.js');
  assert.match(bridge, /return \{ active, finished: notebook\?\.getFinishedQuests\(\) \?\? \[\], ended, hidden: notebook\?\.getHiddenQuests\?\.\(\) \?\? \[\], shelved \};/);
  assert.match(bridge, /const refuseRaid = \(q\) => \(WA_RAID_QUESTS\.includes\(q\.questName\) \? 'raid' : null\);/);
  assert.match(bridge, /const r = machine\.shelveQuest\(Number\(id\), \{ refuse: refuseRaid \}\);/);
  assert.match(bridge, /canAbandon: \(id\) => machine\.shelveRefusal\(Number\(id\), \{ refuse: refuseRaid \}\) === null,/, 'the button asks the press\'s own ladder');
  assert.match(bridge, /if \(r\.ok\) notebook\?\.unhideQuest\?\.\(id\);/, 'a reclaimed quest the player had hidden is on the page again');
  assert.match(bridge, /if \(!q \|\| q\.questComplete \|\| isShelved\(q\)\) questTracker\.pinned = null;/, 'the tracker lets it go');
  const menu = src('src/ui/enhancedMenu.js');
  assert.match(menu, /if \(shelved\.length\) section\('Abandoned', shelved, ' done'\);/);
  assert.match(menu, /const ab = el\('button', 'act', armed \? 'Click again to abandon' : 'Abandon quest'\);/);
  assert.match(menu, /} else if \(sel\.entries && sel\.id != null && clean\.abandon && clean\.canAbandon\?\.\(sel\.id\)\) \{/);
  assert.match(menu, /const rc = el\('button', 'act', 'Reclaim quest'\);/);
  // its audit: the selection follows the quest only where it went
  assert.match(menu, /const out = clean\.reclaim\(sel\.id\); questShelfSaid = out\?\.text \?\? null; if \(out\?\.ok\) questSel = `a:\$\{sel\.id\}`;/);
  assert.match(menu, /if \(out\?\.ok\) questSel = `s:\$\{sel\.id\}`;/);
  assert.match(menu, /const shelved = shelvedRail\(log\);/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js', 'src/scenes/worldModes.js']) assert.match(src(f), /journalClean: \(\) => /, `${f} hands journalClean`);
  // the topic lists, the hosts' live quest ids
  assert.equal((src('src/systems/topicTree.js').match(/if \(isShelved\(this\.deps\.getQuest\?\.\(questID\)\)\) continue;/g) ?? []).length, 3, 'by the quest itself');
  assert.match(src('src/scenes/world.js'), /\.filter\(\(q\) => !q\.questTombstoned && !isShelved\(q\)\)\.map\(\(q\) => q\.uid\);/);
});

test('QUEST-SHELF\'s audit: the same quest taken again runs ahead of the copy set aside (its syncs, a partner\'s step), and that copy\'s reclaim is refused while it runs; a reclaim relinks what stands of it and its topics at once; a named NPC\'s home copy stays and its click still reaches the running quests; a partner\'s envelope carries no shelf; the repair, the rumor mill and the lens leave a quest set aside alone (mutants: each)', () => {
  // taken again from the guild whose door the abandon opened
  const r = rig();
  r.m.sharedQuestNames.add(r.q.questName);
  r.m.shelveQuest(r.q.uid);
  const again = r.m.scheduleQuest(QS_LINES, 0, { rolls: () => 0.5 });
  r.m.tick(); r.m.tick();
  assert.equal(r.m.sharedCandidateNamed(r.q.questName), again, 'a share by its name speaks to the running copy');
  const lists = { findQuestMeta: () => null, hasAcceptedOneTime: () => false };
  assert.deepEqual(canReceiveSharedQuest(r.m, lists, r.q.questName, {}), { ok: false, reason: 'active' }, 'the running copy answers, not the one set aside');
  assert.deepEqual(r.m.reclaimQuest(r.q.uid), { ok: false, reason: 'twin' });
  assert.equal(isShelved(r.q), true);
  // two running copies (a quest taken twice): setting one aside leaves the step to the copy a share speaks to
  const t = rig();
  const t2 = t.m.scheduleQuest(QS_LINES, 0, { rolls: () => 0.5 });
  t.m.sharedQuestNames.add(t.q.questName);
  t.m.tick(); t.m.tick();
  assert.deepEqual(t.m.shelveQuest(t2.uid), { ok: true, quest: t2 });
  assert.equal(t.m.sharedQuestNames.has(t.q.questName), true, 'the running copy keeps the party\'s step');
  // and a copy set aside alone still answers for its name; two set aside, either is reclaimed (no copy runs)
  const solo = rig();
  const solo2 = solo.m.scheduleQuest(QS_LINES, 0, { rolls: () => 0.5 });
  solo.m.tick(); solo.m.tick();
  solo.m.shelveQuest(solo.q.uid);
  solo.m.shelveQuest(solo2.uid);
  assert.equal(solo.m.sharedCandidateNamed(solo.q.questName), solo.q);
  assert.equal(solo.m.reclaimQuest(solo2.uid).ok, true, 'the second set aside is reclaimed');
  assert.deepEqual(solo.m.reclaimQuest(solo.q.uid), { ok: false, reason: 'twin' }, 'and then the first waits on it');

  // the reclaim relinks at once: a standing foe's behaviour holds the live Foe before any update, and its topics are asked
  const b = rig();
  const relinked = [];
  b.m.deps.relinkQuestTopics = (q) => relinked.push(q);
  const foe = new QuestResourceBehaviour(b.m, { setActive() {} });
  foe.assignResource(b.q.getResource({ name: 'f' }));
  foe.start();
  const was = foe.targetResource;
  assert.ok(was);
  b.m.shelveQuest(b.q.uid);
  b.m.reclaimQuest(b.q.uid);
  assert.notEqual(b.q.getResource({ name: 'f' }), was, 'the reclaim rebuilt its resources');
  assert.equal(foe.targetResource, b.q.getResource({ name: 'f' }), 'the standing behaviour holds the live Foe');
  assert.deepEqual(relinked, [b.q], 'its talk topics relinked');

  // a named NPC's home copy: bound by the block to the quest's Person, it stays when the quest is set aside
  const h = rig();
  const shown = [];
  const home = new QuestResourceBehaviour(h.m, { setActive: (a) => shown.push(a), staticNpcFactionId: 9999 });
  home.individualHome = true;
  home.targetQuest = h.q; home.targetResource = { isPerson: true, symbol: { name: 'kv' } }; home.relinkToLiveQuest = () => false;
  h.m.shelveQuest(h.q.uid);
  home.update();
  assert.deepEqual(shown, [], 'the home copy is not put away');
  let broadcast = 0;
  h.m.isIndividualNPC = () => true;
  home._clickAllIndividualNPCs = () => { broadcast++; return true; };
  assert.equal(home.doClick(), true, 'its click reaches the running quests');
  assert.equal(broadcast, 1);
  assert.match(src('src/systems/quest/machine.js'), /const behaviour = new QuestResourceBehaviour\(this, host\);\n\s*behaviour\.individualHome = true;/, 'the block marks its home copy');

  // a partner's envelope never carries a shelf
  const e = rig();
  const copy = e.m.receiveSharedQuest({ ...e.q.getSaveData(), shelvedAt: 5, shelvedSites: ['lair'] });
  assert.ok(copy);
  assert.equal(isShelved(copy), false);
  assert.equal(copy.shelvedSites, null);
  const step = e.m.updateSharedQuest(e.q.questName, { ...e.q.getSaveData(), shelvedAt: 5 });
  assert.ok(step);
  assert.equal(isShelved(step), false, 'nor a step');

  // the Settings repair mends no quest set aside: its links stay set aside
  const p = rig();
  p.m.shelveQuest(p.q.uid);
  assert.equal(repairActiveQuests(p.m, {}).quests, 0);
  assert.equal(p.m.siteLinks.some((l) => l.questUID === p.q.uid), false);

  // the rumor mill tells none of its rumors while it is away
  const mill = new RumorMill({ nowClassicMinutes: () => 0, questAway: (id) => id === 7, rolls: () => 0 });
  mill.listRumorMill = [7, 8].map((questID) => ({ rumorType: RUMOR_TYPE.QuestRumorMill, questID, textID: 0, regionID: -1, faction1: 0, faction2: 0, type: 0, flags: 0, timeLimit: 999999, listRumorVariants: [] }));
  assert.deepEqual(mill.getValidRumors().map((x) => x.questID), [8]);
  assert.match(src('src/scenes/world.js'), /questAway: \(uid\) => isShelved\(questBridge\?\.machine\.getQuest\(uid\)\),/);

  // the lens: set aside is away, not gone - its reclaim is no news
  const l = rig();
  const row = { id: String(l.q.uid), name: 'Rats', questName: l.q.questName, messages: [l.q.getMessage(1011)], steps: [{ stepID: 0, messageID: 1011, time: 5 }], clocks: [] };
  let log = { active: [row], ended: [] };
  const lens = new QuestLens({ questLog: () => log });
  assert.equal(lens.look().quests.length, 1, 'the lens reads it');
  log = { active: [], ended: [], shelved: [row] };
  assert.deepEqual(lens.look().events, [], 'set aside: nothing said');
  log = { active: [row], ended: [] };
  assert.deepEqual(lens.look().events, [], 'reclaimed: its journal is no news');
});
