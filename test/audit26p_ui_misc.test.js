// AUDIT 26 PARITY, wave ui-misc. Seven laws the miscellaneous native
// windows had dropped, each pinned against the C# it is taken from:
//   F105 the tavern's two gold gates (DaggerfallTavernWindow.cs:218, :324)
//   F136 the guild popup's clear parent panel (:99)
//   F137 the bank purchase panel's Middle alignment (BaseScreenComponent.cs:1234-1236)
//   F138 BUY's unconditional CloseWindow (DaggerfallBankPurchasePopUp.cs:381-386)
//   F139 the nameplate pair-fallback arms (ExteriorAutomap.cs:1179-1185, :1230-1252, :1274-1277)
//   F143 the room flow returning to the panel (:153-171, :214)
//   F148/F149 the vitals indicators and the accessibility swap (HUDVitals.cs:41-46, :99-115, :179-198)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TavernWindow, TAVERN_RECTS, TAVERN_PANEL_X, TAVERN_PANEL_Y } from '../src/ui/tavernWindow.js';
import {
  BankPurchaseWindow, PURCHASE_PANEL_X, PURCHASE_PANEL_Y, PURCHASE_PANEL_H, PURCHASE_RECTS,
} from '../src/ui/bankPurchaseWindow.js';
import { TRANSACTION_RESULT, housePrice } from '../src/systems/banking.js';
import { resolveNameplates } from '../src/ui/nameplateLayout.js';
import { VideoPlayer } from '../src/ui/videoPlayer.js';
import {
  VitalsIndicators, VerticalProgressSmoother, SMOOTHER_TIMER_MAX,
  HEALTH_LOSS_COLOR, FATIGUE_LOSS_COLOR, MAGICKA_LOSS_COLOR,
  HEALTH_GAIN_COLOR, FATIGUE_GAIN_COLOR, MAGICKA_GAIN_COLOR,
} from '../src/ui/hud.js';
import { LETTER_OF_CREDIT_TEMPLATE } from '../src/systems/inventory.js';
import { totalGoldAmount, goldAmount } from '../src/systems/court.js';
import { TAVERN_PRICES, NOT_ENOUGH_GOLD_ID } from '../src/systems/tavern.js';
import { audio } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (p) => readFileSync(join(root, 'src', p), 'utf8');

