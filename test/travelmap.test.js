// U41 (was F-slice): the TRAVEL POPUP and the world-host arrival
// wiring. The laws are travel.test.js's; the window's own geometry
// and flow are travelmapwindow.test.js's. These pin the popup's
// choice collection (DaggerfallTravelPopUp's toggles, its assign-on-
// click / toggle-on-key split), the gold and disease gates, the day
// countdown, and the host's performFastTravel order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TravelPopUpWindow, POPUP_RECTS, TOGGLE_POS, TOGGLE_SIZE, TRAVEL_TOGGLE_COLOR, LABEL_POS, COUNTDOWN_TICK } from '../src/ui/travelPopUp.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { FNT_ASCII_START } from '../src/formats/fntFile.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const mk = (over = {}) => {
  const traveled = [];
  const w = new TravelPopUpWindow({ x: 10, y: 0 }, {
    getPlayerPixel: () => ({ x: 0, y: 0 }),
    getClimateIndex: () => CLIMATES.Woodlands,
    gold: () => 1000,
    diseaseCount: () => 0,
    onTravel: (endPos, opts, computed) => traveled.push({ endPos, opts, computed }),
    ...over,
  });
  return { w, traveled };
};
const clickRect = (w, key) => {
  const [x, y, rw, rh] = POPUP_RECTS[key];
  return w.click(x + rw / 2, y + rh / 2);
};

test('U41 popup: the layout is DFU\'s and the defaults are cautious / SHIP / inns', () => {
  assert.deepEqual(POPUP_RECTS.native, [49, 28, 223, 97]);
  assert.deepEqual(POPUP_RECTS.begin, [222, 98, 48, 10]);
  assert.deepEqual(POPUP_RECTS.exit, [222, 112, 48, 10]);
  assert.deepEqual(POPUP_RECTS.cautious, [50, 51, 108, 9]);
  assert.deepEqual(POPUP_RECTS.reckless, [50, 61, 108, 9]);
  assert.deepEqual(POPUP_RECTS.footHorse, [163, 51, 108, 9]);
  assert.deepEqual(POPUP_RECTS.ship, [163, 61, 108, 9]);
  assert.deepEqual(POPUP_RECTS.inns, [50, 83, 108, 9]);
  assert.deepEqual(POPUP_RECTS.campout, [163, 83, 108, 9]);
  assert.deepEqual(TOGGLE_POS.cautious, [52.25, 53]);
  assert.deepEqual(TOGGLE_POS.reckless, [52.25, 63.25]);
  assert.deepEqual(TOGGLE_POS.inn, [52.25, 85.5]);
  assert.deepEqual(TOGGLE_POS.campout, [165, 85.5]);
  assert.deepEqual(TOGGLE_POS.foot, [165, 53]);
  assert.deepEqual(TOGGLE_POS.ship, [165, 63.25]);
  assert.equal(TOGGLE_SIZE, 4.75);
  assert.deepEqual(TRAVEL_TOGGLE_COLOR.map((c) => Math.round(c * 255)), [85, 117, 48, 255]);
  assert.deepEqual(LABEL_POS.gold, [148, 97]);
  assert.deepEqual(LABEL_POS.cost, [117, 107]);
  assert.deepEqual(LABEL_POS.time, [129, 117]);
  assert.equal(COUNTDOWN_TICK, 0.05);
  const { w } = mk();
  assert.equal(w.speedCautious, true);
  assert.equal(w.travelShip, true, 'DFU\'s field is TRUE - the F-slice window had it false');
  assert.equal(w.sleepModeInn, true);
});

test('U41 popup: a click ASSIGNS its own option, a hotkey TOGGLES the pair', () => {
  const { w } = mk();
  assert.equal(w.trip.minutes, 1040, '10 woodlands pixels, cautious + inn');
  clickRect(w, 'campout');
  assert.equal(w.sleepModeInn, false);
  assert.equal(w.trip.minutes, 1210, 'camping is slower');
  clickRect(w, 'campout');
  assert.equal(w.sleepModeInn, false, 'a click on the LIVE option is not a toggle');
  w.input('KeyN');
  assert.equal(w.sleepModeInn, true, 'the hotkey flips it');
  clickRect(w, 'reckless');
  assert.equal(w.speedCautious, false);
  assert.equal(w.trip.minutes, 520, 'reckless is exactly the halving');
  clickRect(w, 'reckless');
  assert.equal(w.speedCautious, false, 'the second click on the live option is still not a toggle');
  w.input('KeyS');
  assert.equal(w.speedCautious, true);
  clickRect(w, 'footHorse');
  assert.equal(w.travelShip, false);
  w.input('KeyT');
  assert.equal(w.travelShip, true);
  assert.equal(w.trip.totalCost, 5, 'one inn stay over dry land');
});

