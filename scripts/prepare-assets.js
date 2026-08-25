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

/* 防线：APK 是离线运行的，里面绝不能出现任何外部资源。
   访问统计只注入 docs/（网站那一份），这里再兜一道 ——
   万一有人手工把 docs/index.html 拷进来，立刻拦下。 */
const packed = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
const leak = packed.match(/https?:\/\/[^"'\s)]+/g);
if (leak) {
  const real = leak.filter((u) => !/^https?:\/\/(www\.)?(ugm\.id|w3\.org)/.test(u));
  if (real.length) {
    console.error(`\n❌ 打包用的 index.html 里有外部资源引用，APK 必须离线：`);
    real.slice(0, 5).forEach((u) => console.error('     ' + u.slice(0, 90)));
    console.error('   多半是误把 docs/index.html（带访问统计那份）拷进来了。');
    console.error('   正确做法：npm run build 之后跑 npm run prepare-assets。\n');
    process.exit(1);
  }
}

const { need, missing } = neededAudio();
assertNoMissing(missing, '打包');
const { count, bytes } = copyAudio(need, path.join(ASSETS, 'audio'));

const total = fs.readdirSync(P.audio).filter((f) => f.endsWith('.m4a')).length;
const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
console.log(`assets/index.html   ${(fs.statSync(html).size / 1024).toFixed(0)} KB`);
console.log(`assets/audio/       ${count} 个 · ${mb(bytes)}（音库共 ${total} 个，其余是旧内容留下的）`);
