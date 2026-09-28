// SET5 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md; Mac: "sigil armor sets that also come with set
// builds ... go all out on this") - THE SETS ON SCREEN, DRAWN AND MEASURED.
//
// A pin can say the card appends a set block and the sheet has a rule for it; only a layout engine can say the block
// reads, the doll's strip fits its column beside the worn map, the rune in a tile's corner took its set's colour, and
// the HUD's chips burn in the set's hue. So the REAL pack (ui/inventoryDoor.js createInventoryWindow, the enhanced skin
// - Plus is its only dress) and the REAL HUD (ui/enhancedHud.js drawEnhancedHud) are drawn here over the real sheets,
// with a kit worn through the game's own equip (systems/equip.js): six pieces of Dagon's Brand and its sword, two of
// Ruhn's Regalia (the Cinder-Boots and the Gate-Shield), a Mora helm and a Nocturnal cuirass in the pack - online at
// Renown 12, the Dagon pieces grown to Kindled. At a desktop, a laptop and a phone it reads:
//   - THE STRIP: a line a worn set in the doll's column - its name, "7/9" and "2/9", its tiers' pips lit where awake,
//     its stage - inside the column, clear of the shelf above it;
//   - THE RUNES: a set piece's tile and socket wear data-set, and the corner rune's picture is in its set's colour;
//   - THE CARD: a worn Dagon piece's set block - the name, "7/9", seven places lit, three tiers awake, the stage and
//     what holds it; a Mora helm in the pack - "0/9", nothing lit, "Wear two pieces to wake it"; the sigil block of a set's
//     armour says "A set's sigil" (never "+null%"); a press on a strip line shows that set's piece;
//   - OFFLINE: the same card says the sets sleep, the block dimmed;
//   - THE HUD: after the powers are driven through their real doors (two kills for the Rampage, a lethal blow for
//     Unbroken, a blow across 30% for the Wrath, a kill for Eventide), each set's chip is on the effects row, in its
//     set's colour, a window burning and a recovery dashed.
// Every state is photographed.
//
// IT RUNS ON VITE'S OWN DEV SERVER (tools/qs3Probe.mjs's reason).
//
//     node tools/setUiProbe.mjs                    -> shots (tools/shots/, or SHOT_DIR) and a report
//     PROBE_PORT=<n> node tools/setUiProbe.mjs     -> reuse a dev server already listening there
import { mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'setui.tmp.html';
const OUT = process.env.SHOT_DIR ?? join(ROOT, 'tools/shots');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SET5 probe</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:repeating-linear-gradient(45deg,#3b4a3a 0 14px,#324031 14px 28px)}</style></head><body>
<script type="module">
import { setSigilOnline, setSigilRenown } from '/src/systems/sigil.js';
import { setSetsWearer, SIGIL_SETS } from '/src/systems/sigilSets.js';
import { setHudChips, setStruck, _resetSetPowersForTests } from '/src/systems/sigilSetPowers.js';
import { REGALIA, mintAetheric } from '/src/systems/aetheric.js';
import { equipItem, unequipItem } from '/src/systems/equip.js';
import { setItemFields, mintCondition } from '/src/systems/itemTemplates.js';
import { createWeapon } from '/src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '/src/systems/armorMaterials.js';
import { setPref } from '/src/systems/uiPrefs.js';
import { setPlayerDoor } from '/src/systems/playerDoor.js';
import { reportPlayerKill } from '/src/systems/playerKills.js';
import { hurtPlayer } from '/src/characters/playerEntity.js';
import { createInventoryWindow } from '/src/ui/inventoryDoor.js';
import { drawEnhancedHud, setHudSetChips } from '/src/ui/enhancedHud.js';

setPref('lootRarity', true);
const armour = (templateIndex, set, xp, rarity = 'rare') => {
  const it = mintCondition(setItemFields({ group: 'Armor', templateIndex, material: ARMOR_MATERIAL.Steel, flags: 0 }));
  it.rarity = rarity; it.isIdentified = true; it.affixes = [];
  it.sigil = { set, party: 2, xp };
  return it;
};
const e = { isPlayer: true, name: 'Aelwyn', career: { name: 'Spellsword' }, level: 12,
  stats: { strength: 50, endurance: 48, willpower: 50, intelligence: 50, agility: 50, speed: 50, personality: 50, luck: 50 },
  skills: new Array(35).fill(40), health: 60, maxHealth: 100, fatigue: 150, maxFatigue: 200, magicka: 14, maxMagicka: 20,
  items: [], spells: [], activeEffects: [], career2: null };
setSetsWearer(() => e);
setHudSetChips(setHudChips);
const wear = (it) => { e.items.push(it); equipItem(e, it); return it; };
const carry = (it) => { e.items.push(it); return it; };
const strip = () => { for (const it of [...e.items]) { if (it.equipSlot != null) unequipItem(e, it); } e.items.length = 0; };
// THE KIT: six of Dagon's Brand and its sword (Kindled), two of Ruhn's Regalia, a Mora helm and a Nocturnal cuirass carried
function kitPack() {
  strip();
  for (const t of [107, 106, 105, 102, 103, 104]) wear(armour(t, 'dagon', 6000));
  const sword = createWeapon(120, 3); sword.rarity = 'legendary'; sword.isIdentified = true; sword.affixes = [];
  sword.sigil = { power: 9, set: 'dagon', party: 3, xp: 6100 }; sword.name = 'Longsword';
  wear(sword);
  wear(mintAetheric(REGALIA.find((r) => r.id === 'ruhn-cinder-boots')));
  wear(mintAetheric(REGALIA.find((r) => r.id === 'ruhn-gate-shield')));
  carry(armour(107, 'mora', 0, 'magic'));
  carry(armour(102, 'nocturnal', 0));
}
// a full six of one set, for the HUD's powers
function kitSix(set) {
  strip();
  for (const t of [107, 106, 105, 102, 103, 104]) wear(armour(t, set, 0));
}
globalThis.__online = (on) => { setSigilOnline(!!on); if (on) setSigilRenown(12); };
globalThis.__online(true);
let win = null;
globalThis.__openPack = () => {
  kitPack();
  document.getElementById('enhanced-inventory')?.remove();
  win = createInventoryWindow({ entity: e, items: () => e.items, wagonItems: () => [] });
  return !!win;
};
globalThis.__tab = (label) => { const b = [...document.querySelectorAll('#enhanced-inventory .packtab')].find((x) => x.textContent.startsWith(label)); b?.click(); return !!b; };
globalThis.__closePack = () => { document.getElementById('enhanced-inventory')?.remove(); document.querySelectorAll('.packtip,.inv-info').forEach((n) => n.remove()); };
const box = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.x + r.width, b: r.y + r.height }; };
const shown = (n) => !!n && getComputedStyle(n).display !== 'none' && n.getClientRects().length > 0;
globalThis.__strip = () => {
  const col = document.querySelector('#enhanced-inventory .charcol');
  const s = col?.querySelector('.setstrip');
  const shelf = col?.querySelector('.wornshelf');
  return {
    col: box(col), strip: box(s), shelf: box(shelf), shown: shown(s),
    lines: [...(s?.querySelectorAll('.setline') ?? [])].map((b) => ({
      set: b.dataset.set, name: b.querySelector('.setline-name')?.textContent, count: b.querySelector('.setline-count')?.textContent,
      lit: b.querySelectorAll('.setline-pips i.on').length, stage: b.querySelector('.setline-stage')?.textContent, box: box(b),
      border: getComputedStyle(b).borderTopColor, nameColour: getComputedStyle(b.querySelector('.setline-name')).color,
    })),
  };
};
globalThis.__runes = () => {
  const tiles = [...document.querySelectorAll('#enhanced-inventory [data-set]')];
  return tiles.map((n) => ({ set: n.dataset.set, cls: n.className, rune: (() => {
    for (const el of [n, n.querySelector('.tile')].filter(Boolean)) {
      const img = getComputedStyle(el, '::after').backgroundImage;
      if (img && img !== 'none') return img;
    }
    return '';
  })() }));
};
globalThis.__pickPack = (set) => {
  const row = [...document.querySelectorAll('#enhanced-inventory .pack-dock .itemrow[data-set]')].find((n) => n.dataset.set === set);
  row?.click();
  return !!row;
};
globalThis.__pickWorn = (set) => {
  const n = [...document.querySelectorAll('#enhanced-inventory .wornrow[data-set], #enhanced-inventory .wornsock[data-set]')].find((x) => x.dataset.set === set);
  (n?.matches('button') ? n : n?.querySelector('button') ?? n)?.click();
  return !!n;
};
// AUDIT SET U13: the worn piece's HOVER CARD (the pack's PLUS9b card beside the row) - the tallest a card gets, a set
// piece's sigil block and its set block with three tiers under the tier's own lines
globalThis.__hover = (set) => {
  document.querySelectorAll('.inv-tip').forEach((n) => n.remove());
  const n = [...document.querySelectorAll('#enhanced-inventory .wornrow[data-set], #enhanced-inventory .wornsock[data-set]')].find((x) => x.dataset.set === set);
  const b = n?.matches('button') ? n : n?.querySelector('button') ?? n;
  b?.dispatchEvent(new MouseEvent('mouseenter'));
  const tip = document.querySelector('.inv-tip');
  return tip ? { ...box(tip), scrollH: tip.scrollHeight, clientH: tip.clientHeight, set: !!tip.querySelector('.setbox'), sigil: !!tip.querySelector('.sigilbox'),
    parts: [...(tip.querySelector('.card')?.children ?? [])].map((c) => c.tagName.toLowerCase() + '.' + c.className + ':' + Math.round(c.getBoundingClientRect().height)).join(' ') } : null;
};
globalThis.__pickStrip = (set) => { const b = document.querySelector('#enhanced-inventory .setline[data-set="' + set + '"]'); b?.click(); return !!b; };
globalThis.__card = () => {
  const cards = [...document.querySelectorAll('.setbox')].filter(shown);
  const c = cards.at(-1);
  if (!c) return null;
  const sig = c.parentElement?.querySelector('.sigilbox .sigil-effect')?.textContent ?? null;
  return {
    set: c.dataset.set, stage: c.dataset.stage, name: c.querySelector('.set-name')?.textContent,
    count: c.querySelector('.set-count')?.textContent, lit: c.querySelectorAll('.set-place.on').length,
    places: c.querySelectorAll('.set-place').length, awake: c.querySelectorAll('.set-tier.awake').length,
    tiers: c.querySelectorAll('.set-tier').length, stageText: c.querySelector('.set-stage')?.textContent ?? '',
    sigil: sig, box: box(c), filter: getComputedStyle(c).filter, nameColour: getComputedStyle(c.querySelector('.set-name')).color,
    stageAlign: c.querySelector('.set-stage') ? getComputedStyle(c.querySelector('.set-stage')).textAlign : null,
    stageSize: c.querySelector('.set-stage') ? getComputedStyle(c.querySelector('.set-stage')).fontSize : null,
    text: c.textContent,
  };
};
// THE HUD: a full six, and the power driven through its real door
let hudOn = false;
function frame() { if (hudOn) drawEnhancedHud(e, 0.25, 1 / 60, {}); requestAnimationFrame(frame); }
frame();
const foe = (name, x) => ({ name, entity: { name }, ai: { feet: [x, 0, 0] }, dead: false });
globalThis.__power = (set) => {
  _resetSetPowersForTests();
  setHudSetChips(setHudChips);
  kitSix(set);
  e.health = 60; e.maxHealth = 100;
  setPlayerDoor({ foes: () => [foe('near', 3)], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => e });
  if (set === 'dagon') { reportPlayerKill({ name: 'a' }); reportPlayerKill({ name: 'b' }); }
  if (set === 'malacath') { e.health = 20; hurtPlayer(e, 500); }
  if (set === 'ruhn') { e.health = 40; setStruck({ name: 'near' }, e, 15); hurtPlayer(e, 15); }   // AUDIT SET L3: a foe's blow, marked as the formula marks it
  if (set === 'nocturnal') reportPlayerKill({ name: 'c' });
  hudOn = true;
  return setHudChips(e);
};
// UI3: a set power is a tile in the status widget now - its rune in its set's colour, its frame the set's light and shade
globalThis.__chips = () => [...document.querySelectorAll('.hud-stat .hst-cell.set')].filter(shown).map((c) => ({
  set: c.dataset.set, state: c.className.includes('recovering') ? 'recovering' : 'active',
  name: c.querySelector('.hst-name')?.textContent, text: c.querySelector('.hst-foot')?.textContent,
  colour: c.style.getPropertyValue('--set').trim(), hi: c.style.getPropertyValue('--set-hi').trim(),
  rune: c.querySelector('.hst-pic')?.getAttribute('src') ?? '',
  border: getComputedStyle(c.querySelector('.hst-tile')).borderTopColor, style: getComputedStyle(c.querySelector('.hst-tile')).borderTopStyle, box: box(c.querySelector('.hst-tile')),
}));
globalThis.__colours = Object.fromEntries(Object.values(SIGIL_SETS).map((s) => [s.id, s.colour]));
globalThis.__ready = true;
</script></body></html>`;

const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'laptop', viewport: { width: 1024, height: 700 } },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];
const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

mkdirSync(OUT, { recursive: true });
const vite = process.env.PROBE_PORT ? null : await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1', watch: null }, logLevel: 'error' });
if (vite) await vite.listen();
const port = vite ? vite.httpServer.address().port : Number(process.env.PROBE_PORT);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const fails = [];
let checks = 0;
const check = (ok, what) => { checks++; if (!ok) fails.push(what); };
const settle = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
try {
  await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: v.viewport, isMobile: !!v.isMobile, hasTouch: !!v.hasTouch, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (err) => fails.push(`${v.name}: page error ${err.message}`));
    await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?skin=enhanced`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => globalThis.__ready === true, null, { timeout: 90000 });
    const colours = await page.evaluate(() => globalThis.__colours);
    // ── THE PACK ──
    check(await page.evaluate(() => globalThis.__openPack()), `${v.name}: the pack did not open`);
    await page.waitForSelector('#enhanced-inventory .packtab', { timeout: 30000 });
    check(await page.evaluate(() => globalThis.__tab('Armor')), `${v.name}: no Armor page`);   // the carried pieces are armour
    await page.waitForSelector('#enhanced-inventory .itemrow', { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await settle(page);
    const s = await page.evaluate(() => globalThis.__strip());
    console.log(`${v.name}: strip ${s.shown ? `${s.strip.w.toFixed(0)}x${s.strip.h.toFixed(0)}` : 'NOT SHOWN'} - ${s.lines.map((l) => `${l.name} ${l.count} [${l.lit}] ${l.stage}`).join(' | ')}`);
    check(s.shown, `${v.name}: the doll's strip is not shown`);
    check(s.lines.length === 2, `${v.name}: ${s.lines.length} strip lines, not 2`);
    const dag = s.lines.find((l) => l.set === 'dagon'), ruhn = s.lines.find((l) => l.set === 'ruhn');
    check(dag && dag.name === "Dagon's Brand" && dag.count === '7/9' && dag.lit === 3 && dag.stage === 'Kindled', `${v.name}: the Dagon line reads ${JSON.stringify(dag)}`);
    check(ruhn && ruhn.name === "Ruhn's Regalia" && ruhn.count === '2/9' && ruhn.lit === 1 && ruhn.stage === 'Faint', `${v.name}: the Ruhn line reads ${JSON.stringify(ruhn)}`);
    check(dag && dag.nameColour === rgb(colours.dagon), `${v.name}: the Dagon line's name is ${dag?.nameColour}, not its set's ${rgb(colours.dagon)}`);
    if (s.shown && s.col) {
      check(s.strip.x >= s.col.x - 0.5 && s.strip.r <= s.col.r + 0.5, `${v.name}: the strip runs out of its column sideways`);
      check(s.strip.b <= s.col.b + 0.5, `${v.name}: the strip runs off the column's foot (${s.strip.b.toFixed(0)} > ${s.col.b.toFixed(0)})`);
      check(!s.shelf || s.strip.y >= s.shelf.b - 0.5, `${v.name}: the strip overlaps the shelf`);
      for (const l of s.lines) check(l.box.h >= 22, `${v.name}: the ${l.set} line is ${l.box.h}px tall - too small to press`);
      const pad = 10;
      await page.screenshot({ path: join(OUT, `setui-${v.name}-strip.png`), clip: { x: Math.max(0, s.col.x - pad), y: Math.max(0, (s.shelf?.y ?? s.strip.y) - pad), width: s.col.w + pad * 2, height: s.strip.b - (s.shelf?.y ?? s.strip.y) + pad * 2 } });
    }
    const runes = await page.evaluate(() => globalThis.__runes());
    for (const set of ['dagon', 'ruhn', 'mora', 'nocturnal']) {
      const r = runes.find((x) => x.set === set);
      check(!!r, `${v.name}: no frame wears data-set="${set}"`);
      check(r && r.rune.includes(encodeURIComponent(colours[set]).toLowerCase().replace('%23', '%23')), `${v.name}: the ${set} rune is not in its colour (${r?.rune.slice(0, 60)}...)`);
    }
    await page.screenshot({ path: join(OUT, `setui-${v.name}-pack.png`) });
    // AUDIT SET U13: the hover card of a worn set piece stands inside the screen, whole
    for (const set of ['dagon', 'ruhn']) {
      const tip = await page.evaluate((x) => globalThis.__hover(x), set);
      await settle(page);
      const t = await page.evaluate((x) => globalThis.__hover(x), set);
      console.log(`${v.name}: hover card (${set}) ${t ? `${t.w.toFixed(0)}x${t.h.toFixed(0)} at ${t.y.toFixed(0)}..${t.b.toFixed(0)} (scroll ${t.scrollH}/${t.clientH}) ${t.parts}` : 'NONE'}`);
      check(tip && t && t.set && t.sigil, `${v.name}: the ${set} hover card has no set or sigil block`);
      check(t && t.y >= 0 && t.b <= v.viewport.height + 0.5 && t.x >= 0 && t.r <= v.viewport.width + 0.5, `${v.name}: the ${set} hover card runs off the screen (${t && `${t.y.toFixed(0)}..${t.b.toFixed(0)} of ${v.viewport.height}`})`);
      check(t && t.scrollH <= t.clientH + 1, `${v.name}: the ${set} hover card is cut (${t?.scrollH} of ${t?.clientH})`);
      if (t) await page.screenshot({ path: join(OUT, `setui-${v.name}-hover-${set}.png`), clip: { x: Math.max(0, t.x - 8), y: Math.max(0, t.y - 8), width: Math.min(v.viewport.width - Math.max(0, t.x - 8), t.w + 16), height: Math.min(v.viewport.height - Math.max(0, t.y - 8), t.h + 16) } });
      await page.evaluate(() => document.querySelectorAll('.inv-tip').forEach((n) => n.remove()));
    }
    // the card of a worn Dagon piece
    check(await page.evaluate(() => globalThis.__pickWorn('dagon')), `${v.name}: no worn Dagon piece to press`);
    await settle(page);
    let c = await page.evaluate(() => globalThis.__card());
    console.log(`${v.name}: worn Dagon card ${c ? `${c.name} ${c.count} lit ${c.lit}/${c.places} awake ${c.awake}/${c.tiers} "${c.stageText}" sigil "${c.sigil}"` : 'NONE'}`);
    check(c && c.set === 'dagon' && c.count === '7/9' && c.lit === 7 && c.places === 9 && c.awake === 3 && c.tiers === 3, `${v.name}: the worn Dagon card reads ${JSON.stringify(c && { ...c, text: undefined })}`);
    check(c && c.stageText === 'Kindled · Bright: grow your Helm, reach Renown 20', `${v.name}: the stage line says "${c?.stageText}"`);
    check(c && c.nameColour === rgb(colours.dagon), `${v.name}: the set's name is ${c?.nameColour}`);
    check(c && c.stageAlign === 'left' && c.stageSize === '12px', `${v.name}: the stage line is ${c?.stageAlign} at ${c?.stageSize} - the card's own paragraph rule won`);
    check(c && !/null|undefined|NaN/.test(c.text), `${v.name}: the card says null/undefined: ${c?.text}`);
    check(c && (c.sigil == null || /^A set's sigil|^\+|^Wakes/.test(c.sigil)) && !/null/.test(String(c.sigil)), `${v.name}: the sigil block says "${c?.sigil}"`);
    if (c) {
      check(c.box.x >= 0 && c.box.r <= v.viewport.width + 0.5, `${v.name}: the set block runs off the screen sideways`);
      await page.screenshot({ path: join(OUT, `setui-${v.name}-card-dagon.png`), clip: { x: Math.max(0, c.box.x - 12), y: Math.max(0, c.box.y - 12), width: Math.min(v.viewport.width, c.box.w + 24), height: Math.min(v.viewport.height - Math.max(0, c.box.y - 12), c.box.h + 24) } });
    }
    // a Mora helm in the pack: nothing of its set worn
    check(await page.evaluate(() => globalThis.__pickPack('mora')), `${v.name}: no Mora helm in the pack to press`);
    await settle(page);
    c = await page.evaluate(() => globalThis.__card());
    check(c && c.set === 'mora' && c.count === '0/9' && c.lit === 0 && c.awake === 0 && c.stageText === 'Wear two pieces to wake it', `${v.name}: the Mora card reads ${JSON.stringify(c && { ...c, text: undefined })}`);
    check(c && /^A set's sigil/.test(String(c.sigil)), `${v.name}: a set armour's sigil block says "${c?.sigil}"`);
    if (c) await page.screenshot({ path: join(OUT, `setui-${v.name}-card-mora.png`), clip: { x: Math.max(0, c.box.x - 12), y: Math.max(0, c.box.y - 12), width: Math.min(v.viewport.width, c.box.w + 24), height: Math.min(v.viewport.height - Math.max(0, c.box.y - 12), c.box.h + 24) } });
    // the strip's Ruhn line shows a Ruhn piece
    check(await page.evaluate(() => globalThis.__pickStrip('ruhn')), `${v.name}: no Ruhn line to press`);
    await settle(page);
    c = await page.evaluate(() => globalThis.__card());
    check(c && c.set === 'ruhn' && c.count === '2/9' && c.awake === 1, `${v.name}: the strip's press shows ${JSON.stringify(c && { set: c.set, count: c.count, awake: c.awake })}`);
    // offline: the sets sleep
    await page.evaluate(() => { globalThis.__closePack(); globalThis.__online(false); globalThis.__openPack(); });
    await page.waitForSelector('#enhanced-inventory .packtab', { timeout: 30000 });
    await page.evaluate(() => globalThis.__tab('Armor'));
    await settle(page);
    check(await page.evaluate(() => globalThis.__pickWorn('dagon')), `${v.name}: offline, no worn Dagon piece to press`);
    await settle(page);
    c = await page.evaluate(() => globalThis.__card());
    check(c && c.stage === 'asleep' && c.awake === 0 && c.stageText === 'Asleep · sets wake online', `${v.name}: offline the card reads ${JSON.stringify(c && { stage: c.stage, awake: c.awake, stageText: c.stageText })}`);
    check(c && /saturate/.test(c.filter), `${v.name}: offline the block is not dimmed (${c?.filter})`);
    if (c) await page.screenshot({ path: join(OUT, `setui-${v.name}-card-offline.png`), clip: { x: Math.max(0, c.box.x - 12), y: Math.max(0, c.box.y - 12), width: Math.min(v.viewport.width, c.box.w + 24), height: Math.min(v.viewport.height - Math.max(0, c.box.y - 12), c.box.h + 24) } });
    await page.evaluate(() => { globalThis.__closePack(); globalThis.__online(true); });
    // ── THE HUD ──
    for (const [set, want] of [['dagon', { name: 'Rampage II', state: 'active' }], ['malacath', { name: 'Unbroken', state: 'active' }],
      ['ruhn', { name: 'Wrath', state: 'active' }], ['nocturnal', { name: 'Eventide', state: 'recovering' }]]) {
      const law = await page.evaluate((x) => globalThis.__power(x), set);
      await page.waitForTimeout(200);
      await settle(page);
      const chips = await page.evaluate(() => globalThis.__chips());
      const chip = chips.find((x) => x.set === set);
      console.log(`${v.name}: HUD ${set} - law ${JSON.stringify(law.map((x) => `${x.name} ${x.text} ${x.state}`))} drawn ${JSON.stringify(chips.map((x) => `${x.name} ${x.text} ${x.state}`))}`);
      check(chip && chip.name === want.name && chip.state === want.state, `${v.name}: the ${set} chip reads ${JSON.stringify(chip)}`);
      check(chip && chip.colour === colours[set] && chip.border === rgb(chip.hi), `${v.name}: the ${set} tile's frame is ${chip?.border} (${chip?.colour}), not its set's ${colours[set]} lit`);
      check(chip && chip.rune.includes(encodeURIComponent(colours[set])), `${v.name}: the ${set} tile's rune is not in its set's colour`);
      check(chip && (want.state === 'recovering') === (chip.style === 'dashed'), `${v.name}: the ${set} chip's border is ${chip?.style}`);
      check(chip && chip.box.x >= 0 && chip.box.r <= v.viewport.width + 0.5, `${v.name}: the ${set} chip runs off the screen`);
      if (chips.length) {
        // the widget's tiles, as a player sees them at the left edge (UI3)
        const pad = 16;
        const xs = chips.flatMap((x) => [x.box.x, x.box.r]);
        const ys = chips.flatMap((x) => [x.box.y, x.box.b]);
        const x0 = Math.max(0, Math.min(...xs) - pad), y0 = Math.max(0, Math.min(...ys) - pad);
        await page.screenshot({ path: join(OUT, `setui-${v.name}-hud-${set}.png`), clip: { x: x0, y: y0, width: Math.min(v.viewport.width, Math.max(...xs) + pad) - x0, height: Math.min(v.viewport.height, Math.max(...ys) + pad) - y0 } });
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  await vite?.close();
  await unlink(join(ROOT, `tools/${PAGE_NAME}`)).catch(() => {});
}
console.log(`\n${checks - fails.length}/${checks} checks${fails.length ? ':' : ''}`);
for (const f of fails) console.log(`  FAIL ${f}`);
console.log(`shots in ${OUT}`);
process.exitCode = fails.length ? 1 : 0;
