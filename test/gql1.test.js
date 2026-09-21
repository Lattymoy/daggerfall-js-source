// GQL1 (2026-09-21, Discord, kurkku, playing online: "Are guild quests
// not in this? I get a message saying "this service isn't available"
// when I try to get one"). The guild popup's Quests service runs the
// offer flow's guild door and boxes the step it answers for the
// ServiceFlowWindow. With Choose Guild Jobs ON
// (Enhancements/GuildQuestListBox, the Features screen's own row) the
// door's FIRST step is the 'gettingQuests' wait box and its dismissal is
// the 'pickQuest' picker - and offerBoxes had a case for neither, so
// the chain came back EMPTY, the questOffer arm read empty as C#'s
// silent close, and the popup printed its no-flow refusal on every guild
// in the game. The flow was complete (questoffers.test.js pins both
// steps); the popup layer never learned to show them. The pins here are
// the two boxes, the walk through the REAL window, and a derived
// coverage law so a third step kind cannot repeat this.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { createQuestBridge } from '../src/scenes/questBridge.js';
import { QUEST_MESSAGES } from '../src/systems/quest/machine.js';
import { GETTING_QUESTS_1, GETTING_QUESTS_2 } from '../src/systems/quest/offerFlow.js';
import { GUILD_GROUPS } from '../src/formats/factionFile.js';
import { ServiceFlowWindow } from '../src/ui/guildServiceWindows.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = join(ROOT, 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  }
  loadQuestTables(sources);
}

const OFFER_SRC = [
  'Quest: __OFR',
  'DisplayName: The Offered Errand',
  'QRC:',
  `QuestorOffer:  [${QUEST_MESSAGES.QuestorOffer}]`,
  '<ce> Would you fetch the thing?',
  '',
  `RefuseQuest:  [${QUEST_MESSAGES.RefuseQuest}]`,
  '<ce> Bah. Off with you.',
  '',
  `AcceptQuest:  [${QUEST_MESSAGES.AcceptQuest}]`,
  '<ce> Good. The thing awaits.',
  '',
  'QBN:',
  'variable _done_',
];
const LIST_HEAD = 'schema: *name, group, membership, minReq, flag, notes';
const rowsOf = (...rows) => [LIST_HEAD, ...rows].join('\n');

function makeBridge(over = {}) {
  return createQuestBridge({
    data: {
      readListTable: (name) => (name === 'Classic' ? rowsOf('__OFR, FightersGuild, M, 0, 0, x') : null),
      getQuestSourceLines: (name) => (name === '__OFR' ? OFFER_SRC : null),
    },
    classicSeconds: () => 0,
    playerEntity: { name: 'Hero Proudfoot', level: 3, gender: 'male' },
    getReputation: () => 0,
    dateTimeString: () => '13:30:00 on 4th of Morning Star, 3E405',
    midDateTimeString: () => '13:30:00 04 Morning Star 3E405',
    cityName: () => 'Daggerfall',
    ...over,
  });
}

/** The popup's guild, as worldModes' questOffer arm hands it: a
 *  Fighters member of rank 0 (offerGuildSurface reads these). */
const GUILD = { factionId: 41, name: 'Fighters Guild' };
const MEMBERSHIP = { factionId: 41, rank: 0 };
const rows = (id) => [`text:${id}`];

const withListBox = (on, fn) => {
  _resetForTests();
  setValue('Enhancements', 'GuildQuestListBox', on);
  try { return fn(); } finally { _resetForTests(); }
};

test('GQL1a offerBoxes boxes the wait step: a click-anywhere box of the two literals with %pcf the first name, whose click boxes onClose', () => {
  const bridge = makeBridge();
  let closed = 0;
  const step = {
    kind: 'gettingQuests',
    textLines: [GETTING_QUESTS_1, GETTING_QUESTS_2],
    clickAnywhereToClose: true,
    onClose: () => { closed++; return { kind: 'fail', textId: 600 }; },
  };
  const boxes = bridge.offerBoxes(step, rows);
  assert.equal(boxes.length, 1);
  const [box] = boxes;
  assert.deepEqual(box.rows, [
    'Hmm, let me see what tasks we have available.',
    'Please have patience and wait here a moment, Hero.',
  ], 'the message box\'s generic pass expands %pcf to the FIRST name');
  assert.equal(box.buttons, undefined, 'click-anywhere: no YesNo');
  assert.equal(box.picker, undefined);
  assert.deepEqual(box.onClick(), [{ rows: ['text:600'] }], 'the click runs the flow\'s OnClose and boxes what it answers');
  assert.equal(closed, 1);
});

