// EMOTE1 (2026-09-23, the community arc - Addison Knox: "Emotes, be it emojis or additional animations"): AN ACTION, A
// GESTURE, AND AN EMOJI THAT STAYS WHOLE. Driven: the one sanitizer's joiner law (kept between two pictographs and
// nowhere else, idempotent under a fuzz, whole at the bound); the action line over the wire, the real Room, the
// session and the log; the gestures, `/me`, `/emotes` and the shortcodes; the bubble's cut between whole characters
// and its refusal of an action; the picker over a fake document; the host by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizeChat, parseClient, CHAT_MAX, EMOTE_RELAY_MIN, relaySupportsEmote, RELAY_VERSION, CHAT_WORLD_ROOM, SOCIAL_ROOM } from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { ChatLog, EMOTE_OLD_RELAY_TEXT } from '../src/net/chat.js';
import { parseChatLine, EMOTES, emoteText, SHORTCODES, SHORTCODE_LIST, expandShortcodes, EMOTE_LINES, HELP_LINES } from '../src/net/chatCommands.js';
import { bubbleText, bubbleLineOk, graphemeCut, BUBBLE_CHARS, BUBBLE_ELLIPSIS } from '../src/ui/nameLayer.js';
import { createChatPanel, CHAT_CSS, CHAT_WIDTH_MIN } from '../src/ui/chatPanel.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
const ZWJ = '‍';
const MAN = '\u{1F468}', WOMAN = '\u{1F469}', GIRL = '\u{1F467}', SHRUG = '\u{1F937}', MALE = '♂', FE0F = '️', WAVE = '\u{1F44B}', TONE = '\u{1F3FD}', FIRE = '\u{1F525}', WHITE_FLAG = '\u{1F3F3}', RAINBOW = '\u{1F308}';

// ─── THE JOINER ─────────────────────────────────────────────────────────────────────────────────────────────────

test('EMOTE1 the joiner: kept between two pictographs - a family, a profession, a skin-toned gesture, the rainbow flag - and gone everywhere else, a word split by one read whole (mutants: the joiner kept anywhere; dropped everywhere; the skin tone or selector breaking the run; a trailing joiner past the bound)', () => {
  const family = MAN + ZWJ + WOMAN + ZWJ + GIRL;
  for (const e of [family, SHRUG + ZWJ + MALE + FE0F, WAVE + TONE + ZWJ + FIRE, WHITE_FLAG + FE0F + ZWJ + RAINBOW]) assert.equal(sanitizeChat(`hi ${e} all`), `hi ${e} all`, `${JSON.stringify(e)} whole`);
  assert.equal(sanitizeChat(`b${ZWJ}ad`), 'bad', 'between letters it hides a split word a filter reads - gone');
  assert.equal(sanitizeChat(`${MAN} ${ZWJ}${WOMAN}`), `${MAN} ${WOMAN}`, 'a space before it: no pictograph to join');
  assert.equal(sanitizeChat(`${ZWJ}${WOMAN}`), WOMAN, 'nothing before it');
  assert.equal(sanitizeChat(`${MAN}${ZWJ}`), MAN, 'nothing after it');
  assert.equal(sanitizeChat(`${MAN}${ZWJ}${ZWJ}${WOMAN}`), `${MAN}${ZWJ}${WOMAN}`, 'two in a row are one');
  assert.equal(sanitizeChat(`${MAN}${ZWJ}​${WOMAN}`), MAN + WOMAN, 'an invisible after it: it joins nothing it can see');
  assert.equal(sanitizeChat(`a${FE0F}${ZWJ}${WOMAN}`), `a${FE0F}${WOMAN}`, 'a selector after a LETTER starts no emoji');
  // the bound: 237 letters, a man, a joiner, a woman - the cut takes the woman, and the joiner she needed goes with her
  const cut = sanitizeChat('a'.repeat(CHAT_MAX - 3) + MAN + ZWJ + WOMAN);
  assert.ok(cut.endsWith(MAN) && !cut.includes(ZWJ), JSON.stringify(cut.slice(-4)));
  assert.equal(sanitizeChat(cut), cut, '...and a second pass takes nothing more');
  // idempotent under a fuzz over the emoji's own parts (CHAT1's own law - what the client sends the relay takes)
  const alphabet = ['a', ' ', ZWJ, ZWJ, MAN, WOMAN, FE0F, TONE, MALE, '​', '\ud83d', '̀', '\u{E0041}', '⃣', '1'];
  let seed = 11;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 4000; i++) {
    let x = ''; const n = 1 + Math.floor(rnd() * 14);
    for (let j = 0; j < n; j++) x += alphabet[Math.floor(rnd() * alphabet.length)];
    const once = sanitizeChat(x);
    assert.equal(sanitizeChat(once), once, `idempotent on ${JSON.stringify(x)}`);
    const i2 = once.indexOf(ZWJ);
    if (i2 >= 0) assert.ok(/\p{Extended_Pictographic}/u.test([...once.slice(i2 + 1)][0] ?? ''), `a kept joiner has a pictograph after it: ${JSON.stringify(once)}`);
  }
});

