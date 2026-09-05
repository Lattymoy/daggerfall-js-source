// ROAD TO 1:1, WAVE B / B5 - THE REST RESIDUE ON TOP OF THE WINDOW STACK.
//
// B1 landed src/ui/windowStack.js and the hosts' adoption, which
// answered ONE of DaggerfallRestWindow's laws: a message box over a
// running rest suspends it and popping resumes it. Three of its
// neighbours were left standing, and this file is those three:
//
//   1. GetPreventedRestMessage polled EVERY FRAME of a running rest
//      (TickRest :357-360 and again :407-410), plus the registry that
//      produces it (GameManager.cs:52, :637-675) - which the port had
//      never had, so the arm restDecision has carried since U48 was
//      being fed a permanent null from all four hosts.
//   2. TickRest's SECOND top-window test (:396-399), the one DFU's own
//      comment explains - "Checking for second time as quest tick above
//      can perfectly align with rest ending" - and which is the
//      REACHABLE one, because QuestMachine.Tick runs inside the
//      sub-tick loop.
//   3. OnPop's UpdateNpcPresence (:277-280 ->
//      DaggerfallInterior.cs:341-361) and the TOGGLE-BINDING CLOSE
//      (Update :187-196), both FLAGGED in ui/restWindow.js's header.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  RestSession, REST_TEXT, REST_WAIT_PER_HOUR,
  registerPreventRestCondition, unregisterPreventRestCondition,
  getPreventedRestMessage, clearPreventRestConditions, restDecision,
} from '../src/systems/restSession.js';
import { RestWindow } from '../src/ui/restWindow.js';
import { createRestDeps } from '../src/scenes/shared.js';
import { makeWindowStack } from '../src/ui/windowStack.js';
import { updateNpcPresence } from '../src/characters/interiorPeople.js';
import { makeInteriorPersonHost } from '../src/scenes/interiorContext.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { SKILLS } from '../src/systems/skills.js';
import { createBindings, setBinding } from '../src/systems/inputActions.js';
import { setBindings } from '../src/ui/input.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const deps = (over = {}) => {
  const d = {
    minutes: 0, vitalTicks: 0,
    advanceMinutes(n) { d.minutes += n; },
    tickVitals() { d.vitalTicks++; return false; },
    fullyHealed: () => false,
    enemiesNearby: () => false,
    dead: () => false,
    ...over,
  };
  return d;
};

const sleeper = () => ({
  isPlayer: true, level: 1, health: 5, maxHealth: 50, magicka: 0, maxMagicka: 8,
  fatigue: 0, stats: { strength: 50, endurance: 50, willpower: 50 }, skills: 20,
  career: {}, skillUses: { [SKILLS.Medical]: 0 },
});

// ---------------------------------------------------------------------
// 1. THE REGISTRY (GameManager.cs:52, :637-675)
// ---------------------------------------------------------------------

test('B5: RegisterPreventRestCondition / GetPreventedRestMessage, and the null -> "" normalisation', () => {
  clearPreventRestConditions();
  assert.equal(getPreventedRestMessage(), null, 'no conditions is null, never ""');

  // A condition that answers FALSE is walked past (:647).
  let ritualRunning = false;
  const ritual = () => ritualRunning;
  registerPreventRestCondition(ritual, 'The ritual is not finished.');
  assert.equal(getPreventedRestMessage(), null);
  ritualRunning = true;
  assert.equal(getPreventedRestMessage(), 'The ritual is not finished.');

  // DFU's own comment at :662-663: a NULL message is stored as the
  // EMPTY STRING, because null is the sentinel for "not prevented" and
  // a caller must be able to block rest without wording it.
  const wordless = () => true;
  registerPreventRestCondition(wordless, null);
  unregisterPreventRestCondition(ritual);
  assert.equal(getPreventedRestMessage(), '', 'wordless prevention is "", not null');

  // The Dictionary is keyed by the HANDLER (:665), so registering the
  // same function again REPLACES its message rather than doubling it.
  registerPreventRestCondition(wordless, 'Now with words.');
  assert.equal(getPreventedRestMessage(), 'Now with words.');
  unregisterPreventRestCondition(wordless);
  assert.equal(getPreventedRestMessage(), null, 'Unregister removes it (:672-675)');
  clearPreventRestConditions();
});

