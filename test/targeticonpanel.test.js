// AUDIT 58 - THE TWO TARGET-ICON PANELS both classic list windows
// draw over their lists (DaggerfallInventoryWindow.cs:49-50, :424-439,
// :857-890; DaggerfallTradeWindow.cs:262-263, :630-670).
//
// The port named both rects in nativeInventory.js's header geometry
// list and carried neither, so the CLASSIC inventory and trade screens
// showed no container picture and NO ENCUMBRANCE READOUT at all while
// the enhanced skin showed one. These pins hold the rects, the
// conditional weight format, the ScaleToFit blit, and - through the
// two windows' own draw() - the four container pictures and the two
// labels, so deleting either panel from either draw() goes red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTAINER_IMAGES, CONTAINER_ICONS_FILE, LOCAL_TARGET_ICON_RECT, REMOTE_TARGET_ICON_RECT,
  TARGET_ICON_LABEL_POS, targetIconWeightText, drawTargetIconPanel, _setContainerIconsForTests,
} from '../src/ui/targetIconPanel.js';
import { DEFAULT_TOOLTIP_TEXT_FG } from '../src/ui/toolTip.js';
import { NativeInventoryWindow, INV_RECTS, _setInventoryArtForTests } from '../src/ui/nativeInventory.js';
import { NativeTradeWindow, TRADE_RECTS, _setTradeArtForTests } from '../src/ui/nativeTrade.js';
import { nativeMetrics } from '../src/ui/nativePanel.js';
import { WAGON_KG_LIMIT } from '../src/systems/itemTransfer.js';
import { entityMaxEncumbrance } from '../src/combat/formulas.js';

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const CANVAS = { width: 320, height: 200 };
/** A flat 4px-wide font: the label's ORIGIN and COLOUR are the law
 *  here, not its typography. */
const FONT = { fnt: { fixedHeight: 7, fixedWidth: 5, glyphWidth: () => 4 }, tex: 'font' };

function recorder() {
  const quads = [];
  return {
    quads,
    uploadTexture: (g, name) => `tex:${name}`,
    releaseTexture: () => {},
    drawScreenQuad: (tex, rect, uv, color) => quads.push({ tex, ...rect, uv, color }),
  };
}
/** One fake 8x8 record per InventoryContainerImages value. */
function fakeIcons() {
  const m = new Map();
  for (const v of Object.values(CONTAINER_IMAGES)) m.set(v, { tex: `container:${v}`, w: 8, h: 8 });
  return m;
}
const IMG = (name) => ({ tex: `img:${name}`, w: 320, h: 200 });
function inventoryArt() {
  return { base: IMG('INVE00I0'), gold: IMG('INVE01I0'), info: null, font4: FONT };
}
function tradeArt() {
  return { base: IMG('INVE00I0'), cost: IMG('SHOP00I0'), panels: new Map(), font4: FONT };
}
const quadsFor = (r, tex) => r.quads.filter((q) => q.tex === tex);

test('A54 target icons: the two rects, verbatim, on BOTH windows', () => {
  // DaggerfallInventoryWindow.cs:49-50
  assert.deepEqual([...LOCAL_TARGET_ICON_RECT], [165, 12, 55, 34]);
  assert.deepEqual([...REMOTE_TARGET_ICON_RECT], [263, 12, 55, 34]);
  // AddDefaultShadowedTextLabel(new Vector2(1, 2), panel) (:428, :435)
  assert.deepEqual([...TARGET_ICON_LABEL_POS], [1, 2]);
  // both windows carry them - DaggerfallTradeWindow INHERITS the pair
  assert.deepEqual([...INV_RECTS.localTargetIcon], [165, 12, 55, 34]);
  assert.deepEqual([...INV_RECTS.remoteTargetIcon], [263, 12, 55, 34]);
  assert.deepEqual([...TRADE_RECTS.localTargetIcon], [165, 12, 55, 34]);
  assert.deepEqual([...TRADE_RECTS.remoteTargetIcon], [263, 12, 55, 34]);
  // ItemHelper.containerIconsFilename (:47) and the enum's own order
  // (DaggerfallUnityEnums.cs:540-553)
  assert.equal(CONTAINER_ICONS_FILE, 'INVE16I0.CIF');
  assert.deepEqual(CONTAINER_IMAGES, {
    Corpse1: 0, Corpse2: 1, Ground: 2, Wagon: 3, Shelves: 4,
    Chest: 5, Merchant: 6, Anvil: 7, Magic: 8, Backpack: 9, Corpse3: 10,
  });
});

