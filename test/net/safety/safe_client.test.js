// SAFE1-SAFE7 (2026-10-17, bible/11-Multiplayer/Chat-Safety-Arc.md): THE CLIENT'S HALF - the session carrying the
// relay's stamp and its word on my own chat (`law`, `banned`, `slowed`), the log that keeps a line's account and stamp,
// hears through the block list, takes a blocked account's lines back and picks what a report carries, the social picture
// that drops a blocked account's requests, a line's own menu in the chat panel, the host module's commands and the code
// of conduct's gate, and the card itself - each driven headless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OnlineSession } from '../../../src/net/online.js';
import { ChatLog } from '../../../src/net/chat.js';
import { SocialState } from '../../../src/net/social.js';
import { createChatPanel } from '../../../src/ui/chatPanel.js';
import { createConductCard } from '../../../src/ui/conductCard.js';
import { createChatSafetyHost } from '../../../src/scenes/chatSafetyHost.js';
import { CHAT_WORLD_ROOM } from '../../../src/net/wire.js';
import { SESSION_KEY, SERVICE_KEY } from '../../../src/net/accountClient.js';
import { CONDUCT_VERSION, conductRules } from '../../../src/net/safety/conduct.js';
import { orderKindOf, REPORT_REASONS } from '../../../src/net/safety/safetyLaw.js';
import { _b64url } from '../../../src/net/identityToken.js';
import { fakeSocketClass } from '../../fakeSocket.mjs';
// AUDIT SAFE (the client lane, 2026-10-17): the audit's pins read the modules whole, so a pin of a member the old code
// lacked fails on its own assertion rather than on the file's import
import * as onlineNs from '../../../src/net/online.js';
import * as chatNs from '../../../src/net/chat.js';
import * as acctNs from '../../../src/net/accountClient.js';
import * as lawNs from '../../../src/net/safety/safetyLaw.js';
import * as wireNs from '../../../src/net/wire.js';
import * as stampNs from '../../../src/net/safety/chatStamp.js';
import * as hostNs from '../../../src/scenes/chatSafetyHost.js';

const SG = 'S'.repeat(86);
const enc = (o) => _b64url.encode(new TextEncoder().encode(JSON.stringify(o)));
const orderOf = (claims) => `v1.${enc(claims)}.${'x'.repeat(86)}`;

test('SAFE2 + SAFE4 + SAFE6 THE SESSION: a line\'s stamp is carried as the relay said it (a malformed one dropped); `law`, `banned` and `slowed` reach their hooks, malformed ones never; a ban order goes out on the mute order\'s own meter (mutants: the stamp dropped; a ban order unmetered)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = 1_000_000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Mac', id: 'mac-0001', secret: 'secret-of-mac-0001', presence: false, WebSocketImpl: FakeWS, now: () => clock });
  const heard = [], law = [], banned = [], slowed = [];
  s.onChat = (l) => heard.push(l);
  s.onLaw = (m) => law.push(m); s.onBanned = (m) => banned.push(m); s.onSlowed = (m) => slowed.push(m);
  s.join(CHAT_WORLD_ROOM);
  const ws = sockets[0];
  ws.open();
  ws.receive({ t: 'welcome', id: 'mac-0001', peers: [], n: 1, v: 'world215' });   // AUDIT SAFE RELAY-3: a relay that knows the ban frame
  ws.receive({ t: 'chat', id: 'bob-0002', name: 'Bob', text: 'hi', at: 1, sub: 'acct-bob', sg: SG });
  ws.receive({ t: 'chat', id: 'bob-0002', name: 'Bob', text: 'yo', at: 2, sub: 'acct-bob', sg: 'short' });
  assert.equal(heard[0].sg, SG);
  assert.equal('sg' in heard[1], false, 'a stamp of the wrong shape is no stamp');
  ws.receive({ t: 'law', order: 'v1.a.b' });
  ws.receive({ t: 'law' });
  ws.receive({ t: 'banned', until: 99 });
  ws.receive({ t: 'banned', until: -1 });
  ws.receive({ t: 'slowed', ms: 3000 });
  ws.receive({ t: 'slowed', ms: 0 });
  assert.deepEqual([law, banned, slowed], [[{ order: 'v1.a.b' }], [{ until: 99 }], [{ ms: 3000 }]]);
  assert.equal(s.sendBanOrder('v1.c.d'), true);
  assert.deepEqual(JSON.parse(ws.sent.at(-1)), { t: 'ban', order: 'v1.c.d' });
  assert.equal(s.sendMuteOrder('v1.e.f'), false, 'one bucket for both kinds, as the relay spends one');
  assert.equal(s.sendBanOrder(''), false);
});

test('SAFE1 + SAFE2 + SAFE3 THE LOG: a spoken line keeps its account and stamp (a game\'s line never does); an account it does not hear is never kept; a block takes back what was said; a report carries the account\'s stamped lines and the stamped lines before each, one line\'s own when asked, the account\'s newest first past the bound (mutants: a blocked line kept; context lines past the bound kept over the account\'s own)', () => {
  const log = new ChatLog({ now: () => 10_000 });
  const a = log.push('world', { id: 'p1', name: 'Sylvia', text: 'hi', at: 1, sub: 'acct-syl', sg: SG });
  assert.equal(a.sub, 'acct-syl'); assert.equal(a.sg, SG);
  assert.equal('sub' in log.push('world', { text: 'Server restarting', system: true, sub: 'x' }), false);
  log.push('world', { id: 'p2', name: 'Troll', text: 'gross', at: 2, sub: 'acct-tro', sg: SG });
  log.push('world', { id: 'p3', name: 'Quiet', text: 'unstamped', at: 3, sub: 'acct-qui' });
  log.push('world', { id: 'p2', name: 'Troll', text: 'freaks', at: 4, sub: 'acct-tro', sg: SG });
  const all = log.reportLines('acct-tro');
  assert.deepEqual(all.map((l) => l.text), ['hi', 'gross', 'freaks'], 'the account\'s lines and the stamped lines before them - the unstamped never');
  const seqOfFirst = log.tab('world').messages.find((l) => l.text === 'gross').seq;
  assert.deepEqual(log.reportLines('acct-tro', { seq: seqOfFirst }).map((l) => l.text), ['hi', 'gross'], 'one line\'s own report');
  assert.deepEqual(Object.keys(all[0]), ['tab', 'sub', 'name', 'at', 'text', 'sg']);
  assert.deepEqual(log.reportLines('acct-tro', { max: 1 }).map((l) => l.text), ['freaks'], 'past the bound, the account\'s newest first');
  log.hears = (sub) => sub !== 'acct-tro';
  assert.equal(log.push('world', { id: 'p2', name: 'Troll', text: 'again', at: 5, sub: 'acct-tro', sg: SG }), null);
  assert.equal(log.forgetSpeaker('acct-tro'), 2);
  assert.deepEqual(log.tab('world').messages.map((l) => l.text), ['hi', 'Server restarting', 'unstamped']);
  assert.ok(log.push('world', { id: 'me', name: 'Me', text: 'mine', mine: true, sub: 'acct-tro' }), 'my own line is always mine');
});

