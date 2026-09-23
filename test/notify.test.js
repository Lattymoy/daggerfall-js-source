// ENH-NOTICE3 (2026-09-21, Mac: "the new enhanced pop up system isn't
// working for everything. All mods, including climates and calories
// need to utilize the enhanced notification popup") - THE ONE DOOR,
// PINNED.
//
// systems/notify.js is the port's DaggerfallUI.MessageBox /
// AddHUDText: a producer names the KIND and the door finds the live
// host's slot. What is held here is the door's own law - the order the
// presenters are asked in, the refusal that passes a box on, the
// fallback that keeps a box from vanishing, the options that reach the
// ActionTextBox - and then the ONE-HOME sweep over the host seams P4
// migrated onto it, because the failure this arc exists to end is not
// a wrong window: it is SIX host seams each deciding by hand which
// class to raise, and one of them (the Travel Options wiring) quietly
// answering with a HUD line.
//
// THE ONE CONSTRUCTION SEAM (AUDIT 17i): "where the rule matters a
// test SWEEPS THE SOURCE to enforce it rather than trusting the next
// author to recall it". That is what the second half of this file is.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  messageBox, hudText, popupMessage, toRows,
  registerPresenter, notifyPresenters, _resetNotifyForTests, mountWindow,
} from '../src/systems/notify.js';

import { createTravelOptions, readTravelOptionsSettings } from '../src/systems/travelOptions.js';
import { TRAVEL_OPTIONS_TEXT } from '../src/systems/travelOptionsText.js';
import { mapPixelWorldOrigin } from '../src/systems/travelPaths.js';
import { rectOf } from '../src/systems/travelAutopilot.js';
import { TravelControlUI } from '../src/ui/travelControlUI.js';
import { modSetting } from '../src/systems/modSettings.js';

const root = new URL('..', import.meta.url).pathname;
const src = (p) => readFileSync(join(root, p), 'utf8');

/** A host's slot, faked: it records what it was offered and answers
 *  the way a real presenter does - true when it took the window,
 *  false when its slot is held and it does not push (notify.js's
 *  Presenter typedef). */
function fakeHost(log, name, priority, { takes = true, active = undefined, hud = false } = {}) {
  const p = {
    priority,
    mount: (win, opts) => { log.push({ name, win, opts }); return takes; },
  };
  if (hud) p.hudText = (line, delay) => { log.push({ name, line, delay }); return true; };
  if (active !== undefined) p.active = () => active;
  return p;
}

// ── THE DOOR ─────────────────────────────────────────────────────────

test('ENH-NOTICE3: a box is offered by PRIORITY and stops at the first host that takes it', () => {
  _resetNotifyForTests();
  const log = [];
  // registered in the order the port's hosts really boot - townTalk
  // (0) first, the mode machine (10) next, a dungeon context (20)
  // last - so the asking order cannot be the registration order by
  // accident.
  registerPresenter(fakeHost(log, 'town', 0));
  registerPresenter(fakeHost(log, 'interior', 10));
  registerPresenter(fakeHost(log, 'dungeon', 20));
  assert.deepEqual(notifyPresenters(), [20, 10, 0], 'the asking order is priority, descending');

  const handle = messageBox('a plaque');
  assert.deepEqual(log.map((r) => r.name), ['dungeon'], 'the top host takes it and nobody below is asked');
  assert.ok(handle, 'a taken box answers a handle');
  assert.deepEqual(handle.window.lines, ['a plaque']);
});

test('ENH-NOTICE3: a host that REFUSES passes the box on, down the whole ladder', () => {
  _resetNotifyForTests();
  const log = [];
  registerPresenter(fakeHost(log, 'town', 0));
  registerPresenter(fakeHost(log, 'interior', 10, { takes: false }));
  registerPresenter(fakeHost(log, 'dungeon', 20, { takes: false }));
  // worldModes' presenter really does refuse above ground (its
  // showQuestOverlay answers false in the exterior), which is the
  // whole reason the ladder exists rather than a single handle.
  const handle = messageBox('a refusal');
  assert.deepEqual(log.map((r) => r.name), ['dungeon', 'interior', 'town'], 'asked in order until one takes it');
  assert.ok(handle);
});

