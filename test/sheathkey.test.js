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
  assert.ok(POLLED_ACTIONS.has('ReadyWeapon'));
  assert.equal(POLLED_ACTIONS.size, 1, 'one polled action today; a second joins here, not in a host');
});

test('SHEATH: every host polls ReadyWeapon on an edge, and the dungeon hosts route keys through routeKey', () => {
  // The two halves that make the double-fire possible, pinned as the
  // shape they are: the poll is in every host (it stays), and the two
  // dungeon keydown listeners go through routeKey (they stay). The
  // decline in routeKey is what keeps them from adding up.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/worldModes.js', 'src/scenes/dungeon.js']) {
    assert.match(read(f), /held\(keys, 'ReadyWeapon'\)/, `${f} polls ReadyWeapon`);
  }
  assert.match(read('src/scenes/worldModes.js'), /routeKey\(e, dungeonCtx/);
  assert.match(read('src/scenes/dungeon.js'), /routeKey\(e, ctx/);
  assert.match(read('src/scenes/dungeonContext.js'), /toggleSheath: weaponRig\.toggleSheath/, 'the dungeon ctx carries the door (for the panel)');
  assert.match(read('src/ui/input.js'), /if \(POLLED_ACTIONS\.has\(act\)\) return false;/, 'and routeKey declines it');
});
