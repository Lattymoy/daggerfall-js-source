// CHAT-CHAN, MEASURED (2026-09-23, kurkku: "Global chat ... regional chat ... party chat"; Addison Knox: "Roleplay chat
// channels (IC/OOC)").
//
// test/chatchan.test.js holds the law on fakes; this mounts the REAL panel over the real sheets in Chromium and reads
// the layout back where a fake cannot: the tab bar's four tabs AND the Social button on ONE row at the sheet's width
// and at the narrowest box a phone gives (352px) - on the desktop skin and the touch skin, whose tabs are a thumb's -
// every tab's hover, the field's placeholder following the tab, an aside drawn leaning and dimmed, and the peek's
// channel mark in the tab's own colour (the Party mark in the party's one green).
//
//     node tools/chatChanProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const server = await createServer({ server: { port: 5234, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const pageErrors = [];

async function mount(page, touch) {
  await page.evaluate(async (touch) => {
    const { ChatLog } = await import('/src/net/chat.js');
    const { createChatPanel } = await import('/src/ui/chatPanel.js');
    document.body.innerHTML = '';
    const log = new ChatLog();
    log.push('world', { id: 'pworld000001', name: 'Bran', text: 'anyone selling arrows?' });
    let answer = true;
    const panel = createChatPanel({ log, onSend: () => answer, overlay: () => false, touch, social: { onToggle: () => {}, pending: () => 2 } });
    panel.render({});
    globalThis.__chan = { panel, log, setAnswer: (a) => { answer = a; } };
  }, touch);
}
/** The bar as the eye meets it: every button's own box against the strip's and the box's. A tab is SEEN when its whole
 *  box lies inside the strip's visible part (the strip scrolls sideways on a phone; a tab past its edge is reached by a
 *  swipe, and is not squeezed). */
const bar = (page) => page.evaluate(async () => {
  await document.fonts.ready;   // the pixel face's own widths, not a fallback's
  const tabs = document.querySelector('.dfchat-tabs');
  const strip = document.querySelector('.dfchat-tablist');
  const buttons = [...strip.children, tabs.querySelector('.dfchat-social-tab')];
  const box = document.querySelector('.dfchat-box').getBoundingClientRect();
  const bar = tabs.getBoundingClientRect();
  const sr = strip.getBoundingClientRect();
  const social = tabs.querySelector('.dfchat-social-tab').getBoundingClientRect();
  const inRow = buttons.every((b) => { const r = b.getBoundingClientRect(); return r.top >= bar.top - 0.5 && r.bottom <= bar.bottom + 0.5; });
  const tabEls = [...strip.querySelectorAll('.dfchat-tab')];
  // a label is whole when its text's own box fits inside its button (a squeezed tab's text spills past it)
  const whole = (b) => { const range = document.createRange(); range.selectNodeContents(b.firstChild); const t = range.getBoundingClientRect(); const r = b.getBoundingClientRect(); return t.right <= r.right + 0.5 && t.left >= r.left - 0.5; };
  return { inRow, overflow: tabs.scrollWidth - tabs.clientWidth, boxW: Math.round(box.width), socialRight: Math.round(social.right), boxRight: Math.round(box.right),
    squeezed: tabEls.filter((b) => !whole(b)).map((b) => b.dataset.tab),
    seen: tabEls.filter((b) => { const r = b.getBoundingClientRect(); return r.left >= sr.left - 0.5 && r.right <= sr.right + 0.5; }).map((b) => b.dataset.tab),
    stripScrolls: strip.scrollWidth > strip.clientWidth,
    labels: buttons.map((b) => b.childNodes[0]?.textContent ?? ''), titles: tabEls.map((b) => b.title) };
});