test('B5: the OPEN gate finally has a producer - all four hosts read the registry', () => {
  // restDecision's third arm has existed since U48 and nothing in src/
  // could ever hand it a message. The four dispatch sites now do.
  // PIN MOVED (ROAD review-p): the hosts hand over the PRODUCER, not
  // its answer. DFU fetches the registry inside the third `else`
  // (DaggerfallUI.cs:667-669), so a press the enemy arm or the
  // swimming/grounded arm answers never runs a registered condition -
  // and the conditions are arbitrary caller-supplied Func<bool>s, so
  // when they run is part of what was registered.
  for (const host of ['world', 'exterior', 'worldModes', 'dungeonContext']) {
    assert.match(src(`src/scenes/${host}.js`), /preventedMessage: getPreventedRestMessage,/,
      `${host}.js feeds the open gate from the registry`);
  }
  // ...and the law it lands in is unchanged: "" falls back to 355.
  assert.deepEqual(restDecision({ preventedMessage: '' }), { kind: 'cannot', textId: REST_TEXT.cannotRestNow });
  assert.deepEqual(restDecision({ preventedMessage: 'no' }), { kind: 'prevented', message: 'no' });
  assert.deepEqual(restDecision({ preventedMessage: () => '' }), { kind: 'cannot', textId: REST_TEXT.cannotRestNow });
  // ROAD-U: the message is the RESOLVED text, never the producer. This
  // arm used to be checked on `.kind` alone, and the branch returned
  // the FUNCTION - which every host renders verbatim as the box's one
  // line, so the worded prevention (the one with something to say)
  // would have printed the source of getPreventedRestMessage.
  // DaggerfallUI.cs:667-669 shows the string the registry returned.
  assert.deepEqual(restDecision({ preventedMessage: () => 'no' }), { kind: 'prevented', message: 'no' });
});

test('B5: the registry is asked in the third arm ONLY - never under the two above it', () => {
  // The handlers are the caller's, so an eager poll runs someone
  // else's code on a press DFU answers without ever reaching them.
  let asked = 0;
  const registry = () => { asked++; return 'The ritual is not finished.'; };
  assert.equal(restDecision({ enemiesNearby: true, preventedMessage: registry }).kind, 'enemies');
  assert.equal(asked, 0, 'the enemy arm returns first (:652-660)');
  assert.equal(restDecision({ swimming: true, preventedMessage: registry }).kind, 'cannot');
  assert.equal(restDecision({ grounded: false, preventedMessage: registry }).kind, 'cannot');
  assert.equal(asked, 0, 'and so does the swimming/grounded arm (:661-666)');
  assert.deepEqual(restDecision({ preventedMessage: registry }),
    { kind: 'prevented', message: 'The ritual is not finished.' }, 'the registry\'s TEXT, not its producer');
  assert.equal(asked, 1, 'the third else is where GetPreventedRestMessage is called (:667-669)');
});

// ---------------------------------------------------------------------
// 2. THE PER-FRAME POLL (TickRest :357-360, :407-410)
// ---------------------------------------------------------------------

test('B5: a condition that lands MID-REST ends it on the very next frame, before any time passes', () => {
  let blocked = false;
  const d = deps({ preventedRestMessage: () => (blocked ? 'You may not sleep here.' : null) });
  const s = new RestSession('timed', 9, d);

  s.tick(REST_WAIT_PER_HOUR + 1e-9);
  assert.equal(s.totalHours, 1, 'an hour of ordinary rest');
  const minutesRested = d.minutes;

  blocked = true;
  const r = s.tick(REST_WAIT_PER_HOUR + 1e-9);
  assert.deepEqual(r, {
    textId: null, text: 'You may not sleep here.', prevented: true, enemyBroke: false, died: false,
  });
  assert.equal(d.minutes, minutesRested,
    'the poll is ABOVE the clock (:357) - not one classic minute passed on the frame it fired');
  assert.equal(s.totalHours, 1);
});