test('SAFE1 THE SOCIAL PICTURE drops a blocked account\'s friend request, party invite and notes - its sender never told (mutant: an invite from a blocked account landing)', () => {
  const s = new SocialState({ acct: 'acct-me' });
  s.hears = (acct) => acct !== 'acct-tro';
  const notes = [], invites = [];
  s.onNote = (n) => notes.push(n.acct); s.onInvite = (i) => invites.push(i.from.acct);
  s.apply({ t: 'social', k: 'state', acct: 'acct-me', name: 'Me', friends: [], in: [{ acct: 'acct-tro', name: 'Troll' }, { acct: 'acct-ok', name: 'Ok' }], out: [], party: null, invites: [{ party: 'p1', from: { acct: 'acct-tro', name: 'Troll' }, members: [], at: 1, expires: 9e12 }] });
  assert.deepEqual(s.in.map((r) => r.acct), ['acct-ok']);
  assert.equal(s.invites.size, 0);
  s.apply({ t: 'social', k: 'invite', party: 'p2', from: { acct: 'acct-tro', name: 'Troll' }, members: [], at: 1, expires: 9e12 });
  s.apply({ t: 'social', k: 'invite', party: 'p3', from: { acct: 'acct-ok', name: 'Ok' }, members: [], at: 1, expires: 9e12 });
  assert.deepEqual(invites, ['acct-ok']);
  s.apply({ t: 'social', k: 'note', code: 'friend.requested', acct: 'acct-tro', name: 'Troll' });
  s.apply({ t: 'social', k: 'note', code: 'friend.requested', acct: 'acct-ok', name: 'Ok' });
  assert.deepEqual(notes, ['acct-ok']);
});

/** chat1.test.js's fake DOM - the shape every chat pin copies. */
function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', disabled: false,
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), scrollTop: 0, scrollHeight: 100, clientHeight: 100,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener(t, fn) { const l = n.listeners.get(t) ?? []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {}, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { doc.activeElement = n; }, blur() {},
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } },
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
const fakeWindow = () => ({ addEventListener() {}, removeEventListener() {} });
const all = (n, cls, out = []) => { if (String(n.className).split(' ').includes(cls)) out.push(n); for (const c of n.children) all(c, cls, out); return out; };

test('SAFE1 + SAFE3 A LINE\'S OWN MENU: the speaker\'s name pressed opens the host\'s rows under the line, a row run closes it, the name pressed again closes it; my own lines and the game\'s have none (mutants: a menu on my own line; a row that does not close)', () => {
  const log = new ChatLog({ now: () => 10_000 });
  const doc = fakeDocument();
  const ran = [];
  const panel = createChatPanel({ log, onSend: () => true, doc, win: fakeWindow(), touch: false, lineActions: (line) => [{ label: `Report ${line.name}`, run: () => ran.push(line.text) }] });
  log.push('world', { id: 'p2', name: 'Troll', text: 'gross', at: 1, sub: 'acct-tro', sg: SG });
  log.push('world', { id: 'me', name: 'Me', text: 'mine', at: 2, mine: true, sub: 'acct-me' });
  log.push('world', { text: 'Server restarting', system: true });
  panel.open();
  panel.render?.();
  const root = doc.body.children.find((c) => String(c.className).startsWith('dfchat'));
  const names = all(root, 'dfchat-name');
  const troll = names.find((n) => n.textContent === 'Troll');
  const mine = names.find((n) => n.textContent === 'Me');
  assert.ok(troll && String(troll.className).includes('dfchat-act'));
  assert.equal(String(mine.className).includes('dfchat-act'), false, 'no menu on my own line');
  troll.fire('click');
  let menus = all(root, 'dfchat-linemenu');
  assert.equal(menus.length, 1);
  troll.fire('click');
  assert.equal(all(root, 'dfchat-linemenu').length, 0, 'pressed again, it closes');
  troll.fire('click');
  menus = all(root, 'dfchat-linemenu');
  menus[0].children[0].fire('click');
  assert.deepEqual(ran, ['gross']);
  assert.equal(all(root, 'dfchat-linemenu').length, 0, 'a row run closes the menu');
});

/** A host over a real log, fake links and a fake account service - every request recorded. An answer may be a status's
 *  `[status, body]`, or a function of the request's body; `peers` the rooms' players; `opts` the host's own seams. */
