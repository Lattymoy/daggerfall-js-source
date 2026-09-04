// U8d: the native inventory window - the verbatim rects, the tab
// filter law, and the shared ItemListScroller component.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NativeInventoryWindow, INV_RECTS, TABS, filterByTab, isIngredientTemplate, NO_WAGON_TEXT, USE_PENDING,
  goldPanelRows,
} from '../src/ui/nativeInventory.js';
import { scrollerHit, applyScroll, LIST_SLOTS, CELL_X, ARROW_H, DOWN_ARROW_Y, SLOT_H } from '../src/ui/itemScroller.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeKey, typedChar } from '../src/ui/input.js';

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };

test('nativeInventory: the verbatim DFU rects + the tab/mode click machine', () => {
  // DaggerfallInventoryWindow.cs #region UI Rects
  assert.deepEqual([...INV_RECTS.tabWeapons], [0, 0, 92, 10]);
  assert.deepEqual([...INV_RECTS.tabMagic], [93, 0, 69, 10]);
  assert.deepEqual([...INV_RECTS.tabClothing], [163, 0, 91, 10]);
  assert.deepEqual([...INV_RECTS.tabIngredients], [255, 0, 65, 10]);
  assert.deepEqual([...INV_RECTS.wagon], [226, 14, 31, 14]);
  assert.deepEqual([...INV_RECTS.info], [226, 36, 31, 14]);
  assert.deepEqual([...INV_RECTS.equip], [226, 58, 31, 14]);
  assert.deepEqual([...INV_RECTS.remove], [226, 80, 31, 14]);
  assert.deepEqual([...INV_RECTS.use], [226, 103, 31, 14]);
  assert.deepEqual([...INV_RECTS.gold], [226, 126, 31, 14]);
  assert.deepEqual([...INV_RECTS.localList], [163, 48, 59, 152]);
  assert.deepEqual([...INV_RECTS.remoteList], [261, 48, 59, 152]);
  assert.deepEqual([...INV_RECTS.exit], [222, 178, 39, 22]);
  const bag = [{ group: 'Weapons', templateIndex: 113, name: 'Dagger' }];
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS });
  // defaults: WeaponsAndArmor tab, Equip mode (OnPush/SelectActionMode)
  assert.equal(w.tab, 'weapons');
  assert.equal(w.mode, 'equip');
  // tab clicks switch + reset scroll
  assert.ok(w.click(255 + 5, 5));
  assert.equal(w.tab, 'ingredients');
  assert.ok(w.click(0 + 5, 5));
  assert.equal(w.tab, 'weapons');
  // mode buttons select; U25: WAGON and GOLD are not modes at all -
  // they ACT, so the mode is unchanged and a box opens
  assert.ok(w.click(230, 40));
  assert.equal(w.mode, 'info');
  assert.ok(w.click(230, 16));      // wagon
  assert.equal(w.mode, 'info');
  assert.equal(w.topBox.rows[0].text, NO_WAGON_TEXT);
  assert.ok(w.click(163 + CELL_X + 5, 48 + 5));   // the box eats the click
  assert.equal(w.topBox, null);
  // info-mode slot click opens the real info box; the next click clears
  assert.ok(w.click(163 + CELL_X + 5, 48 + 5));
  assert.ok(w.topBox, 'an info box opened');
  assert.ok(w.click(163 + CELL_X + 5, 48 + 5));
  assert.equal(w.topBox, null);
  // outside every rect: not consumed; exit closes; Escape too
  assert.equal(w.click(10, 100), false);
  assert.ok(w.click(240, 185));
  assert.ok(w.done);
  const w2 = new NativeInventoryWindow({ items: () => bag, icons: ICONS });
  w2.input('Escape');
  assert.ok(w2.done);
});

