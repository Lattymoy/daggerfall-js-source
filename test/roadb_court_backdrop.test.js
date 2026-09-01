// ROAD TO 1:1, WAVE B / B5 - THE THREE WAVE-A STAGES THAT WAITED ON
// THE WINDOW STACK.
//
//   1. THE COURTROOM BACKDROP. DaggerfallCourtWindow opens on
//      CORT01I0.IMG (Setup :75-84) and PUSHES every box of the trial
//      over itself. ui/prisonScreen.js's FLAG said so and said why the
//      port could not: "townTalk's overlay slot holds exactly one
//      occupant". B1 gave it more than one.
//   2. THE PRISON COUNTDOWN'S HELD-BACK ACCELERATOR (:301-304), whose
//      read is InputManager.GetBackButton() - the RAW held Escape
//      (InputManager.cs:1075-1078), which no window intercepts.
//   3. ...and the defect found under both: a successor window opened
//      from inside a close callback lost its OWN close callback, which
//      on this very path is ReleaseFromPrison.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createTownTalk } from '../src/scenes/townTalk.js';
import { createArrestFlow, RELEASE_MINUTES } from '../src/scenes/arrestFlow.js';
import {
  CourtScreenWindow, PrisonScreenWindow, COURT_IMG,
  PRISON_UPDATE_INTERVAL, PRISON_UPDATE_INTERVAL_FAST,
  courtScreenArtLoaded, _setCourtScreenArtForTests,
} from '../src/ui/prisonScreen.js';
import { CRIMES } from '../src/systems/court.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const talkHost = () => createTownTalk({
  renderer: { uploadTexture: () => ({}) }, canvas: { width: 640, height: 400 },
  fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
  playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] },
  regionIndex: 0,
});

/** A defendant with no gold, so the penalty is served rather than paid. */
const convict = () => ({
  name: 'Mack', health: 1, maxHealth: 40, fatigue: 0, maxFatigue: 100,
  magicka: 0, maxMagicka: 20, endurance: 50, strength: 50, willpower: 50,
  stats: { endurance: 50, strength: 50, willpower: 50, personality: 50 },
  crimeCommitted: CRIMES.Murder, legalRep: { 17: 0 }, items: [], skills: 30,
  haveShownSurrenderDialogue: true, arrested: false,
});

function mkFlow(over = {}) {
  const townTalk = talkHost();
  const player = convict();
  const log = { days: [], minutes: [], cleared: 0, repositioned: 0 };
  const flow = createArrestFlow({
    townTalk, playerEntity: player, regionIndex: 17,
    advanceDays: (d) => log.days.push(d),
    advanceMinutes: (m) => log.minutes.push(m),
    guildRankOf: () => null,
    clearEnemies: () => { log.cleared++; },
    positionPlayerAtLocationEntrance: () => { log.repositioned++; },
    ...over,
  });
  return { townTalk, player, log, flow };
}

// ---------------------------------------------------------------------
// 1. THE BACKDROP
// ---------------------------------------------------------------------

test('B5: the trial stands ON the courtroom - the plea box is PUSHED, not a replacement', () => {
  const { townTalk, flow } = mkFlow();
  flow.startCourtFlow();
  // Setup opens the courtroom (:75-84) and the plea box is pushed OVER
  // it, so the SLOT holds the box - B1 made the slot the mirror of the
  // stack TOP, and the backdrop is the entry beneath.
  const plead = townTalk.overlay;
  assert.ok(plead?.isChoiceWindow && !(plead instanceof CourtScreenWindow),
    'the plea box is what the player is looking at');
  townTalk.closeOverlay();
  assert.ok(townTalk.overlay instanceof CourtScreenWindow,
    'and popping it UNCOVERS the courtroom - it was never replaced (the whole item)');
  // AllowCancel = false (:97): the courtroom itself answers no key.
  const court = townTalk.overlay;
  court.input('back');
  court.input('confirm');
  assert.equal(court.done, false, 'nothing the player presses walks out of a trial');
});

