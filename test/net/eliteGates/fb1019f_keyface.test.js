// FIELD BUGS 2026-10-19f KEY-FACE (bible/11-Multiplayer/Elite-Gates.md section 5, "The face is the pack's alone"): A WEIR
// KEY'S FACE NEVER LEAVES THE PACK. The account's count (`players.eg_keys`) is the balance and the pack's stack its face,
// restacked to every answer that carries it - reading the pack alone (systems/eliteGates/weirKey.js restackWeirKeys). The
// row was bound, not pack-only, so a face went to the wagon and the player's own storage: unseen there, the pack was given a
// new one at the next answer, and the stowed ones carried back all turned to rust at the next use. A player's private
// report: a pack of keys, gone at one use. Pinned on the real doors and the real client:
//   - the row pack-only, so both skins refuse a face to the wagon and to the player's own storage, in its own words, and
//     a room's decoration and a revenant's take pass it by;
//   - the bug's record on this screen's client (scenes/eliteGates/egClient.js createEgClient, rigged as
//     test/net/eliteGates/egaudit4_net_client.test.js rigs it): the face to the wagon through DFU's own Remove, the
//     balance asked every EG_KEYS_EVERY_MS, back - one face, and a use says no rust;
//   - the load: a save from before (faces in the wagon, a storage piece, a room's own things, a ship's hold, a companion's
//     pack, a body the find threw one on) loads with every face out of the pack folded away and the pack's kept, and the
//     client's balance makes the pack whole.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEgClient, EG_KEYS_EVERY_MS } from '../../../src/scenes/eliteGates/egClient.js';
import { EG_TEXT } from '../../../src/net/eliteGates/egLaw.js';
import { weirKeys, weirKeysHeld, isWeirKey, foldStrayWeirKeys, WEIR_KEY_ROW, WEIR_KEY_TEMPLATE } from '../../../src/systems/eliteGates/weirKey.js';
import { WEIR_KEY_LAW_ROW } from '../../../src/systems/eliteGates/weirKeyRow.js';
import { egFindThrow } from '../../../src/systems/eliteGates/egFind.js';
import { isBound, isPackOnly, boundRefusesPut, BOUND_KEEPS, packOnlyText } from '../../../src/systems/item/itemBound.js';
import { templateByIndex } from '../../../src/systems/item/itemTemplates.js';
import { sigilStone } from '../../../src/systems/gate/gateSpoils.js';
import { decorStandOf, decorItemFlat, decorDescriptorOf } from '../../../src/systems/decor/decorItems.js';
import { revenantMayTake } from '../../../src/systems/revenant/revenant.js';
import { snapshotPlayer, restorePlayer, savedItemLists } from '../../../src/systems/save/save.js';
import { SMALL_CART_TEMPLATE } from '../../../src/systems/inventorySession.js';
import { NativeInventoryWindow } from '../../../src/ui/native/nativeInventory.js';
import { mountEnhancedInventory } from '../../../src/ui/enhanced/enhancedInventory.js';
import { destroyEnhancedNotice } from '../../../src/ui/enhanced/enhancedNotice.js';
import { _resetForTests } from '../../../src/systems/uiPrefs.js';
import { withDom } from '../../invdrag.mjs';

const ME = 'acct-face', T0 = 1_800_000_000_000;
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const SAYS = 'Weir Key stays in your pack.';
const settle = async () => { for (let k = 0; k < 20; k++) await new Promise((r) => setImmediate(r)); };
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
const cart = () => ({ name: 'Small cart', group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, stackCount: 1 });

/** DFU's own Remove (the classic skin): the pack's face put to the wagon (`to` null) or to the player's own storage. */
function classicPut(bag, wagon, to = null) {
  const face = bag.find(isWeirKey);
  const win = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity: { items: bag, activeEffects: [], wagonItems: wagon }, wagonItems: () => wagon,
    ...(to ? { loot: { items: () => to, storage: true } } : {}) });
  win.mode = 'remove';
  win.tab = 'clothing';
  win.usingWagon = !to;
  const i = win._filtered().indexOf(face);
  assert.ok(i >= 0, 'the face is on the classic pack\'s page');
  win._pick(i);
  return win.boxes;
}

