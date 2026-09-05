// U39 probe: find a tavern in the exterior city, walk in, click the
// innkeeper, and drive BOTH chains the panel raises - rent a room and
// buy a meal - against the live game.
//
// The seam this exercises is the one the unit tests cannot see: the
// host wiring. staticNpcRoute has answered { merchant, 'tavern' } since
// G8 and NOTHING consumed it, so the innkeeper fell through to talk.
// A source-text pin can only prove the arm was TYPED; this proves the
// panel opens, the buttons route, gold leaves the purse and a rental
// record lands on the entity.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const TAVERN = 15;   // BUILDING_TYPES.Tavern
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5211, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
page.on('console', (m) => { if (/tavern|interior static/i.test(m.text())) console.log('[page]', m.text()); });
// T2: `class=16` SKIPS THE CHARGEN WIZARD. Without it the wizard holds
// townTalk's overlay slot and townTalk.keydown - FIRST in this host's
// keydown ladder (exterior.js:2041-2043) - swallows every
// page.keyboard.press below, so this probe pressed its keys into a
// character-creation screen it never knew was up.
await page.goto('http://localhost:5211/play/?shot&play&exterior&time=12:00&class=16');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });

const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const overlay = () => page.evaluate(() => window.__tavernOverlay());
const fail = (msg) => { console.log('FAIL:', msg); process.exit(1); };

const doors = JSON.parse(await page.evaluate(() => JSON.stringify(window.__doors())));
const picks = [];
for (let i = 0; i < doors.length; i++) {
  const b = JSON.parse(await page.evaluate((j) => window.__buildingAt(j), i));
  if (b && b.buildingType === TAVERN) picks.push({ i, door: doors[i] });
}
console.log(`tavern doors: ${picks.length} of ${doors.length}`);
if (!picks.length) fail('NO TAVERN DOOR IN THIS CITY');

let opened = null;
for (const pick of picks) {
  const { pos, normal } = pick.door;
  await page.evaluate(([x, y, z, yaw]) => window.__pose(x, y, z, yaw, -0.05),
    [pos[0] + normal[0] * 1.5, pos[1] - 1.2, pos[2] + normal[2] * 1.5, Math.atan2(-normal[0], -normal[2])]);
  if (!await page.evaluate(() => window.__enter())) continue;
  await waitFrames(8);
  const building = JSON.parse(await page.evaluate(() => window.__building()));
  const npcs = JSON.parse(await page.evaluate(() => window.__staticNpcs()) ?? 'null') ?? [];
  console.log(`door ${pick.i}: ${JSON.stringify(building)} people=${npcs.length}`);
  for (const npc of npcs) {
    await page.evaluate((i) => window.__activateNpc(i), npc.i);
    await waitFrames(10);
    const o = JSON.parse(await overlay() ?? 'null');
    if (o?.tavern) { opened = { building, npc, o }; break; }
  }
  if (opened) break;
  await page.evaluate(() => window.__exit());
  await waitFrames(4);
}
if (!opened) fail('NO TAVERN PANEL OPENED - the innkeeper still falls through to talk');
console.log('panel:', JSON.stringify(opened.o), 'at', JSON.stringify(opened.building));
await page.screenshot({ path: '/home/claude/tavern-panel.png' });

// A purse the innkeeper can actually take from, and an empty hunger
// clock so the meal arm is reachable.
await page.evaluate(() => {
  const e = window.__playerEntity;
  e.items = e.items ?? [];
  const g = e.items.find((i) => i.group === 'Currency');
  if (g) g.stackCount = 20000; else e.items.push({ group: 'Currency', name: 'Gold pieces', stackCount: 20000 });
  e.lastTimePlayerAteOrDrankAtTavern = 0;
  e.health = Math.max(1, Math.floor(e.maxHealth / 2));
});

// ---- THE ROOM CHAIN ------------------------------------------------
console.log('\n== ROOM ==');
await page.evaluate(() => window.__tavernClick('room'));
await waitFrames(6);
const field = JSON.parse(await overlay() ?? 'null');
console.log('day field:', JSON.stringify(field));
if (!field?.field) fail('the ROOM button did not raise the day field');
if (field.value !== '1') fail(`TextBox.Text should open on "1", got ${JSON.stringify(field.value)}`);

// type 3 over the pre-fill
await page.keyboard.press('Backspace');
for (const ch of '3') await page.keyboard.press(`Digit${ch}`);
await waitFrames(2);
console.log('typed:', JSON.parse(await overlay()).value);
await page.keyboard.press('Enter');
await waitFrames(6);
const offer = JSON.parse(await overlay() ?? 'null');
console.log('offer:', JSON.stringify(offer));
if (offer?.buttons !== 'YesNo') fail('the price offer did not appear with Yes/No');
const priceSaid = Number(/(\d[\d,]*)/.exec(offer.box?.replace(/[^\d ,]/g, ' ') ?? '')?.[1]?.replace(/,/g, ''));
await page.screenshot({ path: '/home/claude/tavern-offer.png' });

