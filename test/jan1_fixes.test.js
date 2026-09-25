// JAN1 (2026-09-18, Janome's play report on the deployed build, relayed by Mac): three crashes and a NaN.
//
// (1) "got this while toggling between F5 and F6 menus" - CRASH `openCharSheet is not a function` in the enhanced
//     pack. The CharacterSheet key arm called `onExit()` (which unmounts and clears the module's `deps` to `{}`) and
//     THEN read `deps.openCharSheet` off the emptied bag. The file's own law at its close arm - THE HOOKS ARE READ
//     BEFORE ANYTHING CLOSES - applied to the one arm that broke it.
// (2) "error message when using bank, softlocked the game too when i tried to withdraw letter of credit" - CRASH
//     `region 17 is outside the 0 bank accounts`. A save from before the banking slice restored an EMPTY account table,
//     which is truthy, so the host's `??= createBankAccounts` never minted one and every bank reader threw by DFU's
//     own ValidateRegion law. No accounts saved is the full table, as a new game mints it; the house registry alike.
// (3) "when I try to sell certain items I get COST:NaN ... if i proceed to sell to him, he offers me 0" - an item saved
//     before MAC-N1 set every minter has no `value` (or a NaN one), and the trade window read `item.value` raw. One
//     value read for every price arm (`itemValueOf`: a non-finite value is an absent one, the template's base price
//     answers), and a save's items are set on the way in.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { withDom } from './invdrag.mjs';
import { setBindings } from '../src/ui/input.js';
import { createBindings, resetDefaults } from '../src/systems/inputActions.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { createBankAccounts, validateRegion, BANK_REGION_COUNT } from '../src/systems/banking.js';
import { tradeCost, buyItemPrice } from '../src/systems/tradeModes.js';
import { itemValueOf, setItemFields, itemBaseValue, templateByIndex } from '../src/systems/itemTemplates.js';
import { calculateCost } from '../src/systems/shopStock.js';
import { ITEM_TEMPLATES } from '../src/characters/paperdoll.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const defaults = () => { const b = createBindings(); resetDefaults(b); return b; };
const tmpl = (name) => ITEM_TEMPLATES.find((t) => t.name === name);
const fresh = () => ({ stats: { endurance: 50 }, skills: [], skillUses: [], items: [], spells: [] });
/** A real snapshot of a bare entity, the one shape restorePlayer reads - with the fields under test removed or replaced. */
const snapOf = (patch = {}, drop = []) => { const s = snapshotPlayer(fresh(), {}); for (const k of drop) delete s[k]; return { ...s, ...patch }; };
const mk = (name, group = 'Weapons', extra = {}) => { const t = tmpl(name); return { name: t.name, templateIndex: t.index, group, stackCount: 1, currentCondition: 50, maxCondition: 50, ...extra }; };

test('JAN1 (1): the pack\'s CharacterSheet key closes the pack and opens the sheet - the hook is read BEFORE the close clears the bag (the crash: `onExit` unmounts, the unmount empties `deps`, and the old arm then called `deps.openCharSheet` on `{}`)', () => {
  setBindings(defaults());
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { name: 'Janome', career: { name: 'Knight' }, stats: { strength: 50, endurance: 48 }, items: [mk('Longsword')], goldPieces: 10 };
    let opened = 0, exits = 0;
    let view = null;
    view = mountEnhancedInventory(host, {
      entity: e, items: () => e.items,
      onExit: () => { exits++; view.unmount(); },   // the host's own close law: the unmount, which clears the module's deps
      openCharSheet: () => { opened++; },
    });
    assert.doesNotThrow(() => dom.win.fire('keydown', { code: 'F5', key: 'F5', target: null, preventDefault() {}, stopPropagation() {} }), 'F5 on the pack: close, then the sheet - no throw');
    assert.equal(exits, 1, 'the pack closed first'); assert.equal(opened, 1, 'and the sheet opened after');
  });
  const s = rd('src/ui/enhancedInventory.js');
  assert.ok(s.includes("    const openCharSheet = deps.openCharSheet;\n    onExit();                 // the pack's own close law runs FIRST...\n    openCharSheet();"), 'by source: the hook is captured before onExit');
  assert.ok(s.includes("if (acts.includes('CharacterSheet') && typeof deps?.openCharSheet === 'function') {"), 'and the arm asks for a function, not a truthy bag entry');
});

test('JAN1 (2): a save with no bank accounts restores the FULL table (and the house registry beside it), so every bank reader validates the region instead of throwing; a save with accounts keeps them; the classic ValidateRegion law is untouched', () => {
  const back = fresh();
  restorePlayer(back, snapOf({}, ['bankAccounts', 'houses']));   // a pre-B1 snapshot: no `bankAccounts` at all
  assert.equal(back.bankAccounts.length, BANK_REGION_COUNT, 'sixty-two accounts, as a new game');
  assert.equal(validateRegion(back.bankAccounts, 17), true, 'region 17 - the one that threw - validates');
  assert.equal(back.houses.length, BANK_REGION_COUNT, 'the house registry on the same count');
  const empty = fresh();
  restorePlayer(empty, snapOf({ bankAccounts: [], houses: [] }));   // the shape the old restore minted: EMPTY and truthy
  assert.equal(empty.bankAccounts.length, BANK_REGION_COUNT, 'an empty table saved is no table: the full one');
  // a played save keeps its own
  const played = { ...fresh(), bankAccounts: createBankAccounts(3) };
  played.bankAccounts[2].accountGold = 777;
  const snap = snapshotPlayer(played, {});
  const again = fresh();
  restorePlayer(again, snap);
  assert.equal(again.bankAccounts.length, 3); assert.equal(again.bankAccounts[2].accountGold, 777, 'restored as saved');
  assert.notEqual(again.bankAccounts[2], played.bankAccounts[2], 'a copy');
  assert.equal(validateRegion(again.bankAccounts, 17), false, 'DFU\'s law still refuses a region past the table (the wilderness\'s -1, or a short table)');
});

