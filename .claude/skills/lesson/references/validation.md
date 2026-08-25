# 校验与流水线

```bash
npm run validate     # 九道关，一道不过就退出码非 0
npm run build        # → dist/<meta.app.id>.html
npm run preview      # 本地 + 局域网地址，手机能开
npm run tts          # 增量合成语音（先报数，等确认）
npm run apk          # 打包安卓（要 Rae 先确认过网页版）
```

参数：
- `npm run validate -- --allow-todo` 内容还没补齐时用：三语不齐只警告不失败
- `npm run validate -- --quick` 跳过要跑 jsdom 的第 7–9 关（快，但覆盖不全）

## 九道关

| # | 关卡 | 查什么 | 常见失败 |
|---|---|---|---|
| 1 | 结构 | 课号不重复、必填字段齐、每页首块是 `phead`、block 类型已登记、词条 `les` 有对应课程、情景题干扰项 ≥3 | 新增 block 类型忘了在 `BLOCK_FIELDS` 里登记 |
| 2 | 三语 | `required_langs` 里的语言不能为空；`ui.*.json` 三个文件键集合必须完全一致 | 三语对象少写一个键 |
| 3 | 语体 | `reg` 只能是 casual/formal/neutral；`alt` 不能和原句相同；`alt` 不能仍被判为口语体 | `alt` 里漏换了一个口语词 |
| 4 | 配对 | `register.json` 自洽：无重复、两端不同、`safe_swap` 里的词在 `pairs` 里有配对、`casual_only` 和 `pairs` 不重叠 | 往 `safe_swap` 加词时忘了先加进 `pairs` |
| 5 | 查重 | 同一个词只入库一次（不分大小写） | 新课的词上一课已经有了 |
| 6 | 语法 | `src/` 下每个 `.js` + 构建产物里的脚本都过 `node --check` | 中文里写了 ASCII 双引号，截断了字符串 |
| 7 | 渲染 | jsdom 逐页渲染：不抛异常、不出空页、不出现 `undefined` / `[object Object]` / `NaN`；**英文界面渗漏检查** | 插值字段名写错；界面文案写死没走 `T()` |
| 8 | 实战 | 出题 5000 次：选项恰好 4 个、互不相同、`opts[ok]` 确实等于正确答案；四种题型都能出到 | 干扰项和正确答案撞了 |
| 9 | 语音 | 每个会朗读的句子都在音库里 | 新内容还没跑 `npm run tts` |

## 英文界面渗漏检查（第 7 关的一部分）

把界面切成英文，跑完所有页面 + 复习四种题型（含答错的反馈区和结算页）+ 实战全流程，
渲染出的文字里**出现任何中日文字符就算失败**。语言切换器里的「中文 / 日本語 / English」
按各自语言写，已排除在外。

这一关专门抓「某个按钮 / 提示 / 标题忘了走 `T()`」—— 光靠肉眼看中文界面永远发现不了。

## 「哪些句子需要音频」只有一个定义

`scripts/lib/speakables.js` 的 `collectSpeakables()`。它不是照抄引擎逻辑（会漂移），
而是**把构建产物真的跑起来**：

1. 逐页渲染，收集 DOM 里所有 `[data-say]`
2. 对每个词条调 `glossCard()` 收词汇表的（词汇表是分批渲染的，收不到）
3. 跑几千次 `drMake()`，把实战模式可能读出的每一句逼出来
4. 加上复习模式会读的词条和例句
5. 加上所有 `alt` 整句

`validate.js` 和 `tts.js` 都调这一个函数，两边不可能不一致。

**中文 / 日文 / 英文提示不收。** 实战题目的 `showLang` 字段标出题面是不是印尼语
（`id` = 印尼语会朗读 · `num` = 时钟/数字 · `learner` = 学习者语言提示）。

## 朗读文本的两个清洗函数，别用错

| 函数 | 保留 | 用在哪 |
|---|---|---|
| `clean()` | 剥掉全部标点 | **只用于句内逐词点读**（单个词不该带问号） |
| `sayText()` | 保留 `? ! . ,`，只去掉引号括号斜杠 | **整句朗读、词条、卡片一律用这个** |

早期整句朗读误用了 `clean()`，`Jam berapa?` 变成 `Jam berapa` 送进 TTS，
**110 条问句被读成陈述句**。新增块类型或改 `data-say` 生成逻辑时，
检查一遍整句用的是不是 `sayText()`。

## 语音合成

- 模型 `eleven_multilingual_v2`。**绝不传 `language_code`** —— 这个模型收到就 400。
- 声音 ID 在 `content/meta.json` 的 `voice.voice_id`。
- 增量：文件名 = `md5(utf8(朗读文本)).hex[:16]`，只合成 `audio/` 里缺的。
  中途断了直接重跑，已成功的会跳过。
- 并发 3，失败重试 3 次；401 / 402 属于致命错误，立刻停下（不要一直重试烧额度）。
- 转码固定 `ffmpeg -c:a aac -b:a 64k -ar 32000 -ac 1`。
  **24 kHz 会削掉印尼语 ny / sy / c 的高频，实测过，不要往下降。**
- 跑完每个文件都会 `ffprobe` 确认时长 > 0.05 秒，防止写进一个空音。

## 音库体检（怀疑 manifest 错位时跑）

```bash
node -e '
const fs=require("fs");
const m=JSON.parse(fs.readFileSync("audio/manifest.json","utf8"));
const inv=Object.fromEntries(Object.entries(m.items).map(([k,v])=>[v,k]));
const {execSync}=require("child_process");
let xs=[],ys=[];
for(const [h,t] of Object.entries(inv).slice(0,400)){
  const d=+execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 audio/${h}.m4a`).toString();
  xs.push(t.length); ys.push(d);
}
const n=xs.length,mx=xs.reduce((a,b)=>a+b)/n,my=ys.reduce((a,b)=>a+b)/n;
const cov=xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0);
const sx=Math.sqrt(xs.reduce((s,x)=>s+(x-mx)**2,0)),sy=Math.sqrt(ys.reduce((s,y)=>s+(y-my)**2,0));
console.log("文本长度 vs 音频时长 r =",(cov/(sx*sy)).toFixed(4),"（要 >0.85）");
'
```

低于 0.85 说明 manifest 和文件对不上号，别继续，先查哈希算法。
