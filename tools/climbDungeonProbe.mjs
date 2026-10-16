// AUDIT CLIMB-DUNGEON (FIELD BUGS 2026-10-02) - THE CLIMB ON DAGGERFALL'S DUNGEONS. Builds a dungeon's collider as the
// dungeon host does (every block's placed models and its enabled action doors, at each block's origin), then from every
// floor point `--step` metres apart climbs every wall within 1 m that has a top between 2.4 m and 16 m with room to
// stand on it: Forward held at the wall's own normal and at each `--offsets` degree either side, the enhanced climb on
// at `skill` (default 100, so the grip does not decide). A top is one stood on: on it, and still on it after a second
// with nothing held (a frame's touch of a slope the climber slides off and falls from is no top). A climb that does not
// end standing on the top is run again on the classic lane with every roll passing; the line counts the walls, the climbs, the tops, the climbs that never took
// hold within 1 m of their start (slid along the wall, or started in a void), the failures, and the failures the
// classic lane topped. `--fails` prints each failure. The record's figures are this tool's, over --all.
//
//   ARENA2_PATH=<arena2> node tools/climbDungeonProbe.mjs "Daggerfall" "Ruins of Old Carololda's Farm" [skill]
//   ARENA2_PATH=<arena2> node tools/climbDungeonProbe.mjs --all [skill]      (the record's 25 dungeons, one line each)
//   options: --offsets 0,8,-8   --step 1   --fatigue 1   --fails
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MapsFile } from '../src/formats/mapsFile.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { Arch3dFile } from '../src/formats/arch3dFile.js';
import { dfMeshToModel } from '../src/world/meshReader.js';
import { layoutDungeon } from '../src/world/dungeon/dungeonLayout.js';
import { Collider } from '../src/player/collider.js';
import { multiply } from '../src/world/mat4.js';
import { PlayerMotor } from '../src/player/motor.js';
import { isMain } from './lib/isMain.mjs';

export const RECORD_DUNGEONS = Object.freeze([
  ['Daggerfall', "Ruins of Old Carololda's Farm"], ["Alik'r Desert", 'Castle Lhishen'], ['Dragontail Mountains', "The M'ell Graveyard"],
  ['Dragontail Mountains', 'The Pit of Sahoth'], ['Dwynnen', "Ruins of Old Vyctyn's Place"], ["Dak'fron", 'Ruins of Tach Manor'],
  ["Dak'fron", "Ruins of Old Glerpja's Place"], ['Wrothgarian Mountains', "Ruins of Old Evelabyth's Shack"],
  ['Wrothgarian Mountains', 'The Mordywyr Mines'], ['Wrothgarian Mountains', 'Sekthrac'], ['Daggerfall', 'The Convocation of Elona'],
  ['Daggerfall', 'Castle Kingwing'], ['Sentinel', 'Castle Faallem'], ['Anticlere', "Copperwing's Hold"], ['Wayrest', "Gaerwing's Guard"],
  ['Orsinium Area', "Ruins of Old Evelolda's Hovel"], ['Alcaire', 'The Hold of Buckingsmith'], ['Phrygias', 'Theodastyr Laboratory'],
  ['Ykalon', 'The Citadel of Woodford'], ['Abibon-Gora', 'Ruins of Tower Darhtin'], ['Myrkwasa', "The Assembly of C'ircba"],
  ['Tigonus', "Thercrn's Hold"], ['Totambu', 'The Fortress of Verpe'], ['Mournoth', 'The Abbey of Baleusulla'],
  ['Tulune', 'The Haunt of Viscount Lithovon'],
]);

