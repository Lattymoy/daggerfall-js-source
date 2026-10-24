// ETHER-CHART2 (2026-10-12, the owner: "I want to improve the [Eltheric] sea map, its icons, the highlight areas, etc and
// improve readability"; bible/03-World/Eltheric-Ocean.md ETHER-CHART2) - THE CHART READ AT A GLANCE: its words in the
// enhanced face and drawn last, either side of their isle, in layers; a shape for each kind's mark; the depths as waters
// under a grid a scale bar long; the haunts washed and named in view; the ship ringed, and pointed to off the canvas; the
// isle named ringed with its bearing and card; the key. tools/mutants/etherchart2.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from '../../src/ui/etherChartWindow.js';
import * as ES from '../../src/world/ethericSea.js';
import { PIXEL_STACK } from '../../src/ui/pixelifyFive.js';

const src = readFileSync(new URL('../../src/ui/etherChartWindow.js', import.meta.url), 'utf8');
const over = (p, q) => p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3];
const h = ES.veilhaven();
const LEGENDS = [{ id: 'queen', name: 'The Drowned Queen', trait: 'mends', sails: false }, { id: 'wake', name: 'Sorrow\'s Wake', trait: 'swift', sails: true }, { id: 'hunger', name: 'Ninefold Hunger', trait: 'boarders', sails: true }];
/** The captain the chart was read with in Chromium: a hundred isles charted west of Veilhaven, three legends heard of. */
const charted = [...new Set([h.key, ...ES.islesNear(h.px - 40, h.py, 70).map((i) => i.key), ...ES.islesNear(Math.round(ES.VEIL_X - 30 * ES.LEAGUE_PX), h.py, 40).map((i) => i.key)])];
const word = (o = {}) => ({ px: h.px - 18, py: h.py + 3, yaw: 0, charted, legends: LEGENDS, stats: {}, ...o });
const W = 1064, H = 550;
const at = (zoom, dx = 0, dy = 0) => ({ cx: h.px - 17.5 + dx, cy: h.py + 3.5 + dy, zoom });

/** A context that records what it is asked: [name, ...args] for a call, ['=', name, value] for a set. */
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

test('ETHER-CHART2 the face: the enhanced pixel stack at FONT3\'s reading pair, never the "Cormorant Garamond" no request loads; the chart painted again when the face lands; a name\'s width the canvas\'s own, the measured mean letter without one (mutants: the face, the landing)', () => {
  assert.equal(M.CHART_FONT.name, `500 12px ${PIXEL_STACK}`);
  assert.equal(M.CHART_FONT.small, `500 11px ${PIXEL_STACK}`);
  assert.equal(M.CHART_TRACKING, '0.5px');
  assert.equal(M.LABEL_CHAR_PX, 6.7);
  assert.ok(!/Cormorant/.test(Object.values(M.CHART_FONT).join()), 'no face the skin never loads');
  assert.deepEqual(src.match(/\.font = [^;]+;/g).filter((f) => !/\.font = (CHART_FONT\.(name|small)|font);/.test(f)), [], 'every face set is the chart\'s own');
  assert.match(src, /fonts\?\.load\?\.\(CHART_FONT\.name\)\?\.then\?\.\(landed, \(\) => \{\}\);/);
  assert.match(src, /model = chartModel\(word, view, w, h, \{ measure, pick \}\);/, 'the window measures its names');
  const wide = M.chartModel(word(), at(3), W, H, { measure: (t) => t.length * 20 });
  const narrow = M.chartModel(word(), at(3), W, H);
  const one = (m) => m.isles.find((i) => i.label && i.box);
  assert.ok(Math.abs(one(narrow).box[2] - one(narrow).box[0] - M.capFirst(one(narrow).name).length * M.LABEL_CHAR_PX) < 1e-9, 'the mean letter, without a canvas');
  assert.ok(wide.isles.filter((i) => i.label).length < narrow.isles.filter((i) => i.label).length, 'wider names, fewer lettered');
});

