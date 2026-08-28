// マイライフのレース開始（mlStartRace/mlStartLastRace）の入力組み立てのみを抽出した純関数。Step7第5弾。
// 注意：buildMyLifeSim自体には一切触れていない（詳細はDEVLOG §9参照）。連打防止は
// 第8弾でmlRaceLockRef（useRefロック）を廃止し、main.jsx側でscreen状態そのものを
// ガードに使う方式へ置き換えた。
import { TEMPLATES } from "../../data/course.js";
import { TYPES } from "../../data/abilities.js";

// v28: 代表チームでの立場。世界選手権・オリンピックでは代表監督から役割が与えられる。
// 監督評価が高い（信頼されている）ほどエースを任され、そうでなければアシスト役になる。
// 役割はそのままレースでの立ち回り（directive）に反映される
export function resolveNationalRole(race, managerEval, baseDirectiveKey) {
  if (race.milestone && !race.nationalRole) {
    const natRole = managerEval >= 55 ? "ace" : "support";
    return { race: { ...race, nationalRole: natRole }, directiveKey: natRole };
  }
  if (race.milestone && race.nationalRole) {
    return { race, directiveKey: race.nationalRole };
  }
  return { race, directiveKey: baseDirectiveKey };
}

// v27: ラストレース演出。引退前に「最後のレース」を特別に用意し、有終の美を飾れるようにする。
// 脚質に合ったコースのグレード4エキシビションとして、両ライバルも駆けつける最高の舞台にする
// 第72弾(devlog/wave72.md): 旧実装はTEMPLATES[0]/[3]/[2]/[5]のハードコード添字で、
// RULとPUNが同じTEMPLATES[2](丘陵ロード)を共有していた（ルーラーの引退記念レースが
// パンチャーのコースで行われる不整合）。favors検索方式へ変更——4脚質(SPR/CLM/PUN/TT)は
// 現行と同一の割り当てを保ちつつ、RULだけ新設の平坦ロードへ正しく解決される（実測確認済み）。
export function buildLastRaceMeta(player, year, classIdx) {
  const tmplByType = Object.fromEntries(
    Object.keys(TYPES).map(t => [t, TEMPLATES.find(x => x.favors === t) || TEMPLATES[2]])
  );
  const tmpl = tmplByType[player.type] || TEMPLATES[2];
  return { id: `ml-lastrace-${year}`, name: `${player.name} 引退記念ラストレース`, tmpl, grade: 4, cls: classIdx, rivalPresent: true, rival2Present: true, weather: "clear", isLastRace: true };
}
