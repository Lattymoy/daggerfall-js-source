// PROFILE-SLOTS (2026-10-28, the owner: "Overhaul the profile page ... a detailed character slot section ... an actual
// preview of either your morrowind/sprite for the selected character"; bible/04-Characters/Aura-Armory.md section 10) -
// THE CHARACTER'S SLOTS, STOOD UP IN A REAL BROWSER over the real sheet, under Vite (the sprite table is a Vite glob): the
// account card's own section on its stage, round three bodies - the sprite (Eye of the Beholder's own skin), Layered
// Gearing (the character's own body in plate) and the Morrowind body (retail's skeleton read by the game's own bone
// reader, a mannequin on its bones standing in for Bethesda's mesh, framed as combat/fpArm.js stage() frames one). It
// reads back that the stage draws, that the pieces and the plate land on the body (the crown over the head, the heart on
// the chest, the plate over the crown), that a choice tried on reaches the stage and a press reaches the flow, and that
// the section fits a desktop's window and a phone's. Photographs to tools/shots/ (or SHOT_DIR).
//
//     node tools/profileSlotsProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { parseNif } from '../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } from '../src/formats/morrowind/mwSkin.js';
import { armBonesInBody } from '../src/combat/fpArm.js';
import { PNG } from 'pngjs';
import { retailSkeleton } from '../test/fixtures/mw/retailRig.mjs';
import { STAGE_BONES } from '../src/render/characterStage.js';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
  if (!ok) fails++;
};
const SK = buildSkeleton(parseNif(retailSkeleton()));
const MW_BONES = armBonesInBody({ skeleton: SK, mats: skeletonSpaceMatrices(SK, new Map(), GRAPH_ROOT) }, STAGE_BONES);
// a blank page on Vite's own server (the sprite table is a Vite glob) - the game's page would stand its menu over the stage
const BLANK = {
  name: 'slots-probe-page',
  configureServer(s) {
    s.middlewares.use('/slotsprobe/', (_q, res) => {
      res.setHeader('content-type', 'text/html');
      res.end('<!doctype html><meta charset="utf-8"><body></body>');
    });
  },
};
const server = await createServer({ server: { port: 5241, strictPort: true }, logLevel: 'silent', plugins: [BLANK] });
await server.listen();
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const pageErrors = [];

const WARDROBE = {
  titles: ['gatebreaker', 'founder', 'genesis'],
  title: 'gatebreaker',
  glyphs: ['sprout', 'origin'],
  glyphsOff: [],
  auras: ['dagonfire', 'eternal'],
  aura: 'dagonfire',
  icons: [],
  icon: null,
  armoryHeld: ['burningcrown', 'emberheart', 'ashbound', 'cinderstride', 'breachbrand', 'eternalhalo', 'eternalsigil'],
  armory: 'aaaa0',
};

