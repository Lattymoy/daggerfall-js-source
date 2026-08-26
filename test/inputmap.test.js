// The input map: registry-backed routing (I2) + the overlay tables.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  overlayAction, actionOf, held, moveHeld, anyMove, routeKey, setBindings,
} from '../src/ui/input.js';
import { createBindings, resetDefaults, setBinding, DEFAULT_BINDINGS } from '../src/systems/inputActions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Every test builds its own store - the module singleton is swapped in
// and restored so no test leaks bindings into another.
const withDefaults = () => {
  const b = createBindings();
  resetDefaults(b);
  setBindings(b);
  return b;
};

test('input: the overlay table is untouched by the registry', () => {
  assert.equal(overlayAction({ key: 'a' }), 'char:a');
  assert.equal(overlayAction({ key: 'Enter' }), 'confirm');
  assert.equal(overlayAction({ key: '=' }), 'plus');
  assert.equal(overlayAction({ key: 'F9' }), null);
});

test('I2: actionOf reads the LIVE bindings, not a table', () => {
  withDefaults();
  assert.equal(actionOf({ code: 'F5' }), 'CharacterSheet');
  assert.equal(actionOf({ code: 'F6' }), 'Inventory');
  assert.equal(actionOf({ code: 'Backspace' }), 'CastSpell');
  assert.equal(actionOf({ code: 'KeyC' }), 'Crouch', 'I2 retired the C-cast: DFU\'s C crouches');
  assert.equal(actionOf({ code: 'KeyX' }), null, 'and X is unbound');
  assert.equal(actionOf({ code: 'KeyV' }), 'TravelMap');
  // a REBIND moves the answer - the whole point of the registry
  const b = withDefaults();
  setBinding(b, 'KeyP', 'Inventory');
  assert.equal(actionOf({ code: 'KeyP' }), 'Inventory');
  assert.equal(actionOf({ code: 'F6' }), null, 'the old code no longer answers');
});

test('I2: held/moveHeld poll the bound codes against the host key set', () => {
  const b = withDefaults();
  const keys = new Set(['KeyW', 'KeyD', 'ShiftLeft']);
  assert.equal(held(keys, 'Run'), true);
  assert.equal(held(keys, 'Sneak'), false);
  const mv = moveHeld(keys);
  assert.deepEqual(mv, { forwards: true, backwards: false, left: false, right: true });
  assert.equal(anyMove(mv), true);
  assert.equal(anyMove(moveHeld(new Set())), false);
  // rebinding Crouch back to X makes X crouch again - a player CAN
  // recreate the port's old layout, it is just no longer the default
  setBinding(b, 'KeyX', 'Crouch');
  assert.equal(held(new Set(['KeyX']), 'Crouch'), true);
  assert.equal(held(new Set(['KeyC']), 'Crouch'), false);
  // and a SECONDARY binding answers held() too (GetKey :1084)
  setBinding(b, 'KeyB', 'Jump', false);
  assert.equal(held(new Set(['KeyB']), 'Jump'), true);
});

test('I2: routeKey - overlay precedence, toggles, unconsumed', () => {
  withDefaults();
  const calls = [];
  const ctx = {
    uiOverlayActive: false,
    overlayInput: (a) => calls.push('ov:' + a),
    toggleCharSheet: () => calls.push('sheet'),
    toggleInventory: () => calls.push('inv'),
    toggleSpellbook: () => calls.push('book'),
  };
  assert.ok(routeKey({ key: 'F6', code: 'F6' }, ctx));
  // the CastSpell ACTION opens the spellbook (GameManager.cs:550-553)
  assert.ok(routeKey({ key: 'Backspace', code: 'Backspace' }, ctx));
  assert.ok(!routeKey({ key: 'x', code: 'KeyX' }, ctx), 'unconsumed falls through');
  ctx.uiOverlayActive = true;
  assert.ok(routeKey({ key: 'Backspace', code: 'Backspace' }, ctx), 'overlay wins: backspace edits, not spellbook');
  assert.ok(!routeKey({ key: 'F9', code: 'F9' }, ctx), 'quicksave stays gated under an overlay');
  assert.deepEqual(calls, ['inv', 'book', 'ov:backspace']);
  // quickLOAD pierces any overlay (the death screen's F11 hint)
  let loaded = 0;
  ctx.quickLoad = () => loaded++;
  assert.ok(routeKey({ key: 'F11', code: 'F11' }, ctx));
  assert.equal(loaded, 1);
});

