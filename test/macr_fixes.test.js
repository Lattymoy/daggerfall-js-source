import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { perspective } from '../src/world/mat4.js';
import { FP_TOP_PAD, FP_FIELD_OF_VIEW, frustum } from '../src/combat/fpArm.js';
import { offHandQuickslot, quickslotView, assignQuickslot, clearQuickslots, QUICKSLOT_TEXT } from '../src/systems/quickslots.js';
import { TEMPLATES } from '../src/systems/useItem.js';
import { EQUIP_SLOTS } from '../src/characters/paperdoll.js';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { withDom } from './invdrag.mjs';

// ═══ MAC-R (2026-09-17): FOUR UNRELATED BUGS, MAC'S LIST ═══════════
//
//   1. "Morrowind weapons that go above the screen show their blade
//      clipped off" - the arm's frame was exactly the screen and the
//      Weapon Widget's bob shifted the COMPOSITE down, so the frame's
//      top edge cut a raised blade. MAC-R1: the frame is padded above
//      the screen while a transform is set (an off-centre frustum over
//      the same lens), and the composite is extended up by the same
//      share.
//   2. "The enhanced quickbar sometimes shows double messages" - a held
//      key auto-repeats its keydown, and the two quickslot actions that
//      are not polled (swap, off hand) were routed on every repeat: two
//      lines, a net nothing. MAC-R2: the press edge alone.
//   3. "Tapping the equip hand in the quickbar doesn't switch to your
//      other weapon in hand (still bound to H). Even if a torch isn't
//      equipped a message still shows up that you can't light the
//      torch" - MAC-R3: a hand cell's own act is DFU's SwitchHand; the
//      off cell presses what it SHOWS in full, and the light's refusal
//      is said only where no hand can be switched.
//   4. "Hold to drag in the enhanced inventory sometimes doesn't work
//      properly" - MAC-R4: the implicit touch capture is given back at
//      the press so a repaint's `lostpointercapture` cannot end the
//      session, the long-press menu is refused, and iOS's callout too.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

// ── MAC-R1 ───────────────────────────────────────────────────────
const apply = (m, v) => {
  const o = [0, 0, 0, 0];
  for (let r = 0; r < 4; r++) o[r] = m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3];
  return o;
};
const ndcY = (m, p) => { const c = apply(m, [p[0], p[1], p[2], 1]); return c[1] / c[3]; };

