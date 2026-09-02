# PROGRESS · 进度日志

> **每次新会话先读这里，再动手。** 长期规则见 `CLAUDE.md`，
> 数据格式见 `.claude/skills/lesson/references/lesson-spec.md`。
> `KICKOFF.md` 描述的是 2026-08 之前的旧 App（Cindy 私教 13 课那版），
> **§3–§8 已作废**，只在追溯历史时看。

**当前状态：v1.5.0 在分支 `bab3-toc-dict` 上，音频 100%，等 Rae 看预览点头后上线（2026-09-02）。三课 45 页 + 总目录页，297 词。线上仍是 v1.4.0。**

> **2026-09-02 起 APK / 离线版永久停用（Rae 定的）。** 网站 `docs/` 是唯一产物，
> `dist/` 只是它的中间产物。`/apk` 技能、`scripts/apk.sh`、`prepare-assets.js`、
> 云端打包工作流都已删除；`android-app/` 留作归档不要动（里面的 `release.keystore`
> 是本机唯一一份）。下文凡是提到 APK 的历史段落，只当背景看。

> ⚠️ **App 已经上线，全班同学在用。任何改动未经 Rae 明确同意不得合并进 `main`** ——
> push main 会立刻重新发布 belajar.rae.work，等于直接改所有人正在用的版本。
> 改动一律在分支上做，本地预览给她看，她说「可以上线」才合。

---

## v1.5.0 做了什么（2026-09-02，分支 `bab3-toc-dict`，未上线）

面向学习者的说明在 `CHANGELOG.md`，下面只记工程上要知道的。

| | |
| --- | --- |
| 来源 | Rae 给的教材 PDF「Titian Bahasa Pemula 1 **Tata Bahasa**」（57 页）+ 三份课堂讲义 docx（BAB 1 Kata Ganti Orang / BAB 2 Frasa Posesif / BAB 3 Kalimat Sederhana）。**这份 PDF 只是语法分册**：每章只有目标页 + Tata Bahasa 节，Bab 3 的词汇页（课本第 24–33 页）不在里面 |
| 第三课 | `L03.json` 14 页：第 1 页概览、**第 2–8 页（大数、序数、星期、月份、日期年份、疑问词、对话）按课本目标补写，待对照课本**、第 9–13 页四种简单句（课本 + 讲义）、第 14 页练习。`source` 字段和第 1 页的绿色 note 都写明了哪几页是补的 |
| 课堂笔记 | 三页语法笔记插进旧课：L01 第 12 页 `Catatan Kelas · Kata Ganti Orang`（Tata Bahasa 后）、L02 第 6 页 `Ini Gedung, Gedung Ini`（Ini dan Itu 后）、L02 第 9 页 `Catatan Kelas · -nya`（Kata Ganti Milik 后）。**L01 变 21 页、L02 变 10 页** |
| 词汇 | +72（共 297）：L03 67 + 笔记页 5。星期日入库写成 `hari Minggu`（查重不分大小写，会和 `minggu` 撞） |
| 题库 | `situasi` +8（星期 / 日期 / 生日）、`tempat` +4 |
| 页面分类 | 每页 `phead` 新增必填字段 `cat`（7 种，名单在 `validate.js` 的 `PAGE_CATS`、顺序在 `engine.js` 的 `CAT_ORDER`、名字在 `ui.*.json` 的 `cat.*`）。眉标变成「Bab 2 · 语法」 |
| 目录 | 重写 `buildTOC()`：顶部搜索框（按四种语言的页名 + 分类名过滤，`filterTOC()`）、词汇表 / 复习 / 实战三个入口提到最上面、每课可折叠（只展开当前课，`markTOC()` 负责）、课内按分类分组、页名显示界面语言的 `sub`（印尼语 `title` 退成小字；`sub` 开头是分类名时自动去掉那截）。搜索没命中页时给一个「在词汇表里搜」的按钮，跳过去顺手填进搜索框 |
| 网上词典 | 并在词汇表搜索框里（`dictSync` / `dictLookup` / `dictRender`）。本地一个结果都没有 → 自动查；有结果 → 给一个「查网上词典」按钮。三个来源：Wiktionary REST（`/page/definition/`，取 `id` 节 → 词性 + 英文释义，查不到就去掉 -nya/-ku/-mu 再查）、MyMemory（界面语言译文）、印尼语维基百科跨语言链接（**只在 Wiktionary 说是名词时**用，名词最可靠）。发音走 `ttsOnly()` 系统语音。结果只在内存缓存 |
| 外部资源防线 | `lib/build.js` 新增 `ALLOWED_HOSTS`（三个域名），`assertOffline()` 先把它们替换掉再查。**这是全站唯一主动联网取数据的地方**（统计除外） |
| 总目录页 | `PAGES[0]` 是 `{home:true}`（`pageKey` = `home`，`HOME_INDEX = 0`）。`renderHome()` 用 `lessonOutline()` 列每课的分类和页数，分类芯片点了跳到那一类的第一页；有 `rsn.pos` 时给一条「接着上次读」。老用户被 `restorePos()` 带回原页，只有新用户和主动点「总目录」才看到它。页码分母改成 `REVIEW_INDEX - 1`、分子用 `cur`（第 0 页不计） |
| 抽屉结构 | `nav.toc` 改成 flex 列：`.toc-top`（搜索框 + 三个芯片，**不滚动、宽度固定**，`white-space:nowrap`）+ `.toc-scroll`（`scrollbar-gutter:stable`，出不出滚动条都不改宽）。折起来的课下面露一行分类摘要 `.toc-les-sum`（展开或搜索时隐藏） |
| 语音 | 已合成 320 条 / 5,655 字符（Rae 批准，2026-09-02），覆盖率 100%，本月累计约 27,100 / 40,000 |

