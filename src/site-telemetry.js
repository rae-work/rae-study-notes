/* ============================================================
   Rae's Study Note · 使用情况收集
   ------------------------------------------------------------
   ⚠️ 这个文件**只进网站版**。scripts/site.js 生成 docs/ 时才把它
   内联到页面末尾；dist/ 单文件和 APK 里一个字节都没有 ——
   所以离线约束（lib/build.js 的 assertOffline）永远碰不到它。

   分工：引擎只管调 TRK()「报告刚才发生了什么」（见 src/engine.js
   顶部「埋点出口」），本文件把 window.__RSN_TRACK 换成真的实现，
   顺便把引擎在本文件加载之前攒下的那几条领走。

   三条底线：
   · 任何一步出错都吞掉 —— 统计坏了绝不能影响学习
   · 不跟学习记录抢 localStorage 配额（只存一个 16 字节的随机编号）；
     写失败一律降级，不去动 STORE 的 ok 状态
   · 不收集姓名、邮箱、IP 这类能指认到人的东西。国家由服务端从
     Cloudflare 的请求信息里取，IP 本身不落库。

   本文件是独立可解析的 JS —— npm run validate 第 6 关会对 src/ 下
   每个 .js 跑 node --check，所以下面三个占位符写成字符串字面量，
   由 site.js 原样替换，不能写成 {{...}} 那种模板语法。
   ============================================================ */
