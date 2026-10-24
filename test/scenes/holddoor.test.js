// CARGO-ANYWHERE (2026-10-17, the owner: "Cargo should be able to be accessed at any time. Currently it cannot be";
// bible/03-World/Naval-Refit.md CARGO-ANYWHERE) - THE HOLD'S DOOR over Come Sail Away's real runtime and the Fleet's
// real ledger and host: the ship at hand (her helm, her deck, her cabin); any ship of mine by her number wherever she lies
// (afloat here or far, laid up, packed - her parts her timbers' weight alone, PARTS-WEIGHT); the hold's key falling back to my
// last helm, then my fleet's first; a Rowboat refused; the hold opened TWO-WAY on the Enhanced skins under its own name;
// the Fleet page's Hold and the helm's Hold; the key on F4; and the world host's wiring. tools/mutants/holddoor.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { scene, terrain } from '../csaScene.mjs';
import { createHoldDoor, holdsCargo, HULL_HOLDS } from '../../src/scenes/holdDoor.js';
import { createFleetHost } from '../../src/scenes/fleetHost.js';
import { fleetBook, titleDeed, titleOf, knowShip, _resetFleetForTests } from '../../src/systems/fleet.js';
import { mintDeed, mintBoatItem, cargoLootTarget, BOAT_PARTS_TEMPLATE } from '../../src/systems/comeSailAway/comeSailAwayItems.js';
import { packedHullWeight } from '../../src/systems/comeSailAway/comeSailAwayBoat.js';
import { remoteModel } from '../../src/ui/enhanced/enhancedInventory.js';
import { helmButtons } from '../../src/ui/enhanced/enhancedHelm.js';
import { ACTIONS, PORT_ACTIONS, DEFAULT_BINDINGS, MOD_ACTIONS, actionLabel } from '../../src/systems/inputActions.js';
import { drawFleetPage, resetFleetPage } from '../../src/ui/fleetPage.js';
import { setHoldingsProvider, _setHoldingsIconForTests } from '../../src/ui/holdingsPages.js';
import { hostText } from '../hostText.mjs';

const WORLD = hostText('src/scenes/world.js');
const AT = [100, 34, 200], DIR = [0, 0, 1];
const kg = (items) => items.reduce((a, it) => a + (it.weightInKg ?? 0), 0);

/** Come Sail Away's real runtime with the Fleet's book (fleet.test.js csaWithBook's), and a hold door over it. */
function world() {
  _resetFleetForTests();
  const s = scene({ terrains: [terrain(10, 20), terrain(11, 20)] });
  const pack = [];
  let uid = 7000;
  s.deps.items = {
    create: (t) => mintBoatItem(t, ++uid), addToPlayer: (it) => pack.push(it), player: () => pack,
    titles: () => fleetBook(), retitle: (boat) => !!boat,
  };
  s.deps.cargoWeight = kg;
  s.deps.isPortTown = () => true;
  const w = { opened: [], said: [], deck: null, cabin: null };
  const door = createHoldDoor({
    csa: () => s.rt, aboard: () => w.deck, cabin: () => w.cabin,
    partsOf: (u) => pack.find((it) => it?.templateIndex === BOAT_PARTS_TEMPLATE && it.UID === u) ?? null, toPack: (it) => pack.push(it),
    openHold: (loot) => { w.opened.push(loot); return true; },
    nameOf: (u) => (u === 1 ? 'Sea Wolf' : ''), say: (text) => w.said.push(text),
  });
  const ship = (u, hull, at = AT) => { titleDeed(mintDeed(hull, 0, u, 1000)); return s.rt.SummonBoat(u, titleOf(u), fleetBook(), at, DIR, s.terrains[0]); };
  return { s, w, door, pack, ship };
}

test('CARGO-ANYWHERE the ship at hand: at the helm hers, on her deck hers, below in her cabin hers - in that order; none at hand, none (mutants: the helm, the deck, the cabin unread)', () => {
  const { s, w, door, ship } = world();
  const a = ship(1, 2), b = ship(2, 4, [400, 34, 200]), c = ship(3, 3, [700, 34, 200]);
  assert.equal(door.atHand(), null);
  w.cabin = { uid: 3, hull: 3 };
  assert.equal(door.atHand(), c, 'below deck in her cabin');
  w.deck = b;
  assert.equal(door.atHand(), b, 'her deck before the cabin\'s record');
  s.rt.StartSailing(a);
  assert.equal(door.atHand(), a, 'her helm first');
});