function hostRig({ conduct = true, blocks = [], answers: more = {}, peers = [['p2', { id: 'p2', name: 'Troll', sub: 'acct-tro' }]], opts = {} } = {}) {
  const log = new ChatLog({ now: () => 10_000 });
  const sent = [];
  const link = (name) => ({ name, peers: new Map(peers), mute: [], ban: [], left: 0,
    sendMuteOrder(o) { this.mute.push(o); return true; }, sendBanOrder(o) { this.ban.push(o); return true; }, leave() { this.left++; } });
  const links = [link('world'), link('online')];
  const asked = [];
  const answers = { '/v1/safety/blocks': { ok: true, blocks }, '/v1/safety/block': { ok: true, blocks: [{ sub: 'acct-tro', name: 'Troll', at: 1 }] }, '/v1/safety/unblock': { ok: true, blocks: [] },
    '/v1/safety/report': { ok: true, case: '00aa', muted: 1, order: orderOf({ o: 'mute', s: 'acct-tro', mu: 1 }) }, '/v1/safety/conduct': { ok: true, conduct: CONDUCT_VERSION },
    '/v1/mod/strikes': { ok: true, name: 'Troll', strikes: 2, next: 10080, history: [] }, ...more };
  const fetch = async (url, init) => {
    const path = new URL(url).pathname;
    const body = init?.body ? JSON.parse(init.body) : null;
    asked.push({ path, body });
    let a = answers[path];
    if (typeof a === 'function') a = a(body, asked.length);
    const [status, data] = Array.isArray(a) ? a : a ? [200, a] : [500, { error: 'server' }];
    return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  };
  const storage = { getItem: (k) => (k === SESSION_KEY ? JSON.stringify({ secret: 's3cret', id: 'acct-me' }) : k === SERVICE_KEY ? 'https://accounts.test' : null) };
  const doc = fakeDocument();
  const host = createChatSafetyHost({ log: () => log, links: () => links, fetch, storage, doc, touch: false, register: () => () => {}, win: fakeWindow(), ...opts });
  host.adopt({ conduct });
  return { log, links, asked, host, doc, sent };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

test('SAFE1 THE HOST\'S BLOCK: the list is read at the start and the log hears through it; Block on a line asks the service and takes the account\'s lines back; /blocked lists, /unblock undoes - and the commands are the host\'s, never sent as chat (mutants: the list never read; the log never told)', async () => {
  const r = hostRig({ blocks: [{ sub: 'acct-old', name: 'Old', at: 1 }] });
  r.log.push('world', { id: 'p9', name: 'Old', text: 'before', at: 1, sub: 'acct-old', sg: SG });
  await r.host.start();
  assert.equal(r.log.hears('acct-old'), false);
  assert.deepEqual(r.log.tab('world').messages.filter((l) => l.sub === 'acct-old'), [], 'the start takes a blocked account\'s lines back');
  const line = r.log.push('world', { id: 'p2', name: 'Troll', text: 'gross', at: 2, sub: 'acct-tro', sg: SG });
  const rows = r.host.lineActions(line);
  assert.deepEqual(rows.map((x) => x.label).slice(-1), ['Block']);
  assert.equal(rows.length, REPORT_REASONS.length + 1);
  rows.at(-1).run();
  await settle(); await settle();
  assert.deepEqual(r.asked.map((a) => a.path), ['/v1/safety/blocks', '/v1/safety/block']);
  assert.deepEqual(r.asked[1].body, { target: 'acct-tro' });
  assert.equal(r.log.tab('world').messages.some((l) => l.sub === 'acct-tro' && !l.system), false);
  assert.equal(r.host.onSend('world', '/blocked'), true);
  await settle();
  assert.match(r.log.tab('world').messages.at(-1).text, /Blocked: Troll/);
  assert.equal(r.host.onSend('world', '/unblock Troll'), true);
  await settle(); await settle();
  assert.deepEqual(r.asked.at(-1), { path: '/v1/safety/unblock', body: { target: 'acct-tro' } });
  assert.deepEqual(r.host.lineActions({ text: 'x', system: true }), []);
});

test('SAFE3 THE HOST\'S REPORT: a line\'s own Report carries that line and the stamped lines before it with the reason chosen; /report <name> carries everything the account said here; a report that mutes hands back an order, carried to every room by its kind (mutants: the order dropped; carried to the wrong door)', async () => {
  const r = hostRig();
  r.log.push('world', { id: 'p1', name: 'Sylvia', text: 'happy pride', at: 1, sub: 'acct-syl', sg: SG });
  const line = r.log.push('world', { id: 'p2', name: 'Troll', text: 'nobody wants your flag', at: 2, sub: 'acct-tro', sg: SG });
  r.host.lineActions(line).find((x) => /Hate or slurs/.test(x.label)).run();
  await settle(); await settle();
  const [rep] = r.asked;
  assert.equal(rep.path, '/v1/safety/report');
  assert.deepEqual({ target: rep.body.target, reason: rep.body.reason, texts: rep.body.lines.map((l) => l.text) }, { target: 'acct-tro', reason: 'hate', texts: ['happy pride', 'nobody wants your flag'] });
  assert.equal(r.links[0].mute.length, 1, 'the mute the report reached, carried');
  assert.equal(r.links[0].ban.length, 0);
  assert.equal(r.host.onSend('world', '/report Troll harassment'), true);
  await settle(); await settle();
  assert.equal(r.asked.at(-1).body.reason, 'harassment');
  assert.equal(orderKindOf(orderOf({ o: 'ban', s: 'x', bn: 1 })), 'ban');
  assert.equal(orderKindOf('junk'), null);
});

test('SAFE4 + SAFE6 THE RELAY\'S WORD: a pushed order is carried to every room by its kind; a ban is said and every room left; a lifted ban is said; the pace is said once in a while, not on every press (mutants: a ban that leaves nothing; the pace said each time)', async () => {
  const r = hostRig();
  await r.host.start();
  const link = r.links[0];
  link.onLaw({ order: orderOf({ o: 'ban', s: 'acct-me', bn: 2e9 }) });
  assert.deepEqual([r.links[0].ban.length, r.links[1].ban.length, r.links[0].mute.length], [1, 1, 0]);
  link.onBanned({ until: 2e9 });
  assert.deepEqual(r.links.map((l) => l.left), [1, 1]);
  assert.match(r.log.tab(r.log.active).messages.at(-1).text, /This account is banned/);
  link.onSlowed({ ms: 2500 });
  link.onSlowed({ ms: 2000 });
  assert.equal(r.log.tab(r.log.active).messages.filter((l) => /New players can send/.test(l.text)).length, 1);
});

test('SAFE7 THE CODE OF CONDUCT\'S GATE: before a first line the card stands and the line stays in the field (onSend false); a command or a host line is never held; agreeing asks the service with the version shown, and the next line goes (mutants: a line sent before agreeing; a command held)', async () => {
  const r = hostRig({ conduct: false });
  assert.equal(r.host.onSend('world', 'hello everyone'), false, 'held');
  const card = r.doc.body.children.find((c) => String(c.className).startsWith('dfconduct'));
  assert.equal(card.dataset.up, '1');
  assert.deepEqual(all(card, 'dfconduct-rule').map((n) => n.textContent), conductRules());
  assert.equal(r.host.onSend('world', '/help'), null, 'a command is not held');
  assert.equal(r.host.onSend('world', '/blocked'), true);
  assert.equal(r.host.onSend('world', '/me waves'), false, 'an action is a line');
  all(card, 'yes')[0].fire('click');
  await settle(); await settle();
  assert.deepEqual(r.asked.at(-1), { path: '/v1/safety/conduct', body: { v: CONDUCT_VERSION } });
  assert.equal(r.host.onSend('world', 'hello everyone'), null, 'agreed: the line goes');
  const old = hostRig();
  old.host.adopt({});
  assert.equal(old.host.onSend('world', 'hi'), null, 'an older service that says nothing is heard as yes');
});

test('SAFE7 THE CARD: its rules in the player\'s language, "I agree" and "Not now" each answered once, nothing while it is down (mutant: agree answered with the card down)', () => {
  const doc = fakeDocument();
  let yes = 0, no = 0;
  const c = createConductCard({ agree: () => yes++, later: () => no++, doc });
  const [yesBtn] = all(c.root, 'yes');
  yesBtn.fire('click');
  assert.equal(yes, 0, 'down: nothing');
  c.show();
  assert.equal(c.isUp(), true);
  yesBtn.fire('click');
  yesBtn.fire('click');
  assert.equal(yes, 1);
  c.show();
  c.root.children.at(-1).children[0].fire('click');
  assert.equal(no, 1);
  assert.equal(c.isUp(), false);
});

/* ═══ AUDIT SAFE - THE CLIENT LANE (2026-10-17) ═══════════════════════════════════════════════════════════════════════
 * The audit of the chat safety arc, read cold: each pin below failed on the arc as it merged (driven against a copy of
 * the old modules) and holds the fix now. Its mutants are tools/mutants/safe_audit_client.json. */

/** A device's storage over a Map, signed in. */
const signedIn = () => {
  const mem = new Map([[SESSION_KEY, JSON.stringify({ secret: 's3cret', id: 'acct-me', name: 'Me' })], [SERVICE_KEY, 'https://accounts.test']]);
  return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
};
const answer = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
/** An OnlineSession in `room`, opened and welcomed by a relay of version `v`. */
function welcomedSession(FakeWS, sockets, room, { v = 'world215', now = () => 1_000_000, id = 'me-00001' } = {}) {
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'Me', id, secret: `secret-of-${id}`, presence: false, WebSocketImpl: FakeWS, now });
  s.join(room);
  const ws = sockets.at(-1);
  ws.open();
  ws.receive({ t: 'welcome', id, peers: [], n: 1, ...(v ? { v } : {}) });
  return { s, ws };
}

