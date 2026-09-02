// ROAD-E E3: THE CONSOLE COMMAND DATABASE (Wenzil.Console) and the
// eight map commands that had nowhere to be registered.
//
// Four src/ sites carried a registered console command as a FLAG with
// no database behind it - ExteriorAutomap.cs:1779-1843,
// Automap.cs:2596-2688 and DaggerfallTravelMapWindow.cs:1786-1884 -
// each with its flag live and pinned and its NAME, description, usage,
// gate and answer strings absent. These pins are the database's own law
// (ConsoleCommandsDatabase.cs, ConsoleCommand.cs, HelpCommand.cs,
// ConsoleInputHistory.cs and ConsoleController.ExecuteCommand,
// character for character) and then EACH COMMAND'S EFFECT, run against
// the real flags they set.
//
// The console WINDOW is a recorded departure (Ledger A): DFU's is the
// third-party UnityConsole addon's Unity uGUI prefab, not DFU source.
// The door is installConsoleProbe().

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  registerCommand, consoleCommands, hasConsoleCommand, getConsoleCommand,
  tryGetConsoleCommand, executeConsoleCommand, executeConsoleLine, installConsoleProbe,
  NoSuchCommandError, makeConsoleCommand, ConsoleInputHistory, HELP_COMMAND,
  onConsoleLog,
} from '../src/systems/consoleCommands.js';
import {
  enterDungeonAutomap, exitDungeonAutomap, buildRevealIndex, bindAutomapLayout,
  resetAutomapStore, registerAutomapConsoleCommands, automapDebugTeleportMode,
} from '../src/systems/automap.js';
import { ExteriorAutomapWindow, registerExteriorAutomapConsoleCommands } from '../src/ui/exteriorAutomapWindow.js';
import { registerTravelMapConsoleCommands, revealUndiscoveredLocations } from '../src/ui/travelMapWindow.js';

const src = (f) => readFileSync(join(process.cwd(), f), 'utf8');

/** The window's OWN property, read without building a window: it is an
 *  accessor over the module-level flag, which is where DFU keeps it
 *  (ExteriorAutomap.cs:230-234 is a property on the persistent
 *  component, not on the window that opens over it). */
const revealBuildings = () => Reflect.get(ExteriorAutomapWindow.prototype, 'revealUndiscoveredBuildings', {});

// ── the database (ConsoleCommandsDatabase.cs) ────────────────────────

test('E3 console: ConsoleCommand replaces an empty description and usage with C#s stand-ins', () => {
  const c = makeConsoleCommand('x', '', '   ', () => 'ok');
  assert.equal(c.description, 'No description provided');
  assert.equal(c.usage, 'No usage information provided');
  // ...and leaves a real one exactly as given
  const d = makeConsoleCommand('x', 'a description', 'x [arg]', () => 'ok');
  assert.equal(d.description, 'a description');
  assert.equal(d.usage, 'x [arg]');
});

test('E3 console: the lookup is case-INSENSITIVE and the miss message UPPERCASES the name', () => {
  registerCommand('e3_case', 'd', 'u', () => 'ran');
  assert.equal(hasConsoleCommand('E3_CASE'), true, 'StringComparer.OrdinalIgnoreCase');
  assert.equal(getConsoleCommand('E3_Case').name, 'e3_case', 'the STORED name is the one registered');
  // GetCommand (:57-68): `command = command.ToUpper()` BEFORE the
  // message is built, and the exception carries that uppercased name.
  assert.throws(() => getConsoleCommand('e3_nope'), (e) => {
    assert.ok(e instanceof NoSuchCommandError);
    assert.equal(e.message, 'Command E3_NOPE not found.');
    assert.equal(e.command, 'E3_NOPE');
    return true;
  });
  assert.equal(tryGetConsoleCommand('e3_nope'), null, 'TryGetCommand swallows it');
  // ExecuteCommand answers with that message rather than throwing
  assert.equal(executeConsoleCommand('e3_nope'), 'Command E3_NOPE not found.');
});

test('E3 console: RegisterCommand takes the callback in EITHER position, and commands come back alphabetical', () => {
  registerCommand('e3_zzz', () => 'z', 'zed', 'e3_zzz');   // the callback-second overload (:19-22)
  registerCommand('e3_aaa', 'first', 'e3_aaa', () => 'a');  // the callback-last overload (:24-27)
  assert.equal(executeConsoleCommand('e3_zzz'), 'z');
  assert.equal(getConsoleCommand('e3_zzz').description, 'zed');
  const names = consoleCommands().map((c) => c.name);
  assert.deepEqual([...names].sort(), names, '`commands` is OrderBy(kv => kv.Key)');
  assert.ok(names.includes('e3_aaa') && names.includes('e3_zzz'));
});

