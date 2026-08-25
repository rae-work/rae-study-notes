#!/usr/bin/env node
/**
 * 语音合成（ElevenLabs）—— 增量，只补缺的。
 *
 *   1. collectSpeakables() 把产物真跑一遍，列出所有该有音频的印尼语
 *   2. 和 audio/manifest.json 对比，挑出缺的
 *   3. 报告条数 / 字符数 / 预计消耗 / 账号余额，等确认
 *   4. 合成 mp3（并发 3，失败重试 3 次）
 *   5. ffmpeg 转 AAC 64k / 32 kHz 单声道 .m4a
 *   6. 更新 manifest
 *
 * 硬性约束（都是踩过的坑）：
 *   · 模型 eleven_multilingual_v2，**绝不传 language_code**（会 400）
 *   · 文本原样送，保留 ? !（问号决定升调）
 *   · 转码固定 64k / 32 kHz，不要往下降
 *
 * 用法：
 *   node scripts/tts.js            先报计划，等确认
 *   node scripts/tts.js --yes      确认过了，直接跑
 *   node scripts/tts.js --dry      只报计划，什么都不做
 *   node scripts/tts.js --limit 5  只合成前 5 条（小规模试音质）
 *   node scripts/tts.js --voices   列出账号里的声音，不消耗额度
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { P } from './lib/paths.js';
import { loadContent, loadAudioManifest } from './lib/content.js';
import { collectSpeakables } from './lib/speakables.js';
import { requireKey } from './lib/env.js';

const execFileP = promisify(execFile);
const API = 'https://api.elevenlabs.io/v1';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const YES = has('--yes');
const DRY = has('--dry');
const LIMIT = Number(val('--limit', 0)) || 0;

const content = loadContent();
const voice = content.meta.voice;
const A = content.meta.audio;
const KEY = requireKey();
const HEAD = { 'xi-api-key': KEY };

/* ── --voices：列出声音（只读，不消耗额度）───────────────── */

