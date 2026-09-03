// G5: the teleport POPUP - DaggerfallTeleportPopUp's four rects, its
// centring, and the two answers. (The Teleport EFFECT - Recall - is
// the TP-slice's, in teleport.test.js; one window, one file.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TeleportPopUpWindow, TELEPORT_RECTS, TELEPORT_PANEL_W, TELEPORT_PANEL_H,
  TELEPORT_PANEL_X, TELEPORT_PANEL_Y, DESTINATION_LABEL_OFFSET,
  _setTeleportPopUpArtForTests, teleportPopUpArtLoaded,
} from '../src/ui/teleportPopUp.js';
import { serviceDestination } from '../src/systems/guildServiceFlow.js';
import { readFileSync } from 'node:fs';

const DEST = Object.freeze({ pixel: { x: 50, y: 120 }, name: 'Daggerfall' });
const mk = (over = {}) => {
  const log = { teleported: null, exited: 0 };
  const w = new TeleportPopUpWindow(DEST, {
    onTeleport: (pixel, name) => { log.teleported = { pixel, name }; },
    onExit: () => { log.exited++; },
    ...over,
  });
  return { w, log };
};
/** A point at the middle of a panel-relative rect. */
const mid = ([x, y, w, h]) => [TELEPORT_PANEL_X + x + w / 2, TELEPORT_PANEL_Y + y + h / 2];

test('G5: the panel is CENTRED, and mainPanelRect\'s own position is dead', () => {
  // TELE00I0 ships 171x57 and that IS mainPanelRect's size (:21).
  assert.equal(TELEPORT_PANEL_W, 171);
  assert.equal(TELEPORT_PANEL_H, 57);

  // DFU sets `Position = mainPanelRect.position` - which is (0, 50) -
  // and THEN sets HorizontalAlignment.Center and
  // VerticalAlignment.Middle. BaseScreenComponent's alignment
  // switches (:1205-1230) assign rectangle.x/.y outright on every arm
  // but `None`, so the position never reaches the screen. A port that
  // took the rect wholesale would put the box thirty pixels high and
  // hard against the left edge.
  assert.equal(TELEPORT_PANEL_X, 75, '(320 - 171) / 2, rounded');
  assert.equal(TELEPORT_PANEL_Y, 72, '(200 - 57) / 2, rounded');
  assert.notEqual(TELEPORT_PANEL_X, 0);
  assert.notEqual(TELEPORT_PANEL_Y, 50, 'the rect says 50 and the screen does not');
  // both halves land at .5 and round the same way every other centred
  // panel in this port rounds
  assert.equal((320 - TELEPORT_PANEL_W) / 2, 74.5);
  assert.equal((200 - TELEPORT_PANEL_H) / 2, 71.5);

  // the three rects, verbatim (:22-24), and all of them inside the panel
  assert.deepEqual(TELEPORT_RECTS.destination, [5, 15, 161, 8]);
  assert.deepEqual(TELEPORT_RECTS.yes, [4, 38, 52, 15]);
  assert.deepEqual(TELEPORT_RECTS.no, [115, 38, 52, 15]);
  assert.deepEqual(DESTINATION_LABEL_OFFSET, [1, 1]);
  for (const [key, [x, y, w, h]] of Object.entries(TELEPORT_RECTS)) {
    assert.ok(x >= 0 && y >= 0 && x + w <= TELEPORT_PANEL_W && y + h <= TELEPORT_PANEL_H, key);
  }
  // yes is LEFT of no and they do not overlap
  assert.ok(TELEPORT_RECTS.yes[0] + TELEPORT_RECTS.yes[2] < TELEPORT_RECTS.no[0]);
});

test('G5: YES hands the destination back, NO hands nothing back', () => {
  const { w, log } = mk();
  assert.equal(w.done, false);
  w.input('KeyY');
  assert.deepEqual(log.teleported, { pixel: { x: 50, y: 120 }, name: 'Daggerfall' });
  assert.equal(log.exited, 0, 'a teleport is not an exit');
  assert.equal(w.done, true, 'and the box closes either way');

  const no = mk();
  no.w.input('KeyN');
  assert.equal(no.log.teleported, null);
  assert.equal(no.log.exited, 1);
  assert.equal(no.w.done, true);

  // Escape and E are the port's own on a Yes/No box, as everywhere
  for (const code of ['Escape', 'KeyE']) {
    const t = mk();
    t.w.input(code);
    assert.equal(t.log.teleported, null, code);
    assert.equal(t.log.exited, 1, code);
  }
  // Enter agrees with Y - the box has one affirmative
  const enter = mk();
  enter.w.input('Enter');
  assert.ok(enter.log.teleported);
  // an unrelated key does nothing at all
  const idle = mk();
  idle.w.input('KeyQ');
  assert.equal(idle.w.done, false);
  assert.equal(idle.log.teleported, null);
  assert.equal(idle.log.exited, 0);
});

