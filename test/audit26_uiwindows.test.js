// AUDIT 26 - the UI-windows cluster, first half (F136-F146).
//
// F136 guild popup backdrop clear, not black; F137 bank purchase
// panel centred (the Position literal is dead under Middle); F138
// the purchase list closes BEFORE the result box, which is the
// BANKING window's; F139 the nameplate easy-pair fallback places the
// first plate on its own check and talks the partner's count down;
// F140 bank EXIT is a no-op while an amount is typed; F141/F145/F146
// the ButtonClick roster (guild + tavern click, teleport silent);
// F142 the price list's 8-pixel row pitch; F143 the room-rental
// chain lands back on the tavern panel; F144 the 99-hour refusal
// lands on the selection page and a retry re-runs the gate.
//
// The flow reshapes (F138/F143/F144) are pinned in their own suites
// (houses, tavernwindow, restlodging - the old pins there had
// encoded the bugs and were rewritten); this file pins what those
// do not: the literals, the backdrop, the sound roster, and F139's
// discriminating geometry.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PURCHASE_PANEL_Y, PURCHASE_PANEL_H, LIST_ROW_H } from '../src/ui/bankPurchaseWindow.js';
import { resolveNameplates } from '../src/ui/nameplateLayout.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

// ── F136 ──────────────────────────────────────────────────────────

test('F136: the guild service popup dims clear - the room stays visible', () => {
  // The ctor's own override (DaggerfallGuildServicePopupWindow.cs:99)
  // + the hard-clear ScreenDimColor (DaggerfallPopupWindow.cs:26-34).
  const s = src('ui/guildServiceWindow.js');
  assert.ok(s.includes('drawScreenDimBackdrop(renderer, canvas);'), 'the clear backdrop');
  assert.equal(s.includes('drawMenuBackdrop'), false, 'the opaque black is gone');
});

// ── F137 / F142 ───────────────────────────────────────────────────

test('F137: the purchase panel is CENTRED - 36, not the dead Position 50', () => {
  // VerticalAlignment.Middle ignores position.y
  // (BaseScreenComponent.cs:1234-1236): (200-129)/2 = 35.5 -> 36.
  assert.equal(PURCHASE_PANEL_H, 129);
  assert.equal(PURCHASE_PANEL_Y, 36);
});

test('F142: the price list row pitch is GlyphHeight + rowSpacing = 8', () => {
  // ListBox.cs:327 (draw) and :434 (hit) - FONT0003 fixedHeight 7
  // plus the default rowSpacing 1; never a size/count division.
  assert.equal(LIST_ROW_H, 8);
});

// ── F139 ──────────────────────────────────────────────────────────

test('F139: the 2x fallback places the first plate ALONE and the partner re-places at its original spot', () => {
  // ExteriorAutomap.cs:1230-1240: first commits on ITS OWN check;
  // second is probed at zero against first's NEW spot (:1236-1239);
  // :1274-1275 talks second's count down even when second stayed
  // unplaced, and the no-recompute re-place pass (:1317-1318) then
  // fixes second at its untouched offset with NO fresh check - DFU's
  // own accepted overlap.
  //
  // Geometry (all x 0, w 40, h 10): pair a(50)/b(54) resolves first,
  // arm 1, shifting b to 57. Pair p(74)/q(65): the half-shift probe
  // of q (64.5) hits placed b (57), so arm 1 fails; p's own 2x
  // (+1 -> 75) clears everything, so p places ALONE; q at zero (65)
  // still hits b (8 < 10), stays unplaced, count falls to 0, and the
  // re-place pass fixes q at 0. The OLD conjoined code placed
  // neither, hopped p a full height (+10) and surrendered q as "*".
  const plates = [
    { x: 0, y: 50, w: 40, h: 10 },   // a
    { x: 0, y: 54, w: 40, h: 10 },   // b
    { x: 0, y: 74, w: 40, h: 10 },   // p
    { x: 0, y: 65, w: 40, h: 10 },   // q
  ];
  const out = resolveNameplates(plates);
  assert.equal(out[0].offY, -3, 'a: arm 1 half-shift');
  assert.equal(out[1].offY, 3, 'b: arm 1 half-shift');
  assert.equal(out[2].offY, 1, 'p: its OWN 2x bias, not the whole-height hop');
  assert.equal(out[3].offY, 0, 'q: re-placed at its ORIGINAL spot, unchecked');
  assert.ok(out.every((o) => !o.replaced), 'nobody surrenders a "*"');
});

