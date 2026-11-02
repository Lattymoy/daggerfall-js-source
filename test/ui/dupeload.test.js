// DUPE-LOAD (2026-10-11, the exploit audit the owner asked for: "Can we look deep for duping"). F11 loaded the save
// from under ANY window outdoors (FIX-E read every overlay for the death screen's hint), and the load closed only the
// death screen - so the pack, a loot window or a counter stood over the loaded game still holding what it had taken off
// the old one, and its close handed that back: drop the purse on the ground, F11, close the pack - the restored purse
// and a pile of the same gold at your feet, every load. Two halves, each pinned: only the death screen loads from under
// (`loadsUnder`, asked by the world host's arm and routeKey's both), and a load takes every other window down through
// its own close BEFORE the save is read and before its first await (world.js closeWindowsForLoad).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { routeKey } from '../../src/ui/input.js';
import { DeathScreen } from '../../src/ui/deathScreen.js';
import { NativeTradeWindow } from '../../src/ui/native/nativeTrade.js';
import { ActionTextBox } from '../../src/ui/actionText.js';
import { createTownTalk } from '../../src/scenes/townTalk.js';
import { makeWindowStack } from '../../src/ui/windowStack.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const F11 = () => ({ key: 'F11', code: 'F11', shiftKey: false, target: null, preventDefault() {} });

test('DUPE-LOAD the death screen is the one window F11 loads from under - routeKey (the dungeon and interior hosts) refuses it under any other (mutants: the overlay test dropped; the marker off the death screen)', () => {
  assert.equal(new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8 }).loadsUnder, true, 'the death screen says so itself');
  let loads = 0;
  const ctx = { uiOverlayActive: true, overlayIsNative: false, overlayInput() {}, quickLoad: () => { loads++; } };
  for (const win of [null, {}, { isPack: true }, new NativeTradeWindow({ mode: 'Sell', icons: ICONS, entity: { items: [] }, shelfItems: () => [], packItems: () => [], accepts: () => true, gold: () => 0 })]) {
    ctx.overlayWindow = () => win;
    routeKey(F11(), ctx, null, new Set());
  }
  assert.equal(loads, 0, 'no load from under a pack, a counter or a host that names no window');
  ctx.overlayWindow = () => new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8 });
  assert.equal(routeKey(F11(), ctx, null, new Set()), true);
  assert.equal(loads, 1, 'the death screen\'s F11 still loads');
});

test('DUPE-LOAD the world host: its arm reads the death screen alone, every routeKey host names its window, and the load takes every other window down before the save is read and before its first await (mutants: the arm on any window; the close after the restore; the close behind the awaits)', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /if \(townTalk\.overlayActive && townTalk\.overlay\?\.loadsUnder === true && !isTextEntryTarget\(e\.target\) && \(modes\?\.mode \?\? 'exterior'\) === 'exterior' && codeMeans\(bindings\(\), e\.code, 'QuickLoad'\)/);
  const fn = w.indexOf('async function worldQuickLoad(');
  const noSnap = w.indexOf("if (!snap) { townTalk.say('No saved game.'); return; }", fn);
  const closed = w.indexOf('closeWindowsForLoad();', fn);
  const firstAwait = w.indexOf('await _magicRegistries', noSnap);   // AUDIT DUPE-LOAD: the await itself, never a comment's word
  const restore = w.indexOf('const extras = restorePlayer(playerEntity, snap, spellsByIndex);', fn);
  assert.ok(fn > 0 && noSnap > fn && closed > noSnap, 'the windows come down once a save is in hand');
  assert.ok(firstAwait > noSnap && closed < firstAwait && closed < restore, 'before the first await and before the restore');
  // AUDIT DUPE-LOAD: and once more after the last await, right before the restore - a window opened while the load waited
  const settled = w.indexOf('await modes?.transitionSettled?.();', fn);
  const again = w.indexOf('closeWindowsForLoad();', settled);
  assert.ok(settled > closed && again > settled && again < restore, 'closed again between the last await and the restore');
  assert.match(read('src/scenes/worldModes.js'), /overlayWindow: \(\) => interiorOverlay,/, 'the building\'s key context names its window for routeKey');
  assert.match(read('src/scenes/dungeonContext.js'), /overlayWindow: \(\) => activeOverlay,/, 'and the dungeon\'s');
});

