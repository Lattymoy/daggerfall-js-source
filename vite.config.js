import { defineConfig } from 'vite';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';

// Dev-only: serve ARENA2 game data at /arena2/*. The data is freeware but
// never committed or bundled (Port-Doctrine); builds contain no game files.
function arena2DevServer() {
  const root = process.env.ARENA2_PATH || '/home/claude/dfdata/arena2';
  return {
    name: 'arena2-dev-server',
    configureServer(server) {
      server.middlewares.use('/arena2', (req, res, next) => {
        const name = decodeURIComponent(req.url.slice(1).split('?')[0]);
        // Flat directory only - no separators, no traversal.
        if (!/^[A-Za-z0-9._-]+$/.test(name)) return next();
        const path = join(root, name);
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
    rollupOptions: { input: { main: 'index.html', viewer: 'viewer.html' } },
  },
  plugins: [arena2DevServer()],
});
