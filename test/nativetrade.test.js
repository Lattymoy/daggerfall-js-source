// U8c: the native trade window - the composed geometry. U40 replaced
// the CLICK-TRADE machine this file used to pin: DFU does not
// transact at the click, it STAGES, and the mode action commits. The
// geometry half is unchanged and stays; the interaction half now pins
// the staging model, which is what the source actually carries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NativeTradeWindow, TRADE_RECTS, LIST_SLOTS, SLOT_H, CELL_W, CELL_X, ARROW_H, DOWN_ARROW_Y } from '../src/ui/nativeTrade.js';
import { LETTER_OF_CREDIT_TEXT } from '../src/systems/tradeModes.js';
import { FNT_ASCII_START } from '../src/formats/fntFile.js';
import { preloadTradeArt, tradeArtLoaded } from '../src/ui/nativeTrade.js';
import { DFPalette } from '../src/formats/dfPalette.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const hooks = (mode = 'Buy') => {
  const shelf = [{ templateIndex: 277, name: 'Book A', value: 40 }, { templateIndex: 277, name: 'Book B', value: 40 }];
  const bag = [{ templateIndex: 277, name: 'Mine', value: 40 }];
  let gold = 100000;
  const committed = [];
  return {
    shelf, bag, committed, mode,
    shelfItems: () => shelf,
    packItems: () => bag,
    accepts: () => true,
    enchanted: () => true,
    priceCtx: () => ({ quality: 10, skills: { mercantile: 50, personality: 50 } }),
    gold: () => gold,
    rows: (id) => [{ text: `#${id}`, center: true }],
    weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }),
    commit: (m, staged, price, proceeds) => {
      committed.push({ m, n: staged.length, price, proceeds });
      gold += (m === 'Sell' || m === 'SellMagic') ? price : -price;
      for (const it of staged) {
        const from = m === 'Buy' ? shelf : bag;
        const to = m === 'Buy' ? bag : shelf;
        const i = from.indexOf(it);
        if (i >= 0) from.splice(i, 1);
        to.push(it);
      }
    },
    icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
  };
};

/** The middle of a visible list slot, below the 12px scroll band. */
const REMOTE_SLOT0 = [290, 48 + 20];
const LOCAL_SLOT0 = [192, 48 + 20];

test('U8c/U40: the composed rects', () => {
  // DFU geometry: inventory lists + the trade panels
  assert.deepEqual([...TRADE_RECTS.localList], [163, 48, 59, 152]);
  assert.deepEqual([...TRADE_RECTS.remoteList], [261, 48, 59, 152]);
  assert.deepEqual([...TRADE_RECTS.costPanel], [49, 13, 111, 9]);
  assert.deepEqual([...TRADE_RECTS.actionPanel], [222, 10, 39, 190]);
  // the two mode-flow buttons are PANEL-CHILD rects (:44-45)
  assert.deepEqual([...TRADE_RECTS.modeAction], [226, 134, 31, 14]);
  assert.deepEqual([...TRADE_RECTS.clear], [226, 156, 31, 14]);
  assert.equal(SLOT_H, 38);
  assert.equal(LIST_SLOTS, 4);
  assert.equal(CELL_W, 50, 'ItemListScroller itemButtonRects4');
  assert.equal(CELL_X, 9, 'itemListPanelRect - the buttons sit at x9, the rail is LEFT');
  assert.equal(ARROW_H, 16);
  assert.equal(DOWN_ARROW_Y, 136);
});

test('U40: a BUY click STAGES into the basket - it does not transact', () => {
  const h = hooks('Buy');
  const w = new NativeTradeWindow(h);
  assert.equal(w.cost().cost, 0, 'an empty basket costs nothing');
  assert.equal(w.cost().modeActionEnabled, false, 'and the button is dead');

  assert.ok(w.click(...REMOTE_SLOT0));
  // THE POINT: no gold moved, no item entered the pack
  assert.equal(h.gold(), 100000, 'not a coin - a click is not a purchase');
  assert.equal(h.bag.length, 1, 'nothing entered the pack');
  assert.equal(h.shelf.length, 1, 'but it did leave the shelf');
  assert.equal(w.basket.length, 1);
  // the basket shows in the LOCAL list, ahead of the pack (:677-686)
  assert.equal(w.localList().length, 2);
  assert.equal(w.localList()[0], w.basket[0], 'the basket comes FIRST');
  // and the cost strip now totals it
  assert.ok(w.cost().cost > 0);
  assert.equal(w.cost().modeActionEnabled, true);

  // clicking the basket item in the LOCAL list puts it back (:800-801)
  assert.ok(w.click(...LOCAL_SLOT0));
  assert.equal(w.basket.length, 0);
  assert.equal(h.shelf.length, 2);
  assert.equal(w.cost().cost, 0);
});

