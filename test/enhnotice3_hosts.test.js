// ENH-NOTICE3 (2026-09-21, Mac: "I do notice the new enhanced pop up
// system isn't working for everything. All mods, including climates
// and calories need to utilize the enhanced notification popup. This
// needs a proper detailed audit, maybe a refactor"): THE HOSTS OFFER
// THEIR SLOTS TO THE ONE DOOR.
//
// systems/notify.js is DaggerfallUI's static door (MessageBox,
// AddHUDText) written once; a box reaches a host's slot only through
// a PRESENTER the host registers. The seam's own laws are pinned in
// test/notify.test.js; these are the WIRING pins - by source, because
// a town host, a mode machine and a dungeon context are built over a
// renderer, a canvas and a location, and the claim here is which
// function each hands over and in what order they are asked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('ENH-NOTICE3: three presenters, asked dungeon (20) before the modal modes (10) before the outdoor slot (0) - the showQuestBox ladder, written once', () => {
  const town = rd('src/scenes/townTalk.js');
  const modes = rd('src/scenes/worldModes.js');
  const dungeon = rd('src/scenes/dungeonContext.js');
  for (const [name, src] of [['townTalk', town], ['worldModes', modes], ['dungeonContext', dungeon]]) {
    assert.match(src, /import \{[^}]*\bregisterPresenter\b[^}]*\} from '\.\.\/systems\/notify\.js';/, `${name}: the seam not imported`);
  }
  // townTalk: the outdoor slot. A push is pushOverlay (the box lands
  // over what is open - ROAD-B B5's law for every DaggerfallUI
  // .MessageBox); a replace is showOverlay (the dispatching door);
  // and the town's own PopupText is its hudText.
  assert.match(town, /\n  registerPresenter\(\{\n    mount: \(win, \{ push \}\) => \{ if \(push\) return pushOverlay\(win\); showOverlay\(win\); return true; \},\n    hudText: \(line, delayInSeconds\) => \{ hud\.add\(line, delayInSeconds\); return true; \},\n    priority: 0,\n  \}\);/,
    'mutants: townTalk registers nothing (a box with no modal host up is dropped - the silent-first-ten-minutes failure); push routed to showOverlay (a quest box replaces the rest it lands on); the delay dropped from hudText (a mod\'s textDisplayTime ignored); a priority above the modal hosts (the street takes a box raised inside a building)');
  // worldModes: the modal modes' slot, through the hoisted
  // showQuestOverlay - interior mounts (a push), dungeon hands to the
  // context, exterior refuses so the box falls to townTalk.
  assert.match(modes, /function showQuestOverlay\(win\) \{\n    if \(mode === 'interior'\) \{ mountInterior\(win\); return true; \}\n    if \(mode === 'dungeon' && dungeonCtx\?\.showOverlay\) return dungeonCtx\.showOverlay\(win\);\n    return false;\n  \}/,
    'mutants: the exterior arm answering true (a box swallowed above ground with nothing to draw it); the interior arm refusing');
  assert.match(modes, /\n  registerPresenter\(\{ mount: \(win\) => showQuestOverlay\(win\), priority: 10 \}\);/,
    'mutants: worldModes registers nothing (a box raised inside a building goes to the street slot); a priority at or above the dungeon context\'s');
  assert.match(modes, /    showQuestOverlay,\n/, 'the quest machine\'s own door is the same function, not a second copy');
  // dungeonContext: its window stack and its PopupText, in front of
  // both, for as long as the context stands.
  assert.match(dungeon, /\n  let _live = false;\n  const _unregisterPresenter = registerPresenter\(\{\n    mount: \(win\) => pushDungeonWindow\(win\),\n    hudText: \(line, delayInSeconds\) => \{ hudText\.add\(line, delayInSeconds\); return true; \},\n    active: \(\) => _live && !_ctxDead,\n    priority: 20,\n  \}\);/,
    'mutants: the dungeon registers nothing (on ?dungeon, which has no townTalk and no worldModes, every box falls to the HUD line); its mount the one-slot write instead of the push door (a box under an open window swallowed - ROAD-B B5); a priority below worldModes\'; `active` dropped (AUDIT ENH-NOTICE3 F1: a half-built dungeon takes boxes into a stack nothing draws yet)');
  // AUDIT ENH-NOTICE3 F1: NOT LIVE UNTIL ADOPTED - the two hosts that
  // adopt a context say so, after their own adoption and not before.
  assert.match(dungeon, /\n    goLive\(\) \{ _live = true; \},/, 'the adoption door');
  // ...BEFORE the flip and adjacent to it (re-audit C1): worldModes'
  // own quest door reaches the same stack the moment `mode` reads
  // 'dungeon' and reads no `_live`, so no statement may run between
  // the flip and the adoption - the adoption comes first.
  assert.match(modes, /\n      ctx\.goLive\?\.\(\);[^\n]*\n      mode = 'dungeon';\n/, 'mutants: worldModes never adopts (every dungeon box falls to the street for the whole visit); adopts after the flip (a gap the quest door can land a box in)');
  // A PIN MUST FAIL (re-audit C11): exactly ONE adoption call in the
  // mode machine and exactly ONE write of `_live` in the context - a
  // second `goLive` before the build's awaits, or a `_live = true`
  // after the registration, re-opens F1 with every shape pin green.
  assert.equal((modes.match(/ctx\.goLive\?\.\(\);/g) ?? []).length, 1, 'mutant: a second adoption, before the awaits');
  assert.equal((dungeon.match(/_live = true/g) ?? []).length, 1, 'mutant: `_live = true` written somewhere other than goLive');
  assert.equal((dungeon.match(/let _live = false;/g) ?? []).length, 1);
  // re-audit C3: the dead latch is declared ABOVE its first reader -
  // a `let` is dead until its line runs, and pushDungeonWindow reads it
  const latchAt = dungeon.indexOf('let _ctxDead = false;');
  assert.ok(latchAt >= 0, 'mutant: the latch declaration gone (the door reads a free variable)');
  assert.ok(latchAt < dungeon.indexOf('function pushDungeonWindow(win) {'),
    'mutant: the latch declared below the door, so a call from inside the build throws instead of refusing');
  // A3 (the toasts lane): the interior slot's font-less arm DISPOSES
  // the occupant it drops - an enhanced DOM window needs no classic
  // font to mount, and its held panel has no watchdog
  assert.match(modes, /else \{ interiorOverlay\.dispose\?\.\(\); interiorOverlay = null; \}/,
    'mutant: the font-less arm nulls the slot without dispose, so the tavern\'s held panel, its full-screen host and its capture listener outlive the drop');
  assert.match(rd('src/scenes/dungeon.js'), /\n  \);\n  ctx\.goLive\?\.\(\);/, 'the standalone host adopts after its await');
  // AUDIT ENH-NOTICE3 F2: THE DEAD LATCH IS THE REFUSAL. destroy()
  // unregisters, but worldModes' showQuestOverlay is a second door into
  // the same stack and the host nulls its handle only after destroy()
  // returns - so pushDungeonWindow itself refuses once dead, and both
  // doors fall to the host that stands.
  assert.match(dungeon, /function pushDungeonWindow\(win\) \{\n    if \(!win\) return false;\n(?:    \/\/[^\n]*\n)*    if \(_ctxDead\) return false;\n/,
    'mutant: the dead guard dropped, so a box raised while the context is torn down lands on a stack nobody draws');
  assert.match(dungeon, /destroy\(\) \{\n      _ctxDead = true;[^\n]*\n      _unregisterPresenter\(\);/,
    'mutant: the unregister dropped (a torn-down dungeon stays in the registry; harmless only while its active() reads the latch)');
});

