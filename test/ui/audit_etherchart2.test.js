// AUDIT ETHER-CHART2 (2026-10-12, the owner: "Audit and ensure absolute perfection and detail";
// bible/01-Overview/audits/Audit-Ether-Chart2.md) - the chart of the Eltheric Ocean read by cold lanes on frozen snapshots and
// rendered in Chromium (tools/etherChartProbe.mjs). These pins hold what the audit fixed that the chart's own suite
// (test/ui/etherchart2.test.js, its moved pins) does not: the window's room, the world's edge, the scale in the key, the
// face that lands late, the room watched, the card. tools/mutants/audit_etherchart2.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from '../../src/ui/etherChartWindow.js';
import * as ES from '../../src/world/ethericSea.js';

const src = readFileSync(new URL('../../src/ui/etherChartWindow.js', import.meta.url), 'utf8');
const over = (p, q) => p[0] < q[2] && q[0] < p[2] && p[1] < q[3] && q[1] < p[3];
const h = ES.veilhaven();
const charted = [...new Set([h.key, ...ES.islesNear(h.px - 40, h.py, 70).map((i) => i.key), ...ES.islesNear(Math.round(ES.VEIL_X - 30 * ES.LEAGUE_PX), h.py, 40).map((i) => i.key)])];
const word = (o = {}) => ({ px: h.px - 18, py: h.py + 3, yaw: 0, charted, legends: [], stats: {}, ...o });
const W = 1064, H = 550;
const at = (zoom, dx = 0, dy = 0) => ({ cx: h.px - 17.5 + dx, cy: h.py + 3.5 + dy, zoom });
/** A context that records what it is asked: [name, ...args] for a call, ['=', name, value] for a set. */
function stubContext() {
  const log = [];
  return /** @type {any} */ (new Proxy({}, {
    get(_, k) {
      if (k === 'log') return log;
      if (k === 'measureText') return (t) => ({ width: String(t).length * 7 });
      if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
      return (...a) => { log.push([k, ...a]); };
    },
    set(_, k, v) { log.push(['=', k, v]); return true; },
  }));
}