test('U40: the mode action commits the whole basket behind one Yes/No', () => {
  const h = hooks('Buy');
  const w = new NativeTradeWindow(h);
  w.click(...REMOTE_SLOT0);
  w.click(...REMOTE_SLOT0);          // both books
  assert.equal(w.basket.length, 2);
  const staged = w.cost().cost;

  w.click(226 + 15, 134 + 7);        // the mode action
  assert.ok(w.box, 'the confirm box is up');
  assert.equal(w.box.buttons, 'YesNo');
  assert.equal(h.committed.length, 0, 'nothing has happened yet');
  assert.ok(staged > 0);

  w.input('KeyY');
  assert.equal(h.committed.length, 1, 'ONE deal, not one per item');
  assert.equal(h.committed[0].n, 2, 'and it carried both');
  assert.equal(h.committed[0].m, 'Buy');
  assert.equal(w.basket.length, 0, 'the basket is spent');
  assert.equal(h.bag.length, 3);
  assert.ok(h.gold() < 100000, 'and NOW the gold moved');
  assert.equal(w.box, null);
});

test('U40: saying NO to the offer keeps the staging - nothing is lost', () => {
  const h = hooks('Buy');
  const w = new NativeTradeWindow(h);
  w.click(...REMOTE_SLOT0);
  w.click(226 + 15, 134 + 7);
  w.input('KeyN');
  assert.equal(h.committed.length, 0);
  assert.equal(w.basket.length, 1, 'the basket survives a refusal - only Clear empties it');
  assert.equal(h.gold(), 100000);
});

test('U40: Clear puts everything back where it came from (:1020-1025)', () => {
  const h = hooks('Buy');
  const w = new NativeTradeWindow(h);
  w.click(...REMOTE_SLOT0);
  w.click(...REMOTE_SLOT0);
  assert.equal(h.shelf.length, 0);
  w.click(226 + 15, 156 + 7);        // Clear
  assert.equal(w.basket.length, 0);
  assert.equal(h.shelf.length, 2, 'both books are back on the shelf');
  assert.equal(w.cost().cost, 0);
});

test('U40: in SELL mode the REMOTE list is what you have staged, and it starts empty', () => {
  const h = hooks('Sell');
  const w = new NativeTradeWindow(h);
  assert.deepEqual(w.remoteList(), [], 'the right-hand list starts EMPTY in a selling mode');
  assert.equal(w.localList().length, 1, 'and the left is your pack');

  assert.ok(w.click(...LOCAL_SLOT0));
  assert.equal(w.remoteList().length, 1, 'the click staged it to the right');
  assert.equal(h.bag.length, 0, 'and out of the pack');
  assert.equal(h.gold(), 100000, 'no gold yet - staging is not selling');
  assert.ok(w.cost().cost > 0);

  // a staged item clicks back OUT
  assert.ok(w.click(...REMOTE_SLOT0));
  assert.equal(w.remoteList().length, 0);
  assert.equal(h.bag.length, 1);

  // stage again and commit - now the gold comes the OTHER way
  w.click(...LOCAL_SLOT0);
  w.click(226 + 15, 134 + 7);
  w.input('KeyY');
  assert.equal(h.committed[0].m, 'Sell');
  assert.ok(h.gold() > 100000, 'a sale PAYS the player');
});

