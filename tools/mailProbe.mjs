// MAIL1 PROBE: THE LETTERS TAB IN A REAL BROWSER.
//
//   node tools/mailProbe.mjs        (SHOT_DIR=tools/shots by default)
//
// test/mail1.test.js drives the tab over a fake document, which proves what it DOES and nothing about how it LOOKS:
// whether the widest sender, the longest subject and a letter of one unbroken word stay inside the panel, whether the
// form fits a phone, whether a finger can hit what it needs. This mounts the REAL panel (ui/socialPanel.js) over the
// real enhanced sheet in Chromium with a REAL MailBox (net/mail.js) whose fetch answers the service's own shapes, at
// the widest content the letter's law allows, and reads the layout back - at a desktop, a narrow window, and a phone
// on the touch skin.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
let fails = 0, checks = 0;
const check = (name, ok, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const server = await createServer({ server: { port: 5238, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const pageErrors = [];

for (const [W, H, label, touch] of [[1440, 900, 'desktop', false], [480, 800, 'narrow', false], [390, 700, 'phone', true]]) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch });
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  await page.goto('http://localhost:5238/play/?skin=enhanced&touch=off');
  await page.evaluate(async (touch) => {
    const { createSocialPanel } = await import('/src/ui/socialPanel.js');
    const { SocialState } = await import('/src/net/social.js');
    const { MailBox } = await import('/src/net/mail.js');
    const { LETTER_SUBJECT_MAX, LETTER_BODY_MAX, LETTER_LINES_MAX, LETTERS_INBOX_MAX } = await import('/src/net/letterLaw.js');
    const { HANDLE_MAX_LEN } = await import('/src/net/accountClient.js');
    const { GLYPHS } = await import('/src/net/identityToken.js');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:repeating-linear-gradient(45deg,#2a2721 0 14px,#231f1a 14px 28px);height:100vh';
    (await import('/src/ui/enhancedStyle.js')).injectEnhancedStyle();
    // THE WIDEST LETTERS THE LAW ALLOWS: a full box, every sender at the handle's bound in its widest letter and every
    // glyph, every subject at its bound; the one opened is the body's bound of one unbroken word and the lines' bound.
    const W24 = 'W'.repeat(HANDLE_MAX_LEN);
    const now = Math.floor(Date.now() / 1000);
    const heads = Array.from({ length: LETTERS_INBOX_MAX }, (_, i) => ({
      id: `letter${String(i).padStart(18, '0')}`, from: i ? `Sender${i}` : W24, title: i ? null : 'Developer', glyphs: i ? [] : [...GLYPHS],
      subject: i ? `Letter ${i}` : 'W'.repeat(LETTER_SUBJECT_MAX), sentAt: now - i * 3600, read: i > 2,
    }));
    const word = 'W'.repeat(200);
    const lines = Array.from({ length: LETTER_LINES_MAX - 1 }, (_, i) => `Line ${i + 1} of the terms.`);
    const body = [word, ...lines].join('\n').slice(0, LETTER_BODY_MAX);
    const answer = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
    const fetch = async (url, init = {}) => {
      const path = new URL(url).pathname;
      if (path === '/v1/mail/inbox') return answer({ letters: heads, unread: 3, max: LETTERS_INBOX_MAX });
      if (path === '/v1/mail/read') { const id = JSON.parse(init.body).id; const h = heads.find((l) => l.id === id); return answer({ letter: { ...h, body, readAt: now } }); }
      if (path === '/v1/mail/send') return answer({ error: 'inbox-full' }, 409);
      return answer({ ok: true, id: 'x' });
    };
    const box = new MailBox({ ioOf: () => ({ fetch, base: 'https://svc', secret: 's'.repeat(43) }) });
    const social = new SocialState({ acct: 'acct-me' });
    social.apply({ t: 'social', k: 'state', acct: 'acct-me', name: 'Me', peers: [], in: [], out: [], party: null, invites: [],
      friends: [{ acct: 'acct-w', name: W24, online: true, seen: null, peers: ['peer-w'] }, { acct: 'acct-g', name: 'Lysandus Tell', online: false, seen: Date.now() - 3600e3, peers: [] }] });
    const panel = createSocialPanel({ social, mail: box, touch, canOpen: () => true, overlay: () => false });
    window.__mail = { panel, box };
  }, touch);
  const frame = async () => { await page.evaluate(async () => { for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r, 30)); window.__mail.panel.render(); } }); };
  // the read-back: the panel against the screen, a view's body against its own box, every row and button inside it
  const measure = () => page.evaluate(() => {
    const root = document.querySelector('.dfsocial');
    const body = root.querySelector('.dfsocial-body');
    const r = root.getBoundingClientRect(), b = body.getBoundingClientRect();
    const spills = [];
    for (const n of body.querySelectorAll('.dfsocial-letter, .dfsocial-row, .dfsocial-btn, .dfsocial-field, .dfsocial-name, .dfsocial-sub, .dfsocial-subject, .dfsocial-lettertext')) {
      const q = n.getBoundingClientRect();
      if (q.width && (q.right > b.right + 0.5 || q.left < b.left - 0.5)) spills.push(`${n.className} ${Math.round(q.left)}-${Math.round(q.right)} of ${Math.round(b.left)}-${Math.round(b.right)}`);
      if (n.scrollWidth > n.clientWidth + 1 && !n.matches('textarea, input')) spills.push(`${n.className} scrolls ${n.scrollWidth}/${n.clientWidth}`);
    }
    const tabs = root.querySelector('.dfsocial-tabs');
    const fields = [...body.querySelectorAll('.dfsocial-field')].map((f) => ({ h: f.getBoundingClientRect().height, font: parseFloat(getComputedStyle(f).fontSize), tag: f.tagName }));
    const buttons = [...root.querySelectorAll('.dfsocial-btn, .dfsocial-tab, .dfsocial-letter')].filter((x) => x.getBoundingClientRect().width).map((x) => Math.round(x.getBoundingClientRect().height));
    return {
      panel: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: innerWidth, vh: innerHeight },
      bodyScrollsX: body.scrollWidth > body.clientWidth + 1, spills, tabsFit: tabs.scrollWidth <= tabs.clientWidth + 1,
      fields, minButton: buttons.length ? Math.min(...buttons) : 0,
      text: body.textContent.slice(0, 600),   // the words as written - innerText would read the section heading's text-transform
    };
  });
  const inScreen = (m) => m.panel.left >= 0 && m.panel.right <= m.panel.vw + 0.5 && m.panel.bottom <= m.panel.vh + 0.5;

  // THE BOX
  await page.evaluate(() => window.__mail.panel.openLetters());
  await frame(); await frame();
  let m = await measure();
  check(`${label}: the panel stands on the screen with the Letters tab open`, inScreen(m), JSON.stringify(m.panel));
  check(`${label}: three tabs and Close in one bar`, m.tabsFit);
  check(`${label}: the box - the widest sender with every glyph and the longest subject stay inside it`, !m.spills.length && !m.bodyScrollsX, m.spills.slice(0, 3).join('; '));
  check(`${label}: the fill beside its name`, m.text.includes('Letters (50/50)'), m.text.slice(0, 80));
  if (touch) check(`${label}: every row, tab and button is a finger's (44px)`, m.minButton >= 44, `smallest ${m.minButton}`);
  await page.screenshot({ path: `${OUT}/mail-list-${label}.png` });

  // ONE LETTER: a word two hundred letters long, and the lines' bound
  await page.evaluate(() => document.querySelector('.dfsocial-letter').click());
  await frame(); await frame();
  m = await measure();
  check(`${label}: the letter - one unbroken word of 200 breaks inside the panel, the lines kept`, !m.spills.length && !m.bodyScrollsX, m.spills.slice(0, 3).join('; '));
  const reachable = await page.evaluate(() => { const b = document.querySelector('.dfsocial-body'); b.scrollTop = b.scrollHeight; const q = [...document.querySelectorAll('.dfsocial-btn')].find((x) => x.textContent === 'Delete').getBoundingClientRect(); const r = b.getBoundingClientRect(); return q.bottom <= r.bottom + 0.5 && q.top >= r.top - 0.5; });
  check(`${label}: Reply and Delete reached at the letter's foot`, reachable);
  await page.evaluate(() => { document.querySelector('.dfsocial-body').scrollTop = 0; });
  await page.screenshot({ path: `${OUT}/mail-read-${label}.png` });

  // THE FORM, and a refusal in it
  await page.evaluate(() => [...document.querySelectorAll('.dfsocial-btn')].find((x) => x.textContent === 'Reply').click());
  await frame();
  m = await measure();
  check(`${label}: the form - three fields and its buttons inside the panel`, !m.spills.length && m.fields.length === 3, m.spills.slice(0, 3).join('; '));
  const ta = m.fields.find((f) => f.tag === 'TEXTAREA');
  check(`${label}: the letter's field is tall enough to write in`, ta && ta.h >= 120, `height ${ta?.h}`);
  if (touch) check(`${label}: every field a finger's and 16px (no zoom on focus)`, m.fields.every((f) => f.h >= 44 && f.font >= 16), JSON.stringify(m.fields));
  await page.evaluate(() => { const t = document.querySelector('textarea.dfsocial-field'); t.value = 'Agreed.'; t.dispatchEvent(new Event('input')); [...document.querySelectorAll('.dfsocial-btn')].find((x) => x.textContent === 'Send').click(); });
  await frame(); await frame();
  m = await measure();
  check(`${label}: a refusal is said in the form, and the draft stands`, m.text.includes('Their letterbox is full') && await page.evaluate(() => document.querySelector('textarea.dfsocial-field').value === 'Agreed.'));
  await page.screenshot({ path: `${OUT}/mail-write-${label}.png` });

  // A FRIEND'S ROW: Invite, Letter and Remove beside the widest name; a guest's Letter refused with its reason
  await page.evaluate(() => [...document.querySelectorAll('.dfsocial-tab')].find((x) => x.dataset.tab === 'friends').click());
  await frame();
  m = await measure();
  check(`${label}: a friend's row - the widest name beside Invite, Letter and Remove`, !m.spills.length, m.spills.slice(0, 3).join('; '));
  check(`${label}: a guest friend's Letter says why not`, m.text.includes('no username'));
  await page.screenshot({ path: `${OUT}/mail-friends-${label}.png` });
  await page.close();
}

check('no page error', !pageErrors.length, pageErrors.slice(0, 3).join(' | '));
await browser.close();
await server.close();
console.log(`${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
