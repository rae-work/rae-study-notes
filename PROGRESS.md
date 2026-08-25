# PROGRESS · 进度日志

> **每次新会话先读这里，再动手。** 长期规则见 `CLAUDE.md`，
> 数据格式见 `.claude/skills/lesson/references/lesson-spec.md`。
> `KICKOFF.md` 描述的是 2026-08 之前的旧 App（Cindy 私教 13 课那版），
> **§3–§8 已作废**，只在追溯历史时看。

**当前状态：线上是 `main`（Bab 1）。`feat/latihan-v2` 分支上有一批改动等 Rae 试用后决定合不合。**

> ⚠️ **App 已经上线，全班同学在用。任何改动未经 Rae 明确同意不得合并进 `main`** ——
> push main 会立刻重新发布 belajar.rae.work，等于直接改所有人正在用的版本。
> 改动一律在分支上做，本地预览给她看，她说「可以上线」才合。

---

## 🔬 进行中：`feat/latihan-v2`（2026-08-25 夜）

Rae 批了六项决定之后做的，**尚未合并**。手机预览：`npm run preview` → 局域网地址。

**做了什么**

| | |
| --- | --- |
| 记忆 | 记住上次读到哪一页 + 滚动位置；练习记录（每个词/题的对错次数，错题下次优先出）；词汇表上的掌握度墨点；设置里能看记录量、能清除 |
| 修 bug | 答对后音频没播完就翻页（复习页和实战页都写死了 950/1000ms）；**连错降档从来没生效过**（题目开局一次性生成，自适应逻辑看不到答题结果） |
| 本地化 | 占位符解析移进 `clean()/sayText()/sayLine()/sayWhole()` 四个入口 —— examples 块漏了那一层，日文界面显示的是「わたしは中国人です」；日文中文腔 60+ 处；英文两处语法塌陷 |
| 对课本 | Kosakata 补 Perkenalan / Perjumpaan 两组（Selamat datang 原来被归在「告别」下）；对话补最后一句 + 笔误 note；代词表顺序和表注 |
| 语气 | 删掉「开学第一天全班都要站起来说一遍」这类对课堂的预言；「一定会踩」「建议每天」「老师问」「Wkwk」 |
| 试玩包 | 实战页加三类题：领属 -ku/-mu/-nya（15 题）、指示词 ini/itu（8 题）、看图认词（20 个简笔画）。新交互「词块拼句」，每个错误选项都预写了「为什么错」 |
| Bab 2 | `L02.json` 八页：这一章学什么 / 身边的东西（20 词分三组）/ 进教室（对话）/ 课堂用语 / ini 和 itu / 谁的 / 我的你的他的 / 印尼人的物件。词汇 75 个 |
| 表格 | 全部改成手机优先 —— 原来 CSS 写死 `min-width:460px`，每张表都要横向拖。空单元格渲染成 rowspan 真合并 |
| 页脚 | 改成正式声明（原来写着「Rae 做的，用 Claude Code 写的」），加版本号链接、更新记录（`CHANGELOG.md`）、最后更新日期 |

**等 Rae 决定**

- **Bab 2 的音频还差 145 条（1933 字符，约剩余额度的 9%）。** 第一批 78 条
  （Bab 2 词汇 + 练习题答案）Rae 已经批准并跑完了；这 145 条是补齐八页课文之后
  新增的。内容还没经她过目，先不合成 —— 要返工就白花了。
  **不补的话 `npm run site` 和 `npm run apk` 会被拦**（`assertNoMissing()`），
  本地预览和 build 不受影响。
  ⚠️ 安卓的 TTS 桥接（`MainActivity.java:102`）在没装印尼语语音包时静默 return、
  从不回调，于是答对之后要等满 `AUTO_MAX_HOLD`（8 秒）才自动翻页 ——
  好在现在每屏都有「继续」，用户可以自己走。
