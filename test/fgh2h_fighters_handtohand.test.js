// FGH2H (2026-09-24, Mac: "change the fighter guild requirements where it
// allows bare handed") - the Fighters Guild counts HandToHand toward joining
// and every rank, beside DFU's seven (FightersGuild.cs's guildSkills), and its
// hall trains it. Giantish stays: the rank law counts skills past a bar, so an
// added skill only lets a fist-fighter in and turns no member out. A DEPARTURE,
// rowed in the Port-Ledger. FGH2H-R: Roleplay & Realism's fightersTeachHandToHand,
// whose lists put HandToHand in Giantish's place, only took Giantish away after
// that - so it is RETIRED, off the pane, and a saved value is let go once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUILDS, calculateNewRank, isEligibleToJoin, numHighLowSkills } from '../src/systems/guilds.js';
import { TRAINING_SKILLS, trainingSkills } from '../src/systems/guildServices.js';
import { createFactionRep, setReputation } from '../src/systems/factionRep.js';
import { SKILLS } from '../src/systems/skills.js';
import { MOD_SETTINGS, RETIRED_KEYS, modSetting, _resetModSettings } from '../src/systems/modSettings.js';
import * as rr from '../src/systems/rrRealism.js';

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
  assert.ok(FG.skills.includes(SKILLS.HandToHand), 'HandToHand is a Fighters Guild skill');
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

test('FGH2H-R: R&R\'s fightersTeachHandToHand is retired - off the pane, its lists gone, and a value saved while it shipped let go once (mutants: the stored value kept; every other key of the mod dropped with it)', () => {
  const V = 'roleplay-realism', K = 'dfjs-mod-settings', R = 'fightersTeachHandToHand';
  assert.equal(MOD_SETTINGS[V].keys[R], undefined, 'no switch on the pane');
  assert.throws(() => modSetting(V, R), /not a declared switch/, 'nothing may read it');
  assert.equal(rr.rrFightersGuildSkills, undefined, 'FightersGuildRR\'s lists are gone');
  assert.deepEqual(RETIRED_KEYS.map((r) => `${r.vendor}/${r.key}`), [`${V}/${R}`]);
  const prevLs = globalThis.localStorage;
  try {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
    _resetModSettings();
    // a file from while the switch shipped: turned on, beside another of the mod's switches
    store.set(K, JSON.stringify({ [V]: { [R]: true, underworldExpulsion: false }, pcaao: { Enabled: false } }));
    assert.equal(modSetting(V, 'underworldExpulsion'), false, 'the mod\'s other switches are the player\'s');
    const written = JSON.parse(store.get(K));
    assert.deepEqual(written[V], { underworldExpulsion: false }, 'written back without the retired key');
    assert.deepEqual(written.pcaao, { Enabled: false }, 'every other mod untouched');
    // a file that never mentioned the mod is not grown one
    _resetModSettings();
    store.set(K, JSON.stringify({ pcaao: { Enabled: true } }));
    assert.equal(modSetting('pcaao', 'Enabled'), true);
    assert.deepEqual(JSON.parse(store.get(K)), { pcaao: { Enabled: true } });
  } finally {
    globalThis.localStorage = prevLs;
    _resetModSettings();
  }
});
