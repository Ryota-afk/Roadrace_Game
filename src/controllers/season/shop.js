// ショップ・スタッフ経済の状態遷移（純粋なreducer関数：(state, ...args) => newState）。
// Step7と同型のパターンをmain.jsx App() の残りハンドラへ適用（第2弾：season側shop系）。
// ガード条件は元々main.jsx側で「render時点のg」を見ていたが、Step7の慣習（poachSign等）に
// 合わせ、setGのupdater時点の最新状態sを見るよう統一した（挙動は同一・より安全な方向への整理）。
import { MONTHS } from "../../data/course.js";
import { STAFF_MAX_BY_CLASS } from "../../data/economy.js";
import { AB_LABEL } from "../../data/abilities.js";
import { EQUIP_COST, ITEMS } from "../../data/items.js";
import { ROOM_GRADE_MAX, ROOM_UPGRADE_COST, ROOM_UPGRADE_KEYS } from "../../data/roomUpgrade.js";
import { OB_COACH_SALARY, TYPE_COACH_ABILITY } from "../../logic/support.js";
import { PARTS } from "../../sim/race.js";

export function buyItem(s, k) {
  if (s.budget < ITEMS[k].price) return s;
  return { ...s, budget: s.budget - ITEMS[k].price, inv: { ...s.inv, [k]: s.inv[k] + 1 } };
}

export function buyPart(s, pid) {
  if (s.budget < PARTS[pid].price || PARTS[pid].tier > s.classIdx + 1) return s;
  return { ...s, budget: s.budget - PARTS[pid].price, partsInv: { ...s.partsInv, [pid]: (s.partsInv[pid] || 0) + 1 } };
}

export function setPart(s, rid, slot, pid) {
  return { ...s, roster: s.roster.map(r => r.id === rid ? { ...r, parts: { ...r.parts, [slot]: pid || null } } : r) };
}

export function buyEquip(s, k) {
  // v42(Wave F-1): "grounds"のような後発キーは旧セーブのequipオブジェクトに存在しない
  // ことがある（loadGameはequipをオブジェクトごと上書きするため、初期値の0が失われる）。
  // hireStaffが同じ理由でstaff[k]に既に適用している`|| 0`ガードをこちらにも合わせた。
  const lv = s.equip[k] || 0;
  const equipMax = 3 + s.classIdx;
  if (lv >= equipMax || s.budget < EQUIP_COST[lv]) return s;
  return { ...s, budget: s.budget - EQUIP_COST[lv], equip: { ...s.equip, [k]: lv + 1 } };
}

// Wave H-2: 部屋の内装グレードを1段階上げる。buyEquipと同型（買い切り・即時支払い）だが、
// 能力値には一切効かない見た目のみの購入軸で、equipMaxのようなクラス連動の上限は持たない
// （判断⑦：クラス昇格によるゲートは掛けない。B1のうちから拠点を綺麗にできる）。
export function buyRoomUpgrade(s, k) {
  if (!ROOM_UPGRADE_KEYS.includes(k)) return s;
  const lv = ((s.roomLv || {})[k]) || 0;
  if (lv >= ROOM_GRADE_MAX || s.budget < ROOM_UPGRADE_COST[lv]) return s;
  return { ...s, budget: s.budget - ROOM_UPGRADE_COST[lv], roomLv: { ...(s.roomLv || {}), [k]: lv + 1 } };
}

// v11: スタッフは買い切りではなく月給制。レベルを上げると翌月から月給が増える（即時の費用はない）
export function hireStaff(s, k) {
  const lv = s.staff[k] || 0;
  const staffMax = STAFF_MAX_BY_CLASS[s.classIdx] + (s.staffMaxBonus || 0);
  if (lv >= staffMax) return s;
  return { ...s, staff: { ...s.staff, [k]: (s.staff[k] || 0) + 1 } };
}

// v27: 引退選手のスタッフ登用。殿堂入りOBを月給制で専属コーチに迎える（1名まで）
export function hireObCoach(s, hof) {
  return {
    ...s,
    obCoach: { id: hof.id, name: hof.name, type: hof.type, ab: TYPE_COACH_ABILITY[hof.type] || "flat" },
    log: [...s.log, `【${MONTHS[s.month]}】${hof.name}をOBコーチに迎えた（${AB_LABEL[TYPE_COACH_ABILITY[hof.type] || "flat"]}の練習効果+25%／月給-${OB_COACH_SALARY}万）`],
  };
}

export function dismissObCoach(s) {
  return { ...s, obCoach: null, log: [...s.log, `【${MONTHS[s.month]}】OBコーチとの契約を解消した`] };
}