test('DUPE-LOAD closeWindowsForLoad on the REAL street stack: a window over the slot is closed through its own close; under the death screen - a counter a box covered when the death took the top, a box pushed while it stands - everything is disposed and gone with no callback run, the death screen left for closeDeathScreen, and the restored pack is the save\'s alone (mutants: one window closed; the death screen closed too; the drain beneath skipped; a callback run)', () => {
  const w = read('src/scenes/world.js');
  const lift = (head) => { const at = w.indexOf(head); return w.slice(at, w.indexOf('\n  }\n', at) + 4); };
  const make = (tt, modes = null) => new Function('townTalk', 'DeathScreen', 'modes', `${lift('function closeWindowsForLoad() {')}${lift('function closeDeathScreen() {')}; return { closeWindowsForLoad, closeDeathScreen };`)(tt, DeathScreen, modes);
  const town = () => createTownTalk({ renderer: {}, canvas: { width: 320, height: 200 }, fetchBytes: async () => { throw new Error('no data'); }, playerEntity: { name: 'P', stats: {} }, regionIndex: 0 });
  // a window over the slot (the pause pane's Load): closed through its own close, its callback run
  const t1 = town();
  let closedCb = 0;
  t1.showOverlay(new ActionTextBox(['the pause']), () => { closedCb++; });
  t1.pushOverlay(new ActionTextBox(['a box over it']), () => { closedCb++; });
  make(t1).closeWindowsForLoad();
  assert.equal(t1.overlay, null, 'the slot empty - the box and the window under it');
  assert.equal(closedCb, 2, 'each through its own close');
  // under the death screen: the real shape - a counter staging a dagger, a box over it, the death taking the top
  const ent = { name: 'Dup', level: 1, stats: {}, skills: {}, goldPieces: 0, items: [{ group: 'Weapons', templateIndex: 113, name: 'Dagger', stackCount: 1, value: 30 }] };
  const save = JSON.parse(JSON.stringify(snapshotPlayer(ent)));
  const t2 = town();
  const counter = new NativeTradeWindow({ mode: 'Sell', icons: ICONS, entity: ent, shelfItems: () => [], packItems: () => (ent.items ??= []), accepts: () => true, gold: () => ent.goldPieces });
  let counterCb = 0;
  t2.showOverlay(counter, () => { counterCb++; });
  counter._pickLocal(0);
  t2.pushOverlay(new ActionTextBox(['You collapse from exhaustion.']));
  const death = new DeathScreen({ eyeHeight: 1.6, capsuleHeight: 1.8, entity: ent });
  t2.showOverlay(death);
  const late = new ActionTextBox(['a box pushed while dead']);
  t2.pushOverlay(late);
  assert.ok(t2.overlay === death && t2.containsOverlay(counter) && t2.containsOverlay(late), 'the counter and a box wait beneath the death screen');
  const { closeWindowsForLoad, closeDeathScreen } = make(t2);
  closeWindowsForLoad();
  assert.ok(t2.overlay === death && !t2.containsOverlay(counter) && !t2.containsOverlay(late), 'only the death screen stands');
  assert.equal(counterCb, 0, 'no callback of a window the load replaces runs');
  assert.equal(counter.done, true, 'and the counter disposed - its own close, on the game the load replaces (its art freed: every allocation has an owner)');
  restorePlayer(ent, JSON.parse(JSON.stringify(save)), null);
  closeDeathScreen();
  assert.equal(t2.overlay, null, 'nothing uncovered over the loaded game');
  assert.deepEqual(ent.items.map((i) => i.name), ['Dagger'], 'the save\'s one dagger - the counter\'s close handed nothing to the loaded pack');
  // the modes drain their own
  let asked = 0;
  make(town(), { discardBeneathDeath: () => { asked++; } }).closeWindowsForLoad();
  assert.equal(asked, 1, 'the building\'s and the dungeon\'s stacks are asked too');
});

