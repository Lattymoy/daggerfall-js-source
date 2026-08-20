// THE QUEST ITEM (Q1) - Item.cs, declaration half. Five declaration
// shapes tried in DFU's alternation order: class+subclass,
// class+template, artifact NAME, NAME key N (books/potions), bare
// NAME - plus the "range LOW to HIGH" option and the gold special
// case (not in the lookup table). Minting the actual DaggerfallItem
// (the ItemsTable/artifact resolution into the port's item system)
// ships with the machine slices; Q1 stores the parsed fields.

import { QuestResource, matchFirst } from './questResource.js';
import { Symbol as QuestSymbol } from './symbol.js';
import { parseInt as questParseInt } from './parseUtils.js';

const DECL = [
  /(Item|item) (?<s1>[a-zA-Z0-9_.-]+) item class (?<itemClass>\d+) subclass (?<itemSubClass>\d+)/,
  /(Item|item) (?<s2>[a-zA-Z0-9_.-]+) item class (?<c2>\d+) template (?<itemTemplate>\d+)/,
  /(Item|item) (?<s3>[a-zA-Z0-9_.-]+) (?<artifact>artifact) (?<n3>[a-zA-Z0-9_.-]+)/,
  /(Item|item) (?<s4>[a-zA-Z0-9_.-]+) (?<n4>[a-zA-Z0-9_.-]+) key (?<itemKey>\d+)/,
  /(Item|item) (?<s5>[a-zA-Z0-9_.-]+) (?<n5>[a-zA-Z0-9_.-]+)/,
];
const OPTIONS = /range (?<rangeLow>\d+) to (?<rangeHigh>\d+)/g;

export class Item extends QuestResource {
  constructor(parentQuest, line = null) {
    super(parentQuest);
    this.itemName = '';
    this.itemKey = -1;
    this.itemClass = -1;
    this.itemSubClass = -1;
    this.itemTemplate = -1;
    this.artifact = false;
    this.isGold = false;
    this.rangeLow = -1;
    this.rangeHigh = -1;
    if (line !== null) this.setResource(line);
  }

  setResource(line) {
    super.setResource(line);
    const match = matchFirst(line, DECL);
    if (!match) return;
    const g = match.groups;
    this.symbol = new QuestSymbol(g.s1 ?? g.s2 ?? g.s3 ?? g.s4 ?? g.s5);
    this.itemName = g.n3 ?? g.n4 ?? g.n5 ?? '';
    if (g.itemClass != null || g.c2 != null) this.itemClass = questParseInt(g.itemClass ?? g.c2);
    if (g.itemSubClass != null) this.itemSubClass = questParseInt(g.itemSubClass);
    if (g.itemTemplate != null) this.itemTemplate = questParseInt(g.itemTemplate);
    if (g.artifact) this.artifact = true;
    if (g.itemKey != null) this.itemKey = questParseInt(g.itemKey);
    if (this.itemName === 'gold') this.isGold = true;

    const optionsLine = line.slice(match.index + match[0].length);
    for (const option of optionsLine.matchAll(OPTIONS)) {
      if (option.groups.rangeLow != null) this.rangeLow = questParseInt(option.groups.rangeLow);
      if (option.groups.rangeHigh != null) this.rangeHigh = questParseInt(option.groups.rangeHigh);
    }
  }
}