test('E3 console: HELP is registered, and both of its outputs are HelpCommand.cs verbatim', () => {
  assert.equal(hasConsoleCommand('help'), true, 'DefaultCommands registers HELP before anything else');
  const c = getConsoleCommand('HELP');
  assert.equal(c.name, 'HELP');
  assert.equal(c.description, 'Display the list of available commands or details about a specific command.');
  assert.equal(c.usage, 'HELP [command]');
  const list = HELP_COMMAND.execute([]);
  assert.ok(list.startsWith('<b>Available Commands</b>\n'));
  assert.ok(list.includes('    <b>HELP</b> - Display the list of available commands or details about a specific command.\n'));
  assert.ok(list.endsWith("To display details about a specific command, type 'HELP' followed by the command name."));
  assert.equal(HELP_COMMAND.execute(['HELP']),
    '<b>HELP Command</b>\n    <b>Description:</b> Display the list of available commands or details about a specific command.\n    <b>Usage:</b> HELP [command]');
  assert.equal(HELP_COMMAND.execute(['nosuch']),
    'Cannot find help information about NOSUCH. Are you sure it is a valid command?');
});

test('E3 console: ExecuteCommand echoes the line, splits on a space and keeps the input history', () => {
  const lines = [];
  const off = onConsoleLog((l) => lines.push(l));
  registerCommand('e3_args', 'd', 'u', (args) => `got:${args.join('|')}`);
  const answer = executeConsoleLine('e3_args one two');
  off();
  assert.equal(answer, 'got:one|two', 'parts[0] is the command, the rest are the arguments');
  assert.deepEqual(lines, ['> e3_args one two', 'got:one|two'], 'Console.Log("> " + input), then the answer');
});

// ── ConsoleInputHistory.cs ───────────────────────────────────────────

test('E3 console: the input history walks DFUs own way, and never holds the same line twice in a row', () => {
  const h = new ConsoleInputHistory(3);
  assert.equal(h.navigate(true), '', 'an empty history answers the empty string');
  h.addNewInputEntry('one');
  h.addNewInputEntry('ONE');   // "Don't add the same input twice in a row", OrdinalIgnoreCase
  assert.deepEqual(h.inputHistory, ['one']);
  h.addNewInputEntry('two');
  h.addNewInputEntry('three');
  assert.deepEqual(h.inputHistory, ['three', 'two', 'one'], 'newest first');
  h.addNewInputEntry('four');
  assert.deepEqual(h.inputHistory, ['four', 'three', 'two'], 'over capacity drops the OLDEST');
  // the first up goes to the go-to entry, the second walks above it
  assert.equal(h.navigate(true), 'four');
  assert.equal(h.navigate(true), 'three');
  assert.equal(h.navigate(false), 'four');
  h.clear();
  assert.deepEqual(h.inputHistory, []);
  assert.equal(h.navigate(true), '');
});

// ── the eight map commands, each command's EFFECT ────────────────────

test('E3 console: map_revealbuildings / map_hidebuildings set the exterior automap flag, with DFUs gate', () => {
  let inside = false;
  registerExteriorAutomapConsoleCommands({ isPlayerInside: () => inside });
  const reveal = getConsoleCommand('map_revealbuildings');
  assert.equal(reveal.description, 'Reveals undiscovered buildings on exterior automap (temporary)');
  assert.equal(reveal.usage, 'map_revealbuildings');
  assert.equal(executeConsoleCommand('map_revealbuildings'),
    'undiscovered buildings have been revealed (temporary) on the exterior automap');
  assert.equal(revealBuildings(), true, 'the window reads what the console set');
  assert.equal(executeConsoleCommand('map_hidebuildings'),
    'undiscovered buildings have been hidden on the exterior automap again');
  assert.equal(revealBuildings(), false);
  // the gate: inside a building or dungeon neither runs
  inside = true;
  assert.equal(executeConsoleCommand('map_revealbuildings'),
    'this command only has an effect when outside and at a location');
  assert.equal(revealBuildings(), false, 'the refused command must not have set the flag');
});

test('E3 console: map_reveallocations / map_hidelocations set the travel-map flag, with DFUs gate', () => {
  let inside = false;
  registerTravelMapConsoleCommands({ isPlayerInside: () => inside, discoverLocation: () => {} });
  assert.equal(getConsoleCommand('map_reveallocations').description,
    'Reveals undiscovered locations on travelmap (temporary)');
  assert.equal(executeConsoleCommand('map_reveallocations'),
    'undiscovered locations have been revealed (temporary) on the travelmap');
  assert.equal(revealUndiscoveredLocations(), true);
  assert.equal(executeConsoleCommand('map_hidelocations'),
    'undiscovered locations have been hidden on the travelmap again');
  assert.equal(revealUndiscoveredLocations(), false);
  inside = true;
  assert.equal(executeConsoleCommand('map_reveallocations'), 'this command only has an effect when outside');
  assert.equal(revealUndiscoveredLocations(), false);
});

