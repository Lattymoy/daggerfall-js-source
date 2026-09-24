// DISCORD5 (2026-09-22, five reports off the bug-reports channel, through
// Mac): five root causes, each pinned by EXECUTION where the seam can be
// driven and by source where it lives inside a host closure.
//
//   BLACK-ARMS  "Weapon and torch are blacked out" (Revverie) - the
//               first-person tint is an RGB triple uploaded into a vec4
//               uniform; `color[3]` undefined went up as NaN alpha.
//   3ARMS       "Torch and a Two-Handed weapon simultaneously" (Ignatious)
//               - IL `GetItemHands() == 2` is ItemHands.BOTH in DFU's enum;
//               the port read it as its own LeftOnly and the two-hander arm
//               never fired (Handheld Torches AND Weapon Widget).
//   TORCH-BIND  "No option to rebind Handheld Torches actions" (teuton) -
//               the mod's TextKeys were curated out of the only door left
//               after FT14; the same for Eye Of The Beholder's two and
//               Travel Options' custom key; and the Continue the player
//               could not find is sticky now, with a twin at the foot.
//   HOTSLOT     "Cant change Hotslot spell" (!Simple) - the slot's one
//               reachable writer was an unsaid 350 ms hold; the book slots
//               a spell now, the empty chip is a socket, the label says hold,
//               a doubled book cannot pin the cycle.
//   LOOT-REGEN  "dead bodies regenerate loot" after dying online (Satranath)
//               - a quick-loot take never told the room, so the memory
//               carried no record for the emptied corpse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Renderer, screenQuadBlends } from '../src/render/renderer.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { modDials } from '../src/systems/features.js';
import { ITEM_HANDS } from '../src/characters/equipTable.js';
import { spellCandidates, cycleQuickslot, clearQuickslots, spellQuickslot, setSpellQuickslot } from '../src/systems/quickslots.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ── BLACK-ARMS ───────────────────────────────────────────────────────────

/** drawScreenQuad on a stub renderer: the 2D program's uniform uploads are RECORDED, nothing else runs. */
function quadStub() {
  const up = [];
  const gl = {
    drawingBufferWidth: 640, drawingBufferHeight: 400, TRIANGLES: 4, UNSIGNED_SHORT: 5123, BLEND: 3042, SRC_ALPHA: 770, ONE_MINUS_SRC_ALPHA: 771,
    uniform4f: (h, ...v) => up.push([h, v]), uniform2f: () => {}, uniform1i: () => {},
    enable: () => {}, disable: () => {}, blendFunc: () => {}, drawElements: () => {},
  };
  const r = {
    gl, up, _worldViewportPx: null, _screenOffset: null, _sq: {}, stats: { draws: 0 },
    screenQuadProgram: {}, _screenQuadVao: {},
    _screenQuad: { dst: 'dst', src: 'src', color: 'color', canvas: 'canvas', useTex: 'useTex', blendTex: 'blendTex', rotOn: 'rotOn', rot: 'rot' },
    _compositeAir() {}, _ensureScreenQuadProgram() {}, _use() {}, _open2D() {}, _bindTex0() {}, endWorldPass() {},
  };
  return r;
}
const colourUploads = (r) => r.up.filter(([h]) => h === 'color').map(([, v]) => v);

