// LEGACY-CHOICE (2026-10-06, Mac: "I want to add a enhanced plus UI popup for online when creating a character. Perma
// Death, the regular option, or the option that skips the liniage system entirely. Current characters already created
// start without this system and requires a new game"; "how a new character starts and how current characters online
// dont recieve this"; bible/06-Systems/Legacy-Arc.md section 6).
//
// THE QUESTION: online the model question - its Enhanced Plus face the popup - offers three answers: Enduring (the
// regular one, first: Enter without reading never costs a character), Bloodline (permadeath), and no lineage, which
// founds no house. Offline it keeps its two (the mod's own switch in Features does the third for every character).
// THE ANSWER: kept on the character (`entity.legacyChoice`, saved), as the leveling answer is.
// THE LAW (legacyHost.js found): one who answered no lineage founds no house, at their birth or any load, in either
// lane; online a house is founded at a character's BIRTH alone - one loaded with no house (made before the question
// was put online, or copied in) plays without one, for good; offline an older character is founded at its first load
// as ever (D9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { legacyModelOptions, legacyModelScreen, LEGACY_CHOICE_FACE, LEGACY_CHOICE_TEXT, LEGACY_MODEL_FACE, LEGACY_MODEL_TAGS } from '../src/ui/legacyModelChoice.js';
import { LevelingChoiceScreen, stackedTops, choiceAtNative, choiceHeight, choiceKeysWord, CHOICE_STACK_GAP, CHOICE_TOP } from '../src/ui/levelingChoice.js';
import { LEVELING_FACE_ID, levelingFaceOwner, _setLevelingFaceClockForTests } from '../src/ui/enhancedLevelingChoice.js';
import { MODELS, NO_LINEAGE, isLegacyChoice, familyRng, LEGACY_MOD } from '../src/systems/legacy/family.js';
import { createLegacyHost } from '../src/scenes/legacyHost.js';
import { loadFamily, listFamilies } from '../src/systems/legacy/store.js';
import { createChargenWindow, finishChargen } from '../src/systems/chargenSession.js';
import { ChargenFlow } from '../src/ui/chargen.js';
import { SKILLS } from '../src/systems/skills.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { noFamilyLine } from '../src/ui/familyPages.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { _resetModSaveData } from '../src/systems/modSaveData.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const FONT = { fnt: { fixedHeight: 9, fixedWidth: 4, glyphWidth: () => 4 }, tex: 'tex:font', cols: 16, rows: 16, cw: 8, ch: 8 };
const CANVAS = { width: 640, height: 400 };
const recorder = () => ({ quads: 0, drawScreenQuad() { this.quads++; } });
const mem = () => { const m = new Map(); return { map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };

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

const ent = (cid, over = {}) => ({
  name: 'Ysolde Hlaalu', gender: 'female', race: 'DarkElf', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
  level: 1, characterId: cid, chargenDone: true, health: 40, maxHealth: 40, items: [], wagonItems: [],
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: Array.from({ length: 35 }, (_, i) => (i === 28 ? 80 : 20)), ...over,
});
/** The real host over one storage, online or off, with the Features tile's model `tile`. */
function host(entity, { online, storage = mem(), tile = 0 } = {}) {
  _resetModSaveData();
  _resetModSettings();
  setModSetting(LEGACY_MOD, 'Legacy.Model', tile);   // 0 Enduring, 1 Bloodline
  return createLegacyHost({
    entity, storage: () => storage, tab: () => mem(), on: () => true, online: () => online, now: () => 0, own: () => 0,
    here: () => null, town: () => null, nearestTown: () => null, gold: () => 0, say: () => {}, boot: () => {}, search: () => '', loadCharacter: () => false,
    saveNow: () => true, inFight: () => false, rng: familyRng(1),
  });
}

// ---- the question -------------------------------------------------------------------------------------------------

test('LEGACY-CHOICE the question: online three answers - Enduring first, Bloodline, no lineage - each its own tag and words; offline its two', () => {
  const on = legacyModelOptions({ online: true, tollShare: 0.06 });
  assert.deepEqual(on.map((o) => o.id), [MODELS.enduring, MODELS.bloodline, NO_LINEAGE], 'Enter without reading still never costs a character');
  assert.ok(on.every((o) => !o.locked));
  assert.equal(on[2].title, 'No lineage');
  assert.match(on[2].lines.join(' '), /No house, no heirs/);
  assert.deepEqual([LEGACY_MODEL_TAGS[MODELS.enduring], LEGACY_MODEL_TAGS[MODELS.bloodline], LEGACY_MODEL_TAGS[NO_LINEAGE]], ['Not permadeath', 'Permadeath', 'Classic']);
  assert.deepEqual(legacyModelOptions({ online: false, tollShare: 0.06 }).map((o) => o.id), [MODELS.enduring, MODELS.bloodline], 'offline its two');
  assert.ok(isLegacyChoice(NO_LINEAGE) && isLegacyChoice(MODELS.bloodline) && !isLegacyChoice('nobody') && !isLegacyChoice(undefined));
  // the classic face: the three stacked by their own heights, every block clear of the next, the footer on the screen
  const tops = stackedTops(on);
  assert.equal(tops[0], CHOICE_TOP);
  for (let i = 0; i < on.length; i++) assert.equal(tops[i + 1], tops[i] + choiceHeight(on[i]) + CHOICE_STACK_GAP);
  assert.ok(tops[on.length] + 10 <= 200, `the footer is on the screen: ${tops[on.length]}`);
  for (const o of on) for (const line of o.lines) assert.ok(line.length <= 50, `a line the classic face's width holds: ${line}`);
  assert.equal(choiceKeysWord(3), '1, 2 or 3');
  assert.equal(choiceKeysWord(2), '1 or 2', 'the leveling question\'s words as before');
});

test('LEGACY-CHOICE the screen: keys 1, 2 and 3 answer their own, up and down are directions over three, a click lands on its own stacked block; a screen of two has no third', () => {
  withPage('?online', () => {
    for (const [key, want] of [['Digit1', MODELS.enduring], ['char:2', MODELS.bloodline], ['Numpad3', NO_LINEAGE]]) {
      const got = [];
      const q = legacyModelScreen((m) => got.push(m));
      q.input(key);
      assert.deepEqual(got, [want], key);
    }
    const got = [];
    const q = legacyModelScreen((m) => got.push(m));
    assert.equal(q.cursor, 0, 'the cursor starts on Enduring');
    q.input('ArrowDown'); assert.equal(q.cursor, 1);
    q.input('down'); assert.equal(q.cursor, 2);
    q.input('ArrowDown'); assert.equal(q.cursor, 0, 'down wraps');
    q.input('ArrowUp'); assert.equal(q.cursor, 2, 'up goes back');
    q.input('Enter');
    assert.deepEqual(got, [NO_LINEAGE]);
    // a click in each block answers that block, on the screen's own stacked table
    for (let i = 0; i < 3; i++) {
      const picked = [];
      const s = legacyModelScreen((m) => picked.push(m));
      const mid = s.tops[i] + Math.floor(choiceHeight(s.options[i]) / 2);
      assert.equal(choiceAtNative(160, mid, s.options, s.tops), i);
      assert.equal(s.click(160, mid), true);
      assert.deepEqual(picked, [s.options[i].id]);
    }
    const s = legacyModelScreen(() => {});
    assert.equal(s.click(160, s.tops[3] + 2), false, 'the footer is no answer');
    const r = recorder();
    s.draw(r, CANVAS, FONT);
    assert.ok(r.quads > 0, 'the classic face draws on the canvas');
  });
  // offline: two answers, the fixed pitch, and no third key
  withPage('', () => {
    const got = [];
    const q = legacyModelScreen((m) => got.push(m));
    assert.equal(q.options.length, 2);
    assert.equal(q.tops, null, 'the fixed pitch');
    q.input('Digit3');
    assert.deepEqual(got, [], 'no third answer offline');
    q.input('ArrowUp'); assert.equal(q.cursor, 1, 'with two, either direction moves between them');
    q.input('ArrowDown'); assert.equal(q.cursor, 0);
  });
  // the leveling question keeps its two on the fixed pitch
  const lv = new LevelingChoiceScreen(() => {});
  assert.equal(lv.tops, null);
});

test('LEGACY-CHOICE the popup: on Enhanced Plus the online question wears the Plus window - three tiles in one wide row, their tags, the third answering no lineage', () => {
  _setLevelingFaceClockForTests(() => null, () => {});
  withPage('?skin=enhanced&online', (doc) => {
    const got = [];
    const q = legacyModelScreen((m) => got.push(m));
    q.draw(recorder(), CANVAS, FONT);
    const root = doc.getElementById(LEVELING_FACE_ID);
    assert.ok(root, 'the popup is on the page');
    assert.equal(levelingFaceOwner(), q);
    const win = find(root, 'px-win')[0];
    assert.ok(win.className.split(' ').includes('lvl-three'), 'the wide window for three');
    assert.equal(find(root, 'lvl-title')[0].textContent, LEGACY_CHOICE_FACE.title);
    assert.equal(find(root, 'lvl-hint')[0].textContent, LEGACY_CHOICE_FACE.hint);
    assert.match(LEGACY_CHOICE_FACE.hint, /1, 2 or 3/);
    const tiles = find(root, 'lvl-opt');
    assert.deepEqual(tiles.map((t) => find(t, 'lvl-tag')[0].textContent), ['Not permadeath', 'Permadeath', 'Classic']);
    assert.ok(tiles[0].className.includes('is-on'), 'Enduring chosen first');
    tiles[2].onclick();
    assert.deepEqual(got, [NO_LINEAGE]);
    assert.equal(levelingFaceOwner(), null, 'the popup goes with the answer');
  }, { doc: true });
  withPage('?skin=enhanced', (doc) => {
    const q = legacyModelScreen(() => {});
    q.draw(recorder(), CANVAS, FONT);
    const root = doc.getElementById(LEVELING_FACE_ID);
    assert.ok(!find(root, 'px-win')[0].className.split(' ').includes('lvl-three'), 'offline two, the window as ever');
    assert.equal(find(root, 'lvl-title')[0].textContent, LEGACY_MODEL_FACE.title);
    q.answer(q.defaultId);
  }, { doc: true });
  const css = read('src/ui/enhancedPlusStyle.js');
  assert.match(css, /\.lvl-shell \.px-win\.lvl-three \{ width: min\(1000px, 100%\); \}/);
  assert.match(css, /\.lvl-three \.lvl-opts \{ grid-template-columns: repeat\(auto-fit, minmax\(210px, 1fr\)\); \}/);
  assert.equal(LEGACY_CHOICE_TEXT.lines.length, 2, 'the classic face\'s two lines over the options');
});

// ---- the answer, kept --------------------------------------------------------------------------------------------

const career = {
  name: 'W', hitPointsPerLevel: 12, advancementMultiplier: 1.0,
  strength: 60, intelligence: 40, willpower: 45, agility: 55,
  endurance: 60, personality: 40, speed: 50, luck: 50,
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Dodging, SKILLS.Jumping],
  minorSkills: [SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Medical],
};

