// ═══════════════════════════════════════════════════════════════════
// ENHANCED — THE MAIN MENU
//
// The game's front door when the skin is enhanced, and ENHANCED IS THE
// DEFAULT (systems/uiSkin.js). One screen: continue, new game, load,
// settings, mods, about.
//
// ONE IMPLEMENTATION, TWO HOSTS. This module is mounted by the game
// (src/main.js) and by the prototype page (/menu.html, via
// src/tools/enhancedMenu.js) and there is no second copy of any of it.
// The prototype exists to be argued with and must therefore be the
// same screen that ships, or the argument is with something else.
//
// ── WHAT IT REPLACES ─────────────────────────────────────────────
//
// The port's front door is currently FOUR screens in a row, and the
// player meets all four before touching the game (main.js:29-120):
//
//     ui/titleScreen.js      the logo, dismissed by any key
//     scenes/launcherScene.js + ui/settingsWindow.js   settings, 584 lines
//     ANIM0001.VID           the splash
//     ui/startWindow.js      PICK03I0 - Load / New Game / Exit
//
// Three of those are separate hosts with their own event wiring, and
// the settings screen is only reachable at boot: once the game is
// running there is no door back to it that does not go through a
// reload. Classic works that way because classic is a DOS program with
// a fixed 320x200 screen. Neither reason survives here.
//
// This is ONE screen. Every destination is a press away from every
// other, settings included, mods included.
//
// ── WHY THE LABELS ARE TYPE ──────────────────────────────────────
//
// PICK03I0.IMG has "Load Game", "Start New Game" and "Exit" PAINTED
// INTO the bitmap, and DFU lays invisible click rects over the words
// (startWindow.js's own header says so, and the port had to land those
// rects to the pixel or the hit boxes drifted off the labels). Art
// that carries text cannot reflow, cannot scale, cannot be localised
// and cannot be read on a phone. Every word here is text in a real
// font, which is the single biggest thing this overhaul buys.
//
// ── THE LAW IS BORROWED, NOT REWRITTEN ───────────────────────────
//
// The settings pane renders through the SAME modules the shipped
// settings screen uses - systems/settings.js, ui/settingsMap.js,
// ui/settingsLaw.js, ui/settingsCopy.js. About 850 lines of law, all
// of it cited to DFU, and none of it is retyped here. Only the ~650
// lines of WebGL drawing get replaced. That split already existed;
// this is the first thing to test whether it was real.
//
// So the toggles on this page WRITE. Flip MusicVolume here and the
// game reads it, because there is one store and this is a second view
// of it rather than a second copy.
//
// ── AND IT COSTS NO GAME DATA ────────────────────────────────────
//
// Nothing on this screen needs ARENA2, and main.js now acts on that:
// the enhanced door mounts BEFORE ensureArena2 and the folder pick
// happens when a game actually starts. The classic menu cannot do
// that - it needs PICK03I0, a palette and FONT0003 before it can draw
// a single word - which is why the port's boot has always had to gate
// the pick ahead of the menu.
//
// So a player who opens the page to change a setting, read what is in
// the build, or find out whether their save is still there is never
// asked for a folder. That is not a cosmetic difference: on a phone
// the pick is a zip upload.
// ═══════════════════════════════════════════════════════════════════

import { CATEGORIES, keysOf } from '../ui/settingsMap.js';
import { widgetFor, blockedReason, formatValue, stepValue, COLOUR_KEYS } from '../ui/settingsLaw.js';
import { labelOf, helpOf, INSTEAD, TIER_TEXT } from '../ui/settingsCopy.js';
import {
  effectiveSettings, setValue, saveSettings, resetToDefaults, tierOf, DEFAULTS,
} from '../systems/settings.js';
import { readQuicksave } from '../systems/save.js';
import { uiSkin, otherSkin, setUiSkin, SKIN_NAMES } from '../systems/uiSkin.js';
import { dateFromClassicMinutes, dateString } from '../systems/gameDate.js';
import { BUILD_TAG } from '../buildTag.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';

// ── THE RAIL ─────────────────────────────────────────────────────
// Six destinations. Mac's call: the menus get set up now even where
// the thing behind them is not built, so a section that has no engine
// yet still has a home and says what it is waiting on. A rail with a
// hole in it teaches the player the hole is permanent.
const SECTIONS = ['Continue', 'New Game', 'Load Game', 'Settings', 'Mods', 'About'];
const idOf = (label) => label.toLowerCase().split(' ')[0];

