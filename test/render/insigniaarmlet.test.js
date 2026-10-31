// GUILD-SHOP (2026-10-30, the owner: "A armory aura arm piece where it shows your guild insigia in a detailed format on one
// of the upper arms. Just one side"; bible/11-Multiplayer/Guild-Shop.md) - THE INSIGNIA ARMLET: one upper arm alone, the
// wearer's left; a gilt band enamelled in the guild's colours and the arms on a gilt shield proud of it; drawn over what is
// behind, its glow added; the crest a texture each pair of arms keeps, let go when unused; mine my guild's, a peer's the
// guild their token names.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArmoryRenderer, armoryDraws, armletSide, armletColours, ARMORY_ARMLET, ARMORY_CREST_IDLE_S, ARMORY_PROGRAMS, armoryPrograms, ARMORY_PIECE_INDEX } from '../../src/render/armoryPass.js';
import { newPose, poseAtRest, poseWorld } from '../../src/render/armoryPose.js';
import { noteGuildArms, noteOwnGuild, ownGuildArms, guildArmsOf, setArmsDoor, armsKey, _resetArmsBook } from '../../src/net/guild/guildArmsBook.js';
import { armletArmsOf } from '../../src/scenes/auraHost.js';
import { ARMORY_LOOK, armoryPieceName } from '../../src/ui/armoryText.js';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const OWL = Object.freeze({ field: 'azure', border: 'gold', device: 'owl' });
function logGl() {
  const log = [];
  let n = 0;
  const gl = new Proxy({}, { get: (_, k) => (typeof k === 'string' && /^[A-Z][A-Z_0-9]*$/.test(k) ? k : (...a) => { log.push([k, ...a]); return k === 'getExtension' ? null : k === 'createTexture' ? { tex: ++n } : {}; }) });
  return { gl, log, count: (/** @type {string} */ name) => log.filter((c) => c[0] === name).length };
}
const rig = () => { const p = newPose(); poseAtRest(p, 1, false); return p; };
const wearer = (/** @type {any} */ o = {}) => ({ kit: '00c00', at: [0, 0, 0], yaw: 0, pose: rig(), kindle: 1, torn: -1, _d: 3, ...o });

test('GUILD-SHOP the armlet\'s side: a rig\'s own left arm; a sprite\'s picture side - its right while the eye stands before it, its left from behind (mutants: both arms; the sprite\'s sides unswapped)', () => {
  assert.equal(armletSide({ card: false }, [0, 0, 1], [0, 1.3, 0], [0, 1.6, 3]), 'L');
  assert.equal(armletSide({ card: false }, [0, 0, 1], [0, 1.3, 0], [0, 1.6, -3]), 'L', 'a rig\'s left is its left from any side');
  assert.equal(armletSide({ card: true }, [0, 0, 1], [0, 1.3, 0], [0, 1.6, 3]), 'R', 'a sprite seen from the front: its left arm is the picture\'s right');
  assert.equal(armletSide({ card: true }, [0, 0, 1], [0, 1.3, 0], [0, 1.6, -3]), 'L');
});

test('GUILD-SHOP the armlet draws on ONE upper arm: a band round it a third of the way to the elbow, the glow and the crest on its outer face, facing out and a little forward; nothing for a body sunk to its neck (mutants: the other arm; the crest facing in; the band at the elbow)', () => {
  const w = wearer();
  const draws = armoryDraws('insigniaarmlet', w, [0, 1.6, 3], true);
  assert.deepEqual(draws.map((d) => [d.mesh, d.part]), [[0, 0], [2, 2], [2, 1]], 'a band, its glow, its crest');
  const sh = poseWorld(w.pose, 'shL', w.at, 0, [0, 0, 0]), el = poseWorld(w.pose, 'elL', w.at, 0, [0, 0, 0]), shR = poseWorld(w.pose, 'shR', w.at, 0, [0, 0, 0]);
  const band = draws[0], mid = [0, 1, 2].map((i) => (band.A[i] + band.B[i]) / 2);
  const at = [0, 1, 2].map((i) => sh[i] + (el[i] - sh[i]) * ARMORY_ARMLET.at);
  assert.ok(Math.hypot(mid[0] - at[0], mid[1] - at[1], mid[2] - at[2]) < 1e-6, 'the band on the left upper arm, a third of the way down');
  assert.ok(Math.hypot(mid[0] - shR[0], mid[2] - shR[2]) > Math.hypot(mid[0] - sh[0], mid[2] - sh[2]), 'never the right');
  const crest = draws[2];
  const outward = Math.sign(sh[0]);   // the left shoulder's side of the body
  assert.ok(Math.sign(crest.N[0]) === outward && crest.N[2] > 0, 'facing out from the body and a little forward');
  assert.ok(crest.U[1] > 0.9, 'its up toward the shoulder');
  assert.equal(armoryDraws('insigniaarmlet', wearer({ pose: { ...rig(), sunk: true } }), [0, 1.6, 3], true).length, 0, 'sunk to the neck');
  assert.equal(armoryPieceName('insigniaarmlet'), 'Insignia Armlet');
  assert.match(ARMORY_LOOK.insigniaarmlet(), /left upper arm/);
});

