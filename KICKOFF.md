> ⚠️ **已作废 —— 只作历史背景。**
> 这份简报描述的是 2026-08 之前的旧 App（Cindy 私教 13 课那版）：
> 语体开关、三色徽章、发音特训、`dist/belajar.html` 等等，**现在的 App 都没有**。
> 数据格式看 `.claude/skills/lesson/references/lesson-spec.md`，
> 现状和流程看 `PROGRESS.md`。

# KICKOFF · 启动简报

> 这份文件由 claude.ai 里的 Claude 写给 Claude Code 里的 Claude。两边不共享记忆，所以这里把前史、已经定下的决定、要做的事全部写清。读完本文件和 `CLAUDE.md`，再按 §8 开始。第一阶段完成后，日常进度以 `PROGRESS.md` 为准，本文件只作背景参考。

---

## 0. 前史：`legacy/` 里有什么

Rae 之前在雅加达/泗水跟私教 Cindy 学了 13 课印尼语，我们一起把 Cindy 的 PDF 讲义做成了一个离线学习 App。这些文件 Rae 会放进 `legacy/`，缺哪个她会说明：

| 文件 | 是什么 | 怎么用 |
|---|---|---|
| `belajar-bahasa.html` | **现役 App**，单文件。13 课、词汇表 358 词；三个顶层区：课程 / 复习（🎯，遗忘曲线 MCQ，四种题型：认词、听辨、回想、填空）/ 实战（💬，程序生成的时间、数字/价格、情景问答、听力应答，带自适应降级）。第 9 课是发音专项（`syll` 块：音节拆读、倒序拼读、影子跟读、录音对比）。 | 内容与引擎都从这里迁移。引擎为了兼容 iOS 12 写得非常保守（无箭头函数、无 let/const、无 flex gap），这次可以放开重写。 |
| `skill-belajar.zip` | 上一版流水线 Skill：`SKILL.md` + `references/lesson-spec.md`（课程数据规范、所有 block 类型定义、Cindy 口语体风格提取）、`references/validation.md`（校验四道关）、`references/voice-and-apk.md`（语音与打包流程）+ 当时的 HTML + 安卓工程 + 签名密钥。 | **先解压通读。** 块类型定义、校验思路、口语体规则都仍然有效，只是执行环境从沙箱变成了本机（本机能联网、能跑 ffmpeg、能用 gh）。里面「界面与交互保持不变」那条已作废。 |
| `android-app/` | 原生 WebView 工程，`.github/workflows/build-apk.yml` 云端打包。上次发布 v1.3 / versionCode 4。 | 保留。`release.keystore` 绝不能丢。查看工作流是怎么处理签名的（密钥是提交在仓库里还是走 GitHub Secrets），沿用能跑通的方式。下次发布从 versionCode 5 起。 |
| 音频 zip | ElevenLabs 已生成的约 1,938 条（声音 Yetty，multilingual v2），mp3 或已转码的 m4a。 | 全部复用，按新的哈希命名规则迁入 `audio/`。不要重新生成。 |
| `生成语音包.ipynb` | 旧 Colab 笔记本。 | **声音 ID 在里面**，提取到 `content/meta.json`。笔记本里的清洗、请求、重试逻辑可以参考。 |
| 课件 PDF（可能有） | Cindy 的讲义。 | 用来测试 `/lesson` 全流程。 |

已知的坑（都踩过）：
- `eleven_multilingual_v2` 不接受 `language_code` 参数。
- 免费档无法通过 API 使用语音库里的声音（402）；Rae 用的是每月 5 美元的付费档，额度 30,000 credits/月。
- 清洗朗读文本时曾把 `?` 去掉，导致 110 条问句被读成陈述句——**保留 `?` `!`**。
- 48 kbps / 24 kHz 会削掉印尼语 ny / sy / c 的高频，最终定为 64 kbps / 32 kHz AAC。
- 中文句子里的 ASCII 双引号曾截断 JS 字符串。内容改成 JSON 后这类问题由转义解决，但风格上仍统一用「」。

## 1. 已定的决定（不用再问 Rae）

