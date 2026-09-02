// X11a: the four tractable rows of spellEffects.js's inert residue -
// Disintegrate (5,255), Light (15,255), Spell Reflection (21,255) and
// Comprehend Languages (44,255). Sources: Disintegrate.cs,
// LightNormal.cs + MagicCandleBehaviour.cs + MagicCandle.prefab,
// SpellReflection.cs + EntityEffectManager.TryReflection (:1207-1244),
// ComprehendLanguages.cs + FormulaHelper.CalculateEnemyPacification
// (:357-391). MorphSelf (29,255) is DELIBERATELY not here - see the
// last test in this file.

import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import {
  applySpell, spellReflectionChance, comprehendLanguagesChance,
  hasActiveEffect, SPELL_REFLECTED_TEXT, BUFF_KINDS, MAGIC_ONLY_KEYS,
} from '../src/systems/effects.js';
import { buildCustomSpell, blankEffectSettings } from '../src/systems/spellMaker.js';
import { effectByKey, PORTED_KEYS, SPELL_MAKER_EFFECTS } from '../src/systems/spellEffects.js';
import { calculateEnemyPacification } from '../src/combat/formulas.js';
import { SKILLS } from '../src/systems/skills.js';
import { CANDLE, candleBase, createCandleWobble, insideUnitSphere, withPlayerLights } from '../src/scenes/magicCandle.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

const being = (over = {}) => ({
  stats: { luck: 50, willpower: 50, personality: 50 }, skills: new Array(35).fill(0),
  activeEffects: [], race: 'Nord', level: 1, health: 50, maxHealth: 50,
  magicka: 0, maxMagicka: 300, ...over,
});
/** A self-cast of one effect at the given settings. */
const cast = (ent, type, subType, settings, { rangeType = 0, roll = 0.5, caster = null, ctx = {}, sinks = {} } = {}) =>
  applySpell(
    buildCustomSpell({ slots: [{ type, subType, settings: { ...blankEffectSettings(), ...settings } }], rangeType }),
    1, ent, sinks, () => roll, caster, ctx);

// ── Disintegrate (5,255) ──────────────────────────────────────────
const disintegrate = (ent, opts = {}) =>
  cast(ent, 5, 255, { chanceBase: opts.chance ?? 100 }, { rangeType: 2, roll: opts.roll ?? 0.5, caster: { level: 5, entity: opts.casterEntity ?? {} }, sinks: opts.sinks ?? {}, ctx: opts.ctx ?? {} });

test('X11 Disintegrate: a made chance roll kills the target outright, for its WHOLE remaining health', () => {
  const e = being({ health: 37 });
  let taken = 0;
  const out = disintegrate(e, { chance: 100, sinks: { hurt: (n) => { taken += n; e.health -= n; } } });
  assert.equal(out.skipped, 0, 'the library honours it now');
  assert.equal(out.disintegrated, 1);
  assert.equal(taken, 37, 'SetHealth(0) is the WHOLE bar, not a magnitude (Disintegrate.cs:52)');
  assert.equal(e.health, 0);
  assert.equal(out.damage, 37);
  assert.equal(e.activeEffects.length, 0, 'it holds no duration - nothing is left behind');
});

test('X11 Disintegrate: a FAILED chance roll spares the target, and the roll is DFU\'s OnCast default', () => {
  const e = being({ health: 37 });
  // chance 30, roll 0.5 -> floor(50) < 30 is false
  const out = disintegrate(e, { chance: 30, roll: 0.5, sinks: { hurt: () => assert.fail('nothing should be hurt') } });
  assert.equal(out.chanceFailed, 1);
  assert.equal(out.disintegrated, undefined);
  assert.equal(e.health, 37);
});

test('X11 Disintegrate: the no-magnitude SAVE is a SECOND gate, and a CasterOnly cast skips it', () => {
  // AssignBundle runs the chance gate first (:531-551) and the
  // no-magnitude save second (:561-579) - two independent refusals.
  // A saving throw that MAKES it returns 0; a Nord with luck 50 and a
  // roll of 0 against a magic-only effect saves.
  const e = being({ health: 37, stats: { luck: 100, willpower: 100, personality: 50 } });
  const saved = disintegrate(e, { chance: 100, roll: 0, sinks: { hurt: () => assert.fail('a made save spares') } });
  assert.equal(saved.saved, 1, 'the chance was made and the SAVE still refused it');
  assert.equal(saved.disintegrated, undefined);
  // rangeType 0 is TargetTypes.CasterOnly - never saved against
  const self = being({ health: 37, stats: { luck: 100, willpower: 100, personality: 50 } });
  let hurt = 0;
  const out = cast(self, 5, 255, { chanceBase: 100 },
    { rangeType: 0, roll: 0, caster: { level: 5, entity: {} }, sinks: { hurt: (n) => { hurt += n; } } });
  assert.equal(out.saved, undefined, 'a self-cast never rolls the save');
  assert.equal(hurt, 37, 'so it kills you');
});