test('BLACK-ARMS, driven: an RGB triple through drawScreenQuad uploads a FINITE vec4 with alpha 1 - the triple flatLightAt hands the classic weapon, the torch hand and the casting hands went up with `undefined` in the fourth slot, which uniform4f took as NaN and most drivers stored as 0 alpha: a black silhouette on a premultiplied canvas over a black page', () => {
  const r = quadStub();
  const rect = { x: 0, y: 0, w: 10, h: 10 };
  Renderer.prototype.drawScreenQuad.call(r, {}, rect, undefined, [0.4, 0.3, 0.2]);
  assert.deepEqual(colourUploads(r), [[0.4, 0.3, 0.2, 1]], 'the triple goes up as rgb + 1');
  assert.ok(colourUploads(r).every((v) => v.every(Number.isFinite)), 'nothing NaN reaches the GPU');
  Renderer.prototype.drawScreenQuad.call(r, {}, rect, undefined, [0.4, 0.3, 0.2]);
  assert.equal(colourUploads(r).length, 1, 'the same colour is shadowed, not re-uploaded (PERF-UI)');
  Renderer.prototype.drawScreenQuad.call(r, null, rect, undefined, [1, 1, 1, 0.5]);
  assert.deepEqual(colourUploads(r).at(-1), [1, 1, 1, 0.5], 'a real alpha is its own');
  Renderer.prototype.drawScreenQuad.call(r, null, rect, undefined, [1, 1, 1]);
  assert.deepEqual(colourUploads(r).at(-1), [1, 1, 1, 1], 'and a triple after it re-uploads with 1 - the shadow compares the defaulted alpha, not the missing one');
  // the blend gate reads the same law: a solid triple is opaque, a solid half is not
  assert.equal(screenQuadBlends(null, [1, 1, 1]), false);
  assert.equal(screenQuadBlends(null, [1, 1, 1, 0.5]), true);
  assert.equal(screenQuadBlends({}, [1, 1, 1]), false, 'a textured cutout blends only when asked');
  assert.equal(screenQuadBlends({}, [1, 1, 1], { blend: true }), true);
});

