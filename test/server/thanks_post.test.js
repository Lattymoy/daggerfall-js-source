// THANKS-POST (2026-10-30, the owner: "every current player should be grant 500 free aurem on the update to their inbox and
// a free arm armoury aura. Small and varied crystallized arm spikes that rotate color gradient but not overbearing", with the
// letter's words to clean up; bible/06-Systems/Aurum.md section 3c, bible/04-Characters/Aura-Armory.md). The gift's law,
// migration 0202 run over accounts that stand (the real Worker on node:sqlite), the letter in the box naming its gift, the
// Crystal Spurs worn and signed, and the spurs drawn - where they stand and their shader RUN. tools/mutants/thanks_post.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

import { standService } from '../accountDb.mjs';
import { GIFTS, giftsOf, giftPiecesOf, giftOf } from '../../src/net/giftLaw.js';
import { armoryPieceOf, ARMORY_NAME, armoryKitOk, ARMORY_LINES } from '../../src/net/armoryLaw.js';
import { armoryHeld } from '../../server-account/src/titles.js';
import { THANKS_POST, thanksPostSql } from '../../tools/sendServerPost.mjs';
import { postHead } from '../../src/net/postLaw.js';
import { postGiftWords } from '../../src/ui/enhanced/enhancedPost.js';
import { verifyToken } from '../../src/net/identityToken.js';
import { ARMORY_SPURS, ARMORY_SPUR_ROOT, ARMORY_SPUR_GAIN, PRISM_RGB, ARMORY_PIECE_INDEX, ARMORY_SPIKE_ROUND, armoryDraws, armoryPrograms, armoryRatesWhole, armoryTubeGrid } from '../../src/render/armoryPass.js';
import { ARMORY_LINE_GRADIENT, badgeCss } from '../../src/ui/playerBadge.js';
import { auraRingNode } from '../../src/ui/collections/wardrobePart.js';
import { newPose, poseFromFigure } from '../../src/render/armoryPose.js';
import { glslFunctions } from '../glsl.mjs';

const { subtle } = webcrypto;
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('THANKS-POST the gift\'s law: `thanks` gives 500 Aurum and the Crystal Spurs - an arms piece of its own line, never sold; an account\'s gifts read off `players.gifts`, known keys alone, each once (mutants: the Aurum, the piece, an unknown key read)', () => {
  assert.deepEqual(GIFTS.thanks, { aurum: 500, armory: ['crystalspurs'] });
  const p = armoryPieceOf('crystalspurs');
  assert.deepEqual([p?.slot, p?.code, p?.line, p?.source], ['arms', 'd', 'crystal', 'gift']);
  assert.equal(ARMORY_NAME.crystalspurs, 'Crystal Spurs');
  assert.deepEqual(giftsOf({ gifts: 'thanks' }), ['thanks']);
  assert.deepEqual(giftsOf({ gifts: ' thanks  thanks nope THANKS ' }), ['thanks'], 'known keys, once');
  for (const row of [{}, { gifts: '' }, { gifts: null }, { gifts: 7 }, null]) assert.deepEqual(giftsOf(row), [], JSON.stringify(row));
  assert.deepEqual(giftPiecesOf({ gifts: 'thanks' }), ['crystalspurs']);
  assert.equal(giftOf('thanks'), GIFTS.thanks);
  assert.equal(giftOf('toString'), null, 'never a prototype\'s word');
  assert.deepEqual(armoryHeld({ handle: 'Pat', gifts: 'thanks' }, {}), ['crystalspurs'], 'held by its gift');
  assert.deepEqual(armoryHeld({ handle: null, gifts: 'thanks' }, {}), [], 'never a guest\'s');
  assert.deepEqual(armoryHeld({ handle: 'Pat', gifts: '' }, {}), []);
});