test('AUDIT SAFE CLIENT-1 THE MINT\'S `conduct` REACHES THE CODE\'S GATE through the page\'s own minter (accountTokenMinter -> onIssued -> adopt, world.js adoptIssued\'s path): a service that says no holds the first line; a yes agreed on this page is never taken back by a mint that was in flight (mutants: `conduct` dropped from the minter\'s answer; a no in flight taking the yes back)', async () => {
  const storage = signedIn();
  let conduct = false;
  const fetch = async (url) => {
    const path = new URL(url).pathname;
    return answer(path === '/v1/auth/token' ? { token: `v1.tok${conduct}.sig`, name: 'Me', kind: 'account', glyphs: [], conduct } : path === '/v1/safety/conduct' ? { ok: true, conduct: CONDUCT_VERSION } : { ok: true, blocks: [] });
  };
  const log = new ChatLog({ now: () => 10_000 });
  const mk = () => createChatSafetyHost({ log: () => log, links: () => [], fetch, storage, doc: fakeDocument(), touch: false, register: () => () => {}, win: fakeWindow() });
  const host = mk();
  const minter = acctNs.accountTokenMinter({ fetch, storage, onIssued: (who) => host.adopt(who) });
  assert.equal(await minter('chat:world'), 'v1.tokfalse.sig');
  assert.equal(host.onSend('world', 'hello everyone'), false, 'the service said no: the first line waits for the code');
  await host.agree('world');
  host.adopt({ conduct: false });   // the answer of a mint that was in flight as the player agreed
  assert.equal(host.onSend('world', 'hello everyone'), null, 'agreed here: a late no does not take it back');
  conduct = true;
  const host2 = mk();
  host2.adopt({ conduct: false });
  await acctNs.accountTokenMinter({ fetch, storage, onIssued: (who) => host2.adopt(who) })('chat:world');
  assert.equal(host2.onSend('world', 'hi'), null, 'the service\'s yes, heard');
});

test('AUDIT SAFE CLIENT-2 THE SESSION STAYS OUT: a socket the relay closed 1008 \'banned\' latches its session - no rejoin on CHAT_REJOIN_MS\'s clock, no join, no retry - until the ban is lifted (unbar); a hello the service refused a token for a ban is never asked again (mutants: the latch unread by rejoin; the ban\'s close read as any refusal; a ban retried as a bad minute)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let clock = 1_000_000;
  const { s, ws } = welcomedSession(FakeWS, sockets, CHAT_WORLD_ROOM, { now: () => clock });
  ws.drop(1008, 'banned');
  assert.equal(s.barred, true);
  clock += 10 * chatNs.CHAT_REJOIN_MS;
  assert.equal(s.rejoin(CHAT_WORLD_ROOM, chatNs.CHAT_REJOIN_MS), false, 'no rejoin on the clock');
  s.join(CHAT_WORLD_ROOM);
  s.tick();
  assert.equal(sockets.length, 1, 'no socket opened');
  s.unbar();
  assert.equal(s.rejoin(CHAT_WORLD_ROOM, chatNs.CHAT_REJOIN_MS), true, 'lifted: the way back is open');
  assert.equal(sockets.length, 2);
  assert.equal(onlineNs.tokenRetryable('banned'), false);
  assert.equal(onlineNs.tokenRetryable('server'), true);
});

test('AUDIT SAFE CLIENT-2 + RELAY-3 THE PAGE IS BANNED: the hub says the ban\'s order first - carried to every room whose relay knows the frame, never to one before world215 (it closes on it - the WIKIMAID relay world214 among them) - then `banned`: every room left and latched, the token the minter holds let go, the ban said once however many sockets say it, nothing back on the rejoin\'s clock; a ban lifted opens the way (mutants: a ban that latches nothing; the minter\'s token kept; a ban order to a relay before world214)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  let clock = 1_000_000;
  const now = () => clock;
  const hub = welcomedSession(FakeWS, sockets, CHAT_WORLD_ROOM, { now }), trade = welcomedSession(FakeWS, sockets, 'chat:trade', { now }), old = welcomedSession(FakeWS, sockets, 'chat:lfg', { now, v: 'world214' });   // WIKIMAID's relay: no ban frame
  const log = new ChatLog({ now });
  let forgot = 0;
  const host = createChatSafetyHost({ log: () => log, links: () => [hub.s, trade.s, old.s], storage: { getItem: () => null }, doc: fakeDocument(), touch: false, register: () => () => {}, win: fakeWindow(), minter: () => ({ forget() { forgot++; } }), now });
  await host.start();
  const until = Math.floor(clock / 1000) + 86400;
  const order = orderOf({ o: 'ban', s: 'acct-me', bn: until, i: 1, e: until });
  hub.ws.receive({ t: 'law', order });
  hub.ws.receive({ t: 'banned', until });
  assert.deepEqual(JSON.parse(trade.ws.sent.at(-1)), { t: 'ban', order }, 'the order carried before the page left');
  assert.equal(old.ws.sent.some((f) => JSON.parse(f).t === 'ban'), false, 'never to a relay that closes the socket on the frame');
  assert.deepEqual([hub.s.barred, trade.s.barred, old.s.barred], [true, true, true]);
  assert.equal(forgot, 1, 'the token minted before the ban let go');
  hub.s.onBanned({ until });   // another hub socket's word on the same ban
  assert.equal(log.tab(log.active).messages.filter((l) => /This account is banned/.test(l.text)).length, 1, 'said once');
  clock += 10 * chatNs.CHAT_REJOIN_MS;
  const before = sockets.length;
  assert.deepEqual([hub.s.rejoin(CHAT_WORLD_ROOM, chatNs.CHAT_REJOIN_MS), trade.s.rejoin('chat:trade', chatNs.CHAT_REJOIN_MS)], [false, false]);
  assert.equal(sockets.length, before, 'no room opened again');
  const late = welcomedSession(FakeWS, sockets, 'arena:hall', { now });
  host.adoptLink(late.s);
  assert.equal(late.s.barred, true, 'a room made after the ban is shut at once');
  hub.s.onBanned({ until: 0 });
  assert.deepEqual([hub.s.barred, trade.s.barred, late.s.barred], [false, false, false]);
  assert.equal(hub.s.rejoin(CHAT_WORLD_ROOM, chatNs.CHAT_REJOIN_MS), true);
  assert.match(log.tab(log.active).messages.at(-1).text, /Your ban was lifted/);
});

test('AUDIT SAFE CLIENT-2 THE MINTER LETS GO OF A TOKEN MINTED BEFORE THE BAN: the host\'s word (`forget`), and a mint the service refuses as `banned` - no room is handed the old token after, though TOKEN_REUSE_MS has not run (mutants: forget a no-op; a refused mint keeping the held token)', async () => {
  const storage = signedIn();
  let banned = false;
  const clock = 1_000_000;
  const fetch = async () => (banned ? answer({ error: 'banned', until: 2e9, reason: 'x' }, 403) : answer({ token: 'v1.pre-ban.sig', name: 'Me', kind: 'account', glyphs: [] }));
  const minter = acctNs.accountTokenMinter({ fetch, storage, now: () => clock });
  const t1 = await minter('cell:12.34');
  minter.opened('cell:12.34', t1);
  banned = true;
  assert.equal(await minter('cell:12.34'), null, 'the room the token opened mints - refused');
  assert.equal(minter.lastWhy, 'banned');
  assert.equal(await minter('chat:trade'), null, 'and no other room is handed the token from before the ban');
  banned = false;
  const m2 = acctNs.accountTokenMinter({ fetch, storage, now: () => clock });
  await m2('cell:1.1');
  m2.forget();
  banned = true;
  assert.equal(await m2('chat:world'), null, 'forgotten: the next room mints, and the service refuses it');
});

