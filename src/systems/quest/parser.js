// THE QUEST PARSER (Q1) - Parser.cs whole. Reads a quest source file
// (DFU's decompiled .txt form, vendor/dfu-quests) and generates a new
// Quest object: the header (quest:/displayname:), the QRC message
// blocks (headers named in the Quests-StaticMessages table, fixed
// types taking their id FROM the table, PeekMessageEnd's forgotten-
// blank-line forgiveness), and the QBN (resource declarations
// dispatched by their leading word on the RAW line - an indented
// "clock" is a task line, not a clock - tasks by header shape, global
// variable links by the Quests-GlobalVars table, and the FIRST
// unrecognized block as the headless startup task; a second one
// throws "Unknown line signature", exactly as DFU).

import { Quest } from './quest.js';
import { Message } from './message.js';
import { Task } from './task.js';
import { Clock } from './clock.js';
import { Item } from './item.js';
import { Person } from './person.js';
import { Place } from './place.js';
import { Foe } from './foe.js';
import { staticMessagesTable, globalVarsTable } from './tables.js';
import { getInnerSymbolName } from './symbol.js';

// ---- Parser statics (Parser.cs #region Static Helpers) ----
// The bodies live in parseUtils.js (AUDIT quest-1: a leaf module, so
// the resource classes can use them without closing an import cycle
// through the eval-time `extends QuestResource`); re-exported here so
// the C# shape - they are Parser statics - stays the import surface.

export { splitLine, splitField, getFieldStringValue, getFieldIntValue, parseInt } from './parseUtils.js';
export { getInnerSymbolName };
import { splitLine, splitField, getFieldStringValue, parseInt } from './parseUtils.js';

// ---- The parser itself ----

const startsWithCI = (text, prefix) => text.slice(0, prefix.length).toLowerCase() === prefix;

export class Parser {
  /**
   * @param {string[]} source lines of quest source.
   * @param {number} factionId quest giver faction id (guilds).
   * @param {object} [opts] partialParse skips QRC/QBN; rolls is the
   *   quest's injectable uniform roll (Ledger A); nowSeconds is the
   *   world-time seam - it must ride the PARSE because PlaySound's
   *   create stamps lastTimePlayed from the live clock (Q2b).
   */
  parse(source, factionId = 0, { partialParse = false, rolls, actionFactory, nowSeconds } = {}) {
    const quest = new Quest({ rolls, actionFactory, nowSeconds });
    quest.factionId = factionId;
    let inQRC = false, inQBN = false;
    const qrcLines = [], qbnLines = [];

    // First pass gathers basic structure: <Header> <QRC> <QBN>
    for (const line of source) {
      const text = line.trim();
      if (startsWithCI(text, 'quest:')) {
        quest.questName = getFieldStringValue(text);
      } else if (startsWithCI(text, 'displayname:')) {
        quest.displayName = getFieldStringValue(text);
      } else if (startsWithCI(text, 'qrc:')) {
        inQRC = true; inQBN = false; continue;
      } else if (startsWithCI(text, 'qbn:')) {
        inQRC = false; inQBN = true; continue;
      }
      if (inQRC) {
        qrcLines.push(line);
      } else if (inQBN) {
        if (text.startsWith('-')) continue;   // comments always skipped in QBN
        qbnLines.push(line);
      }
    }

    if (!quest.questName) throw new Error('Parse() error: Quest has no name.');
    if (qrcLines.length === 0) throw new Error('Parse() error: Quest has no QRC section.');
    if (qbnLines.length === 0) throw new Error('Parse() error: Quest has no QBN section.');

    if (!partialParse) {
      this._parseQRC(quest, qrcLines);
      this._parseQBN(quest, qbnLines);
    }
    return quest;
  }

  _parseQRC(quest, lines) {
    const table = staticMessagesTable();
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('-')) continue;         // comments (RAW line, as C#)
      if (!lines[i].trim()) continue;

