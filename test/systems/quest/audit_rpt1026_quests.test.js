// AUDIT RPT1026, lane H (QUESTS): FIELD BUGS 2026-10-26r's quest fixes read cold (bible/01-Overview/bugs/
// Field-Bugs-2026-10-26r.md, RPT1026-QUESTS). Each pin fails on the batch head 2dc8f31a2 and passes with its fix; the
// mutants are tools/mutants/audit_rpt1026_quests.json.
//
// H1 - NO-GIVES-BACK FORGOT A NO THE QUESTLINES READ. The batch re-asks a prompt whose No only hands back the item its
// click toted (systems/quest/noAsksAgain.js givesBackNo): four Nos in DFU's corpus. Three of them are answers the
// questlines' sheets read as the player's choice - N0B00Y09's `_nononono_` ("Keep it for the Guild", and the `refused`
// ending: the Mages Guild +3, the Dark Brotherhood -3), $CUREWER's `_S.15_` (the `spared` ending), 80C0XY00's `_school_`
// (the kept secret). Forgotten a tick after the No, the research went home as `loyal` (+2, nothing to the Brotherhood)
// under a journal that said the player kept it for the Guild, and the cure's refusal ended as a failure. A stamped
// quest's No that its sheet reads is DFU's again - asked once; the reported one (M0B11Y18's queen, whose sheet reads
// nothing of it) still asks again, and so does every one of the four while the questlines are off.
// H2 - THE QUESTOR'S CLOSE ON THE CLASSIC SKIN named "the Quests tab of the pause menu"; the classic pause (DFU's
// OPTN00I0) has no tabs (AUDIT QUESTLINES UI-6's own defect). It names the classic way now.
// H4 - PINS THE BATCH'S MUTANTS DID NOT REACH: the "Nothing is written" note drawn on a stamped row that HAS objectives,
// givesBackNo's toted item and its named-once rule, and besideSpot's second ring - each survived the batch's pins.
//
// Every fixture from its producer: DFU's own scripts through the real parser, machine, bridge and questlines layer (the
// pack as the game reads it - test/qlSources.mjs), the pause window's real Quests tab on the minimal DOM, the real
// Collider under besideSpot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Node_ } from '../../chargenDom.mjs';   // the minimal DOM - globals (the pause window mounts on it)
import { createQuestBridge, questorBusyRows } from '../../../src/scenes/quest/questBridge.js';
import { QuestMachine, holdsQuestorDoor } from '../../../src/systems/quest/machine.js';
import { promptsThatAskAgain } from '../../../src/systems/quest/noAsksAgain.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { QUESTLINES_PREF, questlinesOn, startStamp } from '../../../src/systems/questlines/qlLaw.js';
import { questSource, loadTables, ROOT, QUEST_FILES, packMachine, parsedQuest } from '../../qlSources.mjs';
import { addItem } from '../../../src/systems/inventory.js';
import { keepsQuestItem } from '../../../src/systems/item/itemTransfer.js';
import { mountEnhancedMenu } from '../../../src/ui/enhanced/enhancedMenu.js';
import { TRACKER_PREF, _resetQuestTrackerForTests } from '../../../src/ui/quest/questTracker.js';
import { rmbBlock, town, dungeon, worldOf, rdbBlock } from '../../fb1004dTowns.mjs';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { _resetWorldDataReplacement, installWorldDataReplacement } from '../../../src/formats/worldData/worldDataReplacement.js';
import { _resetLayoutPins } from '../../../src/systems/layoutPins.js';
import * as tm from '../../../src/systems/textManager.js';
import { besideSpot, QUEST_BESIDE_REACH } from '../../../src/systems/quest/sceneMount.js';
import { Collider } from '../../../src/player/collider.js';

void Node_;
// NO LIVE TIMER RUNS HERE (GUIDE2's law): the tab's intervals are recorded, never run
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
/** A quest's rolls, seeded (a constant roll draws one town forever). */
const seeded = (seed) => { let x = seed; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; };
const withQuestlines = (on, fn) => { setPref(QUESTLINES_PREF, on); try { return fn(); } finally { setPref(QUESTLINES_PREF, false); } };