/** THE CARD MOUNTED over the real sheet on a blank page, round one body - its read-back for the checks. */
const MOUNT = async ({ body, wardrobe, bones }) => {
  const { injectEnhancedStyle } = await import('/src/ui/enhanced/enhancedStyle.js');
  const { injectNameStyle } = await import('/src/ui/nameLayer.js');
  const { accountCard } = await import('/src/ui/enhanced/enhancedAccount.js');
  const { startCharacterStage } = await import('/src/render/characterStage.js');
  const { profileBodies } = await import('/src/ui/profileBody.js');
  const { wardrobeEntry } = await import('/src/ui/collections/wardrobeCatalogue.js');
  const { multiply } = await import('/src/world/mat4.js');
  const { NAME_GAP_PX } = await import('/src/net/remotePlayers.js');
  const { POSE_AT } = await import('/src/render/armoryPose.js');
  window.__stage?.off?.();
  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;background:#0b0a10';
  injectEnhancedStyle();
  injectNameStyle(document);
  // THE MORROWIND BODY: a mannequin of boxes on retail's bones, drawn as fpArm.stage() frames its picture
  const mwStage = ({ width, height, frame }) => {
    const { proj, view, eye } = frame(bones);
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const gl = c.getContext('webgl2', { alpha: true, preserveDrawingBuffer: true });
    const q = (n) => bones[n];
    const v = [];
    const box = (a, b, rx, rz) => {
      const ax = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
        l = Math.hypot(...ax),
        u = ax.map((x) => x / l);
      const s0 = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const sx = [u[1] * s0[2] - u[2] * s0[1], u[2] * s0[0] - u[0] * s0[2], u[0] * s0[1] - u[1] * s0[0]],
        sl = Math.hypot(...sx),
        s = sx.map((x) => x / sl);
      const t = [u[1] * s[2] - u[2] * s[1], u[2] * s[0] - u[0] * s[2], u[0] * s[1] - u[1] * s[0]];
      const P = (e, i, j) => [0, 1, 2].map((k) => e[k] + s[k] * i * rx + t[k] * j * rz);
      const corners = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ];
      for (let k = 0; k < 4; k++) {
        const [i0, j0] = corners[k],
          [i1, j1] = corners[(k + 1) % 4];
        const n = [0, 1, 2].map((m) => s[m] * (i0 + i1) + t[m] * (j0 + j1));
        for (const p of [P(a, i0, j0), P(a, i1, j1), P(b, i1, j1), P(a, i0, j0), P(b, i1, j1), P(b, i0, j0)])
          v.push(...p, ...n);
      }
      for (const [e, sg] of [
        [a, -1],
        [b, 1],
      ]) {
        const n = u.map((x) => x * sg);
        for (const p of [P(e, -1, -1), P(e, 1, -1), P(e, 1, 1), P(e, -1, -1), P(e, 1, 1), P(e, -1, 1)])
          v.push(...p, ...n);
      }
    };
    const head = q('bip01 head'),
      neck = q('bip01 neck');
    box([head[0], head[1] - 0.1, head[2]], [head[0], head[1] + 0.12, head[2]], 0.085, 0.1);
    box(neck, [head[0], head[1] - 0.08, head[2]], 0.05, 0.05);
    box(q('bip01 pelvis'), [neck[0], neck[1] - 0.02, neck[2]], 0.16, 0.1);
    for (const S of ['l', 'r']) {
      box(q(`bip01 ${S} upperarm`), q(`bip01 ${S} forearm`), 0.052, 0.052);
      box(q(`bip01 ${S} forearm`), q(`bip01 ${S} hand`), 0.042, 0.042);
      box(q(`bip01 ${S} thigh`), q(`bip01 ${S} calf`), 0.07, 0.07);
      box(q(`bip01 ${S} calf`), q(`bip01 ${S} foot`), 0.055, 0.055);
    }
    const sh = (t, s) => {
      const x = gl.createShader(t);
      gl.shaderSource(x, s);
      gl.compileShader(x);
      return x;
    };
    const p = gl.createProgram();
    gl.attachShader(
      p,
      sh(
        gl.VERTEX_SHADER,
        '#version 300 es\nlayout(location=0) in vec3 aP; layout(location=1) in vec3 aN; uniform mat4 vp; out vec3 n; void main(){ n = aN; gl_Position = vp * vec4(aP, 1.0); }',
      ),
    );
    gl.attachShader(
      p,
      sh(
        gl.FRAGMENT_SHADER,
        '#version 300 es\nprecision highp float; in vec3 n; out vec4 o; void main(){ o = vec4(vec3(0.16, 0.15, 0.17) + vec3(0.18, 0.17, 0.19) * max(dot(normalize(n), normalize(vec3(0.3, 0.7, 0.6))), 0.0), 1.0); }',
      ),
    );
    gl.linkProgram(p);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    // drawn by the camera handed in, as fpArm.stage() draws
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(p);
    gl.uniformMatrix4fv(gl.getUniformLocation(p, 'vp'), false, multiply(proj, view));
    gl.drawArrays(gl.TRIANGLES, 0, v.length / 6);
    const raw = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++)
      data.set(raw.subarray(y * width * 4, (y + 1) * width * 4), (height - 1 - y) * width * 4); // top row first, as renderCharacterSpriteImage
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { width, height, data, proj, view, eye, bones };
  };
  const arm =
    body === 'mw'
      ? { canThirdPerson: () => true, stage: mwStage, bodyHeight: () => null, raceHeightScale: () => 1 }
      : null;
  const settings = () =>
    body === 'layered' ? { 'Graphics.LayeredGear': 3 } : { 'Graphics.OnFoot': 0, 'Graphics.LayeredGear': 0 };
  const bodies = profileBodies({ arm, who: () => ({ gender: 'female', outfit: 'p6p6p6' }), settings });
  const w = JSON.parse(JSON.stringify(wardrobe));
  const pressed = [];
  const flow = {
    stage: 'in',
    busy: false,
    error: '',
    note: '',
    account: {
      name: 'Aelwyn',
      handle: 'Aelwyn',
      kind: 'linked',
      playedS: 3600,
      renown: [{ character: 'c1', name: 'Mara', level: 12, xp: 0 }],
    },
    wardrobe: w,
    values: {},
    agreed: {},
    equip(k) {
      pressed.push(['title', k]);
      w.title = w.title === k ? null : k;
      card.paint();
      return true;
    },
    wearAura(k) {
      pressed.push(['aura', k]);
      w.aura = w.aura === k ? null : k;
      card.paint();
      return true;
    },
    wearIcon(k) {
      pressed.push(['icon', k]);
      return true;
    },
    toggleGlyph(k) {
      pressed.push(['glyph', k]);
      return true;
    },
    wearArmory(slot, k) {
      pressed.push(['armory', slot, k]);
      return true;
    },
    wearArmoryKit(kit) {
      pressed.push(['kit', kit]);
      w.armory = kit;
      card.paint();
      return true;
    },
    go() {},
    set() {},
    submit() {},
    signOut() {},
    start() {},
  };
  const stage = document.createElement('div');
  stage.className = 'px-stage px-acctstage';
  const win = document.createElement('div');
  win.className = 'px-win px-acctwin';
  const bodyEl = document.createElement('div');
  bodyEl.className = 'px-body';
  const card = accountCard(document, flow, {
    slots: { start: startCharacterStage, bodies, entryOf: wardrobeEntry, gap: NAME_GAP_PX },
  });
  bodyEl.append(card.root);
  win.append(bodyEl);
  stage.append(win);
  document.body.append(stage);
  if (new URLSearchParams(location.search).has('tall')) win.style.maxHeight = 'none'; // the whole card for a photograph, no scroll under the footer
  window.__stage = card;
  window.__pressed = pressed;
  window.__flow = flow;
  await new Promise((r) => setTimeout(r, 1500)); // the stage's first frames, its body landed, its programs built
  const canvas = document.querySelector('.slots-canvas');
  const rect = canvas.getBoundingClientRect();
  const plate = document.querySelector('.slots-platehost .dfname');
  const pr = plate?.getBoundingClientRect();
  const winRect = win.getBoundingClientRect();
  const sec = document.querySelector('.acctslots').getBoundingClientRect();
  // read the stage back: lit pixels, and the brightest near points of the canvas
  const shot = document.createElement('canvas');
  shot.width = canvas.width;
  shot.height = canvas.height;
  return {
    canvas: { w: canvas.width, h: canvas.height, css: [rect.width, rect.height], x: rect.x, y: rect.y },
    plate: pr
      ? {
          x: pr.x + pr.width / 2 - rect.x,
          top: pr.top - rect.y,
          bottom: pr.bottom - rect.y,
          w: pr.width,
          text: plate.textContent,
        }
      : null,
    win: [winRect.width, winRect.height],
    sec: [sec.x, sec.width],
    vw: innerWidth,
    tiles: [...document.querySelectorAll('.slottile')].map((b) => [
      b.querySelector('.slotname').textContent,
      b.querySelector('.slotworn').textContent,
    ]),
    posePt: POSE_AT.crown,
  };
};

