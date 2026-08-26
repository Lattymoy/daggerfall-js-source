// ═══════════════════════════════════════════════════════════════════
// ENHANCED — THE MAIN MENU
//
// The game's front door when the skin is enhanced, and ENHANCED IS THE
// DEFAULT (systems/uiSkin.js). One screen: continue, new game, load,
// settings, mods, about.
//
// ONE IMPLEMENTATION, THREE HOSTS. This module is mounted by the game
// at boot (src/main.js), by the prototype page (/menu.html, via
// src/tools/enhancedMenu.js), and by the PAUSE DOOR once the game is
// running (ui/pauseDoor.js) - and there is no second copy of any of
// it. The prototype exists to be argued with and must therefore be the
// same screen that ships, or the argument is with something else.
//
// ── TWO MODES, ONE SCREEN (U51) ──────────────────────────────────
//
// `mode: 'boot'` is the front door. `mode: 'pause'` is the same screen
// mounted over a running game by Escape, and the difference is the
// RAIL and nothing else: Continue and New Game are boot questions and
// go, Resume / Save Game / Exit are in-game ones and arrive. Settings,
// Mods and About are identical in both, which is the entire point -
// the reason this door exists is that settings were reachable only at
// boot, and a pause screen carrying its OWN settings view would have
// recreated the divergence it was built to close.
//
// A SECOND ENHANCED SCREEN WAS THE OBVIOUS BUILD AND IS THE WRONG ONE.
// The classic pause window is a separate window because classic has no
// choice - OPTN00I0 is a different .IMG from PICK03I0. Here the two
// are one module with a rail that changes, so a setting added to the
// front door is in the pause screen the same afternoon.
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
import { restorableQuicksave, QUICKSAVE_KEY } from '../systems/save.js';
import { uiSkin, otherSkin, setUiSkin, SKIN_NAMES } from '../systems/uiSkin.js';
import { dateFromClassicMinutes, dateString } from '../systems/gameDate.js';
import { BUILD_TAG } from '../buildTag.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { repaintKeepingScroll } from './domRepaint.js';
import { overlayAction } from './input.js';   // U51: Escape, through the shared table

// ── THE RAIL ─────────────────────────────────────────────────────
// Six destinations. Mac's call: the menus get set up now even where
// the thing behind them is not built, so a section that has no engine
// yet still has a home and says what it is waiting on. A rail with a
// hole in it teaches the player the hole is permanent.
const SECTIONS_BOOT = ['Continue', 'New Game', 'Load Game', 'Settings', 'Mods', 'About'];

// U51: the same rail with the boot-only questions swapped for the
// in-game ones. Continue and New Game answer "which game", which is
// settled by the time this mounts over a running one; Resume, Save and
// Exit answer "what now", which is the only thing left to ask.
//
// SAVE AND LOAD STAY ON THE RAIL EVEN WHERE THE HOST REFUSES THEM.
// Two of the four hosts hand `savingPrevented: () => true` and no save
// hook at all (exterior, worldModes), and the pane says so in words. A
// rail that drops the row instead teaches the player the door was
// never there - the same argument the Mods section is built on.
const SECTIONS_PAUSE = ['Resume', 'Save Game', 'Load Game', 'Settings', 'Mods', 'About', 'Exit'];

const idOf = (label) => label.toLowerCase().split(' ')[0];

/** Rail entries that ACT rather than navigate. Resume has no pane to
 *  show - a screen whose only content is a button repeating the word
 *  you just pressed is a screen that wasted a press. */
const RAIL_ACTS = Object.freeze({ resume: 'resume' });

// PER-MOUNT STATE. It was module-scope while this was a page that
// could only be opened once; the game mounts and unmounts it, so a
// second visit must not inherit the first one's open sheet.
let section = 'continue';
let category = CATEGORIES[0].id;
let pickedKey = null;
let sheetOpen = false;   // the help pane is a sheet on a phone
let app = null;
let onAction = () => {};
// U51: 'boot' (the front door) or 'pause' (Escape, over a running
// game). `hooks` is the host's own save/load/exit trio, handed down by
// ui/pauseDoor.js and empty at boot.
let mode = 'boot';
let sections = SECTIONS_BOOT;
let hooks = {};
let keyHandler = null;
let lockHandler = null;

const el = (t, cls, txt) => {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};

