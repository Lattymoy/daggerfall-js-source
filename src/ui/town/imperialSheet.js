// @ts-check
// ═══════════════════════════════════════════════════════════════════
// IC-TOWNMAP (2026-10-26; the owner: "Curious how the town map will look", and his go-ahead for the city's own map) -
// THE IMPERIAL CITY ON THE HELD MAP: the town sheet of a city twenty kilometres across.
//
// A slice of the Imperial City is a location of Daggerfall's shape - eight by eight blocks - and the town sheet
// (ui/town/townSheet.js) drew it as one: the bytes of the blocks the player stands among. That is a sixty-fourth of a
// city whose walls, avenues and landmarks are the port's own (world/imperialCity.js), and whose districts' streets and
// buildings are the port's own fabric (world/imperialFabric.js) - none of it in an automap byte. So in any of the city's
// slices the sheet is THE CITY, drawn from its plan:
//
//   - AT CITY ZOOM, the whole of it, built once a session (`imperialCityPlan`) and inked from that: Lake Rumare round City
//     Isle, the city wall and its gates, the palace wall and its gates, the district walls and theirs, Green Emperor Way,
//     the three ring roads, the six avenues and twelve radials, the causeways and Talos Bridge, the districts washed and
//     named, the White-Gold Tower in its palace, the Arena, the Temple of the One, the Prison, the University and the
//     Waterfront's quay and piers.
//   - ZOOMED IN, near the player: the district's own streets, buildings, squares, parks, canals and yards from the
//     fabric (`fabricCell`, `fabricStreetsIn`) - built on demand, IC_FABRIC_PER_TICK cells a tick, nearest first, so no
//     frame carries the district - and the player's own slice's Daggerfall blocks through the town sheet itself (its
//     quarters' washes, its names, its quest rings, its party, its homes and boards), laid where the slice stands.
//   - The player's caret, Find me (street zoom, as on any town), the district under the pointer.
//
// THE SPACE is the town sheet's own unit - a layout pixel, WORLD_PER_PX metres - over the whole plan, north up: the city's
// metres (x east, z south; world/imperialCity.js) plus its half-width. A slice's own sheet stands at its slice's corner,
// (sx, sy) slices in, so the town sheet's plates and marks need no transform of their own beyond that offset.
//
// DFU reference: none - DFU's town map is one location's blocks (ExteriorAutomap.cs); the Imperial City is the port's
// own (bible/03-World/Arena-Provinces.md IC-GRAND), and so is its map (bible/10-UI/Enhanced-Maps-Arc.md IC-TOWNMAP). The
// classic skin's window still draws the slice's blocks, DFU's way.
// ═══════════════════════════════════════════════════════════════════

import { t } from '../../systems/textManager.js';
import {
  IMPERIAL,
  IMPERIAL_SECTORS,
  IMPERIAL_CELLS,
  IMPERIAL_SPAN,
  PALACE,
  polar,
  imperialRoads,
  districtWallLines,
  districtWallGates,
  causewayLines,
  bridgeLine,
  imperialArenaAt,
  prisonAt,
  divinesAt,
  palaceGates,
  imperialDistrictAt,
  imperialCellDistrict,
  imperialCell,
  imperialCodeCell,
  gardenPaths,
  palaceFountains,
  tombAt,
} from '../../world/imperialCity.js';
import { fabricCell, fabricStreetsIn } from '../../world/imperialFabric.js';
import {
  PEN,
  INK_RGB,
  PARCHMENT_RGB,
  rgba,
  NAME_FACE,
  HALO_PEN,
  toPaper,
  toMap,
  fitView,
  viewCentredOn,
  SCALE_MAX,
  paintCaret,
} from '../ink/inkMap.js';
import { TOWN_PEN, BLOCK_PX, paintTownStatic } from '../ink/inkTown.js';
import { WORLD_PER_PX } from '../nameplateLayout.js';