// PER-MOUNT STATE. It was module-scope while this was a page that
// could only be opened once; the game mounts and unmounts it, so a
// second visit must not inherit the first one's open sheet.
let section = 'continue';
let category = CATEGORIES[0].id;
let pickedKey = null;
let sheetOpen = false;   // the help pane is a sheet on a phone
let app = null;
let onAction = () => {};

const el = (t, cls, txt) => {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};

// ── THE SAVE, READ FOR REAL ──────────────────────────────────────
// readQuicksave is save.js's own reader, so this reads exactly what
// the game wrote - no second parse of the envelope. There is ONE slot
// today (systems/save.js:27, `dagger.quicksave`), which is a fact the
// Load pane has to state rather than dress up as a list of one.
function savedGame() {
  let snap = null;
  try { snap = readQuicksave(); } catch { snap = null; }
  if (!snap) return null;
  const date = Number.isFinite(snap.classicMinutes) ? dateFromClassicMinutes(snap.classicMinutes) : null;
  return {
    name: snap.name || 'Unnamed',
    career: snap.career?.name ?? null,
    level: snap.level ?? null,
    health: snap.health, maxHealth: snap.maxHealth,
    gold: (snap.items ?? []).find((i) => i?.name === 'Gold Pieces')?.stackCount ?? null,
    when: date ? dateString(date) : null,
    hour: date ? `${String(date.hour).padStart(2, '0')}:${String(date.minute).padStart(2, '0')}` : null,
    chargenDone: snap.chargenDone !== false,
  };
}

function stats(pairs) {
  const dl = el('dl', 'stats');
  for (const [k, v] of pairs) {
    if (v == null) continue;
    dl.append(el('dt', null, k), el('dd', null, String(v)));
  }
  return dl;
}

function acts(list) {
  const wrap = el('div', 'acts');
  for (const a of list) {
    const b = el('button', a.primary ? 'act primary' : 'act', a.label);
    if (a.disabled) b.disabled = true;
    if (a.onClick) b.onclick = a.onClick;
    wrap.append(b);
  }
  return wrap;
}

/** A section that is set up but not yet backed. Shown, never hidden. */
function empty(title, line) {
  const e = el('div', 'empty');
  e.append(el('h3', null, title));
  e.append(el('p', null, line));
  return e;
}

/** ONE LINE. It carried a kicker, a title and a blurb - the rail's own
 *  word said three times before the player reaches anything pressable. */
const head = (title) => {
  const h = el('div', 'head');
  h.append(el('h2', null, title));
  return h;
};

// ── CONTINUE ─────────────────────────────────────────────────────
// The first entry, and the one classic does not have at all: classic
// opens on Load Game, which is a filing cabinet, when what a returning
// player wants is the ONE save they were just in. Skyrim's Continue is
// the whole reason its menu feels shorter than Daggerfall's, and it
// costs nothing here - the slot is already the only slot.
function paneContinue(body) {
  const save = savedGame();
  if (!save) {
    body.append(empty('No game in progress', 'Quicksave with F9 and it appears here.'));
    body.append(acts([{ label: 'Start a new game', primary: true, onClick: () => go('new') }]));
    return;
  }
  const c = el('div', 'card');
  c.append(el('h3', null, save.name));
  c.append(el('p', 'meta', [save.career, save.level ? `level ${save.level}` : null,
    save.when, save.hour].filter(Boolean).join(' · ')));
  c.append(stats([
    ['Health', save.maxHealth ? `${save.health} / ${save.maxHealth}` : save.health],
    ['Gold', save.gold != null ? save.gold.toLocaleString() : null],
  ]));
  c.append(acts([{ label: 'Continue', primary: true, onClick: () => onAction('continue') }]));
  body.append(c);
}

// ── NEW GAME ─────────────────────────────────────────────────────
// The three Startup keys are REAL and live here rather than buried in
// settings, because they are questions about the game you are about to
// start and nowhere else. StartInDungeon in particular is the answer
// to "do I begin in Privateer's Hold" - a new-game question wearing a
// settings key's clothes (systems/settings.js:83-88).
function paneNew(body) {
  const c = el('div', 'card');
  c.append(el('h3', null, 'A new character'));
  c.append(el('p', 'meta', 'Race, class, biography, face, skills.'));
  c.append(acts([{ label: 'Begin', primary: true, onClick: () => onAction('new') }]));
  body.append(c);

  const opts = el('div', 'card');
  opts.append(el('h3', null, 'Where you wake up'));
  for (const key of ['Startup/StartInDungeon', 'Startup/StartCellX', 'Startup/StartCellY']) {
    opts.append(settingRow(key, { compact: true }));
  }
  body.append(opts);
}

