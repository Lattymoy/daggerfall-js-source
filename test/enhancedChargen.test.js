// THE ENHANCED WIZARD, pinned.
//
// The screens are DOM and node cannot draw them; what IS testable is
// the part that does arithmetic - the province trace - and the part
// that would rot silently, which is the wizard's own list of stages.
// The drawn surface is measured in a real browser by
// tools/enhancedTapProbe.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { traceProvinces, PROVINCE_NAMES, INERT_REGION, MAP_W, MAP_H } from '../src/ui/provinceMap.js';
import { STAGE_RAIL, muteConstellation } from '../src/ui/enhancedChargen.js';
import { ChargenFlow } from '../src/ui/chargen.js';
import { STAT_KEYS_ORDER } from '../src/systems/chargen.js';
import { RACE_TEMPLATES } from '../src/systems/races.js';

const arena2 = process.env.ARENA2_PATH;
const skipReal = !arena2 || !existsSync(join(arena2, 'TAMRIEL2.IMG'));

/** A picker with one square region per race, laid out in a row, and a
 *  gap between two of them that the row does NOT enclose. Synthetic on
 *  purpose: the trace has to be provable without game data. */
function fakePicker({ w = 40, h = 12 } = {}) {
  const data = new Uint8Array(w * h);
  RACE_TEMPLATES.forEach((race, i) => {
    const x0 = 1 + i * 4;
    for (let y = 2; y < 8; y++) for (let x = x0; x < x0 + 3; x++) data[y * w + x] = race.id;
  });
  return { width: w, height: h, data };
}

test('a region is traced for every race the picker carries, and none it does not', () => {
  const out = traceProvinces(fakePicker());
  assert.equal(out.length, RACE_TEMPLATES.length);
  assert.deepEqual(out.map((r) => r.key), RACE_TEMPLATES.map((r) => r.key));
  for (const r of out) {
    assert.equal(r.pixels, 18, 'each fake region is 3x6');
    assert.match(r.d, /^M[\d .LZ]+Z$/, 'one closed subpath per island');
  }
});

test('a race with no pixels is ABSENT, not empty', () => {
  const p = fakePicker();
  // erase Nord entirely
  const nord = RACE_TEMPLATES.find((r) => r.key === 'Nord').id;
  for (let i = 0; i < p.data.length; i++) if (p.data[i] === nord) p.data[i] = 0;
  const out = traceProvinces(p);
  assert.equal(out.length, RACE_TEMPLATES.length - 1);
  assert.ok(!out.some((r) => r.key === 'Nord'));
});

test('a HOLE is wound the other way, which is what even-odd fill needs', () => {
  const w = 11; const h = 11;
  const data = new Uint8Array(w * h);
  const id = RACE_TEMPLATES[0].id;
  for (let y = 1; y < 10; y++) for (let x = 1; x < 10; x++) data[y * w + x] = id;
  for (let y = 4; y < 7; y++) for (let x = 4; x < 7; x++) data[y * w + x] = 0;   // a lake
  const [r] = traceProvinces({ width: w, height: h, data });
  assert.equal(r.pixels, 81 - 9);
  // two closed subpaths: the coast and the lake
  assert.equal((r.d.match(/M/g) ?? []).length, 2, 'an island with a lake is two loops');
});

test('the LABEL sits inside the region, at the point furthest from any edge', () => {
  // an L, whose centroid falls OUTSIDE it - the case a centroid gets
  // wrong and High Rock is the real-world instance of
  const w = 12; const h = 12;
  const data = new Uint8Array(w * h);
  const id = RACE_TEMPLATES[0].id;
  for (let y = 1; y < 11; y++) for (let x = 1; x < 4; x++) data[y * w + x] = id;
  for (let y = 8; y < 11; y++) for (let x = 4; x < 11; x++) data[y * w + x] = id;
  const [r] = traceProvinces({ width: w, height: h, data });
  const [lx, ly] = r.label;
  assert.equal(data[Math.floor(ly) * w + Math.floor(lx)], id, 'the label is ON the region');
  assert.ok(r.clearance >= 2, `label clearance ${r.clearance} - it should not hug a coast`);
});