test('LEGACY-CHOICE the answer is the character\'s: the chargen door online puts the leveling question then the three-way one, and the answer rides the result onto the character and its save', () => {
  let result = null;
  withPage('?online', () => {
    const w = createChargenWindow(new ChargenFlow([{ name: 'Warrior', career }], () => 0), { onDone: (r) => { result = r; } });
    const key = (code, n = 1) => { for (let i = 0; i < n; i++) w.input(code); };
    key('Enter'); key('KeyM'); key('Enter'); key('Enter');
    for (const c of 'KeyM KeyA KeyC'.split(' ')) w.input(c);
    key('Enter'); key('Enter');
    key('Equal', 6); key('Enter');
    key('Equal', 6); key('ArrowDown', 3);
    key('Equal', 6); key('ArrowDown', 3);
    key('Equal', 6); key('Enter');
    key('Enter'); key('Enter');   // reflexes, summary -> the leveling question (online: always put)
    assert.ok(w.levelingPrompt, 'the leveling question');
    w.input('Enter');
    assert.deepEqual(w.levelingPrompt?.options?.map((o) => o.id), [MODELS.enduring, MODELS.bloodline, NO_LINEAGE], 'then Project Legacy\'s, three ways');
    w.input('char:3');
    assert.equal(w.done, true);
    assert.equal(result.legacyModel, NO_LINEAGE);
    const e = { gender: 'male', race: 'Breton' };
    finishChargen(e, result, null);
    assert.equal(e.legacyChoice, NO_LINEAGE, 'kept on the character');
  });
  for (const answer of [MODELS.enduring, MODELS.bloodline]) {
    const e = { gender: 'male', race: 'Breton' };
    finishChargen(e, { ...result, legacyModel: answer }, null);
    assert.equal(e.legacyChoice, answer);
  }
  for (const none of [undefined, 'nobody']) {
    const e = { gender: 'male', race: 'Breton' };
    finishChargen(e, { ...result, legacyModel: none }, null);
    assert.equal(e.legacyChoice, undefined, `a result the question was not put to carries none: ${none}`);
  }
  // the save carries it, and a save from before it reads as never asked
  const e = ent('c-save', { legacyChoice: NO_LINEAGE });
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(e)));
  assert.equal(snap.legacyChoice, NO_LINEAGE);
  const back = ent('c-save');
  restorePlayer(back, snap);
  assert.equal(back.legacyChoice, NO_LINEAGE);
  const old = { ...snap }; delete old.legacyChoice;
  const oldBack = ent('c-save');
  restorePlayer(oldBack, old);
  assert.equal(oldBack.legacyChoice, undefined);
});

