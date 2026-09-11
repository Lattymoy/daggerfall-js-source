// ET1 - THE ENHANCED TALK PANEL (2026-09-11).
//
// Mac: "the talk menu. My goal is to transform it into a rectangular
// panel akin to Fallout/Skyrim instead of a full screen menu."
//
// The panel owns no conversation law: it presses the classic
// NativeTalkWindow's named buttons and draws that model's state. So
// the pins here are (1) the door, (2) that press(name) IS click(rect)
// - the one law under two faces - and (3) the panel's picture and
// keys over a driven model, without a DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NativeTalkWindow, TALK_RECTS, BUTTON_ORDER, npcPortraitPixels } from '../src/ui/nativeTalk.js';
import { talkPanelModel, talkKey, TONE_LABELS, CATEGORY_BUTTONS } from '../src/ui/enhancedTalk.js';
import { createTalkWindow, talkDoorReady } from '../src/ui/talkDoor.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const at = (r) => [r[0] + 1, r[1] + 1];

/** talkpages.test.js's own fixture: an engine-shaped session. */
const mkHooks = () => {
  const state = { tone: 1, workAsked: 0, closed: 0, notes: null };
  return {
    state,
    categories: () => [{ label: 'Taverns', buildings: [{ label: 'The Howling Wolf' }, { label: 'The Laughing Cat' }] }, { label: 'Temples', buildings: [{ label: 'Temple of Kynareth' }] }],
    tellMeAboutTopics: () => [
      { label: 'Any news?', listItem: { questionType: 1 } },
      { label: 'Where am I?', listItem: { questionType: 2 } },
    ],
    peopleTopics: () => [{ label: 'Lord Bridwell', listItem: { questionType: 5 } }],
    thingsTopics: () => [],
    workQuestion: () => 'Do you know of any work?',
    askWork: () => { state.workAsked++; return 'You might try the Odd Blades.'; },
    question: (row) => `About ${row.label}...`,
    answer: (row) => `${row.label}: an answer`,
    tone: () => state.tone,
    setTone: (t) => { state.tone = t; },
    npcName: 'Cims Ravel',
    copyToNotebook: (tokens) => { state.notes = tokens; },
    onClose: () => { state.closed++; },
  };
};

/** The model's whole conversation state, for holding two windows equal. */
const snap = (w) => ({
  mode: w.topicMode, topics: w.topics.map((t) => t.label), selected: w.selected, question: w.question,
  option: w._talkOption, category: w._lastCategory, tone: w.hooks.tone(),
  conversation: w.conversation.map((c) => (typeof c === 'string' ? c : `${c.kind}:${c.text}`)),
  conversationSelected: w.conversationSelected, copied: [...w.copyIndexes].sort(), done: w.done,
});