test('T2: an overloaded seller is PAID IN PARCHMENT, and is told so (:1039-1048, :1092-1093)', () => {
  // The law: the proceeds are weighed BEFORE they are paid, and a
  // purse that would push the player past MaxEncumbrance becomes a
  // letter of credit for the full amount instead. The port has
  // minted the letter since U40 and scratched the right sound since
  // U40 - it never SAID anything, so the only signal reaching a
  // player who sold something valuable while overloaded was gold that
  // did not move.
  const h = hooks('Sell');
  h.weight = () => ({ carriedWeightKg: 100, maxEncumbranceKg: 100 });   // full to the brim
  const w = new NativeTradeWindow(h);
  w.click(...LOCAL_SLOT0);
  w.click(226 + 15, 134 + 7);            // the mode action raises the offer
  assert.equal(w.box?.buttons, 'YesNo', 'no offer to accept');
  w.input('KeyY');
  assert.equal(h.committed.length, 1, 'the deal did not conclude');
  assert.equal(h.committed[0].proceeds?.kind, 'letterOfCredit',
    'the host was not told the proceeds were parchment');
  // ...and the window says so, in a click-anywhere box over the
  // still-open trade screen (DFU pops the CONFIRM box, not the trade
  // window - UserInterfaceWindow.cs:127-132)
  assert.ok(w.box, 'the letter was minted in silence');
  assert.equal(w.box.buttons, null, 'the announcement is click-anywhere, not a question');
  // the LITERAL, not the constant. Comparing the box against the same
  // export the box is built from passes however the string drifts -
  // this line is the port's copy of Internal_Strings.csv:824, so it
  // has to carry the words.
  assert.equal(w.box.rows[0].text, 'You are paid with a letter of credit.');
  assert.equal(LETTER_OF_CREDIT_TEXT, 'You are paid with a letter of credit.');
  assert.ok(!w.done, 'the trade window closed - DFU pops the CONFIRM box and keeps the trade screen up');
  // one more click dismisses it and leaves the window usable
  w.click(160, 100);
  assert.equal(w.box, null, 'the announcement will not go away');
});

test('T2: a seller with room is paid in COINS and told nothing - the box is the letter\'s alone', () => {
  const h = hooks('Sell');
  h.weight = () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 });
  const w = new NativeTradeWindow(h);
  w.click(...LOCAL_SLOT0);
  w.click(226 + 15, 134 + 7);
  w.input('KeyY');
  assert.equal(h.committed[0].proceeds?.kind, 'gold');
  assert.equal(w.box, null, 'a coin sale raised a box it has no line for');
});

test('U40: a buyer who cannot pay gets a box and no Yes/No (:1116-1124)', () => {
  const h = hooks('Buy');
  h.gold = () => 1;
  const w = new NativeTradeWindow(h);
  w.click(...REMOTE_SLOT0);
  w.click(226 + 15, 134 + 7);
  assert.ok(w.box);
  assert.equal(w.box.buttons, null, 'no Yes/No at all - the deal is refused, not offered');
  // the two records are concatenated: the haggle line AND the refusal
  assert.equal(w.box.rows.length, 2);
  assert.match(w.box.rows[1].text, /454/, 'notEnoughGold rides second');
  // dismissing it leaves the basket alone
  w.input('Enter');
  assert.equal(w.box, null);
  assert.equal(w.basket.length, 1);
});

test('U40: the dead mode action does nothing at all', () => {
  const h = hooks('Buy');
  const w = new NativeTradeWindow(h);
  // nothing staged -> DFU disables the button, so the click is inert
  assert.ok(w.click(226 + 15, 134 + 7), 'the rect is still consumed');
  assert.equal(w.box, null, 'but no popup opens');
  assert.equal(h.committed.length, 0);
});

test('U8c: the scroll rail never trades, and exit closes', () => {
  const h = hooks('Buy');
  const w = new NativeTradeWindow(h);
  // the LEFT 9px rail never picks items (up arrow 0,0,9,16 / down
  // 0,136,9,16 / the bar between)
  assert.ok(w.click(261 + 4, 48 + 5));      // the up arrow
  assert.ok(w.click(261 + 4, 48 + 140));    // the down arrow
  assert.ok(w.click(261 + 4, 48 + 70));     // the bar between
  assert.equal(w.basket.length, 0, 'the rail scrolls, never stages');
  assert.equal(h.shelf.length, 2);
  // outside every rect: not consumed; exit closes
  assert.equal(w.click(10, 100), false);
  assert.ok(w.click(241, 188));
  assert.ok(w.done);
});

test('nativeTrade: icon draws V-FLIP the record texture (the bottom-up GL rows)', () => {
  // getColor32 stores records bottom-up (DFU's verbatim mesh flip);
  // drawScreenQuad samples v0 at the TOP - the icon draw must flip
  // (Mac's catch: the shelf books rendered upside down).
  const h = hooks();
  const w = new NativeTradeWindow(h);
  const key = '209_2';   // the Book template's world texture
  w._icon._warm.add(key);
  w._icon._sizes.set(key, { width: 32, height: 16 });
  h.icons.textures.set(key, 'gl-tex');
  let captured = null;
  const fakeRenderer = { drawScreenQuad: (tex, dst, src) => { captured = { tex, src }; } };
  const m = { s: 1, ox: 0, oy: 0 };
  assert.ok(w._drawIcon(fakeRenderer, m, { templateIndex: 277 }, [261, 48, 59, 152], 0));
  assert.equal(captured.tex, 'gl-tex');
  assert.deepEqual(captured.src, { u0: 0, v0: 1, u1: 1, v1: 0 }, 'the V-flipped source rect');
});

