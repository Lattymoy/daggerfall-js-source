// SERVER-POST (2026-10-08, Mac: "Let's develop an ingame server mailbox that goes next to the hourglass in the pause
// menu. It should show notifications whenever players have a message. First use is to utilize it for players being
// granted items."): THE CLIENT'S SIDE - net/serverPost.js PostBox over the real service (a look, a notice, a piece
// opened, an item claimed into the pack through the realm's act), ui/enhancedPost.js (the envelope and its count, the
// window), and the pause face's and the hosts' wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { PostBox, postNoticeText } from '../src/net/serverPost.js';
import { partAnswer } from '../src/net/heartbeat.js';
import { POST_SENDER, POST_POLL_MS } from '../src/net/postLaw.js';
import { MAIL_POLL_MS } from '../src/net/mail.js';
import { postMark, setPostCount, watchPostMark, postWindow, postRefusalText, rarityClass, anchorPost } from '../src/ui/enhancedPost.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { REFUSALS } from '../src/net/accountClient.js';
import { mintHourlock } from '../src/systems/gilded.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const send = (env, who, { batch, subject = 'A gift', body = 'For you.', item = null, at = T0 } = {}) => {
  const id = `p${batch.replace(/[^a-z0-9]/g, '')}`.padEnd(24, '0').slice(0, 24);
  env.DB._raw.prepare('INSERT OR IGNORE INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, who.id, batch, POST_SENDER, subject, body, item ? JSON.stringify(item) : null, at);
  return id;
};
const ioFor = (svc, who) => () => (who ? { fetch: (u, i) => svc.fetch(u, i), base: 'https://accounts.invalid', secret: who.secret, storage: null } : null);
/** The realm's act as the host's realmGoldAct hands it: the call asked where the record stands, the answer applied. */
const realmOf = (R, log = []) => ({
  act: async ({ call, apply }) => { const r = await call(R.at()); if (r?.ok) apply?.(r); return r; },
  abandon: (why) => { log.push(why); },
});

test('SERVER-POST the box: a sitting\'s first look says what waits, a later one each new piece by name and gift; heads read through the law; the envelope\'s count is a piece unread or a gift unclaimed, each once; the letterbox\'s clock; a guest is a guest, no session is signed out (mutants: the first look announced as new; a claimed gift still counted; the poll\'s clock)', async () => {
  assert.equal(POST_POLL_MS, MAIL_POLL_MS, 'the letterbox\'s own clock');
  const svc = await standService();
  const ann = await svc.registered('Ann');
  const said = [];
  const box = new PostBox({ ioOf: ioFor(svc, ann), onPost: (e) => said.push(e) });
  assert.equal(box.state, 'unknown');
  send(svc.env, ann, { batch: 'welcome', subject: 'Welcome', at: T0 });
  send(svc.env, ann, { batch: 'gift', subject: 'The Hourlock', item: mintHourlock(), at: T0 + 5 });
  assert.equal((await box.refresh()).ok, true);
  assert.deepEqual([box.state, box.post.length, box.unread, box.unclaimed, box.waiting], ['ready', 2, 2, 1, 2]);
  assert.deepEqual(said, [{ kind: 'waiting', count: 2 }], 'the first look of a sitting: what waits, never "new"');
  assert.equal(postNoticeText(said[0]), 'You have 2 messages waiting in your mailbox. Open the mailbox beside the hourglass in the pause menu.');
  send(svc.env, ann, { batch: 'later', subject: 'Another', at: T0 + 9 });
  await box.refresh();
  assert.equal(said.length, 2);
  assert.equal(said[1].kind, 'new');
  assert.deepEqual(said[1].post.map((p) => p.subject), ['Another']);
  assert.equal(postNoticeText(said[1]), `Post from ${POST_SENDER}: "Another". Open the mailbox beside the hourglass in the pause menu.`);
  assert.equal(postNoticeText({ kind: 'new', post: [{ from: POST_SENDER, subject: 'The Hourlock', item: { name: 'The Hourlock' } }] }),
    `Post from ${POST_SENDER}: "The Hourlock" - The Hourlock is waiting for you. Open the mailbox beside the hourglass in the pause menu.`, 'a gift said by name');
  // read, it no longer counts; a gift counts until it is claimed
  const gift = box.post.find((p) => p.item);
  assert.equal((await box.open(gift.id)).ok, true);
  assert.deepEqual([box.unread, box.waiting], [2, 3], 'read, the gift still waits - beside the two unread');
  await box.open(box.post.find((p) => p.subject === 'Welcome').id);
  assert.equal(box.waiting, 2, 'one unread, one gift');

  // THE HEARTBEAT'S PART: the box's look, riding it
  const part = box.heartbeatPart();
  assert.equal(part.every, POST_POLL_MS);
  assert.equal(part.due(box.at + POST_POLL_MS - 1), false);
  assert.equal(part.due(box.at + POST_POLL_MS), true);
  assert.equal(part.body(), true);
  const hb = await svc.call('/v1/heartbeat', { post: true }, ann.secret);
  part.take(partAnswer(hb.body.post));
  assert.equal(box.state, 'ready');

  // A GUEST, and no session
  const g = await svc.guest();
  const guestBox = new PostBox({ ioOf: ioFor(svc, { secret: g.secret }) });
  await guestBox.refresh();
  assert.deepEqual([guestBox.state, guestBox.post.length], ['guest', 0]);
  const none = new PostBox({ ioOf: () => null });
  assert.deepEqual(await none.refresh(), { ok: false, error: 'signed-out' });
  assert.equal(none.state, 'signed-out');
});

