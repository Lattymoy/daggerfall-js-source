// AUDIT 63 - THE CLASSIC WINDOWS. Seven findings across the potion
// maker, the guild service popup, the banking window, the shop's STEAL
// button and the character sheet's skills dialog. Every pin here holds
// the REFERENCE's value, and dies under the mutation that reverts the
// fix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PotionMakerWindow, POTION_RECTS, INGREDIENT_BUTTONS, INGREDIENT_LIST_X,
} from '../src/ui/potionMakerWindow.js';
import { POTION_RECIPES, potionRecipeKey, knownRecipes } from '../src/systems/potions.js';
import { GuildServiceWindow, GUILD_RECTS, PANEL_X, PANEL_Y } from '../src/ui/guildServiceWindow.js';
import { BankWindow, BANK_RECTS, BANK_PANEL_X, BANK_PANEL_Y } from '../src/ui/bankWindow.js';
import { TRANSACTION_TYPE, createBankAccounts } from '../src/systems/banking.js';
import {
  NativeTradeWindow, TRADE_RECTS, STEAL_SUCCESS_TEXT, STEAL_FAILURE_TEXT,
} from '../src/ui/nativeTrade.js';
import { shopliftAttempt, shopliftingLoad } from '../src/systems/theft.js';
import { totalWeight } from '../src/systems/inventory.js';
import { audio } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';
import { calculateShopliftingChance } from '../src/combat/formulas.js';
import { CharSheet, SKILL_DIALOG_HIGHLIGHT_COLOR } from '../src/ui/charsheet.js';
import { sheetModel } from '../src/ui/enhancedCharSheet.js';
import { SKILLS, SKILL_NAMES } from '../src/systems/skills.js';
import { handToHandMinDamage, handToHandMaxDamage } from '../src/combat/formulas.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, 'src', p), 'utf8');

// ── F42 / F43: the potion maker ──────────────────────────────────────

const ing = (t, n = 1) => ({ group: 'UselessItems2', templateIndex: t, stackCount: n });
const byName = (n) => POTION_RECIPES.find((r) => r.name === n);

function potionWin(over = {}) {
  const pack = over.pack ?? [];
  const wagon = over.wagon ?? [];
  const took = [];
  const w = new PotionMakerWindow({
    packItems: () => pack,
    wagonItems: () => wagon,
    gold: () => 0,
    recipeKeys: () => over.recipeKeys ?? [],
    addPotion: () => {},
    takeOne: (t, where) => {
      const list = where === 'pack' ? pack : wagon;
      const i = list.findIndex((x) => x.templateIndex === t);
      if (i < 0) return false;
      took.push(where);
      if ((list[i].stackCount ?? 1) > 1) list[i].stackCount -= 1; else list.splice(i, 1);
      return true;
    },
    icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
    entity: {},
    onClose: () => {},
  });
  return { w, pack, wagon, took };
}
const clickSlot = (w, i) => {
  const [bx, by, bw, bh] = INGREDIENT_BUTTONS[i];
  return w.click(POTION_RECTS.ingredientsList[0] + INGREDIENT_LIST_X + bx + bw / 2,
    POTION_RECTS.ingredientsList[1] + by + bh / 2);
};

test('AUDIT 63 F43: Refresh gathers ingredients from the PACK AND THE WAGON (:143-153)', () => {
  // `foreach (ItemCollection playerItems in new ItemCollection[] {
  //   PlayerEntity.Items, PlayerEntity.WagonItems }) { ... if
  //   (item.IsIngredient && !item.IsEnchanted) ingredients.AddItem(...) }`
  // The wagon is a first-class source of the GRID, not only of the
  // spend walk - and worldModes' service gate admits a player whose
  // reagents are all in the cart, so this is the player DFU expects.
  const only = potionWin({ pack: [], wagon: [ing(59), ing(26), ing(24)] });
  assert.equal(only.w.ingredients().length, 3, 'a wagon-only reagent set draws a full grid');
  // ...and it is CLICKABLE into the cauldron and spendable from there
  clickSlot(only.w, 0); clickSlot(only.w, 0); clickSlot(only.w, 0);
  assert.equal(only.w.cauldron.length, 3);
  only.w._mix();
  assert.equal(only.w.cauldron.length, 0, 'the mix found them');
  assert.deepEqual(only.took, ['wagon', 'wagon', 'wagon']);
  assert.equal(only.wagon.length, 0, 'the cart is emptied');

  // DFU's ORDER is pack first, then wagon (the array literal at :143),
  // and the potted-unit subtraction runs over that order - which is
  // also the order consumeCauldron's takeFromPack -> takeFromWagon
  // spends them in, so what the grid shows left is what the mix finds.
  const both = potionWin({ pack: [ing(59, 2)], wagon: [ing(26)] });
  assert.deepEqual(both.w.ingredients().map((it) => it.templateIndex), [59, 26]);
});