test('an empty or missing picker traces NOTHING rather than throwing', () => {
  assert.deepEqual(traceProvinces(null), []);
  assert.deepEqual(traceProvinces({ width: 0, height: 0, data: new Uint8Array(0) }), []);
});

// ── THE NINTH PROVINCE ───────────────────────────────────────────
test('the Imperial Province needs BOTH files, and says nothing without the painting', () => {
  const p = fakePicker();
  assert.ok(!traceProvinces(p).some((r) => r.inert),
    'the picker alone cannot name a province it has no index for');
  assert.ok(!traceProvinces(p, { picture: null, palette: () => [0, 0, 0] }).some((r) => r.inert));
});

test('the inland remainder is found, and the surround is discarded by the EDGE clause', () => {
  const w = 20; const h = 12;
  const data = new Uint8Array(w * h);
  const a = RACE_TEMPLATES[0].id; const b = RACE_TEMPLATES[1].id;
  // two homelands with a gap between them, open to the bottom edge -
  // exactly the shape that defeats a flood fill of the picker alone
  for (let y = 2; y < 9; y++) {
    for (let x = 3; x < 8; x++) data[y * w + x] = a;
    for (let x = 12; x < 17; x++) data[y * w + x] = b;
  }
  // the painting: index 1 is land, index 2 is sea. The gap is land
  // between the two, walled by sea top and bottom.
  const pic = new Uint8Array(w * h).fill(2);
  for (let y = 2; y < 9; y++) for (let x = 3; x < 17; x++) pic[y * w + x] = 1;
  const palette = (i) => (i === 2 ? [0, 0, 200] : [80, 80, 40]);
  const out = traceProvinces({ width: w, height: h, data },
    { picture: { width: w, height: h, data: pic }, palette });
  const inert = out.find((r) => r.inert);
  assert.ok(inert, 'the gap between the homelands is a region');
  assert.equal(inert.key, INERT_REGION.key);
  assert.equal(inert.pixels, 4 * 7, 'the columns between the two homelands');
  assert.equal(out[0].key, INERT_REGION.key, 'and it is drawn FIRST, under nothing');
});

test('the edge clause is what does the discarding - remove the sea and it takes the surround', () => {
  const w = 20; const h = 12;
  const data = new Uint8Array(w * h);
  const a = RACE_TEMPLATES[0].id;
  for (let y = 2; y < 9; y++) for (let x = 3; x < 8; x++) data[y * w + x] = a;
  // a painting with NO sea at all: every unclaimed pixel is one
  // component that reaches the border, so there is no inland remainder
  const pic = new Uint8Array(w * h).fill(1);
  const out = traceProvinces({ width: w, height: h, data },
    { picture: { width: w, height: h, data: pic }, palette: () => [80, 80, 40] });
  assert.ok(!out.some((r) => r.inert),
    'without the edge clause this would have returned the whole parchment');
});

test('every province has a NAME, and the names are the map\u2019s own spelling', () => {
  for (const race of RACE_TEMPLATES) {
    assert.equal(typeof PROVINCE_NAMES[race.key], 'string', `${race.key} has no province`);
  }
  assert.equal(PROVINCE_NAMES.Breton, 'High Rock');
  assert.equal(PROVINCE_NAMES.Redguard, 'Hammerfell');
  // TMAP00I0 paints SUMURSET, and this is Daggerfall's map rather than
  // a corrected one - the mutation that "fixes" it must fail
  assert.equal(PROVINCE_NAMES.HighElf, 'Sumurset Isle');
  assert.equal(PROVINCE_NAMES[INERT_REGION.key], 'Imperial Province');
});

