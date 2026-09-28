// GOLD-DROP (2026-09-26, a player on Discord: "Gold isnt able to be put in a container", "Cant put gold in
// containers", "Can't drop gold at all"): THE GOLD BUTTON IS THE PACK'S. DFU keeps its goldButton on the player's
// own panel (DaggerfallInventoryWindow.cs:47, :515-517) and GoldButton_OnMouseClick drops the amount into whatever the
// window's remote list is - the ground, the wagon, a container (:1269-1316). The enhanced pack carried it on the
// remote window's bar alone, and that window is built for the ground only once something lies on it (PX19c) and is
// take-only for anything the host opened (MAC-M2 B) - so over bare ground there was no Gold control anywhere, and the
// player's own storage (the ship's chest, a house's cupboards, a placed chest), which opens beside the pack
// (SHIP-STORE), never had one. The button rides the pack's footer now, named for where the gold goes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { PLUS_CSS } from '../src/ui/enhancedPlusStyle.js';
import { SMALL_CART_TEMPLATE } from '../src/systems/inventorySession.js';
import { GOLD_TEMPLATE } from '../src/systems/inventory.js';
import { equipItem } from '../src/systems/equip.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';
import { withDom } from './invdrag.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAGGER = () => ({ name: 'Dagger', templateIndex: 113, group: 'Weapons', stackCount: 1, material: 0 });
const CART = () => ({ name: 'Small cart', group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, stackCount: 1 });

/** AUDIT GOLD-DROP 2: the fake's elements drop their listeners; these keep them, so a click can be handed to the
 *  frame the pane listens on, as the browser bubbles one up to it. */
const listening = (dom) => {
  const make = dom.doc.createElement;
  dom.doc.createElement = (t) => {
    const n = make(t);
    const on = [];
    n.addEventListener = (type, fn) => { on.push([type, fn]); };
    n.fire = (type, e) => { for (const [ty, fn] of on) if (ty === type) fn(e); };
    return n;
  };
};

/** The pack over fakes: `deps` the session's (a loot target, the wagon); `setup` sees the document first. */
function withPack(fn, { deps = {}, items = () => [DAGGER()], gold = 1287, setup = () => {} } = {}) {
  return withDom((dom) => {
    setup(dom);
    const host = dom.mk('div'); dom.body.append(host);
    const e = { name: 'Aelwyn', stats: { strength: 50, endurance: 48 }, items: items(), goldPieces: gold };
    let view = null;
    view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => view.unmount(), dropItem: () => {}, ...deps });
    const button = () => host.querySelectorAll('.goldbtn')[0] ?? null;
    const field = () => host.querySelectorAll('.goldfield')[0] ?? null;
    /** Open the field, type `amount`, submit - the gesture a player makes. */
    const give = (amount) => {
      if (!field()) button().onclick();
      const f = field();
      const input = f.children.find((c) => c.tagName === 'INPUT');
      input.value = String(amount);
      input.oninput();
      f.onsubmit({ preventDefault() {} });
    };
    /** The field's own submit, as the player reads it (AUDIT GOLD-DROP 5). */
    const submit = () => field()?.children.find((c) => c.tagName === 'BUTTON')?.textContent ?? null;
    /** A button of the window, by its word (the fake's selectors are one element's classes, never a descendant's). */
    const act = (word) => host.querySelectorAll('.act').find((b) => b.textContent === word) ?? null;
    try { return fn({ dom, host, e, view, button, field, give, submit, act }); } finally { view.unmount(); }
  });
}
const isGold = (it) => it.group === 'Currency' && it.templateIndex === GOLD_TEMPLATE;
/** The window's standing notice, whichever surface the skin draws it on. */
const noticeNow = () => JSON.parse(globalThis.__pack()).notice;
/** Every button the remote frame draws whose word is about gold, by any verb - a gold stack's own row is an item. */
const goldOnRemote = (host) => (host.querySelectorAll('.loot-win')[0]?.querySelectorAll('button') ?? [])
  .filter((b) => !b.classList.contains('itemrow') && /gold/i.test(b.textContent)).map((b) => b.textContent);

