// THE QUEST PLACE (Q1) - Place.cs, declaration + table lookup. Scope
// is local|remote|permanent|randompermanent (the last picks one site
// from a comma list - UnityEngine.Random -> injectable roll, Ledger
// A) and p1/p2/p3 come from the Quests-Places table (CustomParseInt:
// 0x-prefixed values parse hex). SITE RESOLUTION - SetupLocalSite /
// SetupRemoteSite / SetupFixedLocation binding the place to a real
// map pixel, building and markers - is the world half and ships at
// Q3; until then `sitePending` says so, loudly, and the parse half
// still throws exactly where DFU throws (unknown scope, missing
// table row, empty site name).

import { QuestResource, matchFirst } from './questResource.js';
import { Symbol as QuestSymbol } from './symbol.js';
import { placesTable } from './tables.js';

export const Scopes = Object.freeze({ None: 'none', Local: 'local', Remote: 'remote', Fixed: 'fixed' });

const DECL = [
  /(Place|place) (?<symbol>[a-zA-Z0-9_.-]+) (?<siteType>local|remote|permanent) (?<siteName>\w+)/,
  /(Place|place) (?<sym2>[a-zA-Z0-9_.-]+) (?<siteType2>randompermanent) (?<siteList>[a-zA-Z0-9_.,]+)/,
];

/** Place.CustomParseInt: 0x prefix parses hex, else decimal. AUDIT
 *  quest-6: C# int.Parse throws on malformed input in BOTH arms; JS
 *  parseInt would answer NaN ('0x') or silently truncate ('0x12G'). */
export function customParseInt(value) {
  if (/^0x/i.test(value)) {
    const hex = value.replace(/0x/i, '');
    if (!/^[0-9a-fA-F]+$/.test(hex)) throw new Error(`int.Parse failed on '${value}'`);
    return parseInt(hex, 16);
  }
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) throw new Error(`int.Parse failed on '${value}'`);
  return n;
}

export class Place extends QuestResource {
  constructor(parentQuest, line = null) {
    super(parentQuest);
    this.scope = Scopes.None;
    this.name = '';
    this.p1 = 0; this.p2 = 0; this.p3 = 0;
    this.sitePending = true;   // Q1: site binding (map pixel/building/markers) ships at Q3
    if (line !== null) this.setResource(line);
  }

  get isPlace() { return true; }

  setResource(line) {
    super.setResource(line);
    let randomSiteList = false;
    const match = matchFirst(line, DECL);
    if (!match) return;
    const g = match.groups;
    this.symbol = new QuestSymbol(g.symbol ?? g.sym2);
    const siteType = g.siteType ?? g.siteType2;
    if (/^local$/i.test(siteType)) this.scope = Scopes.Local;
    else if (/^remote$/i.test(siteType)) this.scope = Scopes.Remote;
    else if (/^permanent$/i.test(siteType)) this.scope = Scopes.Fixed;
    else if (/^randompermanent$/i.test(siteType)) { this.scope = Scopes.Fixed; randomSiteList = true; }
    else throw new Error(`Place found no site type match found for source: '${line}'. Must be local|remote|permanent.`);

    this.name = g.siteName ?? '';
    if (!this.name && !randomSiteList) throw new Error(`Place site name empty for source: '${line}'`);

    if (randomSiteList) {
      const siteNames = g.siteList.split(',');
      if (!siteNames.length) throw new Error(`Place randompermanent must have at least one site name in source: '${line}'`);
      const roll = this.parentQuest?.rolls ?? Math.random;
      this.name = siteNames[Math.floor(roll() * siteNames.length)];   // Random.Range(0, length)
    }

    const table = placesTable();
    if (!table.hasValue(this.name)) throw new Error(`Could not find place name in data table: '${this.name}'`);
    this.p1 = customParseInt(table.getValue('p1', this.name));
    this.p2 = customParseInt(table.getValue('p2', this.name));
    this.p3 = customParseInt(table.getValue('p3', this.name));

    // DFU dispatches SetupLocalSite/SetupRemoteSite/SetupFixedLocation
    // here; the fall-through throw fires for a Fixed place whose
    // p1 <= 0x300. The world binding is Q3; the gate is preserved so
    // bad data still fails the parse exactly where DFU fails it.
    const valid = this.scope === Scopes.Local || this.scope === Scopes.Remote
      || (this.scope === Scopes.Fixed && this.p1 > 0x300);
    if (!valid) throw new Error('Invalid placeType in line: ' + line);
  }
}