test('AUDIT SAFE CLIENT-2 A SIGN-IN REFUSED FOR A BAN SAYS THE BAN - its end and the moderator\'s reason, through the refusal\'s own word (ui/accountFlow.js shows accountRefusalText(r.error)), for a login and a recovery alike (mutant: the 403\'s end and reason dropped)', async () => {
  let body = { error: 'banned', until: 2_000_000_000, reason: 'Slurs in World chat' };
  const fetch = async () => answer(body, 403);
  const io = { fetch, base: 'https://accounts.test' };
  const r = await acctNs.login(io, 'troll', 'hunter22');
  assert.deepEqual([r.ok, r.error, r.until, r.reason], [false, 'banned', 2_000_000_000, 'Slurs in World chat']);
  assert.match(acctNs.accountRefusalText(r.error), /^This account is banned until .+\. Reason: Slurs in World chat$/);
  body = { error: 'banned', until: lawNs.BAN_FOREVER, reason: null };
  const r2 = await acctNs.recover(io, 'troll', 'code-code', 'hunter22');
  assert.equal(acctNs.accountRefusalText(r2.error), 'This account is banned for good.');
});

test('AUDIT SAFE RELAY-2 THE RELAY\'S WORD ON MY CHAT HAS A BUCKET OF ITS OWN: a channel at its whole budget still delivers `law`, `banned`, `muted` and `slowed` - the order meter\'s two frames a second and my own lines\' answers (mutant: the word back on the chat lines\' bucket)', () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const { s, ws } = welcomedSession(FakeWS, sockets, CHAT_WORLD_ROOM);
  const heard = [];
  s.onChat = () => {};
  s.onLaw = () => heard.push('law'); s.onBanned = () => heard.push('banned'); s.onMuted = () => heard.push('muted'); s.onSlowed = () => heard.push('slowed');
  for (let i = 0; i < wireNs.CHAT_ROOM_HZ_MAX + 5; i++) ws.receive({ t: 'chat', id: 'bob-0002', name: 'Bob', text: `line ${i}`, at: i, sub: 'acct-bob' });
  ws.receive({ t: 'law', order: 'v1.a.b' });
  ws.receive({ t: 'banned', until: 99 });
  ws.receive({ t: 'muted', until: 99 });
  ws.receive({ t: 'slowed', ms: 2000 });
  assert.deepEqual(heard, ['law', 'banned', 'muted', 'slowed']);
  assert.equal(onlineNs.LAW_IN_HZ_MAX, 2 * wireNs.MUTE_HZ_MAX + wireNs.CHAT_HZ_MAX);
});

test('AUDIT SAFE CLIENT-3 / DOC-6 A NAME IS THE ONE ACCOUNT EVERYTHING HERE AGREES ON: the players this page holds and the lines it heard, together - a Bob standing here and another Bob who spoke is a refusal in the command\'s own words (never MOD1\'s mute), nothing asked of the service; one account is blocked and NAMED - the account\'s own name beside the one the line showed (mutants: the peers asked alone; the heard lines never asked; MOD1\'s words)', async () => {
  const r = hostRig({ peers: [['p9', { id: 'p9', name: 'Bob', sub: 'acct-innocent' }]] });
  r.log.push('world', { id: 'p2', name: 'Bob', text: 'asexuals are attention *****', at: 1, sub: 'acct-troll', sg: SG });
  assert.equal(r.host.onSend('world', '/block Bob'), true);
  await settle(); await settle();
  assert.deepEqual(r.asked.filter((a) => a.path === '/v1/safety/block'), [], 'two accounts: nothing asked');
  const said = r.log.tab('world').messages.at(-1).text;
  assert.match(said, /^2 players are called Bob\. Nobody was blocked/);
  r.host.onSend('world', '/report Bob hate');
  await settle(); await settle();
  assert.match(r.log.tab('world').messages.at(-1).text, /^2 players are called Bob\. Nothing was reported/);
  assert.deepEqual(r.asked, []);
  const r2 = hostRig({ peers: [], answers: { '/v1/safety/block': { ok: true, blocks: [{ sub: 'acct-troll', name: 'xXbobXx', at: 1 }] } } });
  r2.log.push('world', { id: 'p2', name: 'Bob', text: 'gross', at: 1, sub: 'acct-troll', sg: SG });
  r2.host.onSend('world', '/block Bob');
  await settle(); await settle();
  assert.deepEqual(r2.asked.at(-1), { path: '/v1/safety/block', body: { target: 'acct-troll' } });
  assert.match(r2.log.tab('world').messages.at(-1).text, /^You blocked Bob \(account xXbobXx\)\./);
  r2.host.onSend('world', '/block Nobody');
  await settle();
  assert.equal(r2.log.tab('world').messages.at(-1).text, 'Nobody called Nobody is here or said anything in your chat. Nobody was blocked.');
});

test('AUDIT SAFE CLIENT-4 A BLOCK FROM THE OPEN PANEL TAKES THE ACCOUNT\'S ROWS OFF THE DRAWN LIST, the middle ones too - the log counts its removals and the list is rebuilt on a new count (mutant: the repaint growing over a removal)', async () => {
  const r = hostRig();
  const panel = createChatPanel({ log: r.log, onSend: () => true, doc: r.doc, win: fakeWindow(), touch: false, overlay: () => false, lineActions: (l) => r.host.lineActions(l) });
  r.log.push('world', { id: 'p3', name: 'Sylvia', text: 'happy pride month!', at: 0, sub: 'acct-syl', sg: SG });
  const troll = r.log.push('world', { id: 'p2', name: 'Troll', text: 'freaks', at: 1, sub: 'acct-tro', sg: SG });
  r.log.push('world', { id: 'p3', name: 'Sylvia', text: 'ugh, again', at: 2, sub: 'acct-syl', sg: SG });
  panel.open();
  panel.render();
  const root = r.doc.body.children.find((c) => String(c.className).startsWith('dfchat'));
  const drawn = () => all(root, 'dfchat-text').map((n) => n.textContent);
  assert.ok(drawn().includes('freaks'));
  r.host.lineActions(troll).at(-1).run();
  await settle(); await settle();
  panel.render();
  assert.equal(r.log.removed, 1);
  assert.equal(drawn().includes('freaks'), false, 'the blocked row is no longer drawn');
  assert.ok(drawn().includes('ugh, again') && drawn().includes('happy pride month!'));
});

