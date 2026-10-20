// @ts-check
// EG-PLUS (2026-10-19, the owner: "We also need to improve the elite breach UI as its not enhanced plus UI standard"):
// THE START WINDOW ON ENHANCED PLUS - a breach window of its own (ui/eliteGates/egKit.js), where it had been DFU's list
// picker drawn in the skin: a column of text rows, the stake and the quest warning among the choices, each member's
// readiness spelt "[+x]", the Wager a second list of twenty rows. The classic skin keeps that list (ui/eliteGates/
// egStartWindow.js openEgStartWindow - THE NATIVE-WINDOW RULE: DFU's DaggerfallListPickerWindow); this window says the
// same things, each in its place:
//   THE HEAD     Elite Breach, the Weir Keys held as a chip, a close.
//   THE STAKE    one line: opening stakes one key - or none is held, and the Rehearsal is the way in. A quest that
//                falls due before the breach can close is a warning line under it.
//   WHERE        a tile per start the opener may make (Hall 1 and every Redoubt, deepest first): its name, its band,
//                and in a company each member's mark - who can start there and who cannot. The tile taken is brass.
//   THE WAGER    folded until opened (or while it holds a decree): its rule in one line, then each family's decrees as
//                tiles, a held one brass; a refusal (a family held, three held) on the line under them.
//   THE PRESSES  Open the breach (the window's press - a start must be taken first; a start some member cannot make
//                asks once, "Go without Mara?", through the host's question box), the Rehearsal where it is offered,
//                the Boards (the window steps out of the slot and comes back once they close), Cancel.
// THE WINDOW IN THE SLOT: an overlay of the generic shape every host frame drives (ui/brokerDoor.js's), mounted on the
// mode machine's window slot the list used (scenes/world.js egWindowSlot), so the world pauses and the pointer is free
// under it. THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD: the window leaves the slot before a choice is acted on,
// before its question and before the boards; a window put out of the slot by another (scenes/townTalk.js showOverlay
// disposes the outgoing occupant) cancels it, once. A choice is handed on ONCE however many doors call it.
//
// Not a DFU member: Daggerfall Unity has no Elite Breach. Ledger A (ELITE-GATES).
import { EG_TEXT, EG_BANDS, EG_DECREES, egBandOfHall, egStartHall } from '../../net/eliteGates/egLaw.js';
import { egMayStart, EG_WAGER_MAX } from '../../net/eliteGates/egStartLaw.js';
import { egWagerToggle, egNamesText, EG_WAGER_FAMILY_WORDS, EG_START_TICK, EG_START_CROSS } from './egStartWindow.js';
import { EG_BOARD_TEXT } from './egBoardWindow.js';
import { registerOverlay } from '../enhanced/enhancedOverlays.js';
import { overlayAction } from '../input.js';
import { dressEgKit, egEl, egHead, egSection } from './egKit.js';
import { t } from '../../systems/textManager.js';

/** The window's id on the page - an enhanced door's, so the pad's poller counts it as a window (ui/gamepadInput.js). */
export const EG_START_PANEL_ID = 'enhanced-egstart';
/** The decree families in the Wager's order. */
export const EG_WAGER_FAMILIES = Object.freeze(Object.keys(EG_WAGER_FAMILY_WORDS));
/** The window's own words. */
export const EG_START_TEXT = Object.freeze({
  keys: (n) => t('eg.start.keys', 'Weir Keys: {n}', { n }),
  get stake() { return t('eg.start.stake', 'Opening the breach stakes one Weir Key.'); },
  get rehearseFree() { return t('eg.start.rehearseFree', 'You can still rehearse Halls 1-5, free, once a day.'); },
  get where() { return t('eg.start.where', 'Where to start'); },
  without: (names) => t('eg.start.without', 'Without {names}', { names }),
  can: (name) => t('eg.start.can', '{name} can start here', { name }),
  cannot: (name) => t('eg.start.cannot', '{name} cannot start here', { name }),
  get wagerRule() { return t('eg.start.wagerRule', 'Up to three decrees, one from each family, for the whole breach. A wagered breach ranks on the Depths board only.'); },
  wagerCount: (n, max) => t('eg.start.wagerCount', '{n} of {max}', { n, max }),
  get wagerShow() { return t('eg.start.wagerShow', 'Show decrees'); },
  get wagerHide() { return t('eg.start.wagerHide', 'Hide decrees'); },
  get open() { return t('eg.start.open', 'Open the breach'); },
  get pickFirst() { return t('eg.start.pickFirst', 'Choose where to start first.'); },
  get rehearse() { return t('eg.start.rehearse', 'Rehearse Halls 1-5'); },
  get boards() { return t('eg.start.boards', 'Boards'); },
  get cancel() { return t('eg.start.cancel', 'Cancel'); },
});

