#!/usr/bin/env node
/**
 * 一次性脚本：把 legacy/belajar-bahasa.html 里的内容抽成 content/ 下的 JSON。
 *
 * 做法：用 jsdom 真实执行整个旧 App（KICKOFF §5 明确要求，不用正则硬扒），
 * 再从同一个 realm 里 eval 出 D / VOCAB / SITUASI / TEMPAT / ANGKA_POOL。
 * 这样连引擎里的 helper 都能拿到，后面 validate.js 拿它做渲染回归基线。
 *
 * 转换规则：
 *   - 印尼语字段保持纯字符串
 *   - 面向学习者的文字转成 {zh, ja, en}；ja / en 暂缺时填 null，Phase 1.4 再补
 *   - 早期课程 "English. 中文" / "中文 · english" 混写的释义拆成 en / zh
 *   - 语体按 content/register.json 判定，alt 保守生成（拿不准就 null）
 *
 * 用法：node scripts/extract-legacy.js [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { ROOT, P } from './lib/paths.js';
import { detectRegister, toFormal, REG } from './lib/register.js';
import { ZH_FILL, TITLE_FIX } from './lib/legacy-zh-fill.js';

const REG_PAIRS = REG.pairs;
const REG_CASUAL_ONLY = REG.casual_only;

const DRY = process.argv.includes('--dry');
const report = { warn: [], info: [], todo: [] };
const warn = (m) => report.warn.push(m);
const todo = (m) => report.todo.push(m);

/* ── 1. 跑起旧 App，取出数据 ─────────────────────────────────── */

const legacyHtml = fs.readFileSync(path.join(P.legacy, 'belajar-bahasa.html'), 'utf8');
const vc = new VirtualConsole();
vc.on('jsdomError', () => {}); // HTMLMediaElement.pause 未实现，与数据无关
const dom = new JSDOM(legacyHtml, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const w = dom.window;
const D = w.eval('D');
const VOCAB = w.eval('VOCAB');
const { SITUASI, TEMPAT, ANGKA_POOL } = w;

if (!Array.isArray(D) || D.length !== 13) throw new Error(`D 异常：${D && D.length}`);
if (!Array.isArray(VOCAB) || !VOCAB.length) throw new Error('VOCAB 异常');

/* ── 2. 文本工具 ────────────────────────────────────────────── */

const CJK = /[㐀-鿿　-〿＀-￯]/;
const hasCJK = (s) => CJK.test(String(s || ''));
const hasLatinWord = (s) => /[A-Za-z]{2,}/.test(String(s || ''));
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, '');

