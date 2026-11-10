import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const assets = (await fs.readdir('dist/assets')).filter(name => /\.(js|css|woff2?|svg|png)$/.test(name)).map(name => 'assets/'+name);
const shell = await fs.readFile('dist/index.html', 'utf8');
const version = crypto.createHash('sha256').update(shell).update(assets.join('\n')).digest('hex').slice(0,16);
const sw = await fs.readFile('public/sw.js', 'utf8');
await fs.writeFile('dist/sw.js', `const SHELL_VERSION=${JSON.stringify(version)};\nconst SHELL_FILES=${JSON.stringify(['./', ...assets])};\n`+sw);