// ── Comprehend Languages (44,255) ─────────────────────────────────
test('X11 Comprehend Languages: an incumbent carrying a frozen chance, stacking rounds on a recast', () => {
  const e = being();
  assert.equal(comprehendLanguagesChance(e), 0, 'nothing live, no bonus');
  // blankEffectSettings puts EVERY spinner at 1 (the editor's own
  // initial state), so a level-1 cast adds chanceMod * floor(1/1) = 1
  // to the base - 40 becomes 41, and durationBase 10 becomes 11.
  const out = cast(e, 44, 255, { durationBase: 10, chanceBase: 40 });
  assert.equal(out.skipped, 0);
  assert.deepEqual(e.activeEffects.map((a) => a.kind), ['comprehendLanguages']);
  assert.equal(comprehendLanguagesChance(e), 41, 'ChanceValue is frozen at cast from the CASTER\'s level');
  const rounds = e.activeEffects[0].roundsRemaining;
  // ...and then the INITIAL magic round every effect gets at assignment
  // (EEM:594) consumes one, so 11 rolled leaves 10 standing. A stacking
  // recast fires no initial round of its own - the joining instance is
  // never added to liveEffects - so it contributes its full 5.
  assert.equal(rounds, 10);
  // a recast with a DIFFERENT chance: AddState stacks rounds and
  // nothing else (ComprehendLanguages.cs:50-53)
  cast(e, 44, 255, { durationBase: 4, chanceBase: 90 });
  assert.equal(e.activeEffects.length, 1, 'one incumbent, not two');
  assert.equal(e.activeEffects[0].roundsRemaining, rounds + 5, 'the rounds STACK');
  assert.equal(comprehendLanguagesChance(e), 41, 'and the incumbent keeps its own chance');
});

test('X11 Comprehend Languages: the bonus really moves the pacification roll', () => {
  // Etiquette 50, personality 50, sheathed: 50/10 + 50/5 + 10 = 25.
  const p = () => being({ isPlayer: true, skills: new Array(35).fill(50) });
  const roll = 30 / 200;   // 30 - out of reach at 25, inside 25 + 20
  assert.equal(calculateEnemyPacification(p(), SKILLS.Etiquette, true, roll), false, 'without it, 30 >= 25');
  assert.equal(calculateEnemyPacification(p(), SKILLS.Etiquette, true, roll, 20), true, 'with +20, 30 < 45');
  // and the bonus a live effect answers is the one that gets added
  const e = p();
  cast(e, 44, 255, { durationBase: 10, chanceBase: 20 });
  assert.equal(calculateEnemyPacification(e, SKILLS.Etiquette, true, roll, comprehendLanguagesChance(e)), true);
});

test('X11 Comprehend Languages: the pacification seam reads it for all three enemy pools', () => {
  const hc = src('src/scenes/hostCombat.js');
  const i = hc.indexOf('export function tryLanguagePacification');
  assert.ok(i > 0);
  const arm = hc.slice(i);
  assert.ok(arm.includes('comprehendLanguagesChance(playerEntity)'), 'the seam reads the live effect');
  assert.ok(/calculateEnemyPacification\([^)]*comprehend\)/.test(arm), 'and hands it to the roll');
  // the three pools all go through that seam - a fourth-host divergence
  // is exactly what moving the roll there was for
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) {
    assert.ok(src(f).includes('tryLanguagePacification('), `${f} runs the roll`);
  }
});

// ── Spell Reflection (21,255) ─────────────────────────────────────
const reflector = (chance = 100) => {
  const e = being();
  cast(e, 21, 255, { durationBase: 10, chanceBase: chance });
  return e;
};
/** A hostile ranged Damage Health from a distinct caster. */
const attack = (ent, ctx = {}, mag = 10) => applySpell(
  buildCustomSpell({ slots: [{ type: 4, subType: 0, settings: { ...blankEffectSettings(), magnitudeBaseLow: mag, magnitudeBaseHigh: mag } }], rangeType: 2 }),
  5, ent, {}, () => 0.5, { level: 5, entity: being() }, ctx);

