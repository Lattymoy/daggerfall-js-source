// STAFF-CHAT-RED (2026-10-23, mob, a game admin: "give me a option next to chat to chat as /red or myself at all times").
// The switch beside the chat's field, Me or Red: an Admin's alone (the dev glyph, the relay's own test for /red), kept
// across reloads, Red sending each line as "/red <line>" would and a command as typed, and Me while hidden asking first
// and then asking the Staff Panel to turn Hide off. Its mutants are tools/mutants/staff-chat-red.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChatLog } from '../../src/net/chat.js';
import { createChatPanel } from '../../src/ui/chatPanel.js';
import { createChatVoice, VOICE_PREF, VOICE_ASK_MS, voiceAskText, voiceShownText, voiceOpenPanelText, voiceHiddenText } from '../../src/net/chatVoice.js';
import { staffShowMe, STAFF_TOKEN_WAIT_MS } from '../../src/net/staffHook.js';
import { createChatSafetyHost } from '../../src/scenes/chatSafetyHost.js';
import { accountTokenMinter, SESSION_KEY, SERVICE_KEY } from '../../src/net/accountClient.js';
import { PUBLIC_TABS } from '../../src/net/safety/chatStamp.js';
import { STAFF_TAB } from '../../src/net/staffChat.js';
import { PREF_DEFAULTS, getPref, setPref, _resetForTests } from '../../src/systems/uiPrefs.js';

const rd = (f) => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');

// the device's storage, so a pref kept is a pref read back after a reload (uiPrefs reads globalThis.localStorage)
const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const fresh = () => { mem.clear(); _resetForTests(); };
const shelf = () => JSON.parse(mem.get('dagger.ui.v1') ?? '{}');

/** A voice over glyphs, its lines said and its Show myself asks counted. */
function rig({ glyphs = ['dev'], show = true } = {}) {
  let clock = 1_000_000;
  const said = [], sent = [], shows = [];
  const voice = createChatVoice({
    glyphs: () => glyphs, say: (tab, text) => said.push([tab, text]), now: () => clock,
    showMe: () => { const p = typeof show === 'function' ? show() : Promise.resolve(show); shows.push(p); return p; },
  });
  const onSend = (tab, text) => { sent.push([tab, text]); return true; };
  return { voice, said, sent, shows, onSend, tick: (ms) => { clock += ms; } };
}
const settle = () => new Promise((r) => setImmediate(r));

test('STAFF-CHAT-RED THE VOICE: an Admin\'s alone - the dev glyph, on the tabs every player reads; Red sends each line as "/red <line>" would, a command as typed, and every other tab and every other player\'s line as typed (mutants: shown without the dev glyph; shown on the Party tab; Red not wrapped; a command wrapped; the Staff tab wrapped)', () => {
  fresh();
  const r = rig();
  assert.equal(PREF_DEFAULTS[VOICE_PREF], 'me', 'Me until the Admin picks Red');
  assert.equal(r.voice.mode(), 'me');
  for (const tab of PUBLIC_TABS) assert.equal(r.voice.shown(tab), true, tab);
  for (const tab of ['party', 'guild', 'local', STAFF_TAB]) assert.equal(r.voice.shown(tab), false, `${tab}: a red line reaches everyone, so no switch here`);
  assert.equal(r.voice.send('world', 'hello all', r.onSend), true);
  r.voice.pick('red', 'world');
  assert.equal(r.voice.mode(), 'red');
  assert.equal(r.voice.send('world', '  the server restarts at noon  ', r.onSend), true);
  assert.equal(r.voice.send('region', 'and here', r.onSend), true);
  assert.equal(r.voice.send('world', '/w Bran psst', r.onSend), true);
  assert.equal(r.voice.send('world', '  /help', r.onSend), true);
  assert.equal(r.voice.send('party', 'party line', r.onSend), true);
  assert.equal(r.voice.send(STAFF_TAB, 'to the staff', r.onSend), true);
  assert.deepEqual(r.sent, [
    ['world', 'hello all'],
    ['world', '/red the server restarts at noon'],
    ['region', '/red and here'],
    ['world', '/w Bran psst'],
    ['world', '  /help'],
    ['party', 'party line'],
    [STAFF_TAB, 'to the staff'],
  ]);
  const p = rig({ glyphs: ['mod'] });
  assert.equal(p.voice.mode(), 'red', 'the kept voice is the device\'s');
  assert.equal(p.voice.shown('world'), false, 'a Moderator gets no switch');
  p.voice.send('world', 'hi', p.onSend);
  assert.deepEqual(p.sent, [['world', 'hi']], 'and a Moderator\'s line goes as typed, whatever is kept');
  const none = rig({ glyphs: null });
  assert.equal(none.voice.shown('world'), false, 'no glyphs issued yet: no switch');
});

