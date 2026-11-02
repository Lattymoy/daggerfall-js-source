// RPT1026-FIGHTS WINDOW-ONLINE (two private reports: the room's host pausing or opening the inventory froze every foe of
// the shared dungeon while a party member killed them freely; a paralysed player waited the paralysis out in the
// inventory): online a window held the dungeon - its foes, the room's ONE
// simulation (WORLD2), frozen for the whole party while they took the party's blows - but not the character's own clock,
// which runs with the world's (LIVED1): the rounds a paralysis lasted ran out under the inventory and were walked whole on
// the first frame after it. WINFOE1 (Mac: "enemies should still be able to do damage") had ended both above ground; the
// dungeon never had it. Now online a window holds no dungeon while the player lives under it - the frame runs, its foes
// act and its rounds tick, the player's own motor, input and breath held - and offline the dungeon pauses as DFU's does.
// The law run (src/scenes/windowWorld.js), the clock it answers to run on the real tick, and the hosts by source.
// tools/mutants/rpt1026_fights.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { windowHoldsDungeon } from '../../src/scenes/windowWorld.js';
import { setSharedClock, tickPlayerMinutes, ownMinutes } from '../../src/systems/worldTick.js';
import { applySpell, entityIsParalyzed } from '../../src/systems/effects.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const fx = (type, subType, o = {}) => ({ type, subType, magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 5, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1, ...o });
const sinks = { hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} };

test('RPT1026-FIGHTS WINDOW-ONLINE THE REPORT\'S CLOCK: online the character\'s own clock runs under a window - a ten-round paralysis laid by a foe\'s spell is spent by the first tick after fifteen game minutes the frame never ran (seventy-five seconds of the online clock in the inventory), its rounds walked whole while the dungeon\'s foes stood frozen; so a window held there is a shelter (the root cause, as the real tick runs it)', (t) => {
  let clock = 1000;
  setSharedClock(() => clock);
  t.after(() => setSharedClock(null));
  const p = { isPlayer: true, level: 5, health: 50, maxHealth: 50, magicka: 10, maxMagicka: 10, fatigue: 1000, items: [], activeEffects: [], stats: { strength: 50, intelligence: 50, willpower: 10, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, skills: new Array(40).fill(5), skillUses: new Array(40).fill(0), career: {} };
  applySpell({ name: 'Hold', rangeType: 1, element: 4, effects: [fx(0, -1, { durationBase: 10 })] }, 10, p, sinks, () => 0.99, { entity: { level: 10 } });
  assert.equal(entityIsParalyzed(p), true, 'paralysed by the foe\'s spell');
  tickPlayerMinutes({ entity: p, classicMinutes: ownMinutes(), dt: 0.016, sinks });
  assert.equal(entityIsParalyzed(p), true, 'the frame before the window');
  clock += 15;   // the inventory open: no dungeon frame, the world's clock on
  const w = tickPlayerMinutes({ entity: p, classicMinutes: ownMinutes(), dt: 0.016, sinks });
  assert.equal(w.magicRoundWindow.rounds, 15, 'every round the window stood, walked at once');
  assert.equal(entityIsParalyzed(p), false, 'the paralysis waited out - the foes never moved');
  assert.equal(windowHoldsDungeon(true, true), false, 'so online the window holds no dungeon: its foes act through those rounds');
});

test('RPT1026-FIGHTS WINDOW-ONLINE THE LAW: offline a window holds the dungeon (DFU\'s PauseGame, the clock with it); online it holds none while the player lives - the death screen holds it in both; no window, nothing held (mutants: online held as offline; the dead\'s screen let run)', (t) => {
  setSharedClock(null);
  assert.deepEqual([windowHoldsDungeon(true, true), windowHoldsDungeon(true, false), windowHoldsDungeon(false, true)], [true, true, false], 'offline: DFU\'s pause');
  setSharedClock(() => 1000);
  t.after(() => setSharedClock(null));
  assert.deepEqual([windowHoldsDungeon(true, true), windowHoldsDungeon(true, false), windowHoldsDungeon(false, true), windowHoldsDungeon(false, false)], [false, true, false, false], 'online: the world runs under a living player\'s window');
});

test('RPT1026-FIGHTS WINDOW-ONLINE THE HOSTS: the world-hosted dungeon holds its frame by the law - the window\'s early return, the bodies drawn frozen under it, the Hour\'s poses and late telegraph - and draws a window it ran under last; the motor, the collision triggers, the breath and a pending cast still wait for it; the street host\'s tactics clock asks the same law; the offline hosts keep the pause (mutants: the early return by the window alone; no window drawn over a frame that ran; the breath run under a window)', () => {
  const WM = read('src/scenes/worldModes.js');
  const held = 'windowHoldsDungeon(dungeonCtx.uiOverlayActive, aliveUnder())';
  assert.ok(WM.includes(`if (${held}) { dungeonCtx.hideHudText?.(); hideWorldPlaque(); dungeonCtx.tickOverlay(dt);`), 'the early return is the law\'s');
  assert.ok(WM.includes(`if (${held}) dungeonCtx.drawWindowBodies?.(`), 'the frozen bodies only under a frame held');
  assert.ok(WM.includes(`if (isSdRealm(dungeonLoc) && !${held}) dungeonCtx.sdPose?.(dt, player.pos);`), 'the Hour posed whenever the frame runs');
  assert.ok(WM.includes(`if (_sdLate.on && ${held}) host.drawSdTelegraph?.(_sdLate);`));
  assert.ok(WM.includes('dungeonCtx.drawFoes(dt, canvas, proj, view, cam.pos, player.pos, !dungeonCtx.uiOverlayActive && anyMove(moveHeld(keys)),'), 'no move under a window: no trigger walked onto');
  assert.ok(WM.includes('if (dungeonCtx.unpausedOverlay || dungeonCtx.uiOverlayActive) { dungeonCtx.tickOverlay(dt); dungeonCtx.drawOverlay(canvas); }'), 'the window last, over a frame that ran under it');
  assert.match(WM, /const overlayHeld = [^\n]*\n[^\n]*\n\s+\(mode === 'dungeon' && !!dungeonCtx\?\.uiOverlayActive\);/, 'the motor still held by any window');
  const D = read('src/scenes/dungeonContext.js');
  assert.ok(D.includes('breathTick(opts.breathHeld?.() || dungeonPaused() ? 0 : dt, playerFeet, playerHeight);'), 'the breath waits under any window (AUDIT 27h S1)');
  assert.ok(D.includes('magic.firePending(eye, [-aimed[2], -aimed[6], -aimed[10]], !!opts.breathHeld?.() || dungeonPaused());'), 'and a pending cast');
  assert.ok(D.includes('cursorActive: dungeonPaused() || !!opts.pointerSurfaceUp?.(),'), 'the plaque hidden under it');
  const W = read('src/scenes/world.js');
  assert.ok(W.includes("tickTactics(foeFrameDt(_questBoxHoldsFoes() || (_mode() === 'dungeon' && windowHoldsDungeon(modes?.dungeonCtx?.uiOverlayActive, playerEntity.health > 0 && !modes?.deathUp?.())) ? 0 : dt));"), 'the brain\'s clock is the foes\' step: held when they are');
  // the offline hosts: the standalone dungeon and the fixed city never run online - DFU's pause, unchanged
  const DG = read('src/scenes/dungeon.js');
  assert.ok(DG.includes('tickTactics(foeFrameDt(ctx.uiOverlayActive ? 0 : dt));'));
  assert.ok(!/windowHoldsDungeon/.test(DG + read('src/scenes/exterior.js')), 'offline: no shared clock to answer');
});
