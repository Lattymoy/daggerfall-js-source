// LOOT-STACK, MEASURED (2026-09-23, Janome: "a toggle key to switch between the inventories of enemies stacked on top
// of each other").
//
// test/lootstack.test.js holds the law on fakes; this draws the REAL plaque through the real seam the four hosts call
// (ui/worldPlaque.js worldHoverFrame) over the real sheet in Chromium, with three bodies in one pile under the reticle,
// and reads back what a fake cannot: the pile's mark - "1 of 3 · ] for the next" - drawn as ONE line inside the plaque's
// box beside the body's own name and its list, at a desktop's width and a narrow window's (the sheet shrinks the
// plaque under 720px); the turn landing on the next frame with the next body's name and list; and a long body name
// with the mark under it. It found two defects in the plaque it draws on, both older than the pile: the divider stood
// at the TITLE's foot, so every sub-line of a plaque with a list (a chest's lock level, the pile's mark) drew under it
// as the list's first row; and the list's cap clipped ACROSS as well as down, cutting quick loot's highlight band off
// at the list's edges and the first letter of the lit name with it (and on the narrow sheet the band's fixed margin ran
// 2px into the border). So it also measures the lit row: its band edge to edge, its name whole and standing where the
// unlit names stand; and the cap, still clipping downward. Photographs to tools/shots/ (or SHOT_DIR).
//
//     node tools/lootStackProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const server = await createServer({ server: { port: 5236, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const pageErrors = [];