test('ENH-NOTICE3: equal priorities go to the LATEST registered', () => {
  _resetNotifyForTests();
  const log = [];
  registerPresenter(fakeHost(log, 'first', 10));
  registerPresenter(fakeHost(log, 'second', 10));
  assert.deepEqual(notifyPresenters(), [10, 10]);
  messageBox('x');
  assert.deepEqual(log.map((r) => r.name), ['second'],
    'recency breaks the tie - a host that mounted over another is the one standing');
});

test('ENH-NOTICE3: a presenter whose active() is false is SKIPPED, not asked', () => {
  _resetNotifyForTests();
  const log = [];
  registerPresenter(fakeHost(log, 'town', 0));
  registerPresenter(fakeHost(log, 'dungeon', 20, { active: false }));
  assert.deepEqual(notifyPresenters(), [0], 'a dormant host is not in the asking order');
  messageBox('x');
  assert.deepEqual(log.map((r) => r.name), ['town']);
});

test('ENH-NOTICE3: the unregister a teardown calls really drops the host', () => {
  _resetNotifyForTests();
  const log = [];
  const off = registerPresenter(fakeHost(log, 'dungeon', 20));
  registerPresenter(fakeHost(log, 'town', 0));
  off();   // dungeonContext.destroy()'s line
  messageBox('x');
  assert.deepEqual(log.map((r) => r.name), ['town'], 'a box raised after the context is gone belongs to whoever stands next');
});

test('ENH-NOTICE3: FALLBACK, NOT SILENCE - with no host to mount it the rows land on the HUD line and the handle is inert, never a throw', () => {
  _resetNotifyForTests();
  const log = [];
  // a host with a PopupText but no slot (and one whose slot refuses):
  // between them there is nowhere to mount, which is the state the
  // "first ten minutes of a new game were silent" bug lived in.
  registerPresenter({ hudText: (line, delay) => { log.push({ line, delay }); return true; }, priority: 0 });
  registerPresenter(fakeHost(log, 'refuser', 20, { takes: false }));
  // AUDIT ENH-NOTICE3 (a survivor): the rows are RECORDS as often as
  // strings - a `{ text, center }` row, AUDIT 64 F28's `{ cells }` row
  // - and each must reach the line in words, not as an empty string.
  const handle = messageBox(['Death is not eternal.', { text: 'Nor is life.', center: true }, { cells: [{ text: 'Health', x: 0 }, { text: '12', x: 60 }] }]);
  assert.equal(handle.mounted, false, 'so a caller that cares can tell');
  assert.deepEqual(log.filter((r) => r.line).map((r) => r.line), ['Death is not eternal. Nor is life. Health  12'],
    'mutants: the rows dropped; a record row read as an empty string; a cells row read as an empty string');
  // AUDIT ENH-NOTICE3 F7: the status chains call addNext without
  // looking, so the inert handle must chain to itself and read done.
  assert.equal(handle.addNext('more'), handle, 'the chain is a no-op, not a TypeError');
  assert.equal(handle.done, true);
  assert.equal(handle.window, null);
  assert.equal(log.filter((r) => r.line).length, 1, 'a chained row after a fallback raises no second line');
});

test('ENH-NOTICE3 (AUDIT): a host with a PopupText and no slot is passed OVER, not the end of the ladder; a non-object registers nothing', () => {
  _resetNotifyForTests();
  const log = [];
  registerPresenter(fakeHost(log, 'town', 0));
  registerPresenter({ hudText: () => true, priority: 20 });   // a mountless host FIRST in the asking order
  const handle = messageBox('x');
  assert.equal(handle.mounted, true, 'mutant: `continue` -> `break`, so a mountless host stops the ladder and the box falls to the line');
  assert.deepEqual(log.map((r) => r.name), ['town']);
  const off = registerPresenter(null);
  assert.equal(typeof off, 'function');
  assert.doesNotThrow(() => messageBox('y'), 'mutant: the object guard dropped, so a stray null throws the door down at order()');
  off();
});

