// NPC2: ONE SHARED BODY, MANY ACTORS.
//
// The law this suite exists for: two actors wearing one body must be
// able to stand at different points of the same animation, and each
// must be DRAWN at its own pose. The hazard is the shared assembly -
// pose every actor first and draw afterwards, and every actor wears
// the last one's pose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tpActorDeps } from './mwFixtures.mjs';
import { mwActorBody, _resetActorBodiesForTests } from '../src/characters/mwActorBody.js';
import { _resetActorCatalogForTests } from '../src/formats/mwActorCatalog.js';
import { mwActorState, drawMwActor, actorGroupFor } from '../src/characters/mwActorRig.js';

const reset = () => { _resetActorBodiesForTests(); _resetActorCatalogForTests(); };

/** A renderer that records what it was asked to draw, and snapshots
 *  the POSE at the moment of each draw - which is the only moment the
 *  shared assembly is guaranteed to hold this actor's pose. */
function recordingRenderer(body) {
  const draws = [];
  let meshes = 0;
  return {
    draws,
    meshCount: () => meshes,
    createCharacterMesh: () => { meshes++; return { vao: 1, buffers: [], ranges: [] }; },
    updateCharacterMesh: () => {},
    createCharacterTexture: () => 1,
    renderCharacterSprite: () => {
      // The pose, as it stands AT THE DRAW.
      const p = body.arm.pieces[0].positions;
      draws.push(Array.from(p.slice(0, 9)));
      return 1;
    },
    drawCharacterSpriteQuad: () => {},
  };
}
const CANVAS = { clientWidth: 640, clientHeight: 400 };
const VIEW = { proj: new Float32Array(16).fill(0), view: new Float32Array(16).fill(0), eye: [0, 1.6, 0] };
// A projection that is at least invertible enough for the box math.
VIEW.proj[0] = 1; VIEW.proj[5] = 1; VIEW.proj[10] = -1; VIEW.proj[11] = -1; VIEW.proj[14] = -0.2;
VIEW.view[0] = 1; VIEW.view[5] = 1; VIEW.view[10] = 1; VIEW.view[15] = 1;

test('NPC2: two actors on ONE body are drawn at their OWN poses', async () => {
  reset();
  const fx = tpActorDeps({ gen: 21 });
  const body = await mwActorBody({ race: 'fprace', worn: [] }, fx.deps);
  assert.ok(body, 'the shared body built');
  const r = recordingRenderer(body);

  const a = mwActorState();
  const b = mwActorState();
  // Walk the two playheads APART, then draw each. Every draw is
  // preceded by that actor's own pose, in the same call.
  const at = (state, dt) => drawMwActor(r, CANVAS, body, state, {
    dt, moving: false, feet: [0, 0, 0], yaw: 0, ...VIEW,
  });
  assert.equal(at(a, 0.30), true, 'the first actor drew');
  assert.equal(at(b, 0.05), true, 'the second actor drew');
  assert.equal(r.draws.length, 2);
  assert.notDeepEqual(r.draws[0], r.draws[1],
    'both actors were drawn at ONE pose - the playhead is not per actor, or the pose is not at the draw');
  // ...and their clocks really are independent.
  assert.notEqual(a.clip.time, b.clip.time, 'the two actors share a playhead');
  // ONE body means ONE mesh, however many actors ride it.
  assert.equal(r.meshCount(), 1, 'a second actor allocated a second mesh');
});

test('NPC2: an actor keeps its place in a group it is already playing', async () => {
  reset();
  const fx = tpActorDeps({ gen: 22 });
  const body = await mwActorBody({ race: 'fprace', worn: [] }, fx.deps);
  const r = recordingRenderer(body);
  const s = mwActorState();
  drawMwActor(r, CANVAS, body, s, { dt: 0.2, moving: false, feet: [0, 0, 0], ...VIEW });
  const group = s.group; const t1 = s.clip.time;
  drawMwActor(r, CANVAS, body, s, { dt: 0.2, moving: false, feet: [0, 0, 0], ...VIEW });
  assert.equal(s.group, group, 'the group churned while nothing changed');
  assert.ok(s.clip.time > t1, 'the playhead did not advance');
});