- 还有几处与课本对齐的修改需要新音频，没做：`Sanggi dari mana?`（课本用同一个主语
  演示疑问词前后位置，App 改成了 `Anda dari mana?`，对照就没了）、听力词表缺的
  `selamat pagi`、drills 里的人名 `Sarah` 换成课本的 `Rama`。

**这一版新踩的坑**

- **每加一种题型原语，必须同步加一关校验。** `validate` 的实战压测原来只懂四选一，
  拼句题一进来就报「选项不是 4 个」。现在拼句题查的是「词块拼不拼得出答案」——
  拼不出就是死题，学习者怎么点都过不去。
- **手写题的干扰项不要进音频清单。** 干扰项是故意写错的句子（`saya buku`、
  `Apa ini kamu?`），合成它们既费额度又永远听不到。这一条把待合成从 58 条压到 24 条。
- **错题优先不能写成「有错题就只出错题」。** 第一版这么写，答错一道之后连着二十题
  都是它。改成掷骰子加权（错题 40%），实测 40 题能出全 15 道。
- **写内容修正脚本时注意缩进。** `L01.json` 原本是 1 空格缩进，用
  `JSON.stringify(...,null,2)` 会把整个文件重排，diff 从几十行涨到几千行。
- **往设置面板加东西要想到面板会顶出屏幕。** 横屏或字号调大时底部会被切掉，
  而新加的「学习记录」正好在最底下。现已限高 + 内部滚动。
- **每一屏都必须有出口，不能只靠自动翻页。** 答对屏原来只等音频播完自动走，
  而 `render()` 会把在途回调作废 —— 答对后切个语言、点一下目录，整轮就再也走不下去，
  网页版只能刷新，APK 连刷新都没有。复习页和实战页当时都中。
- **别让一个状态字段兼两种含义。** 拼句题借 `DR.pick === 1` 表示「拼对了」，
  正好和四选一的「选了第 2 项」撞车，于是键盘按「2」会画面显示答对、计分算答错。
- **sticky 按钮会盖住它下面的内容。** 「检查」落到屏幕外，第一反应是 `position:sticky`，
  结果它浮在词块上把字挡住，比原来更糟。改成拼词时把按钮滚进视野。
- **词块的大小写会泄题。** 句首词大写、干扰项小写，一眼就看出哪个是第一个词，
  顺带把唯一要动脑的地方（语序）排除了。
- **日文提示不能直译中文。** 「我朋友的包」译成「友だちのかばん」少了「わたしの」，
  日本同学照提示拼出的是另一句合乎语法的话，却被判错。
- **逐词点读时句首那个词是大写的**，跟词条的小写是两条音频。查表回退一次小写，
  能省掉一半的合成量（85 条 → 78 条）。
- **每一屏都必须有出口**（第二次踩）：练习状态只活在内存里，手机浏览器回收页面
  之后重新加载就整轮消失 —— 从用户看是「做到一半跳回设置页，也没给结果」。
  现在复习和实战都存档，随时能接着做。
- **`pattern` 块的 `code` 必须是纯印尼语**，写中文会被英文界面的渗漏检查拦下。
- **`phead` 的 `title` 会进朗读清单** —— 标题里别放 `-ku` 这种裸后缀，
  单独读没有意义，音库里也查不到。
- **裸后缀不要用 `<s>` 标成可点读**，同理。用 `<b>` 强调。

---

## 这个 App 是什么

UGM INCULS《Titian Bahasa Pemula 1》的配套学习 App。三语界面
（中文 / 日本語 / English），印尼语点读音频全部由 ElevenLabs 合成。

- 名字 **Rae's Study Note**，安卓包名 `com.raenotes.app`
- 三个产物：`dist/rae-study-notes.html`（离线单文件）、`docs/`（网站）、APK
- 内容：**Bab 1 Perkenalan** 10 页 · 72 词 · 情景题 18 / 地点题 8
- 音频 431/431（100%），音库 2278 条，教材听力音轨 1 条

