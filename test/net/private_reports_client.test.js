// PRIVATE-REPORT (2026-10-17, Mac: "Can we add a private disclosure method for exploits/bugs with the client"): THE
// CLIENT'S SIDE - net/privateReport.js ReportDesk over the real service (a send, its rid, my list, a reader's inbox), the
// PostBox's reader count and its notice, ui/enhanced/enhancedReport.js's panes in the mailbox's window, and `/bug`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService } from '../accountDb.mjs';
import { PostBox, postNoticeText } from '../../src/net/serverPost.js';
import { ReportDesk, reportContext, mintReportRid } from '../../src/net/privateReport.js';
import { reportWordsOf, reportContextOf, REPORT_RID_RE, REPORT_INBOX_MAX } from '../../src/net/reportLaw.js';
import { postWindow } from '../../src/ui/enhanced/enhancedPost.js';
import { myReportStateText, reportBuildText } from '../../src/ui/enhanced/enhancedReport.js';
import { HELP_LINES, HOST_COMMANDS, mailboxCommandOf, parseChatLine } from '../../src/net/chatCommands.js';
import { ENHANCED_CSS } from '../../src/ui/enhanced/enhancedStyle.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ioFor = (svc, who, fetch = (u, i) => svc.fetch(u, i)) => () => (who ? { fetch, base: 'https://accounts.invalid', secret: who.secret, storage: null } : null);
const words = { kind: 'exploit', subject: 'Gold doubles at the bank', body: 'Deposit, then cancel the window twice.' };

test('PRIVATE-REPORT the desk: words the law refuses are never asked; a lost answer asked again is the same report (its rid kept), however the raw text was touched - a change of the kind or the words a new one; one send at a time; sent, the draft cleared (unless it changed while it went), its end kept for the pane and my list looked at - a look asked while one is out followed by one more; the context what the form says and nothing else (mutants: the rid minted each send; the rid kept past a changed kind; the rid keyed to the raw text; the draft cleared of words typed mid-send; the look folded into the one out)', async () => {
  const svc = await standService();
  const ann = await svc.registered('Ann');
  let asked = 0;
  let lose = 0;
  const looks = [];
  const fetch = async (u, i) => { asked++; looks.push(new URL(u).pathname); const res = await svc.fetch(u, i); if (lose > 0) { lose--; throw new Error('the answer was lost'); } return res; };
  const desk = new ReportDesk({ ioOf: ioFor(svc, ann, fetch) });
  const landed = () => svc.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM private_reports').get().n;

  desk.setDraft({ kind: 'exploit', subject: 'ab', body: words.body });
  assert.deepEqual(await desk.send(), { ok: false, error: 'report-subject' });
  assert.equal(asked, 0, 'refused by the law, never asked');
  assert.deepEqual(desk.lastSend, { ok: false, error: 'report-subject' }, 'a refusal kept for the pane too');

  desk.setDraft(words);
  lose = 1;
  const lost = await desk.send();
  assert.equal(lost.ok, false, 'the answer never came');
  assert.equal(landed(), 1, 'but the report landed');
  const again = await desk.send();
  assert.deepEqual([again.ok, again.repeat], [true, true], 'asked again under its rid: the report it made');
  assert.equal(landed(), 1, 'once');
  assert.deepEqual(desk.lastSend, again, 'its end kept for whichever pane stands (AUDIT PRIVATE-REPORT UI-4)');
  assert.deepEqual(desk.draft, { kind: null, subject: '', body: '' }, 'sent, the form is empty');
  await desk.loadMine();
  assert.deepEqual(desk.mine.map((p) => [p.subject, p.state, p.read]), [[words.subject, 'open', false]]);
  assert.equal(myReportStateText(desk.mine[0]), 'Sent');

  // AUDIT PRIVATE-REPORT CLI-8: the rid is the CLEANED words' - a space or a blank line touched after a lost answer is the
  // same report, never a second
  desk.setDraft(words);
  lose = 1;
  assert.equal((await desk.send()).ok, false);
  desk.setDraft({ subject: `  ${words.subject} `, body: `${words.body}\n\n` });
  const touched = await desk.send();
  assert.deepEqual([touched.ok, touched.repeat], [true, true], 'the same words cleaned: the report it made');
  assert.equal(landed(), 2);
  await desk.loadMine();   // the send's own look home before an answer is lost again

  // TEST-6: and a change of the KIND after a lost answer is a new send - never answered with the old one's report
  desk.setDraft(words);
  lose = 1;
  assert.equal((await desk.send()).ok, false);
  desk.setDraft({ kind: 'bug' });
  const changed = await desk.send();
  assert.deepEqual([changed.ok, changed.repeat], [true, false], 'a new report for a new kind');
  assert.equal(landed(), 4);

  // CLI-9: words typed while a send is out are kept; a second press while it is out is no second send
  desk.setDraft({ kind: 'bug', subject: 'The lift sticks at the top', body: 'Ride it up twice and it stays.' });
  const going = desk.send();
  assert.deepEqual(await desk.send(), { ok: false, error: 'busy' });
  desk.setDraft({ body: 'Ride it up twice and it stays there for good.' });
  assert.equal((await going).ok, true);
  assert.deepEqual(desk.draft, { kind: 'bug', subject: 'The lift sticks at the top', body: 'Ride it up twice and it stays there for good.' }, 'never emptied of what the player typed after');
  assert.equal(landed(), 5);

  // CLI-3: looks asked while one is out wait on it and on ONE more after it - never answered by the look already out
  await desk.loadMine();
  const before = looks.filter((p) => p === '/v1/report/mine').length;
  const a = desk.loadMine(), b = desk.loadMine(), c = desk.loadMine();
  assert.equal(a, b, 'the look out');
  await Promise.all([a, b, c]);
  assert.equal(looks.filter((p) => p === '/v1/report/mine').length - before, 2, 'and one more after it - never three');

  assert.match(mintReportRid(), REPORT_RID_RE);
  assert.notEqual(mintReportRid(), mintReportRid());
  assert.deepEqual(reportContext({ update: '0.0.412', build: 'd9187c3049cb', desktop: true }), { update: '0.0.412', build: 'd9187c3049cb', app: 'desktop' });
  assert.deepEqual(reportContext({ update: null, build: 'dev', desktop: false }), { app: 'browser' }, 'a dev build sends what it knows');
  assert.equal(reportBuildText({ update: '0.0.412', build: 'd9187c3049cb', app: 'desktop' }), 'DFO Online 0.0.412 (d9187c3049cb) desktop app');
  assert.equal(reportBuildText(null), 'an unknown build');
  assert.deepEqual(reportContextOf({ app: 'phone', build: 'XYZ', update: 'a b' }), null);
  assert.deepEqual(reportWordsOf({ kind: 'bug', subject: ' A\n title ', body: ' Ten chars!\r\n ' }), { kind: 'bug', subject: 'A title', body: 'Ten chars!' });
});

