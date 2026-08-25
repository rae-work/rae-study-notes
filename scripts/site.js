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
 * 访问统计：只注入这一份，不进 dist/、不进 APK。
 * 统计脚本是外部资源，assertOffline() 必然拦下 —— 而且 APK 本来就离线运行，
 * 注进去也统计不到。token 填在 content/meta.json 的 site.analytics_token。
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
import { loadContent } from './lib/content.js';

/* 统计服务商的域名写死在这里，不放 meta.json ——
   meta 会被整个内联进 dist/（跟着进 APK），那一份里不该出现任何外部域名。 */
const BEACON = 'https://static.cloudflareinsights.com/beacon.min.js';

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

/* 先把所有会让流程中止的检查跑完，再动 docs/ 里的任何文件。
   否则音频缺失时会留下「新 HTML + 旧音频」的半吊子部署。 */
const { need, missing } = neededAudio();
assertNoMissing(missing, '发布网站');

/* ── 注入访问统计（只有网站这一份）── */
const meta = loadContent().meta;
const token = String((meta.site && meta.site.analytics_token) || '').trim();
let page = fs.readFileSync(html, 'utf8');

if (token) {
  if (!/^[0-9a-f]{32}$/i.test(token)) {
    console.error('\n❌ meta.json 的 site.analytics_token 不像 Cloudflare 的 token');
    console.error('   应该是 32 位十六进制，现在是 ' + token.length + ' 个字符\n');
    process.exit(1);
  }
  /* 用 lastIndexOf 而不是 replace：内联的课程数据里 < 已被转义成 \\u003C，
     不会有字面 </body>；但 CSS 或引擎里将来万一出现，replace 会打在错的地方。 */
  const at = page.lastIndexOf('</body>');
  if (at < 0) {
    console.error('\n❌ 产物里找不到 </body>，统计注入中止\n');
    process.exit(1);
  }
  const tag =
    '<!-- 仅网站版：访问统计。源在 content/ 和 src/，请勿手改本文件，跑 npm run site 重新生成 -->\n' +
    '<script defer src="' + BEACON + '" data-cf-beacon=\'{"token":"' + token + '"}\'></script>\n';
  page = page.slice(0, at) + tag + page.slice(at);
}

fs.mkdirSync(DOCS, { recursive: true });
fs.writeFileSync(path.join(DOCS, 'index.html'), page);
fs.writeFileSync(path.join(DOCS, '.nojekyll'), '');

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
console.log(token
  ? `访问统计          已注入（Cloudflare · token ${token.slice(0, 6)}…）`
  : '访问统计          未注入（meta.json 里没填 site.analytics_token）');