test('ETHER-CHART2 a mark for each kind, a shape as well as a colour - a port round with its harbour\'s dot, a ruin a diamond, a wild isle a peak, a rock a cross - outlined in ink; the key drawn by the same painter (mutants: the ruin, the peak)', () => {
  assert.deepEqual({ ...M.KIND_COLOURS }, { port: '#f0c06a', ruin: '#e0664c', wild: '#6cc48a', rock: '#a9afba' });
  const shape = (kind) => {
    const g = stubContext();
    M.paintMark(g, kind, 50, 50, 5);
    return g.log.filter((c) => ['arc', 'moveTo', 'lineTo', 'closePath'].includes(c[0])).map((c) => c[0]).join(' ');
  };
  const shapes = ['port', 'ruin', 'wild', 'rock'].map(shape);
  assert.deepEqual(shapes, ['arc arc', 'moveTo lineTo lineTo lineTo closePath', 'moveTo lineTo lineTo closePath', 'moveTo lineTo moveTo lineTo']);
  assert.equal(new Set(shapes).size, 4, 'four shapes');
  assert.deepEqual(M.CHART_KEY.map(([k]) => k), ['port', 'ruin', 'wild', 'rock', 'ship', 'haunt', 'sunk']);
  assert.match(src, /for \(const \[what, words\] of CHART_KEY\) \{/);
  assert.match(src, /if \(kg\) \{ kg\.setTransform\(dpr0, 0, 0, dpr0, 0, 0\); paintKey\(kg, what, 9, 9\); \}/);
  const m = M.chartModel(word(), at(2), W, H);
  assert.equal(m.isles.find((i) => i.key === h.key).home, true, 'Veilhaven ringed');
  assert.deepEqual([...M.ICON_PX], [2.5, 3, 4, 5, 6]);
  assert.ok(m.isles.every((i) => i.icon === M.ICON_PX[2] + (i.kind === 'port' ? 1 : 0) && i.r === Math.max(i.icon + 1, i.land)), 'a mark\'s size the zoom\'s, a port\'s one more');
});

test('ETHER-CHART2 every word drawn last: no mark, ring or ship is painted after the first name (mutants: a mark after the words)', () => {
  const m = M.chartModel(word(), at(3), W, H, { pick: h.key });
  assert.ok(m.isles.filter((i) => i.label).length > 5);
  const g = stubContext();
  M.paintChart(g, m, W, H);
  const names = new Set(m.isles.filter((i) => i.label).map((i) => M.capFirst(i.name)));
  const first = g.log.findIndex((c) => (c[0] === 'fillText' || c[0] === 'strokeText') && names.has(c[1]));
  const lastMark = g.log.findLastIndex((c) => c[0] === 'arc' || c[0] === 'closePath');
  assert.ok(first > 0 && lastMark > 0 && lastMark < first, `the last mark (${lastMark}) before the first name (${first})`);
  assert.ok(g.log.some((c) => c[0] === 'strokeText' && names.has(c[1])), 'under a halo');
});

test('ETHER-CHART2 a name on either side of its isle, in layers: none over another nor over a haunt\'s; on the side clear of the other isles\' marks where one is; a port weighing the ports\' marks alone (mutants: the marks, the ports\' marks) - PIN MOVED (AUDIT ETHER-CHART2 U2: the band names and the Veil\'s are on the ruler, off the map)', () => {
  let west = 0, views = 0;
  for (const [zoom, dx, dy] of [[2, 0, 0], [3, 0, 0], [3, -40, 0], [3, -60, 10], [4, -20, 0], [2, -30, -20], [3, -10, 30]]) {
    const m = M.chartModel(word(), at(zoom, dx, dy), W, H);
    const named = m.isles.filter((i) => i.label);
    const boxes = [...named.map((i) => i.box), ...m.haunts.filter((t) => t.box).map((t) => t.box)];
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) assert.ok(!over(boxes[a], boxes[b]), `zoom ${zoom}: two names over each other`);
    const plates = m.haunts.filter((t) => t.box).map((t) => t.box);
    const mark = (o) => [o.x - o.icon - 1, o.y - o.icon - 1, o.x + o.icon + 1, o.y + o.icon + 1];
    for (const i of named) {
      if (!m.isles.some((o) => o !== i && (i.kind !== 'port' || o.kind === 'port') && over(i.box, mark(o)))) continue;
      // over a mark: then its other side was over one too, or taken, or off the canvas
      const other = M.labelBoxes(i, i.box[2] - i.box[0]).find((b) => b[0] !== i.box[0]);
      const taken = boxes.some((b) => b !== i.box && over(other, b)) || plates.some((p) => over(other, p)) || other[0] < 0 || other[2] > W;
      assert.ok(taken || m.isles.some((o) => o !== i && (i.kind !== 'port' || o.kind === 'port') && over(other, mark(o))), `${i.name}: over a mark with its other side clear`);
    }
    west += named.filter((i) => i.box[2] <= i.x).length;
    views++;
  }
  assert.ok(west > 5, `names stand west of their isles too (${west} in ${views} views)`);
  // a port's name is placed by the ports and the chart's own words alone - every lesser isle away, the same boxes
  for (const [zoom, dx] of [[1, 0], [2, 0], [2, -30], [3, -40]]) {
    const all = M.chartModel(word(), at(zoom, dx), W, H);
    const ports = M.chartModel(word({ charted: charted.filter((k) => ES.isleByKey(k)?.kind === 'port') }), at(zoom, dx), W, H);
    const boxes = (m) => m.isles.filter((i) => i.kind === 'port').map((i) => [i.key, i.label, i.box]);
    assert.deepEqual(boxes(all), boxes(ports), `zoom ${zoom}: the ports' names the same with no lesser isle charted`);
  }
});

