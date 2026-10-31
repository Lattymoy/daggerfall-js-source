// PVP-CONE (as the owner asked, and
// "Yes" to everywhere; bible/11-Multiplayer/PvP-Rework.md): another player's tag shows only within about 20 degrees of
// the crosshair, faded in and out; my party and my foe of the last minute always show.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NAME_CONE, nameOffDeg, nameConeTarget, nameConeStep } from '../../src/ui/nameCone.js';
import { RemotePlayers, PEER_HEIGHT } from '../../src/net/remotePlayers.js';
import { createNameLayer } from '../../src/ui/nameLayer.js';
import { createPvpFlagHost, pvpFoeOf } from '../../src/scenes/pvpFlagHost.js';
import { PVP_FLAG } from '../../src/systems/wild/pvpFlag.js';
import { perspective, mirrorProjectionX, lookAt } from '../../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const VIEW = lookAt([0, 1.7, 0], [0, 1.7, -10], [0, 1, 0]);
const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000));
const at = (deg, y = 1.7) => [10 * Math.sin(deg * Math.PI / 180), y, -10 * Math.cos(deg * Math.PI / 180)];

function fakeNode(tag) {
  const n = { tagName: tag.toUpperCase(), children: [], parent: null, id: '', attrs: {}, className: '', textContent: '' };
  n.append = (...cs) => { for (const c of cs) { c.parent = n; n.children.push(c); } };
  n.setAttribute = (k, v) => { n.attrs[k] = v; };
  n.remove = () => { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; };
  n.style = {};
  return n;
}
function fakeDocument() {
  const doc = { createElement: (t) => fakeNode(t), head: fakeNode('head'), body: fakeNode('body') };
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}

test('PVP-CONE THE LAW (ui/nameCone.js): 20 degrees with a 6-degree band - full inside 17, none past 23; a point with no angle, my party or my foe always whole (AUDIT FB1029g R4: no board rides the names\' pass); the step eases over 250 ms (mutants: the band unread; the near unread; the step unclamped)', () => {
  assert.deepEqual(NAME_CONE, { deg: 20, band: 6, fadeMs: 250 });
  assert.equal(nameConeTarget({ off: 0 }), 1);
  assert.equal(nameConeTarget({ off: 17 }), 1);
  assert.equal(nameConeTarget({ off: 20 }), 0.5);
  assert.equal(nameConeTarget({ off: 23 }), 0);
  assert.equal(nameConeTarget({ off: 90 }), 0);
  assert.equal(nameConeTarget({ off: 90, near: true }), 1, 'my party or my foe');
  assert.equal(nameConeTarget({ off: 90, kind: 'board' }), 0, 'PIN MOVED (AUDIT FB1029g R4): no kind stands outside the cone - the boards\' count went with the boards');
  assert.equal(nameConeTarget({}), 1, 'a host that says no angle: as it always was');
  assert.equal(nameConeStep(NaN, 0.4, 0), 0.4, 'a new tag starts where it stands');
  assert.equal(nameConeStep(1, 0, 125), 0.5, 'half the fade in half its time');
  assert.equal(nameConeStep(0, 1, 1000), 1, 'never past its target');
  assert.equal(nameConeStep(0.5, 0.5, 16), 0.5);
});

test('PVP-CONE THE ANGLE (net/remotePlayers.js namePoints): each point carries its degrees off the camera forward, the head read off the view matrix - the lens, the mirror and the screen size play no part (mutants: the angle dropped; the depth axis signed wrong)', () => {
  assert.ok(Math.abs(nameOffDeg(VIEW, at(0)) - 0) < 1e-6);
  assert.ok(Math.abs(nameOffDeg(VIEW, at(30)) - 30) < 1e-6);
  assert.ok(Math.abs(nameOffDeg(VIEW, at(-15)) - 15) < 1e-6);
  assert.ok(Math.abs(nameOffDeg(VIEW, [0, 1.7, 10]) - 180) < 1e-6, 'behind me');
  const rp = new RemotePlayers({ renderer: { drawScreenQuad() {}, drawScreenQuadRun() {} }, deps: null, compose: async () => null });
  rp.sync([{ id: 'peer-a', name: 'Example Player', shown: { x: at(25)[0], y: 0, z: at(25)[2], yaw: 0 }, look: null }], (p) => [p.x, p.y, p.z], { bodyHeight: () => PEER_HEIGHT });
  const [p] = rp.namePoints(PROJ, VIEW, 1600, 900, [0, 1.7, 0], (q) => [q.x, q.y, q.z]);
  assert.ok(p.off > 24 && p.off < 26, `a head 25 degrees right: ${p.off}`);
});