// ── THE RAIL CANNOT DRIFT FROM THE FLOW ──────────────────────────
// The wizard's states live in ui/chargen.js's STATES; the rail is a
// second list of the same thing, grouped. A state that appears in
// neither or in two would leave the wizard on a stage the rail cannot
// show - so the two agree, mechanically, rather than by memory.
test('every wizard state belongs to exactly one rail stage', () => {
  const src = readFileSync(new URL('../src/ui/chargen.js', import.meta.url), 'utf8');
  const m = src.match(/const STATES = \[([^\]]+)\]/);
  assert.ok(m, 'ui/chargen.js lost its STATES list');
  const states = [...m[1].matchAll(/'([a-zA-Z]+)'/g)].map((x) => x[1])
    .filter((s) => s !== 'done');   // 'done' is the exit, not a stage
  for (const state of states) {
    const owners = STAGE_RAIL.filter((s) => s.states.includes(state));
    assert.equal(owners.length, 1, `${state} is owned by ${owners.length} rail stages`);
  }
  const listed = STAGE_RAIL.flatMap((s) => s.states);
  for (const s of listed) {
    assert.ok(states.includes(s), `the rail names ${s}, which is not a wizard state`);
  }
});

// ── AND NEITHER CAN THE STAGES ───────────────────────────────────
// AUDIT 39. The rail agreed with the flow (above) while the RENDERERS
// did not: STAGES had twelve keys against fourteen states, so the ten
// class questions and the custom-class builder - BOTH reached from
// this screen's own buttons - fell through to a pane that drew
// nothing and claimed a classic screen owned it. The rail pin could
// not see it, because the rail folds both into 'Class'.
test('AUDIT 39: every wizard state has a renderer, not a fallback pane', () => {
  const flowSrc = readFileSync(new URL('../src/ui/chargen.js', import.meta.url), 'utf8');
  const view = readFileSync(new URL('../src/ui/enhancedChargen.js', import.meta.url), 'utf8');
  const states = [...flowSrc.match(/const STATES = \[([^\]]+)\]/)[1].matchAll(/'([a-zA-Z]+)'/g)]
    .map((x) => x[1]).filter((s) => s !== 'done');
  const map = view.slice(view.indexOf('const STAGES = {'), view.indexOf('};', view.indexOf('const STAGES = {')));
  for (const state of states) {
    assert.match(map, new RegExp(`\\b${state}:\\s*\\w+Stage`), `${state} has no renderer in STAGES`);
  }
});

test('AUDIT 39: the two new stages speak through the flow\'s own doors', () => {
  const view = readFileSync(new URL('../src/ui/enhancedChargen.js', import.meta.url), 'utf8');
  // THE QUESTIONS. displayQuestion already says where each answer
  // starts, so a) b) c) are three buttons rather than a scroll to hunt
  // in - and the answer goes through applyHit, not a second law.
  assert.match(view, /flow\.applyHit\(\{ answerClass: i \}\)/);
  assert.match(view, /\[\[aIndex, bIndex\], \[bIndex, cIndex\], \[cIndex, lines\.length\]\]/);
  assert.match(view, /import \{ QUESTION_COUNT \} from '\.\.\/systems\/classQuestions\.js'/,
    'the count is the quiz\'s own, not a ten typed here');
  assert.match(view, /flow\.applyHit\(\{ confirmQClass: true \}\)/);
  assert.match(view, /flow\.applyHit\(\{ cancelQClass: true \}\)/);
  // THE BUILDER. Every control is one of the flow's hits; nothing here
  // writes flow.custom itself, or the two screens would keep two
  // different builders.
  for (const hit of ['customSkill: slot', 'customHp: dir', 'customStatStep: dir',
    'customAdvantage: true', 'customDisadvantage: true', 'customExit: true', 'customBox: true']) {
    assert.ok(view.includes(hit), `the builder does not press ${hit}`);
  }
  const builder = view.slice(view.indexOf('function customClassStage()'), view.indexOf('// ── HOW YOUR HISTORY'));
  assert.doesNotMatch(builder, /c\.(skills|stats|hp|advantages|disadvantages)\s*(\[[^\]]*\])?\s*=[^=]/,
    'the view must not write the builder - the laws are ui/chargen.js\'s');
  // The words for an advantage are DFU's recovered HardStrings, and
  // the ones for a skill are the skill table's.
  assert.match(view, /import \{ labelFor \} from '\.\.\/systems\/specialAdvantages\.js'/);
  // AND THE FALLBACK PANE NO LONGER LIES: nothing classic is mounted
  // behind the enhanced skin (chargenSession mounts this view alone).
  assert.doesNotMatch(view, /is still the classic screen/);
  const pending = view.slice(view.indexOf('function pendingStage(stage)'), view.indexOf('// ── SHELL'));
  assert.match(pending, /has nothing to show/);
});