// ---- the law: who is founded ---------------------------------------------------------------------------------------

test('LEGACY-CHOICE the law: no lineage founds no house - at the birth, at any load, in either lane; online a house is founded at a birth alone, so a character loaded with no house (made before, or copied in) plays without one; offline an older character is founded at its first load as ever, into its own answer', () => {
  // online, born: the answer founds its house - or none
  const born = host(ent('r-born'), { online: true });
  assert.equal(born.onCharacterMade(MODELS.bloodline).model, MODELS.bloodline);
  const storage = mem();
  const none = host(ent('r-none', { legacyChoice: NO_LINEAGE }), { online: true, storage });
  assert.equal(none.onCharacterMade(NO_LINEAGE), null, 'no lineage: no house at the birth');
  assert.equal(none.family, null);
  assert.equal(none.afterBoot(), null, 'nor at a load');
  assert.deepEqual(listFamilies(storage), [], 'nothing stored');
  // online, loaded with no house: never founded - whatever its answer or its Features tile
  for (const choice of [undefined, MODELS.enduring, MODELS.bloodline]) {
    const h = host(ent('r-old', choice ? { legacyChoice: choice } : {}), { online: true, tile: 1 });
    assert.equal(h.afterBoot(), null, `online, loaded: no house (${choice})`);
    assert.equal(h.family, null);
  }
  // online, loaded WITH its house: found, never a second
  const shared = mem();
  const first = host(ent('r-kept'), { online: true, storage: shared });
  const fam = first.onCharacterMade(MODELS.enduring);
  const again = host(ent('r-kept'), { online: true, storage: shared });
  assert.equal(again.afterBoot()?.id, fam.id, 'its own house, found');
  // offline: the older character founded at its first load - its own answer over the tile's, the tile's with none;
  // no lineage, never
  assert.equal(host(ent('c-own', { legacyChoice: MODELS.bloodline }), { online: false, tile: 0 }).afterBoot().model, MODELS.bloodline, 'its own answer');
  assert.equal(host(ent('c-tile'), { online: false, tile: 1 }).afterBoot().model, MODELS.bloodline, 'its Features tile\'s (D9)');
  assert.equal(host(ent('c-none', { legacyChoice: NO_LINEAGE }), { online: false, tile: 1 }).afterBoot(), null, 'no lineage offline too (a character copied out keeps it)');
  // a birth no question was put to (the headless door): online's safe Enduring, offline the tile's
  assert.equal(host(ent('r-headless'), { online: true, tile: 1 }).onCharacterMade().model, MODELS.enduring);
  assert.equal(host(ent('c-headless'), { online: false, tile: 1 }).onCharacterMade().model, MODELS.bloodline);
  assert.equal(loadFamily(shared, fam.id)?.id, fam.id);
  _resetModSettings();
});

