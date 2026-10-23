// HOME-LOOK (2026-09-30, asked: "The introduction of exterior customization. The ability to choose the texture for the
// roof, walls, door, windows, etc"). AN ONLINE HOME'S OUTSIDE, AS ITS OWNER PAINTS IT. The law both ends read
// (net/homeLaw.js homeLookOf); which part of a house a face is and what it wears (world/homeLook.js - Daggerfall's own
// families, through ApplyClimate so winter still snows on it); a painted house's own table (the pixel's climate swaps
// and the look over them, a record the archive lacks left to the town's); the service's write and the town's answer
// through the real Worker; the client's registry; the painter in the yard's panel; the world host by source.
// `06-Systems/Online-Arc.md` HOME-LOOK.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HOME_LOOK_PARTS, HOME_LOOK_CLIMATES, HOME_LOOK_SETS, HOME_LOOK_RECORD_MAX, homeLookOf, homeLookSig,
} from '../../src/net/homeLaw.js';
import { homeLookPart, homeLookTarget, homeLookRemap, homeLookSwatch, HOME_LOOK_WALL_FAMILIES } from '../../src/world/homeLook.js';
import { SEASON, isExteriorWindow } from '../../src/world/climateSwaps.js';
import { standService, T0 } from '../accountDb.mjs';
import { createOnlineHomes } from '../../src/systems/online/onlineHomes.js';
import { REFUSALS } from '../../src/net/accountClient.js';
import { decorLookText, decorLookStart } from '../../src/ui/decorPanel.js';
import { toolRig, settle, all } from '../decorFakes.mjs';
import { hostText } from '../hostText.mjs';   // HOST-SPLIT 2: the world host whole

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('HOME-LOOK the law: four parts; walls and windows a building set and a climate, a roof and a door a climate and a style; the frame\'s tapestry never chosen; a look refused whole; the parts in order; nothing changed is the town\'s own; text parsed (mutants: a part half kept; the tapestry chosen; an unknown set; the order)', () => {
  assert.deepEqual([...HOME_LOOK_PARTS], ['walls', 'windows', 'roof', 'door']);
  assert.deepEqual(HOME_LOOK_CLIMATES, { desert: 0, mountain: 100, temperate: 300, swamp: 400 });
  assert.equal(HOME_LOOK_SETS.manor, 38);
  assert.equal(HOME_LOOK_SETS.village, 64);
  const look = homeLookOf({ door: { climate: 'desert', record: 1 }, walls: { set: 'manor', climate: 'swamp' } });
  assert.deepEqual(Object.keys(look), ['walls', 'door'], 'in the parts\' order');
  assert.deepEqual(look, { walls: { set: 'manor', climate: 'swamp' }, door: { climate: 'desert', record: 1 } });
  assert.deepEqual(homeLookOf(JSON.stringify(look)), look, 'text parsed');
  assert.equal(homeLookOf({ door: { climate: 'desert', record: 3 } }), null, 'the tapestry is never chosen');
  assert.deepEqual(homeLookOf({ roof: { climate: 'desert', record: 3 } }), { roof: { climate: 'desert', record: 3 } }, 'a roof\'s third is a roof');
  assert.equal(homeLookOf({ roof: { climate: 'desert', record: HOME_LOOK_RECORD_MAX + 1 } }), null);
  assert.equal(homeLookOf({ walls: { set: 'hovel', climate: 'swamp' } }), null, 'an unknown set');
  assert.equal(homeLookOf({ walls: { set: 'manor', climate: 'swamp' }, chimney: {} }), null, 'an unknown part refuses the whole');
  assert.equal(homeLookOf({ walls: { set: 'manor', climate: 'moon' } }), null);
  assert.equal(homeLookOf({}), null, 'nothing changed: the town\'s own');
  assert.equal(homeLookOf({ walls: null }), null);
  assert.equal(homeLookOf('{not json'), null);
  assert.equal(homeLookSig(null), '');
  assert.equal(homeLookSig(look), JSON.stringify(look));
});