const bandOf = (ew) => (EG_BANDS[egBandOfHall(egStartHall(ew > 0 ? ew : 0))]?.name ?? '');

/**
 * THE WINDOW'S MODEL: the keys, the warnings, each start the opener may make (deepest first, Hall 1 last - its name, its
 * band, each member's mark in a company and the names of those who cannot make it), the Wager by family, and which of
 * the Rehearsal and the boards are offered. The same facts the list's rows say (egStartRows), as parts. Pure.
 * @param {{ keys: number, me: string, members: { sub: string, name: string }[], starts: Record<string, number[]|null>, rehearsal?: boolean,
 *   questDue?: boolean, wager?: number[], board?: boolean }} o
 */
export function egStartModel({ keys, me, members, starts, rehearsal = false, questDue = false, wager = [], board = false }) {
  const party = members?.length ? members : [{ sub: me, name: '' }];
  const mine = Array.isArray(starts?.[me]) ? /** @type {number[]} */ (starts[me]) : [0];
  const list = keys > 0 ? (mine.includes(0) ? mine : [...mine, 0]) : [];
  const held = new Set(wager);
  return {
    keys, questDue: !!questDue, rehearsal: !!rehearsal, board: !!board,
    starts: list.map((ew) => {
      const can = party.map((m) => Array.isArray(starts?.[m.sub]) && egMayStart(/** @type {number[]} */ (starts[m.sub]), ew));
      const named = party.map((m) => m.name || 'a companion');
      return { ew, name: ew > 0 ? `Redoubt ${ew}` : EG_TEXT.startHall, band: bandOf(ew), marks: party.length > 1 ? named.map((name, i) => ({ name, can: can[i] })) : [],
        missing: named.filter((_, i) => !can[i]) };
    }),
    wager: [...wager],
    families: EG_WAGER_FAMILIES.map((fam) => ({ fam, words: EG_WAGER_FAMILY_WORDS[fam], decrees: EG_DECREES.filter((d) => d.fam === fam).map((d) => ({ id: d.id, name: d.name, line: d.line, held: held.has(d.id) })) })),
  };
}

const STYLE_ID = 'dagger-eg-start-style';
/** The window's place and its parts' sizes; the kit paints (ui/eliteGates/egKit.js). */
export const EG_START_CSS = `
.eg-start { left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(720px, calc(100vw - 24px)); z-index: 13; }
.eg-start .eg-k-tiles.eg-starts { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
.eg-start .eg-marks { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.eg-start .eg-fam { margin: 10px 0 6px; font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--egk-dim); }
.eg-start .eg-k-tiles.eg-decrees { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 6px; }
.eg-start .eg-k-tiles.eg-decrees .eg-k-tile { padding: 6px 8px; }
`;

/**
 * THE WINDOW, OPENED - `openEgStartWindow`'s inputs (the keys, the party and their starts, the Rehearsal, the quest
 * warning, `ask`, `say`, `onChoose`, `onCancel`, `board`) and the slot's two doors (`mount(win)` - false when refused,
 * `unmount(win)`), drawn in `doc`. `onChoose({ ew, wg, rh })` ONCE. Answers `{ close(), state() }` - the list's own -
 * or null where there is no page to draw on.
 * @param {any} o
 */
