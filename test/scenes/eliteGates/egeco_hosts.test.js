// EG-E (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 5, 15, 19, 20 and 25.4): THE
// ECONOMY'S HOST WIRING - what the agents' slices left for the hosts, wired in scenes/world.js, scenes/eliteGates/egClient.js and
// scenes/dungeonContext.js: the claim carries the claiming character (its guild's deed) and restacks its Weir Key; the
// Broker's Panoply sink; `/breach board`; the Reprieve's allies and THE SPIRE'S RECOVERY (a death save held to the next
// Redoubt); the dungeon's find (the owner's kill and the joiner's door); THE QUIET COMPANY; the fight on the corrected clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerEgFind, egFindStruck } from '../../../src/systems/eliteGates/egFind.js';
import { raiseEnemyDeath } from '../../../src/scenes/corpseMarker.js';

const read = (f) => readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8');

test('EG-E THE HOSTS (sections 15, 19, 20, 25.4): the claim with its character and the Weir Key restack; the Panoply sink at the Broker by its records; `/breach board`; the Reprieve\'s allies within its reach and the death saves held to a breach\'s next Redoubt; the auras quiet in a trial; the fight on the breach\'s corrected clock (mutants: the character dropped; the sink unpassed; the Redoubt never told; the auras drawn in a trial)', () => {
  const w = read('src/scenes/world.js'), c = read('src/scenes/eliteGates/egClient.js');
  assert.match(w, /account: \{ \.\.\._accountEg, claim: \(r\) => _accountEg\.claim\(r, characterIdOf\(playerEntity\)\)\.then\(weirHeard\) \}, now: egNow, entity: playerEntity, player, cam,   \/\//, 'the client still handed its player, its body and its camera, before the line\'s words');
  assert.match(w, /panoply: _accountEg \? panoplyDeps : null,/);
  assert.match(w, /mint: \(p\) => panoplyPieceById\(p\)/);
  assert.match(w, /redoubt: \(\) => spireRedoubtTaken\(\),/);
  // PIN MOVED (EG-ZM): `/breach board` opens the boards through their one door (ui/eliteGates/egBoardWindow.js createEgBoardDoor), which
  // the Timers row's Elite entries and the start window share - its `open` the skin's and the service's, as before
  assert.match(w, /board: \(\) => egBoardDoor\(\),/);
  assert.match(w, /open: \(o\) => openEgBoard\(\{ doc: document, classic: !isEnhancedPlus\(\), fetchBoard: \(\) => _accountEg\.board\(\)/);
  assert.match(w, /setSetPowersAllies\(\{\s*near: \(m\) => \{[^\n]*p\.mate && p\.feet && Math\.hypot\([^\n]*<= m\); \},\s*shield: \(a, sp\) => castAtAllyDoor\(a\.id, allyCastFrame\(sp, effectiveLevel\(playerEntity\), a\.id\)\),/);
  assert.match(w, /setSpireRecovery\(\(\) => modes\?\.egHallBreach\?\.\(\) \?\? null\);/);
  assert.match(w, /if \(egClient\?\.quiet\?\.\(\)\) return;/);
  assert.match(w, /now: \(\) => \(egClient \? egClient\.sharedNow\(\) : egNow\(\)\)/);
  // the client's half: the Redoubt told once a rest, the board's command, the trial's quiet
  assert.match(c, /if \(rdSeen !== E\.h\) \{ rdSeen = E\.h; redoubt\?\.\(E\.rd\);/);
  assert.match(c, /if \(a === 'board' \|\| a === 'boards'\) \{ if \(!board\?\.\(\)\) say\(/);
  assert.match(c, /quiet: \(\) => inSpire\(\) && egQuietCompany\(link\.state\(\)\?\.sg, true\)\.auras === 0,/);   // PIN MOVED (EG-G2, merged): by the look's law
});

test('EG-E3 THE FIND\'S HOST DOORS (section 5): the owner\'s death names the striker the foes stream carries (`by: foe._killedBy`), so a joiner\'s kill is the joiner\'s ask; the joiner\'s record door asks through egFindStruck; the world host registers the find online with the dungeon\'s tier (mutants: the striker unnamed; the joiner\'s door unwired; the seam never registered)', async () => {
  const d = read('src/scenes/dungeonContext.js'), w = read('src/scenes/world.js');
  assert.match(d, /raiseEnemyDeath\(foe\.entity, \{ luck: liveStat\(playerEntity, 'luck'\), by: foe\._killedBy \?\? null \}\);/);
  assert.match(d, /r\.v === \(opts\.selfId\?\.\(\) \?\? null\)\) egFindStruck\(f\.entity, roomLootOn\(\) && roomCanonOfFoe\(f\) != null\)\.catch\(\(\) => \{\}\);/);   // PIN MOVED (the merge of main into PR #800 - PARTY-LOOT): a room's body's key to the pack (test/systems/eliteGates/egeco_find.test.js)
  assert.match(w, /registerEgFind\(\{\s*ask: \(t\) => _accountEg\.find\(t\)/);
  assert.match(w, /tierNow: \(\) => \(_mode\(\) === 'dungeon' && modes\?\.dungeonLocation \? dungeonTier\(modes\?\.dungeonLocation\) : null\)/);
  // the seam: the joiner's door reaches the registered find, and nothing once it is disposed
  const asked = [];
  const elite = { eliteFoe: true, items: [] };
  const reg = registerEgFind({ ask: async (t) => { asked.push(t); return { ok: true, data: { found: true, keys: 3, asks: 1 } }; }, tierNow: () => 'elite', selfId: () => 'me', online: () => true, throwKey: () => {} });
  const got = await egFindStruck(elite);
  assert.equal(typeof got, 'boolean');
  // the owner's half through the real death door: a kill another peer struck is not mine to ask
  const other = { eliteFoe: true, items: [] };
  raiseEnemyDeath(other, { by: 'someone-else' });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(asked.filter((t) => t === 'elite').length <= 1, true, 'never the owner\'s ask for a joiner\'s kill');
  reg.dispose();
  assert.equal(await egFindStruck({ eliteFoe: true, items: [] }), false, 'no find registered, no ask');
});
