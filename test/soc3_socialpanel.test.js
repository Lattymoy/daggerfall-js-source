// SOC3 (2026-09-16, Mac: "A social button next to the chat UI, that when tapped opens the new friends list + party
// interface. Players should now be able to friend other users, see if they are online/last online + be able to
// invite friends or other individuals to the new 4 person party system. Party system: Upon joining a party, the
// players name who are in a party together should turn green"): THE SURFACE.
//
// Driven headless over a fake document and window - the shape chat1.test.js drives its own panel through, copied
// here rather than shared, because a fake DOM that two slices tune for each other stops being either one's. The
// PICTURE is a real net/social.js SocialState fed real hub frames (net/wire.js validSocialFrame already admits
// them, SOC1/SOC2), so nothing here mocks the thing under test: what the panel asks of the state is what the hub
// would have said.
//
// Each pin names the mutants it kills.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ChatLog } from '../src/net/chat.js';
import { createChatPanel, CHAT_CSS } from '../src/ui/chatPanel.js';
import { SocialState, PARTY_GREEN_CSS, FRIEND_CSS, lastOnlineText } from '../src/net/social.js';
import { INVITE_TTL_MS, PARTY_MAX } from '../src/net/wire.js';
import {
  createSocialPanel, injectSocialStyle, SOCIAL_CSS, SOCIAL_STYLE_ID, SOCIAL_NOTE_MS, SOCIAL_CONFIRM_MS,
  NO_FRIENDS_TEXT, NO_PARTY_TEXT, TRY_AGAIN_TEXT, inviteLeftText, partyPoseText, friendOrder,
} from '../src/ui/socialPanel.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ── THE FAKE DOM (chat1.test.js's shape) ─────────────────────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), focused: false, scrollTop: 0, scrollHeight: 100, clientHeight: 100,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener(t, fn) { const l = n.listeners.get(t) ?? []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    fire(t, e = {}) { const ev = { type: t, target: n, prevented: false, stopped: false, preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; }, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { n.focused = true; doc.activeElement = n; },
    blur() { n.focused = false; if (doc.activeElement === n) doc.activeElement = null; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
/** A window with BOTH phases: the capture pass, then - unless propagation was stopped - the bubble pass, where the
 *  host's own listener (world.js's `keys.add(e.code)`, and its pause door) lives. */
function fakeWindow() {
  const listeners = [];
  return {
    listeners,
    addEventListener(t, fn, capture) { listeners.push({ t, fn, capture: capture === true || capture?.capture === true }); },
    removeEventListener(t, fn) { const i = listeners.findIndex((l) => l.t === t && l.fn === fn); if (i >= 0) listeners.splice(i, 1); },
    key(code, e = {}) {
      const ev = { type: 'keydown', code, target: null, isTrusted: true, prevented: false, stopped: false, preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; }, ...e };
      for (const l of listeners) if (l.t === 'keydown' && l.capture) l.fn(ev);
      if (!ev.stopped) for (const l of listeners) if (l.t === 'keydown' && !l.capture) l.fn(ev);
      return ev;
    },
  };
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];
const textsOf = (nodes, cls) => nodes.map((n) => one(n, cls)?.textContent ?? null);
const defaultAction = (e) => (e.code === 'Enter' ? 'ActivateCursor' : null);
const off = () => false;

// ── THE PICTURE ──────────────────────────────────────────────────────

const T0 = 1_700_000_000_000;
/** A hub row as SOC1 says one: the account, the name, whether online, when last seen, the peer ids its tabs are. */
const row = (name, over = {}) => ({ acct: `acct-${name}`, name, online: true, seen: T0, peers: [`peer-${name}`], ...over });
const stateFrame = (over = {}) => ({ t: 'social', k: 'state', acct: 'acct-me', name: 'Mac', friends: [], in: [], out: [], party: null, invites: [], ...over });
const member = (name, over = {}) => ({ ...row(name), p: null, ...over });
const inviteFrame = (party, from, members, at) => ({ t: 'social', k: 'invite', party, from, members, at, expires: at + INVITE_TTL_MS });

/** A panel over a fresh picture, with the clock the test moves. */
function build({ accept = true, canOpen = () => true, touch = false, frame = stateFrame() } = {}) {
  const clock = { t: T0 };
  const social = new SocialState({ now: () => clock.t });
  social.apply(frame);
  const sent = [];
  const doc = fakeDocument(), win = fakeWindow();
  const pointer = [];
  const panel = createSocialPanel({
    social,
    send: (a) => { sent.push(a); return accept; },
    canOpen, overlay: off, doc, win, touch,
    onOpen: () => pointer.push('free'), onClose: () => pointer.push('lock'),
  });
  return { social, panel, sent, doc, win, clock, pointer, root: panel.root, toast: panel.toast, set: (v) => { accept = v; } };
}
/** The rows of the open body, in order. */
const bodyRows = (root) => find(one(root, 'dfsocial-body'), 'dfsocial-row');
const secs = (root) => find(one(root, 'dfsocial-body'), 'dfsocial-sec').map((n) => n.textContent);
const buttons = (n) => find(n, 'dfsocial-btn');
const btnBy = (n, label) => buttons(n).find((b) => b.textContent === label);

// ═══ THE BUTTON ══════════════════════════════════════════════════════

test('SOC3: the Social button stands in BOTH chat states with one badge law, is no chat tab, swallows its press, and a host that asked for none gets none (mutants: the button drawn on touch alone; the badge counting unread lines; a badge drawn at zero; the tab-bar button classed dfchat-tab; the press reaching the host)', () => {
  const log = new ChatLog({ now: () => T0 });
  const doc = fakeDocument(), win = fakeWindow();
  let pending = 0, toggles = 0;
  const panel = createChatPanel({ log, onSend: () => true, action: defaultAction, doc, win, touch: false, social: { onToggle: () => { toggles++; }, pending: () => pending } });
  const root = doc.body.children[0];
  const both = find(root, 'dfchat-social');
  assert.equal(both.length, 2, 'one for each state of the chat - closed beside the Chat button, open in the tab bar');
  assert.deepEqual(both.map((b) => b.textContent), ['Social', 'Social']);
  assert.equal(find(root, 'dfchat-social-out').length, 1);
  assert.equal(one(one(root, 'dfchat-box'), 'dfchat-social-tab')?.parent?.className, 'dfchat-tabs', 'the open state\'s sits IN the tab bar');
  assert.equal(find(root, 'dfchat-tab').length, 1, 'and it is not a tab: the World tab is still the only row of the log');
  assert.equal(both[0].attrs['aria-label'], 'Friends and party');

  // the badge: what is WAITING on the player, which is not what the chat's own badge counts
  assert.deepEqual(both.map((b) => one(b, 'dfchat-badge').textContent), ['', ''], 'nothing waiting: no badge (the sheet hides an empty one)');
  log.push('world', { id: 'x', name: 'Bob', text: 'hi' });
  panel.render();
  assert.deepEqual(find(root, 'dfchat-social').map((b) => one(b, 'dfchat-badge').textContent), ['', ''], 'an unread LINE is not a pending request');
  pending = 3; panel.render();
  assert.deepEqual(find(root, 'dfchat-social').map((b) => one(b, 'dfchat-badge').textContent), ['3', '3'], 'both badges say the same number');
  pending = 0; panel.render();
  assert.deepEqual(find(root, 'dfchat-social').map((b) => one(b, 'dfchat-badge').textContent), ['', '']);

  both[0].fire('click'); assert.equal(toggles, 1, 'the closed state\'s button toggles the panel');
  both[1].fire('click'); assert.equal(toggles, 2, 'and so does the tab bar\'s');
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart']) assert.equal(both[0].fire(t).stopped, true, `${t} on the Social button is the panel's: no swing on a thumb tap`);
  for (const t of ['pointerup', 'mouseup', 'touchend']) assert.equal(both[0].fire(t).stopped, false, 'a RELEASE still reaches the host (AUDIT CHAT C5)');

  // the sheet: drawn on a desktop too (the Chat button is touch-only), away when the box is open, away when hidden
  assert.match(CHAT_CSS, /\.dfchat-social-out \{ display: inline-flex;/, 'the closed state\'s button is drawn on every device - Enter opens the chat and nothing yet opens this');
  assert.match(CHAT_CSS, /\.dfchat\[data-state="open"\] \.dfchat-social-out \{ display: none; \}/);
  assert.match(CHAT_CSS, /\.dfchat\[data-hidden="1"\] \.dfchat-social-out,/, 'CHAT-R2: Hide takes it with everything else that draws over the world');

  // ...and a host that passes no `social` option builds no button at all
  const plain = fakeDocument();
  createChatPanel({ log: new ChatLog(), onSend: () => true, action: defaultAction, doc: plain, win: fakeWindow(), touch: false });
  assert.equal(find(plain.body.children[0], 'dfchat-social').length, 0, 'no option, no dead button');
});

// ═══ THE PANEL'S DOOR ════════════════════════════════════════════════

test('SOC3: the panel is a POINTER SURFACE - the host refuses it under a window, the cursor is freed and taken back inside the gesture, Escape closes it and opens no pause menu, a covering frame takes it out of the page (mutants: opening under a window; the pointer hooks dropped; Escape reaching the host; a covered frame leaving it up)', () => {
  let willing = true;
  const { panel, root, win, pointer } = build({ canOpen: () => willing });
  assert.equal(root.dataset.open, '0');
  assert.equal(panel.isOpen(), false);
  assert.equal(one(root, 'dfsocial-title').textContent, 'Social');

  willing = false;
  assert.equal(panel.open(), false, 'the host unwilling (a window over the HUD, the pause door): nothing opens');
  assert.deepEqual(pointer, [], 'and no pointer hook fired for a door that did not open');
  willing = true;
  assert.equal(panel.open(), true);
  assert.equal(root.dataset.open, '1'); assert.equal(panel.isOpen(), true);
  assert.deepEqual(pointer, ['free'], 'the cursor is freed inside the opening gesture');
  assert.equal(panel.open(), false, 'opening an open panel is nothing');

  const host = [];
  win.addEventListener('keydown', (e) => host.push(e.code));   // the host's shape: bubble, on the window - its pause door lives here
  const e = win.key('Escape');
  assert.equal(panel.isOpen(), false, 'Escape closes');
  assert.equal(e.prevented, true); assert.equal(e.stopped, true);
  assert.deepEqual(host, [], 'and the key never reaches the host: no pause menu behind the panel it just shut');
  assert.deepEqual(pointer, ['free', 'lock'], 'and the cursor is taken back inside the closing gesture');
  win.key('Escape');
  assert.deepEqual(host, ['Escape'], 'closed, Escape is the host\'s again');

  panel.open();
  one(root, 'dfsocial-close').fire('click');
  assert.equal(panel.isOpen(), false, 'the ✕ closes too');

  // the host's word: a window over the HUD takes the panel AND the toast out of the page
  panel.open();
  panel.render({ covered: true });
  assert.equal(panel.isOpen(), false, 'a covering window closes it');
  assert.equal(root.style.display, 'none'); assert.equal(panel.toast.style.display, 'none');
  panel.render({ covered: false });
  assert.equal(root.style.display, ''); assert.equal(panel.toast.style.display, '');

  // toggle, and the press rule
  assert.equal(panel.toggle(), true); assert.equal(panel.isOpen(), true);
  assert.equal(panel.toggle(), true); assert.equal(panel.isOpen(), false);
  for (const t of ['pointerdown', 'mousedown', 'click', 'touchstart', 'wheel', 'contextmenu']) assert.equal(root.fire(t).stopped, true, `${t} inside the panel is the panel's`);
  for (const t of ['pointerup', 'mouseup', 'touchend']) assert.equal(root.fire(t).stopped, false, 'a RELEASE is never stopped');

  // destroy takes the one listener and both roots
  const before = win.listeners.length;
  panel.destroy();
  assert.equal(win.listeners.length, before - 1, 'the capture listener goes with the panel - the host\'s own stays');
  assert.equal(root.removed, true); assert.equal(panel.toast.removed, true);
});

test('SOC3: the sheet is injected once, and the panel is its own layer over the chat with a body that never squeezes its rows (mutants: a second sheet per panel; the panel under the chat; a row that shrinks in the scroller)', () => {
  const doc = fakeDocument();
  injectSocialStyle(doc); injectSocialStyle(doc);
  assert.equal(doc.getElementById(SOCIAL_STYLE_ID)?.tagName, 'STYLE');
  assert.equal(doc.head.children.filter((n) => n.id === SOCIAL_STYLE_ID).length, 1, 'once');

  // the chat is z-index 5; the panel must sit over it and the toast over both
  assert.match(SOCIAL_CSS, /\.dfsocial \{[^}]*z-index: 6;/);
  assert.match(SOCIAL_CSS, /\.dfsocial-toast \{[^}]*z-index: 7;/);
  assert.match(CHAT_CSS, /\.dfchat \{[^}]*z-index: 5;/, 'the chat\'s own, unchanged - the two numbers are a pair');
  assert.match(SOCIAL_CSS, /\.dfsocial\[data-open="1"\] \{ display: flex; \}/, 'closed is display:none on the root, so a shut panel catches no pointer');

  // CHAT2's lesson, applied from the first commit: the body is a fixed-height flex-column scroller, so everything
  // in it states `flex: none` rather than being squeezed toward nothing by the default flex-shrink
  assert.match(SOCIAL_CSS, /\.dfsocial-body \{[^}]*min-height: 0;[^}]*overflow-y: auto;/);
  for (const part of ['dfsocial-sec', 'dfsocial-row', 'dfsocial-empty', 'dfsocial-dot', 'dfsocial-btn', 'dfsocial-lead', 'dfsocial-left']) {
    assert.match(SOCIAL_CSS, new RegExp(`\\.${part} \\{[^}]*flex: none;`), `${part} must refuse to shrink inside the body's scroller`);
  }
  assert.doesNotMatch(rd('src/ui/socialPanel.js'), /innerHTML/, 'a name off the wire is TEXT, never markup');
  // ...and this one is read over the source with its COMMENTS STRIPPED, for the fifth time in this port: the
  // sentence explaining WHY there is no `window.confirm` here names the thing it refuses, and a pin that reddens on
  // its own explanation teaches the next reader to delete the explanation.
  const panelCode = rd('src/ui/socialPanel.js').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  assert.doesNotMatch(panelCode, /window\.confirm|globalThis\.confirm|[^.\w]confirm\(/, 'the Remove confirm is the row\'s own two clicks, never a modal that steals the pointer the panel just freed');
});

// ═══ THE TABS ════════════════════════════════════════════════════════

test('SOC3: two tabs, Friends first, each badged with what is waiting on IT - requests on Friends, invitations on Party (mutants: one badge for both; the party body drawn on the friends tab; a tab click that repaints nothing)', () => {
  const { social, panel, root, clock } = build({ frame: stateFrame({ friends: [row('Ann')], in: [{ ...row('Bob'), at: T0 }] }) });
  panel.open();
  const tabs = find(root, 'dfsocial-tab');
  assert.deepEqual(tabs.map((t) => t.textContent), ['Friends', 'Party']);
  assert.deepEqual(tabs.map((t) => t.dataset.tab), ['friends', 'party']);
  assert.equal(panel.tab(), 'friends', 'Friends is what opens - it is the list the button is named for');
  assert.match(tabs[0].className, /active/); assert.doesNotMatch(tabs[1].className, /active/);
  assert.deepEqual(tabs.map((t) => one(t, 'dfsocial-badge').textContent), ['1', ''], 'one request in, no invitation');

  social.apply(inviteFrame('q-2', { acct: 'acct-Cid', name: 'Cid' }, [{ acct: 'acct-Cid', name: 'Cid' }], clock.t));
  panel.render();
  assert.deepEqual(find(root, 'dfsocial-tab').map((t) => one(t, 'dfsocial-badge').textContent), ['1', '1'], 'and the invitation lands on the Party tab, not on the request count');

  assert.ok(secs(root).some((s) => s === 'Requests'), 'the friends tab');
  find(root, 'dfsocial-tab')[1].fire('click');
  assert.equal(panel.tab(), 'party');
  assert.ok(secs(root).some((s) => /^Your party|Party invitations/.test(s)) || find(root, 'dfsocial-empty').length, 'the party tab drew instead');
  assert.equal(one(one(root, 'dfsocial-body'), 'dfsocial-empty').textContent, NO_PARTY_TEXT);
  assert.equal(find(root, 'dfsocial-tab')[1].className, 'dfsocial-tab active');
});

// ═══ THE FRIENDS ═════════════════════════════════════════════════════

test('SOC3: the friends list is ONLINE FIRST then by name, each row saying when they were last seen on the RELAY\'s clock, my party\'s green and everyone else\'s friend colour (mutants: the order by name alone; the sort by Map order; last-online read off this machine\'s clock; a seated friend drawn in the friend colour)', () => {
  const friends = [row('Zed'), row('ann'), row('Bob', { online: false, seen: T0 - 5 * 60_000 }), row('Cid', { online: false, seen: null })];
  const { social, panel, root } = build({ frame: stateFrame({ friends }) });
  panel.open();
  let rows = bodyRows(root);
  assert.deepEqual(textsOf(rows, 'dfsocial-name'), ['ann', 'Zed', 'Bob', 'Cid'],
    'online first - the friend a player is looking for is one they could talk to now - then by name the way the roster sorts');
  assert.deepEqual(textsOf(rows, 'dfsocial-sub'), ['Online', 'Online', 'Last online 5 min ago', 'Never online']);
  assert.deepEqual(rows.map((r) => one(r, 'dfsocial-dot').className), ['dfsocial-dot on', 'dfsocial-dot on', 'dfsocial-dot', 'dfsocial-dot']);
  assert.equal(secs(root)[0], 'Friends (4)');
  assert.deepEqual(rows.map((r) => one(r, 'dfsocial-name').style.color), [FRIEND_CSS, FRIEND_CSS, FRIEND_CSS, FRIEND_CSS]);

  // WORLD5's offset: "last online" is read against the RELAY's clock as this machine sees it
  social.setClockOffset(60_000);
  social.apply(stateFrame({ friends }));   // a fresh state, so the body rebuilds
  panel.render();
  assert.equal(textsOf(bodyRows(root), 'dfsocial-sub')[2], 'Last online 6 min ago', 'a minute of offset is a minute of "ago"');
  assert.equal(lastOnlineText(false, T0 - 5 * 60_000, T0 + 60_000), 'Last online 6 min ago', 'and the words are net/social.js\'s, not this file\'s');

  // "the players name who are in a party together should turn green" - in the friends list too
  social.apply({ t: 'social', k: 'party', party: { id: 'q-1', leader: 'acct-me', members: [member('me', { acct: 'acct-me', name: 'Mac' }), member('Zed')] } });
  panel.render();
  rows = bodyRows(root);
  const byName = Object.fromEntries(rows.map((r) => [one(r, 'dfsocial-name').textContent, one(r, 'dfsocial-name').style.color]));
  assert.equal(byName.Zed, PARTY_GREEN_CSS, 'a friend seated with me is GREEN');
  assert.equal(byName.ann, FRIEND_CSS, 'and a friend who is not keeps the friend colour');

  // the pure order, driven on its own
  assert.deepEqual(friendOrder(new Map(friends.map((r) => [r.acct, r]))).map((r) => r.name), ['ann', 'Zed', 'Bob', 'Cid']);
  assert.deepEqual(friendOrder([row('Player10'), row('Player9')]).map((r) => r.name), ['Player9', 'Player10'], 'numerically, as net/roster.js sorts');
});

test('SOC3: an empty friends list SAYS SO and says where to go (mutants: a blank panel; the empty line drawn over a list that has rows)', () => {
  const { panel, root, social } = build();
  panel.open();
  assert.equal(one(root, 'dfsocial-empty').textContent, NO_FRIENDS_TEXT);
  assert.equal(NO_FRIENDS_TEXT, 'No friends yet - press F on a player, or click a name in the chat roster.');
  social.apply(stateFrame({ friends: [row('Ann')] }));
  panel.render();
  assert.equal(find(one(root, 'dfsocial-body'), 'dfsocial-empty').length, 0, 'a list with a row in it says nothing about being empty');
});

test('SOC3: the requests section comes FIRST and sends the act each button names, by ACCOUNT (mutants: Accept sending the peer id; Decline sending accept; an outgoing row offering Accept; Cancel sending remove)', () => {
  const { panel, root, sent } = build({ frame: stateFrame({ friends: [row('Zed')], in: [{ ...row('Bob'), at: T0 }], out: [{ ...row('Cid'), at: T0 }] }) });
  panel.open();
  assert.deepEqual(secs(root), ['Requests', 'Friends (1)'], 'what is waiting on the player is read before the directory');
  const rows = bodyRows(root);
  assert.deepEqual(textsOf(rows, 'dfsocial-name'), ['Bob', 'Cid', 'Zed']);
  assert.deepEqual(textsOf(rows.slice(0, 2), 'dfsocial-sub'), ['wants to be your friend', 'request sent']);
  assert.deepEqual(buttons(rows[0]).map((b) => b.textContent), ['Accept', 'Decline']);
  assert.deepEqual(buttons(rows[1]).map((b) => b.textContent), ['Cancel'], 'a request I sent is mine to CANCEL and nobody\'s to accept');

  btnBy(rows[0], 'Accept').fire('click');
  assert.deepEqual(sent, [{ k: 'friend.accept', acct: 'acct-Bob' }], 'the ACCOUNT - a friend is a person, not a tab');
  btnBy(bodyRows(root)[0], 'Decline').fire('click');
  assert.deepEqual(sent[1], { k: 'friend.decline', acct: 'acct-Bob' });
  btnBy(bodyRows(root)[1], 'Cancel').fire('click');
  assert.deepEqual(sent[2], { k: 'friend.cancel', acct: 'acct-Cid' });
});

test('SOC3: Remove is TWO clicks and disarms itself, with no window.confirm anywhere near it (mutants: one click removing; the confirm armed for every row at once; a confirm that waits forever)', () => {
  const { panel, root, sent, clock } = build({ frame: stateFrame({ friends: [row('Ann'), row('Bob')] }) });
  panel.open();
  const removeOf = (name) => { const r = bodyRows(root).find((x) => one(x, 'dfsocial-name').textContent === name); return { row: r, arm: btnBy(r, 'Remove'), fire: btnBy(r, 'Sure?') }; };
  assert.equal(removeOf('Ann').arm.textContent, 'Remove');
  removeOf('Ann').arm.fire('click');
  assert.deepEqual(sent, [], 'the first click sends NOTHING');
  assert.equal(removeOf('Ann').fire?.textContent, 'Sure?', 'it arms');
  assert.equal(removeOf('Bob').arm?.textContent, 'Remove', 'and arms that row alone');
  removeOf('Ann').fire.fire('click');
  assert.deepEqual(sent, [{ k: 'friend.remove', acct: 'acct-Ann' }], 'the second sends it');
  assert.equal(removeOf('Ann').arm?.textContent, 'Remove', 'and disarms');

  // a confirm left standing disarms itself: a player who wandered off must not come back to a live Remove
  removeOf('Bob').arm.fire('click');
  assert.equal(removeOf('Bob').fire?.textContent, 'Sure?');
  clock.t += SOCIAL_CONFIRM_MS + 1;
  panel.render(); panel.render();
  assert.equal(removeOf('Bob').arm?.textContent, 'Remove', 'armed, then left alone: disarmed on its own');
  assert.equal(sent.length, 1, 'and nothing was sent by the waiting');
});

test('SOC3: Invite on a friend row is enabled only when they have a tab in the world and a seat is free, and a refused one CARRIES THE REASON (mutants: an offline friend invitable; a full party\'s Invite live; a seated friend invited again; the reason dropped from the title)', () => {
  const friends = [row('Ann'), row('Bob', { online: false, seen: T0, peers: [] })];
  const { social, panel, root, sent } = build({ frame: stateFrame({ friends }) });
  panel.open();
  const inviteOf = (name) => btnBy(bodyRows(root).find((x) => one(x, 'dfsocial-name').textContent === name), 'Invite');
  assert.equal(inviteOf('Ann').disabled, undefined, 'online, no party of mine: invite away');
  assert.equal(inviteOf('Bob').disabled, true);
  assert.equal(inviteOf('Bob').attrs.title, 'offline', 'a friend with no socket cannot be reached - and that is a truer sentence than "the party is full"');
  inviteOf('Ann').fire('click');
  assert.deepEqual(sent, [{ k: 'party.invite', acct: 'acct-Ann' }], 'by ACCOUNT: the person, not whichever tab they have open');

  // seated with me: nothing to invite them to
  social.apply({ t: 'social', k: 'party', party: { id: 'q-1', leader: 'acct-me', members: [member('me', { acct: 'acct-me', name: 'Mac' }), member('Ann')] } });
  panel.render();
  assert.equal(inviteOf('Ann').disabled, true); assert.equal(inviteOf('Ann').attrs.title, 'in your party');

  // four seats and no fifth
  social.apply({ t: 'social', k: 'party', party: { id: 'q-1', leader: 'acct-me', members: [member('me', { acct: 'acct-me', name: 'Mac' }), member('Cid'), member('Dar'), member('Eli')] } });
  social.apply(stateFrame({ friends, party: { id: 'q-1', leader: 'acct-me', members: [member('me', { acct: 'acct-me', name: 'Mac' }), member('Cid'), member('Dar'), member('Eli')] } }));
  panel.render();
  assert.equal(social.seatsFree(), 0);
  assert.equal(inviteOf('Ann').disabled, true); assert.equal(inviteOf('Ann').attrs.title, 'the party is full');
});

// ═══ THE PARTY ═══════════════════════════════════════════════════════

test('SOC3: the party tab draws the seats out of PARTY_MAX, marks the leader, says where each member stands and how they fare, and offers Kick to the LEADER alone (mutants: Kick drawn for a member; Kick on my own seat; the leader mark on everyone; the pose\'s place dropped; the seat count hardcoded)', () => {
  const party = {
    id: 'q-1', leader: 'acct-me',
    members: [
      member('me', { acct: 'acct-me', name: 'Mac' }),
      member('Bob', { p: { px: 100, py: 200, in: 0, loc: 'Daggerfall', h: 50, hm: 60, f: 1, fm: 2, m: 3, mm: 4, race: 'Nord', gender: 'male', face: 2 } }),
      member('Cid', { online: false, seen: T0 - 60_000 }),
    ],
  };
  const { social, panel, root, sent } = build({ frame: stateFrame({ party }) });
  panel.open();
  find(root, 'dfsocial-tab')[1].fire('click');
  assert.equal(secs(root)[0], `Your party (3/${PARTY_MAX})`);
  assert.equal(secs(root)[0], 'Your party (3/4)', 'Mac\'s "4 person party system", said in the header');
  const rows = bodyRows(root);
  assert.deepEqual(textsOf(rows.slice(0, 3), 'dfsocial-name'), ['Mac', 'Bob', 'Cid']);
  assert.deepEqual(rows.slice(0, 3).map((r) => find(r, 'dfsocial-lead').length), [1, 0, 0], 'one leader, and it is the seat the view names');
  assert.equal(one(rows[0], 'dfsocial-lead').textContent, 'Leader');
  assert.equal(one(rows[1], 'dfsocial-sub').textContent, 'Daggerfall - 50/60 HP', 'the last pose, in words');
  assert.equal(one(rows[2], 'dfsocial-sub')?.textContent ?? '', '', 'a member who has sent no pose says nothing rather than 0/0');
  assert.equal(one(rows[2], 'dfsocial-dot').className, 'dfsocial-dot', 'a seat kept for a member who dropped reads offline');
  assert.deepEqual(rows.slice(0, 3).map((r) => one(r, 'dfsocial-name').style.color), [undefined, PARTY_GREEN_CSS, PARTY_GREEN_CSS], 'the others are green; my own seat is mine');

  assert.deepEqual(rows.slice(0, 3).map((r) => !!btnBy(r, 'Kick')), [false, true, true], 'I lead: everyone but me may be removed');
  btnBy(rows[1], 'Kick').fire('click');
  assert.deepEqual(sent, [{ k: 'party.kick', acct: 'acct-Bob' }]);
  assert.equal(btnBy(rows[3], 'Leave party')?.textContent, 'Leave party');
  btnBy(bodyRows(root)[3], 'Leave party').fire('click');
  assert.deepEqual(sent[1], { k: 'party.leave' }, 'leave names nothing: the hub knows which seat is mine');

  // and a member who does NOT lead is offered no Kick at all
  social.apply({ t: 'social', k: 'party', party: { ...party, leader: 'acct-Bob' } });
  panel.render();
  assert.equal(social.leads(), false);
  assert.deepEqual(bodyRows(root).slice(0, 3).map((r) => !!btnBy(r, 'Kick')), [false, false, false], 'kick is the leader\'s (SOC1) - a member is not shown a door the hub would slam');
  assert.equal(find(bodyRows(root)[1], 'dfsocial-lead').length, 1, 'and the mark followed the leader');

  // the pose's words, driven on their own
  assert.equal(partyPoseText(null), '');
  assert.equal(partyPoseText({ loc: '', h: 7, hm: 9 }), '7/9 HP', 'no place: the vitals alone');
  assert.equal(partyPoseText({ loc: 'Privateer\'s Hold', h: 7.6, hm: 9 }), 'Privateer\'s Hold - 8/9 HP');
});

test('SOC3: an invitation is a row with the party it names, a countdown that RUNS, and two answers; a lapsed one is gone from the list (mutants: accept sending the account; the countdown frozen at the first paint; a lapsed invitation still offered; the invite hung off the friends tab where a party is not)', () => {
  const { social, panel, root, sent, clock } = build();
  panel.open();
  find(root, 'dfsocial-tab')[1].fire('click');
  social.apply(inviteFrame('q-7', { acct: 'acct-Bob', name: 'Bob' }, [{ acct: 'acct-Bob', name: 'Bob' }, { acct: 'acct-Cid', name: 'Cid' }], clock.t));
  panel.render();
  assert.ok(secs(root).includes('Party invitations'));
  const inv = bodyRows(root).find((r) => one(r, 'dfsocial-name').textContent === 'Bob invites you');
  assert.ok(inv, 'the asker is named');
  assert.equal(one(inv, 'dfsocial-sub').textContent, 'Bob, Cid', 'and who is already in it');
  assert.equal(one(inv, 'dfsocial-left').textContent, '2:00 left');
  assert.equal(inviteLeftText(INVITE_TTL_MS), '2:00 left');

  clock.t += 61_000; panel.render();
  assert.equal(one(inv, 'dfsocial-left').textContent, '59s left', 'the same NODE counts down - nothing was rebuilt to move it');
  btnBy(inv, 'Accept').fire('click');
  assert.deepEqual(sent, [{ k: 'party.accept', party: 'q-7' }], 'the PARTY id, which is the only thing an invitation can be answered by');
  btnBy(bodyRows(root).find((r) => one(r, 'dfsocial-name').textContent === 'Bob invites you'), 'Decline').fire('click');
  assert.deepEqual(sent[1], { k: 'party.decline', party: 'q-7' });

  // it lapses on its own, with no frame from the hub behind it
  clock.t += INVITE_TTL_MS; panel.render();
  assert.equal(social.liveInvites().length, 0);
  assert.equal(bodyRows(root).some((r) => one(r, 'dfsocial-name').textContent === 'Bob invites you'), false,
    'time passing moves no version, so the panel raises its own rather than drawing an invitation that is already nothing');
  assert.equal(secs(root).includes('Party invitations'), false);
  assert.equal(inviteLeftText(0), 'expired'); assert.equal(inviteLeftText(-5000), 'expired'); assert.equal(inviteLeftText(12_400), '13s left');
});

test('SOC3: the invite TOAST works with the panel shut, answers by party id, and goes away on the answer, on the seat being taken, and at expiry (mutants: the toast only while open; a toast that outlives its own invitation; the toast answering with the account; a toast that survives the party it offered)', () => {
  const { social, panel, toast, sent, clock } = build();
  assert.equal(panel.isOpen(), false);
  assert.equal(toast.dataset.up, '0');
  social.apply(inviteFrame('q-9', { acct: 'acct-Bob', name: 'Bob' }, [{ acct: 'acct-Bob', name: 'Bob' }], clock.t));
  assert.equal(toast.dataset.up, '1', 'the toast is up the moment the invitation lands - the panel is shut and the player has two minutes');
  assert.equal(one(toast, 'dfsocial-name').textContent, 'Bob invites you to a party');
  assert.equal(one(toast, 'dfsocial-sub').textContent, 'Bob - 2:00 left');
  clock.t += 30_000; panel.render();
  assert.equal(one(toast, 'dfsocial-sub').textContent, 'Bob - 1:30 left', 'and it counts down with the panel still shut');

  btnBy(toast, 'Accept').fire('click');
  assert.deepEqual(sent, [{ k: 'party.accept', party: 'q-9' }]);
  assert.equal(toast.dataset.up, '0', 'answered: gone');

  // a second one, taken away by the picture rather than by the player - the seat filled, the asker left
  social.apply(inviteFrame('q-10', { acct: 'acct-Cid', name: 'Cid' }, [{ acct: 'acct-Cid', name: 'Cid' }], clock.t));
  assert.equal(toast.dataset.up, '1');
  social.apply({ t: 'social', k: 'party', party: { id: 'q-10', leader: 'acct-Cid', members: [member('Cid'), member('me', { acct: 'acct-me', name: 'Mac' })] } });
  panel.render();
  assert.equal(toast.dataset.up, '0', 'seated: that invitation is spent, and the toast cannot stand for something untrue');

  // a third, left to lapse
  social.apply({ t: 'social', k: 'party', party: null });
  social.apply(inviteFrame('q-11', { acct: 'acct-Dar', name: 'Dar' }, [{ acct: 'acct-Dar', name: 'Dar' }], clock.t));
  assert.equal(toast.dataset.up, '1');
  clock.t += INVITE_TTL_MS; panel.render();
  assert.equal(toast.dataset.up, '0', 'expired: gone, whether or not anyone was watching');
  btnBy(toast, 'Decline').fire('click');
  assert.equal(sent.length, 1, 'and a button on a toast that is down sends nothing');
});

// ═══ THE REFUSALS ════════════════════════════════════════════════════

test('SOC3: an act the RATE GATE refused keeps its button and says "try again" - and the note clears itself; the hub\'s own refusal stands under the header (mutants: the row disabled on a refusal; the act swallowed silently; a note that never clears; lastError ignored)', () => {
  const { social, panel, root, sent, clock, set, toast } = build({ accept: false, frame: stateFrame({ in: [{ ...row('Bob'), at: T0 }] }) });
  panel.open();
  const accept = () => btnBy(bodyRows(root)[0], 'Accept');
  accept().fire('click');
  assert.deepEqual(sent, [{ k: 'friend.accept', acct: 'acct-Bob' }], 'the act was offered');
  assert.equal(one(root, 'dfsocial-note').textContent, TRY_AGAIN_TEXT, 'the moment was wrong, not the act');
  assert.equal(accept().disabled, undefined, 'so the button stays exactly as it was - a second press is the whole remedy');
  set(true);
  accept().fire('click');
  assert.equal(sent.length, 2);
  assert.equal(one(root, 'dfsocial-note').textContent, '', 'an act that went clears the note at once');

  set(false);
  accept().fire('click');
  assert.equal(one(root, 'dfsocial-note').textContent, TRY_AGAIN_TEXT);
  clock.t += SOCIAL_NOTE_MS + 1; panel.render();
  assert.equal(one(root, 'dfsocial-note').textContent, '', 'and it clears itself rather than standing over a later act');

  // the toast carries the same note, because a player who never opened the panel cannot read the panel's
  social.apply(inviteFrame('q-12', { acct: 'acct-Cid', name: 'Cid' }, [{ acct: 'acct-Cid', name: 'Cid' }], clock.t));
  btnBy(toast, 'Accept').fire('click');
  assert.equal(toast.dataset.up, '1', 'a refused toast STAYS UP: the invitation still stands and the player still means to answer');
  assert.equal(one(toast, 'dfsocial-sub').textContent, TRY_AGAIN_TEXT);

  // the hub's refusal of ONE act, in the hub's words (SOC1: an error closes nothing)
  social.apply({ t: 'social', k: 'error', m: 'that player is not online' });
  panel.render();
  assert.equal(one(root, 'dfsocial-err').textContent, 'that player is not online');
  social.apply(stateFrame());
  panel.render();
  assert.equal(one(root, 'dfsocial-err').textContent, '', 'and a fresh state clears it');
});

// ═══ THE CHAT'S TWO SEAMS ════════════════════════════════════════════

test('SOC3: nameColor paints the AUTHOR of a chat line and the roster row, is asked again on every frame rather than baked in, and leaves a stranger alone (mutants: the colour taken at build time; the roster ignoring it; a stranger coloured; the friend colour over my party\'s green)', () => {
  const clock = { t: T0 };
  const social = new SocialState({ now: () => clock.t });
  social.apply(stateFrame({ friends: [row('Bob')] }));
  const log = new ChatLog({ now: () => clock.t });
  const doc = fakeDocument(), win = fakeWindow();
  const peers = new Map([['peer-Bob', { id: 'peer-Bob', name: 'Bob' }], ['peer-Zed', { id: 'peer-Zed', name: 'Zed' }]]);
  // world.js's own closure, word for word
  const nameColor = (id) => (social?.isPartyPeer(id) ? PARTY_GREEN_CSS : (social?.isFriendPeer(id) ? FRIEND_CSS : null));
  const panel = createChatPanel({ log, onSend: () => true, roster: () => ({ id: 'peer-me', name: 'Mac', peers }), action: defaultAction, doc, win, touch: false, nameColor });
  const root = doc.body.children[0];
  log.push('world', { id: 'peer-Bob', name: 'Bob', text: 'hail', at: T0 });
  log.push('world', { id: 'peer-Zed', name: 'Zed', text: 'ho', at: T0 });
  log.push('world', { text: 'The server was updated and restarted.', system: true });
  panel.render();
  const peekNames = find(one(root, 'dfchat-peek'), 'dfchat-line').map((n) => one(n, 'dfchat-name'));
  assert.deepEqual(peekNames.map((n) => n?.style.color), [FRIEND_CSS, '', undefined], 'a friend wears the friend colour, a stranger none, and a notice has no name at all');

  panel.open(); panel.render();
  const listName = (who) => find(one(root, 'dfchat-list'), 'dfchat-line').map((n) => one(n, 'dfchat-name')).find((n) => n?.textContent === who);
  assert.equal(listName('Bob').style.color, FRIEND_CSS);
  const whoRow = (who) => find(root, 'dfchat-who-row').find((r) => one(r, 'dfchat-who-name').textContent === who);
  assert.equal(one(whoRow('Bob'), 'dfchat-who-name').style.color, FRIEND_CSS, 'and the roster row too');
  assert.equal(one(whoRow('Zed'), 'dfchat-who-name').style.color, '', 'a stranger in the roster is left alone');

  // "the players name who are in a party together should turn green" - on the LINES THAT ARE ALREADY DRAWN, because
  // a seat can change with nothing said in the chat at all
  const bobSpan = listName('Bob'), bobRow = one(whoRow('Bob'), 'dfchat-who-name');
  social.apply({ t: 'social', k: 'party', party: { id: 'q-1', leader: 'acct-me', members: [member('me', { acct: 'acct-me', name: 'Mac' }), member('Bob')] } });
  panel.render();
  assert.equal(bobSpan.style.color, PARTY_GREEN_CSS, 'the SAME span went green - the colour was never baked into the row');
  assert.equal(bobRow.style.color, PARTY_GREEN_CSS);
  assert.equal(listName('Zed').style.color, '', 'and a stranger stayed a stranger');
  assert.equal(PARTY_GREEN_CSS, '#73ff73');

  // a panel built with no nameColor touches no colour at all
  const plain = fakeDocument();
  const plog = new ChatLog({ now: () => clock.t });
  plog.push('world', { id: 'peer-Bob', name: 'Bob', text: 'hail', at: T0 });
  createChatPanel({ log: plog, onSend: () => true, action: defaultAction, doc: plain, win: fakeWindow(), touch: false }).render();
  assert.equal(one(find(plain.body.children[0], 'dfchat-line')[0], 'dfchat-name').style.color, undefined, 'no option, no style written');
});

test('SOC3: a roster row is a DOOR - the menu is the host\'s answers, a refused one carries its reason, my own row is no door, and an act closes it (mutants: my own name offering Add friend; a disabled action still sending; the reason dropped; the menu left open after the act; a roster that repaints and loses the menu)', () => {
  const clock = { t: T0 };
  const social = new SocialState({ now: () => clock.t });
  social.apply(stateFrame({ friends: [row('Bob')] }));
  const log = new ChatLog({ now: () => clock.t });
  const doc = fakeDocument(), win = fakeWindow();
  const peers = new Map([['peer-Bob', { id: 'peer-Bob', name: 'Bob' }], ['peer-Zed', { id: 'peer-Zed', name: 'Zed' }]]);
  const sent = [];
  // world.js's socialRowActions, word for word (AUDIT SOC C15: two doors - Remove is the panel's, behind its confirm)
  const rowActions = (peerId) => {
    const a = social.actionsFor(peerId);
    return [
      { label: 'Add friend', enabled: a.canFriend, why: a.whyNotFriend, run: () => sent.push({ k: 'friend.request', peer: peerId }) },
      { label: 'Invite to party', enabled: a.canInvite, why: a.whyNotInvite, run: () => sent.push({ k: 'party.invite', peer: peerId }) },
    ];
  };
  const panel = createChatPanel({ log, onSend: () => true, roster: () => ({ id: 'peer-me', name: 'Mac', peers }), action: defaultAction, doc, win, touch: false, rowActions });
  const root = doc.body.children[0];
  panel.open();
  const rowFor = (who) => find(root, 'dfchat-who-row').find((r) => one(r, 'dfchat-who-name').textContent === who);
  assert.equal(find(root, 'dfchat-rowmenu').length, 0, 'nothing is open to begin with');
  assert.match(rowFor('Zed').className, /\bact\b/, 'a stranger\'s row is a door');
  assert.doesNotMatch(rowFor('Mac').className, /\bact\b/, 'my own is not - "Add friend" on my own name can never mean anything');
  rowFor('Mac').fire('click');
  assert.equal(find(root, 'dfchat-rowmenu').length, 0, 'and clicking it opens nothing');

  rowFor('Zed').fire('click');
  let menu = one(root, 'dfchat-rowmenu');
  assert.ok(menu, 'a stranger\'s row opens one');
  assert.deepEqual(find(menu, 'dfchat-rowbtn').map((b) => b.textContent), ['Add friend', 'Invite to party'], 'a stranger is friended or invited, and nothing else');
  find(menu, 'dfchat-rowbtn')[0].fire('click');
  assert.deepEqual(sent, [{ k: 'friend.request', peer: 'peer-Zed' }], 'by PEER id - a stranger has no account I can name');
  assert.equal(find(root, 'dfchat-rowmenu').length, 0, 'and the menu closes behind the act');

  // a friend: the same two doors (AUDIT SOC C15: no one-click Remove here), and Add friend is refused WITH ITS REASON
  rowFor('Bob').fire('click');
  menu = one(root, 'dfchat-rowmenu');
  assert.deepEqual(find(menu, 'dfchat-rowbtn').map((b) => b.textContent), ['Add friend', 'Invite to party']);
  assert.equal(find(menu, 'dfchat-rowbtn')[0].disabled, true);
  assert.equal(find(menu, 'dfchat-rowbtn')[0].attrs.title, 'already friends', 'a refused act is a SENTENCE, not a missing button');
  find(menu, 'dfchat-rowbtn')[0].fire('click');
  assert.equal(sent.length, 1, 'and a disabled one sends nothing');
  find(menu, 'dfchat-rowbtn')[1].fire('click');
  assert.deepEqual(sent[1], { k: 'party.invite', peer: 'peer-Bob' }, 'a friend is invited from the row by PEER - the row is the tab in front of me');

  // the open menu survives the frame (the roster repaints on a CHANGE, and an opened row IS one)
  rowFor('Bob').fire('click');
  assert.equal(find(root, 'dfchat-rowmenu').length, 1);
  for (let i = 0; i < 5; i++) panel.render();
  assert.equal(find(root, 'dfchat-rowmenu').length, 1, 'five frames later it is still open');
  rowFor('Bob').fire('click');
  assert.equal(find(root, 'dfchat-rowmenu').length, 0, 'and a second click on the row shuts it');

  // my party's own seat is refused an invitation, in words
  social.apply({ t: 'social', k: 'party', party: { id: 'q-1', leader: 'acct-me', members: [member('me', { acct: 'acct-me', name: 'Mac' }), member('Bob')] } });
  panel.render();
  rowFor('Bob').fire('click');
  menu = one(root, 'dfchat-rowmenu');
  assert.equal(find(menu, 'dfchat-rowbtn')[1].disabled, true);
  assert.equal(find(menu, 'dfchat-rowbtn')[1].attrs.title, 'in your party');

  // ...and a host whose picture is not up yet (no account, no hub - world.js socialRowActions answers []) leaves
  // every row a plain name: a door with nothing behind it is worse than no door
  const empty = fakeDocument();
  const ep = createChatPanel({ log: new ChatLog(), onSend: () => true, roster: () => ({ id: 'peer-me', name: 'Mac', peers }), action: defaultAction, doc: empty, win: fakeWindow(), touch: false, rowActions: () => [] });
  ep.open();
  const eroot = empty.body.children[0];
  assert.equal(find(eroot, 'dfchat-who-row').length, 3);
  for (const r of find(eroot, 'dfchat-who-row')) { assert.doesNotMatch(r.className, /\bact\b/); r.fire('click'); }
  assert.equal(find(eroot, 'dfchat-rowmenu').length, 0, 'nothing to offer, nothing opens');
});

// ═══ THE HOST ════════════════════════════════════════════════════════

test('SOC3: the host by source - world.js makes the panel in socialStart over the picture the hub filled, hands the chat the button, the colours and the roster\'s doors as LAZY closures, puts the panel on hudCtx for SOC5, and renders it on the chat frame under the chat\'s own covering rule (mutants: the panel made before the picture; the closures captured eagerly; the render outside the chat frame; the pointer doors dropped)', () => {
  const w = rd('src/scenes/world.js');
  const bare = w.replace(/^\s*\/\/.*$/gm, '');
  assert.match(w, /import \{ createSocialPanel, TRY_AGAIN_TEXT \} from '\.\.\/ui\/socialPanel\.js';/, 'AUDIT SOC B17: the panel\'s own "try again" is the F-menu\'s too');
  assert.match(w, /import \{ SocialState, accountId, accountSecret \} from '\.\.\/net\/social\.js';/,
    'the host imports no colour at all - the one module that knows what a party is answers cssColorOf (SOC7 integration: SOC4 holds world.js to naming no green)');
  assert.match(w, /\n  let socialPanel = null;/, 'beside `social`, in the host\'s own scope');

  // the chat's three seams, and every one a closure - `social` and `socialPanel` are both null when this call runs
  assert.match(bare, /social: \{ onToggle: \(\) => socialPanel\?\.toggle\(\), pending: \(\) => social\?\.pendingCount\(\) \?\? 0 \},/);
  assert.match(bare, /nameColor: \(id\) => social\?\.cssColorOf\(id\) \?\? null,/);   // SOC7 integration: the colour is the picture's answer (net/social.js cssColorOf), never named in the host - SOC4's pin holds world.js to asking
  assert.match(bare, /rowActions: \(peerId\) => socialRowActions\(peerId\),/);
  assert.ok(w.indexOf('chatPanel = createChatPanel({') < w.indexOf('socialStart();'), 'the panel is built before the picture lands beside it, which is why all three are lazy');

  // the roster's doors: peer for a stranger, account for the friend I already hold
  assert.match(bare, /\{ label: 'Add friend', enabled: a\.canFriend, why: a\.whyNotFriend, run: \(\) => socialLink\(\)\?\.sendSocial\(\{ k: 'friend\.request', peer: peerId \}\) \?\? false \}/);
  assert.match(bare, /\{ label: 'Invite to party', enabled: a\.canInvite, why: a\.whyNotInvite, run: \(\) => socialLink\(\)\?\.sendSocial\(\{ k: 'party\.invite', peer: peerId \}\) \?\? false \}/);
  assert.doesNotMatch(bare, /label: 'Remove friend'/, 'AUDIT SOC C15: no one-click Remove on a roster row - the panel\'s two-click Remove is the one door out of a friendship');

  // the panel itself, inside socialStart and AFTER the state exists
  const start = w.slice(w.indexOf('const socialStart = () => {'), w.indexOf('const composePartyPose'));
  assert.ok(start.includes('social = new SocialState({ acct: link.acct });'), 'the picture (AUDIT SOC B19: expecting the account this session sent)');
  assert.ok(start.indexOf('social = new SocialState({ acct: link.acct });') < start.indexOf('socialPanel = createSocialPanel({'), 'and the panel over it, never before it');
  assert.match(start, /socialPanel = createSocialPanel\(\{\s*social,\s*send: \(act\) => socialLink\(\)\?\.sendSocial\(act\) \?\? false,/, 'one arrow out, the hub link\'s - and its false is the rate gate\'s answer');
  assert.match(start, /canOpen: \(\) => !gamePaused\(\) && !\(townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\)\),/, 'the chat\'s own door: no pointer surface under a window');
  assert.match(start, /onOpen: \(\) => surfaceOpen\('social'\),/, 'AUDIT SOC B6: the panel is a COUNTED pointer surface');
  assert.match(start, /onClose: \(\) => surfaceClose\('social'\),/);
  assert.match(bare, /const surfaceOpen = \(name\) => \{ pointerSurfaces\.add\(name\); setCursorActive\(false\); releaseLook\(\); \};/, 'the first surface up frees the mouse');
  assert.match(bare, /const surfaceClose = \(name\) => \{ pointerSurfaces\.delete\(name\); if \(!pointerSurfaces\.size && !gamePaused\(\)\) requestLook\(canvas\); \};/, 'the LAST surface down takes it back');
  assert.match(bare, /if \(!gamePaused\(\) && !pointerSurfaces\.size && document\.pointerLockElement !== canvas\) requestLook\(canvas\);/, 'and the key ladder\'s resting-state relock waits while any stands');
  assert.doesNotMatch(bare, /hudCtx\.openSocial/, 'AUDIT SOC B14/D11: the second door to the panel is gone - SOC5\'s key reaches it through socialInteract\'s nobody-in-front arm');

  // the frame: after the party pose, under the same covering rule the chat renders with
  // matched around the prose rather than through it: SOC2's pose line carries its own trailing comment, and the
  // line this slice adds carries two of its own above it
  assert.match(w, /partyFrame\(performance\.now\(\)\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*socialPanel\?\.render\(\{ covered: townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\) \|\| gamePaused\(\) \}\);/,
    'on the chat frame, after SOC2\'s pose line, with the host\'s word on being covered');
  const frame = w.slice(w.indexOf('const chatFrame = () => {'), w.indexOf('/** WORLD3: the peers in my room'));
  assert.ok(frame.includes('socialPanel?.render('), 'and inside chatFrame, which is the one frame the chat\'s surfaces ride');
  assert.equal((w.match(/socialPanel\?\.render\(/g) ?? []).length, 1, 'once a frame, from one place');
});
