// AUDIT 54 (talk lane, 2026-09-03) - NINE LAWS THE FIX WAVE LANDED IN
// the talk window, the town interaction seam and the two static-NPC
// rays. Every pin below is red under the mutation its comment names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  NativeTalkWindow, TALK_RECTS, TALK_STRIP_SOURCES, TALK_CATEGORIES,
  talkButtonStrips, talkStripSource, topicSliderThumb, clampTopicHScroll,
  TALK_CATEGORIES_IMG, TALK_HIGHLIGHT_IMG,
} from '../src/ui/nativeTalk.js';
import { TOO_FAR_AWAY_TEXT, YOU_SEE_TEXT, presentNpcInfoText } from '../src/player/activate.js';
import { TOO_FAR_AWAY_TEXT as BOARD_TOO_FAR } from '../src/systems/bulletinBoard.js';
import { MODE_ACTIONS, MODES, getInteractionMode, setInteractionMode } from '../src/player/interactionMode.js';
import { createTownTalk } from '../src/scenes/townTalk.js';
import { setBindings, actionOf } from '../src/ui/input.js';
import { createBindings, resetDefaults, setBinding } from '../src/systems/inputActions.js';
import {
  MerchantRepairWindow, REPAIR_RECTS, REPAIR_PANEL_X, REPAIR_PANEL_Y,
  REPAIR_PANEL_W, REPAIR_PANEL_H, MERCHANT_REPAIR_BUTTONS,
} from '../src/ui/merchantRepairWindow.js';
import { shortcutBinding } from '../src/systems/dialogShortcuts.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, f), 'utf8');

const dblClick = (w, x, y) => { w.click(x, y, false, 1000); return w.click(x, y, false, 1100); };

// ── F1: the tone handlers re-run UpdateQuestion ───────────────────────
// MUTANT: `_setTone(t) { this.hooks.setTone(t); }` - drop the
// _updateQuestion call (which is what the three radios used to be).

test('AUDIT 54 talk: a tone change RE-DRAWS the question (ButtonTone*_OnClickHandler :1501-1532)', () => {
  const state = { tone: 1 };
  const hooks = {
    tone: () => state.tone,
    setTone: (t) => { state.tone = t; },
    // GetQuestionText(listItem, selectedTalkTone) - the tone picks the
    // TEXT.RSC record (7212 + toneIndex on Work, 7225 + toneIndex on a
    // Where-is row), so the sentence is a function of the tone.
    workQuestion: () => `work?tone=${state.tone}`,
    question: (it) => `where is ${it.label}?tone=${state.tone}`,
    askWork: () => 'ANSWER',
    answer: (it) => `${it.label} is east`,
    categories: () => [{ label: 'Taverns', buildings: [{ label: 'The Howling Wolf' }] }],
    onClose: () => {},
    npcName: 'People of Daggerfall',
  };
  // (a) THE WORK PAGE - the arm UpdateQuestion takes FIRST (:1224-1231),
  //     and the one whose divergence reached the conversation log:
  //     _askWork pushes the STORED question while getAnswerText
  //     recomputes the reaction tier at the live tone.
  const w = new NativeTalkWindow('Yes?', hooks);
  w._openWork();
  assert.equal(w.question, 'work?tone=1');
  assert.ok(w.click(TALK_RECTS.toneBlunt[0] + 1, TALK_RECTS.toneBlunt[1] + 1));
  assert.equal(state.tone, 2, 'the radio still moves the tone');
  assert.equal(w.question, 'work?tone=2', 'and the player-says panel is re-drawn at the NEW tone');
  w._askWork();
  assert.equal(w.conversation.at(-2).text, 'work?tone=2',
    'so the LOGGED question is the new tone\'s record, not the old one\'s');
  // (b) a TOPIC page re-draws too - UpdateQuestion is not Work-only.
  const w2 = new NativeTalkWindow('Yes?', hooks);
  w2.click(TALK_RECTS.whereIs[0] + 1, TALK_RECTS.whereIs[1] + 1);
  dblClick(w2, 10, 72);                                   // into the buildings list
  state.tone = 1;
  w2._updateQuestion(w2.selected);
  assert.equal(w2.question, 'where is The Howling Wolf?tone=1');
  w2.click(TALK_RECTS.tonePolite[0] + 1, TALK_RECTS.tonePolite[1] + 1);
  assert.equal(w2.question, 'where is The Howling Wolf?tone=0');
  // (c) the toneLastUsed guard (:1505): re-clicking the standing tone
  //     changes nothing at all - no setTone, no re-roll.
  let sets = 0;
  const counted = { ...hooks, setTone: (t) => { sets++; state.tone = t; } };
  const w3 = new NativeTalkWindow('Yes?', counted);
  state.tone = 1;
  w3.click(TALK_RECTS.toneNormal[0] + 1, TALK_RECTS.toneNormal[1] + 1);
  assert.equal(sets, 0, 'TalkToneToIndex(selectedTalkTone) == toneLastUsed returns');
  // ...and the KeyT accelerator is the same door, not a bare hook call.
  w3.input('KeyT');
  assert.equal(sets, 1);
});

