// QUEST-RESET (2026-10-13, LostMyLeg on Discord: the Dust of Restful Death's mummy "wont spawn in the dungeon choosen by
// the quest ... the queststate itself is borked. We prob need to add an option that can fully reset a quest";
// bible/06-Systems/Quest-Arc.md QUEST-RESET). RESTART (quest/machine.js restartQuest): the quest thrown away and started
// again from its own script - the new copy parsed while the old still holds its sites, so it chooses afresh away from
// them; the old copy goes the way an error-terminated quest goes (its quest items leave the pack, its links go, no
// journal entry, no reputation). Refused where a restart would do harm: a questor's quest, the world's own, a `run
// quest` child, one set aside or ending.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { restartRefusalText, shelfRefusalText } from '../../../src/scenes/quest/questBridge.js';
import { mountEnhancedChronicle } from '../../../src/ui/enhanced/enhancedChronicle.js';
import { partyQuestFoe, countsByName } from '../../../src/scenes/quest/questFoeHost.js';
import { mapPixelToWorldCoord, mapPixelToLongitudeLatitude } from '../../../src/formats/mapsFile.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

const HOME = { x: 100, y: 100 };
const lair = { position: 9000, rdbBlock: { objectRootList: [{ rdbObjects: [11, 18].map((record, i) => ({ type: 3, position: 100 + i * 8, xPos: 10, yPos: 4, zPos: 20, resources: { flatResource: { textureArchive: 199, textureRecord: record } } })) }] } };
/** A town and TWO dungeons - a remote dungeon Place has exactly two to choose from. */
function makeWorld() {
  const all = [{ kind: 'town', dx: 0 }, { kind: 'dungeon', dx: 3 }, { kind: 'dungeon', dx: 5 }];
  const locations = all.map((s, index) => {
    const pixel = { x: HOME.x + s.dx, y: HOME.y };
    const wc = mapPixelToWorldCoord(pixel.x, pixel.y);
    const ll = mapPixelToLongitudeLatitude(pixel.x, pixel.y);
    const dungeon = s.kind === 'dungeon';
    return {
      loaded: true, regionIndex: 0, regionName: 'Testshire', name: `${s.kind}${s.dx}`, locationIndex: index, hasDungeon: dungeon,
      mapTableData: { mapId: 5000 + index, locationType: dungeon ? 7 : 0, dungeonType: dungeon ? 0 : -1, longitude: ll.x, latitude: ll.y },
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
/** S0000018's crux: a remote crypt, a mummy holding the quest's item, placed there; a log step. */
const QR_LINES = ['Quest: __QR', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Item _dust_ letter', '', 'Place _crypt_ remote dungeon0', '',
  'Foe _mummy_ is Mummy', '', ' give item _dust_ to _mummy_', ' place foe _mummy_ at _crypt_', ' log 1011 step 0'];
const SOURCES = { __QR: QR_LINES };
function rig() {
  const removed = [], ended = [];
  const world = makeWorld();
  const m = new QuestMachine({ nowSeconds: () => 0, world, playerLevel: () => 1, getQuestSourceLines: (name) => SOURCES[name] ?? null,
    removeItemFromPlayer: (df) => removed.push(df), onQuestEnded: (q) => ended.push(q) });
  const q = m.scheduleQuest(QR_LINES, 0, { rolls: () => 0.5 });
  m.tick(); m.tick();
  return { m, q, removed, ended };
}
const crypt = (q) => q.getPlace({ name: 'crypt' }).siteDetails;

test('QUEST-RESET restart: the old copy gone (its links, its item out of the pack, no journal entry), a new one by the same name running from its first step, its crypt chosen away from the one the old copy held (mutants: removed before the parse, the start skipped, the old kept)', () => {
  const { m, q, removed, ended } = rig();
  const oldCrypt = crypt(q).mapId;
  const dust = q.getResource({ name: 'dust' }).daggerfallUnityItem;
  assert.ok(m.siteLinks.some((l) => l.questUID === q.uid), 'the old copy placed its mummy');
  const random = Math.random;
  Math.random = () => 0.5;   // the new copy's draw, as the old copy's was: with both crypts to choose from it takes the old one
  let r;
  try { r = m.restartQuest(q.uid); } finally { Math.random = random; }
  assert.equal(r.ok, true);
  const fresh = r.quest;
  assert.notEqual(fresh.uid, q.uid);
  assert.equal(m.getQuest(q.uid), null, 'the old copy off the table');
  assert.equal(m.getQuest(fresh.uid), fresh, 'the new one on it');
  assert.equal(fresh.questName, '__QR');
  assert.ok(q.questTombstoned && !q.questSuccess, 'thrown away, not finished');
  assert.deepEqual(ended, [q], 'ended once, as an error-terminated quest ends');
  assert.ok(removed.includes(dust), 'its quest item out of the pack');
  assert.ok(!m.siteLinks.some((l) => l.questUID === q.uid), 'its links gone');
  m.tick();   // a started quest runs its first step on the machine's next tick, as `start quest`'s does
  assert.ok(m.siteLinks.some((l) => l.questUID === fresh.uid), 'the new copy ran its first step: its mummy placed');
  assert.notEqual(crypt(fresh).mapId, oldCrypt, 'chosen while the old copy still held its crypt - the other one');
  assert.deepEqual(fresh.getLogMessages().map((l) => l.stepID), [0], 'its journal from the first step');
});

test('QUEST-RESET a shared copy leaves the party\'s step without being filed as a finished share', () => {
  const { m, q } = rig();
  m.sharedQuestNames.add('__QR');
  assert.equal(m.restartQuest(q.uid).ok, true);
  assert.equal(m.sharedQuestNames.has('__QR'), false);
  assert.equal(m.finishedSharedQuestNames.has('__QR'), false, 'not finished - restarted');
});

test('QUEST-RESET refusals: gone, set aside, ending, the world\'s own, a questor\'s, a run-quest child, the host\'s word - each leaves the quest as it was; a copy that will not parse leaves the old one running (mutants: each rung)', () => {
  const { m, q } = rig();
  assert.equal(m.restartRefusal(q.uid), null);
  assert.equal(m.restartRefusal(424242), 'gone');
  assert.deepEqual(m.restartQuest(q.uid, { refuse: () => 'raid' }), { ok: false, reason: 'raid' });
  q.ticksToEnd = 2;
  assert.equal(m.restartRefusal(q.uid), 'ending');
  q.ticksToEnd = 0;
  q.shelvedAt = 5;
  assert.equal(m.restartRefusal(q.uid), 'shelved');
  q.shelvedAt = null;
  const person = { isPerson: true, isQuestor: true, symbol: { name: 'qg' } };
  q.resources.set('qg', person);
  assert.equal(m.restartRefusal(q.uid), 'questor');
  q.resources.delete('qg');
  const parent = { uid: 77, questName: '__P', questComplete: false, questTombstoned: false, resources: new Map(),
    tasks: new Map([['_t_', { actions: [{ typeName: 'RunQuest', isComplete: false, questUId: q.uid }] }]]) };
  m.quests.set(77, parent);
  assert.equal(m.restartRefusal(q.uid), 'child');
  parent.tasks.get('_t_').actions[0].isComplete = true;
  assert.equal(m.restartRefusal(q.uid), null, 'a run quest done waits on nothing');
  m.quests.delete(77);
  for (const name of ['S0000999', 'S0000977', '_BRISIEN']) {
    const was = q.questName;
    q.questName = name;
    assert.equal(m.restartRefusal(q.uid), 'protected', name);
    q.questName = was;
  }
  assert.ok(m.getQuest(q.uid) && !q.questTombstoned, 'nothing refused touched it');
  delete SOURCES.__QR;
  try {
    assert.deepEqual(m.restartQuest(q.uid), { ok: false, reason: 'unparsed' });
    assert.ok(m.getQuest(q.uid) && !q.questTombstoned, 'no new copy: the old one runs on');
  } finally { SOURCES.__QR = QR_LINES; }
  q.questComplete = true;
  assert.equal(m.restartRefusal(q.uid), 'gone');
});

test('QUEST-RESET the bridge\'s words: every refusal says why in its own words; the door is journalClean\'s, beside Abandon', () => {
  for (const reason of ['gone', 'shelved', 'ending', 'protected', 'questor', 'child', 'raid', 'unparsed', 'failed']) {
    assert.notEqual(restartRefusalText(reason), restartRefusalText('nope'), reason);
  }
  assert.equal(restartRefusalText('raid'), shelfRefusalText('raid'), 'a raid refuses both the same way');
  const bridge = src('src/scenes/quest/questBridge.js');
  assert.match(bridge, /restart\(id\) \{\n\s+const r = machine\.restartQuest\(Number\(id\), \{ refuse: refuseRaid \}\);/);
  assert.match(bridge, /canRestart: \(id\) => machine\.restartRefusal\(Number\(id\), \{ refuse: refuseRaid \}\) === null,/);
  const menu = src('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /clean\.restart && clean\.canRestart\?\.\(sel\.id\)/, 'the pause journal draws it where the door allows');
  assert.match(menu, /const out = clean\.restart\(sel\.id\);/);
});

function chronicleRig(deps) {
  const node = (tag) => {
    const n = { tag, children: [], attrs: {}, style: {}, dataset: {}, className: '', textContent: '', listeners: {},
      classList: { add(c) { n.className = `${n.className} ${c}`.trim(); } },
      append(...cs) { for (const c of cs) if (c) n.children.push(c); },
      setAttribute(k, v) { n.attrs[k] = String(v); },
      addEventListener(t, fn) { (n.listeners[t] ??= []).push(fn); }, removeEventListener() {},
      remove() { n.removed = true; },
      querySelectorAll: () => [] };   // FB1018f SPELL-SCROLL: the repaint asks for the scrolled panes first (ui/domRepaint.js) - a fake with no layout has none
    Object.defineProperty(n, 'innerHTML', { set() { n.children = []; }, get() { return ''; } });
    return n;
  };
  const doc = { createElement: node, createTextNode: (t) => ({ textContent: t, children: [] }) };
  doc.head = node('head'); doc.body = node('body');
  doc.getElementById = (id) => doc.head.children.find((c) => c.id === id) ?? null;
  const prev = { document: globalThis.document, window: globalThis.window };
  globalThis.document = doc;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const host = node('div');
  const view = mountEnhancedChronicle(host, deps);
  return { host, restore() { view.destroy(); globalThis.document = prev.document; globalThis.window = prev.window; } };
}
const all = (n, cls, out = []) => { if (`${n.className ?? ''}`.split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) all(c, cls, out); return out; };
const text = (n) => (n.textContent || '') + (n.children ?? []).map(text).join('');

test('QUEST-RESET the chronicle: Restart on each quest the door allows - the main story\'s steps among them - pressed twice, through the door, saying what happened; a host with no door draws none (mutants: the gate, the arming, the door, the words)', () => {
  const log = { active: [
    { id: '5', name: 'The Rat', questName: 'M0B00Y00', clockSeconds: null, messages: [[{ formatting: 'text', text: 'a step' }]] },
    { id: '6', name: 'Dust of Restful Death', questName: 'S0000018', clockSeconds: null, messages: [[{ formatting: 'text', text: 'a step' }]] },
  ], finished: [] };
  const pressed = [];
  const clean = {
    canRestart: (id) => id === '6',
    restart: (id) => { pressed.push(id); return { ok: true, uid: 9, text: 'Restarted: Dust of Restful Death. It begins again from its first step.' }; },
  };
  const rig = chronicleRig({ questLog: () => log, section: 'quests', shelfDoor: () => clean });
  try {
    const restarts = () => all(rig.host, 'cr-share').filter((b) => /Restart|Click again/.test(text(b)));
    assert.equal(restarts().length, 1, 'one Restart: the main story\'s step the door allows, not the one it refuses');
    assert.equal(restarts()[0].attrs['aria-label'], 'Restart this quest');
    restarts()[0].onclick();
    assert.deepEqual(pressed, [], 'the first press arms');
    assert.equal(text(restarts()[0]), 'Click again');
    restarts()[0].onclick();
    assert.deepEqual(pressed, ['6'], 'the second goes through the door, by the quest\'s id');
    assert.ok(text(rig.host).includes('Restarted: Dust of Restful Death. It begins again from its first step.'), 'and says what happened');
  } finally { rig.restore(); }
  const bare = chronicleRig({ questLog: () => log, section: 'quests' });
  try {
    assert.equal(all(bare.host, 'cr-share').filter((b) => /Restart/.test(text(b))).length, 0, 'no door, no button');
  } finally { bare.restore(); }
});

test('QUEST-RESET\'s field finding: a party member\'s kill of a foe of the same quest counts on my unlinked copy only for a Foe a task of mine counts and no quest item rides - the Dust of Restful Death\'s mummy, holding the Dust and read by no `killed`, is never counted dead before it stands (mutants: the item gate, the trigger gate)', () => {
  const { m, q } = rig();
  const tag = { q: '__QR', s: 'mummy', pv: 1 };
  const mummy = q.getResource({ name: 'mummy' });
  assert.ok(mummy.itemQueue.length > 0, 'the Dust rides it');
  assert.equal(partyQuestFoe(m, tag), null, 'no credit: its body is the only door to the Dust');
  assert.equal(mummy.killCount, 0);
  // the same quest with a `killed` reader: counted - unless a quest item rides it
  const counted = m.parseQuestForLists([...QR_LINES.slice(0, -3), ' place foe _mummy_ at _crypt_', '', '_kill_ task:', ' killed 1 _mummy_'], 0, { rolls: () => 0.5 });
  assert.equal(countsByName(counted, counted.getResource({ name: 'mummy' })), true, 'a `killed` reader: the credit is the count it waits on');
  counted.getResource({ name: 'mummy' }).itemQueue = [{ name: 'the Dust' }];
  assert.equal(countsByName(counted, counted.getResource({ name: 'mummy' })), false, '...but never while a quest item rides it');
  const injured = m.parseQuestForLists([...QR_LINES.slice(0, -3), ' place foe _mummy_ at _crypt_', '', '_hurt_ task:', ' injured _mummy_'], 0, { rolls: () => 0.5 });
  assert.equal(countsByName(injured, injured.getResource({ name: 'mummy' })), true, 'an `injured` reader too');
  const other = m.parseQuestForLists([...QR_LINES.slice(0, -3), 'Foe _rat_ is Giant_rat', '', ' place foe _mummy_ at _crypt_', '', '_kill_ task:', ' killed 1 _rat_'], 0, { rolls: () => 0.5 });
  assert.equal(countsByName(other, other.getResource({ name: 'mummy' })), false, 'a `killed` that reads another Foe counts nothing of this one');
  // a linked copy is the party's and is not read here
  m.sharedQuestNames.add('__QR');
  assert.equal(partyQuestFoe(m, tag), mummy, 'a copy kept in step with the party takes its kills, as before');
});
