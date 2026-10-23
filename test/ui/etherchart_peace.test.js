// ETHER-WILD (2026-10-21) - THE PEACE ON THE CHART. The owner asked for the open sea's PvP and its reasons to venture;
// the chart of the Eltheric Ocean (ui/etherChartWindow.js) draws Veilhaven's peace - the circle no player fights in - while
// its word says the open sea is an open PvP zone, names it once it is wide enough, and keys it. bible/03-World/Eltheric-Ocean.md
// ETHER-WILD. tools/mutants/etherwild.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from '../../src/ui/etherChartWindow.js';
import * as ES from '../../src/world/ethericSea.js';
import { ETHER_PEACE_PX } from '../../src/systems/wild/etherWild.js';

const src = readFileSync(new URL('../../src/ui/etherChartWindow.js', import.meta.url), 'utf8');
const h = ES.veilhaven();
const W = 1064, H = 550;
const word = (o = {}) => ({ px: h.px - 18, py: h.py + 3, yaw: 0, charted: [h.key], legends: [], stats: {}, ...o });
const at = (zoom, dx = 0, dy = 0) => ({ cx: h.px + 0.5 + dx, cy: h.py + 0.5 + dy, zoom });
function stubContext() {
  const log = [];
  const ctx = new Proxy({}, {
    get(_, k) {
      if (k === 'log') return log;
      if (k === 'measureText') return (t) => ({ width: String(t).length * 7 });
      if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
      return (...a) => { log.push([k, ...a]); };
    },
    set(_, k, v) { log.push(['=', k, v]); return true; },
  });
  return /** @type {any} */ (ctx);
}

test('ETHER-WILD the chart: Veilhaven\'s peace a circle about Veilhaven, ETHER_PEACE_PX at the chart\'s scale, while the word says the open sea fights - none offline; named from PEACE_NAME_R', () => {
  assert.equal(M.chartModel(word(), at(2), W, H).peace, null, 'no word of PvP (offline): no peace drawn - there is nothing to be safe from');
  assert.equal(M.chartModel(word({ pvp: false }), at(2), W, H).peace, null);
  for (const zoom of [0, 1, 2, 3, 4]) {
    const m = M.chartModel(word({ pvp: true }), at(zoom), W, H);
    const k = M.CHART_ZOOMS[zoom];
    // PIN MOVED (AUDIT SEA VENTURES C2): and the way home east of her to the Veil (`vx`, the Veil's screen x)
    assert.deepEqual(m.peace, { x: W / 2, y: H / 2, r: ETHER_PEACE_PX * k, vx: W / 2 + (ES.VEIL_X - h.px) * k, named: ETHER_PEACE_PX * k >= M.PEACE_NAME_R }, `zoom x${k}`);
  }
  assert.deepEqual([0, 1, 2, 3, 4].map((z) => M.chartModel(word({ pvp: true }), at(z), W, H).peace.named), [false, false, true, true, true], 'named from x4 (48 px of radius) - x2\'s 24 px holds Veilhaven\'s own name and no more');
  assert.equal(M.PEACE_NAME_R, 40);
  const off = M.chartModel(word({ pvp: true }), at(4, 400, 0), W, H);
  assert.equal(off.peace, null, 'off the canvas: not drawn');
  const edge = M.chartModel(word({ pvp: true }), at(4, (W / 2 + 100) / 16, 0), W, H);
  assert.ok(edge.peace && edge.peace.x < 0 && edge.peace.x + edge.peace.r > 0, 'a ring whose centre is off the canvas but whose water reaches it is drawn');
});

