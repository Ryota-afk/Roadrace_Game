// スタッフ名・効果・給与。第13弾Phase0でlogic/support.jsから分離。
import { mulberry, strHash } from "../../core/core.js";
import { STAFF_SALARY_PER_LV } from "../../data/economy.js";

const STAFF_SURNAMES = ["田中", "佐藤", "鈴木", "高橋", "渡辺", "伊藤", "山本", "中村", "小林", "加藤", "吉田", "山田", "松本", "井上", "木村", "林"];
export function staffMemberName(teamName, role) {
  const rng = mulberry(strHash((teamName || "team") + "#" + role));
  return STAFF_SURNAMES[Math.floor(rng() * STAFF_SURNAMES.length)];
}
// 現在レベルでの具体効果（説明文の一般論ではなく「今いくら効いているか」）
export function staffEffectText(role, lv) {
  if (!lv) return null;
  switch (role) {
    case "manager": return `スポンサー月収 +${lv * 12}%・ノルマ -${lv * 8}%・成功報酬 +${lv * 10}%`;
    case "trainer": return `全選手の練習成長 +${lv * 12}%`;
    case "doctor":  return `故障率 -${lv * 22}%・離脱期間を短縮`;
    case "scout":   return `新人査定のブレ -${Math.min(80, lv * 28)}%・逸材の発掘率アップ`;
    default: return null;
  }
}

export function staffSalaryTotal(staff) {
  if (!staff) return 0;
  return (Object.values(staff).reduce((a, b) => a + b, 0)) * STAFF_SALARY_PER_LV;
}
