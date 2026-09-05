// 「本気度」——マイライフのレース前に金と活力を賭け、目標を達成すれば人気度と出走経験の
// 成長を余分に得る賭け（第99弾・devlog/wave99.md）。設計の要点：
//  ・案A（aiMulへの固定加算）は実測で不成立と判明した：newRiderがAI能力をabilCapで
//    クランプするため、abilCapを動かさない限りaiMulを3倍にしても表彰台率がほぼ動かない
//    （能力120でaiMul+2.00でも91%→80%）。abilCap単独でも効かない（PRO帯のAI実力は
//    平均約75でabilCap=96に届いておらず、当たっていない天井を上げても無意味）。
//  ・案B'（採用）：段は絶対値ではなく「プレイヤー能力に対する相手の格＝比」で決める。
//    較正実測でAI power÷プレイヤー能力の比が達成率をほぼ一意に決めることを確認した
//    （比0.76で総合力134/111の2条件が56%/57%と一致）。比0.82〜0.84で30〜42%、
//    0.91〜0.92で11〜20%。これを段の目標値に採用する（詳細はdevlog/wave99.md）。
//  ・単一の固定閾値は成立しない（素の3位以内率が新人8%/中堅28%/円熟56%）ため、
//    目標はクラス別固定にする（B1=入賞・A/PRO=表彰台）。
//  ⚠️賭け金・払い戻し倍率はすべて仮置き。実装後にレベル0/1/2が非支配（条件によって
//    最善が入れ替わる）ことを計測で確認すること（§10・未計測のまま済ませない）。
export const INTENSITY_LABEL = ["賭けない", "本気で", "全部賭ける"];

// 段が狙う「相手power ÷ プレイヤー能力平均」の比。buildMyLifeSim.jsで
// power = max(素のpower, プレイヤー能力平均 * この比) として使う（max()必須——
// 素の比よりこの値が低いキャラでは「賭けたのに相手が弱くなる」事故になる）。
export const INTENSITY_POWER_RATIO = [0, 0.82, 0.90];

// 賭ける活力（vitality）
export const INTENSITY_VIT = [0, 8, 16];

// 成功時、popGainの着順部分にかける倍率
export const INTENSITY_POP_MUL = [1, 1.8, 2.6];

// 成功時、出走経験の成長（addAbの係数）にかける倍率
export const INTENSITY_GROWTH_MUL = [1, 1.4, 1.9];

// 賭け金の基準額はmlPrivateCampCost（domain/mylife/growthCap.js）と同じ形。
// レベル1は基準の1/4、レベル2は基準の1/2。
const STAKE_MUL = [0, 0.25, 0.5];
export function mlIntensityStakeBase(year, classIdx) {
  return 120 + Math.max(0, (year || 1) - 1) * 40 + (classIdx || 0) * 60;
}
export function mlIntensityStake(year, classIdx, level) {
  return Math.round(mlIntensityStakeBase(year, classIdx) * (STAKE_MUL[level] || 0));
}

// 成功条件はクラス別固定（B1=入賞・10位以内／A・PRO=表彰台・3位以内）。
export function mlIntensityTarget(classIdx) {
  return classIdx === 0 ? 10 : 3;
}
export function mlIntensityTargetLabel(classIdx) {
  return classIdx === 0 ? "入賞" : "表彰台";
}
export function mlIntensitySuccess(rank, classIdx) {
  return rank != null && rank <= mlIntensityTarget(classIdx);
}

// PickRowで段を選べるか（資金・活力が足りるか）。段0は常に選べる。
export function mlIntensityCanAfford(ml, level) {
  if (!level) return true;
  const stake = mlIntensityStake(ml.year, ml.classIdx, level);
  const vit = INTENSITY_VIT[level] || 0;
  return (ml.money || 0) >= stake && (ml.player ? (ml.player.vitality ?? 100) : 100) >= vit;
}
