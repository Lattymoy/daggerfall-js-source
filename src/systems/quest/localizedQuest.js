// L10N3c (2026-09-27): A QUEST IN A TRANSLATION'S OWN WORDS. DFU keeps a translation's quest text in a "-LOC" file
// beside the quest's own - `S0000977-LOC.txt`, the quest's header and its QRC messages, no logic - and reads it three
// times:
//   - ParseQuest (QuestMachine.cs:670-687): ParseLocalizedQuestText (:1648-1730) parses the -LOC file with the cut-down
//     Parser.ParseLocalized (Parser.cs:174-285), adds each message to the Internal_Quests string table as
//     `QUEST.messageId` - only where the table has no entry yet - and the quest takes the file's DisplayName;
//   - GetMessage (Quest.cs:666-684): the message is looked up there by `QUEST.messageId` and, when found, re-read into the
//     same Message (ReplaceMessage), every time it is asked for;
//   - a save loading (RestoreLocalizedQuestMessages, :692-697) parses the file again, so a restored quest speaks too.
// The port's -LOC file is the one the player's pack holds (the text core's documents, L10N3b); its messages go into the
// current locale's Internal_Quests, as DFU's into its selected one. English has no -LOC file, so nothing here ever
// speaks for it: its quests read their own source, byte for byte.

import { localeDocument, localeTable, tryGetLocalizedText, runtimeCollectionName, currentLocale, textRevision, TextCollections } from '../textManager.js';
import { staticMessagesTable } from './tables.js';
import { splitField, getFieldStringValue } from './parseUtils.js';

/** The kind a pack's -LOC quest is kept under (systems/translationPacks.js PACK_KIND.QUEST). */
export const QUEST_DOCUMENT = 'quest';
const startsWithCI = (text, prefix) => text.slice(0, prefix.length).toLowerCase() === prefix;

/** PeekMessageEnd (Parser.cs): a message ends at the stream's end, a header or tag line (a ':'), a comment, or a second
 *  empty line. */
function peekMessageEnd(lines, line) {
  if (line + 1 >= lines.length) return true;
  const next = lines[line + 1];
  return next.includes(':') || next.startsWith('-') || !next.trim();
}

/**
 * Parser.ParseLocalized (Parser.cs:174-285), verbatim: the header's DisplayName, and each QRC message's lines joined by
 * '\n' by id - a fixed message type's id from the static-messages table, any other from its header - with the empty
 * line an author left inside a message kept as ' '. Everything before QRC: and after QBN: is ignored. It throws where
 * the C# throws: a line in QRC that is not one `Field: value` (SplitField), a message id that is no number, a message
 * id twice (Dictionary.Add). Answers { displayName, messages }, or null for no lines.
 */
export function parseLocalizedQuest(lines) {
  if (!lines?.length) return null;
  let displayName = '';
  const messages = new Map();
  let inQRC = false, inQBN = false;
  const table = staticMessagesTable();
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].trim();
    if (!text || text.startsWith('-')) continue;
    if (startsWithCI(text, 'quest:')) continue;
    if (startsWithCI(text, 'displayname:')) { displayName = getFieldStringValue(text); continue; }
    if (startsWithCI(text, 'qrc:')) inQRC = true;
    else if (startsWithCI(text, 'qbn:')) inQBN = true;
    if (!inQRC || inQBN) continue;
    const parts = splitField(lines[i]);
    if (!parts?.length || !table.hasValue(parts[0])) continue;
    let id;
    if (parts[1].startsWith('[') && parts[1].endsWith(']')) {
      id = table.getInt('id', parts[0]);
      if (id === -1) throw new Error(`Could not parse localized quest message ID '${id}' to an int. Expected message ID value.`);
    } else {
      if (!/^\s*[+-]?\d+\s*$/.test(parts[1])) throw new Error(`Could not parse localized quest message ID '${parts[1]}' to an int. Expected message ID value.`);
      id = Number.parseInt(parts[1], 10);
    }
    let messageLines = '';
    for (;;) {
      if (i + 1 >= lines.length) break;
      const textLine = lines[++i].replace(/\r+$/, '');
      if (!textLine) {
        if (!peekMessageEnd(lines, i)) { messageLines += ' \n'; continue; }
        break;
      }
      messageLines += textLine + '\n';
    }
    if (messages.has(id)) throw new Error('An item with the same key has already been added.');
    messages.set(id, messageLines.replace(/\n+$/, ''));
  }
  return { displayName, messages };
}

const _parsed = new Map();   // `${locale}|${QUEST}` -> { displayName } | null
let _revision = -1;
const questKey = (questName) => String(questName ?? '').replace(/\.txt$/i, '').toUpperCase();

/**
 * ParseLocalizedQuestText (QuestMachine.cs:1648-1730): the current language's -LOC file for `questName`, parsed once and
 * its messages added to the locale's Internal_Quests where the table has no entry for them. A file that will not parse,
 * or has no DisplayName, or no message, is said and read as none - DFU logs and answers false. Answers { displayName }
 * or null.
 */
export function parseLocalizedQuestText(questName) {
  if (_revision !== textRevision()) { _parsed.clear(); _revision = textRevision(); }
  const name = questKey(questName);
  const key = `${currentLocale()}|${name}`;
  if (_parsed.has(key)) return _parsed.get(key);
  let entry = null;
  const doc = localeDocument(QUEST_DOCUMENT, name);
  if (doc) {
    let parsed = null;
    try { parsed = parseLocalizedQuest(doc.split('\n')); } catch (err) { console.error(`Parsing localized quest \`${name}-LOC.txt\` FAILED!\r\n${err?.message ?? err}`); }
    if (parsed && !parsed.displayName) console.error(`Localized quest '${name}-LOC.txt' has a null or empty DisplayName: value.`);
    else if (parsed && !parsed.messages.size) console.error(`Localized quest '${name}-LOC.txt' parsed no valid messages. Check source file is a valid format.`);
    else if (parsed) {
      const table = localeTable(currentLocale(), runtimeCollectionName(TextCollections.TextQuests), { create: true });
      for (const [id, text] of parsed.messages) {
        const k = `${name}.${id}`;
        if (!table.has(k)) table.set(k, text);   // AddEntry only where GetEntry found none
      }
      entry = { displayName: parsed.displayName };
    }
  }
  _parsed.set(key, entry);
  return entry;
}

/** GetLocalizedQuestDisplayName (QuestMachine.cs:1604-1617): the -LOC file's DisplayName, or '' where there is none. */
export const localizedQuestDisplayName = (questName) => parseLocalizedQuestText(questName)?.displayName ?? '';

/** GetMessage's lookup (Quest.cs:676-682): the translation's lines for `questName`'s message `id` - its Internal_Quests
 *  entry, split at '\n' - or null where the table has none. */
export function localizedQuestMessage(questName, id) {
  parseLocalizedQuestText(questName);
  const v = tryGetLocalizedText(TextCollections.TextQuests, `${questKey(questName)}.${id}`);
  return v === undefined ? null : String(v).split('\n');
}
