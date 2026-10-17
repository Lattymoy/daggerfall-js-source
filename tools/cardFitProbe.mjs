// CARD-FIT (2026-09-28, Discord - Cruor, "New sigil items descriptor is a bit long!": "all the buttons on it's pop-up
// card are.. off the screen, because it's got a bit much on it!") - THE ITEM CARD, DRAWN AND MEASURED.
//
// A pin can say the card pins its buttons and the sheet bounds its height; only a layout engine can say a player can
// PRESS them. So the REAL pack (ui/inventoryDoor.js createInventoryWindow, the enhanced skin) is drawn over the real
// sheets with the heaviest cards the game has - a piece of Ruhn's Regalia carried (the report's own Horned Crown), a
// raid set's weapon (a sigil's blow and a set), Ruhn's Gatecleaver, a Legendary with an enchantment, a worn set piece
// held at its stage (the longest stage line), a raid piece with the longest name, a stack with its how-many field and
// a locked piece - at a wide screen, the reporter's class of laptop, a 1280x720 window, a netbook, a phone on its side
// and a phone upright. For each card it reads:
//   - THE BUTTONS: every one of the card's acts inside the screen and the TOPMOST thing at its own centre (pressable,
//     never under the screen's foot, the window's edge or the card's own scroll);
//   - THE CARD: inside the screen, its name on screen, and never taller than the window it stands in;
//   - THE HOVER CARD (a pointer's screens): inside the screen, nothing cut.
// Every card is photographed (the whole screen, so what a player sees is what is kept).
//
// The container has no ARENA2, so no picture loads; the page stands a 96px block where the card's picture would be
// (its own box, SLOT_BOX.card) - shrunk and taken as the card's fit steps take the picture - so every card is measured
// as tall as the game draws it.
//
// IT RUNS ON VITE'S OWN DEV SERVER (tools/qs3Probe.mjs's reason).
//
//     node tools/cardFitProbe.mjs                    -> shots (tools/shots/, or SHOT_DIR) and a report
//     PROBE_PORT=<n> node tools/cardFitProbe.mjs     -> reuse a dev server already listening there
import { mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'cardfit.tmp.html';
const OUT = process.env.SHOT_DIR ?? join(ROOT, 'tools/shots');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CARD-FIT probe</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:repeating-linear-gradient(45deg,#3b4a3a 0 14px,#324031 14px 28px)}
/* the picture the container cannot load, standing in at its own box (SLOT_BOX.card, the 96px the game draws) and
   shrinking and going as the card's own fit steps take the real one */
.card-body:not(:has(> .bigicon))::before,.inv-tip .card:not(:has(> .bigicon))::before{content:'';display:block;width:96px;height:96px;margin:2px auto 8px;background:rgba(255,255,255,0.08)}
.card-compact .card-body:not(:has(> .bigicon))::before,.inv-tip.tip-compact .card:not(:has(> .bigicon))::before{width:56px;height:56px}
.card-tight .card-body:not(:has(> .bigicon))::before,.inv-tip.tip-tight .card:not(:has(> .bigicon))::before{display:none}</style></head><body>
<script type="module">
import { setSigilOnline, setSigilRenown } from '/src/systems/sigil/sigil.js';
import { setSetsWearer } from '/src/systems/sigil/sigilSets.js';
import { REGALIA, RAID_SET_PIECES, mintAetheric } from '/src/systems/aetheric.js';
import { LEGENDARIES, applyRarity } from '/src/systems/loot/lootRarity.js';
import { equipItem, unequipItem } from '/src/systems/equip.js';
import { setItemFields, mintCondition } from '/src/systems/item/itemTemplates.js';
import { createWeapon } from '/src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '/src/systems/armorMaterials.js';
import { setLocked } from '/src/systems/item/itemLock.js';
import { setPref } from '/src/systems/uiPrefs.js';
import { createInventoryWindow } from '/src/ui/inventoryDoor.js';
import { mountEnhancedPlayerTrade } from '/src/ui/enhanced/enhancedPlayerTrade.js';

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
const wear = (it) => { e.items.push(it); equipItem(e, it); return it; };
const carry = (it) => { e.items.push(it); return it; };
const aeth = (id) => mintAetheric([...REGALIA, ...RAID_SET_PIECES].find((r) => r.id === id));
// THE KIT: a worn Dagon set held at Kindled by its helm and the Renown (the longest stage line); the heaviest cards carried
const CARDS = {};
function kit() {
  for (const it of [...e.items]) if (it.equipSlot != null) unequipItem(e, it);
  e.items.length = 0;
  for (const t of [107, 106, 105, 102, 103, 104]) wear(armour(t, 'dagon', t === 107 ? 6000 : 13000));
  CARDS.worn = e.items[0];
  CARDS.crown = carry(aeth('ruhn-horned-crown'));
  CARDS.oathsunder = carry(aeth('oath-longsword'));
  CARDS.gatecleaver = carry(aeth('ruhn-gatecleaver'));
  CARDS.pauldron = carry(aeth('thieftaker-right-pauldron'));
  const leg = createWeapon(120, 5); leg.isIdentified = true;
  applyRarity(leg, 'legendary', () => 0, [LEGENDARIES.find((r) => r.id === 'wyrmbane')]);
  CARDS.legendary = carry(leg);
  const arrows = createWeapon(131, 1); arrows.stackCount = 40; CARDS.stack = carry(arrows);
  const locked = armour(108, 'orcsbane', 0); setLocked(locked, true); CARDS.locked = carry(locked);
}
globalThis.__online = (on) => { setSigilOnline(!!on); if (on) setSigilRenown(12); };
globalThis.__online(true);
globalThis.__openPack = () => {
  kit();
  document.getElementById('enhanced-inventory')?.remove();
  return !!createInventoryWindow({ entity: e, items: () => e.items, wagonItems: () => [] });
};
globalThis.__closeCard = () => { document.querySelectorAll('.inv-tip').forEach((n) => n.remove()); };
globalThis.__tab = (label) => { const b = [...document.querySelectorAll('#enhanced-inventory .packtab')].find((x) => x.textContent.startsWith(label)); b?.click(); return !!b; };
const box = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.x + r.width, b: r.y + r.height }; };
const rowOf = (it) => [...document.querySelectorAll('#enhanced-inventory .itemrow, #enhanced-inventory .wornrow, #enhanced-inventory .wornsock')]
  .find((n) => n.querySelector('.itemname, .wornname')?.textContent?.includes(it.name) || n.getAttribute('aria-label')?.includes(it.name) || n.title?.includes?.(it.name));
