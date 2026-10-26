// GRANT1 (2026-10-18, Mac: "Lets build the plan"; bible/11-Multiplayer/Spawn-Grants.md sections 4 and 7): THE SPAWN
// GRANT'S LAW, PURE (net/grantLaw.js) - its pinned rates held to their homes, the grant read whole or not at all, the
// relay's signature over every field, the marks rolled from the seed alone, one stream per die, the mint's gate in its
// order, and the reader's check past the signature. Nothing calls it yet (GRANT2, GRANT3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GRANT_SIG_V, GRANT_TTL_MS, GRANT_SKEW_MS, GRANT_ELITE_CHANCE, GRANT_ELITE_MIN_RENOWN, GRANT_CHAMPION_PER_MILLE, GRANT_CHAMPION_TRAITS,
  GRANT_KINDS, GRANT_CELL_CEILING, GRANT_REFUSALS, GRANT_DICE,
  grantRng, grantDice, grantMarks, validGrant, grantBytes, signGrant, verifyGrant, grantMintGate, grantRefusal, grantMarksAllow,
  STAR_GRANT_RELAY_MIN, relaySupportsStarGrant,
} from '../../src/net/grantLaw.js';
import { ELITE_FOE_OVERWORLD_CHANCE, ELITE_FOE_MIN_RENOWN, eliteRng, eliteHash } from '../../src/systems/eliteFoes.js';
import { CHAMPION_PER_MILLE, CHAMPION_TRAITS } from '../../src/systems/champions.js';
import { ROAD_PARTY_MAX } from '../../src/systems/roadEncounters.js';
import { CAMP_SIZE } from '../../src/systems/campEncounters.js';
import { PARTY_SCALE_EXTRA_MAX } from '../../src/systems/party/partyScale.js';
import { chooseRandomEnemy } from '../../src/systems/encounters.js';
import { signEgCall } from '../../src/net/eliteGates/egCallSig.js';
import { STAR_WAVE_MAX } from '../../src/net/starfall/starfallLaw.js';
import { RELAY_VERSION } from '../../src/net/wire.js';

const { subtle } = globalThis.crypto;
const T0 = 1_800_000_000_000;
/** A grant as the relay would mint it: an encounter of three for acct-mac's socket in a wilderness cell. */
const G = Object.freeze({ g: 41, o: 'sock-mac-01', q: 'w:300:200', a: 'acct-mac', k: 'enc', p: [300, 200], m: 2_345_678, l: 12, r: 7, n: 3, s: 0xdeadbeef, e: 0b010, c: [3, -1, -1], h: -1, x: T0 + GRANT_TTL_MS });

