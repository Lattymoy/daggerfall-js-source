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

import { fpArm, hasDaggerfallArrows } from '../combat/fpArm.js';
import { TEST_PRESETS } from '../systems/testRoom.js';   // TR3: the one home the pane shows
import { mwRaceId } from '../formats/mwNpc.js';
import { EQUIP_SLOTS, equipTableOf } from '../systems/equip.js';
import { dfWornEquipment } from '../formats/mwItemMap.js';
import { ARMOR_ENUM } from '../combat/enemyEquipment.js';
import { morrowindDataCount, assetPickerOpen } from '../scenes/dataSource.js';   // MW-IMPORT: the attach door; MWFIX: and the modal it opens owns the keyboard
import { CATEGORIES, keysOf } from '../ui/settingsMap.js';
import { widgetFor, blockedReason, formatValue, stepValue, COLOUR_KEYS } from '../ui/settingsLaw.js';
import { labelOf, helpOf, INSTEAD, TIER_TEXT } from '../ui/settingsCopy.js';
import {
  effectiveSettings, setValue, saveSettings, resetToDefaults, tierOf, DEFAULTS,
} from '../systems/settings.js';
import { mostRecentRestorable, deleteSave } from '../systems/saveSlots.js';   // SAV4: the slot store
import { uiSkin, otherSkin, setUiSkin, SKIN_NAMES } from '../systems/uiSkin.js';
import { getPref, setPref } from '../systems/uiPrefs.js';   // R7: the Enhanced pane's own switches
import { dateFromClassicMinutes, dateString, dateTimeString } from '../systems/gameDate.js';
// PX5: the pause clock reads THE ONE CLOCK directly (AUDIT 23 C2's
// law - every host already reads this same module), so no host seam
// is needed and no host can drift.
import { worldMinutes } from '../systems/worldTick.js';
import { BUILD_TAG } from '../buildTag.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { repaintKeepingScroll } from './domRepaint.js';
import { drawPixelGround } from './pixelGround.js';
// PX3: the pause window's Stats tab reads the shared player entity
// through the char sheet's own model - one law, not a restatement.
// Both are plain modules with no game data; the boot door never
// renders the tab, so the front door still reads no game state.
import { sheetModel } from './enhancedCharSheet.js';
import { enhancedHudScale as hudScaleNow, HUD_SCALE_MIN, HUD_SCALE_MAX } from './enhancedHud.js';   // PX30c
import { playerEntity } from '../characters/playerEntity.js';
// PX6: the Stats page's skill labels - the one home (systems/skills.js).
import { SKILL_NAMES } from '../systems/skills.js';
import { overlayAction } from './input.js';   // U51: Escape, through the shared table
import { CREDITS } from './credits.js';   // CR1: who made what the port carries

// ── THE RAIL ─────────────────────────────────────────────────────
// Six destinations. Mac's call: the menus get set up now even where
// the thing behind them is not built, so a section that has no engine
// yet still has a home and says what it is waiting on. A rail with a
// hole in it teaches the player the hole is permanent.
// R7 (Mac): ENHANCED is a section of its own, and on the BOOT rail
// only. The port's own switches were scattered - the skin under the
// brand, and the port's own additions in no interface at all - and a
// switch a player cannot find is not shipped. It is absent from SECTIONS_PAUSE deliberately: these
// answer "what kind of game am I about to play", which is settled by
// the time a pause menu opens, and two of them cannot take effect
// without a reload anyway.
// TR3 (Mac): TEST ROOM on the boot rail - a prebuilt character and a
// packed armory, for trying gear on the rigs without playing there.
// Boot-only for the same reason Continue and New Game are: it answers
// "which game", which is settled once one is running.
const SECTIONS_BOOT = ['Continue', 'New Game', 'Load Game', 'Test Room', 'Enhanced', 'Settings', 'Mods', 'About'];

// U51: the same rail with the boot-only questions swapped for the
// in-game ones. Continue and New Game answer "which game", which is
// settled by the time this mounts over a running one; Resume, Save and
// Exit answer "what now", which is the only thing left to ask.
//
// SAVE AND LOAD STAY ON THE RAIL EVEN WHERE THE HOST REFUSES THEM.
// One host still hands `savingPrevented: () => true` and no save hook
// at all (exterior.js, the block-viewer probe; IS1 wired the interior
// mode's doors), and the pane says so in words. A rail that drops the
// row instead teaches the player the door was never there - the same
// argument the Mods section is built on.
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
let resizeHandler = null;   // PX1: the home ground's redraw-on-resize
let groundTimer = null;     // PX1b: the home sky's 8fps clock - cleared by every rebuild and by unmount
let pauseTab = 'system';    // PX3: which tab the pause window shows - System lands on Resume/Save
let questSel = null;        // PX4: the journal's selected row - 'a:<uid>' | 'f:<index>' | null = first active
let statsSec = 'character'; // PX6: the Stats page's rail - character | attributes | skills | standing
let statsAllSkills = false; // PX6: the Miscellaneous disclosure, the sheet's own gesture
let sysSec = 'save';        // PX7: the System page's rail - which pane fills the detail

const el = (t, cls, txt) => {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};

// ── THE SAVE, READ FOR REAL ──────────────────────────────────────
// mostRecentRestorable is the slot store's own reader AND version
// test, so a card is drawn only for an envelope this build can
// actually restore. Reading raw was AUDIT F2: an older save drew a
// full Continue card and pressing it came up on the chargen wizard.
// SAV4: the store holds NAMED SLOTS now; these panes draw the most
// recent one (the boot Load arm loads exactly that), and the full
// slot list is the classic save window's - an enhanced-skin slot
// list is the PX lane's own card to design.
function savedGame() {
  let entry = null;
  try { entry = mostRecentRestorable(); } catch { entry = null; }
  if (!entry) return null;
  const snap = entry.snap;
  const date = Number.isFinite(snap.classicMinutes) ? dateFromClassicMinutes(snap.classicMinutes) : null;
  return {
    key: entry.key,
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

// ── TEST ROOM ────────────────────────────────────────────────────
// TR3: pick a prebuilt character, walk into the ordinary world with
// the whole armory in your pack. The presets live in systems/
// testRoom.js - ONE home the route (main.js) and the boot (world.js)
// also read; this pane only shows them. Each card is a door: pressing
// it IS the boot, the same shape Continue's card takes.
function paneTest(body) {
  const intro = el('div', 'card');
  intro.append(el('h3', null, 'The test room'));
  intro.append(el('p', 'meta',
    'A prebuilt character in the ordinary world, with one of every weapon, a full suit of '
    + 'armor across materials, all four shields and a change of clothes already in the pack. '
    + 'Equip through the inventory as usual; the paperdoll, the sprite weapons and - with '
    + 'Morrowind data attached - the first- and third-person body all follow the equip table '
    + 'live. Scroll to switch views. Nothing here is saved over your real game.'));
  body.append(intro);
  for (const p of TEST_PRESETS) {
    const c = el('div', 'card');
    c.append(el('h3', null, p.label));
    c.append(el('p', 'meta', p.blurb));
    c.append(acts([{ label: `Enter as the ${p.label}`, primary: true, onClick: () => onAction(`test:${p.id}`) }]));
    body.append(c);
  }
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
        `Deleting ${save.name}'s most recent save cannot be undone.`,
        'Delete',
        () => { try { deleteSave(save.key); } catch { /* storage disabled */ } },
      ) },
    ]));
    body.append(c);
  }
  if (mode === 'pause' && typeof hooks.quickLoad !== 'function') {
    body.append(empty('Not from here',
      'This part of the game has no load door. Reach a saved game from the main menu instead.'));
  }
  body.append(empty('More saves', 'This pane shows the most recent save; the full slot list rides the classic save window for now.'));
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

