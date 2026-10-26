// CRAFT-WRITS (2026-10-22) - THE CLIENT'S HALF: the host's goods out of the pack inside the realm act (scenes/
// craftWritHost.js - the plain bottles before the Potent, a dish's own pieces, all back on a refusal), the book's
// delivery (net/profBook.js craftDeliver) and the Work tab's crafting-writ cards (ui/noticeWindow.js) - what each asks,
// pays and holds, Deliver waiting with its reason, a press said and the list read again - and the wiring.
// bible/06-Systems/Professions-Arc.md section 49.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from '../chargenDom.mjs';
import { createCraftWritHost } from '../../src/scenes/craftWritHost.js';
import { mountNoticeBoard } from '../../src/ui/noticeWindow.js';
import { writPotionKey, craftWritOf } from '../../src/net/craftWritLaw.js';
import { GUILD_FACTION_IDS } from '../../src/systems/guild/guildFactions.js';
import { GROUP_TEMPLATE_INDICES } from '../../src/systems/item/itemTemplatesData.js';
import { standService, T0, sessionStorageOf } from '../accountDb.mjs';
import { accountProf, SESSION_KEY } from '../../src/net/accountClient.js';
import { createProfBook } from '../../src/net/profBook.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { layRecord } from '../realmSeat.mjs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const tick = () => new Promise((r) => setImmediate(r));
const KEY = writPotionKey('potion:healing');
const bottle = (n, extra = {}) => ({ group: 'UselessItems1', templateIndex: GROUP_TEMPLATE_INDICES.UselessItems1[1], potionRecipeKey: KEY, stackCount: n, value: 50, ...extra });
const HEALING = { id: 'k:20383:r0123456789abcdef0123:0', product: 'potion:healing', kind: 'potion', tier: 1, faction: 33, qty: 4, pay: 42, xp: 84, renown: 63, track: 'provisioning', expiresAt: 20384 * 86400, state: 'open', brewed: 4 };
/** a realm session the realm act asks through (systems/realmSaves.js realmGoldAct's own shape) */
const session = () => ({ transact: async (fn) => fn({ id: 'r0123456789abcdef0123', lease: 'l'.repeat(32), seq: 3 }), abandon() {} });

test('CRAFT-WRITS client: the host holds a potion writ ready only when the pack\'s bottles and the brews both cover it; a press takes the plain bottles before the Potent out as the service is first asked, and puts every one back on a refusal (mutants: the pick\'s order; the put back; the brews read)', async () => {
  const player = { items: [bottle(3, { potent: 25 }), { name: 'Torch' }, bottle(2)] };
  const asked = [];
  let answer = { ok: false, error: 'craft-unbrewed' };
  const book = { craftDeliver: async (id, pieces, at) => { asked.push([id, pieces, at.seq, player.items.map((it) => it.stackCount ?? 1)]); return answer; } };
  let checkpoints = 0, saves = 0;
  const host = createCraftWritHost({ player: () => player, session: () => session(), checkpoint: () => { checkpoints++; }, saved: () => { saves++; }, book: () => book });
  assert.deepEqual(host.held(HEALING), { pack: 5, made: 4, loose: 0, ready: true });
  assert.deepEqual(host.held({ ...HEALING, brewed: 3 }), { pack: 5, made: 3, loose: 0, ready: false }, 'the brews short');
  assert.deepEqual(host.held({ ...HEALING, qty: 6, brewed: 9 }).ready, false, 'the pack short');
  const no = await host.deliver(HEALING);
  assert.deepEqual([no.ok, no.error], [false, 'craft-unbrewed']);
  assert.deepEqual(asked, [[HEALING.id, null, 3, [1, 1]]], 'asked with the plain two and two of the Potent three out');
  assert.deepEqual(player.items.map((it) => it.stackCount ?? 1), [3, 1, 2], 'every bottle back on the refusal');
  assert.equal(saves, 0);
  answer = { ok: true, data: { pay: 42, xp: 84, renown: { credited: 63 } } };
  const ok = await host.deliver(HEALING);
  assert.equal(ok.ok, true);
  assert.deepEqual(player.items.map((it) => [it.name ?? 'bottle', it.stackCount ?? 1, it.potent ?? 0]), [['bottle', 1, 25], ['Torch', 1, 0]], 'the plain two gone whole, the Potent stack two less');
  assert.deepEqual([saves, checkpoints >= 4], [1, true], 'checkpointed before and after each act');
  assert.deepEqual(await createCraftWritHost({ player: () => player, session: () => null, checkpoint() {}, saved() {}, book: () => book }).deliver(HEALING), { ok: false, error: 'realm-needed' }, 'offline: no realm act');
});

