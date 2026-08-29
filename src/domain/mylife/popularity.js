// 第84弾: 人気度の加算＋到達ボーナス判定を、通常レースとチームTTで共有する純関数へ切り出した。
// 元はmlFinishRace内にベタ書きされていたロジック（挙動は完全に同一）。
import { POP_MILESTONES } from "../../data/economy.js";

export function applyPopGain(player, popGain) {
  const done = player.popMilestones || [];
  const popularity = Math.max(0, Math.min(100, (player.popularity || 0) + popGain));
  let popBonus = 0;
  const newlyHit = [];
  POP_MILESTONES.forEach(m => {
    if (popularity >= m.th && !done.includes(m.th)) { popBonus += m.bonus; newlyHit.push(m.th); }
  });
  return { popularity, popMilestones: [...done, ...newlyHit], popBonus, newlyHit };
}