test('CARGO-ANYWHERE a standing boat\'s hold opens TWO-WAY under her name - the player\'s own storage (the Enhanced skins\' Store beside the pack, never the pile\'s take-only frame), her own list, live; a Rowboat carries none (mutants: storage unsaid, the title unread, the Rowboat a hold)', () => {
  const { w, door, ship } = world();
  const a = ship(1, 2);
  a.Cargo.Items.push({ name: 'a cask', weightInKg: 10 });
  assert.equal(door.openBoat(a), true);
  const loot = w.opened.at(-1);
  assert.equal(loot.items(), a.Cargo.Items, 'her own list - what goes in is in her hold');
  assert.equal(loot.storage, true);
  assert.equal(loot.title, 'Sea Wolf\'s hold');
  const m = remoteModel({ loot, items: () => [] });
  assert.deepEqual([m.kind, m.title], ['storage', 'Sea Wolf\'s hold'], 'the Enhanced inventory reads it as the player\'s own storage, by her name');
  assert.equal(cargoLootTarget(a.Cargo).storage, true, 'and the box\'s own press (OpenCargo) opens it two-way too');
  assert.equal(door.openBoat(ship(2, 4, [400, 34, 200])), true);
  assert.equal(w.opened.at(-1).title, 'Ship\'s hold', 'an unnamed ship\'s');
  assert.deepEqual(HULL_HOLDS, [false, true, true, true, true]);
  assert.equal(holdsCargo(0), false);
  const n = w.opened.length;
  const row = ship(4, 0, [900, 34, 200]);
  assert.equal(door.openBoat(row), false);
  assert.equal(w.opened.length, n);
  assert.equal(w.said.at(-1), 'Rowboats have no hold.');
});

test('CARGO-ANYWHERE any ship of mine by her number, wherever she lies: afloat far off (her boat\'s own hold), laid up (Come Sail Away\'s PackedCargoes under her number - the list her placing takes back aboard), packed (the same list, her parts her timbers alone whatever is stowed - PARTS-WEIGHT - and her parts stored in her own hold back in the pack as it shuts) - and a ship not mine said so (mutants: the laid-up hold, the parts left in her hold)', () => {
  const { s, w, door, ship, pack } = world();
  const far = ship(1, 2, [5000, 34, 200]);
  far.MapPixel = { X: 13, Y: 16 }; far.GameObject.activeSelf = false;
  assert.equal(door.openShip(1), true);
  assert.equal(w.opened.at(-1).items(), far.Cargo.Items, 'afloat far off: her own hold');
  // laid up: her hold kept under her number
  const lay = ship(2, 4, [400, 34, 200]);
  lay.Cargo.Items.push({ name: 'silk', weightInKg: 4 });
  assert.equal(s.rt.LayUpBoat(lay), true);
  assert.equal(door.openShip(2), true);
  const laid = w.opened.at(-1);
  assert.equal(laid.items(), s.rt.laidUpHold(2), 'the laid-up hold, live');
  assert.deepEqual(laid.items().map((i) => i.name), ['silk']);
  assert.equal(laid.storage, true);
  laid.items().push({ name: 'iron', weightInKg: 12 });
  // placed again, what was put in her laid-up hold comes aboard
  // packed: her parts weigh her timbers alone (PARTS-WEIGHT) - nothing stowed or taken weighs on them
  const pk = ship(3, 3, [700, 34, 200]);
  pk.Cargo.Items.push({ name: 'wine', weightInKg: 10 });
  assert.equal(s.rt.PackBoat(pk, true), true);
  const parts = pack.find((it) => it.templateIndex === BOAT_PARTS_TEMPLATE && it.UID === 3);
  assert.equal(parts.weightInKg, packedHullWeight(3));
  assert.equal(door.openShip(3), true);
  const packed = w.opened.at(-1);
  packed.items().push({ name: 'grain', weightInKg: 5000 });
  packed.onClose();
  assert.equal(parts.weightInKg, packedHullWeight(3), 'a stow weighs nothing on her parts');
  assert.equal(kg(packed.items()), 5010, 'her hold holds it');
  // her parts stored into her own hold come back to the pack as it shuts
  pack.splice(pack.indexOf(parts), 1);
  packed.items().push(parts);
  packed.onClose();
  assert.ok(pack.includes(parts) && !packed.items().includes(parts), 'back in the pack');
  assert.equal(laid.onClose, undefined, 'a laid-up ship has no parts to weigh');
  const n = w.opened.length;
  assert.equal(door.openShip(99), false);
  assert.equal(w.opened.length, n);
  assert.equal(w.said.at(-1), 'You don\'t own that ship.');
});

