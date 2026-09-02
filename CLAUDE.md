# Ruang Belajar · 项目规则

印尼语学习 App。Rae（用户，中文母语，非程序员，在日惹 UGM 学印尼语）用它复习教材和课堂笔记，也会分享给班上的日本同学。代码全部由 Claude 写；Rae 负责提供材料、做选择、在设备上试用。

**每次会话先读 `PROGRESS.md`，再动手。**
`KICKOFF.md` 描述的是 2026-08 之前的旧 App，§3–§8 已作废，只作历史背景。

## 沟通方式
- 用中文，简短，先说结论。Rae 不是程序员：不要假设她懂 git / npm / JSON 这些词；需要她动手时给出可以直接复制的完整命令，并用一句话说明会发生什么。
- 涉及删除、覆盖文件、推送到 GitHub、调用付费 API（ElevenLabs）之前，先确认。
- 每完成一个里程碑：更新 `PROGRESS.md`，`git commit`。让 Rae 随时可以关掉再回来。

## 绝对不做
- 不读取、不打印、不让 Rae 在对话里粘贴任何密钥。密钥只存在 `.env`（已 gitignore），脚本用 `process.env.ELEVENLABS_API_KEY` 读取。
- 不删除、不改动 `android-app/` 里的 `release.keystore`（丢了以后 APK 无法覆盖升级）。
- 不手改 `dist/` 和 `docs/` 里的文件（都是构建产物）。
  `docs/` 比 `dist/` 多一段访问统计，是网站专用；APK 只能用 `dist/` 那份。
- 不删、不改 `android-app/release.keystore`。它已 gitignore、**只存在本机**，
  云端从 Secret 还原。本机丢了就真的没了。
- 不把 `.env`、`dist/`、`node_modules/`、`inbox/`、`legacy/`、`*.keystore` 提交进 git。
  （反过来：**`docs/` 必须提交** —— Pages 就是从它发布的，只是不许手改。）
- **永远不要 push `history-archive-private` 分支** —— 那是开源前的完整历史，
  里面有旧签名密钥。仓库现在是**公开**的。
- 不要把签名口令写进任何文件。它和密钥都在 GitHub Secrets
  （`KEYSTORE_BASE64` / `KEYSTORE_PASSWORD` / `KEY_ALIAS` / `KEY_PASSWORD`）。
  注意 `meta.json` 里的 `site.analytics_token` **不是密钥**，公开可提交。

## 交付形式
- 三个产物：
  - `dist/rae-study-notes.html` —— 离线单文件（文件名跟着 `meta.app.id` 走）。
    CSS / JS / 数据内联，**但音频不内联** —— 按相对路径 `audio/<哈希>.m4a` 取，
    托管和打包都必须把音频目录一起带上。
  - `docs/` —— 网站产物（`npm run site` 生成），GitHub Pages 从 `main` 的 `/docs`
    发布到 https://belajar.rae.work 。**这一份要提交进仓库，但不许手改。**
  - APK。
- 离线约束（不引用外部资源、不用 web font）**管 `dist/` 和 APK**；
  `docs/` 例外，多一段访问统计脚本。两道防线：`lib/build.js` 的 `assertOffline()`、
  `prepare-assets.js` 的外部资源检查。`@font-face` 无条件拦（base64 内嵌也不行）；
  `<a href="https://…">` 放行（超链接不加载东西）。
- 安卓：同一个 HTML 打包成 APK（原生 WebView 工程 `android-app/`，GitHub Actions 云端构建）。iOS：网页加到主屏幕。
- **每次改动的三个出口**：本地预览（给 Rae 看）→ 网站 `docs/` → APK。
  后两个都要等 Rae 点头。
- 兼容基线：iOS 15 Safari / Android Chrome 100+。可以用现代 CSS（flex gap、CSS 变量、grid）和 ES2020。旧的 iOS 12 限制已作废。
- `localStorage` 统一走 `engine.js` 里的 `STORE`：老三样 `lang` / `theme` / `accent`
  保持裸键名（线上已有用户存过，改名等于把大家的设置清空一次），新增的一律带
  `rsn.` 前缀。目前另有四个：`rsn.pos`（上次读到哪一页 + 滚动位置）、
  `rsn.prog`（每个词/题的对错次数）、`rsn.quiz` / `rsn.drill`
  （做到一半的练习会话，一轮结束或回设置页就清掉）。字号和语速仍不持久。
  **读写失败一律静默回退**，隐私模式、配额满都不影响功能。
  ⚠️ iOS Safari 直接开网页时，连续 7 个「使用日」没访问就会被系统清掉存储
  （加到主屏幕的不会）—— 所以任何进度都只能做成「丢了也不影响使用」的增强，
  界面上不许拿它当前提。

## 界面规矩（Rae 反复强调过的，别再犯）

- **表格优先照顾手机竖屏。** 主要在 375px 宽的手机上看，可见区约 343px，
  **不能让用户左右拖着看**（她的原话：「其实用户体验挺差的」）。
  - CSS 里**不要给表格写死 `min-width`**（原来写了 460px，于是每张表都要拖）
  - 标签列用 `width:1%` + `min-width`（约 6em），**不要用 `white-space:nowrap`** ——
    长标签会被撑开，反而把右边挤没
  - **括号里的注释最占宽度**，抽到表注里去说
  - 空单元格写 `""`，引擎会渲染成 `rowspan` 真合并（少一条横线，也窄一截）
  - 宽度要给真正要读的内容：标签列窄、内容列宽
  - 新加表格先在 375px 下看一遍再交付