test('ETHER-CHART2 the depths as waters: each band\'s across the canvas, edge to edge, the Abyss\'s to the box\'s west edge; the world\'s edge (mutants: the waters) - and (PIN MOVED, AUDIT ETHER-CHART2 U2) THE DEPTH RULER: the world\'s edge, each band\'s water and the Veil\'s across it edge to edge, each named in its own water by the longest of its words that fits, the names drawn centred in it (mutants: the ruler\'s fit, its centre)', () => {
  assert.deepEqual({ ...M.DEPTH_TONES }, { shallows: '#173a55', reaches: '#112b42', deep: '#0b1d31', abyss: '#06101d' });
  const m = M.chartModel(word(), { cx: ES.VEIL_X - 60 * ES.LEAGUE_PX, cy: h.py, zoom: 0 }, W, H);
  assert.deepEqual(m.depths.map((d) => d.id), ['shallows', 'reaches', 'deep', 'abyss']);
  for (let n = 0; n + 1 < m.depths.length; n++) assert.equal(m.depths[n].x0, m.depths[n + 1].x1, 'edge to edge');
  assert.equal(m.depths[0].x1, m.veil, 'the Shallows\' to the Veil');
  assert.equal(m.depths.at(-1).x0, 0);
  const edge = M.chartModel(word(), { cx: ES.ETHER_BOX.x0, cy: ES.ETHER_BOX.y0, zoom: 2 }, W, H);
  assert.ok(edge.edge[0] > 0 && edge.edge[1] > 0, 'the box\'s corner in view');
  assert.equal(edge.depths.at(-1).x0, edge.edge[0], 'the Abyss\'s water stops at the world\'s edge');
  // the ruler: its words
  assert.equal(M.RULER_H, 22);
  assert.deepEqual(JSON.parse(JSON.stringify(M.RULER_WORDS)), { shallows: ['THE SHALLOWS', 'SHALLOWS'], reaches: ['THE REACHES', 'REACHES'], deep: ['THE DEEP AETHER', 'DEEP AETHER'], abyss: ['THE ABYSS', 'ABYSS'], veil: ['THE VEIL: TO THE ILIAC BAY', 'THE VEIL', 'VEIL'], edge: ['THE WORLD\'S EDGE', 'EDGE'] });
  const tile = (mm, w) => {
    assert.equal(mm.ruler[0].x0, 0, 'from the canvas\'s west edge');
    for (let n = 0; n + 1 < mm.ruler.length; n++) assert.equal(mm.ruler[n].x1, mm.ruler[n + 1].x0, 'edge to edge');
    assert.equal(mm.ruler.at(-1).x1, w, 'to its east edge');
    for (const seg of mm.ruler) if (seg.words) assert.ok(seg.words.length * M.LABEL_CHAR_PX + 12 <= seg.x1 - seg.x0 && M.RULER_WORDS[seg.id].includes(seg.words), `${seg.id}: its own words, inside its own water`);
  };
  tile(m, W);
  assert.deepEqual(m.ruler.map((seg) => seg.id), ['abyss', 'deep', 'reaches', 'shallows', 'veil']);
  assert.deepEqual(edge.ruler.map((seg) => [seg.id, seg.words]), [['edge', 'THE WORLD\'S EDGE'], ['abyss', 'THE ABYSS']]);
  tile(edge, W);
  // by the Veil at x1 the Shallows are narrower than their name: their short word, the Reaches\' whole; the longest that fits
  const x1 = M.chartModel(word(), at(0, -40), W, H);
  tile(x1, W);
  const word1 = (id) => x1.ruler.find((seg) => seg.id === id).words;
  assert.deepEqual([word1('shallows'), word1('reaches')], ['SHALLOWS', 'THE REACHES']);
  // every water in view named, whatever the bounds in view: x16 about Veilhaven has no bound in it, and is the Shallows
  const close = M.chartModel(word(), { cx: h.px, cy: h.py, zoom: 4 }, 400, 300);
  assert.deepEqual(close.bands, []);
  assert.deepEqual(close.ruler.map((seg) => [seg.id, seg.words]), [['shallows', 'THE SHALLOWS']]);
  // drawn centred in its own water, on the ruler and not the map
  const g = stubContext();
  M.paintRuler(g, m, W);
  for (const seg of m.ruler.filter((n) => n.words)) assert.ok(g.log.some((c) => c[0] === 'fillText' && c[1] === seg.words && Math.abs(c[2] - Math.round((seg.x0 + seg.x1) / 2)) < 1e-9), `${seg.id} centred`);
  const map = stubContext();
  M.paintChart(map, m, W, H);
  assert.ok(!map.log.some((c) => c[0] === 'fillText' && /^THE (SHALLOWS|REACHES|DEEP AETHER|ABYSS|VEIL)/.test(c[1])), 'no band name on the map');
});

