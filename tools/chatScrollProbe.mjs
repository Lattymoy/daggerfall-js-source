// CHAT-SCROLL, MEASURED (2026-09-23, Starempire42: "when you open the chat it just stays idle so you have to manually
// scroll down to the newest message every single time").
//
// test/chatscroll.test.js proves the law on a fake that lays out; this drives the REAL panel over the real sheet in
// Chromium and reads the list's own scrollTop against its own scroll range after each thing a player does: the first
// open, an open after lines arrived while closed, an open after the reader had scrolled up and closed, lines under a
// reader at the bottom, lines under a reader who scrolled up (not yanked, counted on the bar), the bar's click, and
// every line wearing a badge that wraps it (the title before the name, the glyphs after it).
//
// Chromium keeps a display:none scroller's offset; the engines that drop it are exactly the case the fake models, so
// this probe cannot show that half - it shows the rest in a real layout.
//
//     node tools/chatScrollProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const server = await createServer({ server: { port: 5231, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e.message)));
await page.goto('http://localhost:5231/play/');
for (const badges of [false, true]) {
  const steps = await page.evaluate(async (badges) => {
    const { ChatLog } = await import('/src/net/chat.js');
    const { createChatPanel } = await import('/src/ui/chatPanel.js');
    document.body.innerHTML = '';
    const log = new ChatLog();
    const panel = createChatPanel({ log, onSend: () => true, overlay: () => false, touch: false,
      badgeOf: badges ? () => ({ title: 'founder', glyphs: ['sprout', 'dev'] }) : null });
    const list = panel.root.querySelector('.dfchat-list');
    const jump = panel.root.querySelector('.dfchat-jump');
    let n = 0;
    const say = (k) => { for (let i = 0; i < k; i++, n++) log.push('world', { id: 'pabcdefgh000' + (n % 3), name: 'Bran', text: `line ${n} - a sentence long enough to come near the edge of the box`, at: Date.now() }); panel.render({}); };
    const at = () => ({ top: Math.round(list.scrollTop), max: Math.round(list.scrollHeight - list.clientHeight), bar: jump.textContent });
    const out = [];
    say(40); panel.open(); panel.render({}); out.push(['first open', at()]);
    panel.close(); panel.render({}); say(5); panel.open(); panel.render({}); out.push(['open after 5 lines came in while closed', at()]);
    list.scrollTop = 0; panel.render({}); panel.close(); panel.render({}); say(2); panel.open(); panel.render({}); out.push(['open after reading history and closing', at()]);
    say(1); out.push(['a line under a reader at the bottom', at()]);
    list.scrollTop = 40; panel.render({}); say(3); out.push(['three lines under a reader who scrolled up', at()]);
    jump.click(); panel.render({}); out.push(['the bar clicked', at()]);
    return out;
  }, badges);
  const tag = badges ? ' (badged, wrapping)' : '';
  const newest = (w) => w.top >= w.max - 8;
  for (const [what, w] of steps) {
    if (what === 'three lines under a reader who scrolled up') check(what + tag, w.top === 40 && w.bar === '3 new - jump to newest', `scrollTop ${w.top} of ${w.max}, bar "${w.bar}"`);
    else check(what + tag, newest(w) && w.bar === '', `scrollTop ${w.top} of ${w.max}${w.bar ? `, bar "${w.bar}"` : ''}`);
  }
}
if (pageErrors.length) { console.log('pageerrors:', pageErrors.join(' | ')); fails++; }
await browser.close(); await server.close();
console.log(fails === 0 ? 'CHAT SCROLL PROBE: ALL GREEN' : `CHAT SCROLL PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