**这一轮值得记的**

- **MyMemory 最靠前的一条常是垃圾。** `kucing` → zh-CN 第一条是「从印尼到中国的翻译」（quality 74，match 1），正确的「猫」排第二、quality 0。quality 字段不可信。现在只认 `segment` 恰好等于查询词的条目，过滤掉等于原文、带「翻译 / 翻訳 / translat / ngôn ngữ」字样、中日文里没有汉字假名的，再顺序取第一条。名词优先用维基百科跨语言链接（`kucing` → 中文条目「猫」）。
- **别对所有词用维基百科链接。** `kami` 在印尼语维基是日本的「神」。所以只在 Wiktionary 判定为名词时才用，并过滤带括号 / 消歧 / 曖昧 / định hướng 的标题。
- **`assertOffline` 的 fetch 正则会拦字符串字面量里的 `https://`。** 常量 `DICT_WIKI = "https://en.wiktionary.org/…"` 本身不匹配（它查的是 `fetch("https://`），但保险起见还是登记进 `ALLOWED_HOSTS`，将来有人写成 `fetch("https://…" + word)` 也不会被拦。
- **`.toc-quick a` 和 `.toc a` 特异性相同**，写在前面会被后面的 `.toc a` 覆盖（padding、左边框全丢）。要写成 `.toc .toc-quick a`。
- **词表是分批插入的**，`applyGlossFilter()` 在中间批次也会跑，那时 `gFillTimer` 恰好是 null。判断「本地真的没结果」要靠单独的 `gFillDone` 标志，不能看 `gFillTimer`。否则第一批 40 个词里没有就会去联网。
- **目录搜索的索引要四种语言都进去**（`tocIndex()`），切了语言也能搜到；分类名也进索引，搜「语法」能列出所有语法页。
- 插页之后 `rsn.pos` 存的 `"L1:12"` 会指到新插的那一页 —— 只是回到「附近」，不算坏。
- **L03 第 2–8 页是补写的**，拿到课本扫描件后要逐页核（尤其课本对日期读法、`ke berapa` 的处理）。第 1 页有一条绿色 note 对学习者说明了这一点，上线前 Rae 决定留不留。

---

## v1.4.0 做了什么（2026-09-02）

面向学习者的说明在 `CHANGELOG.md`，下面只记工程上要知道的。

| | |
| --- | --- |
| 内容 | 全部 1,203 个多语对象补上 `vi`（两课 + 词汇 + 题库 + 标题），界面文案 `ui.vi.json` 177 键 |
| 引擎 / 脚本 | `scripts/lib/content.js` 新增 `TRI_LANGS = ['zh','ja','en','vi']`，`isTri()` 按它判定；`validate.js` 的缺语言统计、`speakables.js` 的渗漏检查（英文、越南文各跑一遍）、`engine.js` 的词汇搜索索引都改成按语言列表走 |
| meta.json | `langs` / `required_langs` 加 `vi`，`lang_names.vi = Tiếng Việt`，`learner.vi = { negara: Vietnam, nama: Việt Nam, people: người Việt Nam }` |
| 语音 | 越南语界面的 `{NEGARA}` 句子新增 11 条 / 227 字符，已合成，覆盖率 100% |
| 顺手修 | 首次打开时 `<html lang>` 一直是构建时的 zh，现在跟检测到的语言走（日文用户首次打开也能拿到明朝体） |
| 停用 | APK / 离线版永久停用，相关脚本、技能、工作流已删，文档全部改成「网站是唯一产物」 |

**这一轮值得记的**

- **越南语不是中文直译，翻译说明写在 `CLAUDE.md` 内容规则里。** 印尼语和越南语同为
  「名词在前、领属在后」、都分 kami / kita（chúng tôi / chúng ta）、都有词首 ng、
  c 就是越南语的 ch、ny 就是 nh、é / è 对应 ê / e。中文版写「跟中文相反」「中文没有
  这个区分」的地方，越南语版都反过来写成「和越南语一样，你有优势」。ini / itu 的
  换位（问的人说 ini、答的人说 itu）对越南语使用者**仍然是坑**（越南语两边都说 đây），
  这一条保留了对比。
- **称呼统一**：Anda / kamu 一律 bạn（口语体靠句式和语体标签区分，不靠代词）；
  Bapak / Ibu 是 ông / bà；读者是 bạn；Bab 叫 bài；「笔误修正」标签统一 Sửa lỗi in；
  引号用 “ ”。七个并行翻译的子代理各自选词会漂，合并前用脚本扫了一遍
  （chương / ngữ vực / cậu / ông-bà / « »）再统一。
