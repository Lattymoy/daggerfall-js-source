// WORLD8 (Mac, 2026-09-14: "I would like dungeons and the world to respawn every hour", a real hour): THE HOUR'S RESPAWN.
// A dungeon's memory (WORLD1) kept its dead foes dead and its emptied containers empty for as long as the relay
// remembered the room - thirty days after it last drained. Now every death and every take carries a stamp (the
// relay's clock, a wall millisecond - the shared clock's own reading), and an hour past it the thing is DUE BACK:
//  - a layout foe dead past the hour is REBUILT fresh at its marker by the host through the one build chain
//    (retypeFoe as its own species: a new entity at full health with its own loot roll; the old record dead to
//    everything holding it, its corpse flat freed, its body's loot record forgotten) - the stream then says the index
//    is alive and every puppet stands up through WORLD2's un-death door; a memory that arrives with such a record
//    skips it whole (a fresh build stands, a live dead one is rebuilt);
//  - a container the room emptied past the hour is this client's own roll again: the memory's record is not applied,
//    the room's word about it forgotten, a treasure pile rolled afresh (one home with the build's roll);
//  - the sweep runs once a second on every client (the loot) and on the host (the foes); offline the clock answers
//    null and nothing is due - a save keeps its dead, DFU's own; a memory written before WORLD8 carries no stamp
//    and is applied as it stands.
// The country's foes are rolls (DFU's encounter law, by the world clock) and need no respawn; a building's shelves
// restock by the day, DFU's own, unchanged. The relay is untouched: the memory is bytes to it.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RESPAWN_MS, respawnDue, WORLD_TTL_MS } from '../src/net/wire.js';
import * as relay from '../server/src/relay.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('WORLD8: the wire - the hour, and what is due: a stamp an hour or more before now; not a missing stamp, not without a clock, not a stamp ahead, not a minute short; one home at both ends; the memory\'s thirty days stand above it', () => {
  assert.equal(RESPAWN_MS, 3600 * 1000, 'a real hour');
  const t = 1_789_400_000_000;
  assert.equal(respawnDue(t, t + RESPAWN_MS), true); assert.equal(respawnDue(t, t + RESPAWN_MS * 30), true);
  assert.equal(respawnDue(t, t + RESPAWN_MS - 1), false, 'a millisecond short');
  assert.equal(respawnDue(t + 5, t), false, 'a stamp ahead');
  for (const s of [null, undefined, NaN, '1789400000000', Infinity]) assert.equal(respawnDue(s, t + RESPAWN_MS * 2), false, `no stamp: ${String(s)}`);
  for (const n of [null, undefined, NaN]) assert.equal(respawnDue(t, n), false, `no clock: ${String(n)}`);
  assert.equal(relay.RESPAWN_MS, RESPAWN_MS); assert.equal(relay.respawnDue, respawnDue);
  assert.ok(WORLD_TTL_MS > RESPAWN_MS, 'a memory forgotten after thirty days empty has long since respawned whole - the sweep stands');
});