test('ENH-NOTICE3 (AUDIT F5): the showQuestBox ladder has ONE home - systems/notify.js mountWindow - and neither outer host writes it by hand', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(f);
    assert.match(s, /\n    mountWindow\(win\);/, `${f}: the quest box rides the door's ladder`);
    assert.equal(/showQuestOverlay\?\.\(win\)\) return;\s*\n(?:\s*\/\/[^\n]*\n)*\s*townTalk\.pushOverlay\(win\);/.test(s), false,
      `${f}: mutant - the two-rung ladder written back by hand, a second home the door's order does not reach`);
  }
  const notify = rd('src/systems/notify.js');
  assert.match(notify, /export function mountWindow\(win, \{ push = true \} = \{\}\) \{/);
  assert.match(notify, /  if \(mountWindow\(win, \{ push \}\)\) return handle;/, 'and messageBox itself walks the same ladder - one order for every window');
});

test('ENH-NOTICE3: the seam is imported where the hosts build their deps, and nothing under src/systems or src/mods builds a window', () => {
  // A mod names the KIND (DaggerfallUI.MessageBox / AddHUDText) and
  // never the window: the port's mod modules take `messageBox` /
  // `say` deps from their host and construct nothing themselves.
  const dirs = ['src/systems', ...(existsSync(new URL('../src/mods', import.meta.url)) ? ['src/mods'] : [])];
  const offenders = [];
  for (const d of dirs) {
    for (const f of readdirSync(new URL(`../${d}/`, import.meta.url)).filter((f) => f.endsWith('.js'))) {
      if (f === 'notify.js') continue;
      const src = rd(`${d}/${f}`);
      if (/from '\.\.\/ui\/actionText\.js'|from '\.\.\/ui\/talkWindow\.js'/.test(src)) offenders.push(`${d}/${f}`);
    }
  }
  assert.deepEqual(offenders, [], 'a system or a mod module importing a box class is a producer naming the window - it must name the kind through the host\'s deps (or systems/notify.js)');
  // ...and notify.js itself never forks on the skin: the face is the
  // draw's decision (ui/actionText.js, ui/hudText.js), not the door's.
  const notify = rd('src/systems/notify.js');
  assert.doesNotMatch(notify, /from '\.\/uiSkin\.js'|isEnhanced\(/, 'mutant: a skin fork in the door - a second home for the skin decision');
  assert.match(notify, /import \{ ActionTextBox \} from '\.\.\/ui\/actionText\.js';/, 'the one box class, the port\'s home for DaggerfallUI.MessageBox');
});