test('NPC2: the group ladder is the player’s own - idle at rest, movement when moving, null when the data has neither', () => {
  // Pure: the ladder is MW-D26's and is pinned there; what this asserts
  // is that the ACTOR asks it the same questions the player does.
  const body = (groups, mwType = 0) => ({ groupSet: new Set(groups), mwType });
  assert.equal(actorGroupFor(body(['idle', 'walkforward']), { moving: false }), 'idle');
  assert.equal(actorGroupFor(body(['idle', 'walkforward']), { moving: true }), 'walkforward');
  // Running with no run clip WALKS - composeMovementGroup's own swap.
  assert.equal(actorGroupFor(body(['idle', 'walkforward']), { moving: true, running: true }), 'walkforward');
  assert.equal(actorGroupFor(body(['idle', 'runforward', 'walkforward']), { moving: true, running: true }), 'runforward');
  // A weapon-suffixed variant wins when the data carries it...
  assert.equal(actorGroupFor(body(['idle', 'idle1h'], 3), { moving: false }), 'idle1h');
  // ...and the bare group stands when it does not (never a wrong clip).
  assert.equal(actorGroupFor(body(['idle'], 3), { moving: false }), 'idle');
  // Nothing resolvable is NULL, so the caller keeps its classic sprite.
  assert.equal(actorGroupFor(body([]), { moving: false }), null);
  assert.equal(actorGroupFor(body(['idle']), { moving: true }), null);
});

test('NPC2: nothing to draw is FALSE, never a throw and never a bind pose', async () => {
  reset();
  const fx = tpActorDeps({ gen: 23 });
  const body = await mwActorBody({ race: 'fprace', worn: [] }, fx.deps);
  const r = recordingRenderer(body);
  const s = mwActorState();
  assert.equal(drawMwActor(r, CANVAS, null, s, { feet: [0, 0, 0], ...VIEW }), false, 'no body');
  assert.equal(drawMwActor(r, CANVAS, body, s, { ...VIEW }), false, 'no feet');
  assert.equal(drawMwActor(null, CANVAS, body, s, { feet: [0, 0, 0], ...VIEW }), false, 'no renderer');
  // A body whose data carries no group for the state answers false
  // rather than drawing the bind pose - MWFIX2's forbidden outcome.
  assert.equal(drawMwActor(r, CANVAS, body, s, {
    dt: 0.1, moving: true, feet: [0, 0, 0], ...VIEW,
  }), false, 'a missing movement group drew SOMETHING');
  assert.equal(r.draws.length, 0, 'a refusal still reached the renderer');
});

// ═══ NPC2: WHICH ENEMIES, WEARING WHAT ══════════════════════════════
import { readFileSync } from 'node:fs';
import {
  isMwHumanoid, enemyMwRace, enemyWornPieces, enemyMwBodyOpts,
  DEFAULT_ENEMY_RACE, ORC_RACE,
} from '../src/characters/enemyMwBody.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { ARMOR_ENUM } from '../src/combat/enemyEquipment.js';

test('NPC2: the humanoid set is the 19 classes and the four Orc tiers - and NOTHING else', () => {
  // All 19 class enemies, 128..146 with no gaps.
  for (let t = MOBILE_TYPES.Mage; t <= MOBILE_TYPES.Knight_CityWatch; t++) {
    assert.equal(isMwHumanoid(t), true, `class mobile ${t} must wear a body`);
  }
  for (const t of [MOBILE_TYPES.Orc, MOBILE_TYPES.OrcSergeant, MOBILE_TYPES.OrcShaman, MOBILE_TYPES.OrcWarlord]) {
    assert.equal(isMwHumanoid(t), true, 'an Orc tier must wear a body');
  }
  // VAMPIRES ARE OUT, deliberately: a Morrowind vampire is a normal
  // body wearing vampire HEAD parts this port does not resolve, so a
  // Vampire Ancient would render as an ordinary human - worse than the
  // sprite it replaced. This assertion is the decision, written down.
  assert.equal(isMwHumanoid(MOBILE_TYPES.Vampire), false, 'a vampire would render as an ordinary human');
  assert.equal(isMwHumanoid(MOBILE_TYPES.VampireAncient), false);
  // Beasts are a CREATURE, not an NPC body (OpenMW splits them too).
  for (const t of [MOBILE_TYPES.Rat, MOBILE_TYPES.GiantBat, MOBILE_TYPES.Daedroth,
    MOBILE_TYPES.SkeletalWarrior, MOBILE_TYPES.Dragonling, MOBILE_TYPES.FireAtronach]) {
    assert.equal(isMwHumanoid(t), false, `beast ${t} must not take the NPC body path`);
  }
});

test('NPC2: an Orc is an Orsimer; a class enemy wears the declared port default', () => {
  assert.equal(enemyMwRace(MOBILE_TYPES.OrcWarlord), ORC_RACE);
  assert.equal(enemyMwRace(MOBILE_TYPES.Orc), 'orc');
  // Daggerfall gives a class enemy NO race - the sprite is per class,
  // not per people - so this is a port decision and it is named once.
  assert.equal(enemyMwRace(MOBILE_TYPES.Knight), DEFAULT_ENEMY_RACE);
  assert.equal(DEFAULT_ENEMY_RACE, 'breton', 'the Iliac Bay’s own people, and the port’s default elsewhere');
});