test('E3 console: map_reveallocation discovers by name - the underscores, the throw and the HELP fallback', () => {
  const asked = [];
  registerTravelMapConsoleCommands({
    isPlayerInside: () => false,
    discoverLocation: (r, l) => {
      asked.push([r, l]);
      if (l === 'Nowhere') throw new Error(`Error finding location ${r} : ${l}`);
    },
  });
  assert.equal(executeConsoleLine('map_reveallocation Dragontail_Mountains Tulune'),
    'revealed location Dragontail Mountains : Tulune on the travelmap');
  assert.deepEqual(asked, [['Dragontail Mountains', 'Tulune']], 'underscores become spaces in BOTH names');
  assert.equal(executeConsoleCommand('map_reveallocation', ['Daggerfall', 'Nowhere']),
    'Could not reveal location: Error finding location Daggerfall : Nowhere',
    "PlayerGPS.DiscoverLocation's throw is caught and reported, never swallowed");
  // fewer than two arguments: the sentence is LOGGED and the answer is
  // HELP's own details block for this command (:1855-1866)
  const lines = [];
  const off = onConsoleLog((l) => lines.push(l));
  const answer = executeConsoleCommand('map_reveallocation', ['Daggerfall']);
  off();
  assert.deepEqual(lines, ['please provide both a region name as well as a location name']);
  assert.equal(answer, HELP_COMMAND.execute(['map_reveallocation']));
  assert.ok(answer.includes('inside the name strings use underscores instead of spaces, e.g Dragontail_Mountains'));
});

test('E3 console: map_revealall / map_hideall / map_teleportmode over the real automap record', () => {
  resetAutomapStore();
  registerAutomapConsoleCommands();
  // OUTSIDE: the two map verbs refuse, and DebugTeleportMode does NOT
  // (C#'s own asymmetry - it has no IsPlayerInside gate).
  assert.equal(executeConsoleCommand('map_revealall'), 'this command only has an effect when inside a dungeon');
  assert.equal(executeConsoleCommand('map_hideall'), 'this command only has an effect when inside a dungeon');
  assert.equal(executeConsoleCommand('map_teleportmode'), 'Automap instance not found');
  // INSIDE, but with no geometry bound yet: Automap.instance is null
  const rec = enterDungeonAutomap('0/console', 0);
  assert.equal(executeConsoleCommand('map_revealall'), 'Automap instance not found');
  // INSIDE with the geometry bound: the record really is revealed
  const model = buildRevealIndex([
    { key: 'a', aabb: [0, -0.5, 0, 10, 0.1, 10] },
    { key: 'b', aabb: [0, -0.5, 10, 10, 0.1, 20] },
  ]);
  bindAutomapLayout(rec, model);
  assert.equal(executeConsoleCommand('map_revealall'), 'dungeon has been completely revealed on the automap');
  assert.deepEqual([...rec.revealed].sort(), ['a', 'b']);
  assert.equal(rec.entranceDiscovered, true);
  assert.equal(executeConsoleCommand('map_hideall'), 'hide complete on automap');
  assert.equal(rec.revealed.size, 0);
  assert.equal(rec.entranceDiscovered, false);
  assert.deepEqual([...rec.visitedThisRun].sort(), ['a', 'b'], 'HideAll does not touch the grayscale keyword');
  // the toggle answers both ways and really moves the flag
  const was = automapDebugTeleportMode();
  const said = executeConsoleCommand('map_teleportmode');
  assert.equal(automapDebugTeleportMode(), !was);
  assert.equal(said, automapDebugTeleportMode() ? 'debug teleport mode has been enabled' : 'debug teleport mode has been disabled');
  executeConsoleCommand('map_teleportmode');
  assert.equal(automapDebugTeleportMode(), was, 'and back');
  // leaving takes Automap.instance with it
  exitDungeonAutomap();
  assert.equal(executeConsoleCommand('map_teleportmode'), 'Automap instance not found');
  resetAutomapStore();
});

// ── the door, and the wiring ─────────────────────────────────────────

test('E3 console: the door honours LypyL_GameConsole and runs the whole submit law', () => {
  registerCommand('e3_door', 'd', 'u', () => 'through');
  const target = {};
  const door = installConsoleProbe(target);
  assert.equal(typeof target.__console, 'function');
  // the settings default is True (settingsDefaults.js), so the door runs
  assert.equal(door('e3_door'), 'through');
});

test('E3 console: the wiring - every host with a registering surface registers, and every host has the door', () => {
  // ExteriorAutomap.Start (:417) and the travel window's ctor (:229) -
  // the two hosts that own those windows.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.ok(src(f).includes('registerExteriorAutomapConsoleCommands({ isPlayerInside:'),
      `${f}: the exterior automap's two verbs are never registered`);
  }
  assert.ok(src('src/scenes/world.js').includes('registerTravelMapConsoleCommands({'),
    'world.js owns the travel map and must register its three');
  // Automap.Start (:969) - both arms of the one component
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/interiorContext.js']) {
    assert.ok(src(f).includes('registerAutomapConsoleCommands();'), `${f}: the automap's three verbs`);
  }
  // ...and the door, in every scene host (a static class in DFU is
  // reachable from every scene; the port's door has to be too)
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeon.js', 'src/scenes/interior.js']) {
    assert.ok(src(f).includes('installConsoleProbe();'), `${f}: no console door`);
  }
  // the departure is declared where it lives, and the Ledger names the
  // file (test/doctrine.test.js enforces the second half)
  assert.match(src('src/systems/consoleCommands.js'), /DEPARTURE - THE CONSOLE WINDOW ITSELF \(Ledger A\)/);
});
