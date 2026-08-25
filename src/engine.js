/* ============================================================
   Rae's Study Notes · 引擎
   内容全部来自 content/ 下的 JSON，由 scripts/build.js 内联成
   下面的 CONTENT / AUDIO 两个对象。本文件不含任何课程内容。

   兼容基线：iOS 15 Safari / Android Chrome 100+（ES2020 可用）。
============================================================ */

/* ===== 语言 =====
   LANG 的确定顺序：localStorage 里存的选择 → 浏览器语言 → meta 的默认值。
   L(x)  把 {zh, ja, en} 解析成当前语言的字符串（缺则 zh → en → ja 兜底）。
   T(k)  取界面文案，键见 content/i18n/ui.*.json，支持 {0} {1} 占位。
   印尼语字段是纯字符串，L() 原样返回。 */
var LANGS = CONTENT.meta.langs;

function detectLang(){
  /* ① 用户上次的选择 */
  try{
    var saved = localStorage.getItem("lang");
    if(saved && LANGS.indexOf(saved) >= 0) return saved;
  }catch(e){}
  /* ② 浏览器语言。zh-CN / zh-Hans / ja-JP / en-GB 都要认得出 */
  if(CONTENT.meta.detect_browser_lang){
    var cands = [];
    if(navigator.languages && navigator.languages.length) cands = cands.concat(navigator.languages);
    if(navigator.language) cands.push(navigator.language);
    for(var i = 0; i < cands.length; i++){
      var tag = String(cands[i]).toLowerCase();
      var base = tag.split("-")[0];
      if(LANGS.indexOf(base) >= 0) return base;
    }
  }
  /* ③ 兜底 */
  return CONTENT.meta.default_lang || LANGS[0];
}

var LANG = detectLang();

/* ===== 深浅色主题 =====
   三档：auto（跟系统走）/ light / dark。auto 时不写 data-theme，
   由 app.css 的 @media (prefers-color-scheme:dark) 接管；
   选了 light / dark 就在 <html> 上写死 data-theme，媒体查询让位。
   读写 localStorage 失败一律静默，不影响功能。 */
var THEMES = ["auto", "light", "dark"];
var THEME = "auto";
try{
  var savedTheme = localStorage.getItem("theme");
  if(savedTheme && THEMES.indexOf(savedTheme) >= 0) THEME = savedTheme;
}catch(e){}

/* 强调色：五套低饱和配色，浅深两套值都在 app.css 里，
   这里只负责在 <html> 上写 data-accent。rose 是默认，不写属性。 */
var ACCENTS = ["rose", "blue", "ochre", "sage", "mauve"];
var ACCENT = "rose";
try{
  var savedAccent = localStorage.getItem("accent");
  if(savedAccent && ACCENTS.indexOf(savedAccent) >= 0) ACCENT = savedAccent;
}catch(e){}