// ── LOAD GAME ────────────────────────────────────────────────────
function paneLoad(body) {
  const save = savedGame();
  if (save) {
    const c = el('div', 'card');
    c.append(el('span', 'tag', 'Quicksave'));
    c.append(el('h3', null, save.name));
    c.append(el('p', 'meta', [save.when, save.hour].filter(Boolean).join(' · ')));
    c.append(acts([
      { label: 'Load', primary: true, onClick: () => onAction('load') },
      { label: 'Delete', onClick: () => onAction('delete') },
    ]));
    body.append(c);
  }
  body.append(empty('Named slots', 'One quicksave slot today. Named saves and the classic .SAV are their own slices.'));
}

// ── SETTINGS ─────────────────────────────────────────────────────
// The whole shipped screen, rendered from the same law. Three panes:
// categories, rows, help. Nothing is filtered out by tier - a hidden
// setting is a setting the player cannot find out about, which is the
// rule U30 landed after the launcher hid them behind a filter.
function paneSettings(pane) {
  const panes = el('div', 'panes');

  const rail = el('div', 'subrail');
  for (const cat of CATEGORIES) {
    const b = el('button', `subbtn${cat.id === category ? ' on' : ''}`, cat.title);
    b.append(el('span', 'count', String(keysOf(cat.id).length)));
    b.onclick = () => { category = cat.id; pickedKey = null; render(); };
    rail.append(b);
  }

  const list = el('div', 'list');
  const keys = keysOf(category);
  // The dot legend, once at the top, instead of a word on every row.
  const legend = el('div', 'legend');
  for (const [cls, word] of [['live', 'works now'], ['stored', 'saved, unread'], ['unavailable', 'fixed here']]) {
    const s2 = el('span');
    s2.append(el('i', cls), document.createTextNode(word));
    legend.append(s2);
  }
  list.append(legend);
  // THE SKIN LIVES UNDER INTERFACE, which is what it is: a choice
  // about what the game's screens look like. It is not a DFU key and
  // never will be (DFU has no enhanced screens), so it is drawn as a
  // row rather than fetched from keysOf - see systems/uiSkin.js.
  if (category === 'interface') list.append(skinRow());
  if (!keys.length) list.append(empty('Nothing here yet', 'This category has no keys.'));
  for (const key of keys) list.append(settingRow(key));

  const detail = el('div', 'detail');
  const close = el('button', 'sheet-close', 'Close');
  close.onclick = () => { sheetOpen = false; render(); };
  detail.append(close);
  detail.append(pickedKey ? helpCard(pickedKey) : categoryCard());
  if (sheetOpen) detail.classList.add('open');

  panes.append(rail, list, detail);
  pane.append(panes);
}

/** The one control that is not a DFU setting. It reads and writes
 *  through uiSkin, and switching to classic reloads: the two skins are
 *  two hosts and there is nothing to hand over in place. */
function skinRow() {
  const row = el('div', 'row');
  const main = el('button', 'row-main');
  main.append(el('div', 'row-name', 'Interface Style'));
  main.onclick = () => { pickedKey = 'ui:skin'; sheetOpen = true; render(); };
  row.append(main);
  const ctl = el('div', 'ctl');
  const b = el('button', 'act primary', SKIN_NAMES[uiSkin()]);
  b.style.minHeight = '38px';
  b.style.padding = '8px 16px';
  b.onclick = () => {
    setUiSkin(otherSkin(uiSkin()));
    const url = new URL(location.href);
    url.searchParams.delete('skin');
    location.replace(url.toString());
  };
  ctl.append(b, el('span', 'tier live'));
  row.append(ctl);
  return row;
}

function categoryCard() {
  const cat = CATEGORIES.find((c) => c.id === category);
  const d = el('div', 'dcard');
  d.append(el('h3', null, cat.title));
  d.append(el('p', null, cat.blurb));
  const b = el('button', 'act', 'Reset everything to defaults');
  b.onclick = () => { resetToDefaults(); render(); };
  d.append(b);
  return d;
}

/** THE HELP PANEL. DFU's own words for the setting (settingsCopy pulls
 *  them from GameSettings.txt), then the tier line, then the raw
 *  `[Section] Key` - which appears in exactly ONE place in the whole
 *  interface, for the player who wants it. */
