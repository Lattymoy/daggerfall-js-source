#!/usr/bin/env node
// DELVE II (DLV2, DLV4) PROBE: a dungeon's encounters in the real game, on the freeware's data - the dungeon bench
// (scenes/dungeon.js, `?dungeon=`) in a real browser, each site walked into and won by the probe's hand (a wave's foes
// struck down through the real damage door, a Litany's plates stepped in its order, a source or a seal broken by the
// player's own swing through the context's crystal seam, the flame carried to the braziers, the weights pressed and
// set), its vault pressed, the frame's cost measured, every page error a failure. Pictures at each stage.
//
//   node tools/delveProbe.mjs [region] [dungeon] [shots-dir] [--look]      e.g.  Daggerfall "Bedard Laboratory" /tmp/delve
//   node tools/delveProbe.mjs --lab=<id> [shots-dir]                       a shipped curated block, in the bench's lab
//   CHROMIUM=/path/to/chrome                                               a browser of the machine's own
//
// `--look`: each site's marks pictured at rest and woken, nothing fought. Exits 1 on a page error, a site never stood,
// a site never won, or a window left open.
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import {
  litanyPlates,
  springSpots,
  sealSpots,
  brazierSpots,
  weightSpots,
  weighPlates,
} from '../src/net/delve/delveLaw.js';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const LOOK = process.argv.includes('--look');
const DPS = process.argv.includes('--dps'); // the character's own damage a second on the first piece it strikes   // each swing said: the host's hits, the pieces, where I stand
const LAB = process.argv.find((a) => a.startsWith('--lab='))?.slice(6) ?? null;
const SPAWN = process.argv.find((a) => a.startsWith('--spawn='))?.slice(8) ?? null; // DLV5: the named dungeon cloned on a pixel, built as the world builds a spawn (its curated block in its slot)   // DLV6: a shipped curated block, laid in the bench's lab (`?dungeon=lab&lab=<id>`)
const rest = process.argv
  .slice(2)
  .filter((a) => a !== '--look' && a !== '--dps' && !a.startsWith('--lab=') && !a.startsWith('--spawn='));
const [region = 'Daggerfall', name = 'Bedard Laboratory', shots = null] = LAB
  ? ['', `lab ${LAB}`, rest[0] ?? null]
  : rest;
if (shots) mkdirSync(shots, { recursive: true });
const server = await createServer({
  server: { port: 5231, strictPort: true, hmr: false, watch: null },
  logLevel: 'error',
}); // an edit to the tree mid-run reloads no page
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
  ],
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
}); // CHROMIUM: a browser of the machine's own, as the other probes take
const page = await browser.newPage({ viewport: { width: 800, height: 500 } }); // the software rasteriser's frames: smaller is faster
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
const fail = async (why) => {
  console.log(`FAIL: ${why}`);
  await browser.close();
  await server.close();
  process.exit(1);
};

