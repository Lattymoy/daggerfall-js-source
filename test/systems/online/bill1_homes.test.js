// BILL1 (2026-10-24, Mac, over the month's Cloudflare bill: "Wtf. Is this right?", then "Do everything now";
// bible/11-Multiplayer/Bill-Arc.md): THE SERVICE'S BUSIEST ROUTE, ASKED ONLY OF A TOWN THAT MAY HOLD A HOME. On
// 2026-10-23 the account service answered /v1/homes/town 3.08 million times - five a player a minute, under a
// registry that keeps a town's answer a minute - because the streamed world asked every location pixel it built
// (scenes/pixelBuild.js) and 336 towns held a home. The boot's read of every town's homes (QUEST-HOME, hearEveryTown)
// and the hub's words since (hearHome) already say which towns do; `mayHold` says it, and the build asks no other.
// A town walked into is still asked at its gate (`onlineHomes?.ensure(_musicLoc...)`, held by home1.test.js: "the town
// asked on arrival"; AUDIT BILL C4 - this line named fb1014_questhome.test.js, which asks a town by hand).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createOnlineHomes } from '../../../src/systems/online/onlineHomes.js';
import { HOME_KEYS_MAX } from '../../../src/net/homeLaw.js';

const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const CITY = 7, FARM = 5, HAMLET = 9;

function registry() {
  const asked = [];
  const answers = new Map([[HAMLET, [{ buildingKey: 0x303, owner: 'Aldric', entry: 'owner' }]]]);
  const api = { town: async (id) => { asked.push(id); return { ok: true, data: { homes: answers.get(id) ?? [] } }; } };
  return { homes: createOnlineHomes({ api }), asked };
}

test('BILL1: a town may hold a home unless the boot\'s whole read and the hub\'s words since name none in it and no answer of its own named one (mutants: always may; a read at the cap taken as whole; an answer\'s own home forgotten)', async () => {
  const { homes, asked } = registry();
  assert.equal(homes.mayHold(FARM), true, 'before the boot\'s read: any town may');
  assert.equal(homes.hearEveryTown(undefined), false);
  assert.equal(homes.mayHold(FARM), true, 'a service before the read names none - still any');
  homes.hearEveryTown([[CITY, [0x101, 0x10203]]]);
  assert.deepEqual([homes.mayHold(CITY), homes.mayHold(FARM), homes.mayHold(HAMLET)], [true, false, false], 'the read names the city alone');
  homes.hearHome([{ m: FARM, u: [0x202], d: [] }]);
  assert.equal(homes.mayHold(FARM), true, 'a house bought since, the hub\'s word says it');
  homes.hearHome([{ m: FARM, u: [], d: [0x202] }]);
  assert.equal(homes.mayHold(FARM), true, 'and sold again - PIN MOVED (AUDIT BILL C2): a town a word named stays asked, its own answer the truth (it read false)');
  assert.equal(await homes.ensure(HAMLET), true, 'a town walked into is asked at its gate, as before');
  assert.deepEqual(asked, [FARM, HAMLET], 'PIN MOVED (AUDIT BILL C1): the word asked the farmstead the build had passed, then the hamlet its gate');
  assert.equal(homes.mayHold(HAMLET), true, 'its own answer named a home the read did not');
  homes.hearEveryTown([[CITY, Array.from({ length: HOME_KEYS_MAX - 1 }, (_, i) => i + 1)], [FARM + 100, [1]]]);
  const QUIET = 13;   // AUDIT BILL C2: a town no word named (FARM's word keeps it asked)
  assert.equal(homes.mayHold(QUIET), true, 'a read that reached HOME_KEYS_MAX may have left a town out - not whole');
  homes.hearEveryTown([[CITY, Array.from({ length: HOME_KEYS_MAX - 2 }, (_, i) => i + 1)], [FARM + 100, [1]]]);
  assert.equal(homes.mayHold(QUIET), false, 'one under it is whole');
});

test('BILL1: the streamed world\'s build asks its town\'s homes only of a town that may hold one - and waits on no other (mutant: the guard dropped)', () => {
  const text = src('src/scenes/pixelBuild.js');
  const at = text.indexOf('homeTown = (dfLocation.mapTableData?.mapId ?? 0) >>> 0;');
  assert.ok(at > 0);
  const gate = text.slice(at, text.indexOf('townHomes = onlineHomes.homesIn(homeTown);', at));
  assert.match(gate, /if \(onlineHomes && homeTown && onlineHomes\.mayHold\(homeTown\)\) \{/);
  assert.ok(gate.indexOf('onlineHomes.mayHold(homeTown)') < gate.indexOf('onlineHomes.waitFor(homeTown'), 'asked before the build waits');
});

test('AUDIT BILL C1 C2 C3: a word naming a town the build was turned from asks it at once; a read landing after a word, taken before it, leaves that town asked; a town whose own answer named no home is not asked again (mutants: the turned-from town forgotten; the word\'s town forgotten; any answer counted)', async () => {
  const asked = [];
  const answers = new Map([[FARM, [{ buildingKey: 0x202, owner: 'The Hound', entry: 'guild' }]]]);
  const api = { town: async (id) => { asked.push(id); return { ok: true, data: { homes: answers.get(id) ?? [] } }; } };
  const homes = createOnlineHomes({ api });
  homes.hearEveryTown([[CITY, [0x101]]]);
  // C3: a town asked at its gate whose answer named none is still a town that holds none
  const EMPTY = 11;
  assert.equal(await homes.ensure(EMPTY), true);
  assert.deepEqual(asked, [EMPTY]);
  assert.equal(homes.mayHold(EMPTY), false, 'its own answer named no home');
  // C1: the build is turned from the farmstead; a guild's hall made there since, and the hub's word of it heard
  assert.equal(homes.mayHold(FARM), false);
  homes.hearHome([{ m: FARM, u: [0x202], d: [] }]);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(asked, [EMPTY, FARM], 'the town the build passed is asked at once');
  assert.equal(homes.homeAt(FARM, 0x202)?.owner, 'The Hound', 'and its hall is known, standing or not');
  // C2: a read the boot asked before the word lands after it - the word's town stays one the build asks
  homes.hearEveryTown([[CITY, [0x101]]]);
  assert.equal(homes.mayHold(FARM), true, 'the late read does not take the word\'s town off the asks');
  // a town no word named and the read names none of: still turned from
  assert.equal(homes.mayHold(HAMLET), false);
});