## 线上

| | |
| --- | --- |
| 网站 | **https://belajar.rae.work** |
| 仓库 | https://github.com/rae-work/rae-study-notes（**公开**） |
| 发布 | GitHub Pages 从 `main` 的 `/docs` 目录 |
| DNS | Cloudflare，`belajar` CNAME → `rae-work.github.io`，**灰云** |
| 统计 | Cloudflare Web Analytics（只在网站，不在 APK） |

**更新网站：**

```bash
npm run validate && npm run build && npm run site
git add -A && git commit -m "更新网站" && git push
```

约一分钟生效。`docs/CNAME` 由 `site.js` 自动保留，不用每次带 `--domain`。

## 下一步

- [ ] **Rae 在手机上完整试用一遍**（页脚、复习页、三语例句、点读速度）
- [ ] 她点头后 `npm run apk` 打第一个 APK
- [ ] Bab 2 起：Rae 拍照放 `inbox/`，走 `/lesson`

---

## ⚠️ 已知的坑（改代码前先看这一节）

**红线**

- **`history-archive-private` 分支永远不能 push。** 本机保留的开源前完整
  历史，里面有旧签名密钥。公开仓库用的是重建过的干净历史。跑 `/apk` 前
  确认自己在 `main` 上（`apk.sh` 推的是当前分支，而且是 `git add -A`）。
- **Cloudflare 那条 DNS 记录必须保持灰云。** 改橙云 → Let's Encrypt 的
  HTTP-01 挑战打不到 GitHub → 证书续期失败 → 三个月后网站报安全警告。
- **`android-app/release.keystore` 不能删。** 已 gitignore，**只存在本机**；
  云端从 Secret `KEYSTORE_BASE64` 还原。本机丢了就真的没了。
- **仓库是公开的。** push 等于对外发布代码 + 更新线上网站，两件事一起发生。

**离线约束**

- `assertOffline()`（`scripts/lib/build.js`）只管 `dist/` 和 APK，`docs/` 例外
  （多一段统计脚本）。`prepare-assets.js` 有第二道防线，把网站版误拷进
  APK 会 exit(1)。
- **`@font-face` 无条件拦截**，base64 内嵌也不行 —— 字体只能用系统栈。
- **`<a href="https://…">` 放行**（超链接不加载东西，页面照样离线可用）。
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
- 界面文案一律走 `T()`，键要同时加进 `ui.zh/ja/en.json` 三个文件，
  **键集合必须完全一致**。渗漏检查**只查中日文**，写死的英文和属性里的
  中文都查不出来。
- **音频不内联**，按相对路径 `audio/<哈希>.m4a` 取。托管必须带 `docs/audio/`。
- `eleven_multilingual_v2` **不接受** `language_code`。
- 中文 / 日文句内引号用「」。

**校验**

- **第 9 关（音频覆盖率）只是警告**，缺音频照样「✅ 全部通过」、照样能 build。
  真正拦下的是 `npm run site` 和 `npm run apk`（`lib/bundle.js` 的
  `assertNoMissing()` → exit 1）。发版前自己确认那行是 100%。
- 第 8 关「四种题型都出到」也是条件警告：`angka_pool` 为空时
  `jam`/`angka` 不出题是正常的。

---

## 命令

```bash
npm run validate         # 九道关（--quick 跳 7–9 关，--allow-todo 三语降级为警告）
npm run build            # → dist/rae-study-notes.html
npm run preview          # 本地 + 局域网地址，手机能开
npm run site             # → docs/（网站：HTML + 音频 + CNAME + 统计）
npm run prepare-assets   # → 安卓 assets（云端工作流也跑它）
npm run tts              # 增量合成语音（--dry 只报计划，--limit N 试音，--yes 跳过确认）
npm run apk              # 打包安卓（要 Rae 先确认过网页版）
```