test('AUDIT 63 F43: AddItem MERGES a pack stack and a wagon stack into one grid slot', () => {
  // ingredients.AddItem(item.Clone()) (:149) -> FindExistingStack
  // (ItemCollection.cs:224-229, :699-718) matches on ItemGroup +
  // GroupIndex + message + PotionRecipeKey + TimeForItemToDisappear,
  // and an ingredient is stackable (FormulaHelper.cs:2103), so two in
  // the pack and three in the cart are ONE slot reading five.
  const { w, pack } = potionWin({ pack: [ing(59, 2)], wagon: [ing(59, 3)] });
  const grid = w.ingredients();
  assert.equal(grid.length, 1, 'one slot, not two');
  assert.equal(grid[0].stackCount, 5, 'and it reads the SUM');
  assert.equal(pack[0].stackCount, 2, 'the live pack item is not mutated - DFU merges into clones');
  // a unit in the pot comes off that one merged stack
  clickSlot(w, 0);
  assert.equal(w.ingredients()[0].stackCount, 4);
  // a DIFFERENT PotionRecipeKey is a different stack (:711)
  const split = potionWin({ pack: [{ ...ing(59), potionRecipeKey: 7 }], wagon: [ing(59)] });
  assert.equal(split.w.ingredients().length, 2, 'FindExistingStack refuses across the key');
});

test('AUDIT 63 F43 (review): the merge is AddItem\'s, so IsStackable\'s refusals hold', () => {
  // FindExistingStack (ItemCollection.cs:699-702, :714) is guarded at
  // BOTH ends by IsStackable, and IsStackable
  // (DaggerfallUnityItem.cs:681-695) refuses an equipped item, a QUEST
  // item, an enchanted one, and a summoned non-arrow before it ever
  // reaches FormulaHelper.IsItemStackable. An inline re-derivation of
  // the identity terms alone folded a quest reagent into a plain one.
  const quest = potionWin({ pack: [{ ...ing(59, 2), questItem: true }], wagon: [ing(59, 3)] });
  const qgrid = quest.w.ingredients();
  assert.equal(qgrid.length, 2, 'a quest reagent keeps a slot of its own');
  assert.deepEqual(qgrid.map((it) => it.stackCount), [2, 3]);
  // the equipped clause, same member, same line
  const worn = potionWin({ pack: [{ ...ing(59, 2), equipSlot: 'RightHand' }], wagon: [ing(59, 3)] });
  assert.equal(worn.w.ingredients().length, 2);
  // and the summoned one - a conjured reagent is not an arrow (:682-688)
  const conj = potionWin({ pack: [{ ...ing(59, 2), timeForItemToDisappear: 1234 }], wagon: [ing(59, 3)] });
  assert.equal(conj.w.ingredients().length, 2);
  // ...while two ordinary stacks still fold, and the LIVE items are
  // untouched: DFU merges into `item.Clone()`s (:149)
  const ok = potionWin({ pack: [ing(59, 2)], wagon: [ing(59, 3)] });
  assert.equal(ok.w.ingredients().length, 1);
  assert.equal(ok.pack[0].stackCount, 2);
  assert.equal(ok.wagon[0].stackCount, 3);
  // the port has ONE home for this and the window uses it
  assert.match(src('ui/potionMakerWindow.js'), /addItem\(merged, \{ \.\.\.it \}\);/);
});

