// CAPE-TOGGLE (2026-10-29, the owner: "add a cape/helmet toggle option in the inventory for people", then "Worn cloaks
// plus any aura", seen by everyone, the helmet later; bible/04-Characters/Cape-Toggle.md): THE CAPE SWITCH'S PINS - the
// law (the equip table as the body is drawn), the look (the cloak left out, `hc` said, kept by the wire), the auras (mine
// and a peer's), the drawers' one door, and the pack's switch itself.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAPE_PREF, CAPE_SLOTS, capeShown, setCapeShown, drawnEquipTable, lookCapesHidden } from '../../src/systems/capeShown.js';
import { getPref } from '../../src/systems/uiPrefs.js';
import { equipItem, equipTableOf } from '../../src/systems/equip.js';
import { mintCondition, setItemFields } from '../../src/systems/item/itemTemplates.js';
import { EQUIP_SLOTS } from '../../src/characters/paperdoll/paperdoll.js';
import { composeLook } from '../../src/net/remotePlayers.js';
import { validLook, RELAY_VERSION, worldRoom } from '../../src/net/wire.js';
import { OnlineSession } from '../../src/net/online.js';
import { createAuraHost } from '../../src/scenes/auraHost.js';
import { keepSession, adoptIdentity } from '../../src/net/accountClient.js';
import { mountEnhancedInventory } from '../../src/ui/enhanced/enhancedInventory.js';
import { ARMOUR_CSS, PLUS_CSS } from '../../src/ui/enhanced/enhancedPlusStyle.js';
import { FRAME_ROLES } from '../../src/ui/enhanced/enhancedFrame.js';
import { fakeDom } from '../invdrag.mjs';
import { fakeSocketClass } from '../fakeSocket.mjs';

