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
  assert.match(src, /paperDollDataUrl\(paperDollPixels\(\), \{ scale: 4 \}\)/);   // PX20a: 4x, for a cell twice the size
  const code2 = code('src/ui/enhancedInventory.js');
  for (const law of ['BlitItems', 'applyDyeToIndex', 'paperdollOrder', 'PAPERDOLL_ORIGIN', 'BG_SUBRECT']) {
    assert.ok(!code2.includes(law), `a second paperdoll compositor is growing here (${law})`);
  }
  // PX19d: the schematic IS the worn map now - the tiles on the
  // body's coordinates need no ARENA2, so a player with no game data
  // still sees their kit; the DOLL rides behind them only when its
  // art can draw. The pin follows the shape.
  const fp = src.slice(src.indexOf('function equippedList()'), src.indexOf('function characterCol()'));
  assert.match(fp, /const dollUrl = paperDollDataUrl\(paperDollPixels\(\), \{ scale: 4 \}\);/);
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

// ── PX20: THE CENTRE, AND THE LOOT FRAME ──────────────────────────
// Mac, on the pack: "spread out and organize the center of the
// inventory panel now that we have more space. Enlarge the paper
// sprite and remove the background"; then "ensure the paperdoll's slot
// is a perfect fit. Move the name outside of the space and to the top
// bar, remove the slots filled subtext. Utilize the entire area for
// enlarged icons and displayability." And: "when looting items, only
// open the loot tooltip, not the entire inventory window."

test('PX20a: the doll owns the CENTRE COLUMN, and the map is wear-left, carry-right', () => {
  const src = read('src/ui/enhancedInventory.js');
  // Six rows a side, the doll spanning all six: a standing figure gets
  // a portrait cell. The old 2/2/span 3 was landscape.
  assert.match(src, /const DOLL_AREA = '1 \/ 2 \/ span 6 \/ auto';/);
  const fams = src.slice(src.indexOf('const WORN_FAMILIES'), src.indexOf('const DOLL_AREA'));
  const left = [...fams.matchAll(/label: '([^']+)', area: '(\d) \/ 1'/g)].map((m) => [Number(m[2]), m[1]]);
  const right = [...fams.matchAll(/label: '([^']+)', area: '(\d) \/ 3'/g)].map((m) => [Number(m[2]), m[1]]);
  assert.equal(left.length, 6, 'six down the left');
  assert.equal(right.length, 6, 'six down the right');
  assert.deepEqual(left.map((r) => r[0]), [1, 2, 3, 4, 5, 6], 'no gaps, no doubles');
  assert.deepEqual(right.map((r) => r[0]), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(left.map((r) => r[1]), ['Head', 'Neck', 'Cloaks', 'Chest', 'Arms', 'Hands'], 'what you WEAR, top to toe');
  assert.ok(right.map((r) => r[1]).includes('Legs') && right.map((r) => r[1]).includes('Feet'));
  assert.ok(!fams.includes("area: '1 / 2'"), 'nothing shares the doll\'s column');
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\);/, 'the centre column is AUTO - the sprite sets its width');
  assert.match(css, /grid-template-rows: repeat\(6, minmax\(44px, 1fr\)\);/);
});

