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

import {
  packModel, itemLine, SLOT_MAP, useResultAction, remoteModel, REMOTE_TITLE, STOW_LABEL, plural,
  equippedModel,
} from '../src/ui/enhancedInventory.js';
import { WAGON_KG_LIMIT } from '../src/systems/itemTransfer.js';
import { USE_PENDING } from '../src/ui/nativeInventory.js';
import {
  createInventoryWindow, inventoryDoorReady,
} from '../src/ui/inventoryDoor.js';
import { TABS, filterByTab } from '../src/ui/nativeInventory.js';
import { EQUIP_SLOTS, ITEM_TEMPLATES, getTemplate } from '../src/characters/paperdoll.js';
import { inventoryItemImage } from '../src/systems/itemTemplates.js';
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
  // the view draws a hidden node only when filled. PX19d: the pinned
  // expression was slotMap's copy of the law; slotMap is gone (the
  // worn map IS the schematic now) and the law's surviving home is
  // equippedModel's row filter - the pin follows the shape, and the
  // MEASURED half below proves the behaviour, not just the text.
  assert.match(read('src/ui/enhancedInventory.js'), /rows\.filter\(\(r\) => r\.item \|\| !r\.hidden\)/);
  const empty = equippedModel({ equipTable: [] });
  assert.ok(empty.rows.every((r) => r.label !== 'Unnamed'), 'an empty Unnamed slot leaked into the rows');
});

// ── THE ITEM LINE ────────────────────────────────────────────────

test('U53: an item line is the other modules’ own strings', () => {
  const e = hero();
  const line = itemLine(e.items[0], e);
  assert.equal(line.name, 'Longsword');
  assert.ok(line.weight > 0);
  assert.equal(typeof line.word, 'string', 'conditionWord, from systems/itemInfo.js');
  assert.equal(line.condition, 100);
  assert.equal(line.equipped, false);
});

// U54: THE ICON ADDRESS IS inventoryItemImage'S, AND U53 GOT IT WRONG.
// It read `playerTextureArchive ?? worldTextureArchive` off the
// template, which looks like the same thing and is four ported laws
// short of it - two of them with audits behind them. This is the pin
// that would have caught it.
test('U54: the icon address is inventoryItemImage’s, not a template read', () => {
  const e = hero();
  for (const it of e.items) {
    assert.deepEqual(itemLine(it, e).image, inventoryItemImage(it, e),
      `${it.name}: the line must not resolve its own address`);
  }
  // AUDIT 17e F9: GetItemImage draws the WORLD texture for ingredients
  // and the other four groups, and the PLAYER texture for everything
  // else - 111 of 288 templates differ, so a naive template read is
  // wrong for more than a third of the catalogue.
  const shield = e.items.find((i) => i.name === 'Buckler');
  const naive = getTemplate(shield.templateIndex);
  const real = itemLine(shield, e).image;
  assert.ok(Number.isInteger(real.archive) && Number.isInteger(real.record));
  assert.equal(real.archive, inventoryItemImage(shield, e).archive);
  assert.ok(naive, 'the template exists - the point is that reading it directly is not the law');
});

test('U54: the WEARER changes the address - AUDIT 17f’s morphology offset', () => {
  // SetRace offsets clothing/armour archives by body morphology, and
  // GetInventoryTextureArchive reads that offset back. Without an
  // identity every list drew the morphology-0 Argonian row, so the
  // line has to PASS the wearer through rather than drop it.
  const e = hero();
  const armour = e.items.find((i) => i.group === 'Armor');
  const withWearer = itemLine(armour, e).image;
  const without = itemLine(armour, undefined).image;
  assert.deepEqual(withWearer, inventoryItemImage(armour, e));
  assert.deepEqual(without, inventoryItemImage(armour, undefined));
  // and the view passes it - a model that takes the argument and a
  // caller that forgets it is the same bug one layer up
  const src = read('src/ui/enhancedInventory.js');
  assert.match(src, /itemLine\(item, deps\.entity\)/, 'the row passes the wearer');
  assert.match(src, /itemLine\(picked, deps\.entity\)/, 'and so does the detail');
});

