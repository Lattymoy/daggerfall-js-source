// ═══════════════════════════════════════════════════════════════════
// ENHANCED — CHARACTER CREATION
//
// THE FLOW IS NOT REBUILT. ui/chargen.js's ChargenFlow carries every
// law of DFU's wizard - the eleven stages in DaggerfallStartNewGame-
// Wizard's own enum order, the stat and skill pools, the biography
// grammar, the class questions, the custom-class builder, and the
// back arms AUDIT 17j spent seven findings getting right - and it is
// pinned across five test files. None of that is touched here.
//
// This is a VIEW. It reads flow state and speaks back through
// flow.applyHit() and flow.input(), the same two doors the classic
// screens use, so the two skins cannot disagree about what the wizard
// does. It is the settings split again: ~1900 lines of law reused,
// only the drawing replaced.
//
// ── ONE STAGE AT A TIME ──────────────────────────────────────────
//
// Design pieces one by one; bulk design is forbidden here for the
// reason it usually is - fifteen screens designed at once are fifteen
// screens nobody looked at. This carries the CHROME (the stage rail,
// the action bar, the button language) and the FIRST stage, the race
// map, which is the one Mac named. Every other stage says plainly
// that it has not been redesigned yet rather than showing a
// half-built version of itself.
//
// ── THE MAP ──────────────────────────────────────────────────────
//
// Vector, traced at runtime from the player's own TAMRIEL2.IMG - see
// ui/provinceMap.js for why that file and why no smoothing. The
// classic screen draws a 320x200 picture and reads a pixel to find
// out what you clicked; this draws eight shapes that know their own
// race, so a province can light up under a cursor, carry its name at
// a readable size, and answer a thumb at any scale.
//
// A path resolves to the race whose mask it was traced FROM, so there
// is no second geography to keep in step. At an anti-aliased edge the
// two differ in one direction only and harmlessly: the classic pixel
// read returns 0 and nothing happens, where a path click lands on the
// province you can see.
// ═══════════════════════════════════════════════════════════════════

import { RACE_TEMPLATES } from '../systems/races.js';
import { CLASS_DESCRIPTION_TEXT_ID } from './chargenArt.js';   // ONE DFU MEMBER, ONE EXPORT
import { generateBackstory } from '../systems/biography.js';
import { FACES_PER_RACE } from '../systems/races.js';
import { bitmapCanvas } from './bitmapCanvas.js';
import { STAT_KEYS_ORDER } from '../systems/chargen.js';
import { SKILL_NAMES } from '../systems/skills.js';
import { NAME_MAX_CHARACTERS as NAME_MAX } from './chargen.js';
import { traceProvinces, MAP_W, MAP_H, PROVINCE_NAMES } from './provinceMap.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';

/** DFU's WizardStages, in the order the flow walks them, with the
 *  words a player reads. The flow's own state names are the keys.
 *  `classMethod`/`bioMethod` and the two question paths are stages of
 *  the wizard but not of the JOURNEY - they are how you answer the
 *  stage before them - so the rail folds them into their parent. */
export const STAGE_RAIL = Object.freeze([
  { id: 'race', label: 'Homeland', states: ['race'] },
  { id: 'gender', label: 'Sex', states: ['gender'] },
  { id: 'class', label: 'Class', states: ['classMethod', 'classQuestions', 'class', 'customClass'] },
  { id: 'biography', label: 'History', states: ['bioMethod', 'biography'] },
  { id: 'name', label: 'Name', states: ['name'] },
  { id: 'face', label: 'Face', states: ['face'] },
  { id: 'stats', label: 'Attributes', states: ['stats'] },
  { id: 'skills', label: 'Skills', states: ['skills'] },
  { id: 'reflexes', label: 'Reflexes', states: ['reflexes'] },
  { id: 'summary', label: 'Review', states: ['summary'] },
]);

const stageOf = (state) => STAGE_RAIL.findIndex((s) => s.states.includes(state));

const el = (t, cls, txt) => {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};
const svg = (t, attrs = {}) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg', t);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

let host = null;
let flow = null;
let faces = null;       // { key, canvases[] } for the current identity
let loadFaces = null;   // (raceKey, gender) => Promise<DFBitmap[]>
let provinces = [];
let hover = null;      // the race key under the cursor, for the readout
let onExit = () => {};

// ── THE MAP ──────────────────────────────────────────────────────

