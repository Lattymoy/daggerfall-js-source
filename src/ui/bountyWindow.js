// @ts-check
// BOUNTY1 (2026-09-28, Mac: "one of the two when opened gives a quest screen in Enhanced Plus UI look"): THE BOUNTY
// BOARD'S WINDOW and THE PAYDAY NOTICE.
//
// The board: the town's four notices down the left (the beasts, how many, which way, the purse, and where the hunter
// stands with it), the one pressed read whole on the right - the notice as it was pinned, who pinned it, the map line
// in the brass of a note to the reader, the purse and the piece - with Take, Give up and (in a party) Share. Under the notices, every
// bounty the hunter holds, from any town, with its kills and its time left.
//
// The notice: the payday told as a story, then the reward itself in plain words - the gold, and the piece in its
// tier's colour with its tier and condition - and one press to take it. It is an overlay in the host's slot, so the
// game stands still under it until it is dismissed (townTalk's overlayActive - the world's gamePaused).
//
// THE HOUSE'S SHAPE, as the Broker's (ui/brokerWindow.js): a lazy chunk the door (ui/bountyDoor.js) mounts in its own
// host - `mountBountyBoard(host, deps)` / `mountBountyNotice(host, deps)` answer `{ repaint, unmount }` - the back key
// and a tap on the scrim leave through the door's own close. On the classic skins the window lays its own sheet, the
// kit's rules cut to its selectors, so it wears the Enhanced Plus stone and brass whichever UI is chosen.
import { closeOnOutsideTap } from './enhancedOverlays.js';
import { overlayAction } from './input.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { BOUNTY_CSS, rarityVarsCss } from './enhancedPlusStyle.js';
import { frameCss } from './enhancedFrame.js';
import { isEnhancedPlus } from '../systems/uiSkin.js';
import { scopeRules } from './brokerWindow.js';
import { bountyTimeText, BOUNTY_ACTIVE_MAX } from '../systems/bountyBoard.js';

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const button = (cls, text, onPress) => {
  const b = el('button', `act ${cls}`, text);
  b.setAttribute('type', 'button');
  b.onclick = (e) => { e.stopPropagation(); onPress(); };
  return b;
};

/** The piece a posting pays, in words: "a worn piece (half condition)", "a piece in full condition, Common or Magic". */
export function itemHint(rule) {
  const cond = rule.condition >= 1 ? 'in full condition' : rule.condition >= 0.75 ? 'lightly worn (three-quarter condition)' : 'well worn (half condition)';
  return rule.magicChance > 0 ? `a weapon or armour piece ${cond}, Common or Magic` : `a Common weapon or armour piece, ${cond}`;
}
/** The row's word for where the hunter stands with a notice. */
export function stateWord(row) {
  if (row.state === 'held') return `${row.held?.killed ?? 0}/${row.posting.count} slain`;
  if (row.state === 'paid') return 'Claimed';
  if (row.state === 'full') return 'Hands full';
  return row.mates?.length ? `${row.mates[0]} is hunting` : 'Open';
}
/** How often the board re-reads the world while it stands (the clock, a kill made elsewhere, a mate's share). */
export const BOUNTY_REPAINT_MS = 5_000;

export const BOUNTY_SKIN_STYLE_ID = 'bounty-skin-style';
/** The window's own sheet for the classic skins: its layout, the tiers' colours, the kit's rules cut to its selectors. */
export const bountySkinCss = () => [rarityVarsCss('.bounty-shell '), BOUNTY_CSS, scopeRules(frameCss(), (sel) => sel.includes('bounty'))].join('\n');
function injectSkin(doc = document) {
  if (isEnhancedPlus() || doc.getElementById?.(BOUNTY_SKIN_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = BOUNTY_SKIN_STYLE_ID;
  st.textContent = bountySkinCss();
  (doc.head ?? doc.body).append(st);
}

/** The window's shell, the keyboard's back and the scrim's tap - shared by both windows. */
function shellOf(host, label, exit) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectSkin();
  const shell = el('div', 'bounty-shell');
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-label', label);
  const win = el('div', 'bounty-win');
  shell.append(win);
  host.append(shell);
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (overlayAction(e) === 'back') { e.preventDefault(); e.stopPropagation(); exit(); }
  };
  globalThis.addEventListener('keydown', onKey, { capture: true });
  const offOutside = closeOnOutsideTap(shell, '.bounty-win', exit);
  return { shell, win, off: () => { globalThis.removeEventListener('keydown', onKey, { capture: true }); offOutside(); shell.remove(); } };
}

