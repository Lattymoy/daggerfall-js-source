// V2d - THE RACIAL-OVERRIDE QUEST STARTS, pinned against
// PlayerEntity.cs's two cadence arms (:470-477, :540-545),
// VampirismEffect.StartQuest (:227-263), LycanthropyEffect.StartQuest
// (:437-452) and the two cure tombstone sweeps (:375-386, :660-670).
// The quest MACHINE is host-owned, so every law here runs against the
// registered racialQuests host - the passiveSpecials shape - and the
// vendored pack's own corpus gate (test/quest.test.js) already proves
// $CUREWER, $CUREVAM and P0A01L00 parse.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  setRacialQuestHost, startRacialOverrideQuest,
  endVampireQuests, endLycanthropyQuests,
  CURE_QUEST_INTERVAL_MINUTES, VAMPIRE_QUEST_PREFIX,
  LYCANTHROPY_CURE_QUEST, VAMPIRISM_CURE_QUEST, VAMPIRE_INITIAL_QUEST,
} from '../src/systems/racialQuests.js';
import { createLycanthropyCurse, cureLycanthropy } from '../src/systems/lycanthropy.js';
import { createVampirismCurse, cureVampirism } from '../src/systems/vampirism.js';
import { LYCANTHROPY_TYPES, VAMPIRE_CLANS } from '../src/systems/infection.js';
import { tickPlayerMinutes, REGION_CONDITIONS_INTERVAL_MINUTES, CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const P = () => ({
  isPlayer: true, level: 5, activeEffects: [],
  stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
  skills: {}, health: 60, maxHealth: 60, fatigue: 100, items: [], spells: [],
});
/** A recording host: every started name lands in .started. */
const recordingHost = (extra = {}) => {
  const h = {
    started: [], tombstonedNames: [], tombstonedPrefixes: [],
    startQuest: (n) => h.started.push(n),
    startQuestObject: (q) => h.started.push(q.questName ?? q.name),
    findQuests: () => [],
    tombstoneQuestsByName: (n) => h.tombstonedNames.push(n),
    tombstoneQuestsByPrefix: (p) => h.tombstonedPrefixes.push(p),
    getVampireClanQuest: () => null,
    ...extra,
  };
  return h;
};
// rolls() feeding rangeInclusive: value = lo + floor(r * (hi-lo+1)).
const WIN = () => 0;          // every roll lands on its floor
const LOSE = () => 0.9999;    // every roll lands on its ceiling

beforeEach(() => setRacialQuestHost(null));

// ── 1. THE HEADLESS CHARTER + the cadence constant ────────────────

test('V2d: no override, an ended override, or no host each idle silently', () => {
  assert.equal(CURE_QUEST_INTERVAL_MINUTES, 120960, ':475 - `% 120960`, eighty-four days');
  const p = P();
  assert.equal(startRacialOverrideQuest(p, true, { rolls: WIN }), null, 'mortal: nothing');
  createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: 0 });
  assert.equal(startRacialOverrideQuest(p, true, { rolls: WIN }), null, 'no host registered: nothing (the headless charter)');
  const host = recordingHost();
  setRacialQuestHost(host);
  cureVampirism(p, {});
  assert.equal(startRacialOverrideQuest(p, true, { rolls: WIN }), null, 'an ended curse rolls nothing');
  assert.deepEqual(host.started, []);
});

// ── 2. LycanthropyEffect.StartQuest (:437-452) ────────────────────

test('V2d: the werewolf rolls $CUREWER at 30% on the CURE arm only, and never a second instance', () => {
  const p = P();
  createLycanthropyCurse(p, LYCANTHROPY_TYPES.Werewolf, { now: 0 });
  const host = recordingHost();
  setRacialQuestHost(host);
  assert.equal(startRacialOverrideQuest(p, false, { rolls: WIN }), null,
    'the base StartQuest is EMPTY - a werewolf gets no non-cure quest even on a winning roll');
  assert.equal(startRacialOverrideQuest(p, true, { rolls: LOSE }), null, 'a losing roll starts nothing');
  assert.equal(startRacialOverrideQuest(p, true, { rolls: WIN }), LYCANTHROPY_CURE_QUEST);
  assert.deepEqual(host.started, [LYCANTHROPY_CURE_QUEST]);
  // :443-447 - FindQuests first: a standing instance (TOMBSTONED ones
  // count too, the C# default both call sites take) blocks the start
  const busy = recordingHost({ findQuests: (n) => (n === LYCANTHROPY_CURE_QUEST ? [{ questTombstoned: true }] : []) });
  setRacialQuestHost(busy);
  assert.equal(startRacialOverrideQuest(p, true, { rolls: WIN }), null, 'an existing $CUREWER blocks the re-offer');
  assert.deepEqual(busy.started, []);
});