test('AUDIT 63 F42: the recipe picker is built from CARRIED recipe items, sorted by DisplayName', () => {
  // Refresh :150-151 collects `else if (item.IsPotionRecipe)
  // recipeItems.Add(item)` from BOTH collections, then :164-170
  // resolves each through GetPotionRecipe(PotionRecipeKey), de-dupes
  // and sorts by DisplayName. The host hook is the port's half of that
  // walk, and it used to read a field nothing ever wrote.
  const modes = src('scenes/worldModes.js');
  assert.match(modes, /for \(const it of \[\.\.\.\(playerEntity\.items \?\? \[\]\), \.\.\.\(playerEntity\.wagonItems \?\? \[\]\)\]\) \{\s*\n\s*if \(isPotionRecipe\(it\) && it\.potionRecipeKey\) seen\.add\(it\.potionRecipeKey\);/);
  assert.ok(!/recipeKeys: \(\) => playerEntity\.potionRecipeKeys/.test(modes),
    'the read of a field nothing in src/ ever assigned is gone');

  // the SORT and the DE-DUPE, against DFU's own two lines
  const slow = potionRecipeKey(byName('slowFalling').ingredients);
  const heal = potionRecipeKey(byName('healing').ingredients);
  assert.deepEqual(knownRecipes([slow, heal, slow]).map((r) => r.displayName),
    ['Healing', 'Slow Falling'], 'de-duped (:166-168) and sorted by DisplayName (:170)');

  // ...and the ROWS the picker draws are DisplayName (:171-172), not
  // the localization key the port stores as `name`.
  const w = potionWin({ recipeKeys: [slow], pack: [ing(59), ing(26), ing(24)] }).w;
  const [rx, ry, rw, rh] = POTION_RECTS.recipes;
  w.click(rx + rw / 2, ry + rh / 2);
  assert.ok(w.picker, 'the picker opened - the button is no longer permanently dead');
  assert.deepEqual(w.picker.items, ['Slow Falling']);
  // RecipePicker_OnItemPicked hands that same row back as recipeName
  // (:384-390) and AddRecipeToCauldron writes it to the label (:307)
  w.picker.onPick(0);
  assert.equal(w.nameLabel, 'Slow Falling');
});

// ── F44: the guild service popup's TALK button ───────────────────────

test('AUDIT 63 F44: the guild popup is the ONE sibling whose TALK does not CloseWindow', () => {
  // TalkButton_OnMouseClick (:291-295) and the KeyUp arm (:304-308)
  // are PlayOneShot + TalkToStaticNPC with no CloseWindow, while
  // DaggerfallTavernWindow.cs:265, DaggerfallMerchantServicePopupWindow.cs:139,
  // DaggerfallMerchantRepairPopupWindow.cs:146 and
  // DaggerfallWitchesCovenPopupWindow.cs:164 all close first.
  const log = [];
  const mk = () => new GuildServiceWindow({
    member: () => true, service: () => 'Training',
    rows: () => [], steps: () => [],
    onJoin: () => null, onTalk: () => log.push('talk'),
    onService: () => ({ rows: [] }), onClose: () => log.push('close'),
  });
  const clickAt = (w, rect) => w.click(PANEL_X + rect[0] + 1, PANEL_Y + rect[1] + 1);

  const a = mk();
  clickAt(a, GUILD_RECTS.talk);
  assert.deepEqual(log, ['talk'], 'the click does not close');
  assert.equal(a.done, false);

  log.length = 0;
  const b = mk();
  b.input('KeyT');
  assert.deepEqual(log, ['talk'], 'and neither does the hotkey');
  assert.equal(b.done, false);

  // ...while EXIT still does (:477-478)
  log.length = 0;
  const c = mk();
  clickAt(c, GUILD_RECTS.exit);
  assert.deepEqual(log, ['close']);
  assert.equal(c.done, true);
});

test('AUDIT 63 F44: TalkToStaticNPC is a PushWindow, so the popup is waiting underneath', () => {
  // TalkManager.cs:757/:767 PushWindow rather than replace, and
  // DaggerfallTalkWindow's exit is CloseWindow (:1598, :1611), so DFU
  // pops back to the guild popup. The port's talk mount was a
  // REPLACEMENT (showOverlay), which is why dropping the window's own
  // _close() alone would have changed nothing.
  const modes = src('scenes/worldModes.js');
  const town = src('scenes/townTalk.js');
  // the door takes the push/onClosed pair...
  assert.match(town, /function openTalkWindow\(greeting, \{ npcSeed = 0, npcName = '', portrait = null, push = false, onClosed = null \} = \{\}\)/);
  assert.match(town, /const mount = push \? pushOverlay : showOverlay;/,
    'and routes to the GENUINE stack door when asked');
  // ...and the CALLBACK reaches the mount. Without it the interior
  // half of the fix is gone: the popup is taken down for the
  // conversation and never re-mounted, which is precisely what DFU's
  // missing CloseWindow (:291-295) forbids.
  assert.match(town, /\}\), onClosed\);/, 'the native talk window is mounted WITH the restore');
  assert.match(town, /showGreeting\(greeting, mount, onClosed\);/, 'and so is the art-less greeting');
  // AUDIT 63 F44 (review): every RE-MOUNT of that art-less chain
  // carries it too - showOverlay overwrites _onOverlayClosed (:532-558),
  // so a tone press or a Where-is page used to discard the restore.
  assert.match(town, /toneOption\(\(\) => showGreeting\(text, showOverlay, onClosed\)\)/);
  assert.match(town, /action: \(\) => openCategories\(onClosed\) \}/);
  assert.match(town, /showOverlay\(new ChoiceWindow\(\{ lines, options \}\), onClosed\);/);
  assert.match(town, /toneOption\(\(\) => showAnswer\(text, onClosed\)\)/);
  // ...only the guild popup asks for it
  assert.match(modes, /onTalk: \(\) => talkToStaticNpcHere\(\{ isSpyMaster: false, returnTo: win \}\)/);
  assert.match(modes, /const pushed = !!keepUnder && mode !== 'interior';/);
  assert.match(modes, /if \(!pushed\) interiorOverlay = null;/,
    'the interior slot, which has no stack, is still cleared and restored by the callback');
  assert.match(modes, /onClosed: keepUnder && !pushed \? \(\) => \{ if \(!keepUnder\.done\) mountServiceWindow\(keepUnder\); \} : null,/);
  // the coven and the Spymaster keep the replace: DaggerfallWitchesCovenPopupWindow.cs:164
  // really does CloseWindow first, and the Spymaster greeting is a
  // dismissed box (:443-449, :711-713).
  assert.match(modes, /onTalk: \(\) => popupTalkToStaticNpc\(npcData\),/);
  assert.match(modes, /talkAsSpymaster: \(\) => talkToStaticNpcHere\(\{ isSpyMaster: true \}\)/);
});

// ── F45: the banking window's back button ────────────────────────────