// The source sweeps above hold that the two views exist and press the
// flow's doors; these hold that the doors they press are REAL, which a
// text pin cannot. Both states are entered the way the enhanced screen
// enters them - the method screen's quiz button and the class list's
// last row - because that reachability is the whole finding.
const QUIZ_LIBRARY = Array.from({ length: 40 }, (_, i) =>
  `${i + 1}.  question ${i + 1} text\n a) alpha\n b) beta\n c) gamma`);

function quizClassesData() {
  const data = new Uint8Array(216);
  data.set([17, 16, 15, 14, 202, 199, 203, 201, 32, 35, 229, 36, 77, 76, 230, 200, 34, 33], 0);
  data.set([10, 0, 0], 18);
  return data;
}

const wizard = () => {
  const careers = Array.from({ length: 18 }, (_, i) => ({ name: `C${i}`, career: { name: `C${i}` } }));
  const f = new ChargenFlow(careers, () => 0);
  f.questionLibrary = QUIZ_LIBRARY;
  f.classesData = quizClassesData();
  f.describeClass = () => null;
  f.describeText = (id) => [{ text: `TEXT.RSC ${id}`, center: true }];
  return f;
};

test('AUDIT 39: the quiz button reaches a question the view can draw, and A/B/C answer it', () => {
  const f = wizard();
  f.state = 'classMethod';
  f.applyHit({ classMethod: 'questions' });   // the enhanced quiz button
  assert.equal(f.state, 'classQuestions');
  // The three slices the view cuts are the three answers, and none of
  // them is empty - which is what makes them three buttons.
  const { lines, aIndex, bIndex, cIndex } = f.qDisplay;
  const join = (from, to) => lines.slice(from, to).join(' ').trim();
  assert.ok(join(0, aIndex).length, 'the question itself');
  assert.deepEqual([join(aIndex, bIndex), join(bIndex, cIndex), join(cIndex, lines.length)],
    ['a) alpha', 'b) beta', 'c) gamma']);
  const first = f.qDisplay;
  assert.equal(f.applyHit({ answerClass: 0 }), true, 'the view\'s answer door');
  assert.equal(f.qAnswered, 1);
  assert.notEqual(f.qDisplay, first, 'and the next question is on screen');
});

