// AUDIT WB (2026-09-25, Mac: "A proper audit on everything"): THE COURT ON THE CLIENT's findings, pinned - a dead player
// taken out of the court at no health (B1), a way home walked by the dead (B2), a court entered by the dead (B3), a
// relay woken from its checkpoint whose attacks passed unfelt (B4), a court the relay would not admit to (B5), a Warden
// struck after his Wrath (B6), and his death cry heard minutes late (B7). Design: bible/11-Multiplayer/World-Bosses.md
// section 11.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ATTACKS } from '../src/net/gateBrain.js';
import { createGateCourt, FALL_CRY_LATE_MS } from '../src/scenes/gateCourt.js';
import { createGateLink, GATE_STATE_EMPTY, GATE_NO_TEXT } from '../src/net/gateLink.js';
import { courtToDungeon, COURT_TEXT } from '../src/world/gateArena.js';
import { BOSS_CUES, THUD_AT_MS } from '../src/world/gateBoss.js';
import { destroyGateBossBar } from '../src/ui/gateBossBar.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const state = (over = {}) => ({ ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', hp: 900, max: 1000, fighters: 3, wrathAt: 10_000_000, ...over });
const W = (key, over = {}) => ({ i: 1, a: ATTACKS[key].id, at: 10000, x: 0, z: 0, yw: 0, tg: [], ...over });

/** A court driven by hand (test/wb4_gate_boss.test.js's harness): a link the test writes, a clock, feet, a player. */
function court({ feet = [1, 0, 1], health = 200 } = {}) {
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const struck = [], sounds = [], sent = [];
  const me = { health, maxHealth: health };
  const c = createGateCourt({
    renderer: null, gl: null, audio: { play3d: (clip, p, v, o) => sounds.push([clip, o.pitch]), play3dId: (id, p, v, o) => sounds.push([`id${id}`, o.pitch]) },
    link, now: () => clock.t, cam: () => courtToDungeon(0, 1.7, 20),
    feet: () => (feet ? courtToDungeon(feet[0], 0, feet[2]) : null), player: () => me, save: () => 0,
    strike: (dmg, how) => { struck.push([dmg, how]); me.health = Math.max(1, me.health - dmg); }, rng: () => 0.5,
    send: (hit) => { sent.push(hit); return true; },
  });
  return { c, link, clock, struck, sounds, sent, me };
}
const tick = (h, t, st) => { if (st) h.link.st = st; h.clock.t = t; h.c.frame(); };
const heard = (h, cue) => h.sounds.filter(([clip, pitch]) => (clip === cue.clip || clip === `id${cue.id}`) && pitch === cue.pitch).length;

test('AUDIT WB B4 an attack is its number AND its moment: a relay woken from its checkpoint numbers its attacks again, and the next one is judged, cued and landed all the same', () => {
  destroyGateBossBar();
  const h = court();
  const slam = W('slam', { i: 5, at: 10_000 });
  tick(h, 9000, state({ atk: slam }));
  tick(h, 10_005);
  assert.equal(h.struck.length, 1, 'the slam lands on me');
  const cues = heard(h, BOSS_CUES.windup.slam), lands = heard(h, BOSS_CUES.land.slam), quakes = heard(h, BOSS_CUES.quake);
  assert.deepEqual([cues, lands, quakes], [1, 1, 1]);
  // the room sleeps and wakes from a checkpoint taken before attack 5: its next attack is numbered 5 again
  const again = W('slam', { i: 5, at: 40_000 });
  tick(h, 39_000, state({ atk: again }));
  tick(h, 40_005);
  assert.equal(h.struck.length, 2, 'the new attack 5 lands too - not taken for the one already judged');
  assert.equal(heard(h, BOSS_CUES.windup.slam), 2, 'its wind-up heard');
  assert.equal(heard(h, BOSS_CUES.land.slam), 2, 'its landing heard');
  assert.equal(heard(h, BOSS_CUES.quake), 2, 'the ground shakes under it');
  // the same attack said again (a reconnect's whole state) is the same attack: not judged twice
  tick(h, 40_050, state({ atk: { ...again } }));
  tick(h, 40_100);
  assert.equal(h.struck.length, 2);
  assert.equal(heard(h, BOSS_CUES.land.slam), 2);
  assert.equal(h.c.state().judgedI, 5);
});

test('AUDIT WB B6 once the Wrath has come he is no body a blow meets: no target, and no blow sent - the relay judges none after it', () => {
  const h = court();
  tick(h, 5000, state());
  assert.ok(h.c.target(), 'a body while the fight stands');
  assert.equal(h.c.hit({ d: 12, r: 0 }), true);
  tick(h, 6000, state({ wrath: 6000 }));
  assert.equal(h.c.target(), null, 'not after the Wrath');
  assert.equal(h.c.hit({ d: 12, r: 0 }), false);
  assert.equal(h.sent.length, 1, 'nothing sent after it');
});