function bankWin() {
  const entity = { level: 5, goldPieces: 1000, items: [] };
  const accounts = createBankAccounts(62);
  return new BankWindow({
    accounts: () => accounts,
    regionIndex: () => 17,
    level: () => entity.level,
    now: () => 1000,
    player: {
      gold: () => entity.goldPieces,
      totalGold: () => entity.goldPieces,
      deductGold: (n) => { entity.goldPieces -= n; },
      addGold: (n) => { entity.goldPieces += n; },
      wagonGold: () => 0,
      takeWagonGold: () => {},
      takeLetter: () => null,
      addLetter: () => {},
      carriedWeightKg: () => 0,
      maxEncumbranceKg: () => 1e9,
    },
    wagonGold: () => 0,
    rows: () => [{ text: 'x', center: true }],
    dueDateText: () => '',
    ownsHouse: () => false, ownsShip: () => false, ownedShip: () => -1,
    housesForSale: () => 0, isPortTown: () => false, houseSellPrice: () => 0,
    onClose: () => {},
  });
}
const clickBank = (w, key) => {
  const [x, y, rw, rh] = BANK_RECTS[key];
  return w.click(BANK_PANEL_X + x + rw / 2, BANK_PANEL_Y + y + rh / 2);
};

test('AUDIT 63 F45: Escape cancels the BANK, not the amount field (DaggerfallPopupWindow.cs:70-74)', () => {
  // DaggerfallBankingWindow is a DaggerfallPopupWindow (:24) that
  // never assigns AllowCancel, so `if (allowCancel &&
  // GetBackButtonUp()) CancelWindow()` runs whatever the field is
  // doing, and CancelWindow (:88-93) posts wmCloseWindow. The field
  // does not swallow it: GetBackButtonUp is a raw Escape read
  // (InputManager.cs:1070-1073) and TextBox only ABSORBS the key so it
  // does not become a character (TextBox.cs:404-406). There is no
  // field-cancel anywhere in DaggerfallBankingWindow.Update (:212-227).
  const w = bankWin();
  clickBank(w, 'depositGold');
  assert.equal(w.transactionType, TRANSACTION_TYPE.Depositing_gold, 'the field is open');
  for (const ch of '400') w.input(`char:${ch}`);
  assert.equal(w.value, '400', 'and half-typed');
  w.input('Escape');
  assert.equal(w.done, true, 'ONE Escape closes the bank, the typed amount discarded');

  // and the EXIT BUTTON is the one control the enabled field disables
  // (ExitButton_OnMouseClick :473-478) - the two paths disagree on
  // purpose, which is the half AUDIT 26 F140 read backwards.
  const g = bankWin();
  clickBank(g, 'depositGold');
  clickBank(g, 'exit');
  assert.equal(g.done, false, 'the exit BUTTON is gated');
  g.input('KeyE');
  assert.equal(g.done, false, "and so is the port's own accelerator for it");
  g.input('Escape');
  assert.equal(g.done, true, 'the back button is not');
});

// ── F48: DaggerfallTradeWindow.DoSteal ───────────────────────────────

const good = (v, kg) => ({ group: 'Weapons', templateIndex: 1, value: v, weight: kg, stackCount: 1 });

function tradeWin(over = {}) {
  const shelf = over.shelf ?? [good(100, 2)];
  const pack = over.pack ?? [];
  const log = [];
  const w = new NativeTradeWindow({
    mode: over.mode ?? 'Buy',
    shelfItems: () => shelf,
    packItems: () => pack,
    otherItems: () => [],
    isEquipped: () => false,
    accepts: () => true,
    enchanted: () => false,
    priceCtx: () => ({ quality: 10, priceAdjustment: 1, skills: {} }),
    gold: () => 10000,
    rows: () => [],
    weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 500 }),
    commit: () => true,
    icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
    entity: { stats: { strength: 50 } },
    pickpocketSkill: () => over.skill ?? 50,
    tallyPickpocket: (n) => log.push(['pickpocket', n]),
    tallyCrimeGuild: (a, n) => log.push(['guild', a, n]),
    crimeTheft: () => log.push(['theft']),
    spawnCityGuards: (f) => log.push(['guards', f]),
    say: (line, s) => log.push(['say', line, s]),
    ...over.hooks,
  });
  return { w, shelf, pack, log };
}
const clickTrade = (w, key) => {
  const [x, y, rw, rh] = TRADE_RECTS[key];
  return w.click(x + rw / 2, y + rh / 2);
};

test('AUDIT 63 F48: the STEAL rect is stealButtonRect, a child of the action panel (:40, :44)', () => {
  // `new Rect(4, 102, 31, 14)` inside `new Rect(222, 10, 39, 190)`.
  assert.deepEqual([...TRADE_RECTS.steal], [226, 112, 31, 14]);
  const [px, py, pw, ph] = TRADE_RECTS.actionPanel;
  const [sx, sy, sw, sh] = TRADE_RECTS.steal;
  assert.ok(sx >= px && sy >= py && sx + sw <= px + pw && sy + sh <= py + ph, 'inside the panel');
  // clear of its two neighbours (:45-46)
  for (const k of ['modeAction', 'clear', 'exit']) {
    const [ox, oy, ow, oh] = TRADE_RECTS[k];
    assert.ok(sy + sh <= oy || oy + oh <= sy, `steal does not overlap ${k}`);
  }
  // the strings are Internal_Strings.csv:825-826, verbatim
  assert.equal(STEAL_SUCCESS_TEXT, 'You are successful.');
  assert.equal(STEAL_FAILURE_TEXT, 'You are not successful...');
});

