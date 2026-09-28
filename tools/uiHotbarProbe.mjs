// UI2 (2026-09-27, the Plus UI pass - bible/10-UI/Slots-Hotbar-Status.md; Mac: "The hotbar also is missing sprite
// icons like spells, and you should be able to slot spells and different items") - THE HOTBAR, DRAWN FROM THE REAL
// ARENA2 AND MEASURED.
//
// The REAL enhanced HUD (ui/enhancedHud.js drawEnhancedHud) with the hotbar chosen, over the real sheets, its slots
// holding every kind a slot now takes: three spells (their ICON00I0 icons off the real sheet, one of them a spell the
// book has lost), a potion stack, a longsword, a kite shield, a cuirass, a ring, three rubies, a book, seven herbs, a
// torch - and the crossbar's sixteen at a phone's width. At a desktop (1x, 2x), a laptop (1.25x) and a phone (2.625x) it reads:
//   - every spell slot shows its icon - a fitted picture, not its initials - the lost one too, dimmed;
//   - every item slot shows a fitted picture the page does not resample (bitmap = drawn size x the device ratio,
//     through the HUD's own scale), none past its face;
//   - a stack's count on its slot (the potion, the rubies, the herbs), none on a single piece;
//   - a tiered piece's outline is the SLOT's own frame, spanning it, in its tier's colour (UI1b) - no icon in an icon;
//   - the diamond's spell chip (the diamond chosen instead) wears its spell's icon before its name.
// Every state is photographed.
//
// IT RUNS ON VITE'S OWN DEV SERVER, whose /arena2/ mount serves the local game data (never the repo's).
//
//     node tools/uiHotbarProbe.mjs                    -> shots (tools/shots/, or SHOT_DIR) and a report
//     PROBE_PORT=<n> node tools/uiHotbarProbe.mjs     -> reuse a dev server already listening there
import { mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'uihotbar.tmp.html';
const OUT = process.env.SHOT_DIR ?? join(ROOT, 'tools/shots');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>UI2 probe</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:repeating-linear-gradient(45deg,#3b4a3a 0 14px,#324031 14px 28px)}</style></head><body>
<script type="module">
import { setPref } from '/src/systems/uiPrefs.js';
import { setItemFields, mintCondition } from '/src/systems/itemTemplates.js';
import { createWeapon } from '/src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '/src/systems/armorMaterials.js';
import { potionRecipeKeys } from '/src/systems/potions.js';
import * as HB from '/src/systems/quickslots.js';
import { drawEnhancedHud } from '/src/ui/enhancedHud.js';

setPref('lootRarity', true);
const armour = (t) => mintCondition(setItemFields({ group: 'Armor', templateIndex: t, material: ARMOR_MATERIAL.Steel, flags: 0 }));
const tier = (it, rarity) => { it.rarity = rarity; it.isIdentified = true; it.affixes = []; return it; };   // UI1b: the slot's own frame wears it
const thing = (group, t, n = 1) => { const it = mintCondition(setItemFields({ group, templateIndex: t })); if (n > 1) it.stackCount = n; return it; };
const [HEAL] = potionRecipeKeys();
const potion = { group: 'UselessItems1', templateIndex: 83, name: 'Glass Bottle', potionRecipeKey: HEAL, stackCount: 3, currentCondition: 1, maxCondition: 1 };
const spells = [
  { index: 1, name: 'Fireball', icon: 1, element: 1, rangeType: 2, effects: [] },
  { index: 2, name: 'Heal', icon: 19, element: 4, rangeType: 0, effects: [] },
  { index: 3, name: 'Frostbite', icon: 33, element: 2, rangeType: 1, effects: [] },
];
const e = { isPlayer: true, name: 'Aelwyn', career: { name: 'Spellsword' }, level: 12,
  stats: { strength: 50, endurance: 48, willpower: 50, intelligence: 50, agility: 50, speed: 50, personality: 50, luck: 50 },
  skills: new Array(35).fill(40), health: 80, maxHealth: 100, fatigue: 150, maxFatigue: 200, magicka: 14, maxMagicka: 20,
  // the keyboard's ten show slots 1-10: three spells and seven items; the shield and the torch ride the crossbar's six
  items: [potion, tier(createWeapon(120, 3), 'legendary'), tier(armour(102), 'rare'), tier(thing('Jewellery', 135), 'magic'), thing('Gems', 0, 3), thing('PlantIngredients1', 10, 7),
    { ...thing('Books', 277), message: 1234 }, armour(111), thing('UselessItems2', 247)],
  spells: [...spells], activeEffects: [], career2: null };
HB.clearQuickslots();
// AUDIT UI B2: an ITEM in slot 1 - the bar had fitted every picture to slot 1's face, and a spell's face stands further in
const fill = () => {
  HB.setHotbarSlot(0, HB.hotbarEntryForItem(e.items[0]));
  HB.setHotbarSlot(1, HB.hotbarEntryForSpell(spells[0]));
  HB.setHotbarSlot(2, HB.hotbarEntryForSpell(spells[1]));
  HB.setHotbarSlot(3, HB.hotbarEntryForSpell(spells[2]));
  e.items.slice(1).forEach((it, i) => HB.setHotbarSlot(4 + i, HB.hotbarEntryForItem(it)));
};
fill();
e.spells = spells.slice(0, 2);   // Frostbite has left the book: its slot keeps its icon, a ghost
let mode = 'hotbar';
globalThis.__mode = (m) => { mode = m; setPref('quickbarStyle', m === 'hotbar' ? 'hotbar' : 'diamond'); if (m !== 'hotbar') { HB.setSpellQuickslot(spells[0]); HB.assignQuickslot('c1', potion); HB.assignQuickslot('c2', e.items[4]); } };
globalThis.__mode('hotbar');
function frame() { drawEnhancedHud(e, 0.25, 1 / 60, {}); requestAnimationFrame(frame); }
frame();
const box = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
const pic = (img) => {
  if (!img || !img.getAttribute('src') || getComputedStyle(img).display === 'none') return null;
  const r = img.getBoundingClientRect(), d = devicePixelRatio;
  return { fit: img.classList.contains('fit'), nat: [img.naturalWidth, img.naturalHeight], shown: [r.width, r.height],
    resampled: Math.abs(img.naturalWidth - r.width * d) > 0.75 || Math.abs(img.naturalHeight - r.height * d) > 0.75 };
};
globalThis.__slots = () => [...document.querySelectorAll('.hb .hb-slot')].filter((n) => n.offsetWidth > 0).map((n) => {
  const face = n.querySelector('.hb-face');
  return { slot: Number(n.dataset.slot), title: n.title, rarity: n.dataset.rarity ?? null,
    frame: getComputedStyle(n.querySelector('.hb-frame')).borderTopColor, frameBox: box(n.querySelector('.hb-frame')), spell: n.classList.contains('hb-spell'), ghost: n.classList.contains('hb-gone'),
    pic: pic(n.querySelector('.hb-icon')), glyph: n.querySelector('.hb-glyph')?.textContent ?? '', count: n.querySelector('.hb-count')?.textContent ?? '',
    face: box(face), slotBox: box(n) };
});
globalThis.__cells = () => [...document.querySelectorAll('.hud-qcell .hud-qicon')].map(pic).filter(Boolean);
globalThis.__chip = () => { const c = document.querySelector('.hud-qspell'); return c ? { on: c.classList.contains('on'), icon: pic(c.querySelector('.hud-qspicon')), name: c.querySelector('.hud-qspname')?.textContent, chip: box(c) } : null; };
</script></body></html>`;

mkdirSync(OUT, { recursive: true });
const vite = process.env.PROBE_PORT ? null : await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1', watch: null }, logLevel: 'error' });
if (vite) await vite.listen();
const port = process.env.PROBE_PORT ?? vite.config.server.port ?? vite.httpServer.address().port;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };
const VIEWS = [
  { name: 'desktop-1x', viewport: { width: 1440, height: 900 }, dpr: 1 },
  { name: 'desktop-2x', viewport: { width: 1440, height: 900 }, dpr: 2 },
  { name: 'laptop-1.25x', viewport: { width: 1366, height: 768 }, dpr: 1.25 },   // AUDIT UI B2: where a spell's icon ran past its face
  { name: 'phone-2.625x', viewport: { width: 393, height: 851 }, dpr: 2.625, isMobile: true, hasTouch: true },
];
try {
  await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: v.viewport, isMobile: !!v.isMobile, hasTouch: !!v.hasTouch, deviceScaleFactor: v.dpr });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.route('**/tools/arena2/**', (route) => route.continue({ url: route.request().url().replace('/tools/arena2/', '/arena2/') }));
    await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?skin=enhanced`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => typeof globalThis.__slots === 'function' && globalThis.__slots().length >= 10, null, { timeout: 90000 });
    await page.waitForFunction(() => globalThis.__slots().filter((s) => s.title && s.title !== `Slot ${s.slot + 1}`).every((s) => s.pic?.nat?.[0] > 0), null, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);   // a second pass of the bar's measure (its FIT_TTL)
    const slots = await page.evaluate(() => globalThis.__slots());
    const tag = v.name;
    const filled = slots.filter((s) => s.title && s.title !== `Slot ${s.slot + 1}`);
    const spells = filled.filter((s) => s.spell);
    check(`${tag}: three spell slots, each its ICON00I0 icon, no initials`, spells.length === 3 && spells.every((s) => s.pic && s.pic.fit && !s.glyph),
      JSON.stringify(spells.map((s) => ({ t: s.title, g: s.glyph, p: s.pic }))));
    check(`${tag}: the lost spell keeps its icon, a ghost`, spells.some((s) => s.ghost && s.pic));
    const items = filled.filter((s) => !s.spell);
    check(`${tag}: every item slot a fitted picture (${items.length})`, items.length >= 7 && items.every((s) => s.pic?.fit), items.filter((s) => !s.pic?.fit).map((s) => s.title).join(', '));
    const all = filled.filter((s) => s.pic);
    check(`${tag}: the page resamples none of them`, all.every((s) => !s.pic.resampled), all.filter((s) => s.pic.resampled).map((s) => `${s.title} ${s.pic.nat} @ ${s.pic.shown.map((x) => x.toFixed(1))}`).join('; '));
    check(`${tag}: none past its face`, all.every((s) => s.pic.shown[0] <= s.face.w + 0.5 && s.pic.shown[1] <= s.face.h + 0.5));
    const counts = Object.fromEntries(filled.map((s) => [s.title.split(' (')[0], s.count]));
    check(`${tag}: the stacks show their counts, a single piece none`, Object.entries(counts).filter(([, c]) => c).length >= 3
      && filled.filter((s) => /Ruby|Red Flowers|Potion|Glass/.test(s.title)).every((s) => Number(s.count) > 1)
      && filled.filter((s) => /Cuirass|Ring|Book|Longsword/.test(s.title)).every((s) => !s.count), JSON.stringify(counts));
    // UI1b: A TIERED ITEM'S OUTLINE IS THE SLOT'S OWN EDGE - the frame spans the slot, and wears the tier's colour
    const tiered = filled.filter((s) => s.rarity);
    check(`${tag}: the tiered slots' own frames wear their tiers (${tiered.map((s) => s.rarity).join(', ')})`, tiered.length === 3
      && tiered.every((s) => s.frame !== filled.find((x) => !x.rarity && !x.spell)?.frame && Math.abs(s.frameBox.w - s.slotBox.w) < 0.5 && Math.abs(s.frameBox.h - s.slotBox.h) < 0.5),
      JSON.stringify(tiered.map((s) => [s.rarity, s.frame, s.frameBox?.w, s.slotBox.w])));
    console.log(`     ${filled.map((s) => `${s.title.slice(0, 16)}${s.count ? `x${s.count}` : ''}=${s.pic ? s.pic.shown.map((x) => x.toFixed(0)).join('x') : 'none'}`).join(', ')}`);
    await page.locator('.hb').screenshot({ path: join(OUT, `ui2-hotbar-${tag}.png`) }).catch(() => {});
    // the diamond instead: its spell chip wears the icon
    await page.evaluate(() => globalThis.__mode('diamond'));
    await page.waitForFunction(() => globalThis.__chip()?.icon?.nat?.[0] > 0, null, { timeout: 20000 }).catch(() => {});
    const chip = await page.evaluate(() => globalThis.__chip());
    check(`${tag}: the diamond's spell chip wears its spell's icon before its name`, !!chip?.on && !!chip.icon?.fit && chip.name === 'Fireball' && !chip.icon.resampled, JSON.stringify(chip));
    await page.waitForFunction(() => globalThis.__cells().length >= 1 && globalThis.__cells().every((p) => p.nat[0] > 0), null, { timeout: 20000 }).catch(() => {});
    const cells = await page.evaluate(() => globalThis.__cells());
    check(`${tag}: the diamond's cells draw fitted pictures, unresampled (${cells.length})`, cells.length >= 1 && cells.every((p) => p.fit && !p.resampled), JSON.stringify(cells));
    await page.locator('.hud-quick').screenshot({ path: join(OUT, `ui2-diamond-${tag}.png`) }).catch(() => {});
    check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
} finally {
  await unlink(join(ROOT, `tools/${PAGE_NAME}`)).catch(() => {});
  await browser.close();
  await vite?.close();
}
console.log(failures ? `\n${failures} FAILED` : '\nall ok');
process.exit(failures ? 1 : 0);
