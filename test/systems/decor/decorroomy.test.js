// FIELD BUGS 2026-10-29f DECOR-ROOMY, the client (the service's half: test/server/decorroomy_service.test.js). A claim names the
// ground its price was set from; the room holds the cap the service says with its list; a home bought before names its
// ground once from the owner's client; an offline house holds its own ground's cap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { noteHomeDecorList, homeDecorCap } from '../../../src/systems/decor/homeDecorCap.js';
import { buyOnlineHome, createOnlineHomes } from '../../../src/systems/online/onlineHomes.js';
import { accountHomes, SESSION_KEY, REFUSALS } from '../../../src/net/accountClient.js';
import { DECOR_CAP } from '../../../src/net/decorLaw.js';

const settle = () => new Promise((r) => setTimeout(r, 0));
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('DECOR-ROOMY the room\'s cap: what the service said with its list, for that room alone; a home it never measured has its owner\'s client name the ground once, and holds the answer\'s cap; a guest\'s client names none (mutants: DECORROOMY-cap-unread, DECORROOMY-any-room, DECORROOMY-ground-unsent, DECORROOMY-guest-sends, DECORROOMY-answer-unread)', async () => {
  const sent = [];
  const homeDecor = { use: async (b) => { sent.push(b); return { ok: true, data: { ground: 450 } }; } };
  noteHomeDecorList(5, 6, { cap: 330, measured: true }, 330.2, 1, homeDecor, 'char');
  assert.equal(homeDecorCap(5, 6), 330);
  assert.equal(homeDecorCap(5, 7), null, 'another room');
  await settle();
  assert.equal(sent.length, 0, 'measured: nothing to name');
  noteHomeDecorList(5, 7, { cap: DECOR_CAP, measured: false }, null, 1, homeDecor, 'char');
  await settle();
  assert.equal(sent.length, 0, 'not mine: nothing named');
  assert.equal(homeDecorCap(5, 6), null, 'left behind with its room');
  noteHomeDecorList(5, 7, { cap: DECOR_CAP, measured: false }, 450.04, 2, homeDecor, 'char');
  assert.equal(homeDecorCap(5, 7), DECOR_CAP, 'until it answers');
  await settle();
  assert.deepEqual(sent, [{ mapId: 5, buildingKey: 7, character: 'char', op: 'ground', ground: 450.04, townBlocks: 2 }]);
  assert.equal(homeDecorCap(5, 7), 450);
  noteHomeDecorList(5, 7, { pieces: [] }, null, 1, homeDecor, 'char');
  assert.equal(homeDecorCap(5, 7), null, 'a service from before: no word');
});

test('DECOR-ROOMY the claim: a buy names the ground and the town\'s blocks its price was set from, through the registry to the service\'s body - a buy that names none sends none (mutants: DECORROOMY-buy-drops, DECORROOMY-registry-drops, DECORROOMY-body-drops)', async () => {
  const claims = [];
  const api = { claim: async (b) => { claims.push(b); return { ok: false, error: 'home-cap' }; } };
  const homes = createOnlineHomes({ api, character: () => 'char-aldric' });
  const buy = { mapId: 9, buildingKey: 4, region: 17, price: 135000, afford: () => true, pay: () => {} };
  await buyOnlineHome(homes, { ...buy, ground: [450.04, 1] });
  await buyOnlineHome(homes, { ...buy, buildingKey: 5, ground: [450.04, 1], realm: { act: async ({ call }) => call({ id: 'r', lease: 1, seq: 1 }) } });
  await buyOnlineHome(homes, { ...buy, buildingKey: 6 });
  assert.deepEqual(claims.map((c) => [c.buildingKey, c.ground, c.townBlocks]), [[4, 450.04, 1], [5, 450.04, 1], [6, undefined, undefined]]);
  const seen = [];
  const fetch = async (url, init) => { seen.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
  const storage = new Map([[SESSION_KEY, JSON.stringify({ secret: 'sek', id: 'p' })]]);
  const body = accountHomes({ fetch, storage: { getItem: (k) => storage.get(k) ?? null, setItem: () => {}, removeItem: () => {} } });
  await body.claim({ mapId: 9, buildingKey: 4, region: 17, character: 'c', price: 135000, ground: 450.04, townBlocks: 1 });
  await body.claim({ mapId: 9, buildingKey: 4, region: 17, character: 'c', price: 135000 });
  assert.deepEqual([seen[0].ground, seen[0].townBlocks], [450.04, 1]);
  assert.equal('ground' in seen[1], false, 'none named, none sent');
  assert.doesNotMatch(REFUSALS['decor-cap'], /\d/, 'the refusal names no one cap: each room has its own');
});

// the decorator's rig (test/decorFakes.mjs toolRig) has no pack, so one's own piece set down is read off the source
test('DECOR-ROOMY the decorator: one\'s own piece set down stops at the room\'s own cap, as a bought one does (mutant: DECORROOMY-own-flat)', () => {
  const m = src('src/scenes/decor/decorTool.js');
  assert.match(m, /if \(pool\.size\(\) >= capHere\(r\) \|\| !deps\.packHas\?\.\(item\)\) return false;/);
  assert.doesNotMatch(m, /pool\.size\(\) >= DECOR_CAP/, 'never the one cap');
});

test('DECOR-ROOMY the host: an online home\'s room holds the service\'s cap, an offline house its own ground\'s; the list read notes the cap, and the ground where the room is mine; a buy names the price\'s own measure (mutants: DECORROOMY-host-room, DECORROOMY-host-house, DECORROOMY-host-unnoted, DECORROOMY-host-buy)', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /if \(interiorHome\) return \{ kind: 'home', where: 'Your home', mapId: homeTownOf\(b\), buildingKey: b\.buildingKey, cap: homeDecorCap\(Number\(homeTownOf\(b\)\) >>> 0, b\.buildingKey\) \?\? undefined \};/);
  assert.match(m, /return \{ kind: 'house', where: 'Your house', cap: decorCapOf\(houseFootprintM2\(b\)\) \};/);
  assert.match(m, /noteHomeDecorList\(Number\(homeTownOf\(b\)\) >>> 0, b\.buildingKey, r\.data, interiorHome\?\.own \? houseFootprintM2\(b\) : null, b\.townBlocks \?\? 0, host\.homeDecor, host\.decorCharacter\?\.\(\) \?\? null\);/);
  assert.match(m, /ground: \[houseFootprintM2\(bd\), bd\.townBlocks \?\? 0\],/);
  assert.match(m, /const price = homeOnlinePrice\(houseFootprintM2\(bd\), bd\?\.townBlocks \?\? 0\);/, 'the same measure the price is');
});