test('AUDIT ETHER-CHART2 U1: the window as tall as the screen allows and the chart in the room it leaves - a fixed 64vh put the key, the zoom and Ship under the fold on a phone held sideways; the hint set down where the height is short; the sheet injected once (mutants: the height, the room, the hint)', () => {
  const css = M.ETHER_CHART_CSS;
  assert.match(css, /\.dfchart-win \{ width: min\(96vw, 1100px\); max-width: 96vw; height: min\(92vh, 900px\); \}/);
  assert.match(css, /\.dfchart-chart \{ display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0;/);
  assert.match(css, /\.dfchart-stage \{ position: relative; flex: 1 1 auto; min-height: 120px; \}/);
  assert.match(css, /\.dfchart-map \{ position: absolute; inset: 0; display: block; width: 100%; height: 100%;/);
  assert.match(css, /@media \(max-height: 520px\) \{\n {2}\.dfchart-hint \{ display: none; \}/);
  assert.match(css, new RegExp(`\\.dfchart-ruler \\{ display: block; width: 100%; height: ${M.RULER_H}px; flex: 0 0 auto; \\}`));
  assert.ok(!/min\(64vh/.test(src), 'no fixed height of the screen\'s');
  assert.match(src, /const win = el\('div', 'dfnaval-win dfchart-win'\);/);
  assert.match(src, /chart\.append\(ruler, stage\);/);
  assert.match(src, /body\.append\(chart, foot, hint\);/);
  // the sheet once a document
  const added = [];
  const doc = { getElementById: (id) => added.find((n) => n.id === id) ?? null, createElement: () => ({ id: '', textContent: '' }), head: { append: (n) => added.push(n) } };
  M.injectEtherChartStyle(/** @type {any} */ (doc)); M.injectEtherChartStyle(/** @type {any} */ (doc));
  assert.equal(added.length, 1);
  assert.equal(added[0].id, M.ETHER_CHART_STYLE_ID);
  assert.equal(added[0].textContent, css);
  assert.match(src, /injectNavalKit\(document\);\n {2}injectEtherChartStyle\(\);/);
});

test('AUDIT ETHER-CHART2 U2: the depth ruler drawn - each water\'s tone, the world\'s edge hatched, the Veil\'s violet, a bound between each two, the grid\'s ticks at its foot and the ship\'s caret where she is; painted every draw over the chart (mutants: the caret, the bounds)', () => {
  const m = M.chartModel(word(), { cx: ES.ETHER_BOX.x0 + 40, cy: h.py, zoom: 1 }, W, H);
  assert.deepEqual(m.ruler.map((s) => s.id), ['edge', 'abyss']);
  const g = stubContext();
  M.paintRuler(g, M.chartModel(word(), at(2), W, H), W);
  const mm = M.chartModel(word(), at(2), W, H);
  const caret = g.log.findIndex((c) => c[0] === 'moveTo' && c[1] === Math.round(mm.ship.x) && c[2] === M.RULER_H - 1);
  assert.ok(caret > 0, 'the ship\'s caret');
  for (const seg of mm.ruler.filter((s) => s.x0 > 0)) assert.ok(g.log.some((c) => c[0] === 'moveTo' && c[1] === Math.round(seg.x0) + 0.5 && c[2] === 0), `the bound at ${seg.id}'s west edge`);
  for (const x of mm.grid.xs) assert.ok(g.log.some((c) => c[0] === 'moveTo' && c[1] === Math.round(x) + 0.5 && c[2] === M.RULER_H - 4), 'a grid tick');
  const off = stubContext();
  const away = M.chartModel(word(), at(2, -400), W, H);
  assert.equal(away.ship.on, false);
  M.paintRuler(off, away, W);
  assert.ok(!off.log.some((c) => c[0] === 'moveTo' && c[2] === M.RULER_H - 1), 'no caret for a ship off the chart');
  const edge = stubContext();
  M.paintRuler(edge, m, W);
  assert.ok(edge.log.filter((c) => c[0] === 'lineTo').length > 20, 'the world\'s edge hatched');
  assert.match(src, /if \(rg\) \{ rg\.setTransform\(dpr, 0, 0, dpr, 0, 0\); paintRuler\(rg, model, w\); \}/);
});

test('AUDIT ETHER-CHART2 U3: the world\'s edge drawn where the sea\'s box meets the void - the Abyss\'s water and the void were one black; no line where the box fills the chart (mutants: the line)', () => {
  assert.equal(M.EDGE_LINE, 'rgba(170,195,230,0.55)');
  const corner = M.chartModel(word(), { cx: ES.ETHER_BOX.x0, cy: ES.ETHER_BOX.y0, zoom: 2 }, W, H);
  const g = stubContext();
  M.paintChart(g, corner, W, H);
  const set = g.log.findIndex((c) => c[0] === '=' && c[1] === 'strokeStyle' && c[2] === M.EDGE_LINE);
  assert.ok(set > 0, 'the edge\'s ink');
  const [bx0, by0] = corner.edge;
  assert.ok(g.log.slice(set).some((c) => c[0] === 'moveTo' && c[1] === bx0) && g.log.slice(set).some((c) => c[0] === 'lineTo' && c[2] === by0), 'the west edge and the north');
  const open = stubContext();
  M.paintChart(open, M.chartModel(word(), at(2), W, H), W, H);
  assert.ok(!open.log.some((c) => c[0] === '=' && c[2] === M.EDGE_LINE), 'none in the open sea');
});

test('AUDIT ETHER-CHART2 U4/U5: the scale in the key, off the map (its plate hid isles and port names ran over it), its bar its length at the zoom; redrawn when its words change - every zoom\'s bar is near SCALE_MAX_PX, so a key on its length alone said "5 leagues" at x1 (mutants: the key, the words)', () => {
  const m = M.chartModel(word(), at(2), W, H);
  const g = stubContext();
  M.paintChart(g, m, W, H);
  assert.ok(!g.log.some((c) => (c[0] === 'fillText' || c[0] === 'strokeText') && /leagues?$/.test(String(c[1])) && !/^Your ship/.test(String(c[1]))), 'no scale on the map');
  const s = stubContext();
  M.paintScale(s, m.scale, 10);
  assert.ok(s.log.some((c) => c[0] === 'lineTo' && Math.abs(c[1] - (m.scale.px + 1.5)) < 1e-9), 'the bar its length');
  assert.match(src, /key\.append\(scaleItem\);/);
  assert.match(src, /const at = `\$\{sc\.words\}:\$\{sc\.px\}:\$\{dpr\}`;/);
  assert.match(src, /scaleWords\.textContent = sc\.words;/);
  // every zoom's bar is within a few pixels of the others - the words are what tell them apart
  const lens = M.CHART_ZOOMS.map((_, z) => M.scaleBar(z).px);
  assert.ok(Math.max(...lens) - Math.min(...lens) < 25, 'the bars alike');
  assert.equal(new Set(M.CHART_ZOOMS.map((_, z) => M.scaleBar(z).words)).size, M.CHART_ZOOMS.length, 'the words each zoom\'s own');
});

test('AUDIT ETHER-CHART2 U9: the named isle\'s card - above it to the east, then the west, then below - never over the isle it names, inside the chart, clear of every name where a spot is (mutants: the card\'s spot, the isle)', () => {
  let moved = 0, seen = 0;
  for (const [zoom, dx, dy] of [[2, 0, 0], [3, -20, 0], [1, 0, 0], [3, -40, 10], [4, -10, 0], [2, -30, -20]]) {
    for (const i of M.chartModel(word(), at(zoom, dx, dy), W, H).isles.filter((n) => n.x > 0 && n.x < W && n.y > 0 && n.y < H)) {
      const m = M.chartModel(word(), at(zoom, dx, dy), W, H, { pick: i.key });
      const c = m.pick.box, self = [i.x - i.r - 6, i.y - i.r - 6, i.x + i.r + 6, i.y + i.r + 6];
      seen++;
      assert.ok(c[0] >= 0 && c[1] >= 0 && c[2] <= W && c[3] <= H, 'inside the chart');
      const named = m.isles.filter((n) => n.label).map((n) => n.box);
      const ring = m.ship.on ? [[m.ship.x - 16, m.ship.y - 16, m.ship.x + 16, m.ship.y + 16]] : [];
      const o = i.r + 10, cw = c[2] - c[0], ch = 36;
      const spot = (x, y) => { const x0 = Math.max(4, Math.min(W - cw - 4, x)), y0 = Math.max(4, Math.min(H - ch - 4, y)); return [x0, y0, x0 + cw, y0 + ch]; };
      const spots = [spot(i.x + o, i.y - o - ch), spot(i.x - o - cw, i.y - o - ch), spot(i.x + o, i.y + o), spot(i.x - o - cw, i.y + o)].filter((b) => !over(b, self));
      if (spots.length) assert.ok(!over(c, self), `${i.name}: its card over it`);
      const clear = spots.find((b) => ![...named, ...m.haunts.filter((t) => t.box).map((t) => t.box), ...ring].some((p) => over(b, p)));
      if (clear) assert.ok(c.every((v, n) => Math.abs(v - clear[n]) < 1e-6), `${i.name}: the first clear spot`);
      if (clear && clear !== spots[0]) moved++;
    }
  }
  assert.ok(seen > 100 && moved > 5, `cards moved off names (${moved} of ${seen})`);
});

test('AUDIT ETHER-CHART2 U10/U11: the chart painted again whenever a face lands while it is open - a window opened before the fonts\' stylesheet came kept the fallback face (load and ready answered at once, with nothing to load) - and whenever its room changes; the key\'s words set before the room is measured; both let go at the close (mutants: the landing, the watch, the order)', () => {
  assert.match(src, /fonts\?\.addEventListener\?\.\('loadingdone', landed\);/);
  assert.match(src, /fonts\?\.removeEventListener\?\.\('loadingdone', landed\);/);
  assert.match(src, /const roomWatch = typeof RO === 'function' \? new RO\(\(\) => draw\(\)\) : null;\n {2}roomWatch\?\.observe\(stage\);/);
  assert.match(src, /roomWatch\?\.disconnect\(\);/);
  const draw = src.slice(src.indexOf('  function draw() {'), src.indexOf('  /** What lies under a canvas point'));
  assert.ok(draw.indexOf('showScale(scaleBar(view.zoom));') > 0 && draw.indexOf('showScale(scaleBar(view.zoom));') < draw.indexOf('const [w, h] = size();'), 'the key\'s words before the room is measured');
  assert.equal((draw.match(/showScale\(/g) ?? []).length, 1, 'once a draw');
  // both let go in the unmount, and only there
  const unmount = src.slice(src.indexOf('    unmount() {'));
  assert.ok(unmount.includes("removeEventListener?.('loadingdone', landed)") && unmount.includes('roomWatch?.disconnect()'));
});

// ── lane T: the painter watched, the measure held to the paint, the layout's laws ────────────────────────────────────
const LEGENDS = [{ id: 'queen', name: 'The Drowned Queen', trait: 'mends', sails: false }, { id: 'wake', name: 'Sorrow\'s Wake', trait: 'swift', sails: true }, { id: 'hunger', name: 'Ninefold Hunger', trait: 'boarders', sails: true }];
/** A context that keeps its state (save and restore too) and records each call with the state it was made in; its
 *  `measureText` is `f(text, font, letterSpacing)`. */
function stateStub(f = (t) => t.length * 7) {
  const log = [];
  let st = { font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', letterSpacing: '0px', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter' };
  const stack = [];
  return /** @type {any} */ (new Proxy({}, {
    get(_, k) {
      if (k === 'log') return log;
      if (k === 'measureText') return (t) => ({ width: f(String(t), st.font, st.letterSpacing) });
      if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (k === 'save') return () => { stack.push({ ...st }); log.push(['save', { ...st }]); };
      if (k === 'restore') return () => { st = stack.pop() ?? st; log.push(['restore', { ...st }]); };
      if (typeof k === 'string' && k in st) return st[k];
      return (...a) => { log.push([k, ...a, { ...st }]); };
    },
    set(_, k, v) { st[k] = v; log.push(['=', k, v]); return true; },
  }));
}
/** A width that tells the faces, the case and the tracking apart. */
const faceWidth = (t, font, spacing) => t.length * (font === M.CHART_FONT.name ? 7 : font === M.CHART_FONT.small ? 6 : 50) + (t.match(/[A-Z]/g) ?? []).length + (spacing === M.CHART_TRACKING ? t.length * 0.5 : 0);
const measure = (t, font) => faceWidth(t, font, M.CHART_TRACKING);   // the window's: the face asked, FONT3's tracking on
const calls = (g, name) => g.log.filter((c) => c[0] === name);
const near = (a, b) => Math.abs(a - b) < 1e-6;

test('AUDIT ETHER-CHART2 T1: a haunt\'s plate never stands over a name - with no corner of her square clear she is named alone over it, or not (the plate went to the first corner over Port Thalirel\'s name on a phone) (mutants: the fallback)', () => {
  let named = 0, alone = 0;
  for (const zoom of [0, 1, 2, 3]) for (let dx = -110; dx <= 20; dx += 10) for (let dy = -40; dy <= 40; dy += 20) {
    const m = M.chartModel(word({ legends: LEGENDS }), at(zoom, dx, dy), 346, 420);
    const names = m.isles.filter((i) => i.label).map((i) => i.box);
    for (const t of m.haunts) {
      if (!t.box) continue;
      named++;
      if (!t.inside) alone++;
      assert.ok(!names.some((b) => over(b, t.box)), `${t.name} at zoom ${zoom} (${dx}, ${dy}): over a name`);
    }
  }
  const thalirel = M.chartModel(word({ legends: LEGENDS }), at(1, -70, -20), 346, 420);
  const wake = thalirel.haunts.find((t) => t.name === 'Sorrow\'s Wake');
  assert.ok(!thalirel.isles.some((i) => i.label && wake.box && over(i.box, wake.box)), 'the view it was found in');
  assert.ok(named > 100 && alone > 10, `named in view (${named}), alone over the square (${alone})`);
});

test('AUDIT ETHER-CHART2 T2: the painter draws what the model says - each band\'s water its tone, each mark its kind\'s colour in ink, the lands, Veilhaven\'s ring, the ship ringed on her heading, the bearing, the named isle\'s ring and card, a sailing haunt washed red and a sunk one hatched and dashed, every name at its own box, the world\'s edge hatched, the pointer off the chart (mutants: each)', () => {
  const v = at(2, 0, 0);
  const m = M.chartModel(word({ legends: LEGENDS, yaw: 0.7 }), v, W, H, { pick: h.key });
  const g = stateStub();
  M.paintChart(g, m, W, H);
  for (const d of m.depths) assert.ok(calls(g, 'fillRect').some((c) => c[1] === d.x0 && c[2] === 0 && near(c[3], d.x1 - d.x0) && c.at(-1).fillStyle === M.DEPTH_TONES[d.id]), `${d.id}'s water`);
  // each mark: its path at the isle, filled in its kind's colour (a rock's cross stroked in it), outlined in ink
  for (const i of m.isles) {
    const start = g.log.findIndex((c) => (c[0] === 'arc' && c[1] === i.x && c[2] === i.y && c[3] === i.icon) || (c[0] === 'moveTo' && near(c[1], i.kind === 'rock' ? i.x - i.icon : i.x) && near(c[2], i.kind === 'rock' ? i.y : i.y - i.icon * 1.3)));
    assert.ok(start > 0, `${i.name}: its mark`);
    const after = g.log.slice(start);
    if (i.kind === 'rock') {
      const strokes = after.filter((c) => c[0] === 'stroke').slice(0, 2);
      assert.deepEqual(strokes.map((c) => c.at(-1).strokeStyle), ['#050608', M.KIND_COLOURS.rock], `${i.name}: ink, then grey`);
    } else {
      assert.equal(after.find((c) => c[0] === 'fill').at(-1).fillStyle, M.KIND_COLOURS[i.kind], `${i.name}: its kind's colour`);
      assert.equal(after.find((c) => c[0] === 'stroke').at(-1).strokeStyle, '#050608', `${i.name}: in ink`);
    }
    if (i.land >= i.icon * 1.6) assert.ok(calls(g, 'arc').some((c) => c[1] === i.x && c[2] === i.y && c[3] === i.land), `${i.name}: its land`);
  }
  assert.ok(m.isles.some((i) => i.land >= i.icon * 1.6), 'lands in view');
  const home = m.isles.find((i) => i.home);
  assert.ok(calls(g, 'arc').some((c) => c[1] === home.x && c[2] === home.y && c[3] === home.icon + 3.5 && c.at(-1).lineWidth === 1.5), 'Veilhaven ringed');
  const s = m.ship, p = m.pick;
  assert.ok(calls(g, 'arc').some((c) => c[1] === s.x && c[2] === s.y && c[3] === 14), 'the ship\'s ring');
  const tr = g.log.findIndex((c) => c[0] === 'translate' && c[1] === s.x && c[2] === s.y);
  assert.ok(tr > 0 && g.log[tr + 1][0] === 'rotate' && g.log[tr + 1][1] === 0.7, 'on her heading');
  const bear = g.log.findIndex((c) => c[0] === 'moveTo' && c[1] === s.x && c[2] === s.y);
  assert.ok(bear > 0 && g.log[bear + 1][0] === 'lineTo' && g.log[bear + 1][1] === p.x && g.log[bear + 1][2] === p.y, 'the bearing');
  assert.ok(calls(g, 'arc').some((c) => c[1] === p.x && c[2] === p.y && c[3] === p.r + 5), 'the named isle ringed');
  assert.ok(calls(g, 'fillText').some((c) => c[1] === p.title && c[2] === Math.round(p.box[0] + 8) && c[3] === Math.round(p.box[1] + 11)), 'its card');
  const wake = m.haunts.find((t) => t.sails), queen = m.haunts.find((t) => !t.sails);
  assert.ok(calls(g, 'fillRect').some((c) => c[1] === wake.x - wake.r && c.at(-1).fillStyle === 'rgba(224,83,63,0.16)'), 'a sailing haunt washed red');
  assert.ok(calls(g, 'fillRect').some((c) => c[1] === queen.x - queen.r && c.at(-1).fillStyle === 'rgba(150,150,175,0.06)'), 'a sunk one washed grey');
  const dash = g.log.findIndex((c) => c[0] === 'setLineDash' && c[1][0] === 5 && c[1][1] === 4);
  assert.ok(dash > 0 && g.log.slice(dash).find((c) => c[0] === 'strokeRect')[1] === queen.x - queen.r, 'and dashed');
  for (const i of m.isles.filter((n) => n.label)) {
    const t = calls(g, 'fillText').find((c) => c[1] === M.capFirst(i.name));
    assert.ok(t && t[2] === Math.round(i.box[0]) && t[3] === Math.round((i.box[1] + i.box[3]) / 2) && t.at(-1).textAlign === 'left' && t.at(-1).textBaseline === 'middle' && t.at(-1).font === M.CHART_FONT.name, `${i.name}: at its own box`);
  }
  // the world's edge
  const corner = stateStub();
  M.paintChart(corner, M.chartModel(word(), { cx: ES.ETHER_BOX.x0, cy: ES.ETHER_BOX.y0, zoom: 2 }, W, H), W, H);
  assert.ok(calls(corner, 'fillRect').some((c) => c[1] === 0 && c[2] === 0 && c[3] === W && c[4] === H && c.at(-1).fillStyle === M.VOID_TONE), 'the void');
  assert.ok(calls(corner, 'lineTo').length > 50, 'hatched');
  // the ship off the chart: the pointer on its way, its words at its spot
  const off = M.chartModel(word(), at(2, -160, -30), W, H);
  const go = stateStub();
  M.paintChart(go, off, W, H);
  const e = off.ship.edge, l = off.ship.label;
  const pt = go.log.findIndex((c) => c[0] === 'translate' && c[1] === e.x && c[2] === e.y);
  assert.ok(pt > 0 && go.log[pt + 1][0] === 'rotate' && go.log[pt + 1][1] === e.a, 'the pointer on her way');
  assert.ok(calls(go, 'fillText').some((c) => c[1] === l.words && c[2] === Math.round(l.x) && c[3] === Math.round(l.y)), 'its words');
  assert.ok(!calls(go, 'arc').some((c) => c[3] === 14), 'no ring for a ship off the chart');
});

test('AUDIT ETHER-CHART2 T2: the key drawn by the chart\'s own painters - each kind\'s mark as the chart draws it, the ship, a sailing haunt and a sunk one - beside its words (mutants: the key)', () => {
  assert.deepEqual(M.CHART_KEY.map((r) => [...r]), [['port', 'Port'], ['ruin', 'Ruin'], ['wild', 'Wild isle'], ['rock', 'Bare rock'], ['ship', 'Your ship'], ['haunt', 'A legend\'s haunt'], ['sunk', 'A legend sunk']]);
  const shape = (paint) => { const g = stateStub(); paint(g); return g.log.filter((c) => ['arc', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke', 'strokeRect', 'fillRect', 'rotate'].includes(c[0])).map((c) => `${c[0]}:${c.at(-1).fillStyle}:${c.at(-1).strokeStyle}`).join(' '); };
  for (const kind of ['port', 'ruin', 'wild', 'rock']) assert.equal(shape((g) => M.paintKey(g, kind, 9, 9)), shape((g) => M.paintMark(g, kind, 9, 9, kind === 'port' ? 4.5 : 4)), `${kind}: the chart's own mark`);
  const ship = stateStub(); M.paintKey(ship, 'ship', 9, 9);
  assert.ok(calls(ship, 'arc').some((c) => near(c[3], 14 * 0.55)) && calls(ship, 'rotate').some((c) => c[1] === Math.PI / 4), 'the ship');
  const sails = stateStub(); M.paintKey(sails, 'haunt', 9, 9);
  const sunk = stateStub(); M.paintKey(sunk, 'sunk', 9, 9);
  assert.equal(calls(sails, 'fillRect')[0].at(-1).fillStyle, 'rgba(224,83,63,0.16)');
  assert.equal(calls(sunk, 'fillRect')[0].at(-1).fillStyle, 'rgba(150,150,175,0.06)');
  assert.ok(calls(sunk, 'setLineDash').some((c) => c[1][0] === 5) && !calls(sails, 'setLineDash').some((c) => c[1][0] === 5), 'the sunk one dashed');
});

test('AUDIT ETHER-CHART2 T3: the model measures in the face the painter letters in - each name, haunt plate, card, pointer and ruler word as wide as the face, the case and the tracking in which it is drawn (mutants: the faces, the case, the tracking)', () => {
  assert.match(src, /const measure = \(t, font\) => \{ if \(!g\) return t\.length \* LABEL_CHAR_PX; g\.font = font; track\(g, CHART_TRACKING\); return g\.measureText\(t\)\.width; \};/);
  const drawnWidth = (c) => faceWidth(String(c[1]), c.at(-1).font, c.at(-1).letterSpacing);
  for (const [zoom, dx, dy, pick] of [[3, 0, 0, h.key], [2, 0, 0, null], [3, -40, 10, null], [2, -160, -30, null]]) {
    const m = M.chartModel(word({ legends: LEGENDS }), at(zoom, dx, dy), W, H, { measure, pick });
    const g = stateStub(faceWidth);
    M.paintChart(g, m, W, H);
    const text = (t) => calls(g, 'fillText').find((c) => c[1] === t);
    for (const i of m.isles.filter((n) => n.label)) assert.ok(near(drawnWidth(text(M.capFirst(i.name))), i.box[2] - i.box[0]), `${i.name}: its box its width`);
    for (const t of m.haunts.filter((n) => n.inside)) assert.ok(near(Math.max(drawnWidth(text(t.name)), drawnWidth(text(t.sub))) + 12, t.box[2] - t.box[0]), `${t.name}: her plate`);
    for (const t of m.haunts.filter((n) => n.at && !n.inside)) assert.ok(near(drawnWidth(text(t.name)) + 6, t.box[2] - t.box[0]), `${t.name}: her name alone`);
    if (m.pick) assert.ok(near(Math.max(drawnWidth(text(m.pick.title)), drawnWidth(text(m.pick.words))) + 16, m.pick.box[2] - m.pick.box[0]), 'the card');
    if (m.ship.label) assert.ok(near(drawnWidth(text(m.ship.label.words)) + 12, m.ship.label.box[2] - m.ship.label.box[0]), 'the pointer\'s words');
    const r = stateStub(faceWidth);
    M.paintRuler(r, m, W);
    for (const seg of m.ruler.filter((n) => n.words)) {
      const c = calls(r, 'fillText').find((n) => n[1] === seg.words);
      assert.equal(c.at(-1).font, M.CHART_FONT.small);
      assert.ok(drawnWidth(c) + 12 <= seg.x1 - seg.x0 + 1e-9, `${seg.id}: drawn inside its water`);
    }
  }
});

test('AUDIT ETHER-CHART2 T4/T8: every lettered name\'s box is its name\'s width, centred on its isle\'s row, beside its isle on one side or the other; every mark its zoom\'s size (mutants: the boxes, the size)', () => {
  for (let zoom = 0; zoom < M.CHART_ZOOMS.length; zoom++) {
    for (const [dx, dy] of [[0, 0], [-40, 10], [-20, -15]]) {
      const m = M.chartModel(word(), at(zoom, dx, dy), W, H);
      for (const i of m.isles) {
        assert.equal(i.icon, M.ICON_PX[zoom] + (i.kind === 'port' ? 1 : 0), `${i.name}: its mark at zoom ${zoom}`);
        if (!i.label) continue;
        const [x0, y0, x1, y1] = i.box;
        assert.ok(near(x1 - x0, M.capFirst(i.name).length * M.LABEL_CHAR_PX) && near(y0, i.y - M.LABEL_H / 2) && near(y1, i.y + M.LABEL_H / 2), `${i.name}: its width and row`);
        assert.ok(near(x0, i.x + i.r + 4) || near(x1, i.x - i.r - 4), `${i.name}: beside its isle`);
      }
    }
  }
});

test('AUDIT ETHER-CHART2 T5: a haunt named in view - her plate\'s top in the canvas where her square runs above it; her name alone below the canvas\'s margin; no haunt off the chart at all (an unfiltered one was named at the canvas\'s edge) (mutants: the floor, the filter)', () => {
  let topped = 0, floored = 0;
  for (const [zoom, dx, dy] of [[2, -160, 10], [2, -150, 10], [2, -160, 130], [1, -120, 150], [1, -120, 170], [0, -120, 180], [0, -120, 200]]) {
    const m = M.chartModel(word({ legends: LEGENDS }), at(zoom, dx, dy), W, H);
    for (const t of m.haunts) {
      if (t.inside && t.y - t.r < 0) {
        const foot = Math.min(t.y + t.r, H) - 38;
        assert.ok(t.box[1] === 4 || near(t.box[1], foot), `${t.name}: her plate at the canvas's top or her square's foot`);
        if (t.box[1] === 4) topped++;
      }
      if (t.at && !t.inside && t.y - t.r - 10 < M.CHART_MARGIN + M.LABEL_H / 2) { floored++; assert.equal(t.at[1], M.CHART_MARGIN + M.LABEL_H / 2, `${t.name}: her name inside the margin`); }
    }
  }
  assert.ok(topped >= 1 && floored >= 1, `the floors met (${topped}, ${floored})`);
  // x16 about Veilhaven: every haunt off the chart, none named
  assert.deepEqual(M.chartModel(word({ legends: LEGENDS }), at(4), W, H).haunts, []);
});

test('AUDIT ETHER-CHART2 T6: the layers in their order and each name on its preferred side - the ports\' names, the haunts\' (placed by the ports\' alone), the lesser isles\'; a side on the chart and clear of the ship\'s ring and the other marks before one that is not (mutants: the order, the ring, the chart\'s edge)', () => {
  let views = 0, offside = 0;
  for (const [zoom, dx, dy, w, hh] of [[3, 0, 0, W, H], [3, -40, 10, W, H], [2, -30, -20, W, H], [3, -60, 30, 346, 420], [2, 0, 0, 346, 420], [4, -20, 0, 346, 420], [3, -10, 30, W, H], [2, -50, -30, 346, 420], [3, -60, -40, W, H], [3, -150, -48, W, H], [0, -60, -20, W, H]]) {
    const v = at(zoom, dx, dy);
    const m = M.chartModel(word({ legends: LEGENDS }), v, w, hh);
    // the haunts placed by the ports alone: every lesser isle away, the same plates
    const ports = M.chartModel(word({ legends: LEGENDS, charted: charted.filter((k) => ES.isleByKey(k)?.kind === 'port') }), v, w, hh);
    assert.deepEqual(m.haunts.map((t) => t.box), ports.haunts.map((t) => t.box), `zoom ${zoom}: the haunts' names the ports' alone move`);
    // each name where the law puts it, given what stood before it
    const mark = (o) => [o.x - o.icon - 1, o.y - o.icon - 1, o.x + o.icon + 1, o.y + o.icon + 1];
    const ring = m.ship.on ? [[m.ship.x - 16, m.ship.y - 16, m.ship.x + 16, m.ship.y + 16]] : [];
    const portsLettered = m.isles.filter((i) => i.kind === 'port');
    const lesser = m.isles.filter((i) => i.kind !== 'port');
    const before = [];
    const place = (i) => {
      const eligible = i.kind === 'port' || zoom >= 3;
      if (!eligible) return;
      const sides = M.labelBoxes(i, M.capFirst(i.name).length * M.LABEL_CHAR_PX);
      const free = sides.filter((b) => !before.some((p) => over(b, p)));
      if (!free.length) { assert.equal(i.label, false, `${i.name}: unlettered, both sides taken`); return; }
      const port = i.kind === 'port';
      const onChart = (b) => b[0] >= 0 && b[2] <= w;
      const want = free.find((b) => onChart(b) && !ring.some((p) => over(b, p)) && !m.isles.some((o) => o !== i && (!port || o.kind === 'port') && over(b, mark(o)))) ?? free.find(onChart) ?? free[0];
      assert.ok(i.label && want.every((n, k) => near(n, i.box[k])), `${i.name}: on the side the law gives it`);
      if (free.length === 2 && (free[0][0] < 0 || free[0][2] > w) && i.box === i.box && near(i.box[0], free[1][0])) offside++;
      before.push(i.box);
    };
    for (const i of portsLettered) place(i);
    for (const t of m.haunts) if (t.box) before.push(t.box);
    if (m.ship.label) before.push(m.ship.label.box, [m.ship.edge.x - 16, m.ship.edge.y - 16, m.ship.edge.x + 16, m.ship.edge.y + 16]);   // C4
    for (const i of lesser) place(i);
    views++;
  }
  assert.ok(views === 11 && offside >= 1, `a name kept off the chart's edge (${offside})`);
  // the ship's ring: lying a pixel east of Veilhaven, her ring stands across its name's east side - it stands west
  for (const zoom of [3, 4]) {
    const m = M.chartModel(word({ px: h.px + 1, py: h.py }), { cx: h.px + 0.5, cy: h.py + 0.5, zoom }, W, H);
    const home = m.isles.find((i) => i.home), ring = [m.ship.x - 16, m.ship.y - 16, m.ship.x + 16, m.ship.y + 16];
    assert.ok(over(M.labelBoxes(home, home.box[2] - home.box[0])[0], ring) && home.box[2] <= home.x, `zoom ${zoom}: Veilhaven's name west of the ship's ring`);
  }
});

test('AUDIT ETHER-CHART2 T7/T10: the card\'s title a name opening a line, its first letter raised (X17); the window\'s presses a finger\'s 44px and their own size, the chart named for a screen reader, the key sharp on a dense screen (mutants: the title, the presses)', () => {
  const low = charted.map((k) => ES.isleByKey(k)).find((i) => /^the /.test(i.name));
  assert.ok(low, 'an isle named "the ..."');
  const m = M.chartModel(word(), { cx: low.px + 0.5, cy: low.py + 0.5, zoom: 3 }, W, H, { pick: low.key });
  assert.equal(m.pick.title, M.capFirst(low.name));
  assert.notEqual(m.pick.title, low.name);
  // PIN MOVED (ETHER-OW, test/systems/travel/ether_ow.test.js): the Overworld's door is a press of the row, a finger's 44px too
  assert.match(src, /for \(const b of \[zoomOut, zoomIn, shipBtn, overBtn\]\) \{ b\.style\.flex = '0 0 auto'; b\.style\.minWidth = '44px'; \}/);
  // PIN MOVED (ELTHERIC, test/world/eltheric.test.js): the sea's name is its one home's (world/ethericSea.js ETHER_SEA_NAME)
  // PIN MOVED (L10N4, at the merge of main): the canvas's name through the text core, the sea's name its one home's
  assert.match(src, /canvas\.setAttribute\('role', 'img'\);\n\s+canvas\.setAttribute\('aria-label', t\('sea\.chart\.canvas', 'A chart of \{sea\}: your ship, the isles you have charted, the depths, the Veil and the legends\\' haunts', \{ sea: ETHER_SEA_NAME \}\)\);/);
  assert.match(src, /c\.width = c\.height = Math\.round\(18 \* dpr0\);/);
});

// ── lane C ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT ETHER-CHART2 C4/C7/C8: the pointer\'s words laid before the lesser isles\' names, which keep off them and its arrow; a name with no side clear of everything on the chart\'s side before the cut one (Aelishaven\'s was cut to its "A"); a far haunt\'s lone name over her own square or none (it stood in open water, or in another legend\'s square) (mutants: each)', () => {
  let pointed = 0, alone = 0;
  for (const zoom of [0, 1, 2, 3]) for (let dx = -220; dx <= 60; dx += 20) for (let dy = -120; dy <= 120; dy += 40) {
    const m = M.chartModel(word({ legends: LEGENDS }), at(zoom, dx, dy), W, H);
    if (m.ship.label) {
      pointed++;
      const e = m.ship.edge, keep = [m.ship.label.box, [e.x - 16, e.y - 16, e.x + 16, e.y + 16]];
      for (const i of m.isles.filter((n) => n.label && n.kind !== 'port')) assert.ok(!keep.some((k) => over(k, i.box)), `${i.name}: under the pointer's words at zoom ${zoom} (${dx}, ${dy})`);
    }
    for (const t of m.haunts.filter((n) => n.at && !n.inside)) {
      alone++;
      assert.ok(t.box[3] <= t.y + t.r + 1e-9 && t.box[0] < t.x + t.r && t.x - t.r < t.box[2], `${t.name}: her name over her own square at zoom ${zoom} (${dx}, ${dy})`);
    }
  }
  assert.ok(pointed > 50 && alone > 20, `pointers (${pointed}), lone names (${alone})`);
  const edge = M.chartModel(word(), at(2, -150, -48), W, H);
  const aelishaven = edge.isles.find((i) => i.name === 'Aelishaven');
  assert.ok(aelishaven.x > W - 40 && aelishaven.box[0] >= 0 && aelishaven.box[2] <= W, 'on the chart\'s side');
});

test('AUDIT ETHER-CHART2 C10/C11: a port\'s name weighed against the ports\' marks alone, each mark\'s box made once (it scanned every isle for every port); the note said again of the isle named whenever the chart is repainted - as its card is (mutants: the marks, the note)', () => {
  assert.match(src, /const marks = isles\.map\(\(o\) => \(\{ o, box: mark\(o\) \}\)\), portMarks = marks\.filter\(\(k\) => k\.o\.kind === 'port'\);/);
  assert.match(src, /!\(port \? portMarks : marks\)\.some\(\(k\) => k\.o !== i && overlaps\(box, k\.box\)\)/);
  assert.match(src, /repaint: \(\) => \{ word = deps\.word\(\); const isle = pick \? isleByKey\(pick\) : null; noteLine\.textContent = isle \? isleWords\(isle, \{ px: word\.px \+ 0\.5, py: word\.py \+ 0\.5 \}\) : ''; draw\(\); \},/);
});