test('ETHER-WILD the chart: the peace painted as water - before the haunts and the isles\' marks - a wash and a dashed ring; its name inside its ring\'s top, drawn with the words; the key\'s row shown with the word', () => {
  const m = M.chartModel(word({ pvp: true, legends: [{ id: 'wake', name: 'Sorrow\'s Wake', trait: 'swift', sails: true }] }), at(4), W, H);
  const g = stubContext();
  M.paintChart(g, m, W, H);
  const ring = g.log.findIndex((c) => c[0] === 'arc' && c[1] === m.peace.x && c[2] === m.peace.y && c[3] === m.peace.r);
  assert.ok(ring > 0, 'the circle');
  // PIN MOVED (AUDIT SEA VENTURES C2): the ring's west half and the band to the Veil, one shape, then its wash
  assert.deepEqual(g.log.slice(ring - 4, ring + 3).map((c) => c[0] === '=' ? c.slice(0, 3) : c), [
    ['moveTo', m.peace.x, m.peace.y - m.peace.r], ['lineTo', m.peace.vx, m.peace.y - m.peace.r], ['lineTo', m.peace.vx, m.peace.y + m.peace.r], ['lineTo', m.peace.x, m.peace.y + m.peace.r],
    ['arc', m.peace.x, m.peace.y, m.peace.r, Math.PI / 2, Math.PI * 1.5], ['closePath'], ['=', 'fillStyle', M.PEACE_FILL]]);
  assert.ok(g.log.slice(ring, ring + 6).some((c) => c[0] === 'setLineDash' && c[1].length === 2), 'its ring dashed');
  const firstIsle = g.log.findIndex((c) => c[0] === 'arc' && c[3] !== m.peace.r && c[1] !== m.peace.x);
  assert.ok(ring < firstIsle, 'under the isles\' marks');
  // AUDIT SEA VENTURES F6: and under a haunt - the model above has none in view (the wake's haunt lies 95 px west of
  // her), so the order was pinned against the isles alone: a view between the two holds both
  const both = M.chartModel(word({ pvp: true, legends: [{ id: 'wake', name: 'Sorrow\'s Wake', trait: 'swift', sails: true }] }), at(2, -47, 25), W, H);
  assert.ok(both.peace && both.haunts.length === 1, 'her peace and the wake\'s haunt in one view');
  const g3 = stubContext();
  M.paintChart(g3, both, W, H);
  const peaceAt = g3.log.findIndex((c) => c[0] === 'arc' && c[1] === both.peace.x && c[3] === both.peace.r);
  const hauntAt = g3.log.findIndex((c) => c[0] === 'fillRect' && c[1] === both.haunts[0].x - both.haunts[0].r && c[3] === 2 * both.haunts[0].r);
  assert.ok(peaceAt > 0 && hauntAt > peaceAt, 'the peace\'s water under the haunt\'s square');
  const name = g.log.findIndex((c) => c[0] === 'fillText' && c[1] === M.peaceName());
  assert.ok(name > ring, 'named');
  assert.deepEqual(g.log[name].slice(2), [Math.round(m.peace.x), Math.round(m.peace.y - m.peace.r + 12)], 'inside its ring\'s top, centred');
  const g2 = stubContext();
  M.paintChart(g2, M.chartModel(word({ pvp: true }), at(1), W, H), W, H);
  assert.equal(g2.log.some((c) => c[0] === 'fillText' && c[1] === M.peaceName()), false, 'too small to name');
  assert.deepEqual([...M.CHART_PEACE_KEY], ['peace', 'Veilhaven\'s peace - past it, open PvP']);
  assert.deepEqual(M.CHART_KEY.map(([k]) => k), ['port', 'ruin', 'wild', 'rock', 'ship', 'haunt', 'sunk'], 'the marks\' key as it stood');
  const kg = stubContext();
  M.paintKey(kg, 'peace', 9, 9);
  assert.deepEqual(kg.log.find((c) => c[0] === 'arc'), ['arc', 9, 9, 7, 0, Math.PI * 2]);
  assert.match(src, /peaceItem\.hidden = !word\.pvp;/, 'the key\'s row stands with the word, asked at every paint');
  // PIN MOVED (SEA-VAULTS, 2026-10-22): the chart's word of the open sea is the sea's ventures' (scenes/seaVenturesHost.js chartWord) - its pvp their live gate
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /return \{ \.\.\.etherHost\.chart\(p\.x, p\.y, heading\(\)\), \.\.\.seaVentures\.chartWord\(\) \};/, 'the word\'s pvp: the sea\'s ventures\'');
  assert.match(w, /createSeaVentures\(\{\n\s+live: \(\) => etherSea && _onlineWorldSession\(\) && !!online\?\.wildOk,/, 'online, at a relay that raises the zone');
  assert.match(readFileSync(new URL('../../src/scenes/seaVenturesHost.js', import.meta.url), 'utf8'), /^      pvp: live\(\),$/m);
});
