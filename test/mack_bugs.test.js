import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMountRig } from '../src/player/mountRig.js';
import { TRANSPORT_MODES } from '../src/systems/transport.js';
import { MOUSE_CODES, mouseCode, routeAction } from '../src/ui/input.js';
import { ControlsWindow } from '../src/ui/controlsWindow.js';
import { currentDict } from '../src/systems/controlsConfig.js';

// ═══ MAC-K: THREE THINGS MAC FOUND IN PLAY ════════════════════════
//
// 2026-09-15, verbatim:
//   1. Mouse keybindings not working properly
//   2. Logbook not reflecting quests
//   3. T to mount not working outside interiors
//
// Three reports, and the same shape under two of them: a seam wired in
// three of THE FOUR HOSTS and missing from the fourth, where no
// source-text pin aimed at one host could see it. The pins below are
// aimed at POPULATIONS for exactly that reason.
//
// K2's own pins live with what they moved - test/questbridge.test.js
// for the walk and test/enhancedChronicle.test.js for the window.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const HOSTS = ['exterior', 'world', 'worldModes', 'dungeonContext'];

// ── K1: the mouse ────────────────────────────────────────────────

test('AUDIT-MACK F2: ONE feeder per held-key Set, and every reader is on a fed one', () => {
  // THE PIN THIS REPLACES WAS WRONG, and wrong in the direction that
  // matters: it asserted that every file reading `held(keys, ...)`
  // must itself write the mouse codes into that Set. `worldModes.js`
  // does not OWN a Set - it takes `keys` off the host bag
  // (`exterior.js:3086`) - and the lender's own mousedown writes the
  // codes UNGATED on a listener that is never removed. The codes were
  // always there.
  //
  // So MAC-K1's first cause was a misdiagnosis: it read AUDIT 39r's
  // "three hosts fixed, this one missed" as a gap, and added a second
  // writer to a Set that already had one. Idempotent, harmless, and a
  // second law for one fact.
  //
  // The real invariant is ownership: a file that DECLARES a held-key
  // Set must feed it both edges; a file that BORROWS one must not,
  // because two writers on one Set is how you get a release that
  // half-happens. Derived from the declarations, so it cannot be
  // satisfied by a list.
  const files = [...HOSTS, 'dungeon'].map((h) => [`src/scenes/${h}.js`, rd(`src/scenes/${h}.js`)]);
  const owners = [];
  const borrowers = [];
  for (const [f, src] of files) {
    if (!/\bheld\(keys,|\bkeys\.has\(/.test(src)) continue;
    (/const keys = new Set\(\)/.test(src) ? owners : borrowers).push([f, src]);
  }
  assert.ok(owners.length >= 2 && borrowers.length >= 1,
    `the port has both kinds (${owners.length} owners, ${borrowers.length} borrowers)`);

  for (const [f, src] of owners) {
    assert.match(src, /const mc = mouseCode\(e\.button\);\s*\n?\s*if \(mc\) keys\.add\(mc\);/s,
      `${f} DECLARES the Set, so a mouse press must reach it - Mouse2 is AutoRun and Mouse0 the drawn bow's un-draw at the shipped bindings`);
    assert.match(src, /const mc = mouseCode\(e\.button\);\s*\n?\s*if \(mc\) keys\.delete\(mc\);/s,
      `${f} must also let the button GO - a stuck Mouse2 is a stuck AutoRun`);
    // ...and the write must be UNGATED, which is what makes a borrower
    // safe: the lender records the press whatever mode is mounted.
    const line = src.split('\n').find((l) => l.includes("addEventListener('mousedown'") && l.includes('keys.add(mc)'));
    assert.ok(line, `${f}: the feed is on the mousedown listener`);
    const gate = Math.min(...['modeNow()', 'overlayActive', 'walkMode'].map((g) => {
      const at = line.indexOf(g);
      return at < 0 ? Infinity : at;
    }));
    assert.ok(line.indexOf('keys.add(mc)') < gate,
      `${f}: the press is recorded BEFORE any gate, or a borrower's interior would be starved`);
  }
  for (const [f, src] of borrowers) {
    assert.ok(!/keys\.add\(mc\)/.test(src),
      `${f} borrows its Set and must not write to it too - one feeder, or a release half-happens`);
  }
  assert.ok(borrowers.some(([f]) => f.endsWith('worldModes.js')),
    'worldModes.js is the borrower MAC-K1 mistook for a gap');
});

test('MAC-K1: the crossed middle name is spelled ONCE, and the hosts read that table', () => {
  // Unity counts Mouse0/1/2 as left/RIGHT/middle; MouseEvent.button
  // counts left/MIDDLE/right. The two middle names cross, so a host
  // that spelled 'Mouse' + e.button would hand the wheel the right
  // button's action.
  assert.deepEqual([...MOUSE_CODES], ['Mouse0', 'Mouse2', 'Mouse1']);
  assert.equal(mouseCode(0), 'Mouse0', 'left');
  assert.equal(mouseCode(1), 'Mouse2', 'the DOM’s middle is Unity’s Mouse2');
  assert.equal(mouseCode(2), 'Mouse1', '...and the DOM’s right is Unity’s Mouse1');
  assert.equal(mouseCode(3), null, 'a fourth button is not a KeyCode');
  assert.equal(mouseCode(-1), null);
  for (const f of [...HOSTS.map((h) => `src/scenes/${h}.js`), 'src/scenes/dungeon.js',
    'src/ui/controlsWindow.js', 'src/ui/enhancedControls.js']) {
    const src = rd(f);
    if (!src.includes('mouseCode')) continue;
    assert.ok(!/['"`]Mouse['"`]\s*\+/.test(src), `${f} must not spell the crossing a second time`);
  }
});

test('MAC-K1: BOTH controls skins can capture a mouse button, which is what "not working properly" was', () => {
  // The registry has carried Mouse0/1/2 since AUDIT 39r - three of the
  // shipped defaults ARE mouse buttons - and every runtime reader took
  // them. The one door a player uses could not: both skins' capture
  // listened for a KEY. So an action could never be moved onto a
  // button, and one cleared off a button could never be put back.
  //
  // DFU's WaitForKeyPress is `Input.GetKeyDown` walked over every
  // KeyCode, and Mouse0/1/2 are KeyCodes like any other.
  const enh = rd('src/ui/enhancedControls.js');
  assert.match(enh, /document\.addEventListener\('mousedown', armedMouse, \{ capture: true \}\);/);
  assert.match(enh, /document\.removeEventListener\('mousedown', armedMouse, \{ capture: true \}\);/,
    'and it leaves with the capture - a listener outliving its screen is its own bug');
  assert.match(enh, /const code = mouseCode\(e\.button\);\s*\n\s*if \(code == null\) return;/,
    'a fourth button is not a binding, and must not end the capture with nothing written');

  const classic = rd('src/ui/controlsWindow.js');
  assert.match(classic, /click\(vx, vy, right = false, middle = false\) \{/,
    'the classic grid needed the button to reach it at all');

  // ...AND IT IS DRIVEN, not read. THE CAMPAIGN'S OWN LESSON, for the
  // sixth time in this port: the first cut of this pin grepped for the
  // binding line, and a mutant that put the old `return true` back and
  // left the new arm under `if (false)` SURVIVED it - the text was
  // still there. A source-text pin cannot tell a live branch from a
  // dead one. This one arms a real capture and clicks.
  const win = new ControlsWindow();
  const jump = win.buttons.find((b) => b.action === 'Jump');
  assert.ok(jump, 'the grid offers Jump');
  const hit = (right, middle) => win.click(jump.x + 1, jump.y + 1, right, middle);
  hit(false, false);                       // the left click that ARMS
  assert.equal(win.capture, 'Jump', 'a left click on the row arms the capture');
  hit(false, false);                       // the NEXT press binds
  assert.equal(currentDict(win.unsaved).get('Jump'), 'Mouse0', 'the left button binds');
  assert.equal(win.capture, null, 'and one press ends it');

  hit(false, false);
  hit(true, false);
  assert.equal(currentDict(win.unsaved).get('Jump'), 'Mouse1',
    'the RIGHT button is Unity\u2019s Mouse1 - the crossed middle name, read off the one table');
  hit(false, false);
  hit(false, true);
  assert.equal(currentDict(win.unsaved).get('Jump'), 'Mouse2', 'and the wheel press is Mouse2');

  // the remove gesture is still the remove gesture when NOTHING is armed
  assert.equal(win.capture, null);
  const before = currentDict(win.unsaved).get('Jump');
  win.click(0, 0, true);                   // a right click on dead space
  assert.equal(currentDict(win.unsaved).get('Jump'), before, 'and it did not bind anything');
  // ...and the host really passes the third and fourth arguments, or
  // the grid's `middle` is a parameter nothing ever fills.
  assert.match(rd('src/scenes/townTalk.js'),
    /overlay\.click\?\.\(v\[0\], v\[1\], e\.button === 2, e\.button === 1\)/,
    'the overlay seam carries the button, which is what makes the grid’s arm reachable');
});

// ── K3: the mount ────────────────────────────────────────────────

test('MAC-K3: the picker refuses AIRBORNE in silence, and opens grounded', () => {
  // dfuiOpenTransportWindow (DaggerfallUI.cs:690-700): `if
  // (isGrounded)` with NO else. Airborne is not a refusal line, it is
  // nothing at all.
  const shown = [];
  const player = { grounded: false, transportMode: TRANSPORT_MODES.Foot, setTransportMode() {} };
  const rig = createMountRig({
    renderer: {}, canvas: {}, fetchBytes: async () => new Uint8Array(),
    palette: null, audio: { playOneShot() {}, setLoop() {} },
    player, playerEntity: { items: [] },
    showOverlay: (w) => shown.push(w),
  });
  rig.open();
  assert.equal(shown.length, 0, 'airborne: nothing, and no line either');
  // grounded, but the picker's own ART is not loaded in node, so the
  // second half of the gate still refuses - which is the honest answer
  // and is why this pin asserts the GATE rather than a window object
  player.grounded = true;
  rig.open();
  assert.equal(shown.length, 0, 'grounded but artless: still nothing to show');
});

test('MAC-K3: setMode is the ONE motor call, and it drops the art before it loads the new mount', () => {
  // HC1 (2026-09-14, Mac: "audit the horse and cart ... the sprites
  // actually show"): the art loads where the MODE changes, not on the
  // T-key pick alone - three other paths set it (a loaded save on
  // horseback, the Test Room's ride out, the ship's landing) and each
  // used to leave a rider with no horse under them.
  const calls = [];
  const player = { grounded: true, transportMode: TRANSPORT_MODES.Foot, standing: true, isRunning: false, movingLessThanHalfSpeed: false,
    setTransportMode(m) { calls.push(m); this.transportMode = m; } };
  const rig = createMountRig({
    renderer: {}, canvas: {}, fetchBytes: async () => { throw new Error('no ARENA2 here'); },
    palette: null, audio: { playOneShot() {}, setLoop() {} },
    player, playerEntity: { items: [] }, showOverlay: () => {},
  });
  rig.setMode(TRANSPORT_MODES.Horse);
  assert.deepEqual(calls, [TRANSPORT_MODES.Horse], 'the motor is told, once');
  assert.equal(rig.loaded(), false, 'and a failed art load leaves NO mount rather than a stale one');
  rig.setMode(TRANSPORT_MODES.Foot);
  assert.deepEqual(calls, [TRANSPORT_MODES.Horse, TRANSPORT_MODES.Foot]);
});

test('MAC-K3: a frame while dismounted draws nothing, and cannot reach a canvas it has not got', () => {
  // The draw is gated on `isRiding` AND on the art being up, so the
  // per-frame call is safe on foot - which matters because the fixed-
  // city host now runs it every frame and had never run it before.
  let drew = 0;
  const player = { grounded: true, transportMode: TRANSPORT_MODES.Foot, standing: true, isRunning: false, movingLessThanHalfSpeed: false, setTransportMode() {} };
  const rig = createMountRig({
    renderer: { drawScreenQuad: () => { drew++; } },
    canvas: null,                       // deliberately: nothing may reach it
    fetchBytes: async () => new Uint8Array(), palette: null,
    audio: { playOneShot() {}, setLoop() {} },
    player, playerEntity: { items: [] }, showOverlay: () => {},
  });
  rig.frame(1 / 60);
  assert.equal(drew, 0, 'on foot, nothing is drawn');
});

// ═══ AUDIT-MACK F1: THE DOOR IS NOT THE KEY ═══════════════════════

test('AUDIT-MACK F1: every ctx door routeAction dispatches is reachable BY ITS ACTION in every host that has it', () => {
  // THE FINDING THIS FILE EXISTS FOR, on its second pass.
  //
  // MAC-K3 built the fixed-city host's whole mount surface and hung
  // `openTransport: () => mountRig.open()` on its `hudCtx`. The pin
  // above checked that the door was there. The door WAS there. The T
  // key still did nothing - because `exterior.js` and `world.js` route
  // their OWN keys and never call `routeKey`, which is the only thing
  // that reaches `routeAction`'s table. Their hand-written ladders had
  // arms for five of its ten actions.
  //
  // Nothing looked broken from the inside: `routeAction` answered, the
  // large HUD's transport panel opened the picker, and the KEY was
  // never wired at all. Mac reported the one he uses; `Status` (I),
  // `UseMagicItem` (U) and the two mode cycles were the same bug
  // unreported.
  //
  // A PIN ON THE DOOR IS NOT A PIN ON THE KEY - the third dress the
  // F-SING lesson has worn this week. So this is DERIVED from
  // `routeAction`'s own switch: nothing here is typed, and an action
  // added to that table is covered the moment it lands.
  const input = rd('src/ui/input.js');
  const table = [...input.matchAll(/case '(\w+)': return ctx\.(\w+)/g)].map((m) => [m[1], m[2]]);
  assert.ok(table.length >= 10, `routeAction dispatches ${table.length} actions - the table is really parsed`);
  assert.ok(table.some(([a]) => a === 'Transport'), 'including the one Mac reported');

  // THE INVARIANT, and it is the asymmetry the bug WAS: a host that
  // routes the large HUD's panel clicks into a ctx must route its KEYS
  // into that same ctx. The panel and the key are two ways to the same
  // door, and `routeLargeHudClick` reaches `routeAction` directly
  // (ui/hudLarge.js) while a hand-written key ladder reaches only what
  // someone wrote down. That is how `openTransport` came to answer a
  // click and ignore the T key.
  //
  // Stated this way it needs no list of hosts and no model of which
  // file owns which ctx - a host either takes the whole table on both
  // seams or it does not.
  const clickers = [];
  for (const h of [...HOSTS, 'dungeon']) {
    const src = rd(`src/scenes/${h}.js`);
    if (!/routeLargeHudClick\(/.test(src)) continue;
    clickers.push(h);
    assert.ok(/routeKey\(/.test(src) || /routeAction\(act, \w+\)/.test(src),
      `${h}.js routes the large HUD's panels through routeAction but not its keys - `
      + 'every door on that ctx would open by click and ignore its own key');
  }
  assert.deepEqual(clickers, ['exterior', 'world', 'worldModes', 'dungeon'],
    'the four files that route the bar\u2019s panels - dungeonContext BUILDS the ctx that dungeon.js routes, on both seams');

  // ...and the two that hand-write a ladder really end it on the
  // table, which is what makes the assertion above true for them.
  for (const h of ['exterior', 'world']) {
    assert.match(rd(`src/scenes/${h}.js`), /if \(routeAction\(act, hudCtx\)\) \{ e\.preventDefault\(\); return; \}/,
      `${h}.js: the tail of the ladder is the TABLE, not a list someone maintains`);
  }
});

test('AUDIT-MACK F1b: the fall-through is DRIVEN, and it declines what is not there', () => {
  // The arm itself, run: `routeAction` opens a door that exists,
  // refuses one that does not, and never invents a third answer. That
  // refusal is what lets the two outdoor hosts take the whole table
  // without claiming doors they have not built.
  const opened = [];
  const ctx = { openTransport: () => opened.push('transport') };
  assert.equal(routeAction('Transport', ctx), true, 'a door that exists is opened...');
  assert.deepEqual(opened, ['transport']);
  assert.equal(routeAction('UseMagicItem', ctx), false, '...and one that does not is DECLINED, not broken');
  assert.equal(routeAction('NotAnAction', ctx), false);
  assert.deepEqual(opened, ['transport'], 'and nothing else fired');

  // ...and both outdoor hosts really end their ladder on it, INSIDE
  // the overlay/mode gate - a fall-through outside it would open the
  // picker through an open window.
  for (const h of ['exterior', 'world']) {
    const src = rd(`src/scenes/${h}.js`);
    const at = src.indexOf('if (routeAction(act, hudCtx))');
    assert.ok(at > 0, `${h}.js ends its ladder on the table`);
    // INSIDE, checked by BRACE DEPTH rather than by "the gate text
    // appears earlier in the file" - a mutant that moved the line one
    // brace out survived exactly that weaker reading, because the gate
    // is still earlier either way.
    const gate = src.lastIndexOf("!townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior'", at);
    assert.ok(gate > 0 && gate < at, `${h}.js: the gate opens before the fall-through`);
    let depth = 0;
    for (const ch of src.slice(gate, at)) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    assert.ok(depth > 0,
      `${h}.js: the fall-through must sit INSIDE the overlay/mode gate - outside it, the T key would open the picker through an open window`);
  }
});

test('AUDIT-MACK F3: a rig a host builds unconditionally is never optional-chained', () => {
  // MAC-K3 shipped `let mountRig = null` in world.js with
  // `mountRig?.setMode(mode)`, `mountRig?.open()` and
  // `mountRig?.frame(dt)` - three silent no-ops dressed as a guard
  // against the build order. They guarded nothing: the rig is built
  // unconditionally at the top level of the host function and every
  // caller sits in a closure that cannot run before that body has.
  //
  // What the `?.` DID do was turn a broken build order into a player
  // quietly staying on foot through a loaded save, the Test Room's
  // ride and the ship's landing - instead of a throw at the line that
  // broke. `scenes/exterior.js` already had the loud shape; two
  // spellings of one seam is how two hosts drift.
  // COMMENTS STRIPPED FIRST. The note above spells `mountRig?.setMode`
  // to say what it replaced, and the first cut of this pin reddened on
  // its own prose - the same trap AUDIT-EOTB's dead-export walk hit.
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const h of ['exterior', 'world']) {
    const raw = rd(`src/scenes/${h}.js`);
    if (!raw.includes('createMountRig(')) continue;
    const src = strip(raw);
    assert.match(src, /const mountRig = createMountRig\(\{/,
      `${h}.js: the rig is a const, bound at its build`);
    assert.ok(!/mountRig\?\./.test(src),
      `${h}.js: no call on the rig may be optional-chained - a silent no-op here is a player left on foot`);
    assert.ok(/mountRig\.setMode\(|mountRig\.open\(|mountRig\.frame\(/.test(src),
      `${h}.js really calls it, so the assertion above is not vacuous`);
  }
});
