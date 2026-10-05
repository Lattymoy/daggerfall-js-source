// TELL6e - WHAT A LANDING DOES TO YOU (bible/12-Enhanced-AI/Feud-Arc.md section 8.2; Mac, 2026-10-04: "breath more depth
// into it", then "Go" on every call). A telegraphed blow that lands on the local player does more than its damage, by
// its shape: the lunge and the charge PUSH (3 and 5 m/s, decaying at 12, along the collider, never over a drop of more
// than 2 m); the slam, the ring and the leap RATTLE (0.6 s at 60% of the walk, the camera dipping); the sweep makes
// you BLEED (30% again over 3 s in three ticks, its foe's mark on each, any healing ending it, shown with the debuffs);
// an iron slam, ring or charge KNOCKS YOU DOWN (0.9 s: the eye down and up, no move, no swing, no cast; 5 s before
// another). A dodged blow does nothing.
// The law; the real player motor (the push and its edge, the rattle, the knockdown); the queue and its frame; the
// bleed; the HUD; the pools' word (only a telegraphed landing's, fresh, that did damage); the brain's stamp on the real
// foe; the four hosts, the three pools and the gates wired.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { PlayerMotor, BLOW_PUSH_DECAY, BLOW_PUSH_EDGE } from '../src/player/motor.js';
import { EnemyAI } from '../src/characters/enemyMotor.js';
import { EnemyAttack } from '../src/characters/enemyAttack.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { setTacticsClock, resetTactics, noteLocalPlayer } from '../src/ai/tactics.js';
import { liveBlows, resetBlows, BLOW_VERDICT_LIFE } from '../src/ai/foeBlows.js';
import { BLOW_EFFECT, blowEffectOf, queueBlowEffect, drainBlowEffects, knockedDown, startBleed, tickBleed, _resetBlowEffectsForTests } from '../src/systems/blowEffects.js';
import { landBlowEffect, playerBlowFrame } from '../src/scenes/hostCombat.js';
import { playerHarmMark, _resetHarmMarkForTests } from '../src/systems/harmMark.js';
import { activeSpellIcons, BLEED_ICON } from '../src/ui/hudActiveSpells.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); _resetBlowEffectsForTests(); _resetHarmMarkForTests(); T = 0; setPref('enhancedAI', true); });

// ── the law ─────────────────────────────────────────────────────────

test('TELL6e: the law by shape - the lunge and the charge push, the slam, the ring and the leap rattle, the sweep bleeds, iron\'s slam, ring and charge knock down; the aimed shot nothing (mutants: any shape\'s effect moved; iron ignored)', () => {
  assert.deepEqual({ ...BLOW_EFFECT.PUSH }, { lunge: 3, charge: 5 });
  assert.equal(BLOW_PUSH_DECAY, 12);
  assert.equal(BLOW_PUSH_EDGE, 2);
  assert.deepEqual([BLOW_EFFECT.RATTLE_S, BLOW_EFFECT.RATTLE_WALK], [0.6, 0.6]);
  assert.deepEqual([BLOW_EFFECT.BLEED_SHARE, BLOW_EFFECT.BLEED_TICKS, BLOW_EFFECT.BLEED_EVERY], [0.3, 3, 1]);
  assert.deepEqual([BLOW_EFFECT.KNOCKDOWN_S, BLOW_EFFECT.KNOCKDOWN_GUARD, BLOW_EFFECT.KNOCKDOWN_DROP], [0.9, 5, 0.6]);
  const of = (k, iron) => blowEffectOf(k, iron);
  assert.deepEqual(of('lunge'), { push: 3, rattle: false, bleed: false, knockdown: false });
  assert.deepEqual(of('charge'), { push: 5, rattle: false, bleed: false, knockdown: false });
  assert.deepEqual(of('charge', true), { push: 5, rattle: false, bleed: false, knockdown: true });
  assert.deepEqual(of('slam'), { push: 0, rattle: true, bleed: false, knockdown: false });
  assert.deepEqual(of('slam', true), { push: 0, rattle: true, bleed: false, knockdown: true });
  assert.deepEqual(of('ring', true), { push: 0, rattle: true, bleed: false, knockdown: true });
  assert.deepEqual(of('leap', true), { push: 0, rattle: true, bleed: false, knockdown: false }, 'a leap never knocks down');
  assert.deepEqual(of('sweep', true), { push: 0, rattle: false, bleed: true, knockdown: false });
  assert.deepEqual(of('aimed'), { push: 0, rattle: false, bleed: false, knockdown: false });
});