if (has('--voices')) {
  const r = await fetch(`${API}/voices`, { headers: HEAD });
  if (!r.ok) fail(`列出声音失败：HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const list = (await r.json()).voices || [];
  console.log(`账号里共 ${list.length} 个声音：\n`);
  for (const v of list) {
    const mine = v.voice_id === voice.voice_id ? '  ← meta.json 里用的就是这个' : '';
    console.log(`  ${v.name}`);
    console.log(`    ${v.voice_id}${mine}`);
  }
  process.exit(0);
}

/* ── 1–2. 算出缺哪些 ─────────────────────────────────────── */

if (!voice.voice_id) fail('content/meta.json 里 voice.voice_id 还是空的。');
if (voice.language_code) fail('meta.json 里设了 language_code —— eleven_multilingual_v2 传这个会 400，去掉。');

console.log('正在跑一遍构建产物，收集所有该有音频的句子…');
const speak = collectSpeakables({ drillRounds: 6000 });
const manifest = loadAudioManifest();
const items = { ...(manifest.items || {}) };

const missing = speak.texts.filter((t) => {
  if (!items[t]) return true;
  return !fs.existsSync(path.join(P.audio, items[t] + A.ext));
});
const todo = LIMIT ? missing.slice(0, LIMIT) : missing;
const chars = todo.reduce((n, t) => n + [...t].length, 0);

/* ── 3. 报告 + 确认 ──────────────────────────────────────── */

let quota = null;
try {
  const r = await fetch(`${API}/user/subscription`, { headers: HEAD });
  if (r.ok) {
    const j = await r.json();
    quota = { used: j.character_count, limit: j.character_limit, left: j.character_limit - j.character_count, tier: j.tier };
  }
} catch { /* 查不到额度不影响合成 */ }

console.log('');
console.log('━━━ 合成计划 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`该有音频的句子   ${speak.texts.length} 条`);
console.log(`已有             ${speak.texts.length - missing.length} 条`);
console.log(`这次要合成       ${todo.length} 条${LIMIT && missing.length > LIMIT ? `（--limit ${LIMIT}，剩下 ${missing.length - LIMIT} 条下次）` : ''}`);
console.log(`字符数           ${chars}`);
console.log(`预计消耗         约 ${chars} credits（multilingual_v2 按 1:1 计费）`);
if (quota) {
  console.log(`账号额度         已用 ${quota.used} / ${quota.limit}，还剩 ${quota.left}（${quota.tier}）`);
  if (quota.left < chars) console.log(`⚠️  额度不够了，差 ${chars - quota.left} —— 先别跑，等下个月或升档。`);
}
console.log(`声音             ${voice.voice_name}（${voice.voice_id}）`);
console.log(`模型             ${voice.model_id}（不传 language_code）`);
console.log('');
if (todo.length) {
  console.log('前几条：');
  todo.slice(0, 8).forEach((t) => console.log('   ' + JSON.stringify(t)));
  console.log('');
}

if (!todo.length) { console.log('✅ 一条都不缺，什么都不用做。'); process.exit(0); }
if (DRY) { console.log('（--dry：只报计划，没有真的合成。）'); process.exit(0); }
if (quota && quota.left < chars) process.exit(1);

if (!YES) {
  if (!process.stdin.isTTY) {
    console.log('这一步要花 ElevenLabs 的额度。确认没问题就跑：');
    console.log('');
    console.log('  npm run tts -- --yes');
    console.log('');
    process.exit(0);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise((res) => rl.question(`确认合成这 ${todo.length} 条（约 ${chars} credits）？[y/N] `, res));
  rl.close();
  if (!/^y(es)?$/i.test(ans.trim())) { console.log('取消了，什么都没做。'); process.exit(0); }
}

/* ── 4. 合成 ─────────────────────────────────────────────── */

fs.mkdirSync(P.audio, { recursive: true });
const tmpDir = path.join(P.audio, '.mp3');
fs.mkdirSync(tmpDir, { recursive: true });

const hashOf = async (text) => {
  const { createHash } = await import('node:crypto');
  return createHash('md5').update(text, 'utf8').digest('hex').slice(0, 16);
};

const CONCURRENCY = voice.concurrency || 3;
const RETRIES = 3;
const done = [];
const failed = [];
let n = 0;

async function synth(text) {
  const body = {
    text,
    model_id: voice.model_id,
    voice_settings: voice.voice_settings,
    // 注意：绝不加 language_code —— multilingual_v2 会直接 400
  };
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const r = await fetch(`${API}/text-to-speech/${voice.voice_id}`, {
        method: 'POST',
        headers: { ...HEAD, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = (await r.text()).slice(0, 300);
        if (r.status === 401 || r.status === 402) throw Object.assign(new Error(`HTTP ${r.status}：${t}`), { fatal: true });
        throw new Error(`HTTP ${r.status}：${t}`);
      }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 500) throw new Error(`返回的音频太小（${buf.length} 字节），可能是空音`);
      return buf;
    } catch (e) {
      if (e.fatal) throw e;
      lastErr = e;
      if (attempt < RETRIES) await sleep(600 * attempt);
    }
  }
  throw lastErr;
}

async function one(text) {
  const hash = await hashOf(text);
  const mp3 = path.join(tmpDir, hash + '.mp3');
  const m4a = path.join(P.audio, hash + A.ext);
  if (!fs.existsSync(mp3)) fs.writeFileSync(mp3, await synth(text));
  await execFileP('ffmpeg', [
    '-nostdin', '-v', 'error', '-y', '-i', mp3,
    '-c:a', 'aac', '-b:a', A.transcode.bitrate,
    '-ar', String(A.transcode.sample_rate), '-ac', String(A.transcode.channels),
    m4a,
  ]);
  const { stdout } = await execFileP('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', m4a]);
  const dur = parseFloat(stdout.trim());
  if (!(dur > 0.05)) throw new Error(`转码后时长异常（${stdout.trim()}）`);
  items[text] = hash;
  done.push({ text, hash, dur });
  n++;
  process.stdout.write(`\r  ${n}/${todo.length}  ${String(text).slice(0, 40)}${' '.repeat(20)}`);
}

console.log(`开始合成（并发 ${CONCURRENCY}）…`);
const queue = todo.slice();
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const t = queue.shift();
    try { await one(t); }
    catch (e) {
      if (e.fatal) { console.error(`\n致命错误，停下：${e.message}`); queue.length = 0; failed.push({ text: t, e: e.message }); return; }
      failed.push({ text: t, e: e.message });
      n++;
    }
  }
}));
process.stdout.write('\r' + ' '.repeat(80) + '\r');

/* ── 6. 更新 manifest ────────────────────────────────────── */

const sorted = {};
for (const k of Object.keys(items).sort()) sorted[k] = items[k];
const out = {
  ...manifest,
  version: 1,
  hash: A.hash,
  format: { codec: A.transcode.codec, bitrate: A.transcode.bitrate, sample_rate: A.transcode.sample_rate, channels: A.transcode.channels, ext: A.ext },
  source: { engine: 'elevenlabs', model: voice.model_id, voice_id: voice.voice_id, voice_name: voice.voice_name },
  count: Object.keys(sorted).length,
  items: sorted,
};
fs.writeFileSync(path.join(P.audio, 'manifest.json'), JSON.stringify(out, null, 0) + '\n');

console.log('');
console.log(`✅ 新合成 ${done.length} 条${failed.length ? `，失败 ${failed.length} 条` : ''}`);
if (done.length) {
  const tot = done.reduce((s, d) => s + d.dur, 0);
  console.log(`   总时长 ${tot.toFixed(1)} 秒，平均 ${(tot / done.length).toFixed(2)} 秒/条`);
}
if (failed.length) {
  console.log('   失败的：');
  failed.slice(0, 10).forEach((f) => console.log(`     ${JSON.stringify(f.text)} → ${f.e}`));
  console.log('   重跑一次 npm run tts 会只补这些（已成功的会跳过）。');
}
console.log(`   manifest 现在 ${out.count} 条`);
console.log('');
console.log('下一步：npm run build，然后 npm run preview 在手机上听一遍。');
if (failed.length) process.exit(1);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function fail(m) { console.error('\n' + m + '\n'); process.exit(1); }
