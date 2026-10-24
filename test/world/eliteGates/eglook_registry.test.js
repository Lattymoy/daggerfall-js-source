// EG-G2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 2, 11.6 and 25.1 - EG1's
// two laws): THE REGISTRY OF PSEUDO-ARCHIVES (world/eliteGates/pseudoArchives.js) and THE GATE'S TIERS (systems/gateTier.js).
// The registry: no two entries overlap (the refusal AUDIT SD IV R6's collision wanted), every `*ARCHIVE*` constant past
// TEXTURE.511 in src/ is registered at its own value and owner and every registered constant still stands in its owner
// (swept both ways over the source), every string archive key the same, the Spire's four bands at the page's numbers
// and its arch's block moved past the harbour's 38231, the free-number pick. The tiers: the Regular tier's words the
// event's own name, the Elite tier's the breach's, Abyss reserved and answered by nothing; the plaque, the sight line
// (the Elite Dungeon's own rounding) and the Timers row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  PSEUDO_ARCHIVES, PSEUDO_ARCHIVE_KEYS, PSEUDO_ARCHIVE_FLOOR, EG_BAND_ARCHIVES, EG_BAND_BLOCK, EG_ARCH_ARCHIVES,
  pseudoArchiveCollisions, pseudoArchiveOwner, pseudoArchiveFree,
} from '../../../src/world/eliteGates/pseudoArchives.js';
import { GATE_TIERS, GATE_TIER_TEXT, GATE_TIER_SUB, gateTier, gateTierText, eliteBreachPlaque, gateSightLine, eliteTimerText } from '../../../src/systems/gateTier.js';
import { DUNGEON_TIERS } from '../../../src/systems/dungeon/dungeonTier.js';
import { dungeonSightLine } from '../../../src/world/spawnedDungeons.js';
import { EG_TEXT, egRoomKey } from '../../../src/net/eliteGates/egLaw.js';
import { LAST_CLASSIC_TEXTURE_ARCHIVE } from '../../../src/scenes/dataPipeline.js';

const SRC = new URL('../../../src/', import.meta.url).pathname;
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p, out); else if (f.endsWith('.js')) out.push(p); }
  return out;
}
/** Every `const NAME = <number>` and `const NAME = '<string>'` whose name says ARCHIVE (or an art key) in src/ - the sweep. */
function sweep() {
  const nums = [], keys = [];
  for (const p of walk(SRC)) {
    const rel = p.slice(SRC.length), text = readFileSync(p, 'utf8');
    for (const m of text.matchAll(/(?:export )?const ([A-Z0-9_]*ARCHIVE[A-Z0-9_]*) *= *([0-9_]+)\b/g)) {
      const v = Number(m[2].replace(/_/g, ''));
      if (v > PSEUDO_ARCHIVE_FLOOR && !/_MAX$|_MIN$/.test(m[1])) nums.push({ owner: rel, name: m[1], value: v });
    }
    for (const m of text.matchAll(/(?:export )?const ([A-Z0-9_]*(?:ARCHIVE|ART_KEY)[A-Z0-9_]*) *= *'([^']+)'/g)) if (m[2].length > 1) keys.push({ owner: rel, name: m[1], value: m[2] });
  }
  return { nums, keys };
}

