// FIELD BUGS 2026-10-01 part four - two #bug-reports threads on one spell. Opaldes, "Big Regen Spell doesnt do
// anything": GOD MODE, Area at Range, Magic Based - Regenerate and Fortify Attribute (Strength) - "doesnt reg afaik".
// Skaadi, "Regen spell stopped providing healing after vampire transformation": "I made a regeneration spell that
// scales pretty high to facetank vampires. After I finally become one the spell stopped healing any HP" - and on
// Opaldes's thread, "Yeah that's precisely what my spell is as well. Same issue."
//
// CURE-ALL. The turn (vampirism and lycanthropy alike) runs DFU's CureAll, and the port's ended every live entry but a
// disease or a poison: a Regenerate kept ticking with `ended` set - gone from the HUD, the party cards and the dispel
// list - and every recast of the spell merged into the hidden entry, so it was never seen again while it was kept up;
// the poisons it said it cured ran on, and no pool was filled. Now CureAll whole: the pools full, every poison and
// disease ended, every drain healed - and this life's buffs left running. Fixtures are the producers': the spell
// through the real applySpell, the poison through startPoison, the disease through inflictDisease, the turn through
// createVampirismCurse (the deploy's own constructor) and the werewolf's infection walked to its turn.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applySpell, tickActiveEffects } from '../../src/systems/effects.js';
import { liveBundles } from '../../src/systems/mysticism.js';
import { createVampirismCurse } from '../../src/systems/vampirism.js';
import { VAMPIRE_CLANS, startInfection, INFECTION } from '../../src/systems/infection.js';
import { endOldLifeEffects, liveLycanthropy } from '../../src/systems/lycanthropy.js';
import { startPoison, POISONS } from '../../src/systems/poisons.js';
import { inflictDisease } from '../../src/systems/diseases.js';
import { maxFatigue, liveStat } from '../../src/systems/statMods.js';
import { runMagicRoundsFor } from '../../src/systems/worldTick.js';
import { MINUTES_PER_DAY } from '../../src/systems/gameDate.js';
import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { RACES } from '../../src/systems/races.js';

/** Skaadi's spell as the spellmaker writes a self cast: Regenerate 5 a round for 60 rounds, and Fortify Strength. */
const BIG_REGEN = {
  name: 'Big Regen', element: 4, rangeType: 0, icon: 7,
  effects: [
    { type: 18, subType: 255, magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0, durationBase: 60, durationMod: 0, durationPerLevel: 0 },
    { type: 9, subType: 0, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0, durationBase: 60, durationMod: 0, durationPerLevel: 0 },
  ],
};
const P = () => ({
  isPlayer: true, name: 'Skaadi', level: 10, activeEffects: [], spells: [], items: [], skills: {},
  stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
  health: 100, maxHealth: 100, magicka: 80, maxMagicka: 80, fatigue: 6400,
});
const sinks = (p) => ({ heal: (n) => { p.health = Math.min(p.maxHealth, p.health + n); } });
const regen = (p) => p.activeEffects.find((a) => a.kind === 'regenerate');
const shown = (p) => liveBundles(p).filter((b) => b.entries.some((a) => a.kind === 'regenerate'));

/** A player mid-fight before the turn: the regen and the fortify running, poisoned, diseased, drained, worn down. */
function midFight() {
  const p = P();
  applySpell(BIG_REGEN, 10, p, sinks(p), () => 0);
  assert.ok(regen(p), 'the Regenerate stands');
  assert.equal(shown(p).length, 1, 'and is shown');
  assert.ok(startPoison(p, POISONS.Arsenic, 0, () => 0), 'poisoned');
  assert.ok(inflictDisease(p, [1], { rolls: () => 0.99 }), 'diseased');
  p.activeEffects.push({ kind: 'drainAttribute', stat: 'agility', magnitude: 9, permanent: true });
  p.health = 20; p.magicka = 3; p.fatigue = 64;
  return p;
}

