// ARENA3, MEASURED (2026-10-02, Mac: "Joining a team comes with it's own enhanced UI where you can view your ranking and
// even player leaderboards"; "All UI elements and text must be enhanced UI plus"): THE ARENA WINDOW (ui/arenaWindow.js)
// drawn over the real sheets in Chromium - the Enhanced Plus skin and the classic skin's own sheet - at a desktop's
// width, a narrow window's and a phone's, on every page (Bouts with the wager open, Ladder, Team, each Leaderboard,
// Records, Rules), over a save with something on every page: a fighter of the Red Banner two tiers up, in the laurel,
// with bouts behind them, a wager won and one waiting. Each must stand inside the viewport with nothing spilling
// sideways and the page never scrolling sideways, its words in the pixel face, and every tab a `role="tab"`.
// test/arena3_window.test.js holds the window's law on a fake page; this photographs what a fake cannot.
// Photographs to SHOT_DIR (default tools/shots/, ignored).
// ARENA4b: and THE WINDOW ONLINE over a realm's board (the service's `/v1/arena/board`, with the account's `me.record` and
// `me.recent`): the Records page the account's (its note, its record, its last bouts - a rated bout's rating in its line),
// no purses chip in the header, and the Leaderboards' fastest Grand Champion with the realm's Hall of Champions under it
// (test/arena4b_window.test.js holds the law).
// ARENA5: and YOUR LADDER REPLAY on the Records page - the save keeps three of its bouts (systems/arenaReplay.js), each
// row the records keep carrying Watch the replay: inside the window at every width, and its press the host's
// (`act('replay', { i })`); test/arena5_replay.test.js holds the law.
//
//     node tools/arenaWindowProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const server = await createServer({ server: { port: 5244, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const errors = [];
const PAGES = [['bouts', null], ['bouts', 'wager'], ['ladder', null], ['team', null], ['boards', 'pve'], ['boards', 'fast'], ['boards', 'pvp'], ['boards', 'team'], ['records', null], ['rules', null]];