test('HOME-LOOK which part a face is and what it wears: roofs (69, and its winter) a roof, doors (74) a door but the frame\'s tapestry, a building set\'s window a window, its other records walls, anything else the town\'s; a wall keeps its record in the chosen set, a window is the set\'s third, a roof or a door the style chosen; winter snows on it where Daggerfall\'s would (mutants: the tapestry painted; the wall\'s record lost; the season unread; a fence painted)', () => {
  assert.equal(homeLookPart(369, 2), 'roof');
  assert.equal(homeLookPart(370, 2), 'roof', 'a winter roof');
  assert.equal(homeLookPart(374, 1), 'door');
  assert.equal(homeLookPart(374, 3), null, 'the tapestry');
  assert.equal(homeLookPart(364, 3), 'windows');
  assert.equal(isExteriorWindow(364, 3), true);
  assert.equal(homeLookPart(364, 5), 'walls');
  assert.equal(homeLookPart(329, 0), null, 'a fence is the town\'s');
  assert.equal(homeLookPart(210, 1), null);
  assert.equal(homeLookPart(510, 1), null, 'nature');
  assert.ok(HOME_LOOK_WALL_FAMILIES.has(65) && !HOME_LOOK_WALL_FAMILIES.has(69));
  const look = homeLookOf({ walls: { set: 'manor', climate: 'swamp' }, windows: { set: 'tavern', climate: 'desert' }, roof: { climate: 'temperate', record: 1 }, door: { climate: 'mountain', record: 2 } });
  assert.deepEqual(homeLookTarget(364, 5, look, SEASON.Summer), [438, 5], 'a swamp manor\'s fifth');
  assert.deepEqual(homeLookTarget(365, 5, look, SEASON.Winter), [439, 5], 'and its winter');
  assert.deepEqual(homeLookTarget(364, 3, look, SEASON.Summer), [58, 3], 'a desert tavern\'s window');
  assert.deepEqual(homeLookTarget(364, 3, look, SEASON.Winter), [58, 3], 'the desert never snows');
  assert.deepEqual(homeLookTarget(369, 4, look, SEASON.Summer), [369, 1], 'the roof\'s style');
  assert.deepEqual(homeLookTarget(69, 0, look, SEASON.Winter), [370, 1], 'a temperate roof in winter');
  assert.deepEqual(homeLookTarget(74, 0, look, SEASON.Winter), [174, 2], 'a door never snows');
  assert.equal(homeLookTarget(74, 3, look, SEASON.Summer), null);
  assert.equal(homeLookTarget(364, 5, homeLookOf({ roof: { climate: 'desert', record: 0 } }), SEASON.Summer), null, 'walls unchanged: the town\'s');
  assert.deepEqual(homeLookSwatch('walls', look.walls, SEASON.Summer), { archive: 438, record: 0 });
  assert.deepEqual(homeLookSwatch('windows', look.windows, SEASON.Summer), { archive: 58, record: 3 });
  assert.deepEqual(homeLookSwatch('door', look.door, SEASON.Summer), { archive: 174, record: 2 });
  assert.equal(homeLookSwatch('roof', null, SEASON.Summer), null);
});

