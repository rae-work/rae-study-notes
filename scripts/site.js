#!/usr/bin/env node
/**
 * 生成可以直接托管的网站目录 docs/。
 *
 *   docs/index.html   ← dist/<app.id>.html（改名成 index.html，托管才认）
 *   docs/audio/*.m4a  ← 这一版用得到的音频（引擎里写的是相对路径 audio/xxx.m4a）
 *   docs/CNAME        ← 自定义域名，GitHub Pages 靠它认域名
 *   docs/.nojekyll    ← 关掉 Jekyll，静态文件原样发布
 *
 * 为什么必须带 audio/：音频没有内联进 HTML，页面是按相对路径去取的。
 * 只传一个 HTML 上去，点读会全部 404，然后退回设备自带语音（发音不准）。
 *
 * 用法：
 *   npm run site                          只生成，不写 CNAME
 *   npm run site -- --domain belajar.rae.work
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, P } from './lib/paths.js';
import { distFile } from './lib/build.js';
import { neededAudio, copyAudio, assertNoMissing } from './lib/bundle.js';

const DOCS = path.join(ROOT, 'docs');

let domain = process.env.SITE_DOMAIN || '';
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--domain') domain = argv[++i] || '';
}

const html = path.join(P.dist, distFile());
if (!fs.existsSync(html)) {
  console.error(`找不到 ${path.relative(ROOT, html)} —— 先跑 npm run build`);
  process.exit(1);
}

fs.mkdirSync(DOCS, { recursive: true });
fs.copyFileSync(html, path.join(DOCS, 'index.html'));
fs.writeFileSync(path.join(DOCS, '.nojekyll'), '');

const { need, missing } = neededAudio();
assertNoMissing(missing, '发布网站');
const { count, bytes } = copyAudio(need, path.join(DOCS, 'audio'));

const cnameFile = path.join(DOCS, 'CNAME');
if (domain) {
  fs.writeFileSync(cnameFile, domain + '\n');
} else if (fs.existsSync(cnameFile)) {
  domain = fs.readFileSync(cnameFile, 'utf8').trim();   /* 保留上次设的域名 */
}

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
const htmlSize = fs.statSync(html).size;
console.log(`docs/index.html   ${kb(htmlSize)}`);
console.log(`docs/audio/       ${count} 个 · ${mb(bytes)}`);
console.log(`合计              ${mb(htmlSize + bytes)}`);
console.log(domain ? `docs/CNAME        ${domain}` : 'docs/CNAME        （没设域名，用 --domain 指定）');