/**
 * The board.
 * @param {HTMLElement} host
 * @param {{ town:{name:string}, rows:() => any[], held:() => any[], nextDayIn:() => number, inParty:() => boolean,
 *   take:(id:string) => {ok:boolean, text?:string}, drop:(id:string) => {ok:boolean},
 *   share:(id:string) => {ok:boolean, shut?:Array<{name:string, lv:number, low:boolean}>},
 *   onExit?: (() => void) | null }} deps
 */
export function mountBountyBoard(host, deps) {
  const exit = () => deps.onExit?.();
  const { win, off } = shellOf(host, `Bounty board of ${deps.town.name}`, exit);
  const head = el('header', 'bounty-head');
  const title = el('div', 'bounty-title');
  const sub = el('p', 'bounty-sub');
  const note = el('p', 'bounty-note');
  note.setAttribute('aria-live', 'polite');
  title.append(el('h2', null, `Bounty Board of ${deps.town.name}`), sub, note);
  head.append(title, button('bounty-close', 'Close', exit));
  const body = el('div', 'bounty-body');
  const side = el('div', 'bounty-side');
  const list = el('ul', 'bounty-posts');
  list.setAttribute('role', 'list');
  const heldHead = el('h3', 'bounty-heldhead', 'Your bounties');
  const heldList = el('ul', 'bounty-held');
  side.append(list, heldHead, heldList);
  body.append(side);
  win.append(head, body);
  let picked = 0;
  let card = null;
  let word = null;
  let alive = true;

  /** AUDIT 28 B11: the key the focus sits on (a notice's row, the card's act), kept through a repaint - every five
   *  seconds the list is rebuilt, and a keyboard's place in it was dropped to the page. */
  const FOCUS_RE = /\b(bounty-post-i\d+|bounty-take|bounty-share|bounty-drop)\b/;
  const focusKey = () => { const m = FOCUS_RE.exec(String(globalThis.document?.activeElement?.className ?? '')); return m ? m[1] : null; };
  const render = () => {
    const keep = focusKey();
    draw();
    if (keep) /** @type {HTMLElement|null} */ (win.querySelector?.(`.${keep}`))?.focus?.();
  };
  const draw = () => {
    if (!alive) return;
    const rows = deps.rows();
    const held = deps.held();
    sub.textContent = `New notices in ${bountyTimeText(deps.nextDayIn())} · ${held.length} of ${BOUNTY_ACTIVE_MAX} bounties held`;
    note.textContent = word?.text ?? '';
    note.className = `bounty-note${word?.ok ? ' ok' : ''}`;
    for (const c of [...list.children]) c.remove();
    if (!rows.length) list.append(el('li', 'bounty-empty', 'The board is bare - no hunt is posted in these parts today.'));
    rows.forEach((r, i) => {
      const p = r.posting;
      const li = el('li', `bounty-post bounty-post-i${i}${i === picked ? ' on' : ''} st-${r.state}`);
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.setAttribute('aria-pressed', i === picked ? 'true' : 'false');
      const main = el('div', 'bounty-post-body');
      main.append(el('span', 'bounty-post-title', p.title), el('span', 'bounty-post-meta', `Tier ${p.tier} · ${p.count} ${p.foes} · ${p.graveyard ? 'graveyard' : p.kind === 'dungeon' ? 'dungeon' : p.far} · ${p.gold} gold`));
      li.append(main, el('span', `bounty-state st-${r.state}`, stateWord(r)));
      const pick = () => { picked = i; word = null; render(); };
      li.onclick = pick;
      li.onkeydown = (e) => { if (e.target === li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault?.(); pick(); } };
      list.append(li);
    });
    for (const c of [...heldList.children]) c.remove();
    heldHead.style.display = held.length ? '' : 'none';
    for (const h of held) {
      const li = el('li', 'bounty-heldrow');
      li.append(el('span', 'bounty-post-title', `${h.posting.title} · ${h.posting.town.name} · Tier ${h.posting.tier}`),
        el('span', 'bounty-post-meta', `${h.killed}/${h.posting.count} slain · ${bountyTimeText(h.left)} left${h.from ? ` · from ${h.from}` : ''}`));
      heldList.append(li);
    }
    card?.remove();
    card = null;
    const r = rows[picked] ?? rows[0];
    if (!r) return;
    const p = r.posting;
    card = el('div', 'bounty-card');
    card.append(el('h3', null, p.title));
    card.append(el('p', 'bounty-tier', p.tierLabel));   // BOUNTY-TIERLABEL: which tier, and the levels in it
    card.append(el('p', 'bounty-story', p.story));
    card.append(el('p', 'bounty-poster', `- posted by ${p.poster}`));
    const mapLine = el('p', 'bounty-mapline', p.mapLine);
    card.append(mapLine);
    const reward = el('div', 'bounty-reward');
    reward.append(el('span', 'bounty-reward-head', 'Reward'), el('span', 'bounty-gold', `${p.gold} gold pieces`), el('span', 'bounty-itemhint', itemHint(p.item)));
    card.append(reward);
    if (r.held) card.append(el('p', 'bounty-progress', `${r.held.killed} of ${p.count} slain · ${bountyTimeText(r.held.left)} left`));
    if (r.mates?.length && r.state !== 'held') card.append(el('p', 'bounty-mates', `${r.mates.join(', ')} ${r.mates.length > 1 ? 'are' : 'is'} already on this hunt - taking it joins them.`));
    const acts = el('div', 'bounty-acts');
    if (r.state === 'open') {
      acts.append(button('primary bounty-take', r.mates?.length ? 'Join the hunt' : 'Take bounty', () => {
        const done = deps.take(p.id);
        word = done.ok ? { ok: true, text: `Taken: ${p.title}. Look for the black circle on your map.` } : { ok: false, text: done.text ?? 'You cannot take that.' };
        render();
      }));
    } else if (r.state === 'held') {
      const heldId = deps.held().find((h) => h.posting.slotKey === p.slotKey)?.id ?? p.id;
      if (deps.inParty() && !r.held?.shared) acts.append(button('bounty-share', 'Share with party', () => {
        const done = deps.share(heldId);
        // BOUNTY-TIER: name the mates the bounty's tier shuts out
        const shut = (done?.shut ?? []).map((m) => `${m.name} (level ${m.lv}) is too ${m.low ? 'low' : 'high'} level to take it but can help`);
        word = { ok: !shut.length, text: shut.length ? `Shared. ${shut.join('; ')}.` : 'Shared with your party.' };
        render();
      }));
      acts.append(button('bounty-drop', 'Give up', () => { deps.drop(heldId); word = { ok: false, text: `You gave up the hunt for the ${p.foes}.` }; render(); }));
    } else {
      const why = el('p', 'bounty-why', r.state === 'paid' ? 'You have already claimed this bounty today.' : `You can hold no more than ${BOUNTY_ACTIVE_MAX} bounties at once.`);
      acts.append(why);
    }
    card.append(acts);
    body.append(card);
  };
  render();
  const tick = setInterval(render, BOUNTY_REPAINT_MS);
  /** @type {any} */ (tick)?.unref?.();
  return {
    repaint: () => render(),
    unmount() { if (!alive) return; alive = false; clearInterval(tick); off(); },
  };
}