test('X11 Spell Reflection: it lands as an incumbent whose chance the incoming chain reads', () => {
  const e = reflector(70);
  assert.deepEqual(e.activeEffects.map((a) => a.kind), ['spellReflection']);
  assert.equal(spellReflectionChance(e), 71, 'base 70 + the blank spinner\'s per-level 1');
  assert.equal(spellReflectionChance(being()), 0, 'and nobody else reflects');
  // A plain recast merges into the incumbent, so it cannot sharpen it
  cast(e, 21, 255, { durationBase: 3, chanceBase: 90 });
  assert.equal(e.activeEffects.length, 1);
  assert.equal(spellReflectionChance(e), 71, 'a stack keeps the incumbent\'s own chance');
  // X2's FIRST-MATCH law needs two entries to mean anything, and the
  // only way to get two is E2's item pin: a held-item bundle never
  // merges into an incumbent, which is exactly the case X2's bug was
  // about ("a 50% item and a 50% spell read as a certainty"). Asserting
  // it against ONE entry would have been vacuous - a sum and a
  // first-match agree on a list of one, and this test caught itself
  // being vacuous under red-proof.
  cast(e, 21, 255, { durationBase: 8, chanceBase: 90 }, { ctx: { heldItem: { id: 1 } } });
  assert.equal(e.activeEffects.length, 2, 'the pinned entry stands beside the spell\'s');
  assert.equal(spellReflectionChance(e), 71,
    'FindIncumbentEffect returns the FIRST and nothing else (EEM:666-678) - never 71 + 91');
});

test('X11 Spell Reflection: a made roll drops the effect at the target and raises the re-target flag', () => {
  const e = reflector(100);
  const out = attack(e);
  assert.equal(out.reflected, 1);
  assert.equal(out.damage, 0, 'nothing lands here');
  assert.equal(out.resisted, undefined, 'it never reached the resistance rung');
  // a failed roll lets the spell through untouched
  const weak = reflector(30);
  assert.equal(attack(weak).damage > 0, true, 'chance 30 against a roll of 50 fails');
  assert.equal(attack(weak).reflected, undefined);
});

test('X11 Spell Reflection: a bundle already reflected cannot bounce again (ReflectedCount)', () => {
  const e = reflector(100);
  const out = attack(e, { reflectedCount: 1 });
  assert.equal(out.reflected, undefined, 'DFU refuses a second bounce (:1210-1212)');
  assert.ok(out.damage > 0, 'so the spell lands on the reflector');
});

test('X11 Spell Reflection: your own spell never reflects onto you, and bypassSavingThrows skips the rung', () => {
  const e = reflector(100);
  // caster IS the target (:1220-1222) - which is also every CasterOnly cast
  const self = applySpell(
    buildCustomSpell({ slots: [{ type: 4, subType: 0, settings: { ...blankEffectSettings(), magnitudeBaseLow: 10, magnitudeBaseHigh: 10 } }], rangeType: 2 }),
    5, e, {}, () => 0.5, { level: 5, entity: e }, {});
  assert.equal(self.reflected, undefined);
  assert.ok(self.damage > 0);
  // the quest machine's casts bypass saves, and TryReflection is behind
  // that same gate (:521)
  const q = reflector(100);
  assert.equal(attack(q, { bypassSavingThrows: true }).reflected, undefined);
});

test('X11 Spell Reflection: DFU\'s multi-effect quirk - only the FIRST effect bounces', () => {
  // ReflectedCount is a BUNDLE field incremented inside the per-effect
  // loop, so on a two-effect spell the whole bundle goes back at the
  // caster AND effect 2 still lands on the original target. Preserved
  // verbatim; recorded in Ledger B.
  const e = reflector(100);
  const out = applySpell(
    buildCustomSpell({
      slots: [
        { type: 4, subType: 0, settings: { ...blankEffectSettings(), magnitudeBaseLow: 10, magnitudeBaseHigh: 10 } },
        { type: 0, subType: 255, settings: { ...blankEffectSettings(), durationBase: 5, chanceBase: 100 } },
      ],
      rangeType: 2,
    }),
    5, e, {}, () => 0.5, { level: 5, entity: being() }, {});
  assert.equal(out.reflected, 1, 'one bounce, not two');
  assert.ok(hasActiveEffect(e, 'paralyze'), 'and the SECOND effect still lands on the reflector');
});