test('PRIVATE-REPORT A READER\'S BOX: the service\'s count rides the box and the envelope counts the unopened; a rise said on the world tab, never what the reports say - and said on a sitting\'s first look; a report opened is off the envelope at once, and a new one after it said; nobody else\'s box carries a count (mutants: the envelope blind to reports; the rise never said; the first look silent; a fall said; the desk\'s counts never the envelope\'s; a report opened still counted)', async () => {
  const svc = await standService({ REPORT_READER_HANDLES: 'Mac' });
  const ann = await svc.registered('Ann'), mac = await svc.registered('Mac');
  const said = [];
  const box = new PostBox({ ioOf: ioFor(svc, mac), onPost: (e) => said.push(e) });
  await box.refresh();
  assert.deepEqual([box.reports, box.waiting, said.length], [{ unread: 0, open: 0 }, 0, 0], 'a reader, nothing waiting');
  const annDesk = new ReportDesk({ ioOf: ioFor(svc, ann) });
  annDesk.setDraft({ ...words, subject: 'The secret dupe' });
  assert.equal((await annDesk.send()).ok, true);
  await box.refresh();
  assert.deepEqual([box.reports, box.waiting], [{ unread: 1, open: 1 }, 1], 'the envelope counts it');
  assert.deepEqual(said, [{ kind: 'reports', unread: 1 }]);
  const line = postNoticeText(said[0]);
  // AUDIT PRIVATE-REPORT CLI-6 DOC-3 UI-9: `/bug` is the form - the inbox is the mailbox's door
  assert.equal(line, '1 private report is waiting to be read. Type /mail, or open the mailbox beside the hourglass, then click Private reports.');
  assert.ok(!line.includes('secret dupe'), 'never its words');
  await box.refresh();
  assert.equal(said.length, 1, 'a count that did not rise says nothing');

  // TEST-13: another sitting's first look says what waits
  const said2 = [];
  const box2 = new PostBox({ ioOf: ioFor(svc, mac), onPost: (e) => said2.push(e) });
  await box2.refresh();
  assert.deepEqual(said2, [{ kind: 'reports', unread: 1 }], 'a first look with one waiting says it');

  // AUDIT PRIVATE-REPORT CLI-2: opened, off the envelope NOW - not at the next look three minutes on
  const v = box.version;
  await box.desk.loadInbox('open');
  await box.desk.open(box.desk.inbox.open[0].id);
  assert.deepEqual([box.reports.unread, box.waiting], [0, 0], 'the envelope follows the desk');
  assert.ok(box.version > v, 'the window repaints on it');
  // ...and the next look's rise is measured from that: a new report after the only unread one was read is said
  annDesk.setDraft({ ...words, subject: 'A second hole' });
  assert.equal((await annDesk.send()).ok, true);
  await box.refresh();
  assert.equal(said.length, 2);
  assert.deepEqual(said[1], { kind: 'reports', unread: 1 }, 'a rise from nought');
  // TEST-13: only a rise is said - one read at another sitting is a fall, and says nothing here
  annDesk.setDraft({ ...words, subject: 'A third hole' });
  assert.equal((await annDesk.send()).ok, true);
  await box.refresh();
  assert.deepEqual([said.length, box.reports.unread], [3, 2]);
  await box2.desk.loadInbox('open');
  await box2.desk.open(box2.desk.inbox.open.find((p) => !p.read).id);
  await box.refresh();
  assert.deepEqual([said.length, box.reports.unread], [3, 1], 'a fall is never said');

  const annBox = new PostBox({ ioOf: ioFor(svc, ann), onPost: (e) => said.push(e) });
  await annBox.refresh();
  assert.equal(annBox.reports, null, 'a reporter is no reader');
  assert.equal(postNoticeText({ kind: 'reports', unread: 3 }), '3 private reports are waiting to be read. Type /mail, or open the mailbox beside the hourglass, then click Private reports.');
});

