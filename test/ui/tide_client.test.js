// SEASON1 part two (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE TIDES ON THE SEAT TAB - this week's
// Tide in the seat's land and what it does, the coming week's, after the Season's line; none where no Season is counted;
// the Edict form pricing a Festival at the coming week's Tide (bible/11-Multiplayer/Seats-Arc.md 9.3, 7.9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from '../chargenDom.mjs';
import { mountNoticeBoard } from '../../src/ui/noticeWindow.js';

const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });

test('SEASON1 THE SEAT TAB\'S TIDE: the Marches\' Tide this week and what it does, then next week\'s, after the Season\'s line; no Tides counted, no line; the Edict form prices a Festival at the coming week\'s Tide (mutants: the line; its order; the none; the Festival\'s Tide)', async () => {
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }), readGuild: async () => ({ data: null, error: 'no-guild' }) };
  const now = 1_800_000_000;
  const mount = (extra) => {
    const host = document.createElement('div');
    const data = { seat: ANTICLERE, week: 42, phase: 'muster', reckoningAt: now + 3600, turningAt: now + 86400, defence: null, holder: null, standings: [], chronicle: [], ...extra };
    mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 3021 }, book: noticeBook, nowS: () => now, seat: { seat: ANTICLERE, book: { open: true, standings: async () => ({ data, error: null }) } } });
    byClass(host, 'notice-tab')[1].onclick();
    return host;
  };
  let host = mount({ season: { n: 1, start: 40, end: 48 }, tides: { now: 'daedra', next: 'plague' } });
  await tick();
  const lines = byClass(host, 'notice-seat-week').map((n) => n.textContent);
  assert.equal(lines[0], 'Week 3 of 8 of the Season of Morning Star.');
  assert.equal(lines[1], 'The Tide in the Marches this week: Daedric Incursion - gate kills give double influence and double silver. Next week: Plague.');   // AUDIT SEATS-2 L7: and the Drakes 9.3 doubles (PIN MOVED); SILVER: silver
  assert.match(lines[2], /^The Muster/);
  host = mount({ season: null, tides: null });
  await tick();
  assert.equal(byClass(host, 'notice-seat-tide').length, 0);
  const tab = readFileSync(new URL('../../src/ui/seatTab.js', import.meta.url), 'utf8');
  assert.match(tab, /const words = edictLine\(chosen, seat\.tier, data\?\.tides\?\.next \?\? 'calm'\);/);
});