test('NPC2: the body wears the pieces the equipment roll ACTUALLY rolled', () => {
  // The armour you see must be the armour the damage maths prices -
  // armorValues alone cannot say which pieces produced them.
  const entity = {
    weapon: { templateIndex: 121, material: 3 },
    armorPieces: [
      { piece: ARMOR_ENUM.Cuirass, material: 4 },
      { piece: ARMOR_ENUM.Helm, material: 2 },
      { piece: ARMOR_ENUM.Kite_Shield, material: 1, shield: true },
    ],
  };
  assert.deepEqual(enemyWornPieces(entity), [
    { templateIndex: ARMOR_ENUM.Cuirass, material: 4 },
    { templateIndex: ARMOR_ENUM.Helm, material: 2 },
    // A shield is worn like any other piece - the composer takes it
    // through getShieldMesh's ladder (IG3).
    { templateIndex: ARMOR_ENUM.Kite_Shield, material: 1 },
  ]);
  // An enemy that rolled nothing wears nothing, and never throws.
  assert.deepEqual(enemyWornPieces({}), []);
  assert.deepEqual(enemyWornPieces(null), []);
  // The whole opts object, including the REAL sex roll.
  const opts = enemyMwBodyOpts(entity, MOBILE_TYPES.Nightblade, 'female');
  assert.equal(opts.female, true, 'the DFRandom gender roll must reach the body');
  assert.equal(opts.race, DEFAULT_ENEMY_RACE);
  assert.equal(opts.weapon, entity.weapon, 'the rolled weapon must be the shown weapon');
  assert.equal(opts.worn.length, 3);
  assert.equal(enemyMwBodyOpts(entity, MOBILE_TYPES.Rat, 'male'), null, 'a beast must answer null');
});

test('NPC2: the enemy remembers its worn pieces, and the foe pass falls back to the sprite', () => {
  // The roll's own list has to survive onto the entity, or the body
  // has nothing to wear.
  const host = readFileSync('src/scenes/hostCombat.js', 'utf8');
  assert.match(host, /entity\.armorPieces = eq\.armorPieces;/, 'the enemy forgets what it put on');
  // The seam: a body draws INSTEAD of the quad, and anything that is
  // not ready or not humanoid still pushes its sprite.
  const ctx = readFileSync('src/scenes/dungeonContext.js', 'utf8');
  assert.match(ctx, /if \(_mwBodyFor\(f\) && _drawMwFoe\(f, dt, proj, view, eye, _fParalyzed\)\) continue;/,
    'the body does not take the frame');
  const seam = ctx.indexOf('if (_mwBodyFor(f) && _drawMwFoe(');
  const push = ctx.indexOf('_mobileBatches.push(f.batch);');
  assert.ok(seam > 0 && push > seam, 'the sprite must remain the fallback BELOW the body');
  // Never blocking: the build is asked for once and the frame carries
  // on - a seconds-long build must never stall a frame.
  // NPC3a: the three-state dance (not asked / in flight / settled) and
  // the two-builder split live in requestMwBody, and EVERY host that
  // draws actors rides that one implementation - the dungeon's foes
  // and the street's guards alike. Two copies is how they drift.
  const rig = readFileSync('src/characters/mwActorRig.js', 'utf8');
  assert.match(rig, /if \(actor\._mwBody !== undefined\) return actor\._mwBody;/, 'a settled answer is re-derived every frame');
  assert.match(rig, /if \(actor\._mwPending\) return null;/, 'a build in flight blocks the frame');
  assert.match(rig, /\(opts \? mwActorBody\(opts\) : mwCreatureBody\(mobileType\)\)/,
    'beasts do not reach the creature builder');
  assert.match(ctx, /const _mwBodyFor = \(f\) => requestMwBody\(/, 'the dungeon keeps its own copy');
  const guards = readFileSync('src/scenes/cityGuards.js', 'utf8');
  assert.match(guards, /requestMwBody\(g, enemyMwBodyOpts\(g\.entity, g\.mobileType, g\.mobile\?\.gender\), g\.mobileType\)/,
    'the street keeps its own copy');
  // ...and a guard's body draws INSTEAD of its billboard, with the
  // sprite still the fallback below it.
  assert.match(guards, /if \(mw && _drawMwGuard\(g, dt, mw\)\) continue;/, 'the guard body does not take the frame');
  const gseam = guards.indexOf('if (mw && _drawMwGuard(');
  const gpush = guards.indexOf('out.push(g.batch);');
  assert.ok(gseam > 0 && gpush > gseam, 'the guard sprite must remain the fallback BELOW the body');
  // A held foe holds its frame (S19 FreezeAnims) - the body obeys the
  // same rule the sprite does.
  assert.match(ctx, /dt: paralyzed \? 0 : dt,/, 'a paralysed foe keeps animating');
});
