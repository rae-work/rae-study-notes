#!/usr/bin/env node
/**
 * 把构建产物摆进安卓工程的 assets/。
 * 本机（scripts/apk.sh --local）和云端工作流都跑这一个脚本，两边不会不一致。
 *
 *   assets/index.html   ← dist/<app.id>.html
 *   assets/audio/*.m4a  ← 只拷这一版真正用得到的（挑选逻辑见 lib/bundle.js）
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, P } from './lib/paths.js';
import { distFile } from './lib/build.js';
import { neededAudio, copyAudio, assertNoMissing } from './lib/bundle.js';

const ASSETS = path.join(P.android, 'app/src/main/assets');

const html = path.join(P.dist, distFile());
if (!fs.existsSync(html)) {
  console.error(`找不到 ${path.relative(ROOT, html)} —— 先跑 npm run build`);
  process.exit(1);
}

fs.mkdirSync(ASSETS, { recursive: true });
fs.copyFileSync(html, path.join(ASSETS, 'index.html'));

const { need, missing } = neededAudio();
assertNoMissing(missing, '打包');
const { count, bytes } = copyAudio(need, path.join(ASSETS, 'audio'));

const total = fs.readdirSync(P.audio).filter((f) => f.endsWith('.m4a')).length;
const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
console.log(`assets/index.html   ${(fs.statSync(html).size / 1024).toFixed(0)} KB`);
console.log(`assets/audio/       ${count} 个 · ${mb(bytes)}（音库共 ${total} 个，其余是旧内容留下的）`);