test('ENH-NOTICE3: hudText is AddHUDText on the live host, delay and all; popupMessage is the same PopupText', () => {
  _resetNotifyForTests();
  const log = [];
  registerPresenter({ hudText: (line, delay) => { log.push([line, delay]); return true; }, priority: 20 });
  assert.equal(hudText('You are hungry.', 4), true);
  assert.equal(popupMessage('You feel better.'), true);
  assert.deepEqual(log, [['You are hungry.', 4], ['You feel better.', undefined]]);
  _resetNotifyForTests();
  assert.equal(hudText('nobody'), false, 'and it says so when no host queued it');
});

test('ENH-NOTICE3: push rides through to the host, and NOTHING else does - the door carries no close callback', () => {
  _resetNotifyForTests();
  const log = [];
  registerPresenter(fakeHost(log, 'town', 0));
  messageBox('default');
  messageBox('replace', { push: false });
  // PushWindow (UserInterfaceManager.cs:79-91) is what every
  // DaggerfallUI.MessageBox does, so the DEFAULT is the push.
  assert.deepEqual(log.map((r) => r.opts.push), [true, false]);
  // AUDIT ENH-NOTICE3 F6: an onClose the door advertised was honoured
  // by one host of three (the interior mount and the dungeon push
  // have no close callback), so the contract is gone rather than
  // two-thirds false. The presenter opts are `{ push }` and no more.
  assert.deepEqual(log.map((r) => Object.keys(r.opts)), [['push'], ['push']],
    'mutant: a callback smuggled back into the opts, which two hosts would drop');
  assert.equal(/onClose/.test(src('src/systems/notify.js')), false, 'and the door does not name one');
  // ...and the LADDER on its own, for a window a host built (the quest
  // ServiceFlowWindow): the same asking order, no box minted.
  const win = { lines: ['a quest'] };
  assert.equal(mountWindow(win), true);
  assert.equal(log.at(-1).win, win, 'the window handed over as given');
  assert.equal(mountWindow(null), false);
  _resetNotifyForTests();
  assert.equal(mountWindow(win), false, 'no host, no mount - the caller decides');
});

test('ENH-NOTICE3: the handle CHAINS - AddNextMessageBox onto the same box', () => {
  _resetNotifyForTests();
  const log = [];
  registerPresenter(fakeHost(log, 'town', 0));
  // DaggerfallMessageBox.AddNextMessageBox (DaggerfallUI.cs:1623-1626,
  // DisplayStatusInfo's own chain): dismissing this box shows the next
  // rows IN ITS PLACE, and only the last dismissal closes.
  const handle = messageBox('first');
  assert.equal(handle.addNext('second\nthird'), handle, 'the chain reads as one expression');
  const win = handle.window;
  assert.equal(log.length, 1, 'ONE window, not a second mount');
  assert.equal(handle.done, false);
  win.input();
  assert.deepEqual(win.lines, ['second', 'third'], 'the next rows, split the way toRows splits them');
  assert.equal(handle.done, false, 'and the box has not closed');
  win.input();
  assert.equal(handle.done, true, 'only the last dismissal closes');
});

test('ENH-NOTICE3: previousWindow and highlightColor reach the ActionTextBox', () => {
  _resetNotifyForTests();
  const log = [];
  registerPresenter(fakeHost(log, 'town', 0));
  // DaggerfallPopupWindow.previousWindow (:24, :56-59) is SET for
  // every DaggerfallUI.MessageBox (it is built on TopWindow, which
  // during play is dfHUD), and DaggerfallAction's own ShowText box is
  // the one exception that passes null (DaggerfallAction.cs:536).
  assert.equal(messageBox('plain').window.previousWindow, true);
  assert.equal(messageBox('a plaque', { previousWindow: false }).window.previousWindow, false);
  // SetHighlightColor (DaggerfallMessageBox.cs:455-458) - the banking
  // status box's DaggerfallUnityStatDrainedTextColor.
  const drained = [0.7, 0.3, 0.3, 1];
  assert.deepEqual(messageBox('DEFAULTED', { highlightColor: drained }).window.highlightColor, drained);
  assert.equal(messageBox('plain').window.highlightColor, undefined, 'unset keeps MultiFormatTextLabel\'s own');
});