- **`ui.*.json` 里有数组**（`review.toasts` / `drill.toasts`）。按「点路径 → 字符串」
  展平再还原时数组会变成 `{0:…,1:…}` 对象，键集合校验立刻报「多出 10 个键」。
  还原脚本要认 `Array.isArray`。
- **`walkTri` 的判定是「恰好这几个键」。** 加语言时旧内容一个 `vi` 都没有，
  改了 `TRI_LANGS` 之后 `walkTri` 会一个对象都认不出来 —— 所以要先用旧的三键判定
  把内容抽出来翻译、回填，最后才切判定。顺序反了校验会显示「0 个对象」而不是报错。
- **JSON 回写不会重排**：五个内容文件都验证过 `JSON.stringify(parse(raw), null, 缩进) === raw`
  （L01 / L02 一空格，其余两空格），所以 diff 里只有新增的 `vi` 行。

---

## v1.3.0 做了什么（2026-08-27）

面向学习者的说明在 `CHANGELOG.md`，下面只记工程上要知道的。

| | |
| --- | --- |
| 来源 | **Kelas Berbicara（口语课）Pertemuan 1** 的 PDF 讲义（Mbak Novi，08-27）。讲的就是 Perkenalan，跟课本 Bab 1 是同一块内容 —— **Rae 定的：并进第一课，不另开一课** |
| 第一课 | 10 页 → **20 页**。新增页不是接在后面，是**插进原有顺序**：字母和发音放最前，数字放在「说年龄」之前，练习页跟在范文之后 |
| 新增页 | Abjad（字母名，`alpha`） / Bunyi Vokal / Bunyi Konsonan（`table` + `syll`） / Salam dan Kabar / Angka / Angka Puluhan（`numgrp` + `phones`） / Perkenalan Diri / Pekerjaan dan Hobi / Memperkenalkan Orang Lain / Latihan dan Wawancara |
| 词汇 | +78 词（共 225），全部 `les: 1` |
| 题库 | `situasi` +8，`tempat` +2，**`angka_pool` 第一次填上（40 个数，1–99）** |
| 语音 | 新合成 232 条 / 3,749 字符。字母名（be、ce、de…）旧音库里就有，这次只补了 `ve` |

**这一轮值得记的**

- **并课要改的不只是页数组。** 页面里凡是写「Bab 1 学过」「Bab 2 学过」的地方，
  并进去之后全是错的 —— 有的变成同一课（该说「前一页」），有的变成**前向引用**
  （`-nya` 是 Bab 2 教的，Bab 1 里不能写「Bab 2 学过」，要写「Bab 2 还会专门讲」）。
  一并要改的还有：课的 `name` / `source`、词条的 `note`、**多出来的 `reviewbtn`**
  （只留整课最后一页那个）。
- **「几点了」和「数字 / 价格」原来共用一个开关。** 引擎里两种题型都只看
  `ANGKA_POOL.length > 0`。这一课教了数字但没教钟点（`setengah` 是「到**下一个**
  钟点的一半」，课本还没讲到），照原样打开会冒出一种谁都没学过的题。
  现在 `jam` 多一道 `drills.jam_enabled !== false`，`drills.json` 里设成 `false`。
  **`src/engine.js` 的 `drAvail()` 和 `scripts/validate.js` 的题型探测要一起改**，
  少改一处，校验报的可用题型就和引擎对不上。教到钟点那一章把它删掉即可。
- **`0` 有两个读法，别塞进 `angka_pool`。** 引擎的 `numRead(0)` 返回 `kosong`，
  而课上教的是 `nol`（数学）/ `kosong`（念号码）。放进池子会出现「唯一正确答案
  却和课文写的不一样」。池子从 1 起。
- **`numgrp` 的 `ans:true` 不是「默认藏起来」**，只是给答案加 `.ans`，
  真正遮住要靠页眉那个眼睛按钮。第一版把 `glab` 写成「点开看答案」，
  实际打开是全露着的 —— 已改成「先自己说一遍」，并在旁边的 note 里说明眼睛按钮。
- **`alpha` 格子里 `"A a"` 会折行。** `.alpha` 是 `minmax(58px,1fr)` 的网格，
  M 和 W 在 375px 下被空格挤到第二行，那两行就比别的高一截。写成 `"Aa"` 就齐了。
- **表格的第一列是「标签列」**（`td:first-child` 被 CSS 调淡、缩小）。
  字母表那种「第一列才是主角」的表，看着会有点淡 —— 是设计如此，别去改 CSS。
- **别给裸字母 / 裸后缀加 `<s>`。** `<s>sy</s>`、`<s>kh</s>` 会生成 "sy"、"kh"
  两条毫无意义的音频；字母名（`be`、`ce`）本身是词，可以标。
- **`vocab.json` 是 2 空格，`lessons/*.json` 是 1 空格。** 用错了整个文件重排，
  diff 从几百行涨到几千行。写之前先看一眼原文件。
- **PDF 讲义要先装 poppler**（`brew install poppler`）。`pdftotext -layout`
  取正文，`pdftoppm -png` 出页面图 —— 表格的合并单元格只有看图才不会读错。

---

