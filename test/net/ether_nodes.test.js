// ETHER-NODES (2026-10-12, the owner: "We also need to implement gathering nodes within the area"; bible/03-World/
// Eltheric-Ocean.md ETHER-NODES) - THE ELTHERIC OCEAN'S GROUND IS THE NODES' GROUND. Its isles stood the day's trees,
// herb patches, veins and boulders (their climates are the professions' own) and its open water the day's schools, and
// the nodes' law - both ends read it, net/nodeLaw.js - knew the Bay's 1000 x 500 alone: an isle's node id was refused
// (`bad-node`, "There is nothing here to gather."), a haul's too, and every ask after an isle pixel's witnesses was
// refused whole (`bad-pixels`), five seconds apart for as long as the captain stood there. The law's ground is the
// Bay's map and the Eltheric's box now (world/ethericSea.js inEther, one home), its ids spelt once each.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { harvestNode, profPixels } from '../../server-account/src/professions.js';
import { pixelOk, nodeKey, haulKey, parseNodeKey, herbPatches, HERB_TABLES, pixelKey, WITNESS } from '../../src/net/nodeLaw.js';
import { ETHER_BOX, ETHER_MARGIN, islesNear, veilhaven, inEther } from '../../src/world/ethericSea.js';
import { ETHER_REGION } from '../../src/world/etherPlaces.js';
import { utcDay } from '../../src/net/marksLaw.js';

const NOW = T0;
const TODAY = utcDay(NOW);
const realNow = Date.now;
Date.now = () => NOW * 1000;
test.after(() => { Date.now = realNow; });
const rand = (b) => globalThis.crypto.getRandomValues(b);

/** A wild isle by Veilhaven whose climate grows herbs, and a common patch of its centre pixel today. */
const ISLE = islesNear(veilhaven().px - 60, veilhaven().py, 60).find((i) => i.kind !== 'port' && HERB_TABLES[i.climate]);
const PATCH = herbPatches({ x: ISLE.px, y: ISLE.py, day: TODAY, climate: ISLE.climate, confirmed: false }).find((p) => p.tier === 1);

test('ETHER-NODES: the law\'s ground is the Bay\'s map and the Eltheric\'s box - its corners in, a pixel past any side out, the law\'s margin and the continent past the map out (mutant: the Bay\'s map alone)', () => {
  const { x0, x1, y0, y1 } = ETHER_BOX;
  assert.deepEqual([[0, 0], [999, 499], [1000, 0], [0, 500], [-1, 0], [0, -1]].map(([x, y]) => pixelOk(x, y)), [true, true, false, false, false, false], 'the Bay\'s map, as ever');
  assert.deepEqual([[x0, y0], [x1 - 1, y0], [x0, y1 - 1], [x1 - 1, y1 - 1], [ISLE.px, ISLE.py], [veilhaven().px, veilhaven().py]].map(([x, y]) => pixelOk(x, y)), [true, true, true, true, true, true], 'the box\'s four corners and its isles');
  assert.deepEqual([[x0 - 1, y0], [x1, y0], [x0, y0 - 1], [x0, y1], [x0 - ETHER_MARGIN, y0], [-5, 250]].map(([x, y]) => pixelOk(x, y)), [false, false, false, false, false, false], 'past each side, the law\'s margin and the continent');
  assert.deepEqual([[x0 + 0.5, y0], [x0, Number.NaN], ['70', -3000]].map(([x, y]) => pixelOk(x, y)), [false, false, false], 'a whole pixel only');
  assert.equal(inEther(ISLE.px, ISLE.py), true);
});

test('ETHER-NODES: an Eltheric node\'s id and a haul\'s read back - four digits east, the sign north - and only in their one spelling (mutants: the old three digits; no sign)', () => {
  const k = nodeKey({ kind: 'herb', x: ISLE.px, y: ISLE.py, day: TODAY, slot: PATCH.slot });
  assert.match(k, /^herb:\d{4}:-\d{4}:\d+:\d+$/);
  assert.deepEqual(parseNodeKey(k), { kind: 'herb', x: ISLE.px, y: ISLE.py, day: TODAY, slot: PATCH.slot });
  for (const kind of ['tree', 'vein', 'boulder']) assert.deepEqual(parseNodeKey(nodeKey({ kind, x: 8127, y: -7680, day: 1, slot: 0 })), { kind, x: 8127, y: -7680, day: 1, slot: 0 });
  const h = haulKey({ x: veilhaven().px + 4, y: veilhaven().py, day: TODAY, id: '0123456789ab' });
  assert.deepEqual(parseNodeKey(h), { kind: 'haul', x: veilhaven().px + 4, y: veilhaven().py, day: TODAY, id: '0123456789ab' });
  for (const bad of [`herb:0${ISLE.px}:${ISLE.py}:1:0`, `herb:${ISLE.px}:-0${-ISLE.py}:1:0`, 'herb:8128:-3000:1:0', 'herb:5000:-2688:1:0', 'herb:5000:-7681:1:0', 'herb:12345:-3000:1:0',
    'herb:5000:--3000:1:0', 'herb:-0:0:1:0', 'herb:0:-0:1:0', 'haul:8128:-3000:1:0123456789ab', 'haul:5000:+3000:1:0123456789ab']) {
    assert.equal(parseNodeKey(bad), null, bad);
  }
});

test('ETHER-NODES: the service takes an Eltheric isle\'s harvest, and answers its pixels\' witnesses - both refused on the tree before (`bad-node`, `bad-pixels`)', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const w = await s.registered('Mac');
  raw.prepare('UPDATE players SET registered_at = ? WHERE id = ?').run(NOW - WITNESS.ageS, w.id);
  const row = raw.prepare('SELECT * FROM players WHERE id = ?').get(w.id);
  const node = nodeKey({ kind: 'herb', x: ISLE.px, y: ISLE.py, day: TODAY, slot: PATCH.slot });
  const a = await harvestNode({ db: s.env.DB, nowS: NOW, rand }, row, s.env, {
    character: w.character, node, kind: 'herbs', climate: ISLE.climate, region: ETHER_REGION, act: { clean: false, bruised: false }, at: NOW - 2, rid: 'ether-nodes-0001',
  });
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.ok(a.qty > 0);
  const px = await profPixels({ db: s.env.DB }, row, s.env, { character: w.character, pixels: [[ISLE.px, ISLE.py], [ISLE.px + 1, ISLE.py]], dungeons: [] });
  assert.equal(px.error, undefined, JSON.stringify(px));
  assert.deepEqual(px.pixels.map((p) => [pixelKey(p.x, p.y), p.state]), [[pixelKey(ISLE.px, ISLE.py), 'unconfirmed'], [pixelKey(ISLE.px + 1, ISLE.py), 'none']], 'the harvest\'s own witness, and a pixel no one has reported');
  assert.deepEqual(await profPixels({ db: s.env.DB }, row, s.env, { character: w.character, pixels: [[ETHER_BOX.x1, ISLE.py]], dungeons: [] }), { error: 'bad-pixels' }, 'past the box, refused as ever');
});