test('PVP-CONE THE TAG (ui/nameLayer.js): the whole tag fades by the cone, eased by the clock - a new tag starts where it stands, a look away fades it out over 250 ms and hides it; full opacity writes nothing (mutants: the cone unworn; the ease skipped)', () => {
  let clock = 0;
  const pt = (off, near) => ({ id: 'peer-a', name: 'Example Player', x: 800, y: 400, scale: 1, off, near });
  const layer2Doc = fakeDocument();
  const l2 = createNameLayer({ doc: layer2Doc, now: () => clock });
  l2.render({ points: [pt(5)] });
  const find = (n) => (n.className === 'dfname' ? n : n.children.map(find).find(Boolean));
  const tag = find(layer2Doc.body);
  assert.ok(tag, 'the tag is in the page');
  assert.equal(tag.style.opacity ?? '', '', 'whole: nothing written');
  clock = 125; l2.render({ points: [pt(90)] });
  assert.equal(tag.style.opacity, '0.50', 'half way out');
  clock = 250; l2.render({ points: [pt(90)] });
  assert.equal(tag.style.opacity, '0.00');
  assert.equal(tag.style.visibility, 'hidden');
  clock = 300; l2.render({ points: [pt(90, true)] });
  assert.equal(tag.style.opacity, '0.20', 'my foe comes back, faded in');
  assert.equal(tag.style.visibility, '');
  clock = 600; l2.render({ points: [pt(90, true)] });
  assert.equal(tag.style.opacity, '');
  const l3Doc = fakeDocument();
  createNameLayer({ doc: l3Doc, now: () => clock }).render({ points: [pt(90)] });
  assert.equal(find(l3Doc.body).style.visibility, 'hidden', 'a new tag past the cone starts hidden, no pop in');
});

test('PVP-CONE THE NEAR (scenes/pvpFlagHost.js): my foe is a peer I struck or was struck by within PVP_FLAG.lockMs, and my party is near too; the host passes its social picture through the one mask it had (mutants: the foe unnoted; the lock unread; the party unasked)', () => {
  let clock = 0;
  const f = createPvpFlagHost(() => ({ id: 'peer-me', wildOk: true, setWildFlag: () => {} }), { level: 30 }, () => {}, { say: () => {} }, { doc: null, now: () => clock });
  f.heard({ k: 'hp', by: 'peer-me', to: 'peer-x' });
  f.heard({ k: 'hp', by: 'peer-y', to: 'peer-me' });
  f.heard({ k: 'hp', by: 'peer-q', to: 'peer-r' });
  assert.deepEqual(['peer-x', 'peer-y', 'peer-q', 'peer-r'].map(f.foeOf), [true, true, false, false]);
  assert.equal(pvpFoeOf('peer-x'), true, 'the door outside the host');
  clock = PVP_FLAG.lockMs - 1;
  assert.equal(f.foeOf('peer-x'), true);
  clock = PVP_FLAG.lockMs;
  assert.equal(f.foeOf('peer-x'), false, 'a minute on, no foe');
  const social = { isPartyPeer: (id) => id === 'peer-p' };
  const mask = f.mask((p) => p, social);
  assert.deepEqual(mask({ id: 'peer-p', name: 'A' }), { id: 'peer-p', name: 'A', near: true });
  assert.deepEqual(mask({ id: 'peer-s', name: 'B' }), { id: 'peer-s', name: 'B' });
  assert.deepEqual(mask({ id: 'peer-p', kind: 'board' }), { id: 'peer-p', kind: 'board', near: true }, 'PIN MOVED (AUDIT FB1029g R4): a point is a player\'s, whatever its kind');
  assert.ok(rd('src/scenes/world.js').includes('      mask: pvpFlag.mask(wildNameMask, social),'));
  assert.ok(rd('src/scenes/world.js').includes('      layer: nameLayer,'), 'the DOM face the players see wears it');
});
