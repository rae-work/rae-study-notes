#!/usr/bin/env node
/** content/ + src/ → dist/<meta.app.id>.html */
import fs from 'node:fs';
import path from 'node:path';
import { P } from './lib/paths.js';
import { buildHtml, distFile } from './lib/build.js';

const html = buildHtml();
fs.mkdirSync(P.dist, { recursive: true });
const out = path.join(P.dist, distFile());
fs.writeFileSync(out, html);

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`构建完成 → dist/${distFile()}  ${kb(Buffer.byteLength(html))}`);