// ─── THE ACTION LINE ────────────────────────────────────────────────────────────────────────────────────────────

test('EMOTE1 the action on the wire: `me: true` and nothing else - a truthy junk value refused, never read as an action; world99 the first relay that carries it (mutants: any truthy `me` admitted; the flag dropped at the relay; the version door one high)', async () => {
  const h = { hasHello: true };
  assert.deepEqual(parseClient(JSON.stringify({ t: 'chat', text: 'waves.', me: true }), h), { t: 'chat', text: 'waves.', me: true });
  assert.deepEqual(parseClient(JSON.stringify({ t: 'chat', text: 'waves.', me: true, ch: 'party' }), h), { t: 'chat', text: 'waves.', ch: 'party', me: true });
  for (const me of [1, 'true', false, null, {}]) assert.deepEqual(parseClient(JSON.stringify({ t: 'chat', text: 'x', me }), h), { error: 'bad chat' }, JSON.stringify(me));
  assert.equal(EMOTE_RELAY_MIN, 99);
  assert.equal(relaySupportsEmote('world98'), false); assert.equal(relaySupportsEmote('world99'), true); assert.ok(relaySupportsEmote(RELAY_VERSION));
  // the real Room: the flag rides the fanned line, the asker's echo included; a plain line carries none
  const r = fakeRoom(CHAT_WORLD_ROOM);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try {
    const a = r.connect(); await r.hello(a, 'peer-a', null, { name: 'Ann' });
    const b = r.connect(); await r.hello(b, 'peer-b', null, { name: 'Bob' });
    a.sent.length = 0; b.sent.length = 0;
    await r.raw(a, JSON.stringify({ t: 'chat', text: 'waves at Bob.', me: true }));
    clock += 1000;
    await r.raw(a, JSON.stringify({ t: 'chat', text: 'hello' }));
    const lines = (ws) => ws.sent.filter((m) => m.t === 'chat');
    for (const ws of [a, b]) assert.deepEqual(lines(ws).map((m) => [m.text, m.me]), [['waves at Bob.', true], ['hello', undefined]]);
  } finally { Date.now = realNow; }
});