test('CRAFT-WRITS client: a dish writ\'s pieces are the service\'s own list in pack order - one short holds it back (craft-pieces) before anything is asked; filled, the pieces leave the pack (mutants: the service\'s list unread)', async () => {
  const P = ['0123456789abcdef', '1123456789abcdef', '2123456789abcdef', '3123456789abcdef'];
  const dish = (pv, recipe = 'stew:north') => ({ templateIndex: 685, provenance: pv, recipe, name: 'Hunter\'s Stew' });
  const player = { items: [dish(P[3]), dish(P[0]), dish(P[1], 'stew:south'), dish(P[2])] };
  const asked = [];
  const book = { craftDeliver: async (id, pieces) => { asked.push(pieces); return { ok: true, data: { pay: 20 } }; } };
  const host = createCraftWritHost({ player: () => player, session: () => session(), checkpoint() {}, saved() {}, book: () => book });
  const w = { id: 'k:1:r0123456789abcdef0123:1', product: 'dish:stew', kind: 'dish', qty: 3, pieces: [P[0], P[1], P[2]] };
  assert.deepEqual(host.held(w), { pack: 4, made: 3, loose: 0, ready: true }, 'P[3] is in the pack but not the service\'s - bought, or another\'s');
  assert.deepEqual(await host.deliver({ ...w, pieces: [P[0], P[1]] }), { ok: false, error: 'craft-pieces' });
  assert.deepEqual(asked, [], 'nothing asked');
  assert.equal((await host.deliver(w)).ok, true);
  assert.deepEqual(asked, [[P[0], P[1], P[2]]]);
  assert.deepEqual(player.items.map((it) => it.provenance), [P[3]]);
});