1. 平台：Mac；Rae 用 Claude Code 桌面版，不用终端做日常操作。
2. 兼容基线改为 iOS 15 Safari / Android Chrome 100+。iPad mini 2 已不再使用。
3. 界面**可以**重新设计，但第二阶段才做；第一阶段先 1:1 复刻现有行为做回归。
4. 内容与界面分离：内容进 JSON，构建脚本合成单文件 HTML。交付形式不变。
5. APK 继续走 GitHub Actions；用 `gh` 推送并下载产物。
6. ElevenLabs 在本机增量生成；密钥在 `.env`。
7. 学习者语言 zh / ja / en，三语齐全才算完成。
8. 语体标记与切换按 §3 §4 实现。
9. 新课（UGM 教材）默认 `formal`，Cindy 的 13 课默认 `casual`。

## 2. 目标目录

```
ruang-belajar/
├── CLAUDE.md                 长期规则
├── KICKOFF.md                本文件
├── PROGRESS.md               进度日志（你来维护）
├── package.json              npm scripts：validate / build / tts / preview / apk
├── .env                      ELEVENLABS_API_KEY=…（gitignore，永不读取打印）
├── .gitignore                .env dist/ node_modules/ inbox/
├── .claude/skills/
│   ├── lesson/               /lesson  从 inbox 到成品的全流程（§6）
│   └── apk/                  /apk     打包并取回 APK
├── content/                  唯一内容来源
│   ├── meta.json             app 名、版本、语言列表、默认语言、声音 ID
│   ├── register.json         语体配对表（§3.3）
│   ├── vocab.json            词汇表
│   ├── drills.json           实战题库池：SITUASI / TEMPAT / ANGKA_POOL…
│   ├── lessons/L01.json … L13.json
│   └── i18n/ui.zh.json ui.ja.json ui.en.json
├── src/
│   ├── template.html         页面骨架
│   ├── app.css
│   └── engine.js             渲染、点读、复习、实战、发音特训
├── scripts/
│   ├── extract-legacy.js     一次性：从旧 HTML 抽出数据
│   ├── validate.js
│   ├── build.js              → dist/belajar.html
│   ├── tts.js                增量合成 + 转码
│   └── apk.sh                拷贝产物、bump versionCode、commit、push、取回 APK
├── audio/                    <hash>.m4a + manifest.json（提交进 git，云端打包需要）
├── dist/                     构建产物
├── inbox/                    Rae 放照片 / PDF；处理完移到 inbox/done/Lxx/
├── android-app/
└── legacy/                   旧文件，只读
```

## 3. 数据模型

### 3.1 通用约定
- 印尼语 = 纯字符串。面向学习者的文字 = `{"zh":…,"ja":…,"en":…}`，三键必须齐全。
- 每个可朗读的印尼语字符串都要能被 `tts.js` 收集到：把「哪些字段需要朗读」写成一个集中定义的函数 `collectSpeakables(content)`，`validate.js`、`tts.js`、引擎共用同一份逻辑，避免遗漏。

### 3.2 `vocab.json`
```json
{
  "w": "udah",
  "les": 4,
  "reg": "casual",
  "pair": "sudah",
  "gloss": { "zh": "已经", "ja": "もう（〜した）", "en": "already" },
  "pos": "adv",
  "note": null
}
```
- `reg`：`casual | formal | neutral`。
- `pair`：另一语体的对应词（字符串）。对方在词汇表里有条目就可点击跳转，没有就只显示。
- 同一个词只入库一次。