test('KEY-FACE the row: the Weir Key\'s is pack-only - the leaf\'s and the registered row\'s - so every place refuses its face, the wagon and the player\'s own storage too, where a bound ember still goes; it is bound as before; and the two doors out of the pack that are no window\'s pass it by - a room\'s decoration (its painted picture would stand) and a revenant\'s take (mutants: the row not pack-only)', () => {
  assert.equal(WEIR_KEY_LAW_ROW.packOnly, true);
  assert.equal(WEIR_KEY_ROW.packOnly, true);
  assert.equal(templateByIndex(WEIR_KEY_TEMPLATE)?.packOnly, true, 'the row the game registers');
  const face = weirKeys(3);
  assert.deepEqual([isBound(face), isPackOnly(face)], [true, true]);
  for (const kind of [...BOUND_KEEPS, 'ground', 'container', 'reward', 'bag', 'elsewhere']) assert.equal(boundRefusesPut(face, kind), true, kind);
  for (const kind of BOUND_KEEPS) assert.equal(boundRefusesPut(sigilStone(), kind), false, `an ember to the ${kind}: bound alone keeps those`);
  assert.equal(packOnlyText(WEIR_KEY_ROW.name), SAYS);
  assert.ok(decorItemFlat(face) && decorDescriptorOf(face), 'its picture and its numbers would stand it in a room');
  assert.equal(decorStandOf(face), null, 'but a face is never set out');
  assert.equal(revenantMayTake(face), false, 'nor taken by a revenant');
  assert.equal(revenantMayTake(sigilStone()), true, 'a bound ember still is');
});

test('KEY-FACE both skins refuse a face to the wagon and to the player\'s own storage, in its own words, and it stays in the pack: DFU\'s Remove on the classic skin; the card\'s Stow and Store on the enhanced pack (mutants: the row not pack-only)', () => {
  // the classic skin: the wagon, and the player's own storage (a ship's hold, a companion's pack, a home's chest)
  for (const storage of [false, true]) {
    const face = weirKeys(4), bag = [face, cart()], wagon = [], store = [];
    const boxes = classicPut(bag, wagon, storage ? store : null);
    assert.deepEqual([bag.includes(face), face.stackCount, wagon.length, store.length], [true, 4, 0, 0], storage ? 'not stored' : 'not stowed in the wagon');
    assert.deepEqual(boxes, [{ rows: [{ text: SAYS, center: true }] }]);
  }
  // the enhanced pack: its wagon (the cart's plaque opens it) and the player's own storage
  globalThis.location = { search: '?skin=enhanced' };
  for (const storage of [false, true]) {
    _resetForTests();
    withDom((dom) => {
      const host = dom.mk('div'); dom.body.append(host);
      const face = weirKeys(4), store = [];
      const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, goldPieces: 0, items: [face, cart()], wagonItems: [] };
      const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, ...(storage ? { loot: { items: () => store, storage: true } } : {}) });
      try {
        if (!storage) host.querySelectorAll('button').find((b) => b.onclick && /cart/i.test(textOf(b))).onclick();
        const row = () => host.querySelectorAll('.itemrow').find((r) => !r.closest('.loot-win') && textOf(r).includes('Weir Key'));
        if (!row()) for (const tab of host.querySelectorAll('.packtab')) { tab.onclick(); if (row()) break; }
        row().onclick({ timeStamp: 100, detail: 1 });
        const act = host.querySelectorAll('.act').find((b) => b.textContent === (storage ? 'Store' : 'Stow in wagon'));
        assert.ok(act, 'the act is offered - and speaks when pressed');
        act.onclick({ timeStamp: 2000, detail: 1 });
        assert.deepEqual([e.items.includes(face), face.stackCount, e.wagonItems.length, store.length], [true, 4, 0, 0], 'it stays in the pack');
        assert.ok(textOf(dom.body).includes(SAYS), 'and the pack says why, in its own words');
      } finally { view.unmount(); destroyEnhancedNotice(); }
    });
  }
});