test('X11 Spell Reflection: the host seam re-targets - the effect module never does', () => {
  // DFU's TryReflection calls casterEffectManager.AssignBundle: the
  // re-target belongs to whoever holds both parties. Here that is
  // hostMagic (both cast doors) and world.js's enchantment door.
  const eff = src('src/systems/effects.js');
  assert.ok(!/applySpell\(spell,[^\n]*reflectedCount/.test(eff), 'effects.js does not re-enter itself');
  const hm = src('src/scenes/hostMagic.js');
  assert.ok(hm.includes('SPELL_REFLECTED_TEXT'), 'the player-side line is spoken');
  assert.equal(SPELL_REFLECTED_TEXT, 'Spell was reflected.');
  // the FOE arm must NOT speak it - the line is gated on the reflecting
  // manager being the player's (:1231-1233)
  const foeArm = hm.slice(hm.indexOf('function applySpellToFoe'), hm.indexOf('function applySpellToPlayer'));
  assert.ok(foeArm.includes('r.reflected'), 'the foe arm re-targets');
  assert.ok(!foeArm.includes('SPELL_REFLECTED_TEXT'), 'and stays silent about it');
  assert.ok(/reflectedCount: 1/.test(foeArm), 'the bounce is marked so it cannot volley');
  // WAVE D: the enchantment door is scenes/hostEnchant.js's, one body
  // for both mounting hosts - so the bounce cannot be re-targeted in
  // one host and dropped in the other.
  assert.ok(src('src/scenes/hostEnchant.js').includes('r.reflected'), 'the enchantment door re-targets too');
});

// ── Light (15,255) and its candle ─────────────────────────────────
test('X11 Light: a duration-only incumbent, stacking rounds like every other buff', () => {
  const e = being();
  assert.equal(BUFF_KINDS['15,255'], 'light');
  const out = cast(e, 15, 255, { durationBase: 10 });
  assert.equal(out.skipped, 0);
  assert.equal(out.buffs, 1);
  assert.ok(hasActiveEffect(e, 'light'));
  const rounds = e.activeEffects[0].roundsRemaining;
  cast(e, 15, 255, { durationBase: 6 });
  assert.equal(e.activeEffects.length, 1, 'one incumbent');
  assert.equal(e.activeEffects[0].roundsRemaining, rounds + 7, 'AddState stacks rounds (LightNormal.cs:57-62)');
});

test('X11 the magic candle: DFU\'s numbers, and the position it hangs at', () => {
  assert.equal(CANDLE.distance, 1.4, 'candleDistance (LightNormal.cs:82)');
  assert.equal(CANDLE.heightFraction, 0.25, 'y += height * 0.25 (:85)');
  assert.equal(CANDLE.range, 15, 'MagicCandle.prefab m_Range');
  assert.equal(CANDLE.archive, 210);
  assert.equal(CANDLE.record, 3);
  assert.equal(CANDLE.jitterRadius, 0.125);
  assert.equal(CANDLE.moveSpeed, 8);
  // 1.4 in front, a quarter of the capsule up
  const at = candleBase([10, 2, 30], 1.8, [0, 0, 1]);
  assert.deepEqual(at.map((n) => Math.round(n * 1000) / 1000), [10, 2.45, 31.4]);
  // and it swings round with the facing, because DFU parents it to the
  // player object
  const back = candleBase([10, 2, 30], 1.8, [-1, 0, 0]);
  assert.deepEqual(back.map((n) => Math.round(n * 1000) / 1000), [8.6, 2.45, 30]);
});

test('X11 the magic candle: the wobble stays inside its 0.125 sphere and keeps moving', () => {
  let n = 0;
  const seq = () => { n += 0.37; return n % 1; };
  assert.ok(insideUnitSphere(seq).every((v) => Math.abs(v) <= 1));
  for (let i = 0; i < 200; i++) {
    const v = insideUnitSphere(seq);
    assert.ok(v[0] * v[0] + v[1] * v[1] + v[2] * v[2] <= 1 + 1e-12, 'a BALL, not a cube - Random.insideUnitSphere');
  }
  const w = createCandleWobble(seq);
  const seen = new Set();
  for (let i = 0; i < 120; i++) {
    w.tick(1 / 60);
    const o = w.offset();
    assert.ok(Math.hypot(o[0], o[1], o[2]) <= CANDLE.jitterRadius + 1e-9, 'never leaves the sphere');
    seen.add(o.map((v) => v.toFixed(4)).join(','));
  }
  assert.ok(seen.size > 10, 'and it actually moves');
});

test('X11 the magic candle: the light goes to the FRONT of a host\'s array, and the cap holds', () => {
  const base = new Float32Array(16 * 4).fill(7);
  const out = withPlayerLights(base, { x: 1, y: 2, z: 3, range: 15 });
  assert.equal(out.length, 16 * 4, 'the renderer takes 16 vec4s and no more');
  assert.deepEqual([...out.subarray(0, 4)], [1, 2, 3, 15], 'the candle is first - it is always the nearest');
  assert.equal(out[4], 7, 'the rest follow');
  // an empty array (a daylight exterior) still gets the candle
  assert.deepEqual([...withPlayerLights(new Float32Array(0), { x: 1, y: 2, z: 3, range: 15 })], [1, 2, 3, 15]);
  // no candle, no copy
  const b2 = new Float32Array(8);
  assert.equal(withPlayerLights(b2, null), b2);
});

test('X11 the magic candle: every host that lets the player cast puts it in its light array', () => {
  // THE FOUR HOSTS RULE. hostMagic owns the candle (one engine per
  // casting host), but each host builds its own point-light array, so
  // each has to prepend it. The standalone ?interior host is NOT here
  // and must not be: it builds no cast engine, so a player cannot cast
  // Light there at all.
  const sites = {
    'src/scenes/worldModes.js': 2,   // the ?world dungeon and interior branches
    'src/scenes/world.js': 2,        // the exterior, lanterns on AND off
    'src/scenes/exterior.js': 1,
    'src/scenes/dungeon.js': 1,
  };
  for (const [f, n] of Object.entries(sites)) {
    const hits = src(f).split('withPlayerLights(').length - 1;
    assert.equal(hits, n, `${f} prepends the candle at ${n} light site(s), found ${hits}`);
  }
  assert.ok(!src('src/scenes/interior.js').includes('withPlayerLights'),
    'the standalone interior host builds no cast engine, so it has no candle to draw');
  // and the tick reaches all four, with a real look direction
  for (const f of ['src/scenes/worldModes.js', 'src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    const call = src(f).match(/magic\.update\(dt,.*/);
    assert.ok(call, `${f} ticks the engine`);
    assert.equal(call[0].split(',').length >= 4, true,
      `${f} passes the forward and the height into magic.update - got ${call[0]}`);
  }
});

// ── the catalog, and the one row deliberately left inert ──────────
test('X11 catalog: four rows leave the inert set, and MORPH SELF stays with its reason', () => {
  for (const k of ['5,255', '15,255', '21,255', '44,255']) {
    assert.equal(effectByKey(k).ported, true, `${k} is live`);
    assert.ok(PORTED_KEYS.has(k));
  }
  // The magic-only override is per effect CLASS, not per lane: Light,
  // Reflection and Comprehend Languages all set ElementFlags_MagicOnly
  // and so always save as Magic - but DISINTEGRATE sets
  // ElementFlags_All (Disintegrate.cs:31), so a Fire Disintegrate
  // really does save as Fire. Asserted so nobody "tidies" it in.
  for (const k of ['15,255', '21,255', '44,255']) assert.ok(MAGIC_ONLY_KEYS.has(k), `${k} always saves as MAGIC`);
  assert.ok(!MAGIC_ONLY_KEYS.has('5,255'), 'Disintegrate saves as the bundle\'s own element');
  // X11b took Create Item (2,255), and V2a took MORPH SELF by
  // building LycanthropyEffect.MorphSelf's port - the catalog holds
  // no inert row at all now, and craftable stays false on 29,255
  // because AllowedCraftingStations = None is the MAKER's law.
  assert.deepEqual(SPELL_MAKER_EFFECTS.filter((e) => !e.ported).map((e) => e.key),
    [], 'no row remains inert');
  assert.equal(effectByKey('29,255').craftable, false);
  assert.ok(!src('src/systems/effects.js').includes("'29,255': "), 'no BUFF_KINDS row pretends otherwise');
});
