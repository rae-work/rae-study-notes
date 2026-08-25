# Ruang Belajar · 项目规则

印尼语学习 App。Rae（用户，中文母语，非程序员，在日惹 UGM 学印尼语）用它复习教材和课堂笔记，也会分享给班上的日本同学。代码全部由 Claude 写；Rae 负责提供材料、做选择、在设备上试用。

首次进入本项目：先读 `KICKOFF.md`。之后每次新会话：先读 `PROGRESS.md`，再动手。

## 沟通方式
- 用中文，简短，先说结论。Rae 不是程序员：不要假设她懂 git / npm / JSON 这些词；需要她动手时给出可以直接复制的完整命令，并用一句话说明会发生什么。
- 涉及删除、覆盖文件、推送到 GitHub、调用付费 API（ElevenLabs）之前，先确认。
- 每完成一个里程碑：更新 `PROGRESS.md`，`git commit`。让 Rae 随时可以关掉再回来。

## 绝对不做
- 不读取、不打印、不让 Rae 在对话里粘贴任何密钥。密钥只存在 `.env`（已 gitignore），脚本用 `process.env.ELEVENLABS_API_KEY` 读取。
- 不删除、不改动 `android-app/` 里的 `release.keystore`（丢了以后 APK 无法覆盖升级）。
- 不手改 `dist/` 和 `docs/` 里的文件（都是构建产物）。
  `docs/` 比 `dist/` 多一段访问统计，是网站专用；APK 只能用 `dist/` 那份。
- 不把 `.env`、`dist/`、`node_modules/`、`inbox/` 提交进 git。

## 交付形式（不变）
- 最终产物是单个离线 HTML `dist/belajar.html`：CSS / JS / 数据全部内联，不依赖网络，不引用外部资源，不用 web fonts。
- 安卓：同一个 HTML 打包成 APK（原生 WebView 工程 `android-app/`，GitHub Actions 云端构建）。iOS：网页加到主屏幕。
- **每次改动都要出两个版本：网页版 + 安卓 App。**
- 兼容基线：iOS 15 Safari / Android Chrome 100+。可以用现代 CSS（flex gap、CSS 变量、grid）和 ES2020。旧的 iOS 12 限制已作废。
- `localStorage` 只用于偏好（语言、语体、语速、字号）；读写失败时静默回退，不影响功能。

## 发布流程（顺序不能颠倒）
1. **先出网页版**：`npm run validate` → `npm run build` → `npm run preview`，把局域网地址给 Rae。
2. **等 Rae 在手机上看过、明确说可以**。她没点头之前不要打包、不要推 GitHub、不要动 APK。
3. 她同意后再 `/apk`：拷贝产物 → versionCode +1 → commit → push → 云端构建 → 取回 APK。

不要因为「反正最后都要打包」就提前跑第 3 步。App 装到手机上改起来麻烦，网页版改一行就能重看。

## 内容规则
- 目录职责：`content/` 是唯一内容来源；`src/` 是模板与引擎；`scripts/` 是流水线；`dist/` 是产物；`audio/` 是语音库；`inbox/` 是 Rae 放新材料的地方。
- 语体标记三种：`casual`（Cindy 私教的口语体）/ `formal`（标准语、书面、课堂）/ `neutral`。有配对的词成对存（udah ⇄ sudah），配对表在 `content/register.json`。
- 学习者语言：`zh`（主）、`ja`、`en`。所有面向学习者的文字（释义、说明、笔记、界面文案）都是 `{"zh":…, "ja":…, "en":…}` 对象；印尼语始终是纯字符串。
- **哪几种语言是硬性要求，看 `content/meta.json` 的 `required_langs`。** 目前是 `["zh"]` —— 日文按 Rae 2026-08-25 的要求暂缓，英文待定。不在名单里的语言只报完成度、不阻塞构建；要开就把它加进数组。
- 中文、日文句内引号用「」。
- 讲义几乎每次都有笔误：静默改正内容，并加一个 `note` 块（tag「笔误修正」）告诉学习者原文错在哪。同时主动补课件没讲但一定会踩的坑（例：bisa vs boleh、harus 的否定是 gak usah / tidak perlu、Minggu 既是周日也是星期）。
- 词汇表（`content/vocab.json`）同一个词只入库一次；课内卡片可以重复出现。
- 朗读文本保留 `?` `!`，问句要按问句语调合成。

## 语音（ElevenLabs）
- **所有音频一律用 ElevenLabs 合成，网页版和 App 用的是同一批文件。**
  不要退回系统 TTS 当交付方案，也不要再走 Colab 手工那一套 —— 本机有 API key，`npm run tts` 直接跑。
  引擎里的 Web Speech / 安卓原生 TTS 只是「这句还没合成」时的临时兜底，
  正式发布前音频覆盖率必须是 100%，`npm run validate` 会报这个数。
- 模型 `eleven_multilingual_v2`。**不要传 `language_code`**（这个模型会拒绝请求，上次差点让 1,900 多条全部失败）。
- 声音 ID 在 `content/meta.json` 的 `voice.voice_id`：`Lpe7uP03WRpCk9XkpFnf`（Yetty）。换声音只改这里。
- 增量生成：文件按朗读文本的哈希命名，只合成 `audio/` 里缺的。跑之前先报告条数、字符数、预计消耗，等 Rae 确认。
- 转码：ffmpeg → AAC 64 kbps / 32 kHz `.m4a`。（24 kHz 会削掉 ny / sy / c 的高频，实测过，不要降。）

## 每次改动后必跑
`npm run validate` → `npm run build`。校验内容：JSON 结构、三语齐全、语体值合法、配对可解析、词汇查重、`node --check`、jsdom 逐块渲染冒烟、实战题库压力测试（选项恰好 4 个且不重复、答案索引正确）、朗读文本的音频覆盖率。任何一道不过，先修，再继续。