/** This screen's client over a driven clock, its account door answering as server-account/src/eg.js does: one balance,
 *  an open takes one (`eg_keys = eg_keys - 1`), every answer carries the balance. */
function rig(t, entity, keys) {
  let clock = T0;
  t.mock.method(Date, 'now', () => clock);
  const L = { said: [], balance: keys };
  const modes = { mode: 'exterior', stepping: false, egHallBreach: () => null, egHallCircle: () => null, stepThroughFire: async () => true, enterEgHall: () => true };
  const hub = { egOk: true, sendEg: () => true };
  const account = {
    me: () => ME, guest: () => false,
    keys: async () => ({ ok: true, data: { keys: L.balance } }),
    open: async () => { if (L.balance < 1) return { ok: false, error: 'short', keys: L.balance }; L.balance--; return { ok: true, data: { order: 'v1.order.face', b: '0123456789abcdef', ez: 'e'.repeat(24), keys: L.balance, until: 0, rh: 0 } }; },
  };
  const client = createEgClient({ modes: () => modes, online: () => ({ sendEg: () => true }), hub: () => hub, account, now: () => clock, entity, player: { pos: [0, 0, 0] }, cam: { pos: [0, 0, 0], yaw: 0 },
    say: (s) => L.said.push(s), site: () => ({}), wire: () => ({ px: 300, py: 200, x: 1000, y: 0, z: 2000, yaw: 0 }), landAt: () => true, hurt: () => {}, store: null,
    callPortal: { open: () => ({ at: [0, 0, 0] }), clear: () => {}, tick: () => {}, standing: () => false }, feet: () => [0, 0, 0] });
  return { client, L, step: (ms) => { clock += ms; } };
}

test('KEY-FACE the bug\'s record, on this screen\'s client: one key held; its face put to the wagon through DFU\'s Remove, the balance asked every EG_KEYS_EVERY_MS, seven times over, then the wagon emptied into the pack - the wagon never held one, the pack shows the one key the account holds, and a use stakes it with no rust said (it showed eight, and all eight turned to rust) (mutants: the row not pack-only)', async (t) => {
  const entity = { level: 20, health: 100, maxHealth: 100, items: [cart()], wagonItems: [] };
  const R = rig(t, entity, 1);
  R.client.frame(); await settle();
  assert.equal(weirKeysHeld(entity.items), 1, 'signed in: the pack restacked to the balance');
  for (let cycle = 1; cycle <= 7; cycle++) {
    classicPut(entity.items, entity.wagonItems);
    R.step(EG_KEYS_EVERY_MS); R.client.frame(); await settle();
    assert.deepEqual([weirKeysHeld(entity.items), weirKeysHeld(entity.wagonItems)], [1, 0], `cycle ${cycle}: the face stayed, and no second was given`);
  }
  for (const it of entity.wagonItems.filter(isWeirKey)) { entity.wagonItems.splice(entity.wagonItems.indexOf(it), 1); entity.items.push(it); }
  assert.equal(weirKeysHeld(entity.items), 1, 'the wagon emptied into the pack: still the one');
  assert.equal(R.client.useKey(), EG_TEXT.opening);
  await settle();
  assert.deepEqual([R.L.balance, weirKeysHeld(entity.items)], [0, 0], 'staked');
  assert.ok(!R.L.said.includes(EG_TEXT.rust), 'and nothing turned to rust');
});

test('KEY-FACE the fold, by itself: every Weir Key out of each list it is handed and each `{ id: item }` record, in place; nothing else touched; answers the keys the folded faces showed, each face once though the load\'s walk lists a record\'s items too (mutants: a list unfolded; a record unfolded; the count)', () => {
  const ember = sigilStone(), standing = weirKeys(3);
  const a = [weirKeys(2), ember, weirKeys(1)], b = [weirKeys(5)], own = { 'own-1': standing, 'own-2': ember };
  assert.equal(foldStrayWeirKeys([a, b, null, Object.values(own)], [own, null]), 11);
  assert.deepEqual([a, b, own], [[ember], [], { 'own-2': ember }]);
  assert.equal(foldStrayWeirKeys([a, b], [own]), 0, 'a second fold finds none');
});