test('MAC-R1: the padded frame is the same lens with its top edge raised - the screen keeps its bottom and its scale, the pad sees above it, and no pad is exactly perspective', () => {
  const near = 0.2, far = 400, aspect = 1.6;
  const hh = near * Math.tan(FP_FIELD_OF_VIEW / 2), hw = hh * aspect;
  const p = FP_TOP_PAD;
  assert.equal(p, 0.5, 'half a screen above: the widget clamps its shift under one screen height');
  const sym = perspective(FP_FIELD_OF_VIEW, aspect, near, far);
  const same = frustum(-hw, hw, -hh, hh, near, far);
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(sym[i] - same[i]) < 1e-9, `frustum's symmetric case is perspective (element ${i})`);
  const padded = frustum(-hw, hw, -hh, hh * (1 + 2 * p), near, far);
  const k = 7;   // any depth
  assert.ok(Math.abs(ndcY(padded, [0, -hh * k, -near * k]) - (-1)) < 1e-6, 'the screen\'s bottom edge is still NDC -1');
  assert.ok(Math.abs(ndcY(padded, [0, hh * k, -near * k]) - (1 - p) / (1 + p)) < 1e-6, 'the screen\'s top edge lands at (1-p)/(1+p): the screen is the bottom 1/(1+p) of the frame');
  assert.ok(Math.abs(ndcY(padded, [0, hh * (1 + 2 * p) * k, -near * k]) - 1) < 1e-6, 'and the frame\'s top is 2p half-heights above it');
  // the same pixel scale: the screen's own two edges span 2/(1+p) of NDC over ph of phFull = ph(1+p) rows
  const ph = 300, phFull = Math.round(ph * (1 + p));
  const rowsOfScreen = ((ndcY(padded, [0, hh * k, -near * k]) - ndcY(padded, [0, -hh * k, -near * k])) / 2) * phFull;
  assert.ok(Math.abs(rowsOfScreen - ph) < 1e-3, `the screen occupies ${ph} of ${phFull} rows`);
  const src = read('src/combat/fpArm.js');
  const draw = src.slice(src.indexOf('    draw(canvas)'), src.indexOf('    status()'));
  assert.match(draw, /const padFrac = screenTransform \? FP_TOP_PAD : 0;/, 'padded only under a transform - the fullscreen overlay path is untouched');
  assert.match(draw, /const s = Math\.min\(1, CHAR_SPRITE_RT_SIZE \/ wantW, CHAR_SPRITE_RT_SIZE \/ \(wantH \* \(1 \+ padFrac\)\)\);/, 'the RT cap counts the pad');
  assert.match(draw, /const pad = Math\.round\(ph \* padFrac\);[^\n]*\n\s*const phFull = ph \+ pad;/);
  assert.match(draw, /const proj = pad > 0 \? frustum\(-hw, hw, -hh, hh \* \(1 \+ 2 \* padFrac\), near, far\) : perspective\(FP_FIELD_OF_VIEW, pw \/ ph, near, far\);/);
  assert.match(draw, /renderCharacterSprite\(mesh, NIF_TO_PASS, proj, view, pw, phFull,/, 'the pass renders the padded rows');
  assert.match(draw, /const up = rect\.h \* padFrac;\s*\n\s*renderer\.drawScreenQuad\(tex, \{ x: rect\.x, y: rect\.y - up, w: rect\.w, h: rect\.h \+ up \}, \{ u0: 0, v0: phFull \/ CHAR_SPRITE_RT_SIZE, u1: pw \/ CHAR_SPRITE_RT_SIZE, v1: 0 \}\);/, 'the composite is the screen\'s rect extended UP by the pad\'s share, sampling the whole padded sub-rect');
  assert.match(draw, /renderer\.drawScreenOverlayQuad\(tex, pw \/ CHAR_SPRITE_RT_SIZE, ph \/ CHAR_SPRITE_RT_SIZE\);/, 'no transform: the overlay is the screen, as it was');
});

// ── MAC-R2 ───────────────────────────────────────────────────────
test('MAC-R2: a held quickslot key\'s auto-repeat is nothing - routeKey swallows it, and the two self-routing hosts\' arms route the press edge alone', () => {
  const inp = read('src/ui/input.js');
  assert.match(inp, /if \(POLLED_ACTIONS\.has\(act\)\) return false;\s*\n(?:\s*\/\/[^\n]*\n)*\s*if \(e\.repeat && act\) return true;\s*\n\s*return routeAction\(act, ctx, setPlayerPos\);/, 'the repeat is swallowed before the table - AUDIT KB1: every routed action\'s, not the quickslots\' alone');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = read(host);
    assert.match(h, /QUICKSLOT_ACTIONS\.has\(act\) && !POLLED_ACTIONS\.has\(act\) && [^\n]*\) \{ if \(!e\.repeat && routeAction\(act, hudCtx\)\) \{ e\.preventDefault\(\); return; \} if \(e\.repeat\) \{ e\.preventDefault\(\); return; \} \}/, `${host}: the press routes, the repeat is eaten`);
  }
});

// ── MAC-R3 ───────────────────────────────────────────────────────
const torch = () => ({ group: 'UselessItems2', templateIndex: TEMPLATES.Torch, currentCondition: 50, maxCondition: 50 });
const shield = () => ({ group: 'Armor', templateIndex: 109 });
const sword = () => ({ group: 'Weapons', templateIndex: 120, currentCondition: 50, maxCondition: 50 });
const hero = () => ({ items: [], equip: { slots: {} }, lightSource: null });
const doors = () => {
  const said = [], calls = [];
  return { said, calls, say: (l) => said.push(l), toggleLight: () => { calls.push('light'); return true; }, switchHand: () => { calls.push('hand'); return true; } };
};