test('nativeTrade: icons NEVER upscale and centre in the 50x38 cell (ItemListScroller MaxAutoScale 1)', () => {
  const h = hooks();
  const w = new NativeTradeWindow(h);
  const key = '209_2';
  w._icon._warm.add(key);
  w._icon._sizes.set(key, { width: 8, height: 8 });   // tiny icon
  h.icons.textures.set(key, 'gl-tex');
  let captured = null;
  const fakeRenderer = { drawScreenQuad: (tex, dst, src) => { captured = { dst, src }; } };
  const m = { s: 1, ox: 0, oy: 0 };
  assert.ok(w._drawIcon(fakeRenderer, m, { templateIndex: 277 }, [261, 48, 59, 152], 0));
  assert.equal(captured.dst.w, 8, 'no upscale');
  assert.equal(captured.dst.h, 8);
  assert.equal(captured.dst.x, 261 + 9 + (50 - 8) / 2, 'centred in the BUTTON at x9, not the scroller');
  assert.equal(captured.dst.y, 48 + (38 - 8) / 2);
  // an oversized icon scales DOWN to fit
  w._icon._sizes.set(key, { width: 100, height: 38 });
  w._drawIcon(fakeRenderer, m, { templateIndex: 277 }, [261, 48, 59, 152], 0);
  // AUDIT 17e F26: ScaleToFit fits the button's INTERIOR - the 2px
  // margin on all sides (ItemListScroller.cs:98,:339) makes it 46x34.
  assert.equal(captured.dst.w, 46, 'downscaled to the button INTERIOR, not the full cell');
});

// ---------------------------------------------------------------
// U40  The cost strip is LIVE, and proving it needs to see the draw
// ---------------------------------------------------------------
// There was no harness in this repo for asserting DRAWN text - the
// other UI suites pin it by reading the source, which cannot tell a
// live total from a stale one. drawText asks the font for every glyph
// by INDEX (text.js:88-89), so a font that records those indices
// reconstructs exactly the string the renderer was asked to paint.
// That is an observation of the draw, not of the code.
//
// It is ARENA2-gated because draw() returns early without art (the
// U8c fallback), so there is no way to reach the strip on a host with
// no game data - the standing half-blind cost this repo already
// records for its other art pins.
const ARENA2 = process.env.ARENA2_PATH;
const SKIP = ARENA2 ? false : 'ARENA2_PATH not set - the drawn-text pin needs real art';

const drawSpy = () => {
  const chars = [];
  const font = {
    tex: null,
    fnt: {
      fixedHeight: 6,
      glyphWidth: (gi) => { chars.push(String.fromCharCode(gi + FNT_ASCII_START)); return 4; },
    },
  };
  return { font, painted: () => chars.join('') };
};

test('U40: the cost strip totals what is STAGED, re-read every frame', { skip: SKIP }, async () => {
  const palette = new DFPalette();
  palette.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  const renderer = {
    uploadTexture: (g, name) => `tex:${name}`,
    releaseTexture: () => {},
    drawScreenQuad: () => {},
  };
  await preloadTradeArt({ renderer, palette, fetchBytes: async (n) => new Uint8Array(readFileSync(join(ARENA2, n))) });
  assert.ok(tradeArtLoaded(), 'INVE00I0 + the mode panels');

  const h = hooks('Buy');
  const w = new NativeTradeWindow(h);
  const canvas = { width: 640, height: 400 };

  // nothing staged: the gold is painted and the cost reads 0
  const a = drawSpy();
  w.draw(renderer, canvas, a.font);
  assert.match(a.painted(), /100000/, 'the gold is drawn');

  // stage one book and draw again - the SAME window, no commit
  w.click(...REMOTE_SLOT0);
  const staged = w.cost().cost;
  assert.ok(staged > 0, 'the fixture really does cost something');
  const b = drawSpy();
  w.draw(renderer, canvas, b.font);
  assert.match(b.painted(), new RegExp(String(staged)),
    'the strip shows the live basket total before any deal concludes');
  // and this is the discriminating half: a window that showed the LAST
  // CONCLUDED PRICE would still be showing 0 here, because nothing has
  // been bought yet. lastPrice is null and the strip is not reading it.
  assert.equal(w.lastPrice, null);

  // clear it and the strip goes back to 0
  w._clear();
  assert.equal(w.cost().cost, 0);
});

