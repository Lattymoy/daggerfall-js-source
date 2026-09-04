// AUDIT 24, wave 39: hit feedback. Two whole DFU components that were
// never ported - EnemyBlood.ShowBloodSplash and ShowPlayerDamage - so
// striking an enemy produced no blood and being struck yourself
// produced nothing at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createHitEffects, bloodCentre, BLOOD_ARCHIVE, BLOOD_FPS, FORWARD_NUDGE,
} from '../src/scenes/hitEffects.js';
import {
  createDamageFlash, playerDamageFlash, flashPlayerDamage,
  FLASH_ALPHA, FLASH_FADE_SPEED, FLASH_RGB,
} from '../src/ui/damageFlash.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

// Mutation campaign: 32 reintroductions, 32 killed. The archive, the
// ten-FPS rate and the 2cm nudge; the one-shot turned back into a loop,
// its batch leaked, a single-frame splash left hanging, a mint landing
// on a cleared pool, a recenter that moves nothing and one that shifts
// in place instead of rebuilding, the persistent-list hook silenced;
// bloodCentre at the capsule centre and at the feet; the flash at full
// opacity, at the wrong rate, not red, STACKING across two blows, never
// stopping, drawn opaque, drawn over a texture, drawn only when HUD art
// loaded, and drawHud losing the clock; each of the five flash sites
// silenced one at a time; the dungeon never ticking its splashes; the
// encounter pool bleeding the watch's index; fall damage bleeding a
// BloodIndex instead of 0; the civilian murder bleeding one; and
// sparkles exported with no caller.
// One of the 32 is the direction that MATTERS MOST here: adding
// flashPlayerDamage to the spell host - making the port MORE responsive
// than Daggerfall - is killed too, by the arm that asserts the spell
// spine stays quiet.
// Two EQUIVALENT mutants, recorded rather than dressed up:
// `Array.from(pos)` for the position copy, and `||` for `??` on the
// nudge's y term (facing is never 0-valued there). Both survive.
const tick = () => new Promise((r) => setImmediate(r));   // let the texture promise land

function rig({ frameCount = 4, recordCount = 8 } = {}) {
  const built = [], destroyed = [];
  return {
    built, destroyed,
    renderer: {
      createBillboardBatch: (archive, record, size, centres) => {
        const b = { archive, record, size, centres, frame: null };
        built.push(b); return b;
      },
      destroyBillboardBatch: (b) => destroyed.push(b),
    },
    getTexture: async () => ({
      recordCount,
      getFrameCount: () => frameCount,
      getSize: () => ({ width: 64, height: 48 }),
      getScale: () => ({ width: 0, height: 0 }),
    }),
    uploads: [],
    uploadRecordFrame(a, r, f) { this.uploads.push([a, r, f]); },
  };
}

test('audit24 wave39: bloodIndex finally has a consumer, and it is the right archive', async () => {
  // EnemyBlood.cs:23 `const int bloodArchive = 380;` and :37
  // `c.FramesPerSecond = 10` - the general flat rate is 5, this one is
  // pinned to ten.
  assert.equal(BLOOD_ARCHIVE, 380);
  assert.equal(BLOOD_FPS, 10);
  assert.equal(FORWARD_NUDGE, 0.02);   // :35 `+ transform.forward * 0.02f`

  const r = rig();
  const fx = createHitEffects({ renderer: r.renderer, getTexture: r.getTexture, uploadRecordFrame: (a, b, c) => r.uploadRecordFrame(a, b, c) });
  fx.showBloodSplash(2, [1, 2, 3]);
  await tick();
  assert.equal(r.built.length, 1);
  assert.equal(r.built[0].archive, 380);
  assert.equal(r.built[0].record, 2, 'the record IS the bloodIndex');
  assert.deepEqual(r.built[0].centres[0], [1, 2, 3]);
  assert.equal(r.built[0].frame, 0);
  // every frame is uploaded up front, as the shared arming seam does
  assert.deepEqual(r.uploads, [[380, 2, 0], [380, 2, 1], [380, 2, 2], [380, 2, 3]]);

  // the six rows DFU marks are the six the port marks, so they splash
  // differently from everything else
  const marked = Object.keys(ENEMY_BASICS).map(Number).filter((i) => ENEMY_BASICS[i].bloodIndex === 2);
  assert.equal(marked.length, 6, 'DFU has exactly six `BloodIndex = 2` rows');
  assert.equal(ENEMY_BASICS[0].bloodIndex, undefined, 'and everything else is the struct default');
  assert.equal(fx.showBloodSplash(undefined, [0, 0, 0]) !== null, true, 'which reads as 0');
});

