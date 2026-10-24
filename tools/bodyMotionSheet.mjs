// BODY-MOTION CONTACT SHEETS (bible/04-Characters/Body-Motion.md): the retail biped (test/fixtures/mw/retailRig.mjs - the
// vendored skeleton, no Morrowind data in hand) posed by the body-motion layer through a scene of frames, drawn as a
// skeleton from the side, the front, behind and three-quarters, and written as PNG pictures so a gait, a stance or a
// blow can be SEEN, not trusted: a planted foot stands still on the ground line across a stride's frames, a blade goes
// where its stance says. Every frame is the layer's own (characters/bodyMotion/bodyMotion.js), stepped at 60 Hz.
//
// Usage: node tools/bodyMotionSheet.mjs [outDir] [scene ...]   (outDir defaults to the system's temporary directory;
// scenes: walk run sneak strafe back turn idle one two wide spear dual fists, and the blows: one-chop one-slash
// one-back one-thrust two-chop two-slash two-thrust dual-slash fists-thrust ... - `list` prints them)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseNif } from '../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, skeletonSpaceMatrices, injectSkeletonNodes, GRAPH_ROOT } from '../src/formats/morrowind/mwSkin.js';
import { offWeaponBoneAddon } from '../src/combat/twoHands/mirrorRig.js';
import { retailSkeleton } from '../test/fixtures/mw/retailRig.mjs';
import { createBodyMotion, sceneInput } from '../src/characters/bodyMotion/bodyMotion.js';
import { MW_UNITS_PER_METER } from '../src/formats/morrowind/mwFirstPerson.js';

