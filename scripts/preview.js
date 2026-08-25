#!/usr/bin/env node
/**
 * 本地预览：起一个静态服务器，同时伺服 dist/<app.id>.html 和 audio/。
 * 打印本机地址和局域网地址 —— 手机连同一个 Wi-Fi 就能直接打开。
 *
 * 用法：node scripts/preview.js [端口]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { ROOT, P } from './lib/paths.js';
import { distFile } from './lib/build.js';

const INDEX = distFile();

const PORT = Number(process.argv[2]) || 8787;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.m4a': 'audio/mp4',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

if (!fs.existsSync(path.join(P.dist, INDEX))) {
  console.error('还没有构建产物 —— 先跑 npm run build');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '/index.html') urlPath = '/' + INDEX;

  // audio/ 从项目根目录取，其余从 dist/ 取
  const file = urlPath.startsWith('/audio/')
    ? path.join(ROOT, urlPath)
    : path.join(P.dist, urlPath);

  // 防目录穿越
  const okRoot = urlPath.startsWith('/audio/') ? P.audio : P.dist;
  if (!path.resolve(file).startsWith(path.resolve(okRoot))) {
    res.writeHead(403).end('403');
    return;
  }
  fs.readFile(file, (e, buf) => {
    if (e) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('找不到 ' + urlPath); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const lan = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) if (n.family === 'IPv4' && !n.internal) lan.push(n.address);
  }
  console.log('');
  console.log('  预览已启动，按 Ctrl+C 停止');
  console.log('');
  console.log(`  这台 Mac：   http://localhost:${PORT}/`);
  for (const ip of lan) console.log(`  手机上打开： http://${ip}:${PORT}/   （手机要连同一个 Wi-Fi）`);
  console.log('');
  // 自动打开浏览器（NO_OPEN=1 可关掉，脚本化调用时用）
  if (!process.env.NO_OPEN) execFile('open', [`http://localhost:${PORT}/`], () => {});
});