/** PX10: THE CONDENSED SETTINGS (pause only). Every key whose tier is
 *  LIVE - derived from the tier map itself, so a setting that gains a
 *  consumer joins this pane the same day - rendered through the SAME
 *  settingRow every screen uses, with the same rising sheet for help.
 *  The full catalog stays on the main menu's Settings (Mac's call:
 *  'the pause menu should have a more condensed settings menu while
 *  the main menu holds most settings'), and the closing line says so
 *  rather than letting the short list read as the whole store - the
 *  U30 nothing-hidden law kept by TELLING, not by showing all 171. */
function paneQuickSettings(pane) {
  const panes = el('div', 'panes');
  const list = el('div', 'list');
  let any = false;
  // One scroll, grouped under the categories' own titles - 48 live
  // rows flat read as a wall; the dividers give the scroll a spine
  // without bringing back the chip strip this pane exists to shed.
  for (const cat of CATEGORIES) {
    const liveKeys = keysOf(cat.id).filter((key) => tierOf(key) === 'live');
    if (!liveKeys.length) continue;
    any = true;
    list.append(pxDivider(cat.title));
    for (const key of liveKeys) list.append(settingRow(key));
  }
  if (!any) list.append(empty('Nothing live here yet', 'No setting has an in-game consumer in this build.'));
  list.append(el('p', 'px-note', 'Every setting lives on the main menu\u2019s Settings.'));
  panes.append(list);

  const detail = el('div', 'detail');
  const close = el('button', 'sheet-close', 'Close');
  close.onclick = () => { sheetOpen = false; confirming = null; render(); };
  detail.append(close);
  detail.append(confirming ? confirmCard() : (pickedKey ? helpCard(pickedKey) : el('div')));
  if (sheetOpen) detail.classList.add('open');
  panes.append(detail);
  pane.append(panes);
}

/** THE ONE WAY TO SWITCH SKINS, for every control that offers it.
 *  Stores the choice through uiSkin and reloads without any ?skin=
 *  override: the two skins are two hosts and there is nothing to hand
 *  over in place. */
export function switchSkin(to = otherSkin(uiSkin())) {
  setUiSkin(to);
  const url = new URL(location.href);
  url.searchParams.delete('skin');
  location.replace(url.toString());
}

/** The one control that is not a DFU setting. It reads and writes
 *  through uiSkin, and switching to classic reloads (switchSkin). */
function skinRow() {
  const row = el('div', 'row');
  const main = el('button', 'row-main');
  main.append(el('div', 'row-name', 'Interface Style'));
  main.onclick = () => { pickedKey = 'ui:skin'; sheetOpen = true; render(); };
  row.append(main);
  const ctl = el('div', 'ctl');
  const b = el('button', 'act primary', SKIN_NAMES[uiSkin()]);
  b.classList.add('rowact');   // AUDIT UI: sized by the sheet, so the coarse-pointer rule can reach it
  b.onclick = () => switchSkin();
  ctl.append(b, el('span', 'tier live'));
  row.append(ctl);
  return row;
}

/** THE SWITCH ON THE DOOR (2026-08-27, Mac: "not hide the enhanced
 *  version toggle within a settings window and instead make it more
 *  loud. Enhanced is on by default and I want people to know they can
 *  easily switch if they want classic"). Under the brand, where the
 *  word ENHANCED already sat: the two skins side by side, the one in
 *  effect lit, the other one press away, and the word "switch anytime"
 *  under them so nobody has to guess that the pair is a control. It is
 *  the settings row's own door (switchSkin), not a second one. */
