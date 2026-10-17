// HOTFIX 1003f (2026-10-03, the owner, live): "the arena button for the host needs to be on the screen. Not inside the
// pause menu" (ui/arena/arenaSessionButton.js, wired in scenes/world.js arenaFrame); "crackling still happens after the bout
// ends" (the verdict's roar, systems/arena/arenaCrowd.js); "get rid of the static crowd noise when cheering and booing"
// (systems/arena/arenaSound.js); "it shouldnt kick players after a bout" (world.js myHealth - the relay's 0 a fall, never a death).
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createArenaSessionButton, ARENA_SESSION_KEY } from '../../src/ui/arena/arenaSessionButton.js';
import { synthCheer, synthBoo, synthBed } from '../../src/systems/arena/arenaSound.js';

const all = (n) => (n?.children ?? []).flatMap((c) => (c?.tagName ? [c, ...all(c)] : []));

test('HOTFIX 1003f: the session\'s button stands on the screen while a session holds me, hidden otherwise; its press and the / key open the window (mutants: never shown; the key unheard; the key heard in a text field)', () => {
  let opened = 0;
  const listeners = {};
  const win = { addEventListener: (k, f) => { listeners[k] = f; }, removeEventListener: (k) => { delete listeners[k]; } };
  const doc = Object.create(document);
  doc.defaultView = win;
  const B = createArenaSessionButton({ open: () => { opened++; }, doc });
  B.frame(true);
  const btn = all(document.body).find((x) => String(x.className).includes('arena-session-btn'));
  assert.ok(btn, 'on the screen');
  assert.equal(btn.hidden, false);
  (btn.listeners?.click ?? []).forEach((f) => f({ preventDefault() {}, stopPropagation() {} }));
  assert.equal(opened, 1, 'its press opens the window');
  listeners.keydown({ code: ARENA_SESSION_KEY, target: { tagName: 'CANVAS' }, preventDefault() {} });
  assert.equal(opened, 2, 'and the / key');
  listeners.keydown({ code: ARENA_SESSION_KEY, target: { tagName: 'INPUT' }, preventDefault() {} });
  assert.equal(opened, 2, 'never in a text field');
  B.frame(false);
  assert.equal(btn.hidden, true, 'hidden out of a session');
  assert.equal(listeners.keydown, undefined, 'and its key let go');
  B.dispose();
});

test('HOTFIX 1003f: the host shows the button while a session holds this screen and no window stands; a relay bout never kills (mutant: the health written raw)', () => {
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /arenaSessionBtn\.frame\(!!arenaOnline\?\.inSession\?\.\(\) && !arenaDoorOpen\(\) && !townTalk\.overlay && hudRenderEnabled\(\)\)/);
  assert.match(w, /myHealth: \(hp\) => \{ if \(playerEntity\.health > 0\) \{ playerEntity\.health = Math\.max\(1, hp\);/);
});

test('HOTFIX 1003f: with the voices, the cheer, the boo and the bed are the voices alone - no noise under them (mutant: the noise kept)', () => {
  // a voice of silence: whatever sounds is the noise
  const hush = [new Float32Array(11025).fill(0)];
  for (const x of [synthCheer(hush), synthBoo(hush), synthBed(hush)]) assert.ok(x.every((v) => v === 0), 'nothing but the voices');
});

test('HOTFIX 1003i: the stands\' rail - a watcher on the terrace is held out of the sand\'s circle (a jump down stops at its edge), the sand\'s own never held, the host free; wired after the bout\'s ring (mutants: no rail; the rail on the sand; the host held)', async () => {
  const { standsRail, SAND_R, STANDS_RAIL_UP, TERRACE_UP } = await import('../../src/world/arena/arenaFloor.js');
  const c = [100, 50, 200];
  const rail = standsRail(c, c[1] + TERRACE_UP);
  assert.ok(rail, 'a watcher on the terrace is railed');
  assert.equal(rail.clamp([c[0], 0, c[2] - 30], 0.3), null, 'out on the terrace: where it stands');
  const back = rail.clamp([c[0], 0, c[2] - 10], 0.3);
  assert.ok(Math.abs(Math.hypot(back[0] - c[0], back[1] - c[2]) - (SAND_R + 0.3)) < 1e-9, 'a step over the edge put back at it');
  assert.equal(standsRail(c, c[1] + 0.1), null, 'on the sand: never held (a fighter, a ladder bout)');
  assert.equal(standsRail(c, c[1] + STANDS_RAIL_UP + 1, true), null, 'the host is free');
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /if \(!player\.arena\) player\.arena = arenaBouts\.ring\(\); if \(!player\.arena\) \{ const s = arenaOnline\?\.session\?\.\(\); player\.arena = standsRail\(/);
});

test('HOTFIX 1003j: my opponent on a relay\'s sand is the body inside my ring, by name else the nearest - never the room\'s first peer, now the stands are drawn (live: "Players arent taking damage now") (mutant: the first peer)', () => {
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  const fn = w.slice(w.indexOf('function arenaRivalBody()'), w.indexOf('function arenaRivalBody()') + 2000);
  assert.ok(!fn.includes('const peer = (peersNear() ?? [])[0];'), 'never the first peer the room holds');
  // HOTFIX 1003k: the floor's sand - arenaBouts.ring() is a ladder bout's alone (holds: `cur.ladder`), null between players
  assert.match(fn, /const sand = modes\?\.arenaFloorStage\?\.\(\)\?\.centre\?\.\(\) \?\? null/, 'the floor\'s own sand');
  assert.match(fn, /Math\.hypot\(p\.feet\[0\] - sand\[0\], p\.feet\[2\] - sand\[2\]\) <= SAND_R && Math\.abs\(p\.feet\[1\] - sand\[1\]\) < 2/, 'on the sand, at its height - never up in the stands');
  assert.ok(!fn.includes('arenaBouts.ring()'), 'never the ladder\'s ring');
  assert.match(fn, /const peer = onSand\.find\(\(p\) => vsName && online\?\.peers\?\.get\?\.\(p\.id\)\?\.name === vsName\) \?\? onSand\[0\];/, 'by name, else the nearest');
});

test('HOTFIX 1003l: the arena\'s floor draws the world\'s sky - after the opaque level, before the flats, the renderer told its programs ran (live: "the private sessions are missing the sky") (mutants: no sky; the shadows not told)', () => {
  const m = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(m, /drawArenaWall\(\); if \(isArenaFloor\(dungeonLoc\)\) host\.drawSky\?\.\(cam\.yaw, cam\.pitch/, 'the floor, and only the floor');
  const w = readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /drawSky: \(yaw, pitch, fov, aspect, vp\) => \{ sky\.draw\(yaw, pitch, fov, aspect, vp\); renderer\.markForeignPass\(\); \}/, 'the sky drawn, the renderer\'s shadows told');
});