function mapPane() {
  const wrap = el('div', 'mappane');

  if (!provinces.length) {
    // NEVER TRAPS, the law every art-backed screen here follows: no
    // TAMRIEL2 means no map, and the eight homelands become a plain
    // list rather than a blank rectangle. A missing file costs the
    // picture, never the character.
    const list = el('div', 'racegrid');
    for (const race of RACE_TEMPLATES) {
      const b = el('button', `racecell${race.key === flow.race.key ? ' on' : ''}`, race.name);
      b.onclick = () => pick(race.key);
      list.append(b);
    }
    wrap.append(el('p', 'mapnote', 'The province map needs TAMRIEL2.IMG. Choose a homeland by name instead.'));
    wrap.append(list);
    return wrap;
  }

  const frame = svg('svg', {
    viewBox: `0 0 ${MAP_W} ${MAP_H}`,
    class: 'map',
    preserveAspectRatio: 'xMidYMid meet',
  });
  const sel = flow.race.key;
  for (const p of provinces) {
    // The listeners go on the PATH, not on a wrapping group: a group's
    // box is its bounding rectangle and Tamriel's provinces are not
    // rectangles, so a hover on the sea inside High Rock's bounds
    // would have lit High Rock.
    const path = svg('path', {
      d: p.d, 'fill-rule': 'evenodd',
      class: `prov${p.inert ? ' inert' : ''}${p.key === sel ? ' on' : ''}${p.key === hover ? ' hot' : ''}`,
    });
    // The Imperial Province is drawn and NOT offered: no homeland, no
    // hover, no press. It is there because Tamriel is there.
    if (!p.inert) {
      path.addEventListener('pointerenter', () => { hover = p.key; paint(); });
      path.addEventListener('pointerleave', () => { if (hover === p.key) { hover = null; paint(); } });
      path.addEventListener('click', () => pick(p.key));
    }
    frame.append(path);
  }
  // Labels last so no coastline crosses a word, and sized in map units
  // so they scale with the picture rather than pinning it to one size.
  for (const p of provinces) {
    const t = svg('text', {
      x: p.label[0], y: p.label[1],
      class: `provlabel${p.inert ? ' inert' : ''}${p.key === sel ? ' on' : ''}`,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
    });
    t.textContent = p.name;
    if (!p.inert) t.addEventListener('click', () => pick(p.key));
    frame.append(t);
  }
  wrap.append(frame);
  return wrap;
}

/** A province press. The flow owns what happens next: setRace records
 *  it, plays the race's clip and OPENS the description - DFU does not
 *  accept a homeland on the click (CreateCharRaceSelect's Yes/No), and
 *  neither do we. Only the shape of the box is ours. */
function pick(raceKey) {
  const race = RACE_TEMPLATES.find((r) => r.key === raceKey);
  flow.applyHit({ setRace: raceKey, describe: flow.describeRace?.(race) ?? null });
  paint();
}

function raceStage() {
  const pane = el('div', 'stagebody');
  pane.append(mapPane());

  // THE DETAIL IS ONLY A SHEET WHEN IT HAS TO BE. On a desk it is the
  // third column and always present. On a phone it is one column, so
  // the prompt sits INLINE under the map and only the description -
  // which is long, modal in DFU, and raised by the press that chose a
  // province - comes up over it. A prompt that lived off-screen behind
  // a sheet would leave a phone showing a map and nothing else.
  const detail = el('div', `detail${flow.raceConfirm ? ' sheet open' : ''}`);
  const close = el('button', 'sheet-close', 'Back to the map');
  close.onclick = () => { flow.applyHit({ cancelRace: true }); paint(); };
  detail.append(close);

  if (flow.raceConfirm) {
    const d = el('div', 'dcard');
    d.append(el('h3', null, `${PROVINCE_NAMES[flow.race.key] ?? flow.race.name} \u00b7 ${flow.race.name}`));
    for (const line of flow.raceConfirm) {
      const text = typeof line === 'string' ? line : line.text;
      if (text?.trim()) d.append(el('p', null, text));
    }
    const a = el('div', 'acts');
    const yes = el('button', 'act primary', `Play as ${flow.race.name}`);
    yes.onclick = () => { flow.input('confirm'); paint(); };
    const no = el('button', 'act', 'Choose again');
    no.onclick = () => { flow.applyHit({ cancelRace: true }); paint(); };
    a.append(yes, no);
    d.append(a);
    detail.append(d);
  } else {
    const d = el('div', 'dcard');
    // The MAP says the place; the readout says the people. Naming both
    // in one line is what makes "Hammerfell" and "Redguard" the same
    // answer to the same question.
    const who = hover ? RACE_TEMPLATES.find((r) => r.key === hover) : null;
    d.append(el('h3', null, who ? PROVINCE_NAMES[who.key] : 'Where are you from?'));
    d.append(el('p', null, who
      ? `Home of the ${who.name}. Press to read what it means to be born here.`
      : 'Your homeland sets your face, your name and how much of Tamriel greets you kindly.'));
    detail.append(d);
  }
  pane.append(detail);
  return pane;
}

