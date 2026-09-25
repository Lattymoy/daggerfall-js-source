// PORT0-5: the classic service windows in the enhanced skin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { quietRenderer, centreOf } from '../src/ui/enhancedPort.js';
import { PORT_SPECS, enhancedWindow } from '../src/ui/enhancedPorts.js';
import { classicScope, inClassicScope } from '../src/ui/enhancedScope.js';
import { drawEnhancedDialog } from '../src/ui/enhancedDialog.js';
import { GuildServiceWindow, GUILD_RECTS, PANEL_X, PANEL_Y } from '../src/ui/guildServiceWindow.js';
import { TransportWindow } from '../src/ui/transportWindow.js';
import { PLUS_CSS as ENHANCED_CSS } from '../src/ui/enhancedPlusStyle.js';   // PLUS1: the refresh's dress is the Enhanced Plus sheet

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const acts = (view) => {
  const out = [];
  const walk = (b) => { if (!b) return; if (b.items) out.push(...b.items); if (b.blocks) b.blocks.forEach(walk); if (b.cols) b.cols.flat().forEach(walk); };
  (view.blocks ?? []).forEach(walk);
  return out.concat(view.foot ?? []);
};

test('PORT2: the quiet renderer paints nothing and keeps the canvas and the data', () => {
  let painted = 0;
  const canvas = { width: 1 };
  const q = quietRenderer({ canvas, screenOffset: [3, 4], drawScreenQuad: () => { painted++; } });
  q.drawScreenQuad(null, {});
  assert.equal(painted, 0);
  assert.equal(q.canvas, canvas);
  assert.deepEqual(q.screenOffset, [3, 4], 'a data field is still the renderer\'s');
});

test('PORT2: a press lands on the classic button\'s centre, in its panel', () => {
  assert.deepEqual(centreOf([5, 14, 120, 7], PANEL_X, PANEL_Y), [PANEL_X + 65, PANEL_Y + 17.5]);
});

test('PORT4: the classic skin (no document) gets the classic window back, untouched', () => {
  const w = new TransportWindow({ hasHorse: true });
  assert.equal(enhancedWindow(w, 'transport'), w);
});

test('PORT4: the guild port presses the window\'s own buttons', () => {
  const log = [];
  const w = new GuildServiceWindow({ member: () => false, service: () => 'Training', rows: () => [], steps: () => [],
    onTalk: () => log.push('talk'), onJoin: () => { log.push('join'); return null; }, onClose: () => log.push('close') });
  const view = PORT_SPECS.guild.view(w);
  const labels = acts(view).map((a) => a.label);
  assert.deepEqual(labels, ['Join guild', 'Talk', 'Training', 'Exit'], 'a non-member sees Join first');
  acts(view).find((a) => a.label === 'Talk').act();
  assert.deepEqual(log, ['talk']);
  assert.ok(GUILD_RECTS.talk);
});

test('PORT4: the transport port greys what the classic window refuses', () => {
  const picked = [];
  const w = new TransportWindow({ hasHorse: true, hasCart: false, shipAvailable: false, onMode: (m) => picked.push(m) });
  const items = acts(PORT_SPECS.transport.view(w));
  assert.equal(items.find((a) => a.label === 'Cart').disabled, true);
  assert.equal(items.find((a) => a.label === 'Horse').disabled, false);
  items.find((a) => a.label === 'Horse').act();
  assert.equal(picked.length, 1);
  assert.equal(w.done, true);
});

test('PORT0: inside the classic scope the enhanced boxes stand down (the classic travel map)', () => {
  const box = { rows: [{ text: 'Travel?' }], buttons: [{ button: 3, rect: [0, 0, 1, 1] }] };
  const fakeDoc = { body: { append() {} }, createElement: () => { throw new Error('should not build'); } };
  assert.equal(inClassicScope(), false);
  classicScope(() => {
    assert.equal(inClassicScope(), true);
    assert.equal(drawEnhancedDialog({}, { ox: 0, oy: 0, s: 1 }, box, {}, fakeDoc), false);
  });
  assert.equal(inClassicScope(), false);
  assert.match(read('src/ui/travelMapWindow.js'), /TravelMapWindow\.prototype\.draw = function draw\(\.\.\.args\) \{ return classicScope/);
});

test('PORT3: the list hands its draw to the enhanced list under the enhanced skin only', () => {
  const src = read('src/ui/listPicker.js');
  assert.match(src, /typeof document !== 'undefined' && isEnhancedPlus\(\)[\s\S]{0,300}drawEnhancedPicker\(this, renderer, canvas/);
});

test('PORT4: every service window is ported at its one construction site', () => {
  const modes = read('src/scenes/worldModes.js');
  for (const kind of ['bankPurchase', 'bank', 'coven', 'guild', 'daedra', 'potionMaker', 'itemMaker', 'spellMaker']) {
    assert.ok(modes.includes(`enhancedWindow(`) && new RegExp(`enhancedWindow\\(\\w+, '${kind}'\\)`).test(modes), kind);
  }
  assert.match(read('src/player/mountRig.js'), /enhancedWindow\(new TransportWindow\([\s\S]*?\), 'transport'\)/);
});

test('PORT5: the sheet carries the ports, and the kit still comes last', () => {
  assert.ok(ENHANCED_CSS.includes('PORT5: THE PORTED WINDOWS'));
  assert.ok(ENHANCED_CSS.lastIndexOf('FRAME1: THE STONE-AND-BRASS KIT') > ENHANCED_CSS.lastIndexOf('PORT5: THE ENHANCED LIST'));
});