test('AUDIT CRAFT-WRITS C1/C4/C9: the host puts the goods back WHERE THEY STOOD on a refusal, on an `ok` that moved no record (a request answered again - `repeat`, no `realm`), and when the ask throws before the service hears it; an act that landed has the book read again at once; a locked serving is never offered (mutants: the put back\'s place; the repeat\'s put back; the throw\'s put back; the landed read; the lock read)', async () => {
  const player = { items: [bottle(2), { name: 'Torch' }, bottle(3, { potent: 25 })] };
  const shape = () => player.items.map((it) => [it.name ?? 'bottle', it.stackCount ?? 1]);
  const before = shape();
  let answer = { ok: false, error: 'craft-unbrewed' };
  const book = { craftDeliver: async () => answer };
  const host = createCraftWritHost({ player: () => player, session: () => session(), checkpoint() {}, saved() {}, book: () => book });
  await host.deliver(HEALING);
  assert.deepEqual(shape(), before, 'the plain two back at the head of the pack, not its foot');
  answer = { ok: true, data: { pay: 42, repeat: true } };
  assert.equal((await host.deliver(HEALING)).ok, true);
  assert.deepEqual(shape(), before, 'answered again, the record never moved: every bottle stays');
  answer = { ok: true, data: { pay: 42, realm: { seq: 4 } } };
  await host.deliver(HEALING);
  assert.deepEqual(shape(), [['Torch', 1], ['bottle', 1]], 'a fill that moved the record keeps them out');
  // C4: an act that landed, its answer lost - the book read again at once, as a disenchant's
  const forced = [];
  let tries = 0;   // the first ask unanswered, the second finds the record one on: landed
  const lb = { craftDeliver: async () => (++tries === 1 ? { ok: false, error: 'offline' } : { ok: false, error: 'seq', seq: 4 }), refresh: async (o) => { forced.push(o); } };
  const p4 = { items: [bottle(4)] };
  const landed = await createCraftWritHost({ player: () => p4, session: () => session(), checkpoint() {}, saved() {}, book: () => lb }).deliver(HEALING);
  assert.deepEqual([landed.ok, landed.landed, forced], [true, true, [{ force: true }]]);
  const p2 = { items: [bottle(4)] };
  const gone = createCraftWritHost({ player: () => p2, session: () => session(), checkpoint() {}, saved() {}, book: () => null });
  assert.deepEqual(await gone.deliver(HEALING), { ok: false, error: 'offline' });
  assert.deepEqual(p2.items.map((it) => it.stackCount), [4], 'the throw put them back');
  // C3/C9: a locked serving stays in the pack, off the card's count and the pick
  const P = ['0123456789abcdef', '1123456789abcdef'];
  const dish = (pv, extra = {}) => ({ templateIndex: 685, provenance: pv, recipe: 'stew:north', name: 'Hunter\'s Stew', ...extra });
  const p3 = { items: [dish(P[0], { locked: true }), dish(P[1])] };
  const h3 = createCraftWritHost({ player: () => p3, session: () => session(), checkpoint() {}, saved() {}, book: () => ({ craftDeliver: async () => ({ ok: true, data: {} }) }) });
  const w = { id: 'k:1:r0123456789abcdef0123:1', product: 'dish:stew', kind: 'dish', qty: 2, pieces: P };
  assert.deepEqual(h3.held(w), { pack: 1, made: 1, loose: 0, ready: false });
  assert.deepEqual(await h3.deliver(w), { ok: false, error: 'craft-pieces' });
});

