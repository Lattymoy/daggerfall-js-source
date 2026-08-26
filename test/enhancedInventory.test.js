// U53 - THE ENHANCED PACK AND THE SLOT MAP, pinned.
//
// More of this one is drivable in node than any enhanced screen so
// far: `packModel` and `itemLine` are pure, and the EQUIP CHAIN they
// sit on is systems/equip.js, which runs headless. So the tests below
// actually wear things and take them off and read the map's state,
// rather than reading the source and hoping.
//
// The DOM half is source sweeps, and says so; the screen itself is
// driven in a browser by tools/enhancedPackProbe.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { packModel, itemLine, SLOT_MAP } from '../src/ui/enhancedInventory.js';
import {
  createInventoryWindow, inventoryDoorReady, needsClassicInventory, CLASSIC_ONLY_MODES,
} from '../src/ui/inventoryDoor.js';
import { TABS, filterByTab } from '../src/ui/nativeInventory.js';
import { EQUIP_SLOTS, ITEM_TEMPLATES } from '../src/characters/paperdoll.js';
import { equipItem, unequipSlot, isEquipped } from '../src/systems/equip.js';
import { maxEncumbrance } from '../src/combat/formulas.js';
import { liveStat } from '../src/systems/statMods.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** The module with its comments stripped. Both "this file must not
 *  contain X" sweeps below failed their first run against the file's
 *  own header EXPLAINING why it does not contain X - which is the
 *  sweep reading prose as code, and would have let a real second icon
 *  pipeline through as long as nobody wrote about it. */