## v1.1.0 做了什么（2026-08-25 夜 → 08-26）

面向学习者的说明在 `CHANGELOG.md`，下面只记工程上要知道的。

| | |
| --- | --- |
| 记忆 | `STORE` 统一 localStorage；记住阅读位置（页标识 + 滚动）、练习记录（每词每题的对错）、以及**做到一半的练习会话**（复习和实战各一份存档） |
| 第二课 | `L02.json` 八页 + 75 词。对话和例句**仿写不照抄** —— 仓库和网站都是公开的 |
| 练习 | 实战页新增三类：领属（15 题）、指示词（8 题）、看图认词（20 个简笔画 SVG）。新交互「词块拼句」，每个错误选项预写了「为什么错」 |
| 版本 | `meta.json` 的 `app.version` 是唯一版本源；`CHANGELOG.md` 面向学习者写；页脚和设置里各有一个入口；`BUILD_DATE` 构建时注入（用本地日期，不是 UTC） |

**这一轮踩过的坑（改代码前值得看一眼）**

- **每一屏都必须有出口，不能只靠自动翻页。** 踩了两次：① 答对屏原来不给「继续」，
  而 `render()` 会把在途的音频回调作废 —— 切个语言就再也走不下去；
  ② 练习状态只活在内存里，手机浏览器回收页面后重新加载整轮消失，
  从用户看是「做到一半跳回设置页，也没给结果」。现在都存档了。
- **别让一个状态字段兼两种含义。** 拼句题借 `DR.pick === 1` 表示「拼对了」，
  和四选一的「选了第 2 项」撞车，键盘按「2」会画面显示答对、计分算答错。
- **每加一种题型原语，必须同步加一关校验。** `validate` 的压测原来只懂四选一。
- **手写题的干扰项不要进音频清单** —— 是故意写错的句子，合成了也永远听不到。
- **错题优先不能写成「有错题就只出错题」**，否则答错一道之后连着二十题都是它。
- **大小写回退要四处同步**：`engine.js` 的 `audioHash`、`validate.js`、`tts.js`、
  **`lib/bundle.js`**（漏了这处，发布时被拦下）。逐词点读时句首那个词是大写的，
  跟词条的小写是两条音频，回退查一次小写能省掉一半合成量。
- **表格和横线**这两条已经升格成长期规则，写进 `CLAUDE.md` 的「界面规矩」了 ——
  表格不许让人左右拖；横线能不画就不画、绝不出现两条挨着。改 UI 前先看那一节。
- **`pattern` 块的 `code` 必须是纯印尼语**，写中文会被英文界面的渗漏检查拦下。
- **`phead.title` 会进朗读清单**，别放 `-ku` 这种裸后缀；同理不要用 `<s>` 标注后缀。
- **写内容脚本注意缩进**：`L01.json` 是 1 空格，用 `null,2` 会把整个文件重排，
  diff 从几十行涨到几千行，真正改了什么反而看不见。

没做完的事在文末「待办 / 待确认」。

---

## 使用情况收集（v1.2.0 加的，只在网站版）

同学在用了，需要知道大家卡在哪。**只有 `docs/` 那一份带收集代码**；
中间产物 `dist/` 里一个字节都没有，`assertOffline()` 因此完全没被触到。

**三层结构**

| | |
| --- | --- |
| `src/engine.js` 顶部 `TRK()` | 只负责「报告刚才发生了什么」。外面没人接管时空转，最多攒 40 条 |
| `src/site-telemetry.js` | 收集脚本。**只由 `scripts/site.js` 内联进 `docs/`**，接管 `window.__RSN_TRACK` 并把开机那几条领走 |
| `worker/` | Cloudflare Worker + D1。收数据 + 带口令的统计页。部署见 `worker/README.md` |

**为什么这么分层**：引擎是 `dist/` 和 `docs/` 共用的，收集代码写进去 `dist/` 也会带上；
而 `assertOffline()` 见到外部地址会直接让构建失败。所以引擎里只留一个
空转的出口，真正联网的部分只在网站那一份里出现。

**记了些什么**：`open`（版本 / 界面语言 / 主题 / 配色）、`page` + `dwell`
（哪一页、多久、读到多深、怎么翻过去的）、`quiz.a` / `drill.a`（词或题号、
对错、**答错时选的那个干扰项**、拼句题**实际拼出来的句子**、用时）、
`quiz.done` / `quit` / `resume`、`say`（主动点读的词句）、`listen`、`set`、
`prog.clear`、`err`（页面报错）、`say.miss` / `say.fail`（音频缺失或取不到）。
设备侧另存浏览器语言、系统 / 浏览器、屏幕、时区、国家、是否加了主屏幕。

**这一轮踩过的坑**

- **SQL 别名不能跟真实列名撞车。** `ev` 表有 `d`（事件 JSON）和 `id`（主键）
  两列；统计查询里写 `... AS d ... GROUP BY d` 会绑到**表的列**上，
  于是「每天」被按事件内容拆成几十行；`GROUP BY id` 更糟 —— 每行自成一组，
  `HAVING COUNT(*)>=3` 把「最难的实战题」永远筛成空表，看起来像没数据。
  现在别名改成 `day` / `qid`，并统一用 `GROUP BY 1,3` 这种序号写法。