// ── the real player motor ───────────────────────────────────────────

const STILL = { forward: 0, strafe: 0, jump: false };
function motorOn(heightAt = () => 0) {
  const m = new PlayerMotor(new Collider(heightAt), { speed: 50, running: 30, swimming: 30 });
  m.spawn(0, 0, 0);
  for (let i = 0; i < 30; i++) m.update(1 / 60, STILL, 0);   // settle on the ground
  return m;
}

test('TELL6e: THE PUSH on the real motor - 3 m/s decaying at 12 m/s/s carries the body v^2/2a, along the collider; at an edge of more than 2 m it stops short (mutants: no decay; over the edge)', () => {
  const m = motorOn();
  const x0 = m.pos[0];
  m.blowPush(3, 0);
  for (let i = 0; i < 60; i++) m.update(1 / 60, STILL, 0);
  const d = m.pos[0] - x0;
  assert.ok(Math.abs(d - (3 * 3) / (2 * 12)) < 0.06, `pushed ${d.toFixed(3)} m (v^2/2a = 0.375)`);
  const cliff = motorOn((x) => (x > 0.25 ? -10 : 0));   // a drop of ten metres a quarter-metre off
  cliff.blowPush(5, 0);
  for (let i = 0; i < 60; i++) cliff.update(1 / 60, STILL, 0);
  assert.ok(cliff.pos[0] < 0.25 && cliff.pos[1] > -0.5, `never over the edge (${cliff.pos[0].toFixed(3)}, ${cliff.pos[1].toFixed(2)})`);
});

test('TELL6e: THE RATTLE on the real motor - 0.6 s at 60% of the walk, then the walk again (mutants: no rattle; the share lost)', () => {
  const walk = (rattle) => {
    const m = motorOn();
    if (rattle) m.blowRattle(0.6, 0.6);
    const z0 = m.pos[2];
    for (let i = 0; i < 24; i++) m.update(1 / 60, { forward: 1, strafe: 0, jump: false }, 0);   // 0.4 s, inside it
    return m.pos[2] - z0;
  };
  const plain = walk(false), rattled = walk(true);
  assert.ok(plain > 0.2);
  assert.ok(Math.abs(rattled / plain - 0.6) < 0.08, `${(rattled / plain).toFixed(3)} of the walk`);
});

test('TELL6e: THE KNOCKDOWN on the real motor - no move for 0.9 s, the eye 0.6 m down at once and up again at its end (mutants: the body moves; the eye stays)', () => {
  const m = motorOn();
  const eye0 = m.eyeAt(1)[1];
  m.blowKnockDown(0.9, 0.6);
  assert.equal(m.isDown(), true);
  const z0 = m.pos[2];
  let lowest = Infinity;
  for (let i = 0; i < 48; i++) { m.update(1 / 60, { forward: 1, strafe: 0, jump: true }, 0); lowest = Math.min(lowest, m.eyeAt(1)[1]); }   // 0.8 s, pressing on
  assert.ok(Math.abs(m.pos[2] - z0) < 1e-6, 'it did not move');
  assert.ok(near(eye0 - lowest, 0.6, 0.02), `the eye went down (${(eye0 - lowest).toFixed(3)})`);
  for (let i = 0; i < 12; i++) m.update(1 / 60, STILL, 0);
  assert.equal(m.isDown(), false);
  assert.ok(near(m.eyeAt(1)[1], eye0, 0.02), 'and up again');
});

// ── the queue, the bleed, the HUD ───────────────────────────────────

function fakeMotor() {
  const calls = [];
  return { calls, blowPush: (x, z) => calls.push(['push', x, z]), blowRattle: (s, k) => calls.push(['rattle', s, k]), blowKnockDown: (s, d) => calls.push(['down', s, d]) };
}

