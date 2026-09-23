// CHAT-SIZE, MEASURED (2026-09-23, Mac: "the ability to click and drag the chat to resize/along with the text").
//
// test/chatsize.test.js holds the law on a fake; this drags the REAL grip with the real mouse over the real sheets in
// Chromium and reads the layout back: the box's width, the list's height, a line's computed font size and a roster
// row's, the Send button's (which must NOT scale - a thumb's target), and the friends panel's rectangle against the
// chat box's - beside it on a wide screen, under it on a narrow one, and never over it (AUDIT SOC C13's law, which the
// old fixed numbers kept only while the chat could not change size). Then a reload: the size is the player's.
//
//     node tools/chatSizeProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const server = await createServer({ server: { port: 5233, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const pageErrors = [];

async function mount(page) {
  await page.evaluate(async () => {
    const { ChatLog } = await import('/src/net/chat.js');
    const { createChatPanel } = await import('/src/ui/chatPanel.js');
    const { createSocialPanel } = await import('/src/ui/socialPanel.js');
    const { SocialState } = await import('/src/net/social.js');
    document.body.innerHTML = '';
    const log = new ChatLog();
    for (let i = 0; i < 30; i++) log.push('world', { id: 'pabcdefgh000' + (i % 3), name: 'Bran', text: `line ${i} of the conversation`, at: Date.now() });
    const roster = () => ({ id: 'me', name: 'Me', title: null, glyphs: [], peers: new Map([['p1', { id: 'p1', name: 'Palidriel', title: null, glyphs: [] }]]) });
    const panel = createChatPanel({ log, onSend: () => true, overlay: () => false, touch: false, roster });
    panel.open(); panel.render({});
    let social = null;
    try { social = createSocialPanel({ social: new SocialState(), overlay: () => false, touch: false }); social.open(); social.render({}); } catch (e) { globalThis.__socialErr = String(e?.message ?? e); }
    globalThis.__chat = { panel, social, log };
  });
}
const measure = (page) => page.evaluate(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
  const fs = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
  const q = (s) => document.querySelector(s);
  const sp = document.querySelector('.dfsocial');
  return {
    box: r(q('.dfchat-box')), list: r(q('.dfchat-list')), grip: r(q('.dfchat-grip')), close: r(q('.dfchat-close')),
    line: fs(q('.dfchat-list .dfchat-line')), row: fs(q('.dfchat-who-row')), send: fs(q('.dfchat-send')),
    social: sp && getComputedStyle(sp).display !== 'none' ? r(sp) : null, fit: document.documentElement.dataset.dfchatFit ?? null,
    socialErr: globalThis.__socialErr ?? null,
  };
});
const overlaps = (a, b) => !!a && !!b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
const dragGrip = async (page, dx, dy) => {
  const g = await page.evaluate(() => { const b = document.querySelector('.dfchat-grip').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
  await page.mouse.move(g[0], g[1]); await page.mouse.down();
  await page.mouse.move(g[0] + dx / 2, g[1] + dy / 2, { steps: 4 }); await page.mouse.move(g[0] + dx, g[1] + dy, { steps: 4 });
  await page.mouse.up();
  await page.evaluate(() => { globalThis.__chat.panel.render({}); globalThis.__chat.social?.render({}); });
};

for (const [W, H] of [[1440, 900], [900, 900]]) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  await page.goto('http://localhost:5233/play/');
  await page.evaluate(() => { try { localStorage.removeItem('dagger.ui.v1'); } catch { /* none */ } });
  await mount(page);
  const a = await measure(page);
  if (a.socialErr) console.log('note: the friends panel could not mount here:', a.socialErr);
  check(`${W}x${H}: the sheet's own size`, a.box.w === Math.min(440, W - 28) && Math.abs(a.line - 13) < 0.01, `box ${a.box.w}px, line ${a.line}px, list ${a.list.h}px, fit ${a.fit}`);
  await dragGrip(page, 220, 120);
  const b = await measure(page);
  check(`${W}x${H}: dragged 220 right - the box is 660 wide`, b.box.w === 660, `${b.box.w}px`);
  check(`${W}x${H}: ...and the text along with it (13px x 1.5)`, Math.abs(b.line - 19.5) < 0.01 && Math.abs(b.row - 18) < 0.01, `line ${b.line}px, roster ${b.row}px`);
  check(`${W}x${H}: dragged 120 down - the list is taller by the travel`, Math.abs(b.list.h - a.list.h - 120) <= 1, `${a.list.h} -> ${b.list.h}`);
  check(`${W}x${H}: the buttons are a thumb's and do not scale`, Math.abs(b.send - 14) < 0.01, `Send ${b.send}px`);
  check(`${W}x${H}: the grip stands at the box's bottom-right corner`, b.grip.r >= b.box.r - 8 && b.grip.b >= b.box.b - 8, JSON.stringify(b.grip));
  check(`${W}x${H}: the grip covers no part of the Close button`, !overlaps(b.grip, b.close) && !overlaps(a.grip, a.close), `grip ${JSON.stringify(b.grip)} close ${JSON.stringify(b.close)}`);
  const wantFit = W >= 14 + 660 + 12 + 360 + 14 ? 'beside' : 'below';
  check(`${W}x${H}: the chat says the friends panel fits ${wantFit}`, b.fit === wantFit, `fit ${b.fit}`);
  if (b.social) {
    check(`${W}x${H}: the friends panel does not stand over the resized box`, !overlaps(b.social, b.box), `panel ${JSON.stringify(b.social)} box ${JSON.stringify(b.box)}`);
    if (wantFit === 'beside') check(`${W}x${H}: ...it stands beside it`, b.social.l >= b.box.r, `${b.social.l} >= ${b.box.r}`);
    else check(`${W}x${H}: ...it stands under it`, b.social.t >= b.box.b, `${b.social.t} >= ${b.box.b}`);
  } else check(`${W}x${H}: the friends panel was drawn to measure`, false, 'not drawn');
  // a reload: the size is the player's
  await page.reload();
  await mount(page);
  const c = await measure(page);
  check(`${W}x${H}: after a reload the box is still 660 and the text 19.5`, c.box.w === 660 && Math.abs(c.line - 19.5) < 0.01, `${c.box.w}px, ${c.line}px`);
  // a double click puts the sheet's size back
  await page.dblclick('.dfchat-grip');
  await page.evaluate(() => globalThis.__chat.panel.render({}));
  const d = await measure(page);
  check(`${W}x${H}: a double click gives the sheet's own size back`, d.box.w === Math.min(440, W - 28) && Math.abs(d.line - 13) < 0.01, `${d.box.w}px, ${d.line}px`);
  await page.close();
}
if (pageErrors.length) { console.log('pageerrors:', pageErrors.join(' | ')); fails++; }
await browser.close(); await server.close();
console.log(fails === 0 ? 'CHAT SIZE PROBE: ALL GREEN' : `CHAT SIZE PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
