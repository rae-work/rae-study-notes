# 课程数据规范

> 一节课 = `content/lessons/Lxx.json` 一个文件。写完跑 `npm run validate`。
> 引擎在 `src/engine.js`，加课**不需要**改引擎或 CSS。

## 0. 通用约定

- **印尼语永远是纯字符串。** 不要包成对象。
- **面向学习者的文字永远是 `{"zh":…, "ja":…, "en":…, "vi":…}`**，四个键都必须在，值可以是 `null`。
  引擎的 `L(x)` 会按 当前语言 → zh → en → ja 兜底。
- 哪几种语言是**硬性要求**看 `content/meta.json` 的 `required_langs`（目前 `["zh","ja","en","vi"]`，四语齐全）。
- 中文 / 日文句内引号一律 `「」`，不要用 `"`。
- `reg`：`casual`（口语）/ `formal`（正式）/ `neutral`（通用）。
- `alt`：另一语体的整句。**只在整句替换完全安全时才写**，不确定就 `null`。
  `mau`（想要 / 将要）、`lagi`（正在 / 再一次）、`sama`（和 / 相同）这类有歧义的词，
  除非上下文能确定，否则留 `null`。
- 有 `alt` 的句子，`alt` 也要有音频（`npm run tts` 会自动带上）。

## 1. 文件骨架

```json
{
  "num": 14,
  "source": "UGM BIPA 1 · Bab 3（课本第 41–52 页 + 8/28 课堂笔记）",
  "reg_default": "formal",
  "name": { "zh": "自我介绍", "ja": "自己紹介", "en": "Introductions", "vi": "Giới thiệu bản thân" },
  "pages": [
    [ { "k": "phead", "...": "" }, { "k": "examples", "...": "" } ],
    [ "第 2 页的块" ]
  ]
}
```

- 课号自动排序，目录、eyebrow（`<unit_label> N`，见 meta.json，UGM 教材是 `Bab`）、徽章配色、词汇表筛选标签全部自动派生。
- **每页第一块必须是 `phead`。**
- 每页一到两屏，宁可多分页。

## 2. 块类型

`gloss` / `text` / `sub` 之类写着「多语」的字段都是 `{zh,ja,en,vi}` 对象。

| `k` | 用途 | 字段 |
|---|---|---|
| `phead` | 页标题（每页第一个） | `title`（印尼语）· `sub`（多语） |
| `lead` | 页首导语 | `text`（多语） |
| `psub2` | 小段说明 | `text`（多语） |
| `mini` | 居中小标题 | `text`（多语，可以是「中文 · indonesia」这种双语装饰） |
| `rule` | 分隔线 | 可选 `short: true` |
| `sec` | 编号大节 | `num`（①②③）· `word`（印尼语，可点读）· `reg` · `gloss`（多语，可含 `<b>`） |
| `pattern` | 句型公式框 | `code`（印尼语，可含 `<b>`）· `note`（多语） |
| `alpha` | 字母卡格 | `items: [["A","a"], …]` |
| `pics` | Emoji 图卡格 | `items: [{emoji, w, gloss}]` |
| `vocab` | 词汇卡格 | `items: [{w, reg, gloss}]` |
| `dialog` | 对话行（带 ▶） | `rows: [{who, id, reg, alt, gloss, alt_gloss, kw}]` |
| `examples` | 例句行（带 ▶） | 可选 `title`（多语）· `items: [{id, reg, alt, gloss, alt_gloss, kw}]` |
| `numgrp` | 数字格 | `glab`（多语）· `items: [["25","dua puluh lima"], …]`，`ans: true` 可遮挡 |
| `phones` | 电话号码卡 | `items: [{d, say}]` |
| `ladder` | 正式度阶梯 | `items: [{lvl（多语）, id, reg, gloss}]` |
| `currency` | 货币示例 | `rp` · `id`（印尼语读法）· `gloss`（多语） |
| `note` | 注意 / 知识框 | `tag`（多语）· `green: true/false` · `lines` |
| `prompt` | 开放任务框 | `tag`（多语）· `text`（多语） |
| `qa_list` | 问答 / 翻译练习 | 可选 `title` · `items: [{prompt, answer}]`，answer 自动可遮挡 |
| `fillblank` | 填空练习 | 可选 `title` · `items: [{pre, ans, post, say, reg, gloss}]`，ans 自动可遮挡 |
| `syll` | 发音卡（带练习工具条） | `items: [{w, s:"音节-用-连字符", gloss}]` |
| `listen` | 教材整段听力音轨 | `file`（不含扩展名）· `dur`（秒）· `title`（多语）· `note`（多语，可选） |
| `table` | 表格（语法、对照表） | `cols: [多语, …]` · `rows: [[cell, …], …]` · `note`（多语，可选） |
| `reviewbtn` | 「进入复习模式」按钮 | 无字段 |

### `note.lines`
数组，元素两种：
```json
{ "text": { "zh": "……<s>udah</s>……", "ja": "……", "en": "……", "vi": "……" } }
{ "qa": true, "who": "Q", "id": "Kamu udah makan?", "reg": "casual",
  "alt": "Anda sudah makan?", "gloss": {…}, "kw": ["udah"] }
```
`<s>词</s>` 把印尼语标成可点读。

