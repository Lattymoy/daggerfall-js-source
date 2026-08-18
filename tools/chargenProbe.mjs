// S3c/U9 probe: chargen runs in the EXTERIOR host (it used to live
// only in the dungeon, so booting into a town left the player on the
// pre-chargen INTERIM entity), and the chosen RACE/GENDER/FACE drives
// the paperdoll.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?shot&play&exterior&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const key = async (k) => { await page.keyboard.press(k); await waitFrames(2); };
// the chargen overlay must be up on a fresh boot
await page.waitForFunction(() => JSON.parse(window.__talk()).overlay === true, null, { timeout: 60000 });
console.log('chargen overlay on boot:', JSON.parse(await page.evaluate(() => window.__talk())).overlay);
await waitFrames(2);
await page.screenshot({ path: '/home/claude/chargen-name.png' });
// name
for (const c of 'MAC') await key(c);
await key('Enter');
await waitFrames(2);
await page.screenshot({ path: '/home/claude/chargen-race.png' });
// race: Breton -> Redguard -> Nord -> DarkElf -> HighElf -> WoodElf -> Khajiit
for (let i = 0; i < 6; i++) await key('ArrowDown');
await key('Enter');            // gender
await key('ArrowDown');        // female
await key('Enter');            // face
for (let i = 0; i < 3; i++) await key('ArrowDown');
await waitFrames(2);
await page.screenshot({ path: '/home/claude/chargen-face.png' });
await key('Enter');            // class
await key('Enter');            // -> stats
// spend the stat pool, then each skill pool
const spend = async () => { for (let i = 0; i < 30; i++) await page.keyboard.press('='); await waitFrames(2); };
await spend();
await key('Enter');            // -> skills (gated until pool 0)
for (let row = 0; row < 9; row++) { await spend(); await page.keyboard.press('ArrowDown'); }
await waitFrames(2);
await key('Enter');
await waitFrames(4);
const e = await page.evaluate(() => {
  const p = window.__playerEntity;
  return { name: p.name, race: p.race, raceId: p.raceId, gender: p.gender, face: p.faceIndex,
    chargenDone: !!p.chargenDone, maxHealth: p.maxHealth, career: p.career?.name,
    skillsIsArray: Array.isArray(p.skills), overlay: JSON.parse(window.__talk()).overlay,
    // S3d: the real starting kit replaces the interim dagger
    items: (p.items ?? []).map((i) => `${i.name}${i.stackCount > 1 ? 'x' + i.stackCount : ''}`),
    worn: (p.equip?.slots ?? []).filter(Boolean).map((i) => i.name),
    gold: (p.items ?? []).find((i) => i.group === 'Currency')?.stackCount ?? 0 };
});
console.log('entity after chargen:', JSON.stringify(e));
if (!e.chargenDone) { console.log('CHARGEN DID NOT COMPLETE'); process.exit(1); }
if (e.race !== 'Khajiit' || e.gender !== 'female') { console.log('IDENTITY NOT APPLIED'); process.exit(1); }
if (!e.skillsIsArray) { console.log('SKILLS STILL THE INTERIM FLAT NUMBER'); process.exit(1); }
// S3d: AssignStartingGear - dressed, armed, funded, and NO interim dagger
if (e.gold !== 100) { console.log('STARTING GOLD WRONG', e.gold); process.exit(1); }
if (e.worn.length !== 2) { console.log('CLOTHES NOT WORN', JSON.stringify(e.worn)); process.exit(1); }
if (!e.items.includes('Spellbook')) { console.log('NO SPELLBOOK'); process.exit(1); }
if (e.items.includes('Dagger')) { console.log('THE INTERIM DAGGER SURVIVED CHARGEN'); process.exit(1); }
// the paperdoll must reload on the chosen identity
await waitFrames(10);
await page.keyboard.press('F6');
await waitFrames(10);
await page.screenshot({ path: '/home/claude/chargen-paperdoll.png' });
console.log('CHARGEN OK');
await browser.close(); await server.close();