function helpCard(key) {
  if (key === 'ui:skin') {
    const d = el('div', 'dcard');
    d.append(el('h3', null, 'Interface Style'));
    d.append(el('p', null, 'Enhanced is these screens. Classic is Daggerfall\u2019s own, pixel for pixel, on the art it shipped with.'));
    d.append(el('p', 'status', 'This works now. Switching reloads the game.'));
    return d;
  }
  const tier = tierOf(key);
  const d = el('div', 'dcard');
  d.append(el('h3', null, labelOf(key)));
  const help = helpOf(key);
  if (help) d.append(el('p', null, help));
  d.append(el('p', 'status', TIER_TEXT[tier]));
  if (tier === 'unavailable') {
    d.append(el('p', null, blockedReason(key)));
    if (INSTEAD[key]) d.append(el('p', null, INSTEAD[key]));
  }
  const [sec, k] = key.split('/');
  d.append(el('code', null, `[${sec}] ${k}`));
  return d;
}

/**
 * One setting, as a row. The control is chosen by widgetFor, which is
 * total over all 171 keys and takes no judgement from this file:
 * switch | enum | number | colour | text | blocked.
 *
 * A blocked row is DRAWN, greyed, with its reason one press away. That
 * is deliberate and it is the port's own standing rule: DFU ships
 * EnhancedCombatAI True and we run the classic path, so a working
 * toggle there would be a lying toggle.
 */
function settingRow(key, { compact = false } = {}) {
  const widget = widgetFor(key);
  const raw = effectiveSettings()[key.split('/')[0]]?.[key.split('/')[1]];
  const tier = tierOf(key);
  const blocked = widget === 'blocked';

  const row = el('div', `row${key === pickedKey ? ' on' : ''}${blocked ? ' blocked' : ''}`);

  // The raw `Section/Key` used to sit under every label. It appears in
  // exactly ONE place now - the help panel - which is where it was
  // always meant to be and where the player who wants it will look.
  const main = el('button', 'row-main');
  main.append(el('div', 'row-name', labelOf(key)));
  main.onclick = () => { pickedKey = key; sheetOpen = true; render(); };
  row.append(main);

  const ctl = el('div', 'ctl');
  const val = el('span', 'val', formatValue(key, raw));

  if (blocked || widget === 'text') {
    ctl.append(val);
  } else if (widget === 'colour') {
    const sw = el('span', 'swatch');
    sw.style.background = `#${String(raw ?? '').slice(0, 6)}`;
    ctl.append(sw, val);
  } else if (widget === 'switch') {
    // A switch has one direction, so it gets one control rather than a
    // pair of arrows pointing at the same place.
    const b = el('button', 'act', formatValue(key, raw));
    b.style.minHeight = '38px';
    b.style.padding = '8px 16px';
    if (raw === 'True') b.classList.add('primary');
    b.onclick = () => write(key, stepValue(key, raw, 1));
    ctl.append(b);
  } else {
    ctl.append(val);
    for (const [dir, glyph] of [[-1, '\u2039'], [1, '\u203a']]) {
      const b = el('button', 'step', glyph);
      b.setAttribute('aria-label', `${dir < 0 ? 'less' : 'more'} ${labelOf(key)}`);
      // shift is the COARSE step settingsLaw already defines - a
      // volume slider that moves in 5% steps is 20 presses of patience
      // without it.
      b.onclick = (e) => write(key, stepValue(key, raw, dir, e.shiftKey));
      ctl.append(b);
    }
  }

  if (!compact) ctl.append(el('span', `tier ${tier}`));
  row.append(ctl);
  return row;
}

/** Write through the real store and persist, exactly as the shipped
 *  screen does. setValue drops an override that equals the default
 *  rather than pinning today's value, which is settings.js's law. */
function write(key, next) {
  if (next == null) return;
  const [sec, k] = key.split('/');
  setValue(sec, k, next);
  saveSettings();
  render();
}

// ── MODS ─────────────────────────────────────────────────────────
// There is NO mod system (Ledger C, Not planned - and settings.js:159
// blocks four keys on exactly that ground). The section still exists,
// because Mac's call was to set the menus up now, and because a rail
// that quietly omits mods teaches the player they are impossible.
function paneMods(body) {
  body.append(empty('No add-ons installed', 'This port has no mod system, so there is no loader for a mod to load into.'));
  const c = el('div', 'card');
  c.append(el('h3', null, "DFU's mod switches"));
  for (const key of ['Enhancements/LypyL_ModSystem', 'Enhancements/AssetInjection',
    'Enhancements/CompressModdedTextures', 'Experimental/CustomBooksImport']) {
    c.append(settingRow(key));
  }
  body.append(c);
}

