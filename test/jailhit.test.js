// JAIL-HIT (2026-09-27, Discord: "Retaining criminal status even after going to prison and serving sentence - Guards
// will still chase you down and kill you, even if you have already been to prison for the crime committed").
//
// The release is faithful - every court exit clears the crime and the watch walks away on it (GUARD1). What was not:
// DFU's surrender box and court are pushed windows that stop the world (UserInterfaceManager.cs:183-184) until
// ReleaseFromPrison clears the crime (DaggerfallCourtWindow.cs:482-491), and here the watch keeps WINFOE1's clock under
// any window. ARREST-SHIELD withheld its blows ONLINE only, on the belief that offline the court "already reads as a
// pause". So offline a guard swung through the trial and the prison days: on the surrender's 1 health the blow either
// killed the player inside the court or forced a SECOND surrender whose court replaced the prison screen and threw its
// release away - the crime never cleared, and the watch hunted on.
//
// Driven offline (no shared clock) through the real arrest flow, the real court, the real prison screen and the one
// damage door; the watch through the real pool.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createArrestFlow } from '../src/scenes/arrestFlow.js';
import { CRIMES } from '../src/systems/court.js';
import { PrisonScreenWindow, PRISON_UPDATE_INTERVAL } from '../src/ui/prisonScreen.js';
import { hurtPlayer, playerDamageWithheld } from '../src/characters/playerEntity.js';
import { sharedClockOn } from '../src/systems/worldTick.js';
import { createCityGuards, GUARD_MOBILE_TYPE } from '../src/scenes/cityGuards.js';

function mkTalk() {
  const slot = { win: null, onClosed: null };
  return {
    slot,
    texts: () => null,
    showOverlay(win, onClosed = null) { if (slot.win && slot.win !== win) slot.win.dispose?.(); slot.win = win; slot.onClosed = onClosed; },
    close() { const cb = slot.onClosed; slot.win = null; slot.onClosed = null; cb?.(); },
  };
}
/** A convict with no gold (every unit of the penalty is prison days) and a legal reputation low enough that a forced
 *  surrender is refused (SurrenderToCityGuards: LegalRep < -20 never surrenders) - so a blow that reaches the fatal arm
 *  LANDS, deterministically. */
const mkConvict = (over = {}) => ({
  name: 'Mack', health: 1, maxHealth: 40, fatigue: 0, maxFatigue: 100, magicka: 0, maxMagicka: 20,
  stats: { endurance: 50, strength: 50, willpower: 50, personality: 50 },
  crimeCommitted: CRIMES.Murder, legalRep: { 17: -25 }, items: [], skills: 30,
  haveShownSurrenderDialogue: true, arrested: false, activeEffects: [], ...over,
});
// the court's dice high: both of startCourt's rolls fail their thresholds (12 and 25 at -25), so the sentence is PRISON
// (punishmentType 2) and never the banishment a low roll gives - a pin, not a coin flip
const mkFlow = (townTalk, player) => createArrestFlow({
  townTalk, playerEntity: player, regionIndex: 17, rolls: () => 0.99,
  advanceDays: () => {}, advanceMinutes: () => {}, guildRankOf: () => null,
  clearEnemies: () => {}, positionPlayerAtLocationEntrance: () => {},
});

test('JAIL-HIT: offline, the watch lands nothing through the prison days - the trial is a paused window, and the release clears the crime', () => {
  assert.equal(sharedClockOn(), false, 'offline: no shared clock');
  const townTalk = mkTalk();
  const player = mkConvict();
  const flow = mkFlow(townTalk, player);
  flow.startCourtFlow();
  townTalk.slot.win.input('KeyG');   // Guilty - serve
  const prison = townTalk.slot.win;
  assert.ok(prison instanceof PrisonScreenWindow);
  let landed = 0;
  assert.equal(flow.onGuardHit(6, () => { landed++; }), true, 'a guard\'s blow on the 1-health convict is withheld');
  assert.equal(landed, 0);
  assert.equal(playerDamageWithheld(), true, 'and every other blow too - the one damage door reads the same question');
  assert.equal(hurtPlayer(player, 6), false);
  assert.equal(player.health, 1, 'the surrender\'s 1 health stands until the term ends');
  assert.equal(townTalk.slot.win, prison, 'no second trial replaced the prison screen and its release');
  flow.startCourtFlow();
  assert.equal(townTalk.slot.win, prison, 'one trial at a time');
  const days = prison.daysInPrison;
  for (let i = 0; i < days; i++) prison.tick(PRISON_UPDATE_INTERVAL);
  assert.equal(prison.done, true, 'the term served');
  townTalk.close();
  assert.equal(player.crimeCommitted, 0, 'ReleaseFromPrison: the crime is cleared');
  assert.equal(player.arrested, false);
  assert.equal(playerDamageWithheld(), false, 'and the shield is the trial\'s alone - free, the player is hurt again');
  flow.dispose();
});

