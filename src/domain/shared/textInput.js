// ユーザー入力の文字制限（第13弾）。埋め込みフォント（チェックポイント．）が収録していない文字を
// 事前に弾くための純関数のみ。data/allowedChars.js（フォントのcmapから機械生成）に依存。
import { ALLOWED_CHARS } from "../../data/allowedChars.js";

const ALLOWED_SET = new Set(ALLOWED_CHARS);

// 半角スペース・全角スペースは表示上のセパレータとして常に許可する（フォント収録有無に関係なく）。
const ALWAYS_OK = new Set([" ", "　"]);

export function findUnsupportedChars(text) {
  const seen = new Set();
  for (const ch of String(text || "")) {
    if (ALLOWED_SET.has(ch) || ALWAYS_OK.has(ch)) continue;
    seen.add(ch);
  }
  return [...seen];
}

export function isNameSupported(text) {
  return findUnsupportedChars(text).length === 0;
}