function applyTheme(){
  var root = document.documentElement;
  if(THEME === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", THEME);
  if(ACCENT === "rose") root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", ACCENT);
}
function setAccent(a){
  if(ACCENTS.indexOf(a) < 0) return;
  ACCENT = a;
  try{ localStorage.setItem("accent", a); }catch(e){}
  applyTheme();
  toArr(document.querySelectorAll("#accentSeg .sw")).forEach(function(b){
    b.classList.toggle("on", b.getAttribute("data-ac") === ACCENT);
  });
}
function setTheme(t){
  if(THEMES.indexOf(t) < 0) return;
  THEME = t;
  try{ localStorage.setItem("theme", t); }catch(e){}
  applyTheme();
  toArr(document.querySelectorAll("#themeSeg button")).forEach(function(b){
    b.classList.toggle("on", b.getAttribute("data-th") === THEME);
  });
}
applyTheme();

/* ============================================================
   学习者国籍的本地化
   ------------------------------------------------------------
   例句里「我从中国来」对日本同学没有代入感。内容里写占位符，
   渲染时按当前界面语言替换：
     {NEGARA} → 印尼语国名（Cina / Jepang / Inggris）—— 会进朗读文本，
               所以每种语言的句子都必须有音频
     {NAMA}   → 该语言里的国名（中国 / 日本 / England）
     {PEOPLE} → 该语言里的「某国人」（中国人 / 日本人 / English）
   映射表在 content/meta.json 的 learner。
   ============================================================ */
function LZ(s){
  if(s == null) return s;
  s = String(s);
  if(s.indexOf("{") < 0) return s;          /* 绝大多数字符串没有占位符，快速跳过 */
  var m = CONTENT.meta.learner || {}, k = m[LANG] || m[CONTENT.meta.default_lang] || {};
  return s.replace(/\{NEGARA\}/g, k.negara || "")
          .replace(/\{NAMA\}/g,   k.nama   || "")
          .replace(/\{PEOPLE\}/g, k.people || "");
}

function L(x){
  if(x == null) return "";
  if(typeof x === "string") return LZ(x);
  var v = x[LANG];
  if(v != null && v !== "") return LZ(v);
  if(x.zh != null && x.zh !== "") return LZ(x.zh);
  if(x.en != null && x.en !== "") return LZ(x.en);
  if(x.ja != null && x.ja !== "") return LZ(x.ja);
  return "";
}
/* 词条 / 释义的「副释义」：非英文界面下补一条英文，英文界面下不重复。 */
function L2(x){
  if(x == null || typeof x === "string") return "";
  if(LANG === "en") return "";
  return x.en || "";
}

/* 界面文案。T("gloss.sub", 42) → "学过的词 · 共 42 个" */
function T(key){
  var args = Array.prototype.slice.call(arguments, 1);
  var node = CONTENT.ui[LANG];
  var parts = key.split(".");
  for(var i = 0; i < parts.length && node != null; i++) node = node[parts[i]];
  if(node == null){
    /* 缺键时退回默认语言，再退回键名本身 —— 界面不能因为漏一条就空白 */
    node = CONTENT.ui[CONTENT.meta.default_lang];
    for(var j = 0; j < parts.length && node != null; j++) node = node[parts[j]];
  }
  if(node == null) return key;
  if(typeof node !== "string") return node;
  return node.replace(/\{(\d)\}/g, function(m, n){
    return args[+n] != null ? String(args[+n]) : m;
  });
}

/* 切语言：存偏好 → 重刷静态文案 → 整页重渲染 */
function setLang(lang){
  if(LANGS.indexOf(lang) < 0 || lang === LANG) return;
  LANG = lang;
  try{ localStorage.setItem("lang", lang); }catch(e){}
  document.documentElement.setAttribute("lang", lang);
  applyStaticText();
  buildTOC();
  render();
}

/* 模板里带 data-t / data-t-title / data-t-aria 的节点，按当前语言填一遍 */
function applyStaticText(){
  toArr(document.querySelectorAll("[data-t]")).forEach(function(el){
    el.textContent = T(el.getAttribute("data-t"));
  });
  toArr(document.querySelectorAll("[data-t-title]")).forEach(function(el){
    el.setAttribute("title", T(el.getAttribute("data-t-title")));
  });
  toArr(document.querySelectorAll("[data-t-aria]")).forEach(function(el){
    el.setAttribute("aria-label", T(el.getAttribute("data-t-aria")));
  });
  document.getElementById("bannerTxt").innerHTML = T("banner.no_voice");
  document.getElementById("maskTxt").textContent = masked ? T("nav.mask_hidden") : T("nav.mask_shown");
  document.getElementById("brandZh").textContent = L(CONTENT.meta.app.tagline);
  toArr(document.querySelectorAll("#langSeg button")).forEach(function(b){
    b.classList.toggle("on", b.getAttribute("data-lang") === LANG);
  });
  toArr(document.querySelectorAll("#themeSeg button")).forEach(function(b){
    b.classList.toggle("on", b.getAttribute("data-th") === THEME);
  });
  toArr(document.querySelectorAll("#accentSeg .sw")).forEach(function(b){
    b.classList.toggle("on", b.getAttribute("data-ac") === ACCENT);
  });
  if(typeof pickVoices === "function") pickVoices();
  if(typeof syncHeaderH === "function") syncHeaderH();
}

/* 单元标签：教材是 Bab，旧课本是 Pelajaran。放在 meta 里。 */
var UNIT = CONTENT.meta.app.unit_label || "Bab";

/* ===== 数据 =====
   引擎内部仍用 D / VOCAB / SITUASI / TEMPAT / ANGKA_POOL 这几个名字，
   与 legacy 一致，方便逐块对照回归。 */
var D = CONTENT.lessons;
var VOCAB = CONTENT.vocab;
var SITUASI = CONTENT.drills.situasi;
var TEMPAT = CONTENT.drills.tempat;
var ANGKA_POOL = CONTENT.drills.angka_pool;

/* ===== VOCAB: 所有学过的词 · 排序/筛选/搜索由引擎自动处理 =====
   条目格式 {w,zh,en,les,ex,exzh} —— 追加即可,顺序无所谓 */



/* ============================================================
   实战问答题库(Latihan Situasi)—— 针对「听懂但说不出」的短板
   设计依据:产生效应(自己产出>认出)、可变练习(数字/时间随机
   生成,逼你套规则而非背题)、情景锚定(词放进真实问句里练)。
   加课时:往对应数组里追加即可,引擎自动纳入,无需改代码。
   ★ 所有 a/ 选项文本都会进语音包,新增后记得重新生成音频。
============================================================ */

/* 时间:程序化生成,答案由规则拼出,题目无限不重复 */
var JAM_WORDS = ["","satu","dua","tiga","empat","lima","enam",
                 "tujuh","delapan","sembilan","sepuluh","sebelas","dua belas"];
function jamRead(h, half){
  /* half=true 表示 X:30 —— 印尼语说「到下一点的一半」 */
  if(half){
    var nxt = (h % 12) + 1;
    return "setengah " + JAM_WORDS[nxt];
  }
  return "jam " + JAM_WORDS[h];
}
function jamDigits(h, half){
  return h + ":" + (half ? "30" : "00");
}

/* 数字:分档随机,覆盖日常价格与数量 */
function numRead(n){
  function under100(x){
    if(x === 0) return "kosong";
    if(x < 12) return ["kosong","satu","dua","tiga","empat","lima","enam","tujuh","delapan","sembilan","sepuluh","sebelas"][x];
    if(x < 20) return under100(x % 10) + " belas";
    var t = Math.floor(x / 10), r = x % 10;
    return under100(t) + " puluh" + (r ? " " + under100(r) : "");
  }
  function under1000(x){
    if(x < 100) return under100(x);
    var h = Math.floor(x / 100), r = x % 100;
    return (h === 1 ? "seratus" : under100(h) + " ratus") + (r ? " " + under100(r) : "");
  }
  if(n < 1000) return under1000(n);
  if(n < 1000000){
    var k = Math.floor(n / 1000), r = n % 1000;
    return (k === 1 ? "seribu" : under1000(k) + " ribu") + (r ? " " + under1000(r) : "");
  }
  var j = Math.floor(n / 1000000), r2 = n % 1000000;
  return (j === 1 ? "sejuta" : under1000(j) + " juta") + (r2 ? " " + under1000(Math.floor(r2/1000)) + " ribu" : "");
}
function fmtRp(n){
  var s = String(n), out = "", c = 0;
  for(var i = s.length - 1; i >= 0; i--){
    out = s.charAt(i) + out;
    if(++c % 3 === 0 && i > 0) out = "." + out;
  }
  return out;
}

/* 情景问答:印尼语问句 + 中文提示 → 选出正确回答
   q=问句 hint=中文提示(要答什么) a=正确答案 alts=干扰项 */


/* 地点问答:X 在哪 → 选正确介词搭配 */


/* ============================================================
   ENGINE —— 加课时【无需】改动以下任何代码
   兼容基线 iOS 12.5 / Safari 12:仅用 ES2017 及更早语法
============================================================ */
var toArr = function(x){ return Array.prototype.slice.call(x); };
var esc = function(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); };
var clean = function(s){ return s.replace(/[?!.,:;"'’“”()／/]+/g," ").replace(/\s+/g," ").trim(); };
/* 整句/词条朗读:保留 ? ! . , —— 问号决定升调,剥掉会被读成陈述句。
   只去掉引号、括号、斜杠这些不该念出来的符号。
   注意:句内单词的逐词点读仍用 clean(),单个词不该带问号。 */
var sayText = function(s){
  return s.replace(/[\u201c\u201d\u2018\u2019"']/g, "")
          .replace(/[()（）／/]+/g, " ")
          .replace(/\s+/g, " ").trim();
};

/* 点读图标。用内联 SVG，不用 emoji / ▶ 之类的字形 ——
   字形在不同系统里大小和基线都不一样，SVG 才能跟着 currentColor 变深浅色。 */
/* 只画三角形。按钮外面那圈边框已经是圆的了，SVG 里再套一个圆
   就成了「圆圈套圆圈」，重复。 */
var PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M8.5 6.2 17.8 12 8.5 17.8Z" fill="currentColor"/></svg>';

function sayLine(text, kw){
  var k = [], i;
  if(kw) for(i=0;i<kw.length;i++) k.push(String(kw[i]).toLowerCase());
  var toks = text.split(/(\s+)/), html = "";
  for(i=0;i<toks.length;i++){
    var t = toks[i];
    if(/^\s+$/.test(t)){ html += t; continue; }
    var c = clean(t).toLowerCase();
    html += '<span class="say' + (k.indexOf(c)>=0 ? " kw" : "") + '" data-say="' + esc(clean(t)) + '">' + esc(t) + "</span>";
  }
  return html;
}
/* 「Tempat/Tanggal Lahir」这种词在窄卡片里放不下，浏览器默认不会在
   斜杠和连字符处换行，只能把词从中间劈开（Tangg / al），很难看。
   插一个 <wbr> 给它一个体面的断点。只动显示文本，data-say 保持原样 —— 
   音频是靠 data-say 查表的，改了就查不到。 */
function breakable(esced){
  return esced.replace(/([\/\u2044\uFF0F\u2013\u2014])/g, "$1<wbr>");
}
function sayWhole(display, say, extra){
  return '<span class="say ' + (extra||"") + '" data-say="' + esc(say!=null?say:clean(display)) + '">' +
    breakable(esc(display)) + "</span>";
}
/* 说明性文字（导语、小段说明、注释、表注）由内容作者写，允许少量 HTML：
   <b> <i> 用来强调，<s>词</s> 把印尼语标成可点读。其余按原样输出。 */
function richText(x){
  return String(L(x)).replace(/<s>(.*?)<\/s>/g, function(m, w){
    return sayWhole(w, sayText(w), "kw");
  });
}

function noteLines(lines){
  return lines.map(function(l){
    if(l.qa){
      return '<div class="qa"><span class="who">' + esc(l.who||"") + '</span><span class="line"><span class="idtext">' +
        sayLine(l.id, l.kw) + '</span><span class="gloss">' + esc(L(l.gloss)) + "</span></span></div>";
    }
    if(l.text != null){
      return "<p>" + richText(l.text) + "</p>";
    }
    return "";
  }).join("");
}
function qaSide(side, maskable){
  if(!side) return "";
  if(side.lang === "id"){
    var inner = sayLine(side.text, side.kw);
    var body = maskable ? '<span class="ans">' + inner + "</span>" : inner;
    return '<div class="qa-line id"><button class="play" data-say="' + esc(sayText(side.text)) +
      '" title="' + esc(T("block.play_sentence")) + '">' + PLAY_SVG + '</button><span class="idtext">' + body + "</span></div>";
  }
  var ptxt = L(side.text);
  var b2 = maskable ? '<span class="ans plain">' + esc(ptxt) + "</span>" : '<span class="plain">' + esc(ptxt) + "</span>";
  return '<div class="qa-line"><span class="play-spacer"></span>' + b2 + "</div>";
}

/* sec 的释义：主语言在前，中文界面下补一条英文。含 <b> 标记，故不转义。 */
function secGloss(b){
  var a = L(b.gloss), c = L2(b.gloss);
  return a && c ? (a + " · " + c) : (a || c);
}


/* 表格单元格：印尼语可点读并带语体徽章；纯文字标签直接显示。 */
function tableCell(cell){
  if(cell == null) return "";
  if(typeof cell === "string") return esc(cell);
  if(cell.id != null){
    var badge = "";
    if(cell.reg === "formal") badge = '<span class="rbadge f">' + esc(T("block.table_formal")) + "</span>";
    else if(cell.reg === "casual") badge = '<span class="rbadge c">' + esc(T("block.table_informal")) + "</span>";
    return sayWhole(cell.id, sayText(cell.id)) + badge;
  }
  /* 走 richText：单元格里也能用 <s>词</s> 标出可点读的印尼语。
     地方人名那种表格里，印尼语和三语说明混在一格，只能靠标记区分。 */
  return richText(cell.text);
}

/* 秒 → 1:13 */
function fmtDur(sec){
  var m = Math.floor(sec / 60), s2 = Math.round(sec % 60);
  return m + ":" + (s2 < 10 ? "0" : "") + s2;
}

var CURMETA = null; /* render() 设置当前页元信息,phead 用它自动生成 eyebrow */

function renderBlock(b){
  var out, i;
  switch(b.k){
    case "phead":
      var eyebrow = (CURMETA && CURMETA.num) ? (UNIT + " " + CURMETA.num) : "Kosakata";
      /* 页码跟标题同一行（页眉已经没有品牌行了，这样省一行屏幕）。
         分母只数课文页，不含末尾追加的复习／实战／词汇表三张特殊页。 */
      var pc = "";
      if(CURMETA && CURMETA.num && typeof REVIEW_INDEX === "number" && REVIEW_INDEX > 0)
        pc = '<span class="pcount">' + (cur + 1) + " / " + REVIEW_INDEX + "</span>";
      return '<div class="phead"><div class="eyebrow">' + esc(eyebrow) + '</div>' +
        '<div class="ptitle-row"><h1 class="ptitle">' + esc(b.title) + "</h1>" + pc + "</div>" +
        (L(b.sub) ? '<div class="ptitle-sub">' + esc(L(b.sub)) + "</div>" : "") + "</div>";
    case "lead": return '<p class="lead">' + richText(b.text) + "</p>";
    case "psub2": return '<p class="psub" style="margin:.2em 0 10px">' + richText(b.text) + "</p>";
    case "rule": return '<hr class="rule' + (b.short?" short":"") + '">';
    case "mini": return '<div class="mini"><span>' + esc(L(b.text)) + "</span></div>";
    case "sec":
      return '<div class="sec"><span class="num">' + esc(b.num) + '</span><span class="word">' +
        sayWhole(b.word, sayText(b.word)) + '</span><span class="en">' + secGloss(b) + "</span></div>";
    case "pattern":
      return '<div class="pattern"><span class="plab">Pola</span><code>' + b.code + "</code>" +
        (L(b.note) ? '<span class="pnote">' + esc(L(b.note)) + "</span>" : "") + "</div>";
    case "alpha":
      return '<div class="alpha">' + b.items.map(function(it){
        return '<div class="at card-tap" data-say="' + esc(it[1]) + '"><div class="L">' + esc(it[0]) +
          '</div><div class="p">' + esc(it[1]) + "</div></div>";
      }).join("") + "</div>";
    case "pics":
      return '<div class="pics">' + b.items.map(function(it){
        return '<div class="pic card-tap" data-say="' + esc(clean(it.w)) + '"><div class="em">' + it.emoji +
          '</div><div class="w">' + esc(it.w) + '</div><div class="zh">' + esc(L(it.gloss)) + "</div></div>";
      }).join("") + "</div>";
    case "vocab":
      return '<div class="vocab">' + b.items.map(function(v){
        var ven = L2(v.gloss), vzh = L(v.gloss);
        return '<div class="vk card-tap" data-say="' + esc(sayText(v.w)) + '">' +
          (ven ? '<span class="en">' + esc(ven) + "</span>" : "") +
          '<span class="w">' + sayWhole(v.w, sayText(v.w)) + "</span>" +
          (vzh ? '<span class="zh">' + esc(vzh) + "</span>" : "") + "</div>";
      }).join("") + "</div>";
    case "dialog":
      return b.rows.map(function(r){
        return '<div class="row"><button class="play" data-say="' + esc(sayText(r.id)) +
          '" title="' + esc(T("block.play_sentence")) + '">' + PLAY_SVG + '</button><span class="who">' + esc(r.who) + '</span><span class="line"><span class="idtext">' +
          sayLine(r.id, r.kw) + '</span><span class="gloss">' + esc(L(r.gloss)) + "</span></span></div>";
      }).join("");
    case "examples":
      return (L(b.title) ? '<p class="psub" style="margin:.3em 0 6px;font-weight:700;color:var(--ink)">' + esc(L(b.title)) + "</p>" : "") +
        b.items.map(function(r){
          return '<div class="row"><button class="play" data-say="' + esc(sayText(r.id)) +
            '" title="' + esc(T("block.play_sentence")) + '">' + PLAY_SVG + '</button><span class="line"><span class="idtext">' + sayLine(r.id, r.kw) +
            '</span><span class="gloss">' + esc(L(r.gloss)) + "</span></span></div>";
        }).join("");
    case "numgrp":
      return '<div class="numgrp"><div class="glab">' + esc(L(b.glab)) + '</div><div class="nums">' +
        b.items.map(function(it){
          var v = it[1];
          var val = b.ans ? '<span class="ans">' + sayWhole(v, clean(v)) + "</span>" : sayWhole(v, clean(v));
          return '<div class="nb' + (b.ans ? "" : " card-tap") + '"' + (b.ans ? "" : ' data-say="' + esc(clean(v)) + '"') +
            '><span class="n">' + esc(it[0]) + '</span><span class="v">' + val + "</span></div>";
        }).join("") + "</div></div>";
    case "phones":
      return b.items.map(function(p){
        return '<div class="phone card-tap" data-say="' + esc(p.say) + '"><span class="d">' + esc(p.d) +
          '</span><span class="s">▶ ' + esc(p.say) + "</span></div>";
      }).join("");
    case "ladder":
      return '<div class="ladder">' + b.items.map(function(s){
        return '<div class="step"><span class="lvl">' + esc(L(s.lvl)) + '</span><span class="line"><span class="idtext">' +
          sayLine(s.id) + '</span><span class="gloss">' + esc(L(s.gloss)) + "</span></span></div>";
      }).join("") + "</div>";
    case "currency":
      return '<div class="currency"><span class="rp say" data-say="' + esc(sayText(b.id)) + '">' + esc(b.rp) +
        '</span><span class="line"><span class="idtext">' + sayLine(b.id, ["rupiah"]) +
        '</span><span class="gloss">' + esc(L(b.gloss)) + "</span></span></div>";
    case "note":
      return '<div class="note ' + (b.green?"green":"") + '"><span class="tag">' + esc(L(b.tag)) + "</span>" + noteLines(b.lines) + "</div>";
    case "prompt":
      return '<div class="prompt"><div class="tag">' + esc(L(b.tag)) + '</div><p style="margin:.4em 0 0">' + richText(b.text) + "</p></div>";
    case "qa_list":
      return '<div class="exer">' + (L(b.title) ? '<div class="ehead">' + esc(L(b.title)) + "</div>" : "") + "<ol>" +
        b.items.map(function(it){ return "<li>" + qaSide(it.prompt,false) + qaSide(it.answer,true) + "</li>"; }).join("") + "</ol></div>";
    case "fillblank":
      return '<div class="exer">' + (L(b.title) ? '<div class="ehead">' + esc(L(b.title)) + "</div>" : "") +
        b.items.map(function(it){
          var chip = '<span class="ans fb-chip say" data-say="' + esc(it.ans) + '">' + esc(it.ans) + "</span>";
          var say = esc(sayText(it.pre + " " + it.ans + " " + it.post));
          return '<div class="row"><button class="play" data-say="' + say + '" title="' + esc(T("block.play_sentence")) + '">' + PLAY_SVG + '</button><span class="line"><span class="idtext">' +
            sayLine(it.pre) + " " + chip + " " + sayLine(it.post) + "</span>" +
            (L(it.gloss) ? '<span class="gloss">' + esc(L(it.gloss)) + "</span>" : "") + "</span></div>";
        }).join("") + "</div>";
    case "listen": {
      /* 教材官方听力音轨。文件在 audio/ 下，网页版和 APK 用同一个相对路径。 */
      var lid = "lis_" + b.file;
      return '<div class="listen" id="' + esc(lid) + '" data-file="' + esc(b.file) + '">' +
        '<div class="lis-top"><button class="lis-play" data-listen="' + esc(b.file) + '">' +
        esc(T("block.listen_play")) + "</button>" +
        '<span class="lis-meta">' + esc(L(b.title)) + (b.dur ? " · " + fmtDur(b.dur) : "") + "</span></div>" +
        '<div class="lis-bar"><i></i></div>' +
        (L(b.note) ? '<p class="lis-note">' + esc(L(b.note)) + "</p>" : "") +
        '<div class="lis-src">' + esc(T("block.listen_source")) + "</div></div>";
    }
    case "table": {
      var head = '<tr>' + b.cols.map(function(c){ return "<th>" + esc(L(c)) + "</th>"; }).join("") + "</tr>";
      var body = b.rows.map(function(row){
        return "<tr>" + row.map(function(cell){ return "<td>" + tableCell(cell) + "</td>"; }).join("") + "</tr>";
      }).join("");
      return '<div class="tblwrap"><table class="tbl"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>" +
        (L(b.note) ? '<p class="tbl-note">' + richText(b.note) + "</p>" : "") + "</div>";
    }
    case "reviewbtn":
      return '<button class="qz-start" data-qz="open">' + esc(T("block.enter_review")) + "</button>";
    case "syll":
      return '<div class="syl">' + b.items.map(function(it){
        var sy = it.s.split("-");
        var sp = sy.map(function(x){ return '<span class="syb say" data-say="' + esc(x) + '">' + esc(x) + "</span>"; })
                    .join('<span class="sdot">·</span>');
        var gl = [L(it.gloss), L2(it.gloss)].filter(Boolean).join(" · ");
        var W = esc(clean(it.w));
        return '<div class="syl-card card-tap" data-say="' + W + '">' +
          '<div class="sylw">' + sp + "</div>" + (gl ? '<div class="sylg">' + esc(gl) + "</div>" : "") +
          '<div class="prbar">' +
            '<button class="pr-btn" data-act="slow" data-w="' + W + '">' + esc(T("block.syll_slow")) + "</button>" +
            (sy.length>1 ? '<button class="pr-btn" data-act="chain" data-w="' + W + '" data-s="' + esc(it.s) + '">' + esc(T("block.syll_chain")) + "</button>" : "") +
            '<button class="pr-btn" data-act="echo" data-w="' + W + '">' + esc(T("block.syll_echo")) + "</button>" +
            (CANREC ? '<button class="pr-btn" data-act="rec" data-w="' + W + '">' + esc(T("block.syll_rec")) + '</button><button class="pr-btn" data-act="cmp" data-w="' + W + '" style="display:none">' + esc(T("block.syll_cmp")) + "</button>" : "") +
          "</div></div>";
      }).join("") + "</div>";
    default: return "";
  }
}

/* ===== 页面拼装:课程(按 num 排序)+ 词汇表(顶级单元,固定最后) ===== */
D.sort(function(a,b){ return a.num - b.num; });
var PAGES = [];
D.forEach(function(les){
  les.pages.forEach(function(blocks, i){
    PAGES.push({num:les.num, lessonName:les.name, idxInLesson:i+1, total:les.pages.length, blocks:blocks});
  });
});
PAGES.push({review:true, idxInLesson:1, total:1});
var REVIEW_INDEX = PAGES.length - 1;
PAGES.push({drill:true, idxInLesson:1, total:1});
var DRILL_INDEX = PAGES.length - 1;
PAGES.push({glossary:true, idxInLesson:1, total:1});
var GLOSS_INDEX = PAGES.length - 1;

/* 目录和页眉上的名字要跟着语言走，所以每次现算，不写死进 PAGES */
function pageLesson(p){
  if(p.review) return T("page.review_name");
  if(p.drill) return T("page.drill_name");
  if(p.glossary) return T("page.gloss_name");
  return UNIT + " " + p.num + " · " + L(p.lessonName);
}
function pageTitle(p){
  if(p.review) return T("page.review_title");
  if(p.drill) return T("page.drill_title");
  if(p.glossary) return T("page.gloss_title");
  return null;
}

/* 副标题在 applyStaticText() 里按当前语言填 */

/* ===== 词汇表:分批渲染(A7 上一次性插入几百张卡会卡死)+ 防抖搜索 ===== */
var GLOSS_SORTED = VOCAB.slice().sort(function(a,b){ return a.les - b.les; });
var gFilter = "all", gQuery = "", gTimer = null, gFillTimer = null;

function glossCard(v){
  var zh = L(v.gloss), en = L2(v.gloss);
  /* 搜索索引：印尼语 + 三种释义全部进去，切语言也搜得到 */
  var q = esc((v.w + " " + zh + " " + (v.gloss.zh||"") + " " + (v.gloss.ja||"") + " " + (v.gloss.en||"")).toLowerCase());
  return '<div class="gentry card-tap" data-say="' + esc(sayText(v.w)) + '" data-les="' + v.les + '" data-q="' + q + '">' +
    '<div class="gtop"><span class="gword">' + sayWhole(v.w, sayText(v.w), "cardword") + '</span>' +
    '<span class="gbadge">L' + v.les + "</span></div>" +
    '<div class="ggloss"><span class="ans">' + esc(zh) + (en ? ' · <span class="en">' + esc(en) + "</span>" : "") + "</span></div>" +
    (v.ex ? '<div class="gex"><button class="play" data-say="' + esc(sayText(LZ(v.ex))) + '" title="' + esc(T("block.play_example")) + '">' + PLAY_SVG + '</button>' +
      '<span class="line"><span class="idtext">' + sayLine(LZ(v.ex)) + '</span><span class="gloss"><span class="ans">' +
      esc(L(v.ex_gloss)) + "</span></span></span></div>" : "") + "</div>";
}
function renderGlossary(){
  var lessons = [], counts = {}, i;
  for(i=0;i<VOCAB.length;i++){
    var l = VOCAB[i].les;
    if(counts[l] === undefined){ counts[l] = 0; lessons.push(l); }
    counts[l]++;
  }
  lessons.sort(function(a,b){ return a-b; });
  var chips = '<button class="chip on" data-gf="all">' + esc(T("gloss.all", VOCAB.length)) + "</button>" +
    lessons.map(function(l){ return '<button class="chip" data-gf="' + l + '">' + esc(T("gloss.chip", UNIT, l, counts[l])) + "</button>"; }).join("");
  return '<div class="phead"><div class="eyebrow">Kosakata</div>' +
    '<div class="ptitle-row"><h1 class="ptitle">' + esc(T("gloss.h1")) + "</h1></div>" +
    '<div class="ptitle-sub">' + esc(T("gloss.sub", VOCAB.length)) + "</div></div>" +
    '<p class="lead">' + esc(T("gloss.lead")) + "</p>" +
    '<input class="gsearch" id="gsearch" type="text" placeholder="' + esc(T("gloss.search_ph")) + '" autocomplete="off" autocorrect="off" autocapitalize="off">' +
    '<div class="gfilter">' + chips + '</div><div class="glist" id="glist"></div>' +
    '<div class="gmore" id="gmore">' + esc(T("gloss.loading")) + "</div>" +
    '<div class="gempty" id="gempty">' + esc(T("gloss.empty")) + "</div>";
}
function applyGlossFilter(){
  var list = document.getElementById("glist");
  if(!list) return;
  var items = list.children, shown = 0;
  for(var i=0;i<items.length;i++){
    var e = items[i];
    var ok = (gFilter === "all" || e.getAttribute("data-les") === gFilter) &&
             (!gQuery || e.getAttribute("data-q").indexOf(gQuery) >= 0);
    e.style.display = ok ? "" : "none";
    if(ok) shown++;
  }
  var empty = document.getElementById("gempty");
  if(empty) empty.style.display = (shown || gFillTimer) ? "none" : "block";
}
function fillGlossary(){
  var list = document.getElementById("glist");
  if(!list) return;
  var i = 0, BATCH = 40;
  var more = document.getElementById("gmore");
  if(more) more.style.display = "block";
  function step(){
    gFillTimer = null;
    if(!document.body.contains(list)) return;      /* 已翻页,停止 */
    var end = Math.min(i + BATCH, GLOSS_SORTED.length), html = "";
    for(var j=i;j<end;j++) html += glossCard(GLOSS_SORTED[j]);
    var holder = document.createElement("div");
    holder.innerHTML = html;
    var frag = document.createDocumentFragment();
    while(holder.firstChild) frag.appendChild(holder.firstChild);
    list.appendChild(frag);
    i = end;
    applyMask();
    applyGlossFilter();
    if(i < GLOSS_SORTED.length){ gFillTimer = setTimeout(step, 0); }
    else { var m = document.getElementById("gmore"); if(m) m.style.display = "none"; applyGlossFilter(); }
  }
  gFillTimer = setTimeout(step, 0);
}
function wireGlossary(){
  var chips = toArr(sheet.querySelectorAll(".chip[data-gf]"));
  chips.forEach(function(c){
    c.addEventListener("click", function(){
      chips.forEach(function(x){ x.classList.toggle("on", x === c); });
      gFilter = c.getAttribute("data-gf");
      applyGlossFilter();
    });
  });
  var input = document.getElementById("gsearch");
  if(input) input.addEventListener("input", function(e){
    var val = e.target.value;
    if(gTimer) clearTimeout(gTimer);
    gTimer = setTimeout(function(){ gQuery = val.trim().toLowerCase(); applyGlossFilter(); }, 170);
  });
}

/* ============================================================
   自助复习系统 (Latihan) —— 引擎功能,加课自动纳入
   循证依据:检索练习(testing effect)· 交错(interleaving)·
   会话内重练(successive relearning)· 即时纠错反馈。
   无持久化(项目禁 localStorage):跨天间隔靠默认「最近两课」
   + 使用习惯;会话内错词按 Leitner 思路延后重出直到答对。
   防挫败:前 30% 只出认词题、连错自动降档、答错不惩罚。
============================================================ */
var QZ = {phase:"setup", sel:{}, count:20, mode:"mix", plan:0,
  queue:[], idx:0, curQ:null, right:0, answered:0,
  wrongUniq:[], rep:{}, last5:[], revealed:false, pick:-1};
var qzTimer = null;
function pickOne(a){ return (a && a.length) ? a[Math.floor(Math.random()*a.length)] : ""; }
(function(){
  var ls = D.map(function(l){ return l.num; }).sort(function(a,b){ return a-b; });
  for(var i=Math.max(0, ls.length-2); i<ls.length; i++) QZ.sel[ls[i]] = true;
})();

function shuffleArr(a){
  for(var i=a.length-1;i>0;i--){
    var j = Math.floor(Math.random()*(i+1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function quizPool(){ return VOCAB.filter(function(v){ return QZ.sel[v.les]; }); }
function pickDistractors(v, pool){
  var out = [], seenW = {}, seenZh = {};
  seenW[v.w] = 1; seenZh[L(v.gloss)] = 1;
  var src = shuffleArr(pool.slice()).concat(shuffleArr(VOCAB.slice()));
  for(var i=0; i<src.length && out.length<3; i++){
    var x = src[i];
    if(!seenW[x.w] && !seenZh[L(x.gloss)]){ out.push(x); seenW[x.w] = 1; seenZh[L(x.gloss)] = 1; }
  }
  return out;
}
function exBlank(v){
  if(!v.ex) return null;
  var ex = LZ(v.ex);                       /* 先把 {NEGARA} 之类解析掉再挖空 */
  var i = ex.toLowerCase().indexOf(v.w.toLowerCase());
  if(i < 0) return null;
  /* 用 ASCII 下划线，不用全角＿ —— 全角属于 CJK 区，三语界面下不该出现 */
  return ex.slice(0, i) + "______" + ex.slice(i + v.w.length);
}
function chooseType(){
  if(QZ.mode === "read") return "r";
  if(QZ.mode === "listen") return "l";
  if(QZ.mode === "recall") return "c";
  var sum = 0, i;
  for(i=0;i<QZ.last5.length;i++) sum += QZ.last5[i];
  if(QZ.last5.length >= 4 && sum <= QZ.last5.length - 3) return "r";  /* 连错降档 */
  if(QZ.answered < Math.ceil(QZ.plan * 0.3)) return "r";              /* 热身期 */
  var r = Math.random();
  return r < 0.3 ? "r" : r < 0.6 ? "l" : r < 0.85 ? "c" : "z";
}
function makeQ(v){
  var type = chooseType();
  if(type === "z" && !exBlank(v)) type = "r";
  var ds = pickDistractors(v, quizPool());
  var all = [v].concat(ds);
  var texts = all.map(function(x){ return (type === "r") ? L(x.gloss) : x.w; });
  var order = shuffleArr([0,1,2,3]);
  var opts = order.map(function(i){ return texts[i]; });
  return {v:v, type:type, opts:opts, ok:order.indexOf(0)};
}
var ttsWarmed = false;
function ttsWarm(){
  if(ttsWarmed || !SS) return;
  if(NATIVE_TTS){ ttsWarmed = true; return; }
  try{
    var u = new SpeechSynthesisUtterance("halo");
    u.volume = 0; u.lang = "id-ID";
    SS.speak(u);
    ttsWarmed = true;
  }catch(e){}
}
function qzShow(){
  if(QZ.idx >= QZ.queue.length){ QZ.phase = "done"; QZ.curQ = null; }
  else {
    QZ.phase = "q"; QZ.revealed = false; QZ.pick = -1;
    QZ.curQ = makeQ(QZ.queue[QZ.idx]);
  }
  renderQuizPage();
  if(QZ.curQ && QZ.curQ.type === "l") speak(sayText(QZ.curQ.v.w));
}
function quizStart(fromWrong){
  var items;
  if(fromWrong){ items = shuffleArr(QZ.wrongUniq.slice()); }
  else {
    var pool = quizPool();
    if(pool.length < 4) return;
    items = shuffleArr(pool.slice()).slice(0, Math.min(QZ.count, pool.length));
  }
  ttsWarm();
  QZ.queue = items; QZ.plan = items.length;
  QZ.idx = 0; QZ.right = 0; QZ.answered = 0;
  QZ.wrongUniq = []; QZ.rep = {}; QZ.last5 = [];
  qzShow();
}
function quizAnswer(i){
  if(QZ.phase !== "q" || QZ.revealed || !QZ.curQ) return;
  QZ.pick = i; QZ.revealed = true;
  var v = QZ.curQ.v, ok = (i === QZ.curQ.ok);
  QZ.answered++;
  QZ.last5.push(ok ? 1 : 0);
  if(QZ.last5.length > 5) QZ.last5.shift();
  if(ok){
    QZ.right++;
    speak(sayText(v.w));
    renderQuizPage();
    qzTimer = setTimeout(qzNext, 950);
  } else {
    if(!QZ.rep[v.w]) QZ.rep[v.w] = 0;
    if(QZ.rep[v.w] < 2){        /* 最多重出两次,之后只进错词清单 */
      QZ.rep[v.w]++;
      QZ.queue.splice(Math.min(QZ.idx + 4, QZ.queue.length), 0, v);
    }
    if(QZ.wrongUniq.indexOf(v) < 0) QZ.wrongUniq.push(v);
    speak(sayText(v.w));
    renderQuizPage();
  }
}
function qzNext(){
  if(qzTimer){ clearTimeout(qzTimer); qzTimer = null; }
  QZ.idx++;
  qzShow();
}
function quizAction(b){
  var act = b.getAttribute("data-qz");
  if(act === "open"){ go(REVIEW_INDEX); return; }
  if(act === "les"){ var l = b.getAttribute("data-v"); QZ.sel[l] = !QZ.sel[l]; renderQuizPage(); return; }
  if(act === "all"){ D.forEach(function(x){ QZ.sel[x.num] = true; }); renderQuizPage(); return; }
  if(act === "recent"){
    QZ.sel = {};
    var ls = D.map(function(x){ return x.num; }).sort(function(a,b){ return a-b; });
    for(var i=Math.max(0, ls.length-2); i<ls.length; i++) QZ.sel[ls[i]] = true;
    renderQuizPage(); return;
  }
  if(act === "none"){ QZ.sel = {}; renderQuizPage(); return; }
  if(act === "cnt"){ QZ.count = +b.getAttribute("data-v"); renderQuizPage(); return; }
  if(act === "mode"){ QZ.mode = b.getAttribute("data-v"); renderQuizPage(); return; }
  if(act === "start"){ quizStart(false); return; }
  if(act === "opt"){ quizAnswer(+b.getAttribute("data-i")); return; }
  if(act === "cont"){ qzNext(); return; }
  if(act === "say"){ if(QZ.curQ) speak(sayText(QZ.curQ.v.w)); return; }
  if(act === "redo"){ quizStart(true); return; }
  if(act === "again"){ quizStart(false); return; }
  if(act === "cfg"){ QZ.phase = "setup"; renderQuizPage(); return; }
}
function qzHead(sub){
  return '<div class="phead"><div class="eyebrow">' + esc(T("review.eyebrow")) + '</div>' +
    '<div class="ptitle-row"><h1 class="ptitle">' + esc(T("review.h1")) + "</h1></div>" +
    '<div class="ptitle-sub">' + sub + "</div></div>";
}
function renderQuizSetup(){
  var counts = {}, i;
  for(i=0;i<VOCAB.length;i++) counts[VOCAB[i].les] = (counts[VOCAB[i].les] || 0) + 1;
  var pool = quizPool();
  var lesChips = D.map(function(l){
    return '<button class="chip qzc' + (QZ.sel[l.num] ? " on" : "") + '" data-qz="les" data-v="' + l.num + '">' +
      esc(T("gloss.chip", UNIT, l.num, counts[l.num] || 0)) + "</button>";
  }).join("");
  var quick = '<button class="chip" data-qz="recent">' + esc(T("review.recent")) + '</button>' +
    '<button class="chip" data-qz="all">' + esc(T("review.all")) + '</button>' +
    '<button class="chip" data-qz="none">' + esc(T("review.none")) + "</button>";
  var cnts = [10,20,30].map(function(c){
    return '<button class="chip' + (QZ.count === c ? " on" : "") + '" data-qz="cnt" data-v="' + c + '">' +
      esc(T("review.count_n", c)) + "</button>";
  }).join("");
  var modes = [["mix","review.mode_mix"],["read","review.mode_read"],["listen","review.mode_listen"],["recall","review.mode_recall"]].map(function(m){
    return '<button class="chip' + (QZ.mode === m[0] ? " on" : "") + '" data-qz="mode" data-v="' + m[0] + '">' + esc(T(m[1])) + "</button>";
  }).join("");
  var startBtn = pool.length < 4
    ? '<button class="qz-start" disabled>' + esc(T("review.need_more")) + "</button>"
    : '<button class="qz-start" data-qz="start">' + esc(T("review.start", pool.length, Math.min(QZ.count, pool.length))) + "</button>";
  return qzHead(T("review.setup_sub")) +
    '<p class="lead">' + T("review.lead") + "</p>" +
    '<div class="qz-secttl">' + esc(T("review.sec_scope")) + '</div><div class="qz-chips">' + quick + "</div>" +
    '<div class="qz-chips">' + lesChips + "</div>" +
    '<div class="qz-secttl">' + esc(T("review.sec_count")) + '</div><div class="qz-chips">' + cnts + "</div>" +
    '<div class="qz-secttl">' + esc(T("review.sec_type")) + '</div><div class="qz-chips">' + modes + "</div>" +
    '<div class="note green" style="margin-top:22px"><span class="tag">' + esc(T("review.note_tag")) + "</span><p>" +
    T("review.note_body") + "</p></div>" +
    startBtn;
}function renderQuizQ(){
  var q = QZ.curQ, v = q.v;
  var TYPE_KEY = {r:"review.type_r", l:"review.type_l", c:"review.type_c", z:"review.type_z"};
  var prompt;
  if(q.type === "r"){
    prompt = '<div class="qz-prompt">' + sayWhole(v.w, clean(v.w)) + "</div>";
  } else if(q.type === "l"){
    prompt = '<div class="qz-prompt"><button class="qz-audio" data-qz="say">' + esc(T("review.replay")) + "</button></div>";
  } else if(q.type === "c"){
    prompt = '<div class="qz-prompt">' + esc(L(v.gloss)) + '<span class="sub">' + esc(L2(v.gloss)) + "</span></div>";
  } else {
    prompt = '<div class="qz-prompt">' + esc(exBlank(v)) + '<span class="sub">' + esc(L(v.ex_gloss)) + "</span></div>";
  }
  var opts = q.opts.map(function(o, i){
    var cls = "qz-opt";
    if(QZ.revealed){
      if(i === q.ok) cls += " good";
      else if(i === QZ.pick) cls += " bad";
      else cls += " dim";
    }
    return '<button class="' + cls + '" data-qz="opt" data-i="' + i + '">' + esc(o) + "</button>";
  }).join("");
  var toast = (QZ.revealed && QZ.pick === q.ok)
    ? '<span class="qz-toast">✓ ' + esc(pickOne(T("review.toasts"))) + "</span>" : "";
  var fb = "";
  if(QZ.revealed && QZ.pick !== q.ok){
    var sec = L2(v.gloss);
    fb = '<div class="qz-fb"><div class="fw">' + sayWhole(v.w, clean(v.w)) + "</div>" +
      '<div class="fg">' + esc(L(v.gloss)) + (sec ? ' · <i>' + esc(sec) + "</i>" : "") + "</div>" +
      (v.ex ? '<div class="fex"><span class="idtext">' + sayLine(LZ(v.ex)) +
        '</span><span class="gloss" style="display:block;color:var(--ink-soft);font-size:.85em;margin-top:2px">' +
        esc(L(v.ex_gloss)) + "</span></div>" : "") +
      '<div class="fnote">' + esc(T("review.fnote")) + "</div>" +
      '<button class="qz-next" data-qz="cont">' + esc(T("review.cont")) + "</button></div>";
  }
  var pct = Math.round(QZ.idx / QZ.queue.length * 100);
  return qzHead(T("review.progress", QZ.idx + 1, QZ.queue.length)) +
    '<div class="qz-top"><span class="qz-type">' + esc(T(TYPE_KEY[q.type])) + '</span><span class="qz-count">✓ ' +
    QZ.right + " · ✗ " + (QZ.answered - QZ.right) + toast + "</span></div>" +
    '<div class="qz-bar"><i style="width:' + pct + '%"></i></div>' +
    prompt + '<div class="qz-opts">' + opts + "</div>" + fb;
}function renderQuizDone(){
  var pct = QZ.answered ? Math.round(QZ.right / QZ.answered * 100) : 0;
  var line = pct >= 90 ? T("review.praise_hi") : pct >= 70 ? T("review.praise_mid") : T("review.praise_lo");
  var wl = QZ.wrongUniq.map(function(v){
    return '<div class="vk card-tap" data-say="' + esc(clean(v.w)) + '"><span class="w">' +
      sayWhole(v.w, clean(v.w)) + '</span><span class="zh">' + esc(L(v.gloss)) + "</span></div>";
  }).join("");
  var acts = (QZ.wrongUniq.length ? '<button class="qz-next" data-qz="redo">' + esc(T("review.redo", QZ.wrongUniq.length)) + "</button>" : "") +
    '<button class="qz-next alt" data-qz="again">' + esc(T("review.again")) + "</button>" +
    '<button class="qz-next alt" data-qz="cfg">' + esc(T("review.cfg")) + "</button>";
  return qzHead(T("review.done")) +
    '<div class="qz-done"><div class="qz-pct">' + pct + "%</div>" +
    '<div class="qz-line">' + esc(T("review.score", QZ.right, QZ.answered, line)) + "</div>" +
    (QZ.wrongUniq.length ? '<div class="qz-secttl" style="text-align:left">' + esc(T("review.wrong_title")) +
      '</div><div class="qz-wlist">' + wl + "</div>" : "") +
    '<div class="qz-acts">' + acts + "</div></div>";
}function renderQuiz(){
  if(QZ.phase === "q" && QZ.curQ) return renderQuizQ();
  if(QZ.phase === "done") return renderQuizDone();
  return renderQuizSetup();
}
function renderQuizPage(){
  if(PAGES[cur] && PAGES[cur].review){ sheet.innerHTML = renderQuiz(); prefetchPage(); }
}

/* ============================================================
   实战问答 (Latihan Situasi) —— 补足「听懂但说不出」的短板
   与词汇复习的分工:复习练「认词」,这里练「当场组织出答案」。
   四类题:
     jam   看时钟 → 选印尼语读法(含 setengah 陷阱)
     angka 看数字/价格 → 选读法(程序生成,无限不重复)
     situasi 印尼语问句 + 中文提示 → 选正确回答
     dengar 听问句(不给文字)→ 选回答
   加课时只需往 SITUASI / TEMPAT 追加条目,引擎自动纳入。
============================================================ */
var DR = {phase:"setup", types:{jam:true, angka:true, situasi:true, dengar:true},
  count:15, queue:[], idx:0, curQ:null, right:0, answered:0,
  wrong:[], last5:[], revealed:false, pick:-1};
var drTimer = null;


function drShuffle(a){
  for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; }
  return a;
}
function drPick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function drUniqOpts(correct, pool){
  /* 从候选里挑 3 个不重复的干扰项 */
  var out = [], seen = {};
  seen[correct] = 1;
  var src = drShuffle(pool.slice());
  for(var i=0;i<src.length && out.length<3;i++){
    if(!seen[src[i]]){ out.push(src[i]); seen[src[i]] = 1; }
  }
  return out;
}

/* —— 出题 —— */
/* showLang 标出题面本身是什么语言：
   id = 印尼语（会朗读）· num = 时钟/数字（画出来的）· learner = 学习者语言提示。
   scripts/lib/speakables.js 据此决定要不要给题面配音频。 */
/* 题库里没有数据的题型不出题、也不显示。
   比如这本教材还没教数字，ANGKA_POOL 是空的，就没有「几点了 / 数字价格」。 */
function drAvail(t){
  if(t === "jam" || t === "angka") return ANGKA_POOL.length > 0;
  if(t === "situasi") return SITUASI.length > 0 || TEMPAT.length > 0;
  if(t === "dengar") return SITUASI.length > 0;
  return false;
}

function drCue(q){
  return q.cueKey ? T(q.cueKey) : L(q.hint);
}

function makeJam(){
  var h = 1 + Math.floor(Math.random()*12);
  var half = Math.random() < 0.5;
  var correct = jamRead(h, half);
  var wrong = [];
  if(half){
    wrong.push("setengah " + JAM_WORDS[h]);          /* 最常见的错:说成当前小时 */
    wrong.push("jam " + JAM_WORDS[h] + " tiga puluh");
    wrong.push(jamRead((h % 12) + 1, false));
  } else {
    wrong.push("setengah " + JAM_WORDS[h]);
    wrong.push(JAM_WORDS[h] + " jam");
    var o = 1 + Math.floor(Math.random()*12);
    if(o === h) o = (h % 12) + 1;
    wrong.push("jam " + JAM_WORDS[o]);
  }
  return {type:"jam", show:jamDigits(h, half), showLang:"num", cueKey:"drill.cue_jam",
          a:correct, opts:null, extra:wrong};
}
/* 数字池:有限但覆盖全部读法形态(个/十几/几十/百/千/万/十万),
   保证每个数字都有对应语音,又足够多到背不住 */


function makeAngka(){
  var n = drPick(ANGKA_POOL);
  var show = n >= 1000 ? "Rp " + fmtRp(n) : String(n);
  var correct = numRead(n);
  var seen = {}; seen[correct] = 1;
  var wrong = [], tries = 0;
  /* 干扰项也从池子里取 —— 保证有语音,且量级接近才有区分度 */
  var near = ANGKA_POOL.filter(function(x){ return x !== n && x >= n / 12 && x <= n * 12; });
  if(near.length < 6) near = ANGKA_POOL.filter(function(x){ return x !== n; });
  while(wrong.length < 3 && tries++ < 60){
    var cand = numRead(drPick(near));
    if(!seen[cand]){ wrong.push(cand); seen[cand] = 1; }
  }
  while(wrong.length < 3){
    var f = numRead(drPick(ANGKA_POOL));
    if(!seen[f]){ wrong.push(f); seen[f] = 1; }
  }
  return {type:"angka", show:show, showLang:"num", cueKey:"drill.cue_angka", a:correct, opts:null, extra:wrong};
}

function makeSituasi(listen){
  var it = drPick(SITUASI);
  /* 答案和干扰项里可能有 {NEGARA} —— 必须在这里解析掉。
     出题结果会直接进 data-say 和音频查表，留着占位符就查不到音频。 */
  return {type: listen ? "dengar" : "situasi", show:LZ(it.q), showLang:"id", hint:it.hint,
          a:LZ(it.a), opts:null,
          extra:it.alts.slice(0,3).map(LZ)};
}
function makeTempat(){
  var it0 = drPick(TEMPAT);
  var it = { q: it0.q, hint: it0.hint, a: LZ(it0.a) };
  var others = TEMPAT.filter(function(x){ return x.a !== it0.a; }).map(function(x){ return LZ(x.a); });
  /* 最好的干扰项是「同一句换错介词」—— di / ke / dari 是这一阶段最容易混的三个。
     句子里没有可换的介词时（比如 "Ini buku."），就退回从题库里取别的答案。 */
  var extra = [];
  var seen = {}; seen[it.a] = 1;
  var SWAP = [[" di ", " ke "], [" ke ", " di "], [" dari ", " di "], [" di ", " dari "]];
  for(var i = 0; i < SWAP.length && extra.length < 2; i++){
    if(it.a.indexOf(SWAP[i][0]) < 0) continue;
    var alt = it.a.replace(SWAP[i][0], SWAP[i][1]);
    if(alt !== it.a && !seen[alt]){ extra.push(alt); seen[alt] = 1; }
  }
  var fill = drUniqOpts(it.a, others);
  for(var j = 0; j < fill.length && extra.length < 3; j++){
    if(!seen[fill[j]]){ extra.push(fill[j]); seen[fill[j]] = 1; }
  }
  return {type:"situasi", show:L(it.hint), showLang:"learner", cueKey:"drill.cue_tempat",
          a:it.a, opts:null, extra:extra};
}

function drChooseType(){
  var on = [];
  if(DR.types.jam && drAvail("jam")) on.push("jam");
  if(DR.types.angka && drAvail("angka")) on.push("angka");
  if(DR.types.situasi && drAvail("situasi")) on.push("situasi");
  if(DR.types.dengar && drAvail("dengar")) on.push("dengar");
  if(!on.length) return "situasi";
  /* 连错降档:最近 5 题错 3 个以上,优先给看得见文字的题型 */
  var sum = 0;
  for(var i=0;i<DR.last5.length;i++) sum += DR.last5[i];
  if(DR.last5.length >= 4 && sum <= DR.last5.length - 3){
    if(DR.types.situasi && drAvail("situasi")) return "situasi";
    if(DR.types.jam && drAvail("jam")) return "jam";
  }
  return drPick(on);
}
function drMake(){
  var t = drChooseType(), q;
  if(t === "jam") q = makeJam();
  else if(t === "angka") q = makeAngka();
  else if(t === "dengar") q = makeSituasi(true);
  else q = (SITUASI.length === 0 || (Math.random() < 0.4 && TEMPAT.length)) ? makeTempat() : makeSituasi(false);
  var all = [q.a];
  for(var i = 0; i < q.extra.length && all.length < 4; i++){
    if(all.indexOf(q.extra[i]) < 0) all.push(q.extra[i]);
  }
  /* 兜底：题库太小时从别的答案里补，保证 4 个且互不相同 */
  if(all.length < 4){
    var spare = SITUASI.map(function(x){ return x.a; })
      .concat(TEMPAT.map(function(x){ return x.a; }));
    spare = drShuffle(spare);
    for(var k = 0; k < spare.length && all.length < 4; k++){
      if(all.indexOf(spare[k]) < 0) all.push(spare[k]);
    }
  }
  var order = drShuffle([0,1,2,3]);
  q.opts = order.map(function(i){ return all[i]; });
  q.ok = order.indexOf(0);
  return q;
}

/* —— 流程 —— */
function drShow(){
  if(DR.idx >= DR.queue.length){ DR.phase = "done"; DR.curQ = null; }
  else { DR.phase = "q"; DR.revealed = false; DR.pick = -1; DR.curQ = DR.queue[DR.idx]; }
  renderDrillPage();
  if(DR.curQ && DR.curQ.type === "dengar") speak(DR.curQ.show);
}
function drillStart(fromWrong){
  ttsWarm();
  var items = [];
  if(fromWrong && DR.wrong.length){
    items = drShuffle(DR.wrong.slice());
  } else {
    for(var i=0;i<DR.count;i++) items.push(drMake());
  }
  DR.queue = items; DR.idx = 0; DR.right = 0; DR.answered = 0;
  DR.wrong = []; DR.last5 = [];
  drShow();
}
function drillAnswer(i){
  if(DR.phase !== "q" || DR.revealed || !DR.curQ) return;
  DR.pick = i; DR.revealed = true;
  var q = DR.curQ, ok = (i === q.ok);
  DR.answered++;
  DR.last5.push(ok ? 1 : 0);
  if(DR.last5.length > 5) DR.last5.shift();
  speak(q.a);
  if(ok){
    DR.right++;
    renderDrillPage();
    drTimer = setTimeout(drillNext, 1000);
  } else {
    DR.wrong.push(q);
    renderDrillPage();
  }
}
function drillNext(){
  if(drTimer){ clearTimeout(drTimer); drTimer = null; }
  DR.idx++;
  drShow();
}
function drillAction(b){
  var act = b.getAttribute("data-dr");
  if(act === "type"){ var k = b.getAttribute("data-v"); DR.types[k] = !DR.types[k]; renderDrillPage(); return; }
  if(act === "cnt"){ DR.count = +b.getAttribute("data-v"); renderDrillPage(); return; }
  if(act === "start"){ drillStart(false); return; }
  if(act === "opt"){ drillAnswer(+b.getAttribute("data-i")); return; }
  if(act === "cont"){ drillNext(); return; }
  if(act === "say"){ if(DR.curQ) speak(DR.curQ.show); return; }
  if(act === "sayans"){ if(DR.curQ) speak(DR.curQ.a); return; }
  if(act === "redo"){ drillStart(true); return; }
  if(act === "again"){ drillStart(false); return; }
  if(act === "cfg"){ DR.phase = "setup"; renderDrillPage(); return; }
}

/* —— 三个视图 —— */
function drHead(sub){
  return '<div class="phead"><div class="eyebrow">' + esc(T("drill.eyebrow")) + '</div>' +
    '<div class="ptitle-row"><h1 class="ptitle">' + esc(T("drill.h1")) + "</h1></div>" +
    '<div class="ptitle-sub">' + sub + "</div></div>";
}function renderDrillSetup(){
  var TL = [["jam","drill.type_jam"],["angka","drill.type_angka"],["situasi","drill.type_situasi"],["dengar","drill.type_dengar"]]
    .filter(function(t){ return drAvail(t[0]); });
  var chips = TL.map(function(t){
    return '<button class="chip' + (DR.types[t[0]] ? " on" : "") + '" data-dr="type" data-v="' + t[0] + '">' + esc(T(t[1])) + "</button>";
  }).join("");
  var cnts = [10,15,25].map(function(c){
    return '<button class="chip' + (DR.count === c ? " on" : "") + '" data-dr="cnt" data-v="' + c + '">' +
      esc(T("review.count_n", c)) + "</button>";
  }).join("");
  var anyOn = TL.some(function(t){ return DR.types[t[0]]; });
  var btn = anyOn ? '<button class="qz-start" data-dr="start">' + esc(T("drill.start", DR.count)) + "</button>"
                  : '<button class="qz-start" disabled>' + esc(T("drill.need_type")) + "</button>";
  return drHead(T("drill.setup_sub")) +
    '<p class="lead">' + T("drill.lead") + "</p>" +
    '<div class="qz-secttl">' + esc(T("drill.sec_what")) + '</div><div class="qz-chips">' + chips + "</div>" +
    '<div class="qz-secttl">' + esc(T("drill.sec_count")) + '</div><div class="qz-chips">' + cnts + "</div>" +
    '<div class="note green" style="margin-top:22px"><span class="tag">' + esc(T("drill.note_tag")) + "</span><p>" +
    T("drill.note_body") + "</p></div>" + btn;
}function renderDrillQ(){
  var q = DR.curQ;
  var LABEL = {jam:"drill.label_jam", angka:"drill.label_angka", situasi:"drill.label_situasi", dengar:"drill.label_dengar"};
  var head;
  if(q.type === "jam" || q.type === "angka"){
    head = '<div class="dr-big">' + esc(q.show) + "</div>" +
           '<div class="dr-cue">' + esc(T(q.cueKey)) + "</div>";
  } else if(q.type === "dengar"){
    head = '<div class="qz-prompt"><button class="qz-audio" data-dr="say">' + esc(T("drill.replay")) + "</button></div>" +
           '<div class="dr-cue">' + esc(drCue(q)) + "</div>";
  } else {
    head = '<div class="dr-q">' + esc(q.show) + "</div>" +
           '<div class="dr-cue">' + esc(drCue(q)) + "</div>";
  }
  var opts = q.opts.map(function(o, i){
    var cls = "qz-opt";
    if(DR.revealed){
      if(i === q.ok) cls += " good";
      else if(i === DR.pick) cls += " bad";
      else cls += " dim";
    }
    return '<button class="' + cls + '" data-dr="opt" data-i="' + i + '">' + esc(o) + "</button>";
  }).join("");
  var toast = (DR.revealed && DR.pick === q.ok)
    ? '<span class="qz-toast">✓ ' + esc(pickOne(T("drill.toasts"))) + "</span>" : "";
  var fb = "";
  if(DR.revealed && DR.pick !== q.ok){
    var why = (q.type === "jam" && q.a.indexOf("setengah") === 0) ? T("drill.why_jam")
            : (q.type === "angka") ? T("drill.why_angka")
            : T("drill.why_other");
    fb = '<div class="qz-fb"><div class="fw">' + esc(q.a) + "</div>" +
      '<div class="fg">' + esc(q.showLang === "id" ? q.show : drCue(q)) + "</div>" +
      '<button class="pr-btn" data-dr="sayans" style="margin-top:8px">' + esc(T("drill.say_answer")) + "</button>" +
      '<div class="fnote">' + why + "</div>" +
      '<button class="qz-next" data-dr="cont">' + esc(T("review.cont")) + "</button></div>";
  }
  var pct = Math.round(DR.idx / DR.queue.length * 100);
  return drHead(T("drill.progress", DR.idx + 1, DR.queue.length)) +
    '<div class="qz-top"><span class="qz-type">' + esc(T(LABEL[q.type])) + '</span><span class="qz-count">✓ ' +
    DR.right + " · ✗ " + (DR.answered - DR.right) + toast + "</span></div>" +
    '<div class="qz-bar"><i style="width:' + pct + '%"></i></div>' +
    head + '<div class="qz-opts">' + opts + "</div>" + fb;
}function renderDrillDone(){
  var pct = DR.answered ? Math.round(DR.right / DR.answered * 100) : 0;
  var line = pct >= 90 ? T("drill.praise_hi") : pct >= 70 ? T("drill.praise_mid") : T("drill.praise_lo");
  var acts = (DR.wrong.length ? '<button class="qz-next" data-dr="redo">' + esc(T("drill.redo", DR.wrong.length)) + "</button>" : "") +
    '<button class="qz-next alt" data-dr="again">' + esc(T("drill.again")) + "</button>" +
    '<button class="qz-next alt" data-dr="cfg">' + esc(T("drill.cfg")) + "</button>";
  return drHead(T("drill.done")) +
    '<div class="qz-done"><div class="qz-pct">' + pct + "%</div>" +
    '<div class="qz-line">' + esc(T("drill.score", DR.right, DR.answered, line)) + "</div>" +
    '<div class="qz-acts">' + acts + "</div></div>";
}function renderDrill(){
  if(DR.phase === "q" && DR.curQ) return renderDrillQ();
  if(DR.phase === "done") return renderDrillDone();
  return renderDrillSetup();
}
function renderDrillPage(){
  if(PAGES[cur] && PAGES[cur].drill){ sheet.innerHTML = renderDrill(); prefetchPage(); }
}

/* ===== app ===== */
var sheet = document.getElementById("sheet"), reader = document.getElementById("reader");
var counter = document.getElementById("counter");
var prevBtn = document.getElementById("prevBtn"), nextBtn = document.getElementById("nextBtn");
var cur = 0, zoom = 2, masked = false;

function buildTOC(){
  var toc = document.getElementById("toc"), html = "", last = "";
  PAGES.forEach(function(p, i){
    var group = pageLesson(p);
    if(group !== last){
      html += "<h3" + ((p.glossary || p.review || p.drill) ? ' class="ref"' : "") + ">" + esc(group) + "</h3>";
      last = group;
    }
    var ph = null;
    if(p.blocks){ for(var j=0;j<p.blocks.length;j++){ if(p.blocks[j].k === "phead"){ ph = p.blocks[j]; break; } } }
    var title = pageTitle(p) || (ph && ph.title) || "Halaman";
    html += '<a data-i="' + i + '"><span class="pg">' + esc(p.idxInLesson) + "/" + esc(p.total) + "</span><span>" + esc(title) + "</span></a>";
  });
  toc.innerHTML = html;
  toArr(toc.querySelectorAll("a")).forEach(function(a){
    a.addEventListener("click", function(){ go(+a.getAttribute("data-i")); closeMenu(); });
  });
}function markTOC(){
  toArr(document.querySelectorAll(".toc a")).forEach(function(a){
    a.classList.toggle("active", +a.getAttribute("data-i") === cur);
  });
}
function render(){
  var p = PAGES[cur];
  CURMETA = p;
  if(gFillTimer){ clearTimeout(gFillTimer); gFillTimer = null; }
  stopListen();
  stopSeq();
  if(qzTimer){ clearTimeout(qzTimer); qzTimer = null; }
  if(drTimer){ clearTimeout(drTimer); drTimer = null; }
  sheet.innerHTML = p.drill ? renderDrill()
                  : p.review ? renderQuiz()
                  : (p.glossary ? renderGlossary() : p.blocks.map(renderBlock).join(""));
  applyMask();
  counter.textContent = (cur+1) + " / " + PAGES.length;
  prevBtn.disabled = (cur === 0);
  nextBtn.disabled = (cur === PAGES.length-1);
  markTOC();
  if(p.glossary){ wireGlossary(); fillGlossary(); }
  reader.scrollTop = 0;
  lastScrollY = 0;
  showHeader();          /* 刚翻页就要能按上一页／下一页 */
  /* 翻页淡入。#sheet 这个元素本身不换，只换 innerHTML，
     所以要摘掉 class、强制重排、再加回去，动画才会重播。 */
  sheet.classList.remove("fade");
  void sheet.offsetWidth;
  sheet.classList.add("fade");
  /* 这一页的音频后台先抓下来，点词就不用等网络了 */
  prefetchPage();
}
function go(i){
  cur = Math.max(0, Math.min(PAGES.length-1, i));
  render();
}

/* ===== speech ===== */
/* ============================================================
   内置印尼语音库(仅打包版 App 携带):assets/voices/manifest.json +
   若干 .m4a 短音频,构建时用 espeak-ng 预先合成,覆盖本课程会用到的
   每一个词 / 句子 / 发音练习片段。命中即播放录制好的音频,不依赖
   手机厂商 TTS 引擎——从根源上解决"用英文音读印尼语"的问题。
   网页版(不带 voices 文件夹)这段静默失效,自动走原来的系统语音。 */
/* 音频清单由 build.js 内联（AUDIO），不再走 XHR。
   文件本身要么在 APK 的 assets/audio/ 里，要么在网页同目录的 audio/ 下；
   都没有时 <audio> 加载失败，自动回退到系统 TTS（见 playBundled）。 */
var BUNDLE_MAP = AUDIO, BUNDLE_READY = true;
var bundleAudio = new Audio();

/* ============================================================
   音频预取
   ------------------------------------------------------------
   原来每点一个词都现 new Audio(url) 再 play()，等的是一次网络往返 ——
   手机上点下去到出声有明显停顿。现在进一页就把这页会用到的音频
   在后台抓成 blob 存住，点的时候直接从内存播，没有网络等待。

   两个前提：
   · 只在 http(s) 下预取。APK 走 file://，fetch 取不到本地文件，
     而且本地读盘本来就快，不需要预取。
   · 缓存有上限，超了按先进先出释放，避免翻几十页之后把内存吃满。
   ============================================================ */
var AUDIO_BLOB = {};          /* hash → objectURL */
var AUDIO_ORDER = [];         /* 进入缓存的顺序，用来淘汰最旧的 */
var PREFETCH_MAX = 240;       /* 最多存这么多条（一页通常几十条） */
var PREFETCH_PAR = 4;         /* 并发数，别把移动网络占满 */
var prefetchQ = [], prefetchBusy = 0;
var CAN_PREFETCH = /^https?:$/.test(location.protocol) && typeof fetch === "function";

function bundleSrc(hash){ return AUDIO_BLOB[hash] || ("audio/" + hash + ".m4a"); }

function cacheBlob(hash, url){
  AUDIO_BLOB[hash] = url;
  AUDIO_ORDER.push(hash);
  while(AUDIO_ORDER.length > PREFETCH_MAX){
    var old = AUDIO_ORDER.shift();
    if(old !== hash && AUDIO_BLOB[old]){
      try{ URL.revokeObjectURL(AUDIO_BLOB[old]); }catch(e){}
      delete AUDIO_BLOB[old];
    }
  }
}
function pumpPrefetch(){
  while(prefetchBusy < PREFETCH_PAR && prefetchQ.length){
    var h = prefetchQ.shift();
    if(AUDIO_BLOB[h]) continue;
    prefetchBusy++;
    (function(hash){
      fetch("audio/" + hash + ".m4a")
        .then(function(r){ if(!r.ok) throw 0; return r.blob(); })
        .then(function(b){ cacheBlob(hash, URL.createObjectURL(b)); })
        ["catch"](function(){ /* 取不到就算了，点的时候还会走网络 */ })
        ["then"](function(){ prefetchBusy--; pumpPrefetch(); });
    })(h);
  }
}
/** 把当前页所有可点读的音频排进预取队列。render() 末尾调用。 */
function prefetchPage(){
  if(!CAN_PREFETCH || !AUDIO_AVAILABLE || !BUNDLE_MAP) return;
  var seen = {}, q = [];
  toArr(sheet.querySelectorAll("[data-say]")).forEach(function(el){
    var h = BUNDLE_MAP[el.getAttribute("data-say")];
    if(h && !seen[h] && !AUDIO_BLOB[h]){ seen[h] = 1; q.push(h); }
  });
  prefetchQ = q;          /* 换页就丢掉上一页没取完的，优先当前页 */
  pumpPrefetch();
}

/* Android WebView 不支持 Web Speech API —— App 外壳注入 window.AndroidTTS 时改走原生 TTS,
   作为「内置音库没有这条」时的兜底。浏览器里 AndroidTTS 不存在,一切照旧。*/
var NATIVE_TTS = !!window.AndroidTTS;
var SS = window.speechSynthesis || null;
if(NATIVE_TTS){
  var _ttsSeq = 0, _ttsCb = {};
  window.__ttsDone = function(id){
    var u = _ttsCb[id];
    delete _ttsCb[id];
    SS.speaking = false;
    if(u && u.onend) u.onend();
  };
  SS = {
    speaking:false, pending:false,
    getVoices:function(){ return [{name:T("voice.android"), lang:"id-ID"}]; },
    cancel:function(){
      this.speaking = false; _ttsCb = {};
      try{ window.AndroidTTS.stop(); }catch(e){}
    },
    speak:function(u){
      var id = ++_ttsSeq;
      _ttsCb[id] = u; this.speaking = true;
      try{ window.AndroidTTS.speak(u.text, u.rate, String(id)); }
      catch(e){ this.speaking = false; if(u.onerror) u.onerror(); }
    }
  };
}
var voices = [], curVoice = null, rate = 0.9, speaking = null;

function pickVoices(){
  voices = SS ? SS.getVoices() : [];
  var id = voices.filter(function(v){ return /^id(\b|[-_])/i.test(v.lang) || /indonesia/i.test(v.name); });
  var sel = document.getElementById("voiceSel");
  var list = id.length ? id : voices;
  sel.innerHTML = list.map(function(v){
    return '<option value="' + voices.indexOf(v) + '">' + esc(v.name) + (/^id/i.test(v.lang) ? " · id" : "") + "</option>";
  }).join("") || '<option>' + esc(T("voice.system_default")) + "</option>";
  if(id.length){
    curVoice = id[0]; sel.value = voices.indexOf(id[0]);
    document.getElementById("banner").classList.remove("show");
  } else if(BUNDLE_READY){
    curVoice = null;
    sel.innerHTML = '<option>' + esc(T("voice.bundled")) + "</option>";
    document.getElementById("banner").classList.remove("show");
  } else {
    curVoice = null;
    document.getElementById("banner").classList.add("show");
  }
  /* 音频 100% 由 ElevenLabs 合成，系统语音只是兜底 ——
     正常情况下「语音来源」这一项没有意义，藏起来，只在真的退回系统语音时才露出。 */
  var vg = document.getElementById("voiceGrp");
  if(vg) vg.style.display = (BUNDLE_READY && AUDIO_AVAILABLE !== false) ? "none" : "";
  if(typeof syncHeaderH === "function") syncHeaderH();
}
if(SS){
  SS.onvoiceschanged = pickVoices;
  pickVoices();
  setTimeout(pickVoices, 400);
  setTimeout(pickVoices, 1200);   /* 旧 iOS 语音列表回填较慢,多试一次 */
}
document.getElementById("voiceSel").addEventListener("change", function(e){ curVoice = voices[+e.target.value] || null; });
document.getElementById("speedSeg").addEventListener("click", function(e){
  var b = e.target.closest ? e.target.closest("button") : null;
  if(!b) return;
  rate = parseFloat(b.getAttribute("data-rate"));
  toArr(document.querySelectorAll("#speedSeg button")).forEach(function(x){ x.classList.toggle("on", x === b); });
});

function mkUtter(text, r){
  if(NATIVE_TTS) return {text:text, rate:(r || rate), onend:null, onerror:null};
  var u = new SpeechSynthesisUtterance(text);
  u.lang = "id-ID";
  u.rate = r || rate;
  if(curVoice) u.voice = curVoice;
  return u;
}
/* 旧 iOS:cancel() 后立刻 speak() 会丢音;空闲时必须直接 speak(保住用户手势授权) */
function ttsSpeak(u){
  if(!SS) return;
  if(SS.speaking || SS.pending){
    try{ SS.cancel(); }catch(e){}
    setTimeout(function(){ try{ SS.speak(u); }catch(e){} }, 60);
  } else {
    try{ SS.speak(u); }catch(e){}
  }
}
var seqTimer = null;
function stopSeq(){
  if(seqTimer){ clearTimeout(seqTimer); seqTimer = null; }
  try{ bundleAudio.pause(); }catch(e){}
  if(SS){ try{ if(SS.speaking || SS.pending) SS.cancel(); }catch(e){} }
  if(speaking){ speaking.classList.remove("speaking"); speaking = null; }
}
/* 内置音频是否真的能放出来。网页版不带 audio/ 目录时第一次加载失败即置 false，
   之后所有朗读直接走系统语音，不再每次都白等一轮。 */
var AUDIO_AVAILABLE = true;
function playBundled(hash, rate, el, onDone, text){
  stopSeq();
  /* 复用同一个 <audio>，不要每点一次就 new 一个。
     iOS Safari 对同时存在的媒体元素有数量上限，一节课点几十下就会
     堆出几十个孤儿元素，越用越卡。 */
  var a = bundleAudio;
  try{ a.pause(); }catch(e){}
  a.onended = null; a.onerror = null;      /* 清掉上一次的回调，否则会串 */
  var src = bundleSrc(hash), isBlob = src.indexOf("blob:") === 0;
  a.src = src;
  try{ a.currentTime = 0; }catch(e){}
  a.playbackRate = rate || 1;
  if(el){ speaking = el; el.classList.add("speaking"); }
  var fired = false;
  function finish(){
    if(fired) return;
    fired = true;
    if(el){ el.classList.remove("speaking"); if(speaking === el) speaking = null; }
    if(onDone) onDone();
  }
  a.onended = finish;
  /* 加载失败：这一条退回系统语音。
     只有「从网络取都失败」才认为整个 audio/ 目录不存在、全局关掉内置音库；
     blob 取不到只是这一条的问题（缓存被回收之类），不该把整库judge成没有。 */
  a.onerror = function(){
    if(!isBlob) AUDIO_AVAILABLE = false;
    finish();
    if(text) ttsOnly(text, el, rate);
  };
  var p = a.play();
  if(p && p["catch"]) p["catch"](finish);
}
function speak(text, el, r){
  if(!text) return;
  if(AUDIO_AVAILABLE && BUNDLE_READY && BUNDLE_MAP && BUNDLE_MAP[text]){
    playBundled(BUNDLE_MAP[text], r, el, null, text);
    return;
  }
  ttsOnly(text, el, r);
}
/* 只走系统语音（Web Speech / Android 原生桥接），不碰内置音库 */
function ttsOnly(text, el, r){
  if(!text || !SS) return;
  stopSeq();
  var u = mkUtter(text, r);
  if(el){
    speaking = el;
    el.classList.add("speaking");
    u.onend = u.onerror = function(){
      el.classList.remove("speaking");
      if(speaking === el) speaking = null;
    };
  }
  ttsSpeak(u);
}
function speakSeq(parts, gap, el){
  stopSeq();
  if(!parts.length) return;
  if(el){ el.classList.add("speaking"); speaking = el; }
  var i = 0;
  function done(){
    if(el){ el.classList.remove("speaking"); if(speaking === el) speaking = null; }
  }
  function step(){
    if(i >= parts.length){ done(); return; }
    var pt = parts[i++];
    if(AUDIO_AVAILABLE && BUNDLE_READY && BUNDLE_MAP && BUNDLE_MAP[pt.t]){
      try{ bundleAudio.pause(); }catch(e){}
      bundleAudio.onended = null; bundleAudio.onerror = null;
      bundleAudio.src = bundleSrc(BUNDLE_MAP[pt.t]);
      try{ bundleAudio.currentTime = 0; }catch(e){}
      bundleAudio.playbackRate = pt.rate || 1;
      var fired1 = false;
      var advance1 = function(){ if(fired1) return; fired1 = true; seqTimer = setTimeout(step, gap); };
      bundleAudio.onended = advance1; bundleAudio.onerror = advance1;
      var pr = bundleAudio.play();
      if(pr && pr["catch"]) pr["catch"](advance1);
      return;
    }
    if(!SS){ seqTimer = setTimeout(step, gap); return; }
    var fired = false;
    var u = mkUtter(pt.t, pt.rate);
    u.onend = u.onerror = function(){
      if(fired) return;
      fired = true;
      seqTimer = setTimeout(step, gap);
    };
    ttsSpeak(u);
  }
  step();
}

/* ===== 录音对比:Safari 14.1+ 才有 MediaRecorder,旧 iOS / App 内置预览自动隐藏 ===== */
var IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
var IS_REAL_SAFARI = /Version\/[\d.]+.*Safari\//.test(navigator.userAgent);
var IOS_WEBVIEW = IS_IOS && !IS_REAL_SAFARI;   /* WKWebView 调 getUserMedia 会让宿主 App 闪退 */
var CANREC = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder) && !IOS_WEBVIEW;

var micStream = null, recorder = null, recMap = {};
function doRecord(btn, card, w){
  if(recorder && recorder.state === "recording"){ recorder.stop(); return; }
  stopSeq();
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
    micStream = stream;
    var chunks = [];
    recorder = new MediaRecorder(micStream);
    recorder.ondataavailable = function(e){ if(e.data.size) chunks.push(e.data); };
    recorder.onstop = function(){
      btn.classList.remove("rec");
      btn.textContent = T("block.rec_again");
      var blob = new Blob(chunks, {type: recorder.mimeType || "audio/webm"});
      if(recMap[w]) URL.revokeObjectURL(recMap[w]);
      recMap[w] = URL.createObjectURL(blob);
      var c = card.querySelector('[data-act="cmp"]');
      if(c) c.style.display = "";
      playCompare(card, w);
    };
    btn.classList.add("rec");
    btn.textContent = T("block.rec_stop");
    recorder.start();
    setTimeout(function(){ if(recorder && recorder.state === "recording") recorder.stop(); }, 3500);
  })["catch"](function(){ btn.textContent = T("block.rec_denied"); });
}
function playCompare(card, w){
  if(!recMap[w]){ speak(w, card); return; }
  stopSeq();
  card.classList.add("speaking");
  speaking = card;
  function done(){ card.classList.remove("speaking"); if(speaking === card) speaking = null; }
  function playMine(){
    seqTimer = setTimeout(function(){
      var a = new Audio(recMap[w]);
      a.onended = a.onerror = done;
      var pr = a.play();
      if(pr && pr["catch"]) pr["catch"](done);
    }, 350);
  }
  if(AUDIO_AVAILABLE && BUNDLE_READY && BUNDLE_MAP && BUNDLE_MAP[w]){
    try{ bundleAudio.pause(); }catch(e){}
    bundleAudio.onended = null; bundleAudio.onerror = null;
    bundleAudio.src = bundleSrc(BUNDLE_MAP[w]);
    try{ bundleAudio.currentTime = 0; }catch(e){}
    bundleAudio.playbackRate = 1;
    var fired0 = false;
    var adv0 = function(){ if(fired0) return; fired0 = true; playMine(); };
    bundleAudio.onended = adv0; bundleAudio.onerror = adv0;
    var pr0 = bundleAudio.play();
    if(pr0 && pr0["catch"]) pr0["catch"](adv0);
    return;
  }
  if(!SS){ playMine(); return; }
  var u = mkUtter(w), fired = false;
  u.onend = u.onerror = function(){
    if(fired) return;
    fired = true;
    playMine();
  };
  ttsSpeak(u);
}
function prAction(b){
  var card = b.closest(".syl-card"), w = b.getAttribute("data-w"), act = b.getAttribute("data-act");
  if(act === "slow") speak(w, card, 0.6);
  else if(act === "chain"){
    var sy = b.getAttribute("data-s").split("-"), parts = [];
    for(var i=sy.length-1;i>=0;i--) parts.push({t: sy.slice(i).join(""), rate: 0.8});
    speakSeq(parts, 380, card);
  }
  else if(act === "echo") speakSeq([{t:w},{t:w},{t:w}], 2000, card);
  else if(act === "rec") doRecord(b, card, w);
  else if(act === "cmp") playCompare(card, w);
}

/* ===== 点击:卡片整读 / 词单读 / 揭开答案 ===== */

/* ===== 教材听力音轨 =====
   和逐句点读分开走一个 <audio>：整段两分钟，不该被点读打断，
   也不该在切页时继续响。 */
var lisAudio = null, lisFile = null, lisRaf = null, lisBtn = null, lisBar = null;

function lisTick(){
  if(!lisAudio) return;
  if(lisBar && lisAudio.duration) lisBar.style.width = (lisAudio.currentTime / lisAudio.duration * 100) + "%";
  lisRaf = setTimeout(lisTick, 200);
}
function lisLabel(playing){
  if(lisBtn) lisBtn.textContent = T(playing ? "block.listen_pause" : "block.listen_play");
}
/**
 * 暂停但保留进度条和播放位置。
 * 点词发音时走这个 —— 整段听力先停住，读完那个词，
 * 用户自己决定要不要按播放接着听（而不是两个声音叠在一起）。
 */
function pauseListen(){
  if(!lisAudio || lisAudio.paused) return false;
  try{ lisAudio.pause(); }catch(e){}
  if(lisRaf){ clearTimeout(lisRaf); lisRaf = null; }
  lisLabel(false);
  return true;
}
/** 彻底停下并归零：切页、切模式时用。 */
function stopListen(){
  if(lisRaf){ clearTimeout(lisRaf); lisRaf = null; }
  if(lisAudio){ try{ lisAudio.pause(); }catch(e){} lisAudio = null; }
  lisFile = null; lisBtn = null; lisBar = null;
  toArr(document.querySelectorAll(".lis-play")).forEach(function(b){ b.textContent = T("block.listen_play"); });
  toArr(document.querySelectorAll(".lis-bar i")).forEach(function(b){ b.style.width = "0%"; });
}
function toggleListen(btn){
  var file = btn.getAttribute("data-listen");
  /* 同一条音轨：正在放就暂停，暂停着就从原处接着放 */
  if(lisAudio && lisFile === file){
    if(lisAudio.paused){
      lisBtn = btn;
      lisLabel(true);
      var pr0 = lisAudio.play();
      if(pr0 && pr0["catch"]) pr0["catch"](function(){ lisLabel(false); });
      lisTick();
    } else pauseListen();
    return;
  }
  stopSeq();
  stopListen();
  lisFile = file;
  lisAudio = new Audio("audio/" + file + ".m4a");
  lisBtn = btn;
  var wrap = btn.closest(".listen");
  lisBar = wrap && wrap.querySelector(".lis-bar i");
  lisLabel(true);
  function finish(){
    lisLabel(false);
    if(lisRaf){ clearTimeout(lisRaf); lisRaf = null; }
  }
  lisAudio.onended = function(){ finish(); if(lisBar) lisBar.style.width = "0%"; lisFile = null; };
  lisAudio.onerror = finish;
  var pr = lisAudio.play();
  if(pr && pr["catch"]) pr["catch"](finish);
  lisTick();
}

sheet.addEventListener("click", function(e){
  var t = e.target;
  if(!t || !t.closest) return;
  var db = t.closest("[data-dr]");
  if(db){ drillAction(db); return; }
  var qb = t.closest("[data-qz]");
  if(qb){ quizAction(qb); return; }
  var pb = t.closest(".pr-btn");
  if(pb){ prAction(pb); return; }
  var lb = t.closest("[data-listen]");
  if(lb){ toggleListen(lb); return; }
  var ansEl = t.closest(".ans");
  if(ansEl && ansEl.classList.contains("masked")) ansEl.classList.remove("masked");
  var a = t.closest("[data-say]");
  if(!a) return;
  /* 卡片里的词头和卡片本身是同一个东西（词汇表的词头就是卡片的 data-say）。
     点它就当成点整张卡，这样只亮一层，不会「词的高亮」叠在「卡片的高亮」上。 */
  if(a.classList.contains("cardword")){
    var card = a.closest(".card-tap");
    if(card) a = card;
  }
  /* 教材整段听力正在放：先把它按停，再读这个词。
     读完用户自己决定要不要接着听 —— 两个声音一起响听不清。 */
  pauseListen();
  var isPlay = a.classList.contains("play");
  if(isPlay){
    var host = a.closest("li,.row,.gentry");
    if(host) toArr(host.querySelectorAll(".ans.masked")).forEach(function(x){ x.classList.remove("masked"); });
  }
  var target = a;
  if(isPlay){
    var q = a.closest(".qa-line"), r = a.closest(".row,.gex,.phone,.currency");
    target = (q && q.querySelector(".idtext")) || (r && r.querySelector(".idtext,.d")) || a;
  }
  speak(a.getAttribute("data-say"), target);
});

/* ===== 遮挡(练习答案 + 词汇表释义 = 闪卡模式) ===== */
function applyMask(){
  toArr(sheet.querySelectorAll(".ans")).forEach(function(el){ el.classList.toggle("masked", masked); });
}
document.getElementById("maskBtn").addEventListener("click", function(){
  masked = !masked;
  this.classList.toggle("on", masked);
  document.getElementById("maskTxt").textContent = masked ? T("nav.mask_hidden") : T("nav.mask_shown");
  applyMask();
});

/* ============================================================
   浮动页眉：往下读时收起，往回滚就出来
   ------------------------------------------------------------
   页眉原来常驻一行，手机上等于每页少一行正文。改成 position:fixed
   之后由 .reader 的 padding-top 让位，收起／展开只动 transform，
   不引起重排。

   规矩：
   · 顶部附近永远显示
   · 往下滚超过阈值才收起，往回滚一点立刻出来
   · 抽屉或设置展开着不收
   · 翻页后一定是展开的（刚翻页就要能按上一页／下一页）
   ============================================================ */
var HDR_TUCK_AFTER = 90;   /* 滚过这么多像素才允许收起 */
var HDR_DELTA = 6;         /* 小于这个幅度的抖动不理会 */
var lastScrollY = 0;

function syncHeaderH(){
  var h = document.getElementById("hdr").offsetHeight;
  if(h) document.documentElement.style.setProperty("--hdr-h", h + "px");
}
function showHeader(){
  document.body.classList.remove("tuck");
}
function tuckHeader(){
  var hdr = document.getElementById("hdr");
  var toc = document.getElementById("toc");
  if(hdr.classList.contains("open")) return;          /* 设置展开着 */
  if(toc && toc.classList.contains("open")) return;   /* 目录抽屉开着 */
  document.body.classList.add("tuck");
}
reader.addEventListener("scroll", function(){
  var y = reader.scrollTop;
  var d = y - lastScrollY;
  if(Math.abs(d) < HDR_DELTA) return;
  lastScrollY = y;
  if(y <= HDR_TUCK_AFTER) showHeader();
  else if(d > 0) tuckHeader();
  else showHeader();
}, { passive: true });

/* ===== 设置面板 =====
   词汇表 / 复习 / 实战 原来在页眉各占一个按钮，现在统一走目录抽屉
   （它们本来就在 PAGES 里，目录里有条目），页眉只留遮盖和设置两个。
   下面用 on() 绑定：按钮被精简掉时静默跳过，不会整页白屏。 */
function on(id, ev, fn){
  var el = document.getElementById(id);
  if(el) el.addEventListener(ev, fn);
  return el;
}
on("glossBtn", "click", function(){ go(GLOSS_INDEX); });
on("quizBtn", "click", function(){ go(REVIEW_INDEX); });
on("drillBtn", "click", function(){ go(DRILL_INDEX); });

function closeSettings(){ document.getElementById("hdr").classList.remove("open"); }
document.getElementById("setBtn").addEventListener("click", function(e){
  e.stopPropagation();
  showHeader();
  document.getElementById("hdr").classList.toggle("open");
});
/* 点面板以外的地方收起来 */
document.addEventListener("click", function(e){
  var hdr = document.getElementById("hdr");
  if(!hdr.classList.contains("open")) return;
  var c = document.getElementById("ctrls");
  if(c && !c.contains(e.target)) closeSettings();
});
document.addEventListener("keydown", function(e){
  if(e.key === "Escape") closeSettings();
});

/* ===== 字号 ===== */
var SIZES = [14, 15.5, 17, 19, 21, 23.5];
function setZoom(z){
  zoom = Math.max(0, Math.min(SIZES.length-1, z));
  document.documentElement.style.setProperty("--rs", SIZES[zoom] + "px");
}
document.getElementById("zoomSeg").addEventListener("click", function(e){
  var b = e.target.closest ? e.target.closest("button") : null;
  if(!b) return;
  var d = +b.getAttribute("data-z");
  setZoom(d === 0 ? 2 : zoom + d);
});

/* ===== 翻页 + 键盘 ===== */
prevBtn.addEventListener("click", function(){ go(cur-1); });
nextBtn.addEventListener("click", function(){ go(cur+1); });
document.addEventListener("keydown", function(e){
  var tag = e.target && e.target.tagName;
  if(tag === "SELECT" || tag === "INPUT") return;
  if(e.key === "ArrowRight" || e.key === "PageDown") go(cur+1);
  else if(e.key === "ArrowLeft" || e.key === "PageUp") go(cur-1);
  else if(e.key === "+" || e.key === "=") setZoom(zoom+1);
  else if(e.key === "-" || e.key === "_") setZoom(zoom-1);
  else if(e.key === "g" || e.key === "G") go(GLOSS_INDEX);
  else if(e.key === "r" || e.key === "R") go(REVIEW_INDEX);
  else if(e.key === "t" || e.key === "T") go(DRILL_INDEX);
  else if(PAGES[cur].review && QZ.phase === "q" && !QZ.revealed && /^[1-4]$/.test(e.key)) quizAnswer(+e.key - 1);
  else if(PAGES[cur].drill && DR.phase === "q" && !DR.revealed && /^[1-4]$/.test(e.key)) drillAnswer(+e.key - 1);
});

/* ===== 移动端目录抽屉 ===== */
var tocEl = document.getElementById("toc"), scrim = document.getElementById("scrim");
function openMenu(){
  showHeader(); tocEl.classList.add("open"); scrim.classList.add("show"); }
function closeMenu(){ tocEl.classList.remove("open"); scrim.classList.remove("show"); }
document.getElementById("menuBtn").addEventListener("click", openMenu);
scrim.addEventListener("click", closeMenu);

/* ===== 语言切换 ===== */
document.getElementById("langSeg").addEventListener("click", function(e){
  var b = e.target.closest ? e.target.closest("button") : null;
  if(b && b.getAttribute("data-lang")) setLang(b.getAttribute("data-lang"));
});

/* ===== 深浅色切换 ===== */
document.getElementById("themeSeg").addEventListener("click", function(e){
  var b = e.target.closest ? e.target.closest("button") : null;
  if(b && b.getAttribute("data-th")) setTheme(b.getAttribute("data-th"));
});

/* ===== 配色切换 ===== */
on("accentSeg", "click", function(e){
  var b = e.target.closest ? e.target.closest(".sw") : null;
  if(b && b.getAttribute("data-ac")) setAccent(b.getAttribute("data-ac"));
});

/* ===== 启动 ===== */
/* 访问统计只注入网页版（见 scripts/site.js），APK 是离线运行的、没有统计。
   所以 file:// 下要把页脚那句隐私说明藏起来 —— 不能说没做的事。 */
(function(){
  var pv = document.getElementById("footPrivacy");
  if(pv && location.protocol.indexOf("http") !== 0) pv.style.display = "none";
})();

applyStaticText();
buildTOC();
setZoom(2);
render();
syncHeaderH();
window.addEventListener("resize", syncHeaderH);
/* 字号会改变按钮行高，语言切换会换文案长度 —— 都要重量一次 */
window.addEventListener("orientationchange", function(){ setTimeout(syncHeaderH, 250); });