// ── F2: the ask logs the sentence that was SHOWN ──────────────────────
// MUTANT: put `this._updateQuestion(idx);` back above the _pushQA in
// _pickIndex (i.e. drop the selectionIndexLastUsed guard).

test('AUDIT 54 talk: the asked question is the DISPLAYED question (ListboxTopic_OnSelectItem :1381-1387)', () => {
  // GetQuestionText is ExpandRandomTextRecord - a fresh RANDOM variant
  // of the record per call - so a hook that cycles variants is the
  // record, and the pin is whether the pair logs the standing one.
  let n = 0;
  const variants = ['Where is %s?', 'Could you point me to %s?', 'Tell me where %s is.'];
  const hooks = {
    categories: () => [{ label: 'Taverns', buildings: [{ label: 'The Howling Wolf' }, { label: 'The Dancing Chasm' }] }],
    question: (it) => variants[n++ % variants.length].replace('%s', it.label),
    answer: (it) => `${it.label} is east`,
    tone: () => 1, setTone: () => {}, onClose: () => {},
  };
  // the DOUBLE-CLICK path: the first press selects (and rolls), the
  // second finds the row already selected, so UpdateQuestion is SKIPPED
  // and :1331 logs the standing currentQuestion.
  const w = new NativeTalkWindow('Yes?', hooks);
  w.click(TALK_RECTS.whereIs[0] + 1, TALK_RECTS.whereIs[1] + 1);
  dblClick(w, 10, 72);                                   // descend into Taverns
  w.click(10, 72 + 7, false, 2000);                      // SELECT The Dancing Chasm
  const shown = w.question;
  w.click(10, 72 + 7, false, 2050);                      // USE it
  assert.equal(w.conversation.at(-2).text, shown,
    'the conversation records the sentence the player-says panel showed');
  assert.notEqual(w.question, shown, ':1333 re-rolls the label AFTER the pair');
  // the OKAY path reaches _pickIndex with the row already selected too.
  const w2 = new NativeTalkWindow('Yes?', hooks);
  w2.click(TALK_RECTS.whereIs[0] + 1, TALK_RECTS.whereIs[1] + 1);
  dblClick(w2, 10, 72);
  const shown2 = w2.question;
  w2.click(TALK_RECTS.okay[0] + 1, TALK_RECTS.okay[1] + 1);
  assert.equal(w2.conversation.at(-2).text, shown2);
  // ...and a FRESH index still fills the label before it asks - the
  // digit accelerator never selects first.
  const w3 = new NativeTalkWindow('Yes?', hooks);
  w3.click(TALK_RECTS.whereIs[0] + 1, TALK_RECTS.whereIs[1] + 1);
  dblClick(w3, 10, 72);
  w3.input('Digit2');
  assert.equal(w3.conversation.at(-2).text.includes('The Dancing Chasm'), true);
});

