// 静的データ（第16弾D）。sim/race.jsから分離した機材・パーツ定義。純粋な定数のみ。
// 第17弾：全パーツがプラス効果のみだった状態からトレードオフ導入へリワーク。
// ab = 常時のプラス効果（partLvの強化倍率がかかる）。
// rain/dry = 天候「雨」時のみ発動する効果差分（rainはプラス、dryは晴/猛暑時のみのマイナス）。
// pave/offPave = 石畳モニュメント限定の効果差分。heat = 猛暑時のみの効果。
// これらの条件付き効果にはpartLvの強化倍率をかけない（強化するほど逆地形のマイナスが
// 深くなる・雨効果が伸びるのは分かりづらいため）。
export const PART_SLOTS = ["frame", "tire", "wheels", "nutrition"];

export const PARTS = {
  fr_sprint: { slot: "frame", tier: 1, label: "スプリントフレーム", ab: { sprint: 4, climb: -2 }, price: 28 },
  fr_aero:   { slot: "frame", tier: 1, label: "エアロロードフレーム", ab: { flat: 4, climb: -2 }, price: 28 },
  fr_light:  { slot: "frame", tier: 1, label: "超軽量クライムフレーム", ab: { climb: 4, flat: -2 }, price: 28 },
  ti_endure: { slot: "tire", tier: 1, label: "耐久タイヤ", ab: { stamina: 4, sprint: -2 }, price: 22 },
  ti_tt:     { slot: "tire", tier: 1, label: "TTタイヤ", ab: { solo: 4, sprint: -2 }, price: 22 },
  ti_grip:   { slot: "tire", tier: 1, label: "グリップタイヤ", ab: { sprint: 2, climb: 2 }, price: 22 },
  wh_light:  { slot: "wheels", tier: 1, label: "軽量ホイール", ab: { climb: 4, flat: -2 }, price: 24 },
  wh_aero:   { slot: "wheels", tier: 1, label: "エアロホイール", ab: { flat: 4, climb: -2 }, price: 24 },
  nu_gel:    { slot: "nutrition", tier: 1, label: "エナジージェル", ab: { stamina: 5 }, price: 18 },
  nu_bar:    { slot: "nutrition", tier: 1, label: "カフェインジェル", ab: { sprint: 3, stamina: 3 }, price: 18 },
  fr_sprint2:{ slot: "frame", tier: 2, label: "スプリントフレームPro", ab: { sprint: 6, climb: -3 }, price: 48 },
  fr_aero2:  { slot: "frame", tier: 2, label: "エアロフレームPro", ab: { flat: 6, climb: -3 }, price: 48 },
  fr_light2: { slot: "frame", tier: 2, label: "クライムフレームPro", ab: { climb: 6, flat: -3 }, price: 48 },
  ti_race:   { slot: "tire", tier: 2, label: "レーシングタイヤ", ab: { sprint: 3, solo: 3, stamina: -2 }, price: 40 },
  wh_race:   { slot: "wheels", tier: 2, label: "レーシングホイール", ab: { flat: 4, climb: 4 }, price: 44 },
  nu_pro:    { slot: "nutrition", tier: 2, label: "プロ仕様補給食", ab: { stamina: 8 }, price: 36 },
  fr_ult:    { slot: "frame", tier: 3, label: "モノコックUltimate", ab: { flat: 5, climb: 5, sprint: 5 }, price: 90 },
  ti_ult:    { slot: "tire", tier: 3, label: "レーシングプロトUltimate", ab: { sprint: 4, solo: 8 }, price: 70 },
  wh_ult:    { slot: "wheels", tier: 3, label: "エアロクライムUltimate", ab: { flat: 6, climb: 6 }, price: 80 },
  nu_ult:    { slot: "nutrition", tier: 3, label: "アルティメット補給食", ab: { stamina: 6, sprint: 4 }, price: 60 },
  // 第17弾：天候・地形特化ギア3種
  ti_rain: {
    slot: "tire", tier: 1, label: "雨天用タイヤ", ab: {},
    rain: { mulShift: 0.04, crashHalf: true }, dry: { flat: -2, sprint: -2 }, price: 26,
  },
  ti_pave: {
    slot: "tire", tier: 2, label: "石畳用タイヤ", ab: {},
    pave: { mul: 1.04 }, offPave: { sprint: -2, solo: -2 }, price: 34,
  },
  nu_cool: {
    slot: "nutrition", tier: 1, label: "冷感ボトルセット", ab: {},
    heat: { fatigueCancel: true, stamina: 4 }, price: 20,
  },
};

// パーツの効果を表示用の文字列断片配列にする（ショップ・強化画面・レース前UIで共有）。
// abMulはab（常時効果）にのみ掛ける強化倍率（呼び出し側がpartLvから算出して渡す。
// 条件付き効果には掛けない、上のコメント参照）。abLabelは能力キー→日本語ラベルの対応表
// （data/parts.jsはdata/abilities.jsをimportしない方針のため、呼び出し側から渡す）。
export function partEffectParts(p, abMul = 1, abLabel = {}) {
  const L = (k) => abLabel[k] || k;
  const out = [];
  Object.entries(p.ab).forEach(([k, v]) => {
    const val = Math.round(v * abMul * 10) / 10;
    out.push(`${L(k)}${val >= 0 ? "+" : ""}${val}`);
  });
  if (p.rain) out.push(`雨天+${Math.round(p.rain.mulShift * 100)}%・落車半減`);
  if (p.dry) out.push(`晴/猛暑時${Object.entries(p.dry).map(([k, v]) => `${L(k)}${v}`).join("・")}`);
  if (p.pave) out.push(`石畳×${p.pave.mul}`);
  if (p.offPave) out.push(`石畳以外${Object.entries(p.offPave).map(([k, v]) => `${L(k)}${v}`).join("・")}`);
  if (p.heat) out.push(`猛暑時疲労軽減・${L("stamina")}+${p.heat.stamina}`);
  return out;
}