// ── SEX ──────────────────────────────────────────────────────────
// DFU's is a two-button message box, and the buttons SET AND CLOSE -
// there is no separate confirm (U14 found the port had invented one).
// Two choices deserve two large targets and nothing else on the
// screen, so this is the one stage that is only its own question.
function genderStage() {
  const pane = el('div', 'stagebody solo');
  const wrap = el('div', 'choose');
  wrap.append(el('h2', null, 'Are you a man or a woman?'));
  const row = el('div', 'bigchoice');
  for (const [key, label] of [['male', 'Man'], ['female', 'Woman']]) {
    const b = el('button', `bigbtn${flow.gender === key ? ' on' : ''}`, label);
    b.onclick = () => { flow.applyHit({ setGender: key }); paint(); };
    row.append(b);
  }
  wrap.append(row);
  pane.append(wrap);
  return pane;
}

// ── HOW YOU CHOOSE A CLASS ───────────────────────────────────────
// WizardStages.SelectClassMethod. DFU's BUTN01I0 screen: pick from the
// list, or answer the questions and be told what you are. Both buttons
// close, and an Escape goes to the LIST rather than back - the
// OnClose has no cancelled arm at all (U18).
function classMethodStage() {
  const pane = el('div', 'stagebody solo');
  const wrap = el('div', 'choose');
  wrap.append(el('h2', null, 'How do you want to choose?'));
  const row = el('div', 'bigchoice tall');
  const list = el('button', 'bigbtn');
  list.append(el('span', 'bigk', 'Choose from a list'));
  list.append(el('span', 'bign', 'The eighteen classic classes, or build your own.'));
  list.onclick = () => { flow.applyHit({ classMethod: 'list' }); paint(); };
  const quiz = el('button', 'bigbtn');
  quiz.append(el('span', 'bigk', 'Answer ten questions'));
  quiz.append(el('span', 'bign', 'The game picks a class from your answers.'));
  quiz.onclick = () => { flow.applyHit({ classMethod: 'questions' }); paint(); };
  row.append(list, quiz);
  wrap.append(row);
  pane.append(wrap);
  return pane;
}

// ── THE CLASS LIST ───────────────────────────────────────────────
// A ListBox with two gestures, which U17 landed after Mac reported
// double-tap not working: MouseClick SELECTS, MouseDoubleClick USES,
// and picking is not choosing - OnItemPicked opens the class
// DESCRIPTION in a Yes/No box on TEXT.RSC 2100 + index.
//
// A list on a phone does not need a double tap to mean something
// different from a single one, so the enhanced screen gives the second
// gesture its own BUTTON and lets a tap select. The flow's own
// clickClassRow is still what a tap calls, double-tap included, so the
// classic gesture keeps working for anyone who uses it.
function classStage() {
  const pane = el('div', 'stagebody');

  const list = el('div', 'list');
  for (let i = 0; i < flow.classRowCount(); i++) {
    const name = flow.classRowName(i);
    const row = el('div', `row${i === flow.classListIndex ? ' on' : ''}`);
    const main = el('button', 'row-main');
    main.append(el('div', 'row-name', name));
    if (i === flow.careers.length) main.append(el('div', 'row-sub', 'Build a class of your own'));
    main.onclick = () => { flow.clickClassRow(i, flow._now()); paint(); };
    row.append(main);
    list.append(row);
  }
  pane.append(list);

  const detail = el('div', `detail${flow.classConfirm ? ' sheet open' : ''}`);
  const close = el('button', 'sheet-close', 'Back to the list');
  close.onclick = () => { flow.applyHit({ cancelClass: true }); paint(); };
  detail.append(close);
  const d = el('div', 'dcard');
  const picked = flow.classRowName(flow.classListIndex);
  d.append(el('h3', null, picked));
  if (flow.classConfirm) {
    for (const line of flow.classConfirm) {
      const text = typeof line === 'string' ? line : line.text;
      if (text?.trim()) d.append(el('p', null, text));
    }
    const a = el('div', 'acts');
    const yes = el('button', 'act primary', `Play as a ${picked}`);
    yes.onclick = () => { flow.applyHit({ confirmClass: true }); paint(); };
    const no = el('button', 'act', 'Choose again');
    no.onclick = () => { flow.applyHit({ cancelClass: true }); paint(); };
    a.append(yes, no);
    d.append(a);
  } else {
    d.append(el('p', null, flow.classListIndex === flow.careers.length
      ? 'Twelve skills, your own attributes, your own advantages, and a difficulty that moves as you spend.'
      : 'Read what this class is before you commit to it.'));
    const a = el('div', 'acts');
    const read = el('button', 'act primary',
      flow.classListIndex === flow.careers.length ? 'Build it' : `Read about the ${picked}`);
    read.onclick = () => { flow.useClass(); paint(); };
    a.append(read);
    d.append(a);
  }
  detail.append(d);
  pane.append(detail);
  return pane;
}

