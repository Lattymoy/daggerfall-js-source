// STAR6 (bible/11-Multiplayer/Starfall.md section 8): THE COMPASS AND THE MAP - the HUD's door forwards the event marks
// the host hands it to the enhanced strip (the sea serpent's and a found Hollow's had been handed since SERPENT1 and
// SD2c and dropped at drawHud, so neither ever showed; a fallen star's beside them), each at the gate's bearing law,
// hidden and never removed; and the held map's ink for a fallen star. Driven on the real drawHud and enhanced HUD over
// hudPage.mjs's page. tools/mutants/star6.json.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakePage } from '../../hudPage.mjs';
import { drawHud, compassMarkerLerp } from '../../../src/ui/hud/hud.js';
import { destroyEnhancedHud } from '../../../src/ui/enhanced/enhancedHud.js';
import { _resetForTests as resetPrefs } from '../../../src/systems/uiPrefs.js';
import { paintStarMark, paintInkOverlay } from '../../../src/ui/ink/inkMap.js';
import { STAR_VIOLET_CSS } from '../../../src/ui/starfall/starMapMark.js';

const CANVAS = { width: 1280, height: 800, clientWidth: 1280, clientHeight: 800 };
const renderer = () => ({ uploadTexture: () => 'tex', drawScreenQuad() {} });
const me = () => ({ health: 50, maxHealth: 50, magicka: 20, maxMagicka: 20, fatigue: 6400, stats: { strength: 50, endurance: 50 }, items: [], equip: { slots: {} }, activeEffects: [], spells: [] });

/** hudPage's page with the few members the enhanced HUD writes besides (fb1018f_dungeondigits.test.js's). */
function page() {
  const doc = fakePage();
  const make = doc.createElement;
  doc.createElement = (tag) => {
    const n = make(tag);
    const on = new Set();
    n.classList = { add: (...c) => c.forEach((x) => on.add(x)), remove: (...c) => c.forEach((x) => on.delete(x)), toggle: (c, v) => { const now = v ?? !on.has(c); if (now) on.add(c); else on.delete(c); return now; }, contains: (c) => on.has(c) };
    n.appendChild = (c) => { n.append(c); return c; };
    n.prepend = (...c) => n.append(...c);
    Object.defineProperty(n, 'parentNode', { get: () => n.parentElement });
    n.offsetWidth = 0;
    return n;
  };
  doc.createElementNS = (ns, tag) => doc.createElement(tag);
  doc.createTextNode = (t) => ({ textContent: String(t) });
  doc.documentElement = doc.createElement('html');
  doc.fonts = { add() {} };
  doc.win = { addEventListener() {}, removeEventListener() {} };
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className ?? '').split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) find(c, cls, out); return out; };

test('STAR6 THE COMPASS\'S DOOR: drawHud forwards the sea serpent\'s, a found Hollow\'s and a fallen star\'s marks to the enhanced strip - each at its bearing; none handed, each hidden and never removed; the star a violet four-pointed star (mutants: a forward dropped, the mark rebuilt, its shape)', () => {
  const had = { doc: globalThis.document, win: globalThis.window, loc: globalThis.location };
  resetPrefs();
  globalThis.location = { search: '?skin=enhanced' };
  const doc = page();
  globalThis.document = doc;
  globalThis.window = doc.win;
  try {
    const marks = { serpent: [0, 500], sd: [500, 0], star: [-300, 300] };
    const frame = (o) => drawHud(renderer(), CANVAS, null, me(), 0, 1 / 60, { cursorActive: false, playerXZ: [0, 0], ...o });
    frame(marks);
    const root = doc.body.children.find((n) => n.className === 'hud');
    assert.ok(root, 'the enhanced HUD stands');
    const nodes = {};
    for (const [k, cls] of [['serpent', 'hud-serpent'], ['sd', 'hud-sd'], ['star', 'hud-star']]) {
      const found = find(root, cls);
      assert.equal(found.length, 1, `${k}: one mark`);
      nodes[k] = found[0];
      assert.notEqual(nodes[k].style.display, 'none', `${k}: shown`);
      assert.equal(nodes[k].style.left, `${(Math.min(1, Math.max(0, compassMarkerLerp(marks[k], [0, 0], 0))) * 100).toFixed(1)}%`, `${k}: at its bearing`);
    }
    assert.ok(nodes.star.style.cssText.includes(`background:${STAR_VIOLET_CSS}`), 'the star\'s violet');
    assert.ok(nodes.star.style.cssText.includes('clip-path:polygon(50% 0,62% 38%,100% 50%'), 'four-pointed');
    frame({});
    for (const k of Object.keys(nodes)) assert.equal(nodes[k].style.display, 'none', `${k}: none handed, hidden`);
    frame(marks);
    for (const [k, cls] of [['serpent', 'hud-serpent'], ['sd', 'hud-sd'], ['star', 'hud-star']]) {
      assert.equal(find(root, cls)[0], nodes[k], `${k}: the same node`);
      assert.equal(nodes[k].style.display, '', `${k}: shown again`);
    }
  } finally {
    destroyEnhancedHud();
    resetPrefs();
    for (const [k, v] of [['document', had.doc], ['window', had.win], ['location', had.loc]]) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
  }
});

/** A canvas context that records what is drawn. */
function recorder() {
  const ops = [];
  const ctx = new Proxy({ ops }, {
    get: (o, k) => (k in o ? o[k] : (...a) => { ops.push([k, ...a]); }),
    set: (o, k, v) => { ops.push([`=${String(k)}`, v]); return true; },
  });
  return ctx;
}

test('STAR6 THE HELD MAP\'S INK: a fallen star\'s mark a four-pointed star filled violet on its pixel, inked round in the pen\'s line, a ring breathing about it; the sheet paints every star it is handed (mutants: the fill, the ring, the overlay\'s loop)', () => {
  const view = { x0: 0, y0: 0, scale: 2, ox: 0, oy: 0, w: 2000, h: 1000 };
  const ctx = recorder();
  paintStarMark(ctx, view, { x: 100.5, y: 50.5 }, 0.5);
  const ops = ctx.ops;
  assert.ok(ops.some(([k, v]) => k === '=fillStyle' && v === STAR_VIOLET_CSS), 'filled violet');
  assert.equal(ops.filter(([k]) => k === 'arc').length, 1, 'one ring');
  assert.equal(ops.filter(([k]) => k === 'lineTo').length, 7, 'eight points, closed');
  assert.ok(ops.findIndex(([k]) => k === 'fill') < ops.findLastIndex(([k]) => k === 'stroke'), 'inked round after its fill');
  assert.deepEqual([ops[0][0], ops.at(-1)[0]], ['save', 'restore'], 'the context left as found');
  const r0 = ops.find(([k]) => k === 'arc')[3];
  const ctx2 = recorder();
  paintStarMark(ctx2, view, { x: 100.5, y: 50.5 }, 1);
  assert.ok(ctx2.ops.find(([k]) => k === 'arc')[3] > r0, 'the ring breathes');
  assert.match(String(paintInkOverlay), /for \(const m of opts\.stars \?\? \[\]\) if \(visible\(m\.x, m\.y\)\) paintStarMark\(ctx, view, m, pulse\);/);
});