### 3.3 `register.json` 配对表（起始版，按需扩充）
```json
{
  "pairs": [
    ["udah","sudah"], ["gak","tidak"], ["nggak","tidak"], ["banget","sekali"],
    ["mau","akan"], ["gimana","bagaimana"], ["kenapa","mengapa"], ["berapaan","berapa"],
    ["aku","saya"], ["kamu","Anda"], ["lagi","sedang"], ["gak usah","tidak perlu"],
    ["bikin","membuat"], ["ngomong","berbicara"], ["kayak","seperti"], ["cuma","hanya"],
    ["aja","saja"], ["doang","saja"], ["pengen","ingin"], ["tau","tahu"], ["gede","besar"],
    ["duit","uang"], ["kalo","kalau"], ["gitu","begitu"], ["gini","begini"],
    ["ntar","nanti"], ["emang","memang"]
  ],
  "casual_only": ["sih","dong","kok","deh","lho","nih","tuh","yuk"],
  "notes": {
    "banget": "正式体可用 sekali（同位置，后置）或 sangat（前置）",
    "sama": "口语里 sama 可代替 dengan（和/跟），但 sama 也是「相同」，替换要看语境",
    "root_verbs": "口语用词根（baca / beli / nonton），正式体常用 me- 前缀（membaca / membeli / menonton），按需成对"
  }
}
```
Cindy 风格摘要（casual 的判定依据）：udah 不用 sudah、gak 不用 tidak、mau 表将来不用 akan、gimana/kenapa 不用 bagaimana/mengapa、berapaan、banget；动词用词根不加前缀；句子短（Karena enak. / Besok. / Udah.）。

### 3.4 课程 `lessons/Lxx.json`
```json
{
  "num": 14,
  "source": "UGM BIPA 1 · Bab 3（课本第 41–52 页 + 8/28 课堂笔记）",
  "reg_default": "formal",
  "name": { "zh": "自我介绍", "ja": "自己紹介", "en": "Introducing yourself" },
  "pages": [ [ { "k": "phead", … }, { "k": "examples", "items": [ … ] } ] ]
}
```
- 块类型沿用 `lesson-spec.md` 里的定义（phead / lead / sec / pattern / examples / vocab / qa_list / note / dialog / prompt / syll …），只是所有学习者语言字段改成三语对象。确有表达不了的内容才新增块类型，并同步更新规范。
- 例句 / 对话行 / 问答项：
```json
{
  "id": "Aku udah makan.",
  "reg": "casual",
  "alt": "Saya sudah makan.",
  "gloss":     { "zh": "我吃过了。",   "ja": "もう食べた。",        "en": "I've already eaten." },
  "alt_gloss": { "zh": "我已经吃过了。", "ja": "私はもう食べました。", "en": "I have already eaten." },
  "kw": ["udah"]
}
```
- `alt`：另一语体的整句。只在替换全部安全时生成，不确定就留 `null`，校验会列出待补清单。
- `alt_gloss` 可省略（省略即复用 `gloss`）。日文里语体差异是真实存在的：casual 用普通体，formal 用です・ます体；英文 casual 用缩写，formal 不用；中文差异小，自然即可。
- 有 `alt` 的句子，`alt` 也要有音频。

### 3.5 `i18n/ui.*.json`
所有界面文案（按钮、标签、提示、结算页鼓励语、题型名）。三个文件键集合必须完全一致，校验检查。

### 3.6 `drills.json`
旧引擎里的 `SITUASI`、`TEMPAT`、`ANGKA_POOL` 等题库池，提示文字改三语，每条带 `reg`。

### 3.7 日文与英文的生成原则
- 释义简洁、自然，像给学习者看的课本，不像机翻。日文里印尼语保持拉丁字母，句内引号用「」。
- 针对中文母语者写的说明（例如拿汉语拼音类比发音、汉语没有的语法点）不能直译。对每种语言写对该母语者有用的版本；实在只对中文读者有意义的，块上标 `"only": ["zh"]`，其他语言不显示。第 9 课发音专项要为日语母语者改写重点（如 l/r、辅音连缀、词尾 -k/-t/-p 闭音节、e 的两读），英语版同理。
- 「笔误修正」类 note 三语都要有。

## 4. 界面需求（第二阶段落地）

### 4.1 顶栏
语言切换（中文 / 日本語 / English）· 语体开关（全部 / 口语 / 正式）· 语速 · 字号 · 现有的答案遮挡开关。偏好存 localStorage。