test('B5: the mid-rest EMPTY STRING is TEXT.RSC 355, not a blank box (EndRest :469-477)', () => {
  const d = deps({ preventedRestMessage: () => '' });
  const r = new RestSession('timed', 4, d).tick(0.01);
  assert.deepEqual(r, { textId: REST_TEXT.cannotRestNow, prevented: true, enemyBroke: false, died: false });
  assert.equal(d.minutes, 0);
});

test('B5: EndRest ranks the prevention ABOVE the expired room, and the enemies above both', () => {
  // EndRest's ladder (:461-486): enemyBrokeRest, THEN
  // preventedRestMessage, THEN the else-block whose first arm is the
  // expired rental. So a prevented rest in a room that ran out this
  // very hour speaks the prevention.
  const d = deps({ preventedRestMessage: () => 'The dead do not sleep.' });
  const s = new RestSession('timed', 4, d, 1);   // one hour of rent left
  const r = s.tick(0.01);
  assert.equal(r.text, 'The dead do not sleep.');
  assert.equal(r.rentExpired, undefined, 'the landlord does not get the last word');

  // ...and the abort latch outranks the poll, because DFU tests it
  // first (:350-355).
  const d2 = deps({ preventedRestMessage: () => 'blocked' });
  const s2 = new RestSession('timed', 4, d2);
  s2.abortForEnemySpawn();
  assert.deepEqual(s2.tick(0.01), { textId: REST_TEXT.enemiesNearby, enemyBroke: true, died: false });
});

test('B5: the SECOND poll fires inside a completed hour, after the enemy check and before the vitals', () => {
  // :405-410 - a condition that turns on during the hour's own quest
  // ticks stops the healing rather than following it.
  let hours = 0;
  const d = deps({
    tickQuests() { hours++; },
    preventedRestMessage: () => (d.minutes >= 60 ? 'The ritual claims you.' : null),
  });
  const s = new RestSession('timed', 9, d);
  const r = s.tick(REST_WAIT_PER_HOUR + 1e-9);
  assert.equal(r?.text, 'The ritual claims you.');
  assert.equal(s.totalHours, 1, 'the hour was counted (:394) before the poll');
  assert.equal(d.vitalTicks, 0, 'but no vitals ticked - the poll is above TickVitals');
  assert.equal(s.hoursRemaining, 9, 'and the timed counter did not move');
});

test('B5: the running window speaks the prevented message and still RAISES SKILLS on close', () => {
  clearPreventRestConditions();
  const e = sleeper();
  let raised = 0;
  let blocked = false;
  const cond = () => blocked;
  registerPreventRestCondition(cond, 'A voice forbids it.');
  try {
    // NOT a dep the host hands in: createRestDeps COMPOSES the poll off
    // the registry and its composition wins over the spread, exactly as
    // it does for setResting - which this pin also proves.
    const w = new RestWindow(createRestDeps(e, {
      advanceMinutes() {},
      endLines: (id) => [`rsc${id}`],
      onRestFinished: () => { raised++; },     // deliberately IGNORED - see below
    }));
    w.input('char:1'); w.input('char:9'); w.input('confirm');
    assert.equal(w.state, 'resting');
    blocked = true;
    w.tick(0.01);
    // Every EndRest arm attaches RestFinishedPopup_OnClose, the
    // prevented one included (:467, :474) - so the prevention lands in
    // the 'ended' state, which IS the RaiseSkills moment (:729-732),
    // and not in the silent 'refused' one CanRest uses.
    assert.equal(w.state, 'ended');
    assert.deepEqual(w.endLines, ['A voice forbids it.']);
    w.input('confirm');
    assert.equal(raised, 0, 'onRestFinished is COMPOSED (raisePlayerSkills) - a host cannot override it');
    assert.equal(w.done, true);
    assert.equal(e.isResting, false);
  } finally { unregisterPreventRestCondition(cond); clearPreventRestConditions(); }
});

test('B5: createRestDeps composes the poll for every host, off the ONE registry', () => {
  clearPreventRestConditions();
  const d = createRestDeps(sleeper(), { advanceMinutes() {} });
  assert.equal(typeof d.preventedRestMessage, 'function');
  assert.equal(d.preventedRestMessage(), null);
  const cond = () => true;
  registerPreventRestCondition(cond, 'one law, four hosts');
  assert.equal(d.preventedRestMessage(), 'one law, four hosts');
  unregisterPreventRestCondition(cond);
  clearPreventRestConditions();
});

