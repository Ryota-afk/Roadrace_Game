// マイライフの「大望の道」進捗・報酬付与。第13弾Phase0でlogic/support.jsから分離。
import { AB_KEYS } from "../../data/abilities.js";
import { GROWTH_POW_LADDER } from "../../data/progression.js";
import { ML_AMBITION_PATHS, mlAmbitionMetricValue } from "../../state/state.js";
import { addAb } from "../shared/growth.js";

export function mlAmbitionPath(ml) { return ML_AMBITION_PATHS[ml.ambitionPath] || ML_AMBITION_PATHS.victory; }

export function mlCurrentAmbition(ml) {
  const rungs = mlAmbitionPath(ml).rungs;
  const idx = ml.ambitionIdx || 0;
  return idx < rungs.length ? rungs[idx] : null;
}

export function mlAmbitionProgressText(ml, amb) {
  if (!amb) return "";
  if (amb.metric === "rankAtMost") return `現在 世界${ml.worldRank == null ? "—" : ml.worldRank}位 ／ 目標 ${amb.target}位以内`;
  return `${mlAmbitionMetricValue(ml, amb.metric)} / ${amb.target}`;
}

export function bumpGrowthPow(pow, steps = 1) {
  let i = GROWTH_POW_LADDER.indexOf(pow);
  if (i < 0) return pow;
  return GROWTH_POW_LADDER[Math.min(GROWTH_POW_LADDER.length - 1, i + steps)];
}

export function applyAmbitionReward(reward, player, money) {
  const parts = [];
  let newMoney = money;
  if (reward.money) { newMoney += reward.money; parts.push(`資金+${reward.money}万円`); }
  if (reward.pop) { player.popularity = Math.max(0, Math.min(100, (player.popularity || 0) + reward.pop)); parts.push(`人気+${reward.pop}`); }
  if (reward.ab) { AB_KEYS.forEach(k => addAb(player, k, reward.ab, 130)); parts.push(`全能力+${reward.ab}`); }
  if (reward.growth) { player.growthPow = bumpGrowthPow(player.growthPow, reward.growth); parts.push(`成長力→${player.growthPow}`); }
  return { money: newMoney, text: parts.join("・") };
}