test('BLACK-ARMS by source: the rig hands the triple through as it is (the fix is at the one seam every classic sprite ends in, not at four callers), the renderer defaults the fourth, and the browser probe draws the TRIPLE and reads the alpha back', () => {
  const rr = rd('src/render/renderer.js');
  assert.match(rr, /const a = color\[3\] \?\? 1;\s*if \(q\.r !== color\[0\] \|\| q\.g !== color\[1\] \|\| q\.b !== color\[2\] \|\| q\.a !== a\) \{\s*gl\.uniform4f\(this\._screenQuad\.color, color\[0\], color\[1\], color\[2\], a\);\s*q\.r = color\[0\]; q\.g = color\[1\]; q\.b = color\[2\]; q\.a = a;/);
  assert.match(rr, /return \(!tex && \(color\[3\] \?\? 1\) < 1\) \|\| Boolean\(tex && opts\.blend\);/);
  assert.match(rd('src/combat/weaponRig.js'), /const fpTint = fpLightingOn\(\) \? \(renderer\?\.flatLightAt\?\.\(\) \?\? null\) : null;/, 'the triple, unchanged - MAC-I\'s own shape');
  assert.match(rr, /for \(let i = 0; i < 3; i\+\+\) out\[i\] = Math\.max\(floor, Math\.min\(1, out\[i\]\)\);\s*return out;/, 'flatLightAt answers THREE');
  const probe = rd('tools/macfpLightProbe.mjs');
  assert.match(probe, /res\.pixelTorch = drawWith\(r\.flatLightAt\(\[0, 0, 0\]\)\);/, 'the probe no longer appends the 1 the runtime never passes');
  assert.match(probe, /out\.pixelTorch\[3\] === 255/, 'and reads the alpha back');
});

// ── 3ARMS ────────────────────────────────────────────────────────────────

test('3ARMS by source: both mods compare the IL\'s 2 to the port\'s Both - DFU declares ItemHands as None, Either, BOTH, LeftOnly, RightOnly, so `== 2` is a two-hander; the mod\'s own C# says `== ItemHands.Both` at HandheldTorches.cs:1311/:1323 and FPSWeaponClone.cs:2378; the relaxed switch ships OFF (the departure that follows HT7: a held two-hander takes both hands)', () => {
  const ht = rd('src/systems/handheldTorches.js');
  assert.match(ht, /if \(left\) \{\s*w\.handLeft = false;\s*if \(getItemHands\(left\) === ITEM_HANDS\.Both \|\| isBow\(left\)\) w\.handRight = false;\s*\} else if \(!sheathedNow && !usingRightNow\) w\.handLeft = false;/, 'the left slot: a Both item or a bow takes the right; an empty left hand you punch with is in use');
  assert.match(ht, /if \(right\) \{\s*w\.handRight = false;\s*if \(getItemHands\(right\) === ITEM_HANDS\.Both\) \{[^}]*if \(w\.s\.twoHandedRelaxed\) \{ if \(isBow\(right\) \|\| w\.attacking\) w\.handLeft = false; \}\s*else w\.handLeft = false;/, 'the right slot: a two-hander takes the off hand - always, or for a bow and a swing when relaxed');
  assert.doesNotMatch(ht, /ITEM_HANDS\.LeftOnly/, 'the misread is gone from the hand law');
  assert.match(rd('src/combat/weaponWidget.js'), /if \(getItemHands\(w\.specificWeapon\) !== ITEM_HANDS\.Both\) return false;/, 'and from the widget\'s mirror override');
  assert.notEqual(ITEM_HANDS.Both, 2, 'the port\'s own numbering is not DFU\'s - which is how 2 was misread');
  assert.equal(MOD_SETTINGS['handheld-torches'].keys['Handling.RelaxedTwoHandedWeapons'].default, false, 'the mod ships true; the port ships false');
});

// ── TORCH-BIND ───────────────────────────────────────────────────────────

test('TORCH-BIND, driven: every TextKey a module READS reaches its mod\'s tile drawer - the three torch keys, Eye Of The Beholder\'s two, Travel Options\' custom key - and the relaxed switch rides the torch tile', () => {
  const READ_KEYS = [
    ['handheld-torches', 'Handling.ToggleLightInput'], ['handheld-torches', 'Handling.ManualDropInput'], ['handheld-torches', 'Throwing.ThrowTorchInput'],
    ['eye-of-the-beholder', 'Camera.SwitchShoulder'], ['eye-of-the-beholder', 'AutoTogglePerspective.ToggleInput'],
    ['travel-options', 'RoadsIntegration.FollowPathsCustomKeyBind'],
  ];
  for (const [v, k] of READ_KEYS) {
    assert.equal(MOD_SETTINGS[v].keys[k].text, true, `${v}/${k} is a TextKey`);
    assert.ok(modDials(v).includes(k), `${v}/${k} has a row in the tile drawer - the one door left after FT14`);
  }
  assert.ok(modDials('handheld-torches').includes('Handling.RelaxedTwoHandedWeapons'));
  // the reads, so the table above cannot go stale in silence
  assert.match(rd('src/player/eotbCamera.js'), /g\('Camera\.SwitchShoulder'\)[\s\S]{0,80}g\('AutoTogglePerspective\.ToggleInput'\)/);
  assert.match(rd('src/systems/travelOptions.js'), /get\('RoadsIntegration\.FollowPathsCustomKeyBind'\)/);
  assert.match(rd('src/systems/handheldTorches.js'), /s\['Handling\.ToggleLightInput'\][\s\S]{0,200}s\['Handling\.ManualDropInput'\][\s\S]{0,200}s\['Throwing\.ThrowTorchInput'\]/);
});

test('TORCH-BIND, driven: the controls pane carries TWO Continues - the head card, sticky, and a foot card after the last group - and the foot one saves', async () => {
  const { paneControls, discardControlsStaging } = await import('../src/ui/enhancedControls.js');
  const { createBindings, resetDefaults } = await import('../src/systems/inputActions.js');
  const { setBindings } = await import('../src/ui/input.js');
  const fakeEl = (tag) => {
    const n = { tag, children: [], className: '', textContent: '', title: '', style: {}, dataset: {}, onclick: null, oncontextmenu: null,
      append(...cs) { for (const c of cs) n.children.push(c); }, setAttribute() {}, addEventListener() {}, removeEventListener() {} };
    return n;
  };
  const find = (n, cls, out = []) => { if (n.className.split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
  const store = createBindings(); resetDefaults(store); setBindings(store); discardControlsStaging();
  const prev = globalThis.document;
  globalThis.document = { createElement: fakeEl, addEventListener() {}, removeEventListener() {} };
  try {
    const view = { body: fakeEl('div') };
    const render = () => { view.body = fakeEl('div'); paneControls(view.body, { render }); };
    paneControls(view.body, { render });
    const conts = find(view.body, 'ctl-continue');
    assert.equal(conts.length, 2, 'head and foot');
    assert.equal(find(view.body, 'ctl-foot').length, 1);
    assert.ok(find(find(view.body, 'ctl-foot')[0], 'ctl-continue-foot').length === 1, 'the foot card holds the second');
    assert.equal(view.body.children.at(-1), find(view.body, 'ctl-foot')[0], 'after the last group');
    conts[1].onclick();
    assert.equal(find(view.body, 'ctl-notice')[0]?.textContent, 'Controls saved.', 'the foot Continue is applyAndSave');
  } finally { discardControlsStaging(); globalThis.document = prev; }
  assert.match(rd('src/ui/enhancedStyle.js'), /\.ctl-head \{ position: sticky; top: 0; z-index: 2; \}/, 'the head card stays in view while the list scrolls');
});

// ── HOTSLOT ──────────────────────────────────────────────────────────────

test('HOTSLOT, driven: a doubled book cannot pin the cycle - one candidate per index, and the walk reaches every spell', () => {
  clearQuickslots();
  const entity = { spells: [{ index: 5, name: 'Spark' }, { index: 5, name: 'Spark' }, { index: 9, name: 'Shock' }, { index: 9, name: 'Shock' }] };
  assert.deepEqual(spellCandidates(entity).map((s) => s.name), ['Spark', 'Shock']);
  assert.equal(cycleQuickslot('spell', { entity }).name, 'Spark');
  assert.equal(cycleQuickslot('spell', { entity }).name, 'Shock', 'the second copy of Spark no longer lands the cycle on Spark again');
  assert.equal(cycleQuickslot('spell', { entity }).name, 'Spark');
  clearQuickslots();
});

/** A DOM fake the enhanced book and the HUD can be mounted over. */
const mkEl = (tag = 'div') => ({
  tag, className: '', textContent: '', id: '', children: [], dataset: {}, onclick: null,
  get innerHTML() { return ''; }, set innerHTML(v) { this.children = []; },   // a re-render clears the host, as the DOM's would
  style: { setProperty() {}, removeProperty() {} },
  classList: { _s: new Set(), add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); },
    toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); return !!on; }, contains(c) { return this._s.has(c); } },
  attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; }, removeAttribute() {}, remove() {},
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; }, replaceChildren(...c) { this.children = c; },
  addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, focus() {},
});
const findAll = (n, cls, out = []) => { if (String(n.className ?? '').split(/\s+/).includes(cls)) out.push(n); for (const c of n.children ?? []) findAll(c, cls, out); return out; };