// ── THE SAVE, READ FOR REAL ──────────────────────────────────────
// restorableQuicksave is save.js's own reader AND its own version
// test, so a card is drawn only for an envelope this build can
// actually restore. Reading it with readQuicksave was AUDIT F2: an
// older save drew a full Continue card and pressing it came up on the
// chargen wizard. There is ONE slot today (systems/save.js:27,
// `dagger.quicksave`), which is a fact the Load pane has to state
// rather than dress up as a list of one.
function savedGame() {
  let snap = null;
  try { snap = restorableQuicksave(); } catch { snap = null; }
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

// THE SAVED GAME'S OWN LINE AND ITS NUMBERS, written once. FOUR
// panes now draw the same single slot - Continue, Load, Save and Exit
// - and four hand-rolled copies of "career, level, date, time" is how
// they come to disagree about which of those a player is shown. Both
// helpers are lifted verbatim out of paneContinue, so that pane draws
// exactly what it drew before.
const saveLine = (save) => [save.career, save.level ? `level ${save.level}` : null,
  save.when, save.hour].filter(Boolean).join(' · ');

const saveStats = (save) => [
  ['Health', save.maxHealth ? `${save.health} / ${save.maxHealth}` : save.health],
  ['Gold', save.gold != null ? save.gold.toLocaleString() : null],
];

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

// ── THE CONFIRM ──────────────────────────────────────────────────
// AUDIT F3/F4. Two destructive actions shipped without one: Reset
// wiped every override on a single press (the CLASSIC screen has
// always confirmed - settingsWindow's 'r' arm) and Delete did nothing
// at all, drawn undimmed and operable-looking, because onAction caught
// it and returned. A button that looks operable and is not is the
// thing the anti-lie law forbids; a destructive one that does not ask
// is worse.
let confirming = null;   // { title, body, label, onYes }

function confirmCard() {
  const c = el('div', 'card');
  c.append(el('h3', null, confirming.title));
  c.append(el('p', 'meta', confirming.body));
  c.append(acts([
    { label: confirming.label, primary: true, onClick: () => { const f = confirming.onYes; confirming = null; f(); render(); } },
    { label: 'Cancel', onClick: () => { confirming = null; render(); } },
  ]));
  return c;
}

const ask = (title, body, label, onYes) => { confirming = { title, body, label, onYes }; render(); };

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
  c.append(el('p', 'meta', saveLine(save)));
  c.append(stats(saveStats(save)));
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
    // U51: in pause mode the LOAD arm is the HOST's, and two of the
    // four hand no quickLoad at all. No hook, no button - and the line
    // below says which it is rather than dimming a control with no
    // explanation attached to it.
    const canLoad = mode !== 'pause' || typeof hooks.quickLoad === 'function';
    c.append(acts([
      // NO CONFIRM ON LOAD, in either mode. It discards unsaved play,
      // which is the shape AUDIT F3/F4 made confirm - but classic's
      // own pause window loads on one press (pauseWindow.js:198) and
      // so does F11, and inventing a prompt on exactly one of the
      // port's three load doors is a divergence, not a safety net.
      { label: 'Load', primary: true, disabled: !canLoad, onClick: canLoad ? () => onAction('load') : null },
      { label: 'Delete', onClick: () => ask(
        'Delete this game',
        `${save.name} is the only saved game, and deleting it cannot be undone.`,
        'Delete',
        () => { try { globalThis.localStorage?.removeItem(QUICKSAVE_KEY); } catch { /* storage disabled */ } },
      ) },
    ]));
    body.append(c);
  }
  if (mode === 'pause' && typeof hooks.quickLoad !== 'function') {
    body.append(empty('Not from here',
      'This part of the game has no load door. Reach a saved game from the main menu instead.'));
  }
  body.append(empty('Named slots', 'One quicksave slot today. Named saves and the classic .SAV are their own slices.'));
}

