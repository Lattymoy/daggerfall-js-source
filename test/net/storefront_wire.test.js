// STOREFRONT (2026-10-29, the owner: "kill effects would be a brand new feature"; bible/06-Systems/Storefront.md sections
// 4, 5, 7 and 10). The effects online: the kit's law (net/effectLaw.js), the token's `fx` claim minted and verified, the
// relay's badge on a peer's row, the pose's kill fields bounded (xk, xp, xh) and carried through a pose's easing, my kill
// told once in the pose's own frame, a peer's kill effect played by its token's kit under the Others' choice, a riding
// peer's mount look throwing its beat, and a peer's worn effect read by its id (net/peer/peerEffects.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  EFFECT_SLOTS, EFFECTS, KILL_EFFECTS, PORTAL_SKINS, MOUNT_LOOKS, effectKitOk, effectKitKeys, effectWorn, effectKitWith, effectKitHeld, effectAt, effectOf,
} from '../../src/net/effectLaw.js';
import { fakeRoom } from '../fakeRoom.mjs';
import { claimsValid, mintToken, verifyToken, importPublicKeyB64, glyphBitsOf, glyphsOfBits, GLYPHS, tokenBodyOf, TOKEN_BODY_MAX } from '../../src/net/identityToken.js';
import { validPose, poseChanged, badged, readEffects, KILL_FX_HEIGHT_MAX } from '../../src/net/wire.js';
import { lerpPose } from '../../src/net/online.js';
import { noteMyKill, poseFx, createPeerFxPlayer, _resetPeerFxForTests } from '../../src/net/peer/peerFx.js';
import { bindPeerEffects, peerEffectWorn, KILL_FX_NEAR_M, killFxOthersOf } from '../../src/net/peer/peerEffects.js';   // PIN MOVED (the wire audit): the Others' choice is the effects' seam's, a mount look's as a kill's
import { setPlayerDoor } from '../../src/systems/playerDoor.js';
import { EFFECT_TEXT } from '../../src/ui/effectText.js';
import { setPref } from '../../src/systems/uiPrefs.js';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('STOREFRONT the kit\'s law: three slots, four effects each, a character a slot never reused; a kit is three characters each an effect of its slot or `0`, never all empty; worn, changed a slot at a time, and held only while every one is (mutants: an empty kit a claim; a key of another slot worn; a slot changed beside the one asked)', () => {
  assert.deepEqual([...EFFECT_SLOTS], ['kill', 'portal', 'mount']);
  assert.deepEqual([...KILL_EFFECTS], ['ashen', 'voidrend', 'pyre', 'tonal']);
  assert.deepEqual([...PORTAL_SKINS], ['runic', 'daedric', 'aetheric', 'brass']);
  assert.deepEqual([...MOUNT_LOOKS], ['warhorse', 'spectral', 'dawnfire', 'automaton']);
  for (const slot of EFFECT_SLOTS) assert.deepEqual(EFFECTS.filter((e) => e.slot === slot).map((e) => e.code), ['a', 'b', 'c', 'd'], slot);
  for (const e of EFFECTS) assert.equal(EFFECT_TEXT[`${e.slot}:${e.key}`](), e.name, `${e.slot}:${e.key}: the client says the law's English`);
  assert.equal(effectKitOk('c0a'), true);
  for (const bad of ['000', 'c0', 'c0aa', 'e00', 'cz0', null, 3, '']) assert.equal(effectKitOk(bad), false, String(bad));
  assert.deepEqual(effectKitKeys('cb0'), { kill: 'pyre', portal: 'daedric', mount: null });
  assert.deepEqual(effectKitKeys('junk'), { kill: null, portal: null, mount: null });
  assert.equal(effectWorn('c0a', 'mount'), 'warhorse');
  assert.equal(effectKitWith(null, 'portal', 'aetheric'), '0c0');
  assert.equal(effectKitWith('0c0', 'kill', 'ashen'), 'ac0', 'the slot asked alone');
  assert.equal(effectKitWith('ac0', 'kill', null), '0c0');
  assert.equal(effectKitWith('0c0', 'portal', null), null, 'a kit left empty is no kit');
  assert.equal(effectKitWith('ac0', 'kill', 'warhorse'), 'ac0', 'a key of another slot changes nothing');
  assert.equal(effectKitHeld('cb0', { kill: ['pyre'], portal: [] }), 'c00', 'an effect no longer held is not signed');
  assert.equal(effectAt('mount', 'd').key, 'automaton');
  assert.equal(effectOf('portal', 'warhorse'), null);
});