// ── H1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT RPT1026 H1: the law over DFU\'s whole corpus as the game reads it - stamped, a No its questlines sheet reads is no No to ask again (N0B00Y09\'s research, $CUREWER\'s blood, 80C0XY00\'s note); the reported queen\'s still is, and unstamped all four are (mutants: the sheet unread; a stamp unread; the outcomes unread; the objectives unread)', () => {
  loadTables();
  const law = (on) => {
    const m = packMachine();
    const out = [];
    for (const [, f] of QUEST_FILES) {
      if (f.dir !== 'dfu') continue;
      const q = quiet(() => parsedQuest(f.name, m, on))?.quest;
      if (!q) continue;
      if (on) q.ql = startStamp(true);   // the stamp a start writes (machine.js startQuestImmediate, the layer's stamp)
      for (const e of promptsThatAskAgain(q)) out.push(`${f.name} ${e.task.symbol.original} no ${e.no.symbol.original}`);
    }
    return out.sort();
  };
  assert.deepEqual(law(false), ['$CUREWER _S.08_ no _S.15_', '80C0XY00 _rulerclicked_ no _school_', 'C0C00Y10 _S.10_ no _no_', 'K0C00Y05 _S.07_ no _no_', 'M0B11Y18 _S.16_ no _S.20_', 'N0B00Y09 _S.07_ no _nononono_'],
    'DFU\'s quest (the questlines off): NO-ASKS-AGAIN\'s two and NO-GIVES-BACK\'s four, as fb1013e_noasks.test.js\'s census reads them');
  assert.deepEqual(law(true), ['C0C00Y10 _S.10_ no _no_', 'K0C00Y05 _S.07_ no _no_', 'M0B11Y18 _S.16_ no _S.20_'],
    'stamped: the queen\'s letter still asks again; the three Nos a sheet reads are the player\'s answer');
});

/** N0B00Y09 (the Dark Brotherhood's research) or $CUREWER through the real bridge and layer, the pack and its toting as
 *  world.js keeps them, every prompt kept for its answer. */
function promptQuest(name, rolls = () => 0.9) {
  loadTables();
  const pack = [], prompts = [], reps = [];
  let now = 100000;
  const bridge = createQuestBridge({
    data: {
      readListTable: (n) => { try { return readFileSync(join(ROOT, 'vendor/dfu-quests/Tables', `QuestList-${n}.txt`), 'utf8'); } catch { return null; } },
      getQuestSourceLines: (n) => (questSource(n, questlinesOn()) ?? []).filter((l) => !/^\s*(place npc|place item|create npc at|reveal|teleport pc)/.test(l)),
    },
    classicSeconds: () => now, nowSeconds: () => now, worldSeconds: () => now,
    playerEntity: { name: 'Hero', level: 6, gender: 'female', skills: new Array(35).fill(30), stats: {} },
    giveItemToPlayer: (it) => addItem(pack, it),
    carriesQuestItem: (res) => pack.some((it) => it.questItem && it.questUID === res.parentQuest?.uid && it.questSymbol?.name === res.symbol?.name),
    keepsQuestItem: (res) => keepsQuestItem({ items: pack }, res),
    releaseQuestItem: (uid, res) => { for (let i = pack.length - 1; i >= 0; i--) { const it = pack[i]; if (it.questItem && it.questUID === uid && it.questSymbol?.name === res.symbol?.name) pack.splice(i, 1); } },
    changeReputation: (id, amount) => reps.push([id, amount]), getReputation: () => 0,
    showPopup: () => {}, showPrompt: (_q, m, respond) => prompts.push({ id: m.id, respond }), showChoice: () => {},
  });
  const quest = quiet(() => bridge.machine.startQuestByName(name, 0, { rolls }));
  assert.ok(quest, `${name} starts`);
  const tick = (n = 2) => quiet(() => { for (let i = 0; i < n; i++) { now += 5; bridge.machine.tick(); bridge.questlines.look(); } });
  const click = (who) => { quest.getResource({ name: who }).setPlayerClicked(); tick(); };
  const set = (n) => quest.getTask({ name: n }).getTriggerValue();
  tick();
  return { bridge, quest, pack, prompts, reps, tick, click, set };
}

