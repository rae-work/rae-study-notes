/**
 * collectSpeakables —— 「哪些印尼语需要有音频」的唯一定义。
 * validate.js 和 tts.js 都调这一个函数，杜绝两边不一致。
 *
 * 做法不是照抄引擎逻辑（会漂移），而是真的把构建产物跑起来：
 *   1. 逐页渲染，收集 DOM 里所有 [data-say]
 *   2. 跑几千次 drMake() 收集实战模式可能读出的每一句
 *   3. 补上复习模式会读的词条与例句
 *   4. 补上课程数据里的 alt（另一语体整句，CLAUDE.md 要求也有音频）
 *
 * 中文 / 日文 / 英文提示一律不收（它们不朗读）。
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { buildHtml } from './build.js';

export function collectSpeakables(opts = {}) {
  const html = opts.html || buildHtml();
  const drillRounds = opts.drillRounds ?? 5000;

  const vc = new VirtualConsole();
  const jsdomErrors = [];
  vc.on('jsdomError', (e) => {
    if (!/HTMLMediaElement/.test(e.message)) jsdomErrors.push(e.message);
  });
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: vc, url: 'file:///build/belajar.html',
  });
  const w = dom.window;
  const doc = w.document;

  const say = new Set();
  const add = (s) => { const t = String(s == null ? '' : s).trim(); if (t) say.add(t); };

  const sheet = doc.getElementById('sheet');
  const perPage = [];
  const saysIn = (html) => {
    const d = doc.createElement('div');
    d.innerHTML = html;
    return [...d.querySelectorAll('[data-say]')].map((el) => el.getAttribute('data-say'));
  };
  const drillStats = { rounds: 0, badOpts: 0, badIndex: 0, dup: 0, types: {} };
  const alts = [];

  /* 例句里「学习者的国籍」跟着界面语言变（{NEGARA} 等占位符，见 engine.js 的 LZ）。
     所以三种语言各跑一遍 —— 只收默认语言的话，日文界面的
     「Saya dari Jepang.」永远不会出现在清单里，发版时就会缺音频。 */
  const LANGS = w.CONTENT.meta.langs && w.CONTENT.meta.langs.length
    ? w.CONTENT.meta.langs
    : [w.CONTENT.meta.default_lang];
  const DEFAULT_LANG = w.CONTENT.meta.default_lang;

  for (const lang of LANGS) {
    w.setLang(lang);
    const isDefault = lang === DEFAULT_LANG;

    /* 1. 逐页渲染，收 data-say */
    for (let i = 0; i < w.PAGES.length; i++) {
      w.go(i);
      const found = saysIn(sheet.innerHTML);
      found.forEach(add);
      if (!isDefault) continue;            /* 页面统计只报默认语言那一轮 */
      const html = sheet.innerHTML;
      perPage.push({
        page: i,
        title: w.PAGES[i].lessonName,
        blocks: w.PAGES[i].blocks ? w.PAGES[i].blocks.length : 0,
        says: found.length,
        len: html.length,
        // 插值写错的典型痕迹
        suspicious: ['undefined', '[object Object]', 'NaN', '{{'].filter((t) => html.includes(t)),
      });
    }

    /* 词汇表是分批渲染的（一次性插几百张卡会卡），
       直接对每个词条调 glossCard() 取它的 data-say。 */
    for (const v of w.VOCAB) saysIn(w.glossCard(v)).forEach(add);

    /* 2. 实战：反复出题，把每个会发音的句子都逼出来 */
    for (let i = 0; i < drillRounds; i++) {
      const q = w.drMake();
      drillStats.rounds++;
      drillStats.types[q.type] = (drillStats.types[q.type] || 0) + 1;
      if (!q.opts || q.opts.length !== 4) drillStats.badOpts++;
      else if (new Set(q.opts).size !== 4) drillStats.dup++;
      if (!q.opts || q.opts[q.ok] !== q.a) drillStats.badIndex++;
      // 会发音的：答案、全部选项、以及听力题的问句
      q.opts && q.opts.forEach(add);
      add(q.a);
      // 只有题面本身是印尼语时才会朗读；中文提示、时钟数字不收
      if (q.showLang === 'id') add(q.show);
    }

    /* 3. 复习：听辨题读词，填空题读例句 */
    for (const v of w.VOCAB) {
      add(w.sayText(v.w));
      if (v.ex) add(w.sayText(w.LZ(v.ex)));
    }

    /* 4. alt：另一语体的整句也要能读（不含占位符，收一遍就够） */
    if (isDefault) {
      (function walk(o) {
        if (o == null || typeof o !== 'object') return;
        if (typeof o.alt === 'string' && o.alt) { alts.push(o.alt); add(w.sayText(o.alt)); }
        for (const v of Array.isArray(o) ? o : Object.values(o)) walk(v);
      })(w.CONTENT.lessons);
    }
  }
  w.setLang(DEFAULT_LANG);

  /* 5. 语言渗漏检查：把界面切成英文，整个跑一遍。
     英文界面下渲染出的任何中日文字符都说明有写死的文案没走 T()。 */
  const leaks = [];
  if (w.CONTENT.meta.langs.indexOf('en') >= 0) {
    w.setLang('en');
    const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef]/;
    const scan = (label, html) => {
      const d = doc.createElement('div');
      d.innerHTML = html;
      // 语言切换器里的「中文 / 日本語 / English」永远用各自的语言写，不算渗漏
      d.querySelectorAll('#langSeg').forEach((x) => x.remove());
      const text = d.textContent || '';
      if (CJK.test(text)) {
        const m = text.match(/.{0,25}[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef]+.{0,25}/);
        leaks.push(`${label}：${(m ? m[0] : '').trim()}`);
      }
    };
    for (let i = 0; i < w.PAGES.length; i++) { w.go(i); scan('第 ' + (i + 1) + ' 页', sheet.innerHTML); }
    scan('顶栏', doc.getElementById('hdr').innerHTML);
    scan('目录', doc.getElementById('toc').innerHTML);
    // 复习 / 实战 的答题界面
    w.go(w.REVIEW_INDEX);
    w.CONTENT.lessons.forEach((l) => { w.QZ.sel[l.num] = true; });
    for (const mode of ['read', 'listen', 'recall', 'mix']) {
      w.QZ.mode = mode; w.QZ.count = 10; w.quizStart(false);
      for (let i = 0; i < 8 && w.QZ.phase === 'q'; i++) {
        scan(`复习(${mode})`, sheet.innerHTML);
        w.quizAnswer((w.QZ.curQ.ok + 1) % 4);   // 故意答错，把反馈区也渲染出来
        scan(`复习(${mode})反馈`, sheet.innerHTML);
        w.qzNext();
      }
      scan(`复习(${mode})结算`, sheet.innerHTML);
    }
    w.go(w.DRILL_INDEX);
    w.DR.count = 10; w.drillStart(false);
    for (let i = 0; i < 12 && w.DR.curQ; i++) {
      scan('实战', sheet.innerHTML);
      w.drillAnswer((w.DR.curQ.ok + 1) % 4);
      scan('实战反馈', sheet.innerHTML);
      w.drillNext();
    }
    scan('实战结算', sheet.innerHTML);
    w.setLang(w.CONTENT.meta.default_lang);
  }

  dom.window.close();
  return { texts: [...say].sort(), perPage, drillStats, jsdomErrors, leaks, altCount: alts.length };
}
