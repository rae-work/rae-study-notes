# 使用情况收集

网站版（**只有网站版**）会把匿名的使用情况发到这里，存进 Rae 自己 Cloudflare
账号下的一个数据库。中间产物 `dist/` 里没有任何收集代码（只有 `site.js` 生成 `docs/` 时才注入）。

- `src/index.js` —— 收数据 + 出统计页
- `schema.sql` —— 两张表：`device`（一台设备一行）、`ev`（一条事件一行）
- `setup.sh` —— 一次性部署
- `wrangler.toml` —— 配置。**口令不在这里**，在 Cloudflare 的 Secret 里

## 第一次部署

三条命令，按顺序跑。

```bash
npx wrangler login
```

浏览器会打开 Cloudflare，点一次「Allow」授权。只需要做这一次。

```bash
bash worker/setup.sh
```

建数据库、建表、部署，最后打印出两个网址。约一两分钟。

```bash
cd worker && npx wrangler secret put VIEW_KEY
```

设置看统计用的口令。自己想一个，**输入时屏幕上不会显示**，打完按回车。
这个口令不会出现在任何文件里。

跑完之后，把 `worker/ENDPOINT.txt` 里那个地址填进
[`scripts/site.js`](../scripts/site.js) 的 `COLLECT` 常量，再重新
`npm run site`，网站才会开始发数据。

## 看统计

```
https://<你的地址>/lihat?k=口令
```

第一次带上 `?k=口令`，之后浏览器会记住半年，直接开 `/lihat` 就行。
页面顶上可以切「近 7 天 / 近 30 天 / 全部」和「正式 / 试用 / 全部」。

**试用数据是分开的。** `npm run site -- --tag test` 生成的那一份，
数据带 `test` 标记，默认不算进正式统计 —— 自己在手机上翻来翻去的时候用它。

## 费用

不花钱，而且差得很远。Cloudflare 免费额度是每天 10 万次请求、
每天 10 万行写入、5 GB 存储；全班二十来人一天大概几十次请求、
几百行写入 —— 用掉的是千分之几。

## 收了什么、没收什么

**收**：匿名设备编号（随机数，存在对方浏览器里）、系统和浏览器型号、
屏幕尺寸、浏览器语言和界面语言、时区、国家、是否加了主屏幕；
翻到哪一页、停留多久、读到多深；每道题答的什么、对错、选了哪个错误选项、
用了几秒；点读了哪些词句；改了哪些设置；页面报错。

**不收**：姓名、邮箱、任何输入框里的内容、IP 地址（国家由 Cloudflare 在
边缘直接给出，IP 本身不落库）、城市（全班就二十来人，城市只会让数据
更容易指认到具体某个人）。

## 改数据结构

事件数据整条以 JSON 存在 `ev.d` 里，查询时用 `json_extract` 取字段 ——
**加新事件不用改表结构**，在 `src/engine.js` 里调一次 `TRK("名字", {...})`
就行，统计页要不要显示另说。

真要加 `device` 表的字段：改 `schema.sql`，再改 `src/index.js` 顶上的
`ENV_COLS`，然后重跑 `setup.sh`（`ALTER TABLE ... ADD COLUMN` 要自己补，
`IF NOT EXISTS` 只管建表）。

## 直接查数据库

```bash
cd worker
npx wrangler d1 execute rsn-data --remote --command "SELECT ev, COUNT(*) FROM ev GROUP BY ev"
```

## 关掉

把 `scripts/site.js` 的 `COLLECT` 改成空字符串，重跑 `npm run site` 并推上去。
网站立刻不再发任何数据，Worker 留着不管也不花钱。
彻底删：`cd worker && npx wrangler delete`。