test('AUDIT 63 F48: DoSteal getting away with it - Pickpocket THEN guild, and the basket transfers', () => {
  // :912-922. TallySkill(Pickpocket, 1) is unconditional and comes
  // BEFORE the roll; the success arm is Dice100.FailedRoll(chance),
  // AddHUDText("stealSuccess", 2), PlayerEntity.Items.TransferAll and
  // TallyCrimeGuildRequirements(true, 1).
  const { w, shelf, pack, log } = tradeWin({ hooks: {} });
  w._pickRemote(0);                       // stage the shelf's one item
  assert.equal(w.basket.length, 1);
  assert.equal(shelf.length, 0, 'staged goods leave the shelf at the click');
  // chance = (100 - 50) + 10 + load; the roll is stubbed to land OVER
  // it, which is FailedRoll = got away with it
  const load = shopliftingLoad(w.basket);
  const chance = calculateShopliftingChance(50, 10, load);
  assert.equal(shopliftAttempt({ basket: w.basket, pickpocketSkill: 50, shopQuality: 10, rolls: () => (chance + 1) / 100 }).caught, false);
  w.hooks.say = (line, s) => log.push(['say', line, s]);
  const real = Math.random;
  Math.random = () => (chance + 1) / 100;
  try { clickTrade(w, 'steal'); } finally { Math.random = real; }
  assert.deepEqual(log, [
    ['pickpocket', 1],
    ['say', STEAL_SUCCESS_TEXT, 2],
    ['guild', true, 1],
  ], 'the tally is first and unconditional; the guild tally is the SUCCESS arm only');
  assert.equal(pack.length, 1, 'TransferAll moved the basket into PlayerEntity.Items (:920)');
  assert.equal(w.basket.length, 0);
  assert.equal(shelf.length, 0, 'and nothing went back to the shelf');
  assert.equal(w.done, true, 'CloseWindow either way (:930)');
});

test('AUDIT 63 F48: DoSteal caught - crime, guards, and the basket back on the shelf', () => {
  // :923-929. AddHUDText("stealFailure", 2), CrimeCommitted = Theft,
  // SpawnCityGuards(true) - and NO TransferAll, so CloseWindow ->
  // OnPop -> ClearSelectedItems (:404-408, :589-600) walks the basket
  // back onto the shelf.
  const { w, shelf, pack, log } = tradeWin();
  w._pickRemote(0);
  const chance = calculateShopliftingChance(50, 10, shopliftingLoad(w.basket));
  const real = Math.random;
  Math.random = () => (chance - 1) / 100;
  try { clickTrade(w, 'steal'); } finally { Math.random = real; }
  assert.deepEqual(log, [
    ['pickpocket', 1],
    ['say', STEAL_FAILURE_TEXT, 2],
    ['theft'],
    ['guards', true],
  ], 'the Pickpocket tally fires on this arm too; the GUILD tally does not');
  assert.equal(pack.length, 0, 'nothing was transferred');
  assert.equal(shelf.length, 1, 'the basket went back to the shelf - OnPop, not a keep');
  assert.equal(w.done, true);
});

test('AUDIT 63 F48: the gates - Buy mode only (:316-322) and cost > 0 (:909)', () => {
  // an EMPTY basket costs nothing, so nothing happens at all - not
  // even the tally
  const empty = tradeWin();
  clickTrade(empty.w, 'steal');
  assert.deepEqual(empty.log, [], 'cost > 0 is the gate, not the count');
  assert.equal(empty.w.done, false);

  // (a NON-empty Buy basket always costs at least 1: CalculateCost
  // floors the base value at 1, FormulaHelper.cs:1890-1893 - so the
  // `cost > 0` gate only ever refuses the empty basket.)

  // and in SELL mode the button IS NOT CREATED (:316-322), so the rect
  // is still the consumed action-panel no-op: it steals nothing, and
  // it does not even play the button's click, because there is no
  // button there to click.
  const sell = tradeWin({ mode: 'Sell', pack: [good(100, 2)], shelf: [] });
  sell.w._pickLocal(0);
  assert.ok(sell.w.staged.length > 0, 'something is staged');
  const real = audio.playOneShot;
  const played = [];
  audio.playOneShot = (i) => { played.push(i); return 0.1; };
  try {
    assert.equal(clickTrade(sell.w, 'steal'), true, 'the click is still consumed by the panel');
    assert.deepEqual(played, [], 'and it is silent - the button does not exist in this mode');
    sell.w.input('KeyT');
    assert.deepEqual(played, [], 'and neither does the TradeSteal key sound');
  } finally { audio.playOneShot = real; }
  assert.deepEqual(sell.log, [], 'nothing was stolen');
  assert.equal(sell.w.done, false);

  // ...while in Buy mode both do sound, as every trade button does
  // (StealButton_OnMouseClick :934-938, the KeyDown arm :942-946)
  const buy = tradeWin();
  buy.w._pickRemote(0);
  const played2 = [];
  audio.playOneShot = (i) => { played2.push(i); return 0.1; };
  const realRandom = Math.random;
  Math.random = () => 0.99;
  try { clickTrade(buy.w, 'steal'); } finally { audio.playOneShot = real; Math.random = realRandom; }
  assert.deepEqual(played2, [SOUND.ButtonClick]);
});