/** A cell of the plan in metres (a block: BLOCK_PX layout pixels), the plan's half-width, the sheet's side, a slice's. */
const IC_CELL_M = BLOCK_PX * WORLD_PER_PX;
export const IC_HALF_M = (IMPERIAL_CELLS / 2) * IC_CELL_M;
export const IC_SHEET_PX = IMPERIAL_CELLS * BLOCK_PX;
const IC_SLICE_PX = 8 * BLOCK_PX;
/** The zoom (paper pixels a layout pixel) from which the district's fabric and the slice's own blocks are drawn - a
 *  building of the fabric five metres across is a pixel and more there. */
export const IC_FABRIC_ZOOM = 0.3;
/** How many cells out from the player's the district's fabric is drawn (a square of 2n+1), and how many cells are
 *  built a tick - a cell is ten milliseconds or so, its neighbourhood's first up to a hundred. */
export const IC_FABRIC_REACH = 5;
export const IC_FABRIC_PER_TICK = 1;
/** FINDME-TOWN's street zoom, on the city: two blocks across the paper's short side. */
const IC_FIND_ME_BLOCKS = 2;

/** The plan's inks - inkMap's pens, and the washes over the parchment. */
const IC_INK = Object.freeze({
  water: 'rgba(86, 122, 146, 0.30)',
  palace: 'rgba(196, 160, 72, 0.16)',
  district: Object.freeze([rgba(INK_RGB, 0.05), rgba(INK_RGB, 0.1)]),
  outer: rgba(INK_RGB, 0.07),
  road: rgba(INK_RGB, 0.3),
  street: rgba(INK_RGB, 0.12),
  stone: rgba(INK_RGB, 0.22),
  building: rgba(INK_RGB, 0.4),
  square: rgba(INK_RGB, 0.08),
  park: 'rgba(92, 128, 64, 0.20)',
  plinth: 'rgba(250, 244, 222, 0.55)',
  tower: 'rgba(250, 244, 222, 1)',
  gate: rgba(PARCHMENT_RGB, 1),
  wall: PEN.line,
  gilt: PEN.select,
});

/** The names on the plan, each through the text core (L10N4) - a district's by its plan name, the landmarks' by id. */
const IC_DISTRICT_TEXT = Object.freeze({
  [PALACE]: () => t('icmap.district.palace', 'Palace District'),
  'Market District': () => t('icmap.district.market', 'Market District'),
  'Arena District': () => t('icmap.district.arena', 'Arena District'),
  'Arboretum': () => t('icmap.district.arboretum', 'Arboretum'),
  'Temple District': () => t('icmap.district.temple', 'Temple District'),
  'Talos Plaza District': () => t('icmap.district.talos', 'Talos Plaza District'),
  'Elven Gardens District': () => t('icmap.district.elven', 'Elven Gardens District'),
  'Prison District': () => t('icmap.district.prison', 'Prison District'),
  'Arcane University': () => t('icmap.district.university', 'Arcane University'),
  'Waterfront District': () => t('icmap.district.waterfront', 'Waterfront District'),
  'City Isle': () => t('icmap.district.isle', 'City Isle'),
  'Rumare Shore': () => t('icmap.district.shore', 'Rumare Shore'),
});
const IC_LANDMARK_TEXT = Object.freeze({
  tower: () => t('icmap.tower', 'White-Gold Tower'),
  way: () => t('icmap.way', 'Green Emperor Way'),
  arena: () => t('icmap.arena', 'Arena'),
  temple: () => t('icmap.temple', 'Temple of the One'),
  prison: () => t('icmap.prison', 'Imperial Prison'),
  university: () => t('icmap.university', 'Arcane University'),
  quay: () => t('icmap.quay', 'Waterfront Quay'),
  bridge: () => t('icmap.bridge', 'Talos Bridge'),
  lake: () => t('icmap.lake', 'Lake Rumare'),
  isle: () => t('icmap.isle', 'City Isle'),
});
/** A district's shown name, or '' for none (the lake). */
export const imperialDistrictName = (d) => (d ? (IC_DISTRICT_TEXT[d]?.() ?? d) : '');

