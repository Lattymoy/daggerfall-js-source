// OWN-WORDS1 (bible/06-Systems/Own-Words.md): which tests read DFU's words of a quest we now carry in our own? Run them
// with this preloaded and every read of vendor/dfu-quests/Quests/NAME.txt that has an own file reads ours instead:
//   node --import ./tools/ownQuestRedirect.mjs --test <test files>
// A test that fails only this way pins DFU's text of a rewritten quest: move it to the pack (test/qlSources.mjs) if it
// pins what the player sees, or leave it on DFU's file if it pins DFU's file on purpose. A probe, never part of the suite.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';

const OWN = fileURLToPath(new URL('../src/systems/quest/own/', import.meta.url));
const own = new Set(fs.readdirSync(OWN));
const readFileSync = fs.readFileSync;
fs.readFileSync = function ownFirst(path, ...rest) {
  const p = typeof path === 'string' ? path : path instanceof URL ? fileURLToPath(path) : null;
  const m = p && /vendor[\\/]dfu-quests[\\/]Quests[\\/]([^\\/]+\.txt)$/.exec(p);
  return readFileSync.call(this, m && own.has(m[1]) ? OWN + m[1] : path, ...rest);
};
syncBuiltinESMExports();