test('MAC-R3: the off-hand press is what the cell SHOWS - a lit light douses, a carried light ignites, the shield, the off-hand weapon and an empty hand with no light SWITCH HANDS, the swap is the caller\'s, and the refusal is said only where no hand can be switched', () => {
  clearQuickslots();
  // an empty off hand and no light anywhere: the other hand, silently
  let e = hero(); let d = doors();
  assert.equal(quickslotView(e).off.kind, 'empty');
  assert.deepEqual(offHandQuickslot({ entity: e, ...d }), { kind: 'hand' });
  assert.deepEqual(d.calls, ['hand']); assert.deepEqual(d.said, [], 'no "You have no light source." over a hand that can switch');
  // ...and the same press with no rig door says the line it always said
  d = doors();
  assert.deepEqual(offHandQuickslot({ entity: e, say: d.say, toggleLight: d.toggleLight }), { kind: 'none' });
  assert.deepEqual(d.said, [QUICKSLOT_TEXT.noLight]);
  // a torch in the pack, hand empty: the mod's ignite
  e = hero(); e.items.push(torch()); d = doors();
  assert.deepEqual(offHandQuickslot({ entity: e, ...d }), { kind: 'light', lit: false });
  assert.deepEqual(d.calls, ['light']);
  // a lit light: the douse
  e = hero(); const lit = torch(); e.items.push(lit); e.lightSource = lit; d = doors();
  assert.equal(quickslotView(e).off.kind, 'torch');
  assert.deepEqual(offHandQuickslot({ entity: e, ...d }), { kind: 'light', lit: true });
  assert.deepEqual(d.calls, ['light']);
  // a shield on the left: the other hand (the rig's own refusal when it is the shield hand)
  e = hero(); e.equip.slots[EQUIP_SLOTS.LeftHand] = shield(); d = doors();
  assert.equal(quickslotView(e).off.kind, 'shield');
  assert.deepEqual(offHandQuickslot({ entity: e, ...d }), { kind: 'hand' });
  assert.deepEqual(d.calls, ['hand']);
  d = doors(); d.switchHand = () => false;
  assert.deepEqual(offHandQuickslot({ entity: e, ...d }), { kind: 'refused' }, 'the rig refused: DFU\'s ToggleHand over a shield, silently');
  // a weapon on the left (a bow): the other hand - even with a torch in the pack, the cell shows the bow
  e = hero(); e.equip.slots[EQUIP_SLOTS.LeftHand] = sword(); e.items.push(torch()); d = doors();
  assert.equal(quickslotView(e).off.kind, 'weapon');
  assert.deepEqual(offHandQuickslot({ entity: e, ...d }), { kind: 'hand' });
  assert.deepEqual(d.calls, ['hand'], 'the bow in hand is what the cell shows, so the press is the hand, not the torch');
  // the swap: answered before this is asked, and untouched here
  e = hero(); const spare = sword(); e.items.push(spare); assignQuickslot('swap', spare); d = doors();
  assert.equal(quickslotView(e).off.kind, 'swap');
  assert.deepEqual(offHandQuickslot({ entity: e, ...d }), { kind: 'swap' });
  assert.deepEqual(d.calls, []);
  clearQuickslots();
});

test('MAC-R3 by source: the four hosts hand the rig\'s switchHand beside the light, the main cell\'s press is the hand switch through drawHud, and the diamond binds it once with no hold', () => {
  for (const [host, rig] of [['src/scenes/world.js', 'weaponRig'], ['src/scenes/exterior.js', 'weaponRig'], ['src/scenes/dungeonContext.js', 'weaponRig']]) {
    const h = read(host);
    assert.match(h, new RegExp(`offHandQuickslot\\(\\{ entity: playerEntity, say: [^\\n]*switchHand: \\(\\) => ${rig}\\.switchHand\\(\\), toggleLight: \\(\\) => ${rig}\\.toggleLight\\(\\) \\}\\);`), `${host}: the hand's door beside the light's`);
    assert.match(h, new RegExp(`const quickSwitchHand = \\(\\) => \\{ ${rig}\\.switchHand\\(\\); return true; \\};`), `${host}: the main cell's performer`);
    assert.match(h, /quickSpell: \(\) => quickSpell\(\), quickSwitchHand: \(\) => quickSwitchHand\(\),/, `${host}: handed to drawHud`);
  }
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /switchHand: \(\) => interiorWeapon\.switchHand\(\),[^\n]*\n\s*toggleLight: \(\) => interiorWeapon\.toggleLight\(\) \}\);/, 'the interior: THIS mode\'s rig');
  assert.match(wm, /quickSwitchHand\(\) \{ interiorWeapon\.switchHand\(\); return true; \},/);
  assert.match(wm, /quickSpell: \(\) => interiorKeyCtx\.quickSpell\(\), quickSwitchHand: \(\) => interiorKeyCtx\.quickSwitchHand\(\),/);
  const hud = read('src/ui/hud.js');
  assert.match(hud, /quickSpell = null, quickSwitchHand = null \} = \{\}\) \{/);
  assert.match(hud, /quickSwitchHand: quickSwitchHand \?\? null,/);
  const eh = read('src/ui/enhancedHud.js');
  assert.match(eh, /cells\.main\.cell\.addEventListener\('pointerdown', tap\(\(\) => \{ liveOpts\.quickSwitchHand\?\.\(\); \}\)\);/);
  assert.doesNotMatch(eh, /bindHold\(cells\.main/, 'no hold on the hand: what is in it is not a list');
  assert.match(eh, /if \(offKind === 'swap'\) liveOpts\.quickSwap\?\.\(\); else liveOpts\.quickOffHand\?\.\(\);/, 'the off cell still presses what it shows through the host');
});

