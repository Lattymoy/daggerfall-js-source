// QS2 (2026-09-17, Mac: a Demon's Souls quickslot diamond on the ENHANCED
// HUD's bottom-left - main hand, off hand, and two consumables, each with a
// keybind tag): THE ACTIONS, THE ROUTE, AND THE FOUR HOSTS' DOORS.
//
// QS1 built the model (systems/quickslots.js) and nothing could reach it. This
// is the wiring, and it has four laws:
//
//   - THE ACTIONS. Three more of the port's own, APPENDED past DFU's
//     forty-four and past SOC5's row, because the classic controls window
//     indexes ACTIONS by NUMBER against fixed art. Defaulted to the number row,
//     which nothing in DFU, the port or any vendored mod spends. A bindings
//     file written before this slice gains them on the next boot.
//   - THE PANE. Every bindable action needs a row a player can rebind from, and
//     the classic window cannot draw these - so they go in the enhanced pane,
//     under their own heading rather than SOC5's 'Online'.
//   - THE ROUTE. routeAction hands each to a ctx door and passes the DOOR's
//     answer back; a host without one consumes nothing and throws nothing.
//   - THE FOUR HOSTS. AUDIT SOC B4/D1 is the lesson this slice is written
//     against: SOC5 put its door under the exterior host's MODE gate and F did
//     nothing in a tavern or a dungeon for a week. Every host that carries
//     `toggleSheath` carries these, and the two self-routing hosts answer them
//     ABOVE their mode gate.
//
// Plus the thing a source pin cannot claim: that a swap actually changes what
// the weapon rig reports as held. That one is DRIVEN, on a real rig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ACTIONS, PORT_ACTIONS, DEFAULT_BINDINGS, parseActionName,
  createBindings, resetDefaults, setBinding, getBinding, actionForCode, loadKeyBinds, serializeKeyBinds,
} from '../src/systems/inputActions.js';
import { routeAction, QUICKSLOT_ACTIONS, POLLED_ACTIONS } from '../src/ui/input.js';
import { GRID_ACTIONS, ADVANCED_ROWS, PORT_ROWS, PORT_GROUPS, QUICKSLOT_GROUP_TITLE, LOOT_GROUP_TITLE, MOUSE_GROUP_TITLE } from '../src/ui/enhancedControls.js';
import { createWeaponRig } from '../src/combat/weaponRig.js';
import { equipItem, equipTableOf, EQUIP_SLOTS } from '../src/systems/equip.js';
import { assignQuickslot, clearQuickslots, swapQuickslot, quickslotOf } from '../src/systems/quickslots.js';
import { USE_PENDING as USE_PENDING_SYS } from '../src/systems/useItem.js';
import { USE_PENDING as USE_PENDING_UI } from '../src/ui/nativeInventory.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// QS6 (2026-09-17) added a fifth - 'QuickSpell' - and moved Digit3 onto it.
// 'QuickSwap' keeps its row here for the reason the header above gives: an
// action is never removed from ACTIONS, and the swap is still rebindable. What
// it lost is its DEFAULT key, which the off-hand cell that draws it now carries.
const QS = Object.freeze(['QuickUse1', 'QuickUse2', 'QuickSwap', 'QuickOffHand', 'QuickSpell']);
/** QUICK-LOOT B4: the plaque's two, appended past the quickslots for
 *  the same reason the quickslots were appended past SOC5's row - an
 *  action is never inserted, because the classic grid draws by INDEX. */
const QL = Object.freeze(['QuickLootAll', 'QuickLootOpen']);
/** The three a HOLD belongs to: a tap performs the slot, a hold cycles it, and
 *  only the frame can tell those apart - so these are polled, not dispatched. */
const HOLD = Object.freeze(['QuickUse1', 'QuickUse2', 'QuickSpell']);

// ── THE ACTIONS ──────────────────────────────────────────────────────

