// ---------------------------------------------------------------------------
// MAC-C - THE TWO WINDOW KEYS (2026-09-17, Mac: "you can exit out of the F6
// menu (inventory) by pressing F6 again, but you cannot do the same for the
// F5 one (char sheet)" + "it would be extra cool if you could like, be on
// the F5 page, press F6 and then go straight from char sheet to inv.,
// instead of having to exit out of one menu and go into another").
//
// TWO FAULTS, ONE ROOT. The pack's key arm read `e.key !== 'F6'` - the DFU
// DEFAULT spelled as a literal - and the sheet had no key arm at all,
// because PX27 made the enhanced sheet the pause window's Stats page and
// `enhancedMenu`'s capture handler answers exactly one key: Escape, the
// back stack's. That is right for the pause face it shares (F5 must not
// close a paused game), which is why the arm belongs on the OVERLAY F5
// opened rather than in the screen it happens to wear.
//
// The literal is the same bug I2 and FIX-F each found once already: a
// player who rebinds Inventory gets a pack that opens on their key and
// closes on Bethesda's. Both keys come off the REGISTRY now, in all three
// windows that answer them (the enhanced pack, the enhanced sheet page,
// and the classic canvas sheet).
//
// And the cross-over is the same law read sideways: a window key that
// names ANOTHER window closes this one and opens that one, in that order,
// because `showOverlay` REPLACES the host's single slot. The sheet already
// had the door (its own Items button); the pack needed one, so every host
// hands it the same `openCharSheet` it already hands `openSpellbook`.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setBindings } from '../src/ui/input.js';
import { createBindings, resetDefaults, setBinding } from '../src/systems/inputActions.js';
import { CharSheet } from '../src/ui/charsheet.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const defaults = () => { const b = createBindings(); resetDefaults(b); return b; };

test('MAC-C: the classic sheet closes on the BOUND sheet key, not on the literal F5', () => {
  setBindings(defaults());
  const entity = { name: 'Mac', skills: {}, stats: {}, level: 1 };
  const sheet = new CharSheet(entity, {});
  assert.equal(sheet.done, false);
  sheet.input('F5');
  assert.equal(sheet.done, true, 'the default still closes it');

  // ...and a REBIND moves the key with it, which the literal could not.
  const b = defaults();
  setBinding(b, 'KeyP', 'CharacterSheet', true);
  setBindings(b);
  const rebound = new CharSheet(entity, {});
  rebound.input('F5');
  assert.equal(rebound.done, false, 'F5 is nobody’s key now');
  rebound.input('KeyP');
  assert.equal(rebound.done, true, 'and the player’s key closes their sheet');
});

test('MAC-C: the classic sheet CROSSES OVER to the pack, and only with a door', () => {
  setBindings(defaults());
  const entity = { name: 'Mac', skills: {}, stats: {}, level: 1 };
  let opened = 0;
  const sheet = new CharSheet(entity, { inventory: () => { opened++; } });
  sheet.input('F6');
  assert.equal(opened, 1, 'the pack key opened the pack');
  assert.equal(sheet.done, true, '...and closed the sheet first');

  // a host that hands no pack gets a key that falls through - the same
  // honest refusal the sheet's own Items button gives.
  const noDoor = new CharSheet(entity, {});
  noDoor.input('F6');
  assert.equal(noDoor.done, false, 'no door, no key');
});

test('MAC-C: the enhanced pack reads the registry for BOTH keys', () => {
  const s = rd('src/ui/enhancedInventory.js');
  // the CODE, not the note above it - the header quotes the retired
  // line by name, and a history that cannot be written down is a
  // history nobody reads.
  const code = s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.ok(!/e\.key !== 'F6'/.test(code), 'the literal is gone');
  assert.match(s, /const act = actionOf\(e\);/, 'the registry answers');
  assert.match(s, /act !== 'Inventory'\) return;/, 'the pack closes on ITS action');
  assert.match(s, /if \(act === 'CharacterSheet' && typeof deps\?\.openCharSheet === 'function'\)/, 'and crosses over on the other (JAN1: a function, asked for as one)');
  // the ORDER is the thing: the pack's own close law runs before the
  // slot is taken, or the sheet mounts under a window about to close.
  const arm = s.slice(s.indexOf("if (act === 'CharacterSheet'"));
  assert.ok(arm.indexOf('const openCharSheet = deps.openCharSheet;') < arm.indexOf('onExit();') && arm.indexOf('onExit();') < arm.indexOf('\n    openCharSheet();'),
    'the hook read, then close FIRST, then replace the slot - showOverlay is a replace, not a push (JAN1: the close empties the bag the hook lived in)');
});

test('MAC-C: the enhanced sheet page has a key of its own, and gives it back', () => {
  const s = rd('src/ui/charSheetDoor.js');
  assert.match(s, /const act = actionOf\(e\);/, 'the registry answers here too');
  assert.match(s, /if \(act !== 'CharacterSheet' && !\(act === 'Inventory' && hooks\.inventory\)\) return;/,
    'the sheet closes on its own key and crosses over on the pack’s, and claims nothing else');
  assert.match(s, /globalThis\.addEventListener\?\.\('keydown', onSheetKey, true\)/,
    'on CAPTURE - a modal overlay owns its input - and OPTIONAL, because node drives these hosts headless');
  assert.match(s, /globalThis\.removeEventListener\?\.\('keydown', onSheetKey, true\)/,
    'EVERY LISTENER HAS AN OWNER: an orphan capture handler would eat F5 for the life of the page');
  // the handler is hoisted, because `close` names it and registerOverlay
  // is handed `close` before the declaration is reached (PX28's hazard).
  assert.match(s, /function onSheetKey\(e\) \{/, 'a function declaration, not a const in its own dead zone');
});

test('MAC-C: every host hands the pack a sheet door, beside the spellbook one it already had', () => {
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeonContext.js']) {
    const s = rd(f);
    assert.match(s, /openCharSheet: \(\) =>/, `${f}: the pack can reach the sheet`);
    // it stands with openSpellbook, which is the hook it is modelled on -
    // a door added anywhere else is a second bag by another name.
    const at = s.indexOf('openCharSheet: () =>');
    const near = s.slice(Math.max(0, at - 400), at);
    assert.match(near, /openSpellbook:/, `${f}: it belongs in the ONE builder's bag`);
  }
  // ...and the dungeon's sheet has ONE construction, which the toggle and
  // the cross-over both call (U52's argument, applied to the host that
  // still had the builder inline).
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /makeCharSheet\(\) \{/, 'the builder is lifted out');
  assert.equal((dc.match(/createCharSheetWindow\(\{/g) ?? []).length, 1, 'and there is exactly one of it');
  assert.match(dc, /activeOverlay = api\.makeCharSheet\(\);/, 'the toggle calls it');
});