⚠️ node / ffmpeg / git / gh 在 `/opt/homebrew/bin`，不在默认 PATH 里。
脚本已自己加上，**手动敲命令时要带 `PATH=/opt/homebrew/bin:$PATH`**。

## 目录职责

| 目录 | 是什么 | 进仓库？ |
| --- | --- | --- |
| `content/` | 唯一内容来源：课程 / 词汇 / 题库 / 界面文案 / 配置 | ✅ |
| `src/` | `template.html` + `app.css` + `engine.js` | ✅ |
| `scripts/` | 校验 / 构建 / 网站 / 语音 / 预览 / 打包 | ✅ |
| `audio/` | 语音库（按朗读文本哈希命名，只增不减的缓存） | ✅ |
| `docs/` | **网站产物**，Pages 从这里发布 | ✅ **但不许手改** |
| `dist/` | 单文件产物 | ❌ |
| `android-app/` | WebView 外壳（`assets/` 是构建时生成的） | ✅（除密钥） |
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
- 设置弹层：语言 / 主题 / **配色** / 语速 / 字号。「语音来源」默认隐藏
  （音频 100% 是合成的，系统语音永远轮不到）。
- **页脚 `.site-foot`**：项目名 + 版本、GitHub 链接、许可与内容出处、作者、
  隐私说明。用了三个构建占位符 `{{APP_NAME}}` / `{{BUILD_VERSION}}` /
  `{{REPO_URL}}`。隐私那行只在 http(s) 下显示（APK 没有统计）。

## 例句本地化

例句里「学习者自己」的国籍跟着界面语言走 —— 日本同学看到的是
「Saya dari Jepang / 日本から来ました」。

- 内容写占位符，渲染时由 `engine.js` 的 `LZ()` 替换：
  `{NEGARA}` → 印尼语国名（**进朗读文本，每种语言都要有音频**）、
  `{NAMA}` → 该语言国名、`{PEOPLE}` → 该语言的「某国人」
- 映射表在 `meta.json` 的 `learner`：zh→Cina / ja→Jepang / en→Inggris。
  **改了必须跑 `npm run tts` 补新句子的音频**
- **只用于第一人称。** 讲 Sanggi、Ziah 这些课本人物的例句不动
- ⚠️ `speakables.js` 因此**三种语言各收一遍**朗读文本。只收默认语言的话，
  日文界面的句子永远不进清单，发版才发现缺音频

## 音频性能

- **进页面预取**：把本页 clip fetch 成 blob 存内存，点词零网络等待
  （线上实测 335ms → 5ms）。只在 http(s) 下预取，APK 走 `file://` 跳过。
  缓存上限 240 条先进先出，换页丢掉上一页没取完的队列。
- 播放复用同一个 `<audio>`（见「已知的坑」）。
- 单条加载失败只退回系统语音；只有**网络源**失败才全局关掉内置音库。

---

## 已完成（归档）

- **基础设施**：validate 九关（含英文渗漏检查）、build（含离线自检）、
  site（网站）、`lib/bundle.js`（安卓和网站共用的音频裁剪）、
  preview / tts / apk.sh、`.claude/skills/` 两个技能
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

## 待办 / 待确认

1. **实战里的「几点了 / 数字价格」暂时隐藏** —— `drills.json` 的
   `angka_pool` 是空的。教到数字那一章往里加（**非空时至少 20 个**，
   少于 20 会直接报错），题型会自动出现。
2. **`alt` 字段现在不渲染**（语体切换功能没做），但 `speakables.js` 仍把它
   收进音频清单 —— L01 有 71 条 alt，等于花额度合成界面上看不到的话。
   新课要不要写 alt 先问 Rae。
3. **中文衬线在安卓上退到黑体** —— 系统没有中文宋体，且离线约束禁止
   web font。要真用上宋体只能内嵌字体子集，那要先改 `assertOffline`。
