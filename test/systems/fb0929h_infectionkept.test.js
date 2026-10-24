// FIELD BUGS 2026-09-29h (INFECTION-KEPT) - Julian: "Lycanthropy still tied to server clock. I was able to rest to
// activate the initial 'you dream of the moon' dream. but for the next phase ... resting did not progress the disease.
// during this time i had gotten another disease from a dungeon and had to cure it which likely wiped my lycanthropy
// progress." Mac, on the batch's first answer (that the cure ending the infection is DFU's own law): "Dont worry abour
// DFU."
//
// The incubation runs on the character's own clock and an online rest moves it (LIVED1, test/systems/lived1.test.js) - the
// dream came, and the turn waits for the fourth day. What ended it was the cure: DFU stores an infection as a disease
// bundle, and CureAllDiseases ended it with the plague caught beside it. A cure of disease takes the plain diseases
// first now - the temple's (paid or free), a spell's and a potion's alike - and the infection only when it is all there
// is, so a player who wants rid of it still cures it before the turn; the temple prices what it takes. The turn's own
// CureAll of the old life still ends every disease there is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startInfection, infectionStep, markDreamPlayed, INFECTION } from '../../src/systems/infection.js';
import { startDisease, DISEASES, diseaseCount, curableDiseaseCount } from '../../src/systems/diseases.js';
import { applySpell, cureAllDiseases, cureDiseasesInfectionsLast } from '../../src/systems/effects.js';
import { cureDiseaseOffer, payForCure, cureForFree } from '../../src/systems/guild/guildServiceActions.js';
import { endOldLifeEffects } from '../../src/systems/lycanthropy.js';
import { templeOf } from '../../src/systems/guild/guildVariants.js';

const MARA = templeOf('Mara');   // a temple of the eight, its healer's counter

const player = () => ({ isPlayer: true, level: 5, career: {}, stats: { willpower: 50 }, activeEffects: [], goldPieces: 5000, items: [] });
const infections = (p) => p.activeEffects.filter((a) => a.kind === 'disease' && a.infection && !a.ended).map((a) => a.infection);
const plain = (p) => p.activeEffects.filter((a) => a.kind === 'disease' && !a.infection && !a.ended).length;
/** the player's own Cure Disease (effect 3, subType 0) - a potion is the same cast */
const castCure = (p) => applySpell({ element: 4, rangeType: 0, effects: [{ type: 3, subType: 0, chanceBase: 100, chanceMod: 0, chancePerLevel: 1 }] }, 5, p, {}, () => 0);

test('INFECTION-KEPT: the report - bitten, the dream played, a plague caught and cured at the temple: the infection runs on to its turn (mutants: the temple ends every disease; it prices the infection with the plague)', () => {
  const p = player();
  const bite = startInfection(p, INFECTION.Werewolf, { day: 10 });
  assert.equal(infectionStep(bite, 11).kind, 'dream', 'the first night: the dream');
  markDreamPlayed(bite);
  startDisease(p, DISEASES.Plague, 11);
  assert.equal(diseaseCount(p), 2, 'GetDiseaseCount still counts both');
  const offer = cureDiseaseOffer(p, MARA, null, { nowClassicMinutes: 0 });
  assert.deepEqual([offer.kind, offer.diseases], ['offer', 1], 'the temple prices the plague alone');
  assert.equal(curableDiseaseCount(p), 1);
  assert.equal(payForCure(p, offer.cost).kind, 'cured');
  assert.deepEqual([plain(p), infections(p)], [0, [INFECTION.Werewolf]], 'the plague ended, the lycanthropy kept');
  assert.equal(infectionStep(bite, 14).kind, 'deploy', 'and on the fourth day it turns');
});

test('INFECTION-KEPT: the escape stands - an infection alone is the cure\'s, at the temple, on a holiday and cast; beside a plain disease each takes the plain one first (mutants: the infection never cured; never priced alone; a cast ends it with the plague; a cast never ends it)', () => {
  const only = player();
  startInfection(only, INFECTION.Vampirism, { day: 0 });
  const offer = cureDiseaseOffer(only, MARA, null, { nowClassicMinutes: 0 });
  assert.deepEqual([offer.kind, offer.diseases], ['offer', 1], 'the infection alone: priced as one');
  payForCure(only, offer.cost);
  assert.deepEqual(infections(only), [], 'and cured before the turn, as ever');
  const holiday = player();
  startInfection(holiday, INFECTION.Wereboar, { day: 0 });
  startDisease(holiday, DISEASES.Plague, 0);
  cureForFree(holiday);
  assert.deepEqual([plain(holiday), infections(holiday)], [0, [INFECTION.Wereboar]], 'a holiday\'s free cure takes the plague');
  cureForFree(holiday);
  assert.deepEqual(infections(holiday), [], 'and a second the infection');
  const cast = player();
  startInfection(cast, INFECTION.Werewolf, { day: 0 });
  startDisease(cast, DISEASES.Plague, 0);
  assert.equal(castCure(cast).cured, 1);
  assert.deepEqual([plain(cast), infections(cast)], [0, [INFECTION.Werewolf]], 'the cast ends the plague and leaves the lycanthropy');
  castCure(cast);
  assert.deepEqual(infections(cast), [], 'cast again, the lycanthropy');
});

test('INFECTION-KEPT: what ends everything at once - the turn\'s CureAll of the old life (a second infection with it), and the law\'s own primitive (mutant: the turn keeps the old infection)', () => {
  const p = player();
  startInfection(p, INFECTION.Vampirism, { day: 0 });
  startDisease(p, DISEASES.Plague, 0);
  endOldLifeEffects(p);
  assert.deepEqual([plain(p), infections(p)], [0, []], 'the turn ends every disease there is');
  const q = player();
  startInfection(q, INFECTION.Werewolf, { day: 0 });
  startDisease(q, DISEASES.Plague, 0);
  cureDiseasesInfectionsLast(q);
  assert.deepEqual([plain(q), infections(q)], [0, [INFECTION.Werewolf]]);
  startDisease(q, DISEASES.Plague, 0);
  cureAllDiseases(q);
  assert.deepEqual([plain(q), infections(q)], [0, []], 'CureAllDiseases, the turn\'s, ends both');
});
