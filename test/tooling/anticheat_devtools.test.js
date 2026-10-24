// AUDIT ANTICHEAT (2026-10-17; #955 picked up) - THE INSTALLED GAME KEEPS ITS DEVTOOLS. Mac's call.
//
// #955 mounted View > Toggle Developer Tools in an unpackaged shell alone, as an anti-cheat. The audit weighed it:
// the browser build plays online with F12 one key away, and the installed shell still honours Chromium's
// --remote-debugging-port, so taking the row away shuts no door a cheater needs - while the console is how a player
// hands over a field report's lines (bible/01-Overview/bugs/Field-Bugs-2026-10-13b.md asks for them there). What
// other players meet is the servers' to judge (bible/06-Systems/Integrity-Arc.md). A change that takes DevTools away
// on purpose edits these pins, that record's instruction and the Audit-Log's line in the same change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { codeOnly } from '../codeOnly.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('AUDIT ANTICHEAT: the View menu carries Toggle Developer Tools on every build, packaged or not', () => {
  const main = rd('app/main.cjs');
  const at = main.indexOf('function buildMenu() {');
  assert.ok(at > 0, 'buildMenu is where the menu is built');
  const menu = codeOnly(main.slice(at, main.indexOf('\n}\n', at)));
  assert.equal(menu.match(/^\s*\{ role: 'toggleDevTools' \},$/gm)?.length ?? 0, 1, 'the row stands as a row of its own, under no condition');
  assert.doesNotMatch(menu, /isPackaged/, 'nothing in the menu asks whether the shell is installed');
  for (const prefs of main.match(/webPreferences: \{[^}]*\}/g) ?? []) {
    assert.doesNotMatch(prefs, /devTools\s*:/, 'and no window is built with its DevTools turned off');
  }
});

test('AUDIT ANTICHEAT: the field record that asks a player for the console still finds it where it says', () => {
  const record = rd('bible/01-Overview/bugs/Field-Bugs-2026-10-13b.md');
  assert.match(record, /\(the desktop app: View,\s+Toggle Developer Tools, Console\)/);
});
