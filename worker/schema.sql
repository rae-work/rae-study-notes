-- ============================================================
-- Rae's Study Note · 使用情况数据库（Cloudflare D1）
-- ------------------------------------------------------------
-- 两张表：
--   device  一台设备一行，存环境信息（系统、浏览器、语言、时区…）
--   ev      一条事件一行，事件自带的数据原样存成 JSON，查询时用
--           json_extract 取字段 —— 以后加新事件不用改表结构
--
-- 刻意**不存 IP**。country 由 Cloudflare 在边缘直接给出，
-- 精度只到国家，也不存城市 —— 全班就二十来人，城市加不了信息量，
-- 只会让数据更容易指认到具体某个人。
--
-- 重复执行是安全的（都带 IF NOT EXISTS）。
-- ============================================================

CREATE TABLE IF NOT EXISTS device (
  dev        TEXT PRIMARY KEY,          -- 匿名设备编号（客户端生成的随机数）
  first_ts   INTEGER NOT NULL,
  last_ts    INTEGER NOT NULL,
  sessions   INTEGER NOT NULL DEFAULT 0,
  events     INTEGER NOT NULL DEFAULT 0,

  blang      TEXT,      -- 浏览器语言，如 ja-JP
  blangs     TEXT,      -- 浏览器语言列表
  os         TEXT,
  osv        TEXT,
  br         TEXT,
  brv        TEXT,
  wv         INTEGER,   -- 是不是安卓 WebView（APK 那层壳）
  ua         TEXT,
  scr        TEXT,      -- 屏幕，如 390x844
  vp         TEXT,      -- 可见区
  dpr        REAL,
  touch      INTEGER,
  pwa        INTEGER,   -- 加到主屏幕了没有（iOS 上决定存储会不会被系统清）
  ref        TEXT,      -- 从哪儿来的
  tz         TEXT,
  tzo        INTEGER,
  dark       INTEGER,   -- 系统是不是深色
  rmo        INTEGER,   -- 系统是不是要求减少动效
  net        TEXT,      -- 4g / 3g / slow-2g…
  cpu        INTEGER,
  mem        REAL,
  country    TEXT,      -- 由 Cloudflare 给出，不存 IP
  ver        TEXT,      -- 最后见到的 App 版本
  tag        TEXT       -- 构建标记，test = 试用期数据
);

CREATE TABLE IF NOT EXISTS ev (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  ts    INTEGER NOT NULL,    -- 客户端的事件时间
  rts   INTEGER NOT NULL,    -- 服务端收到的时间（客户端时钟可能不准，对不上时以这个为准）
  dev   TEXT NOT NULL,
  ses   TEXT NOT NULL,       -- 本次访问的编号
  ev    TEXT NOT NULL,       -- 事件名：open / page / dwell / quiz.a / drill.a / say / err …
  page  TEXT,                -- 当时在哪一页，如 L2:5
  d     TEXT,                -- 事件数据（JSON 原样）
  ver   TEXT,
  tag   TEXT
);

CREATE INDEX IF NOT EXISTS ev_ts     ON ev(ts);
CREATE INDEX IF NOT EXISTS ev_ev_ts  ON ev(ev, ts);
CREATE INDEX IF NOT EXISTS ev_dev_ts ON ev(dev, ts);
CREATE INDEX IF NOT EXISTS ev_ses    ON ev(ses);
CREATE INDEX IF NOT EXISTS dev_last  ON device(last_ts);
