// 第17弾B: マイライフのハブ画面「今月のレース」に添える機材適合ヒント（純関数）。
// 装備4スロットが今月のレースの地形・天候に対してプラスかマイナスかを一語で判定する。
import { PARTS, PART_SLOTS } from "../../data/parts.js";

const FAVORS_AB_KEY = { SPR: "sprint", CLM: "climb", RUL: "flat", PUN: "climb", TT: "solo" };
const FAVORS_SHORT = { SPR: "スプリント", CLM: "登坂", RUL: "平坦", PUN: "丘陵", TT: "独走" };

export function mlGearFitHint(player, race) {
  if (!player || !player.parts || !race || !race.tmpl) return null;
  const favors = race.tmpl.favors;
  const abKey = FAVORS_AB_KEY[favors];
  let fitScore = 0;
  let weatherBonus = false;
  PART_SLOTS.forEach(slot => {
    const pid = player.parts[slot];
    const p = pid && PARTS[pid];
    if (!p) return;
    if (abKey && p.ab && p.ab[abKey]) fitScore += p.ab[abKey];
    if (race.weather === "rain" && p.rain) weatherBonus = true;
    if (race.weather === "heat" && p.heat) weatherBonus = true;
    if (race.monument === "pave" && p.pave) weatherBonus = true;
  });
  const weatherLabel = race.monument === "pave" ? "石畳" : race.weather === "rain" ? "雨" : race.weather === "heat" ? "猛暑" : null;
  if (fitScore > 0) return `${FAVORS_SHORT[favors] || ""}向き${weatherBonus && weatherLabel ? `・${weatherLabel}向き` : ""}`;
  if (fitScore < 0) return `▲${FAVORS_SHORT[favors] || ""}寄りではない`;
  if (weatherBonus && weatherLabel) return `${weatherLabel}向き`;
  return null;
}