test('G5: the two buttons hit where the rects say, and the panel swallows the rest', () => {
  const yes = mk();
  assert.equal(yes.w.click(...mid(TELEPORT_RECTS.yes)), true);
  assert.deepEqual(yes.log.teleported.pixel, { x: 50, y: 120 });

  const no = mk();
  no.w.click(...mid(TELEPORT_RECTS.no));
  assert.equal(no.log.exited, 1);
  assert.equal(no.log.teleported, null);

  // the rects are PANEL-RELATIVE: the same coordinates without the
  // panel offset are not on either button
  const stray = mk();
  stray.w.click(TELEPORT_RECTS.yes[0] + 2, TELEPORT_RECTS.yes[1] + 2);
  assert.equal(stray.log.teleported, null, 'the raw rect is off-panel');
  assert.equal(stray.log.exited, 0);
  assert.equal(stray.w.done, false);

  // ...and a modal swallows the click anyway, so nothing behind it
  // gets a look in
  assert.equal(stray.w.click(0, 0), true);
  assert.equal(stray.w.click(319, 199), true);
  assert.equal(stray.w.done, false);

  // the boundary: the last pixel of a button is IN, the next is out
  const [bx, by, bw, bh] = TELEPORT_RECTS.no;
  const edge = mk();
  edge.w.click(TELEPORT_PANEL_X + bx + bw - 0.5, TELEPORT_PANEL_Y + by + bh - 0.5);
  assert.equal(edge.log.exited, 1);
  const past = mk();
  past.w.click(TELEPORT_PANEL_X + bx + bw, TELEPORT_PANEL_Y + by + bh);
  assert.equal(past.log.exited, 0, 'one pixel past is off the button');
});

test('G5: a missing TELE00I0 does not close the door', () => {
  // The travel map RETHROWS a missing IMG so the host can refuse to
  // open a blank map; this panel's loader swallows instead, because a
  // missing yes/no box must not take the whole teleport service down
  // with it. The window draws a plain rect and the labels it needs.
  _setTeleportPopUpArtForTests(null);
  assert.equal(teleportPopUpArtLoaded(), false);
  const { w, log } = mk();
  const drawn = [];
  const renderer = { drawScreenQuad: (tex, r) => drawn.push(r) };
  const font = { tex: null, fnt: { fixedHeight: 6, glyphWidth: () => 4 } };
  w.draw(renderer, { width: 1280, height: 800 }, font);
  assert.ok(drawn.length > 0, 'something was painted');
  // and it still answers
  w.input('KeyY');
  assert.ok(log.teleported);
});

test('G5: the service destination is no longer a FLAGGED null', () => {
  assert.equal(serviceDestination('Teleport'), 'guildServiceTeleport');
});

