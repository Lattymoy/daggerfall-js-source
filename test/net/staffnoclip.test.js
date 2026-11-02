// src/net/staffNoclip.js and src/player/motor.js registerNoclip: /noclip's grammar and who may type it, and the
// levitating step that passes through what it meets while the host's switch answers true.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNoclipCommand, mayNoclip, NOCLIP_GLYPHS, noclipHelpLine } from '../../src/net/staffNoclip.js';
import { STAFF_GLYPHS, isStaff } from '../../src/net/staffCommands.js';
import { createStaffNoclipHost } from '../../src/scenes/staffNoclipHost.js';
import { PlayerMotor, registerNoclip, noclipOn, flySpeedMult } from '../../src/player/motor.js';
import { Collider } from '../../src/player/collider.js';
import { setStaffPowers, staffFly, staffNoclip } from '../../src/characters/playerEntity.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('STAFF-NOCLIP grammar: /noclip flips, takes on|off, refuses anything else; any other line is not its (mutants: the flip unread; a second word taken; another command read as it)', () => {
  assert.deepEqual(parseNoclipCommand('/noclip', false), { cmd: 'noclip', on: true });
  assert.deepEqual(parseNoclipCommand('/noclip', true), { cmd: 'noclip', on: false });
  assert.deepEqual(parseNoclipCommand('/NoClip ON', true), { cmd: 'noclip', on: true });
  assert.deepEqual(parseNoclipCommand('  /noclip off ', true), { cmd: 'noclip', on: false });
  assert.ok('error' in parseNoclipCommand('/noclip maybe'));
  assert.ok('error' in parseNoclipCommand('/noclip on now'));
  for (const line of ['/fly', '/noclipx', 'noclip', '/tp Daggerfall', '']) assert.equal(parseNoclipCommand(line), null, line);
  assert.deepEqual(parseNoclipCommand('/noclip speed 5'), { cmd: 'noclip', speed: 5 });
  assert.deepEqual(parseNoclipCommand('/noclip SPEED 1.5'), { cmd: 'noclip', speed: 1.5 });
  for (const line of ['/noclip speed', '/noclip speed 0', '/noclip speed 21', '/noclip speed fast', '/noclip speed 2 3']) assert.ok('error' in parseNoclipCommand(line), line);
  assert.match(noclipHelpLine(), /^\/noclip \[on\|off\|speed <1-20>\]/);
});

test('STAFF-NOCLIP who may: the staff glyphs and a Moderator\'s `mod`, nobody else (mutants: mod left out; a cosmetic glyph let in)', () => {
  for (const g of STAFF_GLYPHS) assert.ok(mayNoclip([g]), g);
  assert.ok(mayNoclip(['mod']));
  assert.deepEqual([...NOCLIP_GLYPHS].sort(), [...STAFF_GLYPHS, 'mod'].sort());
  for (const g of [[], ['dragonslayer'], null, undefined, 'mod']) assert.equal(mayNoclip(g), false, String(g));
});

test('STAFF-NOCLIP the switch: a no-clip flies too, and is the typer\'s alone (mutants: noclip without the flight)', () => {
  setStaffPowers({ fly: false, noclip: true });
  assert.equal(staffNoclip(), true);
  assert.equal(staffFly(), true, 'the motor-flag writes OR staffFly, so a no-clip levitates');
  setStaffPowers({ noclip: false });
  assert.equal(staffFly(), false);
});

test('STAFF-NOCLIP the motor: a levitating body flies down through the ground only while the switch is on; a switch that throws is off (mutants: the collider still asked; the flag unread)', () => {
  const down = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: true };
  const fly = (on) => {
    registerNoclip(() => on);
    const m = new PlayerMotor(new Collider(() => 0));
    m.pos[1] = 1;
    m.levitating = true;
    for (let i = 0; i < 120; i++) m.update(1 / 60, down, 0);
    return m;
  };
  try {
    const through = fly(true);
    assert.ok(through.pos[1] < -1, `noclip goes under the ground (${through.pos[1]})`);
    assert.equal(through.grounded, false);
    assert.ok(fly(false).pos[1] >= -0.01, 'without it the ground holds');
    registerNoclip(() => { throw new Error('x'); });
    assert.equal(noclipOn(), false);
  } finally {
    registerNoclip(null);
  }
});

test('STAFF-NOCLIP host wiring by source: the chat asks the host before the staff line; the host is made with the service\'s own glyphs; the relay\'s graph file untouched', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const noclipSaid = staffNoclipHost\.chat\(text, chatLog, tabId\);[^\n]*\n\s*if \(noclipSaid != null\) return noclipSaid;\n\s*const staffCmd = isStaffT/);
  assert.match(w, /const staffNoclipHost = createStaffNoclipHost\(staffGlyphs, isStaffT\);/);
  assert.doesNotMatch(rd('src/net/staffCommands.js'), /noclip/i);
});

test('STAFF-NOCLIP the host: a Moderator and staff are asked, anyone else is not; the switch drops with the role (mutants: the role unread; the switch kept)', () => {
  let glyphs = ['mod'];
  const host = createStaffNoclipHost(() => glyphs, isStaff);
  const said = [];
  const log = { push: (tab, l) => said.push([tab, l.text, l.system]) };
  assert.equal(host.chat('/noclip on', log, 7), true);
  assert.equal(staffNoclip(), true);
  assert.equal(noclipOn(), true);
  assert.deepEqual(said[0].slice(0, 1).concat(said[0][2]), [7, true], 'told in the typer\'s tab, as a system line');
  assert.equal(host.chat('/noclip sideways', log, 7), false);
  assert.equal(staffNoclip(), true, 'a refused shape changes nothing');
  assert.equal(host.chat('/tp Daggerfall', log, 7), null, 'a Moderator gets /noclip alone');
  glyphs = [];
  assert.equal(host.chat('/noclip off', log, 7), null, 'nobody else');
  assert.equal(noclipOn(), false, 'the role went, the switch with it');
  assert.equal(staffNoclip(), false);
  glyphs = ['dev'];
  assert.equal(host.chat('/noclip', log, 7), true);
  assert.equal(staffNoclip(), true, 'a bare /noclip flips it on');
  assert.equal(flySpeedMult(), 1, 'the levitating pace until a speed is set');
  assert.equal(host.chat('/noclip speed 8', log, 7), true);
  assert.equal(flySpeedMult(), 8, 'the pace times the speed while on');
  assert.equal(staffNoclip(), true, 'a speed leaves the switch as it was');
  setStaffPowers({ noclip: false });
  assert.equal(flySpeedMult(), 1, 'off: /fly and the spell fly at their own pace');
  registerNoclip(null);
  setStaffPowers({ noclip: false });
});
