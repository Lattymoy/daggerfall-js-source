// HT1/TEX1/HT2 - THE TORCH IN THE HAND, end to end in a real browser.
//
// The audit Mac asked for after HT2 ("ensure youre not just guessing
// and this actually works"): the pack's act and the mod's sprite are
// two halves of one question, so this probe runs BOTH over ONE entity.
// It lights a torch through the enhanced pack's card, then mounts the
// Handheld Torches component on a REAL Renderer over a real WebGL2
// context, lets it fetch and decode its OWN vendored PNGs, and asks
// whether a frame of the torch actually reaches the screen.
//
// WHAT IT FOUND, and why the two switches below are set by hand: BOTH
// of the switches that make a lit torch VISIBLE are off by default,
// and both defaults are faithful.
//   - `Modules.Sprite` (the mod's own modsettings.json ships
//     `Sprite = False`) gates the first-person hand. With it off,
//     `draw()` returns false and nothing is in your hand.
//   - `Enhancements/PlayerTorchFromItems` (DFU's own defaults.ini
//     ships False) gates the LIGHT the torch casts.
// So as those two ship, lighting a torch is invisible: no hand, no
// light. Both are reachable - the first on the Mods pane under
// Handheld Torches, the second in Settings as "Torches Light Your
// Way".
//
// MODS-ON (2026-09-14) answered that: Mac's call was "all mods should
// be on by default", so BOTH now default on in the port and this probe
// passes on stock settings - `SPRITE_ON=1` is kept only to force the
// module on if the pane's default is ever turned back.
//
//     npx vite --port 5199 &
//     node tools/ht1HandProbe.mjs
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:5199';
const out = [];
const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`${BASE}/play/?skin=enhanced`, { waitUntil: 'networkidle' });
await page.waitForSelector('#enhanced-menu .doorbtn', { timeout: 20000 });
await page.locator('#enhanced-menu .doorbtn.door-new').first().click();
await page.getByRole('button', { name: 'Begin', exact: true }).click();
await page.waitForSelector('#enhanced-menu', { state: 'detached', timeout: 20000 });
await page.waitForFunction(() => document.body.textContent.includes('boot failed'), null, { timeout: 15000 }).catch(() => {});

check('the browser has WebGL2 at all', await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2')));

// 1. the PACK lights the torch (the HT2 act), on the same entity the rig will read
await page.evaluate(async () => {
  const { createInventoryWindow } = await import('/src/ui/inventoryDoor.js');
  const { TEMPLATES } = await import('/src/systems/useItem.js');
  const torch = () => ({ name: 'Torch', group: 'UselessItems2', templateIndex: TEMPLATES.Torch, stackCount: 1, currentCondition: 50, maxCondition: 50 });
  const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48, speed: 50 }, items: [torch()], activeEffects: [] };
  globalThis.__ent = e;
  globalThis.__slot = createInventoryWindow({ entity: e, items: () => e.items, wagonItems: () => [] });
});
await page.waitForSelector('#enhanced-inventory', { timeout: 20000 });   // one torch: the Weapons page it opens on is empty
await page.locator('#enhanced-inventory .packtab', { hasText: 'Misc' }).first().click();
await page.waitForSelector('#enhanced-inventory .itemrow', { timeout: 20000 });
await page.locator('#enhanced-inventory .itemrow', { hasText: 'Torch' }).first().click();
await page.locator('#enhanced-inventory .acts button', { hasText: 'Light' }).first().click();
check('the pack lit the torch on the shared entity',
  await page.evaluate(() => globalThis.__ent.lightSource === globalThis.__ent.items[0]));

// 2. the MOD then loads its real sprites on a real Renderer and draws one
await page.evaluate((v) => { globalThis.__spriteOn = v; }, !!process.env.SPRITE_ON);
const r = await page.evaluate(async () => {
  const { createHandheldTorches, readTorchSettings, HANDHELD_TORCHES_VENDOR } = await import('/src/systems/handheldTorches.js');
  const { MOD_SETTINGS } = await import('/src/systems/modSettings.js');
  const { Renderer } = await import('/src/render/renderer.js');
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 400;
  document.body.append(cv);
  const renderer = new Renderer(cv);
  const store = Object.fromEntries(Object.entries(MOD_SETTINGS[HANDHELD_TORCHES_VENDOR].keys).map(([k, d]) => [k, d.default]));
  if (globalThis.__spriteOn) store['Modules.Sprite'] = true;
  const warns = []; const hadWarn = console.warn; console.warn = (...a) => { warns.push(a.map(String).join(' ')); hadWarn(...a); };
  const h = createHandheldTorches({ settings: () => readTorchSettings(() => store), audio: null, say: () => {}, torches: () => null });
  const e = globalThis.__ent;
  const c = {
    renderer, canvas: cv, entity: e, machine: { state: 'Idle' }, sheathed: false, usingRightHand: true,
    castPlaying: false, spellArmed: false, thirdPerson: false, climbing: false, swimming: false, transformedLycanthrope: false,
    motion: { grounded: true, standing: true, speedRatio: 1, baseSpeed: 1, localVel: [0, 0, 0] }, look: [0, 0], swingHeld: false, cursorActive: false,
    camera: () => ({ pos: [0, 1.7, 0], feet: [0, 0, 0], yaw: 0, pitch: 0, forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }),
    collider: () => null, keyDown: () => false, sheathWeapons: () => {},
  };
  h.update(0.016, c); h.lateUpdate(0.016, c);
  await h._w.texturesLoading;                    // the real fetch + decode + upload
  for (let i = 0; i < 240; i++) { h.update(0.016, c); h.lateUpdate(0.016, c); }   // let the rest smoothing settle
  const drew = h.draw(renderer, cv);
  console.warn = hadWarn;
  return {
    textures: h._w.textures.length,
    torchFrames: h._w.animTorchLength, lanternFrames: h._w.animLanternLength,
    current: !!h._w.currentTexture?.tex,
    size: h._w.currentTexture ? [h._w.currentTexture.width, h._w.currentTexture.height] : null,
    freeHand: h.hasFreeHand, drew, rect: h.rect, warns,
    lit: e.lightSource?.templateIndex ?? null,
  };
});
console.log('   component:', JSON.stringify(r));
check('the mod loaded all 8 vendored sprites', r.textures === 8, `${r.textures}`);
check('four torch frames and four lantern frames', r.torchFrames === 4 && r.lanternFrames === 4, `${r.torchFrames}/${r.lanternFrames}`);
check('no warning from the sprite load', r.warns.length === 0, r.warns.join(' | '));
check('a free hand holds it', r.freeHand === true);
check('the sprite has a GL texture of a real size', r.current && r.size[0] > 1 && r.size[1] > 1, JSON.stringify(r.size));
check('draw() actually drew the torch', r.drew === true);
check('...on screen, not off it', r.rect.w > 0 && r.rect.h > 0 && r.rect.y < 400, JSON.stringify(r.rect));
check('no page errors anywhere', errs.length === 0, errs.join(' | '));
await browser.close();
console.log(out.every(Boolean) ? '\nALL OK' : '\nFAILURES');
process.exit(out.every(Boolean) ? 0 : 1);