test('CARGO-ANYWHERE THE HOLD\'S KEY: the ship at hand\'s, else the last whose helm I took (while she is still mine), else my fleet\'s first with a hold, wherever she lies - and with none, said (mutants: the last helm forgotten, a Rowboat picked)', () => {
  const { s, w, door, ship } = world();
  assert.equal(door.press(), false);
  assert.equal(w.said.at(-1), 'You have no ship with a hold.');
  ship(5, 0, [900, 34, 200]);
  assert.equal(door.press(), false, 'a Rowboat alone: still none');
  const a = ship(1, 2), b = ship(2, 4, [400, 34, 200]);
  door.press();
  assert.equal(w.opened.at(-1).items(), a.Cargo.Items, 'none at hand, none helmed: my fleet\'s first with a hold');
  s.rt.StartSailing(b);
  door.frame();
  assert.equal(door.lastHelm, 2);
  door.press();
  assert.equal(w.opened.at(-1).items(), b.Cargo.Items, 'at the helm');
  s.rt.StopSailing();
  door.frame();
  door.press();
  assert.equal(w.opened.at(-1).items(), b.Cargo.Items, 'her helm left: still the last one I took');
});

test('CARGO-ANYWHERE the Fleet page: a Hold on every card of a ship with one, pressed through the host to her hold wherever she lies - the door handed to the menu; a Rowboat\'s card none, its act refused (mutants: the act refused, the button unshown)', () => {
  _setHoldingsIconForTests(() => ({ src: 'data:x', w: 30, h: 30 }));
  globalThis.document = undefined;
  const { s, ship } = world();
  const asked = [];
  const host = createFleetHost({
    csa: () => s.rt, naval: () => null, pack: () => [], gold: () => 0, pay: () => {}, accounts: () => [], regionName: () => '',
    where: () => ({ inside: false, pixel: { X: 10, Y: 20 }, feet: AT }), nearPort: () => true, nearestPort: () => null, terrainAt: () => s.terrains[0], changed: () => {},
    openHold: (uid) => { asked.push(uid); return opens; },
  });
  let opens = true;
  ship(1, 2); knowShip(4, 0, 0, 1); titleDeed(mintDeed(0, 0, 4, 1));
  const m = host.model();
  assert.deepEqual(m.ships.map((r) => [r.uid, r.hold]).sort(), [[1, true], [4, false]]);
  const r = host.act(1, 'hold');
  assert.deepEqual([r.ok, r.text], [true, 'Hold opened.']);
  assert.equal(r.door(), true);
  assert.deepEqual(asked, [1]);
  assert.deepEqual(host.act(4, 'hold').text, 'Rowboats have no hold.');
  // the page
  const el = (tag, cls, text) => {
    const n = { tag, children: [], attrs: {}, title: '', className: cls ?? '', _t: text == null ? '' : String(text), setAttribute(k, v) { n.attrs[k] = v; }, append(...c) { n.children.push(...c); } };
    Object.defineProperty(n, 'textContent', { get: () => n._t + n.children.map((c) => c.textContent ?? '').join(''), set: (v) => { n._t = String(v); } });
    return n;
  };
  const find = (root, label) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.tag === 'button' && c.textContent === label) out.push(c); walk(c); } }; walk(root); return out; };
  setHoldingsProvider({ fleet: { model: () => host.model(), offer: (u) => host.offer(u), act: (u, v, a) => host.act(u, v, a) } });
  resetFleetPage();
  const doors = [];
  const d = el('div', 'px-qdetail');
  drawFleetPage(d, () => {}, { el, divider: (t) => el('h4', null, t), meter: (a, b) => el('div', null, `${a}/${b}`), door: (fn) => doors.push(fn) });
  const holds = find(d, 'Hold');
  assert.equal(holds.length, 1, 'the Small Ship\'s card alone');
  holds[0].onclick();
  assert.equal(doors.length, 1, 'the door handed to the menu (the pause steps aside, the hold opens)');
  assert.equal(doors[0](), true);
  assert.deepEqual(asked, [1, 1]);
  const said = () => { const d2 = el('div', 'px-qdetail'); drawFleetPage(d2, () => {}, { el, divider: (t) => el('h4', null, t), meter: (a, b) => el('div', null, `${a}/${b}`), door: (fn) => doors.push(fn) }); return d2.textContent.includes('Hold opened.'); };
  assert.equal(said(), true, 'opened: its card says so');
  // AUDIT 2026-10-17: a door that will not open - its card never keeps the word that it opened
  opens = false;
  holds[0].onclick();
  assert.equal(doors.at(-1)(), false);
  assert.equal(said(), false, 'refused: no word that it opened');
  setHoldingsProvider(null);
});