// ── HOW YOUR HISTORY IS WRITTEN ──────────────────────────────────
// WizardStages.SelectBiographyMethod. Same two-button shape as the
// class method, and the same law: both handlers close, so a press
// chooses and goes. The GENERATE arm is not a skip - it answers every
// question at rand.Next(0, Count) and lands every effect, which is why
// it says so rather than reading as "none of this".
function bioMethodStage() {
  const pane = el('div', 'stagebody solo');
  const wrap = el('div', 'choose');
  wrap.append(el('h2', null, 'Where have you been?'));
  const row = el('div', 'bigchoice tall');
  const ask = el('button', 'bigbtn');
  ask.append(el('span', 'bigk', 'Answer twelve questions'));
  ask.append(el('span', 'bign', 'Your answers move skills, gold, gear and how people take to you.'));
  ask.onclick = () => { flow.applyHit({ bioMethod: 'questions' }); paint(); };
  const auto = el('button', 'bigbtn');
  auto.append(el('span', 'bigk', 'Let it be written for you'));
  auto.append(el('span', 'bign', 'Answered at random, and every answer still counts.'));
  auto.onclick = () => { flow.applyHit({ bioMethod: 'generate' }); paint(); };
  row.append(ask, auto);
  wrap.append(row);
  pane.append(wrap);
  return pane;
}

// ── THE TWELVE QUESTIONS ─────────────────────────────────────────
// One question, its answers, and nothing else - DFU's screen shows the
// question above ten answer buttons in two columns, and the reason to
// keep it to one column here is that the answers are SENTENCES, not
// labels. The last answer composes the backstory and pops the
// reputation box (TEXT.RSC 35), which is a ClickAnywhereToClose in
// DFU and a single button here.
function biographyStage() {
  const pane = el('div', 'stagebody solo');
  const q = flow.biogQuestion();
  if (!q) return pendingStage(STAGE_RAIL[stageOf(flow.state)]);
  const wrap = el('div', 'question');
  const total = flow.biogFor?.(flow.classIndex)?.questions?.length ?? 0;
  wrap.append(el('div', 'qcount', total ? `Question ${flow.biogQuestionIndex + 1} of ${total}` : ''));
  // BiogFile parses a question as TWO lines (q.text is [l0, l1]) and
  // the second is often empty - a question is one sentence here, so
  // the pair joins rather than the first winning.
  wrap.append(el('h2', null, (Array.isArray(q.text) ? q.text : [q.text])
    .filter((l) => l && l.trim()).join(' ')));
  const answers = el('div', 'answers');
  (q.answers ?? []).forEach((a, i) => {
    const b = el('button', 'answer', a.text ?? String(a));
    b.onclick = () => { flow.answerBiography(i); paint(); };
    answers.append(b);
  });
  wrap.append(answers);
  pane.append(wrap);
  return pane;
}

/**
 * THE REPUTATION BOX IS NOT A STAGE, it is a box over one - and over
 * EITHER of two, which is why it sits here and not inside a stage
 * renderer. DFU pushes it over the biography questions when the last
 * answer lands and over the bio-METHOD screen when the generate arm
 * runs (:444), so the state underneath is 'biography' one way and
 * 'bioMethod' the other. Keying it to a state rendered it in one case
 * and swallowed it in the other, which is exactly what the walk found:
 * the generate arm appeared to do nothing at all.
 *
 * ClickAnywhereToClose in DFU; one button here, through the flow's own
 * key arm so the close and the advance stay its decision.
 */
