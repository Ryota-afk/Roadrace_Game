// アプリ全体の共通クローム（Header/Nav/改名モーダル/確認モーダル/wrap・mlWrap）。
// Step7第11弾でmain.jsxから分離。season/mylife両モードが共有する「額縁」だけをここに置く。
import React from "react";
import { FONT_B, FONT_DOT, T } from "../data/theme.js";
import { CLASSES, seasonNeed } from "../data/progression.js";
import { MONTHS } from "../data/course.js";
import { BottomTabs } from "./BottomTabs.jsx";
import { seasonRank } from "../logic/support.js";
import { findUnsupportedChars } from "../domain/shared/textInput.js";

// 第13弾Phase3-D-4-a: 資金／昇格まで／順位の3値を同じ形で並べる列。
// 常時参照する値だけをヘッダに残すため（詳細はdevlog/wave13.md）、値は最大2段（caption/head）のみ。
function HeaderStat({ label, value, unit, valueColor, align }) {
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: align }}>
      <div style={{ fontSize: T.size.caption, color: T.color.sub }}>{label}</div>
      <div style={{ fontSize: T.size.head, color: valueColor || T.color.text, fontVariantNumeric: "tabular-nums" }}>
        {value}<span style={{ fontSize: T.size.caption, color: T.color.sub }}>{unit}</span>
      </div>
    </div>
  );
}

