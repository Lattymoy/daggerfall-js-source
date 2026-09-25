// DROPS-AUDIT (2026-09-25, Mac: "Audit before we merge") - the audit of the two contributor drops (EliteDungeons-and-
// more; Enhanced Plus PLUS6-PLUS8), each finding reproduced by its finder, verified against the code, and fixed here.
// SPAWN-RATE (30% + 10% where the tree had 10%) is the owner's call and is not changed; SPAWN-ROADS answers its roads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { applySpell, casterDamageScaled } from '../src/systems/effects.js';
import { expandEliteEnemies, ELITE_FLOOR_STEP } from '../src/characters/dungeonEnemies.js';
import { ENCOUNTER_CULL_DISTANCE, CAMP_CULL_DISTANCE } from '../src/scenes/exteriorFoes.js';
import { MAX_CAMP_SPAWN_DISTANCE } from '../src/systems/campEncounters.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { PLUS_FIX_CSS } from '../src/ui/enhancedPlusStyle.js';
import { CURSOR_CSS } from '../src/ui/plusCursor.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test('ELITE-SPELLS: an elite caster\'s DamageHealth lands at its damageScale, instant and per round; the player and scale-1 casters are untouched', () => {
  assert.equal(casterDamageScaled(8, { damageScale: 2 }), 16);
  assert.equal(casterDamageScaled(8, { damageScale: 2, isPlayer: true }), 8, 'the player never');
  assert.equal(casterDamageScaled(8, { damageScale: 1 }), 8);
  assert.equal(casterDamageScaled(8, null), 8, 'no caster');
  assert.equal(casterDamageScaled(0, { damageScale: 2 }), 0, 'nothing stays nothing');
  assert.equal(casterDamageScaled(1, { damageScale: 0.1 }), 1, 'the blow\'s own floor of one');
  const fireball = { element: 0, rangeType: 0,   // CasterOnly: no saving throw, so the magnitude lands whole
    effects: [{ type: 4, subType: 0, magnitudeBaseLow: 8, magnitudeBaseHigh: 8, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 }] };
  const hit = (caster) => {
    let took = 0;
    applySpell(fireball, 5, { isPlayer: true, career: {}, stats: { willpower: 50 } }, { hurt: (n) => { took += n; } }, seq(0), caster);
    return took;
  };
  const plain = hit({ entity: { level: 5 } });
  assert.ok(plain > 0);
  assert.equal(hit({ entity: { level: 5, damageScale: 2 } }), plain * 2, 'an elite Fireball hurts twice as much');
  const src = rd('src/systems/effects.js');
  assert.match(src, /const n = casterDamageScaled\(effectMagnitude\(a\.effect, a\.casterLevel, a\.saveScaled \?\? true, a\.element, a\.flag, target, rolls\), a\.caster\);/, 'and its damage over time');
});

test('ELITE-LEDGE: an elite copy stands on the marker\'s own floor - off a walkway it turns to the next bearing, and with none it stands on the marker', () => {
  const marker = { x: 0, y: 7, z: 0, mobileType: 1 };
  // a walkway running north-south: floor at 7 for |x| < 0.5, a drop to 0 either side
  const walkway = (at) => (Math.abs(at[0]) < 0.5 ? 7 : 0);
  const [, east, west] = expandEliteEnemies([marker], { floor: walkway });
  for (const c of [east, west]) {
    assert.ok(Math.abs(walkway([c.x, 7, c.z]) - 7) <= ELITE_FLOOR_STEP, `copy at ${c.x.toFixed(2)},${c.z.toFixed(2)} stays on the walkway`);
    assert.ok(Math.abs(c.z) > 0.5, 'turned a quarter onto the walkway, not stacked on the marker');
  }
  // a pillar top: no floor within a step anywhere around - both copies stand on the marker
  const pillar = (at) => (Math.hypot(at[0], at[2]) < 0.3 ? 7 : null);
  for (const c of expandEliteEnemies([marker], { floor: pillar }).slice(1)) assert.deepEqual([c.x, c.z], [0, 0]);
  // level floor everywhere: the drop's own east and west
  const [, e2, w2] = expandEliteEnemies([marker], { floor: () => 7 });
  assert.ok(e2.x > 0.8 && Math.abs(e2.z) < 1e-9 && w2.x < -0.8);
  assert.match(rd('src/scenes/dungeonContext.js'), /floor: \(at\) => \{ const d = collider\.raycast\(\[at\[0\], at\[1\] \+ 1, at\[2\]\], \[0, -1, 0\], 3\); return Number\.isFinite\(d\) \? at\[1\] \+ 1 - d : null; \},/, 'the host answers with a ray down');
});