test('F139: a zero-count partner triggers NEITHER arm - the else is `else if (> 1)`', () => {
  // :1277 - structural: the C# has no arm for
  // second.numCollisionsDetected == 0, so the port must not run the
  // entangled hop against a partner whose count was already talked
  // down. (The state is reachable only mid-pass, between the pair
  // arm's decrement and the re-place sweep.)
  const s = src('ui/nameplateLayout.js');
  assert.ok(s.includes('} else if (q.count > 1) {'), 'the entangled arm is count > 1, not a bare else');
  assert.ok(s.includes('if (p.placed) q.count--;'), 'the one post-chain decrement, keyed on p alone');
});

// ── F140 ──────────────────────────────────────────────────────────

test('F140: bank EXIT clicks are a no-op while an amount is typed', () => {
  // ExitButton_OnMouseClick (:473-478): sound always, close only when
  // !transactionInput.Enabled.
  const s = src('ui/bankWindow.js');
  const arm = s.slice(s.indexOf('BANK_RECTS.exit'));
  assert.ok(arm.slice(0, 500).includes("if (this.transactionType === TRANSACTION_TYPE.None) this._close();"),
    'the exit click gates on the open field, like the Escape path always did');
});

// ── F141 / F145 / F146 ────────────────────────────────────────────

test('F141/F145: the guild and tavern buttons all click; F146: the teleport Yes/No stay silent', () => {
  const guild = src('ui/guildServiceWindow.js');
  // four handlers, four sounds (Join :501, Talk :293, Service :457, Exit :477)
  const guildClick = guild.slice(guild.indexOf('click(vx, vy)'));
  assert.equal((guildClick.match(/audio\.playOneShot\(SOUND\.ButtonClick, 1\);/g) ?? []).length, 4);

  const tavern = src('ui/tavernWindow.js');
  // four buttons (:135, :155, :264, :339) + the food picker (:307)
  assert.equal((tavern.match(/audio\.playOneShot\(SOUND\.ButtonClick, 1\);/g) ?? []).length, 5);

  // DaggerfallTeleportPopUp sets no ClickSound and plays nothing
  // (:116-119, :153-156) - the port had invented a click on both.
  const tp = src('ui/teleportPopUp.js');
  assert.equal(tp.includes('playOneShot'), false);
  assert.equal(tp.includes("from '../systems/audio.js'"), false);
});

test('F138: the click sound fires BEFORE the no-selection guard', () => {
  // BuyButton_OnMouseClick :382-384 - PlayOneShot first, then
  // `if (SelectedIndex < 0) return;`. A dead-feeling button still
  // clicks.
  const s = src('ui/bankPurchaseWindow.js');
  const buy = s.slice(s.indexOf('_buy() {'));
  const sound = buy.indexOf('audio.playOneShot(SOUND.ButtonClick, 1);');
  const guard = buy.indexOf('if (this.selected < 0) return;');
  assert.ok(sound > 0 && guard > 0 && sound < guard, 'sound, then guard');
});

test('F139: the partner is probed, not presumed - premature placement would deflect a later pair', () => {
  // The :1236-1239 probe is REAL: q must stay unplaced when its zero
  // check fails, staying invisible to later pairs' clearOfPlaced
  // probes until the re-place sweep. Mixed widths make it observable:
  // the column at x=85 (w 10) sees the wide q (x 50, w 40) but not
  // its narrow blocker b (w 10). If q were placed unchecked, the w/z
  // pair's arm-1 probe (z at 58) would hit q at 65 and deflect w to
  // its 2x offset (-6) with z at 0; with the real probe, q is still
  // unplaced there and w/z part cleanly at -3/+3.
  const plates = [
    { x: 50, y: 50, w: 10, h: 10 },   // a
    { x: 50, y: 54, w: 10, h: 10 },   // b - q's blocker, narrow
    { x: 50, y: 74, w: 40, h: 10 },   // p
    { x: 50, y: 65, w: 40, h: 10 },   // q - wide, visible to x=85
    { x: 85, y: 51, w: 10, h: 10 },   // w
    { x: 85, y: 55, w: 10, h: 10 },   // z
  ];
  const out = resolveNameplates(plates);
  assert.equal(out[2].offY, 1, 'p: its own 2x');
  assert.equal(out[3].offY, 0, 'q: re-placed at original');
  assert.equal(out[4].offY, -3, 'w: arm 1 - q was invisible to its probe');
  assert.equal(out[5].offY, 3, 'z: arm 1');
  assert.ok(out.every((o) => !o.replaced));
});