test('EMOTE1 the action at the client: asked only of a relay that carries it, the flag believed only as `true`, drawn as kind "me" - never a system line, never an aside, never bubbled (mutants: the door dropped; the kind lost; an action bubbled)', () => {
  const rig = (v) => {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', presence: false, WebSocketImpl: FakeWS, now: () => 1_000_000 });
    const heard = []; s.onChat = (l) => heard.push(l);
    quiet(() => s.join(SOCIAL_ROOM)); sockets[0].open();
    quiet(() => sockets[0].receive({ t: 'welcome', id: 'aaaa-0001', peers: [], host: null, world: null, v }));
    return { s, ws: sockets[0], heard, out: () => sockets[0].sent.map((x) => JSON.parse(x)).filter((m) => m.t === 'chat') };
  };
  const old = rig('world98');
  assert.equal(old.s.sendChat('waves.', { me: true }), false, 'world98 would say "waves." bare');
  assert.equal(old.out().length, 0);
  const { s, ws, heard, out } = rig(RELAY_VERSION);
  assert.equal(s.sendChat('  waves.  ', { me: true }), true);
  assert.deepEqual(out().at(-1), { t: 'chat', text: 'waves.', me: true });
  ws.receive({ t: 'chat', id: 'bbbb-0002', name: 'Bob', text: 'bows.', at: 1, me: true });
  ws.receive({ t: 'chat', id: 'bbbb-0002', name: 'Bob', text: 'not an action', at: 2, me: 1 });
  assert.deepEqual(heard.map((l) => [l.text, l.me]), [['bows.', true], ['not an action', undefined]]);
  const log = new ChatLog({ now: () => 1 });
  const act = log.push('local', heard[0]);
  assert.equal(act.kind, 'me');
  assert.equal(log.push('local', { id: 'b', name: 'B', text: '((also an aside?))', me: true }).kind, 'me', 'an action is an action, whatever its words');
  assert.equal(log.push('local', heard[1]).kind, '');
  assert.equal(log.pushAll({ text: 'a notice', me: true }).kind, '', 'a line the game said is never an action');
  assert.equal(bubbleLineOk(act), false, 'done, not said: no bubble');
  assert.match(EMOTE_OLD_RELAY_TEXT, /server's next update/);
});

// ─── THE GESTURES AND THE SHORTCODES ────────────────────────────────────────────────────────────────────────────

test('EMOTE1 the grammar: /me an action on this tab, a gesture on Local ("waves." or "waves at Ann."), /emotes the list, a gesture\'s name bounded and nothing but a name, `:code:` its emoji and an unknown code as typed (mutants: /me with nothing to do said; a gesture\'s target unbounded; a prototype key read as a gesture; a shortcode case-sensitive)', () => {
  assert.deepEqual(parseChatLine('/me looks around'), { kind: 'me', text: 'looks around' });
  assert.deepEqual(parseChatLine('/me'), { kind: 'empty', name: 'me' });
  assert.deepEqual(parseChatLine('/wave'), { kind: 'emote', text: 'waves.' });
  assert.deepEqual(parseChatLine('/WAVE  Ann '), { kind: 'emote', text: 'waves at Ann.' });
  assert.deepEqual(parseChatLine('/emotes'), { kind: 'emotes' });
  for (const k of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) assert.equal(parseChatLine(`/${k}`).kind, 'unknown', `/${k} is no gesture`);
  assert.equal(emoteText('bow', 'x'.repeat(80)), `bows to ${'x'.repeat(24)}.`, 'a name, bounded');
  assert.equal(emoteText('nope'), null);
  for (const [n, [alone, at]] of Object.entries(EMOTES)) { assert.ok(alone && at.includes('{t}'), n); assert.equal(parseChatLine(`/${n}`).kind, 'emote', `/${n}`); }
  assert.ok(Object.keys(EMOTES).length >= 20);
  assert.equal(EMOTE_LINES[1], Object.keys(EMOTES).map((n) => `/${n}`).join(' '));
  assert.ok(HELP_LINES.some((l) => l.startsWith('/me ')) && HELP_LINES.some((l) => l.includes('/emotes')) && HELP_LINES.some((l) => l.includes(':smile:')));
  assert.equal(expandShortcodes('hi :smile: :nope: :+1: :SWORD: :heart:'), `hi ${SHORTCODES.smile} :nope: ${SHORTCODES['+1']} ${SHORTCODES.sword} ${SHORTCODES.heart}`);
  assert.equal(expandShortcodes('time 10:30:45'), 'time 10:30:45', 'a clock is not a code');
  for (const [code, ch] of Object.entries(SHORTCODES)) assert.equal(sanitizeChat(ch), ch, `:${code}: survives the wire whole`);
});

test('EMOTE1 the bubble\'s cut: between whole characters as a reader counts them - a surrogate pair never halved, a joined family never cut to a man and a joiner (mutants: the cut back on UTF-16 units)', () => {
  const family = MAN + ZWJ + WOMAN + ZWJ + GIRL;
  const long = 'a'.repeat(BUBBLE_CHARS - 5) + family + 'tail';
  const b = bubbleText(long);
  assert.equal(b, 'a'.repeat(BUBBLE_CHARS - 5) + BUBBLE_ELLIPSIS, 'the family does not fit whole, so it does not go in part');
  assert.equal(graphemeCut('a'.repeat(BUBBLE_CHARS - 1) + '\u{1F600}', BUBBLE_CHARS), 'a'.repeat(BUBBLE_CHARS - 1), 'half a face is no face');
  assert.equal(graphemeCut(family + 'b', 8), family, 'a whole family inside the bound stays');
  assert.equal(graphemeCut('short', BUBBLE_CHARS), 'short');
});

// ─── THE PICKER ─────────────────────────────────────────────────────────────────────────────────────────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', title: '', placeholder: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), scrollTop: 0, scrollHeight: 100, clientHeight: 100, selectionStart: null, selectionEnd: null,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    setSelectionRange(a, b) { n.selectionStart = a; n.selectionEnd = b; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, code: e.code, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
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
function fakeWindow() {
  const listeners = [];
  return {
    addEventListener(t, fn, capture) { listeners.push({ t, fn, capture }); }, removeEventListener() {},
    key(code, target) { const ev = { type: 'keydown', code, target, isTrusted: true, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} }; for (const l of listeners) if (l.t === 'keydown') l.fn(ev); return ev; },
  };
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];

