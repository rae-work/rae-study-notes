/**
 * 读 .env 里的密钥。
 * 只把值交给需要它的请求头，从不打印、从不写进日志或产物。
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.js';

export function loadEnv() {
  const f = path.join(ROOT, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] == null) process.env[m[1]] = v;
  }
}

/** 取密钥。拿不到就给一条 Rae 能照抄的修复说明，且不泄露任何内容。 */
export function requireKey(name = 'ELEVENLABS_API_KEY') {
  loadEnv();
  const v = process.env[name];
  if (!v) {
    console.error(
      `\n找不到 ${name}。\n` +
      `请确认项目根目录下有 .env 文件，里面有一行：\n` +
      `  ${name}=你的密钥\n` +
      `（.env 已经在 .gitignore 里，不会被提交；也不要把密钥贴进聊天。）\n`,
    );
    process.exit(1);
  }
  return v;
}
