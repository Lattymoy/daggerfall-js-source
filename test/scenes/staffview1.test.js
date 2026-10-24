// STAFF-VIEW1 (2026-10-23, mob: "np player esp in staff panel?", "i need staff panel to have esp", "i told you to add the
// opther parts to the menu?", "wtf u had all this build"; design doc "DFO Staff Panel: design", In game: the staff view) -
// THE STAFF TAGS, driven headless: scenes/staffViewHost.js over a fake follow (the page's, scenes/staffFollowHost.js
// staffFollowOnPage's shape) and ui/staffTags.js over a fake document of this file's own - test/net/name1_bubbles.test.js's
// shape, COPIED rather than shared, with the same write counter, because "one element per player, moved and never
// rebuilt" and "a still frame writes nothing" are claims only a counter can hold. Then the five seams the host wires,
// pinned over the source. (The flat map is slice 2's, and none of it is here.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStaffViewHost, DISMISSED_FLAGS_MAX, loadDismissedFlags, saveDismissedFlags, crowded, staffTagWords, STAFF_TAGS_MAX, STAFF_TAGS_ASK_MS, STAFF_FIND_WAIT_MS, STAFF_LINES_MAX, STAFF_TAG_HEAD_M } from '../../src/scenes/staffViewHost.js';
import { STAFF_LINE, createStaffTags } from '../../src/ui/staffTags.js';
import { validTags, NAMEPLATE_DIST } from '../../src/net/staffHook.js';
import { ID_RE } from '../../src/net/identityToken.js';
import { NAME_RANGE, sightBlockedBy } from '../../src/net/remotePlayers.js';
import { Collider } from '../../src/player/collider.js';
import { perspective, mirrorProjectionX, lookAt } from '../../src/world/mat4.js';

// ── THE FAKE DOCUMENT (test/net/name1_bubbles.test.js's shape, copied - not shared; and a press, and a canvas) ──────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, id: '', attrs: {}, writes: 0, on: {},
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } doc.structure++; },
    setAttribute(k, v) { n.attrs[k] = v; doc.writes++; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; doc.structure++; },
    addEventListener(k, f) { (n.on[k] ??= []).push(f); },
    replaceChildren(...cs) { for (const c of n.children) c.parent = null; n.children = []; n.append(...cs); },
    fire(k) { const e = { stopped: false, stopPropagation() { e.stopped = true; }, preventDefault() {} }; for (const f of n.on[k] ?? []) f(e); return e; },
  };
  let text = '', cls = '';
  Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = String(v); n.writes++; doc.writes++; } });
  Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = String(v); n.writes++; doc.writes++; } });
  n.style = new Proxy({}, { set(t, k, v) { t[k] = v; n.writes++; doc.writes++; return true; } });
  if (tag === 'canvas') {
    n.width = 300; n.height = 150;
    n.ops = [];
    const g = new Proxy({}, { get: (_t, k) => (typeof k === 'string' ? (...a) => n.ops.push([k, ...a]) : undefined), set: () => true });
    n.getContext = () => g;
  }
  return n;
}
function fakeDocument() {
  const doc = { writes: 0, structure: 0, built: 0 };
  doc.createElement = (tag) => { doc.built++; return fakeNode(tag, doc); };
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.zero = () => { doc.writes = 0; doc.structure = 0; doc.built = 0; };
  return doc;
}
/** Every node under `n` (itself too). */
const all = (n) => [n, ...n.children.flatMap(all)];
const tagsIn = (doc) => all(doc.body).filter((x) => x.attrs['data-staff-tag'] != null && !x.removed);

// ── THE FRAME, THE PAGE'S FOLLOW, THE WORLD ─────────────────────────────────────────────────────────────

const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000));
const VIEW = lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]);
const EYE = [0, 1.7, 0];
const CANVAS = { clientWidth: 1600, clientHeight: 900 };
const ORIGIN = 'https://game.test';

/** A peer as a session's drawable() hands it: an id, a name, a pose (the world frame is the scene's here). */
const peer = (id, x, z, more = {}) => ({ id, name: more.name ?? id, shown: { x, y: 0, z, yaw: 0, pitch: 0, mv: 0, ...(more.cv ? { cv: more.cv } : {}) }, ...(more.sub ? { sub: more.sub } : {}) });

/** The page's follow (staffFollowOnPage's returns), plain. */
function fakeFollow({ panel = true, locked = false, eye = [], room = [], tags = null, mode = 'exterior', refuse = null } = {}) {
  const f = {
    spoke: panel, isLocked: locked, eyePeers: eye, roomPeers: room, answer: tags, modeNow: mode, followed: [], hints: [], asks: 0, roomKey: null,
    panel: () => f.spoke, locked: () => f.isLocked, peers: () => f.eyePeers, main: () => ({ drawable: () => f.roomPeers, ...(f.roomKey ? { room: f.roomKey, layer: 2 } : {}) }),
    toScene: (p) => [p.x, p.y, p.z], mode: () => f.modeNow, tags: () => f.answer, askTags: () => { f.asks++; },
    follow: (sub, hint = null) => { if (!f.spoke || typeof sub !== 'string' || !ID_RE.test(sub) || sub === refuse) return false; f.followed.push(sub); f.hints.push(hint); return true; },
  };
  return f;
}
/** A layer that records what the host hands it. */
function fakeLayer() {
  const l = { renders: [], lineSets: [], hidden: 0, onPick: null };
  l.menus = [];
  l.make = ({ onPick }) => { l.onPick = onPick; return { menu: (title, rows) => l.menus.push({ title, rows }), render: (g, n) => l.renders.push({ groups: g, n }), strokes: (s) => l.lineSets.push(s), hide: () => { l.hidden++; }, dispose() {}, size: () => 0 }; };
  l.last = () => l.renders.at(-1);
  l.members = () => (l.last()?.groups ?? []).flatMap((g) => g.members);
  return l;
}
function rig({ glyphs = ['dev'], follow = fakeFollow(), links = null, book = [], foes = [], up = false, doc = null, layer = fakeLayer(), origin = ORIGIN, acts = null, politicAt = null, storage = null } = {}) {
  const said = [], posted = [], toggled = [];
  let t = 1_000_000;
  const win = { location: { origin }, postMessage: (m, o) => posted.push([m, o]), ...(storage ? { localStorage: storage } : {}) };
  const state = { glyphs, up, links };
  const host = createStaffViewHost({
    follow, glyphs: () => state.glyphs, links: () => state.links, book: { live: () => book }, foes: { foes }, overworld: () => toggled.push(1),
    up: () => state.up, canvas: CANVAS, say: (s) => said.push(s), win, doc: doc ?? fakeDocument(), now: () => t, acts, politicAt,
    ...(doc ? {} : { makeTags: layer.make }),
  });
  const frame = (covered = false) => host.frame(PROJ, VIEW, EYE, covered);
  return { host, follow, layer, said, posted, toggled, state, frame, tick: (ms) => { t += ms; } };
}

