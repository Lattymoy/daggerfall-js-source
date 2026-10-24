// FIRST-PICK (FIELD BUGS 2026-10-16b, bible/01-Overview/bugs/Field-Bugs-2026-10-16b.md; the Discord: "I respeced yesterday and
// have a timer on my 50 lvl smithing, however, when I reached level 100, I can not choose level 100 perk") - a change on
// its way at one rank gates a paid CHANGE, as the service's chooseSpec refuses one (prof-respec-pending), never a rank's
// first choice nor the merge's free change, which it answers before that refusal. The page greyed every card of the
// track while any change waited. Driven end to end: the real account Worker, the real client door and profBook, the real
// Professions page.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, sessionStorageOf } from '../accountDb.mjs';
import { accountProf, SESSION_KEY } from '../../src/net/accountClient.js';
import { createProfBook } from '../../src/net/profBook.js';
import { xpForRank } from '../../src/net/professionLaw.js';

const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

/** The Professions page over a book, Smithing selected: its cards as [name, disabled, cost line]. */
async function page(book) {
  const { setProfessionsPages, drawProfessionsPage, resetProfPages } = await import('../../src/ui/professions/profPages.js');
  resetProfPages();
  setProfessionsPages({ book, name: (k) => k });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawProfessionsPage(root, draw, kit); };
  draw();
  [...root.querySelectorAll('button')].filter((b) => b.className.includes('prof-row')).find((b) => b.textContent.startsWith('Smithing')).onclick();
  const cards = () => [...root.querySelectorAll('button')].filter((b) => b.className.includes('prof-spec'));
  const read = () => cards().map((c) => [c.querySelector('b').textContent, c.disabled, c.querySelector('.prof-cost')?.textContent ?? null]);
  const done = () => { setProfessionsPages(null); resetProfPages(); root?.remove(); };
  return { cards, read, done, draw };
}

test('FIRST-PICK: a change waiting at 50 leaves the 100 cards open - the first pick goes through the real Worker; once chosen, a change at 100 waits, as the service refuses it', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  const setXp = (xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'smithing', ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(mac.id, mac.character, xp, Math.floor(Date.now() / 1000));
  const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, sleep: noWait });
  setXp(xpForRank(50));
  assert.equal((await book.refresh()).ok, true);
  assert.equal((await book.choose('smithing', 50, 'goldsmith')).ok, true, 'the first at 50, free');
  s.seedMarks(mac, 1500);
  assert.equal((await book.choose('smithing', 50, 'weaponsmith')).ok, true, 'a paid change at 50, a week away');
  setXp(xpForRank(100));
  assert.equal((await book.refresh()).ok, true);
  const tr = book.track('smithing');
  assert.deepEqual([tr.rank, tr.specs, tr.respec?.rank, tr.respec?.to], [100, { 50: 'goldsmith', 100: null }, 50, 'weaponsmith'], 'the reporter\'s track');

  const p = await page(book);
  try {
    const at = (rows) => Object.fromEntries(rows.map(([n, d, c]) => [n, [d, c]]));
    const before = at(p.read());
    // the 50 cards wait on the change; the one on its way says when
    assert.deepEqual([before.Weaponsmith[0], before.Armoursmith[0], before.Goldsmith[0], before.Gemcutter[0]], [true, true, true, true]);
    assert.match(before.Weaponsmith[1], /^In effect from /);
    assert.equal(before.Armoursmith[1], null, 'no change offered while one waits');
    // the 100 cards are a first choice: open, no price
    for (const n of ['Masterwright', 'Quartermaster', 'Master Jeweler', 'Lapidary']) assert.deepEqual(before[n], [false, null], n);

    await p.cards().find((c) => c.querySelector('b').textContent === 'Masterwright').onclick();
    assert.deepEqual(book.track('smithing').specs, { 50: 'goldsmith', 100: 'masterwright' }, 'the Worker took the first pick');
    assert.equal(book.track('smithing').respec?.to, 'weaponsmith', 'the change at 50 still on its way');
    const after = at(p.read());
    // chosen at 100 now: a CHANGE there waits on the one at 50, as chooseSpec's prof-respec-pending
    for (const n of ['Masterwright', 'Quartermaster', 'Master Jeweler', 'Lapidary']) assert.equal(after[n][0], true, n);
    for (const n of ['Quartermaster', 'Master Jeweler', 'Lapidary']) assert.equal(after[n][1], null, `${n}: no price while a change waits`);
    const refused = await s.call('/v1/prof/spec', { character: mac.character, profession: 'smithing', rank: 100, spec: 'quartermaster', from: 'masterwright', rid: 'fp-000001' }, mac.secret);
    assert.equal(refused.body.error, 'prof-respec-pending', 'the service agrees the change waits');
  } finally { p.done(); }
});

test('FIRST-PICK: the merge\'s free change stays offered while a change waits at the other rank - free, in effect at once, as the service answers it first', async () => {
  const tracks = new Map();
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: null },
    stale: () => false, refresh: async () => ({ ok: true }), track: () => tracks.get('smithing'), choose: async () => ({ ok: true }),
  };
  tracks.set('smithing', { profession: 'smithing', xp: xpForRank(100), rank: 100, specs: { 50: 'goldsmith', 100: 'masterwright' }, respec: { rank: 50, to: 'weaponsmith', at: 4_000_000_000 }, free: [100] });
  const p = await page(book);
  try {
    const rows = Object.fromEntries(p.read().map(([n, d, c]) => [n, [d, c]]));
    assert.deepEqual(rows.Quartermaster, [false, 'Change: free, once'], 'the free change at 100 offered');
    assert.deepEqual(rows.Masterwright, [true, null], 'the chosen one');
    assert.deepEqual(rows.Armoursmith, [true, null], 'a paid change at 50 still waits');
  } finally { p.done(); }
});
