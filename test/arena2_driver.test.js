// ARENA2 (2026-10-02): A BOUT PLAYED THROUGH, HEADLESS (scenes/arenaBouts.js over a fake stage - the bodies the pools
// would stand, their doors the pools' bout hooks): a ladder bout from the Herald's call to the purse and the ladder's
// step; my blows taken counted and my 1 HP floor; a yield by sheathing at the line (and refused above it); an
// exhibition between two AI fighters, the stranger's blow on it warned then a crime; a blow before the word made good;
// the healers; the fighters off the sand; the stage going takes its bout unsaid; the HUD, the music, the duel's law.
import { test } from 'node:test';
import { SAND_CEILING_M } from '../src/systems/arenaKit.js';
import assert from 'node:assert/strict';
import { createArenaBouts, YOU, CRIT_SHARE, LEAVE_AFTER_MS } from '../src/scenes/arenaBouts.js';
import { newArenaLadder, nextLadderBout, exhibitionFor, BOUT_PURSE } from '../src/systems/arenaLadder.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { ARENA_SONGS, ARENA_SCORE_SILENCE } from '../src/systems/arenaScore.js';
import { RING_R } from '../src/world/arenaFloor.js';

const settle = () => new Promise((r) => setTimeout(r, 0));
function rig({ kind = 'floor', foeHealth = 60, player = {} } = {}) {
  let t = 1000;
  const log = { say: [], notice: [], pay: [], heal: 0, crime: 0, hud: [], bouts: [], cues: [], removed: [] };
  const P = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: newArenaLadder(), ...player };
  const foes = [];
  const stage = {
    kind, centre: () => [50, 0, 40],
    spawn: async (mobile, feet, o) => { const f = { mobile, o, entity: { health: foeHealth, maxHealth: foeHealth, bout: o.bout, items: [{ name: 'loot' }] }, ai: { feet: [...feet], target: null, isHostile: true } }; foes.push(f); return f; },
    remove: (f) => log.removed.push(f),
    heightAt: () => null,
  };
  const A = createArenaBouts({
    now: () => t, rng: () => 0.99, playerEntity: P, setPlayerBout: (b) => log.bouts.push(b),
    say: (l) => log.say.push(l), notice: (ls) => log.notice.push(...ls), pay: (g) => log.pay.push(g), heal: () => { log.heal++; P.health = P.maxHealth; },
    crime: () => log.crime++, drawHud: (m) => log.hud.push(m), sound: { cue: (l) => log.cues.push(...l.map((c) => c.s)), bed: () => {}, stop: () => {} },
  });
  const step = (ms, o = {}) => { t += ms; A.frame(ms / 1000, { playerFeet: [44, 0, 40], sheathed: false, ...o }); };
  return { A, P, foes, stage, log, step, now: () => t };
}
/** Run the clock until the fight (the call's beats, the marks, the count). */
const toFight = (r) => { for (let i = 0; i < 200 && r.A.bout()?.phase !== 'fight'; i++) r.step(100); };
/** A blow on a fighter, through its door (the pool's damage door's bout hooks). */
const strike = (f, d, fromPlayer = true, striker = null) => {
  f.entity.health -= d;
  if (f.entity.health <= 0) { f.entity.health = 1; if (!f.entity.bout.out) { f.entity.bout.out = true; f.entity.bout.hooks.floor(f, { fromPlayer }); } return; }
  f.entity.bout.hooks.hurt(f, d, { fromPlayer, striker });
};

