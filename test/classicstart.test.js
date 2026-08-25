// U31: THE CLASSIC START CAN BE LEFT.
//
// The bug: the bare-URL start booted scenes/dungeon.js, a standalone
// scene whose only activation arm is `ctx.actions.activate` - there is
// no exit branch in the file at all. So a new character opened their
// eyes in Privateer's Hold and could never reach Tamriel. The complete
// dungeon->exterior transition existed the whole time, in the WORLD
// host, which the classic start never booted.
//
// These pins hold the routing. The live proof that a player can walk
// out is tools/classicStartProbe.mjs, which stands at the real exit
// door and makes the same activation a player makes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIVE, DEFAULTS } from '../src/systems/settings.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => readFileSync(join(root, 'src', f), 'utf8');

test('U31: the classic start boots the WORLD host, not the exitless dungeon scene', () => {
  const main = src('main.js');
  // The last route in boot() - the one the menu hands off to - is the
  // classic start. It must reach bootWorld carrying the classic flag.
  const tail = main.slice(main.lastIndexOf('runMenu'));
  assert.match(tail, /params\.set\('classic', '1'\)/, 'the classic start must ask for the classic start path');
  assert.match(tail, /return bootWorld\(canvas, renderer, params, status\)/, 'the classic start must boot the world host');
  assert.ok(!/return bootDungeon\(canvas, renderer, params, status\);\s*$/.test(main.trimEnd()),
    'the classic start must not fall back into the standalone dungeon scene');

  // THE REGRESSION ITSELF: scenes/dungeon.js still has no way out, so
  // it must never be what a new game boots. If someone ever gives it
  // an exit this pin should be revisited deliberately, not silently.
  const dungeonScene = src('scenes/dungeon.js');
  assert.ok(!/tryExitDungeon|exitDoors/.test(dungeonScene),
    'scenes/dungeon.js has gained an exit - re-examine whether it may host the classic start');

  // The dev and probe routes are UNCHANGED: 25 probes in tools/ drive
  // ?shot and ?nomenu into the dungeon scene, and ?dungeon=<name> is
  // the named-dungeon dev boot.
  //
  // THE ASSERTION IS THE ROUTE, NOT ITS PUNCTUATION. These two pinned
  // the exact one-line form and went red when the enhanced front door
  // gave every path an explicit `await ensureData()` - the routing was
  // untouched and the pin was describing the line rather than the law
  // (the shape AUDIT 24 corrected four pins for). What must hold is
  // that each param still reaches bootDungeon and nothing else.
  assert.match(main, /params\.has\('dungeon'\)\)[^\n]*bootDungeon\(canvas, renderer, params, status\)/);
  assert.match(main, /params\.has\('shot'\) \|\| params\.has\('nomenu'\)\)[^\n]*bootDungeon\(canvas, renderer, params, status\)/);
});

test('U31: the start cell comes from settings, and starting inside is gated the way DFU gates it', () => {
  const world = src('scenes/world.js');
  // StartGameBehaviour.cs:371 reads the cell out of settings rather
  // than resolving a location by name.
  assert.match(world, /getInt\('Startup', 'StartCellX'\)/, "the start cell's X must come from the store");
  assert.match(world, /getInt\('Startup', 'StartCellY'\)/, "the start cell's Y must come from the store");
  assert.match(world, /getBool\('Startup', 'StartInDungeon'\)/, 'starting inside must be the real setting');
  // :392 gates on BOTH the setting and the location really having one
  assert.match(world, /getBool\('Startup', 'StartInDungeon'\) && startLoc\.hasDungeon/,
    'DFU gates start-in-dungeon on hasDungeon too - a cell with no dungeon must start outside');
  // NEVER TRAPS: neither miss may strand the player
  assert.match(world, /falling back to \$\{regionName\}\/\$\{locationName\}/, 'an empty start cell must fall back, not throw');
  assert.match(world, /no dungeon entrance at the start cell; starting outside/, 'a missing entrance must leave the player outside, and say so');

  // DFU's own shipped start cell, carried by the vendored defaults.ini:
  // 109,158 is Privateer's Hold. Verified against MAPS.BSA - the
  // location really does resolve at that pixel.
  assert.equal(DEFAULTS.Startup.StartCellX, '109');
  assert.equal(DEFAULTS.Startup.StartCellY, '158');
  assert.equal(DEFAULTS.Startup.StartInDungeon, 'True');
});

test('U31: startInDungeon routes through tryEnterDungeon, which is what makes the dungeon exitable', () => {
  const modes = src('scenes/worldModes.js');
  assert.match(modes, /async function startInDungeon\(\)/, 'the world host needs a start-inside entry point');
  // The whole point: it must REUSE tryEnterDungeon rather than repeat
  // its body, because tryEnterDungeon is what records dungeonReturn -
  // the entrance-door candidates tryExitDungeon computes its landing
  // from. A copied body that skipped that would enter fine and strand
  // the player exactly as before.
  const body = modes.slice(modes.indexOf('async function startInDungeon()'));
  const fnEnd = body.indexOf('\n  }');
  assert.match(body.slice(0, fnEnd), /return tryEnterDungeon\(hit, entries\)/,
    'starting inside must go through the same door path that records dungeonReturn');
  assert.match(modes, /dungeonReturn = \{/, 'the exit landing still depends on dungeonReturn being recorded');
  // and it is on the API the host calls
  assert.match(modes, /^\s{4}startInDungeon,$/m, 'startInDungeon must be exposed to the host');
});

test('U31: the three start keys are LIVE, naming the file that really reads them', () => {
  for (const k of ['Startup/StartCellX', 'Startup/StartCellY', 'Startup/StartInDungeon']) {
    assert.equal(LIVE[k], 'src/scenes/world.js', `${k} must be tiered live at its real consumer`);
  }
  // the named consumer really does import the store (the tier map has
  // lied twice before - once naming a file that never imported it)
  assert.match(src('scenes/world.js'), /from '\.\.\/systems\/settings\.js'/);
});