### 4.2 语体开关的行为
| 位置 | 全部 | 口语 | 正式 |
|---|---|---|---|
| 课程页 | 原句为主，`alt` 作脚注 | 有 `alt` 的句子以口语版为主，另一版折叠 | 反之 |
| 词汇表 | 全显示 + 徽章 | 只显示 casual / neutral | 只显示 formal / neutral |
| 复习 🎯 | 混出 | 题池限 casual / neutral | 题池限 formal / neutral |
| 实战 💬 | 混出 | 同上 | 同上 |
课程内容本身永远完整显示（那是老师的材料），开关只影响主次和题池。

### 4.3 徽章
每个词卡、每条例句一个小徽章：口语 / 正式 / 通用（三种颜色）。有配对时徽章旁显示 `⇄ sudah`，可点。

### 4.4 新题型「语体转换」
给 `sudah` 选口语说法 / 给 `udah` 选正式说法，四选一，干扰项从配对表和同课词里取。加进复习模式的混合调度。

### 4.5 必须保留的功能（一样都不能丢，回归时逐项对照）
点读任意印尼语词与整句、慢速/常速、词汇表搜索与按课筛选、释义遮挡自测、复习四题型与错词重出、实战四题型与自适应降级、第 9 课发音特训（音节、倒序拼读、跟读循环、录音对比）、练习答案遮挡、目录跳转、键盘快捷键、桌面图标 / 主屏幕元信息、安卓 TTS 桥接。

### 4.6 设计流程
先出**两个方向**，各构建成一个完整的 `dist/` 文件（用真实内容，不是 mock），起个名让 Rae 在手机上打开对比。她选一个，你再打磨落地。设计要有明确的取向，不要默认的白底圆角卡片模板；可以参考 Claude Code 里的 `/frontend-design` 之类的设计 skill（如果有）。

## 5. 流水线脚本

- **`extract-legacy.js`**（一次性）：用 Node 的 `vm` 执行旧 HTML `<script>` 里的数据段拿到 `D`、`VOCAB`、`SITUASI`、`TEMPAT`、`ANGKA_POOL` 等对象，**不要用正则硬扒**。转换：`gloss:"中文"` → `{zh:"中文"}`；早期课程有 `"English. 中文"` 混写的释义，拆成 `en` / `zh`。语体：按配对表打 `reg`，含任一 casual 标记的句子为 casual，否则 neutral；`alt` 保守生成。产出后再逐课补 `ja` / `en`。
- **`validate.js`**：CLAUDE.md 列的全部检查；输出人能读的报告；有错退出码非 0。
- **`build.js`**：读 `content/` + `src/`，内联合成 `dist/belajar.html`。音频策略沿用旧引擎：APK 里从 `file:///android_asset/audio/` 播放；网页版若同目录有 `audio/` 则用，否则回退到系统 TTS（Web Speech）。构建时把 `audio/manifest.json` 内联，引擎据此判断某句有无真人音频。
- **`tts.js`**：`collectSpeakables` → 哈希 → 对比 `audio/manifest.json` → 只合成缺失的 → mp3 → ffmpeg 转 AAC 64k/32k `.m4a` → 更新 manifest。并发 ≤ 3，失败重试，跑前打印条数/字符/预计 credits 并等待确认（`--yes` 跳过）。
- **`apk.sh`**：`dist/belajar.html` → `android-app/app/src/main/assets/index.html`，`audio/` → assets，versionCode +1、versionName 更新，commit，push，`gh run watch` 等构建，`gh run download` 把 APK 放到 `dist/`。GitHub 仓库若不存在，用 `gh repo create --private` 建（整个项目一个仓库，工作流放在根目录 `.github/workflows/`，构建 `android-app/`）。
- **`preview`**：起本地静态服务并打开浏览器；同时打印局域网地址（`http://<Mac的IP>:端口`），Rae 手机连同一 Wi-Fi 就能看。

`package.json` 只用 Node 自带能力 + 少量依赖（jsdom 做冒烟测试即可）。

## 6. `/lesson` skill

位置 `.claude/skills/lesson/`，从 `legacy/skill-belajar` 移植：`SKILL.md` 控制在 300 行内，细节放 `references/`（沿用 lesson-spec / validation / voice-and-apk，按新架构改写），可执行部分放 `scripts/` 或直接调用项目 `scripts/`。

