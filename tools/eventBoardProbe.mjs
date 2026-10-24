// EVENTS1 (2026-10-23), MEASURED: the event board and its news (ui/eventBoard.js) drawn in Chromium over the real HUD -
// the enhanced HUD through its own entry (drawEnhancedHud: the vitals, the hotbar, the quick slots and six buffs in the
// status widget), a live chat panel (createChatPanel over a ChatLog) - its peek full, widened by the player, or open -
// the quest card and the party list in their sheets' classes - on Enhanced Plus and the classic skin, at a desk's sizes,
// a short desk's, a narrow window's and a phone's both ways, and at the HUD's scale 1.5. AUDIT EVENTS1 B1-B5: the board
// measures its place under whatever stands above its edge and its room down to whatever stands below it, and fits a row
// fewer until it fits - so wherever it stands nothing of it may cover the chat, the quick slots, the buffs, the vitals,
// the hotbar, the compass, the quest card or the party list, and all of it stands inside the screen; where not even its
// news fits it stands down and its news is said on the HUD's line. The suite holds the board's law and its DOM on a fake
// document (test/systems/events1_board.test.js, test/ui/events1_board_ui.test.js); this photographs what a fake cannot.
// Photographs to SHOT_DIR (default tools/shots/).
//
//     node tools/eventBoardProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const PORT = Number(process.env.PROBE_PORT ?? 5269);
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'silent' });
await server.listen();
const exe = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
const errors = [];
/** [width, height, name, touch, the HUD's scale, the chat: its peek, widened, or open, the buffs listed] - a desk must
 *  show the board; six buffs on a 720-pixel screen leave it no room (its news then on the HUD's line) */
const CASES = [
  [1920, 1080, 'desk-hd', false, 1, 'peek', 6], [1280, 720, 'desk', false, 1, 'peek', 2], [1280, 720, 'desk-buffs6', false, 1, 'peek', 6],
  [1280, 600, 'desk-short', false, 1, 'peek', 2], [1024, 700, 'narrow', false, 1, 'peek', 2], [1024, 560, 'narrow-short', false, 1, 'peek', 2],
  [1280, 720, 'desk-scale15', false, 1.5, 'peek', 2], [1280, 720, 'desk-chat-wide', false, 1, 'wide', 2], [1280, 720, 'desk-chat-open', false, 1, 'open', 2],
  [844, 390, 'phone-land', true, 1, 'peek', 2], [390, 844, 'phone', true, 1, 'peek', 2],
];
const DESKS = new Set(['desk-hd', 'desk']);
/** The chat as it stands: its panel open, else its peek. */
const chatShown = (r) => (r.chat && r.chat.h > 0 && r.chatOpen ? r.chat : r.peek);
const over = (a, b) => !!(a && b && a.w > 0 && b.w > 0 && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5);