test('STAFF-CHAT-RED KEPT: the voice is the device\'s uiPrefs shelf - Red read back after a reload, Me the default and so written as nothing (mutants: the pick not kept; Me kept as Red)', () => {
  fresh();
  rig().voice.pick('red', 'world');
  assert.equal(shelf()[VOICE_PREF], 'red', 'on the shelf');
  _resetForTests();   // a reload: the shelf read again
  assert.equal(rig().voice.mode(), 'red');
  rig().voice.pick('me', 'world');
  _resetForTests();
  assert.equal(rig().voice.mode(), 'me');
  assert.equal(VOICE_PREF in shelf(), false, 'Me is the default, so the shelf holds no word for it (PREF1)');
});

test('STAFF-CHAT-RED HIDDEN: Red still speaks; Me asks first and a second press inside the window says yes - Hide off asked of the Staff Panel, its answer said; a lapsed ask asks again; a line in Me while hidden is not sent and says so (mutants: Me while hidden with no ask; the yes never asking the panel; the panel\'s no said as a yes; the ask never lapsing; a hidden Me line sent)', async () => {
  fresh();
  const r = rig();
  r.voice.adopt({ hidden: true });
  assert.equal(r.voice.hidden(), true);
  r.voice.pick('red', 'world');
  assert.equal(r.voice.send('world', 'hidden but red', r.onSend), true);
  assert.deepEqual(r.sent.at(-1), ['world', '/red hidden but red'], 'a red line names nobody, so Red works hidden');
  r.voice.pick('me', 'world');
  assert.deepEqual(r.said, [['world', voiceAskText()]], 'asked first');
  assert.equal(voiceAskText(), 'This shows you to players. Turn Hide off? Press Me again to say yes.');
  assert.equal(r.voice.mode(), 'red', 'nothing changed on the first press');
  assert.equal(r.voice.asking(), true);
  assert.equal(r.shows.length, 0, 'the panel is not asked before the yes');
  r.tick(VOICE_ASK_MS + 1);
  assert.equal(r.voice.asking(), false, 'an ask left alone lapses');
  r.voice.pick('me', 'world');
  assert.equal(r.said.length, 2, 'a press after it asks again');
  r.tick(VOICE_ASK_MS - 1);
  r.voice.pick('me', 'world');
  assert.equal(r.voice.mode(), 'me', 'yes: Me');
  assert.equal(r.voice.asking(), false);
  assert.equal(r.shows.length, 1, 'yes: the Staff Panel asked to turn Hide off');
  await settle();
  assert.deepEqual(r.said.at(-1), ['world', voiceShownText()]);
  const old = rig({ show: false });
  old.voice.adopt({ hidden: true });
  old.voice.pick('me', 'world'); old.voice.pick('me', 'world');
  await settle();
  assert.deepEqual(old.said.at(-1), ['world', voiceOpenPanelText()], 'no panel, or one older than the ask');
  assert.equal(voiceOpenPanelText(), 'Open the Staff Panel to show yourself.');
  const broke = rig({ show: () => Promise.reject(new Error('gone')) });
  broke.voice.adopt({ hidden: true });
  broke.voice.pick('me', 'world'); broke.voice.pick('me', 'world');
  await settle(); await settle();
  assert.deepEqual(broke.said.at(-1), ['world', voiceOpenPanelText()], 'a failed ask is a no');
  // Me while hidden: the relay would drop the line without a word
  const before = r.sent.length;
  assert.equal(r.voice.send('world', 'can anyone see me', r.onSend), false, 'held: it stays in the field');
  assert.equal(r.sent.length, before);
  assert.deepEqual(r.said.at(-1), ['world', voiceHiddenText()]);
  assert.equal(r.voice.send('world', '/red still this', r.onSend), true, 'a command goes as typed');
  r.voice.adopt({ glyphs: ['dev'] });   // the next mint: visible
  assert.equal(r.voice.hidden(), false);
  assert.equal(r.voice.send('world', 'now you can', r.onSend), true);
  assert.deepEqual(r.sent.at(-1), ['world', 'now you can']);
  const seen = rig();
  seen.voice.pick('me', 'world');
  assert.deepEqual(seen.said, [], 'not hidden: Me is simply Me');
});

