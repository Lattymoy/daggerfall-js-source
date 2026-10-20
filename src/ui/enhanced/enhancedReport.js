// @ts-check
// PRIVATE-REPORT (2026-10-17, Mac: "Can we add a private disclosure method for exploits/bugs with the client").
//
// THE REPORT FORM AND THE READERS' INBOX, drawn in the mailbox's window (ui/enhanced/enhancedPost.js postWindow) - the
// door every player already has on either skin (`/mail`, and `/bug` straight to the form). Three panes over the box's
// desk (net/privateReport.js ReportDesk):
//   report   - the form: what it is, a title, what happens and how; what is sent with it, said before it is sent; and
//              the player's own reports under it, each with whether a developer has read it and how it was closed.
//   inbox    - a reader's (the box carries their count): the open reports, unopened first, or the closed.
//   reading  - a reader's one report: its words, who sent it, the build it came from, and the closes.
//
// THE FORM IS NEVER REBUILT UNDER THE HANDS TYPING IN IT. The window draws on every change of the box or the desk (a
// heartbeat's look, my list answering); a pane answers a draw with `update`, which touches only what moved - the Send
// button, the list under the form - and the window rebuilds a pane only when its key changes.
import { REPORT_KINDS, REPORT_SUBJECT_MAX, REPORT_WORDS_MAX, charsOf } from '../../net/reportLaw.js';
import { reportStateText, reportKindText } from '../../net/privateReport.js';
import { t } from '../../systems/textManager.js';

/** The form's three kinds, each with the words that tell them apart - read when the form is drawn. */
const KIND_CHOICES = Object.freeze({
  exploit: () => [t('report.kind.exploit', 'An exploit'), t('report.kind.exploitHint', 'something players could abuse: gold or items from nothing, a duplicate, a way past a limit')],
  bug: () => [t('report.kind.bug', 'A bug'), t('report.kind.bugHint', 'something that does not work as it should')],
  security: () => [t('report.kind.security', 'Account or server security'), t('report.kind.securityHint', 'a way into someone else\'s account, saves or the servers')],
});

/** What a reporter's list says of a report: whether it has been read while open, else how it was closed. */
export const myReportStateText = (/** @type {{ read: boolean, state: string }} */ p) =>
  (p.state === 'open' ? (p.read ? t('report.state.read', 'Read by the developers') : t('report.state.sent', 'Sent')) : reportStateText(p.state));

/** The build a report came from, in the pause window's own words (pauseWindow.js REL8's version line). */
export function reportBuildText(/** @type {any} */ ctx) {
  if (!ctx?.update && !ctx?.build) return t('report.build.unknown', 'an unknown build');
  const name = ctx.update ? t('report.build.update', 'DFO Online {update}', { update: ctx.update }) : t('report.build.name', 'DFO Online');
  const where = ctx.app === 'desktop' ? t('report.build.desktop', 'desktop app') : ctx.app === 'browser' ? t('report.build.browser', 'in a browser') : null;
  return [name, ctx.build ? `(${ctx.build})` : null, where].filter(Boolean).join(' ');
}

/** A state's chip's classes - the sheet colours a fixed report (enhancedStyle.js `.pr-state.pr-fixed`). */
const stateClass = (/** @type {string} */ state) => ['pm-state', 'pr-state', `pr-${state}`].join(' ');

/** A report's line in the inbox: its kind, who sent it and when (and its state, where `state` is given). AUDIT
 *  PRIVATE-REPORT DOC-20: a report whose account is gone - which CASCADE never leaves - says no "from" at all, rather
 *  than a phrase each language must bend into the sentence's case. */
const fromLine = (/** @type {any} */ k, /** @type {any} */ p, /** @type {string|null} */ state = null) => {
  const kind = reportKindText(p.kind), day = k.day(p.sentAt);
  if (!p.from) return [kind, day, state].filter(Boolean).join(' - ');
  return state
    ? t('report.fromState', '{kind} - from {from} - {day} - {state}', { kind, from: p.from, day, state })
    : t('report.from', '{kind} - from {from} - {day}', { kind, from: p.from, day });
};