test('nativeInventory: the AddLocalItem tab filter law (verbatim four-way)', () => {
  const bag = [
    { group: 'Weapons', templateIndex: 113 },
    { group: 'Armor', templateIndex: 102 },
    { group: 'Weapons', templateIndex: 113, enchantments: [{ type: 1, param: 5 }] },   // enchanted weapon -> magic
    { group: 'MiscItems', templateIndex: 132 },                     // Spellbook -> magic
    { group: 'PlantIngredients1', templateIndex: 0 },               // ingredient low bound
    { group: 'MiscellaneousIngredients1', templateIndex: 77 },      // ingredient high bound
    { group: 'Books', templateIndex: 277 },                         // -> clothing & misc
    { group: 'MensClothing', templateIndex: 141 },                  // -> clothing & misc
  ];
  assert.equal(isIngredientTemplate(77), true);
  assert.equal(isIngredientTemplate(78), false);
  assert.deepEqual(filterByTab(bag, 'weapons').map((i) => i.templateIndex), [113, 102]);
  assert.deepEqual(filterByTab(bag, 'magic').map((i) => i.templateIndex), [113, 132]);
  assert.deepEqual(filterByTab(bag, 'ingredients').map((i) => i.templateIndex), [0, 77]);
  assert.deepEqual(filterByTab(bag, 'clothing').map((i) => i.templateIndex), [277, 141]);
  assert.equal(TABS.length, 4);
});

test('itemScroller: the shared rail law (hit kinds + clamped paging)', () => {
  const rect = [163, 48, 59, 152];
  // the LEFT 9px rail: 16px arrows at y0/y136, the bar between
  assert.deepEqual(scrollerHit(rect, 163 + 4, 48 + 5), { kind: 'up' });
  assert.deepEqual(scrollerHit(rect, 163 + 4, 48 + DOWN_ARROW_Y + 5), { kind: 'down' });
  // AUDIT 39 F126 moved these two: the rail used to split on its own
  // midpoint (y=76), where VerticalScrollBar.cs:142-150 pages off the
  // THUMB. A 20-item list at scroll 0 puts the thumb at the bar's top,
  // so y=70 is BELOW it and pages down - it answered 'page-up' before
  // and applyScroll clamped the click into nothing.
  assert.deepEqual(scrollerHit(rect, 163 + 4, 48 + 70, 0, 20), { kind: 'page-down' });
  assert.deepEqual(scrollerHit(rect, 163 + 4, 48 + 100, 0, 20), { kind: 'page-down' });
  assert.equal(scrollerHit(rect, 162, 100), null, 'outside the scroller');
  assert.equal(scrollerHit(rect, 163 + 4, 48 + ARROW_H, 0, 20).kind, 'page-up', 'y16 is past the up arrow');
  // buttons at x>=9 map slots by 38px
  assert.deepEqual(scrollerHit(rect, 163 + CELL_X, 48 + 39), { kind: 'slot', slot: 1 });
  // paging clamps to the list
  assert.equal(applyScroll(0, 'up', 10), 0);
  assert.equal(applyScroll(0, 'down', 10), 1);
  assert.equal(applyScroll(0, 'page-down', 10), LIST_SLOTS);
  assert.equal(applyScroll(9, 'page-down', 10), 10 - LIST_SLOTS);
  assert.equal(applyScroll(3, 'down', 3), 0);   // short lists never scroll
});

// ---------------------------------------------------------------------------
// U25: the Use mode, and the four construction sites that must agree.
// ---------------------------------------------------------------------------