// ── F3: TALK02I0 / TALK03I0, the six button strips ───────────────────
// MUTANT: swap any one strip for its opposite in talkButtonStrips (e.g.
// whereIs: whereIs ? 'whereIsGrayedOut' : 'whereIsHighlighted').

test('AUDIT 54 talk: the six button strips and where each is cut from (:34-35, :436-490)', () => {
  assert.equal(TALK_CATEGORIES_IMG, 'TALK02I0.IMG');      // :34
  assert.equal(TALK_HIGHLIGHT_IMG, 'TALK03I0.IMG');       // :35
  assert.deepEqual([...TALK_CATEGORIES], ['location', 'people', 'things', 'work']);
  // SetTalkModeWhereIs (:967-968) + SetTalkCategoryLocation (:1022-1025)
  // - the state one frame after Setup (:623), which is what the port
  // used to draw upside down: the base art alone reads Where-is GRAYED
  // and all four categories LIT.
  assert.deepEqual(talkButtonStrips('whereIs', 'location'), {
    tellMeAbout: 'tellMeAboutGrayedOut',
    whereIs: 'whereIsHighlighted',
    categoryLocation: 'categoryLocationHighlighted',
    categoryPeople: 'categoryPeopleGrayedOut',
    categoryThings: 'categoryThingsGrayedOut',
    categoryWork: 'categoryWorkGrayedOut',
  });
  // the highlight rotates among the four (:1043-1046, :1064-1067, :1085-1088)
  assert.equal(talkButtonStrips('whereIs', 'people').categoryPeople, 'categoryPeopleHighlighted');
  assert.equal(talkButtonStrips('whereIs', 'people').categoryLocation, 'categoryLocationGrayedOut');
  assert.equal(talkButtonStrips('whereIs', 'things').categoryThings, 'categoryThingsHighlighted');
  assert.equal(talkButtonStrips('whereIs', 'work').categoryWork, 'categoryWorkHighlighted');
  // SetTalkCategory's `case Location: default:` (:977-980)
  assert.equal(talkButtonStrips('whereIs', 'nonsense').categoryLocation, 'categoryLocationHighlighted');
  // SetTalkModeTellMeAbout grays ALL FOUR categories (:946-949)
  assert.deepEqual(talkButtonStrips('tellMeAbout', 'people'), {
    tellMeAbout: 'tellMeAboutHighlighted',
    whereIs: 'whereIsGrayedOut',
    categoryLocation: 'categoryLocationGrayedOut',
    categoryPeople: 'categoryPeopleGrayedOut',
    categoryThings: 'categoryThingsGrayedOut',
    categoryWork: 'categoryWorkGrayedOut',
  });
  // THE CUTS. Unity GetPixels is bottom-left origin: TALK03I0's
  // GetPixels(0, h/2) is the TOP half (Tell me about) and (0, 0) the
  // BOTTOM (Where is); TALK02I0's h*3/4 -> Location down to 0 -> Work.
  const highlighted = { w: 107, h: 20 };
  const categories = { w: 107, h: 40 };
  const base = { w: 320, h: 200 };
  const arts = { base, categories, highlighted };
  assert.deepEqual(talkStripSource('tellMeAboutHighlighted', arts).rect, [0, 0, 107, 10]);
  assert.deepEqual(talkStripSource('whereIsHighlighted', arts).rect, [0, 10, 107, 10]);
  assert.deepEqual(talkStripSource('categoryLocationGrayedOut', arts).rect, [0, 0, 107, 10]);
  assert.deepEqual(talkStripSource('categoryPeopleGrayedOut', arts).rect, [0, 10, 107, 10]);
  assert.deepEqual(talkStripSource('categoryThingsGrayedOut', arts).rect, [0, 20, 107, 10]);
  assert.deepEqual(talkStripSource('categoryWorkGrayedOut', arts).rect, [0, 30, 107, 10]);
  // the other six come out of TALK01I0 at the button's OWN rect
  // (200 - rect.y - 10, bottom-left, i.e. rect.y top-down) - which is
  // why the untouched base art reads as it does.
  for (const [strip, button] of [
    ['tellMeAboutGrayedOut', 'tellMeAbout'], ['whereIsGrayedOut', 'whereIs'],
    ['categoryLocationHighlighted', 'categoryLocation'], ['categoryPeopleHighlighted', 'categoryPeople'],
    ['categoryThingsHighlighted', 'categoryThings'], ['categoryWorkHighlighted', 'categoryWork'],
  ]) {
    assert.equal(TALK_STRIP_SOURCES[strip].art, 'base');
    assert.deepEqual(talkStripSource(strip, arts).rect, [...TALK_RECTS[button]]);
  }
  // NEVER TRAP: a sheet that did not land costs its strips, not the
  // window (the async-art departure the portrait carries).
  assert.equal(talkStripSource('whereIsHighlighted', { base, categories: null, highlighted: null }), null);
  assert.deepEqual(talkStripSource('whereIsGrayedOut', { base, categories: null, highlighted: null }).rect,
    [...TALK_RECTS.whereIs]);
});

