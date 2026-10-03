// ESC-BOOK (2026-09-27, Eterna on Discord: "if u enter the spellbook via the escape menue, instead of the chosen
// keybind, the spellbook will open and stay persistent, behind all screens, making it unable to exit or play" and
// "if one goes to the escape menue and attempts to navigate to the notes or quests, via the butttons there ... one must
// use keybinds exclusively to open both the note book and quest log"). On the enhanced skin F5 opens the pause window
// on its Stats page (PX27), and that page's Pack, Spellbook and Chronicle doors called the SHEET's factories, closed the
// page and dropped what they built: the enhanced spellbook and pack mount their screens the moment they are built, so
// one stood over the game with no host slot holding it (the pointer relocked, the game ran on, the pause opened over
// it), and the Chronicle's factory built the classic journal nobody saw. The doors are the host's own arms now - the
// ones the pause door's Stats page has always used - and a building hands its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sheetPageDoors } from '../src/ui/charSheetDoor.js';
import { pauseMenuAct } from '../src/ui/pauseDoor.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** The `{...}` literal after `opener`, braces balanced past strings and comments (f5quests.test.js's reader). */
function literalBody(text, opener) {
  const i = text.indexOf(opener);
  assert.ok(i >= 0, `could not find ${opener}`);
  const open = text.indexOf('{', i + opener.length);
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    const c = text[k];
    if (c === '/' && text[k + 1] === '/') { k = text.indexOf('\n', k); continue; }
    if (c === '/' && text[k + 1] === '*') { k = text.indexOf('*/', k) + 1; continue; }
    if (c === '\'' || c === '"' || c === '`') {
      const q = c;
      for (k++; k < text.length; k++) { if (text[k] === '\\') k++; else if (text[k] === q) break; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return text.slice(open, k + 1);
  }
  throw new Error(`unbalanced literal after ${opener}`);
}
const STUB = new Proxy(function stub() {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 'STUB' : STUB), apply: () => STUB });
/** A one-line `const NAME = <expression>;` out of the live source, evaluated over `env` (AUDIT 27h: the building's
 *  bag reads two such helpers - the door answers and the one sheet door - and a copy of their law here would test the copy). */
function constOf(text, name, env = {}) {
  const m = new RegExp(`^\\s*const ${name} = (.*);$`, 'm').exec(text);
  assert.ok(m, `could not find const ${name}`);
  const scope = new Proxy({ ...env }, { has: () => true, get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : STUB)) });
  // eslint-disable-next-line no-new-func
  return new Function('__scope', `with (__scope) { return (${m[1]}); }`)(scope);
}
function mountLiteral(text, opener, env = {}) {
  const scope = new Proxy({ ...env }, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : STUB)),
  });
  // eslint-disable-next-line no-new-func
  return new Function('__scope', `with (__scope) { return (${literalBody(text, opener)}); }`)(scope);
}

test('ESC-BOOK: the page\'s doors are the host\'s arms - the page goes down FIRST, then the arm opens the window in the host\'s slot; no arm, no door', () => {
  const seen = [];
  const bag = {
    openPack: () => seen.push('pack'), openSpellbook: () => seen.push('book'), openChronicle: () => seen.push('chronicle'),
    questLog: () => 'not a door',
  };
  const doors = sheetPageDoors(bag, () => seen.push('close'));
  // ARENA3 moved this pin: the Arena window is a fourth door of the page (bible/11-Multiplayer/Arena.md 5 - "from the
  // pause menu's Arena entry once you have joined"), the host's arm like the other three
  assert.deepEqual(Object.keys(doors), ['openPack', 'openSpellbook', 'openChronicle', 'openArena']);
  doors.openSpellbook(); doors.openChronicle(); doors.openPack();
  assert.deepEqual(seen, ['close', 'book', 'close', 'chronicle', 'close', 'pack'], 'down first, then the host opens it');
  // a host that handed no arm gets no door - never a factory's window that no slot holds
  const bare = sheetPageDoors({ openSpellbook: () => {} }, () => {});
  assert.equal(bare.openPack, undefined);
  assert.equal(bare.openChronicle, undefined);
  assert.equal(typeof bare.openSpellbook, 'function');
  assert.deepEqual(sheetPageDoors(null, () => {}), { openPack: undefined, openSpellbook: undefined, openChronicle: undefined, openArena: undefined });
  // THE F6 CROSSOVER is the Pack door's own: the page's key handler asks the same doors
  const door = rd('src/ui/charSheetDoor.js');
  assert.match(door, /const pack = acts\.includes\('Inventory'\) \? sheetPageDoors\(pause\?\.\(\), close\)\.openPack : undefined;/);
  assert.match(door, /if \(toPack\) pack\(\);[^\n]*\n\s*else close\(\);/);
});