const read = (/** @type {string} */ p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const cloak = () => mintCondition(setItemFields({ group: 'MensClothing', templateIndex: 154, flags: 0 }));
const hero = () => ({
  isPlayer: true, name: 'Valentin', career: { name: 'Spellsword' }, level: 5, gender: 'male', race: 'Breton',
  stats: { strength: 50, endurance: 48, agility: 50, speed: 50, luck: 50, willpower: 50, intelligence: 50, personality: 50 },
  skills: new Array(35).fill(30), activeEffects: [], spells: [], items: /** @type {any[]} */ ([]), goldPieces: 0, health: 100, maxHealth: 100,
});
/** Run `fn` with the switch at `on`, put back after. */
const withCape = (/** @type {boolean} */ on, /** @type {() => any} */ fn) => { const was = getPref(CAPE_PREF); setCapeShown(on); try { return fn(); } finally { setCapeShown(was !== false); } };
const cloakItems = (/** @type {any} */ look) => look.items.filter((/** @type {any} */ i) => CAPE_SLOTS.includes(i.equipSlot));

test('CAPE-TOGGLE the law: shown by default; hidden, the player\'s table as drawn has its cloak slots empty - a copy, the table itself untouched - and anyone else\'s, or a table with no cloak, is the table itself (mutants: hidden by default; the cloak drawn while hidden; the real table emptied; a foe\'s cloak taken)', () => {
  assert.equal(capeShown(), true, 'on unless turned off');
  assert.deepEqual([...CAPE_SLOTS], [EQUIP_SLOTS.Cloak1, EQUIP_SLOTS.Cloak2]);
  const e = hero(), c = cloak();
  e.items.push(c); equipItem(e, c);
  const table = equipTableOf(e);
  assert.ok(CAPE_SLOTS.some((s) => table[s] === c), 'worn in a cloak slot');
  assert.equal(drawnEquipTable(e, true), table, 'shown: the table itself');
  const hidden = drawnEquipTable(e, false);
  assert.notEqual(hidden, table);
  assert.ok(CAPE_SLOTS.every((s) => hidden[s] === null) && CAPE_SLOTS.some((s) => table[s] === c), 'hidden: drawn without it, still worn');
  assert.deepEqual(hidden.filter((_, i) => !CAPE_SLOTS.includes(i)), table.filter((_, i) => !CAPE_SLOTS.includes(i)), 'the rest as worn');
  const foe = { ...hero(), isPlayer: false, items: [] }, fc = cloak();
  foe.items.push(fc); equipItem(foe, fc);
  assert.equal(drawnEquipTable(foe, false), equipTableOf(foe), 'a foe\'s cloak is its own');
  const bare = hero();
  assert.equal(drawnEquipTable(bare, false), equipTableOf(bare), 'no cloak: nothing to take');
  assert.deepEqual([lookCapesHidden({ hc: 1 }), lookCapesHidden({ hc: true }), lookCapesHidden({}), lookCapesHidden(null)], [true, false, false, false]);
});

test('CAPE-TOGGLE the look: hidden, my look leaves the cloak out and says `hc` 1 - shown, the cloak and no `hc`; a foe\'s look keeps its cloak whatever my switch says; the wire keeps `hc` 1 and nothing else, and the session answers a look by id, on the Bay and past it (mutants: the cloak sent while hidden; `hc` never said; `hc` on a foe; the wire dropping it; any `hc` kept)', () => {
  const e = hero(), c = cloak();
  e.items.push(c); equipItem(e, c);
  const shown = withCape(true, () => composeLook(e));
  assert.equal(cloakItems(shown).length, 1, 'shown: the cloak rides the look');
  assert.equal('hc' in shown, false, 'and no `hc` - a look keeps the bytes it had');
  const hidden = withCape(false, () => composeLook(e));
  assert.deepEqual([cloakItems(hidden).length, hidden.hc], [0, 1], 'hidden: no cloak, `hc` said');
  const foe = { ...hero(), isPlayer: false, items: [] }, fc = cloak();
  foe.items.push(fc); equipItem(foe, fc);
  const fl = withCape(false, () => composeLook(foe, { eotbSet: null }));
  assert.deepEqual([cloakItems(fl).length, 'hc' in fl], [1, false], 'a foe is drawn as it is dressed');
  assert.equal(validLook(hidden).hc, 1, 'the wire keeps it');
  assert.deepEqual([validLook({ ...hidden, hc: 2 }).hc, validLook({ ...hidden, hc: '1' }).hc, 'hc' in validLook(shown)], [undefined, undefined, false], 'one word, 1, or nothing');
  assert.equal(RELAY_VERSION, 'world299', 'the relay that keeps it');   // PIN MOVED: world299, DRAGON-CELL (world298 on its branch, renumbered past LITANY-STAND's world298 at the merge; an omen told near its cell alone); PIN MOVED: world297, STOREFRONT (world295 on its branch, renumbered past world295-world296 on main at the merge; the effects kit fx, the glyph mask gb; world281, world283, world286, world288, world289, world290, world291, world293 then world294 on its branch, renumbered past PVP-REWORK, PVP-FOLLOWUP, PVP-SAFE-HIT, AUDIT TAMRIEL-WIDE, CAPE-TOGGLE, FB1029 GROUND, FRONTS, DRAGON, HAND-WRAPS, PVP-LINGER, GILDED-GLOW, DELVE II, PVP-VITALS, WYRM-RIDER and DRAGON-HARDER at the merges); PIN MOVED: world296, FIELD BUGS 2026-10-30b (INDOOR-FLOOR: `fy` kept in a pose); PIN MOVED: world295, GUILD-SHOP (the Insignia Armlet and the Guild Crest join the relay bundle); PIN MOVED: world293, PVP-VITALS and WYRM-RIDER (the relay owns a flagged fighter pools; the dragon riders titles, world294 on its branch); world292, DELVE II (DLV3, the dungeon encounters kept by their room; world284, world288 then world289 on its branch, renumbered past world284 to world291 on main at the merges); PIN MOVED: world291, GILDED-GLOW and DECOR-ROOMY (gilded2 on a look; world286, world287, world289 then world290 on its branch, renumbered past world286 to world290 of main at the merges); PIN MOVED: world288, DRAGON (the pose keeps rd 3, a rider on the Dwarven Dragon, and the fight of the Dwarven Dragon; world281, world283, world284, world285, world286 then world287 on its branch, renumbered past world281 to world287 at the merges of main); PIN MOVED: world287, FRONTS (world286 on its branch, renumbered past world286 of FB1029 GROUND at the merge of main); world286, FB1029 GROUND (world284 on its branch, renumbered past world284 and world285 on main at the merge)
  // TAMRIEL-WIDE: the switch reads no place - a room past the Bay (Whiterun's cell) answers as the Bay's does
  for (const room of ['world:2,12', worldRoom(1820, -300)]) {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', WebSocketImpl: FakeWS, now: () => 1000, look: hidden });
    const pose = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0, mv: 0 };
    s.join(room, pose); sockets[0].open();
    sockets[0].receive({ t: 'welcome', id: 'mac-0001', peers: [{ id: 'peer-0002', name: 'Ember', look: hidden, pose }, { id: 'peer-0003', name: 'Ash', look: shown, pose }], host: null, world: null });
    assert.deepEqual([lookCapesHidden(s.lookOf('peer-0002')), lookCapesHidden(s.lookOf('peer-0003')), lookCapesHidden(s.lookOf('mac-0001')), s.lookOf('nobody')], [true, false, true, null], room);
  }
});