test('U41 popup: a wheel notch over a pair toggles it, in either direction', () => {
  const { w } = mk();
  const centre = (key) => {
    const [x, y, rw, rh] = POPUP_RECTS[key];
    return [x + rw / 2, y + rh / 2];
  };
  w.wheel(1);
  assert.equal(w.speedCautious, true, 'the wheel outside every button does nothing');
  w.hover(...centre('reckless'));
  w.wheel(1);
  assert.equal(w.speedCautious, false, 'scrolling over EITHER member flips the pair');
  w.wheel(-1);
  assert.equal(w.speedCautious, true, 'both directions toggle');
  w.hover(...centre('ship'));
  w.wheel(1);
  assert.equal(w.travelShip, false);
  w.hover(...centre('inns'));
  w.wheel(1);
  assert.equal(w.sleepModeInn, false);
  assert.equal(w.trip.minutes, 1210, 'and the numbers follow');
});

test('U41 popup: the ship costs, the gold gate refuses without closing', () => {
  const { w, traveled } = mk({ getClimateIndex: () => CLIMATES.Ocean, gold: () => 3 });
  assert.equal(w.trip.oceanPixels, 10);
  assert.equal(w.trip.totalCost, 30, '25 ship rental + 5 inn');
  w.input('KeyB');
  assert.equal(w.top, 'gold', 'TEXT.RSC 454 refuses');
  assert.equal(w.doFastTravel, false);
  assert.equal(traveled.length, 0);
  assert.equal(w.done, false, 'and the popup stays');
  w.input('Enter');   // click-anywhere-to-close
  assert.equal(w.top, null);
});

test('U41 popup: the gold test is TWO-SIDED - letters pay the passage, only coins pay the inn', () => {
  // GetGoldAmount is coins + letters of credit; the inn nights are
  // tested against the COINS alone ("Taverns only accept gold pieces")
  const { w, traveled } = mk({
    getClimateIndex: () => CLIMATES.Ocean,
    gold: () => 3 + 5000,       // three coins and a 5000g letter
    goldPieces: () => 3,
  });
  assert.equal(w.trip.totalCost, 30, '25 ship rental + 5 inn');
  assert.equal(w.trip.piecesCost, 5);
  w.input('KeyB');
  assert.equal(w.top, 'gold', 'the letter cannot pay for the bed');
  w.input('Enter');
  w.input('KeyN');              // camp out: no inn nights at all
  assert.equal(w.trip.piecesCost, 0);
  assert.equal(w.trip.totalCost, 25);
  w.input('KeyB');
  assert.equal(w.doFastTravel, true, 'and the letter pays the passage');
  assert.equal(traveled.length, 0);
});

test('U41 popup: a POISONED player is warned too, and the transport flags reach the calculator', () => {
  const poisoned = mk({ diseaseCount: () => 0, poisonCount: () => 1 });
  poisoned.w.input('KeyB');
  assert.equal(poisoned.w.top, 'diseased', 'DiseaseCount > 0 OR PoisonCount > 0');
  // Items.Contains(Transportation, Horse) is read ONCE at push
  const onFoot = mk().w;
  const mounted = mk({ hasHorse: () => true }).w;
  assert.equal(onFoot.trip.minutes, 1040);
  assert.equal(mounted.trip.minutes, 520, 'a horse is the 128/256 transport modifier');
  const carted = mk({ hasCart: true }).w;
  assert.equal(carted.trip.minutes, 770, 'a cart is 192/256, and a plain boolean dep still works');
});

test('U41 popup: a disease warns first, and Yes runs the gold check behind it', () => {
  const { w, traveled } = mk({ diseaseCount: () => 1 });
  w.input('KeyB');
  assert.equal(w.top, 'diseased');
  assert.equal(w.doFastTravel, false);
  w.input('KeyN');
  assert.equal(w.top, null, 'No returns to the popup, nothing booked');
  assert.equal(w.doFastTravel, false);
  w.input('KeyB');
  w.input('KeyY');
  assert.equal(w.top, null);
  assert.equal(w.doFastTravel, true, 'Yes falls through to the gold check');
  assert.equal(traveled.length, 0, 'and still nothing has moved');
});