test('AUDIT DUPE-LOAD the building\'s and the dungeon\'s drains: windowStack.keepOnly leaves the one kept and disposes the rest top first; each mode host reconciles its hand-filled slot and keeps the death screen; the dungeon\'s own load drains before its restore (mutants: keepOnly keeps nothing; the reconcile skipped; the dungeon drain after the restore)', () => {
  const stack = makeWindowStack();
  const dropped = [];
  const win = (name) => ({ name, dispose() { dropped.push(name); } });
  const [a, b, d] = [win('counter'), win('box'), { name: 'death', holdsTop: true }];
  stack.pushWindow(a); stack.pushWindow(b); stack.reconcile(d);
  stack.keepOnly(d, (w) => w.dispose?.());
  assert.equal(stack.topWindow(), d);
  assert.equal(stack.windowCount(), 1, 'the death screen alone');
  assert.deepEqual(dropped, ['counter'], 'the counter disposed (the box the death replaced was gone already)');
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /discardBeneathDeath\(\) \{\n\s*if \(mode === 'dungeon'\) \{ dungeonCtx\?\.discardBeneathDeath\?\.\(\); return; \}\n\s*const death = interiorOverlay;\n\s*if \(!\(death instanceof DeathScreen\)\) return;\n\s*interiorWindows\.reconcile\(death\);\n\s*interiorWindows\.keepOnly\(death, \(w\) => w\.dispose\?\.\(\)\);/);
  const dc = read('src/scenes/dungeonContext.js');
  assert.match(dc, /discardBeneathDeath\(\) \{\n\s*const death = activeOverlay;\n\s*if \(!\(death instanceof DeathScreen\)\) return;\n\s*dungeonWindows\.reconcile\(death\);\n\s*dungeonWindows\.keepOnly\(death, \(w\) => w\.dispose\?\.\(\)\);/);
  const ql = dc.slice(dc.indexOf('    quickLoad(setPlayerPos, key = null) {'));
  assert.ok(ql.indexOf('this.discardBeneathDeath();') > 0 && ql.indexOf('this.discardBeneathDeath();') < ql.indexOf('const extras = restorePlayer('), 'the dungeon\'s own load drains before it restores');
});

test('DUPE-LOAD the hazard the order closes, on the real counter: goods staged on a Sell counter and the save restored - closed BEFORE the restore the pack is the save\'s, closed after it the goods come back on top (the control: why the close must come first)', () => {
  const dagger = () => ({ group: 'Weapons', templateIndex: 113, name: 'Dagger', stackCount: 1, value: 30 });
  const counter = (entity) => new NativeTradeWindow({ mode: 'Sell', icons: ICONS, entity, shelfItems: () => [], packItems: () => (entity.items ??= []), accepts: () => true, gold: () => entity.goldPieces });
  const fresh = () => ({ name: 'Dup', level: 1, stats: {}, skills: {}, goldPieces: 0, items: [dagger()] });
  // the fix's order: the window down (townTalk.closeOverlay -> dispose -> its own close), then the restore
  const a = fresh();
  const save = JSON.parse(JSON.stringify(snapshotPlayer(a)));
  const wa = counter(a);
  wa._pickLocal(0);
  assert.equal(a.items.length, 0, 'staged: off the pack at the click');
  wa.dispose();
  restorePlayer(a, JSON.parse(JSON.stringify(save)), null);
  assert.deepEqual(a.items.map((i) => i.name), ['Dagger'], 'one dagger - the save\'s');
  // the old order: the restore under the open counter, the close after it
  const b = fresh();
  const wb = counter(b);
  wb._pickLocal(0);
  restorePlayer(b, JSON.parse(JSON.stringify(save)), null);
  wb.dispose();
  assert.deepEqual(b.items.map((i) => i.name), ['Dagger', 'Dagger'], 'the dupe the old order made');
});
