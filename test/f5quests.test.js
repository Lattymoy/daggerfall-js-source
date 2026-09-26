// F5-QUESTS (2026-09-26, Mac: "Cant see quest on f5 menu but can on tab menu"): on the enhanced skin F5 opens the
// pause window on its Stats page (PX27) - the SAME window Tab's dial opens through the host's pause door - and F5's
// door handed it the sheet's four buttons and nothing else. So on F5's copy the Quests tab said "The journal is not
// wired into this place yet" while Tab's listed every quest, Save and Load said there was no door, and Exit did
// nothing. Each host's pause bag is ONE arm now, spread by its pause door and handed to its sheet builder; the act
// and the slot seams are pauseDoor's own, shared by both doors; and routeKey's position applier rides F5 into the
// dungeon's bag as it rides Escape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pauseMenuHooks, pauseMenuAct, pauseOpts } from '../src/ui/pauseDoor.js';
import { routeAction } from '../src/ui/input.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** The `{...}` literal after `opener`, braces balanced past strings and comments. */
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
/** Build the literal with every free name resolved from `env`, or a stub. */
function mountLiteral(text, opener, env = {}) {
  const scope = new Proxy({ ...env }, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : STUB)),
  });
  // eslint-disable-next-line no-new-func
  return new Function('__scope', `with (__scope) { return (${literalBody(text, opener)}); }`)(scope);
}

test('F5-QUESTS: the pause window\'s one act and one slot routing, shared by both doors - down first, relock but on the way to the menu, a picked slot onto the host\'s own seams', () => {
  const seen = [];
  const hooks = pauseMenuHooks({
    quickSave: () => seen.push('quickSave'), quickLoad: () => seen.push('quickLoad'),
    saveAs: (n) => seen.push(`saveAs:${n}`), loadKey: (k) => seen.push(`loadKey:${k}`),
    relock: () => seen.push('relock'), exitToMenu: () => seen.push('exit'),
  }, () => ({ takePickedSaveName: () => 'Slot A', takePickedSaveKey: () => 7 }));
  const act = pauseMenuAct(hooks, () => seen.push('close'));
  act('save'); act('load'); act('exit'); act('resume');
  assert.deepEqual(seen, ['close', 'relock', 'saveAs:Slot A', 'close', 'relock', 'loadKey:7', 'close', 'exit', 'close', 'relock']);
  // nothing picked, or a host with no slot seams: the quick verbs
  const quick = [];
  const bare = pauseMenuHooks({ quickSave: () => quick.push('qs'), quickLoad: () => quick.push('ql'), saveAs: () => quick.push('saveAs') }, () => null);
  bare.quickSave(); bare.quickLoad();
  assert.deepEqual(quick, ['qs', 'ql']);
  // DISC22-B's return to the classic window is the act's too
  const back = [];
  pauseMenuAct({ onResume: () => back.push('back'), relock: () => back.push('relock') }, () => back.push('close'))('resume');
  assert.deepEqual(back, ['close', 'back']);
});

