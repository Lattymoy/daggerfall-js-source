// TONE-TASTE (2026-10-15, bible/06-Systems/Living-World.md "TONE-TASTE"; Mac, of a stream: "someone who didnt like
// etiquette still went up"): a question's tone counts as the one spoken to TOOK it, never by its name. DFU's own tables
// (talkTopics.js ETIQUETTE_REACTION_MODS / STREETWISE_REACTION_MODS - a Commoner takes Polite ill and Blunt kindly, a
// Noble the reverse) were read by the talk's answer alone; a Living World resident's regard (+1 a polite word, -6 a
// blunt one) and a courtship (+3 Polite, -3 Blunt) went by the tone's name, so a Polite word raised a Commoner who
// refuses it. Mac's choice: a tone they like raises both, one they dislike lowers both. Pinned on the law, the real
// town and its relations, the real Legacy host, and the talk's own door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toneTaste, ETIQUETTE_REACTION_MODS, STREETWISE_REACTION_MODS } from '../../../src/systems/talk/talkTopics.js';
import { SOCIAL_GROUP } from '../../../src/systems/npcSession.js';
import { synthTown } from '../../lwTown.mjs';
import { LivingTown } from '../../../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../../../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED } from '../../../src/characters/mobile/mobilePerson.js';
import { DAY_MIN } from '../../../src/systems/livingWorld/dayPlan.js';
import { createRelations, EVENTS, FRIEND_AT } from '../../../src/systems/livingWorld/relations.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../../../src/systems/worldTick.js';
import { courtGain, court, COURT_BASE, COURT_TASTE, MARRIAGE_TEXT } from '../../../src/systems/legacy/marriage.js';
import { MODELS } from '../../../src/systems/legacy/family.js';
import { createLegacyHost } from '../../../src/scenes/legacyHost.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const POLITE = 0, NORMAL = 1, BLUNT = 2;
const { Commoners, Merchants, Scholars, Nobility, Underworld } = SOCIAL_GROUP;

test('TONE-TASTE the law: how a group takes a tone is the sign of its row in DFU\'s own tables - Polite kindly by Merchants, Scholars and Nobles, ill by Commoners and the Underworld; Blunt the reverse, Merchants kindly by both; the Normal tone nothing; sgroup 5 and up folds to the Merchants as the reaction folds it; a group off the tables takes nothing (mutants: the sign, the tables swapped, the fold)', () => {
  assert.deepEqual([Commoners, Merchants, Scholars, Nobility, Underworld].map((g) => toneTaste(POLITE, g)), [-1, 1, 1, 1, -1]);
  assert.deepEqual([Commoners, Merchants, Scholars, Nobility, Underworld].map((g) => toneTaste(BLUNT, g)), [1, 1, -1, -1, 1]);
  assert.deepEqual([Commoners, Merchants, Scholars, Nobility, Underworld].map((g) => toneTaste(NORMAL, g)), [0, 0, 0, 0, 0]);
  for (let g = 0; g < 5; g++) {
    assert.equal(toneTaste(POLITE, g), Math.sign(ETIQUETTE_REACTION_MODS[g]), `Polite, group ${g}: the table's own`);
    assert.equal(toneTaste(BLUNT, g), Math.sign(STREETWISE_REACTION_MODS[g]), `Blunt, group ${g}`);
  }
  for (const g of [SOCIAL_GROUP.SGroup5, SOCIAL_GROUP.SupernaturalBeings, SOCIAL_GROUP.GuildMembers]) {
    assert.deepEqual([toneTaste(POLITE, g), toneTaste(BLUNT, g)], [1, 1], `group ${g} folds to the Merchants`);
  }
  assert.deepEqual([toneTaste(POLITE, SOCIAL_GROUP.None), toneTaste(BLUNT, SOCIAL_GROUP.None)], [0, 0], 'no group: nothing');
  assert.equal(toneTaste(POLITE), -1, 'with no group named, a Commoner\'s - every mobile\'s');
});

function makeTown(rel) {
  const { nav, buildings, doors } = synthTown();
  const clock = { t: 100 * DAY_MIN + 600 };
  const town = new LivingTown(nav, {
    town: { mapId: 12345, blocks: 9, region: 17, people: 3, port: false }, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0 }),
    clock: () => clock.t, rate: () => CLASSIC_MINUTES_PER_SECOND, mpm: PERSON_MOVE_SPEED / CLASSIC_MINUTES_PER_SECOND, relations: () => rel,
  });
  town._now = clock.t;
  return { town, day: town.dayOf(clock.t) };
}

test('TONE-TASTE the regard: on the real town, a townsperson (a Commoner, as every mobile is) spoken to Polite thinks LESS of the player - the word\'s +3 and the ill tone\'s -6 - and Blunt more, each once a day; the stream\'s case no longer rises (mutants: the doors\' kinds swapped)', () => {
  const rel = createRelations();
  const { town, day } = makeTown(rel);
  const [a, b] = town.residents;
  const said = (r) => ({ living: { id: r.id, res: r, town }, nameNPC: r.name });
  town.talked(said(a));
  town.toned(said(a), toneTaste(POLITE, Commoners));
  assert.equal(rel.regard(a.id, day), EVENTS.talk + EVENTS.insulted, 'Polite to a Commoner: down, never up');
  assert.ok(rel.regard(a.id, day) < 0);
  town.toned(said(a), toneTaste(POLITE, Commoners));
  assert.equal(rel.regard(a.id, day), EVENTS.talk + EVENTS.insulted, 'once a day');
  town.talked(said(b));
  town.toned(said(b), toneTaste(BLUNT, Commoners));
  assert.equal(rel.regard(b.id, day), EVENTS.talk + EVENTS.polite, 'Blunt to a Commoner: the kind word');
  assert.equal(town.toned(said(b), toneTaste(NORMAL, Commoners)), null, 'the Normal tone: nothing');
  assert.equal(town.toned(said(b), toneTaste(POLITE, Nobility)), b.id, 'a Noble\'s taste the reverse');
  assert.equal(rel.regard(b.id, day), EVENTS.talk + EVENTS.polite, 'and still once a day');
});