test('TELL6e: the frame - a push along the blow, a rattle and its dip, a bleed begun; a knockdown takes the push with it, and none again for 5 s after it (mutants: the guard; the push beside a knockdown)', () => {
  const mo = fakeMotor(), shakes = [], ent = { health: 50 };
  T = 10;
  queueBlowEffect(blowEffectOf('lunge'), 10, [0, 2], null);
  queueBlowEffect(blowEffectOf('slam'), 10, [1, 0], null);
  queueBlowEffect(blowEffectOf('sweep'), 10, [1, 0], { id: 'orc' });
  drainBlowEffects({ motor: mo, entity: ent, shake: (k) => shakes.push(k) });
  assert.deepEqual(mo.calls, [['push', 0, 3], ['rattle', 0.6, 0.6]]);
  assert.deepEqual(shakes, [BLOW_EFFECT.RATTLE_SHAKE]);
  assert.ok(ent.bleed && near(ent.bleed.per, 1), 'a bleed of 3 over three ticks');
  mo.calls.length = 0;
  queueBlowEffect(blowEffectOf('charge', true), 10, [1, 0], null);
  drainBlowEffects({ motor: mo });
  assert.deepEqual(mo.calls, [['down', 0.9, 0.6]], 'down - no push');
  assert.equal(knockedDown(10.5), true);
  assert.equal(knockedDown(10.95), false);
  T = 14;
  mo.calls.length = 0;
  queueBlowEffect(blowEffectOf('slam', true), 10, [1, 0], null);
  drainBlowEffects({ motor: mo });
  assert.deepEqual(mo.calls, [['rattle', 0.6, 0.6]], 'inside its 5 s guard: rattled, not down');
  T = 16;
  mo.calls.length = 0;
  queueBlowEffect(blowEffectOf('slam', true), 10, [1, 0], null);
  drainBlowEffects({ motor: mo });
  assert.deepEqual(mo.calls[0], ['down', 0.9, 0.6], 'past it: down again');
});

test('TELL6e: THE BLEED - three ticks a second apart, its foe\'s mark on each, any healing ending it, a second adding what the first had left; shown with the debuffs (mutants: healing ignored; the mark missing; the icon missing)', () => {
  const foe = { id: 'orc' }, ent = { health: 50, activeEffects: [] };
  const hurt = (n) => { ent.health -= n; };
  startBleed(ent, 9, foe, 0);
  assert.equal(tickBleed(ent, hurt, 0.5), 0);
  assert.equal(tickBleed(ent, hurt, 1), 3);
  assert.equal(playerHarmMark(), foe, 'its foe\'s mark');
  assert.equal(tickBleed(ent, hurt, 2.5), 3);
  const icons = activeSpellIcons(ent).other;
  assert.ok(icons.some((i) => i.displayName === 'Bleeding' && i.iconIndex === BLEED_ICON && i.expiring), 'with the debuffs, its last tick blinking');
  assert.equal(tickBleed(ent, hurt, 3), 3);
  assert.equal(ent.bleed, null, 'three and done');
  assert.equal(ent.health, 41);
  assert.equal(activeSpellIcons(ent).other.some((i) => i.displayName === 'Bleeding'), false);
  // a heal ends it
  startBleed(ent, 9, foe, 10);
  ent.health += 5;
  assert.equal(tickBleed(ent, hurt, 11), 0);
  assert.equal(ent.bleed, null);
  // a second adds the first's remainder
  startBleed(ent, 9, foe, 20);
  tickBleed(ent, hurt, 21);
  startBleed(ent, 3, foe, 21.5);
  assert.ok(near(ent.bleed.per * ent.bleed.left, 9), 'six left and three more');
});

test('TELL6e: the pools\' word - a fresh telegraphed landing that did damage queues its effect along the blow; a stale one, a roll of nothing or a plain swing spend it and do nothing (mutants: the stale queued; the word kept)', () => {
  const mo = fakeMotor();
  T = 5;
  const f = { ai: { feet: [0, 0, 3], _blowFx: { kind: 'lunge', iron: false, at: 5 } }, entity: { id: 'f' } };
  assert.deepEqual(landBlowEffect(f, 7, [0, 0, 0]), blowEffectOf('lunge'));
  assert.equal(f.ai._blowFx, null, 'spent');
  drainBlowEffects({ motor: mo });
  assert.deepEqual(mo.calls, [['push', 0, -3]], 'away from its foe');
  f.ai._blowFx = { kind: 'lunge', at: 5 };
  assert.equal(landBlowEffect(f, 0, [0, 0, 0]), null, 'a roll of nothing');
  assert.equal(f.ai._blowFx, null);
  f.ai._blowFx = { kind: 'lunge', at: 5 - BLOW_VERDICT_LIFE - 0.1 };
  assert.equal(landBlowEffect(f, 7, [0, 0, 0]), null, 'stale');
  assert.equal(landBlowEffect({ ai: { feet: [0, 0, 0] } }, 7, [0, 0, 0]), null, 'a plain swing');
  mo.calls.length = 0;
  drainBlowEffects({ motor: mo });
  assert.deepEqual(mo.calls, []);
});

