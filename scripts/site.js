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
 * 使用情况收集（src/site-telemetry.js）同理，只注入这一份。
 * 它是**内联**的（没有 src 属性），所以就算有人误把 docs/index.html
 * 拷进 APK，prepare-assets.js 那道防线也不会被它误伤 —— 真正拦下误拷的
 * 是上面那段 Cloudflare 统计的 <script src>。
 *
 * 用法：
 *   npm run site                          只生成，不写 CNAME
 *   npm run site -- --domain belajar.rae.work
 *   npm run site -- --tag test            这一份的数据标成「试用」，查询时排除
 *   TELEMETRY_ENDPOINT=… npm run site     临时换收集地址（不改代码）
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

/* 使用情况收集的接收地址（worker/ 那个 Cloudflare Worker）。
   同样写死在这里而不是 meta.json，理由同上。
   部署步骤见 worker/README.md；**留空就整段不注入**，网站行为跟以前一模一样。 */
const COLLECT = process.env.TELEMETRY_ENDPOINT || 'https://catatan.zirui-mail.workers.dev/n';

const DOCS = path.join(ROOT, 'docs');

let domain = process.env.SITE_DOMAIN || '';
let buildTag = process.env.TELEMETRY_TAG || '';
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--domain') domain = argv[++i] || '';
  else if (argv[i] === '--tag') buildTag = argv[++i] || '';
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

let inject = '';

if (token) {
  if (!/^[0-9a-f]{32}$/i.test(token)) {
    console.error('\n❌ meta.json 的 site.analytics_token 不像 Cloudflare 的 token');
    console.error('   应该是 32 位十六进制，现在是 ' + token.length + ' 个字符\n');
    process.exit(1);
  }
  inject +=
    '<script defer src="' + BEACON + '" data-cf-beacon=\'{"token":"' + token + '"}\'></script>\n';
}

/* ── 使用情况收集 ──────────────────────────────────────────
   内联注入，没有 src 属性 —— 广告拦截器按域名拦外部脚本，拦不到内联的；
   真正会被拦的是上面那条 beacon。两者互不影响，坏一个另一个照常。 */
if (COLLECT) {
  /* 线上只认 https；http 只放行本机，给自测用（浏览器也只对本机放行明文请求）。 */
  const okUrl = /^https:\/\/[^\s"'<>]+$/.test(COLLECT) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/[^\s"'<>]*$/.test(COLLECT);
  if (!okUrl) {
    console.error('\n❌ 收集地址不像一个 https 网址：' + COLLECT);
    console.error('   改 scripts/site.js 里的 COLLECT，或设环境变量 TELEMETRY_ENDPOINT\n');
    process.exit(1);
  }
  let collector = fs.readFileSync(path.join(P.src, 'site-telemetry.js'), 'utf8');
  /* 内联脚本遇到字面量 </script> 会被就地截断，页面直接坏掉。
     源文件里本来就不该有，这里再确认一次。 */
  if (/<\/script/i.test(collector)) {
    console.error('\n❌ src/site-telemetry.js 里出现了 </script，内联会把页面截断\n');
    process.exit(1);
  }
  for (const [k, v] of [['__ENDPOINT__', COLLECT], ['__VER__', meta.app.version], ['__TAG__', buildTag]]) {
    if (!collector.includes(k)) {
      console.error(`\n❌ src/site-telemetry.js 里找不到占位符 ${k}\n`);
      process.exit(1);
    }
    collector = collector.split(k).join(String(v).replace(/["'\\<>]/g, ''));
  }
  inject += '<script>\n' + collector + '</scr' + 'ipt>\n';
}

if (inject) {
  /* 用 lastIndexOf 而不是 replace：内联的课程数据里 < 已被转义成 \\u003C，
     不会有字面 </body>；但 CSS 或引擎里将来万一出现，replace 会打在错的地方。 */
  const at = page.lastIndexOf('</body>');
  if (at < 0) {
    console.error('\n❌ 产物里找不到 </body>，注入中止\n');
    process.exit(1);
  }
  const head = '<!-- 仅网站版：访问统计与使用情况收集。源在 content/ 和 src/，' +
    '请勿手改本文件，跑 npm run site 重新生成 -->\n';
  page = page.slice(0, at) + head + inject + page.slice(at);
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
console.log(COLLECT
  ? `使用情况收集      已注入（${COLLECT}${buildTag ? ' · 标记 ' + buildTag : ''}）`
  : '使用情况收集      未注入（scripts/site.js 里的 COLLECT 是空的）');
if (COLLECT && !buildTag) {
  console.log('                  ⚠️ 这一份的数据算正式数据。自己试用请加 --tag test');
}