function hostWorld() {
  const store = new Map();
  const storage = { get length() { return store.size; }, key: (i) => [...store.keys()][i] ?? null, getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const w = { own: 0 };
  w.host = createLegacyHost({
    entity: {
      name: 'Ysolde Hlaalu', race: 'DarkElf', gender: 'female', faceIndex: 2, level: 4, chargenDone: true, characterId: 'c1',
      stats: { Strength: 50, Intelligence: 60, Willpower: 50, Agility: 55, Endurance: 50, Personality: 70, Speed: 50, Luck: 50 },
      skills: Array.from({ length: 35 }, (_, i) => (i === 1 ? 40 : 20)),
      career: { name: 'Bard', primarySkills: [1], majorSkills: [2], minorSkills: [3] }, careerIndex: 1,
    },
    storage: () => storage, tab: () => storage, on: () => true, online: () => false, now: () => w.own, own: () => w.own,
    here: () => ({ pixel: { x: 1, y: 1 }, region: 'Daggerfall', mode: 'exterior', loc: 'Ashbury', locationType: 0 }), town: () => null,
    nearestTown: () => ({ region: 'Daggerfall', loc: 'Ashbury' }), gold: () => 100, say: () => {}, boot: () => {}, search: () => '?world',
    loadCharacter: () => false, saveNow: () => true, inFight: () => false, rng: () => 0.5,
    templeOf: () => null, askWed: () => true, livingWorld: () => true,
  });
  w.host.found(MODELS.enduring);
  w.host.family.people = w.host.family.people.slice(0, 1);
  return w;
}

test('TONE-TASTE the courtship: through the real Legacy host, a tone the resident takes ill COSTS the day\'s courtship COURT_TASTE (never past nothing) and is said so; one taken kindly adds COURT_TASTE; the Normal tone neither (mutants: the loss, its floor, its words, the kind term)', () => {
  assert.equal(courtGain({ personality: 100, etiquette: 100, taste: -1, roll: 1 }), -COURT_TASTE, 'taken ill: a loss, whatever the rest');
  assert.equal(courtGain({ personality: 0, etiquette: 0, taste: 1, roll: 0.5 }) - courtGain({ personality: 0, etiquette: 0, taste: 0, roll: 0.5 }), COURT_TASTE);
  assert.equal(courtGain({ personality: 0, etiquette: 0, taste: 0, roll: 0.5 }), COURT_BASE);
  const RES = { id: 'L120.4', name: 'Aldo Marane', sex: 'male', race: 'Breton', face: 312, town: 120, roll: 'h' };
  const w = hostWorld();
  const me = w.host.family.people[0];
  const ctx = { regard: FRIEND_AT, personality: 50, etiquette: 40, townName: 'Ashbury' };
  const ask = (tone, group) => w.host.topicRows(RES, ctx)[0].legacy.answer(tone, toneTaste(tone, group));
  assert.equal(ask(POLITE, Commoners), MARRIAGE_TEXT.cooled('Aldo'), 'the stream\'s case: Polite to a Commoner, said cooled');
  assert.equal(me.courting[RES.id].affection, 0, 'never past nothing');
  w.own = 1440;
  assert.equal(ask(BLUNT, Commoners), MARRIAGE_TEXT.courted('Aldo', me.courting[RES.id].affection), 'Blunt: courted');
  const kind = me.courting[RES.id].affection;
  assert.equal(kind, courtGain({ personality: 50, etiquette: 40, taste: 1, roll: 0.5 }), 'the kind tone\'s day, whole');
  w.own = 2 * 1440;
  ask(POLITE, Commoners);
  assert.equal(me.courting[RES.id].affection, kind - COURT_TASTE, 'Polite again: COURT_TASTE lost');
  assert.match(MARRIAGE_TEXT.cooled('Aldo'), /^Aldo /, 'the line names them');
  const c = { courting: {} };
  const r = court(c, RES, { day: 1, taste: -1 });
  assert.deepEqual([r.gained === 0, r.cooled, r.again], [true, true, false], 'the law answers cooled');
});

test('TONE-TASTE the talk\'s door: the window hears the tone as the one spoken to took it - their group\'s, off the engine\'s own session (a mobile\'s a Commoner\'s) - for the regard and for the Legacy host\'s answer alike (mutants: the group, the answer\'s taste)', () => {
  const tt = rd('src/scenes/townTalk.js');
  assert.match(tt, /const _toneTaste = \(\) => toneTaste\(tone, engine\(\)\?\.session\?\.npcData\?\.socialGroup \?\? 0\);/);
  assert.match(tt, /const _toneHeard = \(\) => \{ if \(_toneTarget\) livingTone\?\.\(_toneTarget, _toneTaste\(\)\); \};/);
  assert.match(tt, /if \(row\.legacy\) return row\.legacy\.answer\(tone, _toneTaste\(\)\);/);
  const lh = rd('src/scenes/legacyHost.js');
  assert.match(lh, /answer: \(tone, taste\) => answerTopic\(t, res, taste, ctx\)/);
  assert.match(lh, /r\.cooled \? MARRIAGE_TEXT\.cooled\(first\) :/);
});