test('TELL6e: ON THE MOTOR the brain stamps a landing that hit - its shape and guard - and never a miss (mutants: every landing stamped)', () => {
  const run = (f, secs, p) => { for (let s = 0; s < Math.round(secs * 60); s++) { T += 1 / 60; noteLocalPlayer(p, [0, 0, 1]); f.ai.update(1 / 60, p); f.atk.update(1 / 60, f.ai, p); } };
  const mk = () => { const ent = { health: 100, maxHealth: 100, mobileType: M.Orc, level: 12 }; return { ent, ai: new EnemyAI(new Collider(() => 0), [0, 0, 8], Math.PI, { vitals: () => ent }), atk: new EnemyAttack({ liveSpeed: () => 50, playerLevel: () => 5, reflexes: 2 }) }; };
  const wind = (f, p) => { for (let i = 0; i < 3600; i++) { run(f, 1 / 60, p); if (f.ai._tac?.state === 'windup') return liveBlows().get(f.ai); } return null; };
  const f = mk(), p = [0, 0, 0];
  const b = wind(f, p);
  run(f, b.land - T + 0.1, p);
  assert.deepEqual({ ...f.ai._blowFx, at: undefined }, { kind: b.kind, iron: false, at: undefined });
  resetTactics(); resetBlows();
  const g = mk(), q = [0, 0, 0];
  const c = wind(g, q);
  q[0] += 8;
  run(g, c.land - T + 0.1, q);
  assert.equal(g.ai._blowFx, null, 'a miss does nothing');
});

test('TELL6e: the hosts\' frame helper drains the queue and ticks the bleed through the host\'s own hurt (mutants: the bleed never ticked)', () => {
  const mo = fakeMotor(), ent = { health: 30 }, hurts = [];
  T = 1;
  queueBlowEffect(blowEffectOf('sweep'), 10, [1, 0], { id: 'f' });
  playerBlowFrame({ motor: mo, entity: ent, hurt: (n) => { hurts.push(n); ent.health -= n; } });
  assert.ok(ent.bleed, 'begun');
  T = 2;
  playerBlowFrame({ motor: mo, entity: ent, hurt: (n) => { hurts.push(n); ent.health -= n; } });
  assert.deepEqual(hurts, [1], 'its first tick, through the host\'s door');
});

test('TELL6e: wired - the four hosts\' player frames, the three pools\' hits, the swing and the cast barred while down (mutants: any host or pool unwired)', () => {
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeon.js']) {
    const s = rd(h);
    assert.match(s, /playerBlowFrame\(\{ motor: player, entity: playerEntity, shake: \(k\) => betterAmbience\.weaponKick\(k\), hurt: \(n\) => \{ hurtPlayer\(playerEntity, n\); flashPlayerDamage\(n\); surfacePlayer\(\); \} \}\);[^\n]*\n(?:[^\n]*if \(!overlayHeld\) \{\n(?:\s*\/\/[^\n]*\n)*)?[^\n]*player\.(update|holdFrame)\(/, `${h}: its player frame, before the motor's`);   // PIN MOVED (AUDIT TELL L6: the building's host runs it above its window gate, as the street's do)
  }
  for (const [h, rig] of [['src/scenes/world.js', 'weaponRig.frame(dt, { paralyzed: paralyzed || knockedDown() })'], ['src/scenes/exterior.js', 'weaponRig.frame(dt, { paralyzed: paralyzed || knockedDown() })'], ['src/scenes/worldModes.js', 'interiorWeapon.frame(dt, { paralyzed: paralyzed || knockedDown() })'], ['src/scenes/dungeonContext.js', 'weaponRig.frame(dt, { paralyzed: _pParalyzed || knockedDown() })']]) {
    assert.ok(rd(h).includes(rig), `${h}: no swing while down`);
  }
  assert.match(rd('src/scenes/hostMagic.js'), /function castInput\(eye, dir\) \{\n\s*const sp = readiedSpell;\n\s*if \(!sp\) return false;\n\s*if \(knockedDown\(\)\) return false;/, 'no cast while down');
  for (const [p, v] of [['src/scenes/exteriorFoes.js', 'f'], ['src/scenes/dungeonContext.js', 'f'], ['src/scenes/cityGuards.js', 'g']]) {
    assert.ok(rd(p).includes(`landBlowEffect(${v}, hp0 - playerEntity.health, playerFeet);`), `${p}: its hit asks`);   // PIN MOVED (AUDIT TELL L8: by what reached health)
  }
});
