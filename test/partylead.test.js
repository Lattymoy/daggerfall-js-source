// PARTY-LEAD (2026-10-04, the player: "add a make person party leader option for the leader when in a party"): THE LEAD
// HANDED ON. The hub's `party.lead` act (world164 - world162 on its branch, renumbered past main's PRIMARCH and SUNBABY1 at the merge): the leader names a seated member who is online and the lead is
// theirs - every member hears the `party.leader` note a leave already says, then the party as it stands. A member may
// not, nor may the leader name themself, a stranger or an away seat. An older hub closes the socket on an act it does
// not know, so the client sends it, and the panel offers it (test/soc3_socialpanel.test.js), only through world164 on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SOCIAL_ACTS, PARTY_LEAD_RELAY_MIN, relaySupportsPartyLead, validSocialAct, validSocialFrame, validPartyFrame, RELAY_VERSION,
} from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { noteText } from '../src/net/social.js';
import { relayVersionAtLeast } from './relayVersion.mjs';
import { fakeRoom } from './fakeRoom.mjs';
import { SOCIAL_ROOM } from '../src/net/wire.js';

test('PARTY-LEAD wire: the act names an account, as a kick does; the relay that knows it is world164 on, and this tree ships it (mutants: the act naming nothing; the floor a relay too early; too late)', () => {
  assert.equal(SOCIAL_ACTS['party.lead'], 'acct');
  assert.deepEqual(validSocialAct({ k: 'party.lead', acct: 'acct-b' }), { k: 'party.lead', acct: 'acct-b' });
  assert.equal(validSocialAct({ k: 'party.lead' }), null, 'a lead handed to nobody');
  assert.equal(validSocialAct({ k: 'party.lead', peer: 'peer-b' }), null, 'by account, never by tab');
  assert.equal(PARTY_LEAD_RELAY_MIN, 164);
  assert.equal(relaySupportsPartyLead('world163'), false, 'SUNBABY1\'s relay closes the socket on it');
  assert.equal(relaySupportsPartyLead('world164'), true);
  assert.equal(relaySupportsPartyLead('world170'), true);
  assert.equal(relaySupportsPartyLead('world171'), true);
  assert.equal(relaySupportsPartyLead('world172'), true);
  assert.equal(relaySupportsPartyLead(null), false);
  assert.ok(relayVersionAtLeast(164), 'the relay this tree builds knows it');
  assert.equal(relaySupportsPartyLead(RELAY_VERSION), true);
  assert.equal(noteText({ code: 'party.leader', acct: 'acct-b', name: 'Bob' }, 'acct-b'), 'You lead the party now');
  assert.equal(noteText({ code: 'party.leader', acct: 'acct-b', name: 'Bob' }, 'acct-a'), 'Bob leads the party now');
});

const ofKind = (ws, k) => ws.sent.filter((m) => m.t === 'social' && m.k === k);
const lastOf = (ws, k) => ofKind(ws, k).at(-1) ?? null;
const errors = (ws) => ofKind(ws, 'error').map((m) => m.m);
async function withHub(fn) {
  const r = fakeRoom(SOCIAL_ROOM);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  const tick = (ms = 600) => { clock += ms; };
  const act = (ws, o) => r.raw(ws, JSON.stringify({ t: 'social', ...o }));
  const join = async (n) => { const ws = r.connect(); await r.hello(ws, `peer-${n}`, null, { name: n, acct: `acct-${n}`, asecret: `secret-of-acct-${n}` }); tick(10); return ws; };
  try { await fn({ r, act, join, tick }); } finally { Date.now = realNow; }
}