// ---------------------------------------------------------------
// F105  the tavern gates are GetGoldAmount, not GoldPieces
// ---------------------------------------------------------------
const rows = (id) => [{ text: `#${id} %a gold`, center: true }];
const idOf = (box) => Number(/^#(\d+)/.exec(box?.rows?.[0]?.text ?? '')?.[1]);

/** A purse of `coins` gold pieces and one letter of credit worth
 *  `paper` - DFU's two pockets (PlayerEntity.cs:1313-1316). */
const purse = (coins, paper) => ({
  name: 'Rin', health: 20, maxHealth: 50, rentedRooms: [],
  items: [
    { group: 'Currency', stackCount: coins },
    { group: 'UselessItems2', templateIndex: LETTER_OF_CREDIT_TEMPLATE, value: paper, stackCount: 1 },
  ],
  stats: { personality: 50 },
});

const tavern = (entity, now = 600) => new TavernWindow({
  entity,
  rows,
  now: () => now,
  mapId: () => 7,
  buildingKey: () => 42,
  buildingName: () => 'The Dancing Dagger',
  quality: () => 10,
  bedCount: () => 4,
  freeRooms: () => false,
  skills: () => ({ mercantile: 50, personality: 50 }),
  heal: (n) => { entity.health = Math.min(entity.maxHealth, entity.health + n); },
  onTalk: () => {},
  onClose: () => {},
  rolls: () => 0.5,
});

const clickRect = (w, key) => {
  const [x, y, rw, rh] = TAVERN_RECTS[key];
  return w.click(TAVERN_PANEL_X + x + rw / 2, TAVERN_PANEL_Y + y + rh / 2);
};
const type = (w, text) => {
  for (let i = 0; i < 12; i++) w.flow.input('backspace');
  for (const ch of text) w.flow.input(`char:${ch}`);
};

test('AUDIT 26 F105: a letter of credit rents the room - the gate is GetGoldAmount (:218)', () => {
  // ConfirmRenting_OnButtonClick: `if (playerEntity.GetGoldAmount() >=
  // tradePrice) playerEntity.DeductGoldAmount(tradePrice)`. Both halves
  // read the SAME quantity - coins plus letters - so a purse that can
  // pay can never be refused. The port gated on the coin stack alone
  // while paying through deductGold, which spends letters.
  const e = purse(1, 5000);
  assert.equal(goldAmount(e), 1, 'one coin in the purse');
  assert.equal(totalGoldAmount(e), 5001, '...and 5000 on paper');

  const w = tavern(e);
  clickRect(w, 'room');
  type(w, '3');
  w.flow.input('Enter');
  const price = Number(/#\d+ (\d+) gold/.exec(w.flow.top.rows[0].text)[1]);
  assert.ok(price > 1 && price <= 5001, `the offer costs more than the coins alone: ${price}`);

  w.flow.input('KeyY');
  assert.equal(e.rentedRooms.length, 1, 'the room is rented against the letter');
  assert.equal(totalGoldAmount(e), 5001 - price, 'and DeductGoldAmount spent it');
});

test('AUDIT 26 F105: and the meal gate is GetGoldAmount too (:324)', () => {
  // FoodAndDrink_OnItemPicked: `holidayID != New_Life &&
  // playerEntity.GetGoldAmount() < price` refuses; otherwise
  // DeductGoldAmount(price) takes it out of either pocket.
  const dearest = Math.max(...TAVERN_PRICES);
  const e = purse(0, dearest * 4);
  e.lastTimePlayerAteOrDrankAtTavern = 0;
  const w = tavern(e, 100000);          // day 70-ish: no holiday arm
  clickRect(w, 'food');
  const idx = TAVERN_PRICES.indexOf(dearest);
  const before = totalGoldAmount(e);
  w.flow._picker.onPick(idx, 'x');
  assert.equal(w.flow, null, 'a meal shows nothing at all - the chain empties');
  assert.equal(totalGoldAmount(e), before - dearest, 'paid out of the letter');
  assert.equal(e.lastTimePlayerAteOrDrankAtTavern, 100000);

  // ...and a purse that really is short still hears the refusal.
  const broke = purse(0, 0);
  broke.lastTimePlayerAteOrDrankAtTavern = 0;
  const w2 = tavern(broke, 100000);
  clickRect(w2, 'food');
  w2.flow._picker.onPick(idx, 'x');
  assert.equal(idOf(w2.flow.top), NOT_ENOUGH_GOLD_ID);
});

test('AUDIT 26 F105: ONE export answers GetGoldAmount - the tavern imports it', () => {
  // court.js:161-165 is the port's single GetGoldAmount; a second
  // coins-plus-letters literal in a window is the defect, not the fix.
  const src = code('ui/tavernWindow.js');
  assert.match(src, /totalGoldAmount/, 'the gates go through court.js');
  assert.equal(/goldAmount\(h\.entity\) </.test(src), false, 'and no coins-only gate is left');
  // the %gld macro is the OTHER quantity: MacroHelper.cs:949 is
  // PlayerEntity.GoldPieces, coins alone - it must NOT have moved.
  assert.match(src, /gold: goldAmount\(this\.hooks\.entity\)/,
    'the TEXT.RSC gold macro stays GoldPieces (MacroHelper.cs:949)');
});

// ---------------------------------------------------------------
// F143  the ROOM flow is pushed OVER the tavern, never instead of it
// ---------------------------------------------------------------
test('AUDIT 26 F143: every ending of the room flow hands the panel back (:153-171, :214)', () => {
  // CloseWindow() is uiManager.PopWindow() (UserInterfaceWindow.cs
  // :127-130) - it pops the TOP window. RoomButton never calls it; the
  // input box calls it on ITSELF before raising OnGotUserInput
  // (DaggerfallInputMessageBox.cs:298-301); and ConfirmRenting's call
  // (:214) pops the price box pushed at :208, which does not
  // self-close (DaggerfallMessageBox.cs:479-484). The tavern survives
  // all four endings.
  const endings = [
    ['x', null],           // int.TryParse fails: a bare `return` (:176-178)
    ['400', null],         // over 350 days: MessageBox and nothing else (:188-191)
    ['2', 'KeyN'],         // declined
    ['2', 'KeyY'],         // rented
  ];
  for (const [days, button] of endings) {
    const e = purse(5000, 0);
    const w = tavern(e);
    clickRect(w, 'room');
    type(w, days);
    w.flow.input('Enter');
    if (button) w.flow.input(button);
    else if (w.flow) w.flow.input('Enter');    // dismiss the refusal box
    assert.equal(w.done, false, `"${days}"/${button}: the tavern is still up`);
    assert.equal(w.flow, null, `"${days}"/${button}: and the chain is gone`);
    assert.equal(clickRect(w, 'exit'), true, 'the panel takes clicks again');
    assert.equal(w.done, true);
  }
});

test('AUDIT 26 F143: the FOOD flow still closes the tavern first (:283)', () => {
  // DoFoodAndDrink's CloseWindow() runs while the tavern IS the top
  // window, BEFORE the hunger gate - so this half must not move.
  const e = purse(5000, 0);
  e.lastTimePlayerAteOrDrankAtTavern = 100000;      // fed
  const w = tavern(e, 100060);
  clickRect(w, 'food');
  assert.ok(w.flow, 'the "not hungry" box is up');
  w.flow.input('Enter');
  assert.equal(w.done, true, 'and the panel was already gone behind it');
});

test('AUDIT 26 F143/F136: both popups clear their parent panel, not black it', () => {
  // DaggerfallTavernWindow.cs:84 and
  // DaggerfallGuildServicePopupWindow.cs:99 both assign
  // `ParentPanel.BackgroundColor = Color.clear;` in their own
  // constructors, overriding DaggerfallBaseWindow.cs:40's black. This
  // is the AUDIT 24 CLEAR_PANEL rule, applied to the two windows that
  // list missed.
  for (const f of ['ui/tavernWindow.js', 'ui/guildServiceWindow.js']) {
    const src = code(f);
    assert.match(src, /drawScreenDimBackdrop\(renderer/, `${f}: the letterbox is Color.clear`);
    assert.equal(/drawMenuBackdrop\(renderer/.test(src), false,
      `${f}: and must NOT paint the black parent panel over it`);
  }
});

// ---------------------------------------------------------------
// F137 / F138  the bank's purchase window
// ---------------------------------------------------------------
test('AUDIT 26 F137: Middle alignment ignores Position - the panel sits at 35.5, not 50', () => {
  // DaggerfallBankPurchasePopUp.cs:122-126 sets Center + Middle AND
  // Position(0,50) on the 320x200 NativePanel; BaseScreenComponent.cs
  // :1234-1236 computes `rectangle.y = parentRect.yMin +
  // parentRect.height / 2 - rectangle.height / 2` and never reads
  // position.y. (200 - 129) / 2 = 35.5.
  assert.equal(PURCHASE_PANEL_H, 129);
  assert.equal(PURCHASE_PANEL_Y, Math.round((200 - 129) / 2));
  assert.equal(PURCHASE_PANEL_Y, 36, 'the rounded half-pixel, the way the guild popup rounds 74.5');
  assert.notEqual(PURCHASE_PANEL_Y, 50, 'the declared Position never applies');
});

test('AUDIT 26 F138: BUY beeps above the guard and closes above the result (:381-386)', () => {
  const clicks = [];
  const heard = [];
  const orig = audio.playOneShot;
  audio.playOneShot = (clip) => { heard.push(clip); return 0; };
  try {
    const win = new BankPurchaseWindow({
      houses: () => [{ buildingKey: 1, meshRadius: 10 }],
      buy: () => ({ result: TRANSACTION_RESULT.NOT_ENOUGH_GOLD, amount: 999 }),
      rows: () => [{ text: 'You do not have enough gold.', center: true }],
      onClose: () => { clicks.push('close'); },
    });
    // `PlayOneShot(SoundClips.ButtonClick)` is :381, ABOVE
    // `if (priceListBox.SelectedIndex < 0) return;` at :382-383 - a
    // dead press BEEPS and then does nothing at all.
    assert.equal(win.selected, -1);
    win.input('Enter');
    assert.deepEqual(heard, [SOUND.ButtonClick], 'the beep is above the guard');
    assert.equal(win.box, null, 'no message on a dead press');
    assert.deepEqual(clicks, [], '...and no close either');

    // A refused purchase: the box speaks, and CloseWindow (:386) has
    // already taken the list off the stack.
    heard.length = 0;
    win.input('ArrowDown');
    win.input('Enter');
    assert.equal(win.box.result, TRANSACTION_RESULT.NOT_ENOUGH_GOLD);
    win._dismissBox();
    assert.equal(win.done, true, 'CloseWindow is unconditional - refused or not');
    assert.deepEqual(clicks, ['close']);
  } finally {
    audio.playOneShot = orig;
  }
});

test('AUDIT 26 F138: a completed purchase closes it the same way', () => {
  const win = new BankPurchaseWindow({
    houses: () => [{ buildingKey: 1, meshRadius: 10 }],
    buy: (h) => ({ result: TRANSACTION_RESULT.PURCHASED_HOUSE, amount: housePrice(h.meshRadius) }),
    rows: () => [{ text: 'Congratulations.', center: true }],
    onClose: () => {},
  });
  win.input('ArrowDown');
  win.input('Enter');
  assert.equal(win.box.result, TRANSACTION_RESULT.PURCHASED_HOUSE);
  win._dismissBox();
  assert.equal(win.done, true);
});

test('AUDIT 26 F137: the hit rects travel with the corrected panel', () => {
  // Every rect is panel-relative, so moving the panel must move the
  // buttons with it - a window that draws at 36 and hit-tests at 50
  // is worse than one that is merely low.
  const win = new BankPurchaseWindow({
    houses: () => [{ buildingKey: 1, meshRadius: 10 }],
    buy: () => ({ result: TRANSACTION_RESULT.NONE }),
    rows: () => [],
    onClose: () => {},
  });
  const [ex, ey, ew, eh] = PURCHASE_RECTS.exit;
  assert.equal(win.click(PURCHASE_PANEL_X + ex + ew / 2, PURCHASE_PANEL_Y + ey + eh / 2), true);
  assert.equal(win.done, true, 'EXIT is where the moved panel puts it');
});

// ---------------------------------------------------------------
// F139  the nameplate pair arms are SEQUENTIAL
// ---------------------------------------------------------------
test('AUDIT 26 F139: the 2x fallback places FIRST alone when SECOND cannot follow (:1230-1240)', () => {
  // `else if (!Check(first, bias1*2)) { first.offset = bias1*2;
  // first.placed = true; buildingNameplates[i] = first; if
  // (!Check(second, Vector2.zero)) second.placed = true; }` - two
  // SEQUENTIAL tests, and second's is asked against a board that now
  // holds first. The port conjoined them with &&, so a board where
  // first clears and second does not placed NEITHER.
  //
  // Traced through the C# by hand:
  //   P0/P3 are the first pair (dy 3, bias 3.5): arm 1 parts them to
  //     -3.5 and +6.5.
  //   P1/P2 are the second pair (dy 9, bias 0.5). Arm 1 fails - P2's
  //     half-shift to 14.5 hits P3 at 6.5. Arm 2's 2x check on P1
  //     PASSES (25 is clear of both placed plates), so P1 is placed
  //     alone; P2 at its original 15 is NOT clear of P3, so it is
  //     left standing and only `second.numCollisionsDetected--`
  //     (:1274-1275) drops it to 0...
  //   ...which the zero pass at :1317-1318 then places at its
  //     ORIGINAL spot, offset 0.
  const board = [
    { x: 0, y: 0, w: 40, h: 10 },
    { x: 0, y: 24, w: 40, h: 10 },
    { x: 0, y: 15, w: 40, h: 10 },
    { x: 0, y: 3, w: 40, h: 10 },
  ];
  assert.deepEqual(resolveNameplates(board), [
    { offY: -3.5, replaced: false },
    { offY: 1, replaced: false },
    { offY: 0, replaced: false },
    { offY: 3.5, replaced: false },
  ]);
  // The conjoined form placed neither of the second pair, hopped P1 a
  // whole height to 34 and then had nowhere left to put P2 at all:
  // it printed a "*" where DFU shows a name.
});

test('AUDIT 26 F139: a stale count of 1 is PLACED where it stands, not starred (:1179-1185)', () => {
  // `if (j >= buildingNameplates.Length) { first.numCollisionsDetected
  // = 0; first.placed = true; buildingNameplates[i] = first;
  // continue; }` - a count of 1 whose only collider has since been
  // placed is a stale count, and DFU places the plate rather than
  // carrying it round to the "*" surrender. The port's `continue`
  // skipped that.
  //
  // Traced: P0/P1 part to 29.5/39.5; then P3 takes the mirror 2x arm
  // down to 13 while P2 at 23 is blocked by P0 at 29.5 - and because
  // FIRST (P2) was not placed, :1274-1275 does NOT fire, so P2 keeps
  // its count of 1. On the next iteration its collider P3 is placed,
  // the search finds nothing, and this arm is the only thing that
  // saves it.
  const board = [
    { x: 0, y: 34, w: 40, h: 10 },
    { x: 0, y: 35, w: 40, h: 10 },
    { x: 0, y: 23, w: 40, h: 10 },
    { x: 0, y: 18, w: 40, h: 10 },
  ];
  assert.deepEqual(resolveNameplates(board), [
    { offY: -4.5, replaced: false },
    { offY: 4.5, replaced: false },
    { offY: 0, replaced: false },
    { offY: -5, replaced: false },
  ]);
});

test('AUDIT 26 F139: a collider at zero matches NEITHER arm (:1190, :1277)', () => {
  // DFU's two branches are `if (second == 1)` and `else if (second >
  // 1)`; a collider sitting at 0 - a state the :1274-1275 decrement
  // produces inside the same loop - falls through both and DFU leaves
  // the plate exactly where it is. The port's plain `else` shoved it
  // a full ySize.
  const src = code('ui/nameplateLayout.js');
  assert.match(src, /\} else if \(q\.count > 1\) \{/, 'the entangled arm is gated `> 1`');
  assert.equal((src.match(/if \(p\.placed\) q\.count--/g) ?? []).length, 2,
    'and BOTH branches pay second one collision when first is placed (:1274, :1307)');
  assert.match(src, /if \(!q\) \{ p\.count = 0; p\.placed = true; continue; \}/);
  // a board with no collisions at all still never moves
  const calm = resolveNameplates([
    { x: 0, y: 0, w: 40, h: 10 },
    { x: 0, y: 50, w: 40, h: 10 },
    { x: 0, y: 100, w: 40, h: 10 },
  ]);
  assert.deepEqual(calm, [
    { offY: 0, replaced: false }, { offY: 0, replaced: false }, { offY: 0, replaced: false },
  ]);
});

// ---------------------------------------------------------------
// F151  Escape closes the vid window whatever endOnAnyKey says
// ---------------------------------------------------------------
test('AUDIT 26 F151: GetBackButtonDown sits OUTSIDE the endOnAnyKey gate (:140-142)', () => {
  // `endOnAnyKey && AnyKeyDownIgnoreAxisBinds || GetBackButtonDown()
  // || EndOfFile && Playing` - three arms, one gate. Escape
  // (InputManager.cs:1065-1067) is the second arm, so the
  // EndOnAnyKey=false videos (a quest's PlayVideo, the vampirism and
  // lycanthropy clips) are skippable too.
  const p = new VideoPlayer({ renderer: {} });
  p.playing = true;
  assert.equal(p.shouldClose(false, true, false), false, 'nothing pressed');
  assert.equal(p.shouldClose(true, true, false), true, 'any key, when the gate is open');
  assert.equal(p.shouldClose(true, false, false), false, '...and not when it is shut');
  assert.equal(p.shouldClose(false, false, true), true,
    'ESCAPE closes an unskippable video - the arm the port had dropped');
  assert.equal(p.shouldClose(true, false, true), true);
});

test('AUDIT 26 F151: the loop watches Escape separately from any key', () => {
  const src = code('ui/videoPlayer.js');
  assert.match(src, /shouldClose\(anyKey, endOnAnyKey, backButton\)/,
    'the frame loop passes the back button through');
  assert.match(src, /e\.key === 'Escape' \|\| e\.code === 'Escape'/,
    'and GetBackButtonDown is Escape alone, not any key');
});

// ---------------------------------------------------------------
// F148 / F149  the vitals indicators, and the accessibility swap
// ---------------------------------------------------------------
test('AUDIT 26 F148: VerticalProgressSmoother is the delayed lerp, verbatim (:9-51)', () => {
  assert.equal(SMOOTHER_TIMER_MAX, 0.4);
  const s = new VerticalProgressSmoother();
  s.amount = 1;
  s.beginSmoothChange(0.5);
  assert.equal(s.timer, -0.5, 'a change from rest waits half a second');
  assert.equal(s.amount, 1, 'and nothing has moved yet');
  s.cycle(0.4);
  assert.equal(s.amount, 1, 'still inside the delay (timer < 0)');
  s.cycle(0.2);                       // timer = 0.1
  assert.ok(Math.abs(s.amount - (1 + (0.5 - 1) * (0.1 / 0.4))) < 1e-9, 'Mathf.Lerp by timer/timerMax');
  // a change that INTERRUPTS a running one waits only a quarter second
  s.beginSmoothChange(0.25);
  assert.equal(s.timer, -0.25);
  s.cycle(0.65);                      // timer = 0.4 == timerMax
  assert.equal(s.amount, 0.25, 'lands exactly on target');
  assert.equal(s.cycleTimer, false, 'and stops cycling');
  s.cycle(10);
  assert.equal(s.amount, 0.25, 'a stopped smoother is inert');
});

const vitalsOf = (health, maxHealth = 100) => ({
  health, maxHealth, magicka: 50, maxMagicka: 100,
  fatigue: 100, stats: { strength: 50, endurance: 50 },
});

test('AUDIT 26 F148: DAMAGE drops the plain bar at once and trails the loss bar after it (:290-304)', () => {
  // `healthBar.Amount -= HealthLostPercent` is instant; the LOSS bar
  // keeps the old reading and smooth-changes down to the new one, so
  // the dark trail behind the bar is exactly what was lost.
  const v = new VitalsIndicators();
  v.tick(vitalsOf(100), 0.016);
  assert.deepEqual(v.amounts('health'), { bar: 1, loss: 1, gain: 1 });

  v.tick(vitalsOf(60), 0.016);
  const a = v.amounts('health');
  assert.ok(Math.abs(a.bar - 0.6) < 1e-9, 'the plain bar is already at the new level');
  assert.ok(Math.abs(a.gain - 0.6) < 1e-9, 'and so is the instant gain bar');
  assert.equal(a.loss, 1, 'the trail still shows where the health WAS');

  // ...and it catches up over timerMax, after the half-second delay.
  for (let i = 0; i < 60; i++) v.tick(vitalsOf(60), 0.016);
  const b = v.amounts('health');
  assert.ok(Math.abs(b.loss - 0.6) < 1e-9, 'the trail lands on the new level');
});

test('AUDIT 26 F148: HEALING jumps the trail up and walks the plain bar to meet it (:296-304)', () => {
  // `else healthBarLoss.Amount += HealthGainPercent` - the OTHER bar
  // moves. HealthGainPercent is -1 * HealthLostPercent
  // (VitalsChangeDetector.cs:31).
  const v = new VitalsIndicators();
  v.tick(vitalsOf(40), 0.016);
  v.tick(vitalsOf(90), 0.016);
  const a = v.amounts('health');
  assert.ok(Math.abs(a.loss - 0.9) < 1e-9, 'the trail is at the new, higher level at once');
  assert.ok(Math.abs(a.gain - 0.9) < 1e-9);
  assert.ok(Math.abs(a.bar - 0.4) < 1e-9, 'and the plain bar has not moved yet');
  for (let i = 0; i < 60; i++) v.tick(vitalsOf(90), 0.016);
  assert.ok(Math.abs(v.amounts('health').bar - 0.9) < 1e-9, 'it walks up to meet it');
});

test('AUDIT 26 F148: a changed MAX resets instead of painting a trail (:71-77)', () => {
  // "the current relative vital lost calculation is not valid when Max
  // Vital changes" - a level-up must not read as damage.
  const v = new VitalsIndicators();
  v.tick(vitalsOf(50, 100), 0.016);
  for (let i = 0; i < 60; i++) v.tick(vitalsOf(50, 100), 0.016);
  v.tick(vitalsOf(50, 120), 0.016);      // MaxHealth up, current unchanged
  const a = v.amounts('health');
  assert.ok(Math.abs(a.bar - 50 / 120) < 1e-9, 'every bar is re-synchronised...');
  assert.ok(Math.abs(a.loss - 50 / 120) < 1e-9, '...to the new ratio...');
  assert.ok(Math.abs(a.gain - 50 / 120) < 1e-9, '...with no trail at all');
});

test('AUDIT 26 F148/F149: the six indicator colours, and which pair the swap trades', () => {
  // HUDVitals.cs:41-46 verbatim.
  assert.deepEqual(HEALTH_LOSS_COLOR, [0, 0.22, 0]);
  assert.deepEqual(FATIGUE_LOSS_COLOR, [0.44, 0, 0]);
  assert.deepEqual(MAGICKA_LOSS_COLOR, [0, 0, 0.44]);
  assert.deepEqual(HEALTH_GAIN_COLOR, [0.60, 1, 0.60]);
  assert.deepEqual(FATIGUE_GAIN_COLOR, [1, 0.50, 0.50]);
  assert.deepEqual(MAGICKA_GAIN_COLOR, [0.70, 0.70, 1]);

  // LoadAssets (:179-198): under the swap the two bars trade ART and
  // their indicator colours travel with them; magicka is untouched
  // in BOTH arms (:199-201).
  const src = code('ui/hud.js');
  assert.match(src, /const swap = getBool\('GUI', 'SwapHealthAndFatigueColors'\)/);
  assert.match(src, /const health = swap \? main04 : main03;/,
    'healthBar takes fatigueBarFilename when the setting is on');
  assert.match(src, /const fatigue = swap \? main03 : main04;/);
  assert.match(src, /MAGICKA_LOSS_COLOR\]\n\s*: \[HEALTH_LOSS_COLOR, FATIGUE_LOSS_COLOR, MAGICKA_LOSS_COLOR\]/,
    'magicka keeps its own colour in both arms');
  // and the setting the port had surfaced but never read is read now
  assert.match(src, /getBool\('GUI', 'EnableVitalsIndicators'\)/);
});