export function skinSwitch() {
  const wrap = el('div', 'skinswitch');
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', 'Interface');
  const current = uiSkin();
  for (const skin of ['enhanced', 'classic']) {
    const b = el('button', `skinopt${skin === current ? ' on' : ''}`, SKIN_NAMES[skin]);
    b.setAttribute('aria-pressed', String(skin === current));
    b.title = skin === current ? `${SKIN_NAMES[skin]} interface, in use` : `Switch to the ${SKIN_NAMES[skin]} interface`;
    b.onclick = () => { if (skin !== current) switchSkin(skin); };
    wrap.append(b);
  }
  wrap.append(el('div', 'skinhint', 'switch anytime'));
  return wrap;
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
    b.classList.add('rowact');   // AUDIT UI: sized by the sheet, not inline
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
// ── ENHANCED ─────────────────────────────────────────────────────
//
// Every switch that is OURS rather than Daggerfall's. DFU's own 171
// keys stay in Settings, which is a different question - that screen
// answers "how should the game behave", this one answers "how much of
// this is still Daggerfall".
//
// NOTHING IS HIDDEN FOR NOT BEING BUILT. The rail's own law (see
// SECTIONS_BOOT) is that a section with no engine still has a home and
// says what it waits on, because a list with a hole in it teaches the
// player the hole is permanent. So an enhancement that does not exist
// yet is listed, greyed, with the reason - and one that exists but
// cannot run here says what it needs instead of failing silently.

/** One toggle over a uiPrefs key. */
function prefRow(key, name, note, { onChange = null } = {}) {
  const row = el('div', 'row');
  const main = el('button', 'row-main');
  main.append(el('div', 'row-name', name));
  if (note) main.append(el('div', 'row-note', note));
  const on = !!getPref(key);
  main.onclick = () => { setPref(key, !on); onChange?.(!on); render(); };
  row.append(main);
  const ctl = el('div', 'ctl');
  const b = el('button', `act${on ? ' primary' : ''}`, on ? 'On' : 'Off');
  b.classList.add('rowact');   // AUDIT UI: sized by the sheet, so the coarse-pointer rule can reach it
  b.setAttribute('aria-pressed', String(on));
  b.onclick = () => { setPref(key, !on); onChange?.(!on); render(); };
  ctl.append(b, el('span', 'tier live'));
  row.append(ctl);
  return row;
}

/** An enhancement that is not switchable HERE, and why. Never a
 *  control that looks live and does nothing - the dead affordance this
 *  project keeps finding. */
function inertRow(name, note, state) {
  const row = el('div', 'row');
  const main = el('div', 'row-main');
  main.append(el('div', 'row-name', name));
  main.append(el('div', 'row-note', note));
  row.append(main);
  const ctl = el('div', 'ctl');
  const tag = el('span', 'tier', state);
  // The column is narrow and .tier wraps: the first render broke
  // "opt-in" across the hyphen and "not built" across the space.
  tag.style.whiteSpace = 'nowrap';
  ctl.append(tag);
  row.append(ctl);
  return row;
}

function paneEnhanced(body) {
  const live = el('div', 'card');
  live.append(el('h3', null, 'Switches'));
  live.append(skinRow());
  // R3W/R4W (Mac, 2026-08-28): this row promised THREE things and
  // shipped one - the map layer and the travel slice were both written
  // and never called. R3W wired the map and the claim came OUT rather
  // than being left standing as the sky row's was; R4W wired travel
  // and it goes back in. Every clause here is now reachable.
  // RA1 (Mac, 2026-08-28): this row said "not built" while ES1 had
  // been the enhanced skin's default sky for a day - a shipped
  // enhancement wearing a hole's label. It is a SWITCH now, over the
  // same uiPrefs shelf as roads.
  // EE1: the sky row becomes ENHANCED ENVIRONMENTS, which contains it.
  // The prose names what the switch covers TODAY and grows as slices
  // land - a row that claims more than the tree has is the fault RA1
  // fixed here in the other direction.
  live.append(prefRow('enhancedEnvironments', 'Enhanced environments',
    'The enhanced outdoors as one system. Today: a procedural sky with the sun, both moons on '
    + 'their real phases, a star field, a finely stepped sunrise and sunset, and clouds that '
    + 'follow the weather to the horizon and cast their shadows on the land; and ground drawn at four times the detail in '
    + 'Daggerfall\u2019s own tile shapes and colours, lit by the sun so every blade and pebble '
    + 'has a bright side and a shaded side, holding still at distance instead of shimmering. '
    + 'Off returns Daggerfall\u2019s SKY*.DAT panorama and its own 64-pixel ground. '
    + 'Takes effect when the world next loads.'));
  body.append(live);

  // PX30c (Mac: "is there anyway I can adjust the sizing?"): THE HUD'S
  // SCALE LIVES HERE, not in the settings catalog. `EnhancedHUDScale`
  // is OURS - DFU has no HUD of this shape to scale - and the catalog
  // is generated from DFU's own vendored ini by scripts/bakeSettings,
  // which nothing hand-edits (AUDIT 17e F9's lesson, and the bake pin
  // caught me adding it there on the first full run). The Enhanced
  // pane is where this port's own switches already live, and the value
  // itself is in uiPrefs rather than DFU's settings (see enhancedHud).
  const sizing = el('div', 'card');
  sizing.append(el('h3', null, 'HUD size'));
  const row = el('div', 'row');
  row.append(el('span', 'row-name', 'Gameplay HUD scale'));
  const ctl = el('div', 'ctl');
  const val = el('span', 'val', `${hudScaleNow().toFixed(2)}\u00d7`);
  const step = (delta, label) => {
    const b = el('button', 'step', label);
    b.onclick = () => {
      const next = Math.round(Math.max(HUD_SCALE_MIN, Math.min(HUD_SCALE_MAX, hudScaleNow() + delta)) * 20) / 20;
      setPref('hudScale', next);
      val.textContent = `${next.toFixed(2)}\u00d7`;
    };
    return b;
  };
  ctl.append(step(-0.05, '\u2039'), val, step(0.05, '\u203a'));
  row.append(ctl);
  sizing.append(row);
  sizing.append(el('p', 'note', 'The compass, the bars and the effect chips together. '
    + 'Takes effect at once; half size still reads and double fills a phone.'));
  body.append(sizing);

  // MWFIX2: A SIBLING PAGE IS NOT A SIBLING OF THE GAME. The build puts
  // every extra page at the SITE ROOT (vite.config's rollup inputs) but
  // the game itself one directory down at /play/, so a bare relative
  // 'mw-viewer.html' resolves against the running document: from
  // menu.html at the root it works, and from the game it asks for
  // /play/mw-viewer.html and 404s.
  const sitePage = (page) => {
    const dir = new URL('.', location.href);
    const root = /\/play\/$/.test(dir.pathname) ? new URL('..', dir) : dir;
    return new URL(page, root).href;
  };

  // MW-IMPORT: the attach door, ON THIS SURFACE - the launcher window has
  // its M key, but the enhanced skin never routes through it.
  //
  // MW-D8: THERE IS NOW SOMETHING BEHIND THE BUTTON, which is the only
  // thing that ever made one honest. MW-2 refused a 3D toggle because "a
  // switch for one would be the screen lying about the build" - true then,
  // when the rig was reverted and nothing had replaced it. The arm exists
  // now, so a control for it states a fact.
  //
  // IT IS A BUTTON WITH A STATUS LINE, not a preference row. MWDIAG's
  // lesson: five distinct causes were indistinguishable to the reporter
  // for three fixes running because the reason lived in a console object
  // nobody read. The reason belongs on the card, next to the button that
  // produced it.
  const mw = el('div', 'card');
  const armState = fpArm.status();
  mw.append(el('h3', null, 'Morrowind assets'));
  mw.append(el('p', 'meta',
    'Your own Morrowind.bsa (and Tribunal, Bloodmoon, Morrowind.esm) feed the mesh viewer, the '
    + 'data inspector, and the in-game first-person arms. Stored in this browser exactly like '
    + 'ARENA2; nothing uploads.'));
  mw.append(el('p', 'meta',
    'The arms draw textured, in the stance of the drawn weapon, holding the Morrowind counterpart '
    + 'of what your right hand holds - the weapon follows your equipment as you play. While the '
    + 'arms are on, the classic weapon sprite is off; Unload brings it straight back.'));
  const count = morrowindDataCount();
  mw.append(stats([
    ['Data', `${count} archive${count === 1 ? '' : 's'} attached`],
    ['Arms', armState.active
      ? `on - ${armState.pieces} pieces from ${armState.skeletonPath}`
      : armState.reason],
    ['Weapon', armState.weapon
      ? `${armState.weapon.name || armState.weapon.id} at ${armState.weapon.bone}`
        + (armState.weapon.side && armState.weapon.side !== 'unknown'
          ? ` (${armState.weapon.side} side at rest)` : '')
      : armState.active ? 'none - empty hands' : '-'],
    // MW-D24: the BODY's own verdict, beside the arm's - scroll out in
    // game to see it, and when the wheel refuses, this line is why.
    // IG6b: the CURRENT arms mode, stated where a state belongs - on
    // the stats block, not on the button that changes it.
    ['Arms mode', fpArm.followCamera()
      ? 'fixed to the screen (classic-style)'
      : 'Morrowind look-lag'],
    ['Body', armState.third
      ? (armState.third.ok
        ? `${armState.third.pieces} pieces from ${armState.third.skeletonPath} - scroll out for third person (view: ${armState.viewMode})`
        : `refused - ${armState.third.stage}: ${armState.third.error}`)
      : '-'],
  ]));
  const armActions = [
    { label: 'Attach data', primary: !count, onClick: async () => {
      const ds = await import('../scenes/dataSource.js');
      await ds.pickMorrowindFiles();
      render();
    } },
  ];
  if (count) {
    armActions.push(armState.active
      ? { label: 'Unload arms', onClick: () => { fpArm.unload(); render(); } }
      : { label: 'Build first-person arms', primary: true, onClick: async () => {
        // Seconds long and synchronous - the BSA index, the whole ESM
        // walk and every mesh parse, on the main thread. It happens with
        // the game paused, once, and the card says so before you press
        // rather than after the tab stops responding.
        //
        // TR2: THE OPTS COME FROM THE ONE HOME (weaponRig's
        // armBuildOptsOf) - rule 6 picks the skeleton by SEX, rules
        // 1-3 the body by RACE, the face by the wizard's own
        // faceIndex, the worn set off the classic equip table, the
        // weapon off the right hand, ammo off the quiver. The inline
        // copy this replaces carried `female: !!playerEntity.gender`,
        // which is TRUE for the string 'male' - every build asked for
        // the female skeleton; the one home tests the string.
        const { buildArmsFor } = await import('../combat/weaponRig.js');
        await buildArmsFor(playerEntity);
        render();
      } });
  }
  // IG6b: the one Morrowind-feel knob the owner asked for. The label
  // names the ACTION - the first cut named the mode you were IN, which
  // reads as "click to enable", and one natural click switched the
  // owner to look-lag and persisted it; the current mode now sits on
  // the stats block instead. A click flips live, no rebuild - the rig
  // reads the flag per frame.
  if (count) {
    armActions.push(fpArm.followCamera()
      ? { label: 'Switch arms to Morrowind look-lag', onClick: () => { fpArm.setFollowCamera(false); render(); } }
      : { label: 'Switch arms to fixed (classic)', onClick: () => { fpArm.setFollowCamera(true); render(); } });
  }
  armActions.push({ label: 'Open mesh viewer', onClick: () => window.open(sitePage('mw-viewer.html'), '_blank') });
  // MW-D: the page that answers what is actually IN the archives - which
  // is the question four failed fixes never asked.
  armActions.push({ label: 'Open data inspector', onClick: () => window.open(sitePage('mw-inspect.html'), '_blank') });
  mw.append(acts(armActions));
  // WHY, IN WORDS, WHEN IT DID NOT WORK. An empty box was the reverted
  // rig's defining behaviour and is the one outcome forbidden here.
  if (armState.notes && armState.notes.length) {
    mw.append(el('p', 'meta', `Not in the arms: ${armState.notes.join('; ')}`));
  }
  // MW-D33: WHAT YOU ARE WEARING, AND WHETHER THE RIG AGREES. One line
  // per equipped piece - the parts it dressed, or the reason it kept
  // its sprite - because "it doesn't show" must never again arrive
  // with nothing on screen to read.
  // MW-D35: THE FACE, MATCHED - the measured likeness and its distances,
  // so "the head doesn't match the portrait" arrives with the numbers.
  if (armState.face && armState.face.reasons && armState.face.reasons.length) {
    mw.append(el('p', 'meta', `Face: ${armState.face.reasons.join('; ')}`));
  }
  if (armState.worn) {
    if (!armState.worn.length) {
      mw.append(el('p', 'meta', 'Worn: nothing equipped in the armor or clothing slots at build time.'));
    } else {
      for (const w of armState.worn) {
        mw.append(el('p', 'meta', w.dressed.length
          ? `Worn: ${w.label} \u2192 ${w.dressed.join(', ')}`
          : `Worn: ${w.label} \u2192 classic sprite: ${w.reason}`));
      }
    }
  }
  // AND WHAT THE DATA ACTUALLY OFFERS. "no record for this actor" is a
  // dead end for whoever reads it; the race asked for, beside the races
  // the files carry, is a next step.
  if (armState.esm) {
    const e = armState.esm;
    mw.append(el('p', 'meta',
      `Read ${e.files.join(', ')} — ${e.bodyRecords.toLocaleString()} body records, `
      + `${e.firstPerson} of them first-person. Looked for race "${e.raceWanted}": `
      + (e.raceIsThere ? 'present in your data.' : `NOT among the races your files carry (${e.racesFound.join(', ') || 'none'}).`)));
  }
  body.append(mw);

  const waiting = el('div', 'card');
  waiting.append(el('h3', null, 'Not switchable here'));
  waiting.append(inertRow('Enhanced music',
    'A generative score was built and removed at your direction. The game plays MIDI.BSA, and your own '
    + 'replacement tracks if you attach them in Settings.',
    'removed'));
  body.append(waiting);
}

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
  c.append(el('h3', null, 'Daggerfall JavaScript'));   // the public name (U60); project-dagger is the repo
  c.append(el('p', 'meta', 'A 1:1 JavaScript port of Daggerfall.'));
  c.append(stats([
    ['Build', BUILD_TAG],
    ['Interface', SKIN_NAMES[uiSkin()]],
    ['Settings', `${Object.values(DEFAULTS).reduce((n, s2) => n + Object.keys(s2).length, 0)} keys`],
  ]));
  body.append(c);
  body.append(creditsCard());
  body.append(empty('Exit', 'A browser tab cannot close itself. Close it yourself; the quicksave survives.'));
}

