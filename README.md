# Rae's Study Note

印尼语学习笔记 App。UGM INCULS《Titian Bahasa Pemula 1》的配套复习工具 ——
单个离线 HTML，点任意印尼语词或整句都能听发音，附词汇表、复习模式和情景实战题。
界面三语：中文 / 日本語 / English。

An offline Indonesian study app built around UGM INCULS's *Titian Bahasa Pemula 1*.
One self-contained HTML file: tap any Indonesian word or sentence to hear it,
plus a searchable glossary, a spaced-review mode and situational drills.
Interface in Chinese, Japanese and English.

**打开就能用：https://belajar.rae.work** —— 手机浏览器直接开，
加到主屏幕就是个 App，不用装任何东西。

> 这是一个人的学习笔记，做出来给同班同学一起用的。
> 欢迎 fork 之后换成你自己的教材内容 —— 下面写了怎么做。
>
> A personal study tool, shared with classmates. Fork it and swap in your own
> material; see below.

---

## 跑起来 · Getting started

需要 [Node.js](https://nodejs.org/) 20 以上。生成语音还需要 `ffmpeg` 和一个
[ElevenLabs](https://elevenlabs.io/) API key（不合成语音的话可以跳过，
App 会退回设备自带的语音）。

```bash
npm install
npm run validate     # 校验内容：结构、三语、语体、查重、渲染冒烟、题库、音频覆盖率
npm run build        # → dist/rae-study-notes.html（单文件，离线可用）
npm run preview      # 本地起服务，同一个 Wi-Fi 下手机也能打开
```

其他命令：

| 命令 | 做什么 |
| --- | --- |
| `npm run tts` | 增量合成语音（只补缺的；跑之前会先报条数和预计消耗） |
| `npm run site` | 生成可托管的 `docs/`（HTML + 音频 + `CNAME` + `.nojekyll`，并注入访问统计） |
| `npm run prepare-assets` | 把产物摆进安卓 `assets/`（云端打包也跑它） |
| `npm run apk` | 打安卓 APK（GitHub Actions 云端构建） |

---

## 目录职责 · Layout

| 目录 | 是什么 |
| --- | --- |
| `content/` | **唯一内容来源**：课程、词汇、题库、界面文案、配置 |
| `src/` | 模板 `template.html`、样式 `app.css`、引擎 `engine.js` |
| `scripts/` | 校验 / 构建 / 语音 / 预览 / 打包 流水线 |
| `audio/` | 语音库（按朗读文本的哈希命名，只增不减的缓存） |
| `dist/` | 构建产物，不进仓库 |
| `docs/` | 网站产物，`npm run site` 生成。**这个目录要提交**（Pages 从它发布），但不许手改 |
| `.github/` | 云端打包 APK 的工作流 |
| `android-app/` | 原生 WebView 外壳，把同一个 HTML 打包成 APK |
| `.claude/skills/` | 给 Claude Code 用的技能：怎么把课堂材料做成一节课、怎么打包 |

内容全部是 JSON。面向学习者的文字一律是 `{"zh":…, "ja":…, "en":…}` 三语对象，
印尼语始终是纯字符串。改完跑一次 `npm run validate`，九道关会告诉你哪里不对。

---

## 换成你自己的教材 · Using your own material

1. 把 `content/lessons/` 里的课文换成你的，`content/vocab.json` 换成你的生词，
   `content/drills.json` 换成你的题库。
2. `content/meta.json` 里改 App 名字、单元的叫法（Bab / Pelajaran / Unit）、
   哪几种语言是必填（`required_langs`）、用哪个 ElevenLabs 声音。
3. `content/meta.json` 里还要改：`app.id`（决定产物文件名）、`app.repo`（页脚链接）、
   `learner`（例句里的国籍映射），并把 **`site.analytics_token` 清空** ——
   否则访问数据会打到原作者的统计面板。
4. `npm run validate` → `npm run build`。

想发到自己的域名：`npm run site -- --domain your.domain` → 提交 `docs/` →
仓库 Settings → Pages 选 `main` / `/docs`；DNS 用 CNAME 指到 `<用户名>.github.io`。
**如果 DNS 在 Cloudflare，那条记录必须是灰云（DNS only）** —— 橙云会让证书签发失败。

数据格式写在 [`.claude/skills/lesson/references/lesson-spec.md`](.claude/skills/lesson/references/lesson-spec.md)。
如果你也用 Claude Code，仓库里的 `.claude/skills/lesson/` 是一个现成的技能：
把课本照片或讲义丢进 `inbox/`，它会做成一节完整的课（含三语释义、语体标注、
词汇入库、实战题、语音合成）。

---

## 许可 · License

**代码**（`src/` `scripts/` `android-app/` `.claude/`）是 MIT，见 [LICENSE](LICENSE)。
随便拿去改、去用。

**课程内容**（`content/` 和 `audio/`）不一样：它整理自 UGM INCULS 的教材
《Titian Bahasa Pemula 1》，版权属于原作者和出版方。这部分只作个人学习用途，
不适用 MIT，也不要拿去商用或再分发。要 fork 的话，请换成你自己的材料。

The **code** is MIT-licensed. The **lesson content and audio are not** — they are
study notes derived from a copyrighted textbook, kept here for personal use.
Please replace `content/` with your own material before redistributing.
