// UI1 (2026-09-27, the Plus UI pass - bible/10-UI/Slots-Hotbar-Status.md; Mac: "make the actual inventory plots have
// the rarity frame with sprites enlarged properly, instead of the inventory icon just plopping into a slot") - THE
// SLOTS, DRAWN FROM THE REAL ARENA2 AND MEASURED.
//
// A pin can say the tile asks for a fitted picture and the sheet sizes the well; only a layout engine with the real
// records can say the sprite FILLS its well, is drawn at exactly the size it was made (the page resamples nothing), and
// that the corners - the key, the rune, the pips, the count, the padlock, the wear bar - do not land on each other. So
// the REAL pack (ui/inventoryDoor.js createInventoryWindow, the enhanced skin) is drawn here over the real sheets with a
// kit of every kind of picture the game mints - a staff (141px tall), a longsword (88x29), a cuirass, a helm, gems
// (11px), rings, potions, ingredients, arrows, a torch, a book, clothing - in every tier, one locked, one worn down,
// stacks of three sizes, and a loot pile beside it. At a desktop (1x and 2x), a laptop (1.25x) and a phone (2.625x):
//   - every grid slot is 64px (56 on the phone) around a 52px (44) well, five or more a row (six on a 393px phone);
//   - every picture is a fitted one: its bitmap is its drawn size times the device ratio (no resampling by the page),
//     its longest side at least three quarters of the box (or the cap's reach for a gem), never past it;
//   - a stack wears its count, bottom right, clear of the padlock and the wear bar;
//   - the hover card, the loot rows, the worn panels, the shelf and the drag ghost draw fitted pictures too.
// Every state is photographed.
//
// IT RUNS ON VITE'S OWN DEV SERVER, whose /arena2/ mount serves the local game data (never the repo's).
//
//     node tools/uiSlotsProbe.mjs                    -> shots (tools/shots/, or SHOT_DIR) and a report
//     PROBE_PORT=<n> node tools/uiSlotsProbe.mjs     -> reuse a dev server already listening there
import { mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'uislots.tmp.html';
const OUT = process.env.SHOT_DIR ?? join(ROOT, 'tools/shots');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>UI1 probe</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:repeating-linear-gradient(45deg,#3b4a3a 0 14px,#324031 14px 28px)}</style></head><body>
<script type="module">
import { setSigilOnline, setSigilRenown } from '/src/systems/sigil.js';
import { setSetsWearer } from '/src/systems/sigilSets.js';
import { equipItem } from '/src/systems/equip.js';
import { setItemFields, mintCondition } from '/src/systems/itemTemplates.js';
import { createWeapon } from '/src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '/src/systems/armorMaterials.js';
import { setPref } from '/src/systems/uiPrefs.js';
import { createInventoryWindow } from '/src/ui/inventoryDoor.js';
import { SLOT_BOX } from '/src/ui/iconFit.js';

setPref('lootRarity', true);
const tier = (it, rarity) => { if (rarity) { it.rarity = rarity; it.isIdentified = true; it.affixes = []; } return it; };
const weapon = (t, rarity, mat = 3) => tier(createWeapon(t, mat), rarity);
const armour = (t, rarity) => tier(mintCondition(setItemFields({ group: 'Armor', templateIndex: t, material: ARMOR_MATERIAL.Steel, flags: 0 })), rarity);
const thing = (group, t, n = 1, rarity = null) => { const it = tier(mintCondition(setItemFields({ group, templateIndex: t })), rarity); if (n > 1) it.stackCount = n; return it; };
const e = { isPlayer: true, name: 'Aelwyn', career: { name: 'Spellsword' }, level: 12,
  stats: { strength: 50, endurance: 48, willpower: 50, intelligence: 50, agility: 50, speed: 50, personality: 50, luck: 50 },
  skills: new Array(35).fill(40), health: 60, maxHealth: 100, fatigue: 150, maxFatigue: 200, magicka: 14, maxMagicka: 20,
  items: [], spells: [], activeEffects: [], career2: null };
setSetsWearer(() => e);
setSigilOnline(true); setSigilRenown(12);
function kit() {
  e.items.length = 0;
  const carry = (it) => { e.items.push(it); return it; };
  const wear = (it) => { e.items.push(it); equipItem(e, it); return it; };
  // worn: a longsword (a sigil), a cuirass, boots, an amulet, a ring
  const ls = weapon(120, 'rare'); ls.sigil = { power: 9, party: 3, xp: 1200 }; wear(ls);
  wear(armour(102, 'magic')); wear(armour(108, null)); wear(thing('Jewellery', 133, 1, 'legendary')); wear(thing('Jewellery', 135, 1, 'magic'));
  // the pack: every kind of picture, every tier
  carry(weapon(115, null));                      // a staff - the tallest record
  carry(weapon(113, 'legendary'));               // a dagger
  carry(weapon(124, 'magic'));                   // a mace
  const flail = carry(weapon(125, null)); flail.currentCondition = Math.round(flail.maxCondition * 0.2);   // worn down
  carry(weapon(122, 'rare'));                    // a claymore
  const bow = carry(weapon(130, 'aetheric')); bow.locked = true;   // a long bow, locked
  const arrows = carry(weapon(131, null)); arrows.stackCount = 40;   // arrows: a stack
  carry(armour(103, 'rare')); carry(armour(104, null)); carry(armour(105, 'legendary')); carry(armour(107, 'magic'));
  const shield = carry(armour(111, 'rare')); shield.locked = true;   // a kite shield, locked
  carry(thing('Gems', 0, 3)); carry(thing('Gems', 3, 1, 'rare'));
  const turquoise = carry(thing('Gems', 5, 12)); turquoise.locked = true;   // a locked stack: the count beside the padlock
  carry(thing('Jewellery', 134, 1, 'magic')); carry(thing('Jewellery', 138, 1));
  carry(thing('PlantIngredients1', 10, 7)); carry(thing('CreatureIngredients1', 33, 2)); carry(thing('MetalIngredients', 66, 25));
  carry(thing('MiscellaneousIngredients1', 55, 4));
  carry(thing('UselessItems2', 247, 3));         // torches
  carry(thing('Books', 277, 1)); carry(thing('MiscItems', 132, 1));
  carry(thing('MensClothing', 141, 1)); carry(thing('MensClothing', 150, 1, 'magic')); carry(thing('WomensClothing', 190, 1));
  carry(thing('ReligiousItems', 258, 1)); carry(thing('Drugs', 78, 2));
}
const pile = [];
globalThis.__openPack = (withPile) => {
  kit();
  pile.length = 0;
  if (withPile) pile.push(weapon(116, 'rare'), armour(106, null), thing('Gems', 1, 2, 'magic'), weapon(127, 'legendary'), thing('Jewellery', 136, 1));
  document.getElementById('enhanced-inventory')?.remove();
  const deps = { entity: e, items: () => e.items, wagonItems: () => [] };
  if (withPile) deps.loot = { items: () => pile };
  return !!createInventoryWindow(deps);
};
globalThis.__closePack = () => { document.getElementById('enhanced-inventory')?.remove(); document.querySelectorAll('.inv-tip,.inv-info,.dragghost').forEach((n) => n.remove()); };
globalThis.__tabs = () => [...document.querySelectorAll('#enhanced-inventory .packtab')].map((b) => b.textContent);
globalThis.__tabAt = (i) => { const b = document.querySelectorAll('#enhanced-inventory .packtab')[i]; b?.click(); return !!b; };
const box = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
const pic = (img, want) => {
  if (!img) return null;
  const r = img.getBoundingClientRect(), d = devicePixelRatio;
  return { fit: img.classList.contains('fit'), nat: [img.naturalWidth, img.naturalHeight], css: [r.width, r.height],
    resampled: Math.abs(img.naturalWidth - r.width * d) > 0.75 || Math.abs(img.naturalHeight - r.height * d) > 0.75,
    fill: want ? Math.max(r.width, r.height) / want : null, rendering: getComputedStyle(img).imageRendering };
};
globalThis.__grid = () => {
  const rows = [...document.querySelectorAll('#enhanced-inventory .pack-dock .packcol:not(.packcats) .itemrow')];
  const phone = matchMedia('(max-width: 640px)').matches;
  const want = phone ? SLOT_BOX.gridPhone : SLOT_BOX.grid;
  const tops = new Set(rows.map((r) => Math.round(r.getBoundingClientRect().top)));
  return { dpr: devicePixelRatio, phone, want, perRow: rows.filter((r) => Math.round(r.getBoundingClientRect().top) === Math.min(...tops)).length,
    rows: rows.map((r) => {
      const t = r.querySelector('.tile'), img = t?.querySelector('img'), count = r.querySelector('.count');
      return { name: r.querySelector('.itemname > span')?.textContent, rarity: r.dataset.rarity ?? null, locked: 'locked' in r.dataset,
        hasbar: r.classList.contains('hasbar'), row: box(r), tile: box(t), pic: pic(img, want), initials: img ? null : t?.textContent,
        count: count ? { text: count.textContent, box: box(count) } : null,
        lock: (() => { const s = getComputedStyle(t, '::before'); return s.content && s.content !== 'none' ? { right: s.right, bottom: s.bottom, w: s.width } : null; })(),
      };
    }) };
};
const inner = (t) => { const cs = getComputedStyle(t); return [t.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), t.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)]; };
const placed = (i) => { const t = i.closest('.tile'), row = i.closest('.wornrow, .wornsock'); const p = pic(i, Math.min(...inner(t)));
  return { ...p, name: row?.querySelector('.wornname')?.textContent ?? row?.title ?? '', tile: box(t), inner: inner(t), row: box(row) }; };
