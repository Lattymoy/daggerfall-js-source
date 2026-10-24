// BILL1 (2026-10-24, Mac, over the month's Cloudflare bill: "Wtf. Is this right?", then "Do everything now";
// bible/11-Multiplayer/Bill-Arc.md): THE SERVICE'S BUSIEST ROUTE, ASKED ONLY OF A TOWN THAT MAY HOLD A HOME. On
// 2026-10-23 the account service answered /v1/homes/town 3.08 million times - five a player a minute, under a
// registry that keeps a town's answer a minute - because the streamed world asked every location pixel it built
// (scenes/pixelBuild.js) and 336 towns held a home. The boot's read of every town's homes (QUEST-HOME, hearEveryTown)
// and the hub's words since (hearHome) already say which towns do; `mayHold` says it, and the build asks no other.
// A town walked into is still asked at its gate, as QUEST-HOME's own pin holds (fb1014_questhome.test.js).
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
  assert.equal(homes.mayHold(FARM), false, 'and sold again');
  assert.equal(await homes.ensure(HAMLET), true, 'a town walked into is asked at its gate, as before');
  assert.deepEqual(asked, [HAMLET]);
  assert.equal(homes.mayHold(HAMLET), true, 'its own answer named a home the read did not');
  homes.hearEveryTown([[CITY, Array.from({ length: HOME_KEYS_MAX - 1 }, (_, i) => i + 1)], [FARM + 100, [1]]]);
  assert.equal(homes.mayHold(FARM), true, 'a read that reached HOME_KEYS_MAX may have left a town out - not whole');
  homes.hearEveryTown([[CITY, Array.from({ length: HOME_KEYS_MAX - 2 }, (_, i) => i + 1)], [FARM + 100, [1]]]);
  assert.equal(homes.mayHold(FARM), false, 'one under it is whole');
});

test('BILL1: the streamed world\'s build asks its town\'s homes only of a town that may hold one - and waits on no other (mutant: the guard dropped)', () => {
  const text = src('src/scenes/pixelBuild.js');
  const at = text.indexOf('homeTown = (dfLocation.mapTableData?.mapId ?? 0) >>> 0;');
  assert.ok(at > 0);
  const gate = text.slice(at, text.indexOf('townHomes = onlineHomes.homesIn(homeTown);', at));
  assert.match(gate, /if \(onlineHomes && homeTown && onlineHomes\.mayHold\(homeTown\)\) \{/);
  assert.ok(gate.indexOf('onlineHomes.mayHold(homeTown)') < gate.indexOf('onlineHomes.waitFor(homeTown'), 'asked before the build waits');
});