- **可见区尺寸要留「最后一次量到的有效值」。** 脚本刚跑起来时页面还没排版、
  `pagehide` 时布局已经在拆，两头都会量到 0 —— 而这两个时刻恰好就是要
  发数据的时刻。现在 `sampleVP()` 在 load / resize / 发送前各量一次，只收非零值。
- **一轮练习「做完了」必须挂在状态切换那一刻**（`qzShow` / `drShow` 里
  `phase` 从 `q` 变 `done` 的那一次），不能挂在结果页的渲染函数上 ——
  结果页每点一下都重渲染，那样一轮会报出好几次。
- **翻页不能挂 `render()`。** 切语言和清除学习记录也会重渲染，
  会凭空多出一堆「翻页」。挂 `go()` 和 `pageKey` 的变化。
- **拼句拼错时拼成了什么，只活在 `susunCheck` 的局部变量里**，
  `drillSettle` 拿不到 —— 给它加了个可选的第三个参数专门传这个。
  这条恰恰是最能看出卡在哪的数据。
- **键盘答题绕过点击派发器。** 埋点要挂在 `quizAnswer` / `drillAnswer` /
  `susunCheck` 这些函数上，挂在 `quizAction` / `drillAction` 上会漏掉键盘用户。
- **收集脚本里绝不能出现字面量 `</script>`** —— 内联时会把页面就地截断。
  `site.js` 会检查一遍。
- **占位符要写成字符串字面量**（`"__ENDPOINT__"` 而不是 `{{ENDPOINT}}`）——
  校验第 6 关会对 `src/` 下每个 `.js` 跑 `node --check`，模板语法过不去。

**试用数据是分开的**：`npm run site -- --tag test` 生成的那一份数据带 `test`
标记，统计页默认不显示。自己在手机上翻来翻去的时候用它，别混进正式统计。

## 这个 App 是什么

UGM INCULS《Titian Bahasa Pemula 1》的配套学习网站。四语界面
（中文 / 日本語 / English / Tiếng Việt），印尼语点读音频全部由 ElevenLabs 合成。

- 名字 **Rae's Study Note**
- 唯一产物是网站 `docs/`；`dist/rae-study-notes.html` 是它的中间产物（本地预览用）
- 内容：**Bab 1 Perkenalan** 20 页（课本 Bab 1 + 口语课 Pertemuan 1）+ **Bab 2 Kelas INCULS** 8 页 · 225 词
- 实战题：情景 26 / 地点 10 / 领属 15 / 指示词 8 / 看图认词 20 / 数字池 40（时间题仍关着）
- 音频 1079/1079（100%），音库 2743 条（含旧内容留下的，只增不减），教材听力音轨 1 条
- 额度：ElevenLabs starter 40,000 字符/月，v1.5.0 之后本月累计用掉约 27,100

## 线上

| | |
| --- | --- |
| 网站 | **https://belajar.rae.work** |
| 仓库 | https://github.com/rae-work/rae-study-notes（**公开**） |
| 发布 | GitHub Pages 从 `main` 的 `/docs` 目录 |
| DNS | Cloudflare，`belajar` CNAME → `rae-work.github.io`，**灰云** |
| 统计 | Cloudflare Web Analytics（只注入 `docs/`） |
| 使用情况 | Worker `catatan` + D1 `rsn-data`。收数据 `https://catatan.zirui-mail.workers.dev/n`，看统计 `/lihat?k=口令`（口令只在 Cloudflare Secret `VIEW_KEY` 里，本机和仓库都没有） |

**更新网站：**

```bash
npm run validate && npm run build && npm run site
git add -A && git commit -m "更新网站" && git push
```

约一分钟生效。`docs/CNAME` 由 `site.js` 自动保留，不用每次带 `--domain`。

## 下一步

- [ ] **v1.5.0 收尾**：语音已合成、覆盖率 100%。Rae 看预览点头 → `npm run site` → 合进 main → push。
- [ ] **课本 Bab 3 词汇页（第 24–33 页）**：拿到扫描件后逐页对照 L03 第 2–8 页。
- [ ] Bab 4 起：Rae 拍照放 `inbox/`，走 `/lesson`。
      ⚠️ 口语课（Kelas Berbicara）的讲义按**内容**归课，不按次数 ——
      Pertemuan 1 讲的是 Perkenalan，就并进 Bab 1。

细节和其余待办见文末「待办 / 待确认」。

---

## ⚠️ 已知的坑（改代码前先看这一节）

**红线**

- **`history-archive-private` 分支永远不能 push。** 本机保留的开源前完整
  历史，里面有旧签名密钥。公开仓库用的是重建过的干净历史。push 前确认
  自己在 `main` 上。
- **Cloudflare 那条 DNS 记录必须保持灰云。** 改橙云 → Let's Encrypt 的
  HTTP-01 挑战打不到 GitHub → 证书续期失败 → 三个月后网站报安全警告。
- **`android-app/` 不要动。** APK 已永久停用，目录只是归档；里面的
  `release.keystore` 已 gitignore、只存在本机，留着不碍事，删了就没了。