test('ARENA2 driver: a ladder bout - the call, the fight, my blows, the floor, the verdict, the purse, the ladder\'s step, the healers', async () => {
  const r = rig();
  r.A.setStage(r.stage);
  r.A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(r.P.arenaLadder) });
  await settle();
  const f = r.foes[0];
  assert.equal(f.o.level, 1, 'the tier\'s level');
  assert.equal(f.mobile, 138, 'the Pit\'s first: a Thief');
  assert.deepEqual(f.entity.items, [], 'no loot on the sand');
  assert.equal(f.entity.bout.side, 1);
  assert.equal(f.entity.bout.hold, true, 'held before the word');
  assert.deepEqual(r.log.bouts[0], { id: r.A.bout()?.id ?? r.log.bouts[0].id, side: 0, out: false, hold: true, kit: true });   // AUDIT ARENA-LADDER 2: `kit` - a ladder bout's law
  assert.ok(r.A.holds(), 'the duel\'s law from the call');
  assert.deepEqual(r.A.ring(), { centre: [50, 0, 40], radius: RING_R, ceilAbove: SAND_CEILING_M });   // AUDIT ARENA-LADDER: and the kit law's ceiling over the sand
  assert.equal(r.A.scoreWant(), ARENA_SONGS.march);
  // a blow before the word: made good, nothing counted
  strike(f, 10);
  assert.equal(f.entity.health, 60);
  toFight(r);
  assert.equal(f.entity.bout.hold, false);
  assert.ok(r.log.say.includes(ARENA_TEXT.call.ladder('The Pit', 'bout 1 of 3')));
  assert.ok(r.log.say.includes('3') && r.log.say.includes('Fight!'));
  assert.ok(r.log.cues.includes('drumsCall') && r.log.cues.includes('bell'));
  // the AI's blow on me: my health falls, the law hears it from my opponent
  f.ai.target = { isPlayer: true };
  r.P.health = 80;
  r.step(100);
  assert.equal(r.A.bout().fighters.find((x) => x.id === YOU).health, 80);
  assert.equal(r.A.bout().fighters.find((x) => x.id === 'f0').dealt, 20);
  // my blows, to the floor
  strike(f, 15); r.step(100);
  strike(f, 15); r.step(100);
  assert.equal(r.A.bout().fighters.find((x) => x.id === YOU).dealt, 30);
  strike(f, 100); r.step(100);
  assert.equal(r.A.bout().result.how, 'fall');
  assert.equal(r.A.bout().result.side, 0);
  for (let i = 0; i < 100 && r.A.bout().phase !== 'done'; i++) r.step(100);
  assert.equal(r.log.pay.length, 1);
  assert.ok(r.log.pay[0] >= BOUT_PURSE[0] * 0.75 && r.log.pay[0] <= BOUT_PURSE[0] * 1.5);
  assert.equal(r.P.arenaLadder.won, 1);
  assert.equal(r.P.arenaLadder.record.wins, 1);
  assert.ok(r.log.notice.some((l) => /yields|down/.test(l)) && r.log.notice.includes(ARENA_TEXT.ladder.boutWon(1)));
  assert.equal(r.log.heal, 1, 'the healers');
  assert.equal(r.A.scoreWant(), null, 'done: the director has the music');
  r.step(LEAVE_AFTER_MS);
  assert.deepEqual(r.log.removed, [f], 'off the sand');
  assert.equal(r.log.bouts.at(-1), null, 'my bout ended');
  assert.equal(r.A.holds(), false);
});

test('ARENA2 driver: my 1 HP floor - the spare only in my live bout; a fall loses, the ladder unmoved, no purse', async () => {
  const r = rig();
  assert.equal(r.A.playerSpare(), null, 'no bout, no spare');
  r.A.setStage(r.stage);
  r.A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(r.P.arenaLadder) });
  await settle();
  assert.equal(r.A.playerSpare(), null, 'not before the word');
  toFight(r);
  const sp = r.A.playerSpare();
  assert.equal(typeof sp.spare, 'function');
  r.P.health = 1;
  sp.spare(r.P);
  r.step(100);
  assert.equal(r.A.bout().result.how, 'fall');
  assert.equal(r.A.bout().result.side, 1);
  for (let i = 0; i < 100 && r.A.bout().phase !== 'done'; i++) r.step(100);
  assert.deepEqual(r.log.pay, []);
  assert.equal(r.P.arenaLadder.won, 0);
  assert.equal(r.P.arenaLadder.record.falls, 1);
  assert.ok(r.log.notice.includes(ARENA_TEXT.purse.lost));
});

test('ARENA2 driver: the yield - the blade sheathed at the line yields; above it the Herald says not yet', async () => {
  const r = rig();
  r.A.setStage(r.stage);
  r.A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(r.P.arenaLadder) });
  await settle();
  toFight(r);
  r.step(100, { sheathed: false });
  r.step(100, { sheathed: true });
  assert.ok(r.log.say.includes(ARENA_TEXT.refuse.yieldEarly));
  assert.equal(r.A.bout().result, null);
  r.step(100, { sheathed: false });
  r.P.health = 12;
  r.step(100, { sheathed: false });
  r.step(100, { sheathed: true });
  assert.equal(r.A.bout().result.how, 'yield');
  assert.equal(r.A.bout().result.side, 1);
  const hud = r.log.hud.filter(Boolean);
  assert.ok(hud.some((m) => m.hint === ARENA_TEXT.hud.yieldHint), 'the HUD said how');
});