### `qa_list.items[].prompt` / `.answer`
两种形态，按哪一侧是印尼语来写：
```json
{ "lang": "id",      "text": "Aku udah makan.", "reg": "casual", "alt": "Saya sudah makan.", "kw": ["udah"] }
{ "lang": "learner", "text": { "zh": "我已经吃过了。", "ja": "もう食べました。", "en": "I've already eaten.", "vi": "Tôi ăn rồi." } }
```

### `listen`
```json
{ "k": "listen", "file": "bab1-simakan1", "dur": 73,
  "title": { "zh": "Simakan 1 · 课本听力", … },
  "note":  { "zh": "边听边留意下面这些词…", … } }
```
音频文件放 `audio/<file>.m4a`（教材音轨手动转码，不进 TTS 清单）。
校验会检查文件存在。切页时自动停止播放。

### `table`
```json
{ "k": "table",
  "cols": [ {"zh":"人称",…}, {"zh":"单数",…} ],
  "rows": [
    [ {"text":{"zh":"第一人称",…}}, {"id":"saya","reg":"formal"} ],
    [ "",                            {"id":"aku","reg":"casual"} ]
  ],
  "note": { "zh": "…", … } }
```
单元格三种写法：`{"id":…,"reg":…}` 印尼语（可点读 + 语体徽章）·
`{"text":{多语}}` 说明文字 · `""` 空格（承接上一行）。
窄屏上表格横向滚动，不会被压扁。

### 富文本
`lead` / `psub2` / `prompt.text` / `note.lines[].text` / `table.note`
允许写 `<b>` `<i>` 强调，以及 `<s>词</s>` 把印尼语标成可点读。
其他字段一律转义，不要在里面写 HTML。

### `kw`
想在句子里标红的关键词，小写、去标点后匹配。

## 3. 词汇表 `content/vocab.json`

```json
{
  "w": "udah",
  "les": 14,
  "reg": "casual",
  "pair": "sudah",
  "gloss": { "zh": "已经", "ja": "もう（〜した）", "en": "already", "vi": "đã / rồi" },
  "pos": "adv",
  "ex": "Aku udah makan.",
  "ex_reg": "casual",
  "ex_gloss": { "zh": "我吃过了。", "ja": "もう食べた。", "en": "I've already eaten.", "vi": "Tôi ăn rồi." },
  "note": null
}
```

- **同一个词只入库一次**（课内的 `vocab` 卡片可以重复出现，复习用）。
- `pair`：另一语体的对应词。对方在词汇表里就能点击跳转，不在就只显示。
  配对表在 `content/register.json`。
- `ex` 例句硬性要求：**只用已学过的词**、越短越好（2–4 个词最佳）、符合这一课的语体。
- 复习模式的「填空」题只对 `ex` 里含 `w` 的词条生效，否则自动退化成认词题。

## 4. 实战题库 `content/drills.json`

```json
{
  "situasi": [ { "q": "Jam berapa sekarang?", "q_reg": "neutral",
                 "hint": { "zh": "现在 7 点", "ja": "いま 7 時", "en": "it's 7 o'clock", "vi": "bây giờ là 7 giờ" },
                 "a": "Jam tujuh.", "a_reg": "neutral",
                 "alts": ["Jam tuju.", "Tujuh jam.", "Setengah tujuh."] } ],
  "tempat":  [ { "hint": { "zh": "我在家", … }, "a": "Aku di rumah.", "a_reg": "casual" } ],
  "angka_pool": [1, 2, 3, "…"]
}
```

- `alts` 至少 3 条，是干扰项，**每条都会被朗读，所以都要有音频**。
- 地点题的干扰项由引擎自动生成（同句 `di` / `ke` / `dari` 互换），最能练这几个易错的介词；
  句子里没有可换的介词时自动退回从题库取别的答案，保证 4 个选项互不相同。
- **数字池必须有限** —— 每个可能读出的数都要有音频。改了它就要重跑 `npm run tts`。
- `angka_pool` 留空时，实战里的「几点了 / 数字价格」两种题型自动隐藏（教材还没教数字就这样）。

## 5. 语体配对 `content/register.json`

- `pairs`：`[["udah","sudah"], …]` 口语 ⇄ 正式。
- `safe_swap`：可以放心自动替换的词。不在这里的词，`alt` 一律留 `null`。
- `unsafe_swap`：有歧义的词 + 为什么不能机械替换。
- `casual_only`：`sih` `dong` `kok` 这类只出现在口语里的语气词。
- `formal_markers`：判定 formal 用的正式词。

新课出现新的口语 ⇄ 正式对子，往 `pairs` 里加，能安全替换的再加进 `safe_swap`。

## 6. 明确不要做的事

- 不要改引擎函数、CSS、HTML 骨架 —— 加课完全用不到。
- 不要新增 block 类型，除非现有类型确实表达不了。真要加：在 `src/engine.js` 的
  `renderBlock` 里加 `case`，在 `scripts/validate.js` 的 `BLOCK_FIELDS` 里登记，
  并更新本表。三处一起改，缺一处校验就会挡住。
- 不要手改 `dist/` 里的文件（构建产物）。
- 不要把词汇表塞进某一课底下 —— 它是顶级参考单元，固定在最后一页。