test('SERVER-POST THE CLAIM, from the client: the realm\'s act asks the service where the record stands, the item lands in the pack as the wire\'s clamp passes it, the piece reads claimed and stops counting; a second claim is refused here; no realm character, no claim; a gift is never thrown away unclaimed, and once claimed it may go (mutants: the pack fed the wire\'s record unchecked; claimed before the answer; a waiting gift thrown away)', async () => {
  const svc = await standService();
  const ann = await svc.registered('Ann');
  const R = await seatRealm(svc.env, ann.secret, 'Ann', { name: 'Ann', level: 20, goldPieces: 10, items: [] });
  const gun = mintHourlock();
  const id = send(svc.env, ann, { batch: 'hours-first-hourlock', subject: 'The Hourlock', item: gun });
  const pack = [];
  let changed = 0;
  const abandoned = [];
  const box = new PostBox({
    ioOf: ioFor(svc, ann), character: () => R.id, realm: realmOf(R, abandoned),
    pack: { add: (rec) => pack.push(rec), changed: () => { changed++; } },
  });
  await box.refresh();
  assert.deepEqual(await box.remove(id), { ok: false, error: 'post-unclaimed' }, 'never a gift still waiting');
  const r = await box.claim(id);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(pack.length, 1);
  assert.equal(pack[0].name, 'The Hourlock');
  assert.equal(pack[0].rarity, 'gilded');
  assert.equal(pack[0].gilded, 'the-hourlock', 'the record as minted, through the wire\'s clamp');
  assert.equal(changed, 1, 'the save told');
  assert.deepEqual(abandoned, [], 'the answer held the item - the session stands');
  assert.deepEqual([box.post[0].claimed, box.unclaimed, box.waiting], [true, 0, 0]);
  assert.deepEqual(await box.claim(id), { ok: false, error: 'post-claimed' }, 'once');
  assert.equal(pack.length, 1);
  assert.deepEqual(await box.remove(id), { ok: true }, 'claimed, it may go');
  assert.equal(box.post.length, 0);

  // AN ANSWER WITH NO ITEM THE PACK CAN TAKE ends the session: the record holds it, a join reads it
  const id2 = send(svc.env, ann, { batch: 'second', item: gun });
  await box.refresh();
  const bad = new PostBox({
    ioOf: ioFor(svc, ann), character: () => R.id, realm: { act: async ({ call, apply }) => { const res = await call(R.at()); if (res.ok) apply({ ...res, data: { ...res.data, item: { templateIndex: 'no' } } }); return res; }, abandon: (w) => abandoned.push(w) },
    pack: { add: (rec) => pack.push(rec), changed() {} },
  });
  await bad.refresh();
  assert.deepEqual(await bad.claim(id2), { ok: false, error: 'unknown' });
  assert.deepEqual(abandoned, ['unknown'], 'abandoned - never a pack short of what the record holds');
  assert.equal(pack.length, 1, 'nothing forged into the pack');

  // NO REALM CHARACTER, NO CLAIM
  const offline = new PostBox({ ioOf: ioFor(svc, ann), character: () => 'char-ann', realm: null, pack: { add() {}, changed() {} } });
  send(svc.env, ann, { batch: 'third', item: gun });
  await offline.refresh();
  assert.deepEqual(await offline.claim(offline.post.find((p) => p.item && !p.claimed).id), { ok: false, error: 'realm-only' });
});

