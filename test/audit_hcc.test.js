// AUDIT HCC (2026-09-23, Mac: "Let's do an audit on this, ensure online is handled properly and any new
// notifications or UI elements are enhancified"): three lenses over Horse Cart and Cargo - the online lane, the
// notifications and UI, the hosts' lifecycle - and the findings paid. The online lane's pins are in
// test/hcc_pool.test.js (O1-O9, by execution); the hosts' adjacency in test/hcc_hosts.test.js; the input box's
// enhanced window in test/enhancedNotice.test.js (ENH-NOTICE1). This file holds the rest: the keys, the save slot,
// the inventory's exit request, the live switch, the horse-name label and the prompt's face.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOD_SETTINGS, isTextKey, modSetting, _resetModSettings, KEY_MIGRATIONS } from '../src/systems/modSettings.js';
import { DEFAULT_BINDINGS } from '../src/systems/inputActions.js';
import { shortcutBinding } from '../src/systems/dialogShortcuts.js';
import { domCodeForKeyCode } from '../src/systems/keyCodes.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { openState, planWagonToggle } from '../src/systems/inventorySession.js';
import { STORAGE_CONTEXT } from '../src/systems/horseCartLaw.js';
import { createHorseCartPool, KEY_HORSE } from '../src/scenes/horseCartPool.js';
import { HorseNameTooltip, HORSE_TOOLTIP_Y } from '../src/ui/horseNameTooltip.js';
import { InputMessageBoxWindow, INPUT_BOX_HINT } from '../src/ui/inputMessageBox.js';
import { nativeMetrics } from '../src/ui/nativePanel.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const V = 'horse-cart-and-cargo';

test('AUDIT HCC K1: every vendored mod ships its keys where nothing else answers - DFU\'s bindings, its WORLD shortcuts (F10 is LargeHUDToggle, Shift-F10 HUDToggle), the browser\'s, and every other mod\'s (mutant: HCC back on F10 or F7)', () => {
  const bound = new Set(DEFAULT_BINDINGS.map(([code]) => code));
  // the DaggerfallShortcut rows a HOST answers in the world, not a window's (ui/hudShortcuts.js)
  const world = new Set(['LargeHUDToggle', 'HUDToggle', 'ToggleRetroPP', 'Pause'].map((b) => shortcutBinding(b).code));
  const browser = new Set(['F5', 'F6', 'F7', 'F11', 'F12']);   // reload, the address bar, caret browsing, full screen, the dev tools
  const seen = new Map();
  for (const [vendor, mod] of Object.entries(MOD_SETTINGS)) {
    for (const [key, def] of Object.entries(mod.keys)) {
      if (!isTextKey(def) || def.default === 'None') continue;
      const code = domCodeForKeyCode(def.default);
      if (!code) continue;   // a mod-internal name the port does not bind (a scroll axis)
      const who = `${vendor}/${key} (${def.default})`;
      assert.ok(!bound.has(code), `${who} is a key DFU's own bindings answer`);
      assert.ok(!world.has(code), `${who} is a key DFU's world shortcuts answer`);
      assert.ok(!browser.has(code), `${who} is a key the browser takes`);
      assert.ok(!seen.has(code), `${who} collides with ${seen.get(code)}`);
      seen.set(code, who);
    }
  }
  assert.equal(MOD_SETTINGS[V].keys['Hotkeys.QuickMountDismount'].default, 'Alpha5');
  assert.equal(MOD_SETTINGS[V].keys['Hotkeys.SummonTransport'].default, 'Alpha6');
});