/** The game's files, read once. */
export function loadData(arena2) {
  const blocks = new BlocksFile(); blocks.load(new Uint8Array(readFileSync(join(arena2, 'BLOCKS.BSA'))));
  const arch = new Arch3dFile(); arch.load(new Uint8Array(readFileSync(join(arena2, 'ARCH3D.BSA'))));
  const maps = new MapsFile();
  maps.load(new Uint8Array(readFileSync(join(arena2, 'MAPS.BSA'))), new Uint8Array(readFileSync(join(arena2, 'CLIMATE.PAK'))), new Uint8Array(readFileSync(join(arena2, 'POLITIC.PAK'))));
  const cache = new Map();
  const getModel = (id) => { if (!cache.has(id)) cache.set(id, dfMeshToModel(arch.getMesh(arch.getRecordIndex(id)), () => ({ width: 1, height: 1 }))); return cache.get(id); };
  return { blocks, maps, getModel, arch };   // AUDIT REST II F6: the archive too - tools/dungeonFireProbe.mjs reads its models as the host does (patchSeams)
}

/** A dungeon's collider as scenes/dungeonContext.js builds it, and its blocks. */
export function dungeonCollider(data, region, name) {
  const d = layoutDungeon(data.maps.getLocationByName(region, name), data.blocks, data.getModel);
  const col = new Collider(() => -Infinity);
  for (const b of d.blocks) {
    const om = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, b.originX, 0, b.originZ, 1];
    for (const p of b.layout.placements) { const m = data.getModel(p.modelIdNum); if (m) col.addMesh('dungeon', m.positions, m.indices, multiply(om, p.matrix)); }
    for (const dr of b.layout.actionDoors) { if (dr.disabled) continue; const m = data.getModel(dr.modelIdNum); if (m) col.addMesh('dungeon', m.positions, m.indices, multiply(om, dr.matrix)); }
  }
  return { col, blocks: d.blocks };
}