test('KEY-FACE the load: a save from before the fix - faces in the wagon, a storage piece and a chest, a room\'s own things, a ship\'s hold, a companion\'s pack and a body the find threw one on - loads with every face out of the pack folded away, everything beside them kept, the pack\'s own face kept; the balance then makes the pack whole, and a use says no rust (mutants: the load folds nothing; the pack folded too; the room\'s own things unread)', async (t) => {
  const ROOM = 'DaggerfallInterior [MapID=1, BuildingKey=2]';
  const ember = () => sigilStone();
  const p = { isPlayer: true, level: 10, gender: 'male', activeEffects: [], health: 60, maxHealth: 60, items: [weirKeys(1), cart()], wagonItems: [weirKeys(7), ember()],
    spells: [], stats: {}, skills: {}, career: { primarySkills: [], majorSkills: [], luck: 50 } };
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: 100 })));
  const body = { dead: true, items: [ember()] };
  const pack = [];
  egFindThrow(body, pack, 1);   // the find's own throw: one face on the body, never taken up
  assert.equal(weirKeysHeld(body.items), 1);
  snap.sceneCache = { scenes: [{ sceneName: ROOM, decorItems: { 'chest-1': [weirKeys(2), ember()] }, decorOwn: { 'own-1': weirKeys(1), 'own-2': ember() }, lootContainers: [{ items: [weirKeys(1)] }] }] };
  snap.world = { piles: [], droppedLoot: [], foes: [JSON.parse(JSON.stringify(body))] };
  snap.modData = { 'come-sail-away': { placedBoats: [{ Items: [weirKeys(3), ember()] }] }, NavalCombat: { party: { party: [{ items: [weirKeys(1)] }] } } };
  const loaded = { isPlayer: true };
  const said = [];
  const info = t.mock.method(console, 'info', (line) => { said.push(String(line)); });
  const extras = restorePlayer(loaded, snap, new Map());
  info.mock.restore();
  assert.deepEqual(said.filter((l) => l.includes('KEY-FACE')), ['[save] KEY-FACE: 16 Weir Key face(s) outside the pack folded away - the account holds the keys'], 'the load says what it folded: 7 + 2 + 1 + 1 + 1 + 3 + 1');
  const room = loaded.sceneCache.scenes.get(ROOM);
  assert.deepEqual([weirKeysHeld(loaded.items), loaded.items.length], [1, 2], 'the pack keeps its own face');
  assert.deepEqual(loaded.wagonItems.map((it) => it.templateIndex), [ember().templateIndex], 'the wagon\'s faces folded, its ember kept');
  assert.deepEqual(room.decorItems['chest-1'].map((it) => it.templateIndex), [ember().templateIndex], 'a storage piece\'s');
  assert.deepEqual(room.lootContainers[0].items, [], 'a chest\'s');
  assert.deepEqual(Object.keys(room.decorOwn), ['own-2'], 'a room\'s own thing that was a face');
  assert.deepEqual(extras.world.foes[0].items.map((it) => it.templateIndex), [ember().templateIndex], 'the body\'s');
  assert.deepEqual(extras.modData['come-sail-away'].placedBoats[0].Items.map((it) => it.templateIndex), [ember().templateIndex], 'a ship\'s hold\'s');
  assert.deepEqual(extras.modData.NavalCombat.party.party[0].items, [], 'a companion\'s pack\'s');
  for (const list of savedItemLists(snap, loaded)) if (list !== loaded.items) assert.equal(weirKeysHeld(list), 0, 'no list the save holds but the pack shows a face');
  // the balance makes the pack whole - the eight the account holds - and a use stakes one with no rust
  const R = rig(t, loaded, 8);
  R.client.frame(); await settle();
  assert.equal(weirKeysHeld(loaded.items), 8);
  assert.equal(R.client.useKey(), EG_TEXT.opening);
  await settle();
  assert.deepEqual([R.L.balance, weirKeysHeld(loaded.items), R.L.said.includes(EG_TEXT.rust)], [7, 7, false]);
});
