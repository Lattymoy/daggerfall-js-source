// ROAD-E E3 - THE CONSOLE COMMAND DATABASE (Wenzil.Console).
//
// Four `src/` sites had registered console commands with nowhere to
// register them: ExteriorAutomap.cs:1779-1843's map_revealbuildings /
// map_hidebuildings, Automap.cs:2596-2688's map_revealall /
// map_hideall / map_teleportmode, and DaggerfallTravelMapWindow.cs
// :1788-1884's map_reveallocations / map_hidelocations /
// map_reveallocation. Each flag they set was already live and pinned;
// what was missing was the database they hang off, so no command could
// be NAMED, described, argument-parsed or run.
//
// This is that database, ported from the reference tree's own copy:
// `Assets/Game/Addons/UnityConsole/Console/Scripts/` -
// ConsoleCommandsDatabase.cs, ConsoleCommand.cs,
// NoSuchCommandException.cs, Console.cs, ConsoleInputHistory.cs,
// Commands/HelpCommand.cs, and ConsoleController.ExecuteCommand.
// Every string below is that source's, character for character,
// including the `<b>` rich-text tags HelpCommand writes (Unity's Text
// renders them; the port's door hands them on unchanged rather than
// inventing a formatting law DFU does not have).
//
// DEPARTURE - THE CONSOLE WINDOW ITSELF (Ledger A).
// The console's UI is not DFU source. ConsoleUI.cs / ConsoleController
// .cs are the third-party Wenzil UnityConsole addon under
// `Assets/Game/Addons/`, and they are a Unity uGUI front end: an
// InputField, a ScrollRect, a Scrollbar and a Text laid out in a
// PREFAB that is not in the reference tree at all, driven by
// EventSystem selection state (`EventSystem.current.alreadySelecting`),
// CanvasGroup raycast blocking and Unity's own text-mesh length cap
// (maxOutputLength 12000). There is nothing there to port 1:1 - a
// window drawn in the port's own idiom would be the port's design, not
// DFU's - so the WINDOW is recorded as a departure and the DATABASE
// ships whole. The door is `installConsoleProbe()`, the port's own
// global console seam, which every host mounts beside its other
// developer verbs; it carries ConsoleController.ExecuteCommand's law
// (the split, the "> " echo, the input history) so what a player would
// have typed is exactly what runs.
//
// What DOES ride the window in DFU and therefore rides the door here:
// `DaggerfallUnity.Settings.LypyL_GameConsole` (ConsoleUI.ToggleConsole
// :51-53) - the console is refused when the setting is off.

import { getBool } from './settings/settings.js';
import { staffPowers, setStaffPowers, playerEntity, surfacePlayer, forcePlayerDeath } from '../characters/playerEntity.js';
import { addGoldPieces } from './inventory.js';
import { MOBILE_TYPES } from '../characters/mobile/mobileTypes.js';

let _sceneContext = null;
/** Register active scene debug context (player control, enemy pools, travel). */
export function setDebugSceneContext(ctx) {
  _sceneContext = ctx;
}
export function getDebugSceneContext() {
  return _sceneContext;
}

/** ConsoleCommand's ctor (ConsoleCommand.cs:12-18): an empty or
 *  all-whitespace description/usage is replaced by the stand-in. */
export function makeConsoleCommand(name, description, usage, callback) {
  return Object.freeze({
    name,
    description: String(description ?? '').trim() === '' ? 'No description provided' : description,
    usage: String(usage ?? '').trim() === '' ? 'No usage information provided' : usage,
    callback,
  });
}

/** NoSuchCommandException (NoSuchCommandException.cs): carries the
 *  command it could not find, which HelpCommand's catch reads. */
export class NoSuchCommandError extends Error {
  constructor(message, command) {
    super(message);
    this.name = 'NoSuchCommandError';
    this.command = command;
  }
}

// `new Dictionary<string, ConsoleCommand>(StringComparer
// .OrdinalIgnoreCase)` - the lookup is case-insensitive, and the KEY
// the ordering reads is the one the first registration stored (C#'s
// indexer replaces the value and keeps the key).
const database = new Map(); // lowercased name -> { key, command }

/** RegisterCommand (:19-27). Both overloads: C# has one taking the
 *  callback second and one taking it last, and both land here. */
export function registerCommand(name, a, b, c) {
  const [description, usage, callback] = typeof a === 'function' ? [b ?? '', c ?? '', a] : [a ?? '', b ?? '', c];
  const key = String(name).toLowerCase();
  const existing = database.get(key);
  database.set(key, {
    key: existing ? existing.key : name,
    command: makeConsoleCommand(name, description, usage, callback),
    present: existing?.present ?? null,
  });
}

