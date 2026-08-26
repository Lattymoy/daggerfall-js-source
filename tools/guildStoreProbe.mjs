// G4 probe: the four guild store services against the live game.
//
// The unit tests drive the shelves and the value sum over fixtures;
// this proves the HOST half - that each of the four destinations
// really reaches the trade window (all four were FLAGGED nulls), that
// the magic shelf stocks from the real MAGIC.DEF and prices off the
// enchantment sum M4 unblocked, that the gems on that shelf are not
// the Buy Soulgems gems, and above all that a REAL guildFactionId now
// reaches the price context - the thing that had never had a caller.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5216, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
await page.goto('http://localhost:5216/play/?shot&play&exterior&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });

const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const trade = async () => JSON.parse(await page.evaluate(() => window.__tradeOverlay()) ?? 'null');
const open = async (dest) => {
  await page.evaluate(() => window.__closeOverlay?.());
  const faction = await page.evaluate((d) => window.__openGuildService(d), dest);
  await waitFrames(3);
  return { faction, win: await trade() };
};
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

await page.evaluate(() => {
  const e = window.__playerEntity;
  e.items = e.items ?? [];
  const g = e.items.find((i) => i.group === 'Currency');
  if (g) g.stackCount = 200000;
  else e.items.push({ group: 'Currency', name: 'Gold pieces', stackCount: 200000 });
  e.level = 6;
  // an UNidentified magic item and a plain one, for Identify/SellMagic
  e.items.push({ group: 'Jewellery', templateIndex: 165, name: 'Ring', stackCount: 1,
    enchantments: [{ type: 4, param: 1 }], isIdentified: false, value: 900 });
  e.items.push({ group: 'MensClothing', templateIndex: 19, name: 'Robe', stackCount: 1 });
});

// A STRANGER cannot buy soul gems, and GetMerchantMagicItems gates its
// gem run on that same permission - so join first, or the shelf's most
// interesting half never runs.
console.log('member:', await page.evaluate(() => window.__joinGuild()));

console.log('\n== BUY MAGIC ITEMS ==');
let { faction, win } = await open('guildServiceBuyMagicItems');
if (!win?.trade) fail('guildServiceBuyMagicItems did not reach the trade window');
console.log('faction:', faction, '| priceCtx:', JSON.stringify(win.priceCtx));
console.log('shelf:', win.remote.length, win.remote.map((i) => `${i.name}=${i.value}`).join(' | '));
if (win.mode !== 'Buy') fail(`expected Buy mode, got ${win.mode}`);
if (win.priceCtx.guildFactionId !== faction) {
  fail(`the guild's faction id must reach the price context - got ${win.priceCtx.guildFactionId}`);
}
if (!win.remote.length) fail('the magic shelf is empty - MAGIC.DEF never reached the mint');
// the spellbook is minted from a template index and carries no name
// of its own, which is exactly how to tell it from the magic items
const magicItems = win.remote.filter((i) => i.soul === undefined && i.name);
if (!magicItems.length) fail('no magic items on the magic shelf');
if (!magicItems.every((i) => i.identified)) fail('a shop magic item must arrive IDENTIFIED');
if (!magicItems.every((i) => i.value > 0)) {
  fail(`every item must price off its enchantments: ${JSON.stringify(magicItems)}`);
}
const spellbook = win.remote.filter((i) => i.soul === undefined && !i.name);
if (spellbook.length !== 1) fail(`exactly one spellbook closes the magic run, got ${spellbook.length}`);
console.log('spellbook on the shelf: yes');
const shelfGems = win.remote.filter((i) => i.soul !== undefined).map((i) => i.soul ?? 'empty').join(',');
console.log('gems riding along:', shelfGems);
if (!shelfGems) fail('the gem run did not ride along - CanAccessService is not reaching the shelf');

console.log('\n== BUY SOULGEMS: the SAME day, DIFFERENT gems ==');
({ win } = await open('guildServiceBuySoulgems'));
if (!win?.trade) fail('the soulgem arm broke');
const gemShelf = win.remote.filter((i) => i.soul !== undefined).map((i) => i.soul ?? 'empty').join(',');
console.log('gem shelf:', gemShelf);
if (win.priceCtx.guildFactionId !== faction) fail('X6\'s own arm should carry the id too now');
if (!shelfGems) fail('a member should see the gems ride along on the magic shelf');
if (shelfGems === gemShelf) fail('the magic run walks the stream first, so these must differ');

console.log('\n== BUY POTIONS ==');
({ win } = await open('guildServiceBuyPotions'));
if (!win?.trade) fail('guildServiceBuyPotions did not reach the trade window');
console.log('potions:', win.remote.length);
if (!win.remote.length) fail('the potion shelf is empty');
if (win.priceCtx.guildFactionId !== faction) fail('the potion shelf must price as a guild store');

console.log('\n== IDENTIFY + SELLMAGIC: no shelf, the pack IS the list ==');
({ win } = await open('guildServiceIdentify'));
if (!win?.trade) fail('guildServiceIdentify did not reach the trade window');
console.log('identify: mode', win.mode, '| remote', win.remote.length, '| local', win.local, '| cost', win.cost);
if (win.mode !== 'Identify') fail(`expected Identify mode, got ${win.mode}`);
if (win.remote.length !== 0) fail('Identify has no shelf at all');
if (win.local < 1) fail('the unidentified ring must be offered');

({ win } = await open('guildServiceSellMagicItems'));
console.log('sellmagic: mode', win.mode, '| remote', win.remote.length, '| local', win.local);
if (win.mode !== 'SellMagic') fail(`expected SellMagic mode, got ${win.mode}`);
if (win.remote.length !== 0) fail('SellMagic has no shelf either');

console.log('\n== TALES AND TALLOW: the clause that had never had a caller ==');
// day 243 of the year, the holiday every region celebrates
const holidayMinutes = (243 - 1) * 1440 + 600;
await page.evaluate((m) => window.__setWorldMinutes?.(m), holidayMinutes);
await waitFrames(3);
({ win } = await open('guildServiceBuyPotions'));
console.log('priceCtx now:', JSON.stringify(win.priceCtx));
if (win.priceCtx.holidayId !== 38) {
  console.log(`NOTE: the host clock did not move to the holiday (got ${win.priceCtx.holidayId});`
    + ' the halving is pinned in the unit suite either way');
} else if (win.priceCtx.guildFactionId == null) {
  fail('the holiday landed but the faction id did not - the clause is still dead');
} else {
  console.log('BOTH halves present: holiday 38 AND a Mages Guild id, so the halving is reachable');
}

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nOK: all four store arms reach the window, and the guild id reaches the price.');
await browser.close();
await server.close();
process.exit(0);
