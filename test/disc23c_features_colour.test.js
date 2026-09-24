// DISC23-C (2026-09-24, Skeptikali on Discord, over an ENHANCED tile's Off | On bar: "if a feature would be enabled,
// the ON button would turn Green, and if a feature would be disabled, the OFF button would turn Red, it would help a
// lot for people with darker screens or smaller resolutions").
//
// THE GAP: a pressed segment was a grey block whose letters alone were tinted, so on a dark or small screen On and Off
// read the same. And under it, "off" was read by POSITION - the first segment - which is wrong wherever the Off is
// not first: Grass Density runs Full, Half, Quarter, Off, so at Full its tile read off and at Off it read on.
//
// Driven through the real tile builder (enhancedMenu.js featureTile) over the real registry rows and the real prefs
// store, against a fake document; the cascade is read off the real ENHANCED_CSS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featureTile, barReading, OFF_LABEL } from '../src/ui/enhancedMenu.js';
import { FEATURES } from '../src/systems/features.js';
import { setPref, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';
import { ENHANCED_CSS, ENHANCED_TOKENS } from '../src/ui/enhancedStyle.js';

function fakeEl(tag) {
  const n = {
    tag, children: [], className: '', textContent: '', title: '', style: {}, dataset: {}, attrs: {},
    append(...cs) { for (const c of cs) { n.children.push(c); c.parent = n; } },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener() {}, removeEventListener() {},
  };
  return n;
}
function find(n, cls, out = []) {
  if (typeof n.className === 'string' && n.className.split(/\s+/).includes(cls)) out.push(n);
  for (const c of n.children ?? []) find(c, cls, out);
  return out;
}
const feature = (id) => FEATURES.find((f) => f.id === id);
/** The tile as the pane builds it: its stripe, its bar's classes, and each segment's label, press and class. */
function tile(id) {
  globalThis.document = { createElement: fakeEl, createTextNode: (t) => ({ textContent: t }), querySelectorAll: () => [] };
  try {
    const t = featureTile(feature(id));
    const bar = find(t, 'ft-seg')[0];
    return {
      on: t.dataset.on,
      bar: bar.className.split(/\s+/),
      segs: find(bar, 'ft-segb').map((b) => ({ label: b.textContent, pressed: b.attrs['aria-pressed'] === 'true', off: b.className.split(/\s+/).includes('off') })),
      press: (label) => find(bar, 'ft-segb').find((b) => b.textContent === label).onclick({ stopPropagation() {} }),
    };
  } finally { delete globalThis.document; }
}

test('DISC23-C: an Off / On switch is a switch - its Off segment marked, the tile on only when On is pressed', () => {
  resetPrefs();
  setPref('enhancedAI', false);
  let t = tile('enhanced-ai');
  assert.ok(t.bar.includes('ft-seg-switch'), 'the bar says it is a switch, so the fills apply');
  assert.deepEqual(t.segs, [{ label: 'Off', pressed: true, off: true }, { label: 'On', pressed: false, off: false }]);
  assert.equal(t.on, '0');
  t.press('On');
  t = tile('enhanced-ai');
  assert.deepEqual(t.segs.map((s) => s.pressed), [false, true]);
  assert.equal(t.on, '1', 'the stripe follows the press');
  resetPrefs();
});

test('DISC23-C: the Off is the segment that SAYS Off - Grass Density\'s is its last, and Full is on', () => {
  resetPrefs();
  setPref('grassDensity', 1);
  let t = tile('grass-density');
  assert.deepEqual(t.segs.map((s) => s.label), ['Full', 'Half', 'Quarter', 'Off']);
  assert.deepEqual(t.segs.map((s) => s.off), [false, false, false, true], 'the position read marked Full off');
  assert.equal(t.on, '1', 'full grass is grass - the position read had this tile off');
  assert.ok(t.bar.includes('ft-seg-switch'));
  t.press('Off');
  t = tile('grass-density');
  assert.equal(t.segs[3].pressed, true);
  assert.equal(t.on, '0', 'and no grass is off - the position read had this tile on');
  resetPrefs();
});

test('DISC23-C: a CHOICE has no Off, so it is neither green nor red, and its feature is never off', () => {
  resetPrefs();
  const t = tile('grass-style');
  assert.deepEqual(t.segs.map((s) => s.label), ['Pixel', 'Smooth']);
  assert.ok(!t.bar.includes('ft-seg-switch'), 'no fill law on a choice');
  assert.ok(t.segs.every((s) => !s.off), 'Pixel is not "off" because it comes first');
  assert.equal(t.on, '1');
  assert.deepEqual(barReading({ labels: ['Point', 'Bilinear', 'Trilinear'], at: 0 }), { off: -1, switch: false, on: true });
  assert.deepEqual(barReading({ labels: [OFF_LABEL, 'Low', 'Medium'], at: 2 }), { off: 0, switch: true, on: true });
  assert.deepEqual(barReading({ labels: [OFF_LABEL, 'Low', 'Medium'], at: 0 }), { off: 0, switch: true, on: false });
  resetPrefs();
});

// ── the cascade: what the pressed segment of a switch is PAINTED ───────────────────────────────────────────────────
const spec = (sel) => {
  const s = sel.replace(/::?[\w-]+(\([^)]*\))?/g, (m) => (m.startsWith('::') ? ' ' : ' .p'));
  return [(s.match(/#[\w-]+/g) ?? []).length, (s.match(/\.[\w-]+|\[[^\]]+\]/g) ?? []).length, (s.match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length];
};
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
/** The winning value of `prop` on an element whose ancestors and self carry these classes and attributes. */
function paint(classesUp, prop) {
  const rules = [...ENHANCED_CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m, order) => ({ sels: m[1].trim().split(/\s*,\s*/), body: m[2], order }));
  const matches = (sel) => {
    const parts = sel.split(/\s+/);
    let lvl = classesUp.length - 1;
    for (let i = parts.length - 1; i >= 0; i--) {
      const need = parts[i].match(/\.[\w-]+|\[[^\]]+\]/g) ?? [];
      if (!need.length || /^[a-z]|:/i.test(parts[i].replace(/^(\.[\w-]+|\[[^\]]+\])+/, ''))) return false;
      const fits = (l) => need.every((n) => classesUp[l].includes(n));
      if (i === parts.length - 1) { if (!fits(lvl)) return false; lvl--; continue; }
      while (lvl >= 0 && !fits(lvl)) lvl--;
      if (lvl < 0) return false;
      lvl--;
    }
    return true;
  };
  let best = null;
  for (const r of rules) {
    const m = r.body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`));
    if (!m) continue;
    for (const sel of r.sels) {
      if (!matches(sel)) continue;
      const s = spec(sel);
      if (!best || cmp(s, best.s) > 0 || (cmp(s, best.s) === 0 && r.order > best.order)) best = { s, order: r.order, v: m[1].trim(), sel };
    }
  }
  return best?.v;
}
const pressed = '[aria-pressed="true"]';

test('DISC23-C: a pressed On is FILLED emerald and a pressed Off cinnabar, on the pause window and the shell alike', () => {
  for (const shell of [[], ['.shell']]) {
    const up = (bar, seg) => [...(shell.length ? [shell] : []), bar, seg];
    assert.equal(paint(up(['.ft-seg', '.ft-seg-switch'], ['.ft-segb', pressed]), 'background'), 'var(--emerald)', `On, ${shell[0] ?? 'pause'}`);
    assert.equal(paint(up(['.ft-seg', '.ft-seg-switch'], ['.ft-segb', '.off', pressed]), 'background'), 'var(--cinnabar)', `Off, ${shell[0] ?? 'pause'}`);
    assert.equal(paint(up(['.ft-seg', '.ft-seg-switch'], ['.ft-segb', '.off', pressed]), 'color'), 'var(--bone)');
    // forced online: the fill still says the state; the brass edge and the tag say it is forced
    assert.equal(paint(up(['.ft-seg', '.ft-seg-switch', '.locked'], ['.ft-segb', pressed]), 'background'), 'var(--emerald)');
    assert.equal(paint(up(['.ft-seg', '.ft-seg-switch', '.locked'], ['.ft-segb', pressed]), 'color'), 'var(--bone)', 'brass on emerald would not read');
    // a choice keeps the plain press; an unpressed segment is never filled
    assert.notEqual(paint(up(['.ft-seg'], ['.ft-segb', pressed]), 'background'), 'var(--emerald)');
    assert.equal(paint(up(['.ft-seg', '.ft-seg-switch'], ['.ft-segb', '.off']), 'background'), 'none');
  }
});

test('DISC23-C: both fills read - the bone label at 4.5:1, the fill off the bar\'s ink at 3:1', () => {
  const hex = (k) => ENHANCED_TOKENS.match(new RegExp(`--${k}:\\s*(#[0-9a-f]{6});`))?.[1];
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  for (const k of ['emerald', 'cinnabar']) {
    assert.ok(hex(k), `--${k} is an opaque token`);
    assert.ok(ratio(hex(k), hex('bone')) >= 4.5, `${k} under the bone label`);
    assert.ok(ratio(hex(k), hex('ink')) >= 3, `${k} off the ink`);
  }
  const [r, g] = [parseInt(hex('emerald').slice(1, 3), 16), parseInt(hex('emerald').slice(3, 5), 16)];
  assert.ok(g > 2 * r, 'emerald is green');
  assert.ok(parseInt(hex('cinnabar').slice(1, 3), 16) > 3 * parseInt(hex('cinnabar').slice(3, 5), 16), 'cinnabar is red');
});