/** AUDIT 28 F7: A MOD'S COMMAND IS THERE ONLY WHILE THE MOD IS. DFU registers a mod's commands when the mod loads, so
 *  a mod switched off has none - no HELP line, no HasCommand, and "Command X not found." to its name. The port installs
 *  its mods once and switches them live, so the registration stays and `present` answers whether it is there now. */
export function gateConsoleCommand(name, present) {
  const e = database.get(String(name).toLowerCase());
  if (e) e.present = typeof present === 'function' ? present : null;
}
const isPresent = (e) => !!e && (e.present == null || !!e.present());

/** `commands` (:14-17): every command in alphabetical order. C#'s
 *  OrderBy is over the dictionary KEY, which is the name as first
 *  registered. */
export function consoleCommands() {
  return [...database.values()]
    .filter(isPresent)
    .sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0))
    .map((e) => e.command);
}

/** HasCommand (:70-73). */
export const hasConsoleCommand = (name) => isPresent(database.get(String(name).toLowerCase()));

/** GetCommand (:57-68): the miss UPPERCASES the name before it builds
 *  the message, and the exception carries that uppercased name. */
export function getConsoleCommand(name) {
  if (hasConsoleCommand(name)) return database.get(String(name).toLowerCase()).command;
  const command = String(name).toUpperCase();
  throw new NoSuchCommandError(`Command ${command} not found.`, command);
}

/** TryGetCommand (:44-55). */
export function tryGetConsoleCommand(name) {
  try {
    return getConsoleCommand(name);
  } catch (e) {
    if (e instanceof NoSuchCommandError) return null;
    throw e;
  }
}

/** ExecuteCommand (:29-42): the callback's answer, or the exception's
 *  own message for a command that does not exist. ONLY
 *  NoSuchCommandException is caught - an exception thrown inside a
 *  command's callback propagates, exactly as it does in C#. */
export function executeConsoleCommand(name, args = []) {
  let command;
  try {
    command = getConsoleCommand(name);
  } catch (e) {
    if (e instanceof NoSuchCommandError) return e.message;
    throw e;
  }
  return command.callback(args);
}

/** Console.Log (Console.cs:14-19): the log line goes to the engine log
 *  AND to every listener the console UI installs. */
const logListeners = new Set();
export function onConsoleLog(fn) {
  logListeners.add(fn);
  return () => logListeners.delete(fn);
}
export function consoleLog(line) {
  console.log(line);
  for (const fn of logListeners) fn(line);
}

/** HelpCommand (Commands/HelpCommand.cs), whole. */
export const HELP_COMMAND = Object.freeze({
  name: 'HELP',
  description: 'Display the list of available commands or details about a specific command.',
  usage: 'HELP [command]',
  execute: (args = []) => (args.length === 0 ? displayAvailableCommands() : displayCommandDetails(args[0])),
});

/** DisplayAvailableCommands (:31-42). */
function displayAvailableCommands() {
  let commandList = '<b>Available Commands</b>\n';
  for (const command of consoleCommands()) commandList += `    <b>${command.name}</b> - ${command.description}\n`;
  commandList += "To display details about a specific command, type 'HELP' followed by the command name.";
  return commandList;
}

/** DisplayCommandDetails (:44-61), the verbatim three-line template. */
function displayCommandDetails(commandName) {
  try {
    const command = getConsoleCommand(commandName);
    return `<b>${command.name} Command</b>\n    <b>Description:</b> ${command.description}\n    <b>Usage:</b> ${command.usage}`;
  } catch (e) {
    if (!(e instanceof NoSuchCommandError)) throw e;
    return `Cannot find help information about ${e.command}. Are you sure it is a valid command?`;
  }
}

// DefaultCommands.Start (:35) registers HELP before anything else can
// run. The other ~50 rows of that file are DFU's debug commands, whose
// subjects this port either has no counterpart for or reaches through
// its own probe surface; HELP's subject is the database itself, so it
// registers here, with it.
registerCommand(HELP_COMMAND.name, HELP_COMMAND.description, HELP_COMMAND.usage, HELP_COMMAND.execute);

// Base debug commands for testing mods and quests
registerCommand(
  'tgm',
  'Toggle God Mode (invulnerability)',
  'tgm',
  () => {
    const current = staffPowers().god;
    const next = !current;
    setStaffPowers({ god: next });
    if (next && playerEntity) {
      playerEntity.health = playerEntity.maxHealth ?? playerEntity.health;
    }
    surfacePlayer?.();
    return `God Mode: ${next ? 'ON' : 'OFF'}`;
  }
);

registerCommand(
  'killall',
  'Kill all hostile mobs in scene',
  'killall',
  () => {
    const ctx = getDebugSceneContext();
    if (ctx?.killAllFoes) {
      const count = ctx.killAllFoes();
      return count > 0 ? `Killed ${count} hostile entities.` : 'No hostile entities found.';
    }
    return 'No active enemy pool found in current scene.';
  }
);