// ── THE CITY'S PLAN, ONCE A SESSION ───────────────────────────────────────────────────────────────────────────────

let icPlanCache = null;
let icPlanBuilds = 0;
/** How many times the city's plan has been built this session - once (the pin's count). */
export const imperialPlanBuilds = () => icPlanBuilds;
export function _resetImperialPlanForTests() {
  icPlanCache = null;
  icPlanBuilds = 0;
}

/**
 * THE CITY'S PLAN: every line, ring and landmark the city layer inks, in the city's metres, and its labels (an id, where,
 * a size and the zoom it is lettered from) - read off world/imperialCity.js's own laws, built once and kept.
 */
export function imperialCityPlan() {
  if (icPlanCache) return icPlanCache;
  icPlanBuilds++;
  const I = IMPERIAL;
  // a district's name on its first radial between the middle and the outer ring roads - clear of its heart's landmark on
  // its avenue and of the grounds' names outside the wall
  const sectorLabels = IMPERIAL_SECTORS.map(([name, b]) => ({
    district: name,
    at: polar(b + I.roads.radials[0], (I.roads.rings[1] + I.roads.rings[2]) / 2),
    size: 15,
    zoom: 0,
  }));
  icPlanCache = Object.freeze({
    roads: imperialRoads(),
    ways: causewayLines(),
    bridge: bridgeLine(),
    districtWalls: districtWallLines(),
    districtGates: districtWallGates(),
    cityGates: I.cityWall.gates.map((b) => polar(b, I.cityWall.r)),
    palaceGates: palaceGates().map((b) => polar(b, I.palaceWall.r)),
    piers: I.waterfront.piers.map((b) => [polar(b, I.waterfront.r1), polar(b, I.waterfront.pierTo)]),
    arena: imperialArenaAt(),
    temple: polar(I.temple.b, I.temple.r),
    prison: prisonAt(),
    university: polar(I.university.b, I.university.r),
    market: polar(I.market.b, I.market.r),
    pool: polar(I.pool.b, I.pool.r),
    divines: divinesAt(),
    statue: polar(I.statue.b, I.statue.r),
    gardenPaths: gardenPaths(),
    fountains: palaceFountains(),
    tombs: Array.from({ length: I.tombs.n }, (_, i) => tombAt(i)),
    labels: Object.freeze(
      [
        ...sectorLabels,
        { district: PALACE, at: polar(180, (I.palace.r1 + I.way.r0) / 2), size: 14, zoom: 0 },
        {
          district: imperialDistrictAt(...prisonAt()),
          at: polar(I.prison.b, I.prison.r + I.prison.half + 260),
          size: 12,
          zoom: 0.1,
        },
        {
          district: imperialDistrictAt(...polar(180, (I.cityWall.r + I.isle) / 2)),
          at: polar(180, (I.cityWall.r + I.isle) / 2),
          size: 13,
          zoom: 0,
        },
        { landmark: 'tower', at: [0, -I.gardens.walks[0]], size: 14, zoom: 0 },
        { landmark: 'way', at: polar(0, I.way.r1 + 110), size: 11, zoom: 0.12 },
        { landmark: 'arena', at: [imperialArenaAt()[0], imperialArenaAt()[1] - 170], size: 12, zoom: 0 },
        { landmark: 'temple', at: polar(I.temple.b, I.temple.r - 300), size: 12, zoom: 0 },
        { landmark: 'prison', at: polar(I.prison.b, I.prison.r), size: 12, zoom: 0 },
        { landmark: 'university', at: polar(I.university.b, I.university.r), size: 12, zoom: 0 },
        { landmark: 'quay', at: polar(180, I.waterfront.r1 + 160), size: 11, zoom: 0.1 },
        { landmark: 'bridge', at: polar(I.bridge.b - 2.2, (I.isle + I.lake) / 2), size: 12, zoom: 0 },
        { landmark: 'lake', at: polar(0, (I.isle + I.lake) / 2), size: 17, zoom: 0 },
        { landmark: 'isle', at: polar(315, (I.cityWall.r + I.isle) / 2), size: 13, zoom: 0 },
      ].map((l) => Object.freeze(l)),
    ),
  });
  return icPlanCache;
}

