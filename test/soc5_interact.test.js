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
import { KEYBIND_ROWS } from '../src/ui/mouseControlsWindow.js';   // KB1: the ADVANCED popup's own six
import { ACTION_GROUPS, HIDDEN_ACTIONS } from '../src/systems/inputActions.js';
import { KEY_GROUPS, gridButtons } from '../src/ui/controlsWindow.js';
import { pickPeerInFront, SOCIAL_REACH } from '../src/player/socialPick.js';
import { rayPersonDistance, PERSON_HIT_RADIUS, PERSON_HIT_HEIGHT } from '../src/scenes/townTalk.js';
import { MOBILE_NPC_ACTIVATION_DISTANCE } from '../src/player/activate.js';
import { createSocialMenu, socialMenuRows, SOCIAL_MENU_STYLE_ID, SOCIAL_MENU_CSS } from '../src/ui/socialMenu.js';
import { SOCIAL_CSS } from '../src/ui/socialPanel.js';   // AUDIT SOC C1: the two sheets must share no selector
import { SocialState } from '../src/net/social.js';
import { SOCIAL_ACTS, PARTY_MAX } from '../src/net/wire.js';
import { PORT_ACTIONS } from '../src/systems/inputActions.js';   // AUDIT SOC D3
import { createUnsavedKeybinds, setUnsavedBinding, checkDuplicates, applyUnsavedKeybinds, currentDict } from '../src/systems/controlsConfig.js';
import { modSetting, _resetModSettings } from '../src/systems/modSettings.js';   // AUDIT SOC D4

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// ── THE ACTION ───────────────────────────────────────────────────────