test('AUDIT RPT1026 H1: N0B00Y09 - the research refused to the Dark Brotherhood and brought home ends `refused`, as its journal\'s choice says: the Mages Guild +3, the Brotherhood -3 (the batch head: `loyal`, +2 and nothing to the Brotherhood); with the questlines off the Brotherhood asks again (mutant: the sheet unread)', () => {
  withQuestlines(true, () => {
    const q = promptQuest('N0B00Y09');
    assert.ok(q.quest.ql, 'stamped');
    q.click('scholar');
    assert.equal(q.set('S.06'), true, 'the research taken');
    q.click('db');
    assert.deepEqual(q.prompts.map((p) => p.id), [1014], 'the Brotherhood asks for it');
    q.prompts.at(-1).respond(false);
    q.tick(4);
    assert.equal(q.set('nononono'), true, 'the No stands');
    assert.deepEqual(q.bridge.questlines.rowOf(q.quest).choices.map((c) => c.choice), ['Keep it for the Guild']);
    q.click('qgiver');
    q.tick(4);
    assert.equal(q.quest.questComplete, true);
    assert.equal(q.quest.ql.outcome, 'refused', 'the ending the choice names');
    assert.deepEqual(q.reps, [[40, 3], [108, -3]], 'the standing the refusal moves');
  });
  withQuestlines(false, () => {
    const q = promptQuest('N0B00Y09');
    assert.equal(q.quest.ql, null, 'DFU\'s quest');
    q.click('scholar');
    q.click('db');
    q.prompts.at(-1).respond(false);
    q.tick(4);
    assert.equal(q.set('nononono'), false, 'NO-GIVES-BACK: the No forgotten - nothing reads it here');
    q.click('db');
    assert.deepEqual(q.prompts.map((p) => p.id), [1014, 1014], 'and the next click asks again');
  });
});

test('AUDIT RPT1026 H1: $CUREWER - the blood refused to the child ends `spared`, never a failure (the batch head: `failed`) (mutant: the outcomes unread)', () => {
  withQuestlines(true, () => {
    const q = promptQuest('$CUREWER', () => 0.5);
    addItem(q.pack, structuredClone(q.quest.getItem({ name: 'blood' }).daggerfallUnityItem));   // the alchemist's vial
    q.tick();
    q.click('child');
    assert.deepEqual(q.prompts.map((p) => p.id), [1028]);
    q.prompts.at(-1).respond(false);
    q.tick(4);
    assert.equal(q.set('S.15'), true, 'the No stands');
    q.quest.getTask({ name: 'S.05' }).setTriggerValue(true);   // the hunter's days run out: `make _map_ permanent / end quest`
    q.tick(4);
    assert.equal(q.quest.questComplete, true);
    assert.equal(q.quest.ql.outcome, 'spared');
    assert.equal(q.bridge.questlines.rowOf(q.quest).outcome.failure, false);
  });
});

// ── H4: givesBackNo's own two rules ────────────────────────────────────────────────────────────────────────────────

/** M0B11Y18's asking and its No, as written, with `no` the No task's own lines and `more` any line beside. */
const KAVAR = readFileSync(new URL('../../../vendor/dfu-quests/Quests/M0B11Y18.txt', import.meta.url), 'utf8').replace(/^﻿/, '').split(/\r?\n/);
const kavarTask = (name) => {
  const at = KAVAR.findIndex((l) => l.startsWith(`${name} task:`));
  const out = [KAVAR[at]];
  for (let i = at + 1; i < KAVAR.length && /^\s+\S/.test(KAVAR[i]); i++) out.push(KAVAR[i]);
  return out;
};
const queenShape = (no = kavarTask('_S.20_'), more = []) => ['Quest: __KAV', 'QRC:', 'Message:  1050', ' Do you give it?', '', 'QBN:',
  'Item _I.03_ letter used 1031', 'Item _I.04_ letter used 1031', 'Person _ruler_ face 1 group Resident1 local', '',
  '--\tQuest start-up:', '\tget item _I.03_', '', ...kavarTask('_S.16_'), '', ...no, '', '_S.18_ task:', '\tgive pc nothing', '', ...more];

test('AUDIT RPT1026 H4: givesBackNo asks again only for the item the click toted, and only a No nothing else names (mutants: any `get item`; the named-once rule dropped)', () => {
  loadTables();
  const m = new QuestMachine({ nowSeconds: () => 0 });
  const law = (lines) => promptsThatAskAgain(quiet(() => m.parseQuestForLists(lines, 0, { headless: true }))).map((e) => e.no.symbol.original);
  assert.deepEqual(law(queenShape()), ['_S.20_'], 'the queen\'s No, as written');
  assert.deepEqual(law(queenShape(['_S.20_ task:', '\tget item _I.04_'])), [], 'a No that hands back another item hands nothing back');
  assert.deepEqual(law(queenShape(kavarTask('_S.20_'), ['_S.21_ task:', '\twhen _S.20_', '\tgive pc nothing'])), [], 'a No something else reads');
});