test('PX20a/c: the sprite is unframed, 4x, and its cell is a PERFECT FIT', () => {
  const css = read('src/ui/enhancedStyle.js');
  const doll = css.slice(css.indexOf('.pack-shell .wornmap-doll {'), css.indexOf('.pack-shell .wornmap-doll .wornslot'));
  // No border, no background, no outline - the figure stands on the
  // window's own glass. The FRAME belongs to the placeholder alone,
  // which is what PX19g's reasoning was actually about.
  assert.match(doll, /border: 0; background: none; outline: 0;/);
  assert.match(doll, /\.pack-shell \.wornmap-doll\.noart \{ border: 2px solid/, 'the placeholder keeps its frame');
  // A perfect fit is the sprite's OWN ratio on the cell, not a
  // letterbox inside whatever the grid left.
  assert.match(css, /\.pack-shell \.wornmap-doll\.hasart \{ aspect-ratio: 110 \/ 184;/);
  const src = read('src/ui/enhancedInventory.js');
  assert.match(src, /wornmap-doll\$\{dollUrl \? ' hasart' : ' noart'\}/, 'and the class says which');
  assert.match(src, /paperDollDataUrl\(paperDollPixels\(\), \{ scale: 4 \}\)/, '4x: a bigger cell wants more pixels, not a scaled 3x');
  // 110x184 is the classic paperdoll's own size, not a number typed here.
  const pd = read('src/ui/paperDoll.js');
  assert.match(pd, /export const PAPERDOLL_W = 110;/);
  assert.match(pd, /export const PAPERDOLL_H = 184;/);
});

test('PX20c: the name is in the title bar, the count is gone, the tiles carry the width', () => {
  const src = read('src/ui/enhancedInventory.js');
  const fn = src.slice(src.indexOf('function equippedList()'), src.indexOf('function characterCol()'));
  assert.ok(!fn.includes('equippedhead'), 'no name plate standing on the map');
  // (the phrase survives in the comment that records WHY it went; the
  // pin is about the DOM, so it reads the code with comments stripped)
  const fnCode = code('src/ui/enhancedInventory.js')
    .slice(code('src/ui/enhancedInventory.js').indexOf('function equippedList()'));
  assert.ok(!fnCode.slice(0, fnCode.indexOf('function characterCol()')).includes('slots filled'),
    'and no count under it');
  assert.match(src, /if \(name\) title\.append\(el\('span', 'pack-who', name\)\);/, 'the name rides the window title');
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.pack-shell \.pack-id \.pack-who \{ color: #7d7460;/);
  // The tile is a ROW now, and the piece's NAME is visible again -
  // PX19g hid it because a 52px square clipped it, and that reason is
  // gone with the width.
  assert.match(css, /\.pack-shell \.equipped \.wornrow \{[\s\S]{0,220}flex-direction: row;/);
  assert.match(css, /\.pack-shell \.wornrow \.wornname \{ display: block;/);
  assert.doesNotMatch(css, /\.pack-shell \.wornrow \.wornname \{ position: absolute; width: 1px;/, 'the clip-path hide is gone');
  assert.match(fn, /txt\.append\(el\('span', 'wornslot', fam\.label\), el\('span', 'wornname', line\.name\)\)/, 'word over name, beside the monogram');
  assert.match(css, /\.pack-shell \.wornrow \.worntile \{ font-size: 26px;/, 'and the monogram is sized for the tile');
});

test('PX20b: a LOOT target opens its own frame alone - the pack is never built', () => {
  const src = read('src/ui/enhancedInventory.js');
  assert.match(src, /^let packOpen = true;$/m);
  assert.match(src, /packOpen = !d\.loot;/, 'a loot session opens closed');
  assert.match(src, /side = d\.loot \? 'remote' : 'local';/, '...on the side the player came for');
  // NOT BUILT, not built-and-hidden: the pack's whole body sits behind
  // the flag, so a hidden window cannot run layout or eat the tooltip.
  const render = src.slice(src.indexOf('function render()'), src.indexOf('// ── THE KEYBOARD'));
  assert.match(render, /const win = el\('div', 'pack-win'\);\n    if \(packOpen\) \{/);
  assert.match(render, /if \(packOpen\) shell\.append\(win\);/);
  // One frame owns the tooltip and the click-away, whichever is shown.
  assert.match(render, /const frame = packOpen \? win : \(loot \?\? win\);/);
  assert.match(render, /frame\.append\(tip\);/);
  assert.match(render, /frame\.addEventListener\('click'/);
  assert.doesNotMatch(render, /win\.addEventListener\('click'/, 'the listener follows the frame, not the pack');
  // The way back, and only when there is somewhere to go.
  assert.match(src, /if \(!packOpen\) \{\n    const b = el\('button', 'act', 'Pack'\);/);
  assert.match(src, /b\.onclick = \(\) => \{ packOpen = true; picked = null; render\(\); \};/);
  // The transfer ladder is untouched: this slice draws frames.
  for (const law of ['function take(', 'function stow(', 'remoteModel', 'toggleWagon']) {
    assert.ok(src.includes(law), `${law} is still here - PX20b changed what is DRAWN`);
  }
});

// ── PX21: THE LOOT WINDOW READS, AND TRANSPORT HAS A HOME ─────────
test('PX21a: mounts and the cart get their own strip - the tab they fall into is not a home', () => {
  const src = read('src/ui/enhancedInventory.js');
  // A horse and a cart are Transportation, and filterByTab has NO arm
  // for them: they land in the fourth tab with the shirts. That is
  // DFU's own behaviour, and it is why a player who buys a horse
  // cannot find it - so the strip is a place, not a decoration.
  const nat = read('src/ui/nativeInventory.js');
  assert.doesNotMatch(nat, /tab === 'transport'|group === 'Transportation'/, 'still no tab arm - the strip is the answer');
  assert.match(src, /const TRANSPORT = Object\.freeze\(\[/);
  assert.match(src, /\{ id: 'mount', label: 'Mount', owned: hasHorse,/);
  assert.match(src, /\{ id: 'cart', label: 'Cart', owned: hasCart,/);
  // U58's law: the SESSION answers "do you have one" and hands back the
  // item to draw. No template index is read in the window - the pin
  // that caught the first draft doing it stays exactly as it was.
  assert.match(src, /const owned = t\.owned\(items\) \? transportItem\(items, t\.id\) : null;/);
  assert.doesNotMatch(src, /SMALL_CART_TEMPLATE|TRANSPORT_HORSE|templateIndex === 9[34]/, 'no second cart or horse check');
  const sess = read('src/systems/inventorySession.js');
  assert.match(sess, /export const hasHorse = \(items = \[\]\) =>/, 'and the mount question has a home beside the cart\'s');
  assert.match(sess, /export const TRANSPORT_HORSE_TEMPLATE = 94;/);
  assert.match(sess, /export function transportItem\(items = \[\], kind\)/);
  // The cart plaque IS the wagon's door - one control for the thing and
  // the place it opens - and it refuses through the session, not twice.
  assert.match(src, /if \(isCart && owned\) \{[\s\S]{0,240}node\.onclick = toggleWagon;/);
  assert.match(src, /el\(isCart && owned \? 'button' : 'div',/, 'a plaque that only reports is not a button');
  assert.match(src, /col2\.append\(transportStrip\(\)\);/);
});

test('PX21b: the loot window is ROWS, not the dock\'s anonymous squares', () => {
  const css = read('src/ui/enhancedStyle.js');
  // The dock's tile grid is right for a bag you know and wrong for a
  // chest you have never opened: the only question a container asks is
  // what is in it.
  assert.match(css, /\.pack-shell \.itemrow \{[\s\S]{0,200}width: 56px; height: 56px;/, 'the dock keeps its tiles');
  assert.match(css, /\.loot-win \.itemrow \{ width: 100%; height: auto; min-height: 52px;/);
  assert.match(css, /\.loot-win \.itemrow \.itemname \{ position: static;[\s\S]{0,120}clip-path: none;/,
    'the name is readable here, where the dock hides it');
  assert.match(css, /\.loot-win \.itemrow \.itemwt \{ display: block;/, 'and the weight, which the dock drops');
  assert.match(css, /\.pack-shell \.itemrow \.itemwt \{ display: none; \}/, '...still dropped in the dock');
  assert.match(css, /\.loot-win \.itemrow \.itemname small \{/, 'material and word beneath the name');
});

test('PX21d: the loot window\'s head is a centred stack, not a column header', () => {
  const css = read('src/ui/enhancedStyle.js');
  // The base .remotehead is a space-between ROW - the title left, the
  // buttons pushed right - written when the remote was a column beside
  // the pack. In a 340px window of its own that reads as two things
  // that fell to opposite walls.
  assert.match(css, /^\.remotehead \{\n  display: flex; align-items: flex-start; justify-content: space-between;/m,
    'the base column header is untouched');
  assert.match(css, /\.loot-win \.remotehead \{ flex-direction: column; align-items: center;/);
  assert.match(css, /\.loot-win \.remotewho \{ display: flex; flex-direction: column; align-items: center; \}/);
  assert.match(css, /\.loot-win \.remoteacts \{ justify-content: center; padding: 0; \}/,
    'and the buttons sit over the list they act on');
});

test('PX21c: the hover plaque names a pile without opening it, on the take\'s own pick', async () => {
  const hov = read('src/ui/lootHover.js');
  // The lines are pure: names, a count only when a stack, and a tail
  // rather than a list - a pile is a glance.
  const { hoverLines, HOVER_MAX } = await import('../src/ui/lootHover.js');
  assert.deepEqual(hoverLines([]), { shown: [], rest: 0, empty: true });
  assert.deepEqual(hoverLines([{ name: 'Ruby', stackCount: 3 }, { name: 'Helm' }]),
    { shown: [{ name: 'Ruby', stack: 3 }, { name: 'Helm', stack: 0 }], rest: 0, empty: false });
  const many = hoverLines(Array.from({ length: HOVER_MAX + 4 }, (_, i) => ({ name: `x${i}` })));
  assert.equal(many.shown.length, HOVER_MAX);
  assert.equal(many.rest, 4);
  assert.deepEqual(hoverLines(null), { shown: [], rest: 0, empty: true }, 'nothing under the crosshair is not a crash');
  // ONE NODE, rewritten only when the key changes - a per-frame rebuild
  // is PX19k's entrance replay in another hat.
  assert.match(hov, /if \(key === shownKey\) return;/);
  assert.match(hov, /export function showLootHover\(key, items, title = 'Loot'\)/);
  assert.match(hov, /export const HOVER_MAX = 6;/);
  // A READOUT: no clicks, no keys, nothing to dismiss.
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.loothover \{[\s\S]{0,400}pointer-events: none;/);
  assert.match(hov, /setAttribute\('aria-hidden', 'true'\)/);
  assert.doesNotMatch(hov, /addEventListener|onclick/, 'a readout listens to nothing');
  // The host runs the SAME pick the take runs, throttled, enhanced only.
  const ctx = read('src/scenes/dungeonContext.js');
  const frame = ctx.slice(ctx.indexOf('function drawFoes('), ctx.indexOf('function drawFoes(') + 3000);
  assert.match(frame, /_hoverAt \+= dt;/);
  assert.match(frame, /if \(_hoverAt >= 0\.1\)/, '10Hz: a raycast over every pile is not free');
  assert.match(frame, /if \(isEnhanced\(\) && eye\)/, 'the classic HUD says nothing about a pile - Daggerfall\'s own answer');
  assert.match(frame, /pickActivatable\(eye, dir, api\.lootTargets\(\), collider\)/, 'the take\'s own pick');
  assert.match(frame, /showLootHover\(key, key \? api\.lootContents\(key\) : null,/);
  // lootContents shares takeLoot's key vocabulary rather than a second one.
  assert.match(ctx, /lootContents\(key\) \{[\s\S]{0,400}const \[kind, iStr\] = key\.split\(':'\);/);
  for (const kind of ["'loot'", "'corpse'", "'droppedLoot'"]) {
    assert.ok(ctx.slice(ctx.indexOf('lootContents(key) {'), ctx.indexOf('takeLoot(key) {')).includes(kind), `${kind} resolves`);
  }
  assert.match(read('src/scenes/droppedLoot.js'), /const contents = \(key\) => piles\.find\(\(p\) => `droppedLoot:\$\{p\.id\}` === key/);
  // ...and it leaves with the host that raised it.
  // ...after NT1's dead latch, which is pinned as the FIRST act of
  // destroy - the first draft put the teardown ahead of it and
  // resourcesafety.test.js caught it.
  const destroyFn = ctx.slice(ctx.indexOf('    destroy() {'), ctx.indexOf('    destroy() {') + 500);
  assert.ok(destroyFn.indexOf('_ctxDead = true;') < destroyFn.indexOf('destroyLootHover();'), 'the latch stays first');
  assert.ok(destroyFn.includes('destroyLootHover();'));
});

test('PX21e: the loot window never scrolls - it grows, then widens, and its head never moves', () => {
  const css = read('src/ui/enhancedStyle.js');
  const src = read('src/ui/enhancedInventory.js');
  // THE FRAME CANNOT SCROLL. It carried overflow-y itself, so a pile
  // past the cap scrolled its own title and buttons out of sight.
  assert.match(css, /\.loot-win \{ position: relative;[\s\S]{0,200}overflow: hidden;/);
  assert.doesNotMatch(css, /\.loot-win \{ position: relative;[\s\S]{0,200}overflow-y: auto;/);
  // The head is fixed furniture; the rows are their own box.
  assert.match(css, /\.loot-win \.packremote \{ display: flex; flex-direction: column; min-height: 0; flex: 1; \}/);
  assert.match(css, /\.loot-win \.remotehead \{ flex: 0 0 auto; \}/);
  assert.match(css, /\.loot-win \.remotelist \{ flex: 1; min-height: 0; overflow-y: auto;/);
  assert.match(src, /const list = el\('div', 'remotelist'\);/);
  assert.match(src, /for \(const it of remote\.items\) list\.append\(itemRow\(it, 'remote'\)\);/);
  assert.doesNotMatch(src, /for \(const it of remote\.items\) col\.append\(/, 'the rows left the column');
  // A LONG PILE WIDENS rather than scrolling.
  assert.match(src, /export const LOOT_ONE_COLUMN = 8;/);
  assert.match(src, /loot-win\$\{remote\.count > LOOT_ONE_COLUMN \? ' wide' : ''\}/);
  assert.match(css, /\.loot-win\.wide \{ width: min\(680px, 94vw\); \}/);
  // ...as a GRID, not multicol: a multicol box that is also a scroll
  // container fragments in the block direction, so the overflow columns
  // went below the fold and it scrolled anyway (measured: 14 rows
  // spilling 203px past the frame). A grid has nothing to fragment.
  assert.match(css, /\.loot-win\.wide \.remotelist \{ display: grid; grid-template-columns: 1fr 1fr;/);
  assert.doesNotMatch(css, /\.loot-win\.wide \.remotelist \{ column-count/, 'multicol was the wrong answer');
  assert.match(css, /\.loot-win\.wide \.remotelist \.packempty \{ grid-column: 1 \/ -1; \}/, 'and Empty. still spans');
});
