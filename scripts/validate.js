#!/usr/bin/env node
/**
 * 校验 —— 每次改完内容都必须跑，不过就别构建。
 *
 *   1  JSON 结构与必填字段
 *   2  三语齐全（zh / ja / en 都不为空）
 *   3  语体值合法（casual / formal / neutral）+ alt 可解析
 *   4  语体配对表自洽
 *   5  词汇表查重
 *   6  node --check（src/ 下的 JS + 构建产物里的脚本）
 *   7  jsdom 逐块渲染冒烟（抛异常 / 空输出 / undefined / [object Object]）
 *   8  实战题库压力测试（选项恰好 4 个且互不相同、答案索引正确）
 *   9  朗读文本的音频覆盖率
 *
 * 用法：
 *   node scripts/validate.js              严格模式：第 2 关缺任何一语都算失败
 *   node scripts/validate.js --allow-todo  迁移期：第 2 关只报数不失败
 *   node scripts/validate.js --quick       跳过第 7–9 关（不跑 jsdom）
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, P } from './lib/paths.js';
import { loadContent, loadAudioManifest, walkTri } from './lib/content.js';
import { REG, detectRegister } from './lib/register.js';

const ALLOW_TODO = process.argv.includes('--allow-todo');
const QUICK = process.argv.includes('--quick');

const REGISTERS = new Set(['casual', 'formal', 'neutral']);
const errors = [];
const warns = [];
const notes = [];
const err = (gate, m) => errors.push(`[${gate}] ${m}`);
const warn = (gate, m) => warns.push(`[${gate}] ${m}`);

let content, audio;
try {
  content = loadContent();
  audio = loadAudioManifest();
} catch (e) {
  console.error('读取 content/ 失败：' + e.message);
  process.exit(1);
}

/* ── 1. 结构 ─────────────────────────────────────────────── */

const G1 = '结构';
const BLOCK_FIELDS = {
  phead: { req: ['title', 'sub'] },
  lead: { req: ['text'] },
  psub2: { req: ['text'] },
  mini: { req: ['text'] },
  rule: { req: [] },
  reviewbtn: { req: [] },
  sec: { req: ['num', 'word', 'gloss'] },
  pattern: { req: ['code', 'note'] },
  alpha: { req: ['items'] },
  pics: { req: ['items'] },
  vocab: { req: ['items'] },
  dialog: { req: ['rows'] },
  examples: { req: ['items'] },
  numgrp: { req: ['glab', 'items'] },
  phones: { req: ['items'] },
  ladder: { req: ['items'] },
  currency: { req: ['rp', 'id', 'gloss'] },
  note: { req: ['tag', 'lines'] },
  prompt: { req: ['tag', 'text'] },
  qa_list: { req: ['items'] },
  fillblank: { req: ['items'] },
  syll: { req: ['items'] },
  listen: { req: ['file', 'title'] },
  table: { req: ['cols', 'rows'] },
};

const nums = new Set();
for (const l of content.lessons) {
  const at = `L${l.num}`;
  if (typeof l.num !== 'number') err(G1, `${at}：num 不是数字`);
  if (nums.has(l.num)) err(G1, `课号 ${l.num} 重复`);
  nums.add(l.num);
  for (const f of ['source', 'reg_default', 'name', 'pages']) {
    if (l[f] == null) err(G1, `${at}：缺字段 ${f}`);
  }
  if (l.reg_default && !REGISTERS.has(l.reg_default)) err(G1, `${at}：reg_default 非法值 ${l.reg_default}`);
  if (!Array.isArray(l.pages) || !l.pages.length) { err(G1, `${at}：pages 为空`); continue; }
  l.pages.forEach((page, pi) => {
    if (!Array.isArray(page) || !page.length) { err(G1, `${at} 第 ${pi + 1} 页为空`); return; }
    if (page[0].k !== 'phead') err(G1, `${at} 第 ${pi + 1} 页首块不是 phead，而是 ${page[0].k}`);
    page.forEach((b, bi) => {
      const where = `${at} p${pi + 1} b${bi + 1}`;
      const spec = BLOCK_FIELDS[b.k];
      if (!spec) { err(G1, `${where}：未知 block 类型 ${b.k}`); return; }
      for (const f of spec.req) if (b[f] == null) err(G1, `${where} [${b.k}]：缺字段 ${f}`);
    });
  });
}
if (!content.lessons.length) err(G1, 'content/lessons/ 里没有课程');

for (const l of content.lessons) {
  for (const page of l.pages) for (const b of page) {
    if (b.k !== 'listen') continue;
    const f = path.join(P.audio, b.file + '.m4a');
    if (!fs.existsSync(f)) err(G1, `L${l.num}：listen 块引用的音频不存在 —— audio/${b.file}.m4a`);
  }
}