test('GQL1b offerBoxes boxes the picker step: the entries as the picker, a pick boxing onPick(index), cancel closing', () => {
  const bridge = makeBridge();
  const picked = [];
  const step = {
    kind: 'pickQuest',
    entries: ['The Offered Errand', 'Der Auftrag'],
    onPick: (i) => { picked.push(i); return i === 1 ? { kind: 'fail', textId: 601 } : null; },
  };
  const [box] = bridge.offerBoxes(step, rows);
  assert.deepEqual(box.picker, ['The Offered Errand', 'Der Auftrag']);
  assert.deepEqual(box.onPick(1), [{ rows: ['text:601'] }]);
  assert.deepEqual(box.onPick(0), [], 'a pick the flow answers nothing to closes silently');
  assert.deepEqual(picked, [1, 0]);
  assert.deepEqual(box.onCancel(), [], 'DaggerfallListPickerWindow\'s cancel pops the window and offers nothing');
});

test('GQL1c the Quests service with Choose Guild Jobs ON, through the real bridge and the real ServiceFlowWindow: wait box -> picker -> offer -> accepted', () => {
  withListBox(true, () => {
    const bridge = makeBridge();
    const step = bridge.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild: GUILD, membership: MEMBERSHIP, reputation: 0 });
    assert.equal(step.kind, 'gettingQuests', 'the setting flips the door to the picker arm');
    const boxes = bridge.offerBoxes(step, rows);
    assert.ok(boxes.length, 'THE BUG: an empty chain here is what worldModes reads as "not available yet"');
    let closed = 0;
    const win = new ServiceFlowWindow(boxes, { onClose: () => closed++ });
    assert.deepEqual(win.top.rows, [GETTING_QUESTS_1, 'Please have patience and wait here a moment, Hero.']);
    win.click(100, 100);   // click anywhere
    assert.ok(win.top?.picker, 'the wait box\'s dismissal raises the picker');
    assert.deepEqual(win.top.picker, ['The Offered Errand']);
    assert.ok(win._picker, 'the window mounted a ListPickerWindow over it');
    // a pick, the way ListPickerWindow reports it
    win._picker.onPick(0, 'The Offered Errand');
    assert.equal(win.top?.buttons, 'YesNo', 'the pick lands on the QuestorOffer prompt');
    assert.deepEqual(win.top.rows, ['Would you fetch the thing?']);
    win.input('KeyY');
    assert.deepEqual(win.top?.rows, ['Good. The thing awaits.'], 'Yes shows the AcceptQuest popup');
    assert.equal(bridge.machine.quests.size, 1, 'and the quest is LIVE in the machine');
    win.click(1, 1);
    assert.equal(win.done, true);
    assert.equal(closed, 1);
  });
});

test('GQL1d with the setting OFF the classic random draw still boxes an offer (nothing regressed for the default player)', () => {
  withListBox(false, () => {
    const bridge = makeBridge();
    const step = bridge.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild: GUILD, membership: MEMBERSHIP, reputation: 0 });
    assert.equal(step.kind, 'offer');
    const [box] = bridge.offerBoxes(step, rows);
    assert.equal(box.buttons, 'YesNo');
  });
});

// The DERIVED law. Every step kind the offer flow can answer is a kind
// offerBoxes names in a `case` - the flow's `kind: '...'` literals are
// the population, and the switch is read by content. A kind the flow
// grows tomorrow and the switch does not learn reddens here rather than
// on Discord.
test('GQL1e every step kind offerFlow.js can answer is a case in offerBoxes (derived)', () => {
  const flow = src('src/systems/quest/offerFlow.js');
  const kinds = new Set([...flow.matchAll(/\bkind: '(\w+)'/g)].map((m) => m[1]));
  assert.ok(kinds.size >= 6, `the flow's kinds: ${[...kinds].join(', ')}`);
  for (const k of ['gettingQuests', 'pickQuest', 'offer', 'fail', 'accepted', 'refused', 'close']) assert.ok(kinds.has(k), k);
  const bridge = src('src/scenes/questBridge.js');
  const at = bridge.indexOf('    offerBoxes(step, rows) {');
  assert.ok(at > 0);
  const body = bridge.slice(at, bridge.indexOf('\n    },\n', at));
  const cases = new Set([...body.matchAll(/case '(\w+)':/g)].map((m) => m[1]));
  for (const k of kinds) assert.ok(cases.has(k), `offerFlow answers kind '${k}' and offerBoxes has no case for it - the chain would come back empty and the popup would read "not available yet"`);
  assert.match(body, /default: return \[\];/, 'the default stays the silent close - but only for a kind the flow cannot produce');
});