test('A54 target icons: the CONDITIONAL weight format (:861, :872)', () => {
  // `weight % 1 == 0 ? "{0:F0} / {1}" : "{0:F2} / {1}"` - a whole
  // number of kilograms prints NO decimals, anything else prints
  // exactly two. The port used to print neither string at all.
  assert.equal(targetIconWeightText(0, 90), '0 / 90');
  assert.equal(targetIconWeightText(12, 90), '12 / 90');
  assert.equal(targetIconWeightText(12.5, 90), '12.50 / 90');
  assert.equal(targetIconWeightText(0.0025, 90), '0.00 / 90');   // one gold piece still shows two places
  assert.equal(targetIconWeightText(740, WAGON_KG_LIMIT), '740 / 750');
});

test('A54 target icons: ScaleToFit is aspect-preserving and CENTERED', () => {
  _setContainerIconsForTests(new Map([[CONTAINER_IMAGES.Backpack, { tex: 'c', w: 11, h: 11 }]]));
  const r = recorder();
  const m = nativeMetrics(CANVAS);
  assert.equal(drawTargetIconPanel(r, m, FONT, LOCAL_TARGET_ICON_RECT, CONTAINER_IMAGES.Backpack, '3 / 90'), true);
  const icon = quadsFor(r, 'c')[0];
  // 55x34 rect, 11x11 art: ScaleMode.ScaleToFit takes min(55/11, 34/11)
  // = 34/11 and centres the 34x34 result - it scales UP, the accessory
  // buttons' MaxAutoScale 1 cap is theirs alone.
  assert.equal(icon.w, 34);
  assert.equal(icon.h, 34);
  assert.equal(icon.x, 165 + (55 - 34) / 2);
  assert.equal(icon.y, 12);
  // the label rides DaggerfallUnityDefaultToolTipTextColor
  // (DaggerfallUI.cs:69) and starts at panel-relative (1,2)
  const glyphs = r.quads.filter((q) => q.tex === 'font');
  assert.ok(glyphs.length > 0, 'the weight label is drawn');
  const lit = glyphs.filter((q) => q.color === DEFAULT_TOOLTIP_TEXT_FG);
  assert.ok(lit.length > 0, 'in the tooltip text colour, not the default yellow');
  assert.equal(Math.min(...lit.map((q) => q.x)), m.ox + (165 + 1) * m.s);
  assert.equal(Math.min(...lit.map((q) => q.y)), m.oy + (12 + 2) * m.s);
  // a missing CIF is not fatal: the panel draws its label and says so
  _setContainerIconsForTests(null);
  const r2 = recorder();
  assert.equal(drawTargetIconPanel(r2, m, FONT, LOCAL_TARGET_ICON_RECT, CONTAINER_IMAGES.Backpack, '3 / 90'), false);
});

