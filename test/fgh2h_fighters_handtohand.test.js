// FGH2H (2026-09-24, Mac: "change the fighter guild requirements where it
// allows bare handed") - the Fighters Guild counts HandToHand toward joining
// and every rank, beside DFU's seven (FightersGuild.cs's guildSkills), and its
// hall trains it. Giantish stays: the rank law counts skills past a bar, so an
// added skill only lets a fist-fighter in and turns no member out. A DEPARTURE,
// rowed in the Port-Ledger; Roleplay & Realism's fightersTeachHandToHand keeps
// its own swap (rr1_realism.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUILDS, calculateNewRank, isEligibleToJoin, numHighLowSkills, guildSkillsOf } from '../src/systems/guilds.js';
import { TRAINING_SKILLS, trainingSkills } from '../src/systems/guildServices.js';
import { createFactionRep, setReputation } from '../src/systems/factionRep.js';
import { SKILLS } from '../src/systems/skills.js';

const FG = GUILDS.FightersGuild;
const storeWith = (rep) => {
  const dict = new Map([[FG.factionId, { id: FG.factionId, parent: 0, rep: 0, flags: 0, power: 50,
    ally1: 0, ally2: 0, ally3: 0, enemy1: 0, enemy2: 0, enemy3: 0, children: null, type: 0, ggroup: 0 }]]);
  const store = createFactionRep(dict);
  setReputation(store, FG.factionId, rep);
  return store;
};
const fighter = (skills) => ({ name: 'Tester', skills });

test('FGH2H: a bare-handed fighter joins and ranks by Hand-to-Hand (mutant: HandToHand dropped from the guild skills)', () => {
  assert.ok(guildSkillsOf(FG).includes(SKILLS.HandToHand), 'HandToHand is a Fighters Guild skill');
  // Hand-to-Hand is the HIGH skill and nothing else a guild skill is past 22:
  // without it the pair is one low skill and the door stays shut
  const brawler = fighter({ [SKILLS.HandToHand]: 40, [SKILLS.LongBlade]: 10 });
  assert.deepEqual(numHighLowSkills(brawler, FG, 0), { high: 1, low: 1 });
  assert.equal(isEligibleToJoin(brawler, FG, storeWith(0)), true, 'the brawler is let in');
  // rank 3 asks 39 high / 13 low at 30 reputation - the fist clears 39, the blade's 10 does not clear 13
  assert.equal(calculateNewRank(brawler, FG, storeWith(30)), 2);
  // the fist alone is one skill, and the law wants two
  assert.equal(isEligibleToJoin(fighter({ [SKILLS.HandToHand]: 90 }), FG, storeWith(90)), false, 'two skills, still');
});

test('FGH2H: Giantish still counts - an added skill turns no member out (mutant: HandToHand in Giantish\'s place)', () => {
  assert.ok(FG.skills.includes(SKILLS.Giantish), 'Giantish stays a guild skill');
  assert.equal(FG.skills.length, 8, 'DFU\'s seven and HandToHand');
  const linguist = fighter({ [SKILLS.LongBlade]: 30, [SKILLS.Giantish]: 10 });
  assert.equal(isEligibleToJoin(linguist, FG, storeWith(0)), true, 'a Giantish speaker keeps the door DFU gave them');
});

test('FGH2H: the hall trains Hand-to-Hand, beside its eleven (mutant: the training list untouched)', () => {
  assert.ok(TRAINING_SKILLS.FightersGuild.includes(SKILLS.HandToHand));
  assert.equal(trainingSkills(FG).length, 12);
  assert.ok(trainingSkills(FG).includes(SKILLS.Giantish), 'and still trains Giantish');
});