test('JAIL-HIT: the surrender question is the box\'s - answered, or thrown away unanswered, it stops withholding', () => {
  const townTalk = mkTalk();
  const player = mkConvict({ health: 30, haveShownSurrenderDialogue: false, legalRep: {} });
  const flow = mkFlow(townTalk, player);
  let landed = 0;
  assert.equal(flow.onGuardHit(1, () => { landed++; }), true, 'the first blow opens the box and is withheld');
  const box = townTalk.slot.win;
  assert.equal(playerDamageWithheld(), true, 'offline too, while the box asks');
  townTalk.showOverlay({ done: false });   // another window replaces the box before it is answered
  assert.equal(playerDamageWithheld(), false, 'the box is gone and its question with it - no immortality left behind');
  // answered: "N - fight on" lands the blow that opened it, and the shield is down
  const t2 = mkTalk();
  const p2 = mkConvict({ health: 30, haveShownSurrenderDialogue: false, legalRep: {} });
  const f2 = mkFlow(t2, p2);
  f2.onGuardHit(1, () => { landed++; });
  t2.slot.win.input('KeyN');
  assert.equal(landed, 1, 'No lands the damage');
  assert.equal(playerDamageWithheld(), false);
  assert.equal(box.done, false, 'the thrown-away box was never answered');
  f2.dispose();
  flow.dispose();
});

test('JAIL-HIT: offline, the watch walks away for the trial - not only at the release', () => {
  const pe = { level: 1, reflexes: 2, crimeCommitted: CRIMES.Murder, arrested: false, activeEffects: [] };
  let freed = 0;
  const stubTex = { getFrameCount: () => 1, getSize: () => ({ width: 1, height: 1 }), getScale: () => ({ width: 0, height: 0 }) };
  const g = createCityGuards({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => { freed++; }, textures: new Map() },
    collider: { heightAt: () => 0, raycast: () => Infinity, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false },
    fetchBytes: async () => { throw new Error('SPAWNED'); },
    getTexture: async () => stubTex,
    uploadRecordFrame: () => {}, currentMinute: () => 0,
    playerEntity: pe, audio: null, onPlayerHurt: () => {}, rand: () => 0.9,
  });
  const watchman = (id) => ({
    id, dead: false, batch: {}, mobileType: GUARD_MOBILE_TYPE, _swingSeq: 0, _mout: null, archive: 399, tex: stubTex,
    entity: { health: 40, maxHealth: 40, activeEffects: [], items: [] },
    mobile: { update: () => ({ record: 0, frame: 0, flip: false }) },
    ai: { isHostile: true, feet: [1, 0, 1], yaw: 0, detected: true, inSight: true, _dist: 3, height: 1.8, moving: false, target: null, giveUpTimer: 200, update() {}, _centre: () => [1, 0.9, 1] },
    attack: { machine: { state: 'Idle' }, swingSeq: 0, update() {} },
    sounds: { tick: () => null },
    concealment: () => 0,
  });
  g.guards.push(watchman(1), watchman(2));
  g.update(0.016, [0, 0, 0], [0, 1.7, 0]);
  assert.equal(g.activeCount(), 2, 'a live crime, no trial: the watch stands');
  pe.arrested = true;   // the surrender accepted - the crime still stands until the release
  g.update(0.016, [0, 0, 0], [0, 1.7, 0]);
  assert.equal(g.activeCount(), 0, 'arrested: the watch walks away, offline as online');
  assert.equal(freed, 2);
});