test('A54 target icons: the INVENTORY window draws both panels (:333-334)', () => {
  _setContainerIconsForTests(fakeIcons());
  _setInventoryArtForTests(inventoryArt());
  try {
    // a Dagger is 0.5 kg and a Cuirass 12.5 (ItemTemplates), so the
    // conditional format shows both of its arms here.
    const bag = [{ group: 'Weapons', templateIndex: 113, name: 'Dagger' }];
    const entity = { stats: { strength: 60 }, items: bag, goldPieces: 0 };
    assert.equal(entityMaxEncumbrance(entity), 90, 'MaxEncumbrance = strength * 1.5');
    const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity });
    // UpdateLocalTargetIcon (:857-863): the Backpack picture, always,
    // and carried / MaxEncumbrance.
    assert.equal(w._localTargetIcon().container, CONTAINER_IMAGES.Backpack);
    assert.equal(w._localTargetIcon().label, '0.50 / 90');
    // UpdateRemoteTargetIcon (:865-890): Ground for a dropped pile, and
    // its label is String.Empty (:868).
    assert.equal(w._remoteTargetIcon().container, CONTAINER_IMAGES.Ground);
    assert.equal(w._remoteTargetIcon().label, '');
    // wagon mode: the Wagon picture and WagonWeight / WagonKgLimit
    w.usingWagon = true;
    w._wagonLocal = [{ group: 'Armor', templateIndex: 102 }, { group: 'Armor', templateIndex: 102 }];
    assert.equal(w._remoteTargetIcon().container, CONTAINER_IMAGES.Wagon);
    assert.equal(w._remoteTargetIcon().label, '25 / 750');
    w.usingWagon = false;

    const r = recorder();
    w.draw(r, CANVAS, FONT);
    const m = nativeMetrics(CANVAS);
    const local = quadsFor(r, `container:${CONTAINER_IMAGES.Backpack}`);
    const remote = quadsFor(r, `container:${CONTAINER_IMAGES.Ground}`);
    assert.equal(local.length, 1, 'the LOCAL target icon panel is drawn');
    assert.equal(remote.length, 1, 'the REMOTE target icon panel is drawn');
    // 55x34 over a square icon -> a 34x34 blit centred in each rect
    assert.equal(local[0].x, m.ox + (165 + (55 - 34) / 2) * m.s);
    assert.equal(remote[0].x, m.ox + (263 + (55 - 34) / 2) * m.s);
    assert.equal(local[0].y, m.oy + 12 * m.s);
  } finally {
    _setInventoryArtForTests(null);
    _setContainerIconsForTests(null);
  }
});

test('A54 target icons: the TRADE window overrides both halves (:630-670)', () => {
  _setContainerIconsForTests(fakeIcons());
  _setTradeArtForTests(tradeArt());
  try {
    const pack = [{ group: 'Weapons', templateIndex: 113, name: 'Dagger' }];
    const entity = { stats: { strength: 60 }, items: pack, goldPieces: 0, wagonItems: [] };
    const hooks = {
      mode: 'Buy', icons: ICONS, entity, gold: () => 100,
      packItems: () => pack, shelfItems: () => [],
    };
    const w = new NativeTradeWindow(hooks);
    // GetCarriedWeight override (:630-633): the BASKET counts too.
    assert.equal(w._carriedWeight(), 0.5);
    w.basket.push({ group: 'Armor', templateIndex: 102 });   // a 12.5 kg Cuirass on the shelf
    assert.equal(w._carriedWeight(), 13);
    assert.equal(entityMaxEncumbrance(entity), 90);
    assert.equal(w._localTargetIcon().label, '13 / 90');
    assert.equal(w._localTargetIcon().container, CONTAINER_IMAGES.Backpack);
    // UpdateLocalTargetIcon's UsingWagon arm (:635-647)
    w.usingWagon = true;
    entity.wagonItems = [{ group: 'Armor', templateIndex: 102 }, { group: 'Armor', templateIndex: 102 }];
    assert.equal(w._localTargetIcon().container, CONTAINER_IMAGES.Wagon);
    assert.equal(w._localTargetIcon().label, '25 / 750');
    w.usingWagon = false;
    // UpdateRemoteTargetIcon's mode switch (:649-670), all four arms
    assert.equal(w._remoteTargetIcon().container, CONTAINER_IMAGES.Shelves);
    for (const [mode, want] of [['Sell', 'Merchant'], ['SellMagic', 'Merchant'],
      ['Repair', 'Anvil'], ['Identify', 'Magic'], ['Inventory', 'Merchant']]) {
      w.mode = mode;
      assert.equal(w._remoteTargetIcon().container, CONTAINER_IMAGES[want], `${mode} -> ${want}`);
      assert.equal(w._remoteTargetIcon().label, '', 'the remote side carries no label here');
    }
    w.mode = 'Buy';

    const r = recorder();
    w.draw(r, CANVAS, FONT);
    assert.equal(quadsFor(r, `container:${CONTAINER_IMAGES.Backpack}`).length, 1, 'the shop screen draws the local panel');
    assert.equal(quadsFor(r, `container:${CONTAINER_IMAGES.Shelves}`).length, 1, 'and the Buy-mode shelves');
  } finally {
    _setTradeArtForTests(null);
    _setContainerIconsForTests(null);
  }
});