test('ENH-NOTICE3: toRows - SetText\'s one Text token, rows as given, and never nothing', () => {
  // A string is SetText(string), which tokenizes into one Text token
  // and falls into SetTextTokens (DaggerfallMessageBox.cs:405-408);
  // the port splits it on newlines the way the hosts always did.
  assert.deepEqual(toRows('one\ntwo\nthree'), ['one', 'two', 'three']);
  assert.deepEqual(toRows('one'), ['one']);
  // an array is rows as given - strings, TEXT.RSC's { text, center }
  // records, or AUDIT 64 F28's tab-stopped { cells } rows
  const rows = [{ text: 'Gold', center: false }, { cells: [{ text: 'a' }, { text: 'b' }] }];
  assert.equal(toRows(rows), rows, 'the producer\'s own rows, not a copy that flattens them');
  // and never nothing: an empty box still draws (the port's boxes
  // iterate `lines` and an empty array draws a frameless nothing)
  assert.deepEqual(toRows([]), ['']);
  assert.deepEqual(toRows(''), ['']);
  assert.deepEqual(toRows(null), ['']);
  assert.deepEqual(toRows(undefined), ['']);
});

// ── THE ONE-HOME SWEEP ───────────────────────────────────────────────

test('ENH-NOTICE3: notify decides WHICH MODEL, the draw decides WHICH FACE - the door never imports the skin', () => {
  const s = src('src/systems/notify.js');
  // The skin fork lives where the enhanced idiom already put it: the
  // box's own draw (ui/actionText.js), the HUD text's (ui/hudText.js),
  // the label's (ui/midScreenText.js). A second fork here would be a
  // second home for the skin decision and the faces would drift.
  // the file SAYS so in its header ("does not import ui/uiSkin.js and
  // never will"), so the pin is on the imports and the reads, not on
  // the word - a promise in a comment is not a pin.
  const code = s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.equal(/uiSkin/.test(code), false, 'systems/notify.js must not import or read ui/uiSkin.js');
  assert.equal(/enhancedSkin|isEnhanced|skin\(\)/.test(code), false, 'nor ask which skin is on by another name');
  assert.equal(/from '\.\.\/ui\/enhancedNotice\.js'/.test(code), false, 'nor the enhanced panel itself');
  // the two it DOES stand on are the model's own, not a face's
  assert.match(code, /import \{ ActionTextBox \} from '\.\.\/ui\/actionText\.js';/);
});

test('ENH-NOTICE3 A: the Travel Options mod\'s MessageBox lines no longer collapse onto the HUD line', () => {
  const w = src('src/scenes/world.js');
  // THE BUG. `say` is AddHUDText and `messageBox` is
  // DaggerfallUI.MessageBox; this host wired both to townTalk.say, so
  // every arrival text and every refusal the mod raises as a modal
  // parchment printed as one fading HUD line.
  assert.match(w, /\n\s*say: \(line\) => townTalk\.say\(line\),\n/, 'the HUD-text dep stays what it is');
  assert.match(w, /\n\s*messageBox: \(line\) => messageBox\(line\),\n/, 'and the box dep names the box kind');
  assert.equal(/messageBox: \(line\) => townTalk\.say\(line\)/.test(w), false, 'the collapse is gone');
  // and the OTHER exterior host wires no Travel Options at all - the
  // journey is world.js's alone (?exterior loads one fixed city and
  // runs no streamer), so there is no second copy of this seam to fix.
  assert.equal(/travelOptions/.test(src('src/scenes/exterior.js')), false,
    'exterior.js does not wire Travel Options (nothing to migrate there)');
});