test('AUDIT CRAFT-WRITS T4: the book\'s delivery (net/profBook.js craftDeliver) against the real Worker - a brew drops the Work list the card counts from (C7); a lost answer\'s press asks under the SAME id and is answered its row; filled, the card and the day\'s count move in the list kept, the track with them; a record moved under the ask has the book read again (C4); a list read while a fill was asked is read again (C1); a character changed before the answer is said elsewhere (mutants: the drop; the kept id; the card\'s move; the reread; the generation; the slot guard)', async (t) => {
  let nowS = utcDay(T0) * 86_400 + 12 * 3600;
  const realNow = Date.now;
  Date.now = () => nowS * 1000;   // the Worker's clock the book's: one day, so only the act makes the book stale
  t.after(() => { Date.now = realNow; });
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', CHAPTERS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');
  const base = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  let reads = 0, lose = false, hold = null, after = null;
  const rids = [];
  const door = {
    ...base,
    writs: async (...a) => { reads++; const h = hold; const r = await base.writs(...a); if (h) await h; return r; },   // held AFTER the Worker answered: a list of before
    craftWrit: async (c, id, rid, realm, pieces) => { rids.push(rid); const r = await base.craftWrit(c, id, rid, realm, pieces); after?.(); if (lose) { lose = false; return { ok: false, error: 'offline' }; } return r; },
  };
  let who = mac.character;
  const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
  const book = createProfBook({ door, storage: mem(), character: () => who, now: () => nowS * 1000, sleep: () => Promise.resolve() });
  assert.equal((await book.refresh()).ok, true);
  const aim = (slot, product) => {
    const w = craftWritOf(product);
    raw.prepare('UPDATE craft_writs SET product = ?, tier = ?, faction = ?, qty = ?, pay = ?, xp = ?, renown = ?, track = ? WHERE player = ? AND slot = ? AND day = ?')
      .run(w.product, w.tier, w.faction, w.qty, w.pay, w.xp, w.renown, w.track, mac.id, slot, day);
    return raw.prepare('SELECT id FROM craft_writs WHERE player = ? AND slot = ? AND day = ?').get(mac.id, slot, day).id;
  };
  assert.equal((await book.writs(17)).data.crafts.writs.length, 3);
  const day = utcDay(nowS);
  const id = aim(0, 'potion:healing');
  await book.writs(17, { force: true });
  const HEAL = ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'];
  for (let i = 0; i < 2; i++) {
    for (const k of HEAL) raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', 1)
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + 1`).run(mac.id, mac.character, k);
    const b = await book.brew('healing', HEAL, {}, () => {});
    assert.equal(b.ok, true, JSON.stringify(b));
  }
  const r0 = reads;
  assert.equal((await book.writs(17)).data.crafts.writs[0].brewed, 4, 'the brews\' four, read fresh');
  assert.equal(reads, r0 + 1, 'C7: the brew let the minute\'s list go');
  const rec = JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(mac.character).obj)));
  layRecord(s.env, mac.character, { ...rec, items: [bottle(8)] });
  // the answer lost: the service filled it; pressed again (the record where it now stands), the same id - its row
  lose = true;
  assert.deepEqual(await book.craftDeliver(id, null, mac.at()), { ok: false, error: 'offline' });
  const again = await book.craftDeliver(id, null, mac.at());
  assert.deepEqual([again.ok, again.data?.repeat, rids[0] === rids[1]], [true, true, true], JSON.stringify(again));
  const kept = (await book.writs(17)).data.crafts;
  assert.deepEqual([kept.writs[0].state, kept.today.filled, reads], ['mine', 1, r0 + 1], 'the list kept moved with it, nothing read');
  assert.equal(book.track('provisioning')?.xp, Number(raw.prepare("SELECT xp FROM prof_tracks WHERE char_id = ? AND profession = 'provisioning'").get(mac.character).xp));
  // C4: a record moved under the ask - the book stale past the backoff
  const id1 = aim(2, 'potion:healing');
  nowS += 120;
  assert.equal(book.stale(), false, 'nothing yet');
  const stale = await book.craftDeliver(id1, null, { ...mac.at(), seq: mac.at().seq - 1 });
  assert.equal(stale.error, 'seq');
  assert.equal(book.stale(), true, 'read again');
  // C1: a list read while a fill was answered is read again, never kept with the writ open
  for (let i = 0; i < 2; i++) await book.brew('healing', HEAL.map((k) => (raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', 1)
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + 1`).run(mac.id, mac.character, k), k)), {}, () => {});
  let open;
  hold = new Promise((r) => { open = r; });
  const reading = book.writs(17, { force: true });
  hold = null;
  const r1 = reads;
  assert.equal((await book.craftDeliver(id1, null, mac.at())).ok, true);
  open();
  const read = await reading;
  assert.deepEqual([read.data.crafts.writs[2].state, reads > r1], ['mine', true], 'the read began before the fill: asked again');
  // a character changed before the answer: said elsewhere, nothing kept under the new slot
  const id2 = aim(1, 'potion:healing');
  after = () => { who = 'r1123456789abcdef0123'; };
  const el = await book.craftDeliver(id2, null, mac.at());
  assert.equal(el.elsewhere, true);
});