test('AUDIT 63 F48: the TradeSteal hotkey (T) is live in Buy mode', () => {
  // stealButton.Hotkey = DaggerfallShortcut.Buttons.TradeSteal (:320);
  // DialogShortcuts gives it the letter T.
  const { w, log } = tradeWin();
  w._pickRemote(0);
  const chance = calculateShopliftingChance(50, 10, shopliftingLoad(w.basket));
  const real = Math.random;
  Math.random = () => (chance + 1) / 100;
  try { w.input('KeyT'); } finally { Math.random = real; }
  assert.deepEqual(log[0], ['pickpocket', 1]);
  assert.equal(w.done, true);
});

test('AUDIT 63 F48: shopliftAttempt is DoSteal\'s arithmetic, not AttemptPrivatePropertyTheft\'s', () => {
  // weightAndNumItems = (int)basketItems.GetWeight() + basketItems.Count
  // (:912) - the C# cast TRUNCATES, and the count is added after, so a
  // pocketful of featherweights contributes almost nothing but its
  // number.
  const basket = [good(10, 2.7), good(10, 0.2)];
  assert.equal(Math.trunc(totalWeight(basket)), 0, 'two quarter-kilo goods weigh half a kilo, which truncates to 0');
  const out = shopliftAttempt({ basket, pickpocketSkill: 40, shopQuality: 12, rolls: () => 0.99 });
  assert.equal(out.weightAndNumItems, Math.trunc(totalWeight(basket)) + basket.length);
  assert.equal(out.weightAndNumItems, 2);
  // ...and a heavy single item contributes both halves
  const heavy = [{ group: 'Armor', templateIndex: 102, value: 500, stackCount: 1 }];
  assert.equal(shopliftAttempt({ basket: heavy, pickpocketSkill: 0, shopQuality: 0, rolls: () => 0.99 }).weightAndNumItems,
    Math.trunc(totalWeight(heavy)) + 1);
  assert.equal(out.chance, calculateShopliftingChance(40, 12, out.weightAndNumItems));
  assert.equal(out.caught, false, '!Dice100.FailedRoll - a roll OVER the chance got away with it');
  assert.equal(shopliftAttempt({ basket, pickpocketSkill: 40, shopQuality: 12, rolls: () => 0 }).caught, true);
  // and unlike privatePropertyTheft it has NO empty-basket guard - the
  // gate is `cost > 0` at the call site (:909)
  assert.equal(shopliftAttempt({ basket: [], pickpocketSkill: 0, shopQuality: 0, rolls: () => 0.99 }).weightAndNumItems, 0);
});

test('AUDIT 63 F48 (review): the SHOP mount wires all six DoSteal effects, and the dungeon mount none', () => {
  // The window half is pinned above; these are the SINKS DoSteal
  // writes through (DaggerfallTradeWindow.cs:913-928), and an unwired
  // hook is a silent free-goods button - no Pickpocket tally, no
  // Thieves Guild credit, no crime, no guards, no HUD line. Same shape
  // as theft.test.js:133's pin on the private-property arm.
  const modes = src('scenes/worldModes.js');
  const at = modes.indexOf('return new NativeTradeWindow({');
  assert.ok(at > 0, 'the shop mount is where it was');
  const mount = modes.slice(at, modes.indexOf('shopName:', at));
  assert.match(mount, /pickpocketSkill: \(\) => skillValue\(playerEntity, SKILLS\.Pickpocket\),/,
    'CalculateShopliftingChance reads the LIVE Pickpocket (:913)');
  assert.match(mount, /tallyPickpocket: \(n\) => tallySkill\(playerEntity, SKILLS\.Pickpocket, n\),/,
    'TallySkill(Pickpocket, 1) (:914)');
  assert.match(mount, /tallyCrimeGuild: \(a, n\) => tallyCrimeGuildRequirements\(playerEntity, a, n\),/,
    'TallyCrimeGuildRequirements(true, 1) (:921)');
  assert.match(mount, /crimeTheft: \(\) => setCrimeCommitted\(playerEntity, CRIMES\.Theft\),/,
    'CrimeCommitted = Crimes.Theft (:927), through the ONE crime write');
  assert.match(mount, /spawnCityGuards: \(flag\) => host\.spawnCityGuards\?\.\(flag\),/,
    'SpawnCityGuards(true) (:928)');
  assert.match(mount, /say: \(line, seconds\) => townTalk\?\.say\?\.\(line, seconds\),/,
    'AddHUDText(text, 2) (:918, :925)');
  // THE FOUR HOSTS: the other mount of this window is the dungeon's
  // Identify spell, and DFU only ADDS the steal button in Buy mode
  // (:316-322) while DoSteal re-checks it (:909) - so that mount
  // carries none of the six, on purpose and in writing.
  const dungeon = src('scenes/dungeonContext.js');
  const idAt = dungeon.indexOf('return new NativeTradeWindow({');
  assert.ok(idAt > 0);
  const idMount = dungeon.slice(idAt, dungeon.indexOf('});', idAt));
  for (const hook of ['pickpocketSkill:', 'tallyPickpocket:', 'tallyCrimeGuild:', 'crimeTheft:', 'spawnCityGuards:', 'say:']) {
    assert.ok(!idMount.includes(hook), `the Identify mount has no ${hook} - there is no shop to rob underground`);
  }
  assert.match(dungeon, /AUDIT 63 F48's steal hooks \(pickpocketSkill, tallyPickpocket,/,
    'and it says so where the next reader will look');
});