/** A window for the staff door: its listeners, what it posted, and a way to answer as another sender. */
function fakeWin(origin = 'https://daggerfalljs.dev') {
  const listeners = new Set(), posted = [];
  const win = {
    location: { origin },
    addEventListener: (t, fn) => { if (t === 'message') listeners.add(fn); },
    removeEventListener: (t, fn) => { if (t === 'message') listeners.delete(fn); },
    postMessage: (m, to) => posted.push([m, to]),
  };
  const hear = (data, { source = win, from = origin } = {}) => { for (const fn of [...listeners]) fn({ data, source, origin: from }); };
  return { win, posted, hear, listeners };
}

test('STAFF-CHAT-RED THE DOOR\'S ASK: staffShowMe posts { dfoStaff: hide, on: false } to the page\'s own origin and resolves the panel\'s ok - from this window and origin only, the ask itself no answer; no answer in STAFF_TOKEN_WAIT_MS is a no, and the listener goes either way (mutants: the ask to any origin; another sender\'s answer taken; the ask heard as its own answer; no timeout)', async () => {
  const a = fakeWin();
  const p = staffShowMe(a.win, { setTimer: () => 1, clearTimer: () => {} });
  assert.deepEqual(a.posted, [[{ dfoStaff: 'hide', on: false }, 'https://daggerfalljs.dev']]);
  a.hear({ dfoStaff: 'hide', on: false });   // the ask itself, which this window hears too
  a.hear({ dfoStaff: 'hide', on: false, ok: true }, { source: {} });
  a.hear({ dfoStaff: 'hide', on: false, ok: true }, { from: 'https://evil.test' });
  a.hear({ dfoStaff: 'token', ok: true });
  assert.equal(a.listeners.size, 1, 'none of those was the answer');
  a.hear({ dfoStaff: 'hide', on: false, ok: true });
  assert.equal(await p, true);
  assert.equal(a.listeners.size, 0, 'let go once answered');
  const b = fakeWin();
  const q = staffShowMe(b.win, { setTimer: () => 1, clearTimer: () => {} });
  b.hear({ dfoStaff: 'hide', on: false, ok: false });
  assert.equal(await q, false, 'the service refused');
  const c = fakeWin();
  let fire = null, waited = 0;
  const w = staffShowMe(c.win, { setTimer: (fn, ms) => { fire = fn; waited = ms; return 1; }, clearTimer: () => {} });
  assert.equal(waited, STAFF_TOKEN_WAIT_MS);
  fire();
  assert.equal(await w, false, 'no panel answered: an older one ignores the ask');
  assert.equal(c.listeners.size, 0);
  assert.equal(await staffShowMe({ location: { origin: 'null' }, postMessage() {} }), false, 'an opaque page asks nobody');
  assert.equal(await staffShowMe(null), false);
  // the door's own listener leaves the ask alone (staffHookDoor has no arm for it)
  assert.match(rd('src/net/staffHook.js'), /the game asks \{ dfoStaff: 'hide', on: false \} and the panel answers \{ dfoStaff: 'hide', on: false, ok \}/);
});

test('STAFF-CHAT-RED THE MINT\'S WORD: the service\'s `hidden: 1` reaches the voice through the page\'s own minter and the chat safety host (accountTokenMinter -> onIssued -> adopt, world.js adoptIssued\'s path), and a visible mint takes it back (mutants: `hidden` dropped from the minter\'s answer; the host not forwarding it)', async () => {
  fresh();
  const smem = new Map([[SESSION_KEY, JSON.stringify({ secret: 's3cret', id: 'acct-me', name: 'Me' })], [SERVICE_KEY, 'https://accounts.test']]);
  const storage = { getItem: (k) => smem.get(k) ?? null, setItem: (k, v) => smem.set(k, String(v)), removeItem: (k) => smem.delete(k) };
  let hidden = 1;
  const fetch = async () => new Response(JSON.stringify({ token: `v1.tok${hidden}.sig`, name: 'Staff member', kind: 'linked', glyphs: ['dev'], ...(hidden ? { hidden } : {}) }), { status: 200, headers: { 'content-type': 'application/json' } });
  const host = createChatSafetyHost({ log: () => null, links: () => [], glyphs: () => ['dev'], fetch, storage, doc: { createElement: () => ({}) }, win: fakeWin().win });
  const minter = accountTokenMinter({ fetch, storage, onIssued: (who) => host.adopt(who) });
  assert.equal(await minter('chat:world'), 'v1.tok1.sig');
  assert.equal(host.voice.hidden(), true, 'the hidden mint said so');
  hidden = 0;
  const again = accountTokenMinter({ fetch, storage, onIssued: (who) => host.adopt(who) });
  assert.equal(await again('chat:world'), 'v1.tok0.sig');
  assert.equal(host.voice.hidden(), false, 'a visible mint says nothing, and is heard as visible');
  assert.match(rd('server-account/src/staffHidden.js'), /expiresAt: nowS \+ MAX_TTL_S, hidden: 1, sub,/, 'the service\'s word, as the minter reads it');
});