test('CRAFT-WRITS client: the Work tab - the character\'s crafting writs under their own head with the day\'s count, each the guild\'s ask, what fills it, its pay and what is held; Deliver waiting with its reason on the card; a press delivers, takes the balance and Renown as a Court writ\'s, says the guild\'s thanks and reads the list again (mutants: the head; the card\'s lines; the waiting; the press)', async () => {
  const crafts = { writs: [HEALING, { ...HEALING, id: 'k:20383:r0123456789abcdef0123:1', product: 'dish:stew', kind: 'dish', faction: GUILD_FACTION_IDS.FightersGuild, qty: 3, pay: 20, xp: 40, renown: 30, pieces: [] }], today: { filled: 1, max: 3 } };
  let reads = 0;
  const book = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 0,
    writs: async () => { reads++; return { data: { writs: [], receipts: [], merit: [], chapters: [], today: { filled: 0, max: 3 }, crafts }, error: null, stale: false }; },
    deliver: async () => ({ ok: false }) };
  const notices = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
  const delivered = [], taken = [];
  const held = (w) => (w.kind === 'potion' ? { pack: 5, made: 4, ready: true } : { pack: 0, made: 1, ready: false });
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices, nowS: () => 20383 * 86400 + 3600,
    work: { book, region: 17, regionName: 'Anticlere', countName: (k, n) => `${n} ${k}`, onTaken: (r) => { taken.push(r.data.pay); return 'court words'; },
      crafts: { held, deliver: async (w) => { delivered.push(w.id); return { ok: true, data: { pay: 42, xp: 84, renown: { credited: 63 } } }; } } } });
  await tick();
  byClass(host, 'notice-tab')[1].click();
  for (let i = 0; i < 3; i++) await tick();
  assert.deepEqual(byClass(host, 'notice-section').map((n) => n.textContent), ['Crafting writs - 1 of 3 today', 'Court and guild writs']);
  assert.equal(byClass(host, 'notice-tab')[1].getAttribute('aria-label'), 'Work, 2 open', 'AUDIT CRAFT-WRITS T5: the tab counts the crafting writs open');
  const cards = byClass(host, 'notice-craft');
  assert.equal(cards.length, 2);
  assert.deepEqual(['writ-kind', 'writ-need', 'writ-made', 'writ-pay'].map((c) => byClass(cards[0], c)[0].textContent), [
    'Crafting writ', 'The Temple of Stendarr asks you for 4 Potions of Healing', 'Of your own brewing - the bottles leave your pack.', 'Pays 42 silver, 84 Provisioning experience, 63 Renown and standing with the Temple of Stendarr']);
  assert.match(byClass(cards[0], 'writ-take')[0].textContent, /4 brewed by you, 5 in your pack/);
  const stew = cards[1].querySelector('button');
  assert.deepEqual([stew.disabled, stew.title, byClass(cards[1], 'writ-walled')[0].textContent], [true, 'Make 2 more yourself - pieces you bought or sold do not count', 'Make 2 more yourself - pieces you bought or sold do not count.']);
  const go = cards[0].querySelector('button');
  assert.equal(go.disabled, false);
  const before = reads;
  go.click();
  for (let i = 0; i < 5; i++) await tick();
  assert.deepEqual([delivered, taken], [[HEALING.id], [42]]);
  assert.ok(reads > before, 'the list read again');
  assert.match(host.textContent, /The Temple of Stendarr thanks you: 42 silver, 84 Provisioning experience and 63 Renown\./);
});