/** 中文里的 ASCII 直引号统一成「」（CLAUDE.md 内容规则）。 */
function fixQuotes(s) {
  if (typeof s !== 'string' || !hasCJK(s)) return s;
  let out = s.replace(/[“”]/g, (m) => (m === '“' ? '「' : '」'));
  let open = true;
  out = out.replace(/"/g, () => (open = !open, open ? '」' : '「'));
  return out;
}

/** 三语对象。缺的语言填 null，validate 会列出来。 */
function tri(zh, ja = null, en = null) {
  return { zh: zh == null ? null : fixQuotes(zh), ja, en: en == null ? null : en };
}

/**
 * 印尼语词表 —— 用来判断「中文串里的拉丁字母」到底是英文释义还是引用的印尼语词。
 * 由 VOCAB 的词条 + 课程数据里所有印尼语句子填充（见下方 buildIdWords）。
 */
const ID_WORDS = new Set();
function isIndonesianish(word) {
  const lw = word.toLowerCase().replace(/^['’]+|['’]+$/g, '');
  if (!lw) return true;
  if (ID_WORDS.has(lw)) return true;
  if (/^[A-Z]/.test(word)) return true; // 人名 / 地名：Sarah、Budi、Jaksel
  return false;
}

/**
 * 拆 "中文 · english" / "english · 中文" / "English sentence. 中文。" 混写。
 * 拆不动时：若剩下的拉丁词全是印尼语（中文说明里引用生词），静默当纯中文；
 * 否则整串当中文并登记成待办。
 */
function splitMixed(raw, where) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return tri(null);
  if (!hasCJK(s)) return tri(null, null, s); // 纯英文
  if (!hasLatinWord(stripTags(s))) return tri(s); // 纯中文

  // ① 中间点分隔，可以多段："<b>already</b> · 已经"、"<b>can</b> · 能 · 会"
  const dot = s.split(/\s+[·•]\s+/).map((x) => x.trim()).filter(Boolean);
  if (dot.length >= 2) {
    const zhParts = dot.filter(hasCJK);
    const enParts = dot.filter((x) => !hasCJK(x));
    if (zhParts.length && enParts.length && !enParts.every(latinAllIndonesian)) {
      return tri(tidy(zhParts.join(' · ')), null, tidy(enParts.join(' · ')));
    }
  }

  // ② 英文句在前、中文句在后："I like eating. 我喜欢吃。"、"combine 组合(…)"
  const m = s.match(/^([^㐀-鿿]*[A-Za-z][^㐀-鿿]*?)\s+([㐀-鿿][\s\S]*)$/);
  if (m && hasCJK(m[2]) && !hasCJK(m[1]) && !latinAllIndonesian(m[1])) {
    return tri(tidy(m[2]), null, tidy(m[1]));
  }

  // ③ 中文在前、英文短语收尾："谢啦,哥/姐! thanks!" / "手机号 phone number"
  const m2 = s.match(/^([\s\S]*[㐀-鿿][^A-Za-z]*)\s+([A-Za-z][A-Za-z\s,'’!.?/&()-]*)$/);
  if (m2 && !hasCJK(m2[2]) && !latinAllIndonesian(m2[2])) {
    return tri(tidy(m2[1]), null, tidy(m2[2]));
  }

  // 拆不动：剩下的拉丁词若全是印尼语/专名，就是「中文说明里引用了生词」，正常
  if (latinAllIndonesian(stripTags(s))) return tri(s);

  todo(`[混写释义拆不动] ${where}：${s}`);
  return tri(s);
}

/** 拆分后去掉两端残留的分隔点与空白（"最快说「不」· " → "最快说「不」"）。 */
function tidy(s) {
  return String(s).replace(/^[\s·•]+|[\s·•]+$/g, '');
}

/** 一段文字里的拉丁词是不是全都是印尼语（或专名）。 */
function latinAllIndonesian(s) {
  const words = String(s).match(/[A-Za-z][A-Za-z'’-]*/g) || [];
  return words.length > 0 && words.every(isIndonesianish);
}

/* ── 2b. 填印尼语词表 ──────────────────────────────────────── */

(function buildIdWords() {
  const feed = (s) => {
    for (const t of String(s).match(/[A-Za-z][A-Za-z'’-]*/g) || []) ID_WORDS.add(t.toLowerCase());
  };
  for (const v of VOCAB) { feed(v.w); if (v.ex) feed(v.ex); }
  for (const s of SITUASI) { feed(s.q); feed(s.a); s.alts.forEach(feed); }
  for (const t of TEMPAT) feed(t.a);
  // 课程数据里所有确定是印尼语的字段
  const idFields = {
    phead: ['title'], sec: ['word'], pattern: ['code'], currency: ['id', 'rp'],
  };
  for (const l of D) for (const p of l.pages) for (const b of p) {
    for (const f of idFields[b.k] || []) if (b[f]) feed(b[f]);
    if (b.k === 'examples') b.items.forEach((i) => feed(i.id));
    if (b.k === 'dialog') b.rows.forEach((r) => feed(r.id));
    if (b.k === 'vocab') b.items.forEach((i) => feed(i.w));
    if (b.k === 'syll') b.items.forEach((i) => { feed(i.w); feed(i.s); });
    if (b.k === 'pics') b.items.forEach(([, wrd]) => feed(wrd));
    if (b.k === 'alpha') b.items.forEach(([, say]) => feed(say));
    if (b.k === 'numgrp') b.items.forEach(([, say]) => feed(say));
    if (b.k === 'phones') b.items.forEach((i) => feed(i.say));
    if (b.k === 'ladder') b.items.forEach((i) => feed(i.id));
    if (b.k === 'fillblank') b.items.forEach((i) => { feed(i.pre); feed(i.ans); feed(i.post); feed(i.say); });
    if (b.k === 'qa_list') b.items.forEach((i) => {
      if (i.prompt.lang === 'id') feed(i.prompt.text);
      if (i.answer.lang === 'id') feed(i.answer.text);
    });
    if (b.k === 'note') b.lines.forEach((ln) => {
      if (typeof ln === 'string') { for (const m of ln.match(/<s>([^<]+)<\/s>/g) || []) feed(m); }
      else feed(ln.id);
    });
  }
  // 语体配对表里的词也算
  for (const [c, f] of REG_PAIRS) { feed(c); feed(f); }
  for (const p of REG_CASUAL_ONLY) feed(p);
})();

/* ── 3. 印尼语句子 → {id, reg, alt, gloss, alt_gloss, kw} ──── */

let altAuto = 0, altTodo = 0;
function sentence(id, glossRaw, kw, where, { allowAlt = true } = {}) {
  const reg = detectRegister(id);
  const out = { id: String(id), reg };
  if (allowAlt && reg === 'casual') {
    const alt = toFormal(id);
    if (alt) { out.alt = alt; altAuto++; }
    else { out.alt = null; altTodo++; todo(`[alt 待补] ${where}：${id}`); }
  } else {
    out.alt = null;
  }
  out.gloss = splitMixed(glossRaw, where);
  out.alt_gloss = null; // 省略即复用 gloss，Phase 1.4 按需补
  if (kw && kw.length) out.kw = kw.slice();
  return out;
}

/* ── 4. 逐块转换 ───────────────────────────────────────────── */

function convertBlock(b, where) {
  const k = b.k;
  switch (k) {
    case 'phead':
      return { k, title: b.title, sub: tri(b.zh) };
    case 'lead':
    case 'psub2':
      return { k, text: splitMixed(b.text, `${where}/${k}`) };
    case 'mini':
      // 「常用称呼 · panggilan」这种装饰性小标题，右半是印尼语不是英文释义，
      // 拆开会把印尼语塞进 en。整串当中文，ja / en 由 Phase 1.4 重写。
      return { k, text: tri(b.text) };
    case 'rule':
      return b.short ? { k, short: true } : { k };
    case 'reviewbtn':
      return { k };
    case 'sec':
      return { k, num: b.num, word: b.word, reg: detectRegister(b.word), gloss: splitMixed(b.en, `${where}/sec ${b.word}`) };
    case 'pattern':
      return { k, code: b.code, note: splitMixed(b.note, `${where}/pattern`) };
    case 'alpha':
      return { k, items: b.items.map(([letter, say]) => [letter, say]) };
    case 'pics':
      return { k, items: b.items.map(([emoji, word, zh]) => ({ emoji, w: word, gloss: tri(zh) })) };
    case 'vocab':
      return { k, items: b.items.map((it) => ({
        w: it.w,
        reg: detectRegister(it.w),
        gloss: it.en == null ? tri(it.zh) : tri(it.zh, null, it.en),
      })) };
    case 'dialog':
      return { k, rows: b.rows.map((r) => ({ who: r.who, ...sentence(r.id, r.gloss, r.kw, `${where}/dialog`) })) };
    case 'examples': {
      const o = { k };
      if (b.title != null) o.title = fixTitle(b.title);
      o.items = b.items.map((it) => sentence(it.id, it.gloss, it.kw, `${where}/examples`));
      return o;
    }
    case 'numgrp': {
      // glab 是「0 – 10 · dasar 基础」这种带数字范围的标签，
      // 拆开会把范围丢掉；整串当中文，ja / en 由 Phase 1.4 重写
      const o = { k, glab: tri(b.glab), items: b.items.map(([n, say]) => [n, say]) };
      if (b.ans) o.ans = true;
      return o;
    }
    case 'phones':
      return { k, items: b.items.map((it) => ({ d: it.d, say: it.say })) };
    case 'ladder':
      return { k, items: b.items.map((it) => ({
        lvl: tri(it.lvl),
        ...sentence(it.id, it.gloss, null, `${where}/ladder`, { allowAlt: false }),
      })) };
    case 'currency':
      return { k, rp: b.rp, id: b.id, gloss: splitMixed(b.gloss, `${where}/currency`) };
    case 'note': {
      const o = { k, tag: tri(b.tag) };
      if (b.green) o.green = true;
      o.lines = b.lines.map((ln) => (typeof ln === 'string'
        ? { text: tri(ln) }
        : { qa: true, who: ln.who, ...sentence(ln.id, ln.gloss, ln.kw, `${where}/note.qa`) }));
      return o;
    }
    case 'prompt':
      return { k, tag: tri(b.tag), text: splitMixed(b.text, `${where}/prompt`) };
    case 'qa_list': {
      const o = { k };
      if (b.title != null) o.title = fixTitle(b.title);
      o.items = b.items.map((it) => ({
        prompt: side(it.prompt, `${where}/qa_list.prompt`),
        answer: side(it.answer, `${where}/qa_list.answer`),
      }));
      return o;
    }
    case 'fillblank': {
      const o = { k };
      if (b.title != null) o.title = fixTitle(b.title);
      o.items = b.items.map((it) => ({
        pre: it.pre, ans: it.ans, post: it.post, say: it.say,
        reg: detectRegister(it.say || `${it.pre} ${it.ans} ${it.post}`),
        gloss: tri(it.zh),
      }));
      return o;
    }
    case 'syll':
      return { k, items: b.items.map((it) => ({
        w: it.w, s: it.s,
        gloss: it.en == null ? tri(it.zh) : tri(it.zh, null, it.en),
      })) };
    default:
      throw new Error(`未知 block 类型 ${k}（${where}）—— 先更新 lesson-spec 再抽取`);
  }
}

/** 练习标题：写死「英文」的那几个按 TITLE_FIX 改成中文视角。 */
function fixTitle(t) {
  const fix = TITLE_FIX[t];
  return fix ? tri(fix.zh, fix.ja || null, fix.en || null) : tri(t);
}

/** qa_list 的一侧：印尼语侧留纯字符串，学习者语言侧转三语对象。 */
function side(s, where) {
  if (s.lang === 'id') {
    const o = { lang: 'id', text: s.text, reg: detectRegister(s.text) };
    const alt = o.reg === 'casual' ? toFormal(s.text) : null;
    o.alt = alt || null;
    if (o.reg === 'casual' && !alt) { altTodo++; todo(`[alt 待补] ${where}：${s.text}`); }
    else if (alt) altAuto++;
    if (s.kw && s.kw.length) o.kw = s.kw.slice();
    return o;
  }
  // 旧数据里这一侧一律标着 lang:"en"，但实际上有中文也有英文（标错了）。
  // 按内容本身判断：中文进 zh，英文进 en，混写照常拆。
  const t = splitMixed(s.text, where);
  // 只有英文的，用手写的中文补上（lib/legacy-zh-fill.js）
  if (!t.zh && t.en) {
    const zh = ZH_FILL[t.en];
    if (zh) t.zh = zh;
    else todo(`[练习题缺中文] ${where}：${t.en}`);
  }
  return { lang: 'learner', text: t };
}

/* ── 5. 课程 ───────────────────────────────────────────────── */

const LESSON_SOURCE = {
  1: '1. Talking like a local', 2: '2. How to ask Questions', 3: '3. Numbers',
  4: '4. Time Expression', 5: '5. Feeling & States', 6: '6. Review Lesson',
  7: '7. Daily Routine', 8: '8. Daily Phrases', 9: '9. Read & Pronounce',
  10: '10. Days of the week', 11: '11. Latihan (Practice)', 12: '12. Essential words',
  13: '13. Indonesian Everyday Essentials',
};

const lessons = D.map((l) => ({
  num: l.num,
  source: `Cindy 私教讲义 · ${LESSON_SOURCE[l.num] || `第 ${l.num} 课`}`,
  reg_default: 'casual',
  name: tri(l.name),
  pages: l.pages.map((page, pi) => page.map((b, bi) => convertBlock(b, `L${l.num}p${pi + 1}b${bi + 1}`))),
}));

/* ── 6. 词汇表 ─────────────────────────────────────────────── */

const PAIR_MAP = new Map();
for (const [c, f] of REG.pairs) {
  PAIR_MAP.set(c.toLowerCase(), f);
  if (!PAIR_MAP.has(f.toLowerCase())) PAIR_MAP.set(f.toLowerCase(), c);
}

const seen = new Map();
const vocab = [];
for (const v of VOCAB) {
  const key = v.w.toLowerCase();
  if (seen.has(key)) { warn(`[词汇重复] "${v.w}" 已在第 ${seen.get(key)} 课，跳过第 ${v.les} 课的重复条目`); continue; }
  seen.set(key, v.les);
  const reg = detectRegister(v.w);
  vocab.push({
    w: v.w,
    les: v.les,
    reg,
    pair: PAIR_MAP.get(key) || null,
    gloss: tri(v.zh, null, v.en || null),
    pos: null,
    ex: v.ex || null,
    ex_reg: v.ex ? detectRegister(v.ex) : null,
    ex_gloss: v.exzh ? tri(v.exzh) : null,
    note: null,
  });
}

/* ── 7. 实战题库 ───────────────────────────────────────────── */

const drills = {
  situasi: SITUASI.map((s) => ({
    q: s.q, q_reg: detectRegister(s.q),
    hint: tri(s.hint),
    a: s.a, a_reg: detectRegister(s.a),
    alts: s.alts.slice(),
  })),
  tempat: TEMPAT.map((t) => ({ hint: tri(t.zh), a: t.a, a_reg: detectRegister(t.a) })),
  angka_pool: ANGKA_POOL.slice(),
};

/* ── 8. 写盘 ───────────────────────────────────────────────── */

function writeJson(file, obj) {
  if (DRY) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 1) + '\n');
}

for (const l of lessons) {
  writeJson(path.join(P.lessons, `L${String(l.num).padStart(2, '0')}.json`), l);
}
writeJson(path.join(P.content, 'vocab.json'), vocab);
writeJson(path.join(P.content, 'drills.json'), drills);

/* ── 9. 报告 ───────────────────────────────────────────────── */

const stat = { blocks: 0, sentences: 0, missJa: 0, missEn: 0, triTotal: 0 };
function walkTri(o) {
  if (o == null || typeof o !== 'object') return;
  if ('zh' in o && 'ja' in o && 'en' in o && Object.keys(o).length === 3) {
    stat.triTotal++;
    if (o.ja == null) stat.missJa++;
    if (o.en == null) stat.missEn++;
    return;
  }
  for (const v of Array.isArray(o) ? o : Object.values(o)) walkTri(v);
}
for (const l of lessons) { walkTri(l); for (const p of l.pages) stat.blocks += p.length; }
walkTri(vocab); walkTri(drills);

const regCount = {};
(function countReg(o) {
  if (o == null || typeof o !== 'object') return;
  if (typeof o.reg === 'string') regCount[o.reg] = (regCount[o.reg] || 0) + 1;
  for (const v of Array.isArray(o) ? o : Object.values(o)) countReg(v);
})(lessons);

console.log(`\n${DRY ? '【试跑，未写盘】' : '【已写入 content/】'}`);
console.log(`课程 ${lessons.length} 课 / ${lessons.reduce((n, l) => n + l.pages.length, 0)} 页 / ${stat.blocks} 块`);
console.log(`词汇 ${vocab.length} 条（去重前 ${VOCAB.length}）`);
console.log(`实战 情景 ${drills.situasi.length} / 地点 ${drills.tempat.length} / 数字池 ${drills.angka_pool.length}`);
console.log(`语体分布 ${Object.entries(regCount).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`alt 自动生成 ${altAuto} 句，待人工补 ${altTodo} 句`);
console.log(`三语对象 ${stat.triTotal} 个：缺 ja ${stat.missJa}，缺 en ${stat.missEn}`);
if (report.warn.length) { console.log(`\n⚠️  警告 ${report.warn.length} 条：`); report.warn.forEach((m) => console.log('   ' + m)); }
if (report.todo.length) {
  console.log(`\n📝 待办 ${report.todo.length} 条（前 25 条）：`);
  report.todo.slice(0, 25).forEach((m) => console.log('   ' + m));
  if (!DRY) fs.writeFileSync(path.join(ROOT, '.tmp/extract-todo.txt'), report.todo.join('\n') + '\n');
  console.log(`   完整清单：.tmp/extract-todo.txt`);
}
console.log('');