test('STOREFRONT the token: `fx` minted from the wardrobe and verified - a kit of known effects or the token refused; none worn, no claim and the bytes a token always had; the relay badges it on a peer\'s row off the verified token alone (mutants: a junk kit signed; the claim dropped; any string badged)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = await importPublicKeyB64(Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url'), { subtle });
  const nowS = 1_760_000_000;
  const r = await verifyToken(await mintToken({ s: 'acct-1', n: 'Aelwyn', k: 'linked', fx: 'c0a' }, kp.privateKey, { subtle, nowS }), pub, { subtle, nowS });
  assert.ok(r.ok, r.why);
  const c = r.claims;
  assert.equal(c.fx, 'c0a');
  const none = await verifyToken(await mintToken({ s: 'acct-1', n: 'Aelwyn', k: 'linked' }, kp.privateKey, { subtle, nowS: nowS - 1 }), pub, { subtle, nowS });
  assert.equal('fx' in none.claims, false, 'none worn: no claim');
  await assert.rejects(mintToken({ s: 'acct-1', n: 'Aelwyn', k: 'linked', fx: 'zzz' }, kp.privateKey, { subtle, nowS }), 'a junk kit is never signed');
  assert.equal(claimsValid({ ...c, fx: 'zzz' }), false, 'a kit of unknown effects refuses the token');
  assert.equal(claimsValid({ ...c, fx: '000' }), false);
  const row = {};
  badged(row, { fx: 'c0a' });
  assert.equal(row.fx, 'c0a');
  const junk = {};
  badged(junk, { fx: '<script>' });
  assert.equal('fx' in junk, false);
  assert.equal(readEffects({ fx: 'c0a' }), 'c0a');
  assert.equal(readEffects({ fx: 'nope' }), null);
  // the relay's attachment carries it, as it carries the armory kit
  assert.match(rd('server/src/index.js'), /\.\.\.\(who\.fx \? \{ fx: who\.fx \} : \{\}\)/);
});

test('STOREFRONT the pose: my kill told once - its count, its place (put in the wire\'s frame the first time a pose carries it) and the body\'s height in tenths; bounded on the way in, a place out of bounds or no count no fields; a new kill is a change; eased through, its fields the newest (mutants: the place converted every pose; a kill no change; the height unbounded)', () => {
  _resetPeerFxForTests();
  assert.deepEqual(poseFx((q) => q), {}, 'nothing yet');
  noteMyKill([10, 2, 30], 1.9, [12, 2, 30]);   // PIN MOVED (the wire audit): told from my feet, beside it
  let asked = 0;
  const toWire = (q) => { asked++; return [q[0] + 1000, q[1], q[2] + 2000]; };
  assert.deepEqual(poseFx(toWire), { xk: 1, xp: [1010, 2, 2030], xh: 19 });
  assert.deepEqual(poseFx(toWire), { xk: 1, xp: [1010, 2, 2030], xh: 19 });
  assert.equal(asked, 1, 'put in the wire\'s frame once');
  noteMyKill([0, 0, 0], 99, [0, 0, 0]);
  assert.equal(poseFx(toWire).xh, KILL_FX_HEIGHT_MAX, 'a giant\'s height, bounded');
  const base = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0 };
  assert.deepEqual(validPose({ ...base, xk: 4, xp: [1, 2, 3], xh: 17 }).xp, [1, 2, 3]);
  assert.equal(validPose({ ...base, xk: 4, xp: [1, 2, 3] }).xh, 18, 'a person\'s height when not said');
  assert.equal(validPose({ ...base, xk: 4, xp: [1e9, 2, 3], xh: 17 }).xk, undefined, 'a place out of bounds: no kill');
  assert.equal(validPose({ ...base, xk: 0, xp: [1, 2, 3] }).xk, undefined);
  const a = validPose({ ...base, xk: 4, xp: [1, 2, 3] }), b = validPose({ ...base, xk: 5, xp: [1, 2, 3] });
  assert.equal(poseChanged(a, b), true, 'a new kill is a change');
  assert.equal(lerpPose(a, b, 0.5).xk, 5, 'eased: the newest kill');
  _resetPeerFxForTests();
});