test('JAN1 (3): the trade window prices an item with no finite value at its base price, never NaN - Sell, SellMagic, Repair and Buy through the one value read; a save\'s items are set on the way in; a minted value is kept', () => {
  const sword = mk('Longsword');
  const base = itemBaseValue(sword);
  assert.ok(base > 0);
  assert.equal(itemValueOf({ ...sword, value: NaN }), base, 'NaN is no value');
  assert.equal(itemValueOf({ ...sword }), base, 'absent is no value');
  assert.equal(itemValueOf({ ...sword, value: 1234 }), 1234, 'a finite value is the item\'s own');
  assert.equal(itemValueOf({ ...sword, value: '90' }), base, 'a string is no value');
  assert.equal(setItemFields({ ...sword, value: NaN }).value, base, 'SetItem\'s write treats NaN as absent (`??` let it through)');
  const ctx = { quality: 12, priceAdjustment: 1000 };
  for (const [mode, item] of [['Sell', { ...sword, value: NaN }], ['Sell', { ...sword, value: undefined }], ['SellMagic', { ...sword, value: NaN }], ['Repair', { ...sword, value: NaN, currentCondition: 10, maxCondition: 50 }]]) {
    const { cost } = tradeCost(mode, [item], ctx);
    assert.ok(Number.isFinite(cost) && cost > 0, `${mode}: a finite price (${cost})`);
  }
  assert.equal(tradeCost('Sell', [{ ...sword, value: NaN }], ctx).cost, calculateCost(base, 12, 1000), 'the base price, as a valued sword');
  assert.equal(buyItemPrice({ ...sword, value: NaN }, ctx), calculateCost(base, 12, 1000), 'Buy the same');
  // the save: an old item comes in with its value set
  const e = fresh();
  restorePlayer(e, snapOf({ items: [{ ...sword, value: undefined }, { ...sword, value: NaN, name: undefined }], wagonItems: [{ ...sword, value: NaN }], otherItems: [{ ...sword }] }));
  assert.equal(e.items[0].value, base); assert.equal(e.items[1].value, base); assert.equal(e.items[1].name, templateByIndex(sword.templateIndex).name, 'and its name');
  assert.equal(e.wagonItems[0].value, base); assert.equal(e.otherItems[0].value, base);
  const t = rd('src/systems/tradeModes.js');
  assert.equal((t.match(/calculateCost\(item\.value/g) ?? []).length, 0, 'no price arm reads item.value raw');
  assert.equal((t.match(/itemValueOf\(item\)/g) ?? []).length, 4, 'four arms through the one read: Buy, Sell, SellMagic, Repair');
});

// (4) "sometimes speaking to people gives this interaction menu ... anyone else i speak to in the same building has the
//     same thing happen, until i leave the building and re-enter" - the box is townTalk's KEYED CHAIN (showGreeting),
//     which openTalkWindow takes when the Where-is directory is empty. The directory is synced from the EXTERIOR frame
//     alone (under the modal return), so a load that lands the player inside a building (the boot ?load runs before
//     the frame loop even starts) had no frame to sync it and no way to recover until the player stepped back outside.
//     The arrival now answers both halves of TalkManager's OnLoadEvent: the session AND the topics.
test('JAN1 (4): a topic-less host opens the KEYED chain verbatim (the box in the screenshot); the arrival syncs the talk topics beside the session, because the frame\'s own sync sits below the modal return and never runs indoors', async () => {
  const { createTownTalk } = await import('../src/scenes/townTalk.js');
  const host = createTownTalk({
    renderer: { uploadTexture: () => ({}) }, canvas: { width: 640, height: 400 },
    fetchBytes: async () => { throw new Error('this pin loads no ARENA2'); },
    playerEntity: { name: 'T', stats: { personality: 50 }, skills: 30, skillUses: [] },
    regionIndex: 0,
  });
  host.openTalkWindow('What do you want?');
  const w = host.overlay;
  assert.ok(w?.isChoiceWindow, 'no directory: the keyed chain, not the enhanced panel');
  assert.deepEqual(w.options.map((o) => o.label).filter(Boolean), ['W - where is...', 'T - tone: Normal', 'Esc - goodbye']);
  assert.match(rd('src/scenes/townTalk.js'), /if \(talkDoorReady\(\) && directory\.length\) \{/, 'the one door the symptom comes out of');

  const world = rd('src/scenes/world.js');
  assert.match(world, /npcSession\.onWorldChanged\(\);\n(?:\s*\/\/[^\n]*\n)*\s*syncTopics\(\);\n  \}/,
    'a new world origin re-answers BOTH halves of TalkManager\'s OnLoadEvent - the topics sync right beside the session');
  const modalAt = world.indexOf('if (modes.frame(dt, now)) {');
  const frameSync = world.indexOf('syncTopics();   // T3d');
  assert.ok(modalAt > 0 && frameSync > modalAt, 'the frame\'s own sync is BELOW the modal return: it never runs indoors');
  const bootLoad = world.indexOf('await worldQuickLoad(');
  assert.ok(bootLoad > 0 && world.lastIndexOf('requestAnimationFrame(frame);') > bootLoad,
    'the boot load runs inside bootWorld, before the frame loop starts - the deterministic arm');
});
