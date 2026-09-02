/**
 * 把 content/ + src/ 合成单个离线 HTML。
 * 返回字符串，不写盘 —— scripts/build.js 负责写，validate.js 直接拿去渲染，
 * 保证「校验的那份」和「构建出来的那份」是同一份。
 */
import fs from 'node:fs';
import path from 'node:path';
import { P } from './paths.js';
import { loadContent, loadAudioManifest } from './content.js';

export function buildHtml(opts = {}) {
  const content = opts.content || loadContent();
  const audio = opts.audio || loadAudioManifest();

  const tpl = fs.readFileSync(path.join(P.src, 'template.html'), 'utf8');
  const css = fs.readFileSync(path.join(P.src, 'app.css'), 'utf8');
  const engine = fs.readFileSync(path.join(P.src, 'engine.js'), 'utf8');
  const icon = fs.readFileSync(path.join(P.src, 'icon-180.png')).toString('base64');

  const meta = content.meta;
  const lang = meta.default_lang;

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const brand = meta.app.brand || [meta.app.name, ''];

  const vars = {
    HTML_LANG: lang,
    APP_ID: meta.app.id,
    APP_NAME: esc(meta.app.name),
    BRAND_A: esc(brand[0]),
    BRAND_B: esc(brand[1] || ''),
    BUILD_VERSION: meta.app.version,
    // 页脚的「最后更新」。用构建当天的日期，不带时分 —— 精确到分钟对
    // 学习者没有意义，反而每次构建都在变。
    // 取本地日期而不是 toISOString（那是 UTC）：在日惹是 UTC+7，
    // 凌晨构建会显示成前一天。
    BUILD_DATE: (() => {
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    })(),
    // 版本历史（CHANGELOG）的地址。仓库是公开的，<a href> 不加载任何东西，
    // 离线版照样能用（点了才需要网络）。
    CHANGELOG_URL: esc(meta.app.repo ? meta.app.repo + '/blob/main/CHANGELOG.md' : ''),
    REPO_URL: esc(meta.app.repo || ''),
    ICON_B64: icon,
    TITLE: esc(meta.app.title[lang] || meta.app.title.zh || meta.app.name),
    LANG_BUTTONS: meta.langs
      .map((l) => `<button data-lang="${l}">${esc(meta.lang_names[l] || l)}</button>`)
      .join(''),
    CSS: trim(css),
    CONTENT: jsonForScript(content),
    AUDIO: jsonForScript(audio.items || {}),
    ENGINE: trim(engine),
  };

  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{{${k}}}`).join(v);

  const left = out.match(/\{\{(\w+)\}\}/g);
  if (left) throw new Error(`模板占位符没填完：${left.join(', ')}`);

  assertOffline(out);
  return out;
}

const trim = (s) => s.replace(/^\n+|\n+$/g, '');

/** 产物文件名，跟着 meta.app.id 走 */
export function distFile() {
  return loadContent().meta.app.id + '.html';
}

/** 内联进 <script> 的 JSON：`</script>` 与 U+2028/2029 会截断脚本，必须转义。 */
function jsonForScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003C')
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * 交付形式硬约束：页面不许**加载**任何外部资源。
 * 只查「会真的发起请求」的地方 —— 内联 JSON 里出现一个网址字符串（比如教材
 * 音频的出处链接）不算违规，那是数据，不是资源引用。
 *
 * 关于 `<a href="https://…">`：**允许**。
 * 超链接不会加载任何东西，页面照样完全离线可用 —— 用户点了才跳出去，
 * 而且是交给浏览器打开，不是页面自己发请求。页脚的 GitHub 链接就靠这条。
 * 但 `<link href>`（样式表 / 图标）和 src / action 仍然一律拦下。
 */
/**
 * 唯一的例外：词汇表里的「网上词典」（Rae 2026-09-02 定的）。
 * 查词汇表没收录的词，只在用户主动搜索时才发请求，不影响其余功能离线可用。
 * 这三个域名（Wiktionary 释义 · MyMemory 译文 · 印尼语维基百科跨语言链接）以外的一律照拦。
 */
const ALLOWED_HOSTS = ['https://en.wiktionary.org/', 'https://api.mymemory.translated.net/', 'https://id.wikipedia.org/'];

function assertOffline(html) {
  // 把内联数据摘掉再查
  let code = html
    .replace(/var CONTENT = [\s\S]*?;\nvar AUDIO = [\s\S]*?;\n/, 'var CONTENT={};var AUDIO={};\n');
  for (const h of ALLOWED_HOSTS) code = code.split(h).join('allowed://');

  const bad = [];
  const patterns = [
    [/<script[^>]+\ssrc\s*=/i, '外部 <script src>'],
    [/<link[^>]+rel=["']?stylesheet/i, '外部样式表'],
    [/@import\s+url/i, 'CSS @import'],
    [/@font-face/i, 'web font'],
    [/<(?:img|iframe|video|audio|source|embed)[^>]+src=["'](?!data:)[^"']*:\/\//i, '外部媒体资源'],
    [/<link[^>]+href\s*=\s*["']https?:\/\//i, '外部 <link>'],
    [/(?:src|action)\s*=\s*["']https?:\/\//i, '外部资源引用'],
    [/url\(\s*["']?https?:\/\//i, 'CSS url() 外部资源'],
    [/\b(?:fetch|XMLHttpRequest|importScripts)\s*\(\s*["'`]https?:\/\//i, '代码里请求外部地址'],
  ];
  for (const [re, name] of patterns) {
    const m = code.match(re);
    if (m) bad.push(`${name} → ${String(m[0]).slice(0, 90)}`);
  }
  if (bad.length) throw new Error('构建产物含外部资源，违反离线约束：\n  ' + bad.join('\n  '));
}