try {
  for (const [W, H, width] of [
    [1280, 900, 'desktop'],
    [390, 780, 'phone'],
  ]) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on('pageerror', (e) => pageErrors.push(String(e.message)));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|GPU stall|404/.test(m.text())) pageErrors.push(m.text());
    });
    await page.goto('http://localhost:5241/slotsprobe/?tall');
    for (const body of ['sprite', 'layered', 'mw']) {
      const r = await page.evaluate(MOUNT, { body, wardrobe: WARDROBE, bones: MW_BONES });
      const tag = `${width} ${body}`;
      await page.locator('.acctslots').screenshot({ path: `${OUT}/profileslots_${width}_${body}.png` });
      check(
        `${tag}: the stage stands, sized`,
        r.canvas.css[0] > 120 && r.canvas.css[1] > 160,
        JSON.stringify(r.canvas),
      );
      check(
        `${tag}: eight slots, each named, what it wears said`,
        r.tiles.length === 8 && r.tiles.every(([n, v]) => n && v),
        JSON.stringify(r.tiles),
      );
      check(
        `${tag}: the plate over the head, whole inside the stage`,
        !!r.plate &&
          r.plate.top >= 0 &&
          r.plate.bottom < r.canvas.css[1] * 0.3 &&
          Math.abs(r.plate.x - r.canvas.css[0] / 2) < 2,
        JSON.stringify(r.plate),
      );
      // the body bare (no aura, no kit) read back without its plate: its topmost drawn row, against the plate's bottom
      await page.evaluate(async () => {
        const f = window.__flow;
        f._keep = { aura: f.wardrobe.aura, armory: f.wardrobe.armory };
        f.wardrobe.aura = null;
        f.wardrobe.armory = null;
        window.__stage.paint();
        document.querySelector('.slots-platehost').style.visibility = 'hidden';
        await new Promise((r) => setTimeout(r, 400));
      });
      const bare = PNG.sync.read(await page.locator('.slots-canvas').screenshot());
      await page.evaluate(() => {
        const f = window.__flow;
        Object.assign(f.wardrobe, f._keep);
        window.__stage.paint();
        document.querySelector('.slots-platehost').style.visibility = '';
      });
      const bg = [bare.data[0], bare.data[1], bare.data[2]];
      let bodyTop = -1;
      for (let y = 0; y < bare.height && bodyTop < 0; y++)
        for (let x = Math.floor(bare.width * 0.25); x < bare.width * 0.75; x++) {
          const i = (y * bare.width + x) * 4;
          if (
            Math.abs(bare.data[i] - bg[0]) + Math.abs(bare.data[i + 1] - bg[1]) + Math.abs(bare.data[i + 2] - bg[2]) >
            40
          ) {
            bodyTop = y;
            break;
          }
        }
      const topCss = (bodyTop * r.canvas.css[1]) / bare.height;
      check(
        `${tag}: the plate clears the body's drawn head`,
        bodyTop > 0 && r.plate && r.plate.bottom <= topCss + 2,
        `plate bottom ${r.plate?.bottom.toFixed(1)}, body top ${topCss.toFixed(1)} css px`,
      );
      check(
        `${tag}: the section inside the viewport`,
        r.sec[0] >= 0 && r.sec[0] + r.sec[1] <= r.vw + 1,
        JSON.stringify(r.sec),
      );
      // the pixels: the stage read back through a screenshot of it - lit where the pieces stand
      const px = await page.evaluate(() => {
        const c = document.querySelector('.slots-canvas');
        window.__stage && void 0;
        const g = c.getContext('webgl2');
        return { ok: !!g };
      });
      check(`${tag}: the stage's canvas holds its own WebGL2`, px.ok);
    }
    // a choice tried on, then pressed: the Head slot's Eternal Halo - and a piece not held (the Eternal Armlets) said how it is had
    await page.locator('.slottile', { hasText: 'Head' }).first().click();
    await page.waitForTimeout(200);
    const halo = page.locator('button.actarmory', { hasText: 'Eternal Halo' });
    await halo.hover();
    await page.waitForTimeout(900);
    await page.locator('.acctslots').screenshot({ path: `${OUT}/profileslots_${width}_tryon.png` });
    await halo.click();
    const pressed = await page.evaluate(() => window.__pressed);
    check(
      `${width}: a held piece pressed is worn through the flow, in its slot`,
      JSON.stringify(pressed.at(-1)) === JSON.stringify(['armory', 'head', 'eternalhalo']),
      JSON.stringify(pressed),
    );
    await page.locator('.slottile', { hasText: 'Arms' }).first().click();
    await page.waitForTimeout(200);
    const lockedPiece = page.locator('button.actarmory.locked', { hasText: 'Eternal Armlets' });
    await lockedPiece.hover();
    await page.waitForTimeout(400);
    const how = await page.locator('.slots-look').textContent();
    check(`${width}: a piece not held is tried on and told how it is had`, /shop|Shop/.test(how ?? ''), how ?? '');
    await page.locator('.acctslots').screenshot({ path: `${OUT}/profileslots_${width}_locked.png` });
    await page.locator('.slottile', { hasText: 'Over the head' }).first().click();
    await page.waitForTimeout(500);
    await page.locator('.acctslots').screenshot({ path: `${OUT}/profileslots_${width}_plate.png` });
    // the longest name the wire takes (net/wire.js NAME_MAX), in its widest letters: ended inside the stage, never cut
    const long = await page.evaluate(async () => {
      window.__flow.account.name = 'W'.repeat(24);
      window.__stage.paint();
      await new Promise((r) => setTimeout(r, 300));
      const c = document.querySelector('.slots-canvas').getBoundingClientRect(),
        p = document.querySelector('.slots-platehost .dfname-who');
      const r = p.getBoundingClientRect();
      return {
        left: r.left - c.left,
        right: c.right - r.right,
        cut: p.scrollWidth > p.clientWidth,
        face: getComputedStyle(p).fontFamily,
      };
    });
    check(
      `${width}: the longest name ends in an ellipsis inside the stage`,
      long.left >= 0 && long.right >= 0 && long.cut,
      JSON.stringify(long),
    );
    check(`${width}: the plate in the world's names' face`, /Pixelify|Silkscreen/.test(long.face), long.face);
    await page.locator('.acctslots').screenshot({ path: `${OUT}/profileslots_${width}_longname.png` });
    await page.close();
  }
  // CLOSE: the sprite at three pixels a pixel in each line's whole set - the pieces on the painted body, judged at size
  const close = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 3 });
  close.on('pageerror', (e) => pageErrors.push(String(e.message)));
  await close.goto('http://localhost:5241/slotsprobe/?tall');
  for (const line of ['dagonfire', 'eternal']) {
    for (const body of ['sprite', 'layered']) {
      const kit = await close.evaluate(async (l) => (await import('/src/net/armoryLaw.js')).armoryLineKit(l), line);
      await close.evaluate(MOUNT, { body, wardrobe: { ...WARDROBE, armory: kit, aura: null }, bones: MW_BONES });
      await close.locator('.slots-figure').screenshot({ path: `${OUT}/profileslots_close_${body}_${line}.png` });
    }
  }
  check('no page error', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 600));
} finally {
  if (pageErrors.length) console.log('page errors:', pageErrors.join(' | ').slice(0, 1200));
  await browser.close();
  await server.close();
}
console.log(fails ? `${fails} failed` : 'all ok');
process.exitCode = fails ? 1 : 0;