// ── F34 / F35: the character sheet's skills dialog ───────────────────

const CAREER = {
  name: 'Warrior',
  primarySkills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.CriticalStrike],
  majorSkills: [SKILLS.BluntWeapon, SKILLS.Archery, SKILLS.Climbing],
  minorSkills: [SKILLS.Swimming, SKILLS.Running, SKILLS.Jumping, SKILLS.Medical, SKILLS.Dodging, SKILLS.Backstabbing],
};
const sheetEntity = () => ({
  name: 'Test', level: 1, health: 30, maxHealth: 30, magicka: 0, maxMagicka: 0,
  stats: {}, skills: Object.fromEntries(SKILL_NAMES.map((_, id) => [id, 20 + id])),
  career: CAREER, items: [],
});

/** A recorder that captures what _drawSkillPage emits. */
function drawPage(page, entity = sheetEntity()) {
  const rows = [];
  const rects = [];
  const sheet = new CharSheet(entity, { onClose: () => {} });
  sheet.page = page;
  const renderer = { uploadTexture: () => 'tex', drawScreenQuad(_t, r, _uv, c) { rects.push({ ...r, c }); } };
  const font = { fnt: { fixedHeight: 6, fixedWidth: 4, glyphWidth: () => 4 },
    tex: 'f', glyph: () => null };
  // shadowText goes through drawText -> renderer; capture at the seam
  // the window uses by stubbing the module-level draw is not possible
  // here, so drive the real draw and read the source for placement.
  sheet._drawSkillPage(renderer, font, { s: 1, ox: 0, oy: 0 });
  return { rows, rects, sheet };
}