test('B5: every box of the trial keeps the courtroom underneath it', () => {
  const { townTalk, flow, player } = mkFlow();
  flow.startCourtFlow();
  const plead = townTalk.overlay;

  townTalk.keydown({ code: 'KeyN', key: 'n', preventDefault() {} });   // Not guilty -> how-convince
  const box1 = townTalk.overlay;
  assert.notEqual(box1, plead, 'the next box REPLACED the last (DFU CloseWindow-then-Push)');
  assert.ok(box1?.isChoiceWindow);

  townTalk.keydown({ code: 'KeyD', key: 'd', preventDefault() {} });   // Debate
  const box2 = townTalk.overlay;
  assert.notEqual(box2, box1);
  assert.ok(!(box2 instanceof CourtScreenWindow), 'still a box, not the backdrop');

  // Close verdict boxes until the courtroom is uncovered. However the
  // roll landed, the backdrop is one level down the whole time - never
  // two, never gone.
  let guard = 0;
  while (townTalk.overlay && !(townTalk.overlay instanceof CourtScreenWindow) && guard++ < 6) {
    townTalk.closeOverlay();
  }
  const court = townTalk.overlay;
  assert.ok(court instanceof CourtScreenWindow, 'the courtroom was there the whole time');
  assert.equal(court.done, true, 'and ReleaseFromPrison closed it (:490) - the frame drains it next tick');
  assert.equal(player.arrested, false, 'OnPop cleared the flag');
});

test('B5: the prison screen is laid at the courtroom\'s own level, and both go', () => {
  const { townTalk, flow, player, log } = mkFlow();
  flow.startCourtFlow();
  townTalk.keydown({ code: 'KeyG', key: 'g', preventDefault() {} });   // Guilty -> serve
  const prison = townTalk.overlay;
  assert.ok(prison instanceof PrisonScreenWindow, 'state 3 switches the panel (:254-262)');
  assert.equal(player.inPrison, true);
  assert.deepEqual(log.days, [], 'the days do not pass at the verdict');

  // The countdown, then the release - the callback that the B1
  // regression below used to eat.
  let guard = 0;
  while (!prison.done && guard++ < 10000) prison.tick(PRISON_UPDATE_INTERVAL);
  assert.equal(prison.done, true);
  assert.equal(log.days.length, 1, 'ONE RaiseTime of the whole sentence (:475)');

  townTalk.closeOverlay();
  // ROAD review-p: ':485 - RaiseTime(240 * 60)', and NOT a guard on
  // the successor restore. The plea box's KeyG option calls finish()
  // straight out of the keydown, so `() => release()` is installed by
  // showOverlay on an ordinary press and never travels dropOverlay's
  // successor branch - reverting that guard leaves this green. The
  // test below is the one that holds it.
  assert.deepEqual(log.minutes, [RELEASE_MINUTES], ':485 - RaiseTime(240 * 60)');
  assert.equal(log.repositioned, 1, ':488');
  assert.equal(log.cleared, 1, ':489');
  assert.equal(player.crimeCommitted, 0);
  assert.ok(townTalk.overlay instanceof CourtScreenWindow,
    'and the courtroom is what the prison screen was laid over');
  assert.equal(townTalk.overlay.done, true);
});

test('B5: the successor a close callback opens keeps its OWN close callback', () => {
  // THE B1 REGRESSION, isolated. dropOverlay restored the SUSPENDED
  // callback whenever the slot was full after the pop - and a slot
  // filled by the callback's own successor looks identical from there,
  // so the successor's callback (`?? null` off an empty list) was
  // thrown away. On the court path that callback is ReleaseFromPrison.
  const host = talkHost();
  const fired = [];
  const a = { name: 'a' };
  const b = { name: 'b' };
  host.showOverlay(a, () => { host.showOverlay(b, () => fired.push('b')); });
  host.closeOverlay();
  assert.equal(host.overlay, b, 'the callback opened a successor');
  host.closeOverlay();
  assert.deepEqual(fired, ['b'], 'and it closed with its own callback intact');

  // ...and the genuine pop still restores the SUSPENDED one, which is
  // the case the line was written for.
  const host2 = talkHost();
  const seen = [];
  host2.showOverlay({ name: 'under' }, () => seen.push('under'));
  host2.pushOverlay({ name: 'over' }, () => seen.push('over'));
  host2.closeOverlay();
  assert.deepEqual(seen, ['over']);
  host2.closeOverlay();
  assert.deepEqual(seen, ['over', 'under'], 'the covered window\'s callback came back with it');

  // ROAD review-p: AND THE SUCCESSOR MAY ARRIVE THROUGH THE OTHER
  // DOOR. When the close callback PUSHES instead of replacing, the
  // push finds an empty slot, so its reconcile pops the closing window
  // first - one level out, one level in, nothing newly suspended. The
  // guard above returns early either way, so a push that also filed a
  // suspended entry left the list deeper than the stack and the next
  // close popped that stray entry instead of the callback of the
  // window actually underneath.
  const host3 = talkHost();
  const heard = [];
  host3.showOverlay({ name: 'under' }, () => heard.push('under'));
  host3.pushOverlay({ name: 'over' }, () => {
    heard.push('over');
    host3.pushOverlay({ name: 'successor' }, () => heard.push('successor'));
  });
  host3.closeOverlay();
  assert.equal(host3.overlay?.name, 'successor', 'the callback pushed a successor');
  host3.closeOverlay();
  assert.deepEqual(heard, ['over', 'successor'], 'the successor kept its own callback');
  assert.equal(host3.overlay?.name, 'under', 'and the window underneath came back');
  host3.closeOverlay();
  assert.deepEqual(heard, ['over', 'successor', 'under'],
    'with ITS callback - not a null filed by a push that covered nobody');
});