      // Message block header: 'Message: 1011' or fixed 'QuestComplete: [1004]'
      const parts = splitField(lines[i]);
      if (table.hasValue(parts[0])) {
        let messageID = 0;
        if (parts[1].startsWith('[') && parts[1].endsWith(']')) {
          messageID = table.getInt('id', parts[0]);
          if (messageID === -1) throw new Error(`Could not parse text '${table.getInt('id', parts[0])}' to an int. Expected message ID value.`);
        } else {
          if (!/^-?\d+$/.test(parts[1])) throw new Error(`Could not parse text '${parts[1]}' to an int. Expected message ID value.`);
          messageID = Number.parseInt(parts[1], 10);
        }

        // Read message lines until an empty line ends the block -
        // unless PeekMessageEnd says the author just forgot the
        // leading space, in which case it is a line break.
        const messageLines = [];
        for (;;) {
          if (i + 1 >= lines.length) break;
          const text = lines[++i].replace(/\r+$/, '');   // C# TrimEnd('\r') strips ALL trailing CRs (AUDIT quest-P10)
          if (!text) {
            if (!this._peekMessageEnd(lines, i)) { messageLines.push(' '); continue; }
            break;
          }
          messageLines.push(text);
        }

        quest.addMessage(messageID, new Message(quest, messageID, messageLines));
      } else {
        throw new Error(`Could not parse message block near '${lines[i]}'. Check message header syntax, spelling, and casing are all correct.`);
      }
    }
  }

  /** End of message if: end of stream, a header/tag line (contains ':'),
   *  a comment, or a second empty line. */
  _peekMessageEnd(lines, line) {
    if (line + 1 >= lines.length) return true;
    const nextLine = lines[line + 1];
    return nextLine.includes(':') || nextLine.startsWith('-') || !nextLine.trim();
  }

  _parseQBN(quest, lines) {
    let foundHeadlessTask = false;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      // Dispatch by the RAW line's leading word, as C# StartsWith does
      if (startsWithCI(lines[i], 'clock')) {
        quest.addResource(new Clock(quest, lines[i]));
      } else if (startsWithCI(lines[i], 'item')) {
        quest.addResource(new Item(quest, lines[i]));
      } else if (startsWithCI(lines[i], 'person')) {
        quest.addResource(new Person(quest, lines[i]));
      } else if (startsWithCI(lines[i], 'foe')) {
        quest.addResource(new Foe(quest, lines[i]));
      } else if (startsWithCI(lines[i], 'place')) {
        quest.addResource(new Place(quest, lines[i]));
      } else if (startsWithCI(lines[i], 'variable')) {
        quest.addTask(new Task(quest, [lines[i]]));
      } else if (lines[i].includes('task:')
        || (startsWithCI(lines[i], 'until') && lines[i].includes('performed:'))) {
        quest.addTask(new Task(quest, this._readBlock(lines, (n) => { i = n; }, i)));
      } else if (this._isGlobalReference(lines[i])) {
        // A global variable link task; body optional
        let hasBody = false;
        if (i + 1 !== lines.length) hasBody = !this._isNewTaskOrLineBreak(lines[i + 1]);
        const globalVar = this._getGlobalReference(lines[i]);
        const taskLines = hasBody ? this._readBlock(lines, (n) => { i = n; }, i) : [lines[i]];
        quest.addTask(new Task(quest, taskLines, globalVar));
      } else if (foundHeadlessTask === false) {
        // First unrecognized QBN block is the headless startup task
        quest.addTask(new Task(quest, this._readBlock(lines, (n) => { i = n; }, i)));
        foundHeadlessTask = true;
      } else {
        throw new Error(`Unknown line signature encounted '${lines[i]}'.`);
      }
    }
  }

  _isNewTaskOrLineBreak(line) {
    return startsWithCI(line, 'variable')
      || line.includes('task:')
      || (startsWithCI(line, 'until') && line.includes('performed:'))
      || this._isGlobalReference(line)
      || !line.trim();
  }

  /** ReadBlock: gather lines to the next pure-whitespace line, each
   *  trimmed of TABS only (C# Trim('\t')). */
  _readBlock(linesIn, setLine, currentLine) {
    const linesOut = [];
    for (;;) {
      linesOut.push(linesIn[currentLine].replace(/^\t+|\t+$/g, ''));
      if (currentLine + 1 >= linesIn.length) break;
      const text = linesIn[++currentLine].trim();
      if (!text) break;
    }
    setLine(currentLine);
    return linesOut;
  }

  _isGlobalReference(line) {
    const parts = splitLine(line);
    if (!parts.length) return false;
    return globalVarsTable().hasValue(parts[0]);
  }

  _getGlobalReference(line) {
    const parts = splitLine(line);
    if (!parts.length) return -1;
    if (globalVarsTable().hasValue(parts[0])) {
      return parseInt(globalVarsTable().getValue('id', parts[0]));
    }
    return -1;
  }
}
