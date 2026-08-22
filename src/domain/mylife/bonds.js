// 第18弾: 僚友（チームメイト・弟子）との絆（bonds）に関する純関数。
// 絆はプレイヤーと一緒に出走した僚友ごとに育ち、レースのチームケミストリー（chemMul）と
// 年次成長ボーナスに使われる（配線はそれぞれsim/state.jsのbuildMyLifeSim・
// controllers/mylife/month.jsの年度末処理側）。

export function bondTier(v) {
  if (v >= 90) return "無二の親友";
  if (v >= 70) return "相棒";
  if (v >= 45) return "信頼";
  if (v >= 20) return "仲間";
  return "顔見知り";
}

// スピリットが高いほど絆が早く育つ（50=1.0倍、20=0.82倍、95=1.27倍）
export function spiritMulFor(spirit) {
  return 0.7 + (spirit ?? 50) / 100 * 0.6;
}

// スピリットが高いほど絆の上限が高い（50=80、20=65、90=100）
export function bondCapFor(spirit) {
  return Math.min(100, Math.round(55 + (spirit ?? 50) * 0.5));
}

// sim.ranked（レース参加者）のうち、現在の僚友（teammates＋弟子）と一致するidの配列
export function mlCoRacedIds(sim, s) {
  const rosterIds = new Set([...(s.teammates || []).map(t => t.id), ...(s.protege ? [s.protege.id] : [])]);
  return sim.ranked.filter(e => rosterIds.has(e.id)).map(e => e.id);
}

// レース確定時に絆を更新する。共闘した僚友がいなければ無変更で返す。
export function mlBondsAfterRace(bonds, s, sim, { podium, assist }) {
  const coRacedIds = mlCoRacedIds(sim, s);
  if (!coRacedIds.length) return bonds;
  const spiritMul = spiritMulFor(s.player && s.player.spirit);
  const cap = bondCapFor(s.player && s.player.spirit);
  let gain = 2 * spiritMul;
  if (podium) gain += 1;
  if (assist) gain *= 2;
  const next = { ...bonds };
  coRacedIds.forEach(id => {
    const cur = next[id] || 0;
    next[id] = Math.min(cap, cur + gain);
  });
  return next;
}

// 年度末：現メンバー（次年度のteammates＋弟子）に居ない僚友の絆を刈り取る
export function pruneBonds(bonds, currentIds) {
  const idSet = new Set(currentIds);
  const next = {};
  Object.keys(bonds || {}).forEach(k => {
    if (idSet.has(Number(k))) next[k] = bonds[k];
  });
  return next;
}

// 実際に出走した僚友（＋弟子）の絆の平均。誰もいなければ0（＝結束ボーナスなし）
export function avgBondFor(bonds, ids) {
  if (!ids || !ids.length) return 0;
  const sum = ids.reduce((a, id) => a + ((bonds || {})[id] || 0), 0);
  return sum / ids.length;
}
