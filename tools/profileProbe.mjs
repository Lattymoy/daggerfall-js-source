// INSPECT1, MEASURED (2026-09-23, kurkku: "a profile page that you can bring up when you're near them"; Mac: "a new
// enhanced UI element for the player inspect interaction. Showing their glyph, name, title, stats and worn gear").
//
// test/inspect1.test.js holds the law on a fake document; this stands the REAL card (ui/profileWindow.js) over the real
// sheet in Chromium and reads back what a fake cannot. At a desktop's width, a narrow window's and a phone's, the WIDEST
// card a player can be shown - a name at NAME_MAX, the longest title, every glyph, the widest numbers the wire admits,
// and every slot the look can carry filled with the longest names the pack gives an item - must stand inside the
// viewport with nothing spilling sideways: the head centred, each glyph drawn at its size in the title's company, the
// sheet's columns side by side where there is room and stacked where there is not (the card's own container query), no
// row wider than its column, the Close a thumb can press and on screen. A card taller than the screen scrolls inside
// itself, with its Close reachable. The waiting card and the silent one are photographed too. Photographs to
// tools/shots/ (or SHOT_DIR).
// PROFILE-UI (2026-10-07, Mac: "Lets only organize and polish the player profile. Its a mess"): every glyph a player can
// show - the identity token's whole vocabulary, eighteen now where three were - stands on a row of its own under the
// name, which keeps one line; the record's four plaques wrap inside the card; what they wear stands in its parts, a pair
// one row under the plural. The front door's film is taken down before each photograph (it mounts on its own clock).
//
//     node tools/profileProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const server = await createServer({ server: { port: 5237, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const pageErrors = [];