test('U25: Use mode uses, and an EQUIP click on a light source uses too', () => {
  const torch = { group: 'UselessItems2', templateIndex: 247, name: 'Torch', currentCondition: 10 };
  const entity = { isPlayer: true, activeEffects: [], equip: { slots: {} } };
  const bag = [torch];
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity });
  // the default mode is EQUIP, and DFU routes a light source there to
  // UseItem rather than EquipItem (:1976-1985) - which is how a torch
  // is lit in play
  assert.equal(w.mode, 'equip');
  // a torch is neither weapon/armor, magic nor an ingredient, so it
  // lives on the Clothing & Misc tab (AddLocalItem's `else`)
  w.click(163 + 5, 5);
  assert.equal(w.tab, 'clothing');
  w.click(163 + CELL_X + 5, 48 + 5);
  assert.equal(entity.lightSource, torch, 'lit from an EQUIP click');
  assert.ok(w.topBox.rows[0].text.startsWith('You light'));
  w.click(0, 0);   // dismiss
  // and Use mode douses it
  w.click(230, 108);            // the use button
  assert.equal(w.mode, 'use');
  w.click(163 + CELL_X + 5, 48 + 5);
  assert.equal(entity.lightSource, null);
});

test('U25: the gold button drops gold into the remote pile, refusing bad amounts', () => {
  // E4: `int playerGold = PlayerEntity.GoldPieces` (:1288) - the purse
  // is the COUNTER, and the amount that leaves it mints a fresh pile
  // (ItemBuilder.CreateGoldPieces) in the remote container (:1307).
  const bag = [];
  const entity = { isPlayer: true, items: bag, goldPieces: 500 };
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity });
  w.click(230, 130);            // the gold button
  assert.equal(w.topBox.field, true);
  assert.equal(w.goldEntry, '0', 'TextBox.Text = "0"');
  // 0 is refused outright - DFU returns without clamping
  w.input('Enter');
  assert.equal(entity.goldPieces, 500);
  // so is more than you carry
  w.click(230, 130);
  w.goldEntry = '9999';
  w.input('Enter');
  assert.equal(entity.goldPieces, 500);
  // a real amount lands in the remote pile
  w.click(230, 130);
  w.goldEntry = '120';
  w.input('Enter');
  assert.equal(entity.goldPieces, 380);
  assert.equal(w._remote().find((it) => it.group === 'Currency')?.stackCount, 120);
  assert.equal(bag.length, 0, 'and the pack never held a coin');
});

