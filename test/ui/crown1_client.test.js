// CROWN1 part one (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE SEAT TAB AT A CROWN - its holder's
// Officer offered the crown's Conscription beside every tier's Edicts, with its words; a palace's never offered it; the
// service's refusal in the board's words (bible/11-Multiplayer/Seats-Arc.md 7.6, 7.9; src/ui/seatTab.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byClass } from '../chargenDom.mjs';
import { mountNoticeBoard } from '../../src/ui/noticeWindow.js';
import { accountRefusalText } from '../../src/net/accountClient.js';

const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const OA = { id: 'g1', name: 'The Oath', tag: 'OA', heraldry: null };

test('CROWN1 THE CROWN\'S LEVER: at a crown its Officer is offered Conscription with its words, and proclaims it; at a palace it is never offered; the service\'s `edict-tier` in words (mutants: the tier filter; the seat\'s tier read)', async () => {
  const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }), readGuild: async () => ({ data: null, error: 'no-guild' }) };
  const now = 1_800_000_000;
  const acts = [];
  const mount = (seat) => {
    const host = document.createElement('div');
    const data = {
      seat, week: 16, phase: 'muster', reckoningAt: now + 3600, turningAt: now + 86400, defence: 4500,
      holder: { guild: OA, since: 3, standing: 55, tithe: 6, edict: 'festival' }, battle: null, standings: [], chronicle: [],
      mine: { guild: 'g1', rank: 1, seasoned: true, bound: 'g1', pledges: [{ region: seat.region, key: seat.key, held: true }], influence: 0, tributeRoom: 0 },
      holding: { standing: 55, tithe: 6, titheWeek: 16, edict: 'festival', next: null, upkeep: 6000, owed: 0 },
    };
    const seatBook = {
      open: true, standings: async () => ({ data, error: null }), pledge: async () => ({ ok: true }), unpledge: async () => ({ ok: true }), tribute: async () => ({ ok: true }),
      tithe: async () => ({ ok: true }), edict: async (s, e, aside) => { acts.push(['edict', s.key, e, aside]); return { ok: true, text: 'proclaimed' }; },
    };
    const v = mountNoticeBoard(host, { town: { name: seat.name, mapId: seat.key }, book: noticeBook, nowS: () => now, seat: { seat, book: seatBook } });
    byClass(host, 'notice-tab')[1].onclick();
    return { host, v };
  };
  const crown = mount(WAYREST);
  await tick();
  const sel = byClass(crown.host, 'notice-seat-edict')[0];
  assert.deepEqual(sel.children.map((o) => o.value), ['market-day', 'open-gates', 'curfew', 'levy', 'bounty', 'conscription', 'royal-tourney']);   // part two: and the Royal Tourney
  sel.value = 'conscription';
  sel.onchange();
  await tick();
  assert.match(crown.host.textContent, /Conscription: The kingdom's palace seats held by other guilds pay the crown 2% of their week's Tithe/);
  byClass(crown.host, 'notice-seat-edict-set')[0].click();
  await tick();
  assert.deepEqual(acts, [['edict', WAYREST.key, 'conscription', 0]]);
  crown.v.unmount();
  const palace = mount(ANTICLERE);
  await tick();
  assert.ok(!byClass(palace.host, 'notice-seat-edict')[0].children.some((o) => o.value === 'conscription'), 'a palace: never');
  palace.v.unmount();
  assert.equal(accountRefusalText('edict-tier'), 'Only a crown may proclaim that Edict.');
});