function repBoxPane() {
  const pane = el('div', 'stagebody solo');
  const wrap = el('div', 'choose');
  wrap.append(el('h2', null, 'Word gets around'));
  const card = el('div', 'card repbox');
  for (const row of flow.biogRepBox) {
    const text = typeof row === 'string' ? row : row.text;
    if (text?.trim()) card.append(el('p', null, text));
  }
  const a = el('div', 'acts');
  const ok = el('button', 'act primary', 'Go on');
  ok.onclick = () => { flow.input('confirm'); paint(); };
  a.append(ok);
  card.append(a);
  wrap.append(card);
  pane.append(wrap);
  return pane;
}

// ── YOUR NAME ────────────────────────────────────────────────────
// A text box and the RANDOM button, which is not a garnish: DFU
// disables it until a race template exists (which is what forced U15's
// reorder) and reseeds DFRandom on every push of the screen, because
// without that every character of a race and gender got the same
// suggestion on every boot (AUDIT 17j F1). The reseed already happened
// in _enterName; this only has to press the button.
//
// An EMPTY name does not advance - AcceptName's own law - so the
// primary is disabled rather than silently inert.
function nameStage() {
  const pane = el('div', 'stagebody solo');
  const wrap = el('div', 'choose');
  wrap.append(el('h2', null, 'What are you called?'));

  const box = el('input', 'namebox');
  box.type = 'text';
  box.value = flow.name;
  box.maxLength = NAME_MAX;
  box.autocomplete = 'off';
  box.spellcheck = false;
  // The FLOW owns the text, so typing is fed through its own char /
  // backspace actions rather than assigned: NAME_MAX_CHARACTERS is
  // TextBox's 31 (AUDIT 17j F5 - the port had capped it at 16, short
  // enough to cut real names and to mint a random name you could not
  // retype), and the cap belongs to the flow, not to this input.
  box.oninput = () => {
    const next = box.value;
    while (flow.name.length) flow.input('backspace');
    for (const ch of next) flow.input(`char:${ch}`);
    box.value = flow.name;
    ok.disabled = !flow.name.length;
  };
  box.onkeydown = (e) => { if (e.key === 'Enter' && flow.name.length) { flow.input('confirm'); paint(); } };
  wrap.append(box);

  const a = el('div', 'acts');
  const ok = el('button', 'act primary', 'Continue');
  ok.disabled = !flow.name.length;
  ok.onclick = () => { flow.input('confirm'); paint(); };
  const dice = el('button', 'act', 'Suggest one');
  dice.onclick = () => { flow.applyHit({ randomName: true }); paint(); };
  a.append(ok, dice);
  wrap.append(a);
  pane.append(wrap);
  requestAnimationFrame(() => box.focus());
  return pane;
}

// ── YOUR FACE ────────────────────────────────────────────────────
// Ten head records in the race-and-gender FACE CIF. DFU shows ONE with
// a previous/next pair, because it has 320x200; ten portraits fit here
// side by side, and a picker you can see all of is a picker you make
// one decision in rather than ten.
//
// The picker's value is the SCREEN's, not the document's (AUDIT 18:
// SetFaceTextures runs `facePicker.FaceIndex = 0` on every push, so
// re-entering always shows face 0, while the cancel arm writes nothing
// back and the previously accepted face survives an Escape). So this
// reads and writes flow.facePick and lets the flow's own confirm
// commit it.
function faceStage() {
  const pane = el('div', 'stagebody solo');
  const wrap = el('div', 'choose');
  wrap.append(el('h2', null, 'Which face is yours?'));

  if (!faces?.canvases?.length) {
    // NEVER TRAPS: no CIF, no portraits, and the wizard still walks.
    wrap.append(el('p', 'mapnote', 'The portraits need this race\u2019s FACE CIF. Any of the ten will do.'));
  }
  const grid = el('div', 'facegrid');
  for (let i = 0; i < FACES_PER_RACE; i++) {
    const b = el('button', `facecell${i === flow.facePick ? ' on' : ''}`);
    const art = faces?.canvases?.[i];
    // NOT cloneNode: cloning a canvas copies its size and NOT its
    // pixels, which is a blank portrait that looks exactly like a
    // portrait that failed to load. The nodes are cached per identity
    // and simply move into the fresh DOM on each repaint.
    if (art) b.append(art);
    else b.append(el('span', 'facenum', String(i + 1)));
    b.onclick = () => { flow.facePick = i; paint(); };
    grid.append(b);
  }
  wrap.append(grid);

  const a = el('div', 'acts');
  const ok = el('button', 'act primary', 'This one');
  ok.onclick = () => { flow.input('confirm'); paint(); };
  a.append(ok);
  wrap.append(a);
  pane.append(wrap);
  ensureFaces();
  return pane;
}

