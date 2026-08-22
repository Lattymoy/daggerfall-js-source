// The PLAYER-CAST ENGINE (scenes/hostMagic.js) - the first time the
// casting stack is unit-testable: dungeonContext carried it as scene
// code with zero execution coverage, and the M-slice extraction hands
// every law a headless pin. Sources cited in the module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { SILENCED_TEXT, PRESS_BUTTON_TO_FIRE_SPELL } from '../src/systems/mysticism.js';
import { SPELL_ABSORPTION } from '../src/systems/absorption.js';
import { calculateCastCost } from '../src/systems/spellcost.js';
import { SKILLS } from '../src/systems/skills.js';
import { MISSILE_SPEED, MISSILE_LIFESPAN_S } from '../src/systems/spellcast.js';

const damageEffect = (mag = 20) => ({
  type: 4, subType: 0,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
});
const healEffect = () => ({
  type: 10, subType: 8,
  magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
});
const spellOf = (rangeType, effects, over = {}) => ({
  name: 'Test Spell', index: 90, element: 0, rangeType, effects, ...over,
});

const mkPlayer = (over = {}) => ({
  isPlayer: true, level: 1, health: 50, maxHealth: 50,
  maxMagicka: 500, magicka: 500,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { intelligence: 50, willpower: 50, endurance: 50 },
  career: {}, activeEffects: [],
  ...over,
});
const mkFoe = (x, z) => ({
  dead: false,
  ai: { feet: [x, 0, z] },
  entity: {
    level: 1, health: 40, maxHealth: 40, magicka: 0, maxMagicka: 0,
    skills: new Array(40).fill(30), stats: { willpower: 30 },
    career: {}, activeEffects: [],
  },
});