test('AUDIT SAFE CLIENT-5 A REPORT CARRIES NOTHING OUT OF ITS DAY: a line this page heard more than REPORT_PICK_AGE_MS ago by its own clock is not picked - as context or as theirs - and what is carried passes the service\'s shape; a report with nothing left says the lines are too old (mutant: the age unread)', async () => {
  let clock = 1_800_000_000_000;
  const log = new ChatLog({ now: () => clock });
  log.push('guild', { id: 'p1', name: 'Sylvia', text: 'night all', at: clock, sub: 'acct-syl', sg: SG });
  log.push('guild', { id: 'p2', name: 'Troll', text: 'old line', at: clock, sub: 'acct-tro', sg: SG });
  clock += lawNs.REPORT_PICK_AGE_MS + 60_000;
  const bad = log.push('guild', { id: 'p2', name: 'Troll', text: 'asexuals are attention *****', at: clock - 1000, sub: 'acct-tro', sg: SG });
  assert.deepEqual(log.reportLines('acct-tro', { seq: bad.seq }).map((l) => l.text), ['asexuals are attention *****'], 'a line\'s own report: no context from yesterday');
  assert.deepEqual(log.reportLines('acct-tro').map((l) => l.text), ['asexuals are attention *****'], '/report: none of theirs from yesterday');
  assert.ok(lawNs.REPORT_PICK_AGE_MS < lawNs.REPORT_LINE_AGE_MS);
  assert.equal(lawNs.reportShape({ target: 'acct-tro', reason: 'hate', lines: log.reportLines('acct-tro') }, clock).error, undefined);
  // a line's own Report on a line heard too long ago says so - never "nothing they said can be reported"
  const r = hostRig();
  const old = r.log.push('world', { id: 'p2', name: 'Troll', text: 'gross', at: 2, sub: 'acct-tro', sg: SG });
  old.t -= lawNs.REPORT_PICK_AGE_MS + 1;
  r.host.lineActions(old)[0].run();
  await settle();
  assert.deepEqual(r.asked, [], 'nothing sent');
  assert.equal(r.log.tab('world').messages.at(-1).text, acctNs.accountRefusalText('report-stale'));
});

test('AUDIT SAFE CLIENT-6 / RELAY-1 A LINE IS REPORTED IN THE WORDS THE RELAY SIGNED: sanitizeChat is not idempotent ("n fuck-i-g" is signed "n ****-i-g", and a second pass reads "* ****-*-*"), so the session keeps the relay\'s words beside the ones the log draws and a report carries those - every stamp verifies (mutants: the relay\'s words never kept; the report carrying the drawn words)', async () => {
  const subtle = globalThis.crypto.subtle;
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const now = Date.now();
  const relay = async (raw, at) => {   // the relay's own law: parseClient's mask, then the stamp on what it relays
    const m = wireNs.parseClient(JSON.stringify({ t: 'chat', text: raw }), { hasHello: true });
    const frame = { t: 'chat', id: 'tro-0002', name: 'Troll', text: m.text, at, sub: 'acct-tro' };
    frame.sg = await stampNs.mintStamp({ tab: stampNs.stampTabOf(CHAT_WORLD_ROOM), sub: 'acct-tro', name: 'Troll', at, text: frame.text }, kp.privateKey, { subtle });
    return frame;
  };
  const { FakeWS, sockets } = fakeSocketClass();
  const { s, ws } = welcomedSession(FakeWS, sockets, CHAT_WORLD_ROOM, { now: () => now });
  const log = new ChatLog({ now: () => now });
  s.onChat = (line) => log.push('world', line);
  const crafted = await relay('n fuck-i-g', now - 3000);
  assert.notEqual(wireNs.sanitizeChat(crafted.text), crafted.text, 'the mask is not idempotent on this line');
  ws.receive(crafted);
  ws.receive(await relay('nobody wants your pride flag, freak', now - 2000));
  assert.equal(log.tab('world').messages.find((l) => l.sub === 'acct-tro').text, wireNs.sanitizeChat(crafted.text), 'the log draws what it drew');
  const shape = lawNs.reportShape({ target: 'acct-tro', reason: 'hate', lines: log.reportLines('acct-tro') }, now);
  const verdicts = [];
  for (const l of shape.lines) verdicts.push(await stampNs.verifyStamp(l, l.sg, kp.publicKey, { subtle }));
  assert.deepEqual(verdicts, [true, true]);
});

test('AUDIT SAFE CLIENT-7 A BLOCK HOLDS BACK WHAT A BLOCKED ACCOUNT ASKS OF ME: its trade, card and duel requests never land (by its account as the relay verified it); another account\'s do; the host gives every room the block list\'s ear (mutants: the directed frames never asked; the host never handing the ear)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const { s, ws } = welcomedSession(FakeWS, sockets, CHAT_WORLD_ROOM);
  const got = [];
  s.onTrade = (id) => got.push(`trade:${id}`); s.onCard = (id) => got.push(`card:${id}`); s.onDuel = (id) => got.push(`duel:${id}`);
  const r = hostRig({ blocks: [{ sub: 'acct-tro', name: 'Troll', at: 1 }], opts: { links: () => [s] } });
  await r.host.start();
  assert.equal(s.hears, r.host.hears);
  for (const [t, data] of [['trade', { k: 'ask', to: 'me-00001', s: 'abc123' }], ['card', { to: 'me-00001', ask: true }], ['duel', { k: 'ask', to: 'me-00001', s: 'abc123' }]]) {
    ws.receive({ t, id: 'tro-0002', sub: 'acct-tro', data });
    ws.receive({ t, id: 'pal-0003', sub: 'acct-pal', data });
  }
  assert.deepEqual(got, ['trade:pal-0003', 'card:pal-0003', 'duel:pal-0003']);
  assert.deepEqual([...onlineNs.BLOCKED_KINDS].sort(), ['card', 'duel', 'page', 'trade', 'wed']);
});

test('AUDIT SAFE CLIENT-8 A BLOCK LIST THAT COULD NOT BE READ IS READ AGAIN - after BLOCKS_RETRY_MS, doubling; and a room welcomed again reads it again, no oftener than BLOCKS_REREAD_MS (mutants: the read never retried; a welcome never reading)', async () => {
  const timers = [];
  let clock = 1_000_000, fails = 2;
  const r = hostRig({ answers: { '/v1/safety/blocks': () => (fails-- > 0 ? [500, { error: 'server' }] : { ok: true, blocks: [{ sub: 'acct-tro', name: 'Troll', at: 1 }] }) },
    opts: { setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimer: () => {}, now: () => clock } });
  await r.host.start();
  assert.equal(r.log.hears('acct-tro'), true, 'unread: heard');
  assert.deepEqual(timers.map((x) => x.ms), [hostNs.BLOCKS_RETRY_MS]);
  timers[0].fn(); await settle(); await settle();
  assert.deepEqual(timers.map((x) => x.ms), [hostNs.BLOCKS_RETRY_MS, 2 * hostNs.BLOCKS_RETRY_MS], 'doubling');
  timers[1].fn(); await settle(); await settle();
  assert.equal(r.log.hears('acct-tro'), false, 'read at last: the block holds');
  const reads = () => r.asked.filter((a) => a.path === '/v1/safety/blocks').length;
  const n = reads();
  r.links[0].onWelcomed();
  await settle();
  assert.equal(reads(), n, 'a welcome a moment after a read reads nothing');
  clock += hostNs.BLOCKS_REREAD_MS;
  r.links[0].onWelcomed(); r.links[1].onWelcomed();
  await settle(); await settle();
  assert.equal(reads(), n + 1, 'a reconnect reads it again - once for every room');
  // the session's own word: every welcome of its room's socket, a reconnect's too
  const { FakeWS, sockets } = fakeSocketClass();
  const { s, ws } = welcomedSession(FakeWS, sockets, CHAT_WORLD_ROOM);
  let welcomed = 0;
  s.onWelcomed = () => welcomed++;
  ws.receive({ t: 'welcome', id: 'me-00001', peers: [], n: 1, v: 'world215' });
  assert.equal(welcomed, 1);
});