/** The key a pane stands under - the window rebuilds a pane only when it changes. */
export const reportPaneKey = (/** @type {any} */ keep, /** @type {any} */ box) =>
  (keep.view === 'reading' ? `reading:${keep.reportId}` : keep.view === 'inbox' ? `inbox:${keep.which === 'closed' ? 'closed' : 'open'}` : `report:${box?.state === 'guest' ? 'guest' : box?.state === 'signed-out' ? 'out' : 'in'}`);

/**
 * A PANE for `keep.view`. `k` is the window's kit: `{ keep, box, el, button, keyed, tell, refusal, day, go, held, focus }` -
 * `go(view, extra)` moves the window to another pane (or back to the post, `null`); `held()` the key of the element
 * holding the focus and `focus(key)` gives it back, so a pane that redraws a part keeps the player's place in it.
 * Answers `{ key, root, update }`.
 * @param {any} k
 */
export function reportPane(k) {
  const keep = k.keep;
  const b = k.box;
  const key = reportPaneKey(keep, b);
  if (keep.view === 'reading') return readingPane(k, key);
  if (keep.view === 'inbox') return inboxPane(k, key);
  return composePane(k, key);
}

function composePane(k, key) {
  const { el, button, keyed, box: b } = k;
  const desk = b.desk;
  const root = el('div', 'pr-pane pr-compose');
  const back = keyed(button('pm-back', t('account.card.act.back', 'Back'), () => k.go(null, { focus: 'report' })), 'back');
  if (b.state === 'guest' || b.state === 'signed-out') {
    root.append(el('p', 'pm-empty', b.state === 'guest' ? k.refusal('report-needs-account') : t('report.signIn', 'Sign in to an account to send a private report.')));
    const foot = el('div', 'pm-foot');
    foot.append(back);
    root.append(foot);
    return { key, root, update: () => {} };
  }
  root.append(el('p', 'pr-intro', t('report.intro', 'Found an exploit, a bug or a security hole? Tell the developers here, and only they can read it. Please keep exploits out of chat, Discord and the Notice Board until they are fixed.')));

  const kinds = el('fieldset', 'pr-kinds');
  kinds.append(el('legend', 'pr-label', t('report.kindLegend', 'What is it?')));
  /** @type {any[]} */ const radios = [];
  for (const kind of REPORT_KINDS) {
    const [name, hint] = KIND_CHOICES[kind]();
    const lab = el('label', 'pr-kind');
    const r = /** @type {any} */ (el('input', null));
    r.type = 'radio'; r.name = 'pr-kind'; r.value = kind;
    r.checked = desk.draft.kind === kind;
    r.addEventListener('change', () => { if (r.checked) desk.setDraft({ kind }); });
    radios.push(keyed(r, `kind-${kind}`));
    const words = el('span', 'pr-kindtext');
    words.append(el('span', 'pr-kindname', name), el('span', 'pr-hint', hint));
    lab.append(r, words);
    kinds.append(lab);
  }

  const subjectField = el('label', 'pr-field');
  const subject = /** @type {any} */ (keyed(el('input', null), 'subject'));
  subject.type = 'text'; subject.maxLength = REPORT_SUBJECT_MAX; subject.value = desk.draft.subject; subject.autocomplete = 'off';
  subject.addEventListener('input', () => desk.setDraft({ subject: subject.value }));
  subjectField.append(el('span', 'pr-label', t('report.subjectLabel', 'A short title')), subject);

  const bodyField = el('label', 'pr-field');
  const body = /** @type {any} */ (keyed(el('textarea', null), 'body'));
  body.rows = 7; body.maxLength = REPORT_WORDS_MAX; body.value = desk.draft.body;
  body.placeholder = t('report.bodyHint', 'What happens, where, and the steps that make it happen again.');
  // the characters used of the bound, counted as the law counts them (code points - reportLaw.js charsOf); read where it
  // stands, never announced (a live region would speak every keystroke), and AUDIT PRIVATE-REPORT UI-11: outside the
  // field's label, its description - inside, it was part of the field's name, renamed at every key
  const count = el('span', 'pr-count');
  count.id = 'pr-count';
  body.setAttribute('aria-describedby', 'pr-count');
  const counted = () => { count.textContent = `${charsOf(body.value)} / ${REPORT_WORDS_MAX}`; };
  body.addEventListener('input', () => { desk.setDraft({ body: body.value }); counted(); });
  counted();
  bodyField.append(el('span', 'pr-label', t('report.bodyLabel', 'What happens, and how to make it happen')), body);

  root.append(kinds, subjectField, bodyField, count,
    el('p', 'pr-sends', t('report.sends', 'Sent with it: your username and this game\'s build ({build}).', { build: reportBuildText(desk.context()) })));

  const sendWord = () => (desk.sending ? t('prof.page.stores.sending', 'Sending...') : t('report.send', 'Send privately'));
  const send = keyed(button('pm-send primary', sendWord(), () => sendIt()), 'send');
  const foot = el('div', 'pm-foot');
  foot.append(back, send);
  root.append(foot);

  const mineHead = el('h4', 'pr-minehead', t('report.mine', 'Your reports'));
  const mine = el('div', 'pm-list pr-mine');
  root.append(mineHead, mine);

  let mineSeen = -1;
  const drawMine = () => {
    mine.textContent = '';
    if (desk.mine === null) { mine.append(el('p', 'pm-empty', desk.mineError ? t('report.mineError', 'Your reports could not be read right now.') : t('report.mineLooking', 'Looking for your reports...'))); return; }
    if (!desk.mine.length) { mine.append(el('p', 'pm-empty', t('report.mineNone', 'You have not sent any.'))); return; }
    for (const p of desk.mine) {
      const row = el('div', 'pr-mrow');
      const text = el('span', 'pm-text');
      text.append(el('span', 'pm-subject', p.subject), el('span', 'pm-from', `${reportKindText(p.kind)} - ${k.day(p.sentAt)}`));
      row.append(text, el('span', stateClass(p.state), myReportStateText(p)));
      mine.append(row);
    }
  };

  /** AUDIT PRIVATE-REPORT UI-4 (ASYNC NEVER DROPS): A SEND'S END IS SAID BY THE PANE STANDING WHEN IT LANDS - the desk keeps
   *  it (`lastSend`) and the first pane in the page to update says it, once. A face rebuilt mid-send, or the window closed
   *  and opened again, had the old pane say it to a window no longer in the page: the fields emptied in silence, or a
   *  refusal was never said at all. */
  const sayLast = () => {
    const last = desk.lastSend;
    if (!last || root.isConnected === false) return null;
    desk.lastSend = null;
    if (last.ok) k.tell(last.repeat ? t('report.sentBefore', 'That report had already reached the developers. Thank you.') : t('report.sent', 'Sent. Thank you. Only the developers can read it.'), true);
    else k.tell(k.refusal(last.error));
    return last;
  };
  /** AUDIT PRIVATE-REPORT UI-3: the field a send's end points at - the title after a send, the field a refusal names,
   *  else Send. A focus given to a field still disabled goes nowhere, so it is given after the fields are back. */
  const focusFor = (/** @type {any} */ said) => {
    const at = said.ok ? subject : said.error === 'report-kind' ? radios[0] : said.error === 'report-subject' ? subject : said.error === 'report-body' ? body : send;
    at?.focus?.();
  };

  const update = () => {
    const busy = desk.sending;
    send.disabled = busy;
    send.textContent = sendWord();
    for (const n of [subject, body, ...radios]) n.disabled = busy;
    // a send that landed cleared the draft: the fields follow (typing keeps them equal, so this is a no-op otherwise)
    if (subject.value !== desk.draft.subject) subject.value = desk.draft.subject;
    if (body.value !== desk.draft.body) { body.value = desk.draft.body; counted(); }
    for (const r of radios) r.checked = desk.draft.kind === r.value;
    if (desk.version !== mineSeen) { mineSeen = desk.version; drawMine(); }
    // the fields given back above, THEN the focus - by the pane that says the end, wherever the send was pressed (UI-4: a
    // face rebuilt mid-send said it in the new form and left the focus on the page's body)
    const said = sayLast();
    if (said) focusFor(said);
    return said;
  };

  const sendIt = async () => {
    if (desk.sending) return;
    k.tell('');
    const going = desk.send();
    // the law's refusal is the desk's at once, said (and focused) by this first update; a send that set out, once it
    // answers - by this pane, or by whichever stands in the page then
    if (update()) return;
    await going;
    update();
  };

  desk.loadMine().catch(() => {});   // AUDIT PRIVATE-REPORT CLI-5: looked at each time the form opens - a report read or closed since says so
  update();
  return { key, root, update };
}

