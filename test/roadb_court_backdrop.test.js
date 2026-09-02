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
  CourtScreenWindow, PrisonScreenWindow, COURT_IMG, PRISON_IMG,
  PRISON_UPDATE_INTERVAL, PRISON_UPDATE_INTERVAL_FAST,
  courtScreenArtLoaded, _setCourtScreenArtForTests, preloadCourtScreenArt,
} from '../src/ui/prisonScreen.js';
import { PALETTIZED_FILENAMES } from '../src/formats/imgFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';
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

/** A FNT the port's reader accepts: header + the 240-entry glyph table
 *  + 240 empty 32-byte glyphs. townTalk only draws windows once it has
 *  a font (townTalk.js's `if (overlay && font)`), so the draw pin below
 *  needs one and this container has no ARENA2. */
function synthFnt() {
  const bytes = new Uint8Array(4 + 240 * 4 + 240 * 32);
  const v = new DataView(bytes.buffer);
  v.setUint16(0, 5, true); v.setUint16(2, 7, true);
  for (let i = 0; i < 240; i++) {
    v.setUint16(4 + i * 4, 4 + 240 * 4 + i * 32, true);
    v.setUint16(4 + i * 4 + 2, 4, true);
  }
  return bytes;
}

/** The same host, with a font loaded and a recording renderer, so
 *  `frame()` is the REAL draw path rather than a stand-in. */
const drawHost = () => createTownTalk({
  renderer: { uploadTexture: (_k, n) => `tex:${n}`, createTexture: () => ({}), drawScreenQuad: () => {} },
  canvas: { width: 640, height: 400 },
  fetchBytes: async (n) => {
    if (n === 'FONT0003.FNT') return synthFnt();
    throw new Error('this pin loads no ARENA2');
  },
  playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] },
  regionIndex: 0,
});

function mkFlow(over = {}, townTalk = talkHost()) {
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

test('close-P: the courtroom is DRAWN under every box - previousWindow.Draw() runs first', async () => {
  // MEMBERSHIP IS NOT PAINT, and the two tests above only ever asserted
  // membership. DaggerfallUI paints ONE window a frame
  // (`uiManager.TopWindow.Draw()`, DaggerfallUI.cs:491); depth reaches
  // the screen through DaggerfallPopupWindow.Draw (:77-86), which runs
  // `previousWindow.Draw()` BEFORE `base.Draw()`, and every court box
  // is built with the court window as its previousWindow
  // (DaggerfallCourtWindow.cs:221-229, :233-240, :263-270). The port's
  // slot painted its top alone, so CORT01I0 stood under the whole trial
  // and was never once rendered - the FLAG the header claims is retired.
  const townTalk = drawHost();
  await townTalk.ensureLoaded();
  assert.ok(townTalk.font, 'the host has a font, so frame() really draws');
  const { flow } = mkFlow({}, townTalk);

  const painted = [];
  const courtDraw = CourtScreenWindow.prototype.draw;
  CourtScreenWindow.prototype.draw = function drawSpy(...a) { painted.push('courtroom'); return courtDraw.apply(this, a); };
  try {
    flow.startCourtFlow();
    const plead = townTalk.overlay;
    assert.ok(plead && !(plead instanceof CourtScreenWindow), 'a plea box is what the player is looking at');
    const boxDraw = plead.draw.bind(plead);
    plead.draw = (...a) => { painted.push('box'); return boxDraw(...a); };

    townTalk.frame(0.016);
    assert.deepEqual(painted, ['courtroom', 'box'],
      'the courtroom is painted on the same frame as the box, and UNDER it (previousWindow first)');

    // ...and on through the trial: the next box replaces this one at the
    // court's own level and the backdrop keeps painting beneath it.
    painted.length = 0;
    townTalk.keydown({ code: 'KeyN', key: 'n', preventDefault() {} });   // Not guilty -> how-convince
    const box1 = townTalk.overlay;
    const box1Draw = box1.draw.bind(box1);
    box1.draw = (...a) => { painted.push('box'); return box1Draw(...a); };
    townTalk.frame(0.016);
    assert.deepEqual(painted, ['courtroom', 'box'], 'every box of the trial, not just the first');
  } finally {
    CourtScreenWindow.prototype.draw = courtDraw;
  }
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

test('B5/close-P: CORT01I0 takes the HOST palette - it is not one of the palettized six', async () => {
  // THE PIN THAT STOOD HERE ASSERTED THE OPPOSITE, on a false premise
  // it stated out loud: "CORT01I0 is the same kind of file (imgFile.js's
  // six palettized IMGs)". It is not. ImgFile.ReadPalette's switch
  // (ImgFile.cs:477-489) names CHGN00I0, DIE_00I0, PICK02I0, PICK03I0,
  // PRIS00I0 and TITL00I0, and nothing else; for CORT01I0
  // `_readPalette` early-returns, so a minted DFPalette is never
  // written and stays at the constructor's all-red fill - the courtroom
  // drew as a solid red panel under the whole trial. DFU decodes it on
  // `imgFile.PaletteName`, ART_PAL.COL (DaggerfallUI.cs:1225-1231),
  // which is the shared session palette the host hands the preload.
  assert.equal(COURT_IMG, 'CORT01I0.IMG');
  assert.equal(PALETTIZED_FILENAMES.includes(PRISON_IMG), true, 'PRIS00I0 IS palettized');
  assert.equal(PALETTIZED_FILENAMES.includes(COURT_IMG), false, 'CORT01I0 is NOT');

  // Behavioural, through the real preload: a synthetic CORT01I0 whose
  // pixels are index 1, decoded against a session palette marked
  // (7,11,13) at that index. The colour that lands in the uploaded
  // texture names the palette the loader was actually given.
  _setCourtScreenArtForTests(null);
  const bytes = new Uint8Array(64768);   // headerless 320x200 + 768 trailing bytes
  bytes.fill(1, 0, 64000);
  const palette = new DFPalette();
  palette.fill(7, 11, 13);
  let painted = null;
  await preloadCourtScreenArt({
    renderer: { uploadTexture: (_kind, _name, color32) => { painted = color32; return {}; }, createTexture: () => ({}) },
    fetchBytes: async () => bytes,
    palette,
  });
  assert.deepEqual(Array.from(new Uint8Array(painted.colors.buffer, 0, 4)), [7, 11, 13, 255],
    'the courtroom paints on the session ART_PAL - a minted DFPalette would leave it (255,0,0), a solid red panel');

  // ...and it warms at boot beside the prison screen, on that palette.
  assert.match(src('src/scenes/world.js'), /preloadCourtScreenArt\(\{ renderer, fetchBytes, palette \}\)/);
  // The mint-your-own law is still ON, one function down, where it belongs.
  assert.match(src('src/ui/prisonScreen.js'),
    /loadImg\(\{ \.\.\.deps, palette: new DFPalette\(\) \}, PRISON_IMG\)/);
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
