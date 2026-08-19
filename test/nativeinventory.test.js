// U8d: the native inventory window - the verbatim rects, the tab
// filter law, and the shared ItemListScroller component.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NativeInventoryWindow, INV_RECTS, TABS, filterByTab, isIngredientTemplate, NO_WAGON_TEXT
} from '../src/ui/nativeInventory.js';
import { scrollerHit, applyScroll, LIST_SLOTS, CELL_X, ARROW_H, DOWN_ARROW_Y } from '../src/ui/itemScroller.js';
import { readFileSync } from 'node:fs';
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
  assert.deepEqual(scrollerHit(rect, 163 + 4, 48 + 70), { kind: 'page-up' });
  assert.deepEqual(scrollerHit(rect, 163 + 4, 48 + 100), { kind: 'page-down' });
  assert.equal(scrollerHit(rect, 162, 100), null, 'outside the scroller');
  assert.equal(scrollerHit(rect, 163 + 4, 48 + ARROW_H).kind, 'page-up', 'y16 is past the up arrow');
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
  const gold = { group: 'Currency', name: 'Gold pieces', templateIndex: 276, stackCount: 500 };
  // (the gold button acts wherever the lists are pointing)
  const bag = [gold];
  const entity = { isPlayer: true, items: bag };
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity });
  w.click(230, 130);            // the gold button
  assert.equal(w.topBox.field, true);
  assert.equal(w.goldEntry, '0', 'TextBox.Text = "0"');
  // 0 is refused outright - DFU returns without clamping
  w.input('Enter');
  assert.equal(gold.stackCount, 500);
  // so is more than you carry
  w.click(230, 130);
  w.goldEntry = '9999';
  w.input('Enter');
  assert.equal(gold.stackCount, 500);
  // a real amount lands in the remote pile
  w.click(230, 130);
  w.goldEntry = '120';
  w.input('Enter');
  assert.equal(gold.stackCount, 380);
  assert.equal(w._remote().find((it) => it.group === 'Currency')?.stackCount, 120);
});

test('U25 / THE ONE CONSTRUCTION SEAM: all four inventory sites pass the same hooks', () => {
  // Four call sites build this window - both exterior hosts, each
  // twice (bare, and over a loot pile) - and a hook added to three of
  // them is exactly the failure this rule exists for. The window has
  // no execution coverage in node, so the seam is read.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const REQUIRED = ['items:', 'entity:', 'icons:', 'rows:', 'nowMinute:'];
  let sites = 0;
  for (const f of ['src/scenes/exterior.js', 'src/scenes/world.js']) {
    const src = readFileSync(join(root, f), 'utf8');
    let i = 0;
    for (;;) {
      const j = src.indexOf('new NativeInventoryWindow({', i);
      if (j < 0) break;
      sites++;
      const block = src.slice(j, src.indexOf('}));', j));
      for (const hook of REQUIRED) {
        assert.ok(block.includes(hook), `${f} site ${sites} is missing ${hook}`);
      }
      i = j + 1;
    }
  }
  assert.equal(sites, 4, 'the number of construction sites changed - re-read this rule');
});

test('U26 / THE FOUR HOSTS: every host that opens an inventory opens the NATIVE one', () => {
  // U25 pinned the opposite of this and fired the moment U26 swapped
  // the dungeon, which is what a both-ways pin is for. The keyed
  // InventoryWindow is now gone from every host.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const dungeon = readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
  assert.equal(dungeon.includes('new InventoryWindow('), false, 'the keyed window is retired here');
  assert.ok(dungeon.includes('new NativeInventoryWindow('));
  // ...and the dungeon builds it in ONE place, so its loot targets and
  // its F6 press cannot drift apart
  assert.equal((dungeon.match(/new NativeInventoryWindow\(/g) ?? []).length, 1);
  for (const hook of ['items:', 'entity:', 'icons:', 'rows:', 'nowMinute:', 'onDrop:', 'onClose:']) {
    assert.ok(dungeon.includes(hook), `the dungeon builder is missing ${hook}`);
  }
  // worldModes opens no inventory of its own - it MOUNTS the other
  // two, so a click inside a building reaches theirs.
  const modes = readFileSync(join(root, 'src/scenes/worldModes.js'), 'utf8');
  assert.equal(modes.includes('NativeInventoryWindow'), false, 'the interior host opens none');
  // ...and the keyed window is DELETED, not merely unimported. Its one
  // law lives in systems/equip.js, which every host reaches.
  const keyed = readFileSync(join(root, 'src/ui/inventory.js'), 'utf8');
  assert.equal(keyed.includes('export class InventoryWindow'), false, 'the keyed window is gone');
  assert.ok(keyed.includes('export class SpellbookWindow'), 'its module still carries the other two');
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
  assert.ok(/destroy\(\)[\s\S]*droppedLoot\._piles\) if \(p\.batch\) renderer\.destroyBillboardBatch/.test(ctx),
    'the piles\' BATCHES are destroyed in destroy(), not just the array emptied');

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
