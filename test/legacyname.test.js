// LEGACY-NAME (2026-10-06, bible/06-Systems/Legacy-Arc.md section 5's naming; found re-reading LEGACY-SHEET's own title):
// A HOUSE IS NAMED FOR ITS SEAT WHEN ITS FOUNDER HAS NO SURNAME - EVEN WHEN THE SEAT COMES LATER. The law: "the family's
// surname is the founder's (their name's last word, or 'of <seat>' when they have none)". It was applied only AT THE
// FOUNDING, and a new character founds in Privateer's Hold, where no town stands: the seat was noted at the first town and
// the house stayed nameless for good - "The House of " on every page, no house under the name online, its siblings with
// no surname. And a seat's house said itself twice ("The House of of Sentinel"); the town's news said "{who} {house}",
// which read "Tlist Sentinel" for a seat's house. AUDIT LEGACY III A16/F2: this header said the news doubled a member's
// surname ("Ysolde Hlaalu Hlaalu, gone.") - no town ever said it: the renderer fills `{who}` with the FIRST name
// (systems/livingWorld/meetups.js, `firstNameOf`, since LW4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLegacyHost, LEGACY_TEXT } from '../src/scenes/legacyHost.js';
import { foundFamily, familyRng, MODELS, LEGACY_MOD, nameAtSeat, fullNameOf, writePlayer, surnameOf, givenOf } from '../src/systems/legacy/family.js';
import { houseWord } from '../src/systems/legacy/houseName.js';
import { mergeFacts } from '../src/systems/legacy/store.js';
import { newsFor, noteNews } from '../src/systems/legacy/influence.js';
import { heirloomLine } from '../src/systems/legacy/heirloom.js';
import { MARRIAGE_TEXT } from '../src/systems/legacy/marriage.js';
import { KIN_NEWS, fillLine, firstNameOf } from '../src/systems/livingWorld/lines.js';
import { sheetHouse, houseTitle } from '../src/ui/familyPages.js';
import { _resetModSaveData } from '../src/systems/modSaveData.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const mem = () => { const m = new Map(); return { map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const ent = (name) => ({
  name, gender: 'female', race: 'Redguard', faceIndex: 3, careerIndex: 5, career: { name: 'Nightblade', primarySkills: [28], majorSkills: [], minorSkills: [] },
  level: 1, characterId: 'c-janome', chargenDone: true, health: 40, maxHealth: 40, items: [], wagonItems: [],
  stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: Array.from({ length: 35 }, () => 20),
});
const SENTINEL = Object.freeze({ region: 'Sentinel', loc: 'Sentinel', mapId: 7002 });

test('LEGACY-NAME the law: a founder with no surname founds a house named for its seat - at the founding, or when the seat is noted; every member of the blood born under the nameless house takes the name; a house with a name, or no seat yet, is left as it is', () => {
  assert.equal(foundFamily(ent('Janome'), { seat: SENTINEL, rng: familyRng(1), id: 'f1' }).surname, 'of Sentinel', 'the seat known at the founding, as before');
  const f = foundFamily(ent('Janome'), { seat: null, rng: familyRng(1), id: 'f2' });
  assert.equal(f.surname, '', 'founded in Privateer\'s Hold: no town, no name yet');
  assert.equal(nameAtSeat(f), false, 'no seat, no name');
  // a sibling born under the nameless house, and a spouse from another player's house
  f.people.push({ ...f.people[0], id: 2, given: 'Imani', surname: '', characterId: null });
  f.people.push({ ...f.people[0], id: 3, given: 'Ysolde', surname: 'Hlaalu', kind: 'player', characterId: null });
  f.people.push({ ...f.people[0], id: 4, given: 'Brenna', surname: '', kind: 'resident', characterId: null });   // a townsperson of one name, wed in keeping it
  f.seat = { ...SENTINEL };
  assert.equal(nameAtSeat(f), true);
  assert.equal(f.surname, 'of Sentinel');
  assert.deepEqual(f.people.map((p) => fullNameOf(p.given, p.surname)), ['Janome of Sentinel', 'Imani of Sentinel', 'Ysolde Hlaalu', 'Brenna'], 'the blood takes it; a spouse keeps their own');
  assert.equal(nameAtSeat(f), false, 'named once');
  const named = foundFamily(ent('Ysolde Hlaalu'), { seat: null, rng: familyRng(1), id: 'f3' });
  named.seat = { ...SENTINEL };
  assert.equal(nameAtSeat(named), false);
  assert.equal(named.surname, 'Hlaalu', 'a founder\'s own surname is the house\'s');
  // a member of a seat's house, born and played: their save's name splits back whole - never "Tlist of" of "Sentinel"
  assert.deepEqual([givenOf('Tlist of Sentinel'), surnameOf('Tlist of Sentinel')], ['Tlist', 'of Sentinel']);
  assert.deepEqual([givenOf('Rillidra of Gothway Garden'), surnameOf('Rillidra of Gothway Garden')], ['Rillidra', 'of Gothway Garden']);
  const sib = f.people[1];
  writePlayer(sib, ent(fullNameOf(sib.given, sib.surname)));
  assert.deepEqual([sib.given, sib.surname], ['Imani', 'of Sentinel']);
  writePlayer(f.people[0], ent('Janome'));
  assert.equal(f.people[0].surname, 'of Sentinel', 'the founder\'s one-word name leaves the house\'s name on them');
});

