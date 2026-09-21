// MAC-J IN A REAL BROWSER: a roster name is a row, not a button.
//
// The defect was a CASCADE - the chat's own sheet and the enhanced skin's
// sheet in one document, with `.act` meaning two different things - so it
// cannot be seen in either file alone, and a node test can only read the two
// texts. This mounts the panel with BOTH sheets loaded, the way an online
// game has them, and measures the rows.
//
//     npx vite --port 5199 &
//     node tools/macjRosterProbe.mjs
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const shots = process.env.PROBE_SHOTS ?? '/tmp';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}/play/`, { waitUntil: 'networkidle' });
await page.waitForSelector('.px-menu button', { timeout: 15000 });

const out = await page.evaluate(async () => {
  const { ChatLog } = await import('/src/net/chat.js');
  const { createChatPanel } = await import('/src/ui/chatPanel.js');
  const { injectEnhancedStyle } = await import('/src/ui/enhancedStyle.js');
  injectEnhancedStyle();   // the skin online forces (OL1) - the other half of the collision
  const session = {
    id: 'me-0001', name: 'Janome', roomCount: 5,
    peers: new Map([
      ['p1', { id: 'p1', name: 'Aurelia' }],
      ['p2', { id: 'p2', name: 'Bromm the Elder' }],
      ['p3', { id: 'p3', name: 'Cyrus' }],
    ]),
  };
  const panel = createChatPanel({
    log: new ChatLog(), onSend: () => {}, roster: () => session,
    rowActions: (id) => (id === 'me-0001' ? [] : [{ id: 'friend', label: 'Add friend' }]),
    social: { onToggle: () => {} }, touch: false,
  });
  panel.open();   // the panel appends itself to the document at create (chatPanel.js: doc.body.append(root))
  const root = document.querySelector('.dfchat');
  root.style.zIndex = '99999';
  document.querySelectorAll('.px-home, .px-menu').forEach((n) => { n.style.display = 'none'; });
  const rows = [...document.querySelectorAll('.dfchat-who-row')].map((r) => ({
    text: r.textContent, h: Math.round(r.getBoundingClientRect().height),
    door: r.classList.contains('dfchat-act'), me: r.classList.contains('me'),
    border: getComputedStyle(r).borderTopWidth,
  }));
  // WHAT THE NAMES OCCUPY, first row's top to last row's bottom. Neither the
  // column nor the list can be measured for this: both are sized by the box
  // (.dfchat-list is a fixed 220px and the list stretches to it), so their
  // heights are the same before the fix and after it.
  const boxes = [...document.querySelectorAll('.dfchat-who-row')].map((r) => r.getBoundingClientRect());
  return { rows, span: Math.round(boxes.at(-1).bottom - boxes[0].top) };
});

const doors = out.rows.filter((r) => r.door);
const mine = out.rows.find((r) => r.me);
check('MAC-J: every name is a door but my own', doors.length === 3 && !!mine, `${doors.length} doors`);
check('MAC-J: a door is the SAME height as a name that is not one', doors.every((r) => r.h === mine.h), out.rows.map((r) => `${r.text}:${r.h}`).join(' '));
check('MAC-J: and it is a line of text, not a control', doors.every((r) => r.h <= 20), `tallest ${Math.max(...doors.map((r) => r.h))}px`);
check('MAC-J: no border anywhere in the column', out.rows.every((r) => r.border === '0px'), out.rows[0]?.border);
check('MAC-J: four names occupy four lines, not four buttons', out.span <= 90, `${out.span}px for four names (a 46px button each would be 190+)`);
check('no page errors', errors.length === 0, errors.join(' | '));

await page.screenshot({ path: `${shots}/macj-roster.png` });
await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} ok`);
process.exit(bad.length ? 1 : 0);