function inboxPane(k, key) {
  const { el, button, keyed, box: b } = k;
  const desk = b.desk;
  const which = k.keep.which === 'closed' ? 'closed' : 'open';
  const root = el('div', 'pr-pane pr-inbox');
  const tabs = el('div', 'pr-tabs');
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', t('report.tabs', 'Which reports'));
  const tab = (/** @type {string} */ w, /** @type {string} */ text) => {
    const n = keyed(button(`pr-tab${w === which ? ' on' : ''}`, text, () => { if (w !== which) k.go('inbox', { which: w, focus: `tab-${w}` }); }), `tab-${w}`);
    n.setAttribute('aria-pressed', w === which ? 'true' : 'false');
    return n;
  };
  const openTab = tab('open', t('report.tabOpen', 'Open'));   // AUDIT PRIVATE-REPORT DOC-14: the list's word, not a report's state
  tabs.append(openTab, tab('closed', t('report.tabClosed', 'Closed')));
  const list = el('div', 'pm-list');
  const foot = el('div', 'pm-foot');
  foot.append(keyed(button('pm-back', t('account.card.act.back', 'Back'), () => k.go(null, { focus: 'inbox' })), 'back'),
    keyed(button('pm-retry', t('report.again', 'Look again'), () => { desk.loadInbox(which).catch(() => {}); }), 'again'));
  // AUDIT PRIVATE-REPORT SVC-4: the next page, under the rows held - an old unopened report past the first hundred is reached
  const more = /** @type {any} */ (keyed(button('pr-more', t('report.more', 'Show older reports'), () => { desk.loadInbox(which, { more: true }).catch(() => {}); }), 'more'));
  root.append(tabs, list, more, foot);

  let sig = null;
  const update = () => {
    const n = desk.counts.open;
    openTab.textContent = n ? t('report.tabOpenCount', 'Open ({n})', { n }) : t('report.tabOpen', 'Open');
    const rows = desk.inbox[which];
    more.hidden = !(rows && desk.inboxMore[which]);
    const now = JSON.stringify([rows, desk.inboxError, desk.inboxMore[which]]);
    if (now === sig) return;   // a heartbeat's look that moved nothing here redraws nothing
    sig = now;
    // AUDIT PRIVATE-REPORT UI-7: a failed look said, rows held or not - "Look again" had failed in silence over a list
    if (desk.inboxError && rows) k.tell(k.refusal(desk.inboxError));
    const had = k.held();
    list.textContent = '';
    try { drawRows(rows); } finally { k.focus(had); }
  };
  const drawRows = (/** @type {any[]|null} */ rows) => {
    if (rows === null) { list.append(el('p', 'pm-empty', desk.inboxError ? k.refusal(desk.inboxError) : t('report.inboxLooking', 'Looking for reports...'))); return; }
    if (!rows.length) { list.append(el('p', 'pm-empty', which === 'open' ? t('report.inboxNone', 'No open reports.') : t('report.closedNone', 'No closed reports yet.'))); return; }
    for (const p of rows) {
      const row = /** @type {any} */ (keyed(el('button', `pm-row${p.read ? '' : ' unread'}`), p.id));
      row.type = 'button';
      const text = el('span', 'pm-text');
      text.append(el('span', 'pm-subject', p.subject), el('span', 'pm-from', fromLine(k, p)));
      row.append(el('span', 'pm-dot'), text);
      if (!p.read) row.append(el('span', 'pm-sr', ` - ${t('report.unread', 'unread')}`));
      if (which === 'closed') row.append(el('span', stateClass(p.state), reportStateText(p.state)));
      row.addEventListener('click', () => k.go('reading', { reportId: p.id, focus: 'back' }));
      list.append(row);
    }
  };
  desk.loadInbox(which).catch(() => {});   // a fresh look each time the inbox is opened
  update();
  return { key, root, update };
}

