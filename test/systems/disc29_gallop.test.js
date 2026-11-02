// DISC29-F (2026-09-28, Skibbster on Discord: ride into a building without stopping and the gallop keeps playing
// inside) - A MODE CHANGE STOPS THE RIDING LOOP, AS UPDATEMODE DOES.
//
// The riding sound is one named channel, `audio.setLoop('riding', ...)`, re-armed at every clip's end; only
// mountRig.frame ever wrote it null. The door dismounts through mountRig.setMode (TransportManager.HandleTransition ->
// UpdateMode(Foot)), which told the motor and the animator and left the channel running - and the frame that would
// have stopped it never came: the interior is up before another outdoor frame, and the indoor frame returns before the
// rig. DFU's UpdateMode stops the source first, on every change (TransportManager.cs:332-336). So does setMode now. The
// fixed-city host also never handed worldModes its dismount seam, so a rider stayed mounted through a door there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMountRig } from '../../src/player/mountRig.js';
import { AudioEngine } from '../../src/systems/audio.js';
import { SOUND } from '../../src/systems/soundClips.js';
import { TRANSPORT_MODES } from '../../src/systems/transport.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = (p) => readFileSync(join(ROOT, p), 'utf8');

/** The real engine over a context that plays nothing (auditdisc7's rig). */
function engine() {
  const param = () => ({ value: 0 });
  const e = new AudioEngine();
  e.ctx = {
    state: 'running', destination: { connect(n) { return n; } },
    listener: { positionX: param(), positionY: param(), positionZ: param(), forwardX: param(), forwardY: param(), forwardZ: param(), upX: param(), upY: param(), upZ: param() },
    createGain: () => ({ gain: param(), connect(n) { return n; }, disconnect() {} }),
    createPanner: () => ({ positionX: param(), positionY: param(), positionZ: param(), connect(n) { return n; }, disconnect() {} }),
    createBufferSource: () => ({ buffer: null, playbackRate: param(), loop: false, connect(n) { return n; }, start() {}, stop() {}, disconnect() {} }),
  };
  e.enabled = true;
  e._ensureCtx = () => {};
  for (const k of [SOUND.HorseClop2, SOUND.HorseClop, SOUND.HorseAndCart, SOUND.AnimalHorse]) e.buffers.set(k, { duration: 0.5 });
  return e;
}
/** A rider at a gallop: grounded, moving, running. */
function galloping() {
  const e = engine();
  const player = {
    grounded: true, transportMode: TRANSPORT_MODES.Foot, standing: false, isRunning: true, movingLessThanHalfSpeed: false, pos: null,
    setTransportMode(m) { this.transportMode = m; },
  };
  const rig = createMountRig({
    renderer: {}, canvas: null, fetchBytes: async () => { throw new Error('no ARENA2 here'); }, palette: null,
    audio: e, player, playerEntity: { items: [] }, showOverlay: () => {},
  });
  const frames = (n) => { for (let i = 0; i < n; i++) rig.frame(1 / 60); };
  return { e, player, rig, frames };
}

test('DISC29-F: the door\'s dismount stops the gallop at once - no further frame is needed', () => {
  const { e, rig, frames } = galloping();
  rig.setMode(TRANSPORT_MODES.Horse);
  frames(30);
  assert.ok(e._loops?.has('riding'), 'galloping: the hoof loop plays');
  rig.setMode(TRANSPORT_MODES.Foot);   // TransportManager.HandleTransition -> UpdateMode(Foot), at the door
  assert.equal(e._loops.has('riding'), false, 'UpdateMode: "stop any riding sounds playing" - before any frame');
  frames(5);
  assert.equal(e._loops.has('riding'), false, 'and on foot nothing starts it again');
});

test('DISC29-F: any change stops the old loop - a horse swapped for the cart mid-gallop, and the cart\'s own loop then starts', () => {
  const { e, rig, frames } = galloping();
  rig.setMode(TRANSPORT_MODES.Horse);
  frames(30);
  const horse = e._loops.get('riding');
  assert.ok(horse);
  rig.setMode(TRANSPORT_MODES.Cart);
  assert.equal(e._loops.has('riding'), false, 'the horse\'s clop does not ride on into the cart');
  frames(30);
  const cart = e._loops.get('riding');
  assert.ok(cart && cart !== horse, 'moving on, the cart\'s loop is made afresh');
});

test('DISC29-F: setMode stops the channel before the animator mounts the new mode', () => {
  const rig = src('src/player/mountRig.js');
  const fn = rig.slice(rig.indexOf('function setMode(mode) {'), rig.indexOf('return {', rig.indexOf('function setMode(mode) {')));
  const stop = fn.indexOf("audio.setLoop('riding', null);");
  assert.ok(stop > 0, 'the stop is in setMode');
  assert.ok(fn.indexOf('player.setTransportMode(mode);') < stop && stop < fn.indexOf('animator.mount(mode);'));
});

test('DISC29-F: every host that makes a mount rig hands worldModes its dismount seam', () => {
  const scenes = readdirSync(join(ROOT, 'src/scenes'), { recursive: true }).filter((f) => f.endsWith('.js'));
  const hosts = scenes.filter((f) => src(`src/scenes/${f}`).includes('createMountRig({'));
  assert.deepEqual(hosts.sort(), ['exterior.js', 'world.js'], 'the two hosts that ride');
  for (const f of hosts) {
    const text = src(`src/scenes/${f}`);
    const at = text.indexOf('createWorldModes({');
    assert.ok(at > 0, `${f} mounts worldModes`);
    const setup = text.slice(at, text.indexOf('\n  });', at));
    assert.match(setup, /\n\s+setTransportMode: \(mode\) => /, `${f}: TransportManager.HandleTransition's dismount reaches the rig`);
  }
});