test('CARGO-ANYWHERE the helm\'s Hold and the hold\'s key: a hook button on the wheel for a hull with a hold; the key appended, a port row of Come Sail Away\'s on F4 (F1 and F3 the browser\'s, F2 the saddle\'s); the world host builds one door, reads the key in every mode, hooks the wheel and hands the Fleet its door (mutants: the button, the key unread, the wheel unhooked)', () => {
  const base = { hasSails: true, sailsUp: true, light: false };
  assert.ok(helmButtons({ ...base, cargo: true }).some((b) => b.act === 'cargo' && b.label === 'Hold' && b.kind === 'hook'));
  assert.ok(!helmButtons({ ...base, cargo: false }).some((b) => b.act === 'cargo'));
  assert.equal(ACTIONS.at(-3), 'ShipHold');   // PIN MOVED (SHOT-KINDS: ShotCycle appended after; PARTY-PING: PartyPing after that)
  assert.ok(PORT_ACTIONS.includes('ShipHold'));
  assert.ok(DEFAULT_BINDINGS.some(([c, a]) => c === 'F4' && a === 'ShipHold'));
  assert.ok(MOD_ACTIONS['come-sail-away'].some((r) => r.action === 'ShipHold' && r.legacy === null));
  assert.equal(actionLabel('ShipHold'), 'Cargo (Come Sail Away)');
  assert.match(WORLD, /const holdDoor = createHoldDoor\(\{/);
  assert.match(WORLD, /holdDoor\.frame\(\);[^\n]*\n {4}if \(csaRuntime && walkMode && playerSpawned && !modes\?\.transitioning && !travelView\?\.active && hccActionPressed\('ShipHold'\)\) holdDoor\.press\(\);/);
  assert.match(WORLD, /cargo: \(\) => \{ const b = csaRuntime\?\.state\?\.CurrentBoat; if \(b\) holdDoor\.openBoat\(b\); \},/);
  assert.match(WORLD, /if \(helm\) helm = card \? null : \{ \.\.\.helm, orders: navalOn\(\), cargo: holdsCargo\(helm\.hull\), shot: navalOn\(\) \? naval\?\.shotLabel\?\.\(\) \?\? null : null \};/);   // PIN MOVED (SHOT-KINDS: and her guns' load; FIELD BUGS 2026-10-21d PASSAGE-HANDS: no buttons for a passenger)
  assert.match(WORLD, /openHold: \(uid\) => holdDoor\.openShip\(uid\),/);
  assert.match(WORLD, /cabin: \(\) => modes\?\.sailingCabin \?\? null,/, 'below deck: the cabin\'s ship');
});