test('QS2: the three actions are APPENDED - past DFU\'s forty-four and past SOC5\'s row - parse, and never displace an index the classic grid draws by number (mutants: a name spliced mid-list; a name the parser answers Unknown for)', () => {
  // FREEMOUSE appended one more past the plaque's two, so the slice
  // that names "the last seven" now has an eighth row behind it. It is
  // sliced from the END of the port's rows rather than widened to
  // include a row this pin is not about.
  // LOOT-STACK appended one more past FREEMOUSE's, so the slice ends two short of the end now.
  assert.deepEqual(ACTIONS.slice(-9, -2), [...QS, ...QL], 'the seven rows QS2 and QUICK-LOOT own, in this order');
  assert.deepEqual(ACTIONS.slice(-2), ['FreeMouse', 'NextBody'], 'and FREEMOUSE\'s past them, and LOOT-STACK\'s past that - the newest');
  assert.equal(ACTIONS.length, 54, 'DFU\'s 44 + SOC5\'s 1 + QS2\'s 3 + QS4\'s 1 + QS6\'s 1 + QUICK-LOOT\'s 2 + FREEMOUSE\'s 1 + LOOT-STACK\'s 1');
  // Every index DFU's own enum had, it still has. This is the whole reason the
  // list is appended to and never inserted into (ui/controlsWindow.js).
  assert.equal(ACTIONS[43], 'AutoRun', 'DFU\'s last row keeps index 43');
  assert.equal(ACTIONS[44], 'SocialInteract', 'and SOC5\'s keeps 44');
  assert.deepEqual([...GRID_ACTIONS], ACTIONS.slice(2, 40), 'so the classic grid\'s slice still means what it meant');
  for (const a of [...QS, ...QL]) {
    assert.equal(ACTIONS.filter((x) => x === a).length, 1, `${a} once`);
    assert.equal(parseActionName(a), a);
  }
  assert.equal(ACTIONS[47], 'QuickSwap', 'and QS2\'s swap keeps ITS index - an action is never removed, only unbound');
  assert.equal(parseActionName('QuickUse3'), 'Unknown', 'the sentinel still answers for a near miss');
});

test('QS2: the port\'s own actions YIELD in the classic windows - all four of them, because none of the four is on either classic face (mutant: the three left out of PORT_ACTIONS, so a classic player is told of a clash against a row they cannot see or clear)', () => {
  assert.deepEqual([...PORT_ACTIONS], ['SocialInteract', ...QS, ...QL, 'FreeMouse', 'NextBody']);   // FREEMOUSE: the classic windows cannot draw its row either; LOOT-STACK: nor the pile's turn
  // The claim PORT_ACTIONS makes is "not drawable by a classic window", and it
  // is derived here rather than asserted: the classic grid is ACTIONS[2..40)
  // and the ADVANCED popup is its six.
  const classicFace = new Set([...GRID_ACTIONS, ...ADVANCED_ROWS.map((r) => r.action)]);
  for (const a of PORT_ACTIONS) assert.ok(!classicFace.has(a), `${a} is on neither classic face`);
  // ...and the other way: nothing DFU's own windows DO draw yields there.
  for (const a of classicFace) assert.ok(!PORT_ACTIONS.includes(a), `${a} is drawable and must not yield`);
});