// ── the envelope and the window ───────────────────────────────────────

function fakeDoc() {
  const node = (tag) => {
    const n = { tag, children: [], className: '', attrs: {}, style: {}, listeners: {}, title: '', type: '', disabled: false, isConnected: true,
      append(...cs) { for (const c of cs) n.children.push(c); }, setAttribute(k, v) { n.attrs[k] = v; },
      addEventListener(t, f) { (n.listeners[t] ??= []).push(f); },
      querySelector(sel) { let hit = null; walk(n, (c) => { if (!hit && c !== n && String(c.className).split(' ').includes(sel.slice(1))) hit = c; }); return hit; },
      classList: { toggle(c, on) { const cs = new Set(String(n.className).split(' ').filter(Boolean)); if (on) cs.add(c); else cs.delete(c); n.className = [...cs].join(' '); } } };
    Object.defineProperty(n, 'textContent', { get() { return n._t ?? ''; }, set(v) { n._t = v; if (v === '') n.children = []; } });
    return n;
  };
  return { createElement: node };
}
const walk = (n, f) => { f(n); for (const c of n.children ?? []) walk(c, f); };
const all = (root, cls) => { const out = []; walk(root, (n) => { if (String(n.className).split(' ').includes(cls)) out.push(n); }); return out; };
const text = (n) => { let t = n._t ?? ''; for (const c of n.children ?? []) t += text(c); return t; };

test('SERVER-POST the envelope: a button that opens, an envelope and a count - hidden at none, "99+" past it, said in its label; kept live off the box\'s version, stopping itself once out of the page; placed left of the hourglass, which is placed first (mutants: the count never written; the tick never stopping)', () => {
  let opened = 0;
  const b = postMark(fakeDoc(), { onOpen: () => { opened++; }, count: 3 });
  assert.equal(b.className, 'px-postmark waiting');
  assert.deepEqual(b.children.map((c) => c.className), ['px-envelope', 'px-postbadge']);
  assert.equal(all(b, 'px-postbadge')[0].textContent, '3');
  assert.equal(b.attrs['aria-label'], 'Mailbox: 3 waiting');
  assert.equal(b.title, 'Mailbox');
  b.listeners.click[0]();
  assert.equal(opened, 1);
  setPostCount(b, 0);
  assert.deepEqual([all(b, 'px-postbadge')[0].textContent, b.attrs['aria-label'], b.className], ['', 'Mailbox', 'px-postmark']);
  setPostCount(b, 140);
  assert.equal(all(b, 'px-postbadge')[0].textContent, '99+');
  assert.match(ENHANCED_CSS, /\n\.px-postbadge:empty \{ display: none; \}/, 'no count, no badge');
  // kept live
  const box = { version: 1, waiting: 2 };
  const stop = watchPostMark(b, () => box, 1e9);
  assert.equal(all(b, 'px-postbadge')[0].textContent, '2');
  stop();
  // placed: the hourglass off the profile first, the envelope off the hourglass
  const prof = { getBoundingClientRect: () => ({ left: 1096, top: 10, width: 172, height: 48 }) };
  const glass = { style: {}, offsetHeight: 44, getBoundingClientRect: () => ({ left: 1096 - 10 - 39, top: 12, width: 39, height: 44 }) };
  const env = { style: {}, offsetHeight: 44 };
  const host = { getBoundingClientRect: () => ({ right: 1280, top: 0 }) };
  let placed = null;
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (f) => { placed = f; };
  try { anchorPost(env, glass, prof, host)(); placed(); } finally { globalThis.requestAnimationFrame = raf; }
  assert.deepEqual(glass.style, { right: '194px', top: '12px' }, 'the hourglass where TIMERS1 stands it');
  assert.deepEqual(env.style, { right: `${1280 - (1096 - 10 - 39) + 10}px`, top: '12px' }, 'the envelope just left of it');
});

