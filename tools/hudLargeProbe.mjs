// U45 probe: the classic bottom bar, live, in a real town.
//
// The unit tests drive the geometry and the two cycles over fixtures.
// This proves the HOST half, which is where every previous slice's
// bugs lived: that the setting nothing read now turns the bar ON,
// that all four ARENA2 files decode and upload, that the eleven
// panels reach real windows through the SAME doors the keyboard uses,
// and that the mode panel walks its own cycle - not the keyboard's.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5220, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
await page.goto('http://localhost:5220/?shot&play&exterior&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });

const fail = (m) => { console.log('FAIL:', m); process.exit(1); };
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const bar = () => page.evaluate(async () => {
  const m = await import('/src/ui/hud.js');
  const b = m.largeHudBar();
  return b ? JSON.stringify(b) : null;
});
const setLarge = (on) => page.evaluate(async (v) => {
  const s = await import('/src/systems/settings.js');
  s.setValue('GUI', 'LargeHUD', v ? 'True' : 'False');
}, on);

console.log('== THE SETTING NOTHING READ ==');
if (await bar() !== null) fail('the bar drew itself with LargeHUD off');
console.log('off:', await bar());
await setLarge(true);
await waitFrames(4);
// the art loads on the first frame the setting is on, so give it one
await page.waitForFunction(async () => {
  const m = await import('/src/ui/hud.js');
  return m.largeHudBar() !== null;
}, null, { timeout: 60000 });
const b = JSON.parse(await bar());
console.log('on:', JSON.stringify(b));
if (b.w !== 1280) fail(`docked spans the screen width: got ${b.w}`);
if (Math.abs(b.h - 46 * (1280 / 320)) > 0.01) fail(`docked height is in proportion: got ${b.h}`);
if (Math.abs((b.y + b.h) - 720) > 0.01) fail('docked is flush to the bottom');

console.log('\n== THE FOUR FILES ==');
const art = await page.evaluate(async () => {
  const m = await import('/src/ui/hudLarge.js');
  const o = m.largeHudOptions({}, window.__playerEntity);
  if (!o) return null;
  return {
    main: [o.art.main.w, o.art.main.h],
    modes: [o.art.modes.w, o.art.modes.h],
    colorBackground: [o.art.colorBackground.w, o.art.colorBackground.h],
    compassFrames: o.art.compass.length,
    compassSize: [o.art.compass[0].w, o.art.compass[0].h],
    head: o.art.head ? [o.art.head.w, o.art.head.h] : null,
    docked: o.docked, mode: o.mode,
  };
});
console.log(JSON.stringify(art));
if (!art) fail('largeHudOptions answered null with the setting on and the art loaded');
if (art.main[0] !== 320 || art.main[1] !== 46) fail('MAIN00I0.IMG is the 320x46 bar');
if (art.modes[0] !== 47 || art.modes[1] !== 92) fail('MAIN01I0.IMG is the 47x92 mode sheet');
if (art.colorBackground[0] !== 66 || art.colorBackground[1] !== 36) fail('MCOL00I0.CIF record 0 is 66x36');
if (art.compassFrames !== 32) fail(`CMPA00I0.BSS carries 32 frames, got ${art.compassFrames}`);
if (art.compassSize[0] !== 48 || art.compassSize[1] !== 40) fail('and each is 48x40');
if (!art.head) fail('the racial head did not load - the bar has an empty portrait');

console.log('\n== THE MODE PANEL WALKS ITS OWN CYCLE ==');
// The panel's cycle is Steal > Talk > Grab > Info; the keyboard's is
// Steal > Grab > Info > Talk. Driven through the real click router.
const clickPanel = (key, button = 0) => page.evaluate(async ([k, b]) => {
  const hl = await import('/src/ui/hudLarge.js');
  const hud = await import('/src/ui/hud.js');
  const pl = await import('/src/player/pointerLock.js');
  pl.setCursorActive(true);                       // IsLargeHUDInteractable
  const bar = hud.largeHudBar();
  const [x, y, w, h] = hl.LARGE_HUD_RECTS[k];
  const hit = hl.largeHudClick(bar, bar.x + (x + w / 2) * bar.s, bar.y + (y + h / 2) * bar.s, b);
  return hit ? JSON.stringify(hit) : null;
}, [key, button]);
const mode = () => page.evaluate(async () => (await import('/src/player/interactionMode.js')).getInteractionMode());
const setMode = (m) => page.evaluate(async (v) => {
  (await import('/src/player/interactionMode.js')).setInteractionMode(v);
}, m);

await setMode('steal');
const walk = [];
for (let i = 0; i < 4; i++) {
  const hit = JSON.parse(await clickPanel('interactionMode', 0));
  if (hit.action !== 'CycleModeForward') fail(`the mode panel posts CycleModeForward, got ${hit.action}`);
  await page.evaluate(async () => {
    const hl = await import('/src/ui/hudLarge.js');
    const im = await import('/src/player/interactionMode.js');
    im.setInteractionMode(hl.hudLargeNextMode(im.getInteractionMode()));
  });
  walk.push(await mode());
}
console.log('panel walk from steal:', walk.join(' > '));
if (walk.join(',') !== 'dialogue,grab,info,steal') fail(`the PANEL cycle is Steal>Talk>Grab>Info, got ${walk.join(',')}`);
await setMode('steal');
const kwalk = [];
for (let i = 0; i < 4; i++) {
  await page.evaluate(async () => {
    const im = await import('/src/player/interactionMode.js');
    im.setInteractionMode(im.nextInteractionMode());
  });
  kwalk.push(await mode());
}
console.log('keyboard walk from steal:', kwalk.join(' > '));
if (kwalk.join(',') !== 'grab,info,dialogue,steal') fail('the KEYBOARD cycle is the enum order');
if (walk.join(',') === kwalk.join(',')) fail('the two cycles must DIFFER - that is the DFU quirk');

console.log('\n== THE PANELS REACH REAL WINDOWS ==');
await setMode('grab');
for (const [key, button, want] of [['map', 0, 'AutoMap'], ['map', 2, 'TravelMap'],
  ['inventory', 0, 'Inventory'], ['head', 0, 'CharacterSheet'], ['rest', 0, 'Rest'],
  ['spellbook', 0, 'CastSpell'], ['options', 0, 'Escape'], ['compass', 0, 'Status']]) {
  const hit = JSON.parse(await clickPanel(key, button) ?? 'null');
  if (!hit) fail(`${key} is not hit-testable on the live bar`);
  if (hit.action !== want) fail(`${key} (button ${button}) posts ${want}, got ${hit.action}`);
  console.log(`  ${key}[${button}] -> ${hit.action}`);
}

console.log('\n== A REAL CLICK OPENS A REAL WINDOW ==');
await page.evaluate(async () => { (await import('/src/player/pointerLock.js')).setCursorActive(true); });
const inv = await page.evaluate(async () => {
  const hl = await import('/src/ui/hudLarge.js');
  const hud = await import('/src/ui/hud.js');
  const bar = hud.largeHudBar();
  const [x, y, w, h] = hl.LARGE_HUD_RECTS.inventory;
  const c = document.querySelector('canvas');
  const r = c.getBoundingClientRect();
  const px = bar.x + (x + w / 2) * bar.s, py = bar.y + (y + h / 2) * bar.s;
  c.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, button: 0,
    clientX: r.left + px * (r.width / c.width),
    clientY: r.top + py * (r.height / c.height),
  }));
  return true;
});
await waitFrames(4);
const talk = JSON.parse(await page.evaluate(() => window.__talk()));
console.log('overlay after clicking the panel:', JSON.stringify({ overlay: talk.overlay, native: talk.native }));
if (!talk.overlay) fail('clicking the INVENTORY panel opened nothing - the door is not connected');

console.log('\n== OFF AGAIN ==');
await page.keyboard.press('Escape');   // close the inventory the click opened
await waitFrames(2);
await setLarge(false);
await waitFrames(4);
if (await bar() !== null) fail('the bar survived the setting going off');
console.log('off:', await bar());

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nPASS');
await browser.close();
await server.close();
process.exit(0);
