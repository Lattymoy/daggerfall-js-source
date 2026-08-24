// M4 probe: drive the item maker against the live game.
//
// The unit tests drive the law over fixtures; this proves the HOST
// half - that the guild-service DESTINATION really reaches the window
// (it was a FLAGGED null until this slice), that the tabs filter the
// player's real pack, that a bound soul drags its forced children in
// through the real pickers, and that enchanting really spends gold
// off the entity and leaves the enchantments on the item.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5215, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
await page.goto('http://localhost:5215/?shot&play&exterior&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });

const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const win = async () => JSON.parse(await page.evaluate(() => window.__itemMakerOverlay()) ?? 'null');
const gold = () => page.evaluate(() => (window.__playerEntity.items ?? [])
  .find((i) => i.group === 'Currency')?.stackCount ?? 0);
const fail = (m) => { console.log('FAIL:', m); process.exit(1); };

const ENTERABLE = new Set([0, 2, 5, 6, 7, 8, 9, 12, 13, 15]);
const doors = JSON.parse(await page.evaluate(() => JSON.stringify(window.__doors())));
let inside = false;
for (let i = 0; i < doors.length && !inside; i++) {
  const b = JSON.parse(await page.evaluate((j) => window.__buildingAt(j), i));
  if (!b || !ENTERABLE.has(b.buildingType)) continue;
  const { pos, normal } = doors[i];
  await page.evaluate(([x, y, z, yaw]) => window.__pose(x, y, z, yaw, -0.05),
    [pos[0] + normal[0] * 1.5, pos[1] - 1.2, pos[2] + normal[2] * 1.5, Math.atan2(-normal[0], -normal[2])]);
  if (!await page.evaluate(() => window.__enter())) continue;
  await waitFrames(10);
  if (JSON.parse(await page.evaluate(() => window.__building()) ?? 'null')) inside = true;
}
if (!inside) fail('could not get inside any building');
console.log('inside:', await page.evaluate(() => window.__building()));

// A real pack: a steel wakizashi to enchant, a robe, a ruby, and gold.
await page.evaluate(() => {
  const e = window.__playerEntity;
  e.items = e.items ?? [];
  const g = e.items.find((i) => i.group === 'Currency');
  if (g) g.stackCount = 200000;
  else e.items.push({ group: 'Currency', name: 'Gold pieces', stackCount: 200000 });
  e.items.push({ group: 'Weapons', templateIndex: 117, material: 0, name: 'Wakizashi', stackCount: 1 });   // material 0 is IRON
  e.items.push({ group: 'MensClothing', templateIndex: 19, name: 'Robe', stackCount: 1 });
  e.items.push({ group: 'Gems', templateIndex: 0, name: 'Ruby', stackCount: 1 });
});

console.log('\n== OPEN (through the guild-service destination) ==');
await page.evaluate(() => window.__openItemMaker());
await waitFrames(6);
let s = await win();
if (!s?.itemMaker) fail('guildServiceItemMaker did not reach the window - the M4 route is dead');
console.log('opened:', JSON.stringify({ tab: s.tab, listed: s.listed, labels: s.labels }));
if (!s.listed.includes('Wakizashi')) fail('the weapons tab did not list the weapon');
if (s.listed.includes('Robe')) fail('the weapons tab listed a robe');

console.log('\n== TABS ==');
await page.evaluate(() => window.__itemMakerClick('clothingAndMisc'));
s = await win();
console.log('clothing:', JSON.stringify(s.listed));
if (!s.listed.includes('Robe')) fail('the clothing tab did not list the robe');
if (s.listed.includes('Wakizashi')) fail('the clothing tab listed a weapon');
await page.evaluate(() => window.__itemMakerClick('ingredients'));
s = await win();
console.log('ingredients:', JSON.stringify(s.listed));
if (!s.listed.includes('Ruby')) fail('the ingredients tab did not list the gem');
await page.evaluate(() => window.__itemMakerClick('magicItems'));
s = await win();
if (s.listed.length !== 0) fail('the magic items tab must list NOTHING, as classic does');
await page.evaluate(() => window.__itemMakerClick('weaponsAndArmor'));

console.log('\n== REFUSALS BEFORE AN ITEM IS PICKED ==');
await page.evaluate(() => window.__itemMakerClick('powersButton'));
s = await win();
if (!/must be selected/i.test(s.box?.[0] ?? '')) fail(`expected the no-item refusal, got ${JSON.stringify(s.box)}`);
await page.evaluate(() => window.__itemMakerClick('powersButton'));   // dismiss

console.log('\n== SELECT + THE PICKERS ==');
// slot 0 of the item scroller, at that slot's own cell
s = JSON.parse(await page.evaluate(() => window.__itemMakerSlot(0)));
if (s.selected !== 'Wakizashi') fail(`selecting the first slot picked ${s.selected}`);
console.log('selected:', s.selected, 'labels:', JSON.stringify(s.labels));
if (s.labels.enchantmentCost !== '0/337') {
  fail(`an IRON wakizashi should read 0/337 (450 floored by -0.25), got ${s.labels.enchantmentCost}`);
}

await page.evaluate(() => window.__itemMakerClick('powersButton'));
s = await win();
if (!s.picker) fail('the powers picker did not open');
console.log('powers offered:', s.picker.length, s.picker.slice(0, 6).join(', '));
if (!s.picker.includes('Potent Vs')) fail('Potent Vs must be offered on a weapon');
if (s.picker.includes('Extra Weight')) fail('a SIDE effect must not be in the powers picker');

s = JSON.parse(await page.evaluate(() => window.__itemMakerPick('Potent Vs')));
if (!s.picker) fail('picking a multi-param effect must open the secondary picker');
console.log('secondary:', JSON.stringify(s.picker));
if (s.picker[0] !== 'Undead') fail('an UNFLAGGED effect keeps DFU order - Undead first, not Animals');
s = JSON.parse(await page.evaluate(() => window.__itemMakerPick('Undead')));
console.log('powers now:', JSON.stringify(s.powers), 'gold cost:', s.labels.goldCost);
if (s.powers.length !== 1 || s.powers[0].cost !== 800) fail('Potent vs Undead should cost 800');
if (s.labels.goldCost !== '8000') fail(`gold is ten times the power sum, got ${s.labels.goldCost}`);

console.log('\n== THE EXCLUSION REACHES ACROSS THE TWO LISTS ==');
await page.evaluate(() => window.__itemMakerClick('sideEffectsButton'));
s = await win();
if (!s.picker.includes('Low Damage Vs')) fail('Low Damage Vs must still be OFFERED - the clash is per-param');
s = JSON.parse(await page.evaluate(() => window.__itemMakerPick('Low Damage Vs')));
console.log('low damage params:', JSON.stringify(s.picker));
if (s.picker.includes('Undead')) fail('Undead must be gone from the secondary list - Potent vs Undead is on the item');
if (!s.picker.includes('Animals')) fail('the other three params must remain');
s = JSON.parse(await page.evaluate(() => window.__itemMakerPick('Animals')));
console.log('side effects now:', JSON.stringify(s.sideEffects), 'cost:', s.labels.enchantmentCost);
if (s.labels.enchantmentCost !== '-400/337') {
  fail(`800 + (-1200) is -400: a drawback BUYS budget. got ${s.labels.enchantmentCost}`);
}
if (s.labels.goldCost !== '8000') fail('and the drawback must cost NO gold');

console.log('\n== A BOUND SOUL DRAGS ITS CHILDREN IN ==');
s = JSON.parse(await page.evaluate(() => window.__itemMakerPick('Soul Bound')) ?? 'null');
if (!s) {
  await page.evaluate(() => window.__itemMakerClick('sideEffectsButton'));
  s = JSON.parse(await page.evaluate(() => window.__itemMakerPick('Soul Bound')));
}
console.log('souls offered:', s.picker.length, s.picker.slice(0, 4).join(', '));
if (s.picker[0] !== 'Ancient Lich') fail('SoulBound alpha-sorts its list');
const before = (await win()).powers.length + (await win()).sideEffects.length;
s = JSON.parse(await page.evaluate(() => window.__itemMakerPick('Daedra Lord')));
console.log('powers:', JSON.stringify(s.powers));
console.log('sideEffects:', JSON.stringify(s.sideEffects));
const after = s.powers.length + s.sideEffects.length;
if (after !== before + 4) fail(`the Daedra Lord brings three children plus itself: ${before} -> ${after}`);
const forced = [...s.powers, ...s.sideEffects].filter((e) => e.parent && e.parent !== 0);
if (forced.length !== 3) fail(`three rows must be marked FORCED, got ${forced.length}`);
if (!forced.every((e) => e.parent === 'SoulBound:31')) fail('every child must carry the soul\'s key');
if (!s.powers.some((e) => e.type === 'PotentVs' && e.param === 1)) fail('the Daedra Lord forces Potent vs Daedra');
if (!s.sideEffects.some((e) => e.type === 'ExtraWeight')) fail('...and Extra Weight');

console.log('\n== REMOVING THE PARENT TAKES THE CHILDREN ==');
// through the window's own hit test, at the rect rowLayout puts the
// Soul Bound row at - not by reaching into the array
const withSoul = after;
s = JSON.parse(await page.evaluate(() => window.__itemMakerRemoveRow('sideEffects', 'SoulBound:31')) ?? 'null');
if (!s) fail('the Soul Bound row was not where rowLayout says it is');
const left = s.powers.length + s.sideEffects.length;
console.log(`rows: ${withSoul} -> ${left}`);
if (left !== withSoul - 4) fail('removing the soul must take its three children with it');
if ([...s.powers, ...s.sideEffects].some((e) => e.parent && e.parent !== 0)) {
  fail('no forced row may survive its parent');
}
if (!s.powers.some((e) => e.type === 'PotentVs' && e.param === 0)) fail('...and the CHOSEN rows must stay');

console.log('\n== ENCHANT ==');
const gold0 = await gold();
await page.evaluate(() => window.__itemMakerClick('enchant'));
await waitFrames(2);
s = await win();
console.log('box:', JSON.stringify(s.box));
const gold1 = await gold();
console.log('gold:', gold0, '->', gold1);
const spent = gold0 - gold1;
if (!/has been enchanted/i.test(s.box?.[0] ?? '')) fail(`expected the enchant line, got ${JSON.stringify(s.box)}`);
if (spent <= 0) fail('enchanting must actually spend gold off the entity');
const item = JSON.parse(await page.evaluate(() => JSON.stringify(
  (window.__playerEntity.items ?? []).find((i) => i.name === 'Wakizashi') ?? null)));
console.log('enchanted item:', JSON.stringify(item?.enchantments?.map((e) => `${e.type}:${e.param}`)));
if (!item?.enchantments?.length) fail('the enchantments did not land on the item');
if (s.selected !== null) fail('the item must be released after enchanting');
if (s.powers.length || s.sideEffects.length) fail('and both lists cleared');

console.log('\n== THE ENCHANTED ITEM LEAVES THE LIST ==');
await page.evaluate(() => window.__itemMakerClick('weaponsAndArmor'));
s = await win();
console.log('listed now:', JSON.stringify(s.listed));
if (s.listed.includes('Wakizashi')) fail('an already-enchanted item must not be offered again');

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nOK: the item maker drives end to end through the live guild-service route.');
await browser.close();
await server.close();
process.exit(0);