test('U41 popup: the label shows the COINS, not the coins plus the paper', () => {
  // availableGoldLabel is PlayerEntity.GoldPieces (:280) - a player
  // holding a 5000g letter still reads their three coins there
  const { w } = mk({ gold: () => 5003, goldPieces: () => 3 });
  const painted = [];
  const font = {
    tex: null,
    fnt: {
      fixedHeight: 6, fixedWidth: 4,
      glyphWidth: (gi) => { painted.push(String.fromCharCode(gi + FNT_ASCII_START)); return 4; },
    },
  };
  const quads = [];
  const renderer = { drawScreenQuad: (tex, rect) => quads.push(rect), uploadTexture: () => 't', releaseTexture: () => {} };
  w.draw(renderer, { width: 1280, height: 800 }, font);
  // shadowText measures once and paints twice, so every label's
  // glyphs arrive three times: gold, then trip cost, then days
  const text = painted.join('');
  assert.ok(text.startsWith('333555111'), `coins 3, cost 5, one day (${text.slice(0, 20)})`);
  assert.ok(!text.includes('5003'), 'GetGoldAmount never reaches the label');
});

test('U41 popup: the day countdown empties before the trip runs', () => {
  const { w, traveled } = mk();
  w.input('KeyB');
  const days = w.countdownValueTravelTimeDays;
  assert.equal(days, 1, '1040 minutes rounds up to one day');
  w.tick(0.06);
  assert.equal(w.countdownValueTravelTimeDays, 0);
  assert.equal(traveled.length, 0, 'the trip waits for the counter to empty');
  w.tick(0.06);
  assert.equal(traveled.length, 1);
  assert.deepEqual(traveled[0].endPos, { x: 10, y: 0 });
  assert.deepEqual(traveled[0].opts, { speedCautious: true, sleepModeInn: true, travelShip: true });
  assert.equal(traveled[0].computed.minutes, 1040);
  assert.equal(traveled[0].computed.totalCost, 5);
  assert.equal(w.done, true);
});

test('U41 popup: EXIT closes without travelling, and Escape is the same door', () => {
  const { w, traveled } = mk();
  let exits = 0;
  w.deps.onExit = () => { exits++; };
  clickRect(w, 'exit');
  assert.equal(w.done, true);
  assert.equal(exits, 1);
  assert.equal(traveled.length, 0);
  const b = mk().w;
  b.deps.onExit = () => { exits++; };
  b.input('Escape');
  assert.equal(b.done, true);
  assert.equal(exits, 2);
});

