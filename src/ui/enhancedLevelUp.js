// ═══════════════════════════════════════════════════════════════════
// LV1 — THE ASCENSION, drawn. The enhanced skin's level-up window.
//
// The reading is ui/levelUpView.js's and the LAW is the live rollout
// screen's (ui/charsheet.js's LevelUpScreen, or ui/virtueLevelUp.js's
// under the vendored mod). This file owns pixels, keys and pointers,
// and writes nothing a player could not undo with the same two
// buttons.
//
// ── IT IS NOT A .px-win, AND THAT IS DELIBERATE ───────────────────
// Every other enhanced screen is a framed panel over the paused game,
// because every other screen is a thing a player OPENS. This one is a
// thing that HAPPENS: the game has stopped to tell you something. So
// it is the whole screen, on the enhanced skin's own dithered night
// (ui/pixelGround.js - procedural, no game data, the same sky the
// front door and the wizard stand on), which is also what the
// reference does.
//
// ── THE WINDOW DOES NOT REBUILD ITSELF ────────────────────────────
// ui/enhancedChronicle.js and the pause window repaint by throwing the
// tree away and building it again, which is right for a screen whose
// interactions are "choose a section". It is wrong here for two
// reasons that are both bugs rather than preferences:
//
//   1. THE SKY OWNS A CLOCK. A rebuild per keypress would tear down
//      and restart the 8fps interval eight times a second at the
//      keyboard's repeat rate.
//   2. FOCUS IS STATE. A player raising Strength five times by
//      pressing the same star has their focus destroyed under them on
//      every press, so the fifth press goes to the document and the
//      keyboard stops working - the exact shape U42 found when the
//      sheet dropped an arm of the contract.
//
// So the tree is built ONCE and `paint()` updates the parts that move.
//
// ── THE ONE WAY OUT ───────────────────────────────────────────────
// DFU's sheet refuses to close while bonus points are unspent
// (CheckIfDoneLeveling, DaggerfallCharacterSheetWindow.cs:433-455) and
// the mod's window refuses the same way (player.lua:532-552). So does
// this one, and it refuses in every vocabulary a player has: the OK
// button, Escape, and PX28's Tab. A refusal SAYS SO - the plate is a
// live region and the refusal is written into it - because a control
// that declines in silence is indistinguishable from an input that
// was not received (ui/enhancedChunk.js's whole header).
// ═══════════════════════════════════════════════════════════════════

import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { drawPixelGround } from './pixelGround.js';
import { registerOverlay } from './enhancedOverlays.js';   // PX28: Tab, which this screen refuses while a point is unspent
import { overlayAction } from './input.js';
import { STAT_KEYS_ORDER } from '../systems/chargen.js';
import {
  STAR_FIGURE, ATTRIBUTE_BLURB, attributeLabel, levelUpModel, levelUpFrame, levelUpVitals,
  focusAt, raiseAt, lowerAt, ascend, focusedKey, starBrightness, refusalText,
  LANE_OGHMA,
} from './levelUpView.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const svg = (tag, cls) => {
  const n = document.createElementNS(SVG_NS, tag);
  if (cls) n.setAttribute('class', cls);
  return n;
};

/** The head of the window, per lane. The OGHMA arm takes no level and
 *  no health roll (AUDIT 39), so it must not be announced as one -
 *  the book gets its own sentence instead. */
export function crownTitle(crown) {
  if (crown.lane === LANE_OGHMA) return 'The Oghma Infinium';
  return `Level ${crown.from} → ${crown.to}`;
}

/** What the window ASKS, which is the sentence Skyrim puts in the
 *  middle of the sky. Ours is plural because Daggerfall's pool is. */
export const ASK_ONE = 'Choose what rises';
export const ASK_DONE = 'The stars are set';

/** A meter row in the enhanced skin's own shape (ui/enhancedMenu.js's
 *  meterRow, whose markup this matches so the two cannot drift in
 *  paint). Built here rather than imported because that one lives in
 *  the pause window's 3000-line chunk and this window must not pull it
 *  in to draw three bars. */
function meterRow(label, now, max, fill) {
  const row = el('div', 'px-mrow');
  const top = el('div', 'px-mtop');
  top.append(el('span', 'k', label), el('span', 'v', `${now} / ${max}`));
  const meter = el('div', 'px-meter');
  const bar = el('div', `px-fill${fill ? ` ${fill}` : ''}`);
  bar.style.width = `${max > 0 ? Math.max(0, Math.min(100, (now / max) * 100)) : 0}%`;
  meter.append(bar);
  row.append(top, meter);
  return row;
}

