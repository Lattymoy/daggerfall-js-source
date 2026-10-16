// SEASON1 part one (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE SEASON ON THE SEAT TAB - the week
// of the Season the standings name, above the week's clock; nothing where no Season is counted; a Season's titles in
// words on the badge (bible/11-Multiplayer/Seats-Arc.md 9.1, 7.4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byClass } from '../chargenDom.mjs';
import { mountNoticeBoard } from '../../src/ui/noticeWindow.js';
import { seatTitleText } from '../../src/net/townSeatLaw.js';

const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });

test('SEASON1 THE SEAT TAB\'S SEASON: the standings\' Season said as its week of its length and its name, before the week\'s clock; none counted, no line; a Season\'s titles in words (mutants: the line; its place; the none)', async () => {
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }), readGuild: async () => ({ data: null, error: 'no-guild' }) };
  const now = 1_800_000_000;
  const mount = (season) => {
    const host = document.createElement('div');
    const data = { seat: ANTICLERE, week: 42, phase: 'muster', reckoningAt: now + 3600, turningAt: now + 86400, defence: null, holder: null, standings: [], chronicle: [], ...(season !== undefined ? { season } : {}) };
    mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 3021 }, book: noticeBook, nowS: () => now, seat: { seat: ANTICLERE, book: { open: true, standings: async () => ({ data, error: null }) } } });
    byClass(host, 'notice-tab')[1].onclick();
    return host;
  };
  let host = mount({ n: 2, start: 40, end: 48 });
  await tick();
  const lines = byClass(host, 'notice-seat-week');
  assert.equal(lines[0].textContent, 'Week 3 of 8 of the Season of Sun\'s Dawn.');
  assert.match(lines[1].textContent, /^The Muster/, 'then the week\'s clock');
  assert.equal(byClass(host, 'notice-seat-season').length, 1);
  for (const season of [null, undefined]) {
    host = mount(season);
    await tick();
    assert.equal(byClass(host, 'notice-seat-season').length, 0, String(season));
    assert.match(byClass(host, 'notice-seat-week')[0].textContent, /^The Muster/);
  }
  const place = (k) => (k === ANTICLERE.key ? ANTICLERE : null);
  assert.deepEqual([seatTitleText('crowned', [5023, 2], place), seatTitleText('keeper', [3021, 2], place), seatTitleText('keeper', [9999, 2], place)], ['Crowned in Season 2', 'Keeper of Anticlere, Season 2', null]);
});