test('PARTY-LEAD hub: the leader hands the lead to an online member - every member told, the view and the store say so, and the old leader is a member (no kick); a member, oneself, a stranger and an away seat are refused in words (mutants: anyone handing it on; the lead to oneself; to a stranger; to an away seat; nobody told; the store unwritten)', () => withHub(async ({ r, act, join, tick }) => {
  const a = await join('a'), b = await join('b'), c = await join('c');
  await act(a, { k: 'party.invite', peer: 'peer-b' }); tick(); await act(b, { k: 'party.accept', party: lastOf(b, 'invite').party }); tick();
  await act(a, { k: 'party.invite', peer: 'peer-c' }); tick(); await act(c, { k: 'party.accept', party: lastOf(c, 'invite').party }); tick();
  const pid = a.att.party;
  await act(b, { k: 'party.lead', acct: 'acct-c' }); tick(); assert.equal(errors(b).at(-1), 'only the leader can do that');
  await act(a, { k: 'party.lead', acct: 'acct-a' }); tick(); assert.equal(errors(a).at(-1), 'that is you');
  await act(a, { k: 'party.lead', acct: 'acct-zz' }); tick(); assert.equal(errors(a).at(-1), 'they are not in your party');
  await r.drop(c); tick();
  await act(a, { k: 'party.lead', acct: 'acct-c' }); tick(); assert.equal(errors(a).at(-1), 'they are not online', 'AUDIT PARTY8: a lead nobody here can use');
  assert.equal(r.store.get('party:' + pid).leader, 'acct-a', 'every refusal left the lead where it was');
  await act(a, { k: 'party.lead', acct: 'acct-b' }); tick();
  assert.equal(r.store.get('party:' + pid).leader, 'acct-b');
  for (const ws of [a, b]) {
    const note = lastOf(ws, 'note');
    assert.deepEqual([note.code, note.acct, note.name], ['party.leader', 'acct-b', 'b'], 'told, with whose the lead is');
    assert.equal(lastOf(ws, 'party').party.leader, 'acct-b');
    for (const m of ws.sent) {
      if (m.t === 'social') assert.ok(validSocialFrame(m), JSON.stringify(m));
      else if (m.t === 'party') assert.ok(validPartyFrame(m), JSON.stringify(m));
    }
  }
  await act(a, { k: 'party.kick', acct: 'acct-b' }); tick(); assert.equal(errors(a).at(-1), 'only the leader can do that', 'the lead is gone from a');
  await act(b, { k: 'party.lead', acct: 'acct-a' }); tick();
  assert.equal(r.store.get('party:' + pid).leader, 'acct-a', 'and can come back');
}));

test('PARTY-LEAD client: the act leaves only through a hub that said world164 or later - an older one would close the socket on it (mutants: the gate missing; the flag never set from the welcome)', () => {
  for (const [version, ok] of [['world163', false], ['world164', true]]) {
    const sockets = [];
    class FakeWS {
      constructor() { this.sent = []; sockets.push(this); }
      send(s) { this.sent.push(JSON.parse(s)); }
      close() {}
      receive(o) { this.onmessage?.({ data: JSON.stringify(o) }); }
    }
    const s = new OnlineSession({ id: 'ann-0001', secret: 'secret-of-ann-0001', WebSocketImpl: FakeWS, now: () => 10000, acct: 'acct-ann', asecret: 'secret-of-acct-ann', name: 'Ann' });
    s.join(SOCIAL_ROOM, { x: 1, y: 0, z: 1, yaw: 0, pitch: 0, mv: 0 });
    const ws = sockets[0]; ws.onopen?.();
    ws.receive({ t: 'welcome', id: 'ann-0001', peers: [], v: version });
    assert.equal(s.partyLeadOk, ok, version);
    if (!s.acct) s.acct = 'acct-ann';
    const before = ws.sent.length;
    assert.equal(s.sendSocial({ k: 'party.lead', acct: 'acct-bob' }), ok, `${version}: sent only where the hub knows it`);
    assert.equal(ws.sent.slice(before).some((m) => m.t === 'social' && m.k === 'party.lead'), ok);
    assert.equal(s.sendSocial({ k: 'party.leave' }), true, `${version}: every other act as before`);
  }
});