/** Load the identity's ten heads, once, and repaint when they land.
 *  Coalesces the way chargenArt's own loader does - a race change
 *  mid-load must not leave a Khajiit wearing Breton heads. */
function ensureFaces() {
  if (!loadFaces) return;
  const want = `${flow.race.key}|${flow.gender}`;
  if (faces?.key === want || faces?.pending === want) return;
  faces = { key: null, pending: want, canvases: [] };
  loadFaces(flow.race.key, flow.gender).then((set) => {
    if (faces?.pending !== want) return;
    faces = { key: want, canvases: set ?? [] };
    if (flow.state === 'face') paint();
  }).catch((e) => {
    console.warn('[chargen] the FACE CIF would not load', e);
    faces = { key: want, canvases: [] };
  });
}

// ── ATTRIBUTES ───────────────────────────────────────────────────
// StatsRollout: eight values rolled for the career, a bonus pool to
// spend, and the seven DERIVED figures that move as you spend - which
// belong to CreateCharAddBonusStats' own panel and not to the rollout
// (U16 found them drawn across the summary's skill panels for exactly
// that reason).
//
// The pool is the gate: DFU will not leave this screen until it is
// spent, so the primary says how many are left rather than refusing
// silently.
function statsStage() {
  const pane = el('div', 'stagebody');

  const list = el('div', 'list');
  list.append(poolBar('points to spend', flow.statPool));
  STAT_KEYS_ORDER.forEach((key, i) => {
    const row = el('div', `row${i === flow.statCursor ? ' on' : ''}`);
    const main = el('button', 'row-main');
    main.append(el('div', 'row-name', key[0].toUpperCase() + key.slice(1)));
    main.onclick = () => { flow.applyHit({ setStatCursor: i }); paint(); };
    row.append(main);
    row.append(stepper(flow.stats?.[key] ?? 0, (dir) => {
      flow.applyHit({ setStatCursor: i });
      flow.applyHit({ statStep: dir });
      paint();
    }));
    list.append(row);
  });
  pane.append(list);

  const detail = el('div', 'detail');
  const d = el('div', 'dcard');
  d.append(el('h3', null, 'What these buy you'));
  const dl = el('dl', 'stats');
  const derived = flow.derived() ?? {};
  for (const [k, label] of [['damage', 'Damage'], ['encumbrance', 'Carry weight'],
    ['spellPoints', 'Spell points'], ['magicResist', 'Magic resistance'],
    ['toHit', 'To hit'], ['hitPoints', 'Hit points'], ['healingRate', 'Healing rate']]) {
    if (derived[k] == null) continue;
    dl.append(el('dt', null, label), el('dd', null, derived[k]));
  }
  d.append(dl);
  const a = el('div', 'acts');
  const ok = el('button', 'act primary', flow.statPool > 0 ? `${flow.statPool} left to spend` : 'Continue');
  ok.disabled = flow.statPool > 0;
  ok.onclick = () => { flow.input('confirm'); paint(); };
  const again = el('button', 'act', 'Roll again');
  again.onclick = () => { flow.reroll(); paint(); };
  a.append(ok, again);
  d.append(a);
  detail.append(d);
  pane.append(detail);
  return pane;
}

