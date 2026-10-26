// AUDIT RELEASE R3 (2026-10-26, bible/01-Overview/audits/Audit-Release-R3.md): what the merge of main into TESA composed
// in the hub's gate kill - GATE-COURTS (main: a court's kill is said, never kept as the night's fall) and WW2 (TESA: each
// lane keeps its own fall, under its own key). tools/mutants/release_r3.json R3-5-*.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeRooms } from '../fakeRoom.mjs';
import { SOCIAL_ROOM, GATE_INTERNAL_FELL, gateLaneKey } from '../../src/net/wire.js';
import { gateNumber, gateTimes } from '../../src/net/gate/gateLaw.js';

const DAY = 200;

test('R3-5 THE HUB\'S KILL, COMPOSED: the Bay\'s night kept on its key, a lane past the Bay\'s on its own and never over the Bay\'s, and a court\'s kill on neither (mutants: a lane\'s fall written as the Bay\'s; a court kept as the night)', async () => {
  const realNow = Date.now;
  Date.now = () => gateTimes(DAY).openAt + 1000;
  try {
    const world = fakeRooms({ now: () => Date.now() });
    const hub = world.room(SOCIAL_ROOM);
    const door = (body) => hub.room.fetch(new Request(`https://relay.internal${GATE_INTERNAL_FELL}`, { method: 'POST', body: JSON.stringify(body) }));
    const far = gateNumber(DAY, 1);
    assert.equal((await door({ d: DAY, night: 1, at: 20, top: ['Ann'], n: 9, rc: [], here: [] })).status, 200);
    assert.equal((await door({ d: far, night: 1, at: 30, top: ['Bo'], n: 3, rc: [], here: [] })).status, 200);
    assert.equal(hub.store.get(gateLaneKey('gatefell', 0))?.d, DAY, 'the Bay\'s fall on the Bay\'s key, as it always was');
    assert.equal(hub.store.get(gateLaneKey('gatefell', 1))?.d, far, 'a lane past the Bay\'s on its own key - never over the Bay\'s');
    assert.equal((await door({ d: gateNumber(DAY + 1, 1), c: 2, at: 40, top: ['Cy'], n: 1, rc: [], here: [] })).status, 200);
    assert.equal(hub.store.get(gateLaneKey('gatefell', 1))?.d, far, 'a court\'s kill on a lane is not its night\'s fall');
  } finally { Date.now = realNow; }
});