// ── SAVE GAME (pause only) ───────────────────────────────────────
// U51. Classic's SAVE button closes the window and then writes
// (pauseWindow.js:195, `this._closeWith(); this.hooks.quickSave?.()`),
// and this does the same for a reason that is not only parity: the
// port answers a write with a HUD LINE, and this screen is a fixed
// opaque div over the whole canvas, so a save that left the door open
// would put its own confirmation underneath itself.
//
// THE CARD SHOWS WHAT IS ABOUT TO BE OVERWRITTEN. There is ONE slot
// (systems/save.js, `dagger.quicksave`), so every save is an
// overwrite. Classic does not confirm one and neither does F9, so
// neither does this - but a player who can read the name and the date
// they are writing over has been told, which is the part classic
// never does.
function paneSave(body) {
  // IsSavingPrevented, the classic gate, verbatim - and the same
  // recovered string, because it is the game's own answer and not a
  // thing this screen gets to reword.
  const prevented = hooks.savingPrevented?.() || typeof hooks.quickSave !== 'function';
  if (prevented) {
    body.append(empty('You cannot save now.',
      'This part of the game holds no save door. Step back outside and the quicksave returns.'));
    return;
  }
  // THE CARD IS THE GAME BEING OVERWRITTEN, not a label for the
  // button. It draws the same name, line and numbers the Continue card
  // does, because that is precisely what the press replaces - and a
  // player who can read it has been told, which is the part classic
  // never does at any size.
  const save = savedGame();
  const c = el('div', 'card');
  if (save) c.append(el('span', 'tag', 'Overwrites'));
  c.append(el('h3', null, save ? save.name : 'Quicksave'));
  c.append(el('p', 'meta', save ? saveLine(save) : 'The first save in this slot.'));
  if (save) c.append(stats(saveStats(save)));
  c.append(acts([{ label: 'Save', primary: true, onClick: () => onAction('save') }]));
  body.append(c);
  body.append(empty('One slot', 'Every save writes the same quicksave, replacing whatever is above. Named slots are their own slice.'));
}