export function openEgStartPanel(o) {
  const doc = o.doc ?? globalThis.document;
  if (!doc?.createElement) return null;
  dressEgKit(doc);
  if (doc.getElementById && !doc.getElementById(STYLE_ID)) { const st = doc.createElement('style'); st.id = STYLE_ID; st.textContent = EG_START_CSS; (doc.head ?? doc.body)?.append(st); }
  const say = o.say ?? (() => {});
  let wager = [], pick = /** @type {number|null} */ (null), why = '', folded = true, done = false;
  /** @type {any} */ let root = null;
  /** @type {any} */ let win = null;
  let unregister = () => {};
  const view = globalThis.window ?? doc.defaultView ?? null;
  const onKey = (e) => {
    if (!root || typeof e?.key !== 'string' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (overlayAction(e) === 'back') { e.preventDefault?.(); e.stopPropagation?.(); cancel(); }
  };
  // THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD: the overlay out of the slot (and done, so a host that drains on
  // `done` drains it), the page let go, then whoever is next
  const leave = () => {
    const w = win;
    win = null;
    if (w) { w.done = true; o.unmount?.(w); }
    unregister(); unregister = () => {};
    view?.removeEventListener?.('keydown', onKey, { capture: true });
    root?.remove?.(); root = null;
  };
  const finish = (fn) => { if (done) return; done = true; leave(); fn(); };
  const cancel = () => finish(() => o.onCancel?.());
  const choose = (c) => finish(() => o.onChoose(c));
  const model = () => egStartModel({ ...o, wager, board: typeof o.board === 'function' });
  function begin() {
    const s = model().starts.find((x) => x.ew === pick);
    if (!s) { why = EG_START_TEXT.pickFirst; draw(); return; }
    if (!s.missing.length) { choose({ ew: s.ew, wg: [...wager], rh: false }); return; }
    // asked once: going on without the members who cannot make this start (the window out of the slot, the box in it)
    leave();
    o.ask([EG_TEXT.without(egNamesText(s.missing))], () => choose({ ew: s.ew, wg: [...wager], rh: false }), () => { if (!done) show(); }, cancel);
  }
  function boards() {
    leave();
    let back = false;
    const again = () => { if (!back && !done) { back = true; show(); } };
    if (!o.board(again)) again();
  }
  function toggle(id) {
    const r = egWagerToggle(wager, id);
    wager = r.wager;
    why = r.why ?? '';
    if (r.why) say(r.why);
    draw();
  }
  function draw() {
    if (!root) return;
    const m = model();
    const el = (tag, cls, text) => egEl(doc, tag, cls, text);
    root.replaceChildren();
    root.append(egHead(doc, EG_TEXT.name, { chips: [el('span', `eg-k-chip${m.keys > 0 ? ' gold' : ''}`, EG_START_TEXT.keys(m.keys))], onClose: cancel, closeWords: EG_START_TEXT.cancel }));
    const body = el('div', 'eg-k-body');
    const top = egSection(doc, '');
    top.append(el('div', 'eg-k-line', m.keys > 0 ? EG_START_TEXT.stake : EG_TEXT.noKeys));
    if (m.keys <= 0 && m.rehearsal) top.append(el('div', 'eg-k-line dim', EG_START_TEXT.rehearseFree));
    if (m.questDue) top.append(el('div', 'eg-k-line warn', EG_TEXT.questDue));
    body.append(top);
    if (m.starts.length) {
      const sec = egSection(doc, EG_START_TEXT.where);
      const tiles = el('div', 'eg-k-tiles eg-starts');
      for (const s of m.starts) {
        const b = el('button', `eg-k-tile${s.ew === pick ? ' on' : ''}`);
        b.setAttribute('aria-pressed', String(s.ew === pick));
        b.setAttribute('data-ew', String(s.ew));
        b.append(el('span', 'eg-k-tname', s.name), el('span', 'eg-k-tline', s.band));
        if (s.marks.length) {
          const marks = el('span', 'eg-marks');
          for (const mk of s.marks) { const c = el('span', `eg-k-chip ${mk.can ? 'gold' : 'red'}`, `${mk.can ? EG_START_TICK : EG_START_CROSS} ${mk.name}`); c.setAttribute('aria-label', mk.can ? EG_START_TEXT.can(mk.name) : EG_START_TEXT.cannot(mk.name)); marks.append(c); }
          b.append(marks);
        }
        if (s.missing.length) b.append(el('span', 'eg-k-tline', EG_START_TEXT.without(egNamesText(s.missing))));
        b.addEventListener?.('click', () => { pick = s.ew; why = ''; draw(); });
        tiles.append(b);
      }
      sec.append(tiles);
      body.append(sec);
      // THE WAGER: folded until opened, or while it holds a decree
      const open = !folded || m.wager.length > 0;
      const fold = el('button', 'eg-k-btn', open ? EG_START_TEXT.wagerHide : EG_START_TEXT.wagerShow);
      fold.setAttribute('aria-expanded', String(open));
      fold.addEventListener?.('click', () => { folded = open; draw(); });
      const wsec = egSection(doc, EG_TEXT.wager(m.wager.map((id) => EG_DECREES[id]?.name).filter(Boolean).join(', ')), [el('span', 'eg-k-chip', EG_START_TEXT.wagerCount(m.wager.length, EG_WAGER_MAX)), fold]);
      wsec.append(el('div', 'eg-k-line dim', EG_START_TEXT.wagerRule));
      if (open) {
        for (const f of m.families) {
          wsec.append(el('div', 'eg-fam', f.words));
          const ts = el('div', 'eg-k-tiles eg-decrees');
          for (const d of f.decrees) {
            const b = el('button', `eg-k-tile${d.held ? ' on' : ''}`);
            b.setAttribute('aria-pressed', String(d.held));
            b.setAttribute('data-decree', String(d.id));
            b.append(el('span', 'eg-k-tname', d.name), el('span', 'eg-k-tline', d.line));
            b.addEventListener?.('click', () => toggle(d.id));
            ts.append(b);
          }
          wsec.append(ts);
        }
      }
      body.append(wsec);
    }
    root.append(body);
    const acts = el('div', 'eg-k-dock');   // the presses on the window's foot, never scrolled away under the Wager
    if (why) { const w = el('div', 'eg-k-line warn', why); w.setAttribute('aria-live', 'polite'); acts.append(w); }   // a refusal over the presses, where the eye is
    if (m.starts.length) {
      const go = el('button', 'eg-k-btn eg-go', EG_START_TEXT.open);
      go.setAttribute('data-kind', 'primary');
      if (pick == null) go.setAttribute('aria-disabled', 'true');
      go.addEventListener?.('click', () => begin());
      acts.append(go);
    }
    if (m.rehearsal) { const r = el('button', 'eg-k-btn eg-rehearse', EG_START_TEXT.rehearse); r.addEventListener?.('click', () => choose({ ew: 0, wg: [], rh: true })); acts.append(r); }
    if (m.board) { const b = el('button', 'eg-k-btn eg-boards', EG_START_TEXT.boards); b.setAttribute('data-kind', 'quiet'); b.title = EG_BOARD_TEXT.title; b.addEventListener?.('click', () => boards()); acts.append(b); }
    const c = el('button', 'eg-k-btn eg-cancel', EG_START_TEXT.cancel); c.setAttribute('data-kind', 'quiet'); c.addEventListener?.('click', () => cancel()); acts.append(c);
    root.append(acts);
  }
  function show() {
    root = egEl(doc, 'div', 'eg-win eg-start');
    root.id = EG_START_PANEL_ID;
    root.setAttribute('tabindex', '-1');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', EG_TEXT.name);
    // a press on the window is the window's - never a swing or a look
    for (const k of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) root.addEventListener?.(k, (e) => e.stopPropagation?.());
    root.addEventListener?.('keydown', (e) => e.stopPropagation?.());
    // the overlay in the host's slot - the generic shape (ui/brokerDoor.js): the window's own DOM owns the keys and the pointer
    const w = { isChoiceWindow: true, done: false, input() {}, click() {}, wheel() {}, hover() {}, tick() {}, draw() {},
      dispose() { if (w.done) return; w.done = true; if (win === w && !done) { win = null; cancel(); } } };
    win = w;
    if (!o.mount?.(w)) { win = null; root = null; Promise.resolve().then(cancel); return; }   // a slot that refuses it: nothing staked
    (doc.body ?? doc.documentElement)?.append(root);
    unregister = registerOverlay(cancel);
    view?.addEventListener?.('keydown', onKey, { capture: true });
    draw();
    try { root.focus?.({ preventScroll: true }); } catch { /* a page that cannot focus */ }
  }
  show();
  return {
    close() { if (!done) { done = true; leave(); } },
    state: () => ({ view: 'panel', wager: [...wager], done, pick, rows: root ? model().starts.map((s) => s.name) : [] }),
  };
}

/**
 * THE PANEL'S DOORS for the host (scenes/world.js egStartWindow): `open(o)` the window in `doc` over the mode machine's
 * window slot (`slot`: `top`, `mount`, `close` - the list's own, egStartListDoors) - a finished window still in the slot
 * given up first, as the list's and the boards' doors give it up. openEgStartWindow opens it in the list's place when
 * the host hands these doors (Enhanced Plus), and falls back to the list where it cannot open.
 * @param {{ slot: { top: () => any, mount: (w: any) => any, close: (w: any) => void }, doc?: any }} deps
 */
export function egStartPanelDoors({ slot, doc = globalThis.document }) {
  return {
    open: (o) => openEgStartPanel({ ...o, doc, mount: (w) => { const top = slot.top(); if (top?.done) slot.close(top); return !!slot.mount(w); }, unmount: (w) => slot.close(w) }),
  };
}