for (const [W, H, width] of [[1440, 900, 'desktop'], [480, 800, 'narrow'], [390, 700, 'phone']]) for (const sheet of ['enhanced', 'bare']) {
  const tag = `${width} ${sheet}`;
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => pageErrors.push(String(e.message)));
  // ?nointro, the probes' own switch (main.js): the front door's film takes Escape at the window, stopped, whenever it
  // mounts before the card - the Escape check below was a race the film sometimes won
  await page.goto('http://localhost:5237/play/?skin=enhanced&touch=off&nointro');
  const r = await page.evaluate(async (sheet) => {
    const { createProfileWindow, profileView, GEAR_ROWS } = await import('/src/ui/profileWindow.js');
    const { NAME_MAX, CARD_LEVEL_MAX, CARD_STAT_MAX, CARD_VITAL_MAX } = await import('/src/net/wire.js');
    const { TITLES, GLYPHS, RENOWN_MAX } = await import('/src/net/identityToken.js');
    const { itemLongName } = await import('/src/systems/itemInfo.js');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:repeating-linear-gradient(45deg,#2a2721 0 14px,#231f1a 14px 28px);height:100vh';
    // online is the enhanced lane (systems/onlineLane.js forces the skin), so the card stands over the enhanced sheet in
    // play; bare, it must stand as well - it leans on none of the sheet's global rules (a `* { box-sizing }` among them)
    if (sheet === 'enhanced') (await import('/src/ui/enhancedStyle.js')).injectEnhancedStyle();
    // THE WIDEST OUTFIT A PLAYER CAN WEAR: for every slot, the longest name the pack gives an item that EQUIPS there -
    // every template of the look's groups in every material its group takes, placed by DFU's own GetEquipSlot
    // (systems/equip.js) and named by the pack's own namer (itemLongName). The second of a pair wears what the first can;
    // a slot nothing equips stays bare, as it is on a real player.
    const { groupTemplates } = await import('/src/systems/itemTemplates.js');
    const { getEquipSlot } = await import('/src/systems/equip.js');
    const { EQUIP_SLOTS } = await import('/src/characters/paperdoll.js');
    const MATERIALS = { Weapons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], Armor: [0, 0x0100, 0x0200, 0x0201, 0x0202, 0x0203, 0x0204, 0x0205, 0x0206, 0x0207, 0x0208, 0x0209] };
    const best = new Map();
    for (const group of ['Armor', 'Weapons', 'Jewellery', 'MensClothing', 'WomensClothing']) {
      for (const t of groupTemplates(group)) {
        if (!t) continue;
        for (const material of MATERIALS[group] ?? [0]) {
          const it = { templateIndex: t.index, group, material };
          const slot = getEquipSlot({}, it);
          const name = itemLongName(it);
          if (!Number.isInteger(slot) || slot < 0 || typeof name !== 'string') continue;
          if (!best.has(slot) || name.length > best.get(slot).name.length) best.set(slot, { ...it, name });
        }
      }
    }
    const S = EQUIP_SLOTS;
    for (const [second, first] of [[S.Amulet1, S.Amulet0], [S.Bracelet1, S.Bracelet0], [S.Ring1, S.Ring0], [S.Bracer1, S.Bracer0], [S.Mark1, S.Mark0], [S.Crystal1, S.Crystal0], [S.Cloak1, S.Cloak2]]) {
      if (!best.has(second) && best.has(first)) best.set(second, best.get(first));
    }
    const items = [...best].map(([slot, it]) => ({ templateIndex: it.templateIndex, group: it.group, equipSlot: slot, material: it.material }));
    const look = { race: 'DarkElf', gender: 'female', faceIndex: 3, class: 'Nightblade', items };
    const card = { level: CARD_LEVEL_MAX, attrs: Array(8).fill(CARD_STAT_MAX), vitals: [CARD_VITAL_MAX, CARD_VITAL_MAX, CARD_VITAL_MAX], look };
    const title = TITLES.reduce((x, y) => (y.length > x.length ? y : x));
    // the widest name line a player can be shown: a Renown at its most (RENOWN_MAX), the longest tag the guild law takes
    const peer = { id: 'peer-0002', name: 'W'.repeat(NAME_MAX), title, glyphs: [...GLYPHS], lv: RENOWN_MAX, gt: 'WWWW' };
    const { titleBadge, glyphBadges } = await import('/src/ui/playerBadge.js');
    const want = { title: titleBadge(peer)?.text ?? null, glyphs: glyphBadges(peer).length };
    // PROFILE-UI: the record at its widest - every plaque, the duels' longest words
    const record = { wins: 99_999, losses: 99_999, gates: { closed: 99_999 }, raids: { defended: 99_999 }, serpents: { slain: 99_999 } };
    let closed = 0;
    const w = createProfileWindow({ onClose: () => closed++ });
    window.__profile = w;
    const read = () => {
      const root = document.querySelector('.dfprofile');
      const c = document.querySelector('.dfprofile-card');
      if (!root || getComputedStyle(root).display === 'none') return null;
      const box = c.getBoundingClientRect();
      const inView = box.left >= -0.5 && box.right <= innerWidth + 0.5 && box.top >= -0.5 && box.bottom <= innerHeight + 0.5;
      const spills = [];
      for (const n of c.querySelectorAll('*')) {
        const q = n.getBoundingClientRect();
        if (q.width === 0 && q.height === 0) continue;
        if (q.left < box.left - 0.5 || q.right > box.right + 0.5) spills.push(`${n.className.baseVal ?? n.className}: ${Math.round(q.left)}..${Math.round(q.right)} of ${Math.round(box.left)}..${Math.round(box.right)}`);
      }
      const colsOf = (sel) => { const n = c.querySelector(sel); return n ? n.getBoundingClientRect() : null; };
      const sheet = colsOf('.dfprofile-sheet'), gear = colsOf('.dfprofile-gear');
      const closeNode = c.querySelector('.dfprofile-close');
      const close = closeNode.getBoundingClientRect();
      const label = document.createRange(); label.selectNodeContents(closeNode);
      const lq = label.getBoundingClientRect();
      const closeCentred = Math.abs((lq.left + lq.right) / 2 - (close.left + close.right) / 2) < 1.5;   // the enhanced sheet's global button rule is text-align: left
      const glyphs = [...c.querySelectorAll('.dfprofile-glyph')].map((g) => { const q = g.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), color: getComputedStyle(g).color }; });
      const name = c.querySelector('.dfprofile-name').getBoundingClientRect();   // the name and its glyphs, one line centred as the name layer draws them
      const nameRange = document.createRange(); nameRange.selectNodeContents(c.querySelector('.dfprofile-nametext'));
      const nameLines = new Set([...nameRange.getClientRects()].map((q) => Math.round(q.top))).size;
      // PROFILE-UI: the glyphs' row under the name, the record's plaques, the parts of what they wear
      const glyphRow = c.querySelector('.dfprofile-glyphs')?.getBoundingClientRect() ?? null;
      const facts = [...c.querySelectorAll('.dfprofile-fact')].map((f) => f.getBoundingClientRect());
      const t = c.querySelector('.dfprofile-title');
      const rows = [...c.querySelectorAll('.dfprofile-row')].map((row) => {
        const slot = row.querySelector('.dfprofile-slot').getBoundingClientRect(), item = row.querySelector('.dfprofile-item').getBoundingClientRect();
        return { overlap: item.left < slot.right - 0.5, inside: item.right <= row.getBoundingClientRect().right + 0.5 };
      });
      return {
        box: { l: Math.round(box.left), r: Math.round(box.right), t: Math.round(box.top), b: Math.round(box.bottom), w: Math.round(box.width) }, vh: innerHeight, vw: innerWidth,
        inView, spills, scrollsInside: c.scrollHeight > c.clientHeight + 1, overflowY: getComputedStyle(c).overflowY,
        horizontalScroll: c.scrollWidth > c.clientWidth + 1, pageScroll: document.documentElement.scrollWidth > innerWidth,
        sideBySide: sheet && gear ? Math.abs(sheet.top - gear.top) < 1 && gear.left >= sheet.right - 0.5 : null,
        stacked: sheet && gear ? gear.top >= sheet.bottom - 0.5 : null,
        closeH: Math.round(close.height), closeW: Math.round(close.width), closeCentred,
        glyphs, titleColor: t ? getComputedStyle(t).color : null, titleText: t?.textContent ?? null,
        nameCentred: Math.abs((name.left + name.right) / 2 - (box.left + box.right) / 2) < 2, nameLines,
        rows: rows.length, rowsOverlapping: rows.filter((x) => x.overlap).length, rowsSpilling: rows.filter((x) => !x.inside).length,
        stats: c.querySelectorAll('.dfprofile-stat').length, vitals: c.querySelectorAll('.dfprofile-vital').length,
        glyphsUnderName: !!glyphRow && glyphRow.top >= name.bottom - 0.5, facts: facts.length, factsInside: facts.every((q) => q.left >= box.left - 0.5 && q.right <= box.right + 0.5),
        parts: [...c.querySelectorAll('.dfprofile-sub')].map((n) => n.textContent), items: c.querySelectorAll('.dfprofile-item').length,
        note: c.querySelector('.dfprofile-note')?.textContent ?? null,
      };
    };
    const out = {};
    w.show('peer-0002', profileView({ name: peer.name, peer, look, state: 'asking' }));
    out.asking = read();
    w.update('peer-0002', profileView({ name: peer.name, peer, look, card, state: 'answered', record }));
    out.answered = read();
    // the Close reached by scrolling the card to its foot, then pressed
    const c = document.querySelector('.dfprofile-card');
    c.scrollTop = c.scrollHeight;
    const close = c.querySelector('.dfprofile-close').getBoundingClientRect();
    out.closeOnScreen = close.top >= 0 && close.bottom <= innerHeight;
    out.worn = GEAR_ROWS.filter(([slot]) => best.has(slot)).length;
    out.want = want;
    return out;
  }, sheet);
  // the front door mounts on its own clock, after the page is cleared - it is taken down before every photograph
  const shot = async (name) => { await page.evaluate(() => { for (const id of ['intro', 'enhanced-menu']) document.getElementById(id)?.remove(); }); await page.screenshot({ path: `${OUT}/profile-${width}-${sheet}-${name}.png` }); };
  for (const [state, v] of [['asking', r.asking], ['answered', r.answered]]) {
    check(`${tag} ${state}: the card stands, inside the viewport`, !!v && v.inView, v && JSON.stringify(v.box));
    if (!v) continue;
    check(`${tag} ${state}: the card keeps the 14px gutter its sides keep, top and bottom too`, v.box.t >= 13.5 && v.box.b <= v.vh - 13.5 && v.box.l >= 13.5 && v.box.r <= v.vw - 13.5, JSON.stringify(v.box));
    check(`${tag} ${state}: nothing spills sideways out of the card`, v.spills.length === 0 && !v.horizontalScroll && !v.pageScroll, v.spills.slice(0, 3).join('; '));
    check(`${tag} ${state}: every glyph drawn at its size - all ${r.want.glyphs} a player can show`, v.glyphs.length === r.want.glyphs && v.glyphs.every((g) => g.w === 16 && g.h === 16), `${v.glyphs.length}`);
    check(`${tag} ${state}: the title in its colour, the name centred under it`, v.titleText === r.want.title && v.titleColor !== 'rgb(233, 228, 217)' && v.nameCentred, `${v.titleText} ${v.titleColor}`);
    check(`${tag} ${state}: the widest name stands on one line, its glyphs on a row of their own under it`, v.nameLines === 1 && v.glyphsUnderName, `${v.nameLines} lines, glyphs under: ${v.glyphsUnderName}`);
    check(`${tag} ${state}: every worn row whole - the slot and the name side by side, inside the row`, v.rows > 0 && v.rowsOverlapping === 0 && v.rowsSpilling === 0, `${v.rows} rows, ${v.rowsOverlapping} overlapping, ${v.rowsSpilling} spilling`);
    check(`${tag} ${state}: the Close a thumb can press, its word in its middle`, v.closeH >= 44 && v.closeW >= 120 && v.closeCentred, `${v.closeW}x${v.closeH}, centred: ${v.closeCentred}`);
  }
  if (r.asking) check(`${tag} asking: the room's gear at once - every piece worn named, a pair one row - no sheet yet, the line said`, r.asking.items === r.worn && r.asking.rows < r.worn && r.worn >= 20 && r.asking.stats === 0 && /Asking/.test(r.asking.note ?? ''), `${r.asking.items} named in ${r.asking.rows} rows of ${r.worn} worn, ${r.asking.stats} stats`);
  if (r.asking) check(`${tag} asking: what they wear in its parts, in order`, r.asking.parts.join('|') === ['In hand', 'Armour', 'Clothing', 'Jewellery'].filter((x) => r.asking.parts.includes(x)).join('|') && r.asking.parts.length >= 3, r.asking.parts.join(', '));
  if (r.answered) {
    check(`${tag} answered: the sheet - eight attributes, three vitals - and no line`, r.answered.stats === 8 && r.answered.vitals === 3 && r.answered.note === null);
    check(`${tag} answered: the record's four plaques, every one inside the card`, r.answered.facts === 4 && r.answered.factsInside, `${r.answered.facts}`);
    const wide = r.answered.box.w > 400;
    check(`${tag} answered: the sheet ${wide ? 'beside' : 'above'} what they wear`, wide ? r.answered.sideBySide : r.answered.stacked, `card ${r.answered.box.w}px`);
    check(`${tag} answered: a card taller than the screen scrolls inside itself, its Close reachable`, (r.answered.scrollsInside ? r.answered.overflowY === 'auto' : true) && r.closeOnScreen, `scrolls: ${r.answered.scrollsInside}`);
  }
  await page.evaluate(() => { document.querySelector('.dfprofile-card').scrollTop = 0; });
  await shot('answered');
  await page.evaluate(async () => {
    const { profileView } = await import('/src/ui/profileWindow.js');
    window.__profile.update('peer-0002', profileView({ name: 'Bran', peer: { title: 'founder', glyphs: ['sprout'] }, look: { race: 'Nord', gender: 'male', faceIndex: 0, class: 'Warrior', items: [] }, state: 'silent' }));
  });
  await shot('silent');
  // Escape takes it down
  await page.keyboard.press('Escape');
  const gone = await page.evaluate(() => getComputedStyle(document.querySelector('.dfprofile')).display === 'none');
  check(`${tag}: Escape takes the card down`, gone);
  await page.close();
}
check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
await browser.close();
await server.close();
console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
