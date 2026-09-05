// The fist-crash repro + fix proof (Mac's report, 2026-08-18): a
// bare-handed swing in the DUNGEON host threw on the strike frame -
// WEAPON_SKILL[playerWeapon.weapon.name] with weapon null. Bare hands
// are a null weapon since U8h bound the rig to equip.slots[RightHand],
// and the DEFAULT state: starting weapons land in the bag unequipped
// (DFU adds them via AddItem, never equips). The exterior hosts
// guarded with ?.; the dungeon host had the raw deref at BOTH its
// swing sites - the strike-frame bow test (thrown on EVERY fist
// swing, reproduced at dungeonContext.js:1501 pre-fix) and the
// resolved melee tally.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', (e.stack ?? e.message).split('\n').slice(0, 3).join(' | ')); });
// nofoes: the strike-frame site fires with nothing in reach, which is
// exactly where the deref lived
await page.goto('http://localhost:5199/play/?shot&class=16&nofoes');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 240000 });
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const boot = await page.evaluate(async () => {
  const { EQUIP_SLOTS } = await import('/src/systems/equip.js');
  const p = window.__playerEntity;
  return { hand: p.equip?.slots?.[EQUIP_SLOTS.RightHand]?.name ?? null };
});
console.log('right hand at boot:', JSON.stringify(boot.hand), '(null = bare hands, the default)');
if (boot.hand !== null) { console.log('EXPECTED BARE HANDS AT BOOT'); process.exit(1); }
// ready the fists and swing via the touch tap (ClickToAttack); the
// machine reaches its strike frame within the wait
await page.evaluate(() => { window.__combat.toggleSheath(); window.__combat.clickAttack(); });
await waitFrames(40);
// and a second swing, for the state walk back through Idle
await page.evaluate(() => window.__combat.clickAttack());
await waitFrames(10);
await page.screenshot({ path: '/home/claude/fist-swing.png' });   // eyeball: the WEAPON10 fists mid-swing
await waitFrames(30);
console.log('fist swing errors:', errors.length);
if (errors.length) { console.log('FIST SWING STILL THROWS'); process.exit(1); }
console.log('FIST SWING OK');
await browser.close(); await server.close();