/**
 * Mount the window. `screen` is the LIVE rollout - this view never
 * builds one, because which one it is is ui/charSheetDoor.js's
 * question and the answer carries a mod's law behind it.
 *
 * @param {HTMLElement} hostEl
 * @param {{screen: any, entity?: any, onExit?: () => void}} d
 */
export function mountEnhancedLevelUp(hostEl, d = {}) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  const screen = d.screen;
  const entity = d.entity ?? screen?.entity ?? {};
  const onExit = d.onExit ?? (() => {});
  /** The classic rollout has NO refusal latch of its own - `confirm`
   *  with a pool left simply does nothing - so the window carries that
   *  half. Cleared by any press that moves a point, so the line does
   *  not outlive the state it describes. */
  let refused = false;
  let ribbonAt = 0;
  let groundTimer = null;
  let unregister = () => {};
  let dead = false;

  const root = el('div', 'px-home lv-sky');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Level up');

  // ── THE SKY ──────────────────────────────────────────────────
  // PX1b's cadence and PX1b's opt-out: 8fps, the rate pixel art
  // animates at, and nothing at all under prefers-reduced-motion.
  const ground = document.createElement('canvas');
  ground.className = 'px-ground';
  const vw = () => globalThis.innerWidth ?? 1280;
  const vh = () => globalThis.innerHeight ?? 720;
  drawPixelGround(ground, vw(), vh(), 0);
  const still = typeof globalThis.matchMedia === 'function'
    && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!still) {
    const t0 = Date.now();
    groundTimer = setInterval(() => drawPixelGround(ground, vw(), vh(), (Date.now() - t0) / 1000), 125);
  }
  root.append(ground, el('div', 'px-vignette'));

  // ── THE CROWN ────────────────────────────────────────────────
  const crown = el('header', 'lv-crown');
  const whoCell = el('div', 'lv-who');
  whoCell.append(el('span', 'k', 'Name'));
  const whoName = el('span', 'v');
  whoCell.append(whoName);
  const levelCell = el('div', 'lv-level');
  const levelJump = el('div', 'lv-jump');
  const levelMeter = el('div', 'px-meter');
  const levelFill = el('div', 'px-fill thin');
  levelMeter.append(levelFill);
  const levelNote = el('div', 'lv-barnote');
  levelCell.append(levelJump, levelMeter, levelNote);
  const raceCell = el('div', 'lv-race');
  raceCell.append(el('span', 'k', 'Race'));
  const raceName = el('span', 'v');
  raceCell.append(raceName);
  crown.append(whoCell, levelCell, raceCell);
  root.append(crown);

  // ── THE PLATE ────────────────────────────────────────────────
  // A LIVE REGION, and INTRO-FIELD's law with it: it is announced, so
  // it is never display:none - a refusal that is only read aloud must
  // still be in the tree. Everything a player must SEE is drawn here
  // too; nothing is routed to a hidden node.
  const plate = el('div', 'lv-plate');
  plate.setAttribute('role', 'status');
  plate.setAttribute('aria-live', 'polite');
  const plateCount = el('div', 'lv-count');
  const plateKey = el('span', 'lv-countk');
  const plateRefuse = el('p', 'lv-refuse');
  const plateHint = el('p', 'lv-hint');
  plate.append(plateCount, plateKey, plateRefuse, plateHint);
  root.append(plate);

  // ── THE FIGURE ───────────────────────────────────────────────
  const stage = el('div', 'lv-stage');
  const figure = el('div', 'lv-figure');
  const lines = svg('svg', 'lv-lines');
  lines.setAttribute('viewBox', `0 0 ${STAR_FIGURE.box.w} ${STAR_FIGURE.box.h}`);
  lines.setAttribute('preserveAspectRatio', 'none');
  lines.setAttribute('aria-hidden', 'true');
  const edgeNodes = STAR_FIGURE.edges.map(([a, b]) => {
    const l = svg('line');
    l.setAttribute('x1', String(STAR_FIGURE.stars[a].x));
    l.setAttribute('y1', String(STAR_FIGURE.stars[a].y));
    l.setAttribute('x2', String(STAR_FIGURE.stars[b].x));
    l.setAttribute('y2', String(STAR_FIGURE.stars[b].y));
    lines.append(l);
    return { a, b, node: l };
  });
  figure.append(lines);

  /** One star per attribute, positioned in the SAME coordinates the
   *  lines are drawn in - the picture and its hit target are one
   *  element, which is ui/levelingChoice.js's law obeyed by
   *  construction rather than by a second table. */
  const stars = STAT_KEYS_ORDER.map((key) => {
    const b = el('button', 'lv-star');
    b.type = 'button';
    const p = STAR_FIGURE.stars[key];
    b.style.left = `${(p.x / STAR_FIGURE.box.w) * 100}%`;
    b.style.top = `${(p.y / STAR_FIGURE.box.h) * 100}%`;
    const gem = el('span', 'lv-gem', '✦');
    const name = el('span', 'lv-name', attributeLabel(key));
    const val = el('span', 'lv-val');
    const delta = el('span', 'lv-delta');
    b.append(gem, name, val, delta);
    // A CLICK IS SELECT-THEN-PRESS, through the screen's own input -
    // the two moves the keyboard makes, in that order. A star that
    // cannot take a point still takes the FOCUS, so the description
    // and the two presses below it still answer for it.
    b.onclick = () => {
      focusAt(screen, key);
      if (raiseAt(screen, key)) refused = false;
      paint();
    };
    figure.append(b);
    return { key, node: b, val, delta, gem };
  });
  stage.append(figure);
  root.append(stage);

  // ── THE CHOICE ───────────────────────────────────────────────
  const choice = el('div', 'lv-choice');
  const ask = el('div', 'lv-ask', ASK_ONE);
  const pick = el('div', 'lv-pick');
  const prev = el('button', 'lv-arrow', '◃');
  prev.type = 'button';
  prev.title = 'Previous attribute';
  prev.setAttribute('aria-label', 'Previous attribute');
  const next = el('button', 'lv-arrow', '▹');
  next.type = 'button';
  next.title = 'Next attribute';
  next.setAttribute('aria-label', 'Next attribute');
  const minus = el('button', 'lv-press', '−');
  minus.type = 'button';
  minus.title = 'Take this point back';
  minus.setAttribute('aria-label', 'Take this point back');
  const plus = el('button', 'lv-press', '+');
  plus.type = 'button';
  plus.title = 'Put a point here';
  plus.setAttribute('aria-label', 'Put a point here');
  const pickName = el('div', 'lv-pickname');
  const pickN = el('span', 'n');
  const pickF = el('span', 'f');
  const pickC = el('span', 'c');
  pickName.append(pickN, pickF, pickC);
  pick.append(prev, minus, pickName, plus, next);
  const blurb = el('p', 'lv-blurb');
  choice.append(ask, pick, blurb);
  root.append(choice);

  const step = (by) => {
    const i = STAT_KEYS_ORDER.indexOf(focusedKey(screen));
    focusAt(screen, STAT_KEYS_ORDER[(i + by + STAT_KEYS_ORDER.length) % STAT_KEYS_ORDER.length]);
    paint();
    // THE DOM FOCUS FOLLOWS THE SELECTION. Without this the ring stays
    // on whichever star was last clicked while the highlight walks
    // away from it, so a keyboard user and a screen reader are told
    // two different things about which attribute is live (LV1's
    // audit). `focusStar` is a no-op when nothing was focused inside
    // the window, so an arrow press cannot steal focus from the page.
    focusStar();
  };
  const focusStar = () => {
    const at = stars.find((s) => s.key === focusedKey(screen));
    try { at?.node?.focus?.({ preventScroll: true }); } catch { /* no layout yet */ }
  };
  prev.onclick = () => step(-1);
  next.onclick = () => step(1);
  plus.onclick = () => { if (raiseAt(screen, focusedKey(screen))) refused = false; paint(); };
  minus.onclick = () => { if (lowerAt(screen, focusedKey(screen))) refused = false; paint(); };

  // ── THE RIBBON ───────────────────────────────────────────────
  const ribbonWrap = el('div', 'lv-ribbonwrap');
  const ribbon = el('div', 'lv-ribbon');
  const ribbonRows = levelUpModel(entity, screen, refused).ribbon;
  const ribbonNodes = ribbonRows.map((row, i) => {
    const b = el('button', 'lv-sk');
    b.type = 'button';
    const n = el('span', 'n', row.name);
    const v = el('span', 'v', String(row.value));
    b.append(n, v);
    if (row.risen) b.append(el('span', 'lv-up', '▲'));
    b.onclick = () => { ribbonAt = i; paint(); };
    ribbon.append(b);
    return b;
  });
  const skRole = el('p', 'lv-skrole');
  ribbonWrap.append(ribbon, skRole);
  root.append(ribbonWrap);

  // ── THE FOOT ─────────────────────────────────────────────────
  const foot = el('div', 'lv-foot');
  const vitals = el('div', 'lv-vitals');
  for (const m of levelUpVitals(entity)) vitals.append(meterRow(m.label, m.now, m.max, m.fill));
  const acts = el('div', 'lv-acts');
  const ok = el('button', 'lv-ok', 'Ascend');
  ok.type = 'button';
  ok.onclick = () => confirm();
  acts.append(ok);
  foot.append(vitals, acts);
  root.append(foot);

  hostEl.append(root);

  /** THE COMMIT, through the screen's own door. A refusal latches the
   *  line rather than doing nothing, and the window stays up: there is
   *  no other way out of a level-up, in either lane. */
  function confirm() {
    if (dead) return false;
    if (ascend(screen)) { onExit(); return true; }
    refused = true;
    paint();
    return false;
  }

  /** What Tab and Escape get while a point is unspent. PX28 pops the
   *  registry entry BEFORE it calls the close arm, so a refusal has to
   *  put itself back or the window would become un-Tab-able for the
   *  rest of its life. */
  function closeArm() {
    if (dead) return;
    if (confirm()) return;
    unregister = registerOverlay(closeArm);
  }

  function paint() {
    if (dead) return;
    // THE FRAME, not the whole model: the ribbon and the vitals are
    // built once at mount and nothing a press does moves them, and
    // rebuilding them here put `sheetModel` - gold, encumbrance, all
    // thirty-five skills, the class specials - on every keystroke
    // (LV1's audit).
    const m = levelUpFrame(entity, screen, refused);
    whoName.textContent = m.crown.name;
    raceName.textContent = [m.crown.race, m.crown.career].filter(Boolean).join(' ');
    levelJump.textContent = crownTitle(m.crown);
    levelFill.style.width = `${m.progress.max > 0 ? Math.max(0, Math.min(100, (m.progress.now / m.progress.max) * 100)) : 0}%`;
    levelNote.textContent = `${m.progress.label} ${m.progress.now}/${m.progress.max}`
      + (m.progress.carried > 0 ? ` · ${m.progress.carried} carried` : '');

    plateCount.textContent = String(m.pool);
    plateKey.textContent = m.poolLabel;
    plate.classList.toggle('spent', m.pool === 0);
    plateRefuse.textContent = m.refusal ?? '';
    plateHint.textContent = m.cornered ?? '';

    const rows = new Map(m.rows.map((r) => [r.key, r]));
    for (const s of stars) {
      const r = rows.get(s.key);
      s.node.classList.toggle('on', s.key === m.focus);
      s.node.classList.toggle('raised', r.delta > 0);
      s.node.classList.toggle('full', !r.canRaise && r.delta === 0 && m.pool > 0);
      s.val.textContent = String(r.value);
      s.delta.textContent = r.delta > 0 ? `+${r.delta}` : '';
      // The star's own brightness is its VALUE - the figure is the
      // character, not the spend.
      s.gem.style.opacity = String(0.45 + 0.55 * starBrightness(r.value));
      // NOT `aria-pressed`: a star is not a toggle, and a control that
      // announces itself pressed when a point happens to sit in it
      // tells a screen reader the wrong kind of thing. The label
      // carries the same fact in words (LV1's audit).
      s.node.setAttribute('aria-label',
        `${r.label} ${r.value}${r.delta > 0 ? `, raised by ${r.delta}` : ''}${r.canRaise ? '' : ', cannot raise'}`);
    }
    // A LINE LIGHTS WHEN BOTH ITS STARS HAVE RISEN. It is the one
    // thing on this screen that is pure celebration and it is also
    // honest: two points into one arm of the figure is a shape the
    // player made.
    for (const e of edgeNodes) {
      const lit = (rows.get(e.a)?.delta ?? 0) > 0 && (rows.get(e.b)?.delta ?? 0) > 0;
      e.node.classList.toggle('lit', lit);
    }

    const row = rows.get(m.focus);
    ask.textContent = m.pool > 0 ? ASK_ONE : ASK_DONE;
    pickN.textContent = row.label;
    pickF.textContent = row.delta > 0 ? `${row.base} → ${row.value}` : String(row.value);
    // THE PRICE, only where there is one. Daggerfall's pool is a point
    // a point; the mod prices Luck differently from the rest
    // (attributeOffset), and a window that hid that would be lying
    // about what the next press costs.
    pickC.textContent = row.cost > 1 ? `${row.cost} per point` : '';
    blurb.textContent = ATTRIBUTE_BLURB[m.focus] ?? '';
    plus.disabled = !row.canRaise;
    minus.disabled = !row.canLower;

    // NOT `disabled`, AND THE PROBE IS WHY. The first build disabled
    // this button while the pool was unspent, which made the refusal
    // unreachable by pointer: the one control on the screen could not
    // be pressed and never said why - a silent decline, which is the
    // defect ui/enhancedChunk.js's header is entirely about, and not
    // what DFU does either (CheckIfDoneLeveling puts a message box up,
    // it does not grey the exit). So it stays pressable, wears the
    // not-yet paint, and tells the truth when it is asked.
    ok.classList.toggle('notyet', !m.canAscend);
    // AND NOT `aria-disabled` EITHER, which the probe caught being the
    // same mistake in a second spelling: a button that announces itself
    // as disabled is one Playwright - and a screen reader, and a
    // keyboard user taking it at its word - will not press, so the
    // refusal behind it is unreachable again. It carries the REASON
    // instead, where a pointer and an assistive tech both find it.
    ok.title = m.canAscend ? '' : refusalText(screen);
    ok.textContent = m.lane === LANE_OGHMA ? 'Read on' : 'Ascend';

    if (ribbonNodes.length) {
      ribbonAt = Math.max(0, Math.min(ribbonRows.length - 1, ribbonAt));
      ribbonNodes.forEach((n, i) => n.classList.toggle('on', i === ribbonAt));
      const sk = ribbonRows[ribbonAt];
      const g = el('span', 'g', sk.group);
      skRole.textContent = '';
      skRole.append(g, document.createTextNode(` · ${sk.note}`));
    } else {
      skRole.textContent = '';
    }
  }

  /** The ribbon scrolls the focused skill to the middle, which is what
   *  makes it read as the reference's ribbon rather than a list with a
   *  highlight. Guarded: jsdom-less hosts and the probe's first frame
   *  both reach here before layout exists. */
  function centreRibbon() {
    const n = ribbonNodes[ribbonAt];
    if (!n?.scrollIntoView) return;
    try { n.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch { /* no layout yet */ }
  }

  function onKey(e) {
    if (dead || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const key = focusedKey(screen);
    let used = true;
    switch (e.code) {
      case 'ArrowLeft': step(-1); break;
      case 'ArrowRight': step(1); break;
      // UP AND DOWN WALK THE RIBBON, not the figure. The figure is two
      // dimensional and a vertical walk of it would have to invent an
      // order the picture does not have; the ribbon IS a list and has
      // one. Left/right is the figure's own order - STAT_KEYS_ORDER,
      // which is DFCareer.Stats' order, the same walk the classic
      // rollout's up/down makes.
      case 'ArrowUp': ribbonAt -= 1; paint(); centreRibbon(); break;
      case 'ArrowDown': ribbonAt += 1; paint(); centreRibbon(); break;
      case 'Equal': case 'NumpadAdd': if (raiseAt(screen, key)) refused = false; paint(); break;
      case 'Minus': case 'NumpadSubtract': if (lowerAt(screen, key)) refused = false; paint(); break;
      case 'Enter': case 'NumpadEnter': confirm(); break;
      default: used = false;
    }
    if (!used) {
      // Escape is the only other key this screen answers, and it
      // answers it the way the OK button does: a level-up has one
      // exit, and it is spent.
      if (overlayAction(e) !== 'back') return;
      confirm();
    }
    // A MODAL OVERLAY OWNS ITS INPUT (U50's law): on CAPTURE and
    // stopped, so the host's own keydown never sees a key this screen
    // used - including the sheet key that would re-open the door this
    // press came through.
    e.preventDefault();
    e.stopPropagation();
  }

  /** A RESIZE REDRAWS THE SKY. The interval reads the viewport every
   *  tick, so a moving sky follows a resize on its own - but under
   *  prefers-reduced-motion there IS no interval, and the canvas kept
   *  the old viewport's backing store stretched over the new one
   *  (LV1's audit). One listener, owned by the teardown below. */
  const onResize = () => { if (!dead) drawPixelGround(ground, vw(), vh(), 0); };
  if (still) globalThis.addEventListener?.('resize', onResize);
  globalThis.addEventListener?.('keydown', onKey, true);
  unregister = registerOverlay(closeArm);
  paint();
  // The first focus goes to the figure, not the document: this screen
  // is reachable by keyboard alone from the moment it opens.
  stars[0]?.node?.focus?.({ preventScroll: true });

  return {
    paint,
    /** Test and probe seam: what the window is showing right now. */
    model: () => levelUpModel(entity, screen, refused),
    destroy() {
      dead = true;
      if (groundTimer) clearInterval(groundTimer);
      groundTimer = null;
      globalThis.removeEventListener?.('keydown', onKey, true);
      if (still) globalThis.removeEventListener?.('resize', onResize);
      unregister();
      root.remove();
    },
  };
}
