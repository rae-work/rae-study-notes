---
name: lesson
description: 把课堂材料（课本照片、PDF 讲义、手写笔记、老师发的文件）做成 Ruang Belajar 里的一节课，含四语释义（中 / 日 / 英 / 越）、语体标注、词汇入库、实战题、ElevenLabs 语音，最后出网页版给 Rae 确认。当 Rae 提到 新课、加课、教材、讲义、课堂笔记、拍照、inbox、第 N 课、UGM、BIPA、Cindy，或者往 inbox/ 里放了东西时使用 —— 她不打 /lesson 也要用。
---

# /lesson · 从材料到成品

**默认中文回答，简短，先说结论。Rae 不是程序员 —— 需要她动手时给可以直接复制的完整命令。**

先读 `PROGRESS.md` 了解当前进度。数据结构细节见 `references/lesson-spec.md`，
校验细节见 `references/validation.md`。

## 流程（不要跳步）

### 1 · 读材料
列出 `inbox/` 里的新文件，逐个读。手写笔记要结合课本理解。
**看不清的地方列出来问 Rae，不要猜。** 一次问完，别挤牙膏。

### 2 · 定这一课的来源和默认语体
- UGM / BIPA 教材、课堂笔记 → `reg_default: "formal"`
- Cindy 的口语课、或 Rae 说明是口语材料 → `reg_default: "casual"`
- 课号取当前最大课号 +1（`content/lessons/` 里看）

### 3 · 起草 `content/lessons/Lxx.json`
照抄已有课程的结构。要点：
- 印尼语 = 纯字符串；面向学习者的文字 = `{zh, ja, en, vi}` 对象
- **硬性要求哪几种语言看 `content/meta.json` 的 `required_langs`**（**现在是 `["zh","ja","en","vi"]`，四语全必填**）。越南语按 `CLAUDE.md` 里的说明写：不是中文直译，语言对比要站在越南语使用者的角度。
  不在名单里的填 `null` 即可，校验只报完成度。
- 每页第一块必须是 `phead`
- 讲义几乎每次都有笔误：**内容里静默改正**，再加一个 `note` 块（`tag: {zh:"笔误修正"}`）
  告诉学习者原文错在哪
- **主动补课件没讲但一定会踩的坑**，也用 `note`。例如：
  `bisa`（有能力）vs `boleh`（被允许）· `harus` 的否定是 `gak usah` / `tidak perlu`，
  不是 `gak harus` · `Minggu` 既是「周日」也是「星期」
- formal 课里遇到 Cindy 教过的口语对应词，加一条「口语里说 …」的 note，
  并在 `vocab.json` 里给这个词补 `pair`

### 4 · 词汇与题库
- 新词进 `content/vocab.json`，**先查重**（同一个词只入库一次；课内 `vocab` 卡片可以重复出现）
- 涉及时间、数字、地点、常用问答的，往 `content/drills.json` 追加

### 5 · 给 Rae 一页中文摘要，等她确认
说清楚：这课讲了什么 · 新词几个 · 改了哪些笔误 · 补了哪些坑 · 哪里不确定。
**她确认之前不要往下走。**

### 6 · 校验
```bash
npm run validate
```
不过就修，修完再跑。九道关的含义见 `references/validation.md`。

### 7 · 语音（要花钱，先报数）
```bash
npm run tts
```
不带 `--yes` 时只报计划：条数、字符数、预计 credits、账号余额。
**把这几个数字告诉 Rae，等她说可以**，再跑 `npm run tts -- --yes`。

音频一律用 ElevenLabs（声音 Yetty，`content/meta.json` 里的 `voice_id`）。
不要退回系统 TTS 当交付方案。模型 `eleven_multilingual_v2`，**绝不传 `language_code`**。

跑完看 `npm run validate` 的「语音」那一行：**不到 100% 就别往下走。**
它只报警告不会失败，但 `npm run site` 和 `npm run apk` 会直接拒绝。

### 8 · 出网页版给 Rae 看
```bash
npm run build
npm run preview
```
把打印出来的局域网地址（`http://10.x.x.x:8787/`）给 Rae，让她在手机上看。
**先网页版，这是规矩。**

### 9 · 她说可以了 → 更新线上网站
```bash
npm run site
git add -A && git commit -m "Bab N" && git push
```
约一分钟后 https://belajar.rae.work 生效。
⚠️ 仓库是**公开**的，这一推同时公开代码和更新网站。
**确认自己在 `main` 分支** —— `history-archive-private` 含旧密钥，永远不能推。

### 10 · 最后才问要不要打 App
要就用 `/apk`。她没明确同意就不要打包。

### 11 · 收尾
- 处理过的文件移到 `inbox/done/Lxx/`
- 更新 `PROGRESS.md`
- `git commit` + `git push`（不推的话网站不会更新）

## 例句里的国籍要写占位符

第一人称的「我从⋯来 / 我是⋯人」**不要写死国家**，用占位符 ——
它会跟着界面语言变，日本同学看到的才是「Saya dari Jepang / 日本から来ました」：

| 占位符 | 替换成 | 注意 |
|---|---|---|
| `{NEGARA}` | 印尼语国名（Cina / Jepang / Inggris） | **进朗读文本，三种语言各产生一句、每句都要有音频** |
| `{NAMA}` | 该语言里的国名（中国 / 日本 / England） | |
| `{PEOPLE}` | 该语言里的「某国人」（中国人 / 日本人 / English） | |

映射表在 `content/meta.json` 的 `learner`。可用于 `vocab.ex` / `ex_gloss` /
`drills` 的 `hint` / `a` / `alts`。

**只用于第一人称。** 讲 Sanggi、Ziah 这些课本人物的国籍**不要**用占位符 ——
那是别人的国籍，跟着界面变就错了。

## 常犯的错

- 多语对象少写一个键（**`zh` / `ja` / `en` / `vi` 四个都必须有值** ——
  `required_langs` 现在是四语全必填，填 `null` 会让第 2 关失败）
- 中文、日文句内用了 ASCII 双引号 —— 一律用「」
- 朗读文本把 `?` `!` 去掉了 —— 问句会被读成陈述句，**保留**
- 词汇表重复入库
- 没跑校验就构建
- 顺序搞反：先打了 APK 才给 Rae 看
- 改了 `data-say` 的文本（多一个空格都算）没重跑 tts —— 覆盖率会立刻掉
- `drills.angka_pool` 非空时**必须至少 20 个数**，少于 20 直接报错
- `alts` 引擎只取前 3 条，写第 4 条是白写
- 新 block 的界面文案没走 `T()`，或者三个 `ui.*.json` 没同步加键