test('HOME-LOOK a painted house\'s own table: its faces\' climate swaps carried from the pixel\'s, the look\'s targets over them (uploaded as the swap uploads), a record the target archive lacks left to the town\'s, a NEW table every time; no look is the pixel\'s swaps alone (mutants: the base dropped; the prune; the table reused)', async () => {
  const uploads = [];
  const deps = { getTexture: async (a) => ({ recordCount: a === 438 ? 8 : a === 369 ? 2 : 6 }), uploadRecord: (a, r, o) => uploads.push([a, r, o?.opaque]) };
  const base = new Map([['364_5', '364_5'], ['64_2', '364_2'], ['69_4', '369_4'], ['210_1', '210_1']]);
  const subs = [[64, 2], [364, 5], [69, 4], [210, 1]].map(([a, r]) => ({ textureArchive: a, textureRecord: r }));
  const look = homeLookOf({ walls: { set: 'manor', climate: 'swamp' }, roof: { climate: 'temperate', record: 5 } });
  const t = await homeLookRemap(subs, base, look, SEASON.Summer, deps);
  assert.equal(t.get('64_2'), '438_2', 'the wall painted');
  assert.equal(t.get('364_5'), '438_5');
  assert.equal(t.get('69_4'), '369_4', 'style 6 of a two-record archive: the town\'s own');
  assert.equal(t.get('210_1'), '210_1', 'not a house\'s part: the pixel\'s swap');
  assert.deepEqual(uploads, [[438, 2, true], [438, 5, true]]);
  const again = await homeLookRemap(subs, base, look, SEASON.Summer, deps);
  assert.notEqual(again, t, 'a new table (the renderer caches against its identity)');
  const plain = await homeLookRemap(subs, base, null, SEASON.Summer, deps);
  assert.deepEqual([...plain], [['64_2', '364_2'], ['364_5', '364_5'], ['69_4', '369_4'], ['210_1', '210_1']]);
});

test('HOME-LOOK the service: the owner paints their home and the town answers it to everyone - a guest too; another player paints nothing of it; a look the law refuses is refused; null paints it back the town\'s own (mutants: the owner unchecked; the look unread in the town; the refusal)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  const look = { walls: { set: 'manor', climate: 'swamp' }, door: { climate: 'desert', record: 1 } };
  const set = (body, who = owner) => svc.call('/v1/homes/look', { mapId: 7, buildingKey: 300, character: o.character, ...body }, who.secret);
  const r = await set({ look });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.look, homeLookOf(look));
  const g = await svc.guest();
  const town = await svc.call('/v1/homes/town', { mapId: 7 }, g.secret);
  assert.deepEqual(town.body.homes[0].look, homeLookOf(look), 'everyone sees it');
  const other = await svc.registered('Tomas');
  assert.equal((await svc.call('/v1/homes/look', { mapId: 7, buildingKey: 300, character: 'char-tomas', look: null }, other.secret)).body.error, 'no-home');
  const bad = await set({ look: { door: { climate: 'desert', record: 3 } } });
  assert.deepEqual([bad.status, bad.body.error], [400, 'bad-look']);
  assert.equal(typeof REFUSALS['bad-look'], 'string');
  assert.equal((await set({ look: null })).status, 200);
  const plain = await svc.call('/v1/homes/town', { mapId: 7 }, g.secret);
  assert.equal(plain.body.homes[0].look, undefined, 'the town\'s own');
});

test('HOME-LOOK the client\'s registry: a home\'s look is kept (a look the law refuses is none), my home painted is shown at once and read back, the town\'s homes are handed whole to the painter (mutants: the look dropped; the write not shown)', async () => {
  let asked = 0;
  const writes = [];
  const api = {
    town: async () => { asked++; return { ok: true, data: { homes: [
      { buildingKey: 1, owner: 'Olga', entry: 'private', mine: true, character: 'me', look: { roof: { climate: 'desert', record: 1 } } },
      { buildingKey: 2, owner: 'Tomas', entry: 'public', mine: false, look: { door: { climate: 'desert', record: 3 } } },
    ] } }; },
    look: async (b) => { writes.push(b); return { ok: true, data: { look: b.look } }; },
  };
  const homes = createOnlineHomes({ api, character: () => 'me' });
  await homes.ensure(7);
  assert.deepEqual(homes.homeAt(7, 1).look, { roof: { climate: 'desert', record: 1 } });
  assert.equal(homes.homeAt(7, 2).look, null, 'a look the law refuses is none');
  const v = homes.version();
  const r = await homes.setLook(7, 1, { walls: { set: 'village', climate: 'mountain' } });
  assert.equal(r.ok, true);
  assert.deepEqual(writes[0], { mapId: 7, buildingKey: 1, character: 'me', look: { walls: { set: 'village', climate: 'mountain' } } });
  assert.ok(homes.version() > v, 'shown at once');
  assert.deepEqual(homes.homesIn(7).get(1).look, { walls: { set: 'village', climate: 'mountain' } });
  assert.equal((await homes.setLook(7, 1, { walls: { set: 'x', climate: 'y' } })).error, 'bad-look', 'refused before it is sent');
  assert.equal(homes.homesIn(99), null, 'a town unheard');
  assert.ok(asked >= 1);
});