test('AUDIT HCC K1: a mod-settings file that SAVED the first departure\'s F7 / F10 loses exactly those, once, on load (mutants: the migration skipped, so F10 still flips the HUD; a key the player chose taken too)', () => {
  const prevLs = globalThis.localStorage;
  const K = 'dfjs-mod-settings';
  try {
    let store = new Map();
    globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
    _resetModSettings();
    store.set(K, JSON.stringify({ [V]: { 'Hotkeys.QuickMountDismount': 'F7', 'Hotkeys.SummonTransport': 'F10', 'Following.HorseFollowDistance': 5 } }));
    assert.equal(modSetting(V, 'Hotkeys.QuickMountDismount'), 'Alpha5');
    assert.equal(modSetting(V, 'Hotkeys.SummonTransport'), 'Alpha6');
    assert.equal(modSetting(V, 'Following.HorseFollowDistance'), 5, 'every other choice is the player\'s');
    const written = JSON.parse(store.get(K))[V];
    assert.deepEqual(Object.keys(written), ['Following.HorseFollowDistance'], 'written back without the two');
    _resetModSettings();
    store = new Map([[K, JSON.stringify({ [V]: { 'Hotkeys.SummonTransport': 'Keypad5' } })]]);
    assert.equal(modSetting(V, 'Hotkeys.SummonTransport'), 'Keypad5', 'a key the player chose stays');
    assert.equal(KEY_MIGRATIONS.length, 3, 'the store\'s migrations: Handheld Torches\' F, and these two');
  } finally {
    _resetModSettings();
    if (prevLs === undefined) delete globalThis.localStorage; else globalThis.localStorage = prevLs;
  }
});

test('AUDIT HCC K4: a TextKey\'s capture has a clear that writes None (the controls pane\'s own control and class) - the capture alone could never disable one', () => {
  const menu = rd('src/ui/enhancedMenu.js');
  assert.match(menu, /const clear = el\('button', 'act ctl-clear', '\\u2715'\);[\s\S]{0,200}clear\.onclick = \(\) => \{ b\.textContent = setModSetting\(vendor, key, KEYCODE_NONE\); \};\n\s+ctl\.append\(b, clear\);/);
  for (const k of ['Hotkeys.QuickMountDismount', 'Hotkeys.SummonTransport']) {
    assert.doesNotMatch(MOD_SETTINGS[V].keys[k].description, /Enter a Unity KeyCode name/, `${k}: the note says the port's control, not the mod's text box`);
  }
});

test('AUDIT HCC H3: DFU\'s per-mod save data rides EVERY save - the envelope names it, round-trips it, and the dungeon\'s composer writes it (mutants: modData dropped from the options or the literal; the dungeon save without the record)', () => {
  const rec = { Version: 2, HorseName: 'Bess' };
  const entity = { name: 'Mac', gender: 'female', careerIndex: 4, level: 3, reflexes: 2, health: 22, maxHealth: 40, magicka: 15, maxMagicka: 30,
    startingLevelUpSkillSum: 90, currentLevelUpSkillSum: 120, readyToLevelUp: false, pendingLevel: null, chargenDone: true,
    stats: { strength: 55, luck: 60 }, skills: [30, 28], skillUses: [100, 0] };
  const snap = snapshotPlayer(entity, { modData: { [V]: rec }, locationKey: 'dungeon:42' });
  const extras = restorePlayer({}, JSON.parse(JSON.stringify(snap)));
  assert.deepEqual(extras.modData, { [V]: rec }, 'the record comes back from the slot, wherever the save was taken');
  assert.equal(restorePlayer({}, JSON.parse(JSON.stringify(snapshotPlayer(entity, {})))).modData, null, 'a save without it restores null - OnStartLoad\'s fresh start');
  const save = rd('src/systems/save.js');
  assert.match(save, /smallerDungeonsState = 0, modData = null \} = \{\}\) \{/);
  assert.match(save, /modData: snap\.modData \?\? null \};/);
  assert.match(rd('src/scenes/dungeonContext.js'), /modData: opts\.horseCartSave \? \{ 'horse-cart-and-cargo': opts\.horseCartSave\(\) \} : null,/);
  assert.match(rd('src/scenes/dungeonContext.js'), /opts\.horseCartLoad\?\.\(extras\.modData\?\.\['horse-cart-and-cargo'\] \?\? null\);[^\n]*\n\s+this\.restoreSaved\(extras, setPlayerPos\);/);
});