// ── SKILLS ───────────────────────────────────────────────────────
// SkillsRollout has THREE spinners, one per group, each with its own
// selected skill and its OWN pool (U17 shipped that after the port had
// drawn one spinner on a shared row and left two pools invisible). So
// the groups are three sections with three pools, and a skill's own
// group is where its points come from.
function skillsStage() {
  const pane = el('div', 'stagebody solo');
  const wrap = el('div', 'skillpane');
  let cursor = 0;
  for (const [group, ids] of flow.skillRows()) {
    const sec = el('div', 'skillgroup');
    const head = el('div', 'skillhead');
    head.append(el('span', 'skillk', group[0].toUpperCase() + group.slice(1)));
    head.append(el('span', 'skillpool', `${flow.pools?.[group] ?? 0} to spend`));
    sec.append(head);
    for (const id of ids) {
      const at = cursor++;
      const row = el('div', `row${at === flow.skillCursor ? ' on' : ''}`);
      const main = el('button', 'row-main');
      main.append(el('div', 'row-name', SKILL_NAMES[id] ?? `Skill ${id}`));
      main.onclick = () => { flow.applyHit({ setSkillCursor: at }); paint(); };
      row.append(main);
      row.append(stepper(flow.skills?.[id] ?? 0, (dir) => {
        flow.applyHit({ setSkillCursor: at });
        flow.applyHit({ skillStep: dir, group });
        paint();
      }));
      sec.append(row);
    }
    wrap.append(sec);
  }
  const left = Object.values(flow.pools ?? {}).reduce((n, v) => n + v, 0);
  const a = el('div', 'acts');
  const ok = el('button', 'act primary', left > 0 ? `${left} left to spend` : 'Continue');
  ok.disabled = left > 0;
  ok.onclick = () => { flow.input('confirm'); paint(); };
  a.append(ok);
  wrap.append(a);
  pane.append(wrap);
  return pane;
}

function poolBar(label, n) {
  const row = el('div', 'poolbar');
  row.append(el('span', 'poolk', label));
  row.append(el('span', 'poolv', String(n ?? 0)));
  return row;
}

function stepper(value, step) {
  const ctl = el('div', 'ctl');
  ctl.append(el('span', 'val', String(value)));
  for (const [dir, glyph] of [[-1, '\u2039'], [1, '\u203a']]) {
    const b = el('button', 'step', glyph);
    b.setAttribute('aria-label', dir < 0 ? 'less' : 'more');
    b.onclick = () => step(dir);
    ctl.append(b);
  }
  return ctl;
}

// ── THE STAGES NOT YET REDESIGNED ────────────────────────────────
// Named, with the classic screen that still owns them. An empty pane
// would read as a bug and a half-built one would read as the design.
function pendingStage(stage) {
  const pane = el('div', 'stagebody solo');
  const e = el('div', 'empty');
  e.append(el('h3', null, `${stage?.label ?? 'This stage'} is still the classic screen`));
  e.append(el('p', null, 'The wizard runs on one flow, so this stage works - it has just not been redesigned yet. They land one at a time.'));
  pane.append(e);
  return pane;
}

// ── SHELL ────────────────────────────────────────────────────────

function paint() {
  host.innerHTML = '';
  const shell = el('div', 'shell wizard');

  const side = el('aside', 'side');
  const brand = el('div', 'brand');
  brand.append(el('h1', null, 'New Character'));
  brand.append(el('div', 'sub', 'Daggerfall'));
  side.append(brand);

  const here = stageOf(flow.state);
  const rail = el('nav', 'rail');
  STAGE_RAIL.forEach((stage, i) => {
    const state = i === here ? ' on' : (i < here ? ' done' : ' todo');
    const b = el('button', `railbtn${state}`);
    b.append(el('span', 'rk', stage.label));
    b.disabled = i > here;   // the wizard is a walk, not a menu
    rail.append(b);
  });
  side.append(rail);

  // THE PHONE GETS A PROGRESS STRIP, NOT THE RAIL. The menu's rail is
  // navigation and belongs in the thumb's arc; this one is a WALK you
  // cannot jump around in, so ten full-height buttons down there would
  // be a third of the screen spent telling you where you are not. The
  // strip says the same thing in one line, and the rail is hidden
  // rather than duplicated - one of the two draws at any width.
  const strip = el('div', 'stepstrip');
  const segs = el('div', 'segs');
  STAGE_RAIL.forEach((_, i) => segs.append(el('i', i <= here ? 'seg on' : 'seg')));
  strip.append(segs);
  strip.append(el('div', 'steptext',
    `${Math.max(here, 0) + 1} of ${STAGE_RAIL.length} \u00b7 ${STAGE_RAIL[here]?.label ?? ''}`));
  side.append(strip);

  const foot = el('div', 'foot');
  foot.append(document.createTextNode(`step ${Math.max(here, 0) + 1} of ${STAGE_RAIL.length}`));
  side.append(foot);

  const pane = el('main', 'pane');
  const STAGES = {
    race: raceStage, gender: genderStage,
    classMethod: classMethodStage, class: classStage,
    bioMethod: bioMethodStage, biography: biographyStage, name: nameStage,
    face: faceStage, stats: statsStage, skills: skillsStage,
  };
  pane.append(flow.biogRepBox?.length
    ? repBoxPane()
    : (STAGES[flow.state] ?? (() => pendingStage(STAGE_RAIL[here])))());

  // THE ACTION BAR. Back is always here, because AUDIT 17j found the
  // wizard's back arms wrong on every screen it checked and the fix
  // deserves a control the player can see. Backing out of the FIRST
  // stage cancels the wizard, which is DFU's own arm
  // (RaceSelectWindow_OnClose's Cancelled) and U27's unwind.
  const bar = el('div', 'actionbar');
  const back = el('button', 'act', here <= 0 ? 'Cancel' : 'Back');
  back.onclick = () => {
    if (here <= 0 && !flow.raceConfirm) { onExit('cancel'); return; }
    flow.input('back');
    paint();
  };
  bar.append(back);
  pane.append(bar);

  shell.append(side, pane);
  host.append(shell);
}

