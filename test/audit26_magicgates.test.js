// AUDIT 26 - THE MAGIC-GATES PARITY BATCH (F071-F075, F109), the
// second themed sweep of the audit's parity queue.
//
//   F071  bypassSavingThrows gates ASSIGN-time saves, not scaling
//   F072  Soul Trap rolls the no-magnitude save (new traps only)
//   F073  Pacify and Charm roll it too
//   F074  paralysis immunity precedes reflection/resistance
//   F075  five more effect arms break the caster's concealment
//   F109  every live infection advances, not just the first
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySpell } from '../src/systems/effects.js';
import { buildCustomSpell, blankEffectSettings } from '../src/systems/spellMaker.js';
import { runInfections, liveInfections, startInfection, INFECTION } from '../src/systems/infection.js';

const mkTarget = (over = {}) => ({
  level: 1, health: 50, maxHealth: 50, magicka: 20, maxMagicka: 20,
  stats: { luck: 50, willpower: 50 }, skills: [], activeEffects: [], items: [],
  ...over,
});
/** rolls: first N draws scripted, tail repeats the last. */
const seq = (...xs) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };
const spellOf = (type, subType, { rangeType = 1, settings = {} } = {}) =>
  buildCustomSpell({ slots: [{ type, subType, settings: { ...blankEffectSettings(), chanceBase: 100, chanceMod: 0, durationBase: 5, durationMod: 0, ...settings } }], rangeType });

// ---------------------------------------------------------------
// F071 - the flag gates only the assign-time gates (EEM:521, :525,
// :565-568); GetMagnitude's ModifyEffectAmount has NO bypass term
// (EntityEffect.cs:804-806). The port folded the flag into one
// predicate, so a quest-queued Damage Health landed at full
// magnitude where DFU scales it by the foe's save.
// ---------------------------------------------------------------
test('audit26 F071: a bypassed magnitude cast is STILL save-scaled per application', () => {
  const dmg = spellOf(4, 0, { settings: { magnitudeBaseLow: 20, magnitudeBaseHigh: 20 } });
  // rolls: [magnitude x2 (fixed by equal low/high), save roll LOW = full save]
  const target = mkTarget();
  const hurt = [];
  const out = applySpell(dmg, 1, target, { hurt: (n) => hurt.push(n) }, seq(0.0), null, { bypassSavingThrows: true });
  assert.equal(out.damage, 0, 'the target saved: ModifyEffectAmount ran despite the bypass flag');
  assert.deepEqual(hurt, [], 'no damage landed');
  // control: a high save roll fails the save and the full 20 lands
  const t2 = mkTarget();
  const out2 = applySpell(dmg, 1, t2, { hurt: () => {} }, seq(0.0, 0.0, 0.99), null, { bypassSavingThrows: true });
  // 21, not 20: blankEffectSettings puts every spinner at 1, so the
  // level term adds 1 x floor(casterLevel / perLevel) = 1 on top of
  // the 20..20 base. The number under test is the SCALING, not the sum.
  assert.equal(out2.damage, 21, 'a failed save takes the whole magnitude');
});

test('audit26 F071: the bypass flag still suppresses the ASSIGN-time no-magnitude save', () => {
  // Disintegrate (5,255): no magnitude, so its save is AssignBundle\'s
  // - exactly what the flag exists to bypass (the quest spell queue).
  const dis = spellOf(5, 255);
  const target = mkTarget({ health: 5 });
  const out = applySpell(dis, 1, target, {}, seq(0.0), null, { bypassSavingThrows: true });
  assert.equal(out.saved ?? 0, 0, 'no save was rolled');
  assert.equal(out.disintegrated ?? 0, 1, 'the effect landed under the flag');
  // and WITHOUT the flag the same low roll saves
  const t2 = mkTarget({ health: 5 });
  const out2 = applySpell(dis, 1, t2, {}, seq(0.0, 0.0), null, {});
  assert.equal(out2.saved, 1, 'unbypassed, the target saves against it');
});

// ---------------------------------------------------------------
// F072/F073 - SoulTrap (SoulTrap.cs:30-41), PacifyEffect (:60-63)
// and CharmEffect (:33-44) all declare SupportMagnitude false and no
// bypass, so AssignBundle rolls the target's save on a non-CasterOnly
// cast and drops the whole effect on a full save (EEM:561-580). The
// port rolled the cast chance and nothing else - a high-willpower
// monster could never shrug any of the three off.
// ---------------------------------------------------------------
test('audit26 F073: a monster can SAVE against Pacify and Charm', () => {
  // Pacify Animal (33,0) at a rat (group Animals). Chance passes on
  // the first draw; the SECOND draw is the save - low = full save.
  const rat = mkTarget({ mobileType: 0 });
  const out = applySpell(spellOf(33, 0), 1, rat, {}, seq(0.0, 0.0), null, {});
  assert.equal(out.saved, 1, 'the rat saved');
  assert.notEqual(out.pacify, true, 'and was NOT pacified');
  // Charm at a class enemy, same shape
  const bandit = mkTarget({ mobileType: 128 });
  const out2 = applySpell(spellOf(34, 255), 1, bandit, {}, seq(0.0, 0.0), null, {});
  assert.equal(out2.saved, 1);
  assert.notEqual(out2.pacify, true);
  // control: a failed save lands the pacify
  const rat2 = mkTarget({ mobileType: 0 });
  const out3 = applySpell(spellOf(33, 0), 1, rat2, {}, seq(0.0, 0.99), null, {});
  assert.equal(out3.pacify, true, 'a failed save pacifies as before');
});

