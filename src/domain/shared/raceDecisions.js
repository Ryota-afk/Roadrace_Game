// レース中の「判断カード」のデータ組み立て（RaceView.jsxから分離。第14弾D）。
// JSXを持たない純関数のみ。カードのスロット定義(buildDecisions)と選択肢の組み立て(composeCard)。
import { badgeTier, hasAbility, hasTerrainBadge, TERRAIN_ABILITIES, TIER_ORDER } from "../../core/core.js";

// 第51弾: 数値でバッジの個性を出す道が構造的に塞がっている（devlog/wave51.md）ため、
// 「選べる回数」をバッジの報酬にする。スプリント系バッジ保持者だけに出す最終スプリントの一手。
const SPRINT_BADGES = ["sprinter_sp", "kicker", "finisher", "closer"];
// 保持している地形バッジのうち最も高い段階を返す（TERRAIN_ABILITIESの全ID横断）。未所持ならnull。
const ALL_TERRAIN_ABILITY_IDS = [...new Set(Object.values(TERRAIN_ABILITIES).flat())];
function bestTerrainTier(ent) {
  let bestIdx = -1, bestTier = null;
  ALL_TERRAIN_ABILITY_IDS.forEach(id => {
    const tier = badgeTier(ent, id);
    if (tier) { const idx = TIER_ORDER.indexOf(tier); if (idx > bestIdx) { bestIdx = idx; bestTier = tier; } }
  });
  return bestTier;
}
// 銅・銀・金＝1回／虹＝2回。未所持は0回（専用カードは出ない）。
function terrainCardCap(tier) { return tier === "rainbow" ? 2 : tier ? 1 : 0; }

// v39(A案): レース中の「判断カード」スロット定義。注目選手のコース進捗(frac)が at を越えた／
// 状況条件 cond を満たした瞬間に再生を止め、その時点の状況(ctx)に応じて composeCard で選択肢を
// 組み立てて提示する。選んだ move は resumeSim でその地点から結果へ反映される。teamTT等の履歴が
// 無いsimでは出さない。
// 第51弾(devlog/wave51.md): 基本はmid/finaleの2枚のみ（バッジ無しの判断回数を4→2に削減）。
// reactは従来どおり状況発火のみ。sprintはスプリント系バッジ保持者だけに出す。得意地形の
// 区間に入った瞬間の専用カード(terrain-*)は、所持する地形バッジの最高段階で回数が増える
// （シーズンモード＝manager視点では出さない。選手本人の判断ではないため）。
export function buildDecisions(course, focusEnt, manager) {
  if (!focusEnt || !focusEnt.posHist || focusEnt.posHist.length < 60) return [];
  const finalStart = (course.cumFrac && course.finalIdx > 0) ? course.cumFrac[course.finalIdx - 1] : 0.85;
  const atFin = Math.min(0.80, Math.max(0.58, finalStart - 0.03));
  const atMid = Math.min(0.5, atFin - 0.15);
  const atSprint = Math.min(0.95, Math.max(finalStart + 0.02, 0.9)); // 最終直線（ゴール手前）の一枚
  const decisions = [
    { id: "mid", at: atMid, kind: "mid" },
    { id: "finale", at: atFin, kind: "finale" },
    // 状況発火：先頭で抜け出している or 脚が尽きかけの時だけ、専用の一枚を差し込む
    { id: "react", kind: "react", cond: (c) => (c.inBreak && c.frac > 0.5 && c.frac < atFin - 0.02) || (c.energy < 38 && c.frac > 0.45 && c.frac < atFin - 0.02) },
  ];
  // v39.13: 最終スプリントそのものの一手。最終区間内でも発火する（allowFinal）
  if (SPRINT_BADGES.some(id => hasAbility(focusEnt, id))) decisions.push({ id: "sprint", at: atSprint, kind: "sprint", allowFinal: true });
  if (!manager) {
    const cap = terrainCardCap(bestTerrainTier(focusEnt));
    if (cap > 0) {
      let fired = 0;
      course.segs.forEach((seg, idx) => {
        if (fired >= cap || idx === course.finalIdx || !hasTerrainBadge(focusEnt, seg.type)) return;
        const segStart = idx === 0 ? 0 : course.cumFrac[idx - 1];
        const at = segStart + 0.01;
        if (at >= atFin - 0.03) return; // 勝負所の一手と被らないよう、その手前で打ち切る
        decisions.push({ id: `terrain-${idx}`, at, kind: "terrain", segType: seg.type });
        fired++;
      });
    }
  }
  return decisions;
}

