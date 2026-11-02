// QUEST-NAME-ONE (FIELD BUGS 2026-10-20, Harlander on the Discord's bug-reports, "NPC names in new quests don't match the
// NPCs you talk to in the world": "for some of them, the name mentioned in the quest text doesn't match the name of the
// NPC you talk to to progress it"). The questlines name four givers by their own name over the one their Person drew
// (`ql name`, QL12: Ysolde Marnhel, Prior Anselm Vey, Hamid al-Rasheen, Corvane Tull - sixteen steps), and the words,
// the journal and the guide say it. But the NPC stood for a quest Person was named as DFU names every static NPC
// (StaticNPC.GetDisplayName): drawn again from the Person's seed with the bank of the region it stands in - a stranger's
// name on the plate, the Info line, the plaque, and the talk partner the topic tree compares with the Person. The two
// derivations meet in DFU only because nothing there renames a Person and both banks are the region's. Now the stand's
// one builder carries the Person's own name (systems/quest/person.js personOwnName) and the namer answers it
// (characters/staticNpc.js staticNpcName) - a departure, named there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQuestTables } from '../../src/systems/quest/tables.js';
import { QuestMachine } from '../../src/systems/quest/machine.js';
import { personOwnName, shownPersonName } from '../../src/systems/quest/person.js';
import { questlineActionTemplates } from '../../src/systems/questlines/qlActions.js';
import { freshState } from '../../src/systems/questlines/qlState.js';
import { layoutNpcData, staticNpcName, staticNpcShownName, positionHash } from '../../src/characters/staticNpc.js';
import { BANK_TYPES, GENDERS } from '../../src/characters/nameHelper.js';
import { FACTION_TYPES } from '../../src/formats/factionFile.js';
import { srand, getSeed } from '../../src/formats/dfRandom.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  const tables = join(ROOT, 'vendor', 'dfu-quests', 'Tables');
  for (const f of readdirSync(tables)) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(tables, f));
  loadQuestTables(sources);
}
const QUESTS = join(ROOT, 'src', 'systems', 'questlines', 'quests');

/** A quest of one Person, run to its start-up's end (`startup` its start-up task's own lines). The world's setup is the
 *  one step stood in for: the seed, the bank of the region the quest began in and the gender a world gives, then the
 *  Person's own draw (Person.cs:612-628 AssignDisplayName) - before the start-up runs, as a quest's setup is. */
function personOf(personLine, startup = [], { seed = 321, bank = BANK_TYPES.Breton } = {}) {
  const src = ['Quest: __QNAME', 'DisplayName: A Name', 'QRC:', 'QuestorOffer:  [1000]', '<ce> Will you?', '', 'RefuseQuest:  [1001]', '<ce> No.', '',
    'AcceptQuest:  [1002]', '<ce> Yes.', '', 'QBN:', personLine, '', ...startup.map((l) => `\t${l.trim()}`)];
  const m = new QuestMachine({ nowSeconds: () => 0, getQuestSourceLines: () => src, questlinesStamp: () => freshState() });
  for (const t of questlineActionTemplates()) m.registerAction(t);
  const quest = m.startQuestByName('__QNAME');
  const person = quest.getPerson({ name: /^Person _([a-zA-Z0-9_.]+)_ /.exec(personLine)[1] });
  Object.assign(person, { nameSeed: seed, nameBank: bank, npcGender: / female /.test(personLine) ? GENDERS.Female : GENDERS.Male });
  person._assignDisplayName();
  m.tick();
  return person;
}
/** The host's one builder of a quest stand's layout data, as it is written (scenes/worldModes.js questStandNpcData - the
 *  click, the Info line, the plaque and the talk window all read what it builds), run over the real SetLayoutData. */
const WM = read(join(ROOT, 'src', 'scenes', 'worldModes.js'));
const BUILDER = (() => {
  const m = /\n {2}(const questStandNpcData = \(s, person, buildingKey\) => \{\n[\s\S]*?\n {2}\};)\n/.exec(WM);
  assert.ok(m, 'questStandNpcData is no longer where this pin reads it');
  const bridge = { layoutNpcData: (fields) => layoutNpcData(fields) };
  return new Function('positionHash', 'questBridge', 'personOwnName', `${m[1]}\nreturn questStandNpcData;`)(positionHash, bridge, personOwnName);   // eslint-disable-line no-new-func
})();
const standData = (person) => BUILDER({ marker: { x: 1024.6, y: -96.2, z: 2048.9 } }, person, 7);
const deps = (bank) => ({ getFaction: () => null, nameBank: bank });