// ---------------------------------------------------------------------
// 3. THE SECOND TOP-WINDOW TEST (TickRest :396-399)
// ---------------------------------------------------------------------

test('B5: a quest popup pushed BY the rest\'s own sub-tick suspends it mid-hour', () => {
  // DFU's comment is the whole item: "Do nothing if another window
  // (e.g. quest popup) has suddenly taken over UI / Checking for second
  // time as quest tick above can perfectly align with rest ending".
  // B1's hosts tick the top window only, which covers the FIRST test
  // (:364) - but a box pushed from inside tickQuests lands halfway
  // through the frame the rest is already running.
  //
  // PIN CORRECTED (ROAD review-p): this fixture used to raise its
  // popup at `d.minutes >= 60` - the one sub-tick where the hour turns
  // and control has already left the sub-hour arm - so the return it
  // asserted came from the SECOND test below and the mid-hour arm in
  // the title was never run at all. Deleting that arm failed nothing.
  // The trigger is now genuinely mid-hour, and the on-the-hour case is
  // the test after this one, so the two `_covered()` sites stay
  // independently killable.
  let covered = false;
  const d = deps({
    tickQuests() { if (d.minutes >= 20) covered = true; },   // the machine raises a popup two sub-ticks in
  });
  const s = new RestSession('timed', 9, d, -1, () => !covered);
  const r = s.tick(REST_WAIT_PER_HOUR * 3);   // three hours of dt in one frame

  assert.equal(r, null, 'TickRest returned FALSE - the rest is suspended, not ended');
  assert.equal(d.minutes, 20, 'the rest of the dt did NOT run out under the box');
  assert.equal(s.totalHours, 0, 'the hour had not turned, so none was counted');
  assert.equal(s.hoursRemaining, 9, 'nor was one deducted');
  assert.equal(d.vitalTicks, 0);
});

test('B5: ...and the SECOND test catches the popup that lands exactly ON the hour', () => {
  // The other `_covered()` site (:396-399), whose quirk is that
  // totalHours has already been counted (:394): the covered hour still
  // reaches OnSleepEnd's six-hour test, and a timed rest loses no hour
  // off its counter for it.
  let covered = false;
  const d = deps({
    tickQuests() { if (d.minutes >= 60) covered = true; },
  });
  const s = new RestSession('timed', 9, d, -1, () => !covered);
  assert.equal(s.tick(REST_WAIT_PER_HOUR * 3), null, 'suspended, not ended');
  assert.equal(s.totalHours, 1, 'the hour was counted (:394) before the test');
  assert.equal(d.vitalTicks, 0, 'and the covered hour heals nothing');
  assert.equal(s.hoursRemaining, 9, 'nor is it deducted');
  assert.equal(d.minutes, 60, 'the rest of the dt did NOT run out under the box');
});

test('B5: the FIRST test refuses a covered window outright, and uncovering resumes the same session', () => {
  let covered = false;
  const d = deps();
  const s = new RestSession('timed', 9, d, -1, () => !covered);
  s.tick(REST_WAIT_PER_HOUR + 1e-9);
  assert.equal(s.totalHours, 1);

  covered = true;
  for (let i = 0; i < 5; i++) assert.equal(s.tick(REST_WAIT_PER_HOUR + 1e-9), null);
  assert.equal(s.totalHours, 1, 'nothing advanced while another window held the screen (:364)');
  // 0.75s of dt is TEN sub-ticks, not six (the waitPerHour /
  // minutesPerTick divisor quirk), so one frame buys 100 classic
  // minutes and one whole hour. The covered frames buy none of either.
  assert.equal(d.minutes, 100);

  covered = false;
  s.tick(REST_WAIT_PER_HOUR + 1e-9);
  assert.ok(s.totalHours > 1, 'and it picks up where it left off - the part-hour was kept, not lost');
  assert.equal(s._minutesOfHour < 60, true);
});

