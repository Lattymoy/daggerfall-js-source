// CW1 - DaggerfallWitchesCovenPopupWindow. The coven's four-button
// popup on DAED00I0.IMG (Talk / Daedra Summoning / Quest painted into
// the art), the last StaticNPCClick clause. THE NATIVE-WINDOW RULE:
// the geometry pins are DFU literals, not the port's own arithmetic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COVEN_RECTS, COVEN_PANEL_W, COVEN_PANEL_H, COVEN_PANEL_X, COVEN_PANEL_Y,
  CovenWindow, COVEN_BUTTONS,
} from '../src/ui/covenWindow.js';
import { shortcutBinding } from '../src/systems/dialogShortcuts.js';
import { serviceShortcutButton } from '../src/systems/guildServiceFlow.js';
import { GuildServiceWindow } from '../src/ui/guildServiceWindow.js';
import { QuestOfferFlow } from '../src/systems/quest/offerFlow.js';
import { GUILD_GROUPS } from '../src/formats/factionFile.js';
import { MEMBERSHIP_STATUS } from '../src/systems/quest/questLists.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const code = (p) => readFileSync(join(SRC, p), 'utf8');

test('CW1: the panel is 130x51, centred and middled - the declared Position (0,50) never applies', () => {
  // mainPanel.Size (:79), and the size of DAED00I0.IMG.
  assert.equal(COVEN_PANEL_W, 130);
  assert.equal(COVEN_PANEL_H, 51);
  // Center/Middle (:76-77) make BaseScreenComponent ignore Position,
  // so `Position = new Vector2(0, 50)` (:78) is dead in DFU too.
  assert.equal(COVEN_PANEL_X, 95);
  assert.equal(COVEN_PANEL_Y, 75);
});

test('CW1: the four button rects are the #region UI Rects literals (:24-27)', () => {
  assert.deepEqual(COVEN_RECTS, {
    talk: [5, 5, 120, 7],
    summon: [5, 14, 120, 7],
    quest: [5, 23, 120, 7],
    exit: [44, 33, 43, 15],
  });
  // the three rows stack 9 apart, the guild popup's own rhythm
  assert.equal(COVEN_RECTS.summon[1] - COVEN_RECTS.talk[1], 9);
  assert.equal(COVEN_RECTS.quest[1] - COVEN_RECTS.summon[1], 9);
});

function makeWindow(over = {}) {
  const log = [];
  const w = new CovenWindow({
    rows: (id) => [{ text: `rsc:${id}`, center: true }],
    onTalk: () => log.push('talk'),
    onSummon: () => { log.push('summon'); return { rows: [{ text: 'not today', center: true }] }; },
    onQuest: () => { log.push('quest'); return { dispatched: true }; },
    onClose: () => log.push('close'),
    ...over,
  });
  return { w, log };
}

const at = (rect, dx = 1, dy = 1) => [COVEN_PANEL_X + rect[0] + dx, COVEN_PANEL_Y + rect[1] + dy];

test('CW1: each button rect routes to its own handler, in DFU\'s order of effects', () => {
  // TALK: CloseWindow THEN TalkToStaticNPC (:167-168) - close first.
  const a = makeWindow();
  assert.equal(a.w.click(...at(COVEN_RECTS.talk)), true);
  assert.deepEqual(a.log, ['close', 'talk']);

  // SUMMON: a box answer (not-a-summoning-day) stacks on the popup,
  // which stays open under it - DFU pushes the box over the window.
  const b = makeWindow();
  b.w.click(...at(COVEN_RECTS.summon));
  assert.deepEqual(b.log, ['summon']);
  assert.equal(b.w.done, false);
  assert.equal(b.w.top.rows[0].text, 'not today');

  // QUEST: a dispatched offer replaced this window - close.
  const c = makeWindow();
  c.w.click(...at(COVEN_RECTS.quest));
  assert.deepEqual(c.log, ['quest', 'close']);

  const d = makeWindow();
  d.w.click(...at(COVEN_RECTS.exit));
  assert.deepEqual(d.log, ['close']);
  assert.equal(d.w.done, true);
});