test('ETHER-CHART2 the grid and the scale: the longest bar of 1, 2, 5, 10, 20, 50 or 100 leagues no longer than 120 px at each zoom, the grid\'s squares its length, measured from the Veil and Veilhaven\'s row (mutants: the bar)', () => {
  assert.deepEqual([...M.SCALE_LEAGUES], [1, 2, 5, 10, 20, 50, 100]);
  assert.equal(M.SCALE_MAX_PX, 120);
  assert.deepEqual(M.CHART_ZOOMS.map((_, z) => M.scaleBar(z).leagues), [20, 10, 5, 2, 1]);
  assert.equal(M.scaleBar(4).words, '1 league');
  assert.equal(M.scaleBar(0).words, '20 leagues');
  for (let z = 0; z < M.CHART_ZOOMS.length; z++) assert.ok(M.scaleBar(z).px <= M.SCALE_MAX_PX && M.scaleBar(z).px > M.SCALE_MAX_PX / 2.5);
  const m = M.chartModel(word(), at(2), W, H);
  assert.ok(m.grid.xs.length > 3 && m.grid.ys.length > 2);
  for (let n = 1; n < m.grid.xs.length; n++) assert.ok(Math.abs(Math.abs(m.grid.xs[n] - m.grid.xs[n - 1]) - m.scale.px) < 1e-6, 'a bar apart');
  const [vx] = M.toScreen(at(2), ES.VEIL_X, 0, W, H);
  assert.ok(m.grid.xs.every((x) => Math.abs(((vx - x) / m.scale.px) - Math.round((vx - x) / m.scale.px)) < 1e-6 && x < vx), 'from the Veil, west of it');
  const [, hy] = M.toScreen(at(2), 0, h.py + 0.5, W, H);
  assert.ok(m.grid.ys.some((y) => Math.abs(y - hy) < 1e-6), 'Veilhaven\'s row a line');
});