/* ═══ THE PANEL ═══════════════════════════════════════════════════════════════════════════════════════════════════ */

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', type: '', title: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(),
    append(...cs) { for (const c of cs) { if (c.parent) c.remove(); c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { for (const c of n.children) c.parent = null; n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = String(v); }, removeAttribute(k) { delete n.attrs[k]; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {}, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { doc.activeElement = n; }, blur() { if (doc.activeElement === n) doc.activeElement = null; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } },
    scrollHeight: 0, clientHeight: 0, scrollTop: 0,
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = () => null;
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];

function panelRig({ glyphs = ['dev'] } = {}) {
  fresh();
  const log = new ChatLog();
  const doc = fakeDocument();
  const keys = [];
  const win = { addEventListener: (t, fn) => { if (t === 'keydown') keys.push(fn); }, removeEventListener() {} };
  const r = rig({ glyphs });
  const panel = createChatPanel({ log, onSend: r.onSend, overlay: () => false, action: () => null, doc, win, touch: false, voice: r.voice });
  const root = doc.body.children[0];
  const form = one(root, 'dfchat-form');
  const input = one(root, 'dfchat-input');
  const box = one(root, 'dfchat-voice');
  const me = one(root, 'dfchat-voice-me'), red = one(root, 'dfchat-voice-red');
  /** A keydown on `target`, through the panel's one window listener: what it stopped. */
  const key = (target, code, more = {}) => {
    const ev = { code, target, repeat: false, isTrusted: true, shiftKey: false, prevented: false, stopped: false, preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; }, stopImmediatePropagation() { ev.stopped = true; }, ...more };
    for (const fn of keys) fn(ev);
    return ev;
  };
  const type = (text) => { input.value = text; form.fire('submit'); };
  return { ...r, log, doc, panel, root, form, input, box, me, red, key, type };
}

test('STAFF-CHAT-RED THE SWITCH: first in the form\'s row, a labelled group of two toggle buttons, Me pressed until Red is; a press is the voice\'s, kept, and the caret goes back to the field; a line typed goes in the voice the switch says; hidden from anyone without the dev glyph and on a tab it does not speak on (mutants: the switch after the field; the press not kept; the panel sending past the voice; drawn for a Moderator)', () => {
  const p = panelRig();
  assert.equal(p.form.children[0], p.box, 'beside the chat, before the field');
  assert.equal(p.box.attrs.role, 'group');
  assert.equal(p.box.attrs['aria-label'], 'Chat as');
  assert.deepEqual([p.me.type, p.red.type], ['button', 'button'], 'real buttons, never the form\'s submit');
  p.log.setOpen(true);
  p.panel.render();
  assert.equal(p.box.style.display, '');
  assert.deepEqual([p.me.textContent, p.me.attrs['aria-pressed'], p.red.textContent, p.red.attrs['aria-pressed']], ['Me', 'true', 'Red', 'false']);
  assert.ok(p.red.title.includes('/red'), 'Red says what it does');
  p.type('as myself');
  p.red.fire('click');
  assert.equal(getPref(VOICE_PREF), 'red', 'kept');
  assert.deepEqual([p.me.attrs['aria-pressed'], p.red.attrs['aria-pressed']], ['false', 'true']);
  assert.equal(p.doc.activeElement, p.input, 'the caret back in the field');
  p.type('as the server');
  p.type('/help');
  assert.deepEqual(p.sent, [['world', 'as myself'], ['world', '/red as the server'], ['world', '/help']]);
  assert.equal(p.input.value, '', 'each went');
  p.log.setShown('party', true);
  p.log.select('party');
  p.panel.render();
  assert.equal(p.box.style.display, 'none', 'not on the Party tab');
  p.type('party chat');
  assert.deepEqual(p.sent.at(-1), ['party', 'party chat']);
  p.panel.destroy();
  const m = panelRig({ glyphs: ['mod'] });
  m.panel.render();
  assert.equal(m.box.style.display, 'none', 'a Moderator never sees it');
  const plainDoc = fakeDocument();
  const plain = createChatPanel({ log: new ChatLog(), onSend: () => true, overlay: () => false, action: () => null, doc: plainDoc, win: { addEventListener() {}, removeEventListener() {} }, touch: false });
  plain.render();
  assert.equal(find(plainDoc.body, 'dfchat-voice').length, 0, 'a host that hands no voice draws no switch');
  plain.destroy();
  m.panel.destroy();
});

