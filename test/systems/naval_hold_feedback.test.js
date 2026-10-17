import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from '../chargenDom.mjs';
import { mountNavalPlunderWindow } from '../../src/ui/naval/navalPlunderWindow.js';
import { racialSuppressInventory } from '../../src/systems/lycanthropy.js';
const source = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('  function navalOpenPlunder(model)'), source.indexOf('  const navalFlames ='));
function door({ beast = false, ready = true, factory = true } = {}) {
  const events = [], overlays = [];
  let modelDeps;
  const inventory = {};
  const playerEntity = { activeEffects: beast ? [{ kind: 'racialOverride', racial: 'lycanthropy', isTransformed: true, infectionType: 1 }] : [] };
  // the pack's ONE door (ui/inventoryDoor.js createInventoryWindow): a beast's refusal is its own - its box said, null answered
  const scope = { playerEntity,
    inventoryDoorReady: () => ready, makeInventoryWindow: () => { events.push('factory'); return factory && !racialSuppressInventory(playerEntity) ? inventory : null; },
    CONTAINER_IMAGES: { Chest: 0 }, itemLongName: () => '', createNavalPlunderOverlay: (d) => { modelDeps = d; return {}; },
    townTalk: { showOverlay: (win, closed) => overlays.push({ win, closed }), say: (text) => events.push(text) } };
  const open = new Function('scope', `with(scope) { ${functions}; return navalOpenPlunder; }`)(scope);
  const model = { items: [], fated: () => false };
  open(model);
  return { events, overlays, inventory, deps: modelDeps };
}
for (const opts of [{ beast: true }, { ready: false }, { factory: false }]) test(`hold refusal stays in plunder with explicit feedback ${JSON.stringify(opts)}`, (t) => {
  const d = door(opts);
  const host = document.createElement('div'), exits = [];
  const view = mountNavalPlunderWindow(host, { model: { name: 'Prize', items: [], mine: () => null, offers: () => [] }, prepareHold: d.deps.prepareHold, onExit: (r) => exits.push(r) });
  t.after(() => view.unmount());
  byClass(host, 'dfnaval-open')[0].click();
  assert.equal(exits.length, 0);
  assert.ok(byClass(host, 'dfnaval-note')[0].textContent.length > 15);
  assert.equal(d.overlays.length, 1);
  if (opts.ready === false) assert.equal(d.events.length, 0);
  if (opts.beast) assert.deepEqual(d.events, ['factory'], 'DISC10-E L3: the door refuses the beast, never a copy of its gate in the host');
  assert.doesNotMatch(functions, /Lycanthrope|shapechanged|transformed/i, 'no host-side beast gate');
  view.unmount();
});
test('normal hold prepared once, opens after plunder closes, returns after inventory closes', () => {
  const d = door();
  assert.equal(d.deps.prepareHold(), null);
  d.deps.onClose('hold');
  d.overlays[0].closed();
  assert.equal(d.overlays[1].win, d.inventory);
  assert.deepEqual(d.events, ['factory']);
  d.overlays[1].closed();
  assert.equal(d.overlays.length, 3);
});
for (const fate of ['scuttle', 'adrift']) test(`refused ${fate} keeps plunder visible`, (t) => {
  const host = document.createElement('div'), exits = [];
  const view = mountNavalPlunderWindow(host, { model: { name: 'Prize', items: [], mine: () => null, offers: () => [], fate: () => false }, onExit: (r) => exits.push(r) });
  t.after(() => view.unmount());
  byClass(host, `dfnaval-${fate}`)[0].click();
  assert.deepEqual(exits, []);
  assert.match(byClass(host, 'dfnaval-note')[0].textContent, /safe return deck/);
  view.unmount();
});