// ── THE GATE ───────────────────────────────────────────────────────────────────────────────────────

test('STAFF-VIEW1 the gate: no layer, no ask and no element for a player\'s glyphs ([]) or a Dungeon Master\'s, and none for staff before a Staff Panel has spoken on the page; an Admin\'s or a Moderator\'s once one has (mutants: the gate without the glyphs, the gate without the panel)', () => {
  for (const [glyphs, panel] of [[[], true], [['dm'], true], [['mod'], false], [['dev'], false], [null, true]]) {
    const doc = fakeDocument();
    const follow = fakeFollow({ panel, room: [peer('p1', 0, -20)] });
    const r = rig({ glyphs, follow, doc });
    r.frame(); r.frame();
    assert.equal(doc.built, 0, `${JSON.stringify(glyphs)} panel ${panel}: no element made`);
    assert.equal(follow.asks, 0, 'and nothing asked of the panel');
    assert.equal(r.host.marks(null), null);
  }
  for (const glyphs of [['mod'], ['shadowfang'], ['dev', 'dm']]) {
    const doc = fakeDocument();
    const follow = fakeFollow({ room: [peer('p1', 0, -20)] });
    const r = rig({ glyphs, follow, doc });
    r.frame();
    assert.equal(tagsIn(doc).length, 1, `${glyphs}: tagged`);
    assert.equal(follow.asks, 1, 'the flags asked as the view turns on');
  }
});

test('STAFF-VIEW1 the flags: asked when the view turns on, then every STAFF_TAGS_ASK_MS while it is on, and again as it turns on after a spell off; nothing asked while off (mutants: the minute\'s ask dropped)', () => {
  const r = rig();
  r.frame();
  assert.equal(r.follow.asks, 1);
  r.tick(STAFF_TAGS_ASK_MS - 1); r.frame();
  assert.equal(r.follow.asks, 1, 'not before the minute');
  r.tick(1); r.frame();
  assert.equal(r.follow.asks, 2, 'the minute\'s');
  r.follow.spoke = false; r.frame(); r.tick(5 * STAFF_TAGS_ASK_MS); r.frame();
  assert.equal(r.follow.asks, 2, 'off: nothing');
  assert.equal(r.layer.hidden, 1, 'and the tags hidden once');
  r.follow.spoke = true; r.frame();
  assert.equal(r.follow.asks, 3, 'on again: asked at once');
});

// ── WHO IS TAGGED ──────────────────────────────────────────────────────────────────────────────────