- **仓库是公开的。** push 等于对外发布代码 + 更新线上网站，两件事一起发生。

**外部资源防线（原来叫离线约束）**

- 离线版已停用，但 `assertOffline()`（`scripts/lib/build.js`）还在：拦 `dist/`
  里的外部资源，`docs/` 例外（多一段统计脚本）。现在它只是「别不小心引外部
  资源」的保险，真要放开（比如 web font）先问 Rae。
- **`@font-face` 无条件拦截**，base64 内嵌也不行 —— 字体只能用系统栈。
- **`<a href="https://…">` 放行**（超链接不加载东西）。
  页脚的 GitHub 链接靠这条。`<link href>` / `src` / `action` 仍一律拦。

**引擎**

- **页眉里 22 个元素 id 一个都不能删。** 按钮已改成 null 安全的 `on()`，
  但 `#brandZh` `#maskTxt` `#bannerTxt` `#counter` `#prevBtn` `#nextBtn`
  仍是裸 `getElementById`，删了整页白屏。`validate` 查不出来，改完必须
  在浏览器里打开看控制台。
- **逐词点读复用 `bundleAudio` 这一个 `<audio>`，不要再 `new Audio()`**
  （iOS 对同时存在的媒体元素有数量上限，越用越卡）。教材听力 `lisAudio`
  和录音回放各有自己的元素，那两处是对的，别去「修」。
- `breakable()` 给斜杠和破折号后插 `<wbr>`，长词才不会从中间劈开。
  改排版时别把它洗掉。
- 点词会先 `pauseListen()` 暂停教材听力（保留进度），读完可续播。
- 卡片词头带 `cardword` 类，点它由点击委托改派给整张卡（避免两层高亮）。

**内容**

- 改任何 `data-say` 文本（多一个空格都算）会立刻掉音频覆盖率，要重跑 tts。
- 整句朗读用 `sayText()`（保 `? ! . ,`），逐词点读才用 `clean()`。
- 界面文案一律走 `T()`，键要同时加进 `ui.zh/ja/en/vi.json` 四个文件，
  **键集合必须完全一致**。渗漏检查**只查中日文**，写死的英文和属性里的
  中文都查不出来。
- **音频不内联**，按相对路径 `audio/<哈希>.m4a` 取。托管必须带 `docs/audio/`。
- `eleven_multilingual_v2` **不接受** `language_code`。
- 中文 / 日文句内引号用「」。

**校验**

- **第 9 关（音频覆盖率）只是警告**，缺音频照样「✅ 全部通过」、照样能 build。
  真正拦下的是 `npm run site`（`lib/bundle.js` 的
  `assertNoMissing()` → exit 1）。发版前自己确认那行是 100%。
- 第 8 关「四种题型都出到」也是条件警告：`angka_pool` 为空时
  `jam`/`angka` 不出题是正常的。

---

## 命令

```bash
npm run validate         # 九道关（--quick 跳 7–9 关，--allow-todo 多语不齐降级为警告）
npm run build            # → dist/rae-study-notes.html
npm run preview          # 本地 + 局域网地址，手机能开（伺服 dist/；端口被占时 npm run preview -- 8788）
npm run preview -- --site    # 改伺服 docs/ —— 只有这一份带统计和使用情况收集
npm run site             # → docs/（网站：HTML + 音频 + CNAME + 统计 + 使用情况收集）
npm run site -- --tag test   # 同上，但数据标成「试用」，统计页默认不显示
npm run tts              # 增量合成语音（--dry 只报计划，--limit N 试音，--yes 跳过确认）
```

⚠️ node / ffmpeg / git / gh 在 `/opt/homebrew/bin`，不在默认 PATH 里。
脚本已自己加上，**手动敲命令时要带 `PATH=/opt/homebrew/bin:$PATH`**。

## 目录职责

| 目录 | 是什么 | 进仓库？ |
| --- | --- | --- |
| `content/` | 唯一内容来源：课程 / 词汇 / 题库 / 界面文案 / 配置 | ✅ |
| `src/` | `template.html` + `app.css` + `engine.js` + `site-telemetry.js`（**只进 `docs/`**） | ✅ |
| `worker/` | 收使用情况数据的 Cloudflare Worker + D1 表结构 + 统计页 | ✅（除登录凭证） |
| `scripts/` | 校验 / 构建 / 网站 / 语音 / 预览 | ✅ |
| `audio/` | 语音库（按朗读文本哈希命名，只增不减的缓存） | ✅ |
| `docs/` | **网站产物**，Pages 从这里发布 | ✅ **但不许手改** |
| `dist/` | 中间产物（网站从它生成） | ❌ |
| `android-app/` | 旧 WebView 外壳，**归档不用、不要动** | ✅（除密钥） |
| `inbox/` | Rae 放原始照片 / PDF 的地方 | ❌ |
| `legacy/` | 旧 App 归档 | ❌ |

---

## 设计规范（2026-08-25 定稿）

「纸间」风格 —— 目标是电子书的阅读感，不是 App 的控件感。

