# PROGRESS · 进度日志

> 每次新会话先读这里。`[x]` 已完成，`[ ]` 待做。
> 长期规则见 `CLAUDE.md`，数据规范见 `.claude/skills/lesson/references/`。
> `KICKOFF.md` 是第一阶段的启动简报，现在只作背景参考。

**当前状态：UI 改版完成（纸间风格 + 深浅色），网页版已出，等 Rae 在手机上确认。**

---

## 这个 App 是什么

UGM INCULS《Titian Bahasa Pemula 1》的配套学习 App。单个离线 HTML，
安卓另打成 APK。三语界面（中文 / 日本語 / English），印尼语点读音频全部
由 ElevenLabs 合成，教材官方听力音轨从 ugm.id 取回内置。

- 名字：Rae's Study Notes / Rae 的学习笔记 / Rae の学習ノート
- 安卓包名 `com.raenotes.app`
- 产物 `dist/rae-study-notes.html`

## 当前内容

- **Bab 1 Perkenalan**（自我介绍）10 页 · 72 词 · 情景题 18 / 地点题 8
- 音频 413/413 条（100%），教材听力音轨 1 条；音库 2259 条
- 三语 374 个对象，zh / ja / en 全齐

## 设计（2026-08-25 定稿）

「纸间」风格 —— 目标是电子书的阅读感，不是 App 的控件感。

- 底色微灰暖白 `#FAF8F4`（深色 `#211F1C`），不用纯白。**三套配色共用中性色**
- 正文墨色 `#322F2B`，辅助灰 `#8C867C`，细线 `#E7E2D9`
- **强调色五套，全部低饱和**，`<html data-accent>` 切换，rose 是默认（不写属性）：

  | key | 名字 | 浅色 | 深色 |
  | --- | --- | --- | --- |
  | `rose` | 藕粉 | `#ad7683` | `#c9a0a9` |
  | `blue` | 雾蓝 | `#6e8399` | `#9db2c6` |
  | `ochre` | 赭黄 | `#a8874e` | `#c9ac77` |
  | `sage` | 灰绿 | `#6f8a73` | `#9db8a1` |
  | `mauve` | 藕紫 | `#82769b` | `#b0a4c6` |

  每套五个变量：`--accent` / `--accent-ink` / `--accent-wash` / `--accent-line` / `--on-accent`。
  **配色和明暗是正交的两个维度**，加新配色要同时补浅色、媒体查询深色、
  手动深色三处，还有 `.sw-*` 色点，一共四处。
- **字体分工**（踩过坑，规则要严格）：
  **阅读区（`.sheet`）里只有 `button` / `input` / `select` 用无衬线，其余一律衬线。**
  页眉、目录抽屉、设置弹层整体无衬线。
  ⚠️ 上一版把提示块标签、表头、徽章这类**带中文的内容元素**也改成了无衬线，
  iOS 上 `--ui` 解析成 PingFang（黑体）、`--serif` 解析成 Songti（宋体），
  两种中文字形挨在一起非常刺眼。**给内容元素加 `font-family:var(--ui)` 前，
  先想清楚它会不会出现中日文。**
  **安卓通常没有中文衬线，正文中文会退到黑体，已知限制**
- **圆角三档**：`--r-sm:10px` 控件 / `--r-md:14px` 卡片和表格 / `--r-lg:18px` 弹层。
  表格必须 `border-collapse:separate`，collapse 状态下 `overflow` 裁不出圆角
- **动效三档**：`--t-fast:.18s` 悬停 / `--t-mid:.26s` 卡片按钮 / `--t-slow:.34s` 抽屉弹层翻页，
  缓动统一 `cubic-bezier(.4,0,.2,1)`。`prefers-reduced-motion` 会一键关停
- 深浅色：跟随系统 + 设置里手动切换，和配色一起存 localStorage

## 音频性能

- **点词的音频是预取的**：进一页就把这页要用的 clip 后台 fetch 成 blob 存内存，
  点的时候直接播。实测线上 335ms → 5ms
- 只在 http(s) 下预取；APK 走 `file://`，fetch 取不到本地文件，也不需要
- 缓存上限 240 条，先进先出释放；换页丢掉上一页没取完的队列
- **播放一律复用同一个 `<audio>`**（`bundleAudio`）。
  ⚠️ 不要再写 `new Audio()` —— iOS Safari 对同时存在的媒体元素有上限，
  每点一次造一个，用久了必卡
- 单条加载失败只退回系统语音；只有**网络源**失败才会全局关掉内置音库

**页眉是浮动的，不占版面**（`position:fixed` + `.reader` 的 `padding-top` 让位）。
往下读时收起，往回滚一点就出来；顶部 90px 内、翻页后、抽屉或设置展开时一定显示。
高度不写死 —— `syncHeaderH()` 实测后写进 `--hdr-h`，切语言／提示条显隐／转屏都会重量。
⚠️ 改页眉结构（加按钮、加行）后不用改 CSS 常量，但要确认 `syncHeaderH()` 有被调到。

页眉只有三个按钮：目录、遮盖答案、设置。
词汇表 / 复习 / 实战走目录抽屉（那三页本来就在目录里）；
语言 / 主题 / 语速 / 字号收进设置弹层；「语音来源」默认隐藏。

设计稿（两个方向的对比）：https://claude.ai/code/artifact/6a9d12b9-c48e-4f42-8bf8-38ceec047df8

## 线上

- **网站　　　 https://belajar.rae.work**（强制 HTTPS，Let's Encrypt 证书自动续期）
- 仓库（公开）https://github.com/rae-work/rae-study-notes
- GitHub Pages 从 `main` 分支的 `/docs` 目录发布；
  DNS 在 Cloudflare：`belajar` CNAME → `rae-work.github.io`，**灰云 / DNS only**
  （橙云会挡住证书签发，不要改）

