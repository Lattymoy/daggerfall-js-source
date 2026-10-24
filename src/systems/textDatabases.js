// L10N3f (2026-09-28): DFU'S TEXT DATABASES, READ FROM A TRANSLATION PACK. Beside its string tables DFU keeps a few
// words in Table-format text files under StreamingAssets/Text - `schema: *key,text`, one `key, text` row a line, '-'
// comments (Utility/Table.cs) - and TextManager reads every one of them at startup, a database by its file name
// (EnumerateTextDatabases, TextManager.cs:690-720):
//   DialogShortcuts   the dialog buttons' hotkeys (DaggerfallShortcut.cs:9, :307-326) - in French, Yes is O
//   GameSettings      the settings and controls windows' words (DaggerfallControlsWindow.cs:426-429,
//                     DaggerfallJoystickControlsWindow.cs:604-607, DaggerfallAdvancedSettingsWindow.cs:791-794)
//   MainMenu          the setup wizard's and the folder browser's (DaggerfallUnitySetupGameWizard.cs:738-741,
//                     FolderBrowser.cs:171)
//   ModSystem         the mod windows' (ModManager.GetText, ModManager.cs:1169-1172)
//   mod_<FileName>    a mod's own words, asked first by Mod.TryLocalize (Mod.cs:584-602)
// A pack installs its own copy over DFU's, so its file IS the database: a key it lacks is not there (DFU's GetText
// answers "<TextError-NotFound>").
//
// The port's English is not a file: the words a window shows are constants in its code, as the string tables' are,
// so English reads no database and is byte for byte what the window drew. A language whose pack carries the file
// reads it (the text core's documents, PACK_KIND.TEXT_TABLE, walked along the locale's chain) - `databaseText` answers
// the pack's row, else the English it is handed. That fallback is the text core's law (localizedText), not DFU's error
// string: a pack older than a key shows the English word, not "<TextError-NotFound>" (Ledger A, THE PORT'S LOCALES).

import { localeDocument } from './textManager.js';
import { PACK_KIND } from './translationPacks.js';
import { Table } from './quest/table.js';   // Utility/Table.cs, the one port of it (read-only here)

/** TextManager.GetText's answer for a database or key it does not hold (TextManager.cs:248-249). */
export const TEXT_NOT_FOUND = '<TextError-NotFound>';
/** The column GetText reads (TextManager.cs:47, textColumn). */
export const TEXT_COLUMN = 'text';

// A database is parsed once per text: the cache is keyed by the document itself, so a pack installed, replaced or
// removed, or a locale switched, reads the new file - and nothing is kept for a text no longer asked for past a few.
const _parsed = new Map();   // document text -> Table | null (a file that would not parse)
function parseDatabase(name, text) {
  if (_parsed.has(text)) return _parsed.get(text);
  let table = null;
  try { table = new Table(text); } catch (err) {
    // EnumerateTextDatabases' catch (:714-718): said, and the file is no database.
    console.log(`TextManager unable to parse text database table ${name} with exception message ${err?.message ?? err}`);
  }
  if (_parsed.size >= 32) _parsed.clear();
  _parsed.set(text, table);
  return table;
}

/** The current language's database `name` - its pack's `Text/<name>.txt` as a Table - or null: English, a language
 *  whose pack has no such file, or a file that will not parse. */
export function textDatabase(name) {
  const text = localeDocument(PACK_KIND.TEXT_TABLE, name);
  return text == null ? null : parseDatabase(name, text);
}

/** HasDatabase (TextManager.cs:220-223). */
export const hasDatabase = (name) => textDatabase(name) != null;

/** HasText (TextManager.cs:231-237): the database and its key. A database without a `text` column holds no text - DFU
 *  would throw at GetValue; a draw never throws here. */
export function hasText(name, key) {
  const table = textDatabase(name);
  return !!table && table.hasColumn(TEXT_COLUMN) && table.hasValue(String(key));
}

/** GetText (TextManager.cs:245-252): the row's text, or TEXT_NOT_FOUND. */
export const getText = (name, key) => (hasText(name, key) ? textDatabase(name).getValue(TEXT_COLUMN, String(key)) : TEXT_NOT_FOUND);

/** The port's reading of GetText where DFU shows a database's word: the pack's row, else `en` - the English the port
 *  holds for DFU's row, byte for byte. */
export const databaseText = (name, key, en) => (hasText(name, key) ? getText(name, key) : en);

/** GameSettings' word for `key` (the settings and controls windows' GetText, `textTable = "GameSettings"`). */
export const gameSettingsText = (key, en) => databaseText('GameSettings', key, en);