// ── 3. VampirismEffect.StartQuest (:227-263) ──────────────────────

test('V2d: the vampire\'s initiation latches once, then the clan pool serves', () => {
  const p = P();
  createVampirismCurse(p, VAMPIRE_CLANS.Khulari, { now: 0 });
  const host = recordingHost();
  setRacialQuestHost(host);
  assert.equal(startRacialOverrideQuest(p, false, { rolls: LOSE }), null, 'a losing roll leaves the latch unset');
  assert.equal(p.racialOverride.hasStartedInitialVampireQuest, false, 'the V2b entry minted it false; a lost roll keeps it');
  assert.equal(startRacialOverrideQuest(p, false, { rolls: WIN }), VAMPIRE_INITIAL_QUEST, 'the first winning roll is P0A01L00');
  assert.equal(p.racialOverride.hasStartedInitialVampireQuest, true, ':261 - latched on the curse entry (it rides the save)');
  // from now on the same arm asks the CLAN pool - with the clan id
  // and the player's LEVEL in the rank seat (:243-255)
  const asked = [];
  host.getVampireClanQuest = (clanId, level) => { asked.push([clanId, level]); return { questName: 'P0B00L01' }; };
  assert.equal(startRacialOverrideQuest(p, false, { rolls: WIN }), 'P0B00L01');
  assert.deepEqual(asked, [[VAMPIRE_CLANS.Khulari, 5]], 'the clan IS the faction id; the level rides');
  assert.deepEqual(host.started, [VAMPIRE_INITIAL_QUEST, 'P0B00L01']);
  host.getVampireClanQuest = () => null;
  assert.equal(startRacialOverrideQuest(p, false, { rolls: WIN }), null, 'an empty pool starts nothing');
});

test('V2d: the vampire cure roll is (10,100) < 30 - the odd floor is DFU\'s own line', () => {
  const p = P();
  createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: 0 });
  const host = recordingHost();
  setRacialQuestHost(host);
  // value = 10 + floor(r * 91): r = 19.5/91 -> 29 (starts), 20.5/91 -> 30 (does not)
  assert.equal(startRacialOverrideQuest(p, true, { rolls: () => 19.5 / 91 }), VAMPIRISM_CURE_QUEST, '29 < 30 starts');
  assert.equal(startRacialOverrideQuest(p, true, { rolls: () => 20.5 / 91 }), null, '30 does not');
  assert.deepEqual(host.started, [VAMPIRISM_CURE_QUEST]);
  // and the range really is DFU's (10,100), not (1,100)
  assert.match(read('src/systems/racialQuests.js'), /rangeInclusive\(rolls, 10, 100\)/,
    ':234 - random_range_inclusive(10, 100), verbatim');
  // no already-running check on $CUREVAM - also DFU's own
  const busy = recordingHost({ findQuests: () => [{}] });
  setRacialQuestHost(busy);
  assert.equal(startRacialOverrideQuest(p, true, { rolls: WIN }), VAMPIRISM_CURE_QUEST,
    'DFU never checks FindQuests for $CUREVAM - kept verbatim');
});

// ── 4. THE CURE SWEEPS (:375-386, :660-670) ───────────────────────