for (const touch of [false, true]) {
  for (const [W, H] of [[1440, 900], [380, 800], [320, 640]]) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('pageerror', (e) => pageErrors.push(String(e.message)));
    await page.goto('http://localhost:5234/play/');
    await page.evaluate(() => { try { localStorage.removeItem('dagger.ui.v1'); } catch { /* none */ } });
    await mount(page, touch);
    await page.evaluate(() => { globalThis.__chan.panel.open(); globalThis.__chan.panel.render({}); });
    const skin = touch ? 'touch' : 'desktop';
    const b = await bar(page);
    // THE WORST BAR: the three tabs the player is not reading all unread (the open, active one reads as lines arrive)
    const u = await page.evaluate(async () => {
      const { log, panel } = globalThis.__chan;
      for (const t of ['region', 'party', 'local']) for (let i = 0; i < 12; i++) log.push(t, { id: 'punread00001', name: 'Uma', text: `unread ${i}` });
      panel.render({});
      await document.fonts.ready;
      const tabs = document.querySelector('.dfchat-tabs');
      const strip = document.querySelector('.dfchat-tablist');
      const box = document.querySelector('.dfchat-box').getBoundingClientRect();
      const social = tabs.querySelector('.dfchat-social-tab').getBoundingClientRect();
      const tabEls = [...strip.querySelectorAll('.dfchat-tab')];
      const badges = tabEls.map((b) => { const n = b.querySelector('.dfchat-badge'); const r = n.getBoundingClientRect(); const br = b.getBoundingClientRect();
        return { text: n.textContent, w: Math.round(r.width), shown: getComputedStyle(n).display !== 'none', inside: r.right <= br.right + 0.5, name: b.getAttribute('aria-label') }; });
      const whole = (b) => { const range = document.createRange(); range.selectNodeContents(b.firstChild); const t = range.getBoundingClientRect(); const r = b.getBoundingClientRect(); return t.right <= r.right + 0.5; };
      const out = { overflow: tabs.scrollWidth - tabs.clientWidth, socialIn: social.right <= box.right, badges, squeezed: tabEls.filter((b) => !whole(b)).map((b) => b.dataset.tab),
        scrolls: strip.scrollWidth > strip.clientWidth };
      for (const t of ['region', 'party', 'local']) log.markRead(t);
      panel.render({});
      return out;
    });
    check(`${skin} ${W}px: three tabs unread - the bar still inside the box, Social in it`, u.overflow <= 0 && u.socialIn, `overflow ${u.overflow}px`);
    check(`${skin} ${W}px: ...each unread tab wears a whole DOT inside its button, and says the count as its name`, u.badges.slice(1).every((x) => x.shown && x.w >= 6 && x.w <= 8 && x.inside && x.name.endsWith(', 12 unread')) && !u.badges[0].shown && u.badges[0].name === 'World', JSON.stringify(u.badges));
    check(`${skin} ${W}px: ...and no tab squeezed below its name by it`, u.squeezed.length === 0, u.squeezed.join(', '));
    if (W >= 380) check(`${skin} ${W}px: ...still nothing to scroll`, !u.scrolls);
    check(`${skin} ${W}px: the box is ${Math.min(440, W - 28)}px`, b.boxW === Math.min(440, W - 28), `${b.boxW}px`);
    check(`${skin} ${W}px: World, Region, Party, Local and Social on ONE row`, b.inRow && b.labels.join(',') === 'World,Region,Party,Local,Social', b.labels.join(', '));
    check(`${skin} ${W}px: ...the bar inside the box, Social in it`, b.overflow <= 0 && b.socialRight <= b.boxRight, `overflow ${b.overflow}px, Social ends at ${b.socialRight} of ${b.boxRight}`);
    check(`${skin} ${W}px: ...no tab squeezed below its own name`, b.squeezed.length === 0, b.squeezed.join(', '));
    // a 320px phone's box is 292px: there the strip scrolls sideways - the rest a swipe away, nothing cut
    if (W >= 380) check(`${skin} ${W}px: ...every tab seen at once, nothing to scroll`, b.seen.length === 4 && !b.stripScrolls, `seen ${b.seen.join(', ')}`);
    else check(`${skin} ${W}px: ...the strip scrolls sideways for the rest`, b.stripScrolls && b.seen.includes('world'), `seen ${b.seen.join(', ')}`);
    if (!touch && W === 1440) {
      check('every tab says who it reaches, a hover away', b.titles.length === 4 && b.titles.every((t) => t.length > 8), JSON.stringify(b.titles));
      const ph = await page.evaluate(() => {
        const input = document.querySelector('.dfchat-input');
        const out = [input.placeholder];
        const { log, panel } = globalThis.__chan;
        log.setRoom('region', 'chat:region.17', 'Wayrest');
        log.select('region'); panel.render({});
        out.push(input.placeholder, document.querySelectorAll('.dfchat-tab')[1].title);
        log.select('local'); panel.render({});
        out.push(input.placeholder);
        return out;
      });
      check('the field says where a line goes, and the region by its name', ph[0] === 'Say something - World' && ph[1] === 'Say something - Wayrest' && ph[3] === 'Say something - Local' && ph[2].startsWith('Wayrest - '), JSON.stringify(ph));
      const ooc = await page.evaluate(() => {
        const { log, panel } = globalThis.__chan;
        log.push('local', { id: 'plocal000001', name: 'Ysolde', text: '((brb, the kettle))' });
        log.push('local', { id: 'plocal000001', name: 'Ysolde', text: 'Well met, traveller.' });
        panel.render({});
        const lines = [...document.querySelectorAll('.dfchat-list .dfchat-line')];
        const style = (n) => { const t = n.querySelector('.dfchat-text'); const cs = getComputedStyle(t); return { italic: cs.fontStyle, color: cs.color, ooc: n.classList.contains('ooc') }; };
        return [style(lines.at(-2)), style(lines.at(-1))];
      });
      check('an aside out of character is drawn as one - leaning, and a line in character is not', ooc[0].ooc && ooc[0].italic === 'italic' && !ooc[1].ooc && ooc[1].italic === 'normal' && ooc[0].color !== ooc[1].color, JSON.stringify(ooc));
      const peek = await page.evaluate(() => {
        const { log, panel } = globalThis.__chan;
        log.select('world'); panel.close?.(); log.setOpen(false);
        log.push('party', { id: 'pparty000001', name: 'Cid', text: 'on my way' });
        log.pushAll({ text: 'The server is restarting in five minutes.' });
        panel.render({});
        return [...document.querySelectorAll('.dfchat-peek .dfchat-line')].map((n) => {
          const c = n.querySelector('.dfchat-chan');
          return { mark: c?.textContent ?? null, color: c ? getComputedStyle(c).color : null, text: n.querySelector('.dfchat-text')?.textContent };
        });
      });
      const party = peek.find((p) => p.text === 'on my way');
      const notice = peek.find((p) => p.text?.startsWith('The server'));
      check('the peek marks a line from another tab with that tab - the Party mark in the party\'s green', party?.mark === 'Party' && party?.color === 'rgb(115, 255, 115)', JSON.stringify(party));
      check('...and a notice the game said on every tab wears none', notice && notice.mark === null, JSON.stringify(notice));
      const read = await page.evaluate(() => {
        const { panel, setAnswer, log } = globalThis.__chan;
        panel.open(); panel.render({});
        const input = document.querySelector('.dfchat-input');
        input.value = '/help'; setAnswer('read');
        document.querySelector('.dfchat-form').requestSubmit();
        const r = { value: input.value, open: log.open };
        input.value = 'hello'; setAnswer(true);
        document.querySelector('.dfchat-form').requestSubmit();
        return { ...r, closedAfter: !log.open };
      });
      check('the list\'s answer clears the field and keeps the chat open; a line that went closes it', read.value === '' && read.open === true && read.closedAfter === true, JSON.stringify(read));
    }
    await page.close();
  }
}
check('no page error', pageErrors.length === 0, pageErrors.join(' | '));
await browser.close();
await server.close();
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
