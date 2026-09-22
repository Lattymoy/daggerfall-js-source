// OL2 (Mac, 2026-09-14: "Now tackle #s 5/6") - AUDIT WORLD5's fifth and
// sixth recorded items, paid. (5) THE REST WINDOW SAYS IT IS CLOCK-PACED:
// under the shared clock the counter moves once per five real minutes and
// a bare hour count read as a hang; the status carries the world's minutes
// while the session is paced by them (deps.sharedMinutes - null offline,
// and then the page is what it was), and both the art page and the text
// page say the world's time of day and the pace, the pace DERIVED from the
// wire's one rate. (6) THE TRIP SAYS IT ARRIVES NOW: online the trip takes
// no world time (WORLD5), so the popup's day countdown is empty, no inn
// night is paid (there are no nights), the days label says "now", a line
// under the panel says why, and the ship's fare stands; the host's word is
// deps.noWorldTime (world.js: sharedClockOn), threaded through the map
// window, and a host that says nothing travels as DFU does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RestWindow, restClockLine } from '../src/ui/restWindow.js';
import { TravelPopUpWindow, ONLINE_TRAVEL_LINE, LABEL_POS } from '../src/ui/travelPopUp.js';
import { CLASSIC_GAME_START_TIME } from '../src/systems/gameDate.js';
import { ONLINE_MINUTES_PER_MS } from '../src/net/wire.js';
import { CLIMATES } from '../src/formats/mapsFile.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const winDeps = (over = {}) => ({ advanceMinutes() {}, tickVitals: () => false, fullyHealed: () => false, enemiesNearby: () => false, dead: () => false, endLines: (id) => [`text:${id}`], ...over });
const resting = (deps) => { const w = new RestWindow(winDeps(deps)); w.input('char:1'); w.input('char:4'); w.input('confirm'); return w; };

test('OL2 (5): the rest window\'s status carries the world\'s minutes while the shared clock paces the session, and nothing else changes; offline the status is what it was', () => {
  let clock = CLASSIC_GAME_START_TIME + 725;   // 01:35 on the start day... whatever the day, the minute is the world's
  const on = resting({ sharedMinutes: () => clock });
  assert.equal(on.state, 'resting');
  assert.deepEqual(on.status(), { panel: 'counter', texture: 'hoursRemaining', hours: 4, worldMinutes: clock });
  clock += 30;
  assert.equal(on.status().worldMinutes, clock, 'read live, every draw');
  const off = resting({});
  assert.deepEqual(off.status(), { panel: 'counter', texture: 'hoursRemaining', hours: 4 }, 'offline: no key added');
  assert.deepEqual(new RestWindow(winDeps()).status(), { panel: 'main' });
});