// ── ABOUT ────────────────────────────────────────────────────────
function paneAbout(body) {
  const c = el('div', 'card');
  c.append(el('h3', null, 'project-dagger'));
  c.append(el('p', 'meta', 'A 1:1 JavaScript port of Daggerfall.'));
  c.append(stats([
    ['Build', BUILD_TAG],
    ['Interface', SKIN_NAMES[uiSkin()]],
    ['Settings', `${Object.values(DEFAULTS).reduce((n, s2) => n + Object.keys(s2).length, 0)} keys`],
  ]));
  body.append(c);
  body.append(empty('Exit', 'A browser tab cannot close itself. Close it yourself; the quicksave survives.'));
}

// ── SHELL ────────────────────────────────────────────────────────
function go(id) { section = id; pickedKey = null; sheetOpen = false; render(); }

function render() {
  app.innerHTML = '';
  const shell = el('div', 'shell');

  const side = el('aside', 'side');
  const brand = el('div', 'brand');
  brand.append(el('h1', null, 'Daggerfall'));
  brand.append(el('div', 'sub', 'Enhanced'));
  side.append(brand);

  const rail = el('nav', 'rail');
  for (const label of SECTIONS) {
    const id = idOf(label);
    const b = el('button', `railbtn${id === section ? ' on' : ''}`);
    b.append(el('span', 'rk', label));
    b.onclick = () => go(id);
    rail.append(b);
  }
  side.append(rail);

  const foot = el('div', 'foot');
  foot.append(document.createTextNode('build '));
  foot.append(el('span', null, BUILD_TAG));
  side.append(foot);

  const pane = el('main', 'pane');
  if (section === 'settings') {
    // The settings pane owns its own three columns and its own
    // scrolling, so it takes the pane whole rather than sitting under
    // a heading that would eat a third of a phone screen.
    pane.style.overflow = 'hidden';
    paneSettings(pane);
  } else {
    pane.append(head(SECTIONS.find((l) => idOf(l) === section)));
    const body = el('div', 'body');
    ({ continue: paneContinue, new: paneNew, load: paneLoad, mods: paneMods, about: paneAbout })[section](body);
    pane.append(body);
  }

  shell.append(side, pane);
  app.append(shell);
}

/**
 * Mount the menu into a host element. Returns { unmount }.
 *
 * The style goes in here rather than at import time: a module that
 * writes to the document when it is merely IMPORTED cannot be imported
 * by a test, and the classic skin imports nothing of this at all.
 */
export function mountEnhancedMenu(host, { onAction: handler = () => {} } = {}) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  app = host;
  onAction = handler;
  section = 'continue';
  category = CATEGORIES[0].id;
  pickedKey = null;
  sheetOpen = false;
  render();
  // The probe surface, the same shape settingsProbe.mjs drives: a real
  // browser check should read the SAME layout a finger taps.
  globalThis.__menu = () => JSON.stringify({
    section, category, pickedKey,
    sections: SECTIONS.map(idOf),
    rows: [...host.querySelectorAll('.row')].length,
  });
  return {
    unmount() {
      host.innerHTML = '';
      app = null;
      onAction = () => {};
      delete globalThis.__menu;
    },
  };
}

/**
 * The GAME's front door: mount over the canvas, resolve with the
 * action the player picked, and take the screen down on the way out.
 *
 * Settings, Mods and About never resolve - they are destinations
 * inside this screen, not exits from it - which is the whole point of
 * one menu rather than four.
 */
export function runEnhancedMenu(doc = document) {
  const host = doc.createElement('div');
  host.id = 'enhanced-menu';
  // Over the canvas, and OPAQUE: the renderer clears to the pale Iliac
  // Bay sky, which would otherwise show through as a blue wash. The
  // classic menu solves the same problem by filling its letterbox
  // black (startWindow.js draw), and this is that law in CSS.
  host.style.cssText = 'position:fixed;inset:0;z-index:12;background:#0e1013;overflow:hidden';
  doc.body.append(host);
  return new Promise((resolve) => {
    const menu = mountEnhancedMenu(host, {
      onAction: (action) => {
        if (action === 'delete') return;   // FLAGGED: no save manager yet
        menu.unmount();
        host.remove();
        resolve(action);
      },
    });
  });
}