test('F5-QUESTS: F5\'s page is handed the host\'s pause bag UNDER the sheet\'s own doors, and acts through the pause door\'s law', () => {
  const door = rd('src/ui/charSheetDoor.js');
  assert.match(door, /return enhancedSheetPageOverlay\(hooks, deps\.entity, deps\.pause \?\? null\);/, 'the door hands the bag on');
  const opts = door.slice(door.indexOf('  function pageOpts() {'), door.indexOf('\n  }\n', door.indexOf('  function pageOpts() {')));
  const bagAt = opts.indexOf('...(pause?.() ?? {}),');
  assert.ok(bagAt > 0, 'the page spreads the bag');
  for (const own of ['openPack:', 'openSpellbook:', 'openChronicle:', 'openAscend:']) {
    assert.ok(opts.indexOf(own) > bagAt, `${own} is the SHEET's, written after the bag so the bag cannot replace it`);
  }
  assert.match(opts, /const menuHooks = pauseMenuHooks\(\{/, 'the slot routing is the pause door\'s');
  assert.match(opts, /onAction: pauseMenuAct\(menuHooks, close\),/, 'and so is the act - Save, Load and Exit act');
  assert.match(opts, /hooks: menuHooks,/);
});

test('F5-QUESTS / THE FOUR HOSTS: every host\'s sheet is handed the SAME bag its pause door spreads - built and asked, not matched', () => {
  // world.js and exterior.js: the bag is `pauseDoorHooks`; the sheet builder's `pause` must answer it
  for (const file of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(file);
    assert.match(s, /openPauseFlow\(\(w\) => townTalk\.showOverlay\(w\), \{\n\s*at: pauseAt,[^\n]*\n\s*\.\.\.pauseDoorHooks\(\),/, `${file}: the pause door spreads the bag`);
    const deps = mountLiteral(s, 'const makeCharSheetWindow = () => createCharSheetWindow(', { pauseDoorHooks: () => 'THE-BAG' });
    assert.equal(typeof deps.pause, 'function', `${file}: the sheet is handed a pause bag`);
    assert.equal(deps.pause(), 'THE-BAG', `${file}: ...and it is the pause door's own`);
    const bag = mountLiteral(s, 'const pauseDoorHooks = () => (', {
      questBridge: { questLog: () => 'LOG', repair: () => 'REPAIRED', machine: { getAllQuestLogMessages: () => ['m'] } },
      pauseQuestLog: () => 'LOG', pauseQuestMessages: () => ['m'],
    });
    assert.equal(bag.questLog(), 'LOG', `${file}: the Quests tab's walk rides the bag`);
    assert.equal(bag.repairQuests(), 'REPAIRED', `${file}: and the Settings' repair`);
    assert.equal(typeof bag.exitToMenu, 'function', `${file}: and the exit`);
  }
  // dungeonContext.js: the bag is `pauseHooks(setPlayerPos)`; the sheet hands it the applier its door was given
  const dc = rd('src/scenes/dungeonContext.js');
  const deps = mountLiteral(dc, 'return createCharSheetWindow(', { api: { pauseHooks: (p) => ['THE-BAG', p] }, sheetOpts: { setPlayerPos: 'APPLIER' }, pauseOpts });
  assert.deepEqual(deps.pause(), ['THE-BAG', 'APPLIER'], 'the dungeon sheet is handed the pause door\'s bag, with the applier its door was given');
  const loads = [];
  const bag = mountLiteral(dc, 'const ctx = this;   // the sibling save verbs on this same context\n      return ', {
    ctx: { quickLoad: (...a) => { loads.push(a); } }, setPlayerPos: 'APPLIER',
    opts: { questBridge: { questLog: () => 'LOG', repair: () => 'REPAIRED' } },
  });
  bag.quickLoad(); bag.loadKey(3);
  assert.deepEqual(loads, [['APPLIER'], ['APPLIER', 3]], 'the Load arms place the player through the applier');
  assert.equal(bag.questLog(), 'LOG');
  // worldModes.js (the interior) borrows the outer host's builder, so a building's F5 page wears that host's bag
  const modes = rd('src/scenes/worldModes.js');
  assert.match(modes, /toggleCharSheet\(\) \{ mountInterior\(host\.makeCharSheet\?\.\(\)\); \},/, 'the interior borrows the outer builder');
  assert.match(rd('src/scenes/world.js'), /makeCharSheet: \(\) => \(charSheetDoorReady\(\) \? makeCharSheetWindow\(\) : null\),/, '...which is the one handed the bag');
});

test('F5-QUESTS: F5 carries routeKey\'s position applier into the sheet, as Escape carries it into the pause door', () => {
  const got = [];
  assert.equal(routeAction('CharacterSheet', { toggleCharSheet: (o) => got.push(o) }, 'APPLIER'), true);
  assert.deepEqual(got, [{ setPlayerPos: 'APPLIER' }]);
  // the hosts that need none take none - the arrow ignores the bag
  assert.equal(routeAction('CharacterSheet', { toggleCharSheet: () => got.push('bare') }), true);
  assert.match(rd('src/scenes/dungeonContext.js'), /toggleCharSheet\(doorOpts = \{\}\) \{/, 'the dungeon toggle takes the door options');
});
