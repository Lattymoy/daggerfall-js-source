// MWNPC CENSUS (2026-10-10, the MW-NPC arc's audit - bible/04-Characters/Morrowind-NPCs.md section 21; the old arc's
// lesson NPC4b, section 5: "a gate test enumerates every host that draws living actors"). EVERY SOURCE THAT DRAWS A
// LIVING ACTOR'S SPRITE - a mobile's eight-way unit, a walker, a mobile billboard sized off its record - either stands
// it in a Morrowind body (one of the arc's adapters, named in the file) or is DECLARED here with the reason it keeps its
// sprite. A new population drawn without either fails here, not in the field.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;
const walk = (dir) => readdirSync(join(ROOT, dir)).flatMap((n) => {
  const p = `${dir}/${n}`;
  return statSync(join(ROOT, p)).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
});
/** what marks a source as drawing a living actor's sprite */
const DRAWS = /new MobileUnit\(|new MobilePerson\(|new ResidentWalker\(|mobileBillboardSize\(/;
/** the arc's adapters - a source naming one stands its actors in bodies */
const BODIES = /createPopulationLane\(|createHostNpcBodies\(|foeActor\(|folkActor\(|personActor\(|rosterActor\(|new PeerBodies\(/;

/** WIRED: the source stands its actors itself (through BODIES). */
const WIRED = Object.freeze([
  'src/scenes/cityGuards.js',      // MWNPC6: the watch
  'src/scenes/dungeonContext.js',  // MWNPC5b, 8b: the dungeon's foes and people
  'src/scenes/exterior.js',        // MWNPC5c, 8c: the standalone location's foes and people
  'src/scenes/exteriorFoes.js',    // MWNPC5c: the encounter pool (both instances)
  'src/scenes/gateCourt.js',       // MWNPC10a: the gate's boss
  'src/scenes/gateHost.js',        // MWNPC10a: his host
  'src/scenes/navalCrew.js',       // MWNPC10b: the crews
  'src/scenes/siegeNpcs.js',       // MWNPC10b: the siege
  'src/scenes/world.js',           // MWNPC7: the street's walkers (and the peers' PeerBodies)
  'src/world/travellerSprites.js', // MWNPC10c: the roads' parties and the rooms' residents
]);
/** DECLARED: the source draws a living actor's sprite and keeps it - each with its reason. */
const DECLARED = Object.freeze({
  'src/net/remotePlayers.js': 'the peers\' own fallback picture (a doll or a class sprite) - a peer stands in net/peerBodies.js, built by world.js',
  'src/scenes/sigilBrokerPool.js': 'the Daedra Seducer in her MORTAL GUISE - the match would stand the winged twilight she is hiding (section 15a)',
  'src/world/bandSprites.js': 'the Overworld\'s far bands - grown, fading sprites at the map\'s distance; their people stand in bodies on the ground (section 15c)',
  'src/characters/enemyAnchor.js': 'a size for a foe\'s anchor - it draws nothing',
  'src/world/rmbFlats.js': 'mobileBillboardSize\'s own home - it draws nothing',
  'src/characters/residentWalker.js': 'the walker itself - its hosts draw it (world.js, travellerSprites.js)',
});

test('MWNPC-CENSUS every source that draws a living actor\'s sprite stands it in a body or is declared with its reason', () => {
  const drawing = walk('src').filter((p) => DRAWS.test(readFileSync(join(ROOT, p), 'utf8'))).sort();
  const known = new Set([...WIRED, ...Object.keys(DECLARED)]);
  const unknown = drawing.filter((p) => !known.has(p));
  assert.deepEqual(unknown, [], 'a new host draws living actors: wire it to a body lane, or declare why it keeps its sprite');
  for (const p of WIRED) {
    assert.ok(drawing.includes(p), `${p} no longer draws a living actor - take it off the census`);
    assert.match(readFileSync(join(ROOT, p), 'utf8'), BODIES, `${p} is wired: it names one of the arc's adapters`);
  }
  for (const [p, why] of Object.entries(DECLARED)) {
    assert.ok(drawing.includes(p), `${p} no longer draws a living actor - take it off the census`);
    assert.ok(why.length > 20, `${p}: the reason it keeps its sprite`);
  }
});