test('EG-G2 THE REGISTRY (section 11.6): no two numbered pseudo-archives overlap; each lies past TEXTURE.511 (the floor is the data pipeline\'s own); the refusal finds a collision put in; the owner of a number and of a string key; the first free block past a number (mutants: an overlap unrefused; the floor moved; a free pick landing on a taken number)', () => {
  assert.equal(PSEUDO_ARCHIVE_FLOOR, LAST_CLASSIC_TEXTURE_ARCHIVE, 'the floor is Daggerfall\'s last texture archive');
  assert.deepEqual(pseudoArchiveCollisions(), [], 'no two entries overlap');
  for (const e of PSEUDO_ARCHIVES) { assert.ok(e.from > PSEUDO_ARCHIVE_FLOOR && e.to >= e.from, `${e.name}: past TEXTURE.511`); assert.ok(['port', 'mod', 'data', 'synthetic'].includes(e.kind)); }
  assert.equal(new Set(PSEUDO_ARCHIVE_KEYS.map((k) => k.key)).size, PSEUDO_ARCHIVE_KEYS.length, 'every string key once');
  // the refusal works: the large boat back on the Hour's number (AUDIT SD IV R6)
  const bad = [...PSEUDO_ARCHIVES, { from: 38151, to: 38151, owner: 'world/ships/largeBoatArt.js', name: 'LARGE_BOAT_ARCHIVE', kind: 'port', what: '' }];
  assert.deepEqual(pseudoArchiveCollisions(bad), [['SD_REALM_ARCHIVE:38151', 'LARGE_BOAT_ARCHIVE:38151']]);
  assert.deepEqual(pseudoArchiveCollisions([{ from: 10, to: 20, name: 'a' }, { from: 20, to: 25, name: 'b' }]).length, 1, 'a shared end is an overlap');
  assert.deepEqual(pseudoArchiveCollisions([{ from: 10, to: 20, name: 'a' }, { from: 21, to: 25, name: 'b' }]), [], 'touching is not');
  assert.equal(pseudoArchiveOwner(38151).name, 'SD_REALM_ARCHIVE');
  assert.equal(pseudoArchiveOwner(112370).name, 'ARCHIVE_FOOT', 'a block holds its middle');
  assert.equal(pseudoArchiveOwner('hcc').owner, 'scenes/horseCartPool.js');
  assert.equal(pseudoArchiveOwner(38194), null, 'a free number has no owner');   // PIN MOVED (NAVAL-REFIT: a ship's paint took 38191, her cabin's 38192, her name boards 38193)
  assert.equal(pseudoArchiveFree(38150), 38150, 'a free number is its own pick');
  assert.equal(pseudoArchiveFree(38151), 38152, 'past the Hour\'s');
  assert.equal(pseudoArchiveFree(38231, 8), 38233, 'eight free after the harbour\'s and the lamp\'s');   // PIN MOVED (AUDIT EG V, the merge of main): LAMP-KEEPER II's lamp took 38232 - nine were free after the harbour's
  assert.equal(pseudoArchiveFree(38241, 9), 38303, 'past the Spire\'s - PIN MOVED (WITCH1): and the Witches\' Festival\'s pictures (38291) - PIN MOVED (STAR4, STAR7): and the Starfall\'s crater and Starglass (38301, 38302)');
  assert.equal(pseudoArchiveOwner(pseudoArchiveFree(1)), null);
});

test('EG-G2 THE REGISTRY, SWEPT BOTH WAYS: every `*ARCHIVE*` number past TEXTURE.511 in src/ is registered at its own value under its own owner, and every string archive key; every registered constant stands in its owner at the registry\'s value (mutants: a constant moved and the registry not; an entry naming a constant its owner lost)', () => {
  const { nums, keys } = sweep();
  assert.ok(nums.length >= 25 && keys.length >= 8, `${nums.length} numbers and ${keys.length} keys swept`);
  for (const n of nums) {
    const e = PSEUDO_ARCHIVES.find((q) => q.owner === n.owner && q.name === n.name);
    assert.ok(e, `${n.owner} ${n.name} = ${n.value} is registered`);
    assert.equal(e.from, n.value, `${n.name}: the registry's number is its owner's`);
  }
  for (const k of keys) {
    const e = PSEUDO_ARCHIVE_KEYS.find((q) => q.owner === k.owner && q.name === k.name);
    assert.ok(e, `${k.owner} ${k.name} = '${k.value}' is registered`);
    assert.equal(e.key, k.value);
  }
  // both ways: each registered entry (the registry's own blocks aside) is a constant its owner holds
  for (const e of PSEUDO_ARCHIVES.filter((q) => q.owner !== 'world/eliteGates/pseudoArchives.js')) assert.ok(nums.some((n) => n.owner === e.owner && n.name === e.name && n.value === e.from), `${e.owner} still holds ${e.name} = ${e.from}`);
  for (const e of PSEUDO_ARCHIVE_KEYS) assert.ok(keys.some((k) => k.owner === e.owner && k.name === e.name && k.value === e.key), `${e.owner} still holds ${e.name}`);
});

