// THE QUEST RESOURCE BASE (Q1) - QuestResource.cs, the parse half.
// Every resource (Clock/Item/Person/Place/Foe) carries a Symbol and
// the three message tags its declaration may name (anyInfo / used /
// rumors, by id or by static-message name). The lifecycle half (Tick,
// SetPlayerClicked, hide/reveal) ships with the machine (Q2).
//
// matchFirst: C# Regex alternations reuse one group name across
// alternatives, which this Node cannot express in a single RegExp -
// so a C# "a|b|c" pattern becomes an ordered pattern list, and the
// winner is the match at the LEFTMOST position, ties broken by
// pattern order. That is exactly .NET's alternation semantics.

import { Symbol as QuestSymbol } from './symbol.js';
import { staticMessagesTable } from './tables.js';
import { parseInt as questParseInt } from './parseUtils.js';

/** .NET-alternation matcher over an ordered pattern list. */
export function matchFirst(line, patterns) {
  let best = null, bestIndex = Infinity;
  for (const p of patterns) {
    const m = p.exec(line);
    if (m && m.index < bestIndex) { best = m; bestIndex = m.index; }
  }
  return best;
}

const MESSAGE_TAGS = /anyInfo (?<info>\d+)|used (?<used>\d+)|rumors (?<rumors>\d+)|anyInfo (?<infoName>\w+)|used (?<usedName>\w+)|rumors (?<rumorsName>\w+)/g;

export class QuestResource {
  constructor(parentQuest) {
    this.parentQuest = parentQuest;
    this.symbol = null;
    this.infoMessageID = -1;
    this.usedMessageID = -1;
    this.rumorsMessageID = -1;
    this.isHidden = false;
  }

  get Symbol() { return this.symbol; }
  set Symbol(v) { this.symbol = v; }

  /** Base SetResource parses the message tags off the line. */
  setResource(line) {
    this._parseMessageTags(line);
  }

  /** Called every quest tick / after all tasks (Q2). Overridden by
   *  resources that act (Clock); the base does nothing. */
  tick(_caller) {}
  postTick(_caller) {}
  dispose() {}

  _parseMessageTags(line) {
    const matches = [...line.matchAll(MESSAGE_TAGS)];
    for (const match of matches) {
      const g = match.groups;
      if (g.info) this.infoMessageID = questParseInt(g.info);
      if (this.infoMessageID === -1 && g.infoName) {
        this.infoMessageID = questParseInt(staticMessagesTable().getValue('id', g.infoName));
      }
      if (g.used) this.usedMessageID = questParseInt(g.used);
      if (this.usedMessageID === -1 && g.usedName) {
        this.usedMessageID = questParseInt(staticMessagesTable().getValue('id', g.usedName));
      }
      if (g.rumors) this.rumorsMessageID = questParseInt(g.rumors);
      if (this.rumorsMessageID === -1 && g.rumorsName) {
        this.rumorsMessageID = questParseInt(staticMessagesTable().getValue('id', g.rumorsName));
      }
    }
  }
}

export { QuestSymbol };