test('EMOTE1 the picker: a button in the form opens a grid of the shortcodes\' own emoji (one each, named by its code); a pick lands at the caret and closes it; Escape closes the grid before the chat, and the chat\'s close takes it down (mutants: the pick at the end whatever the caret; the grid left open after a pick; Escape closing the chat over an open grid; the grid a listbox of buttons)', () => {
  const log = new ChatLog();
  const doc = fakeDocument(), win = fakeWindow();
  const panel = createChatPanel({ log, onSend: () => true, action: () => null, doc, win, touch: false });
  const root = doc.body.children[0];
  panel.open(); panel.render({});
  const btn = one(root, 'dfchat-emoji'), grid = one(root, 'dfchat-emojis'), input = one(root, 'dfchat-input');
  assert.ok(btn && grid && input);
  assert.equal(one(root, 'dfchat-form').children.indexOf(btn), 1, 'beside the field, before Send');
  const picks = find(grid, 'dfchat-emoji-pick');
  assert.equal(picks.length, new Set(Object.values(SHORTCODES)).size, 'one button an emoji');
  assert.equal(picks[0].textContent, SHORTCODES.smile); assert.equal(picks[0].title, ':smile:');
  const thumbs = picks.find((b) => b.textContent === SHORTCODES.thumbsup);
  assert.equal(thumbs.title, ':thumbsup:', 'an emoji with two codes is named by its first');
  assert.deepEqual(picks.map((b) => b.textContent), [...new Set(SHORTCODE_LIST.map(([, ch]) => ch))], 'in the table\'s written order - never an integer-like code first');
  assert.equal(grid.className, 'dfchat-emojis', 'closed');
  assert.equal(grid.attrs.role, 'group', 'a set of buttons - never a listbox, whose children would have to be options');
  btn.fire('click');
  assert.equal(grid.className, 'dfchat-emojis on', 'open');
  assert.equal(btn.attrs['aria-expanded'], 'true', 'the button says the grid is open');
  input.value = 'hello world'; input.selectionStart = 5; input.selectionEnd = 5;
  picks[0].fire('click');
  assert.equal(input.value, `hello${SHORTCODES.smile} world`, 'at the caret');
  assert.equal(input.selectionStart, 5 + SHORTCODES.smile.length, 'the caret after it');
  assert.equal(grid.className, 'dfchat-emojis', 'a pick closes the grid');
  assert.equal(btn.attrs['aria-expanded'], 'false', '...and the button says so');
  btn.fire('click');
  win.key('Escape', input);
  assert.equal(grid.className, 'dfchat-emojis', 'Escape takes the grid down first...');
  assert.equal(log.open, true, '...and leaves the chat up');
  btn.fire('click');
  panel.close?.() ?? win.key('Escape', input);
  assert.equal(grid.className, 'dfchat-emojis', 'the chat\'s close takes the grid with it');
  assert.equal(log.open, false);
});