test('ET1 door: townTalk opens every conversation through createTalkWindow, and readiness is the skin\'s', () => {
  const host = read('src/scenes/townTalk.js');
  assert.doesNotMatch(host, /new NativeTalkWindow\(/, 'the host never constructs the classic window itself');
  assert.match(host, /if \(talkDoorReady\(\) && directory\.length\) \{\s*\n\s*mount\(createTalkWindow\(greeting, \{/, 'the one talk door goes through the ONE window door');
  // the panel's Goodbye is a DOM click: the host hands it the relock
  // (MAC1), gated on nothing standing under the conversation (the
  // popup's TALK pushes, and its popup wants the cursor back)
  assert.match(host, /relock: \(\) => \{ let under = 0; windows\.eachCoveredWindow\(\(\) => \{ under\+\+; \}\); if \(!under\) requestLook\(canvas\); \}/);
  const door = read('src/ui/talkDoor.js');
  assert.match(door, /return isEnhanced\(\) \|\| talkArtLoaded\(\);/, 'the panel needs no TALK01I0');
  // ONE MODEL, TWO FACES: the classic window is built on BOTH skins,
  // and the fork only chooses the face over it.
  assert.match(door, /const model = new NativeTalkWindow\(greeting, hooks\);\s*\n[\s\S]{0,300}if \(isEnhanced\(\) && typeof document !== 'undefined'\) return enhancedTalkOverlay\(model, hooks\);\s*\n\s*return model;/);
  assert.match(door, /import\('\.\/enhancedTalk\.js'\)/, 'dynamic: classic pays nothing');
  assert.match(door, /unregister = registerOverlay\(goodbye\);/, 'PX28: Tab says goodbye');
  assert.match(door, /if \(!model\.done\) model\.press\('goodbye'\);/, 'and goodbye goes THROUGH the model, so the note is filed and onClose fires');
  assert.match(door, /click\(\) \{ return true; \}/, 'a press beside the panel is consumed, never a pointer grab');
  // headless: the door hands back the classic window and it is live
  const w = createTalkWindow('Hello.', mkHooks());
  assert.ok(w instanceof NativeTalkWindow);
  assert.equal(typeof talkDoorReady(), 'boolean');
});

test('ET1 one law: press(name) is click(rect) - every named button reaches the same state by either face', () => {
  // every rect but the three PANELS and the name label is a button
  const panels = new Set(['topicList', 'conversation', 'topicSlider', 'npcName']);
  assert.deepEqual([...BUTTON_ORDER].sort(), Object.keys(TALK_RECTS).filter((k) => !panels.has(k)).sort());
  assert.equal(BUTTON_ORDER[0], 'logbook', 'AUDIT 63 F5: the logbook before every broad rect');
  // a script over the whole surface, each step named; the classic
  // face clicks the rect, the panel presses the name, and the two
  // models must agree after EVERY step
  const script = [
    'whereIs', 'categoryLocation', 'tonePolite', 'toneBlunt', 'toneBlunt',
    'okay',                       // descends into Taverns (a group)
    'okay',                       // asks The Howling Wolf - the Q/A pair
    'logbook',                    // copies the newest answer
    'tellMeAbout', 'categoryPeople',   // greyed: silent, nothing
    'okay',                       // asks Any news?
    'whereIs',                    // back to the remembered category page
    'categoryPeople', 'okay', 'categoryWork', 'okay', 'categoryThings',
    'topicUp', 'topicDown', 'topicLeft', 'topicRight', 'conversationUp', 'conversationDown',
    'goodbye',
  ];
  const a = new NativeTalkWindow('Hello.', mkHooks());
  const b = new NativeTalkWindow('Hello.', mkHooks());
  assert.deepEqual(snap(a), snap(b));
  for (const name of script) {
    assert.ok(a.click(...at(TALK_RECTS[name])), `${name}: the rect consumes`);
    assert.ok(b.press(name), `${name}: the press consumes`);
    assert.deepEqual(snap(a), snap(b), `after ${name}`);
  }
  assert.equal(a.done, true);
  assert.equal(a.hooks.state.closed, 1);
  assert.deepEqual(a.hooks.state.notes, b.hooks.state.notes, 'the OnPop note is the same note');
  assert.ok(a.hooks.state.notes.length >= 1, 'and the copied answer was filed');
  assert.equal(b.press('nothing'), false, 'an unknown name is not a button');
  // the logbook's right arm marks every row
  const c = new NativeTalkWindow('Hello.', mkHooks());
  c.press('whereIs'); c.press('okay'); c.press('okay');
  c.press('logbook', true);
  assert.deepEqual([...c.copyIndexes].sort(), [0, 1, 2]);
  // the three index arms are the listboxes' own
  const d = new NativeTalkWindow('Hello.', mkHooks());
  d.press('whereIs');
  d.selectTopic(1);
  assert.equal(d.selected, 1);
  assert.equal(d.question, '', 'a group row is not a question (ItemGroup)');
  d.useTopic(1);
  assert.equal(d.topicMode, 'buildings');
  assert.deepEqual(d.topics.map((t) => t.label), ['Temple of Kynareth']);
  d.useTopic(0);
  assert.equal(d.conversation.length, 3);
  d.selectConversation(1);
  assert.equal(d.conversationSelected, 1);
  d.selectConversation(9);
  assert.equal(d.conversationSelected, 1, 'out of range: unchanged');
});

test('ET1 picture: talkPanelModel reads the model, and only the model', () => {
  const w = new NativeTalkWindow('Hello.', mkHooks());
  let m = talkPanelModel(w);
  assert.equal(m.npcName, 'Cims Ravel');
  assert.equal(m.mode, 'none');
  assert.equal(m.canAsk, false, 'nothing selected, nothing to ask');
  assert.deepEqual(m.entries, [{ i: 0, text: 'Hello.', kind: 'answer', selected: false, copied: false }], 'the greeting is an unselected answer (AUDIT 63 F5)');
  assert.equal(m.option, 'whereIs');
  assert.ok(m.categories.every((c) => c.enabled), 'the categories are live under Where is');
  assert.deepEqual(m.categories.map((c) => c.on), [true, false, false, false], 'Location is the C# default arm');
  w.press('tellMeAbout');
  m = talkPanelModel(w);
  assert.ok(m.categories.every((c) => !c.enabled), 'and greyed under Tell me about, as TALK02I0 greys them');
  assert.equal(m.canAsk, true, 'the fresh list selects its first row');
  assert.equal(m.question, 'About Any news?...');
  assert.equal(m.back, false);
  w.press('whereIs'); w.press('okay');
  m = talkPanelModel(w);
  assert.equal(m.mode, 'buildings');
  assert.equal(m.back, true, 'a category page carries the way back');
  assert.deepEqual(m.topics.map((t) => [t.label, t.selected, t.group]), [['The Howling Wolf', true, false], ['The Laughing Cat', false, false]]);
  w.press('okay'); w.press('logbook');
  m = talkPanelModel(w);
  assert.deepEqual(m.entries.map((e) => [e.kind, e.selected, e.copied]), [['answer', false, false], ['question', false, false], ['answer', true, true]]);
  w.press('categoryWork');
  m = talkPanelModel(w);
  assert.equal(m.mode, 'work');
  assert.equal(m.canAsk, true, 'the Work page asks without a list');
  assert.deepEqual(m.topics, []);
  assert.deepEqual(TONE_LABELS, ['Polite', 'Normal', 'Blunt']);
  assert.deepEqual(CATEGORY_BUTTONS.map((c) => c[1]), ['categoryLocation', 'categoryPeople', 'categoryThings', 'categoryWork']);
});

test('ET1 keys: Enter asks and the arrows move (ours); the classic accelerators stand', () => {
  const w = new NativeTalkWindow('Hello.', mkHooks());
  talkKey('KeyW', w);                           // the classic W: Where is > categories
  assert.equal(w.topicMode, 'categories');
  talkKey('ArrowDown', w);
  assert.equal(w.selected, 1);
  talkKey('ArrowDown', w);
  assert.equal(w.selected, 1, 'clamped at the last row');
  talkKey('ArrowUp', w); talkKey('ArrowUp', w);
  assert.equal(w.selected, 0, 'clamped at the first');
  talkKey('Enter', w);                          // ASK: descends into the group
  assert.equal(w.topicMode, 'buildings');
  talkKey('Enter', w);                          // ASK: the Q/A pair
  assert.equal(w.conversation.length, 3);
  assert.equal(w.done, false, 'Enter does NOT close the panel');
  talkKey('ArrowRight', w);
  assert.equal(w.hooks.tone(), 2, 'sideways steps the tone');
  talkKey('ArrowLeft', w); talkKey('ArrowLeft', w);
  assert.equal(w.hooks.tone(), 0);
  talkKey('KeyT', w);
  assert.equal(w.hooks.tone(), 1, 'T cycles it, as the classic does');
  talkKey('Digit2', w);
  assert.equal(w.conversation.length, 5, 'a digit uses a row');
  talkKey('Escape', w);
  assert.equal(w.done, true, 'Escape is goodbye');
  assert.equal(w.hooks.state.closed, 1);
});

test('ET1 panel: a bottom rectangle over the world, the pixel frame, no art, and the phone stacks it', () => {
  const src = read('src/ui/enhancedTalk.js');
  // paint and bones: the imports are the style and the portrait pixels, nothing that reads ARENA2
  const imports = [...src.matchAll(/^import .* from '([^']+)';/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['./enhancedStyle.js', './nativeTalk.js']);
  assert.match(src, /import \{ npcPortraitPixels, npcPortraitKey \} from '\.\/nativeTalk\.js';/);
  assert.doesNotMatch(src, /_pickIndex|_setListboxTopics|_openFlat|_setTone|_close\(/, 'the panel presses named buttons; it reaches no private arm');
  for (const name of ['tonePolite', 'toneNormal', 'toneBlunt', 'goodbye', 'tellMeAbout', 'whereIs', 'okay', 'logbook', 'categoryLocation']) {
    assert.ok(src.includes(`'${name}'`), `${name} is pressed by name`);
  }
  assert.match(src, /t\.selected \? model\.useTopic\(t\.i\) : model\.selectTopic\(t\.i\)/, 'a press selects, a press on the lit row uses - no double-tap on a phone');
  assert.match(src, /if \(model\?\.done\) \{ relock\(\); onExit\(\); return; \}/, 'goodbye relocks INSIDE the gesture (MAC1)');
  assert.match(src, /ctx\.putImageData\(new ImageData\(px\.rgba, px\.w, px\.h\), 0, 0\);/, 'the portrait is the classic\'s own pixels');
  const talk = read('src/ui/nativeTalk.js');
  assert.match(talk, /rgba: new Uint8ClampedArray\(c32\.colors\.buffer\)/, 'kept beside the texture: one decode, two faces');
  assert.equal(npcPortraitPixels(), null, 'none set, none painted');
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.talk-shell \.talk-panel \{ position: absolute; left: 50%; bottom: max\(16px, 3dvh\);/, 'a rectangle along the bottom, not a screen');
  assert.match(src, /el\('section', 'talk-panel px-win'\)/, 'the pause window\'s frame');
  assert.doesNotMatch(src, /px-over|px-home/, 'no scrim: the world reads through');
  assert.match(css, /\.talk-cat\[disabled\] \{ opacity: 0\.35; cursor: default; \}/);
  assert.match(css, /@media \(max-width: 720px\) \{\s*\n\s*\.talk-shell \.talk-panel \{ width: 100vw;/, 'the phone takes the width');
  assert.match(css, /\.talk-main \{ grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; \}/, 'and stacks the two columns');
  // AUDIT 39's annotation rule: the panel's own text classes are styled
  for (const cls of ['talk-hint', 'talk-q', 'talk-copied']) assert.match(css, new RegExp(`\\.${cls}[\\s,{.]`), `.${cls} has a rule`);
});