test('LEGACY-CHOICE the Family tab says why there is no house: no lineage chosen, or online one loaded with none - a new character founds one', () => {
  const prov = (over) => ({ on: () => true, ...over });
  assert.match(noFamilyLine(prov({ choice: () => NO_LINEAGE, online: () => true })), /chose to live without a house\. Make a new character to found one\./);
  assert.match(noFamilyLine(prov({ choice: () => NO_LINEAGE, online: () => false })), /chose to live without a house/);
  assert.match(noFamilyLine(prov({ choice: () => null, online: () => true })), /online, a house is founded only when a character is made\. Make a new character to found one\./);
  assert.match(noFamilyLine(prov({ choice: () => null, online: () => false })), /founded when your character is made, or the first time an older character is loaded/);
  assert.match(noFamilyLine({ on: () => false }), /Turn on Project Legacy/);
  assert.match(noFamilyLine(null), /open this from a game/);
  // the world hands the tab both
  const w = read('src/scenes/world.js');
  assert.match(w, /choice: \(\) => playerEntity\.legacyChoice \?\? null,   \/\/ LEGACY-CHOICE: why a character has no house\n\s*online: \(\) => isOnlinePage\(\),/);
  // the boot's own call is the load, the chargen's the birth
  const h = read('src/scenes/legacyHost.js');
  assert.match(h, /afterBoot: \(\) => found\(null, \{ atLoad: true \}\),/);
  assert.match(h, /onCharacterMade: \(model = null\) => found\(model\),/);
  assert.match(w, /legacyHost\?\.onCharacterMade\(r\.legacyModel \?\? null\);/);
});
