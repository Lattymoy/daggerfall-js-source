// LEVEL-ONLINE + LEVEL-PLUS (2026-09-30, Mac: "Overhaul the oblivion/daggerfall selector for leveling mode. Give it
// the enhanced ui plus theme." and "Do not allow people to use daggerfall leveling in online. Characters currently
// using it online can keep it."), REVERSED BY LEVEL-ONLINE-2 (2026-10-06, Mac: "Oblivion should be locked. Currently
// players are forced into oblivion").
//
// THE LAW: newCharacterLevelingSystem is the one door a NEW character's system goes through - finishChargen, the
// `?class=` skip and the classic-save import - and online it answers Daggerfall's whatever was asked. It is never on a
// LOAD path, so a character already levelling Oblivion's way online keeps it (the save is the law).
// THE SCREEN: online Oblivion's option is shown SHUT with its reason; the cursor, the keys, the click and a torn-down
// question all land on Daggerfall's. THE FACE: on Enhanced Plus the question wears the Plus window.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  newCharacterLevelingSystem, LEVELING_CLASSIC, LEVELING_VIRTUE, usesVirtueLeveling, ONLINE_LEVELING_SYSTEM,
} from '../src/systems/oblivionLeveling.js';
import { calculatePlayerLevel, checkForLevelUp } from '../src/systems/advancement.js';
import {
  LevelingChoiceScreen, levelingOptions, LEVELING_OFFLINE_ONLY_NOTE, choiceTop,
} from '../src/ui/levelingChoice.js';
import {
  LEVELING_FACE_ID, LEVELING_FACE_TEXT, levelingFaceOwner, releaseLevelingFace, _setLevelingFaceClockForTests,
} from '../src/ui/enhancedLevelingChoice.js';
import { _frameForTests, DRAW_FRAMES_UNDRAWN } from '../src/ui/drawWatchdog.js';
import { crossLeveling, LEVELING_CROSS_LINE, applyCustoms, customsLines } from '../src/systems/realmCustoms.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const FONT = { fnt: { fixedHeight: 9, fixedWidth: 4, glyphWidth: () => 4 }, tex: 'tex:font', cols: 16, rows: 16, cw: 8, ch: 8 };
const CANVAS = { width: 640, height: 400 };
const recorder = () => ({ quads: 0, drawScreenQuad() { this.quads++; } });

