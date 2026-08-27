/* ============================================================
   Rae's Study Note · 使用情况收集服务（Cloudflare Worker + D1）
   ------------------------------------------------------------
   两件事：
     POST /n        收网页发来的一批事件，写进 D1
     GET  /lihat    统计页（要口令，口令存在 Secret VIEW_KEY 里）

   路径故意起得不像统计服务 —— 广告拦截名单里有
   「/api/event」「/js/script.js」这类特征，撞上就整批数据没了。

   任何一步出错都回 204：客户端拿不到也做不了什么，
   而返回错误只会让浏览器控制台里多一片红色。
   ============================================================ */

/* device 表里由客户端提供的环境字段。加字段时改这里 + schema.sql 即可。 */
const ENV_COLS = [
  'blang', 'blangs', 'os', 'osv', 'br', 'brv', 'wv', 'ua', 'scr', 'vp',
  'dpr', 'touch', 'pwa', 'ref', 'tz', 'tzo', 'dark', 'rmo', 'net', 'cpu', 'mem',
];

const MAX_BODY = 80000;     /* 超过这个大小的请求直接丢 */
const MAX_EVENTS = 200;     /* 单次最多收这么多条 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') return preflight();
    if (p === '/n' && request.method === 'POST') return collect(request, env, ctx);
    if (p === '/lihat') return view(request, env);
    if (p === '/lihat/data') return data(request, env);

    return new Response('', { status: 404 });
  },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
const preflight = () => new Response(null, { status: 204, headers: CORS });
const noContent = () => new Response(null, { status: 204, headers: CORS });

/* ── 收数据 ───────────────────────────────────────────────── */
async function collect(request, env, ctx) {
  try {
    const raw = await request.text();
    if (!raw || raw.length > MAX_BODY) return noContent();

    let pack;
    try { pack = JSON.parse(raw); } catch { return noContent(); }
    if (!pack || pack.v !== 1) return noContent();

    const dev = str(pack.dev, 64);
    const ses = str(pack.ses, 64);
    if (!dev || !ses) return noContent();

    const evs = Array.isArray(pack.ev) ? pack.ev.slice(0, MAX_EVENTS) : [];
    if (!evs.length) return noContent();

    const rts = Date.now();
    const ver = str(pack.ver, 20);
    const tag = str(pack.tag, 20) || '';
    const country = str(request.headers.get('cf-ipcountry') || (request.cf && request.cf.country), 4);

    const rows = [];
    for (const e of evs) {
      if (!e || typeof e !== 'object') continue;
      const name = str(e.e, 40);
      if (!name) continue;
      /* 客户端时钟可能离谱（设错了、或时区没同步）。差得太远就用服务端时间，
         否则整张表的时间轴会被一台设备搅乱。 */
      let ts = Number(e.t);
      if (!Number.isFinite(ts) || Math.abs(ts - rts) > 7 * 86400000) ts = rts;
      rows.push([
        Math.round(ts), rts, dev, ses, name,
        str(e.p, 40),
        e.d == null ? null : str(JSON.stringify(e.d), 2000),
        ver, tag,
      ]);
    }
    if (!rows.length) return noContent();

    const ins = env.DB.prepare(
      'INSERT INTO ev (ts,rts,dev,ses,ev,page,d,ver,tag) VALUES (?,?,?,?,?,?,?,?,?)'
    );
    const ops = rows.map((r) => ins.bind(...r));

    /* env 一次访问只随第一批来一次 —— 所以它出现 = 新开了一次访问，
       sessions 就在这里 +1。 */
    const hasEnv = pack.env && typeof pack.env === 'object';
    ops.unshift(deviceUpsert(env, {
      dev, rts, ver, tag, country,
      newSession: hasEnv ? 1 : 0,
      nEvents: rows.length,
      env: hasEnv ? pack.env : null,
    }));

    /* 等写完再返回，但不让客户端等 —— waitUntil 保证 Worker 不会提前结束。 */
    ctx.waitUntil(env.DB.batch(ops).catch(() => {}));
    return noContent();
  } catch {
    return noContent();
  }
}

