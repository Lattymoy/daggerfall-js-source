// PLUS-DRESS (2026-09-26, Mac: "just ensure any of the new UI elements are also apart of how enhanced plus looks"):
// the online lane's newer screens in the stone-and-brass kit. The roles are the kit's table (ui/enhancedFrame.js
// FRAME_ROLES), read here against each screen's OWN sheet so a role can never name a class nothing draws; what a role
// cannot say is ui/enhancedPlusStyle.js ONLINE_DRESS_CSS, read as rules; the gate's bar and banner are BUILT on fake
// documents to show they paint from classes now (the Plus sheet cannot outweigh an inline style).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRAME_ROLES, FRAME_CSS } from '../src/ui/enhancedFrame.js';
import { ONLINE_DRESS_CSS, PLUS_CSS } from '../src/ui/enhancedPlusStyle.js';
import { SOCIAL_CSS } from '../src/ui/socialPanel.js';
import { SOCIAL_MENU_CSS } from '../src/ui/socialMenu.js';
import { DECOR_CSS } from '../src/ui/decorPanel.js';
import { DUEL_PROMPT_CSS } from '../src/ui/duelPrompt.js';
import { PAGE_CSS } from '../src/ui/pageWindow.js';
import { PROFILE_CSS } from '../src/ui/profileWindow.js';
import { PARTY_CSS } from '../src/ui/partyPanel.js';
import { NAME_CSS } from '../src/ui/nameLayer.js';
import { drawGateBossBar, destroyGateBossBar, BOSS_BAR_CSS, BOSS_BAR_STYLE_ID } from '../src/ui/gateBossBar.js';
import { drawGateBanner, destroyGateBanner, GATE_BANNER_CSS, GATE_BANNER_STYLE_ID } from '../src/ui/gateBanner.js';
import { PIXEL_STACK } from '../src/ui/pixelifyFive.js';

