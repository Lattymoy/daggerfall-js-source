// T3a talk foundation: FACTION.TXT (DFU FactionFile.cs, MIT Daggerfall
// Workshop). The faction tree underpins talk reactions, guilds,
// temples, courts and quests. Verbatim parse: '#'-headed blocks,
// tag:value lines (the original file's one malformed tag splits on
// space), parent/child by preceding-TAB depth stack, duplicate ids
// remapped from resolver 980, region converted 1-based -> 0-based,
// flats packed archive<<7|record (a single flat stores to BOTH
// male/female slots; a second flat is the female), ruler name seed
// drawn from DFRandom in classic call order (rand()<<16 | rand(),
// power bonus random_range_inclusive(0,50)+20 - stream-position
// dependent in DFU too, so values are session-random, structure
// verbatim). RelinkChildren builds the children lists.

import { rand, randomRangeInclusive } from './dfRandom.js';

export const FACTION_TYPES = Object.freeze({
  None: -1, Daedra: 0, God: 1, Group: 2, Subgroup: 3, Individual: 4,
  Official: 5, VampireClan: 6, Province: 7, WitchesCoven: 8, Temple: 9,
  KnightlyGuard: 10, MagicUser: 11, Generic: 12, Thieves: 13,
  Courts: 14, People: 15,
});

export const SOCIAL_GROUPS = Object.freeze({
  None: -1, Commoners: 0, Merchants: 1, Scholars: 2, Nobility: 3,
  Underworld: 4, SGroup5: 5, SupernaturalBeings: 6, GuildMembers: 7,
  SGroup8: 8, SGroup9: 9, SGroup10: 10,
});
export const SOCIAL_GROUP_COUNT = 11;

export const GUILD_GROUPS = Object.freeze({
  None: -1, Oblivion: 2, DarkBrotherHood: 3, GeneralPopulace: 4,
  Bards: 5, TheFey: 6, Prostitutes: 7, KnightlyOrder: 9, MagesGuild: 10,
  FightersGuild: 11, Necromancers: 14, Region: 15, HolyOrder: 17,
  Witches: 22, Vampires: 23, Orsinium: 24,
  // The placeholder members are REAL enum names in FactionFile.cs
  // :568-602 and Enum.IsDefined matches them - the quest-list router
  // (QuestListsManager.ParseQuestList) files a "GGroup12" row under
  // guilds in DFU, so the mirror carries them too (Q2b-ii VERIFY; no
  // shipped row uses one).
  GGroup0: 0, GGroup1: 1, GGroup8: 8, GGroup12: 12, GGroup13: 13,
  GGroup16: 16, GGroup18: 18, GGroup19: 19, GGroup20: 20, GGroup21: 21,
  GGroup25: 25, GGroup26: 26, GGroup27: 27, GGroup28: 28, GGroup29: 29,
  GGroup30: 30,
});

const countPrecedingTabs = (line) => {
  let n = 0;
  while (n < line.length && line[n] === '\t') n++;
  return n;
};

// ParseFlat: "archive record" -> archive<<7|record; single part -> 0.
const parseFlat = (value) => {
  const parts = value.split(/\s+/).filter((s) => s.length);
  if (parts.length === 1) return 0;
  if (parts.length !== 2) throw new Error(`Invalid flat format for value ${value}`);
  return (parseInt(parts[0], 10) << 7) + parseInt(parts[1], 10);
};

export const flatArchive = (flat) => flat >> 7;
export const flatRecord = (flat) => flat & 0x7f;

function newFaction() {
  return {
    id: 0, parent: 0, type: 0, name: '', rep: 0, summon: 0, region: 0,
    power: 0, flags: 0, ruler: 0, ally1: 0, ally2: 0, ally3: 0,
    enemy1: 0, enemy2: 0, enemy3: 0, face: 0, race: 0, flat1: 0,
    flat2: 0, sgroup: 0, ggroup: 0, minf: 0, maxf: 0, vam: 0, rank: 0,
    rulerNameSeed: 0, rulerPowerBonus: 0, children: null,
  };
}