/** Metres of the city to the sheet's layout pixels. */
const icSheetAt = (x, z) => [(x + IC_HALF_M) / WORLD_PER_PX, (z + IC_HALF_M) / WORLD_PER_PX];

/**
 * INK THE CITY - its plan under the view, in paper pixels (the caller has set the device transform).
 * @param {*} ctx @param {{ox:number, oy:number, scale:number}} view
 */
export function paintImperialCity(ctx, view) {
  const plan = imperialCityPlan(),
    I = IMPERIAL,
    TAU = Math.PI * 2;
  const k = view.scale / WORLD_PER_PX; // paper pixels a metre
  const P = (x, z) => toPaper(view, ...icSheetAt(x, z));
  const [cx, cy] = P(0, 0);
  const th = (b) => ((b - 90) * Math.PI) / 180; // a bearing's canvas angle (y down is south)
  const ring = (r) => {
    ctx.moveTo(cx + r * k, cy);
    ctx.arc(cx, cy, r * k, 0, TAU);
  };
  const wedge = (r0, r1, b0, b1) => {
    const [x0, y0] = P(...polar(b0, r1));
    ctx.moveTo(x0, y0);
    ctx.arc(cx, cy, r1 * k, th(b0), th(b1));
    ctx.arc(cx, cy, r0 * k, th(b1), th(b0), true);
    ctx.closePath();
  };
  const box = ([x, z], half) => {
    const [ax, ay] = P(x - half, z - half);
    ctx.rect(ax, ay, 2 * half * k, 2 * half * k);
  };
  const line = ([a, b], w, min, pen) => {
    ctx.strokeStyle = pen;
    ctx.lineWidth = Math.max(min, w * k);
    ctx.beginPath();
    ctx.moveTo(...P(...a));
    ctx.lineTo(...P(...b));
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Lake Rumare round City Isle, the Waterfront's quay out over it
  ctx.beginPath();
  ring(I.lake);
  ring(I.isle);
  wedge(I.isle, I.waterfront.r1, I.waterfront.b0, I.waterfront.b1);
  ctx.fillStyle = IC_INK.water;
  ctx.fill('evenodd');
  // the districts' washes: the palace's, the six sectors' by turns, the grounds outside the wall
  ctx.beginPath();
  ring(I.palaceWall.r);
  ctx.fillStyle = IC_INK.palace;
  ctx.fill();
  IMPERIAL_SECTORS.forEach(([, b], i) => {
    ctx.beginPath();
    wedge(I.palaceWall.r, I.cityWall.r, b, b + 60);
    ctx.fillStyle = IC_INK.district[i % 2];
    ctx.fill();
  });
  ctx.beginPath();
  wedge(I.cityWall.r, I.waterfront.r1, I.waterfront.b0, I.waterfront.b1);
  box(plan.prison, I.prison.half);
  box(plan.university, I.university.half);
  ctx.fillStyle = IC_INK.outer;
  ctx.fill();
  // the roads: Green Emperor Way and the rings, the avenues and radials, the causeways and the bridge, the piers
  for (const rd of plan.roads) {
    ctx.strokeStyle = IC_INK.road;
    ctx.lineWidth = Math.max(rd.kind === 'way' ? 1.6 : 1, rd.w * k);
    ctx.beginPath();
    if (rd.kind === 'ring' || rd.kind === 'way') ring(rd.r);
    else {
      ctx.moveTo(...P(...polar(rd.b, I.palaceWall.r)));
      ctx.lineTo(...P(...polar(rd.b, I.cityWall.r)));
    }
    ctx.stroke();
  }
  for (const w of plan.ways) line(w, I.causeway, 1, IC_INK.road);
  line(plan.bridge, I.bridge.w, 1.6, IC_INK.wall);
  for (const p of plan.piers) line(p, I.waterfront.pierW, 0.8, IC_INK.stone);
  // the landmarks
  ctx.beginPath();
  ring(I.palace.r1);
  ring(I.palace.r0);
  ctx.fillStyle = IC_INK.stone;
  ctx.fill('evenodd');
  // the palace gardens round the tower: their ring walks, their paths out to the Way, their fountains, the emperors' tombs
  if (view.scale >= 0.12) {
    const G = I.gardens;
    ctx.strokeStyle = IC_INK.street;
    for (const w of G.walks) {
      ctx.lineWidth = Math.max(0.8, G.walk * k);
      ctx.beginPath();
      ring(w);
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(0.8, G.path * k);
    ctx.beginPath();
    for (const b of plan.gardenPaths) {
      ctx.moveTo(...P(...polar(b, I.palace.r1 + I.palace.terrace)));
      ctx.lineTo(...P(...polar(b, I.way.r0)));
    }
    ctx.stroke();
    ctx.fillStyle = IC_INK.water;
    for (const f of plan.fountains) {
      ctx.beginPath();
      ctx.arc(...P(...f), Math.max(1.5, (G.fountainR + G.round) * k), 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = IC_INK.stone;
    for (const tb of plan.tombs) {
      const [x, y] = P(...tb),
        w = Math.max(2, I.tombs.w * k);
      ctx.fillRect(x - w / 2, y - w / 2, w, w);
    }
  }
  ctx.beginPath();
  ring(I.tower.plinthR);
  ctx.fillStyle = IC_INK.plinth;
  ctx.fill();
  ctx.strokeStyle = IC_INK.gilt;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  ring(I.tower.shaftR0);
  ctx.fillStyle = IC_INK.tower;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(...P(...plan.arena), Math.max(3, 48 * k), 0, TAU);
  ctx.fillStyle = IC_INK.stone;
  ctx.fill();
  ctx.strokeStyle = IC_INK.wall;
  ctx.lineWidth = 1;
  ctx.stroke();
  {
    const [tx, ty] = P(...plan.temple),
      a = th(I.temple.b) + Math.PI / 2;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(a);
    ctx.fillStyle = IC_INK.stone;
    ctx.strokeStyle = IC_INK.wall;
    ctx.lineWidth = 1;
    const w = Math.max(3, I.temple.w * k),
      l = Math.max(5, I.temple.l * k);
    ctx.fillRect(-w / 2, -l / 2, w, l);
    ctx.strokeRect(-w / 2, -l / 2, w, l);
    ctx.restore();
  }
  ctx.beginPath();
  box(plan.market, I.market.half);
  ctx.fillStyle = IC_INK.square;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(...P(...plan.pool), Math.max(2, I.pool.r0 * k), 0, TAU);
  ctx.fillStyle = IC_INK.water;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(...P(...plan.divines), Math.max(2, I.divines.court * k), 0, TAU);
  ctx.fillStyle = IC_INK.square;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(...P(...plan.statue), Math.max(2, (I.statue.plaza / 2) * k), 0, TAU);
  ctx.fillStyle = IC_INK.square;
  ctx.fill();
  // the walls: the city's, the palace's, the districts', the Prison's and the University's curtains
  ctx.strokeStyle = IC_INK.wall;
  ctx.lineWidth = Math.max(2, I.cityWall.thick * k);
  ctx.beginPath();
  ring(I.cityWall.r);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.6, I.palaceWall.thick * k);
  ctx.beginPath();
  ring(I.palaceWall.r);
  ctx.stroke();
  for (const w of plan.districtWalls) line(w, I.districtWall.thick, 1.2, IC_INK.wall);
  ctx.lineWidth = Math.max(1.2, 6 * k);
  ctx.beginPath();
  box(plan.prison, I.prison.half);
  box(plan.university, I.university.half);
  ctx.stroke();
  // the gates, parchment in the wall's ink
  const gate = (at, w) => {
    const [x, y] = P(...at),
      s = Math.max(3.5, w * k);
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    ctx.strokeRect(x - s / 2, y - s / 2, s, s);
  };
  ctx.fillStyle = IC_INK.gate;
  ctx.strokeStyle = IC_INK.wall;
  ctx.lineWidth = 1;
  for (const g of plan.cityGates) gate(g, I.cityWall.gate);
  for (const g of plan.palaceGates) gate(g, I.palaceWall.gate);
  if (view.scale >= 0.12) for (const g of plan.districtGates) gate(g, I.districtWall.gate);
}

/** The plan's names, haloed then inked - the districts' and the landmarks', each from the zoom it is lettered at. */
export function paintImperialLabels(ctx, view) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const l of imperialCityPlan().labels) {
    if (view.scale < l.zoom) continue;
    const text = l.district ? imperialDistrictName(l.district) : IC_LANDMARK_TEXT[l.landmark]();
    const [x, y] = toPaper(view, ...icSheetAt(l.at[0], l.at[1]));
    ctx.font = `${l.district ? '600 ' : l.landmark === 'lake' ? 'italic ' : ''}${l.size}px ${NAME_FACE}`;
    ctx.lineWidth = 2 * HALO_PEN;
    ctx.strokeStyle = TOWN_PEN.halo;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = TOWN_PEN.name;
    ctx.fillText(text, x, y);
  }
}

/**
 * THE DISTRICT'S FABRIC near the player, one cell's: its streets under, its parks, canals and squares, its buildings, its
 * yards' walls - what world/imperialFabric.js lays there, in the city's metres.
 */
function paintFabricCell(ctx, view, f) {
  const k = view.scale / WORLD_PER_PX;
  const P = (x, z) => toPaper(view, ...icSheetAt(x, z));
  const poly = (q) => {
    const [x0, y0] = P(q[0][0], q[0][1]);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < q.length; i++) ctx.lineTo(...P(q[i][0], q[i][1]));
    ctx.closePath();
  };
  for (const s of f.streets) {
    ctx.strokeStyle = IC_INK.street;
    ctx.lineWidth = Math.max(0.6, s.w * k);
    ctx.beginPath();
    ctx.moveTo(...P(...s.a));
    ctx.lineTo(...P(...s.b));
    ctx.stroke();
  }
  const fill = (list, ink) => {
    if (!list?.length) return;
    ctx.beginPath();
    for (const q of list) poly(q);
    ctx.fillStyle = ink;
    ctx.fill();
  };
  fill(f.parks, IC_INK.park);
  fill(f.canals, IC_INK.water);
  fill(f.squares, IC_INK.square);
  fill(f.plots, IC_INK.building);
  if (f.yards.length) {
    ctx.strokeStyle = IC_INK.stone;
    ctx.lineWidth = Math.max(0.5, 0.4 * k);
    ctx.beginPath();
    for (const y of f.yards) {
      if (!y?.a || !y?.b) continue;
      ctx.moveTo(...P(...y.a));
      ctx.lineTo(...P(...y.b));
    }
    ctx.stroke();
  }
}