test('OL2 (5): the clock line says the world\'s time of day (RESTX2: and that a rest does not move it - the pace half went with the shared-clock pacing)', () => {
  // RESTX2 (2026-09-17) put every mode on the window's own timer, so "an
  // hour here is 5 real minutes" stopped being true and the line says
  // the one thing that still is: the world's clock, which a rest online
  // never moves. REAL_MINUTES_PER_WORLD_HOUR went with the sentence.
  assert.equal(restClockLine(CLASSIC_GAME_START_TIME), 'World time 13:30 - resting does not move it', 'the classic start, 13:30');
  assert.equal(restClockLine(CLASSIC_GAME_START_TIME + 95), 'World time 15:05 - resting does not move it', 'padded');
  assert.ok(!rd('src/ui/restWindow.js').includes('REAL_MINUTES_PER_WORLD_HOUR'), 'no spelled pace on the page, and no constant left to drift');
  void ONLINE_MINUTES_PER_MS;
  const on = resting({ sharedMinutes: () => CLASSIC_GAME_START_TIME + 95, vitals: () => ({ health: 10, maxHealth: 20, fatigue: 5, magicka: 6 }) });
  assert.deepEqual(on.restingLines(), ['Resting...', 'Hours remaining: 4', 'World time 15:05 - resting does not move it', 'Health 10/20  Fatigue 5  Magicka 6', '', 'Esc - stop'], 'the text page, between the hours and the vitals');
  const off = resting({ vitals: () => ({ health: 10, maxHealth: 20, fatigue: 5, magicka: 6 }) });
  assert.deepEqual(off.restingLines(), ['Resting...', 'Hours remaining: 4', 'Health 10/20  Fatigue 5  Magicka 6', '', 'Esc - stop'], 'offline: the page it always was');
  const src = rd('src/ui/restWindow.js');
  assert.match(src, /if \(Number\.isFinite\(st\.worldMinutes\)\) \{\s*shadowText\(renderer, font, restClockLine\(st\.worldMinutes\), m, 0, REST_PANEL_Y \+ REST_COUNTER_RECT\[3\] \+ 18, \{ align: 'center', w: NATIVE_W \}\);/, 'the art page, under the vitals');
  assert.match(src, /lines = this\.restingLines\(\);/, 'one body for the text page and the pin');
});

test('OL2 (6) + TRAVEL-FARE: online the trip\'s countdown is empty and it begins on the next tick, the FARE is still billed, the days label says now and the line under the panel says why; a host that says nothing travels as DFU does', () => {
  const mk = (noWorldTime) => {
    const traveled = [];
    const w = new TravelPopUpWindow({ x: 10, y: 0 }, {
      getPlayerPixel: () => ({ x: 0, y: 0 }), getClimateIndex: () => CLIMATES.Woodlands, gold: () => 1000,
      onTravel: (endPos, opts, computed) => traveled.push({ endPos, opts, computed }), ...(noWorldTime ? { noWorldTime } : {}),
    });
    return { w, traveled };
  };
  const on = mk(() => true);
  assert.equal(on.w.sleepModeInn, true, 'Inns is still the default toggle');
  // TRAVEL-FARE (2026-09-22, kurkku: "really long trips ... don't cost
  // anything"): THE FARE IS BILLED ONLINE NOW, and this pin is the
  // reversal's own record. OL2 read "no nights, so no inn", which was
  // right about the nights and wrong about the UNIT - DFU bills the
  // trip's HOURS, and the journey has a length online even though the
  // clock will not advance over it. OL2's own ship clause always read
  // it that way ("a crossing is a crossing"); both halves agree now.
  // What made it a bug rather than a rule: with Travel Options'
  // cautious travel off, a trip is an instant arrival, so online it
  // cost no time AND no gold - free teleportation anywhere in the Bay
  // from a mod toggle, while a ship still billed.
  assert.ok(on.w.trip.piecesCost >= 5, 'the inn is billed online - DFU\'s "always at least one stay" included');
  assert.equal(on.w.trip.totalCost, on.w.trip.piecesCost, 'no ocean on this path, so the fare is the inn alone');
  assert.ok(on.w.travelTimeTotalMins > 0, 'the trip\'s DFU minutes are still computed (the host reads them offline only)');
  assert.equal(on.w.countdownValueTravelTimeDays, 0, 'no days to count down');
  on.w.input('KeyB');
  on.w.tick(0.016);
  assert.equal(on.traveled.length, 1, 'the trip begins on the first tick');
  assert.ok(on.traveled[0].computed.piecesCost >= 5, 'and the trip that BEGINS carries the same fare the card quoted');
  const off = mk(null);
  assert.ok(off.w.trip.piecesCost >= 5 && off.w.countdownValueTravelTimeDays >= 1, 'offline: the inn night and the countdown, as DFU');
  // TRAVEL-FARE: the SAME journey, so the same fare - what online
  // still waives is the DAYS, and only the days.
  assert.equal(on.w.trip.piecesCost, off.w.trip.piecesCost, 'billed at exactly the offline fare');
  assert.equal(on.w.countdownValueTravelTimeDays, 0);
  assert.ok(off.w.countdownValueTravelTimeDays >= 1, '...and that is the ONE thing that still differs');
  off.w.input('KeyB'); off.w.tick(0.016);
  assert.equal(off.traveled.length, 0, 'offline the trip waits for the counter');
  // the labels: 'now' where the days go, and the line under the panel
  const painted = [];
  const font = { fnt: { glyphs: new Map(), ascent: 6, lineHeight: 8 }, texture: 't', drawGlyph: () => {}, glyphWidth: () => 4 };
  const renderer = { drawScreenQuad: () => {}, uploadTexture: () => 't', releaseTexture: () => {} };
  const orig = on.w.draw; void orig;
  const src = rd('src/ui/travelPopUp.js');
  assert.match(src, /shadowText\(renderer, font, this\.noWorldTime\(\) \? 'now' : String\(this\.countdownValueTravelTimeDays\), m, LABEL_POS\.time\[0\], LABEL_POS\.time\[1\]\);/);
  // TO-ONLINE (2026-09-19): ...and NOT over a walked trip. This line is DFU's
  // FAST TRAVEL talking, and while Travel Options stood down on the shared
  // clock the teleport was the only online arrival there was, so it was true
  // of every trip. The journey runs online now (bible Travel-Options.md item
  // 9), and over a walked one "you arrive now" is false -
  // that branch carries the mod's own words and an hours:minutes estimate.
  // What OL2 (6) pins is unchanged: the line still says why, wherever the
  // trip really is DFU's.
  assert.match(src, /if \(this\.noWorldTime\(\) && !this\.walkedTrip\) shadowText\(renderer, font, ONLINE_TRAVEL_LINE, m, 0, POPUP_RECTS\.native\[1\] \+ POPUP_RECTS\.native\[3\] \+ 4, \{ align: 'center', w: NATIVE_W \}\);/);
  // TRAVEL-FARE: the clause is GONE, and its absence is the law now -
  // the toggle reaches the formula unconditioned, online or not.
  assert.match(src, /sleepModeInn: this\.sleepModeInn,   \/\/ TRAVEL-FARE: billed online too/);
  assert.doesNotMatch(src, /sleepModeInn: this\.sleepModeInn && !this\.noWorldTime\(\)/,
    'OL2\'s inn clause is retired - the fare is the price of the journey, not rent on elapsed time');
  assert.match(src, /this\.countdownValueTravelTimeDays = this\.noWorldTime\(\) \? 0 : travelDays\(this\.travelTimeTotalMins\);/);
  // TRAVEL-FARE: the line said "no inn is paid" and that is not true
  // any more - a claim a player can read has to move with the law it
  // describes, or the window is lying about the number beside it.
  assert.equal(ONLINE_TRAVEL_LINE, 'Online: the world\'s clock does not wait. You arrive now - the journey is still paid for.');
  assert.deepEqual(LABEL_POS.time, [129, 117]);
  void painted; void font; void renderer;
  assert.match(rd('src/ui/travelMapWindow.js'), /noWorldTime: this\.deps\.noWorldTime,/, 'threaded through the map window');
  assert.match(rd('src/scenes/world.js'), /noWorldTime: \(\) => sharedClockOn\(\),/, 'the world host\'s word');
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /## OL2 \(2026-09-14\)/, 'the record');
});