(function () {
  "use strict";

  var CFG = {
    ep: "__ENDPOINT__",   /* 收集地址 */
    ver: "__VER__",       /* 构建版本 */
    tag: "__TAG__"        /* 构建标记：test = 试用期的数据，查询时排除掉 */
  };
  /* 地址没配（或占位符没被替换）就整段不跑 —— 什么都不做，也不报错 */
  if (!CFG.ep || CFG.ep.indexOf("http") !== 0) return;

  var MAX_BATCH = 25;       /* 攒够这么多条就发一次 */
  var MAX_WAIT = 15000;     /* 或者攒够这么久 */
  var MAX_EVENTS = 3000;    /* 单次访问的事件上限，兜住万一的死循环 */
  var MAX_ERRORS = 20;      /* 同上，报错单独再兜一道 */
  var MAX_BYTES = 55000;    /* sendBeacon 的大小限制，留足余量 */

  function cut(s, n) {
    if (s == null) return null;
    s = String(s);
    return s.length > n ? s.slice(0, n) : s;
  }

  function rnd() {
    var s = "", i;
    try {
      var a = new Uint8Array(8);
      crypto.getRandomValues(a);
      for (i = 0; i < a.length; i++) s += (a[i] + 256).toString(16).slice(1);
      return s;
    } catch (e) {}
    for (i = 0; i < 4; i++) s += (Math.floor(Math.random() * 65536) + 65536).toString(16).slice(1);
    return s;
  }

  /* ── 匿名设备编号 ──────────────────────────────────────────
     一串随机数，存在本机，作用只是把同一台设备的行为串起来。
     走引擎的 STORE（键名自动加 rsn. 前缀），跟其它设置一个待遇：
     存不下就降级成一次性的临时编号，前缀 t- 标出来 —— 统计时
     能看出「这些是没能记住编号的访问」，不会被当成一堆新设备。
     ⚠️ iOS Safari 直接开网页时，七个使用日不访问就会被系统清掉，
     编号会重置。所以「设备数」天生偏高，只能当量级看。 */
  var dev = null, devNew = 0;
  try {
    var S = window.STORE;
    if (S && S.ok()) {
      dev = S.getRaw("aid");
      if (!dev || dev.length < 12) {
        dev = rnd();
        devNew = 1;
        S.setRaw("aid", dev);
      }
    }
  } catch (e) { dev = null; }
  if (!dev) { dev = "t-" + rnd(); devNew = 1; }

  var ses = rnd();          /* 本次访问的编号，只活在内存里 */

  /* ── 设备与环境 ───────────────────────────────────────────── */
  function mq(q) {
    try { return (window.matchMedia && matchMedia(q).matches) ? 1 : 0; } catch (e) { return null; }
  }

  function parseUA() {
    var u = navigator.userAgent || "", d = { os: "?", osv: "", br: "?", brv: "", wv: 0 }, m;
    if ((m = u.match(/iPhone OS (\d+[_.]\d+)/))) { d.os = "iOS"; d.osv = m[1].replace(/_/g, "."); }
    else if ((m = u.match(/iPad.*?OS (\d+[_.]\d+)/))) { d.os = "iPadOS"; d.osv = m[1].replace(/_/g, "."); }
    else if ((m = u.match(/Android (\d+(?:\.\d+)?)/))) { d.os = "Android"; d.osv = m[1]; }
    else if ((m = u.match(/Mac OS X (\d+[_.]\d+)/))) { d.os = "macOS"; d.osv = m[1].replace(/_/g, "."); }
    else if (/Windows NT 10/.test(u)) { d.os = "Windows"; d.osv = "10+"; }
    else if (/Windows/.test(u)) d.os = "Windows";
    else if (/CrOS/.test(u)) d.os = "ChromeOS";
    else if (/Linux/.test(u)) d.os = "Linux";
    /* 顺序不能换：Edge 和三星浏览器的 UA 里都带 Chrome，
       Chrome 的 UA 里又带 Safari，从最特殊的往回认。 */
    if ((m = u.match(/Edg(?:iOS|A)?\/(\d+)/))) { d.br = "Edge"; d.brv = m[1]; }
    else if ((m = u.match(/SamsungBrowser\/(\d+)/))) { d.br = "Samsung"; d.brv = m[1]; }
    else if ((m = u.match(/(?:CriOS|Chrome)\/(\d+)/))) { d.br = "Chrome"; d.brv = m[1]; }
    else if ((m = u.match(/(?:FxiOS|Firefox)\/(\d+)/))) { d.br = "Firefox"; d.brv = m[1]; }
    else if ((m = u.match(/Version\/(\d+)[\d.]* Safari/))) { d.br = "Safari"; d.brv = m[1]; }
    else if (/Safari/.test(u)) d.br = "Safari";
    if (/;\s*wv\)/.test(u)) d.wv = 1;          /* 安卓 WebView（比如 APK 里那层壳） */
    return d;
  }

  /* 可见区尺寸要留一份「最后一次量到的有效值」。
     两头都会量到 0：脚本刚跑起来时页面还没排版，pagehide 时布局已经在拆了 ——
     而这两个时刻恰好就是我们要发数据的时刻。 */
  var vpW = 0, vpH = 0;
  function sampleVP() {
    try {
      var w = window.innerWidth || document.documentElement.clientWidth || 0;
      var h = window.innerHeight || document.documentElement.clientHeight || 0;
      if (w && h) { vpW = w; vpH = h; }
    } catch (e) {}
  }
  sampleVP();
  setTimeout(sampleVP, 0);
  window.addEventListener("resize", sampleVP);

  function buildEnv() {
    var e = {};
    try {
      var d = parseUA();
      /* 浏览器语言：看得出是哪国同学，也看得出他们把界面切成了什么 */
      e.blang = navigator.language || null;
      e.blangs = cut((navigator.languages || []).slice(0, 6).join(","), 80) || null;
      e.os = d.os; e.osv = d.osv; e.br = d.br; e.brv = d.brv; e.wv = d.wv;
      e.ua = cut(navigator.userAgent, 200);
      e.scr = (screen.width || 0) + "x" + (screen.height || 0);
      sampleVP();
      e.vp = vpW + "x" + vpH;
      e.dpr = window.devicePixelRatio || 1;
      e.touch = navigator.maxTouchPoints || 0;
      /* 加到主屏幕了没有 —— iOS 上这直接决定学习记录会不会被系统清掉 */
      e.pwa = (navigator.standalone ? 1 : 0) || mq("(display-mode: standalone)") || 0;
      e.ref = cut(document.referrer || "", 120) || null;
      try { e.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (x) { e.tz = null; }
      e.tzo = -new Date().getTimezoneOffset();
      e.dark = mq("(prefers-color-scheme: dark)");
      e.rmo = mq("(prefers-reduced-motion: reduce)");
      e.net = (navigator.connection && navigator.connection.effectiveType) || null;
      e.cpu = navigator.hardwareConcurrency || null;
      e.mem = navigator.deviceMemory || null;
      e.newdev = devNew;
    } catch (x) {}
    return e;
  }

  /* ⚠️ 环境信息在**第一次发送时**才采，不在脚本刚跑起来时采 ——
     那一刻页面还没排版完，innerWidth 可能还是 0，可见区就成了「0x0」。 */

  /* ── 发送 ─────────────────────────────────────────────────
     sendBeacon 是手机上唯一可靠的「离开页面时还能发出去」的方式；
     普通 fetch 会在页面关掉的瞬间被浏览器掐掉。
     传字符串时 Content-Type 是 text/plain，属于简单请求，
     不会触发 CORS 预检，服务端少一半麻烦。 */
  var buf = [], sent = 0, errs = 0, timer = null, envSent = false, curPage = null;

  function post(body) {
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(CFG.ep, body)) return;
    } catch (e) {}
    try {
      fetch(CFG.ep, { method: "POST", body: body, mode: "no-cors", keepalive: true });
    } catch (e) {}
  }

  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!buf.length) return;
    var pack = { v: 1, dev: dev, ses: ses, tag: CFG.tag, ver: CFG.ver, ev: buf };
    if (!envSent) pack.env = buildEnv();
    var body;
    try { body = JSON.stringify(pack); } catch (e) { buf = []; return; }
    if (body.length > MAX_BYTES) {
      /* 正常到不了这里（每条都截过、一批最多 25 条）。真到了就丢这一批，
         下一批带一条 drop 说明丢了多少 —— 卡在这儿反复重发更糟。
         envSent 保持不变，环境信息跟着下一批走。 */
      var n = buf.length;
      buf = [];
      push("drop", { n: n, bytes: body.length });
      return;
    }
    buf = [];
    envSent = true;
    post(body);
  }

  function push(ev, d, t) {
    if (sent >= MAX_EVENTS) return;
    sent++;
    var o = { t: t || Date.now(), e: ev };
    if (d) o.d = d;
    /* 每条都带上「当时在哪一页」，这样查「哪一页上的词最常被点」
       不用在服务端按时间去拼上下文。 */
    if (ev === "page" && d && d.k) curPage = d.k;
    if (curPage) o.p = curPage;
    buf.push(o);
    if (buf.length >= MAX_BATCH) flush();
    else if (!timer) timer = setTimeout(flush, MAX_WAIT);
  }

  /* ── 接上引擎 ───────────────────────────────────────────── */
  window.__RSN_TRACK = function (ev, d, t) {
    try { push(ev, d, t); } catch (e) {}
  };
  /* 引擎排在本文件前面执行，开机那几条（open / 第一页 / 恢复练习）
     先攒在它那儿，这里领走。 */
  try {
    if (typeof window.__RSN_DRAIN === "function") {
      var q = window.__RSN_DRAIN() || [];
      for (var i = 0; i < q.length; i++) push(q[i][0], q[i][1], q[i][2]);
    }
  } catch (e) {}

  /* ── 页面报错 ───────────────────────────────────────────── */
  function reportErr(msg, file, line, col, stack) {
    if (errs >= MAX_ERRORS) return;
    errs++;
    try {
      push("err", {
        m: cut(msg, 200),
        f: cut(String(file || "").split("/").pop(), 60) || null,
        l: line || 0,
        c: col || 0,
        s: stack ? cut(String(stack).split("\n").slice(0, 3).join(" | "), 300) : null
      });
      flush();          /* 报错立刻发 —— 页面可能正要崩，等不到下一批 */
    } catch (e) {}
  }
  window.addEventListener("error", function (e) {
    try { reportErr(e.message, e.filename, e.lineno, e.colno, e.error && e.error.stack); } catch (x) {}
  });
  window.addEventListener("unhandledrejection", function (e) {
    try {
      var r = e.reason, m = "";
      try { m = (r && r.message) ? r.message : String(r); } catch (x2) { m = "?"; }
      reportErr("unhandledrejection: " + m, null, 0, 0, r && r.stack);
    } catch (x) {}
  });

  /* ── 什么时候发 ─────────────────────────────────────────
     这两个监听排在引擎的 flushState 后面注册，所以引擎先把
     「当前这页停留了多久」报进来，我们再一起发出去。顺序别调换。 */
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
})();