registerCommand(
  'addgold',
  'Add gold to inventory',
  'addgold <count>',
  (args = []) => {
    if (!args || !args.length) return 'Usage: addgold <count>';
    const count = parseInt(args[0], 10);
    if (Number.isNaN(count)) return 'Usage: addgold <count>';
    addGoldPieces(playerEntity, count);
    surfacePlayer?.();
    return `Added ${count} gold. (Total: ${playerEntity.goldPieces ?? 0})`;
  }
);

registerCommand(
  'teleport',
  'Teleport player to coordinates (x, y, z)',
  'teleport <x> <y> <z>',
  (args = []) => {
    if (!args || args.length < 3) return 'Usage: teleport <x> <y> <z>';
    const x = Number(args[0]), y = Number(args[1]), z = Number(args[2]);
    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) return 'Usage: teleport <x> <y> <z>';
    const ctx = getDebugSceneContext();
    if (!ctx?.setPlayerPos) return 'Cannot teleport: player position setter unavailable in current scene.';
    ctx.setPlayerPos(x, y, z);
    return `Teleported to ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`;
  }
);

registerCommand(
  'tele2loc',
  'Teleport player to named location',
  'tele2loc <locationName>',
  async (args = []) => {
    if (!args || !args.length) return 'Usage: tele2loc <locationName>';
    const locName = args.join(' ').trim();
    const ctx = getDebugSceneContext();
    if (!ctx?.tele2loc) return 'tele2loc is only available in world mode.';
    return await ctx.tele2loc(locName);
  }
);

registerCommand(
  'kill',
  'Kill player character (suicide / self-kill)',
  'kill',
  () => {
    setStaffPowers({ god: false });
    const died = forcePlayerDeath(playerEntity);
    return died ? 'Player killed.' : 'Player is already dead.';
  }
);

registerCommand(
  'suicide',
  'Kill player character (suicide / self-kill)',
  'suicide',
  () => {
    const cmd = getConsoleCommand('kill');
    return cmd.callback();
  }
);

registerCommand(
  'killme',
  'Kill player character (suicide / self-kill)',
  'killme',
  () => {
    const cmd = getConsoleCommand('kill');
    return cmd.callback();
  }
);

/**
 * Resolve enemy ID and canonical name from numeric ID or string name.
 */
export function resolveMobileType(arg) {
  if (arg == null || arg === '') return null;
  const num = parseInt(arg, 10);
  if (!Number.isNaN(num)) {
    const entry = Object.entries(MOBILE_TYPES).find(([, id]) => id === num);
    if (entry) return { id: num, name: entry[0] };
    if (num >= 0 && num <= 42) return { id: num, name: `Monster_${num}` };
    if (num >= 128 && num <= 146) return { id: num, name: `Class_${num}` };
    return null;
  }
  const clean = String(arg).toLowerCase().replace(/[\s_-]/g, '');
  if (clean === 'skeleton') return { id: 15, name: 'SkeletalWarrior' };
  if (clean === 'bear') return { id: 4, name: 'GrizzlyBear' };
  if (clean === 'bat') return { id: 3, name: 'GiantBat' };
  if (clean === 'tiger') return { id: 5, name: 'SabertoothTiger' };
  if (clean === 'scorpion') return { id: 20, name: 'GiantScorpion' };
  if (clean === 'guard') return { id: 146, name: 'Knight_CityWatch' };
  for (const [name, id] of Object.entries(MOBILE_TYPES)) {
    if (name.toLowerCase().replace(/[\s_-]/g, '') === clean) {
      return { id, name };
    }
  }
  return null;
}

registerCommand(
  'spawnfoe',
  'Spawn mob near player: spawnfoe <id|name> [count]',
  'spawnfoe <id|name> [count]',
  async (args = []) => {
    if (!args || !args.length) return 'Usage: spawnfoe <id|name> [count]';
    const mob = resolveMobileType(args[0]);
    if (!mob) return `Unknown mob "${args[0]}". Use mobile ID (0..42, 128..146) or name (e.g. rat, skeleton, lich). Type 'spawnlist' for all IDs.`;
    const count = args[1] ? Math.max(1, Math.min(20, parseInt(args[1], 10) || 1)) : 1;
    const ctx = getDebugSceneContext();
    if (!ctx?.spawnFoe) return 'Enemy spawning is unavailable in current scene.';
    const spawned = await ctx.spawnFoe(mob.id, count);
    return spawned > 0
      ? `Spawned ${spawned}x ${mob.name} (ID: ${mob.id}) near player.`
      : `Failed to spawn ${mob.name} (ID: ${mob.id}).`;
  }
);