test('STAFF-CHAT-RED THE SWITCH, HIDDEN: Me\'s first press asks (its word "Me?" while it waits) and the second says yes; a line in Me while hidden stays in the field (mutants: the ask not drawn; a held line cleared)', async () => {
  const p = panelRig();
  p.voice.adopt({ hidden: true });
  p.log.setOpen(true);
  p.red.fire('click');
  p.me.fire('click');
  assert.equal(p.me.textContent, 'Me?');
  assert.deepEqual(p.said.at(-1), ['world', voiceAskText()]);
  p.me.fire('click');
  assert.equal(p.me.textContent, 'Me');
  assert.equal(p.me.attrs['aria-pressed'], 'true');
  assert.equal(p.shows.length, 1);
  await settle();
  p.type('hello?');
  assert.equal(p.input.value, 'hello?', 'not sent: it stays in the field');
  assert.deepEqual(p.said.at(-1), ['world', voiceHiddenText()]);
  p.panel.destroy();
});

test('STAFF-CHAT-RED THE SWITCH\'S KEYS: Tab in the field walks onto Me, then Red, then back (Shift the other way); every key on the switch is the panel\'s - stopped, so the game hears none; Escape goes back to the field; with no switch on the tab, Tab stays in the field (C7) (mutants: a switch key reaching the game; Tab never reaching the switch)', () => {
  const p = panelRig();
  p.log.setOpen(true);
  p.panel.render();
  p.input.focus();
  assert.equal(p.key(p.input, 'Tab').prevented, true);
  assert.equal(p.doc.activeElement, p.me);
  for (const code of ['KeyW', 'Space', 'Enter', 'Digit1']) assert.equal(p.key(p.me, code).stopped, true, `${code} on the switch stays the panel's`);
  assert.equal(p.key(p.me, 'Space').prevented, false, 'Space is the button\'s own press');
  p.key(p.me, 'Tab');
  assert.equal(p.doc.activeElement, p.red);
  p.key(p.red, 'Tab');
  assert.equal(p.doc.activeElement, p.input);
  p.key(p.input, 'Tab', { shiftKey: true });
  assert.equal(p.doc.activeElement, p.red, 'Shift+Tab: the other way');
  const esc = p.key(p.red, 'Escape');
  assert.equal(esc.stopped, true);
  assert.equal(p.doc.activeElement, p.input);
  p.log.setShown('party', true);
  p.log.select('party');
  p.panel.render();
  p.key(p.input, 'Tab');
  assert.equal(p.doc.activeElement, p.input, 'no switch on this tab: the field keeps the focus');
  p.panel.destroy();
});

test('STAFF-CHAT-RED WIRED: the host hands the chat safety host\'s voice to the panel, and the host makes it over the glyphs and the mint\'s word it already reads (mutant: the panel built without it)', () => {
  const world = rd('src/scenes/world.js');
  assert.match(world, /\n {6}voice: chatSafety\.voice,/);
  const host = rd('src/scenes/chatSafetyHost.js');
  assert.match(host, /voice: createChatVoice\(\{ glyphs, say, win \}\),/);
  assert.match(host, /adopt\(issued\) \{\n {6}host\.voice\.adopt\(issued\);/);
  const h = createChatSafetyHost({ log: () => null, links: () => [], glyphs: () => ['dev'], doc: { createElement: () => ({}) }, win: fakeWin().win });
  assert.equal(h.voice.shown('world'), true);
  h.adopt({ hidden: true });
  assert.equal(h.voice.hidden(), true);
  h.adopt(null);
  assert.equal(h.voice.hidden(), false);
});