// ── EXIT (pause only) ────────────────────────────────────────────
// U51. Classic confirms on TEXT.RSC 1069 and then posts dfuiExitGame
// (pauseWindow.js:161); in a browser Application.Quit means nothing,
// so the port's door out has always been the front door - the same
// unwind chargen's cancel and the death sequence use (Ledger A).
//
// THE WORDS ARE THIS SCREEN'S OWN, not record 1069. That is the whole
// premise of the enhanced skin - it opens before the ARENA2 pick and
// cannot read TEXT.RSC to ask a question - and it is recorded here
// rather than left to look like an oversight.
// THE HEADING SAYS WHERE YOU GO; THE BUTTON SAYS WHAT YOU DO; THE
// CONFIRM ECHOES THE BUTTON. The first draft titled the card AND the
// confirm "Leave this game", so the one press between them appeared to
// change nothing - a confirm that repeats the card it replaced reads
// as a screen that did not respond.
function paneExit(body) {
  const save = savedGame();
  const c = el('div', 'card');
  c.append(el('h3', null, 'Back to the main menu'));
  c.append(el('p', 'meta', "A browser tab cannot close itself, so the port's door out is the "
    + 'front door - the same unwind the death sequence uses.'));
  c.append(stats([['Last save', save ? saveLine(save) : 'none']]));
  c.append(acts([{
    label: 'Leave this game',
    primary: true,
    onClick: () => ask(
      'Leave this game',
      save
        ? `Anything since ${save.when ?? 'the last save'} is lost. The quicksave itself is untouched.`
        : 'Nothing has been saved in this game, so all of it is lost.',
      'Exit',
      () => onAction('exit'),
    ),
  }]));
  body.append(c);
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
    const on = cat.id === category;
    const b = el('button', `subbtn${on ? ' on' : ''}`, cat.title);
    b.append(el('span', 'count', String(keysOf(cat.id).length)));
    // AUDIT F8, found by the live check rather than by reading: on a
    // PHONE the detail pane is a sheet that only rises when a ROW is
    // tapped, so the category card - and the Reset button living in it
    // - could never be seen at all. Playwright spent thirty seconds
    // trying to click a button translated 101% off the bottom of the
    // screen, which is exactly the AUDIT 24 shape: a control that
    // exists, is drawn, and cannot be reached on the device that needs
    // it most.
    //
    // A SECOND TAP ON THE SELECTED CATEGORY OPENS ITS CARD. That is
    // not invented: settingsWindow's click arm already makes a second
    // tap on an already-selected row act on it ("one finger, no
    // modifier, the phone equivalent of Right"), so this is the
    // port's own gesture applied one level up. The dot on the active
    // tab is the affordance, because a gesture nobody can see is a
    // gesture nobody uses.
    b.onclick = () => {
      if (on) { pickedKey = null; sheetOpen = true; } else { category = cat.id; pickedKey = null; }
      render();
    };
    if (on) b.append(el('span', 'more-dot'));
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
  close.onclick = () => { sheetOpen = false; confirming = null; render(); };
  detail.append(close);
  detail.append(confirming ? confirmCard() : (pickedKey ? helpCard(pickedKey) : categoryCard()));
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
  b.onclick = () => ask(
    'Reset Everything',
    'Put every setting back the way Daggerfall Unity ships it. '
    + 'Your interface style and text size are not settings and are left alone.',
    'Reset',
    () => { resetToDefaults(); _eff = null; },
  );
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
// AUDIT F7: this read effectiveSettings() - a full merge of all 171
// keys over the defaults - ONCE PER ROW, so the Game category rebuilt
// the whole store twenty-one times per render and Video sixty-six.
//
// The cache lives as long as the mount and is dropped by every path
// that can change the store: write(), the reset, and the mount itself.
// Nothing else in the running page writes settings while this screen
// is up - it is the only screen up - so a longer-lived cache would
// still be correct, but tying it to the writers is what makes that
// true by construction rather than by circumstance.
let _eff = null;
const effective = () => (_eff ??= effectiveSettings());

function settingRow(key, { compact = false } = {}) {
  const widget = widgetFor(key);
  const [_sec, _k] = key.split('/');
  const raw = effective()[_sec]?.[_k];
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
    // AUDIT F5: these rows drew a value with no control and no reason,
    // which reads as broken rather than as unbuilt. A native colour
    // input IS the editor - it is the one widget a browser gives us
    // that beats anything the classic screen could draw - and it
    // writes through the same setValue every other row uses.
    const sw = el('input', 'swatch');
    sw.type = 'color';
    sw.value = `#${String(raw ?? '').slice(0, 6)}`;
    sw.setAttribute('aria-label', labelOf(key));
    // DFU's colour keys are RGBA8; the picker owns RGB, so the stored
    // ALPHA byte is carried through untouched rather than silently
    // reset to FF (ToolTipBackgroundColor ships D2 and means it).
    sw.oninput = () => write(key, (sw.value.slice(1) + String(raw ?? '').slice(6)).toUpperCase());
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
  _eff = null;   // the store changed - drop the cache, then redraw from it
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
function go(id) { section = id; pickedKey = null; sheetOpen = false; confirming = null; render(); }

function render() {
  repaintKeepingScroll(app, () => renderInto());
}

/** The rebuild. Wrapped for the reason the wizard's is: the settings
 *  list carries the same steppers, and a repaint that forgets the
 *  scroll throws the player back to the top of 66 Video rows. */
function renderInto() {
  app.innerHTML = '';
  const shell = el('div', 'shell');

  const side = el('aside', 'side');
  const brand = el('div', 'brand');
  brand.append(el('h1', null, 'Daggerfall'));
  brand.append(el('div', 'sub', 'Enhanced'));
  side.append(brand);

  const rail = el('nav', 'rail');
  for (const label of sections) {
    const id = idOf(label);
    const b = el('button', `railbtn${id === section ? ' on' : ''}`);
    b.append(el('span', 'rk', label));
    // RAIL_ACTS: Resume resolves on the rail rather than opening a
    // pane. Every other entry is a destination.
    b.onclick = RAIL_ACTS[id] ? () => onAction(RAIL_ACTS[id]) : () => go(id);
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
    pane.append(head(sections.find((l) => idOf(l) === section)));
    const body = el('div', 'body');
    if (confirming) body.append(confirmCard());
    else {
      ({
        continue: paneContinue, new: paneNew, load: paneLoad,
        save: paneSave, exit: paneExit,
        mods: paneMods, about: paneAbout,
      })[section](body);
    }
    pane.append(body);
  }

  shell.append(side, pane);
  app.append(shell);
}

// ── THE KEYBOARD, AND WHAT IT IS NOT ─────────────────────────────
// U51 ships ESCAPE AND NOTHING ELSE, and says so rather than leaving
// the gap looking like an oversight. Escape is the door's own key -
// it is what opened this screen - and a pause screen you cannot get
// out of with the key that got you in is the trap the never-traps law
// is about.
//
// FLAGGED: the rest of the keyboard. The wizard walks to `done` with
// no pointer at all (U50, tools/enhancedChargenProbe.mjs) because a
// wizard is a LINE - up, down, confirm, back. This screen is three
// panes wide with a rail, a list and a help sheet, and arrow keys over
// it is a real design question about focus order, not a table lookup.
// Half of it would be worse than none: a rail that answers Down while
// the settings list does not teaches a player the list is broken.
//
// It routes through overlayAction - the SHARED table ui/input.js owns
// and every other window in the port answers through - so Escape here
// is the same Escape, rebound the same way, as Escape anywhere else.
function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (overlayAction(e) !== 'back') return;
  // THE BACK STACK, innermost first. A confirm card and a phone's help
  // sheet are both things Escape should close before it closes the
  // screen, or the one press that means "not that" quits the game. At
  // boot, with neither open, there is nothing behind the front door to
  // go back to - and a key this screen did not USE has to stay the
  // page's, which is the wizard's own rule (ui/enhancedChargen.js: do
  // not preventDefault a key you did not take, or Tab stops moving
  // focus and the screen becomes unreachable to anyone driving it that
  // way).
  const back = confirming ? () => { confirming = null; render(); }
    : sheetOpen ? () => { sheetOpen = false; render(); }
      : mode === 'pause' ? () => onAction('resume')
        : null;
  if (!back) return;
  e.preventDefault();
  // A MODAL OVERLAY OWNS ITS INPUT (the wizard's own law, U50). On
  // CAPTURE and stopped here, so the host's window keydown - which
  // walks the player and would re-toggle this very screen - never sees
  // a key this screen used.
  e.stopPropagation();
  back();
}

/**
 * AND THE POINTER LOCK - the wizard's other half of the same report
 * (see ui/enhancedChargen.js). A locked pointer does not travel
 * through the DOM at all: every mouse event goes to the locked element
 * as a movement delta, so a fixed div over the canvas is invisible to
 * it however high its z-index. At boot there is no lock to drop; in
 * pause there always is, because mouselook is the port's resting
 * state. Dropped on mount and kept dropped, so a host that re-takes it
 * gets it taken back once rather than this screen fighting for clicks
 * it cannot receive.
 */
function releaseLock() {
  try {
    if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock();
  } catch { /* a browser that refuses is a browser with no lock to drop */ }
}

/**
 * Mount the menu into a host element. Returns { unmount }.
 *
 * `mode` is 'boot' (the front door) or 'pause' (Escape, over a running
 * game); `hooks` is the host's own { quickSave, quickLoad, exitToMenu,
 * savingPrevented } and is read by the pause panes only.
 *
 * The style goes in here rather than at import time: a module that
 * writes to the document when it is merely IMPORTED cannot be imported
 * by a test, and the classic skin imports nothing of this at all.
 */
export function mountEnhancedMenu(host, {
  onAction: handler = () => {}, mode: m = 'boot', hooks: h = {},
} = {}) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  app = host;
  onAction = handler;
  mode = m === 'pause' ? 'pause' : 'boot';
  hooks = h ?? {};
  sections = mode === 'pause' ? SECTIONS_PAUSE : SECTIONS_BOOT;
  // WHICH PANE OPENS. Boot opens on Continue - the one save a
  // returning player wants. Pause opens on SAVE GAME, which is what a
  // player most often pressed Escape for, and Settings - the reason
  // this door exists at all - is one press away and permanently
  // visible on the rail, which is the thing classic could not do.
  section = mode === 'pause' ? 'save' : 'continue';
  category = CATEGORIES[0].id;
  pickedKey = null;
  sheetOpen = false;
  confirming = null;
  _eff = null;
  render();
  keyHandler = onKey;
  globalThis.addEventListener('keydown', keyHandler, { capture: true });
  lockHandler = releaseLock;
  releaseLock();
  if (typeof document !== 'undefined') document.addEventListener('pointerlockchange', lockHandler);
  // The probe surface, the same shape settingsProbe.mjs drives: a real
  // browser check should read the SAME layout a finger taps.
  globalThis.__menu = () => JSON.stringify({
    mode, section, category, pickedKey,
    sections: sections.map(idOf),
    rows: [...host.querySelectorAll('.row')].length,
  });
  return {
    unmount() {
      // EVERY LISTENER HAS AN OWNER (the wizard's law, U50). A
      // window-level keydown outlives the DOM it was mounted for, so a
      // menu torn down without this eats Escape for the whole session
      // - which on the pause door means the game can never be paused
      // again.
      if (keyHandler) globalThis.removeEventListener('keydown', keyHandler, { capture: true });
      if (lockHandler && typeof document !== 'undefined') document.removeEventListener('pointerlockchange', lockHandler);
      keyHandler = null;
      lockHandler = null;
      host.innerHTML = '';
      app = null;
      onAction = () => {};
      hooks = {};
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
