// 第84弾: 人気度の加算＋到達ボーナス判定を、通常レースとチームTTで共有する純関数へ切り出した。
// 元はmlFinishRace内にベタ書きされていたロジック（挙動は完全に同一）。
import { POP_MILESTONES } from "../../data/economy.js";

// 第87弾(devlog/wave87.md): 獲得量に逓減を掛ける（人気度が高いほど上がりにくい）。
// 通常レース(mlFinishRace)・チームTT(mlFinishTeamTT)の両方がこの関数を通る唯一の
// 合流点のため、ここ1箇所の変更で両方に効く。第86弾の通しプレイで6年目に人気度が
// 上限100へ張り付き以後40年間動かなくなることが判明したための対処。
export function applyPopGain(player, popGain) {
  const done = player.popMilestones || [];
  const cur = player.popularity || 0;
  const effective = popGain * (1 - cur / 100);
  const popularity = Math.max(0, Math.min(100, cur + effective));
  let popBonus = 0;
  const newlyHit = [];
  POP_MILESTONES.forEach(m => {
    if (popularity >= m.th && !done.includes(m.th)) { popBonus += m.bonus; newlyHit.push(m.th); }
  });
  return { popularity, popMilestones: [...done, ...newlyHit], popBonus, newlyHit };
}