/**
 * The payday notice. `deps.notice` is bountyHost's: { title, heading, story, byMate, reward: { gold, item, tier,
 * colour, condition } }.
 * @param {HTMLElement} host
 * @param {{ notice:any, onExit?: (() => void) | null }} deps
 */
export function mountBountyNotice(host, deps) {
  const exit = () => deps.onExit?.();
  const n = deps.notice;
  const { win, off } = shellOf(host, n.title, exit);
  win.classList.add('bounty-noticewin');
  const head = el('header', 'bounty-head');
  const title = el('div', 'bounty-title');
  title.append(el('h2', null, n.title), el('p', 'bounty-sub', n.heading));
  head.append(title);
  const body = el('div', 'bounty-noticebody');
  if (n.byMate) body.append(el('p', 'bounty-mates', `${n.byMate} struck the last blow for your party.`));
  body.append(el('p', 'bounty-story', n.story));
  const box = el('div', 'bounty-card bounty-rewardbox');
  box.append(el('span', 'bounty-reward-head', 'You received'));
  box.append(el('span', 'bounty-gold', `+${n.reward.gold}`));
  const item = el('span', 'bounty-rewarditem', `+${n.reward.item}`);
  item.style.color = n.reward.colour;
  box.append(item, el('span', 'bounty-itemhint', [n.reward.tier, n.reward.condition].filter(Boolean).join(' · ')));
  body.append(box);
  const acts = el('div', 'bounty-acts');
  const ok = button('primary bounty-ok', 'Take the reward', exit);
  acts.append(ok);
  body.append(acts);
  win.append(head, body);
  setTimeout(() => ok.focus?.(), 0);
  return { repaint: () => {}, unmount: () => off() };
}