test('AUDIT CRAFT-WRITS C1/C6/C8: the Work tab - the day\'s three filled said on the card and in Deliver\'s name, not its title alone; a fill marks its card at once, before the list read again comes back; the realm\'s silence and a character changed are said in their own words; a throw never holds the board (mutants: the full reason\'s place; the local mark; the silence\'s words; elsewhere\'s words; the throw caught)', async () => {
  const mount = (crafts, deliver, { slow = false } = {}) => {
    let reads = 0;
    const book = { state: { open: true, writs: { today: 0, max: 3 } }, held: () => 0,
      writs: async () => { reads++; if (slow && reads > 1) return new Promise(() => {}); return { data: { writs: [], receipts: [], merit: [], chapters: [], today: { filled: 0, max: 3 }, crafts }, error: null, stale: false }; },
      deliver: async () => ({ ok: false }) };
    const notices = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) };
    const host = document.createElement('div');
    mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 5 }, book: notices, nowS: () => 20383 * 86400 + 3600,
      work: { book, region: 17, regionName: 'Anticlere', countName: (k, n) => `${n} ${k}`, onTaken: () => 'court words',
        crafts: { held: () => ({ pack: 5, made: 4, ready: true }), deliver } } });
    return host;
  };
  const settle = async () => { for (let i = 0; i < 5; i++) await tick(); };
  const full = mount({ writs: [HEALING], today: { filled: 3, max: 3 } }, async () => ({ ok: false }));
  await tick();
  byClass(full, 'notice-tab')[1].click();
  await settle();
  const card = byClass(full, 'notice-craft')[0];
  const b = card.querySelector('button');
  assert.deepEqual([b.disabled, b.getAttribute('aria-label'), byClass(card, 'writ-walled')[0]?.textContent], [true, 'Deliver: You have filled today\'s crafting writs', 'You have filled today\'s crafting writs.']);
  // a fill: the card says it at once, the list read again never coming back
  const slow = mount({ writs: [HEALING], today: { filled: 0, max: 3 } }, async () => ({ ok: true, data: { pay: 42, xp: 84, renown: { credited: 63 } } }), { slow: true });
  await tick();
  byClass(slow, 'notice-tab')[1].click();
  await settle();
  byClass(slow, 'notice-craft')[0].querySelector('button').click();
  await settle();
  const now = byClass(slow, 'notice-craft')[0];
  assert.deepEqual([now.className.includes('done'), now.querySelector('button'), byClass(now, 'writ-left')[0].textContent], [true, null, 'Filled by you']);
  // the realm's silence; another character
  for (const [answer, words] of [[{ ok: false, error: 'offline', unknown: true }, /The realm did not answer\. Rejoin and look at the board again/], [{ ok: false, error: 'elsewhere', elsewhere: true }, /You are playing another character now - the writ was not delivered\./]]) {
    const h = mount({ writs: [HEALING], today: { filled: 0, max: 3 } }, async () => answer);
    await tick();
    byClass(h, 'notice-tab')[1].click();
    await settle();
    byClass(h, 'notice-craft')[0].querySelector('button').click();
    await settle();
    assert.match(h.textContent, words);
  }
  // C9: a press whose host throws leaves the board free to press again
  const thrown = mount({ writs: [HEALING], today: { filled: 0, max: 3 } }, async () => { throw new Error('gone'); });
  await tick();
  byClass(thrown, 'notice-tab')[1].click();
  await settle();
  byClass(thrown, 'notice-craft')[0].querySelector('button').click();
  await settle();
  assert.equal(byClass(thrown, 'notice-craft')[0].querySelector('button').disabled, false);
});

test('CRAFT-WRITS client: the wiring - the host made once in world.js and named on the Work tab; the door posts the realm and the pieces; the book asks it once (the realm act asks again); the service\'s route and its progress line (mutants: the host unwired - every other seam held by its source line here, the book\'s by its own test above)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /const craftWrits = createCraftWritHost\(\{ player: \(\) => playerEntity, session: \(\) => realmSession, checkpoint: \(\) => onlineCheckpoint\(\), saved: \(\) => saveSoon\.changed\(\), book: \(\) => profBook \}\);/);
  assert.match(w, /onTaken: \(r\) => profWritTaken\(r\),\n\s+crafts: craftWrits,/);
  assert.match(src('src/net/accountClient.js'), /craftWrit: \(character, id, rid, realm, pieces = null\) => post\('\/v1\/writs\/craft', \{ character, id, rid, realm, \.\.\.\(pieces \? \{ pieces \} : \{\}\) \}\),/);
  assert.match(src('src/net/profBook.js'), /async craftDeliver\(writId, pieces = null, realm = null\) \{[^]*?door\.craftWrit\(c, writId, m\.id, realm, pieces\)/);
  const ix = src('server-account/src/index.js');
  assert.match(ix, /'\/v1\/writs\/craft': \(\) => deliverCraftWrit\(\{ \.\.\.ctx, bucket: env\.SAVES \}, who\.player, env, body\),/);
  assert.match(ix, /\.\.\.\(await craftWritBoard\(ctx, who\.player, env, body\)\) \};/);
  assert.match(src('server-account/src/progress.js'), /'\/v1\/writs\/craft': Object\.freeze\(\['prof', true\]\),/);
  assert.match(src('server-account/src/service.js'), /'\/v1\/writs\/craft',\n/);
});