const code = (p) => read(p)
  .replace(/\/\*[^]*?\*\//g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const skin = (v) => { _resetForTests(); globalThis.location = { search: `?skin=${v}` }; };

const tmpl = (name) => ITEM_TEMPLATES.find((t) => t.name === name);
const mk = (name, group = 'Weapons', extra = {}) => {
  const t = tmpl(name);
  assert.ok(t, `${name} is not a template in this build`);
  return {
    name: t.name, templateIndex: t.index, group, stackCount: 1,
    currentCondition: t.hitPoints ?? 50, maxCondition: t.hitPoints ?? 50, ...extra,
  };
};
const hero = () => {
  const e = {
    name: 'Aelwyn', career: { name: 'Spellsword' },
    stats: { strength: 50, endurance: 48 }, items: [],
  };
  e.items = [
    mk('Longsword'), mk('Dagger'), mk('Buckler', 'Armor'), mk('Cuirass', 'Armor'),
    { name: 'Gold Pieces', templateIndex: 276, group: 'Currency', stackCount: 1287 },
  ];
  return e;
};
const model = (e) => packModel({ entity: e, items: () => e.items });

// ── THE MODEL ────────────────────────────────────────────────────

test('U53: the pack reads the four DFU tab pages, and nothing else', () => {
  const e = hero();
  const m = model(e);
  assert.deepEqual(m.tabs.map((t) => t.tab), [...TABS]);
  for (const { tab, items } of m.tabs) {
    assert.deepEqual(items, filterByTab(e.items, tab),
      `${tab} must be filterByTab's own answer, not a second filter`);
  }
  assert.equal(m.count, 5);
  assert.equal(m.gold, 1287, 'the Currency stack, as every other screen reads it');
});

test('U53: encumbrance is the same expression the sheet and the classic window use', () => {
  const e = hero();
  e.activeEffects = [{ kind: 'drainAttribute', stat: 'strength', magnitude: 12 }];
  const m = model(e);
  assert.equal(m.encumbrance.max, maxEncumbrance(liveStat(e, 'strength')));
  assert.notEqual(m.encumbrance.max, maxEncumbrance(e.stats.strength),
    'LIVE strength - a drained player must not be told they can carry the undrained amount');
});

// ── THE EQUIP CHAIN IS systems/equip.js's, RUN FOR REAL ──────────

test('U53: wearing something fills its slot on the map', () => {
  const e = hero();
  assert.equal(model(e).worn.size, 0);
  const sword = e.items[0];
  equipItem(e, sword);
  const m = model(e);
  assert.equal(m.worn.size, 1);
  assert.equal(m.worn.get(EQUIP_SLOTS.RightHand)?.name, 'Longsword',
    'a one-hander lands in the right hand, and the map reads the equip table');
  assert.ok(isEquipped(sword));
});

test('U53: worn items LEAVE the list - FilterLocalItems, and the map is where they go', () => {
  // This is the law that made a "worn" badge on a row unrenderable,
  // and it is DFU's: filterByTab drops every equipped item on its
  // first line. The slot map is the only place worn kit lives, which
  // is the argument this screen is built on.
  const e = hero();
  const before = model(e).tabs.find((t) => t.tab === 'weapons').items.length;
  equipItem(e, e.items[0]);
  const after = model(e);
  assert.equal(after.tabs.find((t) => t.tab === 'weapons').items.length, before - 1);
  for (const { items } of after.tabs) {
    for (const it of items) assert.ok(!isEquipped(it), 'no equipped item may appear in any tab');
  }
  assert.equal(after.worn.size, 1, '...and it is on the map instead');
});

test('U53: taking it off empties the node and returns it to the list', () => {
  const e = hero();
  equipItem(e, e.items[0]);
  unequipSlot(e, EQUIP_SLOTS.RightHand);
  const m = model(e);
  assert.equal(m.worn.size, 0);
  assert.ok(m.tabs.find((t) => t.tab === 'weapons').items.some((i) => i.name === 'Longsword'));
});

test('U53: DFU’s two-hander law travels - the map shows both hands cleared', () => {
  const e = hero();
  const claymore = mk('Claymore');
  e.items.push(claymore);
  equipItem(e, e.items[0]);                       // a one-hander in the right
  equipItem(e, e.items.find((i) => i.name === 'Buckler'));  // a shield in the left
  assert.equal(model(e).worn.size, 2);
  equipItem(e, claymore);                         // the two-hander clears both
  const m = model(e);
  assert.equal(m.worn.get(EQUIP_SLOTS.RightHand)?.name, 'Claymore');
  assert.equal(m.worn.get(EQUIP_SLOTS.LeftHand), undefined, 'the shield came off');
  assert.equal(m.worn.size, 1);
});

// ── THE SLOT MAP ─────────────────────────────────────────────────

test('U53: every equip slot the game has is on the map', () => {
  // The classic paperdoll draws a picture of a person and the player
  // hunts for the slots. The point of a schematic is that NONE of them
  // is hidden - a slot the player cannot see is a slot they cannot
  // empty - so the map must cover the enum, None excepted.
  const real = Object.entries(EQUIP_SLOTS).filter(([, v]) => v !== EQUIP_SLOTS.None);
  for (const [name, id] of real) {
    assert.ok(SLOT_MAP[id], `${name} (${id}) has no node on the map`);
    assert.equal(typeof SLOT_MAP[id].x, 'number');
    assert.equal(typeof SLOT_MAP[id].y, 'number');
    assert.equal(typeof SLOT_MAP[id].label, 'string');
  }
  assert.equal(Object.keys(SLOT_MAP).length, real.length);
});

test('U53: no two slots sit on top of each other', () => {
  // A schematic whose nodes overlap is a schematic that cannot be
  // clicked, and the failure is invisible in source.
  const seen = new Map();
  for (const [id, at] of Object.entries(SLOT_MAP)) {
    for (const [otherId, other] of seen) {
      const d = Math.hypot(at.x - other.x, at.y - other.y);
      assert.ok(d >= 11, `slots ${id} and ${otherId} are ${d.toFixed(1)} apart - the filled radius is 7`);
    }
    seen.set(id, at);
  }
});

test('U53: DFU’s two unnamed slots are hidden until something is in them', () => {
  // They are gaps in DFU's own enum and nothing routes to them, so a
  // permanent empty node would be noise - but an item that landed
  // there with no node would be a belonging the player cannot reach.
  assert.equal(SLOT_MAP[EQUIP_SLOTS.Unknown1].hidden, true);
  assert.equal(SLOT_MAP[EQUIP_SLOTS.Unknown2].hidden, true);
  const named = Object.entries(SLOT_MAP).filter(([, at]) => !at.hidden);
  assert.equal(named.length, Object.keys(SLOT_MAP).length - 2);
  // the view draws a hidden node only when filled
  assert.match(read('src/ui/enhancedInventory.js'), /if \(at\.hidden && !item\) continue;/);
});

// ── THE ITEM LINE ────────────────────────────────────────────────

test('U53: an item line is the other modules’ own strings', () => {
  const e = hero();
  const line = itemLine(e.items[0]);
  assert.equal(line.name, 'Longsword');
  assert.ok(line.weight > 0);
  assert.equal(typeof line.word, 'string', 'conditionWord, from systems/itemInfo.js');
  assert.equal(line.condition, 100);
  assert.equal(line.equipped, false);
  // the real icon is recorded even though it is not drawn, so the
  // wiring point stays visible instead of being lost
  assert.match(line.icon, /^TEXTURE\.\d+ record \d+$/);
});

test('U53: a broken item says so, and the chain refuses it', () => {
  const e = hero();
  const dagger = e.items[1];
  dagger.currentCondition = 0;
  assert.equal(itemLine(dagger).broken, true);
  assert.equal(equipItem(e, dagger), null, 'DaggerfallInventoryWindow.cs:1330-1341');
  assert.equal(model(e).worn.size, 0);
});

// ── THE FORK ─────────────────────────────────────────────────────

function withDocument(fn) {
  const node = { id: '', style: {}, removed: false, remove() { this.removed = true; } };
  globalThis.document = { createElement: () => node, body: { append() {} } };
  try { return fn(node); } finally { delete globalThis.document; }
}

test('U53: the classic skin still gets the canvas window', () => {
  skin('classic');
  withDocument(() => {
    assert.equal(createInventoryWindow({ entity: hero() })?.constructor?.name, 'NativeInventoryWindow');
  });
});

test('U53: the enhanced skin gets the DOM pack', () => {
  skin('enhanced');
  withDocument((node) => {
    const w = createInventoryWindow({ entity: hero() });
    assert.notEqual(w?.constructor?.name, 'NativeInventoryWindow');
    assert.equal(w.done, false);
    assert.equal(node.id, 'enhanced-inventory');
    w.dispose();
    assert.equal(w.done, true);
    assert.equal(node.removed, true);
  });
});

test('U53: the fork asks the SKIN, not only the document', () => {
  assert.match(read('src/ui/inventoryDoor.js'),
    /if \(isEnhanced\(\) && typeof document !== 'undefined' && !needsClassicInventory\(deps\)\) \{/);
});

test('U53: a LOOT pile or a reward picker gets the classic window, on either skin', () => {
  // Not a gap: those flows are whole DFU windows of law living inside
  // the classic one, and a player who opens a corpse gets the window
  // that has always opened it. What would break the never-traps law is
  // an enhanced pack that silently dropped the wagon on the floor.
  assert.deepEqual([...CLASSIC_ONLY_MODES], ['loot', 'chooseOne']);
  skin('enhanced');
  withDocument(() => {
    for (const mode of CLASSIC_ONLY_MODES) {
      assert.equal(needsClassicInventory({ [mode]: {} }), true);
      const w = createInventoryWindow({ entity: hero(), [mode]: { items: () => [] } });
      assert.equal(w?.constructor?.name, 'NativeInventoryWindow', `${mode} must stay classic`);
    }
    assert.equal(needsClassicInventory({ entity: hero() }), false, 'a bare pack is not one of them');
  });
});

test('U53: the door needs classic art only where the classic window draws it', () => {
  skin('classic');
  assert.equal(inventoryDoorReady(), false, 'no INVE00I0 in this container');
  skin('enhanced');
  assert.equal(inventoryDoorReady(), true, 'the enhanced pack reads no game data at all');
});

test('U53: the LOOT arm keeps the ART gate, because the door hands it the classic window', () => {
  // The subtle one. Every other inventory gate moved to the door; this
  // one must NOT, or a pile opens a classic window with no art in it.
  for (const rel of ['scenes/world.js', 'scenes/exterior.js']) {
    const src = read(`src/${rel}`);
    assert.match(src, /else if \(dropKey && inventoryArtLoaded\(\)\) \{/,
      `${rel}: the pile gate stays on the art`);
    assert.match(src, /A pile is a LOOT target/, `${rel}: and says why`);
    assert.match(src, /inventoryDoorReady\(\)/, `${rel}: while the bare pack asks the door`);
  }
});

// ── THE SEAM ─────────────────────────────────────────────────────

test('U53: no host builds a pack past the door', () => {
  for (const rel of ['scenes/world.js', 'scenes/exterior.js', 'scenes/dungeonContext.js']) {
    const src = read(`src/${rel}`);
    assert.doesNotMatch(src, /new NativeInventoryWindow\(/, `${rel} must not construct the window`);
    assert.equal([...src.matchAll(/createInventoryWindow\(\{/g)].length, 1,
      `${rel}: ONE builder`);
  }
});

// ── THE SCREEN'S OWN INPUT AND ITS LEAKS ─────────────────────────

test('U53: Escape and F6 close it, and F6 is claimed', () => {
  const src = read('src/ui/enhancedInventory.js');
  const onKey = src.slice(src.indexOf('function onKey(e)'), src.indexOf('function releaseLock()'));
  assert.match(onKey, /overlayAction\(e\) !== 'back' && e\.key !== 'F6'/);
  const testAt = onKey.indexOf("e.key !== 'F6'");
  const claimAt = onKey.indexOf('e.preventDefault()');
  assert.ok(testAt > 0 && claimAt > testAt, 'decide it used the key before claiming it');
  assert.match(onKey, /e\.stopPropagation\(\)/);
});

test('U53: every listener has an owner', () => {
  const src = read('src/ui/enhancedInventory.js');
  const unmount = src.slice(src.indexOf('    unmount() {'));
  assert.match(unmount, /removeEventListener\('keydown', keyHandler, \{ capture: true \}\)/);
  assert.match(unmount, /removeEventListener\('pointerlockchange', lockHandler\)/);
});

test('U53: onClose is owed to the host whatever skin drew the window', () => {
  // AUDIT 17e F28: DFU frees the container on window close, and the
  // two loot arms hand onClose for exactly that. The classic window
  // calls it; the enhanced overlay must too or a pile stays locked.
  const src = read('src/ui/inventoryDoor.js');
  const close = src.slice(src.indexOf('const close = ()'), src.indexOf('const overlay = {'));
  assert.match(close, /deps\.onClose\?\.\(\)/);
  assert.ok(close.indexOf('fired = true') < close.indexOf('deps.onClose'),
    'the window is down before the host is told');
});

test('U53: the host arms are no-ops BY DESIGN, and say so', () => {
  // Unlike U52's sheet this screen is a LEAF - nothing it opens is a
  // canvas window - so there is no child to forward to, and each arm
  // has to say that rather than being silently empty.
  const src = read('src/ui/inventoryDoor.js');
  for (const arm of ['input', 'click', 'wheel', 'hover', 'tick', 'draw']) {
    assert.match(src, new RegExp(`${arm}\\(\\) \\{ /\\*`), `${arm}() must say why it does nothing`);
  }
});

test('U53: no item icons, and the reason is written down', () => {
  const src = read('src/ui/enhancedInventory.js');
  assert.match(src, /THE ITEM ICONS\./);
  assert.match(src, /ui\/bitmapCanvas\.js - does not exist yet/);
  assert.doesNotMatch(code('src/ui/enhancedInventory.js'), /getTexture|uploadRecord|deps\.icons/,
    'no second icon pipeline in this file');
});

test('U53: no library - the schematic is inline SVG', () => {
  // The prototype's figure is a three.js scene and enhanced.html loads
  // that from a CDN. The port's doctrine already carries exactly one
  // third-party request and does not want a second.
  assert.doesNotMatch(code('src/ui/enhancedInventory.js'), /THREE|three\.js|cdn/i);
  assert.match(read('src/ui/enhancedInventory.js'),
    /createElementNS\('http:\/\/www\.w3\.org\/2000\/svg'/);
});
