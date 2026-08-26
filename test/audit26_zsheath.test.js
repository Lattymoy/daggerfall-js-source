// PRESSING Z MUST RAISE OR SHEATHE THE WEAPON (reported from play).
//
// Actions.ReadyWeapon is a POLLED action in DFU, not a dispatched one.
// WeaponManager.Update reads it with ActionStarted every frame
// (WeaponManager.cs:249, :268 -> ToggleSheath) and NOTHING else in the
// game reads it: grep Actions.ReadyWeapon across Assets/Scripts and
// the only two sites are InputManager's own table (:355, :1009) and
// that Update. GameManager's key chain (:509-557) and DaggerfallUI
// never PostMessage it.
//
// The port has two doors into routeAction: routeKey (a KEY event) and
// routeLargeHudClick (the bar's panels). The large HUD's sheath panel
// is a real DFU door - HUDLarge.cs:477-482 calls WeaponManager
// .ToggleSheath() from the click - but the KEY is not, and when
// routeKey grew a ReadyWeapon arm the press ran BOTH doors: the
// keydown toggled, the same press's frame edge toggled back, and the
// weapon never moved. That is the whole bug; these pins are the law
// on each side of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBindings, resetDefaults, setBinding } from '../src/systems/inputActions.js';
import { setBindings, routeKey, routeAction, held } from '../src/ui/input.js';
import { LARGE_HUD_PANELS } from '../src/ui/hudLarge.js';
import { createWeaponRig } from '../src/combat/weaponRig.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const defaults = () => { const b = createBindings(); resetDefaults(b); setBindings(b); return b; };

/** A real rig, headless (no palette -> the draw stays inert). */
const rig = () => createWeaponRig({
  renderer: {}, canvas: { clientWidth: 1000, clientHeight: 800 },
  fetchBytes: () => { throw new Error('no art in tests'); },
  palette: null, audio: { playOneShot() {} }, entity: { items: [] },
});

/**
 * One host, both doors, as the hosts wire them: a keydown listener
 * that fills the held-key set and (where the host does) routes the
 * event, and a frame that polls the ReadyWeapon rising edge.
 * `keyCtx` is what that host hands routeKey - the dungeon contexts
 * carry toggleSheath (dungeonContext.js:2684), the interior ctx does
 * not, and the two exterior hosts route no keys through routeKey at
 * all (their ladder reads actionOf directly).
 */
function host({ keyCtx = null } = {}) {
  const r = rig();
  const keys = new Set();
  let zPrev = false;
  return {
    rig: r,
    sheathed: () => r.playerWeapon.sheathed,
    keydown(code) {
      keys.add(code);
      if (keyCtx) routeKey({ code, preventDefault() {} }, keyCtx);
    },
    keyup(code) { keys.delete(code); },
    frame() {
      const z = held(keys, 'ReadyWeapon');
      if (z && !zPrev) r.toggleSheath();
      zPrev = z;
    },
  };
}

// ---------------------------------------------------------------
// 1. THE TWO DOORS
// ---------------------------------------------------------------

test('audit26 Z: the KEY never toggles the sheath - the per-frame poll owns it', () => {
  defaults();
  let toggles = 0;
  const ctx = { toggleSheath: () => { toggles++; } };   // the dungeon context's shape
  assert.equal(routeKey({ code: 'KeyZ', preventDefault() {} }, ctx), false,
    'routeKey does not consume ReadyWeapon - WeaponManager.cs:268 polls it');
  assert.equal(toggles, 0, 'and it does not toggle: two doors on one press cancel out');
  setBindings(null);
});

test('audit26 Z: it is the ACTION that is polled, not the letter Z', () => {
  // Rebind ReadyWeapon to B and the same law holds - a pin on the code
  // would pass while a rebound key double-toggled.
  const b = defaults();
  setBinding(b, 'KeyB', 'ReadyWeapon', true);
  let toggles = 0;
  assert.equal(routeKey({ code: 'KeyB', preventDefault() {} }, { toggleSheath: () => { toggles++; } }), false);
  assert.equal(toggles, 0);
  setBindings(null);
});

test('audit26 Z: the large HUD sheath panel still toggles (HUDLarge.cs:477-482)', () => {
  defaults();
  const sheath = LARGE_HUD_PANELS.find((p) => p.key === 'sheath');
  assert.ok(sheath, 'the bar carries a sheath panel');
  let toggles = 0;
  assert.equal(routeAction(sheath.action, { toggleSheath: () => { toggles++; } }), true,
    'the CLICK is a real DFU door and consumes');
  assert.equal(toggles, 1);
  setBindings(null);
});

// ---------------------------------------------------------------
// 2. THE BEHAVIOUR, PER HOST WIRING
// ---------------------------------------------------------------

// dungeonContext.js:2684 hands routeKey a ctx WITH toggleSheath (the
// standalone ?dungeon host and world/exterior-hosted dungeon mode both
// route the same object); the interior ctx and the two exterior hosts
// do not. Every one of them must answer a press identically.
const WIRINGS = [
  ['?dungeon / dungeon mode (routeKey ctx carries toggleSheath)', { keyCtx: { toggleSheath: () => { throw new Error('the key door must not fire'); } } }],
  ['interior mode (routeKey ctx has no sheath door)', { keyCtx: {} }],
  ['?world / ?exterior walk (no routeKey on the gameplay key at all)', {}],
];

for (const [name, wiring] of WIRINGS) {
  test(`audit26 Z: one press = one flip, ${name}`, () => {
    defaults();
    const h = host(wiring);
    assert.equal(h.sheathed(), true, 'classic starts sheathed (WeaponManager.Sheathed)');
    // Press: the weapon comes UP and stays up while the key is held
    // (ActionStarted is a rising edge - InputManager.cs:626).
    h.keydown('KeyZ');
    h.frame();
    assert.equal(h.sheathed(), false, 'Z readies the weapon');
    h.frame(); h.frame();
    assert.equal(h.sheathed(), false, 'a HELD key does not flap');
    h.keyup('KeyZ'); h.frame();
    assert.equal(h.sheathed(), false, 'the release changes nothing');
    // ...and the next press sheathes it again.
    h.keydown('KeyZ'); h.frame();
    assert.equal(h.sheathed(), true, 'Z sheathes it again');
    h.keyup('KeyZ'); h.frame();
    assert.equal(h.sheathed(), true);
    setBindings(null);
  });
}

// ---------------------------------------------------------------
// 3. THE FOUR HOSTS STILL OWN THE EDGE
// ---------------------------------------------------------------

test('audit26 Z: every host that owns a weapon rig polls the ReadyWeapon edge', () => {
  // The poll is the ONLY door for the key, so a host that loses it
  // loses Z entirely. Read as the rising-edge shape, not a spelling:
  // a held() read of the ACTION, and a toggleSheath call under it.
  for (const f of ['src/scenes/dungeon.js', 'src/scenes/worldModes.js',
    'src/scenes/world.js', 'src/scenes/exterior.js']) {
    const src = read(f);
    assert.match(src, /held\(\s*keys\s*,\s*'ReadyWeapon'\s*\)/, `${f} polls the ReadyWeapon action`);
    assert.match(src, /toggleSheath/, `${f} toggles the sheath under that edge`);
  }
  // worldModes carries BOTH modal modes on one edge (dungeon ->
  // dungeonCtx, interior -> its own rig), so the edge there answers
  // for the interior host too.
  assert.match(read('src/scenes/worldModes.js'), /interiorWeapon\.toggleSheath/,
    'interior mode toggles its own rig');
});