test('CW1: the are-you-sure Yes CHAINS its result box; a null Yes means dispatched and closes', () => {
  // The summoning's YesNo box: Yes resolves to "not enough gold" /
  // "the daedra does not answer" / the greeting, each a box
  // (DaggerfallQuestPopupWindow.cs:207-266).
  const a = makeWindow({
    onSummon: () => ({ rows: [{ text: 'sure?', center: true }], buttons: 'YesNo', onYes: () => ({ rows: [{ text: 'no answer', center: true }] }) }),
  });
  a.w.click(...at(COVEN_RECTS.summon));
  a.w.input('KeyY');
  assert.equal(a.w.top.rows[0].text, 'no answer', 'the result box takes the dead box\'s place');
  assert.equal(a.w.done, false);
  a.w.input('Enter');   // dismiss the result box
  assert.equal(a.w.boxes.length, 0);

  // Yes returning NULL: the film window / offer chain replaced this
  // window in the overlay slot - the popup closes with it.
  const b = makeWindow({
    onSummon: () => ({ rows: [{ text: 'sure?', center: true }], buttons: 'YesNo', onYes: () => null }),
  });
  b.w.click(...at(COVEN_RECTS.summon));
  b.w.input('KeyY');
  assert.equal(b.w.done, true);

  // No dismisses without consequences.
  const c = makeWindow({
    onSummon: () => ({ rows: [{ text: 'sure?', center: true }], buttons: 'YesNo', onYes: () => { throw new Error('paid on No'); } }),
  });
  c.w.click(...at(COVEN_RECTS.summon));
  c.w.input('KeyN');
  assert.equal(c.w.boxes.length, 0);
  assert.equal(c.w.done, false);
});

test('CW1: the guild popup CHAINS a Yes answer too - the temple summoning\'s result boxes were dropped', () => {
  // GuildServiceWindow._dismissTop discarded onYes's return, so the
  // temple path spent two hundred thousand gold and said nothing.
  const w = new GuildServiceWindow({
    member: () => true,
    service: () => 'DaedraSummoning',
    rows: () => [],
    steps: () => [],
    onService: () => ({ rows: [{ text: 'sure?', center: true }], buttons: 'YesNo', onYes: () => ({ rows: [{ text: 'no answer', center: true }] }) }),
    onClose: () => {},
  });
  // D1: the service accelerator is the SERVICE's own - DaedraSummoning
  // is GuildsDaedraSummon, which DialogShortcuts.txt binds to D. The
  // flat KeyS this line used to press was right for two of twenty.
  w.input('KeyD');
  assert.equal(w.top.rows[0].text, 'sure?');
  w.input('KeyY');
  assert.equal(w.top.rows[0].text, 'no answer', 'the result box shows instead of vanishing');
});

test('CW1: offerCovenQuest is the coven GetQuest verbatim - Witches pool, NONMEMBER, rank = player level, no ExternalMCP', () => {
  const calls = [];
  const machine = {
    isLastNPCClickedAnActiveQuestor: () => false,
    deps: { playerLevel: () => 7 },
    createMessagePrompt: (quest, msg) => ({ quest, msg }),
  };
  const quest = { questName: 'ONE', uid: 1 };
  const questLists = {
    getGuildQuest: (...a) => { calls.push(a); return quest; },
  };
  const flow = new QuestOfferFlow(machine, questLists, {});
  const step = flow.offerCovenQuest(510, -3);
  // ONE call, GetGuildQuest's five arguments in DFU's order
  // (guildGroup, status, factionId, rep, rank) - and rank IS the
  // player level ("Not a proper guild so rank = player level").
  assert.deepEqual(calls, [[GUILD_GROUPS.Witches, MEMBERSHIP_STATUS.Nonmember, 510, -3, 7]]);
  assert.equal(step.kind, 'offer');
  // No guild rides the offer: no ExternalMCP is set (the coven window
  // never assigns one - that line is the GUILD popup's OfferQuest).
  assert.equal(quest.externalMCP, undefined);

  // The active-questor bail closes BEFORE the pool is consulted (:125-129).
  const calls2 = [];
  const flow2 = new QuestOfferFlow(
    { isLastNPCClickedAnActiveQuestor: () => true, deps: {} },
    { getGuildQuest: (...a) => { calls2.push(a); return null; } }, {});
  assert.deepEqual(flow2.offerCovenQuest(510, 0), { kind: 'close' });
  assert.equal(calls2.length, 0);
});

test('CW1: the host wiring - dispatch, the witch\'s OWN factionID, the shared popup-talk door', () => {
  const modes = code('scenes/worldModes.js');
  // StaticNPCClick's WitchesCoven arm dispatches to the popup now -
  // the FLAGGED fall-through to talk is retired.
  assert.match(modes, /if \(route\.kind === 'witchesCoven'\) \{ openWitchesCoven\(pn, npcData\); return; \}/);
  assert.ok(!modes.includes('witchesCoven - DaggerfallWitchesCovenPopupWindow'), 'the flag sentence is deleted');
  // The summoner is the WITCH NPC's own factionID (:186), not the
  // building's - the override threads through the ONE summoning arm.
  assert.match(modes, /summonerFactionId: pn\.factionID,/);
  assert.match(modes, /const summonerId = summonerFactionId \?\? b\?\.factionId \?\? 0;/);
  // guild is nullable on that path - the two reads above the switch
  // tolerate it (DaedraSummoningService lives on the guild-less base).
  assert.match(modes, /const membership = guild \? membershipOf\(memberships, guild\) : null;/);
  assert.match(modes, /const godName = guild\?\.divine \?\? '';/);
  // ONE popup-talk door, three callers: the guild popup binds it, the
  // coven's Talk calls it (menu defaulted TRUE both places).
  assert.match(modes, /function popupTalkToStaticNpc\(npcData, \{ isSpyMaster = false \} = \{\}\)/);
  assert.match(modes, /const talkToStaticNpcHere = \(o\) => popupTalkToStaticNpc\(npcData, o\);/);
  assert.match(modes, /onTalk: \(\) => popupTalkToStaticNpc\(npcData\),/);
  // the art rides the interior preload block
  assert.match(modes, /preloadCovenArt\(\{ renderer, fetchBytes, palette \}\);/);
  // the quest arm hands the NPC's faction and ITS reputation
  assert.match(modes, /questBridge\.offerCovenQuest\(pn\.factionID, getReputation\(store, pn\.factionID\)\)/);
});

