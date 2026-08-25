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

脚本会依次做：校验 → 构建 → `prepare-assets`（把产物和**这一版用得到的**音频
摆进安卓工程）→ versionCode +1 / versionName 次版本号 +1（`1.9 → 1.10`）→
commit → push → 触发云端构建 → 等完成 → 下载 `dist/RaesStudyNote-vX.Y.apk`。

参数：
- `--version 1.5` 指定版本名
- `--local` 只准备资源和版本号，不推不构建（想先看看拷进去对不对时用）

## 要点

- **签名密钥不在仓库里。** 本机那份 `android-app/release.keystore` 只是母本
  （已 gitignore，`apk.sh` 会检查它在不在）。云端从 GitHub Secret
  `KEYSTORE_BASE64` 还原，构建完擦掉；口令和别名走另外三个 Secret
  （`KEYSTORE_PASSWORD` / `KEY_ALIAS` / `KEY_PASSWORD`），`build.gradle` 里
  **不留任何默认值**，缺了就直接报错。
  **不要把密钥或口令写回任何文件** —— 仓库是公开的。
  工作流有一步核对指纹 `84DC35E8…9E1198`，不对直接失败。
- **仓库是公开的**，而且 GitHub Pages 从 `main` 的 `/docs` 发布。
  `apk.sh` 用的是 `git add -A` + push 当前分支，所以这一推同时：
  代码公开、**线上网站被更新**、才轮到打包。跟 Rae 确认时要把这点说出来。
  跑之前确认 `git status` 干净、**自己在 `main` 上**
  （`history-archive-private` 分支含旧密钥，永远不能推）。
- **打包前先更新网站**（`npm run site` + push），别让线上落后于 APK。
- **离线防线**：`prepare-assets.js` 会扫打包用的 HTML，出现外部 `<script src>`、
  外部 `<link href>`、任何 `src=` / `action=` 指向 http(s)、或 `@font-face`，
  直接 exit(1)。`<a href="https://">` 超链接放行。
- **云端构建只能手动触发**（`workflow_dispatch`）。推代码不会自动打包。
- **音频路径**：网页版和 APK 都用相对路径 `audio/`。
- `android-app/build-apk.sh` 是**废弃文件**（上一代沙箱脚本，包名还是旧的），
  别当成打包入口。唯一路径是 `scripts/apk.sh` + `.github/workflows/build-apk.yml`。

## 出问题怎么办

| 现象 | 原因 | 处理 |
|---|---|---|
| 脚本停在「还有 N 条句子没有音频」 | 有新内容还没合成 | 先 `npm run tts` |
| `❌ 打包用的 index.html 会加载外部资源` | 多半是把 `docs/index.html`（带统计那份）拷进了 assets | `npm run build` 之后跑 `npm run prepare-assets`，不要手工拷 |
| 云端挂在 aapt 资源编译 | `strings.xml` 里 `Rae\'s` 的撇号没转义 | Android 资源里裸 `'` 非法，必须写 `\'`。改 App 名时留意 |
| 工作流报「缺 Secret：KEYSTORE_BASE64」 | Secret 没设或被删 | `base64 -i android-app/release.keystore \| gh secret set KEYSTORE_BASE64` |
| 工作流报「签名不对」 | Secret 里的密钥不是原来那把 | 别硬改，先确认本机 `release.keystore` 是原件，再重设 Secret |
| `gh run watch` 失败 | 云端构建挂了 | `gh run view <id> --log-failed` 看日志 |
| 手机提示「应用未安装」 | 签名变了 | 新包名 `com.raenotes.app` 和旧的 `com.ruangbelajar.app` **不同，两个可以同时装**，不需要卸载旧版。出现这个只可能是签名问题 |

打完包告诉 Rae：文件在哪、多大、能不能直接覆盖升级。