// CR1: THE CREDITS (Mac, 2026-08-30). Rendered from ui/credits.js, the
// one table every vendored work has a row in; this function knows the
// shape and nothing about the works. Mods are the point - a modder's
// name on the screen the player sees, not only in a README - so they
// take their own heading, with the terms the work is carried under.
function creditsCard() {
  const c = el('div', 'card credits');
  c.append(el('h3', null, 'Credits'));
  c.append(el('p', 'meta', 'What this port is built on, and the mods carried in it with their authors\' permission.'));
  const group = (heading, rows) => {
    c.append(el('h4', 'credits-head', heading));
    for (const r of rows) {
      const row = el('div', 'credit');
      const title = el('div', 'credit-title');
      title.append(el('span', 'credit-name', r.version ? `${r.title} ${r.version}` : r.title));
      title.append(el('span', 'credit-by', `by ${r.author}`));
      row.append(title);
      row.append(el('p', 'credit-what', r.what));
      const foot = [];
      if (r.terms) foot.push(r.terms);
      if (r.contact) foot.push(`Contact: ${r.contact}.`);
      if (foot.length) row.append(el('p', 'credit-terms', foot.join(' ')));
      if (r.link) {
        const a = el('a', 'credit-link', r.link.replace(/^https?:\/\//, ''));
        a.href = r.link; a.target = '_blank'; a.rel = 'noopener';
        row.append(a);
      }
      c.append(row);
    }
  };
  group('Built on', CREDITS.builtOn);
  group('Mods', CREDITS.mods);
  return c;
}

// ── SHELL ────────────────────────────────────────────────────────
function go(id) { section = id; pickedKey = null; sheetOpen = false; confirming = null; render(); }

// ── PX1: THE PIXEL HOME (Mac, 2026-08-27) ────────────────────────
// The boot door's FACE. The prototype of record is menu-pixel.html;
// what shipped is its structure over the REAL sections: every row
// navigates to the pane that already carries that section's laws
// (Continue's restorable card, the Mods waiting-room, the rail-hole
// rule), rather than acting directly - a home that re-decided what
// Continue does would be a second implementation of the Continue pane.
// Escape from any section returns here (see onKey); the skin switch is
// skinSwitch(), the one door.
function renderHome() {
  // PX2: the pause door wears the same face over the LIVE FRAME - no
  // sky (there is a world behind), no wordmark (a masthead on every
  // Escape is a billboard), a scrim instead of the opaque night.
  const paused = mode === 'pause';
  const home = el('div', `px-home${paused ? ' px-over' : ''}`);
  if (!paused) {
    const ground = document.createElement('canvas');
    ground.className = 'px-ground';
    const vw = () => globalThis.innerWidth ?? 1280;
    const vh = () => globalThis.innerHeight ?? 720;
    drawPixelGround(ground, vw(), vh(), 0);
    // PX1b: THE SKY LIVES - fog orbits and stars twinkle at 8fps, the
    // cadence pixel art animates at; a 60fps dither shimmer reads as
    // noise. The module draws, this mount owns the clock: one interval,
    // cleared by every rebuild (renderInto) and by unmount, skipped
    // entirely under prefers-reduced-motion - the same opt-out the CSS
    // drift honours.
    const still = typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!still) {
      const t0 = Date.now();
      groundTimer = setInterval(() => drawPixelGround(ground, vw(), vh(), (Date.now() - t0) / 1000), 125);
    }
    home.append(ground);
  }
  home.append(el('div', 'px-vignette'));

  // PX3: PAUSE IS A WINDOW, NOT A SECOND MAIN MENU (Mac's reference:
  // Skyrim's journal - a framed panel with tabs over the paused game).
  // Three tabs: Quests, Stats, System. The window replaces the
  // fullscreen list; the foot and the About plaque stay on the scrim.
  if (paused) {
    const stage = el('div', 'px-stage');
    stage.append(pauseWindow());
    home.append(stage);
    // PX4 (Mac): NO FOOT AT PAUSE - no skin toggle, no About plaque;
    // About is a System-tab row instead, and the skin switch stays on
    // the boot face and the settings shell.
    // PX5: the world's date and time, bottom-right like the reference,
    // through DFU's own header formatter over THE ONE CLOCK - a paused
    // clock, so one read at render is the truth for the whole visit.
    const d = dateFromClassicMinutes(Math.floor(worldMinutes()));
    const clock = el('div', 'px-clock');
    clock.append(el('span', null, dateString(d)), el('span', 'px-clocktime', dateTimeString(d).split(' on ')[0]));
    home.append(clock);
    app.append(home);
    return;
  }

  const stage = el('div', 'px-stage');
  const mark = el('h1', 'px-wordmark', 'Daggerfall');
  mark.append(el('small', null, 'JavaScript'));
  stage.append(mark);
  const rule = el('div', 'px-rule');
  rule.append(el('span', 'px-gem'));
  stage.append(rule);

  const menu = el('nav', 'px-menu');
  menu.setAttribute('aria-label', 'Main menu');
  // PX1b: About leaves the center list for the corner box below - the
  // list is what a player DOES, the box is who made it. The SECTION
  // still exists on the shell rail untouched, so the rail-hole pin and
  // the shared-sections law hold.
  for (const label of sections) {
    if (label === 'About') continue;
    const id = idOf(label);
    // PX31: THE DOOR'S BUTTONS CARRY THEIR OWN NAME. Until now they
    // were classless, and nine probes still reached for `.railbtn` -
    // the SHELL rail's class, which this door has never had since PX1
    // replaced it. Every one of them timed out at its front door and
    // no gate noticed, because a probe is not a gate (AUDIT 17f F4).
    // Selecting on PROSE would be the same bug waiting on a relabel,
    // so the hook is structural: doorbtn plus the section id, which
    // is what a probe actually means when it says New Game.
    const b = el('button', `doorbtn door-${id}`);
    b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(label), el('span', 'px-c', '\u25c6'));
    b.onclick = RAIL_ACTS[id] ? () => onAction(RAIL_ACTS[id]) : () => go(id);
    menu.append(b);
  }
  stage.append(menu);
  home.append(stage);

  appendPxFoot(home);
  app.append(home);
}