test('CURE-ALL: the report - after the vampire\'s turn the Regenerate is still shown, still heals, and a recast lands on the one shown; the Fortify runs on (mutants: the old life\'s buffs ended again; the shown list blind to it)', () => {
  const p = midFight();
  const before = regen(p);
  assert.ok(createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: 1000 }), 'the turn');
  assert.equal(regen(p), before, 'the same entry');
  assert.ok(!before.ended, 'not ended - it is this life\'s');
  assert.equal(shown(p).length, 1, 'still on the HUD, the party card and the dispel list');
  assert.ok(!p.activeEffects.find((a) => a.kind === 'fortifyAttribute').ended, 'the Fortify runs on');
  assert.equal(liveStat(p, 'strength'), 60, 'and lifts Strength by its 10');
  // it heals: worn down again, a round of it
  p.health = 30;
  tickActiveEffects(p, sinks(p), () => 0);
  assert.equal(p.health, 35, 'five a round');
  // a recast tops the shown entry up - nothing hidden swallows it
  const rounds = before.roundsRemaining;
  applySpell(BIG_REGEN, 10, p, sinks(p), () => 0);
  assert.equal(p.activeEffects.filter((a) => a.kind === 'regenerate').length, 1, 'one entry');
  assert.equal(regen(p).roundsRemaining, rounds + 1, 'its rounds renewed to a fresh cast\'s, never stacked');   // PIN MOVED (STACK-CAP): `>` held under either law
  assert.equal(shown(p).length, 1, 'shown');
});

test('CURE-ALL: the turn cures the old life whole - the pools full, the poison and the disease ended, the drain healed - for the vampire and the werewolf alike, through one home (mutants: no pool filled; the poison left; the disease left; the drain left)', () => {
  const p = midFight();
  createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: 1000 });
  assert.equal(p.health, 100, 'health full');
  assert.equal(p.magicka, 80, 'magicka full');
  assert.equal(p.fatigue, maxFatigue(p), 'fatigue full');
  assert.equal(p.activeEffects.filter((a) => a.kind === 'poison').length, 0, 'the poison cured');
  assert.equal(p.activeEffects.filter((a) => a.kind === 'disease').length, 0, 'the disease cured');
  // PIN MOVED (AUDIT 2026-10-01 part four, CURE-ENDS): the cured drain ends - at nothing it stood on the HUD for good
  assert.ok(p.activeEffects.filter((a) => a.kind === 'drainAttribute').every((a) => a.magnitude === 0 && a.ended), 'the drain healed, and ended');
  // the werewolf's turn, walked from its bite: the same cure, the same buff left running
  const w = P();
  applySpell(BIG_REGEN, 10, w, sinks(w), () => 0);
  w.activeEffects.push({ kind: 'drainAttribute', stat: 'agility', magnitude: 9, permanent: true });
  startInfection(w, INFECTION.Werewolf, { day: 0 });
  const day = (d) => d * MINUTES_PER_DAY;
  runMagicRoundsFor(w, day(1) - 1, day(1), { sinks: {} });   // the dream
  w.health = 10;
  runMagicRoundsFor(w, day(4) - 1, day(4), { sinks: {} });   // the turn
  assert.ok(liveLycanthropy(w), 'the curse stands');
  assert.ok(w.activeEffects.filter((a) => a.kind === 'drainAttribute').every((a) => a.magnitude === 0 && a.ended), 'the drain healed, and ended (CURE-ENDS)');
  assert.equal(w.health, w.maxHealth, 'health full');
  // and the one home is what both constructors call
  const q = midFight();
  endOldLifeEffects(q);
  assert.ok(!regen(q).ended);
  assert.equal(q.health, 100);
});

// AREA-SELF and AREA-CASTER: GOD MODE through the real cast engine (scenes/hostMagic.js createPlayerMagic, its ready and
// its cast - test/allycast's rig), a Breton (Resist Magic) casting her own.
const GOD_MODE = {
  name: 'GOD MODE', index: -1, custom: true, element: 4, rangeType: 4, icon: 7,
  effects: [
    { type: 18, subType: 255, magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 60, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 },
    { type: 9, subType: 0, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 60, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 },
  ],
};
const HARM = { type: 4, subType: 0, magnitudeBaseLow: 1, magnitudeBaseHigh: 1, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 };
const EYE = [0, 0.9, 0], LOOK = [0, 0, 1];
function godModeRig(rolls) {
  const healed = [], said = [];
  const player = {
    isPlayer: true, name: 'Opaldes', level: 10, raceId: RACES.Breton, health: 10, maxHealth: 5000, magicka: 5000, maxMagicka: 5000,
    skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
    stats: { strength: 50, intelligence: 50, willpower: 50, endurance: 50, agility: 50, speed: 50, personality: 50, luck: 50 }, career: {}, activeEffects: [],
  };
  const heal = (n) => { healed.push(n); player.health = Math.min(player.maxHealth, player.health + n); };
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {} },
    audio: { playOneShot() {}, play3d() {}, playOneShotId() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt() {}, heal, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: () => {} },
    say: (l) => said.push(l), surfacePlayer() {}, foes: () => [], foeSinks: () => ({}),
    absorbCtx: () => ({ inside: false, day: true }),
    rolls, startCastAnim: null,
  });
  magic.firePending(EYE, LOOK);
  const cast = (sp) => { magic.readySpell(sp); return magic.castInput(EYE, LOOK); };
  return { magic, player, healed, said, cast, sinks: { heal } };
}