`description` 要写得主动触发：Rae 只要提到 新课、加课、教材、讲义、课堂笔记、拍照、inbox、第 N 课，即使没打 `/lesson`，也应使用这个 skill。

流程：
1. 列出 `inbox/` 里的新文件（照片、PDF、笔记），逐一读取。手写笔记要结合课本内容理解，看不清的地方列出来问 Rae，不要猜。
2. 判定这一课的来源与默认语体（UGM 教材 → `formal`；若 Rae 说明是口语材料则 `casual`）。
3. 起草 `content/lessons/Lxx.json`：三语释义；笔误静默修正 + 「笔误修正」note；补坑 note；formal 课里遇到 Cindy 教过的口语对应词，加「口语里说 …」note，并在 `vocab.json` 里补 `pair`。
4. 新词入 `vocab.json`（先查重）；涉及时间、数字、地点、常用问答的，往 `drills.json` 追加。
5. 给 Rae 一页中文摘要：这课讲了什么、新词几个、修正了哪些笔误、补了哪些坑、哪些地方不确定。**等她确认**再往下。
6. `npm run validate`，不过就修。
7. `npm run tts`（报数后等确认）。
8. `npm run build`；告诉她怎么预览。
9. 问是否打 APK；是则 `/apk`。
10. 把处理过的文件移到 `inbox/done/Lxx/`；更新 `PROGRESS.md`；commit。

## 7. 分阶段与验收

**Phase 1 · 骨架与迁移**
- 解压 legacy、读旧 skill；初始化 git、`.gitignore`、`package.json`；写 `PROGRESS.md`。
- `extract-legacy.js` 抽出全部内容；建 `register.json`、`meta.json`（含声音 ID）；旧音频迁入 `audio/` 并生成 manifest。
- `src/` 先从旧 HTML 的 CSS/JS 起步，只做「读 JSON 数据」的改造，**不改外观**。
- `build.js` + `validate.js` 跑通；`dist/belajar.html` 行为与 legacy 一致（jsdom 逐块渲染对比 + Rae 在手机上试用）。
- 逐课补 `ja` / `en` 与 `reg` / `alt`，**一课一提交**，防止会话中断丢工作；可以用子代理并行翻译，但合并后必须过校验。
- 验收：validate 全绿；13 课三语齐全；Rae 确认旧功能没丢。

**Phase 2 · 界面重设计 + 新功能**
- 两个方向 → Rae 选 → 落地 §4 全部需求 → 回归 §4.5 清单。
- 验收：Rae 在手机上确认；validate 全绿。

**Phase 3 · 流水线与 skill**
- `tts.js`（先用几条句子小规模试，确认音质与旧音频一致再放开）、`apk.sh`、`/lesson`、`/apk`。
- 用 `legacy/` 里的一份旧课件（或 Rae 现拍一页）走完 `/lesson` 全流程，直到 APK 装到手机上能用。
- 验收：从 inbox 到 APK 不需要 Rae 做任何手动步骤（除了确认）。

**Phase 4 · 第一节 UGM 课**
- Rae 拍照 → `/lesson`。之后就是日常。

## 8. 第一次会话怎么开始

1. 读 `CLAUDE.md`、本文件；解压 `legacy/skill-belajar.zip`，读它的 `SKILL.md` 和 `references/`。
2. 检查环境：`node -v`、`ffmpeg -version`、`git --version`、`gh auth status`；确认 `.env` 存在（只检查文件存在和变量名，**不要打印内容**）。缺什么，给 Rae 一条可复制的命令。
3. 盘点 `legacy/`：对照 §0 的表，缺的告诉 Rae。
4. 初始化 git 与 `.gitignore`（先于任何 `.env` 可能被误提交之前）。
5. 写 `PROGRESS.md`：把 §7 变成可勾选的清单，开始 Phase 1。
6. 每个里程碑一次 commit + 更新 `PROGRESS.md`。Rae 说「继续」时，从 `PROGRESS.md` 接着做。
