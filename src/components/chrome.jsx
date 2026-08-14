// アプリ全体の共通クローム（Header/Nav/改名モーダル/確認モーダル/wrap・mlWrap）。
// Step7第11弾でmain.jsxから分離。season/mylife両モードが共有する「額縁」だけをここに置く。
import React from "react";
import { C, FONT_D, FONT_B, FONT_M } from "../data/theme.js";
import { CLASSES, seasonNeed } from "../data/progression.js";
import { MONTHS } from "../data/course.js";
import { OB_COACH_SALARY } from "../data/economy.js";
import { Btn, Eyebrow } from "./ui.jsx";
import { seasonRank, staffSalaryTotal, mlLivingCost } from "../logic/support.js";
import { teamPayroll } from "../domain/season/salary.js";

export function SeasonHeader({ g, cls }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.line}`, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Eyebrow>{cls.label} — {g.year}年目 {MONTHS[g.month]}{g.dynastyLevel > 0 ? ` ／ 🔁 ダイナスティ${g.dynastyLevel}周目` : ""}</Eyebrow>
          <div style={{ fontFamily: FONT_D, fontSize: 18, fontWeight: 700, color: C.text }}>{g.teamName || "あなたのチーム"}</div>
          {g.sponsor && <div style={{ fontSize: 10.5, color: C.sub }}>スポンサー {g.sponsor.name}（月+{g.sponsor.monthly}万／ノルマ{g.sponsor.norma}pt／未達-{g.sponsor.penalty}万／指定レース{g.sponsor.mandatesMet}済{g.sponsor.mandatesMissed > 0 ? `・見送り${g.sponsor.mandatesMissed}` : ""}）</div>}
          <div style={{ fontSize: 10.5, color: C.sub }}>
            選手年俸 -{teamPayroll(g.roster, g.salaryDiscountMul || 1)}万/月（{g.roster.length}名）
            {staffSalaryTotal(g.staff) > 0 && <>／スタッフ月給 -{staffSalaryTotal(g.staff)}万/月</>}
            {g.obCoach && <>／OBコーチ -{OB_COACH_SALARY}万/月</>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: FONT_M, fontSize: 18, color: g.budget < 0 ? C.red : C.yellow }}>{g.budget}<span style={{ fontSize: 10 }}>万円{g.budget < 0 ? "（借金）" : ""}</span></div>
          <div style={{ fontFamily: FONT_M, fontSize: 12, color: C.green }}>{g.points}pt <span style={{ color: C.sub }}>/ 出場権{seasonNeed(g.classIdx)}pt</span></div>
          {(() => { const sr = seasonRank(g); return (
            <div style={{ fontFamily: FONT_M, fontSize: 11, color: sr.rank <= 3 ? "#e8a13c" : C.sub }}>
              🏆 順位 {sr.rank}/{sr.total}位{sr.rank <= 3 ? "（昇格ボーダー緩和圏）" : ""}
            </div>
          ); })()}
        </div>
      </div>
    </div>
  );
}

// v29: 選手名変更モーダル（wrap/mlWrap両方で表示する共用JSX）
export function RenameModal({ renameState, setRenameState }) {
  if (!renameState) return null;
  const commitRename = () => { const v = (renameState.value || "").trim(); if (v) renameState.onCommit(v); setRenameState(null); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
      <div style={{ background: C.panel, borderRadius: 12, padding: 20, maxWidth: 380, width: "100%", border: `1px solid ${C.line}` }}>
        <div style={{ color: C.text, fontSize: 14, marginBottom: 12 }}>{renameState.title}</div>
        <input type="text" autoFocus value={renameState.value} maxLength={12}
          onChange={e => setRenameState(s => ({ ...s, value: e.target.value }))}
          onKeyDown={e => { if (e.key === "Enter") commitRename(); }}
          style={{ width: "100%", boxSizing: "border-box", background: C.panel2, color: C.text, border: `1.5px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", fontSize: 15, fontFamily: FONT_B }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn small outline color={C.sub} onClick={() => setRenameState(null)}>キャンセル</Btn>
          <Btn small color={C.green} onClick={commitRename}>変更</Btn>
        </div>
      </div>
    </div>
  );
}