test('QUEST-NAME-ONE: every questline giver named by `ql name` is answered to by that name - the plate, the Info line and the talk partner say what the quest\'s words say, never the stranger the seed draws (mutants: the namer re-draws; the stand carries no name)', () => {
  const givers = [];
  for (const f of readdirSync(QUESTS).filter((n) => n.endsWith('.txt'))) {
    const src = read(join(QUESTS, f));
    for (const m of src.matchAll(/^\s*ql name (_[a-zA-Z0-9_.]+_) ([A-Za-z][A-Za-z'_-]*)\s*$/gm)) {
      const personLine = src.split('\n').find((l) => l.startsWith(`Person ${m[1]} `));
      assert.ok(personLine, `${f}: ${m[1]} is declared`);
      givers.push({ f, sym: m[1], given: m[2].replace(/_/g, ' '), personLine: personLine.trim(), words: src.slice(0, src.indexOf('QBN:')) });
    }
  }
  assert.equal(givers.length, 20, 'the twenty steps a named giver gives');   // PIN MOVED (KETCH): the Sky-Ketch's four, Imrah Bel-Tavir's
  assert.deepEqual([...new Set(givers.map((g) => g.given))].sort(), ['Corvane Tull', 'Hamid al-Rasheen', 'Imrah Bel-Tavir', 'Prior Anselm Vey', 'Ysolde Marnhel']);
  for (const g of givers) {
    const person = personOf(g.personLine, [`ql name ${g.sym} ${g.given.replace(/ /g, '_')}`]);
    assert.equal(person.displayName, g.given, `${g.f}: the quest's own name, over the one it drew`);
    assert.equal(person.nameSeed, 321, 'the seed the stand is laid out with');
    assert.ok(g.words.includes(g.given.replace(/^Prior /, '')), `${g.f}: its words name ${g.given}`);
    const data = standData(person);
    for (const bank of [BANK_TYPES.Breton, BANK_TYPES.Redguard]) {
      assert.equal(staticNpcName(data, deps(bank)), g.given, `${g.f}: the talk partner's name (the topic tree's same-person key)`);
      assert.equal(staticNpcShownName(data, deps(bank)), g.given, `${g.f}: the plate, the Info line and the plaque`);
      assert.notEqual(staticNpcName({ ...data, personName: undefined }, deps(bank)), g.given, `${g.f}: DFU's re-draw names a stranger - the bug, held as a fact`);
    }
  }
});

test('QUEST-NAME-ONE: a Person who drew their name answers to it wherever they stand - the seed redrawn with another region\'s bank names someone else, and the stand keeps the Person\'s (mutant: the stand carries no name)', () => {
  const person = personOf('Person _regular_ group Resident1 local anyInfo 1014');
  assert.ok(person.displayName, 'drawn');
  const data = standData(person);
  for (const bank of [BANK_TYPES.Breton, BANK_TYPES.Redguard, BANK_TYPES.Nord]) {
    assert.equal(staticNpcName(data, deps(bank)), person.displayName);
    assert.equal(staticNpcShownName(data, deps(bank)), shownPersonName(person));
  }
  const banks = [BANK_TYPES.Breton, BANK_TYPES.Redguard, BANK_TYPES.Nord].map((b) => staticNpcName({ ...data, personName: undefined }, deps(b)));
  assert.ok(new Set(banks).size > 1, `the re-draw depends on the bank: ${banks.join(', ')}`);
});

test('QUEST-NAME-ONE: a Person named after their faction record - an Individual, a Daedra - carries no name of their own, and the NPC keeps DFU\'s faction path (its translation shown); nothing that is no Person carries one (mutant: the faction test dropped)', () => {
  const person = personOf('Person _p_ group Resident1 local anyInfo 1014');
  const individual = { id: 201, type: FACTION_TYPES.Individual, name: 'Lady Brisienna' };
  person.factionData = individual;
  person.displayName = individual.name;
  assert.equal(personOwnName(person), null, 'an Individual');
  person.factionData = { id: 30, type: FACTION_TYPES.Daedra, name: 'Azura' };
  assert.equal(personOwnName(person), null, 'a Daedra');
  person.factionData = individual;
  const data = { ...standData(person), factionID: individual.id };
  assert.equal(data.personName, null);
  assert.equal(staticNpcName(data, { getFaction: (id) => (id === individual.id ? individual : null), nameBank: BANK_TYPES.Breton }), 'Lady Brisienna');
  assert.equal(personOwnName({ isItem: true, displayName: 'a letter' }), null);
  assert.equal(personOwnName(null), null);
});

test('QUEST-NAME-ONE: the classic stream stands where GetDisplayName leaves it - the seed\'s draw still runs under a Person\'s own name, so every roll after the naming is DFU\'s (mutant: the Person\'s name returned before the draw)', () => {
  const person = personOf('Person _giver_ faction The_Mages_Guild male anyInfo 1014', ['ql name _giver_ Corvane_Tull']);
  const data = standData(person);
  srand(12345);
  staticNpcName({ ...data, personName: undefined }, deps(BANK_TYPES.Breton));
  const redrawn = getSeed();
  srand(12345);
  assert.equal(staticNpcName(data, deps(BANK_TYPES.Breton)), 'Corvane Tull');
  assert.equal(getSeed(), redrawn, 'the stream after the naming');
});

test('QUEST-NAME-ONE: the host\'s one builder carries the Person\'s own name, and both namers read the layout data it builds (mutant: the entry taken out)', () => {
  const build = WM.slice(WM.indexOf('const questStandNpcData = (s, person, buildingKey) => {'), WM.indexOf('const questStandLook = (s, buildingKey) => {'));
  assert.match(build, /personName: personOwnName\(person\),/);
  assert.match(WM, /import \{ personOwnName \} from '\.\.\/systems\/quest\/person\.js';/);
  assert.match(WM, /const npcDisplayName = \(npcData\) => \{\n\s+return questBridge\?\.machine\?\.movedQuestorName\?\.\(npcData\) \?\? staticNpcName\(npcData, npcNameDeps\(\)\);/);
  assert.match(WM, /const npcShownName = \(npcData\) => questBridge\?\.machine\?\.movedQuestorName\?\.\(npcData\) \?\? staticNpcShownName\(npcData, npcNameDeps\(\)\);/);
});
