// project-dagger entry point.
// Desktop-only. Hand-rolled WebGL2, no framework. Same doctrine as project-final.
// Scene router: ?interior, ?dungeon, ?world, or an exterior location
// by default (?region=<name>&loc=<name>). Scene details live in
// src/scenes/*.js headers.
//
// Controls: click to lock pointer, WASD + mouse to fly, Shift for speed.
// ?shot raises window.__shotReady at a fixed vantage for tools/screenshot.mjs.

import { Renderer } from './render/renderer.js';
import { windowEmissionRGB } from './render/windowEmission.js';
import { bootExterior } from './scenes/exterior.js';
import { bootInterior } from './scenes/interior.js';
import { bootDungeon } from './scenes/dungeon.js';
import { bootWorld } from './scenes/world.js';

import { ensureArena2 } from './scenes/dataSource.js';

async function boot() {
  const canvas = document.getElementById('c');
  const renderer = new Renderer(canvas);
  const params = new URLSearchParams(location.search);
  const status = (msg) => {
    document.title = `project-dagger - ${msg}`;
  };
  // Data gate: readers load user-supplied ARENA2 at runtime
  // (Port-Doctrine) - dev serves it via middleware, production asks
  // for the folder once and persists it in IndexedDB.
  await ensureArena2();
  // Window emission style for every scene. DFU's GetMaterial default is Day.
  renderer.setWindowEmission(windowEmissionRGB(params.get('window') || 'day'));
  if (params.has('interior')) return bootInterior(canvas, renderer, params, status);
  if (params.has('dungeon')) return bootDungeon(canvas, renderer, params, status);
  if (params.has('world')) return bootWorld(canvas, renderer, params, status);
  return bootExterior(canvas, renderer, params, status);
}

boot().catch((e) => {
  document.body.textContent = `boot failed: ${e.message}`;
  console.error(e);
});