**更新网站的三步**（内容或界面改完之后）：

```bash
npm run validate && npm run build && npm run site
git add -A && git commit -m "更新网站" && git push
```

`docs/CNAME` 里存着域名，`npm run site` 会自己保留，不用每次带 `--domain`。
推上去之后 GitHub 大约一分钟重新发布。

⚠️ 本机还有一个 `history-archive-private` 分支，是开源前的完整开发历史，
里面有签名密钥，**永远不要 push 这个分支**。

## 下一步

- [x] 21 个人名的语音已补齐（96 字符），音频覆盖率回到 100%
- [ ] **Rae 在手机上试用并确认**
- [x] 四个 GitHub Secret 已设好，云端打包可用
- [ ] 确认后 `npm run apk` 打第一个 APK
- [ ] Bab 2 起：Rae 拍照放 `inbox/`，走 `/lesson`

### 设 Secret（一次性，整段复制到终端）

```bash
cd /Users/rae/ruang-belajar
export PATH=/opt/homebrew/bin:$PATH
PW=$(git show "41f2334:android-app/app/build.gradle" | grep 'storePassword' | sed -n "s/.*?:[^']*'\([^']*\)'.*/\1/p" | head -1)
base64 -i android-app/release.keystore | gh secret set KEYSTORE_BASE64
printf '%s' "$PW" | gh secret set KEYSTORE_PASSWORD
printf 'appkey'   | gh secret set KEY_ALIAS
printf '%s' "$PW" | gh secret set KEY_PASSWORD
gh secret list
```

口令从本地存档分支里读出来直接灌进 GitHub，全程不显示在屏幕上。

## 命令

```bash
npm run validate     # 九道关
npm run build        # → dist/rae-study-notes.html
npm run preview      # 本地 + 局域网地址，手机能开
npm run site         # → docs/（可托管：HTML + 音频 + CNAME）
npm run tts          # 增量合成语音（先报数等确认，--yes 跳过）
npm run apk          # 打包安卓（要 Rae 先确认过网页版）
```

⚠️ node / ffmpeg / git / gh 在 `/opt/homebrew/bin`，不在默认 PATH 里，
脚本已自己加上，手动敲命令时要带 `PATH=/opt/homebrew/bin:$PATH`。

---

## 已完成

### 基础设施
- [x] `scripts/validate.js` 九道关，含**英文界面渗漏检查**
- [x] `scripts/build.js` → 单文件离线 HTML，含离线约束自检
- [x] `scripts/site.js` → `docs/`，用于静态托管
- [x] `scripts/lib/bundle.js` 「这一版需要哪些音频」，安卓和网站共用
- [x] `scripts/preview.js` / `scripts/tts.js` / `scripts/apk.sh`
- [x] `.claude/skills/lesson/` 和 `.claude/skills/apk/`

### 语音
- [x] 声音 Yetty `Lpe7uP03WRpCk9XkpFnf`，模型 `eleven_multilingual_v2`（**不传 language_code**）
- [x] 转码 AAC 64k / 32 kHz 单声道
- [x] 音库 2259 条（这一版用到 414 条）
- [x] 账号 starter 档 40,000 字符/月

### 签名（踩过的坑，已修两轮）
- [x] 第一轮：原来 gradle 写的是 `signingConfigs.debug`，每次构建换密钥 → 改成固定的 `release.keystore`
- [x] 第二轮（开源前）：密钥和口令原来都提交在仓库里 → 现在
      密钥走 GitHub Secret `KEYSTORE_BASE64`，口令走 Secret，仓库里一个都没有
- [x] **`android-app/release.keystore` 这个文件绝不能删** —— 丢了以后 APK 无法覆盖升级

---

## 待办 / 待确认

1. **实战里的「几点了 / 数字价格」暂时隐藏** —— `drills.json` 的 `angka_pool` 是空的。
   教到数字那一章时往里加，题型会自动出现。
2. **旧 App 的 143 句 alt 音频没合成** —— 给语体开关用的，新 App 还没做这个功能。
3. **中文衬线在安卓上会退到黑体** —— 系统没有中文宋体，且离线约束禁止 web font。
   要真的用上宋体只能内嵌字体子集，那要先改 `assertOffline` 的规则。

## 已知的坑

- `eleven_multilingual_v2` **不接受** `language_code`
- **`@font-face` 被 `assertOffline` 无条件拦截**（`scripts/lib/build.js`），
  连 base64 内嵌也不行 —— 字体只能用系统栈
- **页眉里 22 个元素 id 一个都不能删**（`engine.js` 里大量裸取 `getElementById`）。
  按钮已改成 null 安全的 `on()` 绑定，但 `#brandZh` `#maskTxt` `#bannerTxt`
  `#counter` `#prevBtn` `#nextBtn` 这些仍是裸取，删了整页白屏
- **iPhone 安全区**：页眉、正文、目录抽屉都用了 `env(safe-area-inset-*)`。
  加到主屏幕后是全屏运行，新增贴边的元素记得一起处理
- 界面上任何写死的文案都要走 `T()`，否则英文界面渗漏检查会拦下来
  （注意：它只查中日文，写死英文查不出来；属性里的中文也查不出来）
- 整句朗读用 `sayText()`（保留 `? ! . ,`），逐词点读才用 `clean()`
- 改任何 `data-say` 的文本（多一个空格都算）会立刻掉音频覆盖率，要重跑 tts
- 中文 / 日文句内引号用「」
- **音频不内联**，网页版按相对路径 `audio/<哈希>.m4a` 取。
  托管时必须把 `docs/audio/` 一起传上去，否则点读全部 404