// v39(A案): 判断カードの選択肢を、注目選手の脚質・特性・役割と、その瞬間の地形・状況から組み立てる。
// 「その選手ならでは」の一手（登坂型は登りで、逃げ屋は逃げ、差し脚は最終直線…）を出して race を
// 自分の物語にする。move は RACE_MOVES のキーに対応。選択肢は最大4つに抑える。
export function composeCard(kind, focus, ctx) {
  const A = (id) => hasAbility(focus, id);
  // v39.22(シーズン): 監督視点＝プレイヤーはアバターではなくチームを率いる立場。文言を「指示」にし、
  // 僚友を動かすチーム指示（守る/総動員で追う）を選択肢に加える＝運営側にも駆け引きを作る。
  if (ctx.manager) {
    const who = focus.name ? focus.name.split(" ")[0] : "エース";
    const mateN = ctx.mates || 0;
    const base = kind === "sprint" ? { t: "最終スプリント — 監督指示", s: `${who}に最後の指示を出す` }
      : kind === "finale" ? { t: "勝負所 — 監督指示", s: `無線で${who}へ。ここが仕掛けどころだ` }
        : kind === "react" ? { t: "状況が動いた — 監督指示", s: `${who}をどう動かす？` }
          : { t: "中盤 — 監督指示", s: `隊列が動いた。${who}への指示は？` };
    const ch = [];
    if (kind === "sprint" || kind === "finale") {
      ch.push({ move: "send", label: "仕掛けさせる", desc: `${who}に全開で踏ませる（脚を大きく使う）` });
      ch.push({ move: "kick", label: "待たせて差す", desc: "ギリギリまで温存させ、最後に伸ばす" });
    } else {
      ch.push({ move: "attack", label: "攻めさせる", desc: `${who}を飛び出させる（決まれば独走）` });
      ch.push({ move: "conserve", label: "脚を溜めさせる", desc: "集団後方で温存させ勝負所に備える" });
    }
    if (mateN >= 1) {
      ch.push({ move: "teamShelter", label: "エースを守れ", desc: "僚友が風除け・位置取りを担い、エースの脚を守る" });
      if (kind !== "sprint") ch.push({ move: "teamChase", label: "総動員で追え", desc: "僚友を放って前を追わせる（チーム全体が消耗）" });
    } else {
      ch.push({ move: "hold", label: "選手に任せる", desc: "指示を出さず選手の判断に委ねる" });
    }
    return { title: base.t, sub: base.s, choices: ch.slice(0, 4) };
  }
  const t = focus.type;
  const onClimb = ["climb", "mtn"].includes(ctx.segType);
  const onHill = ctx.segType === "hill";
  const isAssist = !!focus.isAssisting;
  let title = "", sub = "", choices = [];
  if (kind === "react" && ctx.inBreak) {
    title = "逃げの選択";
    sub = "先頭で抜け出している——ここからどうする？";
    choices = [
      { move: "attack", label: "このまま踏み倒す", desc: "逃げ切りを狙い、全開で回し続ける" },
      { move: "conserve", label: "一度緩めて脚を溜める", desc: "ペースを落として最後まで脚を残す" },
      { move: "hold", label: "集団に戻す", desc: "無理をやめて集団のペースに戻る" },
    ];
    return { title, sub, choices };
  }
  if (kind === "react") {
    title = "苦しい局面";
    sub = "脚が尽きかけている——粘るか、立て直すか";
    choices = [
      { move: "hangOn", label: "食いしばって残る", desc: A("grinder") ? "食らいつく脚で集団にしがみつく" : "歯を食いしばって集団に残る" },
      { move: "conserve", label: "緩めて立て直す", desc: "一度ペースを落として脚の回復を待つ" },
      { move: "hold", label: "自分のペースで", desc: "無理をやめて淡々と進む" },
    ];
    return { title, sub, choices };
  }
  if (kind === "terrain") {
    // 第51弾: 得意地形の区間に入った瞬間の専用カード。自分が速くなるのではなく、
    // 同じ集団の他選手のkeepThreshを厳しくして集団を削る「ふるいにかける」だけの新しい一手。
    const TERRAIN_TITLE = { climb: "登りに入った", mtn: "登りに入った", hill: "丘に入った", flat: "平坦に入った", tt: "独走区間に入った" };
    title = TERRAIN_TITLE[ctx.segType] || "得意区間に入った";
    sub = "自分の得意地形——ここでどう動く？";
    choices = [
      { move: "tempo", label: "ふるいにかける", desc: "ペースを上げて後続を千切る。脚を大きく使う" },
      { move: "attack", label: "仕掛ける", desc: "単独で飛び出す。決まれば独走、脚を使い切れば失速も" },
      { move: "hold", label: "流れに任せる", desc: "展開に乗って様子を見る" },
    ];
    return { title, sub, choices };
  }
  if (kind === "sprint") {
    title = "最終スプリント！";
    sub = "ゴールが目前——ここで全てを出し切れ";
    if (A("kicker") || A("finisher") || A("closer"))
      choices.push({ move: "kickBig", label: "会心の差し", desc: "満を持して差し切る、豪脚の一撃" });
    else if (t === "SPR" || A("sprinter_sp"))
      choices.push({ move: "sprintWait", label: "番手から爆発", desc: "前の選手を風除けに、最後に弾ける" });
    else
      choices.push({ move: "kick", label: "一気に差す", desc: "残った脚を全部ここで解き放つ" });
    choices.push({ move: "send", label: "全開でもがく", desc: "とにかく先頭で踏み倒す（早駆け気味）" });
    if (isAssist) choices.push({ move: "assistLaunch", label: "エースを発射", desc: "最後の力でエースを前へ弾き出す" });
    else choices.push({ move: "hold", label: "流れで勝負", desc: "無理せず集団の勢いに乗る" });
    return { title, sub, choices: choices.slice(0, 3) };
  }
  if (kind === "mid") {
    title = "中盤の判断";
    sub = onClimb ? "登りが牙を剥く。ここが勝負の分かれ目だ" : onHill ? "うねる丘で隊列が動き出した" : "隊列が動き出した。ここでどう動く？";
    // 攻めの一手（地形×脚質×特性で味付け）
    if (onClimb && (t === "CLM" || A("mount") || A("allclimber") || A("climbengine") || A("autumn_sp")))
      choices.push({ move: "attack", label: "登りで抜け出す", desc: "登坂適性を武器に単独で飛び出す" });
    else if (onHill && (t === "PUN" || A("puncheur") || A("ardennes_sp")))
      choices.push({ move: "attack", label: "丘でアタック", desc: "丘の申し子、パンチ力で抜け出す" });
    else if (A("escape"))
      choices.push({ move: "attack", label: "得意の逃げに持ち込む", desc: "逃げ屋の脚で集団を突き放す" });
    else
      choices.push({ move: "attack", label: "仕掛ける", desc: "単独で飛び出す。決まれば独走、脚を使い切れば失速も" });
    if (A("grinder")) choices.push({ move: "hangOn", label: "食らいついて粘る", desc: "食らいつく脚で集団に残り、脚を温存する" });
    choices.push({ move: "conserve", label: "脚を溜める", desc: "集団後方で温存し、勝負所に備える" });
    if (isAssist) choices.push({ move: "assistLaunch", label: "エースの前で牽く", desc: "自分の脚を使ってエースを勝負所へ運ぶ" });
    else choices.push({ move: "hold", label: "流れに任せる", desc: "展開に乗って様子を見る" });
    return { title, sub, choices: choices.slice(0, 4) };
  }
  // finale
  title = "勝負所の判断";
  sub = "ゴールが近い。ここが仕掛けどころだ";
  if (A("kicker") || A("finisher") || A("closer"))
    choices.push({ move: "kickBig", label: "会心の差し脚", desc: "最終直線、豪脚の切れ味で差し切る" });
  else if (t === "SPR" || A("sprinter_sp"))
    choices.push({ move: "sprintWait", label: "スプリント勝負", desc: "番手をキープし、集団スプリントで爆発させる" });
  else
    choices.push({ move: "kick", label: "差しにかける", desc: "ギリギリまで待ち、最終直線で鋭く伸びる" });
  if (onClimb && (t === "CLM" || A("mount") || A("allclimber")))
    choices.push({ move: "send", label: "登りで抜け出す", desc: "最後の登りで一気に踏んで独走へ" });
  else if (A("escape"))
    choices.push({ move: "send", label: "早駆け", desc: "一気に抜け出してゴールまで踏み切る" });
  else
    choices.push({ move: "send", label: "一気に踏む", desc: "ここから踏み倒して抜け出す" });
  if (isAssist) choices.push({ move: "assistLaunch", label: "エースを射出", desc: "最終局面、エースのスプリントを援護する" });
  else choices.push({ move: "hold", label: "集団で勝負", desc: "無理せず集団の決着に合わせる" });
  return { title, sub, choices: choices.slice(0, 4) };
}