test('STOREFRONT a peer\'s kill: played where its pose says the body fell, the look its token\'s kit names - none worn, none played; never twice for one kill, never faster than a blow lands; by the Others\' choice - every one, those near or none (mutants: a kill played with no kit; the choice ignored; replayed on a peer\'s return)', () => {
  let t = 100;
  const played = [];
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe() {}, castOnPlayer() {}, killFx: (look, at, o) => played.push({ look, at, h: o.h }), eye: () => [0, 1.6, 0] });
  const fx = createPeerFxPlayer({ toScene: (p) => [p.x, p.y, p.z], now: () => t });
  const pose = (xk, xp = [3, 0, 4]) => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, xk, xp, xh: 20 });
  fx.update('p1', pose(1), [0, 0, 0], 1.8, 'b00'); fx.frame();
  fx.update('p1', pose(2), [0, 0, 0], 1.8, 'b00'); t += 1; fx.frame();
  assert.deepEqual(played, [{ look: 'voidrend', at: [3, 0, 4], h: 2 }], 'the first seen is no kill; the next plays');
  fx.update('p1', pose(2), [0, 0, 0], 1.8, 'b00'); t += 1; fx.frame();
  assert.equal(played.length, 1, 'never twice for one kill');
  fx.update('p1', pose(3), [0, 0, 0], 1.8, null); t += 1; fx.frame();
  assert.equal(played.length, 1, 'no kit: nothing');
  setPref('killFxOthers', 'near');
  fx.update('p1', pose(4, [KILL_FX_NEAR_M + 5, 0, 0]), [0, 0, 0], 1.8, 'b00'); t += 1; fx.frame();
  assert.equal(played.length, 1, 'near: not one past its reach');
  setPref('killFxOthers', 'none');
  fx.update('p1', pose(5), [0, 0, 0], 1.8, 'b00'); t += 1; fx.frame();
  assert.equal(played.length, 1, 'none');
  setPref('killFxOthers', 'all');
  assert.equal(killFxOthersOf('junk'), 'all');
  setPlayerDoor(null);
});

test('STOREFRONT a riding peer\'s mount look: its beat through the running host\'s engine, on a horse alone (never the cart, never a beast), faster at a gallop, nothing with no look; and a peer\'s worn effect by its id through the seam the host binds (mutants: a beat on foot; the seam reading my own kit)', () => {
  let t = 0;
  const beats = [];
  setPlayerDoor({ foes: () => [], feet: () => [0, 0, 0], hurtFoe() {}, castOnPlayer() {}, burst: (recipe, at, o) => { beats.push({ recipe, pace: o.pace }); return true; } });
  const fx = createPeerFxPlayer({ toScene: (p) => [p.x, p.y, p.z], now: () => t });
  const ride = (rd, mv) => ({ x: 0, y: 0, z: 0, rd, mv, yaw: 0 });
  for (let i = 0; i < 40; i++) { fx.update('r1', ride(1, 2), [0, 0, 0], 1.8, '00a'); fx.frame(); t += 0.05; }
  const gallop = beats.length;
  assert.ok(gallop >= 8 && beats.every((b) => b.recipe === 'mount-warhorse' && b.pace === 2), `${gallop} beats at a gallop`);   // its pool the recipe's (test/render/killfx.test.js)
  beats.length = 0;
  for (let i = 0; i < 40; i++) { fx.update('r1', ride(2, 2), [0, 0, 0], 1.8, '00a'); fx.frame(); t += 0.05; }
  assert.equal(beats.length, 0, 'the cart: none');
  for (let i = 0; i < 40; i++) { fx.update('r1', ride(0, 2), [0, 0, 0], 1.8, '00a'); fx.frame(); t += 0.05; }
  assert.equal(beats.length, 0, 'on foot: none');
  for (let i = 0; i < 40; i++) { fx.update('r1', ride(1, 0), [0, 0, 0], 1.8, '00a'); fx.frame(); t += 0.05; }
  assert.ok(beats.length > 0 && beats.length < gallop / 2, 'standing: a slow breath');
  setPlayerDoor(null);
  bindPeerEffects((id) => (id === 'p9' ? '0b0' : null));
  assert.equal(peerEffectWorn('p9', 'portal'), 'daedric');
  assert.equal(peerEffectWorn('p8', 'portal'), null);
  assert.equal(peerEffectWorn(null, 'portal'), null);
  bindPeerEffects(null);
  assert.equal(peerEffectWorn('p9', 'portal'), null, 'unbound: none');
  assert.match(rd('src/scenes/auraHost.js'), /bindPeerEffects\(\(id\) => deps\.online\(\)\?\.effectsOf\?\.\(id\) \?\? null\);/, 'the aura host binds it to the client\'s peers');
});