function deviceUpsert(env, o) {
  const cols = ['dev', 'first_ts', 'last_ts', 'sessions', 'events', 'country', 'ver', 'tag', ...ENV_COLS];
  const marks = cols.map(() => '?').join(',');
  /* 环境字段用 COALESCE(新, 旧)：后面几批没带 env，不能把已经记下的信息覆盖成空。 */
  const sets = [
    'last_ts = MAX(device.last_ts, excluded.last_ts)',
    'sessions = device.sessions + excluded.sessions',
    'events = device.events + excluded.events',
    'country = COALESCE(excluded.country, device.country)',
    'ver = COALESCE(excluded.ver, device.ver)',
    'tag = COALESCE(excluded.tag, device.tag)',
    ...ENV_COLS.map((c) => `${c} = COALESCE(excluded.${c}, device.${c})`),
  ].join(', ');

  const e = o.env || {};
  const vals = [
    o.dev, o.rts, o.rts, o.newSession, o.nEvents,
    o.country || null, o.ver || null, o.tag || null,
    ...ENV_COLS.map((c) => {
      const v = e[c];
      if (v == null) return null;
      return typeof v === 'number' ? v : str(v, 220);
    }),
  ];

  return env.DB
    .prepare(
      `INSERT INTO device (${cols.join(',')}) VALUES (${marks}) ` +
      `ON CONFLICT(dev) DO UPDATE SET ${sets}`
    )
    .bind(...vals);
}

const str = (v, n) => {
  if (v == null) return null;
  const s = String(v);
  return s.length > n ? s.slice(0, n) : s;
};

/* ── 看数据 ───────────────────────────────────────────────── */

/* 口令：?k=… 带一次，之后存进 cookie。比 HTTP Basic 好 ——
   手机上系统弹窗的样式不受控，Safari 还经常记不住。 */
function auth(request, env) {
  const want = env.VIEW_KEY;
  if (!want) return { ok: false, why: '还没设口令：先跑 npx wrangler secret put VIEW_KEY' };
  const url = new URL(request.url);
  const given = url.searchParams.get('k');
  if (given && safeEq(given, want)) return { ok: true, fresh: true };
  const ck = (request.headers.get('cookie') || '').match(/(?:^|;\s*)rsnk=([^;]+)/);
  if (ck && safeEq(decodeURIComponent(ck[1]), want)) return { ok: true };
  return { ok: false, why: '口令不对' };
}