function fakeNode(tag) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', type: '',
    style: {}, attrs: {}, dataset: {}, onclick: null, onpointerenter: null, disabled: false,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    setAttribute(k, v) { n.attrs[k] = v; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  n.classList = {
    toggle(c, on) {
      const set = new Set(n.className.split(/\s+/).filter(Boolean));
      if (on) set.add(c); else set.delete(c);
      n.className = [...set].join(' ');
    },
  };
  return n;
}
function fakeDocument() {
  const doc = { createElement: (t) => fakeNode(t) };
  doc.head = fakeNode('head'); doc.body = fakeNode('body'); doc.documentElement = fakeNode('html');
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const find = (n, cls, out = []) => { if (typeof n.className === 'string' && n.className.split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) find(c, cls, out); return out; };
function withPage(search, fn, { doc = false } = {}) {
  const hadLoc = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  const hadDoc = Object.hasOwn(globalThis, 'document') ? globalThis.document : undefined;
  globalThis.location = { search };
  const d = doc ? fakeDocument() : null;
  if (d) globalThis.document = d;
  try { return fn(d); } finally {
    if (hadLoc === undefined) delete globalThis.location; else globalThis.location = hadLoc;
    if (hadDoc === undefined) delete globalThis.document; else globalThis.document = hadDoc;
  }
}

test('LEVEL-ONLINE-2: a new character is born on Daggerfall\'s leveling online, whatever it asked for; offline the ask stands', () => {
  assert.equal(ONLINE_LEVELING_SYSTEM, LEVELING_CLASSIC);
  assert.equal(newCharacterLevelingSystem(LEVELING_CLASSIC), LEVELING_CLASSIC);
  assert.equal(newCharacterLevelingSystem(LEVELING_VIRTUE), LEVELING_VIRTUE, 'offline Oblivion\'s stays open');
  assert.equal(newCharacterLevelingSystem(undefined), LEVELING_CLASSIC, 'an answerless result is the port\'s own law offline');
  assert.equal(newCharacterLevelingSystem(LEVELING_CLASSIC, { online: true }), LEVELING_CLASSIC);
  assert.equal(newCharacterLevelingSystem(LEVELING_VIRTUE, { online: true }), LEVELING_CLASSIC, 'online nobody is put on Oblivion\'s bar');
  assert.equal(newCharacterLevelingSystem('anything', { online: true }), LEVELING_CLASSIC);
});

test('LEVEL-ONLINE: the law sits on every door a character is BORN through, and on no door one is LOADED through', () => {
  const cs = read('src/systems/chargenSession.js');
  assert.match(cs, /initVirtueLeveling\(playerEntity, newCharacterLevelingSystem\(result\.levelingSystem \?\? LEVELING_CLASSIC, \{ online: isOnlinePage\(\) \}\)\);/, 'finishChargen');
  assert.match(cs, /initVirtueLeveling\(playerEntity, newCharacterLevelingSystem\(LEVELING_CLASSIC, \{ online: isOnlinePage\(\) \}\)\);/, 'the ?class= skip');
  assert.match(read('src/systems/classicSave.js'), /levelingSystem: newCharacterLevelingSystem\(LEVELING_CLASSIC, \{ online \}\),/, 'the classic import');
  assert.match(read('src/scenes/world.js'), /classicSaveToSnapshot\(saveGames, \{\n\s+spellsByIndex, online: isOnlinePage\(\),/, 'the import is told it is online');
  // a LOAD reads the saved field untouched: a Daggerfall character online keeps Daggerfall's leveling
  const save = read('src/systems/save.js');
  assert.doesNotMatch(save, /newCharacterLevelingSystem/, 'no load path re-decides the system');
  assert.equal(usesVirtueLeveling({ levelingSystem: LEVELING_VIRTUE }), true, 'a loaded Oblivion character still levels Oblivion\'s way');
});

test('LEVEL-ONLINE-2: online Oblivion\'s option is shown SHUT, with its reason - offline both are open', () => {
  const off = levelingOptions(null, { online: false });
  assert.deepEqual(off.map((o) => o.locked), [false, false]);
  const on = levelingOptions(null, { online: true });
  assert.deepEqual(on.map((o) => [o.id, o.locked]), [[LEVELING_CLASSIC, false], [LEVELING_VIRTUE, true]]);
  assert.equal(on[0].lockNote, null);
  assert.equal(on[1].lockNote, LEVELING_OFFLINE_ONLY_NOTE);
});

test('LEVEL-ONLINE-2: the online question cannot answer Oblivion - not by key, digit, click, confirm or teardown', () => {
  withPage('?online', () => {
    const got = [];
    const q = new LevelingChoiceScreen((id) => got.push(id), { online: true });
    assert.equal(q.cursor, 0, 'the cursor starts on the open option');
    assert.equal(q.defaultId, LEVELING_CLASSIC);
    q.input('char:2'); q.input('Digit2');
    assert.deepEqual(got, [], 'the digit for a shut option answers nothing');
    q.input('down'); q.input('ArrowUp');
    assert.equal(q.cursor, 0, 'the move skips the shut option');
    assert.equal(q.click(100, choiceTop(1) + 4), false, 'a click on the shut option answers nothing');
    q.hover(100, choiceTop(1) + 4);
    assert.equal(q.cursor, 0, 'nor does hovering it move the cursor');
    q.input('Enter');
    assert.deepEqual(got, [LEVELING_CLASSIC]);
  });
  // offline nothing changed: the first option is Daggerfall's and the default
  const off = new LevelingChoiceScreen(() => {});
  assert.equal(off.cursor, 0);
  assert.equal(off.defaultId, LEVELING_CLASSIC);
  // the door answers a torn-down question with the OPEN default, not a literal Daggerfall (LEGACY2: each question
  // still up in turn - the chain's)
  assert.match(read('src/systems/chargenSession.js'), /while \(prompt && !fired\) prompt\.answer\(prompt\.defaultId\);/);
  // and online the question is always put, the mod on or off
  assert.match(read('src/systems/chargenSession.js'), /const online = isOnlinePage\(\);\n[\s\S]{0,600}?\n\s+if \(oblivionLevelingEnabled\(\) \|\| online\) asks\.push\(\(answer\) => new LevelingChoiceScreen\(/);
});

test('LEVEL-PLUS: on Enhanced Plus the question wears the Plus window - the shell, the frame, a tile per system', () => {
  _setLevelingFaceClockForTests(() => null, () => {});
  withPage('?skin=enhanced&online', (doc) => {
    const got = [];
    const q = new LevelingChoiceScreen((id) => got.push(id), { online: true });
    const r = recorder();
    q.draw(r, CANVAS, FONT);
    assert.equal(r.quads, 0, 'the canvas screen does not draw under the face');
    const root = doc.getElementById(LEVELING_FACE_ID);
    assert.ok(root, 'the face is on the page');
    assert.equal(levelingFaceOwner(), q);
    for (const cls of ['px-home', 'px-over', 'lvl-shell']) assert.ok(root.className.split(' ').includes(cls), cls);
    assert.equal(find(root, 'px-win').length, 1, 'the Plus window frame');
    assert.equal(find(root, 'px-gem').length, 4, 'its four corner gems');
    const title = find(root, 'lvl-title')[0];
    assert.equal(title.textContent, LEVELING_FACE_TEXT.title);
    const tiles = find(root, 'lvl-opt');
    assert.equal(tiles.length, 2);
    assert.equal(tiles[1].disabled, true, 'Oblivion\'s tile is shut online');
    assert.equal(find(tiles[1], 'lvl-lock')[0].textContent, LEVELING_OFFLINE_ONLY_NOTE);
    assert.ok(tiles[0].className.includes('is-on'), 'the open tile is the chosen one');
    tiles[1].onclick();
    assert.deepEqual(got, [], 'the shut tile answers nothing even if clicked');
    tiles[0].onclick();
    assert.deepEqual(got, [LEVELING_CLASSIC]);
    assert.equal(levelingFaceOwner(), null, 'the face goes with the answer');
    assert.equal(root.removed, true);
  }, { doc: true });
});

test('LEVEL-PLUS: the face follows the cursor, and leaves when its draws stop', () => {
  _setLevelingFaceClockForTests(null, null);
  withPage('?skin=enhanced', (doc) => {
    const q = new LevelingChoiceScreen(() => {});
    q.draw(recorder(), CANVAS, FONT);
    const tiles = find(doc.getElementById(LEVELING_FACE_ID), 'lvl-opt');
    assert.ok(tiles[0].className.includes('is-on'));
    q.input('down');
    q.draw(recorder(), CANVAS, FONT);
    assert.ok(tiles[1].className.includes('is-on') && !tiles[0].className.includes('is-on'), 'the highlight moved with the key');
    tiles[0].onpointerenter();
    q.draw(recorder(), CANVAS, FONT);
    assert.equal(q.cursor, 0, 'and with the pointer');
    _frameForTests(DRAW_FRAMES_UNDRAWN + 1);
    releaseLevelingFace(q);
    assert.equal(levelingFaceOwner(), null);
  }, { doc: true });
});

test('LEVEL-PLUS: the classic skin keeps the canvas screen, a shut option saying why', () => {
  withPage('?skin=classic&online', () => {
    const q = new LevelingChoiceScreen(() => {}, { online: true });
    const r = recorder();
    q.draw(r, CANVAS, FONT);
    assert.ok(r.quads > 0, 'the canvas draws');
    assert.equal(levelingFaceOwner(), null, 'no face on the classic skin');
  });
  assert.match(read('src/ui/levelingChoice.js'), /\$\{opt\.locked \? ` - \$\{opt\.lockNote\}` : ''\}/);
});

test('LEVEL-PLUS: the Plus sheet dresses the face, and a phone stacks the tiles', () => {
  const css = read('src/ui/enhancedPlusStyle.js');
  for (const rule of ['.lvl-shell', '.lvl-shell .px-win', '.lvl-opts', '.lvl-opt.is-on', '.lvl-opt:disabled', '.lvl-lock']) {
    assert.ok(css.includes(rule), rule);
  }
  assert.match(css, /\.lvl-opts \{ display: grid; grid-template-columns: repeat\(auto-fit, minmax\(240px, 1fr\)\);/);
});

test('LEVEL-ONLINE-2: a character brought online is a NEW online character - it crosses onto Daggerfall\'s leveling at the start of its level, and is told first', () => {
  // an Oblivion character switches: the bar dropped, the sum re-anchored so Daggerfall's law reads the level it has
  const virtue = { levelingSystem: LEVELING_VIRTUE, levelProgress: 40, levelRollUp: 3, level: 9, startingLevelUpSkillSum: 180, currentLevelUpSkillSum: 400 };
  assert.equal(crossLeveling(virtue), true);
  assert.equal(virtue.levelingSystem, LEVELING_CLASSIC);
  assert.equal(virtue.levelProgress, 0);
  assert.equal(virtue.levelRollUp, 0);
  assert.equal(virtue.level, 9, 'the level earned is kept');
  assert.equal(virtue.currentLevelUpSkillSum, 400, 'the skills are kept');
  assert.equal(calculatePlayerLevel(virtue.startingLevelUpSkillSum, virtue.currentLevelUpSkillSum), 9, 'Daggerfall\'s law reads the level it has');
  assert.equal(checkForLevelUp(virtue), false, 'no level paid out for a sum Oblivion\'s bar already spent');
  assert.equal(calculatePlayerLevel(virtue.startingLevelUpSkillSum, virtue.currentLevelUpSkillSum + 14), 9, 'from the START of the level');
  assert.equal(calculatePlayerLevel(virtue.startingLevelUpSkillSum, virtue.currentLevelUpSkillSum + 15), 10, 'a whole level of skills is the next one');
  // a level-up already earned on Oblivion's bar is still owed on Daggerfall's
  const ready = { levelingSystem: LEVELING_VIRTUE, level: 4, readyToLevelUp: true, pendingLevel: 5, startingLevelUpSkillSum: 100, currentLevelUpSkillSum: 120 };
  assert.equal(crossLeveling(ready), true);
  assert.equal(calculatePlayerLevel(ready.startingLevelUpSkillSum, ready.currentLevelUpSkillSum), 5);
  assert.equal(checkForLevelUp(ready), true, 'the pending level stands');
  assert.equal(ready.pendingLevel, 5);
  // a Daggerfall character, and a save from before ORL1 (no field reads as Daggerfall's), cross untouched
  for (const snap of [{ levelingSystem: LEVELING_CLASSIC, levelProgress: 0, levelRollUp: 0, level: 9, startingLevelUpSkillSum: 180, currentLevelUpSkillSum: 300 }, { level: 9 }]) {
    const before = JSON.parse(JSON.stringify(snap));
    assert.equal(crossLeveling(snap), false);
    assert.deepEqual(snap, before);
  }
  // customs' own report stays the gold and the deeds - the door says the leveling line itself, first
  const snap = { level: 1, classicMinutes: 7, goldPieces: 0, items: [], wagonItems: [], bankAccounts: [] };
  assert.ok(!customsLines(applyCustoms(snap), { before: true }).includes(LEVELING_CROSS_LINE.before));
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /const leveling = crossLeveling\(trial\);[^\n]*\n\s+const preview = \[\.\.\.\(leveling \? \[LEVELING_CROSS_LINE\.before\] : \[\]\), /, 'the Bring online question says it first');
  assert.match(menu, /const leveling = crossLeveling\(copy\);[^\n]*\n\s+const report = applyCustoms\(copy\);/, 'customs switches the realm\'s COPY - the offline character keeps its own');
  assert.match(menu, /lines: \[\.\.\.\(leveling \? \[LEVELING_CROSS_LINE\.after\] : \[\]\), \.\.\.customsLines\(report\)\]/, 'and the report after says it happened');
});