test('WORLD8: the dungeon by source - the stamp at the corpse door and in the record, kept from the room\'s record; the memory\'s dead-past-the-hour skipped whole and a live dead one rebuilt; respawnFoe through the one build chain with the corpse freed and the body\'s loot forgotten; the sweep once a second (the host\'s foes, everyone\'s loot); the loot stamps on the claim, the record and the apply; the pile roll one home', () => {
  const d = rd('src/scenes/dungeonContext.js');
  assert.match(d, /import \{ mintSharedStamp, hitPoisonOf, HIT_ARROWS_MAX, respawnDue \} from '\.\.\/net\/wire\.js';/);
  assert.match(d, /import \{ worldMinutes, setWorldMinutes, sharedWallMs, sharedClockOn \} from '\.\.\/systems\/worldTick\.js';/);
  assert.match(d, /const _wallNow = \(\) => \(sharedClockOn\(\) \? sharedWallMs\(worldMinutes\(\)\) : null\);/, 'the relay\'s clock, null offline');
  assert.match(d, /async function spawnCorpse\(f\) \{\s*\n\s*if \(f\._diedAt == null\) f\._diedAt = _wallNow\(\);/, 'the death\'s stamp at the one corpse door');
  assert.match(d, /died: f\.dead && Number\.isFinite\(f\._diedAt\) \? f\._diedAt : null,/, 'the record carries it');
  assert.match(d, /if \(sf\.dead && Number\.isFinite\(sf\.died\)\) f\._diedAt = sf\.died;[^\n]*\n\s*if \(sf\.dead && !f\.dead\) setFoeDead\(f, true\);/, 'patchFoe keeps the room\'s stamp');
  assert.match(d, /const _now = _wallNow\(\);\s*\n\s*w\.foes\?\.forEach\(\(sf, i\) => \{\s*\n\s*const f = foes\[i\];\s*\n\s*if \(!f\) return;\s*\n(?:\s*\/\/[^\n]*\n)*\s*if \(wire && sf\.dead && respawnDue\(sf\.died, _now\)\) \{ if \(f\.dead\) respawnFoe\(i\); return; \}/, 'the memory\'s arm, on the wire alone');
  assert.match(d, /function respawnFoe\(i\) \{\s*\n\s*const f = foes\[i\];\s*\n\s*if \(!f \|\| !f\.dead \|\| i >= _layoutFoes\) return false;\s*\n\s*freeCorpse\(f\);\s*\n\s*f\._diedAt = null;\s*\n\s*_lootSeen\.delete\(`corpse:\$\{i\}`\); _lootAt\.delete\(`corpse:\$\{i\}`\);\s*\n\s*return retypeFoe\(i, f\.mobileType, f\.gender \?\? null\);/, 'the rebuild through the one chain');
  assert.match(d, /function respawnSweep\(nowSeconds\) \{\s*\n\s*if \(nowSeconds - _respawnSweptAt < 1\) return;[\s\S]{0,400}if \(_authority\) for \(let i = 0; i < Math\.min\(_layoutFoes, foes\.length\); i\+\+\) \{ const f = foes\[i\]; if \(f\?\.dead && respawnDue\(f\._diedAt, now\)\) respawnFoe\(i\); \}/, 'the host\'s foes');
  assert.match(d, /for \(const canon of \[\.\.\._lootSeen\]\) \{\s*\n\s*if \(!respawnDue\(_lootAt\.get\(canon\), now\)\) continue;\s*\n\s*_lootSeen\.delete\(canon\); _lootAt\.delete\(canon\);\s*\n\s*if \(canon === _lootOpenKey\) continue;[^\n]*\n\s*if \(canon\.startsWith\('loot:'\)\) \{ const i = Number\(canon\.slice\(5\)\); const p = lootPiles\[i\]; if \(p && Array\.isArray\(p\.items\)\) \{ p\.items = rollPileItems\(\); settleLootFlat\(i\); \} \}/, 'everyone\'s loot: forgotten and the pile rolled again, an open window kept');
  assert.match(d, /_ecvT \+= dt;\s*\n\s*respawnSweep\(_ecvT\);/, 'once a second in the foe pass');
  assert.match(d, /const _t = _wallNow\(\); if \(_t != null\) _lootAt\.set\(canon, _t\);/, 'the claim stamps');
  assert.match(d, /out\.push\(\{ k: canon, r: held\.map\(\(it\) => \(\{ \.\.\.it \}\)\), \.\.\.\(Number\.isFinite\(_lootAt\.get\(canon\)\) \? \{ t: _lootAt\.get\(canon\) \} : \{\}\) \}\);/, 'the record carries the stamp');
  assert.match(d, /if \(respawnDue\(rec\.t, _now\)\) continue;[^\n]*\n\s*_lootSeen\.add\(canon\);[^\n]*\n\s*\{ const _t = Number\.isFinite\(rec\.t\) \? rec\.t : _now; if \(_t != null\) _lootAt\.set\(canon, _t\); \}/, 'the apply: due back is not applied; the room\'s stamp kept, or now');
  assert.match(d, /function rollPileItems\(\) \{\s*\n\s*const items = generateLootItems\(lootKey, \{ level: playerEntity\.level, gender: playerEntity\.gender \}\);\s*\n\s*addPileLootExtras\(items, lootKey\);\s*\n\s*rollLootRarity\(items, pileSource\(dungeonRarityTier\(dfLocation\.mapTableData\.dungeonType\)\), \{ luck: liveStat\(playerEntity, 'luck'\) \}\);\s*\n\s*return items;/, 'the pile roll, one home');
  assert.equal((d.match(/rollPileItems\(\)/g) ?? []).length, 3, 'declared, the build, the respawn');
  assert.match(d, /f\.dead = false;\s*\n\s*f\._diedAt = null;   \/\/ WORLD8\s*\n\s*freeCorpse\(f\);/, 'un-death clears the stamp and frees the corpse through the one helper');
  assert.equal(rd('src/scenes/exteriorFoes.js').includes('respawnDue'), false, 'the country\'s foes are rolls - no respawn law');
});
