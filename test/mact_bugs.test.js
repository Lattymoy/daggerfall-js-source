// MAC-T (2026-09-18, Mac's play report on the deployed build): "when typing in chat, if typing H, it triggers you
// switching your weapon hand".
//
// T2 - THE SAME ROOT AS JANOME'S HAND SWITCH, MET FROM THE CHAT LINE. The chat panel stops the field's keydown in the
// window's CAPTURE phase (CG2 / AUDIT CHAT D2), so the host's bubble listener never fills its ring from a typed line -
// and it listens to keydown ALONE. The host's keyup listener is ungated, so a typed H's RELEASE reached
// `noteKeyUp` and the frame read it as SwitchHand's up edge (DFU fires SwitchHand on ActionComplete). JAN1 made the
// ring release only what it captured (`own`): an up whose down the ring never saw is a window's - or a chat line's -
// and not the player's. This pin drives the real panel and the real ring through both phases, so the chat case is
// held by name and not by the transport window's.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { keyEdges, noteKeyDown, noteKeyUp, beginInputFrame, released, setBindings } from '../src/ui/input.js';
import { createBindings, resetDefaults } from '../src/systems/inputActions.js';
import { ChatLog } from '../src/net/chat.js';
import { createChatPanel } from '../src/ui/chatPanel.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const defaults = () => { const b = createBindings(); resetDefaults(b); return b; };

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), focused: false, scrollTop: 0, scrollHeight: 100, clientHeight: 100,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener(t, fn) { const l = n.listeners.get(t) ?? []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    focus() { n.focused = true; doc.activeElement = n; },
    blur() { n.focused = false; if (doc.activeElement === n) doc.activeElement = null; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
/** Both phases for BOTH key events (chat1's window carries keydown alone): the capture pass, then - unless propagation
 *  was stopped - the bubble pass, where the host's own listeners live (world.js: `keys.add(e.code); noteKeyDown(...)`
 *  on the down, `keys.delete(e.code); noteKeyUp(...)` on the up). */
function fakeWindow() {
  const listeners = [];
  const dispatch = (type, code, e) => {
    const ev = { type, code, target: null, isTrusted: true, prevented: false, stopped: false, immediate: false, repeat: false,
      preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; },
      stopImmediatePropagation() { ev.stopped = true; ev.immediate = true; }, ...e };
    for (const l of listeners) { if (ev.immediate) break; if (l.t === type && l.capture) l.fn(ev); }
    if (!ev.stopped) for (const l of listeners) if (l.t === type && !l.capture) l.fn(ev);
    return ev;
  };
  return {
    listeners,
    addEventListener(t, fn, capture) { listeners.push({ t, fn, capture: capture === true || capture?.capture === true }); },
    removeEventListener(t, fn) { const i = listeners.findIndex((l) => l.t === t && l.fn === fn); if (i >= 0) listeners.splice(i, 1); },
    key(code, e = {}) { return dispatch('keydown', code, e); },
    keyup(code, e = {}) { return dispatch('keyup', code, e); },
  };
}
const defaultAction = (e) => (e.code === 'Enter' ? 'ActivateCursor' : null);

test('MAC-T2: an H typed into the chat line switches no hand - the field stops the down in capture, the host\'s ungated keyup still runs, and the ring releases only what it captured; the same H on the canvas still switches', () => {
  setBindings(defaults());
  const doc = fakeDocument(), win = fakeWindow();
  // the host's shape: bubble, on the window, feeding the held Set and the edge ring (world.js:5473 / :5640)
  const keys = new Set(); const edge = keyEdges();
  win.addEventListener('keydown', (e) => { keys.add(e.code); noteKeyDown(edge, e.code, e.repeat); });
  win.addEventListener('keyup', (e) => { keys.delete(e.code); noteKeyUp(edge, e.code); });
  const log = new ChatLog();
  const panel = createChatPanel({ log, onSend: () => true, action: defaultAction, doc, win, touch: false });
  assert.equal(win.listeners.filter((l) => l.t === 'keyup').length, 1, 'the panel adds NO keyup listener - the host\'s is the only one, ungated, so the ring\'s own gate is what stands between a chat line and the hand');

  // the player opens the chat and types "h"
  win.key('Enter', { target: doc.body }); win.keyup('Enter', { target: doc.body });
  assert.equal(log.open, true); assert.equal(panel.input.focused, true, 'the caret in the field');
  const down = win.key('KeyH', { target: panel.input });
  assert.equal(down.stopped, true, 'the field\'s down is stopped at the window (CG2)');
  assert.equal(keys.has('KeyH'), false, 'the held Set never saw it');
  const up = win.keyup('KeyH', { target: panel.input });
  assert.equal(up.stopped, false, 'the release is NOT stopped - it reaches the host\'s keyup listener, as it did on the deployed build');
  beginInputFrame(edge);
  assert.equal(released(edge, keys, 'SwitchHand'), false, 'MAC-T2: the frame reads no SwitchHand release off a chat line');
  assert.equal(edge.upFrame.size, 0, 'the up ring is empty: an up with no down of its own is the field\'s, not the player\'s');

  // the contrast: the chat closed, the same key on the canvas is the player's and switches
  win.key('Escape', { target: panel.input }); win.keyup('Escape', { target: panel.input });
  assert.equal(log.open, false);
  win.key('KeyH', { target: doc.body }); win.keyup('KeyH', { target: doc.body });
  beginInputFrame(edge);
  assert.equal(released(edge, keys, 'SwitchHand'), true, 'the player\'s own H still switches hands on its release');
  panel.destroy();

  // by source: the gate, and the host feeding the ring from BOTH events with no field check of its own (the field's
  // key is stopped before it - the panel's law, not the host's)
  assert.match(rd('src/ui/input.js'), /export function noteKeyUp\(edges, code\) \{ if \(!edges\) return; if \(edges\.own && !edges\.own\.delete\(code\)\) return; edges\.up\.add\(code\); \}/);
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = rd(host);
    assert.match(h, /addEventListener\('keyup', \(e\) => \{ keys\.delete\(e\.code\); noteKeyUp\(latch\.edge, e\.code\);/, `${host}: the ungated keyup feeds the ring`);
  }
});
