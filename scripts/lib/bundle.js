/**
 * 「这一版真正用得到哪些音频」—— 安卓 assets 和网页版部署共用这一份逻辑。
 *
 * audio/ 是只增不减的缓存（换教材以后旧音频还留着），
 * 全量拷贝会白白多几十兆，所以按 collectSpeakables() 的结果裁剪。
 */
import fs from 'node:fs';
import path from 'node:path';
import { P } from './paths.js';
import { loadContent, loadAudioManifest } from './content.js';
import { collectSpeakables } from './speakables.js';

/**
 * @returns {{ need: Set<string>, missing: string[] }}
 *   need    要带上的文件名（不含 .m4a 后缀）：逐句 TTS 的哈希 + listen 块的整段音轨
 *   missing 清单里没有音频的朗读文本
 */
export function neededAudio() {
  const content = loadContent();
  const manifest = loadAudioManifest().items || {};
  const speak = collectSpeakables({ drillRounds: 6000 });

  const need = new Set();
  const missing = [];
  // 跟引擎的 audioHash 对齐：逐词点读时句首那个词首字母是大写的
  // （「Baju kamu bagus.」切出来的 Baju），而词条本身是小写。印尼语大小写
  // 不改变读音，查不到就回退试一次小写 —— 引擎、validate、tts 都是这个规则。
  for (const t of speak.texts) {
    const lo = t.charAt(0).toLowerCase() + t.slice(1);
    const h = manifest[t] || manifest[lo];
    if (h) need.add(h);
    else missing.push(t);
  }
  /* 教材整段听力按文件名带上，它不走 TTS 清单 */
  for (const l of content.lessons) {
    for (const page of l.pages) for (const b of page) if (b.k === 'listen') need.add(b.file);
  }
  return { need, missing };
}

/** 把 need 里的文件从 audio/ 拷到 destDir（先清空重建）。返回 {count, bytes}。 */
export function copyAudio(need, destDir) {
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });

  let bytes = 0;
  const absent = [];
  for (const h of need) {
    const src = path.join(P.audio, h + '.m4a');
    if (!fs.existsSync(src)) { absent.push(h); continue; }
    fs.copyFileSync(src, path.join(destDir, h + '.m4a'));
    bytes += fs.statSync(src).size;
  }
  if (absent.length) {
    console.error(`\n❌ 清单里有 ${absent.length} 个音频文件在 audio/ 下找不到：${absent.slice(0, 5).join(', ')}\n`);
    process.exit(1);
  }
  return { count: need.size, bytes };
}

/** 缺音频就停下 —— 发布前覆盖率必须 100%（见 CLAUDE.md）。 */
export function assertNoMissing(missing, what) {
  if (!missing.length) return;
  console.error(`\n❌ 还有 ${missing.length} 条句子没有音频，不能${what}。`);
  console.error('   先跑 npm run tts 补齐。缺的前几条：');
  missing.slice(0, 5).forEach((t) => console.error('     ' + JSON.stringify(t)));
  console.error('   （缺的句子只能靠设备自带语音念，发音不准。）\n');
  process.exit(1);
}