- 底色微灰暖白 `#faf8f4`（深色 `#211f1c`），墨色 `#322f2b`，细线 `#e7e2d9`
- **强调色五套，全部低饱和**，`<html data-accent>` 切换：

  | key | 名字 | 浅色 | 深色 |
  | --- | --- | --- | --- |
  | `rose` | 藕粉（默认） | `#ad7683` | `#c9a0a9` |
  | `blue` | 雾蓝 | `#6e8399` | `#9db2c6` |
  | `ochre` | 赭黄 | `#a8874e` | `#c9ac77` |
  | `sage` | 灰绿 | `#6f8a73` | `#9db8a1` |
  | `mauve` | 藕紫 | `#82769b` | `#b0a4c6` |

  每套五个变量 `--accent` / `--accent-ink` / `--accent-wash` /
  `--accent-line` / `--on-accent`。**配色和明暗是正交的两个维度**，
  加新配色要改四处：浅色、媒体查询深色、手动深色、`.sw-*` 色点。
- **字体分工（踩过坑，规则要严）**：阅读区 `.sheet` 里**只有
  `button` / `input` / `select` 用无衬线**，其余一律衬线；页眉、目录抽屉、
  设置弹层整体无衬线。
  ⚠️ 给带中日文的内容元素加 `var(--ui)` 之前先停一下 —— iOS 上 `--ui` 是
  PingFang（黑体）、`--serif` 是 Songti（宋体），两种中文字形挨在一起
  极其刺眼。安卓通常没有中文衬线，正文中文会退到黑体，已知限制。
- **圆角三档** `--r-sm:10` 控件 / `--r-md:14` 卡片和表格 / `--r-lg:18` 弹层。
  表格必须 `border-collapse:separate`，collapse 下 `overflow` 裁不出圆角。
- **动效三档** `--t-fast:.18s` 悬停 / `--t-mid:.26s` 卡片按钮 /
  `--t-slow:.34s` 抽屉弹层 / `--t-page:.2s` 翻页。缓动统一
  `cubic-bezier(.4,0,.2,1)`；`prefers-reduced-motion` 一键关停。
- iPhone 安全区 `env(safe-area-inset-*)`：页眉、正文、目录抽屉都处理了，
  新增贴边元素要一起加。

设计稿：https://claude.ai/code/artifact/6a9d12b9-c48e-4f42-8bf8-38ceec047df8

## 页眉与结构

- **页眉浮动，不占版面**（`position:fixed` + `.reader` 的 `padding-top` 让位）。
  往下读收起、往回滚出来；顶部 90px 内、翻页后、抽屉或设置展开时一定显示。
  高度不写死 —— `syncHeaderH()` 实测后写进 `--hdr-h`，收放、切语言、
  提示条显隐、转屏都会重量。
- 页眉只有三个按钮：**目录、遮盖答案、设置**。
- **目录在所有尺寸都是抽屉。** 原来宽屏是常驻侧栏，导致侧栏和正文各有
  一条滚动条，页面上同时两条。
- 词汇表 / 复习 / 实战走目录抽屉（那三页本来就在 `PAGES` 里）。
- 设置弹层：语言 / 主题 / **配色** / 语速 / 字号 / **学习记录** / **版本与更新记录**。
  「语音来源」默认隐藏（音频 100% 是合成的，系统语音永远轮不到）。
  面板会限高 + 内部滚动 —— 横屏和大字号下它会顶出屏幕，而最底下那两组
  正好是新加的。
- **页脚 `.site-foot`**：项目名 + 版本（链到 CHANGELOG）、源代码和更新记录两个链接、
  最后更新日期、反馈方式、许可与内容出处、作者、隐私说明。**是正式声明的口气**，
  不要写成「Rae 做的，用 Claude 写的」那样。五个构建占位符：
  `{{APP_NAME}}` / `{{BUILD_VERSION}}` / `{{BUILD_DATE}}` / `{{REPO_URL}}` /
  `{{CHANGELOG_URL}}`。隐私那行只在 http(s) 下显示（本地 `file://` 打开时没有统计）。

## 例句本地化

例句里「学习者自己」的国籍跟着界面语言走 —— 日本同学看到的是
「Saya dari Jepang / 日本から来ました」。

- 内容写占位符，渲染时由 `engine.js` 的 `LZ()` 替换：
  `{NEGARA}` → 印尼语国名（**进朗读文本，每种语言都要有音频**）、
  `{NAMA}` → 该语言国名、`{PEOPLE}` → 该语言的「某国人」
- 映射表在 `meta.json` 的 `learner`：zh→Cina / ja→Jepang / en→Inggris。
  **改了必须跑 `npm run tts` 补新句子的音频**
- **只用于第一人称。** 讲 Sanggi、Ziah 这些课本人物的例句不动
- ⚠️ `speakables.js` 因此**每种界面语言各收一遍**朗读文本。只收默认语言的话，
  日文界面的句子永远不进清单，发版才发现缺音频

## 存储与记忆（v1.1.0 加的）

全部走 `engine.js` 里的 `STORE`，写不进去（隐私模式、配额满）一律静默降级，
功能照常、只是记不住。**界面上任何地方都不许拿它当前提。**