test('STOREFRONT the glyphs as their mask: `gb` hex over GLYPHS, four a character, its trailing zeros dropped - every subset back as it went in, in GLYPHS\' order; a mask no minter writes refused; the mint writes the mask and the verifier hands back the list; never both; a hidden glyph read against the mask (mutants: the bits shifted; a trailing zero let through; the list signed)', async () => {
  assert.equal(glyphBitsOf([]), '');
  assert.equal(glyphBitsOf(['sprout']), '1');
  assert.equal(glyphBitsOf([GLYPHS[4]]), '01');
  assert.equal(glyphBitsOf(GLYPHS).length, Math.ceil(GLYPHS.length / 4));
  const rand = ((x) => () => { x = (x * 16807) % 2147483647; return x / 2147483647; })(11);
  for (let i = 0; i < 200; i++) {
    const pick = GLYPHS.filter(() => rand() < 0.3);
    if (!pick.length) continue;
    assert.deepEqual(glyphsOfBits(glyphBitsOf([...pick].reverse())), pick, 'back in GLYPHS\' order');
  }
  for (const bad of ['', '0', '10', 'g', '1'.repeat(Math.ceil(GLYPHS.length / 4) + 1), 'F', 1]) assert.equal(glyphsOfBits(bad), null, String(bad));
  if (GLYPHS.length % 4) assert.equal(glyphsOfBits('0'.repeat(Math.ceil(GLYPHS.length / 4) - 1) + 'f'), null, 'a bit past the list');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = 1_760_000_000;
  const tok = await mintToken({ s: 'a'.repeat(40), n: 'Mac', k: 'linked', g: ['dev', 'sprout'], gx: ['dev'] }, kp.privateKey, { subtle, nowS });
  const body = JSON.parse(Buffer.from(tokenBodyOf(tok), 'base64url').toString());
  assert.equal(body.g, undefined, 'never the words');
  assert.equal(body.gb, glyphBitsOf(['sprout', 'dev']));
  const v = await verifyToken(tok, kp.publicKey, { subtle, nowS });
  assert.ok(v.ok);
  assert.deepEqual([v.claims.g, v.claims.gb, v.claims.gx], [['sprout', 'dev'], undefined, ['dev']], 'read back as the list');
  const { gb: _gb, gx: _gx, ...base } = body;   // the minted claim set, its glyphs taken off
  assert.equal(claimsValid({ ...base, gb: '1', g: ['sprout'] }), false, 'one way of saying them');
  assert.equal(claimsValid({ ...base, gb: '10' }), false, 'a trailing zero');
  assert.equal(claimsValid({ ...base, gb: '1', gx: ['dev'] }), false, 'a hidden glyph the mask never said');
  assert.equal(claimsValid({ ...base, gb: '3', gx: ['dev'] }), true);
  assert.equal(claimsValid({ ...base, g: ['sprout'] }), true, 'a token minted before still verifies until it runs out');
  const all = await mintToken({ s: 'a'.repeat(40), n: 'W'.repeat(20), k: 'linked', g: [...GLYPHS] }, kp.privateKey, { subtle, nowS });
  assert.ok(tokenBodyOf(all).length < TOKEN_BODY_MAX / 2, `every glyph at once: ${tokenBodyOf(all).length}`);
  const r = rd('server/src/index.js');
  assert.match(r, /try \{ ws\.serializeAttachment\(packAttach\(a\)\); \} catch \{ return false; \}/, 'the socket\'s attachment holds the mask');
  assert.equal((r.match(/unpackAttach\(ws\.deserializeAttachment\(\) \?\? \{\}\)/g) ?? []).length, 2, 'and every read of one hands back the list');
});

test('STOREFRONT the mask through a hibernation: a socket\'s glyphs attached as `gb`, never as words, and read back as the list when the room wakes - on the row a newcomer is welcomed with, and in the rights they give (mutants: a woken socket without its glyphs)', async () => {
  const room = fakeRoom('town:m9');
  const a = room.connect();
  await room.hello(a, 'peer-0001', null, { name: 'Mac', glyphs: ['sprout', 'dev'] });
  assert.equal(a.closed, null);
  assert.deepEqual([a.att.gb, a.att.glyphs], [glyphBitsOf(['sprout', 'dev']), undefined], 'attached as the mask');
  room.wake();
  const b = room.connect();
  await room.hello(b, 'peer-0002');
  const seen = b.sent.find((m) => m.t === 'welcome').peers.find((p) => p.id === 'peer-0001');
  assert.deepEqual(seen.glyphs, ['sprout', 'dev'], 'the woken room reads the list back');
  assert.deepEqual(room.room._attach(a).glyphs, ['sprout', 'dev'], 'and a developer is still one');
});