/** Probe one dungeon: the counts, and each failure. */
export function probe(col, blocks, { skill = 100, fatigue = 1, offsets = [0, 8, -8], step = 1 } = {}) {
  const floorsAt = (x, z) => {
    const out = []; let y = 60;
    for (let n = 0; n < 12 && y > -120; n++) {
      const h = col.surfaceHit([x, y, z], [0, -1, 0], y + 120);
      if (!Number.isFinite(h.dist)) break;
      const fy = y - h.dist; if (h.normal && h.normal[1] > 0.7) out.push(fy);
      y = fy - 0.05;
    }
    return out;
  };
  const candidate = (x, fy, z, dir) => {
    const hit = col.raycastHit([x, fy + 1.0, z], dir, 1.0);
    if (!Number.isFinite(hit.dist) || !hit.normal || Math.abs(hit.normal[1]) > 0.3) return null;
    const upClear = col.raycast([x, fy + 0.5, z], [0, 1, 0], 40);
    if (!Number.isFinite(upClear)) return null;
    let open = null;
    for (let h = 1.1; h < 16; h += 0.1) {
      if (h > upClear - 0.2) return null;
      if (!Number.isFinite(col.raycast([x, fy + h, z], dir, hit.dist + 0.3))) { open = h; break; }
    }
    if (open == null || open < 2.4) return null;
    const wx = x + dir[0] * (hit.dist + 0.4), wz = z + dir[2] * (hit.dist + 0.4);
    const top = col.surfaceHit([wx, fy + open + 0.3, wz], [0, -1, 0], 0.8);
    if (!Number.isFinite(top.dist)) return null;
    const topY = fy + open + 0.3 - top.dist;
    if (col.raycast([wx, topY + 0.1, wz], [0, 1, 0], 2) < 1.9) return null;
    return { rise: +(topY - fy).toFixed(2), wallDist: hit.dist, topY, normal: hit.normal };
  };
  const climb = (x, fy, z, yaw, topY, classic) => {
    const deps = classic
      ? { climbing: { inputs: () => ({ climbing: skill, luck: 50 }), tally: () => {}, say: () => {}, rolls: () => 0 } }
      : { parkour: { enabled: () => true, inputs: () => ({ climbing: skill, fatigue }), say: () => {}, tally: () => {} } };
    const m = new PlayerMotor(col, { speed: 50, running: 30 }, deps);
    m.spawn(x, fy + 0.02, z);
    let startD = null, maxY = fy;
    for (let i = 0; i < 60 * 25; i++) {
      m.update(1 / 60, { forward: 1, strafe: 0, run: false, jump: false, crouch: false }, yaw);
      const on = classic ? m.climb?.isClimbing : (m.onWall || !!m._pkMove);
      if (on && startD == null) startD = Math.hypot(m.pos[0] - x, m.pos[2] - z);
      maxY = Math.max(maxY, m.pos[1]);
      if (m.grounded && m.pos[1] > topY - 0.3) {
        for (let k = 0; k < 60; k++) m.update(1 / 60, { forward: 0, strafe: 0, run: false, jump: false, crouch: false }, yaw);
        return m.grounded && m.pos[1] > topY - 0.3 ? { top: true, startD, maxY } : { top: false, startD, maxY, endY: m.pos[1] };
      }
    }
    return { top: false, startD, maxY, endY: m.pos[1] };
  };
  const dirs = [0, 1, 2, 3].map((k) => { const a = (k * Math.PI) / 2; return [Math.sin(a), 0, Math.cos(a)]; });
  const seen = new Set(), fails = [];
  const n = { walls: 0, climbs: 0, tops: 0, slid: 0, fails: 0, classicOnly: 0 };
  for (const b of blocks) {
    const bk = `${b.originX},${b.originZ}`;
    if (seen.has(bk)) continue;
    seen.add(bk);
    for (let gx = step / 2; gx < 51.2; gx += step) for (let gz = step / 2; gz < 51.2; gz += step) {
      const x = b.originX + gx, z = b.originZ + gz;
      for (const fy of floorsAt(x, z)) for (const dir of dirs) {
        const c = candidate(x, fy, z, dir);
        if (!c) continue;
        const key = `${b.name}:${Math.round(x + dir[0] * c.wallDist)},${Math.round(fy)},${Math.round(z + dir[2] * c.wallDist)},${dir[0]},${dir[2]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        n.walls++;
        const base = Math.atan2(-c.normal[0], -c.normal[2]);
        for (const o of offsets) {
          n.climbs++;
          const yaw = base + (o * Math.PI) / 180;
          const r = climb(x, fy, z, yaw, c.topY, false);
          if (r.top) { n.tops++; continue; }
          if (r.startD == null || r.startD > 1.0) { n.slid++; continue; }
          n.fails++;
          const k = climb(x, fy, z, yaw, c.topY, true);
          if (k.top) n.classicOnly++;
          fails.push({ block: b.name, at: [+x.toFixed(2), +fy.toFixed(2), +z.toFixed(2)], yaw: +yaw.toFixed(3), off: o, rise: c.rise, maxRise: +(r.maxY - fy).toFixed(2), classicTops: k.top });
        }
      }
    }
  }
  return { ...n, failures: fails };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : d; };
  const flag = (k) => { const i = argv.indexOf(k); if (i >= 0) argv.splice(i, 1); return i >= 0; };
  const offsets = String(opt('--offsets', '0,8,-8')).split(',').map(Number);
  const step = Number(opt('--step', 1)), fatigue = Number(opt('--fatigue', 1));
  const all = flag('--all'), showFails = flag('--fails');
  const arena2 = process.env.ARENA2_PATH;
  if (!arena2) { console.error('ARENA2_PATH is not set'); process.exit(2); }
  const data = loadData(arena2);
  const list = all ? RECORD_DUNGEONS : [[argv[0], argv[1]]];
  const skill = Number((all ? argv[0] : argv[2]) ?? 100);
  const total = { walls: 0, climbs: 0, tops: 0, slid: 0, fails: 0, classicOnly: 0 };
  for (const [region, name] of list) {
    const { col, blocks } = dungeonCollider(data, region, name);
    const r = probe(col, blocks, { skill, fatigue, offsets, step });
    for (const k of Object.keys(total)) total[k] += r[k];
    const { failures, ...counts } = r;
    console.log(`${region} / ${name}: ${JSON.stringify(counts)}`);
    if (showFails) for (const f of failures) console.log('  ' + JSON.stringify(f));
  }
  if (list.length > 1) console.log(`total: ${JSON.stringify(total)}`);
}