/** PX1b: three-zone foot - build left, the skin toggle CENTERED (its
 *  'switch anytime' hint hidden here by the px-foot rules; the shell
 *  keeps it), and About as the bottom-right box. One builder for both
 *  faces (PX3 gave pause its own stage). */
function appendPxFoot(home) {
  const foot = el('div', 'px-foot');
  const build = el('span', 'px-build');
  build.append(document.createTextNode('build '), el('span', null, BUILD_TAG));
  const about = el('button', 'px-about', 'About');
  about.onclick = () => go('about');
  foot.append(build, skinSwitch(), about);
  home.append(foot);
}

// ── PX3: THE PAUSE WINDOW ────────────────────────────────────────
const PAUSE_TABS = Object.freeze([['quests', 'Quests'], ['stats', 'Stats'], ['system', 'System']]);
// The token formattings that carry a journal line - questJournal's own
// counted set (DaggerfallQuestJournalWindow.cs:658-662 via its :322).
const JOURNAL_LINE_FORMATTINGS = new Set(['text', 'newline', 'highlight', 'question', 'answer']);

function pauseWindow() {
  const win = el('div', 'px-win');
  for (const c of ['tl', 'tr', 'bl', 'br']) win.append(el('span', `px-gem px-corner px-${c}`));

  const tabs = el('div', 'px-tabs');
  for (const [id, label] of PAUSE_TABS) {
    const b = el('button', id === pauseTab ? 'on' : null);
    b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(label), el('span', 'px-c', '\u25c6'));
    b.onclick = () => { pauseTab = id; render(); };
    tabs.append(b);
  }
  win.append(tabs);

  const body = el('div', 'px-body');
  ({ quests: pauseQuests, stats: pauseStats, system: pauseSystem })[pauseTab](body);
  win.append(body);
  return win;
}

// ── PX7: THE SYSTEM PAGE ─────────────────────────────────────────
// The journal's bones a third time - and NOT a third implementation
// of anything: the detail renders the SAME pane functions the shell
// has always run (paneSave's overwrite card, paneLoad's no-confirm
// law and delete-behind-ask, paneMods' honest waiting room,
// paneAbout, paneExit's confirm), so every audited law keeps its one
// home and only the paint changes (.px-win repaints .card/.act/.empty
// in the pixel idiom). Resume ACTS from the rail - a pane whose only
// content repeats the word just pressed is a pane that wasted a press
// (the shell's own RAIL_ACTS reasoning). PX9 (Mac: "why isn't this in
// the pause menu"): SETTINGS LIVES HERE TOO - the same paneSettings
// function, its category/pickedKey/sheetOpen machine and every F7/F8
// law intact, REFLOWED by CSS into the window's shape: the category
// rail becomes a chip strip across the top, the rows scroll beneath,
// and the help/reset card rises as the SHEET the phone layout already
// proved. Boot keeps the fullscreen shell, where there is room.
const SYSTEM_PANES = Object.freeze([
  ['resume', 'Resume'], ['save', 'Save Game'], ['load', 'Load Game'],
  ['settings', 'Settings'], ['mods', 'Mods'], ['about', 'About'], ['exit', 'Exit'],
]);

function pauseSystem(body) {
  const wrap = el('div', 'px-journal');
  const rail = el('div', 'px-qrail');
  for (const [id, label] of SYSTEM_PANES) {
    const b = el('button', `px-qrow${id === sysSec && !RAIL_ACTS[id] ? ' on' : ''}`);
    b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(label));
    b.onclick = RAIL_ACTS[id] ? () => onAction(RAIL_ACTS[id])
      : () => { sysSec = id; confirming = null; sheetOpen = false; pickedKey = null; render(); };
    rail.append(b);
  }
  wrap.append(rail);
  const detail = el('div', `px-qdetail px-sys${sysSec === 'settings' ? ' px-setwrap' : ''}`);
  if (sysSec === 'settings') {
    // PX10 (Mac): CONDENSED at pause - the keys with LIVE consumers,
    // the ones a hand mid-game actually reaches for; the full catalog
    // stays on the main menu, and the pane says so. The pane owns its
    // own confirm/help placement (the sheet).
    paneQuickSettings(detail);
  } else if (confirming) {
    detail.append(confirmCard());
  } else {
    ({ save: paneSave, load: paneLoad, mods: paneMods, about: paneAbout, exit: paneExit })[sysSec](detail);
  }
  wrap.append(detail);
  body.append(wrap);
}

