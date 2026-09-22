// AUDIT FOES (2026-09-15) - "during online play, certain enemies cant be
// damaged", Mac, relaying players. Three adversarial lenses over the foe
// damage path. FOE1 (the comment that ate the hit) is pinned where it broke,
// in test/audit39_worldmodes.test.js; FOE2 (a refused blow waits) in
// test/foe2_hitpend.test.js, driven; FOE3 (the halo is a way out) in
// test/world6biiib.test.js, driven. What is left is the dungeon host, which
// is pinned by SOURCE here as every other law of that file is - it cannot be
// mounted in node - with the comments stripped first, because FOE1 was a
// property hiding inside a comment and a raw text match is what missed it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PIXEL_UNITS } from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** The file's CODE - a law inside a comment is not a law (FOE1). */
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

// FOE4. The divert was gated on `!foe._pupMismatch` under B5's reading, "its
// index is another foe's on the host" - and WORLD3 retired that premise: the
// roster is the ROOM'S and the index names the same marker on every client.
// (Driven by the lens: the layout's foe COUNT never varies with player level;
// only the SPECIES the level bands does.) What stands at `i` is the host's foe
// at `i`, posed by its stream and carrying its health, wearing the wrong body
// until the rebuild lands - so a blow at it is a blow at that foe.
//
// Held home it was not a late blow, it was NO blow: that arm applies nothing
// locally. And the mismatch is the NORM on a join, not an edge - two players'
// random flats band on their own level, so a level-3 and a level-14 character
// disagree at 758 of 760 markers - so every index depended on an async,
// fallible rebuild clearing the flag, and any rebuild that refused left that
// foe invulnerable to that client for the life of the context.
test('AUDIT FOES FOE4: a blow goes while my BODY is wrong - the mismatch stops the puppet looking right, never the blow landing', () => {
  const d = code('src/scenes/dungeonContext.js');
  assert.match(d, /if \(fromPlayer && damage >= 0\) opts\.onFoeHit\?\.\(\{ i: pi, dmg: damage, kind,/,
    'the divert asks the provenance and the sign, and nothing about the body');
  assert.doesNotMatch(d, /!foe\._pupMismatch\) opts\.onFoeHit/,
    'the retired gate is gone, not merely joined by an OR');
  // the flag still exists and still means "my body is wrong, a rebuild is owed"
  assert.match(d, /f\._pupMismatch = true;/, 'the mismatch is still recorded');
  assert.match(d, /f\._pupMismatch = false;/, 'and cleared by a record that agrees');
});

// FOE4b. A refusal (a texture or a career read that fails on this machine
// alone, a species no art can stand) left the flag set and the host kept
// re-offering the index - a FULL frame carries every layout foe every
// FOES_FULL_MS - so a failing index asked for a fresh build for ever, several
// times a second, for the life of the dungeon.
test('AUDIT FOES FOE4: the rebuild is BOUNDED - a build that cannot succeed on this client stops being asked, and says so once', () => {
  const d = code('src/scenes/dungeonContext.js');
  assert.match(d, /const _retypeFails = new Map\(\);/, 'the refusals are counted per index');
  assert.match(d, /const RETYPE_TRIES = \d+;/);
  const tries = Number(/const RETYPE_TRIES = (\d+);/.exec(d)?.[1]);
  assert.ok(tries >= 1 && tries <= 10, `a few tries, not one and not for ever (read ${tries})`);
  assert.match(d, /const tries = \(_retypeFails\.get\(i\) \?\? 0\);\s*if \(tries < RETYPE_TRIES\) \{/,
    'the rebuild is asked only while it is under the bound');
  assert.match(d, /if \(ok\) \{ _retypeFails\.delete\(i\); if \(!_authority && foes\[i\]\) applyFoeRecord\(foes\[i\], r\); return; \}/,
    'a rebuild that lands clears the count AND still lands its record (AUDIT WORLD3 E2)');
  assert.match(d, /if \(n === RETYPE_TRIES\) console\.warn\(/, 'and the giving-up is said once, not every frame');
});

// FOE5. The host TRUSTS the number - it never recomputes, because the
// striker's own calc is the game's - so an unbounded one let any joiner
// one-shot every foe in the room and empty it through the kill door. The
// exterior twin has carried this bound since WORLD6b; the dungeon had none.
test('AUDIT FOES FOE5: both pools bound the damage a peer may claim, and to the same number', () => {
  const d = code('src/scenes/dungeonContext.js');
  const x = code('src/scenes/exteriorFoes.js');
  assert.match(d, /!Number\.isFinite\(dmg\) \|\| dmg < 0 \|\| dmg > HIT_DMG_MAX\) return false;/,
    'the dungeon host refuses a blow past the bound');
  const dungeon = Number(/const HIT_DMG_MAX = (\d+);/.exec(d)?.[1]);
  const exterior = Number(/dmg > (\d+)\) return false;/.exec(x)?.[1]);
  assert.ok(Number.isFinite(dungeon) && dungeon > 0, `the dungeon names a bound (read ${dungeon})`);
  assert.equal(dungeon, exterior,
    `the two pools bound a peer's word alike - dungeon ${dungeon}, exterior ${exterior}`);
  // and it is past anything a legal blow can roll, so no real fight meets it
  assert.ok(dungeon >= 5000, 'a legal swing, shaft or blast never reaches it');
});

// FOE6/FOE8/FOE9 - the cell pool's three, and the dungeon's orphan.
test('AUDIT FOES FOE6: a puppet is removed from the index by IDENTITY, never by key - a stale build cannot evict the live record', () => {
  const x = code('src/scenes/exteriorFoes.js');
  assert.match(x, /if \(_pupIndex\.get\(pupKey\(f\.puppet, f\.seq\)\) === f\) _pupIndex\.delete\(pupKey\(f\.puppet, f\.seq\)\);/,
    'the key is deleted only while it still names THIS record');
  assert.doesNotMatch(x, /^\s*_pupIndex\.delete\(pupKey\(f\.puppet, f\.seq\)\);\s*$/m,
    'the bare delete is gone - it orphaned a puppet that every sweep then walked past');
  // and every sweep really does walk the index alone, which is what made an orphan permanent
  for (const sweep of [/for \(const f of \[\.\.\._pupIndex\.values\(\)\]\)/]) assert.match(x, sweep, 'the sweeps walk _pupIndex');
});

test('AUDIT FOES FOE8: a class puppet is judged against the level it was BUILT at, not the one its constructor rolled', () => {
  const x = code('src/scenes/exteriorFoes.js');
  const e = code('src/characters/enemyEntity.js');
  // the re-roll that made the equality test a lie, still there and still DFU's
  assert.match(e, /if \(mobileType === KNIGHT_CITYWATCH_ID && !exactLevel\) level \+= 3 \+ Math\.floor\(rollFn\(\) \* 4\);/,   // AUDIT WATCH1 A5: a puppet hands the streamed level in as final
    'DFU adds Range(3,7) to a City Watch inside the constructor');
  assert.match(x, /f\.builtLevel = builtLevel;/, 'the build level is kept on the record');
  assert.match(x, /r\.l !== \(f\.builtLevel \| 0\)/, 'and the stream is compared against it');
  assert.doesNotMatch(x, /r\.l !== \(f\.entity\.level \| 0\)/,
    'never against entity.level - a City Watch never equals it, so every record tore the puppet down and rebuilt it');
});

test('AUDIT FOES FOE9: a blow on a record the pool no longer holds is dropped, never spent on a ghost', () => {
  const d = code('src/scenes/dungeonContext.js');
  assert.match(d, /const pi = foes\.indexOf\(foe\);\s*if \(pi < 0\) return;\s*if \(pi < _layoutFoes\) \{/,
    'an orphan takes no blow, and the layout test no longer has to re-check the sign');
});

// AUDIT FOES FOE10 (2026-09-15, Mac: "I think another session broke other
// players being able to attack enemies") - THE BLOW CROSSES, END TO END.
//
// AUDIT WORLD34 A1 drove two real sessions through the real relay Room and
// held that the host's FOES fan to the joiner and the joiner's ACT fans back.
// It never drove the one frame this report is about. A blow is the only thing
// a joiner cannot do for itself - it applies no local damage at all - so the
// hit frame is the single point of failure for "other players can attack
// enemies", and it was the one frame with no end-to-end pin over it.
//
// This drives it: a joiner's blow leaves its socket, is routed by the relay to
// the HOST alone, and arrives at the host's onHit with the striker named and
// the payload whole - and no one else hears it.
const at = (px, pz) => ({ x: px * PIXEL_UNITS + 10, y: 0, z: pz * PIXEL_UNITS + 10, yaw: 0, pitch: 0, mv: 0 });
const quiet = (fn) => { const i = console.info, w = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = i; console.warn = w; } };

test('AUDIT FOES FOE10: a joiner\'s blow crosses the real relay to the host, and to the host alone', async () => {
  const key = 'dungeon:m187853213';   // Privateer's Hold, the id AUDIT WORLD34 A1 drives the same rig on
  const r = fakeRoom(key);
  await r.signer();   // ACC1g: the keypair before the clock starts - a hello mints a real token now
  const link = (id) => {
    const { FakeWS, sockets } = fakeSocketClass();
    const s = new OnlineSession({ url: 'wss://relay.test', name: id, id, secret: `secret-of-${id}`, WebSocketImpl: FakeWS, now: () => Date.now(), mintToken: () => r.token(id) });   // ACC1g: the relay refuses a hello it cannot verify, so this rig mints for real
    const hits = [];
    s.onHit = (from, data) => hits.push([from, data]);
    quiet(() => s.join(key, at(1, 1)));
    const ws = sockets[0]; const server = r.connect();
    ws.send = (str) => r.raw(server, str); server.send = (str) => ws.receive(str);
    ws.open();
    return { s, hits };
  };
  const host = link('aaaa-0001'); await new Promise((f) => setTimeout(f, 25));
  const joiner = link('bbbb-0002'); await new Promise((f) => setTimeout(f, 25));
  const bystander = link('cccc-0003'); await new Promise((f) => setTimeout(f, 25));
  assert.equal(host.s.isHost(), true, 'the first socket holds the seat');
  assert.equal(joiner.s.host, 'aaaa-0001', 'and the joiner is told who to strike through');

  const blow = { i: 7, dmg: 12, kind: 'melee', p: [1, 2, 3], d: [0, 0, 1] };
  assert.equal(joiner.s.sendHit(blow), true, 'the blow leaves the joiner');
  await new Promise((f) => setTimeout(f, 25));

  assert.equal(host.hits.length, 1, 'THE WHOLE REPORT: the host hears the blow');
  assert.deepEqual(host.hits[0], ['bbbb-0002', blow], 'with the striker named and the payload whole');
  assert.equal(bystander.hits.length, 0, 'and nobody else does - a hit is routed, never fanned');
  assert.equal(joiner.hits.length, 0, 'least of all its striker');

  // ...and the host's own blows are its own door's, never the wire's
  assert.equal(host.s.sendHit(blow), false, 'the host applies its own');
});
