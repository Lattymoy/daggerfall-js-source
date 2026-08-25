import { defineConfig } from 'vite';
import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Dev-only: serve ARENA2 game data at /arena2/*. The data is freeware but
// never committed or bundled (Port-Doctrine); builds contain no game files.
function arena2DevServer() {
  const root = process.env.ARENA2_PATH || '/home/claude/dfdata/arena2';
  // ARENA2 FOLDERS IN THE WILD ARE MIXED CASE. The retail data was
  // written on a filesystem that did not care, and real installs prove
  // it: the DaggerfallSetup build carries INVE00I0.img beside
  // INVE04I0.IMG and ANIM0001.vid beside ANIM0002.VID - 76 of its
  // 1,598 files are lowercase. The port's own data path already knows
  // this (dataSource.normalizeName uppercases on both ingest and
  // lookup, so the browser is fine), and THIS server did not: on Linux
  // a request for INVE00I0.IMG 404'd against a file that was sitting
  // right there. Production worked and dev did not, which is the worst
  // way round.
  //
  // One directory read, cached, mapping the canonical uppercase name
  // to whatever the disk actually calls it.
  let byUpper = null;
  const onDisk = (name) => {
    if (!byUpper) {
      byUpper = new Map();
      try {
        for (const f of readdirSync(root)) byUpper.set(f.toUpperCase(), f);
      } catch { /* no folder yet - the fallbacks below still answer */ }
    }
    return byUpper.get(name.toUpperCase()) ?? name;
  };
  return {
    name: 'arena2-dev-server',
    configureServer(server) {
      server.middlewares.use('/arena2', (req, res, next) => {
        const name = decodeURIComponent(req.url.slice(1).split('?')[0]);
        // Flat directory only - no separators, no traversal.
        if (!/^[A-Za-z0-9._-]+$/.test(name)) return next();
        let path = join(root, onDisk(name));
        // B1: books live in ARENA2/BOOKS/ - a flat BOK*.TXT name falls
        // back to the subfolder (still no separators in the URL name).
        if (!existsSync(path) && /^BOK\d+\.TXT$/i.test(name)) path = join(root, 'BOOKS', name);
        if (!existsSync(path)) {
          res.statusCode = 404;
          return res.end('not found');
        }
        // configureServer middlewares run BEFORE vite's cors layer, so
        // headless probe pages (null origin via setContent) need the
        // header here or their fetch() dies while ESM imports work.
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/octet-stream');
        createReadStream(path).pipe(res);
      });
    },
  };
}

// base is set for GitHub Pages deploy at lattymoy.github.io/<repo>/
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // TWO PAGES. The game, and the voxel editor — which is a real route
    // now rather than a standalone file you have to build yourself.
    // Neither carries game data: the editor asks for the user's ARENA2
    // through the same dataSource door the game uses. See
    // src/tools/paperdollViewer.js.
    rollupOptions: {
      input: {
        main: 'index.html',
        viewer: 'viewer.html',
        // A PROTOTYPE, and deployed on purpose: a design that claims to
        // adapt to a phone has to be opened on one.
        enhanced: 'enhanced.html',
        // The same, for the FRONT DOOR - the four boot screens
        // (title, launcher, splash, PICK03I0) as one menu.
        menu: 'menu.html',
        // And for the wizard behind it, one stage at a time.
        chargen: 'chargen.html',
      },
    },
  },
  plugins: [arena2DevServer()],
});
