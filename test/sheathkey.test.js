// THE Z KEY IN A DUNGEON (2026-08-27, Mac's report: "cannot
// sheath/unsheath in dungeons").
//
// ReadyWeapon is polled by every host's frame on an edge
// (WeaponManager.Update:284 - not GameManager's dispatch chain). U45
// gave routeAction a ReadyWeapon arm for the large HUD's sheath panel,
// and from that commit the keyboard reached the same arm through
// routeKey in the two dungeon contexts (the only ctxs carrying
// toggleSheath): one press, two toggles, net nothing. These pins hold
// the keyboard OFF the polled action and the panel ON it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { routeKey, routeAction, POLLED_ACTIONS, setBindings } from '../src/ui/input.js';
import { createBindings, resetDefaults } from '../src/systems/inputActions.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

function dungeonLikeCtx() {
  let sheathed = true;
  return {
    uiOverlayActive: false,
    toggleSheath: () => { sheathed = !sheathed; },
    get sheathed() { return sheathed; },
  };
}

test('SHEATH: a Z press through the keyboard dispatch does NOT toggle - the frame poll owns it', () => {
  const b = createBindings(); resetDefaults(b); setBindings(b);
  const ctx = dungeonLikeCtx();
  // What the dungeon hosts do on keydown, then on the frame's edge.
  const consumed = routeKey({ code: 'KeyZ', key: 'z' }, ctx);
  assert.equal(consumed, false, 'routeKey declines the polled action (no preventDefault, nothing fired)');
  assert.equal(ctx.sheathed, true, 'keydown left the weapon alone');
  // The frame's edge, as every host runs it: one toggle per press.
  ctx.toggleSheath();
  assert.equal(ctx.sheathed, false, 'ONE press drew the weapon');
  setBindings(null);
});

test('SHEATH: the large HUD panel still reaches the door through routeAction', () => {
  const ctx = dungeonLikeCtx();
  assert.equal(routeAction('ReadyWeapon', ctx), true);
  assert.equal(ctx.sheathed, false, 'the panel toggled it once');
  // AUDIT 58 (f2/hosts): and the arm is HONEST about a ctx without the
  // door - it reports false, which is the whole reason a host missing
  // toggleSheath was silent rather than broken. This half of the pin
  // was the vacuous one: it drove the arm against dungeonLikeCtx()
  // alone, the one shape that already carried the door.
  assert.equal(routeAction('ReadyWeapon', { uiOverlayActive: false }), false,
    'no door on the ctx, no answer - the panel click is consumed by the BAR and nothing happens');
  assert.ok(POLLED_ACTIONS.has('ReadyWeapon'));
  // a12 MOVED THIS PIN, deliberately: SwitchHand is the second polled
  // action the comment invited. WeaponManager.Update reads it at :272,
  // one line above the equip-countdown block and two below ReadyWeapon
  // - the same frame, the same "not GameManager's chain" - and no
  // routeAction arm answers it, so routeKey must decline it too.
  assert.ok(POLLED_ACTIONS.has('SwitchHand'));
  assert.equal(POLLED_ACTIONS.size, 2, 'two polled actions; a third joins here, not in a host');
  assert.equal(routeAction('SwitchHand', ctx), false, 'no panel door - the frame poll is the only one');
});

test('SHEATH: every host polls ReadyWeapon on an edge, and the dungeon hosts route keys through routeKey', () => {
  // The two halves that make the double-fire possible, pinned as the
  // shape they are: the poll is in every host (it stays), and the two
  // dungeon keydown listeners go through routeKey (they stay). The
  // decline in routeKey is what keeps them from adding up.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeon.js']) {
    assert.match(read(f), /held\(keys, 'ReadyWeapon'\)/, `${f} polls ReadyWeapon`);
    // a12: and SwitchHand beside it, on the INVERTED latch -
    // ActionComplete is the release (InputManager.cs:634-637), where
    // ReadyWeapon's ActionStarted is the press.
    assert.match(read(f), /held\(keys, 'SwitchHand'\)/, `${f} polls SwitchHand`);
    assert.match(read(f), /if \(!hNow[W]? && hPrev[W]?\)/, `${f} switches the hand on the RELEASE edge`);
  }
  assert.match(read('src/scenes/worldModes.js'), /routeKey\(e, dungeonCtx/);
  assert.match(read('src/scenes/dungeon.js'), /routeKey\(e, ctx/);
  assert.match(read('src/scenes/dungeonContext.js'), /toggleSheath: weaponRig\.toggleSheath/, 'the dungeon ctx carries the door (for the panel)');
  assert.match(read('src/scenes/dungeonContext.js'), /switchHand: weaponRig\.switchHand/, 'a12: and the hand door, for the two dungeon hosts');
  assert.match(read('src/ui/input.js'), /if \(POLLED_ACTIONS\.has\(act\)\) return false;/, 'and routeKey declines it');
});

// AUDIT 58 (f2/hosts): THE PANEL'S DOOR IN ALL FOUR HOSTS. HUDLarge.cs
// :477-484's SheathPanel_OnMouseClick calls
// GameManager.Instance.WeaponManager.ToggleSheath() - a singleton, no
// scene gate, registered for both buttons at :211-212 - so the panel is
// live on every screen the large HUD is drawn on. Only the dungeon ctx
// carried `toggleSheath`, so a click on the sheath rect above ground, in
// ?exterior, or inside a building was eaten by routeLargeHudClick's
// unconditional `return true` and did nothing, while Z worked in all
// four. The sweep is over each ctx OBJECT's own span, not the file, so a
// frame poll's `weaponRig.toggleSheath()` cannot stand in for the door.
test('SHEATH: every ctx the large HUD is handed carries the panel\u2019s door (THE FOUR HOSTS RULE)', () => {
  const CTXS = [
    ['src/scenes/world.js', 'const hudCtx = {', /^  \};/m, /^    toggleSheath: \(\) => weaponRig\.toggleSheath\(\),$/m],
    ['src/scenes/exterior.js', 'const hudCtx = {', /^  \};/m, /^    toggleSheath: \(\) => weaponRig\.toggleSheath\(\),$/m],
    ['src/scenes/worldModes.js', 'const interiorKeyCtx = {', /^  \};/m, /^    toggleSheath\(\) \{ interiorWeapon\.toggleSheath\(\); \},$/m],
  ];
  for (const [file, head, end, member] of CTXS) {
    const src = read(file);
    const from = src.indexOf(head);
    assert.ok(from > 0, `${file} still declares ${head}`);
    const rest = src.slice(from);
    const to = rest.search(end);
    assert.ok(to > 0, `${file}: the ctx literal closes`);
    assert.match(rest.slice(0, to), member, `${file}: the sheath panel's door is ON the ctx, not only in the frame poll`);
  }
  // the fourth is the one that always had it
  assert.match(read('src/scenes/dungeonContext.js'), /^    toggleSheath: weaponRig\.toggleSheath,$/m,
    'the dungeon ctx keeps the door it has carried since U45');
  // and the panel is still the eleventh panel, still posting the action
  assert.match(read('src/ui/hudLarge.js'), /\{ key: 'sheath', rect: LARGE_HUD_RECTS\.sheath, action: 'ReadyWeapon' \}/);
  assert.match(read('src/ui/input.js'), /case 'ReadyWeapon': return ctx\.toggleSheath \? \(ctx\.toggleSheath\(\), true\) : false;/);
});
