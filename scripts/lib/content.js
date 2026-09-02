/**
 * 读 content/ 下的全部内容，拼成引擎用的那一个对象。
 * validate.js / build.js / tts.js 共用，保证三边看到的是同一份数据。
 */
import fs from 'node:fs';
import path from 'node:path';
import { P } from './paths.js';

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

export function loadContent() {
  const meta = readJson(path.join(P.content, 'meta.json'));

  const lessons = fs
    .readdirSync(P.lessons)
    .filter((f) => /^L\d+\.json$/.test(f))
    .sort()
    .map((f) => readJson(path.join(P.lessons, f)))
    .sort((a, b) => a.num - b.num);

  const vocab = readJson(path.join(P.content, 'vocab.json'));
  const drills = readJson(path.join(P.content, 'drills.json'));

  const ui = {};
  for (const lang of meta.langs) {
    const f = path.join(P.i18n, `ui.${lang}.json`);
    ui[lang] = fs.existsSync(f) ? readJson(f) : {};
  }

  return { meta, lessons, vocab, drills, ui };
}

export function loadAudioManifest() {
  const f = path.join(P.audio, 'manifest.json');
  if (!fs.existsSync(f)) return { version: 0, items: {}, count: 0 };
  return readJson(f);
}

/** 学习者语言对象必须有的键。加语言时这里加一个，再把 meta.langs / required_langs
 *  / ui.<lang>.json / learner.<lang> 一起补上。 */
export const TRI_LANGS = ['zh', 'ja', 'en', 'vi'];

/**
 * 遍历内容里的每一个「多语对象」（恰好 TRI_LANGS 那几个键）。
 * cb(obj, 路径字符串)
 */
export function walkTri(root, cb, base = '') {
  (function rec(o, p) {
    if (o == null || typeof o !== 'object') return;
    if (isTri(o)) { cb(o, p); return; }
    if (Array.isArray(o)) { o.forEach((v, i) => rec(v, `${p}[${i}]`)); return; }
    for (const [k, v] of Object.entries(o)) rec(v, p ? `${p}.${k}` : k);
  })(root, base);
}

export function isTri(o) {
  return (
    o != null && typeof o === 'object' && !Array.isArray(o) &&
    Object.keys(o).length === TRI_LANGS.length && TRI_LANGS.every((k) => k in o)
  );
}