test('ETHER-CHART2 a haunt named in view: on a plate in a corner of her square\'s part in view no name takes - of those (AUDIT ETHER-CHART2 U6) the one over the fewest isles\' marks; at a far zoom her name alone over it, giving way to a port\'s; her state in words (mutants: the corner, the marks, the yield)', () => {
  const m = M.chartModel(word(), at(2), W, H);
  const wake = m.haunts.find((t) => t.name === 'Sorrow\'s Wake'), queen = m.haunts.find((t) => t.name === 'The Drowned Queen');
  assert.equal(wake.sub, 'Territory');
  assert.equal(queen.sub, 'Sunk. It will rise again');
  for (const t of [wake, queen]) {
    assert.equal(t.inside, true);
    assert.ok(t.box[1] >= 0 && t.box[0] >= 0 && t.box[2] <= W && t.box[3] <= H, `${t.name}: in view`);
    assert.ok(t.box[0] >= Math.max(0, t.x - t.r) && t.box[2] <= Math.min(W, t.x + t.r) && t.box[3] <= Math.min(H, t.y + t.r), `${t.name}: inside her square`);
    assert.ok(!m.isles.some((i) => i.label && over(i.box, t.box)), `${t.name}: no name under her plate`);
  }
  assert.ok(m.haunts.some((t) => t.box[0] > Math.max(0, t.x - t.r) + 4 || t.box[1] > Math.max(0, t.y - t.r) + 4), 'a plate moved off its first corner');
  // U6: of the corners no name takes, the one over the fewest marks (the Pale Regent's plate hid a ruin)
  const mark = (o) => [o.x - o.icon - 1, o.y - o.icon - 1, o.x + o.icon + 1, o.y + o.icon + 1];
  const under = (mm, b) => mm.isles.filter((o) => over(b, mark(o))).length;
  let weighed = 0;
  for (const [zoom, dx, dy] of [[2, 0, 0], [2, -20, 10], [3, -30, 20], [1, 0, 0]]) {
    const mm = M.chartModel(word(), at(zoom, dx, dy), W, H);
    for (const t of mm.haunts.filter((n) => n.inside)) {
      const pw = t.box[2] - t.box[0];
      const vx0 = Math.max(t.x - t.r, 0), vy0 = Math.max(t.y - t.r, 0), vx1 = Math.min(t.x + t.r, W), vy1 = Math.min(t.y + t.r, H);
      const corners = [[vx0 + 4, vy0 + 4], [vx1 - 4 - pw, vy0 + 4], [vx0 + 4, vy1 - 38], [vx1 - 4 - pw, vy1 - 38]].map(([x0, y0]) => [x0, y0, x0 + pw, y0 + 34]);
      const names = mm.isles.filter((i) => i.label && i.kind === 'port').map((i) => i.box);
      const clear = corners.filter((b) => !names.some((n) => over(b, n)) && !mm.haunts.some((o) => o !== t && o.box && mm.haunts.indexOf(o) < mm.haunts.indexOf(t) && over(b, o.box)));
      if (clear.length < 2) continue;
      weighed++;
      assert.equal(under(mm, t.box), Math.min(...clear.map((b) => under(mm, b))), `${t.name} at zoom ${zoom}: the clear corner over the fewest marks`);
    }
  }
  assert.ok(weighed >= 2, `corners weighed (${weighed})`);
  const night = M.chartModel(word({ legends: [{ id: 'lantern', name: 'The Lantern-Eater', trait: 'night', sails: true }] }), { cx: h.px - 300, cy: h.py, zoom: 0 }, W, H);
  assert.equal(night.haunts[0]?.sub, 'Territory by night');
  // x1: her name alone over her square - or none, where a port's name stands
  const far = M.chartModel(word(), at(0, -40), W, H);
  assert.ok(far.haunts.length >= 2 && far.haunts.every((t) => !t.inside));
  const ports = far.isles.filter((i) => i.kind === 'port' && i.label);
  for (const t of far.haunts) if (t.box) assert.ok(t.at[1] < t.y - t.r && !ports.some((p) => over(p.box, t.box)), `${t.name}: over her square, clear of the ports' names`);
  assert.ok(far.haunts.some((t) => !t.box && !t.at), 'a far haunt\'s name gave way');
});