- **横线能不画就不画，绝不出现两条挨着。**
  - 行间分隔用 `.row + .row{border-top}`，**不要 `border-bottom` 配 `:last-child` 取消** ——
    这些行直接挂在页面上、后面总跟着别的块，`:last-child` 几乎不成立，
    于是块尾留一条底线，再接 `rule` 就是两条并排
  - `sec`（有 30px 上边距）、`mini`（自带左右装饰线）、带小标题的 `examples`
    **本身就是分隔**，前面不用再加 `rule`
  - 加新内容默认不画横线；真觉得要分隔，先试小标题或拉开间距
- **版本号跟着改动走。** 改了内容或功能就升 `content/meta.json` 的 `app.version`，
  并在 `CHANGELOG.md` 顶部加一节 —— 那份是**写给学习者看的**（这一版多了什么、
  修好了什么），不是提交日志。页脚的版本号、「最后更新」日期、更新记录链接
  都是构建时注入的，不用手改。

## 发布流程（顺序不能颠倒）
1. **先出网页版**：`npm run validate` → `npm run build` → `npm run preview`，把局域网地址给 Rae。
2. **等 Rae 在手机上看过、明确说可以**。她没点头之前不要打包、不要推 GitHub、不要动 APK。
3. 她同意后**先更新网站**：`npm run site` → `git add -A && git commit && git push`，
   约一分钟后 belajar.rae.work 生效。
4. 最后才 `/apk`：拷贝产物 → versionCode +1 → commit → push → 云端构建 → 取回 APK。

不要因为「反正最后都要打包」就提前跑第 3 步。App 装到手机上改起来麻烦，网页版改一行就能重看。

## 内容规则
- 目录职责：`content/` 是唯一内容来源；`src/` 是模板与引擎；`scripts/` 是流水线；`dist/` 是产物；`audio/` 是语音库；`inbox/` 是 Rae 放新材料的地方。
- 语体标记三种：`casual`（Cindy 私教的口语体）/ `formal`（标准语、书面、课堂）/ `neutral`。有配对的词成对存（udah ⇄ sudah），配对表在 `content/register.json`。
- 学习者语言：`zh`（主）、`ja`、`en`、`vi`。所有面向学习者的文字（释义、说明、笔记、界面文案）都是 `{"zh":…, "ja":…, "en":…, "vi":…}` 对象；印尼语始终是纯字符串。键的名单在 `scripts/lib/content.js` 的 `TRI_LANGS`。
- **哪几种语言是硬性要求，看 `content/meta.json` 的 `required_langs`。**
  **目前是 `["zh","ja","en","vi"]` —— 四语全必填，不齐不许构建。**
  （以 meta.json 为准；任何文档里写着 `["zh"]` 或「三语」的都是旧的。）
- 越南语不是中文的直译：印尼语和越南语同样是「名词在前、修饰语 / 领属在后」、
  同样分 kami / kita（chúng tôi / chúng ta）、同样有词首 ng ——
  中文版里写「跟中文相反」「中文没有这个区分」的地方，越南语版要反过来写成
  「和越南语一样」。引号用 “ ”，称呼读者用 bạn。
- 中文、日文句内引号用「」；越南语用 “ ”。
- **课文和练习一律仿写，不照抄课本**（Rae 2026-08-25 定的）。
  仓库和网站都是公开的，把整章誊清等于做了一份可替代原书的副本。
  做法：课本的**场景、语法点、固定表达、词形**照收（那些是语言事实），
  **句子自己写** —— 同样的教学目的、不同的句子。人名地名跟课本一致，
  这样同学对照着看不会错位。
- 讲义几乎每次都有笔误：静默改正内容，并加一个 `note` 块（tag「笔误修正」）告诉学习者原文错在哪。同时主动补课件没讲但一定会踩的坑（例：bisa vs boleh、harus 的否定是 gak usah / tidak perlu、Minggu 既是周日也是星期）。
- 词汇表（`content/vocab.json`）同一个词只入库一次；课内卡片可以重复出现。
- **例句里「学习者自己」的国籍写占位符**，跟着界面语言变：
  `{NEGARA}`（印尼语国名，**会进朗读文本，每种界面语言各产生一句、都要有音频**）、
  `{NAMA}`（该语言国名）、`{PEOPLE}`（该语言的「某国人」）。
  映射表在 `meta.json` 的 `learner`。**只用于第一人称** —— 讲课本人物的例句不动。
  改了映射必须重跑 `npm run tts`。
- 学习者文本里可以用 `<b>` `<i>` 强调、**`<s>词</s>` 把印尼语标成可点读**
  （表格单元格里同样有效）。其余按原样输出。
- 界面上任何文案都要走 `T()`，键要同时加进 `ui.zh/ja/en/vi.json` 四个文件，
  **键集合必须完全一致**，少一个就构建不过。
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
`npm run validate` → `npm run build`。校验内容：JSON 结构、四语齐全、语体值合法、配对可解析、词汇查重、`node --check`、jsdom 逐块渲染冒烟、实战题库压力测试（选项恰好 4 个且不重复、答案索引正确）、朗读文本的音频覆盖率。前 8 关不过会直接失败；**第 9 关（音频覆盖率）只是警告** ——
缺音频照样「✅ 全部通过」、照样能 build，真正拦下的是 `npm run site` 和
`npm run apk`。发版前自己确认覆盖率那行是 100%。
