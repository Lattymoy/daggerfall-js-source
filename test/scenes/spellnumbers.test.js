// SPELL-NUMBERS (2026-10-28, a player: "they only show on the boss"): my spell's landing on any foe pops its damage number
// on the enhanced HUD (ui/hitNumbers.js) through the blows' own seam (combat/formulas.js reportPlayerAttack). Before, only
// the court's boss and the relay's stand-ins said a spell's number. A peer's spell landed on a foe I run says none on my
// screen, and a landing that struck nothing says nothing. tools/mutants/spellnumbers.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { setPlayerAttackHook } from '../../src/combat/formulas.js';

const playerEntity = () => ({ level: 7, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], goldPieces: 0, activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const magicFor = (pe) => createPlayerMagic({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} }, audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
  getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }), uploadRecord() {}, uploadRecordFrame() {},
  collider: { raycast: () => Infinity }, playerEntity: pe,
  playerSinks: { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
  say() {}, surfacePlayer() {}, foes: () => [], foeSinks: () => ({}), absorbCtx: () => ({ inside: true, day: false }), rolls: () => 0.99, startCastAnim: null,
});
const fx = (type, subType, o = {}) => ({ type, subType, magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 5, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1, ...o });
/** A Damage Health bolt of a fixed 12. */
const BOLT = { name: 'Test Bolt', index: 7, element: 0, rangeType: 2, effects: [fx(4, 0, { magnitudeBaseLow: 12, magnitudeBaseHigh: 12, durationBase: 0 })] };
const foeOf = () => {
  const entity = { level: 3, health: 200, maxHealth: 200, activeEffects: [], stats: { willpower: 0, luck: 50 }, skills: new Array(40).fill(0), armorValues: new Array(7).fill(60), team: 'Monster' };
  return { entity, ai: null };
};
const sinksOf = (foe) => ({ hurt: (n) => { foe.entity.health = Math.max(0, foe.entity.health - n); }, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} });

test('SPELL-NUMBERS: my spell on a plain foe pops the damage it struck, a peer\'s says none, nothing struck says nothing (mutants: spellnumbers-unsaid, spellnumbers-peer)', () => {
  const seen = [];
  setPlayerAttackHook((r) => seen.push(r));
  try {
    const pe = playerEntity();
    const magic = magicFor(pe);
    const foe = foeOf();
    magic.applySpellToFoe(BOLT, pe.level, foe, { entity: pe }, undefined, sinksOf(foe));
    const lost = 200 - foe.entity.health;
    assert.ok(lost > 0, `the bolt struck (${lost})`);
    assert.equal(seen.length, 1, 'one number for one landing');
    assert.equal(seen[0].hit, true);
    assert.equal(seen[0].damage, lost, 'the number is what the foe lost');
    assert.equal(seen[0].target, foe.entity);
    // a peer's spell landed on a foe I run: its number is the caster's, never mine
    seen.length = 0;
    const foe2 = foeOf();
    magic.applySpellToFoe(BOLT, 7, foe2, { entity: { level: 7 } }, { peerCaster: 'peer-0001' }, sinksOf(foe2));
    assert.ok(foe2.entity.health < 200, 'the peer\'s bolt struck');
    assert.equal(seen.length, 0, 'a peer\'s landing pops nothing on my HUD');
    // a spell with no harm in it says nothing
    seen.length = 0;
    const foe3 = foeOf();
    const LIGHT = { ...BOLT, name: 'No Harm', effects: [fx(4, 0, { magnitudeBaseLow: 0, magnitudeBaseHigh: 0, durationBase: 0 })] };
    magic.applySpellToFoe(LIGHT, pe.level, foe3, { entity: pe }, undefined, sinksOf(foe3));
    assert.equal(seen.length, 0, 'nothing struck, no number');
  } finally { setPlayerAttackHook(null); }
});