// ── PX6: THE STATS PAGE ──────────────────────────────────────────
// The journal's own bones - a rail of pages, the chosen one on the
// right - because one structure learned once is the whole window's.
// Everything drawn is something the entity actually carries: the char
// sheet's model (vitals, attributes, the career skill groups), and
// the three reputation stores the talk and court systems read.
const STATS_SECTIONS = Object.freeze([
  ['character', 'Character'], ['attributes', 'Attributes'],
  ['skills', 'Skills'], ['standing', 'Standing'],
]);
// The five NAMED social groups getReactionToPlayer reads
// (formats/factionFile.js:23-27; talk.js seeds the array) - the enum
// slots past Underworld are DFU's own placeholders and stay unlisted.
const SOCIAL_GROUP_NAMES = Object.freeze(['Commoners', 'Merchants', 'Scholars', 'Nobility', 'Underworld']);

/** A whole-pixel meter: 2px frame, flat fill, no easing. */
function pxMeter(now, max, tone) {
  const wrap = el('div', 'px-meter');
  const fill = el('div', `px-fill${tone ? ` ${tone}` : ''}`);
  const pct = max > 0 ? Math.max(0, Math.min(100, (now / max) * 100)) : 0;
  fill.style.width = `${pct}%`;
  wrap.append(fill);
  return wrap;
}

function meterRow(label, now, max, tone) {
  const r = el('div', 'px-mrow');
  const top = el('div', 'px-mtop');
  top.append(el('span', 'k', label), el('span', 'v', `${now} / ${max}`));
  r.append(top, pxMeter(now, max, tone));
  return r;
}

function pauseStats(body) {
  const m = sheetModel(playerEntity);
  const wrap = el('div', 'px-journal');
  const rail = el('div', 'px-qrail');
  for (const [id, label] of STATS_SECTIONS) {
    const b = el('button', `px-qrow${id === statsSec ? ' on' : ''}`);
    b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(label));
    b.onclick = () => { statsSec = id; render(); };
    rail.append(b);
  }
  wrap.append(rail);
  const detail = el('div', 'px-qdetail');
  ({ character: statsCharacter, attributes: statsAttributes, skills: statsSkills, standing: statsStanding })[statsSec](detail, m);
  // PX25: THE DOORS THE F5 SHEET CARRIED. The classic character sheet
  // has four buttons down its side - Inventory, Spellbook, Logbook,
  // History - and the enhanced F5 overlay copied them. This page shows
  // the same model from the same sheetModel, so it is the same sheet;
  // it was simply the only one of the two with no way out. Each door
  // appears ONLY when the host handed one over, because a button that
  // opens nothing is PX14's drawn door.
  const doors = [
    ['Pack', hooks.openPack], ['Spellbook', hooks.openSpellbook], ['Chronicle', hooks.openChronicle],
  ].filter(([, fn]) => typeof fn === 'function');
  if (doors.length) {
    const row = el('div', 'px-sheetdoors');
    for (const [label, fn] of doors) {
      const b = el('button', 'act', label);
      // The pause window RESUMES first: two overlays at once is the
      // stacking bug U55 found the other way round on this very seam,
      // and 'resume' is the one exit this face already has.
      b.onclick = () => { onAction('resume'); fn(); };
      row.append(b);
    }
    detail.append(row);
  }
  wrap.append(detail);
  body.append(wrap);
}

/** CHARACTER: who you are, and the three bars a glance wants - health
 *  in the skin's blood, fatigue in bone, magicka in verdigris. */
function statsCharacter(detail, m) {
  const head2 = el('div', 'px-qname');
  head2.append(el('span', 'px-qwing'), el('h3', null, m.name || 'Adventurer'), el('span', 'px-qwing px-flip'));
  detail.append(head2);
  const meta = el('div', 'px-qmeta');
  meta.append(el('span', 'px-qkind', `${m.race}${m.career ? ` ${m.career}` : ''} \u00b7 Level ${m.level}`));
  detail.append(meta);
  detail.append(meterRow('Health', m.health.now, m.health.max, 'blood'));
  detail.append(meterRow('Fatigue', m.fatigue.now, m.fatigue.max, ''));
  detail.append(meterRow('Magicka', m.magicka.now, m.magicka.max, 'verdigris'));
  detail.append(pxDivider('Burden'));
  const g = el('div', 'px-statgrid');
  for (const [label, v] of [['Gold', String(m.gold)], ['Encumbrance', `${m.encumbrance.now} / ${m.encumbrance.max}`]]) {
    const r = el('div', 'px-stat');
    r.append(el('span', 'k', label), el('span', 'v', v));
    g.append(r);
  }
  detail.append(g);
}

/** ATTRIBUTES: the eight, each with a meter on the classic 100. */
function statsAttributes(detail, m) {
  detail.append(pxDivider('Attributes'));
  for (const a of m.attributes) {
    detail.append(meterRow(a.key[0].toUpperCase() + a.key.slice(1), a.value, 100, ''));
  }
}

/** SKILLS: the three career groups open - the character's chosen
 *  shape - and Miscellaneous behind the sheet's own disclosure. */
function statsSkills(detail, m) {
  for (const group of m.groups) {
    if (!group.career && !statsAllSkills) continue;
    if (!group.ids.length) continue;
    detail.append(pxDivider(group.name));
    const grid = el('div', 'px-skillgrid');
    for (const id of group.ids) {
      const r = el('div', 'px-skill');
      const top = el('div', 'px-mtop');
      top.append(el('span', 'k', SKILL_NAMES[id] ?? `Skill ${id}`), el('span', 'v', String(m.skill(id))));
      r.append(top, pxMeter(m.skill(id), 100, 'thin'));
      grid.append(r);
    }
    detail.append(grid);
  }
  const more = el('button', 'px-qrow px-disclose');
  const miscCount = m.groups[3]?.ids.length ?? 0;
  more.append(el('span', 'px-c', '\u25c6'),
    document.createTextNode(statsAllSkills ? 'Hide miscellaneous' : `Show ${miscCount} miscellaneous skills`));
  more.onclick = () => { statsAllSkills = !statsAllSkills; render(); };
  detail.append(more);
}

/** STANDING: the three reputation stores the game actually reads -
 *  the five named social groups (getReactionToPlayer's own inputs).
 *  Legal standing is PER REGION and the window does not know where
 *  you stand, so it stays with the court until a host hands a region
 *  seam - drawing a number without its region would be a lying row. */
function statsStanding(detail) {
  detail.append(pxDivider('Reputation'));
  const reps = playerEntity.sGroupReputations ?? [];
  for (let i = 0; i < SOCIAL_GROUP_NAMES.length; i++) {
    const v = reps[i] ?? 0;
    const r = el('div', 'px-stat');
    r.append(el('span', 'k', SOCIAL_GROUP_NAMES[i]),
      el('span', `v${v > 0 ? ' won' : v < 0 ? ' bad' : ''}`, v > 0 ? `+${v}` : String(v)));
    detail.append(r);
  }
}

/** PX5: THE MAIN QUEST, by the pack's own naming - DFU ships the
 *  story quests as S0000*.txt (34 files in vendor/dfu-quests/Quests)
 *  and _BRISIEN is the main quest's opener (StartGameBehaviour.cs:
 *  445-447 via questBridge.GAME_START_QUESTS). Everything else on the
 *  log is a side quest. */
const isMainQuest = (questName) => /^S0000/.test(questName ?? '') || questName === '_BRISIEN';