// AUDIT2 GOLD-DROP 4: THE CASCADE, AS THE PAGE RUNS IT. The footer's pins matched rule TEXT, and five changes a browser
// would have drawn wrong passed them all: a later rule undoing the phone's, a heavier selector putting the button back,
// a wider field, a wider purse, a wider meter. So these read what the browser reads - every rule of the two sheets the
// page lays (ENHANCED_CSS, then PLUS_CSS over it), each @media at a viewport, each selector against the footer's own
// ancestry - and take the winner by importance, specificity and order. Descendant and child combinators; a state
// (:hover, :focus-visible) is the footer at rest, so it does not match. Layout itself is Chromium's (the audit's probes).
/** Split at `sep` where no bracket or quote is open. */
const splitTop = (s, sep) => {
  const out = []; let depth = 0; let q = null; let cur = '';
  for (const ch of s) {
    if (q) { if (ch === q) q = null; cur += ch; continue; }
    if (ch === '"' || ch === "'") q = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  return [...out, cur];
};
/** Every style rule of a sheet, with the @media conditions around it, numbered in sheet order from `start`. */
function rulesOf(css, start = 0) {
  const out = [];
  const walk = (s, media) => {
    for (let i = 0; i < s.length;) {
      const open = s.indexOf('{', i);
      if (open < 0) break;
      const prelude = s.slice(i, open).split(';').pop().trim();
      let depth = 1; let j = open + 1;
      for (; j < s.length && depth; j++) depth += s[j] === '{' ? 1 : s[j] === '}' ? -1 : 0;
      const body = s.slice(open + 1, j - 1);
      if (/^@media\b/i.test(prelude)) walk(body, [...media, prelude.replace(/^@media\s*/i, '')]);
      else if (prelude && !prelude.startsWith('@')) {
        const decls = [];
        for (const d of splitTop(body, ';')) {
          const c = d.indexOf(':');
          if (c < 0) continue;
          const value = d.slice(c + 1).trim();
          decls.push([d.slice(0, c).trim().toLowerCase(), value.replace(/!\s*important$/i, '').trim(), /!\s*important$/i.test(value)]);
        }
        out.push({ sels: splitTop(prelude, ',').map((x) => x.trim()).filter(Boolean), decls, media, order: start + out.length });
      }
      i = j;
    }
  };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ''), []);
  return out;
}
/** A media query list at a viewport `{ w, h, pointer }`. */
const mediaMatches = (q, env) => splitTop(q, ',').some((part) => {
  let s = part.trim().toLowerCase();
  const neg = s.startsWith('not ');
  s = s.replace(/^not\s+/, '').replace(/^only\s+/, '').replace(/^(screen|all)(\s+and\s+|$)/, '');
  const ok = !s || s.split(/\s+and\s+/).every((f) => {
    const m = /^\(\s*([a-z-]+)\s*(?::\s*([^)]+))?\)$/.exec(f.trim());
    const v = (m?.[2] ?? '').trim();
    const px = parseFloat(v) * (v.endsWith('em') ? 16 : 1);
    return ({
      'max-width': env.w <= px, 'min-width': env.w >= px, 'max-height': env.h <= px, 'min-height': env.h >= px,
      pointer: v === env.pointer, 'any-pointer': v === env.pointer, hover: v === (env.pointer === 'coarse' ? 'none' : 'hover'),
      orientation: v === (env.w > env.h ? 'landscape' : 'portrait'), 'prefers-reduced-motion': v === 'no-preference',
    })[m?.[1]] ?? false;
  });
  return neg ? !ok : ok;
});
/** A simple selector's weight, [ids, classes/attributes/pseudo-classes, types/pseudo-elements]. */
const weight = (c) => [(c.match(/#/g) ?? []).length, (c.match(/[.[]|:(?!:)/g) ?? []).length - (c.match(/::/g) ?? []).length,
  (/^[a-z]/i.test(c) ? 1 : 0) + (c.match(/::/g) ?? []).length];
/** One compound against one element (`{ tag, classes, id, attrs }`) - its weight, or null. */
function compound(c, el, pseudo) {
  let rest = c;
  const pe = /::?(after|before)$/.exec(rest);
  if (pe) rest = rest.slice(0, pe.index);
  if ((pe?.[1] ?? null) !== pseudo || rest.includes('::')) return null;
  const spec = [0, 0, pe ? 1 : 0];
  const tag = /^([a-z][\w-]*|\*)/i.exec(rest);
  if (tag) {
    if (tag[1] !== '*' && tag[1].toLowerCase() !== el.tag) return null;
    if (tag[1] !== '*') spec[2]++;
    rest = rest.slice(tag[1].length);
  }
  for (let m; rest; rest = rest.slice(m[0].length)) {
    if ((m = /^\.([\w-]+)/.exec(rest))) { if (!el.classes.includes(m[1])) return null; spec[1]++; }
    else if ((m = /^#([\w-]+)/.exec(rest))) { if (el.id !== m[1]) return null; spec[0]++; }
    else if ((m = /^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]/.exec(rest))) {
      if (el.attrs?.[m[1]] == null || (m[2] != null && el.attrs[m[1]] !== m[2])) return null;
      spec[1]++;
    } else if ((m = /^:not\(([^()]*)\)/.exec(rest))) {
      if (compound(m[1].trim(), el, null)) return null;
      weight(m[1].trim()).forEach((n, k) => { spec[k] += n; });
    } else if ((m = /^:root/.exec(rest))) { if (el.tag !== 'html') return null; spec[1]++; }
    else return null;   // a state or a position - :hover, :focus-visible, :disabled, :first-child: not the footer at rest
  }
  return spec;
}
/** A selector against an ancestry (root first) - its weight, or null. */
function selectorWeight(sel, chain, pseudo) {
  const parts = sel.replace(/\s*>\s*/g, ' > ').trim().split(/\s+/);
  if (parts.some((p) => /^[+~]$/.test(p))) return null;   // a sibling's rule: the footer's pieces have none
  const comps = []; const child = [];
  for (const p of parts) { if (p === '>') child[comps.length - 1] = true; else comps.push(p); }
  const last = compound(comps.at(-1), chain.at(-1), pseudo);
  if (!last) return null;
  const up = (ci, ei) => {   // comps[0..ci] at or above chain[ei]
    if (ci < 0) return [0, 0, 0];
    for (let e = ei; e >= 0; e--) {
      const s = compound(comps[ci], chain[e], null);
      const above = s && up(ci - 1, e - 1);
      if (above) return s.map((n, k) => n + above[k]);
      if (child[ci]) return null;
    }
    return null;
  };
  const above = up(comps.length - 2, chain.length - 2);
  return above && last.map((n, k) => n + above[k]);
}
const quad = (v) => { const p = splitTop(v, ' ').filter(Boolean); return [p[0], p[1] ?? p[0], p[2] ?? p[0], p[3] ?? p[1] ?? p[0]]; };
/** A declaration as the longhands it sets. */
function longhands(prop, v) {
  const sides = (pre, [t, r, b, l]) => [[`${pre}top`, t], [`${pre}right`, r], [`${pre}bottom`, b], [`${pre}left`, l]];
  if (prop === 'margin' || prop === 'padding') return sides(`${prop}-`, quad(v));
  if (prop === 'inset') return sides('', quad(v));
  if (prop === 'overflow') { const [x, y] = splitTop(v, ' ').filter(Boolean); return [['overflow-x', x], ['overflow-y', y ?? x]]; }
  if (prop === 'gap') { const [r, c] = splitTop(v, ' ').filter(Boolean); return [['row-gap', r], ['column-gap', c ?? r]]; }
  if (prop === 'flex') {
    if (v === 'none' || v === 'auto') return [['flex-grow', v === 'none' ? '0' : '1'], ['flex-shrink', v === 'none' ? '0' : '1'], ['flex-basis', 'auto']];
    const p = splitTop(v, ' ').filter(Boolean);
    const num = (x) => /^[\d.]+$/.test(x ?? '');
    return [['flex-grow', num(p[0]) ? p[0] : '1'], ['flex-shrink', num(p[1]) ? p[1] : '1'],
      ['flex-basis', p.find((x, i) => i > 0 && !num(x)) ?? (num(p[0]) ? '0%' : p[0])]];
  }
  return [[prop, v]];
}
const heavier = (a, b) => { for (let k = 0; k < 3; k++) if (a[k] !== b[k]) return a[k] - b[k]; return 0; };
const beats = (a, b) => (a.important !== b.important ? a.important
  : heavier(a.spec, b.spec) ? heavier(a.spec, b.spec) > 0 : a.order > b.order);
const SHEET = rulesOf(ENHANCED_CSS);
const RULES = [...SHEET, ...rulesOf(PLUS_CSS, SHEET.length)];
/** What reaches an element (or its ::after) at a viewport: the winning declared value of each property. */
function styleAt(env, chain, pseudo = null) {
  const won = {};
  for (const r of RULES) {
    if (!r.media.every((q) => mediaMatches(q, env))) continue;
    const spec = r.sels.map((s) => selectorWeight(s, chain, pseudo)).filter(Boolean)
      .reduce((a, b) => (!a || heavier(b, a) > 0 ? b : a), null);
    if (!spec) continue;
    for (const [prop, value, important] of r.decls) {
      for (const [p, v] of longhands(prop, value)) {
        const cand = { value: v, important, spec, order: r.order };
        if (!won[p] || beats(cand, won[p])) won[p] = cand;
      }
    }
  }
  return Object.fromEntries(Object.entries(won).map(([k, v]) => [k, v.value]));
}
/** The footer's pieces, as render builds them. */
const EL = (tag, cls = '', more = {}) => ({ tag, classes: cls.split(' ').filter(Boolean), attrs: {}, ...more });
const FOOTER = [EL('html', '', { attrs: { 'data-plus-theme': 'slate' } }), EL('body'), EL('div', '', { id: 'enhanced-inventory' }),
  EL('div', 'pack-shell on'), EL('div', 'pack-win'), EL('footer', 'packbar')];
const PIECE = {
  bar: FOOTER, count: [...FOOTER, EL('span', 'packitems')], carry: [...FOOTER, EL('div', 'packcarry')],
  carryWord: [...FOOTER, EL('div', 'packcarry'), EL('span', 'k')], meter: [...FOOTER, EL('div', 'packcarry'), EL('div', 'px-meter')],
  purse: [...FOOTER, EL('div', 'packgold')], purseWord: [...FOOTER, EL('div', 'packgold'), EL('span', 'k')],
  button: [...FOOTER, EL('div', 'packgold'), EL('button', 'act goldbtn')], field: [...FOOTER, EL('form', 'goldfield')],
  wornRow: [...FOOTER.slice(0, -1), EL('div', 'pack'), EL('div', 'pack-main'), EL('section', 'charcol'), EL('section', 'equipped'),
    EL('div', 'wornmap'), EL('button', 'wornrow')],
};
const px = (v) => (v == null ? 0 : parseFloat(v));
/** The viewports the pins read the cascade at: the narrowest phone, a Pixel 5, a wide phone, the window's first
 *  stacked width under a mouse, a tablet, a desktop. */
const PHONE = { w: 320, h: 568, pointer: 'coarse' };
const PHONE_MID = { w: 393, h: 727, pointer: 'coarse' };
const PHONE_WIDE = { w: 600, h: 960, pointer: 'coarse' };
const DESK_NARROW = { w: 641, h: 900, pointer: 'fine' };
const TABLET = { w: 768, h: 1024, pointer: 'coarse' };
const DESK = { w: 1280, h: 800, pointer: 'fine' };
const EVERY = [PHONE, PHONE_MID, PHONE_WIDE, DESK_NARROW, TABLET, DESK];

test('GOLD-DROP: over bare ground (F6, nothing dropped) the pack has its Gold button - Drop - and the amount given leaves the purse as ONE gold stack on the ground, worth its count, the ground window arriving with it (mutants: the button gone, the field never shown, the purse untouched)', () => {
  withPack(({ host, e, view, button, field, give }) => {
    assert.equal(host.querySelectorAll('.loot-win').length, 0, 'bare ground: no remote frame (PX19c)');
    assert.ok(button(), 'yet the pack carries its Gold button - the bug: there was none');
    assert.equal(button().textContent, 'Drop gold', 'named for where it goes');
    assert.ok(button().parent.classList.contains('packgold'), 'beside the purse, on the pack\'s own footer');
    assert.equal(field(), null, 'the field waits for the press');
    button().onclick();
    assert.ok(field(), 'the press opens it');
    button().onclick();
    assert.equal(field(), null, 'and a second press puts it away');
    give(120);
    assert.equal(e.goldPieces, 1287 - 120, 'out of the purse');
    const dropped = view.dropped();
    assert.equal(dropped.length, 1);
    assert.ok(isGold(dropped[0]), 'a gold stack');
    assert.deepEqual([dropped[0].stackCount, dropped[0].value], [120, 1], 'CreateGoldPieces: its count, worth one apiece');
    assert.equal(field(), null, 'the field closes on a drop');
    assert.equal(host.querySelectorAll('.loot-win').length, 1, 'and the ground window arrives with the stack on it');
    give(7);
    assert.deepEqual([view.dropped().length, view.dropped()[0].stackCount, e.goldPieces], [1, 127, 1160], 'a second drop joins the stack');
  });
});

test('GOLD-DROP: a bad amount moves nothing and says nothing - nothing typed, 0, more than the purse, not a number (DropGoldPopup_OnGotUserInput :1290-1294) (mutants: a clamp for a refusal)', () => {
  withPack(({ host, e, view, give }) => {
    for (const bad of ['', '0', '1288', 'abc', '12x']) {
      give(bad);
      assert.equal(e.goldPieces, 1287, `"${bad}": the purse untouched`);
      assert.equal(view.dropped().length, 0, `"${bad}": nothing on the ground`);
      assert.equal(host.querySelectorAll('.sheet-notice').length, 0, `"${bad}": and no notice - DFU returns silently`);
    }
    give(1287);
    assert.deepEqual([e.goldPieces, view.dropped()[0].stackCount], [0, 1287], 'the whole purse is an amount');
  });
});

test('GOLD-DROP: the player\'s own storage takes gold - Store - into the list the host saves, two gifts one stack, and taken back it is the purse\'s again (mutants: storage gated off with the loot, the gold into the ground instead)', () => {
  const chest = [];
  withPack(({ host, e, button, give }) => {
    assert.ok(host.querySelector('.pack-id') && host.querySelector('.loot-win'), 'the chest opens beside the pack (SHIP-STORE)');
    assert.equal(button().textContent, 'Store gold', 'never the bare Store an item\'s card carries');
    give(300);
    give(200);
    assert.equal(chest.length, 1, 'one stack');
    assert.ok(isGold(chest[0]));
    assert.equal(chest[0].stackCount, 500, 'the two gifts merged');
    assert.equal(e.goldPieces, 787);
    const row = host.querySelectorAll('.loot-win')[0].querySelectorAll('.itemrow')[0];
    assert.ok(row, 'the stack is listed in the chest');
    row.onclick();   // IG7: a click on the chest's side takes, at once
    assert.deepEqual([chest.length, e.goldPieces], [0, 1287], 'taken back: the purse again (applyTransfer\'s gold arm), the chest empty');
  }, { deps: { loot: { items: () => chest, storage: true } } });
});

test('GOLD-DROP: with the wagon showing the button is Stow and the gold goes into the wagon; a body\'s tray never offers it (MAC-M2 B) (mutants: the wagon ignored, gold on a body)', () => {
  const wagon = [];
  const chest = [];
  withPack(({ host, e, button, give }) => {
    const toWagon = host.querySelectorAll('.act').find((b) => b.textContent === 'Wagon');
    assert.ok(toWagon, 'the cart in the bag: the Wagon button');
    toWagon.onclick();
    assert.equal(button().textContent, 'Stow gold');
    give(50);
    assert.deepEqual([wagon.length, wagon[0]?.stackCount, e.goldPieces, chest.length], [1, 50, 1237, 0], 'into the wagon, not the chest');
  }, { deps: { loot: { items: () => chest, storage: true }, wagonItems: () => wagon }, items: () => [DAGGER(), CART()] });
  withPack(({ host, button }) => {
    assert.equal(host.querySelector('.pack-id'), null, 'a body: its frame alone');
    assert.equal(button(), null, 'and no Gold anywhere - the loot window is for taking');
  }, { deps: { loot: { items: () => [DAGGER()] } } });
});

test('GOLD-DROP: by source - the button rides the pack\'s footer and its field the footer too (AUDIT GOLD-DROP 1); the remote bar carries none, by any label; the field\'s verb is the button\'s (mutants: the bar\'s button back)', () => {
  const s = src('src/ui/enhancedInventory.js');
  const remoteCol = s.slice(s.indexOf('function remoteCol()'), s.indexOf('function goldField()'));
  assert.ok(!/'Gold'\)/.test(remoteCol) && !/goldField\(\)/.test(remoteCol), 'no gold on the remote window');
  assert.ok(!/el\('button'[^;]*gold/i.test(remoteCol), 'AUDIT GOLD-DROP 5: nor a gold button under another word - "Drop gold", "Store gold"');
  assert.match(s, /const verb = `\$\{GOLD_VERB\[remote\?\.kind\] \?\? 'Drop'\} gold`;/);
  assert.match(s, /const give = el\('button', `act goldbtn\$\{goldEntry != null \? ' primary' : ''\}`, verb\);/);
  assert.match(s, /if \(giving && goldEntry != null\) bar\.append\(goldField\(\)\);/);
  assert.match(s, /const go = el\('button', 'act primary', GOLD_VERB\[remote\?\.kind\] \?\? 'Drop'\);/);
});

// AUDIT GOLD-DROP 1 (2026-09-27, the audit of GOLD-DROP): ON A PHONE THE BUTTON WAS OFF THE SCREEN. The footer is one
// flex row never narrower than ~550px, the host clips and play/index.html will not zoom, so on a 393px Pixel 5 the
// button stood at x=446..550 and "Can't drop gold at all" stayed true there. It was 32px under a finger where every
// other button of this window is 44; and its field, a row of the window below the bar, took its ~110px out of the item
// list, which a stacked window (641-999px) has about 50px of - the list went to nothing and the dock ran under the
// footer. Chromium measured the fix over the real module and sheet (320-430 on a touch screen, 640-999, 800x600, 1280):
// the button on the screen and opened by a real tap, the field's input and submit under the pointer, the list's height
// and the dock's foot unmoved by the field. What node can hold is the field's home and what the cascade gives it (the
// footer itself, which the second audit took further, is AUDIT2 GOLD-DROP 1's below).
test('AUDIT GOLD-DROP 1: the field is the FOOTER\'s, floated over it and never a row of the window the list pays for - hung off the footer\'s top edge and never wider than 360px or the footer less its margins, at every width, whatever rule comes later (mutants: the field back in the window, in the flow, wider, under the worn rows, the footer not its block)', () => {
  withPack(({ host, button, field }) => {
    button().onclick();
    assert.equal(field().parent, host.querySelector('.packbar'), 'the footer holds the field');
    assert.equal(host.querySelector('.pack-win').children.includes(field()), false, 'not the window, whose fixed height the list paid');
  });
  assert.doesNotMatch(ENHANCED_CSS, /\.pack-win > \.goldfield/, 'no in-flow rule left');
  for (const env of EVERY) {
    const at = `${env.w}px ${env.pointer}`;
    const f = styleAt(env, PIECE.field);
    assert.equal(styleAt(env, PIECE.bar).position, 'relative', `${at}: the footer is the field's block`);
    assert.deepEqual([f.position, f.bottom, f.right], ['absolute', 'calc(100% + 8px)', '16px'], `${at}: hung off the footer's top edge`);
    assert.equal(f.width, 'min(360px, calc(100% - 32px))', `${at}: its width's bound (AUDIT2 GOLD-DROP 4)`);
    assert.ok([undefined, '0', 'auto'].includes(f['min-width']), `${at}: and nothing holds it wider`);
    assert.ok(px(f['z-index']) > px(styleAt(env, PIECE.wornRow)['z-index']), `${at}: over the worn rows the body's region runs under it`);
  }
});

// AUDIT GOLD-DROP 2: THE FIRST CLICK INTO THE FIELD WAS LOST WITH A CARD UP. The window's click-away puts an item's
// card away on any click that is not the card's or a button's, and GOLD-DROP put the field inside that window - so the
// click into its input closed the card and redrew the window under the caret, focus went to the body and the amount
// typed went nowhere (Chromium: "250" typed, "0" in the field). A field is interactive, and the click-away passes it.
// AUDIT2 GOLD-DROP 2: the card and the field never stand together now (AUDIT2 GOLD-DROP 2's own pin, below), and the
// click-away puts away whichever is up - so a click into the field is still the field's own, and a click on nothing
// is one of the ways it closes.
test('AUDIT GOLD-DROP 2: a click into the gold field is the field\'s own - the very input clicked, nothing redrawn under the caret, its own ground too - and (AUDIT2 GOLD-DROP 2) a click on nothing puts the field away as it does a card (mutants: the click-away blind to the field, deaf to it)', () => {
  withPack(({ host, button, field }) => {
    const frame = () => host.querySelector('.pack-win');
    const input = () => field()?.children.find((c) => c.tagName === 'INPUT') ?? null;
    button().onclick();
    const clicked = input();
    frame().fire('click', { target: clicked });   // the browser bubbles the input's click to the frame
    assert.equal(input(), clicked, 'the input is the one the player clicked, not a redrawn one');
    frame().fire('click', { target: field().children.find((c) => c.tagName === 'P') });
    assert.equal(input(), clicked, 'the field\'s own ground is the field');
    frame().fire('click', { target: frame() });
    assert.equal(field(), null, 'a click on nothing puts it away');
    host.querySelector('.pack-dock').querySelectorAll('.itemrow')[0].onclick();
    assert.equal(host.querySelectorAll('.packtip').length, 1, 'a card');
    frame().fire('click', { target: frame() });
    assert.equal(host.querySelectorAll('.packtip').length, 0, 'the same click puts a card away');
  }, { setup: listening });
});

// AUDIT GOLD-DROP 3: A REWARD TRAY TOOK GOLD, AND LOST IT. A choose-one session builds the pack, so the button read
// "Drop gold" and dropGold put the stack into the tray's list - the gift's: the piece taken is the claim and the host
// keeps nothing else, so the gold went with the rest when a piece was chosen or the window closed (the purse 1287 ->
// 1087, the 200 in the discarded list). DFU's DropGoldPopup does the same. The port's rule is that nothing leaves the
// pack while a choice is up (planStore's chooseOnePile), and MAC-M2 B's reason for a body is this one.
test('AUDIT GOLD-DROP 3: a reward tray never offers the gold button nor its field - the purse and the gift stand; the wagon, opened beside a tray, still takes gold, INTO the wagon (mutants: the button over the tray, the field over it, a choice hiding the wagon\'s too, the gold onto the ground)', () => {
  let gift = [DAGGER(), DAGGER()];
  withPack(({ host, e, button, field }) => {
    assert.ok(host.querySelector('.pack-id'), 'the pack beside the tray');
    assert.equal(host.querySelector('.remotewho').children[0].textContent, 'Choose one');
    assert.equal(button(), null, 'no gold button - the tray is the gift\'s, not the purse\'s');
    assert.equal(field(), null);
    assert.equal(host.querySelector('.packgold').children[1].textContent, (1287).toLocaleString(), 'the purse still shows');
    assert.deepEqual([e.goldPieces, gift.length], [1287, 2]);
  }, { deps: { chooseOne: { items: gift, onChoose: () => {} } } });
  gift = [DAGGER(), DAGGER()];
  const wagon = [];
  withPack(({ e, button, field, give, act }) => {
    act('Wagon').onclick();
    assert.equal(button()?.textContent, 'Stow gold', 'the wagon, opened beside the tray, keeps what it is given');
    give(50);
    assert.deepEqual([wagon.length, wagon[0]?.stackCount, e.goldPieces, gift.length], [1, 50, 1237, 2], 'into the wagon - not the tray, not the ground');
    button().onclick();
    assert.ok(field(), 'the field open over the wagon');
    act('Leave wagon').onclick();
    assert.deepEqual([button(), field()], [null, null], 'back to the tray: the button and its field go');
    assert.deepEqual([gift.length, e.goldPieces], [2, 1237]);
  }, { deps: { chooseOne: { items: gift, onChoose: () => {} }, wagonItems: () => wagon }, items: () => [DAGGER(), CART()] });
});

// AUDIT GOLD-DROP 5: WHAT THE SEVEN MUTANTS LEFT UNCHECKED. The field's verb was held by a regex over the source alone;
// a gold button back on the remote bar under its verb ("Store gold") passed every check, which looked for the bare
// word 'Gold'; the press's clearing of a standing notice and the mount's closing of the field were checked by nothing.
// Read here as the player meets them.
test('AUDIT GOLD-DROP 5: the field\'s submit is the button\'s verb - Drop onto the ground, Store into storage, Stow into the wagon; no remote frame draws a gold button, whatever its word; over the wagon the button stays and a second press puts the field away (mutants: the field\'s verb lost, a "Store gold" back on the remote bar, the wagon hiding an open field\'s button)', () => {
  withPack(({ host, button, submit, give }) => {
    button().onclick();
    assert.equal(submit(), 'Drop', 'the ground');
    give(5);
    assert.equal(host.querySelectorAll('.loot-win').length, 1, 'the ground window, with the stack on it');
    assert.deepEqual(goldOnRemote(host), [], 'and no gold button on it');
  });
  const chest = [];
  const wagon = [];
  withPack(({ host, button, submit, act }) => {
    assert.equal(button().textContent, 'Store gold');
    button().onclick();
    assert.equal(submit(), 'Store', 'the player\'s own storage: the field says where, as the button does');
    assert.deepEqual(goldOnRemote(host), [], 'the chest\'s frame draws no gold button');
    act('Wagon').onclick();
    assert.equal(submit(), 'Stow', 'the wagon: the field follows it');
    assert.deepEqual(goldOnRemote(host), [], 'nor the wagon\'s');
    assert.ok(button().classList.contains('primary'), 'the button stays, lit, while its field is open');
    button().onclick();
    assert.equal(submit(), null, 'and a second press puts the field away over the wagon too');
  }, { deps: { loot: { items: () => chest, storage: true }, wagonItems: () => wagon }, items: () => [DAGGER(), CART()] });
});

test('AUDIT GOLD-DROP 5: a press of the button clears a standing notice - the wagon\'s "could only hold" among them - and the field does not outlive the window: closed and opened again, the pack comes back without it (mutants: the notice kept, the field kept across a mount)', () => {
  const chest = [];
  const wagon = [{ ...DAGGER(), name: 'Anvil', weightInKg: 749.9 }];
  withPack(({ e, button, field, give, act }) => {
    act('Wagon').onclick();
    give(1000);
    assert.deepEqual([e.goldPieces, wagon.filter(isGold).map((i) => i.stackCount)], [100000 - 40, [40]], 'the wagon took what it could hold');
    assert.equal(noticeNow(), 'Your wagon could only hold 40 gold pieces.', 'and said so');
    button().onclick();
    assert.equal(noticeNow(), null, 'the next press starts clean');
    assert.ok(field());
  }, { deps: { loot: { items: () => chest, storage: true }, wagonItems: () => wagon }, items: () => [DAGGER(), CART()], gold: 100000 });
  withDom((dom) => {
    const e = { name: 'Aelwyn', stats: { strength: 50, endurance: 48 }, items: [DAGGER()], goldPieces: 50 };
    const first = dom.mk('div'); dom.body.append(first);
    const v1 = mountEnhancedInventory(first, { entity: e, items: () => e.items });
    first.querySelectorAll('.goldbtn')[0].onclick();
    assert.equal(first.querySelectorAll('.goldfield').length, 1, 'opened, and never used');
    v1.unmount();
    const again = dom.mk('div'); dom.body.append(again);
    const v2 = mountEnhancedInventory(again, { entity: e, items: () => e.items });
    try {
      assert.equal(again.querySelectorAll('.goldfield').length, 0, 'the pack opens again without it');
      assert.equal(again.querySelectorAll('.goldbtn')[0].classList.contains('primary'), false, 'its button unlit');
    } finally { v2.unmount(); }
  });
});

// AUDIT2 GOLD-DROP 1 and 3 (2026-09-27, the second audit of GOLD-DROP): THE WRAP COST A PHONE ITS ONE ROW. The first
// audit's footer wrapped on a phone to bring the button on screen: 57px became 90, and the fixed-height window took
// the difference from the list - 375x667 58 -> 25, a 390x664 iPhone 65 -> 32, a Pixel 5 128 -> 95, the one row of
// tiles gone on the common small phones. And at 320 it still overran: three rows, the carry's meter 14-44px past the
// screen's edge. It is one row now, whatever the purse: the count goes, the meter and then the carry give way, the purse
// and its button never do, and under 520px the two words leave the eye for a screen reader. Chromium measured every
// row of tiles against the footer before GOLD-DROP - 320-430 on a touch screen, 640, the landscape phones, the tablets,
// 641-1920 - none lost, the button whole and hit, nothing past an edge. What node holds is what the page's cascade
// gives each piece, so a later rule or a heavier selector is caught as the browser would draw it.
test('AUDIT2 GOLD-DROP 1/3: on a phone the footer is ONE row - no count, never wrapped, the meter then the carry giving way, the purse and its button never shrinking, the two words clipped for a reader under 520px - whatever rule comes later or weighs more; above 640px it is as it was (mutants: a later rule wrapping it or bringing the count back, a wide meter, a wide purse, the words back at 320)', () => {
  const clipped = (w) => w.position === 'absolute' && w['clip-path'] === 'inset(50%)';
  for (const env of [PHONE, PHONE_MID, PHONE_WIDE]) {
    const at = `${env.w}px`;
    const bar = styleAt(env, PIECE.bar);
    const carry = styleAt(env, PIECE.carry);
    const meter = styleAt(env, PIECE.meter);
    const purse = styleAt(env, PIECE.purse);
    assert.equal(styleAt(env, PIECE.count).display, 'none', `${at}: no count - every tab carries its page's`);
    assert.ok(!/^wrap/.test(bar['flex-wrap'] ?? ''), `${at}: one row, never wrapped`);
    assert.deepEqual([carry['flex-shrink'], carry['min-width'], carry['overflow-x'], carry['white-space']], ['1', '0', 'hidden', 'nowrap'],
      `${at}: the carry gives way, clipped, its words never breaking`);
    assert.deepEqual([meter['flex-basis'], meter['flex-shrink'], meter['min-width']], ['140px', '1', '0'], `${at}: the meter gives way first`);
    assert.ok([undefined, 'auto'].includes(meter.width), `${at}: and no width holds it`);
    assert.equal(purse['flex-shrink'], '0', `${at}: the purse and its button never shrink`);
    assert.ok([undefined, '0', 'auto'].includes(purse['min-width']) && [undefined, 'auto'].includes(purse.width), `${at}: nor ask more than their words`);
    const small = env.w <= 520;
    assert.equal(clipped(styleAt(env, PIECE.carryWord)) && clipped(styleAt(env, PIECE.purseWord)), small,
      `${at}: the two words ${small ? 'clipped for a reader' : 'shown'}`);
    assert.equal(styleAt(env, PIECE.button)['padding-left'], small ? '8px' : '12px', `${at}: the button's sides`);
  }
  for (const env of [DESK_NARROW, TABLET, DESK]) {
    const at = `${env.w}px`;
    assert.notEqual(styleAt(env, PIECE.count).display, 'none', `${at}: the count`);
    assert.ok(!clipped(styleAt(env, PIECE.carryWord)) && !clipped(styleAt(env, PIECE.purseWord)), `${at}: the words`);
    assert.equal(styleAt(env, PIECE.meter)['flex-basis'], '140px', `${at}: the meter at 140`);
    assert.ok(!/^wrap/.test(styleAt(env, PIECE.bar)['flex-wrap'] ?? ''), `${at}: one row`);
  }
});

// AUDIT2 GOLD-DROP 1: AND THE BUTTON TOOK ITS HEIGHT FROM THE LIST EVERYWHERE. The footer is 38px without it - a 20px
// line and 8px of padding each way under its 2px rule - and the window's height is fixed, so the first audit's 32px
// button (a 50px footer) and a finger's 44px drawing (62) came out of the list: a row of tiles at 1024x600 and on an
// iPad. The button sinks into the footer's own padding now, and a finger's 44 is a TARGET inside the footer rather
// than a taller drawing; it reached above the footer at first, and a worn row painted over its top edge cut it to 40.
test('AUDIT2 GOLD-DROP 1: the button takes no height - drawn at 32 and sunk 6px into the footer\'s padding each way, its box the footer\'s 20px line; under a finger the footer\'s inside is 44px and the button\'s target fills it exactly, and under a mouse there is no target past the drawing (mutants: the margins gone, the button drawn at 44, a heavier rule cutting the target, the target past the footer)', () => {
  for (const env of EVERY) {
    const at = `${env.w}px ${env.pointer}`;
    const b = styleAt(env, PIECE.button);
    const bar = styleAt(env, PIECE.bar);
    assert.equal(px(b['min-height']), 32, `${at}: drawn at 32`);
    assert.ok([undefined, 'auto'].includes(b.height) && [undefined, 'none'].includes(b['max-height']), `${at}: and nothing else sizes it`);
    assert.equal(px(b['min-height']) + px(b['margin-top']) + px(b['margin-bottom']), 20, `${at}: its box the footer's 20px line - no height from the list`);
    const coarse = env.pointer === 'coarse';
    assert.deepEqual([px(bar['padding-top']), px(bar['padding-bottom'])], coarse ? [12, 12] : [8, 8], `${at}: the footer's own padding`);
    const after = styleAt(env, PIECE.button, 'after');
    if (!coarse) { assert.equal(after.content, undefined, `${at}: no finger, no target past the drawing`); continue; }
    assert.deepEqual([after.content, after.position, after.left, after.right, b.position], ["''", 'absolute', '0', '0', 'relative'],
      `${at}: a finger's target, on the button`);
    const border = px((b.border ?? '').split(' ')[0]);
    const target = px(b['min-height']) - 2 * border - px(after.top) - px(after.bottom);   // offsets run from the padding edge
    assert.equal(target, 44, `${at}: a finger's 44px`);
    assert.equal(target, px(bar['padding-top']) + 20 + px(bar['padding-bottom']), `${at}: exactly the footer's inside, where nothing paints over it`);
  }
});

// AUDIT2 GOLD-DROP 2: TWO FLOATERS, ONE OVER THE OTHER. The field floated above an item's card (z 5 over 4) and covered
// its buttons - Swap to, Lock and Info at 1280x720, 1024x600, 1366x768 and 900x900 - and at 900x900 the card stood over
// the gold button itself, so the field could not be put away while the card was up. Nor could Back put it away: from
// its input Back did nothing, and from anywhere else it shut the whole pack under it. One floater at a time now, as
// the classic window's popup is modal: opening the field puts the card away and a pick puts the field away, from the
// list, a worn panel or a shelf socket; Back puts the field away first, and the pack only after.
test('AUDIT2 GOLD-DROP 2: ONE FLOATER AT A TIME - the field opening puts an item\'s card away, a pick from the list, a worn panel or a shelf socket puts the field away; Back from the field\'s input or from anywhere puts the field away and leaves the pack, and a second Back closes the pack (mutants: the card kept under the field, the field kept under a card, Back past the field)', () => {
  const prev = globalThis.location;
  _resetForTests(); globalThis.location = { search: '?skin=enhanced' };   // the shipping skin, whose shelf holds the rings
  let exits = 0;
  try {
    withPack(({ dom, host, e, view, button, field }) => {
      assert.ok(equipItem(e, e.items[1]) && equipItem(e, e.items[2]), 'a dagger in hand and a ring on');
      view.repaint();
      const card = () => host.querySelectorAll('.packtip').length;
      const open = () => [card(), !!field()];
      const filled = (cls) => host.querySelectorAll(cls).find((n) => !n.classList.contains('wornempty') && n.onclick);
      host.querySelector('.pack-dock').querySelectorAll('.itemrow')[0].onclick();
      assert.deepEqual(open(), [1, false], 'a card up');
      button().onclick();
      assert.deepEqual(open(), [0, true], 'the field opens and the card goes');
      host.querySelector('.pack-dock').querySelectorAll('.itemrow')[0].onclick();
      assert.deepEqual(open(), [1, false], 'a pick from the list puts the field away');
      button().onclick();
      filled('.wornrow').onclick();
      assert.deepEqual(open(), [1, false], 'and so does a worn panel');
      button().onclick();
      filled('.wornsock').onclick();
      assert.deepEqual(open(), [1, false], 'and a shelf socket');
      // Back as the browser hands it on: the window's capture listener first, then - unless that stopped it - the
      // target's own handler (the fake's window alone would skip the second)
      const back = (target) => {
        let stopped = false;
        const ev = { key: 'Escape', code: 'Escape', target, repeat: false, preventDefault() {}, stopPropagation() { stopped = true; } };
        dom.win.fire('keydown', ev);
        if (!stopped) target.onkeydown?.(ev);
      };
      button().onclick();
      back(field().children.find((c) => c.tagName === 'INPUT'));
      assert.deepEqual([!!field(), exits], [false, 0], 'Back from inside the field puts the field away - not the pack');
      button().onclick();
      back(dom.body);
      assert.deepEqual([!!field(), exits], [false, 0], 'and from anywhere else too');
      back(dom.body);
      assert.equal(exits, 1, 'a second Back closes the pack');
    }, { setup: listening, deps: { onExit: () => { exits++; } },
      items: () => [DAGGER(), DAGGER(), { name: 'Ring', templateIndex: 135, group: 'Jewellery', stackCount: 1 }] });
  } finally { globalThis.location = prev; _resetForTests(); }
});