/* 逐字节比到底，不提前返回 —— 别让响应快慢泄漏口令对了几位 */
function safeEq(a, b) {
  a = String(a); b = String(b);
  const n = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < n; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function view(request, env) {
  const a = auth(request, env);
  if (!a.ok) {
    return new Response(loginPage(a.why), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  const h = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  };
  if (a.fresh) {
    /* 记住口令，之后直接开 /lihat 就行，链接里不用再挂着它 */
    h['Set-Cookie'] = `rsnk=${encodeURIComponent(env.VIEW_KEY)}; Path=/lihat; Max-Age=15552000; HttpOnly; Secure; SameSite=Lax`;
  }
  return new Response(DASH, { headers: h });
}

async function data(request, env) {
  const a = auth(request, env);
  if (!a.ok) return json({ error: a.why }, 401);

  const url = new URL(request.url);
  const days = clampDays(url.searchParams.get('days'));
  const asked = url.searchParams.get('tag') || 'live';
  const mode = ['live', 'test', 'all'].includes(asked) ? asked : 'live';

  const cutoff = days ? Date.now() - days * 86400000 : 0;
  /* 拼进 SQL 的只有这两个：cutoff 是数字，mode 过了白名单，没有注入面。 */
  const tagVal = mode === 'test' ? 'test' : '';
  const tagW = (pre) => (mode === 'all' ? '' : ` AND COALESCE(${pre}tag,'') = '${tagVal}'`);
  const W = `WHERE ts >= ${cutoff}${tagW('')}`;
  const DW = `WHERE last_ts >= ${cutoff}${tagW('')}`;
  /* 连表时 tag 两张表都有，不加前缀会 ambiguous column name */
  const JW = `WHERE e.ev = 'open' AND e.ts >= ${cutoff}${tagW('e.')}`;

  /* 一天的分界按日惹时间（UTC+7）算 —— 用 UTC 的话晚上七点之后的学习会算到第二天 */
  const DAY = `date(ts/1000,'unixepoch','+7 hours')`;
  const WRONG = `SUM(CASE WHEN json_extract(d,'$.ok')=1 THEN 0 ELSE 1 END)`;
  const X = (k) => `json_extract(d,'$.${k}')`;

  const queries = {
    overview: `SELECT COUNT(DISTINCT dev) devs, COUNT(DISTINCT ses) sess, COUNT(*) evs,
                 MIN(ts) t0, MAX(ts) t1 FROM ev ${W}`,
    /* ⚠️ 别名不能叫 d —— ev 表里真有一列叫 d（事件的 JSON）。
       叫了的话 GROUP BY 会绑到那一列上，变成「按事件内容分组」，
       于是每天都被拆成几十行。同理别名不能叫 id / ev / ts / page / ver / tag。
       这里再用 GROUP BY 1（按第一个输出列）双保险。 */
    daily: `SELECT ${DAY} day, COUNT(DISTINCT dev) devs, COUNT(DISTINCT ses) sess, COUNT(*) evs
              FROM ev ${W} GROUP BY 1 ORDER BY 1 DESC LIMIT 40`,
    devices: `SELECT dev, os, osv, br, brv, wv, scr, pwa, blang, tz, country, ver, tag,
                     sessions, events, first_ts, last_ts
                FROM device ${DW} ORDER BY last_ts DESC LIMIT 80`,
    blang: `SELECT COALESCE(blang,'?') blang, COUNT(*) n FROM device ${DW} GROUP BY blang ORDER BY n DESC`,
    os: `SELECT COALESCE(os,'?') os, COALESCE(br,'?') br, COUNT(*) n FROM device ${DW}
           GROUP BY os, br ORDER BY n DESC`,
    langPair: `SELECT COALESCE(dv.blang,'?') blang, COALESCE(json_extract(e.d,'$.lang'),'?') ui,
                      COUNT(DISTINCT e.dev) devs, COUNT(*) opens
                 FROM ev e JOIN device dv ON dv.dev = e.dev
                 ${JW}
                 GROUP BY blang, ui ORDER BY devs DESC, opens DESC`,
    pages: `SELECT page k, COUNT(*) views, COUNT(DISTINCT dev) devs
              FROM ev ${W} AND ev='page' AND page IS NOT NULL GROUP BY k ORDER BY views DESC LIMIT 60`,
    dwell: `SELECT page k, COUNT(*) n,
                   ROUND(AVG(MIN(${X('ms')},900000))/1000) avg_s,
                   ROUND(SUM(MIN(${X('ms')},900000))/1000) tot_s,
                   ROUND(AVG(${X('y')})) depth
              FROM ev ${W} AND ev='dwell' AND page IS NOT NULL GROUP BY k ORDER BY tot_s DESC LIMIT 60`,
    nav: `SELECT ${X('via')} via, COUNT(*) n FROM ev ${W} AND ev='page' GROUP BY via ORDER BY n DESC`,
    hardWords: `SELECT ${X('w')} w, COUNT(*) n, ${WRONG} wrong,
                       ROUND(AVG(MIN(${X('ms')},60000))/1000,1) avg_s, COUNT(DISTINCT dev) devs
                  FROM ev ${W} AND ev='quiz.a' GROUP BY w
                  HAVING COUNT(*) >= 3 AND ${WRONG} > 0
                  ORDER BY (${WRONG}*1.0/COUNT(*)) DESC, n DESC LIMIT 50`,
    confusion: `SELECT ${X('w')} w, ${X('pick')} pick, ${X('t')} t, COUNT(*) n
                  FROM ev ${W} AND ev='quiz.a' AND ${X('ok')}=0 AND ${X('pick')} IS NOT NULL
                  GROUP BY w, pick ORDER BY n DESC LIMIT 50`,
    quizType: `SELECT ${X('t')} t, COUNT(*) n, ${WRONG} wrong,
                      ROUND(AVG(MIN(${X('ms')},60000))/1000,1) avg_s
                 FROM ev ${W} AND ev='quiz.a' GROUP BY t ORDER BY n DESC`,
    /* qid 而不是 id —— ev.id 是主键列，别名撞上去就变成「按行号分组」，
       每行自成一组，HAVING COUNT(*)>=3 于是永远筛空。 */
    hardDrills: `SELECT ${X('t')} t, ${X('m')} m, COALESCE(${X('id')}, ${X('a')}) qid, ${X('a')} a,
                        COUNT(*) n, ${WRONG} wrong, COUNT(DISTINCT dev) devs
                   FROM ev ${W} AND ev='drill.a' GROUP BY 1, 3
                   HAVING COUNT(*) >= 3 AND ${WRONG} > 0
                   ORDER BY (${WRONG}*1.0/COUNT(*)) DESC, n DESC LIMIT 50`,
    drillType: `SELECT ${X('t')} t, COUNT(*) n, ${WRONG} wrong,
                       ROUND(AVG(MIN(${X('ms')},180000))/1000,1) avg_s
                  FROM ev ${W} AND ev='drill.a' GROUP BY t ORDER BY n DESC`,
    susun: `SELECT ${X('a')} want, ${X('got')} got, COUNT(*) n
              FROM ev ${W} AND ev='drill.a' AND ${X('got')} IS NOT NULL
              GROUP BY want, got ORDER BY n DESC LIMIT 40`,
    rounds: `SELECT ev, COUNT(*) n FROM ev ${W}
               AND ev IN ('quiz.start','quiz.done','quiz.quit','quiz.resume',
                          'drill.start','drill.done','drill.quit','drill.resume')
               GROUP BY ev`,
    quits: `SELECT ev, ${X('i')} i, ${X('plan')} plan, ${X('n')} answered, COUNT(*) n
              FROM ev ${W} AND ev IN ('quiz.quit','drill.quit')
              GROUP BY ev, i, plan ORDER BY n DESC LIMIT 30`,
    scores: `SELECT ev, ROUND(AVG(${X('r')}*100.0/NULLIF(${X('n')},0))) pct,
                    ROUND(AVG(MIN(${X('ms')},3600000))/1000) avg_s, COUNT(*) n
               FROM ev ${W} AND ev IN ('quiz.done','drill.done') GROUP BY ev`,
    taps: `SELECT ${X('t')} t, ${X('kind')} kind, COUNT(*) n, COUNT(DISTINCT dev) devs
             FROM ev ${W} AND ev='say' GROUP BY t, kind ORDER BY n DESC LIMIT 50`,
    audioBad: `SELECT ev, ${X('t')} t, COUNT(*) n, COUNT(DISTINCT dev) devs
                 FROM ev ${W} AND ev IN ('say.miss','say.fail') GROUP BY ev, t ORDER BY n DESC LIMIT 40`,
    listen: `SELECT ${X('f')} f, ${X('act')} act, COUNT(*) n, ROUND(AVG(${X('at')})) avg_at
               FROM ev ${W} AND ev='listen' GROUP BY f, act ORDER BY f, act`,
    settings: `SELECT ${X('k')} k, ${X('v')} v, COUNT(*) n, COUNT(DISTINCT dev) devs
                 FROM ev ${W} AND ev='set' GROUP BY k, v ORDER BY k, n DESC`,
    errors: `SELECT ts, dev, ver, ${X('m')} m, ${X('f')} f, ${X('l')} l, ${X('s')} s, COUNT(*) n
               FROM ev ${W} AND ev='err' GROUP BY m, f, l ORDER BY ts DESC LIMIT 40`,
    mix: `SELECT ev, COUNT(*) n FROM ev ${W} GROUP BY ev ORDER BY n DESC`,
    recent: `SELECT ts, dev, ses, ev, page, d FROM ev ${W} ORDER BY id DESC LIMIT 120`,
  };

  const keys = Object.keys(queries);
  try {
    const res = await env.DB.batch(keys.map((k) => env.DB.prepare(queries[k])));
    const out = { days, tag: mode, now: Date.now() };
    keys.forEach((k, i) => { out[k] = (res[i] && res[i].results) || []; });
    return json(out);
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 500);
  }
}

function clampDays(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;         /* 0 = 全部 */
  return Math.min(400, Math.round(n));
}

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

function loginPage(why) {
  return `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rae's Study Note · 统计</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#faf8f4;color:#322f2b;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  @media (prefers-color-scheme:dark){body{background:#211f1c;color:#e8e4dc}}
  .box{max-width:22rem;padding:2rem;text-align:center}
  .t{font-size:1.05rem;margin-bottom:.5rem}
  .s{opacity:.65;font-size:.9rem}
  code{background:rgba(128,128,128,.15);padding:.1em .4em;border-radius:4px;font-size:.85em}
</style>
<div class="box"><div class="t">要口令才能看</div>
<div class="s">${esc(why)}<br><br>在网址后面加上 <code>?k=口令</code></div></div>`;
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* ============================================================
   统计页
   ------------------------------------------------------------
   一个自带样式的静态页，进来后拉一次 /lihat/data 把所有表画出来。
   照着 App 的「纸间」配色，手机上也能看 —— Rae 多半是在手机上开。
   ============================================================ */
const DASH = `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rae's Study Note · 使用情况</title>
<style>
:root{--bg:#faf8f4;--ink:#322f2b;--dim:#7d7568;--line:#e7e2d9;--card:#fff;--ac:#ad7683;--warn:#a8874e}
@media (prefers-color-scheme:dark){
  :root{--bg:#211f1c;--ink:#e8e4dc;--dim:#9a9284;--line:#3a3630;--card:#2a2724;--ac:#c9a0a9;--warn:#c9ac77}
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
  padding:1rem;padding-bottom:4rem}
h1{font-size:1.15rem;margin:.2rem 0 1rem;font-weight:600}
h2{font-size:.95rem;margin:2rem 0 .6rem;font-weight:600;letter-spacing:.02em}
h2 span{font-weight:400;color:var(--dim);font-size:.85em;margin-left:.4em}
.wrap{max-width:60rem;margin:0 auto}
.bar{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;margin-bottom:1rem}
button{font:inherit;font-size:.85rem;padding:.3rem .7rem;border:1px solid var(--line);
  background:var(--card);color:var(--ink);border-radius:10px;cursor:pointer}
button.on{border-color:var(--ac);color:var(--ac)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(7rem,1fr));gap:.5rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:.7rem .8rem}
.card b{display:block;font-size:1.5rem;font-weight:600;line-height:1.2}
.card i{font-style:normal;color:var(--dim);font-size:.78rem}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;
  background:var(--card);border:1px solid var(--line);border-radius:14px}
table{border-collapse:collapse;width:100%;font-size:.86rem}
th,td{text-align:left;padding:.42rem .6rem;white-space:nowrap;vertical-align:top}
th{color:var(--dim);font-weight:500;font-size:.78rem}
tr+tr td{border-top:1px solid var(--line)}
td.w{white-space:normal;min-width:11rem;max-width:22rem}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.hot{color:var(--ac);font-weight:600}
.mut{color:var(--dim)}
.empty{color:var(--dim);font-size:.86rem;padding:.6rem 0}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.8rem}
.msg{padding:2rem 0;color:var(--dim)}
.mini{height:.4rem;background:var(--line);border-radius:3px;overflow:hidden;min-width:3.5rem}
.mini i{display:block;height:100%;background:var(--ac)}
</style>
<div class="wrap">
<h1>Rae's Study Note · 使用情况</h1>
<div class="bar" id="bar"></div>
<div id="out"><div class="msg">读取中…</div></div>
</div>
<script>
var days = 30, tagMode = 'live', D = null;

function h(s){ return String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function pct(a,b){ return b ? Math.round(a*100/b) : 0; }
function secs(s){
  s = Math.round(s||0);
  if(s < 60) return s + '秒';
  if(s < 3600) return Math.floor(s/60) + '分' + (s%60 ? (s%60)+'秒' : '');
  return (s/3600).toFixed(1) + '小时';
}
function when(ts){
  if(!ts) return '—';
  var d = new Date(ts), p = function(n){ return (n<10?'0':'')+n; };
  return (d.getMonth()+1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function bar(){
  var b = document.getElementById('bar'), out = '';
  [[7,'近 7 天'],[30,'近 30 天'],[0,'全部']].forEach(function(x){
    out += '<button data-d="'+x[0]+'" class="'+(days===x[0]?'on':'')+'">'+x[1]+'</button>';
  });
  out += '<span style="flex:1"></span>';
  [['live','正式'],['test','试用'],['all','全部']].forEach(function(x){
    out += '<button data-t="'+x[0]+'" class="'+(tagMode===x[0]?'on':'')+'">'+x[1]+'</button>';
  });
  b.innerHTML = out;
  b.onclick = function(e){
    var t = e.target.closest ? e.target.closest('button') : null;
    if(!t) return;
    if(t.dataset.d != null) days = +t.dataset.d;
    if(t.dataset.t) tagMode = t.dataset.t;
    bar(); load();
  };
}

function load(){
  document.getElementById('out').innerHTML = '<div class="msg">读取中…</div>';
  fetch('/lihat/data?days=' + days + '&tag=' + tagMode, {credentials:'same-origin'})
    .then(function(r){ return r.json(); })
    .then(function(j){
      if(j.error){ document.getElementById('out').innerHTML = '<div class="msg">出错了：'+h(j.error)+'</div>'; return; }
      D = j; draw();
    })
    .catch(function(e){ document.getElementById('out').innerHTML = '<div class="msg">读不到数据：'+h(e)+'</div>'; });
}

/* rows: 数据；cols: [表头, 取值函数, 是否右对齐] */
function table(rows, cols, note){
  if(!rows || !rows.length) return '<div class="empty">' + (note || '这段时间没有数据') + '</div>';
  var s = '<div class="scroll"><table><tr>';
  cols.forEach(function(c){ s += '<th' + (c[2]?' class="num"':'') + '>' + h(c[0]) + '</th>'; });
  s += '</tr>';
  rows.forEach(function(r){
    s += '<tr>';
    cols.forEach(function(c){
      var v = c[1](r);
      s += '<td class="' + (c[2] ? 'num' : (c[3] || '')) + '">' + (v == null ? '<span class="mut">—</span>' : v) + '</td>';
    });
    s += '</tr>';
  });
  return s + '</table></div>';
}

function rate(wrong, n){
  var p = pct(wrong, n);
  return '<span class="' + (p >= 40 ? 'hot' : '') + '">' + p + '%</span>';
}

function draw(){
  var o = D.overview[0] || {}, s = '';
  var byEv = {};
  (D.rounds||[]).forEach(function(r){ byEv[r.ev] = r.n; });

  s += '<div class="cards">';
  s += card(o.devs, '设备');
  s += card(o.sess, '次打开');
  s += card(o.evs, '条记录');
  s += card((D.daily||[]).length, '个有人用的日子');
  s += card((byEv['quiz.start']||0) + (byEv['drill.start']||0), '轮练习');
  s += card((D.errors||[]).length, '类报错');
  s += '</div>';

  s += '<h2>每天<span>日惹时间</span></h2>' + table(D.daily, [
    ['日期', function(r){ return h(r.day); }],
    ['设备', function(r){ return r.devs; }, 1],
    ['打开', function(r){ return r.sess; }, 1],
    ['记录', function(r){ return r.evs; }, 1]
  ]);

  s += '<h2>语言<span>浏览器语言 → 实际用的界面语言</span></h2>' + table(D.langPair, [
    ['浏览器', function(r){ return h(r.blang); }],
    ['界面', function(r){ return h(r.ui); }],
    ['设备', function(r){ return r.devs; }, 1],
    ['打开', function(r){ return r.opens; }, 1]
  ]);

  s += '<h2>设备</h2>' + table(D.os, [
    ['系统', function(r){ return h(r.os); }],
    ['浏览器', function(r){ return h(r.br); }],
    ['台数', function(r){ return r.n; }, 1]
  ]);

  s += '<h2>每台设备<span>匿名编号</span></h2>' + table(D.devices, [
    ['编号', function(r){ return '<span class="mono">' + h(String(r.dev).slice(0,6)) + '</span>'; }],
    ['系统', function(r){ return h((r.os||'?') + ' ' + (r.osv||'')); }],
    ['浏览器', function(r){ return h((r.br||'?') + ' ' + (r.brv||'')); }],
    ['语言', function(r){ return h(r.blang); }],
    ['屏幕', function(r){ return h(r.scr); }],
    ['主屏', function(r){ return r.pwa ? '是' : '<span class="mut">否</span>'; }],
    ['国家', function(r){ return h(r.country); }],
    ['版本', function(r){ return h(r.ver); }],
    ['打开', function(r){ return r.sessions; }, 1],
    ['最近', function(r){ return h(when(r.last_ts)); }]
  ]);

  s += '<h2>看了哪些页<span>停留时间是每次平均，读到的深度是页面百分比</span></h2>';
  var pv = {};
  (D.pages||[]).forEach(function(r){ pv[r.k] = r; });
  var dw = (D.dwell||[]).map(function(r){
    var p = pv[r.k] || {};
    return {k:r.k, views:p.views||0, devs:p.devs||0, avg_s:r.avg_s, tot_s:r.tot_s, depth:r.depth};
  });
  s += table(dw, [
    ['页', function(r){ return '<span class="mono">' + h(r.k) + '</span>'; }],
    ['进入', function(r){ return r.views; }, 1],
    ['人', function(r){ return r.devs; }, 1],
    ['平均停留', function(r){ return h(secs(r.avg_s)); }, 1],
    ['合计', function(r){ return h(secs(r.tot_s)); }, 1],
    ['读到', function(r){ return (r.depth||0) + '%'; }, 1]
  ]);

  s += '<h2>怎么翻页的</h2>' + table(D.nav, [
    ['方式', function(r){ return h({next:'下一页',prev:'上一页',toc:'目录',key:'键盘',btn:'按钮',restore:'接着上次',first:'第一次打开',other:'其它'}[r.via] || r.via); }],
    ['次数', function(r){ return r.n; }, 1]
  ]);

  s += '<h2>最难的词<span>复习里错得最多的，至少做过 3 次</span></h2>' + table(D.hardWords, [
    ['词', function(r){ return '<b>' + h(r.w) + '</b>'; }],
    ['错', function(r){ return rate(r.wrong, r.n); }, 1],
    ['次', function(r){ return r.n; }, 1],
    ['人', function(r){ return r.devs; }, 1],
    ['平均用时', function(r){ return r.avg_s + 's'; }, 1]
  ]);

  s += '<h2>认错成什么<span>答错时选的那个选项</span></h2>' + table(D.confusion, [
    ['题目问的', function(r){ return h(r.w); }],
    ['选成了', function(r){ return '<span class="hot">' + h(r.pick) + '</span>'; }, 0, 'w'],
    ['次', function(r){ return r.n; }, 1]
  ]);

  s += '<h2>最难的实战题<span>至少做过 3 次</span></h2>' + table(D.hardDrills, [
    ['类型', function(r){ return h(r.t); }],
    ['题', function(r){ return h(r.qid); }, 0, 'w'],
    ['错', function(r){ return rate(r.wrong, r.n); }, 1],
    ['次', function(r){ return r.n; }, 1],
    ['人', function(r){ return r.devs; }, 1]
  ]);

  s += '<h2>各类练习</h2>' + table((D.quizType||[]).map(function(r){
      return {g:'复习 · ' + ({r:'看印尼语选释义',l:'听音选词',c:'看释义选印尼语',z:'填空'}[r.t] || r.t), n:r.n, wrong:r.wrong, avg_s:r.avg_s};
    }).concat((D.drillType||[]).map(function(r){
      return {g:'实战 · ' + ({situasi:'情景',dengar:'听辨',posesif:'领属',tunjuk:'指示词',benda:'看图认词',jam:'几点了',angka:'数字'}[r.t] || r.t), n:r.n, wrong:r.wrong, avg_s:r.avg_s};
    })), [
    ['题型', function(r){ return h(r.g); }],
    ['错', function(r){ return rate(r.wrong, r.n); }, 1],
    ['次', function(r){ return r.n; }, 1],
    ['平均用时', function(r){ return r.avg_s + 's'; }, 1]
  ]);

  s += '<h2>拼句拼错成什么</h2>' + table(D.susun, [
    ['正确', function(r){ return h(r.want); }, 0, 'w'],
    ['拼成了', function(r){ return '<span class="hot">' + h(r.got) + '</span>'; }, 0, 'w'],
    ['次', function(r){ return r.n; }, 1]
  ]);

  var sc = {};
  (D.scores||[]).forEach(function(r){ sc[r.ev] = r; });
  s += '<h2>做完还是放弃</h2>' + table([
    {g:'复习', st:byEv['quiz.start']||0, dn:byEv['quiz.done']||0, qt:byEv['quiz.quit']||0, rs:byEv['quiz.resume']||0, sc:sc['quiz.done']},
    {g:'实战', st:byEv['drill.start']||0, dn:byEv['drill.done']||0, qt:byEv['drill.quit']||0, rs:byEv['drill.resume']||0, sc:sc['drill.done']}
  ].filter(function(r){ return r.st || r.dn || r.qt; }), [
    ['', function(r){ return h(r.g); }],
    ['开始', function(r){ return r.st; }, 1],
    ['做完', function(r){ return r.dn; }, 1],
    ['完成率', function(r){ return r.st ? pct(r.dn, r.st) + '%' : '—'; }, 1],
    ['中途退出', function(r){ return r.qt; }, 1],
    ['中断后接着做', function(r){ return r.rs; }, 1],
    ['平均分', function(r){ return r.sc ? r.sc.pct + '%' : null; }, 1],
    ['平均一轮', function(r){ return r.sc ? h(secs(r.sc.avg_s)) : null; }, 1]
  ]);

  s += '<h2>在哪儿放弃的</h2>' + table(D.quits, [
    ['', function(r){ return r.ev === 'quiz.quit' ? '复习' : '实战'; }],
    ['第几题', function(r){ return (r.i + 1) + ' / ' + (r.plan || '?'); }, 1],
    ['进度', function(r){ return '<span class="mini"><i style="width:' + pct(r.i, r.plan || 1) + '%"></i></span>'; }],
    ['次', function(r){ return r.n; }, 1]
  ]);

  s += '<h2>点了哪些词句听<span>主动点出来听的，练习里自动读的不算</span></h2>' + table(D.taps, [
    ['文本', function(r){ return h(r.t); }, 0, 'w'],
    ['', function(r){ return r.kind === 'sent' ? '<span class="mut">整句</span>' : '<span class="mut">词</span>'; }],
    ['次', function(r){ return r.n; }, 1],
    ['人', function(r){ return r.devs; }, 1]
  ]);

  s += '<h2>教材听力</h2>' + table(D.listen, [
    ['音轨', function(r){ return h(r.f); }],
    ['', function(r){ return h({play:'开始播',resume:'接着播',pause:'按停',end:'听完了',fail:'放不出来'}[r.act] || r.act); }],
    ['次', function(r){ return r.n; }, 1],
    ['平均位置', function(r){ return h(secs(r.avg_at)); }, 1]
  ]);

  s += '<h2>设置改了什么</h2>' + table(D.settings, [
    ['项', function(r){ return h({lang:'界面语言',theme:'深浅色',accent:'配色',zoom:'字号',rate:'语速',mask:'遮盖答案'}[r.k] || r.k); }],
    ['改成', function(r){ return h(r.v); }],
    ['次', function(r){ return r.n; }, 1],
    ['人', function(r){ return r.devs; }, 1]
  ]);

  s += '<h2>音频出问题<span>没合成过 / 取不到，会退回系统语音，发音不准</span></h2>' + table(D.audioBad, [
    ['', function(r){ return r.ev === 'say.miss' ? '音库里没有' : '取不到文件'; }],
    ['文本', function(r){ return h(r.t); }, 0, 'w'],
    ['次', function(r){ return r.n; }, 1],
    ['人', function(r){ return r.devs; }, 1]
  ], '没有音频问题 —— 这是好事');

  s += '<h2>页面报错</h2>' + table(D.errors, [
    ['时间', function(r){ return h(when(r.ts)); }],
    ['版本', function(r){ return h(r.ver); }],
    ['信息', function(r){ return '<span class="mono">' + h(r.m) + '</span>'; }, 0, 'w'],
    ['位置', function(r){ return h((r.f || '') + (r.l ? ':' + r.l : '')); }],
    ['次', function(r){ return r.n; }, 1]
  ], '没有报错 —— 这是好事');

  s += '<h2>记录构成</h2>' + table(D.mix, [
    ['事件', function(r){ return '<span class="mono">' + h(r.ev) + '</span>'; }],
    ['条', function(r){ return r.n; }, 1]
  ]);

  s += '<h2>最近发生了什么<span>最新 120 条原始记录</span></h2>' + table(D.recent, [
    ['时间', function(r){ return h(when(r.ts)); }],
    ['设备', function(r){ return '<span class="mono">' + h(String(r.dev).slice(0,6)) + '</span>'; }],
    ['事件', function(r){ return '<span class="mono">' + h(r.ev) + '</span>'; }],
    ['页', function(r){ return '<span class="mono">' + h(r.page) + '</span>'; }],
    ['数据', function(r){ return '<span class="mono mut">' + h(r.d) + '</span>'; }, 0, 'w']
  ]);

  document.getElementById('out').innerHTML = s;
}

function card(n, label){
  return '<div class="card"><b>' + (n == null ? 0 : n) + '</b><i>' + label + '</i></div>';
}

bar(); load();
</scr` + `ipt>`;