// v12バグ修正: window.confirm()に頼らない、アプリ内完結の確認モーダル
export function ConfirmDialog({ confirmDialog, setConfirmDialog }) {
  if (!confirmDialog) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
      <div style={{ background: C.panel, borderRadius: 12, padding: 20, maxWidth: 380, width: "100%", border: `1px solid ${C.line}` }}>
        <div style={{ color: C.text, fontSize: 14, lineHeight: 1.7, marginBottom: 16, whiteSpace: "pre-wrap" }}>{confirmDialog.message}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn small outline color={C.sub} onClick={() => setConfirmDialog(null)}>キャンセル</Btn>
          <Btn small color={C.red} onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn(); }}>OK</Btn>
        </div>
      </div>
    </div>
  );
}

// 第2引数 opts.fill=true のとき、内側コンテナを縦フレックスにして children に残り高さを
// 全て与える（BaseView＝敷地画面のように「画面いっぱいに敷き詰めたい」画面向け）。
// Step13第4弾で旧5タブNavを撤去して以降 withNav を渡す呼び出し元は無くなったため、
// Wave D2で SeasonNav ごと削除し、第2引数をこのオプションに作り替えた。
// 通常の画面は従来どおり wrap(children) だけで呼べる（既存の呼び出しは全て無変更）。
export function makeWrap({ g, renameState, setRenameState, confirmDialog, setConfirmDialog }) {
  const cls = CLASSES[g.classIdx];
  return (children, opts = {}) => (
    <div style={{ minHeight: "100svh", background: C.bg, fontFamily: FONT_B, ...(opts.fill ? { display: "flex", flexDirection: "column" } : null) }}>
      <div style={{
        maxWidth: 560, margin: "0 auto", width: "100%", boxSizing: "border-box",
        padding: opts.fill ? "6px 14px 10px" : "6px 14px 40px",
        ...(opts.fill ? { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } : null),
      }}>
        <SeasonHeader g={g} cls={cls} />
        {children}
      </div>
      <RenameModal renameState={renameState} setRenameState={setRenameState} />
      <ConfirmDialog confirmDialog={confirmDialog} setConfirmDialog={setConfirmDialog} />
    </div>
  );
}

// v46(UI): 次のアクション#10。モード選択・生涯評価・系譜ツリー・因子図鑑・CPショップは
// season/mylifeどちらの状態にも属さない「モード非依存」の画面のはずなのに、season用の
// makeWrap()を共用していたため、まだモードを選んでいない起動一発目の画面にまで
// シーズンの自チーム情報（クラスB1・あなたのチーム・予算等）が意図せず表示されていた。
// SeasonHeaderを持たない専用のwrapを新設し、renderMetaScreens側だけに配線する。
export function makeMetaWrap({ renameState, setRenameState, confirmDialog, setConfirmDialog }) {
  return (children) => (
    <div style={{ minHeight: "100svh", background: C.bg, fontFamily: FONT_B }}>
      <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", boxSizing: "border-box", padding: "6px 14px 40px" }}>
        {children}
      </div>
      <RenameModal renameState={renameState} setRenameState={setRenameState} />
      <ConfirmDialog confirmDialog={confirmDialog} setConfirmDialog={setConfirmDialog} />
    </div>
  );
}

// ================= v14: モード選択（タイトル） =================
export function makeMlWrap({ ml, renameState, setRenameState, confirmDialog, setConfirmDialog }) {
  return (children) => (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: FONT_B }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "6px 14px 40px" }}>
        {ml.player && (
          <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.line}`, marginBottom: 12 }}>
            <Eyebrow>マイライフ — {CLASSES[ml.classIdx].label} {ml.year}年目 {MONTHS[ml.month]}</Eyebrow>
            <div style={{ fontFamily: FONT_D, fontSize: 16, fontWeight: 700, color: C.text }}>{ml.player.name}（{ml.team}）</div>
            <div style={{ fontSize: 11, color: C.sub }}>{ml.points}pt / 昇格権{CLASSES[ml.classIdx].need}pt</div>
            <div style={{ fontSize: 11, color: C.sub }}>所持金{ml.money}万円・年俸{ml.salary}万円（生活費/税 -{mlLivingCost(ml)}万/月）</div>
          </div>
        )}
        {children}
      </div>
      <RenameModal renameState={renameState} setRenameState={setRenameState} />
      <ConfirmDialog confirmDialog={confirmDialog} setConfirmDialog={setConfirmDialog} />
    </div>
  );
}