test('ENH-NOTICE3 B: every migrated host seam names the KIND and mints no window of its own', () => {
  // The six `messageBox:` deps, the two `showRecord:` deps, the
  // infection's shared factory and the town host's box door. Each is
  // sliced out of its own file and swept: it must call the seam, and
  // it must not build a window.
  const dep = (file, from, to) => {
    const s = src(file);
    const i = s.indexOf(from);
    assert.ok(i >= 0, `${file}: ${from} is gone - re-locate this pin before deleting it`);
    return s.slice(i, s.indexOf(to, i));
  };
  const seams = [
    // the enchantment/Azura seam, in all three hosts that build a ctx
    ['src/scenes/world.js', 'messageBox: (id) => {', 'openCharacterSheet:'],
    ['src/scenes/exterior.js', 'messageBox: (id) => {', 'openCharacterSheet:'],
    ['src/scenes/dungeonContext.js', 'messageBox: (id) => {', 'openCharacterSheet:'],
    // the quest/talk machine's box (AUDIT 63 F3's three arms)
    ['src/scenes/world.js', 'messageBox: (x) => {', 'pushTalkWindow:'],
    // the holiday text (AUDIT 64 F10), in both streaming hosts
    ['src/scenes/world.js', 'showRecord: (id) => {', '});'],
    ['src/scenes/exterior.js', 'showRecord: (id) => {', '});'],
    // the infection's "Death is not eternal", once for all four hosts
    ['src/scenes/shared.js', 'messageBox: (id) => {', 'clanOf:'],
    // the town host's own box door (the travel help's remaining caller)
    ['src/scenes/townTalk.js', 'showBox: (rows) =>', 'randomText:'],
  ];
  for (const [file, from, to] of seams) {
    const body = dep(file, from, to);
    assert.match(body, /\bmessageBox\(/, `${file} ${from}: must raise the box through the one door`);
    // AUDIT ENH-NOTICE3 (a survivor): `{ push: false }` at any of these
    // is the exact bug the slice fixed - the talk refusals and the
    // enchant seam DISPOSING the window they stand over.
    assert.equal(/push:\s*false/.test(body), false, `${file} ${from}: every DaggerfallUI.MessageBox is a PushWindow`);
    assert.equal(/new ChoiceWindow\(\{ lines/.test(body), false, `${file} ${from}: no hand-built ChoiceWindow`);
    assert.equal(/new ActionTextBox\(/.test(body), false, `${file} ${from}: no hand-built ActionTextBox`);
    assert.equal(/townTalk\.(showOverlay|pushOverlay|showBox)\(/.test(body), false, `${file} ${from}: no host window door`);
    assert.equal(/pushDungeonWindow\(|mountInterior\(/.test(body), false, `${file} ${from}: no host window door`);
  }
  // the infection factory no longer TAKES a per-host window either -
  // that dependency is what let four hosts drift apart (V5's
  // `TypeError: text is not iterable` was the last time).
  // DISC10-D V8 re-aim: the factory takes the host's REST slot now (cancelRest - DeployFullBlownVampirism closes the
  // rest window first, VampirismInfection.cs:152-154) - a host's slot, never a window it builds for the popup.
  assert.match(src('src/scenes/shared.js'),
    /export function wireInfectionVideos\(renderer, \{ textAt = null, factionDict = null, transferToCemetery = null, cancelRest = null \} = \{\}\)/);
  // Immersive Footsteps' compatibility warning is the same box, at
  // both of DFU's own raises (OnStartGame and OnLoad).
  const w = src('src/scenes/world.js');
  assert.equal((w.match(/reportModCompatibilityIssues\(\{ showText: \(lines\) => messageBox\(lines\) \}\)/g) ?? []).length, 2);
  // and DaggerfallAction's ShowText carries its null previousWindow
  // THROUGH the door rather than minting a box to hold it.
  assert.match(src('src/scenes/dungeonContext.js'), /messageBox\(lines, \{ previousWindow: false \}\);/);
});

// THE THREE PRESENTERS' OWN WIRING - which function each host hands
// over, at which priority, and the unregister the dungeon's teardown
// calls - is pinned in test/enhnotice3_hosts.test.js and is NOT
// repeated here: one law, one home, or the two copies drift. What is
// added below is the one thing those regexes cannot say, and it is a
// pin that MUST fail: none of them is line-anchored, so a
// registration commented OUT still matches its own pin
// (`// registerPresenter({ mount: (win) => showQuestOverlay(win),
// priority: 10 });` passes the wiring sweep word for word). A host
// that stops offering its slot is exactly the regression this arc
// exists to catch, so the registrations are pinned as LIVE CODE here.

test('ENH-NOTICE3: the three registrations are LIVE CODE, not commented-out lines', () => {
  assert.match(src('src/scenes/townTalk.js'), /^\s*registerPresenter\(\{$/m, 'townTalk (0)');
  assert.match(src('src/scenes/worldModes.js'), /^\s*registerPresenter\(\{ mount: \(win\) => showQuestOverlay\(win\), priority: 10 \}\);$/m, 'worldModes (10)');
  assert.match(src('src/scenes/dungeonContext.js'), /^\s*const _unregisterPresenter = registerPresenter\(\{$/m, 'dungeonContext (20)');
  assert.match(src('src/scenes/dungeonContext.js'), /^\s*_unregisterPresenter\(\);/m, 'and the teardown that takes it back');
});

// ── THE MOD, DRIVEN ──────────────────────────────────────────────────

/** TEST THE SHAPE THE PRODUCER MINTS: the mod's own Update loop with
 *  the host's two text deps as spies, so which DOOR each line goes
 *  through is read off the producer rather than asserted about it.
 *  (The rig is to1_travelOptions.test.js's, cut to the two paths this
 *  pin drives.) */
function travelRig(over = {}) {
  const state = {
    pos: { x: mapPixelWorldOrigin(500, 250).x + 16384, z: mapPixelWorldOrigin(500, 250).z + 16384 },
    pixel: { x: 500, y: 250 }, climate: 231, enemies: false, location: null,
  };
  const said = [], boxed = [];
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60 });
  const settings = readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut'
    ? key === 'Enabled'
    : modSetting(vendor, key)));
  const to = createTravelOptions({
    settings,
    ui,
    roads: () => ({ roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'basic-roads' }),
    worldPos: () => state.pos,
    mapPixel: () => state.pixel,
    yaw: () => 0,
    setFacing: () => {},
    currentLocation: () => state.location,
    hasCurrentLocation: () => !!state.location,
    localizedCurrentLocationName: () => '',
    localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => state.climate,
    entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }),
    enemiesNearby: () => state.enemies,
    diseaseCount: () => 0,
    say: (l) => said.push(l),
    messageBox: (l) => boxed.push(l),
    setTimeScale: () => {},
    now: () => 0,
    worldTimeNow: () => 0,
    roll100: () => 100,
    locationWorldRect: (s) => {
      const o = mapPixelWorldOrigin(s.pixel.x, s.pixel.y);
      return rectOf(o.x + 16000, o.z + 16000, 768, 768);
    },
    locationTileRect: () => null,
    ...over,
  });
  return { to, state, said, boxed };
}

test('ENH-NOTICE3 A: the mod sends its MessageBox lines to the messageBox dep, never to the HUD one', () => {
  // ARRIVAL - TravelOptionsMod's OnArrival raises
  // DaggerfallUI.MessageBox(MsgArrived).
  {
    const { to, state, said, boxed } = travelRig();
    to.beginTravel({ pixel: { x: 502, y: 250 }, name: 'Daggerfall', mapId: 199102 }, true);
    const o = mapPixelWorldOrigin(502, 250);
    state.pixel = { x: 502, y: 250 };
    state.pos = { x: o.x + 16100, z: o.z + 16100 };
    to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false });
    to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false });
    assert.deepEqual(boxed, [TRAVEL_OPTIONS_TEXT.MsgArrived], 'the arrival is a BOX');
    assert.deepEqual(said, [], 'and nothing of it went to the HUD line');
  }
  // REFUSAL - the enemies-nearby stop, StopTravelWithMessage
  // (TravelOptionsMod.cs:1187-1192).
  {
    const { to, state, said, boxed } = travelRig();
    to.beginTravel({ pixel: { x: 900, y: 250 }, name: 'Nowhere' }, false);
    state.enemies = true;
    assert.equal(to.update({ topWindowIsTravelUI: true }).stopped, 'enemies');
    assert.deepEqual(boxed, [TRAVEL_OPTIONS_TEXT.MsgEnemies], 'the refusal is a BOX too');
    assert.deepEqual(said, []);
  }
  // ...and the HUD kind still exists and is still the HUD kind: the
  // no-path line is AddHUDText in the mod and must not drift onto the
  // box door either.
  {
    const { to, said, boxed } = travelRig();
    to.followPath();
    assert.deepEqual(said, [TRAVEL_OPTIONS_TEXT.MsgNoPath], 'the no-path line is a HUD line');
    assert.deepEqual(boxed, []);
  }
});
