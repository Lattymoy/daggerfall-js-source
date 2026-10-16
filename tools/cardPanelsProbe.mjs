// CARDS-PLUS (2026-10-13, bible/11-Multiplayer/Tavern-Cards.md section 38): THE CARD TABLES' PANELS, SEEN. Opens the card
// table lab (cards.html - the tavern's table, its 3D cloth) headless, mounts the Hold'em panel (ui/card/cardTableHud.js) and
// Iliac Hand's (ui/iliacTableHud.js) through their REAL painters with their real models - Iliac Hand's setup (a friendly
// game), a turn with a card picked and one staged, a game's end; Hold'em's buy-in at a gold table, a hand at the flop
// with four chairs, a full table's river and its showdown - on the three looks a player can wear (Enhanced Plus, the
// classic skin, the DFO Grimoire dress) at a desktop, a short window, two upright phones and a phone on its side under
// a finger (AUDIT CARDS-PLUS C5), and reads what a fake document cannot:
//   - the FACE: the panel's words, its title and its presses in the game's pixel face (the dress's own under the
//     Grimoire dress) - CARDS4 and CARDS10 wrote Georgia, serif over them;
//   - the KIT: the window's carved frame (the kit's border-image) on Plus and on the classic skin, where the panel lays
//     its own cut of the kit;
//   - the FIT: the panel on the screen, nothing in it wider than it, no holding's lanes past its plate;
//   - NO BORROWED COMPONENT: a lane, a little card, the note carry none of the enhanced sheet's bare .row, .card and
//     .note (a lane took a menu row's 11px 18px padding and its underline);
//   - THE TILE FACE: the hand's cards painted at their CSS size - 80px tall, the painter's tile bound 140 (CARDS10 painted
//     160 and wore the full face's rules box at 4px);
//   - THE LOG scrolled to the newest standing on a whole line; THE FOLD on the screen to press, putting the table's
//     words away and back, the line and the presses still drawn;
//   - AUDIT CARDS-PLUS: every part a check reads COUNTED there (100 of the first 314 checks ran over nothing); each
//     STATE either panel marks (a target, who holds a holding, the power ahead, your seat, the one to act, the winner)
//     drawn apart from its rest in every look; NO CARD over another in a lane or the tray; the pot inside its board.
// KG4 (bible/11-Multiplayer/Kings-Gambit.md 14.9 and 17): THE THIRD PANEL - The King's Gambit's setup, army, battle and
// result on the same looks and sizes and under the same checks, the battle over the lab's King's Gambit table from the
// LEAN (cards.html `game=gambit&cam=lean`) - and the game's own: under a finger every press 44 px; the board's box on the
// screen clear of the panel (or the phone's strip); the cell's size on the screen (the MEASURE) beside the snap's radius.
//     node tools/cardPanelsProbe.mjs          (writes $PROBE_SHOTS or /tmp/cardpanels-*.png; PROBE_ONLY=gambit one game's scenes)
// The fonts: the probe's browser has no route to Google Fonts (the game's one request), so it lays the launcher's own
// copy of Pixelify Sans (app/launcher/fonts - the same file, pinned by its hash there) and opens the page with ?nofonts.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const shots = process.env.PROBE_SHOTS ?? '/tmp';
const PIX = readFileSync(new URL('../app/launcher/fonts/PixelifySans-latin.woff2', import.meta.url)).toString('base64');
const FONT_CSS = `@font-face { font-family: 'Pixelify Sans'; font-weight: 400 700; font-display: block; src: url(data:font/woff2;base64,${PIX}) format('woff2'); }`;
const server = await createServer({ server: { port: 5243, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://127.0.0.1:5243';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
let failed = 0, checks = 0;
const check = (ok, what) => { checks++; if (!ok) { failed++; console.log(`FAIL ${what}`); } };
const passed = () => checks - failed;
/** KG4: the cell's size on the screen at each battle's size and look - the MEASURE section 17 reports. */
const gambitCells = [];

/** Mount one scene's panel on the page, through the real painter and model. */
async function mount(page, scene) {
  await page.evaluate(async (scene) => {
    const { newGame, commit, reveal, iliacView } = await import('/src/net/iliac/iliacHand.js');
    const { STARTER_DECK } = await import('/src/net/iliac/iliacCards.js');
    const { patronPlays } = await import('/src/systems/iliac/iliacPatrons.js');
    const ih = await import('/src/ui/iliacTableHud.js');
    const ch = await import('/src/ui/card/cardTableHud.js');
    const { CardTableSession } = await import('/src/systems/card/cardTableSession.js');
    let x = 7, u = 3;
    const rand32 = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; };
    const unit = () => { u = (u * 1664525 + 1013904223) >>> 0; return u / 4294967296; };
    const playTo = (turns) => {
      const st = newGame({ decks: [[...STARTER_DECK], [...STARTER_DECK]], rand32 });
      for (let t = 1; t < turns; t++) { for (const pl of [0, 1]) commit(st, pl, patronPlays(st, pl, pl ? 'loose' : 'tight', 1, unit)); reveal(st); }
      return st;
    };
    const log = ['The holdings: Daggerfall, Evermor, Betony.', 'Turn 2.', 'Adrienne Lacroix commits.', 'Turn 3.', 'Adrienne Lacroix commits.', 'Turn 4.'];
    if (scene.startsWith('gambit')) {   // KG4: the third panel - its battle is the lab's own, over the leaning board
      if (scene === 'gambit-battle') { window.__panel = null; return; }
      const gh = await import('/src/ui/gambitTableHud.js');
      const { GAMBIT_TIERS, dealRegular } = await import('/src/systems/gambit/gambitPatrons.js');
      const { autoFill } = await import('/src/net/kingsGambit.js');
      document.querySelectorAll('.dfgambit').forEach((n) => n.remove());
      const hud = gh.createGambitTableHud({ onPress: () => {} });
      window.__panel = hud;
      const regulars = [{ name: 'Adrienne Lacroix', seed: 7, chair: 1, tier: GAMBIT_TIERS[0], nightLeft: 150, forFun: false }, { name: 'Gorbash gro-Ulfat', seed: 11, chair: 2, tier: GAMBIT_TIERS[1], nightLeft: 750, forFun: false }, { name: 'Sela Thrane', seed: 13, chair: 3, tier: GAMBIT_TIERS[3], nightLeft: 0, forFun: true }];
      let x = 9;
      const r32 = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; };
      const army = autoFill([], 300, r32);
      const state = dealRegular({ army, tier: GAMBIT_TIERS[1], rand32: r32 });
      const base = { regulars, regular: 1, friendly: false, purse: 900, stakeMult: 2, crown: 'daggerfall', army: [], pressed: null, said: null, game: null, selected: null, staged: null, info: null, why: null, armed: null, guideOpen: true, wordsOpen: false, armiesOpen: false, log: [], touch: matchMedia('(pointer: coarse)').matches, more: false };
      if (scene === 'gambit-setup') hud.render(gh.gambitHudModel({ ...base, phase: 'setup' }));
      else if (scene === 'gambit-army') hud.render(gh.gambitHudModel({ ...base, phase: 'army', army, pressed: army[0] }));
      else hud.render(gh.gambitHudModel({ ...base, phase: 'over', log: ['Gorbash gro-Ulfat\'s king falls.'], game: { state, crowns: ['daggerfall', 'wayrest'], name: 'Gorbash gro-Ulfat', stake: 100, over: { winner: 0, by: 'king' }, dealt: [7, 8], nightSpent: false } }));
      return;
    }
    if (scene.startsWith('iliac')) {
      const hud = ih.createIliacTableHud({ onPress: () => {} });
      window.__panel = hud;
      if (scene === 'iliac-setup') {
        hud.render(ih.iliacHudModel({ phase: 'setup', packPrice: 120, friendly: true, setup: {
          decks: [{ name: 'Starter deck' }, { name: 'Undead of the Bay' }, { name: 'Half built', word: 'A deck holds exactly 30 cards.' }],
          foes: [{ name: 'Adrienne Lacroix', temper: 'tight' }, { name: 'Gorbash gro-Ulfat', temper: 'loose', paid: true }, { name: 'Sela Thrane', temper: 'bluffer' }],
          deck: 0, foe: 0, forKeeps: true, keepsOk: true } }));
        return;
      }
      const st = playTo(scene === 'iliac-over' ? 7 : 4);
      const v = { ...iliacView(st, 0), names: ['You', 'Adrienne Lacroix'] };
      if (scene === 'iliac-over') { hud.render(ih.iliacHudModel({ phase: 'over', view: v, end: v.result?.winner === 0 ? 'won' : 'lost', log, packPrice: 120 })); return; }
      const hand = v.players[0].hand;
      let staged = [];
      for (let i = 0; i < hand.length && !staged.length; i++) for (let h = 0; h < 3 && !staged.length; h++) if (ih.stagedRefusal(v, [{ card: i, holding: h }]) === null) staged = [{ card: i, holding: h }];
      const pick = hand.findIndex((_, i) => !staged.some((s) => s.card === i) && [0, 1, 2].some((h) => ih.stagedRefusal(v, [...staged, { card: i, holding: h }]) === null));
      hud.render(ih.iliacHudModel({ phase: 'playing', view: v, staged, pick: pick >= 0 ? pick : null, log, packPrice: 120 }));
      return;
    }
    const hud = ch.createCardTableHud({ onPress: () => {} });
    window.__panel = hud;
    if (scene === 'holdem-buyin') { hud.render(ch.cardHudModel({ phase: 'buyin', buyIn: { min: 100, max: 1000 }, stakes: { sb: 5, bb: 10 }, iliac: true, packPrice: 120, gold: true })); return; }
    let y = 4;
    const r32 = () => { y ^= y << 13; y >>>= 0; y ^= y >>> 17; y ^= y << 5; return y >>>= 0; };
    // AUDIT CARDS-PLUS C5: a full table too (six chairs, HOLDEM_SEATS_MAX) at the river and at its showdown - the widest
    // board and the longest pot, where the pot ran off a phone's panel unseen
    const full = scene !== 'holdem-play';
    const names = ['Ana Vell', 'Bors Thane', 'Cael Dunmore', 'Dun Arbek', 'Eira Moss'].slice(0, full ? 5 : 3);
    const s = new CardTableSession({ player: { id: 'you', name: 'You', stack: 500 }, patrons: names.map((n, i) => ({ id: `patron:${i}`, name: n, temper: ['loose', 'tight', 'bluffer'][i % 3], stack: 400 + 100 * i })), stakes: { sb: 5, bb: 10 }, rand32: r32, now: 0 });
    const lines = [];
    let shown = false;
    for (let now = 0, acted = 0; now <= 600000; now += 50) {
      s.tick(now);
      const l = s.legal();
      const street = s.view().hand?.street;
      if (scene === 'holdem-play' && l && street === 'flop' && acted++ > 0) break;
      if (scene === 'holdem-river' && l && street === 'river') break;
      if (l) s.playerAct(l.check ? { type: 'check' } : { type: 'call' }, now);
      for (const e of s.drain()) { if (e.t === 'showdown') shown = true; const line = ch.eventLine(e, s.seats.map((q) => q.name), s.playerSeat); if (line) lines.push(line); }
      if (scene === 'holdem-showdown' && shown && !s.view().hand) break;
    }
    hud.render(ch.cardHudModel({ phase: 'playing', view: s.view(), legal: s.legal(), stakes: { sb: 5, bb: 10 }, log: lines }));
  }, scene);
}

/** What the page shows of the panel - read in the page. */
const measure = (page) => page.evaluate(() => {
  const root = document.querySelector('.dfcards, .dfiliac, .dfgambit');
  const cs = (n) => getComputedStyle(n);
  const r = root.getBoundingClientRect();
  const btn = root.querySelector('button');
  const lanes = [...root.querySelectorAll('.lane')], holds = [...root.querySelectorAll('.hold')];
  const log = root.querySelector('.log');
  const dpr = window.devicePixelRatio || 1;
  return {
    face: cs(root).fontFamily, buttonFace: btn ? cs(btn).fontFamily : null, titleFace: cs(root.querySelector('.tabletitle')).fontFamily,
    frame: cs(root).borderImageSource,
    rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, view: { w: innerWidth, h: innerHeight },
    overflow: root.scrollWidth - root.clientWidth,
    holdsOver: holds.map((h) => h.scrollWidth - h.clientWidth),
    lanePad: [...new Set(lanes.map((n) => `${cs(n).paddingLeft} ${cs(n).borderBottomWidth}`))],
    cardMargin: [...new Set([...root.querySelectorAll('.card-face')].map((n) => `${cs(n).marginBottom} ${cs(n).borderTopWidth}`))],
    noteMargin: [...root.querySelectorAll('.tablenote')].map((n) => cs(n).marginTop),
    trayH: [...root.querySelectorAll('.tray canvas')].map((c) => c.height / dpr),
    // AUDIT CARDS-PLUS C5: how many of each there are - a check over none is no check
    count: { notes: root.querySelectorAll('.tablenote').length, faces: root.querySelectorAll('.card-face').length, lanes: lanes.length, holds: holds.length, seats: root.querySelectorAll('.seat').length },
    pot: (() => { const p = root.querySelector('.pot'), b = root.querySelector('.board'); if (!p || !b) return null; const pr = p.getBoundingClientRect(), br = b.getBoundingClientRect(); return { text: p.textContent, inside: pr.left >= br.left - 0.5 && pr.right <= br.right + 0.5 }; })(),
    log: log ? { top: log.scrollTop, max: log.scrollHeight - log.clientHeight, lines: log.children.length } : null,
    // KG4: every press's size on the screen, the shortest side first; and the lab's board on the screen
    presses: [...root.querySelectorAll('button, [role="button"]')].filter((n) => n.getBoundingClientRect().width > 0).map((n) => { const b = n.getBoundingClientRect(); return Math.min(b.width, b.height); }),
    board: window.__gambitState ?? null,
  };
});

for (const [look, q] of [['plus', 'skin=enhanced&dress=none'], ['classic', 'skin=classic&dress=none'], ['grimoire', 'skin=enhanced&dress=grimoire']]) {
  // AUDIT CARDS-PLUS C5: a 360 phone and a short window too - where the pot ran off the panel and the title off the top
  for (const vp of [{ width: 1280, height: 760 }, { width: 1000, height: 560 }, { width: 390, height: 844 }, { width: 360, height: 740 }, { width: 844, height: 390, touch: true }]) {
    for (const scene of ['iliac-setup', 'iliac-play', 'iliac-over', 'holdem-buyin', 'holdem-play', 'holdem-river', 'holdem-showdown', 'gambit-setup', 'gambit-army', 'gambit-battle', 'gambit-over']) {
      if (process.env.PROBE_ONLY && !scene.startsWith(process.env.PROBE_ONLY)) continue;   // KG4: one game's scenes alone (PROBE_ONLY=gambit)
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.touch });
      page.on('pageerror', (e) => errors.push(`${look} ${scene}: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${look} ${scene}: ${m.text()}`); });
      const game = scene.startsWith('iliac') ? '&game=iliac&nohud' : scene === 'gambit-battle' ? '&game=gambit&cam=lean' : scene.startsWith('gambit') ? '&game=gambit&nohud' : '&nohud';   // KG4: the battle's panel the lab's own, laid before the lean is fitted to it
      await page.goto(`${BASE}/cards.html?t=14&nofonts&${q}${game}${scene === 'gambit-battle' ? '' : '&cam=seat'}`, { waitUntil: 'load', timeout: 120000 });   // KG4: one lens a page - the first `cam` is the one read   // a cold dev server's first page, the lab's own ready signal's budget
      await page.waitForFunction(() => window.__cardsReady === true, null, { timeout: 120000 });
      await page.addStyleTag({ content: FONT_CSS });
      await mount(page, scene);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(120);
      if (scene === 'gambit-battle') await page.evaluate(() => window.__gambitRelean?.());   // KG4: the lean fitted to the panel the fonts laid
      const m = await measure(page);
      const tag = `${look} ${scene} ${vp.width}x${vp.height}${vp.touch ? ' touch' : ''}`;
      const face = look === 'grimoire' ? /DFO Alagard/ : /^"Pixelify Five", "Pixelify Sans"/;
      check(face.test(m.face) && face.test(m.titleFace) && (!m.buttonFace || face.test(m.buttonFace)), `${tag}: the face - ${m.face} / ${m.buttonFace}`);
      // no face of the panel's own: on Plus and the classic skin no serif anywhere in the stack; under the dress the stack IS
      // the dress's (its own last resort is Georgia - so the base's check passed over the dress, and a panel's own serif
      // there went unread: AUDIT CARDS-PLUS C5)
      const dressStack = look === 'grimoire' ? await page.evaluate(async () => {
        const { GRIMOIRE_STACK } = await import('/src/ui/grimoireDress.js');
        const n = document.body.appendChild(document.createElement('span'));
        n.style.fontFamily = GRIMOIRE_STACK;
        const f = getComputedStyle(n).fontFamily;
        n.remove();
        return f;
      }) : null;
      const faces = [m.face, m.titleFace, m.buttonFace].filter((f) => f !== null);
      check(dressStack ? faces.every((f) => f === dressStack) : !faces.some((f) => /Georgia/.test(f)), `${tag}: no serif of its own - ${faces.join(' / ')}`);
      // AUDIT CARDS-PLUS C5: each kind the checks below read is THERE in the scenes that have it
      const want = { notes: ['iliac-setup', 'holdem-buyin'].includes(scene) ? 1 : 0, faces: scene === 'holdem-play' ? 3 : scene.startsWith('holdem-') && scene !== 'holdem-buyin' ? 5 : 0,
        lanes: ['iliac-play', 'iliac-over'].includes(scene) ? 6 : 0, holds: ['iliac-play', 'iliac-over'].includes(scene) ? 3 : 0, seats: scene === 'holdem-play' ? 4 : ['holdem-river', 'holdem-showdown'].includes(scene) ? 6 : 0 };
      check(Object.keys(want).every((k) => (want[k] ? m.count[k] >= want[k] : true)), `${tag}: the scene's parts are there ${JSON.stringify(m.count)} (wanted ${JSON.stringify(want)})`);
      if (scene === 'holdem-showdown') check(/^Showdown - Pot \d+$/.test(m.pot?.text ?? ''), `${tag}: the showdown's pot ${m.pot?.text}`);
      if (m.pot) check(m.pot.inside, `${tag}: the pot inside its board (${m.pot.text})`);
      if (look !== 'grimoire') check(/svg/.test(m.frame), `${tag}: the kit's carved frame - ${m.frame.slice(0, 40)}`);
      if (scene.startsWith('gambit') && vp.touch) check(m.presses.length > 0 && m.presses.every((d) => d >= 43.5), `${tag}: every press 44 px under a finger (${Math.min(...m.presses).toFixed(1)})`);   // KG4 (14.3)
      if (scene === 'gambit-battle') {   // KG4 (14.7, 10.7): the board clear of the panel, and the cell's size there
        const b = m.board, xs = b.corners.map((c) => c.x), ys = b.corners.map((c) => c.y);
        const box = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
        const clear = box.right <= m.rect.left + 1 || box.left >= m.rect.right - 1 || box.bottom <= m.rect.top + 1 || box.top >= m.rect.bottom - 1;
        check(b.corners.every((c) => c.front) && clear, `${tag}: the board clear of the panel - board ${JSON.stringify(box)} panel ${JSON.stringify(m.rect)}`);
        check(box.left >= -1 && box.top >= -1 && box.right <= m.view.w + 1 && box.bottom <= m.view.h + 1, `${tag}: the board on the screen`);
        // and with the panel folded: the lean fitted again to what the fold leaves (the room it gives the board)
        const folded = await page.evaluate(() => { const f = document.querySelector('.dfgambit .fold'); f.click(); const st = window.__gambitRelean(); f.click(); window.__gambitRelean(); return st.cellPx; });
        gambitCells.push({ tag, cellPx: b.cellPx, folded, board: `${Math.round(box.right - box.left)}x${Math.round(box.bottom - box.top)}` });
      }
      check(m.rect.left >= 0 && m.rect.top >= 0 && m.rect.right <= m.view.w && m.rect.bottom <= m.view.h, `${tag}: on the screen ${JSON.stringify(m.rect)}`);
      check(m.overflow <= 0, `${tag}: nothing wider than the panel (${m.overflow}px)`);
      check(m.holdsOver.every((d) => d <= 0), `${tag}: no lane past its holding ${m.holdsOver}`);
      check(m.lanePad.every((p) => p === '0px 0px'), `${tag}: a lane borrows no menu row ${m.lanePad}`);
      check(m.cardMargin.every((p) => p === '0px 0px'), `${tag}: a little card borrows no settings card ${m.cardMargin}`);
      check(m.noteMargin.every((p) => p === '0px'), `${tag}: the note borrows no .note ${m.noteMargin}`);
      if (scene === 'iliac-play') check(m.trayH.length > 0 && m.trayH.every((h) => h === 80), `${tag}: the hand painted at its 80px - the tile face ${m.trayH}`);
      if (m.log && m.log.max > 0) check(m.log.top === m.log.max && (m.log.top - 4) % 16 === 0, `${tag}: the log at its newest, on a whole line (${m.log.top} of ${m.log.max})`);
      await page.screenshot({ path: `${shots}/cardpanels-${look}-${scene}-${vp.width}.png` });
      // the fold: the table's words away and back, the line and the presses kept
      const folded = await page.evaluate(() => {
        const root = document.querySelector('.dfcards, .dfiliac, .dfgambit');
        const h0 = root.getBoundingClientRect().height;
        const words = [...root.querySelectorAll('.seats, .board, .tablenote, .log, .ilbody, .dfgambit-body')].some((n) => getComputedStyle(n).display !== 'none');   // a buy-in has none to put away; KG4: a battle's strip on a phone neither
        const fold = root.querySelector('.fold');
        const reach = fold.getBoundingClientRect().top >= 0;   // AUDIT CARDS-PLUS B2: the fold on the screen to press
        // KG4: the presses drawn before the fold - a press for the phone alone is none on a desktop (14.7), folded or not
        const drawnBefore = [...root.querySelectorAll('.tableacts button')].filter((n) => getComputedStyle(n).display !== 'none');
        fold.click();
        const h1 = root.getBoundingClientRect().height;
        // AUDIT CARDS-PLUS E6: the line and the presses DRAWN, the table's words not (a class toggled is no proof)
        const shown = (sel) => [...root.querySelectorAll(sel)].every((n) => getComputedStyle(n).display !== 'none');
        const kept = root.querySelectorAll('.msg, .tableacts').length === 2 && shown('.msg') && shown('.tableacts') && drawnBefore.length > 0 && drawnBefore.every((n) => getComputedStyle(n).display !== 'none');
        const away = [...root.querySelectorAll('.ilbody, .seats, .board, .tablenote, .log, .dfgambit-body')].every((n) => getComputedStyle(n).display === 'none');
        fold.click();
        return { shrank: words ? h1 < h0 : h1 === h0, back: Math.abs(root.getBoundingClientRect().height - h0) < 1, kept, away, reach };
      });
      check(folded.shrank && folded.back && folded.kept && folded.away && folded.reach, `${tag}: the fold ${JSON.stringify(folded)}`);
      // AUDIT CARDS-PLUS B1/B5/B7: every state the panel marks DIFFERS from its rest, in this look - the dress and the themes
      // repaint the roles, and the marks went with them unseen; mine and theirs differ; a target leaves the lead's edge
      const marks = await page.evaluate(() => {
        const STATES = ['target', 'lead-mine', 'lead-theirs', 'ahead', 'you', 'to-act', 'won'];
        const sig = (n) => { const c = getComputedStyle(n); return [c.borderTopColor, c.borderRightColor, c.borderBottomColor, c.borderLeftColor, c.boxShadow, c.outlineStyle, c.outlineColor, c.backgroundColor, c.backgroundImage, c.color].join('|'); };
        const as = (n, cls) => {
          const had = [...n.classList].filter((c) => STATES.includes(c));
          had.forEach((c) => n.classList.remove(c));
          cls.forEach((c) => n.classList.add(c));
          const out = sig(n), top = getComputedStyle(n).borderTopColor, shadow = getComputedStyle(n).boxShadow;
          cls.forEach((c) => n.classList.remove(c));
          had.forEach((c) => n.classList.add(c));
          return { sig: out, top, shadow };
        };
        const out = {};
        const hold = document.querySelector('.dfiliac .hold'), pw = document.querySelector('.dfiliac .pw'), seat = document.querySelector('.dfcards .seat');
        if (hold) {
          const rest = as(hold, []).sig;
          for (const st of ['target', 'lead-mine', 'lead-theirs']) out[st] = as(hold, [st]).sig !== rest;
          out['mine and theirs apart'] = as(hold, ['lead-mine']).sig !== as(hold, ['lead-theirs']).sig;
          const lead = as(hold, ['lead-theirs']), both = as(hold, ['lead-theirs', 'target']);
          out['a target keeps the lead'] = lead.top === both.top && (both.shadow === lead.shadow || /rgb/.test(both.shadow));
        }
        if (pw) out.ahead = as(pw, ['ahead']).sig !== as(pw, []).sig;
        if (seat) { const rest = as(seat, []).sig; for (const st of ['you', 'to-act', 'won']) out[st] = as(seat, [st]).sig !== rest; }
        return out;
      });
      for (const [k, v] of Object.entries(marks)) check(v, `${tag}: the ${k} mark shows`);
      // AUDIT CARDS-PLUS A2: no card covers another - a lane's, the tray's (each card's power stood under the next one)
      const covered = await page.evaluate(() => {
        const over = (sel) => { const rs = [...document.querySelectorAll(sel)].map((n) => n.getBoundingClientRect()); let k = 0; rs.forEach((a, i) => rs.forEach((b, j) => { if (j > i && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) k++; })); return k; };
        const lanes = [...document.querySelectorAll('.dfiliac .lane')].reduce((n, l, i) => { l.dataset.probe = String(i); const k = over(`.dfiliac .lane[data-probe="${i}"] > *`); delete l.dataset.probe; return n + k; }, 0);
        return lanes + over('.dfiliac .tray > .ic');
      });
      check(covered === 0, `${tag}: no card over another (${covered})`);
      console.log(`${tag}: ${m.face.split(',')[0]} frame ${/svg/.test(m.frame) ? 'kit' : m.frame.slice(0, 12)} ${Math.round(m.rect.right - m.rect.left)}x${Math.round(m.rect.bottom - m.rect.top)}${m.log ? ` log ${m.log.top}/${m.log.max}` : ''}`);
      await page.close();
    }
  }
}
for (const c of gambitCells) console.log(`KG4 MEASURE ${c.tag}: the board ${c.board} px on the screen, a cell ${c.cellPx.toFixed(1)} px - ${c.folded.toFixed(1)} px with the panel folded (the snap's radius 22)`);
console.log(`${passed()} of ${checks} checks; shots in ${shots}/cardpanels-*.png`);
if (errors.length) { failed++; console.log(`FAIL errors:\n${errors.join('\n')}`); }
await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