function parseFactionBlock(block, faction) {
  let allyCount = 0, enemyCount = 0, flatCount = 0;
  for (const line of block) {
    if (line.includes('#')) {
      faction.id = parseInt(line.split('#')[1].trim(), 10);
      continue;
    }
    if (!line.trim().length) continue;
    let parts = line.split(':');
    if (parts.length !== 2) {
      // the original faction.txt has one malformed tag missing its colon
      parts = line.split(' ');
      if (parts.length !== 2) throw new Error(`Invalid tag format for data ${line} on faction ${faction.id}`);
    }
    const tag = parts[0].trim().toLowerCase();
    const value = parts[1].trim();
    switch (tag) {
      case 'name': faction.name = value; break;
      case 'rep': faction.rep = parseInt(value, 10); break;
      case 'summon': faction.summon = parseInt(value, 10); break;
      case 'region':
        faction.region = parseInt(value, 10);
        // 1-based -> 0-based, as classic does
        if (faction.region !== -1) faction.region--;
        break;
      case 'type': faction.type = parseInt(value, 10); break;
      case 'power': faction.power = parseInt(value, 10); break;
      case 'flags': faction.flags |= parseInt(value, 10); break;
      case 'ruler': faction.ruler = parseInt(value, 10); break;
      case 'face': faction.face = parseInt(value, 10); break;
      case 'race': faction.race = parseInt(value, 10); break;
      case 'sgroup': faction.sgroup = parseInt(value, 10); break;
      case 'ggroup': faction.ggroup = parseInt(value, 10); break;
      case 'minf': faction.minf = parseInt(value, 10); break;
      case 'maxf': faction.maxf = parseInt(value, 10); break;
      case 'vam': faction.vam = parseInt(value, 10); break;
      case 'rank': faction.rank = parseInt(value, 10); break;
      case 'ally': {
        const ally = parseInt(value, 10);
        if (allyCount === 0) faction.ally1 = ally;
        else if (allyCount === 1) faction.ally2 = ally;
        else if (allyCount === 2) faction.ally3 = ally;
        else throw new Error(`Too many allies for faction #${faction.id}`);
        allyCount++;
        break;
      }
      case 'enemy': {
        const enemy = parseInt(value, 10);
        if (enemyCount === 0) faction.enemy1 = enemy;
        else if (enemyCount === 1) faction.enemy2 = enemy;
        else if (enemyCount === 2) faction.enemy3 = enemy;
        else throw new Error(`Too many enemies for faction #${faction.id}`);
        enemyCount++;
        break;
      }
      case 'flat': {
        const flat = parseFlat(value);
        if (flat > 0) {
          if (flatCount === 0) {
            // one flat specified -> both male and female slots
            faction.flat1 = flat;
            faction.flat2 = flat;
          } else if (flatCount === 1) {
            faction.flat2 = flat;   // the second flat is the female
          } else {
            throw new Error(`Too many flats for faction #${faction.id}`);
          }
          flatCount++;
        }
        break;
      }
      default:
        throw new Error(`Unexpected tag '${tag}' with value '${value}' on faction #${faction.id}`);
    }
  }
}

export function relinkChildren(dict) {
  for (const faction of [...dict.values()]) {
    const parent = dict.get(faction.parent);
    if (parent) {
      if (!parent.children) parent.children = [];
      parent.children.push(faction.id);
    }
  }
}

export class FactionFile {
  constructor() {
    this.factionDict = new Map();       // id -> faction
    this.factionNameToId = new Map();   // first name wins (DFU ignores dupes)
  }

  /** Parse FACTION.TXT bytes (UTF-8 text). */
  load(bytes) {
    this.parse(new TextDecoder().decode(bytes));
    relinkChildren(this.factionDict);
    return true;
  }

  parse(txt) {
    // unmodded FACTION.TXT contains duplicate ids; the resolver
    // counter hands those a unique id (classic-compatible base 980)
    let resolverId = 980;
    this.factionDict.clear();

    // First pass: split into '#'-headed blocks (comments ';' skipped).
    const factionBlocks = [];
    let currentBlock = [];
    for (const line of txt.split(/\r?\n/)) {
      if (line.startsWith(';') || line.length === 0) continue;
      if (line.includes('#')) {
        if (currentBlock.length) factionBlocks.push(currentBlock);
        currentBlock = [];
      }
      currentBlock.push(line);
    }
    if (currentBlock.length) factionBlocks.push(currentBlock);

    // Second pass: parse blocks; parents from the preceding-tab stack.
    let lastPrecedingTabs = 0;
    let previousId = 0;
    const parentStack = [];
    for (const block of factionBlocks) {
      const faction = newFaction();
      const precedingTabs = countPrecedingTabs(block[0]);
      if (precedingTabs > lastPrecedingTabs) {
        parentStack.push(previousId);
      } else if (precedingTabs < lastPrecedingTabs) {
        while (parentStack.length > precedingTabs) parentStack.pop();
      }
      lastPrecedingTabs = precedingTabs;
      if (parentStack.length) faction.parent = parentStack[parentStack.length - 1];

      parseFactionBlock(block, faction);

      if (!this.factionDict.has(faction.id)) {
        this.factionDict.set(faction.id, faction);
      } else {
        faction.id = resolverId++;
        this.factionDict.set(faction.id, faction);
      }
      if (!this.factionNameToId.has(faction.name)) {
        this.factionNameToId.set(faction.name, faction.id);
      }

      // Ruler name seed + power bonus. AUDIT 18 F3: the draws happen -
      // they advance the DFRandom stream and every later faction depends
      // on that - but the RESULTS ARE DISCARDED, because DFU discards
      // them. FactionData is a STRUCT (FactionFile.cs:640), so
      // `factionDict.Add(faction.id, faction)` at :1003/:1009 takes a
      // COPY before :1026-1027 assign these two fields to the local. The
      // only thing that outlives the loop body is `previousFaction`, read
      // for `.id` alone (:984). Every faction in DFU's FactionDict
      // therefore carries rulerNameSeed 0 and rulerPowerBonus 0, and
      // PersistentFactionData.Reset() hands that same zeroed dict to the
      // game - which is why MacroHelper.cs:328 seeds every province's
      // ruler name from 0, and why PlayerEntity's ten regional-power
      // rolls all add nothing. The port stored what DFU throws away.
      // Bug-for-bug: draw, then drop.
      const random = (rand() << 16) >>> 0;
      void ((rand() | random) >>> 0);          // DFU: faction.rulerNameSeed on the discarded copy
      void (randomRangeInclusive(0, 50) + 20);  // DFU: faction.rulerPowerBonus on the discarded copy

      previousId = faction.id;
    }
  }

  getFaction(id) { return this.factionDict.get(id) ?? null; }
  getFactionId(name) { return this.factionNameToId.get(name) ?? -1; }
}

export const isAlly = (a, b) => a.ally1 === b.id || a.ally2 === b.id || a.ally3 === b.id;
export const isEnemy = (a, b) => a.enemy1 === b.id || a.enemy2 === b.id || a.enemy3 === b.id;
