import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MerchantServiceWindow, MERCHANT_RECTS, MERCHANT_PANEL_W, MERCHANT_PANEL_H,
  MERCHANT_PANEL_X, MERCHANT_PANEL_Y, merchantServiceLabel, MERCHANT_SERVICE_LABEL,
} from '../src/ui/merchantServiceWindow.js';

// UI2 - THE MERCHANT SERVICE POPUP (DaggerfallMerchantServicePopupWindow,
// whole). The port SKIPPED it: staticNpcRoute has answered 'sell' and
// 'banking' since G8 and worldModes jumped straight to the trade or bank
// window, so the merchant's own panel - and its Talk row - never
// appeared. DFU never opens either window without this in front.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('UI2: the panel and its three child rects are DFU\'s (:22-24, :63-66)', () => {
  assert.equal(MERCHANT_PANEL_W, 130); assert.equal(MERCHANT_PANEL_H, 42);
  // Center/Middle ignore the declared Position (0,50) - BaseScreenComponent :1217/:1234.
  assert.equal(MERCHANT_PANEL_X, 95); assert.equal(MERCHANT_PANEL_Y, 79);
  assert.deepEqual([...MERCHANT_RECTS.talk], [5, 5, 120, 7]);
  assert.deepEqual([...MERCHANT_RECTS.service], [5, 14, 120, 7]);
  assert.deepEqual([...MERCHANT_RECTS.exit], [44, 24, 43, 15]);
});

test('UI2: GetServiceLabelText - Sell and Banking, with `default:` folded into Sell (:78-88)', () => {
  assert.deepEqual({ ...MERCHANT_SERVICE_LABEL }, { Sell: 'Sell', Banking: 'Banking' });
  assert.equal(merchantServiceLabel('Banking'), 'Banking');
  assert.equal(merchantServiceLabel('Sell'), 'Sell');
  assert.equal(merchantServiceLabel(undefined), 'Sell', 'the C# default case IS the Sell case');
  assert.equal(merchantServiceLabel('Nonsense'), 'Sell');
});

test('UI2: every handler CLOSES before it acts (:86-87, :93-94, :113-114)', () => {
  const order = [];
  const win = () => new MerchantServiceWindow({
    service: 'Sell',
    onTalk: () => order.push('talk'), onService: () => order.push('service'),
    onClose: () => order.push('close'),
  });
  const inside = ([rx, ry]) => [rx + MERCHANT_PANEL_X + 1, ry + MERCHANT_PANEL_Y + 1];
  let w = win(); w.click(...inside(MERCHANT_RECTS.talk));
  assert.deepEqual(order, ['close', 'talk']); assert.equal(w.done, true);
  order.length = 0;
  w = win(); w.click(...inside(MERCHANT_RECTS.service));
  assert.deepEqual(order, ['close', 'service']);
  order.length = 0;
  w = win(); w.click(...inside(MERCHANT_RECTS.exit));
  assert.deepEqual(order, ['close'], 'exit closes and does nothing else');
  // A click outside every rect is eaten by the panel, not passed through.
  order.length = 0;
  w = win();
  assert.equal(w.click(0, 0), true);
  assert.deepEqual(order, []);
  assert.equal(w.done, false);
});

test('UI2: the accelerators - Escape/Enter/E exit, T talks, S takes the service', () => {
  const order = [];
  const win = () => new MerchantServiceWindow({ service: 'Banking', onTalk: () => order.push('talk'), onService: () => order.push('service'), onClose: () => order.push('close') });
  for (const code of ['Escape', 'Enter', 'KeyE']) {
    order.length = 0; const w = win(); w.input(code);
    assert.deepEqual(order, ['close'], code);
  }
  order.length = 0; win().input('KeyT'); assert.deepEqual(order, ['close', 'talk']);
  order.length = 0; win().input('KeyS'); assert.deepEqual(order, ['close', 'service']);
  order.length = 0; win().input('KeyZ'); assert.deepEqual(order, [], 'an unbound key does nothing');
});

test('UI2: the host raises the popup for BOTH services, and the direct arms are the art-less fallback', () => {
  const s = read('src/scenes/worldModes.js');
  assert.match(s, /if \(!forceTalk && route\.kind === 'merchant'\s*\n\s*&& \(route\.service === 'banking' \|\| route\.service === 'sell'\)\s*\n\s*&& merchantServiceArtLoaded\(\) && _shopFont\) \{/);
  assert.match(s, /service: banking \? 'Banking' : 'Sell',/);
  assert.match(s, /onTalk: \(\) => openStaticNpc\(pn, \{ forceTalk: true \}\),/, 'the Talk row DFU has and the port had lost');
  assert.match(s, /onService: \(\) => \{ if \(banking\) openBank\(\); else openMerchantSell\(\); \},/);
  // The old direct arms stay BELOW it - the never-traps law, for a
  // build whose GNRC01I0 did not load.
  const popupAt = s.indexOf('MerchantServiceWindow({');
  assert.ok(s.indexOf("&& openBank()) return;", popupAt) > popupAt);
  assert.ok(s.indexOf("&& openMerchantSell()) return;", popupAt) > popupAt);
  assert.match(s, /preloadMerchantServiceArt\(\{ renderer, fetchBytes, palette \}\);/);
});