test('B5: the window asks the question DFU asks - `uiManager.TopWindow != this`', () => {
  const e = sleeper();
  let slot = null;
  const stack = makeWindowStack({ onTop: (w) => { slot = w; } });
  const w = new RestWindow(createRestDeps(e, {
    advanceMinutes() {}, endLines: (id) => [`x${id}`],
    topWindow: () => slot,
  }));
  stack.pushWindow(w);
  w.input('char:1'); w.input('char:9'); w.input('confirm');
  assert.equal(w._isTop(), true);
  stack.pushWindow({ isQuestBox: true });
  assert.equal(w._isTop(), false, 'a box over it is the top window, not this');
  // ...and the session it built carries that same predicate, so a host
  // that DOES tick a covered window still cannot advance it.
  w.tick(REST_WAIT_PER_HOUR * 4);
  assert.equal(w.session.totalHours, 0);
  stack.popWindow();
  assert.equal(w._isTop(), true);
  w.tick(REST_WAIT_PER_HOUR + 1e-9);
  assert.equal(w.session.totalHours, 1);
});

test('B5: every host hands the rest window its live slot as TopWindow', () => {
  for (const [host, slot] of [
    ['worldModes', 'interiorOverlay'],
    ['dungeonContext', 'activeOverlay'],
    ['world', 'townTalk.overlay'],
    ['exterior', 'townTalk.overlay'],
  ]) {
    assert.match(src(`src/scenes/${host}.js`), new RegExp(`topWindow: \\(\\) => ${slot.replace('.', '\\.')},`),
      `${host}.js mirrors the stack top into the rest deps`);
  }
});

// ---------------------------------------------------------------------
// 4. UpdateNpcPresence ON POP (DaggerfallInterior.cs:341-361)
// ---------------------------------------------------------------------

test('B5: UpdateNpcPresence - the shop you entered SHUT is open when you wake', () => {
  // The gate is two arms (:347-349) and the clock test is a THIRD
  // condition inside them (:352).
  const shop = BUILDING_TYPES.GeneralStore;   // open 08:00-16:00
  assert.equal(updateNpcPresence(shop, { hour: 12, insideOpenShop: false }), true,
    'walked into a closed shop, rested to opening time: the shopkeeper appears');
  assert.equal(updateNpcPresence(shop, { hour: 4, insideOpenShop: false }), false,
    'still shut - IsBuildingOpen is the inner test');
  assert.equal(updateNpcPresence(shop, { hour: 12, insideOpenShop: true }), false,
    'a shop entered OPEN is not the shop arm at all (!IsPlayerInsideOpenShop)');
});

test('B5: UpdateNpcPresence - the non-shop arm is <= House4 and NOT HouseForSale', () => {
  // The bound is the literal one, so Temple (14), Tavern (15) and
  // Palace (16) are all under it and House5 (21) is not - the same
  // reading peopleAreVisible carries for AddPeople's tail.
  assert.equal(updateNpcPresence(BUILDING_TYPES.Palace, { hour: 12 }), true, 'Palace 10:00-16:00');
  assert.equal(updateNpcPresence(BUILDING_TYPES.Palace, { hour: 20 }), false);
  assert.equal(updateNpcPresence(BUILDING_TYPES.Tavern, { hour: 3 }), true, 'a tavern never closes');
  assert.equal(updateNpcPresence(BUILDING_TYPES.HouseForSale, { hour: 12 }), false,
    'HouseForSale is excluded BY NAME (:349), not by its hours');
  assert.equal(updateNpcPresence(BUILDING_TYPES.House5, { hour: 12 }), false,
    'past House4 the arm does not apply');
  // House1's own row is open 0 / close 0 - never open, so its people
  // never come back either way.
  assert.equal(updateNpcPresence(BUILDING_TYPES.House1, { hour: 12 }), false);
});

