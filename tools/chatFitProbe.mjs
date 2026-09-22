// CHAT-FIT (2026-09-22, Mac: "names sometimes take up 2 rows, the list
// isnt scrollable and continues to grow, enlarging the chat. Glyphs
// should also show on chat names in the chat itself"): THE CHAT BOX
// MEASURED. The pins can say a rule reads `nowrap` and a column is
// `absolute`; only a layout engine can say a nineteen-name roster does
// not make the box taller, that a row is one line, and that the list
// scrolls. So this stands the REAL panel (createChatPanel over a real
// ChatLog, the real CHAT_CSS over the real enhanced sheet) in Chromium
// at a desktop and a phone-landscape viewport, with a roster of 24 long
// names wearing titles and glyphs and a conversation whose authors wear
// them too, and measures.
//
//     node tools/chatFitProbe.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENHANCED_CSS, ENHANCED_TOKENS } from '../src/ui/enhancedStyle.js';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ROOT = normalize(join(fileURLToPath(import.meta.url), '..', '..'));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

async function serveRepo(page) {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'probe.local') return route.continue();
    try {
      if (url.pathname === '/') return route.fulfill({ status: 200, contentType: 'text/html', body: PAGE });
      const body = readFileSync(join(ROOT, url.pathname.replace(/^\/+/, '')), 'utf8');
      const type = url.pathname.endsWith('.js') || url.pathname.endsWith('.mjs') ? 'text/javascript' : url.pathname.endsWith('.json') ? 'application/json' : 'text/html';
      route.fulfill({ status: 200, contentType: type, body });
    } catch { route.fulfill({ status: 404, body: 'no' }); }
  });
}
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>${ENHANCED_TOKENS}${ENHANCED_CSS}
 html,body{margin:0;height:100%;background:#1b1a17;overflow:hidden}
 .floor{position:fixed;inset:0;background:repeating-linear-gradient(45deg,#2a3a21 0 14px,#233a1a 14px 28px)}
</style></head><body><div class="floor"></div></body></html>`;

const NAMES = ['Aralas Foresthollow', 'Arman Forestsky', 'Caligula Tibersion', 'Elisrim Mosspool', 'Iberon', 'Icebreyker', 'Ignatious', 'Joctaed', 'Lather', 'LostMyLeg', 'Nilnus', 'Oiner66',
  'Palidriel Oakthorn', 'Satranath', 'SerSoouoius', 'Shanoskia', 'Shurkan Moabenar', 'Skeptikali', 'Wellbutrin', 'Bartholomew Longfellow-Winterbottom', 'Xy', 'Zenithia Starwhisper', 'Quill', 'Vorenthal Duskbringer'];

const b = await chromium.launch();
for (const [W, H, label] of [[1280, 720, 'desktop'], [900, 420, 'phone']]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.error('PAGEERR', String(e).slice(0, 300)));
  await serveRepo(p);
  await p.goto('http://probe.local/', { waitUntil: 'load' });
  const m = await p.evaluate(async (names) => {
    const { createChatPanel } = await import('/src/ui/chatPanel.js');
    const { ChatLog } = await import('/src/net/chat.js');
    const peers = new Map(names.map((name, i) => [`p${i}`, { id: `p${i}`, name, title: i % 3 === 0 ? 'founder' : null, glyphs: i % 2 === 0 ? ['sprout'] : [] }]));
    const session = { id: 'me', name: 'Me', title: 'dev', glyphs: ['dev'], peers, roomCount: null };
    let rosterSize = 3;
    const rosterOf = () => ({ ...session, peers: new Map([...peers].slice(0, rosterSize)) });
    const log = new ChatLog({ now: () => Date.now() });
    const badgeOf = (id) => (id === 'me' ? { title: 'dev', glyphs: ['dev'] } : peers.get(id) ? { title: peers.get(id).title, glyphs: peers.get(id).glyphs } : null);
    const panel = createChatPanel({ log, onSend: () => true, roster: rosterOf, badgeOf, canOpen: () => true, action: () => null, overlay: () => false, touch: false });
    const at = Date.now();
    const said = [['p0', 'touch spells target others but the starting heal is self only (balmyr\'s balm or something?)'], ['p5', 'dumb question but where can I see time?'], ['p1', 'btw, can i turn on/off som mods on multiplayer?'], ['p2', 'go south from here to the nearby town'], ['me', 'gj!']];
    for (const [id, text] of said) log.push('world', { id, name: id === 'me' ? 'Me' : peers.get(id).name, text, at, mine: id === 'me' });
    log.setOpen(true);
    const frame = () => { panel.render?.(); panel.paint?.(); };
    frame();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    frame();
    const box = document.querySelector('.dfchat-box');
    const boxH3 = box.getBoundingClientRect().height;
    rosterSize = names.length; frame();
    await new Promise((r) => requestAnimationFrame(r));
    frame();
    const boxH24 = box.getBoundingClientRect().height;
    const rows = [...document.querySelectorAll('.dfchat-who-row')].map((r) => ({ h: r.getBoundingClientRect().height, name: r.querySelector('.dfchat-who-name')?.textContent, cut: (r.querySelector('.dfchat-who-name')?.scrollWidth ?? 0) > (r.querySelector('.dfchat-who-name')?.clientWidth ?? 0) + 1 }));
    const lineH = parseFloat(getComputedStyle(document.querySelector('.dfchat-who-row')).lineHeight);
    const list = document.querySelector('.dfchat-wholist');
    const who = document.querySelector('.dfchat-who'), main = document.querySelector('.dfchat-main');
    const lines = [...document.querySelectorAll('.dfchat-list .dfchat-line')].map((l) => ({ title: l.querySelector('.dfchat-line-title')?.textContent ?? null, glyphs: l.querySelectorAll('.dfchat-line-glyph').length, name: l.querySelector('.dfchat-name')?.textContent }));
    return { boxH3, boxH24, rows, lineH, listScroll: list.scrollHeight, listClient: list.clientHeight, whoH: who.getBoundingClientRect().height, mainH: main.getBoundingClientRect().height, lines, rosterRows: rows.length };
  }, NAMES);
  const shot = `${OUT}/chatfit-${label}.png`;
  await p.screenshot({ path: shot });
  console.log(`\n${label} ${W}x${H}: box ${m.boxH3.toFixed(0)}px with 3 peers, ${m.boxH24.toFixed(0)}px with ${m.rosterRows - 1}; roster column ${m.whoH.toFixed(0)}px beside a ${m.mainH.toFixed(0)}px conversation; list ${m.listScroll}px of content in ${m.listClient}px; rows ${m.rows.map((r) => r.h.toFixed(0)).join('/')}px at line ${m.lineH}px; ${m.rows.filter((r) => r.cut).length} names cut with an ellipsis`);
  check(`${label}: the roster does not grow the box - 24 names, same height as 3`, Math.abs(m.boxH24 - m.boxH3) < 1, `${m.boxH3.toFixed(1)} vs ${m.boxH24.toFixed(1)}`);
  check(`${label}: the column is exactly as tall as the conversation`, Math.abs(m.whoH - m.mainH) < 1, `${m.whoH.toFixed(1)} vs ${m.mainH.toFixed(1)}`);
  check(`${label}: the list scrolls - more content than room`, m.listScroll > m.listClient + 20, `${m.listScroll} in ${m.listClient}`);
  check(`${label}: every roster row is ONE line`, m.rows.every((r) => r.h <= m.lineH + 1), `tallest ${Math.max(...m.rows.map((r) => r.h)).toFixed(1)} against a ${m.lineH}px line`);
  check(`${label}: a long name is cut with an ellipsis rather than folded`, m.rows.some((r) => r.cut), `${m.rows.filter((r) => r.cut).map((r) => r.name).join(', ')}`);
  check(`${label}: the chat lines wear their authors' badges`, m.lines[0].title === 'Founder' && m.lines[0].glyphs === 1 && m.lines[1].title === null && m.lines[1].glyphs === 0 && m.lines[4].glyphs === 1, JSON.stringify(m.lines));
  console.log('  shot:', shot);
  await ctx.close();
}
await b.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