/** PX28 (Mac: remove the titles - Main Quest, Side Quest - from the
 *  quest NAMES in the enhanced journal; they already have sections).
 *
 *  THE RAIL ALREADY SAYS WHICH KIND A QUEST IS, by the section it sits
 *  in, so a name that repeats it says the same fact twice - the cut
 *  PX22 already made to the detail pane's kind tag, finished here on
 *  the names themselves. A quest pack is free to title its quests
 *  however it likes and the port does not edit its data: this strips
 *  the label at the DISPLAY seam only, and only when it is a real
 *  label - a kind phrase at the FRONT, followed by a separator.
 *
 *  What is deliberately NOT stripped:
 *   - "Clavicus Vile's Quest", "Main Quest Backbone" - the word sits
 *     at the end, or the phrase runs on into the title with no
 *     separator, so it IS the name.
 *   - anything that would leave nothing behind: a quest actually
 *     called "Main Quest" keeps its name rather than becoming blank.
 */
// AUDIT 38 F1: the SEPARATOR between the kind word and the noun is
// optional too. A pack is as free to write "Sidequest:" or
// "Main-Quest -" as "Side Quest:", and the first cut required a
// space, so the joined spellings sailed through with the label still
// on. The kind and the noun may be joined, spaced or hyphenated; the
// LABEL still needs its own trailing separator, which is what keeps
// "Main Quest Backbone" a name.
const QUEST_KIND_LABEL = /^\s*(?:the\s+)?(?:main|side|guild|daedric|faction|misc(?:ellaneous)?|holiday|class|racial)[\s\-\u2013]*(?:quest|quests|questline|storyline|story)\s*[:\u2013\u2014|\-\u2022]\s*/i;
export function questTitleOf(name) {
  const raw = String(name ?? '').trim();
  const cut = raw.replace(QUEST_KIND_LABEL, '').trim();
  return cut || raw;
}

/** PX5: remaining game seconds as words - days+hours above a day,
 *  hours+minutes below it, minutes alone under an hour. */