const out = process.argv[2] && !SCENE_NAME(process.argv[2]) ? process.argv[2] : join(tmpdir(), 'body-motion');
function SCENE_NAME(s) { return /^[a-z-]+$/.test(s) && !s.includes('/'); }
const asked = process.argv.slice(2).filter((s) => SCENE_NAME(s));
mkdirSync(out, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';

const skelMats = (sk, pose, root) => skeletonSpaceMatrices(sk, pose, root);
// the player's rig as the build stands it: retail's skeleton with the pair's Weapon Bone Left made by the mirror
// (formats/morrowind/mwFirstPerson.js assembleFirstPersonArm's `offWeaponBone`)
const skeletonFile = parseNif(retailSkeleton());
const skeleton = buildSkeleton(skeletonFile);
{
  const addon = offWeaponBoneAddon(skeleton, GRAPH_ROOT, skelMats, skeletonFile);
  if (addon) injectSkeletonNodes(skeleton, addon);
}

/** The scenes: each a frame bag for the layer (bodyMotion.js sceneInput's shape) and how long to watch. */
const SCENES = {
  idle: { seconds: 3, frames: 6, input: {} },
  walk: { seconds: 2, frames: 8, input: { forward: 1, speed: 4.43 } },
  slowwalk: { seconds: 2, frames: 8, input: { forward: 1, speed: 1.6 } },
  run: { seconds: 2, frames: 8, input: { forward: 1, speed: 8.1, running: true } },
  jog: { seconds: 2, frames: 8, input: { forward: 1, speed: 5.5, running: true } },
  sneak: { seconds: 2, frames: 8, input: { forward: 1, speed: 1.9, sneaking: true } },
  strafe: { seconds: 2, frames: 8, input: { strafe: 1, speed: 4.43 } },
  back: { seconds: 2, frames: 8, input: { forward: -1, speed: 4.43 } },
  turn: { seconds: 2, frames: 8, input: {}, yawRate: 1.6 },
  one: { seconds: 2, frames: 6, input: { weapon: 1 } },
  'one-walk': { seconds: 2, frames: 8, input: { weapon: 1, forward: 1, speed: 4.43 } },
  'one-run': { seconds: 2, frames: 8, input: { weapon: 1, forward: 1, speed: 8.1, running: true } },
  two: { seconds: 2, frames: 6, input: { weapon: 2 } },
  'two-walk': { seconds: 2, frames: 8, input: { weapon: 2, forward: 1, speed: 4.43 } },
  'two-run': { seconds: 2, frames: 8, input: { weapon: 2, forward: 1, speed: 8.1, running: true } },
  wide: { seconds: 2, frames: 6, input: { weapon: 5 } },
  'wide-run': { seconds: 2, frames: 8, input: { weapon: 5, forward: 1, speed: 8.1, running: true } },
  spear: { seconds: 2, frames: 6, input: { weapon: 6 } },
  'spear-run': { seconds: 2, frames: 8, input: { weapon: 6, forward: 1, speed: 8.1, running: true } },
  dual: { seconds: 2, frames: 6, input: { weapon: 1, hands: 'dual' } },
  'dual-walk': { seconds: 2, frames: 8, input: { weapon: 1, hands: 'dual', forward: 1, speed: 4.43 } },
  'dual-run': { seconds: 2, frames: 8, input: { weapon: 1, hands: 'dual', forward: 1, speed: 8.1, running: true } },
  fists: { seconds: 2, frames: 6, input: { weapon: -3, hands: 'fists' } },
  'fists-run': { seconds: 2, frames: 8, input: { weapon: -3, hands: 'fists', forward: 1, speed: 8.1, running: true } },
};
for (const [cls, type, hands] of [['one', 1, 'single'], ['two', 2, 'single'], ['wide', 5, 'single'], ['spear', 6, 'single'], ['dual', 1, 'dual'], ['dualL', 1, 'dual'], ['fists', -3, 'fists'], ['fistsL', -3, 'fists']]) {
  for (const blow of ['chop', 'slash', 'back', 'thrust']) {
    SCENES[`${cls}-${blow}`] = { seconds: 1.2, frames: 10, blow: { type: blow === 'back' ? 'slash' : blow, reversed: blow === 'back', hand: cls.endsWith('L') ? 'L' : 'R' }, input: { weapon: type, hands } };
    SCENES[`${cls}-${blow}-walk`] = { ...SCENES[`${cls}-${blow}`], input: { weapon: type, hands, forward: 1, speed: 4.43 } };
  }
}
if (asked[0] === 'list') { console.log(Object.keys(SCENES).join(' ')); process.exit(0); }

const BONE_COLOR = (name) => (/ l |l clavicle|left/i.test(name) ? '#3b7dd8' : / r |r clavicle|right/i.test(name) ? '#d8463b' : '#333');

/** One scene's frames: the layer stepped at 60 Hz, a pose sampled at each of `frames` points in its last second. */
function shoot(name, scene) {
  const motion = createBodyMotion();
  const dt = 1 / 60;
  // a blow is watched from a stance already held (PRE_ROLL seconds of it first)
  const pre = scene.blow ? Math.round(PRE_ROLL / dt) : 0;
  const total = Math.round(scene.seconds / dt) + pre;
  const sampleEvery = Math.max(1, Math.floor((scene.blow ? total - pre : Math.round(1 / dt)) / scene.frames));
  const firstSample = scene.blow ? pre : total - scene.frames * sampleEvery;
  const shots = [];
  let travel = [0, 0], yaw = 0;
  for (let i = 0; i < total; i++) {
    const t = i * dt;
    yaw += (scene.yawRate ?? 0) * dt;
    const blow = scene.blow && i >= pre ? blowAt(scene.blow, t - pre * dt, scene.seconds) : null;
    const input = sceneInput({ ...scene.input, yaw, blow, kind: 'male' });
    motion.step(dt, input);
    const sp = scene.input.speed ?? 0;
    const f = scene.input.forward ?? 0, s = scene.input.strafe ?? 0, m = Math.hypot(f, s) || 1;
    travel = [travel[0] + (s / m) * sp * dt * MW_UNITS_PER_METER, travel[1] + (f / m) * sp * dt * MW_UNITS_PER_METER];
    // the rig poses every frame (its clocks need the body measured), the sheet keeps the sampled ones
    const pose = new Map();
    for (const [ref, node] of skeleton.nodes) pose.set(ref, node.rest);
    const rep = motion.apply(skeleton, pose, GRAPH_ROOT, skelMats);
    if (i >= firstSample && (i - firstSample) % sampleEvery === 0 && shots.length < scene.frames) {
      const mats = skelMats(skeleton, pose, GRAPH_ROOT);
      shots.push({ t, mats, travel: travel.slice(), report: rep, status: motion.status() });
    }
  }
  return shots;
}
const PRE_ROLL = 0.8;
/** A blow's machine sections over `seconds`: wind-up a third, release a sixth, the follow the rest. */
function blowAt(blow, t, seconds) {
  const T = seconds * 0.85;
  const wEnd = T * 0.32, rEnd = T * 0.48;
  if (t >= T) return null;
  if (t < wEnd) return { ...blow, section: 'windup', progress: t / wEnd };
  if (t < rEnd) return { ...blow, section: 'release', progress: (t - wEnd) / (rEnd - wEnd) };
  return { ...blow, section: 'follow', progress: (t - rEnd) / (T - rEnd) };
}

/** The five views: each a projection of a rig point to [x, y] on a panel (y down), the travel laid on the side view. */
const VIEWS = {
  side: (p, tr) => [p[1] + tr[1], -p[2]],
  front: (p) => [p[0], -p[2]],
  back: (p) => [-p[0], -p[2]],
  three: (p) => { const c = Math.cos(0.75), s = Math.sin(0.75); return [p[0] * c + p[1] * s, -p[2] - (p[1] * c - p[0] * s) * 0.18]; },
  top: (p) => [p[0], -p[1]],
};

function svgOf(name, shots) {
  const W = 230, H = 300, S = 1.55;
  const rows = ['side', 'three', 'front', 'back', 'top'];
  const parts = [];
  const width = W * shots.length + 20, height = H * rows.length + 40;
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f6f4ee"/>`);
  parts.push(`<text x="10" y="22" font-family="monospace" font-size="16">${name}</text>`);
  rows.forEach((view, r) => {
    shots.forEach((shot, c) => {
      const ox = 10 + c * W + W / 2, oy = view === 'top' ? 40 + r * H + H / 2 : 40 + r * H + H - 20;
      const proj = (p) => { const [x, y] = VIEWS[view](p, view === 'side' ? [0, 0] : [0, 0]); return [ox + x * S, oy + y * S]; };
      parts.push(`<line x1="${ox - W / 2 + 6}" y1="${oy}" x2="${ox + W / 2 - 6}" y2="${oy}" stroke="#9a8" stroke-width="1"/>`);
      if (view === 'side') {
        // the ground's marks travel with the world: a planted foot stands still against them
        const off = shot.travel[1] % 20;
        for (let g = -100; g <= 100; g += 20) { const [gx] = proj([0, g - off, 0]); parts.push(`<line x1="${gx}" y1="${oy}" x2="${gx}" y2="${oy + 6}" stroke="#9a8"/>`); }
      }
      for (const [ref, node] of skeleton.nodes) {
        const nm = node.name.toLowerCase();
        if (!nm.startsWith('bip01') && nm !== 'weapon bone' && nm !== 'shield bone') continue;
        const pnode = skeleton.nodes.get(node.parent);
        if (!pnode || !pnode.name.toLowerCase().startsWith('bip01')) continue;
        if (/attach|onehand|twoclose|twowide|marksman|twohand/.test(nm)) continue;
        const a = shot.mats.get(node.parent)?.t, b = shot.mats.get(ref)?.t;
        if (!a || !b) continue;
        const [x1, y1] = proj(a), [x2, y2] = proj(b);
        parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${BONE_COLOR(node.name)}" stroke-width="${/finger/.test(nm) ? 1 : 3}" stroke-linecap="round"/>`);
      }
      // the head as a circle, the blade as a long line off the Weapon Bone's +Y, its edge as a tick
      const head = shot.mats.get(skeleton.byName.get('bip01 head'));
      if (head) { const [hx, hy] = proj([head.t[0], head.t[1], head.t[2] + 6]); parts.push(`<circle cx="${hx}" cy="${hy}" r="${7 * S}" fill="none" stroke="#333" stroke-width="2"/>`); }
      for (const [bone, color] of [['weapon bone', '#7a5'], ['weapon bone left', '#5a7']]) {
        const ref = skeleton.byName.get(bone);
        const m = ref != null ? shot.mats.get(ref) : null;
        const blade = shot.status?.blade?.[bone === 'weapon bone' ? 'R' : 'L'];
        if (!m || !blade) continue;
        const R = m.a; const s = Math.hypot(R[0], R[3], R[6]) || 1;
        const y = [R[1] / s, R[4] / s, R[7] / s], x = [R[0] / s, R[3] / s, R[6] / s];
        const tip = [m.t[0] + y[0] * blade, m.t[1] + y[1] * blade, m.t[2] + y[2] * blade];
        const pom = [m.t[0] - y[0] * blade * 0.22, m.t[1] - y[1] * blade * 0.22, m.t[2] - y[2] * blade * 0.22];
        const mid = [m.t[0] + y[0] * blade * 0.6, m.t[1] + y[1] * blade * 0.6, m.t[2] + y[2] * blade * 0.6];
        const edge = [mid[0] + x[0] * 4, mid[1] + x[1] * 4, mid[2] + x[2] * 4];
        const [a1, a2] = proj(pom), [b1, b2] = proj(tip), [c1, c2] = proj(mid), [d1, d2] = proj(edge);
        parts.push(`<line x1="${a1}" y1="${a2}" x2="${b1}" y2="${b2}" stroke="${color}" stroke-width="3"/>`);
        parts.push(`<line x1="${c1}" y1="${c2}" x2="${d1}" y2="${d2}" stroke="#c80" stroke-width="2"/>`);
      }
      if (r === 0) parts.push(`<text x="${ox - W / 2 + 6}" y="${40 + r * H + 14}" font-family="monospace" font-size="11">${shot.status?.label ?? ''}</text>`);
      if (c === 0) parts.push(`<text x="${ox - W / 2 + 6}" y="${40 + r * H + 28}" font-family="monospace" font-size="11" fill="#666">${view}</text>`);
    });
  });
  parts.push('</svg>');
  return parts.join('\n');
}

const names = asked.length ? asked : ['idle', 'walk', 'run', 'sneak', 'strafe', 'back', 'turn'];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const name of names) {
    const scene = SCENES[name];
    if (!scene) { console.error(`no scene "${name}" (list: node tools/bodyMotionSheet.mjs list)`); continue; }
    const svg = svgOf(name, shoot(name, scene));
    await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    const el = await page.$('svg');
    const file = join(out, `${name}.png`);
    await el.screenshot({ path: file });
    writeFileSync(join(out, `${name}.svg`), svg);
    console.log(file);
  }
} finally {
  await browser.close();
}