test('audit24 wave39: a splash is a ONE-SHOT - it ends, and frees its batch', async () => {
  const r = rig({ frameCount: 3 });
  const fx = createHitEffects({ renderer: r.renderer, getTexture: r.getTexture, uploadRecordFrame: () => {} });
  fx.showBloodSplash(0, [0, 0, 0]);
  await tick();
  const batch = r.built[0];
  assert.equal(fx.batches().length, 1);

  const step = 1 / BLOOD_FPS;
  fx.tick(step);            // display 1, advance
  assert.equal(batch.frame, 1);
  fx.tick(step);            // display 2
  assert.equal(batch.frame, 2);
  assert.equal(fx.batches().length, 1, 'still up on its last frame');
  fx.tick(step);            // the wrap: one-shot, done
  assert.equal(fx.batches().length, 0, 'gone');
  assert.equal(r.destroyed.length, 1, 'and its batch was freed, not leaked');
  assert.equal(r.destroyed[0], batch);
  assert.doesNotThrow(() => fx.tick(step), 'ticking an empty pool');

  // a SINGLE-frame record has no wrap to end on. It must not hang in
  // the world for ever waiting for one.
  const r2 = rig({ frameCount: 1 });
  const fx2 = createHitEffects({ renderer: r2.renderer, getTexture: r2.getTexture, uploadRecordFrame: () => {} });
  fx2.showBloodSplash(0, [0, 0, 0]);
  await tick();
  assert.equal(fx2.batches().length, 1);
  fx2.tick(0.001);
  assert.equal(fx2.batches().length, 0, 'retired on the next tick');
  assert.equal(r2.destroyed.length, 1);
});

test('audit24 wave39: the two positions DFU uses, and the nudge', async () => {
  // EnemyAttack.cs:326-328 / EntityEffectManager.cs:2061-2063:
  //     pos = transform.position + controller.center;  pos.y += height/8
  // The capsule centre is half the height up, so it is five eighths.
  assert.deepEqual(bloodCentre([0, 0, 0], 8), [0, 5, 0]);
  assert.deepEqual(bloodCentre([2, 10, -3], 1.8), [2, 10 + 0.9 + 0.225, -3]);

  // :35 - the splash is nudged 2cm along the struck thing's facing so
  // it does not z-fight the sprite it decorates.
  const r = rig();
  const fx = createHitEffects({ renderer: r.renderer, getTexture: r.getTexture, uploadRecordFrame: () => {} });
  fx.showBloodSplash(0, [0, 0, 0], [0, 0, 1]);
  await tick();
  assert.deepEqual(r.built[0].centres[0], [0, 0, FORWARD_NUDGE]);
  // no facing given (the fall-damage site has none) leaves it alone
  fx.showBloodSplash(0, [5, 5, 5]);
  await tick();
  assert.deepEqual(r.built[1].centres[0], [5, 5, 5]);
});

test('audit24 wave39: the pool survives a teardown mid-warm and a recenter mid-animation', async () => {
  // The corpse mint's lesson: the archive can still be loading when
  // the scene goes away.
  let resolveTex;
  const r = rig();
  const slow = () => new Promise((res) => { resolveTex = res; });
  const fx = createHitEffects({ renderer: r.renderer, getTexture: slow, uploadRecordFrame: () => {} });
  fx.showBloodSplash(0, [0, 0, 0]);
  fx.clear();
  resolveTex({ recordCount: 8, getFrameCount: () => 4, getSize: () => ({ width: 1, height: 1 }), getScale: () => ({ width: 0, height: 0 }) });
  await tick();
  assert.equal(r.built.length, 0, 'nothing mints onto a cleared pool');
  assert.equal(fx.batches().length, 0);

  // THE FOUR HOSTS RULE: a splash mid-animation follows the origin.
  const r2 = rig();
  const fx2 = createHitEffects({ renderer: r2.renderer, getTexture: r2.getTexture, uploadRecordFrame: () => {} });
  fx2.showBloodSplash(0, [10, 0, 10]);
  await tick();
  fx2.offsetAll([-819.2, 0, -819.2]);
  assert.equal(r2.built.length, 2, 'the batch was REBUILT (centres are baked into a static buffer)');
  assert.deepEqual(r2.built[1].centres[0], [10 - 819.2, 0, 10 - 819.2]);
  assert.equal(r2.destroyed.length, 1, 'and the old one freed');
});