test('audit26 F072: a NEW soul trap can be saved against; an incumbent STACK survives the save', () => {
  // SoulTrap's cast chance is hardcoded true (SoulTrap.cs:47-52), but
  // the no-magnitude save still rolls for a NEW instance. The
  // incumbent stack happens inside Start (AddState), BEFORE the save,
  // so it survives - the buff family's own gate order.
  const wraith = mkTarget({ mobileType: 23 });
  const out = applySpell(spellOf(12, 255), 1, wraith, {}, seq(0.0), null, {});
  assert.equal(out.saved, 1, 'the monster saved against a fresh trap');
  assert.equal(liveTrap(wraith), null, 'no trap attached');
  // land one (save fails)...
  const out2 = applySpell(spellOf(12, 255), 1, wraith, {}, seq(0.99), null, {});
  assert.equal(out2.trapAlert, 'trapActive');
  const rounds0 = liveTrap(wraith).roundsRemaining;
  // ...then a re-cast with a SAVING roll still stacks its rounds
  const out3 = applySpell(spellOf(12, 255), 1, wraith, {}, seq(0.0), null, {});
  assert.equal(out3.saved ?? 0, 0, 'the incumbent stack never reaches the save');
  assert.ok(liveTrap(wraith).roundsRemaining > rounds0, 'the rounds stacked through it');
});
const liveTrap = (t) => t.activeEffects.find((a) => a.kind === 'soulTrap' && !a.ended) ?? null;

// ---------------------------------------------------------------
// F074 - the hard-immunity drop for an incoming Paralyze precedes the
// absorption/reflection/resistance chain (EEM:495-498 before
// :504-527). Tested inside the arm, a Free-Action player with Spell
// Reflection up BOUNCED a spider's paralyze back at its caster - DFU
// discards it silently before either gate runs.
// ---------------------------------------------------------------
test('audit26 F074: an immune target neither reflects nor resists a Paralyze - it discards it', () => {
  const immune = mkTarget();
  immune.activeEffects.push({ kind: 'freeAction', roundsRemaining: 5 });
  immune.activeEffects.push({ kind: 'spellReflection', chance: 100, roundsRemaining: 5 });
  const caster = { entity: mkTarget(), sinks: {} };
  const out = applySpell(spellOf(0, 255), 1, immune, {}, seq(0.0), caster, {});
  assert.equal(out.reflected ?? 0, 0, 'no bounce - the immunity continue precedes TryReflection');
  assert.equal(out.resisted ?? 0, 0, 'and no "Spell was resisted."');
  assert.equal(out.saved ?? 0, 0, 'no save message either - the discard is silent');
  assert.equal(immune.activeEffects.some((a) => a.kind === 'paralyze'), false, 'and nothing landed');
});

// ---------------------------------------------------------------
// F075 - PlayerAggro / the FromSource damage doors break the caster's
// normal-power concealment for TransferHealth, TransferFatigue, the
// Drain/Transfer-attribute family, Paralyze and Silence
// (EntityEffect.cs:815-828; DaggerfallEntityBehaviour.cs:143-169).
// The port broke it from the plain damage arms only - an invisible
// player could paralyze, silence, drain or transfer and stay hidden.
// ---------------------------------------------------------------
test('audit26 F075: paralyzing, silencing, draining and transferring all break the caster\'s cover', () => {
  const arms = [
    ['Paralyze', spellOf(0, 255)],
    ['Silence', spellOf(19, 255)],
    ['Drain Strength', spellOf(7, 0, { settings: { magnitudeBaseLow: 5, magnitudeBaseHigh: 5 } })],
    ['Transfer Health', spellOf(11, 8, { settings: { magnitudeBaseLow: 5, magnitudeBaseHigh: 5 } })],
    ['Transfer Fatigue', spellOf(11, 9, { settings: { magnitudeBaseLow: 5, magnitudeBaseHigh: 5 } })],
  ];
  for (const [name, sp] of arms) {
    const casterEntity = mkTarget();
    // an invisible caster: the normal-power concealment entry
    casterEntity.activeEffects.push({ kind: 'invisNormal', roundsRemaining: 10 });
    const target = mkTarget({ mobileType: 0 });
    applySpell(sp, 1, target, { hurt: () => {}, drainFatigue: () => {} }, seq(0.99), { entity: casterEntity, sinks: {} }, {});
    assert.equal(casterEntity.activeEffects.some((a) => a.kind === 'invisNormal' && !a.ended), false,
      `${name} breaks normal-power invisibility`);
  }
});

// ---------------------------------------------------------------
// F109 - DoMagicRound runs MagicRound on EVERY live effect
// (EEM:1724-1734), so both infections progress independently. The
// port stepped `liveInfection` - a .find returning the FIRST unended
// entry - so a player carrying both strains saw only the earlier one
// progress.
// ---------------------------------------------------------------
test('audit26 F109: both infections advance in the same round', () => {
  const p = mkTarget({ isPlayer: true, level: 5 });
  assert.ok(startInfection(p, INFECTION.Vampirism, { day: 1 }), 'strain one takes');
  assert.ok(startInfection(p, INFECTION.Werewolf, { day: 1 }), 'strain two takes beside it');
  assert.equal(liveInfections(p).length, 2, 'the port deliberately allows both strains at once');
  const played = [];
  runInfections(p, 2, { playVideo: (name, onClose) => { played.push(name); onClose(); } });
  assert.equal(played.length, 2, "BOTH warning dreams play - the second's clock no longer stalls behind the first");
  const dreamed = liveInfections(p).filter((a) => a.dreamPlayed || a.dreamScheduled);
  assert.equal(dreamed.length, 2, 'and both entries advanced their own state');
});