| 键 | 存什么 | 什么时候清 |
| --- | --- | --- |
| `lang` `theme` `accent` | 老三样，**裸键名不能改** —— 线上已有用户存过 | 不清 |
| `rsn.pos` | 上次读到哪一页 + 滚动位置 | 不清 |
| `rsn.prog` | 每个词 / 每道题的 `[对, 错, 最近一天]` | 用户手动清 |
| `rsn.quiz` `rsn.drill` | 做到一半的练习会话 | 一轮结束或回设置页 |

- **页位置存的是 `"L1:3"` 这种跟内容绑定的标识，不是数组下标** ——
  加课之后下标会指向别的页。认不出的标识就从第一页开始。
- **练习会话必须存。** 手机浏览器内存吃紧会回收后台页面，切走再回来就是一次
  重新加载 —— 不存的话整轮凭空消失，从用户看是「做到一半跳回设置页，也没给结果」。
  复习页存词表（约 385 字节），实战页存整道题（纯数据，恢复后连选项顺序都一样，
  约 5KB）。超过 `SESS_MAX`（120KB）或写失败就放弃存档，退回原来的行为。
- **进度记录分两类**：词汇用词本身当键，手写的语法题用 `"q:题号"`。
  设置里分开显示（「12 个词 · 8 道题」）—— 混着数的话跟词汇表的墨点对不上。
- ⚠️ **iOS Safari 直接开网页时，连续 7 个「使用日」没访问就会被系统清掉存储**
  （加到主屏幕的不会）。设置里对着 iPhone 且未加主屏幕的用户会显示一行提示。

## 音频性能

- **进页面预取**：把本页 clip fetch 成 blob 存内存，点词零网络等待
  （线上实测 335ms → 5ms）。只在 http(s) 下预取，`file://` 下跳过。
  缓存上限 240 条先进先出，换页丢掉上一页没取完的队列。
- 播放复用同一个 `<audio>`（见「已知的坑」）。
- 单条加载失败只退回系统语音；只有**网络源**失败才全局关掉内置音库。

---

## 已完成（归档）

- **基础设施**：validate 九关（含英文 / 越南文渗漏检查）、build（含外部资源自检）、
  site（网站）、`lib/bundle.js`（网站用的音频裁剪）、preview / tts、
  `.claude/skills/lesson` 技能（`/apk` 技能已随 APK 停用一起删除）
- **语音**：Yetty `Lpe7uP03WRpCk9XkpFnf`，AAC 64k / 32 kHz 单声道，
  starter 档 40,000 字符/月
- **签名（两轮踩坑）**：① 原来写的是 `signingConfigs.debug`，每次构建换
  密钥；② 开源前密钥和口令都在仓库里 → 现在四个 GitHub Secret
  （`KEYSTORE_BASE64` / `KEYSTORE_PASSWORD` / `KEY_ALIAS` / `KEY_PASSWORD`），
  仓库里一个都没有
- **开源上线**：干净历史的公开仓库、GitHub Pages、自定义域名 + HTTPS、
  访问统计、README / LICENSE
- **UI 改版**：纸间风格、五套配色、深浅色、浮动页眉、页脚、音频预取、
  例句本地化
- **v1.1.0（2026-08-26 上线）**：记忆功能（阅读位置 / 练习记录 / 会话存档）、
  第二课八页 + 75 词、三类新练习（领属 / 指示词 / 看图认词）、词块拼句交互、
  EF 级反馈（每个错误选项一句「为什么错」）、20 个简笔画 SVG、
  版本管理（CHANGELOG + 页脚版本链接 + 最后更新日期）、
  表格改手机优先、清掉全部多余横线。修掉的大问题见上面「这一轮踩过的坑」。

## 待办 / 待确认

1. **「数字 / 价格」已经打开**（`angka_pool` 40 个数，1–99）。
   **「几点了」还关着** —— `drills.json` 的 `jam_enabled: false`。
   等课本教到钟点（`setengah` 的说法）再把那一行删掉，题型会自动出现。
   往 `angka_pool` 加数时注意：**非空时至少 20 个**，别放 `0`（读法有两个）。
2. **`alt` 字段（另一语体的整句）现在全库 116 处都是 `null`** —— 语体切换功能
   没做，所以也没浪费额度。`speakables.js` 会把有值的 alt 收进音频清单，
   新课要不要写 alt 先问 Rae（写了就要花钱合成界面上暂时看不到的句子）。
3. **中文衬线在安卓上退到黑体** —— 系统没有中文宋体，`assertOffline` 又拦
   web font。离线版已经不做了，要不要放开 web font 是个可以重新问 Rae 的问题。
4. **课本 Bab 2 的听力题和成组的 Latihan 还没做。** 听力音频挂在 ugm.id 的
   外链上，当时的离线约束不能内嵌（现在只剩版权问题）；Latihan 是整页的练习题，照搬进公开仓库不合适
   （Rae 定的是仿写）。要做的话得想个别的形式。
5. **还差三处跟课本对齐的修改需要新音频**：`Sanggi dari mana?`（课本用同一个
   主语演示疑问词能放句首也能放句尾，App 现在写成了 `Anda dari mana?`，
   对照就没了）、听力词表缺的 `selamat pagi`。
6. ~~APK~~ —— 2026-09-02 永久停用，不再是待办。