/** A stand-in runtime for the inventory's two questions. */
const rt = ({ normal = true, exit = true } = {}) => ({
  asked: [],
  consumeWagonSelectionRequest: () => false,
  canAccessWagonStorage(ctx) { this.asked.push(ctx); const ok = ctx === STORAGE_CONTEXT.DungeonExitSelection ? exit : normal; return { allowed: ok, denialMessage: ok ? '' : 'Your wagon is too far from the entrance.' }; },
});

test('AUDIT HCC I1: the exit request is IsPlayerInsideDungeon && allowDungeonWagonAccess [IL_abb8] - Eye Of The Beholder\'s cart outdoors asks the ordinary question and shows the wagon, never the entrance refusal (mutant: the flag alone read as an exit request)', () => {
  // outdoors, the EOTB cart's pack: the flag is up, the player is not in a dungeon
  const r1 = rt({ normal: true, exit: false });
  const o1 = openState({ horseCart: () => r1, dungeon: { wagonPrompt: true, inside: false } });
  assert.deepEqual(r1.asked, [STORAGE_CONTEXT.NormalInventory]);
  assert.equal(o1.refusal, undefined, 'no "too far from the entrance" on open ground');
  assert.equal(o1.usingWagon, true, 'DFU\'s own OnPush showed it, and the runtime allows it');
  assert.equal(o1.dungeonExitAccessGranted, false);
  // the same outdoors with the wagon out of reach: hidden, and silent (ApplyOpeningAccess boxes an EXIT refusal only)
  const o2 = openState({ horseCart: () => rt({ normal: false }), dungeon: { wagonPrompt: true, inside: false } });
  assert.equal(o2.usingWagon, false); assert.equal(o2.refusal, undefined);
  // inside a dungeon, the exit's Yes: the exit question, and its refusal boxed
  const r3 = rt({ exit: false });
  const o3 = openState({ horseCart: () => r3, dungeon: { wagonPrompt: true, inside: true } });
  assert.deepEqual(r3.asked, [STORAGE_CONTEXT.DungeonExitSelection]);
  assert.equal(o3.refusal?.text, 'Your wagon is too far from the entrance.');
  // granted: the wagon shows and the flag rides, so the wagon button asks the exit again (planWagonToggle)
  const o4 = openState({ horseCart: () => rt({ exit: true, normal: false }), dungeon: { wagonPrompt: true, inside: true } });
  assert.equal(o4.usingWagon, true); assert.equal(o4.dungeonExitAccessGranted, true); assert.equal(o4.mode, 'remove');
  const r5 = rt({ exit: true, normal: false });
  const back = planWagonToggle({ horseCart: () => r5, dungeon: { inside: true } }, { usingWagon: false, dungeonExitAccessGranted: true });
  assert.equal(back.ok, true, 'the granted exit is asked again, not the ordinary context that refuses it');
  // without the mod the classic ladder stands
  assert.deepEqual(openState({ dungeon: { wagonPrompt: true, inside: false } }).usingWagon, true);
});

test('AUDIT HCC I2: the ENHANCED pack takes the opening refusal as its notice and carries the granted flag into its session (mutants: either dropped - a silent pack, or "Access your wagon by activating the dungeon exit" after doing exactly that)', () => {
  const inv = rd('src/ui/enhancedInventory.js');
  assert.match(inv, /dungeonExitAccessGranted: !!open\.dungeonExitAccessGranted,/);
  assert.match(inv, /if \(open\.refusal\?\.text\) notice = open\.refusal\.text;\n\s+refresh\(\);\n\s+render\(\);/);
});