test('B5: the rest window runs UpdateNpcPresence on pop, ONCE, and it only ever ADDS people', () => {
  const e = sleeper();
  const people = [{ active: false }, { active: false }];
  let calls = 0;
  const w = new RestWindow(createRestDeps(e, {
    advanceMinutes() {}, endLines: (id) => [`x${id}`],
    updateNpcPresence: () => { calls++; for (const p of people) p.active = true; },
  }));
  // ROAD-E E1: Esc off the selection page is GetBackButtonUp() (:193) -
  // CloseWindow -> OnPop. Both edges, because the release arm carries
  // the automap windows' deferral (:703-713): the port opens on the
  // press, so only a press this window saw arms the close.
  w.input('back');
  assert.equal(w.done, false, 'the press arms, it does not close');
  w.keyup('back');
  assert.equal(calls, 1);
  assert.deepEqual(people.map((p) => p.active), [true, true]);
  // dispose() runs _close a second time deliberately (the 2026-08-29
  // crash note); OnPop must not run twice with it.
  w.dispose();
  assert.equal(calls, 1, 'OnPop is owed ONCE, like onClose');
});

test('B5: the interior host wires OnPop to its live people list and its own clock', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /updateNpcPresence: \(\) => \{/, 'worldModes supplies the OnPop dep');
  assert.match(wm, /updateNpcPresence\(interiorBuilding\?\.buildingType/,
    'and calls the law with the building it is standing in');
  assert.match(src('src/ui/restWindow.js'), /this\.deps\.updateNpcPresence\?\.\(\);/,
    'and the window calls it from its ONE close door');
  // The FLAG this closes must not survive the thing it flagged.
  assert.equal(/The port has no\s+\/\/\s+NPC-presence pass at all/.test(src('src/ui/restWindow.js')), false);
});

// ROAD review-p: and the walk has to LAND. DFU's people are
// GameObjects, so SetActive(true) (DaggerfallInterior.cs:355-357) draws
// the billboard and arms its BoxCollider on the spot. The port's host
// was `setActive(active) { pn.active = !!active; }`, and every reader
// of that flag runs once, while the interior is being built - so the
// re-roll moved a boolean and the shop the player slept through the
// opening of still had no shopkeeper, no draw and no activation
// target.
test('B5: SetActive on a person the build hid stands them for real, not just the flag', () => {
  let built = false;
  const stood = [];
  const gone = [];
  const pn = { factionID: 512, active: true };
  const host = makeInteriorPersonHost(pn, {
    built: () => built, stand: (p) => stood.push(p), unstand: (p) => gone.push(p),
  });
  assert.equal(host.staticNpcFactionId, 512, 'DoClick\'s individual broadcast still reads this');
  // The quest away arm fires DURING AddPeople (:1224), before anything
  // has been drawn: the flag alone, because the build loops read it.
  host.setActive(false);
  assert.equal(pn.active, false);
  assert.deepEqual([stood.length, gone.length], [0, 0], 'the build loops below do this one');
  built = true;
  // OnPop's walk, long after.
  host.setActive(true);
  assert.equal(pn.active, true);
  assert.deepEqual(stood, [pn], 'the shopkeeper is given a draw and an extent');
  host.setActive(true);
  assert.equal(stood.length, 1, 'SetActive(true) on someone already standing is not a second billboard');
  host.destroy();
  assert.equal(pn.active, false);
  assert.deepEqual(gone, [pn], 'and the late stand can be taken back out');
});