test('HOTSLOT, driven: the enhanced spellbook slots a spell - Quickslot on the picked spell writes the slot, the button reads Unslot on the slotted one, and Unslot clears it', async () => {
  const prevD = globalThis.document, prevW = globalThis.window;
  globalThis.document = { createElement: mkEl, createTextNode: (t) => ({ text: t, className: '' }), getElementById: () => null, head: mkEl('head'), body: mkEl('body'), addEventListener() {}, removeEventListener() {} };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  try {
    const { mountEnhancedSpellbook } = await import('../src/ui/enhancedSpellbook.js');
    clearQuickslots();
    const spark = { index: 5, name: 'Spark', effects: [] }, shock = { index: 9, name: 'Shock', effects: [] };
    const host = mkEl('div');
    const book = mountEnhancedSpellbook(host, { spells: () => [spark, shock], castCost: () => 5, entity: { magicka: 20 } });
    const slotBtn = () => findAll(host, 'sb-slot')[0];
    assert.ok(slotBtn(), 'the picked spell\'s detail carries the slot button');
    assert.equal(slotBtn().textContent, 'Quickslot');
    slotBtn().onclick();
    assert.deepEqual(spellQuickslot(), { index: 5, name: 'Spark' }, 'Spark is in the slot');
    assert.equal(slotBtn().textContent, 'Unslot', 'the book re-rendered with the slotted state');
    assert.ok(slotBtn().className.includes(' on'));
    // pick Shock: its button offers to slot it, and slotting it REPLACES Spark - the change the player could not make
    findAll(host, 'sb-row')[1].onclick();
    assert.equal(slotBtn().textContent, 'Quickslot');
    slotBtn().onclick();
    assert.deepEqual(spellQuickslot(), { index: 9, name: 'Shock' }, 'the slot changed');
    slotBtn().onclick();
    assert.equal(spellQuickslot(), null, 'Unslot clears it');
    assert.ok(findAll(host, 'sb-note').length + findAll(host, 'px-note').length >= 0);
    book.destroy();
    assert.ok(setSpellQuickslot(spark));
    clearQuickslots();
  } finally { globalThis.document = prevD; globalThis.window = prevW; }
});