for (const skin of ['plus', 'classic']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(`${skin}: ${e.message}`));
  for (let tries = 0; tries < 4; tries++) {
    try {
      await page.goto(`http://localhost:${PORT}/play/?skin=${skin === 'plus' ? 'enhanced' : 'classic'}&touch=off&nofonts`);
      await page.waitForTimeout(tries ? 4000 : 1500);
      break;
    } catch (e) { console.log('retry', skin, String(e.message).slice(0, 80)); }
  }
  for (const [W, H, size, touch, scale, chatMode, buffs] of CASES) {
    const tag = `${size}-${skin}`;
    await page.setViewportSize({ width: W, height: H });
    const r = await page.evaluate(async ([skin, touch, scale, chatMode, buffs]) => {
      history.replaceState(null, '', `${location.pathname}${location.search.replace(/touch=(on|off)/, `touch=${touch ? 'on' : 'off'}`)}`);
      const { drawEnhancedHud } = await import('/src/ui/enhanced/enhancedHud.js');
      const { ChatLog } = await import('/src/net/chat.js');
      const { createChatPanel } = await import('/src/ui/chatPanel.js');
      const { drawEventBoard, destroyEventBoard } = await import('/src/ui/eventBoard.js');
      const { seatEventBoard, eventNotice, _resetEventNotices } = await import('/src/systems/eventNotices.js');
      const { gateAt } = await import('/src/net/gate/gateLaw.js');
      const { injectPartyStyle } = await import('/src/ui/partyPanel.js');
      const { setPref } = await import('/src/systems/uiPrefs.js');
      const { registerPresenter } = await import('/src/systems/notify.js');
      setPref('hudScale', scale);
      setPref('chatWidth', chatMode === 'wide' ? 560 : null); setPref('chatListHeight', chatMode === 'wide' ? 320 : null);
      const hudLine = [];
      registerPresenter({ hudText: (t) => { hudLine.push(t); return true; } });
      if (skin === 'plus') (await import('/src/ui/enhanced/enhancedStyle.js')).injectEnhancedStyle(document);
      destroyEventBoard(); _resetEventNotices();
      // the HUD's root is the enhanced HUD's own, built once and kept (its module holds it); every other node goes
      for (const n of [...document.body.children]) if (n.tagName !== 'SCRIPT' && !n.classList.contains('hud') && !n.classList.contains('hb-dock')) n.remove();
      document.body.style.cssText = 'margin:0;background:repeating-linear-gradient(45deg,#3a4a3a 0 14px,#324032 14px 28px);height:100vh';
      const el = (cls, text = '', tag = 'div') => { const n = document.createElement(tag); n.className = cls; if (text) n.textContent = text; return n; };
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      // the HUD, through its own entry - its buffs in its status widget
      const fx = [];
      for (let i = 0; i < buffs; i++) fx.push({ bundleId: 100 + i, bundleName: ['Shield', 'Levitate', 'Light', 'Resist Fire', 'Water Breathing', 'Feather'][i], kind: 'shield', bundleSelfCast: true, roundsRemaining: 30, bundleIcon: i });
      const e = { name: 'Aelwyn', isPlayer: true, chargenDone: true, career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48, willpower: 50, intelligence: 50 },
        health: 30, maxHealth: 40, fatigue: 150, maxFatigue: 200, magicka: 14, maxMagicka: 20, items: [], wagonItems: [], bagItems: [], spells: [], activeEffects: fx };
      if (skin === 'plus') for (let i = 0; i < 3; i++) { drawEnhancedHud(e, 0.25, 0.016, {}); await wait(30); }
      const hudUp = !!document.querySelector('.hud .hud-bars');
      // the chat, its peek full
      const log = new ChatLog();
      const chat = createChatPanel({ log, onSend: () => true, overlay: () => false, touch });
      for (let i = 0; i < 12; i++) log.push('world', { id: `pabcdefgh00${i % 3}`, name: ['Bran', 'Ysolde', 'Corwin'][i % 3], text: `line ${i} - a sentence long enough to come near the edge of the box`, at: Date.now() });
      chat.render({});
      if (chatMode === 'open') { chat.open(); chat.render({}); }
      // the quest card and the party list, in their sheets' classes
      if (skin === 'plus') {
        const q = el(touch ? 'qtrack touch' : 'qtrack');
        const head = el('qtrack-head'); head.append(el('qtrack-mark', '◆', 'span'), el('qtrack-title', 'The Thirteenth of Frostfall', 'span'));
        q.append(head, el('qtrack-line', 'Morwen of Glenmoril waits at the coven’s fire'), el('qtrack-where', 'Glenmoril Coven'), el('qtrack-time', '3 days left'));
        document.body.append(q);
      }
      injectPartyStyle(document);
      const party = el(touch ? 'dfparty touch' : 'dfparty');
      party.append(el('dfparty-title', 'Party'), el('', 'Ysolde'), el('', 'Corwin'), el('', 'Bran'));
      document.body.append(party);
      // the board: the gate open, a star standing, a raid under way in the region, one coming - and two lines, each its
      // event's (the star's by its id)
      const now = gateAt(Date.now()).openAt + 60_000;
      const src = {
        now, pixel: { x: 200, y: 200 }, region: 'Daggerfall',
        gate: { place: 'Copperham, Daggerfall', site: { px: 207, py: 191, day: 0 } },
        stars: [{ id: 'star:1.0', kind: 'star', title: 'Fallen Star', where: 'Near Gothway Garden', detail: 'The coven takes it when this runs out', live: true, at: now + 640_000, until: now + 640_000, px: 188, py: 214 }],
        raids: [
          { name: 'Ilessan Hills', region: 'Daggerfall', type: 'orcs', startMs: now - 120_000, endMs: now + 480_000, px: 196, py: 204, key: '17:7:400', n: 7, tg: 18 },
          { name: 'Wayrest', region: 'Wayrest', type: 'bandits', startMs: now + 300_000, endMs: now + 900_000, px: 260, py: 150, key: '18:3:400' },
        ],
      };
      seatEventBoard(() => src);
      drawEventBoard({ dt: 0.016, nowMs: Date.now() });
      eventNotice('star', 'A star has fallen near Gothway Garden.', 'star:1.0');
      eventNotice('raid', 'Ilessan Hills in Daggerfall is under attack by orcs!', 'raid:17:7:400');
      for (let i = 0; i < 4; i++) { drawEventBoard({ dt: 0.016, nowMs: Date.now() + 600 * (i + 1) }); await wait(80); }
      await wait(400);
      const box = (n) => { if (!n) return null; const b = n.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
      const q1 = (s) => box(document.querySelector(s));
      return {
        board: q1('.evboard'), news: [...document.querySelectorAll('.evnews')].map(box), hud: q1('.evhud'),
        newsText: document.querySelector('.evnews')?.textContent ?? '',
        peek: q1('.dfchat-peek'), chat: q1('.dfchat'), hudLine, onPage: !!document.querySelector('.evhud'), chatOpen: chatMode === 'open', quick: q1('.hud .hud-quick'), stat: q1('.hud .hud-stat'), bars: q1('.hud .hud-bars'), hotbar: q1('.hud .hb'),
        compass: q1('.hud .hud-compass'), quest: q1('.qtrack'), party: q1('.dfparty:not(.probe-skip)'), temp: q1('.hud .hud-temp'),
        rows: document.querySelectorAll('.evrow').length, vw: innerWidth, vh: innerHeight, hudUp,
      };
    }, [skin, touch, scale, chatMode, buffs]);
    await page.screenshot({ path: `${OUT}/events1-${tag}.png` });
    if (process.env.PROBE_BOXES) console.log(tag, JSON.stringify({ peek: r.peek, quick: r.quick, stat: r.stat, temp: r.temp, bars: r.bars, hotbar: r.hotbar, board: r.board, quest: r.quest, party: r.party }, (k, v) => (typeof v === 'number' ? Math.round(v) : v)));
    if (skin === 'plus') check(`${tag}: the enhanced HUD stands to be measured against`, r.hudUp && !!r.quick && !!r.bars);
    const b = r.onPage ? r.board : null;
    // a desk shows the board and its news (its rows give way to the news for its seconds where both do not fit: "N more")
    if (DESKS.has(size)) check(`${tag}: a desk shows the board and its news`, !!b && b.h > 0 && r.news.length === 1, `${r.rows} rows under it`);
    if (!b) {
      // no room even for its news: it stands down, and its news is said on the HUD's line
      check(`${tag}: no room - the board stands down and its news goes to the HUD's line`, r.hudLine.some((t) => t.includes('Gothway Garden')), r.hudLine.join(' | ').slice(0, 160));
      continue;
    }
    // its news at its head with its star's place and way - or, where the news alone is taller than its room, said on the
    // HUD's line and the rows that fit standing
    const headed = r.news.length === 1 && /\d+ km SW \u00b7 Near Gothway Garden/.test(r.newsText);
    check(`${tag}: its news at its head, or said on the HUD's line`, headed || (!r.news.length && r.hudLine.some((t) => t.includes('Gothway Garden'))), `${headed ? 'at its head' : 'on the HUD\'s line'}, ${r.rows} rows`);
    check(`${tag}: the board inside the screen`, b.l >= 0 && b.t >= 0 && b.r <= r.vw + 0.5 && b.b <= r.vh + 0.5, `${Math.round(b.l)},${Math.round(b.t)} - ${Math.round(b.r)},${Math.round(b.b)}`);
    for (const [other, ob] of [['chat', chatShown(r)], ['quick slots', r.quick], ['buffs', r.stat], ['vitals', r.bars], ['hotbar', r.hotbar], ['compass', r.compass], ['quest card', r.quest], ['party', r.party], ['temperature', r.temp]]) {
      if (ob) check(`${tag}: the board clear of the ${other}`, !over(b, ob), over(b, ob) ? `${JSON.stringify(b)} x ${JSON.stringify(ob)}` : '');
    }
  }
  await page.close();
}
check('no page errors', !errors.length, errors.join(' | '));
await browser.close();
await server.close();
console.log(fails ? `${fails} FAILED` : 'all clear');
process.exit(fails ? 1 : 0);