// ── F4: the horizontal topic scroll ──────────────────────────────────
// MUTANT: delete the topicLeft/topicRight/topicSlider arms from click()
// (the state stays at 0, which is what truncation was standing in for).

test('AUDIT 54 talk: the topic list PANS - two arrows, a slider, no truncation (:207-208, :765-767, :1430-1440)', () => {
  assert.deepEqual([...TALK_RECTS.topicLeft], [4, 177, 16, 9]);
  assert.deepEqual([...TALK_RECTS.topicRight], [86, 177, 16, 9]);
  assert.deepEqual([...TALK_RECTS.topicSlider], [22, 178, 62, 5]);
  // HorizontalSlider.SetScrollIndex (:279-291) over WIDTHS
  assert.equal(clampTopicHScroll(-4, 200, 94), 0);
  assert.equal(clampTopicHScroll(500, 200, 94), 106);
  assert.equal(clampTopicHScroll(5, 40, 94), 0, 'nothing to scroll when the content fits');
  const hooks = {
    categories: () => [{ label: 'Taverns', buildings: [] }],
    answer: () => 'x', tone: () => 1, setTone: () => {}, onClose: () => {},
  };
  const w = new NativeTalkWindow('Yes?', hooks);
  w._topicWidthContent = 200;                    // what the last draw measured (WidthContent)
  assert.equal(w.topicHScroll, 0);
  assert.ok(w.click(TALK_RECTS.topicRight[0] + 1, TALK_RECTS.topicRight[1] + 1));
  assert.equal(w.topicHScroll, 1, 'ScrollIndex++ - one slider unit, and the unit is a pixel');
  assert.ok(w.click(TALK_RECTS.topicLeft[0] + 1, TALK_RECTS.topicLeft[1] + 1));
  assert.equal(w.topicHScroll, 0, 'ScrollIndex--');
  assert.ok(w.click(TALK_RECTS.topicLeft[0] + 1, TALK_RECTS.topicLeft[1] + 1));
  assert.equal(w.topicHScroll, 0, 'and it clamps at the left');
  // the trough pages by DisplayUnits on whichever side of the thumb was
  // hit (HorizontalSlider.MouseClick :170-178)
  const thumb = topicSliderThumb(TALK_RECTS.topicSlider, 0, 200, 94);
  assert.ok(thumb && thumb[2] >= 10, 'the thumb has DFU\'s 10px floor');
  assert.ok(w.click(thumb[0] + thumb[2] + 1, TALK_RECTS.topicSlider[1] + 1));
  assert.equal(w.topicHScroll, 94, 'a page right');
  assert.ok(w.click(TALK_RECTS.topicSlider[0], TALK_RECTS.topicSlider[1] + 1));
  assert.equal(w.topicHScroll, 0, 'and a page left');
  assert.equal(topicSliderThumb(TALK_RECTS.topicSlider, 0, 40, 94), null,
    'HorizontalSlider.Draw returns before the thumb when totalUnits <= displayUnits');
  // a new page zeroes the pan (UpdateScrollBarsTopic :816)
  w.topicHScroll = 40;
  w._setListboxTopics([{ label: 'a' }], 'topics');
  assert.equal(w.topicHScroll, 0);
  // ...and the row text is no longer CUT: ListBox.cs:556-557 sets
  // MaxWidth = -1 in the PixelWise mode this listbox declares (:545).
  const nt = src('src/ui/nativeTalk.js');
  assert.equal(nt.includes('const fit = (t, w) =>'), false, 'the truncation helper is gone');
  assert.ok(nt.includes('R.topicList[0] - this.topicHScroll'), 'rows lay out at x = -horizontalScrollIndex');
  assert.ok(nt.includes('renderer.setScreenScissor'), 'RectRestrictedRenderArea over the listbox box (:546)');
});