test('G5: the host arm keeps the ARRIVAL and drops the JOURNEY', () => {
  // TeleportAway (:134-150) is two calls: TransitionExterior when the
  // player is inside, then TeleportToCoordinates. Everything fast
  // travel wraps around that same second call - the gold, the clock,
  // the arrival clamp, the cautious heal - is the journey, and a
  // teleport has none of it. This is a host law with no seam to drive
  // from a unit test, so it is pinned at its source: the shape a
  // future copy-paste from fastTravelTo would break.
  const src = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const i = src.indexOf('async function teleportTo(pick)');
  assert.ok(i > 0, 'the host arm exists');
  const body = src.slice(i, src.indexOf('\n  }', i));

  // what it KEEPS
  assert.ok(body.includes('forceExitToExterior()'), 'TransitionExterior first');
  assert.ok(body.includes('_teleportToPixel(pick.pixel.x, pick.pixel.y)'), 'then the coordinates');
  assert.ok(body.indexOf('forceExitToExterior') < body.indexOf('_teleportToPixel'),
    'and in that order - you cannot teleport out of a building');
  // OnInitWorld's weather half runs for a teleport exactly as it does
  // for fast travel, because it hangs off the same call
  assert.ok(body.includes('applyClimateWeather('), 'the destination climate lands');

  // what it DROPS, each of which fastTravelTo does
  for (const journey of ['deductGold', 'deductGoldPieces', 'playerTicker.advance',
    'arrivalClampMinutes', 'speedCautious', 'tickWeather(']) {
    assert.equal(body.includes(journey), false, `a teleport has no ${journey}`);
  }
  // ...and fastTravelTo really does all six, so the list is not a
  // straw man
  const j = src.indexOf('async function fastTravelTo(pick, opts, computed)');
  const travelBody = src.slice(j, src.indexOf('\n  }', j));
  for (const journey of ['deductGold', 'deductGoldPieces', 'playerTicker.advance',
    'arrivalClampMinutes', 'speedCautious', 'tickWeather(']) {
    assert.ok(travelBody.includes(journey), `fast travel does ${journey}`);
  }
});

test('G5: the service reaches the map through a HOST DOOR, and a host without one refuses', () => {
  // The interior arm cannot build this window: the travel map's
  // dependency list is the world's (the map reader, the player pixel,
  // the climate reader) and only the world host has a streaming world
  // to land in. So the service asks `host` for one, exactly as G8's
  // revealLocation does - and a host that answers nothing gets the
  // popup's own "not available yet" arm rather than a crash.
  const modes = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const i = modes.indexOf("destination === 'guildServiceTeleport'");
  assert.ok(i > 0, 'the arm exists');
  const arm = modes.slice(i, modes.indexOf('\n    }', i));
  assert.ok(arm.includes('host.openTeleportMap?.()'), 'it asks the host, optionally');
  assert.ok(arm.includes('if (!win) return null;'), 'and a host without one refuses');
  // it returns the window as WELL as mounting it: an arm that mounts
  // itself and answers null cannot be told apart from a service that
  // does not exist, and the popup needs the difference to know
  // whether to close
  // ROAD-F GS1: one statement does both now - mountServiceWindow puts
  // the window in the slot the CURRENT mode draws and hands it back.
  assert.ok(arm.includes('return mountServiceWindow(win);'), 'mounted and returned');

  // the WORLD host supplies the door and arms the map; the other
  // hosts do not, which is why the arm has to be optional
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.ok(world.includes('openTeleportMap,'), 'the world host passes it in');
  const j = world.indexOf('function openTeleportMap()');
  assert.ok(j > 0);
  const door = world.slice(j, world.indexOf('\n  }', j));
  // U61: the gate is the DOOR's predicate now - the same "no art, no
  // map" law on the classic skin, and no art needed on the enhanced.
  assert.ok(door.includes('travelMapDoorReady()'), 'no door, no map - the U8 idiom through U61\'s door');
  // DFU arms the window and only THEN pushes it
  // (DaggerfallGuildServicePopupWindow.cs:414-418: CloseWindow,
  // ActivateTeleportationTravel, PushWindow) - a map handed over
  // unarmed is the ordinary fast-travel map and would charge the
  // player for the trip.
  assert.ok(door.includes('activateTeleportationTravel()'), 'and arms the map');
  assert.ok(door.indexOf('travelMapArtLoaded()') < door.indexOf('activateTeleportationTravel()')
    && door.indexOf('activateTeleportationTravel()') < door.indexOf('return win'),
  'art gate, then arm, then hand over');

  // The other hosts have no streaming world to land in - no map
  // reader, no map dict, no player pixel - so they supply no door,
  // which is what makes the arm's `?.` real rather than defensive.
  // They may SAY so (dungeonContext explains beside the journal's
  // find-place seam why it leaves the map to the outer host); the
  // scan therefore runs over comment-stripped source, so that prose
  // about the seam is free and a second implementation of it is not.
  const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.ok(stripComments(world).includes('openTeleportMap,'),
    'the stripper reads CODE - the world host\'s own door survives it');
  for (const other of ['exterior.js', 'dungeonContext.js']) {
    const src = stripComments(readFileSync(new URL(`../src/scenes/${other}`, import.meta.url), 'utf8'));
    assert.equal(/openTeleportMap/.test(src), false, `${other} has no streaming world to land in`);
  }
});
