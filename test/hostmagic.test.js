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
import { SpellCastAnim, RELEASE_FRAME, ANIM_SPEED } from '../src/combat/fpsSpellCasting.js';

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

/** A full engine over stubs; returns { magic, world } for inspection.
 *  ROAD-E6: `hands` mounts a REAL FPSSpellCasting animation as the
 *  engine's startCastAnim, which is how the four hosts wire their
 *  weapon rig - without it the engine takes DFU's no-animation arm and
 *  resolves the cast on the spot. */
function rig({ player = mkPlayer(), foes = [], raycast = () => Infinity, hands = null } = {}) {
  const world = {
    player, foes, said: [], sounds: [], castSoundIds: [], hurtPlayer: 0, foeHurt: new Map(),
    batchesMade: 0, batchesFreed: 0, surfaced: 0,
    // AUDIT 39: the two uploaders are DIFFERENT KEYS - `${a}_${r}` and
    // `${a}_${r}#${f}` - so which one a pool is handed is observable.
    records: [], frames: [],
  };
  const magic = createPlayerMagic({
    renderer: {
      createBillboardBatch: (archive, record, size, centres) => { world.batchesMade++; return { archive, record, size, centres, origin: null }; },
      destroyBillboardBatch: () => { world.batchesFreed++; },
    },
    // AUDIT 54: the cast sound goes through the ID door (PlayCastSound's
    // `(uint)castSoundID`, EntityEffectManager.cs:1958), so the fake
    // device carries the ID entry points the host actually calls.
    audio: {
      playOneShot: (id) => world.sounds.push(id), play3d: (id) => world.sounds.push(id),
      playOneShotId: (id) => { world.castSoundIds.push(id); world.sounds.push(id); },
      play3dId: (id) => { world.castSoundIds.push(id); world.sounds.push(id); },
    },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord: (a, r) => world.records.push(`${a}_${r}`),
    uploadRecordFrame: (a, r, f) => world.frames.push(`${a}_${r}#${f}`),
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
    startCastAnim: hands ? (sp, onRelease) => hands.playOneShot(sp.element, onRelease) : null,
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

test('AUDIT 39: the impact flash uploads on the FRAME key, which is the key the draw looks for', async () => {
  // DaggerfallMissile.DoCollision (:364-370) - UseSpellBillboardAnims
  // (1, true) at ImpactBillboardFramesPerSecond. hitEffects uploads
  // every frame of record 1 under the composite `${record}#${frame}`
  // key and sets `batch.frame = 0`, and the draw then asks the texture
  // map for `${archive}_${record}#${frame}` and RETURNS if it is not
  // there. The engine handed the pool the 2-arg `uploadRecord` in the
  // 3-arg `uploadRecordFrame` slot, so `375_1` was uploaded, `375_1#0`
  // was asked for, and every impact flash in every host that mounts
  // this engine drew nothing at all - F033 shipped dead and green,
  // because its pin only counted call sites.
  const { magic, world } = rig({ raycast: () => 0.4 });   // a wall just ahead
  magic.setReadied(spellOf(2, [damageEffect()]));
  assert.equal(magic.castInput([0, 0.9, 0], [0, 0, 1]), true);
  magic.update(0.05, [0, 0, 0]);                 // the missile reaches the wall
  await new Promise((r) => setTimeout(r, 0));    // the flash's archive warms
  assert.ok(world.frames.includes('375_1#0'),
    `record 1 of the element archive, frame-keyed (saw ${JSON.stringify(world.frames)})`);
  assert.equal(world.records.includes('375_1'), false,
    'and never under the record-only key, which the draw cannot find');
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

test('AUDIT-39r: clearMissiles is the load/teleport sweep - the flights go, the engine stays', async () => {
  // CleanupUntrackedObjects (StreamingWorld.cs:1620-1644, on
  // SaveLoadManager_OnStartLoad): "remove loose enemies, missiles, etc.
  // on load or new game", and the same sweep a teleport reaches through
  // ClearStreamingWorld. A missile in the air when a fast travel or a
  // quickload lands must not arrive with the player. This seam shipped
  // held by nothing but a source-text grep of world.js - deleting the
  // whole method left the suite green while the one call site became a
  // TypeError inside an async teleport.
  const { magic, world } = rig();
  magic.setReadied(spellOf(2, [damageEffect()]));
  assert.equal(magic.castInput([0, 0.9, 0], [0, 1, 0]), true, 'straight up - nothing to hit');
  assert.equal(magic.missileCount(), 1, 'one flight in the air');
  magic.update(0.05, null);                     // the flight asks for its art
  await new Promise((r) => setTimeout(r, 0));   // the archive warms and the billboard exists
  assert.ok(world.batchesMade > 0, 'the flight has a billboard');

  magic.clearMissiles();
  assert.equal(magic.missileCount(), 0, 'the sweep takes it');
  assert.equal(world.batchesFreed, world.batchesMade, 'and hands its billboard back');
  magic.update(0.05, [0, 0, 0]);   // nothing swept is walked again
  assert.equal(magic.missileCount(), 0);

  // destroy() is the TERMINAL teardown and takes the candle and the
  // impact batches with it; the engine outlives a teleport, so this
  // frees the flights alone and must leave a castable engine behind.
  magic.clearMissiles();   // idempotent
  magic.setReadied(spellOf(2, [damageEffect()]));
  assert.equal(magic.castInput([0, 0.9, 0], [0, 1, 0]), true);
  assert.equal(magic.missileCount(), 1, 'the engine still casts after the sweep');
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


// ═══ ROAD-E6: THE RELEASE FRAME IS THE SPELL ════════════════════════
// EntityEffectManager.CastReadySpell (:400-439) spends the magicka and
// starts the hands; FPSSpellCasting's coroutine raises OnReleaseFrame
// five frames later (:283-284) and PlayerSpellCasting_OnReleaseFrame
// (:2098-2143) is what tallies, sounds, launches and clears.

test('ROAD-E6: the cast SPENDS and starts the hands; the spell leaves them five frames later', () => {
  const hands = new SpellCastAnim();
  const { magic, world } = rig({ hands });
  const sp = spellOf(2, [damageEffect()]);
  const cost = calculateCastCost(sp, world.player).sp;
  magic.setReadied(sp);

  assert.equal(magic.castInput([0, 0.9, 0], [0, 0, 1]), true, 'the cast started');
  // :423-425 DecreaseMagicka is at the CAST, before a frame of motion.
  assert.equal(world.player.magicka, 500 - cost, 'the magicka is spent at the cast');
  assert.equal(hands.isPlayingAnim, true, 'PlayOneShot ran (:434)');
  assert.equal(magic.castInProgress(), true, 'castInProgress (:435)');
  // ...and NOTHING of the release has happened yet.
  assert.equal(magic.missileCount(), 0, 'no missile before the release frame');
  assert.equal(world.player.skillUses[SKILLS.Destruction], 0, 'no tally before the release frame');
  assert.deepEqual(world.sounds, [], 'no cast sound before the release frame');
  assert.equal(magic.readied(), sp, 'the ready survives the hand motion (:2135 clears it, not :434)');

  // Four steps of 0.04s - frame 4 of 7 - and the spell is still in hand.
  for (let i = 0; i < RELEASE_FRAME - 1; i++) hands.tick(ANIM_SPEED);
  assert.equal(magic.missileCount(), 0, 'frame 4 is not the release frame');
  assert.equal(world.player.magicka, 500 - cost, 'and nothing spends twice');

  // The fifth step IS releaseFrame (:46 = 5).
  assert.equal(hands.tick(ANIM_SPEED), true, 'the step that crosses releaseFrame');
  assert.equal(magic.missileCount(), 1, 'the missile leaves the hands on frame 5');
  assert.equal(world.player.skillUses[SKILLS.Destruction], 1, "the tally is the release frame's (:2109)");
  assert.equal(world.sounds.length, 1, 'and so is the cast sound (:2112-2115)');
  assert.equal(magic.readied(), null, 'the ready clears at :2135');
  assert.equal(magic.castInProgress(), false, ':2100');
});

test('ROAD-E6: castInProgress refuses a second cast and a new ready for the whole 0.2s', () => {
  const hands = new SpellCastAnim();
  const { magic, world } = rig({ player: mkPlayer({ health: 20 }), hands });
  const sp = spellOf(2, [damageEffect()]);
  const cost = calculateCastCost(sp, world.player).sp;
  magic.setReadied(sp);
  magic.castInput([0, 0.9, 0], [0, 0, 1]);

  // :408 - "a previous cast must not be in progress".
  assert.equal(magic.castInput([0, 0.9, 0], [0, 0, 1]), false, 'the second click does nothing');
  assert.equal(world.player.magicka, 500 - cost, 'and spends nothing');
  // :315 - SetReadySpell's own castInProgress term. It refuses BEFORE
  // touching a field, so the spell already readied is left standing.
  magic.readySpell(spellOf(0, [healEffect()]));
  assert.equal(magic.readied(), sp, 'no new ready while the hands are in motion');
  assert.equal(world.player.health, 20, 'and the CasterOnly instant did not fire');

  for (let i = 0; i < RELEASE_FRAME; i++) hands.tick(ANIM_SPEED);
  assert.equal(magic.castInProgress(), false, 'the window closes on the release frame');
  assert.equal(magic.missileCount(), 1);
});

test('ROAD-E6: a spell aborted inside the window never reaches the release - and is not refunded', () => {
  const hands = new SpellCastAnim();
  const { magic, world } = rig({ hands });
  const sp = spellOf(2, [damageEffect()]);
  const cost = calculateCastCost(sp, world.player).sp;
  magic.setReadied(sp);
  magic.castInput([0, 0.9, 0], [0, 0, 1]);
  // AbortReadySpell (:361-365) nulls readySpell and nothing else.
  magic.setReadied(null);
  for (let i = 0; i < RELEASE_FRAME; i++) hands.tick(ANIM_SPEED);
  // :2102-2104 "Must have a ready spell" - DFU's own comment at :2107
  // is "Cancelled spells do not reach this point".
  assert.equal(magic.missileCount(), 0, 'nothing launched');
  assert.equal(world.player.skillUses[SKILLS.Destruction], 0, 'nothing tallied');
  assert.deepEqual(world.sounds, [], 'nothing sounded');
  assert.equal(world.player.magicka, 500 - cost, 'the magicka stays spent - there is no refund');
  assert.equal(magic.castInProgress(), false, 'the flag still clears (:2100 runs first)');
});

test("ROAD-E6: no animation means the release is NOW - DFU's own no-anim arm", () => {
  // CastNoAnimSpell (:367-398) and the non-player EnemyCastReadySpell
  // branch (:436-439) both resolve inline: an engine with no rig, or a
  // rig whose PlayOneShot refuses (an element with no CIF archive),
  // never touches FPSSpellCasting.
  const bare = rig();                       // no hands at all
  bare.magic.setReadied(spellOf(2, [damageEffect()]));
  assert.equal(bare.magic.castInput([0, 0.9, 0], [0, 0, 1]), true);
  assert.equal(bare.magic.missileCount(), 1, 'the missile flew on the spot');
  assert.equal(bare.magic.castInProgress(), false, 'and no window opened');

  // GetMagicAnimFilename has no arm for ElementTypes.None, so
  // PlayOneShot refuses and the engine takes the same immediate path.
  const hands = new SpellCastAnim();
  const none = rig({ hands });
  none.magic.setReadied(spellOf(2, [damageEffect()], { element: 99 }));
  assert.equal(none.magic.castInput([0, 0.9, 0], [0, 0, 1]), true);
  assert.equal(hands.isPlayingAnim, false, 'no archive, no hands');
  assert.equal(none.magic.missileCount(), 1, 'the spell still goes');
});

test('ROAD-E6: ByTouch picks TWICE - the pre-spend gate, then DoTouch on the live aim', () => {
  // DFU spawns the missile at the release frame, so its Start runs
  // DoTouch off the caster transform AT THAT MOMENT
  // (DaggerfallMissile.cs:265-286, :273-275). The gate at :411-421 only
  // decides whether the magicka is spent at all.
  const hands = new SpellCastAnim();
  const gone = mkFoe(0, 1.5);
  const one = rig({ foes: [gone], hands });
  one.magic.setReadied(spellOf(1, [damageEffect()]));
  assert.equal(one.magic.castInput([0, 0.9, 0], [0, 0, 1]), true, 'the pre-spend gate found it');
  gone.ai.feet = [0, 0, 30];   // out of reach before the hands open
  for (let i = 0; i < RELEASE_FRAME; i++) hands.tick(ANIM_SPEED);
  assert.equal(one.world.foeHurt.get(gone), undefined, 'DoTouch found nothing on the release frame');

  // ...and the aim is the LIVE one: every host feeds the engine its
  // eye/dir once a frame through firePending, so a player who turns
  // during the 0.2s touches whatever the NEW look is pointing at.
  const h2 = new SpellCastAnim();
  const ahead = mkFoe(0, 1.5);
  const aside = mkFoe(1.5, 0);
  const two = rig({ foes: [ahead, aside], hands: h2 });
  two.magic.setReadied(spellOf(1, [damageEffect()]));
  two.magic.castInput([0, 0.9, 0], [0, 0, 1]);
  two.magic.firePending([0, 0.9, 0], [1, 0, 0]);   // the host's next frame, turned
  for (let i = 0; i < RELEASE_FRAME; i++) h2.tick(ANIM_SPEED);
  assert.equal(two.world.foeHurt.get(ahead), undefined, 'the cast-time target is not the one touched');
  assert.ok(two.world.foeHurt.get(aside) > 0, 'the release touched what the live aim points at');
});
