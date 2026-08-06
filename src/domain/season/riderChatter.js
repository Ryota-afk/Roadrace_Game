// 拠点(BaseView)の吹き出しを「誰がいつ何を喋っているか」の**時刻の純関数**として解く
// （Wave H-1／旧Wave E-4の残件）。JSXを持たないためNode単体テストから直接importできる。
//
// 設計の核（riderActivity.jsと同じ流儀・ユーザー合意済み）：
// Reactのstateも`useEffect`のタイマーも一切使わず、経過秒と選手IDだけから発話を決める。
//  - メニューを開くと`elapsed`が止まるので、吹き出しも自然に静止する（既存の一時停止機構が
//    そのまま効く。個別に「止める」処理を書かなくてよい）
//  - 「t=37.5秒に選手2は何を喋っているか」をNodeで機械的に検算できる
//  - Math.random()不使用の既存方針を維持（位相・セリフ選択はどちらも`riderHash01`）
import { riderHash01 } from "../../sim/race.js";
import { BASE_VIEW_CHATTER } from "../../data/baseViewChatter.js";

// 1人あたり24秒に1回、4秒だけ喋る（duty比1/6）。選手6名なら「常時だいたい1人が
// 喋っている」状態が、実行時のカウンタを持たずに自動的に生まれる。
export const CHATTER_PERIOD = 24;
export const CHATTER_SHOW = 4;
// 同時表示の上限。全員が同時に喋ると画面が文字だらけになるため決定論的に間引く。
export const CHATTER_MAX = 2;

// 活動モード→セリフの状況キー。移動中(walkIn/walkOut/approach/depart)は、
// 動きながらの吹き出しが追従して読みにくいため喋らせない（ユーザー判断②）。
export function chatterSituation(act) {
  if (!act) return null;
  if (act.mode === "ride") return "ride";
  if (act.mode === "work") return act.roomKey || null;
  return null;
}

// 選手の状態→状態キー。BaseViewは既に「疲労が高い選手ほどメディカル室へ行きやすい＝
// 装飾ではなく情報」という方針を持っており、セリフもそれに揃える（ユーザー判断④）。
// 優先度は 故障 > 疲労 > 調子 の順（より深刻な状態が前に出る）。
export function riderChatterState(rider) {
  if ((rider.injury || 0) > 0) return "injured";
  if ((rider.fatigue || 0) >= 80) return "tired";
  const cond = rider.cond == null ? 3 : rider.cond;
  if (cond >= 4) return "hot";
  if (cond <= 2) return "cold";
  return null;
}

// 状況・性格・状態でセリフ候補を絞る。状態つきのセリフが存在すればそれを優先し
// （「この選手は今まずい」が一目で伝わる）、無ければ状態非依存のセリフへフォールバックする。
export function chatterCandidates(situation, persona, state) {
  const byPersona = BASE_VIEW_CHATTER.filter(c =>
    c.when === situation && (c.persona == null || c.persona === persona));
  if (state) {
    const stateful = byPersona.filter(c => c.state === state);
    if (stateful.length > 0) return stateful;
  }
  return byPersona.filter(c => c.state == null);
}

// 発話ウィンドウ。startAbsはこのウィンドウが始まった絶対時刻（同時表示を間引くとき、
// 「より新しく喋り始めた人を優先」の判定に使う）。
export function chatterWindowAt(rider, tSec) {
  const phase = riderHash01(rider.id, 83);
  const tt = tSec + phase * CHATTER_PERIOD;
  const slot = Math.floor(tt / CHATTER_PERIOD);
  const local = tt - slot * CHATTER_PERIOD;
  return { slot, local, active: local < CHATTER_SHOW, startAbs: (slot - phase) * CHATTER_PERIOD };
}

// 選手1人が時刻tSecに喋っているセリフ（喋っていなければnull）。
// セリフはスロット内で固定なので、表示中にコロコロ変わってチラつくことがない。
export function chatterFor(rider, tSec, act) {
  const situation = chatterSituation(act);
  if (!situation) return null;
  const win = chatterWindowAt(rider, tSec);
  if (!win.active) return null;
  const cands = chatterCandidates(situation, rider.personality, riderChatterState(rider));
  if (cands.length === 0) return null;
  const i = Math.floor(riderHash01(rider.id * 7 + win.slot, 11) * cands.length);
  return cands[Math.min(cands.length - 1, Math.max(0, i))].text;
}

// 実際に画面へ出す吹き出しを選ぶ。rowsはBaseViewの選手行（{r, act, x, y, ...}）。
// 上限を超えた分は「より新しく喋り始めた人」を優先して間引く（位相が選手ごとに
// 違うため、特定の選手だけが喋り続けることにはならない）。
export function pickChatters(rows, tSec, max = CHATTER_MAX) {
  const talking = [];
  for (const row of rows) {
    const text = chatterFor(row.r, tSec, row.act);
    if (!text) continue;
    talking.push({ ...row, text, startAbs: chatterWindowAt(row.r, tSec).startAbs });
  }
  talking.sort((a, b) => (b.startAbs - a.startAbs) || (a.r.id - b.r.id));
  return talking.slice(0, max);
}