test('HOME-LOOK the painter, in the yard\'s panel: "Exterior" lists the four parts; a part chosen offers its climates and its sets or styles; each choice is tried on the house (the host\'s preview), "The town\'s own" clears it, "Paint it" writes the look, and a look left untried is put away; what each choice reads as (mutants: the preview unsent; the commit\'s look; the reset on leaving)', async () => {
  assert.equal(decorLookText('walls', null), 'The town\'s own');
  assert.equal(decorLookText('walls', { set: 'manor', climate: 'swamp' }), 'Manor, Swamp');
  assert.equal(decorLookText('roof', { climate: 'desert', record: 1 }), 'Desert, style 2');
  assert.deepEqual(decorLookStart('door'), { climate: 'temperate', record: 0 });
  const calls = [];
  // AUDIT: a family's count, as the door knows it - the temperate roof's holds three styles
  const door = { current: null, season: 0, records: (part, climate) => (part === 'roof' && climate === 'temperate' ? 3 : null), preview: (look) => calls.push(['preview', look]), commit: async (look) => { calls.push(['commit', look]); return { ok: true }; } };
  const r2 = toolRig({ room: { kind: 'home', yard: true, where: 'Your yard', mapId: 7, buildingKey: 300 }, look: () => door });
  r2.frame();
  assert.equal(r2.tool.openPanel(), true);
  for (let i = 0; i < 6; i++) { r2.frame({ overlayUp: true }); await settle(); }
  const root = () => r2.doc.body.children.find((c) => c.className === 'dfdecor');
  const chips = () => all(root(), 'dfdecor-chip');
  assert.deepEqual(chips().slice(0, 3).map((c) => c.textContent), ['Catalog', 'In this yard (0)', 'Exterior'], 'a yard\'s tabs');   // PIN MOVED (VOICE2): American spelling (Voice.md rule 8)
  chips().find((c) => c.textContent === 'Exterior').fire('click');
  r2.frame({ overlayUp: true });
  const rows = all(root(), 'dfdecor-row');
  assert.deepEqual(rows.map((r) => r.dataset.key), ['walls', 'windows', 'roof', 'door']);
  rows.find((r) => r.dataset.key === 'walls').fire('click');
  chips().find((c) => c.textContent === 'Manor').fire('click');
  chips().find((c) => c.textContent === 'Swamp').fire('click');
  assert.deepEqual(calls.at(-1), ['preview', { walls: { set: 'manor', climate: 'swamp' } }], 'tried on the house');
  all(root(), 'dfdecor-row').find((r) => r.dataset.key === 'roof').fire('click');
  r2.frame({ overlayUp: true });
  assert.deepEqual(chips().filter((c) => /^Style /.test(c.textContent)).map((c) => c.textContent), ['Style 1', 'Style 2', 'Style 3'], 'only the styles its family holds');
  all(root(), 'dfdecor-row').find((r) => r.dataset.key === 'door').fire('click');
  r2.frame({ overlayUp: true });
  assert.equal(chips().filter((c) => /^Style /.test(c.textContent)).length, 6, 'a count not known yet: six offered');
  chips().find((c) => c.textContent === 'Style 3').fire('click');
  assert.equal(chips().some((c) => c.textContent === 'Style 4'), false, 'the door\'s frame tapestry is never offered');
  assert.deepEqual(calls.at(-1), ['preview', { walls: { set: 'manor', climate: 'swamp' }, door: { climate: 'temperate', record: 2 } }]);
  all(root(), 'dfdecor-btn').find((b) => b.textContent === 'Paint it').fire('click');
  await settle(); await settle();
  assert.deepEqual(calls.find((c) => c[0] === 'commit')[1], { walls: { set: 'manor', climate: 'swamp' }, door: { climate: 'temperate', record: 2 } }, 'painted');
  assert.ok(r2.said.includes('Your house is painted.'));
  // leaving the painter puts a look tried away
  chips().find((c) => /^In this yard/.test(c.textContent)).fire('click');
  assert.ok(calls.some((c) => c[0] === 'preview' && c[1] === undefined), 'put away');
});