test('GRANT1 THE PINNED RATES: each copy the relay holds equals its home - the elite\'s chance and Renown, the champion\'s rate and its traits, each kind\'s most members; the seeded stream is eliteRng over eliteHash, the same law (mutants: any rate moved; the stream\'s hash salted otherwise)', () => {
  assert.equal(GRANT_ELITE_CHANCE, ELITE_FOE_OVERWORLD_CHANCE);
  assert.equal(GRANT_ELITE_MIN_RENOWN, ELITE_FOE_MIN_RENOWN);
  assert.equal(GRANT_CHAMPION_PER_MILLE, CHAMPION_PER_MILLE);
  assert.equal(GRANT_CHAMPION_TRAITS, CHAMPION_TRAITS.length);
  assert.equal(GRANT_KINDS.enc.max, ROAD_PARTY_MAX, 'an encounter: the road party\'s most, its party\'s extra inside it');
  assert.equal(GRANT_KINDS.camp.max, CAMP_SIZE[1] + PARTY_SCALE_EXTRA_MAX, 'a camp: its own most and the party\'s extra');
  assert.equal(GRANT_KINDS.star.max, STAR_WAVE_MAX, 'STAR-TUNE: a fallen star\'s coven - its law\'s largest wave, one grant');
  assert.equal(STAR_GRANT_RELAY_MIN, 238, 'AUDIT STAR-TUNE F1: the relay that mints the star\'s kind is STAR-TUNE\'s');
  // AUDIT (the desync branch's integration lane): the gate names a VERSION, and a renumber at a merge moves RELAY_VERSION,
  // its law row and its pins - never this. Held to the release it names: the law row of world<STAR_GRANT_RELAY_MIN> is
  // STAR-TUNE's (test/net/relayversion.test.js), and no later than the relay this tree builds. A merge that renumbers
  // STAR-TUNE past another release fails here until the gate moves with it.
  const lawRow = readFileSync(new URL('./relayversion.test.js', import.meta.url), 'utf8').split('\n').find((l) => l.trimStart().startsWith(`world${STAR_GRANT_RELAY_MIN}: '`));
  assert.ok(lawRow && lawRow.includes('STAR-TUNE'), `world${STAR_GRANT_RELAY_MIN}'s law row is STAR-TUNE's (${lawRow?.slice(0, 120)})`);
  assert.ok(STAR_GRANT_RELAY_MIN <= Number(RELAY_VERSION.slice('world'.length)), 'the gate is no later than the relay this tree builds');
  assert.deepEqual(['world237', 'world238', 'world300', 'nope', undefined].map(relaySupportsStarGrant), [false, true, true, false, false], 'an older relay is asked the stand\'s own kind');
  assert.deepEqual(Object.keys(GRANT_KINDS).slice(0, 2), ['enc', 'camp'], 'GRANT2\'s first stream; the other sources\' with GRANT4 (grant3_pool)');   // PIN MOVED (GRANT4): every source's kind
  for (const [s, salt] of [[0, 'marks'], [0xdeadbeef, 'species:2'], [12345, 'health:0']]) {
    const a = grantRng(s, salt), b = eliteRng(eliteHash('grant', s, salt));
    assert.deepEqual(Array.from({ length: 6 }, a), Array.from({ length: 6 }, b), `${s} ${salt}`);
  }
  assert.equal(GRANT_TTL_MS, 600_000);
  assert.equal(GRANT_SKEW_MS, 60_000);
  assert.deepEqual(GRANT_DICE, ['species', 'level', 'weapon', 'health']);
  assert.deepEqual(GRANT_REFUSALS, ['kind', 'size', 'bucket', 'ceiling', 'unsigned', 'sender', 'cell', 'expired', 'member', 'marks']);
  const src = readFileSync(new URL('../../src/net/grantLaw.js', import.meta.url), 'utf8');
  assert.deepEqual([...src.matchAll(/^import .* from '([^']+)';/gm)].map((m) => m[1]), ['./identityToken.js', './cellTree.js', './wire.js'], 'the relay imports it: nothing that reaches the loot tables');   // PIN MOVED (COST-2): and the cell tree's law (a grant stands in any cell its reader's socket covers), which imports wire.js alone
});

test('GRANT1 A GRANT READ WHOLE OR NOT AT ALL: every field in its law, a fresh copy back; an unknown kind, a size past its kind, an elite that is also a champion, a mark past the members, a bad pixel, a level or Renown no token carries, a bad signature\'s shape - each refused (mutants: the kind\'s most ignored; an elite champion believed; the guest\'s 0 refused)', () => {
  const v = validGrant(G);
  assert.deepEqual(v, G);
  assert.notEqual(v, G);
  assert.notEqual(v.c, G.c, 'its own `c`');
  assert.deepEqual(validGrant({ ...G, a: '', l: 0, r: 0 }), { ...G, a: '', l: 0, r: 0 }, 'a guest: no account, no signed level or Renown');
  const sg = 'A'.repeat(86);
  assert.equal(validGrant({ ...G, sg }).sg, sg);
  for (const [why, bad] of [
    ['an unknown kind', { k: 'raid' }], ['an inherited name', { k: 'toString' }], ['no members', { n: 0, e: 0, c: [] }],
    ['past its kind', { n: 5, e: 0, c: [-1, -1, -1, -1, -1] }], ['a camp past its own', { k: 'camp', n: 9, e: 0, c: Array(9).fill(-1) }],
    ['an elite champion', { c: [3, 2, -1] }], ['an elite past the members', { e: 0b1000 }], ['c short', { c: [3, -1] }],
    ['a trait past the list', { c: [5, -1, -1] }], ['a trait below none', { c: [-2, -1, -1] }],
    ['a pixel off the map', { p: [1000, 200] }], ['a pixel short', { p: [300] }], ['a level no token carries', { l: 1001 }],
    ['a Renown no token carries', { r: 51 }], ['a seed past 32 bits', { s: 2 ** 32 }], ['a negative minute', { m: -1 }],
    ['no expiry', { x: 0 }], ['a socket id of bad shape', { o: 'a b' }], ['an account of bad shape', { a: 'x' }],
    ['a room of bad shape', { q: 'w/300' }], ['a number past 31 bits', { g: 2 ** 31 }], ['a signature of bad shape', { sg: 'short' }],
    ['GRANT3: a handed member past the grant', { h: 3 }], ['GRANT3: no `h` at all', { h: undefined }],
  ]) assert.equal(validGrant({ ...G, ...bad }), null, why);
  assert.equal(validGrant(null), null);
  assert.equal(validGrant('grant'), null);
});

test('GRANT1 THE RELAY\'S SIGNATURE: every field signed in one fixed order behind its own version, verified with the public half; any field moved, another key, no signature or no key refused; a grant\'s bytes are no arch call\'s (mutants: a field left out of the bytes; any signature taken)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const other = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  assert.equal(grantBytes(G), `${GRANT_SIG_V}\n41|sock-mac-01|w:300:200|acct-mac|enc|300,200|2345678|12|7|3|3735928559|2|3,-1,-1|-1|${T0 + GRANT_TTL_MS}`);   // GRANT3: `h` signed beside the marks
  assert.ok(grantBytes(G).startsWith('spawn-grant1\n'), 'the version Spawn-Grants section 4.2 names');
  const sg = await signGrant(G, kp.privateKey, { subtle });
  assert.match(sg, /^[A-Za-z0-9_-]{86}$/);
  assert.equal(await verifyGrant({ ...G, sg }, kp.publicKey, { subtle }), true);
  for (const [f, val] of [['g', 42], ['o', 'sock-ann-01'], ['q', 'w:301:200'], ['a', 'acct-ann'], ['k', 'camp'], ['p', [301, 200]], ['m', 2_345_679], ['l', 13], ['r', 8], ['n', 2], ['s', 1], ['e', 0], ['c', [3, -1, 0]], ['h', 2], ['x', T0 + GRANT_TTL_MS + 1]]) {
    const moved = { ...G, [f]: val, sg };
    if (f === 'n') moved.c = [3, -1];
    if (f === 'e') moved.c = [3, -1, -1];
    assert.equal(await verifyGrant(moved, kp.publicKey, { subtle }), false, `\`${f}\` moved`);
  }
  assert.equal(await verifyGrant({ ...G, sg: await signGrant(G, other.privateKey, { subtle }) }, kp.publicKey, { subtle }), false, 'another key');
  assert.equal(await verifyGrant(G, kp.publicKey, { subtle }), false, 'unsigned');
  assert.equal(await verifyGrant({ ...G, sg }, null, { subtle }), false, 'no key to verify with');
  assert.equal(await verifyGrant({ ...G, k: 'raid', sg }, kp.publicKey, { subtle }), false, 'a grant not read whole is never verified');
  assert.equal(await signGrant(G, null, { subtle }), '', 'a relay with no key signs nothing');
  // ONE KEY, NEVER CONFUSED: an arch call signed with the same key is no grant
  const call = await signEgCall({ b: '0123456789abcdef', os: 'acct-mac', o: 'Mac', op: T0, ew: 0, site: { px: 300, py: 200, x: 1, y: 2, z: 3, yaw: 0 } }, kp.privateKey, { subtle });
  assert.equal(await verifyGrant({ ...G, sg: call }, kp.publicKey, { subtle }), false);
});

test('GRANT1 THE MARKS: rolled from the seed alone - the same seed, the same marks; three draws a member, so a member\'s marks are its own whatever the count; an elite only for an owner of Renown 5 or more, its draw made either way; an elite never a champion; near the street\'s rates over many seeds (mutants: the Renown\'s gate dropped; a draw skipped for an elite; the champion\'s rate moved)', () => {
  assert.deepEqual(grantMarks(0xdeadbeef, 4, 7), grantMarks(0xdeadbeef, 4, 7));
  assert.deepEqual(grantMarks(58, 4, 7), { e: 0b0010, c: [1, -1, -1, -1] }, 'seed 58: a Stalwart champion first, an elite second');
  assert.deepEqual(grantMarks(58, 4, 4), { e: 0, c: [1, 3, -1, -1] }, 'the same seed below the Renown: the second its own champion draw\'s, a Vampiric one');
  let elites = 0, champs = 0, plain = 0, low = 0;
  for (let s = 0; s < 4000; s++) {
    const m8 = grantMarks(s, 8, 9), m3 = grantMarks(s, 3, 9);
    assert.deepEqual([m8.e & 0b111, m8.c.slice(0, 3)], [m3.e, m3.c], `seed ${s}: a member's marks are its own`);
    const lo = grantMarks(s, 8, 4);
    assert.equal(lo.e, 0, 'Renown 4: no elite');
    low += lo.c.filter((t) => t >= 0).length;
    for (let i = 0; i < 8; i++) {
      if ((m8.e >>> i) & 1) { elites++; assert.equal(m8.c[i], -1, 'an elite is never a champion'); continue; }
      plain++;
      assert.equal(lo.c[i], m8.c[i], 'the elite\'s draw made either way: the champion\'s the same with or without the Renown');
      if (m8.c[i] >= 0) { champs++; assert.ok(m8.c[i] < GRANT_CHAMPION_TRAITS); }
    }
  }
  const all = 4000 * 8;
  assert.ok(Math.abs(elites / all - GRANT_ELITE_CHANCE) < 0.006, `elites ${elites / all}`);
  assert.ok(Math.abs(champs / plain - GRANT_CHAMPION_PER_MILLE / 1000) < 0.008, `champions ${champs / plain}`);
  assert.ok(low > champs, 'below the Renown, the elites\' members may be champions');
  assert.ok(validGrant({ ...G, n: 4, ...grantMarks(0xdeadbeef, 4, 7) }), 'the marks are always a grant\'s');
});

test('GRANT1 THE DICE: one stream per die, the same on every machine; the species drawn by chooseRandomEnemy from its own stream, so a die that draws more never moves the next (mutant: the dice share one stream)', () => {
  const owner = grantDice(G.s, 1), reader = grantDice(G.s, 1);
  assert.deepEqual(Object.keys(owner), GRANT_DICE);
  assert.ok(Object.isFrozen(owner));
  const ctx = { dungeonType: 0, playerLevel: G.l };
  assert.equal(chooseRandomEnemy(ctx, owner.species), chooseRandomEnemy(ctx, reader.species), 'the owner\'s species is the reader\'s');
  const ref = grantDice(G.s, 1).level;
  owner.species(); owner.species(); owner.species();
  assert.equal(owner.level(), ref(), 'the species\' extra draws leave the level\'s stream where it was');
  const draws = (d) => Array.from({ length: 4 }, d);
  assert.notDeepEqual(draws(grantDice(G.s, 1).species), draws(grantDice(G.s, 1).level), 'each die its own');
  assert.notDeepEqual(draws(grantDice(G.s, 1).species), draws(grantDice(G.s, 2).species), 'each member its own');
});

test('GRANT1 THE MINT\'S GATE: an unknown kind, a size past its kind, the cell\'s ceiling, then the account\'s bucket - the first that stands; the ceiling spends nothing; the bucket admits its burst, then one ask per its rate (mutants: the ceiling asked after the bucket; the ceiling\'s bound off by one; the size\'s bound)', () => {
  const now = T0;
  assert.deepEqual(grantMintGate('raid', 1, undefined, 0, now), { bucket: undefined, refusal: 'kind' });
  assert.deepEqual(grantMintGate('hasOwnProperty', 1, undefined, 0, now), { bucket: undefined, refusal: 'kind' });
  assert.equal(grantMintGate('enc', 0, undefined, 0, now).refusal, 'size');
  assert.equal(grantMintGate('enc', GRANT_KINDS.enc.max + 1, undefined, 0, now).refusal, 'size');
  assert.equal(grantMintGate('camp', GRANT_KINDS.camp.max, undefined, 0, now).refusal, null);
  assert.equal(grantMintGate('enc', 4, undefined, GRANT_CELL_CEILING - 4, now).refusal, null, 'up to the ceiling');
  const full = grantMintGate('enc', 4, { tokens: 3, at: now }, GRANT_CELL_CEILING - 3, now);
  assert.deepEqual(full, { bucket: { tokens: 3, at: now }, refusal: 'ceiling' }, 'past it, and the asker\'s bucket untouched');
  let b;
  for (let i = 0; i < GRANT_KINDS.enc.cap; i++) {
    const r = grantMintGate('enc', 2, b, 0, now);
    assert.equal(r.refusal, null, `ask ${i + 1}`);
    b = r.bucket;
  }
  const dry = grantMintGate('enc', 1, b, 0, now);
  assert.equal(dry.refusal, 'bucket', 'the burst spent');
  assert.equal(grantMintGate('enc', 1, dry.bucket, 0, now + 59_000).refusal, 'bucket');
  assert.equal(grantMintGate('enc', 1, dry.bucket, 0, now + 60_000).refusal, null, 'one ask a minute');
  assert.equal(grantMintGate('camp', 1, undefined, 0, now).refusal, null, 'a kind\'s bucket is its own: the caller keeps one per kind, and the encounters\' spent is not the camps\'');
});

test('GRANT1 THE READER\'S CHECK: the sender, the cell, the expiry with a minute\'s slack, the member - the first that stands; a record\'s elite and champion only as its grant\'s, either left off always believed (mutants: the sender unchecked; the slack doubled; the member\'s bound off by one; any trait believed)', () => {
  const at = { from: G.o, cell: G.q, nowMs: T0, i: 0 };
  assert.equal(grantRefusal(G, at), null);
  assert.equal(grantRefusal(G, { ...at, from: 'sock-ann-01' }), 'sender');
  assert.equal(grantRefusal(G, { ...at, from: 'sock-ann-01', cell: 'w:1:1' }), 'sender', 'the first that stands');
  assert.equal(grantRefusal(G, { ...at, cell: 'w:301:200' }), 'cell');
  assert.equal(grantRefusal(G, { ...at, nowMs: G.x + GRANT_SKEW_MS }), null, 'a minute\'s slack');
  assert.equal(grantRefusal(G, { ...at, nowMs: G.x + GRANT_SKEW_MS + 1 }), 'expired');
  assert.equal(grantRefusal(G, { ...at, i: 2 }), null);
  assert.equal(grantRefusal(G, { ...at, i: 3 }), 'member');
  assert.equal(grantRefusal(G, { ...at, i: -1 }), 'member');
  assert.equal(grantRefusal(G, { ...at, i: 1.5 }), 'member');
  assert.equal(grantRefusal({ ...G, h: 1 }, { ...at, i: 0 }), 'member', 'GRANT3: a handed-on grant stands its one member');
  assert.equal(grantRefusal({ ...G, h: 1 }, { ...at, i: 1 }), null);
  assert.ok(grantMarksAllow(G, 1, { z: 1 }), 'member 1 is the grant\'s elite');
  assert.ok(!grantMarksAllow(G, 0, { z: 1 }), 'member 0 is not');
  assert.ok(grantMarksAllow(G, 0, { cp: 3 }), 'its own trait');
  assert.ok(!grantMarksAllow(G, 0, { cp: 2 }), 'another');
  assert.ok(!grantMarksAllow(G, 2, { cp: 0 }), 'a trait where the grant has none');
  assert.ok(grantMarksAllow(G, 1, {}) && grantMarksAllow(G, 0, { z: 0, cp: null }), 'a mark left off is always believed');
  assert.ok(GRANT_REFUSALS.includes(grantRefusal(G, { ...at, i: 3 })), 'a reason the tally counts');
});
