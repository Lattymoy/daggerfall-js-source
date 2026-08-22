// AUDIT 24, wave 45: the swing that turned the camera.
//
// Reported from play: "whenever attempting to attack, it swings your
// entire screen."
//
// The right button is a WEAPON control in Daggerfall - every host
// suppresses `contextmenu` for exactly that reason. But the two
// STREAMING hosts are not the only thing listening for the drag:
// world.js and exterior.js each register a global `mousemove`, and so
// does worldModes.js (:1517) for the interior and dungeon modes it
// owns. Both fire on every move.
//
// The streaming hosts gated their whole swing line on
// `modeNow() === 'exterior'` - which READS as "am I outdoors" when its
// real job is "is anybody else eating this drag". So indoors,
// worldModes fed the modal weapon rig AND the streaming host fell
// through to `cam.yaw -= e.movementX`. You swung and the view turned
// with you, every time, in every building and every dungeon reached
// from the town.
//
// dungeon.js:198 - the standalone host - has always had the right
// shape: attack, then return. It has no modal sibling to share the
// drag with, which is why it never needed a mode in the test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { routeMouseDrag } from '../src/scenes/shared.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const RMB = 2, LMB = 1, BOTH = 3;

// Mutation campaign: 16 reintroductions, 16 killed - the first of them
// being the reported bug itself, put back one character at a time
// ('modal' -> 'look'). Also: the walk gate dropped either way; the
// bitmask turned into an equality (which a two-button drag defeats);
// the left button made to swing; every mode treated as exterior; the
// default flipped; each host returning only on 'swing' so the modal
// answer fell through to the camera again; a host re-deriving the old
// mode gate inline; the modal arm double-feeding this host's own rig;
// an armed cast no longer eating the click; the look hoisted above the
// return; worldModes' sink silenced and its interior arm removed; and
// the standalone dungeon host's `return` deleted.
// One EQUIVALENT mutant, recorded rather than dressed up: the router
// rewritten as four early returns instead of two. Same table, same
// answers - and this campaign checked that by re-running the
// BEHAVIOURAL table alone, per the procedure wave 44 ended with.

/** The body of the FIRST `mousemove` handler in a source file.
 *  Bounded by the next addEventListener, not by the next `});` - the
 *  handler now contains a `routeMouseDrag({...});` whose own `});`
 *  cut the slice short and left a pin asserting on three lines. */
function mousemoveBody(src) {
  const i = src.indexOf("addEventListener('mousemove'");
  if (i < 0) return '';
  const next = src.indexOf('addEventListener(', i + 20);
  return src.slice(i, next > 0 ? next : src.length);
}

test('audit24 wave45: RMB in walk mode is NEVER a look, in any mode', () => {
  // This is the whole bug in one table. Before the fix the third row
  // and the fourth returned 'look'.
  assert.equal(routeMouseDrag({ walkMode: true, buttons: RMB, mode: 'exterior' }), 'swing');
  assert.equal(routeMouseDrag({ walkMode: true, buttons: RMB, mode: 'interior' }), 'modal');
  assert.equal(routeMouseDrag({ walkMode: true, buttons: RMB, mode: 'dungeon' }), 'modal');
  // whatever a future mode is called, an unknown one is still not a look
  assert.equal(routeMouseDrag({ walkMode: true, buttons: RMB, mode: 'ship' }), 'modal');

  // and the three that ARE looks
  assert.equal(routeMouseDrag({ walkMode: true, buttons: 0, mode: 'exterior' }), 'look', 'no button');
  assert.equal(routeMouseDrag({ walkMode: true, buttons: LMB, mode: 'interior' }), 'look', 'the LEFT button is not a swing');
  assert.equal(routeMouseDrag({ walkMode: false, buttons: RMB, mode: 'exterior' }), 'look', 'the free-fly camera is not holding a weapon');
  assert.equal(routeMouseDrag({ walkMode: false, buttons: RMB, mode: 'dungeon' }), 'look');

  // the button test is a BITMASK - dragging with both buttons down is
  // still a swing, and `=== 2` would have missed it
  assert.equal(routeMouseDrag({ walkMode: true, buttons: BOTH, mode: 'exterior' }), 'swing');
  assert.equal(routeMouseDrag({ walkMode: true, buttons: BOTH, mode: 'interior' }), 'modal');

  // mode defaults to exterior for a host that has no mode machine
  assert.equal(routeMouseDrag({ walkMode: true, buttons: RMB }), 'swing');
});

test('audit24 wave45: the two streaming hosts route through it and RETURN on both non-look answers', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = rd(f);
    const body = mousemoveBody(src);
    assert.ok(body, `${f}: has the look handler`);

    assert.ok(body.includes('routeMouseDrag({ walkMode, buttons: e.buttons, mode: modeNow() })'),
      `${f}: asks the one router`);
    // the guard is on 'look', not on the mode - which is the fix
    assert.ok(body.includes("if (drag !== 'look') {"), `${f}: anything but a look ends here`);
    assert.doesNotMatch(body, /\(e\.buttons & 2\) && modeNow\(\) === 'exterior'/,
      `${f}: the old mode-gated guard is gone`);
    // the camera lines must come AFTER that return, not inside the arm
    const ret = body.indexOf("      return;");
    const look = body.indexOf('cam.yaw -=');
    assert.ok(ret > 0 && look > ret, `${f}: the look is downstream of the return`);
    // and only the exterior arm touches this host's own rig
    assert.ok(body.includes("if (drag === 'swing' && !magic.interceptAttack(true))"),
      `${f}: an armed cast still eats the click, and only outdoors`);
  }
});

test('audit24 wave45: worldModes owns the drag indoors - that half was always right', () => {
  const wm = rd('src/scenes/worldModes.js');
  // the modal sink exists for exactly the two modes the streaming
  // hosts must keep their hands off
  assert.match(wm, /const modalAttackSink = \(\) =>/);
  assert.match(wm, /mode === 'dungeon' && dungeonCtx\) \? dungeonCtx\.playerAttackInput/);
  assert.match(wm, /mode === 'interior' \? \(\(dx, dy, held\)/);
  // and it feeds on the same RMB bitmask
  const body = mousemoveBody(wm);
  assert.ok(body.includes('(e.buttons & 2)'), 'the same button');
  assert.ok(body.includes('sink(e.movementX, e.movementY, true)'), 'and it swings');
  // it never touches the camera - it is a sink, not a look handler
  assert.doesNotMatch(body, /cam\.yaw|cam\.pitch/);
});

test('audit24 wave45: the standalone dungeon host keeps its own shape, and it is the correct one', () => {
  // dungeon.js:196-202 - attack, then return, with no mode in the test
  // at all, because nothing else is listening there. It is the
  // reference the two streaming hosts have now been brought to.
  const d = rd('src/scenes/dungeon.js');
  const body = mousemoveBody(d);
  assert.ok(body.includes('(e.buttons & 2)'), 'the RMB test');
  assert.ok(body.includes('ctx.playerAttackInput(e.movementX, e.movementY, true); return;'),
    'attack, then RETURN - the shape');
  assert.doesNotMatch(body, /modeNow\(\)/, 'no mode gate - it has no modal sibling');
  const ret = body.indexOf('return;');
  assert.ok(body.indexOf('cam.yaw -=') > ret, 'and the look is downstream');
});