test('I2: no host reads a bound key raw - the sweep', () => {
  // The rule, enforced rather than remembered (the AUDIT 21 F2
  // shape): a `keys.has('<code>')` whose code the DEFAULT table binds
  // is a read the registry cannot rebind. Two escapes, each visible
  // in the line itself: the dev fly-camera (`fly-cam (dev)`) and the
  // recorded E-activate departure (`I2 departure`). interior.js is
  // the standalone block viewer - a dev surface with no player.
  const bound = new Set(DEFAULT_BINDINGS.map(([code]) => code));
  const hosts = readdirSync(join(root, 'src/scenes'))
    .filter((f) => f.endsWith('.js') && f !== 'interior.js')
    .map((f) => `src/scenes/${f}`);
  const offenders = [];
  for (const rel of hosts) {
    const lines = readFileSync(join(root, rel), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes('fly-cam (dev)') || line.includes('I2 departure')) return;
      for (const m of line.matchAll(/keys\.has\('([^']+)'\)/g)) {
        if (bound.has(m[1])) offenders.push(`${rel}:${i + 1} reads ${m[1]} raw`);
      }
    });
  }
  assert.deepEqual(offenders, [],
    `bound keys read raw instead of through held():\n${offenders.join('\n')}`);
});

test('I2: the sweep\'s escapes are themselves bounded', () => {
  // An escape marker that spreads stops being an escape. The E
  // departure is ONE line per gameplay host; fly-cam markers only on
  // fly-branch lines (a handful per exterior-style host).
  const count = (rel, needle) =>
    (readFileSync(join(root, rel), 'utf8').match(new RegExp(needle, 'g')) ?? []).length;
  const FLY = { 'src/scenes/exterior.js': 5, 'src/scenes/world.js': 5,
    'src/scenes/dungeon.js': 5, 'src/scenes/worldModes.js': 0 };
  for (const [rel, fly] of Object.entries(FLY)) {
    assert.equal(count(rel, 'I2 departure'), 1, `${rel} carries exactly one E-departure line`);
    assert.equal(count(rel, 'fly-cam \\(dev\\)'), fly,
      `${rel} fly-cam escapes are counted - a new one is a decision, not a drift`);
  }
});

test('U43: the two journal doors are in the ONE dispatch, and are one window', () => {
  // GameManager.Update (:541-548) dispatches LogBook and NoteBook in
  // the same flat chain as CharacterSheet and Inventory. The port has
  // bound L and N since I1 and read NEITHER anywhere in src/, while
  // ui/questJournal.js sat built with all four of its pages - the
  // exact shape of a binding table nobody consults.
  withDefaults();
  const calls = [];
  const ctx = {
    uiOverlayActive: false,
    overlayInput: (a) => calls.push('ov:' + a),
    toggleLogbook: () => calls.push('log'),
    toggleNotebook: () => calls.push('note'),
  };
  assert.ok(routeKey({ key: 'l', code: 'KeyL' }, ctx), 'L opens the logbook');
  assert.ok(routeKey({ key: 'n', code: 'KeyN' }, ctx), 'N opens the notebook');
  assert.deepEqual(calls, ['log', 'note']);
  // a host without the seam is not consumed - the table is optional
  // per host, the way Rest and AutoMap already are
  assert.equal(routeKey({ key: 'l', code: 'KeyL' }, { uiOverlayActive: false }), true,
    'the case still answers; the hook is optional-chained');
  // and an open overlay owns them, like every other window key - the
  // letter reaches the WINDOW as a typed character, which is what a
  // spell being renamed in the book needs
  ctx.uiOverlayActive = true;
  calls.length = 0;
  routeKey({ key: 'l', code: 'KeyL' }, ctx);
  assert.deepEqual(calls, ['ov:char:l'], 'the live window types it; no logbook opens');
});