test('B5: the interior build uses that host, and its late half touches the live draw lists', () => {
  const ic = src('src/scenes/interiorContext.js');
  assert.match(ic, /pn\.host = makeInteriorPersonHost\(pn, \{/, 'the build wires the routed host');
  assert.match(ic, /built: \(\) => peopleBuilt/, 'with the build-time/after-the-build seam');
  assert.match(ic, /billboardBatches\.push\(pn\.lateBatch\)/,
    'a late stand pushes its own batch into the LIVE array the host draws from');
  assert.match(ic, /pn\.width = size\.w;[\s\S]{0,60}pn\.height = size\.h;[\s\S]{0,400}uploadRecord\(/,
    'and resolves the extent U23\'s activation ray refuses to aim without');
});

// ---------------------------------------------------------------------
// 5. THE TOGGLE-BINDING CLOSE (Update :187-196)
// ---------------------------------------------------------------------

test('B5: the key that OPENED the rest window closes it - and ENDS a running rest', () => {
  const store = createBindings();
  setBinding(store, 'KeyR', 'Rest');
  setBindings(store);
  try {
    const e = sleeper();
    // On the selection page the binding is CloseWindow (:195-196).
    const w = new RestWindow(createRestDeps(e, { advanceMinutes() {}, endLines: (id) => [`x${id}`] }));
    // ROAD-E E1: :193 is GetKeyUp(toggleClosedBinding), so the PRESS
    // arms nothing and the RELEASE closes. A BARE release is inert,
    // though, and that is not a detail: the press that OPENS this
    // window is the host's (world.js:4164 opens on the key down, where
    // GameManager.cs:534-537 opens on `ActionComplete` - the release -
    // so DFU's opening release is already spent), so the door carries
    // DaggerfallAutomapWindow.cs:703-713's deferral and closes only on
    // the release of a press this window itself saw. The host-level
    // walk that proves the open edge is roade_up_seam.test.js's.
    w.keyup('char:r');
    assert.equal(w.done, false, 'a release with nothing armed closes nothing (:709)');
    w.input('char:r');
    assert.equal(w.done, false, 'the press is not the toggle - GetKeyUp is (:193)');
    w.keyup('char:r');
    assert.equal(w.done, true, 'CloseWindow, because currentRestMode == Selection');
    assert.equal(e.isResting, false);

    // ...and mid-rest it is EndRest (:193-194), which is the mode's own
    // finish text and the advancement that comes with it.
    const w2 = new RestWindow(createRestDeps(e, {
      advanceMinutes() {}, endLines: (id) => [`rsc${id}`],
    }));
    w2.input('char:1'); w2.input('char:9'); w2.input('confirm');
    assert.equal(w2.state, 'resting');
    w2.input('char:r');
    assert.equal(w2.state, 'resting', 'the press arms the door and nothing else');
    w2.keyup('char:r');
    assert.equal(w2.state, 'ended', 'EndRest, not CloseWindow');
    assert.deepEqual(w2.endLines, [`rsc${REST_TEXT.wakeUp}`],
      "the mode's own finish text - the toggle is EndRest, so it is NOT the silent close");
    w2.input('confirm');
    assert.equal(w2.done, true);
    assert.equal(e.isResting, false);
  } finally { setBindings(null); }
});

test('B5: the toggle close FOLLOWS A REBIND, and does not eat the letter it is not bound to', () => {
  const store = createBindings();
  setBinding(store, 'KeyZ', 'Rest');
  setBindings(store);
  try {
    const e = sleeper();
    const w = new RestWindow(createRestDeps(e, { advanceMinutes() {}, endLines: (id) => [`x${id}`] }));
    // R is no longer the rest key, so it is an ordinary character
    // again - the selection page ignores it.
    w.input('char:r');
    w.keyup('char:r');
    assert.equal(w.done, false);
    w.input('char:z');
    assert.equal(w.done, false, ':193 is GetKeyUp - the press only arms');
    w.keyup('char:z');
    assert.equal(w.done, true, 'the REBOUND key toggles the window closed');
  } finally { setBindings(null); }
});

test('B5: the toggle key does not fire while the hours PROMPT has the field', () => {
  // The binding is read on Update, but DFU's input message box owns the
  // keyboard while it is up (DaggerfallInputMessageBox is its own
  // window on the stack) - so typing the rest letter into the field
  // must not close the window under it. The port's prompt takes only
  // digits, which is the same answer.
  const store = createBindings();
  setBinding(store, 'KeyR', 'Rest');
  setBindings(store);
  try {
    const e = sleeper();
    const w = new RestWindow(createRestDeps(e, { advanceMinutes() {}, endLines: (id) => [`x${id}`] }));
    w.input('char:1');
    assert.equal(w.state, 'hours');
    w.input('char:r');
    assert.equal(w.done, false, 'the prompt is a window of its own');
    assert.equal(w.state, 'hours');
  } finally { setBindings(null); }
});

test('B5: the restWindow FLAG about the toggle binding is retired, not reworded', () => {
  const rw = src('src/ui/restWindow.js');
  assert.equal(/A per-window\s+\/\/ toggle-close binding is a UI-arc facility/.test(rw), false,
    'the FLAG text must not survive the thing it flagged');
  assert.equal(/The port cannot: with a\s+\/\/ window up every host routes keys through overlayAction/.test(rw), false);
  assert.match(rw, /toggleClosedBinding/, 'and DFU\'s own field name is what carries it');
});