/** A sheet as rules: each rule's selectors (trimmed) and its body. Comments out first. */
const rules = (css) => [...css.replace(/\/\*[^]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((m) => ({ sels: m[1].split(',').map((s) => s.trim()), body: m[2] }));
const SHEETS = { dfsocial: SOCIAL_CSS, dfpeer: SOCIAL_MENU_CSS, dfdecor: DECOR_CSS, dfduel: DUEL_PROMPT_CSS, dfpage: PAGE_CSS, dfprofile: PROFILE_CSS, dfparty: PARTY_CSS, dfname: NAME_CSS };
const NEW = {
  window: ['body .dfdecor-card'],
  panel: ['body .dfpage-card', 'body .dfpeer-card', 'body .dfsocial-toast', 'body .dfduel-toast', 'body .dfdecor-bar'],
  panelAccent: ['body .dfsocial-toast', 'body .dfdecor-bar'],
  button: ['body .dfpage-btn', 'body .dfpeer-btn:not(.cancel)', 'body .dfduel-btn', 'body .dfprofile-duel', 'body .dfdecor-btn', 'body .dfdecor-open'],
  primary: ['body .dfdecor-place'],
  warn: ['body .dfsocial-btn.warn', 'body .dfprofile-duel'],
  tile: ['body .dfdecor-chip'],
  well: ['body .dfpage-leaf', 'body .dfdecor-list', 'body .dfdecor-preview', 'body .dfdecor-thumb', 'body .dfdecor-search', 'body .dfparty-face'],
  input: ['body .dfdecor-search'],
  headerRule: ['body .dfsocial-sec', 'body .dfpeer-name', 'body .dfdecor-head'],
  rule: ['body .dfsocial-row'],
  listRow: ['body .dfdecor-row'],
};

test('PLUS-DRESS the roles: the journal page, the F-menu, the decorator (a whole window), the duel strip, the party invitation, the Guild tab\'s heads and rows play the kit\'s roles - each with a leading body (its own sheet is injected after the kit), each naming a class its screen\'s own sheet draws, and every rounded one squared (mutants: a screen left out of its role, a role naming a class nobody draws)', () => {
  for (const [role, sels] of Object.entries(NEW)) {
    for (const s of sels) assert.ok(FRAME_ROLES[role].includes(s), `${role}: ${s}`);
  }
  const online = Object.values(FRAME_ROLES).flat().filter((s) => /\.df[a-z]+-/.test(s));
  for (const s of online) {
    assert.match(s, /^body /, `${s}: a leading body, or its own later sheet outweighs it`);
    for (const [, prefix, cls] of s.matchAll(/\.(df[a-z]+)(-[a-z-]+)/g)) {
      const sheet = SHEETS[prefix];
      if (!sheet) continue;   // the chat's own classes are PLUS1d's, older than this
      assert.ok(new RegExp(`\\.${prefix}${cls}\\b`).test(sheet), `${s}: .${prefix}${cls} is drawn by its screen's sheet`);
    }
  }
  const rounded = [
    ['dfsocial', 'toast'], ['dfsocial', 'badge'], ['dfsocial', 'letter'], ['dfprofile', 'renown'], ['dfprofile', 'duel'],
    ['dfpage', 'card'], ['dfpage', 'leaf'], ['dfpage', 'btn'], ['dfpeer', 'card'], ['dfpeer', 'btn'], ['dfduel', 'toast'], ['dfduel', 'btn'],
    ['dfdecor', 'card'], ['dfdecor', 'open'], ['dfdecor', 'search'], ['dfdecor', 'chip'], ['dfdecor', 'list'], ['dfdecor', 'thumb'],
    ['dfdecor', 'preview'], ['dfdecor', 'btn'], ['dfdecor', 'bar'],
  ];
  for (const [p, c] of rounded) {
    assert.match(SHEETS[p], new RegExp(`\\.${p}-${c} \\{[^}]*border-radius`), `.${p}-${c} was rounded in its own sheet`);
    assert.ok(FRAME_ROLES.square.includes(`body .${p}-${c}`), `.${p}-${c} is squared`);
  }
});

test('PLUS-DRESS the WARN role: a press that costs something (leave, remove, disband, challenge) is edged in blood lit from the top left, brighter under the pointer and never brass, sunk while held - written BEFORE the disabled rule, so a warn that cannot be pressed goes flat like any other; paint only (mutants: the warn edge after the disabled rule, brass on a warn\'s hover)', () => {
  const at = (s) => FRAME_CSS.indexOf(s);
  const rest = at('body .dfsocial-btn.warn,\nbody .dfprofile-duel { border-color: #e0584a #5a130f #3d0d0a #b83a2e;');
  assert.ok(rest > 0, 'the edge');
  const hover = at('body .dfsocial-btn.warn:hover:not(:disabled),\nbody .dfprofile-duel:hover:not(:disabled), body .dfsocial-btn.warn:focus-visible,\nbody .dfprofile-duel:focus-visible { border-color: #ff8a76 #7a1d16 #5a130f #e0584a;');
  assert.ok(hover > rest, 'brighter blood under the pointer');
  assert.ok(at('body .dfsocial-btn.warn:active:not(:disabled),\nbody .dfprofile-duel:active:not(:disabled) { border-color: #3d0d0a #b83a2e #e0584a #5a130f; }') > hover, 'sunk while held');
  const disabled = at('body .dfsocial-btn:disabled');
  assert.ok(disabled > rest && disabled > hover, 'the disabled rule comes after and wins at the same weight');
  assert.ok(FRAME_ROLES.button.includes('body .dfprofile-duel') && FRAME_ROLES.button.includes('body .dfsocial-btn'), 'a warn is a button first');
});

test('PLUS-DRESS what a role cannot say: the words stay bone under the kit\'s hover (and the kit\'s hover said again where a native :not() outweighed it); each press the lane drew borderless or on a line gets a 2px edge taken out of its padding, so it keeps its size; the duel strip, the boss\'s bar and the gate\'s countdown in the pixel face; the Renown box a brass plaque wherever a name wears it, its bar the vitals\' own with clasps; the party\'s lines in the vitals\' tones (mutants: a width-changing edge, a border shorthand that wipes the kit\'s colours, the serif left on the gate)', () => {
  const dress = rules(ONLINE_DRESS_CSS);
  const bodyOf = (sel, prop) => dress.filter((r) => r.sels.includes(sel)).map((r) => new RegExp(`(?:^|[\\s;])${prop}: ([^;]+);`).exec(r.body)?.[1]).filter(Boolean).at(-1) ?? null;
  for (const s of ['body .dfprofile-close:hover', 'body .dfdecor-btn:hover', 'body .dfduel-btn:hover', 'body .dfdecor-open:hover',
    'body .dfpage-btn:hover:not(:disabled)', 'body .dfpeer-btn:not(.cancel):hover:not([disabled])']) {
    assert.equal(bodyOf(s, 'color'), 'var(--bone, #e9e4d9)', s);
  }
  assert.ok(bodyOf('body .dfpage-btn:hover:not(:disabled)', 'background-color'), 'the page\'s native hover (0,3,0) is outweighed at (0,3,1)');
  // the edges, and the sizes they keep
  const px = (v) => v.split(/\s+/).map((x) => parseFloat(x));
  const native = (prefix, cls) => {
    const r = rules(SHEETS[prefix]).find((x) => x.sels.includes(`.${prefix}-${cls}`) && /padding:/.test(x.body));
    const pad = px(/padding: ([^;]+);/.exec(r.body)[1]);
    const border = /border: (\d+)px/.exec(r.body)?.[1] ?? (/border: 0/.test(r.body) ? '0' : null);
    return { pad, border: Number(border) };
  };
  for (const [prefix, cls] of [['dfsocial', 'btn'], ['dfsocial', 'close'], ['dfprofile', 'close'], ['dfprofile', 'duel'], ['dfpage', 'btn'],
    ['dfpeer', 'btn'], ['dfduel', 'btn'], ['dfdecor', 'btn'], ['dfdecor', 'open']]) {
    const sel = cls === 'btn' && prefix === 'dfpeer' ? 'body .dfpeer-btn:not(.cancel)' : `body .${prefix}-${cls}`;
    assert.equal(bodyOf(sel, 'border-width'), '2px', sel);
    assert.equal(bodyOf(sel, 'border-style'), 'solid', sel);
    const n = native(prefix, cls);
    const d = px(bodyOf(sel, 'padding'));
    assert.deepEqual(d.map((v, i) => v + 2), n.pad.slice(0, 2).map((v) => v + n.border), `${sel}: the edge is taken out of the padding, the press keeps its size`);
  }
  for (const r of dress.filter((x) => x.sels.some((q) => /\.df[a-z]+-/.test(q)))) {
    assert.doesNotMatch(r.body, /(^|[\s;])border: \d/, `${r.sels[0]}: no border shorthand on a kit-dressed press - it would reset the bevel's colours`);
  }
  for (const s of ['body .dfduel-toast', 'body .wb-boss-bar', 'body .wb-gate-banner']) assert.ok(bodyOf(s, 'font-family')?.startsWith(PIXEL_STACK), `${s} in the pixel face`);
  const plaque = dress.find((r) => r.sels.includes('body .dfname-renown'));
  assert.deepEqual(plaque.sels, ['body .dfname-renown', 'body .dfprofile-renown', '.hud-renownbox'], 'one plaque for every Renown box');
  assert.match(plaque.body, /border-color: #f3cf86 #7a5424 #5c3f1a #c08a3e;/);
  assert.match(ONLINE_DRESS_CSS, /\.hud-renown \.hud-renowntrack::before, \.hud-renown \.hud-renowntrack::after \{ content: ''; position: absolute; top: -2px; bottom: -2px;\n\s+width: 6px;/, 'the vitals\' clasps');
  assert.match(ONLINE_DRESS_CSS, /body \.dfparty-vital\.health \.dfparty-fill \{ background: linear-gradient\(180deg, #f2a597 0 1px, #d8685a 1px 2px, #b53a2e 2px 4px, #8a2820 4px\); \}/, 'the health bar\'s tones');
  assert.ok(PLUS_CSS.includes(ONLINE_DRESS_CSS), 'the dress rides the Plus sheet');
});

test('PLUS-DRESS the gate: the boss\'s bar and the countdown paint from CLASSES now - each part named, only what moves written inline (the fill\'s width, the ward shown, the marks\' places) - and each module\'s sheet goes in ONCE, where a document can take one (mutants: the paint back inline, the sheet injected per draw)', () => {
  const made = [];
  const node = (tag) => { const n = { tag, style: {}, className: '', textContent: '', children: [], append(...c) { this.children.push(...c); }, remove() {} }; made.push(n); return n; };
  const styles = [];
  const doc = { createElement: node, body: node('body'), head: { append: (s) => styles.push(s) }, getElementById: (id) => styles.find((s) => s.id === id) ?? null };
  destroyGateBossBar();
  const model = { name: 'Valkynaz Ruhn', title: 'Warden', frac: 0.5, marks: [0.66, 0.33], warded: false, callout: null, fallen: false, fighters: 2, wrath: null };
  drawGateBossBar(model, { doc });
  drawGateBossBar({ ...model, frac: 0.4 }, { doc });
  const root = doc.body.children[0];
  assert.equal(root.className, 'wb-boss-bar');
  assert.deepEqual(root.children.map((c) => c.className), ['wb-boss-name', 'wb-boss-track', 'wb-boss-callout', 'wb-boss-foot']);
  const track = root.children[1];
  assert.deepEqual(track.children.map((c) => c.className), ['wb-boss-fill', 'wb-boss-mark', 'wb-boss-mark', 'wb-boss-ward']);
  assert.equal(track.children[0].style.width, '40.0%');
  assert.equal(track.children[3].style.display, 'none');
  assert.ok(made.every((n) => n.style.cssText === undefined), 'no part carries its paint inline');
  assert.equal(styles.filter((s) => s.id === BOSS_BAR_STYLE_ID).length, 1, 'the sheet, once');
  assert.equal(styles[0].textContent, BOSS_BAR_CSS);
  for (const c of ['wb-boss-bar', 'wb-boss-name', 'wb-boss-track', 'wb-boss-fill', 'wb-boss-mark', 'wb-boss-ward', 'wb-boss-callout', 'wb-boss-foot']) {
    assert.match(BOSS_BAR_CSS, new RegExp(`\\.${c} \\{`), c);
    assert.match(ONLINE_DRESS_CSS, new RegExp(`body \\.${c}\\b`), `${c} is dressed under Plus`);
  }
  destroyGateBossBar();
  destroyGateBanner();
  drawGateBanner('Oblivion Gate - opens in 3:12', { doc });
  drawGateBanner('Oblivion Gate - opens in 3:11', { doc });
  const banner = made.at(-1);
  assert.equal(banner.className, 'wb-gate-banner');
  assert.equal(banner.style.cssText, undefined);
  assert.equal(styles.filter((s) => s.id === GATE_BANNER_STYLE_ID).length, 1);
  assert.match(GATE_BANNER_CSS, /\.wb-gate-banner \{ position: fixed;/);
  destroyGateBanner();
});