test('ARENA2 driver: an exhibition on the city floor - two AI fighters, nobody\'s purse; a stranger\'s blow warned, then the watch', async () => {
  const r = rig({ kind: 'city' });
  const ex = exhibitionFor(400 * 1440 + 12 * 60 + 2);
  r.A.setStage(r.stage);
  r.A.ask({ where: 'city', kind: 'exhibition', ex });
  await settle();
  assert.equal(r.foes.length, 2);
  assert.deepEqual(r.foes.map((f) => f.entity.bout.side), [0, 1]);
  assert.ok(r.foes.every((f) => f.ai.isHostile === false), 'an exhibition fighter is nobody else\'s enemy (no rest refused near it)');
  assert.equal(r.A.holds(), false, 'an exhibition holds nobody');
  assert.equal(r.A.playerSpare(), null);
  assert.equal(r.A.hour(), ex.hour);
  toFight(r);
  assert.ok(r.A.onSand().a && r.A.onSand().b);
  r.foes[0].entity.bout.hooks.intrude(r.foes[0]);
  assert.deepEqual([r.log.say.at(-1), r.log.crime], [ARENA_TEXT.herald.intrude, 0]);
  r.foes[0].entity.bout.hooks.intrude(r.foes[0]);
  assert.deepEqual([r.log.say.at(-1), r.log.crime], [ARENA_TEXT.herald.intrudeCrime, 1], 'the second time, the watch');
  // the fighters' blows on each other: a crit by share, the crowd's own words
  strike(r.foes[1], Math.ceil(60 * CRIT_SHARE), false, r.foes[0]);
  r.step(100);
  assert.ok(r.log.cues.includes('gasp'), 'a telling blow: the crowd gasps');
  strike(r.foes[1], 200, false, r.foes[0]);
  r.step(100);
  assert.equal(r.A.bout().result.side, 0);
  for (let i = 0; i < 100 && r.A.bout()?.phase !== 'done'; i++) r.step(100);
  assert.deepEqual(r.log.pay, [], 'nobody is paid on this screen');
  assert.equal(r.P.arenaLadder.record.wins, 0, 'the ladder is mine alone');
});

test('ARENA2 driver: a stage that goes takes its bout unsaid; one asked before its stage stands starts with it', async () => {
  const r = rig();
  r.A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(r.P.arenaLadder) });
  assert.equal(r.A.bout(), null);
  assert.equal(r.A.pending().kind, 'ladder');
  r.A.setStage(r.stage);
  await settle();
  assert.equal(r.A.pending(), null);
  assert.equal(r.foes.length, 1);
  toFight(r);
  r.A.setStage(null);
  assert.equal(r.A.bout(), null);
  assert.deepEqual(r.log.removed, [r.foes[0]]);
  assert.equal(r.log.bouts.at(-1), null);
  assert.equal(r.A.batches().length, 0);
  assert.equal(r.A.scoreWant(), null);
});

test('ARENA2 driver: a Grand Melee stands every fighter on a side of its own; a two-against-one two on one side', async () => {
  const r = rig();
  r.A.setStage(r.stage);
  r.A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout({ tier: 9, won: 0 }) });
  await settle();
  assert.deepEqual(r.foes.map((f) => f.entity.bout.side), [1, 2, 3]);
  const r2 = rig();
  r2.A.setStage(r2.stage);
  r2.A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout({ tier: 8, won: 0 }) });
  await settle();
  assert.deepEqual(r2.foes.map((f) => f.entity.bout.side), [1, 1]);
  toFight(r2);
  assert.equal(r2.A.bout().kind, 'ladder');
  // the verdict of a champion bout gives the title's fanfare
  const r3 = rig({ player: { arenaLadder: { tier: 0, won: 3 } } });
  r3.A.setStage(r3.stage);
  r3.A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(r3.P.arenaLadder) });
  await settle();
  toFight(r3);
  strike(r3.foes[0], 999);
  for (let i = 0; i < 100 && r3.A.bout().phase !== 'done'; i++) r3.step(100);
  assert.ok(r3.log.cues.includes('title'));
  assert.equal(r3.P.arenaLadder.tier, 1);
  assert.ok(r3.log.notice.includes(ARENA_TEXT.verdict.tier('Hero', 'The Pit')));
  assert.equal(r3.A.scoreWant(), null);
  assert.ok([ARENA_SONGS.win, ARENA_SCORE_SILENCE, null].includes(r3.A.scoreWant()));
});