test('AUDIT 63 F35: the skills dialog lists the WHOLE group - no nine-row slice (:281-307)', () => {
  const s = src('ui/charsheet.js');
  assert.ok(!s.includes('ids.slice(0, 9)'), 'the cap that hid 14 of the 23 Miscellaneous skills is gone');
  assert.match(s, /ids\.forEach\(\(id, i\) =>/, 'every id in the group is drawn');
  // twoColumn is page 4 ONLY - MiscSkillsButton_OnMouseClick (:835) is
  // the one caller that passes true; :817/:823/:829 do not.
  assert.match(s, /const twoColumn = this\.page === 4;/);
  // ROW-MAJOR: the even entry at token x=0, the odd one at x=136 on
  // the SAME line, newline after the right entry (:294-305).
  assert.match(s, /\(twoColumn && i % 2 \? 136 : 0\)/);
  assert.match(s, /\(twoColumn \? Math\.floor\(i \/ 2\) : i\) \* 9/);

  // and the misc group really is 23 for a stock 3/3/6 career, so the
  // list the port draws is 23 rows and not 9
  const e = sheetEntity();
  const inCareer = new Set([...CAREER.primarySkills, ...CAREER.majorSkills, ...CAREER.minorSkills]);
  const misc = SKILL_NAMES.map((_, id) => id).filter((id) => !inCareer.has(id));
  assert.equal(SKILL_NAMES.length, 35, 'DaggerfallSkills.Count');
  assert.equal(misc.length, 23, '35 - 12, which is GetMiscSkills (DaggerfallEntity.cs:559-577)');
  assert.equal(e.career.primarySkills.length + e.career.majorSkills.length + e.career.minorSkills.length, 12);
});

test('AUDIT 63 F35 (review): the dialog is ClickAnywhereToClose, so no click reaches the sheet under it', () => {
  // `messageBox.ClickAnywhereToClose = true`
  // (DaggerfallCharacterSheetWindow.cs:323) and
  // DaggerfallMessageBox.ParentPanel_OnMouseClick (:645-663) -
  // CloseWindow() on ANY click while the box is TopWindow. The sheet
  // beneath is not the top window and gets nothing, so a click on the
  // dialog must never reach a sheet button. The port draws the page as
  // a plate rather than a pushed window, and F35's centred two-column
  // plate lies OVER the eight StatButton rects (x 141..169), so
  // without the consume a dismissing click popped the AUDIT 58
  // attribute description on top of the skills the player was reading.
  const mk = (page) => {
    const sheet = new CharSheet(sheetEntity(), { rows: (id) => [{ text: `DESC ${id}` }] });
    sheet.page = page;
    return sheet;
  };
  // over an attribute button (STATS_ROLLOUT_SELECT: x 141, y 6+24i, 28x20)
  const a = mk(4);
  assert.equal(a.click(150, 110), true, 'the click is consumed');
  assert.equal(a.page, 0, 'and it CLOSED the dialog, as the box does');
  assert.equal(a.child, null, 'no stat-description box on top of the skills list');
  // over a skills button, which used to re-page the dialog rather than close it
  const b = mk(4);
  b.click(12, 107);
  assert.equal(b.page, 0);
  assert.equal(b.child, null);
  // over nothing at all - the box closes on a click ANYWHERE (:323)
  const c = mk(1);
  assert.equal(c.click(60, 60), true);
  assert.equal(c.page, 0);
  // with no dialog up, the attribute button still pops its description
  // (AUDIT 58, :925-941) - the consume is the DIALOG's, not a new gate
  const d = mk(0);
  assert.equal(d.click(150, 110), true);
  assert.ok(d.child, 'StatButton_OnMouseClick is untouched');
});

test('AUDIT 63 F35: the two-column page is sized and centred for its rows, not clamped to nine', () => {
  // DFU's dialog is a DaggerfallMessageBox that AUTO-SIZES to its
  // tokens and centres itself (:320-324), so the panel must grow to
  // hold 12 lines rather than being clipped at the sheet-anchored 96.
  const { rects } = drawPage(4);
  const panel = rects[0];
  // 23 misc skills -> ceil(23/2) = 12 lines, and Hand-to-Hand is one
  // of them, so one more for the damage row: 13 * 9 + 14 = 131.
  assert.equal(panel.h, 131, 'the panel holds every line');
  assert.equal(panel.w, 246, "DFU's own 136 column pitch plus a column of text");
  assert.equal(panel.x, Math.floor((320 - 246) / 2), 'centred, as the message box is');
  assert.equal(panel.y, Math.floor((200 - 131) / 2));

  // pages 1-3 keep the single-column, sheet-anchored plate
  const p1 = drawPage(1).rects[0];
  assert.equal(p1.w, 130);
  assert.equal(p1.x, 8);
  assert.equal(p1.y, 100);
  assert.equal(p1.h, 3 * 9 + 14, 'three primary skills, three rows - no H2H in this group');
});

test('AUDIT 63 F34: the hand-to-hand damage line, on the group that holds the skill (:283-284, :309-318)', () => {
  const s = src('ui/charsheet.js');
  // hthDamageFormatString is `{0} dmg: {1}-{2}`
  // (Internal_Strings.csv:1553) - the literal word "dmg:" and no
  // spaces around the dash.
  assert.match(s, /\$\{SKILL_NAMES\[SKILLS\.HandToHand\]\} dmg: \$\{handToHandMinDamage\(v\)\}-\$\{handToHandMaxDamage\(v\)\}/);
  // the GROUP is what is tested, over the whole list (:281-284), and
  // the value is the LIVE skill (GetLiveSkillValue, :313-314)
  assert.match(s, /const showHth = ids\.includes\(SKILLS\.HandToHand\);/);
  assert.match(s, /const v = skillValue\(e, SKILLS\.HandToHand\);/);

  // Hand-to-Hand is Miscellaneous for this career, so page 4 grows by
  // one line and pages 1-3 do not.
  const withHth = drawPage(4).rects[0].h;
  const e2 = sheetEntity();
  e2.career = { ...CAREER, primarySkills: [SKILLS.HandToHand, SKILLS.Axe, SKILLS.CriticalStrike] };
  const moved = drawPage(1, e2).rects[0];
  assert.equal(moved.h, 3 * 9 + 14 + 9, 'the line follows the skill onto the primary page');
  const misc2 = drawPage(4, e2).rects[0];
  assert.equal(misc2.h, withHth - 9, 'and leaves the misc page, which is a line shorter');

  // the arithmetic is FormulaHelper's, over the live value
  assert.equal(handToHandMinDamage(50), 6);
  assert.equal(handToHandMaxDamage(50), 11);

  // the ENHANCED skin reads the same law out of the model
  const m = sheetModel(sheetEntity());
  assert.deepEqual(m.handToHandDamage, {
    min: handToHandMinDamage(sheetEntity().skills[SKILLS.HandToHand]),
    max: handToHandMaxDamage(sheetEntity().skills[SKILLS.HandToHand]),
  });
  assert.match(readFileSync(join(root, 'src/ui/enhancedMenu.js'), 'utf8'),
    /group\.ids\.includes\(SKILLS\.HandToHand\)/, 'gated per GROUP there too');
});

test('AUDIT 63 F35: this dialog\'s highlight is the box\'s OVERRIDE, not the UI default', () => {
  // messageBox.SetHighlightColor(DaggerfallUI.DaggerfallUnityStatIncreasedTextColor)
  // (:321) -> DaggerfallMessageBox.SetHighlightColor (:455-458) ->
  // MultiFormatTextLabel paints every TextHighlight token with it
  // (:363). That constant is Color32(178,207,255,255)
  // (DaggerfallUI.cs:66), NOT DaggerfallHighlightTextColor's
  // (219,130,40,255) at :54.
  assert.deepEqual(SKILL_DIALOG_HIGHLIGHT_COLOR.map((c) => Math.round(c * 255)), [178, 207, 255, 255]);
  assert.match(src('ui/charsheet.js'), /\? SKILL_DIALOG_HIGHLIGHT_COLOR :/);
});