test('U40: the offer box expands %cpn, %cn and %a - the LIVE PROBE read all three raw', () => {
  // TEXT.RSC 260-265 quote the shop, the city and the price back at
  // the player: "%cpn prides itself on having the lowest prices in
  // %cn ... I can sell for no less than %a gold pieces". The window
  // had never expanded any of them. %a is the PRICE, so a player was
  // being asked to agree to a literal percent-a.
  const h = hooks('Buy');
  h.shopName = "The Adventurer's Book Dealer";
  h.cityName = () => 'Daggerfall';
  h.rows = () => [{ text: '%cpn, lowest prices in %cn, no less than %a gold.', center: true }];
  const w = new NativeTradeWindow(h);
  w.click(...REMOTE_SLOT0);
  w.click(226 + 15, 134 + 7);
  const text = w.box.rows[0].text;
  assert.match(text, /The Adventurer's Book Dealer/);
  assert.match(text, /lowest prices in Daggerfall/);
  assert.doesNotMatch(text, /%/, 'no macro survives into the box');
  // and %a is the TRADE PRICE, not the staged cost - the two differ
  // because the price is the cost haggled through CalculateTradePrice
  const price = Number(/than (\d+) gold/.exec(text)[1]);
  assert.equal(price, w.box.price);
  assert.notEqual(price, w.box.cost, 'the haggle really did move it');
});

test('AUDIT 26: staging a MAP reads it and eats it - TransferItem\'s map arm (DaggerfallInventoryWindow.cs:1471-1478)', () => {
  // DaggerfallTradeWindow's staging clicks are TransferItem itself
  // (:795, :817, :823, :826) with `from` = localItems, so the map arm
  // between the summoned guard and the quest one runs here exactly as
  // it does on an inventory drop: RecordLocationFromMap, then
  // from.RemoveItem - the map never reaches the merchant's side.
  const h = hooks('Sell');
  const map = { group: 'MiscItems', templateIndex: 287, name: 'Map', value: 25 };
  h.bag.length = 0;
  h.bag.push(map);
  let revealed = 0;
  h.revealMap = () => { revealed++; return { name: 'Daggerfall' }; };
  // `from` is PlayerEntity.Items (:389) - the LIVE collection, not the
  // window's filtered packItems() view
  h.entity = { items: h.bag };
  const w = new NativeTradeWindow(h);

  assert.ok(w.click(...LOCAL_SLOT0));
  assert.equal(revealed, 1, 'the map was READ');
  assert.equal(h.bag.length, 0, 'from.RemoveItem ate it');
  assert.deepEqual(w.remoteList(), [], 'and nothing was staged for sale');
  assert.equal(w.cost().cost, 0, 'there is nothing to price');
  // RecordLocationFromMap shows record 499 on a successful reveal
  // (:1836-1839); the port's rows hook stands in for TEXT.RSC
  assert.deepEqual(w.box.rows, [{ text: '#499', center: true }]);

  // a host with NO reveal seam leaves the map unread and uneaten -
  // useItem.js's own recorded answer, not a second one written here
  const h2 = hooks('Sell');
  const map2 = { group: 'Maps', templateIndex: 287, name: 'Map', value: 25 };
  h2.bag.length = 0;
  h2.bag.push(map2);
  const w2 = new NativeTradeWindow(h2);
  w2.click(...LOCAL_SLOT0);
  assert.equal(h2.bag.length, 1, 'no reveal seam, no consumption');
  assert.deepEqual(w2.remoteList(), [], 'and still nothing staged');
  assert.equal(w2.box.rows[0].text, 'You study the map.');

  // ...and the map arm stands ABOVE the quest guard (:1471 vs :1480):
  // a quest map is read and eaten rather than refused
  const h3 = hooks('Sell');
  const qmap = { group: 'MiscItems', templateIndex: 287, name: 'Map', value: 25, questItem: true };
  h3.bag.length = 0;
  h3.bag.push(qmap);
  h3.entity = { items: h3.bag };
  let revealed3 = 0;
  h3.revealMap = () => { revealed3++; return { name: 'Wayrest' }; };
  const w3 = new NativeTradeWindow(h3);
  w3.click(...LOCAL_SLOT0);
  assert.equal(revealed3, 1, 'the map arm runs before the quest guard');
  assert.equal(h3.bag.length, 0);
});