test('ETHER-CHART2 the ship ringed on the canvas, and off it a pointer at the edge saying how far from the chart\'s middle - its words (AUDIT ETHER-CHART2 U7) inward, above, below or further in, clear of the names lettered where a spot is (mutants: the pointer, the inset, the words\' spot) - PIN MOVED (AUDIT ETHER-CHART2 U2: the Veil\'s name is the ruler\'s)', () => {
  assert.equal(M.EDGE_INSET, 26);
  assert.deepEqual(M.edgePointer(2000, 300, 800, 600), { x: 774, y: 300, a: 0 });
  const up = M.edgePointer(400, -900, 800, 600);
  assert.ok(Math.abs(up.y - 26) < 1e-9 && Math.abs(up.x - 400) < 1e-9 && Math.abs(up.a + Math.PI / 2) < 1e-9);
  const on = M.chartModel(word(), at(2), W, H);
  assert.equal(on.ship.on, true); assert.equal(on.ship.edge, null); assert.equal(on.ship.label, null);
  const v = at(2, -160, -30);
  const off = M.chartModel(word(), v, W, H);
  assert.equal(off.ship.on, false);
  assert.deepEqual(off.ship.edge, M.edgePointer(off.ship.x, off.ship.y, W, H));
  assert.equal(off.ship.way, M.wayWords({ px: v.cx, py: v.cy }, { px: h.px - 17.5, py: h.py + 3.5 }));
  assert.match(off.ship.way, /^\d+ leagues east/);
  assert.equal(off.ship.label.words, `Your ship - ${off.ship.way}`);
  // its words clear of every name where one of its spots is; inside the canvas always
  let moved = 0, seen = 0;
  for (const [zoom, dx, dy] of [[2, -160, -30], [1, -300, 0], [0, -700, 0], [0, -600, 20], [2, 200, 40], [1, 0, -200], [3, -80, 0], [3, 0, 60], [1, -280, 40], [0, -660, 0], [0, -640, -100]]) {
    const mm = M.chartModel(word({ legends: [] }), at(zoom, dx, dy), W, H);
    if (mm.ship.on) continue;
    seen++;
    const l = mm.ship.label, names = mm.isles.filter((i) => i.label).map((i) => i.box);
    assert.ok(l.box[0] >= 0 && l.box[2] <= W && l.box[1] >= 0 && l.box[3] <= H, 'on the canvas');
    const e = mm.ship.edge, tw = l.box[2] - l.box[0] - 12;
    const first = Math.max(M.CHART_MARGIN, Math.min(W - tw - M.CHART_MARGIN, e.x - Math.cos(e.a) * 28 - tw / 2));
    if (Math.abs(l.x - first) > 1e-6 || Math.abs(l.y - Math.max(M.CHART_MARGIN + 9, Math.min(H - M.CHART_MARGIN - 9, e.y - Math.sin(e.a) * 28))) > 1e-6) { moved++; assert.ok(!names.some((n) => over(n, l.box)), 'moved: to a clear spot'); }
  }
  assert.ok(seen >= 4);
  assert.ok(moved >= 1, `a pointer's words moved off a name (${moved} of ${seen})`);
});

test('ETHER-CHART2 the isle named: ringed, its card its name and its kind and way from the ship; none for an isle off the canvas; the window\'s line held, the hover cleared, the zoom\'s ends and the buttons named (mutants: the pick, the line, the ends)', () => {
  const m = M.chartModel(word(), at(2), W, H, { pick: h.key });
  // PIN MOVED (ISLE-TRADE, 2026-10-17): a port's card names the good of the Bay its exchange makes - Veilhaven's spice
  assert.deepEqual([m.pick.title, m.pick.words], ['Veilhaven', `A port - makes spices - ${M.wayWords({ px: h.px - 17.5, py: h.py + 3.5 }, h)}`]);
  assert.equal(m.pick.x, m.isles.find((i) => i.key === h.key).x);
  assert.equal(M.chartModel(word(), at(2, -400), W, H, { pick: h.key }).pick, null, 'off the canvas');
  assert.equal(M.chartModel(word(), at(2), W, H).pick, null);
  // PIN MOVED (AUDIT ETHER-CHART2 U8): the line held by the sheet - one line, its height kept, cut short with an ellipsis
  assert.match(src, /const noteLine = el\('p', 'dfnaval-note dfchart-note'\);/);
  assert.match(M.ETHER_CHART_CSS, /\.dfchart-note \{ min-height: 1\.25em; line-height: 1\.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; \}/);
  assert.match(src, /const named = isle\?\.key \?\? null;\n\s+if \(named !== pick\) \{ pick = named; draw\(\); \}/);
  assert.match(src, /canvas\.addEventListener\('pointerleave', \(e\) => \{ if \(e\.pointerType === 'mouse' && !downs\.size && pick\) \{ pick = null; noteLine\.textContent = ''; draw\(\); \} \}\);/);
  assert.match(src, /zoomOut\.disabled = view\.zoom === 0;\n\s+zoomIn\.disabled = view\.zoom === CHART_ZOOMS\.length - 1;/);
  // PIN MOVED (L10N4, at the merge of main): the presses' names through the text core, their English as it was
  assert.match(src, /zoomOut\.setAttribute\('aria-label', t\('sea\.chart\.zoomOut', 'Zoom out'\)\); zoomIn\.setAttribute\('aria-label', t\('sea\.chart\.zoomIn', 'Zoom in'\)\); shipBtn\.setAttribute\('aria-label', t\('sea\.chart\.findShip', 'Find your ship'\)\);/);
  assert.match(src, /close\.style\.flex = '0 0 auto';/);
});