test('ESC-BOOK: a door that opens another window HANDS OFF - the pause window down, no relock under the new window, no return to the classic window', () => {
  const seen = [];
  const act = pauseMenuAct({ relock: () => seen.push('relock'), onResume: () => seen.push('back'), quickSave: () => seen.push('save') }, () => seen.push('close'));
  act('handoff');
  assert.deepEqual(seen, ['close'], 'the door\'s window takes the slot; its own close relocks');
  act('resume');
  assert.deepEqual(seen, ['close', 'close', 'back'], 'Resume still goes back to the classic window (DISC22-B)');
  const menu = rd('src/ui/enhancedMenu.js');
  const at = menu.indexOf('function pauseStats(body)');
  assert.match(menu.slice(at, menu.indexOf('\nfunction ', at + 10)), /b\.onclick = \(\) => \{ onAction\('handoff'\); if \(fn\(\) === false\) onAction\('resume'\); \};/);
});

test('ESC-BOOK / THE FOUR HOSTS: a building\'s F5 page is handed the BUILDING\'s bag, whose doors mount in the building\'s slot', () => {
  const modes = rd('src/scenes/worldModes.js');
  const mounted = [];
  const mountInterior = (w) => mounted.push(w);
  const host = { makeJournal: (m) => `JOURNAL:${m}`, pauseQuestLog: () => 'LOG', makeCharSheet: (doors) => ({ sheet: doors }) };
  const interiorSheetDoors = () => 'DOORS';
  const bag = mountLiteral(modes, 'const interiorPauseHooks = () => (', {
    interiorInventory: () => 'PACK', magic: {}, makeSpellbookWindow: () => 'BOOK', host,
    mountedInterior: constOf(modes, 'mountedInterior', { mountInterior }),   // AUDIT 27h A4: the door's answer
    openInteriorSheet: constOf(modes, 'openInteriorSheet', { host, interiorSheetDoors, mountInterior }),   // AUDIT 27h A1: the one sheet door
  });
  assert.deepEqual([bag.openPack(), bag.openSpellbook(), bag.openChronicle()], [true, true, true], 'each door says it opened');
  assert.deepEqual(mounted, ['PACK', 'BOOK', 'JOURNAL:notebook'], 'each door opens its window in the building\'s own slot');
  assert.equal(bag.openCharSheet(), true);
  assert.deepEqual(mounted[3], { sheet: 'DOORS' }, 'the crossover to the sheet is the building\'s own sheet, with its own doors');
  assert.equal(bag.questLog(), 'LOG', 'and the Quests tab reads the host\'s walk');
  // the sheet builder the building borrows takes that bag, and keeps its own when none is handed
  const world = rd('src/scenes/world.js');
  const head = 'const makeCharSheetWindow = ({ inventory = null, pause = null } = {}) => createCharSheetWindow(';
  assert.equal(mountLiteral(world, head, { pauseDoorHooks: () => 'STREET', inventory: null, pause: () => 'BUILDING' }).pause(), 'BUILDING');
  assert.equal(mountLiteral(world, head, { pauseDoorHooks: () => 'STREET', inventory: null, pause: null }).pause(), 'STREET');
});