test('QS2: the defaults are the number row, spent exactly once each, and free before this slice took them (mutants: a default on a key DFU or a vendored mod already answers; two actions on one digit)', () => {
  const byCode = new Map(DEFAULT_BINDINGS.map(([c, a]) => [c, a]));
  assert.equal(byCode.get('Digit1'), 'QuickUse1');
  assert.equal(byCode.get('Digit2'), 'QuickUse2');
  // QS6: the third digit is the SPELL slot now.
  assert.equal(byCode.get('Digit3'), 'QuickSpell');
  assert.equal(byCode.get('Digit4'), 'QuickOffHand');
  const codes = DEFAULT_BINDINGS.map(([c]) => c);
  assert.equal(new Set(codes).size, codes.length, 'no key is spent twice');
  // QS6: EVERY ACTION HAS AT MOST ONE DEFAULT, and exactly one has none - the
  // swap, which gave its digit to the spell slot. It is still in ACTIONS and
  // still on the enhanced pane, so a player who wants a dedicated swap key
  // binds one; what it must not be is a second action on a spent key.
  const acts = DEFAULT_BINDINGS.map(([, a]) => a);
  assert.equal(new Set(acts).size, acts.length, 'no action is defaulted twice');
  assert.deepEqual(ACTIONS.filter((a) => !acts.includes(a)), ['QuickSwap'],
    'exactly one action ships unbound, and it is the one whose cell another key presses');
  assert.equal(DEFAULT_BINDINGS.length, ACTIONS.length - 1);
  // THE KEYS WERE FREE. DFU's own table is the rows above SOC5's, and none of
  // them is a digit - read off the table rather than asserted about it.
  const dfu = DEFAULT_BINDINGS.slice(0, 44).map(([c]) => c);
  for (const d of ['Digit1', 'Digit2', 'Digit3']) assert.ok(!dfu.includes(d), `SetupDefaults never spends ${d}`);
  // The port's own spending, named where it is spent, so a rename there fails
  // here (the same shape HT4's pin uses one file over).
  assert.match(rd('src/ui/input.js'), /if \(e\.code === 'Tab'\) \{ return ctx\.toggleDial/, 'PX15: Tab is the pixel dial');
  // A live store built from the defaults answers each digit with its action.
  const s = createBindings();
  resetDefaults(s);
  assert.equal(actionForCode(s, 'Digit1'), 'QuickUse1');
  assert.equal(getBinding(s, 'QuickSpell'), 'Digit3');
  assert.equal(getBinding(s, 'QuickOffHand'), 'Digit4');
  assert.equal(getBinding(s, 'QuickSwap'), null, 'the swap ships unbound and rebindable');
});

test('QS2: a bindings blob written BEFORE this slice gains the three on the next load, and a player who had already bound a digit keeps it (mutants: the autofill stealing a bound key; the rows put in a host so an existing save never gets them)', () => {
  // The startup path is loadKeyBinds then resetDefaults(store, true) - what
  // loadOrCreateBindings does after every load.
  const old = createBindings();
  resetDefaults(old);
  const file = serializeKeyBinds(old);
  for (const d of ['Digit1', 'Digit2', 'Digit3']) delete file.actionKeyBinds[d];   // the blob as it was written before QS2
  const fresh = createBindings();
  loadKeyBinds(fresh, file);
  for (const d of ['Digit1', 'Digit2', 'Digit3']) assert.equal(actionForCode(fresh, d), null, 'the blob itself says nothing about the digits');
  resetDefaults(fresh, true);
  assert.equal(actionForCode(fresh, 'Digit1'), 'QuickUse1', 'the autofill gives an existing player the action - no reset, no lost bindings');
  assert.equal(actionForCode(fresh, 'Digit2'), 'QuickUse2');
  assert.equal(actionForCode(fresh, 'Digit3'), 'QuickSpell');
  assert.equal(actionForCode(fresh, 'Digit4'), 'QuickOffHand');
  assert.equal(getBinding(fresh, 'Rest'), 'KeyR', 'and disturbs nothing else');
  assert.equal(getBinding(fresh, 'SocialInteract'), 'KeyF', 'SOC5\'s row included');
  // ...and a player who put Rest on 1 keeps Rest on 1; QuickUse1 simply waits.
  const mine = createBindings();
  loadKeyBinds(mine, file);
  setBinding(mine, 'Digit1', 'Rest');
  resetDefaults(mine, true);
  assert.equal(actionForCode(mine, 'Digit1'), 'Rest', 'testSetBinding never steals a code the player has spent');
  assert.equal(getBinding(mine, 'QuickUse1'), null, 'so the new action waits, rebindable, rather than fighting for the key');
  assert.equal(actionForCode(mine, 'Digit2'), 'QuickUse2', 'and its siblings are unaffected');
});

// ── THE PANE ─────────────────────────────────────────────────────────

test('QS2: the enhanced pane draws the three under their OWN heading, and the coverage rule still holds over every group (mutants: the rows dropped so the keys are unrebindable; the rows hidden under SOC5\'s Online heading; a row twice)', () => {
  // QUICK-LOOT B4: a THIRD group, for the reason the second exists - a
  // row the classic windows cannot draw needs a heading of its own, or
  // a clash against it is one a classic player can neither see nor
  // clear. The coverage rule below is what actually holds it: every
  // bindable action has exactly one row across every group.
  // FREEMOUSE: a FOURTH heading, one row. Filing it under 'Online'
  // would repeat the mistake this pin's own note names - the Enter/chat
  // collision that motivates the key is an online thing, but freeing
  // the mouse is something you do to read the screen.
  assert.deepEqual(PORT_GROUPS.map((g) => g.title), ['Online', QUICKSLOT_GROUP_TITLE, LOOT_GROUP_TITLE, MOUSE_GROUP_TITLE]);
  assert.equal(MOUSE_GROUP_TITLE, 'Mouse');
  assert.deepEqual(PORT_GROUPS[3].rows.map((r) => [r.action, r.label]), [
    ['FreeMouse', 'Free the mouse (press again to look)'],
  ]);
  assert.equal(QUICKSLOT_GROUP_TITLE, 'Quickslots');
  // LOOT-STACK: 'Quick loot' -> 'Loot' - the third row turns a pile on either skin with quick loot on or off, and a
  // heading must describe its rows (FREEMOUSE's own rule, above)
  assert.equal(LOOT_GROUP_TITLE, 'Loot');
  assert.deepEqual(PORT_GROUPS[2].rows.map((r) => [r.action, r.label]), [
    ['QuickLootAll', 'Take everything'],
    ['QuickLootOpen', 'Open the container'],
    ['NextBody', 'Next body in a pile'],   // LOOT-STACK
  ]);
  assert.ok(!PORT_GROUPS[0].rows.concat(PORT_GROUPS[1].rows).some((r) => QL.includes(r.action)),
    'not under Online and not under Quickslots - looting is neither');
  assert.deepEqual(PORT_GROUPS[1].rows.map((r) => [r.action, r.label]), [
    ['QuickUse1', 'Use quickslot 1'],
    ['QuickUse2', 'Use quickslot 2'],
    ['QuickSpell', 'Ready quickslot spell (hold to cycle the book)'],   // QS6: the spell slot, beside the two it behaves like
    ['QuickSwap', 'Swap weapon'],              // QS6: still here, still rebindable, shipped unbound
    ['QuickOffHand', 'Off hand: light, douse or swap'],   // QS4's press, and QS6's fold
  ]);
  assert.ok(!PORT_GROUPS[0].rows.some((r) => QS.includes(r.action)), 'not under Online - a potion press is not an online act');
  // COVERAGE: every bindable action has exactly one row across every group.
  const all = [...GRID_ACTIONS, ...ADVANCED_ROWS.map((r) => r.action), ...PORT_ROWS.map((r) => r.action)];
  assert.equal(new Set(all).size, all.length, 'none twice');
  assert.deepEqual([...all].sort(), [...ACTIONS].sort(), 'and none missing');
  // ...and the union really is the groups, so the coverage rule cannot be
  // satisfied by a flat list nothing draws.
  assert.deepEqual(PORT_GROUPS.flatMap((g) => g.rows), [...PORT_ROWS]);
  assert.match(rd('src/ui/enhancedControls.js'),
    /for \(const g of PORT_GROUPS\) group\(body, g\.title, g\.rows\.map\(\(r\) => \[r\.action, r\.label\]\)\);/,
    'the groups are RENDERED, not merely declared');
});

// ── THE ROUTE ────────────────────────────────────────────────────────

test('QS2: routeAction sends each action to its ctx door with the slot number, and passes the DOOR\'S answer back (mutants: the arms swapped so 1 drinks slot 2; a bare true so the key is eaten on a host with no door; the arm missing so the key is dead)', () => {
  const calls = [];
  const ctx = {
    quickUse: (n) => { calls.push(['use', n]); return true; },
    quickSwap: () => { calls.push(['swap']); return true; },
    quickOffHand: () => { calls.push(['off']); return true; },
    quickSpell: () => { calls.push(['spell']); return true; },   // QS6
  };
  assert.equal(routeAction('QuickUse1', ctx), true);
  assert.equal(routeAction('QuickUse2', ctx), true);
  assert.equal(routeAction('QuickSwap', ctx), true);
  assert.equal(routeAction('QuickOffHand', ctx), true);
  assert.equal(routeAction('QuickSpell', ctx), true);
  assert.deepEqual(calls, [['use', 1], ['use', 2], ['swap'], ['off'], ['spell']], 'each arm is its own, and the SLOT NUMBER travels');
  // The door's answer, passed through.
  assert.equal(routeAction('QuickUse1', { quickUse: () => false }), false);
  assert.equal(routeAction('QuickSwap', { quickSwap: () => false }), false);
  assert.equal(routeAction('QuickOffHand', { quickOffHand: () => false }), false);
  assert.equal(routeAction('QuickSpell', { quickSpell: () => false }), false);
  assert.equal(routeAction('QuickUse2', { quickUse: () => undefined }), false, 'a door that answers nothing is not a door that consumed');
  // A host with NO doors: false, and nothing thrown.
  for (const a of QS) assert.equal(routeAction(a, {}), false, `${a} on a bare ctx`);
  // The arms steal nothing from their neighbours.
  let sheath = 0, social = 0;
  routeAction('ReadyWeapon', { toggleSheath: () => { sheath++; } });
  routeAction('SocialInteract', { socialInteract: () => { social++; return true; } });
  assert.deepEqual([sheath, social], [1, 1]);
  // QS6 - THE POLL, not the edge, FOR THE THREE THAT HOLD. QS2 wrote the
  // opposite here and was right at the time: a held 1 must not drink one
  // potion a frame. Mac then asked for the hold to MEAN something ("hold the
  // keybind to switch between applicable spells"), and a press that acts on
  // its DOWN edge cannot also be the start of a hold - the potion is drunk
  // before the player has held long enough to mean "let me choose one". So the
  // three are polled and the frame's machine owns both edges; routeAction
  // keeps their arms for the panel, which has no poll. The two that do NOT
  // hold stay edge actions, because there the down edge is the whole press.
  for (const a of HOLD) assert.ok(POLLED_ACTIONS.has(a), `${a} holds, so the frame owns it`);
  for (const a of QS) if (!HOLD.includes(a)) assert.ok(!POLLED_ACTIONS.has(a), `${a} does not hold, so it is an edge action`);
  const src = rd('src/ui/input.js');
  assert.match(src, /case 'QuickUse1': return ctx\.quickUse\?\.\(1\) === true;/);
  assert.match(src, /case 'QuickUse2': return ctx\.quickUse\?\.\(2\) === true;/);
  assert.match(src, /case 'QuickSwap': return ctx\.quickSwap\?\.\(\) === true;/);
  assert.match(src, /case 'QuickOffHand': return ctx\.quickOffHand\?\.\(\) === true;/);
  assert.match(src, /case 'QuickSpell': return ctx\.quickSpell\?\.\(\) === true;/);
  assert.deepEqual([...QUICKSLOT_ACTIONS].sort(), [...QS].sort(), 'and the set the self-routing hosts read is the same five');
});

// ── THE FOUR HOSTS ───────────────────────────────────────────────────

// AUDIT SOC B4/D1's pin, twinned. The social one walks world.js for the door
// and the arm; this walks EVERY host ctx that carries `toggleSheath`, because
// that list is exactly the list of places a gameplay key is answered, and a
// door missing from one of them is the tavern bug again.
const HOSTS = Object.freeze([
  ['src/scenes/world.js', 'the streaming world'],
  ['src/scenes/exterior.js', 'the ?town/?exterior host'],
  ['src/scenes/dungeonContext.js', 'the dungeon context, in both hosts that mount it'],
  ['src/scenes/worldModes.js', 'the interior mode'],
]);

test('QS2: every host ctx that carries toggleSheath carries quickUse, quickSwap and quickOffHand - the AUDIT SOC B4/D1 walk (mutants: a door dropped from one host, so the keys die in a shop or underground)', () => {
  for (const [path, what] of HOSTS) {
    const src = rd(path);
    assert.match(src, /toggleSheath/, `${path} really is a host that answers gameplay keys`);
    assert.match(src, /quickUse/, `${path} (${what}) has no quickUse door`);
    assert.match(src, /quickSwap/, `${path} (${what}) has no quickSwap door`);
    assert.match(src, /quickOffHand/, `${path} (${what}) has no quickOffHand door`);
    assert.match(src, /quickSpell/, `${path} (${what}) has no quickSpell door`);   // QS6
    // QS6: and the HOLD machine reaches every one of them - a host that never
    // ticks it is a host where the three polled keys do nothing at all, which
    // is the AUDIT SOC B4/D1 trap wearing a new hat.
    assert.match(src, /tickQuickslotHold|tickQuickHold/, `${path} (${what}) never drives the hold machine`);
  }
  // The three that OWN a performer call the model; none of them writes a
  // second use ladder or a second equip.
  for (const path of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    const src = rd(path);
    assert.match(src, /import \{ useQuickslot, swapQuickslot, offHandQuickslot, spellQuickslotPress, offHandOffersSwap, tickQuickslotHold \} from '\.\.\/systems\/quickslots\.js';/, `${path} takes the model's performers`);
    // QS6: the spell's ready is the CAST ENGINE's, asked through the model.
    assert.match(src, /spellQuickslotPress\(\{ entity: playerEntity, magic, say:/, `${path}: the spell slot presses the one engine`);
    // QS6: and the off hand presses the SWAP when that is what the cell shows.
    assert.match(src, /if \(offHandOffersSwap\(playerEntity\)\) return quickSwap\(\);/, `${path}: the key does what the cell shows`);
    // The tap performs, the hold cycles - the model's split, named in the host.
    assert.match(src, /onTap: \(slot\) => \(slot === 'spell' \? quickSpell\(\) : quickUse\(slot === 'c1' \? 1 : 2\)\),/, `${path}: the tap is the host's performer`);
    // QS4: and the off hand's light is the MOD's act, reached through the rig's
    // one door - no host lights a torch itself.
    assert.match(src, /offHandQuickslot\(\{ entity: playerEntity, say: [^\n]*toggleLight: \(\) => weaponRig\.toggleLight\(\) \}\);/s, `${path}: the off hand is the model's, on the rig's door`);
    assert.match(src, /useQuickslot\(n === 1 \? 'c1' : 'c2', \{/, `${path}: the slot number picks the slot`);
    assert.match(src, /swapQuickslot\(\{ entity: playerEntity, say:/, `${path}: the swap is the model's`);
    assert.match(src, /weaponRig\.refreshWorn\(\);/, `${path}: and the rig is told at once`);
    // THE HOOKS ARE THE WINDOW'S OWN BAG, not a second one written beside it -
    // U53's one-builder law, which is what makes a potion drunk from the key
    // and a potion drunk from the Use button the same potion. The bag is named
    // `useHooks` in every host and the inventory builder spreads the same one.
    assert.match(src, /hooks: (\{ \.\.\.useHooks[^}]*\}|quickslotHooks\(\))/, `${path}: the quickslot use takes the host's own bag`);
    assert.match(src, /const useHooks = \{/, `${path}: and there is exactly one of it`);
    assert.equal((src.match(/const useHooks = \{/g) ?? []).length, 1, `${path}: exactly one bag, not two`);
    assert.match(src, /\.\.\.useHooks,/, `${path}: which the inventory builder takes too`);
  }
  // The INTERIOR mode borrows the outer host's performer and refreshes its OWN
  // rig - the one place the two halves differ, and the reason it is written out.
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /quickUse\(n\) \{ return host\.quickUse\?\.\(n\) === true; \},/);
  assert.match(wm, /const ok = host\.quickSwap\?\.\(\) === true;\s*\n\s*if \(ok\) interiorWeapon\.refreshWorn\(\);/,
    'the interior rig is the one this mode draws, so it is the one told');
  // QS4: and its light is that rig's too - the outer host's door would toggle
  // the wrong one, which is the same B4/D1 lesson one hand over.
  assert.match(wm, /toggleLight: \(\) => interiorWeapon\.toggleLight\(\)/);
  // QS6: the spell is the OUTER host's, like the use - the cast engine indoors
  // IS that host's `magic`, so a second performer here would ready on a second
  // engine. And the hold machine is driven PER MODE, because underground the
  // parts it needs are the dungeon context's.
  assert.match(wm, /quickSpell\(\) \{ return host\.quickSpell\?\.\(\) === true; \},/);
  assert.match(wm, /if \(mode === 'dungeon'\) dungeonCtx\?\.tickQuickHold\?\.\(dt, \{ isHeld: \(a\) => held\(keys, a\), blocked: overlayHeld \}\);/);
  // AUDIT QS6 F6: above its own `walkMode && !overlayHeld` gate, so `blocked`
  // is a live argument rather than a dead one.
  assert.match(rd('src/scenes/dungeon.js'), /ctx\.tickQuickHold\?\.\(dt, \{ isHeld: \(a\) => held\(keys, a\), blocked: overlayHeld \|\| !walkMode \}\);/,
    'the standalone ?dungeon page drives the same machine with its own keys');
  for (const path of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(rd(path), /quickUse: \(n\) => quickUse\(n\),\s*\n\s*quickSwap: \(\) => quickSwap\(\),/g,
      `${path} hands the performers down to the mode machine as well as onto its own ctx`);
    assert.match(rd(path), /quickSpell: \(\) => quickSpell\(\),/, `${path} hands the spell door down too`);
    assert.equal((rd(path).match(/quickUse: \(n\) => quickUse\(n\),/g) ?? []).length, 3,
      `${path}: on hudCtx (the key ladder), on the host bag (the interior mode), and on drawHud (QS4: the phone's tap)`);
  }
});

test('QS2 + QS7: the two self-routing hosts answer the dispatchable quickslots in EXTERIOR mode, under the overlay gate - the modal ladders own the key where they are mounted (mutants: the mode gate dropped so a tavern fires both ladders and the torch douses then re-ignites; the overlay gate dropped so 1 drinks a potion while a window is typing)', () => {
  // scenes/world.js: beside SOC5's own arm, which is the one that had to be
  // moved here after the fact.
  const w = rd('src/scenes/world.js');
  // QS6: ...and DECLINES the polled three, or the down edge would drink the
  // potion the hold was about to choose. This ladder never calls routeKey, so
  // routeKey's own POLLED_ACTIONS arm never reaches it - WEAPON-VIS2's lesson
  // at a second door.
  // QS7 (2026-09-17) REVERSED THIS PIN'S OWN CLAUSE, and the reason is
  // the whole finding: the arm stood above the mode gate because the
  // modal contexts had no quickslot doors, and QS4 gave them the whole
  // set without anyone coming back here. Two ladders then answered one
  // key - the outer host's and worldModes' - and because the mod's
  // off-hand toggle is a FLIP, a Digit4 in a tavern doused the torch and
  // re-lit it in the same press. The law it was defending (a quickslot
  // works in a tavern and in a dungeon) is UNCHANGED and now held by the
  // modal ladder; what changed is which ladder holds it.
  // test/qs7_one_dispatch.test.js drives the flip and proves the doors.
  // MAC-R2 (2026-09-17): the arm routes the press edge alone and eats a held key's auto-repeat - test/macr_fixes.test.js
  const wArm = /if \(!townTalk\.overlayActive && \(modes\?\.mode \?\? 'exterior'\) === 'exterior' && QUICKSLOT_ACTIONS\.has\(act\) && !POLLED_ACTIONS\.has\(act\) && socialMenuCanOpen\(\)\) \{ if \(!e\.repeat && routeAction\(act, hudCtx\)\) \{ e\.preventDefault\(\); return; \} if \(e\.repeat\) \{ e\.preventDefault\(\); return; \} \}/;
  assert.match(w, wArm);
  const social = w.indexOf("act === 'SocialInteract' && socialMenuCanOpen()");
  const mine = w.search(wArm);
  assert.ok(social > 0 && mine > 0);
  assert.ok(mine > social, 'it stands beside the social door, whose note carries the lesson');
  // ...and the social arm keeps NO mode gate: the modal contexts carry
  // no socialInteract, so F has no second answer to collide with and
  // AUDIT SOC B4/D1's finding stands exactly as it was.
  const socialLine = w.split('\n').find((l) => l.includes("act === 'SocialInteract'"));
  assert.ok(!/\(modes\?\.mode \?\? 'exterior'\) === 'exterior'/.test(socialLine), 'F still answers inside');
  // scenes/exterior.js: the same place, its own gate words.
  const x = rd('src/scenes/exterior.js');
  const xArm = /if \(!townTalk\.overlayActive && \(modes\?\.mode \?\? 'exterior'\) === 'exterior' && QUICKSLOT_ACTIONS\.has\(act\) && !POLLED_ACTIONS\.has\(act\) && !gamePaused\(\)\) \{ if \(!e\.repeat && routeAction\(act, hudCtx\)\) \{ e\.preventDefault\(\); return; \} if \(e\.repeat\) \{ e\.preventDefault\(\); return; \} \}/;   // MAC-R2
  assert.match(x, xArm);
  // The two hosts that call routeKey need no arm at all - routeKey's own
  // overlay branch and its routeAction tail are the gate and the door.
  for (const path of ['src/scenes/worldModes.js', 'src/scenes/dungeon.js']) {
    assert.match(rd(path), /routeKey\(/, `${path} routes through routeKey, so it inherits the table`);
    assert.doesNotMatch(rd(path), /QUICKSLOT_ACTIONS/, `${path} must not grow a second ladder for these`);
  }
});

// ── THE MODEL'S OWN IMPORTS ──────────────────────────────────────────

test('QS2: the quickslot model imports no UI window - the cycle that killed five test files the moment anything imported it (mutant: USE_PENDING taken from ui/nativeInventory.js again)', () => {
  // QS1 read the classic window's USE_PENDING table straight out of
  // ui/nativeInventory.js. Nothing imported the quickslots yet, so the edge
  // was invisible; this slice imports them from the enhanced pack and from
  // four hosts, and that closed a cycle through ui/targetIconPanel.js -
  // droppedloot, interiordrop, targeticonpanel, audit26_questitem and x11b all
  // died on `Cannot access 'LOCAL_TARGET_ICON_RECT' before initialization`.
  // The table lives beside the result KINDS it is keyed by now
  // (systems/useItem.js), and the window re-exports it, so every reader still
  // reads the same words.
  const src = rd('src/systems/quickslots.js');
  const imports = [...src.matchAll(/from '([^']+)';/g)].map((m) => m[1]);   // the multi-line one counts too
  assert.ok(imports.length >= 4, 'the model really does import things');
  for (const i of imports) assert.ok(!i.includes('/ui/'), `systems/quickslots.js must not import a UI module (${i})`);
  assert.ok(imports.includes('./useItem.js'), 'the use ladder, which is where the stand-in words now live');
  assert.match(rd('src/systems/useItem.js'), /export const USE_PENDING = Object\.freeze\(\{/);
  assert.match(rd('src/ui/nativeInventory.js'), /export \{ USE_PENDING \};/, 'and the window re-exports it, so its own readers are untouched');
  // The words themselves are one table, read three ways.
  assert.equal(USE_PENDING_UI, USE_PENDING_SYS, 'the window and the ladder hand out the same frozen object');
});

// ── THE RIG, DRIVEN ──────────────────────────────────────────────────

// A source pin over `refreshWorn()` proves a call exists, not that a swap
// changes what the player is holding. This is the host's shape - an entity, an
// equip table, a real rig - with the swap performed and the rig ASKED.
const CANVAS = { clientWidth: 1000, clientHeight: 800 };
const sword = () => ({ group: 'Weapons', templateIndex: 120, material: 0, name: 'Longsword', currentCondition: 800, maxCondition: 1000 });
const dagger = () => ({ group: 'Weapons', templateIndex: 113, material: 3, name: 'Dagger', currentCondition: 50, maxCondition: 100 });
const hero = (items) => ({ isPlayer: true, level: 5, career: {}, activeEffects: [], spells: [], stats: {}, items });
const rigFor = (entity) => createWeaponRig({
  renderer: {}, canvas: CANVAS, fetchBytes: () => { throw new Error('no art in tests'); },
  palette: null, audio: { playOneShot() {} }, entity, say: () => {},
});

test.beforeEach(() => clearQuickslots());

test('QS2: a swap changes what the RIG reports as held, in the same press - not on the next frame (mutants: refreshWorn dropped from the performer; refreshWorn made a no-op)', () => {
  const e = hero([sword(), dagger()]);
  const [held, dag] = e.items;
  equipItem(e, held);
  const rig = rigFor(e);
  rig.frame(1 / 60);
  assert.equal(rig.playerWeapon.weapon, held, 'the rig starts on the worn weapon');
  assignQuickslot('swap', dag);

  // The performer's two halves, in the order every host writes them.
  const r = swapQuickslot({ entity: e, say: () => {} });
  assert.equal(r.kind, 'swapped');
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.RightHand], dag, 'the equip table changed');
  assert.equal(rig.playerWeapon.weapon, held, 'and the rig has NOT noticed - this is why the refresh is called at all');
  rig.refreshWorn();
  assert.equal(rig.playerWeapon.weapon, dag, 'now the hand holds the dagger');
  assert.equal(quickslotOf(held), 'swap', 'and the sword is the next press');

  // ...and the frame's own read agrees, so the refresh is the same law early
  // and not a second one.
  swapQuickslot({ entity: e, say: () => {} });
  rig.frame(1 / 60);
  assert.equal(rig.playerWeapon.weapon, held);
});

test('QS2: the rig\'s refresh door is idempotent and changes nothing on its own (mutant: refreshWorn wired to something that toggles)', () => {
  const e = hero([sword()]);
  equipItem(e, e.items[0]);
  const rig = rigFor(e);
  rig.frame(1 / 60);
  const before = rig.playerWeapon.weapon;
  const sheathed = rig.playerWeapon.sheathed;
  rig.refreshWorn(); rig.refreshWorn(); rig.refreshWorn();
  assert.equal(rig.playerWeapon.weapon, before, 'asking twice is asking once');
  assert.equal(rig.playerWeapon.sheathed, sheathed, 'and it is not a second sheath door');
  assert.equal(rig.toggleSheathCalls, 0, 'the sheath counter never moved');
});
