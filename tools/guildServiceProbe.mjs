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
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5201, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (/guild|interior|static/i.test(m.text())) console.log('[page]', m.text()); });
await page.goto('http://localhost:5201/?shot&play&exterior&time=12:00');
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
  const servicer = npcs.find((n) => n.service);
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

// The service button: a non-member asking a member-only service gets
// the members-only refusal, not silence.
await page.keyboard.press('KeyS');
await waitFrames(6);
console.log('after service click:', await page.evaluate(() => window.__guildOverlay()));
await page.screenshot({ path: '/home/claude/guild-service.png' });

// The join button: the eligibility box, whichever way it lands.
await page.keyboard.press('Escape');
await waitFrames(4);
await page.evaluate((i) => window.__activateNpc(i), opened.servicer.i);
await waitFrames(8);
await page.keyboard.press('KeyJ');
await waitFrames(6);
console.log('after join click:', await page.evaluate(() => window.__guildOverlay()));
await page.screenshot({ path: '/home/claude/guild-join.png' });

console.log('OK');
await browser.close();
await server.close();
process.exit(0);