// ── ABANDON-ALWAYS, the reported quest itself (H4: the note) ───────────────────────────────────────────────────────

/** A region for B0B81Y02 (The Lost Artifact): the player's town, a town with the Mages Guild and a house, three crypts. */
function artifactWorld() {
  _resetLayoutPins(); _resetWorldDataReplacement(); installWorldDataReplacement();
  const blocks = new Map([
    ['HOME.RMB', rmbBlock('HOME.RMB', [{ type: BUILDING_TYPES.House2 }])],
    ['GUILD.RMB', rmbBlock('GUILD.RMB', [{ type: BUILDING_TYPES.GuildHall, faction: 40 }, { type: BUILDING_TYPES.House1 }])],
    ['DUNG.RDB', rdbBlock()],
  ]);
  const home = town({ name: 'Hometown', locationIndex: 0, mapId: 9100, grid: ['HOME.RMB'] });
  const mages = town({ name: 'Magetown', locationIndex: 1, mapId: 9101, grid: ['GUILD.RMB'] });
  home.exterior.buildings = [{ buildingType: BUILDING_TYPES.House2, factionId: 0, nameSeed: 100 }];   // the directory's pre-check
  mages.exterior.buildings = [{ buildingType: BUILDING_TYPES.GuildHall, factionId: 40, nameSeed: 100 }, { buildingType: BUILDING_TYPES.House1, factionId: 0, nameSeed: 101 }];
  const crypts = [2, 3, 4].map((i) => dungeon({ name: `Crypt ${i}`, locationIndex: i, mapId: 9100 + i, dungeonType: 0 }));
  return worldOf({ locations: [home, mages, ...crypts], blocks, current: home });
}
const GIVER = Object.freeze({ rawX: 10, rawY: 0, rawZ: 20, position: 1234, factionID: 368, flags: 0, textureArchive: 183, textureRecord: 3 });
const HALL = Object.freeze({ mapId: 9100, locationIndex: 0, buildingKey: 33 });

/** B0B81Y02 taken from the knight clicked, its lich slain and the knight told: `give pc nothing`, `remove log step 0`. */
function artifactPaid() {
  loadTables();
  let now = 100000;
  const bridge = createQuestBridge({
    data: { readListTable: () => null, getQuestSourceLines: (n) => questSource(n, questlinesOn()) ?? [] },
    world: artifactWorld(), getReputation: () => 0, changeReputation: () => {},
    classicSeconds: () => now, nowSeconds: () => now, worldSeconds: () => now,
    playerEntity: { name: 'Hero', level: 6, gender: 'female', skills: new Array(35).fill(30), stats: {} },
    showPopup: () => {}, showPrompt: (_q, _m, respond) => respond(true), showChoice: () => {},
  });
  bridge.clickNpc({ ...GIVER }, HALL);
  const quest = quiet(() => bridge.machine.startQuestByName('B0B81Y02', 0, { rolls: seeded(12345) }));
  assert.ok(quest, 'The Lost Artifact starts');
  const tick = (n = 2) => quiet(() => { for (let i = 0; i < n; i++) { now += 5; bridge.machine.tick(); bridge.questlines.look(); } });
  tick();
  quest.getTask({ name: 'S.01' }).setTriggerValue(true);   // the lich slain
  bridge.clickNpc({ ...GIVER }, HALL);
  tick(4);
  return { bridge, quest };
}
/** The Quests tab over `bridge`, the quest's row pressed: its detail's words and presses. */
function questsTab(bridge, title) {
  setPref(TRACKER_PREF, true);
  _resetQuestTrackerForTests();
  const host = globalThis.document.createElement('div');
  globalThis.document.body.append(host);
  const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: { questLog: () => bridge.questLog(), journalClean: () => bridge.journalClean }, onAction: () => {}, at: 'quests' });
  try {
    const row = host.querySelectorAll('*').find((n) => n.tagName === 'BUTTON' && String(n.className).includes('px-qrow') && n.textContent.includes(title));
    assert.ok(row, `${title}: a row of the tab`);
    row.click();
    const detail = host.querySelectorAll('.px-qdetail')[0];
    return { text: detail.textContent, presses: detail.querySelectorAll('*').filter((n) => n.tagName === 'BUTTON').map((b) => b.textContent) };
  } finally { menu.unmount(); host.remove(); _resetQuestTrackerForTests(); }
}