test('CAMP-CULL and CAMP-CAP: a camp member outlives the 100-150 m band it stands in; a group stands whole or not at all under the encounter cap', () => {
  assert.ok(CAMP_CULL_DISTANCE > MAX_CAMP_SPAWN_DISTANCE + 25, 'past the band, with a margin');
  assert.ok(ENCOUNTER_CULL_DISTANCE < MAX_CAMP_SPAWN_DISTANCE, 'the finding: the encounter cull alone took most of the band');
  const foes = rd('src/scenes/exteriorFoes.js');
  assert.match(foes, /if \(!f\.placed && _playerDist > \(f\.campId != null \? CAMP_CULL_DISTANCE : ENCOUNTER_CULL_DISTANCE\) && /);
  assert.match(foes, /const encounterRoom = \(\) => MAX_ACTIVE_ENCOUNTER_FOES - activeCount\(\) - spawning\.filter\(\(s\) => s\.capped\)\.length;\n\n\s*return \{ foes, spawnFoe, damageFoe, encounterRoom,/);
  assert.match(rd('src/scenes/world.js'), /let room = exteriorFoes\.encounterRoom\?\.\(\) \?\? Infinity;\n\s*for \(const h of chunkCampHits\) \{\n(?:\s*\/\/[^\n]*\n)*\s*const size = partyGroupMembers\(h\.mobileTypes, partySize\(\)\)\.length;\n\s*if \(size > room\) continue;\n\s*room -= size;\n\s*_standCampEncounter\(h, player\.feetAt\(\)\);/, 'the room is asked for the group as it will stand - grown by the party (PSCALE1)');
});

test('F1 F3 F4: plain Enhanced keeps its own face - no loss nodes in its HUD tracks, no system dress on its Stats page, its sheet\'s rules as they were (Plus\'s edits in the Plus sheet)', () => {
  const hud = rd('src/ui/enhancedHud.js');
  assert.match(hud, /const plusLoss = isEnhancedPlus\(\);/);
  assert.match(hud, /const ghost = plusLoss \? el\('i', 'hud-ghost'\) : null;/);
  assert.match(hud, /if \(plusLoss\) \{ track\.append\(ghost, \.\.\.chunks\); armChunks\(chunks\); \}/);
  assert.match(hud, /if \(plusLoss\) \{ foeTrack\.append\(foeGhost, \.\.\.foeChunks\); armChunks\(foeChunks\); \}/);
  assert.match(rd('src/ui/enhancedMenu.js'), /const detail = el\('div', `px-qdetail\$\{isEnhancedPlus\(\) \? ' px-sys' : ''\}`\);/);
  assert.match(ENHANCED_CSS, /color: var\(--dim\); background: transparent; border: 1px solid var\(--iron\);\n\}\n\.hmpick\.on \{ color: var\(--brass\); border-color: var\(--brass\); background: #12161b; \}/);
  assert.match(ENHANCED_CSS, /\.trade-shell \.packcol \{ padding: 0 2px 18px; overflow-y: auto; min-height: 0; \}/);
  assert.doesNotMatch(ENHANCED_CSS, /\.trade-shell \.remotehead \{/);
  assert.match(ENHANCED_CSS, /border: 1px solid rgba\(125,116,96,0\.4\); border-radius: 2px; flex: 0 0 auto; \}/);
  assert.match(PLUS_FIX_CSS, /\.hmpick\.on \{ color: #f3cf86;/);
  assert.match(PLUS_FIX_CSS, /\.trade-shell \.remotehead \{ border-bottom: 2px solid/);
});

test('F2 F5 F6 F9 F10 F11: one press per dialog or list; Escape puts the menu away, not the pack; a notice takes the first click; the card and the menu answer only their own item and gesture; a ported window paints no preview', () => {
  assert.match(rd('src/ui/enhancedDialog.js'), /if \(!active \|\| active\.spent\) return; active\.spent = true; press\(b\.button\); closeEnhancedDialog\(\);/);
  const picker = rd('src/ui/enhancedPicker.js');
  assert.match(picker, /if \(!active \|\| active\.spent\) return; active\.spent = true; pickRow\(active, i, geo\); closeEnhancedPicker\(\);/);
  assert.match(picker, /if \(!active \|\| active\.spent\) return; active\.spent = true; replayClick\(active\.canvas, active\.m, 1, 1\); closeEnhancedPicker\(\);/);
  const inv = rd('src/ui/enhancedInventory.js');
  assert.match(inv, /function onKey\(e\) \{[\s\S]{0,400}?if \(menuEl && e\.key === 'Escape'\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); closeMenu\(\); return; \}/, 'before anything else the pack does with the key');
  assert.match(inv, /\(\) => \{ if \(tipEl && tipFor === item\) showTip\(item, from, row\); \}/);
  assert.match(inv, /function hideTip\(\) \{ tipEl\?\.remove\(\); tipEl = null; tipFor = null; \}/);
  assert.match(inv, /row\.oncontextmenu = \(e\) => \{ e\.preventDefault\(\); if \(drag\) return; openMenu\(/);
  const port = rd('src/ui/enhancedPort.js');
  assert.match(port, /if \(win\.box && !win\.box\.buttons\?\.length && !win\.picker\) \{ win\.click\?\.\(-1, -1\); return; \}\n\s*if \(!b \|\| b\.disabled\) return;/);
  assert.match(port, /win\.inPort = true;\n\s*const proxy = new Proxy\(win, \{/);
  assert.match(rd('src/ui/bankPurchaseWindow.js'), /if \(modelIdNum != null && !this\.inPort\) \{/);
});

test('F7 F8: the gauntlet stands down where a controller hid the pointer; the bank\'s Cancel no longer names a key that closes the bank', () => {
  assert.match(CURSOR_CSS, /html:not\(\.plus-nocursor\) canvas\[style\*="cursor: none"\] \{ cursor: none !important; \}/);
  assert.match(rd('src/ui/enhancedPorts.js'), /\{ label: 'Cancel', act: \(\) => \{ w\.transactionType = TRANSACTION_TYPE\.None; w\.value = ''; \} \}\]/);
});