for (const [W, H, width] of [[1440, 900, 'desktop'], [800, 600, 'narrow'], [390, 760, 'phone']]) for (const skin of ['enhanced', 'classic']) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(`http://localhost:5244/play/?skin=${skin}&touch=off`);
  await page.evaluate(async () => {
    const LG = await import('/src/systems/arenaLeague.js');
    const BK = await import('/src/systems/arenaBook.js');
    const AL = await import('/src/systems/arenaLadder.js');
    const AB = await import('/src/systems/arenaBoard.js');
    const RP = await import('/src/systems/arenaReplay.js');   // ARENA5
    const { mountArenaWindow } = await import('/src/ui/arenaWindow.js');
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:repeating-linear-gradient(45deg,#2a2721 0 14px,#231f1a 14px 28px);height:100vh';
    // a save with something on every page: noon of day 200 of 3E 405, the Red Banner, in the laurel
    const gm = 523530 - (523530 % 1440) + 196 * 1440 + 12 * 60;
    let ladder = AL.newArenaLadder();
    let league = LG.joinBanner(LG.newArenaLeague(), 'red', gm - 60 * 1440).league;
    let replays = [];   // ARENA5
    league.laurel = { banner: 'red', season: 405 };
    const opps = ['Mirabelle Ashfield', 'Gorlak gro-Mazgulbarz', 'Uthyrick Kingston', 'The Grizzly Bear', 'Senna Varo', 'Peristair Kingfield', 'Tozca of Totambu'];
    for (let i = 0; i < 9; i++) {
      const won = i !== 4;
      const next = AL.nextLadderBout(ladder);
      ladder = AL.ladderAfter(ladder, { won, how: won ? 'fall' : 'yield', purse: won ? next.purse : 0 }).ladder;
      league = LG.leagueAfterBout(league, { gameMinutes: gm - (40 - i * 4) * 1440, tier: next.tier, label: next.label, opp: opps[i % opps.length], won, how: won ? (i % 2 ? 'judges' : 'fall') : 'yield', purse: won ? next.purse : 0, champion: next.champion });
      // ARENA5: the last three bouts kept for their replays (a few seconds each - the window reads only their rows)
      if (i >= 6) {
        const R = RP.newRecording({ t0: 0, at: gm - (40 - i * 4) * 1440, next, sides: ['red', null], fighters: [{ id: 'you', name: 'Aldric', side: 0, mobile: 145, health: 90, maxHealth: 90 }, { id: 'f0', name: opps[i % opps.length], side: 1, mobile: 138, health: 40, maxHealth: 40 }] });
        for (let k = 0; k <= 30; k++) RP.recordTick(R, k * 100, [[-6 + k * 0.1, 0, 1.57], [6 - k * 0.1, 0, -1.57]]);
        replays = RP.keepReplay(replays, RP.finishRecording(R, { side: won ? 0 : 1, how: 'fall' }));
      }
    }
    const ex0 = AL.exhibitionFor(gm - 26 * 60);
    let book = BK.placeWager(league.book, ex0, 0, 100, { gold: 1000, gameMinutes: gm - 26 * 60 }).book;
    book = BK.settleBook(BK.bookVerdict(book, ex0.hour, 0), gm - 26 * 60 + 30).book;
    const ex1 = AL.exhibitionFor(gm);
    book = BK.placeWager(book, ex1, 1, 50, { gold: 1000, gameMinutes: gm }).book;
    book = { ...book, wagers: book.wagers.filter((w) => w.hour !== ex1.hour) };   // the hour's still open to wager on
    league = { ...league, book };
    window.__arena = { gm, ladder, league };
    window.__acts = [];
    const host = document.createElement('div');
    document.body.append(host);
    window.__arenaView = mountArenaWindow(host, {
      board: () => AB.arenaBoard({ ladder, league, gameMinutes: gm, name: 'Aldric Wyndbrooke-Varnell', atGate: true, gold: 640, healthShare: 1, replays }),
      act: (k, d) => { window.__acts.push([k, d]); return { ok: true, text: 'Taken - 50 gold on Gorlak gro-Mazgul at 7 to 4. Good luck to you.' }; },
    });
    await new Promise((res) => setTimeout(res, 120));
  });
  for (const [pg, sub, online] of [...PAGES, ['records', null, 'online'], ['boards', 'fast', 'online']]) {
    const tag = `${width}-${skin}-${pg}${sub ? `-${sub}` : ''}${online ? '-online' : ''}`;
    if (online && !(await page.evaluate(() => !!window.__online))) {
      // ARENA4b: the window remounted over a realm's board - the account's record and last bouts, the realm's Hall
      await page.evaluate(async () => {
        const AB = await import('/src/systems/arenaBoard.js');
        const { mountArenaWindow } = await import('/src/ui/arenaWindow.js');
        const L = await import('/src/net/arenaLaw.js');
        window.__arenaView.unmount();
        const atS = (n, d) => L.ARENA_SEASON_EPOCH_S + (n - 1) * L.ARENA_SEASON_S + (d - 1) * 86400 + 3600;
        const climb = (n) => L.arenaLadderOf(Array.from({ length: n }, (_, k) => ({ tier: Math.floor(k / 4), bout: k % 4 })), { wins: n, losses: 3, best: 5 });
        const recent = [
          { at: atS(4, 12), kind: 'pvp', won: true, how: 'fall', rating: { before: 1000, after: 1016 }, rated: true, opponent: { name: 'Gorlak gro-Mazgulbarz' }, points: 2 },
          { at: atS(4, 11), kind: 'pve', tier: 2, step: 3, won: true, how: 'yield', points: 3 },
          { at: atS(4, 11), kind: 'pve', tier: 2, step: 1, won: false, how: 'judges', points: 0 },
          { at: atS(4, 10), kind: 'pvp', won: null, how: 'draw', rated: false, opponent: { name: 'Peristair Kingfield' }, points: 0 },
          { at: atS(4, 9), kind: 'pvp', won: true, how: 'forfeit', rating: { before: 990, after: 1000 }, opponent: { name: 'Trististyr Hearthsly' }, points: 2 },
          { at: atS(3, 50), kind: 'pve', tier: 9, step: 3, won: false, how: 'fall', points: 0 },
        ];
        const board = {
          season: 4, day: 12, endsAt: 0, champion: { name: 'Mirabelle Ashfield', title: null, glyphs: ['laurel'] },
          pvp: { rows: [{ rank: 1, name: 'Mirabelle Ashfield', rating: 1140, wins: 9, losses: 2, draws: 1, bouts: 12 }], pinned: { rank: 6, name: 'Aldric Wyndbrooke-Varnell', rating: 1016, wins: 2, losses: 1, draws: 1, bouts: 4, you: true }, total: 9 },
          pve: { rows: [{ rank: 1, name: 'Mirabelle Ashfield', reached: 40, losses: 4 }], pinned: null, total: 1 },
          fast: { rows: [{ rank: 1, name: 'Mirabelle Ashfield', days: 9, at: atS(2, 30) }, { rank: 2, name: 'Uthyrick Kingston', days: 21, at: atS(4, 3) }], pinned: null, total: 2 },
          team: { standings: { red: 31, blue: 44 }, last: { season: 3, red: 90, blue: 41, winner: 'red' }, laurel: 'red', members: { red: 3, blue: 4 }, rosters: { red: { rows: [{ rank: 1, name: 'Aldric Wyndbrooke-Varnell', points: 7, wins: 5, banner: 'red', you: true }], pinned: null, total: 1 }, blue: { rows: [], pinned: null, total: 0 } } },
          hall: [{ name: 'Uthyrick Kingston', at: atS(4, 3) }, { name: 'Mirabelle Ashfield', at: atS(2, 30) }, { name: 'Senna Varo of the Iliac Bay Fighters', at: atS(1, 40) }],
          me: { ladder: climb(10), pvp: { rating: 1016, wins: 2, losses: 1, draws: 1, bouts: 4 }, rank: 6, banner: 'red', points: 7, grand: false, champion: false,
            record: { pveWins: 31, pveLosses: 5, pvpWins: 12, pvpLosses: 7, pvpDraws: 2, best: 9 }, recent },
        };
        const { ladder, league, gm } = window.__arena;
        const host = document.createElement('div');
        document.body.append(host);
        window.__online = true;
        window.__arenaView = mountArenaWindow(host, {
          board: () => AB.arenaBoard({ ladder, league, gameMinutes: gm, name: 'Aldric Wyndbrooke-Varnell', atGate: true, gold: 640, healthShare: 1, online: { board, hall: { status: 'open', queue: 'idle', live: [] } } }),
          act: () => ({ ok: true, text: '' }),
        });
        await new Promise((res) => setTimeout(res, 120));
      });
    }
    const r = await page.evaluate(async ([pg, sub]) => {
      const shell = document.querySelector('.aw-shell');
      const tab = [...shell.querySelectorAll('.aw-tab')].find((t) => t.dataset.page === pg);
      tab.click();
      if (pg === 'bouts' && sub === 'wager') {
        shell.querySelector('.aw-act[data-act="wager"]').click();
        shell.querySelectorAll('.aw-side')[1]?.click();
        shell.querySelectorAll('.aw-stake')[2]?.click();
      }
      if (pg === 'boards') [...shell.querySelectorAll('.aw-subtab')].find((b) => b.dataset.board === sub)?.click();
      await new Promise((res) => setTimeout(res, 60));
      const win = shell.querySelector('.aw-win');
      const q = win.getBoundingClientRect();
      const body = shell.querySelector('.aw-body');
      const inTabs = (n) => !!n.closest('.aw-tabs');
      const spill = [...win.querySelectorAll('*')].filter((n) => !inTabs(n) && n.getClientRects().length).filter((n) => { const b = n.getBoundingClientRect(); return b.width > 0 && (b.right > q.right + 1 || b.left < q.left - 1); })
        .map((n) => `${n.className}`).slice(0, 4);
      const tabs = [...shell.querySelectorAll('.aw-tab')];
      return {
        rect: [q.left, q.top, q.right, q.bottom], spill, bodyX: body.scrollWidth - body.clientWidth, pageX: document.documentElement.scrollWidth - innerWidth,
        font: getComputedStyle(win).fontFamily, tabsRole: tabs.every((t) => t.getAttribute('role') === 'tab'), selected: tabs.find((t) => t.getAttribute('aria-selected') === 'true')?.dataset.page,
        words: body.textContent.length, border: getComputedStyle(win).borderImageSource !== 'none',
      };
    }, [pg, sub]);
    const [l, t, rr, b] = r.rect;
    check(`${tag} inside the viewport`, l >= 0 && t >= 0 && rr <= W + 0.5 && b <= H + 0.5, r.rect.map(Math.round).join(','));
    check(`${tag} nothing spilling sideways`, r.spill.length === 0 && r.bodyX <= 1 && r.pageX <= 0, `${r.spill.join(' | ')} body+${r.bodyX} page+${r.pageX}`);
    check(`${tag} pixel face, its tab chosen`, /Pixelify/.test(r.font) && r.tabsRole && r.selected === pg, `${r.font.slice(0, 30)} ${r.selected}`);
    check(`${tag} the kit's carved frame`, r.border, '');
    check(`${tag} words on the page`, r.words > 40, String(r.words));
    if (pg === 'records' && !online) {
      // ARENA5: the three kept bouts each carry Watch the replay, inside the window; pressed, the host's word with its record
      const rp = await page.evaluate(async () => {
        const shell = document.querySelector('.aw-shell');
        const win = shell.querySelector('.aw-win').getBoundingClientRect();
        const presses = [...shell.querySelectorAll('.aw-boutacts .aw-act[data-act="replay"]')];
        const inWin = presses.every((b) => { const r = b.getBoundingClientRect(); return r.left >= win.left - 1 && r.right <= win.right + 1 && r.height >= 20; });
        window.__acts.length = 0;
        presses[0]?.click();
        await new Promise((res) => setTimeout(res, 30));
        return { n: presses.length, inWin, acts: window.__acts.slice(), label: presses[0]?.textContent ?? '' };
      });
      check(`${tag} Watch the replay on the three kept bouts, inside the window, pressed to the host`, rp.n === 3 && rp.inWin && rp.acts.length === 1 && rp.acts[0][0] === 'replay' && rp.acts[0][1].i === 0 && rp.label === 'Watch the replay', JSON.stringify(rp));
    }
    if (online) {
      const o = await page.evaluate(() => {
        const shell = document.querySelector('.aw-shell');
        const win = shell.querySelector('.aw-win').getBoundingClientRect();
        const hall = shell.querySelector('.aw-hall');
        const inWin = (n) => { const b = n.getBoundingClientRect(); return b.left >= win.left - 1 && b.right <= win.right + 1; };
        return {
          purse: !!shell.querySelector('.aw-purse'), note: !!shell.querySelector('.aw-body > .aw-online'),
          rows: shell.querySelectorAll('.aw-bout').length, rated: shell.querySelector('.aw-bout .aw-bt')?.textContent ?? '',
          hall: hall ? [...hall.querySelectorAll('.aw-mini li')].map((li) => li.textContent) : null, hallIn: hall ? inWin(hall) : false,
        };
      });
      check(`${tag} no purses chip online`, !o.purse, '');
      if (pg === 'records') check(`${tag} the account's record: its note, its last bouts, a rated bout's rating`, o.note && o.rows === 6 && /rating 1016 \(\+16\)/.test(o.rated), `${o.rows} rows, "${o.rated}"`);
      else check(`${tag} the realm's Hall under the fastest Grand Champion, inside the window`, !!o.hall && o.hall.length === 3 && o.hallIn && /Season 4/.test(o.hall[0]), JSON.stringify(o.hall));
    }
    await page.screenshot({ path: `${OUT}/arena-window-${tag}.png` });
  }
  await page.evaluate(() => { window.__online = false; });
  await page.close();
}
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
await server.close();
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