// ── the window ───────────────────────────────────────────────────────

/** A document whose nodes know focus, attributes and containment (serverpost_client.test.js's own) - and, as a browser's,
 *  a disabled control takes no focus (AUDIT PRIVATE-REPORT UI-3: the focus given to a field still disabled went nowhere). */
function focusDoc() {
  const doc = { activeElement: null };
  const node = (tag) => {
    const n = { tag, children: [], className: '', attrs: {}, style: {}, listeners: {}, title: '', type: '', disabled: false, isConnected: true, parent: null, value: '', checked: false,
      append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } }, setAttribute(k, v) { n.attrs[k] = v; }, getAttribute(k) { return n.attrs[k] ?? null; },
      addEventListener(t, f) { (n.listeners[t] ??= []).push(f); }, focus() { if (!n.disabled) doc.activeElement = n; },
      contains(o) { for (let c = o; c; c = c.parent) if (c === n) return true; return false; },
      querySelector(sel) {
        const k = /^\[data-key="(.*)"\]$/.exec(sel)?.[1];
        let hit = null;
        walk(n, (c) => { if (hit || c === n) return; if (k != null ? c.attrs['data-key'] === k : String(c.className).split(' ').includes(sel.slice(1))) hit = c; });
        return hit;
      },
      classList: { toggle(c, on) { const cs = new Set(String(n.className).split(' ').filter(Boolean)); if (on) cs.add(c); else cs.delete(c); n.className = [...cs].join(' '); } } };
    Object.defineProperty(n, 'textContent', { get() { return n._t ?? ''; }, set(v) { n._t = v; if (v === '') n.children = []; } });
    return n;
  };
  doc.createElement = node;
  return doc;
}
const walk = (n, f) => { f(n); for (const c of n.children ?? []) walk(c, f); };
const all = (root, cls) => { const out = []; walk(root, (n) => { if (String(n.className).split(' ').includes(cls)) out.push(n); }); return out; };
const byKey = (root, key) => { let hit = null; walk(root, (n) => { if (!hit && n.attrs?.['data-key'] === key) hit = n; }); return hit; };
const text = (n) => { let t = n._t ?? ''; for (const c of n.children ?? []) t += text(c); return t; };
const settle = () => new Promise((r) => setTimeout(r, 0));
const click = async (n) => { n.listeners.click[0](); await settle(); };
/** Wait for what the service's answer moves - a fake service answers over many turns of the loop. */
const until = async (f) => { for (let i = 0; i < 500 && !f(); i++) await settle(); assert.ok(f(), 'it came'); };