test('AUDIT WB B7 his death cry is heard at his fall, not minutes after it: a player who comes to the court after he fell hears neither cry nor thud', () => {
  const h = court();
  tick(h, 100_000, state({ fell: { at: 100_000 - FALL_CRY_LATE_MS - 1, top: [], n: 3 }, hp: 0 }));
  tick(h, 100_000 + THUD_AT_MS * 3);
  assert.equal(heard(h, BOSS_CUES.fall), 0, 'no cry from before I came');
  const f = court();
  tick(f, 50_000, state());
  tick(f, 50_100, state({ fell: { at: 50_000, top: [], n: 3 }, hp: 0 }));
  assert.equal(heard(f, BOSS_CUES.fall), 1, 'the cry at the fall itself');
  const edge = court();
  tick(edge, 70_000 + FALL_CRY_LATE_MS - 1, state({ fell: { at: 70_000, top: [], n: 3 }, hp: 0 }));
  assert.equal(heard(edge, BOSS_CUES.fall), 1, 'late by less than FALL_CRY_LATE_MS, still heard');
  const past = court();
  tick(past, 80_000 + FALL_CRY_LATE_MS, state({ fell: { at: 80_000, top: [], n: 3 }, hp: 0 }));
  assert.equal(heard(past, BOSS_CUES.fall), 0, 'late by FALL_CRY_LATE_MS itself, not');
  assert.equal(FALL_CRY_LATE_MS, 1500);
});

test('AUDIT WB B5 the link tells its host the relay\'s refusal of my `in`, with its word; nothing else is a refusal', () => {
  const refused = [], said = [];
  const link = createGateLink({ now: () => 0, say: (s) => said.push(s), onRefused: (m) => refused.push(m) });
  link.word({ k: 'no', m: 'the court is full' });
  assert.deepEqual(refused, ['the court is full']);
  assert.deepEqual(said, [GATE_NO_TEXT['the court is full']]);
  link.word({ k: 'hp', h: 5, m: 10 });
  link.word({ k: 'rcpt', r: 'junk' });
  assert.equal(refused.length, 1);
});

test('AUDIT WB B5 the seams: the door asked again once the fire has closed; a refused `in` and a socket closed for good take the player out before the gate', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /onRefused: \(why\) => \{ if \(modes\?\.gateArenaDay\?\.\(\) != null\) ejectFromCourt\(GATE_NO_TEXT\[why\] \?\? why\); \},/);
  assert.match(world, /else if \(courtDay != null && online\?\.terminal\) ejectFromCourt\(GATE_NO_TEXT\[online\.error\] \?\? COURT_TEXT\.lost\);/);
  const refusal = world.slice(world.indexOf('gateRefusal: (g) =>'), world.indexOf('gateRefusal: (g) =>') + 400);
  assert.match(refusal, /!online\?\.gateOk \|\| online\?\.terminal \? GATE_TEXT\.notYet/, 'no relay to hold it');
  assert.match(refusal, /Number\.isFinite\(gateLink\?\.fellAt\(g\.day\)\) \? GATE_NO_TEXT\['the gate is closing'\]/, 'its master fallen');
  assert.match(refusal, /!gateAdmits\(g\.day, Date\.now\(\) \+ _sharedOffsetMs\) \? GATE_TEXT\.sealed : null/, 'sealed while the fire burned');
  const modes = read('src/scenes/worldModes.js');
  const door = modes.slice(modes.indexOf('async function enterGateArena(g) {'), modes.indexOf('/** WB6c: THE STEP THROUGH THE FIRE'));
  assert.match(door, /const no = host\.gateRefusal\?\.\(g\) \?\? null;\n\s+if \(no\) \{ setMidScreenText\(no\); return false; \}/);
  assert.ok(door.indexOf('host.gateRefusal') > door.indexOf('return stepThroughFire(async () => {'), 'asked inside the step, after the fire has closed');
  assert.ok(door.indexOf('host.gateRefusal') < door.indexOf('gatedTransition('), 'and before the court is built');
  assert.equal(typeof COURT_TEXT.lost, 'string');
});

test('AUDIT WB B1 a player dead in the court when it is taken from them is cast out alive - the death\'s own door, the heal first', () => {
  const world = read('src/scenes/world.js');
  const eject = world.slice(world.indexOf('function ejectFromCourt(words) {'), world.indexOf('function respawnOnlinePlayer() {'));
  assert.match(eject, /if \(!\(playerEntity\.health > 0\) \|\| modes\?\.deathUp\?\.\(\)\) \{ respawnOnlinePlayer\(\); return; \}/);
  assert.ok(eject.indexOf('respawnOnlinePlayer()') < eject.indexOf('forceExitToExterior'), 'before the court is left');
  // and the death's door casts a court death out before its gate (WB3b), healed at its top (MAC-D3)
  const respawn = world.slice(world.indexOf('function respawnOnlinePlayer() {'));
  assert.ok(respawn.indexOf('reviveForPlay(playerEntity, { force: true });') < respawn.indexOf('const courtGate = modes?.gateArenaGate?.() ?? null;'));
});

test('AUDIT WB B2/B3 the dead walk through no fire: no court entered by a player killed while it closed, no way home taken by one, no exit pending walked by one', () => {
  const modes = read('src/scenes/worldModes.js');
  assert.match(modes, /const aliveUnder = \(\) => playerEntity\.health > 0 && !dungeonCtx\?\.deathUp\?\.\(\);/);
  assert.match(modes, /if \(mode !== 'exterior' \|\| !\(playerEntity\.health > 0\)\) return false;/, 'B3: the door');
  assert.match(modes, /if \(mode === 'dungeon' && isGateArena\(dungeonLoc\) && aliveUnder\(\)\) pendingDungeonExit = true;/, 'B2: the way home');
  assert.match(modes, /if \(pendingDungeonExit\) \{ pendingDungeonExit = false; if \(aliveUnder\(\)\) \{ exitDungeonNow\(\); return true; \} \}/, 'B2: the exit it defers');
});
