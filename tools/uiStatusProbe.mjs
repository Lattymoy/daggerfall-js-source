// UI3 (2026-09-27, the Plus UI pass - bible/10-UI/Slots-Hotbar-Status.md; Mac: "move buffs/debuffs/etc to their own
// widget space somewhere on the side of the screen, where it doesn't interact with other UI elements, and use square
// icons with glyphs for each effect (climates and calories included)") - THE STATUS WIDGET, DRAWN WITH THE REAL
// ARENA2 AND MEASURED.
//
// The REAL HUD (ui/enhancedHud.js over the real sheets, the enhanced skin) under a character carrying everything the
// widget can show at once - three spells (one mine, one another's and ending, one an item's), a set power, a poison, a
// disease, and every need Climates & Calories raises (hungry, parched, drowsy, soaked, freezing, stiff, drunk) - with
// the chat's own sheet and five peek lines at its corner, at a desktop, two laptops, a phone both ways up and a desktop
// at HUD scale 1.5; then the chat opened, and an escort's face at the corner. For each it reads:
//   - SQUARE TILES: every tile the sheet's 36px at the HUD's scale, its picture drawn - a spell's from ICON00I0, fitted
//     and never resampled (UI1's law), a glyph's and a rune's loaded;
//   - NOTHING MET: the widget meets none of the caption it stands on, the diamond, the chat's box, the escort face's
//     band, the vitals, the Renown row - and stays on the screen;
//   - A LONG LIST WRAPS into a next column rather than running up into the chat;
//   - the names beside the tiles on a desktop, none on a phone or in a tight band; the ending spell blinking;
//   - the Renown bar's XP inside it; a phone's vitals their numbers alone, centred.
// Each view is photographed (the widget close up, and the whole screen).
//
// IT RUNS ON VITE'S OWN DEV SERVER, whose /arena2/ mount serves the local game data (never the repo's).
//
//     node tools/uiStatusProbe.mjs                    -> shots (tools/shots/, or SHOT_DIR) and a report
//     PROBE_PORT=<n> node tools/uiStatusProbe.mjs     -> reuse a dev server already listening there
import { mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'uistatus.tmp.html';
const OUT = process.env.SHOT_DIR ?? join(ROOT, 'tools/shots');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>UI3 probe</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:repeating-linear-gradient(45deg,#3b4a3a 0 14px,#324031 14px 28px)}</style></head><body>
<script type="module">
import { setPref } from '/src/systems/uiPrefs.js';
import { drawEnhancedHud, setHudSetChips } from '/src/ui/enhancedHud.js';
import { setHudRenown } from '/src/ui/hudRenown.js';
import { renownXpFor } from '/src/net/renown.js';
import { CHAT_CSS } from '/src/ui/chatPanel.js';
import { POISONS } from '/src/systems/poisons.js';
import { DISEASES } from '/src/systems/diseases.js';
import { survivalOf } from '/src/systems/survival/needs.js';
import { worldMinutes } from '/src/systems/worldTick.js';

setPref('survival', 'casual');
const spell = (id, name, icon, self, rounds, type = 'Spell') => ({ kind: 'shield', bundleId: id, bundleName: name, bundleIcon: icon, bundleSelfCast: self, bundleType: type, roundsRemaining: rounds });
const e = { isPlayer: true, name: 'Aelwyn', career: { name: 'Spellsword' }, level: 12,
  stats: { strength: 50, endurance: 48, willpower: 50, intelligence: 50, agility: 50, speed: 50, personality: 50, luck: 50 },
  health: 70, maxHealth: 100, fatigue: 150, maxFatigue: 200, magicka: 14, maxMagicka: 20, items: [], spells: [],
  activeEffects: [
    spell(1, 'Shield', 5, true, 24), spell(2, 'Paralysis', 20, false, 1), spell(3, 'Ring of Warmth', 12, true, 1, 'HeldMagicItem'),
    { kind: 'poison', poison: POISONS.Arsenic, state: 'active', statMods: {} },
    { kind: 'disease', disease: DISEASES.WitchesPox, incubationOver: true, statMods: {} },
  ] };
const now = Math.floor(worldMinutes());
const s = survivalOf(e, now);
Object.assign(s, { lastAte: now - 800, thirst: 85, sleepDebt: 9, wet: 120, felt: -40, stiffUntil: now + 600, drunk: 30 });
setHudSetChips(() => [{ key: 'wrath', set: 'ruhn', name: 'Wrath', text: '45s', state: 'active' }]);
setHudRenown(() => ({ level: 20, xp: renownXpFor(20) + 5420, pending: 800 }));

// the chat's own sheet and its corner: five peek lines and the hint, as a closed chat stands over the world
const css = document.createElement('style'); css.textContent = CHAT_CSS; document.head.append(css);
const chat = document.createElement('div');
chat.className = 'dfchat' + (matchMedia('(pointer: coarse) and (hover: none)').matches ? ' touch' : '');
const peek = document.createElement('div'); peek.className = 'dfchat-peek';
for (const [n, t] of [['Bran', 'anyone up for the Daggerfall dungeons?'], ['Ann', 'sure, after I sell this loot'], ['Mara', 'the gate is open near Wayrest again'],
  ['Bran', 'bring cure disease potions'], ['Ann', 'on my way']]) {
  const l = document.createElement('div'); l.className = 'dfchat-line';
  l.innerHTML = '<span class="dfchat-name">' + n + '</span>: <span class="dfchat-text">' + t + '</span>';
  peek.append(l);
}
const hint = document.createElement('div'); hint.className = 'dfchat-hint'; hint.textContent = 'Enter to chat';
const box = document.createElement('div'); box.className = 'dfchat-box'; box.style.height = '340px';
chat.append(peek, hint, box);
// AUDIT UI C1: an OFFLINE view has no chat at all - the compass and a foe's bar are what stand above the widget there
if (!new URLSearchParams(location.search).has('offline')) document.body.append(chat);
globalThis.__chatOpen = (on) => { chat.dataset.state = on ? 'open' : ''; };
// a touch screen's top-left presses (ui/touch.js: the dial and the menu, 48 square at 16 and 72 down 16) - stand-ins
if (matchMedia('(pointer: coarse) and (hover: none)').matches) for (const x of [16, 72]) {
  const b = document.createElement('div'); b.className = 'probe-touchbtn';
  b.style.cssText = 'position:fixed;left:' + x + 'px;top:16px;width:48px;height:48px;z-index:5;background:rgba(40,40,40,.6);border:1px solid rgba(255,255,255,.22);border-radius:14px';
  document.body.append(b);
}

let escortBottom = 0;
globalThis.__escort = (px) => { escortBottom = px; };
function frame() { drawEnhancedHud(e, 0.25, 1 / 60, { escortBottom }); requestAnimationFrame(frame); }
frame();
const rect = (n) => { if (!n || !n.getClientRects().length || getComputedStyle(n).display === 'none') return null; const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
globalThis.__measure = () => {
  const stat = document.querySelector('.hud-stat');
  const cells = [...(stat?.querySelectorAll('.hst-cell') ?? [])];
  const d = devicePixelRatio;
  return {
    vw: innerWidth, vh: innerHeight,
    stat: rect(stat), tight: !!stat?.classList.contains('tight'), side: !!stat?.classList.contains('side'), none: !!stat?.classList.contains('noroom'), rows: stat?.style.gridTemplateRows ?? '',
    short: matchMedia('(max-height: 500px)').matches,
    touch: [...document.querySelectorAll('.probe-touchbtn')].map(rect),
    tiles: cells.map((c) => {
      if (c.classList.contains('more')) return { cls: c.className, name: c.querySelector('.hst-name')?.textContent ?? '', foot: c.querySelector('.hst-foot')?.textContent ?? null, tile: rect(c.querySelector('.hst-tile')), named: !!rect(c.querySelector('.hst-name')), pic: { blink: 'none' } };
      const pic = c.querySelector('.hst-pic');
      const pr = pic.getBoundingClientRect();
      const name = c.querySelector('.hst-name');
      return { cls: c.className, glyph: c.dataset.glyph ?? null, set: c.dataset.set ?? null, tile: rect(c.querySelector('.hst-tile')),
        name: name?.textContent ?? '', named: !!rect(name), foot: c.querySelector('.hst-foot')?.textContent ?? null,
        pic: { src: !!pic.getAttribute('src'), loaded: pic.complete && pic.naturalWidth > 0, nat: [pic.naturalWidth, pic.naturalHeight], shown: [pr.width, pr.height],
          resampled: Math.abs(pic.naturalWidth - pr.width * d) > 0.75 || Math.abs(pic.naturalHeight - pr.height * d) > 0.75,
          blink: getComputedStyle(pic).animationName } };
    }),
    cap: rect(document.querySelector('.hud-qcap')), diamond: rect(document.querySelector('.hud-qdiamond')),
    chat: chat.isConnected ? rect(chat) : null, top: rect(document.querySelector('.hud-top')),
    bars: rect(document.querySelector('.hud-bars')), renown: rect(document.querySelector('.hud-renown')),
    xp: document.querySelector('.hud-renownnum')?.textContent ?? '', xpBox: rect(document.querySelector('.hud-renownnum')), xpTrack: rect(document.querySelector('.hud-renowntrack')),
    vitals: [...document.querySelectorAll('.hud-vital')].map((v) => ({ label: rect(v.querySelector('.hud-vlabel')), num: rect(v.querySelector('.hud-num')), track: rect(v.querySelector('.hud-track')), text: v.textContent })),
  };
};
</script></body></html>`;

const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, dpr: 1 },
  { name: 'laptop-1366', viewport: { width: 1366, height: 768 }, dpr: 1 },
  { name: 'laptop-1280', viewport: { width: 1280, height: 800 }, dpr: 2 },
  { name: 'desktop-hud1.5', viewport: { width: 1440, height: 900 }, dpr: 1, scale: 1.5 },
  { name: 'laptop-offline', viewport: { width: 1024, height: 768 }, dpr: 1, offline: true },   // AUDIT UI C1: no chat - the compass bounds it
  { name: 'desktop-hud2-offline', viewport: { width: 1440, height: 900 }, dpr: 1, scale: 2, offline: true },
  { name: 'phone', viewport: { width: 390, height: 844 }, dpr: 3, isMobile: true, hasTouch: true, phone: true },
  { name: 'phone-land', viewport: { width: 844, height: 390 }, dpr: 3, isMobile: true, hasTouch: true, phone: true },
];

const meets = (a, b, slack = 0) => !!a && !!b && a.x < b.r - slack && b.x < a.r - slack && a.y < b.b - slack && b.y < a.b - slack;

mkdirSync(OUT, { recursive: true });
const vite = process.env.PROBE_PORT ? null : await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1', watch: null }, logLevel: 'error' });
if (vite) await vite.listen();
const port = vite ? vite.httpServer.address().port : Number(process.env.PROBE_PORT);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const fails = [];
let checks = 0;
const check = (ok, what) => { checks++; if (!ok) fails.push(what); };
const settle = (page) => page.evaluate(() => new Promise((res) => { let n = 0; const f = () => (++n > 40 ? res() : requestAnimationFrame(f)); f(); }));
try {
  await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: v.viewport, isMobile: !!v.isMobile, hasTouch: !!v.hasTouch, deviceScaleFactor: v.dpr });
    const page = await ctx.newPage();
    page.on('pageerror', (err) => fails.push(`${v.name}: page error ${err.message}`));
    await page.route('**/tools/arena2/**', (route) => route.continue({ url: route.request().url().replace('/tools/arena2/', '/arena2/') }));
    await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?skin=enhanced${v.offline ? '&offline' : ''}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => typeof globalThis.__measure === 'function' && document.querySelectorAll('.hst-cell').length > 0, null, { timeout: 60000 });
    if (v.scale) await page.evaluate(async (sc) => { (await import('/src/systems/uiPrefs.js')).setPref('hudScale', sc); }, v.scale);
    // the spell icons land from ICON00I0 async: wait for every picture
    await page.waitForFunction(() => [...document.querySelectorAll('.hst-pic')].every((p) => p.complete && p.naturalWidth > 0), null, { timeout: 30000 }).catch(() => {});
    await settle(page);
    // an escort's portrait (FACES.CIF, 64 tall at native 36) at the classic's own floored scale on this canvas (hud.js
    // hudScale - the canvas is the window's pixels at the device's ratio), in the window's pixels
    const escort = Math.round(((36 + 64) * Math.max(1, Math.floor(Math.min(v.viewport.width * v.dpr / 320, v.viewport.height * v.dpr / 200)))) / v.dpr);
    for (const state of ['closed', 'open', 'escort']) {
      await page.evaluate(([st, px]) => { globalThis.__chatOpen(st === 'open'); globalThis.__escort(st === 'escort' ? px : 0); }, [state, escort]);
      await settle(page);
      const m = await page.evaluate(() => globalThis.__measure());
      const tag = `${v.name}/${state}`;
      const sc = v.scale ?? 1;
      const xs = new Set(m.tiles.map((t) => Math.round(t.tile?.x ?? -1)));
      const tile = (m.short ? 28 : 36) * sc;
      if (m.none) {
        // NOWHERE: only where no band holds a tile - above the caption, or beside the diamond under what stands above
        const band0 = Math.max(m.chat?.b ?? 0, state === 'escort' ? escort : 0, m.top && m.top.x < m.vw / 2 ? m.top.b : 0, ...m.touch.map((t) => t.b));
        console.log(`${tag.padEnd(24)} steps aside: caption at ${m.cap?.y.toFixed(0)}, diamond to ${m.diamond?.b.toFixed(0)}, what stands above to ${band0}`);
        check(m.cap.y - band0 < tile + 16 * sc && (!m.diamond || m.diamond.b - Math.max(m.cap.y, band0 + 8) < tile), `${tag}: stepped aside with a band to stand in`);
        continue;
      }
      console.log(`${tag.padEnd(24)} ${m.tiles.length} tiles in ${xs.size} column(s), rows ${m.rows}${m.tight ? ' (tight)' : ''}${m.side ? ' BESIDE the diamond' : ''}; widget ${m.stat ? `${m.stat.x.toFixed(0)},${m.stat.y.toFixed(0)} ${m.stat.w.toFixed(0)}x${m.stat.h.toFixed(0)}` : 'none'}; caption at ${m.cap?.y.toFixed(0)}, chat to ${m.chat?.b.toFixed(0)}`);
      // all thirteen, or the ones that fit left of the middle and one more saying how many it stands for
      const more = m.tiles.find((t) => /\bmore\b/.test(t.cls));
      check(more ? m.tiles.length - 1 + Number(more.foot?.slice(1)) === 13 && m.tiles.at(-1) === more : m.tiles.length === 13, `${tag}: ${m.tiles.length} tiles${more ? ` and ${more.foot}` : ''}, not 13`);
      for (const t of m.tiles) {
        if (t === more) continue;
        check(t.tile && Math.abs(t.tile.w - tile) <= 0.5 && Math.abs(t.tile.h - tile) <= 0.5, `${tag}: ${t.name}'s tile is ${t.tile?.w}x${t.tile?.h}, not square at ${tile}`);
        check(t.pic.src && t.pic.loaded, `${tag}: ${t.name}'s picture did not load`);
        if (!t.glyph && !t.set) check(!t.pic.resampled, `${tag}: ${t.name}'s spell icon resampled (${t.pic.nat} shown ${t.pic.shown.map((n) => n.toFixed(1))})`);
        check(t.named === (!v.phone && !m.tight), `${tag}: ${t.name}'s name ${t.named ? 'shown' : 'hidden'}`);
        check(!m.tight || !t.named, `${tag}: a tight widget names ${t.name}`);
      }
      const para = m.tiles.find((t) => t.name === 'Paralysis');
      check(para?.pic.blink === 'hst-blink', `${tag}: the ending spell does not blink (${para?.pic.blink})`);
      check(m.tiles.find((t) => t.name === 'Ring of Warmth')?.pic.blink === 'none', `${tag}: an item's ending blinks`);
      check(m.stat && m.stat.x >= 0 && m.stat.r <= m.vw && m.stat.y >= 0 && m.stat.b <= m.vh, `${tag}: the widget runs off the screen`);
      // at rest it keeps to the screen's left half; crowded (the chat opened, an escort's face down to the middle) it may
      // run further as a block of icons - on a phone the keyboard stands over this half of the screen while the chat is open
      if (state === 'closed') check(m.stat && m.stat.r <= m.vw / 2, `${tag}: the widget reaches ${m.stat?.r.toFixed(0)}, past the screen's middle`);
      for (const [what, r] of [['the caption', m.cap], ['the diamond', m.diamond], ['the vitals', m.bars], ['the Renown row', m.renown], ['the compass and the foe bar', m.top], ...m.touch.map((t) => ['a touch press', t])]) {
        check(!meets(m.stat, r), `${tag}: the widget meets ${what}`);
      }
      const topOver = m.top && m.top.x < m.vw / 2 && m.top.r > m.cap.x ? m.top.b : 0;   // the top block, where it spans the widget's half
      const band = Math.max(m.chat?.b ?? 0, state === 'escort' ? escort : 0, topOver, ...m.touch.map((t) => t.b));
      if (!m.side) {
        // ABOVE: between what stands above and the caption it stands on
        check(m.stat.y >= band - 0.5, `${tag}: the widget reaches up to ${m.stat.y.toFixed(0)}, over what stands above at ${band}`);
        check(m.stat.b <= m.cap.y + 0.5, `${tag}: the widget runs down into the caption`);
        check(!meets(m.stat, m.chat), `${tag}: the widget meets the chat`);
      } else {
        // BESIDE: only where the band above holds one row at the most; right of the diamond, within its height, and
        // under what stands above (a phone on its side: the chat's peek lines cross the diamond there, not the widget)
        check(m.cap.y - band < (2 * tile / sc + (m.short ? 6 : 8) + 16) * sc, `${tag}: beside the diamond with two rows' band above (${(m.cap.y - band).toFixed(0)}px)`);
        check(m.stat.x >= m.diamond.r && m.stat.y >= Math.max(m.cap.y, band) - 0.5 && m.stat.b <= m.diamond.b + 0.5, `${tag}: beside the diamond, yet not right of it, within its height and under what stands above`);
        check(!meets(m.stat, m.chat), `${tag}: the widget meets the chat`);
      }
      check(xs.size === Math.ceil(m.tiles.length / Number(/repeat\((\d+)/.exec(m.rows)?.[1] ?? 13)), `${tag}: ${xs.size} columns for ${m.rows}`);
      check(m.rows.endsWith(`, ${m.short ? 28 : 36}px)`), `${tag}: rows of ${m.rows}, not the screen's tile`);
      if (state === 'closed') {
        check(/^5,420 \/ 13,800 XP$/.test(m.xp), `${tag}: the bar says "${m.xp}"`);
        check(m.xpBox && m.xpTrack && m.xpBox.x >= m.xpTrack.x - 0.5 && m.xpBox.r <= m.xpTrack.r + 0.5 && m.xpBox.y >= m.xpTrack.y - 0.5 && m.xpBox.b <= m.xpTrack.b + 0.5, `${tag}: the XP runs out of its bar`);
        for (const vt of m.vitals) {
          if (v.viewport.width <= 640) {
            check(!vt.label, `${tag}: a phone's vital still says its word ("${vt.text}")`);
            check(vt.num && Math.abs((vt.num.x + vt.num.w / 2) - (vt.track.x + vt.track.w / 2)) <= 1, `${tag}: a phone's number is off its bar's middle`);
          } else check(vt.label && vt.num && vt.label.r <= vt.num.x, `${tag}: the word runs into the number ("${vt.text}")`);
        }
        await page.screenshot({ path: join(OUT, `uistatus-${v.name}.png`) });
      }
      if (m.stat) {
        const pad = 12;
        const clip = { x: Math.max(0, m.stat.x - pad), y: Math.max(0, m.stat.y - pad) };
        clip.width = Math.min(m.vw - clip.x, m.stat.w + 2 * pad);
        clip.height = Math.min(m.vh - clip.y, (m.diamond?.b ?? m.cap.b) - clip.y + pad);
        await page.screenshot({ path: join(OUT, `uistatus-${v.name}-${state}-widget.png`), clip });
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
