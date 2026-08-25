---
name: apk
description: 把 Ruang Belajar 的当前内容打包成安卓 APK 并取回本地。当 Rae 说打包、出 App、更新 App、装到手机上、APK、安卓版、发版本 时使用。⚠️ 前置条件：必须先出网页版并得到 Rae 明确同意；她没点头就不要跑。
---

# /apk · 打包安卓 App

**默认中文回答。**

## 跑之前先确认三件事

1. **Rae 已经在手机上看过网页版并说可以了。** 没有就先 `npm run build` + `npm run preview`，
   把局域网地址给她，等她回话。这是 `CLAUDE.md` 里写死的顺序，不要跳。
2. **音频覆盖率 100%。** `npm run validate` 的「语音」那行必须是满的。
   缺就先 `npm run tts`（要先报数、等她确认再跑，会花 ElevenLabs 额度）。
3. **要推 GitHub**，这属于需要先确认的操作。跟她说一句再动。

## 怎么跑

```bash
bash scripts/apk.sh
```

脚本会依次做：校验 → 构建 → 检查音频覆盖率 → 拷 `dist/belajar.html` 和 `audio/` 进安卓工程
→ versionCode +1 / versionName 小版本 +0.1 → commit → push → 触发云端构建 → 等完成 → 下载
`dist/RuangBelajar-vX.Y.apk`。

参数：
- `--version 1.5` 指定版本名
- `--local` 只准备资源和版本号，不推不构建（想先看看拷进去对不对时用）

## 要点

- **签名**：`android-app/release.keystore`（PKCS12，别名 `appkey`，指纹 `84DC35E8…9E1198`）。
  必须一直用同一把，否则手机上装不了覆盖升级。工作流里有一步会核对指纹，不对就直接失败。
  这个文件绝不能删、不能改。
- **云端构建只能手动触发**（`workflow_dispatch`）。推代码不会自动打包 —— 这是故意的，
  免得内容一改就出一个包。
- **音频路径**：网页版和 APK 都用相对路径 `audio/`。不要再分 `voices/`。
- 首次发布时仓库若不存在，脚本会 `gh repo create ruang-belajar --private` 建好。

## 出问题怎么办

| 现象 | 原因 | 处理 |
|---|---|---|
| 脚本停在「还有 N 条句子没有音频」 | 有新内容还没合成 | 先 `npm run tts` |
| 工作流报「签名不对」 | keystore 被换过或口令不对 | 别硬改，先查 `android-app/release.keystore` 是不是原来那个 |
| `gh run watch` 失败 | 云端构建挂了 | `gh run view <id> --log-failed` 看日志 |
| 手机提示「应用未安装」 | 上一版签名不同（旧的 debug 签名） | 这是历史遗留，让 Rae 先卸载旧版再装。之后都能覆盖升级 |

打完包告诉 Rae：文件在哪、多大、能不能直接覆盖升级。