for (const [W, H] of [[1440, 900], [480, 800]]) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  await page.goto('http://localhost:5236/play/?skin=enhanced&touch=off');
  const r = await page.evaluate(async ({ W, H }) => {
    const { worldHoverFrame, destroyWorldPlaque } = await import('/src/ui/worldPlaque.js');
    const { armBodyTurn } = await import('/src/player/lootStack.js');
    const { RAY_DISTANCE, CORPSE_ACTIVATION_DISTANCE } = await import('/src/player/activate.js');
    const { setBindings } = await import('/src/ui/input.js');
    const { createBindings, resetDefaults } = await import('/src/systems/inputActions.js');
    const { midScreenText } = await import('/src/ui/midScreenText.js');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:repeating-linear-gradient(45deg,#2a2721 0 14px,#231f1a 14px 28px);height:100vh';
    const store = createBindings(); resetDefaults(store); setBindings(store);
    destroyWorldPlaque();
    const body = (key, z) => ({ key, aabb: { min: [-0.5, -0.3, z], max: [0.5, 0.3, z + 1] }, distance: RAY_DISTANCE, reach: CORPSE_ACTIVATION_DISTANCE, body: true });
    const names = { 'foeCorpse:a': 'Dead Orc', 'foeCorpse:b': 'Dead Rat', 'foeCorpse:c': 'Dead Daedra Seducer' };
    const lists = {
      'foeCorpse:a': [{ name: 'Rusty Dagger', group: 'Weapons', templateIndex: 121, material: 0, maxCondition: 200, currentCondition: 40 }],
      'foeCorpse:b': [],
      'foeCorpse:c': [{ name: 'Gold Pieces', group: 'Currency', templateIndex: 0, stackCount: 212, maxCondition: 1, currentCondition: 1 }, { name: 'Ebony Longsword', group: 'Weapons', templateIndex: 115, material: 0x0206, maxCondition: 1000, currentCondition: 1000 }],
    };
    const canvas = { width: W, height: H, clientWidth: W };
    const frame = () => worldHoverFrame({
      eye: [0, 0, 0], dir: [0, 0, 1], collider: { raycast: () => Infinity }, canvas,
      targets: () => [body('foeCorpse:c', 1.4), body('foeCorpse:a', 1), body('foeCorpse:b', 1.2)],
      name: (k) => (names[k] ? { title: names[k] } : null), contents: (k) => lists[k] ?? null,
    });
    const read = () => {
      const n = document.querySelector('.wplaque');
      if (!n) return null;
      const box = n.getBoundingClientRect();
      const subs = [...n.querySelectorAll('.wplaque-sub')].map((s) => {
        const range = document.createRange(); range.selectNodeContents(s);
        const lines = new Set([...range.getClientRects()].map((q) => Math.round(q.top))).size;
        const q = s.getBoundingClientRect();
        return { text: s.textContent, lines, inside: q.left >= box.left - 0.5 && q.right <= box.right + 0.5 && q.top >= box.top - 0.5 && q.bottom <= box.bottom + 0.5 };
      });
      // the lit row (quick loot's highlight): its band should reach the plaque's inner edges and its name be whole -
      // the list clips what overflows it, so a band that reached past the list lost its ends and its name's first
      // letter with them
      const sel = n.querySelector('.wplaque-row.sel');
      let lit = null;
      if (sel) {
        const cs = getComputedStyle(n);
        const innerL = box.left + parseFloat(cs.borderLeftWidth), innerR = box.right - parseFloat(cs.borderRightWidth);
        const list = n.querySelector('.wplaque-list').getBoundingClientRect();
        const band = sel.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(sel.firstChild);
        const text = range.getBoundingClientRect();
        const clipL = getComputedStyle(n.querySelector('.wplaque-list')).overflowX === 'visible' ? innerL : Math.max(innerL, list.left);
        // ...and the lit name stands where every other name stands - the band moves no name
        const other = n.querySelector('.wplaque-row:not(.sel):not(.wplaque-empty):not(.wplaque-more)');
        let shift = null;
        if (other) { const r2 = document.createRange(); r2.selectNodeContents(other.firstChild); shift = Math.round((text.left - r2.getBoundingClientRect().left) * 10) / 10; }
        lit = { bandL: Math.round(band.left - innerL), bandR: Math.round(innerR - band.right), textClipped: text.left < clipL - 0.5, overflowX: getComputedStyle(n.querySelector('.wplaque-list')).overflowX, shift };
      }
      return { on: n.classList.contains('on'), title: n.querySelector('.wplaque-title')?.textContent, subs, rows: n.querySelectorAll('.wplaque-row').length, w: Math.round(box.width), lit };
    };
    await document.fonts.ready;
    const out = { first: null, turned: null, back: null, said: null };
    frame(); out.first = read();
    armBodyTurn(); frame(); out.turned = read(); out.said = midScreenText.text;
    armBodyTurn(); frame(); out.long = read();
    armBodyTurn(); frame(); out.back = read();
    return out;
  }, { W, H });
  await page.screenshot({ path: `${OUT}/lootstack_${W}.png` });
  const tag = `${W}px`;
  check(`${tag}: the front body named, with its pile's mark under it`, r.first?.on && r.first.title === 'Dead Orc' && r.first.subs[0]?.text === '1 of 3 · ] for the next', JSON.stringify(r.first));
  check(`${tag}: ...the mark ONE line, inside the plaque`, r.first?.subs[0]?.lines === 1 && r.first.subs[0].inside, JSON.stringify(r.first?.subs));
  check(`${tag}: a turn lands the next frame - the next body's name, its list, "2 of 3"`, r.turned?.title === 'Dead Rat' && r.turned.subs[0]?.text.startsWith('2 of 3'), JSON.stringify(r.turned));
  check(`${tag}: ...and speaks DFU's mid-screen line`, r.said === 'Body 2 of 3.', r.said);
  check(`${tag}: a long body name and a list of two, the mark still one line inside the box`, r.long?.title === 'Dead Daedra Seducer' && r.long.subs[0]?.text.startsWith('3 of 3') && r.long.subs[0].lines === 1 && r.long.subs[0].inside, JSON.stringify(r.long));
  check(`${tag}: quick loot's lit row - its band edge to edge inside the plaque, its name whole`, r.first?.lit && Math.abs(r.first.lit.bandL) <= 0.5 && Math.abs(r.first.lit.bandR) <= 0.5 && !r.first.lit.textClipped, JSON.stringify(r.first?.lit));
  check(`${tag}: ...and with a list of two, the lit name stands where the unlit one does`, r.long?.lit && r.long.lit.shift === 0 && !r.long.lit.textClipped && Math.abs(r.long.lit.bandL) <= 0.5 && Math.abs(r.long.lit.bandR) <= 0.5, JSON.stringify(r.long?.lit));
  check(`${tag}: the back of the pile turns to its front`, r.back?.title === 'Dead Orc' && r.back.subs[0]?.text.startsWith('1 of 3'), JSON.stringify(r.back));
  await page.close();
}
// THE CAP STILL CLIPS DOWNWARD: a six-row pile at a short window - the list stops at its cap (the room below the
// cross, R7) with its rows clipped under it, while the band across it stays whole
{
  const page = await browser.newPage({ viewport: { width: 1024, height: 360 } });
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  await page.goto('http://localhost:5236/play/?skin=enhanced&touch=off');
  const cap = await page.evaluate(async () => {
    const { worldHoverFrame, destroyWorldPlaque } = await import('/src/ui/worldPlaque.js');
    const { RAY_DISTANCE, CORPSE_ACTIVATION_DISTANCE } = await import('/src/player/activate.js');
    document.body.innerHTML = '';
    destroyWorldPlaque();
    const item = (name) => ({ name, group: 'Weapons', templateIndex: 121, material: 0, maxCondition: 200, currentCondition: 200 });
    worldHoverFrame({
      eye: [0, 0, 0], dir: [0, 0, 1], collider: { raycast: () => Infinity }, canvas: { width: 1024, height: 360, clientWidth: 1024 },
      targets: () => [{ key: 'foeCorpse:z', aabb: { min: [-0.5, -0.3, 1], max: [0.5, 0.3, 2] }, distance: RAY_DISTANCE, reach: CORPSE_ACTIVATION_DISTANCE, body: true }],
      name: () => ({ title: 'Dead Knight' }), contents: () => ['Longsword', 'Shield', 'Helm', 'Cuirass', 'Greaves', 'Boots', 'Gauntlets', 'Ring'].map(item),
    });
    await document.fonts.ready;
    const list = document.querySelector('.wplaque-list');
    const cs = getComputedStyle(list);
    const capPx = parseFloat(cs.maxHeight);
    return { clipped: list.scrollHeight > list.clientHeight + 0.5, contentH: list.clientHeight - parseFloat(cs.paddingTop), capPx, overflowY: cs.overflowY };
  });
  check('a six-row pile at a 360px window: the list stops at its cap and clips the rows under it', cap.clipped && cap.contentH <= cap.capPx + 0.5 && cap.overflowY === 'clip', JSON.stringify(cap));
  await page.screenshot({ path: `${OUT}/lootstack_cap.png` });
  await page.close();
}
check('no page error', pageErrors.length === 0, pageErrors.join(' | '));
await browser.close();
await server.close();
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