test('EG-G2 THE SPIRE\'S ARCHIVES (section 25.1): the four bands at the page\'s 38241, 38251, 38261 and 38271, a block of nine each; the arch, the key and the beacon moved past them to 38281-38289 because the harbour\'s art holds 38231 (mutants: a band on the harbour\'s number; a block of eight)', () => {
  assert.deepEqual([...EG_BAND_ARCHIVES], [38241, 38251, 38261, 38271]);
  assert.equal(EG_BAND_BLOCK, 9);
  assert.equal(pseudoArchiveOwner(38231).name, 'PORT_ARCHIVE', 'the harbour took the page\'s first number');
  for (const [i, a] of EG_BAND_ARCHIVES.entries()) { const e = pseudoArchiveOwner(a); assert.equal(e.name, 'EG_BAND_ARCHIVES'); assert.equal(e.to, a + 8, `band ${i}: nine numbers`); assert.equal(pseudoArchiveOwner(a + 8)?.name, 'EG_BAND_ARCHIVES'); }
  assert.deepEqual({ ...EG_ARCH_ARCHIVES }, { from: 38281, to: 38289 });
  assert.equal(pseudoArchiveOwner(38285).name, 'EG_ARCH_ARCHIVES');
});

test('EG-G2 THE GATE\'S TIERS (section 2): Regular, Elite, Abyss as the dungeons\' three; the Regular tier\'s word is the event\'s own name (unchanged - the gate\'s pool says it), the Elite tier\'s the breach\'s, Abyss reserved and answered by nothing; a breach (its id, its room key, its kind) is Elite, the day\'s gate Regular, anything else none; the plaque - its title, The Battlespire, and the company line to an outsider only; the sight line in the Elite Dungeon\'s own rounding; the Timers row before and inside (mutants: the Regular word changed; super answered; the company line shown to the company)', () => {
  assert.deepEqual([...GATE_TIERS], [...DUNGEON_TIERS], 'the dungeons\' shape');
  assert.equal(GATE_TIER_TEXT.regular, "Dagon's Breach");
  assert.match(readFileSync(new URL('../../../src/scenes/gate/gatePool.js', import.meta.url), 'utf8'), /name: 'Dagon\\'s Breach'/, 'the gate\'s own name, unchanged');
  assert.equal(GATE_TIER_TEXT.elite, EG_TEXT.name);
  assert.equal(GATE_TIER_TEXT.super, 'Abyss Breach');
  assert.equal(gateTier({ b: '0123456789abcdef' }), 'elite');
  assert.equal(gateTier(egRoomKey('0123456789abcdef')), 'elite', 'the room key');
  assert.equal(gateTier({ kind: 'eg' }), 'elite');
  assert.equal(gateTier({ day: 12345 }), 'regular');
  assert.equal(gateTier({ kind: 'gate' }), 'regular');
  assert.equal(gateTier('sd:0'), null); assert.equal(gateTier({}), null); assert.equal(gateTier(null), null);
  for (const x of [{ b: 'x' }, { day: 1 }, 'eg:0000000000000000', { kind: 'gate' }]) assert.notEqual(gateTier(x), 'super', 'nothing is Abyss');
  assert.equal(gateTierText({ b: 'ab' }), 'Elite Breach'); assert.equal(gateTierText({ day: 3 }), "Dagon's Breach"); assert.equal(gateTierText({}), null);
  assert.deepEqual(eliteBreachPlaque({ opener: 'Mac', mine: true }), { title: 'Elite Breach', subs: [GATE_TIER_SUB.elite] });
  assert.deepEqual(eliteBreachPlaque({ opener: 'Mac', mine: false }), { title: 'Elite Breach', subs: ['The Battlespire', "Mac's company"] });
  assert.equal(gateSightLine(137, 'North'), 'You see an Elite Breach 140 meters to the North!');
  for (const m of [3, 14, 15, 137, 1004]) assert.equal(gateSightLine(m, 'East').replace('an Elite Breach', 'X'), dungeonSightLine(m, 'East', 'elite').replace('an Elite Dungeon', 'X'), `${m} m rounds as the dungeon's`);
  assert.equal(gateSightLine(50, 'West', 'regular'), "You see Dagon's Breach 50 meters to the West!");
  assert.equal(eliteTimerText({ clock: '4:12' }), 'Elite Breach opens 4:12');
  assert.equal(eliteTimerText({ h: 17, clock: '24:10' }), 'Hall 17 - 24:10 left');
});