test('CAPE-TOGGLE the auras (AURA-STAYS, 2026-10-30, mob: "it saposta help show the aura not tuen it off"): the switch never hides an aura - mine stays gathered while my cape is hidden, and a peer whose look says `hc` wears theirs and their Aura Armory pieces; the token still says mine, so nothing is said again (mutants: my aura dropped while hidden; a hidden peer\'s aura dropped)', () => {
  const was = globalThis.localStorage;
  const m = new Map(), st = { getItem: (/** @type {string} */ k) => m.get(k) ?? null, setItem: (/** @type {string} */ k, /** @type {string} */ v) => m.set(k, String(v)), removeItem: (/** @type {string} */ k) => m.delete(k) };
  keepSession(st, { id: 'u1', name: 'Me', kind: 'linked', sessionId: 's1', secret: 'x' });
  adoptIdentity(st, { aura: 'eternal', secret: 'x' });
  globalThis.localStorage = /** @type {any} */ (st);
  try {
    let rehellos = 0;
    const looks = /** @type {Record<string, any>} */ ({ p2: { items: [] }, p3: { items: [] } });
    const online = { rehello: () => { rehellos++; return true; }, auraOf: () => 'dagonfire', armoryOf: (/** @type {string} */ id) => (id === 'p2' ? '000b0' : null), lookOf: (/** @type {string} */ id) => looks[id] ?? null };
    const host = createAuraHost({
      renderer: { gl: null }, online: () => online, travelActive: () => false, quiet: () => false, camYaw: () => 0,
      player: () => ({ feetAt: () => [1, 0, 2], bodyFeetAt: () => [1, 0, 2], bodyYawFor: () => 0, height: 1.8, riding: false }),
      spawned: () => true, beast: () => false, veiled: () => false, toScene: (/** @type {any} */ s) => s.at,
      sprites: () => [], bodies: () => null,
    });
    host.issued({ aura: 'eternal' });
    const seen = [{ id: 'p2', shown: { at: [5, 0, 5] } }, { id: 'p3', shown: { at: [6, 0, 6] } }];
    withCape(true, () => host.frame(seen));
    assert.equal(host.counts().auras, 3, 'shown: mine and both peers\'');
    looks.p2 = { hc: 1, items: [] };
    withCape(true, () => host.frame(seen));
    assert.equal(host.counts().auras, 3, 'p2 hides their cloak, never their aura');
    assert.deepEqual(host.armoryWearersNow().map((w) => w.id), ['p2'], 'and keeps their pieces');
    withCape(false, () => host.frame(seen));
    assert.equal(host.counts().auras, 3, 'my cape hidden: my aura still on');
    assert.equal(rehellos, 0, 'the token says my aura still, as it is worn: nothing to say again');
  } finally {
    if (was === undefined) delete globalThis.localStorage; else globalThis.localStorage = was;
  }
});