test('EMOTE1 the picker is the desktop\'s, and a box the SCREEN narrowed gives its button way: the touch skin hides button and grid; under the smallest box a drag can make - asked inside the box\'s border, where a container query measures - the button alone goes, the field getting back what it had before it (tools/chatChanProbe.mjs measures both in Chromium) (mutants: the query asking the drag\'s width of the content box, so the smallest box a drag makes loses the button; the rule gone; the grid hidden with it, an open one stranded)', () => {
  assert.match(CHAT_CSS, /\.dfchat\.touch \.dfchat-emoji, \.dfchat\.touch \.dfchat-emojis \{ display: none; \}/);
  const border = Number(/\.dfchat-box \{[^}]*border: (\d+)px solid/.exec(CHAT_CSS)[1]);
  const q = /@container \(width < (\d+)px\) \{ \.dfchat-emoji \{ display: none; \} \}/.exec(CHAT_CSS);
  assert.ok(q, 'the narrow box\'s rule - the button alone');
  assert.equal(Number(q[1]) + 2 * border, CHAT_WIDTH_MIN, 'the smallest box a drag can make keeps it: the query sees the box less its border');
});

// ─── THE HOST, BY SOURCE ────────────────────────────────────────────────────────────────────────────────────────

test('EMOTE1 host by source: the shortcodes expanded before the parse; an action said on this tab and a gesture on Local, both as actions; /emotes read; an action only down a relay that carries it; the action line drawn leaning (mutants: a gesture on the active tab; the action\'s flag dropped at the send)', () => {
  const w = rd('src/scenes/world.js');
  const onSend = /onSend: \(tabId, text\) => \{([\s\S]*?)\n {6}\},/.exec(w)[1];
  assert.match(onSend, /const cmd = parseChatLine\(expandShortcodes\(text\)\);/);
  assert.match(onSend, /if \(cmd\.kind === 'emotes'\) \{ for \(const line of EMOTE_LINES\) note\(line\); return 'read'; \}/);
  assert.match(onSend, /if \(cmd\.kind === 'me'\) return chatSend\(tabId, cmd\.text, tabId, \{ me: true \}\);/);
  assert.match(onSend, /if \(cmd\.kind === 'emote'\) return chatSend\('local', cmd\.text, tabId, \{ me: true \}\);/);
  const send = w.slice(w.indexOf('const chatSend = '), w.indexOf('const chatRoll = '));
  assert.match(send, /if \(me && s\?\.status === 'open' && !s\.emoteOk\) return why\(EMOTE_OLD_RELAY_TEXT\);/);
  assert.match(send, /return chatLinks\.get\(tabId\)\?\.sendChat\(text, \{ me \}\) \?\? false;/);
  const panel = rd('src/ui/chatPanel.js');
  assert.match(panel, /\$\{line\.kind === 'me' \? ' me' : ''\}/);
  assert.match(panel, /\.dfchat-line\.me \.dfchat-text \{ font-style: italic;/);
});