// ── F5: one localized key, one string ────────────────────────────────
// MUTANT: put 'You are too far away.' back at any of townTalk's three
// refusals.

test('AUDIT 54 talk: youAreTooFarAway is ONE string in ONE place (Internal_Strings.csv:22)', () => {
  assert.equal(TOO_FAR_AWAY_TEXT, 'You are too far away...');
  assert.equal(BOARD_TOO_FAR, TOO_FAR_AWAY_TEXT, 'the bulletin board re-exports the same constant');
  const tt = src('src/scenes/townTalk.js');
  assert.equal(/'You are too far away\.'/.test(tt), false,
    'the full-stop spelling is gone from the three PlayerActivate refusals');
  assert.equal((tt.match(/hud\.add\(TOO_FAR_AWAY_TEXT\)/g) ?? []).length, 3,
    'ActivateMobileNPC :780 and :790, plus activate()\'s own steal re-test');
});

// ── F6: PresentNPCInfo, the Info arm of ActivateStaticNPC ─────────────
// MUTANT: drop the `info` fork in activateStaticNpc so every mode falls
// to openStaticNpc again.

test('AUDIT 54 talk: Info on a STATIC NPC is PresentNPCInfo and nothing else (PlayerActivate.cs:753-768)', () => {
  assert.equal(YOU_SEE_TEXT, 'You see %s.');                       // Internal_Strings.csv:53
  assert.equal(presentNpcInfoText('Nithella Tomarnas'), 'You see Nithella Tomarnas.');
  assert.equal(presentNpcInfoText(null), 'You see .');             // an unnamed NPC still prints
  const wm = src('src/scenes/worldModes.js');
  // the gate is in activateStaticNpc, which BOTH rays call - the
  // exterior `person:` arm and the interior one - so one law, one place.
  const fn = wm.slice(wm.indexOf('function activateStaticNpc(pn)'));
  const body = fn.slice(0, fn.indexOf('\n  }\n') + 5);
  assert.ok(body.includes("getInteractionMode() === 'info'"), 'the switch\'s Info case');
  assert.ok(body.includes('presentNpcInfo(pn)') && body.includes('openStaticNpc(pn)'),
    'Info goes one way, Grab/Talk/Steal the other');
  assert.equal((wm.match(/activateStaticNpc\(/g) ?? []).length >= 3, true,
    'both rays and the dev hook route through the one gated door');
  // PresentNPCInfo is NOT StaticNPCClick: no LastNPCClicked stamp, no
  // quest-resource click, no faction-listener return (:1521-1535 are
  // all inside StaticNPCClick).
  const pi = wm.slice(wm.indexOf('function presentNpcInfo(pn)'));
  const piBody = pi.slice(0, pi.indexOf('\n  }\n') + 5);
  assert.ok(piBody.includes('staticNpcData(pn, npcSceneCtx)'), 'StaticNPC.Data, derived');
  assert.equal(piBody.includes('clickNpc'), false, 'LastNPCClicked belongs to StaticNPCClick');
  assert.equal(piBody.includes('doClick'), false);
  assert.equal(piBody.includes('factionListeners'), false);
  assert.ok(piBody.includes('presentNpcInfoText(displayName)') && piBody.includes('townTalk?.say?.('),
    'DaggerfallUI.AddHUDText, one line');
});

// ── F7: the repair-shop merchant's popup ─────────────────────────────
// MUTANT: change any button rect, or make the worldModes arm call
// openRepairService directly with the popup art loaded.

test('AUDIT 54 talk: DaggerfallMerchantRepairPopupWindow, its four buttons and its route', () => {
  assert.equal(REPAIR_PANEL_W, 130);
  assert.equal(REPAIR_PANEL_H, 51);                        // :79
  assert.equal(REPAIR_PANEL_X, 95);                        // Center on 320
  assert.equal(REPAIR_PANEL_Y, 75);                        // Middle on 200
  assert.deepEqual([...REPAIR_RECTS.repair], [5, 5, 120, 7]);    // :24
  assert.deepEqual([...REPAIR_RECTS.talk], [5, 14, 120, 7]);     // :25
  assert.deepEqual([...REPAIR_RECTS.sell], [5, 23, 120, 7]);     // :26
  assert.deepEqual([...REPAIR_RECTS.exit], [44, 33, 43, 15]);    // :27
  // DialogShortcuts.txt:157-161, in the ctor's button ADD order
  assert.deepEqual([...MERCHANT_REPAIR_BUTTONS],
    ['MerchantRepair', 'MerchantTalk', 'MerchantSell', 'MerchantExit']);
  assert.equal(shortcutBinding('MerchantRepair').code, 'KeyR');
  assert.equal(shortcutBinding('MerchantTalk').code, 'KeyT');
  assert.equal(shortcutBinding('MerchantSell').code, 'KeyS');
  assert.equal(shortcutBinding('MerchantExit').code, 'KeyE');
  // every handler CLOSES first and then acts (:121-126, :143-148, ...)
  const seen = [];
  const mk = () => new MerchantRepairWindow({
    onRepair: () => seen.push('repair'), onTalk: () => seen.push('talk'),
    onSell: () => seen.push('sell'), onClose: () => seen.push('close'),
  });
  const hit = (rect) => [REPAIR_PANEL_X + rect[0] + 1, REPAIR_PANEL_Y + rect[1] + 1];
  let w = mk(); w.click(...hit(REPAIR_RECTS.repair));
  assert.deepEqual(seen.splice(0), ['close', 'repair']);
  assert.ok(w.done);
  w = mk(); w.click(...hit(REPAIR_RECTS.talk));
  assert.deepEqual(seen.splice(0), ['close', 'talk']);
  w = mk(); w.click(...hit(REPAIR_RECTS.sell));
  assert.deepEqual(seen.splice(0), ['close', 'sell']);
  w = mk(); w.click(...hit(REPAIR_RECTS.exit));
  assert.deepEqual(seen.splice(0), ['close'], 'Exit is CloseWindow alone');
  w = mk(); w.input('KeyS');
  assert.deepEqual(seen.splice(0), ['close', 'sell'], 'the hotkeys are the table\'s');
  // THE ROUTE: with the popup art loaded, the repair merchant mounts the
  // popup - it does NOT fall into openRepairService, whose native arm
  // reads neither onTalk nor onSell.
  const wm = src('src/scenes/worldModes.js');
  const arm = wm.slice(wm.indexOf("route.service === 'repair'"));
  const armBody = arm.slice(0, arm.indexOf('\n    }\n') + 7);
  assert.ok(armBody.includes('merchantRepairArtLoaded()'), 'the art gate, the never-trap idiom');
  assert.ok(armBody.includes('new MerchantRepairWindow('));
  assert.ok(armBody.includes('onRepair: () => openRepairService({})'), 'Repair is the ONLY route to the screen');
  assert.ok(armBody.includes("openStaticNpc(pn, { forceTalk: true })") && armBody.includes('openMerchantSell()'),
    'Talk and Sell live on the popup now');
  assert.ok(wm.includes('preloadMerchantRepairArt('), 'REPR01I0 rides interior entry beside its siblings');
});

// ── F8/F9: the four interaction modes ────────────────────────────────
// MUTANT (a): move the MODE_ACTIONS branch back above the `if (overlay)`
// gate in townTalk.keydown. MUTANT (b): key it on `e.code` again.

const key = (code) => ({ code, key: code, preventDefault() {}, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false });

const talkHost = (over = {}) => createTownTalk({
  renderer: { uploadTexture: () => ({}) }, canvas: { width: 640, height: 400 },
  fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
  playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] },
  regionIndex: 0,
  ...over,
});

