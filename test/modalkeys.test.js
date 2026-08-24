// V4 - ONE MODAL OWNS THE KEYS.
//
// Found by the first-hour playthrough probe, in a SCREENSHOT: its
// first picture of the starting dungeon was the dungeon AUTOMAP,
// open over a 0%-explored Privateer's Hold on a game one minute old.
// Nobody had pressed the automap key. The character's name was MAC.
//
// The classic start runs the chargen wizard with the player already
// standing in the dungeon. The wizard lives in the OUTER host's
// overlay slot (world.js -> townTalk), and world.js gates each of its
// own actions on `!townTalk.overlayActive`. worldModes registers a
// SECOND keydown listener on the same target, gated on nothing, and
// neither stops propagation - so every key typed into the wizard also
// reached `routeKey(e, dungeonCtx)`. routeKey's own overlay branch
// reads `ctx.uiOverlayActive`, which is dungeonCtx's slot and empty,
// so it waved them through to the bindings. Any letter in a name is
// a keybinding: M is the automap, R starts a rest, N the notebook, L
// the logbook, Z readies a weapon, F9 quicksaves a half-made
// character.
//
// This is AUDIT 24's two-chargen-wizards defect at a second seam
// ("the two hosts register separate keydown listeners on the same
// target and neither stops propagation"), and it needs the same rule.
//
// Hosts have no node execution coverage, so the ORDERING half is a
// source rule - written against the shape that has to hold, not a
// word that happens to appear - and the DANGER half is executable:
// the letters of an ordinary name really do resolve to actions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { actionOf, setBindings } from '../src/ui/input.js';
import { createBindings, resetDefaults } from '../src/systems/inputActions.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
/** Comment-stripped source: a rule that greps raw text matches the
 *  PROSE explaining the rule (AUDIT 21's F7 mutation lesson). */
const code = (p) => readFileSync(join(SRC, p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

/** worldModes' keydown handler, from its registration to the line
 *  that hands the event to the dungeon's bindings. */
function keydownBody() {
  const text = code('scenes/worldModes.js');
  const start = text.indexOf("addEventListener('keydown'");
  assert.notEqual(start, -1, 'worldModes must still register a keydown listener');
  const end = text.indexOf('routeKey(e, dungeonCtx', start);
  assert.notEqual(end, -1, 'worldModes must still route keys into the dungeon context');
  return text.slice(start, end);
}

test('V4: worldModes yields the keyboard to the outer host\'s modal BEFORE the dungeon bindings', () => {
  const body = keydownBody();
  assert.match(body, /if \(townTalk\?\.overlayActive\) return;/,
    'worldModes\' keydown must return while the outer host holds a modal (chargen, talk,\n'
    + 'the level-up screen) - otherwise every key typed into that window ALSO drives the\n'
    + 'dungeon behind it, which is how naming a character MAC opened the automap.');
});

test('V4: the yield comes first - before ANY branch worldModes handles itself', () => {
  const body = keydownBody();
  const guard = body.indexOf('townTalk?.overlayActive');
  // The first thing the handler does with the event, other than yield.
  const firstOwn = body.indexOf("mode === 'interior'");
  assert.ok(guard >= 0 && firstOwn >= 0, 'both the guard and the interior branch must exist');
  assert.ok(guard < firstOwn,
    'the yield must precede worldModes\' own overlay branches: a modal in the outer host\n'
    + 'outranks this host\'s slot, and a guard placed after them leaves the interior arm\n'
    + 'still eating keys that belong to the window on top.');
});

test('V4: routeKey cannot see the outer host\'s overlay, which is WHY the host must yield', () => {
  // The rule above is not a belt-and-braces duplicate of a check
  // routeKey already makes. routeKey knows only the ctx it is handed.
  const router = code('ui/input.js');
  assert.doesNotMatch(router, /townTalk/,
    'ui/input.js must stay host-agnostic - if it ever learned about townTalk this rule\n'
    + 'would need rewriting rather than silently becoming redundant.');
  assert.match(router, /ctx\.uiOverlayActive/,
    'routeKey gates on the overlay of the ctx it was GIVEN (the dungeon\'s), which is empty\n'
    + 'while the wizard is up in the outer host - that is the whole hazard.');
});

test('V4: world.js still gates its own actions on the same modal (both sides of the rule)', () => {
  // Deleting world.js's gate would make the ordering rule above look
  // satisfied while the defect moved hosts.
  const w = code('scenes/world.js');
  const gated = (w.match(/!townTalk\.overlayActive/g) ?? []).length;
  assert.ok(gated >= 6,
    `world.js gates its keyed actions on !townTalk.overlayActive; found ${gated}, expected the\n`
    + 'sheet/inventory/cast/quicksave/travel/automap/pause set. If these were removed, the\n'
    + 'outer host is now leaking keys into its OWN windows and this lane is not done.');
});

test('V4: the letters of an ordinary name really are bindings - the danger, executed', () => {
  const b = createBindings();
  resetDefaults(b);
  setBindings(b);
  const of = (code_) => actionOf({ code: code_ });
  // The exact three the probe typed.
  assert.equal(of('KeyM'), 'AutoMap', 'M is the automap - this is the key that opened it');
  assert.equal(of('KeyA'), 'MoveLeft', 'A walks the player left under the wizard');
  assert.equal(of('KeyC'), 'Crouch');
  // ...and the ones that would have done real harm.
  assert.equal(of('KeyR'), 'Rest', 'R would have started a rest inside chargen');
  assert.equal(of('KeyN'), 'NoteBook');
  assert.equal(of('KeyL'), 'LogBook');
  assert.equal(of('KeyZ'), 'ReadyWeapon');
  assert.equal(of('F9'), 'QuickSave', 'F9 would have saved a half-made character');
  setBindings(null);
});
