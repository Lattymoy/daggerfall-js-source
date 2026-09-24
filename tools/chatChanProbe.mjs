// CHAT-CHAN, MEASURED (2026-09-23, kurkku: "Global chat ... regional chat ... party chat"; Addison Knox: "Roleplay chat
// channels (IC/OOC)").
//
// test/chatchan.test.js holds the law on fakes; this mounts the REAL panel over the real sheets in Chromium and reads
// the layout back where a fake cannot: the tab bar's four tabs AND the Social button on ONE row at the sheet's width
// and at the narrowest box a phone gives (352px) - on the desktop skin and the touch skin, whose tabs are a thumb's -
// every tab's hover, the field's placeholder following the tab, an aside drawn leaning and dimmed, and the peek's
// channel mark in the tab's own colour (the Party mark in the party's one green). DICE1 and EMOTE1 read theirs here
// too: a roll's colour; the form row with the emoji button at every width (the field never under the narrowest the
// chat had before it), the picker's round trip, an action's face, and a joined emoji drawn as ONE glyph after the
// wire's own sanitizer.
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
// EMOTE1: the narrowest field the chat shipped before the emoji button - the touch skin's at a 320px phone (114.9px,
// measured at d7da2279), a skin the button never reaches. No skin at any width may squeeze the field under it.
const FIELD_FLOOR = 114;

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
    // EMOTE1: THE FORM ROW with the emoji button - every control inside the box, the field no narrower than the
    // narrowest the chat shipped before the button (FIELD_FLOOR) - and the picker: open, a pick into the field, closed
    // by the pick. In a box the screen narrowed below any a drag can choose, the button gives way; a grid opened in a
    // wider box (the window narrowed under it) must still open inside this one and close on a pick.
    const form = await page.evaluate(async (touch) => {
      const { CHAT_WIDTH_MIN } = await import('/src/ui/chatPanel.js');
      const box = document.querySelector('.dfchat-box').getBoundingClientRect();
      const btn = document.querySelector('.dfchat-emoji');
      const shown = getComputedStyle(btn).display !== 'none';
      const ctrls = ['.dfchat-input', ...(shown ? ['.dfchat-emoji'] : []), '.dfchat-send', '.dfchat-hide', '.dfchat-close'].map((q) => document.querySelector(q).getBoundingClientRect());
      const inside = ctrls.every((r) => r.left >= box.left - 0.5 && r.right <= box.right + 0.5);
      const field = ctrls[0].width;
      const narrow = box.width < CHAT_WIDTH_MIN;
      if (touch) return { inside, field: Math.round(field), shown, narrow };
      btn.click();
      const grid = document.querySelector('.dfchat-emojis');
      const gr = grid.getBoundingClientRect();
      const open = getComputedStyle(grid).display !== 'none' && gr.left >= box.left - 0.5 && gr.right <= box.right + 0.5 && gr.height > 0;
      const input = document.querySelector('.dfchat-input');
      input.value = 'hi'; input.setSelectionRange(2, 2);
      grid.querySelector('.dfchat-emoji-pick').click();
      return { inside, field: Math.round(field), shown, narrow, open, value: input.value, closed: getComputedStyle(grid).display === 'none' };
    }, touch);
    check(`${skin} ${W}px: the form row inside the box, the field no narrower than any the chat had before the picker`, form.inside && form.field >= FIELD_FLOOR, `field ${form.field}px, floor ${FIELD_FLOOR}px`);
    if (touch) check(`${skin} ${W}px: no emoji button - the phone keyboard has its own`, !form.shown);
    else if (form.narrow) check(`${skin} ${W}px: a box the screen narrowed below any a drag can choose - the button gives way; a grid opened wider still opens inside it, a pick lands and closes it`, !form.shown && form.open && form.value === 'hi\u{1F604}' && form.closed, JSON.stringify(form));
    else check(`${skin} ${W}px: the picker opens inside the box, a pick lands in the field and closes it`, form.shown && form.open && form.value === 'hi\u{1F604}' && form.closed, JSON.stringify(form));
    if (!touch && W === 1440) {
      // THE EDGE: the smallest box a drag can make keeps the button; a pixel under it (only a screen can do that) gives
      // it way - the query measures inside the box's border, and the rule takes the border off to ask about the box
      const edge = await page.evaluate(async () => {
        const { CHAT_WIDTH_MIN } = await import('/src/ui/chatPanel.js');
        const root = document.querySelector('.dfchat'), btn = document.querySelector('.dfchat-emoji');
        const at = (w) => { root.style.width = `${w}px`; return { box: document.querySelector('.dfchat-box').getBoundingClientRect().width, shown: getComputedStyle(btn).display !== 'none' }; };
        const out = { atMin: at(CHAT_WIDTH_MIN), under: at(CHAT_WIDTH_MIN - 1) };
        root.style.width = '';
        return out;
      });
      check('the smallest box a drag can make keeps the emoji button; a pixel under it gives it way', edge.atMin.shown && !edge.under.shown, JSON.stringify(edge));
    }
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
      // DICE1: a roll the relay made, in its own colour and the dice's own words; a typed line that reads like one is not
      const roll = await page.evaluate(() => {
        const { log, panel } = globalThis.__chan;
        log.push('local', { id: 'plocal000001', name: 'Ysolde', roll: { n: 2, m: 6, k: 3, dice: [4, 5], total: 12 } });
        log.push('local', { id: 'plocal000002', name: 'Faker', text: 'rolls 2d6+3: 6 + 6 +3 = 15' });
        panel.render({});
        const lines = [...document.querySelectorAll('.dfchat-list .dfchat-line')];
        const read = (n) => ({ roll: n.classList.contains('roll'), text: n.querySelector('.dfchat-text').textContent, color: getComputedStyle(n.querySelector('.dfchat-text')).color });
        return [read(lines.at(-2)), read(lines.at(-1))];
      });
      check('a roll is drawn in its own colour, in the dice\'s words - and a typed line that reads like one is not', roll[0].roll && roll[0].text === 'rolls 2d6+3: 4 + 5 +3 = 12' && roll[0].color === 'rgb(231, 196, 106)' && !roll[1].roll && roll[1].color !== roll[0].color, JSON.stringify(roll));
      // EMOTE1: an action leans; a joined family through the wire's own sanitizer is ONE glyph wide, and the same
      // three people with the joiners gone (as the sanitizer had them) are three
      const emo = await page.evaluate(async () => {
        const { log, panel } = globalThis.__chan;
        const { sanitizeChat } = await import('/src/net/wire.js');
        const family = '\u{1F468}\u200d\u{1F469}\u200d\u{1F467}';
        log.push('local', { id: 'plocal000001', name: 'Ysolde', text: 'waves at Bran.', me: true });
        log.push('local', { id: 'plocal000001', name: 'Ysolde', text: sanitizeChat(family) });
        log.push('local', { id: 'plocal000001', name: 'Ysolde', text: family.replace(/\u200d/g, '') });
        panel.render({});
        await document.fonts.ready;
        const lines = [...document.querySelectorAll('.dfchat-list .dfchat-line')];
        const w = (n) => { const r = document.createRange(); r.selectNodeContents(n.querySelector('.dfchat-text')); return r.getBoundingClientRect().width; };
        return { me: getComputedStyle(lines.at(-3).querySelector('.dfchat-text')).fontStyle, meClass: lines.at(-3).classList.contains('me'), joined: w(lines.at(-2)), apart: w(lines.at(-1)), kept: sanitizeChat(family) === family };
      });
      check('an action is drawn leaning', emo.meClass && emo.me === 'italic', JSON.stringify(emo));
      check('a joined family survives the wire and draws as ONE emoji; the same people unjoined draw as three', emo.kept && emo.joined > 0 && emo.apart > emo.joined * 2.2, `joined ${Math.round(emo.joined)}px, apart ${Math.round(emo.apart)}px`);
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
