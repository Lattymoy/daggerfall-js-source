import fs from 'fs';
const { BsaFile } = await import('../../../src/formats/bsaFile.js');
const { ClassFile } = await import('../../../src/formats/classFile.js');
const bsa = new BsaFile(new Uint8Array(fs.readFileSync((process.env.ARENA2_PATH ?? '')+'/MONSTER.BSA')));
const groups=[['Undead',0x01,0x10],['Daedra',0x02,0x20],['Humanoid',0x04,0x40],['Animals',0x08,0x80]];
let both=0, n=0, nonzero=[];
for (let i=0;i<bsa.count;i++) {
  const name = bsa.getRecordName(i);
  if (!/^ENEMY\d{3}\.CFG$/.test(name)) continue;
  const cf = new ClassFile(); cf.load(bsa.getRecordBytes(i)); const c = cf.career;
  n++;
  const f = c.attackModifierFlags;
  const hits = groups.filter(([g,b,ph])=>((f&b)===b)&&((f&ph)===ph)).map(x=>x[0]);
  if (f) nonzero.push([name, c.name, '0x'+f.toString(16)]);
  if (hits.length) { both++; console.log('BOTH BITS:', name, c.name, '0x'+f.toString(16), hits.join(',')); }
}
console.log('ENEMY*.CFG careers read:', n, 'with nonzero attackModifierFlags:', nonzero.length, JSON.stringify(nonzero));
console.log('careers carrying BOTH bonus+phobia for one group:', both);