/**
 * THE IMPERIAL CITY'S SHEET - the town sheet's contract (ui/map/mapStrip.js SHEET_MEMBERS), over the whole city.
 * `deps` is the town sheet's bag (ui/town/townMapDoor.js townSheetBag) with `imperial`, the slice the player stands in;
 * `makeTown` builds the slice's own town sheet (ui/town/townSheet.js createTownSheet), drawn where the slice stands.
 * @param {any} deps @param {(deps: any) => any} makeTown
 */
export function createImperialSheet(deps, makeTown) {
  const s = deps.imperial,
    sx = s % IMPERIAL_SPAN,
    sy = Math.floor(s / IMPERIAL_SPAN);
  const offX = sx * IC_SLICE_PX,
    offY = sy * IC_SLICE_PX;
  const fieldH = Math.max(1, deps.gridH ?? 8) * BLOCK_PX;
  // the slice's own blocks, names and marks - its player the city's to draw, its title the city's to say
  const slice = makeTown({ ...deps, imperial: null, player: null, title: '' });
  /** @type {Map<number, any>} */
  const fabric = new Map();
  let queue = null;
  let wantFabric = false;
  let lastView = null;

  const subView = (view) => ({ ox: view.ox - offX, oy: view.oy - offY, scale: view.scale });
  /** Where the player stands on the city's sheet: the slice's sheet's own crossing (EM-BUG3's sheetY) plus its corner. */
  function me() {
    const p = deps.player?.() ?? null;
    if (!p) return null;
    return { ...p, x: offX + p.x, y: offY + (fieldH - 1) - p.y };
  }
  /** The player's place in the city's metres. */
  const meMetres = () => {
    const m = me();
    return m ? [m.x * WORLD_PER_PX - IC_HALF_M, m.y * WORLD_PER_PX - IC_HALF_M] : null;
  };

  /** The fabric's cells to build: the player's district's own cells (the port's, not Daggerfall's blocks) within
   *  IC_FABRIC_REACH of the player's, nearest first. */
  function fabricQueue() {
    if (queue) return queue;
    const at = meMetres();
    if (!at) return (queue = []);
    const half = IMPERIAL_CELLS / 2,
      r0 = Math.floor(at[1] / IC_CELL_M + half),
      c0 = Math.floor(at[0] / IC_CELL_M + half);
    const district = imperialDistrictAt(at[0], at[1]);
    const out = [];
    for (let dr = -IC_FABRIC_REACH; dr <= IC_FABRIC_REACH; dr++) {
      for (let dc = -IC_FABRIC_REACH; dc <= IC_FABRIC_REACH; dc++) {
        const r = r0 + dr,
          c = c0 + dc;
        if (r < 0 || c < 0 || r >= IMPERIAL_CELLS || c >= IMPERIAL_CELLS) continue;
        if (!imperialCodeCell(imperialCell(r, c) ?? '') || imperialCellDistrict(r, c) !== district) continue;
        out.push({ r, c, d: dr * dr + dc * dc });
      }
    }
    return (queue = out.sort((a, b) => a.d - b.d));
  }
  /** Build up to `n` of the queue's cells. */
  function buildFabric(n) {
    const q = fabricQueue();
    let made = 0;
    for (const cell of q) {
      if (made >= n) break;
      const key = cell.r * IMPERIAL_CELLS + cell.c;
      if (fabric.has(key)) continue;
      const L = fabricCell(cell.r, cell.c);
      fabric.set(key, {
        r: cell.r,
        c: cell.c,
        plots: L.plots.map((p) => p.q),
        squares: L.squares,
        parks: L.parks,
        canals: L.canals,
        yards: L.yards ?? [],
        streets: fabricStreetsIn(cell.r, cell.c),
      });
      made++;
    }
    return made;
  }
  const fabricPending = () => wantFabric && fabric.size < fabricQueue().length;

  return {
    id: 'town',
    size: () => ({ width: IC_SHEET_PX, height: IC_SHEET_PX }),
    ensure() {
      slice.ensure();
      return imperialCityPlan();
    },
    staticKey: () => `ic|${s}|${fabric.size}|${slice.staticKey()}`,

    paintStatic(ctx, env) {
      lastView = env.view;
      if (!ctx?.setTransform) return;
      const { paperW, paperH, dpr = 1 } = env;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, paperW, paperH);
      paintImperialCity(ctx, env.view);
      if (env.view.scale >= IC_FABRIC_ZOOM) {
        wantFabric = true;
        // the cells on the paper alone
        const [mx0, mz0] = toMap(env.view, 0, 0),
          [mx1, mz1] = toMap(env.view, paperW, paperH);
        const c0 = Math.floor(mx0 / BLOCK_PX) - 1,
          c1 = Math.floor(mx1 / BLOCK_PX) + 1,
          r0 = Math.floor(mz0 / BLOCK_PX) - 1,
          r1 = Math.floor(mz1 / BLOCK_PX) + 1;
        for (const f of fabric.values())
          if (f.r >= r0 && f.r <= r1 && f.c >= c0 && f.c <= c1) paintFabricCell(ctx, env.view, f);
        const plan = slice.ensure();
        if (plan) paintTownStatic(ctx, plan, subView(env.view), { paperW, paperH, dpr, clear: false });
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      paintImperialLabels(ctx, env.view);
    },

    paintOverlay(ctx, env) {
      lastView = env.view;
      if (env.view.scale >= IC_FABRIC_ZOOM) slice.paintOverlay(ctx, { ...env, view: subView(env.view) });
      const p = me();
      if (p && ctx?.setTransform) {
        ctx.setTransform(env.dpr ?? 1, 0, 0, env.dpr ?? 1, 0, 0);
        const [x, y] = toPaper(env.view, p.x, p.y);
        paintCaret(ctx, x, y, p.yaw ?? 0, { fill: TOWN_PEN.caret, halo: TOWN_PEN.halo });
      }
    },

    pickAt() {
      /* the city's plan picks nothing - its names are read */
    },

    hoverLabel(px, py) {
      if (lastView && lastView.scale >= IC_FABRIC_ZOOM) {
        const h = slice.hoverLabel(px, py);
        if (h?.label) return h;
      }
      if (lastView) {
        const [u, v] = toMap(lastView, px, py);
        const name = imperialDistrictName(
          imperialDistrictAt(u * WORLD_PER_PX - IC_HALF_M, v * WORLD_PER_PX - IC_HALF_M),
        );
        if (name) return { label: name, cursor: '' };
      }
      return { label: deps.title ?? '', cursor: '' };
    },

    /** The fabric fills in on the window's beat, a cell a tick, while it is wanted and short. */
    breathes: () => fabricPending() || !!slice.breathes?.(),
    mark() {
      /* the middle button marks the bay */
    },
    key() {
      return false;
    },
    tick() {
      if (fabricPending()) buildFabric(IC_FABRIC_PER_TICK);
    },
    mount() {},
    unmount() {},
    context() {
      return false;
    },

    /** At rest: the whole city, from the far shore round - Find me is the way to the player. */
    homeView: (limits) => fitView(limits),
    me,
    /** FINDME-TOWN on the city: the player's caret at street zoom - and the district's fabric wanted from here. */
    findMe(limits, view = null) {
      const p = me();
      if (!p) return null;
      wantFabric = true;
      const street = Math.min(limits.paperW, limits.paperH) / (IC_FIND_ME_BLOCKS * BLOCK_PX);
      return viewCentredOn(p.x, p.y, Math.min(SCALE_MAX, Math.max(street, view?.scale ?? 0)), limits);
    },

    // ── handles for the pins ────────────────────────────────────────
    get plan() {
      return imperialCityPlan();
    },
    get slice() {
      return slice;
    },
    get fabricCells() {
      return fabric.size;
    },
    get fabricWanted() {
      return fabricQueue().length;
    },
    _fabricRows: () => [...fabric.values()].map((f) => ({ r: f.r, c: f.c })),
    ink: IC_INK,
    names: () => slice.names(),
    get blockPx() {
      return BLOCK_PX;
    },
  };
}
