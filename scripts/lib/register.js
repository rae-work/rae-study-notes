/**
 * 语体判定与语体转换 —— validate.js / extract-legacy.js / tts.js 共用。
 * 判定依据：content/register.json。
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.js';

export const REG = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'content/register.json'), 'utf8'),
);

/** 印尼语分词：按空白切开，去掉两端标点，转小写。 */
export function tokens(s) {
  return String(s)
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}'’-]+|[^\p{L}\p{N}'’-]+$/gu, '').toLowerCase())
    .filter(Boolean);
}

const CASUAL_SET = new Set([
  ...REG.pairs.map(([c]) => c.toLowerCase()),
  ...REG.casual_only.map((w) => w.toLowerCase()),
]);
const FORMAL_SET = new Set(REG.formal_markers.map((w) => w.toLowerCase()));
const SAFE = new Set(REG.safe_swap.map((w) => w.toLowerCase()));
const PAIR = new Map(REG.pairs.map(([c, f]) => [c.toLowerCase(), f]));
/** 多词配对（gak usah / terima kasih）需要在整句上匹配，不能靠单 token。 */
const MULTI = REG.pairs.filter(([c]) => c.includes(' '));

/**
 * 判定一句印尼语的语体。
 *   casual  —— 出现任一口语标记
 *   formal  —— 没有口语标记，但出现正式标记
 *   neutral —— 两边都没有
 */
export function detectRegister(text) {
  if (!text) return 'neutral';
  const low = String(text).toLowerCase();
  const tk = tokens(text);
  for (const [c] of MULTI) if (low.includes(c.toLowerCase())) return 'casual';
  if (tk.some((t) => CASUAL_SET.has(t))) return 'casual';
  if (tk.some((t) => FORMAL_SET.has(t))) return 'formal';
  return 'neutral';
}

/** 这句话里出现了哪些口语标记（原样返回小写词）。 */
export function casualMarkers(text) {
  const low = String(text).toLowerCase();
  const found = new Set();
  for (const [c] of MULTI) if (low.includes(c.toLowerCase())) found.add(c.toLowerCase());
  for (const t of tokens(text)) if (CASUAL_SET.has(t)) found.add(t);
  return [...found];
}

/**
 * 保守生成正式体整句。
 * 只有当句中**每一个**口语标记都在 safe_swap 白名单里才返回结果；
 * 只要碰到一个有歧义的词（mau / lagi / sama…）就返回 null，交给人工补。
 */
export function toFormal(text) {
  if (!text) return null;
  const marks = casualMarkers(text);
  if (!marks.length) return null;
  if (!marks.every((m) => SAFE.has(m))) return null;

  let out = String(text);
  // 先换多词配对，再换单词，避免 "gak usah" 被 "gak" 抢先切碎
  for (const [c, f] of MULTI) {
    if (!SAFE.has(c.toLowerCase())) continue;
    out = out.replace(new RegExp(`\\b${escapeRe(c)}\\b`, 'gi'), (m) => matchCase(m, f));
  }
  out = out.replace(/[\p{L}\p{N}'’-]+/gu, (w) => {
    const rep = PAIR.get(w.toLowerCase());
    if (!rep || !SAFE.has(w.toLowerCase())) return w;
    return matchCase(w, rep);
  });
  return out === text ? null : out;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** 原词首字母大写就把替换词也大写，保住句首。 */
function matchCase(orig, rep) {
  if (/^[A-Z]/.test(orig)) return rep.charAt(0).toUpperCase() + rep.slice(1);
  return rep;
}