test('V2d: curing tombstones the quest line - P0* for the vampire, $CUREWER for the werewolf', () => {
  assert.equal(VAMPIRE_QUEST_PREFIX, 'P0');
  const host = recordingHost();
  setRacialQuestHost(host);
  const v = P();
  createVampirismCurse(v, VAMPIRE_CLANS.Lyrezi, { now: 0 });
  cureVampirism(v, {});
  assert.deepEqual(host.tombstonedPrefixes, ['P0'], 'EndVampireQuests: the whole clan line goes; $CUREVAM ends itself');
  const w = P();
  createLycanthropyCurse(w, LYCANTHROPY_TYPES.Wereboar, { now: 0 });
  cureLycanthropy(w, {});
  assert.deepEqual(host.tombstonedNames, [LYCANTHROPY_CURE_QUEST], 'EndLycanthropyQuests: every instance');
  // direct exports too - the seam the effects call
  endVampireQuests(); endLycanthropyQuests();
  assert.deepEqual(host.tombstonedPrefixes, ['P0', 'P0']);
  assert.deepEqual(host.tombstonedNames, [LYCANTHROPY_CURE_QUEST, LYCANTHROPY_CURE_QUEST]);
});

// ── 5. THE CADENCE, through the real tick (:470-477) ──────────────

test('V2d: the 38-day arm rolls the non-cure quest and the 84-day arm the cure, in the minute walk', () => {
  const host = recordingHost();
  setRacialQuestHost(host);
  const noSinks = {};
  // a boundary of each cadence, above the real epoch
  const N38 = Math.ceil(524000 / REGION_CONDITIONS_INTERVAL_MINUTES) * REGION_CONDITIONS_INTERVAL_MINUTES;
  const N84 = Math.ceil(524000 / CURE_QUEST_INTERVAL_MINUTES) * CURE_QUEST_INTERVAL_MINUTES;
  const cross = (entity, boundary) => {
    entity.lastGameMinutes = boundary - 1;
    tickPlayerMinutes({
      entity, classicMinutes: boundary - 1,
      dt: 2 / CLASSIC_MINUTES_PER_SECOND,   // two classic minutes: the walk covers the boundary minute
      sinks: noSinks, rolls: WIN,
    });
  };
  const p = P();
  createVampirismCurse(p, VAMPIRE_CLANS.Lyrezi, { now: N38 - 10 });
  cross(p, N38);
  assert.deepEqual(host.started, [VAMPIRE_INITIAL_QUEST], 'the initiation rides the region-conditions minute');
  cross(p, N84);
  assert.equal(host.started.at(-1), VAMPIRISM_CURE_QUEST, 'the cure rides its own 84-day minute');
  // and the boundary really is required: a walk that crosses neither starts nothing
  const before = host.started.length;
  cross(p, N38 + 1000);
  assert.equal(host.started.length, before, 'no boundary in the window, no roll');
});

// ── 6. THE HOST'S OWN LAWS (world.js's registration, greppable) ───

test('V2d: the world host mounts the seam and the two cure arms', () => {
  const w = read('src/scenes/world.js');
  assert.ok(w.includes('setRacialQuestHost({'), 'the seam is registered where the machine lives');
  // FindQuests counts tombstoned instances (the C# default); the
  // active sweeps exclude them (GetAllActiveQuests)
  assert.match(w, /findQuests: \(name\) => \[\.\.\.questBridge\.machine\.quests\.values\(\)\]\.filter\(\(q\) => q\.questName === name\)/,
    'findQuests: name match only - no tombstone filter');
  assert.ok(w.includes('!q.questComplete && !q.questTombstoned && q.questName?.startsWith(prefix)'),
    'the P0 sweep walks ACTIVE quests only');
  assert.ok(w.includes('GUILD_GROUPS.Vampires, MEMBERSHIP_STATUS.Member'), 'the clan pool asks as a Member');
  // CurePcDisease's two racial arms finally cure through the bridge ctx
  assert.ok(w.includes('endVampirism: () =>') && w.includes('cureVampirism(playerEntity'), '`cure vampirism` cures');
  assert.ok(w.includes('endLycanthropy: () =>') && w.includes('cureLycanthropy(playerEntity'), '`cure lycanthropy` cures');
  // worldTick's two arms stand where DFU's do
  const t = read('src/systems/worldTick.js');
  const walk = t.slice(t.indexOf('REGION_CONDITIONS_INTERVAL_MINUTES === 0'));
  assert.ok(walk.includes('startRacialOverrideQuest(entity, false, { rolls })'), 'the 38-day arm');
  assert.ok(walk.includes('CURE_QUEST_INTERVAL_MINUTES === 0'), 'the 84-day arm');
});