test('D1: the coven hotkeys are the table\'s - SUMMON is D, and S is nobody\'s', () => {
  // The ctor hangs DaggerfallShortcut.GetBinding on all four buttons
  // (:84, :90, :96, :102); DialogShortcuts.txt's "-- Witches Covens"
  // block (:205-209) reads T / D / Q / E. The port had put Summon on
  // S, a letter this window does not bind at all.
  assert.deepEqual([...COVEN_BUTTONS],
    ['WitchesTalk', 'WitchesDaedraSummon', 'WitchesQuest', 'WitchesExit'], 'DFU\'s ctor ADD order');
  assert.equal(shortcutBinding('WitchesDaedraSummon').code, 'KeyD');

  const s = makeWindow();
  s.w.input('KeyS');
  assert.deepEqual(s.log, [], 'S does nothing here');
  s.w.input('KeyD');
  assert.deepEqual(s.log, ['summon'], 'WitchesDaedraSummon is D');
  assert.equal(s.w.done, false, 'and its box keeps the popup up');

  // The keyboard arms fire the SAME handlers the clicks do, in the
  // same order - Talk closes before it talks (:176-178).
  const t = makeWindow();
  t.w.input('KeyT');
  assert.deepEqual(t.log, ['close', 'talk']);

  const q = makeWindow();
  q.w.input('KeyQ');
  assert.deepEqual(q.log, ['quest', 'close']);

  const e = makeWindow();
  e.w.input('KeyE');
  assert.deepEqual(e.log, ['close']);
  assert.equal(e.w.done, true);
});

test('D1: the guild popup\'s MIDDLE hotkey moves with the SERVICE, and Join only exists for a non-member', () => {
  // DaggerfallGuildServicePopupWindow.cs:145 hangs
  // Services.GetServiceShortcutButton(service) on the service button,
  // so there is no single service letter. The port spelled a flat
  // KeyS, which is right for exactly two of the twenty.
  assert.equal(serviceShortcutButton('Training'), 'GuildsTraining');
  assert.equal(serviceShortcutButton('Quests'), 'GuildsGetQuest', 'not "GuildsQuests" - a second switch, not the label\'s');
  assert.equal(serviceShortcutButton('CureDisease'), 'GuildsCure');
  assert.equal(serviceShortcutButton('BuySpellsMages'), 'GuildsBuySpells', 'the two fall into one arm (:433-435)');
  assert.equal(serviceShortcutButton('Nonsense'), null, 'default: Buttons.None');

  const make = (over = {}) => {
    const log = [];
    const w = new GuildServiceWindow({
      member: () => true,
      service: () => 'Training',
      rows: () => [], steps: () => [],
      onJoin: () => { log.push('join'); return null; },
      onTalk: () => log.push('talk'),
      onService: () => { log.push('service'); return { rows: [{ text: 'here', center: true }] }; },
      onClose: () => log.push('close'),
      ...over,
    });
    return { w, log };
  };

  // Training is R, so S is dead and R runs the service.
  const tr = make();
  tr.w.input('KeyS');
  assert.deepEqual(tr.log, [], 'the flat KeyS is gone');
  tr.w.input('KeyR');
  assert.deepEqual(tr.log, ['service']);

  // ...and Identify on the same window is I, not R.
  const id = make({ service: () => 'Identify' });
  id.w.input('KeyR');
  assert.deepEqual(id.log, []);
  id.w.input('KeyI');
  assert.deepEqual(id.log, ['service']);

  // Join (J) exists only while the join ROW does (:127-132) - a
  // member's panel has no such button to hang a hotkey on.
  const mem = make();
  mem.w.input('KeyJ');
  assert.deepEqual(mem.log, [], 'a member has no Join button');
  const non = make({ member: () => false });
  non.w.input('KeyJ');
  assert.deepEqual(non.log, ['join', 'close']);

  // Talk T and Exit E are the fixed two.
  const talk = make();
  talk.w.input('KeyT');
  assert.deepEqual(talk.log, ['talk', 'close']);
  const exit = make();
  exit.w.input('KeyE');
  assert.deepEqual(exit.log, ['close']);
});