test('AUDIT RPT1026 H4: The Lost Artifact itself, paid with its journal taken back - a row with Abandon; stamped, its struck objectives are its page and no "Nothing is written" note stands beside them; DFU\'s, the note (mutant: the note on every entryless row)', () => {
  withQuestlines(true, () => {
    const { bridge, quest } = artifactPaid();
    assert.ok(quest.ql && quest.questSuccess && !quest.questComplete, 'stamped, paid, still running');
    assert.equal(quest.getLogMessages().length, 0, '`remove log step 0`');
    assert.equal(holdsQuestorDoor(quest), true);
    bridge.clickNpc({ ...GIVER }, HALL);
    assert.equal(bridge.machine.isLastNPCClickedAnActiveQuestor(), true, 'the order\'s door shut');
    assert.deepEqual(bridge.questLog().unlogged.map((r) => r.ql.objectives.map((o) => `${o.id}:${o.state}`)), [['slay:done', 'report:done']]);
    const tab = questsTab(bridge, 'The Lost Artifact');
    assert.ok(tab.presses.includes('Abandon quest'), String(tab.presses));
    assert.match(tab.text, /Destroy the lich/);
    assert.doesNotMatch(tab.text, /Nothing is written in your journal/, 'its objectives say what there is to say');
  });
  withQuestlines(false, () => {
    const { bridge } = artifactPaid();
    const tab = questsTab(bridge, 'The Lost Artifact');
    assert.ok(tab.presses.includes('Abandon quest'));
    assert.match(tab.text, /Nothing is written in your journal for this quest yet\./);
  });
});

// ── H2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('AUDIT RPT1026 H2: the questor\'s close names the way to Abandon on the skin worn - the Quests tab on the enhanced skin, the classic pause\'s Controls then Escape on the classic (which has no tabs) - in the player\'s language (mutant: the classic words dropped)', () => {
  withQuestlines(false, () => {
    const { quest } = artifactPaid();
    const close = () => questorBusyRows(quest).map((r) => r.text);
    assert.deepEqual(close(), ['You have not finished the work you were given here: The Lost Artifact.', 'If you cannot finish it, you can abandon it from the Quests tab of the pause menu.']);
    setPref('skin', 'classic');
    try {
      assert.deepEqual(close(), ['You have not finished the work you were given here: The Lost Artifact.', 'If you cannot finish it, you can abandon it: in the pause menu, press Controls, then Escape, and choose it under Quests.']);
      const fr = tm.loadStringTableCsv(readFileSync(join(ROOT, 'locales/fr/Port_Strings.csv'), 'utf8'));
      tm.patchLocaleTable('fr', 'Port_Strings', fr);
      tm.setLocale('fr');
      try {
        assert.equal(close()[1], new Map(fr).get('quest.offer.questorBusyAbandonClassic'));
        assert.match(close()[1], /« Controls », puis Échap, et choisissez-la sous Quêtes\.$/);
      } finally { tm.setLocale('en'); }
    } finally { setPref('skin', 'enhanced'); }
  });
});

// ── H4: QUEST-CROWD's second ring ──────────────────────────────────────────────────────────────────────────────────

test('AUDIT RPT1026 H4: besideSpot\'s second ring - every spot a box and a tenth out taken, the first clear one a box and six tenths out (mutant: the second ring dropped)', () => {
  const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const floor = new Collider(() => -Infinity);
  floor.addMesh('floor', new Float32Array([-5, 0, -5, 5, 0, -5, 5, 0, 5, -5, 0, 5]), new Uint32Array([0, 1, 2, 0, 2, 3]), IDENTITY);
  const w = 1, at = [0, 0, 0];
  const [near, far] = QUEST_BESIDE_REACH;
  // eight narrow people stood eight tenths of a box out: each first-ring spot inside one's pick box, no second-ring spot
  const ring = Array.from({ length: 8 }, (_, i) => ({ stood: true, active: true, x: Math.cos(i * Math.PI / 4) * 0.8, y: 0, z: Math.sin(i * Math.PI / 4) * 0.8, width: 0.01 }));
  const crowd = [{ stood: true, active: true, x: 0, y: 0, z: 0, width: 1 }, ...ring];
  const got = besideSpot(at, floor, 1.2, w, crowd);
  assert.ok(got, 'a spot in the second ring');
  assert.ok(Math.abs(Math.hypot(got[0], got[2]) - far * w) < 1e-9 && Math.abs(got[2]) < 1e-9, `east, at ${far} boxes: ${got}`);
  assert.ok(far > near);
});
