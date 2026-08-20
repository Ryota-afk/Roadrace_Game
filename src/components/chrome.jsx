// アプリ全体の共通クローム（Header/Nav/改名モーダル/確認モーダル/wrap・mlWrap）。
// Step7第11弾でmain.jsxから分離。season/mylife両モードが共有する「額縁」だけをここに置く。
import React from "react";
import { C, FONT_D, FONT_B, FONT_DOT, FONT_M, T } from "../data/theme.js";
import { CLASSES, seasonNeed } from "../data/progression.js";
import { MONTHS } from "../data/course.js";
import { OB_COACH_SALARY } from "../data/economy.js";
import { Btn, Eyebrow } from "./ui.jsx";
import { BottomTabs } from "./BottomTabs.jsx";
import { seasonRank, staffSalaryTotal, mlLivingCost } from "../logic/support.js";
import { teamPayroll } from "../domain/season/salary.js";
import { findUnsupportedChars } from "../domain/shared/textInput.js";

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
// 第13弾Phase3-D-3: 新トークンへ移行。角丸を撤去し、面はT.color.surfaceの単色区切りに統一。
// 入力欄のフォントは入力中の文字が読める必要があるためFONT_Bのまま維持する。
export function RenameModal({ renameState, setRenameState }) {
  if (!renameState) return null;
  const badChars = findUnsupportedChars(renameState.value);
  const canCommit = badChars.length === 0 && (renameState.value || "").trim().length > 0;
  const commitRename = () => { const v = (renameState.value || "").trim(); if (v && badChars.length === 0) renameState.onCommit(v); setRenameState(null); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: T.space.lg, zIndex: 1000 }}>
      <div style={{ background: T.color.surface, padding: T.space.lg, maxWidth: 380, width: "100%" }}>
        <div style={{ color: T.color.text, fontFamily: FONT_DOT, fontSize: T.size.body, marginBottom: T.space.md }}>{renameState.title}</div>
        <input type="text" autoFocus value={renameState.value} maxLength={renameState.maxLength ?? 12}
          onChange={e => setRenameState(s => ({ ...s, value: e.target.value }))}
          onKeyDown={e => { if (e.key === "Enter" && canCommit) commitRename(); }}
          style={{ width: "100%", boxSizing: "border-box", background: T.color.surfaceUp, color: T.color.text, border: `1px solid ${badChars.length ? T.color.bad : T.color.rule}`, padding: "10px 12px", fontSize: 15, fontFamily: FONT_B }} />
        {badChars.length > 0 && <div style={{ color: T.color.bad, fontSize: T.size.caption, marginTop: T.space.xs }}>「{badChars.join("")}」は使えません</div>}
        <div style={{ display: "flex", gap: T.space.sm, marginTop: T.space.lg }}>
          <button onClick={() => setRenameState(null)} style={{ flex: 1, background: T.color.surfaceUp, color: T.color.sub, border: "none", fontFamily: FONT_DOT, fontSize: T.size.body, padding: T.space.md, cursor: "pointer" }}>やめる</button>
          <button onClick={commitRename} disabled={!canCommit} style={{ flex: 1, background: canCommit ? T.color.accent : T.color.surfaceUp, color: canCommit ? T.color.bg : T.color.sub, border: "none", fontFamily: FONT_DOT, fontSize: T.size.body, padding: T.space.md, cursor: canCommit ? "pointer" : "default" }}>変更する</button>
        </div>
      </div>
    </div>
  );
}

// v12バグ修正: window.confirm()に頼らない、アプリ内完結の確認モーダル
// 第13弾Phase3-D-3: confirmDialog.confirmLabelでボタンの文言を呼び出し元から指定できるように
// した（未指定時は「OK」）。取り返しのつかない操作でも「OK」しか言わない問題への対応。
export function ConfirmDialog({ confirmDialog, setConfirmDialog }) {
  if (!confirmDialog) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: T.space.lg, zIndex: 1000 }}>
      <div style={{ background: T.color.surface, padding: T.space.lg, maxWidth: 380, width: "100%" }}>
        <div style={{ color: T.color.text, fontFamily: FONT_DOT, fontSize: T.size.body, lineHeight: 1.9, marginBottom: T.space.lg, whiteSpace: "pre-wrap" }}>{confirmDialog.message}</div>
        <div style={{ display: "flex", gap: T.space.sm }}>
          <button onClick={() => setConfirmDialog(null)} style={{ flex: 1, background: T.color.surfaceUp, color: T.color.sub, border: "none", fontFamily: FONT_DOT, fontSize: T.size.body, padding: T.space.md, cursor: "pointer" }}>やめる</button>
          <button onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn(); }} style={{ flex: 1, background: T.color.bad, color: T.color.bg, border: "none", fontFamily: FONT_DOT, fontSize: T.size.body, padding: T.space.md, cursor: "pointer" }}>{confirmDialog.confirmLabel || "OK"}</button>
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
// 第13弾Phase3-A：ヘッダを新トークンへ寄せ、下部タブ5分類（ホーム／選手／世界／ショップ／記録）を
// 全画面共通の足回りとして追加した。タブはキャラ作成前やレース中など「今そこから動かれると困る」
// 画面では出さない（TAB_HIDDEN_SCREENS）。
const TAB_HIDDEN_SCREENS = new Set([
  "mylife_create", "mylife_scout",
  "mylife_startlist", "mylife_race", "mylife_result", "mylife_rival_scene", "mylife_newspaper",
  "mylife_event", "mylife_protege_event", "mylife_event_result",
  "mylife_offseason", "mylife_offseason_result", "mylife_crossroads", "mylife_crossroads_result",
  "mylife_contract", "mylife_retire_advice", "mylife_retired",
]);

export function makeMlWrap({ ml, renameState, setRenameState, confirmDialog, setConfirmDialog, setMl }) {
  return (children) => (
    <div style={{ minHeight: "100vh", background: T.color.bg, fontFamily: FONT_B }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "6px 14px 40px" }}>
        {ml.player && (
          <div style={{ fontFamily: FONT_DOT, padding: `${T.space.sm}px 0 ${T.space.md}px`, borderBottom: `1px solid ${T.color.rule}`, marginBottom: T.space.md }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: T.size.caption, color: T.color.sub }}>
              <span>{CLASSES[ml.classIdx].label}</span>
              <span>{ml.year}年目 {MONTHS[ml.month]}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: T.space.xs }}>
              <span style={{ fontSize: T.size.head, color: T.color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ml.team}</span>
              <span style={{ fontSize: T.size.caption, color: T.color.sub, flex: "none", marginLeft: T.space.sm }}>
                <span style={{ color: T.color.text, fontSize: T.size.body }}>{ml.money}</span>万円
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: T.size.caption, color: T.color.sub, marginTop: T.space.xs }}>
              <span>昇格まで {ml.points} / {CLASSES[ml.classIdx].need}pt</span>
              <span>年俸{ml.salary}万・生活費-{mlLivingCost(ml)}万</span>
            </div>
          </div>
        )}
        {children}
        {ml.player && setMl && !TAB_HIDDEN_SCREENS.has(ml.screen) && (
          <BottomTabs screen={ml.screen} onSelect={(key) => setMl(s => ({ ...s, screen: key }))} />
        )}
      </div>
      <RenameModal renameState={renameState} setRenameState={setRenameState} />
      <ConfirmDialog confirmDialog={confirmDialog} setConfirmDialog={setConfirmDialog} />
    </div>
  );
}