const q = new URLSearchParams(
  LAB ? { dungeon: 'lab', lab: LAB } : { region, dungeon: name, ...(SPAWN ? { spawn: SPAWN } : {}) },
);
await page.goto(`http://localhost:5231/play/?shot&play&nomenu&novideo&class=1&${q}`); // class=1: the headless character (no wizard)
await page.waitForFunction(() => window.__frame > 10, null, { timeout: 240000 });
const frames = async (n) => {
  // a loop stopped (a throw in the frame ends its requestAnimationFrame chain) fails with its cause
  const f0 = await page.evaluate(() => window.__frame);
  try {
    await page.waitForFunction(([a, k]) => window.__frame > a + k, [f0, n], { timeout: 120000 });
  } catch {
    await fail(
      `the frame stopped at ${await page.evaluate(() => window.__frame)} (${n} asked after ${f0}); page errors:\n  ${errors.join('\n  ') || 'none'}`,
    );
  }
};
// the windows a first visit opens (the dungeons' tutorial box): closed, so the frame runs
for (let k = 0; k < 12; k++) {
  const ov = JSON.parse((await page.evaluate(() => window.__overlay?.() ?? 'null')) ?? 'null');
  if (!ov) break;
  await page.waitForTimeout(700); // a tutorial page takes no press until it has stood 400 ms (ui/tutorialPopup.js INPUT_GRACE_MS)
  await page.keyboard.press('Space');
  await frames(3);
}
// a window the fight opens (a level gained, the first blow's tutorial page) closes as a player would close it - a
// tutorial page by a fresh press past its grace, any other by Escape - said in the log; one still open after that, or a
// death, fails the probe: a game paused under a window is no measure of anything
const closeWindows = async () => {
  for (let k = 0; k < 12; k++) {
    const ov = JSON.parse((await page.evaluate(() => window.__overlay?.() ?? 'null')) ?? 'null');
    if (!ov) return;
    console.log(`  a window: ${ov.kind ?? JSON.stringify(ov).slice(0, 80)}`);
    if (ov.kind === 'DeathScreen')
      await fail(
        `the character died - its health by frame (frame, health, maximum): ${JSON.stringify(await page.evaluate(() => window.__hpTrace))}`,
      );
    await page.waitForTimeout(700);
    await page.keyboard.press(ov.kind === 'TutorialBox' ? 'Space' : 'Escape');
    await frames(3);
  }
  await fail('a window stayed open');
};
const say = () => page.evaluate(async () => (await import('/src/ui/midScreenText.js')).midScreenText.text);
const state = () => page.evaluate(() => window.__delve()?.state() ?? null);
const heal = () =>
  page.evaluate(() => {
    const p = window.__playerEntity;
    if (p) p.health = p.maxHealth;
  });
