import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const hash = createHash('sha256');
function scan(dir) {
  for (const entry of readdirSync(dir, {withFileTypes: true}).sort((a,b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) scan(path); else hash.update(path).update(readFileSync(path));
  }
}
scan('src'); scan('scripts'); scan('public/icons');
for (const file of ['package.json','package-lock.json','next.config.ts']) hash.update(readFileSync(file));
hash.update(readFileSync('public/offline.html'));
writeFileSync('public/sw.js', readFileSync('scripts/sw-template.js', 'utf8').replace('__VERSION__', hash.digest('hex').slice(0,16)));