test('AUDIT HCC H4: the live switch turned off suspends the machine (its transients dropped, observing afresh on the way back) and says so once (mutants: the runtime kept observing a mode a disabled mod never saw)', () => {
  const calls = [];
  const pool = createHorseCartPool({ renderer: null, meshes: null, collider: () => null, onChanged: () => calls.push('changed') });
  pool.attach({ suspend: () => calls.push('suspend'), view: () => ({ state: { HorseName: '' } }), lateUpdate() {} });
  pool.setEnabled(false); pool.setEnabled(false);
  assert.deepEqual(calls.filter((c) => c === 'suspend'), ['suspend'], 'once, on the edge');
  assert.match(rd('src/systems/horseCart.js'), /function suspend\(\) \{ clearAllTransientState\(\); \}/);
});

test('AUDIT HCC U6: HorseNameTooltipController\'s label - the classic face is DFU\'s line at native y 112, centred; the pool answers my own horse within the mod\'s 3.2 and nothing else (mutants: a peer\'s horse named; the name from past the reach)', async () => {
  // the classic face (no document): one text draw at the label's own row
  const draws = [];
  const r = { drawScreenQuad: (...a) => draws.push(['quad', ...a]) };
  const font = { fnt: { glyphs: new Map(), height: 7 }, atlas: null };
  const tip = new HorseNameTooltip();
  tip.set('Bess');
  const canvas = { width: 1280, height: 800, clientWidth: 1280, clientHeight: 800 };
  try { tip.draw(r, canvas, font); } catch { /* the text helper wants a real atlas; the row is what is pinned */ }
  assert.equal(HORSE_TOOLTIP_Y, 112);
  const src = rd('src/ui/horseNameTooltip.js');
  assert.match(src, /drawText\(renderer, font, this\.text, m\.ox \+ x \* m\.s, m\.oy \+ HORSE_TOOLTIP_Y \* m\.s, m\.s, DEFAULT_TEXT_COLOR\);/);
  assert.ok(nativeMetrics(canvas).s > 0);
  // the pool's word: my horse's label within ACTIVATION_REACH, else ''
  const pool = createHorseCartPool({ renderer: null, meshes: null, collider: () => null });
  const horse = { isInteractive: true, position: [0, 0, 2], forward: [0, 0, 1], walk: { animationFrame: 0, walking: false } };
  pool.attach({ view: () => ({ state: { HorseName: 'Bess' }, horse, moving: null, deployed: null }), horseTargetLabel: 'Bess', lateUpdate() {} });
  const col = { raycast: () => Infinity, raycastHit: () => ({ dist: Infinity }) };
  assert.equal(pool.tooltipText([0, 1, 0], [0, 0, 1], col), 'Bess', 'looking at my horse two metres away');
  horse.position = [0, 0, 20];
  assert.equal(pool.tooltipText([0, 1, 0], [0, 0, 1], col), '', 'past the mod\'s 3.2: nothing');
  void KEY_HORSE;
  // the hosts gate it: outdoors, walking, IsPlayingGame, and only where the plaque is not already naming it
  assert.match(rd('src/scenes/world.js'), /const tipOn = hcc\.enabled && walkMode && _mode\(\) === 'exterior' && !worldPlaqueOn\(\) && !gamePaused\(\) && !pointerSurfaces\.size;/);
  assert.match(rd('src/ui/hud.js'), /if \(hudDrawn\) horseNameTooltip\.draw\(renderer, canvas, font\); else horseNameTooltip\.hide\(\);/);
});

test('AUDIT HCC U5: the input box\'s classic face is untouched - the parchment on the classic skin, the enhanced window only under the enhanced one, and its caption says what closes a FIELD', () => {
  assert.equal(INPUT_BOX_HINT, 'Enter to accept \u00b7 Escape to cancel');
  const box = new InputMessageBoxWindow({ label: 'Name your horse:', value: 'Bess', maxCharacters: 31 });
  assert.equal(box.entryText(), 'Name your horse:Bess_');
  const src = rd('src/ui/inputMessageBox.js');
  assert.match(src, /if \(isEnhanced\(\) && typeof document !== 'undefined'\) \{\n\s+if \(this\.done\) return;\n\s+drawEnhancedInputBox\(\{/);
  assert.match(src, /releaseEnhancedInputBox\(this\._faceKey\);/);
});
