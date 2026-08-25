// U23 probe: find a guild hall or temple in the exterior city, walk
// in, and click the service NPC standing inside - the GILD popup opens
// on real art, with the NPC's own service on its middle button.
//
// The seam this exercises is the one that did not exist before U23:
// interior StaticNPCs were scenery, and PlayerActivate's whole
// StaticNPCClick branch had no port. Everything else here (doors,
// entry, the interior context) already shipped.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const GUILDISH = new Set([11, 14]);   // GuildHall, Temple
const BUILT_SERVICES = new Set(['Training', 'Donate', 'CureDisease']);
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5201, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (/guild|interior|static/i.test(m.text())) console.log('[page]', m.text()); });
// T2: `class=16` SKIPS THE CHARGEN WIZARD. Without it the wizard holds
// townTalk's overlay slot and townTalk.keydown - FIRST in this host's
// keydown ladder (exterior.js:1046-1047) - swallows every
// page.keyboard.press below, so this probe pressed its keys into a
// character-creation screen it never knew was up.
// class=0 and not the usual 16: this probe walks into THE MAGES GUILD,
// and a Warrior is turned away at the door ("I am sad to say that you
// are ineligible") - which the de-trapped run reported the moment the
// join keypress started arriving at all.
await page.goto('http://localhost:5201/?shot&play&exterior&time=12:00&class=0');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });

const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};

const doors = JSON.parse(await page.evaluate(() => JSON.stringify(window.__doors())));
const picks = [];
for (let i = 0; i < doors.length; i++) {
  const b = JSON.parse(await page.evaluate((j) => window.__buildingAt(j), i));
  if (b && GUILDISH.has(b.buildingType)) picks.push({ i, b, door: doors[i] });
}
console.log(`guild/temple doors: ${picks.length} of ${doors.length}`);
if (!picks.length) { console.log('NO GUILD DOOR IN THIS CITY'); process.exit(1); }

let opened = null;
for (const pick of picks) {
  const { pos, normal } = pick.door;
  await page.evaluate(([x, y, z, yaw]) => window.__pose(x, y, z, yaw, -0.05),
    [pos[0] + normal[0] * 1.5, pos[1] - 1.2, pos[2] + normal[2] * 1.5, Math.atan2(-normal[0], -normal[2])]);
  if (!await page.evaluate(() => window.__enter())) continue;
  await waitFrames(8);
  const building = JSON.parse(await page.evaluate(() => window.__building()));
  const npcs = JSON.parse(await page.evaluate(() => window.__staticNpcs()) ?? 'null') ?? [];
  console.log(`door ${pick.i}: ${JSON.stringify(building)} people=${npcs.length}`,
    JSON.stringify(npcs.filter((n) => n.service)));
  // U24: prefer an NPC whose service the port can actually perform,
  // so the probe exercises a FLOW rather than the "not yet" arm.
  const BUILT = new Set(['Training', 'Donate', 'CureDisease']);
  const servicer = npcs.find((n) => BUILT.has(n.service)) ?? npcs.find((n) => n.service);
  if (servicer) {
    if (!servicer.w) { console.log('NPC HAS NO BILLBOARD EXTENT - it would not be an activation target'); process.exit(1); }
    await page.evaluate((i) => window.__activateNpc(i), servicer.i);
    await waitFrames(10);
    const overlay = JSON.parse(await page.evaluate(() => window.__guildOverlay()) ?? 'null');
    console.log('popup:', JSON.stringify(overlay));
    if (overlay) { opened = { building, servicer, overlay }; break; }
    console.log('  (no popup - route fell through to talk)');
  }
  await page.evaluate(() => window.__exit());
  await waitFrames(4);
}
if (!opened) { console.log('NO GUILD SERVICE POPUP OPENED'); process.exit(1); }
await page.screenshot({ path: '/home/claude/guild-popup.png' });

// Give the player gold so the paid services can actually transact.
await page.evaluate(() => {
  const e = window.__playerEntity;
  e.items = e.items ?? [];
  const g = e.items.find((i) => i.group === 'Currency');
  if (g) g.stackCount = 20000; else e.items.push({ group: 'Currency', name: 'Gold pieces', stackCount: 20000 });
});

// JOIN first - Training is member-only, so a non-member would only
// ever see the refusal and the flow would never be reached.
await page.keyboard.press('KeyJ');
await waitFrames(6);
console.log('join box:', await page.evaluate(() => window.__guildOverlay()));
await page.keyboard.press('KeyY');
await waitFrames(6);
console.log('welcome:', await page.evaluate(() => window.__guildOverlay()));
await page.keyboard.press('Enter');
await waitFrames(4);
console.log('memberships:', await page.evaluate(() => JSON.stringify(window.__playerEntity.guildMemberships)));
await page.screenshot({ path: '/home/claude/guild-welcome.png' });

// Reopen the popup - it should now draw the MEMBER art (no join row).
await page.evaluate((i) => window.__activateNpc(i), opened.servicer.i);
await waitFrames(8);
console.log('popup as member:', await page.evaluate(() => window.__guildOverlay()));
await page.screenshot({ path: '/home/claude/guild-member.png' });

// The service button, now that it is allowed.
await page.keyboard.press('KeyS');
await waitFrames(6);
console.log('after service click: popup=', await page.evaluate(() => window.__guildOverlay()),
  'flow=', await page.evaluate(() => window.__serviceFlow()));
await page.screenshot({ path: '/home/claude/guild-service.png' });

const gold0 = await page.evaluate(() => window.__playerEntity.items.find((i) => i.group === 'Currency').stackCount);
await page.keyboard.press('KeyY');
await waitFrames(6);
console.log('after Y:', await page.evaluate(() => window.__serviceFlow()));
await page.screenshot({ path: '/home/claude/guild-flow.png' });
await page.keyboard.press('Enter');
await waitFrames(8);
const gold1 = await page.evaluate(() => window.__playerEntity.items.find((i) => i.group === 'Currency').stackCount);
const skillUses = await page.evaluate(() => JSON.stringify(Object.entries(window.__playerEntity.skillUses ?? {}).filter(([, v]) => v > 0)));
console.log('after picking a skill:', await page.evaluate(() => window.__serviceFlow()));
console.log('gold', gold0, '->', gold1, 'skillUses', skillUses);
await page.screenshot({ path: '/home/claude/guild-flow2.png' });
await page.keyboard.press('Enter');
await waitFrames(4);
console.log('flow closed:', await page.evaluate(() => window.__serviceFlow()));

console.log('OK');
await browser.close();
await server.close();
process.exit(0);