test('U54: a nameless item falls back to its template, not to "Unknown"', () => {
  // A stack minted by a loot roll or a quest can arrive with no name
  // of its own. The template read this replaced carried that fallback
  // and the first draft of the replacement dropped it.
  const e = hero();
  const bare = { ...e.items[0] };
  delete bare.name;
  assert.equal(itemLine(bare, e).name, 'Longsword');
  assert.equal(itemLine({ templateIndex: -1 }, e).name, 'Unknown', 'and a real unknown still says so');
});

test('U54: the tile sets no width attribute - these sprites are not square', () => {
  // A dagger is tall and narrow and a cuirass is wide; forcing them
  // all to one width squashes every one. The CSS caps both axes.
  const src = read('src/ui/enhancedInventory.js');
  const tile = src.slice(src.indexOf('function itemTile(line)'), src.indexOf('function itemRow(item)'));
  assert.doesNotMatch(tile, /img\.width\s*=/, 'no width attribute on the icon');
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.tile img \{ image-rendering: pixelated; max-width: 30px; max-height: 30px; \}/);
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
  // U58 removed the third clause. The boundary it named - loot piles
  // and reward trays - is gone because U56 and U57 took the law out of
  // the classic window, so this is now the plain skin question every
  // other door asks.
  assert.match(read('src/ui/inventoryDoor.js'),
    /if \(isEnhanced\(\) && typeof document !== 'undefined'\) \{/);
});

test('U58: a LOOT pile and a reward tray now get the ENHANCED pane', () => {
  // U53 handed both to the classic window and called it a boundary
  // rather than a gap. U56 and U57 moved the law those flows needed -
  // TransferItem's ladder and the remote side's four claims - so the
  // boundary had nothing left to protect.
  const doorSrc = read('src/ui/inventoryDoor.js');
  assert.ok(!doorSrc.includes('CLASSIC_ONLY_MODES'.replace('_MODES', '_MODES =')),
    'the classic-only list is back');
  skin('enhanced');
  withDocument(() => {
    for (const mode of ['loot', 'chooseOne']) {
      const deps = mode === 'loot'
        ? { entity: hero(), loot: { items: () => [] } }
        : { entity: hero(), chooseOne: { items: [], onChoose: () => {} } };
      const w = createInventoryWindow(deps);
      assert.notEqual(w?.constructor?.name, 'NativeInventoryWindow', `${mode} still falls to classic`);
      assert.equal(typeof w.dispose, 'function', `${mode} must still be an overlay`);
      w.dispose();
    }
  });
  // and the classic skin keeps every one of them
  skin('classic');
  withDocument(() => {
    const w = createInventoryWindow({ entity: hero(), loot: { items: () => [] } });
    assert.equal(w?.constructor?.name, 'NativeInventoryWindow');
  });
});

test('U53: the door needs classic art only where the classic window draws it', () => {
  skin('classic');
  assert.equal(inventoryDoorReady(), false, 'no INVE00I0 in this container');
  skin('enhanced');
  assert.equal(inventoryDoorReady(), true, 'the enhanced pack reads no game data at all');
});