test('GUILD-SHOP the armlet\'s program: its own, colour over what is behind (alpha), started at the boot\'s idle with the rest; its colours the arms\' field and ink, a plain band for none (mutants: the program left out; the colours swapped)', () => {
  const i = ARMORY_PIECE_INDEX.insigniaarmlet;
  assert.equal(i, 10);
  assert.ok(ARMORY_PROGRAMS.includes(armoryPrograms(i)[0]));
  const fs = armoryPrograms(i)[0][1];
  assert.match(fs, /const int uPiece = 10;/);
  assert.match(fs, /vec4 insigniaLight\(\)/);
  assert.match(fs, /texture\(uArms, uv\)/);
  assert.deepEqual(armletColours({ heraldry: OWL }), { field: [0x3b / 255, 0x6f / 255, 0xd8 / 255], ink: [0xd4 / 255, 0xa0 / 255, 0x17 / 255] });
  assert.deepEqual(armletColours(null), { field: [0.9, 0.9, 0.9], ink: [0.54, 0.54, 0.54] });
});

test('GUILD-SHOP the pass: the armlet blends over, its crest painted once a pair of arms and bound, the blend handed back; no crest painted - the band and glow alone; a crest unused let go; the renderer\'s going frees them (mutants: added light; painted every frame; never let go)', () => {
  const { gl, log, count } = logGl();
  const painted = [];
  const pass = new ArmoryRenderer(/** @type {any} */ (gl), { crest: (arms) => { painted.push(armsKey(arms)); return { pic: true }; } });
  const w = wearer({ arms: { heraldry: OWL, logo: null } });
  pass.draw([w], I, I, [0, 1.6, 3], 1, null, true);
  assert.equal(pass.drawn, 1);
  assert.deepEqual(log.filter((c) => c[0] === 'blendFunc').map((c) => c.slice(1)), [['ONE', 'ONE'], ['ONE', 'ONE_MINUS_SRC_ALPHA'], ['ONE', 'ONE'], ['ONE', 'ONE']], 'over, then added again');
  assert.equal(count('drawArrays'), 3, 'the band, the glow, the crest');
  assert.equal(count('createTexture'), 1);
  pass.draw([w], I, I, [0, 1.6, 3], 2, null, true);
  assert.deepEqual([painted.length, count('createTexture')], [1, 1], 'painted once');
  pass.draw([wearer({ arms: { heraldry: { ...OWL, field: 'crimson' }, logo: null } })], I, I, [0, 1.6, 3], 3, null, true);
  assert.equal(count('createTexture'), 2, 'other arms, their own crest');
  pass.draw([w], I, I, [0, 1.6, 3], 3 + ARMORY_CREST_IDLE_S + 1, null, true);
  assert.equal(count('deleteTexture'), 1, 'the crimson crest let go');
  pass.dispose();
  assert.equal(count('deleteTexture'), 2, 'and the rest at the going');
  const bare = logGl();
  const none = new ArmoryRenderer(/** @type {any} */ (bare.gl), { crest: () => null });
  none.draw([w], I, I, [0, 1.6, 3], 1, null, true);
  assert.deepEqual([bare.count('drawArrays'), bare.count('bindTexture')], [2, 0], 'no crest: the band and its glow');
});

test('GUILD-SHOP the arms a wearer\'s armlet wears: mine my own guild\'s, a peer\'s the guild their token names - asked of the service once, a batch; a kit without the armlet asks nothing (mutants: a peer given my arms; every peer asked)', async () => {
  _resetArmsBook();
  const asked = [];
  setArmsDoor({ arms: async (tags) => { asked.push(tags); return { ok: true, data: { arms: { GREY: { heraldry: OWL, logo: null, name: 'The Grey Hand' } } } }; } }, () => 1_000_000);
  noteGuildArms('IRON', { field: 'crimson', border: 'sable', device: 'wolf' }, null, 'The Iron Oath');
  noteOwnGuild('IRON');
  assert.equal(ownGuildArms().heraldry.device, 'wolf');
  assert.equal(armletArmsOf('a0000', 'GREY'), null, 'no armlet, no ask');
  assert.equal(asked.length, 0);
  assert.equal(armletArmsOf('00c00', 'GREY'), null, 'not known yet');
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(asked, [['GREY']]);
  assert.equal(armletArmsOf('00c00', 'GREY').heraldry.device, 'owl');
  assert.equal(guildArmsOf('NOPE'), null);
  noteOwnGuild(null);
  assert.equal(ownGuildArms(), null, 'in no guild, a plain armlet');
  _resetArmsBook();
});