test('U25 / THE ONE CONSTRUCTION SEAM: ONE inventory builder per host', () => {
  // THE RULE IS THE SAME; THE SHAPE IT GUARDS CHANGED. This pin used
  // to walk FOUR construction sites and check each carried the same
  // eight hooks, because two of the four were hand-rolled copies of a
  // factory sitting in the same file - and the bug it was written for
  // is worth keeping: U42 put `openSpellbook:` on three of the five
  // sites, and the two loot-pile windows went on printing "You cannot
  // open your spellbook here." over a Spellbook the player was
  // holding.
  //
  // U53 DELETED THE COPIES. Both were the factory's eleven hooks
  // verbatim plus `loot` and `onClose`, which is exactly what its
  // `extra` parameter is for, so each host has ONE builder and the
  // loot arm calls it. A hook added to a host now reaches every window
  // that host opens because there is only one place to add it - the
  // failure this rule exists for is structurally impossible rather
  // than swept for.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const REQUIRED = ['items:', 'entity:', 'icons:', 'rows:', 'nowMinute:', 'openSpellbook:',
    'revealMap:', 'drinkPotion:'];
  for (const f of ['src/scenes/exterior.js', 'src/scenes/world.js']) {
    const src = readFileSync(join(root, f), 'utf8');
    const builders = (src.match(/createInventoryWindow\(\{/g) ?? []).length;
    assert.equal(builders, 1, `${f}: ONE builder, not ${builders}`);
    assert.doesNotMatch(src, /new NativeInventoryWindow\(/,
      `${f} must not construct the window past the door`);
    // the one builder carries every shared hook...
    const j = src.indexOf('createInventoryWindow({');
    const block = src.slice(j, src.indexOf('\n  });', j));
    for (const hook of REQUIRED) {
      // A hook may arrive through a SPREAD BAG the host shares with
      // another reader (world.js's `useHooks`, which the use-magic-item
      // pick also takes) - that IS the one-builder law rather than a
      // breach of it, so resolve one level of `...bag` before failing.
      const reachable = block.includes(hook) || [...block.matchAll(/\.\.\.(\w+),/g)].some(([, bag]) => {
        const d = src.indexOf(`const ${bag} = {`);
        return d >= 0 && src.slice(d, src.indexOf('\n  };', d)).includes(hook);
      });
      assert.ok(reachable, `${f}'s builder is missing ${hook}`);
    }
    // ...and the loot arm goes THROUGH it, carrying only what differs
    assert.match(src, /townTalk\.showOverlay\(makeInventoryWindow\(\{/,
      `${f}: the loot pile must reach the same builder`);
    const loot = src.slice(src.indexOf('townTalk.showOverlay(makeInventoryWindow({'));
    // G5: DaggerfallLoot's identity travels with the pile through the
    // ONE shared shape, so a fifth call site cannot ship a partial one.
    assert.match(loot.slice(0, 700), /loot: droppedLootHooks\(pile\)/);
    assert.match(loot.slice(0, 700), /onClose: \(\) => droppedLoot\.releaseEmptied\(\)/);
  }
  // the dungeon host has one too, and it is the door's
  const dc = readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
  assert.doesNotMatch(dc, /new NativeInventoryWindow\(/);
  assert.match(dc, /createInventoryWindow\(\{/);
});

test('U44: the window FORWARDS its item-use hooks into the law', () => {
  // The window is where a hook stops being a host's business and
  // becomes useItem's argument. Naming a hook in the host and dropping
  // it here is invisible: the arm falls back to its `pending` line,
  // which is exactly the "You drink the potion." lie U44 removed.
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..',
    'src/ui/nativeInventory.js'), 'utf8');
  const call = src.slice(src.indexOf('this._useResult(useItem('), src.indexOf('}));', src.indexOf('this._useResult(useItem(')));
  assert.match(call, /revealMap: this\.hooks\.revealMap \?\? null/, 'the reveal hook is forwarded');
  assert.match(call, /drinkPotion: this\.hooks\.drinkPotion \?\? null/, 'and the drink hook');
});

test('U42: USING the Spellbook item closes the inventory FIRST, then opens the book', () => {
  // DaggerfallInventoryWindow.cs:1748-1764 posts the open; the port
  // has ONE overlay slot, so the order matters exactly as AUDIT B-C1
  // found for the book reader: hand off before the close law runs and
  // the window that just took the slot is torn back down, and a
  // session's dropped pile never mints.
  const order = [];
  const w = new NativeInventoryWindow({
    items: () => [], wagonItems: () => [], entity: { items: [] },
    icons: { getTexture: () => null, uploadRecord: () => null, textures: {} },
    rows: () => [], nowMinute: () => 0,
    onClose: () => order.push('close'),
    openSpellbook: () => order.push('open'),
  });
  w._useResult({ kind: 'spellbook' });
  assert.deepEqual(order, ['close', 'open'], 'the close law runs BEFORE the hand-off');
  assert.equal(w.done, true);
  assert.equal(w.boxes?.length ?? 0, 0, 'and no message box is left behind');

  // a host with no hook keeps the window and says so
  const bare = new NativeInventoryWindow({
    items: () => [], wagonItems: () => [], entity: { items: [] },
    icons: { getTexture: () => null, uploadRecord: () => null, textures: {} },
    rows: () => [], nowMinute: () => 0,
  });
  bare._useResult({ kind: 'spellbook' });
  assert.equal(bare.done, false);
  assert.equal(bare.boxes[0].rows[0].text, USE_PENDING.spellbook);
});

test('U26 / THE FOUR HOSTS: every host that opens an inventory opens the NATIVE one', () => {
  // U25 pinned the opposite of this and fired the moment U26 swapped
  // the dungeon, which is what a both-ways pin is for. The keyed
  // InventoryWindow is now gone from every host.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const dungeon = readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
  assert.equal(dungeon.includes('new InventoryWindow('), false, 'the keyed window is retired here');
  // U53: through the DOOR, which is the one thing that constructs
  // NativeInventoryWindow now. The law this pin holds - the keyed
  // window is retired and the native one is what every host opens -
  // is unchanged; the address moved one module out.
  assert.ok(dungeon.includes('createInventoryWindow({'));
  assert.equal(dungeon.includes('new NativeInventoryWindow('), false,
    'the dungeon must not construct the window past the door');
  // ...and the dungeon builds it in ONE place, so its loot targets and
  // its F6 press cannot drift apart
  assert.equal((dungeon.match(/createInventoryWindow\(\{/g) ?? []).length, 1);
  for (const hook of ['items:', 'entity:', 'icons:', 'rows:', 'nowMinute:', 'onDrop:', 'onClose:']) {
    assert.ok(dungeon.includes(hook), `the dungeon builder is missing ${hook}`);
  }
  // worldModes opens no inventory of its own - it MOUNTS the other
  // two, so a click inside a building reaches theirs.
  const modes = readFileSync(join(root, 'src/scenes/worldModes.js'), 'utf8');
  assert.equal(modes.includes('NativeInventoryWindow'), false, 'the interior host opens none');
  assert.equal(modes.includes('createInventoryWindow'), false, '...and builds none either');
  // ...and the keyed window is DELETED, not merely unimported. Its one
  // law lives in systems/equip.js, which every host reaches.
  const keyed = readFileSync(join(root, 'src/ui/deathScreen.js'), 'utf8');
  assert.equal(keyed.includes('export class InventoryWindow'), false, 'the keyed window is gone');
  // U42 took the SPELLBOOK out of this module the same way U26 took
  // the inventory - onto its own classic art - so what is left here
  // is the death screen alone. Both-ways: the module must not have
  // grown either window back.
  assert.equal(keyed.includes('export class SpellbookWindow'), false, 'and so is the keyed spellbook (U42)');
  assert.ok(keyed.includes('export class DeathScreen'), 'the death screen is what this module is now');
  assert.ok(readFileSync(join(root, 'src/ui/spellbookWindow.js'), 'utf8').includes('export class SpellbookWindow'),
    'the spellbook lives on the classic art');
});

test('U26: the dungeon routes RAW KEY CODES to a native overlay', () => {
  // routeKey handed every overlay an ACTION ('back'/'confirm'/'up'),
  // which is the keyed windows' vocabulary and cannot express F6, a
  // mode button or a digit - so the native window could not have
  // worked in this host without the branch.
  let got = null;
  const ctx = {
    uiOverlayActive: true, overlayIsNative: true,
    overlayInput: (a) => { got = a; },
  };
  routeKey({ code: 'KeyU', key: 'u' }, ctx, () => ({}));
  assert.equal(got, 'KeyU', 'the raw code, not char:u');
  // a KEYED overlay still gets the action map
  const keyed = { uiOverlayActive: true, overlayIsNative: false, overlayInput: (a) => { got = a; } };
  routeKey({ code: 'Escape', key: 'Escape' }, keyed, () => ({}));
  assert.equal(got, 'back');
  // typedChar reads BOTH hosts' vocabularies
  assert.equal(typedChar('char:7'), '7');
  assert.equal(typedChar('Digit7'), '7');
  assert.equal(typedChar('Numpad7'), '7');
  assert.equal(typedChar('KeyA', { key: 'a' }), 'a');
  assert.equal(typedChar('Escape'), null);
});

test('U26: the dungeon host wires the four things the swap needed', () => {
  // No execution coverage in node, so the seams are read - the idiom
  // this repo already uses for its scene hosts.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const ctx = readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
  const scene = readFileSync(join(root, 'src/scenes/dungeon.js'), 'utf8');
  const modes = readFileSync(join(root, 'src/scenes/worldModes.js'), 'utf8');

  // 1. A GROUND PILE. droppedLoot is host-agnostic and had simply
  //    never been mounted here, so a Remove-mode drop had nowhere to
  //    land - which is what made this a slice and not an edit.
  assert.ok(ctx.includes('createDroppedLoot('), 'droppedLoot is mounted');
  assert.ok(ctx.includes('droppedLoot.lootTargets()'), 'and its piles are activatable');
  assert.ok(ctx.includes('droppedLoot.batches()'), 'and they draw');
  assert.ok(ctx.includes('droppedLoot.releaseEmptied()'), 'and empty ones are freed on close');
  // EVERY ALLOCATION HAS AN OWNER: the piles leave with the dungeon
  assert.ok(/destroy\(\)[\s\S]*droppedLoot\._piles\) \{ p\.dead = true; if \(p\.batch\) renderer\.destroyBillboardBatch/.test(ctx),
    'the piles\' BATCHES are destroyed in destroy() - marked dead first (NT1), not just the array emptied');

  // 2. BOTH dungeon hosts route the new key prefix. The standalone
  //    scene and the world-modes machine each own a loot arm, and a
  //    prefix added to one is exactly the drift this repo keeps
  //    finding.
  for (const [name, src] of [['dungeon.js', scene], ['worldModes.js', modes]]) {
    assert.ok(src.includes("droppedLoot:'"), `${name} routes droppedLoot: to takeLoot`);
  }

  // 3. takeLoot OPENS THE WINDOW rather than vacuuming the pile - the
  //    old body transferred every item on one keypress.
  assert.ok(ctx.includes('activeOverlay = openInventory(source'), 'a loot target opens the window');
  assert.equal(/for \(const item of source\) \{ addItem\(playerEntity/.test(ctx), false, 'the vacuum is gone');

  // 4. A native overlay draws against the REAL canvas with no screen
  //    offset - it letterboxes itself, and applying the offset twice
  //    left the dimmed world showing in the bars (AUDIT 19 F2 again).
  assert.ok(/isChoiceWindow\)\s*\{\s*\n\s*activeOverlay\.draw\(renderer, canvas,/.test(ctx),
    'the native branch passes the real canvas');
  // ...and the shot counter advances under an overlay, or a probe
  // cannot frame-sync through one (the Process rule forbids sleeping).
  assert.ok(/uiOverlayActive\) \{[\s\S]{0,600}?frames\+\+/.test(scene), 'the frame counter still ticks');
});

// ---------------------------------------------------------------
// U47 - THE HOVER INFO PANEL
// ---------------------------------------------------------------

/** The vertical centre of list slot `slot` (SLOT_H = 38). */
const CELL_Y = (slot) => INV_RECTS.localList[1] + slot * SLOT_H + 10;

test('U47: hovering a list slot fills the info panel, and the panel is STICKY', () => {
  const bag = [
    { group: 'Weapons', templateIndex: 113, name: 'Dagger' },
    { group: 'Weapons', templateIndex: 121, name: 'Longsword' },
  ];
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, rows: () => [{ text: 'x' }] });
  assert.equal(w.infoItem ?? null, null, 'nothing looked at yet');
  w.hover(INV_RECTS.localList[0] + 20, CELL_Y(0));
  assert.equal(w.infoItem?.name, 'Dagger');
  w.hover(INV_RECTS.localList[0] + 20, CELL_Y(1));
  assert.equal(w.infoItem?.name, 'Longsword');
  // DFU has NO OnMouseLeave arm: moving off an item leaves the panel
  // exactly as it was, which is what makes a 37-pixel panel usable.
  w.hover(10, 100);
  assert.equal(w.infoItem?.name, 'Longsword', 'the panel is sticky over dead space');
  // ...and over an EMPTY SLOT INSIDE the list, which is the arm that
  // matters: DFU's scroller raises OnHover only for a slot that HOLDS
  // an item, so slot 2 of a two-item bag reaches the miss branch and
  // must leave the panel alone.
  assert.equal(bag.length, 2);
  assert.ok(scrollerHit(INV_RECTS.localList, INV_RECTS.localList[0] + 20, CELL_Y(2))?.kind === 'slot',
    'slot 2 really is a slot, and really is empty');
  w.hover(INV_RECTS.localList[0] + 20, CELL_Y(2));
  assert.equal(w.infoItem?.name, 'Longsword', 'an empty slot changes nothing');
  // ...and the scroll ARROWS raise nothing either (:2224-2242)
  w.hover(INV_RECTS.localList[0] + 2, INV_RECTS.localList[1] + 2);
  assert.equal(w.infoItem?.name, 'Longsword', 'the up arrow is not an item');
  // MUTATION: clearing infoItem on a miss empties the panel the moment
  // the pointer moves and both of the last two fail.
});

test('U47: the panel CLEARS on a tab change and behind a box - DFU\'s only two clear sites', () => {
  const bag = [{ group: 'Weapons', templateIndex: 113, name: 'Dagger' }];
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, rows: () => [{ text: 'x' }] });
  w.hover(INV_RECTS.localList[0] + 20, CELL_Y(0));
  assert.equal(w.infoItem?.name, 'Dagger');
  // SelectTabPage (:814-816)
  w.click(INV_RECTS.tabIngredients[0] + 5, 5);
  assert.equal(w.infoItem, null, 'a tab change empties it');
  // ...and a pushed window owns the pointer: hovering behind a box
  // changes nothing (the push itself cleared it at :663-664).
  w.click(INV_RECTS.tabWeapons[0] + 5, 5);
  w.hover(INV_RECTS.localList[0] + 20, CELL_Y(0));
  assert.equal(w.infoItem?.name, 'Dagger');
  const second = { group: 'Weapons', templateIndex: 121, name: 'Longsword' };
  bag.push(second);
  w.boxes = [{ rows: [{ text: 'a box' }] }];
  w.hover(INV_RECTS.localList[0] + 20, CELL_Y(1));   // squarely on the second item
  assert.equal(w.infoItem?.name, 'Dagger', 'a box holds the panel where it was');
  w.boxes = [];
  w.hover(INV_RECTS.localList[0] + 20, CELL_Y(1));
  assert.equal(w.infoItem?.name, 'Longsword', '...and it moves again once the box is gone');
});

test('U47: the GOLD button fills the panel with its own two generated lines', () => {
  // Internal_Strings goldAmount / goldWeight, verbatim, and the
  // CONDITIONAL format: `weight % 1 == 0 ? "F0" : "F2"`.
  assert.deepEqual(goldPanelRows(400, 1).map((r) => r.text), ['400 gold pieces', 'Weight: 1 kg']);
  assert.deepEqual(goldPanelRows(1, 0.0025).map((r) => r.text), ['1 gold pieces', 'Weight: 0.00 kg']);
  assert.deepEqual(goldPanelRows(1000, 2.5).map((r) => r.text), ['1000 gold pieces', 'Weight: 2.50 kg']);
  // MUTATION: an unconditional toFixed(2) writes "1.00 kg" for a whole
  // number and the first line fails.
  const bag = [{ group: 'Weapons', templateIndex: 113, name: 'Dagger' }];
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, rows: () => [{ text: 'x' }] });
  w.hover(INV_RECTS.localList[0] + 20, CELL_Y(0));
  assert.equal(w.infoGold, false);
  w.hover(INV_RECTS.gold[0] + 5, INV_RECTS.gold[1] + 5);
  assert.equal(w.infoGold, true, 'the gold button takes the panel');
  assert.equal(w.infoItem, null, '...and it is not an item');
  w.hover(INV_RECTS.localList[0] + 20, CELL_Y(0));
  assert.equal(w.infoGold, false, 'an item takes it back');
});

test('U47: the window is the guard, not its click method - and F11 no longer goes fullscreen', () => {
  const code = (rel) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', rel), 'utf8');
  // AUDIT 18 routed 62: townTalk tested `overlay?.click`, so a click
  // on a window with no click handler fell through to requestLook and
  // grabbed pointer lock from under the menu.
  // ...and the guard has to be read INSIDE pointerdown: `hover` a few
  // lines below carries the same line, so a whole-file regex matches
  // whatever pointerdown says. The first draft of this pin did, and
  // survived restoring the defect.
  const tt = code('scenes/townTalk.js');
  const pd = tt.slice(tt.indexOf('function pointerdown(e) {'), tt.indexOf('function hover(e) {'));
  assert.match(pd, /if \(!overlay\) return false;/, 'the guard is on the WINDOW');
  assert.doesNotMatch(pd, /if \(!overlay\?\.click\)/, 'and not on its click method');
  assert.match(pd, /overlay\.click\?\.\(/, 'the call is what is optional');
  // AUDIT 18: F11 is QuickLoad AND the browser's fullscreen key. One
  // list now, called first in every host that registers a keydown -
  // including the exterior host, which has nothing to quickload and
  // must still not go fullscreen.
  assert.match(code('ui/input.js'), /BROWSER_STEALS = Object\.freeze\(\['F5', 'F6', 'F11'\]\)/);
  // AUDIT 58 (f2/hosts): DISCOVERED, not enumerated. This loop named
  // four hosts, and the U47 rollout that wrote it named the same four -
  // so scenes/interior.js, the FIFTH host-level keydown, registered one
  // and never swallowed: F5 in the ?interior route reloaded the page and
  // destroyed the session (AUDIT 17e F41's own failure) and F11 went
  // fullscreen. A list a lane has to remember to extend is what let that
  // happen, so the pin now asks the tree which hosts register a keydown
  // and holds every one of them to ui/input.js:378-379's "every host
  // that registers a keydown calls this FIRST".
  const SCENES = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'scenes');
  const hosts = readdirSync(SCENES).filter((f) => f.endsWith('.js')
    && /\n  addEventListener\('keydown', \(e\) => \{/.test(readFileSync(join(SCENES, f), 'utf8')));
  assert.deepEqual(hosts.sort(), ['dungeon.js', 'exterior.js', 'interior.js', 'world.js', 'worldModes.js'],
    'the host-level keydowns in the tree - a sixth joins this list by existing, not by being remembered');
  for (const host of hosts.map((f) => `scenes/${f}`)) {
    assert.match(code(host), /swallowBrowserKey\(e\)/, `${host} swallows them`);
    assert.match(code(host), /import \{[^}]*swallowBrowserKey[^}]*\} from '\.\.\/ui\/input\.js'/, `${host} takes them from the one list`);
    assert.doesNotMatch(code(host), /e\.code === 'F5' \|\| e\.code === 'F6'/, `${host} keeps no second list`);
  }
  // ...and FIRST, ahead of the early returns. interior.js's handler
  // returns out of its overlay arm and its KeyM arm before either
  // reaches preventDefault, so a swallow placed after them is no
  // swallow at all - which is why the law says first and not merely
  // present.
  const body = code('scenes/interior.js');
  const kd = body.slice(body.indexOf("\n  addEventListener('keydown', (e) => {"));
  assert.ok(kd.indexOf('swallowBrowserKey(e);') < kd.indexOf('if (overlay)'),
    'interior.js swallows BEFORE the overlay arm returns');
  assert.ok(kd.indexOf('swallowBrowserKey(e);') < kd.indexOf("if (e.code === 'KeyM')"),
    'interior.js swallows BEFORE the automap arm returns');
});