globalThis.__pick = (key) => {
  const it = CARDS[key];
  const row = rowOf(it);
  if (!row) return { found: false };
  (row.matches('button') ? row : row.querySelector('button') ?? row).click();
  return { found: true };
};
globalThis.__measure = () => {
  const tip = document.querySelector('.packtip');
  if (!tip) return null;
  const vw = innerWidth, vh = innerHeight;
  const frame = tip.parentElement;
  const acts = [...tip.querySelectorAll('.acts button')].map((b) => {
    const r = box(b);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const top = cx >= 0 && cy >= 0 && cx < vw && cy < vh ? document.elementFromPoint(cx, cy) : null;
    return { label: b.textContent, box: r, inside: r.x >= -0.5 && r.y >= -0.5 && r.r <= vw + 0.5 && r.b <= vh + 0.5, pressable: !!top && (top === b || b.contains(top)) };
  });
  const card = tip.querySelector('.card');
  const h3 = tip.querySelector('h3');
  return { tip: box(tip), card: box(card), frame: box(frame), name: box(h3), nameText: h3?.textContent ?? '', acts, vw, vh,
    scroll: card ? { sh: card.scrollHeight, ch: card.clientHeight } : null, lines: card?.innerText.split('\\n').filter((l) => l.trim()).length ?? 0,
    body: (() => { const b = tip.querySelector('.card-body'); return b ? { sh: b.scrollHeight, ch: b.clientHeight } : null; })(),
    fits: [...(card?.classList ?? [])].filter((c) => c.startsWith('card-')) };
};
globalThis.__hover = (key) => {
  document.querySelectorAll('.inv-tip').forEach((n) => n.remove());
  const row = rowOf(CARDS[key]);
  const b = row?.matches('button') ? row : row?.querySelector('button') ?? row;
  b?.dispatchEvent(new MouseEvent('mouseenter'));
  const tip = document.querySelector('.inv-tip');
  return tip ? { ...box(tip), sh: tip.scrollHeight, ch: tip.clientHeight } : null;
};
// THE TRADE WINDOW (the card audit's U4): the detail strip a pick in my pack column opens, over a session at rest
globalThis.__trade = () => {
  kit();
  document.getElementById('enhanced-inventory')?.remove();
  document.getElementById('ptrade-probe')?.remove();
  const host = document.createElement('div'); host.id = 'ptrade-probe';
  host.style.cssText = 'position:fixed;inset:0;z-index:13;background:transparent;overflow:hidden;overflow:clip';
  document.body.append(host);
  const ok = () => ({ ok: true });
  const session = { peerName: 'Bram', phase: 'open', mine: { entries: [], gold: 0 }, theirs: { items: [], gold: 0 }, myLock: false,
    theirLock: false, myConfirm: false, bothLocked: false, hasContent: false, withdrawing: false, lastMessage: '', isOver: false,
    setOffer: ok, lock: ok, unlock: ok, confirm: ok, cancel() {} };
  mountEnhancedPlayerTrade(host, { session, deps: { items: () => e.items, entity: e, gold: () => 100, onExit() {} } });
  return true;
};
globalThis.__tradePick = (key) => {
  const it = CARDS[key];
  const row = [...document.querySelectorAll('#ptrade-probe .itemrow')].find((n) => n.querySelector('.itemname')?.textContent?.includes(it.name));
  row?.click();
  return !!row;
};
globalThis.__tradeMeasure = () => {
  const d = document.querySelector('#ptrade-probe .trade-detail');
  if (!d) return null;
  const vw = innerWidth, vh = innerHeight;
  const acts = [...d.querySelectorAll('button')].map((b) => {
    const r = box(b);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const top = cx >= 0 && cy >= 0 && cx < vw && cy < vh ? document.elementFromPoint(cx, cy) : null;
    return { label: b.textContent, box: r, pressable: !!top && (top === b || b.contains(top)) };
  });
  const lists = [...document.querySelectorAll('#ptrade-probe .packlists > *')].map((n) => box(n).h);
  return { detail: box(d), win: box(document.querySelector('#ptrade-probe .px-win')), acts, lists, vh };
};
globalThis.__ready = true;
</script></body></html>`;

const VIEWS = [
  { name: 'wide', viewport: { width: 1920, height: 1080 } },
  { name: 'laptop', viewport: { width: 1366, height: 768 } },
  { name: 'laptop-bars', viewport: { width: 1366, height: 625 } },   // a 768 laptop less its taskbar and the browser's bars
  { name: 'small', viewport: { width: 1280, height: 720 } },
  { name: 'netbook', viewport: { width: 1024, height: 600 } },
  { name: 'tablet', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true },   // the 641-860 band, upright
  { name: 'phone-wide', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },   // the band, a phone on its side
  { name: 'phone-land', viewport: { width: 740, height: 360 }, isMobile: true, hasTouch: true },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];
// each card: its key in the page's kit and the pack page it is on
const CARDS = [
  ['crown', 'Armor'], ['worn', 'Armor'], ['pauldron', 'Armor'], ['locked', 'Armor'],
  ['oathsunder', 'Weapons'], ['gatecleaver', 'Weapons'], ['stack', 'Weapons'], ['legendary', 'Magic'],
];

mkdirSync(OUT, { recursive: true });
const vite = process.env.PROBE_PORT ? null : await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1', watch: null }, logLevel: 'error' });
if (vite) await vite.listen();
const port = vite ? vite.httpServer.address().port : Number(process.env.PROBE_PORT);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const fails = [];
let checks = 0;
const check = (ok, what) => { checks++; if (!ok) fails.push(what); };
const settle = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res)))));
try {
  await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: v.viewport, isMobile: !!v.isMobile, hasTouch: !!v.hasTouch, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (err) => fails.push(`${v.name}: page error ${err.message}`));
    await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?skin=enhanced`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => globalThis.__ready === true, null, { timeout: 90000 });
    check(await page.evaluate(() => globalThis.__openPack()), `${v.name}: the pack did not open`);
    await page.waitForSelector('#enhanced-inventory .packtab', { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    for (const [key, tab] of CARDS) {
      await page.evaluate(() => globalThis.__closeCard());
      check(await page.evaluate((t) => globalThis.__tab(t), tab), `${v.name}: no ${tab} page`);
      await settle(page);
      const got = await page.evaluate((k) => globalThis.__pick(k), key);
      check(got.found, `${v.name}: no row for the ${key} card`);
      if (!got.found) continue;
      await settle(page);
      const m = await page.evaluate(() => globalThis.__measure());
      check(!!m, `${v.name}: the ${key} card did not open`);
      if (!m) continue;
      const unreachable = m.acts.filter((a) => !a.inside || !a.pressable).map((a) => `${a.label}@${a.box.y.toFixed(0)}..${a.box.b.toFixed(0)}`);
      const scrolls = m.body && m.body.sh > m.body.ch + 1;
      console.log(`${v.name} ${key.padEnd(11)} card ${m.card.w.toFixed(0)}x${m.card.h.toFixed(0)} at ${m.card.y.toFixed(0)}..${m.card.b.toFixed(0)} of ${m.vh} (frame ${m.frame.y.toFixed(0)}..${m.frame.b.toFixed(0)}) lines ${m.lines} ${scrolls ? `BODY SCROLLS ${m.body.sh}/${m.body.ch}` : 'whole'} [${m.fits.join(' ')}] acts ${m.acts.length}${unreachable.length ? ` UNREACHABLE ${unreachable.join(', ')}` : ''}`);
      // a laptop and up: the heaviest card is read WHOLE, no scroll (a netbook's and a phone's may scroll under their buttons)
      if (v.viewport.height >= 720) check(!scrolls, `${v.name}: the ${key} card needs a scroll (${m.body?.sh} of ${m.body?.ch})`);
      check(m.acts.length > 0, `${v.name}: the ${key} card has no buttons`);
      check(!unreachable.length, `${v.name}: the ${key} card's buttons cannot be pressed: ${unreachable.join(', ')}`);
      check(m.name && m.name.y >= -0.5 && m.name.b <= m.vh + 0.5, `${v.name}: the ${key} card's name is off the screen (${m.name?.y.toFixed(0)}..${m.name?.b.toFixed(0)})`);
      check(m.card.y >= -0.5 && m.card.b <= m.vh + 0.5, `${v.name}: the ${key} card runs off the screen (${m.card.y.toFixed(0)}..${m.card.b.toFixed(0)} of ${m.vh})`);
      await page.screenshot({ path: join(OUT, `cardfit-${v.name}-${key}.png`) });
      // THE HOVER CARD, on a pointer's screen: inside the screen, nothing cut
      if (!v.hasTouch) {
        const t = await page.evaluate((k) => globalThis.__hover(k), key);
        if (t) {
          check(t.y >= -0.5 && t.b <= v.viewport.height + 0.5, `${v.name}: the ${key} hover card runs off the screen (${t.y.toFixed(0)}..${t.b.toFixed(0)})`);
          check(t.sh <= t.ch + 1, `${v.name}: the ${key} hover card is cut (${t.sh} of ${t.ch})`);
        }
        await page.evaluate(() => globalThis.__closeCard());
      }
    }
    // THE TRADE WINDOW'S STRIP (U4): each heavy piece picked in my pack column - the strip inside the window, its
    // buttons pressable, and the lists above it never squeezed to nothing
    check(await page.evaluate(() => globalThis.__trade()), `${v.name}: the trade window did not open`);
    await settle(page);
    for (const key of ['crown', 'gatecleaver', 'oathsunder', 'stack']) {
      if (!(await page.evaluate((k) => globalThis.__tradePick(k), key))) { check(false, `${v.name}: no trade row for the ${key}`); continue; }
      await settle(page);
      const t = await page.evaluate(() => globalThis.__tradeMeasure());
      check(!!t, `${v.name}: the ${key} trade strip did not open`);
      if (!t) continue;
      const stuck = t.acts.filter((a) => !a.pressable).map((a) => `${a.label}@${a.box.y.toFixed(0)}`);
      console.log(`${v.name} trade ${key.padEnd(11)} strip ${t.detail.h.toFixed(0)} tall at ${t.detail.y.toFixed(0)}..${t.detail.b.toFixed(0)} (window ..${t.win.b.toFixed(0)}) lists ${t.lists.map((h) => h.toFixed(0)).join('/')}${stuck.length ? ` STUCK ${stuck.join(', ')}` : ''}`);
      check(!stuck.length, `${v.name}: the ${key} trade strip's buttons cannot be pressed: ${stuck.join(', ')}`);
      check(t.detail.b <= Math.min(t.win.b, t.vh) + 0.5, `${v.name}: the ${key} trade strip runs past the window (${t.detail.b.toFixed(0)})`);
      check(Math.max(...t.lists) >= 80, `${v.name}: the ${key} trade strip squeezed the lists to ${t.lists.map((h) => h.toFixed(0)).join('/')}`);
      await page.screenshot({ path: join(OUT, `cardfit-${v.name}-trade-${key}.png`) });
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