/** A real Collider with a real wall in it: a quad at z = -5 spanning x -2..2, y 0..5 (name1_bubbles' own, copied). */
function walled() {
  const c = new Collider();
  c.addMesh('wall', [-2, 0, -5, 2, 0, -5, 2, 5, -5, -2, 5, -5], [0, 1, 2, 0, 2, 3], new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  return c;
}

test('STAFF-VIEW1 through walls: a player past NAME_RANGE and behind a wall - whose name play would never draw - is still tagged, a concealed one by their true name with a small \'concealed\'', () => {
  const far = peer('p-far', 0, -80, { name: 'Bran' }), hid = peer('p-hid', 20, -60, { name: 'Ghost', cv: 1 });
  const r = rig({ follow: fakeFollow({ room: [far, hid] }) });
  const head = [0, STAFF_TAG_HEAD_M, -80];
  assert.ok(Math.hypot(head[0] - EYE[0], head[2] - EYE[2]) > NAME_RANGE, 'past the names\' own reach');
  assert.equal(sightBlockedBy(walled(), EYE, head), true, 'and the wall stands between');
  r.frame();
  const m = r.layer.members();
  assert.deepEqual(m.map((x) => x.id).sort(), ['p-far', 'p-hid']);
  assert.deepEqual(m.find((x) => x.id === 'p-hid'), { id: 'p-hid', name: 'Ghost', line: 'concealed', level: '' });
});

test('STAFF-VIEW1 the ground\'s reach: the nameplate distance from the panel\'s answer (100 m while it has said none), the nearest STAFF_TAGS_MAX, the rest a +N; behind the eye and the eye\'s own (a follow\'s target) none (mutants: no distance cut, the answer\'s distance unread, no cap, the eye\'s own tagged)', () => {
  const follow = fakeFollow({ room: [peer('near', 0, -90), peer('mid', 5, -150), peer('behind', 0, 30), peer('target', 0, -0.5)] });
  const r = rig({ follow });
  r.frame();
  assert.equal(NAMEPLATE_DIST, 100);
  assert.deepEqual(r.layer.members().map((m) => m.id), ['near'], '100 m: the one at 150 m cut, the one behind none, the eye\'s own none');
  follow.answer = validTags({ dist: 200, list: [] });
  r.frame();
  assert.deepEqual(r.layer.members().map((m) => m.id), ['near', 'mid'], '200 m');
  follow.answer = validTags({ dist: 50, list: [] });
  r.frame();
  assert.deepEqual(r.layer.members().map((m) => m.id), [], '50 m');
  // forty within reach, spread across the screen: the nearest 32, eight more
  follow.answer = null;
  follow.roomPeers = Array.from({ length: 40 }, (_, i) => peer(`p${String(i).padStart(2, '0')}`, -44 + 2.25 * i, -50));
  r.frame();
  assert.equal(STAFF_TAGS_MAX, 32);
  const shown = r.layer.members();
  assert.equal(shown.length, STAFF_TAGS_MAX);
  assert.equal(r.layer.last().n, 8, '+8');
  const d = (id) => Math.abs(-44 + 2.25 * Number(id.slice(1)));
  assert.ok(Math.max(...shown.map((m) => d(m.id))) <= Math.min(...follow.roomPeers.filter((p) => !shown.some((m) => m.id === p.id)).map((p) => d(p.id))), 'the nearest');
});

test('STAFF-VIEW1 a locked follow reads the hook\'s peers - the followed room\'s - never the host\'s own room (left while it is locked); let go, the room\'s again (mutants: the room read while locked)', () => {
  const follow = fakeFollow({ locked: true, eye: [peer('theirs', 0, -20)], room: [peer('mine', 3, -20)] });
  const r = rig({ follow });
  r.frame();
  assert.deepEqual(r.layer.members().map((m) => m.id), ['theirs']);
  follow.isLocked = false;
  r.frame();
  assert.deepEqual(r.layer.members().map((m) => m.id), ['mine']);
});

test('STAFF-VIEW1 crowds: tags this near on the screen are one box of every member, keyed apart from a lone tag', () => {
  const r = rig({ follow: fakeFollow({ room: [peer('a1', 0, -40), peer('a2', 0.2, -40), peer('b1', 10, -40)] }) });
  r.frame();
  const g = r.layer.last().groups;
  assert.deepEqual(g.map((x) => [x.key, x.members.map((m) => m.id)]), [['crowd:a1', ['a1', 'a2']], ['b1', ['b1']]]);
});

// ── WHAT A TAG SAYS ────────────────────────────────────────────────────────────────────────────────

test('STAFF-VIEW1 the flag fold: one account\'s rows fold to the most urgent (the highest level wins, with its words) and a watch on any; a Moderator\'s WATCH reads alone; the words joined (mutants: the fold kept the last row)', () => {
  const t = validTags({ dist: 100, list: [{ sub: 'acct-a', level: 'low', why: '1 report' }, { sub: 'acct-a', level: 'high', why: '4 reports' }, { sub: 'acct-a', level: 'medium', why: 'market' }, { sub: 'acct-a', watch: true }, { sub: 'acct-w', watch: true }] });
  assert.deepEqual(t.flags.get('acct-a'), { level: 'high', why: '4 reports', watch: true });
  assert.deepEqual(t.flags.get('acct-w'), { level: null, why: '', watch: true });
  assert.equal(staffTagWords(t.flags.get('acct-a'), 8, true), '4 reports · WATCH · 8 monsters · concealed');
  assert.equal(staffTagWords(t.flags.get('acct-w'), 0, false), 'WATCH');
  assert.equal(staffTagWords(null, 1, false), '1 monster');
  assert.equal(staffTagWords(null, 0, false), '');
  // a Moderator's tags: the service's role-filtered flags (a report, WATCH), never a monster, whatever the puppets say
  const follow = fakeFollow({ room: [peer('p1', 0, -20, { sub: 'acct-w' }), peer('p2', 10, -20, { sub: 'acct-r' })], tags: validTags({ dist: 100, list: [{ sub: 'acct-w', watch: true }, { sub: 'acct-r', level: 'high', why: '2 reports' }] }) });
  const r = rig({ glyphs: ['mod'], follow, foes: [{ puppet: 'p1', ai: { feet: [0, 0, -21] } }, { puppet: 'p2', ai: { feet: [10, 0, -21] } }] });
  r.frame();
  assert.deepEqual(r.layer.members().map((m) => [m.id, m.line, m.level]), [['p1', 'WATCH', ''], ['p2', '2 reports', 'high']]);
});

test('STAFF-VIEW1 an Admin\'s monsters: the game\'s own puppets by their sender - a count on the ground tag, a line to their owner on the Overworld (STAFF_LINES_MAX at most), none for a Moderator; the dead uncounted (mutants: monsters for every staff member, the lines uncapped)', () => {
  const foes = [{ puppet: 'p1', ai: { feet: [2, 0, -30] } }, { puppet: 'p1', ai: { feet: [-2, 0, -30] } }, { puppet: 'p1', dead: true, ai: { feet: [0, 0, -30] } }, { puppet: null, ai: { feet: [0, 0, -10] } }];
  const follow = fakeFollow({ room: [peer('p1', 0, -30)] });
  const r = rig({ follow, foes });
  r.frame();
  assert.equal(r.layer.members()[0].line, '2 monsters');
  assert.deepEqual(r.layer.lineSets.at(-1), [], 'the ground: the count alone');
  r.state.up = true;
  r.frame();
  assert.equal(r.layer.lineSets.at(-1).length, 2, 'the Overworld: a line each');
  assert.deepEqual(r.layer.last().groups, [], 'its tags the travel view\'s marks');
  r.state.glyphs = ['mod'];
  r.frame();
  assert.deepEqual(r.layer.lineSets.at(-1), [], 'a Moderator: none');
  r.state.up = false; r.frame();
  assert.equal(r.layer.members()[0].line, '', 'nor a count');
  r.state.glyphs = ['dev']; r.state.up = true;
  foes.length = 0;
  for (let i = 0; i < 250; i++) foes.push({ puppet: 'p1', ai: { feet: [i % 20 - 10, 0, -30 - (i % 7)] } });
  r.frame();
  assert.equal(r.layer.lineSets.at(-1).length, STAFF_LINES_MAX);
});

// ── A TAG CLICK ────────────────────────────────────────────────────────────────────────────────────

test('STAFF-VIEW1 a tag click: the account by the socket in order - the room\'s word, the chat links\' rooms, the hub\'s list, the region\'s travellers, then the hub\'s search matched by socket - followed at once, and the panel handed its card to this page\'s own origin only once the follow took (mutants: each door skipped or put first, a search\'s row matched by name, the act to \'*\', the act without a follow)', () => {
  const room = peer('p1', 0, -20, { name: 'Bran', sub: 'acct-room' });
  const links = new Map([['region', { peers: new Map([['p1', { id: 'p1', sub: 'acct-link' }]]), hubOnline: new Map() }], ['world', { peers: new Map(), hubOnline: new Map([['p1', { id: 'p1', sub: 'acct-hub' }]]) }]]);
  const book = [{ id: 'p1', name: 'Bran', sub: 'acct-book' }];
  const follow = fakeFollow({ room: [room] });
  const r = rig({ follow, links, book });
  r.frame();
  const click = () => r.layer.onPick('p1');
  click();
  assert.deepEqual(follow.followed, ['acct-room'], 'the room\'s own word first');
  assert.deepEqual(r.posted.at(-1), [{ dfoStaff: 'act', act: 'follow', sub: 'acct-room', name: 'Bran' }, ORIGIN]);
  delete room.sub; click();
  assert.equal(follow.followed.at(-1), 'acct-link', 'then a chat link\'s room');
  links.get('region').peers.clear(); click();
  assert.equal(follow.followed.at(-1), 'acct-hub', 'then the hub\'s list');
  links.get('world').hubOnline.clear(); click();
  assert.equal(follow.followed.at(-1), 'acct-book', 'then the region\'s travellers');
  book.length = 0;
  // the hub's search: the box's ask, its answer matched by the socket, never the name
  const hub = links.get('world');
  hub.asks = [];
  hub.askFind = (q) => { hub.asks.push(q); return true; };
  click();
  assert.deepEqual(hub.asks, ['Bran']);
  assert.equal(follow.followed.length, 4, 'nothing followed while it is asked');
  hub.hubFound = { q: 'bran', l: [{ id: 'p-other', name: 'Bran', sub: 'acct-other' }, { id: 'p1', name: 'Bran', sub: 'acct-find' }] };
  r.frame();
  assert.equal(follow.followed.at(-1), 'acct-find', 'the row with their socket');
  hub.hubFound = null;
  click();
  assert.equal(follow.followed.at(-1), 'acct-find', 'found once, known after');
  assert.equal(hub.asks.length, 1, 'never searched again');
  // a yes the hub already gave (another tag's search of the name) is taken at once
  const r2 = rig({ follow: fakeFollow({ room: [peer('p9', 0, -20, { name: 'Tess' })] }), links: new Map([['world', { peers: new Map(), hubOnline: new Map(), hubFound: { q: 'tess', l: [{ id: 'p9', sub: 'acct-tess' }] }, askFind: () => assert.fail('no ask needed') }]]) });
  r2.frame(); r2.layer.onPick('p9');
  assert.deepEqual(r2.follow.followed, ['acct-tess']);
  // a follow that did not take hands the panel nothing; a page with no origin of its own nothing either
  const r3 = rig({ follow: fakeFollow({ room: [peer('p1', 0, -20, { sub: 'acct-nope' })], refuse: 'acct-nope' }) });
  r3.frame(); r3.layer.onPick('p1');
  assert.deepEqual(r3.posted, []);
  const r4 = rig({ follow: fakeFollow({ room: [peer('p1', 0, -20, { sub: 'acct-room' })] }), origin: 'null' });
  r4.frame(); r4.layer.onPick('p1');
  assert.deepEqual([r4.follow.followed, r4.posted], [['acct-room'], []], 'followed, and no card asked of a page with no origin');
});

test('STAFF-VIEW1 no account, no follow - never by name: no door knows them, no name to search, the hub\'s no (one that came after the ask), or no answer in STAFF_FIND_WAIT_MS (an ask refused too) - each said, nobody followed, nothing posted (mutants: the name followed, a stale no taken)', () => {
  const lonely = () => peer('p1', 0, -20, { name: 'Bran' });
  let r = rig({ follow: fakeFollow({ room: [lonely()] }) });
  r.frame(); r.layer.onPick('p1');
  assert.deepEqual([r.follow.followed, r.posted, r.said.length], [[], [], 1], 'no link at all');
  assert.match(r.said[0], /no account found for Bran - not followed/);
  // a nameless player: no search can go
  r = rig({ follow: fakeFollow({ room: [peer('p1', 0, -20, { name: '' })] }), links: new Map([['world', { peers: new Map(), hubOnline: new Map(), askFind: () => assert.fail('no name, no search') }]]) });
  r.frame(); r.layer.onPick('p1');
  assert.deepEqual([r.follow.followed, r.said], [[], ['Staff view: no account found for that player - not followed.']]);
  // a no from before the ask is no answer; the one after it is
  const stale = { q: 'bran', l: [] };
  const hub = { peers: new Map(), hubOnline: new Map(), hubFound: stale, askFind: () => true };
  r = rig({ follow: fakeFollow({ room: [lonely()] }), links: new Map([['world', hub]]) });
  r.frame(); r.layer.onPick('p1'); r.frame();
  assert.deepEqual([r.follow.followed, r.said], [[], []], 'waiting: the no it holds is older than the ask');
  hub.hubFound = { q: 'bran', l: [{ id: 'p-other', name: 'Bran', sub: 'acct-other' }] };
  r.frame();
  assert.deepEqual([r.follow.followed, r.posted, r.said.length], [[], [], 1], 'the hub\'s no: another Bran is not them');
  // no answer at all - the box's ask refused (its own clock, a relay with no search) is waited on the same
  hub.hubFound = null; hub.askFind = () => false;
  r = rig({ follow: fakeFollow({ room: [lonely()] }), links: new Map([['world', hub]]) });
  r.frame(); r.layer.onPick('p1');
  r.tick(STAFF_FIND_WAIT_MS - 1); r.frame();
  assert.equal(r.said.length, 0);
  r.tick(1); r.frame();
  assert.deepEqual([r.follow.followed, r.said.length], [[], 1], 'the wait out: said');
});

// ── SHIFT+M ────────────────────────────────────────────────────────────────────────────────────────

test('STAFF-VIEW1 Shift+M is staff only: a trusted Shift+M with no other modifier is the Overworld\'s (up or down) and asks the flags, its held repeat nothing; a player\'s, an untrusted one, another chord, and indoors with the view down are the automap\'s (mutants: a player\'s taken, an untrusted one taken, indoors taken, the repeat toggling)', () => {
  const press = (more = {}) => ({ code: 'KeyM', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false, isTrusted: true, repeat: false, ...more });
  const player = rig({ glyphs: [] });
  assert.equal(player.host.key(press()), false);
  const panelless = rig({ follow: fakeFollow({ panel: false }) });
  assert.equal(panelless.host.key(press()), false);
  assert.deepEqual([player.toggled, panelless.toggled], [[], []]);
  const r = rig({ glyphs: ['mod'] });
  assert.equal(r.host.key(press()), true);
  assert.deepEqual([r.toggled.length, r.follow.asks], [1, 1], 'up, and the flags asked');
  assert.equal(r.host.key(press({ repeat: true })), true, 'a repeat is still its own');
  assert.equal(r.toggled.length, 1, 'and toggles nothing');
  for (const e of [press({ isTrusted: false }), press({ ctrlKey: true }), press({ altKey: true }), press({ metaKey: true }), press({ shiftKey: false }), press({ code: 'KeyN' }), null]) assert.equal(r.host.key(e), false, JSON.stringify(e));
  r.follow.modeNow = 'interior';
  assert.equal(r.host.key(press()), false, 'indoors: the automap');
  r.state.up = true;
  assert.equal(r.host.key(press()), true, 'the view up: down again');
  assert.equal(r.toggled.length, 2);
});

// ── THE OVERWORLD ──────────────────────────────────────────────────────────────────────────────────

test('STAFF-OW-TAGS marks() and the Overworld: a player\'s list back untouched; staff\'s player marks leave the canvas for the staff tags - every player whatever the Travellers switch says, the true name (a Stranger\'s too, \'concealed\') and the flag, the ones the travel view cut too, a crowd one box of rows, each a follow (mutants: a player\'s marks touched, the marks left on the canvas, a cut player tagged twice, the Stranger\'s mask unsaid, no Overworld tags)', () => {
  const list = [
    { key: 'place:7', label: 'Daggerfall', kind: 'place', at: [0, 0, 0] },
    { key: 'peer:p1', label: 'Stranger', kind: 'stranger', at: [0, 2, -40] },
    { key: 'trav:t1', label: 'Tess', kind: 'traveller', at: [-400, 2, -900], edge: true },
  ];
  const player = rig({ glyphs: [], follow: fakeFollow({ room: [peer('p1', 0, -40, { name: 'Bran' })] }) });
  assert.equal(player.host.marks(list), list, 'the same list');
  assert.equal(player.host.mark('peer:p1'), false);
  const follow = fakeFollow({
    room: [peer('p1', 0, -40, { name: 'Bran', sub: 'acct-bran' }), peer('p2', 300, -40, { name: 'Ghost', cv: 1 }), peer('p3', 1, -40, { name: 'Ash', sub: 'acct-ash' })],
    tags: validTags({ dist: 100, list: [{ sub: 'acct-bran', level: 'high', why: '4 reports' }, { sub: 'acct-tess', watch: true }] }),
  });
  const r = rig({ glyphs: ['dev'], follow, up: true, book: [{ id: 't1', name: 'Tess', sub: 'acct-tess' }], foes: [{ puppet: 'p1', ai: { feet: [0, 0, -41] } }] });
  const out = r.host.marks([...list, { key: 'peer:p2', label: 'Ghost', at: [300, 2, -40] }]);
  assert.deepEqual(out, [list[0]], 'the canvas keeps the places; the players are the tags\'');
  r.frame();
  const { groups, n } = r.layer.last();
  assert.equal(n, 0);
  const byName = Object.fromEntries(r.layer.members().map((m) => [m.name, m]));
  assert.deepEqual(Object.keys(byName).sort(), ['Ash', 'Bran', 'Ghost', 'Tess'], 'every player once, the cut one too');
  assert.equal(byName.Bran.line, '4 reports · 1 monster · concealed', 'the Stranger\'s true name and mask');
  assert.equal(byName.Bran.level, 'high');
  assert.equal(byName.Tess.line, 'WATCH');
  assert.equal(byName.Ghost.line, 'concealed');
  const crowd = groups.find((g) => g.members.length > 1);
  assert.deepEqual(crowd.members.map((m) => m.name).sort(), ['Ash', 'Bran'], 'two players this near: one box');
  assert.match(crowd.key, /^crowd:/);
  r.layer.onPick('t1');
  assert.deepEqual(follow.followed, ['acct-tess'], 'a far traveller by their mark\'s account');
  assert.equal(r.host.mark('place:7'), false, 'a place is the view\'s');
  assert.equal(r.host.mark('crowd:trav:t1'), false);
});

// ── THE LAYER ──────────────────────────────────────────────────────────────────────────────────────

test('STAFF-VIEW1 the layer: one button a player under a root that takes no pointer, its words written when they change; a still frame writes nothing; a crowd\'s box lists its members, each row a pick; under a window hidden, kept (mutants: every word written every frame)', () => {
  const doc = fakeDocument();
  const follow = fakeFollow({ room: [peer('p1', 0, -30, { name: 'Bran', sub: 'acct-bran' }), peer('p2', 10, -30, { name: 'Ash' })], tags: validTags({ dist: 100, list: [{ sub: 'acct-bran', level: 'high', why: '4 reports' }] }) });
  const r = rig({ follow, doc, glyphs: ['mod'] });
  r.frame();
  const root = doc.body.children[0];
  assert.equal(root.attrs['data-staff-tags'], '');
  assert.match(root.style.cssText, /pointer-events:none;z-index:12/);
  const tags = tagsIn(doc);
  assert.equal(tags.length, 2);
  const bran = tags.find((n) => n.attrs['data-staff-tag'] === 'p1');
  assert.equal(bran.tagName, 'BUTTON');
  assert.match(bran.style.cssText, /pointer-events:auto/);
  assert.deepEqual(bran.children.map((c) => c.textContent), ['Bran', '4 reports']);
  doc.zero();
  r.frame();
  assert.deepEqual([doc.writes, doc.structure, doc.built], [0, 0, 0], 'a still frame writes nothing');
  follow.roomPeers[0].shown = { ...follow.roomPeers[0].shown, x: 1 };
  r.frame();
  assert.equal(doc.built, 0, 'moved, never rebuilt');
  assert.ok(doc.writes > 0 && doc.writes <= 2, `the transform alone (${doc.writes})`);
  const press = bran.fire('click');
  assert.equal(press.stopped, true, 'the world under it hears nothing of it');
  assert.deepEqual(follow.followed, ['acct-bran']);
  // a crowd
  follow.roomPeers.push(peer('p3', 10.1, -30, { name: 'Cole', sub: 'acct-cole' }));
  r.frame();
  const box = tagsIn(doc).find((n) => n.attrs['data-staff-tag'] === 'crowd:p2');
  assert.equal(box.children[0].textContent, '2 players here');
  const rows = box.children[1].children;
  assert.deepEqual(rows.map((b) => b.children[0].textContent), ['Ash', 'Cole']);
  rows[1].fire('click');
  assert.equal(follow.followed.at(-1), 'acct-cole');
  doc.zero(); r.frame();
  assert.deepEqual([doc.writes, doc.built], [0, 0], 'a still crowd writes nothing');
  r.frame(true);
  assert.equal(root.style.display, 'none', 'under a window: hidden');
  doc.zero(); r.frame();
  assert.deepEqual([root.style.display, doc.built], ['', 0], 'back, the same elements');
});

test('STAFF-VIEW1 the layer\'s lines: one canvas, drawn only when a line moved; +N said once', () => {
  const doc = fakeDocument();
  const tags = createStaffTags({ doc, onPick: () => {} });
  tags.strokes([], 100, 100);
  assert.equal(all(doc.body).some((n) => n.tagName === 'CANVAS'), false, 'no line, no canvas');
  tags.strokes([[1, 2, 3, 4], [5, 6, 7, 8]], 100, 100);
  const cv = all(doc.body).find((n) => n.tagName === 'CANVAS');
  assert.equal(cv.ops.filter((o) => o[0] === 'lineTo').length, 2);
  assert.equal(cv.ops.filter((o) => o[0] === 'arc').length, 2, 'a dot at each monster');
  const n = cv.ops.length;
  tags.strokes([[1, 2, 3, 4], [5, 6, 7, 8]], 100, 100);
  assert.equal(cv.ops.length, n, 'unmoved: not drawn again');
  tags.strokes([], 100, 100);
  assert.equal(cv.ops.at(-1)[0], 'clearRect', 'gone: cleared');
  tags.render([], 3);
  const more = all(doc.body).find((x) => /more players/.test(x.textContent));
  assert.equal(more.textContent, '+3 more players in range');
  doc.zero(); tags.render([], 3);
  assert.equal(doc.writes, 0);
});

// ── THE FIVE SEAMS ─────────────────────────────────────────────────────────────────────────────────

test('STAFF-VIEW1 host: the five seams - made after the follow with its getters, the names pass\'s frame, the travel view\'s marks and mark click, and Shift+M past the key ladder\'s latch (KEY-BOOT) and before its actions', () => {
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  const made = w.search(/const staffView = createStaffViewHost\(\{\n\s*follow: staffFollow, glyphs: staffGlyphs, links: \(\) => chatLinks, book: travellerBook, foes: exteriorFoes,\n\s*overworld: travelViewKey, up: \(\) => !!travelView\?\.active, canvas, say: townTalk\.say,\n\s*acts: \(p, onFollow\) => chatSafety\.playerActions\(p, onFollow\),[^\n]*\n\s*politicAt: \(x, y\) => maps\.getPoliticIndex\(x, y\),[^\n]*\n\s*\}\);/);
  assert.ok(made > w.indexOf('const staffFollow = staffFollowOnPage('), 'made, after the follow it reads');
  assert.match(w, /const namesOff = covered \|\| !!travelView\?\.active;\n\s*staffView\.frame\(proj, view, eye, covered\);/, 'the names pass, every mode');
  assert.match(w, /marks: \(\) => staffView\.marks\(travelViewMarks\(\)\),/);
  assert.match(w, /onMark: \(key, e\) => staffView\.mark\(key\) \|\| onTravelViewMark\(key, e\),/);
  assert.match(w, /if \(!_worldKeysLive\) return;[^\n]*\n\s*if \(\(!e\.repeat && !gamePaused\(\) && egClient\?\.key\(e\)\) \|\| \(!gamePaused\(\) && staffView\.key\(e\)\)\) \{ e\.preventDefault\(\); return; \}/, 'Shift+M, past the latch');
  assert.doesNotMatch(readFileSync(new URL('../../src/systems/inputActions.js', import.meta.url), 'utf8'), /StaffView|ShiftLeft\+KeyM/, 'no InputManager action and no default chord: a player\'s Shift is no modifier');
});

test('STAFF-TAG-MENU a tag\'s click opens the player\'s menu - the chat line menu\'s staff acts by socket and account - at the tag; its Follow is the view\'s own (the follow, then the panel\'s card); with no acts the click follows at once (mutants: the menu skipped, the view\'s follow not handed)', () => {
  const asked = [];
  const acts = (p, onFollow) => { asked.push(p); return [{ label: 'Follow', run: () => onFollow(p.sub) }, { label: 'Mute…', menu: [] }]; };
  const follow = fakeFollow({ room: [peer('p1', 0, -30, { name: 'Bran', sub: 'acct-bran' })] });
  const r = rig({ follow, acts });
  r.frame();
  r.layer.onPick('p1');
  assert.deepEqual(asked, [{ id: 'p1', sub: 'acct-bran', name: 'Bran' }]);
  assert.equal(r.layer.menus.length, 1);
  assert.equal(r.layer.menus[0].title, 'Bran');
  assert.deepEqual(follow.followed, [], 'a click alone follows nobody');
  r.layer.menus[0].rows[0].run();
  assert.deepEqual(follow.followed, ['acct-bran']);
  assert.deepEqual(r.posted.at(-1), [{ dfoStaff: 'act', act: 'follow', sub: 'acct-bran', name: 'Bran' }, ORIGIN], 'and the panel\'s card');
  const plain = rig({ follow: fakeFollow({ room: [peer('p1', 0, -30, { name: 'Bran', sub: 'acct-bran' })] }) });
  plain.frame();
  plain.layer.onPick('p1');
  assert.deepEqual(plain.follow.followed, ['acct-bran'], 'no acts: the follow at once');
});

test('STAFF-TAG-MENU the layer\'s menu: at the press, a head and a button a row, a row\'s own menu opened in place, a choice runs and shuts it, Close shuts it, a second replaces the first; its presses never reach the world', () => {
  const doc = fakeDocument();
  const picked = [];
  const tags = createStaffTags({ doc, onPick: (id) => picked.push(id) });
  tags.render([{ key: 'p1', x: 100, y: 100, members: [{ id: 'p1', name: 'Bran', line: '', level: '' }] }], 0);
  const tag = tagsIn(doc)[0];
  for (const f of tag.on.click) f({ clientX: 120, clientY: 90, stopPropagation() {}, preventDefault() {} });
  assert.deepEqual(picked, ['p1']);
  const ran = [];
  tags.menu('Bran', [{ label: 'Follow', run: () => ran.push('follow') }, { label: 'Mute…', menu: [{ label: '30 min', run: () => ran.push('mute30') }] }]);
  const menus = () => all(doc.body).filter((x) => x.attrs['data-staff-menu'] != null && !x.removed && x.parent);
  assert.equal(menus().length, 1);
  const m = menus()[0];
  assert.match(m.style.cssText, /translate\(120px, 90px\)/);
  assert.deepEqual(m.children.map((c) => c.textContent), ['Bran', 'Follow', 'Mute…', 'Close']);
  assert.equal(m.fire('mousedown').stopped, true, 'the world hears nothing');
  m.children[2].fire('click');
  assert.deepEqual(m.children.map((c) => c.textContent), ['Bran', '30 min', 'Close'], 'Mute opens its lengths in place');
  m.children[1].fire('click');
  assert.deepEqual(ran, ['mute30']);
  assert.equal(menus().length, 0, 'a choice shuts it');
  tags.menu('Bran', [{ label: 'Follow', run: () => ran.push('follow') }]);
  tags.menu('Ash', [{ label: 'Follow', run: () => ran.push('ash') }]);
  assert.equal(menus().length, 1, 'a second replaces the first');
  assert.equal(menus()[0].children[0].textContent, 'Ash');
  menus()[0].children.find((c) => c.attrs['data-staff-menu-close'] != null).fire('click');
  assert.equal(menus().length, 0, 'Close shuts it');
  tags.menu('X', []);
  assert.equal(menus().length, 0, 'no rows, no menu');
});

test('STAFF-FLATMAP Shift+N: staff only, a trusted press with Shift alone, anywhere; opens the flat map on the map\'s link at the region stood in and closes it again; a player\'s press is the game\'s (mutants: the flat map for a player)', () => {
  const picks = [];
  const map = { pick: (r) => picks.push(r), answer: () => null };
  const press = (o = {}) => ({ code: 'KeyN', shiftKey: true, ctrlKey: false, altKey: false, metaKey: false, isTrusted: true, repeat: false, ...o });
  const follow = Object.assign(fakeFollow(), { map, pixel: () => ({ x: 5, y: 5 }), mode: () => 'interior' });
  const politicAt = () => 128 + 7;
  const r = rig({ follow, politicAt, doc: fakeDocument() });
  r.frame();
  assert.equal(r.host.key(press({ isTrusted: false })), false);
  assert.equal(r.host.key(press({ ctrlKey: true })), false);
  assert.equal(r.host.key(press()), true, 'indoors too');
  assert.deepEqual(picks, [7]);
  r.frame();
  assert.equal(r.host.key(press({ repeat: true })), true, 'its held repeat nothing');
  assert.deepEqual(picks, [7]);
  assert.equal(r.host.key(press()), true);
  assert.deepEqual(picks, [7, null], 'closed: the link let go');
  const player = rig({ glyphs: [], follow, politicAt });
  assert.equal(player.host.key(press()), false, 'a player\'s Shift+N is the game\'s');
  const noMap = rig({ follow: fakeFollow(), politicAt });
  assert.equal(noMap.host.key(press()), false, 'no map link: nothing');
});

test('FOLLOW-GROUND-HINT (mob: "following from ground does not work", "panel open said locked never moved"): a pick of a player drawn on my own ground hands the follow my room, its layer and their socket; a traveller\'s mark, or a pick while a follow is locked, hands none (mutants: the hint dropped, a hint while locked)', () => {
  const follow = fakeFollow({ room: [peer('p-1', 0, 0, { sub: 'acct-room' })] });
  follow.roomKey = 'cell:100,100';
  const r = rig({ follow, book: [{ id: 'p-9', sub: 'acct-book', name: 'Far' }] });
  r.frame(); r.layer.onPick('p-1');
  assert.deepEqual(follow.hints.at(-1), { room: 'cell:100,100', id: 'p-1', ly: 2 }, 'my own ground: my room');
  r.layer.onPick('p-9');
  assert.equal(follow.hints.at(-1), null, 'a traveller\'s mark: the hub says where');
  follow.isLocked = true; follow.eyePeers = [peer('p-1', 0, 0, { sub: 'acct-room' })];
  r.layer.onPick('p-1');
  assert.equal(follow.hints.at(-1), null, 'locked: the followed room is not mine');
});

test('STAFF-FLAG-LINES (mob: "need to port over my watch lines and review lines for flags in staff esp", "helps flag bad players"): from the screen\'s middle a line to each flagged player in front of the eye - a report\'s red (review), a watch\'s gold - past the nameplate distance too; none to a player with no flag or behind the eye; on the Overworld to its tags; for a Moderator as for an Admin (mutants: a watch drawn as review, the distance cut on the lines, no lines on the Overworld)', () => {
  const tags = validTags({ dist: 50, list: [{ sub: 'acct-w', watch: true }, { sub: 'acct-r', level: 'low', why: '1 report' }, { sub: 'acct-far', level: 'high', why: '3 reports' }, { sub: 'acct-back', level: 'high', why: '3 reports' }] });
  const follow = fakeFollow({ room: [peer('p1', 0, -20, { sub: 'acct-w' }), peer('p2', 10, -20, { sub: 'acct-r' }), peer('p3', 0, -400, { sub: 'acct-far' }), peer('p4', 0, -25, { sub: 'acct-none' }), peer('p5', 0, 40, { sub: 'acct-back' })], tags });
  const r = rig({ glyphs: ['mod'], follow });
  r.frame();
  const kinds = () => r.layer.lineSets.at(-1).map((s) => s[4]).sort();
  assert.deepEqual(kinds(), [STAFF_LINE.watch, STAFF_LINE.review, STAFF_LINE.review].sort(), 'the watch, the report, and the far report; nobody unflagged or behind');
  for (const s of r.layer.lineSets.at(-1)) assert.deepEqual([s[0], s[1]], [CANVAS.clientWidth / 2, CANVAS.clientHeight / 2], 'from the middle');
  assert.ok(!r.layer.members().some((m) => m.id === 'p3'), 'the far one is past the nameplate distance - lined, not tagged');
  r.state.up = true;
  r.host.marks([]);
  r.frame();
  assert.equal(kinds().length, 3, 'the Overworld: the same three');
});

test('CROWD-CHIPS (mob: "to many ocerlapping how would we clean thaT UP"; the card\'s pick "Merge close boxes, count only"): boxes that would touch merge into the one that leads until none does; ones clear of each other stay apart (mutants: no merge; a crowd that opens its names unasked)', () => {
  const tag = (id, x, y, name = 'Bran', line = '') => ({ p: { x, y }, m: { id, name, line } });
  // two lone names side by side, overlapping on the screen but past the old 28 px: one chip
  assert.deepEqual(crowded([tag('a', 100, 100), tag('b', 130, 105)]).map((g) => [g.key, g.members.map((m) => m.id)]), [['crowd:a', ['a', 'b']]]);
  // a chain: the chip that grew from a+b now reaches c, which a alone did not - merged on the next pass
  const chain = crowded([tag('a', 100, 100), tag('b', 130, 100), tag('c', 170, 100, 'Cole')]);
  assert.deepEqual(chain.map((g) => g.members.map((m) => m.id)), [['a', 'b', 'c']]);
  // clear of each other - far apart across, or a row apart down - each its own
  assert.deepEqual(crowded([tag('a', 100, 100), tag('b', 400, 100), tag('c', 100, 200)]).map((g) => g.key), ['a', 'b', 'c']);
  // no two boxes left touching, however many come
  const many = crowded(Array.from({ length: 120 }, (_, k) => tag(`p${k}`, (k * 37) % 900, (k * 53) % 500, `Player${k}`)));
  assert.equal(many.reduce((n, g) => n + g.members.length, 0), 120, 'every player kept');
  assert.ok(many.length < 120);
});

test('CROWD-CHIPS the chip: a crowd shows its count alone; its names open while the pointer is over it and stay open once its count is clicked, and a second click shuts them; each row still a pick', () => {
  const doc = fakeDocument();
  const picked = [];
  const tags = createStaffTags({ doc, onPick: (id) => picked.push(id) });
  tags.render([{ key: 'crowd:a', x: 10, y: 10, members: [{ id: 'a', name: 'Ash', line: '', level: null }, { id: 'b', name: 'Bran', line: '', level: null }] }], 0);
  const box = tagsIn(doc)[0];
  const [head, list] = box.children;
  assert.equal(head.textContent, '2 players here');
  assert.equal(list.style.display, 'none', 'the count alone');
  box.fire('mouseenter');
  assert.equal(list.style.display, 'block', 'hovered: the names');
  box.fire('mouseleave');
  assert.equal(list.style.display, 'none');
  const press = head.fire('click');
  assert.equal(press.stopped, true, 'the world under it hears nothing of it');
  box.fire('mouseleave');
  assert.equal(list.style.display, 'block', 'clicked: open past the pointer');
  list.children[1].fire('click');
  assert.deepEqual(picked, ['b']);
  head.fire('click');
  assert.equal(list.style.display, 'none', 'a second click shuts it');
});

test('FLAG-DISMISS (mob, 2026-10-24: "need a dismiss button on players name plates for flags"; the card\'s pick "Hide it for me only"): a flagged player\'s tag menu has Dismiss flag; it leaves that flag off my tag and lines, kept in this browser across a reload, and a new flag on them shows again; an unflagged player\'s menu has none (mutants: no row, the dismissal not kept, any flag hidden once dismissed)', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  const tagsOf = (why) => validTags({ list: [{ sub: 'acct-bran', level: 'high', why }] });
  const follow = fakeFollow({ room: [peer('p1', 0, -30, { name: 'Bran', sub: 'acct-bran' }), peer('p2', 5, -30, { name: 'Ana', sub: 'acct-ana' })], tags: tagsOf('Report: spam') });
  const acts = (p, onFollow) => [{ label: 'Follow', run: () => onFollow(p.sub) }];
  const r = rig({ follow, acts, storage });
  const lineOf = (rr, id) => rr.layer.members().find((m) => m.id === id)?.line ?? '';
  r.frame();
  assert.match(lineOf(r, 'p1'), /Report: spam/);
  r.layer.onPick('p2');
  assert.deepEqual(r.layer.menus.at(-1).rows.map((x) => x.label), ['Follow'], 'no flag: no Dismiss');
  r.layer.onPick('p1');
  const row = r.layer.menus.at(-1).rows.find((x) => x.label === 'Dismiss flag');
  assert.ok(row, 'a flagged player: Dismiss flag');
  row.run();
  r.tick(10); r.frame();
  assert.doesNotMatch(lineOf(r, 'p1'), /Report: spam/, 'dismissed: off my tag');
  r.layer.onPick('p1');
  assert.ok(!r.layer.menus.at(-1).rows.some((x) => x.label === 'Dismiss flag'), 'nothing left to dismiss');
  const again = rig({ follow, acts, storage });
  again.frame();
  assert.doesNotMatch(lineOf(again, 'p1'), /Report: spam/, 'kept across a reload');
  follow.answer = tagsOf('Report: cheating');
  again.tick(10); again.frame();
  assert.match(lineOf(again, 'p1'), /Report: cheating/, 'a new flag shows again');
});

test('FLAG-DISMISS the store: DISMISSED_FLAGS_MAX at most, the oldest let go; a value not ours or unreadable storage reads as none', () => {
  const store = new Map();
  const win = { localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) } };
  const m = new Map();
  for (let i = 0; i <= DISMISSED_FLAGS_MAX; i++) m.set(`acct-${i}`, 'x');
  saveDismissedFlags(win, m);
  assert.equal(JSON.parse([...store.values()][0]).length, DISMISSED_FLAGS_MAX, 'the browser keeps no more');
  const back = loadDismissedFlags(win);
  assert.equal(back.size, DISMISSED_FLAGS_MAX);
  assert.ok(!back.has('acct-0') && back.has(`acct-${DISMISSED_FLAGS_MAX}`), 'the oldest let go');
  store.set([...store.keys()][0], '{"no":1}');
  assert.equal(loadDismissedFlags(win).size, 0);
  assert.equal(loadDismissedFlags({ localStorage: { getItem: () => { throw new Error('blocked'); } } }).size, 0);
  assert.equal(loadDismissedFlags(null).size, 0);
});