const withDefaults = () => { const b = createBindings(); resetDefaults(b); setBindings(b); return b; };

test('AUDIT 54 talk: the mode keys are ACTIONS, and a window shuts them down (PlayerActivate.cs:221-228)', () => {
  withDefaults();
  assert.deepEqual({ ...MODE_ACTIONS },
    { StealMode: 'steal', GrabMode: 'grab', InfoMode: 'info', TalkMode: 'dialogue' });
  for (const m of Object.values(MODE_ACTIONS)) assert.ok(MODES.includes(m));
  // InputManager.SetupDefaults :999-1002 - F1-F4 are the DEFAULTS
  assert.equal(actionOf(key('F1')), 'StealMode');
  assert.equal(actionOf(key('F4')), 'TalkMode');

  setInteractionMode('grab');
  let otherUp = false;
  const host = talkHost({ otherOverlayActive: () => otherUp });
  assert.equal(host.keydown(key('F1')), true);
  assert.equal(getInteractionMode(), 'steal');

  // (a) THIS host's slot: the window claims the key, the mode holds.
  const seen = [];
  host.showOverlay({ isChoiceWindow: true, input: (code) => seen.push(code) });
  assert.equal(host.keydown(key('F2')), true, 'consumed - by the WINDOW');
  assert.deepEqual(seen, ['F2'], 'DaggerfallInventoryWindow.cs:474-491 finally sees its tab hotkey');
  assert.equal(getInteractionMode(), 'steal', 'InputManager.IsPaused: no mode change');
  host.closeOverlay();

  // (b) ANOTHER host's slot (worldModes' interior/dungeon overlay): the
  // key is not consumed here at all, so the host ladder can deliver it.
  otherUp = true;
  assert.equal(host.keydown(key('F3')), false);
  assert.equal(getInteractionMode(), 'steal');
  otherUp = false;
  assert.equal(host.keydown(key('F3')), true);
  assert.equal(getInteractionMode(), 'info');

  // (c) THE REBIND MOVES THE KEY, both directions.
  const b = withDefaults();
  setBinding(b, 'KeyP', 'StealMode');
  assert.equal(host.keydown(key('KeyP')), true);
  assert.equal(getInteractionMode(), 'steal');
  setInteractionMode('grab');
  assert.equal(host.keydown(key('F1')), false, 'F1 is free now - it falls through to the host ladder');
  assert.equal(getInteractionMode(), 'grab');
  setInteractionMode('grab');
  withDefaults();
});

test('AUDIT 54 talk: the dungeon host carries the same two halves', () => {
  const d = src('src/scenes/dungeon.js');
  assert.ok(d.includes('const im = MODE_ACTIONS[actionOf(e, keys)];'), 'the registry (with the held-keys Set the combo arm needs), not e.code');
  assert.ok(d.includes('if (!ctx.uiOverlayActive && im !== getInteractionMode())'),
    'and no mode change under an open window');
  assert.equal(/\{ F1: 'steal'/.test(d), false, 'the literal table is gone');
  // both exterior hosts hand townTalk their OTHER slot's predicate
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.ok(src(f).includes('otherOverlayActive: () => modes?.overlayHeld ?? false'), f);
  }
});
