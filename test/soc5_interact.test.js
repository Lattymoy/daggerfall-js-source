// SOC5 (2026-09-16, Mac: "Players should be able to interact with others in the world upon encountering them by
// pressing F on their body, which should show options to add as a friend or invite to a party"): F ON A BODY.
//
// FOUR LAWS, and each is driven rather than read where it can be:
//   - THE ACTION. 'SocialInteract' is appended past DFU's forty-four (the port's own, Ledger A / ONLINE), parses,
//     defaults to KeyF, and - the case that matters for a live save - is autofilled into a bindings file written
//     BEFORE this slice, without disturbing a key that player had already bound themselves.
//   - THE ROUTE. ui/input.js routeAction hands the action to `ctx.socialInteract`, and passes the door's own answer
//     back: a false is "nothing social to do here", and the host's ladder must fall through on it.
//   - THE REACH. player/socialPick.js pickPeerInFront, with plain vectors and the REAL cylinder test
//     (scenes/townTalk.js rayPersonDistance, handed in the way the host hands it in): nearest in front wins, behind
//     is not in the race, past the reach is nobody at all.
//   - THE MENU. ui/socialMenu.js over a fake document and a two-phase fake window: the buttons, the disabled reasons,
//     the act each sends, Escape, the pointer hooks, and the refusal under a window.
// Plus the wiring, by source, in scenes/world.js - the one file too large to instantiate in node.
//
// The fake document and window are chat1.test.js's shape, copied rather than shared: a fake DOM that serves two
// files starts serving three, and then it is a framework whose own behaviour nobody pins.
//
// Every pin names the mutants it kills.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTIONS, DEFAULT_BINDINGS, parseActionName, createBindings, resetDefaults, setBinding, getBinding, actionForCode, loadKeyBinds, serializeKeyBinds } from '../src/systems/inputActions.js';
import { routeAction } from '../src/ui/input.js';
import { GRID_ACTIONS, ADVANCED_ROWS, PORT_ROWS, PORT_GROUP_TITLE } from '../src/ui/enhancedControls.js';
import { KEY_GROUPS, gridButtons } from '../src/ui/controlsWindow.js';
import { pickPeerInFront, SOCIAL_REACH } from '../src/player/socialPick.js';
import { rayPersonDistance, PERSON_HIT_RADIUS, PERSON_HIT_HEIGHT } from '../src/scenes/townTalk.js';
import { MOBILE_NPC_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { createSocialMenu, socialMenuRows, SOCIAL_MENU_STYLE_ID } from '../src/ui/socialMenu.js';
import { SocialState } from '../src/net/social.js';
import { SOCIAL_ACTS } from '../src/net/wire.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ── THE ACTION ───────────────────────────────────────────────────────

test('SOC5: the port\'s own action - appended past DFU\'s forty-four, parseable, defaulted to KeyF, and NOT spliced into the middle where the classic grid indexes by number (mutants: the name inserted mid-list; a name the parser answers Unknown for; a default on a key DFU already spends)', () => {
  assert.equal(ACTIONS.at(-1), 'SocialInteract', 'the LAST row - ui/controlsWindow.js reads this list by index against fixed art');
  assert.equal(ACTIONS.indexOf('SocialInteract'), ACTIONS.length - 1);
  assert.equal(ACTIONS.filter((a) => a === 'SocialInteract').length, 1);
  // DFU's own enum is untouched up to its end: AutoRun was the last row and still sits where it sat.
  assert.equal(ACTIONS[ACTIONS.length - 2], 'AutoRun');
  assert.equal(ACTIONS.indexOf('AutoRun'), 43, 'DFU\'s 44 rows keep every index they had');
  assert.equal(parseActionName('SocialInteract'), 'SocialInteract');
  assert.equal(parseActionName('SocialInteractt'), 'Unknown', 'the sentinel still answers for a near miss');
  // the default row, and the fact that makes KeyF spendable at all
  const defaults = new Map(DEFAULT_BINDINGS.map(([c, a]) => [c, a]));
  assert.equal(defaults.get('KeyF'), 'SocialInteract');
  assert.equal(DEFAULT_BINDINGS.filter(([, a]) => a === 'SocialInteract').length, 1);
  assert.equal(DEFAULT_BINDINGS.at(-1)[1], 'SocialInteract', 'appended, like the action itself');
  const codes = DEFAULT_BINDINGS.map(([c]) => c);
  assert.equal(codes.filter((c) => c === 'KeyF').length, 1, 'KeyF was free in SetupDefaults and is spent exactly once');
  // a live store built from the defaults answers F with the action, and the action with F
  const s = createBindings();
  resetDefaults(s);
  assert.equal(actionForCode(s, 'KeyF'), 'SocialInteract');
  assert.equal(getBinding(s, 'SocialInteract'), 'KeyF');
  // it is a WHY, not an accident: the source says the departure out loud
  const src = rd('src/systems/inputActions.js');
  assert.match(src, /SOC5/, 'the slice tag');
  assert.match(src, /Ledger A row \(ONLINE\)/, 'the departure note - DFU has no such action');
});

test('SOC5: a bindings file written BEFORE this slice gains KeyF on the next boot, and a player who had already bound F to something else keeps it (mutants: the autofill stealing a bound key; the merge skipped so an existing player never gets the action)', () => {
  // The startup path is loadKeyBinds then resetDefaults(store, true) - loadOrCreateBindings', and DFU's :445-448.
  // An OLD file: every default of the day, and no SocialInteract row, because the action did not exist.
  const old = createBindings();
  resetDefaults(old);
  const file = serializeKeyBinds(old);
  delete file.actionKeyBinds.KeyF;   // the file as it was written before SOC5: nothing on F at all
  const fresh = createBindings();
  loadKeyBinds(fresh, file);
  assert.equal(actionForCode(fresh, 'KeyF'), null, 'the file itself says nothing about F');
  resetDefaults(fresh, true);
  assert.equal(actionForCode(fresh, 'KeyF'), 'SocialInteract', 'the autofill gives an existing player the action - no reset, no lost bindings');
  assert.equal(getBinding(fresh, 'Rest'), 'KeyR', 'and disturbs nothing else');
  // and the other way: a player who put Rest on F keeps Rest on F, and SocialInteract simply arrives unbound
  const mine = createBindings();
  loadKeyBinds(mine, file);
  setBinding(mine, 'KeyF', 'Rest');
  resetDefaults(mine, true);
  assert.equal(actionForCode(mine, 'KeyF'), 'Rest', 'testSetBinding never steals a code the player has spent');
  assert.equal(getBinding(mine, 'SocialInteract'), null, 'so the new action waits, rebindable, rather than fighting for the key');
});

test('SOC5: the enhanced controls window offers the action in its own group, and the CLASSIC window cannot place it - which is the reason the group exists (mutants: the action dropped from the pane and so unrebindable; GRID_ACTIONS widened past DFU\'s slice; a seventh ADVANCED row the classic popup has never heard of)', () => {
  assert.deepEqual([...PORT_ROWS], [{ action: 'SocialInteract', label: 'Interact with player' }]);
  assert.equal(PORT_GROUP_TITLE, 'Online');
  // the two existing lists keep their meaning exactly
  assert.deepEqual([...GRID_ACTIONS], ACTIONS.slice(2, 40), 'GRID_ACTIONS is still DFU\'s SetupKeybindButtons slice');
  assert.equal(GRID_ACTIONS.length, 38);
  assert.equal(ADVANCED_ROWS.length, 6);
  assert.ok(!GRID_ACTIONS.includes('SocialInteract') && !ADVANCED_ROWS.some((r) => r.action === 'SocialInteract'));
  // coverage: every bindable action has exactly one row across the three groups
  const all = [...GRID_ACTIONS, ...ADVANCED_ROWS.map((r) => r.action), ...PORT_ROWS.map((r) => r.action)];
  assert.equal(new Set(all).size, all.length, 'none twice');
  assert.deepEqual([...all].sort(), [...ACTIONS].sort(), 'and none missing');
  // the pane draws the third group
  const pane = rd('src/ui/enhancedControls.js');
  assert.match(pane, /group\(body, PORT_GROUP_TITLE, PORT_ROWS\.map\(\(r\) => \[r\.action, r\.label\]\)\);/, 'the group is rendered, not merely declared');
  // THE CLASSIC WINDOW CANNOT. Its buttons are pixels on CNFG00I0.IMG, nine groups over Actions[2..40), and the
  // lowest rows already run to within two pixels of the tab row at y=190 - a tenth row needs eleven.
  assert.equal(KEY_GROUPS.at(-1).end, 40, 'the classic grid still ends at DFU\'s 40');
  assert.equal(gridButtons().length, 38);
  assert.ok(!gridButtons().some((b) => b.action === 'SocialInteract'));
  const lowest = Math.max(...KEY_GROUPS.map((g) => g.y + (g.end - g.start - 1) * 11));
  assert.equal(lowest, 181); assert.ok(lowest + 7 + 11 > 190, 'no room below the last row before the tabs');
  assert.match(rd('src/ui/controlsWindow.js'), /SOC5[\s\S]{0,1600}enhancedControls\.js PORT_ROWS/, 'and the window says so where the table is, with the pointer to the door that does have room');
});

// ── THE ROUTE ────────────────────────────────────────────────────────

test('SOC5: routeAction sends the action to ctx.socialInteract and passes the DOOR\'S answer back - true consumes the key, false falls through, and a host with no door consumes nothing (mutants: the arm returning a bare true so F is eaten on an offline page; the arm missing so F is dead)', () => {
  const calls = [];
  assert.equal(routeAction('SocialInteract', { socialInteract: () => { calls.push(1); return true; } }), true);
  assert.deepEqual(calls, [1], 'called once, with no arguments it must invent');
  assert.equal(routeAction('SocialInteract', { socialInteract: () => false }), false, 'the offline answer falls through the ladder');
  assert.equal(routeAction('SocialInteract', { socialInteract: () => undefined }), false, 'a door that answers nothing is not a door that consumed');
  assert.equal(routeAction('SocialInteract', {}), false, 'a host without the arm');
  // the arm is the action's own and steals nothing from its neighbours
  let rest = 0, pause = 0;
  routeAction('Rest', { toggleRest: () => { rest++; } });
  routeAction('Escape', { togglePause: () => { pause++; } });
  assert.deepEqual([rest, pause], [1, 1]);
  assert.match(rd('src/ui/input.js'), /case 'SocialInteract': return ctx\.socialInteract\?\.\(\) === true;/, 'the arm, as it stands');
});

// ── THE REACH ────────────────────────────────────────────────────────

const peer = (id, feet) => ({ id, feet, height: 1.8 });

test('SOC5: the reach law with plain vectors and the port\'s own cylinder - the nearest in front wins, behind is not in the race, past the reach is nobody, and a tie keeps the order the room was handed in (mutants: <= for the nearest so a tie flips; the reach applied per peer so a far one shields a near one; a behind peer measured by absolute distance)', () => {
  // The reach is the GAME'S own person reach, not a number invented here.
  assert.equal(SOCIAL_REACH, MOBILE_NPC_ACTIVATION_DISTANCE);
  assert.ok(Math.abs(SOCIAL_REACH - 6.4) < 1e-9, 'PlayerActivate.cs:88 - 256 * GlobalScale');
  // A camera at the origin at eye height, looking down +Z (the host's own forward when yaw = 0, pitch = 0).
  const cam = [0, 1.6, 0];
  const fwd = [0, 0, 1];
  const pick = (peers, reach = SOCIAL_REACH) => pickPeerInFront(cam, fwd, peers, reach, rayPersonDistance);
  const near = peer('near', [0, 0, 3]), far = peer('far', [0, 0, 5]), behind = peer('behind', [0, 0, -2]);
  assert.equal(pick([far, near]).peer.id, 'near', 'the nearest in front, whatever order the room hands them in');
  assert.equal(pick([near, far]).peer.id, 'near');
  assert.ok(Math.abs(pick([near]).distance - 3) < 1e-9, 'and the distance is along the ray');
  assert.equal(pick([behind]), null, 'behind is Infinity, not a big number');
  assert.equal(pick([behind, far]).peer.id, 'far', 'so someone behind me never beats someone in front of me');
  // past the reach: the NEAREST is found first and then measured, so a far peer does not shield a farther one
  assert.equal(pick([peer('a', [0, 0, 8]), peer('b', [0, 0, 20])]), null, 'both past the reach is nobody, not the nearer of the two');
  assert.equal(pick([peer('a', [0, 0, 6.399])]).peer.id, 'a');
  assert.equal(pick([peer('a', [0, 0, 6.5])]), null);
  // the cylinder is the real one: off-axis past the radius is a miss, and a body under the floor is a miss
  assert.equal(pick([peer('side', [PERSON_HIT_RADIUS + 0.2, 0, 3])]), null, `off-axis past ${PERSON_HIT_RADIUS} misses`);
  assert.ok(pick([peer('grazed', [PERSON_HIT_RADIUS - 0.05, 0, 3])]), 'and inside it hits');
  assert.equal(pick([peer('below', [0, -(PERSON_HIT_HEIGHT + 2), 3])]), null, 'the height gate is the cylinder\'s');
  // a tie keeps the FIRST - one ray has one hit, and the room's order is the only tie-break there is
  assert.equal(pick([peer('first', [0, 0, 3]), peer('second', [0, 0, 3])]).peer.id, 'first');
  // and the shapes that must not throw
  assert.equal(pickPeerInFront(cam, fwd, null, SOCIAL_REACH, rayPersonDistance), null, 'no room, no peer');
  assert.equal(pickPeerInFront(cam, fwd, [], SOCIAL_REACH, rayPersonDistance), null);
  assert.equal(pick([{ id: 'nofeet' }, near]).peer.id, 'near', 'a peer whose body is not standing yet has no feet to aim at');
  assert.equal(pickPeerInFront(cam, fwd, [near], SOCIAL_REACH, null), null, 'no cylinder handed in, no answer invented');
  // the module keeps ONE cylinder law: it never restates the radius or the height
  const src = rd('src/player/socialPick.js');
  assert.doesNotMatch(src, /0\.45|1\.8/, 'the cylinder is handed in, never copied');
});

// ── THE MENU ─────────────────────────────────────────────────────────

// chat1.test.js's fake document, copied: a shared fake DOM would be a framework nobody pins.
function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', title: '',
    disabled: false, style: {}, dataset: {}, attrs: {}, listeners: new Map(),
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener(t, fn) { const l = n.listeners.get(t) ?? []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    fire(t, e = {}) { const ev = { type: t, target: n, prevented: false, stopped: false, preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; }, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
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
/** A window with BOTH phases (AUDIT CHAT D2): the capture pass, then - unless propagation was stopped - the bubble
 *  pass, where the host's own listener lives. */
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
const rowBtn = (root, key) => find(root, 'dfsocial-btn').find((b) => b.dataset.row === key);
const labelOf = (b) => one(b, 'dfsocial-label')?.textContent;

test('SOC5: the rows the card offers - two acts always, Remove friend only for a friend, Cancel last; each act is exactly what net/wire.js SOCIAL_ACTS names, a peer for the two and an ACCOUNT for the removal (mutants: friend.remove sent with a peer the hub cannot resolve; a disabled row hidden instead of explained; Remove friend offered to a stranger)', () => {
  const stranger = socialMenuRows({ peerId: 'peer-b', acct: null, relation: 'none', canFriend: true, canInvite: true });
  assert.deepEqual(stranger.map((r) => r.key), ['friend', 'invite', 'cancel']);
  assert.deepEqual(stranger.map((r) => r.label), ['Add friend', 'Invite to party', 'Cancel']);
  assert.deepEqual(stranger[0].act, { k: 'friend.request', peer: 'peer-b' });
  assert.deepEqual(stranger[1].act, { k: 'party.invite', peer: 'peer-b' });
  assert.equal(stranger.at(-1).act, null, 'Cancel sends nothing');
  const friend = socialMenuRows({ peerId: 'peer-b', acct: 'acct-b', relation: 'friend', canFriend: false, canInvite: true, whyNotFriend: 'already friends' });
  assert.deepEqual(friend.map((r) => r.key), ['friend', 'invite', 'remove', 'cancel']);
  assert.deepEqual(friend[2].act, { k: 'friend.remove', acct: 'acct-b' }, 'a person is unfriended, not a tab');
  assert.equal(friend[0].enabled, false); assert.equal(friend[0].why, 'already friends', 'the row still stands, and says why');
  // a friend the picture holds no account for gets no removal row: the button would be one the hub cannot honour
  assert.equal(socialMenuRows({ peerId: 'peer-b', acct: null, relation: 'friend' }).some((r) => r.key === 'remove'), false);
  // every act this menu can send is one the wire admits, with the field that kind requires
  for (const r of [...stranger, ...friend]) {
    if (!r.act) continue;
    const needs = SOCIAL_ACTS[r.act.k];
    assert.ok(needs !== undefined, `${r.act.k} is a kind the wire knows`);
    if (needs === 'acct') assert.ok(typeof r.act.acct === 'string' && !('peer' in r.act), `${r.act.k} names an account`);
    if (needs === 'target') assert.ok(typeof r.act.peer === 'string', `${r.act.k} names a peer`);
  }
});

test('SOC5: the card over a document - the name, the buttons, a disabled reason on the row AND on its title, the act sent and the card closed, the pointer freed on open and taken back on close, Escape closes and the host never sees it, a second show over another peer asks for the pointer once, and a host that will not have it opens nothing (mutants: a disabled button sending; the act sent before the card closes so a double press sends twice; onOpen fired on a re-show; the card opening under a window)', () => {
  const doc = fakeDocument(), win = fakeWindow();
  const pointer = [], acts = [], openWhenSent = [];
  const hostSaw = [];
  win.addEventListener('keydown', (e) => hostSaw.push(e.code));   // the host's shape: bubble, on the window
  let willing = true;
  let menu;
  // the card must be DOWN by the time the host is asked to send: the send can answer false and write a line, and a
  // card still standing would take the next press as a second act on a peer who may have walked away
  menu = createSocialMenu({ doc, win, canOpen: () => willing, onOpen: () => pointer.push('free'), onClose: () => pointer.push('lock'), onAct: (a) => { openWhenSent.push(menu.isOpen()); acts.push(a); } });
  const root = doc.body.children[0];
  assert.equal(root.className, 'dfsocial'); assert.equal(root.dataset.state, 'closed');
  assert.equal(doc.getElementById(SOCIAL_MENU_STYLE_ID)?.tagName, 'STYLE', 'the sheet, injected');
  createSocialMenu({ doc, win }).destroy();
  assert.equal(find(doc.head, '').filter((n) => n.id === SOCIAL_MENU_STYLE_ID).length, 1, 'injected once');
  assert.equal(one(root, 'dfsocial-card').attrs.role, 'menu');
  assert.equal(menu.isOpen(), false); assert.deepEqual(pointer, []);
  // the host will not have it: nothing opens, and nothing touches the pointer
  willing = false;
  assert.equal(menu.show({ name: 'Mac', peerId: 'peer-b', actions: { canFriend: true, canInvite: true } }), false, 'no card under a window');
  assert.deepEqual(pointer, []); assert.equal(root.dataset.state, 'closed');
  willing = true;
  // a peer id is required - the card is ABOUT somebody
  assert.equal(menu.show({ name: 'Mac', peerId: null, actions: {} }), false);
  // the real open, over a friend with a full picture
  const st = new SocialState({ now: () => 1e12 });
  st.apply({ t: 'social', k: 'state', acct: 'acct-me', name: 'Me', friends: [{ acct: 'acct-b', name: 'Bee', online: true, seen: 1e12, peers: ['peer-b'] }], in: [], out: [], party: null, invites: [] });
  assert.equal(menu.show({ name: 'Bee', peerId: 'peer-b', actions: st.actionsFor('peer-b') }), true);
  assert.equal(root.dataset.state, 'open'); assert.equal(menu.isOpen(), true); assert.equal(menu.peerId(), 'peer-b');
  assert.deepEqual(pointer, ['free'], 'the card is a pointer surface - freed inside the gesture that opened it');
  assert.equal(one(root, 'dfsocial-name').textContent, 'Bee');
  assert.deepEqual(find(root, 'dfsocial-btn').map((b) => b.dataset.row), ['friend', 'invite', 'remove', 'cancel']);
  const add = rowBtn(root, 'friend');
  assert.equal(labelOf(add), 'Add friend');
  assert.equal(add.disabled, true, 'a friend cannot be friended again');
  assert.equal(add.attrs.disabled, '', 'and the attribute, for a real button');
  assert.equal(add.title, 'already friends', 'the reason, as a title');
  assert.equal(one(add, 'dfsocial-why').textContent, 'already friends', 'and on the row, where a mouse is not needed to read it');
  assert.equal(rowBtn(root, 'invite').disabled, false);
  assert.equal(one(rowBtn(root, 'invite'), 'dfsocial-why'), undefined, 'a lit row carries no reason');
  // a disabled button's click is nothing, however it arrived
  add.fire('click');
  assert.deepEqual(acts, []); assert.equal(menu.isOpen(), true);
  // the lit one sends and closes - and the CARD goes first, so a second press cannot send a second act
  rowBtn(root, 'invite').fire('click');
  assert.deepEqual(acts, [{ k: 'party.invite', peer: 'peer-b' }]);
  assert.deepEqual(openWhenSent, [false], 'the card was already down when the host was handed the act');
  assert.equal(menu.isOpen(), false); assert.equal(root.dataset.state, 'closed');
  assert.deepEqual(pointer, ['free', 'lock'], 'and the pointer comes back inside the closing gesture');
  // Cancel closes and sends nothing
  menu.show({ name: 'Bee', peerId: 'peer-b', actions: st.actionsFor('peer-b') });
  rowBtn(root, 'cancel').fire('click');
  assert.equal(menu.isOpen(), false); assert.deepEqual(acts.length, 1);
  // Escape closes, is stopped, and never reaches the host's pause door
  menu.show({ name: 'Zed', peerId: 'peer-z', actions: st.actionsFor('peer-z') });
  assert.deepEqual(find(root, 'dfsocial-btn').map((b) => b.dataset.row), ['friend', 'invite', 'cancel'], 'a stranger has no Remove friend row');
  assert.equal(rowBtn(root, 'friend').disabled, false, 'and can be friended');
  hostSaw.length = 0;
  const esc = win.key('Escape', { target: doc.body });
  assert.equal(menu.isOpen(), false);
  assert.equal(esc.prevented, true); assert.equal(esc.stopped, true);
  assert.deepEqual(hostSaw, [], 'the Escape that closed the card is not also the Escape that pauses the game');
  // a key while the card is CLOSED is nobody's but the host's
  hostSaw.length = 0;
  win.key('Escape', { target: doc.body });
  assert.deepEqual(hostSaw, ['Escape']);
  // a re-show over a second peer repaints and asks for the pointer ONCE
  menu.show({ name: 'Bee', peerId: 'peer-b', actions: st.actionsFor('peer-b') });
  pointer.length = 0;
  menu.show({ name: 'Zed', peerId: 'peer-z', actions: st.actionsFor('peer-z') });
  assert.deepEqual(pointer, [], 'already open: the lock is not asked for twice');
  assert.equal(menu.peerId(), 'peer-z'); assert.equal(one(root, 'dfsocial-name').textContent, 'Zed');
  assert.equal(find(root, 'dfsocial-btn').length, 3, 'and the rows are rebuilt, not appended to');
  // the host's frame takes it away with a window
  menu.render({ covered: false }); assert.equal(menu.isOpen(), true);
  menu.render({ covered: true }); assert.equal(menu.isOpen(), false, 'a window over the HUD takes the card with it');
  // a press inside the card is the card's; a release is never stopped
  const card = one(root, 'dfsocial-card');
  assert.equal(card.fire('mousedown').stopped, true, 'the host must not swing a weapon at its own menu');
  assert.equal(card.fire('contextmenu').stopped, true);
  assert.equal(card.listeners.has('mouseup'), false, 'AUDIT CHAT C5: a release is never stopped');
  // destroy takes the one listener with it
  const before = win.listeners.length;
  menu.destroy();
  assert.equal(win.listeners.length, before - 1);
  assert.equal(root.removed, true);
  assert.equal(menu.show({ name: 'Bee', peerId: 'peer-b', actions: {} }), false, 'a destroyed menu opens nothing');
});

test('SOC5: a name the room has not said yet still makes a sentence, and the card takes the picture\'s reasons whole - "that is you", "the party is full" (mutants: a blank heading; a reason invented here instead of read from actionsFor)', () => {
  const doc = fakeDocument(), win = fakeWindow();
  const menu = createSocialMenu({ doc, win });
  const root = doc.body.children[0];
  menu.show({ name: null, peerId: 'peer-x', actions: { canFriend: true, canInvite: true } });
  assert.equal(one(root, 'dfsocial-name').textContent, 'Someone', 'a peer whose name is still in flight is not nameless');
  const st = new SocialState({ now: () => 1e12 });
  const seat = (n) => ({ acct: `acct-${n}`, name: n, online: true, seen: 1e12, peers: [`peer-${n}`], p: null });
  st.apply({ t: 'social', k: 'state', acct: 'acct-me', name: 'Me', friends: [], in: [], out: [], party: null, invites: [] });
  st.apply({ t: 'social', k: 'party', party: { id: 'q-1', leader: 'acct-me', members: [{ ...seat('me'), acct: 'acct-me', peers: ['peer-me'] }, seat('b'), seat('c'), seat('d')] } });
  menu.show({ name: 'Zed', peerId: 'peer-z', actions: st.actionsFor('peer-z') });
  assert.equal(rowBtn(root, 'invite').disabled, true);
  assert.equal(rowBtn(root, 'invite').title, 'the party is full', 'the hub\'s own four seats, said in the picture\'s words');
  menu.show({ name: 'Me', peerId: 'peer-me', actions: st.actionsFor('peer-me') });
  assert.equal(rowBtn(root, 'friend').title, 'that is you');
  assert.equal(rowBtn(root, 'invite').title, 'that is you');
  assert.equal(rowBtn(root, 'friend').disabled, true); assert.equal(rowBtn(root, 'invite').disabled, true);
  menu.destroy();
});

// ── THE WIRING ───────────────────────────────────────────────────────

test('SOC5: scenes/world.js - the door on hudCtx, the ray read as the activation site reads it, the reach law by the one pure helper, the menu built beside the picture and taken away by a window (mutants: a second cylinder written out in the host; the menu built without the picture so F acts on a page with no account; hudCtx.socialInteract missing so the route has no door)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ pickPeerInFront, SOCIAL_REACH \} from '\.\.\/player\/socialPick\.js';/);
  assert.match(w, /import \{ createSocialMenu \} from '\.\.\/ui\/socialMenu\.js';/);
  assert.match(w, /hudCtx\.socialInteract = socialInteract;/, 'the door routeAction reaches');
  // the door sits AFTER peersNear, because peersNear is the list it measures
  assert.ok(w.indexOf('const peersNear = () =>') < w.indexOf('const socialInteract = () =>'), 'the door is written below the peers it reads');
  assert.ok(w.indexOf('const socialInteract = () =>') < w.indexOf('hudCtx.socialInteract = socialInteract;'));
  // the three answers
  assert.match(w, /const socialInteract = \(\) => \{\s*\n\s*if \(!social\) return false;/, 'offline: the ladder falls through');
  assert.match(w, /if \(socialMenu\?\.isOpen\(\)\) \{ socialMenu\.hide\(\); return true; \}/, 'a second F closes the card');
  assert.match(w, /if \(!hit\) \{ socialPanel\?\.toggle\?\.\(\); return true; \}/, 'nobody in front: SOC3\'s panel, through optional calls');
  assert.match(w, /SOC3/, 'and SOC3 is named where its slot is used');
  // the ray is the ACTIVATION ray's own reading, and the cylinder is the port's one test
  assert.match(w, /const fwd = \[Math\.sin\(cam\.yaw\) \* Math\.cos\(cam\.pitch\), Math\.sin\(cam\.pitch\), Math\.cos\(cam\.yaw\) \* Math\.cos\(cam\.pitch\)\];/, 'the same forward the activation site composes');
  assert.match(w, /pickPeerInFront\(cam\.pos, fwd, near, SOCIAL_REACH, rayPersonDistance\)/, 'one law, one cylinder, the host\'s own camera');
  assert.equal((w.match(/rayPersonDistance\(/g) ?? []).length, 1, 'the host still calls the cylinder in exactly one place - the other site hands it to raceActivation as a list');
  // the menu is built beside the picture, over the LIVE link, and its acts write a line
  assert.match(w, /socialMenu = createSocialMenu\(\{/);
  assert.ok(w.indexOf('const socialStart = () => {') < w.indexOf('socialMenu = createSocialMenu({'), 'built inside socialStart - so it exists exactly when `social` does');
  assert.match(w, /const went = socialLink\(\)\?\.sendSocial\(act\) === true;/, 'the act leaves through the live session, never a captured one');
  assert.match(w, /chatLog\.push\(tab\.id, \{ text: went \? socialActText\(act\.k, who\) : \(hub\?\.status === 'open' \? TRY_AGAIN_TEXT : NOT_CONNECTED_TEXT\), system: true \}\);/, 'a word either way, on the world tab, flagged as nobody\'s line - AUDIT SOC B17: the panel\'s "try again" when the gate refused, "not connected" when there is no link to try again on');
  assert.match(w, /const NOT_CONNECTED_TEXT = 'You are not connected';/);
  assert.match(w, /Friend request sent to \$\{who\}/); assert.match(w, /Party invite sent to \$\{who\}/);
  // the pointer door is the chat's, and the open gate is the chat's
  assert.match(w, /onOpen: \(\) => surfaceOpen\('menu'\),   \/\/ AUDIT CHAT C2's law/, 'AUDIT SOC B6: the card is a counted pointer surface');
  assert.match(w, /if \(!townTalk\.overlayActive && act === 'SocialInteract' && socialMenuCanOpen\(\) && socialInteract\(\)\) \{ e\.preventDefault\(\); return; \}/, 'AUDIT SOC B4/D1: the door answers ABOVE the exterior gate - F on a body works in a tavern and a dungeon');
  assert.ok(w.indexOf("act === 'SocialInteract' && socialMenuCanOpen()") < w.indexOf("if (!townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior') {"), 'written above the mode gate, not inside it');
  assert.match(w, /onClose: \(\) => \{ if \(!gamePaused\(\)\) requestLook\(canvas\); \},   \/\/ and taken back inside the one that closed/);
  assert.match(w, /const socialMenuCanOpen = \(\) => !gamePaused\(\) && !\(townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\)\);/, 'the chat\'s own gate: a window\'s keys are the window\'s');
  assert.match(w, /socialMenu\?\.render\(\{ covered: townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\) \|\| gamePaused\(\) \}\);/, 'and a window that opens later takes the card with it');
});
