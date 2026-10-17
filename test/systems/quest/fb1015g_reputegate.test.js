// REPUTE-GATE (FIELD BUGS 2026-10-15g, AUDIT GUILD-WORDS II; a Discord report: "The very first quest i did for them
// dropped my rep by 25 points"; Mac, asked: "Gate by reputation"). The Mages Guild offers by level, so a level-2
// apprentice drew "Guard the Guild" (-30 for the guarded treasure taken) and "Protect an Honored Mage" (-10, then -50)
// though their headers name standing 10 and 20. Online each now waits for its header's standing; offline the pool is
// DFU's, and the penalties are Daggerfall's either way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { QuestListsManager } from '../../../src/systems/quest/questLists.js';
import { QuestOfferFlow } from '../../../src/systems/quest/offerFlow.js';
import { ONLINE_REPUTE_GATES, reputeGated } from '../../../src/systems/quest/onlineRepute.js';
import { GUILD_GROUPS } from '../../../src/formats/factionFile.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const VENDOR = join(ROOT, 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
loadQuestTables(Object.fromEntries(readdirSync(join(VENDOR, 'Tables')).filter((f) => f.endsWith('.txt'))
  .map((f) => [f.replace('.txt', ''), read(join(VENDOR, 'Tables', f))])));

/** The real lists (Classic and DFU, as the bridge reads them) and the real flow, the list box on so the pool stays. */
function rig({ online, level = 2 }) {
  const m = new QuestMachine({ nowSeconds: () => 0, playerLevel: () => level, getReputation: () => 0 });
  const lists = new QuestListsManager({
    readListTable: (name) => { try { return read(join(VENDOR, 'Tables', `QuestList-${name}.txt`)); } catch { return null; } },
    getQuestSourceLines: () => null,
    parseQuest: () => null,
  });
  const deps = { getGuildFactionId: () => 40, guildQuestListBox: true };
  if (online !== undefined) deps.sharedClock = () => online;
  return new QuestOfferFlow(m, lists, deps);
}
const mages = (rep) => ({ isMember: () => true, rank: 0, getReputation: () => rep, isSatisfyQuestReqByLevel: () => true });
const poolAt = (rep, opts) => {
  const flow = rig(opts);
  flow.offerGuildQuest({ guildGroup: GUILD_GROUPS.MagesGuild, guild: mages(rep) });
  return flow.questPool.map((q) => q.name);
};

test('REPUTE-GATE: the gates are the quests\' own headers - `-- Repute: 10` and `-- Repute: 20` - and the list\'s rank column offers both at level 2 (mutants: a number not the header\'s, a third quest gated)', () => {
  assert.deepEqual(Object.keys(ONLINE_REPUTE_GATES), ['N0B10Y03', 'N0B20Y02']);
  for (const [name, rep] of Object.entries(ONLINE_REPUTE_GATES)) {
    assert.match(read(join(VENDOR, 'Quests', `${name}.txt`)), new RegExp(`^-- Repute: ${rep}\\r?$`, 'm'), name);
  }
  const list = read(join(VENDOR, 'Tables', 'QuestList-Classic.txt'));
  assert.match(list, /^N0B10Y03, MagesGuild, M, 1, 0,/m);
  assert.match(list, /^N0B20Y02, MagesGuild, M, 2, 0,/m);
});

test('REPUTE-GATE: through the real lists and offer flow, a level-2 Mages Guild member at standing 0 - offline DFU offers both; online neither until the header\'s standing (mutants: the gate offline, the gate at > not >=, the pool unfiltered)', () => {
  const offline = poolAt(0, { online: false });
  assert.ok(offline.includes('N0B10Y03') && offline.includes('N0B20Y02'), 'offline: DFU\'s pool');
  assert.deepEqual(poolAt(0, {}), offline, 'no shared clock handed: offline');
  const online0 = poolAt(0, { online: true });
  assert.deepEqual(online0, offline.filter((n) => n !== 'N0B10Y03' && n !== 'N0B20Y02'), 'online at 0: both wait, the rest as DFU');
  assert.deepEqual(poolAt(9, { online: true }), online0, 'at 9: still waiting');
  const online10 = poolAt(10, { online: true });
  assert.ok(online10.includes('N0B10Y03') && !online10.includes('N0B20Y02'), 'at 10: Guard the Guild');
  assert.ok(!poolAt(19, { online: true }).includes('N0B20Y02'), 'at 19: not yet');
  assert.ok(poolAt(20, { online: true }).includes('N0B20Y02'), 'at 20: Protect an Honored Mage');
});

test('REPUTE-GATE: the filter itself - offline the same pool, a null pool null, other quests untouched (mutants: a new array offline, a null pool filtered)', () => {
  const pool = [{ name: 'N0B10Y03' }, { name: 'N0B00Y04' }, { name: 'toString' }];
  assert.equal(reputeGated(pool, 0, false), pool);
  assert.equal(reputeGated(null, 0, true), null);
  assert.deepEqual(reputeGated(pool, 0, true).map((q) => q.name), ['N0B00Y04', 'toString']);
});

test('REPUTE-GATE: the bridge hands the flow the shared world (mutant: the door dropped)', () => {
  const bridge = read(join(ROOT, 'src/scenes/quest/questBridge.js'));
  const flow = bridge.slice(bridge.indexOf('const offerFlow = new QuestOfferFlow('), bridge.indexOf('// QuestMachine.Update\'s pacing'));
  assert.ok(flow.includes('    sharedClock: () => !!ctx.sharedClock?.(),'));
});