function readingPane(k, key) {
  const { el, button, keyed, box: b } = k;
  const desk = b.desk;
  const id = k.keep.reportId;
  const root = el('article', 'pr-pane pm-piece pr-reading');
  let failed = null;
  let sig = null;
  const update = () => {
    const now = JSON.stringify([desk.opened.get(id) ?? null, failed, desk.closing.has(id)]);
    if (now === sig) return;
    sig = now;
    const had = k.held();
    root.textContent = '';
    try { draw(); } finally { k.focus(had); }
  };
  const draw = () => {
    const back = keyed(button('pm-back', t('account.card.act.back', 'Back'), () => k.go('inbox', { which: k.keep.which, focus: id })), 'back');
    const r = desk.opened.get(id);
    if (!r) {
      root.append(el('p', 'pm-body', failed ? t('report.openFailed', 'This report could not be opened.') : t('report.opening', 'Opening...')));
      const foot = el('div', 'pm-foot');
      foot.append(back);
      if (failed) foot.append(keyed(button('pm-retry', t('menu.cloud.tryAgain', 'Try again'), () => { failed = null; load(); update(); }), 'retry'));
      root.append(foot);
      return;
    }
    root.append(el('h4', 'pm-subject', r.subject),
      el('p', 'pm-from', fromLine(k, r, reportStateText(r.state))),
      el('p', 'pm-from pr-context', t('report.sentFrom', 'Sent from {build}', { build: reportBuildText(r.context) })),
      el('p', 'pm-body', r.body));
    const acts = el('div', 'pm-foot pr-acts');
    acts.append(back);
    // AUDIT PRIVATE-REPORT UI-8: down while its close is out - a second press sent a second close
    const busy = desk.closing.has(id);
    /** AUDIT PRIVATE-REPORT UI-15: said only while this report is the one standing - a reader gone Back was told of it */
    const here = () => k.keep.view === 'reading' && k.keep.reportId === id && root.isConnected !== false;
    const close = (/** @type {string} */ state, /** @type {string} */ text) => {
      const n = /** @type {any} */ (keyed(button(['pr-close', `pr-${state}`].join(' '), text, async () => {
        k.tell('');
        const res = await desk.close(id, state);
        if (!here()) return;
        if (res.ok) k.tell(state === 'open' ? t('report.reopened', 'Opened again.') : t('report.closedAs', 'Closed: {state}.', { state: reportStateText(state) }), true);
        else if (res.error !== 'busy') k.tell(k.refusal(res.error));
        // AUDIT PRIVATE-REPORT UI-6: the pressed button is gone with its state - the pane drawn now, and the focus to the
        // first of the new ones (it had fallen to the window's Close, where a reflexive Enter shut the window)
        update();
        k.focus(res.ok ? (state === 'open' ? 'close-fixed' : 'close-open') : `close-${state}`);
      }), `close-${state}`));
      n.disabled = busy;
      return n;
    };
    if (r.state === 'open') acts.append(close('fixed', reportStateText('fixed')), close('wontfix', reportStateText('wontfix')), close('duplicate', reportStateText('duplicate')));
    else acts.append(close('open', t('report.reopen', 'Open again')));
    root.append(acts);
  };
  const load = () => {
    desk.open(id).then((r) => {
      if (r.ok) return;
      failed = r.error;
      if (k.keep.view === 'reading' && k.keep.reportId === id && root.isConnected !== false) k.tell(k.refusal(r.error));   // AUDIT PRIVATE-REPORT UI-15
      update();
    }).catch(() => { failed = 'server'; update(); });
  };
  load();
  update();
  return { key, root, update };
}