// ── MAC-R4 ───────────────────────────────────────────────────────
const mkItem = (name, templateIndex, group = 'Weapons') => ({ name, templateIndex, group, stackCount: 1, currentCondition: 50, maxCondition: 50 });
function withPack(fn) {
  return withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items: [mkItem('Longsword', 120), mkItem('Dagger', 113), mkItem('Broadsword', 121)] };
    const dropped = [];
    mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, dropItem: (it) => dropped.push(it) });
    const rows = () => dom.doc.querySelectorAll('.itemrow');
    const ghost = () => dom.doc.querySelectorAll('.dragghost')[0] ?? null;
    return fn({ dom, e, rows, ghost });
  });
}

test('MAC-R4: a touch press gives the row\'s implicit capture back at once, nothing listens for its loss, the long-press menu is refused for the session\'s life, and a cancel still ends it', () => {
  withPack(({ dom, rows, ghost }) => {
    const row = rows()[0];
    const released = [];
    row.releasePointerCapture = (id) => released.push(id);
    row.onpointerdown({ pointerId: 7, button: 0, pointerType: 'touch', clientX: 10, clientY: 10 });
    assert.deepEqual(released, [7], 'the capture the browser granted at the press is released in the same handler');
    assert.equal(dom.win.count('lostpointercapture'), 0, 'no listener for a capture the session does not hold');
    assert.equal(dom.win.count('contextmenu'), 1, 'the long-press menu is watched');
    let prevented = 0;
    dom.win.fire('contextmenu', { cancelable: true, preventDefault: () => { prevented++; } });
    assert.equal(prevented, 1, 'and refused');
    dom.win.fire('lostpointercapture', { pointerId: 7 });
    dom.win.fire('pointercancel', { pointerId: 7 });
    assert.equal(ghost(), null);
    assert.equal(dom.win.count('contextmenu'), 0, 'the watch ends with the session');
    // a mouse press releases nothing - there is no implicit capture to give back
    released.length = 0;
    row.onpointerdown({ pointerId: 8, button: 0, pointerType: 'mouse', clientX: 10, clientY: 10 });
    assert.deepEqual(released, []);
    dom.win.fire('pointerup', { pointerId: 8, clientX: 10, clientY: 10 });
  });
  const css = read('src/ui/enhancedStyle.js');
  assert.match(css, /\.itemrow \{ touch-action: pan-y; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; \}/, 'iOS: no callout over a held tile');
  assert.match(css, /\.wornrow \{ touch-action: pan-y; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; \}/, 'nor over a held panel');
  const inv = read('src/ui/enhancedInventory.js');
  assert.doesNotMatch(inv, /addEventListener\?\.\('lostpointercapture'/, 'INV2\'s lost-capture end is retired');
  assert.match(inv, /const onDragMenu = \(e\) => \{ if \(drag && e\.cancelable\) e\.preventDefault\(\); \};/);
  assert.match(inv, /if \(touch\) \{ giveBack\(\); row\.addEventListener\?\.\('gotpointercapture', giveBack, \{ once: true \}\); \}/, 'given back now, and again if it is granted after');
  for (const probe of ['tools/macrHoldRepaintProbe.mjs', 'tools/macrHudTapProbe.mjs']) assert.ok(read(probe).length > 2000, `${probe} drives it in Chromium`);
});
