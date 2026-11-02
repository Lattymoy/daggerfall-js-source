// COURT-DEEDS (2026-10-26, Discord #feature-feedback "Better Courtship": "Compliments, giving gifts, hugging, kissing ...
// Right now it's confusing on what exactly you're supposed to use to improve relationships";
// bible/01-Overview/bugs/Field-Bugs-2026-10-26d.md): a compliment, a gift, a hug and a kiss on the Tell me about page,
// each once a day, each saying what it moved. Through the real host (scenes/legacyHost.js topicRows) over the real
// relations (systems/livingWorld/regardClock.js characterRelations - the one construction point world.js uses).
// AUDIT FB1026d (B1-B6, E4, E10): a reload through the real mod-save registry, the regard read as it stands, the tone
// counted, and who is offered what. Mutants: tools/mutants/fb1026d_courtdeeds.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { court, wed, AFFECTION_MAX } from '../../../src/systems/legacy/marriage.js';
import { FRIEND_AT, EVENTS, createRelations } from '../../../src/systems/livingWorld/relations.js';
import { registerModSaveData, modSaveRecords, restoreModSaveRecords } from '../../../src/systems/modSaveData.js';
import { familyGuide } from '../../../src/ui/familyPages.js';
import { regardBadge } from '../../../src/systems/livingWorld/people.js';
import { characterRelations, regardDayOf } from '../../../src/systems/livingWorld/regardClock.js';
import { personOf, MODELS, COURT_DEEDS } from '../../../src/systems/legacy/family.js';
import { createLegacyHost } from '../../../src/scenes/legacyHost.js';
import { DEEDS, GIFT_GOLD, KISS_AT, DEED_AFFECTION, deedsFor } from '../../../src/systems/legacy/courtDeeds.js';

const RES = Object.freeze({ id: 'L120.4', name: 'Aldo Marane', sex: 'male', race: 'Breton', face: 312, town: 120, roll: 'h' });
const DAY = 1440;

/** The host over a made member, a purse of `gold`, and the Living World's relations on the member's own clock. */
function world({ gold = 200, regards = true } = {}) {
  const store = new Map();
  const w = { own: 10 * DAY, said: [], writes: 0, legacy: true };
  const storage = { get length() { return store.size; }, key: (i) => [...store.keys()][i] ?? null, getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { w.writes++; store.set(k, String(v)); }, removeItem: (k) => store.delete(k) };
  w.e = {
    name: 'Ysolde Hlaalu', race: 'DarkElf', gender: 'female', faceIndex: 2, level: 4, chargenDone: true, characterId: 'c1', goldPieces: gold, items: [],
    stats: { Strength: 50, Intelligence: 60, Willpower: 50, Agility: 55, Endurance: 50, Personality: 70, Speed: 50, Luck: 50 },
    skills: Array.from({ length: 35 }, (_, i) => (i === 1 ? 40 : 20)),
    career: { name: 'Bard', primarySkills: [1], majorSkills: [2], minorSkills: [3] }, careerIndex: 1,
  };
  w.rel = characterRelations(null, () => w.own, false);
  w.host = createLegacyHost({
    entity: w.e, storage: () => storage, tab: () => storage, on: () => w.legacy, online: () => false, now: () => w.own, own: () => w.own,
    here: () => ({ pixel: { x: 1, y: 1 }, region: 'Daggerfall', mode: 'exterior', loc: 'Ashbury', locationType: 0 }), town: () => null,
    nearestTown: () => ({ region: 'Daggerfall', loc: 'Ashbury' }), gold: () => w.e.goldPieces, say: (l) => w.said.push(l), boot: () => {}, search: () => '?world',
    loadCharacter: () => false, saveNow: () => true, inFight: () => false, rng: () => 0, livingWorld: () => true,
    regards: () => (regards ? w.rel : null), regardDay: () => w.rel.today(),
  });
  w.host.found(MODELS.enduring);
  w.host.family.people = w.host.family.people.slice(0, 1);
  w.me = personOf(w.host.family, w.host.family.currentId);
  w.ctx = () => ({ regard: w.rel.regard(RES.id), personality: 70, etiquette: 40, townName: 'Ashbury' });
  w.rows = () => w.host.topicRows(RES, w.ctx());
  w.deed = (kind, taste = 0, heard = null) => w.rows().find((r) => r.topic === `deed:${kind}`).legacy.answer(1, taste, heard);
  w.court = (at = FRIEND_AT) => { w.rel.note(RES.id, 'talk', 0, at); court(w.me, RES, { day: 0, townName: 'Ashbury', personality: 70, etiquette: 40, taste: 0, roll: 0 }); return w.me.courting[RES.id]; };
  return w;
}