test('THANKS-POST migration 0202: its two columns, then the tool\'s own statement - the gift on every registered account, its Aurum a ledger line, the letter - its words the owner\'s cleaned up, FROZEN in the tool (mutants: the migration\'s gift drifted from the tool\'s)', () => {
  const mig = src('server-account/migrations/0202_thanks_post.sql');
  assert.match(mig, /^ALTER TABLE players ADD COLUMN gifts TEXT NOT NULL DEFAULT '';$/m);
  assert.match(mig, /^ALTER TABLE server_post ADD COLUMN gift TEXT;$/m);
  assert.ok(mig.trimEnd().endsWith(thanksPostSql()), 'the tool\'s statement, as it prints it');
  assert.deepEqual([THANKS_POST.batch, THANKS_POST.gift, THANKS_POST.sender], ['thanks-aurum-spurs', 'thanks', 'The DFO Team']);
  assert.match(THANKS_POST.body, /^Through the good times and the bad, thank you for staying with us\. None of this would be possible without your support\./);
  assert.match(THANKS_POST.body, /500 Aurum and the Crystal Spurs are on your account now/);
  assert.match(THANKS_POST.body, /Let's continue our journey, together\.\n\nWith love,\nThe DFO Team$/);
});

test('THANKS-POST over the accounts that stand: each registered account holds the gift - 500 Aurum on its balance, the Crystal Spurs to wear and signed on its token - and a letter naming it, "On your account"; a guest and an account made after hold none; run again, nothing doubles (mutants: a guest given it; the ledger line twice; the letter without its gift)', async () => {
  const s = await standService({ AURUM_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const a = await s.registered('Thanked'), b = await s.seated('AlsoThanked'), g = await s.guest();
  const give = () => raw.exec(thanksPostSql());
  give();
  give();   // run again: nothing doubles
  const later = await s.registered('Later');   // made after the update: the migration has run, never to run again
  const balance = async (who) => (await (await s.fetch('https://accounts.invalid/v1/account', { headers: { authorization: `Bearer ${who.secret}` } })).json()).aurum?.balance;
  assert.equal(await balance(a), 500);
  assert.equal(await balance(b), 500);
  assert.equal(await balance(later), 0, 'an account made after the update holds none');
  assert.equal(await balance(a), 500, 'run twice: once');
  assert.deepEqual(raw.prepare("SELECT account, amount FROM aurum_ledger WHERE kind = 'gift'").all().map((r) => r.amount), [500, 500]);
  assert.deepEqual(raw.prepare('SELECT gifts FROM players WHERE id = ?').get(a.id).gifts, 'thanks');
  assert.equal(raw.prepare('SELECT gifts FROM players WHERE id = ?').get(g.id).gifts, '', 'a guest holds none');
  assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM server_post WHERE batch = 'thanks-aurum-spurs'").get().n, 2, 'a letter each, once');
  const read = { body: await (await s.fetch('https://accounts.invalid/v1/post/box', { headers: { authorization: `Bearer ${a.secret}` } })).json() };
  const letter = read.body.post?.find((p) => p.subject === THANKS_POST.subject);
  assert.ok(letter, JSON.stringify(read.body));
  assert.deepEqual([letter.gift, letter.item, letter.from], ['thanks', null, 'The DFO Team'], 'the gift named, nothing to claim');
  assert.deepEqual(postHead(letter).gift, 'thanks', 'the page reads it back');
  assert.deepEqual(postGiftWords(letter.gift), ['500 Aurum', 'Crystal Spurs'], 'the letter\'s two lines');
  assert.deepEqual(postGiftWords('nope'), []);
  const wear = await s.call('/v1/account/armory', { slot: 'arms', piece: 'crystalspurs' }, a.secret);
  assert.equal(wear.status, 200, JSON.stringify(wear.body));
  const refused = await s.call('/v1/account/armory', { slot: 'arms', piece: 'crystalspurs' }, later.secret);
  assert.notEqual(refused.status, 200, 'never one\'s who was not sent it');
  const tok = await s.call('/v1/auth/token', {}, a.secret);
  const got = await verifyToken(tok.body.token, s.identityPublic, { subtle, nowS: Math.floor(Date.now() / 1000) });
  assert.ok(got.ok, got.why);
  assert.equal(got.claims.ak, '00d00', 'the arms slot\'s `d`, signed');
  assert.ok(armoryKitOk(got.claims.ak));
});

// ── THE SPURS ───────────────────────────────────────────────────────

test('THANKS-POST the Crystal Spurs drawn (the owner: "Small and varied crystallized arm spikes ... not overbearing"): five spurs an arm, both arms - each a cone out of the arm, its root clear of the arm\'s line and its tip out from the body; small and each its own size and way; a sprite\'s upper arms alone; the rates whole (mutants: one arm, a spur in the body, the forearm\'s on a sprite)', () => {
  const rig = { at: [0, 0, 0], yaw: 0, pose: newPose(), vel: [0, 0, 0] }, eye = [0, 1.6, 3];
  const spurs = armoryDraws('crystalspurs', rig, eye, true);
  assert.equal(spurs.length, 10, 'five an arm, both arms');
  assert.ok(spurs.every((d) => d.mesh === 0 && d.r[1] < d.r[0] * 0.2), 'each a cone: a tube to a point');
  const left = spurs.filter((d) => d.A[0] < 0), right = spurs.filter((d) => d.A[0] > 0);
  assert.deepEqual([left.length, right.length], [5, 5], 'left and right');
  for (const d of spurs) {
    const out = Math.abs(d.B[0]) - Math.abs(d.A[0]);
    assert.ok(out > 0, `its tip out from the body (${out.toFixed(3)})`);
    const len = Math.hypot(d.B[0] - d.A[0], d.B[1] - d.A[1], d.B[2] - d.A[2]);
    assert.ok(len >= 0.05 && len <= 0.13, `small (${len.toFixed(3)} m)`);
    assert.ok(d.A[1] > 0.7 && d.A[1] < 1.6, 'on the arm, between the hip and the shoulder');
  }
  assert.equal(new Set(ARMORY_SPURS.map((p) => p.len)).size, ARMORY_SPURS.length, 'each its own length');
  assert.equal(new Set(ARMORY_SPURS.map((p) => p.turn)).size, ARMORY_SPURS.length, 'each its own way round the arm');
  assert.ok(ARMORY_SPURS.every((p) => p.r <= 0.025 && p.len <= 0.12), 'small');
  assert.ok(ARMORY_SPUR_ROOT > 0.03 && ARMORY_SPUR_ROOT < 0.07, 'its root at the arm\'s skin');
  assert.ok(new Set(spurs.map((d) => d.part)).size === 5, 'each spur its own part - its own colour\'s phase');
  const card = { ...rig, pose: newPose() };
  poseFromFigure({ base: 0, mpp: 0.02 }, card.pose);
  const seen = armoryDraws('crystalspurs', card, eye, true, [1, 0, 0]);
  assert.equal(seen.length, 2 * ARMORY_SPURS.filter((p) => p.seg === 'upper').length, 'a sprite: the upper arms alone');
  assert.ok(armoryRatesWhole());
  assert.ok(ARMORY_SPUR_GAIN < 1, 'not overbearing: under the other pieces\' full light');
});

test('THANKS-POST the spurs\' shader RUN: a prism\'s three colours - amethyst, aqua, rose - and as the clock turns the same point of a spur takes another; the tip brighter than the root; a facet facing the eye brighter than one turned away; never past the gain (mutants: the colour not turning, the tip not lit)', () => {
  const fs = armoryPrograms(ARMORY_PIECE_INDEX.crystalspurs)[0][1];
  assert.match(fs, /const int uPiece = 11;/);
  const at = (vP, { t = 3, facing = 1, part = 0 } = {}) => {
    const f = glslFunctions(fs, { vP, vS: [facing, 0.1, 0, 0], vWorld: [0, 1, 0], uMesh: 0, uPart: part, uTime: t, uSeed: 0, uKindle: 1, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 1, 3], uFace: 1, uScale: 1, uSize: 0, uGain: 1, uMirror: 1, uInk: [0, 0, 0], uField: [0, 0, 0] });
    f.main();
    return f.globals.o;
  };
  const a = at([0.5, 0.5], { t: 0 }), b = at([0.5, 0.5], { t: 7 }), c = at([0.5, 0.5], { t: 13 });
  const tone = (o) => { const m = Math.max(...o.slice(0, 3)); return o.slice(0, 3).map((x) => x / m); };
  const apart = (p, q) => Math.hypot(...[0, 1, 2].map((i) => tone(p)[i] - tone(q)[i]));
  assert.ok(Math.max(apart(a, b), apart(b, c), apart(a, c)) > 0.25, `the colour turns with the clock (${[a, b, c].map((o) => tone(o).map((x) => x.toFixed(2)).join(','))})`);
  const sum = (o) => o[0] + o[1] + o[2];
  // over a whole turn of the prism (the colour itself out of it), mid-facet (no edge, no glint): the tip brighter than the root
  const mean = (y) => { let n = 0; for (let t = 0; t < 20; t += 0.5) n += sum(at([3.5 / 6, y], { t })); return n / 40; };
  assert.ok(mean(0.95) > mean(0.05) * 1.4, `the tip brighter than the root (${mean(0.95).toFixed(3)}, ${mean(0.05).toFixed(3)})`);
  assert.ok(sum(at([0.5, 0.5], { facing: 1 })) > sum(at([0.5, 0.5], { facing: 0 })), 'a facet facing the eye brighter');
  for (let i = 0; i < 20; i++) { const o = at([i / 20, (i * 7 % 20) / 20], { t: i * 1.7 }); assert.ok(Math.max(...o.slice(0, 3)) <= 1.6 * ARMORY_SPUR_GAIN + 1e-6, 'never past the gain'); }
  assert.equal(PRISM_RGB.length, 3);
});

test('AUDIT lane 3 F5, F7: the Crystal Spurs in their prism off the world too - the button, its word and its ring - and a locked piece of any line dimmed; each spur one six-sided step, never a round tube\'s grid (mutants: the spurs a round tube, the prism unpainted, the locked look two lines\' alone)', () => {
  assert.deepEqual(ARMORY_LINE_GRADIENT.crystal.map((c) => c.slice(0, 3)), PRISM_RGB.map((c) => [...c]), 'the shader\'s prism');
  const css = badgeCss();
  assert.match(css, /\.card button\.acttitle\.actaura\.aura-crystal \{ color: #8c52ff; \}/);
  assert.match(css, /\.aura-crystal \.actauraword \{ background-image: linear-gradient\(90deg, #8c52ff, #38d9f2, #ff61b8\);/);
  const locked = /^(.*\.card button\.actarmory\.locked\.aura-[^{]*)\{ opacity: 0\.4; border-style: dashed; \}/m.exec(src('src/ui/enhanced/enhancedStyle.js'))?.[1] ?? '';
  assert.deepEqual(ARMORY_LINES.filter((l) => !locked.includes(`.card button.actarmory.locked.aura-${l}`)), [], 'every line\'s locked piece dimmed');
  const node = (tag) => ({ tag, attrs: {}, kids: [], setAttribute(k, v) { this.attrs[k] = v; }, append(...c) { this.kids.push(...c); } });
  const svg = auraRingNode({ createElementNS: (_, tag) => node(tag) }, 'crystal');
  const stops = svg.kids[0].kids[0].kids.map((k) => k.attrs['stop-color']);
  assert.deepEqual(stops, ['#8c52ff', '#38d9f2', '#ff61b8'], 'its ring');
  const rig = { at: [0, 0, 0], yaw: 0, pose: newPose(), vel: [0, 0, 0] }, eye = [0, 1.6, 3];
  assert.ok(armoryDraws('crystalspurs', rig, eye, true).every((d) => d.spike === true), 'each spur its own mesh');
  assert.ok(armoryDraws('ashbound', rig, eye, true).every((d) => !d.spike), 'the other pieces round');
  assert.equal(armoryTubeGrid(ARMORY_SPIKE_ROUND, 1).length, ARMORY_SPIKE_ROUND * 12, 'six sides, one step: 36 corners');
  assert.equal(ARMORY_SPIKE_ROUND, 6);
});