test('SOC5: the port\'s own action - appended past DFU\'s forty-four, parseable, defaulted to KeyF, and NOT spliced into the middle where the classic grid indexes by number (mutants: the name inserted mid-list; a name the parser answers Unknown for; a default on a key DFU already spends)', () => {
  // QS2 appended three more past it, under the same law - so what SOC5 owns
  // here is that its row sits past DFU's forty-four and that nothing was
  // spliced in front of it, not that it is last for ever.
  assert.equal(ACTIONS.indexOf('SocialInteract'), 44, 'the FIRST row past DFU\'s forty-four - ui/controlsWindow.js reads this list by index against fixed art');
  assert.equal(ACTIONS.filter((a) => a === 'SocialInteract').length, 1);
  // DFU's own enum is untouched up to its end: AutoRun was its last row and still sits where it sat.
  assert.equal(ACTIONS[43], 'AutoRun');
  assert.equal(ACTIONS.indexOf('AutoRun'), 43, 'DFU\'s 44 rows keep every index they had');
  assert.equal(parseActionName('SocialInteract'), 'SocialInteract');
  assert.equal(parseActionName('SocialInteractt'), 'Unknown', 'the sentinel still answers for a near miss');
  // the default row, and the fact that makes KeyF spendable at all
  const defaults = new Map(DEFAULT_BINDINGS.map(([c, a]) => [c, a]));
  assert.equal(defaults.get('KeyF'), 'SocialInteract');
  assert.equal(DEFAULT_BINDINGS.filter(([, a]) => a === 'SocialInteract').length, 1);
  // appended past DFU's table, like the action itself (QS2 appended three more behind it). KB1 took DFU's
  // ToggleConsole and Slide rows OUT of that table (Ledger A: they ship unbound, their keys freed), so the index
  // moved from 44 to 42; what holds is that every row before it is one of DFU's own.
  const at = DEFAULT_BINDINGS.findIndex(([, a]) => a === 'SocialInteract');
  assert.ok(DEFAULT_BINDINGS.slice(0, at).every(([, a]) => ACTIONS.indexOf(a) < 44), 'only DFU\'s rows stand before it');
  assert.equal(at, 42);
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
  // KB1: the pane's groups are the registry's ACTION_GROUPS, and SOC5's row is the whole of the Online one -
  // which is the claim this pin makes.
  const online = ACTION_GROUPS.find((g) => g.title === 'Online');
  assert.deepEqual(online.rows.map((r) => ({ ...r })), [
    { action: 'SocialInteract', label: 'Interact with player' },
    { action: 'Chat', label: 'Open chat' },
  ]);
  // the classic faces keep their meaning exactly, read off the windows that draw them
  const grid = gridButtons().map((b) => b.action);
  assert.deepEqual(grid, ACTIONS.slice(2, 40), 'the grid is still DFU\'s SetupKeybindButtons slice');
  assert.equal(KEYBIND_ROWS.length, 6);
  assert.ok(!grid.includes('SocialInteract') && !KEYBIND_ROWS.some((r) => r.action === 'SocialInteract'));
  // coverage: every bindable action has exactly one row across the groups
  const all = ACTION_GROUPS.flatMap((g) => g.rows.map((r) => r.action));
  assert.equal(new Set(all).size, all.length, 'none twice');
  assert.deepEqual([...all, ...HIDDEN_ACTIONS].sort(), [...ACTIONS].sort(), 'and none missing');
  // the pane draws the groups
  const pane = rd('src/ui/enhancedControls.js');
  assert.match(pane, /for \(const grp of shownGroups\(\)\) group\(body, grp\.title, grp\.rows\.map\(\(r\) => \[r\.action, r\.label\]\)\);/, 'the groups are rendered, not merely declared');
  // THE CLASSIC WINDOW CANNOT. Its buttons are pixels on CNFG00I0.IMG, nine groups over Actions[2..40), and the
  // lowest rows already run to within two pixels of the tab row at y=190 - a tenth row needs eleven.
  assert.equal(KEY_GROUPS.at(-1).end, 40, 'the classic grid still ends at DFU\'s 40');
  assert.equal(gridButtons().length, 38);
  assert.ok(!gridButtons().some((b) => b.action === 'SocialInteract'));
  const lowest = Math.max(...KEY_GROUPS.map((g) => g.y + (g.end - g.start - 1) * 11));
  assert.equal(lowest, 181); assert.ok(lowest + 7 + 11 > 190, 'no room below the last row before the tabs');
  assert.match(rd('src/ui/controlsWindow.js'), /SOC5[\s\S]{0,1600}enhancedControls\.js, over systems\/inputActions\.js ACTION_GROUPS/, 'and the window says so where the table is, with the pointer to the door that does have room');
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
    disabled: false, focused: false, style: {}, dataset: {}, attrs: {}, listeners: new Map(),
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener(t, fn) { const l = n.listeners.get(t) ?? []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    fire(t, e = {}) { const ev = { type: t, target: n, prevented: false, stopped: false, preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; }, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { n.focused = true; doc.activeElement = n; },   // AUDIT SOC C21: the card takes focus when it is shown
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  // AUDIT SOC C25: a document with NO head is a shape this fake must survive, because that is the case the sheets'
  // `(doc.head ?? doc.body)` fallback exists for.
  const byId = (n, id) => { if (!n) return null; if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
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
      const ev = { type: 'keydown', code, target: null, isTrusted: true, prevented: false, stopped: false, immediate: false,
        preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; },
        stopImmediatePropagation() { ev.stopped = true; ev.immediate = true; }, ...e };
      for (const l of listeners) { if (ev.immediate) break; if (l.t === 'keydown' && l.capture) l.fn(ev); }
      if (!ev.stopped) for (const l of listeners) if (l.t === 'keydown' && !l.capture) l.fn(ev);
      return ev;
    },
  };
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];
const rowBtn = (root, key) => find(root, 'dfpeer-btn').find((b) => b.dataset.row === key);
const labelOf = (b) => one(b, 'dfpeer-label')?.textContent;
/** Every class selector a CSS string DECLARES - comments stripped first, because a comment that names a class is
 *  prose and not a rule. For the pin that the two social sheets share none (AUDIT SOC C1). */
const classSelectors = (css) => new Set(
  [...String(css).replace(/\/\*[\s\S]*?\*\//g, ' ').matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]));

test('SOC5 / AUDIT SOC C15: the rows the card offers - the two acts and Cancel, and NO Remove friend on any of them, whoever the peer is; each act is exactly what net/wire.js SOCIAL_ACTS names, by PEER (mutants: friend.remove back on the card, one press and unconfirmed; friend.remove sent with a peer the hub cannot resolve; a disabled row hidden instead of explained; a fourth row for a friend)', () => {
  const stranger = socialMenuRows({ peerId: 'peer-b', acct: null, relation: 'none', canFriend: true, canInvite: true });
  assert.deepEqual(stranger.map((r) => r.key), ['friend', 'invite', 'cancel']);
  assert.deepEqual(stranger.map((r) => r.label), ['Add friend', 'Invite to party', 'Cancel']);
  assert.deepEqual(stranger[0].act, { k: 'friend.request', peer: 'peer-b' });
  assert.deepEqual(stranger[1].act, { k: 'party.invite', peer: 'peer-b' });
  assert.equal(stranger.at(-1).act, null, 'Cancel sends nothing');
  // AUDIT SOC C15: A FRIEND GETS THE SAME THREE ROWS. Unfriending was a single unconfirmed press on a card that
  // opens under the crosshair from one key, while the very same act on ui/socialPanel.js arms on the first click
  // and only sends on the second. One deliberate act, one place to do it - and the panel is that place.
  const friend = socialMenuRows({ peerId: 'peer-b', acct: 'acct-b', relation: 'friend', canFriend: false, canInvite: true, whyNotFriend: 'already friends' });
  assert.deepEqual(friend.map((r) => r.key), ['friend', 'invite', 'cancel'], 'no removal row, account or no account');
  assert.equal(friend.some((r) => r.act?.k === 'friend.remove'), false, 'and no act of that kind leaves this card at all');
  assert.equal(friend[0].enabled, false); assert.equal(friend[0].why, 'already friends', 'the row still stands, and says why');
  // the picture's whole `actionsFor` answer is still accepted without being stripped by the caller
  assert.deepEqual(socialMenuRows({ peerId: 'peer-b', acct: null, relation: 'friend' }).map((r) => r.key), ['friend', 'invite', 'cancel']);
  assert.doesNotMatch(rd('src/ui/socialMenu.js').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' '), /friend\.remove/,
    'the kind is not spelled anywhere in the module, comments aside');
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
  assert.equal(root.className, 'dfpeer', 'AUDIT SOC C1: the menu\'s own prefix - it shared every class with the panel'); assert.equal(root.dataset.state, 'closed');
  assert.equal(doc.getElementById(SOCIAL_MENU_STYLE_ID)?.tagName, 'STYLE', 'the sheet, injected');
  createSocialMenu({ doc, win }).destroy();
  assert.equal(find(doc.head, '').filter((n) => n.id === SOCIAL_MENU_STYLE_ID).length, 1, 'injected once');
  assert.equal(one(root, 'dfpeer-card').attrs.role, 'menu');
  assert.equal(one(root, 'dfpeer-card').attrs.tabindex, '-1', 'AUDIT SOC C21: focusable, and out of the tab order while the card is down');
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
  assert.equal(one(root, 'dfpeer-name').textContent, 'Bee');
  assert.equal(one(root, 'dfpeer-card').focused, true, 'AUDIT SOC C21: the keyboard goes where the menu is');
  // AUDIT SOC C15: three rows for a friend too - 'Remove friend' belongs on the panel, where it is confirmed
  assert.deepEqual(find(root, 'dfpeer-btn').map((b) => b.dataset.row), ['friend', 'invite', 'cancel']);
  assert.deepEqual(find(root, 'dfpeer-btn').map((b) => b.attrs.role), ['menuitem', 'menuitem', 'menuitem'], 'AUDIT SOC C21: a menu of menu items');
  const add = rowBtn(root, 'friend');
  assert.equal(labelOf(add), 'Add friend');
  assert.equal(add.disabled, true, 'a friend cannot be friended again');
  assert.equal(add.attrs.disabled, '', 'and the attribute, for a real button');
  assert.equal(add.title, 'already friends', 'the reason, as a title');
  assert.equal(one(add, 'dfpeer-why').textContent, 'already friends', 'and on the row, where a mouse is not needed to read it');
  assert.equal(rowBtn(root, 'invite').disabled, false);
  assert.equal(one(rowBtn(root, 'invite'), 'dfpeer-why'), undefined, 'a lit row carries no reason');
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
  assert.deepEqual(find(root, 'dfpeer-btn').map((b) => b.dataset.row), ['friend', 'invite', 'cancel']);
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
  assert.equal(menu.peerId(), 'peer-z'); assert.equal(one(root, 'dfpeer-name').textContent, 'Zed');
  assert.equal(find(root, 'dfpeer-btn').length, 3, 'and the rows are rebuilt, not appended to');
  // the host's frame takes it away with a window
  menu.render({ covered: false }); assert.equal(menu.isOpen(), true);
  menu.render({ covered: true }); assert.equal(menu.isOpen(), false, 'a window over the HUD takes the card with it');
  // a press inside the card is the card's; a release is never stopped
  const card = one(root, 'dfpeer-card');
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
  assert.equal(one(root, 'dfpeer-name').textContent, 'Someone', 'a peer whose name is still in flight is not nameless');
  const st = new SocialState({ now: () => 1e12 });
  const seat = (n) => ({ acct: `acct-${n}`, name: n, online: true, seen: 1e12, peers: [`peer-${n}`], p: null });
  st.apply({ t: 'social', k: 'state', acct: 'acct-me', name: 'Me', friends: [], in: [], out: [], party: null, invites: [] });
  st.apply({ t: 'social', k: 'party', party: { id: 'q-1', leader: 'acct-me', members: [{ ...seat('me'), acct: 'acct-me', peers: ['peer-me'] }, ...Array.from({ length: PARTY_MAX - 1 }, (_, i) => seat(`s${i}`))] } });   // PARTY8: every seat the bound allows
  menu.show({ name: 'Zed', peerId: 'peer-z', actions: st.actionsFor('peer-z') });
  assert.equal(rowBtn(root, 'invite').disabled, true);
  assert.equal(rowBtn(root, 'invite').title, 'the party is full', 'the hub\'s own seats, said in the picture\'s words');
  menu.show({ name: 'Me', peerId: 'peer-me', actions: st.actionsFor('peer-me') });
  assert.equal(rowBtn(root, 'friend').title, 'that is you');
  assert.equal(rowBtn(root, 'invite').title, 'that is you');
  assert.equal(rowBtn(root, 'friend').disabled, true); assert.equal(rowBtn(root, 'invite').disabled, true);
  menu.destroy();
});

// ── THE WIRING ───────────────────────────────────────────────────────

test('SOC5: scenes/world.js - the door on hudCtx, the ray read as the activation site reads it, the reach law by the one pure helper, the menu built beside the picture and taken away by a window (mutants: a second cylinder written out in the host; the menu built without the picture so F acts on a page with no account; hudCtx.socialInteract missing so the route has no door)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /import \{ pickPeerInFront, SOCIAL_REACH(?:, [^}]*)? \} from '\.\.\/player\/socialPick\.js';/);   // PEER-PLAQUE1: the plaque's half rides the same import
  assert.match(w, /import \{ createSocialMenu(?:, [^}]*)? \} from '\.\.\/ui\/socialMenu\.js';/);
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
  // AUDIT DISC7 A6: through `peerInSight` - the same one law and cylinder, and a wall in front of the player blocks it
  assert.match(w, /const peerInSight = \(eye, dir\) => \{\s*\n\s*const hit = pickPeerInFront\(eye, dir, peersNear\(\), SOCIAL_REACH, rayPersonDistance\);/, 'one law, one cylinder');
  assert.match(w, /const hit = peerInSight\(cam\.pos, socialFwd\(\)\);/, 'the host\'s own camera');   // AUDIT DROPS E3: the forward is a named function now, shared with the plaque's modal pick
  assert.match(w, /const socialFwd = \(\) => \[Math\.sin\(cam\.yaw\) \* Math\.cos\(cam\.pitch\), Math\.sin\(cam\.pitch\), Math\.cos\(cam\.yaw\) \* Math\.cos\(cam\.pitch\)\];/, 'the ray read as the activation site reads it');
  assert.equal((w.match(/rayPersonDistance\(/g) ?? []).length, 1, 'the host still calls the cylinder in exactly one place - the other site hands it to raceActivation as a list');
  // the menu is built beside the picture, over the LIVE link, and its acts write a line
  assert.match(w, /socialMenu = createSocialMenu\(\{/);
  assert.ok(w.indexOf('const socialStart = () => {') < w.indexOf('socialMenu = createSocialMenu({'), 'built inside socialStart - so it exists exactly when `social` does');
  assert.match(w, /const hub = socialLink\(\);\r?\n\s*const went = hub\?\.sendSocial\(act\) === true;/, 'the act leaves through the live session, never a captured one (AUDIT SOC B17: read once, so the word after can ask whether it was open)');
  assert.match(w, /chatLog\.push\(tab\.id, \{ text: went \? socialActText\(act\.k, who\) : \(hub\?\.status === 'open' \? TRY_AGAIN_TEXT : NOT_CONNECTED_TEXT\), system: true \}\);/, 'a word either way, on the world tab, flagged as nobody\'s line - AUDIT SOC B17: the panel\'s "try again" when the gate refused, "not connected" when there is no link to try again on');
  assert.match(w, /const NOT_CONNECTED_TEXT = 'You are not connected';/);
  assert.match(w, /Friend request sent to \$\{who\}/); assert.match(w, /Party invite sent to \$\{who\}/);
  // the pointer door is the chat's, and the open gate is the chat's
  assert.match(w, /onOpen: \(\) => surfaceOpen\('menu'\),   \/\/ AUDIT CHAT C2's law/, 'AUDIT SOC B6: the card is a counted pointer surface');
  assert.match(w, /if \(!townTalk\.overlayActive && act === 'SocialInteract' && socialMenuCanOpen\(\) && socialInteract\(\)\) \{ e\.preventDefault\(\); return; \}/, 'AUDIT SOC B4/D1: the door answers ABOVE the exterior gate - F on a body works in a tavern and a dungeon');
  assert.ok(w.indexOf("act === 'SocialInteract' && socialMenuCanOpen()") < w.indexOf("if (!townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior') {"), 'written above the mode gate, not inside it');
  assert.match(w, /onClose: \(\) => surfaceClose\('menu'\),   \/\/ and taken back inside the one that closed/);
  assert.match(w, /const socialMenuCanOpen = \(\) => !gamePaused\(\) && !\(townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\)\);/, 'the chat\'s own gate: a window\'s keys are the window\'s');
  assert.match(w, /socialMenu\?\.render\(\{ covered: townTalk\.hudCovered \|\| \(modes\?\.hudCovered \?\? false\) \|\| gamePaused\(\) \}\);/, 'and a window that opens later takes the card with it');
});


// ── THE AUDIT'S OWN PINS ─────────────────────────────────────────────

test('AUDIT SOC C1: the menu\'s sheet and the panel\'s sheet share NO class selector, and no style id either - two surfaces that stand at once cannot both be .dfsocial (mutants: the menu\'s prefix put back; one class left behind in the rename; the two style ids made one)', () => {
  const mine = classSelectors(SOCIAL_MENU_CSS), theirs = classSelectors(SOCIAL_CSS);
  const shared = [...mine].filter((c) => theirs.has(c));
  assert.deepEqual(shared, [], `the two sheets share ${shared.join(', ')} - whichever is injected LAST wins them`);
  // ...and the menu's are all one prefix, so a new rule cannot quietly rejoin the panel's namespace
  assert.deepEqual([...mine].filter((c) => !/^dfpeer(-|$)/.test(c) && c !== 'cancel'), []);
  // the ids too: two that differ only in spelling are the next thing to collide
  assert.equal(SOCIAL_MENU_STYLE_ID, 'dagger-peermenu-style');
  assert.notEqual(SOCIAL_MENU_STYLE_ID, 'dagger-social-style');
  // the concrete breakage that was: the menu's root rule kills the pointer and moves to the screen centre, and the
  // panel's root carried the same class name - so an OPEN panel got both
  assert.match(SOCIAL_MENU_CSS, /\.dfpeer \{[^}]*pointer-events: none;/);
  assert.match(SOCIAL_MENU_CSS, /\.dfpeer \{[^}]*left: 50%;/);
});

test('AUDIT SOC C2/C14: the F-menu is the TOPMOST surface - it answers Escape with stopImmediatePropagation so no sibling listener and no pause door sees the press, and with above() true it leaves the key entirely alone (mutants: stopPropagation alone, so the panel behind closes on the same press; above ignored, so the top two both close; the key stopped but the card left open)', () => {
  const doc = fakeDocument(), win = fakeWindow();
  let above = false;
  const sibling = [], host = [];
  const menu = createSocialMenu({ doc, win, above: () => above });
  // a SIBLING in the same phase (the friends panel's own capture listener) and the host's bubble door
  win.addEventListener('keydown', (e) => sibling.push(e.code), true);
  win.addEventListener('keydown', (e) => host.push(e.code));
  menu.show({ name: 'Bee', peerId: 'peer-b', actions: { canFriend: true } });
  const e = win.key('Escape', { target: doc.body });
  assert.equal(menu.isOpen(), false, 'the topmost surface closes');
  assert.deepEqual(sibling, [], 'and the sibling capture listener never runs - stopPropagation alone would have let it');
  assert.deepEqual(host, []);
  assert.equal(e.prevented, true); assert.equal(e.immediate, true);
  // now something stands ABOVE the card: the key is not ours at all
  above = true;
  menu.show({ name: 'Bee', peerId: 'peer-b', actions: { canFriend: true } });
  sibling.length = 0; host.length = 0;
  const e2 = win.key('Escape', { target: doc.body });
  assert.equal(menu.isOpen(), true, 'a surface over this one owns the key - this card does not close');
  assert.equal(e2.prevented, false); assert.equal(e2.stopped, false, '...and does not stop it, so the one above can have it');
  assert.deepEqual(sibling, ['Escape']); assert.deepEqual(host, ['Escape']);
  menu.destroy();
});

test('AUDIT SOC C12/C25: a refused row is READABLE - the disabled opacity is .75 and the reason is its own lighter colour, 4.5:1 or better over the card whether the relief under it is black or bright; and the sheet lands even in a document with no head (mutants: opacity back to .5; the reason left on the dim token; the sheet dropped on a headless document)', () => {
  assert.match(SOCIAL_MENU_CSS, /\.dfpeer-btn\[disabled\] \{ opacity: \.75;/);
  assert.match(SOCIAL_MENU_CSS, /\.dfpeer-why \{ font-size: 11px; color: #c8c2b4;/);
  // the arithmetic, done here rather than read off a screenshot: the button composites at its own opacity over the
  // card (rgba(14,16,19,.9) over whatever the world draws), and the reason is measured against that same ground.
  const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix = (a, b, alpha) => a.map((v, i) => alpha * v + (1 - alpha) * b[i]);
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (const world of [[0, 0, 0], [64, 70, 78]]) {
    const card = mix([14, 16, 19], world, 0.9);
    const bg = mix(hex('#2b323b'), card, 0.75);           // --iron at the disabled opacity
    const fg = mix(hex('#c8c2b4'), card, 0.75);           // the reason, at the same opacity
    assert.ok(ratio(fg, bg) >= 4.5, `the reason reads at ${ratio(fg, bg).toFixed(2)}:1 over ${JSON.stringify(world)}`);
    const was = mix(hex('#8b8578'), card, 0.5);           // what it WAS: the dim token at opacity .5
    const wasBg = mix(hex('#2b323b'), card, 0.5);
    assert.ok(ratio(was, wasBg) < 2, `and was ${ratio(was, wasBg).toFixed(2)}:1, which is what this pin exists for`);
  }
  // C25: `(doc.head ?? doc.body)`, the other three sheets' own fallback
  const noHead = fakeDocument(); noHead.head = null;
  createSocialMenu({ doc: noHead, win: fakeWindow() });
  assert.equal(noHead.body.children.some((n) => n.id === SOCIAL_MENU_STYLE_ID), true, 'no head, and the skin still lands');
});

test('AUDIT SOC C9: the touch layer has a control for SocialInteract - one 48px button beside the mode cycle, drawn only where a host hands the hook in, calling the HOST door rather than synthesizing a key (mutants: the button always drawn, so an offline page offers a dead door; a synthesized KeyF that a rebind would break; the hook undocumented)', () => {
  const touch = rd('src/ui/touch.js');
  assert.match(touch, /if \(hooks\.socialInteract\) button\('[^']+', edge\('right', hooks\.cycleMode \? 232 : 160\), edge\('bottom', 16\), 48, \(\) => \{ hooks\.socialInteract\(\); \}\);/,
    'gated by the hook, 48 like its neighbours, and the host answers for itself');
  assert.doesNotMatch(touch, /tapAction\('SocialInteract'\)/, 'never the key: F is rebindable and may be unbound outright');
  assert.match(touch, /socialInteract\?\(\)/, 'and the header documents the hook it calls');
});

test('AUDIT SOC D3: the port own action YIELDS in the classic windows - a grid action staged onto F leaves SocialInteract unbound rather than raising a clash no classic pane can show or clear, and the apply then writes a duplicate-free store (mutants: the yield dropped, so the window cannot be closed; the yield applied to the enhanced pane, which CAN show the row; the yield taking a key nothing else wants; the yield reaching across the two dicts)', () => {
  // QS2: the three quickslot actions joined it, off the same face and for the
  // same reason - the classic grid is Actions[2..40) on fixed art and the
  // ADVANCED popup is DFU's six, so none of the four is drawable there.
  assert.deepEqual([...PORT_ACTIONS], ['SocialInteract', 'QuickUse1', 'QuickUse2', 'QuickSwap', 'QuickOffHand', 'QuickSpell',
    'QuickLootAll', 'QuickLootOpen', 'FreeMouse', ...ACTIONS.slice(53)]);   // KB1: and its seventeen - no classic art draws them either   // QUICK-LOOT B4: the two loot keys yield on the same rule - neither the grid's art nor DFU's six can draw them; QS6: the spell slot yields there too; FREEMOUSE: and the mouse toggle's own row, for the same reason
  const store = createBindings();
  resetDefaults(store);
  assert.equal(getBinding(store, 'SocialInteract'), 'KeyF');
  assert.ok(checkDuplicates(createUnsavedKeybinds(store)).ok, 'the untouched defaults clash with nothing');
  // the ENHANCED pane sees the clash, because it draws the row that can resolve it
  const enhanced = createUnsavedKeybinds(store);
  setUnsavedBinding(enhanced, 'Rest', 'KeyF');
  assert.equal(checkDuplicates(enhanced).ok, false, 'the enhanced window still reports it: its Online group can clear it');
  assert.equal(enhanced.primary.get('SocialInteract'), 'KeyF', '...and never unbinds the row behind the player back');
  // the CLASSIC windows yield it: a classic player puts Rest - one of the 38 rows the art draws - on F
  const u = createUnsavedKeybinds(store);
  setUnsavedBinding(u, 'Rest', 'KeyF');
  const d = checkDuplicates(u, { yield: PORT_ACTIONS });
  assert.equal(u.primary.get('SocialInteract'), null, 'the port row gives the key up rather than arguing for it');
  assert.equal(u.primary.get('Rest'), 'KeyF');
  assert.equal(d.ok, true, 'so the window closes');
  assert.equal(d.internal.size, 0); assert.equal(d.cross.size, 0);
  // ...and the apply leaves a duplicate-free store with the action unbound and rebindable in the pane that draws it
  applyUnsavedKeybinds(store, u);
  assert.equal(getBinding(store, 'Rest'), 'KeyF');
  assert.equal(getBinding(store, 'SocialInteract'), null);
  assert.equal(actionForCode(store, 'KeyF'), 'Rest');
  assert.equal(checkDuplicates(createUnsavedKeybinds(store)).ok, true, 'no clash survives the apply, on either window');
  // a yielded action nobody else wants keeps its key: the pass unbinds a CLASH, not a row
  const clean = createBindings();
  resetDefaults(clean);
  const quiet = createUnsavedKeybinds(clean);
  checkDuplicates(quiet, { yield: PORT_ACTIONS });
  assert.equal(quiet.primary.get('SocialInteract'), 'KeyF', 'nothing clashed, so nothing was given up');
  assert.equal(currentDict(quiet).size, ACTIONS.length);
  // and the yield is per dict: a code the SECONDARY holds is not a clash inside the primary
  const two = createUnsavedKeybinds(clean);
  two.secondary.set('Rest', 'KeyF');
  two.secondary.set('SocialInteract', 'KeyF');
  checkDuplicates(two, { yield: PORT_ACTIONS });
  assert.equal(two.primary.get('SocialInteract'), 'KeyF', 'the primary is untouched by the other dict spelling');
  assert.equal(two.secondary.get('SocialInteract'), null, 'and the secondary yields its own');
  // the two classic windows pass it; the enhanced pane passes nothing
  assert.match(rd('src/ui/controlsWindow.js'), /checkDuplicates\(this\.unsaved, \{ yield: PORT_ACTIONS \}\)/);
  assert.match(rd('src/ui/mouseControlsWindow.js'), /checkDuplicates\(this\.unsaved, \{ yield: PORT_ACTIONS \}\)/);
  assert.match(rd('src/ui/enhancedControls.js'), /checkDuplicates\(unsaved\)/, 'the pane that SHOWS the row argues for it');
  assert.equal((rd('src/ui/controlsWindow.js').match(/checkDuplicates\(this\.unsaved\)/g) ?? []).length, 0);
  assert.equal((rd('src/ui/mouseControlsWindow.js').match(/checkDuplicates\(this\.unsaved\)/g) ?? []).length, 0);
});

test('AUDIT SOC D4: a mod-settings file written BEFORE this slice loses Handheld Torches saved "F" once, on load, so the shipped O applies - and any other saved key is left exactly as the player set it (mutants: the migration skipped, so a torch lights on the social key; every saved key cleared; a value the player chose later taken too; the file not written back)', () => {
  const prevLs = globalThis.localStorage;
  const K = 'dfjs-mod-settings';
  try {
    let store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
    // the old file: the mod shipped key of the day, written into the store by the Mods pane. (`_resetModSettings`
    // clears the key through this very fake, so the file is laid down AFTER it, not before.)
    _resetModSettings();
    store.set(K, JSON.stringify({ 'handheld-torches': { 'Handling.ToggleLightInput': 'F', 'Handling.ManualDropInput': 'G' } }));
    assert.equal(modSetting('handheld-torches', 'Handling.ToggleLightInput'), 'O', 'the shipped default applies again');
    assert.equal(modSetting('handheld-torches', 'Handling.ManualDropInput'), 'G', 'and the player other keys are theirs');
    const written = JSON.parse(store.get(K));
    assert.equal('Handling.ToggleLightInput' in written['handheld-torches'], false, 'the file was written back without it');
    assert.equal(written['handheld-torches']['Handling.ManualDropInput'], 'G');
    // a player who chose some OTHER key keeps it, and nothing is written for them
    _resetModSettings();
    store = new Map([[K, JSON.stringify({ 'handheld-torches': { 'Handling.ToggleLightInput': 'L' } })]]);
    assert.equal(modSetting('handheld-torches', 'Handling.ToggleLightInput'), 'L');
    assert.equal(JSON.parse(store.get(K))['handheld-torches']['Handling.ToggleLightInput'], 'L', 'untouched');
    // and a file that never mentioned the mod is not grown one
    _resetModSettings();
    store = new Map([[K, JSON.stringify({ pcaao: { Enabled: false } })]]);
    assert.equal(modSetting('handheld-torches', 'Handling.ToggleLightInput'), 'O');
    assert.deepEqual(Object.keys(JSON.parse(store.get(K))), ['pcaao']);
  } finally {
    _resetModSettings();
    if (prevLs === undefined) delete globalThis.localStorage; else globalThis.localStorage = prevLs;
  }
});

test('AUDIT SOC D14: the pick header says the two things it does NOT do - the cylinder is unoccluded on purpose (the street own person pick takes no collider either) and t <= 0 covers a peer at my feet as well as one behind me (mutants: the sentences dropped, so the next reader adds an occlusion test the talk arm does not have)', () => {
  const src = rd('src/player/socialPick.js');
  assert.match(src, /UNOCCLUDED/, 'the word, so a reader cannot mistake it for an oversight');
  assert.match(src, /raceActivation/, 'and the site it is consistent with - world.js hands the same distances in with no collider');
  assert.match(src, /AT MY FEET/, 'and the other half of t <= 0');
  // and it is true: a peer standing exactly where I am is out of the race, not at distance zero winning every tie
  const cam = [0, 1.6, 0], fwd = [0, 0, 1];
  assert.equal(rayPersonDistance(cam, fwd, [0, 0, 0]), Infinity, 'a body at my own feet has no along-ray distance');
  assert.equal(pickPeerInFront(cam, fwd, [peer('feet', [0, 0, 0]), peer('ahead', [0, 0, 3])], SOCIAL_REACH, rayPersonDistance).peer.id, 'ahead');
  // the street own arm measures a person with the very same call and no collider of its own
  assert.match(rd('src/scenes/world.js'), /personDistances: _livePersons\.map\(\(p\) => rayPersonDistance\(/, 'one cylinder, both arms');
});

// ── FONT1 (2026-09-16, Mac: "Any enhanced UI or text must be our
// enhanced version") ────────────────────────────────────────────────

test('FONT1: the F-menu over a body is the skin\'s face too, and the two online sheets carry the five each on its own', () => {
  const root = SOCIAL_MENU_CSS.slice(SOCIAL_MENU_CSS.indexOf('\n.dfpeer {'));
  assert.match(root.slice(0, root.indexOf('}')), /font-family: 'Pixelify Five', 'Pixelify Sans', monospace;/,
    'mutants: left on var(--data) - the launcher face on a card that opens under the crosshair; the five dropped from the stack (FIX-D)');
  assert.match(root.slice(0, root.indexOf('}')), /-webkit-font-smoothing: none;/, 'mutant: the smoothing left on, which blurs every pixel glyph');
  assert.doesNotMatch(SOCIAL_MENU_CSS, /--data/, 'no corner of this sheet is still in the menu\'s face');
  // AUDIT SOC C1's law is that these two surfaces stand at once and
  // share no selector - so each carries the five's @font-face itself
  // rather than relying on the other having been injected.
  for (const [name, css] of [['the F-menu', SOCIAL_MENU_CSS], ['the friends panel', SOCIAL_CSS]]) {
    assert.match(css, /@font-face \{ font-family: 'Pixelify Five'; unicode-range: U\+0035;/, `${name} carries the five itself`);
  }
  // ...and the finger keeps its 44px: a wider face is no reason to
  // shrink a target (AUDIT SOC C8).
  assert.match(SOCIAL_MENU_CSS, /\.dfpeer-btn \{[^}]*min-height: 44px;/, 'mutant: the row shrunk to fit the wider letters');
});