test('HOME-LOOK the world host by source: a town\'s homes are asked before its buildings are merged, a home stands out of the merge with its own table, drawn (and its shadow) with it; a look landed or changed repaints it where it stands, the older ask never over a newer; a merged home painted later rebuilds its pixel; the painter\'s preview is the owner\'s screen alone (mutants: the home merged; the draw on the pixel\'s table; the rebuild unmarked)', () => {
  const w = hostText('src/scenes/world.js');
  // AUDIT: a town heard before is never waited for again (a rebuild stalled a second and a half)
  assert.match(w, /if \(onlineHomes\.known\(homeTown\)\) onlineHomes\.ensure\(homeTown\)\.catch\(\(\) => \{\}\);\n\s*else \{ try \{ await onlineHomes\.waitFor\(homeTown, HOME_LOOK_BUILD_WAIT_MS\); \}/);
  // AUDIT: only a painted home, or this account's, leaves the merge - and an unpainted one draws with the pixel's table
  // (PIN MOVED, PRECIP4: in the pixel's own season - the snow at its middle on the snow lane)
  assert.match(w, /if \(homeRow && \(homeLook \|\| homeRow\.mine \|\| homeRow\.keeper\)\) \{[\s\S]{0,300}entry\.texRemap = homeLook \? await homeLookRemap\(gpu\.subMeshes, texRemap, homeLook, pixelSeason, pipeline\) : null;[\s\S]{0,80}\}\n\s*models\.push\(entry\);\n\s*if \(!entry\._home && !isCityGate/, 'a painted home stays out of the merge');
  // AUDIT: each pixel from the registry as its build read it, the publish asking for a refresh; a merged home rebuilds
  // its pixel for a look written or its becoming this account's, never for the painter's preview
  assert.match(w, /homeLookRead = onlineHomes\.version\(\) \* 1024 \+ host\._lookPreviewGen;/);
  assert.match(w, /_lookV: homeLookRead,/);
  assert.match(w, /if \(homeTown\) host\._homeLookV = -1;/);
  assert.match(w, /if \(!p\.homeTown \|\| p\._lookV === v\) continue;/);
  assert.match(w, /if \(!p\.homeKeys\.has\(bk\) && p\.buildingKeys\.has\(bk\) && \(\(row\?\.look && homeDecorShown\(row\)\) \|\| row\?\.mine \|\| row\?\.keeper\)\) merged = true;/);   // PIN MOVED: HOME-VOTE - a look counts only where it is shown (never lookOfHome: the preview)
  assert.match(w, /if \(!look\) \{ m\.texRemap = null; continue; \}/);
  assert.match(w, /else renderer\.drawMesh\(m\.gpu, m\._world, m\.texRemap \?\? p\.texRemap\);/);
  assert.match(w, /renderer\.recordShadowMesh\(m\.gpu, m\._world, m\.texRemap \?\? p\.texRemap\);   \/\/ HOME-LOOK/);
  assert.match(w, /if \(merged\) \{ _reskin\.mark\(key\); continue; \}/);
  assert.match(w, /\.then\(\(map\) => \{ if \(m\._home\.seq === seq\) m\.texRemap = map; \}/);
  assert.match(w, /if \(seasonsActive\) seasons\.tick\(\);[^\n]*\n\s*refreshHomeLooks\(\);   \/\/ HOME-LOOK/, 'on the exterior frame, beside the season\'s own');
  assert.match(w, /look: \{ preview: \(mapId, bk, look\) => previewHomeLook\(mapId, bk, look\), season: \(\) => season \}/);
  assert.match(src('server-account/src/service.js'), /'\/v1\/homes\/look',/);
});