test('B5: CORT01I0 mints its OWN palette - the 2026-09-01 incident, one file over', async () => {
  // PRIS00I0 broke the whole session's textures this way; CORT01I0 is
  // the same kind of file (imgFile.js's six palettized IMGs) loaded by
  // the same module, so it takes the same law.
  const ps = src('src/ui/prisonScreen.js');
  assert.match(ps, /loadImg\(\{ \.\.\.deps, palette: new DFPalette\(\) \}, COURT_IMG\)/,
    'the court preload builds its own DFPalette');
  assert.equal(COURT_IMG, 'CORT01I0.IMG');
  // ...and it warms at boot beside the prison screen.
  assert.match(src('src/scenes/world.js'), /preloadCourtScreenArt\(\{ renderer, fetchBytes, palette \}\)/);
  // No `deps.palette` reaches either loader in this file.
  assert.equal(/loadImg\(deps,/.test(ps), false);
  _setCourtScreenArtForTests(null);
  assert.equal(courtScreenArtLoaded(), false);
});

test('B5: the backdrop FLAG is retired, not reworded', () => {
  const ps = src('src/ui/prisonScreen.js');
  // The header quotes the old flag - that is the house record of what
  // moved - but it must not still STAND as one.
  assert.equal(/^\/\/ FLAGGED/m.test(ps), false, 'no FLAGGED marker survives in this file');
  assert.match(ps, /ROAD-B B5 RETIRED THE BACKDROP FLAG/);
  assert.match(src('src/scenes/arrestFlow.js'), /function courtBox\(win, onClosed = null\) \{/,
    'and every trial box goes through the one door');
});

// ---------------------------------------------------------------------
// 2. THE HELD-BACK ACCELERATOR (:301-304)
// ---------------------------------------------------------------------

test('B5: holding Back runs the prison countdown at 0.001s a day, and letting go restores 0.3', () => {
  let held = false;
  const w = new PrisonScreenWindow({ daysInPrison: 4, speedUp: () => held });
  // Classic speed: a tick shorter than the interval buys nothing.
  w.tick(PRISON_UPDATE_INTERVAL_FAST * 2);
  assert.equal(w.daysInPrisonLeft, 4, 'not held - 0.3s a day (:303)');

  held = true;
  w.tick(PRISON_UPDATE_INTERVAL_FAST * 2);
  assert.equal(w.daysInPrisonLeft, 3, 'held - 0.001s a day (:302)');

  // It is polled EVERY frame, not latched: releasing the key puts the
  // interval straight back.
  held = false;
  w.tick(PRISON_UPDATE_INTERVAL_FAST * 2);
  assert.equal(w.daysInPrisonLeft, 3, 'and the slow interval is back the frame the key comes up');
});

test('B5: both outdoor hosts keep the RAW back-button latch the accelerator reads', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(f);
    // Above the townTalk return, or the ladder never reaches it with a
    // window up - which is every frame of a prison sentence.
    assert.match(s, /if \(e\.code === 'Escape'\) backButtonHeld = true;\n\s*if \(townTalk\.keydown\(e\)\) return;/,
      `${f}: the latch is raised BEFORE the overlay swallows the key`);
    assert.match(s, /if \(e\.code === 'Escape'\) backButtonHeld = false;/, `${f}: and lowered on the release`);
    assert.match(s, /backButtonHeld: \(\) => backButtonHeld,/, `${f}: and handed to the court flow`);
  }
  // It is NOT the rebindable `keys` set: GetBackButton reads
  // KeyCode.Escape raw (InputManager.cs:1075-1078).
  assert.equal(/held\(keys, 'Escape'\)/.test(src('src/scenes/world.js')), false);
});

test('B5: the accelerator reaches the window through the flow', () => {
  let held = true;
  const { townTalk, flow } = mkFlow({ backButtonHeld: () => held });
  flow.startCourtFlow();
  townTalk.keydown({ code: 'KeyG', key: 'g', preventDefault() {} });
  const prison = townTalk.overlay;
  assert.ok(prison instanceof PrisonScreenWindow);
  assert.equal(prison.speedUp(), true, 'the host\'s raw Escape latch is the window\'s speedUp');
  held = false;
  assert.equal(prison.speedUp(), false);
});