test('AUDIT SAFE CLIENT-9 /unblock TAKES THE NAME THE LINE SHOWED: NAME-AS - the room read a character\'s name and the list keeps the account\'s; either undoes the block, and /blocked says both (mutant: the shown name never kept)', async () => {
  const r = hostRig({ peers: [], answers: { '/v1/safety/block': { ok: true, blocks: [{ sub: 'acct-tro', name: 'xX_tr0ll_Xx', at: 1 }] } } });
  const line = r.log.push('world', { id: 'p2', name: 'Cyrus Redguard', text: 'freaks', at: 1, sub: 'acct-tro', sg: SG });
  r.host.lineActions(line).at(-1).run();
  await settle(); await settle();
  r.host.onSend('world', '/blocked');
  await settle();
  assert.equal(r.log.tab('world').messages.at(-1).text, 'Blocked: xX_tr0ll_Xx (Cyrus Redguard)');
  r.host.onSend('world', '/unblock Cyrus Redguard');
  await settle(); await settle();
  assert.deepEqual(r.asked.at(-1), { path: '/v1/safety/unblock', body: { target: 'acct-tro' } });
  r.host.onSend('world', '/unblock Somebody');
  await settle();
  assert.match(r.log.tab('world').messages.at(-1).text, /^You have not blocked anyone called Somebody\./);
});

test('AUDIT SAFE CLIENT-10 THE CODE\'S CARD IS AN ENHANCED WINDOW: on the overlay stack while it stands and off it after, Escape is Not now - once, and stopped there - I agree has the focus, the pointer lock is let go, and the stack\'s own close is Not now too (mutants: Escape unread; the stack never told)', () => {
  const doc = fakeDocument();
  let locks = 0;
  doc.pointerLockElement = {}; doc.exitPointerLock = () => { locks++; };
  const listeners = [];
  const win = { addEventListener: (t, fn) => listeners.push({ t, fn }), removeEventListener: (t, fn) => { const i = listeners.findIndex((l) => l.fn === fn); if (i >= 0) listeners.splice(i, 1); } };
  const stack = [];
  const register = (close) => { const e = { close }; stack.push(e); return () => { const i = stack.indexOf(e); if (i >= 0) stack.splice(i, 1); }; };
  let yes = 0, no = 0;
  const c = createConductCard({ agree: () => yes++, later: () => no++, doc, win, register });
  c.show();
  assert.equal(stack.length, 1);
  assert.equal(doc.activeElement, all(c.root, 'yes')[0], 'I agree has the focus');
  assert.equal(locks, 1);
  let stopped = 0;
  const esc = { key: 'Escape', code: 'Escape', preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() { stopped++; } };
  const press = () => { for (const l of [...listeners]) if (l.t === 'keydown') l.fn(esc); };
  press();
  assert.deepEqual([no, yes, c.isUp(), stack.length, stopped], [1, 0, false, 0, 1]);
  press();
  assert.equal(no, 1, 'down: Escape is no longer the card\'s');
  c.show();
  stack.at(-1).close();
  assert.deepEqual([no, c.isUp(), stack.length], [2, false, 0]);
});

test('AUDIT SAFE CLIENT-11 A BLOCK TAKES BACK A FRIEND REQUEST AND A PARTY INVITE ALREADY SHOWN: the social picture is filtered again as the list moves (mutant: the picture never filtered again)', async () => {
  const s = new SocialState({ acct: 'acct-me' });
  s.apply({ t: 'social', k: 'state', acct: 'acct-me', name: 'Me', friends: [], in: [{ acct: 'acct-tro', name: 'Troll' }, { acct: 'acct-ok', name: 'Ok' }], out: [], party: null, invites: [{ party: 'p1', from: { acct: 'acct-tro', name: 'Troll' }, members: [], at: 1, expires: 9e12 }] });
  assert.deepEqual([s.in.length, s.invites.size], [2, 1]);
  const r = hostRig({ opts: { social: () => s } });
  r.host.adoptSocial();
  const line = r.log.push('world', { id: 'p2', name: 'Troll', text: 'gross', at: 2, sub: 'acct-tro', sg: SG });
  const v = s.version;
  r.host.lineActions(line).at(-1).run();
  await settle(); await settle();
  assert.deepEqual(s.in.map((x) => x.acct), ['acct-ok']);
  assert.equal(s.invites.size, 0);
  assert.ok(s.version > v, 'the panels repaint');
});

test('AUDIT SAFE CLIENT-12 A LINE REFUSED FOR ITS PACE GOES BACK IN THE FIELD - inside the quiet window too, where nothing is said - and the panel takes it only into an empty field (mutants: the line lost; a field the player typed in overwritten)', async () => {
  let field = '';
  const panel = { restore: (text) => { if (field) return false; field = text; return true; } };
  const r = hostRig({ opts: { panel: () => panel } });
  await r.host.start();
  const link = r.links[0];
  assert.equal(r.host.onSend('world', 'hello all'), null);
  link.onSlowed({ ms: 3000 });
  assert.equal(field, 'hello all');
  field = '';
  r.host.onSend('world', 'hello again');
  link.onSlowed({ ms: 2000 });   // inside the quiet window: nothing said - and nothing lost
  assert.equal(field, 'hello again');
  assert.equal(r.log.tab(r.log.active).messages.filter((l) => /New players can send/.test(l.text)).length, 1);
  const real = createChatPanel({ log: new ChatLog(), onSend: () => true, doc: fakeDocument(), win: fakeWindow(), touch: false, overlay: () => false });
  assert.equal(real.restore('mine'), true);
  assert.equal(real.input.value, 'mine');
  real.input.value = 'typing';
  assert.equal(real.restore('mine'), false);
  assert.equal(real.input.value, 'typing');
});

test('AUDIT SAFE CLIENT-13 + DOC-10 THE MODERATOR\'S WORDS AND THE PAGE\'S OTHER DOORS: a moderator\'s ban refused in a ban\'s words, never MOD1\'s mute; /strikes says what stands NOW (banned until, its reason) and the record\'s acts in the player\'s words; a room the host makes after the start (the arena\'s) hears the order and leaves on a ban; an item posted to the chat passes the code\'s gate (mutants: the standing unsaid; the arena\'s rooms never adopted; CHAT-POST past the gate)', async () => {
  const r = hostRig({ answers: { '/v1/mod/ban': [403, { error: 'protected' }], '/v1/mod/strikes': { ok: true, name: 'Troll', strikes: 3, next: 'ban', mutedUntil: 0, bannedUntil: 2_000_000_000, banReason: 'Slurs',
    history: [{ kind: 'ban', until: 2_000_000_000, reason: 'Slurs', by: 'Mac', at: 1_760_000_000 }, { kind: 'mute', until: 1_760_001_800, reason: null, by: 'auto:reports', at: 1_759_000_000, voided: true }] } } });
  await r.host.start();
  r.host.onSend('world', '/ban Troll 7');
  await settle(); await settle();
  assert.equal(r.log.tab('world').messages.at(-1).text, 'Moderators cannot be banned.');
  r.host.onSend('world', '/strikes Troll');
  await settle(); await settle();
  const said = r.log.tab('world').messages.slice(-4).map((l) => l.text);
  assert.match(said[0], /^Troll: 3 strikes in 90 days\. Next: a ban\.$/);
  assert.match(said[1], /^Now: banned until .+\. Reason: Slurs$/);
  assert.match(said[2], /^- .+: banned until .+, by Mac - Slurs$/);
  assert.match(said[3], /^- .+: muted until .+, by auto:reports \(voided\)$/);
  const arena = { room: 'arena:hall', peers: new Map(), mute: [], left: 0, sendMuteOrder(o) { this.mute.push(o); return true; }, sendBanOrder() { return true; }, leave() { this.left++; } };
  assert.equal(r.host.adoptLink(arena), arena);
  arena.onLaw({ order: orderOf({ o: 'mute', s: 'acct-me', mu: 2e9 }) });
  assert.deepEqual(r.links.map((l) => l.mute.length).concat(arena.mute.length), [1, 1, 1], 'carried to every room - the arena\'s too');
  r.links[0].onBanned({ until: 2e9 });
  assert.equal(arena.left, 1, 'and left on a ban');
  // CHAT-POST: an item posted from the pack goes straight to the tab's session (world.js postItemInChat -> chatSend)
  const { FakeWS, sockets } = fakeSocketClass();
  const { s, ws } = welcomedSession(FakeWS, sockets, CHAT_WORLD_ROOM);
  const g = hostRig({ conduct: false, opts: { links: () => [s] } });
  await g.host.start();
  assert.equal(s.sendChat('[Daedric Dagger]'), false, 'a post waits for the code, as a typed line does');
  assert.equal(ws.sent.some((f) => JSON.parse(f).t === 'chat'), false, 'nothing went');
  assert.equal(g.doc.body.children.find((c) => String(c.className).startsWith('dfconduct'))?.dataset.up, '1', 'the card stands');
  g.host.adopt({ conduct: true });
  assert.equal(s.sendChat('[Daedric Dagger]'), true);
});

