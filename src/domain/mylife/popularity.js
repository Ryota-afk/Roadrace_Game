// 第84弾: 人気度の加算＋到達ボーナス判定を、通常レースとチームTTで共有する純関数へ切り出した。
// 元はmlFinishRace内にベタ書きされていたロジック（挙動は完全に同一）。
import { POP_MILESTONES } from "../../data/economy.js";

// 第90弾(devlog/wave90.md): 人気度の増減を1箇所に集約する純関数。増加にだけ逓減
// （人気度が高いほど上がりにくい）を掛け、減少は逓減しない——人気が高いほど
// スキャンダルの打撃が小さくなるのは逆であるため。第87弾はこの逓減をapplyPopGain
// 内にしか書いておらず、controllers/mylife/event.js（イベント・ライバル会話）・
// controllers/mylife/result.js（アシスト成功）・domain/mylife/ambition.js
// （アンビション報酬、最大+25）の4箇所が素通りしていた。第89弾の実測で
// 「毎年4〜6ヶ月は人気度100に張り付く」ことが判明したための対処。
export function popAdd(cur, delta) {
  const base = cur || 0;
  const eff = delta > 0 ? delta * (1 - base / 100) : delta;
  return Math.max(0, Math.min(100, base + eff));
}

// 第87弾(devlog/wave87.md): 獲得量に逓減を掛ける（人気度が高いほど上がりにくい）。
// 通常レース(mlFinishRace)・チームTT(mlFinishTeamTT)の両方がこの関数を通る唯一の
// 合流点のため、ここ1箇所の変更で両方に効く。第86弾の通しプレイで6年目に人気度が
// 上限100へ張り付き以後40年間動かなくなることが判明したための対処。
export function applyPopGain(player, popGain) {
  const done = player.popMilestones || [];
  const popularity = popAdd(player.popularity, popGain);
  let popBonus = 0;
  const newlyHit = [];
  POP_MILESTONES.forEach(m => {
    if (popularity >= m.th && !done.includes(m.th)) { popBonus += m.bonus; newlyHit.push(m.th); }
  });
  return { popularity, popMilestones: [...done, ...newlyHit], popBonus, newlyHit };
}