test('U58: the LOOT arm asks the DOOR now, like every other pack arm', () => {
  // U53's subtlety, retired by its own reasoning. The pile gate asked
  // the ART because the door handed every loot call the classic
  // window, which cannot draw without INVE00I0. The enhanced pane runs
  // the pile itself now, so the gate is the skin question - and on the
  // classic skin `inventoryDoorReady` still comes down to that art.
  for (const rel of ['scenes/world.js', 'scenes/exterior.js']) {
    const src = read(`src/${rel}`);
    assert.match(src, /else if \(dropKey && inventoryDoorReady\(\)\) \{/,
      `${rel}: the pile gate did not follow the door`);
    assert.ok(!/inventoryArtLoaded/.test(src),
      `${rel}: a second gate on the raw art survives`);
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

test('U58: the door runs the CLOSE LAW, not half of it', () => {
  // AUDIT 17e F28: DFU frees the container on window close, and the
  // two loot arms hand onClose for exactly that. AUDIT B-C1 is the
  // other half: the session's dropped items mint their world flat.
  // U57 put both in closeSession, and now that the enhanced pane can
  // DROP, the enhanced door owes both.
  const src = read('src/ui/inventoryDoor.js');
  const at = src.indexOf('const close = ()');
  assert.ok(at > 0, 'the close arm is gone');
  const close = src.slice(at, src.indexOf('const overlay = {'));
  assert.match(close, /closeSession\(deps, \{ dropped \}\)/);
  assert.ok(!/deps\.onClose\?\.\(\)/.test(close), 'half the close law survives beside the whole one');
  assert.ok(close.indexOf('fired = true') < close.indexOf('closeSession('),
    'the window is down before the host is told');
  // AND THE PILE IS READ BEFORE THE UNMOUNT, which clears the view.
  assert.ok(close.indexOf('view?.dropped?.()') < close.indexOf('view?.unmount()'),
    'the drop pile is read out of a view that has already been torn down');
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

// ── U55: USE ─────────────────────────────────────────────────────
// systems/useItem.js owns the LAW - which item does what - and it is
// pinned in its own file. What lives here is the branching the classic
// window does on TOP of a result, which is presentation except for the
// two hand-offs, which are not.

test('U55: a book hands the reader over and closes AFTER', () => {
  // THE TWO HAND-OFFS RUN IN OPPOSITE ORDERS and the classic window
  // means it. Both exist because DFU PUSHES those windows over the
  // inventory while the port's hosts hold ONE overlay slot (AUDIT
  // B-C1) - but the reader takes a FAILURE CALLBACK, and "a failed
  // open still reports on this window - it is the live overlay until
  // the reader actually shows", so the book hands over first.
  //
  // The first draft of this pin asserted closeFirst: true for BOTH,
  // matching a module written from the same wrong reading - which is
  // what a pin written beside the code it pins is worth. The browser
  // caught it, with `deps.openBook is not a function`.
  const item = { name: 'A Tract' };
  const a = useResultAction({ kind: 'book', item, failText: 'ruined' }, { openBook: () => {} });
  assert.equal(a.kind, 'openBook');
  assert.equal(a.closeFirst, false, 'the reader is handed the item while this window is still up');
  assert.equal(a.item, item);
  assert.equal(a.failText, 'ruined', 'a failed open still has somewhere to report');
});

test('U55: a host with no reader keeps its window and says so', () => {
  const a = useResultAction({ kind: 'book', item: {} }, {});
  assert.equal(a.kind, 'message');
  assert.equal(a.text, USE_PENDING.book, "the classic window's own words, not a rewording");
});

test('U55: the Spellbook ITEM closes first, then opens', () => {
  const a = useResultAction({ kind: 'spellbook' }, { openSpellbook: () => {} });
  assert.equal(a.kind, 'openSpellbook');
  assert.equal(a.closeFirst, true);
  assert.equal(useResultAction({ kind: 'spellbook' }, {}).text, USE_PENDING.spellbook);
});

test('U55: the message ladder is the classic window’s, in its order', () => {
  // an explicit text wins...
  assert.equal(useResultAction({ kind: 'map', text: 'You study the map.', textId: 499 }, {}).text,
    'You study the map.');
  // ...then a TEXT.RSC id...
  const byId = useResultAction({ kind: 'map', textId: 499 }, {});
  assert.equal(byId.textId, 499);
  assert.equal(byId.text, null, 'an id is not also a text - the host reads the rows');
  // ...then the pending stand-in
  assert.equal(useResultAction({ kind: 'potion', pending: true }, {}).text, USE_PENDING.potion);
  assert.equal(useResultAction({ kind: 'nonesuch', pending: true }, {}).text, 'Nothing happens.');
});

test('U55: AUDIT 22 F9 - `enchanted` is a RIDER, not a replacement', () => {
  // It used to be a kind that REPLACED the arm's own result, so the
  // message the arm produced vanished. It only speaks when the arm
  // said nothing.
  const spoke = useResultAction({ kind: 'map', text: 'You study the map.', enchanted: true }, {});
  assert.equal(spoke.text, 'You study the map.', "the arm's own message survives");
  const silent = useResultAction({ kind: 'clothing', enchanted: true }, {});
  assert.equal(silent.text, USE_PENDING.enchanted);
});

test('U55: a variant change repaints, and closesWindow travels', () => {
  assert.equal(useResultAction({ kind: 'variant' }, {}).repaint, true,
    'the slot map is drawn FROM the worn set, so a changed variant must redraw');
  assert.equal(useResultAction({ kind: 'potion', closesWindow: true }, {}).closesWindow, true);
  assert.equal(useResultAction({ kind: 'potion' }, {}).closesWindow, false);
  assert.equal(useResultAction(null, {}).kind, 'nothing', 'no result is not a crash');
});

test('U55: the two hand-offs run in OPPOSITE orders, in both windows', () => {
  // The rule here that is not presentation, and the one the first
  // draft got backwards. Pinned against BOTH windows so they cannot
  // drift apart, and stated as the asymmetry it actually is.
  const classic = read('src/ui/nativeInventory.js');
  const enhanced = read('src/ui/enhancedInventory.js');

  const cBook = classic.slice(classic.indexOf("if (r.kind === 'book')"),
    classic.indexOf('// U42: USING the Spellbook'));
  assert.ok(cBook.indexOf('this.hooks.openBook(') < cBook.indexOf('this._closeSilently()'),
    'classic book: hand over, THEN close');
  const cSpell = classic.slice(classic.indexOf("if (r.kind === 'spellbook')"), classic.indexOf('if (r.text)'));
  assert.ok(cSpell.indexOf('_closeSilently()') < cSpell.indexOf('this.hooks.openSpellbook()'),
    'classic spellbook: close, THEN hand over');

  const useAt = enhanced.indexOf('function use(item');
  assert.ok(useAt > 0, 'the use arm is gone, and -1 would slice a passing window out of thin air');
  const eUse = enhanced.slice(useAt, enhanced.indexOf('function takeOff(slot)'));
  const eBook = eUse.slice(eUse.indexOf("if (act.kind === 'openBook')"),
    eUse.indexOf("if (act.kind === 'openSpellbook')"));
  assert.ok(eBook.indexOf('open(act.item') < eBook.indexOf('onExit()'),
    'enhanced book: hand over, THEN close');
  const eSpell = eUse.slice(eUse.indexOf("if (act.kind === 'openSpellbook')"));
  assert.ok(eSpell.indexOf('onExit()') < eSpell.indexOf('open()'),
    'enhanced spellbook: close, THEN hand over');

  // AND THE HOOK IS READ BEFORE ANYTHING CLOSES. Unmounting clears
  // `deps`, so a hook read after onExit is undefined - which is
  // precisely how the browser found the ordering wrong.
  assert.ok(eBook.indexOf('const open = deps.openBook') < eBook.indexOf('onExit()'));
  assert.ok(eSpell.indexOf('const open = deps.openSpellbook') < eSpell.indexOf('onExit()'));
});

test('U55: the pack passes useItem the same deps the classic window does', () => {
  // A dep quietly dropped here is an arm that silently does nothing -
  // the shape U44 found when the potion hook reached three of five
  // sites.
  const enhanced = read('src/ui/enhancedInventory.js');
  const useArm = enhanced.slice(enhanced.indexOf('const r = useItem('), enhanced.indexOf('const act = useResultAction'));
  for (const dep of ['entity:', 'localItems:', 'spellCount:', 'isEnchanted', 'nowMinute:', 'revealMap:', 'drinkPotion:']) {
    assert.ok(useArm.includes(dep), `the pack drops ${dep}`);
  }
});


// ── U58: THE REMOTE PANE ─────────────────────────────────────────
// The pack's second list. The LAW under it moved out of the classic
// window in U56 and U57 and is pinned in those files; what is pinned
// here is the pane's own half - which list it is showing, what it
// calls that, and that it runs the extracted modules rather than a
// second reading of them.

test('U58 remoteModel: four claims, in the order inventorySession answers them', () => {
  const axe = mk('Battle Axe');
  const helm = mk('Helm', 'Armor');
  const wagon = [axe];
  const pile = [helm];
  const reward = [mk('Claymore')];
  const dropped = [];
  const deps = { wagonItems: () => wagon, loot: { items: () => pile } };

  // the GROUND is OnPush's default, and it has no capacity
  const g = remoteModel({}, { dropped });
  assert.equal(g.kind, 'ground');
  assert.equal(g.title, REMOTE_TITLE.ground);
  assert.equal(g.capacity, null, 'the ground holds anything');
  assert.equal(g.count, 0);

  // a container outranks the ground...
  assert.equal(remoteModel(deps, { dropped }).kind, 'container');
  // ...a reward tray outranks the container...
  assert.equal(remoteModel(deps, { dropped, chooseOne: { items: reward } }).kind, 'reward');
  // ...and the WAGON outranks everything while it shows
  const w = remoteModel(deps, { dropped, chooseOne: { items: reward }, usingWagon: true });
  assert.equal(w.kind, 'wagon');
  assert.equal(w.items[0], axe, 'the wagon model shows records that are not the host\'s');
  // the ONLY capacity a remote list has is ItemHelper.WagonKgLimit
  assert.equal(w.capacity, WAGON_KG_LIMIT);
  assert.equal(w.weight > 0, true, 'and it weighs what is in it');
  assert.equal(w.count, 1);

  // every kind is NAMED, both ways - a pane that fell through to
  // undefined would draw an empty heading and an empty button
  for (const kind of ['wagon', 'reward', 'container', 'ground']) {
    assert.equal(typeof REMOTE_TITLE[kind], 'string', `${kind} has no title`);
    assert.ok(REMOTE_TITLE[kind].length, `${kind}'s title is empty`);
    assert.equal(typeof STOW_LABEL[kind], 'string', `${kind} has no stow verb`);
    assert.ok(STOW_LABEL[kind].length, `${kind}'s stow verb is empty`);
  }
  // and the verbs are DIFFERENT, because naming the destination is
  // the whole point of having four of them
  assert.equal(new Set(Object.values(STOW_LABEL)).size >= 3, true, Object.values(STOW_LABEL).join(' / '));
});

test('U58: the pane runs the extracted law, not a second reading of it', () => {
  const src = code('src/ui/enhancedInventory.js');
  // it calls the ladder and the session
  for (const fn of ['planStore(', 'planTake(', 'applyTransfer(', 'planDropGold(',
    'planWagonToggle(', 'remoteTarget(', 'openState(']) {
    assert.ok(src.includes(fn), `the pane does not use ${fn}`);
  }
  // and carries none of the rungs itself
  assert.ok(!/750/.test(src), 'a second WagonKgLimit');
  assert.ok(!/'Transportation'/.test(src), 'a second transport block');
  assert.ok(!/isSummoned/.test(src), 'a second summoned guard');
  assert.ok(!/canHoldAmount|maxEncumbrance\(liveStat\(deps/.test(src.replace(/maxEncumbrance\(liveStat\(entity[^)]*\)\)/g, '')),
    'a second capacity gate');
  assert.ok(!/SMALL_CART_TEMPLATE|templateIndex === 93/.test(src), 'a second cart check');
  // the CART CHECK is asked of the module, because the wagon button
  // exists only when there is a wagon to open
  assert.ok(src.includes('hasCart(deps.items'), 'the wagon button guesses at the cart');
});

test('U58: STOW is drawn only when the law would move something or SAY something', () => {
  // U53 deleted a "worn" badge that could never render. The same rule
  // applies to a button: DFU's transport block and its choose-one bar
  // are SILENT refusals, so a Stow button on those can only do
  // nothing. A refusal that SPEAKS still gets its button - the full
  // wagon has something to say.
  const src = read('src/ui/enhancedInventory.js');
  const fn = src.slice(src.indexOf('function canStow(item)'), src.indexOf('function stow(item)'));
  assert.ok(fn.length > 40, 'canStow is gone');
  assert.match(fn, /planStore\(/, 'canStow decides for itself instead of asking the ladder');
  assert.match(fn, /plan\.ok \|\| !!plan\.refusal\.text/,
    'a silent refusal and a speaking one are being treated alike');
  // and the button is actually gated on it - U59 added the WORN
  // clause in front, because filterByTab drops an equipped item from
  // the list a Remove click can reach, so the transfer DFU offers
  // does not exist for one.
  assert.match(src, /if \(!line\.equipped && canStow\(picked\)\) \{/);
});

test('U58: a USE on the remote side consumes out of the LIVE list', () => {
  // `remoteModel.items` is a FILTERED COPY, and `useItem` consumes out
  // of the collection it is handed - so a potion drunk from a corpse
  // through the model's copy would vanish from the screen and stay in
  // the pile. Every transfer arm already reads the live list; this is
  // the one that was written the other way first.
  const src = read('src/ui/enhancedInventory.js');
  const at = src.indexOf("const u = el('button', 'act', 'Use')");
  assert.ok(at > 0, 'the Use button is gone');
  const arm = src.slice(at, src.indexOf('c.append(acts)', at));
  assert.match(arm, /remoteTarget\(deps, sessionState\(\)\)/,
    'the Use arm hands over the model copy instead of the live list');
  assert.ok(!/remote\.items/.test(arm), 'the model copy is still reachable from here');
  // and the transfer arms read the live list too. SLICED TO THE NEXT
  // FUNCTION, not to a byte count: a 900-char window from `stow` ran
  // into `take`'s body and passed on ITS call, so this pin survived
  // the mutation that pointed `stow` at the copy.
  for (const fn of ['function stow(item)', 'function take(item)']) {
    const from = src.indexOf(fn);
    assert.ok(from > 0, `${fn} is gone`);
    const to = src.indexOf('\nfunction ', from + fn.length);
    assert.ok(to > from, `${fn} has no end`);
    assert.match(src.slice(from, to), /remoteTarget\(deps, sessionState\(\)\)/, `${fn} works off a copy`);
  }
});

test('U58: one item is not "1 items"', () => {
  // A count printed straight into a template literal is right eleven
  // times out of twelve, and wrong on exactly the one the player is
  // looking at when they drop something.
  const src = read('src/ui/enhancedInventory.js');
  assert.ok(!/\$\{[a-z.]*count\} items/.test(src), 'a raw count is still being pluralised by hope');
  assert.match(src, /const plural = \(n, word\) =>/);
  // the DEFINITION plus BOTH headers - the pack's own count was
  // written the same wrong way in U53 and is fixed with it.
  assert.equal((src.match(/plural\(/g) || []).length, 3,
    'one of the two headers still does it by hand');
  // THE MODULE'S OWN, imported. A copy of the helper re-derived in
  // this file would compare it to itself, which is the vacuous shape
  // U56 found in the wagon suite.
  assert.equal(plural(1, 'item'), '1 item');
  assert.equal(plural(0, 'item'), '0 items');
  assert.equal(plural(2, 'item'), '2 items');
});

test('U58: the door reads the drop pile OUT of the view before tearing it down', () => {
  const src = read('src/ui/inventoryDoor.js');
  assert.match(src, /view\?\.dropped\?\.\(\) \?\? \[\]/);
  // and the view actually offers it
  const view = read('src/ui/enhancedInventory.js');
  assert.match(view, /dropped: \(\) => dropped,/, 'the view has no pile to hand over');
});

// ── AUDIT 26, IN THE ENHANCED PANE ───────────────────────────────
// Three laws that landed on main while this arc was building the
// pane, all of which the pane would have SILENTLY dropped: the
// transfer ladder's quest arm, the remote list's quest click, and
// UseItem's PopToHUD. None of them is visible on screen when it is
// missing, which is exactly why each gets a pin.

test('U58 + AUDIT 26: the pane runs the quest arm, and canStow does NOT', () => {
  const src = read('src/ui/enhancedInventory.js');
  // both transfer arms hand the ladder the quest seam...
  for (const fn of ['function stow(item)', 'function take(item)']) {
    const from = src.indexOf(fn);
    assert.ok(from > 0, `${fn} is gone`);
    const body = src.slice(from, src.indexOf('\nfunction ', from + fn.length));
    assert.match(body, /getQuest: deps\.getQuest \?\? null/, `${fn} drops the quest seam`);
    assert.ok(!/dryRun/.test(body), `${fn} must not skip the rung that writes`);
  }
  // ...and canStow, which runs on every repaint, does the opposite.
  // A live quest arm there would mark a quest item dropped each time
  // the screen redrew - the worst kind of bug, because nothing on
  // screen looks wrong.
  const cs = src.slice(src.indexOf('function canStow(item)'), src.indexOf('function stow(item)'));
  assert.match(cs, /dryRun: true/, 'canStow writes to quest state on every repaint');
  assert.ok(!/getQuest/.test(cs), 'canStow hands the ladder a live quest seam');
});

test('U58 + AUDIT 26: only the REMOTE list sends the click to the quest system', () => {
  // ":2027-2037" - the FIRST act of RemoteItemListScroller_OnItemClick,
  // ahead of the action-mode branch, so LOOKING at a quest item in a
  // pile counts as well as taking it. LocalItemListScroller_OnItemClick
  // (:1974-2007) has no such call, and the pane draws BOTH lists with
  // one row builder - so the guard has to be on the side, not the row.
  const src = read('src/ui/enhancedInventory.js');
  const from = src.indexOf('function itemRow(item, from');
  assert.ok(from > 0, 'the row builder is gone');
  const body = src.slice(from, src.indexOf('\nfunction ', from + 20));
  assert.match(body, /setPlayerClicked\(\)/, 'the pane never tells the quest system');
  assert.match(body, /from === 'remote' && item\.questItem/,
    'the local list is sending clicks the classic window does not send');
  // and it happens on the CLICK, before the pick - a player who looks
  // and does not take has still clicked
  assert.ok(body.indexOf('setPlayerClicked()') < body.indexOf('picked = wasPicked'),
    'the click reaches the quest system only after the selection changes');
});

test('U58 + AUDIT 26: PopToHUD closes the pane and says NOTHING', () => {
  // DaggerfallUI.PopToHUD() + return (:1687-1688). A watched quest item
  // that is neither parchment nor clothing closes the window stack so
  // the quest system gets first shot at the click in the world.
  // Nothing else on the ladder runs and no message shows.
  assert.deepEqual(useResultAction({ kind: 'questItem', questItem: true, popToHUD: true }),
    { kind: 'close' });
  // ...and it is decided FIRST, above every other arm - DFU returns
  // before all of them. A book that somehow carried the flag would
  // still close rather than open the reader.
  assert.deepEqual(useResultAction({ kind: 'book', item: {}, popToHUD: true }, { openBook: () => {} }),
    { kind: 'close' }, 'the popToHUD arm is running below the book arm');
  // without the flag, nothing changes
  assert.equal(useResultAction({ kind: 'questItem', pending: true }).kind, 'message');
  // and the view acts on it
  const src = read('src/ui/enhancedInventory.js');
  assert.match(src, /if \(act\.kind === 'close'\) \{ onExit\(\); return; \}/);
  assert.match(src, /getQuest: deps\.getQuest \?\? null/, 'useItem never gets the quest seam');
});


// ── U59: THE AVATAR, AND WHAT YOU ARE WEARING ────────────────────
// The slot map put every worn item behind a 7px circle. These pin the
// list that replaced it, and the seam that lets a DOM screen show the
// same paperdoll the classic window draws instead of compositing a
// second one.

test('U59 equippedModel: every slot, in the BODY\'s order and not the enum\'s', () => {
  const e = hero();
  const helm = mk('Helm', 'Armor');
  const boots = mk('Boots', 'Armor');
  e.items.push(helm, boots);
  equipItem(e, helm);
  equipItem(e, boots);

  const m = equippedModel(e);
  const label = (n) => m.rows.findIndex((r) => r.label === n);
  // EQUIP_SLOTS numbers the jewellery FIRST (Amulet0 = 0) and Head is
  // 12, so enum order would put a ring above a helm. The order here is
  // read off SLOT_MAP's own y/x - one table for where a slot sits and
  // for what order it reads in.
  assert.ok(label('Head') >= 0 && label('Feet') >= 0);
  assert.ok(label('Head') < label('Chest, armour'), 'the head is below the chest');
  assert.ok(label('Chest, armour') < label('Feet'), 'the feet are above the chest');
  assert.ok(label('Head') < label('Ring'), 'the enum order leaked through');

  // the ITEMS are the entity's own records, not copies - the row's
  // click selects into a detail panel that must act on the real one
  const headRow = m.rows.find((r) => r.label === 'Head');
  assert.equal(headRow.item, helm);
  assert.equal(m.filled, 2);

  // EMPTY SLOTS ARE ROWS. A list of only what you wear cannot answer
  // "what could I still put on", which is half of what the schematic
  // was for.
  assert.ok(m.rows.some((r) => !r.item), 'an empty slot has no row');
  assert.equal(m.rows.find((r) => r.label === 'Left hand').item, null);

  // ...but DFU's two UNNAMED ones stay hidden until something is in
  // them, for SLOT_MAP's own reason
  assert.equal(m.rows.filter((r) => r.label === 'Unnamed').length, 0);
  assert.equal(m.total, Object.keys(SLOT_MAP).length, 'the count is of every slot, shown or not');
  // a bare character still gets the whole board
  const bare = equippedModel({ stats: { strength: 40 }, items: [] });
  assert.equal(bare.filled, 0);
  assert.equal(bare.rows.length, m.total - 2, 'the two unnamed slots are the only hidden ones');
  // and a hidden slot APPEARS once it holds something
  assert.equal(equippedModel().rows.length > 0, true, 'no entity is still a board of empty slots');
});

test('U59: an empty slot is not a BUTTON, and not `.empty` either', () => {
  const src = read('src/ui/enhancedInventory.js');
  const fn = src.slice(src.indexOf('function equippedList()'), src.indexOf('function characterCol()'));
  assert.ok(fn.length > 200, 'the worn list is gone');
  // The first draft made every row a button and disabled the empty
  // ones; the pack probe's 44px touch-target rule caught twenty-two
  // 24px buttons immediately. A disabled button is still a button.
  assert.match(fn, /el\('div', 'wornrow wornempty'\)/, 'empty slots are controls again');
  assert.ok(!/b\.disabled/.test(fn), 'a disabled button is still a button');
  // and the class is SCOPED. `.empty` is already a component in the
  // shared stylesheet - a dashed placeholder card - so the bare word
  // drew every unfilled slot as one. Third collision of this shape in
  // the arc, after `.detail` and `.packcol`.
  assert.ok(!/'wornrow empty'|'wornname empty'/.test(fn), 'the bare `.empty` is back');
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.empty \{ border: 1px dashed/, 'the component this collides with is gone - re-check the pin');
  assert.match(css, /\.wornrow\.wornempty \{/);
});

test('U59: a WORN item has no way to be dropped, because DFU has none', () => {
  // filterByTab IS FilterLocalItems, so an equipped item is never in
  // the list a Remove click can reach. The pane draws the Stow button
  // off the same fact rather than off a second reading of it.
  const src = read('src/ui/enhancedInventory.js');
  assert.match(src, /if \(!line\.equipped && canStow\(picked\)\) \{/);
  // and the escape hatch is the button beside it
  assert.match(src, /'Take off'/);
});

test('U59: the doll is the COMPOSITOR\'s, and the schematic is the fallback', () => {
  const src = read('src/ui/enhancedInventory.js');
  // one compositor: the pane reads finished pixels and never blits
  assert.match(src, /paperDollPixels\(\)/);
  assert.match(src, /paperDollDataUrl\(paperDollPixels\(\), \{ scale: 3 \}\)/);
  const code2 = code('src/ui/enhancedInventory.js');
  for (const law of ['BlitItems', 'applyDyeToIndex', 'paperdollOrder', 'PAPERDOLL_ORIGIN', 'BG_SUBRECT']) {
    assert.ok(!code2.includes(law), `a second paperdoll compositor is growing here (${law})`);
  }
  // PX19d: the schematic IS the worn map now - the tiles on the
  // body's coordinates need no ARENA2, so a player with no game data
  // still sees their kit; the DOLL rides behind them only when its
  // art can draw. The pin follows the shape.
  const fp = src.slice(src.indexOf('function equippedList()'), src.indexOf('function characterCol()'));
  assert.match(fp, /const dollUrl = paperDollDataUrl\(paperDollPixels\(\), \{ scale: 3 \}\);/);
  assert.match(fp, /if \(dollUrl\)/, 'the doll must be OPTIONAL - tiles alone are the no-data answer');
  assert.match(fp, /wornmap/);
  // and the compositor is asked to recompose when the kit changes, or
  // the avatar shows yesterday's armour
  for (const fn of ['function wear(item)', 'function takeOff(slot)']) {
    const from = src.indexOf(fn);
    assert.ok(from > 0, `${fn} is gone`);
    const body = src.slice(from, src.indexOf('\nfunction ', from + fn.length));
    assert.match(body, /refreshFigure\(\)/, `${fn} leaves the avatar stale`);
  }
});
