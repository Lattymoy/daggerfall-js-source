// @ts-check
// ARENA3 (2026-10-02, Mac: "Joining a team comes with it's own enhanced UI where you can view your ranking and even
// player leaderboards"; "All UI elements and text must be enhanced UI plus"): THE ARENA WINDOW - six pages over the
// arena as this save knows it: BOUTS (the hour's exhibition with its fighters, records and prices - Watch, Wager; the
// players' bouts, online; your next ladder bout - Fight), LADDER (the ten tiers as a column, each opened whole beside
// it), TEAM (your banner, its season against the other, the laurel, the roster's top ten), LEADERBOARDS (the highest
// tier, the fastest Grand Champion, the season's rating, the banners by season - your row pinned under the top ten),
// RECORDS (your record, the last twenty bouts, your wagers) and RULES. Design: bible/11-Multiplayer/Arena.md "5. The
// Arena window".
//
// THE HOUSE'S SHAPE, the Notice Board's and the Broker's before it: a lazy chunk the door (ui/arenaDoor.js) mounts in its
// own host - `mountArenaWindow(host, deps)` answers `{ repaint, unmount }`; the back key and a tap on the scrim leave
// through the door's close. The kit dresses it on the Plus skin (ui/enhancedFrame.js roles: the window, the cards as
// panels, the presses, the header, the chips); on the classic skins the window lays its own sheet - its layout and the
// kit's rules cut to its selectors - so it wears the stone and brass whichever skin is chosen. Its classes are `aw-`
// (the bout's HUD's are `arena-`). The tabs are `role="tab"`, so the pad turns them (ui/plusPad.js); 1-6 pick a page.
//
// WHAT IT SAYS is systems/arenaBoard.js's (pure, `deps.board()` - the host builds it from the save and the gate), and
// what it does is the host's (`deps.act(kind, data)` - watch, fight, wager): this file draws and asks. Every word is
// set as text, never as markup - a fighter's name is the save's.
//
// ARENA4b: ONLINE the window draws the realm's Hall of Champions under the fastest Grand Champion (`hallCard`), the
// Records page says the record is the account's (`m.online`), and the header carries the purses won only when there is
// one to say (never a 0 - the realm keeps none).
//
// Not a DFU member. Ledger A (ARENA).

import { closeOnOutsideTap } from './enhancedOverlays.js';
import { overlayAction, isTextEntryTarget } from './input.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { ARENA_WINDOW_CSS } from './enhancedPlusStyle.js';
import { frameCss } from './enhancedFrame.js';
import { isEnhancedPlus } from '../systems/uiSkin.js';
import { scopeRules } from './brokerWindow.js';
import { ARENA_TEXT } from '../systems/arenaText.js';
import { ARENA_PAGES, ARENA_BOARDS } from '../systems/arenaBoard.js';

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const button = (cls, text, onPress) => {
  const b = /** @type {HTMLButtonElement} */ (el('button', `act ${cls}`, text));
  b.setAttribute('type', 'button');
  b.onclick = (e) => { e?.stopPropagation?.(); onPress(); };
  return b;
};
const W = () => ARENA_TEXT.window;
/** A banner's pennant (its colour is the sheet's, by `data-banner`). */
const pennant = (banner, cls = '') => { const p = el('span', `aw-pennant${cls ? ` ${cls}` : ''}`); p.dataset.banner = banner ?? ''; p.setAttribute('aria-hidden', 'true'); return p; };

