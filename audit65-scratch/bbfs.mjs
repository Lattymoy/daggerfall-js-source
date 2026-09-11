import { readFileSync } from 'node:fs';
const p = process.argv[2];
const s = readFileSync(p, 'utf8');
const i = s.indexOf('const BB_FS = `');
const j = s.indexOf('`;', i);
let body = s.slice(i, j);
body = body.replace(/\$\{SHADE_DARK\}/g, '0.12');
process.stdout.write(body);