test('SERVER-POST the window: the box\'s pieces newest first, unread and waiting gifts marked, an item named in its rarity\'s colour; a piece opened shows its words and a Claim for a waiting gift, its state once claimed, Throw away only then; the states said - looking, signed out, a guest, empty, a failed look; refusals in the account\'s own words (mutants: a Claim on a claimed gift; Throw away on a waiting one)', async () => {
  const post = [
    { id: 'a'.repeat(24), from: POST_SENDER, subject: 'The Hourlock', sentAt: T0, read: false, item: { name: 'The Hourlock', rarity: 'gilded' }, claimed: false },
    { id: 'b'.repeat(24), from: POST_SENDER, subject: 'Welcome', sentAt: T0 - 100, read: true, item: null, claimed: false },
  ];
  const calls = [];
  const box = {
    state: 'ready', post, version: 1, busy: false, waiting: 1,
    refresh: async () => {},
    open: async (id) => { calls.push(['open', id]); return { ok: true, post: { ...post.find((p) => p.id === id), body: 'For the first clear.' } }; },
    claim: async (id) => { calls.push(['claim', id]); post[0].claimed = true; box.version++; return { ok: true, item: { name: 'The Hourlock' } }; },
    remove: async (id) => { calls.push(['remove', id]); return { ok: true }; },
  };
  let closed = 0;
  const view = postWindow(fakeDoc(), { box: () => box, onClose: () => { closed++; }, every: 1e9 });
  view.stop();
  const root = view.root;
  assert.ok(root.className.includes('px-win') && root.className.includes('px-postwin'), 'the pause window\'s frame');
  assert.deepEqual([root.attrs.role, root.attrs['aria-modal'], root.attrs['aria-labelledby']], ['dialog', 'true', 'pm-title']);
  const rows = all(root, 'pm-row');
  assert.equal(rows.length, 2);
  assert.ok(rows[0].className.includes('unread') && rows[0].className.includes('gift'));
  assert.ok(!rows[1].className.includes('unread'));
  const chip = all(rows[0], 'pm-chip')[0];
  assert.ok(chip.className.includes('rar-gilded'), 'in the Gilded rung\'s colour');
  assert.match(text(chip), /The Hourlock.*Waiting/);
  assert.equal(rarityClass('gilded'), 'rar-gilded');
  assert.equal(rarityClass('nonsense'), '');
  assert.match(ENHANCED_CSS, /\.px-postwin \.rar-gilded \{ color: #ffcf4d; \}/);

  // OPENED
  await view.openOne(post[0].id);
  assert.deepEqual(calls.at(-1), ['open', post[0].id]);
  assert.equal(all(root, 'pm-body')[0].textContent, 'For the first clear.');
  const claim = all(root, 'pm-claim')[0];
  assert.ok(claim, 'a Claim for a waiting gift');
  assert.equal(all(root, 'pm-throw').length, 0, 'and no Throw away while it waits');
  await claim.listeners.click[0]();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(calls.at(-1), ['claim', post[0].id]);
  assert.equal(all(root, 'pm-say')[0].textContent, 'The Hourlock is in your pack.');
  assert.equal(all(root, 'pm-claim').length, 0, 'claimed: no Claim');
  assert.match(text(all(root, 'pm-item')[0]), /Claimed - it is in your pack\./);
  assert.ok(all(root, 'pm-throw')[0], 'claimed, it may be thrown away');
  all(root, 'pm-back')[0].listeners.click[0]();
  assert.equal(all(root, 'pm-row').length, 2, 'back to the list');
  all(root, 'pm-close')[0].listeners.click[0]();
  assert.equal(closed, 1);

  // THE STATES
  const say = (state, extra = {}) => { const v = postWindow(fakeDoc(), { box: () => ({ state, post: [], version: 1, ...extra }), onClose() {}, every: 1e9 }); v.stop(); return all(v.root, 'pm-empty')[0]?.textContent; };
  assert.equal(say('unknown', { refresh: async () => {} }), 'Looking in your mailbox...');
  assert.equal(say('signed-out'), 'Sign in to an account to receive post.');
  assert.equal(say('guest'), REFUSALS['post-needs-account']);
  assert.equal(say('ready'), 'Your mailbox is empty.');
  assert.equal(say('error', { refresh: async () => {} }), 'The mailbox could not be read right now.');
  const nobox = postWindow(fakeDoc(), { box: () => null, onClose() {}, every: 1e9 });
  nobox.stop();
  assert.equal(all(nobox.root, 'pm-empty')[0].textContent, 'Looking in your mailbox...');
  assert.equal(postRefusalText('post-claimed'), REFUSALS['post-claimed']);
  assert.match(postRefusalText('a word nobody has'), /could not do that right now/);
});

test('SERVER-POST the wiring: the pause face stands the envelope beside the hourglass where the host hands a box, opens its window on the hourglass\'s stage with its own scrim, Escapes it before resuming, stops its ticks on every rebuild and unmount; every host hands the world\'s box, online only and never a throw before the boot declared it; the world host makes the box beside the letterbox, says its news on the world tab and rides the heartbeat (mutants: the envelope without a box; a host that forgets it)', () => {
  const menu = src('src/ui/enhancedMenu.js');
  assert.match(menu, /const envelope = postEnvelope\(home, mark\);/, 'beside the hourglass');
  assert.match(menu, /function postEnvelope\(home, glass\) \{\n  if \(!hooks\.post\?\.\(\)\) return null;/, 'online only - where the host hands a box');
  assert.match(menu, /postAnchor = anchorPost\(envelope, glass, home\.querySelector\?\.\('\.px-profile'\), home\);/);
  assert.match(menu, /else if \(postOpen && hooks\.post\?\.\(\)\) \{\n[^\n]*\n\s*const pstage = el\('div', 'px-stage px-timersstage px-poststage'\);/);
  assert.match(menu, /for \(const n of \[stage, home\.querySelector\?\.\('\.px-profile'\), mark, envelope\]\) n\?\.setAttribute\?\.\('inert', ''\);/);
  assert.match(menu, /: postOpen && postView \? \(\) => \{ postOpen = false; postFocusBack = true; render\(\); \}/, 'Escape closes it first');
  assert.match(menu, /stopTimers\(\);   \/\/ TIMERS1: a rebuild builds the window again, with its own tick\n  stopPost\(\);/);
  assert.match(menu, /stopTimers\(\);   \/\/ TIMERS1\n      stopPost\(\);   \/\/ SERVER-POST/, 'and on unmount');
  assert.match(menu, /postOpen = false;   \/\/ SERVER-POST: and the mailbox's/, 'a visit\'s window');
  const world = src('src/scenes/world.js');
  assert.match(world, /const postSource = \(\) => \{ try \{ return online && postBox \? postBox : null; \} catch \{ return null; \} \};/, 'online, and never a throw before the boot declared it');
  assert.equal((world.match(/post: postSource,/g) ?? []).length, 2, 'the street\'s pause bag and the modes host');
  assert.match(src('src/scenes/worldModes.js'), /post: host\.post,/, 'a building\'s pause');
  assert.match(src('src/scenes/worldModes.js'), /post: \(\) => host\.post\?\.\(\) \?\? null,/, 'the dungeon\'s opts');
  assert.match(src('src/scenes/dungeonContext.js'), /post: \(\) => opts\.post\?\.\(\) \?\? null,/, 'the dungeon\'s pause');
  assert.match(world, /onPost: \(event\) => \{ chatLog\.push\(tab\.id, \{ text: postNoticeText\(event\), system: true \}\); \},/, 'its news on the world tab, a line nobody spoke');
  assert.match(world, /heartbeat\.add\('post', whileLive\(postBox\.heartbeatPart\(\), \(\) => performance\.now\(\) - _mailFrameAt < FRAME_LIVE_MS\)\);/, 'on the letterbox\'s clock, while the lane runs');
  assert.match(world, /pack: \{ add: \(rec\) => \{ addItem\(\(playerEntity\.items \?\?= \[\]\), setItemFields\(rec\), 'back'\); \}, changed: \(\) => \{ saveSoon\.changed\(\); \} \},\n    \}\);\n    heartbeat\.add\('post'/, 'a claimed item made whole and put in the pack as the vault\'s');
  assert.match(ENHANCED_CSS, /\n\.px-postmark \{ position: absolute;/);
  assert.match(ENHANCED_CSS, /\n\.px-win\.px-postwin \{/);
});