test('AUDIT SAFE DOC-13 + SERVICE-10 A REPORT CARRIES ITS NOTE AND A BAN ITS REASON - the words after the first colon, to the service, the name before it (mutants: the note dropped on the way; the reason never sent)', async () => {
  const r = hostRig({ answers: { '/v1/mod/ban': { ok: true, target: 'acct-tro', name: 'Troll', until: 2e9, reason: 'Slurs in World chat', order: orderOf({ o: 'ban', s: 'acct-tro', bn: 2e9 }) } } });
  r.log.push('world', { id: 'p2', name: 'Troll', text: 'gross', at: 2, sub: 'acct-tro', sg: SG });
  r.host.onSend('world', '/report Troll harassment: he follows me from town to town');
  await settle(); await settle();
  const rep = r.asked.find((a) => a.path === '/v1/safety/report');
  assert.deepEqual([rep.body.target, rep.body.reason, rep.body.note], ['acct-tro', 'harassment', 'he follows me from town to town']);
  r.host.onSend('world', '/ban Troll 7: Slurs in World chat');
  await settle(); await settle();
  assert.deepEqual(r.asked.at(-1), { path: '/v1/mod/ban', body: { target: 'acct-tro', days: 7, reason: 'Slurs in World chat' } });
  assert.deepEqual(r.links.map((l) => l.ban.length), [1, 1], 'its order carried');
  assert.match(r.log.tab('world').messages.at(-1).text, /^Troll is banned until /);
});

test('AUDIT SAFE DOC-4 THE REPORTS REACH A MODERATOR IN THE GAME: /cases lists the open cases with the id to name each by; /case shows its reasons, notes, the verdict and its lines - the account\'s marked >, the line the reviewer flagged ! ; /dismiss closes it and carries the unmute order its answer brings; the service\'s new refusals in words; /modhelp lists them (mutants: /dismiss\'s order dropped; the flagged line unmarked)', async () => {
  const unmute = orderOf({ o: 'mute', s: 'acct-tro', mu: 0 });
  const kase = { id: 'c1', target: 'acct-tro', name: 'Troll', status: 'open', reports: 3, credible: 2, reasons: ['hate', 'harassment'], notes: ['he follows me'], auto: 'reports',
    ai: { category: 'hate', severity: 3, confidence: 0.95, mode: 'shadow', reason: 'A slur about asexual players.', line: { at: 2000, sub: 'acct-tro' } },
    lines: [{ at: 1000, sub: 'acct-syl', name: 'Sylvia', tab: 'world', text: 'happy pride' }, { at: 2000, sub: 'acct-tro', name: 'Troll', tab: 'world', text: 'attention *****' }, { at: 3000, sub: 'acct-tro', name: 'Troll', tab: 'world', text: 'lol' }] };
  const r = hostRig({ answers: {
    '/v1/mod/cases': { ok: true, cases: [{ id: 'c1', target: 'acct-tro', name: 'Troll', reports: 3, credible: 2, reasons: ['hate'], ai: { category: 'hate', severity: 3, confidence: 0.95, mode: 'on' }, auto: null, openedAt: 1, updatedAt: 2 }] },
    '/v1/mod/case': { ok: true, case: kase }, '/v1/mod/dismiss': { ok: true, case: 'c1', name: 'Troll', order: unmute }, '/v1/mod/unban': [400, { error: 'not-banned' }] } });
  const lines = () => r.log.tab('world').messages.map((l) => l.text);
  r.host.onSend('world', '/cases');
  await settle(); await settle();
  assert.deepEqual(r.asked.at(-1), { path: '/v1/mod/cases', body: {} });
  assert.deepEqual(lines().slice(-2), ['1 open case, the most credible first:', 'Troll (#acct-tro): 3 reports, 2 credible - Hate or slurs. The reviewer says Hate or slurs, severity 3, confidence 95%.']);
  r.host.onSend('world', '/case #acct-tro');
  await settle(); await settle();
  assert.deepEqual(r.asked.at(-1), { path: '/v1/mod/case', body: { target: 'acct-tro' } });
  const shown = lines().slice(-7);
  assert.equal(shown[0], 'The case on Troll (#acct-tro): 3 reports, 2 credible. Why: Hate or slurs, Harassment or bullying.');
  assert.equal(shown[1], 'Note: he follows me');
  assert.match(shown[2], /^The reviewer says Hate or slurs, severity 3, confidence 95%\. \(shadow mode: no action taken\) A slur about asexual players\.$/);
  assert.equal(shown[3], 'Muted automatically.');
  assert.match(shown[4], /^- .+ Sylvia: happy pride$/);
  assert.match(shown[5], /^! .+ Troll: attention \*\*\*\*\*$/);
  assert.match(shown[6], /^> .+ Troll: lol$/);
  r.host.onSend('world', '/dismiss Troll');
  await settle(); await settle();
  assert.deepEqual(r.asked.at(-1), { path: '/v1/mod/dismiss', body: { target: 'acct-tro' } });
  assert.deepEqual(r.links.map((l) => l.mute.length), [1, 1], 'the unmute carried to every room');
  assert.equal(lines().at(-1), 'The case on Troll is dismissed. The automatic mute it caused is lifted.');
  r.host.onSend('world', '/unban Troll');
  await settle(); await settle();
  assert.equal(lines().at(-1), 'That account is not banned.');
  assert.equal(acctNs.accountRefusalText('no-case'), 'That player has no open case.');
  r.host.onSend('world', '/modhelp');
  await settle();
  for (const c of ['/mute', '/ban', '/strikes', '/cases', '/case', '/dismiss']) assert.ok(lines().some((l) => l.startsWith(c)), `/modhelp names ${c}`);
});