/**
 * THE TEXT SEAM. ChargenFlow exposes describeRace/describeClass/
 * describeText as injectable hooks - they default to chargenArt's
 * copies, which read a TEXT.RSC the CLASSIC art load happens to have
 * parked in a module variable. A DOM view loads no GL art, so without
 * this every race description came back empty, and an empty
 * description is not cosmetic: DFU's own arm accepts the homeland
 * outright when there is nothing to show (chargen.js `else this.state
 * = 'gender'`), so the description box would silently never appear.
 *
 * TEXT.RSC is a plain reader with no renderer in it, so the view can
 * hold its own and hand the flow the same three functions.
 */
export function attachChargenText(f, textRsc) {
  if (!textRsc) return f;
  f.describeRace = (race) => (race ? textRsc.linesById(race.descriptionId) : []);
  f.describeClass = (i) => textRsc.linesById(CLASS_DESCRIPTION_TEXT_ID + i);
  f.describeText = (id) => textRsc.linesById(id);
  // THE BIOGRAPHY'S TWO TEXT SOURCES, and they are not decoration. The
  // BACKSTORY is what U13 built and what the character sheet's History
  // page reads for the rest of the game, and the REPUTATION BOX is
  // TEXT.RSC 35 with %r1..%r5 filled from DigestRepChanges - the one
  // moment the player is told what their answers did. Both hang off
  // chargenArt's _art.textRsc, so a DOM view got an empty backstory
  // and no box at all, and the flow's own arm reads a missing box as
  // "nothing to show" and walks straight past it. Silent, and
  // permanent: the backstory is written once.
  f.buildBackstory = (backstoryId, effects) =>
    generateBackstory(textRsc, backstoryId, effects).map((r) => r.text);
  f.repBoxRows = (changed) => (changed
    ? textRsc.linesById(35).map((r) => ({
      ...r, text: r.text.replace(/%r([1-5])/g, (_, n) => String(changed[Number(n) - 1] ?? 0)),
    }))
    : null);
  return f;
}

/**
 * Mount the wizard. `picker` is TAMRIEL2's DFBitmap when the caller
 * has it - absent, the map degrades to the named list and the wizard
 * runs on regardless.
 */
export function mountEnhancedChargen(hostEl, {
  flow: f, picker = null, picture = null, palette = null,
  loadFaces: faceLoader = null, onExit: exit = () => {},
} = {}) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  host = hostEl;
  flow = f;
  onExit = exit;
  loadFaces = faceLoader;
  faces = null;
  hover = null;
  try {
    provinces = picker ? traceProvinces(picker, { picture, palette }) : [];
  } catch (e) {
    console.warn('[chargen] TAMRIEL2 would not trace; the map falls back to a list', e);
    provinces = [];
  }
  paint();
  globalThis.__chargen = () => JSON.stringify({
    state: flow.state, race: flow.race.key, gender: flow.gender,
    stage: stageOf(flow.state), provinces: provinces.length,
    confirming: !!flow.raceConfirm,
  });
  return { repaint: paint, unmount() { hostEl.innerHTML = ''; delete globalThis.__chargen; } };
}