const gold0 = offer.gold;
await page.keyboard.press('KeyY');
await waitFrames(8);
const after = JSON.parse(await page.evaluate(() => JSON.stringify({
  rooms: window.__playerEntity.rentedRooms ?? [],
  gold: (window.__playerEntity.items.find((i) => i.group === 'Currency') ?? {}).stackCount,
})));
console.log('after YES:', JSON.stringify(after));
if (after.rooms.length !== 1) fail('no room record was minted');
if (after.gold >= gold0) fail(`gold did not leave the purse (${gold0} -> ${after.gold})`);
const room = after.rooms[0];
if (typeof room.expiryMinutes !== 'number' || typeof room.allocatedBedIndex !== 'number') {
  fail(`the rental record is malformed: ${JSON.stringify(room)}`);
}
console.log(`RENTED: ${room.name} for ${gold0 - after.gold} gold (the offer said ${priceSaid}), bed ${room.allocatedBedIndex}`);
if (Number.isFinite(priceSaid) && gold0 - after.gold !== priceSaid) {
  fail(`the price CHARGED (${gold0 - after.gold}) is not the price OFFERED (${priceSaid})`);
}

// The panel is gone - ConfirmRenting closes it either way.
if (JSON.parse(await overlay() ?? 'null')) fail('the tavern window survived the confirm (:212 closes it first)');

// ---- THE RENEWAL PROMPT --------------------------------------------
console.log('\n== RENEWAL ==');
await page.evaluate((i) => window.__activateNpc(i), opened.npc.i);
await waitFrames(8);
await page.evaluate(() => window.__tavernClick('room'));
await waitFrames(6);
const renew = JSON.parse(await overlay() ?? 'null');
console.log('renewal prompt:', JSON.stringify(renew?.box));
if (!renew?.field) fail('the renewal did not raise a field');
if (renew.box === field.box) fail('a LIVE room still asks 5102 - the "additional days" prompt never lands');
if (/%dwr/.test(renew.box ?? '')) fail('the RoomHoursLeft macro was left unexpanded');
await page.keyboard.press('Escape');
await waitFrames(4);

// ---- THE FOOD CHAIN ------------------------------------------------
console.log('\n== FOOD ==');
await page.evaluate((i) => window.__activateNpc(i), opened.npc.i);
await waitFrames(8);
await page.evaluate(() => window.__tavernClick('food'));
await waitFrames(6);
const menu = JSON.parse(await overlay() ?? 'null');
console.log('menu:', JSON.stringify(menu?.picker));
if (!menu?.picker || menu.picker.length !== 11) fail(`the eleven-line menu did not open: ${JSON.stringify(menu)}`);
await page.screenshot({ path: '/home/claude/tavern-menu.png' });

const before = JSON.parse(await page.evaluate(() => JSON.stringify({
  gold: window.__playerEntity.items.find((i) => i.group === 'Currency').stackCount,
  health: window.__playerEntity.health,
})));
// pick row 3 (Wine, 3 gold) with the list picker's own keys
for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowDown'); await waitFrames(1); }
await page.keyboard.press('Enter');
await waitFrames(8);
const ate = JSON.parse(await page.evaluate(() => JSON.stringify({
  gold: window.__playerEntity.items.find((i) => i.group === 'Currency').stackCount,
  health: window.__playerEntity.health,
  lastAte: window.__playerEntity.lastTimePlayerAteOrDrankAtTavern,
})));
console.log('after the meal:', JSON.stringify(before), '->', JSON.stringify(ate));
if (ate.gold >= before.gold) fail('the meal was not paid for');
if (ate.health <= before.health) fail('the meal did not heal');
if (ate.health - before.health !== 2 * (before.gold - ate.gold)) {
  fail(`healing should be twice the price paid: +${ate.health - before.health} for ${before.gold - ate.gold} gold`);
}
if (!ate.lastAte) fail('the hunger clock was not stamped');

// ---- AND THE GATE IT SETS ------------------------------------------
console.log('\n== NOT HUNGRY ==');
await page.evaluate((i) => window.__activateNpc(i), opened.npc.i);
await waitFrames(8);
await page.evaluate(() => window.__tavernClick('food'));
await waitFrames(6);
const full = JSON.parse(await overlay() ?? 'null');
console.log('second helping:', JSON.stringify(full?.box), 'picker=', full?.picker);
if (full?.picker) fail('the four-hour hunger gate did not close');
if (!/not hungry/i.test(full?.box ?? '')) fail(`expected the "not hungry" line, got ${JSON.stringify(full?.box)}`);
await page.screenshot({ path: '/home/claude/tavern-full.png' });

if (errors.length) fail(`page errors: ${JSON.stringify(errors)}`);
console.log('\nOK: the tavern panel opens, rents, feeds and refuses a second helping');
await browser.close();
await server.close();
