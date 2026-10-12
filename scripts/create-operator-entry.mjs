import { copyFile, mkdir } from 'node:fs/promises';
import { OPERATOR_DIRECTORY } from '../src/portal.ts';
const directory = new URL(`../dist/${OPERATOR_DIRECTORY}/`, import.meta.url);
await mkdir(directory, { recursive: true });
await copyFile(new URL('../dist/index.html', import.meta.url), new URL('index.html', directory));
