// 第40弾: バッジ（特殊能力）の使用量を「直近Nレースの露出率」で測るための地盤。
// raceLogの各エントリにこのレースの区間タイプ別距離割合を記録する（`segMixOf`）。
// season/mylifeの両result.jsから呼ばれる純関数。この弾では記録するだけで、
// 効果・UIへは一切接続しない（devlog/wave40.md参照）。
export function segMixOf(tmpl) {
  if (!tmpl || !tmpl.segs || !tmpl.segs.length) return undefined;
  const total = tmpl.segs.reduce((a, s) => a + s[1], 0);
  if (total <= 0) return undefined;
  const mix = {};
  tmpl.segs.forEach(([segType, dist]) => { mix[segType] = (mix[segType] || 0) + dist / total; });
  return mix;
}

// グランツール（race.stageRace）は日ごとに別テンプレ（race.stageTmpls）を走るため、
// 全日程のsegsを合算してから比率化する（日ごとの距離差が自然に重みになる）。
// 通常レースはrace.tmplの単純比率（既存のrace.stageTmpls?race.stageTmpls[day]:race.tmpl
// というフォールバック方針は season/result.js:175 と同じ）。
export function segMixOfRace(race) {
  if (!race) return undefined;
  if (race.stageTmpls && race.stageTmpls.length) {
    const totals = {};
    let grand = 0;
    race.stageTmpls.forEach(t => {
      (t?.segs || []).forEach(([segType, dist]) => { totals[segType] = (totals[segType] || 0) + dist; grand += dist; });
    });
    if (grand <= 0) return undefined;
    const mix = {};
    Object.entries(totals).forEach(([k, v]) => { mix[k] = v / grand; });
    return mix;
  }
  return segMixOf(race.tmpl);
}