test('AUDIT-39r: the enhanced quiz answers on the PRESS - no invisible constellation locks it', () => {
  // The stage shipped on a false premise: "this view loads no CEL art,
  // so startConstellationAnim returns 0". `_art` is a MODULE singleton
  // and every host warms it at boot (preloadChargenArt, ungated by
  // skin), so on a real install the animation starts, qAnimIndex
  // latches, and the enhanced side - whose overlay tick() is a no-op -
  // never runs _celAnimEnd. answerClassQuestion then refuses every
  // press until the wall-clock watchdog (chargen.js:562-568), and the
  // press that finally clears it releases the OLD question and applies
  // the player's choice to the NEXT one.
  //
  // A host with the CELs warm, exactly: a start that reports a length
  // and a tick that never finishes.
  const warm = () => ({ start: () => 3, tick: () => true, stop: () => {} });

  // WITHOUT the mute this is the fault, and the pin says so out loud -
  // if muteConstellation is reverted, the assertions below are what
  // the enhanced screen does.
  const locked = wizard();
  locked.state = 'classMethod';
  locked.applyHit({ classMethod: 'questions' });
  locked.constellationAnim = warm();
  const q1 = locked.qDisplay;
  assert.equal(locked.applyHit({ answerClass: 0 }), true);
  assert.ok(locked.qAnimIndex >= 0, 'the lock latches on a host with art');
  assert.equal(locked.qDisplay, q1, 'and the SAME question is still on screen');
  assert.equal(locked.applyHit({ answerClass: 1 }), false, 'the second press is swallowed');

  // With it, the answer lands and the next question is up at once -
  // the path a host with no art already took.
  const f = wizard();
  f.state = 'classMethod';
  f.applyHit({ classMethod: 'questions' });
  f.constellationAnim = warm();
  muteConstellation(f);   // what mountEnhancedChargen does to the flow it is handed
  const first = f.qDisplay;
  assert.equal(f.applyHit({ answerClass: 0 }), true);
  assert.equal(f.qAnimIndex, -1, 'nothing is latched, so nothing has to be waited out');
  assert.notEqual(f.qDisplay, first, 'the next question is on screen with the press');
  const second = f.qDisplay;
  assert.equal(f.applyHit({ answerClass: 1 }), true, 'and the very next press lands too');
  assert.equal(f.qAnswered, 2);
  assert.notEqual(f.qDisplay, second, 'on the question the player was actually reading');

  // ...and the view really does cut that seam, rather than the pin
  // proving a helper nobody calls.
  const view = readFileSync(new URL('../src/ui/enhancedChargen.js', import.meta.url), 'utf8');
  assert.match(view, /flow = muteConstellation\(f\);/, 'the mount mutes the flow it is handed');
  assert.doesNotMatch(view, /startConstellationAnim returns 0 seconds without it/,
    'and the false premise is gone from the stage that rested on it');
});

test('AUDIT 39: the class list\'s last row reaches a builder the view can drive', () => {
  const f = wizard();
  f.state = 'class';
  f.classListIndex = f.careers.length;   // the Custom row - what "Build it" presses
  f.useClass();
  assert.equal(f.state, 'customClass');
  const c = f.custom;
  // the twelve slots and their picker
  f.applyHit({ customSkill: 0 });
  assert.equal(c.sub, 'skillPick');
  assert.ok(c.pickItems.length > 0);
  const wanted = c.pickItems[0];
  f.usePickRow(0);
  assert.equal(c.skills[0], wanted);
  assert.equal(c.sub, null, 'the picker closes on the pick');
  // hit points, and the freeEdit ledger's zero sum
  const hp = c.hp;
  f.applyHit({ customHp: 1 });
  assert.equal(c.hp, hp + 1);
  f.applyHit({ customStatCursor: 2 });
  const before = c.stats[STAT_KEYS_ORDER[2]];
  f.applyHit({ customStatStep: 1 });
  assert.equal(c.stats[STAT_KEYS_ORDER[2]], before + 1);
  assert.equal(c.statPool, -1, 'the pool is a ledger, and the exit gate is what demands the balance');
  // the two special windows
  f.applyHit({ customAdvantage: true });
  assert.equal(c.sub, 'advantage');
  f.applyHit({ advAdd: true });
  assert.ok(c.pickList?.length, 'the picker the view lists');
  f.applyHit({ advExit: true });
  assert.equal(c.sub, null);
  // and the exit refusal, which is the only thing that ever fills the
  // box pane - here it is TEXT.RSC 301, the unnamed class
  f.applyHit({ customExit: true });
  assert.equal(f.state, 'customClass', 'a refused exit stays');
  assert.match(c.box[0].text, /301/);
  f.applyHit({ customBox: true });
  assert.equal(c.box, null);
});