for (const v of content.vocab) {
  if (!v.w) err(G1, `词汇表有条目缺 w`);
  if (typeof v.les !== 'number') err(G1, `词条 "${v.w}"：les 不是数字`);
  if (!v.gloss) err(G1, `词条 "${v.w}"：缺 gloss`);
  if (!nums.has(v.les)) err(G1, `词条 "${v.w}"：les=${v.les} 没有对应课程`);
}
for (const s of content.drills.situasi) {
  if (!s.q || !s.a || !Array.isArray(s.alts)) err(G1, `情景题结构不完整：${s.q || '(无问句)'}`);
  else if (s.alts.length < 3) err(G1, `情景题干扰项不足 3 个：${s.q}`);
}
for (const t of content.drills.tempat) if (!t.a || !t.hint) err(G1, `地点题结构不完整`);
if (!Array.isArray(content.drills.angka_pool)) {
  err(G1, 'drills.angka_pool 必须是数组');
} else if (content.drills.angka_pool.length === 0) {
  notes.push('  数字池是空的 —— 实战里的「几点了 / 数字价格」两种题型自动隐藏（教材还没教数字）');
} else if (content.drills.angka_pool.length < 20) {
  err(G1, `数字池只有 ${content.drills.angka_pool.length} 个，太少了（每个数都要有音频，至少 20）`);
}

/* ── 2. 三语齐全 ─────────────────────────────────────────── */

const G2 = '三语';
const missing = { zh: [], ja: [], en: [] };
let triTotal = 0;
const roots = [
  ...content.lessons.map((l) => [`L${l.num}`, l]),
  ['vocab', content.vocab],
  ['drills', content.drills],
  ['meta', content.meta.app.title],
];
for (const [name, root] of roots) {
  walkTri(root, (o, p) => {
    triTotal++;
    for (const lang of ['zh', 'ja', 'en']) {
      if (o[lang] == null || String(o[lang]).trim() === '') missing[lang].push(`${name}.${p}`);
    }
  }, '');
}
/* 哪些语言是硬性要求，由 content/meta.json 的 required_langs 决定。
   不在名单里的语言只报完成度，不算失败 —— 现在日文暂缓、英文待定。 */
const REQUIRED = new Set(content.meta.required_langs || ['zh', 'ja', 'en']);
for (const lang of ['zh', 'ja', 'en']) {
  if (!missing[lang].length) continue;
  const msg = `${triTotal} 个三语对象里，缺 ${lang} ${missing[lang].length} 处`;
  if (!REQUIRED.has(lang)) notes.push(`  ${msg}（${lang} 不在 required_langs 里，不算失败）`);
  else if (ALLOW_TODO) warn(G2, msg + '（--allow-todo：暂不算失败）');
  else err(G2, msg);
  if (REQUIRED.has(lang)) notes.push(`  缺 ${lang} 的前几处：${missing[lang].slice(0, 3).join('  ')}`);
}

/* 界面文案：三个文件的键集合必须完全一致 */
const uiLangs = content.meta.langs;
const uiKeys = {};
for (const lang of uiLangs) uiKeys[lang] = new Set(Object.keys(flatten(content.ui[lang] || {})));
const base = uiKeys[uiLangs[0]];
if (base.size === 0) notes.push('  content/i18n/ui.*.json 还是空的（界面文案随 Phase 2 重做一起抽）');
for (const lang of uiLangs.slice(1)) {
  const miss = [...base].filter((k) => !uiKeys[lang].has(k));
  const extra = [...uiKeys[lang]].filter((k) => !base.has(k));
  if (miss.length) err(G2, `ui.${lang}.json 缺键 ${miss.length} 个：${miss.slice(0, 5).join(', ')}`);
  if (extra.length) err(G2, `ui.${lang}.json 多出键 ${extra.length} 个：${extra.slice(0, 5).join(', ')}`);
}