/** A full engine over stubs; returns { magic, world } for inspection. */
function rig({ player = mkPlayer(), foes = [], raycast = () => Infinity } = {}) {
  const world = {
    player, foes, said: [], sounds: [], hurtPlayer: 0, foeHurt: new Map(),
    batchesMade: 0, batchesFreed: 0, surfaced: 0,
  };
  const magic = createPlayerMagic({
    renderer: {
      createBillboardBatch: () => { world.batchesMade++; return { origin: null }; },
      destroyBillboardBatch: () => { world.batchesFreed++; },
    },
    audio: { playOneShot: (id) => world.sounds.push(id), play3d: (id) => world.sounds.push(id) },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord: () => {},
    collider: { raycast },
    playerEntity: player,
    playerSinks: {
      hurt: (n) => { world.hurtPlayer += n; player.health -= n; },
      heal: (n) => { player.health = Math.min(player.maxHealth, player.health + n); },
      drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say: (l) => world.said.push(l),
    },
    say: (l) => world.said.push(l),
    surfacePlayer: () => { world.surfaced++; },
    foes: () => world.foes,
    foeSinks: (f) => ({
      hurt: (n) => { world.foeHurt.set(f, (world.foeHurt.get(f) ?? 0) + n); f.entity.health -= n; },
      heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {},
    }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.99,   // deterministic: saves fail, magnitudes roll high-end
  });
  return { magic, world };
}

test('hostMagic ready: silence refuses and clears; the cost gate speaks; ranged arms the click', () => {
  const { magic, world } = rig({ player: mkPlayer({ isSilenced: true }) });
  magic.readySpell(spellOf(2, [damageEffect()]));
  assert.equal(magic.readied(), null);
  assert.deepEqual(world.said, [SILENCED_TEXT]);

  const poor = rig({ player: mkPlayer({ magicka: 0 }) });
  poor.magic.readySpell(spellOf(2, [damageEffect()]));
  assert.equal(poor.magic.readied(), null);
  assert.deepEqual(poor.world.said, ["You don't have the spell points."]);

  const ok = rig();
  const sp = spellOf(2, [damageEffect()]);
  ok.magic.readySpell(sp);
  assert.equal(ok.magic.readied(), sp);
  assert.equal(ok.magic.spellArmed(), true, 'the click latch armed');
  // AUDIT 24 scenes: SetReadySpell's own HUD line
  // (EntityEffectManager.cs:355, Internal_Strings_en
  // 'pressButtonToFireSpell') - not the invented "<spell> readied."
  assert.deepEqual(ok.world.said, [PRESS_BUTTON_TO_FIRE_SPELL]);
});

test('hostMagic ready: a CasterOnly spell casts INSTANTLY on ready (no click latch)', () => {
  const player = mkPlayer({ health: 20 });
  const { magic, world } = rig({ player });
  const sp = spellOf(0, [healEffect()]);
  const cost = calculateCastCost(sp, player).sp;
  magic.readySpell(sp);
  assert.equal(magic.spellArmed(), false, 'no latch - it already fired');
  assert.equal(player.magicka, 500 - cost, 'the cost spent at ready');
  assert.equal(player.health, 40, 'the heal landed (20 + 20)');
  assert.ok(world.said.some((l) => l.startsWith('You are healed')), 'the heal line');
  assert.equal(player.skillUses[SKILLS.Restoration], 1, 'the school tallied once');
  assert.equal(world.sounds.length, 1, 'the element cast sound played');
});

test('hostMagic cast: ByTouch aborts BEFORE spending on a whiff; lands through LOS in reach', () => {
  const far = rig({ foes: [mkFoe(0, 10)] });
  far.magic.setReadied(spellOf(1, [damageEffect()]));
  assert.equal(far.magic.castInput([0, 0.9, 0], [0, 0, 1]), false, 'no target in touch range');
  assert.equal(far.world.player.magicka, 500, 'nothing spent on the whiff');

  const near = rig({ foes: [mkFoe(0, 1.5)] });
  const sp = spellOf(1, [damageEffect()]);
  near.magic.setReadied(sp);
  const cost = calculateCastCost(sp, near.world.player).sp;
  assert.equal(near.magic.castInput([0, 0.9, 0], [0, 0, 1]), true);
  assert.equal(near.world.player.magicka, 500 - cost);
  assert.ok(near.world.foeHurt.get(near.world.foes[0]) > 0, 'the touch landed');
  assert.equal(near.world.player.skillUses[SKILLS.Destruction], 1);
});

test('hostMagic cast: AreaAroundCaster sweeps every live foe in the radius', () => {
  const { magic, world } = rig({ foes: [mkFoe(1, 1), mkFoe(-1, 1), mkFoe(0, 40)] });
  magic.setReadied(spellOf(3, [damageEffect()]));
  assert.equal(magic.castInput([0, 0.9, 0], [0, 0, 1]), true);
  assert.ok(world.foeHurt.get(world.foes[0]) > 0, 'foe in radius hit');
  assert.ok(world.foeHurt.get(world.foes[1]) > 0, 'second foe hit');
  assert.equal(world.foeHurt.get(world.foes[2]), undefined, 'the distant foe untouched');
});

test('hostMagic cast: silence at CAST clears the readied spell and spends nothing', () => {
  const player = mkPlayer();
  const { magic, world } = rig({ player });
  magic.setReadied(spellOf(2, [damageEffect()]));
  player.isSilenced = true;   // a silence landing mid-aim
  assert.equal(magic.castInput([0, 0.9, 0], [0, 0, 1]), false);
  assert.equal(magic.readied(), null, 'disarmed');
  assert.equal(player.magicka, 500);
  assert.deepEqual(world.said, [SILENCED_TEXT]);
});

test('hostMagic missiles: fire, fly at MISSILE_SPEED, seek the foe, retire and prune', () => {
  const { magic, world } = rig({ foes: [mkFoe(0, 6)] });
  magic.setReadied(spellOf(2, [damageEffect()]));
  assert.equal(magic.castInput([0, 0.9, 0], [0, 0, 1]), true);
  // fly 6 units in steps - contact at the foe's mid-capsule
  for (let i = 0; i < 20 && !world.foeHurt.get(world.foes[0]); i++) magic.update(0.05, [0, 0, -5]);
  assert.ok(world.foeHurt.get(world.foes[0]) > 0, 'the missile landed');
  assert.equal(world.batchesFreed, world.batchesMade, 'the batch freed at retire');
  magic.update(0.05, [0, 0, -5]);
  // pruned: a second update walks no dead missiles (no throw, no new hurt)
  assert.equal(world.foeHurt.get(world.foes[0]), 20, 'exactly one landing');
});

test('hostMagic missiles: a wall retires; an AreaAtRange wall hit EXPLODES at the impact', () => {
  // single-target on a wall: nothing lands
  const wall = rig({ raycast: () => 0.4 });
  wall.magic.setReadied(spellOf(2, [damageEffect()]));
  wall.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  wall.magic.update(0.05, [0, 0.0, 0]);
  assert.equal(wall.world.hurtPlayer, 0);
  assert.equal(wall.world.batchesFreed, wall.world.batchesMade, 'retired on the wall');

  // AreaAtRange on a wall: the explosion sweeps foes AND the player in
  // radius of the impact point (DaggerfallMissile DoCollision).
  const aoe = rig({ foes: [mkFoe(0, 1)], raycast: () => 0.4 });
  aoe.magic.setReadied(spellOf(4, [damageEffect()]));
  aoe.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  aoe.magic.update(0.05, [0, 0, 0]);
  assert.ok(aoe.world.foeHurt.get(aoe.world.foes[0]) > 0, 'the blast caught the foe');
  assert.ok(aoe.world.hurtPlayer > 0, 'and the too-close caster');
});

test('hostMagic missiles: the lifespan retires a flier that hits nothing', () => {
  const { magic, world } = rig();
  magic.setReadied(spellOf(2, [damageEffect()]));
  magic.castInput([0, 0.9, 0], [0, 1, 0]);
  const steps = Math.ceil(MISSILE_LIFESPAN_S / 0.25) + 2;
  for (let i = 0; i < steps; i++) magic.update(0.25, null);
  assert.equal(world.batchesFreed, world.batchesMade);
  assert.ok(MISSILE_SPEED > 0);
});

test('hostMagic click seam: interceptAttack consumes the armed click; firePending casts ONCE', () => {
  const { magic, world } = rig({ foes: [] });
  magic.readySpell(spellOf(2, [damageEffect()]));
  assert.equal(magic.interceptAttack(true), true, 'the armed click becomes a cast, not a swing');
  assert.equal(magic.spellArmed(), true, 'pending until the frame fires it');
  assert.equal(magic.interceptAttack(true), false, 'a second click is a normal swing');
  assert.equal(magic.firePending([0, 0.9, 0], [0, 0, 1]), true);
  assert.equal(magic.firePending([0, 0.9, 0], [0, 0, 1]), false, 'consumed');
  assert.equal(world.player.magicka < 500, true, 'the cast spent');
});

test('hostMagic magic-5 end to end: a self-cast refund never exceeds what it cost', () => {
  // An Always-absorbing caster damage-bombs themself (rangeType 0):
  // the absorb tally would exceed the cast cost; the ctx-threaded
  // lastCastCost caps the refund, so magicka comes back EXACTLY even.
  const player = mkPlayer({ career: { spellAbsorptionFlags: SPELL_ABSORPTION.Always } });
  const { magic } = rig({ player });
  const sp = spellOf(0, [damageEffect(30), damageEffect(30)]);
  magic.readySpell(sp);   // instant CasterOnly
  assert.equal(player.magicka, 500, 'spent cost, refunded exactly cost - never more');
  assert.equal(player.health, 50, 'the absorbed spell dealt nothing');
});

test('hostMagic save seam: readiedIndex round-trips through setReadiedByIndex', () => {
  const { magic } = rig();
  const sp = spellOf(2, [damageEffect()], { index: 42 });
  magic.setReadied(sp);
  assert.equal(magic.readiedIndex(), 42);
  const byIndex = new Map([[42, sp]]);
  const fresh = rig().magic;
  fresh.setReadiedByIndex(42, byIndex);
  assert.equal(fresh.readied(), sp);
  fresh.setReadiedByIndex(null, byIndex);
  assert.equal(fresh.readied(), null);
});