export const ARENA_SKIN_STYLE_ID = 'arena-window-skin-style';
/** The window's own sheet for the classic skins: its layout, and the kit's rules cut to its selectors. */
const KIT_SEL = /\.aw-[a-z]/;
export const arenaSkinCss = () => [ARENA_WINDOW_CSS, scopeRules(frameCss(), (sel) => KIT_SEL.test(sel))].join('\n');
function injectSkin(doc = document) {
  if (isEnhancedPlus() || doc.getElementById?.(ARENA_SKIN_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = ARENA_SKIN_STYLE_ID;
  st.textContent = arenaSkinCss();
  (doc.head ?? doc.body).append(st);
}

/**
 * THE WINDOW.
 * @param {HTMLElement} host
 * @param {{
 *   board: () => any,
 *   act?: (kind: 'watch'|'fight'|'wager'|'queue'|'casual'|'unqueue'|'accept'|'decline'|'spectate'|'replay', data?: any) => ({ ok: boolean, text?: string } | void),
 *   page?: string, onExit?: (() => void) | null,
 * }} deps `board` systems/arenaBoard.js arenaBoard's model, built fresh at each render; `act` the host's doors
 */
export function mountArenaWindow(host, deps) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectSkin();
  const exit = () => deps.onExit?.();
  let page = ARENA_PAGES.includes(deps.page ?? '') ? /** @type {string} */ (deps.page) : 'bouts';
  let tierPicked = null;
  let boardPicked = 'pve';
  let wagerOpen = false, wagerSide = null, wagerStake = null;
  let word = null;   // { ok, text } - the status line
  let alive = true;

  const shell = el('div', 'aw-shell');
  shell.id = 'arena-window';
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-label', W().title);
  const win = el('div', 'aw-win');
  shell.append(win);
  const head = el('header', 'aw-head');
  const crest = pennant('', 'aw-crest');
  const title = el('div', 'aw-title');
  const sub = el('p', 'aw-sub');
  const note = el('p', 'aw-note');
  note.setAttribute('aria-live', 'polite');
  title.append(el('h2', null, W().title), sub, note);
  const id = el('div', 'aw-id');
  const close = button('aw-close', W().close, exit);
  head.append(crest, title, id, close);
  const tabs = el('nav', 'aw-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', W().title);
  const tabOf = {};
  for (const [i, p] of ARENA_PAGES.entries()) {
    const t = button('aw-tab', W().tabs[p], () => { page = p; wagerOpen = false; render(); });
    t.setAttribute('role', 'tab');
    t.dataset.page = p;
    t.setAttribute('aria-keyshortcuts', String(i + 1));
    tabOf[p] = t;
    tabs.append(t);
  }
  const body = el('div', 'aw-body');
  body.setAttribute('role', 'tabpanel');
  win.append(head, tabs, body);
  host.append(shell);

  const say = (ok, text) => { word = text ? { ok, text } : null; };
  /** A press the host answers - its word in the status line. */
  const doAct = (kind, data) => {
    const r = deps.act?.(kind, data);
    if (r && typeof r === 'object') say(!!r.ok, r.text ?? '');
    if (alive) render();
  };
  /** A press that may not be pressed, said: disabled, its reason as its title and under it. */
  const press = (a, onPress, cls = '') => {
    const wrap = el('span', 'aw-press');
    const b = button(`aw-act${cls ? ` ${cls}` : ''}`, a.label, () => { if (!a.why) onPress(); });
    b.dataset.act = a.act;
    if (a.why) { b.setAttribute('disabled', ''); b.setAttribute('title', a.why); b.setAttribute('aria-label', `${a.label}: ${a.why}`); }
    wrap.append(b);
    if (a.why) wrap.append(el('span', 'aw-why', a.why));
    return wrap;
  };
  const chip = (text, cls = '') => el('span', `aw-chip${cls ? ` ${cls}` : ''}`, text);

  // ── THE HEADER ──────────────────────────────────────────────────────────────────────────────────────────
  function renderHead(h) {
    sub.textContent = h.season;
    note.textContent = word?.text ?? '';
    note.className = `aw-note${word?.ok ? ' ok' : ''}`;
    crest.dataset.banner = h.banner ?? '';
    win.dataset.banner = h.banner ?? '';
    for (const c of [...id.children]) c.remove();
    id.append(el('span', 'aw-name', h.name));
    if (h.title) id.append(chip(h.title, 'aw-titlechip'));
    if (h.banner) id.append(chip(ARENA_TEXT.teams.name[h.banner], `aw-bannerchip b-${h.banner}`));
    if (h.laurel) id.append(chip(W().laurelMark, 'aw-laurel'));
    if (h.rating) id.append(chip(h.rating, 'aw-rating'));   // ARENA4: online, the season's rating and rank
    if (h.rank) id.append(chip(h.rank, `aw-rankchip${h.champion ? ' champ' : ''}`));
    // ARENA4b: the purses won (the design's header) - left out when there is none to say, never a 0 (online the realm keeps none)
    if (Number.isSafeInteger(h.purses) && h.purses > 0) id.append(chip(W().gold(h.purses), 'aw-purse'));
    id.append(el('span', 'aw-rec', h.record));
  }

  // ── BOUTS ───────────────────────────────────────────────────────────────────────────────────────────────
  function renderBouts(m) {
    const grid = el('div', 'aw-cards');
    for (const c of m.cards) {
      const card = el('section', `aw-card aw-bout-card k-${c.kind}`);
      card.dataset.kind = c.kind;
      const top = el('div', 'aw-cardhead');
      top.append(el('h3', null, c.title), chip(c.state, 'aw-state'));
      card.append(top);
      if (c.tier && c.kind === 'exhibition') card.append(el('p', 'aw-tierline', c.tier));
      if (c.kind === 'exhibition') {
        const vs = el('div', 'aw-versus');
        c.fighters.forEach((f, i) => {
          const box = el('div', `aw-fighter${f.favourite ? ' fav' : ''}`);
          box.dataset.banner = f.banner;
          const nameRow = el('div', 'aw-fname');
          nameRow.append(pennant(f.banner), el('span', 'aw-fn', f.name));
          box.append(nameRow, el('span', 'aw-fbill', f.billing), el('span', 'aw-fkind', f.kind));
          const nums = el('div', 'aw-fnums');
          nums.append(chip(f.record, 'aw-rec-chip'), chip(f.odds, 'aw-odds'));
          if (f.favourite) nums.append(chip(W().favourite, 'aw-fav'));
          box.append(nums);
          vs.append(box);
          if (i === 0) vs.append(el('span', 'aw-vs', W().vs));
        });
        card.append(vs);
        if (c.wager) card.append(el('p', 'aw-wagerline', c.wager));
      }
      if (c.kind === 'ladder' && c.opponents) card.append(el('p', 'aw-opp', c.opponents));
      // ARENA4: THE BOUTS ON THE SAND NOW - each its fighters (pennant, name, rating) and how many watch, and Watch
      if (c.kind === 'players' && c.live?.length) {
        const ul = el('ul', 'aw-live');
        for (const b of c.live) {
          const li = el('li', 'aw-liveb');
          li.dataset.kind = b.kind;
          const who = el('div', 'aw-livewho');
          const side = (f) => { const x = el('span', 'aw-livef'); x.append(pennant(f?.banner ?? null), el('span', 'aw-fn', f?.name ?? '')); if (f?.rating != null) x.append(chip(String(f.rating), 'aw-rating')); return x; };
          who.append(side(b.a));
          if (b.b) who.append(el('span', 'aw-vs', W().vs), side(b.b));
          const meta = el('div', 'aw-livemeta');
          meta.append(el('span', 'aw-livet', b.title), chip(b.watching, 'aw-state'));
          const acts = el('div', 'aw-acts');
          for (const a of b.acts) acts.append(press(a, () => doAct(/** @type {any} */ (a.act), { o: b.o })));
          li.append(who, meta, acts);
          ul.append(li);
        }
        card.append(ul);
      }
      // ARENA4: THE CHALLENGE - an offer names its fighter
      if (c.kind === 'challenge' && c.offer) {
        const vs = el('div', 'aw-offer');
        vs.append(pennant(c.offer.banner), el('span', 'aw-fn', c.offer.name));
        if (c.offer.rating != null) vs.append(chip(String(c.offer.rating), 'aw-rating'));
        card.append(vs);
      }
      for (const l of c.lines ?? []) card.append(el('p', 'aw-line', l));
      if (c.acts?.length) {
        const acts = el('div', 'aw-acts');
        for (const a of c.acts) {
          if (a.act === 'wager') acts.append(press(a, () => { wagerOpen = !wagerOpen; wagerSide = null; wagerStake = null; render(); }, wagerOpen ? 'on' : ''));
          else acts.append(press(a, () => doAct(/** @type {any} */ (a.act), { hour: c.hour }), a.act === 'fight' || a.act === 'queue' || a.act === 'accept' ? 'primary' : ''));
        }
        card.append(acts);
      }
      if (c.kind === 'exhibition' && wagerOpen && !c.acts.find((a) => a.act === 'wager')?.why) card.append(wagerPanel(c));
      grid.append(card);
    }
    body.append(grid);
    if (m.owed > 0) body.append(el('p', 'aw-owed', `${W().owed(m.owed)}.`));
  }
  /** THE WAGER: whom to back, how much, and the press that places it. */
  function wagerPanel(c) {
    const p = el('div', 'aw-wager');
    const sides = el('div', 'aw-wager-sides');
    c.fighters.forEach((f, i) => {
      const b = button(`aw-side${wagerSide === i ? ' on' : ''}`, `${W().back(f.name)} - ${f.odds}`, () => { wagerSide = i; render(); });
      b.dataset.banner = f.banner;
      b.setAttribute('aria-pressed', wagerSide === i ? 'true' : 'false');
      sides.append(b);
    });
    const stakes = el('div', 'aw-stakes');
    for (const s of c.stakes ?? []) {
      const b = button(`aw-stake${wagerStake === s ? ' on' : ''}`, W().gold(s), () => { wagerStake = s; render(); });
      b.setAttribute('aria-pressed', wagerStake === s ? 'true' : 'false');
      stakes.append(b);
    }
    const ready = wagerSide != null && wagerStake != null;
    const place = button('aw-place primary', ready ? ARENA_TEXT.book.wagerOn(wagerStake, c.fighters[wagerSide].name, c.fighters[wagerSide].odds) : W().wager, () => {
      if (!ready) return;
      const side = wagerSide, stake = wagerStake;
      wagerOpen = false; wagerSide = null; wagerStake = null;
      doAct('wager', { hour: c.hour, side, stake });
    });
    if (!ready) place.setAttribute('disabled', '');
    p.append(sides, stakes, place);
    return p;
  }

  // ── LADDER ──────────────────────────────────────────────────────────────────────────────────────────────
  function renderLadder(m) {
    const wrap = el('div', 'aw-ladder');
    const list = el('ol', 'aw-tiers');
    if (tierPicked == null || !m.tiers[tierPicked]) tierPicked = m.current;
    for (const [i, t] of m.tiers.entries()) {
      const row = el('li', `aw-tier${i === tierPicked ? ' on' : ''}`);
      row.dataset.state = t.state;
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-pressed', i === tierPicked ? 'true' : 'false');
      const pick = () => { tierPicked = i; render(); };
      row.onclick = pick;
      row.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault?.(); pick(); } };
      const pips = el('span', 'aw-pips');
      for (let k = 0; k < 3; k++) { const d = el('i'); if (k < t.won) d.className = 'on'; pips.append(d); }
      const crown = el('i', `crown${t.champion.beaten ? ' on' : ''}`);
      pips.append(crown);
      row.append(el('span', 'aw-tiern', String(t.n)), el('span', 'aw-tiername', t.name), pips, el('span', 'aw-tierstate', W().tierState[t.state]));
      list.append(row);
    }
    const t = m.tiers[tierPicked];
    const card = el('section', 'aw-card aw-tiercard');
    card.dataset.state = t.state;
    const top = el('div', 'aw-cardhead');
    top.append(el('h3', null, `${W().cleared(t.n, t.name)}`), chip(W().tierState[t.state], 'aw-state'));
    card.append(top);
    const ul = el('ul', 'aw-tierbouts');
    for (const b of t.bouts) {
      const li = el('li', `aw-tb${b.won ? ' won' : ''}${b.next ? ' next' : ''}`);
      li.append(el('span', 'aw-tbl', b.label), el('span', 'aw-tbo', b.opponents), el('span', 'aw-tbm', b.won ? W().beaten : b.next ? W().nextFight : ''));
      ul.append(li);
    }
    const ch = el('li', `aw-tb champ${t.champion.beaten ? ' won' : ''}${t.champion.next ? ' next' : ''}`);
    ch.append(el('span', 'aw-tbl', t.champion.label), el('span', 'aw-tbo', t.champion.opponents), el('span', 'aw-tbm', t.champion.beaten ? W().beaten : t.champion.next ? W().nextFight : ''));
    ul.append(ch);
    card.append(ul, el('p', 'aw-line', W().tierPurse(t.purse, t.champPurse)), el('p', 'aw-line aw-gives', W().titleGiven(t.title)));
    if (t.beasts) card.append(el('p', 'aw-line aw-warn', W().beastTier));
    if (t.free) card.append(el('p', 'aw-line aw-warn', W().meleeTier));
    const titles = el('div', 'aw-titles');
    titles.append(el('h4', null, W().yourTitles));
    if (m.titles.length) { const row = el('div', 'aw-chips'); for (const x of m.titles) row.append(chip(x, 'aw-titlechip')); titles.append(row); } else titles.append(el('p', 'aw-line', W().noTitles));
    card.append(titles);
    if (m.online) card.append(el('p', 'aw-line aw-online', m.online));   // ARENA4: online, the climb is the realm's
    wrap.append(list, card);
    body.append(wrap);
  }

  // ── TEAM ────────────────────────────────────────────────────────────────────────────────────────────────
  function table(cols, rows, pinned, { points = false } = {}) {
    const t = el('table', 'aw-table');
    const thead = el('thead');
    const hr = el('tr');
    for (const [i, c] of [W().rank, W().name, ...cols].entries()) { const th = el('th', i > 3 ? 'opt' : null, c); th.setAttribute('scope', 'col'); hr.append(th); }
    thead.append(hr);
    const tb = el('tbody');
    const row = (r) => {
      const tr = el('tr', `aw-row${r.you ? ' you' : ''}`);
      if (r.banner) tr.dataset.banner = r.banner;
      const nm = el('td', 'aw-nm');
      const who = el('span', 'aw-who');
      who.append(pennant(r.banner), el('span', 'aw-n', r.name));
      if (r.home) who.append(el('span', 'aw-home', r.home));
      nm.append(who);
      tr.append(el('td', 'aw-rank', String(r.rank)), nm);
      const cells = points ? [r.title ?? W().noTitle, W().wl(r.wins, r.losses), String(r.points)] : r.cells;
      cells.forEach((c, i) => tr.append(el('td', i >= 2 ? 'opt' : null, c)));
      return tr;
    };
    for (const r of rows) tb.append(row(r));
    if (pinned) {
      const gap = el('tr', 'aw-gap');
      const td = el('td', null, '...');
      td.setAttribute('colspan', String(cols.length + 2));
      gap.append(td);
      tb.append(gap, row(pinned));
    }
    t.append(thead, tb);
    return t;
  }
  function renderTeam(m) {
    const T = ARENA_TEXT.teams;
    // the season: the two banners on one bar
    const st = el('section', 'aw-card aw-season');
    const top = el('div', 'aw-cardhead');
    top.append(el('h3', null, W().standingHead), chip(m.seasonName ?? W().seasonShort(m.season), 'aw-state'));
    st.append(top);
    const split = el('div', 'aw-split');
    split.setAttribute('role', 'img');
    split.setAttribute('aria-label', T.standing(m.standings.red, m.standings.blue));
    const red = el('div', 'aw-split-red');
    red.style.width = `${(m.standings.redShare * 100).toFixed(1)}%`;
    split.append(red, el('div', 'aw-split-mid'));
    const nums = el('div', 'aw-split-nums');
    const side = (b, n) => { const s = el('span', `aw-split-n b-${b}`); s.append(pennant(b), el('span', null, `${T.short[b]} ${n}`)); if (m.laurel === b) s.append(chip(W().laurelMark, 'aw-laurel')); return s; };
    nums.append(side('red', m.standings.red), side('blue', m.standings.blue));
    st.append(nums, split);
    for (const l of m.lines) st.append(el('p', 'aw-line', l));
    if (m.laurelYou) st.append(el('p', 'aw-line aw-gives', T.laurelYou));
    body.append(st);
    if (m.joined) {
      const b = m.banners.find((x) => x.banner === m.joined);
      body.append(bannerCard(b, true));
      const mine = el('div', 'aw-stats');
      for (const [k, v] of [[W().yourPoints, String(m.given)], [W().yourWins, String(m.boutsFor)]]) { const s = el('div', 'aw-stat'); s.append(el('span', 'k', k), el('span', 'v', v)); mine.append(s); }
      body.append(mine);
      const rost = el('section', 'aw-card aw-roster');
      rost.append(el('h3', null, W().rosterHead(b.name)));
      rost.append(table([...ARENA_TEXT.window.cols.pve.slice(0, 1), ARENA_TEXT.window.cols.pve[2], W().pointsCol], b.rows, b.pinned, { points: true }));
      body.append(rost);
    } else {
      const two = el('div', 'aw-cards aw-two');
      for (const b of m.banners) two.append(bannerCard(b, false));
      body.append(two);
    }
  }
  function bannerCard(b, mine) {
    const card = el('section', `aw-card aw-bannercard${mine ? ' mine' : ''}`);
    card.dataset.banner = b.banner;
    const top = el('div', 'aw-bannerhead');
    top.append(pennant(b.banner, 'aw-flag'));
    const words = el('div', 'aw-bannerwords');
    words.append(el('h3', null, b.name), el('p', 'aw-motto', b.motto));
    top.append(words);
    if (b.laurel) top.append(chip(W().laurelMark, 'aw-laurel'));
    card.append(top, el('p', 'aw-line', b.lore));
    if (!mine) {
      const best = el('ol', 'aw-mini');
      for (const r of b.rows.slice(0, 3)) { const li = el('li'); li.append(el('span', 'aw-n', r.name), el('span', 'aw-pts', String(r.points))); best.append(li); }
      card.append(best);
    }
    return card;
  }

  // ── LEADERBOARDS ────────────────────────────────────────────────────────────────────────────────────────
  function renderBoards(m) {
    const bar = el('div', 'aw-subtabs');
    for (const k of ARENA_BOARDS) {
      const b = button(`aw-subtab${k === boardPicked ? ' on' : ''}`, m[k].title, () => { boardPicked = k; render(); });
      b.setAttribute('aria-pressed', k === boardPicked ? 'true' : 'false');
      b.dataset.board = k;
      bar.append(b);
    }
    body.append(bar);
    const bd = m[boardPicked];
    const card = el('section', `aw-card aw-board b-${boardPicked}`);
    card.append(el('h3', null, bd.title), el('p', 'aw-boardsub', bd.sub));
    if (bd.champion) card.append(el('p', 'aw-line aw-gives aw-champline', bd.champion));   // ARENA4: the season's #1 and the laurel
    if (bd.rows.length) card.append(table(bd.cols, bd.rows, bd.pinned));
    if (bd.empty) card.append(el('p', 'aw-empty', bd.empty));
    body.append(card);
    if (boardPicked === 'fast' && m.hall) body.append(hallCard(m.hall));   // ARENA4b: online, the realm's Hall under its fastest
  }
  /** ARENA4b: THE REALM'S HALL OF CHAMPIONS - every Grand Champion of the realm, the newest first, each with its season
   *  (systems/arenaBoard.js hallBoardOnline): the banner card's short list, a name and its season a line. */
  function hallCard(h) {
    const card = el('section', 'aw-card aw-hall');
    card.append(el('h3', null, h.title), el('p', 'aw-boardsub', h.sub));
    if (h.rows.length) {
      const ol = el('ol', 'aw-mini aw-hallrows');
      for (const r of h.rows) { const li = el('li', r.you ? 'you' : null); li.append(el('span', 'aw-n', r.name), el('span', 'aw-pts', r.season)); ol.append(li); }
      card.append(ol);
    }
    if (h.empty) card.append(el('p', 'aw-empty', h.empty));
    return card;
  }

  // ── RECORDS ─────────────────────────────────────────────────────────────────────────────────────────────
  function renderRecords(m) {
    if (m.online) body.append(el('p', 'aw-line aw-online', m.online));   // ARENA4b: online, the account's record - not the save's
    const stats = el('div', 'aw-stats');
    for (const s of m.stats) { const t = el('div', 'aw-stat'); t.append(el('span', 'k', s.k), el('span', 'v', s.v)); stats.append(t); }
    body.append(stats);
    if (m.titles.length) { const row = el('div', 'aw-chips'); for (const x of m.titles) row.append(chip(x, 'aw-titlechip')); body.append(row); }
    const card = el('section', 'aw-card aw-history');
    card.append(el('h3', null, W().lastBouts));
    if (!m.bouts.length) card.append(el('p', 'aw-empty', m.empty));
    const ol = el('ol', 'aw-bouts');
    for (const b of m.bouts) {
      const li = el('li', `aw-bout${b.won ? ' won' : b.draw ? ' draw' : ' lost'}`);
      li.dataset.banner = b.banner ?? '';
      const res = chip(b.result, `aw-res ${b.won ? 'won' : b.draw ? 'draw' : 'lost'}`);
      const what = el('div', 'aw-boutwhat');
      what.append(el('span', 'aw-bo', b.opp), el('span', 'aw-bt', `${b.tier}${b.label ? ` - ${b.label}` : ''}${b.how ? `, ${b.how}` : ''}`));
      const tail = el('div', 'aw-bouttail');
      if (b.when) tail.append(el('span', 'aw-bd', b.when));
      if (b.purse > 0) tail.append(el('span', 'aw-bp', W().gold(b.purse)));
      if (b.points > 0) tail.append(el('span', 'aw-bpts', W().pointsWord(b.points)));
      li.append(res, what, tail);
      // ARENA5: a bout the records keep - Watch the replay (the host's, refused away from the gate)
      if (b.replay) { const acts = el('div', 'aw-boutacts'); acts.append(press(b.replay, () => doAct('replay', { i: b.replay.i }))); li.append(acts); }
      ol.append(li);
    }
    card.append(ol);
    body.append(card);
    const wag = el('section', 'aw-card aw-wagers');
    wag.append(el('h3', null, W().wagersHead));
    if (!m.wagers.length) wag.append(el('p', 'aw-empty', W().noWagers));
    const ul = el('ul', 'aw-wagerlist');
    for (const w of m.wagers) { const li = el('li', `aw-wl s-${w.status}`, w.text); ul.append(li); }
    wag.append(ul);
    body.append(wag);
  }

  // ── RULES ───────────────────────────────────────────────────────────────────────────────────────────────
  function renderRules(m) {
    const wrap = el('div', 'aw-rules');
    for (const s of m) {
      const sec = el('section', 'aw-card aw-rule');
      sec.append(el('h3', null, s.head));
      const ul = el('ul');
      for (const l of s.lines) ul.append(el('li', null, l));
      sec.append(ul);
      wrap.append(sec);
    }
    body.append(wrap);
  }

  function render() {
    if (!alive) return;
    const m = deps.board();
    renderHead(m.header);
    for (const [p, t] of Object.entries(tabOf)) { t.setAttribute('aria-selected', p === page ? 'true' : 'false'); t.classList.toggle('on', p === page); t.setAttribute('tabindex', p === page ? '0' : '-1'); }
    body.dataset.page = page;
    const scroll = body.scrollTop;
    for (const c of [...body.children]) c.remove();
    ({ bouts: () => renderBouts(m.bouts), ladder: () => renderLadder(m.ladder), team: () => renderTeam(m.team), boards: () => renderBoards(m.boards), records: () => renderRecords(m.records), rules: () => renderRules(m.rules) })[page]();
    body.scrollTop = scroll;
  }
  render();

  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTextEntryTarget(e.target) && e.key !== 'Escape') return;
    if (overlayAction(e) === 'back') { e.preventDefault(); e.stopPropagation(); exit(); return; }
    const n = /^Digit([1-6])$/.exec(e.code ?? '');
    if (n) { e.preventDefault(); e.stopPropagation(); page = ARENA_PAGES[Number(n[1]) - 1]; wagerOpen = false; render(); tabOf[page]?.focus?.(); return; }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target?.getAttribute?.('role') === 'tab') {
      e.preventDefault();
      const i = ARENA_PAGES.indexOf(page);
      page = ARENA_PAGES[(i + (e.key === 'ArrowRight' ? 1 : ARENA_PAGES.length - 1)) % ARENA_PAGES.length];
      wagerOpen = false; render(); tabOf[page]?.focus?.();
    }
  };
  globalThis.addEventListener('keydown', onKey, { capture: true });
  const offOutside = closeOnOutsideTap(shell, '.aw-win', exit);
  return {
    repaint: () => render(),
    /** The page shown (the door's probe). */
    page: () => page,
    unmount() {
      if (!alive) return;
      alive = false;
      globalThis.removeEventListener('keydown', onKey, { capture: true });
      offOutside();
      shell.remove();
    },
  };
}