test('audit24 wave39: the pool registers with a persistent draw list when the host has one', async () => {
  // The dungeon draws ctx.billboardBatches directly and the missile
  // impact already pushes/splices there; blood joins it the same way,
  // rather than the host merging batches() every frame.
  const list = [];
  const r = rig({ frameCount: 2 });
  const fx = createHitEffects({
    renderer: r.renderer, getTexture: r.getTexture, uploadRecordFrame: () => {},
    onSpawn: (b) => list.push(b), onRetire: (b) => { const i = list.indexOf(b); if (i >= 0) list.splice(i, 1); },
  });
  fx.showBloodSplash(0, [0, 0, 0]);
  await tick();
  assert.equal(list.length, 1);
  fx.tick(1 / BLOOD_FPS);
  fx.tick(1 / BLOOD_FPS);
  assert.equal(list.length, 0, 'spliced out when the one-shot ends');

  assert.match(rd('src/scenes/dungeonContext.js'), /onSpawn: \(b\) => billboardBatches\.push\(b\)/);
  // 2026-08-27 (Mac: "blood texture stays static in the air ... in
  // dungeons"): this line used to pin the clock in dungeon.js - the dev
  // host - and said nothing about worldModes, the host the game is
  // played in, which never ran it. The clock is the CONTEXT's now, in
  // drawFoes, the one frame function both dungeon hosts call; neither
  // host runs it itself, so neither can forget it and neither can run it
  // twice.
  const ctxSrc = rd('src/scenes/dungeonContext.js');
  // 1500 chars was a fit to the body as it stood; MW-D15's latch pushed
  // the tick past it. A window big enough to hold the body is the point,
  // not the number.
  const drawFoes = ctxSrc.slice(ctxSrc.indexOf('function drawFoes('), ctxSrc.indexOf('function drawFoes(') + 2500);
  assert.match(drawFoes, /hitEffects\.tick\(dt\);/, 'the splash clock runs inside drawFoes');
  assert.doesNotMatch(rd('src/scenes/dungeon.js'), /hitEffects\.tick\(/, 'the dev host no longer runs it (it would run twice)');
  assert.doesNotMatch(rd('src/scenes/worldModes.js'), /hitEffects\.tick\(/, 'the played host never has to');
  assert.match(rd('src/scenes/worldModes.js'), /dungeonCtx\.drawFoes\(dt,/, '...because it calls drawFoes, which does');
  assert.match(rd('src/scenes/dungeon.js'), /ctx\.drawFoes\(dt,/);
});

test('audit24 wave39: ShowPlayerDamage - 0.4 alpha falling at 0.7 a second', () => {
  assert.equal(FLASH_ALPHA, 0.4);        // ShowPlayerDamage.cs:35
  assert.equal(FLASH_FADE_SPEED, 0.7);   // :25
  assert.deepEqual(FLASH_RGB, [1, 0, 0]);// :46

  const f = createDamageFlash();
  assert.equal(f.fading, false);
  assert.equal(f.tick(1), 0, 'a flash that never happened draws nothing');

  f.flash();
  assert.equal(f.alpha, FLASH_ALPHA);
  assert.ok(Math.abs(f.tick(0.1) - (0.4 - 0.07)) < 1e-9);
  assert.ok(Math.abs(f.tick(0.1) - (0.4 - 0.14)) < 1e-9);
  // 0.4 / 0.7 is a touch under six tenths of a second
  assert.ok(f.fading);
  f.tick(0.4);
  assert.equal(f.fading, false, 'over by 0.6s');
  assert.equal(f.alpha, 0);

  // re-flashing RESTARTS rather than stacking - two blows in a second
  // do not darken the screen, they refill the same fade
  f.flash(); f.tick(0.3);
  const mid = f.alpha;
  f.flash();
  assert.equal(f.alpha, FLASH_ALPHA);
  assert.ok(mid < FLASH_ALPHA);

  // the draw is a blended full-screen solid, and only while fading
  const drawn = [];
  const renderer = { drawScreenQuad: (tex, dst, src, color) => drawn.push({ tex, dst, color }) };
  const canvas = { width: 800, height: 600 };
  f.tick(0.1);
  assert.equal(f.draw(renderer, canvas), true);
  assert.equal(drawn[0].tex, null, 'a null texture is the renderer solid');
  assert.deepEqual(drawn[0].dst, { x: 0, y: 0, w: 800, h: 600 });
  assert.deepEqual(drawn[0].color.slice(0, 3), FLASH_RGB);
  assert.ok(drawn[0].color[3] > 0 && drawn[0].color[3] < 1, 'alpha under one, so it blends');
  f.tick(10);
  assert.equal(f.draw(renderer, canvas), false, 'nothing once it is over');
  assert.equal(drawn.length, 1);
});

test('audit24 wave39: which hits flash is a LAW, not an omission', () => {
  // PlayerHealth.RemoveHealth is ShowPlayerDamage's only trigger, and
  // the whole DFU tree sends that message from three places. Spell
  // damage is NOT one of them.
  assert.match(rd('src/scenes/shared.js'), /flashPlayerDamage\(\);/, 'the fall (PlayerHealth.cs:57)');
  const act = rd('src/world/actionSystem.js');
  assert.equal((act.match(/flashPlayerDamage\(\)/g) ?? []).length, 2, 'both damage traps (DaggerfallAction :739 and :768)');
  for (const f of ['src/scenes/cityGuards.js', 'src/scenes/exteriorFoes.js', 'src/scenes/dungeonContext.js']) {
    assert.match(rd(f), /flashPlayerDamage\(\)/, `${f}: an enemy blow (EnemyAttack:406)`);
  }
  // and NOT from the spell spine - DamageHealth, ContinuousDamageHealth
  // and TransferHealth all pass showBlood:false / never touch
  // PlayerHealth, so a fireball does not flash and does not bleed
  for (const f of ['src/systems/effects.js', 'src/scenes/hostMagic.js']) {
    assert.doesNotMatch(rd(f), /flashPlayerDamage|showBloodSplash/, `${f}: the spell spine stays quiet, as DFU`);
  }

  // one flash for one player, reached the way hurtPlayer is
  assert.equal(typeof flashPlayerDamage, 'function');
  playerDamageFlash.tick(100);   // drain anything a sibling test left
  flashPlayerDamage();
  assert.equal(playerDamageFlash.alpha, FLASH_ALPHA);
  playerDamageFlash.tick(100);
  assert.equal(playerDamageFlash.fading, false);

  // THE FOUR HOSTS RULE: it rides the one drawHud call all four make,
  // and runs BEFORE the no-art return because a host with no HUD art
  // still takes damage.
  const hud = rd('src/ui/hud.js');
  const body = hud.slice(hud.indexOf('export function drawHud('));
  assert.ok(body.indexOf('playerDamageFlash.draw(') < body.indexOf('if (!art) return;'), 'before the art guard');
  assert.match(hud, /export function drawHud\(renderer, canvas, art, vitals, heading01, dt = 0,/);
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    // U38 widened drawHud with an options object, so the clock is no
    // longer the LAST argument. The law is that it is PASSED.
    assert.match(rd(f), /heading01, dt[,)]|% 1, dt[,)]/, `${f}: passes the clock`);
  }
});

test('audit24 wave39: the two DFU call sites deliberately NOT ported, and why', () => {
  // Both are dead in the shipped game, and porting them would make the
  // port bleed where Daggerfall does not.
  const m = rd('src/scenes/hitEffects.js');
  assert.match(m, /DaggerfallEntityBehaviour\.cs:173-176/);
  assert.match(m, /EnemyHealth\.cs:52/);
  // AUDIT 24 (wave 44): sparkles WAS the queued one here, cut rather
  // than half-wired on the reading that it needed the player's feet.
  // That reading was wrong - its one call site is inside
  // EnemyCastReadySpell and it blooms on the CASTER - so it shipped in
  // wave 44 and audit24_wave44 owns it now. The two DEAD sites above
  // stay unported, which is what this test is about.
  assert.match(m, /ShowMagicSparkles/);
  assert.match(m, /export const SPARKLES_RECORD = 3;/, 'ported in wave 44');

  // the four sites that ARE live
  assert.match(rd('src/scenes/cityGuards.js'), /hitEffects\?\.showBloodSplash\(ENEMY_BASICS\[GUARD_MOBILE_TYPE\]\?\.bloodIndex \?\? 0/);
  assert.match(rd('src/scenes/cityGuards.js'), /hitEffects\?\.showBloodSplash\(0,\n\s*\[eye\[0\] \+ lookDir\[0\] \* bestD/, 'the civilian murder, at the REAL impact point');
  assert.match(rd('src/scenes/exteriorFoes.js'), /hitEffects\?\.showBloodSplash\(ENEMY_BASICS\[foe\.mobileType\]\?\.bloodIndex \?\? 0/);
  for (const f of ['src/scenes/exteriorFoes.js', 'src/scenes/dungeonContext.js']) {
    assert.match(rd(f), /hitEffects\?\.showBloodSplash\(0, \[f\.ai\.feet\[0\]/, `${f}: fall damage bleeds at index 0`);
  }
});