test('COURT-DEEDS THE ROWS: a stranger of a household is offered all four after the courtship\'s rows - never one of the watch or a traveller (mutant: the deeds unoffered)', () => {
  const w = world();
  assert.deepEqual(w.rows().map((r) => r.label), ['Pay a compliment', `Give a gift (${GIFT_GOLD} gold)`, 'Hug', 'Kiss'], 'a stranger: no Courtship yet, every deed');
  assert.deepEqual(w.host.topicRows({ ...RES, roll: 'w', guard: true }, w.ctx()), []);
  assert.deepEqual(w.host.topicRows({ ...RES, roll: 't' }, w.ctx()), []);
  w.rel.note(RES.id, 'talk', 0, FRIEND_AT);
  assert.deepEqual(w.rows().map((r) => r.topic), ['court', 'deed:compliment', 'deed:gift', 'deed:embrace', 'deed:kiss'], 'a friend: Courtship first');
  assert.deepEqual(DEEDS, ['compliment', 'gift', 'embrace', 'kiss']);
});

test('COURT-DEEDS EACH DEED SAYS WHAT IT MOVED, ONCE A DAY: a compliment +2, a gift +8 for its gold, a hug and a kiss refused kindly with what they wait on - and the next day again (mutants: a deed counted twice a day; the gift free; the tally unsaid)', () => {
  const w = world();
  assert.match(w.deed('compliment'), /Flatterer.*\(Regard \+2, now \+2\.\)$/);
  assert.equal(w.rel.regard(RES.id), EVENTS.compliment);
  assert.match(w.deed('compliment'), /Once a day is plenty/, 'once a day');
  assert.equal(w.rel.regard(RES.id), EVENTS.compliment, 'nothing more today');
  assert.match(w.deed('gift'), /For me\?.*\(Regard \+8, now \+10\.\)$/);
  assert.equal(w.e.goldPieces, 200 - GIFT_GOLD, 'the gift\'s gold taken');
  assert.match(w.deed('gift'), /Once a day/);
  assert.equal(w.e.goldPieces, 200 - GIFT_GOLD, 'a gift refused for the day costs nothing');
  assert.match(w.deed('embrace'), /We hardly know each other.*regard \+40/, 'a hug waits on a friend - and says so');
  assert.match(w.deed('kiss'), /Not yet.*courtship of 34 or more/, 'a kiss waits on a courtship - and says so');
  assert.equal(w.rel.regard(RES.id), 10, 'a refusal costs nothing');
  w.own += DAY;   // the next day of the member's own clock
  assert.match(w.deed('compliment'), /\(Regard \+2, now \+11\.\)$/, 'counted again the next day (10 eased half a point for the day apart, then 2)');
  // a compliment in a tone they take ill falls flat: nothing gained, the day spent
  w.own += DAY;
  assert.match(w.deed('compliment', -1), /Is that meant to be a compliment\?.*\(Regard \+0/);
  // and a purse short of a gift is told so, nothing taken
  const poor = world({ gold: GIFT_GOLD - 1 });
  assert.match(poor.deed('gift'), new RegExp(`haven't the ${GIFT_GOLD} gold`));
  assert.equal(poor.e.goldPieces, GIFT_GOLD - 1);
  assert.equal(poor.rel.regard(RES.id), 0);
});

test('COURT-DEEDS A COURTSHIP WARMED: while courting, each deed adds its affection and says the courtship\'s count; a hug is welcome from the first day courted, a kiss from KISS_AT; a full courtship takes no more (mutants: the affection unwarmed; the kiss\'s gate unread)', () => {
  const w = world();
  w.rel.note(RES.id, 'talk', 0, FRIEND_AT);
  court(w.me, RES, { day: 0, townName: 'Ashbury', personality: 70, etiquette: 40, taste: 0, roll: 0 });
  const c = w.me.courting[RES.id];
  const a0 = c.affection;
  assert.match(w.deed('compliment', 1), new RegExp(`Courtship \\+${DEED_AFFECTION.compliment + 1}, now ${a0 + DEED_AFFECTION.compliment + 1} of ${AFFECTION_MAX}\\.\\)$`), 'a tone taken kindly: one more');
  assert.match(w.deed('embrace'), /holds you close.*Courtship \+5/);
  assert.ok(c.affection < KISS_AT, `under the kiss's mark (${c.affection})`);
  assert.match(w.deed('kiss'), /Not yet/);
  c.affection = KISS_AT;
  assert.match(w.deed('kiss'), new RegExp(`kisses you back.*Courtship \\+${DEED_AFFECTION.kiss}, now ${KISS_AT + DEED_AFFECTION.kiss} of`));
  c.affection = AFFECTION_MAX - 2;
  assert.match(w.deed('gift'), new RegExp(`Courtship \\+2, now ${AFFECTION_MAX} of ${AFFECTION_MAX}`), 'held to the full mark');
  assert.equal(c.affection, AFFECTION_MAX);
});

test('COURT-DEEDS THE DAYS ARE KEPT: each deed\'s day rides the regard\'s own record through the save, so a reload never hands a second one (mutant: a stamp unsaved)', () => {
  const rel = createRelations();
  rel.note('L1.0', 'compliment', 5);
  rel.note('L1.0', 'gift', 5);
  rel.note('L1.0', 'embrace', 5);
  rel.note('L1.0', 'kiss', 5);
  const back = createRelations(JSON.parse(JSON.stringify(rel.snapshot())));
  for (const k of DEEDS) assert.equal(back.deedDay('L1.0', k), 5, k);
  const r = back.regard('L1.0', 5);
  for (const k of DEEDS) back.note('L1.0', k, 5);
  assert.equal(back.regard('L1.0', 5), r, 'none counts twice on the day');
  assert.equal(regardDayOf(0) < regardDayOf(DAY), true);
});

test('COURT-DEEDS WHO IS OFFERED WHAT: a spouse every deed, a kiss welcome without a courtship and no courtship counted; a member wed offers anyone else no kiss (mutants: the spouse\'s kiss refused; a kiss offered past a marriage)', () => {
  const w = world();
  wed(w.host.family, w.me, { id: RES.id, name: RES.name, sex: RES.sex, race: RES.race, face: RES.face, mapId: RES.town }, w.own, { takeName: false });
  assert.deepEqual(deedsFor(w.host.family, w.me, RES), [...DEEDS]);
  assert.deepEqual(w.rows().map((r) => r.topic), ['family', 'deed:compliment', 'deed:gift', 'deed:embrace', 'deed:kiss']);
  assert.match(w.deed('kiss'), /kisses you back\. \(Regard \+4, now \+4\.\)$/, 'a spouse: no courtship to count');
  const other = { ...RES, id: 'L120.5', name: 'Bena Toll' };
  assert.deepEqual(deedsFor(w.host.family, w.me, other), ['compliment', 'gift', 'embrace']);
  assert.deepEqual(deedsFor(null, w.me, RES), []);
});

test('COURT-DEEDS A RELOAD HANDS NOTHING AGAIN (AUDIT FB1026d B1/E4): each deed\'s day rides the courtship it warmed and the house\'s record keeps it - a load that hands the regard, its days and the purse back never hands the affection again (mutants: a deed\'s day off the courtship; the day dropped at load; the warm unsaved)', () => {
  const w = world();
  // world.js's LIVING_WORLD_VENDOR as it stands: the relations ride the character's save
  registerModSaveData('LivingWorld', { newSaveData: () => null, getSaveData: () => w.rel.snapshot(), restoreSaveData: (rec) => { w.rel = characterRelations(rec, () => w.own, false); } });
  w.court().affection = KISS_AT;
  const save = () => JSON.parse(JSON.stringify({ gold: w.e.goldPieces, mod: modSaveRecords() }));
  const load = (s0) => { w.e.goldPieces = s0.gold; restoreModSaveRecords(JSON.parse(JSON.stringify(s0.mod))); w.me = personOf(w.host.family, w.host.family.currentId); };
  const s0 = save();
  for (const k of DEEDS) assert.doesNotMatch(w.deed(k, 1), /Once a day/, k);
  const warmed = w.me.courting[RES.id].affection;
  assert.equal(warmed, KISS_AT + DEED_AFFECTION.compliment + 1 + DEED_AFFECTION.gift + DEED_AFFECTION.embrace + DEED_AFFECTION.kiss);
  load(s0);
  assert.equal(w.e.goldPieces, 200, 'the save\'s purse');
  assert.equal(w.rel.deedDay(RES.id, 'gift'), null, 'the save\'s regard: no deed today');
  assert.equal(w.me.courting[RES.id].affection, warmed, 'the house\'s record kept the affection');
  assert.deepEqual(w.me.courting[RES.id].deeds, Object.fromEntries(DEEDS.map((k) => [k, w.rel.today()])), 'and each deed\'s day with it');
  // AUDIT FB1026d II B1: the save's own day stamps the regard, the courtship's its warm - the regard the load took back
  // comes again, the affection never
  for (const k of DEEDS) {
    const said = w.deed(k, 1);
    assert.match(said, /\(Regard \+\d+, now \+\d+\.\)$/, `${k}: the regard again - the save's`);
    assert.doesNotMatch(said, /Courtship/, `${k}: the affection never`);
  }
  assert.equal(w.me.courting[RES.id].affection, warmed, 'nothing more');
  assert.equal(w.e.goldPieces, 150, 'the gift paid out of the save\'s purse, once in this game');
  for (const k of DEEDS) assert.match(w.deed(k, 1), /Once a day is plenty/, `${k}: and once a day`);
  w.own += DAY;
  assert.match(w.deed('compliment', 1), /Courtship \+4/, 'the next day');
  assert.deepEqual(COURT_DEEDS, DEEDS, 'the loader keeps the days of every deed');
  // AUDIT FB1026d II B1: a save from days before - the deeds of the days rewound give their regard and wait to warm
  const back = save(), backOwn = w.own;
  for (let d = 0; d < 3; d++) { w.own += DAY; assert.match(w.deed('compliment', 1), /Courtship \+4/, `day ${d + 1} on`); }
  const ahead = w.me.courting[RES.id].deeds.compliment;
  load(back); w.own = backOwn + DAY;   // the day after the save's (it was saved on a compliment's day): the courtship's record two days past it
  assert.ok(w.rel.today() < ahead);
  assert.match(w.deed('compliment', 1), /^Aldo smiles\. .*\(Regard \+2, now \+\d+\.\)$/, 'rewound: the regard, never "Once a day" for a day the save never saw');
  while (w.rel.today() <= ahead) w.own += DAY;
  assert.match(w.deed('compliment', 1), /Courtship \+4/, 'past the courtship\'s last day: warmed again');
});

test('COURT-DEEDS THE REGARD AS IT STANDS, AND THE TONE COUNTED (AUDIT FB1026d B2/B3, II B2): a hug on the same page as the gift that made them a friend is welcome, the tone is heard as a deed lands and a refused one costs nothing, and the tally says what the whole answer moved, the tone\'s cost with it (mutants: the page\'s regard read; the tone unheard; the tone uncounted)', () => {
  const w = world();
  w.rel.note(RES.id, 'talk', 0, FRIEND_AT - 7);
  const rows = w.rows();   // the page, built once as Tell me about opens
  const on = (k) => rows.find((r) => r.topic === `deed:${k}`).legacy;
  assert.match(on('gift').answer(1, 0), /\(Regard \+8, now \+41\.\)$/);
  assert.match(on('embrace').answer(1, 0), /holds you close.*\(Regard \+3, now \+44\.\)$/, 'a friend now, on the same page');
  // Polite to a townsperson: taken ill - the tone's -6 heard in the same answer as the deed
  const insulted = (x) => () => x.rel.note(RES.id, 'insulted', x.rel.today());
  const T = world();
  T.rel.note(RES.id, 'talk', 0, FRIEND_AT + 1);
  const page = T.rows();
  assert.match(page.find((r) => r.topic === 'deed:embrace').legacy.answer(0, -1, insulted(T)), /holds you close.*\(Regard -3, now \+38\.\)$/, 'a friend as asked: the hug lands, its tone counted in the same answer');
  const R = world();
  R.rel.note(RES.id, 'talk', 0, FRIEND_AT - 1);
  assert.match(R.deed('embrace', -1, insulted(R)), /We hardly know each other/);
  assert.equal(R.rel.regard(RES.id, R.rel.today()), FRIEND_AT - 1, 'AUDIT FB1026d II B2: refused, the tone unheard - nothing lost');
  const U = world();
  U.rel.note(RES.id, 'talk', 0, FRIEND_AT + 1);
  assert.match(U.deed('compliment', -1, insulted(U)), /Is that meant to be a compliment\?.*\(Regard -6, now \+35\.\)$/, 'the tone\'s cost said with the flat compliment');
  // the talk window hands a deed row its tone (and every other row hears it first, as LW7 laid down)
  const talk = readFileSync(new URL('../../../src/scenes/townTalk.js', import.meta.url), 'utf8');
  assert.match(talk, /if \(row\.legacy\?\.hearsTone\) return row\.legacy\.answer\(tone, _toneTaste\(\), _toneHeard\);\n\s*_toneHeard\(\);   \/\/ LW7/);
  assert.ok(rows.filter((r) => r.topic.startsWith('deed:')).every((r) => r.legacy.hearsTone === true));
});

test('COURT-DEEDS WHO IS OFFERED NONE (AUDIT FB1026d B5/E10): one of the house, one betrothed to another member, and a host with no Living World offer no deed; a member wed offers anyone else no kiss; and the badge and the Family page say the deeds as they are offered (mutants: the house\'s own offered; another\'s betrothed offered; the Living World unread; a kiss offered past a marriage; the page\'s deeds unsaid)', () => {
  const w = world();
  // a resident who married into the house (a sibling's spouse): one of the house
  const kin = { id: 'p-kin', kind: 'resident', residentId: RES.id, given: 'Aldo', surname: 'Marane', died: null };
  w.host.family.people.push(kin);
  assert.deepEqual(deedsFor(w.host.family, w.me, RES), []);
  w.host.family.people.pop();
  // betrothed to another member
  const sister = { id: 'p-sister', kind: 'blood', given: 'Ilsa', surname: 'Hlaalu', died: null, courting: { [RES.id]: { affection: AFFECTION_MAX, betrothed: true } } };
  w.host.family.people.push(sister);
  assert.deepEqual(deedsFor(w.host.family, w.me, RES), []);
  w.host.family.people.pop();
  assert.deepEqual(deedsFor(w.host.family, w.me, RES), [...DEEDS]);
  assert.deepEqual(world({ regards: false }).rows().filter((r) => r.topic.startsWith('deed:')), [], 'the host\'s guard: no relations handed, no deeds (world.js always hands them)');
  const off = world(); off.legacy = false;
  assert.deepEqual(off.rows().filter((r) => r.topic.startsWith('deed:')), [], 'AUDIT FB1026d II B4/B7: Project Legacy off - the gate a player meets - no deeds, and the badge says so');
  assert.match(regardBadge({ regard: 12, standing: 'neutral' }).words, /with Project Legacy, so do the deeds Tell me about offers a townsperson you could court - a compliment, a gift, and a hug once you are friends - each once a day\./);
  const guide = familyGuide(MODELS.enduring, 0.06).find(([k]) => k === 'Marriage and children')[1];
  assert.match(guide, new RegExp(`Paying a compliment and giving a gift \\(${GIFT_GOLD} gold\\) raise it faster, each once a day under Tell me about\\..* a compliment, a gift, a hug, and from ${KISS_AT} affection a kiss, each once a day, warm the courtship too\\.`));
});

test('COURT-DEEDS A COURTSHIP\'S DEEDS (AUDIT FB1026d B5/B6): a hug is welcome from one courting them though no longer a friend; a gift adds its affection; a compliment taken ill adds none and writes nothing (mutants: the hug\'s courtship arm unread; the gift\'s affection; a compliment taken ill warming; a warm of nothing written)', () => {
  const w = world();
  const c = w.court();
  w.rel.note(RES.id, 'struck', 0);   // a blow: far below a friend, and still courted
  assert.ok(w.rel.regard(RES.id) < FRIEND_AT);
  const a0 = c.affection;
  assert.match(w.deed('embrace'), /holds you close.*Courtship \+5/);
  assert.match(w.deed('gift'), new RegExp(`Courtship \\+${DEED_AFFECTION.gift}, now ${a0 + DEED_AFFECTION.embrace + DEED_AFFECTION.gift} of`));
  const writes = w.writes, a1 = c.affection;
  assert.match(w.deed('compliment', -1), /Is that meant to be a compliment\?.*Courtship \+0, now /);
  assert.equal(c.affection, a1, 'none added');
  assert.equal(w.writes, writes, 'and nothing written');
});
