// BOARD-UI, MEASURED (2026-10-06, Mac: "We need to overhaul the notice boards to enhance readability, Including each of
// the tabs"): THE NOTICE BOARD'S WINDOW (ui/noticeWindow.js) drawn in Chromium over the real sheets - the Enhanced Plus
// skin and the classic skin's own - at a desktop's width and a phone's, on every tab (Notices, a note read large, Work,
// Market's views, Vendors, Guilds, Seat), over books with something on every tab: notes new and old, the server's word,
// a guild's poster, Court and guild writs, listings near and far, a seat held and besieged with the reader's guild
// pledged to it. Each tab must stand inside the viewport with nothing spilling sideways, and its words in the pixel
// face. The pins hold the window's law on a fake page (test/board_ui.test.js); this photographs what a fake cannot.
// Photographs to SHOT_DIR (default tools/shots/, ignored).
//
//     node tools/noticeBoardProbe.mjs [--only=<tab>] [--skin=enhanced|classic]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? null;
const ONLY = arg('only');
const SKINS = arg('skin') ? [arg('skin')] : ['enhanced'];
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const server = await createServer({ server: { port: 5246, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const errors = [];

/** The tabs photographed: [file name, tab label, an act inside it before the photograph (or null)]. */
const SHOTS = [
  ['notices', 'Notices', null],
  ['read', 'Notices', 'read'],
  ['work', 'Work', null],
  ['market', 'Market', null],
  ['market-picked', 'Market', 'pick'],
  ['market-mine', 'Market', 'view:mine'],
  ['market-orders', 'Market', 'view:orders'],
  ['vendors', 'Vendors', null],
  ['guilds', 'Guilds', null],
  ['seat', 'Seat', null],
].filter(([n]) => !ONLY || n.startsWith(ONLY));

for (const [W, H, width] of [[1280, 800, 'desktop'], [390, 760, 'phone']]) for (const skin of SKINS) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(`http://localhost:5246/play/?skin=${skin}&touch=off`);
  const timing = await page.evaluate(async () => {
    const { mountNoticeBoard } = await import('/src/ui/noticeWindow.js');
    const NB = await import('/src/net/noticeBook.js');
    const { materialLabel, materialCountLabel } = await import('/src/systems/profItems.js');
    const { WEAVERS_STOCK, APOTHECARY_STOCK } = await import('/src/net/professionLaw.js');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:repeating-linear-gradient(45deg,#2a2721 0 14px,#231f1a 14px 28px);height:100vh';
    const T = 1_800_000_000;
    const SH = { id: 'g1', name: 'The Silver Hand', tag: 'SH', heraldry: { field: 'azure', border: 'gold', device: 'tower' } };
    const EO = { id: 'g2', name: 'Ebon Oath', tag: 'EO', heraldry: { field: 'crimson', border: 'gold', device: 'tower' } };
    const HND = { id: 'g3', name: 'The Hound', tag: 'HND', heraldry: { field: 'vert', border: 'ash', device: null } };
    const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
    const board = {
      notes: [
        { id: 'n2', subject: 'Looking for a party', body: 'Heading into Privateer\'s Hold tonight.\nAll levels welcome, bring potions.', from: 'Senna', at: T - 600, expiresAt: T + 5 * 3600, button: 'party', mine: false },
        { id: 'n1', subject: 'Selling Mithril Ore', body: 'Fair prices. 200 units ready.\nFind me at the Fighters Guild after dark.', from: 'Aldric', at: T - 3600 * 9, expiresAt: T + 2 * 86400, button: null, mine: true },
        { id: 'n3', subject: 'The Silver Hand recruits', body: 'We hold Anticlere and defend it Thursday.\nMembers get a share of the Tithe.', from: 'Mirabelle', title: 'Officer', at: T - 7200, expiresAt: T + 6 * 86400, button: 'guild', guild: SH },
        { id: 'n4', subject: 'Duel at the gate', body: 'Any blade, any time. Loser buys the ale.', from: 'Gorlak', at: T - 86400, expiresAt: T + 86400, button: 'duel' },
      ],
      notices: [{ id: 's1', subject: 'Server restart tonight', body: 'The server restarts at 20:00 UTC for an update. It takes about ten minutes.', from: 'Mac', at: T - 1800, expiresAt: T + 86400 }],
      me: { canPin: true, live: 1, max: 3, moderator: false, developer: false },
    };
    const gboard = { guild: SH, notes: [{ id: 'g1n', subject: 'Siege muster', body: 'Sign for Thursday\'s defence at the Seat tab.\nBring Ram Kits if you have them.', from: 'Mirabelle', at: T - 900, expiresAt: T + 3 * 86400, mine: false }], me: { canPin: true, live: 0, max: 3, keeper: false } };
    const door = { read: async () => ({ ok: true, data: board }), guildRead: async () => ({ ok: true, data: gboard }) };
    const book = NB.createNoticeBook({ door, storage: null, nowMs: () => T * 1000 });
    // WORK: the Court's writs, a guild's writ and a commission
    const OAK = 'log:oak';
    const workData = {
      writs: [
        { id: 'c1', material: 'ore:iron', tier: 1, qty: 30, pay: 72, renown: 150, expiresAt: T + 20 * 3600, state: 'open' },
        { id: 'c2', material: OAK, tier: 1, qty: 20, pay: 24, renown: 50, expiresAt: T + 9 * 3600, state: 'taken' },
        { id: 'c3', material: 'ore:mithril', tier: 4, qty: 10, pay: 310, renown: 600, expiresAt: T + 30 * 3600, state: 'open' },
      ],
      today: { filled: 1, max: 3 },
      guildWrits: [{ id: 'W1', kind: 'guild', guild: SH, region: 17, material: OAK, units: 800, left: 280, pay: 3, escrow: 840, at: 0, expiresAt: T + 5 * 86400, state: 'open', mine: false, may: false }],
      commissions: [{ id: 'K1', kind: 'commission', region: 17, recipe: 'longsword:mithril', quality: 2, pay: 900, poster: 'Ann', crafter: 'Silverthorn', at: 0, expiresAt: T + 5 * 86400, state: 'open', mine: false, forMe: false, returned: false }],
      yours: { commissions: [], guildWrits: [] }, guild: { ...SH, rank: 2, mayPost: false, marks: 5000 }, balance: 1234, writsOpen: true, me: 'Aldric',
    };
    const profBook = {
      state: { open: true, writs: { today: 1, max: 3 } }, held: (k) => (k === 'ore:iron' ? 44 : 3), carrying: () => true,
      writs: async () => ({ data: workData, error: null, stale: false }), deliver: async () => ({ ok: true, data: { pay: 72 } }),
    };
    const writBook = { state: {}, busy: false, supply: async () => ({ ok: true }), decline: async () => ({ ok: true }), withdraw: async () => ({ ok: true }) };
    // MARKET
    const ROAD = 420;
    const road = (r) => (r === 17 ? { courier: 0, seconds: 0, road: 0 } : { courier: 6, seconds: 1980, road: ROAD });
    const med = (m) => ({ median: m, line: [m - 1, null, m, m + 1, null, m, m + 0.5] });
    const marketData = {
      materials: { rows: [
        { id: 'A', kind: 'material', material: 'ore:mithril', units: 120, price: 8, region: 17, road: road(17), mine: false },
        { id: 'B', kind: 'material', material: 'ore:mithril', units: 40, price: 7, region: 23, road: road(23), mine: false },
        { id: 'C', kind: 'material', material: 'ore:iron', units: 600, price: 2, region: 17, road: road(17), mine: true },
        { id: 'D', kind: 'material', material: OAK, units: 75, price: 3, region: 20, road: road(20), mine: false },
      ], medians: { 'ore:mithril': med(8.5), 'ore:iron': med(2), [OAK]: med(3) } },
      mine: { rows: [{ id: 'L1', kind: 'material', material: 'ore:iron', units: 5, listed: 10, price: 3, region: 17, state: 'open', expiresAt: T + 40 * 3600 },
        { id: 'L2', kind: 'material', material: OAK, units: 0, listed: 30, price: 4, region: 17, state: 'sold', expiresAt: T - 3600 }], orders: [], auctions: [], bids: [] },
      orders: { orders: [
        { id: 'O1', region: 17, material: 'ore:mithril', units: 200, left: 140, price: 8, state: 'open', mine: false, expiresAt: T + 6 * 86400 },
        { id: 'O2', region: 23, material: 'ore:iron', units: 500, left: 500, price: 2, state: 'open', mine: false, expiresAt: T + 3 * 86400, road: road(23) },
      ], medians: { 'ore:mithril': med(8.5) } },
      history: { history: [{ material: 'ore:mithril', units: 21, median: 10, line: [null, 8, 9, null, 9, 8, 10] }], trades: [{ side: 'bought', kind: 'material', material: 'ore:mithril', units: 11, price: 10, total: 110, at: T - 7200 }] },
      crafted: { rows: [] }, auctions: { rows: [] }, goods: { rows: [] },
    };
    let reads = 0;
    const marketBook = {
      state: { open: true, balance: 1240, held: 0, road: [{ kind: 'material', material: 'ore:mithril', units: 40, from: 23, arrivesAt: T + 1920, waiting: false }], counts: { listings: 1, orders: 0 } },
      pending: 0, busy: false, goldOk: false, me: () => 'c1',
      cached: () => null,
      read: async (view) => { reads++; await new Promise((r) => setTimeout(r, 120)); return { ok: true, data: marketData[view] ?? { rows: [] } }; },
      settle: async () => ({ ok: true, settled: 0 }),
    };
    const market = {
      book: marketBook, stores: () => new Map([['ore:iron', { material: 'ore:iron', own: 12, bought: 3 }], ['ore:mithril', { material: 'ore:mithril', own: 50, bought: 0 }]]),
      region: 17, regionName: 'Daggerfall', regionNameOf: (r) => ({ 17: 'Daggerfall', 20: 'Sentinel', 23: 'Wayrest' })[r] ?? 'another region', hubs: {},
      name: (k) => materialLabel(k), countName: (k, n) => materialCountLabel(k, n),
      pieces: () => [], take: () => true, putBack: () => {}, mint: () => {}, pieceName: () => 'a piece',
      weavers: WEAVERS_STOCK, apothecaries: APOTHECARY_STOCK.slice(0, 4), stock: async () => ({ ok: true, text: 'Bought.' }),
      carried: () => new Map(), board: [402, 151], tithe: () => 6,
    };
    // VENDORS
    const vendors = {
      mode: 'board', region: 17, regionName: 'Daggerfall',
      read: async () => ({ ok: true, data: { rows: [
        { id: 'v1', item: { name: 'Steel Longsword' }, price: 450, owner: 'Bran', map: 1, buildingKey: 7, expiresAt: T + 20 * 86400 },
        { id: 'v2', item: { name: 'Leather Cuirass' }, price: 120, owner: 'Senna', map: 2, buildingKey: 9, expiresAt: T + 3 * 86400, mine: true },
      ] } }),
      nameOf: (it) => it.name, townOf: (m) => ({ 1: 'Anticlere', 2: 'Daggerfall' })[m], stats: () => ({ rows: ['Damage: 4-15', 'Weight: 9 kg'], magic: [] }),
      waypoint: () => true, waypointKey: () => null, clearWaypoint: () => {},
    };
    // SEAT
    const seatData = {
      seat: ANTICLERE, week: 6, phase: 'muster', reckoningAt: T + 2 * 86400 + 3600, turningAt: T + 4 * 86400, defence: 4500,
      holder: { guild: SH, since: 3, standing: 55, was: 50, tithe: 6, edict: null, titheWeek: 6 },
      battle: { kind: 'siege', guild: EO, against: SH },
      standings: [
        { guild: EO, influence: 5200, tribute: 0, accounts: 6 },
        { guild: SH, influence: 4100, tribute: 300, accounts: 9, shrine: 0 },
        { guild: HND, influence: 900, tribute: 0, accounts: 2 },
      ],
      mine: { guild: 'g1', rank: 1, seasoned: true, bound: 'g1', pledges: [{ region: 21, key: 3021, held: true }], influence: 640, tributeRoom: 0 },
      fight: { week: 6, key: 3021, kind: 'siege', tier: 'palace', startsAt: T + 3 * 86400, endsAt: T + 3 * 86400 + 1800, moved: false, state: 'scheduled',
        attackerGuild: EO, defenderGuild: SH, sides: { attack: { n: 7, swords: 1 }, defend: { n: 5, swords: 0 } }, max: 10, swordsMax: 2, open: true, window: { day: 3, hour: 20 },
        mine: { side: 'defend', signed: false, sellsword: false } },
      chronicle: [{ kind: 'held', week: 5, data: { guild: SH } }, { kind: 'claim', week: 3, data: { guild: SH, total: 6100 } }],
    };
    const seatBook = { open: true, standings: async () => ({ data: seatData, error: null }), data: { seats: [] } };
    const host = document.createElement('div');
    document.body.append(host);
    const t0 = performance.now();
    window.__view = mountNoticeBoard(host, {
      town: { name: 'Anticlere', mapId: 3021 }, rumour: ['The price of grain is up again.', 'They say the Hound lost a captain at the gate.'], bountyLine: true,
      gate: () => ({ subject: 'Dagon\'s Breach', body: 'Near Copperham. Opens in 4:07.' }),
      book, character: () => 'c1', nowS: () => T, answer: () => ({ ok: true }),
      work: { book: profBook, region: 17, regionName: 'Daggerfall', countName: (k, n) => materialCountLabel(k, n), writs: writBook, regionNameOf: (r) => String(r), pieces: () => [] },
      market, vendors, guilds: true,
      seat: { seat: ANTICLERE, book: seatBook, nameOf: () => null },
    });
    const mounted = performance.now() - t0;
    await new Promise((r) => setTimeout(r, 50));
    window.__reads = () => reads;
    return { mounted };
  });
  console.log(`${width}/${skin}: mounted in ${timing.mounted.toFixed(1)} ms`);
  for (const [name, label, step] of SHOTS) {
    const ok = await page.evaluate(async ({ label, step }) => {
      const tab = [...document.querySelectorAll('.notice-tab')].find((t) => t.textContent.trim().startsWith(label));
      if (!tab) return false;
      if (!tab.classList.contains('on')) tab.click();
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 200));
      if (step === 'read') document.querySelector('.notice-card')?.click();
      if (step === 'pick') document.querySelector('.market-row')?.click();
      if (step?.startsWith('view:')) {
        const v = step.slice(5);
        const want = { mine: 'My listings', orders: 'Orders' }[v] ?? v;
        [...document.querySelectorAll('.market-view')].find((b) => b.textContent.trim().startsWith(want))?.click();
        await new Promise((r) => setTimeout(r, 250));
      }
      await new Promise((r) => setTimeout(r, 60));
      window.__tabMs = performance.now() - t0;
      return true;
    }, { label, step });
    if (!ok) { check(`${width}/${skin} ${name}: the tab is there`, false); continue; }
    const m = await page.evaluate(() => {
      const w = document.querySelector('.notice-win');
      const r = w?.getBoundingClientRect();
      // an element inside a strip that scrolls sideways (the tabs on a phone) is the strip's to show, not a spill
      const inScroller = (n) => { for (let x = n.parentElement; x && x !== w; x = x.parentElement) if (/(auto|scroll)/.test(getComputedStyle(x).overflowX)) return true; return false; };
      const wide = [...document.querySelectorAll('.notice-win *')].filter((n) => n.getBoundingClientRect().right > innerWidth + 1 && n.getClientRects().length && !inScroller(n)).length;
      return { inside: !!r && r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1, wide, scrollX: document.scrollingElement.scrollWidth > innerWidth };
    });
    check(`${width}/${skin} ${name}: inside the viewport, nothing spilling sideways`, m.inside && !m.wide && !m.scrollX, JSON.stringify(m));
    await page.screenshot({ path: `${OUT}/notice-${width}-${skin}-${name}.png` });
  }
  await page.close();
}
await browser.close();
await server.close();
if (errors.length) { for (const e of errors) console.log('pageerror:', e); fails++; }
console.log(fails ? `${fails} failed` : 'all ok');
process.exit(fails ? 1 : 0);
