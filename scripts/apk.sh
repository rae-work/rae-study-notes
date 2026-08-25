#!/usr/bin/env bash
# 打 APK：拷产物 → versionCode +1 → commit → push → 云端构建 → 取回 APK
#
# ⚠️ 跑这个之前，Rae 必须已经在手机上看过网页版并说可以（见 CLAUDE.md「发布流程」）。
#
# 用法：
#   bash scripts/apk.sh                正常发版
#   bash scripts/apk.sh --version 1.5  指定 versionName（默认小版本 +0.1）
#   bash scripts/apk.sh --local        只准备 assets 和版本号，不 push 不构建
set -euo pipefail

export PATH="/opt/homebrew/bin:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ASSETS="android-app/app/src/main/assets"
GRADLE="android-app/app/build.gradle"
LOCAL_ONLY=0
FORCE_VERSION=""

while [ $# -gt 0 ]; do
  case "$1" in
    --local)   LOCAL_ONLY=1; shift ;;
    --version) FORCE_VERSION="$2"; shift 2 ;;
    *) echo "不认识的参数：$1"; exit 1 ;;
  esac
done

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ── 0. 前提检查 ──────────────────────────────────────────────
for c in node ffmpeg git gh; do
  command -v "$c" >/dev/null || { echo "❌ 找不到 $c"; exit 1; }
done
[ -f android-app/release.keystore ] || { echo "❌ 缺 android-app/release.keystore —— 没有它 APK 无法覆盖升级"; exit 1; }

say "① 校验 + 构建网页版"
node scripts/validate.js
node scripts/build.js

say "② 拷贝产物到安卓工程"
node scripts/prepare-assets.js

if [ "$LOCAL_ONLY" = "1" ]; then
  say "--local：资源已就位，没有改版本号，也没有 push 或触发构建。"
  exit 0
fi

say "③ 版本号 +1"
OLD_CODE=$(grep -oE 'versionCode [0-9]+' "$GRADLE" | grep -oE '[0-9]+')
OLD_NAME=$(grep -oE 'versionName "[^"]+"' "$GRADLE" | sed 's/versionName "//; s/"//')
NEW_CODE=$((OLD_CODE + 1))
if [ -n "$FORCE_VERSION" ]; then
  NEW_NAME="$FORCE_VERSION"
else
  NEW_NAME=$(node -e "const [a,b]='$OLD_NAME'.split('.'); console.log(a + '.' + (Number(b||0)+1))")
fi
node -e "
const fs=require('fs'), p='$GRADLE';
let s=fs.readFileSync(p,'utf8');
s=s.replace(/versionCode $OLD_CODE\b/, 'versionCode $NEW_CODE');
s=s.replace(/versionName \"$OLD_NAME\"/, 'versionName \"$NEW_NAME\"');
fs.writeFileSync(p,s);
const m='content/meta.json', j=JSON.parse(fs.readFileSync(m,'utf8'));
j.android.version_code=$NEW_CODE; j.android.version_name='$NEW_NAME';
fs.writeFileSync(m, JSON.stringify(j,null,2)+'\n');
"
echo "   versionCode $OLD_CODE → $NEW_CODE   versionName $OLD_NAME → $NEW_NAME"

# ── 4. 仓库 ──────────────────────────────────────────────────
say "④ 提交并推送"
REPO=$(node -e "console.log(require('./content/meta.json').app.id)")
if ! git remote get-url origin >/dev/null 2>&1; then
  if ! gh repo view "$REPO" >/dev/null 2>&1; then
    echo "   GitHub 上还没有 $REPO 这个仓库，正在创建（private）…"
    gh repo create "$REPO" --private --source=. --remote=origin
  else
    gh repo set-default "$REPO" >/dev/null 2>&1 || true
    git remote add origin "$(gh repo view "$REPO" --json sshUrl --jq .sshUrl)"
  fi
fi
git add -A
git commit -m "发布 v$NEW_NAME（versionCode $NEW_CODE）" || echo "   没有新改动可提交"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git push -u origin "$BRANCH"

say "⑤ 云端构建"
gh workflow run build-apk.yml --ref "$BRANCH"
sleep 5
RUN_ID=$(gh run list --workflow=build-apk.yml --limit 1 --json databaseId --jq '.[0].databaseId')
echo "   构建任务 $RUN_ID —— 大约 3–5 分钟"
gh run watch "$RUN_ID" --exit-status

say "⑥ 取回 APK"
mkdir -p dist
gh run download "$RUN_ID" --name app-release-apk --dir dist/apk
APK=$(find dist/apk -name '*.apk' | head -1)
APPNAME=$(node -e "console.log(require('./content/meta.json').app.name.replace(/[^A-Za-z0-9]+/g,''))")
FINAL="dist/$APPNAME-v$NEW_NAME.apk"
mv "$APK" "$FINAL"
rm -rf dist/apk

say "✅ 打包完成"
echo "   $FINAL   $(du -h "$FINAL" | cut -f1)"
echo ""
echo "   装到手机上：用数据线传过去，或者微信发给自己再点开安装。"
echo "   包名 $(node -e "console.log(require('./content/meta.json').android.package)")"
echo "   和旧的 Ruang Belajar 包名不同，两个可以同时装在手机上。"
echo ""