// 第13弾Phase3-D-4-a: 18項目を詰め込んでいた旧ヘッダを、常時参照する7項目だけに絞った
// （実測で幅420pxでは値の途中改行まで起きていた。詳細・移設先はdevlog/wave13.md）。
// スポンサー詳細・支出内訳・ダイナスティ周回はrace_status（レース→シーズン状況）へ移設。
export function SeasonHeader({ g, cls }) {
  const need = seasonNeed(g.classIdx);
  const sr = seasonRank(g);
  return (
    <div style={{ padding: `${T.space.sm}px 0 ${T.space.md}px`, borderBottom: `1px solid ${T.color.rule}`, marginBottom: T.space.md, fontFamily: FONT_DOT }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: T.size.caption, color: T.color.sub }}>
        <span>{cls.label}</span>
        <span>{g.year}年目 {MONTHS[g.month]}</span>
      </div>
      <div style={{ fontSize: T.size.head, color: T.color.text, marginTop: T.space.xs, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.teamName || "あなたのチーム"}</div>
      <div style={{ display: "flex", gap: T.space.sm, marginTop: T.space.sm }}>
        <HeaderStat label="資金" value={g.budget} unit="万円" align="left" valueColor={g.budget < 0 ? T.color.bad : T.color.accent} />
        <HeaderStat label="昇格まで" value={g.points} unit={`/${need}pt`} align="right" valueColor={g.points >= need ? T.color.accent : T.color.text} />
        <HeaderStat label="順位" value={sr.rank || "—"} unit={sr.rank ? `/${sr.total}` : ""} align="right" />
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
          <button onClick={commitRename} disabled={!canCommit} style={{ flex: 1, background: canCommit ? T.color.accent : T.color.surfaceUp, color: canCommit ? T.color.ink : T.color.sub, border: "none", fontFamily: FONT_DOT, fontSize: T.size.body, padding: T.space.md, cursor: canCommit ? "pointer" : "default" }}>変更する</button>
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
          <button onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn(); }} style={{ flex: 1, background: T.color.bad, color: T.color.ink, border: "none", fontFamily: FONT_DOT, fontSize: T.size.body, padding: T.space.md, cursor: "pointer" }}>{confirmDialog.confirmLabel || "OK"}</button>
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
// 第66弾Phase1(devlog/wave66.md): シーズン・モード選択は分類を持たないため既定の
// 「持ち上がり」だけを当てる（片方のモードだけ動いて片方が静止していると不具合に見えるため）。
// keyは画面IDのみ——同じ画面内でのUI操作（アコーディオン開閉等）では再アニメしない。
export function makeWrap({ g, renameState, setRenameState, confirmDialog, setConfirmDialog }) {
  const cls = CLASSES[g.classIdx];
  return (children, opts = {}) => (
    <div style={{ minHeight: "100svh", background: T.color.bg, fontFamily: FONT_DOT, ...(opts.fill ? { display: "flex", flexDirection: "column" } : null) }}>
      <div style={{
        maxWidth: 560, margin: "0 auto", width: "100%", boxSizing: "border-box",
        padding: opts.fill ? "6px 14px 10px" : "6px 14px 40px",
        ...(opts.fill ? { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } : null),
      }}>
        <SeasonHeader g={g} cls={cls} />
        <div key={g.screen} className="ml-enter-rise" style={opts.fill ? { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } : undefined}>{children}</div>
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
// 第66弾Phase1(devlog/wave66.md): メタ画面（モード選択・生涯評価・系譜・因子・CPショップ）も
// 分類を持たないため既定の「持ち上がり」のみ。keyはsuperMode自体が画面識別子になっている
// （renderMetaScreensの分岐がそのままsuperModeの値）。
export function makeMetaWrap({ superMode, renameState, setRenameState, confirmDialog, setConfirmDialog }) {
  return (children) => (
    <div style={{ minHeight: "100svh", background: T.color.bg, fontFamily: FONT_DOT }}>
      <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", boxSizing: "border-box", padding: "6px 14px 40px" }}>
        <div key={String(superMode)} className="ml-enter-rise">{children}</div>
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
  "mylife_create", "mylife_scout", "mylife_badge_goals",
  "mylife_startlist", "mylife_race", "mylife_result", "mylife_rival_scene", "mylife_newspaper",
  "mylife_event", "mylife_protege_event", "mylife_event_result",
  "mylife_offseason", "mylife_offseason_result", "mylife_crossroads", "mylife_crossroads_result",
  "mylife_contract", "mylife_retire_advice", "mylife_retired",
]);

// 第66弾Phase1(devlog/wave66.md): マイライフ6分類の遷移アニメーション。
// transitionInfo={ enterKey, kind }はmain.jsx側で確定済みの値（呼び出し側＝画面遷移を
// 起こす約100箇所は一切関知しない）。⚠️kindは「enterKeyが変わった瞬間」にだけ再計算し、
// 以降そのenterKeyが続く間は固定する——ここchrome.jsx側で毎レンダー計算し直すと、
// 「月が進んだ直後の次のレンダー」でmonthChangedがfalseに戻ってkindが"month"→"rise"に
// ドリフトし、アコーディオン開閉などの無関係な操作のたびに本文が再アニメする実測バグが
// あった（同じenterKeyのままclassNameだけ変わるとCSSアニメーションは再発火する）。
// ⚠️ヘッダーとBottomTabsは{children}の外にあるため、本文だけが動きタブは静止する
// （構造上そうなっている＝正しい挙動）。
export function makeMlWrap({ ml, transitionInfo, renameState, setRenameState, confirmDialog, setConfirmDialog, setMl }) {
  const { enterKey, kind } = transitionInfo || { enterKey: "static", kind: "none" };
  return (children) => (
    <div style={{ minHeight: "100vh", background: T.color.bg, fontFamily: FONT_B }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "6px 14px 40px" }}>
        {ml.player && (() => {
          const need = CLASSES[ml.classIdx].need;
          return (
            <div style={{ fontFamily: FONT_DOT, padding: `${T.space.sm}px 0 ${T.space.md}px`, borderBottom: `1px solid ${T.color.rule}`, marginBottom: T.space.md }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: T.size.caption, color: T.color.sub }}>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ml.team}・{CLASSES[ml.classIdx].label}</span>
                <span style={{ flex: "none", marginLeft: T.space.sm, color: ml.points >= need ? T.color.accent : T.color.sub }}>昇格まで {ml.points} / {need}pt</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: T.space.xs }}>
                <span key={kind === "month" ? `${ml.year}-${ml.month}` : "static"} className={kind === "month" ? "ml-year-pulse" : undefined} style={{ fontSize: T.size.head, color: T.color.text }}>{ml.year}年目 {MONTHS[ml.month]}</span>
                <span style={{ fontSize: T.size.head, color: ml.money < 0 ? T.color.bad : T.color.accent, flex: "none", marginLeft: T.space.sm }}>
                  {ml.money}<span style={{ fontSize: T.size.caption, color: T.color.sub }}>万円</span>
                </span>
              </div>
            </div>
          );
        })()}
        <div key={enterKey} className={`ml-enter-${kind}`}>{children}</div>
        {ml.player && setMl && !TAB_HIDDEN_SCREENS.has(ml.screen) && (
          <BottomTabs screen={ml.screen} onSelect={(key) => setMl(s => ({ ...s, screen: key }))} />
        )}
      </div>
      <RenameModal renameState={renameState} setRenameState={setRenameState} />
      <ConfirmDialog confirmDialog={confirmDialog} setConfirmDialog={setConfirmDialog} />
    </div>
  );
}