test('U41: the world host mounts the art window and keeps performFastTravel\'s order', () => {
  const src = readFileSync(join(root, 'src/scenes/world.js'), 'utf8');
  // U43 lifted the overlay/mode gate to cover the whole ladder at once
  // - the same ladder the large HUD's map panel reaches through
  // hudCtx, whose RIGHT click is the travel map - so the pin follows
  // the law: the gate, then the arm inside it, then the panel that
  // shares the door.
  const gate = src.indexOf("if (!townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior') {");
  const arm = src.indexOf("if (act === 'TravelMap') { hudCtx.openTravelMap(); return; }");
  assert.ok(gate > 0 && arm > gate,
    'the TravelMap action opens the map (I2; V is its registry default, InputManager:1028)');
  assert.match(src, /openTravelMap: \(\) => toggleTravelMap\(\)/, 'and the large HUD reaches the same door');
  const i = src.indexOf('async function fastTravelTo');
  assert.ok(i > 0);
  const fn = src.slice(i, src.indexOf('const toggleTravelMap', i));
  // P-slice: the teardown/build core extracted to _teleportToPixel
  // (the quickload shares it); the travel order pins the CALL, the
  // core's own content pins below.
  const order = ['deductGold(playerEntity', 'await _teleportToPixel(pick.pixel.x',
    'opts.speedCautious', 'maxFatigue(playerEntity)', 'SPECIAL_ABILITY.NoRegenSpellPoints)',
    'playerTicker.advance(computed.minutes)', 'arrivalClampMinutes(playerTicker.classicMinutes'];
  let at = -1;
  for (const needle of order) {
    const j = fn.indexOf(needle);
    assert.ok(j > at, `performFastTravel order: ${needle}`);
    at = j;
  }
  // U41: the map reads ContentReader's dictionary, and the door is
  // gated on the classic art rather than opening a blank window.
  assert.ok(src.includes('buildMapDict(maps)'), 'the map dict feeds the window');
  assert.ok(src.includes('preloadTravelMapArt({ renderer, fetchBytes, palette })'), 'the art warms at boot');
  // U61: the raw art gate became the DOOR's predicate - same law on
  // the classic skin, and the construction goes through the one door.
  assert.ok(src.includes('if (!travelMapDoorReady())'), 'no door, no window');
  assert.ok(src.includes('createTravelMapWindow({\n      maps, mapDict, woods,'), 'the door gets the maps, the dict and the relief');
  assert.ok(!src.includes('new TravelMapWindow('), 'no host constructs the window past the door');
  assert.ok(!src.includes('buildTravelIndex'), 'the keyed typeahead\'s directory is retired');
  // DeductFastTravelGold (:469-473): coins for the inn, letters for
  // the rest - and the popup is handed both pools plus the transport
  assert.ok(fn.includes('deductGoldPieces(playerEntity, computed.piecesCost'), 'the inn nights come out of coin');
  assert.ok(fn.includes('deductGold(playerEntity, computed.totalCost - (computed.piecesCost'), 'the rest may be paid on paper');
  assert.ok(src.includes('gold: () => totalGoldAmount(playerEntity)'), 'the gate sees GetGoldAmount');
  assert.ok(src.includes('goldPieces: () => goldAmount(playerEntity)'), 'and the coins alone');
  assert.ok(src.includes('hasHorse: () => hasTransport(TRANSPORT_HORSE)'), 'a bought horse reaches the calculator');
  assert.ok(src.includes('poisonCount: () => poisonCount(playerEntity)'), 'and a poison reaches the warning');
  const k = src.indexOf('async function _teleportToPixel');
  assert.ok(k > 0, 'the shared teleport core exists');
  // AUDIT 39 (#158): the window widened from 900 - CleanupUntrackedObjects
  // now stands at the head of the core and pushed the streaming needles down.
  // A1 widened it again, 1600 -> 2100: the core now re-reads the season
  // before it rebuilds (a fast travel is where the calendar jumps weeks),
  // and that note sits above the same needles.
  // PIN MOVED (ROAD-Ar, R1/R0), 2100 -> 2600: the re-read now takes the
  // ARRIVAL minute from the caller (RaiseTime runs after the teleport,
  // DaggerfallTravelPopUp.cs:333/:344, so the live clock read the
  // departure date), and the core clears the season re-skin's motor
  // hold beside it. Both notes are above these needles.
  // PIN MOVED AGAIN (CLOSEOUT), 2600 -> 2800: the straightening now
  // raises a latch the frame's season poll honours, so no frame taken
  // across the destination build can read the DEPARTURE clock and undo
  // it - one statement and a `finally` around the build's await, both
  // above these needles, which are still unchanged.
  const core = src.slice(k, k + 2800);
  for (const needle of ['destroyPixel(bx, by)', 'state.init(px, py)', 'buildPixel(first.px']) {
    assert.ok(core.includes(needle), `the core carries ${needle}`);
  }
  // AUDIT 39 (#158) - StreamingWorld.CleanupUntrackedObjects (:1620-1644,
  // SaveLoadManager_OnStartLoad) and ClearStreamingWorld (:993-998): loose
  // enemies and missiles survive neither a load nor a teleport. collectPixel
  // frees only CORPSES, so without this a quickload mid-fight left every live
  // foe and guard standing and restoreWorld spawned the save's copies on top.
  // BEFORE the rebuild, so the destination mints into an empty world.
  const teardownAt = core.indexOf('for (const key of [...built.keys()])');
  assert.ok(teardownAt > 0, 'the teardown loop anchors the sweep');
  for (const needle of ['exteriorFoes.clearLive()', 'cityGuards.clearLive()',
    'magic.clearMissiles()', 'arrows.arrows.length = 0']) {
    const j = core.indexOf(needle);
    assert.ok(j > 0 && j < teardownAt, `${needle} sweeps before the pixels come down`);
  }
});
