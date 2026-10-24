// AUDIT STAR U1 (2026-10-20), MEASURED: the Starfall's tracker (ui/starfall/starTracker.js), the quest card
// (ui/quest/questTracker.js's `.qtrack`), the party list (ui/partyPanel.js) and the master's bar (ui/gate/gateBossBar.js
// over ui/starfall/starBar.js) drawn over the real sheets in Chromium - Enhanced Plus and the classic skin's bare page - at a
// desk's widths, a narrow window's and a phone's both ways. In the right-upper column nothing may cover another: the plate
// stands under the quest card, the party list under the plate, the plate under the master's bar where they share the
// width, every one inside the screen; the phase alone is spoken and the light bar is named. test/systems/starfall/
// star6_words.test.js holds the column's law on a fake document; this photographs what a fake cannot. Photographs to
// SHOT_DIR (default tools/shots/).
//
//     node tools/starHudProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const PORT = Number(process.env.PROBE_PORT ?? 5267);
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const errors = [];
const SIZES = [[1920, 1080, 'desk-hd', false], [1280, 720, 'desk', false], [1024, 700, 'narrow', false], [844, 390, 'phone-land', true], [390, 844, 'phone', true]];
const over = (a, b) => !!(a && b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5);

for (const skin of ['plus', 'classic']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(`${skin}: ${e.message}`));
  // one page a skin: the game's own page boots once (Vite's first optimisation may reload it - try again)
  for (let tries = 0; tries < 4; tries++) {
    try {
      await page.goto(`http://localhost:${PORT}/play/?skin=${skin === 'plus' ? 'enhanced' : 'classic'}&touch=off&nofonts`);
      await page.waitForTimeout(tries ? 4000 : 1500);
      await page.evaluate(async (skin) => {
        if (skin === 'plus') (await import('/src/ui/enhanced/enhancedStyle.js')).injectEnhancedStyle(document);
        (await import('/src/ui/partyPanel.js')).injectPartyStyle(document);
      }, skin);
      break;
    } catch (e) { console.log('retry', skin, String(e.message).slice(0, 80)); }
  }
  for (const [W, H, size, touch] of SIZES) for (const quest of skin === 'plus' ? [true, false] : [false]) {
    const tag = `${size}-${skin}-${quest ? 'quest' : 'noquest'}`;
    await page.setViewportSize({ width: W, height: H });
    const r = await page.evaluate(async ([quest, touch]) => {
      history.replaceState(null, '', `${location.pathname}${location.search.replace(/touch=(on|off)/, `touch=${touch ? 'on' : 'off'}`)}`);
      const { drawStarTracker, destroyStarTracker } = await import('/src/ui/starfall/starTracker.js');
      const { starBarModel } = await import('/src/ui/starfall/starBar.js');
      const { drawGateBossBar, destroyGateBossBar } = await import('/src/ui/gate/gateBossBar.js');
      destroyStarTracker(); destroyGateBossBar();
      for (const n of [...document.body.children]) if (n.tagName !== 'SCRIPT') n.remove();
      document.documentElement.style.removeProperty('--dfquest-h');
      document.body.style.cssText = 'margin:0;background:repeating-linear-gradient(45deg,#3a4a3a 0 14px,#324032 14px 28px);height:100vh';
      const el = (cls, text = '', tag = 'div') => { const n = document.createElement(tag); n.className = cls; if (text) n.textContent = text; return n; };
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      if (quest) {
        const q = el(touch ? 'qtrack touch' : 'qtrack');
        const head = el('qtrack-head'); head.append(el('qtrack-mark', '◆', 'span'), el('qtrack-title', 'The Thirteenth of Frostfall', 'span'));
        q.append(head, el('qtrack-line', 'Morwen of Glenmoril waits at the coven’s fire for word of the'), el('qtrack-where', 'Glenmoril Coven'), el('qtrack-time', '3 days left'));
        document.body.append(q);
        await wait(30);
        document.documentElement.style.setProperty('--dfquest-h', `${Math.ceil(q.getBoundingClientRect().bottom) - (touch ? 76 : 92) + 8}px`);   // the card's own publish
      }
      const party = el(touch ? 'dfparty touch' : 'dfparty');
      for (const n of ['Ann', 'Bran', 'Cyrene', 'Dagny']) { const c = el('dfparty-card'); c.style.cssText = 'height:44px;flex:none;background:rgba(0,0,0,.55);border:1px solid #777;color:#ddd'; c.textContent = n; party.append(c); }
      document.body.append(party);
      const model = { title: 'Fallen Star', near: 'Near Gothway Garden', coven: 'The Daggerfall Witches', phase: 'Wave 2 of 4', light: 0.62, low: false, left: '13:42 left', heart: false, held: false };
      drawStarTracker(model, { doc: document });
      drawGateBossBar(starBarModel({ name: 'The Coven Mother', heart: false, hp: 500, max: 1000, circle: 2, her: true, defenders: 4, fellAt: null }, 0), { doc: document });
      await wait(150);
      drawStarTracker({ ...model, left: '13:41 left' }, { doc: document });
      await wait(60);
      const box = (sel) => { const n = document.querySelector(sel); if (!n) return null; const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return null; const b = n.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) }; };
      return { star: box('.star-hud'), quest: box('.qtrack'), party: box('.dfparty'), bar: box('.wb-boss-bar'), starH: document.documentElement.style.getPropertyValue('--dfstar-h'), touchCls: document.querySelector('.star-hud')?.classList.contains('touch'), live: [...document.querySelectorAll('[aria-live]')].map((n) => n.className), gauge: document.querySelector('.star-hud-gauge')?.textContent, vw: innerWidth, vh: innerHeight };
    }, [quest, touch]);
    check(`${tag} the plate shown, inside the screen`, !!r.star && r.star.l >= 0 && r.star.r <= r.vw && r.star.b <= r.vh && r.touchCls === touch, JSON.stringify(r.star));
    check(`${tag} clear of the quest card`, !over(r.star, r.quest), JSON.stringify(r.quest));
    check(`${tag} clear of the party list`, !over(r.star, r.party), `${JSON.stringify(r.party)} --dfstar-h ${r.starH}`);
    check(`${tag} clear of the master's bar`, !over(r.star, r.bar), JSON.stringify(r.bar));
    check(`${tag} the quest card clear of the master's bar`, !over(r.quest, r.bar), JSON.stringify(r.quest));
    check(`${tag} the phase alone spoken, the bar named`, JSON.stringify(r.live) === '["star-hud-phase"]' && r.gauge === 'Light', `${JSON.stringify(r.live)} ${r.gauge}`);
    await page.screenshot({ path: `${OUT}/star-hud-${tag}.png` });
  }
  await page.close();
}
await browser.close();
await server.close();
if (errors.length) { console.log(errors.slice(0, 10).join('\n')); }
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