test('AREA-CASTER and AREA-SELF: the report - GOD MODE lands on its caster at the cast, whole: Area at Range wherever its missile goes, Area Around Caster where DFU passed its caster by; her Regenerate heals its full magnitude every round and her Fortify its full magnitude whatever her resistance rolls; the burst that catches her lands nothing twice (mutants: the caster never given it; given it saved; the burst lands it again)', () => {
  for (const rangeType of [4, 3]) {
    for (const r of [0.01, 0.5, 0.99]) {
      const g = godModeRig(() => r);
      const sp = { ...GOD_MODE, rangeType };
      assert.equal(g.cast(sp), true, `${rangeType}/${r}: cast`);
      const reg = regen(g.player);
      assert.ok(reg, `${rangeType}/${r}: the Regenerate is hers at once`);
      assert.equal(reg.saveScaled, false, `${rangeType}/${r}: a self-cast - no save against her own gift`);
      const fort = g.player.activeEffects.find((a) => a.kind === 'fortifyAttribute');
      assert.ok(fort && fort.magnitude > 0, `${rangeType}/${r}: the Fortify lands whole (${fort?.magnitude})`);
      g.healed.length = 0;
      for (let i = 0; i < 5; i++) tickActiveEffects(g.player, g.sinks, () => r);
      assert.equal(g.healed.length, 5, `${rangeType}/${r}: every round heals`);
      assert.ok(g.healed.every((n) => n === g.healed[0] && n > 0), `${rangeType}/${r}: the same full magnitude (${g.healed})`);
      if (rangeType === 4) {
        assert.equal(g.magic.missileCount(), 1, 'the missile still flies, for whoever it reaches');
        const rounds = reg.roundsRemaining, mag = fort.magnitude, n = g.player.activeEffects.length;
        g.magic.explodeAt([2, 0.9, 0], sp, 10, [0, 0, 0], { entity: g.player }, { playerHeight: 1.8 });
        assert.equal(reg.roundsRemaining, rounds, 'its burst beside her stacks no second Regenerate');
        assert.equal(fort.magnitude, mag);
        assert.equal(g.player.activeEffects.length, n, 'nothing landed twice');
      }
    }
  }
});

test('AREA-CASTER: a spell with harm in it is DFU\'s - an Area Around Caster passes its caster by, an Area at Range lands nothing on her at the cast and is saved against where its burst reaches her; a foe\'s blast of gifts is saved against (mutants: the caster given a blast with harm in it; a foe\'s gift taken as her own)', () => {
  const mixed = { ...GOD_MODE, name: 'Mixed', effects: [GOD_MODE.effects[0], HARM] };
  const around = godModeRig(() => 0.01);
  around.cast({ ...mixed, rangeType: 3 });
  assert.equal(regen(around.player), undefined, 'Around Caster with harm in it: not her');
  const at = godModeRig(() => 0.01);
  at.cast(mixed);
  assert.equal(regen(at.player), undefined, 'At Range with harm in it: nothing at the cast');
  at.magic.explodeAt([2, 0.9, 0], mixed, 10, [0, 0, 0], { entity: at.player }, { playerHeight: 1.8 });
  assert.equal(regen(at.player)?.saveScaled, true, 'its burst beside her: saved against, as DFU does');
  const f = godModeRig(() => 0.01);
  const healer = { entity: { level: 10, health: 40, maxHealth: 40, magicka: 50, maxMagicka: 50, skills: new Array(40).fill(30), stats: { willpower: 30 }, career: {}, activeEffects: [] } };
  f.magic.explodeAt([2, 0.9, 0], GOD_MODE, 10, [0, 0, 0], healer, { playerHeight: 1.8 });
  assert.equal(regen(f.player)?.saveScaled, true, 'a foe\'s blast keeps its save');
});

test('AREA-CASTER: an area Heal lands on its caster as a self-cast\'s does - healed, and said so (mutants: no healed line)', () => {
  const HEAL_HEALTH = { type: 10, subType: 8, magnitudeBaseLow: 25, magnitudeBaseHigh: 25, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 };
  for (const rangeType of [3, 4]) {
    const g = godModeRig(() => 0.5);
    g.cast({ name: 'Healing Wave', index: -1, custom: true, element: 4, rangeType, icon: 3, effects: [HEAL_HEALTH] });
    assert.equal(g.player.health, 10 + 25, `${rangeType}: healed its whole 25`);
    assert.ok(g.said.includes('You are healed 25 points.'), `${rangeType}: and told: ${g.said}`);
  }
});