function remainWords(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m2 = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} day${d === 1 ? '' : 's'}${h ? ` ${h} hour${h === 1 ? '' : 's'}` : ''}`;
  if (h > 0) return `${h} hour${h === 1 ? '' : 's'}${m2 ? ` ${m2} min` : ''}`;
  return `${Math.max(1, m2)} min`;
}

/** One flattener for every journal source: message object or raw
 *  token array in, text lines out, questJournal's own counted set. */
function journalLines(msgOrTokens) {
  const tokens = Array.isArray(msgOrTokens) ? msgOrTokens : (msgOrTokens?.getTextTokens?.() ?? []);
  return tokens.filter((t) => JOURNAL_LINE_FORMATTINGS.has(t?.formatting)).map((t) => String(t?.text ?? ''));
}

/** The finished-quest header the notebook files:
 *  '<name> completed|ended at <date>:' (notebook.js:151-182). The name
 *  and the verdict come back out of it; a headerless overflow entry
 *  (the notebook's own kept quirk) reads as a continuation. */
function parseFinished(entry, index) {
  const head2 = entry?.[0];
  const header = head2?.formatting === 'highlight' ? String(head2.text ?? '') : null;
  const m = header ? /^(.*?) (completed|ended) at (.*?):?$/.exec(header) : null;
  return {
    key: `f:${index}`,
    name: m ? m[1] : (header ?? 'Quest record'),
    success: m ? m[2] === 'completed' : null,
    when: m ? m[3] : null,
    lines: journalLines(header ? entry.slice(1) : entry).filter((l, i, a) => l !== '' || a[i - 1] !== ''),
  };
}

/** A titled ornamental divider - line, gem, WORD, gem, line - the
 *  reference's OBJECTIVES rule in whole pixels. */
function pxDivider(word) {
  const d = el('div', 'px-divider');
  d.append(el('span', 'px-gem'), el('span', 'px-divword', word), el('span', 'px-gem'));
  return d;
}

/** PX4 - THE JOURNAL (Mac's reference: Skyrim's quest page). A rail of
 *  quest names on the left - active first, THE ARCHIVE beneath them -
 *  and the selected quest on the right: name under its ornament, the
 *  latest entry as the description, and every step of the trail as a
 *  diamond-bulleted entry, newest first, exactly the shape the
 *  machine's log walk gives (a Daggerfall quest speaks in journal
 *  entries, not objective flags - the entries ARE the tasks). Data
 *  arrives raw through hooks.questLog (world.js wires it beside the
 *  F5 logbook's flat seam); a host without the hook says so. */
function pauseQuests(body) {
  if (!hooks.questLog) {
    body.append(el('p', 'px-note', 'The journal is not wired into this place yet.'));
    return;
  }
  const log = hooks.questLog() ?? { active: [], finished: [] };
  const active = (log.active ?? []).map((q, i) => ({
    key: `a:${q.id ?? i}`,
    name: q.name || `Quest ${i + 1}`,
    main: isMainQuest(q.questName),
    clockSeconds: Number.isFinite(q.clockSeconds) ? q.clockSeconds : null,
    entries: (q.messages ?? []).map(journalLines).filter((ls) => ls.length),
  })).filter((q) => q.entries.length);
  const finished = (log.finished ?? []).map(parseFinished).filter((q) => q.lines.length || q.name);
  if (!active.length && !finished.length) {
    body.append(el('p', 'px-note', 'No active quests.'));
    return;
  }
  const rows = [...active, ...finished];
  if (!rows.some((r) => r.key === questSel)) questSel = rows[0].key;
  const sel = rows.find((r) => r.key === questSel);

  const wrap = el('div', 'px-journal');
  const rail = el('div', 'px-qrail');
  const railList = (items, cls) => {
    for (const q of items) {
      const b = el('button', `px-qrow${cls}${q.key === questSel ? ' on' : ''}`);
      b.append(el('span', 'px-c', '\u25c6'), document.createTextNode(questTitleOf(q.name)));   // PX28
      if (q.clockSeconds != null) b.append(el('span', 'px-qtimed', '\u25c6'));
      b.onclick = () => { questSel = q.key; render(); };
      rail.append(b);
    }
  };
  // PX22 (Mac: "quests aren't supposed to be titled as main quest...
  // what we developed had 3 sections for main, side and archived"):
  // THE RAIL IS THREE SECTIONS, ALWAYS. PX5 made the two active
  // headings CONDITIONAL - "a rail of one group under a header is a
  // header explaining nothing" - and that reasoning is fine for a
  // heading that only labels; it is wrong for one that is the
  // journal's SHAPE. A player who opens the journal on their first
  // side quest should learn that a main-quest section exists and is
  // empty, not meet a different window later. So all three stand, in
  // order, and an empty one says so in the dim - the same anti-lie
  // idiom as the worn map's empty families and the site's not-yet box.
  //
  // The ARCHIVE is not split by kind, and that is not an oversight:
  // the notebook's filed header keeps only the display name, so the
  // questName main/side is gone by the time a quest is filed
  // (notebook.js:151-182). Three sections is the shape the DATA has.
  const mains = active.filter((q) => q.main);
  const sides = active.filter((q) => !q.main);
  const section = (label, items, cls, first = false) => {
    rail.append(el('div', `px-qarch${first ? ' px-qfirst' : ''}`, label));
    if (items.length) railList(items, cls);
    else rail.append(el('div', 'px-qnone', '\u2014'));
  };
  section('Main Quests', mains, '', true);
  section('Side Quests', sides, '');
  section('Archived', finished, ' done');
  wrap.append(rail);

  const detail = el('div', 'px-qdetail');
  if (sel) {
    const head2 = el('div', 'px-qname');
    head2.append(el('span', 'px-qwing'), el('h3', null, questTitleOf(sel.name)), el('span', 'px-qwing px-flip'));   // PX28
    detail.append(head2);
    if (sel.entries) {
      // PX22: NO KIND TAG. PX5 put "Main Quest" / "Side Quest" beside
      // the timer; with the rail always showing three named sections
      // that is the same fact twice, and a quest is not TITLED by its
      // kind - it is filed under it. (The same cut PX20c made to the
      // pack's slots-filled count.) The meta line is the timer's now,
      // and exists only when there is a timer.
      const meta = el('div', 'px-qmeta');
      if (sel.clockSeconds != null) {
        // Under a game day the words go URGENT gold.
        const urgent = sel.clockSeconds < 86400;
        meta.append(el('span', `px-qtimer${urgent ? ' urgent' : ''}`, `Time remains: ${remainWords(sel.clockSeconds)}`));
      }
      if (meta.childNodes.length) detail.append(meta);   // PX22: an empty meta line is a gap the eye reads as a mistake
    }
    if (sel.entries) {
      // Active: the LATEST entry is the state of the quest; the trail
      // beneath it, newest first.
      const latest = sel.entries[sel.entries.length - 1];
      const desc = el('div', 'px-qdesc');
      for (const line of latest) desc.append(el('p', null, line));
      detail.append(desc);
      if (sel.entries.length > 1) {
        detail.append(pxDivider('Journal'));
        for (let i = sel.entries.length - 2; i >= 0; i--) {
          const e = el('div', 'px-qentry');
          const mark = el('span', 'px-qmark', '\u25c7');
          const text = el('div');
          for (const line of sel.entries[i]) text.append(el('p', null, line));
          e.append(mark, text);
          detail.append(e);
        }
      }
    } else {
      // Archived: the verdict line, then the filed record.
      const verdict = sel.success == null ? null
        : `${sel.success ? 'Completed' : 'Ended'}${sel.when ? ` at ${sel.when}` : ''}`;
      if (verdict) detail.append(el('p', `px-qverdict${sel.success ? ' won' : ''}`, verdict));
      const desc = el('div', 'px-qdesc');
      for (const line of sel.lines) {
        if (line === '') { desc.append(el('div', 'px-qgap')); continue; }
        desc.append(el('p', null, line));
      }
      detail.append(desc);
    }
  }
  wrap.append(detail);
  body.append(wrap);
}

function render() {
  repaintKeepingScroll(app, () => renderInto());
}

/** The rebuild. Wrapped for the reason the wizard's is: the settings
 *  list carries the same steppers, and a repaint that forgets the
 *  scroll throws the player back to the top of 66 Video rows. */
function renderInto() {
  if (groundTimer) { clearInterval(groundTimer); groundTimer = null; }
  app.innerHTML = '';
  // PX1/PX2: both doors open on the pixel home; every section keeps
  // its shell.
  if (section === 'home') { renderHome(); return; }
  // PX11 (Mac): the BOOT shell stands on the same living sky as the
  // home - the ground draws behind it and the shell's own chrome goes
  // translucent (enhancedStyle's PX11 block), so Settings at boot is
  // the one treatment, fullscreen. Same clock, same owner, same
  // reduced-motion opt-out; pause never reaches this branch.
  if (mode === 'boot') {
    const ground = document.createElement('canvas');
    ground.className = 'px-ground';
    const vw = () => globalThis.innerWidth ?? 1280;
    const vh = () => globalThis.innerHeight ?? 720;
    drawPixelGround(ground, vw(), vh(), 0);
    const still = typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!still) {
      const t0 = Date.now();
      groundTimer = setInterval(() => drawPixelGround(ground, vw(), vh(), (Date.now() - t0) / 1000), 125);
    }
    app.append(ground, el('div', 'px-vignette'));
  }
  const shell = el('div', 'shell');

  const side = el('aside', 'side');
  const brand = el('div', 'brand');
  const h1 = el('h1', null, 'Daggerfall');
  // PX1/PX2: the wordmark is the way back to the pixel home - the
  // same affordance every site's masthead carries. Escape does it too
  // (onKey); this is the one a finger can see.
  h1.style.cursor = 'pointer';
  h1.onclick = () => go('home');
  brand.append(h1);
  brand.append(skinSwitch());   // the word ENHANCED became the switch
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
        test: paneTest,
        save: paneSave, exit: paneExit,
        mods: paneMods, about: paneAbout, enhanced: paneEnhanced,
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
  // MWFIX: ...AND SO DOES THE ONE ABOVE THIS. The law three paragraphs
  // down - a modal overlay owns its input - cuts both ways: this
  // handler is on `globalThis` in CAPTURE and stops what it takes, so
  // it reaches a key before any modal THIS screen opened. The asset
  // picker is exactly that, and Escape over it must close the picker,
  // not walk this screen's back stack out from under it.
  if (assetPickerOpen()) return;
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
      : section !== 'home' ? () => go('home')   // PX1/PX2: a section backs out to the face
        : mode === 'pause' ? () => onAction('resume')   // Escape on the pause face resumes
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
  // PX26: which page the window opens ON. A door pressed for a page
  // should land on that page rather than on a menu with it one press
  // further in - the dial's north asked for the character sheet.
  at = null,
} = {}) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  app = host;
  onAction = handler;
  mode = m === 'pause' ? 'pause' : 'boot';
  hooks = h ?? {};
  sections = mode === 'pause' ? SECTIONS_PAUSE : SECTIONS_BOOT;
  // WHICH PANE OPENS. Both doors open on the PIXEL HOME (PX1/PX2) -
  // the face itself, every section one press away. Pause used to open
  // straight on SAVE GAME (U51's law: what Escape was pressed for);
  // PX2 trades one press of depth for the face Mac adopted, with Save
  // Game the second row a thumb meets and Resume the first.
  section = 'home';
  pauseTab = 'system';
  // ...and THEN the caller's landing, if it named one. After the reset,
  // which is what keeps the reset the default rather than a thing this
  // has to work around. The tabbed window IS the pause home face, so a
  // landing sets the TAB and leaves the section alone.
  if (['quests', 'stats', 'system'].includes(at)) pauseTab = at;
  questSel = null;
  statsSec = 'character';
  statsAllSkills = false;
  sysSec = 'save';
  category = CATEGORIES[0].id;
  pickedKey = null;
  sheetOpen = false;
  confirming = null;
  _eff = null;
  render();
  keyHandler = onKey;
  globalThis.addEventListener('keydown', keyHandler, { capture: true });
  // PX1: the pixel ground is drawn for the viewport it mounted on; a
  // rotate or a resize while the home is up redraws it, or the sky
  // stretches - the prototype's own phone-shot lesson.
  resizeHandler = () => { if (mode === 'boot' && section === 'home') render(); };
  globalThis.addEventListener('resize', resizeHandler);
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
      if (resizeHandler) globalThis.removeEventListener('resize', resizeHandler);
      if (groundTimer) { clearInterval(groundTimer); groundTimer = null; }
      keyHandler = null;
      lockHandler = null;
      resizeHandler = null;
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
