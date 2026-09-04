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

import { getBool } from './settings.js';

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
const database = new Map();   // lowercased name -> { key, command }

/** RegisterCommand (:19-27). Both overloads: C# has one taking the
 *  callback second and one taking it last, and both land here. */
export function registerCommand(name, a, b, c) {
  const [description, usage, callback] = typeof a === 'function'
    ? [b ?? '', c ?? '', a]
    : [a ?? '', b ?? '', c];
  const key = String(name).toLowerCase();
  const existing = database.get(key);
  database.set(key, {
    key: existing ? existing.key : name,
    command: makeConsoleCommand(name, description, usage, callback),
  });
}

/** `commands` (:14-17): every command in alphabetical order. C#'s
 *  OrderBy is over the dictionary KEY, which is the name as first
 *  registered. */
export function consoleCommands() {
  return [...database.values()]
    .sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0))
    .map((e) => e.command);
}

/** HasCommand (:70-73). */
export const hasConsoleCommand = (name) => database.has(String(name).toLowerCase());

/** GetCommand (:57-68): the miss UPPERCASES the name before it builds
 *  the message, and the exception carries that uppercased name. */
export function getConsoleCommand(name) {
  if (hasConsoleCommand(name)) return database.get(String(name).toLowerCase()).command;
  const command = String(name).toUpperCase();
  throw new NoSuchCommandError(`Command ${command} not found.`, command);
}

/** TryGetCommand (:44-55). */
export function tryGetConsoleCommand(name) {
  try { return getConsoleCommand(name); } catch (e) {
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
  try { command = getConsoleCommand(name); } catch (e) {
    if (e instanceof NoSuchCommandError) return e.message;
    throw e;
  }
  return command.callback(args);
}

/** Console.Log (Console.cs:14-19): the log line goes to the engine log
 *  AND to every listener the console UI installs. */
const logListeners = new Set();
export function onConsoleLog(fn) { logListeners.add(fn); return () => logListeners.delete(fn); }
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
  consoleLog(answer);
  consoleInputHistory.addNewInputEntry(input);
  return answer;
}

/** THE PORT'S DOOR (the departure above). ConsoleUI.ToggleConsole
 *  refuses to open at all when `LypyL_GameConsole` is off (:51-53), so
 *  the seam answers the same way rather than running the command. */
export function installConsoleProbe(target = globalThis) {
  if (!target) return null;
  const door = (line) => (getBool('Enhancements', 'LypyL_GameConsole')
    ? executeConsoleLine(line)
    : 'the developer console is disabled (Enhancements/LypyL_GameConsole)');
  target.__console = door;
  return door;
}