// UI1b: THE SLOT IS THE FRAME - a tiered worn panel's own border wears the tier, and its picture no box
globalThis.__frames = () => [...document.querySelectorAll('#enhanced-inventory .equipped .wornrow[data-rarity], #enhanced-inventory .pack-dock .itemrow[data-rarity]')].map((n) => {
  const t = n.querySelector('.tile');
  const ts = t ? getComputedStyle(t) : null;
  return { kind: n.classList.contains('wornrow') ? 'worn' : 'grid', rarity: n.dataset.rarity, border: getComputedStyle(n).borderTopColor,
    tileBorder: ts ? parseFloat(ts.borderTopWidth) * (ts.borderTopColor.includes('0, 0, 0, 0') || ts.borderTopColor === 'transparent' ? 0 : 1) : 0,
    tileBg: ts?.backgroundImage ?? 'none', tileShadow: ts?.boxShadow ?? 'none' };
});
globalThis.__others = () => {
  const q = (sel) => [...document.querySelectorAll(sel)];
  return {
    worn: q('#enhanced-inventory .wornrow .tile img').map(placed),
    shelf: q('#enhanced-inventory .wornsock .tile img').map(placed),
    loot: q('.loot-win .itemrow .tile img').map((i) => pic(i, SLOT_BOX.loot)),
    oldCap: q('#enhanced-inventory img:not(.fit), .loot-win img:not(.fit)').filter((i) => i.closest('.tile, .bigicon')).length,
  };
};
globalThis.__hoverName = (name) => {
  const r = [...document.querySelectorAll('#enhanced-inventory .pack-dock .itemrow')].find((x) => x.querySelector('.itemname')?.textContent.startsWith(name));
  r?.dispatchEvent(new MouseEvent('mouseenter'));
  r?.onmouseenter?.();
  return !!r;
};
globalThis.__card = () => pic(document.querySelector('.inv-tip .bigicon img'), SLOT_BOX.card);
globalThis.__ghost = () => pic(document.querySelector('.dragghost .tile img'), SLOT_BOX.grid);
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
  { name: 'laptop-1.25x', viewport: { width: 1280, height: 720 }, dpr: 1.25 },
  { name: 'phone-2.625x', viewport: { width: 393, height: 851 }, dpr: 2.625, isMobile: true, hasTouch: true },
];
try {
  await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: v.viewport, isMobile: !!v.isMobile, hasTouch: !!v.hasTouch, deviceScaleFactor: v.dpr });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // a page under tools/ asks for ./arena2/ relatively: the dev server's one mount answers it
    await page.route('**/tools/arena2/**', (route) => route.continue({ url: route.request().url().replace('/tools/arena2/', '/arena2/') }));
    await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?skin=enhanced`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => typeof globalThis.__openPack === 'function', null, { timeout: 90000 });
    await page.evaluate(() => globalThis.__openPack(false));
    const tag = `${v.name}`;
    // EVERY PAGE OF THE PACK, one after another: each picture made (the pack repaints as each lands), then read
    await page.waitForFunction(() => globalThis.__tabs().length > 0, null, { timeout: 60000 });   // the pack mounts after its module loads
    const tabs = await page.evaluate(() => globalThis.__tabs());
    const all = { rows: [], perRow: 99, phone: false, dpr: v.dpr, want: 0 };
    for (let i = 0; i < tabs.length; i++) {
      await page.evaluate((k) => globalThis.__tabAt(k), i);
      await page.waitForFunction(() => {
        const g = globalThis.__grid();
        return g.rows.every((r) => r.pic?.nat?.[0] > 0);
      }, null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(150);
      const gi = await page.evaluate(() => globalThis.__grid());
      if (!gi.rows.length) continue;
      Object.assign(all, { phone: gi.phone, want: gi.want, dpr: gi.dpr });
      if (gi.rows.length >= 7) all.perRow = Math.min(all.perRow, gi.perRow);   // a page with a row to fill
      all.rows.push(...gi.rows.map((r) => ({ ...r, tab: tabs[i] })));
      if (v.name === 'desktop-1x' || v.name === 'desktop-2x' || v.isMobile) {
        await page.locator('#enhanced-inventory .pack-dock').screenshot({ path: join(OUT, `ui1-grid-${tag}-tab${i}.png`) }).catch(() => {});
      }
    }
    await page.evaluate(() => globalThis.__tabAt(0));
    await page.waitForTimeout(200);
    const g = all;
    const slot = g.phone ? 56 : 64, well = g.phone ? 44 : 52;
    check(`${tag}: every grid slot is ${slot}px around a ${well}px well`, g.rows.every((r) => Math.round(r.row.w) === slot && Math.round(r.row.h) === slot && Math.round(r.tile.w) === well),
      g.rows.filter((r) => Math.round(r.row.w) !== slot || Math.round(r.tile.w) !== well).map((r) => `${r.name} ${r.row.w}/${r.tile.w}`).join('; '));
    check(`${tag}: ${g.perRow} a row`, g.phone ? g.perRow >= 6 : g.perRow >= 5);
    const pics = g.rows.filter((r) => r.pic);
    check(`${tag}: every slot has its picture (${pics.length}/${g.rows.length})`, pics.length === g.rows.length, g.rows.filter((r) => !r.pic).map((r) => `${r.name}=${r.initials}`).join(', '));
    check(`${tag}: every picture is a fitted one`, pics.every((r) => r.pic.fit));
    check(`${tag}: the page resamples none of them (bitmap = drawn size x ${g.dpr})`, pics.every((r) => !r.pic.resampled),
      pics.filter((r) => r.pic.resampled).map((r) => `${r.name} ${r.pic.nat} @ ${r.pic.css.map((x) => x.toFixed(1))}`).join('; '));
    const small = pics.filter((r) => r.pic.fill < 0.74);
    check(`${tag}: every picture fills at least three quarters of its box, or stands at the cap (a gem)`, small.every((r) => /Ruby|Emerald|Sapphire|Diamond|Jade|Turquoise|Malachite|Amber/.test(r.name)),
      small.map((r) => `${r.name} ${(r.pic.fill * 100).toFixed(0)}%`).join(', '));
    check(`${tag}: none past its box`, pics.every((r) => r.pic.fill <= 1.001), pics.filter((r) => r.pic.fill > 1.001).map((r) => r.name).join(', '));
    const stacks = g.rows.filter((r) => /×\d+/.test(r.name ?? ''));
    check(`${tag}: every stack wears its count (${stacks.length})`, stacks.length >= 5 && stacks.every((r) => r.count && r.name.endsWith(`×${r.count.text}`)),
      stacks.filter((r) => !r.count || !r.name.endsWith(`×${r.count.text}`)).map((r) => r.name).join(', '));
    // the corners: the count clear of the padlock (a locked stack) and lifted over the wear bar
    const lockedStacks = g.rows.filter((r) => r.count && r.locked);
    check(`${tag}: a locked stack's count stands clear of the padlock (${lockedStacks.length})`, lockedStacks.every((r) => r.row.x + r.row.w - (r.count.box.x + r.count.box.w) >= 14));
    console.log(`     fills: ${pics.map((r) => `${r.name.replace(/ ×\d+/, '')}=${(r.pic.fill * 100).toFixed(0)}%${r.pic.css ? `(${r.pic.nat.join('x')})` : ''}`).join(', ')}`);
    await page.locator('#enhanced-inventory').screenshot({ path: join(OUT, `ui1-pack-${tag}.png`) });
    const fr = await page.evaluate(() => globalThis.__frames());
    const plain = await page.evaluate(() => getComputedStyle(document.querySelector('#enhanced-inventory .equipped .wornrow:not([data-rarity])') ?? document.body).borderTopColor);
    check(`${tag}: every tiered slot and worn panel wears its tier on its own border, its picture in no box (${fr.length})`,
      fr.length >= 3 && fr.some((f) => f.kind === 'worn') && fr.every((f) => f.border !== plain && f.tileBorder === 0 && f.tileBg === 'none' && f.tileShadow === 'none'),
      JSON.stringify(fr.filter((f) => !(f.border !== plain && f.tileBorder === 0 && f.tileBg === 'none' && f.tileShadow === 'none'))));
    const o = await page.evaluate(() => globalThis.__others());
    check(`${tag}: no enhanced picture left at the old cap`, o.oldCap === 0, `${o.oldCap}`);
    for (const k of ['worn', 'shelf']) {
      check(`${tag}: the ${k} pictures are fitted (${o[k].length})`, o[k].length > 0 && o[k].every((p) => p.fit), JSON.stringify(o[k].filter((p) => !p.fit)));
      check(`${tag}: the ${k} wells stand inside their panels`, o[k].every((p) => p.tile.y >= p.row.y - 0.5 && p.tile.y + p.tile.h <= p.row.y + p.row.h + 0.5 && p.tile.x + p.tile.w <= p.row.x + p.row.w + 0.5));
      console.log(`     ${k}: ${o[k].map((p) => `${p.name.slice(0, 12)} well ${p.tile.w.toFixed(0)}x${p.tile.h.toFixed(0)} inner ${p.inner.map((x) => x.toFixed(0)).join('x')} pic ${p.css.map((x) => x.toFixed(1)).join('x')} nat ${p.nat.join('x')}${p.resampled ? ' RESAMPLED' : ''} in ${p.row.w.toFixed(0)}x${p.row.h.toFixed(0)}`).join(' | ')}`);
    }
    // the hover card, over the longsword's neighbour in the pack (a staff: the tallest record)
    if (!v.isMobile) {
      await page.evaluate(() => globalThis.__hoverName('Staff'));
      await page.waitForFunction(() => globalThis.__card()?.nat?.[0] > 0, null, { timeout: 20000 }).catch(() => {});
      const c = await page.evaluate(() => globalThis.__card());
      check(`${tag}: the hover card's picture is fitted, unresampled, its box filled`, !!c && c.fit && !c.resampled && c.fill > 0.74 && c.fill <= 1.001, JSON.stringify(c));
      await page.locator('.inv-tip').screenshot({ path: join(OUT, `ui1-card-${tag}.png`) }).catch(() => {});
      await page.evaluate(() => document.querySelectorAll('.inv-tip').forEach((n) => n.remove()));
      // the drag ghost: a held press carried off a slot
      const row = page.locator('#enhanced-inventory .pack-dock .itemrow').nth(2);
      const rb = await row.boundingBox({ timeout: 5000 }).catch(() => null);
      if (!rb) { check(`${tag}: a slot to carry`, false); await ctx.close(); continue; }
      await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
      await page.mouse.down();
      await page.mouse.move(rb.x + rb.width / 2 + 30, rb.y + rb.height / 2 + 12, { steps: 6 });
      await page.waitForTimeout(200);
      const gh = await page.evaluate(() => globalThis.__ghost());
      check(`${tag}: the drag ghost carries a fitted picture`, !!gh && gh.fit && gh.fill <= 1.001, JSON.stringify(gh));
      await page.keyboard.press('Escape');
      await page.mouse.up();
    }
    // the loot window beside the pack: a pile's rows, each its picture fitted to the row's box
    await page.evaluate(() => { globalThis.__closePack(); globalThis.__openPack(true); });
    await page.waitForFunction(() => { const o = globalThis.__others(); return o.loot.length >= 5 && o.loot.every((p) => p.nat[0] > 0); }, null, { timeout: 30000 }).catch(() => {});
    const lo = await page.evaluate(() => globalThis.__others());
    check(`${tag}: the loot rows' pictures are fitted, unresampled (${lo.loot.length})`, lo.loot.length >= 5 && lo.loot.every((p) => p.fit && !p.resampled), JSON.stringify(lo.loot));
    await page.locator('.loot-win').screenshot({ path: join(OUT, `ui1-loot-${tag}.png`) }).catch(() => {});
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