test('LEGACY-NAME the host names the house as it notes the seat - the founder\'s first town - and stores it; a copy that knows the seat names a nameless copy as it merges in', () => {
  _resetModSaveData();
  _resetModSettings();
  const w = { town: null, said: [], storage: mem() };
  const host = createLegacyHost({
    entity: ent('Janome'), storage: () => w.storage, tab: () => mem(), on: () => true, online: () => false, now: () => 100, own: () => 0,
    here: () => null, town: () => w.town, nearestTown: () => null, gold: () => 0, say: (t) => w.said.push(t), boot: () => {}, search: () => '',
    loadCharacter: () => false, saveNow: () => true, hasSave: () => true, inFight: () => false, rng: familyRng(5),
  });
  setModSetting(LEGACY_MOD, 'Family.Siblings Probability', 100);
  host.found(MODELS.enduring);
  _resetModSettings();
  const f = host.family;
  assert.equal(f.surname, '');
  assert.ok(f.people.length > 1, 'siblings rolled at the founding');
  assert.equal(w.said[0], 'Your house is founded - an Enduring line: a death costs years.', 'never "The house of  is founded"');
  w.town = { ...SENTINEL };
  host.tick();
  assert.equal(f.surname, 'of Sentinel');
  assert.ok(f.people.every((p) => p.surname === 'of Sentinel'), 'the founder and every sibling');
  assert.deepEqual(w.said.slice(-2), [LEGACY_TEXT.seat('Sentinel'), 'Your house takes its seat\'s name: the house of Sentinel.'], 'the seat, and the name it gave');
  assert.match(w.storage.getItem(`dagger.legacy.family.${f.id}`) ?? '', /"surname":"of Sentinel"/, 'stored with the seat');
  // two copies: the one that never saw the seat takes the name with it
  const stale = JSON.parse(JSON.stringify(f));
  stale.surname = ''; stale.seat = null;
  for (const p of stale.people) p.surname = '';
  mergeFacts(stale, f);
  assert.equal(stale.surname, 'of Sentinel');
  assert.ok(stale.people.every((p) => p.surname === 'of Sentinel'));
  // AUDIT FB1007b S1: the name comes from the copy that holds it (test/fb1007b_familyseat.test.js) - and where neither
  // does (a copy that noted its seat before houses were named for it), the merge names the house for the seat
  const unnamed = JSON.parse(JSON.stringify(stale));
  unnamed.surname = '';
  for (const p of unnamed.people) p.surname = '';
  const hold = JSON.parse(JSON.stringify(unnamed));
  hold.seat = null;
  mergeFacts(hold, unnamed);
  assert.equal(hold.surname, 'of Sentinel');
  assert.ok(hold.people.every((p) => p.surname === 'of Sentinel'));
});