test('PRIVATE-REPORT THE FORM IN THE MAILBOX: a door under the post; the form - three kinds, a title, the words and what is sent with them; typed into, the desk holds it, counted in characters; a box that moves while the player types never rebuilds the form; sent, a thank-you, the form empty, the focus on the title and the report in my list as Sent; a refusal said and the field it names given the focus; Back to the post; a face rebuilt mid-send has the pane standing say how it ended; opened on the form, the focus on the draft\'s kind - and a focus already in the window kept (mutants: the form rebuilt on every draw; the doors gone; the counter in UTF-16 units; the focus left on the page\'s body after a send; the old pane saying the send; the landing taking the focus from a field; the landing on the first kind whatever the draft; my list looked at once a sitting)', async () => {
  const svc = await standService();
  const ann = await svc.registered('Ann');
  const box = new PostBox({ ioOf: ioFor(svc, ann) });
  await box.refresh();
  const doc = focusDoc();
  const keep = {};
  const w = postWindow(/** @type {any} */ (doc), { box: () => box, onClose() {}, every: 1e9, keep });
  w.stop();
  const door = byKey(w.root, 'report');
  assert.ok(door, 'the door under the post');
  assert.equal(door.attrs['data-focus'], 'pm-report', 'a key the pause face\'s repaint finds it by (AUDIT PRIVATE-REPORT UI-1)');
  assert.equal(byKey(w.root, 'inbox'), null, 'no inbox for a reporter');
  await click(door);
  assert.equal(keep.view, 'report');
  assert.equal(all(w.root, 'pm-title')[0].textContent, 'Report privately');
  assert.equal(doc.activeElement, byKey(w.root, 'kind-exploit'), 'the focus on the first choice');
  assert.deepEqual(all(w.root, 'pr-kindname').map((n) => n.textContent), ['An exploit', 'A bug', 'Account or server security']);
  assert.match(text(all(w.root, 'pr-sends')[0]), /^Sent with it: your username and this game's build \(DFO Online/);

  const subject = byKey(w.root, 'subject'), body = byKey(w.root, 'body');
  assert.equal(body.attrs['aria-describedby'], 'pr-count', 'the count describes the field, never names it (AUDIT PRIVATE-REPORT UI-11)');
  // AUDIT PRIVATE-REPORT SVC-1: counted as the law counts - an emoji is one character, not two
  body.value = '😀'.repeat(12); body.listeners.input[0]();
  assert.equal(all(w.root, 'pr-count')[0].textContent, '12 / 3000');
  subject.value = 'ab'; subject.listeners.input[0]();
  body.value = 'too short'; body.listeners.input[0]();
  // a heartbeat's look while the player types: the same form, the same fields
  box.version++;
  w.draw();
  assert.equal(byKey(w.root, 'subject'), subject, 'never rebuilt under the hands typing in it');
  await click(byKey(w.root, 'send'));
  assert.equal(all(w.root, 'pm-say')[0].textContent, 'Choose what kind of problem this is.');
  assert.equal(doc.activeElement, byKey(w.root, 'kind-exploit'), 'the focus where the fault is');
  const exploit = byKey(w.root, 'kind-exploit');
  exploit.checked = true; exploit.listeners.change[0]();
  await click(byKey(w.root, 'send'));
  assert.equal(all(w.root, 'pm-say')[0].textContent, 'Give the report a short title, 3 to 80 characters.');
  assert.equal(doc.activeElement, subject);
  subject.value = words.subject; subject.listeners.input[0]();
  await click(byKey(w.root, 'send'));
  assert.equal(all(w.root, 'pm-say')[0].textContent, 'Describe the problem in 10 to 3,000 characters: what happens, and the steps that make it happen.');
  assert.equal(doc.activeElement, body, 'the words, where the words are short (AUDIT PRIVATE-REPORT TEST-17)');
  body.value = words.body; body.listeners.input[0]();
  await click(byKey(w.root, 'send'));
  await until(() => box.desk.mine?.length === 1 && !box.desk.sending);
  w.draw();
  assert.equal(all(w.root, 'pm-say')[0].textContent, 'Sent. Thank you. Only the developers can read it.');
  assert.deepEqual([subject.value, body.value, exploit.checked], ['', '', false], 'the form empty for the next');
  // AUDIT PRIVATE-REPORT UI-3: the fields given back first, then the focus - never left on the page's body
  assert.equal(doc.activeElement, subject, 'the focus on the title, for the next');
  assert.deepEqual(all(w.root, 'pr-mrow').map((n) => text(n)), [`${words.subject}Exploit - ${new Date(box.desk.mine[0].sentAt * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}Sent`]);
  await click(byKey(w.root, 'back'));
  assert.deepEqual([keep.view, all(w.root, 'pm-title')[0].textContent], [null, 'Mailbox']);
  assert.equal(doc.activeElement, byKey(w.root, 'report'), 'Back: the focus on the door it came from');

  // AUDIT PRIVATE-REPORT UI-4: the face rebuilt while a send is out - the pane standing when it lands says how it ended
  svc.env.DB._raw.prepare('UPDATE private_reports SET read_at = 1').run();   // read by a developer meanwhile
  await click(byKey(w.root, 'report'));
  await until(() => box.desk.mine?.[0]?.read === true);   // AUDIT PRIVATE-REPORT CLI-5: looked at each time the form opens
  box.desk.setDraft({ kind: 'bug', subject: 'The lift sticks at the top', body: 'Ride it up twice and it stays.' });
  byKey(w.root, 'send').listeners.click[0]();
  all(w.root, 'pr-compose')[0].isConnected = false;
  const doc2 = focusDoc();
  const w2 = postWindow(/** @type {any} */ (doc2), { box: () => box, onClose() {}, every: 1e9, keep });
  w2.stop();
  await until(() => !box.desk.sending && box.desk.mine?.length === 2);
  w2.draw();
  assert.equal(all(w2.root, 'pm-say')[0].textContent, 'Sent. Thank you. Only the developers can read it.', 'said where the player is');
  assert.equal(doc2.activeElement, byKey(w2.root, 'subject'), 'and the focus given there - never left on the page\'s body');
  assert.equal(all(w.root, 'pm-say')[0].textContent, '', 'never to the window gone');
  assert.equal(box.desk.lastSend, null, 'said once');

  // AUDIT PRIVATE-REPORT UI-14 UI-1: opened on the form (`/bug`), the focus on the draft's own kind; a focus already in the
  // window - a face rebuilt mid-typing gives the field back its focus - stays where the player left it
  const frames = [];
  globalThis.requestAnimationFrame = (f) => frames.push(f);
  try {
    box.desk.setDraft({ kind: 'security' });
    const doc3 = focusDoc();
    const w3 = postWindow(/** @type {any} */ (doc3), { box: () => box, onClose() {}, every: 1e9, keep: { view: 'report' } });
    w3.stop();
    for (const f of frames.splice(0)) f();
    assert.equal(doc3.activeElement, byKey(w3.root, 'kind-security'));
    const doc4 = focusDoc();
    const w4 = postWindow(/** @type {any} */ (doc4), { box: () => box, onClose() {}, every: 1e9, keep: { view: 'report' } });
    w4.stop();
    byKey(w4.root, 'body').focus();
    for (const f of frames.splice(0)) f();
    assert.equal(doc4.activeElement, byKey(w4.root, 'body'), 'the caret where the player left it');
  } finally { delete globalThis.requestAnimationFrame; }

  // a guest is told why, and shown no form
  const g = await svc.guest();
  const guestBox = new PostBox({ ioOf: ioFor(svc, { secret: g.secret }) });
  await guestBox.refresh();
  const gw = postWindow(/** @type {any} */ (focusDoc()), { box: () => guestBox, onClose() {}, every: 1e9, keep: { view: 'report' } });
  gw.stop();
  assert.equal(byKey(gw.root, 'subject'), null);
  assert.match(text(gw.root), /Private reports need a username and a password/);
});

test('PRIVATE-REPORT THE READER\'S INBOX IN THE MAILBOX: a door that counts the unopened, and the focus into the pane; the open list, unopened first, with who sent each, its tab counting it; one opened - its words, the build it came from - and the reporter told it was read; the three closes; closed as fixed, the focus on Open again; the reporter\'s list says Fixed (mutants: the inbox door for everyone; the close never asked; read never said to the reporter; the focus to the window\'s Close; a second close while one is out; the closed list never looked at again; the counts never taken from the inbox)', async () => {
  const svc = await standService({ REPORT_READER_HANDLES: 'Mac' });
  const ann = await svc.registered('Ann'), mac = await svc.registered('Mac');
  const annDesk = new ReportDesk({ ioOf: ioFor(svc, ann), context: () => ({ update: '0.0.412', build: 'd9187c3049cb', app: 'browser' }) });
  annDesk.setDraft({ ...words, kind: 'security', subject: 'Tokens never expire' });
  assert.equal((await annDesk.send()).ok, true);
  const box = new PostBox({ ioOf: ioFor(svc, mac) });
  await box.refresh();
  const doc = focusDoc();
  const keep = {};
  const w = postWindow(/** @type {any} */ (doc), { box: () => box, onClose() {}, every: 1e9, keep });
  w.stop();
  const door = byKey(w.root, 'inbox');
  assert.equal(door.textContent, 'Private reports (1 new)');
  await click(door);
  assert.equal(doc.activeElement, byKey(w.root, 'tab-open'), 'into the pane, never to the window\'s Close (AUDIT PRIVATE-REPORT UI-6)');
  await until(() => box.desk.inbox.open !== null);
  w.draw();
  assert.equal(all(w.root, 'pm-title')[0].textContent, 'Private reports');
  assert.equal(byKey(w.root, 'tab-open').textContent, 'Open (1)', 'the list\'s word, and its count (AUDIT PRIVATE-REPORT DOC-14)');
  assert.equal(byKey(w.root, 'more').hidden, true, 'no older page');
  const rows = all(w.root, 'pm-row');
  assert.equal(rows.length, 1);
  assert.equal(text(rows[0]).startsWith('Tokens never expireSecurity - from Ann - '), true);
  assert.ok(rows[0].className.includes('unread'));
  await click(rows[0]);
  await until(() => box.desk.opened.size === 1);
  w.draw();
  assert.equal(all(w.root, 'pm-body')[0].textContent, words.body);
  assert.equal(all(w.root, 'pr-context')[0].textContent, 'Sent from DFO Online 0.0.412 (d9187c3049cb) in a browser');
  await annDesk.loadMine();
  assert.equal(myReportStateText(annDesk.mine[0]), 'Read by the developers', 'the reporter\'s one sign it was seen (AUDIT PRIVATE-REPORT TEST-12)');
  assert.deepEqual(['close-fixed', 'close-wontfix', 'close-duplicate'].map((k) => byKey(w.root, k)?.textContent), ['Fixed', 'Won\'t fix', 'Duplicate']);
  const id = rows[0].attrs['data-key'];
  await box.desk.loadInbox('closed');
  assert.deepEqual(box.desk.inbox.closed, [], 'nothing closed yet');
  byKey(w.root, 'close-fixed').listeners.click[0]();
  w.draw();
  assert.equal(byKey(w.root, 'close-wontfix').disabled, true, 'every close down while one is out (AUDIT PRIVATE-REPORT UI-8)');
  assert.deepEqual(await box.desk.close(id, 'wontfix'), { ok: false, error: 'busy' }, 'and a second press no second close');
  await until(() => box.desk.opened.get(id)?.state === 'fixed' && box.desk.inbox.open?.length === 0 && box.desk.closing.size === 0);
  await until(() => all(w.root, 'pm-say')[0].textContent !== '');
  w.draw();
  assert.equal(all(w.root, 'pm-say')[0].textContent, 'Closed: Fixed.');
  assert.ok(byKey(w.root, 'close-open'), 'and it may be opened again');
  assert.equal(doc.activeElement, byKey(w.root, 'close-open'), 'the focus on what stands in the pressed button\'s place (AUDIT PRIVATE-REPORT UI-6)');
  await until(() => box.desk.inbox.closed?.length === 1);   // AUDIT PRIVATE-REPORT TEST-14: the closed list looked at again too
  await annDesk.loadMine();
  assert.equal(myReportStateText(annDesk.mine[0]), 'Fixed', 'the reporter sees it fixed');
  await click(byKey(w.root, 'back'));
  w.draw();
  assert.equal(byKey(w.root, 'tab-open').textContent, 'Open', 'none open: the list\'s word alone');
});

test('PRIVATE-REPORT A PAGE AT A TIME (AUDIT PRIVATE-REPORT SVC-4): past a hundred open reports the inbox offers "Show older reports", which adds the next page under the rows held - none twice - and goes when none follows and a look that fails over them is said (mutants: the next page in place of the first; the button never shown; a failed look silent over a list)', async () => {
  const svc = await standService({ REPORT_READER_HANDLES: 'Mac' });
  const ann = await svc.registered('Ann'), mac = await svc.registered('Mac');
  const put = svc.env.DB._raw.prepare('INSERT INTO private_reports (id, from_id, rid, kind, subject, body, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (let i = 0; i <= REPORT_INBOX_MAX; i++) put.run(`laidreport${String(i).padStart(6, '0')}`, ann.id, `laid-${i}`, 'bug', `Report number ${i}`, words.body, 1000 + i);
  let down = false;
  const box = new PostBox({ ioOf: ioFor(svc, mac, (u, i) => (down ? Promise.reject(new Error('the service is down')) : svc.fetch(u, i))) });
  await box.refresh();
  const w = postWindow(/** @type {any} */ (focusDoc()), { box: () => box, onClose() {}, every: 1e9, keep: { view: 'inbox', which: 'open' } });
  w.stop();
  await until(() => box.desk.inbox.open !== null);
  w.draw();
  assert.equal(all(w.root, 'pm-row').length, REPORT_INBOX_MAX);
  const more = byKey(w.root, 'more');
  assert.deepEqual([more.hidden, more.textContent], [false, 'Show older reports']);
  await click(more);
  await until(() => box.desk.inbox.open.length > REPORT_INBOX_MAX);
  w.draw();
  const ids = all(w.root, 'pm-row').map((n) => n.attrs['data-key']);
  assert.equal(ids.length, REPORT_INBOX_MAX + 1, 'the oldest reached');
  assert.equal(new Set(ids).size, ids.length, 'none twice');
  assert.equal(ids.at(-1), 'laidreport000000', 'the oldest last');
  assert.equal(byKey(w.root, 'more').hidden, true, 'none older');
  // AUDIT PRIVATE-REPORT UI-7: "Look again" that fails over a list held says so - the rows stay
  down = true;
  await click(byKey(w.root, 'again'));
  await until(() => box.desk.inboxError !== null);
  w.draw();
  assert.notEqual(all(w.root, 'pm-say')[0].textContent, '', 'said');
  assert.equal(all(w.root, 'pm-row').length, REPORT_INBOX_MAX + 1, 'and the list kept');
});

test('PRIVATE-REPORT THE DESK IS ONE ACCOUNT\'S (AUDIT PRIVATE-REPORT CLI-1 TEST-4): another account on the same sitting - the pause face signs out and in - finds no draft, no list, no inbox and no opened report of the last one\'s, and no reader\'s count; a look set out under one account and answered under another is never taken, nor an older look answering after a newer; a reader taken off the list drops what only a reader may hold (mutants: the desk kept past a switch, by the box and by itself; an answer for a session gone taken, by the desk and by the box; the newest look overwritten by an older; the inbox kept past not-report-reader)', async () => {
  const svc = await standService({ REPORT_READER_HANDLES: 'Mac' });
  const ann = await svc.registered('Ann'), mac = await svc.registered('Mac');
  const annDesk = new ReportDesk({ ioOf: ioFor(svc, ann) });
  annDesk.setDraft(words);
  assert.equal((await annDesk.send()).ok, true);
  let who = mac;
  const gates = [];
  let answered = 0;
  const fetch = async (u, i) => { const gate = gates.shift(); const res = await svc.fetch(u, i); answered++; if (gate) await gate; return res; };
  const box = new PostBox({ ioOf: () => ioFor(svc, who, fetch)() });
  await box.refresh();
  await box.desk.loadInbox('open');
  const id = box.desk.inbox.open[0].id;
  assert.equal((await box.desk.open(id)).ok, true);
  box.desk.setDraft({ subject: 'Half written by Mac' });
  await box.desk.loadMine();
  assert.deepEqual([box.reports?.open, box.desk.opened.size, box.desk.mine.length, box.desk.draft.subject], [1, 1, 0, 'Half written by Mac']);

  who = ann;   // signed out, and Ann in
  await box.refresh();
  assert.equal(box.reports, null, 'no reader\'s count for an account that reads nothing');
  assert.deepEqual([box.desk.draft.subject, box.desk.mine, box.desk.inbox.open, box.desk.opened.size], ['', null, null, 0], 'nothing of the last account\'s');
  await box.desk.loadMine();
  assert.deepEqual(box.desk.mine.map((p) => p.subject), [words.subject], 'her own list');

  // the box's look set out under Mac and answered under Ann: never taken
  who = mac;
  const lateLook = box.refresh();
  who = ann;
  assert.deepEqual(await lateLook, { ok: false, error: 'stale' });
  assert.equal(box.reports, null, 'Mac\'s count never on Ann\'s envelope');

  // a desk with no box knows it too: its own look under another account clears it first
  let deskWho = mac;
  const bare = new ReportDesk({ ioOf: () => ioFor(svc, deskWho)() });
  bare.setDraft({ subject: 'Half written by Mac' });
  await bare.loadMine();
  deskWho = ann;
  await bare.loadMine();
  assert.deepEqual([bare.draft.subject, bare.mine.map((p) => p.subject)], ['', [words.subject]]);

  // a look set out under Mac, answered after Ann signed in again: nobody's
  who = mac;
  await box.refresh();
  const late = box.desk.loadInbox('open');
  who = ann;
  assert.deepEqual(await late, { ok: false, error: 'stale' });
  assert.equal(box.desk.inbox.open, null, 'Mac\'s inbox never drawn for Ann');
  who = mac;

  // AUDIT PRIVATE-REPORT CLI-4: an older look answering after a newer one is never taken
  let release = () => {};
  gates.push(new Promise((r) => { release = r; }));
  const n0 = answered;
  const older = box.desk.loadInbox('open');
  await until(() => answered === n0 + 1);   // answered by the service - one open report - and held on the way back
  svc.env.DB._raw.prepare("UPDATE private_reports SET state = 'fixed', closed_at = 1").run();
  assert.equal((await box.desk.loadInbox('open')).ok, true);
  release();
  assert.deepEqual(await older, { ok: false, error: 'stale' });
  assert.deepEqual(box.desk.inbox.open, [], 'the newer list stands');

  // a reader taken off the list: what only a reader may hold goes at the refusal
  svc.env.DB._raw.prepare("UPDATE private_reports SET state = 'open', closed_at = NULL").run();
  await box.desk.loadInbox('open');
  assert.equal((await box.desk.open(id)).ok, true);
  assert.deepEqual([box.desk.inbox.open.length, box.desk.opened.size], [1, 1]);
  svc.env.REPORT_READER_HANDLES = '';
  assert.deepEqual(await box.desk.loadInbox('open'), { ok: false, error: 'not-report-reader' });
  assert.deepEqual([box.desk.inbox.open, box.desk.opened.size, box.desk.counts], [null, 0, { unread: 0, open: 0 }]);
});

test('PRIVATE-REPORT the doors: `/bug` the form and `/mail` the mailbox, on either skin and wherever the player stands - the host asks chatCommands.js, the pause door opens the enhanced face at `report`, the menu lands on the form; /help says it; the sheet styles the form; Escape leaves the window from a field, and a held key types (mutants: /bug read as the mailbox; the classic skin without a way in; Escape kept by the field; the repeat eaten in a field)', () => {
  assert.equal(mailboxCommandOf('/bug'), 'report');
  assert.equal(mailboxCommandOf(' /BUG '), 'report');
  assert.equal(mailboxCommandOf('/mail'), 'mailbox');
  assert.equal(mailboxCommandOf('/mailbox'), 'mailbox');
  assert.equal(mailboxCommandOf('/bug x'), null);
  assert.equal(mailboxCommandOf('/bugs'), null);
  // `/report` is CHAT SAFETY's (SAFE3: a player's lines to the moderators) - never this form's, bare or with a name
  assert.equal(mailboxCommandOf('/report'), null);
  assert.equal(mailboxCommandOf('/report Bob harassment'), null);
  assert.ok(HOST_COMMANDS.includes('bug'));
  assert.deepEqual(parseChatLine('/bug'), { kind: 'host', name: 'bug' }, 'never said to the room');
  assert.ok(HELP_LINES.some((l) => l.startsWith('/bug - ')), '/help says it');
  const world = src('src/scenes/world.js');
  assert.match(world, /import \{ breachCommandOf, helpLines, mailboxCommandOf \} from '\.\.\/net\/chatCommands\.js';/);
  assert.match(world, /\{ const at = mailboxCommandOf\(text\); if \(at\) \{/);
  const door = src('src/ui/pauseDoor.js');
  assert.match(door, /if \(\(hooks\.at === 'mailbox' \|\| hooks\.at === 'report'\) && typeof document !== 'undefined'\) return enhancedPauseOverlay\(show, hooks\);/);
  const menu = src('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /else if \(at === 'report'\) \{ postOpen = true; postKeep = \{ view: 'report' \}; \}/);
  // AUDIT PRIVATE-REPORT UI-2: Escape in the mailbox's fields leaves the window; UI-10: a held key in a field is the field's
  assert.match(menu, /if \(t && \(t\.tagName === 'INPUT' \|\| t\.tagName === 'TEXTAREA' \|\| t\.isContentEditable\) && !\(e\.key === 'Escape' && t\.closest\?\.\('\.px-postwin'\)\)\) return;/);
  assert.match(door, /if \(e\.repeat && \(e\.key === 'Enter' \|\| e\.key === ' '\) && !isTextEntryTarget\(e\.target\)\) \{/);
  for (const rule of ['.px-postwin .pr-field textarea', '.px-postwin .pr-kind input:focus-visible', '.px-postwin .pm-doors',
    '.px-postwin .pr-field textarea::placeholder, .px-postwin .pr-field input::placeholder { color: var(--dim); }', '.px-postwin .pr-more[hidden] { display: none; }']) assert.ok(ENHANCED_CSS.includes(rule), rule);
});
