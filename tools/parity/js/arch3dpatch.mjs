import { ARCH3D_PATCH } from '../../../src/formats/arch3dPatch.js';
import fs from 'node:fs';
const lines = ARCH3D_PATCH.map(([o, d]) => `${o}\t${Array.from(d).join(',')}`);
fs.writeFileSync(process.argv[2], lines.join('\n') + '\n');
console.error('JS patch entries:', ARCH3D_PATCH.length, 'total bytes:', ARCH3D_PATCH.reduce((a, [, d]) => a + d.length, 0));