test('CAPE-TOGGLE one door: every drawer of the player\'s body reads the table as drawn - the Morrowind body\'s worn set (the frame tick and the pack), the sprite\'s outfit and the look - never the table itself (mutants: the frame tick on the raw table; the pack on it; the sprite on it)', () => {
  const src = ['src/combat/weapon/weaponRig.js', 'src/ui/enhanced/enhancedInventory.js', 'src/player/eyeOfTheBeholder/eotbBody.js', 'src/net/remotePlayers.js'].map((p) => [p, read(p)]);
  for (const [p, s] of src) assert.ok(!/dfWornEquipment\(equipTableOf\(/.test(s), `${p}: no worn set off the raw table`);
  assert.match(src[0][1], /fpArm\.setWorn\(dfWornEquipment\(drawnEquipTable\(entity\), EQUIP_SLOTS, ARMOR_ENUM\)\);/);
  assert.match(src[1][1], /arm\.setWorn\(dfWornEquipment\(drawnEquipTable\(deps\.entity\), EQUIP_SLOTS, ARMOR_ENUM\)\);/);
  assert.match(src[2][1], /slots = drawnEquipTable\(playerEntity\);/);
  assert.match(src[3][1], /const table = entity \? drawnEquipTable\(entity\) : \[\];/);
});

/** invdrag.mjs's DOM, as test/systems/fb0930_hoodsaid.test.js stands it up. */
function withDom(/** @type {(dom: any) => any} */ fn) {
  const dom = fakeDom();
  const keys = ['document', 'addEventListener', 'removeEventListener', 'requestAnimationFrame', 'innerWidth', 'innerHeight', 'window'];
  const saved = Object.fromEntries(keys.map((k) => [k, [Object.hasOwn(globalThis, k), /** @type {any} */ (globalThis)[k]]]));
  Object.assign(globalThis, {
    document: dom.doc, addEventListener: dom.win.addEventListener, removeEventListener: dom.win.removeEventListener,
    requestAnimationFrame: () => 0, innerWidth: dom.w, innerHeight: dom.h,
    window: { innerWidth: dom.w, innerHeight: dom.h, getComputedStyle: () => ({ position: 'absolute' }) },
  });
  try { return fn(dom); } finally {
    for (const [k, [had, v]] of Object.entries(saved)) { if (had) /** @type {any} */ (globalThis)[k] = v; else delete /** @type {any} */ (globalThis)[k]; }
  }
}

test('CAPE-TOGGLE the pack: the Cloaks panel\'s cell holds the switch - an eye, pressed while shown, its words in its label and title; a press hides the capes (the eye struck, the pref off) and dresses the body again without the cloak, a second shows them; drawn in the Plus sheet, a tile of the frame (mutants: the switch never drawn; the press never turning the pref; the body not dressed again; the eye never struck)', () => {
  const e = hero(), c = cloak();
  e.items.push(c); equipItem(e, c);
  const worn = /** @type {any[]} */ ([]);
  const fpArm = { setWorn: (/** @type {any} */ p) => worn.push(p), setWeapon: () => {}, ready: () => false };
  withCape(true, () => withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, fpArm });
    try {
      const sw = () => host.querySelector('.worncape');
      const panel = host.querySelectorAll('.wornrow').find((/** @type {any} */ n) => n.querySelector('.wornslot')?.textContent === 'Cloaks');
      assert.ok(sw(), 'the switch is drawn');
      assert.equal(sw().style.gridArea, panel.style.gridArea, 'in the Cloaks panel\'s own cell');
      assert.deepEqual([sw().getAttribute('aria-pressed'), sw().getAttribute('aria-label'), sw().querySelectorAll('path').length], ['true', 'Show cape', 1]);
      assert.match(sw().title, /Your aura stays on/);
      const cloakWorn = () => worn.at(-1).some((/** @type {any} */ p) => p.templateIndex === 154);
      assert.ok(cloakWorn(), 'the body wears the cloak');
      sw().onclick({});
      assert.deepEqual([capeShown(), sw().getAttribute('aria-pressed'), sw().querySelectorAll('path').length], [false, 'false', 2], 'hidden: the pref off, the eye struck');
      assert.equal(cloakWorn(), false, 'the body dressed again without it');
      assert.ok(CAPE_SLOTS.some((s) => equipTableOf(e)[s] === c), 'and still worn');
      sw().onclick({});
      assert.deepEqual([capeShown(), sw().getAttribute('aria-pressed')], [true, 'true']);
      assert.ok(cloakWorn(), 'shown again');
    } finally {
      view.unmount?.();
    }
  }));
  assert.ok(PLUS_CSS.includes(ARMOUR_CSS));
  assert.match(ARMOUR_CSS, /\n\.pack-shell \.wornmap \.worncape \{ justify-self: end; align-self: end;/);
  assert.ok(FRAME_ROLES.tile.includes('.pack-shell .wornmap .worncape'), 'a tile of the frame: each dress paints it as the panel it stands on');
});