test('U43: ONE dispatch - the interior host routes the same table as the dungeon', () => {
  // GameManager.Update has NO scene gate: the window a key opens does
  // not care where the player stands. The port had three divergent
  // chains, and the interior one answered two actions - so F5, F6, L
  // and N all died the moment the player stepped through a shop door,
  // with the windows themselves built and mounted elsewhere.
  const src = (rel) => readFileSync(join(root, 'src', rel), 'utf8');
  const modes = src('scenes/worldModes.js');
  assert.match(modes, /if \(routeKey\(e, interiorKeyCtx\)\) e\.preventDefault\(\);/,
    'the interior arm routes the shared table');
  // Each hook must MOUNT something, not merely exist - a named method
  // with an empty body answers the key and opens nothing, which is
  // indistinguishable from the gate this slice removed. The windows
  // are the OUTER host's: one construction, one dependency list; the
  // interior host only picks the slot.
  const MOUNTS = [
    ['toggleCharSheet', /toggleCharSheet\(\) \{ mountInterior\(host\.makeCharSheet\?\.\(\)\); \}/],
    // The save campaign's interior-pile fix put ONE construction seam
    // over the outer host's builder - makeInteriorInventory overrides
    // onDrop so a sword dropped in a shop lands in the SHOP's pool
    // (SerializableStateManager.cs:90) rather than the exterior one.
    // This pin guards that the hook MOUNTS a window, which is the law;
    // the builder's NAME is not, and pinning it was what broke here.
    ['toggleInventory', /toggleInventory\(\) \{ mountInterior\(makeInteriorInventory\(\)\); \}/],
    ['toggleSpellbook', /toggleSpellbook\(\) \{ if \(magic\) mountInterior\(makeSpellbookWindow\(\)\); \}/],
    ['toggleLogbook', /toggleLogbook\(\) \{ mountInterior\(host\.makeJournal\?\.\('activeQuests'\)\); \}/],
    ['toggleNotebook', /toggleNotebook\(\) \{ mountInterior\(host\.makeJournal\?\.\('notebook'\)\); \}/],
  ];
  for (const [hook, re] of MOUNTS) assert.match(modes, re, `the interior ctx MOUNTS a window for ${hook}`);
  // ...and Escape really opens the pause flow rather than returning
  assert.match(modes, /togglePause\(\) \{\n      if \(!pauseArtLoaded\(\)\) return;\n      \/\/ I3[^]*?openPauseFlow\(/,
    'the interior Escape door opens the pause flow');
  assert.match(src('scenes/world.js'), /makeCharSheet: \(\) =>/, 'world.js hands its builder down');
  assert.match(src('scenes/world.js'), /makeJournal: \(mode\) =>/);
  // ...and it yields to a window the outer host is already holding,
  // because townTalk draws its overlay in EVERY mode
  assert.match(modes, /if \(townTalk\?\.overlayActive\) return;/,
    'the interior arm must not answer keys aimed at the outer overlay');
  // the honest absence: interior SAVING is unbuilt, so no quickSave
  // hook - the pause window says so rather than the key doing nothing
  const ctxBlock = modes.slice(modes.indexOf('const interiorKeyCtx = {'),
    modes.indexOf('addEventListener(\'keydown\''));
  assert.equal(/quickSave/.test(ctxBlock), false, 'no interior quicksave hook');
});

test('U43-ii: every modal mode can SPEAK - no HUD line goes to the console', () => {
  // townTalk.frame ticks and DRAWS the HUD text layer as well as the
  // overlay (townTalk.js:571, :586), and the two exterior hosts called
  // it in their modal branch only when a window was up. So a broken
  // weapon, a fatigue warning and a level-up inside a building all
  // spoke to devtools while the player watched a HUD with nothing on
  // it. The quest popup was the same shape one layer up: the dungeon
  // arm of showQuestOverlay did not exist, and the classic start runs
  // _TUTOR__ and _BRISIEN inside Privateer's Hold.
  const src = (rel) => readFileSync(join(root, 'src', rel), 'utf8');
  for (const rel of ['scenes/world.js', 'scenes/exterior.js']) {
    const text = src(rel);
    assert.equal(/if \(townTalk\.overlayActive\) townTalk\.frame\(dt\);/.test(text), false,
      `${rel} must tick the HUD layer in a modal mode, not only a window`);
    assert.match(text, /\n {6}townTalk\.frame\(dt\);/, `${rel} ticks it unconditionally`);
  }
  const modes = src('scenes/worldModes.js');
  // V4: reads `host.townTalk` rather than the destructured binding,
  // and is declared ABOVE the interiorTicker that takes it as a dep.
  // It had to move: as written it sat below both, so the ticker's
  // `say` hit the const's temporal dead zone and createWorldModes
  // threw `Cannot access 'say' before initialization` on the first
  // line of the game. Lint, the build and all 3005 tests passed on
  // that - see test/tdz.test.js, which is the gate for the class. So
  // this pin now asks for the SHAPE (outer HUD, loud fallback) rather
  // than a spelling that could not run.
  assert.match(modes, /const say = \(l\) => \{ if \((?:host\.)?townTalk\?\.say\) (?:host\.)?townTalk\.say\(l\); else console\.warn/,
    'the interior say reaches the outer HUD, and falls back loudly');
  assert.ok(modes.indexOf('const say = (l) =>') < modes.indexOf('const interiorTicker = createPlayerTicker'),
    'and is DECLARED before the ticker that takes it - the dead zone that broke the boot');
  assert.equal(/say: \(l\) => console\.warn\('\[interior\]', l\)/.test(modes), false,
    'the weapon rig no longer speaks to the console');
  assert.equal(/say: \(msg\) => console\.log\('\[player\]', msg\)/.test(modes), false,
    'nor does the interior ticker');
  assert.equal(/console\.log\('\[player\] You have gained a level!'\)/.test(modes), false,
    'nor does a level-up');
  // the quest popup reaches BOTH modal slots
  assert.match(modes, /if \(mode === 'dungeon' && dungeonCtx\?\.showOverlay\) return dungeonCtx\.showOverlay\(win\);/,
    'showQuestOverlay has a dungeon arm');
  const dc = src('scenes/dungeonContext.js');
  assert.match(dc, /showOverlay\(win\) \{\n {6}if \(!win \|\| activeOverlay\) return false;/,
    'and the dungeon slot REFUSES rather than clobbering a live window');
  // ...and the host stops warning, because the fall-through is gone
  assert.equal(/popup in dungeon mode pends/.test(src('scenes/world.js')), false,
    "world.js's dungeon-popup warning is retired, not silenced");
});
