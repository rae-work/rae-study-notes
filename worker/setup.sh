#!/usr/bin/env bash
# ============================================================
# 一次性部署脚本。
#
#   1. 建数据库（已经有就直接用）
#   2. 把数据库编号填进 wrangler.toml
#   3. 建表
#   4. 部署 Worker
#   5. 把收集地址写进 worker/ENDPOINT.txt
#
# 跑之前必须先登录：npx wrangler login
# 重复跑是安全的 —— 建表语句都带 IF NOT EXISTS，不会清掉已有数据。
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:$PATH"

DB_NAME=rsn-data
W="npx --yes wrangler@4"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "① 检查登录状态"
if ! $W whoami 2>&1 | grep -qi "account"; then
  echo "还没登录 Cloudflare。先跑这一条，浏览器里点「Allow」："
  echo "    npx wrangler login"
  exit 1
fi
$W whoami 2>&1 | grep -i "account" | head -3

say "② 数据库"
if $W d1 list --json 2>/dev/null | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
    try{ process.exit(JSON.parse(s).some(x=>x.name===process.argv[1])?0:1) }catch(e){ process.exit(1) }
  })' "$DB_NAME"; then
  echo "已存在，直接用：$DB_NAME"
else
  echo "新建：$DB_NAME"
  $W d1 create "$DB_NAME"
fi

DB_ID=$($W d1 list --json | node -e '
  let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
    const m=JSON.parse(s).find(x=>x.name===process.argv[1]);
    if(!m){ console.error("找不到数据库"); process.exit(1) }
    process.stdout.write(m.uuid);
  })' "$DB_NAME")
echo "编号：$DB_ID"

say "③ 写进 wrangler.toml"
node -e '
  const fs=require("fs");
  const f="wrangler.toml";
  let t=fs.readFileSync(f,"utf8");
  t=t.replace(/^database_id\s*=\s*".*"$/m, `database_id = "${process.argv[1]}"`);
  fs.writeFileSync(f,t);
' "$DB_ID"
grep database_id wrangler.toml

say "④ 建表"
$W d1 execute "$DB_NAME" --remote --file=schema.sql

say "⑤ 部署"
DEPLOY_OUT=$($W deploy 2>&1 | tee /dev/stderr)

URL=$(printf '%s' "$DEPLOY_OUT" | grep -oE 'https://[a-z0-9.-]+\.workers\.dev' | head -1)
if [ -z "$URL" ]; then
  echo
  echo "⚠️ 没能从部署结果里认出网址。到 Cloudflare 面板 → Workers 看一眼，"
  echo "   然后手工把 <网址>/n 填进 scripts/site.js 的 COLLECT。"
  exit 0
fi

printf '%s/n\n' "$URL" > ENDPOINT.txt

say "✅ 好了"
echo "  收数据：   $URL/n           （填进 scripts/site.js 的 COLLECT）"
echo "  看统计：   $URL/lihat?k=你的口令"
echo
echo "还差最后一步 —— 设置看统计用的口令（自己想一个，输入时屏幕上不显示）："
echo "    cd worker && npx wrangler secret put VIEW_KEY"