function flatten(o, pre = '') {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    const key = pre ? `${pre}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

/* ── 3. 语体值 + alt ─────────────────────────────────────── */

const G3 = '语体';
let altCount = 0, altMissing = 0, regChecked = 0;
(function checkReg(o, where) {
  if (o == null || typeof o !== 'object') return;
  if (typeof o.reg === 'string') {
    regChecked++;
    if (!REGISTERS.has(o.reg)) err(G3, `${where}：非法语体值 "${o.reg}"`);
    const idText = typeof o.id === 'string' ? o.id : (o.lang === 'id' ? o.text : null);
    if (o.reg === 'casual' && typeof idText === 'string') {
      if (o.alt) {
        altCount++;
        if (o.alt === idText) err(G3, `${where}：alt 和原句一样 "${idText}"`);
        if (detectRegister(o.alt) === 'casual') {
          warn(G3, `${where}：alt "${o.alt}" 仍被判为口语体`);
        }
      } else {
        altMissing++;
      }
    }
  }
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') checkReg(v, o.id ? `${where}<${o.id}>` : `${where}.${k}`);
  }
})(content.lessons, 'lessons');

for (const v of content.vocab) {
  if (!REGISTERS.has(v.reg)) err(G3, `词条 "${v.w}"：非法语体值 "${v.reg}"`);
  if (v.ex_reg != null && !REGISTERS.has(v.ex_reg)) err(G3, `词条 "${v.w}"：ex_reg 非法 "${v.ex_reg}"`);
}

/* ── 4. 配对表自洽 ───────────────────────────────────────── */

const G4 = '配对';
const pairMap = new Map();
for (const p of REG.pairs) {
  if (!Array.isArray(p) || p.length !== 2 || !p[0] || !p[1]) { err(G4, `配对格式错误：${JSON.stringify(p)}`); continue; }
  const [c, f] = p;
  if (c.toLowerCase() === f.toLowerCase()) err(G4, `配对两端相同：${c}`);
  if (pairMap.has(c.toLowerCase())) err(G4, `口语词重复出现在配对表：${c}`);
  pairMap.set(c.toLowerCase(), f);
}
for (const w of REG.safe_swap) {
  if (!pairMap.has(String(w).toLowerCase())) err(G4, `safe_swap 里的 "${w}" 在 pairs 里没有配对`);
}
for (const w of REG.casual_only) {
  if (pairMap.has(String(w).toLowerCase())) err(G4, `"${w}" 同时出现在 casual_only 和 pairs 里`);
}
const vocabWords = new Map(content.vocab.map((v) => [v.w.toLowerCase(), v]));
let pairLinked = 0, pairDangling = 0;
for (const v of content.vocab) {
  if (!v.pair) continue;
  if (vocabWords.has(String(v.pair).toLowerCase())) pairLinked++;
  else pairDangling++;
}

/* ── 5. 词汇查重 ─────────────────────────────────────────── */

const G5 = '查重';
const seen = new Map();
for (const v of content.vocab) {
  const k = v.w.toLowerCase();
  if (seen.has(k)) err(G5, `词 "${v.w}" 重复入库（第 ${seen.get(k)} 课 和 第 ${v.les} 课）`);
  else seen.set(k, v.les);
}

/* ── 6. node --check ─────────────────────────────────────── */

const G6 = '语法';
for (const f of fs.readdirSync(P.src).filter((x) => x.endsWith('.js'))) {
  try {
    execFileSync(process.execPath, ['--check', path.join(P.src, f)], { stdio: 'pipe' });
  } catch (e) {
    err(G6, `src/${f} 语法错误：\n${String(e.stderr || e.message).split('\n').slice(0, 6).join('\n')}`);
  }
}

/* ── 7–9. 需要跑起来的检查 ───────────────────────────────── */

let built = null, speak = null;
if (!QUICK) {
  const { buildHtml } = await import('./lib/build.js');
  const { collectSpeakables } = await import('./lib/speakables.js');
  try {
    built = buildHtml({ content, audio });
  } catch (e) {
    err('构建', e.message);
  }

  if (built) {
    // 6b. 产物里的脚本也过一遍 node --check
    const script = built.slice(built.indexOf('<script>') + 8, built.lastIndexOf('</script>'));
    const tmp = path.join(ROOT, '.tmp/built-check.js');
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    fs.writeFileSync(tmp, script);
    try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
    catch (e) { err(G6, `构建产物脚本语法错误：\n${String(e.stderr).split('\n').slice(0, 6).join('\n')}`); }

    try {
      speak = collectSpeakables({ html: built, drillRounds: 5000 });
    } catch (e) {
      err('渲染', `跑不起来：${e.message}`);
    }
  }
}

const G7 = '渲染';
if (speak) {
  for (const m of speak.jsdomErrors) err(G7, `页面报错：${m}`);
  const emptyPages = speak.perPage.filter((p) => p.len < 40);
  if (emptyPages.length) {
    err(G7, `有 ${emptyPages.length} 页渲染为空：第 ${emptyPages.map((p) => p.page + 1).join(', ')} 页`);
  }
  // undefined / [object Object] / NaN 只可能来自插值写错
  for (const p of speak.perPage) {
    if (p.suspicious.length) {
      err(G7, `第 ${p.page + 1} 页（${p.title}）渲染出 ${p.suspicious.join(' / ')}`);
    }
  }
  // 英文界面下漏出中日文 = 有写死的文案没走 T()
  for (const m of (speak.leaks || [])) err(G7, `英文界面渗漏中日文 —— ${m}`);

  const noSay = speak.perPage.filter((p) => p.blocks > 0 && p.says === 0);
  if (noSay.length) {
    warn(G7, `有 ${noSay.length} 页一个可点读的印尼语都没有：第 ${noSay.map((p) => p.page + 1).join(', ')} 页`);
  }
}

const G8 = '实战';
if (speak) {
  const d = speak.drillStats;
  if (d.badOpts) err(G8, `${d.badOpts}/${d.rounds} 题的选项不是 4 个`);
  if (d.dup) err(G8, `${d.dup}/${d.rounds} 题有重复选项`);
  if (d.badIndex) err(G8, `${d.badIndex}/${d.rounds} 题的正确答案索引不对`);
  // 词块拼句专项：拼不出答案的题是死题，学习者怎么点都过不去
  if (d.badBank) err(G8, `${d.badBank}/${d.susun} 道拼句题的词块拼不出正确答案`);
  if (d.noDistractor) warn(G8, `${d.noDistractor}/${d.susun} 道拼句题没有干扰词块（把词块全点上就对了）`);
  // 只检查题库里确实有数据的题型
  const avail = {
    jam: content.drills.angka_pool.length > 0 && content.drills.jam_enabled !== false,
    angka: content.drills.angka_pool.length > 0,
    situasi: content.drills.situasi.length > 0 || content.drills.tempat.length > 0,
    dengar: content.drills.situasi.length > 0,
    posesif: (content.drills.posesif || []).length > 0,
    tunjuk: (content.drills.tunjuk || []).length > 0,
    // 门槛跟引擎的 drAvail 保持一致：不够 4 个凑不出选项
    benda: (content.drills.benda || []).length >= 4,
  };
  for (const t of Object.keys(avail)) {
    if (avail[t] && !d.types[t]) warn(G8, `压力测试里没出到 ${t} 类型的题`);
    if (!avail[t] && d.types[t]) err(G8, `题库里没有 ${t} 的数据，却出了这种题`);
  }
}

const G9 = '语音';
let cov = null;
if (speak) {
  const have = new Set(Object.keys(audio.items || {}));
  const need = speak.texts;
  // 跟引擎的 audioHash 对齐：句首词首字母大写，查不到就回退小写。
  // 同一个词不必合成大小写两份（印尼语大小写不改变读音）。
  const lower = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const miss = need.filter((t) => !have.has(t) && !have.has(lower(t)));
  cov = { need: need.length, have: need.length - miss.length, miss };
  if (miss.length) {
    warn(G9, `${miss.length}/${need.length} 条朗读文本还没有音频（跑 npm run tts 补）`);
    notes.push('  缺音频样例：' + miss.slice(0, 5).map((t) => JSON.stringify(t)).join('  '));
  }
  const unused = [...have].filter((t) => !new Set(need).has(t));
  if (unused.length) notes.push(`  音库里有 ${unused.length} 条现在用不到（旧内容留下的，不影响）`);
}

/* ── 报告 ────────────────────────────────────────────────── */

const line = (s) => console.log(s);
line('');
line('━━━ 校验报告 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
line(`内容        ${content.lessons.length} 课 / ${content.lessons.reduce((n, l) => n + l.pages.length, 0)} 页 / ${content.vocab.length} 词`);
line(`三语        ${triTotal} 个对象，缺 zh ${missing.zh.length} · ja ${missing.ja.length} · en ${missing.en.length}`);
line(`语体        ${regChecked} 处标记；alt 已有 ${altCount} 句，口语句待补 ${altMissing} 句`);
line(`配对        ${REG.pairs.length} 组；词汇表里可跳转 ${pairLinked} 条，对方不在库 ${pairDangling} 条`);
line(`实战        ${speak ? `${speak.drillStats.rounds} 次出题：` + Object.entries(speak.drillStats.types).map(([k, v]) => `${k} ${v}`).join(' · ') : '（--quick 跳过）'}`);
line(`语音        ${cov ? `${cov.have}/${cov.need} 条有音频（${(cov.have / cov.need * 100).toFixed(1)}%）` : '（--quick 跳过）'}`);
line('');

if (notes.length) { notes.forEach(line); line(''); }
if (warns.length) {
  line(`⚠️  警告 ${warns.length} 条`);
  warns.slice(0, 20).forEach((m) => line('   ' + m));
  if (warns.length > 20) line(`   …还有 ${warns.length - 20} 条`);
  line('');
}
if (errors.length) {
  line(`❌ 失败 ${errors.length} 条`);
  errors.slice(0, 40).forEach((m) => line('   ' + m));
  if (errors.length > 40) line(`   …还有 ${errors.length - 40} 条`);
  line('');
  line('先修这些，再继续。');
  process.exit(1);
}
line('✅ 全部通过' + (ALLOW_TODO ? '（迁移期：三语未齐全被降级为警告）' : ''));