test('LEGACY-NAME the words: a seat\'s house says itself once - the pages, the sheet, the founding, the heirloom, the wedding, the news; a nameless house says no blank; the news never doubles a member\'s surname', () => {
  assert.equal(houseWord('of Sentinel'), 'Sentinel');
  assert.equal(houseWord('Hlaalu'), 'Hlaalu');
  assert.equal(houseWord(''), '');
  assert.equal(houseTitle('of Sentinel'), 'The House of Sentinel');
  assert.equal(houseTitle('Hlaalu'), 'The House of Hlaalu');
  assert.equal(houseTitle(''), 'The House');
  const f = foundFamily(ent('Janome'), { seat: SENTINEL, rng: familyRng(1), id: 'f4' });
  assert.equal(sheetHouse({ on: () => true, family: () => f, lived: () => 0 }).title, 'The House of Sentinel');
  assert.equal(LEGACY_TEXT.founded('of Sentinel', MODELS.bloodline), 'The house of Sentinel is founded - a Bloodline: a death is final.');
  assert.equal(LEGACY_TEXT.ended('of Sentinel'), 'The house of Sentinel goes on.');
  assert.equal(MARRIAGE_TEXT.wed('Aldo Marane', 'of Sentinel'), 'You and Aldo Marane are wed. Aldo Marane is of the house of Sentinel now.');
  assert.match(heirloomLine({ heirloom: { line: 'f4', house: 'of Sentinel', from: 'Janome', gen: 0 } }), /^Heirloom of the house of Sentinel, first borne by Janome/);
  noteNews(f, 'died', 'Janome of Sentinel', 10, SENTINEL.mapId);
  const [item] = newsFor(f, SENTINEL.mapId, 20);
  assert.equal(item.house, 'Sentinel', 'the news says House Sentinel, never House of Sentinel');
  // no line of the house's news says "{who} {house}" - "Tlist Sentinel" for a seat's house. PIN MOVED (AUDIT LEGACY III
  // A16/F2): `{who}` is filled as the renderer fills it, with the member's FIRST name (meetups.js firstNameOf) - this pin
  // filled the whole name, which no town passes, and the record called the old line a doubled surname
  for (const [kind, scripts] of Object.entries(KIN_NEWS)) {
    for (const s of scripts) for (const line of s) assert.doesNotMatch(line, /\{who\} \{house\}/, `${kind}: "${line}"`);
  }
  assert.equal(fillLine(KIN_NEWS.died[2][0], { who: firstNameOf('Ysolde Hlaalu'), house: 'Hlaalu' }), 'Ysolde, gone. I saw them in the market not a week past.');
  // PIN MOVED (AUDIT LW-II B14): a band's rout is told by its whole name ("the Red Hand" - its first word was "the"); every
  // other tale, the house's news among them, by the first name still
  assert.match(rd('src/systems/livingWorld/meetups.js'), /who: told \? \(told\.item\.kind === 'routed' \? told\.item\.who : firstNameOf\(told\.item\.who\)\) : null/, 'the renderer\'s own fill');
  // the pages read the one title (by source - drawn in test/legacysheet and test/legacy3_familytab)
  const pages = rd('src/ui/familyPages.js');
  assert.doesNotMatch(pages, /House of \$\{(family|f)\.surname\}/, 'no page says the raw surname after "House of"');
  assert.doesNotMatch(pages, /house of \$\{family\.surname\}/);
  assert.doesNotMatch(rd('src/scenes/legacyHost.js'), /house of \$\{family\.surname\}/);
  // ...and the Succession's own words in the world host (scenes/world.js openLegacySuccession, openLegacyDeadLoad)
  const w = rd('src/scenes/world.js');
  assert.match(w, /const legacyHouse = \(fam, the = 'the'\) => `\$\{the\} house\$\{houseWord\(fam\?\.surname\) \? ` of \$\{houseWord\(fam\.surname\)\}` : ''\}`;/);
  assert.equal((w.match(/legacyHouse\(fam/g) ?? []).length, 5, 'the heir\'s line, the house going on or ended, the past loaded');
  assert.doesNotMatch(w, /house of \$\{fam/, 'never the raw surname after "house of"');
});
