// WORLD6b-iii(d) (Mac, 2026-09-14: "Continue" after AUDIT WORLD6b-iii(c)): BUILDINGS' FOES - NONE, BY THE LOCKBOOK. The
// WORLD6 plan carried "a building streams no foes still (AUDIT WORLD6a B8)" as a residual. It is not a gap: a building
// interior carries NO STATIC ENEMIES in DFU (DaggerfallInterior.cs:63-70's marker vocabulary; the IF record), so the
// interior pool is a HOME for exactly three spawners - a quest's CreateFoe (Multiplayer.md's first lock: quests stay
// separate, a quest's foe is the quest owner's alone and never rides - the dungeon's own law), the Daedra summoning's
// punishment (the summoner's own trial), and the watch called into it (a crime's, the player's own - the guards
// item). Every foe a building can hold is the player's own, so the building's room streams nothing, and a frame in it
// lands nothing. These pins say so by source, so the residual cannot be re-opened as an omission.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('WORLD6b-iii(d): a building streams no foes BY THE LOCK - the interior pool has exactly three spawners (a quest\'s, the summon\'s, the watch\'s), all the player\'s own; the world host streams a world room\'s frame from the dungeon alone and lands a world room\'s frame on the dungeon alone; the record says why', () => {
  const wm = rd('src/scenes/worldModes.js');
  const sites = [...wm.matchAll(/interiorFoes\??\.spawnFoe\(/g)].length;
  assert.equal(sites, 5, `the interior pool's spawn sites: the summon's punishment (two arms), the quest's CreateFoe (two arms), the enchant replace - and nothing of a layout's (${sites})`);
  assert.match(wm, /const type = MOBILE_TYPES\[DAEDRIC_FOES\[Math\.floor\(rolls\(\) \* DAEDRIC_FOES\.length\)\]\];/, 'the summon\'s punishment');
  assert.match(wm, /interiorFoes\.spawnFoe\(foe\.foeType, /, 'the quest\'s CreateFoe');
  assert.match(wm, /return interiorFoes\.spawnFoe\(mobileType, feet, \{ replacing: true \}\);/, 'the enchant replace of one of those');
  assert.doesNotMatch(wm, /interiorFoes\.setNet\(/, 'no net is ever installed on the interior pool: nothing of it rides');
  const w = rd('src/scenes/world.js');
  assert.match(w, /const frame = cell \? \(\(modes\?\.mode \?\? 'exterior'\) === 'exterior' \? exteriorFoes\.foesFrame\(full\) : null\) : modes\?\.dungeonFoesFrame\?\.\(full\);/, 'a world room\'s frame is the dungeon\'s alone - a building\'s host streams nothing');
  assert.match(w, /if \(isCellRoom\(online\.room\)\) \{ if \(\(modes\?\.mode \?\? 'exterior'\) === 'exterior'\) exteriorFoes\.applyFoes\(id, data\); return; \}[^\n]*\n[^\n]*\n\s*modes\?\.applyDungeonFoes\?\.\(id, data\);/, 'a world room\'s frame lands on the dungeon alone - in a building it lands nothing');
  assert.match(wm, /dungeonFoesFrame\(full = false\) \{ return mode === 'dungeon' && dungeonCtx \? \(dungeonCtx\.foesFrame\?\.\(full\) \?\? null\) : null; \},/);
  assert.match(wm, /applyDungeonFoes\(id, data\) \{ return mode === 'dungeon' && dungeonCtx \? !!dungeonCtx\.applyFoes\?\.\(data, id\) : false; \},/);
  assert.match(rd('bible/04-Characters/Characters-Arc.md'), /\*\*A building interior carries NO STATIC ENEMIES in DFU\.\*\*/, 'the fact the interior pool is built on');
  assert.match(rd('bible/11-Multiplayer/Multiplayer.md'), /### 1\. Quests stay separate/, 'the lock');
  assert.match(rd('bible/06-Systems/Online-Arc.md'), /### 6b-iii\(d\): buildings' foes - none, by the lockbook/, 'the record');
});