const shot = async (tag) => {
  if (shots) await page.screenshot({ path: `${shots}/${tag}.png` });
};
// THE COST: the host's frame and its marks' pass, timed in the page
await page.evaluate(() => {
  const h = window.__delve();
  if (!h) return;
  window.__delveCost = { frame: 0, draw: 0, n: 0, max: 0, near: [], far: [] };
  const C = window.__delveCost,
    f = h.frame.bind(h),
    d = h.drawPass.bind(h);
  h.frame = (...a) => {
    const t = performance.now();
    f(...a);
    const ms = performance.now() - t;
    C.frame += ms;
    C.n++;
    C.max = Math.max(C.max, ms);
  };
  // each pass's time kept by where the eye stood: within 5 m of a heart (its pieces' crystals filling the view) or not
  h.drawPass = (proj, view, eye) => {
    const t = performance.now(),
      r = d(proj, view, eye),
      ms = performance.now() - t;
    C.draw += ms;
    (h.sites.some((q) => eye && Math.hypot(eye[0] - q.x, eye[2] - q.z) < 5) ? C.near : C.far).push(ms);
    return r;
  };
});
// THE CHARACTER KEPT WHOLE: the probe measures the encounters, not the bench character's life - healed every 50 ms in the
// page (a level-1 character dies to a Wellsprings' pours between the probe's steps), said here so no reading forgets it
// a wave's three blows can land in one frame under the software rasteriser (a frame is 0.1 s of the game's time), so the
// pool is past any wave's reach: nothing the encounters size reads it (the pieces are sized by level - Delve-II.md 5)
await page.evaluate(() => {
  setInterval(() => {
    const p = window.__playerEntity;
    if (p && p.health > 0) {
      p.maxHealth = Math.max(p.maxHealth, 100_000);
      p.health = p.maxHealth;
    }
  }, 50);
});
// a death kept to its cause: the character's health and maximum at each frame's start, the last 12 said if it dies
await page.evaluate(() => {
  const T = (window.__hpTrace = []);
  const tick = () => {
    const p = window.__playerEntity;
    T.push([window.__frame, p?.health, p?.maxHealth]);
    if (T.length > 12) T.shift();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
console.log('(the character is kept whole by the probe)');
const sites = await page.evaluate(() => window.__delve()?.sites ?? null);
if (!sites) await fail('no encounter host on the context');
console.log(`${region} / ${name}: ${sites.length} site(s)`);
if (!sites.length) await fail('the plan stood no site');
if (LAB) {
  // DLV6: where the lab stood me and what it said (no ward woken at the boot), then its panel off the pictures
  const boot = await page.evaluate(() => window.__player?.pos ?? null);
  console.log(
    `  lab boot: at ${JSON.stringify(boot?.map((v) => Math.round(v * 10) / 10))}, said "${await say()}", ${JSON.stringify(await state())}`,
  );
  await page.evaluate(() => document.getElementById('delve-lab')?.remove());
}

for (const s of sites) {
  const fps0 = await page.evaluate(() => window.__frame);
  console.log(`site ${s.i}: ${s.kind} at [${s.x}, ${s.y}, ${s.z}] r ${s.r}, vault [${s.vault.join(', ')}]`);
  const at = (p) => page.evaluate(([x, y, z]) => window.__player.warp(x, y + 0.05, z), p);
  // the vantage: inside the disc on its +x side (a small room's wall stands just past it), looking back at the heart
  const look = async () => {
    const v = s.x + s.r * 0.75;
    await at([v, s.y, s.z]);
    await page.evaluate((p) => window.__pose(...p, -Math.PI / 2, -0.5), [v, s.y + 1.6, s.z]);
  };
  // near, then in
  await at([s.x + s.r + 5, s.y, s.z]);
  await frames(6);
  console.log(`  near: "${await say()}"`);
  await shot(`site${s.i}-near`);
  await at([s.x, s.y, s.z]);
  await frames(4);
  console.log(`  in: "${await say()}"  ${JSON.stringify((await state())[s.i])}`);
  await look();
  await frames(4);
  await shot(`site${s.i}-in`);
  if (LAB) {
    // DLV6: the set pieces round the ward - from its heart, eye height, each of the four ways
    for (const [tag, yaw] of [
      ['north', 0],
      ['east', Math.PI / 2],
      ['south', Math.PI],
      ['west', -Math.PI / 2],
    ]) {
      await page.evaluate(([x, y, z, w]) => window.__pose(x, y, z, w, -0.12), [s.x, s.y + 1.6, s.z, yaw]);
      await frames(3);
      await shot(`site${s.i}-set-${tag}`);
    }
  }
  if (LOOK) {
    await at([s.x + s.r + 5, s.y, s.z]);
    await frames(4);
    continue;
  }
  const t0 = Date.now();
  const killMine = () =>
    page.evaluate((i) => {
      let k = 0;
      for (const [j] of Object.entries(JSON.parse(window.__foes()))) {
        const r = window.__foeRecord(Number(j));
        if (r && r._delve?.i === i && !r.dead && r.entity) {
          window.__damageFoe(Number(j), r.entity.health + 999);
          k++;
        }
      }
      return k;
    }, s.i);
  /** The dungeon's own foes within 30 m of the site felled, as a player would fight them (a blow on a carrier lets its
   *  piece go - the game's law), said when any were; the encounter's own are killMine's. */
  const clearNear = async () => {
    const n = await page.evaluate(
      ([x, z]) => {
        const out = [];
        for (const [j, f] of Object.entries(JSON.parse(window.__foes()))) {
          const r = window.__foeRecord(Number(j));
          if (!r || r._delve || f.dead || !f.pos || Math.hypot(f.pos[0] - x, f.pos[2] - z) > 30) continue;
          out.push(`${f.type} ${Math.round(Math.hypot(f.pos[0] - x, f.pos[2] - z))} m`);
          window.__damageFoe(Number(j), (r.entity?.health ?? 1) + 999);
        }
        return out;
      },
      [s.x, s.z],
    );
    if (n.length) console.log(`  the dungeon's own foes felled: ${n.join(', ')}`);
  };
  /** Stood a step off a piece on the heart's side, looking at its middle, the weapon readied - as a defender stands. */
  const aimAt = async (p) => {
    const dx = s.x - p[0],
      dz = s.z - p[2],
      d = Math.hypot(dx, dz) || 1,
      a = [p[0] + (dx / d) * 1.2, p[1], p[2] + (dz / d) * 1.2];
    await at(a);
    await page.evaluate(
      ([x, y, z, tx, tz, mid]) =>
        window.__pose(
          x,
          y + 1.6,
          z,
          Math.atan2(tx - x, tz - z),
          -Math.atan2(y + 1.6 - mid, Math.hypot(tx - x, tz - z)),
        ),
      [a[0], a[1], a[2], p[0], p[2], p[1] + 0.8],
    );
    const hand = () =>
      page.evaluate(() => {
        const w = window.__combat.weapon();
        return w ? { sheathed: !!w.sheathed, cd: window.__playerEntity?.equipCountdown ?? 0 } : null;
      });
    for (let k = 0; k < 40 && (await hand())?.sheathed; k++) {
      if (k === 0) await page.evaluate(() => window.__combat.toggleSheath());
      await frames(5);
    }
    for (let k = 0; k < 40 && (await hand())?.cd > 0; k++) await frames(5);
  };
  /** THE MEASURE (Delve-II.md section 5: "measured in the game before they ship"): the character's own damage a second on
   *  piece `j` - a swing pressed every frame for 150 frames, the game's own pace deciding when one starts. A frame's step
   *  is the bench's 0.1 s at most (scenes/dungeon.js), so under 10 frames a second 150 frames are 15 s of the game's time.
   *  A window that opens mid-measure (the first swing's tutorial page) pauses the game: that measure is cut and taken again. */
  const measureDps = async (j) => {
    let r = null;
    for (let k = 0; k < 4 && !(r && !r.cut); k++) {
      await closeWindows();
      r = await page.evaluate(async () => {
        const h = window.__delve(),
          w0 = performance.now(),
          f0 = window.__frame;
        let dmg = 0,
          n = 0,
          presses = 0,
          cut = false;
        const f = h.hit.bind(h);
        h.hit = (c, d, kk) => {
          const ok = f(c, d, kk);
          if (ok) {
            dmg += d;
            n++;
          }
          return ok;
        };
        while (window.__frame < f0 + 150) {
          if (window.__overlay?.()) {
            cut = true;
            break;
          }
          window.__playerEntity.health = window.__playerEntity.maxHealth;
          window.__combat.clickAttack();
          presses++;
          await new Promise((res) => requestAnimationFrame(res));
        }
        h.hit = f;
        return {
          dmg,
          n,
          presses,
          cut,
          frames: window.__frame - f0,
          wallS: (performance.now() - w0) / 1000,
          lv: window.__playerEntity.level,
        };
      });
    }
    if (r.cut) {
      console.log('  dps: not measured - a window kept opening');
      return;
    }
    void j;
    const fps = r.frames / r.wallS,
      gameS = fps < 10 ? r.frames * 0.1 : r.wallS;
    console.log(
      `  dps: ${(r.dmg / gameS).toFixed(2)} at level ${r.lv} (${r.n} blows, ${r.dmg} in ${gameS.toFixed(1)} s of the game's time, ${fps.toFixed(1)} frames a second)`,
    );
  };
  if (s.kind === 'wellsprings' || s.kind === 'seals') {
    // a piece struck as a player strikes it: stood on the heart's side, looking at it, a swing pressed every frame (the
    // game's own pace deciding when one starts) - in the page, a round trip a burst, not a swing
    let struck = 0,
      measured = false,
      quiet = Date.now();
    while (!(await state())[s.i].won && Date.now() - t0 < 2_400_000) {
      if (Date.now() - quiet > 60_000) {
        quiet = Date.now();
        console.log(`  still: ${JSON.stringify((await state())[s.i])} "${await say()}"`);
      }
      await closeWindows();
      await killMine();
      await clearNear();
      const st = (await state())[s.i];
      if (st.p === 1 || st.p === 9 || st.p === 4) {
        await at([s.x, s.y, s.z]);
        await frames(10);
        continue;
      } // rising, sunk, or the captain (felled by killMine)
      const spots = s.kind === 'seals' ? sealSpots(s, st.k) : springSpots(s, st.k);
      const j = st.hp.findIndex((h) => h > 0);
      if (j < 0) {
        await frames(5);
        continue;
      }
      await aimAt(spots[j]);
      if (DPS && !measured) {
        measured = true;
        await measureDps(j);
        continue;
      }
      const r = await page.evaluate(
        async ([i, jj]) => {
          const h = window.__delve(),
            before = h.state()[i].hp[jj],
            f0 = window.__frame;
          while (window.__frame < f0 + 60 && h.state()[i].hp[jj] > 0 && !h.state()[i].won) {
            window.__combat.clickAttack();
            await new Promise((res) => requestAnimationFrame(res));
          }
          const st = h.state()[i];
          return { before, after: st.hp[jj] ?? null, p: st.p };
        },
        [s.i, j],
      );
      if (r.after == null)
        console.log(
          `  piece ${j}: ${r.before} -> gone with its phase (${r.p}: the window ran out, or the pieces fell)`,
        ); // a sink clears the pieces
      else if (r.after < r.before) {
        struck++;
        if (struck === 1) await shot(`site${s.i}-struck`);
        console.log(`  piece ${j}: ${r.before} -> ${r.after}`);
      }
    }
    if (!struck) await fail(`site ${s.i}: no swing ever landed on a piece`);
  } else if (s.kind === 'brazier') {
    await at([s.x + 1.8, s.y, s.z]);
    await frames(4 * 10 + 40);
    let quiet = Date.now();
    while (!(await state())[s.i].won && Date.now() - t0 < 600_000) {
      if (Date.now() - quiet > 30_000) {
        quiet = Date.now();
        console.log(
          `  still: ${JSON.stringify((await state())[s.i])} "${await say()}" at ${JSON.stringify(await page.evaluate(() => window.__player.pos.map((v) => Math.round(v * 10) / 10)))}`,
        );
      }
      await heal();
      await closeWindows();
      await killMine();
      await clearNear();
      const st = (await state())[s.i];
      if (st.p !== 6) {
        await frames(10);
        continue;
      }
      const j = [0, 1, 2, 3].slice(0, st.k).find((k) => !(st.lb & (1 << k)));
      await at([s.x, s.y, s.z]);
      await frames(6);
      if ((await state())[s.i].fl !== 1) continue;
      await at(brazierSpots(s, st.k)[j]);
      await frames(40);
      console.log(`  brazier ${j}: lit ${(((await state())[s.i].lb >> j) & 1) === 1}`);
    }
  } else if (s.kind === 'weighing') {
    const homes = weightSpots(s),
      plates = weighPlates(s);
    const why = async () =>
      console.log(
        `    health by frame (frame, health, maximum): ${JSON.stringify(await page.evaluate(() => window.__hpTrace))}`,
      );
    for (let j = 0; j < 2; j++) {
      await clearNear();
      // taken as a player takes it: stood a step off it, looking at it, the activation's own ray (tryActivate -> takeLoot)
      const w = homes[j],
        dx = s.x - w[0],
        dz = s.z - w[2],
        d = Math.hypot(dx, dz) || 1,
        a = [w[0] + (dx / d) * 1.2, w[1], w[2] + (dz / d) * 1.2];
      await at(a);
      await frames(4);
      await page.evaluate(
        ([x, y, z, tx, tz, mid]) =>
          window.__pose(
            x,
            y + 1.6,
            z,
            Math.atan2(tx - x, tz - z),
            -Math.atan2(y + 1.6 - mid, Math.hypot(tx - x, tz - z)),
          ),
        [a[0], a[1], a[2], w[0], w[2], w[1] + 0.25],
      );
      await frames(2);
      await page.evaluate(() => window.__activate());
      await frames(6);
      console.log(
        `  weight ${j}: ${(await state())[s.i].wt[j] === 1 ? 'taken' : 'NOT taken'} (${JSON.stringify((await state())[s.i].wt)})`,
      );
      if ((await state())[s.i].wt[j] !== 1) await why();
      await at(plates[j]);
      await frames(40);
      console.log(
        `  weight ${j}: ${(await state())[s.i].wt[j] === 2 ? 'on its plate' : 'NOT set'} (${JSON.stringify((await state())[s.i].wt)})`,
      );
      if ((await state())[s.i].wt[j] !== 2) await why();
    }
    await at(plates[2]);
    for (let k = 0; k < 30 && !(await state())[s.i].won; k++) {
      await frames(10);
      if (k % 5 === 4) console.log(`  still: ${JSON.stringify((await state())[s.i])} "${await say()}"`);
    }
  } else if (s.kind === 'hold' || s.kind === 'vigil') {
    let shotWave = false,
      quiet = Date.now();
    while (!(await state())[s.i].won && Date.now() - t0 < 900_000) {
      if (Date.now() - quiet > 30_000) {
        quiet = Date.now();
        console.log(`  still: ${JSON.stringify((await state())[s.i])} "${await say()}"`);
      }
      await heal();
      await closeWindows();
      const killed = await page.evaluate((i) => {
        let k = 0;
        for (const [j, f] of window.__delve() ? Object.entries(JSON.parse(window.__foes())) : []) {
          const r = window.__foeRecord(Number(j));
          if (r && r._delve?.i === i && !r.dead && r.entity) {
            window.__damageFoe(Number(j), r.entity.health + 999);
            k++;
          }
          void f;
        }
        return k;
      }, s.i);
      const st = (await state())[s.i];
      if (killed && !shotWave) {
        shotWave = true;
        await shot(`site${s.i}-wave`);
      }
      if (killed) console.log(`  wave ${st.w} (phase ${st.p}): struck ${killed}, "${await say()}"`);
      await look();
      await frames(10);
    }
  } else {
    await frames(4);
    const deadline = Date.now() + 120_000;
    await look();
    let shown = false;
    while ((await state())[s.i].p !== 6 && Date.now() < deadline) {
      await frames(5);
      if (!shown) {
        shown = true;
        await shot(`site${s.i}-show`);
      }
    }
    await shot(`site${s.i}-show-done`);
    const { order } = (await state())[s.i];
    const plates = litanyPlates(s);
    console.log(`  the order: ${order.join(' ')}`);
    for (const j of order) {
      await at([s.x, s.y, s.z]);
      await frames(3);
      await at(plates[j]);
      await frames(3);
      console.log(`  plate ${j}: next ${(await state())[s.i].next}`);
    }
  }
  await look();
  await frames(4);
  const st = (await state())[s.i];
  const fr = (await page.evaluate(() => window.__frame)) - fps0;
  console.log(
    `  ${st.won ? 'WON' : 'NOT WON'} in ${((Date.now() - t0) / 1000).toFixed(0)} s (${fr} frames): "${await say()}", vault ${st.vault} item(s), chest ${st.chest ? 'stood' : 'NOT stood'}`,
  );
  await shot(`site${s.i}-won`);
  if (!st.won) await fail(`site ${s.i} never won`);
  const opened = await page.evaluate((i) => {
    window.__delve().press(`delve:vault:${i}`);
    return window.__overlay();
  }, s.i);
  console.log(`  the vault: ${JSON.parse(opened ?? 'null')?.kind ?? 'no window'}`);
  await shot(`site${s.i}-vault`);
  await closeWindows();
  if (await page.evaluate(() => window.__overlay?.() ?? null)) await fail('a window stayed open over the encounters');
}
const cost = await page.evaluate(() => window.__delveCost);
if (cost?.n)
  console.log(
    `cost: frame ${(cost.frame / cost.n).toFixed(3)} ms mean, ${cost.max.toFixed(2)} ms worst; marks ${(cost.draw / cost.n).toFixed(3)} ms mean over ${cost.n} frames`,
  );
const spread = (a) => {
  const q = [...a].sort((x, y) => x - y),
    at = (k) => (q.length ? q[Math.min(q.length - 1, Math.floor(k * q.length))].toFixed(2) : '-');
  return `median ${at(0.5)}, 90% ${at(0.9)}, worst ${at(1)} ms over ${q.length}`;
};
if (cost?.n) console.log(`marks by the eye: within 5 m of a heart ${spread(cost.near)}; farther ${spread(cost.far)}`);
if (errors.length) await fail(`page errors:\n  ${errors.join('\n  ')}`);
console.log('OK');
await browser.close();
await server.close();