registerCommand(
  'spawn',
  'Spawn mob near player: spawn <id|name> [count]',
  'spawn <id|name> [count]',
  async (args = []) => {
    const cmd = getConsoleCommand('spawnfoe');
    return await cmd.callback(args);
  }
);

registerCommand(
  'spawnlist',
  'List available mob IDs and names',
  'spawnlist',
  () => {
    const monsters = [];
    const classes = [];
    for (const [name, id] of Object.entries(MOBILE_TYPES)) {
      if (id <= 42) monsters.push(`${id}: ${name}`);
      else if (id >= 128 && id <= 146) classes.push(`${id}: ${name}`);
    }
    return `<b>Monsters (0..42):</b>\n${monsters.join(', ')}\n\n<b>Classes (128..146):</b>\n${classes.join(', ')}`;
  }
);

/** ConsoleInputHistory (ConsoleInputHistory.cs), whole - the up/down
 *  walk with its go-to-entry bookkeeping, at ConsoleController's own
 *  capacity (`inputHistoryCapacity = 20`, :17). */
export class ConsoleInputHistory {
  constructor(maxCapacity = 20) {
    this.inputHistory = [];
    this.maxCapacity = maxCapacity;
    this.currentInput = 0;
    this.isNavigating = false;
  }

  /** Navigate (:31-51): the first up goes to the go-to entry, a second
   *  up walks ABOVE it, a down walks below - and the down arm runs
   *  even on the first navigation, which is C#'s own shape (the `if`
   *  is `else if (up)` but the down decrement is unconditional). */
  navigate(up) {
    const down = !up;
    if (!this.isNavigating) this.isNavigating = (up && this.inputHistory.length > 0) || (down && this.currentInput > 0);
    else if (up) this.currentInput++;
    if (down) this.currentInput--;
    this.currentInput = clamp(this.currentInput, 0, this.inputHistory.length - 1);
    return this.isNavigating ? this.inputHistory[this.currentInput] : '';
  }

  /** AddNewInputEntry (:53-82). */
  addNewInputEntry(input) {
    this.isNavigating = false;
    if (this.inputHistory.length > 0 && equalsIgnoreCase(input, this.inputHistory[0])) return;
    if (this.inputHistory.length === this.maxCapacity) this.inputHistory.splice(this.maxCapacity - 1, 1);
    this.inputHistory.unshift(input);
    if (this.currentInput === this.maxCapacity - 1) this.currentInput = 0;
    else this.currentInput = clamp(this.currentInput + 1, 0, this.inputHistory.length - 1);
    if (!equalsIgnoreCase(input, this.inputHistory[this.currentInput])) this.currentInput = 0;
  }

  clear() {
    this.inputHistory.length = 0;
    this.currentInput = 0;
    this.isNavigating = false;
  }
}

// Mathf.Clamp over an EMPTY history clamps to (0, -1), whose C# answer
// is the MAX - so an empty history walks to -1 and `isNavigating` is
// what keeps it from being read.
const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
const equalsIgnoreCase = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/** The session's history - one console, one history, as
 *  ConsoleController's single instance field is. */
export const consoleInputHistory = new ConsoleInputHistory();

/** ConsoleController.ExecuteCommand (:71-81): the whole submit law -
 *  split on a space, the first token is the command and the rest are
 *  the arguments, the input is echoed with "> ", the answer is logged,
 *  and the line joins the history. Returns the answer so the port's
 *  door can hand it to a caller that is not a text window. */
export function executeConsoleLine(input) {
  const parts = String(input).split(' ');
  const command = parts[0];
  const args = parts.slice(1);
  consoleLog(`> ${input}`);
  const answer = executeConsoleCommand(command, args);
  if (answer && typeof answer.then === 'function') {
    consoleInputHistory.addNewInputEntry(input);
    return answer.then((res) => {
      consoleLog(res);
      return res;
    }).catch((err) => {
      const msg = `Error: ${err?.message ?? err}`;
      consoleLog(msg);
      return msg;
    });
  }
  consoleLog(answer);
  consoleInputHistory.addNewInputEntry(input);
  return answer;
}

/** THE PORT'S DOOR (the departure above). ConsoleUI.ToggleConsole
 *  refuses to open at all when `LypyL_GameConsole` is off (:51-53), so
 *  the seam answers the same way rather than running the command. */
export function installConsoleProbe(target = globalThis) {
  if (!target) return null;
  const door = (line) =>
    getBool('Enhancements', 'LypyL_GameConsole')
      ? executeConsoleLine(line)
      : 'the developer console is disabled (Enhancements/LypyL_GameConsole)';
  target.__console = door;
  if (typeof window !== 'undefined') {
    import('../ui/debugConsole.js').then((m) => m.installDebugConsole?.()).catch(() => {});
  }
  return door;
}
