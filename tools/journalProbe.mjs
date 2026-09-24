// JOURNAL1 PROBE: THE JOURNAL, SHARED, IN A REAL BROWSER.
//
//   node tools/journalProbe.mjs        (SHOT_DIR=tools/shots by default)
//
// test/journal1.test.js drives the chronicle's Share, the reader's window and the Letters tab's Keep over fake documents,
// which proves what they DO and nothing about how they LOOK. This stands the real surfaces over the real enhanced sheet
// in Chromium, at the widest content the law allows, and reads the layout back - at a desktop, a narrow window, and a
// phone on the touch skin:
//   - THE CHRONICLE'S SHARE: a note's strip naming a crowd of readers at the name's bound (NAME_MAX of the face's widest
//     letter), the letter, and what a press said - all inside the note's card, nothing scrolling sideways;
//   - THE READER'S WINDOW: the widest page the law takes - a head at PAGE_HEAD_MAX, PAGE_LINES_MAX lines, one of them a
//     single unbroken word at PAGE_LINE_MAX - inside the screen, its page scrolling inside the card and its buttons on
//     screen at the card's foot; and kept;
//   - THE LETTERS TAB: a letter read, with Keep in my journal beside Reply and Delete;
//   - THE F-MENU: "Read their page" on a player at the name's bound.
// A finger's 44px wherever the phone asks for it. Photographs to tools/shots/.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
let fails = 0, checks = 0;
const check = (name, ok, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const server = await createServer({ server: { port: 5239, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const pageErrors = [];

/** Inside the page: every node matching `sel` under `root` against the box of `within` (a node, or the viewport) - the
 *  ones that spill sideways, and the ones that scroll their own text sideways. */
const SPILLS = `(root, sel, within) => {
  const b = within ? within.getBoundingClientRect() : { left: 0, right: innerWidth, top: 0, bottom: innerHeight };
  const out = [];
  for (const n of root.querySelectorAll(sel)) {
    const q = n.getBoundingClientRect();
    if (!q.width) continue;
    if (q.right > b.right + 0.5 || q.left < b.left - 0.5) out.push(n.className + ' ' + Math.round(q.left) + '-' + Math.round(q.right) + ' of ' + Math.round(b.left) + '-' + Math.round(b.right));
    if (n.scrollWidth > n.clientWidth + 1) out.push(n.className + ' scrolls ' + n.scrollWidth + '/' + n.clientWidth);
  }
  return out;
}`;

for (const [W, H, label, touch] of [[1440, 900, 'desktop', false], [480, 800, 'narrow', false], [390, 700, 'phone', true]]) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch });
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  await page.goto(`http://localhost:5239/play/?skin=enhanced&touch=${touch ? 'on' : 'off'}`);
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  if (touch) check(`${label}: the phone points coarse, as a finger does`, coarse);

  // ── THE CHRONICLE'S SHARE ──────────────────────────────────────────────────────────────────────────────────────
  await page.evaluate(async () => {
    const { PlayerNotebook, breakableNote } = await import('/src/systems/notebook.js');
    const { NAME_MAX } = await import('/src/net/wire.js');
    const { pageShownText } = await import('/src/net/journalPage.js');
    const m = await import('/src/ui/enhancedChronicle.js');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#161412;height:100vh';
    const nb = new PlayerNotebook({ dateTimeString: () => 'Middas, 22nd of Morning Star, 3E 405, 12:00', cityName: () => 'The Isle of Balfiera' });
    nb.addNote(breakableNote(`Met a stranger at the Rusty Relic who swore the Underking walks again - ${'W'.repeat(120)}.`));
    nb.addNoteTokens([{ formatting: 'question', text: 'Where is the Mages Guild?' }, { formatting: 'answer', text: 'Down the road, past the fountain, and mind the guards.' }]);
    const wide = 'W'.repeat(NAME_MAX);
    const readers = [{ id: 'p1', name: wide }, { id: 'p2', name: `${'M'.repeat(NAME_MAX - 2)}ii` }, { id: 'p3', name: 'Ann' }, { id: 'p4', name: 'Lysandus Tell' }, { id: 'p5', name: wide }, { id: 'p6', name: 'Bran' }];
    const host = document.createElement('div');
    host.id = 'probe-chronicle';
    host.style.cssText = 'position:fixed; inset:0; z-index:9;';
    document.body.append(host);
    window.__jr = { host, said: [] };
    m.mountEnhancedChronicle(host, {
      notebook: () => nb, section: 'notes', entity: { name: 'Janome' },
      pageShare: () => ({ readers, why: null, show: (id) => { window.__jr.said.push(id); return pageShownText(readers.find((r) => r.id === id)?.name); }, letter: () => true }),
      onExit: () => { window.__jr.exited = true; },
    });
    host.querySelector('.cr-share').click();
    [...host.querySelectorAll('.cr-sharebox .act')][0].click();   // the widest name, pressed: what it said stands under the strip
  });
  const cr = await page.evaluate((SPILLS) => {
    const spills = eval(SPILLS);
    const host = window.__jr.host;
    const box = host.querySelector('.cr-sharebox');
    const card = box.closest('.cr-entry');
    const detail = host.querySelector('.px-qdetail');
    const btns = [...box.querySelectorAll('.act'), ...host.querySelectorAll('.cr-share')].map((b) => Math.round(b.getBoundingClientRect().height));
    return {
      strip: !!box, readers: box.querySelectorAll('.act').length,
      inCard: spills(box, '.cr-sharerow, .act, .cr-shareword, .cr-sharewhy, .cr-sharelabel', card),
      boxInCard: spills(card, '.cr-sharebox', card),
      detailScrollsX: detail.scrollWidth > detail.clientWidth + 1,
      word: box.querySelector('.cr-shareword')?.textContent ?? '',
      minButton: Math.min(...btns),
    };
  }, SPILLS);
  check(`${label}: the Share strip stands under its note with every reader and the letter`, cr.strip && cr.readers === 7, `${cr.readers} buttons`);
  check(`${label}: the widest names stay inside the note's card - nothing spills, nothing scrolls sideways`, !cr.inCard.length && !cr.boxInCard.length && !cr.detailScrollsX, [...cr.inCard, ...cr.boxInCard].slice(0, 3).join('; '));
  check(`${label}: what the press did is said under it`, cr.word.startsWith('You hold out the page to W'), cr.word.slice(0, 40));
  if (touch) check(`${label}: every Share button a finger's (44px)`, cr.minButton >= 44, `smallest ${cr.minButton}`);
  await page.screenshot({ path: `${OUT}/journal-share-${label}.png` });

  // ── THE READER'S WINDOW ────────────────────────────────────────────────────────────────────────────────────────
  await page.evaluate(async () => {
    const { createPageWindow, pageView } = await import('/src/ui/pageWindow.js');
    const { PAGE_HEAD_MAX, PAGE_LINE_MAX, PAGE_LINES_MAX, NAME_MAX } = await import('/src/net/wire.js');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:repeating-linear-gradient(45deg,#2a2721 0 14px,#231f1a 14px 28px);height:100vh';
    (await import('/src/ui/enhancedStyle.js')).injectEnhancedStyle();
    const lines = Array.from({ length: PAGE_LINES_MAX }, (_, i) => (i === 0 ? 'W'.repeat(PAGE_LINE_MAX) : i % 7 === 0 ? '' : `Line ${i} of the widest page the law takes - eighty units at the most.`.slice(0, PAGE_LINE_MAX)));
    const widest = { head: `${'Middas, 22nd of Morning Star, 3E 405 in '.padEnd(PAGE_HEAD_MAX - 1, 'W')}:`, lines };
    const w = createPageWindow({ onKeep: () => true });
    w.show('peer-w', pageView({ name: 'W'.repeat(NAME_MAX), page: widest }));
    window.__pw = w;
  });
  const measureWin = () => page.evaluate((SPILLS) => {
    const spills = eval(SPILLS);
    const card = document.querySelector('.dfpage-card');
    const leaf = card.querySelector('.dfpage-leaf');
    const r = card.getBoundingClientRect();
    const btns = [...card.querySelectorAll('.dfpage-btn')].map((b) => b.getBoundingClientRect());
    return {
      inScreen: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5,
      spills: spills(card, '.dfpage-title, .dfpage-when, .dfpage-leaf, .dfpage-line, .dfpage-btn, .dfpage-note', card),
      leafScrolls: leaf.scrollHeight > leaf.clientHeight + 1,
      buttonsOnScreen: btns.every((q) => q.top >= 0 && q.bottom <= innerHeight + 0.5 && q.bottom <= r.bottom + 0.5),
      minButton: Math.min(...btns.map((q) => Math.round(q.height))),
      labels: [...card.querySelectorAll('.dfpage-btn')].map((b) => b.textContent),
    };
  }, SPILLS);
  let pw = await measureWin();
  check(`${label}: the widest page stands inside the screen`, pw.inScreen);
  check(`${label}: the widest page - the head, a word of ${80} unbroken, every line - breaks inside the card`, !pw.spills.length, pw.spills.slice(0, 3).join('; '));
  check(`${label}: the page scrolls inside the card, and Keep and Put it away stand at its foot on screen`, pw.leafScrolls && pw.buttonsOnScreen, JSON.stringify({ scrolls: pw.leafScrolls, on: pw.buttonsOnScreen }));
  if (touch) check(`${label}: the window's buttons a finger's (44px)`, pw.minButton >= 44, `smallest ${pw.minButton}`);
  await page.screenshot({ path: `${OUT}/journal-page-${label}.png` });
  await page.evaluate(() => document.querySelector('.dfpage-btn').click());
  pw = await measureWin();
  check(`${label}: kept - the button says so and the note stands inside the card`, pw.labels[0] === 'Kept in your journal' && !pw.spills.length && pw.buttonsOnScreen, pw.labels.join(' | '));
  await page.screenshot({ path: `${OUT}/journal-page-kept-${label}.png` });

  // ── THE LETTERS TAB: KEEP IN MY JOURNAL ────────────────────────────────────────────────────────────────────────
  await page.evaluate(async (touch) => {
    const { createSocialPanel } = await import('/src/ui/socialPanel.js');
    const { SocialState } = await import('/src/net/social.js');
    const { MailBox } = await import('/src/net/mail.js');
    const { HANDLE_MAX_LEN } = await import('/src/net/accountClient.js');
    const { LETTER_SUBJECT_MAX } = await import('/src/net/letterLaw.js');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:repeating-linear-gradient(45deg,#2a2721 0 14px,#231f1a 14px 28px);height:100vh';
    (await import('/src/ui/enhancedStyle.js')).injectEnhancedStyle();
    const now = Math.floor(Date.now() / 1000);
    const head = { id: 'letter000000000000001', from: 'W'.repeat(HANDLE_MAX_LEN), title: null, glyphs: [], subject: 'W'.repeat(LETTER_SUBJECT_MAX), sentAt: now, read: false };
    const answer = (data) => ({ ok: true, status: 200, json: async () => data });
    const fetch = async (url) => {
      const path = new URL(url).pathname;
      if (path === '/v1/mail/inbox') return answer({ letters: [head], unread: 1, max: 50 });
      if (path === '/v1/mail/read') return answer({ letter: { ...head, body: 'The terms, as agreed.\n\nTwenty gold at the Relic.', readAt: now, read: true } });
      return answer({ ok: true });
    };
    const box = new MailBox({ ioOf: () => ({ fetch, base: 'https://svc', secret: 's'.repeat(43) }) });
    const social = new SocialState({ acct: 'acct-me' });
    social.apply({ t: 'social', k: 'state', acct: 'acct-me', name: 'Me', peers: [], in: [], out: [], party: null, invites: [], friends: [] });
    const panel = createSocialPanel({ social, mail: box, keepLetter: () => true, touch, canOpen: () => true, overlay: () => false });
    window.__lp = panel;
    panel.openLetters();
  }, touch);
  const lettersFrame = async () => { await page.evaluate(async () => { for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r, 30)); window.__lp.render(); } }); };
  await lettersFrame(); await lettersFrame();
  await page.evaluate(() => document.querySelector('.dfsocial-letter').click());
  await lettersFrame(); await lettersFrame();
  const measureLetter = () => page.evaluate((SPILLS) => {
    const spills = eval(SPILLS);
    const body = document.querySelector('.dfsocial-body');
    const btns = [...body.querySelectorAll('.dfsocial-btn')];
    return {
      spills: spills(body, '.dfsocial-btn, .dfsocial-acts, .dfsocial-empty, .dfsocial-subject, .dfsocial-lettertext', body),
      labels: btns.map((b) => b.textContent),
      minButton: Math.min(...btns.map((b) => Math.round(b.getBoundingClientRect().height))),
    };
  }, SPILLS);
  let lt = await measureLetter();
  check(`${label}: a letter read - Reply, Keep in my journal and Delete stand inside the panel`, lt.labels.includes('Keep in my journal') && !lt.spills.length, lt.spills.slice(0, 3).join('; ') || lt.labels.join(' | '));
  if (touch) check(`${label}: every letter button a finger's (44px)`, lt.minButton >= 44, `smallest ${lt.minButton}`);
  await page.evaluate(() => [...document.querySelectorAll('.dfsocial-btn')].find((b) => b.textContent === 'Keep in my journal').click());
  await lettersFrame();
  lt = await measureLetter();
  check(`${label}: kept - the button says so, the note under the letter stands inside the panel`, lt.labels.some((l) => l.startsWith('Kept in your journal')) && !lt.spills.length, lt.labels.join(' | '));
  await page.screenshot({ path: `${OUT}/journal-letter-${label}.png` });

  // ── THE F-MENU'S ROW ───────────────────────────────────────────────────────────────────────────────────────────
  await page.evaluate(async () => {
    const { createSocialMenu } = await import('/src/ui/socialMenu.js');
    const { NAME_MAX } = await import('/src/net/wire.js');
    document.body.innerHTML = '';
    (await import('/src/ui/enhancedStyle.js')).injectEnhancedStyle();
    const menu = createSocialMenu({});
    menu.show({ name: 'W'.repeat(NAME_MAX), peerId: 'peer-w', actions: { canInspect: true, canReadPage: true, canFriend: true, canInvite: false, whyNotInvite: 'their party is full' } });
  });
  const fm = await page.evaluate((SPILLS) => {
    const spills = eval(SPILLS);
    const root = document.querySelector('.dfpeer');
    const rows = [...root.querySelectorAll('button')];
    return { labels: rows.map((b) => b.textContent), spills: spills(root, 'button', null) };
  }, SPILLS);
  check(`${label}: the F-menu reads "Read their page" after Inspect, on a player at the name's bound, inside the screen`, fm.labels[1]?.startsWith('Read their page') && !fm.spills.length, fm.spills.slice(0, 3).join('; ') || fm.labels.join(' | '));
  await page.screenshot({ path: `${OUT}/journal-menu-${label}.png` });
  await page.close();
}

check('no page error', !pageErrors.length, pageErrors.slice(0, 3).join(' | '));
await browser.close();
await server.close();
console.log(`${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
