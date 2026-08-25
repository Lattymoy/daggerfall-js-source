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
  };
  pane.append((STAGES[flow.state] ?? (() => pendingStage(STAGE_RAIL[here])))());

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
  return f;
}

/**
 * Mount the wizard. `picker` is TAMRIEL2's DFBitmap when the caller
 * has it - absent, the map degrades to the named list and the wizard
 * runs on regardless.
 */
export function mountEnhancedChargen(hostEl, {
  flow: f, picker = null, picture = null, palette = null, onExit: exit = () => {},
} = {}) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  host = hostEl;
  flow = f;
  onExit = exit;
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
