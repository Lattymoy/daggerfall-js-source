// DISC28-B (2026-09-28, Discord: "the game locks up if guards hit you the moment you fast travel").
//
// Online the world runs under every window (WORLD5), so a guard's blow can raise the surrender box as the travel map
// commits the journey - and the arrival clears the crime (PostFastTravel, world.js) with the box still standing. The
// box then asked about a crime that no longer existed, held the damage veto the whole time, and Y marched the player
// into startCourtFlow, which set `arrested`, opened the modal courtroom and only THEN asked startCourt - whose null (no
// crime: DaggerfallCourtWindow.cs:109-114 closes the court) the plead box dereferenced. The throw left a courtroom
// with no box over it and `arrested` standing: every damage veto on, nothing that could close it. The lockup.
//
// Driven through the real arrest flow, the real court and the one damage door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createArrestFlow } from '../../src/scenes/arrestFlow.js';
import { CRIMES, setCrimeCommitted } from '../../src/systems/court.js';
import { playerDamageWithheld } from '../../src/characters/playerEntity.js';
import { ChoiceWindow } from '../../src/ui/talkWindow.js';

function mkTalk() {
  const slot = { win: null, onClosed: null };
  return {
    slot,
    texts: () => null,
    showOverlay(win, onClosed = null) { if (slot.win && slot.win !== win) slot.win.dispose?.(); slot.win = win; slot.onClosed = onClosed; },
    pushOverlay(win, onClosed = null) { this.showOverlay(win, onClosed); },
    get overlay() { return slot.win; },
    /** townTalk's frame: a `done` overlay is drained (closed, disposed). */
    drain() { if (slot.win?.done) { const w = slot.win; const cb = slot.onClosed; slot.win = null; slot.onClosed = null; w.dispose?.(); cb?.(); } },
  };
}
// legal rep above 0: a voluntary surrender is always accepted (SurrenderToCityGuards)
const mkPlayer = (over = {}) => ({
  name: 'Mack', health: 30, maxHealth: 40, fatigue: 50, maxFatigue: 100, magicka: 0, maxMagicka: 20,
  stats: { endurance: 50, strength: 50, willpower: 50, personality: 50 },
  crimeCommitted: CRIMES.Assault, legalRep: { 17: 5 }, items: [], skills: 30,
  haveShownSurrenderDialogue: false, arrested: false, activeEffects: [], ...over,
});
const mkFlow = (townTalk, player) => createArrestFlow({
  townTalk, playerEntity: player, regionIndex: 17, rolls: () => 0.99,
  advanceDays: () => {}, advanceMinutes: () => {}, guildRankOf: () => null,
  clearEnemies: () => {}, positionPlayerAtLocationEntrance: () => {},
});

test('DISC28-B: the arrival clears the crime - the standing surrender question is withdrawn and the veto drops', () => {
  const townTalk = mkTalk();
  const player = mkPlayer();
  const flow = mkFlow(townTalk, player);
  let landed = 0;
  assert.equal(flow.onGuardHit(6, () => { landed++; }), true, 'the blow raises the question');
  const box = townTalk.slot.win;
  assert.ok(box instanceof ChoiceWindow);
  assert.equal(playerDamageWithheld(), true, 'while it stands, the question withholds');
  setCrimeCommitted(player, CRIMES.None);   // PostFastTravel, world.js
  flow.crimeCleared();
  assert.equal(box.done, true, 'the box closes the way an answer closes it');
  assert.equal(flow.inCourt(), false);
  assert.equal(playerDamageWithheld(), false, 'a question nobody can usefully answer no longer keeps the player unhittable');
  townTalk.drain();
  assert.equal(townTalk.slot.win, null);
  assert.equal(landed, 0, 'the departed guard\'s blow is not delivered in the arrival town');
  flow.dispose();
});

test('DISC28-B: crimeCleared leaves a live question alone, and is a no-op with no question up', () => {
  const townTalk = mkTalk();
  const player = mkPlayer();
  const flow = mkFlow(townTalk, player);
  flow.crimeCleared();   // nothing up: nothing to do
  flow.onGuardHit(6, () => {});
  const box = townTalk.slot.win;
  flow.crimeCleared();   // the crime still stands - the question is still the crime's
  assert.equal(box.done, false);
  assert.equal(flow.inCourt(), true);
  flow.dispose();
});

test('DISC28-B: Y read after the crime went is a surrender to nothing - no court, no arrest, no modal left up', () => {
  const townTalk = mkTalk();
  const player = mkPlayer();
  const flow = mkFlow(townTalk, player);
  flow.onGuardHit(6, () => {});
  const box = townTalk.slot.win;
  setCrimeCommitted(player, CRIMES.None);   // a clearer that did not withdraw the box
  assert.doesNotThrow(() => box.input('KeyY'));
  assert.equal(player.arrested, false, 'no court was armed');
  assert.equal(flow.inCourt(), false);
  assert.equal(player.health, 30, 'no surrender - its 1 health was never forced');
  townTalk.drain();
  assert.equal(townTalk.slot.win, null, 'no courtroom stands with nothing over it');
  flow.dispose();
});

test('DISC28-B: startCourtFlow over no crime is DFU\'s court that closes itself - nothing armed, nothing thrown', () => {
  const townTalk = mkTalk();
  const player = mkPlayer({ crimeCommitted: 0 });
  let screens = 0;
  const flow = createArrestFlow({
    townTalk, playerEntity: player, regionIndex: 17, rolls: () => 0.99,
    advanceDays: () => {}, advanceMinutes: () => {}, guildRankOf: () => null,
    onCourtScreen: () => { screens++; },
  });
  assert.doesNotThrow(() => flow.startCourtFlow());
  assert.equal(player.arrested, false);
  assert.equal(flow.inCourt(), false);
  assert.equal(screens, 0, 'no courtroom raised');
  assert.equal(townTalk.slot.win, null);
  // and a later, real crime still gets its trial - nothing was left latched
  player.crimeCommitted = CRIMES.Assault;
  flow.startCourtFlow();
  assert.equal(player.arrested, true);
  assert.equal(screens, 1);
  assert.ok(townTalk.slot.win instanceof ChoiceWindow, 'the plead box stands over the courtroom');
  flow.dispose();
});

test('DISC28-B: a new crime after the withdrawn question raises a fresh surrender box', () => {
  const townTalk = mkTalk();
  const player = mkPlayer();
  const flow = mkFlow(townTalk, player);
  flow.onGuardHit(6, () => {});
  setCrimeCommitted(player, CRIMES.None);
  flow.crimeCleared();
  townTalk.drain();
  // CheckForHiddenGuards-style reset of the shown flag once the watch is gone (PlayerEntity.cs:534-536)
  player.haveShownSurrenderDialogue = false;
  setCrimeCommitted(player, CRIMES.Assault);
  assert.equal(flow.onGuardHit(6, () => {}), true);
  const box = townTalk.slot.win;
  assert.ok(box instanceof ChoiceWindow);
  box.input('KeyY');
  assert.equal(player.arrested, true, 'this one is a real surrender to a real crime');
  flow.dispose();
});

test('DISC28-B: the host withdraws the question where the arrival clears the crime', () => {
  const src = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(src, /setCrimeCommitted\(playerEntity, CRIMES\.None\);\s*\n\s*arrestFlow\.crimeCleared\(\);/);
});