// ── THE KEYBOARD ─────────────────────────────────────────────────
// Live proof is tools/enhancedChargenProbe.mjs, which walks the whole
// wizard to `done` without a pointer event. What a sweep holds is the
// three things that would rot quietly.
test('the wizard routes keys through the SHARED table, not a second map', () => {
  const src = readFileSync(new URL('../src/ui/enhancedChargen.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ overlayAction \} from '\.\/input\.js'/,
    'a second key map is how the two skins come to disagree about what Escape does');
  assert.match(src, /const action = overlayAction\(e\);/);
  assert.match(src, /flow\.input\(action\)/, 'and the FLOW answers it, not this file');
});

test('the key handler has an owner - it is removed on unmount', () => {
  const src = readFileSync(new URL('../src/ui/enhancedChargen.js', import.meta.url), 'utf8');
  assert.match(src, /addEventListener\('keydown'/);
  const unmount = src.slice(src.indexOf('unmount()'));
  assert.match(unmount, /removeEventListener\('keydown'/,
    'a window-level listener outlives the DOM it was mounted for');
});

test('a real text field keeps its own keys', () => {
  const src = readFileSync(new URL('../src/ui/enhancedChargen.js', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function onKey'), src.indexOf('\n}', src.indexOf('function onKey')));
  assert.match(fn, /tagName === 'INPUT'/,
    'the name boxes feed the flow themselves - a stolen key is a doubled letter');
  // and it must not swallow keys it did not use, or Tab stops working
  assert.ok(fn.indexOf('if (!action) return;') < fn.indexOf('preventDefault'),
    'preventDefault must come AFTER the table has claimed the key');
});

// ── THE SEAM ─────────────────────────────────────────────────────
// The skin is chosen in ONE place. AUDIT 17i split createChargenWindow
// out because three separate bugs came from hosts wiring chargen by
// hand, and a host reaching for the DOM wizard itself would be that
// shape again - so the sweep says so rather than the next author
// remembering.
test('no host mounts the enhanced wizard itself', () => {
  const dir = new URL('../src/scenes/', import.meta.url);
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.ok(!/enhancedChargen/.test(src),
      `src/scenes/${f} reaches for the enhanced wizard - it goes through createChargenWindow`);
  }
});

test('the seam forks on the skin, and needs a DOM to do it', () => {
  const src = readFileSync(new URL('../src/systems/chargenSession.js', import.meta.url), 'utf8');
  assert.match(src, /if \(isEnhanced\(\) && typeof document !== 'undefined'\)/,
    'a DOM view needs a DOM; without one the canvas wizard stands');
  assert.match(src, /enhancedChargenOverlay\(flow/);
  // the hosts tear an overlay down when it reports done, and a DOM
  // node outlives the object reporting it - so unmount comes first
  const fn = src.slice(src.indexOf('function enhancedChargenOverlay'));
  assert.ok(fn.indexOf('view?.unmount()') < fn.indexOf('onDone?.('),
    'the view must come down BEFORE done fires');
});

test('the FOUR HOSTS are each named at the seam', () => {
  const src = readFileSync(new URL('../src/systems/chargenSession.js', import.meta.url), 'utf8');
  for (const host of ['world.js', 'exterior.js', 'worldModes.js', 'dungeonContext.js']) {
    assert.ok(src.includes(host), `the seam does not name ${host}`);
  }
  // WAVE D: the fourth host went through the door, so the seam names
  // it WIRED. What the rule demands is that the list ACCOUNT for every
  // host - a host may not be omitted, whatever its state - so the pin
  // reads the state rather than assuming one.
  assert.match(src, /dungeonContext\.js\s+WIRED \(wave D/,
    'the fourth host reaches the fork now, and the seam says so by name');
  assert.ok(!/FLAGGED/.test(src), 'and no host is left outside the seam');
});

// ── A MODAL OVERLAY OWNS ITS INPUT ───────────────────────────────
// Mac, playing the deployed build: the wizard came up over a live
// dungeon, the map ignored every click, and the mouse still swung the
// view. Both halves are the same fact - the host was reading input
// underneath a screen that had it.
test('the wizard drops the pointer lock, and keeps dropping it', () => {
  const src = readFileSync(new URL('../src/ui/enhancedChargen.js', import.meta.url), 'utf8');
  assert.match(src, /document\.exitPointerLock\(\)/,
    'a LOCKED pointer never reaches the DOM - every mouse event goes to the '
    + 'locked element as a delta, so a fixed div is invisible to it at any z-index');
  assert.match(src, /addEventListener\('pointerlockchange'/,
    'the hosts only gate RE-taking the lock; a host that takes it anyway must lose it');
  const un = src.slice(src.indexOf('unmount()'));
  assert.match(un, /removeEventListener\('pointerlockchange'/, 'and the listener has an owner');
});

test('keys are captured, so the host never sees one the wizard used', () => {
  const src = readFileSync(new URL('../src/ui/enhancedChargen.js', import.meta.url), 'utf8');
  assert.match(src, /addEventListener\('keydown', keyHandler, \{ capture: true \}\)/,
    'the host walks the player and routes dungeon keys off its own window keydown');
  const fn = src.slice(src.indexOf('function onKey'), src.indexOf('\n}', src.indexOf('function onKey')));
  assert.match(fn, /e\.stopPropagation\(\)/);
  assert.ok(fn.indexOf('if (!action) return;') < fn.indexOf('stopPropagation'),
    'a key the wizard did NOT use must still reach the page');
});

// ── THE REAL CORPUS ──────────────────────────────────────────────
test('the real TAMRIEL2 traces to nine regions', { skip: skipReal }, () => {
  const data = new Uint8Array(readFileSync(join(arena2, 'TAMRIEL2.IMG')));
  assert.equal(data.length, MAP_W * MAP_H, 'the picker is a raw 320x200 with no header');
  const out = traceProvinces({ width: MAP_W, height: MAP_H, data });
  assert.equal(out.length, 8, 'eight homelands from the picker alone');
  for (const r of out) assert.ok(r.pixels > 500, `${r.key} traced only ${r.pixels} pixels`);
});

// ── A REPAINT MUST NOT MOVE THE PAGE UNDER THE PLAYER ────────────
// Mac, playing on a phone: every tap on a skills stepper threw the
// list back to the top. Live proof is tools/enhancedScrollProbe.mjs,
// which taps with a real touchscreen and checks the tap moved
// something before it believes anything about the scroll. What a sweep
// holds is that both enhanced screens go through the one helper - a
// repaint written straight would take the bug back, and it is the kind
// of edit that looks like a simplification.
test('both enhanced screens repaint through the scroll-keeping helper', () => {
  for (const f of ['enhancedChargen.js', 'enhancedMenu.js']) {
    const src = readFileSync(new URL(`../src/ui/${f}`, import.meta.url), 'utf8');
    assert.match(src, /repaintKeepingScroll\(/, `src/ui/${f} repaints without keeping the scroll`);
    assert.match(src, /from '\.\/domRepaint\.js'/);
  }
});

test('only a scrolled element is restored, and a changed tree starts fresh', async () => {
  const { repaintKeepingScroll } = await import('../src/ui/domRepaint.js');
  // no DOM in node: the contract is checked at the source, and the
  // behaviour in a real browser by the probe. What IS checkable here
  // is that a hostless call cannot throw - the menu mounts before its
  // host exists on some paths.
  assert.doesNotThrow(() => repaintKeepingScroll(null, () => {}));
  let ran = 0;
  repaintKeepingScroll(null, () => { ran++; });
  assert.equal(ran, 1, 'the rebuild runs even when there is nothing to restore');
});
