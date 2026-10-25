// FIRST-PICK (FIELD BUGS 2026-10-16b, bible/01-Overview/bugs/Field-Bugs-2026-10-16b.md; the Discord: "I respeced yesterday and
// have a timer on my 50 lvl smithing, however, when I reached level 100, I can not choose level 100 perk") - a change on
// its way at one rank (PERK-TRIAL: the week's lock after a paid change now) gates a paid CHANGE, as the service's chooseSpec refuses one (prof-respec-pending), never a rank's
// first choice nor the merge's free change, which it answers before that refusal. The page greyed every card of the
// track while any change waited. Driven end to end: the real account Worker, the real client door and profBook, the real
// Professions page.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, sessionStorageOf } from '../accountDb.mjs';
import { accountProf, SESSION_KEY } from '../../src/net/accountClient.js';
import { createProfBook } from '../../src/net/profBook.js';
import { xpForRank, RESPEC, SPEC_TRIAL_S } from '../../src/net/professionLaw.js';

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

test('FIRST-PICK: a lock at 50 leaves the 100 cards open - PIN MOVED (PERK-TRIAL: a paid change lands at once and the week after it is the lock; it was a change waiting the week) - the first pick goes through the real Worker and opens its own day of trial, free past the lock; that day out, a change at 100 waits on the lock, as the service refuses it', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    const setXp = (xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'smithing', ?, ?)
      ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(mac.id, mac.character, xp, Math.floor(Date.now() / 1000));
    const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
    const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, sleep: noWait });
    setXp(xpForRank(50));
    assert.equal((await book.refresh()).ok, true);
    assert.equal((await book.choose('smithing', 50, 'goldsmith')).ok, true, 'the first at 50, free');
    now += SPEC_TRIAL_S * 1000;   // its day of trial out
    s.seedMarks(mac, 1500);
    assert.equal((await book.choose('smithing', 50, 'weaponsmith')).ok, true, 'a paid change at 50, in effect at once');
    const paidAt = Math.floor(now / 1000);
    now += SPEC_TRIAL_S * 1000;   // and its own day out: the lock alone
    setXp(xpForRank(100));
    assert.equal((await book.refresh()).ok, true);
    const tr = book.track('smithing');
    assert.deepEqual([tr.rank, tr.specs, tr.respec, tr.lock], [100, { 50: 'weaponsmith', 100: null }, null, paidAt + RESPEC.days * 86_400], 'the reporter\'s track, as it stands now');

    const p = await page(book);
    try {
      const at = (rows) => Object.fromEntries(rows.map(([n, d, c]) => [n, [d, c]]));
      const before = at(p.read());
      // the 50 cards wait on the lock; the chosen one says when it opens
      assert.deepEqual([before.Weaponsmith[0], before.Armoursmith[0], before.Goldsmith[0], before.Gemcutter[0]], [true, true, true, true]);
      assert.match(before.Weaponsmith[1], /^Next change from /);
      assert.equal(before.Armoursmith[1], null, 'no change offered inside the lock');
      // the 100 cards are a first choice: open, no price
      for (const n of ['Masterwright', 'Quartermaster', 'Master Jeweler', 'Lapidary']) assert.deepEqual(before[n], [false, null], n);

      await p.cards().find((c) => c.querySelector('b').textContent === 'Masterwright').onclick();
      assert.deepEqual(book.track('smithing').specs, { 50: 'weaponsmith', 100: 'masterwright' }, 'the Worker took the first pick');
      const trialing = at(p.read());
      // chosen at 100 now, on its day of trial: a change there is free, past the lock
      for (const n of ['Quartermaster', 'Master Jeweler', 'Lapidary']) assert.deepEqual([trialing[n][0], /^Change: free until /.test(trialing[n][1])], [false, true], `${n}: free on its day`);
      now += SPEC_TRIAL_S * 1000;   // its day out
      p.draw();
      const after = at(p.read());
      for (const n of ['Masterwright', 'Quartermaster', 'Master Jeweler', 'Lapidary']) assert.equal(after[n][0], true, n);
      for (const n of ['Quartermaster', 'Master Jeweler', 'Lapidary']) assert.equal(after[n][1], null, `${n}: no price inside the lock`);
      const refused = await s.call('/v1/prof/spec', { character: mac.character, profession: 'smithing', rank: 100, spec: 'quartermaster', from: 'masterwright', rid: 'fp-000001' }, mac.secret);
      assert.equal(refused.body.error, 'prof-respec-pending', 'the service agrees the lock holds');
      const askedFree = await s.call('/v1/prof/spec', { character: mac.character, profession: 'smithing', rank: 100, spec: 'quartermaster', from: 'masterwright', rid: 'fp-000002', trial: true }, mac.secret);
      assert.equal(askedFree.body.error, 'prof-trial-over', 'asked as a trial\'s, its day out: refused, never charged, and said so (AUDIT PERK-TRIAL P4)');
    } finally { p.done(); }
  } finally { Date.now = realNow; }
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

test('AUDIT PERK-TRIAL P1 the page asks a change as its card said it: armed free on its choice\'s day, the second press asks it free (`trial: true`); armed at the price, paid; a card armed free whose day runs out before the second press arms again at its price - never asked free past its day, never charged unseen (mutants: the page sends nothing)', async () => {
  const realNow = Date.now;
  let now = 2_000_000_000_000;
  Date.now = () => now;
  try {
    const tracks = new Map(), asked = [];
    const book = {
      state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: null },
      stale: () => false, refresh: async () => ({ ok: true }), track: () => tracks.get('smithing'), choose: async (...a) => { asked.push(a); return { ok: true }; },
    };
    tracks.set('smithing', { profession: 'smithing', xp: xpForRank(50), rank: 50, specs: { 50: 'goldsmith', 100: null }, respec: null, trial: { 50: now / 1000 + 600 } });
    const p = await page(book);
    try {
      const card = (n) => p.cards().find((c) => c.querySelector('b').textContent === n);
      await card('Gemcutter').onclick();
      assert.equal(asked.length, 0, 'the first press arms');
      await card('Gemcutter').onclick();
      assert.deepEqual(asked.pop(), ['smithing', 50, 'gemcutter', { trial: true }], 'asked free, as it said');
      await card('Gemcutter').onclick();
      now += 601_000;   // armed free, and its day runs out on the screen
      p.draw();
      await card('Gemcutter').onclick();
      assert.equal(asked.length, 0, 'armed again, at its price');
      await card('Gemcutter').onclick();
      assert.deepEqual(asked.pop(), ['smithing', 50, 'gemcutter', { trial: false }], 'asked paid, as it said');
    } finally { p.done(); }
  } finally { Date.now = realNow; }
});
