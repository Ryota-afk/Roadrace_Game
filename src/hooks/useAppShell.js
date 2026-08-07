// アプリ全体のシェル状態（モード選択・確認ダイアログ・名前変更モーダル・CPショップ購入）。
// season/mylifeどちらの画面からも参照される「両モード共有」の状態のみをここに集約する。Step7第10弾。
import { useState } from "react";
import { cpBuy, loadMeta, saveMeta } from "../state/state.js";

export function useAppShell() {
  // v14: マイライフモードはシーズンモードとは完全に別の状態を持つ（タイトル画面で選択）。
  // superMode: null=モード未選択（タイトル）／"season"=既存のチーム運営／"mylife"=新モード
  const [superMode, setSuperMode] = useState(null);
  const [uiTick, setUiTick] = useState(0); // v37: CPショップ購入後の再描画トリガー
  const buyCpItem = (id) => { const meta = loadMeta(); const next = cpBuy(meta, id); if (next !== meta) { saveMeta(next); setUiTick(t => t + 1); } };
  // v46(UI): 次のアクション（CP関連の導線整理）。クリアポイントのリセットは元々シーズンの
  // 新規設定画面にしかなく、マイライフ専業プレイヤーには手段が無かった。CP交換所（両モード
  // 共通のメタ画面）へ移設するため、season専用状態(diffChoice等)に依存しない形でここに置く。
  const resetCpProgress = () => { saveMeta({ totalEarnedCP: 0, cpSpent: 0, cpUnlocks: [] }); setUiTick(t => t + 1); };
  // v12バグ修正: window.confirm()はモバイル端末（特にホーム画面追加時のPWA表示や
  // 一部のアプリ内ブラウザ）で表示されない・即falseを返すことがあり、その場合
  // 「最初から」等のボタンを押しても確認ダイアログがブロックされて何も起きない
  // （リセットできていないように見える）。ブラウザ標準のconfirm()に頼らず、
  // アプリ内で完結する確認モーダルに置き換える
  const [confirmDialog, setConfirmDialog] = useState(null);
  const askConfirm = (message, onConfirm) => setConfirmDialog({ message, onConfirm });
  // v29: 選手名の変更用モーダル（アプリ内完結のテキスト入力）
  const [renameState, setRenameState] = useState(null); // { title, value, onCommit }
  const openRename = (title, current, onCommit) => setRenameState({ title, value: current || "", onCommit });

  return {
    superMode, setSuperMode, uiTick, buyCpItem, resetCpProgress,
    confirmDialog, setConfirmDialog, askConfirm,
    renameState, setRenameState, openRename,
  };
}