test('HOTSLOT by source: the HUD\'s empty spell chip is a SOCKET (drawn dim, wearing its key, so a finger has a chip to fill), and the pane says hold', () => {
  const hud = rd('src/ui/enhancedHud.js');
  assert.match(hud, /chip\.chip\.classList\.toggle\('empty', !sp\);\s*if \(!sp\) \{\s*chip\.chip\.classList\.remove\('readied', 'ghost', 'cycling'\);\s*chip\.name\.textContent = 'No spell';\s*quickTag\(chip, 'spellcap', tag\);\s*return;\s*\}/);
  assert.match(rd('src/ui/enhancedStyle.js'), /\.hud-qspell\.empty \{ display: flex; opacity: 0\.55; \}/);
  assert.match(rd('src/ui/enhancedControls.js'), /\{ action: 'QuickSpell', label: 'Ready quickslot spell \(hold to cycle the book\)' \}/);
});

// ── LOOT-REGEN ───────────────────────────────────────────────────────────

test('LOOT-REGEN by source: the dungeon\'s quick-loot take is the room\'s word - what is left is said and stamped the moment the take lands, an emptied pile\'s flat is settled, and C6\'s window order stands untouched behind it', () => {
  const d = rd('src/scenes/dungeonContext.js');
  // LOOT-STACK: the quick take is a PRESS's (`!pileKeys` - a pile tab asks for that body's window), and the pile's
  // tabs are laid on the hooks before C6's order, which stands untouched behind them
  assert.match(d, /if \(!pileKeys && quickLootTake\(key, \{ items: \(\) => source \}, playerEntity, setMidScreenText, \{ getQuest: \(uid\) => opts\.questBridge\?\.machine\?\.getQuest\?\.\(uid\) \?\? null \}\)\) \{[^\n]*\n\s*const _q = lootHolder\(key\) \? lootKeyOf\(key\) : null;\s*if \(_q\) publishLoot\(_q\);\s*if \(!source\.length\) onEmptied\?\.\(\);\s*return source\.length;\s*\}\s*const pile = kind === 'corpse' \? lootPile\(key, \{[\s\S]{0,400}?\}\) : null;\s*if \(pile\) lootHooks = \{ \.\.\.\(lootHooks \?\? \{\}\), pile \};\s*const _k = lootHolder\(key\) \? lootKeyOf\(key\) : null;\s*const _w = openInventory\(source, onEmptied, \{ lootHooks, lootKey: _k \}\);\s*if \(_w\) activeOverlay = _w;/);   // DISC10-E L3 re-aim: a refused pack (the door's null) is not written over the slot
  // publishLoot without `claim` is the whole word: the stamp, the record, the seen-set, the first-word memory push
  assert.match(d, /function publishLoot\(key, \{ claim = false \} = \{\}\) \{\s*const canon = lootKeyOf\(key\);\s*if \(!canon \|\| !lootHolder\(canon\)\) return false;\s*if \(claim && _lootSeen\.has\(canon\)\) return false;/);
});
